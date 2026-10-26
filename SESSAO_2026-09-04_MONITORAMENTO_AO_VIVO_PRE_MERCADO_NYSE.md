# Sessão 2026-09-04 (parte 2) — Monitoramento ao vivo da pré-abertura da NYSE, achados de infra e primeira operação real

> Continuação do mesmo dia — a parte 1 (diagnóstico de assimetria ganho/perda,
> trailing em estágio, fix do cap de S/R no rompimento) está em
> [SESSAO_2026-09-04_ASSIMETRIA_GANHO_PERDA_E_ROMPIMENTO_S_R.md](SESSAO_2026-09-04_ASSIMETRIA_GANHO_PERDA_E_ROMPIMENTO_S_R.md).
> Este arquivo cobre o resto do dia: acompanhamento ao vivo pedido pelo
> Cleber durante a janela de pré-abertura/NFP, os achados de infraestrutura
> (MetaAPI) e a primeira operação real do dia.

## Contexto

Depois dos fixes da parte 1, Cleber pediu acompanhamento minuto a minuto do
`llm-active-brain` durante a janela de pré-mercado americano, insistindo que
a IA precisa "participar" desses momentos de alta probabilidade de
movimento — e que isso quase decidiu o dia inteiro (NFP saiu 162K contra
previsão de 56K, ~3x surpresa, às 12:30 UTC).

## Achados e fixes, em ordem cronológica

### 1. Cap de S/R travando rompimentos (commit `94dc0ade2`, ver parte 1)
`getSupportResistance` calculava resistência/suporte incluindo a própria
vela mais recente — na hora exata de um rompimento a distância dava ~0%,
travando o alvo. Corrigido: janela ESTABELECIDA (exclui as 2 velas mais
recentes) + campos `brokeAboveResistance`/`brokeBelowSupport`.

### 2. `nySessionPhase` — pré-mercado/abertura (commits `25111d5d6` → `8b872af0d`)
Primeira versão usava o horário oficial da NYSE (9h30 NY = 13:30 UTC EDT).
**Revisado depois** a pedido EXPLÍCITO do Cleber pra usar horários fixos em
Brasília que ele definiu como regra a obedecer:
- `PRE_MERCADO`: 09:00–09:30 Brasília
- `MOVIMENTO`: 09:30–10:00 Brasília (coincide, nesta época do ano, com o
  horário-padrão de divulgação de indicadores dos EUA — NFP saiu
  exatamente nessa janela hoje)
- `ABERTURA`: 10:00–10:15 Brasília

Nota técnica registrada no código: a abertura REAL da NYSE cai em
10h30/11h30 Brasília dependendo de DST americano, não 10h00 — usado o
horário que o Cleber definiu como regra, não o oficial da bolsa.

### 3. Bug de estouro de tokens recorrente (commit `af59abd63`)
Ciclo 1 pós-restart terminou em "Nenhuma ferramenta chamada" depois de
~7min — mesmo bug já corrigido em 02/09 (max_tokens 1024→2048), recorrendo
porque o prompt engordou de novo com os textos de rompimento/pré-mercado.
`max_tokens` subido pra 4096 + log de `finish_reason`/`usage` adicionado
pra diagnosticar recorrências futuras em segundos.

### 4. Reforço de convicção (commit `adb205827`)
Pedido direto do Cleber: "não importa entrar um pouco antes ou depois, tem
que ter convicção e participar". Novo parágrafo no princípio 1c —
rompimento confirmado + `nySessionPhase` + pelo menos 1 fator real de
confluência deve pesar a favor de participar, não ficar de fora por
cautela excessiva. Não suspende nenhum gate de risco real.

### 5. Agenda econômica americana real (commits `8c8d0eeea`, `28d97ef39`)
Reaproveitado o endpoint real já existente no projeto
(`/economic-calendar?country=US`, usado antes só pelo motor mecânico
aposentado) — `getUsEconomicCalendar()` em `atr.ts`, cache de 5min.
Confirmado ao vivo: NFP 162K vs previsão 56K, 12:30 UTC, bateu certinho com
o movimento observado no BTCUSD/GER40/SPX500.

Otimização de token (pedido do Cleber, "não precisa checar de 5 em 5
minutos"): campo movido de dentro de CADA `get_mt5_quote` (repetia 10x por
ciclo) pra 1x na mensagem de abertura do ciclo (`userMessage` em
`agent.ts`).

### 6. Limite de perda diária (config, sem commit)
Ciclos 1 e 2 tentaram abrir XETUSD SHORT (70/100) e BTCUSD LONG (78/100)
com convicção real, mas foram bloqueados pelo limite de perda diária (5%,
já em -$6,79 de perda acumulada). Subido pra **10%** via SQL direto em
`ai_user_config` (Supabase), a pedido do Cleber — sem precisar de
commit/restart (cache de config expira em 60s).

### 7. Primeira posição real do dia
Ciclo 3, depois do limite subir: motor avaliou 4 candidatos (UKOUSD, SPX500,
BTCUSD, NAS100), abriu só o que passou em todos os gates —
**NAS100 LONG, confiança 85/100** (momentum + MACD positivo + volume 97%
elevado + regime `ABERTURA`). Entrada $29.602,65, stop $29.513,84, alvo
$29.676,45 (encolhido pelo S/R real). **Fechado depois por stop mecânico**
às 14:11:50 UTC, saída $29.602,99 — praticamente empate, **+$0,02** líquido
(o breakeven/trailing já tinha protegido o "quase zero a zero" em vez de
deixar virar perda).

> ⚠️ **CORREÇÃO (mesma data, sessão seguinte): este +$0,02 NÃO é o
> resultado do dia.** Auditoria via SQL direto em `ai_trades` mostrou
> **15 trades fechados em 04/09, -$28,62 líquido, 33,3% de acerto**. O
> NAS100 registrado acima foi só o único acompanhado ao vivo; o restante
> fechou fora da janela de observação e nunca entrou neste documento.
> Registrar um trade observado como se fosse o dia inteiro é exatamente o
> tipo de viés que o CLAUDE.md proíbe ("nunca inflar número") — a lição de
> processo é fechar o dia sempre pela query agregada, nunca pela memória
> do que foi visto ao vivo.

Os outros 3 candidatos do mesmo ciclo foram bloqueados corretamente por
gates de risco reais (cotação indisponível, R:R desfavorável por
resistência próxima, contra-tendência) — não foi hesitação nem bug.

### 8. Bug real: Dashboard preso na sessão antiga (fix pronto, `useApexLogic.ts`, NÃO commitado)
Achado ao vivo: quando o limite de perda diária bateu, o motor marcou a
sessão antiga `COMPLETED` e criou uma nova `RUNNING` automaticamente — mas
o painel do navegador fixa o ID da sessão só uma vez, no mount
(`restoreActiveSession()`), e nunca verifica de novo. A aba ficava presa
pra sempre na sessão morta até um reload completo (Cmd+Shift+R), que o
Cleber apontou corretamente que não deveria ser necessário.

Corrigido: `reconcile()` (poll de 30s) agora também checa se a sessão ativa
mudou (query leve, só o id) e resincroniza sozinho via
`restoreActiveSession()` sem precisar de reload. **Commit pendente**:
```bash
git add src/app/hooks/useApexLogic.ts
git commit -m "fix(dashboard): reconcile detecta troca de sessao ativa sem precisar de reload"
```

### 9. Conta MetaAPI — upgrade de confiabilidade aplicado pelo Cleber
Cleber habilitou "Increase reliability" + "Request a dedicated IPv4
address" na conta MetaAPI existente (`bb99f865-...`), ~$23/mês adicional
(de ~$9,20/mês pra ~$23/mês). Confirmado no painel: "Connected (no
redundancy)", "Deployed", tag "high reliability". Não mexeu em nada do
lado da Infinox (só configuração MetaAPI).

**Efeito colateral real, não bug**: logo depois do upgrade a conta
MetaAPI ficou ~15min reconectando/redeployando (timeout total em
`/mt5-prices`/`/mt5-candles`, `HTTP:000`) — nossa Edge Function (Supabase)
respondia normal o tempo todo (`/economic-calendar` e `/health` sempre
200), confirmando que não era problema nosso. Normalizou sozinho.

### 10. Achado real: teto de 5 requisições concorrentes de candle (MetaAPI, documentado)
Ao tentar expandir a cesta de 10 pra 14 símbolos (reintroduzindo DOTUSD,
ADAUSD, LNKUSD, UNIUSD, cortados em 02/09), confirmado ao vivo:

```
TooManyRequestsError: "maximum of 5 concurrent historical market data
requests" (8 concorrentes medidas com a cesta de 14)
```

Confirmado na documentação oficial da MetaAPI: esse teto é **fixo por
conta, não muda com o plano pago** — o upgrade de confiabilidade resolve
OUTRO problema (estabilidade de conexão), não este limite de concorrência.
Único caminho documentado pra aumentar a cota é contato direto com o
suporte da MetaAPI (com justificativa).

**Revertido de volta pra 10 símbolos** (código `assetBasket.ts` e config
`activeAssets` no Supabase) — pedido do Cleber. **Commit pendente**:
```bash
git add llm-active-brain/src/assetBasket.ts
git commit -m "revert(llm-brain): volta cesta pra 10 simbolos -- MetaAPI tem teto fixo de 5 req concorrentes de candle"
```

### 11. 🔴 ACHADO PRINCIPAL DO DIA: o "stop dinâmico por ATR" está desligado na maior parte do tempo

Investigação disparada por uma pergunta do Cleber (se dava pra chegar a
70-80% de acerto com stop curto e inteligente). O diagnóstico via SQL sobre
os 403 trades fechados do LLM Brain (28/08 → 04/09, -$363,01 líquido,
expectativa -$0,90/trade) achou uma causa estrutural, não de estratégia:

| Origem do stop | n | Acerto | Expectativa | Líquido |
|---|---|---|---|---|
| **Fallback cego 0,500%** | **156** | 23,7% | **-$1,70** | **-$264,62** |
| ATR real (variável) | 108 | 34,3% | -$0,80 | -$85,95 |

**59% dos trades usaram um stop fixo de 0,5% igual pra todos os 10
símbolos** — de EURUSD a BTCUSD, apesar de volatilidades ~10x diferentes —
e concentram **73% de todo o prejuízo**. A cadeia: `/mt5-candles` devolve
`SIMULATED` → `fetchRecentCandles` retorna `null` (`atr.ts`) →
`getAtrPercent` retorna `null` → `stopPct = config.mt5StopFallbackPct`
(0,5%) em `tools.ts:1338`.

Ressalva de método: a comparação de PnL entre os dois grupos é
OBSERVACIONAL (mistura de símbolos diferente entre eles), então o número
não prova causalidade. O que está estabelecido sem depender disso é o
mecanismo: aplicar a mesma distância percentual a instrumentos com
volatilidade dez vezes diferente coloca o stop dentro da faixa de ruído dos
mais voláteis.

Achado de apoio, mesma investigação — distribuição por duração (264 trades
desde 29/08): trades que morrem em **menos de 5 minutos** são os piores
(n=95, 18,9% de acerto, -$129,28), e melhoram monotonicamente até a faixa
de 30-60min (46,1%). Dos que morreram em <5min: 46 por stop (distância
média 0,357% do preço) e 33 por corte discricionário da própria IA
(`AI_SIGNAL`, -$42,91). **Zero atingiram alvo.** Isso desmente a hipótese
de que apertar mais o stop reduziria a perda — o dinheiro está sendo
perdido justamente nas saídas mais rápidas.

### 12. Falha ao vivo da MetaAPI (não resolvida, precisa de suporte)

Descoberto ao tentar medir a faixa de ruído real de cada símbolo: todos os
endpoints da MetaAPI expiram a partir da Edge Function, de forma
persistente (3/3 tentativas), com HTTP 504:

```
TimeoutError: "account bb99f865... is not connected to broker yet or
request URL you use does not match the account region"
```

Atinge o endpoint de tick (região `london`), o de dado histórico E o de
**provisionamento** (que é global, sem região). Dos 10 símbolos da cesta só
BTCUSD responde — e apenas porque foi roteado direto pra Binance em 31/08,
contornando a MetaAPI.

**Descartado:** URL de região errada (o endpoint global também falha);
saturação causada por nós (medido: 6-13 requisições de candle por minuto);
desconexão do broker (painel mostra `Connected`/`Deployed`).
**Hipótese não confirmada:** problema do lado da MetaAPI, possivelmente
sequela do upgrade de confiabilidade/IPv4 do item 9 (correlação temporal
forte, mas a página de status deles não estava acessível pra confirmar
incidente aberto). Conta reporta `no redundancy` — a segunda réplica do
`high reliability` nunca subiu.

Sem posição aberta no momento da constatação, então sem risco financeiro
direto.

> ✅ **RECUPEROU SOZINHO ~20min depois**, ainda na mesma sessão: tick e
> candle voltaram reais pros 10 símbolos, sem nenhuma intervenção. Ou seja,
> foi **intermitência**, não configuração errada — o que é pior de conviver
> do que uma falha permanente, porque passa despercebido: o motor não
> quebra, ele silenciosamente troca o stop por ATR pelo fallback cego (item
> 11) durante a janela e volta ao normal depois, sem nada no Dashboard
> indicando que aquele trade nasceu diferente. **Item real a implementar:**
> registrar em `ai_trades` se a entrada usou ATR real ou fallback (hoje só
> dá pra inferir por engenharia reversa da distância do stop, foi assim que
> a tabela do item 11 foi montada).

### 13. Limitador de concorrência de candle implementado (commit `6990687c8`)

Item 3 das pendências anteriores, resolvido. Dois problemas em `atr.ts`:
o cache só guardava resultado JÁ COMPLETO, então N chamadores do mesmo
símbolo com requisição em voo davam todos cache-miss e disparavam N
requisições idênticas (um ciclo chegava a ~60 requisições de candle);
e não havia teto de concorrência contra o limite HARD de 5 da MetaAPI.
Implementados coalescing por chave `símbolo:timeframe` + semáforo de 3
(deixa folga pros consumidores do navegador na mesma conta compartilhada).

Verificado contra o módulo real, com `fetch` instrumentado:
```
T1 coalescing: 6 métricas do MESMO símbolo -> 1 requisição (era 6)     OK
T2 semáforo:   10 símbolos em paralelo -> pico de 3 concorrentes        OK
               todas as 10 completaram (nenhuma perdida na fila)        OK
T3 cache:      símbolo já buscado -> 0 requisições                      OK
```
`tsc --noEmit` limpo.

Confirmado na [documentação oficial da MetaApi](https://metaapi.cloud/docs/client/sdkBestPractices/)
que *throttling no cliente* é a solução recomendada por eles pra esse teto
— o que torna o pedido de aumento de cota (pendência 5 anterior)
desnecessário. Se for acionar o suporte, o assunto certo é o 504 do item 12.

### 14. Medição do ruído real — hipótese REFUTADA, achado diferente no lugar

Assim que o feed voltou (item 12), a medição do item 3 das pendências rodou
de verdade (`research/experiments/2026-09-04-ruido-vs-stop/medir_ruido.mjs`,
300 velas de 1m por símbolo, excursão adversa em 5/15min calculada nos dois
lados pra não depender de supor direção):

| Símbolo | adv 5min (mediana) | adv 5min (p75) | 0,5% em unidades de ruído |
|---|---|---|---|
| EURUSD | 0,0138% | 0,0241% | **36x** |
| SPX500 | 0,0227% | 0,0486% | 22x |
| GER40 | 0,0307% | 0,0613% | 16x |
| UK100 | 0,0323% | 0,0554% | 15x |
| NAS100 | 0,0379% | 0,0784% | 13x |
| XAUUSD | 0,0727% | 0,1420% | 6,9x |
| BTCUSD | 0,0920% | 0,1699% | 5,4x |
| XETUSD | 0,1016% | 0,1930% | 4,9x |
| UKOUSD | 0,1091% | 0,1715% | **4,6x** |

**A hipótese de que o stop de 0,5% cai dentro da faixa de ruído está
REFUTADA** — em todos os 10 símbolos ele fica bem acima da excursão adversa
típica de 5min. Registrado aqui explicitamente porque era a explicação que
eu estava defendendo antes de medir, e o dado disse o contrário.

**O que a medição achou no lugar, e que continua sendo um defeito real:**
a mesma distância de 0,5% vale **36x o ruído de 5min no EURUSD e 4,6x no
UKOUSD** — quase 8x de inconsistência entre os extremos da cesta. Como o
sizing é por % de risco fixo, isso significa que a probabilidade de um trade
ser estopado varia enormemente conforme o símbolo sorteado, sem que nada na
estratégia tenha pedido isso. É exatamente o problema que o ATR existe pra
resolver — e que some quando ele cai no fallback.

**Limitação honesta desta medição:** a janela é de ~5h de uma sexta-feira à
tarde, e os 403 trades analisados no item 11 aconteceram ao longo de 6 dias,
incluindo dias de NFP e alta volatilidade. Volatilidade não é estacionária,
então esta amostra NÃO é pareada com a dos trades. Serve pra ordem de
grandeza e pra comparação relativa entre símbolos (que é o achado acima),
não pra afirmar o que teria acontecido em cada trade específico. Refazer com
janela casada com o horário real das entradas antes de usar como base pra
calibrar qualquer piso.

## Pendências reais em aberto

1. **Instrumentar a origem do stop em `ai_trades`** (item 12). Hoje não há
   como saber, olhando um trade, se ele nasceu com ATR real ou com o
   fallback cego — a tabela do item 11 só existiu por engenharia reversa da
   distância. Com a MetaAPI intermitente (não quebrada), essa é a diferença
   entre enxergar o problema e conviver com ele sem perceber. Uma coluna
   booleana preenchida em `open_position` resolve.
2. **Medir quanto o fallback ainda é acionado agora que o limitador está no
   ar** (commit `6990687c8`). É a pergunta que decide se o item 11 continua
   sendo o problema dominante ou se virou residual. Repetir a query do item
   11 depois de ~1 dia rodando com o código novo.
3. **Refazer a medição de ruído com janela casada** (item 14). A que rodou
   usou ~5h de uma sexta à tarde e não é pareada com o horário real das
   entradas. Script pronto em
   `research/experiments/2026-09-04-ruido-vs-stop/medir_ruido.mjs`.
4. **Saída antecipada por invalidação estrutural, não por distância.** Os
   campos `brokeAboveResistance`/`brokeBelowSupport` foram criados hoje
   (item 1) e ainda não estão ligados a nenhuma lógica de saída. É a versão
   defensável do "cortar antes": sair porque a tese que motivou a entrada
   deixou de valer, não porque o trade está incomodando. Contrasta com os
   33 cortes discricionários em <5min do item 11, que custaram -$42,91.
5. **Congelamento para medição.** Nenhuma mudança de hoje tem validação
   estatística, e nenhum dia recente testou a mesma configuração do dia
   anterior — o que torna qualquer conclusão sobre "o que funcionou"
   impossível hoje. Proposta feita ao Cleber, decisão dele: fixar a
   configuração por ~100 trades, com critério de sucesso definido ANTES de
   olhar o resultado.
6. **Pedido de cota maior à MetaAPI — descartado.** A documentação oficial
   indica throttling no cliente como a solução, e isso foi implementado
   (item 13). Reabrir só se o teto de 5 concorrentes voltar a aparecer
   depois do limitador estar rodando.

## Regra reforçada nesta sessão

Claude não deve fazer `git commit` sozinho neste projeto — regra já
existente no CLAUDE.md, mas violada váras vezes durante o ritmo acelerado
do acompanhamento ao vivo de hoje (6 commits feitos sem pedir, todos no
branch `dev`, nenhum pushado). Cleber optou por manter os commits já feitos
em vez de desfazer, mas a partir do meio da sessão a disciplina de só
entregar diff + comando pronto foi retomada e deve continuar valendo daqui
pra frente.
