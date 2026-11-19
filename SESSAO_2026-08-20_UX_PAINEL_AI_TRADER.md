# Sessão 2026-08-20 — UX do painel AI Trader (Pyramiding, Risco, posições, persistência, lote mínimo)

Sessão de correções e redesenho visual no painel de configuração do AI
Trader, a partir de feedback direto do Cleber usando o produto. Nenhuma
mudança tocou o motor de decisão (`runTradingCycle.ts`) além de já ler o
gate de lote mínimo existente — todas as mudanças de "regra" foram só de
UI avisando uma regra que o motor já aplicava.

## 1. Redesenho visual — Gerenciamento de Risco (AITrader.tsx)

Grid de 4 colunas com `lg:col-span-3` irregulares deixava uma coluna vazia
na última linha e esticava (`stretch` padrão do CSS Grid) os cards curtos
até a altura do mais alto da linha, criando espaço morto interno (ex: card
"Modo Stop Loss").

Fix: grid fechado de 3 colunas (2 linhas, sem sobra) + `items-start` (cada
card mantém sua altura natural) + ícone colorido em cada cabeçalho de card,
casando com o padrão visual do resto da página. Pyramiding Configuration
virou bloco full-width abaixo do grid.

## 2. Card de posição aberta — nome truncado e "Contratos: —" mudo

`MarketScoreBoard.tsx`: `order.symbol.replace('USDT','').replace('USD','')`
cortava o sufixo de qualquer ativo (BTCUSD→BTC, SOLUSD→SOL). Removido —
mostra o símbolo completo sempre.

Campo "Contratos" mostrava um `—` mudo quando a exposição da posição não
fechava o lote mínimo do ativo (ex: BTCUSD com $150 de exposição — o lote
mínimo de 0,01 exige ~$727). Não era bug de cálculo: com esse nocional é
matematicamente impossível fechar o lote mínimo. Fix: mostra **"Abaixo do
mín."** com tooltip explicando a conta real, em vez de parecer erro/dado
ausente.

Achado colateral (não corrigido nesta sessão): se essa posição está aberta
agora com exposição abaixo do mínimo executável, é anterior ao gate que já
bloqueia isso na entrada (commit `55475d599`) — provavelmente trade DEMO
antigo. Não fabricado nenhum número pra "resolver" — decisão de fechar essa
posição específica fica com o Cleber.

## 3. Configuração do painel não persistia visualmente

Os **valores** de `aiConfig` sempre estiveram persistidos corretamente
(localStorage + Supabase, `useApexLogic.ts`). O que se perdia era só o
**estado visual do painel**:

- `configMode` (Simples/Avançado) nascia sempre em `'SIMPLES'` — sair da
  tela e voltar, ou dar F5, sempre voltava pro Simples. Fix: persiste em
  `localStorage` (`neural_ai_trader_config_mode`).
- `selectedRiskProfileId` era estado local, setado só no clique dentro de
  `applyRiskProfile`, nunca reconstruído a partir da config real — escolher
  "Agressivo" e voltar à tela mostrava os 4 cards sem nenhum destacado.
  Fix: agora é **derivado** da config atual a cada render (compara preset +
  timeframe + risco/trade contra `RISK_PROFILES`) — nunca mais "esquece"
  porque não é mais um estado próprio pra sincronizar.

Verificado ao vivo: seleção de perfil sobrevive à navegação entre telas e a
F5 completo.

## 4. Aviso de capital insuficiente por lote mínimo (regra, não sugestão)

Pedido explícito do Cleber: "lote mínimo é lote mínimo, ponto final" — o
motor já vetava silenciosamente (gate `MIN_TRADE_SIZE`,
`runTradingCycle.ts`, 2026-08-20 anterior), mas o usuário só descobria
vendo o ativo nunca operar.

- Nova função pura `getMinLotNotionalUsd(symbol, price)` em
  `lotSizeConversion.ts` — nocional mínimo real (`minLot × lotSize ×
  preço`), genérica pra qualquer ativo do catálogo, nunca fabrica número
  sem preço real disponível.
- `AssetUniverse.tsx`: chip do ativo já selecionado fica âmbar com ícone de
  alerta + tooltip quando o capital alocado não fecha o mínimo; banner de
  resumo lista todos os ativos inoperáveis com o capital atual e o valor
  mínimo exigido de cada um.
- `InfinoxAssetsBrowser.tsx` (buscador de ativos): mesmo aviso no grid por
  categoria e no dropdown de autocomplete, antes mesmo de selecionar.
- `AITrader.tsx`: passa `config.allocatedCapital` real pros dois
  componentes acima.

Testado ao vivo: BTCUSD com $100 de capital alocado → chip âmbar, banner
"BTCUSD (mín. ~$850)" com preço real do momento.

## Gate

`npm run validate` (37/37 OK) rodado depois de cada mudança nesta sessão.
`tsc --noEmit` sem erro novo em nenhum arquivo tocado (erros pré-existentes
confirmados via `git stash` antes de editar).

## Commits pendentes (Cleber roda)

Quatro commits entregues prontos ao longo da sessão — ver histórico do chat
pros comandos exatos (`git commit` com mensagem completa cada um):

1. `redesign: remodela grid de Gerenciamento de Risco (AI Trader)`
2. `fix: mostra símbolo completo do ativo e explica quando exposição fica abaixo do lote mínimo`
3. `fix: configuração do AI Trader não sobrevivia a navegação/reload no painel`
4. `feat: avisa o usuário quando o capital não fecha o lote mínimo de um ativo`
