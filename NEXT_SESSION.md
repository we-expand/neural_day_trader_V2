# Handoff — próxima sessão

> Reescrito em **2026-08-18** (17ª parte — reescrita completa, não empilhada).
> **Regra: este arquivo é handoff da sessão CORRENTE. Reescreva, não empilhe.**

## ▶ COMECE AQUI — o que precisa acontecer, em ordem

**Contexto desta sessão**: Cleber dormiu com a IA rodando 24/7 e pediu
monitoramento noturno (checagens de 20 em 20min até 12h UTC). Essa sessão de
monitoramento rodou numa janela/sessão separada (`neural-day-trader-f8`) que
**já não existe mais** ao reabrir pela manhã — não foi possível recuperar o
transcript completo dela (tentativa via `SendMessage` entre sessões não
retornou resposta útil antes da sessão fechar). O que se sabe do que ela fez
é só o resumo que o Cleber colou manualmente, reproduzido abaixo.

### 1. Achado da noite — **CONFIRMADO** nesta sessão (leitura de código + query real)

A sessão noturna reportou um **desvio entre saldo e trades reais**. Verificado
nesta sessão por leitura de código e query direta no Supabase — **é fato, não
suspeita**:

**Confirmação por código**:
- `supabase/functions/ai-runner/lib/positionManager.ts:135-148`
  (`persistPositionClose`) só faz `UPDATE` em `ai_trades` (exit_price, pnl,
  status) — nunca toca `ai_portfolio_snapshots`.
- `supabase/functions/ai-runner/index.ts:75` só faz `SELECT` em
  `ai_portfolio_snapshots` (pra reconstruir estado ao carregar a sessão);
  não há nenhum `INSERT`/`UPDATE` nessa tabela em todo o `ai-runner`.
- Quem grava `ai_portfolio_snapshots` é só o cliente
  (`AITradingPersistenceService.ts:434`, `.insert()`), disparado a partir de
  `useApexLogic.ts:1553` (`newBalance = prev.balance + realizedPnL`) — e esse
  código só roda quando o **próprio cliente** processa o fechamento da
  posição em memória. Se o `ai-runner` fecha a posição no servidor sem o
  cliente saber, o cliente nunca soma esse PnL ao balance, e o próximo
  snapshot que ele grava carrega o balance antigo.

**Confirmação por dado real** (`ai_trades` + `ai_portfolio_snapshots`, sessão
`66faee09-fe87-4bc6-a9a6-1ee8d7edb504`):
- Trade XAUAUD (`17a49e67-06af-431b-91c7-c183c599408f`) fechou no servidor às
  2026-08-18 02:34:40 UTC com `net_pnl = +2.9546`, gravado certo em
  `ai_trades`.
- Snapshots de `ai_portfolio_snapshots` entre 02:20 e 02:49 UTC (24 pontos,
  1/min): `balance` fica travado em exatamente `100` em **todos** eles, antes
  e depois do fechamento — só `equity` varia (reflete PnL não-realizado de
  outra posição aberta, não este fechamento).
- Deriva acumulada é maior do que só esse trade: soma de `net_pnl` de todos
  os trades `CLOSED` da sessão até agora é **-0.12** (ou seja, balance
  esperado ≈ 99.88 partindo de 100 inicial), mas o snapshot mais recente
  (10:08:09 UTC) tem `balance = 93.58` — **~6.3 de deriva não explicada só
  pelo mecanismo confirmado acima**, sinal de que pode haver mais de uma
  causa contribuindo (ex: outras sessões/trades não capturados nesta
  amostra, ou outro caminho de escrita). Não investigado a fundo — próxima
  sessão que pegar isso deveria reconciliar trade a trade, não só o
  agregado.

**Risco confirmado**: o `RISK_GATE`/Daily Loss Limit (ver comentário em
`ai-runner/index.ts:129-134`) lê exatamente esse `balance` como
`dayAnchorBalance`. Fechamentos reais feitos pelo servidor não atualizam esse
valor — o gate de proteção fica cego tanto pra ganho quanto pra perda real
originada no servidor, na direção oposta ao bug já documentado no item 7
(que era o inverso: equity > balance disparando Safe Mode falso).

**Isto é a mesma causa raiz do item 7** (cliente e servidor operam em
paralelo, sem uma única fonte de verdade pra portfolio). Não é bug novo e
distinto — é outra manifestação do mesmo risco estrutural, agora com dado
que prova o mecanismo exato.

**Reconciliação trade a trade da deriva de -6.3 — feita nesta sessão**:
decompõe exatamente em 3 eventos (soma dos erros = -6.2959, bate com a
deriva observada). Comparando `ai_trades.net_pnl` (autoritativo, servidor)
contra o delta real aplicado em `ai_portfolio_snapshots.balance` (cliente),
sessão `66faee09-fe87-4bc6-a9a6-1ee8d7edb504`:

1. **17a49e67** (XAUAUD +2.95, fechou 02:34 no servidor): ganho nunca
   aplicado ao balance — mesmo mecanismo já descrito acima (cliente não
   estava observando quando o servidor fechou).
2. **30dd3ab1** (XAUAUD, `ai_trades.stop_loss`=6186.19, `net_pnl`=-1.25):
   cliente aplicou só -0.01 (quase zero) — bate com o recurso de
   **breakeven automático em +1R** (`useApexLogic.ts:1448-1458`): o
   cliente moveu seu próprio SL em memória pro preço de entrada e fechou
   ali, enquanto o servidor manteve o SL original (mais largo) do banco e
   só fechou depois, com perda real maior.
3. **844dff4d** (JP225, `ai_trades.stop_loss`=67230.98, `exit_price`=67239.07
   — batida de stop normal e plausível, `net_pnl`=-1.16): cliente aplicou
   -5.74 (~5x maior). Indício de tick de preço ruim/desatualizado no feed do
   cliente pra JP225 naquele instante — não confirmável sem log de preço
   tick a tick, que não está disponível.

**Achado importante**: o fix já escrito (`persistPortfolioSnapshot` em
`index.ts`/`positionManager.ts`, ver diff não commitado) resolve só o caso
1 (fechamento no servidor sem o cliente saber). **Não resolve os casos 2 e
3** — esses vêm do cliente fechando posições ativamente com **SL/preço
calculados de forma independente do servidor** (trailing/breakeven em
memória, feed de preço próprio) e gravando snapshot com o pnl dele, não o
real. Enquanto o cliente mantiver autoridade de fechamento em paralelo com
lógica própria, esse tipo de erro pode se repetir mesmo com o fix do
servidor no ar. Evidência concreta a favor de resolver o item 7 (tirar
autoridade de fechamento do cliente, deixá-lo só leitor) — não é mais só
risco teórico, tem 2 casos reais de balance corrompido por essa causa
específica.

**Decisão do item 7 tomada e implementada nesta sessão (2026-08-18, ainda não
testada contra o Supabase real nem commitada)**: cliente perde autoridade de
fechar trade em modo DEMO. Mudanças:

1. **Portado pro servidor o que faltava**: breakeven automático em +1R
   (`supabase/functions/ai-runner/lib/positionManager.ts`, função
   `tickPositionManager`) — só existia no cliente até agora; era a causa raiz
   confirmada do caso 2 da reconciliação acima. Ordem de aplicação replicada
   fielmente do cliente: breakeven primeiro (roda mesmo em modo FIXO), depois
   trailing DINÂMICO ratcheta a partir do SL já ajustado pelo breakeven.
2. **Cliente para de fechar posição em DEMO**
   (`src/app/hooks/useApexLogic.ts`, PNL LOOP): `hitTP`/`hitSL` agora exigem
   `clientHasCloseAuthority = executionMode !== 'DEMO'`. Em DEMO a posição
   nunca fecha no cliente — só quando o `ai-runner` fecha no banco e o
   polling de reconciliação (linha ~816) remove do `activeOrders`.
3. **Cliente para de escrever snapshot de portfólio em DEMO** — removido o
   `savePortfolioSnapshot` periódico (60s) do PNL LOOP, que usava
   `realizedPnL` local (sempre 0 agora, já que o cliente não fecha mais nada
   — escrever por cima do balance do servidor recriaria o bug original).
   `lastSnapshotAtRef` (agora sem uso) removido.
4. **Balance/equity/drawdown passam a ser sincronizados do servidor** no
   mesmo polling de 15s que já sincronizava `activeOrders`
   (`getEquityCurve(sessionId)`, pega o snapshot mais recente) — sem isso o
   Dashboard ficaria travado no balance de quando a IA foi ligada.

**Escopo deliberadamente deixado de fora**: modo LIVE (broker real) não foi
tocado — `clientHasCloseAuthority` é `true` fora de DEMO, comportamento
inalterado. Não auditei a integração `/broker/execute` nesta sessão; mudar
autoridade de fechamento em LIVE sem entender como o broker real trata
SL/TP seria arriscado demais pra fazer de passagem.

`npm run validate` e `deno check` (só erros pré-existentes, não relacionados,
em `BacktestDataService.ts`/`FunnelTelemetry.ts`) passaram limpos. **Não
testado contra o Supabase real ainda** — próximo passo obrigatório antes de
considerar pronto:
- Deploy de teste do `ai-runner` (`supabase functions deploy ai-runner
  --no-verify-jwt`) e observar pelo menos um ciclo completo de
  abertura→breakeven/trailing→fechamento, conferindo que `stop_loss` sobe
  pro preço de entrada no banco quando o trade anda +1R a favor.
- Confirmar visualmente no cliente (aba ligada, DEMO) que balance/posições
  seguem atualizando via polling mesmo sem o cliente fechar nada.
- Ainda pendente, separado desta mudança: reverter/corrigir o balance
  histórico da sessão `66faee09-...` (ver opções na resposta da
  investigação — snapshot corretivo por `INSERT`, nunca `UPDATE`
  retroativo, com coluna de auditoria a criar em `ai_portfolio_snapshots`
  antes).

### 2. Monitoramento noturno — encerrado

A sessão `neural-day-trader-f8` que fazia o monitoramento não está mais
acessível (janela fechada/reiniciada). Confirmado via `CronList` que **não
há nenhum cron agendado** pendente — o monitoramento parou junto com a
sessão, nada rodando em background agora.

## Estado herdado de sessões anteriores, sem mudança nesta sessão

Ver seção "Pendências reais em aberto" no [CLAUDE.md](CLAUDE.md) — lista
completa e atualizada, incluindo:
- Item 0 (ativo): redesenho do cérebro de decisão, meta de trades/dia
  revisada pendente de decisão do Cleber.
- Item 7: risco estrutural de cliente e servidor operando em paralelo (Safe
  Mode só existe no cliente) — **o achado da seção 1 acima, se confirmado,
  provavelmente é uma manifestação desse mesmo risco**, não uma causa nova.
- Item 3: decisão de roteamento de cripto (Binance direto vs MetaAPI)
  pendente.
- Item 5: modelo financeiro reconstruído, commit pendente.
- Item 6: ideia registrada (probabilidade de acerto calibrada), não
  iniciada.

Nada dessas pendências foi tocado nesta sessão.
