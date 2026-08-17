# Movimento típico REAL de 1m vs. custo round-trip — medição 2026-08-16

Dado real (Binance/MetaAPI conta de plataforma), ver `../data/*.json` e `fetch_candles.mjs`.
ATR(14) calculado sobre cada barra de 1m; "mediana" e "p25" são a distribuição inteira da série, não um valor instantâneo isolado.

| Ativo | n barras | ATR mediana (%preço) | ATR p25 (%preço) | Custo round-trip (%) | Custo/ATR mediana | Custo/ATR p25 |
|---|---|---|---|---|---|---|
| BTCUSD | 14387 | 0.0165% | 0.0061% | 0.0291% | 176.5% | 477.8% |
| XBNUSD | 14387 | 0.0165% | 0.0061% | 0.0291% | 176.5% | 477.8% |
| EURUSD | 1415 | 0.0073% | 0.0056% | 0.0121% | 165.3% | 217.1% |
| XAUUSD | 1259 | 0.0369% | 0.0296% | 0.0078% | 21.0% | 26.3% |
| GER40 | 1146 | 0.0184% | 0.0119% | 0.0340% | 184.7% | 285.3% |
| SPX500 | 1359 | 0.0080% | 0.0060% | 0.1154% | 1443.9% | 1912.5% |

Limiares do gate: FRONTEIRA=7%, INVIAVEL=12% (razão custo/movimento).
