# Sessão 2026-08-21 — Gate de notícias/VIX real no motor + IA Preditiva

## Gatilho

Cleber pediu consultoria sobre a sessão "IA Preditiva" (pobre/rasa) e cinco
ideias de previsão. Ao investigar o que já existia, apareceram dois achados
mais importantes que a consultoria original: um bug real no motor de
produção e um card do Dashboard que era puro placeholder.

## Achado 1 (crítico) — gate de notícias/VIX existia mas nunca rodava no servidor

`aiConfig.newsFilter` (ligado por padrão) e o VIX do `TailRiskGuard` (Bloco
E) dependem de `TradingCycleDeps.fetchNewsCached`/`fetchVIXCached`. No
driver browser (`useApexLogic.ts`) isso sempre funcionou. No **`ai-runner`**
— o motor que opera de verdade em produção 24/7 (ver CLAUDE.md) — os dois
eram stubs mortos:

```ts
cachedNewsEvents: [],                          // nunca preenchido
fetchNewsCached: async () => s.cachedNewsEvents,
cachedVIX: 0,                                  // nunca preenchido
fetchVIXCached: async () => s.cachedVIX,
```

O gate rodava, mas a lista de eventos estava sempre vazia — nunca bloqueava
nada de verdade no servidor. Mesmo bug de padrão no VIX (nunca disparava por
choque sistêmico no servidor), apesar do `AI_COGNITIVE_SPEC.md` dizer "VIX
está ligado" — essa verificação só cobria o driver browser.

**Fix**: [`supabase/functions/ai-runner/lib/marketContext.ts`](supabase/functions/ai-runner/lib/marketContext.ts)
(novo) busca agenda econômica real e VIX real via os mesmos endpoints reais
que o browser já usa (`server/economic-calendar`, `server/vix`), chamados
por `fetch` nativo do Deno. `ai-runner/index.ts` busca esse contexto uma vez
por invocação e injeta em toda sessão `RUNNING` antes do ciclo rodar.

## Achado 2 — fallback de VIX fabricado alimentava o motor

O endpoint `/vix` (client `vixDataSources.ts` e o `server/index.ts`) tem um
fallback que **inventa um valor** (`18.71` fixo ou com ruído aleatório,
`source: 'Fallback (Estimativa)'`) quando as 3 fontes reais falham — e nada
distinguia isso de um VIX real pra quem consome o número. Corrigido: o
`marketContext.ts` novo rejeita esse fallback (`null` = "sem VIX real"), e
`useApexLogic.ts` (`fetchVIXCached`) também passou a descartar o fallback em
vez de aceitar como se fosse real. Removido também o `|| 15` do catch —
outro número fabricado que existia só pra "sempre ter um valor".

## Achado 3 — gate de notícias era um blackout cego, não por moeda

Além de nunca rodar no servidor, o gate — quando rodava — pausava o ciclo
**inteiro** (todos os ativos) por qualquer evento de alto impacto de
qualquer moeda. Ex: evento de JPY travava XAUUSD, que não tem exposição real
a JPY. Corrigido: extraída `getRelevantCurrencies()` (já existia duplicada
dentro de `RiskThermometer.tsx`) pra
[`NewsCurrencyRelevance.ts`](src/app/services/risk/NewsCurrencyRelevance.ts),
única fonte de verdade. O gate virou **por candidato** dentro de
`analyzeAsset()` (`runTradingCycle.ts`) — só veta o ativo cuja moeda bate
com a do evento; outro candidato do ranking segue elegível no mesmo ciclo.

Novo veto `NEWS_GATE` grava em `ai_decisions.veto_stage` como qualquer outro
gate — precisou de migration nova porque o CHECK constraint da coluna é uma
lista fechada
([`20260821_add_news_gate_veto_stage.sql`](supabase/migrations/20260821_add_news_gate_veto_stage.sql),
**pendente de aplicar no SQL Editor**). `FunnelTelemetry.ts`: o estágio
`TICK_NEWS_BLACKOUT` (saída de ciclo) virou `ASSET_NEWS_BLACKOUT` (saída por
ativo), mantendo a lista fechada e exaustiva consistente.

## Achado 4 — `AIPredictiveCard.tsx` era placeholder, e num arquivo morto

O card "IA Preditiva" do Dashboard (`AIPredictiveCard.tsx`) só mostrava
"🚀 Em breve", sem dado nenhum. Pior: ele estava importado só em
`ModularDashboard.tsx`, que **não é roteado em lugar nenhum de `App.tsx`** —
código morto. O Dashboard que os usuários realmente veem é `Dashboard.tsx`,
que nunca importava esse card.

Reconstruído como **"Viabilidade de Execução"**: mostra em tempo real o
mesmo `CostViabilityGate` (custo round-trip vs. distância até o alvo) que o
motor aplica antes de cada trade, pro ativo selecionado no Dashboard — sem
fetch novo (reaproveita `dashboardScoreResult`/`getLastKnownRealPrice`, já
calculados pelo `MarketScoreBoard`, mesmo padrão que `RiskThermometer.tsx`
já usava pra não dobrar carga na conta MetaAPI compartilhada). Wireado de
fato em `Dashboard.tsx` (não mais só no `ModularDashboard.tsx` morto) e
verificado ao vivo no browser: renderizou `Viável`, custo 0.029%, distância
até alvo 1.793%, classe `CRYPTO`, ATR 370.38 — números reais, não fabricados.

## Achado 5 — dois arquivos de dado 100% fabricado, removidos/confirmados mortos

- **`MacroIndicators.tsx`** — VIX fixo (18.42), variação por ativo hardcoded
  (EUR/USD ±0.45% etc.), mini-gráfico com array fixo. Não era importado em
  lugar nenhum do app real — **deletado**.
- **`src/app/modules/predictive-ai/`** — módulo documentado num README
  próprio, com detecção de baleia via `Math.random()`, spoofing/iceberg
  fabricados. Confirmado como não importado por nada rodando (só
  auto-referência e dumps de log antigos em `src/imports/pasted_text/`) —
  **não tocado, mas confirmado morto**, não é o que aparece na tela.

A página real do sidebar "IA Preditiva" é `src/app/components/innovation/LiquidityPrediction.tsx`
— **já é real**: confidence/viés vêm do `MarketScoreEngine`, pivô de
candle real, book de profundidade real da Binance (só cripto, honesto sobre
isso). Um cleanup anterior (2026-07-28, comentário no próprio arquivo) já
tinha removido ~17 templates de alerta fabricados (baleia, spoofing,
iceberg). Não fabricado, mas raso — só cripto tem book, um ativo por vez.

## Verificação

`npm run validate` (37/37) limpo em cada mudança. `deno check` no
`ai-runner/index.ts` sem erro novo (os 4 erros que aparecem são
pré-existentes, confirmado rodando o mesmo check com `git stash`).
Verificação visual no browser (dev server local): card de custo renderizando
dado real, sem erro de console além do ruído de rede já conhecido
(451/CORS de fontes geo-bloqueadas, documentado em outras sessões).

## Pendente

1. **Aplicar migration** `20260821_add_news_gate_veto_stage.sql` no SQL
   Editor — sem isso, o primeiro `NEWS_GATE` real em produção falha o
   INSERT em `ai_decisions` com "violates check constraint".
2. **Redeploy do `ai-runner`** (`supabase functions deploy ai-runner --no-verify-jwt`)
   — sem isso, o fix de notícia/VIX real não está em produção, só local.
3. **Commit/push** — nenhum `git add`/`commit`/`push` foi executado (regra
   fixa do projeto).
4. Calibração do `confidence` (Brier score/curva de calibração) e ativação
   do `asset_performance_scorecard` **não foram feitas** — pedido de "tudo
   implementado agora" foi recusado nesses dois pontos especificamente, por
   exigirem dado/pesquisa que não existe ainda (ver seções já existentes no
   CLAUDE.md sobre os dois).

## Arquivos tocados

- `supabase/functions/ai-runner/lib/marketContext.ts` (novo)
- `supabase/functions/ai-runner/index.ts`
- `src/app/hooks/useApexLogic.ts`
- `src/app/services/risk/NewsCurrencyRelevance.ts` (novo)
- `src/app/services/strategy/runTradingCycle.ts`
- `src/app/services/telemetry/FunnelTelemetry.ts`
- `src/app/components/dashboard/RiskThermometer.tsx`
- `src/app/components/dashboard/AIPredictiveCard.tsx`
- `src/app/components/Dashboard.tsx`
- `src/app/components/dashboard/MacroIndicators.tsx` (removido)
- `supabase/migrations/20260821_add_news_gate_veto_stage.sql` (novo)
