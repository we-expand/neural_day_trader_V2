# Handoff — próxima sessão

> **Pedido do Cleber (2026-08-31, fim da sessão anterior): preparar a
> próxima sessão pra seguir direto pra Fase 3.** Importante: Fase 3 é LIVE
> (credencial de corretora por usuário, execução real) — a Fase 2 (base
> multi-tenant em DEMO) está implementada mas **NÃO validada** ainda: falta
> o commit (comando abaixo), falta o teste real com 2+ sessões em paralelo
> (item 7), e a decisão de config por sessão (item 6) ficou em aberto. Regra
> fixa do projeto: nunca prometer edge/estabilidade sem validação real. A
> ordem abaixo é: (A) fechar o que falta da Fase 2 primeiro — é rápido e é a
> única forma de saber se o multi-tenant não vaza posição entre sessões
> antes de destravar dinheiro/corretora real na Fase 3 — depois (B) Fase 3
> propriamente dita. Não pular direto pra B sem fechar A; se o Cleber quiser
> pular mesmo assim, é decisão dele a confirmar no início da próxima sessão,
> não default automático.

> Reescrito em **2026-08-31** (sessão de implementação da Fase 2 — este
> arquivo é handoff da sessão CORRENTE, sempre reescrito, nunca empilhado).
> Itens de pesquisa de sessões anteriores (Trilho 2/NIM/cuOpt, cron/
> Pyramiding etc.) não foram tocados nem abandonados — continuam rastreados
> na seção "Pendências reais em aberto" do [CLAUDE.md](CLAUDE.md).

## ▶ COMECE AQUI — Fase 2: Cérebro LLM Ativo multi-tenant em DEMO

### O que esta sessão fez (código pronto, NENHUM commit feito — Cleber roda os comandos abaixo)

`tsc --noEmit` limpo (`llm-active-brain/`, `strict: true`). Sem `npm run
validate` — este subprojeto não faz parte do workspace principal, não tem
esse script.

1. **Item 1 confirmado com SQL direto no Supabase** (`wyvdsxtcmizettljxtbg`):
   o cron do `ai-runner` (motor mecânico) **existe de fato e está ATIVO**
   (`jobid=5`, `* * * * *`). Não desligar sem decisão explícita — o motor
   mecânico continua operando de verdade em produção.

2. **Item 2 (trava de PID) — decisão DIFERENTE da proposta original do
   handoff, com justificativa**: a trava de instância única por PID em
   [index.ts](llm-active-brain/src/index.ts) foi **mantida**, não removida.
   Motivo: ela protege contra corrupção do `ledger/actions.json`, que
   continua sendo 1 arquivo por PROCESSO (não por sessão) — esse risco não
   mudou com o multi-tenant. O que garante que a mesma sessão nunca é
   processada 2x ao mesmo tempo é o loop ser **serial** (não paralelo) sobre
   as sessões elegíveis a cada ciclo — não precisa de lock adicional por
   sessão enquanto isso for verdade. Se algum dia o loop virar paralelo
   (item 4 do handoff anterior cogitava isso "se precisar de paralelismo
   limitado"), aí sim precisa de lock por `session_id`.

3. **Item 3 (singleton de sessão → parâmetro explícito) — feito em
   `neuralBridge.ts`.** `mt5SessionIdPromise` (singleton por processo) virou
   `mt5SessionIdCacheByUser` (`Map<userId, Promise<sessionId>>`, cache por
   usuário, evita re-query a cada ciclo). `getOrCreateMt5Session(userId,
   symbols)` agora exportada e recebe `userId` explícito (antes lia
   `config.neuralUserId` global). TODAS as funções do trilho MT5
   (`openMt5Position`, `listMt5OpenPositions`, `getMt5AccountBalance`,
   `getRecentClosedTrades`, `getClosedTradesForMemory`,
   `enforceMt5StopsAndTargets`) agora recebem `sessionId` como parâmetro em
   vez de resolver o singleton internamente.
   - **Decisão que NÃO foi tomada** (deliberadamente, é a mesma pendência já
     flagada no handoff anterior): sessões continuam sendo criadas com
     `status: "PAUSED"` (hack pra ficar fora do alcance do
     `getActiveSession()` do motor mecânico, que segue ativo — ver item 1).
     Não mudar isso sem decisão explícita do Cleber.

4. **Item 4 (loop varrendo sessões elegíveis) — feito em `index.ts`.** Nova
   `listEligibleMt5Sessions()` em `neuralBridge.ts` (query
   `ai_sessions` por `strategy_name='LLM_ACTIVE_BRAIN_MT5' AND
   status='PAUSED'`). `resolveMt5Sessions()` em `index.ts` usa essa lista; se
   vier vazia (primeira execução), cria a sessão bootstrap a partir de
   `NEURAL_USER_ID`/env — preserva o comportamento de hoje (1 sessão) como
   caso particular de N=1, sem quebrar o deploy atual. `runContinuous` agora,
   em modo MT5, itera **serialmente** sobre as sessões resolvidas a cada
   ciclo, chamando `runAgent(cycle, session)` pra cada uma — uma sessão
   falhando não aborta as demais do mesmo ciclo (try/catch por sessão).

5. **Item 5 (threading pelos guardrails) — feito.** Além do `neuralBridge.ts`
   acima:
   - **Achado que o handoff anterior NÃO tinha mapeado**: `tools.ts` tinha 3
     `Map`s no nível de módulo (`lastQuotedCycleBySymbol`,
     `lastQuoteSnapshotBySymbol`, `flipAttemptBlockedThisCycle`) —
     guardrails reais (cotação fresca no ciclo, contradição semântica,
     circuito de flip-attempt) que eram implicitamente "1 processo = 1
     sessão". Convertidos pra `Map<sessionId, Map<K,V>>` via helper
     `perSession()`; `executeTool` agora recebe um 4º parâmetro
     `session: ExecuteToolSession` (`{sessionId, userId}`) e resolve os 3
     mapas por sessão no início da função.
   - `tradeMemory.ts`: `cache` (memória de trades, também module-level
     singleton) virou `cacheBySession` (`Map<sessionId, {...}>`).
     `getTradeMemoryBlock(sessionId)` e `getClosedTradesForMemory(sessionId,
     limit)` agora exigem `sessionId`.
   - `agent.ts`: `runAgent(cycle, mt5Session?)` — `mt5Session` obrigatório
     quando `config.mt5TradingEnabled` (lança erro explícito se ausente, sem
     fallback silencioso). `enforceMt5StopsAndTargets`,
     `getTradeMemoryBlock`, `executeTool` todos recebem a sessão agora.

6. **Item 6 (config por sessão) — DELIBERADAMENTE NÃO FEITO**, conforme a
   própria instrução do handoff anterior de não over-engenheirar se o
   Cleber não pedir. Risco (`mt5RiskPctPerTrade` etc.) continua
   processo-wide via env, igual pra todas as sessões DEMO.

### O que falta (em ordem)

1. **Cleber rodar os comandos de commit** (nenhum arquivo commitado ainda —
   ver seção final). `tsc --noEmit` já confirmado limpo por Claude.
2. **`reasoningValidator.ts` checado** (grep por `const`/`let` de nível de
   módulo): sem estado global, não precisa de threading — confirmado, não
   suposição.
3. **Item 7 do handoff anterior (teste com 2+ sessões reais em paralelo)
   ainda não foi feito.** Precisa: criar uma 2ª `ai_sessions` de teste real
   (via SQL ou rodando o processo com um 2º `NEURAL_USER_ID` de teste),
   rodar o processo, e confirmar ao vivo (log + Supabase, nunca suposição)
   que (a) nenhuma sessão vaza posição/exposição pra outra, (b) teto de
   grupo correlacionado é por sessão, (c) nenhuma race duplica ordem.
4. Fora de escopo continua o mesmo da Fase 2 original (LIVE, deploy como
   serviço real, gates que faltam, migração do motor mecânico) — ver
   handoff completo em
   [SESSAO_2026-08-31_RELIGAMENTO_LLM_BRAIN_MOTOR_PRINCIPAL.md](SESSAO_2026-08-31_RELIGAMENTO_LLM_BRAIN_MOTOR_PRINCIPAL.md).

### Comandos prontos pro Cleber rodar

```bash
cd llm-active-brain
npx tsc --noEmit   # já confirmado limpo por Claude, reconfirmar se quiser
cd ..
git add llm-active-brain/src/agent.ts llm-active-brain/src/index.ts llm-active-brain/src/neuralBridge.ts llm-active-brain/src/tools.ts llm-active-brain/src/tradeMemory.ts
git commit -m "feat(llm-active-brain): Fase 2 multi-tenant (base) — sessão explícita em vez de singleton por processo

Threading de sessionId/userId por neuralBridge.ts/tools.ts/tradeMemory.ts/agent.ts/index.ts.
Loop principal agora varre todas as ai_sessions elegíveis (strategy_name=LLM_ACTIVE_BRAIN_MT5,
status=PAUSED) e processa serialmente. Trava de PID único mantida (protege ledger.json por
processo, não por sessão). Config por sessão (item 6) e teste com 2+ sessões reais (item 7)
ainda pendentes — ver NEXT_SESSION.md."
```

## ▶ DEPOIS — Fase 3 (LIVE: corretora real por usuário)

Não iniciar sem antes fechar os itens 6/7 acima da Fase 2 (ou sem
confirmação explícita do Cleber pra pular). Fase 3 = a sessão do
llm-active-brain deixa de operar só DEMO simulado e passa a poder executar
contra uma corretora real, por usuário. Nada disso existe hoje no
llm-active-brain — `ai_sessions.mode` é hardcoded `"DEMO"`
(`neuralBridge.ts`), não há nenhuma leitura de credencial de corretora por
usuário no trilho MT5 (isso já existe no motor mecânico, via
`broker_credentials` criptografado — ver seção "Arquitetura" do
[CLAUDE.md](CLAUDE.md) — mas o llm-active-brain nunca usou esse caminho).

O que precisa ser levantado/decidido (não investigado ainda nesta sessão,
listar aqui pra não perder o fio):

1. **De onde vem a credencial MT5 real por usuário.** O motor mecânico já
   tem o padrão (`broker_credentials`, nunca no client, só a Edge Function
   acessa) — decidir se o llm-active-brain (processo Node fora do
   Supabase) reusa essa tabela ou precisa de um caminho próprio. Risco de
   segurança real se copiado errado (token de corretora exposto).
2. **`ai_sessions.mode` deixa de ser sempre `"DEMO"`** — como a sessão
   sinaliza LIVE, e o que muda no fluxo de `openMt5Position`/
   `closeMt5Position` quando é LIVE (hoje ambos são só `INSERT`/`UPDATE`
   direto em `ai_trades`, sem nenhuma chamada real de execução -- LIVE
   precisa de fato mandar a ordem pra corretora, não só registrar).
3. **Cada guardrail da Fase 2 precisa ser reavaliado com dinheiro real em
   jogo** — teto de exposição, cooldown, validador de contradição, todos
   foram calibrados/testados só em DEMO. Não presumir que os mesmos
   números/tetos servem pra LIVE sem decisão explícita do Cleber.
4. Gates que faltam vs. o motor mecânico (notícias/VIX, Safe Mode, Jarvis,
   scorecard de ativos) — a Fase 2 original já flagava isso como decisão de
   risco pendente antes de qualquer LIVE, continua valendo aqui.
5. Migração seria só relevante quando o motor mecânico for de fato
   desligado — depende do item 1 confirmado nesta sessão (cron ativo).

### Regra fixa que continua valendo

Claude nunca commita/faz push sozinho, migrations do Supabase nunca são
aplicadas por Claude (só o SQL pronto), `npm run validate` antes de
qualquer commit que toque o motor mecânico principal (não se aplica a este
subprojeto, que não tem esse script). Nenhum dado (preço, resultado de
teste) pode ser fabricado — se o item 7 não puder ser validado com dado
real ainda, declarar isso explicitamente em vez de inflar confiança (não
foi validado nesta sessão). Fase 3 mexe com corretora/dinheiro real por
usuário — padrão de rigor mais alto que qualquer item da Fase 2, nenhuma
decisão de segurança/credencial deve ser tomada sem confirmação explícita
do Cleber.
