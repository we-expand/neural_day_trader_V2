# Sessão 2026-09-08 (noite) → 2026-09-09: execução REAL (LIVE) na Infinox,
# primeiro teste com dinheiro de verdade ($22 → Stop Out) e cadeia de bugs
# reais corrigidos no caminho

## Contexto e pedido do Cleber

Cleber tinha ~$22 na conta real da Infinox (conta MetaAPI dedicada
`bb99f865-96fb-4573-98a7-1f32895f84f7`, a MESMA que serve o streaming de
preço pra toda a plataforma) e queria: (1) reconectar a conta LIVE (tinha
sido desligada mais cedo no dia 08-09, ver CLAUDE.md), (2) fazer o
Dashboard ler saldo/posições reais em vez de simulado, (3) deixar o
LLM Brain operar esse saldo real de forma autônoma, sem perder a sessão
DEMO em andamento.

**Antes de qualquer código**, rodado o `llm-council` (5 conselheiros +
revisão cruzada) sobre a decisão. Veredito: risco real (trilho nunca
testado, API historicamente instável, capital pequeno demais pra gerar
sinal estatístico) — mas Cleber decidiu seguir mesmo assim, ciente do
risco. Decisão dele, registrada.

## O que foi construído (trilho de execução real)

- **`llm-active-brain/src/liveExecution.ts`** (novo): chama `/broker/execute`
  de verdade via sessão de usuário real (magic link + `verifyOtp`, mesmo
  padrão do login biométrico — evita duplicar a chave de criptografia do
  token MetaAPI no processo Node). Fail-closed sempre; circuit breaker
  global que desliga execução real em qualquer erro/timeout até restart
  manual.
- **Decisão DEMO vs LIVE é DINÂMICA, por usuário**: `isLiveExecutionActive(userId)`
  checa `broker_credentials` no banco a cada ciclo (cache 10s) — conectar/
  desconectar pela UI liga/desliga sem precisar editar `.env` nem reiniciar
  o processo. `MT5_LIVE_EXECUTION_ENABLED` continua como kill-switch mestre
  do deployment inteiro (ligado nesta sessão, a pedido explícito do Cleber
  após revisar o código).
- **`open_position`/`close_position`** (`tools.ts`) enviam ordem real quando
  live, com preço/ID de preenchimento vindos da resposta real da MetaAPI.
  `increase_position` (pyramiding) bloqueado em LIVE de propósito (risco de
  reconciliação alto demais pra esta 1ª versão).
- **Migration `20260908_add_broker_position_id_to_ai_trades.sql`**: nova
  coluna `ai_trades.broker_position_id`, guarda o ID real da posição na
  MetaAPI — usada também pela boleta manual (`OrderTicket.tsx`, via nova
  função `recordLiveManualPosition`/`closeLiveManualPosition` em
  `useApexLogic.ts`), que antes só gravava ordem real no ledger de
  auditoria (`broker_order_executions`), nunca em `ai_trades` — por isso
  posição real aberta manualmente nunca aparecia no Gráfico/Dashboard.

## Bugs reais encontrados e corrigidos no caminho

1. **Saldo real "piscava e voltava pro $100 sozinho"** — dois problemas
   em cadeia: (a) o `reconcile()` de `useApexLogic.ts` (5s) recalculava
   saldo simulado por cima do real; (b) um loop de P&L de 1s (mais rápido
   ainda) fazia a mesma coisa, sem saber que havia broker conectado. Os
   dois ganharam guarda: com broker conectado, só `reconcile()` mexe em
   saldo/equity, usando `getAccountInfo()` real.
2. **Linha "Alvo" fantasma no Gráfico** — `tp`/`sl` caíam pro próprio
   `entry_price` quando null (sem SL/TP real, ex: posição aberta direto no
   MT5), fazendo `hasTp`/`hasSl` (`ChartView.tsx`) acharem que havia alvo/
   stop de verdade. Corrigido comparando contra o preço de entrada.
3. **Linhas de posição sobrepostas** — 2+ posições reais no MESMO preço de
   entrada desenhavam exatamente uma em cima da outra. Deslocamento visual
   automático (só na posição da linha, nunca no preço mostrado no texto).
4. **Badge "DEMO" mesmo com conta real conectada e operando** — existiam
   DOIS campos `executionMode` diferentes no app (`aiConfig.executionMode`
   vs o de nível superior do contexto), sem sincronia entre si. Corrigido
   pra ler a fonte de verdade real (linha em `broker_credentials`, mesma
   que o backend usa) — e o badge agora é clicável: clique desconecta de
   verdade.
5. **`DELETE /broker/credentials` sempre chamava `undeploy` na MetaAPI** —
   achado grave: essa é a MESMA conta que serve streaming pra plataforma
   inteira, então "desconectar" um usuário derrubaria o preço de todo
   mundo. Removido o `undeploy` desse endpoint (só apaga a credencial).
   **Precisa de `supabase functions deploy server`** — já rodado nesta
   sessão.
6. **Card de Margem/Margem Líquida/Nível de Margem** adicionado ao
   Dashboard (`FinancialHUD.tsx`), dado real via `getAccountInfo()`
   (mesmos campos que o terminal MT5 mostra).
7. **Lista de posições da boleta sem número de lotes** — adicionado
   (reconvertido da exposição em dólar gravada no banco).

## O incidente real: Stop Out

Cleber testou a boleta manual (LIVE) e abriu/fechou algumas posições reais
em XETUSD — sem querer, chegou a ter 4 posições SELL simultâneas na mesma
conta de ~$22 (spread pago 2x cada uma). A margem esgotou:
`freeMargin` foi a **negativo** (-$0,39), `marginLevel` caiu a 48%
(abaixo do típico limite de Stop Out de corretora). Avisado explicitamente
ao Cleber (risco real de fechamento forçado) — ele optou por não agir,
"sei do risco". A corretora fechou as 4 posições à força pouco depois:
saldo real foi a **$0** (perda total do capital de teste).

**Achado mais importante desta parte**: nosso banco continuou mostrando as
4 posições como `OPEN` depois do Stop Out — só foi percebido porque o
Cleber comparou com o terminal MT5 e viu a divergência. Causa raiz: o
circuit breaker (que deveria só bloquear ORDEM NOVA) também desligava a
reconciliação (`liveReconcileTick`, `index.ts`) — um 504 transitório da
MetaAPI, minutos ANTES do Stop Out de verdade, já tinha disparado o
breaker e cegado a única rotina que poderia ter detectado e fechado a
posição sozinha. Corrigido: reconciliação agora roda SEMPRE que há posição
real esperada, independente do circuit breaker — quando uma posição some
da corretora (Stop Out ou fechamento manual fora da plataforma), fecha
automaticamente no banco com o último preço real conhecido (nunca
fabricado). As 4 posições desse incidente foram fechadas manualmente via
SQL nesta sessão (antes do fix existir); daqui pra frente o mecanismo
automático cobre isso sozinho.

## Estado ao fim da sessão

- Conta real conectada (`87026945` / `InfinoxLimited-MT5Live`), saldo $0
  (Stop Out). `MT5_LIVE_EXECUTION_ENABLED=true` continua ligado — motor
  pronto pra operar assim que houver saldo de novo.
- Monitor de 5 em 5 min da MetaAPI (task local desta sessão, não
  persistente entre sessões do Claude Code — recriar se precisar).
- Todos os commits desta sessão já aplicados pelo Cleber; deploy da Edge
  Function `server` (fix do `undeploy` perigoso) já rodado.
- **Pendente real**: decidir se/quando depositar mais capital pra testar
  de novo — com o aprendizado de que $22 (ou menos) não sobrevive nem a um
  erro de operação básico (4 posições opostas no mesmo ativo). Sizing
  mínimo real pra qualquer teste futuro precisa ser bem maior, ou o motor
  precisa de um teto de exposição agregada tão grande quanto o risco por
  trade em contas desse tamanho — não implementado ainda.
- **Pendente técnico menor**: item de "zoom do gráfico não segura" ficou
  em aberto (investigação começou, não concluída) — Cleber esclareceu que
  quer só o ZOOM (barSpace) mantido, sempre abrindo no preço atual (a
  restauração de scroll/âncora continua desligada de propósito, decisão de
  2026-09-02). Revisitar código de `captureCurrentChartConfig`/
  `useChartSessionState.ts` se o sintoma persistir.
