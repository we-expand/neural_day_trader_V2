# Sessão 2026-07-31 (continuação) — Ponte decisão→execução: correção de estado + Estágio 3

**Status**: ✅ Código commitado (2 commits, ver abaixo)
**Contexto**: continuação da sessão `SESSAO_2026-07-31_DEVLAB_AUDITORIA.md` (mesma data, janela nova)

---

## Achado principal: `CLAUDE.md` estava desatualizado

A sessão começou com "o que falta pro cérebro da IA funcionar 100%?". O `CLAUDE.md` dizia que a
ponte decisão→execução (Fase 6) não tinha nenhuma linha de código escrita. **Isso estava errado** —
uma sessão anterior (mesmo dia, mais cedo) já tinha implementado e commitado:

- **Estágio 1** (LIVE + só alerta) — `src/app/modules/liveAlertStage/`
- **Estágio 2** (LIVE + confirmação manual por trade) — `src/app/modules/tradeConfirmationStage/`
- **Fix do hard-stop** — kill-switch/Health Check Guardian agora chamam
  `forceCloseAllLivePositions()` de verdade quando safe mode dispara em LIVE
  (`src/app/services/risk/LiveEmergencyClose.ts`, commit `768356c93`)

Achado via `git log` + leitura direta do código, não do `CLAUDE.md`. **Lição**: antes de reportar
"o que falta", checar `git log` e o código, não confiar só no arquivo de estado — ele não estava
sendo atualizado na mesma sessão em que o trabalho era feito.

O `SESSAO_2026-07-31_DEVLAB_AUDITORIA.md` (handoff da sessão anterior, mesma data) tinha a lista
correta e atualizada do que faltava — foi a fonte real usada para decidir o que fazer nesta sessão.

---

## O que foi entregue nesta sessão

### 1. Ranking mecânico de ativos elegíveis
- `src/app/services/risk/AssetEligibilityRanking.ts` — função pura `rankEligibleAssets()`.
- Rankeia candidatos por **fração de custo sobre movimento típico** (reaproveita
  `CostViabilityGate.evaluateCostViability`), ascendente. Ativos `INVIAVEL`/`FRONTEIRA`
  nunca entram no ranking, só em `rejected` com motivo.
- **Critério é de qualidade de risco, não de alpha** — decisão (B) de `AI_BRAIN_SPEC.md`
  seção 14.5: não existe sinal com edge comprovado, então rank por "probabilidade de acerto"
  seria fabricar confiança que não existe.
- `src/app/services/risk/__validate__ranking__.ts` — 9 asserções, entrou em `npm run validate`
  (editado `scripts/validate.mjs`).
- **Ainda não wireado em `useApexLogic.ts`** — existe como módulo pronto, chamável, mas a
  seleção de ativo do motor ainda não o usa. Próximo passo se for continuar essa frente.

### 2. Estágio 3 — execução automática real (lote mínimo travado)
- `src/app/modules/autoExecutionStage/useAutoExecutionStage.ts` — mesmo padrão isolado dos
  Estágios 1/2 (lê decisão via callback `onLiveDecision`, não reaproveita `useApexLogic.ts`).
- **Diferença central**: sem aprovação humana por trade — a decisão do motor vira ordem real
  sozinha. Por isso é mais travado, não menos:
  - `minLockedLotSize()` — **ignora `decision.amount`**, sempre usa `asset.minLot`. Remover
    essa trava é o Estágio 4 (`AI_BRAIN_SPEC.md` 9.1), fora de escopo.
  - Bloqueia toda ordem nova em safe mode (o fechamento de posição já aberta é responsabilidade
    do Health Check Guardian, que já existe — este módulo não duplica isso).
  - Disclaimer permanente em todo evento/toast.
  - **Opt-in, desligado por padrão**, chave de localStorage própria
    (`neural_auto_execution_stage_enabled`).
- `src/app/modules/autoExecutionStage/AutoExecutionPanel.tsx` — UI análoga ao painel do
  Estágio 2, com **confirmação extra via `window.confirm()`** só pra LIGAR (nunca pra desligar) —
  dado que isso é a única ação de UI que tira o humano do loop de aprovação por trade.
- Fiado em `src/app/contexts/TradingContext.tsx` (novo estado + `useAutoExecutionStage`) e
  `src/app/components/AITrader.tsx` (import do painel + props do contexto).
- **Precedência quando mais de um estágio está ligado em LIVE ao mesmo tempo**: Estágio 3 >
  Estágio 2 > Estágio 1 (do mais consequente pro menos, decisão nunca duplicada entre estágios) —
  implementado em `forwardLiveDecision` no `TradingContext.tsx`.

**Decisão de produto ainda em aberto, não resolvida nesta sessão**: `AI_BRAIN_SPEC.md` seção 9.1
registra a pergunta "vale avançar além do estágio 2 sem edge comprovado?" como não decidida por
você. O `CLAUDE.md` dizia que isso tinha sido respondido pela decisão (B) de 2026-07-30
("destravado pra implementar") — eu constatei essa contradição, expus o risco explicitamente
antes de implementar, e você confirmou avançar mesmo assim. O código está pronto e testado, mas
**desligado por padrão** — ativar em produção continua sendo decisão sua, não automática.

### 3. Limpeza de código morto (pipeline de preço)
Removidos 7 arquivos confirmados **sem nenhum importador real** em todo `src` (grep verificado
antes de apagar, únicos "hits" eram menções em `src/imports/pasted_text/*`, que são logs colados,
não código):
- `src/app/hooks/useRealtimePrice.ts`
- `src/app/hooks/useMarketPrice.ts`
- `src/app/components/monitoring/DataSourceMonitor.tsx`
- `src/app/components/debug/QuickDataTest.tsx`
- `src/app/components/debug/PriceAccuracyMonitor.tsx`
- `src/app/utils/testDataSystem.ts`
- `src/app/utils/marketDataTest.ts`

Type-check do app foi de 670 → 654 erros (redução real). `npm run validate` verde antes e depois.

**Não apagado, de propósito**: `DataSourceRouter.ts`, `UnifiedMarketDataService.ts`,
`MetaApiService.ts` — apesar de o `CLAUDE.md` chamar de "pipeline morto", eles **ainda são
importados por componentes ao vivo** (`MarketScoreBoard.tsx`, `MarketTicker.tsx`,
`unifiedMarketData.ts` → `UnifiedDataTester` renderizado em `App.tsx`). "Não usado pelo caminho
crítico de decisão" (verdade, `useApexLogic.ts` não depende deles) ≠ "não usado por nada".
Apagar exigiria reescrever esses componentes de UI pra usar só `RealMarketDataService`, com teste
manual no navegador — trabalho maior, arriscado o bastante pra merecer sessão própria.

---

## Verificação

```bash
npm run validate   # motor: verde, 33+9 asserções (ranking novo incluso)
```
Type-check do app inteiro (`tsc -p tsconfig.json`, fora do gate por ter ~650 erros herdados,
não relacionados a este trabalho): confirmado via `git stash`/`pop` que os commits desta sessão
não introduziram nenhum erro novo — só reduziram (limpeza de código morto).

Não testado no navegador (mudança de lógica de risco financeiro/backend, não visual) —
recomendo testar o toggle do Estágio 3 em modo DEMO antes de qualquer uso em LIVE real.

---

## Git — já commitado nesta sessão

```
84bebdc26 chore: remove código morto órfão do pipeline de preço (7 arquivos sem importador real)
eabb377dc feat: ranking de ativos elegíveis + Estágio 3 (execução automática, lote mínimo travado)
```

Ambos já commitados por você (confirmado via `git log`) — nada pendente de commit desta sessão.

### Ainda untracked (não é desta sessão, decisão sua)
```
research/experiments/2026-07-30-fase2-remediation/   # pasta órfã de sessão anterior
```

---

## Próxima sessão — ordem sugerida (do `SESSAO_2026-07-31_DEVLAB_AUDITORIA.md`, item 3 ainda pendente)

1. **Ligar `AssetEligibilityRanking.ts` no motor** — hoje é módulo pronto mas não chamado por
   `useApexLogic.ts`. Precisa decidir de onde vem `typicalMovementPercent` ao vivo (mesma
   aproximação ATR(14) já usada pelo `CostViabilityGate` em produção, ou algo mais fiel).
2. **Agenda econômica como filtro "evitar operar"** — bloqueado por falta de fonte grátis de
   calendário com histórico (achado em 2026-07-27, seção 13.8 do `AI_BRAIN_SPEC.md`). Sem
   novidade desde então.
3. **Marketplace com número fabricado** (`src/app/components/Marketplace.tsx:30`, "87% win rate")
   — investigado nesta sessão mas **não tratado ainda**: o arquivo inteiro tem 8 produtos com
   rating/reviews/sales 100% hardcoded, não é só o win rate de um item. Você interrompeu antes de
   eu decidir tratamento — precisa decisão sua sobre o que fazer com o Marketplace inteiro (remover
   catálogo fake, substituir por produtos reais, ou outra rota).
4. **Correlação de retornos ao vivo** (RISK_MODULE_SPEC.md seção 3.5) — só existe versão
   heurística por grupo estático ainda.
5. **Diagnóstico de eficiência de saída** (`TradeEfficiencyDiagnostic.ts`) — implementado, mas
   ainda não ligado a nenhuma tela.

## Ler antes de continuar
```bash
cat CLAUDE.md                          # pendências reais — mas checar git log também, viu ficar defasado
cat research/AI_BRAIN_SPEC.md          # seção 9.1 (ponte), 14.5 (decisão B)
cat SESSAO_2026-07-31_DEVLAB_AUDITORIA.md   # handoff da sessão anterior, mesma data
npm run validate
```

## Lembretes fixos
- Comunicação sempre em PT-BR.
- Nunca fabricar dado — sempre evidência real ou erro explícito.
- `npm run validate` obrigatório antes de qualquer commit que toque decisão/risco.
- Git: você faz `git commit`/`push`, eu entrego comandos prontos.
- Ativar o Estágio 3 em produção é decisão sua — código pronto, mas desligado por padrão.

---

**Handoff completo. Pronto pra continuar em nova janela.**
