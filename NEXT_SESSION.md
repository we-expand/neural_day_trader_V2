# Handoff — próxima sessão

> Reescrito em **2026-08-31** (sessão de religamento do LLM Brain como motor
> único — este arquivo é handoff da sessão CORRENTE, sempre reescrito, nunca
> empilhado). **Commit já feito** (`09ba45256`/`20c2f2a5e`, working tree
> limpo) — nada pendente de código nesta frente. Detalhe completo desta
> sessão: [SESSAO_2026-08-31_RELIGAMENTO_LLM_BRAIN_MOTOR_UNICO.md](SESSAO_2026-08-31_RELIGAMENTO_LLM_BRAIN_MOTOR_UNICO.md).

## ▶ COMECE AQUI

**LLM Brain é o motor único da plataforma — motor mecânico desligado
definitivamente (cron `ai-runner-tick` desativado no Supabase).** Sessão
ativa: `faff526b-7cf8-4f94-b885-8afd36ab77e2`, $100, `status=RUNNING`.
Dashboard/AI Trader/Gráfico/Header já mostram ela automaticamente (via
`getActiveSession()`, sem filtro de `strategy_name`). Processo rodando
local via `tsx` (1 único, confirmado — usar `llm-active-brain/restart.sh`
pra reiniciar se precisar, o bug de PID duplicado que existia nele foi
corrigido nesta sessão).

### Estado técnico confirmado ao fim da sessão anterior

- Código commitado, nada pendente de commit/deploy adicional.
- Secret `METAAPI_TOKEN` + deploy da função `server` já aplicados.
- `tsc --noEmit` limpo em `llm-active-brain/` e no app principal (2 erros
  em `AITrader.tsx` são pré-existentes, não relacionados a esta sessão).

### Pendências reais (nenhuma bloqueante, ordem sugerida)

1. **Degradação de qualidade do modelo LLM** — texto corrompido/alucinado
   observado ao vivo no log (`nvidia/nemotron-3-nano-30b-a3b`,
   `LLM_PROVIDER=nvidia`). Não é bug de código — é qualidade do modelo.
   Se for investigar: `OMNIROUTE` já está parcialmente configurado em
   `llm-active-brain/src/config.ts` como opção de provedor alternativo
   (não testado em produção ainda).
2. **Cesta efetiva do Cleber ficou em 1 ativo só (`BTCUSD`)** — a seleção
   dele no Setup do AI Trader (`activeAssets`) é majoritariamente forex/
   índice, sem equivalente na cesta cripto do LLM Brain (9 ativos: BTCUSD,
   XETUSD, DOGUSD, DOTUSD, XRPUSD, BTCXBN, ADAUSD, LNKUSD, UNIUSD). Avisado
   ao Cleber — se ele quiser mais frequência de operação, é ele quem decide
   ampliar a seleção no Setup, não é bug a corrigir sozinho.
3. **`MT5_STOP_MAX_PCT` afrouxado temporariamente** (`llm-active-brain/.env`,
   0.02→0.035, gitignored — não versionado) a pedido do Cleber pra testar
   frequência de operação. Reverter pra `0.02` quando o teste acabar, ou
   perguntar se ele quer manter.
4. **`AssetUniverse`** (picker do Setup) não avisa visualmente quando a
   seleção do usuário não tem equivalente na cesta real do motor ativo —
   melhoria de UX possível, não crítica.
5. **`config.allocatedCapital`** ainda existe como estado (não editável na
   UI mais, card virou informativo) e ainda é passado como prop pro
   `AssetUniverse` (`AITrader.tsx`) — não verificado se esse componente
   quebra ou só exibe número estático desatualizado. Checar se for mexer
   nesse componente de novo.
6. Itens de pesquisa histórica (Trilho 2/NIM/cuOpt, Parceiros IB B4,
   probabilidade calibrada, etc.) — nenhum tocado nesta sessão, continuam
   rastreados na seção "Pendências reais em aberto" do
   [CLAUDE.md](CLAUDE.md).

### Regra fixa que continua valendo

Claude nunca commita/faz push sozinho — só entrega comando pronto (usado
nesta sessão: Cleber confirmou e rodou o `git add -A && git commit`
sugerido). Migrations do Supabase nunca são aplicadas por Claude (só SQL
pronto), mas `execute_sql`/`cron.alter_job` diretos via MCP, quando o
Cleber confirma explicitamente a ação (ex: "desligar definitivamente"), são
aceitáveis e já foram usados nesta sessão. Nenhum dado financeiro é
corrigido com `UPDATE` silencioso — sempre `correction_reason`/valores
derivados de soma real (ver seção 6 do handoff completo, encerramento da
sessão de $50).
