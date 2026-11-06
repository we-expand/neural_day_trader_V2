# Order Block Fade — resultado (R:R escolhido pelo treino, medido no holdout)

Gerado por `backtest.ts`. Zonas: réplica causal de `detectOrderBlocks` de
produção (`zonesCausal.ts` — ver correção de look-ahead documentada lá).
Estrutura BOS/CHoCH: cópia local corrigida quanto a look-ahead
(`structureCausal.ts`). Custo: `CostModel.ts`. Split: `DataSplit.ts` (3
janelas, embargo, warmup 200). R:R vencedor escolhido pelo TREINO (Sharpe
ponderado por trades), avaliado no HOLDOUT — disciplina anti-cherry-pick.

⚠️ DSR por linha corrige só pelos 4 níveis de R:R testados NAQUELA série —
não corrige por escolher a "melhor" entre as 21 séries da tabela (mesmo tipo
de correção que faltaria pra qualquer leitura tipo "olha, XAUUSD 15m deu
positivo" isolada). Nenhuma DSR aqui deve ser lida como prova sozinha.

| Símbolo | TF | R:R escolhido | Trades treino | Trades holdout | Win% holdout | %líq total holdout | %líq médio/trade | Sharpe holdout | DSR |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| BTCUSD | 15m | 1:1 | 499 | 59 | 44.1% | -5.10% | -0.0864% | -0.215 | 0.8% |
| BTCUSD | 1h | 1:3 | 249 | 111 | 17.1% | -19.48% | -0.1755% | -0.174 | 0.2% |
| BTCUSD | 5m | 1:3 | 320 | 239 | 30.1% | -4.85% | -0.0203% | -0.058 | 0.6% |
| EURUSD | 15m | 1:1.5 | 245 | 94 | 41.5% | -0.97% | -0.0104% | -0.159 | 0.6% |
| EURUSD | 1h | 1:2 | 97 | 30 | 26.7% | -1.25% | -0.0418% | -0.701 | 0.0% |
| GER40 | 15m | 1:1.5 | 160 | 76 | 44.7% | -1.83% | -0.0241% | -0.087 | 4.8% |
| GER40 | 1h | 1:3 | 68 | 21 | 9.5% | -5.51% | -0.2626% | -1.115 | 0.0% |
| GER40 | 5m | 1:3 | 274 | 128 | 27.3% | -3.77% | -0.0295% | -0.190 | 0.0% |
| NAS100 | 15m | 1:1.5 | 288 | 68 | 44.1% | -0.81% | -0.0120% | -0.046 | 10.8% |
| NAS100 | 1h | 1:3 | 38 | 25 | 24.0% | -0.81% | -0.0324% | -0.037 | 24.4% |
| SPX500 | 15m | 1:3 | 231 | 51 | 27.5% | -5.78% | -0.1133% | -0.419 | 0.0% |
| SPX500 | 1h | 1:2 | 25 | 36 | 33.3% | -4.08% | -0.1134% | -0.222 | 2.8% |
| US30 | 15m | 1:3 | 205 | 42 | 14.3% | -1.85% | -0.0441% | -0.359 | 0.2% |
| US30 | 1h | 1:1.5 | 37 | 26 | 38.5% | -0.23% | -0.0087% | -0.169 | 8.7% |
| XAGUSD | 15m | 1:2 | 191 | 63 | 28.6% | -34.48% | -0.5473% | -0.657 | 0.0% |
| XAGUSD | 1h | 1:2 | 66 | 33 | 39.4% | -6.72% | -0.2035% | -1.035 | 0.0% |
| XAUUSD | 15m | 1:1.5 | 278 | 66 | 45.5% | 2.70% | 0.0409% | 0.115 | 53.1% |
| XAUUSD | 1h | 1:1 | 54 | 35 | 51.4% | -1.35% | -0.0387% | -0.039 | 20.0% |
| XBNUSD | 15m | 1:1 | 499 | 59 | 44.1% | -5.10% | -0.0864% | -0.215 | 0.8% |
| XBNUSD | 1h | 1:3 | 249 | 111 | 17.1% | -19.48% | -0.1755% | -0.174 | 0.2% |
| XBNUSD | 5m | 1:3 | 320 | 239 | 30.1% | -4.85% | -0.0203% | -0.058 | 0.6% |
