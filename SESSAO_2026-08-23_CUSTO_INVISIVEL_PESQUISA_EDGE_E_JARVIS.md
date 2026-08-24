# Sessão 2026-08-23 — Custo Invisível, Pesquisa de Edge e Arquitetura Jarvis

> Este arquivo consolida tudo que foi feito e decidido nesta sessão. Serve como
> registro completo (convenção do projeto: sessões completas não ficam soltas
> na conversa) e como ponto de partida da **próxima seção**, que é a
> implementação passo a passo do Jarvis (parte final deste documento).

## Índice

1. [Achado crítico: custo de execução não cobrado](#1-achado-crítico-custo-de-execução-não-cobrado)
2. [Fix aplicado (completo, testado, não commitado)](#2-fix-aplicado)
3. [Pesquisa de edge — sazonalidade e calendário](#3-pesquisa-de-edge--sazonalidade-e-calendário)
4. [Pesquisa de edge — eventos macro](#4-pesquisa-de-edge--eventos-macro)
5. [Pesquisas que não completaram (posicionamento/fluxo e TradingAgents/ML)](#5-pesquisas-que-não-completaram)
6. [Arquitetura Jarvis — visão geral](#6-arquitetura-jarvis--visão-geral)
7. [PRÓXIMA SEÇÃO — passo a passo de implementação do Jarvis](#7-próxima-seção--passo-a-passo-de-implementação-do-jarvis)

---

## 1. Achado crítico: custo de execução não cobrado

Entre **17 e 23/08/2026**, o motor executou **135 trades em produção (DEMO)**
com uma assimetria estrutural:

- ✅ O `COST_GATE` (`CostViabilityGate.ts`) **rejeitou 7.618 candidatos**
  usando o custo real calibrado em `research/CostModel.ts`.
- ❌ Mas todo **fechamento de posição** (servidor `ai-runner/lib/
  positionManager.ts` e cliente `useApexLogic.ts`) gravava `commission: 0` e
  calculava PnL como `(preçoSaída − preçoEntrada) × notional/preçoEntrada` —
  ou seja, **preço médio nas duas pontas, sem spread, sem slippage**.

O motor cobrava custo na **decisão** e não cobrava na **execução**.

### Impacto medido (dado real do Supabase, não estimado)

| Métrica | Valor |
|---|---|
| PnL bruto reportado (134 trades fechados) | −US$14,12 |
| Custo de execução não cobrado | **US$14,83** |
| **Resultado real** | **−US$28,95** |
| Custo como % do \|PnL bruto\| | **105%** |

O custo invisível era **maior que o próprio resultado que ele distorcia**.

### Por que isso viola a convenção do projeto

> "Nunca fabricar dado — sempre erro explícito quando não há fonte real."

Um PnL de DEMO sem custo não é uma simulação conservadora do mercado real —
é a simulação de um mercado que não existe. Qualquer leitura de "a IA está
melhorando" feita sobre esse número estava sendo feita sobre um número
otimista por construção.

### Achados incidentais na mesma investigação

- **Confidence score não discrimina**: AUC = 0,529 (praticamente aleatório;
  correlação de Pearson com acerto = 0,0606) sobre 134 trades com
  `ai_confidence` preenchido.
- **Experimento R:R 1:3** (em produção desde a sessão de 17-18/08, ver
  `CLAUDE.md`): payoff realizado 4,53× (vs 3,01× desenhado), win rate real
  15,6% (IC95%: 9,1%–22,0%), breakeven 18,1% — **o breakeven cai dentro do
  IC do win rate real**. A amostra não distingue "o desenho funciona" de "o
  desenho empata", exatamente como previsto pelo **Teorema da Parada
  Opcional** já documentado em `AI_BRAIN_SPEC.md` §14.2: mexer em stop/alvo
  troca win rate por payoff, a média fica onde estava.
- **Poder estatístico**: a amostra de 88 trades desde 21/08 (t=0,588,
  p≈0,56) está longe de poder detectar a própria média observada. Seriam
  necessários ~2.000 trades independentes — com o desconto de correlação da
  cesta (N_eff/N≈0,26, medido em `AI_BRAIN_SPEC.md` §14.4), mais perto de
  7-8 meses contínuos de operação no ritmo atual.

Análise completa e reproduzível em
[`research/experiments/2026-08-23-custo-nao-cobrado-e-poder/`](research/experiments/2026-08-23-custo-nao-cobrado-e-poder/README.md)
(script `analise.ts` roda contra o `CostModel.ts` real, não número à mão).

---

## 2. Fix aplicado

**Status: código pronto, testado, `npm run validate` limpo (37/37 suites).
NÃO commitado — comandos de commit no final desta seção, pra Cleber rodar.**

### 2.1 Módulo novo: `src/app/services/risk/ExecutionCost.ts`

Fonte única de custo de execução realizado, usada por cliente **e**
servidor — para não repetir a classe de bug que este projeto já teve duas
vezes (`pointValue` duplicado em 2026-08-05, fórmula de PnL divergente em
2026-08-17).

```typescript
export function calculateRoundTripCost(
  symbol: string,
  notionalUsd: number,
  priceLevel: number,
): ExecutionCostBreakdown // { roundTripPercent, costUsd, assetClass }
```

- Usa `resolveCostAssetClass` (catálogo, não heurística de substring) +
  `estimateCostPercent` do `CostModel.ts` já calibrado — nenhum número novo,
  só aplica o que o `COST_GATE` já usava pra recusar trade.
- Entrada inválida (preço ≤0, notional ≤0, NaN) → custo 0, **sem lançar**.
  Cobrar custo nunca pode ser motivo de uma posição não fechar.

### 2.2 Servidor: `supabase/functions/ai-runner/lib/positionManager.ts`

- `PositionCloseResult` ganhou `grossPnl` e `costUsd`; `pnl` agora é líquido.
- Fechamento por TP/SL: `pnl = grossPnl - costUsd`.
- Fechamento parcial (pyramiding): custo cobrado sobre a fração fechada, não
  sobre o notional inteiro do grupo.
- `persistPositionClose`/`partialClosePosition`: gravam `pnl` (bruto,
  auditoria), `commission` (custo cobrado), `net_pnl` (líquido — o que move
  balance).

### 2.3 Log: `supabase/functions/ai-runner/index.ts`

Log de fechamento agora mostra os três números: líquido, bruto e custo —
`GANHO de +$3,96 (bruto +$4,00 − custo $0,04)`.

### 2.4 Cliente: `src/app/hooks/useApexLogic.ts`

Mesma lógica replicada nos 3 pontos de fechamento client-side (TP/SL
automático, "fechar todas", fechamento manual de uma posição). Import de
`calculateRoundTripCost`; `onTradeClose` passa `costUsd` real em vez de `0`.

### 2.5 Validação: `src/app/services/risk/__validate__execcost__.ts`

15 asserções determinísticas: custo positivo, bate com a constante
calibrada do `CostModel`, linear no notional, entrada inválida não lança,
classes diferentes cobram custos diferentes (Brent vs. ouro), identidade
líquido = bruto − custo. Registrado em `scripts/validate.mjs`.

### Comandos prontos para Cleber rodar

```bash
git add src/app/services/risk/ExecutionCost.ts \
        src/app/services/risk/__validate__execcost__.ts \
        supabase/functions/ai-runner/lib/positionManager.ts \
        supabase/functions/ai-runner/index.ts \
        src/app/hooks/useApexLogic.ts \
        scripts/validate.mjs \
        research/experiments/2026-08-23-custo-nao-cobrado-e-poder/

git commit -m "fix: cobra custo de execução real no fechamento de posição (cliente+servidor)

Até agora todo fechamento gravava commission=0 e calculava PnL como preço
médio nas duas pontas — sem spread, sem slippage. O COST_GATE já rejeitava
trade usando o custo real do CostModel.ts, mas a execução não cobrava esse
mesmo custo. Medido em produção (17-23/08, 134 trades): PnL bruto -\$14,12,
custo não cobrado \$14,83, resultado real ~-\$28,95 (custo invisível = 105%
do |PnL bruto|).

Fix: módulo compartilhado ExecutionCost.ts (fonte única, cliente+servidor)
aplicado nos 5 pontos de fechamento. pnl=bruto, commission=custo cobrado,
net_pnl=líquido. 15 asserções novas no gate de validação."

git push origin dev
```

Depois do push, ainda falta (fora do escopo de código, ação de infra):

```bash
# Redeploy do runner com o fix (Edge Functions não sobem com git push)
supabase functions deploy ai-runner --no-verify-jwt
```

---

## 3. Pesquisa de edge — sazonalidade e calendário

Revisão de evidência com fontes acadêmicas (Andersen & Bollerslev,
Andersen-Thyrsgaard-Todorov, Hansen-Kim-Kimbrough, McLean & Pontiff, entre
outras), especificamente sobre a cesta real (XAUUSD, EURUSD, NAS100,
UKOUSD, BTCUSD, ETHUSD, SOLUSD).

### Veredito

**Zero efeitos de calendário direcionais utilizáveis** nesta cesta. Os
candidatos folclóricos (Halloween/Sell-in-May, efeito janeiro, "outono do
ouro", turn-of-month, dia da semana) todos falham por um destes motivos:
- Renderiam menos que o custo de round-trip do próprio broker (ex.:
  Halloween ≈1,6 bps/dia vs. 4,50 bps de custo do NAS100);
- Morreram pós-publicação (turn-of-month, dia da semana em FX — este
  último era anúncio macro disfarçado, não dia da semana em si);
- Nunca tiveram correção por múltiplos testes nem holdout (outono do ouro:
  2 de 12 meses "significantes" com n≈31 por mês — exatamente o esperado
  por acaso).

### O que É real e utilizável: mapa de volatilidade/liquidez por hora

Isto não gera alfa — reduz custo, o que no regime atual (EV≈−custo) é a
alavanca certa:

1. **Blackout duro 21:00–22:00 UTC** (rollover): spread relatado 5–10× o
   normal em CFD.
2. **Reduzir tamanho 02:00–06:00 UTC** para cripto (almoço da Ásia): vol
   relativa ~0,80 vs. pico 1,35 (razão ~1,7×), liquidez Binance ~30% pior.
3. **Concentrar operação no overlap Londres-NY (12:00–16:00 UTC)**: vol
   5-6× a mínima do dia, mas é onde o spread relativo é menor — o que
   importa é a razão movimento/custo, não o movimento isolado.
4. **NAS100 só em RTH** (~75% da variância diária ocorre nas 6,5h de
   pregão).
5. **Relógio ciente de DST** — um perfil horário fixo em UTC erra a janela
   por 1h em metade do ano.
6. **Perfil horário deve ser re-estimado periodicamente**: a periodicidade
   é estado-dependente (Andersen-Thyrsgaard-Todorov 2019), não uma tabela
   fixa.
7. **London Fix 15:00 (ouro)**: o sinal de "vazamento" documentado por
   Caminschi & Heaney (2014) morreu com a extinção do leilão telefônico em
   03/2015 — sobra só concentração de volatilidade, não sinal.

Relatório completo com 20+ fontes e tabela final Efeito×Tamanho×Sobrevive
OOS×Utilizável está preservado no transcript da sessão (não persistido em
arquivo separado ainda — ver seção 7, passo 0, para decidir se vale criar
`research/experiments/2026-08-23-calendario-e-macro/`).

---

## 4. Pesquisa de edge — eventos macro

Revisão de evidência (Lucca & Moench 2015, Kurov-Wolfe-Gilbert 2021,
Ederington & Lee 1993, Andersen-Bollerslev-Diebold-Vega 2003, Fleming &
Remolona 1999, Bomfim 2000, Benigno & Rosa 2023, Yang & Wang 2026, entre
outras).

### Veredito

**O efeito macro utilizável nesta cesta não é direcional, é de risco.**

- **Pre-FOMC Drift**: original +49 bps (Lucca & Moench, até 2011); caiu
  para **+9,2 bps** em 2016-19 e virou **−5,1 bps** sem coletiva — morto
  fora de amostra. Além disso é um efeito **overnight**, não intraday.
- **CPI/NFP/PCE/ISM**: reação é condicional à surpresa, que não é
  observável antes do release — não há sinal a explorar.
- **Reversão, não continuação**: Boguth et al. documentam reversão
  substancial pós-FOMC — "gap-and-go" não tem sustentação estatística.
- **O que É grande e replicado desde 1993**: spread alarga dramaticamente
  no instante do release (Fleming & Remolona 1999) e volatilidade fica
  elevada ~15 min (Ederington & Lee 1993) — isso varre stop e destrói R:R
  mesmo quando a direção é acertada.
- **Cripto**: Bitcoin é "ortogonal" a notícia monetária no intraday
  (Benigno & Rosa, NY Fed), mas o risco de evento é real — |retorno| médio
  na 1ª hora pós-FOMC sobe de 0,66%→1,25% (BTC) e 0,85%→1,50% (ETH),
  volume ×2,5-2,8× (Yang & Wang 2026, 41 comunicados, p<0,001). SOLUSD sem
  evidência publicada.
- **"Calm before the storm"**: confirmado — vol condicional na véspera de
  FOMC é ~metade do típico (Bomfim 2000), o que produz falso sinal de
  breakout limpo logo antes da explosão real.

### Armadilha operacional achada (não é literatura, é achado direto)

Os horários UTC citados neste tipo de calendário são de **inverno**. Com
horário de verão americano (mar–nov): CPI/NFP/PCE saem às **12:30 UTC**
(não 13:30), FOMC às **18:00 UTC**, coletiva **18:30 UTC**, EIA **14:30
UTC**. Hardcodar UTC fixo erra a janela de proteção por 1h durante ~8 meses
do ano — guardar horário em `America/New_York` e converter.

### Fontes gratuitas de calendário avaliadas

| Fonte | Custo | Rate limit |
|---|---|---|
| ForexFactory (feed não-oficial) | Grátis | 2 downloads/5min |
| Trading Economics | Grátis (chave amostra) | Não publicado |
| FMP | Grátis | 250 req/dia |
| Finnhub | Grátis (60/min) | Endpoint de calendário costuma ser premium — validar |
| Fed/BLS/BEA/EIA (oficiais) | Grátis | Sem limite relevante, mas exige parser por agência |

### Aplicação recomendada

**Defensiva, não preditiva**: não abrir posição nova (e considerar reduzir
exposição existente) nas janelas de release relevantes pra cada ativo —
ganho vem de evitar custo/cauda, não de prever sinal. Coerente com a
conclusão já registrada no projeto (sem edge de sinal, EV≈−custo).

---

## 5. Pesquisas que não completaram (RETOMADAS E CONCLUÍDAS 2026-08-23)

Duas frentes tinham falhado por limite de sessão na primeira onda e foram
relançadas e concluídas ainda em 2026-08-23. Relatórios completos:
[`research/experiments/2026-08-23-custo-nao-cobrado-e-poder/posicionamento-e-fluxo.md`](research/experiments/2026-08-23-custo-nao-cobrado-e-poder/posicionamento-e-fluxo.md)
e
[`research/experiments/2026-08-23-custo-nao-cobrado-e-poder/tradingagents-e-ml.md`](research/experiments/2026-08-23-custo-nao-cobrado-e-poder/tradingagents-e-ml.md).

### 5.1 Posicionamento e fluxo — veredito: nenhum edge intraday comprovado

Nenhuma das 5 fontes pesquisadas (COT report, funding rate de perpétuos,
liquidações em cascata, open interest, fluxo on-chain) tem edge intraday
comprovado com o rigor estatístico que o projeto exige:

- **COT (CFTC)**: grátis, sem limite, mas semanal com 3 dias de delay — só
  serve como viés de regime, nunca timing intraday. Cobre forex/ouro/índice
  via futuro; não cobre ações CFD nem cripto. "Backtests" achados na busca
  são de blog de corretora, sem holdout — não contam como evidência.
- **Funding rate (cripto)**: grátis, tempo real, é a única fonte com
  horizonte plausivelmente intraday (horas). Mecanismo bem entendido, mas
  sem threshold validado nem backtest líquido de custo. Só cripto.
- **Liquidações em cascata**: majoritariamente narrativa de ferramenta
  comercial (Coinglass) — sinal reativo, aparece depois que a cascata já
  começou. Sem paper com validação. Só cripto.
- **Open Interest**: leitura preço×OI é prática consolidada, mas literatura
  e um paper recente (arXiv, "Structural Limits of OHLCV-Based Intraday
  Signals") confirmam que atualiza com atraso e é fraco pra timing intraday
  sem volume. Futuros/perp, não ações CFD.
- **Fluxo on-chain**: há pesquisa acadêmica real (contágio de whale medido
  6-24h após transferência), mas isso já é horizonte de horas/dias, não
  intraday clássico; edge real vem de empilhar sinais (mesa institucional),
  não netflow isolado. API de qualidade é cara. Só cripto.

**Conclusão**: nenhuma fonte justifica reabrir o Trilho 2 sem validação
estatística própria (não feita aqui). Única candidata com plausibilidade
mínima: funding rate extremo como **filtro de regime** (não gatilho) em
BTC/ETH — precisaria do mesmo backtest com custo real e holdout que
reprovou os presets técnicos em 2026-08-05.

### 5.2 TradingAgents + ML — veredito: não aplicável agora, um item vale validar barato

**TradingAgents** (arXiv 2412.20138,
github.com/TauricResearch/TradingAgents) é real: framework multi-agente LLM
(7 papéis, debate antes de decidir). Paper original reporta Sharpe/retorno
acima de baseline, mas evita só o vazamento clássico (busca de notícia
"date-aware") — o problema real, documentado numa issue aberta do próprio
repo (#805) e em papers de 2026 (arXiv 2605.16895 "The Alpha Illusion",
2605.24564, 2607.04958), é **vazamento paramétrico**: o LLM já "sabe" o
desfecho do período testado porque está codificado nos próprios pesos de
pré-treino, sem precisar de acesso explícito a dado futuro — multi-agente
pode até amplificar isso via debate convergente. Nenhuma replicação
independente encontrada que confirme os números controlando esse viés.
**Não aplicável honestamente ao produto agora — risco alto de resultado
inflado.**

Técnicas quantitativas revisadas: meta-labeling e triple-barrier (López de
Prado) são maduras, mas pressupõem sinal primário com edge — o projeto já
mediu que TA clássico não tem, então aplicá-las agora seria polir
rotulagem de algo sem poder preditivo comprovado. Purged K-fold CV com
embargo é relevante se/quando o Trilho 2 for retomado, ou pra validar
qualquer modelo de vol. **GARCH/HAR-RV** é o único item alinhado ao
objetivo já decidido (ML só pra vol): HAR-RV supera GARCH consistentemente
segundo a literatura, mas não há comparação publicada contra o benchmark
mais simples (naive = vol realizada recente) — que é o teste que decidiria
se vale construir. Online learning tem problema direto com o Jarvis
proposto: reanálise a cada 6h multiplica testes ao longo do tempo — DSR
precisa acumular K desde o início, não resetar por ciclo, ou o Jarvis vai
"achar" ajuste por acaso com frequência crescente.

**Recomendação**: nenhuma implementação nova agora; se algo for barato o
suficiente pra valer, é validar HAR-RV vs. naive com dado já existente
(sem infra nova) antes de investir mais em vol prevista por ML.

---

## 6. Arquitetura Jarvis — visão geral

Jarvis é um sistema de **memória persistente + decisão estruturada** que
roda no servidor (Supabase Edge Function + cron), analisa dado real de
produção a cada ciclo, e propõe/aplica ajustes ao motor com auditoria
completa — em vez de cada sessão de chat redescobrir do zero o que já foi
medido.

```
┌─────────────────────────────────────────────────────────────┐
│  JARVIS: Sistema de Evolução Contínua do Motor + AI          │
├─────────────────────────────────────────────────────────────┤
│  OBSERVAÇÃO (real-time)                                      │
│    ai_trades · ai_funnel_snapshots · price_guard_events ·    │
│    asset_performance_scorecard                               │
│                                                                │
│  ANÁLISE (periódica: 6h/24h/7d)                               │
│    win rate + IC · calibração de confidence (AUC/Brier) ·    │
│    padrões de hora/dia detectados · correlação cross-asset   │
│                                                                │
│  DECISÃO (regras + recomendação, nunca auto-aplica sem       │
│  aprovação — ver regra de workflow do projeto)                │
│    ligar/desligar gate · ajustar tamanho · recalibrar score  │
│    · propor experimento A/B · alertar Cleber                 │
│                                                                │
│  PERSISTÊNCIA (auditoria completa)                            │
│    jarvis_decisions · jarvis_experiments · jarvis_knowledge · │
│    jarvis_alerts · jarvis_health_snapshots                   │
│                                                                │
│  COMUNICAÇÃO                                                  │
│    Dashboard · recomendações · alertas · (opcional) MCP       │
└─────────────────────────────────────────────────────────────┘
```

### Peças já desenhadas nesta sessão

- **Schema completo**: [`research/jarvis-schema.sql`](research/jarvis-schema.sql)
  (208 linhas, 5 tabelas, RLS configurado — leitura pública, escrita só
  `service_role`).
- **Skeleton do motor de análise**: escrito no transcript da sessão (Deno
  Edge Function, ~195 linhas) — **ainda não salvo em arquivo**, ver passo 2
  da seção 7.
- **Blueprint de implementação**: [`supabase/functions/jarvis/BLUEPRINT.md`](supabase/functions/jarvis/BLUEPRINT.md)
  (258 linhas) — 4 exemplos de regra de decisão prontos pra adaptar,
  fluxo completo, checklist.

### Decisão de design — ✅ CONFIRMADA 2026-08-23: Jarvis autoaplica

Ao contrário da regra fixa de "nunca commit/push sozinho" (que continua
valendo para código), o Jarvis **autoaplica decisões dentro de limites
definidos**, sem esperar aprovação manual a cada ciclo. Isso é uma escolha
deliberada do Cleber, diferente da regra de workflow de código — o motor
de decisão readapta parâmetros operacionais continuamente, não edita
arquivo-fonte.

Autoaplicar não é autoaplicar sem controle — ver os 5 guardrails na seção
7, Passo 0: teto de magnitude por ciclo, cooldown entre ajustes no mesmo
alvo, lista de exclusão que sempre exige aprovação humana (gates de risco
inteiros, capital mínimo, alavancagem), rollback automático se o efeito
medido piorar, e log sempre auditável mesmo sem aprovação prévia.

---

## 7. PRÓXIMA SEÇÃO — passo a passo de implementação do Jarvis

Esta é a ordem recomendada. Cada passo é pequeno o bastante pra revisar e
aprovar antes do próximo — nada aqui foi executado ainda.

### Passo 0 — Decisão de escopo (Cleber) — ✅ DECIDIDO 2026-08-23

**Jarvis autoaplica.** Decisão registrada nesta data: o Jarvis não fica
preso em `PENDING` esperando aprovação manual — decisões dentro de limites
pré-definidos entram em vigor sozinhas no próximo ciclo (6h).

Isto é uma mudança real de risco em relação ao design original (que
replicava "nunca commit sozinho" pro motor de decisão), então o
`BLUEPRINT.md` foi ajustado com **guardrails obrigatórios** — não é
autoaplicação sem limite, é autoaplicação **dentro de uma faixa**:

- **Magnitude máxima por ciclo**: nenhuma decisão pode mudar um parâmetro
  em mais que um teto fixo por execução (ex.: tamanho de posição no máximo
  ±25% por ciclo, nunca zera nem dobra de uma vez). Evita que um outlier
  de 6h de dado ruim vire uma mudança drástica automática.
- **Cooldown entre mudanças no mesmo alvo**: um parâmetro já ajustado neste
  ciclo não pode ser ajustado de novo antes de N ciclos (default 4 = 24h),
  mesmo que a régua continue apontando na mesma direção. Evita oscilação.
- **Lista de exclusão (nunca autoaplica)**: mudanças que desligam um gate
  de risco inteiro (`RISK_GATE`, `TAIL_RISK_GUARD`, `KILL_SWITCH`) ou que
  mexem em capital mínimo/alavancagem sempre nascem `PENDING` — essas
  precisam de aprovação humana sempre, sem exceção. A lista de exclusão
  fica em `jarvis_knowledge.status` (`REQUIRES_APPROVAL` vs `AUTO`).
- **Rollback automático**: toda decisão autoaplicada é reavaliada no ciclo
  seguinte (6h depois) — se o efeito medido em `jarvis_decisions.effect_on_pnl`
  for pior que o baseline por mais de um limiar (default: pior que o
  desvio-padrão histórico), a decisão é revertida sozinha e registrada em
  `jarvis_decisions.reverted_at` + `revert_reason='auto_rollback_pnl_degradation'`.
- **Log sempre visível**: autoaplicar não significa autoaplicar em
  silêncio — toda decisão `status=ACTIVE` (autoaplicada) continua gravada
  com a mesma evidência de uma `PENDING`, só que sem esperar aprovação.
  Cleber vê tudo no dashboard/SQL a qualquer momento e pode reverter na
  mão mesmo sem esperar o rollback automático.

Ver seção 6 (arquitetura) e o `BLUEPRINT.md` atualizado com a tabela de
guardrails.

- [ ] Confirmar: vale persistir os relatórios de sazonalidade/macro desta
      sessão como arquivos em `research/experiments/2026-08-23-calendario-e-macro/`
      antes de codificar as regras que dependem deles? (recomendado — sem
      isso o conhecimento fica só no transcript, que este projeto já
      decidiu que não é lugar seguro pra achado permanente).

### Passo 1 — Fechar a fase de pesquisa (retomar o que faltou) — ✅ CONCLUÍDO 2026-08-23
- [x] Pesquisa de posicionamento/fluxo (COT, funding rate, liquidações,
      OI, on-chain) — concluída, veredito: nenhum edge intraday
      comprovado. Ver seção 5.1.
- [x] Avaliação de TradingAgents + técnicas de ML (meta-labeling, GARCH,
      purged CV, online learning) — concluída, veredito: TradingAgents não
      aplicável (vazamento paramétrico de LLM), único item a validar
      barato é HAR-RV vs. naive. Ver seção 5.2.

### Passo 2 — Aplicar o schema do Jarvis
- [ ] Copiar `research/jarvis-schema.sql` pro SQL Editor do Supabase e
      rodar (ou pedir pra eu gerar a migration formal em
      `supabase/migrations/` pro Cleber aplicar do jeito que o projeto já
      faz com as outras).
- [ ] Confirmar as 5 tabelas criadas com `list_tables`.

### Passo 3 — Escrever e testar a Edge Function `jarvis`
- [ ] Criar `supabase/functions/jarvis/index.ts` a partir do skeleton
      (queries reais em `ai_trades`, detecção de padrão por hora,
      as 4 regras de decisão do `BLUEPRINT.md` adaptadas com os números
      confirmados pela pesquisa: blackout 21-22 UTC, redução 02-06 UTC
      cripto, etc.)
- [ ] Rodar local (`supabase functions serve jarvis`) contra o Supabase
      real de dev, conferir que grava em `jarvis_health_snapshots` e
      `jarvis_decisions` sem erro.
- [ ] `deno check` (o runner já tem essa disciplina — replicar aqui).

### Passo 4 — Deploy e agendamento
- [ ] `supabase functions deploy jarvis` (comando pronto pro Cleber rodar,
      igual toda Edge Function deste projeto).
- [ ] Agendar cron (`pg_cron`, 6 em 6 horas) — SQL pronto no
      `BLUEPRINT.md`.
- [ ] Confirmar primeira execução real gravou snapshot.

### Passo 5 — Dashboard mínimo (opcional, decidir se entra nesta rodada)
- [ ] Componente React simples lendo `jarvis_health_snapshots` +
      `jarvis_decisions` (status=PENDING) — só visualização + botão
      aprovar/rejeitar, sem lógica nova.

### Passo 6 — Primeiras 1-2 semanas rodando
- [ ] Sem mudar nada no motor ainda — só observar. Objetivo: acumular
      `jarvis_health_snapshots` reais o bastante pra próxima decisão (ex.:
      ligar blackout de rollover) vir com evidência do próprio produto,
      não só da literatura.
- [ ] Revisão conjunta: quais decisões PENDING fazem sentido aprovar.

---

**Convenção mantida**: nada neste documento foi commitado, pushado ou
aplicado em produção sem comando explícito pro Cleber rodar — regra fixa
do projeto (`CLAUDE.md`, "Regra fixa de workflow").

---

## 8. PRÓXIMA SEÇÃO — [em aberto]

> Seção reservada para o próximo passo a ser trabalhado. Preencher aqui
> antes de começar, pra manter tudo num único documento em vez de espalhar
> por conversa/arquivos soltos (convenção do projeto).

### Contexto no momento de abrir esta seção

- Fix de custo de execução: pronto, testado, **não commitado**.
- Pesquisa de edge: sazonalidade e macro concluídas (seções 3-4); posicionamento/fluxo
  e TradingAgents/ML **ainda não retomadas** (seção 5) — falharam por limite de sessão.
- Jarvis: schema (`research/jarvis-schema.sql`) e blueprint
  (`supabase/functions/jarvis/BLUEPRINT.md`) prontos, com autoaplicação +
  guardrails desenhados. **Nada aplicado em produção ainda** — Edge Function
  `jarvis/index.ts` real ainda não foi escrita em arquivo.

### O que entra aqui
- [ ] *(a preencher — diga o que quer atacar agora e eu registro o passo a passo aqui)*
