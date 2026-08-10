# Sessão 2026-08-02 (2ª) — Correção do custo de cripto + revisão da seção 14

> **Continuação direta de [`SESSAO_2026-08-02_GATES_VIABILIDADE.md`](SESSAO_2026-08-02_GATES_VIABILIDADE.md).**
> Aquela sessão *diagnosticou*; esta *aplicou* as duas primeiras correções.
>
> **Ponto de entrada para retomar**: este arquivo + a **seção 14.7** do
> [`research/AI_BRAIN_SPEC.md`](research/AI_BRAIN_SPEC.md). Não é preciso reler a
> conversa nem o handoff anterior — o que sobrou dele está resumido em
> "Pendências" no fim.
>
> ✅ Tudo desta sessão está **commitado e com árvore limpa**. Nada pendente de commit.

## O que esta sessão fez

Duas das sete pendências do handoff anterior, nesta ordem:

1. **Pendência #1 — corrigir `CostModel.ts`** (commit `dcb8a3a7b`)
2. **Pendência sobre a seção 14** — a spec ainda documentava o custo errado como
   fato corrente (commit `f6b70cba7`)

A pendência #2 original (ressalvar as seções **11.5→11.11**) **NÃO foi tocada** —
continua esperando aprovação do Cleber.

---

## Parte 1 — `CostModel.ts`, classe CRYPTO (commit `dcb8a3a7b`)

### O que estava errado

`COST_TABLE.CRYPTO` tinha `commissionPercent: 0.08` — número compatível com taxa
de **exchange spot** (Binance/Coinbase), não com **CFD**, onde não existe comissão
separada, só spread. Somado a `slippagePoints: 0.05`, dava **0,26% round-trip**.

### O que ficou

| | antes | depois |
|---|---|---|
| `commissionPercent` | 0,08% | **0** |
| `spreadPoints` (por perna, %) | 0 | 0,00727% |
| `slippagePoints` (por perna, %) | 0,05% | 0,00727% |
| **round-trip** | **0,26%** | **0,0291%** |

Base: Pepperstone, BTCUSD, spread médio 15,82 USD sobre preço 108.829,77, janela
01–30/04/2026 (`2026-07-30-sma-pullback-crossasset/HANDOFF.md`, achado #1).

**Detalhe de modelagem que importa**: o spread é pago **uma vez** no ciclo completo
(entra no ask, sai no bid), então o custo *por perna* é metade do spread medido —
daí `15,82/108.829,77 ÷ 2`. A `COST_TABLE` inteira segue a convenção "valor por
perna, dobrado por `toNetReturn`"; só CRYPTO estava fora de calibração (FOREX_MAJOR
confere: 1,4 pip round-trip, idêntico à medição Pepperstone do `gates.mjs`).

### ⚠️ Escolha de julgamento feita — reversível em uma linha

Usada a leitura **conservadora** (0,0291%), não a otimista (0,0145%). Não existe
medição de slippage de cripto CFD neste projeto — só de spread. Foi reservado um
spread inteiro adicional como provisão, marcada no código como **não medida**.

Razão: o número alimenta um gate que decide entrada com dinheiro real. Errar caro
recusa trade viável (custo mensurável); errar barato aprova trade inviável (perda
direta). Zerar `CRYPTO_CFD_SLIPPAGE_PER_LEG_PERCENT` reproduz a leitura otimista.

### Consequência comportamental em produção

**Para cripto, o gate de custo deixa de morder em timeframe intradiário.** Os 4
timeframes de BTCUSDT passam a `VIAVEL` (razões custo/movimento 2,8% / 1,2% /
0,6% / 0,2%). Só volta a reprovar cripto com ATR abaixo de **~0,415% do preço**
(regime muito parado).

**Não ficou vacuoso**: forex e índice não tiveram custo alterado. EURUSD 15m
continua reprovado (custo 0,0129% vs ATR ~0,037% = 35% do movimento) — travado
em teste de propósito, para provar que a correção é específica de cripto.

### Arquivos tocados

- `research/CostModel.ts` — constantes novas com procedência, `COST_TABLE.CRYPTO`
- `src/app/services/risk/CostViabilityGate.ts` — cabeçalho reescrito; default de
  `evaluateCostViabilityForBTCUSDT` agora vem do `CostModel` (fonte única);
  exportada `LEGACY_CRYPTO_ROUND_TRIP_COST_PERCENT` só para os testes
- `src/app/services/risk/__validate__.ts` — 11 → **25 asserções**
- `2026-07-31-btc-holdout/run.ts` e `2026-07-31-marketscore-baseline/run.ts` — só
  comentários (ver armadilha abaixo)

### 🪤 Armadilha registrada

Esses dois scripts de experimento **derivam** o custo de `estimateCostPercent()`
em vez de hardcodar. Re-rodá-los agora usa o valor novo e **não reproduz** os
números registrados em 31/07. Avisado no comentário dos dois.

---

## Parte 2 — Revisão da seção 14 (commit `f6b70cba7`)

### Como foi medido (não estimado)

O `output.json` do experimento de 30/07 guardou **cada trade individual** com
`entryPrice` e `grossProfitPercent` — retorno **antes** de custo. Como a regra de
entrada (rompimento Donchian) não consulta o custo, o conjunto de trades é
idêntico sob qualquer custo: só muda o desconto. Logo, reaplicar o custo novo é
recomputação exata, sem re-execução e sem rede.

**Trava de fidelidade**: o script reconstrói primeiro o resultado **antigo** a
partir do bruto e compara com o gravado. Bateu em **Δ US$0,0000** nos dois
timeframes. Se não batesse, abortaria sem reportar o número novo.

Experimento novo: `research/experiments/2026-08-02-cost-correction-remeasure/`
(`remeasure.ts`, `README.md`, `results.json`).

```bash
npx esbuild research/experiments/2026-08-02-cost-correction-remeasure/remeasure.ts \
  --bundle --platform=node --format=esm --outfile=/tmp/remeasure.mjs && node /tmp/remeasure.mjs
```

### O que caiu

**(a) A tabela 14.3 inteira.** Refeita com o custo corrigido (mesmo MFE medido):

| Timeframe | MFE médio | custo/movimento (antes → depois) | Viável? |
|---|---|---|---|
| 15m | 1,05% | 25% → **2,8%** | ✓ |
| 1h | 2,52% | 10% → **1,2%** | ✓ |
| 4h | ~5% (extrapolado) | ~5% → **0,6%** | ✓✓ |
| Diário | ~12% (extrapolado) | ~2% → **0,24%** | ✓✓ |

A frase central da seção — *"todo teste desta sessão rodou abaixo ou na fronteira
do piso de viabilidade"* — é **falsa** com o custo real. Nenhum rodou abaixo.

**(b) A confirmação executável muda de sinal em 1h:**

| | n | @0,26% | @0,0291% | Sharpe | DSR |
|---|---:|---:|---:|---:|---:|
| 15m LONG | 312 | −US$1.038,70 | −US$408,89 | −0,157 | 0,3% |
| 15m SHORT | 303 | −US$409,03 | **+US$189,12** | 0,021 | 64,1% |
| **15m pooled** | 615 | −US$1.447,73 | **−US$219,78** | −0,056 | 8,2% |
| 1h LONG | 63 | −US$260,20 | −US$130,29 | −0,108 | 19,9% |
| 1h SHORT | 70 | +US$186,65 | +US$328,24 | 0,144 | 88,3% |
| **1h pooled** | 133 | −US$73,55 | **+US$197,94** | 0,056 | 73,8% |

**(c) Nenhuma amostra da seção 14 tinha poder para decidir.** Alvo: 5.412 trades
independentes (k=0,0338, α=5%, poder 80%), com desconto de independência
N_eff/N = 0,259 medido na própria cesta.

| amostra | n | N_eff | poder |
|---|---:|---:|---:|
| diagnóstico MFE/MAE 15m (14.1) | 4.058 | 1.051 | 29,1% ❌ |
| diagnóstico MFE/MAE 1h (14.1) | 973 | 252 | 13,4% ❌ |
| executável 15m pooled (14.3) | 615 | 159 | 11,2% ❌ |
| executável 1h pooled (14.3) | 133 | 34 | 7,4% ❌ |
| executável 1h SHORT (14.3) | 70 | 18 | 6,7% ❌ |

### ⚠️⚠️ O QUE ISTO NÃO AUTORIZA A CONCLUIR — ler antes de qualquer entusiasmo

**Nada disto é evidência de que existe edge.** Três razões, todas vinculantes:

1. **Nenhum resultado passa o piso de 95% de DSR** do `CRITERIA.md`. O melhor
   (1h SHORT, 88,3%) segue abaixo, e também abaixo do piso de 100 sinais.
   A conclusão "nenhum candidato promovido" **sobrevive intacta**.
2. **Re-pontuar o mesmo holdout não é teste novo.** É a mesma amostra re-scorada
   com outro parâmetro — não tem valor probatório de dado inédito.
3. **A virada de sinal em 1h tem 7,4% de poder.** −US$73 → +US$198 numa amostra
   dessas é indistinguível de ruído.

Efeito líquido: os veredictos empíricos da seção 14 passam de **"medido como
negativo"** para **"nunca foi medido com poder suficiente"**. Abre a pergunta;
não a responde.

### O que ficou de pé

- **14.2 (teorema da parada opcional) — intacta, e é o coração da seção.** Opera
  sobre EV **bruto**, antes de custo. A refutação a priori de "vamos testar stop X
  com alvo Y" continua valendo e nada em 14.7 a afrouxa.
  **Distinção nova que a seção original não fazia**: o teorema diz que stop/alvo
  não mudam a *média* — **não** que a média é zero. Essa segunda parte é a
  alegação empírica, e é ela que perdeu sustentação em (c).
- **14.4 — reforçada.** O `~1,5 apostas independentes` virou `N_eff = 1,81` medido.
- **14.5 (decisão do Cleber pela opção B) — de pé e mais defensável.** A
  alternativa (A) precisaria de ~12 anos (diário) a ~60 anos (semanal) de dado
  nesta cesta, contra ~1 ano em holding intradiário de ~3h. Não alterada.
- **A função objetivo sob (B)** segue válida. Mudou a premissa "EV/trade ≈ −C":
  o `C` é ~8,9x menor, mas com edge não comprovado o sinal do EV segue indefinido.

### Detalhe que vale registrar

A própria 14.6 listava *"queda estrutural do custo de transação"* como uma das
condições que reabririam a conclusão. A condição se realizou — não porque o
mercado mudou, mas porque o número estava errado. Marcado lá.

### Arquivos tocados

- `research/AI_BRAIN_SPEC.md` — aviso no topo da seção 14; 14.3 marcada como
  **superada** (números preservados como registro histórico, nunca apagados);
  nota de confirmação em 14.4; **seção 14.7 nova** com tudo acima
- `CLAUDE.md` — o bullet do gate de custo, que carregava 0,26% em toda sessão nova
- `research/experiments/2026-08-02-cost-correction-remeasure/` (novo)

---

## Estado do gate

`npm run validate` → **tudo passou**. Type-check estrito OK (o `remeasure.ts`
novo entra nele via `research/**/*.ts` do `tsconfig.engine.json`).
Suíte do gate de custo: **11 → 25 asserções**.

## Estado do git

Branch `dev`, **árvore limpa**, tudo commitado e pronto pra push se ainda não foi.

```
f6b70cba7  research: revisa seção 14 — custo de 14.3 era 8,9x alto e amostras tinham poder de 6-29%…
dcb8a3a7b  fix: custo de cripto CFD era ~18x alto (0,26% -> 0,0291% round-trip)…
86d23cf2a  research: gates de viabilidade (aritmética/poder/N_eff)…
```

---

## Pendências em aberto (herdadas + atualizadas)

1. **⭐ Medir a curva `k(t)`** — o experimento decisivo, agora o próximo da fila.
   Como o edge bruto por trade varia com o holding period. Só existem dois pontos:
   positivo em ~42 min (stop de 60 pts, teste de 30/07) e negativo em ~39h (stop
   de 446 pts). O `t*` da aritmética aponta **~2,9h**, região nunca medida.
   **Por que é o teste certo**: hipótese única (sem penalidade de DSR por busca
   ampla), barata (dataset M1 e motor em numba já existem em
   `2026-07-30-sma-pullback-crossasset/scripts/`), resultado binário.
   ⚠️ Não é previsão: se `k(2,9h)` for metade de `k(42min)`, o Sharpe teto cai de
   0,93 para 0,24 (Sharpe escala com `k²`).
2. **⚠️ Ressalvar as seções 11.5→11.11** no `AI_BRAIN_SPEC.md` e no `CLAUDE.md` —
   **ÚNICA pendência do handoff anterior que continua intocada.** Ambos registram
   aqueles resultados como evidência de ausência de edge; o Gate 2 mostrou poder
   de 6-9%. **Espera aprovação do Cleber** por ser reescrita de conclusão
   registrada. *(A parte da seção 14 dessa mesma pendência já foi feita — ver
   Parte 2 acima.)*
3. **README do módulo `predictive-ai`** promete features removidas na Fase 0
   (baleia/spoofing/heatmap) e declara "✅ Completo e Funcional". Risco de
   marketing enganoso + risco de sessão futura confiar nele.
4. **UX dos painéis desativados** (Matriz de Correlação, Força Relativa em
   `LiquidityPrediction.tsx`) — aparecem vazios/cinza, o usuário lê como bug.
   Merecem rótulo explícito de "em construção".
5. **Decisão de produto em aberto (seção 9.1)**: se os Estágios 3/4 da ponte de
   execução (codificados, desligados por padrão) devem algum dia ser habilitados.
   Recomendação registrada: não avançar além do Estágio 2 sem edge comprovado.
6. **Estágios 3/4 e `LiveEmergencyClose.ts` nunca testados em ambiente real** —
   só `npm run validate`. Dívida perigosa: código com poder de execução real sem
   teste de integração.
7. **Re-medir o que rodou com o custo inflado.** Além do teste executável já
   remedido, a **seção 11.13** (cesta cripto, Donchian DSR 52%) e o experimento
   `2026-07-30-custom-sma-pullback` rodaram com 0,26%. Suas conclusões não foram
   revisitadas. ⚠️ Mas o Gate 2 se aplica igual: mesmo remedidos, aqueles
   holdouts não têm poder — remedir só troca um veredicto indeterminado por
   outro. **Provavelmente não vale o esforço antes do `k(t)`.**

## Como retomar

Ler este arquivo + seção 14.7 do `AI_BRAIN_SPEC.md`. Se o próximo passo for o
`k(t)`, o material de partida é `2026-07-30-sma-pullback-crossasset/scripts/`
(dataset M1 + motor numba) e a seção 5 do
`2026-08-02-viability-gates/verdict.md` (derivação do `t*`).

**Antes de rodar qualquer backtest novo**, aplicar o protocolo de 3 gates
(`verdict.md` seção 6): Gate 1 `k_req/k_emp ≤ 1,0`; Gate 2 poder ≥ 50%; Gate 3
`N_eff ≥ 8` ou aceite explícito do custo em tempo. ⚠️ A cesta cripto **reprova
o Gate 3** (N_eff 1,81) — qualquer experimento nela exige o aceite explícito.
