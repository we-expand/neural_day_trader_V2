# Sessão 2026-09-15 — Reset/reload apagava posição aberta do Dashboard

## Contexto

Cleber configurou o LLM Active Brain pra operar de madrugada com ativos
asiáticos e, ao "restartar" pra $100, uma posição de BTCUSD LONG que
estava aberta sumiu do Dashboard. Reação inicial correta dele: "a única
coisa que zera são os $100, não as posições abertas — essas têm que
fechar sozinhas". Confirmado via log/Supabase que a posição continuava
`OPEN` de verdade no banco o tempo todo — nunca foi fechada, só ficou
invisível.

## Causas raiz encontradas (3, em camadas)

1. **`endSession()` incondicional** ([useAIPersistence.ts](src/app/hooks/useAIPersistence.ts))
   — o wrapper que fecha a sessão do LLM Active Brain (`ai_sessions`)
   marcava `status='COMPLETED'` sem checar se havia posição `OPEN` em
   `ai_trades`. O fix de 2026-09-11 (`resetLlmActiveBrainSession`) só
   protegia a CRIAÇÃO da sessão nova, nunca esse encerramento direto —
   que roda ANTES, na mesma função `resetLogic()`, sobre a MESMA sessão.
   Corrigido: `endSession` agora consulta `hasOpenTrades(sessionId)`
   (novo método em `AITradingPersistenceService.ts`) e aborta se houver
   posição aberta, deixando a sessão intocada pra continuar sendo gerida
   até fechar sozinha.

2. **Guard de "resíduo de corrida" no reload** ([useApexLogic.ts:985-1013](src/app/hooks/useApexLogic.ts))
   — existia desde antes um mecanismo que, ao recarregar a página dentro
   de 30s de um Reset, tratava qualquer sessão `RUNNING` encontrada como
   sobra do `endSession` assíncrono ainda não confirmado, e a descartava
   no cliente (zerando `activeOrders`/portfolio local), reforçando o
   `endSession`. Isso pisava na decisão do fix #1 mesmo quando ele já
   tinha recusado de propósito fechar a sessão por causa da posição
   aberta. Corrigido: só descarta como resíduo se a sessão realmente não
   tiver posição `OPEN` (mesma checagem `hasOpenTrades`).

3. **Fallback de bootstrap do motor criando sessão nova vazia** —
   comportamento já existente do `llm-active-brain`
   (`getOrCreateMt5Session`): sem nenhuma sessão elegível (RUNNING/
   STOPPED), o motor cria uma nova sozinho. Isso não é bug novo, é
   consequência de qualquer sessão real ter sido indevidamente encerrada
   por #1/#2 antes do fix — aconteceu de novo uma vez nesta sessão porque
   o teste do Cleber caiu numa janela anterior ao push do fix (commit
   `5b53c8afb`, 02:18:50 UTC) chegar ao ar.

## Fixes aplicados (código)

- `src/app/services/AITradingPersistenceService.ts` — novo método
  `hasOpenTrades(sessionId)`.
- `src/app/hooks/useAIPersistence.ts` — `endSession()` checa
  `hasOpenTrades` antes de encerrar, aborta com warning se houver
  posição aberta.
- `src/app/hooks/useApexLogic.ts` — guard de resíduo de corrida pós-Reset
  (linhas ~985-1013) agora também checa `hasOpenTrades` antes de
  descartar uma sessão RUNNING encontrada no reload.

Commits: `6fa367a74` (fix #1) e `5b53c8afb` (fix #2), ambos já
commitados e pushados pro `origin/dev` pelo Cleber. `tsc --noEmit` limpo
nos 3 arquivos (mesma contagem de erros pré-existentes, 569, nenhum
novo).

## Correções de estado no banco (SQL direto, sem UPDATE silencioso em `ai_trades`)

A posição BTCUSD (`ai_trades.id = 6dc2fafc-f0ae-4afc-b5bf-10d16e3bb3df`)
**nunca foi tocada** — só a `ai_sessions` (não é registro financeiro de
trade, é estado de sessão) foi corrigida, 2 vezes ao longo da sessão
(1ª vez pelo incidente original, 2ª vez por um teste que caiu antes do
fix estar no ar): `status` voltado de `COMPLETED` pra `RUNNING`,
`ended_at`/`final_balance`/`final_equity` limpos. Numa dessas correções
também foi preciso mover a sessão órfã "Apex AI" (motor mecânico morto
desde 2026-08-31, já catalogada no CLAUDE.md) de `RUNNING` pra `STOPPED`
pra liberar a trava única `ai_sessions_one_running_per_user_mode`
(`(user_id, mode)`, só permite 1 `RUNNING` por modo).

## Confirmação do cálculo de saldo (não precisou de fix, já estava certo)

Balance da sessão = **$100 (baseline) + PnL realizado dos trades
fechados** (`-$10,26` em 35 trades no momento da checagem = **$89,74**),
recalculado a cada 5s (`reconcile()`, `useApexLogic.ts`). Equity soma em
cima disso o PnL flutuante da posição ainda aberta. É exatamente o "100
menos o que já aconteceu" que o Cleber esperava — o bug real era só a
posição sumir da tela, não o cálculo.

## Pendente real (na época)

Fix só foi ao ar 02:18:50 UTC — ainda não houve nenhum teste de Reset
genuíno feito inteiramente DEPOIS do fix estar no ar (o teste que
"falhou" durante a sessão caiu numa janela anterior a isso). Se
acontecer de novo com o código novo já rodando de ponta a ponta, é
achado diferente, investigar mais fundo.

---

## Parte 2 (mesma sessão, logo em seguida): reset "protegia" a posição
## mas parava de zerar o saldo de verdade

Depois do fix acima, Cleber testou de novo e reportou: "como eu posso
estar abaixo dos $100 se a ferramenta tá com +$2,43?" — esperava
$102,43 (100 + PnL flutuante da posição aberta), via menos que 100.

### Causa raiz real

O fix da Parte 1 resolveu o sumiço da posição, mas trouxe um efeito
colateral que ninguém tinha notado: `resetLlmActiveBrainSession()`
(`AITradingPersistenceService.ts`) **abortava o reset inteiro** sempre
que havia posição `OPEN` — não criava sessão nova nenhuma. Resultado:
o saldo nunca voltava pra $100 de verdade, continuava sendo
`100 (baseline original) + PnL realizado de TODO o histórico da sessão
antiga` (que já tinha 35 trades fechados, -$10,26 líquido, desde
14/09) — daí o saldo aparecer abaixo de 100 mesmo com a posição aberta
em lucro.

O pedido real do Cleber sempre foi as DUAS coisas ao mesmo tempo:
baseline zera pra $100 de verdade, E a posição aberta continua rodando
sem fechar.

### Fix aplicado

`resetLlmActiveBrainSession()` redesenhada: em vez de abortar quando há
posição `OPEN`, agora **realoca** (`UPDATE ai_trades.session_id`) a(s)
posição(ões) aberta(s) da sessão antiga pra sessão nova, DEPOIS encerra
a antiga (com o saldo real dela, preservado no histórico) e cria a nova
já em $100. Nunca fecha a posição, nunca reescreve preço/PnL/status —
só o vínculo de sessão muda, e a trigger `ai_trades_audit_log` (AFTER
UPDATE) já registra isso automaticamente, sem precisar de UPDATE
silencioso.

Aplicada manualmente também no estado ATUAL do Cleber (não só no
código, pra já valer): sessão antiga (`09ab5176...`) encerrada com
`final_balance=$89,74` (preservada no histórico); sessão nova
(`ff7c9bfd...`) criada em $100; posição BTCUSD LONG realocada pra ela.
Conferido contra o preço real da Binance no momento (BTC $75.819,78 vs.
entrada $75.705,59, lote 0,01) — PnL flutuante ≈ +$1,14, equity ≈
$101,14. O "perdendo $0,72" que o Cleber via na hora do primeiro
restart era só o preço num instante desfavorável — a posição fluida
normalmente, não é inconsistência.

Commit: `AITradingPersistenceService.ts` (pendente do Cleber rodar —
comando entregue). `tsc --noEmit` limpo (569 erros, mesmo ruído
pré-existente, nenhum novo).

### Pendente real

Mesmo caso da Parte 1: fix só testado retroativamente (aplicado à mão
no estado atual) — ainda falta um teste de Reset genuíno, de ponta a
ponta, com o código novo já em produção, pra confirmar que o
comportamento (zera pra $100 + migra posição aberta) se repete sozinho
da próxima vez.
