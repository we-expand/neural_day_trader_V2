# Re-medição da seção 14.3 com o custo de cripto CFD corrigido (2026-08-02)

Resultado consolidado na **seção 14.7** do `research/AI_BRAIN_SPEC.md`.
Saída bruta em [`results.json`](./results.json).

Reproduzir (de qualquer diretório dentro do repo):

```bash
npx esbuild research/experiments/2026-08-02-cost-correction-remeasure/remeasure.ts \
  --bundle --platform=node --format=esm --outfile=/tmp/remeasure.mjs && node /tmp/remeasure.mjs
```

## Pergunta

O teste executável de 2026-07-30 (Donchian 20/10, BTCUSDT, contrato 0,01 BTC)
registrou 15m pooled −US$1.447,73 e 1h pooled −US$73,55. Ele rodou com
`CostModel.ts` cobrando **0,26%** de round-trip, medido depois como ~8,9x o custo
real de cripto CFD (**0,0291%**). O excesso de custo cobrado é da mesma ordem de
grandeza dos prejuízos registrados — então **o sinal daqueles resultados era
indeterminado sem re-medir**.

## Método: medição, não estimativa

Sem re-execução e sem rede. O `output.json` do experimento original guardou cada
trade com `entryPrice` e `grossProfitPercent` — o retorno **bruto**, antes de
qualquer custo. Reaplica-se o custo novo sobre os mesmos trades:

```
netProfitPercent = grossProfitPercent − custoRoundTripPercent
profitUsd        = netProfitPercent/100 × entryPrice × 0,01 BTC
```

O conjunto de trades é idêntico: a regra de entrada (rompimento de Donchian) não
consulta o custo, então nenhuma entrada aparece ou some. Muda só o desconto.

**Trava de fidelidade**: antes de reportar o número novo, o script reconstrói o
resultado **antigo** a partir do bruto com o custo antigo e compara contra o que
está gravado no `output.json`. Bateu em Δ US$0,0000 nos dois timeframes. Se não
batesse, o script abortaria sem reportar nada.

## Resultado

| | n | @0,26% | @0,0291% | Sharpe | DSR |
|---|---:|---:|---:|---:|---:|
| 15m pooled | 615 | −US$1.447,73 | −US$219,78 | −0,056 | 8,2% |
| 1h pooled | 133 | −US$73,55 | **+US$197,94** | 0,056 | 73,8% |
| 1h SHORT | 70 | +US$186,65 | +US$328,24 | 0,144 | 88,3% |

O script também calcula o poder estatístico das amostras da seção 14 (mesma
fórmula do Gate 2 de `2026-08-02-viability-gates`): entre **6,7% e 29,1%** —
nenhuma tinha poder para decidir.

## ⚠️ Leitura correta

**Isto não é evidência de edge.** Nenhum resultado passa o piso de 95% de DSR do
`CRITERIA.md`; re-pontuar o mesmo holdout não é teste novo; e a virada de sinal
em 1h ocorre numa amostra com 7,4% de poder — indistinguível de ruído.

O que a re-medição estabelece é mais modesto e mais útil: os veredictos empíricos
da seção 14 passam de **"medido como negativo"** para **"nunca foi medido com
poder suficiente"**. Abre a pergunta; não a responde.

O argumento matemático da seção 14.2 (teorema da parada opcional) **não é afetado
por nada disto** — ele opera sobre EV bruto, antes de custo, e continua refutando
a priori a classe "testar stop X com alvo Y".
