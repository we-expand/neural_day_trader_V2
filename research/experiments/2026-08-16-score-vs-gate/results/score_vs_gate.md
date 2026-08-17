# Score contínuo vs. gate binário — item 2 do redesenho do cérebro (2026-08-16)

Mesmos dados reais em cache de `2026-08-05-taxa-base/data/` (15m/1h), mesmo
motor de produção pra saída (TP/SL/trailing), mesmo CostModel.ts. Única
diferença: entrada por score contínuo (`evaluateStrategyScoreAt`) em vez de
gate binário (`evaluateStrategyAt`). Direção `both` (= AUTO de produção).

| Preset | Ativo | TF | Dias | Gate: trades | Gate: trades/dia | Gate: líq total % | Score40: trades/dia | líq% | Score50: trades/dia | líq% | Score60: trades/dia | líq% | Score70: trades/dia | líq% |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Rompimento de Canal (Donchian) | BTCUSD | 15m | 120 | 118 | 0.983 | -27.47% | 1.350 | -23.40% | 1.283 | -23.47% | 1.258 | -25.58% | 1.183 | -25.91% |
| Rompimento de Canal (Donchian) | BTCUSD | 1h | 365 | 94 | 0.258 | -36.82% | 0.332 | -38.66% | 0.315 | -40.13% | 0.304 | -42.08% | 0.296 | -42.14% |
| Rompimento de Canal (Donchian) | EURUSD | 15m | 132 | 83 | 0.630 | -0.92% | 0.888 | -2.42% | 0.858 | -2.10% | 0.820 | -1.62% | 0.789 | -1.39% |
| Rompimento de Canal (Donchian) | EURUSD | 1h | 401 | 44 | 0.110 | -2.30% | 0.135 | -3.20% | 0.130 | -2.92% | 0.125 | -2.54% | 0.125 | -2.75% |
| Rompimento de Canal (Donchian) | XAUUSD | 15m | 127 | 74 | 0.581 | -8.54% | 0.746 | -7.20% | 0.730 | -6.72% | 0.722 | -6.16% | 0.667 | -6.35% |
| Rompimento de Canal (Donchian) | XAUUSD | 1h | 418 | 30 | 0.072 | 21.44% | 0.091 | 28.11% | 0.086 | 29.77% | 0.084 | 30.69% | 0.081 | 29.62% |
| Rompimento de Canal (Donchian) | XAGUSD | 15m | 134 | 72 | 0.536 | -46.82% | 0.707 | -57.66% | 0.670 | -53.56% | 0.647 | -53.18% | 0.610 | -49.80% |
| Rompimento de Canal (Donchian) | XAGUSD | 1h | 366 | 34 | 0.093 | 25.77% | 0.104 | 60.69% | 0.101 | 56.35% | 0.098 | 51.46% | 0.098 | 25.42% |
| Rompimento de Canal (Donchian) | US30 | 15m | 140 | 79 | 0.566 | 2.42% | 0.774 | 3.82% | 0.731 | 3.52% | 0.659 | 4.88% | 0.638 | 4.35% |
| Rompimento de Canal (Donchian) | US30 | 1h | 478 | 41 | 0.086 | 9.55% | 0.117 | 8.75% | 0.113 | 8.05% | 0.109 | 8.06% | 0.098 | 8.11% |
| Rompimento de Canal (Donchian) | NAS100 | 15m | 140 | 83 | 0.595 | 1.88% | 0.781 | 11.22% | 0.752 | 7.63% | 0.738 | 6.41% | 0.702 | 4.77% |
| Rompimento de Canal (Donchian) | NAS100 | 1h | 477 | 33 | 0.069 | 19.46% | 0.090 | 20.62% | 0.088 | 20.76% | 0.078 | 24.76% | 0.071 | 22.94% |
| Rompimento de Canal (Donchian) | SPX500 | 15m | 127 | 90 | 0.706 | -12.50% | 0.910 | -14.34% | 0.879 | -15.17% | 0.840 | -14.25% | 0.785 | -11.94% |
| Rompimento de Canal (Donchian) | SPX500 | 1h | 398 | 38 | 0.096 | -2.85% | 0.126 | 0.40% | 0.123 | -4.37% | 0.116 | -3.58% | 0.108 | -2.42% |
| Rompimento de Canal (Donchian) | GER40 | 15m | 125 | 65 | 0.520 | -2.85% | 0.672 | -3.02% | 0.640 | -4.45% | 0.616 | -4.79% | 0.608 | -5.41% |
| Rompimento de Canal (Donchian) | GER40 | 1h | 468 | 33 | 0.070 | -2.38% | 0.094 | -1.31% | 0.094 | -2.99% | 0.090 | -3.00% | 0.079 | -0.58% |
| Cruzamento de Médias com Filtro de Regime | BTCUSD | 15m | 120 | 40 | 0.333 | -6.00% | 1.517 | -27.06% | 1.517 | -27.06% | 0.608 | -6.81% | 0.575 | -6.04% |
| Cruzamento de Médias com Filtro de Regime | BTCUSD | 1h | 365 | 43 | 0.118 | 4.88% | 0.367 | -42.18% | 0.367 | -42.18% | 0.181 | -6.50% | 0.170 | 1.53% |
| Cruzamento de Médias com Filtro de Regime | EURUSD | 15m | 132 | 42 | 0.319 | -1.32% | 0.949 | -1.52% | 0.949 | -1.52% | 0.501 | -0.15% | 0.478 | 0.15% |
| Cruzamento de Médias com Filtro de Regime | EURUSD | 1h | 401 | 23 | 0.057 | -3.03% | 0.142 | -2.91% | 0.142 | -2.91% | 0.085 | -3.36% | 0.082 | -2.76% |
| Cruzamento de Médias com Filtro de Regime | XAUUSD | 15m | 127 | 30 | 0.236 | -5.68% | 0.801 | -3.34% | 0.793 | -2.47% | 0.369 | -4.46% | 0.338 | -2.41% |
| Cruzamento de Médias com Filtro de Regime | XAUUSD | 1h | 418 | 17 | 0.041 | 2.30% | 0.110 | 19.02% | 0.110 | 19.02% | 0.060 | 13.68% | 0.057 | 11.78% |
| Cruzamento de Médias com Filtro de Regime | XAGUSD | 15m | 134 | 34 | 0.253 | -14.86% | 0.744 | -36.36% | 0.744 | -36.36% | 0.365 | -18.50% | 0.335 | -17.66% |
| Cruzamento de Médias com Filtro de Regime | XAGUSD | 1h | 366 | 17 | 0.046 | 0.08% | 0.153 | 16.17% | 0.153 | 16.17% | 0.060 | 8.89% | 0.060 | 8.89% |
| Cruzamento de Médias com Filtro de Regime | US30 | 15m | 140 | 40 | 0.287 | -2.83% | 0.824 | 7.98% | 0.824 | 7.96% | 0.358 | -0.56% | 0.351 | -1.30% |
| Cruzamento de Médias com Filtro de Regime | US30 | 1h | 478 | 19 | 0.040 | 2.42% | 0.113 | 12.59% | 0.113 | 12.59% | 0.050 | 4.10% | 0.048 | 3.08% |
| Cruzamento de Médias com Filtro de Regime | NAS100 | 15m | 140 | 41 | 0.294 | -1.61% | 0.831 | 1.44% | 0.824 | 1.67% | 0.401 | -2.03% | 0.380 | -3.01% |
| Cruzamento de Médias com Filtro de Regime | NAS100 | 1h | 477 | 14 | 0.029 | 5.14% | 0.092 | 17.30% | 0.094 | 13.19% | 0.040 | 5.47% | 0.040 | 5.47% |
| Cruzamento de Médias com Filtro de Regime | SPX500 | 15m | 127 | 31 | 0.243 | -6.34% | 0.903 | -2.27% | 0.895 | -1.06% | 0.385 | -5.17% | 0.377 | -6.07% |
| Cruzamento de Médias com Filtro de Regime | SPX500 | 1h | 398 | 14 | 0.035 | -4.01% | 0.111 | 4.97% | 0.108 | 6.01% | 0.043 | -3.38% | 0.038 | -3.98% |
| Cruzamento de Médias com Filtro de Regime | GER40 | 15m | 125 | 27 | 0.216 | 2.15% | 0.776 | -3.93% | 0.776 | -3.93% | 0.360 | -2.22% | 0.344 | -2.48% |
| Cruzamento de Médias com Filtro de Regime | GER40 | 1h | 468 | 16 | 0.034 | -1.50% | 0.120 | 1.64% | 0.120 | 1.60% | 0.045 | 4.31% | 0.045 | 4.31% |
| Reversão à Média (RSI + Bollinger) | BTCUSD | 15m | 120 | 7 | 0.058 | -0.87% | 1.558 | -3.56% | 1.283 | -5.11% | 0.200 | -1.64% | 0.200 | -1.64% |
| Reversão à Média (RSI + Bollinger) | BTCUSD | 1h | 365 | 12 | 0.033 | -3.85% | 0.425 | -6.41% | 0.307 | -7.88% | 0.066 | -2.56% | 0.066 | -2.56% |
| Reversão à Média (RSI + Bollinger) | EURUSD | 15m | 132 | 8 | 0.061 | 0.23% | 1.184 | -2.44% | 1.002 | -1.90% | 0.175 | 0.04% | 0.167 | -0.11% |
| Reversão à Média (RSI + Bollinger) | EURUSD | 1h | 401 | 10 | 0.025 | 1.22% | 0.200 | 0.67% | 0.175 | 1.22% | 0.045 | 1.99% | 0.045 | 1.99% |
| Reversão à Média (RSI + Bollinger) | XAUUSD | 15m | 127 | 11 | 0.086 | -1.76% | 0.966 | -1.51% | 0.872 | -1.23% | 0.188 | -1.96% | 0.188 | -1.96% |
| Reversão à Média (RSI + Bollinger) | XAUUSD | 1h | 418 | 5 | 0.012 | 0.29% | 0.105 | 2.08% | 0.086 | 2.57% | 0.014 | 0.46% | 0.014 | 0.46% |
| Reversão à Média (RSI + Bollinger) | XAGUSD | 15m | 134 | 6 | 0.045 | 1.97% | 0.908 | -60.87% | 0.811 | -54.11% | 0.149 | -9.40% | 0.149 | -9.40% |
| Reversão à Média (RSI + Bollinger) | XAGUSD | 1h | 366 | 1 | 0.003 | -1.11% | 0.087 | -24.37% | 0.077 | -25.12% | 0.008 | -3.65% | 0.008 | -3.65% |
| Reversão à Média (RSI + Bollinger) | US30 | 15m | 140 | 6 | 0.043 | 0.27% | 0.659 | -1.75% | 0.602 | -1.01% | 0.129 | -0.89% | 0.129 | -0.89% |
| Reversão à Média (RSI + Bollinger) | US30 | 1h | 478 | 2 | 0.004 | -0.36% | 0.044 | -3.29% | 0.040 | -2.76% | 0.015 | -0.56% | 0.015 | -0.56% |
| Reversão à Média (RSI + Bollinger) | NAS100 | 15m | 140 | 1 | 0.007 | 0.30% | 0.695 | -3.52% | 0.595 | -2.72% | 0.072 | 0.89% | 0.072 | 0.89% |
| Reversão à Média (RSI + Bollinger) | NAS100 | 1h | 477 | 6 | 0.013 | -2.19% | 0.061 | -1.94% | 0.055 | -0.98% | 0.013 | -2.19% | 0.013 | -2.19% |
| Reversão à Média (RSI + Bollinger) | SPX500 | 15m | 127 | 4 | 0.031 | -0.69% | 0.769 | -8.88% | 0.604 | -7.35% | 0.086 | -0.97% | 0.086 | -0.97% |
| Reversão à Média (RSI + Bollinger) | SPX500 | 1h | 398 | 5 | 0.013 | -2.12% | 0.103 | -6.55% | 0.086 | -6.41% | 0.025 | -3.91% | 0.025 | -3.91% |
| Reversão à Média (RSI + Bollinger) | GER40 | 15m | 125 | 4 | 0.032 | 0.55% | 0.784 | -0.01% | 0.672 | -0.38% | 0.104 | -0.98% | 0.104 | -0.98% |
| Reversão à Média (RSI + Bollinger) | GER40 | 1h | 468 | 5 | 0.011 | -2.49% | 0.094 | -4.69% | 0.077 | -1.98% | 0.019 | -2.68% | 0.019 | -2.68% |
| Rompimento Confirmado (Volume) | BTCUSD | 15m | 120 | 266 | 2.217 | -19.47% | 9.426 | -58.34% | 9.142 | -50.52% | 3.684 | -29.34% | 3.334 | -24.48% |
| Rompimento Confirmado (Volume) | BTCUSD | 1h | 365 | 183 | 0.501 | -5.40% | 2.143 | -76.87% | 2.099 | -73.21% | 0.833 | -27.68% | 0.762 | -15.57% |
| Rompimento Confirmado (Volume) | EURUSD | 15m | 132 | 217 | 1.647 | -3.61% | 6.490 | -13.38% | 6.399 | -13.64% | 2.748 | -7.04% | 2.482 | -6.07% |
| Rompimento Confirmado (Volume) | EURUSD | 1h | 401 | 86 | 0.215 | -2.11% | 0.899 | -5.56% | 0.884 | -5.77% | 0.339 | -1.21% | 0.297 | -3.18% |
| Rompimento Confirmado (Volume) | XAUUSD | 15m | 127 | 147 | 1.154 | -2.54% | 5.277 | -16.60% | 5.199 | -19.67% | 1.924 | -8.26% | 1.735 | -8.08% |
| Rompimento Confirmado (Volume) | XAUUSD | 1h | 418 | 73 | 0.175 | 14.09% | 0.644 | 9.45% | 0.639 | 12.44% | 0.268 | 15.97% | 0.242 | 16.49% |
| Rompimento Confirmado (Volume) | XAGUSD | 15m | 134 | 172 | 1.280 | -96.41% | 5.707 | -443.04% | 5.633 | -437.05% | 2.061 | -145.94% | 1.816 | -125.64% |
| Rompimento Confirmado (Volume) | XAGUSD | 1h | 366 | 82 | 0.224 | -38.09% | 0.773 | -142.20% | 0.771 | -147.71% | 0.377 | -56.75% | 0.331 | -61.53% |
| Rompimento Confirmado (Volume) | US30 | 15m | 140 | 185 | 1.326 | -0.70% | 4.407 | -4.73% | 4.349 | -2.12% | 2.150 | -0.03% | 1.920 | 0.55% |
| Rompimento Confirmado (Volume) | US30 | 1h | 478 | 75 | 0.157 | 6.53% | 0.523 | 14.81% | 0.533 | 14.63% | 0.247 | 8.41% | 0.226 | 7.90% |
| Rompimento Confirmado (Volume) | NAS100 | 15m | 140 | 176 | 1.261 | -4.68% | 4.536 | -10.55% | 4.399 | -9.22% | 1.963 | -5.18% | 1.806 | -4.15% |
| Rompimento Confirmado (Volume) | NAS100 | 1h | 477 | 73 | 0.153 | 4.05% | 0.520 | 16.23% | 0.516 | 13.83% | 0.229 | 6.43% | 0.210 | 5.45% |
| Rompimento Confirmado (Volume) | SPX500 | 15m | 127 | 187 | 1.468 | -16.33% | 4.796 | -54.79% | 4.764 | -53.87% | 2.292 | -24.53% | 2.049 | -22.46% |
| Rompimento Confirmado (Volume) | SPX500 | 1h | 398 | 75 | 0.189 | -7.46% | 0.652 | -16.97% | 0.629 | -15.06% | 0.309 | -8.59% | 0.284 | -6.85% |
| Rompimento Confirmado (Volume) | GER40 | 15m | 125 | 136 | 1.088 | -2.53% | 4.584 | -18.91% | 4.512 | -19.28% | 1.792 | -9.15% | 1.568 | -5.63% |
| Rompimento Confirmado (Volume) | GER40 | 1h | 468 | 77 | 0.164 | -6.83% | 0.602 | 2.97% | 0.596 | 2.86% | 0.252 | -1.92% | 0.222 | -0.38% |
| Momentum de Curto Prazo (Scalp) | BTCUSD | 15m | 120 | 157 | 1.308 | 0.63% | 9.134 | -43.14% | 8.942 | -45.15% | 3.775 | -11.13% | 3.225 | -10.30% |
| Momentum de Curto Prazo (Scalp) | BTCUSD | 1h | 365 | 110 | 0.301 | 5.86% | 2.485 | -65.31% | 2.376 | -56.52% | 0.899 | -23.40% | 0.784 | -18.58% |
| Momentum de Curto Prazo (Scalp) | EURUSD | 15m | 132 | 103 | 0.782 | -1.59% | 6.604 | -11.62% | 6.505 | -11.12% | 2.535 | -4.83% | 2.186 | -4.05% |
| Momentum de Curto Prazo (Scalp) | EURUSD | 1h | 401 | 38 | 0.095 | -0.29% | 0.966 | -5.38% | 0.924 | -5.04% | 0.295 | -2.94% | 0.252 | -2.18% |
| Momentum de Curto Prazo (Scalp) | XAUUSD | 15m | 127 | 75 | 0.589 | 3.95% | 5.230 | -11.53% | 5.034 | -9.09% | 1.924 | 1.80% | 1.594 | -0.05% |
| Momentum de Curto Prazo (Scalp) | XAUUSD | 1h | 418 | 42 | 0.101 | 0.25% | 0.692 | 0.85% | 0.673 | 0.32% | 0.254 | 1.47% | 0.218 | 1.84% |
| Momentum de Curto Prazo (Scalp) | XAGUSD | 15m | 134 | 89 | 0.662 | -59.92% | 5.447 | -414.23% | 5.254 | -404.05% | 2.054 | -159.03% | 1.734 | -138.44% |
| Momentum de Curto Prazo (Scalp) | XAGUSD | 1h | 366 | 33 | 0.090 | -13.80% | 0.858 | -195.35% | 0.833 | -194.25% | 0.295 | -73.96% | 0.257 | -58.07% |
| Momentum de Curto Prazo (Scalp) | US30 | 15m | 140 | 81 | 0.580 | -3.01% | 4.629 | -9.18% | 4.457 | -10.06% | 1.755 | -6.21% | 1.498 | -5.09% |
| Momentum de Curto Prazo (Scalp) | US30 | 1h | 478 | 28 | 0.059 | 2.56% | 0.604 | -1.23% | 0.584 | -2.13% | 0.215 | 0.94% | 0.180 | 0.93% |
| Momentum de Curto Prazo (Scalp) | NAS100 | 15m | 140 | 97 | 0.695 | 1.33% | 4.837 | -3.40% | 4.729 | -3.15% | 2.085 | -2.63% | 1.748 | 0.85% |
| Momentum de Curto Prazo (Scalp) | NAS100 | 1h | 477 | 29 | 0.061 | -0.23% | 0.592 | -5.28% | 0.569 | -5.61% | 0.183 | -5.31% | 0.155 | -3.62% |
| Momentum de Curto Prazo (Scalp) | SPX500 | 15m | 127 | 98 | 0.769 | -10.71% | 5.439 | -77.60% | 5.298 | -75.57% | 2.174 | -33.19% | 1.868 | -27.73% |
| Momentum de Curto Prazo (Scalp) | SPX500 | 1h | 398 | 39 | 0.098 | -5.29% | 0.730 | -30.60% | 0.707 | -30.63% | 0.277 | -12.38% | 0.229 | -11.35% |
| Momentum de Curto Prazo (Scalp) | GER40 | 15m | 125 | 62 | 0.496 | -3.00% | 4.816 | -18.96% | 4.704 | -17.39% | 1.736 | -8.63% | 1.448 | -6.35% |
| Momentum de Curto Prazo (Scalp) | GER40 | 1h | 468 | 28 | 0.060 | 0.58% | 0.621 | -5.29% | 0.606 | -4.74% | 0.190 | 4.31% | 0.158 | 0.55% |
