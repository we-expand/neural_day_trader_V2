# Veredito (2026-10-14): Order Blocks de janela curta, primeiro toque, BTC/ETH 5m e 15m, 2 anos
- Só 1º toque por zona; janela de 200 candles; sem look-ahead. Script: run.ts (`MINSTOP=0.003 npx tsx run.ts BTCUSDT 5m`).
- Resultado bruto (sem custo) ≈ 0R em todas as variantes (-0,10 a +0,13R). Quicar ≈ controle (lado oposto): a zona não indica direção.
- Líquido negativo em todas (t entre -5 e -24), exceto ETH 15m com rejeição (n=128, bruto +0,11R, líquido -0,05R, t=-0,6: não significativo).
- Não testado: ativos fora de cripto (UKOUSD, NAS100...), zonas como referência de stop/alvo, ordens bloco com confluência de estocástico/MACD.
- Sem edge comprovado de entrada. Nada foi alterado no motor.

## Rodada 2 (itens 1 e 2): combinações e outros ativos
- run2.ts: toque + estocástico 5,3,3 (≤30/≥70 ou cruzamento) + MACD virando. Custo = spread mediano medido (market_spread_samples).
- BTC/ETH: linha+estoc+MACD é pior que o lado oposto (BTC 5m: quicar -0,14R bruto, oposto +0,14R, n=140). Sem edge.
- UKOUSD/NAS100/XAUUSD/EURUSD (15m 180d, 5m 60d, MetaAPI): só 80–160 toques por teste; combinações com estoc+MACD ficam com n<15 (inconclusivo).
  Quicar toque simples: bruto entre -0,08R e +0,03R; UKOUSD líquido -0,3R (custo 0,106%); nenhum com t>2.
- Conclusão: sem evidência de que o primeiro toque ou a combinação com estoc/MACD dê vantagem. Amostra de não-cripto é pequena.
