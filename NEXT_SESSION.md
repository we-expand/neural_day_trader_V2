# Handoff — próxima sessão (escrito em 2026-07-30, 01h00)

> **Fase 0 (remover dado fabricado)**: ✅ 100% completa.
> **Fase 1 (módulo de risco)**: ✅ 100% completa — 7 de 7 tópicos, incluindo
> uma correção real de segurança no Tópico 7 feita na mesma sessão em que
> foi implementado.
> `npm run validate`: 28/28 ✅. Dois commits feitos e pushados
> (`fde6eebd7`, `53e7626f8`). Deploy confirmado READY na Vercel (preview
> protegido, branch `dev` — ver seção de arquitetura de deploy abaixo).

---

## Fase 1 — os 7 tópicos, estado final

| # | Tópico | Status | Onde |
|---|--------|--------|------|
| 1 | Daily Loss Limit | ✅ | `RiskManager.validateTrade()` + gate em `useApexLogic.ts` |
| 2 | Drawdown Check | ✅ (já existia) | `useApexLogic.ts`, âncoras `INTRADAY_PEAK`/`DAILY_CLOSE` |
| 3 | Position Sizing por ATR | ✅ (já existia) | `useApexLogic.ts`, `positionSizingMode: 'ATR'` default |
| 4 | Cooldown entre Trades | ✅ (já existia) | `useApexLogic.ts`, `cooldownEnabled`/`cooldownMinutes` |
| 5 | Limite de Trades/Dia | ✅ (já existia) | `useApexLogic.ts`, `maxTradesPerDay` |
| 6 | Kill-Switch | ✅ (implementado nesta sessão) | `RiskManager.shouldActivateKillSwitch()` + `useApexLogic.ts` |
| 7 | Enforcement em `/broker/execute` | ✅ (implementado E corrigido nesta sessão) | `supabase/functions/server/index.ts` |

### Tópico 6 — Kill-Switch
- `RiskManager.ts`: `shouldActivateKillSwitch(account)` dispara se perda diária
  ou drawdown atingir `killSwitchThreshold` (config do usuário, default `0` =
  desativado no client).
- `useApexLogic.ts` (GATE DE RISCO): ao disparar, fecha TODAS as posições
  (`setActiveOrders([])`), para a IA (`setIsActive(false)`), ativa Safe Mode,
  notifica via toast persistente (`duration: 0`).

### Tópico 7 — Enforcement em `/broker/execute`, com correção real no meio

**Bug encontrado na primeira implementação**: a validação lia os thresholds
do body da requisição (`body.maxDailyLossPercent` etc). Ao auditar quem
realmente chama a rota, descobri que **nenhum caller real**
(`BrokerClient.ts` → `createMarketBuyOrder`/`createMarketSellOrder`) jamais
enviava esses campos — o gate SEMPRE caía nos defaults hardcoded (5%/15%/2%,
kill-switch desativado), ignorando por completo a config real do usuário.
Não era "confia no client" — era decorativo, sem efeito real.

**Correção aplicada na mesma sessão**:
- Novo endpoint `POST /server/risk-config` — autenticado por JWT, só escreve
  a config do próprio usuário logado, guardada no KV store
  (`kv_store_1dbacac6`, chave `risk-config:{userId}`).
- `loadServerRiskConfig(userId, currentBalance)`: lê a config do KV, reancora
  `dailyStartBalance` a cada novo dia UTC, mantém `peakEquity` (pico
  histórico de equity) pro cálculo de drawdown. Sem config salva, usa
  defaults conservadores (mais restritivos que o client, nunca mais
  permissivos — kill-switch vem ATIVO por padrão aqui).
- `/broker/execute`: thresholds vêm exclusivamente do KV (nunca do body);
  saldo vem exclusivamente da MetaAPI real (nunca do body).
- **Fail-closed**: se a busca de saldo na MetaAPI falhar, a rota agora
  **bloqueia** a ordem — antes deixava passar "com aviso". Mudança
  deliberada: numa rota que move dinheiro real, falha de infra não pode
  virar permissão implícita.
- `useApexLogic.ts`: novo `useEffect` sincroniza os thresholds do `aiConfig`
  com `/server/risk-config` sempre que o usuário muda a config, fire-and-forget.

**Limitação honesta que permanece (não bloqueante)**: o `peakEquity`/drawdown
calculado nessa rota só começa a refletir a realidade de mercado quando
algo chamar `/broker/execute` de fato. Hoje, `useApexLogic.ts` (motor
automático) **não chama essa rota** — a ponte decisão→execução real (Fase 3)
não existe. Só telas manuais (`LiveTradingTest.tsx`) chamam. O Tópico 7 está
correto e pronto, mas "adormecido" até a Fase 3 existir.

---

## Fase 2 (persistência) — auditoria e hardening (2026-07-30)

Handoff anterior dizia só "funciona — trades/sessões DEMO salvos no
Supabase". Auditoria confirmou isso no caso feliz (RLS correta com
`auth.uid() = user_id`, ciclo sessão→trade→snapshot→fim ligado a eventos
reais do motor, nenhum dado fabricado), mas achou lacunas reais, corrigidas
na mesma sessão:

- **Falha de escrita era silenciosa**: todo insert/update rejeitado (rede
  caiu, RLS recusou) só ia pro `console.error`, sem sinalizar nada ao
  usuário. Corrigido: `useAIPersistence.ts` agora aceita `onPersistenceError`
  e `useApexLogic.ts` mostra um toast de aviso (1x por sessão, evita flood
  do loop de 1s) quando isso acontece — a negociação continua normalmente,
  mas o usuário sabe que o histórico pode ficar incompleto.
- **Risco de sessão duplicada**: `startSession` não tinha trava contra
  chamada concorrente (ex. clique duplo) antes do primeiro `createSession`
  resolver. Corrigido com `isStartingSessionRef` em `useAIPersistence.ts`.
- **Migration duplicada/desatualizada**: `supabase-migrations/001_...sql`
  (fora do diretório oficial `supabase/migrations/`, sem policy de RLS de
  DELETE) marcada como `⚠️ DEPRECATED` no próprio arquivo — não confirmado
  contra o schema remoto (sem acesso à ferramenta MCP do Supabase nesta
  sessão), só reduzido o risco de alguém aplicar por engano seguindo um dos
  guias antigos (`*.md` na raiz) que ainda a referenciam.
- **Ainda pendente, não bloqueante**: zero teste automatizado cobre esse
  caminho (`npm run validate` não toca persistência Supabase);
  `pnl_percentage` usa fórmula aproximada (comentário próprio já admite).

`npm run validate`: 28/28 ✅ (não muda — esse gate não cobre este caminho).
`npx tsc --noEmit` limpo nos arquivos alterados. Sem regressão introduzida,
mas mudança não testada em browser real nesta sessão (precisa de conta MT5
demo ativa pra exercitar o loop completo).

---

## Fase 0 — resumo (sessão anterior, 2026-07-29 16h)

Removido `Math.random()` que apresentava números aleatórios como capacidade
real do sistema (latência, uptime, risco de cliente, correlação, sync com
broker). ~60 arquivos auditados 1 a 1; 9 componentes tratados (8 removidos,
6 desativados/reescritos — alguns arquivos tiveram as duas coisas em partes
diferentes). Ver `CLAUDE_HISTORY.md` ou o commit
`fix: remover dado fabricado (Math.random) da Fase 0 — auditoria completa`
pro detalhe completo por arquivo.

---

## Arquitetura de deploy (confirmado nesta sessão, não é bug)

A branch `main` serve deliberadamente uma **página de manutenção estática**,
não o app — decisão de uma sessão anterior (commit `d053074a3c69`) porque a
landing antiga tinha claims fabricadas (24.000+ nós, $1.2B volume, 99.99%
uptime etc.) com só 4 usuários reais e R$0 de receita. O app real roda na
branch `dev`, que gera **preview deployments protegidos por login Vercel**
(não públicos, não indexados). Ao verificar se um push "chegou", **nunca**
concluir que falhou só porque o domínio público não mudou — checar os
deployments da branch `dev` (projeto Vercel `neural-day-trader-v2`, time
`cleber-coutos-projects`) ou acessar a URL de preview logado.

---

## Estado atual do projeto

- **Fase 0**: ✅ 100% completa, sem pendências.
- **Fase 1**: ✅ 100% completa, 7/7 tópicos, Tópico 7 com hardening real aplicado.
- **Fase 2 (persistência)**: funciona — trades/sessões DEMO salvos no Supabase.
- **Fase 3 (execução real)**: não existe — ponte decisão→execução automática
  não implementada. Desenho já definido (4 estágios, ver `AI_BRAIN_SPEC.md`
  seção 9.1), aguardando decisão de avançar sem edge de sinal comprovado.
- **Cérebro de IA**: nenhum dos 5 presets testados passou 95% DSR; Trilho 2
  (busca de edge) formalmente pausado; produto foca 100% no pilar de
  execução/gestão de risco.

---

## Próximos passos recomendados

1. **Ponte decisão→execução real (Fase 3)** — é o item que mais desbloqueia
   valor agora: sem ela, o módulo de risco inteiro (Fase 1, pronto) fica sem
   uso real em produção. Decisão em aberto: vale avançar sem edge de sinal
   comprovado (produto vende disciplina de execução, não previsão)?
2. **Limpeza de código morto** (não bloqueante): pipelines de preço
   obsoletas (`DataSourceRouter`, `UnifiedMarketDataService` etc.);
   `node_modules` historicamente versionado (`.git` inchado, `git gc` opcional).
3. Reavaliar quando fizer sentido tirar `main` do modo manutenção e voltar
   o produto ao ar publicamente (depende do Cleber, não é decisão técnica).

---

## Lembretes fixos

- **Comunicação sempre em português do Brasil**
- **Nunca `git commit`/`git push` sozinho** — entregar comandos prontos pro Cleber
- **Nunca fabricar dado** — erro explícito quando não há fonte real
- **`npm run validate` obrigatório** antes de qualquer commit que toque o motor de decisão
- **Rigor de especialista + honestidade radical** — reportar achado negativo sempre, nunca inflar resultado
- **`main` = manutenção deliberada, `dev` = app real (preview protegido)** — não confundir "não deployou" com "não é público"
