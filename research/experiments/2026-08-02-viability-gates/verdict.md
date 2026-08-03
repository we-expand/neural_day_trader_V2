# Veredito — Gates de viabilidade (2026-08-02)

Execução: `node scripts/gates.mjs` · saída bruta em [`results/gates-output.json`](./results/gates-output.json)

Dado real medido ao vivo: 999 retornos diários da Binance (2023-11-08 → 2026-08-01),
7 pares da cesta da seção 11.13. Nenhum valor fabricado — custos vêm de medição
de terceiros com fonte declarada, `σ` e correlações são calculados do dado baixado.

---

## 1. O achado que reordena tudo: o custo do `CostModel.ts` distorce o gate

| fonte de custo | c round-trip | k necessário p/ Sharpe 1,0 | vs. k empírico | Sharpe teto | t* |
|---|---:|---:|---:|---:|---:|
| **CostModel.ts atual** ⚠️ | 0,2600% | 0,1483 | **4,39x** | **0,05** | 38,6d |
| Cripto CFD medido | 0,0145% | 0,0350 | 1,04x | **0,93** | 2,9h |
| Cripto CFD medido (conservador) | 0,0291% | 0,0496 | 1,47x | 0,46 | 11,6h |
| Forex major CFD (EURUSD) | 0,0129% | 0,0330 | 0,98x | 1,05 | 2,3h |
| Índice CFD (US500) | 0,0133% | 0,0336 | 0,99x | 1,01 | 2,4h |
| Índice CFD (US30) | 0,0091% | 0,0277 | 0,82x | **1,49** | 1,1h |

`k` = edge bruto por trade = Sharpe bruto por trade (identidade derivada no
cabeçalho do script). Âncora empírica `k = 0,0338`, derivada da única medição de
n grande do projeto (BTCUSD, n=202.075, z=+16,38 — HANDOFF de 2026-07-30).

**Leitura**: com o custo que o `CostModel.ts` usa hoje, seria preciso um sinal
**4,4x mais forte** que o melhor já medido no projeto — regra que reprova
qualquer coisa. Com o custo **realmente medido**, o mesmo edge empírico chega a
Sharpe teto entre 0,46 e 1,49 dependendo da classe. A diferença entre "inviável"
e "na fronteira do viável" é inteiramente o parâmetro de custo errado.

⚠️ **Ação pendente confirmada em aberto**: `research/CostModel.ts` linha 48 ainda
tem `CRYPTO: { commissionPercent: 0.08, slippagePoints: 0.05 }` = 0,26% round-trip.
A task de correção citada no HANDOFF (`task_d4fc7a53`) **não foi aplicada ao código**.

---

## 2. Gate 3 — N efetivo: o diagnóstico do CLAUDE.md confirmado numericamente

Matriz de correlação real (log-returns diários, 999 obs):

```
correlação média entre pares : 0,687
autovalores                  : 5,14 · 0,55 · 0,37 · 0,30 · 0,25 · 0,22 · 0,17
N nominal                    : 7
N efetivo (participation)    : 1,81
N efetivo (corr. média)      : 1,37
```

O primeiro autovalor carrega 73% da variância — a cesta é essencialmente
**um fator (beta de cripto) mais ruído**. O `~1,5 apostas independentes`
registrado no CLAUDE.md estava correto; agora tem número: **1,81**.

❌ **REPROVA** o mínimo de 8 apostas independentes.

---

## 3. Gate 2 — poder: os testes das seções 11.5→11.11 eram incapazes de decidir

Detectar Sharpe por trade de 0,0338 com α=5% e poder 80% exige
**5.412 trades independentes** — ou **20.932 trades brutos** na cesta cripto,
aplicado o desconto de independência medido (N_eff/N = 0,259).

| cenário | n | N_eff | poder realizado | |
|---|---:|---:|---:|:--:|
| holdout das seções 11.5-11.9 | 20 | 5 | **5,8%** | ❌ |
| pooled forex 7 pares (11.10) | 92 | 24 | **6,9%** | ❌ |
| pooled 10 anos (11.11) | 322 | 83 | **9,1%** | ❌ |
| cross-asset BTCUSD (2026-07-30) | 202.075 | 52.243 | **100,0%** | ✅ |

**Este é o resultado mais importante do experimento.** Com poder de 6–9%, um
edge verdadeiro de k=0,0338 sairia "não significativo" em ~92% das execuções.
Os veredictos negativos das seções 11.5→11.11 são **indeterminados por
construção**, não evidência de ausência de edge.

A validação cruzada é elegante: o **único** teste do projeto com poder adequado
(n=202k, 2026-07-30) foi o **único que encontrou edge** (z=+16,38). O framework
prevê exatamente o histórico observado.

---

## 4. Consequência que inverte a recomendação de holding period

Poder estatístico se acumula por trade, não por ano de calendário. Com
N_eff = 1,81 na cesta cripto e o alvo de 5.412 trades independentes:

| holding | trades/ano/ativo | n_efetivo/ano | anos para poder 80% |
|---|---:|---:|---:|
| ~3h (t* medido) | ~3.000 | ~5.430 | **~1 ano** |
| 1 dia | ~250 | ~452 | **~12 anos** |
| 1 semana | ~50 | ~90 | **~60 anos** |

**Swing/diário é estatisticamente inalcançável nesta cesta** — não por falta de
edge, por falta de amostra dentro de uma vida útil de pesquisa. Intraday é a
única região onde a prova é obtenível em tempo razoável, e o custo real (não o
do `CostModel.ts`) não a inviabiliza.

---

## 5. A região não testada que a aritmética aponta

O experimento de 2026-07-30 operou com stop de 60 pontos ≈ **42 minutos** de
holding efetivo (derivado: 60/108.830 = 0,055% do preço; com σ=47,3% anual,
σ√t = 0,055% → t ≈ 42 min). O `t*` que a fórmula aponta é **~2,9h**.

Nesse holding, o custo relativo cai de 26% do movimento (42 min) para 1,7%
(2,9h) — e o mesmo `k` empírico produziria Sharpe anual ~0,93 em vez de negativo.

⚠️ **Isto NÃO é previsão de resultado, e não deve ser lido como tal.** O HANDOFF
mediu que o edge **decai** com o tamanho do stop (vira negativo a partir de 446
pontos ≈ 39h de holding). Como o Sharpe escala com `k²`, se `k(2,9h)` for metade
de `k(42min)`, o Sharpe teto cai de 0,93 para 0,24. **A curva `k(t)` nunca foi
medida** — só os dois extremos (positivo em 42min, negativo em 39h).

**O próximo experimento decisivo é medir `k(t)`**, não testar mais uma estratégia.
É barato (o dataset M1 e o motor já existem em
`2026-07-30-sma-pullback-crossasset/scripts/`), é uma única hipótese (não 106),
e o resultado é binário: ou existe uma janela de holding onde `k(t)` cai mais
devagar que o custo dilui, ou não existe e a família de sinais fecha com base
estrutural — desta vez com poder estatístico para sustentar a afirmação.

---

## 6. Protocolo de uso

Antes de qualquer backtest futuro, rodar `node scripts/gates.mjs` e exigir:

1. **Gate 1** — `k_req / k_emp ≤ 1,0`. Acima disso, está pedindo sinal mais forte
   que tudo que o projeto já mediu.
2. **Gate 2** — poder ≥ 50%. Abaixo, o teste não decide nada e não deve ser rodado.
3. **Gate 3** — `N_eff ≥ 8`, ou aceitar explicitamente o custo em tempo da tabela
   da seção 4.

Aplicado retroativamente, este protocolo teria reprovado as seções 11.5→11.11
antes de escrever a primeira linha de estratégia.
