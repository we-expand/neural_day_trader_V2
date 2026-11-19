# Sessão 2026-08-19 (parte 3) — Pyramiding System: de decorativo a 100% real

> **Resumo rápido:** Cleber perguntou se o Pyramiding estava funcionando
> 100%. Não estava — break-even/emergency-stop viraram no-op silencioso
> depois do fix de autoridade de fechamento de 2026-08-18, Trailing Stop
> era 100% decorativo, e Take Profit Parcial/Fechar-em-Reversão nunca
> tiveram infraestrutura nenhuma. Implementado tudo em 4 fases, com
> validação entre cada uma. Terminou com o Pyramiding movido pra
> Configurações e unificado num único botão com proteção de risco embutida.

---

## Contexto de entrada

Continuação da mesma sessão de
[SESSAO_2026-08-19_GATE_DE_MARGEM.md](SESSAO_2026-08-19_GATE_DE_MARGEM.md).
Depois de resolver o falso alarme do deploy Vercel e diagnosticar/reverter
o experimento de R:R malsucedido (ver handoff), o Cleber perguntou
diretamente sobre o Pyramiding System.

---

## Diagnóstico inicial

Mapeamento completo do código (`useApexLogic.ts`, `PyramidingConfigPanel.tsx`,
`pyramidingManager.ts`) achou:

| Feature | Estado antes desta sessão |
|---|---|
| Abrir layers (scaling fixed/reduced/exponential) | ✅ Real |
| Break-even | ⚠️ Só em memória — **quebrado silenciosamente desde 2026-08-18** |
| Emergency Stop | ⚠️ Idem — logava sucesso, não protegia nada |
| Trailing Stop | ❌ 100% decorativo — config existia, motor nunca lia |
| Take Profit Parcial | ❌ Sem infraestrutura nenhuma |
| Fechar em Reversão | ❌ Sem infraestrutura nenhuma |
| AI Risk Analysis | ❌ Não implementado (UI já avisava) |
| scaling `fibonacci`/`smart-ai`, `entryDistanceType: ai-dynamic` | ❌ Honestamente desabilitado na UI |

**Causa raiz do break-even/emergency-stop quebrado**: desde 2026-08-18, o
cliente perdeu autoridade de fechar trade em DEMO (só o `ai-runner` fecha,
pra evitar a divergência de balance que já tinha corrompido dado em
produção). Break-even/emergency-stop do Pyramiding só ajustavam o SL em
memória (`setActiveOrders`) e nunca persistiam no banco — o servidor nunca
via o ajuste, então nunca fechava por causa dele.

---

## Fase 1 — Fix imediato: persistir SL do break-even/emergency-stop

Novo helper `updateTradeStopLoss` em `useAIPersistence.ts` (mesmo padrão de
`onTradeClose`, resolve id local→banco via `tradeDbIdsRef`). Chamado pelos
dois pontos do Pyramiding que ajustam SL em `useApexLogic.ts`. Corrige o
caso mais urgente primeiro (proteção de risco ativa numa sessão rodando na
hora).

**Verificado**: sem zumbis depois de desligar o teste (`ai_trades` sem
`status='OPEN'`, sessão `COMPLETED`).

---

## Fase 2 — Trailing Stop real + preparação pro fechamento em grupo

**Trailing Stop do Pyramiding** (`trailingStopEnabled/Type/Distance/PerLayer`)
implementado em `useApexLogic.ts`: ratcheta o SL a favor do trade (pips/
percent/atr), com ou sem `trailingStopPerLayer` (por camada vs. grupo
inteiro compartilhando um SL). Nunca solta o stop de volta.

**Bloqueio estrutural achado**: Take Profit Parcial e Fechar-em-Reversão
exigem FECHAR posição — autoridade só do servidor desde 08-18. Mas
`ai_trades` não tinha nenhuma coluna de grupo de pyramiding (`pyramidGroupId`/
`pyramidLayer` só existiam em memória no navegador). Sem isso, o `ai-runner`
não tinha como saber quais trades formam um grupo.

**Migration nova** (aplicada pelo Cleber):
`supabase/migrations/20260819_add_pyramid_group_columns.sql` — adiciona
`pyramid_group_id`/`pyramid_layer` em `ai_trades`. Cliente passou a persistir
o grupo ao abrir cada layer (`resolveDbTradeId`, `markPyramidRoot`).

---

## Fase 3 — Take Profit Parcial e Fechar-em-Reversão, no servidor

Implementados em `supabase/functions/ai-runner/lib/positionManager.ts` +
`index.ts`, únicos lugares com autoridade de fechamento:

- **`partialClosePosition`**: fecha uma fração sem UPDATE silencioso —
  insere uma linha `CLOSED` nova com a fração fechada (auditável) e reduz
  `quantity` da linha original, que continua `OPEN`. Se fechar 100%, a
  original também vira `CLOSED`.
- **Take Profit Parcial**: dispara quando o grupo atinge um dos
  `partialTakeProfitLayers`, fecha `partialTakeProfitPercent`% de cada
  camada. Trava contra disparo duplo no mesmo layer/invocação.
- **Fechar em Reversão**: usa `ai_decisions` (decisão REAL já gravada pelo
  motor por símbolo a cada ciclo avaliado — nunca fabricada) como sinal.
  Sem decisão recente disponível pro símbolo, não dispara.
- Balance/equity/snapshot recalculados e persistidos a cada fechamento
  parcial/reversão (`applyRealizedPnLAndSnapshot`, extraído do código que já
  existia pro TP/SL normal).

**Verificado**: `deno check` (só os 3 erros pré-existentes conhecidos),
`deno test seam_smoke_test.ts` (4/4), `npm run validate` (37/37).

---

## Fase 4 — Botão único + mudança de local

Dois pedidos do Cleber nesta etapa:

1. **Unificar em um botão só**: removido o toggle separado "AI Risk
   Analysis" (opt-in, nunca implementado — inventaria critério próprio de
   "momentum"/"divergência" que não existia em lugar nenhum do projeto).
   Decisão: reusar os 3 gates REAIS que toda entrada normal do motor já usa
   (`runTradingCycle.ts`), sem opt-in — Pyramiding ligado já inclui a
   proteção. Novo `evaluatePyramidLayerRiskGate` em `useApexLogic.ts`:
   - Limite de drawdown (mesmo `aiConfig.maxDrawdown` que o RiskManager usa).
   - `ContextGate` (mesmo gate de regime de mercado de toda entrada nova).
   - `CostViabilityGate` (mesma fórmula exata de `runTradingCycle.ts`: custo
     round-trip vs. distância até o alvo).
   
   Reativados na UI os toggles de Take Profit Parcial e Fechar em Reversão
   (Fase 3 já os tornou reais — antes apareciam como "não implementado").

2. **Mudança de local**: painel saiu da página principal do AI Trader
   (`AIToolsControl.tsx`, dialog "AI Trading Tools") e passou a viver em
   **Configurações → logo abaixo de "Alerta de Correlação entre Posições"**
   (`AITrader.tsx`).

**Verificado**: type-check limpo nos arquivos tocados (só erros
pré-existentes não relacionados em outros arquivos do projeto), `npm run
validate` 37/37, dev server compila sem erro novo (console só mostra erros
esperados de MT5/auth sem sessão logada).

---

## Estado final do Pyramiding System

| Feature | Status |
|---|---|
| Abrir layers | ✅ Real |
| Break-even | ✅ Real (corrigido) |
| Emergency Stop | ✅ Real (corrigido) |
| Trailing Stop | ✅ Real |
| Take Profit Parcial | ✅ Real (servidor) |
| Fechar em Reversão | ✅ Real (servidor, sinal de `ai_decisions`) |
| Proteção de risco (drawdown + ContextGate + CostViabilityGate) | ✅ Real, sempre ativa, sem opt-in |
| scaling `fibonacci`/`smart-ai` | ❌ Honestamente desabilitado na UI |
| `entryDistanceType: ai-dynamic` | ❌ Honestamente desabilitado na UI |

As duas únicas coisas ainda desligadas continuam **claramente marcadas**
como não implementadas — não fingem funcionar, consistente com a convenção
do projeto de nunca fabricar comportamento.

**Ainda não testado contra um ciclo completo real** (layer → break-even/
trailing → Partial TP/reversão → fechamento no servidor observado ao vivo)
— próximo teste 24/7 é a primeira chance de validar isso com dado real.

---

## Arquivos alterados

- `src/app/hooks/useAIPersistence.ts` — `updateTradeStopLoss`,
  `resolveDbTradeId`, `markPyramidRoot`.
- `src/app/hooks/useApexLogic.ts` — Trailing Stop real, persistência de
  grupo ao abrir layer, `evaluatePyramidLayerRiskGate`.
- `src/app/services/AITradingPersistenceService.ts` — colunas
  `pyramid_group_id`/`pyramid_layer` no tipo `AITrade`.
- `supabase/migrations/20260819_add_pyramid_group_columns.sql` — migration
  nova, **aplicada pelo Cleber**.
- `supabase/functions/ai-runner/lib/positionManager.ts` —
  `partialClosePosition`, `evaluatePyramidGroups`.
- `supabase/functions/ai-runner/index.ts` — integração do watchdog de
  pyramiding no `positionManagerTick`, `refreshReversalSignalCache`,
  `applyRealizedPnLAndSnapshot`.
- `src/app/components/trading/PyramidingConfigPanel.tsx` — remove toggle
  "AI Risk Analysis", reativa Partial TP/Reversão, textos atualizados.
- `src/app/components/dashboard/AIToolsControl.tsx` — remove o card
  "Pyramiding System" da página principal.
- `src/app/components/AITrader.tsx` — painel movido pra Configurações.

**Commits pendentes de push** (Cleber já rodou os commits locais durante a
sessão — confirmar `git log origin/dev` antes da próxima sessão).

---

## Pendências reais em aberto (herdadas desta sessão)

Ver [NEXT_SESSION.md](NEXT_SESSION.md) pra lista completa. As que nascem
desta parte da sessão:

1. **Deploy do `ai-runner` pendente** — a Fase 3 (Partial TP/Reversão) só
   existe no código, nunca rodou contra o Supabase real. Rodar
   `supabase functions deploy ai-runner --no-verify-jwt` antes do próximo
   teste 24/7.
2. **Primeiro ciclo completo real não observado** — layer → break-even/
   trailing → Partial TP/reversão → fechamento no servidor, tudo junto,
   ainda não visto acontecer com dado real.
3. Demais itens do CLAUDE.md/NEXT_SESSION.md sem mudança nesta parte
   (redução de custo por trade, zumbis item (b) reconciliação com
   corretora real, etc).
