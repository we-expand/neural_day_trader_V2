# Handoff — próxima sessão

> Reescrito em **2026-08-07** (2ª parte do dia), após implementar a primeira
> versão do runner Deno (passo 3).
> **Regra: este arquivo é handoff da sessão CORRENTE. Reescreva, não empilhe.**
> Estado da árvore: nada commitado nesta sessão (regra do projeto: Claude
> nunca commita/push sozinho) — ver lista completa de arquivos no fim.

## ▶ COMECE AQUI — runner Deno escrito, falta rodar de verdade

Passo 3 do plano do runner (ver histórico abaixo) está **escrito e
verificado estaticamente**: `deno check` limpo, os 4 testes de
`seam_smoke_test.ts` passam, `npm run validate` verde (15/15), `tsc` sem
erro novo nos arquivos tocados. **Nada disso prova que funciona contra o
Supabase de verdade** — esta sessão não tinha acesso à service-role key nem
a um projeto Supabase pra rodar `deno serve`/testar uma invocação HTTP real.
Isso é o próximo passo, não opcional antes de considerar o runner pronto.

### O que existe agora

`supabase/functions/ai-runner/`:
- `index.ts` — handler HTTP (`Deno.serve`). Lê `ai_sessions` com
  `status='RUNNING' AND mode='DEMO'`, reconstrói o estado de cada sessão a
  partir do banco (`ai_trades` OPEN → `activeOrders`, último
  `ai_portfolio_snapshots` → `portfolio`, `ai_trades` CLOSED de hoje →
  `orderHistory`), e roda um loop limitado (`MAX_RUNTIME_MS = 45s`) por
  invocação: tick de posição a cada 1s, tick de trading (chama
  `runTradingCycle` de verdade, sem cópia) a cada 5s.
- `lib/persistence.ts` — implementa `TradingCyclePersistence`
  (`saveDecision`/`onTradeOpen`) via service-role, espelhando
  `useAIPersistence.ts` **incluindo** a chamada a
  `funnelTelemetry.recordStage` antes de qualquer outra coisa em cada veto
  (era o requisito explícito do handoff anterior, pra não deixar o funil
  incompleto de novo).
- `lib/positionManager.ts` — segundo "driver" (fora do motor, igual o loop
  de 1s que só existia no browser): TP/SL + trailing-stop ATR, fecha via
  service-role. Rejeita `source: 'SIMULATED'` explicitamente, além de
  `isRealData` — trava dupla no requisito não-negociável do runner.
- `shims/supabaseClient.ts` — estendido nesta sessão: além de
  `auth.getSession()`, agora implementa `from('ai_funnel_snapshots').insert`
  e `from('ai_sessions').update(...).eq(...)` (as duas chamadas reais que
  `FunnelTelemetry.ts` faz). Tipado como `SupabaseClient` completo (não a
  forma mínima real) só pra satisfazer o `deno check` de trechos do grafo do
  motor que o runner nunca executa em DEMO (ex: `BrokerClient.ts` via
  `LiveEmergencyClose`) — a trava de runtime (Proxy que lança em qualquer
  acesso não implementado) continua exatamente tão restrita quanto antes.
- `seam_smoke_test.ts` — atualizado: o teste que afirmava "`.from` sempre
  estoura" foi corrigido pra refletir que `.from(...)` agora é legítimo pras
  duas tabelas acima (e continua estourando pra qualquer outra).

### Achado importante desta sessão (documentar, não só corrigir)

A "costura" provada em 2026-08-04 (`seam_smoke_test.ts` original) **nunca
importava `runTradingCycle.ts`** — só `StrategyEvaluator`/
`TechnicalIndicators`/`MarketScoreEngine`. Ao tentar rodar o runner de
verdade, dois problemas apareceram que o smoke test antigo não podia ter
pego:

1. `runTradingCycle.ts` importava `TradeVisual`/`AIConfig`/`PortfolioState`
   como `import type` de `@/app/hooks/useApexLogic` — um arquivo React
   (`react`, `sonner`, `motion/react` via `PyramidingConfigPanel.tsx`).
   Mesmo sendo só tipo, o Deno precisa carregar o grafo do módulo alvo pra
   checar o tipo, e esse grafo não é portável. **Corrigido**: os 3 tipos (+
   `PyramidingConfig`, que `AIConfig` referencia) foram extraídos pra
   [src/app/types/tradingState.ts](src/app/types/tradingState.ts) — arquivo
   sem NENHUM import, de propósito. `useApexLogic.ts` e
   `PyramidingConfigPanel.tsx` agora re-exportam de lá em vez de definir
   localmente (sem duplicação, mesmo formato). `npx tsc -p tsconfig.json
   --noEmit` confirma zero erro novo nos arquivos tocados.
2. O motor inteiro usa imports **sem extensão** (`from '@/app/types/strategy'`,
   não `'.../strategy.ts'`) — estilo Vite normal, nunca escrito pensando em
   Deno. Por padrão o Deno exige extensão explícita. **Corrigido** ativando
   `"unstable": ["sloppy-imports"]` no `deno.json` do runner — sem editar
   nenhum import do caminho crítico (ver comentário no próprio `deno.json`).

Nenhuma lógica de decisão mudou — os dois problemas eram 100% de resolução
de módulo, não de comportamento. `npm run validate` confirma (15/15 verde).

### Limitações conhecidas, documentadas de propósito (não escondidas)

- **Estado efêmero entre invocações.** Cooldown, `lastTradedSymbol`, cache de
  notícias/VIX e buffer de candles vivem só dentro de uma invocação (até
  45s) e resetam a cada novo disparo do cron. Como o cooldown padrão é 5s e
  o cron é esperado rodar a cada ~1min, o efeito prático é pequeno, mas não
  é idêntico a um processo contínuo de verdade. Gates que dependem do
  histórico real (`RISK_GATE`, kill-switch, `MAX_TRADES_PER_DAY`) continuam
  corretos porque são recalculados a partir de `ai_trades` no banco a cada
  invocação, não do estado efêmero.
- **`CLOSE_ALL_ORDERS` (kill-switch) não persiste fechamento em DEMO** — o
  driver browser (`useApexLogic.ts:1232-1234`) só limpa `activeOrders` em
  memória, nunca chama `onTradeClose` pras posições fechadas pelo
  kill-switch. O runner replica esse comportamento EXATAMENTE (pra não
  divergir do browser), mas isso deixa linhas `ai_trades.status='OPEN'`
  órfãs no banco quando o kill-switch dispara. Não é bug introduzido por
  este driver — é um buraco pré-existente, agora visível porque o runner é
  quem vai rodar sem supervisão. Vale decidir se corrige nos dois drivers
  numa sessão futura.
- **Cadência do cron.** Não existe infraestrutura de cron no projeto (sem
  `config.toml`, sem `pg_cron` habilitado ainda). SQL de exemplo no fim de
  `index.ts` (comentário, não aplicado) — usa `pg_cron` + `pg_net`,
  granularidade mínima de 1 minuto. Isso significa até ~15s de gap entre o
  fim de uma invocação (45s de loop) e o início da próxima.
- **`positionManager.ts` é lógica duplicada de propósito**, não do motor
  compartilhado — o trailing-stop ATR só existia inline no hook do browser
  (nunca foi extraído pra módulo puro, ao contrário do ciclo de entrada).
  Qualquer mudança futura na lógica de TP/SL/trailing do browser
  (`useApexLogic.ts:1313-1561`) precisa ser replicada aqui manualmente até
  existir um módulo puro compartilhado — fora do escopo desta sessão.

## Próximo passo obrigatório antes de considerar o runner pronto

**Rodar de verdade**, na ordem:

1. Cleber configura `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (e opcional
   `AI_RUNNER_SHARED_SECRET`, recomendado) como secrets da function:
   ```bash
   supabase secrets set --env-file <(echo "AI_RUNNER_SHARED_SECRET=<algo-aleatorio>")
   ```
2. Deploy manual pra teste (Cleber roda, não Claude):
   ```bash
   supabase functions deploy ai-runner --project-ref wyvdsxtcmizettljxtbg
   ```
3. Com uma sessão RUNNING/DEMO de verdade no banco, invocar manualmente:
   ```bash
   curl -X POST https://wyvdsxtcmizettljxtbg.supabase.co/functions/v1/ai-runner \
     -H "x-runner-secret: <o mesmo valor do passo 1>"
   ```
4. Comparar `ai_funnel_snapshots.stage_counts` da invocação contra o padrão
   histórico do driver browser pro mesmo tipo de estado de entrada — mesma
   verificação comportamental que já estava pendente do passo 2 (extração do
   ciclo), agora estendida ao passo 3.
5. Só depois disso, decidir junto com o Cleber se/quando ligar o
   `pg_cron` (SQL de exemplo no fim de `index.ts`) pra rodar sem supervisão.

## Decisão do Cleber ainda em aberto (não bloqueia o runner)

Taxa base medida em 2026-08-05: **nenhum dos 5 presets de produção é
lucrativo líquido de custo** no agregado. Sem mudança desde o último
handoff — ver `SESSAO_2026-08-05_TAXA_BASE_MEDIDA.md` (com errata sobre
XBNUSD no topo da seção de bugs).

## O que ficou decidido (não reabrir sem motivo novo)

- **Runner 24/7 operando de verdade em DEMO é requisito de produto**, não
  otimização. Execução em conta REAL fica fora desta entrega.
- **Um motor, dois drivers.** O runner importa o motor do browser, nunca
  copia — `positionManager.ts` é a única exceção documentada (ver acima),
  porque a lógica de TP/SL/trailing nunca foi extraída em primeiro lugar.
- **Nenhum gate/limiar foi afrouxado, e não será.**
- **Calibração ajusta a QUANTIDADE de trades, nunca o SINAL da expectativa.**
- **A IA está desligada de propósito.**

## Armadilhas conhecidas, ainda não corrigidas (herdadas, não deste passo)

**Faixa morta do `detectRegime`**, **pares JPY com pip de 4 casas**,
**desperdício de amostragem** — sem mudança, ver histórico anterior deste
arquivo (git log) ou `CLAUDE_HISTORY.md`.

## Anotado, não priorizado

- Mudanças de OUTRA sessão continuam não commitadas na árvore:
  `AIToolsControl.tsx`, `ATRTrailingStopManager.tsx`,
  `PyramidingConfigPanel.tsx` (agora TAMBÉM tocado por esta sessão — só a
  extração do tipo `PyramidingConfig`, ver acima) e
  `SESSAO_2026-08-04_ATR_PYRAMIDING_E_AUDITORIA_CONFIG.md`. Cleber decide o
  que fazer com o conjunto.

## Arquivos tocados/criados nesta sessão (nada commitado)

Novos: `supabase/functions/ai-runner/index.ts`,
`supabase/functions/ai-runner/lib/{serviceClient,persistence,positionManager}.ts`,
`src/app/types/tradingState.ts`.
Modificados: `supabase/functions/ai-runner/{deno.json,seam_smoke_test.ts,shims/supabaseClient.ts}`,
`src/app/hooks/useApexLogic.ts` (tipos movidos, comportamento idêntico),
`src/app/components/trading/PyramidingConfigPanel.tsx` (idem),
`src/app/services/strategy/runTradingCycle.ts` (só o import de tipos).

## Workflow (regra fixa do projeto)

Claude **nunca** roda `git commit`/`push` nem aplica migration/deploy.
Sempre entrega código pronto + comandos prontos pro Cleber rodar.
