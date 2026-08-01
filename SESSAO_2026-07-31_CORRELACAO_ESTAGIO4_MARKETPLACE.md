# Sessão 2026-07-31 (continuação) — Correlação ao vivo, Estágio 4, cooldown, diagnóstico de saída, marketplace

**Status**: ✅ Código implementado, `npm run validate` passa 100% (208 asserções). ⚠️ **Ainda não commitado nem enviado** — comandos prontos na seção final, o Cleber precisa rodar manualmente.
**Contexto**: continuação de `SESSAO_2026-07-31_PONTE_EXECUCAO.md` (mesma data, janela nova).

---

## Como a sessão começou

Pergunta do Cleber: "como está o desenvolvimento do cérebro? Está faltando algo?". Resposta baseada
no `CLAUDE.md` já corrigido pela sessão anterior — 5 lacunas reais identificadas:

1. Correlação de retornos calculada ao vivo (hoje só heurística estática por grupo de ativo).
2. Estágio 4 da ponte decisão→execução (remover trava de lote mínimo do Estágio 3).
3. Cooldown pós-perdas consecutivas + limite rígido de trades/dia (desenhado na spec, não implementado).
4. Diagnóstico de eficiência de saída (`TradeEfficiencyDiagnostic.ts`) existia mas não estava ligado a nenhuma tela.
5. `Marketplace.tsx` anunciava "Neural Scalper Pro — 87% win rate" fabricado, no arquétipo que a própria pesquisa mediu como o pior de toda a investigação.

Cleber pediu para executar as 5. Trabalho delegado a um agente em background com instruções
detalhadas (paths exatos, convenções do projeto, gate `npm run validate` obrigatório).

---

## O que foi entregue

### 1. Correlação de retornos ao vivo
- `src/app/services/risk/LiveCorrelationGuard.ts` — `computeLiveCorrelationGuard()`, correlação de
  Pearson real sobre log-returns das posições abertas, usando candle já em buffer no motor
  (`candleBufferRef` de `useApexLogic.ts`) — **zero chamada de rede extra**.
- Se não há histórico de preço suficiente para um par, a função **recusa calcular** (não estima,
  não fabrica) — cai de volta no guard heurístico estático antigo (`getCorrelationGroup`), mantido
  como fallback e documentado em comentário.
- `src/app/services/risk/__validate__correlation__.ts` — 16 asserções, na suíte do `npm run validate`.
- Precisou adicionar `'CORRELATION_GUARD'` ao union `DecisionVetoStage` em
  `AITradingPersistenceService.ts`.
- **Migration nova, NÃO aplicada**: `supabase/migrations/010_ai_decisions_correlation_guard.sql` —
  precisa rodar no SQL Editor do Supabase manualmente antes do veto de correlação aparecer
  corretamente no histórico de decisões.

### 2. Estágio 4 da ponte decisão→execução (lote real, não mínimo travado)
- `src/app/modules/fullSizeExecutionStage/useFullSizeExecutionStage.ts` +
  `FullSizeExecutionPanel.tsx` — mesmo padrão isolado dos Estágios 1-3.
- Usa `amountToLotSize(decision.amount)` (sizing real do motor) em vez de `asset.minLot` fixo.
- **Pré-requisito rígido**: só pode estar ligado se o Estágio 3 também estiver ligado — reforçado em
  dois lugares (dentro do próprio hook e em `TradingContext.tsx`, que desliga o 4 automaticamente se
  o 3 for desligado).
- Precedência em `forwardLiveDecision`: Estágio 4 > 3 > 2 > 1.
- Montado em `AITrader.tsx`. Desligado por padrão, mesmo disclaimer permanente dos outros estágios.

### 3. Cooldown pós-perdas consecutivas + limite de trades/dia
- **Achado real durante a implementação**: essa lógica **já existia**, mas solta inline dentro de
  `useApexLogic.ts` (contrariando a premissa de que faltava implementar do zero).
- Extraída para funções puras testáveis em `src/lib/modules/RiskManager.ts`:
  `evaluateCooldownGate()` e `evaluateMaxTradesPerDayGate()` — sem mudar comportamento existente,
  só isolando pra ficar testável.
- `src/app/services/risk/__validate__cooldown__.ts` — 12 asserções.

### 4. Diagnóstico de eficiência de saída ligado à UI
- `src/app/components/performance/TradeEfficiencyPanel.tsx` — novo, montado em `Performance.tsx`
  logo após o histórico de trades.
- Botão sob demanda (evita custo de rede a cada render). Mostra `exitEfficiency` e
  `gaveBackPercent` por trade + agregado.
- Texto explícito na UI: **"análise RETROSPECTIVA"**, não previsão — mesma disciplina de
  comunicação do resto do produto. Estado vazio honesto quando não há trades fechados suficientes.

### 5. Marketplace — remoção do claim fabricado
- Removido o item `strat-001` ("Neural Scalper Pro", 87% win rate + rating/reviews/vendas
  fabricados) do catálogo em `Marketplace.tsx`. Decisão documentada em comentário no código.
- **Limitação NÃO tratada, ficou fora do escopo pedido**: os outros 7 produtos do catálogo também
  têm rating/reviews/vendas fabricados. Não removidos nem corrigidos — só o item de scalping (o
  citado explicitamente) foi tratado. Corrigir os demais exigiria tornar campos do schema
  `Product` opcionais sem quebrar a página.

---

## Resultado do gate

```
npm run validate
```
✅ Sucesso total — 208 asserções determinísticas (28 novas desta sessão: 16 de correlação + 12 de
cooldown/limite de trades), type-check estrito (`tsconfig.engine.json`) zerado.

---

## Arquivos alterados (não commitados ainda)

```
 M CLAUDE.md
 M SESSAO_2026-07-31_DEVLAB_AUDITORIA.md
 M scripts/validate.mjs
 M src/app/components/AITrader.tsx
 M src/app/components/Marketplace.tsx
 M src/app/components/Performance.tsx
 M src/app/contexts/TradingContext.tsx
 M src/app/hooks/useApexLogic.ts
 M src/app/modules/autoExecutionStage/useAutoExecutionStage.ts
 M src/app/services/AITradingPersistenceService.ts
 M src/lib/modules/RiskManager.ts
?? research/experiments/2026-07-30-fase2-remediation/
?? src/app/components/performance/TradeEfficiencyPanel.tsx
?? src/app/modules/fullSizeExecutionStage/
?? src/app/services/risk/LiveCorrelationGuard.ts
?? src/app/services/risk/__validate__cooldown__.ts
?? src/app/services/risk/__validate__correlation__.ts
?? supabase/migrations/010_ai_decisions_correlation_guard.sql
```

---

## Próximo passo — comandos pro Cleber rodar

```bash
cd /Users/clebercouto/Projects/we-expand/Neural-Day-Trader && git add -A && git commit -m "$(cat <<'EOF'
feat: correlação ao vivo, Estágio 4, cooldown extraído, diagnóstico de eficiência na UI, remove claim fabricado do marketplace

- LiveCorrelationGuard: correlação de Pearson real sobre log-returns (candle buffer), fallback pro heurístico estático quando falta dado
- Estágio 4 da ponte decisão→execução: usa sizing real em vez de lote mínimo, dependente do Estágio 3 ligado
- Cooldown pós-perdas consecutivas + limite de trades/dia extraídos para funções puras testáveis em RiskManager
- TradeEfficiencyPanel: liga TradeEfficiencyDiagnostic (MFE/MAE real) à tela de Performance, sob demanda
- Marketplace: remove item "Neural Scalper Pro" com win rate/rating/vendas fabricados
- npm run validate: 208 asserções, 0 falhas
EOF
)"
git push origin dev
```

**Lembrete importante**: `main` serve página de manutenção de propósito — o deploy real (preview
protegido) sai da branch `dev`, não vai aparecer em `www.neuraldaytrader.com`. Ver memória
`neural-day-trader-deploy-arquitetura`.

Depois do push, aplicar manualmente no SQL Editor do Supabase:
`supabase/migrations/010_ai_decisions_correlation_guard.sql`.

## Pendências que sobraram em aberto

- Rating/reviews/vendas fabricados nos outros 7 produtos do Marketplace (não tratados, fora do
  escopo desta sessão).
- Testar no navegador o fluxo real dos Estágios 1-4 e do fix do hard stop (só validado via
  `npm run validate` até agora, nunca em execução real/preview).
- `AI_BRAIN_SPEC.md` provavelmente também precisa de uma atualização curta citando o guard de
  correlação ao vivo (não verificado nesta sessão se foi atualizado).
