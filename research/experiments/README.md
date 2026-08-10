# research/experiments/

Cada experimento de calibração (pesos do `MarketScoreEngine.ts`, limiares de convicção, regras de enforcement testáveis) vira uma pasta aqui, nunca direto em produto. Ver processo completo em [`../CRITERIA.md`](../CRITERIA.md).

```
YYYY-MM-DD-nome-do-experimento/
  hypothesis.md   ← escrito ANTES de rodar: o que se testa, por quê, critério de sucesso
  results.json    ← saída bruta do MarketScoreValidator.ts
  verdict.md      ← aprovado/rejeitado, citando os critérios de CRITERIA.md
```

**Estado (atualizado 2026-07-31)**: 16 experimentos rodados. Os 15 primeiros
(2026-07-24 a 2026-07-30) testam arquétipos de estratégia e estão sumarizados no
`AI_BRAIN_SPEC.md` seções 11.x-14. O 16º
(`2026-07-31-marketscore-baseline/`) é o **primeiro a medir o Market Score em
si** — o alvo original deste processo — e é o único que segue o formato de 3
arquivos acima à risca.
