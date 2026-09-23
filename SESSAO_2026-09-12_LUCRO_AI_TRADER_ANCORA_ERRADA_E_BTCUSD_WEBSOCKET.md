# Sessão 2026-09-12 — "Lucro AI Trader" ancorava em $100 fixo + BTCUSD ganha WebSocket da Binance

## Contexto

Cleber mandou 2 prints do MT5 e do Dashboard lado a lado, notando preço
diferente pro mesmo ativo aberto (BTCUSD/NAS100) e perguntando sobre o
delay/latência.

## Achado 1: divergência de preço MT5 vs Dashboard — não é bug

- NAS100: MT5 mostrava 29392,22, Dashboard 29392,53 — diferença de ruído
  normal de tick, sem relevância.
- BTCUSD: MT5 (Infinox) mostrava -1,03, Dashboard mostrava +0,05 — maior
  porque BTCUSD é roteado direto pra Binance em `/mt5-prices` desde
  2026-08-31 (decisão de produto já tomada, documentada em
  `project_variacao_pct_cripto_24h_vs_terminal.md`), então diverge do
  preço Infinox do MT5 por definição — venues diferentes, não corrigível
  sem reverter aquela decisão.

## Achado 2 (bug real, corrigido): "Lucro AI Trader" usava $100 fixo, não o capital alocado

Card do Dashboard mostrava "RISCO ALTO" e "-$85,78" ao lado de
"Capital Líquido: $14,22" — número alarmante de mais.

Causa raiz em `MarketScoreBoard.tsx:833`:
```js
const profitAi = (portfolio?.equity || 0) - (config.initialBalance || 100);
```
Ancorava contra `config.initialBalance` (default hardcoded $100), não
contra o capital real alocado no Setup (`allocatedCapital`, confirmado via
SQL em `ai_sessions.config`: $54,03). Com equity real ~$14,22:
`14,22 − 100 = -85,78` — bate exatamente com o número exibido.

**Mesma classe de bug já corrigida no card "Risco da Conta" em
2026-09-11** (ancorar em `allocatedCapital`, não em pico/valor fixo) — só
não tinha sido aplicada aqui. Corrigido: `profitAi` agora usa a mesma
constante `allocatedCapital` já declarada no arquivo. Contra o capital
real ($54,03), a perda real passa a ser **-$39,81**, não -$85,78 — ainda
negativo, mas o número deixa de inflar artificialmente o alarme.

`tsc --noEmit`: erros pré-existentes de sempre no arquivo (executionMode,
initialBalance em outro ponto, strategy em TradeVisual), nenhum novo nas
linhas tocadas. Commit entregue, aguardando Cleber rodar (regra fixa do
projeto).

## Achado 3: BTCUSD sem push em tempo real — implementado WebSocket da Binance

Cleber pediu pra melhorar "delay e latência" do preço. Investigação
achou que BTCUSD é o ÚNICO ativo da cesta sem push via `streaming-relay`
(WebSocket MetaAPI já religado e estável, ~19h+ de uptime sem erro na
hora da checagem) — foi excluído de propósito da assinatura MetaAPI desde
2026-08-31 (pra não sobrepor o preço Binance-preciso do polling REST com
o tick do broker Infinox), mas isso deixou BTCUSD só com REST polling
(~1,5-2s de ciclo) em vez de push sub-segundo como o resto da cesta.

Implementado: WebSocket público da Binance (`wss://stream.binance.com:9443/ws/btcusdt@ticker`,
sem autenticação, mesmo par `BTCUSDT` já usado no polling REST de
`/mt5-prices`) publicando no MESMO canal/formato `turbo-main-channel` →
`price-update` que o frontend já consome — só troca o TRANSPORTE (REST→push),
nunca a fonte (continua Binance, nunca Infinox/MetaAPI, preservando a
decisão de roteamento de 2026-08-31). Reconecta sozinho com backoff
(2s→30s), isolado da conexão MetaAPI — falha aqui não derruba o resto do
relay.

Arquivos: `streaming-relay/src/index.ts` (nova função
`connectBinanceBtcTicker`, chamada em `main()` logo após o canal Supabase
subscrever), `streaming-relay/package.json` (`ws`/`@types/ws` promovidos
de dependência transitiva pra explícita).

`tsc --noEmit` e `npm run build` (esbuild) limpos — bundle final 283kb
(ws puro JS, sem dependência nativa, empacota sem problema).

**Aplicado e confirmado ao vivo**: build local rodado, processo
reiniciado via `launchctl kickstart -k gui/$(id -u)/com.neuralday.streaming-relay`
(PID novo 75957) — log confirmou `✅ WebSocket Binance (BTCUSDT ticker)
conectado` e a sincronização MetaAPI (Londres + réplica Nova York) logo
em seguida, sem nenhuma quebra no restart. Nenhuma posição aberta afetada
(é só o feed de preço).

## Pendente

- `git commit` dos dois fixes (comandos entregues, aguardando Cleber
  rodar — regra fixa do projeto, Claude nunca commita sozinho):
  - `MarketScoreBoard.tsx` (fix do `profitAi`)
  - `streaming-relay/src/index.ts` + `package.json`/`package-lock.json`
    (WebSocket Binance)
- Deploy do fix do Dashboard depende só de push pra `dev` (frontend puro,
  Vercel builda automático) — sem migration, sem redeploy de Edge
  Function.
- Observar por alguns dias se o BTCUSD do Dashboard fica visivelmente
  mais "vivo"/rápido que antes; sem validação estatística de latência
  medida (não cronometrei delay antes/depois em ms).
