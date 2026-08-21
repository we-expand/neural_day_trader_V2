# Sessão 2026-08-21 — Performance (Melhor/Pior Trade, Melhor Dia) e Reset não limpando o Dashboard

> **Atualização (mesmo dia, depois do deploy)**: mesmo com os fixes do Bug 4
> deployados (cliente + `ai-runner`), o Lucro Total continuava não zerando e a
> Curva de Equity continuava mostrando o mergulho antigo depois de Hard
> Refresh. Causa: a sessão do PRIMEIRO reset (`083310d3-19a1-4de7-a044-
> 7062d42c03ab`) tinha ficado travada em `status: PAUSED` (em vez de
> `COMPLETED`) **antes** do guard do `ai-runner` ser deployado — o fix novo só
> previne o problema daqui pra frente, não conserta retroativamente quem já
> quebrou. Como a herança de saldo entre sessões (`getLastCompletedSession`,
> filtro `status='COMPLETED'`) pulava essa sessão travada, ela caía pra
> sessão COMPLETED anterior (`e2a3a5a0...`, `final_equity: 115.44`),
> sobrescrevendo o patrimônio recém-zerado. Corrigido com UPDATE pontual
> (`ended_at`/`final_balance`/`final_equity` já estavam certos, só o
> `status` estava errado — não é dado financeiro/trade, é metadado de
> sessão):
> ```sql
> update ai_sessions set status = 'COMPLETED'
> where id = '083310d3-19a1-4de7-a044-7062d42c03ab' and status = 'PAUSED';
> ```
> Rodado por Cleber, confirmado no banco (`status: COMPLETED`,
> `final_balance/equity: 100`). Ver seção "Bug 4" abaixo pro fix estrutural
> (guard no `ai-runner`) que evita esse tipo de corrupção se repetir.

## Gatilho

Cleber reportou, olhando a tela de Performance:
- "Melhor Dia" $249,16 em "03 de agosto" — nunca teve esse resultado.
- "Melhor Trade" $341,00 — nunca teve um trade desse tamanho.
- "Pior Trade" -$950,00 — nunca teve um trade desse tamanho.

Depois, ao testar o Reset da conta DEMO: "as posições ainda estão no Dash mesmo após Hard Refresh".

Duas investigações encadeadas, quatro bugs reais confirmados com dado do Supabase de produção (projeto `wyvdsxtcmizettljxtbg`, usuário `aeb3ec15-f660-4775-856b-2a04b20f4592` / `clbrcouto@gmail.com`).

## Bug 1 — `currentProfit` ficava stale em fechamento manual (corrigido, mas não é a causa dos valores estranhos)

Antes de olhar o banco, achei (por leitura de código) que `forceCloseAll` e `closeManualPosition`
(`src/app/hooks/useApexLogic.ts`) calculavam o P&L real (`tradePnL`) corretamente para
`balance`/`equity`/persistência, mas gravavam o registro em `orderHistory` sem incluir esse valor —
deixando `currentProfit` com o último número de mark-to-market (tick de preço anterior), divergente
do que realmente foi realizado. O caminho de TP/SL automático já gravava certo.

**Fix aplicado**: os dois fechamentos agora gravam `currentPrice`/`currentProfit` com o `tradePnL` já
calculado, igual ao TP/SL. Correto e válido, mas — como ficou claro na investigação seguinte — não era
a causa dos valores que o Cleber estranhou; esses vinham de dado histórico real já persistido no banco.

## Bug 2 — "Melhor Dia" mostrava a data errada (fuso horário)

Consultado direto no Supabase: a soma de `net_pnl` por dia de entrada bate **exatamente** com
$249,15689999998205543 no dia `2026-08-04`, não `2026-08-03`. A tela mostrava "03 de agosto".

Causa: `Performance.tsx` monta a chave do dia em UTC (`toISOString().slice(0,10)` → `"2026-08-04"`) e
depois fazia `new Date("2026-08-04").toLocaleDateString('pt-BR', ...)` — isso interpreta a string como
meia-noite UTC e formata no fuso local (Brasil, UTC-3), que cai pra 03/08 21h. Dado certo, rótulo errado.

**Fix**: formata em UTC explicitamente (`Date.UTC(y, m-1, d)` + `timeZone: 'UTC'`), mantendo o mesmo dia
usado no agrupamento.

## Bug 3 — Melhor Trade ($341) e Pior Trade (-$950) eram reais, contaminados por bugs antigos já corrigidos no motor — e nunca somem porque Reset não limpava o histórico de Performance

Achado no Supabase (`ai_trades`, ambos `SPX500`, `exit_reason: 'MANUAL'`):

| Trade | Entry | Exit | quantity | net_pnl | Quando |
|---|---|---|---|---|---|
| Pior | 7544.06 | 7534.56 (LONG) | 754.406 | **-949.9999999999999** | 2026-08-03 13:23-13:28 UTC |
| Melhor | 7754.14 | 7760.96 (LONG) | 7754.14 | **340.99999999998545** | 2026-08-04 22:24-22:30 UTC |

Reconstruindo a fórmula de `calculatePnLWithLeverage`/`calculateRealisticPnL`
(`src/config/contractSpecs.ts`, spec `SPX500`: `tickSize=0.25`, `tickValue=12.50`, `contractSize=1`):

- **Pior trade**: `effectiveSize = 754.406 / 7544.06 ≈ 0.1`; `pointsMoved = -9.5/0.25 = -38`;
  `pnl = -38 × 12.50 × 0.1 = -47.5`. O valor real gravado é **exatamente 20× isso** (-950). Bate com o
  bug de alavancagem que o próprio código documenta como corrigido em 2026-08-03 (comentário extenso em
  `calculatePnLWithLeverage`: a função multiplicava por `leverage` em cima de um `marginAmount` que já
  era o nocional cheio, inflando o P&L). Esse trade fechou minutos *antes* do fix e nunca foi corrigido
  no banco.
- **Melhor trade**: `effectiveSize = 7754.14/7754.14 = 1` (ou seja, `marginAmount` = `entryPrice`, size
  cheio); `pointsMoved = 6.82/0.25 = 27.28`; `pnl = 27.28 × 12.5 × 1 = 341.0` — bate exato com o valor
  gravado. Matematicamente correto pela fórmula atual (pós-fix), mas revela outro problema: a posição
  alocou **$7.754 de margem numa conta de ~$100** (~77× o patrimônio). Não é bug de cálculo, é o gate de
  risco/position-sizing deixando passar uma posição absurdamente grande. **Não investigado a fundo nesta
  sessão — fica como item em aberto** (ver seção "Pendências" abaixo).

### A pergunta que expôs o problema maior: "se eu resetar, isso zera?"

Resposta encontrada no código: **não**. `resetLogic` (`useApexLogic.ts`) sempre zerou `orderHistory`
localmente e chamou `endSession`, mas nunca apagou nada em `ai_trades` — e a hidratação
(`getUserTradeHistory` → `aiPersistence.getUserTrades(user.id, ...)`) busca **todo o histórico do
usuário desde sempre, sem filtro de sessão**. Resultado: os dois trades contaminados (e qualquer outro
trade histórico) voltavam a aparecer em Melhor/Pior Trade e Melhor Dia depois de qualquer reload, não
importa quantos resets se desse.

**Decisão do Cleber**: Reset deve zerar a Performance exibida também, sem apagar nada do banco (auditoria
append-only continua intacta em `ai_trades`/`ai_trades_audit_log`).

**Fix implementado** (3 partes):
1. Nova tabela `ai_history_resets` (migration `supabase/migrations/20260821_add_ai_history_resets.sql`,
   **aplicada** por Cleber no SQL Editor) — `user_id`, `reset_at`, RLS por usuário. Só marca "a partir
   daqui conta pra Performance exibida", nunca deleta/edita `ai_trades`.
2. `AITradingPersistenceService.ts` — `recordHistoryReset(userId)` e `getLastHistoryResetAt(userId)`.
3. `useAIPersistence.ts` — `getUserTradeHistory` passa a filtrar trades com `exit_time` anterior ao
   último reset; nova função `recordHistoryReset` exposta. `resetLogic` (`useApexLogic.ts`) chama esse
   marcador. **`OperationLogs.tsx` (log de auditoria) continua usando `getUserTrades` direto, sem esse
   filtro — histórico vitalício ali de propósito, resets não o afetam.**

**Testado fim a fim** (via Browser pane, sessão real do Cleber): reset → Performance foi a zero
(Lucro Total $0,00, Melhor/Pior Trade "—", Melhor Dia "SEM TRADES AINDA", curva de capital em linha reta
$100) → confirmado no banco que `ai_history_resets` recebeu a linha (`reset_at: 2026-08-21 18:29:38
UTC`) → confirmado que os 184 trades em `ai_trades` continuam intactos.

## Bug 4 — Reset não limpava as posições abertas no Dashboard de OUTRO navegador ("ainda estão no Dash mesmo após Hard Refresh")

Depois do teste acima (feito no navegador sandbox do Claude), Cleber testou no **próprio Chrome** e viu
as 3 posições (ETHUSD/SOLUSD/EURUSD) continuarem lá mesmo após Hard Refresh. Duas causas, uma em cada
lado:

### 4a. Cliente confiava cegamente no cache de `localStorage`

`useApexLogic.ts` tem duas hidratações no mount, em sequência:
1. Carrega `activeOrders` do `localStorage` (`STORAGE_KEY`) **sem checar nada**.
2. Busca a sessão `RUNNING` no Supabase (`restoreActiveSession`) — só sobrescreve `activeOrders` **se
   achar uma sessão rodando**. Se não achar (branch `if (!restored?.session) { ...; return; }`), o
   código nunca tocava `activeOrders` de novo.

Como o Reset foi feito num navegador diferente (sandbox do Claude), o `localStorage` do Chrome do Cleber
nunca foi limpo — no Hard Refresh, ele recarregava as 3 posições antigas do cache, e como o Supabase não
tinha sessão RUNNING pra corrigir isso, elas ficavam presas pra sempre.

**Fix**: no branch "sem sessão RUNNING" (`useApexLogic.ts`, hidratação Supabase), agora limpa
`setActiveOrders([])` explicitamente — em DEMO, sem sessão RUNNING não pode haver posição real
legítima; qualquer coisa em `activeOrders` nesse ponto é resíduo de cache de sessão já
encerrada/pausada em outro lugar. Supabase volta a ser autoridade total sobre `activeOrders`, não só
quando há sessão ativa.

### 4b. `ai-runner` (servidor) sobrescrevia `COMPLETED` de volta pra `PAUSED` numa corrida com o Reset

Confirmado no banco: a sessão do reset (`083310d3-19a1-4de7-a044-7062d42c03ab`) tinha `ended_at`
correto (batendo com o horário do reset), mas `status: 'PAUSED'`, não `COMPLETED`. `endSession` do
cliente grava `status: 'COMPLETED'` — então algo escreveu por cima depois.

Achado em `supabase/functions/ai-runner/index.ts`, função `runSession`: ao final do loop, se
`!s.isActive`, o runner fazia `update({status: 'PAUSED'}).eq('id', s.sessionId)` **sem nenhuma
condição sobre o status atual**. Se essa invocação do cron (1×/min) estava em voo no exato momento em
que o cliente chamou `endSession`, a escrita do runner podia acontecer DEPOIS e sobrescrever
`COMPLETED` de volta pra `PAUSED` — sem tocar `ended_at` (por isso esse campo ficou certo mas o status
não).

Consequência real, não só cosmética: `getLastCompletedSession('DEMO')` (herança de saldo entre
sessões, filtro `status='COMPLETED'`) deixava de achar essa sessão — ficando presa em `PAUSED` — e a
**próxima** sessão herdaria saldo de uma sessão mais antiga, errada.

**Fix**: guard no UPDATE — `.eq('id', s.sessionId).eq('status', 'RUNNING')` — só aplica `PAUSED` se
ninguém mais encerrou a sessão antes. **Exige redeploy da Edge Function** (não sobe com `git push`):
```
supabase functions deploy ai-runner --no-verify-jwt --project-ref wyvdsxtcmizettljxtbg
```

## Estado ao final da sessão

- Migration `20260821_add_ai_history_resets.sql` — **aplicada**.
- Commit com os fixes de `useApexLogic.ts`/`useAIPersistence.ts`/`AITradingPersistenceService.ts`/
  `Performance.tsx` (Bugs 1-3) — **rodado por Cleber**.
- Commit com os fixes de `useApexLogic.ts` (limpar `activeOrders` sem sessão RUNNING) e
  `ai-runner/index.ts` (guard de status) — **rodado por Cleber**.
- `npm run validate` (37/37) e `tsc` do caminho crítico sem erro novo em todos os pontos desta sessão.
- Cleber fechou manualmente as 3 posições órfãs (ETHUSD/SOLUSD/EURUSD) e resetou de novo na própria
  conta — confirmado no banco: as 3 ficaram `CLOSED` (`exit_reason: MANUAL`), nenhuma `OPEN` restante
  na sessão `083310d3...`.
- **Redeploy do `ai-runner` com o guard de status — confirmar que Cleber rodou** (não verificado nesta
  sessão se o deploy já foi feito; o código já está commitado, falta o passo de deploy manual da Edge
  Function, que este arquivo não confirma ter acontecido).

## Pendências que ficaram em aberto (não corrigidas nesta sessão)

1. **Position-sizing SPX500**: o trade de $341,00 (04/08) alocou ~$7.754 de margem numa conta de ~$100.
   Não investigado por que o gate de risco deixou passar — fica pra sessão futura.
2. Os dois trades contaminados (-$950 e $341, SPX500) continuam existindo em `ai_trades` — por design
   (nunca se apaga registro financeiro; correção seria via registro de ajuste novo, decisão que não foi
   tomada nesta sessão porque não era o que o Cleber pediu). Depois do reset, já não aparecem mais na
   tela porque ficam antes do marcador — mas seguem no banco pra quem olhar a auditoria bruta.
