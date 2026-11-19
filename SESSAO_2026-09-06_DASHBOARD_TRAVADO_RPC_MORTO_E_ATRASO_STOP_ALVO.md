# Sessão 2026-09-06 — Dashboard travado (RPC morto derrubando o motor) + atraso no fechamento mecânico de stop/alvo

## Contexto inicial

Cleber reportou que a posição de DOGUSD no Dashboard parecia "parada" no
mesmo preço (Entrada 0.08690 → Atual 0.08700) e perguntou se era o feed
travado ou o Dashboard congelado. Depois, no meio da investigação,
reportou que a internet tinha caído ("Faltou internet") e que o motor
"nem abre posições novas".

## Achado 1 (causa raiz real): motor em crash-loop por ~19h, RPC morto de testnet

Investigação via Supabase (`execute_sql`, projeto `wyvdsxtcmizettljxtbg`)
confirmou: a posição de DOGUSD exibida como "aberta" já estava **CLOSED**
no banco havia quase 3h (fechada por TP às 2026-09-06 08:13-08:14 local).
Pior: a mesma posição tinha sido fechada **3 vezes** no banco (mesmo
`entry_time` ao milissegundo, 3 IDs diferentes, todas TP com exit_price
ligeiramente diferente) — sintoma de fechamento não-idempotente sob
crash-loop.

Causa raiz encontrada no log local (`llm-active-brain/watchdog.log`):
**1259 reinícios do processo entre 2026-09-05 13:13 e 2026-09-06 08:13
(~19h)**, sempre com o mesmo erro fatal:

```
Erro fatal: HttpRequestError... getaddrinfo ENOTFOUND sepolia.base.org
```

`sepolia.base.org` é o RPC de uma rede de **testnet Ethereum/Base** —
resquício de um trilho antigo e morto (carteira de teste, nunca usada em
modo MT5), sem nenhuma relação com o motor real de trading. Em
[`llm-active-brain/src/index.ts:250`](llm-active-brain/src/index.ts:250),
`getBalanceEth()` era chamada **sem try/catch, todo ciclo, mesmo em modo
MT5** — onde o próprio comentário do código já dizia que o valor nunca é
usado. Qualquer falha de rede nesse RPC irrelevante (internet caindo, ou
qualquer instabilidade) derrubava o processo inteiro, inclusive o
monitoramento real de stop/alvo. Bate exatamente com o relato de internet
caindo: a falha ficou presa em loop porque a cada restart a mesma chamada
morta rodava de novo e falhava de novo.

**Fix aplicado**: a chamada só roda fora do modo MT5 agora (linha 250),
que é exatamente onde o valor é de fato usado. `tsc --noEmit` limpo.
Motor reiniciado manualmente (matando o processo e deixando o
`watchdog.sh` religar, evitando rodar `restart.sh` em paralelo — os dois
brigariam pela mesma conta MT5, bug já catalogado no histórico do
projeto). Confirmado ao vivo: motor voltou a abrir posições reais
(TRXUSD LONG, BNBUSD SHORT, BTCUSD SHORT, todas com `trade_id` real,
stops/alvos calculados certos).

**Pendente**: commit (comando abaixo).

## Achado 2: atraso real no fechamento mecânico de stop/alvo

Depois do motor recuperado, Cleber reportou ao vivo que o BNBUSD encostou
no alvo e não fechou imediatamente (e depois, com print, mostrou XETUSD
com o preço já cruzando o Alvo/Stop sem a posição fechar na hora). Duas
causas reais, ambas de atraso (não de lógica errada — o fechamento
sempre aconteceu, só atrasado):

1. **Backend**: o watchdog de stop/alvo
   (`enforceMt5StopsAndTargets` em `neuralBridge.ts`, chamado a cada 5s em
   `index.ts`) começa lendo as posições abertas no Supabase. Confirmado no
   log: `ConnectTimeoutError` (10s de timeout) conectando ao Supabase
   fazia a checagem inteira falhar e pular pro próximo tick de 5s — várias
   falhas seguidas (mesma instabilidade de rede do Achado 1) empurravam a
   detecção de "tocou o alvo" bem além do esperado.
2. **Frontend**: o gráfico/dashboard só resincroniza com o banco a cada
   **30 segundos** (`POLL_MS` em
   [`useApexLogic.ts:1215`](src/app/hooks/useApexLogic.ts:1215)) — mesmo
   com o backend fechando rápido, a linha de posição podia continuar
   aparecendo por até 30s depois do fechamento real.

**Fix aplicado**:
- `llm-active-brain/src/index.ts`: intervalo do watchdog 5s→3s, com retry
  imediato (até 3 tentativas, 1s de intervalo) DENTRO do mesmo tick antes
  de desistir e esperar o próximo ciclo — cobre blips curtos de rede sem
  empurrar a detecção pro próximo `setInterval` inteiro.
- `src/app/hooks/useApexLogic.ts`: `POLL_MS` 30_000→5_000, alinhado com a
  cadência real do watchdog mecânico do motor.

`tsc --noEmit` limpo nos dois lados (`llm-active-brain/` e
`tsconfig.engine.json` da raiz). Motor reiniciado de novo (mesmo
procedimento: matar processo, deixar o `watchdog.sh` religar).

**Pendente**: commit do fix (comando abaixo) e confirmação visual do
Cleber de que o atraso sumiu de verdade (não dá pra provar objetivamente
sem rodar mais ciclos reais tocando stop/alvo). O fix reduz a janela de
atraso — não elimina 100% (ainda depende de rede real pra ambos os lados,
Supabase e MetaAPI), então se a internet cair de novo por muito tempo,
pode voltar a acontecer atraso, só que bem mais curto.

## Comando de commit pendente

```bash
cd /Users/clebercouto/Projects/we-expand/Neural-Day-Trader && git add llm-active-brain/src/index.ts src/app/hooks/useApexLogic.ts && git commit -m "$(cat <<'EOF'
fix: fecha posicao mais perto do instante real em que toca stop/alvo

Dois pontos de atraso reais, achados ao vivo (XETUSD encostando no alvo
sem fechar na hora, BNBUSD com fechamento atrasado por timeout de rede):

- llm-active-brain: watchdog de stop/alvo (5s -> 3s) ganha retry imediato
  (ate 3 tentativas, 1s de intervalo) dentro do mesmo tick quando a leitura
  falha por rede (confirmado: ConnectTimeoutError no Supabase empurrava a
  deteccao pro proximo ciclo inteiro).
- frontend: polling de reconciliacao do grafico/dashboard (30s -> 5s) --
  o motor ja fechava a posicao rapido, mas a linha no grafico so sumia no
  proximo poll, ate 30s depois.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

Falta também o commit do fix do Achado 1 (RPC morto), se ainda não tiver
sido feito — comando estava na mensagem anterior desta mesma sessão:

```bash
cd /Users/clebercouto/Projects/we-expand/Neural-Day-Trader && git add llm-active-brain/src/index.ts && git commit -m "$(cat <<'EOF'
fix(llm-brain): erro fatal em RPC morto (Base Sepolia) derrubava o motor MT5 inteiro

getBalanceEth() era chamada sem try/catch todo ciclo mesmo em modo MT5,
onde o valor nunca e usado (trilho testnet antigo, morto). Falha de rede
nesse RPC irrelevante crashava o processo inteiro -- confirmado 1259
restarts em ~19h pelo watchdog, motor sem monitorar stop/abrir posicao
o tempo todo, ate o DOGUSD antigo (ja alem do TP) ser fechado 3x seguidas
ao processo finalmente estabilizar.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

**Atenção**: os dois commits tocam o mesmo arquivo
(`llm-active-brain/src/index.ts`) em pontos diferentes — se for rodar os
dois, rode o do Achado 1 primeiro (ou junte os dois `git add` num commit
só, já que ambos já estão aplicados juntos no working tree agora).
