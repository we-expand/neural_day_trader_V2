# Critério de Aprovação — Pesquisa Quant (Score/fatores/pesos)

**Status**: proposto nesta sessão (2026-07-18), a partir do documento [`RISK_MANAGEMENT_STRATEGY.md`](../RISK_MANAGEMENT_STRATEGY.md), seção 2. Rege qualquer mudança em `MarketScoreEngine.ts` (pesos/fatores) ou em regras de risco que afetem enforcement automático. Nada entra em produto sem passar por aqui.

## Regra de processo

Mudança em `MarketScoreEngine.ts` (pesos/fatores) ou em regras de enforcement de risco só nasce em `research/experiments/`. Só vira código de produto se aprovada pelos critérios abaixo. **Nunca mais "parece melhor no dashboard, vamos commitar"** — essa foi a causa raiz de reversões documentadas em `CLAUDE.md` (ex: tentativa de expandir a faixa do score via tanh gain, revertida na hora pelo `MarketScoreValidator`).

## Critérios mínimos para promoção (`experiments/` → `promoted/` → produto)

| Critério | Piso mínimo | Motivo |
|---|---|---|
| Tamanho de amostra | **≥100 sinais** (32 é insuficiente — já documentado em sessão anterior) | Amostra de 32 tem erro padrão grande demais para distinguir edge real de ruído |
| Métrica | **Líquida de custo** (spread + comissão + slippage via [`CostModel.ts`](./CostModel.ts)), nunca retorno bruto | Retorno bruto infla o edge; CFD já embute spread do market maker |
| Intervalo de confiança | Reportar IC 95% (ou teste de hipótese equivalente) sobre a taxa de acerto/retorno médio | Sem IC, "81% de acerto" não diz se é edge ou sorte de amostra pequena |
| Degradação máxima fora da amostra | Se o retorno out-of-sample cair mais de **30% relativo** ao in-sample, reverter — não recalibrar no mesmo dado | Recalibrar contra o mesmo teste é overfitting disfarçado de validação |
| Prazo de validade do resultado | Reavaliar a cada **60 dias corridos** ou a cada 200 sinais novos (o que vier primeiro) | Edge de mercado decai; um resultado de 2026-07 não vale para sempre |
| Walk-forward, sem look-ahead | Obrigatório via `MarketScoreValidator.ts` (já existe, não recriar) | Já é a metodologia usada; qualquer experimento novo deve rodar por aqui antes de ir a produto |

## Fluxo

```
research/experiments/YYYY-MM-DD-nome-do-experimento/
  hypothesis.md   ← o que se testa, por quê, critério de sucesso ANTES de rodar (não depois)
  results.json    ← saída bruta do MarketScoreValidator
  verdict.md      ← aprovado/rejeitado + justificativa, citando os critérios desta tabela
```

Se aprovado: mover o resumo (não o código) para `research/promoted/`, com link para o commit real que aplicou a mudança em produto — rastreabilidade de o que passou e quando.

## Fora de escopo desta tabela

Regras de **enforcement de risco puro** (daily loss limit, position sizing, cooldown) não passam por aqui — não são "sinal preditivo", são limites mecânicos. Essas seguem a spec em [`RISK_MODULE_SPEC.md`](./RISK_MODULE_SPEC.md), que já define os próprios limiares (FTMO/Topstep) como referência, sem precisar de validação estatística caso a caso.
