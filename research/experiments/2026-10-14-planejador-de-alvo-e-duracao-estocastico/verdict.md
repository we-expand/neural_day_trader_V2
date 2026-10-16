# Veredito (2026-10-14): planejador de alvo + duração das pernas do estocástico (offline)
Script: study.ts (`CACHE_DIR=... npx tsx study.ts BTCUSDT`). BTC/ETH 2 anos de 5m (Binance); UKOUSD/NAS100/XAUUSD/EURUSD 60 dias (MetaAPI).
## Parte A (alvo dinâmico)
- A ruína do jogador P0 = S/(S+X) já acerta a taxa real do teste: BTC 0,651 real vs 0,667 base (X=0,75), 0,499 vs 0,500 (X=1,5), 0,329 vs 0,333 (X=3).
- Features de faixa do dia, espaço até máxima/mínima do dia, volatilidade e hora (M1): AUC 0,48–0,51, Brier igual ou pior que a base. Em ETH, NAS100 e XAUUSD o modelo piora fora da amostra (IC do ganho inteiro abaixo de zero).
- Somando o estocástico (M2): nada melhora. Únicas exceções: UKOUSD X=1,5 (AUC 0,54, IC [2,5; 11,2]e-4) mas n=728 em 60 dias, sem replicação nos outros ativos → ruído provável.
- Conclusão: com deriva zero, a chance de atingir o alvo antes do stop é basicamente S/(S+X). Mudar o alvo muda a chance na mesma proporção; não cria valor esperado. Resta o custo.
## Parte B (duração do estocástico 5,3,3)
- Só 30–37% das pernas que começam em ≥80 chegam a ≤20; 63–70% revertem antes. Duração (quando chega): mediana 4 candles, p10 2, p90 6 (15m: 30 min a 1h30).
- A probabilidade de chegar ao fundo nos próximos 4 candles dado que a perna já durou t candles fica ~constante (BTC 15m: 29% em t=2, 29% em t=4, 34% em t=6): sem memória, o tempo decorrido não prevê o fim.
- A variação que o Cleber vê (30 min vs 1h30) é real mas está dentro do p10–p90; nas features testadas (1H, inclinação, idade) não achei o que a antecipa.
## O que sobra de útil
- Calculadora determinística (não previsor): espaço até máxima/mínima do dia e S/R em ATR/%, chance base S/(S+X), ganho líquido esperado após custo/tamanho, e checagem de "cabe" — para a mesa ler números prontos. Não gera edge.
