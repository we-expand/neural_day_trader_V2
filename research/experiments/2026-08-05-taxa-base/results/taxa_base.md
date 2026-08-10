# Taxa base — entradas/dia × pontos médios × resultado líquido

Gerado por `measure.ts`. Motor de produção (`runBacktest`), presets de
produção (`PRESET_STRATEGIES`), custo real (`CostModel.ts`), direção `both`
(= `AUTO` de produção). Mede viabilidade operacional, NÃO edge.

| Preset | Ativo | TF | Candles | Dias | Trades | Trades/dia | Win% | Pts líq/trade | %líq/trade | Resultado líq total % |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Rompimento de Canal (Donchian) | BTCUSD | 5m | 12960 | 45 | 137 | 3.045 | 29.2% | -35.69 | -0.083% | -11.38% |
| Rompimento de Canal (Donchian) | BTCUSD | 15m | 11520 | 120 | 118 | 0.983 | 22.9% | -139.21 | -0.233% | -27.47% |
| Rompimento de Canal (Donchian) | BTCUSD | 1h | 8760 | 365 | 94 | 0.258 | 30.9% | -339.57 | -0.392% | -36.82% |
| Rompimento de Canal (Donchian) | XBNUSD | 5m | 12960 | 45 | 137 | 3.045 | 29.2% | -356888.27 | -0.083% | -11.38% |
| Rompimento de Canal (Donchian) | XBNUSD | 15m | 11520 | 120 | 118 | 0.983 | 22.9% | -1392076.24 | -0.233% | -27.47% |
| Rompimento de Canal (Donchian) | XBNUSD | 1h | 8760 | 365 | 94 | 0.258 | 30.9% | -3395699.10 | -0.392% | -36.82% |
| Rompimento de Canal (Donchian) | EURUSD | 5m | 10000 | 49 | 89 | 1.827 | 32.6% | 0.33 | -0.009% | -0.82% |
| Rompimento de Canal (Donchian) | EURUSD | 15m | 9000 | 132 | 83 | 0.630 | 36.1% | 0.11 | -0.011% | -0.92% |
| Rompimento de Canal (Donchian) | EURUSD | 1h | 4000 | 401 | 44 | 0.110 | 25.0% | -4.58 | -0.052% | -2.30% |
| Rompimento de Canal (Donchian) | XAUUSD | 5m | 9000 | 47 | 86 | 1.832 | 30.2% | -13.17 | -0.040% | -3.41% |
| Rompimento de Canal (Donchian) | XAUUSD | 15m | 7000 | 127 | 74 | 0.581 | 29.7% | -46.17 | -0.115% | -8.54% |
| Rompimento de Canal (Donchian) | XAUUSD | 1h | 3000 | 418 | 30 | 0.072 | 50.0% | 293.98 | 0.715% | 21.44% |
| Rompimento de Canal (Donchian) | XAGUSD | 5m | 9000 | 47 | 77 | 1.640 | 37.7% | -110.22 | -0.015% | -1.14% |
| Rompimento de Canal (Donchian) | XAGUSD | 15m | 8000 | 134 | 72 | 0.536 | 37.5% | -658.26 | -0.104% | -7.49% |
| Rompimento de Canal (Donchian) | XAGUSD | 1h | 3000 | 366 | 34 | 0.093 | 47.1% | 10240.32 | 1.306% | 44.39% |
| Rompimento de Canal (Donchian) | US30 | 5m | 9000 | 47 | 105 | 2.237 | 34.3% | -8.55 | -0.033% | -3.45% |
| Rompimento de Canal (Donchian) | US30 | 15m | 7000 | 140 | 79 | 0.566 | 36.7% | 21.83 | 0.031% | 2.42% |
| Rompimento de Canal (Donchian) | US30 | 1h | 3000 | 478 | 41 | 0.086 | 43.9% | 111.68 | 0.233% | 9.55% |
| Rompimento de Canal (Donchian) | NAS100 | 5m | 9000 | 47 | 88 | 1.874 | 31.8% | -0.01 | -0.028% | -2.46% |
| Rompimento de Canal (Donchian) | NAS100 | 15m | 7000 | 140 | 83 | 0.595 | 31.3% | 9.68 | 0.023% | 1.88% |
| Rompimento de Canal (Donchian) | NAS100 | 1h | 3000 | 477 | 33 | 0.069 | 36.4% | 124.75 | 0.590% | 19.46% |
| Rompimento de Canal (Donchian) | SPX500 | 5m | 9000 | 47 | 92 | 1.960 | 13.0% | -1.19 | -0.131% | -12.09% |
| Rompimento de Canal (Donchian) | SPX500 | 15m | 7000 | 127 | 90 | 0.706 | 28.9% | -2.07 | -0.139% | -12.50% |
| Rompimento de Canal (Donchian) | SPX500 | 1h | 3000 | 398 | 38 | 0.096 | 23.7% | 2.71 | -0.075% | -2.85% |
| Rompimento de Canal (Donchian) | GER40 | 5m | 9000 | 50 | 85 | 1.687 | 37.6% | 7.33 | -0.005% | -0.40% |
| Rompimento de Canal (Donchian) | GER40 | 15m | 6000 | 125 | 65 | 0.520 | 32.3% | -3.23 | -0.044% | -2.85% |
| Rompimento de Canal (Donchian) | GER40 | 1h | 3000 | 468 | 33 | 0.070 | 33.3% | -10.44 | -0.072% | -2.38% |
| Cruzamento de Médias com Filtro de Regime | BTCUSD | 5m | 12960 | 45 | 62 | 1.378 | 27.4% | -26.42 | -0.066% | -4.10% |
| Cruzamento de Médias com Filtro de Regime | BTCUSD | 15m | 11520 | 120 | 40 | 0.333 | 30.0% | -84.22 | -0.150% | -6.00% |
| Cruzamento de Médias com Filtro de Regime | BTCUSD | 1h | 8760 | 365 | 43 | 0.118 | 32.6% | 54.74 | 0.113% | 4.88% |
| Cruzamento de Médias com Filtro de Regime | XBNUSD | 5m | 12960 | 45 | 62 | 1.378 | 27.4% | -264214.85 | -0.066% | -4.10% |
| Cruzamento de Médias com Filtro de Regime | XBNUSD | 15m | 11520 | 120 | 40 | 0.333 | 30.0% | -842225.37 | -0.150% | -6.00% |
| Cruzamento de Médias com Filtro de Regime | XBNUSD | 1h | 8760 | 365 | 43 | 0.118 | 32.6% | 547418.11 | 0.113% | 4.88% |
| Cruzamento de Médias com Filtro de Regime | EURUSD | 5m | 10000 | 49 | 42 | 0.862 | 42.9% | 2.41 | 0.009% | 0.38% |
| Cruzamento de Médias com Filtro de Regime | EURUSD | 15m | 9000 | 132 | 42 | 0.319 | 35.7% | -2.21 | -0.031% | -1.32% |
| Cruzamento de Médias com Filtro de Regime | EURUSD | 1h | 4000 | 401 | 23 | 0.057 | 21.7% | -14.05 | -0.132% | -3.03% |
| Cruzamento de Médias com Filtro de Regime | XAUUSD | 5m | 9000 | 47 | 42 | 0.895 | 40.5% | 15.15 | 0.031% | 1.29% |
| Cruzamento de Médias com Filtro de Regime | XAUUSD | 15m | 7000 | 127 | 30 | 0.236 | 26.7% | -81.45 | -0.189% | -5.68% |
| Cruzamento de Médias com Filtro de Regime | XAUUSD | 1h | 3000 | 418 | 17 | 0.041 | 35.3% | 71.83 | 0.136% | 2.30% |
| Cruzamento de Médias com Filtro de Regime | XAGUSD | 5m | 9000 | 47 | 36 | 0.767 | 38.9% | 876.90 | 0.155% | 5.58% |
| Cruzamento de Médias com Filtro de Regime | XAGUSD | 15m | 8000 | 134 | 34 | 0.253 | 47.1% | 460.99 | 0.109% | 3.71% |
| Cruzamento de Médias com Filtro de Regime | XAGUSD | 1h | 3000 | 366 | 17 | 0.046 | 41.2% | 4529.69 | 0.552% | 9.39% |
| Cruzamento de Médias com Filtro de Regime | US30 | 5m | 9000 | 47 | 52 | 1.108 | 25.0% | -2.00 | -0.020% | -1.06% |
| Cruzamento de Médias com Filtro de Regime | US30 | 15m | 7000 | 140 | 40 | 0.287 | 25.0% | -27.82 | -0.071% | -2.83% |
| Cruzamento de Médias com Filtro de Regime | US30 | 1h | 3000 | 478 | 19 | 0.040 | 42.1% | 56.64 | 0.128% | 2.42% |
| Cruzamento de Médias com Filtro de Regime | NAS100 | 5m | 9000 | 47 | 41 | 0.873 | 31.7% | -39.48 | -0.166% | -6.80% |
| Cruzamento de Médias com Filtro de Regime | NAS100 | 15m | 7000 | 140 | 41 | 0.294 | 29.3% | -6.39 | -0.039% | -1.61% |
| Cruzamento de Médias com Filtro de Regime | NAS100 | 1h | 3000 | 477 | 14 | 0.029 | 35.7% | 93.29 | 0.367% | 5.14% |
| Cruzamento de Médias com Filtro de Regime | SPX500 | 5m | 9000 | 47 | 49 | 1.044 | 20.4% | -5.52 | -0.190% | -9.29% |
| Cruzamento de Médias com Filtro de Regime | SPX500 | 15m | 7000 | 127 | 31 | 0.243 | 16.1% | -6.64 | -0.204% | -6.34% |
| Cruzamento de Médias com Filtro de Regime | SPX500 | 1h | 3000 | 398 | 14 | 0.035 | 21.4% | -11.82 | -0.286% | -4.01% |
| Cruzamento de Médias com Filtro de Regime | GER40 | 5m | 9000 | 50 | 48 | 0.952 | 27.1% | 3.99 | -0.019% | -0.90% |
| Cruzamento de Médias com Filtro de Regime | GER40 | 15m | 6000 | 125 | 27 | 0.216 | 37.0% | 25.84 | 0.080% | 2.15% |
| Cruzamento de Médias com Filtro de Regime | GER40 | 1h | 3000 | 468 | 16 | 0.034 | 25.0% | -13.28 | -0.094% | -1.50% |
| Reversão à Média (RSI + Bollinger) | BTCUSD | 5m | 12960 | 45 | 13 | 0.289 | 53.8% | 44.97 | 0.043% | 0.56% |
| Reversão à Média (RSI + Bollinger) | BTCUSD | 15m | 11520 | 120 | 7 | 0.058 | 28.6% | -77.18 | -0.124% | -0.87% |
| Reversão à Média (RSI + Bollinger) | BTCUSD | 1h | 8760 | 365 | 12 | 0.033 | 58.3% | -216.35 | -0.321% | -3.85% |
| Reversão à Média (RSI + Bollinger) | XBNUSD | 5m | 12960 | 45 | 14 | 0.311 | 0.0% | -121513.55 | -0.050% | -0.69% |
| Reversão à Média (RSI + Bollinger) | XBNUSD | 15m | 11520 | 120 | 7 | 0.058 | 0.0% | -584439.61 | -0.103% | -0.72% |
| Reversão à Média (RSI + Bollinger) | XBNUSD | 1h | 8760 | 365 | 12 | 0.033 | 0.0% | -2054049.04 | -0.295% | -3.54% |
| Reversão à Média (RSI + Bollinger) | EURUSD | 5m | 10000 | 49 | 9 | 0.185 | 33.3% | 5.78 | 0.039% | 0.35% |
| Reversão à Média (RSI + Bollinger) | EURUSD | 15m | 9000 | 132 | 8 | 0.061 | 50.0% | 4.83 | 0.029% | 0.23% |
| Reversão à Média (RSI + Bollinger) | EURUSD | 1h | 4000 | 401 | 10 | 0.025 | 60.0% | 15.47 | 0.122% | 1.22% |
| Reversão à Média (RSI + Bollinger) | XAUUSD | 5m | 9000 | 47 | 6 | 0.128 | 16.7% | -11.57 | -0.038% | -0.23% |
| Reversão à Média (RSI + Bollinger) | XAUUSD | 15m | 7000 | 127 | 11 | 0.086 | 27.3% | -68.15 | -0.160% | -1.76% |
| Reversão à Média (RSI + Bollinger) | XAUUSD | 1h | 3000 | 418 | 5 | 0.012 | 60.0% | 26.22 | 0.058% | 0.29% |
| Reversão à Média (RSI + Bollinger) | XAGUSD | 5m | 9000 | 47 | 13 | 0.277 | 76.9% | -298.02 | -0.053% | -0.69% |
| Reversão à Média (RSI + Bollinger) | XAGUSD | 15m | 8000 | 134 | 6 | 0.045 | 100.0% | 160.00 | 0.024% | 0.15% |
| Reversão à Média (RSI + Bollinger) | XAGUSD | 1h | 3000 | 366 | 1 | 0.003 | 100.0% | 160.00 | 0.019% | 0.02% |
| Reversão à Média (RSI + Bollinger) | US30 | 5m | 9000 | 47 | 5 | 0.107 | 60.0% | 48.33 | 0.077% | 0.38% |
| Reversão à Média (RSI + Bollinger) | US30 | 15m | 7000 | 140 | 6 | 0.043 | 66.7% | 29.39 | 0.044% | 0.27% |
| Reversão à Média (RSI + Bollinger) | US30 | 1h | 3000 | 478 | 2 | 0.004 | 0.0% | -78.96 | -0.178% | -0.36% |
| Reversão à Média (RSI + Bollinger) | NAS100 | 5m | 9000 | 47 | 7 | 0.149 | 28.6% | -21.63 | -0.105% | -0.73% |
| Reversão à Média (RSI + Bollinger) | NAS100 | 15m | 7000 | 140 | 1 | 0.007 | 100.0% | 83.06 | 0.304% | 0.30% |
| Reversão à Média (RSI + Bollinger) | NAS100 | 1h | 3000 | 477 | 6 | 0.013 | 16.7% | -86.28 | -0.365% | -2.19% |
| Reversão à Média (RSI + Bollinger) | SPX500 | 5m | 9000 | 47 | 5 | 0.107 | 20.0% | 4.16 | -0.061% | -0.30% |
| Reversão à Média (RSI + Bollinger) | SPX500 | 15m | 7000 | 127 | 4 | 0.031 | 25.0% | -4.46 | -0.173% | -0.69% |
| Reversão à Média (RSI + Bollinger) | SPX500 | 1h | 3000 | 398 | 5 | 0.013 | 0.0% | -20.81 | -0.423% | -2.12% |
| Reversão à Média (RSI + Bollinger) | GER40 | 5m | 9000 | 50 | 12 | 0.238 | 33.3% | -0.09 | -0.035% | -0.42% |
| Reversão à Média (RSI + Bollinger) | GER40 | 15m | 6000 | 125 | 4 | 0.032 | 75.0% | 41.56 | 0.138% | 0.55% |
| Reversão à Média (RSI + Bollinger) | GER40 | 1h | 3000 | 468 | 5 | 0.011 | 0.0% | -111.09 | -0.499% | -2.49% |
| Rompimento Confirmado (Volume) | BTCUSD | 5m | 12960 | 45 | 322 | 7.156 | 31.4% | -2.41 | -0.033% | -10.51% |
| Rompimento Confirmado (Volume) | BTCUSD | 15m | 11520 | 120 | 266 | 2.217 | 30.5% | -27.97 | -0.073% | -19.47% |
| Rompimento Confirmado (Volume) | BTCUSD | 1h | 8760 | 365 | 183 | 0.501 | 33.3% | -12.98 | -0.029% | -5.40% |
| Rompimento Confirmado (Volume) | XBNUSD | 5m | 12960 | 45 | 322 | 7.156 | 31.4% | -24083.59 | -0.033% | -10.51% |
| Rompimento Confirmado (Volume) | XBNUSD | 15m | 11520 | 120 | 266 | 2.217 | 30.5% | -279701.06 | -0.073% | -19.47% |
| Rompimento Confirmado (Volume) | XBNUSD | 1h | 8760 | 365 | 183 | 0.501 | 33.3% | -129751.77 | -0.029% | -5.40% |
| Rompimento Confirmado (Volume) | EURUSD | 5m | 10000 | 49 | 238 | 4.885 | 26.5% | -0.24 | -0.014% | -3.39% |
| Rompimento Confirmado (Volume) | EURUSD | 15m | 9000 | 132 | 217 | 1.647 | 29.0% | -0.53 | -0.017% | -3.61% |
| Rompimento Confirmado (Volume) | EURUSD | 1h | 4000 | 401 | 86 | 0.215 | 30.2% | -1.45 | -0.025% | -2.11% |
| Rompimento Confirmado (Volume) | XAUUSD | 5m | 9000 | 47 | 209 | 4.452 | 33.0% | -4.06 | -0.018% | -3.72% |
| Rompimento Confirmado (Volume) | XAUUSD | 15m | 7000 | 127 | 147 | 1.154 | 33.3% | -3.81 | -0.017% | -2.54% |
| Rompimento Confirmado (Volume) | XAUUSD | 1h | 3000 | 418 | 73 | 0.175 | 45.2% | 86.01 | 0.193% | 14.09% |
| Rompimento Confirmado (Volume) | XAGUSD | 5m | 9000 | 47 | 187 | 3.983 | 36.4% | -76.69 | -0.012% | -2.26% |
| Rompimento Confirmado (Volume) | XAGUSD | 15m | 8000 | 134 | 172 | 1.280 | 34.3% | -9.49 | -0.014% | -2.46% |
| Rompimento Confirmado (Volume) | XAGUSD | 1h | 3000 | 366 | 82 | 0.224 | 39.0% | 809.51 | 0.083% | 6.83% |
| Rompimento Confirmado (Volume) | US30 | 5m | 9000 | 47 | 230 | 4.899 | 30.9% | -1.82 | -0.020% | -4.62% |
| Rompimento Confirmado (Volume) | US30 | 15m | 7000 | 140 | 185 | 1.326 | 32.4% | 5.51 | -0.004% | -0.70% |
| Rompimento Confirmado (Volume) | US30 | 1h | 3000 | 478 | 75 | 0.157 | 50.7% | 49.94 | 0.087% | 6.53% |
| Rompimento Confirmado (Volume) | NAS100 | 5m | 9000 | 47 | 218 | 4.643 | 29.4% | 0.19 | -0.029% | -6.30% |
| Rompimento Confirmado (Volume) | NAS100 | 15m | 7000 | 140 | 176 | 1.261 | 35.2% | -0.71 | -0.027% | -4.68% |
| Rompimento Confirmado (Volume) | NAS100 | 1h | 3000 | 477 | 73 | 0.153 | 41.1% | 21.17 | 0.055% | 4.05% |
| Rompimento Confirmado (Volume) | SPX500 | 5m | 9000 | 47 | 217 | 4.622 | 18.0% | 0.24 | -0.112% | -24.37% |
| Rompimento Confirmado (Volume) | SPX500 | 15m | 7000 | 127 | 187 | 1.468 | 26.2% | 1.89 | -0.087% | -16.33% |
| Rompimento Confirmado (Volume) | SPX500 | 1h | 3000 | 398 | 75 | 0.189 | 32.0% | 0.95 | -0.099% | -7.46% |
| Rompimento Confirmado (Volume) | GER40 | 5m | 9000 | 50 | 207 | 4.107 | 31.4% | 2.28 | -0.025% | -5.24% |
| Rompimento Confirmado (Volume) | GER40 | 15m | 6000 | 125 | 136 | 1.088 | 31.6% | 3.61 | -0.019% | -2.53% |
| Rompimento Confirmado (Volume) | GER40 | 1h | 3000 | 468 | 77 | 0.164 | 28.6% | -13.09 | -0.089% | -6.83% |
| Momentum de Curto Prazo (Scalp) | BTCUSD | 5m | 12960 | 45 | 164 | 3.645 | 39.0% | 10.97 | -0.011% | -1.84% |
| Momentum de Curto Prazo (Scalp) | BTCUSD | 15m | 11520 | 120 | 157 | 1.308 | 38.9% | 23.40 | 0.004% | 0.63% |
| Momentum de Curto Prazo (Scalp) | BTCUSD | 1h | 8760 | 365 | 110 | 0.301 | 45.5% | 70.15 | 0.053% | 5.86% |
| Momentum de Curto Prazo (Scalp) | XBNUSD | 5m | 12960 | 45 | 164 | 3.645 | 39.0% | 109662.75 | -0.011% | -1.84% |
| Momentum de Curto Prazo (Scalp) | XBNUSD | 15m | 11520 | 120 | 157 | 1.308 | 38.9% | 233983.26 | 0.004% | 0.63% |
| Momentum de Curto Prazo (Scalp) | XBNUSD | 1h | 8760 | 365 | 110 | 0.301 | 45.5% | 701490.50 | 0.053% | 5.86% |
| Momentum de Curto Prazo (Scalp) | EURUSD | 5m | 10000 | 49 | 111 | 2.278 | 19.8% | -0.95 | -0.020% | -2.27% |
| Momentum de Curto Prazo (Scalp) | EURUSD | 15m | 9000 | 132 | 103 | 0.782 | 29.1% | -0.38 | -0.015% | -1.59% |
| Momentum de Curto Prazo (Scalp) | EURUSD | 1h | 4000 | 401 | 38 | 0.095 | 39.5% | 0.50 | -0.008% | -0.29% |
| Momentum de Curto Prazo (Scalp) | XAUUSD | 5m | 9000 | 47 | 104 | 2.215 | 25.0% | -12.42 | -0.039% | -4.02% |
| Momentum de Curto Prazo (Scalp) | XAUUSD | 15m | 7000 | 127 | 75 | 0.589 | 42.7% | 26.37 | 0.053% | 3.95% |
| Momentum de Curto Prazo (Scalp) | XAUUSD | 1h | 3000 | 418 | 42 | 0.101 | 33.3% | 1.95 | 0.006% | 0.25% |
| Momentum de Curto Prazo (Scalp) | XAGUSD | 5m | 9000 | 47 | 113 | 2.407 | 31.9% | -157.85 | -0.027% | -3.08% |
| Momentum de Curto Prazo (Scalp) | XAGUSD | 15m | 8000 | 134 | 89 | 0.662 | 24.7% | -886.23 | -0.127% | -11.31% |
| Momentum de Curto Prazo (Scalp) | XAGUSD | 1h | 3000 | 366 | 33 | 0.090 | 48.5% | 441.01 | 0.130% | 4.28% |
| Momentum de Curto Prazo (Scalp) | US30 | 5m | 9000 | 47 | 134 | 2.854 | 32.1% | 3.92 | -0.009% | -1.20% |
| Momentum de Curto Prazo (Scalp) | US30 | 15m | 7000 | 140 | 81 | 0.580 | 30.9% | -9.54 | -0.037% | -3.01% |
| Momentum de Curto Prazo (Scalp) | US30 | 1h | 3000 | 478 | 28 | 0.059 | 57.1% | 51.23 | 0.091% | 2.56% |
| Momentum de Curto Prazo (Scalp) | NAS100 | 5m | 9000 | 47 | 93 | 1.981 | 32.3% | 1.81 | -0.023% | -2.15% |
| Momentum de Curto Prazo (Scalp) | NAS100 | 15m | 7000 | 140 | 97 | 0.695 | 40.2% | 12.42 | 0.014% | 1.33% |
| Momentum de Curto Prazo (Scalp) | NAS100 | 1h | 3000 | 477 | 29 | 0.061 | 37.9% | 1.27 | -0.008% | -0.23% |
| Momentum de Curto Prazo (Scalp) | SPX500 | 5m | 9000 | 47 | 120 | 2.556 | 12.5% | 0.04 | -0.115% | -13.78% |
| Momentum de Curto Prazo (Scalp) | SPX500 | 15m | 7000 | 127 | 98 | 0.769 | 23.5% | 0.40 | -0.109% | -10.71% |
| Momentum de Curto Prazo (Scalp) | SPX500 | 1h | 3000 | 398 | 39 | 0.098 | 25.6% | -1.33 | -0.136% | -5.29% |
| Momentum de Curto Prazo (Scalp) | GER40 | 5m | 9000 | 50 | 118 | 2.341 | 24.6% | -2.28 | -0.043% | -5.12% |
| Momentum de Curto Prazo (Scalp) | GER40 | 15m | 6000 | 125 | 62 | 0.496 | 30.6% | -3.49 | -0.048% | -3.00% |
| Momentum de Curto Prazo (Scalp) | GER40 | 1h | 3000 | 468 | 28 | 0.060 | 39.3% | 12.49 | 0.021% | 0.58% |
