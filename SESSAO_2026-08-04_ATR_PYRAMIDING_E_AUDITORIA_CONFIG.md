# Sessão 2026-08-04 — Auditoria de config, deadlock do Safe Mode, cobertura de ativos, ATR Trailing Stop e Pyramiding real

## Contexto

Sessão iniciada com o pedido "o que falta pra testar a AI Trader em modo Demo". Virou uma auditoria completa de vários pontos do motor de decisão (`src/app/hooks/useApexLogic.ts`) e da UI que expõe esses recursos.

## 1. Deadlock do Safe Mode (corrigido)

**Sintoma**: IA ligava e desligava sozinha em segundos, sempre com "SAFE MODE ATIVADO: taxa de acerto abaixo do mínimo".

**Causa raiz**: o gate de `minWinRate` usava `orderHistoryRef.current` inteiro (todo o histórico hidratado do Supabase, de qualquer sessão passada), não só os trades do dia/sessão atual — igual ao gate de perda diária (`dailyGateCutoff`). Uma conta com ≥10 trades perdedores de testes antigos ficava permanentemente em Safe Mode, e um outro `useEffect` resetava `isSafeMode` pra `false` assim que a IA era desligada — abrindo o ciclo pra o usuário tentar de novo e cair no mesmo problema.

**Fix**: `useApexLogic.ts` — gate de win rate agora usa `closedToday` (mesma janela de `dailyGateCutoff`, que respeita `resetLogic()` e virada de dia UTC) em vez do histórico completo.

**SQL de apoio** (opcional, pra zerar histórico de teste antigo): `supabase-tests/limpar_historico_teste_clebercouto.sql`.

## 2. Cobertura de ativos (corrigido)

**Sintoma**: usuário selecionava 15+ ativos no "Universo de Ativos" e a IA só analisava uns 5-6.

**Causa raiz**: o sorteio de ativo (`useApexLogic.ts`, seção "ASSET SELECTION") filtrava `aiConfig.activeAssets` contra uma tabela fixa de só 8 símbolos legados (`TRADING_SYMBOL_TO_CATALOG`). Qualquer ativo fora dessa tabela era ignorado silenciosamente, mesmo aparecendo "ativo" na UI. O pipeline de dado real (`BacktestDataService`/`RealMarketDataService`/`MarketScoreEngine`) já suporta o catálogo inteiro (~350 ativos) desde 27/07 — o gargalo era só esse sorteio.

**Fix**: tiers agora são calculados dinamicamente a partir de TODO `aiConfig.activeAssets`, classificados por categoria real do catálogo (`getAssetBySymbol`/`assetDatabase.ts`): Tier 1 = Cripto+Índices, Tier 2 = Metais+Forex Major, Tier 3 = resto.

## 3. Velocidade de análise (corrigido)

**Consequência do fix #2**: com mais ativos elegíveis, cada um específico passaria a ser revisitado só a cada ~1-2min em média (motor sempre analisou só 1 ativo por tick de 5s).

**Fix**: motor agora analisa até 3 ativos diferentes por tick de 5s (`ASSETS_PER_TICK`), cada um passando pelos mesmos gates de sempre — nada foi afrouxado, só cabe mais análise real na mesma janela.

## 4. Auditoria dos 28 parâmetros de `AIConfig`

25/28 confirmados reais e conectados ao motor. 2 achados de config morta/parcial:

- **`marketMode`** (TREND/RANGE/SCALP/COUNTER): só `SCALP` tinha efeito real; RANGE e COUNTER eram idênticos a TREND. **Corrigido**: TREND agora exige regime `TENDENCIA` real (Market Score/ADX), RANGE exige `LATERAL`, COUNTER exige RSI em extremo real (fade de sobrecompra/sobrevenda). Migration `supabase/migrations/013_ai_decisions_market_mode.sql` necessária (novos `veto_stage`).
- **`metaApiToken`** (campo do `AIConfig`): morto, nunca lido pelo motor — fluxo real de conexão LIVE usa estado local separado em `AITrader.tsx`. Dois componentes órfãos (`MT5TokenValidator.tsx`, `MT5ConfigPanel.tsx`) nunca importados em lugar nenhum — não removidos ainda (pendência).

## 5. ATR Trailing Stop e Pyramiding System — de decorativos pra reais

**Achado**: os dois cards do painel "AI Trading Tools" (`AIToolsControl.tsx`) eram 100% mockados — números hardcoded no `useState` inicial, nunca atualizados; toggle não ligava em nada; `ATRTrailingStopManager.tsx` tinha `mockPositions` explícitas com comentário `// TODO: Integrar com ApexLogicCore`; Pyramiding não existia em NENHUMA linha do motor (`useApexLogic.ts`) — zero ocorrências de "pyramid".

**Implementado de verdade**:

- **ATR Trailing Stop**: distância de trailing agora é ATR real (`calculateATR`, mesmo cache de candles do ciclo de análise) em vez de distância fixa da entrada. Novos campos `aiConfig.atrTrailingPeriod`/`atrTrailingMultiplier`. Contador real `TradeVisual.trailMoves`. Widget e `ATRTrailingStopManager.tsx` agora leem `activeOrders` reais via `useTradingContext()` — zero mock.
- **Pyramiding System**: novo campo `aiConfig.pyramiding` (tipo `PyramidingConfig`, já existia a UI de config, nunca era lida pelo motor). Núcleo real implementado em `useApexLogic.ts`: adição de camadas (`maxLayers`, `scalingStrategy` fixed/reduced/exponential, `entryDistanceType` percent/pips/atr), break-even real, stop de emergência real por grupo (fecha via SL, reaproveitando o loop de P&L já existente — sem duplicar lógica de fechamento). Opt-in (`enabled: false` por padrão), só em modo DEMO nesta passada.
- **Explicitamente NÃO implementado** (desabilitado na UI com nota "não implementado", nunca finge funcionar): scaling Fibonacci/Smart-AI, distância "AI Dinâmico", Take Profit Parcial, AI Risk Analysis (divergência/volatilidade/momentum score), fechar-tudo-em-reversão.

**Verificação**: `npx tsc` limpo (`tsconfig.engine.json` e projeto completo), `npm run validate` 100% ok, testado ao vivo no browser — ligar/desligar os dois toggles reflete estado real (`aiConfig.stopLossMode`/`aiConfig.pyramiding.enabled`), métricas mostram zero real (não há posição aberta), badge "X de 2 Ativas" atualiza corretamente.

## Arquivos alterados nesta sessão

- `src/app/hooks/useApexLogic.ts` — todos os fixes de motor acima
- `src/app/components/dashboard/AIToolsControl.tsx` — métricas e toggles reais
- `src/app/components/tools/ATRTrailingStopManager.tsx` — dados reais via `activeOrders`, ATR real
- `src/app/components/trading/PyramidingConfigPanel.tsx` — defaults seguros + campos não implementados desabilitados na UI
- `src/app/services/AITradingPersistenceService.ts` — novos `DecisionVetoStage` (MARKET_MODE_*)
- `supabase/migrations/013_ai_decisions_market_mode.sql` — migration pendente de rodar no SQL Editor
- `supabase-tests/limpar_historico_teste_clebercouto.sql` — SQL opcional de limpeza de histórico de teste

## Pendente

- Rodar a migration `013_ai_decisions_market_mode.sql` no Supabase antes do próximo teste em produção
- Remover os componentes órfãos do MT5 (`MT5TokenValidator.tsx`, `MT5ConfigPanel.tsx`) e o campo morto `metaApiToken` do `AIConfig`
- Commit/push (nunca feito automaticamente neste projeto — comandos entregues em cada resposta)
