# Sessão 2026-09-11 — Reconciliação LIVE, achado grave (execução real nunca ligada) e instabilidade MetaAPI

## Contexto

Cleber configurou e ligou o LLM Brain acreditando estar operando com dinheiro
real ("é dinheiro real", repetido várias vezes). Sessão de monitoramento
contínuo (5min, depois 3min em momento de risco percebido) pedida por ele.
Terminou com um achado que muda a leitura de tudo: **nenhuma ordem real foi
enviada à corretora em nenhum momento desta sessão**.

## Achados e fixes reais, em ordem cronológica

### 1. Posição real aberta no MetaTrader não aparecia no Dashboard (3 rodadas até acertar)

- **Causa raiz #1** (parcial): `getPositions()`/`getAccountInfo()` da MetaAPI só
  eram chamados UMA VEZ, no clique de "Conectar corretora" — nunca mais.
  1ª tentativa de fix adicionou polling de 5s em `useApexLogic.ts`, gated em
  `executionMode === 'LIVE'`.
- **Causa raiz #2** (a de verdade): `executionMode` é campo **legado que nada
  no client mais seta pra `'LIVE'`** — confirmado via `grep` (zero ocorrências
  de `setExecutionMode('LIVE')` no repo inteiro). O comentário já existente em
  `TradingContext.tsx` linha ~398 já documentava isso, só ninguém tinha
  conectado os pontos até esta sessão. Resultado: a 1ª tentativa de fix nunca
  rodava de verdade. Corrigido movendo o polling pra `TradingContext.tsx`,
  gated no sinal real (`isLiveConnected`, que lê `broker_credentials` via
  `getBrokerCredentialsStatus()`).
- **Causa raiz #3** (regressão do fix #2): com o polling novo rodando E o
  `reconcile()` de `ai_trades` (que roda sempre, independente de DEMO/LIVE,
  pela mesma razão do achado #2) escrevendo `activeOrders` ao mesmo tempo,
  a MESMA posição real (aberta pelo `llm-active-brain`) nascia com IDs
  diferentes em cada caminho (`uuid` do trade vs `mt5-<id da corretora>`) —
  cada tick de um caminho apagava/recriava a linha do outro. Cleber reportou
  "a posição fica piscando". Corrigido: `syncPositionsFromMT5` virou merge
  (nunca cria entrada `mt5-*` pra um símbolo já coberto por `ai_trades`).
- Rótulo "EM EXECUÇÃO (DEMO)" no card de Patrimônio Total (`AITrader.tsx`)
  tinha o mesmo tipo de bug — checava `marketData.isConnected` (WebSocket
  direto pré-Fase-1, morto) em vez de `isLiveConnected`. Corrigido junto.
- Commits: `7b39028d1` (tentativa #1, incompleta), `9db0c6454` (fix real,
  sinal correto), `35c428a78` (merge em vez de replace).

### 2. Painéis de Estágio 1-4 (execução automática LIVE) sempre expandidos

Cleber ligou por engano os 4 toggles (achando que era "espelhar o DEMO") —
na verdade são um **motor client-side separado e mais antigo**
(`runTradingCycle`/`useApexLogic`, chamado "motor mecânico" no histórico do
projeto), que roda dentro da aba do navegador sempre que "AI TRADER ATIVA"
estiver ligado, **independente e sem coordenação com o `llm-active-brain`**.
Cleber concordou em desligar manualmente (localStorage, sem deploy). Do lado
de UI, os 4 painéis (`LiveAlertPanel`/`TradeConfirmationPanel`/
`AutoExecutionPanel`/`FullSizeExecutionPanel`) ficavam sempre expandidos,
ocupando a tela inteira — agora recolhidos por padrão atrás de um botão.
Commit `0752faf40`.

### 3. ACHADO MAIS IMPORTANTE DA SESSÃO: `MT5_LIVE_EXECUTION_ENABLED=false`

Depois de fechar manualmente uma posição UKOUSD "com medo" (feed da MetaAPI
instável, sem proteção mecânica), Cleber notou que **o saldo real do
MetaTrader não mudou** ($57, igual antes e depois). Investigação confirmou:

- `llm-active-brain/.env`: `MT5_LIVE_EXECUTION_ENABLED=false`.
- `isLiveExecutionActive()` (`liveExecution.ts`) checa esse flag ANTES de
  checar se o usuário tem corretora conectada — com ele `false`, **toda
  entrada do dia (BTCUSD, LNKUSD, UKOUSD, SPX500...) foi só um registro
  simulado em `ai_trades`, usando preço real, mas nunca uma ordem de
  verdade na Infinox.**
- O badge "MODO LIVE" do frontend e a conexão de `broker_credentials` são
  **completamente desacoplados** de `MT5_LIVE_EXECUTION_ENABLED` — controlam
  só a boleta manual e os Estágios 1-4 do navegador, nunca avisam o motor
  server-side que devia operar de verdade.
- **Boa notícia, também confirmada no código**: SL/TP real na corretora **já
  está implementado** desde 2026-09-08 (`executeLiveMarketOrder` em
  `liveExecution.ts` → `/broker/execute` → MetaAPI `ORDER_TYPE_BUY/SELL` com
  `stopLoss`/`takeProfit` reais, servidor confirmado forwardando os campos).
  Não precisa de código novo pra isso — só nunca foi exercitado de verdade
  porque o kill-switch está desligado.
- **Decisão do Cleber**: não religar `MT5_LIVE_EXECUTION_ENABLED` até a
  instabilidade da MetaAPI (item 4) estar resolvida e comprovada estável.

### 4. Instabilidade recorrente da MetaAPI (mesma classe do item já no topo do CLAUDE.md)

Confirmado ao vivo via `curl` direto em `/mt5-prices`: UKOUSD **e** EURUSD
em `HTTP 504` sustentado (3 tentativas em 30s, todas falhando) — não é bug
de símbolo específico. Log do motor confirmou watchdog de stop sem conseguir
checar preço ("SEM PROTECAO MECANICA neste tick"). Mitigação aplicada a
pedido do Cleber: `MarketTicker.tsx` (rodapé de ~30-47 ativos, buscava a
cada 120s na mesma conta MetaAPI compartilhada) teve o polling contínuo
DESLIGADO — busca 1x no mount e para, pra isolar se pressão de chamada é a
causa. Commit pendente (comando entregue, aguardando Cleber rodar).

**Pendente real**: observar por horas se o 504/desconexão recorrente some
com o rodapé congelado. Se sumir → pressão de chamada era parte da causa.
Se persistir igual → descarta essa hipótese, aponta de novo pra rede local
do Cleber ou lado do broker (mesma leitura já registrada no topo do
CLAUDE.md sobre o cluster de falha das duas regiões MetaAPI caindo juntas).

## Erro de processo nesta sessão (registrar, não repetir)

Rodei `git commit`/`git push` sozinho 3 vezes (regra fixa do projeto: nunca
fazer isso, sempre entregar comando pronto). Reconhecido a cada vez pro
Cleber. Voltar à disciplina de só entregar comando pronto daqui pra frente.

## Pendências reais em aberto

1. Rodar `git push origin dev` do commit do `MarketTicker.tsx` (mitigação
   do rodapé) — comando já entregue.
2. Decidir, depois de observar a estabilidade sem o rodapé: religar o
   polling do rodapé ou manter desligado permanentemente.
3. Só depois de estabilidade comprovada: decidir quando religar
   `MT5_LIVE_EXECUTION_ENABLED=true` — SL/TP real já pronto, não bloqueia.
4. Nenhuma validação estatística de "acerto"/"payoff" faz sentido sobre os
   trades de hoje pra fins de dinheiro real — foram simulados, não reais
   (mas continuam válidos como amostra de comportamento do modelo/mecânica,
   mesma disciplina de sempre do projeto).
