# Handoff — próxima sessão (atualizado em 2026-07-30, 3ª sessão do dia)

> **Estado**: branch `dev`, working tree com mudanças NÃO commitadas (ver
> lista abaixo — Cleber decide o commit/push, regra fixa do projeto).
> Continuação direta da 2ª sessão: os dois itens sugeridos no handoff anterior
> foram feitos — **(a) auditoria do Componente 4** (hard stop/daily loss) e
> **(b) implementação do Componente 5** (diagnóstico MFE/MAE retrospectivo).
>
> **Leitura obrigatória antes de qualquer trabalho no motor**:
> `CLAUDE.md` pendência **#5** (estado real, agora atualizado, dos 5
> componentes do cérebro de execução) + `research/AI_BRAIN_SPEC.md` seção 14.

## Resumo rápido pra abrir uma nova janela/sessão

1. Ler este arquivo inteiro.
2. Ler `CLAUDE.md`, pendência #5 (achado da auditoria do Componente 4 +
   detalhe do Componente 5 implementado).
3. Rodar `git status` — working tree tem mudanças de **duas sessões
   diferentes** misturadas, ver seção "O que está no working tree" abaixo
   antes de decidir o que commitar junto.

**Estado em uma frase**: dos 5 componentes do cérebro de execução, **1
(custo) e 5 (diagnóstico MFE/MAE) estão implementados**, **2 (sizing ATR) e 3
(correlação heurística) já existiam**, e o **4 (hard stop/daily loss) tem uma
falha real confirmada por auditoria**: o Kill-Switch e o Health Check só
impedem abrir trade NOVO — nenhum dos dois fecha uma posição LIVE real já
aberta na corretora quando o limite é violado. Push pro GitHub é sempre
manual do Cleber.

---

## O que foi feito nesta sessão

### 1. Auditoria do Componente 4 (hard stop/daily loss) — achado real

Rastreei todo o caminho de risco em `useApexLogic.ts`:

- **Health Check Guardian** (intervalo de 5s) e o **Kill-Switch síncrono**
  (`riskManager.shouldActivateKillSwitch`, chamado só na hora de avaliar uma
  entrada nova) **só impedem abrir trade novo**. Nenhum dos dois fecha
  posição já aberta.
- O Kill-Switch chama `setActiveOrders([])` — isso só limpa o **estado local**
  (rastreamento usado em modo DEMO). Não é uma chamada à corretora.
- Para trades LIVE reais, a única via de abertura é o **Estágio 2**
  (`useTradeConfirmationStage.ts`, confirmação manual → `/broker/execute` via
  `BrokerClient.ts`). Quando safe mode/kill-switch dispara, esse módulo só
  cancela confirmações **ainda pendentes** — não fecha posições já executadas
  na MetaAPI.
- `BrokerClient.ts` **já expõe** `closePosition`/`closeAllPositions` (chamam
  `/broker/execute` com `action: 'closePosition'`/`'closeAllPositions'`), mas
  essas funções só são chamadas manualmente por `LiveTradingTest.tsx` (tela de
  teste) — nunca automaticamente pelo `RiskManager` ou pelo Health Check.

**Conclusão**: o hard stop hoje é "não-burlável" apenas contra a IA abrir
posição nova. Uma posição LIVE já aberta no momento em que o daily loss limit
ou o kill-switch dispara **fica sem gestão automática** até o usuário intervir
manualmente. Isso é uma lacuna real de segurança pro estágio LIVE do produto.

**Fix NÃO implementado ainda** (ficou fora do escopo desta auditoria, é
trabalho novo): ligar `shouldActivateKillSwitch`/Health Check a
`closeAllPositions()` quando `executionMode === 'LIVE'`. Fica em aberto uma
decisão de desenho: o que fazer se a própria chamada de fechamento à MetaAPI
falhar (não dá pra assumir "fechado" sem confirmação real do broker — precisa
de retry com backoff e/ou alerta persistente pro usuário, não um "tentei uma
vez e desisti").

### 2. Componente 5 — diagnóstico de eficiência de saída (MFE/MAE do usuário)

Implementado `src/app/services/analysis/TradeEfficiencyDiagnostic.ts`:

- `computeMfeMaeFromCandles`: mesma fórmula de excursão (high/low barra a
  barra) que já existia — não commitada — em `BacktestEngine.ts` desta manhã.
- `diagnoseTradeEfficiency`: compara resultado realizado contra o MFE medido
  → `exitEfficiency` (fração do MFE capturada) e `gaveBackPercent`.
- `diagnoseClosedTrade`/`diagnoseClosedTrades`: buscam candle REAL da janela
  entrada→saída via `backtestDataService` (mesma fonte real já usada por
  Replay/Backtest) e agregam o relatório. Chamadas **sequenciais** de
  propósito (mesma razão de sempre: fontes de candle real sofrem rate-limit
  sob rajada). Falha de um trade nunca derruba o lote — entra em
  `failedTrades` com o motivo, nunca preenche com dado fabricado.
- **Zero previsão** — só descreve trades já fechados do próprio usuário, não
  estima nada sobre o próximo trade.

`__validate__.ts` cobre a parte pura (13 asserções, entrou em
`npm run validate`, agora com 5 suítes). A parte de rede (busca de candle
real) não tem teste automatizado, mesma exceção do resto da suíte (depende de
rede/conta MetaAPI compartilhada).

`npm run validate` rodou **tudo verde** (type-check + 5 suítes) depois da
mudança.

**O que ainda falta**: nenhuma tela/UI chama `diagnoseClosedTrades` ainda —
existe só como módulo de serviço. Próximo passo natural seria uma tela/painel
que rode isso sobre o `orderHistory` do usuário e mostre o agregado
(`averageExitEfficiency`, `averageGaveBackPercent`) — decisão de produto em
aberto, não tomada nesta sessão.

---

## O que está no working tree (checar `git status` antes de commitar)

Duas origens diferentes, não misturar sem entender:

1. **Desta sessão** (novo, pronto pra commit):
   - `src/app/services/analysis/TradeEfficiencyDiagnostic.ts` (novo)
   - `src/app/services/analysis/__validate__.ts` (novo)
   - `scripts/validate.mjs` (adiciona a 5ª suíte)
   - `CLAUDE.md` (pendência #5 atualizada com o achado da auditoria + detalhe
     do Componente 5)
   - `NEXT_SESSION.md` (este arquivo)

2. **Órfã de uma sessão anterior do mesmo dia** (origem verificada agora,
   ver abaixo — decidir separadamente se commita):
   - `src/app/services/strategy/BacktestEngine.ts` +
     `src/app/services/strategy/__validate__.ts` — adicionam `mfePercent`/
     `maePercent` ao `Trade` do **motor de backtest** (não é o mesmo código
     do item 1 acima, que é sobre trades REAIS do usuário; este é sobre
     trades SIMULADOS em backtest). Preparação pro §4.6 do
     `research/MASTER_PLAN.md` (teste de skew de MFE/MAE por arquétipo).
     `npm run validate` já cobre essas 2 novas asserções (rodou junto, sem
     falha) — dá pra commitar com segurança se o Cleber quiser.
   - `research/experiments/2026-07-30-fase2-remediation/` (untracked) —
     script de remedição dos 5 presets com o motor corrigido (Fase 2 do
     `MASTER_PLAN.md`), com cache em disco de candle (pasta `candle-cache/`
     vazia — nenhuma rodada completou ainda, é trabalho **incompleto**, não
     rode sem saber que leva horas por causa do rate-limit da conta MetaAPI
     compartilhada, ver comentários no próprio script). **Não gerado nesta
     sessão nem na anterior** — provavelmente de uma sessão ainda mais antiga
     do mesmo dia (16h30 ou 19h40, ver seção de sessões anteriores no
     histórico). Se o Cleber quiser retomar essa investigação, é só rodar o
     script; se não, considerar descartar (decisão dele, não tomada aqui).

---

## Próximo passo sugerido (não decidido, sugestão)

(a) Implementar o fix do Componente 4 (ligar kill-switch/health-check a
`closeAllPositions()` em modo LIVE, com tratamento de falha da chamada); ou
(b) construir uma tela/painel que use `diagnoseClosedTrades` (Componente 5)
sobre o histórico real do usuário; ou (c) decidir o tratamento do
`Marketplace.tsx:30` (pendência #6, ainda aberta, ver abaixo).

---

## Pendências reais em aberto (herdadas, sem mudança nesta sessão)

1. ~~Working tree suja, origem não verificada~~ — **verificada nesta sessão**,
   ver seção "O que está no working tree" acima.
2. **`Marketplace.tsx:30`** — "Neural Scalper Pro, 87% win rate nos últimos 3
   meses" (R$299,90), hardcoded, anunciando o pior arquétipo já medido
   (Sharpe pooled -3,36). Cleber informado, não decidiu tratamento. Sob a
   decisão (B), fica ainda mais urgente: produto sem edge não pode exibir
   acurácia.
3. **Força Relativa cross-sectional como 6º arquétipo** — conflita com a
   decisão (B), não decidido.
4. **3 roadmaps antigos não deletados** —
   `ROADMAP-INVESTIDORES-NEURAL-DAY-TRADER.md`, `ROADMAP_SIMULADOR.md`,
   `ROADMAP_AI_TRADING_DEMO.md`.
5. **`LiquidityPrediction.tsx`** ainda não religado ao `backtestDataService`
   real.
6. **Perna short dos arquétipos 1, 2, 4** — adiada por decisão explícita.
7. **NOVO (2026-07-30, esta sessão): fix do Componente 4** — ver seção
   "Próximo passo sugerido" acima.

---

## Lembretes fixos

- **Comunicação sempre em português do Brasil**
- **Nunca `git commit`/`git push` sozinho** — entregar comandos prontos pro Cleber
- **Nunca fabricar dado** — erro explícito quando não há fonte real
- **`npm run validate` obrigatório** antes de qualquer commit que toque o motor
- **Todo experimento salva output em arquivo**, nunca só em prosa
- **Ler `CLAUDE.md` inteiro antes de tocar no motor de decisão**;
  `AI_BRAIN_SPEC.md` é o histórico de pesquisa detalhado
- **Rigor de especialista + honestidade radical, permanente** — nunca inflar
  número, nunca esconder achado negativo, sempre reportar o dado que sustenta
  (ou a ausência dele, declarada)
