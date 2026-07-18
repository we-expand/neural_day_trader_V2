# research/experiments/

Cada experimento de calibração (pesos do `MarketScoreEngine.ts`, limiares de convicção, regras de enforcement testáveis) vira uma pasta aqui, nunca direto em produto. Ver processo completo em [`../CRITERIA.md`](../CRITERIA.md).

```
YYYY-MM-DD-nome-do-experimento/
  hypothesis.md   ← escrito ANTES de rodar: o que se testa, por quê, critério de sucesso
  results.json    ← saída bruta do MarketScoreValidator.ts
  verdict.md      ← aprovado/rejeitado, citando os critérios de CRITERIA.md
```

Vazio hoje — nenhum experimento formal rodado ainda sob este processo.
