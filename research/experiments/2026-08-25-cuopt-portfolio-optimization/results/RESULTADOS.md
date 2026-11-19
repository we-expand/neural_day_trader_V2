# cuOpt Fase A — MILP em CPU (substitui cuOpt NVIDIA, ver CUOPT_API_SCHEMA.md) — resultado (2026-08-25)

Candidatos reais (`evaluateStrategySeries`, presets 2/4/5, dado real de
`2026-08-05-taxa-base/data`, 9 símbolos × 1h). Split: `DataSplit.ts` (3 janelas,
embargo). Custo: `CostModel.ts`. DSR: `DeflatedSharpe.ts`, corrigido pelas 3
estratégias de alocação comparadas.

| Estratégia | Trades | Posições/ciclo (média) | %líq total | %líq médio/trade | Sharpe | DSR |
|---|---:|---:|---:|---:|---:|---:|
| sequencial | 174 | 1.00 | -18.98% | -0.1091% | -0.093 | 1.0% |
| aleatorio | 346 | 1.98 | -35.59% | -0.1028% | -0.078 | 0.1% |
| milp | 412 | 2.36 | -32.85% | -0.0797% | -0.063 | 0.1% |

**Teste de viés de seleção**: `milp` vs `aleatorio` usam a MESMA contagem média
de posições simultâneas (o aleatório recebe o hint do MILP) — se `milp` não bate
`aleatorio` por margem clara, o resultado é "amplitude ajuda, otimização não", não
"MILP tem edge" (ver hypothesis.md).
