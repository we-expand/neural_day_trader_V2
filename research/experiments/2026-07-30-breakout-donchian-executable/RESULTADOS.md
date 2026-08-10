# Teste executável: rompimento Donchian(20)/saída Donchian(10) — BTCUSDT em dólar

> Passo seguinte ao diagnóstico barato de MFE/MAE
> (`../2026-07-30-breakout-mfe-mae-diagnostic/`), pedido pelo Cleber em
> 2026-07-30: lá o payoff ratio real (sem custo) deu 1,79x-1,88x com win rate
> de 34-35% — EV bruto no ponto de equilíbrio. Este teste aplica **custo real**
> (`CostModel.ts`) e **contrato fixo 0,01 BTC** (resultado em dólar, pedido
> explícito) pra ver se sobra algo depois do custo.

## Desenho

- Entrada: fechamento rompe Donchian(20) — máxima = LONG, mínima = SHORT.
- Saída: Donchian(10) oposto — mesma regra do preset "Rompimento de Canal"
  em produção (`presetStrategies.ts`). Sem TP/SL fixo, sem trailing extra:
  a saída Donchian(10) é o mecanismo inteiro de gestão de saída.
- BTCUSDT, 15m e 1h, 24 meses, holdout com embargo (3 janelas 70/30).
- Contrato fixo 0,01 BTC. Custo round-trip aplicado: **0,26%**.
- Zero grid search, zero ajuste de parâmetro — mesmos períodos (20/10) do
  diagnóstico e do preset em produção.

Script: `backtest-breakout-donchian-btc.ts`. Output bruto: `output.json`.

## Resultado (holdout, líquido de custo, em dólar)

| Timeframe | Lado | n | Win rate | Resultado líquido | Ganho médio | Perda média | Melhor | Pior | Máx DD | Sharpe | DSR |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 15m | LONG | 312 | 22,1% | -US$1.038,70 | +US$8,99 | -US$6,83 | +US$53,48 | -US$36,35 | -US$1.038,70 | -0,383 | 0,0% ❌ |
| 15m | SHORT | 303 | 29,0% | -US$409,03 | +US$12,48 | -US$7,01 | +US$82,85 | -US$27,88 | -US$470,59 | -0,150 | 0,5% ❌ |
| 15m | **POOLED** | 615 | 25,5% | **-US$1.447,73** | +US$10,95 | -US$6,91 | +US$82,85 | -US$36,35 | -US$1.473,92 | -0,249 | 0,0% ❌ |
| 1h | LONG | 63 | 34,9% | -US$260,20 | +US$13,28 | -US$13,47 | +US$39,91 | -US$57,31 | -US$269,17 | -0,233 | 3,5% ❌ |
| 1h | SHORT | 70 | 35,7% | **+US$186,65** | +US$30,25 | -US$12,66 | +US$119,31 | -US$33,95 | -US$93,17 | +0,072 | 72,4% ❌ |
| 1h | **POOLED** | 133 | 35,3% | **-US$73,55** | +US$22,31 | -US$13,05 | +US$119,31 | -US$57,31 | -US$208,02 | -0,031 | 35,9% ❌ |

## Leitura honesta

**15m: claramente negativo.** O custo de 0,26% por trade é grande demais frente
ao movimento típico de 15 minutos (MFE médio de 1,05% em BTC — o custo consome
25% do movimento disponível). O win rate caiu de ~35% bruto no diagnóstico para
25,5% líquido: os trades que estavam perto do zero viraram perda ao pagar custo.
Mesma causa raiz do Teste 1 do experimento irmão de cruzamento SMA.

**1h: empate técnico negativo.** Pooled -US$73,55 em 133 trades. O lado SHORT
sozinho ficou positivo (+US$186,65, DSR 72,4%) — **mas não passa o piso de 95%
do `CRITERIA.md` e tem n=70, abaixo do piso de 100 sinais.** Não é edge
comprovado, e reportá-lo isolado seria cherry-picking: o mesmo desenho no lado
LONG perdeu US$260,20.

**Conclusão**: o payoff assimétrico medido no diagnóstico (1,79x-1,88x) era
real, mas era **exatamente do tamanho do custo de transação** — não sobra margem
depois de pagar spread/comissão/slippage. Linha não aprovada pelos critérios do
projeto.

## Consequência (registrada na spec)

Este teste, junto com o diagnóstico irmão e os 4 testes de SMA+pullback do mesmo
dia, motivou o **encerramento formal da busca por edge de sinal** — ver
**seção 14 do `AI_BRAIN_SPEC.md`**, que registra a razão matemática (teorema da
parada opcional), o gate de viabilidade por custo quantificado, e a decisão de
produto (B) tomada pelo Cleber: o produto segue intraday e o cérebro é de
execução/disciplina, não de alfa.
