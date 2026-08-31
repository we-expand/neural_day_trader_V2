# Handoff — próxima sessão

> Reescrito em **2026-08-31** (linha de trabalho trocada — este arquivo é
> handoff da sessão CORRENTE, sempre reescrito, nunca empilhado). Itens de
> pesquisa de sessões anteriores (Trilho 2/NIM/cuOpt, cron/Pyramiding etc.)
> não foram tocados nem abandonados — continuam rastreados na seção
> "Pendências reais em aberto" do [CLAUDE.md](CLAUDE.md). A partir de agora
> a prioridade nº1 do projeto é a migração abaixo; não iniciar outra linha
> sem checar com o Cleber primeiro.

## ▶ COMECE AQUI — Fase 2: Cérebro LLM Ativo multi-tenant em DEMO

### Contexto (não repetir a exploração — já foi feita)

2026-08-31: decisão do Cleber — o **Cérebro LLM Ativo** (`llm-active-brain/`)
vira o motor de IA principal e único do produto; o motor mecânico
(`ai-runner`) fica descontinuado. Fase 1 (só rótulo/UX do Dashboard) já foi
aplicada — ver
[SESSAO_2026-08-31_RELIGAMENTO_LLM_BRAIN_MOTOR_PRINCIPAL.md](SESSAO_2026-08-31_RELIGAMENTO_LLM_BRAIN_MOTOR_PRINCIPAL.md)
pro levantamento completo (motor mecânico, llm-active-brain, Dashboard,
contrato de substituição). **Fase 2 = portar o llm-active-brain pra
multi-tenant, ainda só em DEMO, sem LIVE e sem deploy como serviço** — isso
fica pras Fases 3 e 4, não misturar escopo.

**Antes de escrever qualquer código, ler o handoff da Fase 1 inteiro** — ele
tem o contrato exato do motor mecânico (`TradingCycleState`/`Deps`/`Result`,
`runTradingCycle.ts:108-221`) e o inventário de guardrails do
llm-active-brain, não reproduzido aqui pra não duplicar.

### O que precisa mudar, em ordem

1. **Confirmar se o cron do `ai-runner` existe de fato em produção** antes
   de decidir como desligá-lo. Não achei `cron.schedule` aplicado nas
   migrations do repo (só um exemplo comentado em
   `supabase/functions/ai-runner/index.ts:895-913`) — pode ser suposição
   desatualizada do CLAUDE.md. Checar com `list_cron_jobs`/SQL direto no
   projeto Supabase (`wyvdsxtcmizettljxtbg`) antes de mexer.

2. **Remover a trava de instância única por PID**
   (`llm-active-brain/src/index.ts:19,35,43,46` — `LOCK_FILE`,
   `isProcessAlive`, mensagem de erro "Ja existe um processo..."). Ela
   existe pra impedir 2 processos concorrentes contra a MESMA conta MT5 —
   motivo ainda válido por conta, mas o modelo muda de "1 processo, 1
   conta" pra "1 processo, N contas/sessões", então a trava vira: nunca
   processar a MESMA sessão duas vezes ao mesmo tempo (lock por
   `session_id`, não por processo inteiro).

3. **Trocar o singleton de sessão por sessão explícita, passada como
   parâmetro.** Hoje `neuralBridge.ts:265-310`
   (`mt5SessionIdPromise`/`getOrCreateMt5Session`) memoriza UMA sessão por
   execução do processo, atrelada a `config.neuralUserId`
   (`config.ts:344`, um único `NEURAL_USER_ID` fixo em env). Isso precisa
   virar: o loop principal busca todas as `ai_sessions` elegíveis (ver
   item 4) e cada função de `neuralBridge.ts`/`tools.ts`/
   `reasoningValidator.ts`/`tradeMemory.ts` passa a receber `sessionId` (e
   `userId`) explicitamente em vez de ler o singleton.
   - Nota: as sessões do llm-active-brain hoje são criadas com
     `status: "PAUSED"` (`neuralBridge.ts:65-89`) **de propósito**, só pra
     escapar da busca de sessão ativa do motor mecânico antigo
     (`getActiveSession()`, sem filtro de `strategy_name`, pega a sessão
     `RUNNING` mais recente do usuário). Com o motor mecânico
     descontinuado, decidir se esse hack ainda é necessário ou se dá pra
     voltar a usar `status: "RUNNING"` normalmente + filtrar por
     `strategy_name = 'LLM_ACTIVE_BRAIN_MT5'` (mais limpo, mais parecido
     com o padrão que o `ai-runner` já usa pra sua própria query).

4. **Fazer o loop principal (`index.ts`/`agent.ts`) varrer todas as
   sessões elegíveis**, no padrão que `ai-runner/index.ts:796-800` já usa
   (`ai_sessions` com `status='RUNNING' AND mode='DEMO'`), processando-as
   **serialmente** (mesma razão documentada no `ai-runner`: a conta MetaAPI
   compartilhada não aguenta chamadas concorrentes — ver aviso em
   CLAUDE.md sobre rate-limit 429/504). Decidir cadência: o llm-active-brain
   hoje faz 1 ciclo completo (LLM + tool-calling) a cada ~10s
   (`config.ts` `cycleDelaySeconds`) — multiplicado por N sessões seriais,
   isso pode ficar lento; medir e ajustar se precisar de paralelismo
   limitado (nunca contra a MESMA conta MT5, mas pode haver >1 conta de
   teste eventualmente).

5. **Threadar `sessionId`/`userId` pelos guardrails existentes** —
   reaproveitar, não reescrever: teto de 1 posição/símbolo
   (`tools.ts:798,832`), teto de exposição por grupo correlacionado
   (`tools.ts:844-857,1113-1122` + `assetBasket.ts:139`), cooldown de
   perda em sequência (`tools.ts:859-891`), validador de contradição
   semântica (`reasoningValidator.ts`), stop/trailing mecânico
   (`neuralBridge.ts:629-751`). Todos hoje calculam exposição/posições via
   `listMt5OpenPositions()`/`getMt5AccountBalance()` escopados pro
   singleton — cada chamada precisa passar a sessão certa.

6. **Config por sessão, não só env global.** Risco (`mt5RiskPctPerTrade`,
   `mt5MaxNotionalUsd`, `mt5MaxCorrelatedNotionalUsd` etc., `config.ts:165-
   335`) é hoje processo-wide via env — avaliar se decisão de produto é
   manter 1 config global pra todas as sessões DEMO (mais simples, ok pra
   Fase 2) ou já puxar de `ai_user_config` (tabela que já existe desde
   2026-08-27 pra persistir config por usuário do motor mecânico) — **não
   over-engenheirar isso na Fase 2** se o Cleber não pedir; múltiplos
   usuários em DEMO com o MESMO perfil de risco é aceitável pra este passo.

7. **Plano de teste antes de aceitar a Fase 2 como pronta**: rodar 2+
   sessões DEMO reais em paralelo (contas/sessões de teste, nunca contra
   saldo real) e confirmar ao vivo — via log + Supabase, nunca suposição —
   que: (a) nenhuma sessão vaza posição/exposição pra outra, (b) o teto de
   grupo correlacionado é calculado por sessão, não somado entre sessões
   diferentes, (c) nenhuma race condition duplica ordem quando duas
   sessões decidem no mesmo ciclo.

### Fora de escopo da Fase 2 (fica pra Fase 3/4 — não misturar)

- LIVE (credencial de corretora por usuário, execução real) — hoje não
  existe nenhuma lógica LIVE no llm-active-brain (`ai_sessions.mode`
  hardcoded `"DEMO"` em `neuralBridge.ts:85,294`).
- Deploy como serviço de verdade (hoje é `nohup npm start` manual na
  máquina do Cleber, sem cron, sem Edge Function).
- Portar os gates que faltam vs. o motor mecânico (notícias/VIX, Safe
  Mode, Jarvis, scorecard de ativos) — decisão de risco a ser tomada
  depois que a Fase 2 estiver validada, não bloqueia a Fase 2 em si.
- Migração de posições abertas do motor mecânico antigo — só relevante
  quando o motor mecânico for de fato desligado (depende do item 1 acima).
- Remover os controles do motor mecânico em `AITrader.tsx` — só depois do
  motor novo validado ponta a ponta.

### Regra fixa que continua valendo

Claude nunca commita/faz push sozinho, migrations do Supabase nunca são
aplicadas por Claude (só o SQL pronto), `npm run validate` antes de
qualquer commit que toque o motor. Nenhum dado (preço, resultado de teste)
pode ser fabricado — se a Fase 2 não puder ser validada com dado real
ainda, declarar isso explicitamente em vez de inflar confiança.
