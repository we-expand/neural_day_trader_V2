# Handoff — próxima sessão

> Reescrito em **2026-08-19** (20ª parte — reescrita completa, não empilhada).
> **Regra: este arquivo é handoff da sessão CORRENTE. Reescreva, não empilhe.**

## ▶ COMECE AQUI — o que precisa acontecer, em ordem

**Detalhe completo da sessão de 2026-08-19 (3 partes)**:
[SESSAO_2026-08-19_LIMPEZA_POSICOES_ZUMBIS.md](SESSAO_2026-08-19_LIMPEZA_POSICOES_ZUMBIS.md)
(parte 1 — zumbis, cron, diagnóstico de performance),
[SESSAO_2026-08-19_GATE_DE_MARGEM.md](SESSAO_2026-08-19_GATE_DE_MARGEM.md)
(parte 2 — dimensionamento de posição, gate de margem por leverage) e
[SESSAO_2026-08-19_PYRAMIDING_COMPLETO.md](SESSAO_2026-08-19_PYRAMIDING_COMPLETO.md)
(parte 3 — Pyramiding System levado de decorativo a 100% real, unificado
num botão só, movido pra Configurações). Resumo do que importa pra
continuar abaixo.

### -1. **[NOVO, ATIVO] Pyramiding System — implementado 100%, sem teste real ainda**

Break-even/emergency-stop (estavam quebrados desde 08-18), Trailing Stop
(era decorativo), Take Profit Parcial e Fechar-em-Reversão (não existiam)
— todos implementados nesta sessão. Fechamento parcial/reversão só o
servidor pode executar (`ai-runner`), por isso precisou de migration nova
(`pyramid_group_id`/`pyramid_layer` em `ai_trades`, **já aplicada pelo
Cleber**). "AI Risk Analysis" (opt-in separado, nunca implementado) foi
removido — a pedido do Cleber, virou proteção sempre ativa embutida no
próprio botão "Pyramiding" (3 gates reais do motor: drawdown, ContextGate,
CostViabilityGate). Painel saiu da página principal do AI Trader e agora
vive em Configurações, abaixo de "Alerta de Correlação entre Posições".
Detalhe completo: `SESSAO_2026-08-19_PYRAMIDING_COMPLETO.md`.

**Próximo passo obrigatório**: deploy de teste
(`supabase functions deploy ai-runner --no-verify-jwt`) e observar um ciclo
completo real (layer → break-even/trailing → Partial TP/reversão →
fechamento no servidor) — nunca rodou contra o Supabase de verdade.

### 0. **[RESOLVIDO 2026-08-19, verificado por fora do relato do Cleber] "Push não aparece na Vercel" — era falso alarme**

Verificado via `git fetch`/`vercel ls`/`vercel inspect`: `dev` local e
`origin/dev` estão idênticos (commit `fb696f8d4` chegou no GitHub sem
defasagem). O deployment mais recente da branch `dev`
(`dpl_Hjnv7dJxJTcu6k6Bfm8zbhEfmLYh`, criado 2026-08-19 04:58:02 -03, **11s**
depois do commit `fb696f8d4` às 04:57:51) está com status **Ready** e
carrega o alias correto
`neural-day-trader-v2-git-dev-cleber-coutos-projects.vercel.app`. Ou seja: o
push chegou, o build passou, o alias aponta pro código novo — nada estava
quebrado do lado do deploy. Hipótese mais provável pro que o Cleber viu:
estava numa URL de deployment com hash antiga (imutável, já causou confusão
idêntica antes — ver seção "Ambientes e branches" do
[CLAUDE.md](CLAUDE.md)) ou cache de navegador. Se o Cleber confirmar que
ainda não vê o gate de margem funcionando no ambiente de teste, o problema
não é de deploy — é outra coisa (runtime, cache do browser, ou o próprio
comportamento do gate).

### 1. Gate de margem por leverage — implementado, não testado contra Supabase real

Motor de sizing agora usa `leverage` do catálogo (`assetDatabase.ts`) pra
limitar o nocional calculado a no máximo 30% do balance em margem por trade
(`clampToMarginAffordability`, `TradeSizing.ts`/`runTradingCycle.ts`).
`npm run validate` limpo. Commit `fb696f8d4` já pushado pelo Cleber (mas ver
item 0 acima). Detalhe completo, pesquisa de mercado e exemplo numérico:
`SESSAO_2026-08-19_GATE_DE_MARGEM.md`.

### 2. Zumbis — fix (a) implementado nesta sessão (2026-08-19), NÃO testado contra Supabase real ainda

Mecanismo raiz confirmado: `Deno.serve` em `ai-runner/index.ts` só buscava
sessões `status='RUNNING'`, então uma posição `OPEN` cuja sessão saísse desse
status (pausada, cron desabilitado no meio do caminho — exatamente o que
aconteceu com os 4 zumbis limpos nesta sessão) nunca mais tinha TP/SL
monitorado por ninguém, nem client nem servidor.

**Implementado**: watchdog no handler principal
(`supabase/functions/ai-runner/index.ts`) — busca toda sessão DEMO com pelo
menos 1 posição `OPEN` em `ai_trades`, **independente do status da sessão**,
e roda só `positionManagerTick` pra ela (`loadWatchdogSession` força
`isActive = false`, nunca abre entrada nova). Rodam depois das sessões
`RUNNING` na mesma invocação (série, nunca paralelo — mesma regra de sempre,
conta MetaAPI compartilhada). Também adicionado tracking de falha
consecutiva de fetch de preço (`positionTickFailureStreak` em
`positionManager.ts`/`index.ts`) — antes era `continue` silencioso
indefinido; agora loga um marcador escalado (grepável) a cada 10 ticks
consecutivos sem preço real, pra tornar visível quando uma posição fica
tempo demais sem monitoramento por falta de dado, mesmo com o watchdog ativo.

`npm run validate` (37/37) e `deno test seam_smoke_test.ts` (4/4) limpos.
`deno check` mostra só os 3 erros pré-existentes de
`BacktestDataService.ts`/`FunnelTelemetry.ts` (não relacionados, já
documentados). **Não testado contra o Supabase real ainda** — próximo passo
obrigatório antes de considerar pronto: deploy de teste
(`supabase functions deploy ai-runner --no-verify-jwt`), forçar uma sessão
pra `PAUSED`/`STOPPED` com posição `OPEN` de propósito, e confirmar no log
que o watchdog pega essa posição e fecha no TP/SL real.

Item (b) da causa raiz — **zero reconciliação contra corretora real** — não
foi tocado (fora de escopo desta sessão, watchdog só olha `ai_trades`, não
consulta MetaAPI pra confirmar se a posição realmente ainda existe do lado
da corretora). Item 4 do fix original proposto (client usar Supabase
Realtime em vez de polling condicional) também não implementado — o
watchdog resolve o lado servidor (TP/SL sempre monitorado), mas o client
ainda pode ficar visualmente desatualizado até o próximo poll.

### 3. Piso de $10 pode estar inflando risco (achado novo, não investigado a fundo)

Query real mostrou UKOUSD/XAUUSD batendo exatamente `$10.00` — indício de
que o piso `MIN_EXECUTABLE_NOTIONAL_USD` empurra risco pra cima em vez de
pular o trade, contradizendo a convenção documentada. Reler
`runTradingCycle.ts` linha ~1191 antes de decidir se é bug.

### 4. Status das 3 posições vivas da sessão anterior — aguardando encerramento natural

XBNUSD SHORT (entrada 09:20), XAUUSD LONG (14:01), XAUAUD LONG (14:04). Cron
desabilitado (sem novas entradas). Verificar PnL final, reconciliar balance
real vs dashboard.

### 5. Redução de custo por trade — investigado, NÃO é a causa dominante da baixa performance

Cleber perguntou "como seguir com a baixa performance" — investigação com
dado real (Supabase, `wyvdsxtcmizettljxtbg`) achou 2 causas, uma corrigida
nesta sessão, outra permanece estrutural:

1. **[CORRIGIDO 2026-08-19] Experimento R:R 1:1,5→1:3 do preset 5 reprovado
   e revertido.** 25 trades fechados entre 08-17 e 08-19, win rate **16%**
   (4/25), PnL líquido −$11,78. Com R:R real observado ~2,5-3:1, breakeven
   exige ~25-28% de acerto — 16% está bem abaixo, perda garantida por
   construção, não sinal ruim genérico. O próprio código já tinha o gatilho
   de reversão documentado ("reverter se a taxa de acerto cair demais") —
   condição atendida, revertido sem precisar de novo pedido. Fix:
   `atrTakeProfitMultiplier` volta de 3 pra 1.5 em
   [presetStrategies.ts:290](src/app/data/presetStrategies.ts:290).
   `npm run validate` limpo (37/37).
2. **[INVESTIGADO, conclusão: não é prioridade agora] "Reduzir custo por
   trade"** — hipótese original de Cleber. Query de 30 dias mostrou SPX500
   (-$571 em 4 trades) e BTCUSD (-$110 em 13) dominando 97% da perda — mas
   são trades de **2026-08-03/04**, de antes de todos os fixes de sizing
   (pointValue, leverage, margem): `stop_loss=0`, `take_profit=0`,
   `exit_reason='MANUAL'`, não representativos do motor atual. Refeita a
   query restrita a `entry_time >= 2026-08-17` (era atual, pós-fixes):
   perdas pequenas e uniformes por símbolo (-$1 a -$4), notional $400-$2000
   — nessa escala o custo de spread/slippage (frações de centavo, ver
   `research/CostModel.ts`) não é o que domina a perda. **Conclusão**: a
   causa da baixa performance observada nesta janela era o item 1
   (R:R mal calibrado), não custo de execução. Redução de custo continua
   válida como alavanca de longo prazo (universo de ativos mais barato,
   auditar `CostViabilityGate.ts`), mas os números atuais não a colocam como
   prioridade imediata.

**Próximo passo real**: deixar o preset 5 rodar de novo com R:R 1:1,5
(revertido) por uma amostra nova, e só então reavaliar performance — a
conclusão estrutural de fundo (EV ≈ −custo, sem edge comprovado, ver
CLAUDE.md item 0) continua de pé e não muda com este fix.

---

## Detalhe herdado de 2026-08-18 — item 7 (cliente/servidor em paralelo), ainda sem teste real

### Achado da noite anterior — **CONFIRMADO** em 2026-08-18 (leitura de código + query real)

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
