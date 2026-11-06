# Order Blocks de janela curta (as linhas do gráfico) — as zonas reagem?
Declarado ANTES de rodar.
- Zonas: `analyzeSmc` (mesmo smc.ts do gráfico/motor) sobre janela de 200 candles fechados, orderBlocks não mitigados.
  Recalculadas a cada 6 candles; janela termina sempre em candle já fechado (sem look-ahead).
- Bullish OB = suporte, bearish OB = resistência. Evento: 1º toque da zona (candle vem de fora, a mínima/máxima entra
  na zona, fecha sem atravessá-la). Entrada no fechamento do candle de toque. Variante B exige candle de rejeição (fecha a favor).
- Teste principal: QUICAR (LONG no suporte, SHORT na resistência). Controle: lado oposto (rompimento) com os mesmos números.
- Stop: além da borda distante da zona + 0,1 ATR14. Alvos: 1R, 2R, e 0,25% fixo. Timeout 36 candles. Empate na vela = stop.
- Custo round-trip: BTC 0,08%, ETH 0,10%. 1 trade por vez por ativo. 5m e 15m. BTCUSDT/ETHUSDT, 2 anos (Binance).
- Critério: E[R] líquido > 0 com t > 2 e sinal estável nos 2 anos; e só vale se o quicar bater o controle. Senão, sem edge.
