# Camada cognitiva do cérebro — mapa de capacidades e veredito

> **Criado em 2026-07-31**, em resposta ao pedido de "imputar habilidades no
> cérebro da IA" (memória persistente, ML, Price Action/Al Brooks, tape
> reading, macro, psicologia, matemática do risco).
>
> **Documento de decisão, não de implementação.** Nenhuma linha de código foi
> escrita a partir dele ainda. Ele existe para que a ordem de construção seja
> escolhida com o custo e a viabilidade de cada bloco na mesa.
>
> **Pré-requisito de leitura**: `AI_BRAIN_SPEC.md` seção 14 (encerramento da
> busca por edge) e `CLAUDE.md` pendência #5. Este documento **não repete** os
> argumentos de lá; ele os aplica.

---

## 1. O conflito central (ler antes de qualquer outra seção)

O pedido descreve um trader de elite: lê contexto, decora Al Brooks, lê fluxo,
correlaciona SP500/DXY/Treasuries, opera notícia, e é "implacável na análise de
mercado".

**Em 2026-07-30 (anteontem), a decisão (B) fechou exatamente o oposto disso como
escopo do cérebro**: o cérebro é de **execução e disciplina, não de alfa**. A
razão não foi falta de tentativa — foram **15 sub-investigações** (seções
11.5→11.15) medindo indicador técnico clássico sobre preço público em 2 cestas,
múltiplos timeframes, com Deflated Sharpe Ratio e holdout. Nenhuma passou o piso
de 95%. O melhor resultado de toda a investigação foi Donchian em cripto com
**DSR 52,0%** — abaixo do piso, e ainda assim o topo da lista.

Aplicando isso ao pedido, ele se divide em três grupos com destinos diferentes:

| Grupo | O que é | Destino |
|---|---|---|
| **I. Disciplina e risco** | Contexto como veto, pensamento probabilístico, gestão implacável, anti-revenge, adaptabilidade, cisne negro, memória, matemática do risco | ✅ **Construível agora**, sem depender de edge. É literalmente a função objetivo de (B). |
| **II. Bloqueado por dado** | Tape reading fora de cripto, agenda econômica histórica, intermercado, VIX como insumo do motor | ⚠️ **Parcial ou bloqueado** — limitação de fonte já testada e documentada, não de código. |
| **III. Previsão de direção** | "Decorar Brooks para decidir entrada", Wyckoff como sinal, Market Profile como gatilho, redes neurais preditivas de direção, "IA quântica" | ⛔ **Reabre o Trilho 2** (formalmente pausado) ou está **refutado a priori**. Exige decisão explícita sua para prosseguir. |

**O ponto que não pode ser suavizado**: o item 2 do seu pedido diz "o sucesso
virá da execução repetitiva de um modelo que possui uma **vantagem matemática
(edge)** ao longo do tempo". Isso está certo — e é exatamente por isso que a
conclusão de (B) dói: **hoje esse modelo não existe neste projeto, e 15
medições disseram que ele não está em indicador técnico sobre preço público.**
Adicionar Brooks, Wyckoff e Steidlmayer a essa lista é adicionar o 16º, 17º e
18º candidatos da mesma família — não uma família nova.

O que **muda** de verdade com este pedido não é o edge. É o **rigor da
abstenção**: um cérebro que sabe ler contexto para **não operar** vale dinheiro
sob (B), porque com edge ≈ 0 o EV por trade é ≈ `−custo` e **o cérebro mais
eficiente é o que opera menos**. Todo o Grupo I serve a isso.

---

## 2. Mapa: pedido → estado real do código → veredito

Estado verificado por leitura de código em 2026-07-31, não por memória.

### 2.1 Habilidades mentais (itens 1-5 do pedido)

| Pedido | Estado real | Veredito |
|---|---|---|
| **1. Contexto vs. sinais** | `MarketScoreEngine.ts` já compõe 4 fatores ortogonais (tendência 40% / momentum 25% / estrutura 20% / volume 15%), multi-TF, com **modulação por regime** (ADX + largura de Bollinger) e `provenance` que impede número fabricado. `CostViabilityGate.ts` já veta operação onde o custo devora o movimento. | ✅ Base existe. **Falta o principal**: (a) o score nunca teve o poder preditivo **registrado em arquivo** (ver §7), (b) não existe um estado unificado "NÃO OPERAR + motivo". |
| **2. Pensamento probabilístico** | Nada no motor calcula expectativa matemática, risco de ruína ou intervalo de confiança do próprio desempenho. `calculateKellyPosition()` existe em `RiskManager.ts:85` mas é **código morto** — nenhum arquivo o chama. | ⚠️ Declarado, não praticado. Bloco C. |
| **3. Gestão de risco implacável** | Real e o pedaço mais maduro: daily loss limit, drawdown, kill-switch síncrono, cooldown, `maxTradesPerDay`, sizing por ATR opcional, `CostViabilityGate` ligado no motor, e `LiveEmergencyClose.ts` fechando posição LIVE de verdade (com retry + confirmação via `getPositions()`). | ✅ Em grande parte **já existe**. Falta correlação real de portfólio e sizing sempre-ligado. |
| **4. Anti-revenge trading** | **Não existe nada.** Nenhum código detecta escalada de risco após perda. | ✅ Construível, alto valor, zero dependência de edge. Bloco D. |
| **5. Adaptabilidade cognitiva** | O regime já modula a interpretação dentro do `MarketScoreEngine`, mas o motor não tem estado explícito de regime nem histórico de transição — não há "abandonar viés" porque não há viés persistido. | ✅ Consequência direta do Bloco A + B. |

### 2.2 Base fundacional

| Pedido | Estado real | Veredito |
|---|---|---|
| **Macroeconomia prática** | `newsCrawler.ts` (RSS grátis, real) existe. Mas `MarketIntelligence.tsx:27` tem **manchetes hardcoded com sentimento** — dado fabricado, mesma classe da Fase 0 e do `Marketplace.tsx:30`. | ⚠️ Ver §9 (achado colateral). Macro **como direção** = Trilho 2. Macro **como filtro de "não operar"** = viável. |
| **Microestrutura de mercado** | `CryptoOrderBookAnalyzer.ts` é real: profundidade da Binance, desequilíbrio bid/ask, heurística de ordem grande retirada antes do preço chegar — e é **honesto** ao dizer que não prova spoofing (feed público não tem ID de ordem). | ⚠️ **Só cripto**, e por limitação da corretora, não do código: testado em 2026-07-18, Infinox/MetaAPI devolve HTTP 404 para book de EURUSD/GBPUSD/USDJPY/BTCUSD. Forex/índice/commodity **não têm e não vão ter** order book real nesta arquitetura. |
| **Matemática do risco (ruína, payoff, Kelly)** | Só Kelly, e morto (acima). | ✅ Bloco C — matemática pura, sem dado novo, sem edge. |

### 2.3 Conhecimento avançado

| Pedido | Estado real | Veredito |
|---|---|---|
| **Price Action / Al Brooks** | `smc/` tem `marketStructure.ts`, `orderBlocks.ts`, `fairValueGaps.ts`, `liquidityPools.ts` — estrutura de mercado real e testada. | ⚠️ Ver §6 — o que dá e o que não dá. |
| **Tape reading / fluxo** | Ver microestrutura acima. **Além disso**: a seção 13.7 já testou CVD (Cumulative Volume Delta via `aggTrades` da Binance) como proxy de fluxo — **0 de 16 combinações ativo×horizonte** passaram significância corrigida por Bonferroni + consistência entre subjanelas. | ⛔ Como **sinal de direção**: já testado, falhou. Como **medida de liquidez para gate de execução**: viável e não testado. |
| **Análise intermercados (SP500/DXY/Treasuries)** | `assetDatabase.ts` tem US2Y/US10Y/US30Y catalogados. DXY foi **removido do ChartView em 2026-07-16 por dar HTTP erro na corretora**. Não existe nenhum cálculo de correlação entre mercados. | ⛔/⚠️ Como direção = Trilho 2. Como **regime de risco** (ex.: DXY dispara → reduzir tamanho em forex) = defensável, mas depende de fonte de DXY que hoje não funciona. |
| **Desenvolvimento de edge** | `StrategyBuilderPro.tsx` + `BacktestEngine.ts` + `research/experiments/` já são exatamente isso, com custo real descontado desde o commit `2599939e8`. | ✅ Existe e é maduro. |
| **Gestão de risco dinâmica (ATR, VIX)** | ATR sim (`positionSizingMode: 'ATR'`). VIX existe como **widget de UI** (`VIXWidgetEnhanced.tsx`), nunca como insumo do motor. | ✅ Ligar VIX ao sizing é viável (Bloco E) — o dado já chega. |
| **Cisnes negros** | Não existe. `EmergencyOfflineMode.ts` trata falha de dado, não pânico de mercado. | ✅ Bloco E, alto valor, sem edge. |

### 2.4 Escolas e autores citados

O pedido lista Brooks, Wyckoff, Larry Williams, Linda Raschke, Paul Tudor Jones,
Mark Douglas, Elder, Steenbarger, Steidlmayer, Livermore, Neill, Van Tharp,
Taleb, Simons, López de Prado.

Divididos honestamente pelo que **é computável e ainda não foi refutado aqui**:

| Autor / escola | Contribuição aproveitável **sob (B)** | Contribuição que **reabre o Trilho 2** |
|---|---|---|
| **Mark Douglas** | Pensamento probabilístico como *contabilidade* (nenhum trade importa isolado; medir a série, não o evento) e desapego como *regra mecânica* (Bloco D). **Maior aproveitamento da lista.** | — |
| **Van Tharp** | Position sizing e expectativa matemática como o que decide o resultado, não a entrada. **Vira o Bloco C inteiro.** | — |
| **Taleb** | Risco de cauda, proteção contra cisne negro. **Vira o Bloco E.** | — |
| **Elder / Steenbarger** | Os "3 Ps" (Psicologia, Processo, Proteção) — o cérebro sob (B) é literalmente P2+P3. Diário de decisão (Bloco A) é ferramenta central do Steenbarger. | — |
| **Paul Tudor Jones** | "Gestão de risco rígida é a única chave de sobrevivência" — já é a tese de (B). | Timing macro discricionário. |
| **López de Prado** | Correção por múltiplos testes (**DSR — já usado neste projeto**), purged CV, alerta contra overfitting. Ele é a razão metodológica de as 15 buscas terem sido honestas. | — |
| **Al Brooks / Wyckoff / Steidlmayer** | Vocabulário de **contexto** (tendência vs. lateral, aceitação vs. rejeição, área de valor) → insumo de **veto**. | Qualquer uso como **gatilho de entrada direcional**. |
| **Larry Williams / Raschke** | Padrões de volatilidade como insumo de **sizing**. | Setups como sinal de entrada. |
| **Simons / Renaissance** | Já discutido na seção 13.6 da spec. Renaissance opera com dado, infraestrutura e custo de execução fora de alcance deste produto. | Usar como argumento de que "ML acha edge". |

---

## 3. Grupo I — os 5 blocos construíveis agora

Todos: zero dependência de edge, zero fonte de dado nova, compatíveis com (B).

### Bloco A — Memória persistente do cérebro (**fundação de todo o resto**) — ✅ implementado em 2026-07-31

**Achado real durante a implementação, mais preciso que o estado inicialmente
verificado**: não era "nada existe" — era **pior, de um jeito específico**.
`AITradingPersistenceService.ts` já tinha `saveDecision()`/`getSessionDecisions()`
mirando uma tabela `ai_decisions`, e `useAIPersistence.ts` já expunha
`saveDecision` pronto para uso — **mas a tabela nunca existiu em nenhuma
migration**, e `useApexLogic.ts` **nunca chamava** essa função. Ou seja: código
morto que, se fosse chamado, falharia silenciosamente (capturado pelo
`try/catch` do serviço, só logado no console). As tabelas `ai_sessions`/
`ai_trades`/`ai_portfolio_snapshots` (essas sim ativas) guardam **resultado**,
nunca decisão nem motivo — inclusive as decisões de não operar.

**Entregue**:
- [`supabase/migrations/009_ai_decisions.sql`](../supabase/migrations/009_ai_decisions.sql)
  — pronta para o Cleber rodar no SQL Editor (nunca aplicada por mim). Cria a
  tabela que o código já esperava, com um campo novo `veto_stage` (lista
  fechada, CHECK constraint) para tornar a etapa do funil que recusou o trade
  filtrável sem parsear texto livre.
- `AIDecision`/`DecisionVetoStage` em `AITradingPersistenceService.ts` e
  `useAIPersistence.ts` estendidos com `veto_stage`, mantendo compatibilidade
  total com a interface anterior.
- **10 pontos de veto em `useApexLogic.ts` agora persistem a decisão com
  motivo**, em vez de só `console.log`: Score contradiz a estratégia
  (`CONTEXT_SCORE_OPPOSITE`), Score LATERAL sem confiança extra
  (`CONTEXT_SCORE_LATERAL`), confiança combinada abaixo do mínimo
  (`CONTEXT_CONFIDENCE`), ATR indisponível para o gate de custo
  (`COST_GATE_NO_DATA`), gate de custo recusa (`COST_GATE`), kill-switch
  disparado (`KILL_SWITCH`), gate de risco recusa (`RISK_GATE`), cooldown ativo
  ou recém-ativado (`COOLDOWN`), limite diário de trades atingido
  (`MAX_TRADES_PER_DAY`) — e a decisão de **entrada aprovada**, linkada ao
  `trade_id` real via `onTradeOpen`.
- `npm run validate` verde (type-check do motor + 5 suítes determinísticas)
  depois da mudança.

**O que ainda falta** (não incluído nesta rodada, registrado para não perder):
1. Consultar o diário — nenhuma tela usa `getSessionDecisions` ainda.
2. Migração aplicada só depois que o Cleber rodar o SQL — até lá, as chamadas
   de `saveDecision` continuam falhando silenciosamente (mesmo comportamento
   de antes, só que agora **vão** funcionar assim que a tabela existir, sem
   precisar tocar no código de novo).
3. A métrica que valida o cérebro de abstenção ("os trades recusados teriam
   dado lucro?") ainda não foi calculada — precisa de dado acumulado depois da
   migration rodar, e de um script novo que cruze `ai_decisions` (vetos) com
   preço real subsequente.

Texto original desta seção, mantido como registro do estado ANTES da
implementação:

**O que é**: toda decisão do motor — inclusive (e principalmente) **as de não
operar** — persistida com: timestamp, ativo, regime detectado, score e fatores,
custo estimado, veredito do `CostViabilityGate`, veredito do `RiskManager`,
decisão final e **motivo textual**. Depois, o resultado é costurado de volta
quando o trade fecha.

**Por que é a fundação**:
1. Sem isso, "aprendizado" é impossível de forma honesta — não há registro do
   que foi decidido para comparar com o que aconteceu.
2. É o que torna "comportamento auditável" (função objetivo de (B)) verificável
   em vez de alegado.
3. Habilita medir se os próprios vetos ajudaram: *os trades que a IA recusou
   teriam dado lucro?* Essa é a única métrica que valida um cérebro de
   abstenção — e hoje é impossível calcular.
4. Bloco D (anti-revenge) e Bloco C (expectativa) leem daqui.

**Custo**: 1 migration Supabase (SQL pronto para você rodar, nunca aplicado por
mim) + 1 serviço + wiring em `useApexLogic.ts`.

### Bloco B — Contexto como veto explícito — ✅ implementado em 2026-07-31

**Entregue**: [`ContextGate.ts`](../src/app/services/risk/ContextGate.ts), 2
funções puras (`classifyRegime`, `evaluateContextGate`) + 14 asserções em
[`__validate__context__.ts`](../src/app/services/risk/__validate__context__.ts)
(`npm run validate` verde). Ligado em `useApexLogic.ts` logo após o gate de
custo, como veto **adicional** ao veto de Market Score já existente (decisão
de remover aquele é separada, não tomada aqui).

**Construído exatamente sobre o que sobreviveu à medição do §7, nunca sobre o
Market Score** — decisão explícita registrada no topo do arquivo:
- **ADX** cru (não a composição do Score) → `TRENDING` (ADX ≥ 20) vs.
  `RANGING` (ADX < 20, limiar clássico do indicador).
- **ATR relativo à própria distribuição recente** do ativo/timeframe (não a
  tabela fixa da seção 14.3) → expansão ≥ 2x a mediana das últimas 20 barras
  classifica `HIGH_VOLATILITY`.
- **BOS/CHoCH** (`smc/marketStructure.ts`) → viés de estrutura
  bullish/bearish/neutral. **Este é o subconjunto mecânico de Price
  Action/Al Brooks que você pediu** ("always-in direction"), entrando
  exatamente como você decidiu: só pergunta "a estrutura CONTRADIZ o lado
  proposto?", nunca "a estrutura MANDA entrar?" — o gate nunca gera um sinal
  de compra/venda a partir da estrutura, só recusa quando ela se opõe.
- Dado insuficiente → `ILLIQUID_NO_DATA`, recusa por padrão (nunca fabrica
  regime sem candle suficiente, mesma disciplina do `CostViabilityGate`).

**Honestidade de método, registrada no código**: isto é heurística mecânica,
**não sinal validado estatisticamente** (holdout + DSR) — mesma classe do
`EconomicCalendarGuard` ainda não implementado. A meta declarada é "reduzir
trade que contradiz a leitura de estrutura corrente", uma métrica mais barata
de medir depois (contar quantos vetos teriam evitado perda) — **ainda não
medida**, mesma pendência do Bloco A (precisa de dado acumulado).

**O que ainda falta**: a medição de que este veto de fato reduz trade ruim
(depende de acúmulo via Bloco A); e a decisão — não tomada aqui — de manter,
substituir ou remover o veto de Market Score que continua rodando em paralelo.

### Bloco C — Matemática do risco de verdade — ✅ implementado em 2026-07-31

**Entregue**: [`src/app/services/risk/ExpectancyEngine.ts`](../src/app/services/risk/ExpectancyEngine.ts),
3 funções puras + [`__validate__expectancy__.ts`](../src/app/services/risk/__validate__expectancy__.ts)
(29 asserções, registrado em `scripts/validate.mjs`, `npm run validate` verde).

1. **`computeExpectancy(trades)`** — expectativa matemática em R-multiples
   (Van Tharp), medida sobre trades reais (nunca assumida). Devolve winRate,
   avgWinR/avgLossR, payoffRatio, `expectancyR`, e um **intervalo de confiança
   Wilson 95%** do winRate — a peça que faltava para não confundir "parece
   positivo" com "é confiável". Marca `conclusive: false` abaixo de 30
   trades, sem esconder o número, só sem deixá-lo soar definitivo.
2. **`estimateRiskOfRuin(params)`** — Monte Carlo determinístico (PRNG
   seedado, mulberry32) sobre sizing **fixed-fractional** real (% da banca
   corrente, não valor fixo em $ — a fórmula clássica de "gambler's ruin"
   assume aposta fixa e não modela o sizing real deste produto). "Ruína" é
   definida como drawdown-desde-o-pico acima de um limiar configurável, não
   "saldo=0" literal (sizing fracionário nunca chega lá).
3. **`computeHonestKelly(expectancy, opts)`** — recebe um `ExpectancyResult`
   inteiro (não `winRate`/`payoff` soltos), para impedir estruturalmente o
   erro de passar número inventado. Duas guardas: amostra pequena → 0
   automático; e — mais importante — **usa o limite inferior do IC 95% do
   winRate**, não o ponto estimado, para decidir se recomenda posição. Um
   edge que parece positivo no ponto mas cujo IC inferior já é negativo
   recomenda 0%, não a posição otimista.

**Resultado antecipado, confirmado pelos testes**: com edge negativo ou
amostra pequena, `kellyFractionApplied` sai 0 — a matemática dizendo "não
aposte" é o resultado correto sob a decisão (B), não um bug. É a versão
quantitativa de "o cérebro mais eficiente é o que opera menos".

**`RiskManager.ts:85` (`calculateKellyPosition`)**: mantido, não removido
(pode ter consumidor futuro fora do caminho crítico), mas documentado como
código morto hoje e como a versão "winRate/payoff crus" que o Bloco C
substitui — comentário no código aponta para `computeHonestKelly` como fonte
de verdade para código novo.

**O que ainda falta**: nada destas 3 funções está **consumida** em
`useApexLogic.ts` ainda — mesma honestidade do Bloco A ("exposto, não
ligado"). Ligar exige decidir COMO alimentar `computeExpectancy` com a série
real (via `ai_trades`/`ai_decisions` do Bloco A, que por sua vez depende da
migration `009_ai_decisions.sql` estar aplicada) e SE o resultado deve
influenciar sizing automaticamente ou só ser exibido ao usuário — decisão de
produto que não estava no escopo desta rodada.

### Bloco D — Detector de revenge trading — ✅ implementado em 2026-07-31

**Entregue**: [`RevengeTradingDetector.ts`](../src/app/services/risk/RevengeTradingDetector.ts),
função pura `detectRevengePattern(history, proposed)` + 11 asserções em
[`__validate__revenge__.ts`](../src/app/services/risk/__validate__revenge__.ts)
(`npm run validate` verde). Ligado em `useApexLogic.ts`, logo após o gate de
cooldown existente e antes do limite diário de trades.

A IA não tem emoção; ela não faz revenge trading. **O usuário faz**, através da
própria configuração. Três sinais, todos medidos contra a **baseline mecânica
do próprio usuário** (mediana do seu histórico — nunca um limiar fixo em
minutos/tamanho, porque o mesmo número pode ser normal para um usuário e
escalada para outro):
1. `SIZE_ESCALATION` — posição proposta ≥ 1,75x a mediana recente, condicional
   ao último trade ter sido perda.
2. `RUSHED_ENTRY` — intervalo desde o fechamento (perdedor) ≤ 30% do intervalo
   típico do próprio usuário.
3. `LOSS_STREAK_WITH_FREQUENCY_SPIKE` — ≥ 3 perdas seguidas **e** cadência
   recente ≥ 1,5x a baseline (perdas isoladas já têm o cooldown pré-existente
   do `RiskManager`; frequência isolada pode só ser um dia mais ativo — a
   combinação é o que distingue o padrão).

**Severidade e ação, gap declarado**: 1 sinal → `ALERT` (notifica, não
bloqueia); 2 sinais → `REQUIRE_CONFIRMATION` (notifica, **não bloqueia ainda**
— exigir confirmação explícita precisa de um diálogo de UI que não existe
neste loop hoje, gap registrado no código, não escondido atrás de bloqueio
silencioso não pedido); 3 sinais → `FORCE_COOLDOWN` (única ação mecânica
plenamente pronta — reusa o cooldown já existente do `RiskManager`, bloqueia
de fato). Toda ocorrência é persistida via Bloco A (`veto_stage:
'REVENGE_PATTERN'`) com os sinais e o motivo, mesmo quando não bloqueia.

**O que ainda falta**: a UI de confirmação explícita para o grau
`REQUIRE_CONFIRMATION`; e — como todo o resto — abaixo de 5 trades fechados no
histórico do usuário o detector explicitamente não se pronuncia (não fabrica
"normal" sem amostra).

### Bloco E — Proteção de cauda (cisne negro) — ✅ implementado em 2026-07-31

**Entregue**: [`TailRiskGuard.ts`](../src/app/services/risk/TailRiskGuard.ts),
função pura `evaluateTailRisk(params)` + 18 asserções em
[`__validate__tailrisk__.ts`](../src/app/services/risk/__validate__tailrisk__.ts)
(`npm run validate` verde). Ligado em `useApexLogic.ts`, reaproveitando o
`atrExpansionRatio` que o Bloco B já mediu (mesma métrica, sem segunda fonte
de verdade divergente).

**4 níveis, monotônicos** (mais expansão de ATR nunca resulta em ação menos
severa — garantido por teste): `NONE` (< 1,5x) → `REDUCE_SIZE` (1,5x-2,5x,
multiplicador linear até 0,25x — **gap declarado**: sugerido mas ainda não
aplicado ao sizing real, que é calculado mais adiante por fórmula própria;
mudar isso é uma alteração maior no cálculo de posição, fora do escopo desta
rodada, registrada no diário de decisão do Bloco A pra não ficar escondida) →
`BLOCK_NEW_ENTRIES` (≥ 2,5x — reforça o veto do Bloco B, mais severo que o
limiar `HIGH_VOLATILITY` dele) → `EMERGENCY_CLOSE` (≥ 4,0x — nível "cisne
negro" declarado).

No extremo, reaproveita `forceCloseAllLivePositions()` (`LiveEmergencyClose.ts`,
já existia, já testado pelo kill-switch) com o mesmo padrão de segurança: retry
+ confirmação real via `getPositions()`, nunca assume sucesso pela resposta da
API, só em modo LIVE e só com posição de fato aberta.

**Correção do mesmo dia (2026-07-31) — VIX está ligado, o gap original estava
errado.** A primeira versão deste bloco dizia que ligar VIX exigiria uma
camada de cache/throttle inexistente. Isso era **falso** — não verificado com
cuidado antes de escrever. `useApexLogic.ts` já tem `fetchVIXCached()` desde
antes desta sessão (`VIX_CACHE_DURATION` = 60s, `cachedVIXRef`). Corrigido:
`evaluateTailRisk` agora recebe `vix` (opcional) desse mesmo cache — **zero
chamada de rede nova**, zero risco adicional na conta MetaAPI compartilhada.

**Combina duas leituras independentes, sempre a mais severa das duas**
(campo `triggeredBy: 'ATR'|'VIX'|'BOTH'|'NONE'`, auditável): ATR do próprio
ativo (choque local) e VIX de mercado (choque sistêmico do S&P500, pode
aparecer no VIX antes de aparecer no ATR de um ativo específico). Limiares de
VIX seguem a classificação de mercado do CBOE (<20 normal, 20-30 elevado,
30-40 alto, >40 pânico/crise — ex: picos de 2008/2020/2022) — convenção de
mercado, não edge medido aqui; mesma disciplina de honestidade dos limiares
de ATR (heurística declarada, não validada por holdout). 33 asserções agora
(eram 18), cobrindo ATR sozinho, VIX sozinho, e as 4 combinações de
qual-vence-qual, incluindo o caso que mais importa: **ATR calmo não dilui
VIX em pânico** — um ativo aparentando calma não impede a reação a um choque
sistêmico já visível no mercado como um todo.

**Achado colateral #2 — "modo agressivo" automático via VIX, corrigido no
mesmo dia após decisão do Cleber**: verificando o cache de VIX, achei que ele
já era lido em produção (`useApexLogic.ts` ~linha 1080) pra fazer o oposto do
Bloco E — `VIX > 20` ativava "MODO AGRESSIVO", **reduzindo** o cooldown entre
avaliações de 5s pra 2s (operar mais rápido com o mercado mais nervoso).
Contradizia o item 3 do pedido original ("frieza... não se deixar levar pela
ganância em dias de euforia") e o Bloco E inteiro.

**Bug adicional encontrado no mesmo mecanismo**: o gatilho nem funcionava de
verdade — `globalVolatility` era um `let` local reatribuído dentro do
`.then()` de uma Promise (`fetchVIXCached()`), mas lido de forma SÍNCRONA
duas linhas depois, antes da Promise resolver. Era efetivamente morto — nunca
ativava o modo agressivo de fato, independente do VIX.

**Decisão do Cleber (2026-07-31)**: não remover o conceito de cadência mais
rápida — transformá-lo em **opt-in explícito do usuário**, nunca mais
automático por VIX. Implementado: `AIConfig.aggressiveModeEnabled` (novo
campo, default `false`), controla só a cadência de avaliação sob risco
normal (5s → 2s quando ligado) — e **nunca** compete com o Bloco E, que
continua bloqueando/fechando de forma independente quando ATR ou VIX real
indicam choque de volatilidade, mesmo com o opt-in ligado (a checagem do
TailRiskGuard roda antes de qualquer decisão de entrada, o opt-in só afeta a
frequência do ciclo de avaliação). **Gap de UI**: campo já existe no tipo e
no motor; falta o toggle em `AITrader.tsx` (mesmo padrão do
`cooldownEnabled` existente, linha ~1408) — não construído nesta rodada.

Sem previsão. É reação a estado observado — mesma disciplina de todo o resto
dos Blocos A-D.

---

## 4. Grupo II — bloqueado ou parcial por dado

| Item | Bloqueio | Situação |
|---|---|---|
| Tape reading em forex/índice/commodity | Corretora não expõe profundidade (404, testado 2026-07-18) | **Não contornável** nesta arquitetura. Só cripto tem book real. |
| Agenda econômica com histórico | Não existe fonte grátis com arquivo de 60-90 dias (seção 13.8) | Só feed **ao vivo** → serve como filtro "evitar operar", nunca backtestável. Já é o bloco 3 do plano anterior. |
| DXY | Símbolo dá erro na corretora (removido em 2026-07-16) | Precisa de fonte alternativa antes de qualquer análise intermercado. |
| CVD / fluxo agressor como sinal | Já testado, 0/16 (seção 13.7) | Refutado como sinal. Não testado como métrica de liquidez para execução. |

---

## 5. Grupo III — o que reabre o Trilho 2

Listado aqui para que a escolha seja consciente, não por acidente:

1. Brooks/Wyckoff/Market Profile como **gatilho de entrada direcional**.
2. Rede neural prevendo **direção** — a spec 14.5 item 3 já registra que ML
   sobre OHLCV público para direção "apenas overfitaria com mais eficiência".
3. Intermercado ou macro como **sinal direcional**.
4. Qualquer proposta "testar stop X com alvo Y" — **refutada a priori** pelo
   teorema da parada opcional (14.2), salvo evidência de previsão de
   **magnitude condicional**.
5. **"IA quântica"**: não existe neste produto e não vai existir. É termo de
   marketing sem contrapartida técnica. Registrado aqui para nunca aparecer em
   comunicação de produto — cairia na mesma classe do `Marketplace.tsx:30`.

---

## 6. Price Action / Al Brooks — o que dá e o que não dá

**O que não dá, e por quê:**

1. **Não vou transcrever o livro para o repositório.** "Operando Price Action:
   Tendências" é obra protegida por direito autoral. Copiá-la para o código
   seria infração, e você não precisa dela em texto.
2. **"Decorar" não é uma capacidade técnica.** Um LLM não persiste memória de
   leitura entre sessões; o que persiste no produto é **código determinístico**.
   A metodologia do Brooks só vira capacidade do cérebro se virar detector
   computável — o resto é prosa que não executa.

**O que dá:**

O subconjunto **mecânico e publicamente descrito** da metodologia é
implementável como detector sobre OHLCV, e boa parte **já existe** em `smc/`
(estrutura de mercado, order blocks, FVG, pools de liquidez). Os conceitos de
Brooks com definição operacional clara:

- *always-in direction* (viés estrutural corrente);
- força de tendência via contagem de barras/sobreposição (trend bar vs. doji);
- pullback de duas pernas;
- *measured move*;
- qualidade da barra de sinal (tamanho de corpo, sombra, fechamento).

**E aqui está a condição inegociável**: se esses detectores forem usados como
**gatilho de entrada**, eles entram no mesmo funil de validação da seção 8 —
holdout, custo real descontado, DSR — e o histórico deste projeto diz que o
resultado esperado é o 16º fracasso da mesma família. Se forem usados como
**contexto/veto** (Bloco B), não precisam provar edge: precisam apenas provar
que **reduzem trade ruim**, que é uma métrica bem mais fácil e honesta.

**Minha recomendação**: entram como contexto, não como gatilho.

---

## 7. O score foi medido (2026-07-31) — não prevê direção

`MarketScoreValidator.ts` existia, era walk-forward, sem look-ahead, e **nunca
tinha tido um resultado salvo em arquivo** — apesar de o `CRITERIA.md` o
declarar obrigatório e de o score já vetar trades em produção
(`useApexLogic.ts:1397`).

**Rodado em 2026-07-31**: 7 criptos × 3 timeframes (15m/1h/4h), n = 3.352 barras
por ativo, 1.340 leituras de convicção. Ver
[`experiments/2026-07-31-marketscore-baseline/`](experiments/2026-07-31-marketscore-baseline/).

**Resultado — falha em 3 dos 4 critérios pré-registrados:**

- Hit rate direcional de convicção **pooled 46,12%** (abaixo de 50%), compra
  45,1% e venda 47,2%;
- correlação de Pearson score↔retorno futuro entre **−0,098 e +0,051** —
  assinatura de ausência de sinal;
- netEdge médio **−0,666%** após custo real de 0,26%; só 5 de 20 combos
  positivos.

**Consequência para o Bloco B**: o veto de contexto **não pode ser construído
sobre o score como preditor**. Base honesta = ATR/ADX/spread crus +
`CostViabilityGate` (que já existe e não depende de previsão).

**Ressalva de escopo, importante**: isto refuta o score como **preditor
direcional**, e **não mede** seu valor como **veto** (que é o uso real em
produção). Medir o veto exige saber o que foi recusado — ou seja, o Bloco A.
Não remover o gate atual com base neste experimento.

**Anomalia registrada e testada em holdout (mesmo dia)**: BTCUSDT 4h tinha
passado todos os 4 critérios no baseline (68,2%, n=88, p=0,0004, netEdge
+0,390%). Rodado o holdout — histórico completo desde 2017, fronteira exata na
janela que o baseline usou, sem recalibrar nada — ver
[`experiments/2026-07-31-btc-holdout/`](experiments/2026-07-31-btc-holdout/).
**Não sobreviveu**: no período fora de amostra, hit rate cai a 51,6% (4h) e
53,7% (1h), falha o critério de consistência (lado de venda abaixo de 50% nos
dois), estabilidade ano a ano é ruído puro (oscila 39,5%-62,1% sem padrão) e
BTC não se destaca dos 6 controles no mesmo período. Confirma o precedente da
seção 11.10→11.11 do `AI_BRAIN_SPEC.md`: a anomalia era vazamento de
calibração (o score foi ajustado historicamente contra janelas de BTC
recentes), não edge. **Fecha a única pendência aberta pelo baseline — o Trilho
2 segue formalmente pausado, agora com uma medição a mais sustentando isso.**

---

## 8. Ordem proposta

| # | Bloco | Depende de | Por quê nesta posição |
|---|---|---|---|
| 0 | Medir o Market Score e salvar resultado | nada | Barato; define o desenho do Bloco B; fecha violação de método |
| 1 | **A — Memória persistente** | 0 | Fundação: sem registro de decisão, nada abaixo é mensurável |
| 2 | **C — Matemática do risco** | A (para medir expectativa real) | Função pura, entra na suíte de validação, torna "operar menos" quantitativo |
| 3 | **D — Anti-revenge** | A | Maior valor de produto; nenhuma promessa de acurácia |
| 4 | **B — Contexto como veto** | 0, A | Formaliza o item 1 do pedido |
| 5 | **E — Proteção de cauda** | B | Reação a estado observado |

Isso **substitui** a ordem anterior do `NEXT_SESSION.md`? Não necessariamente —
o "Ranking mecânico de ativos" (`AssetRankingService`) que já estava na fila é
compatível e pode entrar como parte do Bloco B (ranking por facilidade de
execução é leitura de contexto, não previsão). A "Agenda econômica"
(`EconomicCalendarGuard`) é o Grupo II e depende de escolher a fonte.

## 9. Achados colaterais desta auditoria (2026-07-31)

1. **`RiskManager.ts:85` — `calculateKellyPosition()` é código morto.** Nenhum
   arquivo o chama. O produto fala em Kelly; o motor não usa.
2. **`MarketIntelligence.tsx:27` — manchetes de notícia hardcoded com
   sentimento atribuído** ("Treasuries dos EUA operam estáveis antes de dados de
   emprego", fonte "Bloomberg", sentiment NEUTRAL). Mesma classe do
   `Marketplace.tsx:30` e da Fase 0: dado fabricado apresentado como capacidade
   real. `newsCrawler.ts` já busca RSS de verdade — a tela simplesmente não o usa.
3. **Nenhuma biblioteca de ML no projeto** (sem tensorflow/onnx/brain.js/
   ml-matrix). Qualquer ML começa do zero — o que, sob (B), significa apenas
   previsão de volatilidade (família GARCH/HAR-RV), nunca de direção.
