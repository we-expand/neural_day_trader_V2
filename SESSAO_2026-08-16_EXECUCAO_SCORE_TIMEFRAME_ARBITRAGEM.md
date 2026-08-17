# Sessão 2026-08-16 (4ª parte) — Execução dos itens 1, 2 e 4 do plano de redesenho

> Continuação de `SESSAO_2026-08-16_REDESENHO_CEREBRO_E_SETUP.md` (plano de 5
> frentes) — esta parte executou e MEDIU 3 das 5 frentes. Pesquisa pública
> sobre Renaissance Technologies/Two Sigma/market makers feita nesta parte
> (não documentada em arquivo separado — resumo abaixo) motivou reabrir o
> item 4 antes do previsto na ordem original do plano.

## Pesquisa: como Renaissance/Two Sigma/market makers operam (domínio público)

Os algoritmos reais da Medallion (Renaissance) e Two Sigma são segredo
comercial — nunca vazaram. O que existe publicamente (livro *"The Man Who
Solved the Market"*, relatos de ex-funcionários, papers acadêmicos) permite
entender **princípios estruturais**, não copiar uma fórmula:

- **Renaissance**: não usa "um indicador". Usa milhares de sinais fracos
  (individualmente ~50,75% de acerto, já divulgado), aplicados de forma
  diversificada (milissegundos a semanas, muitos instrumentos), com sizing e
  risco geridos estatisticamente, 100% automatizado (150-300 mil
  trades/dia). A vantagem é ter MUITOS sinais genuinamente independentes, não
  achar "o sinal certo".
- **Two Sigma**: mesma filosofia, diferencial é ingestão de dado de 10.000+
  fontes/dia — o edge estrutural deles é breadth de DADO, não o modelo.
- **Market makers (Avellaneda-Stoikov)**: skew de inventário (cotar bid/ask
  assimétrico pra empurrar posição de volta a zero) + spread que alarga em
  volatilidade. Exige ser criador de mercado de verdade (book L2, cotar os 2
  lados) — não é o que fazemos (somos tomadores via CFD/MT5).

**Conclusão de aplicabilidade** (tabela completa no transcript desta sessão,
resumo aqui): market making e HFT/colocation **não são aplicáveis** ao nosso
desenho de produto (conta MetaAPI compartilhada, sem L2, sem colocation, sem
infraestrutura de dado alternativo). O que É genuinamente adaptável e ainda
não testado é **arbitragem estatística/cointegração entre instrumentos**
(dado estruturalmente diferente de TA clássico) — o mesmo item 4 (Trilho 2)
que já estava no plano, só que a pesquisa reforçou a prioridade dele.
Disciplina de risco/Kelly (`ExpectancyEngine.ts`, `TailRiskGuard.ts`) já é o
que mais se aproxima do "melhor deles" que já está adotado.

## Item 1 — motor de score contínuo (implementado, medido, resultado NEGATIVO)

**Implementação**: `scoreBlock()` + `evaluateStrategyScoreAt()` em
[StrategyEvaluator.ts:132](src/app/services/strategy/StrategyEvaluator.ts:132)
— score 0-100 por bloco de entrada (ABOVE/BELOW/BETWEEN/RISING/FALLING
continuam booleanos 100/0 por natureza; CROSS_ABOVE/CROSS_BELOW ganham
gradação por recência — cruzamento no candle atual pontua 100, decai 10pt por
candle até 0 em 10 candles). Agregação por média simples (pesos iguais —
decisão do Cleber). `filterBlocks` continuam gate binário rígido, sem
gradação. **`evaluateStrategyAt` (gate binário original) não foi alterado**
— continua o único caminho em produção. 16 casos determinísticos em
`src/app/services/strategy/__validate__score__.ts`, registrado em
`npm run validate` (gate 100% verde).

**Medição** (`research/experiments/2026-08-16-score-vs-gate/`): comparei
score contínuo (pisos 40/50/60/70) vs. gate binário atual, mesmo dado real em
cache (`2026-08-05-taxa-base/data/`, 15m/1h, 80 combinações preset×ativo×TF),
mesmo motor de saída, mesmo `CostModel.ts`.

| Piso | Frequência média (× gate) | Melhor que gate | Pior que gate | Delta médio de resultado líquido |
|---|---:|---:|---:|---:|
| 40 | 7,54x | 27/80 | 53/80 | -19,14 p.p. |
| 50 | 6,84x | 26/80 | 53/80 | -18,67 p.p. |
| 60 | 2,06x | 29/80 | 50/80 | -4,21 p.p. |
| 70 | 1,90x | 32/80 | 47/80 | -3,24 p.p. |

**Resultado: NEGATIVO em todo piso testado.** Hipótese do porquê (não medida
separadamente): com pesos iguais, um bloco fraco "carrega" um bloco forte até
o piso — destrava mais entradas ruins do que boas, porque os blocos de UMA
estratégia são correlacionados por desenho (mesmo ativo, mesma janela de
tempo), então "média de score" não ganha diversificação nenhuma. É
exatamente o oposto do princípio de Medallion (sinais genuinamente
independentes) — achado que conecta diretamente com a pesquisa acima.

**Decisão**: NÃO ligar em `runTradingCycle.ts`/runner Deno nesta forma.
Infraestrutura fica pronta pra reuso (ex. como desempate multi-setup, não
como piso de entrada). Detalhe completo, alternativas não testadas:
`research/experiments/2026-08-16-score-vs-gate/results/README.md`.

## Item 2 — migração do timeframe operacional padrão (implementado, sem controvérsia)

Investigação (agente Explore) mostrou que a maior parte do sistema já
default para `'15m'`/`'1h'` — `aiConfig.timeframe` global
([useApexLogic.ts:276](src/app/hooks/useApexLogic.ts:276)) já era `'15m'`, o
runner Deno já cai pra `'5m'` se `tf` vier vazio. Só 2 fallbacks defensivos
regrediam pra `'1m'`:
[useApexLogic.ts:1477](src/app/hooks/useApexLogic.ts:1477) e
[:1656](src/app/hooks/useApexLogic.ts:1656) (`configRef.current.timeframe ||
'1m'`, usado só quando `config.timeframe` vem `undefined`) — corrigidos pra
`'15m'`. `'1m'` continua no tipo `Timeframe` e nos seletores de UI
([AITrader.tsx:1023](src/app/components/AITrader.tsx:1023),
[AITradingEngine.tsx:119](src/app/components/AITradingEngine.tsx:119)) como
modo de teste manual, agora com tooltip avisando do custo. Nenhuma migration
de banco necessária (`ai_sessions.timeframe` é `text` livre). `npm run
validate` verde, dev server sobe sem erro de build.

## Item 4 — reabertura do Trilho 2: arbitragem estatística (medido, resultado NEGATIVO mas não fechado)

**Método** (`research/experiments/2026-08-16-statistical-arbitrage/`):
cointegração/pairs trading — hedge ratio via OLS trailing (janela 100
candles, sem look-ahead), z-score do spread na mesma janela, entrada em
|z|≥2,0, saída em reversão (|z|≤0,5), rompimento (|z|≥3,5) ou timeout (50
candles). Parâmetros fixos, não otimizados (evitar p-hacking). Custo real nas
2 pernas. 6 pares (XAUUSD/XAGUSD, US30/SPX500, US30/NAS100, SPX500/NAS100,
GER40/US30, GER40/SPX500) × 2 timeframes (15m/1h) = 12 combinações, dado real
em cache.

**Resultado: sem edge robusto.** 9 de 12 combinações perdem dinheiro líquido
de custo. As 3 positivas (`US30/NAS100` 1h: +2,29%, `GER40/US30` 15m: +3,55%,
`GER40/SPX500` 1h: +0,34%) têm amostra pequena (35-84 trades) e edge por
trade quase zero (0,01%-0,03%) — consistente com ruído, sem correção por
múltiplos testes aplicada. O par "clássico" de cointegração em commodities
(`XAUUSD/XAGUSD`) foi o PIOR resultado (-25,47% líquido, win rate 28,9%) —
não confirma intuição de manual, reforça que é medição real.

**Diferença importante em relação ao item 1**: aqui não dá pra concluir "a
ideia está errada" — só que "esta primeira calibração não validou". Faltou
testar sensibilidade de parâmetros com correção estatística, pares de
instrumento mais próximos (mesmo mercado, não índices/commodities
cross-região — MetaAPI não oferece isso hoje), e considerar que o custo de
CFD de varejo pode não deixar margem pra esse tipo de estratégia
independente da qualidade do sinal (limite estrutural, não de calibração).

**Decisão**: não implementar em produção nesta configuração. Não fecha a
porta do Trilho 2 como o Trilho 1 (TA clássico) foi fechado em julho — falta
rigor adicional antes de declarar "sem edge" com a mesma confiança. Detalhe
completo: `research/experiments/2026-08-16-statistical-arbitrage/results/README.md`.

## Estado ao fim desta parte da sessão

3 das 5 frentes do plano medidas (itens 1, 2, 4) — **nenhuma produziu
resultado positivo promovível a produção**. Item 2 (migração de timeframe) é
puramente mecânico, sem controvérsia. Itens 1 e 4 tiveram medição honesta com
resultado negativo — item 1 parece estruturalmente errado (correlação entre
blocos do mesmo setup), item 4 é inconclusivo (pode ser calibração, não a
ideia).

Restam bloqueados: item 3 (ligar Bloco C — falta amostra real, `n=3` trades
fechados hoje) e item 5 (redesenho do painel — depende do item 1 madurecer,
que não vingou).

**Decisão real necessária pra próxima sessão não é mais código — é de
direção**: com 3 de 5 frentes medidas sem resultado positivo, vale decidir
entre (a) aprofundar arbitragem estatística com mais rigor (a mais
promissora, por não ter fechado a porta), (b) tentar as alternativas do item
1 ainda não testadas (pesos não-uniformes, score só como desempate
multi-setup mantendo o gate binário como piso de qualidade), ou (c)
reconsiderar se a meta de ~10 trades/dia é compatível com a disciplina
anti-fabricação de edge que o projeto sempre seguiu (ver `CLAUDE.md`,
convenções do projeto).
