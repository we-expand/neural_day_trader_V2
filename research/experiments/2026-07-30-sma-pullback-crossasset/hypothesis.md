# Hipótese — Cruzamento SMA + pullback: existe configuração viável?

**Data**: 2026-07-30 (sessão da noite) · **Pedido**: Cleber
**Critérios**: [`research/CRITERIA.md`](../../CRITERIA.md)

## Relação com o experimento anterior do mesmo dia

Estende [`2026-07-30-custom-sma-pullback`](../2026-07-30-custom-sma-pullback/RESULTADOS.md)
(sessão da tarde), que testou a mesma regra em 6 meses de BTCUSDT e concluiu,
corretamente, que *"nenhum resultado aqui deve ser tratado como prova de que a
regra não funciona de forma definitiva — só que, nas configurações testadas até
agora, ela perde dinheiro"*.

Este experimento fecha essa lacuna e **corrige uma premissa central daquele**:
o custo de 0,26% usado lá vem de `CostModel.ts` e está ~18x superestimado para
CFD de cripto (ver seção de correção no `verdict.md`). Todas as conclusões da
sessão da tarde que atribuem a falha a "custo de transação" precisam ser lidas
com esse ajuste — e, como o `verdict.md` mostra, a falha **persiste mesmo com o
custo corrigido**, mas por um motivo diferente e mais estrutural.

## Perguntas testadas, em ordem

1. **A regra pedida (SMA 40/100, pullback, stop 60 / alvo 80, 0,01 contrato,
   M1) é viável em BTCUSD?**
   Critério: expectativa líquida positiva com custo real.

2. **Existe algum par (stop, alvo, médias) que a torne viável?**
   Critério: `CRITERIA.md` completo — n≥100, líquido de custo, walk-forward
   com embargo, degradação OOS <30%, DSR ≥95%.

3. **O edge sobrevive ao aumento de escala do stop?**
   Hipótese: se o edge fosse invariante de escala, stops maiores diluiriam o
   custo proporcionalmente e viabilizariam a estratégia.

4. **M5/M15 e pullback de segundo toque melhoram o resultado?**
   Pedido explícito do usuário.

5. **É possível levar a taxa de acerto acima de 80%?**
   Pedido explícito. Testado incluindo razões R:R que produzem acerto alto por
   construção, para medir se o alto acerto carrega edge ou é aritmética.

6. **A razão edge/custo é propriedade do ATIVO ou do SINAL?**
   Teste estrutural cross-asset — BTCUSD, EURUSD, US30, US500.
   **Critério de corte definido ANTES de rodar**: razão de holdout > 1,0 em
   ≥2 ativos independentes, com DSR ≥95% e n ≥100 por ativo.

7. **Um stop dinâmico (trailing/breakeven) resolve as perdas grandes?**
   Pergunta do usuário sobre a configuração de 87,91% de acerto.

## Dados

| Ativo | Fonte | Período | Candles M1 |
|---|---|---|---|
| BTCUSD | Binance (dumps oficiais) | 2021-01-01 → 2026-07-29 | 2.889.007 |
| EURUSD | Dukascopy (feed oficial) | 2023-01-01 → 2026-07-29 | 1.867.680 |
| US30 | Dukascopy | 2023-01-01 → 2026-07-29 | 1.880.640 |
| US500 | Dukascopy | 2023-01-01 → 2026-07-29 | 1.880.640 |

Custo: medido na Pepperstone (spread publicado pela corretora, janela
01–30/04/2026), mesma fonte e mesma janela para os 4 ativos.

## Escala da busca

**6.000+ configurações** testadas ao todo: 900 (grid inicial M1) + 750 (região
viável) + 1.050 (re-custo) + 1.600 (M5/M15 + segundo toque) + 4 (cross-asset) +
5 (trailing) + 5 (variações de pullback iniciais). O `N` acumulado é usado no
Deflated Sharpe para corrigir seleção — não é decorativo.

## Resultado

Ver [`verdict.md`](./verdict.md). **Resumo: reprovado em todas as 7 perguntas**,
com a nº 6 fornecendo a explicação estrutural que encerra a linha de busca.
