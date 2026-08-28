# Redesenho do cérebro de decisão — camada analítica com persona, dentro da jaula de risco mecânica

> Plano aprovado pelo Cleber em 2026-08-28 (sessão via Claude Code, modo
> plano). Arquivado aqui pra sobreviver fora da sessão — a convenção deste
> projeto é registrar em `research/experiments/`, não deixar plano preso
> num arquivo fora do repositório.

## Contexto

Reclamação real do Cleber: entradas que parecem "burras" (SOLUSD vendida na
mínima do dia, RSI 32, sem checar mais nada) porque o motor hoje só compara
número contra limiar fixo (RSI neutro 40-60, MACD virou ou não, Market Score
LATERAL/OPOSTO). Pedido: um "operador gênio" — IA que consulta RSI, MACD,
notícia, posicionamento, contexto de sessão, e forma um JULGAMENTO
contextual (pode até inverter o lado, se a leitura pedir isso), em vez de
executar regra fixa. Requisito explícito e não-negociável do Cleber: **a
disciplina de risco que já existe e já foi validada com dado real não pode
ser tocada** — o "operador gênio" decide direção e timing, nunca
flexibiliza o que protege o patrimônio.

**Achado crítico que muda como isto tem que ser validado**: este projeto já
teve exatamente esta ideia investigada e rejeitada uma vez —
`research/experiments/2026-08-23-custo-nao-cobrado-e-poder/tradingagents-e-ml.md`
concluiu que arquiteturas multi-agente/LLM pra decisão de trade (tipo
TradingAgents) **não são adotáveis com o rigor que este projeto exige**,
porque um LLM pode ter memorizado nos pesos o que aconteceu no mercado nas
datas históricas usadas pra backtestar — isso contamina qualquer teste
retroativo sem solução conhecida, um vazamento mais insidioso que o overfit
de parâmetro que o projeto já sabe caçar (DSR, walk-forward, embargo).
Fazer o cérebro novo e validar contra o passado do jeito que validamos TP
parcial/breakeven no mesmo dia **não é válido para uma camada baseada em
LLM**.

**Consequência de design, não opcional**: este cérebro só pode ser validado
**pra frente** — modo sombra, logando decisão real em tempo real, sem
nenhum efeito em capital, acumulando amostra (mesmo piso de rigor que o
projeto já usa: n≥100, corrigido por múltiplos testes, custo descontado)
antes de cogitar ligar de verdade.

Este documento também tem que respeitar a Restrição de Comunicação já
travada no `AI_BRAIN_SPEC.md` (14.5): **"um produto sem edge não pode
exibir número de acurácia/win rate como capacidade do sistema."** A persona
de "operador gênio" é framing de PROMPT (como a IA raciocina internamente),
não uma promessa ao usuário de que o produto agora tem alfa comprovado.

## O que fica exatamente como está (jaula de risco — intocável)

- `src/app/services/risk/CostViabilityGate.ts`
- `src/lib/modules/RiskManager.ts` (kill-switch, drawdown/perda diária, cooldown, max-trades/dia)
- `src/app/services/risk/ContextGate.ts`
- `src/app/services/risk/TailRiskGuard.ts`
- `src/app/services/risk/LiveCorrelationGuard.ts`
- `src/app/services/risk/RevengeTradingDetector.ts`
- `src/app/services/risk/TradeFrictionControls.ts`
- Dimensionamento de posição e toda a gestão de saída (TP parcial, breakeven, trailing, janela cega)

## O que muda — escopo do redesenho

Em `runTradingCycle.ts`/`analyzeAsset`, as etapas 3-9 (RSI neutro, MACD,
Market Score, modo/regime) são substituídas por uma chamada ao cérebro
analítico, que recebe o mesmo dado real que essas etapas já calculam.

## Persona — decidida: Adaptativo por regime, composto de 5 lendas

Soros, Jim Simons, Jesse Livermore, Paul Tudor Jones, Stanley Druckenmiller
— com a ressalva registrada na conversa original: os princípios se
contradizem entre si (Simons é estruturalmente anti-discricionário; Soros/
Druckenmiller são discricionários por natureza) e a síntese adotada usa
disciplina quantitativa (Simons/PTJ) como PISO inegociável, com leitura de
regime/narrativa (Soros/Druckenmiller) como camada de ajuste de confiança
— nunca como licença pra ignorar sinal ou stop. Livermore entra como
alerta histórico (quebrou várias fortunas por excesso de alavancagem e por
ignorar stop) — é a justificativa real de por que a jaula de risco nunca
pode ser flexibilizada pelo julgamento do próprio cérebro.

Dependência real, não resolvida: "notícia mundial quase online" depende de
orçamento de newsfeed pago, item já pendente no CLAUDE.md — fica fora do
escopo até aprovado à parte.

## Fases

0. Infra de modo sombra (sem efeito em capital) — **implementado nesta sessão**.
1. Acumular amostra pra frente (mín. 3-4 semanas ou n≥100).
2. Avaliação estatística (dado forward, nunca histórico) — mesmo piso de
   rigor da seção 8 do `AI_BRAIN_SPEC.md`, adaptado pra dado prospectivo.
3. Só se a Fase 2 aprovar: rollout gradual ao vivo, mesma forma dos 4
   estágios já usados pra execução real.

## Implementado nesta sessão (2026-08-28) — Fase 0

- Migration `supabase/migrations/20260828_add_decision_brain_shadow.sql`:
  tabela `ai_decision_brain_shadow` (contexto enviado, decisão do LLM,
  decisão mecânica real, RLS por `user_id`).
- `supabase/functions/ai-runner/lib/llmClient.ts`: client de LLM enxuto
  (sem tool-calling), 3 provedores via `LLM_PROVIDER` (mesma secret do
  NEXUS), duplicado do `nexus-brain/lib/llmClient.ts` de propósito (mesma
  convenção de isolamento entre Edge Functions já usada pra `RANKING_BASKET`).
- `supabase/functions/ai-runner/lib/decisionBrainPrompt.ts`: persona +
  schema de saída estruturada (`PROCEED`/`SKIP`/`FLIP` + confiança +
  reasoning).
- `supabase/functions/ai-runner/lib/decisionBrain.ts`: orquestra a chamada
  e grava no log sombra, sucesso ou falha (nunca esconde taxa de erro).
- `runTradingCycle.ts`: novo dep opcional `onDecisionPoint` (ausente para
  o driver browser, só o `ai-runner` fornece) — chamado fire-and-forget
  (nunca aguardado, nunca influencia `effects`/`tradeOpened`) só para o
  candidato #1 do ranking de cada ciclo.
- `ai-runner/index.ts`: fiação do hook, monta o contexto disponível
  (RSI/MACD/ADX computados sem custo de rede extra, notícia de alto
  impacto já cacheada, config do usuário) e chama `runShadowDecisionAndLog`.

**Simplificações conhecidas desta primeira versão, não escondidas**:
- Só o candidato #1 do ranking por ciclo (não os top 3-5 do plano original)
  — mais simples de implementar com segurança, ajustável depois de provar
  que a infra funciona ponta a ponta.
- Market Score (classificação/regime/valor) e viés de estrutura (BOS/CHoCH)
  **não estão no contexto ainda** — duplicar essas chamadas fora de
  `analyzeAsset` dobraria custo de rede por ciclo; ficam `null` no payload
  por enquanto, valor real conhecido, não um placeholder escondido.
- `priceChangePercent24h` fixo em 0 — não disponível no ponto de captura
  sem duplicar o fetch de preço.

## Verificação

- `npm run validate`: limpo.
- `deno check` do `ai-runner`: limpo.
- Pendente do Cleber: aplicar a migration + `supabase functions deploy
  ai-runner --no-verify-jwt` antes do modo sombra começar a gravar de
  verdade.
- Depois do deploy: confirmar manualmente que `ai_decision_brain_shadow`
  recebe linhas (sucesso ou erro) a cada ciclo com candidato #1 avaliado,
  antes de considerar a Fase 0 encerrada.
