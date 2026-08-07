# Handoff — próxima sessão

> Reescrito em **2026-08-07**, após extrair `runTradingCycle`. Versões
> anteriores no git.
> **Regra: este arquivo é handoff da sessão CORRENTE. Reescreva, não empilhe.**
> Estado da árvore: ver "Não commitado ainda" abaixo — nada foi commitado
> nesta sessão (regra do projeto: Claude nunca commita/push sozinho).

## ▶ COMECE AQUI — passo 3 do plano do runner: runner Deno

Passo 2 (extrair o ciclo pra módulo puro) está **feito e verificado
estaticamente** nesta sessão — ver "O que foi feito" abaixo. Falta a
**verificação comportamental viva** antes de considerar o passo 2 fechado de
vez (ver "Verificação pendente" logo abaixo) — mas nada impede começar o
passo 3 em paralelo, já que a extração não mudou nenhuma decisão do motor.

**Passo 3**: runner Deno sobre `runTradingCycle` (agora importável direto de
`src/app/services/strategy/runTradingCycle.ts`, sem depender de React):
lê `ai_sessions` RUNNING, monta `TradingCycleState`/`TradingCycleDeps` a
partir do banco, chama `runTradingCycle`, aplica os efeitos retornados
gravando em `ai_trades`/`ai_funnel_snapshots` (em vez de `setState`). Opera
de verdade em DEMO (abre, gere stop/take/trailing, fecha). Cron **sem trava
de dia útil** (cripto opera fim de semana), gate de mercado aberto **por
símbolo**, lock por sessão. Requisito não negociável: rejeitar
`source: 'SIMULATED'` explicitamente (ver armadilha abaixo).

O driver Deno precisa implementar sua própria `TradingCyclePersistence`
(`saveDecision`/`onTradeOpen` via Supabase server-side, mesmo formato que
`useAIPersistence.ts` usa) — **`saveDecision` precisa continuar chamando
`funnelTelemetry.recordStage` pro `vetoStage`** igual à versão do hook (ver
`useAIPersistence.ts:382-387`), senão o funil do runner fica incompleto sem
ninguém perceber.

Depois do runner: Fase 2 — medir a curva `k(t)`. Dataset M1 e motor numba já
existem em `research/experiments/2026-07-30-sma-pullback-crossasset/scripts/`.

## O que foi feito nesta sessão (2026-08-07)

Extraído o corpo do `setInterval` de dentro do `useEffect` em
`useApexLogic.ts` (era ~1.100 linhas, linhas 1260-2353) pro módulo puro
[runTradingCycle.ts](src/app/services/strategy/runTradingCycle.ts) (981
linhas). Assinatura: `runTradingCycle(state, deps) → Promise<{ effects, ... }>`
— sem React, sem `setState`; tudo que era `setActiveOrders`/`setIsActive`/
`setSafeMode`/`addLog`/`toast` virou um `TradingCycleEffect` tipado que quem
chama aplica (`applyTradingCycleEffect` em `useApexLogic.ts`). Persistência
(`saveDecision`/`onTradeOpen`), telemetria de funil e chamadas de rede
(preço, Market Score, candles, fechamento de emergência) continuam sendo
chamadas diretas de serviços já genéricos — só o que é genuinamente
React/UI virou efeito.

Achados/decisões durante a extração:
- `tierName` (label do tier sorteado, ex: "TIER 1 (Cripto/Índices...)")
  quase ficou de fora do `reasoning` persistido — corrigido antes de fechar
  (comparação linha a linha contra o original pegou isso).
- Os `.then()` de `forceCloseAllLivePositions()` (kill-switch e tail-risk
  EMERGENCY_CLOSE) logavam/notificavam o resultado do fechamento na
  corretora — como isso só existe DEPOIS do `return` da função (efeito
  pós-ciclo, fire-and-forget desde sempre), criei `deps.applyEffect(effect)`
  como saída lateral pra esses dois casos específicos, em vez de perder o
  log/toast de confirmação.
- Helpers/constantes que só o ciclo usava (`RISK_PROFILE_ADJUSTMENTS`,
  `CORRELATION_GROUPS`/`getCorrelationGroup`, `normalizeAiTimeframe`) foram
  MOVIDOS pra dentro de `runTradingCycle.ts`, não duplicados — removidos de
  `useApexLogic.ts` (era exatamente o padrão que causou o bug de `pointValue`
  divergente em 2026-08-05, não repetir).

**Verificado**: `npx tsc -p tsconfig.engine.json --noEmit` limpo, `npm run
validate` verde (15/15), `npx tsc -p tsconfig.json --noEmit` sem nenhum erro
novo nos dois arquivos tocados.

**Verificação pendente (não feita nesta sessão)**: a rede de proteção
combinada pedida no handoff anterior incluía equivalência de `stage_counts`
**antes/depois, com a IA rodando de verdade** contra dado real — isso exige
sessão ao vivo (mercado real, Supabase, telemetria de funil populando), que
não dá pra rodar headless nesta sessão. Antes de considerar o passo 2
definitivamente fechado: ligar a IA em DEMO por um período curto, comparar
`ai_funnel_snapshots.stage_counts` da sessão nova contra o padrão histórico
(mesma distribuição de estágios pro mesmo tipo de estado de entrada — não
precisa ser exatamente o mesmo tick, já que o mercado muda entre execuções).

## Decisão do Cleber ainda em aberto (não bloqueia o passo acima)

Taxa base medida em 2026-08-05: **nenhum dos 5 presets de produção é lucrativo
líquido de custo** no agregado (135 combinações preset×ativo×timeframe,
motor/presets/custo reais). Não há candidato bom pra "config padrão" da IA
hoje. Extrair o ciclo é infraestrutura e vale rodar mesmo assim — mas o
problema de fundo (ausência de edge) segue sem solução à vista.

Detalhe completo: `SESSAO_2026-08-05_TAXA_BASE_MEDIDA.md` — **leia a ERRATA no
topo da seção de bugs antes de citar qualquer número de XBNUSD daquela
tabela** (resumo: 15 das 135 linhas mediam Bitcoin com rótulo XBN errado; não
muda a conclusão agregada, corrigido em código, tabela em si não foi
reexecutada).

**Opcional, barato, não bloqueia nada**: reexecutar a medição agora que o mapa
está certo, pra ter as 15 linhas de XBNUSD medindo Binance Coin de verdade.
```bash
node research/experiments/2026-08-05-taxa-base/scripts/fetch_candles.mjs
npx tsx research/experiments/2026-08-05-taxa-base/scripts/measure.ts
```
Ambos idempotentes — **apague o cache de candles de XBNUSD antes**, senão o
ETL reaproveita as barras de BTC já baixadas com o mapa antigo.

## O que ficou decidido (não reabrir sem motivo novo)

- **Runner 24/7 operando de verdade em DEMO é requisito de produto**, não
  otimização. Usuário liga e vai dormir; a IA não pode se desligar sozinha.
  Execução em conta REAL fica fora desta entrega.
- **Um motor, dois drivers.** O runner importa o motor do browser, nunca copia.
- **Nenhum gate/limiar foi afrouxado, e não será.** Taxa base mostrou que
  afrouxar limiar não teria pra onde ir: nenhum preset é lucrativo mesmo
  operando mais.
- **Calibração ajusta a QUANTIDADE de trades, nunca o SINAL da expectativa.**
- **Fase 2 = medir a curva `k(t)`**, orçamento e critério de corte já fixados
  (tabela no doc da Fase 0).
- **A IA está desligada de propósito.**

## Armadilhas conhecidas, ainda não corrigidas

**Candles simulados com HTTP 200.** `/mt5-candles` devolve dado sintético
quando o token MetaAPI é inválido
([server/index.ts:4438](supabase/functions/server/index.ts:4438)). No browser
o `isRealData` barra. **O runner do servidor precisa rejeitar `source:
'SIMULATED'` explicitamente** — senão decide trade sobre dado fabricado,
violando a convenção nº1 do projeto. Requisito não negociável do runner.
(`/mt5-candles-history`, usada pela taxa base, já falha explícito em vez de
devolver sintético — verificado em 2026-08-05.)

**Faixa morta do `detectRegime`** (`MarketScoreEngine.ts:437`): ADX 18–25 vira
`INDEFINIDO`, não satisfaz TREND nem RANGE. Com default `marketMode: 'TREND'`,
é veto permanente. Introduzida em `6e319e485`. Não confundir com o veto
observado no funil (esse é o filtro ADX>20 da própria estratégia, estágio
anterior).

**Pares JPY usam pip de 4 casas.** `getPointValue('USDJPY')` devolve 0.0001,
mas pip de par com iene é 0.01 — alvo em pontos fica 100× curto. Mesma classe
dos bugs de `pointValue` corrigidos em 2026-08-05 (ver histórico), achado ao
revisar a função; não corrigido porque nenhum par JPY está no fluxo ativo
hoje. Corrigir antes de qualquer par JPY entrar em produção.

**Desperdício de amostragem:** ativo sem dado real continua consumindo um dos
3 slots de avaliação por tick (`ASSETS_PER_TICK`,
[useApexLogic.ts:1383](src/app/hooks/useApexLogic.ts:1383)).

## Anotado, não priorizado

- `CANDLES_FETCH_FAILED` no funil de 2026-08-05 (2,8% das avaliações) —
  estágio novo, não investigado.
- Mudanças de OUTRA sessão continuam não commitadas na árvore:
  `AIToolsControl.tsx`, `ATRTrailingStopManager.tsx`,
  `PyramidingConfigPanel.tsx` e
  `SESSAO_2026-08-04_ATR_PYRAMIDING_E_AUDITORIA_CONFIG.md`. Cleber decide.

## Histórico desta sessão (2026-08-05, noite) — só se precisar do detalhe

Corrigidos os dois bugs de XBNUSD achados na medição de taxa base, e no
processo se descobriu que um diagnóstico anterior estava **invertido**:
`XBNUSD` nunca foi duplicata de `BTCUSD` — é **Binance Coin**, contrato
próprio da Infinox (`assetDatabase.ts:158`, preço ~US$576 vs ~US$64.000 do
BTC). O erro real era o mapa de backtest, que apontava XBNUSD pra baixar
candles de BTC.

1. **Mapa de backtest** (`BacktestDataService.ts:49`): `XBNUSD: 'BTC'` →
   `'BNB'`. Adicionado `XLCUSD: 'LTC'` (faltava). Removida chave `XETLC`
   (não correspondia a símbolo do catálogo).
2. **Escala de ponto** (`TradeSizing.ts:60`): `getPointValue` agora deriva a
   categoria do catálogo (`assetDatabase.getAssetBySymbol`) como fonte de
   verdade; lista de prefixos cripto vira só fallback pra símbolos fora do
   catálogo (`BTCUSDT`). Conserta de uma vez toda a família `X**` da
   Infinox — `XBNUSD`, `XETUSD`, `XLCUSD` — que caía no branch de forex
   (`pointValue` 0.0001 com preço em dólares cheios).
3. **Cópia divergente eliminada** (`useApexLogic.ts:2143`): caminho ao vivo
   tinha a tabela de `pointValue` duplicada inline, já divergente da de
   `TradeSizing.ts`. Agora chama `getPointValue` — uma tabela só no produto.
4. **Asserção de regressão** (`strategy/__validate__.ts`, CASO 5): 8 casos
   novos travando escala por símbolo + distância de TP. Bug já tinha voltado
   uma vez (2026-07-24, BTCUSD); agora custa o gate voltar de novo.

`npm run validate` verde (15/15 na suíte do motor). Commitado
(`167a56f70`) e pushed pra `origin/dev`.

Leitura de referência, se precisar reconstruir o contexto completo:
`SESSAO_2026-08-05_TAXA_BASE_MEDIDA.md` (com a errata),
`SESSAO_2026-08-05_RUNNER_24_7_E_TAXA_BASE.md` (decisões que motivaram a
medição). Mais fundo: `SESSAO_2026-08-04_FASE1_LEITURA_FUNIL.md`,
`SESSAO_2026-08-04_FASE1_COSTURA_RUNNER.md`,
`SESSAO_2026-08-04_FASE0_TELEMETRIA_FUNIL.md`, `research/AI_BRAIN_SPEC.md`
(seções 14.5 e **14.7** — não citar número da seção 14 sem ler 14.7).

## Workflow (regra fixa do projeto)

Claude **nunca** roda `git commit`/`push` nem aplica migration. Sempre
entrega código pronto + comandos prontos pro Cleber rodar.
