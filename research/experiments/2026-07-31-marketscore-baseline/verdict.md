# Veredito — baseline do Market Score (2026-07-31)

**Executado em 2026-07-31.** Dado: Binance pública, 7 criptos × 3 timeframes,
`forwardBars=8`, walk-forward sem look-ahead, n = 3.352 barras avaliadas por
ativo. Saída bruta: [`results.json`](results.json). Desenho e critérios
pré-registrados: [`hypothesis.md`](hypothesis.md).

---

## Resultado contra os 4 critérios pré-registrados

| # | Critério | Resultado | Veredito |
|---|---|---|---|
| 1 | Hit rate > 50%, p < 0,00238 (Bonferroni, 21 testes) | **Pooled 46,12%** (n=1.340) — **abaixo** de 50%. Só **1 de 21** combinações passa | ❌ **FALHA** |
| 2 | Efeito presente em compra **e** venda | Pooled compra 45,1% (n=677), venda 47,2% (n=663) — ambos abaixo de 50% | ❌ **FALHA** |
| 3 | Retorno de convicção > custo round-trip (0,260%) | **netEdge médio −0,666%**; só **5 de 20** combos positivos | ❌ **FALHA** |
| 4 | ≥ 30 leituras de convicção | 20 de 21 combos conclusivos (só SOLUSDT 15m com n=23) | ✅ OK |

**Correlação de Pearson score ↔ retorno futuro: entre −0,098 e +0,051**, dispersa
em torno de zero nas 20 combinações. É a assinatura de ausência de sinal, não de
sinal fraco.

**Conclusão principal: o Market Score não carrega informação direcional
generalizável.** Isto era o esperado (declarado na `hypothesis.md` antes de
rodar) e é consistente com as seções 11.5→11.15 — o score é composição de
fatores da mesma família que já falharam individualmente.

---

## O que este experimento NÃO mediu (limite de escopo, para não superinterpretar)

O uso do score **em produção hoje** (`useApexLogic.ts:1397`) **não é previsão de
direção**: ele descarta setups quando o regime está LATERAL e a confiança da
estratégia é baixa. Isso é um **veto**, e o veto tem uma métrica diferente —
"os trades recusados teriam perdido dinheiro?".

Este experimento **refuta o score como preditor direcional** e **não diz nada**
sobre seu valor como veto. Medir o veto exige registro das decisões recusadas —
que é exatamente o Bloco A (memória persistente) do `AI_COGNITIVE_SPEC.md`, e
hoje não existe. **Não usar este resultado para remover o gate atual.**

---

## A anomalia BTCUSDT — a única coisa que sobrevive, e o cuidado que ela exige

Uma combinação passa **todos** os 4 critérios:

| Ativo/TF | Convicção n | Hit total | Compra | Venda | p | netEdge (líq. de 0,26%) |
|---|---|---|---|---|---|---|
| **BTCUSDT 4h** | 88 | **68,2%** | 68,8% (n=48) | 67,5% (n=40) | **0,0004** | **+0,390%** |
| BTCUSDT 1h | 90 | 61,1% | 61,3% (n=31) | 61,0% (n=59) | 0,0223 | +0,069% |

BTCUSDT é **o único ativo dos 7 consistente nas duas direções**, nos dois
timeframes viáveis por custo. Nos outros 6, compra e venda vão para lados
opostos de forma errática (ex.: ADAUSDT 1h — compra 17,8%, venda 69,2%).

Em números crus, isto é o **melhor resultado direcional já medido neste
projeto** (o recorde anterior era Donchian cripto, DSR 52%, seção 11.13).

**Por que ainda assim não pode ser chamado de edge:**

1. **Contaminação de calibração, não corrigível por Bonferroni.** Os pesos e
   limiares do `MarketScoreEngine` foram calibrados historicamente **contra
   BTCUSDT** (seções 11.5, 11.13, e os testes de 2026-07-30 são todos
   BTC-centrados). O Bonferroni aplicado aqui corrige as 21 comparações
   **deste** experimento; ele não corrige os graus de liberdade gastos **antes**,
   na escolha dos pesos. O 68,2% pode ser in-sample vazando de calibração
   passada.
2. **Sem holdout.** As 3.352 barras foram usadas inteiras. As seções 11.10→11.11
   já mostraram exatamente este filme: DSR 85,3% que virou 39,3% quando o
   calendário foi estendido.
3. **n = 88** leituras de convicção é pequeno para uma alegação de edge.
4. **A cesta não são 7 evidências.** Correlação 0,7-0,9 entre os pares (seção
   14.4) ⇒ ~1,5 apostas independentes.

**Nota estatística sobre o pooled abaixo de 50%**: os 46,12% dão z = −2,84 *se*
os 7 ativos fossem independentes. Ajustando pelo fator de inflação de variância
da correlação real da cesta (VIF ≈ 4,67), **z = −1,32 — não significativo**.
Ou seja: **não há sinal invertido para explorar**, apenas ausência de sinal.
Registrado explicitamente para que ninguém leia "46%" como "inverta e ganhe".

---

## Ações que decorrem deste resultado

1. **O Bloco B (contexto como veto) do `AI_COGNITIVE_SPEC.md` não deve ser
   construído sobre o score como preditor.** Base honesta: ATR/ADX/spread crus +
   `CostViabilityGate` (que já existe e não depende de previsão).
2. **Teste de holdout específico em BTCUSDT** — único desdobramento que este
   resultado justifica. Desenho obrigatório: janela de treino/teste separada por
   calendário, recalibrando nada; e um teste em ativo fora da cesta cripto para
   ver se o efeito é do score ou do BTC. Se sobreviver, é a primeira reabertura
   legítima do Trilho 2 com evidência, e não por vontade.
3. **Não mexer no gate de produção** (`useApexLogic.ts:1397`) com base neste
   experimento — ver limite de escopo acima.

## Achado colateral (bug real, encontrado ao errar nele)

`research/CostModel.ts` → `estimateCostPercent()` devolve **fração**, não pontos
percentuais, apesar do nome (`0,0013` = 0,13%). Quem converte é o `toNetReturn()`
logo abaixo, com `* 100`.

A primeira execução deste experimento subtraiu custo de **0,0026%** em vez de
**0,26%** — erro de fator 100, que tornava o netEdge otimista em ~0,26 p.p. em
todas as 20 combinações. Corrigido antes de salvar o `results.json` final
(comentário de aviso deixado no `run.ts`).

Isto é a **segunda** vez que a mesma função produz erro de unidade neste projeto
— a primeira foi o bug de custo cripto da seção 11.13. **O nome está errado e é
uma armadilha ativa**: `estimateCostPercent` deveria chamar-se
`estimateCostFraction`, ou passar a devolver pontos percentuais de fato.
Pendência registrada, não corrigida aqui (mudança em `CostModel.ts` afeta os
scripts de pesquisa de todas as seções 11.x e exigiria revalidar cada um).
