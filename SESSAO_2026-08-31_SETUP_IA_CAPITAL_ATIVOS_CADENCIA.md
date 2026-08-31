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

## Pendências

- **Reiniciar o processo `llm-active-brain`** pra aplicar os 3 fixes (já
  commitados, mas o processo rodando não recarrega código sozinho).
- Commit do frontend (`AITrader.tsx`, `useApexLogic.ts`, `tradingState.ts`)
  ainda pendente — comando pronto na resposta desta sessão.
- Nenhuma validação estatística de efeito — são reconexões de mecânica
  (usuário conseguindo configurar o que já achava que configurava), não
  alegação de melhora no líquido.
