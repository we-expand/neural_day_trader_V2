# Sensibilidade de parâmetros + DSR — arbitragem estatística (item 4, continuação)

Grade: janela ∈ {50,100,150}, entrada-z ∈ {1.5,2,2.5}, saída-z ∈ {0.5,1} (só exitZ<entryZ), stop-z=3.5 e hold-máx=50 fixos = 18 configs por par×tf, 216 backtests no total.
DSR (Deflated Sharpe Ratio, `research/DeflatedSharpe.ts`) aplicado por par×tf usando o número de configs testadas (nTrials) e a variância de Sharpe entre elas — >95% é o piso convencional de "provavelmente real, não seleção".

| Par | TF | Configs válidas (n≥10 trades) | Melhor config (win/entry/exit) | Trades | Sharpe | Líq total % | DSR |
|---|---|---:|---|---:|---:|---:|---:|
| XAUUSD/XAGUSD | 15m | 18 | w=100,e=2.5,x=0.5 | 132 | -0.357 | -18.23% | 0.0% |
| XAUUSD/XAGUSD | 1h | 18 | w=100,e=2,x=1 | 77 | -0.006 | -0.48% | 7.4% |
| US30/SPX500 | 15m | 18 | w=100,e=2,x=0.5 | 193 | -0.297 | -8.87% | 0.0% |
| US30/SPX500 | 1h | 18 | w=150,e=2,x=1 | 31 | 0.221 | 2.10% | 43.4% |
| US30/NAS100 | 15m | 18 | w=150,e=2.5,x=1 | 137 | 0.056 | 2.13% | 26.9% |
| US30/NAS100 | 1h | 18 | w=150,e=2.5,x=0.5 | 58 | 0.167 | 4.41% | 54.6% |
| SPX500/NAS100 | 15m | 18 | w=150,e=1.5,x=0.5 | 180 | -0.533 | -17.16% | 0.0% |
| SPX500/NAS100 | 1h | 18 | w=150,e=1.5,x=1 | 42 | -0.061 | -1.37% | 2.6% |
| GER40/US30 | 15m | 18 | w=100,e=2.5,x=0.5 | 112 | 0.131 | 3.20% | 18.7% |
| GER40/US30 | 1h | 18 | w=150,e=2.5,x=0.5 | 42 | 0.020 | 0.53% | 39.1% |
| GER40/SPX500 | 15m | 18 | w=100,e=2.5,x=0.5 | 101 | -0.146 | -3.09% | 0.0% |
| GER40/SPX500 | 1h | 18 | w=150,e=1.5,x=0.5 | 38 | 0.168 | 5.73% | 48.2% |
