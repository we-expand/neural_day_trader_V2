# Sessão 2026-08-31 — LLM Brain vira motor único (execução real, não só rótulo)

> Handoff completo desta sessão. [NEXT_SESSION.md](NEXT_SESSION.md) tem o
> resumo pra próxima sessão continuar — leia aquele primeiro, só volte aqui
> se precisar do detalhe de algo específico.

## Contexto: por que esta sessão aconteceu

Cleber reportou a plataforma com problemas sérios: LLM Brain não abria
posição, Dashboard sem nenhuma posição visível, preço do BTC errado, rate
limit no MetaAPI, token da API mudou, Setup do AI Trader sem efeito real no
motor novo. Pedido explícito: religar TUDO no motor novo (LLM Brain),
desligando o motor mecânico antigo por completo.

## O que foi corrigido (causas raízes reais, não suposição)

### 1. Token MetaAPI + preço errado
Token novo aplicado via `supabase secrets set METAAPI_TOKEN=...` (projeto
`wyvdsxtcmizettljxtbg`) + `supabase functions deploy server --no-verify-jwt`
(única função que lê essa secret — confirmado via grep). Testado ao vivo:
BTCUSD retornando preço real, spread 0,018%. O "preço errado" era efeito
colateral do token velho/expirado.

### 2. "Não abre posição nenhuma" — causa raiz real
A sessão ativa do LLM Brain (`aa279c75...`) estava com **saldo negativo**
(-$6,46 — começou com $50, perdeu $56,46 líquido em 32 trades). Com saldo
negativo, o teto de risco por trade (3% do saldo) também fica negativo —
nenhum lote mínimo cabe dentro disso. Trava matemática, não bug de código.
Resolvido criando sessão nova (ver item 5 abaixo).

### 3. Motor mecânico antigo desligado definitivamente
`cron.alter_job(job_id := 5, active := false)` no Supabase — job
`ai-runner-tick` (rodava `* * * * *`) desativado. Decisão **definitiva** do
Cleber, confirmada explicitamente ("definitivamente"). O loop client-side em
`useApexLogic.ts` já estava desligado em modo DEMO desde 2026-08-17 (decisão
anterior) — só faltava o cron do servidor.

### 4. Achado crítico: 3 processos do LLM Brain rodando em paralelo
Bug real em `restart.sh`: o script escrevia `echo $NEWPID > llm-brain.pid`
usando `$!` — que é o PID do processo `npm` (o wrapper), não o do `node`/
`tsx` real que `acquireSingleInstanceLock()` em `index.ts` usa pra travar.
Isso sobrescrevia o lock correto (escrito pelo próprio processo momentos
depois) com o PID errado, fazendo o processo seguinte se recusar a subir
("já existe processo rodando") — e cada tentativa de restart empilhava mais
um processo zumbi em vez de substituir o anterior. **Encontrado porque o log
mostrava a sessão trocando de ID entre ciclos sem motivo aparente** — eram
processos diferentes escrevendo no mesmo arquivo de log. Corrigido:
`restart.sh` não escreve mais `llm-brain.pid` (deixa o processo real
escrever sozinho). Confirmado depois do fix: 1 processo, estável, várias
checagens ao longo da sessão.

### 5. `getActiveSession()` — o encaixe que unificou a UI sem duplicar código
Achado-chave: `AITradingPersistenceService.getActiveSession()` (usado por
TODO o Dashboard/AI Trader/Gráfico/Header via `useApexLogic.ts`) busca
simplesmente "a sessão `status='RUNNING'` mais recente do usuário", **sem
filtrar por `strategy_name`**. Antes, o LLM Brain gravava suas sessões como
`status='PAUSED'` de propósito (hack documentado no código pra ficar fora do
alcance dessa função, evitando que o motor mecânico ainda ativo confundisse
essa sessão isolada com a sua própria). Agora que o motor mecânico está
desligado, virou seguro inverter: `getOrCreateMt5Session`/
`listEligibleMt5Sessions` (`llm-active-brain/src/neuralBridge.ts`) passaram
a usar `status='RUNNING'`. Resultado: toda a UI que já lia essa sessão
passou a mostrar o LLM Brain automaticamente — **zero componente novo
precisou ser criado**.

⚠️ Um painel dedicado (`LlmActiveBrainPanel.tsx`) tinha sido criado e depois
apagado (por engano, minutos antes de virar motor principal) numa sessão
anterior no mesmo dia — cheguei a tentar recriá-lo, mas o Cleber pediu pra
NÃO fazer isso: "o novo cérebro deve mostrar tudo no Dashboard, como o
cérebro antigo" — ou seja, reusar a UI existente (via item acima), não criar
painel à parte. Não recriar esse arquivo.

### 6. Sessão $50 → $100 (valor único da plataforma)
Cleber decidiu: a sessão de $50 (usada durante teste/isolamento) não deve
mais existir — só $100 é aceitável (mesmo valor do botão "Reinicialização
Total"). Sessão `fd7b74bd...` ($50) encerrada com `UPDATE` explícito
(`status='COMPLETED'`, `final_balance`/`final_equity` calculados a partir de
`initial_balance + sum(net_pnl)`, nunca um `UPDATE` silencioso — ver
convenção do projeto em CLAUDE.md). `initial_balance`/`initial_equity`
default em `getOrCreateMt5Session` (`neuralBridge.ts`) trocado de 50 → 100.
Sessão atual: `faff526b-7cf8-4f94-b885-8afd36ab77e2`, $100, `RUNNING`.

### 7. ATR Trailing Stop antigo removido
Confirmado que o LLM Brain **já tem** trailing stop mecânico próprio
(`enforceMt5StopsAndTargets`, `neuralBridge.ts:701`, breakeven + trailing
contínuo por ATR) — Cleber estava certo ao suspeitar disso. O painel antigo
(`ATRTrailingStopManager.tsx`, controlava `aiConfig.stopLossMode` do motor
mecânico) e o card que o abria (`AIToolsControl.tsx`) foram **deletados**
(não é mais necessário, motor mecânico morto). Import/mount removidos de
`AITrader.tsx`.

### 8. Setup do AI Trader — reconectado (só o que tem equivalente real)
Achado: o Setup (25 campos em `AIConfig`, salvos em `ai_user_config` via
`saveUserAIConfig`) **nunca teve nenhuma ligação** com o `llm-active-brain`
— ele só lê `.env`. Boa parte dos campos (estratégia fixa, signalScoreFloor,
position sizing ATR/Fixo, pyramiding, correlação, cooldown, drawdown
anchor...) não tem equivalente conceitual num agente LLM que raciocina
livremente por ciclo (vs. motor mecânico que segue fórmula/estratégia
paramétrica fixa). Decisão do Cleber, confirmada 2x: **reconectar só o que
tem equivalente real, deletar o resto da UX** (não deixar como "decorativo
sem efeito").

**Removido da UX** (`AITrader.tsx`): Timeframe, Estratégia ativa, Fluxo de
Operação (Trend/Counter), Alvo de Lucro (targetPoints), Seletividade de
Entrada (signalScoreFloor), Lotes Máximos, Máximo de Posições, Modo Stop
Loss, Filtro de Notícias, Max Drawdown, Ancoragem de Drawdown, Tamanho de
Posição (modo ATR/Fixo + preview), Freio de Acerto Mínimo (minWinRate),
Pausa pós-perdas (cooldown), Máx Trades/Dia, Cadência Agressiva, Correlação
entre Posições, Pyramiding (`PyramidingConfigPanel`). Imports órfãos
limpos (`PyramidingConfigPanel`, `DEFAULT_PYRAMIDING_CONFIG`,
`previewPositionSizing`, ícones `TrendingUp`/`Crosshair`/`Clock`).
"Capital para IA" virou card **informativo** (não editável mais — o valor
$100 é fixo pela plataforma, um sub-alocador de capital não tem equivalente
no motor novo, que usa risco-% do saldo REAL, não de uma fatia dele).

**Reconectado de verdade** (lê `ai_user_config` via novo
`getUserTradingConfig(userId, fullBasket)` em `neuralBridge.ts`, cache 60s):
- **Risco por trade (%)** — sobrepõe `config.mt5RiskPctPerTrade` quando o
  usuário define (`tools.ts`, cálculo de `riskPct` no `open_position`).
- **Direção preferencial** (AUTO/LONG/SHORT) — bloqueia o lado oposto antes
  de qualquer chamada de cotação/validador (barato).
- **Cesta de ativos** — intersecta `activeAssets` do Setup (catálogo
  unificado, ex: "BTCBNB") com a cesta real do LLM Brain (nomes literais da
  Infinox, ex: "BTCXBN" — tradução via `INVERSE_ALIAS`); vazio → cesta
  inteira, nunca trava o motor sem nenhum ativo.
- **Limite de perda diária (%)** — nova `getTodayRealizedPnl(sessionId)`
  (`neuralBridge.ts`, soma `net_pnl` de trades fechados desde 00:00 UTC);
  bloqueia NOVA entrada se já bateu o teto, não fecha posição existente.

**Achado ao vivo depois de aplicar**: a cesta salva no Setup do Cleber
(EURUSD, XAUUSD, GER40 etc. — a maioria forex/índice) tinha só **1 ativo em
comum** com a cesta cripto do LLM Brain (`BTCUSD`) — limitando bastante a
frequência. Avisado ao Cleber, não corrigido (é escolha dele, não bug).

## Estado técnico ao final da sessão

- `tsc --noEmit` limpo em `llm-active-brain/` (`strict: true`) e nos
  arquivos tocados do app principal. 2 erros em `AITrader.tsx`
  (`/utils/supabase/info`, `MT5Adapter`) são **pré-existentes**, confirmado
  via `git stash` antes/depois — não introduzidos nesta sessão.
- LLM Brain rodando: 1 processo (`tsx src/index.ts`), sessão
  `faff526b-7cf8-4f94-b885-8afd36ab77e2` ($100, `RUNNING`), config do Setup
  sendo lida corretamente (confirmado no log ao vivo).
- **Commit feito pelo Cleber** (`09ba45256`/`20c2f2a5e`, working tree
  limpo) — código desta sessão já versionado.
- Deploy já aplicado direto (não precisa repetir): secret `METAAPI_TOKEN`,
  função `server`, cron `ai-runner-tick` desativado.

## Pendências reais (não investigadas ou deliberadamente fora de escopo)

1. **Degradação de qualidade do modelo LLM** — observada ao vivo no log:
   texto corrompido/misturado com outro idioma ("Positionen abertas",
   "व aktividad"), termos sem sentido, tentativas de fechar `trade_id`s que
   nunca existiram. Não é bug de código — é qualidade do modelo configurado
   (`nvidia/nemotron-3-nano-30b-a3b`, `LLM_PROVIDER=nvidia`). Fora de
   escopo desta sessão; se for investigar, considerar trocar de modelo/
   provedor (ver `llm-active-brain/src/config.ts`, já tem `omniroute` como
   opção em teste, não commitado).
2. **Frequência de operação** — Cleber pediu "mais frequente pra testar".
   Afrouxei temporariamente `MT5_STOP_MAX_PCT` (0.02→0.035, `.env`, **não
   versionado**, reverter manualmente se quiser voltar ao normal depois do
   teste). Cesta efetiva do Cleber ficou em 1 ativo só (`BTCUSD`) por causa
   da seleção salva no Setup — ver achado acima, ele decide se amplia.
3. **`AssetUniverse`** (componente usado no Setup pra escolher `activeAssets`)
   ainda lista o catálogo completo do app (forex/índices/cripto), não só os
   9 ativos que o LLM Brain realmente opera — não indica visualmente quais
   seleções "não vão fazer efeito" (intersecção vazia com a cesta real). Não
   mexido nesta sessão — daria pra melhorar avisando isso na UI.
4. **`config.allocatedCapital`** ainda existe como campo de estado (só não é
   mais editável na tela) e ainda é passado como prop pro `AssetUniverse`
   (`AITrader.tsx:1157`) — não verificado se esse componente quebra ou só
   exibe um número estático desatualizado. Não é bloqueante, mas vale
   checar se for mexer no `AssetUniverse` de novo.
5. **Sessões antigas `PAUSED`** (`aa279c75`, `e7eef768`, `38669eeb`, etc.)
   continuam no banco como histórico — não apagadas, ficam de fora de
   `listEligibleMt5Sessions`/`getActiveSession` (ambos filtram `RUNNING`
   agora). Nenhuma ação necessária, só documentando pra não confundir numa
   auditoria futura.

## Arquivos alterados (commit pendente)

```
llm-active-brain/src/agent.ts        — Mt5Session ganha userConfig opcional
llm-active-brain/src/index.ts        — resolveMt5Sessions busca userConfig por sessão
llm-active-brain/src/neuralBridge.ts — status RUNNING, getUserTradingConfig, getTodayRealizedPnl, initial_balance 100
llm-active-brain/src/tools.ts        — cesta/risco/direção/perda-diária por sessão no open_position
llm-active-brain/src/tickHistory.ts  — PRÉ-EXISTENTE (Fase 2 anterior, não tocado nesta sessão): getLastKnownPrice() fallback
llm-active-brain/restart.sh          — NOVO ARQUIVO, fix do bug de PID duplicado
src/app/components/AITrader.tsx      — Setup reduzido + reconectado
src/app/components/dashboard/AIToolsControl.tsx — DELETADO
src/app/components/tools/ATRTrailingStopManager.tsx — DELETADO
src/app/hooks/useAIPersistence.ts    — expõe resetLlmActiveBrainSession
src/app/hooks/useApexLogic.ts        — resetLogic chama resetLlmActiveBrainSession
src/app/services/AITradingPersistenceService.ts — resetLlmActiveBrainSession novo
```

**Não commitar** `llm-active-brain/.env` (gitignored, mudança local de
`MT5_STOP_MAX_PCT`) nem `llm-active-brain/llm-brain.log`/`llm-brain.pid`
(gerados em runtime).
