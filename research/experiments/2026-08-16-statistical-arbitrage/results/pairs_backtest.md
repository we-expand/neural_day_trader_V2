# Arbitragem estatística (pairs trading / cointegração) — item 4 do redesenho (2026-08-16)

Parâmetros fixos (não otimizados): janela=100 candles, entrada z=±2, saída z=±0.5, stop z=±3.5, hold máx=50 candles.
Custo real (CostModel.ts) aplicado nas 2 pernas. Dado real em cache (`2026-08-05-taxa-base/data/`).

| Par | TF | Candles | Dias | Trades | Trades/dia | Win% | %líq médio/trade | Resultado líq total % |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| XAUUSD/XAGUSD | 15m | 6448 | 127 | 173 | 1.359 | 28.9% | -0.147% | -25.47% |
| XAUUSD/XAGUSD | 1h | 2331 | 360 | 66 | 0.184 | 34.8% | -0.147% | -9.73% |
| US30/SPX500 | 15m | 5728 | 127 | 193 | 1.515 | 34.2% | -0.046% | -8.87% |
| US30/SPX500 | 1h | 1358 | 358 | 51 | 0.143 | 27.5% | -0.061% | -3.13% |
| US30/NAS100 | 15m | 6724 | 140 | 199 | 1.426 | 44.2% | -0.020% | -3.97% |
| US30/NAS100 | 1h | 2793 | 477 | 84 | 0.176 | 51.2% | 0.027% | 2.29% |
| SPX500/NAS100 | 15m | 5636 | 127 | 159 | 1.248 | 18.9% | -0.098% | -15.52% |
| SPX500/NAS100 | 1h | 1427 | 358 | 43 | 0.120 | 30.2% | -0.080% | -3.45% |
| GER40/US30 | 15m | 5249 | 125 | 151 | 1.208 | 53.0% | 0.023% | 3.55% |
| GER40/US30 | 1h | 2515 | 450 | 61 | 0.136 | 49.2% | -0.024% | -1.44% |
| GER40/SPX500 | 15m | 5162 | 125 | 137 | 1.096 | 43.8% | -0.041% | -5.65% |
| GER40/SPX500 | 1h | 1441 | 359 | 35 | 0.098 | 40.0% | 0.010% | 0.34% |
