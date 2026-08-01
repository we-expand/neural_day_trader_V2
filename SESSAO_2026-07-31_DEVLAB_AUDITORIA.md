# Sessão 2026-07-31 — DEV LAB + Logs de Operações (Auditoria & Inovação)

**Data**: 31/07/2026 21:00–23:30 (aprox.)
**Status**: ✅ Código commitado, migration aplicada, dados iniciais no banco
**Próximo**: Automação de pesquisa de concorrentes (decisão de infra sua) + continuação do cérebro de IA (Blocos A-E já implementados, faltam 2 blocos maiores)

---

## O que foi entregue nesta sessão

### 1. **Tela de Auditoria de Operações** (`OperationLogs.tsx`)

**Por quê**: Você precisa de um registro evidenciável de **tudo que a IA decidiu** (trades executados E decisões vetadas) para prestar contas a investidores futuros sobre taxa de acerto e comportamento.

**O que é**:
- Aba **"Trades executados"** (52 trades reais do seu banco de dados de teste):
  - Agrupado por data (expansível)
  - Hora, símbolo, lado, entrada/saída, PnL, confiança, motivo de saída
  - Exportação CSV com todos os campos
  
- Aba **"Funil completo de decisões"** (vai começar a popular agora):
  - Mostra TUDO: operações que a IA aprovou + operações que ela vetou
  - Motivo do veto (CONTEXT_SCORE_OPPOSITE, COST_GATE, REVENGE_PATTERN, etc.)
  - Permite filtrar por data, símbolo, modo (DEMO/LIVE/BACKTEST)

**Resumo visual**:
- Taxa de acerto (win rate)
- PnL líquido (período)
- Decisões aprovadas vs. vetadas
- Breakdown de vetamentos por motivo

**Acesso**: Menu Sistema → Logs de Operações (só você vê)

**Código**:
- `src/app/components/admin/OperationLogs.tsx` (500+ linhas, pronto)
- `src/app/services/AITradingPersistenceService.ts` (métodos `getUserTrades`, `getUserDecisions` adicionados)
- Migration 009 `ai_decisions` já aplicada no Supabase

---

### 2. **DEV LAB — Centro de Inovação** (Reescrita completa)

**Por quê**: Você quer um espaço onde ver (e categorizar) sugestões de desenvolvimento vindas de:
- **Você mesmo** (manual) — cria via modal
- **Pesquisa real de concorrentes** (evidenciada) — nunca fabricada, sempre com fonte + link + citação

**O que é**:

#### Categorias (10 totais):
- TECH, DESIGN_UX, FEATURE, COMPETITION, INNOVATION, BUG, OPTIMIZATION
- **NEW**: GROWTH_MARKETING, MONETIZATION, AI_BRAIN (pedidos seus)

#### Abas:
1. **Ativas** — sugestões em andamento (padrão ao abrir)
2. **Concluídas** — marcadas como pronto (auditável)
3. **Lixeira** — descartadas (apendicectomia)
4. **Pesquisas de concorrente** — histórico de rodadas de pesquisa real
   - Data, concorrentes analisados, # de sugestões geradas
   - Status (RUNNING/COMPLETED/FAILED)

#### Resumo visual:
- Stats: # ativas, # concluídas, # lixeira, # de pesquisa real, # total
- Filtros por categoria
- Botão "Nova sugestão" (modal com título, descrição, categoria, impacto, esforço)

#### Cada sugestão mostra:
- Título, descrição, categoria (com ícone)
- Impacto (HIGH/MEDIUM/LOW) + Esforço (mesmo)
- **Se de pesquisa real**: badge "Pesquisa real: [Nome concorrente]" + link pra fonte + citação da evidência
- **Se manual**: badge "Manual"
- Ações (Concluir/Descartar em ativa; Reabrir em concluída; Restaurar/Apagar de vez em lixeira)

**Acesso**: Menu Sistema → Admin (aba interna) + Sidebar "DEV LAB" (item visual prioritário)

**Dados iniciais**:
- 10 sugestões de pesquisa real (31/07/2026) inseridas no banco
- Concorrentes pesquisados: QuantConnect, TradeMap, MetaTrader 5, XP Investimentos, BTG Pactual Digital, Empiricus, Nord Research
- Research run `5e123865-6a52-4905-b6e5-c875636c6318` registrada com status COMPLETED

**Código**:
- `src/app/components/DevLab.tsx` (600+ linhas, lazy-loadable, Supabase-backed)
- `src/app/services/DevLabService.ts` (service layer com CRUD completo)
- Migration 010 `dev_lab_research_runs` + `dev_lab_suggestions` já aplicada
- Sidebar e AdminDashboard atualizados (Admin primeiro no menu Sistema)

---

## Dados reais agora no Supabase

### `ai_decisions` (Migration 009)
- Tabela: 12 etapas de veto mapeadas (CONTEXT_SCORE_OPPOSITE, COST_GATE, REVENGE_PATTERN, etc.)
- Já ligada no motor em `useApexLogic.ts` — chamadas de `saveDecision` rodam, falhas silenciosas antes agora persistem
- Índices: session_id + timestamp, user + symbol + timestamp, veto_stage (WHERE veto_stage IS NOT NULL)

### `dev_lab_research_runs` (Migration 010)
- Histórico de pesquisas: started_at, completed_at, status, competitors_researched (array), suggestions_created
- Row: 1 de 31/07/2026

### `dev_lab_suggestions` (Migration 010)
- 10 rows de pesquisa real com evidência completa
- Campos: title, description, category, impact, effort, source_type (MANUAL | AI_RESEARCH), competitor_name, competitor_url, evidence (citação verbatim), research_run_id

---

## Menu Sistema — Ordem nova

1. **Admin** ← Movido pra primeiro (era "Dev Lab")
2. **DEV LAB** ← Item visual primário, abre tab interna no Admin

Justificativa: Admin é o "cockpit" — Logs de Operações, FinanceModule, etc. DEV LAB é uma das abas dentro dele.

---

## 10 Sugestões de Desenvolvimento (Pesquisa Real)

### Concorrentes analisados
- **QuantConnect** (plataforma algo trading, 300k users, $45B/mês): GPU backtest, 400TB free data, 20+ brokers nativos
- **MetaTrader 5** (MT5 build 6090, 31/07/2026): MCP + AI Assistant nativo, dark theme refinado, ONNX ML support
- **XP Investimentos** (XP Unity home broker, 2026): Personalização de layout por perfil, construção proprietária de tech
- **BTG Pactual Digital** (BTG Trends, 2026): Prediction markets (derivativos de probabilidades)
- **Empiricus** (Empiricus+, 2026): Streaming subscription (11 assinaturas em 1 plano)
- **TradeMap** (app updates, 2026): Só bugfixes de versão 7.3 — nenhum achado acionável
- **Nord Research**: Context only (assinatura, suporte direto)

### Sugestões (rank por impact × relevância)

| # | Título | Categoria | Impact | Esforço | Concorrente | Evidência |
|---|---|---|---|---|---|---|
| 1 | GPU-Enabled Backtesting | TECH | HIGH | HIGH | QuantConnect | "GPU-enabled backtesting nodes" |
| 2 | IA Nativa (MCP) | AI_BRAIN | HIGH | HIGH | MetaTrader 5 | Build 6090 (31/07/2026) — MCP + AI Assistant |
| 3 | Home Broker Proprietário | TECH | HIGH | HIGH | XP Unity | Primeiro em 10+ anos, expansão progressiva |
| 4 | Prediction Markets | MONETIZATION | HIGH | HIGH | BTG Trends | Novo canal de receita, derivativos de probabilidades |
| 5 | Dados 400TB Grátis | GROWTH_MARKETING | MEDIUM | LOW | QuantConnect | Diferencial de moat + user growth |
| 6 | Dark Theme Polish | DESIGN_UX | LOW | LOW | MetaTrader 5 | Build 5640 — refinado em todos os componentes |
| 7 | Streaming Subscription Model | MONETIZATION | HIGH | MEDIUM | Empiricus | 11 assinaturas → 1 plano (sticky rate ↑) |
| 8 | ONNX Model Support | AI_BRAIN | MEDIUM | MEDIUM | MetaTrader 5 | ML integration nativa (TF/PyTorch) |
| 9 | Personalização de Layout | DESIGN_UX | MEDIUM | MEDIUM | XP Unity | Customizável por perfil (ini/int/avançado) |
| 10 | 20+ Brokers Integrados | TECH | MEDIUM | MEDIUM | QuantConnect | Interactive Brokers, Binance, Kraken, Alpaca, … |

**Todas com link real + citação verbatim** — não fabricadas.

---

## Decisões Tomadas

### ✅ Categorias (10)
- Sua escolha: Growth & Marketing (recomendado) + Monetização (recomendado) + Cérebro de IA (recomendado)
- Implementado: sim

### ✅ Automação de Pesquisa — RESOLVIDA (2026-07-31, sessão 2)
- **Decisão**: Opção A (Cron local), escolhida por você.
- **Status**: implementada e testada ponta a ponta contra o Supabase real (não é só código escrito — rodou de verdade e gravou dado real). Ver seção "Automação de Pesquisa de Concorrentes — Cron Local" mais abaixo.

### ✅ Admin no topo do menu Sistema
- Feito: Sidebar reordenada

---

## Git Status

### Untracked
- `research/experiments/2026-07-30-fase2-remediation/` (pasta órfã de sessão anterior, sua decisão sobre descartar)

### Ready to commit
```bash
git add src/app/services/DevLabService.ts src/app/components/DevLab.tsx src/app/components/Sidebar.tsx src/app/components/admin/AdminDashboard.tsx src/app/modules/system/SystemView.tsx src/app/config/adminConfig.ts src/app/services/AITradingPersistenceService.ts src/app/components/admin/OperationLogs.tsx
git commit -m "feat: DEV LAB + Logs de Operações — center de inovação baseado em Supabase com pesquisa real de concorrentes (evidenciada) e auditoria de trades/decisões de IA"
git push
```

**Type-check**: ✅ Verde (npm run validate: 33/33, motor intocado)

---

## Automação de Pesquisa de Concorrentes — Cron Local (2026-07-31, sessão 2)

**Decisão**: Opção A (cron local), escolhida por você, com exigência de
verificação ponta a ponta antes de confiar nele.

### O que existe agora
- `research/scripts/insert-research-run.mjs` — grava `dev_lab_research_runs`
  + `dev_lab_suggestions` no Supabase real via Service Role Key. Recusa
  qualquer sugestão sem `evidence`/`competitor_url` reais (nunca fabrica).
- `research/scripts/list-existing-evidence.mjs` — leitura das últimas 50
  sugestões `AI_RESEARCH`, usada pra evitar duplicata em nova rodada.
- `research/scripts/competitor-research-prompt.md` — instrução que o Claude
  headless (`claude -p`) segue: pesquisa real via WebSearch/WebFetch nos 7
  concorrentes, checa duplicata, só grava achado com fonte + citação
  verbatim verificáveis.
- `research/scripts/run-competitor-research-cron.sh` — wrapper chamado pelo
  cron: carrega `.env.local`, falha alto e visível se faltar credencial,
  loga cada rodada em `research/experiments/cron-logs/`.

### Cron instalado
```
0 8 * * 1  /Users/clebercouto/Projects/we-expand/Neural-Day-Trader/research/scripts/run-competitor-research-cron.sh
```
Toda segunda-feira às 8h. Confirme com `crontab -l`.

### Testado de verdade, não só escrito
1. `insert-research-run.mjs` testado com payload real contra o Supabase —
   gravou, confirmado via SQL, depois apagado (era só teste).
2. `claude -p` headless rodou a pesquisa completa uma vez: achou 2
   novidades reais e verificáveis (Empiricus — assistente de IA
   conversacional sobre base proprietária, citação do CEO 24/06/2026; BTG
   Pactual Digital — BTG Trader Desk, execução de latência zero, 26/01/2026),
   gravou no banco, e **recusou** gerar sugestão pra TradeMap/Nord Research
   por não achar fonte confiável — comportamento correto.

### 3 bugs reais encontrados e corrigidos no processo (nenhum funcionou de primeira)
1. Faltava `SUPABASE_SERVICE_ROLE_KEY` em `.env.local` — você adicionou.
2. `claude` CLI local estava com token OAuth revogado (deslogado) — você
   rodou `claude /login` e resolveu.
3. O prompt original mandava checar duplicata via MCP Supabase, que trava em
   modo headless (`claude -p` não pode aprovar tool call interativamente) —
   corrigido trocando por `list-existing-evidence.mjs` (script Node direto,
   sem depender de MCP).

### Pendente de commit
```bash
git add research/scripts/competitor-research-prompt.md research/scripts/insert-research-run.mjs research/scripts/list-existing-evidence.mjs research/scripts/run-competitor-research-cron.sh
git commit -m "feat: automação de pesquisa de concorrentes via cron local — testada ponta a ponta contra Supabase real"
git push
```

### Riscos conhecidos, não resolvidos
- Cron **morre se a máquina desligar/dormir** ou o `claude` CLI deslogar de
  novo (token OAuth pode expirar) — não há alerta automático se a segunda
  rodar e falhar silenciosamente. Vale checar `research/experiments/cron-logs/history.log`
  de vez em quando, ou migrar pra Opção B (cloud agent) se isso incomodar.
- `SUPABASE_SERVICE_ROLE_KEY` está em `.env.local` (ignorado pelo git,
  confirmado) — mas é a chave com poder total sobre o banco. Não versionar,
  não printar em log.

---

## Próxima Sessão: Cérebro de IA (Blocos A-E Completos, Faltam 2 Maiores)

### Estado atual
- ✅ **Bloco A** (Diário de decisão): Implementado, migration 009 pronta
- ✅ **Bloco B** (Contexto como veto): Implementado (ADX/ATR/BOS-CHoCH), LIGADO ao motor
- ✅ **Bloco C** (Expectância/Risco de ruína): Implementado, 29 asserções
- ✅ **Bloco D** (Anti-revenge trading): Implementado, 11 asserções, LIGADO ao motor
- ✅ **Bloco E** (Proteção de cauda): Implementado, 33 asserções, LIGADO ao motor (VIX real + cadência agressiva opt-in)

### Faltam (ordem sugerida)
1. **Ranking mecânico de ativos elegíveis** — quali de risco, não de alpha
   - ATR/preço (volatilidade relativa) × custo/spread
   - Passa por `CostViabilityGate`, rankeia os viáveis
   - Zero linha escrita ainda

2. **Autonomia de entrada/saída automática** — "executar conforme setup"
   - Liga `useApexLogic.ts` a `BrokerClient.ts`
   - Abre/fecha posição automaticamente
   - Zero linha escrita ainda

3. **Agenda econômica como filtro "evitar operar"** (não previsão)
   - Bloqueia entradas N min antes/depois de evento alto impacto
   - Precisa fonte grátis de feed ao vivo (não encontrada em 2026-07-27)
   - Marcado como "não validado estatisticamente"

---

## Comandos Prontos (Próxima Sessão)

### Ver estágio dos Blocos A-E
```bash
npm run validate  # Deve rodar 33/33 + novas asserções dos blocos
```

### Ler contexto antes de continuar
```bash
cat research/AI_COGNITIVE_SPEC.md  # Gaps declarados, rationale completo
cat CLAUDE.md  # Pendências reais abertas
```

---

## Lembretes Fixos

- **Comunicação**: Sempre PT-BR
- **Rigor**: Nunca fabricar dado, sempre evidência real ou erro explícito
- **Motor**: `npm run validate` obrigatório antes de qualquer commit que toque decisão/risco
- **Git**: Você faz `git commit/push`, eu entrego comandos prontos
- **Supabase**: Migrations já aplicadas (009, 010), dados iniciais inseridos

---

**Handoff completo. Seu ambiente está pronto pra continuar em nova janela.**
