# Sessão 2026-09-11 — Saldo LIVE oscilando, região MetaAPI NY, comissão real e Tesouraria Global

## Contexto

Cleber conectou a conta real (LIVE) no MetaTrader (login `87026945`,
`InfinoxLimited-MT5Live`, conta MetaAPI `bb99f865-96fb-4573-98a7-1f32895f84f7`
— a mesma conta compartilhada que serve o streaming de preço de toda a
plataforma) e relatou uma cadeia de sintomas: saldo não aparecia, depois
apareceu mas ficou oscilando entre o valor real e o $100 do DEMO, e por fim
uma tela ("AI Trader") mostrando saldo desatualizado numa URL de deployment
com hash (armadilha já documentada no `CLAUDE.md`). No meio da sessão, Cleber
também pediu que todo usuário passe a pagar comissão real, computada e
gerenciada pelo sistema, visível na Tesouraria Global do admin — que ele
suspeitava (corretamente) estar com dados mocados.

## 1. Saldo LIVE "não aparece" — causa real: MetaAPI degradada no momento

Investigação ao vivo (logs do Supabase, `query_logs`) confirmou que, no
momento em que Cleber conectou, a MetaAPI (conta compartilhada) estava com
degradação real e ampla: dezenas de erros HTTP 504 ("Ticker failed") em
quase todos os símbolos, e a própria chamada de saldo (`getAccountInfo`)
levou 8s pra responder — perto do timeout de 15s do `liveExecution.ts`. Uma
chamada de diagnóstico própria (`_diag_check_live_account.ts`) chegou a
estourar esse timeout e acionar o circuit breaker de segurança.

**Não foi bug de código** — a conexão em si funcionou (`broker_credentials`
confirmado gravado, `deployed=true`). O código que busca e exibe o saldo
(`useApexLogic.ts`) já preserva o último valor conhecido em vez de mostrar
erro quando a chamada falha — o que explica por que "não aparecia": ficava
preso no último valor (DEMO) enquanto a MetaAPI estava lenta.

## 2. Região MetaAPI: Nova Iorque

Cleber informou que a conta ganhou uma réplica na região `new-york` da
MetaAPI (mesma conta, mesmo token, mesmos dados — só muda o endpoint
regional). Achado real: `getMetaApiClientApiBase`/
`getMetaApiMarketDataApiBase` (`supabase/functions/server/index.ts`) sempre
preferiam o campo `region` primário da conta (hoje `london`, a mesma região
já associada aos incidentes de stale/rate-limit documentados neste projeto)
e praticamente ignoravam o array `regions[]`.

**Fix**: as duas funções agora preferem `new-york` sempre que presente em
`regions[]`, antes de cair no `region` primário ou no fallback antigo.
Commit entregue, aguardando `supabase functions deploy server`.

## 3. Saldo LIVE oscilando entre real e DEMO — 2 causas reais em cadeia

### 3a. `getBrokerCredentialsStatus()` mascarava erro transitório como "desconectado"

`BrokerClient.ts:getBrokerCredentialsStatus()` engolia qualquer falha de
rede/timeout e devolvia `{configured: false}` — indistinguível de "nunca
conectou". Os dois lugares que checam isso continuamente
(`useApexLogic.ts` reconcile a cada 20s, `TradingContext.tsx` checkConnected
a cada 10s) já tinham lógica pronta pra "manter o último estado numa falha
transitória", mas ela nunca disparava porque o erro nunca chegava até eles
disfarçado de sucesso. Cada poll que batesse numa instabilidade (que sabemos
que estava acontecendo, ver seção 1) derrubava a flag de "conectado" por um
ciclo, fazendo o Dashboard cair pro cálculo de saldo simulado (DEMO).

**Fix**: removido o `try/catch` que mascarava — o erro agora propaga e os
dois chamadores usam a proteção que já existia. Commit `0d293cc3f`.

### 3b. Hidratação de mount sobrescrevia saldo LIVE com saldo DEMO (causa mais grave)

Achado mais sério: o efeito de hidratação de mount em `useApexLogic.ts`
(carrega saldo da última sessão DEMO encerrada, ou recalcula de `ai_trades`)
tinha um guard morto — `executionMode !== 'DEMO'`, campo que o client nunca
mais seta pra `'LIVE'` desde que a execução real virou dinâmica (confirmado
no próprio comentário de `TradingContext.tsx`). Esse efeito, portanto,
SEMPRE roda, mesmo com corretora real conectada, e é assíncrono (várias
chamadas em sequência) — podendo terminar DEPOIS do primeiro ciclo do
`reconcile()` de 5s já ter carregado o saldo real da MetaAPI, sobrescrevendo
de volta pro valor DEMO. Isso explica tanto "abre no saldo demo" quanto a
oscilação (dependia de qual das duas terminava primeiro a cada carregamento
de página).

**Fix**: checa `getBrokerCredentialsStatus()` uma vez no início do efeito e
pula as 3 escritas de balance/equity dessa hidratação quando há corretora
real conectada. Commit `3c6dcb7d5`, já pushado pro `origin/dev`.

### Achado de processo: nunca testar em URL de deployment com hash

Cleber estava testando em
`neural-day-trader-v2-**dd0v009xl**-cleber-coutos-projects.vercel.app` — uma
URL de deployment congelada, que nunca pega push nenhum (armadilha já
documentada no `CLAUDE.md`, reincidência). O fix real só aparece na URL do
alias `dev`:
`neural-day-trader-v2-git-dev-cleber-coutos-projects.vercel.app`.

Também confirmado por leitura de código (não só suposição): Dashboard, AI
Trader e o card "Poder de Compra" leem exatamente a mesma variável
(`portfolio.equity`/`.balance` de `useTradingContext()`, uma única instância
de `ApexTradingProvider` pra todo o app, `App.tsx`) — não existe estado
separado entre as telas. A divergência reportada ("Dashboard atualizado, AI
Trader não") só é possível pela mesma corrida da seção 3b, e desaparece com
o fix + reload na URL certa.

## 4. Comissão real por trade + Tesouraria Global corrigida

### Auditoria (pedida explicitamente pelo Cleber)

Tesouraria Global (`FinanceModule.tsx`, menu "Tesouraria Global" do admin)
estava quase 100% fabricada:

| Seção | Fonte | Status antes |
|---|---|---|
| "Comissões da Casa (AI)" | `houseStats` | Sempre `$0.00` — a variável nunca era calculada em lugar nenhum do código, só inicializada e resetada em zero. |
| "Vendas Premium" | `useFinanceStore` | Real, mas só em `localStorage` do navegador, sem gateway de pagamento real. |
| Gráfico de fluxo de caixa, YTD, despesas, cash runway, provisão fiscal, 3 contas bancárias, obrigações fiscais | arrays/strings hardcoded no componente | 100% inventado. |

Confirmado via SQL: 281 de 292 trades fechados nos últimos 10 dias com
`commission: 0` — hardcoded em 4 pontos de `neuralBridge.ts`. O fix
equivalente de 2026-08-24 só tinha sido aplicado no motor mecânico antigo
(`ai-runner`), desligado desde 2026-08-31 quando o LLM Active Brain virou
motor único — nunca foi portado pro motor atual.

### Modelo aprovado pelo Cleber

Markup de execução por lote (round-trip spread+slippage+comissão), **por
ativo**, respeitando o que o mercado pratica de verdade — não um número
genérico. Vale pro DEMO/simulado nesta rodada; cobrança real em LIVE
(dinheiro de verdade) fica fora do escopo, por decisão explícita, até haver
um mecanismo de coleta.

### Implementação

- **`llm-active-brain/src/commissionModel.ts`** (novo): reaproveita
  `research/CostModel.ts` (já calibrado por classe de ativo — forex major,
  commodity, índice, cripto — contra pesquisa real de corretoras
  concorrentes da Infinox) e `TradeSizing.ts:getPointValue`, via import
  relativo direto (cadeia sem `@/` alias nem React, verificada limpa antes
  de puxar). Classificação de ativo mapeada manualmente contra a composição
  real de `MT5_ASSET_BASKET` (27 símbolos), não catálogo (evita puxar mais
  uma dependência transitiva só por isso). Testado isoladamente: EURUSD
  $10k→$1,21; XAUUSD $500→$0,039; BTCUSD $100→$0,029 (bate com
  `CRYPTO_CFD_ROUND_TRIP_COST_PERCENT`); NAS100 $1k→$0,31.
- **`neuralBridge.ts`**: `closeMt5Position` e `realizePartialProfit` agora
  calculam `commission` de verdade e gravam `net_pnl = pnl - commission`
  (antes `net_pnl = pnl`, comissão sempre 0).
- **`llm-active-brain/tsconfig.json`**: `noEmit`+`allowImportingTsExtensions`
  adicionados — necessário pro import cross-diretório com extensão `.ts`
  explícita não reprovar `tsc --noEmit` (TS5097); `tsx` (runtime real deste
  projeto) já resolvia sem problema, confirmado antes do fix.
- **Rota nova `/admin/commission-summary`** (`supabase/functions/server/
  index.ts`, protegida por `requireAdmin`): agrega `ai_trades.commission`
  real de todos os usuários (service role, nunca RLS de usuário comum),
  separando DEMO (`broker_position_id IS NULL`) de LIVE
  (`broker_position_id` preenchido = execução confirmada na MetaAPI).
- **`FinanceModule.tsx`**: card "Comissões da Casa" trocado de fabricado
  pra real (DEMO); card novo "Comissões da Casa (LIVE)" mostra número real
  mas honestamente zerado, com nota explícita de que a cobrança ainda não
  existe; todo o resto da tela (contas bancárias, impostos, YTD, fluxo de
  caixa) marcado com um banner explícito "dados de exemplo (mock)" em vez de
  continuar se passando por real silenciosamente.

`tsc --noEmit` limpo em tudo (raiz + `llm-active-brain`).

### Pendente

- `git commit` (2 commits prontos, comandos entregues ao Cleber — regra fixa
  do projeto, nunca commito sozinho): um pro fix de saldo LIVE/região
  MetaAPI, outro pra comissão real + Tesouraria Global.
- `supabase functions deploy server` (região NY + rota de comissão).
- `./restart.sh` dentro de `llm-active-brain/` (comissão real só passa a
  gravar depois do restart).
- Reconstruir o resto da Tesouraria Global (contas bancárias, impostos,
  fluxo de caixa, YTD) com dado real — trabalho separado, fora desta rodada.
- Decidir mecanismo de cobrança de comissão real em LIVE (dinheiro de
  verdade) — maior decisão de produto, não veio nesta rodada.
