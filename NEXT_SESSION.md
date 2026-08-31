# Handoff — próxima sessão

> Reescrito em **2026-08-31** (sessão de religamento do LLM Brain como motor
> único — este arquivo é handoff da sessão CORRENTE, sempre reescrito, nunca
> empilhado). Handoff anterior (Fase 2 multi-tenant, commit pendente
> `git commit` que não foi rodado) foi **absorvido** por esta sessão — os
> comandos de commit abaixo já incluem tudo. Detalhe completo desta sessão:
> [SESSAO_2026-08-31_RELIGAMENTO_LLM_BRAIN_MOTOR_UNICO.md](SESSAO_2026-08-31_RELIGAMENTO_LLM_BRAIN_MOTOR_UNICO.md).

## ▶ COMECE AQUI

**LLM Brain é o motor único da plataforma agora — motor mecânico desligado
definitivamente (cron `ai-runner-tick` desativado).** Sessão ativa:
`faff526b-7cf8-4f94-b885-8afd36ab77e2`, $100, `status=RUNNING`. Dashboard/AI
Trader/Gráfico/Header já mostram ela automaticamente (via
`getActiveSession()`, sem filtro de `strategy_name` — ver detalhe na sessão
linkada acima, seção 5).

### 1. Primeiro passo: Cleber roda o commit (nada foi commitado ainda)

```bash
cd /Users/clebercouto/Projects/we-expand/Neural-Day-Trader
npx tsc --noEmit -p tsconfig.json   # confirmar limpo (2 erros pré-existentes em AITrader.tsx são esperados)
cd llm-active-brain && npx tsc --noEmit && cd ..

git add llm-active-brain/src/agent.ts llm-active-brain/src/index.ts \
  llm-active-brain/src/neuralBridge.ts llm-active-brain/src/tools.ts \
  llm-active-brain/restart.sh \
  src/app/components/AITrader.tsx \
  src/app/components/dashboard/AIToolsControl.tsx \
  src/app/components/tools/ATRTrailingStopManager.tsx \
  src/app/hooks/useAIPersistence.ts src/app/hooks/useApexLogic.ts \
  src/app/services/AITradingPersistenceService.ts

git commit -m "feat: LLM Brain vira motor único da plataforma, motor mecânico desligado

- neuralBridge.ts: sessões RUNNING (era PAUSED — hack só necessário com motor
  mecânico ativo), getUserTradingConfig()/getTodayRealizedPnl() novos,
  initial_balance 50->100.
- tools.ts: risco/trade, direção, cesta de ativos e limite de perda diária
  do Setup do AI Trader agora têm efeito real no open_position.
- restart.sh: fix de bug real (PID errado sobrescrevia o lock, causava
  múltiplos processos paralelos do LLM Brain).
- AITrader.tsx: ~18 campos do Setup sem equivalente no motor novo removidos
  (estratégia fixa, position sizing ATR/Fixo, pyramiding, correlação,
  cooldown, stop loss mode, etc.) — decisão explícita do Cleber.
- AIToolsControl.tsx / ATRTrailingStopManager.tsx: deletados (ATR trailing
  do motor mecânico morto — LLM Brain já tem o próprio, neuralBridge.ts
  enforceMt5StopsAndTargets).
- resetLlmActiveBrainSession novo (AITradingPersistenceService.ts): botão
  'Reinicialização Total' do AI Trader agora também reseta a sessão do LLM
  Brain (era só o motor mecânico antes).

Ver SESSAO_2026-08-31_RELIGAMENTO_LLM_BRAIN_MOTOR_UNICO.md pro detalhe
completo de cada achado/decisão."
```

**Não commitar**: `llm-active-brain/.env` (gitignored — tem
`MT5_STOP_MAX_PCT` afrouxado temporariamente pra teste de frequência,
reverter pra `0.02` manualmente quando o teste acabar), `llm-brain.log`,
`llm-brain.pid`.

### 2. Já aplicado direto em produção — NÃO precisa repetir

- Secret `METAAPI_TOKEN` atualizado + `supabase functions deploy server
  --no-verify-jwt`.
- `cron.alter_job(job_id := 5, active := false)` — `ai-runner-tick`
  desativado (motor mecânico). Reversível só com decisão explícita nova do
  Cleber (ele confirmou "definitivamente").
- LLM Brain reiniciado com todo o código desta sessão, rodando 1 processo
  único (`llm-active-brain/restart.sh` pra reiniciar de novo se precisar).

### 3. Pendências reais (nenhuma bloqueante, mas vale revisitar)

1. **Degradação de qualidade do modelo LLM** — texto corrompido/alucinado
   observado ao vivo no log (`nvidia/nemotron-3-nano-30b-a3b`). Não é bug de
   código. Se for investigar: `OMNIROUTE` já está parcialmente configurado
   em `config.ts` (não commitado antes desta sessão, ver diff), pode ser um
   caminho de troca de provedor/modelo.
2. **Cesta efetiva do Cleber ficou em 1 ativo só (`BTCUSD`)** — a seleção
   dele no Setup (`activeAssets`) é majoritariamente forex/índice, sem
   equivalente na cesta cripto do LLM Brain (9 ativos: BTCUSD, XETUSD,
   DOGUSD, DOTUSD, XRPUSD, BTCXBN, ADAUSD, LNKUSD, UNIUSD). Se ele quiser
   mais frequência, é escolha dele ampliar a seleção — não é bug.
3. **`AssetUniverse`** (picker do Setup) não avisa visualmente quando a
   seleção do usuário não tem equivalente na cesta real do motor ativo —
   melhoria de UX possível, não crítica.
4. **`config.allocatedCapital`** ainda existe como estado (não editável na
   UI mais) e ainda é passado pro `AssetUniverse` — não verificado se quebra
   ou só exibe número estático. Checar se mexer nesse componente de novo.
5. Itens de pesquisa histórica (Trilho 2/NIM/cuOpt, Parceiros IB B4,
   probabilidade calibrada, etc.) — nenhum tocado nesta sessão, continuam
   rastreados na seção "Pendências reais em aberto" do
   [CLAUDE.md](CLAUDE.md).

### Regra fixa que continua valendo

Claude nunca commita/faz push sozinho. Migrations do Supabase nunca são
aplicadas por Claude (só SQL pronto) — mas `execute_sql`/`cron.alter_job`
diretos via MCP, quando o Cleber confirma explicitamente a ação (ex: "desligar
definitivamente"), são aceitáveis e já foram usados nesta sessão. Nenhum
dado financeiro é corrigido com `UPDATE` silencioso — sempre
`correction_reason`/valores derivados de soma real (ver seção 6 do handoff
completo, encerramento da sessão de $50).
