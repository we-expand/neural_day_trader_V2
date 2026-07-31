# Handoff — próxima sessão

> **⚠️ ATUALIZAÇÃO 2026-07-31 (sessão nova, EM ANDAMENTO — não é o fim desta seção)**:
> o campo `entrySignal` mencionado abaixo **já foi commitado** (o Cleber confirmou).
> Uma sessão nova começou a construir a "camada cognitiva" do cérebro pedida pelo
> Cleber — ver **`research/AI_COGNITIVE_SPEC.md`** (documento de decisão, leitura
> obrigatória antes de continuar qualquer bloco). Ordem acordada com o Cleber,
> rastreada via TaskList desta sessão:
>
> 1. ✅ **Holdout do BTCUSDT** — a anomalia de 68,2% do Market Score (baseline)
>    não sobreviveu fora de amostra (caiu a 51,6%/53,7%, falha consistência). Era
>    vazamento de calibração, não edge. Ver
>    `research/experiments/2026-07-31-btc-holdout/verdict.md`.
> 2. ✅ **Bloco A — memória persistente (diário de decisão)** — implementado.
>    **Pendência imediata**: rodar a migration nova, comando abaixo.
> 3. ✅ **Bloco C — matemática do risco** — implementado. `ExpectancyEngine.ts`
>    (expectativa em R-multiples com IC 95%, risco de ruína via Monte Carlo
>    seedado, Kelly honesto guardado pelo IC inferior). 29 asserções novas em
>    `npm run validate`. **Ainda não ligado** em `useApexLogic.ts` — exposto,
>    não consumido (mesmo padrão do Bloco A); ligar depende da migration 009
>    estar aplicada (para alimentar com trades reais) e de decisão de produto
>    sobre influenciar sizing automaticamente vs. só exibir ao usuário.
> 4. ✅ **Bloco D — anti-revenge trading** — implementado E LIGADO ao motor
>    (não só exposto — este já bloqueia de verdade no grau `FORCE_COOLDOWN`).
>    `RevengeTradingDetector.ts`, 3 sinais mecânicos contra a baseline do
>    próprio usuário. 11 asserções novas em `npm run validate`. **Gap
>    declarado**: grau `REQUIRE_CONFIRMATION` só notifica hoje — falta UI de
>    diálogo de confirmação explícita.
> 5. ✅ **Bloco B — contexto como veto** — implementado E LIGADO ao motor.
>    `ContextGate.ts`: regime via ADX/ATR crus + estrutura via BOS/CHoCH
>    (`smc/marketStructure.ts` — é aqui que Price Action/Brooks entra, só como
>    veto "a estrutura contradiz o lado?", nunca como gatilho, como você
>    decidiu). Deliberadamente NÃO usa o Market Score (medido sem poder
>    preditivo nas etapas 1). Veto ADICIONAL ao veto de Market Score
>    existente — não o substitui, essa decisão é sua, não tomada aqui. 14
>    asserções novas em `npm run validate`.
> 6. ✅ **Bloco E — proteção de cauda (cisne negro)** — implementado E LIGADO.
>    `TailRiskGuard.ts`: 4 níveis monotônicos combinando ATR do ativo (mesma
>    métrica do Bloco B) **e VIX de mercado real** (NONE → REDUCE_SIZE →
>    BLOCK_NEW_ENTRIES → EMERGENCY_CLOSE, sempre a leitura mais severa das
>    duas — `triggeredBy` auditável). EMERGENCY_CLOSE reaproveita
>    `forceCloseAllLivePositions()` já existente. 33 asserções.
>    **Correção do mesmo dia**: a 1ª versão dizia que VIX não podia ser ligado
>    por falta de cache — estava ERRADO (não verificado com cuidado); o cache
>    já existia (`fetchVIXCached`, 60s). Corrigido, VIX real ligado sem
>    chamada de rede nova. **Achado colateral #2, corrigido no mesmo dia**: o
>    mesmo VIX já era lido em produção pra fazer o OPOSTO — `VIX > 20` ativava
>    "modo agressivo" (cooldown 5s→2s), e ainda por cima o gatilho estava
>    quebrado (lia uma Promise antes dela resolver, nunca disparava de
>    verdade). Cleber decidiu: vira **opt-in explícito**
>    (`AIConfig.aggressiveModeEnabled`, default false), nunca mais automático
>    por VIX, e nunca compete com o Bloco E (que segue bloqueando/fechando
>    independente do opt-in). **UI construída**: toggle "Cadência Agressiva"
>    em `AITrader.tsx`, card "Pausa & Frequência", mesmo padrão visual do
>    `cooldownEnabled` existente, com aviso explícito de que a Proteção de
>    Cauda continua ativa independente do toggle.
>    **Gap ainda aberto**: multiplicador de REDUCE_SIZE ainda não aplicado ao
>    sizing real (mudança maior, fora do escopo).
>
> **✅ OS 6 BLOCOS DA ORDEM ACORDADA ESTÃO IMPLEMENTADOS.** `npm run validate`
> verde (120 asserções novas nesta sessão, entre os 5 blocos com suíte:
> A não tem suíte própria — é persistência, testada via type-check —, C=29,
> D=11, B=14, E=33 (após correção do VIX), mais as 33 pré-existentes). Nenhum
> destes blocos foi validado estatisticamente como "gera lucro" — sob a
> decisão (B) (`AI_BRAIN_SPEC.md` §14.5), a meta é disciplina/execução
> auditável, não alfa; a métrica que valida isso ("os vetos ajudaram?") só
> fica calculável depois que a migration 009 rodar e acumular dado real.
> Ler `research/AI_COGNITIVE_SPEC.md` inteiro antes de estender qualquer
> bloco — tem o racional completo, os gaps declarados de cada um, e a lista
> do que ainda falta (UI de confirmação do Bloco D, aplicar multiplicador do
> Bloco E ao sizing, medir o valor real dos vetos, decidir o destino do veto
> de Market Score que continua em paralelo ao do Bloco B).
>
> **Migration pendente de aplicar** (arquivo completo em
> `supabase/migrations/009_ai_decisions.sql`, nunca aplicada por mim — colar no
> SQL Editor do Supabase, projeto "Neural DayTrader" `wyvdsxtcmizettljxtbg`):
> ```sql
> CREATE TABLE IF NOT EXISTS public.ai_decisions (
>   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
>   session_id uuid NOT NULL REFERENCES public.ai_sessions(id) ON DELETE CASCADE,
>   user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
>   symbol text NOT NULL,
>   timestamp timestamptz NOT NULL DEFAULT now(),
>   decision text NOT NULL CHECK (decision IN ('BUY', 'SELL', 'HOLD', 'CLOSE')),
>   confidence numeric,
>   reasoning text NOT NULL,
>   market_score numeric,
>   technical_signals jsonb,
>   risk_assessment jsonb,
>   action_taken boolean NOT NULL DEFAULT false,
>   veto_stage text CHECK (veto_stage IN (
>     'CONTEXT_SCORE_OPPOSITE', 'CONTEXT_SCORE_LATERAL', 'CONTEXT_CONFIDENCE',
>     'CONFIG_DIRECTION', 'COST_GATE', 'COST_GATE_NO_DATA', 'RISK_GATE',
>     'KILL_SWITCH', 'COOLDOWN', 'MAX_TRADES_PER_DAY'
>   )),
>   trade_id uuid REFERENCES public.ai_trades(id) ON DELETE SET NULL,
>   created_at timestamptz NOT NULL DEFAULT now()
> );
>
> CREATE INDEX IF NOT EXISTS idx_ai_decisions_session_ts ON public.ai_decisions (session_id, timestamp DESC);
> CREATE INDEX IF NOT EXISTS idx_ai_decisions_user_symbol ON public.ai_decisions (user_id, symbol, timestamp DESC);
> CREATE INDEX IF NOT EXISTS idx_ai_decisions_veto_stage ON public.ai_decisions (veto_stage) WHERE veto_stage IS NOT NULL;
>
> ALTER TABLE public.ai_decisions ENABLE ROW LEVEL SECURITY;
>
> CREATE POLICY "Users manage own ai_decisions" ON public.ai_decisions
>   FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
> ```
> Sem isso, as chamadas novas de `saveDecision` em `useApexLogic.ts` falham
> silenciosamente (mesmo comportamento de antes — só que agora vão funcionar
> assim que a tabela existir).
>
> **Commit pendente desta sessão** (`npm run validate` já rodou verde, 29+13+14+13+14+... suítes):
> ```bash
> git add research/AI_COGNITIVE_SPEC.md research/experiments/2026-07-31-marketscore-baseline/ research/experiments/2026-07-31-btc-holdout/ research/experiments/README.md supabase/migrations/009_ai_decisions.sql src/app/services/AITradingPersistenceService.ts src/app/hooks/useAIPersistence.ts src/app/hooks/useApexLogic.ts src/app/components/AITrader.tsx src/app/services/risk/ExpectancyEngine.ts src/app/services/risk/__validate__expectancy__.ts src/app/services/risk/RevengeTradingDetector.ts src/app/services/risk/__validate__revenge__.ts src/app/services/risk/ContextGate.ts src/app/services/risk/__validate__context__.ts src/app/services/risk/TailRiskGuard.ts src/app/services/risk/__validate__tailrisk__.ts src/lib/modules/RiskManager.ts scripts/validate.mjs
> git commit -m "feat: cérebro cognitivo completo (Blocos A-E) — diário de decisão, contexto como veto, expectativa/risco de ruína/Kelly honesto, detector de revenge trading, proteção de cauda com VIX real e cadência agressiva opt-in"
> git push
> ```
> (a pasta `research/experiments/2026-07-30-fase2-remediation/` continua untracked/órfã,
> decisão do Cleber ainda pendente — não incluída no commit acima)

---

# Handoff da sessão anterior (2026-07-31, fim de sessão) — histórico, não é mais o estado atual

> **Estado**: branch `dev`, `origin/dev` **em dia** com tudo desta sessão até
> o commit `da72c4b54` (push já confirmado pelo Cleber). Working tree tem
> **1 mudança nova ainda não commitada** (campo `entrySignal` no construtor
> de estratégia — ver seção "O que está no working tree agora").
>
> **Leitura obrigatória antes de tocar no motor**: `CLAUDE.md` pendência #5
> (estado dos componentes do cérebro) + `research/AI_BRAIN_SPEC.md` seção 14
> (encerramento formal da busca por edge de sinal — decide o que é e não é
> viável pedir do cérebro).

## Resumo pra abrir a nova janela

1. Ler este arquivo inteiro.
2. Rodar `git status` — deve mostrar só `StrategyBuilderPro.tsx` modificado
   (mais este próprio arquivo, se ainda não foi commitado). Se houver mais
   coisa, alguém mexeu depois desta sessão.
3. Ler `CLAUDE.md` pendência #5 antes de tocar no motor de novo.

**Estado em uma frase**: o cérebro está sendo evoluído de "motor de risco
parcial" pra "motor de execução autônomo, sem previsão de direção"; nesta
sessão o foco foi **acurácia do backtest** (rodava com custo zero —
corrigido), **configurabilidade** (capital inicial, contratos fracionários)
e **usabilidade do construtor de estratégia** (exposto de volta na UI de IA,
direção de sinal agora explícita em vez de inferida por heurística).

---

## O que foi feito nesta sessão (ordem cronológica, tudo commitado exceto o último item)

1. **Fix: contratos fracionários no backtest** (`b77fc63ae`) — campo
   "Contratos" na config de backtest não aceitava `0.01` (estava com
   `parseInt`/`step=1`). Trocado pra `parseFloat`/`step=0.01`/`min=0.01`.

2. **Fix: backtest rodava com custo ZERO** (`2599939e8`) — achado central da
   sessão, em resposta à pergunta do Cleber "qual a acurácia do backtest?".
   `useBacktestLiveProgress.ts` chamava `runBacktest()` sem passar
   `roundTripCostPercent`, então todo resultado de backtest na UI era
   **bruto**, não líquido — sistematicamente mais otimista que qualquer
   execução real. Corrigido: agora calcula classe de ativo via
   `SymbolMappingService`, preço de referência (último candle) e ponto/valor
   via `TradeSizing`, e passa pelo `CostModel.ts` (`estimateCostPercent`,
   ida e volta) — mesma convenção usada em `useApexLogic.ts` e nos scripts de
   pesquisa. `BacktestResultsModal.tsx` ganhou aviso explícito: "Resultado
   líquido — já descontado o custo estimado de execução".
   - **Limitação conhecida, não resolvida**: forex sempre cai em
     `FOREX_MAJOR` por falta de granularidade minor/exotic no
     `SymbolMappingService` — pode subestimar custo nesses casos. Mesma
     aproximação já documentada em outras partes do código (ver pendência
     #5 do `CLAUDE.md`).

3. **Capital inicial do backtest, configurável** (`5fc4885e8`) — o
   `$10,000.00` que aparecia nos resultados era hardcoded e sem explicação
   na tela (Cleber perguntou "o que é isso, aonde entrega o resultado").
   Substituído o bloco "Quantidade" (Contratos/Máximo) por um campo único
   "Capital Inicial do Teste" em `BacktestConfigModal.tsx`, com texto
   explicativo deixando claro que é capital **fictício da simulação**,
   independente do capital real configurado na IA. Fluxo completo:
   `BacktestConfigModal` → `ChartView.tsx` → `useBacktestLiveProgress.ts` →
   `BacktestEngine.ts`.

4. **Fix: painel de progresso do backtest não estava centralizado**
   (`5d60423d4`) — ajuste de UI, sem impacto no motor.

5. **Fix: renomear "Comparar com" → "Cruzar com"** (`dccc7969e`) — campo do
   construtor de estratégia tinha nome confuso pro tipo de condição que
   representa (cruzamento de indicador, não comparação estática).

6. **Reabrir acesso ao construtor de estratégia personalizada**
   (`4f710a354`, consolidado no squash final `da72c4b54`) — Cleber pediu "só
   insira um personalizado" depois de perceber que não dava mais pra criar
   estratégia customizada a partir das configurações de IA (`AITrader.tsx`).
   O `StrategyBuilderPro.tsx` já existia, completo e funcional — só estava
   sem rota de acesso. Adicionado botão "Criar personalizada" em
   `AITrader.tsx` que navega pra `ChartView.tsx` com o builder já aberto
   (bridge de navegação nova em `App.tsx`: `chartInitialAction` +
   `handleCreateCustomStrategy`).

7. **Componente 4 do cérebro de execução, fix de segurança** (pronto de
   sessão anterior, commitado nesta: `768356c93`) — Kill-Switch e Health
   Check só impediam abrir trade **novo**, nenhum dos dois fechava posição
   LIVE já aberta na corretora quando o limite disparava. Novo módulo
   `LiveEmergencyClose.ts` (`forceCloseAllLivePositions()`, retry
   exponencial 5x + confirmação via `getPositions()`, nunca assume sucesso
   só pela resposta da API) ligado em `useApexLogic.ts` nos dois pontos de
   gatilho (kill-switch síncrono e transição pra safe-mode), só em modo
   `LIVE`.

**`npm run validate` rodou tudo verde** (14+13 casos, Componentes 1 e 5) após
todas as mudanças acima, incluindo o item 8 abaixo (ainda não commitado).

---

## O que está no working tree agora (não commitado)

- **`src/app/components/backtest/StrategyBuilderPro.tsx`** — campo
  `entrySignal?: 'BUY' | 'SELL'` adicionado ao tipo `Strategy` e à UI (aba
  Entrada), agora **obrigatório** pra salvar uma estratégia customizada nova.
  Motivo: `StrategyEvaluator.ts` tinha um fallback de inferência de direção
  por contagem de operador (`CROSS_BELOW`/`BELOW`/`FALLING` → "bearish" →
  SELL) que é correto pra breakout/trend-following mas **errado** pra
  reversão à média (ex: "Estocástico cruza abaixo de 20" é sinal de
  **compra** — sobrevenda — não de venda; já inverteu um preset em produção
  antes, ver `presetStrategies.ts` comentário na linha ~159). Agora o
  usuário escolhe explicitamente Compra/Venda na UI, sem depender do
  fallback heurístico.
  - **Já wired de ponta a ponta**: tipo em `types/strategy.ts`, consumido em
    `StrategyEvaluator.ts:226` (`if (strategy.entrySignal) signal =
    strategy.entrySignal`), presets em `presetStrategies.ts` todos com
    `entrySignal: 'BUY'` (são todos long-only por implementação, então o
    fallback nunca os afetou), passado por `ChartView.tsx:6330`.
  - **`npm run validate` já rodou verde depois desta mudança também.**
  - **Ainda não commitado** — comandos prontos abaixo pro Cleber rodar.

```bash
git add src/app/components/backtest/StrategyBuilderPro.tsx NEXT_SESSION.md
git commit -m "feat: campo obrigatório de direção (Compra/Venda) no construtor de estratégia personalizada"
git push
```

- **`research/experiments/2026-07-30-fase2-remediation/`** (untracked,
  órfã, herdada de sessão anterior, trabalho incompleto) — decisão do Cleber
  ainda não tomada, considerar descartar se ele não quiser retomar.

---

## Próximo passo (ordem acordada com o Cleber em sessão anterior, não iniciado)

Decisão de arquitetura fechada em sessão anterior (não repetir a discussão —
ver `CLAUDE.md` pendência #5 e `AI_BRAIN_SPEC.md` seção 14 pro histórico
completo): "operar sempre que possível" = frequência é resultado do gate de
custo/risco, nunca meta em si; "decidir qual ativo vai render mais" =
ranking mecânico por facilidade de execução (ATR/preço, custo/spread),
nunca previsão de retorno (reabriria o Trilho 2, pausado); agenda econômica
= só feed ao vivo, filtro de "evitar operar", nunca sinal de direção.

Faltam 2 blocos, nesta ordem sugerida (podem ser feitos em paralelo entre
si, mas só depois do Componente 4, que já está pronto e commitado):

1. **Ranking mecânico de ativos elegíveis** — novo módulo (ex:
   `AssetRankingService.ts`). Para cada ativo selecionado pelo usuário:
   calcula ATR/preço (volatilidade relativa) e custo/spread estimado, passa
   pelo `CostViabilityGate` (já existe, `src/app/services/risk/
   CostViabilityGate.ts`), e rankeia os que passam por "melhor relação
   movimento esperado / custo" — **nunca por previsão de retorno**. Ativos
   que falham no gate ficam de fora, com motivo registrado (auditável, mesmo
   padrão de nunca fabricar dado). Zero linha escrita ainda.
2. **Autonomia de entrada/saída automática** (Estágio 3 da spec, seção
   9.1) — liga `useApexLogic.ts` a `BrokerClient.ts` pra abrir/fechar posição
   automaticamente conforme o setup configurado pelo usuário (modo alvo,
   regras técnicas já existentes). Zero linha escrita ainda.
3. **Agenda econômica como filtro "evitar operar"** — novo módulo (ex:
   `EconomicCalendarGuard.ts`). Precisa escolher fonte de feed ao vivo grátis
   (pesquisa não feita ainda) antes de implementar. Bloqueia novas entradas N
   minutos antes/depois de evento de alto impacto no ativo em questão.
   Marcado explicitamente como "não validado estatisticamente" na UI/logs —
   é proteção, não sinal.

Nenhum dos 3 tem decisão de qual começar primeiro entre (1) e (3) — só a
ordem "ambos depois do Componente 4" foi fechada.

---

## Pendências reais herdadas (sem mudança nesta sessão)

Ver `CLAUDE.md` seção "Pendências reais em aberto" pra lista completa. As que
seguem relevantes pro trabalho no cérebro:
- **`Marketplace.tsx:30`** — "87% win rate" hardcoded, arquétipo scalping (o
  pior já medido). Ainda mais urgente sob a decisão (B) de produto (produto
  sem edge não pode exibir acurácia). Cleber informado, não decidiu.
- **Correlação de portfólio calculada ao vivo** (só existe heurística
  estática por grupo hoje) — TODO citado no `RISK_MODULE_SPEC.md` seção 3.5,
  não é bloqueante pro trabalho atual mas fica em aberto.

---

## Lembretes fixos

- **Comunicação sempre em português do Brasil**
- **Nunca `git commit`/`git push` sozinho** — entregar comandos prontos pro Cleber
- **Nunca fabricar dado** — erro explícito quando não há fonte real
- **`npm run validate` obrigatório** antes de qualquer commit que toque o motor
- **Todo experimento salva output em arquivo**, nunca só em prosa
- **Ler `CLAUDE.md` inteiro antes de tocar no motor de decisão**;
  `AI_BRAIN_SPEC.md` é o histórico de pesquisa detalhado
- **Rigor de especialista + honestidade radical, permanente** — nunca inflar
  número, nunca esconder achado negativo, sempre reportar o dado que sustenta
  (ou a ausência dele, declarada)
- **Cérebro é motor de execução/disciplina, não de alfa** (decisão (B),
  30/07) — qualquer proposta de "prever qual ativo/direção vai render mais"
  precisa ser sinalizada como reabertura do Trilho 2, não feature comum
