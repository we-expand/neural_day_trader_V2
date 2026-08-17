# Amplitude de portfólio (item c) — quanto de frequência a cesta completa daria

Reusa `2026-08-05-taxa-base/results/taxa_base.json` (mesmo motor de produção,
mesmos presets, sem alteração, custo real) — não é busca de edge nova, é soma
de trades/dia entre combos já medidos, simulando o que "amplitude" (item 1 do
plano de 5 frentes) daria SE o produto permitisse múltiplos presets/ativos
simultâneos (hoje só permite 1 preset por vez).

## A) Um preset por vez, soma nos 9 símbolos da cesta — o que dá pra ligar HOJE

| Preset | TF | Trades/dia (soma 9 símbolos) | Líq total % (soma) |
|---|---|---:|---:|
| Rompimento de Canal (Donchian) | 5m | 19.15 | -46.5% |
| Cruzamento de Médias com Filtro de Regime | 5m | 9.26 | -19.0% |
| Reversão à Média (RSI + Bollinger) | 5m | 1.79 | -1.8% |
| Rompimento Confirmado (Volume) | 5m | 45.90 | -70.9% |
| Momentum de Curto Prazo (Scalp) | 5m | 23.92 | -35.3% |
| Rompimento de Canal (Donchian) | 15m | 6.10 | -83.0% |
| Cruzamento de Médias com Filtro de Regime | 15m | 2.51 | -23.9% |
| Reversão à Média (RSI + Bollinger) | 15m | 0.42 | -2.5% |
| Rompimento Confirmado (Volume) | 15m | 13.66 | -71.8% |
| Momentum de Curto Prazo (Scalp) | 15m | 7.19 | -23.1% |
| Rompimento de Canal (Donchian) | 1h | 1.11 | 13.7% |
| Cruzamento de Médias com Filtro de Regime | 1h | 0.52 | 20.5% |
| Reversão à Média (RSI + Bollinger) | 1h | 0.15 | -13.0% |
| Rompimento Confirmado (Volume) | 1h | 2.28 | 4.3% |
| Momentum de Curto Prazo (Scalp) | 1h | 1.17 | 13.6% |

## B) Todos os 5 presets simultâneos (multi-setup hipotético, item 1 não implementado)

| TF | Combos | Trades/dia (soma) | Líq total % (soma) | Combos negativos |
|---|---:|---:|---:|---:|
| 5m | 45 | 100.02 | -173.5% | 39/45 |
| 15m | 45 | 29.88 | -204.3% | 32/45 |
| 1h | 45 | 5.22 | 39.0% | 22/45 |

## C) Teto otimista: só combos historicamente positivos (seleção pós-hoc, SEM holdout — não é recomendação de portfólio)

| TF | Combos positivos (n≥5 trades) | Trades/dia (soma) | Líq total % (soma) |
|---|---:|---:|---:|
| 5m | 6/45 | 3.10 | 8.5% |
| 15m | 11/45 | 5.68 | 17.4% |
| 1h | 22/45 | 2.37 | 176.2% |
