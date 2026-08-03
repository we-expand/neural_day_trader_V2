# Hipótese — Gates de viabilidade como triagem pré-backtest (2026-08-02)

## Pergunta

As seções 11.5→11.15 do `AI_BRAIN_SPEC.md` gastaram ~26 dias em 15
sub-investigações e concluíram "sem edge comprovado". A pergunta deste
experimento não é *se existe edge* — é **se aqueles desenhos experimentais
eram sequer capazes de detectar um edge, caso existisse**.

Se a resposta for não, os veredictos negativos são indeterminados, não
conclusivos, e a leitura registrada no CLAUDE.md precisa de ressalva.

## Método

Três gates puramente aritméticos, computáveis em segundos, sem escrever
nenhuma estratégia:

**Gate 1 — Aritmética de custo.** Derivação (no cabeçalho de `scripts/gates.mjs`):
com `k` = edge bruto por trade (identicamente o Sharpe bruto por trade),
`σ` = volatilidade anualizada, `c` = custo round-trip, `t` = holding em anos:

```
Sharpe anual = k/√t − c/(σt)     →     t* = 4c²/(k²σ²)     Sharpe_max = k²σ/(4c)
```

Uso honesto: inverter para `k_req = √(4·c·S_alvo/σ)` e comparar com o `k`
empírico já medido no projeto. Se o gate exige sinal mais forte que o melhor
já encontrado, a região é inviável antes de qualquer teste.

**Gate 2 — Poder estatístico.** `n ≈ (z_α + z_β)²/S²`. Se o poder realizado do
desenho for baixo, um resultado "não significativo" não carrega informação.

**Gate 3 — N efetivo.** Participation ratio dos autovalores da matriz de
correlação, `(Σλ)²/Σλ²`, mais a fórmula clássica `N/(1+(N−1)ρ̄)`. Mede quantas
apostas independentes a cesta realmente contém.

## Disciplina de dado

Convenção do projeto (nunca fabricar): `σ` e correlações são medidos ao vivo
de klines reais da Binance; custos vêm de medições de terceiros com fonte e
data declaradas no código; `k` é derivado da única medição de n grande do
projeto (BTCUSD, n=202.075). Onde falta fonte real, o script reporta
INDISPONÍVEL e exclui o ativo, nunca estima.

## Critério de corte, fixado antes de rodar

- Gate 1 passa se `k_req/k_emp ≤ 1,0`
- Gate 2 passa se poder realizado ≥ 50%
- Gate 3 passa se `N_eff ≥ 8`

## Limitação declarada

As fórmulas do Gate 1 assumem `k` constante em `t`. O experimento de
2026-07-30 mediu o contrário (edge decai com o stop). Portanto `t*` é
**diagnóstico de onde procurar**, nunca recomendação de holding period — e o
próprio veredito aponta medir `k(t)` como o experimento seguinte.

Resultado em [`verdict.md`](./verdict.md).
