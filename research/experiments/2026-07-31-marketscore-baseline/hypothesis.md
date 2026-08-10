# Hipótese — poder discriminativo do Market Score (baseline nunca registrado)

**Data**: 2026-07-31 · **Escrito ANTES de rodar** (convenção `research/experiments/README.md`)

## Por que este experimento existe

O `MarketScoreEngine.ts` é o componente de **leitura de contexto** do produto e
já está **ligado no motor em produção**: `useApexLogic.ts:1397` descarta setups
quando o score está LATERAL e a confiança da estratégia é baixa. Ou seja, ele
**já veta trades reais hoje**.

O `MarketScoreValidator.ts` foi construído justamente para medir se esse score
prevê movimento (walk-forward, sem look-ahead). O `CRITERIA.md` o define como
obrigatório e o `research/experiments/README.md` diz literalmente que
`results.json` é "saída bruta do MarketScoreValidator.ts".

**Nenhum resultado dele foi jamais salvo em arquivo.** Os 15 experimentos
existentes em `research/experiments/` são todos sobre arquétipos de estratégia
(seções 11.x); nenhum mediu o score. O único uso registrado do validador foi
ad-hoc, para reverter uma tentativa de expandir a faixa do score via tanh gain
(citado no `CRITERIA.md`) — nunca para registrar o baseline.

Isto viola a regra do projeto de que todo experimento salva output em arquivo, e
deixa sem medição a base sobre a qual o pedido de 2026-07-31 ("leitura de
cenário implacável", `AI_COGNITIVE_SPEC.md`) pretende construir.

## O que se testa

O score de alta convicção prevê a direção do movimento seguinte, sobre candle
real, sem look-ahead?

- **Métrica primária**: hit rate direcional das leituras de convicção
  (score ≥ 68 & confiança ≥ 55 → espera alta; score ≤ 32 & confiança ≥ 55 →
  espera baixa), medido `forwardBars = 8` barras à frente.
- **Métrica secundária (econômica)**: o retorno médio absoluto das leituras de
  convicção supera o custo round-trip estimado (`research/CostModel.ts`)?

## Amostra

- **Ativos**: BTCUSDT, ETHUSDT, BNBUSDT, SOLUSDT, XRPUSDT, ADAUSDT, DOGEUSDT
  (Binance pública, grátis). **Deliberadamente não usa MetaAPI** — a conta de
  plataforma é compartilhada e sujeita a rate-limit (CLAUDE.md).
- **Timeframes**: 15m, 1h, 4h → **21 combinações**.
- `maxBars = 1500`, `minLookback = 240` (SMA200 + folga).

**Limitação declarada de antemão**: esta cesta tem correlação típica 0,7-0,9
entre pares (seção 14.4 do `AI_BRAIN_SPEC.md`) — são **~1,5 apostas
independentes, não 7**. O pooling aumenta o `n` da mesma aposta, nunca a
diversificação. Nenhuma conclusão aqui pode tratar 7 ativos como 7 evidências.

**Limitação de custo**: pela tabela 14.3, 15m gasta ~25% do movimento típico em
custo (inviável) e 1h gasta ~10% (fronteira). Só 4h fica confortavelmente acima
do piso. Um resultado positivo em 15m é economicamente irrelevante mesmo se
estatisticamente significativo — e isso está dito **antes** de ver o número.

## Critério de sucesso (pré-registrado, não negociável depois)

1. **Significância**: hit rate de convicção > 50% por teste binomial unilateral,
   com **correção de Bonferroni** para 21 combinações (α = 0,05/21 ≈ 0,00238).
2. **Consistência**: o efeito aparece em ambas as direções (compra e venda), não
   só numa — sinal unidirecional em cesta cripto de 2023-2026 é mais provável
   ser viés de alta da janela do que edge.
3. **Relevância econômica**: retorno médio das leituras de convicção >
   custo round-trip do ativo.
4. **Amostra mínima**: ≥ 30 leituras de convicção por combinação para reportar
   como conclusivo (abaixo disso → "inconclusivo", explicitamente).

**Nota sobre o veredito embutido no validador**: `MarketScoreValidator.ts`
classifica ≥65% como "edge real" e ≥55% como "edge fraco", **sem nenhuma
correção estatística nem teste de significância**. Esses limiares não são
usados aqui. O veredito deste experimento sai dos 4 critérios acima.

## Expectativa honesta antes de rodar

**Espero que falhe o critério 1.** As seções 11.5→11.15 mediram 15 variações de
sinal técnico sobre preço público — nenhuma passou. O score é uma composição de
fatores da mesma família (EMA/SMA/ADX/RSI/Estocástico/MACD/OBV/Fibonacci).
Não há razão teórica para a composição achar o que os componentes não acharam.

**Isto não torna o experimento inútil — o contrário.** O score já veta trades em
produção. As duas saídas possíveis são ambas acionáveis:

- **Se não prevê direção** (esperado): o score não pode ser tratado como sinal, e
  o Bloco B do `AI_COGNITIVE_SPEC.md` precisa ser construído sobre ATR/ADX/spread
  crus, não sobre ele. Além disso, o uso atual em `useApexLogic.ts:1397` fica sob
  suspeita e precisa ser reavaliado como veto.
- **Se prevê**: é o primeiro sinal com edge medido do projeto e muda a
  conversa — inclusive a decisão (B).
