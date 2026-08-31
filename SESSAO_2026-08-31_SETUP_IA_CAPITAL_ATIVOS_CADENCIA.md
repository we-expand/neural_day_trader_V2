# Sessão 2026-08-31 — Setup do AI Trader: Capital, Ativos Simultâneos e Cadência reconectados ao LLM Brain

## Contexto

Cleber reportou que o Setup "AVANÇADO (MANUAL)" do AI Trader tinha campos
que a IA (LLM Brain, motor único desde hoje) não obedecia, e pediu um campo
novo de "Cadência Agressiva ou não".

## Achado (levantamento, não suposição — ver `neuralBridge.ts`/`tools.ts`)

Do que aparece na UI avançada hoje, `direction`, `activeAssets`,
`dailyLossLimit` e `riskPerTrade` já eram lidos de verdade pelo motor via
`getUserTradingConfig` (`llm-active-brain/src/neuralBridge.ts`). Dois
campos existiam na UI/salvavam no Supabase mas eram ignorados pelo motor:

- **Capital da IA** (`allocatedCapital`): buscado em `neuralBridge.ts` mas
  nunca consumido em nenhum outro lugar — campo morto.
- **Ativos Simultâneos** (`maxAssets`): nem existia no contrato
  `UserTradingConfig` do motor — não chegava nele.

**Cadência** não existia em nenhum lugar — o intervalo entre ciclos
(`CYCLE_DELAY_SECONDS`) é global via `.env`, igual pra todo mundo.

## O que foi implementado

1. **Capital da IA**: `allocatedCapitalUsd` agora é usado como base do
   sizing por risco quando menor que o saldo real da sessão
   (`Math.min(allocated, accountBalance)`) — `tools.ts`, bloco de sizing do
   `open_position`.
2. **Ativos Simultâneos**: novo campo `maxSimultaneousAssets` em
   `UserTradingConfig`; `open_position` bloqueia abrir posição num símbolo
   NOVO se o número de símbolos distintos já abertos atingiu o teto do
   usuário (reforçar um símbolo já aberto continua liberado até o teto por
   símbolo existente, `MAX_POSITIONS_PER_SYMBOL`).
3. **Cadência de Entrada** (campo novo, `CONSERVADORA`/`NORMAL`/`AGRESSIVA`):
   como o loop de ciclos é um só por processo, compartilhado por todas as
   sessões multi-tenant (serial, rate-limit da conta MetaAPI compartilhada),
   cadência **não pausa o processo inteiro** — ela só restringe a AVALIAÇÃO
   DE ENTRADA NOVA (`open_position`) a 1 a cada N ciclos globais
   (AGRESSIVA=1, NORMAL=2, CONSERVADORA=4), usando o número do ciclo
   (determinístico, sem estado extra). O monitoramento mecânico de
   stop/breakeven/trailing (`enforceMt5StopsAndTargets`, roda no início de
   `runAgent`, antes de qualquer decisão) **nunca é afetado** — posições já
   abertas continuam protegidas em todo ciclo, independente da cadência.
4. UI (`AITrader.tsx`): slider "Ativos Simultâneos" e card "Capital da IA"
   já existiam e já salvavam certo — só precisavam do motor ler. Adicionado
   o seletor novo "Cadência de Entrada" (3 botões, mesmo padrão visual de
   "Direção Preferencial").

## Verificação

- `cd llm-active-brain && npx tsc --noEmit` — limpo.
- `npm run validate` (gate obrigatório do motor) — 37/37 OK.
- `npx tsc --noEmit -p tsconfig.json` no frontend — mesma contagem de erros
  pré-existentes antes e depois da mudança (631, não relacionados a este
  trabalho, confirmado via `git stash`/`git stash pop`) — nenhuma regressão
  nova.
- Não testado ao vivo contra o motor rodando (não reiniciado nesta sessão).

## ⚠️ Achado de processo (não é bug de código, é risco operacional)

As mudanças em `llm-active-brain/` (`neuralBridge.ts`, `tools.ts`, e
`index.ts` sem alteração líquida) foram **commitadas e pushadas
automaticamente por OUTRA sessão concorrente** rodando na mesma pasta
(commit `64397d751`, mensagem sobre um fix não relacionado — "Desligar IA"
não orfaniza mais posições). Confirmado que o HEAD local ficou igual ao
`origin/dev` no meio da edição, sem esta sessão ter rodado `git
commit`/`git push` em nenhum momento. **Duas sessões do Claude Code
rodando na mesma pasta ao mesmo tempo é um risco real de mistura de commits
sem revisão** — evitar rodar sessões paralelas no mesmo working directory.

## Parte 2 (mesma sessão, depois do restart acima): restauração completa da tela

Depois do primeiro round (Capital/Ativos Simultâneos/Cadência) ir ao ar, o
Cleber testou e reportou que a tela AVANÇADO ainda não batia com o setup
manual original ("Pedi igual a isso! Tudo tem que funcionar + cadencia
agressiva") — vários campos (Timeframe, Estratégia, Fluxo de Operação,
Alvo de Lucro, Lotes Máximos, Máximo de Posições) tinham sido REMOVIDOS da
UX num commit anterior do mesmo dia (`09ba45256`, "sem equivalente no motor
novo"). Em vez de manter removidos, cada um foi restaurado na UI E
reconectado com efeito real no motor:

1. **Timeframe Operacional** (1m/5m/15m/1H/4H) — o maior dos seis: todos os
   indicadores derivados de candle (tendência/volume/suporte-resistência/
   MACD/estocástico/padrões de candlestick) eram calculados sobre um
   fetch fixo de candle de 5min (`atr.ts`, `fetchRecentCandles(symbol)`,
   sem parâmetro). Threadado um parâmetro `timeframe` por `fetchRecentCandles`
   e pelas 6 funções exportadas que a usam (`getAtrPercent`, `getTrendInfo`,
   `getVolumeConfirmation`, `getSupportResistance`, `getMacd`,
   `getSlowStochastic`, `getCandlePatterns`), com cache separado por
   `símbolo:timeframe` (TTL escalado por timeframe — 30s pra 1m, 15min pra
   4H, preserva os 5min de antes pros demais). `lookbackMinutes` reportado
   ao LLM também passou a ser calculado dinamicamente
   (`TIMEFRAME_MINUTES`), não mais hardcoded assumindo 5m. Chamadas em
   `tools.ts` (`get_mt5_quote` e `open_position`) passam
   `session.userConfig.timeframe` (default `"5m"`, preserva comportamento de
   sessões sem essa config).
2. **Estratégia** (dropdown de preset, 5 opções fixas de
   `presetStrategies.ts`) — este agente raciocina livre (não tem o motor de
   blocos `evaluateStrategyAt` do motor mecânico antigo que dava significado
   formal aos presets), então a única forma honesta de "obedecer" é como
   DIRETIVA DE ESTILO no prompt: `STRATEGY_PRESET_NAMES` (map id→nome,
   hardcoded em `neuralBridge.ts` porque este processo Node/tsx não importa
   a árvore client-side) resolve o nome, injetado no `userMessage` de cada
   ciclo (`agent.ts`) como "Estratégia preferida do usuário: X. Priorize
   setups alinhados com esse estilo... mas continue seguindo todas as regras
   de risco/gates mecânicos normalmente." Estratégia personalizada (UUID sem
   nome conhecido) não injeta nada — nunca inventa um nome.
3. **Fluxo de Operação** (A Favor/Contra) — guard real em `open_position`.
   Já existia um guard parcial (bloqueia contra-tendência só quando SEM
   volume confirmando); agora, quando o usuário escolhe explicitamente:
   "A Favor" aperta (bloqueia contra-tendência SEMPRE, mesmo com volume) e
   "Contra" inverte (só libera contra-tendência/lateral, busca reversão em
   suporte/resistência — mesmo texto que já existia na UI antiga). Sem
   escolha (null), mantém o guard original.
4. **Alvo de Lucro (Range)** (Poucos/Médio/Muitos) — sobrepõe o R:R
   (`takeProfitPct = stopPct * rrMultiplier`) quando configurado
   (`RR_BY_TARGET_POINTS`: POUCOS=1.5, MÉDIO=3, MUITOS=5); sem escolha,
   mantém o baseline atual (`mt5TakeProfitAtrMultiplier /
   mt5StopAtrMultiplier` = 2.0).
5. **Lotes Máximos por Trade** — teto do usuário no sizing (`tools.ts`),
   sempre aplicado com `Math.min` junto do teto de segurança global
   (`mt5SafetyMaxLots`) — nunca afrouxa, só aperta.
6. **Máximo de Posições Abertas** — teto NOVO, agregado (`openPositions.length`
   de TODAS as posições da sessão, qualquer símbolo) — diferente do teto de
   Ativos Simultâneos (que conta só símbolos DISTINTOS, já existia). Ex: 2
   posições em BTCUSD conta 2 aqui, mas 1 símbolo lá.
7. **Capital para IA** — card voltou a ser editável (tinha virado read-only
   numa decisão anterior "definitiva" que a instrução direta do Cleber nesta
   sessão sobrepôs) — já estava conectado ao sizing desde a Parte 1 acima.

Todos os campos novos vivem em `UserTradingConfig`
(`llm-active-brain/src/neuralBridge.ts`), lidos de `ai_user_config.config`
(mesma tabela que `saveUserAIConfig` já grava por inteiro — nenhum campo
novo precisou de mudança na função de salvar). UI restaurada em
`AITrader.tsx` reproduzindo o layout exato da tela original (2 colunas:
Estratégia à esquerda, Gestão de Volumetria à direita).

### Verificação (parte 2)

- `cd llm-active-brain && npx tsc --noEmit` — limpo.
- `npm run validate` — 37/37 OK.
- `npx tsc --noEmit -p tsconfig.json` no frontend — mesma contagem de erros
  pré-existentes (631, não relacionados).
- `npx vite build` local gerou bundle com hash IDÊNTICO ao publicado na
  Vercel antes desta parte — confirmação de que o build de produção não
  tinha ficado desatualizado (investigação do "não foi pro ar" da Parte 1
  concluiu que era cache de navegador, não deploy ausente).
- **Testado ao vivo**: processo reiniciado (`./restart.sh`), log do ciclo 1
  confirma os 6 campos novos chegando via `getUserTradingConfig`:
  `"timeframe":"5m","targetPoints":"POUCOS","marketMode":"TREND","strategyLabel":"Momentum de Curto Prazo (Scalp)","maxLotsPerTrade":1,"maxOpenPositionsTotal":4"`.

### Achado de processo (recorrente nesta sessão)

Outra sessão do Claude Code seguiu rodando em paralelo na mesma pasta
durante toda a Parte 2 também — confirmado por `neuralBridge.ts` e
`agent.ts` mudando em disco por conta própria (conteúdo de uma ponte
"autonomous_money"/Binance completamente não relacionada a este trabalho,
prepend no início do arquivo) e por `assetBasket.ts` aparecer modificado
sem eu ter tocado nele. Nenhum conflito real aconteceu (tsc seguiu limpo
depois de cada mudança externa), mas reforça o achado da Parte 1: evitar
sessões paralelas no mesmo working directory.

## Pendências

- **Commit do frontend + engine desta Parte 2** — comando pronto, dado na
  resposta final desta sessão (inclui `agent.ts`, `atr.ts`,
  `neuralBridge.ts`, `tools.ts`, `AITrader.tsx`; NÃO inclui
  `assetBasket.ts`, que pertence à outra sessão paralela).
- Nenhuma validação estatística de efeito em nenhuma das duas partes — são
  reconexões de mecânica (usuário conseguindo configurar o que já achava
  que configurava), não alegação de melhora no líquido.
- Estratégia personalizada (fora dos 5 presets) não recebe nenhuma diretiva
  no prompt — comportamento honesto (não inventa nome), mas também não é
  "funcionando" no sentido pleno; se o Cleber quiser diretiva pra
  estratégias personalizadas também, precisaria buscar a definição de
  blocos da estratégia (tabela `strategies`) e traduzir pra texto, escopo
  não coberto aqui.
