# Sessão 2026-08-02 — Auditoria da IA Preditiva + Gates de viabilidade estatística

> Handoff para retomar em sessão nova. Ler isto + o
> [`verdict.md` do experimento](research/experiments/2026-08-02-viability-gates/verdict.md).
> Não é necessário reler a conversa original.
>
> ⚠️ **Esta sessão produziu achados que CONTRADIZEM conclusões registradas hoje
> no `CLAUDE.md` e no `AI_BRAIN_SPEC.md`.** As correções ainda **não** foram
> aplicadas nesses arquivos — ver "Pendências" no fim.

## Como a sessão começou

Três perguntas do Cleber, em sequência:

1. Como está a área **IA Preditiva & Order Flow** — está 100% funcional?
2. Por que os painéis de correlação/força relativa aparecem vazios (com prints)?
3. Relatório completo do cérebro de IA: o que foi feito e o que falta.

E depois a pergunta central: **qual a forma mais eficiente de obter edge
comprovado?** — que gerou o experimento novo.

---

## Parte 1 — Auditoria da IA Preditiva & Order Flow

**Veredito: funciona corretamente para o que de fato existe hoje; não está
quebrada. Mas a documentação do módulo promete o que foi deliberadamente
removido.**

Componente ativo e roteado em produção: [`App.tsx:263`](src/app/App.tsx:263) →
[`LiquidityPrediction.tsx`](src/app/components/innovation/LiquidityPrediction.tsx).

**Real hoje** (dado verificável, sem fabricação):
- Order book depth via `GET /api/v3/depth` da Binance, refresh 20s, só pares cripto
- Trade grande real via `aggTrades` (≥ US$250k — limiar arbitrário documentado, não calibrado)
- Contagem regressiva de virada de candle e alertas de horário de mercado por relógio real
- Pressão de book via `describeMicrostructure` (só cripto)
- Feed "Previsão Próxima 1h" vem do `MarketScoreEngine` real (ADX/RSI/pivôs reais).
  "SEM DIREÇÃO CLARA — 36%" é leitura honesta de regime sem tendência, **não** placeholder quebrado.

**Desativado de propósito na auditoria Fase 0 (28-29/07), não é bug:**
- Matriz de Correlação — `generateCorrelations()` retorna `[]`
  ([LiquidityPrediction.tsx:64](src/app/components/innovation/LiquidityPrediction.tsx:64)).
  Exigiria histórico de ~300 ativos + cálculo contínuo; nunca foi construída a substituição real.
- Força Relativa (7D) — painel com aviso amarelo explícito
  ([LiquidityPrediction.tsx:793](src/app/components/innovation/LiquidityPrediction.tsx:793))
- ~17 templates de alerta com `Math.random()` (baleia, spoofing, iceberg, RSI fabricado,
  cluster de stops), incluindo um teste sempre-verdadeiro (`currentPrice >= Math.floor(currentPrice)`)
- Heatmap de liquidez gerado com `Math.sin` — não existe mais

**Pendência de UX identificada, não corrigida**: os dois painéis desativados
aparecem simplesmente vazios/cinza, o que o usuário lê como bug. Merecem rótulo
explícito de "em construção".

**Pendência de documentação, não corrigida**:
[`src/app/modules/predictive-ai/README.md`](src/app/modules/predictive-ai/README.md)
ainda descreve baleias, spoofing, heatmap de paredes e declara
`Status: ✅ Completo e Funcional`. Documenta features removidas por serem
fabricadas. Risco de marketing enganoso + risco de sessão futura confiar nele.

---

## Parte 2 — O experimento novo: gates de viabilidade

`research/experiments/2026-08-02-viability-gates/` — script em Node puro, sem
dependências, roda em segundos.

### Derivação (verificável algebricamente, no cabeçalho do script)

Com `k` = edge bruto por trade (**identicamente o Sharpe bruto por trade**),
`σ` = volatilidade anualizada, `c` = custo round-trip, `t` = holding em anos:

```
Sharpe anual = k/√t − c/(σt)   →   t* = 4c²/(k²σ²)   |   Sharpe_max = k²σ/(4c)
```

Uso honesto (k é o desconhecido, não o dado): `k_req = √(4·c·S_alvo/σ)`,
comparado com o `k` empírico já medido no projeto.

**Âncora empírica `k = 0,0338`**, derivada da única medição de n grande do
projeto (BTCUSD, n=202.075, z=+16,38 — HANDOFF de 30/07):
`k = 2,35 pts / (√(0,4466×0,5534) × 140 pts) ≈ 0,0338`.

⚠️ **Premissa declarada e já contrariada por medição**: as fórmulas assumem `k`
constante em `t`. O experimento de 30/07 mediu o edge **decaindo** com o stop
(negativo a partir de ~446 pts). Logo `t*` é **diagnóstico de onde procurar**,
nunca recomendação de holding.

### Dado usado (nada fabricado)
- σ e correlações: **medidos ao vivo** — 999 retornos diários da Binance, 2023-11-08 → 2026-08-01, 7 pares da seção 11.13
- custos: medições de terceiros com fonte e data no código (Pepperstone, abr/2026)
- `k`: derivado da medição do projeto

---

## Os 4 achados

### Achado 1 — O custo do `CostModel.ts` distorce o gate em 18x ⚠️ AÇÃO PENDENTE

| fonte de custo | c round-trip | k_req p/ Sharpe 1,0 | vs. k empírico | Sharpe teto | t* |
|---|---:|---:|---:|---:|---:|
| **CostModel.ts atual** ⚠️ | 0,2600% | 0,1483 | **4,39x** | **0,05** | 38,6d |
| Cripto CFD medido | 0,0145% | 0,0350 | 1,04x | **0,93** | 2,9h |
| Cripto CFD (leitura conservadora) | 0,0291% | 0,0496 | 1,47x | 0,46 | 11,6h |
| Forex major CFD (EURUSD) | 0,0129% | 0,0330 | 0,98x | 1,05 | 2,3h |
| Índice CFD (US500) | 0,0133% | 0,0336 | 0,99x | 1,01 | 2,4h |
| Índice CFD (US30) | 0,0091% | 0,0277 | 0,82x | **1,49** | 1,1h |

Com o custo do modelo, o gate exige sinal **4,4x mais forte** que o melhor já
medido — reprova tudo por construção. Com o custo real, o mesmo edge empírico
fica **na fronteira do viável**.

**Confirmado que a correção NÃO foi aplicada**: [`CostModel.ts:48`](research/CostModel.ts:48)
ainda tem `CRYPTO: { commissionPercent: 0.08, slippagePoints: 0.05 }` = 0,26%
round-trip. A task citada no HANDOFF de 30/07 (`task_d4fc7a53`) não chegou ao código.
O `0,08%` parece calibrado com taxa de **exchange spot**, não CFD.

### Achado 2 — As seções 11.5→11.11 não tinham poder para decidir ⭐ o mais importante

Detectar Sharpe/trade de 0,0338 com α=5% e poder 80% exige **5.412 trades
independentes** — **20.932 brutos** na cesta cripto, aplicado o desconto de
independência medido (N_eff/N = 0,259).

| cenário | n | N_eff | poder realizado | |
|---|---:|---:|---:|:--:|
| holdout das seções 11.5-11.9 | 20 | 5 | **5,8%** | ❌ |
| pooled forex 7 pares (11.10) | 92 | 24 | **6,9%** | ❌ |
| pooled 10 anos (11.11) | 322 | 83 | **9,1%** | ❌ |
| cross-asset BTCUSD (30/07) | 202.075 | 52.243 | **100,0%** | ✅ |

Com poder de 6-9%, um edge verdadeiro sairia "não significativo" em ~92% das
execuções. **Aqueles veredictos são indeterminados por construção, não evidência
de ausência de edge.**

Validação cruzada elegante: o **único** teste do projeto com poder adequado foi o
**único que encontrou edge** (z=+16,38). O framework reproduz exatamente o histórico.

### Achado 3 — N_eff da cesta cripto confirmado numericamente: 1,81

```
correlação média entre pares : 0,687
autovalores                  : 5,14 · 0,55 · 0,37 · 0,30 · 0,25 · 0,22 · 0,17
N nominal 7 → N_eff 1,81 (participation ratio) | 1,37 (corr. média)
```

Primeiro autovalor carrega **73% da variância** — a cesta é um fator (beta de
cripto) mais ruído. O `~1,5 apostas independentes` do CLAUDE.md estava correto.

### Achado 4 — Intraday é a única região com poder estatístico obtenível

Poder acumula por trade, não por ano de calendário:

| holding | trades/ano/ativo | n_efetivo/ano | anos p/ poder 80% |
|---|---:|---:|---:|
| ~3h (t* medido) | ~3.000 | ~5.430 | **~1 ano** |
| 1 dia | ~250 | ~452 | **~12 anos** |
| 1 semana | ~50 | ~90 | **~60 anos** |

**Swing/diário é estatisticamente inalcançável nesta cesta** — não por falta de
edge, por falta de amostra dentro de uma vida útil de pesquisa.

---

## Correção de rumo que Claude fez na própria análise (registrar, não esconder)

Na primeira resposta desta sessão, Claude recomendou **abandonar intraday e ir
para trend-following diário/swing multi-classe**, com uma tabela de Sharpe
mostrando intraday como matematicamente inviável.

**Essa recomendação estava errada em dois eixos**, e os gates a refutaram:

1. Usou `c = 0,26%` da seção 14.3 — o número que o próprio projeto já mediu como
   ~18x superestimado. Com custo real, intraday não é inviável.
2. Ignorou o custo estatístico do holding longo — diário/swing exigiria 12-21
   anos de dados para provar qualquer coisa nesta cesta.

**A decisão de produto do Cleber de 30/07 (manter intraday, opção B) é mais
defensável do que a análise inicial de Claude sugeriu.** Registrado aqui porque
a disciplina do projeto exige reportar achado que contraria o próprio trabalho.

---

## Próximo experimento decisivo: medir a curva `k(t)`

O teste de 30/07 operou com stop de 60 pts ≈ **42 min** de holding efetivo
(60/108.830 = 0,055% do preço; com σ=47,3% anual, σ√t = 0,055% → t ≈ 42 min).
O `t*` aponta **~2,9h**, onde o custo relativo cai de 26% do movimento para 1,7%.

Nesse holding, o mesmo `k` empírico produziria Sharpe anual ~0,93 em vez de negativo.

⚠️ **Isto NÃO é previsão de resultado.** O HANDOFF mediu o edge decaindo com o
stop, e como Sharpe escala com `k²`, se `k(2,9h)` for metade de `k(42min)`, o
Sharpe teto cai de 0,93 para **0,24**. **A curva `k(t)` nunca foi medida** — só
os dois extremos (positivo em 42min, negativo em ~39h).

**Por que este é o experimento certo:**
- barato — dataset M1 e motor em numba já existem em `2026-07-30-sma-pullback-crossasset/scripts/`
- hipótese única, não 106 — não sofre penalidade de DSR por busca ampla
- resultado binário — ou existe janela onde `k(t)` cai mais devagar que o custo
  dilui, ou a família de sinais fecha com base estrutural **e desta vez com
  poder estatístico para sustentar a afirmação**

---

## Arquivos criados nesta sessão (nada de produção tocado)

```
research/experiments/2026-08-02-viability-gates/
├── hypothesis.md              # pergunta, método, critério de corte fixado antes
├── verdict.md                 # resultado completo com os 4 achados
├── scripts/gates.mjs          # Node puro, sem dependências, ~450 linhas
└── results/gates-output.json  # saída bruta da execução
```

Reproduzir: `cd research/experiments/2026-08-02-viability-gates && node scripts/gates.mjs`
(env `TARGET_SHARPE` muda o alvo, default 1,0).

## Resultado do gate

`npm run validate` → **tudo passou** (nenhum arquivo de produção foi alterado).

## Estado do git

Branch `dev`, sincronizada com `origin/dev` (`neural_day_trader_V2`), árvore
limpa exceto o diretório novo untracked. Último commit: `f1b077e77`.

```bash
git add research/experiments/2026-08-02-viability-gates SESSAO_2026-08-02_GATES_VIABILIDADE.md && git commit -m "research: gates de viabilidade (aritmética/poder/N_eff) — custo do CostModel.ts distorce triagem em 18x, seções 11.5-11.11 sem poder estatístico" && git push origin dev
```

---

## Pendências em aberto (ordenadas por impacto)

1. **⚠️ Corrigir `CostModel.ts` (custo cripto 18x alto).** Não feito nesta sessão
   por ser código do caminho crítico — muda o comportamento do `CostViabilityGate`
   em produção. Exige `npm run validate` e ciência do Cleber sobre o impacto.
   Nota: o gate hoje **recusa operar** em regiões que na verdade são viáveis.
2. **⚠️ Ressalvar as seções 11.5→11.11 no `AI_BRAIN_SPEC.md` e no `CLAUDE.md`.**
   Ambos registram aqueles resultados como evidência de ausência de edge; o
   Gate 2 mostra que eram indeterminados (poder 6-9%). Não alterado por ser
   reescrita de conclusão registrada — **pedir aprovação do Cleber antes**.
   ⚠️ Isto **não** invalida a seção 14 (encerramento por argumento de custo e
   parada opcional), que continua de pé por raciocínio estrutural, não por
   significância estatística.
3. **Medir a curva `k(t)`** — o experimento decisivo descrito acima.
4. **README do módulo `predictive-ai`** promete features removidas
   (baleia/spoofing/heatmap) e declara "Completo e Funcional".
5. **UX dos painéis desativados** (Correlação, Força Relativa) — aparecem vazios,
   parecem bug. Rótulo explícito de "em construção".
6. **Decisão de produto ainda em aberto (seção 9.1)**: se os Estágios 3/4 da ponte
   de execução (já codificados, desligados por padrão) devem algum dia ser
   habilitados. Recomendação de Claude nesta sessão: **não avançar além do
   Estágio 2** enquanto não houver edge comprovado — com EV/trade ≈ −custo,
   automatizar execução é automatizar perda a taxa previsível.
7. **Estágios 3/4 e `LiveEmergencyClose.ts` nunca testados em ambiente real** —
   só `npm run validate`. Dívida perigosa: código com poder de execução real
   sem teste de integração.
