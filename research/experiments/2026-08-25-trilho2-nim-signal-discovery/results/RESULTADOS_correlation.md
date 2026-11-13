# Trilho 2 NIM Signal Discovery — backtest das 2 hipóteses de correlação (2026-08-25)

Gerado por `backtest_correlation.ts`. Split: `DataSplit.ts` (3 janelas, embargo,
warmup 200). Custo: `CostModel.ts`. DSR: `DeflatedSharpe.ts`, corrigido pelas 2
hipóteses testadas nesta rodada — não corrige por seleção entre as 5 hipóteses
originais nem por rodadas futuras de Trilho 2.

⚠️ `CorrCrossRegime_5m_BTC`: BTCUSD e XBNUSD vêm da MESMA fonte (Binance
BTCUSDT) neste projeto — resultado abaixo é sobre correlação degenerada
(≈1.0 por construção), não correlação cross-asset real. Ver hypothesis.md.

| Hipótese | Trades treino | Trades holdout | Win% holdout | %líq total holdout | %líq médio/trade | Sharpe holdout | DSR |
|---|---:|---:|---:|---:|---:|---:|---:|
| CorrCrossRegime_5m_BTC | 407 | 190 | 52.1% | -3.94% | -0.0207% | -0.136 | 0.5% |
| CorrCrossRegime_1h_XAGUSD | 143 | 50 | 62.0% | 4.33% | 0.0865% | 0.065 | 53.5% |
