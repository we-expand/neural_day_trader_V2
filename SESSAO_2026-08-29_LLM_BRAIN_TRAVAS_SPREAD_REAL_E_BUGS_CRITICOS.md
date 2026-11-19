# Sessão 2026-08-29 — LLM Active Brain: travas anti-perda, spread real, 2 bugs críticos corrigidos

## Contexto

Cleber reportou ter deixado o Cérebro LLM Ativo (`llm-active-brain`, trilho
isolado que opera a mesma cesta/preço/execução do motor mecânico, sem gate
mecânico de decisão) rodando por horas e encontrado ~-$84 de prejuízo ao
voltar. Pediu análise profunda, depois otimizações urgentes, depois discutiu
4 referências de trader reais pra ver o que era aplicável ao sistema, depois
mudou a filosofia de saída pra "giro com alvo curto", e no meio do caminho
apareceram 2 bugs de infraestrutura sérios que só ficaram visíveis por causa
das mudanças de hoje. Sessão longa, muita coisa aconteceu — resumo em ordem.

## 1. Análise do prejuízo real

Consulta direta no Supabase (sessão `LLM_ACTIVE_BRAIN_MT5`, id `6220f3b4...`,
rodando desde 02:52 UTC): **PnL realizado real era -$119,36** (não -$84 —
Cleber pegou um instante com posições ainda flutuando), 197 trades fechados.

Achado principal, com split exato no horário do commit da sessão anterior
(09:12 BRT / 12:12 UTC, que removeu o teto de take-profit e subiu a exposição
$800→$1200):

| | Trades | PnL | Win rate | Ganho médio | Perda média | Pior perda |
|---|---|---|---|---|---|---|
| Antes da mudança | 143 | -$5,37 | 46% | $0,38 | -$0,40 | -$5,96 |
| Depois da mudança | 56 | **-$115,21** | 27% | $0,85 | **-$3,20** | **-$12,62** |

**96% do prejuízo do dia veio das 56 operações depois da mudança.** Causa
raiz visível no log de trades: a partir de ~14:00 UTC o agente empilhou
SHORT simultâneo em BTCUSD/SOLUSD/XETUSD (até o teto de 3/símbolo em cada
um — 9 posições no mesmo lado) bem no meio de um rali de várias horas nesses
3 ativos correlacionados, segurando os perdedores por até 6h antes de fechar,
sem qualquer noção de tendência ou participação de mercado por trás do
movimento.

## 2. Otimizações urgentes implementadas

Em `llm-active-brain/src/`:

- **`assetBasket.ts`**: `getCorrelatedGroup()` — trata BTCUSD/XETUSD/SOLUSD
  como um bloco só.
- **`config.ts`**: `mt5MaxCorrelatedNotionalUsd` (teto de exposição do MESMO
  lado somada no grupo inteiro, não só por símbolo), `mt5LossStreakThreshold`
  + `mt5LossStreakCooldownMinutes` (cooldown de reentrada após perdas
  seguidas).
- **`atr.ts`**: `getTrendInfo()` (variação % e rótulo ALTA/BAIXA/LATERAL na
  última 1h) e `getVolumeConfirmation()` (tickVolume real da MetaAPI vs média
  de 1h — proxy honesto de participação, não fabricado).
- **`tools.ts` (`open_position`)**: bloqueia (a) exposição combinada do grupo
  correlacionado acima do teto, (b) reentrada no mesmo símbolo+lado após 2
  stops seguidos dentro do cooldown, (c) entrada contra a tendência sem
  volume acima do normal confirmando.
- **`agent.ts`**: prompt reescrito com 7 princípios de disciplina (tendência
  como informação, contrarian só com confirmação, correlação como risco
  único, perda repetida como sinal, convicção rara, paciência válida, corte
  rápido de posição errada).

## 3. Referências de trader discutidas (Rotter, Pulcini, Antunes, Kotegawa)

Cleber perguntou sobre dar a personalidade/habilidades de 4 traders reais à
LLM. Pesquisado via web (nenhum inventado):

- **Paul Rotter** ("The Flipper"), **Scott Pulcini** e **André Antunes**
  (fundador da Scalper) são os 3 do mesmo arquétipo: scalpers de **order
  flow / tape reading** em futuros/mini-contratos, dependentes de book de
  ofertas em tempo real e execução de segundos. **Não aplicável ao pé da
  letra** — este sistema não tem book de ofertas, só preço + candle de 5min,
  e o ciclo é de 10s+latência de LLM. Copiar a técnica seria fingir ler um
  dado que não existe.
- **Takashi Kotegawa (BNF)**: US$13 mil → US$150+ milhões com paciência
  extrema, seletividade, mean-reversion só com confirmação de exaustão.
  **Totalmente aplicável** — virou a base dos princípios do prompt.

O que foi honesto de aproveitar dos 3 primeiros: a ideia por trás do tape
reading (participação real confirma o movimento), usando o **volume real**
(tickVolume da MetaAPI) como proxy — não fabricando order flow que não existe.
Isso virou o gate de "contrarian sem confirmação de volume" nas otimizações
acima.

## 4. Mudança de filosofia: giro com alvo curto

Pedido do Cleber: "entra na operação, deixa correr um alvo pequeno, recolhe
e parte pra outra" — em vez de deixar o vencedor correr indefinidamente
(estratégia da sessão anterior, que na prática deixou os PERDEDORES correrem
mais, não os ganhadores).

- **`neuralBridge.ts`**: `take_profit` volta a ser gatilho mecânico de
  fechamento (tinha sido desligado na sessão anterior).
- **`config.ts`**: `mt5TakeProfitAtrMultiplier` 3 → 1,5 (R:R ~1:1, alvo
  curto) → depois ajustado pra **1,7** (ver spread, seção 7).
  `mt5LowVolumeTakeProfitMultiplier` (0,6) encolhe o alvo ainda mais em
  dia/momento de volume abaixo da média — não trava capital esperando um
  movimento que o volume do dia não sustenta.

## 5. Bug crítico #1: stop-loss mecânico nunca funcionou o dia inteiro

Achado checando os dados direto no banco durante o reset de patrimônio
(seção 6): o código gravava `exit_reason` como `"STOP_LOSS"`/`"TAKE_PROFIT"`,
mas a constraint real da tabela (`ai_trades_exit_reason_check`) só aceita
`'TP'|'SL'|'MANUAL'|'TIMEOUT'|'AI_SIGNAL'` (mesma convenção do motor
mecânico, `AITradingPersistenceService.ts:73`). Todo `UPDATE` de fechamento
mecânico **violava a constraint e falhava silenciosamente** (capturado pelo
try/catch, só logava no console).

Confirmado no banco: **dos 206 trades fechados no dia, 100% tinham
`exit_reason='AI_SIGNAL'`, zero tinham o texto de fechamento mecânico.** O
stop-loss "mecânico" documentado desde a auditoria da madrugada nunca
protegeu nada — toda posição que fechou, fechou porque o LLM decidiu fechar
sozinho. Isso também quebrava silenciosamente o circuito de perda
consecutiva da seção 2 (mesmo campo). Corrigido: `"STOP_LOSS"`/`"TAKE_PROFIT"`
→ `"SL"`/`"TP"` em `neuralBridge.ts`, `agent.ts`, `tools.ts`.

## 6. Reset de patrimônio para $50

A pedido do Cleber, após o fix do bug #1:
- Fechadas as 9 posições que estavam abertas na sessão antiga, a preço real
  de mercado, `exit_reason='MANUAL'`, com nota explícita no `ai_reasoning`
  (não é `UPDATE` silencioso — segue a convenção do projeto de nunca
  reescrever registro financeiro sem rastro).
- Sessão antiga (`6220f3b4...`) preservada intacta como histórico auditável
  do dia (-$119,36 realizados).
- Nova sessão criada (`38669eeb...`), `initial_balance`/`initial_equity` =
  $50, referenciando a sessão anterior no campo `config`.

## 7. Bug crítico #2: entradas não descontavam o spread

Cleber percebeu que as entradas não contemplavam o spread — impossível saber
se a estratégia realmente vale a pena sem isso. Investigado: `getQuote`
(`mt5Broker.ts`) só devolvia o preço médio (mid/last tick); abertura,
fechamento e PnL flutuante usavam esse único preço, como se comprar e vender
acontecessem no mesmo valor.

Corrigido:
- `mt5Broker.ts`: `getQuote` agora devolve `bid`/`ask` reais.
- `tools.ts` (`open_position`): LONG preenche no **ask**, SHORT no **bid**.
- `tools.ts` (`list_open_positions`): PnL flutuante calculado contra o preço
  que fecharia a posição AGORA (bid pra LONG, ask pra SHORT) — efeito direto
  pedido pelo Cleber: **uma posição recém-aberta já nasce com PnL negativo
  igual ao spread**, só vira lucro depois que o preço cobre esse custo, igual
  corretora real.
- `tools.ts` (`close_position`) e `neuralBridge.ts`
  (`enforceMt5StopsAndTargets`, incluindo breakeven/trailing): mesma lógica
  de saída pelo lado certo do book.
- `config.ts`: alvo subiu de 1,5x pra **1,7x ATR** (pouco, a pedido do
  Cleber) — margem extra pra sobrar lucro líquido depois de pagar o spread
  na entrada E na saída (R:R 1:1 exato zeraria com o giro rápido).

## 8. Bug de infraestrutura descoberto (mitigado depois, seção 11 — não corrigido na origem)

Durante o diagnóstico de "a LLM não está abrindo posições": `trend`/`volume`
vinham `null` sempre porque o endpoint `/mt5-candles` da MetaAPI devolve
**HTTP 404** pra BTCUSD/XETUSD/SOLUSD nesta conta (cai em fallback
`SIMULATED`, corretamente descartado pelo código — nunca decide em cima de
candle fabricado). O prompt, sem essa camada de confirmação, foi lido pelo
LLM como "sem sinal, não opere" — paralisia total.

**Primeira correção (só no prompt)**: `null` passou a significar
explicitamente "dado indisponível agora", não "sem tendência" — o modelo
deveria usar `changePercent` e operar pelo julgamento normal. **Isso não foi
suficiente** (ver seção 10) — o problema real não era o texto do prompt, era
a ausência total de sinal de direção confiável.

**Causa raiz do 404 em si**: não corrigida (fora do escopo deste repo, seria
no endpoint `/mt5-candles`/conta MetaAPI — provavelmente o símbolo precisa
estar "subscrito" pra streaming de histórico). Ver seção 11 pra como isso
acabou sendo contornado sem depender do fix de infraestrutura.

## 9. Operacional: processo duplicado (de novo) + workflow de commit

- Processo duplicado do `llm-active-brain` apareceu de novo (3ª vez
  documentada em 2 dias) — 2 PIDs rodando em paralelo contra a mesma sessão,
  identificados via `ps aux | grep "tsx src/index"` e mortos.
- Cleber reportou "vários commits não subiram" — diagnosticado: ele executava
  `git add src/...` de DENTRO de `llm-active-brain/` (que tem sua própria
  árvore `src/`), então `src/app/components/dashboard/...` (caminho da raiz)
  nunca batia, `git add` falhava com pathspec error, e o commit seguinte
  rodava vazio ("no changes added"). As 3 tentativas de fix do
  `LlmActiveBrainPanel.tsx` (Dashboard) nunca foram commitadas até serem
  refeitas a partir da raiz do projeto.
- `OmniRoute/` (8,1 GB, projeto completamente separado) encontrado untracked
  dentro da pasta do repo durante um "commit tudo" — excluído
  deliberadamente do commit pra não subir 8GB de outro projeto por engano.

## 10. Cesta de ativos trocada (6 → 15 → 8, na mesma conversa)

Cleber pediu pra "aumentar a cesta de análise". Primeira tentativa: 6 → 15
símbolos (forex majors/minors reais + BTCUSD/XETUSD/SOLUSD/XBNUSD/XLCUSD),
cada candidato testado ao vivo contra `/mt5-prices` antes de entrar (mesma
lição do bug do "ETHUSD" de sessões anteriores — nome plausível não é
cotação real garantida). No meio do processo, Cleber pediu uma cesta
diferente: **8 símbolos específicos, todos cripto/cross, zero forex** —
`BTCUSD, XETUSD, SOLUSD, DOGUSD, DOTUSD, XRPUSD, XPTUSD, BTCXBN`. Todos os 8
confirmados com bid/ask reais na nomenclatura exata que ele passou (alguns
diferentes do catálogo genérico do app — `assetDatabase.ts` não tem entrada
pra esses símbolos com essa grafia, mas a MetaAPI cota normalmente).

- `assetBasket.ts` reescrito pra essa cesta de hoje.
- Grupo correlacionado: BTCUSD/XETUSD/SOLUSD/DOGUSD/DOTUSD/XRPUSD/BTCXBN
  juntos (mesmo risco cripto); XPTUSD (platina, metal precioso) fica de fora
  do grupo.
- Prompt com missão explícita: hoje é dia de **reconhecimento** dos 5 ativos
  novos (nunca operados antes) — o modelo deve registrar em `log_thought`
  volatilidade/tendência/volume/convicção específicos de cada um, pra
  informar a decisão de manter/ajustar a cesta amanhã.
- `maxIterations` ajustado (15 → 25) pra caber checar os 8 ativos + agir por
  ciclo sem esbarrar no teto.

## 11. Bug crítico #3: `trend`/`volume` ficavam `null` SEMPRE (fix de verdade, não só de prompt)

Cleber reportou: "capacidade de analisar as entradas está muito fraca...
não está conseguindo ver pra onde o mercado está indo". Confirmado no log
do processo rodando: `trend`/`volume` vinham `null` em **100% dos ciclos**,
sempre — a correção da seção 8 (só no texto do prompt) não resolveu porque
o problema não era o modelo interpretar mal o `null`, era a **ausência
total** de qualquer sinal de direção além do preço de um instante isolado.

Causa raiz confirmada: `trend`/`volume`/parte do ATR dependiam 100% do
endpoint `/mt5-candles`, que devolve 404 pra toda a cesta nesta conta
MetaAPI (seção 8). Em vez de esperar um fix de infraestrutura fora do
escopo deste repo, a solução foi fazer o próprio processo **construir sua
própria série de preço real em memória**, a partir da ÚNICA fonte que
comprovadamente funciona (`/mt5-prices`, já consultada a cada ciclo):

- **`tickHistory.ts`** (novo): guarda até 65min de ticks reais por símbolo.
  `getTickTrend` (tenta janela de 60min → 30min → 15min conforme o
  histórico disponível), `getTickVolatility` (amplitude real de preço, vira
  fallback de ATR), `getMomentumAcceleration` (compara inclinação recente
  de 5min vs anterior de 5-20min — proxy honesto de "participação
  crescente" sem volume real disponível).
- `mt5Broker.ts`: todo tick REAL (nunca SIMULATED) grava nesse histórico.
- `atr.ts`: `getTrendInfo`/`getVolumeConfirmation`/`getAtrPercent` tentam o
  candle oficial primeiro, caem pro histórico de tick real quando ele falha
  (o que está acontecendo sempre, hoje). Campo `source` novo
  (`"candle"`/`"tick"`, `"candle_volume"`/`"tick_momentum"`) expõe pro LLM
  de onde veio cada número — nunca fabricado, só fonte diferente de dado
  real.

**Limitação honesta**: não é candle oficial da corretora, é uma série
construída a partir de ticks — a precisão melhora com o tempo de processo
rodando (janela de 60min só fica completa depois de 1h ligado; logo após
reiniciar, `trend`/`volume` ainda podem vir `null` por alguns minutos até
acumular histórico suficiente). Ainda sem amostra real de como isso
performa em produção.

## Estado final / pendências pra próxima sessão

- Nenhuma pendência de código das mudanças desta sessão — todas commitadas e
  pushadas (`dev` sincronizada com `origin/dev`).
- Processo do `llm-active-brain` reiniciado, rodando com: travas de
  correlação/cooldown/volume, giro com alvo curto (1,7x ATR), `exit_reason`
  corrigido, spread real descontado, sessão nova de $50, cesta de 8 ativos
  (BTCUSD/XETUSD/SOLUSD/DOGUSD/DOTUSD/XRPUSD/XPTUSD/BTCXBN), e tendência/
  volume/ATR agora com fallback de tick real (não dependem mais só do
  candle 404).
- **Vale observar na próxima sessão**: se `trend`/`volume` de fato aparecem
  preenchidos na maioria dos ciclos agora (era o objetivo do fix da seção
  11); se o giro com alvo curto + spread real dá resultado líquido positivo
  de verdade; e as observações de reconhecimento dos 5 ativos novos
  (seção 10) pra decidir a cesta de amanhã.
- **Investigação separada recomendada, ainda não feita**: causa raiz do 404
  em `/mt5-candles` — o fallback de tick real contorna o sintoma pra este
  experimento, mas não resolve a causa, que pode estar limitando mais do
  que só este experimento (ex: cálculo de ATR do motor mecânico, se ele usar
  o mesmo endpoint).
