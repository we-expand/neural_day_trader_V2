# Sessão 2026-09-09 (noite) — Conselho sobre payoff invertido + fix real de overshoot no stop-watchdog

## Contexto

Motor rodando ~18h no dia (sessão DEMO `11784d5b-b866-443b-bdad-1df6dc360fa1`,
9-12 ativos cripto/índices). Cleber reportou que o motor estava "perdendo a
maioria das operações" e pediu análise + convocação do `llm-council`.

## Diagnóstico real (SQL direto no Supabase, não suposição)

41 trades fechados, **36,6% de acerto, PnL líquido -$15,68**. Payoff
invertido: ganho médio $1,18 vs perda média -$1,29 — oposto ao objetivo do
produto ("perde pouco, ganha muito").

Achados:
1. **61% dos trades (25/41) saíram por stop-loss**, respondendo por -$26,24
   (mais que o prejuízo total). TP (9 trades) trouxe +$11,67. Fechamento
   discricionário da IA (AI_SIGNAL, 7 trades) ficou quase neutro (-$1,10) —
   diferente de sessões passadas catalogadas no projeto, aqui o vilão não é
   a IA fechando errado, é o stop sendo batido demais.
2. **UKOUSD (6 trades, 0% acerto, -$11,99) e SOLUSD (7 trades, 0% acerto,
   -$4,50) somam -$16,49 — mais que 100% do prejuízo do dia.** Padrão de
   reverter direção (LONG→SHORT→LONG) e perder nos dois lados. Resto da
   cesta positivo agregado (~+$0,81).
3. Gate de confiança mínima (80%) segue sem poder preditivo: 90%+ deu 0%
   de acerto (3 trades), 80-89% deu 38,5% — mesmo achado do llm-council de
   governança mais cedo no mesmo dia.
4. **Achado novo, virou o foco da engenharia desta sessão**: 1 trade
   BTCUSD (14:33 UTC) teve a saída ultrapassar o stop configurado em ~115
   pontos (stop 78.875,65, saída real 78.760,19), perda de $5,12 contra
   risco orçado de ~$2 — overshoot de execução, quase 1/3 do prejuízo do
   dia sozinho.
5. Fix de `indicators_snapshot` (aplicado nesta mesma sessão, mais cedo,
   commit `c73c6b63e`) confirmado funcionando de verdade a partir das
   13:53 UTC — antes disso, NULL em ~2/3 dos trades.

## 1ª rodada do llm-council (diagnóstico)

5 conselheiros + revisão cruzada + chairman. Convergência forte em
"First Principles" como resposta mais forte — atacou o processo de
decisão, não só o parâmetro. Veredito:

1. **Overshoot BTCUSD**: bug de infraestrutura determinístico, corrigir
   hoje sem esperar amostra (mas confirmar no log real antes de aplicar,
   não especular) — zero risco de repetir o erro categórico de 04/09
   (corte de stop sem base estatística, 80%→33%) porque não mexe em
   distância/multiplicador.
2. **UKOUSD/SOLUSD**: remover hoje como isolamento cautelar reversível,
   documentado explicitamente como "decisão por amostra pequena (N=6-7),
   não prova de edge negativo" — com data/N definidos por escrito pra
   reavaliar, senão vira permanente por esquecimento (mesmo padrão do
   incidente de `ai_user_config` poluído em 2026-08-31). **Não aplicado
   ainda — pendente de decisão do Cleber** (perguntado no fim da sessão,
   sem resposta ainda).
3. **Trailing 1,6x ATR**: não mexer. Falta isolar quantos dos 25 stops já
   tinham lucro flutuante revertido pelo trailing vs. nunca lucraram —
   sem esse contrafactual, cortar repete o erro de 04/09.
4. **Tensão real**: meta nova do Cleber (">70% de acerto") pode colidir
   com "perde pouco, ganha muito" se a resposta operacional for apertar o
   stop — isso é estruturalmente o mesmo mecanismo que já derrubou
   80%→33%. Caminho correto é melhorar o gate de entrada, não encurtar a
   saída.
5. **N mínimo antes de tocar stop/trailing de novo**: 200-250 trades
   fechados (~5-10 dias) — acima do piso de 40+ já definido no projeto,
   porque a amostra de hoje (41 trades, 1 dia) já se mostrou insuficiente
   até pra separar ruído de sinal em só 2 ativos.

## Investigação real do overshoot (log, não especulação)

`llm-active-brain/llm-brain.log:159` — no exato momento do fechamento:
```
[mt5Broker] ⚠️ AUS200 devolveu o MESMO preco (8824.74) 3x seguidas -- possivel feed travado
[stop-watchdog] Fechamento mecanico IMEDIATO: BTCUSD LONG (SL) entrada=79272.01 saida=78760.19
Erro no ciclo 3: Request timed out.
```

**Causa raiz confirmada no código**: o stop-watchdog (`index.ts`) roda a
cada 3s (`STOP_WATCHDOG_INTERVAL_MS`), mas sua função de cotação
(`getQuoteSingleAttempt`) lia do MESMO cache compartilhado com o caminho
de raciocínio do LLM (`QUOTE_CACHE_TTL_MS = 12_000` em `mt5Broker.ts`,
subido de 8s pra 12s em 2026-09-03 por um motivo real — rate-limit da
MetaAPI). O watchdog podia agir sobre cotação de até 12s de idade em vez
dos ~3s que seu próprio intervalo sugere. O overshoot coincidiu com um
episódio real de degradação do feed (AUS200 preso, ciclo do LLM expirando
por timeout) — exatamente a janela em que esse cache de 12s mais atrasa a
detecção.

## Fix aplicado (commitado, restart já feito pelo Cleber)

`llm-active-brain/src/mt5Broker.ts`:
- `getFreshCachedQuote(symbol, maxAgeMs = QUOTE_CACHE_TTL_MS)` e
  `getQuoteSingleAttempt(symbol, maxAgeMs = QUOTE_CACHE_TTL_MS)` agora
  aceitam um teto de idade opcional em vez de usar sempre o TTL de 12s
  fixo. Caminho de raciocínio do LLM (`getQuote`, `primeQuotes`)
  continua intocado, 12s — preserva a proteção de rate-limit original.

`llm-active-brain/src/index.ts`:
- `STOP_WATCHDOG_MAX_QUOTE_AGE_MS = 4_000` — watchdog agora exige
  cotação com no máximo 4s de idade (vs. 12s antes).
- **Achado do llm-council na 2ª rodada (revisão do próprio fix, ver
  abaixo) evitou um bug novo**: a 1ª versão do fix pedia cotação
  individual por símbolo a cada tick, o que com até 5 posições
  simultâneas (já documentado nesta sessão) reintroduziria o MESMO
  incidente de rate-limit que forçou o TTL a subir pra 12s em 2026-09-03
  (lá, 1 símbolo só — NAS100 — já saturou a conta compartilhada).
  Corrigido: o watchdog agora faz **1 requisição em lote** (`primeQuotes`,
  mesma infraestrutura já usada 1x por ciclo do LLM) para todos os
  símbolos com posição aberta, antes de checar stop/alvo — o teto de 4s é
  atendido pelo cache recém-preenchido, nunca por N fetches individuais.

`tsc --noEmit` limpo, `npm run validate` 37/37 (2x, antes e depois do
ajuste de batching). Não mexe em distância/multiplicador de stop, alvo ou
trailing — só em quão velha uma cotação pode ser antes do
watchdog/take-profit agirem sobre ela (a mesma função `enforceMt5StopsAndTargets`
fecha por SL e TP, confirmado no log — o fix cobre os dois lados sem
trabalho extra).

**Commit `c1edc12b`-era feito e restart confirmado pelo Cleber** (~20:31
-03 de hoje) — processo único vivo, boot limpo, sem erro. **Monitoramento
dos próximos fechamentos por stop e da taxa de erro 429/504 da MetaAPI na
1ª hora pós-restart ainda em andamento** — critério de reversão definido
pelo conselho: se rate-limit subir de forma sustentada, reverter o TTL do
watchdog pra 12s na hora, não esperar mais dado.

## 2ª rodada do llm-council (revisão do próprio fix, antes de aplicar)

5 conselheiros revisaram a implementação em si (não a estratégia).
Achados:
- **Contrarian**: rejeitou a 1ª versão do fix por risco de rate-limit com
  múltiplas posições — motivou a correção de batching acima.
- **First Principles**: aceitou como mitigação correta e bem escopada,
  mas apontou que o fix definitivo de longo prazo é stop-loss nativo na
  corretora (ordem SL enviada à MetaAPI, fecha independente de
  rede/cache/LLM) — **registrado como pendência formal, não implementado
  nesta sessão**.
- **Outsider**: perguntou por que a chamada de reconciliação LIVE ficou
  intocada em 12s — resposta: por design, aquele caminho só aproxima o
  preço de saída de uma posição que já sumiu da corretora, não protege
  capital ativamente.
- **Executor**: checklist de verificação pós-restart (comparar taxa de
  429/504 na 1ª hora, conferir distância entrada/saída no próximo
  fechamento por stop, gatilho de reversão se rate-limit subir).
- **Expansionist**: levantou a dúvida se o take-profit também usa o
  watchdog — confirmado que sim (mesma função), sem trabalho extra
  necessário.

## Validação ao vivo (2026-09-11) — fix confirmado funcionando

Sessão original (`11784d5b...`) fechou (`COMPLETED`). Motor seguiu rodando
com o fix (sessão nova `e6b0a120-f471-4825-9004-e77762123da9`, iniciada
2026-09-10 00:46 UTC) — nesse meio-tempo outro trabalho aconteceu no motor
(commits de MFE/validador de contradição de tendência, não relacionados a
esta sessão).

**Confirmado via SQL direto nos 15 fechamentos por stop mais recentes**:
overshoot caiu pra **0,2%–16% do risco orçado** (maioria abaixo de 3%),
contra os ~250% do incidente original do BTCUSD (115 pontos além do
stop). Pior caso pós-fix (JPN225, 16,13% do risco) ainda uma ordem de
grandeza menor que o incidente que motivou o fix.

**Sem efeito colateral de rate-limit**: só 4 menções reais de rate-limit
em 8.132 linhas de log (~2 dias) — todas narração do próprio LLM sobre um
episódio de feed instável da cesta inteira (não correlacionado ao
watchdog/batching). O receio do Contrarian na 2ª rodada do conselho (múltiplas
posições simultâneas martelando a conta compartilhada) não se
materializou — o batching via `primeQuotes` resolveu isso.

**Monitoramento desarmado a pedido do Cleber em 2026-09-11** — fix
considerado validado e fechado.

## Pendências reais em aberto

1. **UKOUSD/SOLUSD**: decisão de remoção da cesta — Cleber decidiu **não
   mexer por enquanto** ("não mexa nisso agora", 2026-09-11). Não
   aplicado, sem previsão de reavaliar.
2. **Stop-loss nativo na corretora**: fix definitivo de longo prazo pro
   overshoot, fora de escopo desta sessão.
3. **N mínimo de 200-250 trades fechados** (~5-10 dias) antes de tocar
   stop/trailing/ATR de novo — nenhuma mudança de mecânica de saída deve
   ser proposta antes disso.

## De carona nesta sessão

Achada e resolvida a causa de "não vejo 20 sugestões por categoria" no
Dev Lab: migration `20260909_add_ai_suggestion_source_type.sql` (já
existia no repo, nunca tinha sido rodada) — o CHECK constraint de
`source_type` só aceitava `MANUAL`/`AI_RESEARCH`, bloqueando toda
gravação de sugestão de IA em silêncio. SQL entregue pro Cleber rodar no
SQL Editor (função `dev-lab-ai-suggestions` já estava deployada).
