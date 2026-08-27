# Neural Day Trader — Estado do Projeto

> **Este arquivo foi reescrito em 2026-07-24, aparado em 2026-08-04 e
> aparado de novo em 2026-08-25** pra ficar enxuto. O histórico completo de
> sessões (dezenas de investigações, bugs corrigidos, decisões antigas,
> incluindo os handoffs completos de itens já resolvidos entre 07-24 e
> 08-24) está preservado em [CLAUDE_HISTORY.md](CLAUDE_HISTORY.md) — não é
> carregado automaticamente, consulte só se precisar do detalhe de algo
> específico do passado. Este arquivo carrega em toda sessão nova:
> **mantenha enxuto**. Regra de manutenção: quando um item de "pendente"
> for resolvido, resuma pra 1-2 linhas (link pro histórico ou pro .md de
> sessão se precisar do detalhe) — nunca deixe handoff completo de sessão
> se acumular aqui de novo (aconteceu duas vezes já, 07-24→08-04 e
> 08-04→08-25).

## ▶ COMECE AQUI

**2026-08-27: Dropdown "Poucos/Médio/Muitos pontos" (alvo de lucro)
reconectado — ficava salvo sem efeito real no motor ao vivo desde
2026-08-17.** O alvo era sempre stop×3 fixo, não importava a escolha da
UI. Agora cada opção escala o R:R real (`RISK_REWARD_BY_TARGET_POINTS` em
`runTradingCycle.ts`: POUCOS=1,5×, CURTO=2×, MÉDIO=3× sem mudança,
LONGO=4×, MUITOS=5×), stop continua sempre 2×ATR. Deploy e commit já
feitos. **Pendente**: nenhum dado ainda sobre qual nível performa melhor
líquido. Detalhe: seção final de
[SESSAO_2026-08-27_PERSISTENCIA_CONFIG_E_DIAGNOSTICOS.md](SESSAO_2026-08-27_PERSISTENCIA_CONFIG_E_DIAGNOSTICOS.md).

**2026-08-27: Persistência de configuração da IA implementada (pedido
antigo do Cleber, nunca feito de verdade) + 4 diagnósticos do dia.**
Config da IA (`stopLossMode` etc) até então só existia em `localStorage`
por navegador — voltava pro default hardcoded em outro dispositivo/aba
anônima. Agora persiste em `ai_user_config` (Supabase, por `user_id`),
migration e commit já aplicados pelo Cleber, validado ponta a ponta em
produção. De carona: bug de exibição corrigido (`InfinoxAssetsBrowser`
mostrava "$0,00" em vez de "Sem dados"); confirmado que "82% sem preço
real" e "só opera SOL/ETH" não são bugs (infra MetaAPI e dinâmica de
mercado, respectivamente); achado que os 7 trades automáticos fechados
desde a mudança de risco/TP de 26/08 ainda estão negativos (-$1,88), a
melhora aparente vinha só de 3 fechamentos manuais. **Pendente**: decidir
se `DINAMICO` vira default de `stopLossMode` pra sessões novas (hoje é
opcional, pode ficar em `FIXO` sem o usuário notar). Detalhe completo:
[SESSAO_2026-08-27_PERSISTENCIA_CONFIG_E_DIAGNOSTICOS.md](SESSAO_2026-08-27_PERSISTENCIA_CONFIG_E_DIAGNOSTICOS.md).

**2026-08-25: Trilho 2 reaberto (NVIDIA NIM Signal Discovery, incl. NLP)
+ cuOpt em Fase A (não integrado ainda).** Etapa 0 já rodou de verdade
contra a NIM API — 5 hipóteses geradas (correlação cross-asset,
calendário-regime, NLP sobre texto de evento), nenhuma validada ainda.
Nada de produção mudou. **Pendente, em ordem**: confirmar que o secret
`NVIDIA_API_KEY` do NEXUS no Supabase (rotacionado nesta sessão após
apagar por engano) está de fato ativo — não testado ainda; decidir
orçamento de newsfeed pago pro NLP; escrever backtest real das 5
hipóteses; confirmar schema do endpoint cuOpt antes da Fase A rodar de
verdade. Detalhe completo:
[SESSAO_2026-08-25_NVIDIA_TRILHO2_CUOPT.md](SESSAO_2026-08-25_NVIDIA_TRILHO2_CUOPT.md),
ordem exata em [NEXT_SESSION.md](NEXT_SESSION.md).

**2026-08-25: NEXUS trocado de Groq pra NVIDIA Nemotron 3 (Nano).**
Testado ao vivo em produção. Primeira tentativa (Ultra, 550B/55B ativos)
mediu ~28s de resposta — inviável pra chat; trocado pra Nano (30B/3B
ativos, feita pra chat/tool-calling interativo). **Pendente**: redeploy
(`supabase functions deploy nexus-brain --no-verify-jwt`) e reteste de
latência com o modelo novo. Detalhe:
[SESSAO_2026-08-25_NEXUS_TROCA_LLM_NEMOTRON.md](SESSAO_2026-08-25_NEXUS_TROCA_LLM_NEMOTRON.md).

**2026-08-24: Order Block Fade testado — sem edge.** Fade contra zona de
order block (SMC) testado como estratégia a pedido do Cleber — 1 de 21
séries fechou positiva líquida (taxa de acerto média 32,3%), mesmo padrão
da busca de julho. Achado de processo: bug de look-ahead no backtest
inflava o resultado inicial, corrigido. `detectStructureEvents`
(`marketStructure.ts`) documentado com viés de look-ahead ~2 candles, não
corrigido (não afeta exibição visual, afetaria decisão de trade). Detalhe:
[research/experiments/2026-08-24-order-block-fade/verdict.md](research/experiments/2026-08-24-order-block-fade/verdict.md).

**2026-08-24: Jarvis (segundo cérebro do motor) em produção.** 6 tabelas
`jarvis_*`, Edge Function deployada e testada com dado real (7 trades/6h,
guardrails funcionando ponta a ponta), cron `jarvis-analysis-6h` ativo.
Próximo marco real: esperar 1-2 semanas de `jarvis_health_snapshots`
acumular e revisar quais decisões `PENDING` fazem sentido aprovar. Detalhe
no histórico ou em
[SESSAO_2026-08-23_CUSTO_INVISIVEL_PESQUISA_EDGE_E_JARVIS.md](SESSAO_2026-08-23_CUSTO_INVISIVEL_PESQUISA_EDGE_E_JARVIS.md).

**[RESOLVIDO 2026-08-24] Custo de execução não cobrado.** 135/135 trades
fechavam com `commission: 0`; fix confirmado em produção (v48 do
`ai-runner`). Efeito líquido no resultado ainda não avaliado (amostra
pequena pós-fix). Detalhe no [CLAUDE_HISTORY.md](CLAUDE_HISTORY.md).

**Fase de pesquisa fechada em 2026-08-23, reaberta em 2026-08-25 (ver item
do topo)**: calendário/macro sem efeito direcional utilizável (só redução
de custo por janela de risco); posicionamento/fluxo e TradingAgents/ML sem
edge intraday comprovado. Relatórios em
`research/experiments/2026-08-23-custo-nao-cobrado-e-poder/`.

Itens de 2026-08-21 (todos resolvidos, detalhe no histórico se precisar):
log de PnL em $ + fix de import map quebrado; gate de notícias/VIX do
`ai-runner` (era stub morto, corrigido — **migration
`20260821_add_news_gate_veto_stage.sql` ainda pendente de aplicar**);
"Parar IA" não fecha mais posições à força, só impede abertura de novas.

**Scorecard de performance por ativo** (infraestrutura no ar desde
2026-08-21, efeito desligado): `ASSET_SCORECARD_ACTIVE = false` em
`runTradingCycle.ts` — job só acumula histórico
(`asset_performance_scorecard`, a cada 30min). Proxy-backtest inicial deu
Δ≈-$0,02 (ruído, dado insuficiente). Próximo passo real: esperar 1-2
semanas de dado e repetir o proxy-backtest antes de cogitar ligar o
switch.

Redesenho do cérebro de decisão (aberto 2026-08-04) — ver item 0 de
"Pendências reais em aberto" abaixo, é o mesmo item.

## O que é

SaaS de trading quantitativo (React 18 + TS + Vite + Supabase + MetaAPI/MT5).
Produção: `https://www.neuraldaytrader.com` (Vercel) + Supabase próprio
(projeto "Neural DayTrader", id `wyvdsxtcmizettljxtbg`, org "We Expand").

> ⚠️ **PRODUÇÃO ESTÁ FORA DO AR DE PROPÓSITO.** `www.neuraldaytrader.com`
> serve uma página estática "Em construção" (o `index.html` da branch `main`
> é a página de manutenção, commit `d053074a3`), **não o app**. Todo
> desenvolvimento e teste acontece na branch `dev` — ver "Ambientes e
> branches" abaixo. Não tirar da manutenção sem decisão explícita do Cleber.

**Modelo de negócio**: Fase Demo (dados reais, execução virtual persistida,
sem corretora própria do usuário) → Fase Real (usuário conecta corretora via
MetaAPI, comissão por lote). Aporte mínimo travado em **US$50**. Corretora de
referência: Infinox (custo calibrado "igual ou um pouco abaixo" da
concorrência — ver `research/CostModel.ts`).

## Ambientes e branches — LER ANTES DE TESTAR OU FALAR DE DEPLOY

**Trabalhamos na branch `dev`. Produção (`main`) está em manutenção.**

| Ambiente | Branch | URL | Serve o app? |
|---|---|---|---|
| **Trabalho/teste** | `dev` | `neural-day-trader-v2-git-dev-cleber-coutos-projects.vercel.app` | ✅ Sim |
| Produção | `main` | `www.neuraldaytrader.com` | ❌ Não — página "Em construção" |

- **Nunca testar em URL de deployment com hash** (`...-bwip109bq-...`). Essas
  URLs são **imutáveis**: ficam congeladas no código daquele build e nunca
  atualizam, por mais pushes que se faça. Já custou uma investigação inteira
  ("o push não foi pra Vercel", quando tinha ido). Usar o alias de branch.
- **Mergear `dev`→`main` não tira o produto da manutenção** — o `index.html`
  de manutenção é do `main` e sobrevive ao merge.
- **Edge Functions não sobem com `git push`** — precisam de
  `supabase functions deploy <nome>`. O `ai-runner` exige **`--no-verify-jwt`**
  (tem auth própria via `x-runner-secret`); sem a flag, todo tick do cron toma
  `401 UNAUTHORIZED_NO_AUTH_HEADER` e a IA para por completo.
- **O motor que opera de verdade é o `ai-runner` no servidor** (`pg_cron`,
  1×/min), não a aba do navegador. Fechar a aba não para a IA; fix só no
  cliente não muda o comportamento real de trading, e vice-versa.
- **Secrets do Supabase sobrepõem o default do código.** Se uma secret já
  foi setada explicitamente numa sessão anterior (ex: `LLM_PROVIDER`), ela
  continua valendo mesmo depois de mudar o default no código-fonte — só
  redeploy não basta, é preciso `supabase secrets set` explícito pra
  atualizar o valor em produção.

## Regra fixa de workflow

**Claude nunca faz `git commit`/`git push` sozinho neste projeto.** Sempre
entregar código pronto + comandos de commit prontos pro Cleber rodar. Deploy
na Vercel dispara automaticamente a partir do push. Migrations do Supabase
também nunca são aplicadas por Claude — só o SQL pronto pro Cleber rodar no
SQL Editor. (Motivo: já rodei `git commit` sozinho uma vez, ver
[CLAUDE_HISTORY.md](CLAUDE_HISTORY.md) se quiser o incidente completo — não
repetir.)

**Antes de criar qualquer arquivo novo com `Write`, sempre checar primeiro**
(`ls`/`git status`) **se já existe algo com aquele nome exato**, mesmo
quando a intenção é "criar do zero" — já apaguei um arquivo não versionado
sem recuperação possível por pular esse passo (detalhe no histórico).

## Arquitetura — estado real (não confiar sem checar o código se for crítico)

- **Segurança (Fase 1)**: RLS habilitado em todas as tabelas, token MetaAPI
  nunca fica no client (criptografado em `broker_credentials`, só a Edge
  Function acessa). `mockLogin` do `AuthContext` não é mais acionado no fluxo
  de login de produção (era chamado depois do login real e sobrescrevia o
  `user.id` — corrigido em 2026-07-29, detalhe no histórico).
- **Persistência (Fase 2)**: sessões/trades/portfolio da IA em modo DEMO
  persistem no Supabase (`ai_sessions`/`ai_trades`/`ai_portfolio_snapshots`).
- **Execução real (Fase 3)**: `/broker/execute` existe e funciona. Ponte
  decisão→execução com 4 estágios opt-in implementada (alerta → confirmação
  manual → execução automática → tamanho real), todos desligados por padrão
  — ver `AI_BRAIN_SPEC.md` seção 9.1 e histórico (2026-07-31) pro detalhe dos
  módulos.
- **Pipeline de preço**: consolidado em `RealMarketDataService.ts` (única
  fonte real hoje). Vários serviços concorrentes antigos ainda existem no
  repo como código morto — não usados pelo caminho crítico, não removidos.
  Ganhou guarda de desvio máximo de preço + TTL de cache em 2026-08-21 (ver
  item 9 do histórico se precisar do detalhe).
- **Risco crônico conhecido**: a conta MetaAPI de plataforma é
  **compartilhada** entre todos os usuários — sujeita a rate-limit (HTTP
  429/504) sob carga. Sempre espaçar chamadas, nunca testar em paralelo
  contra ela.
- **NEXUS** (`supabase/functions/nexus-brain/`): assistente conversacional
  do produto, LLM real com tool-calling (não mock). Provedor trocável via
  secret `LLM_PROVIDER` (`nvidia` default, `groq`/`anthropic` disponíveis)
  sem redeploy — mas **secret sobrepõe default do código**, ver nota em
  "Ambientes e branches" acima.

## Cérebro de decisão da IA

**Fonte de verdade única, sempre ler antes de mexer no motor de decisão**:
[research/AI_BRAIN_SPEC.md](research/AI_BRAIN_SPEC.md).

**Status (fechado em 2026-07-30, revisado em 2026-08-02)**: busca sistemática
por edge de sinal técnico (5 presets × múltiplas cestas de ativos ×
timeframes, dezenas de sub-investigações com correção estatística DSR) **não
encontrou edge comprovado** — resultado consistente com mercado eficiente
pra indicador técnico clássico sobre preço público, não falta de tentativa.
**Decisão de produto do Cleber**: o produto segue intraday, cérebro
assumidamente de **execução e disciplina, não de alfa** — com edge ≈ 0, EV
por trade é ≈ `−custo`, logo o cérebro mais eficiente é o que opera menos.
ML entra só em previsão de volatilidade, nunca de direção. Trilho 2 (busca
de edge com dado estruturalmente diferente) fica pausado sem justificativa
nova. Rastro completo da investigação (seções 11-14 da spec, o que foi
testado e o resultado real de cada rodada): ver **seção "Cérebro de decisão
da IA — busca por edge de sinal" no [CLAUDE_HISTORY.md](CLAUDE_HISTORY.md)**.

**Gate obrigatório antes de qualquer commit que toque o motor**:
```bash
npm run validate
```
Roda type-check estrito do caminho crítico (`tsconfig.engine.json`) + ~40
asserções determinísticas (indicadores técnicos + motor SMC + gates de
risco). Mantido em ZERO erros de propósito — é o que torna esse gate
confiável em vez de ignorado.

## Pendências reais em aberto

Itens resolvidos entre 07-26 e 08-24 (Fase 0, decisão de escopo do Trilho
2, Estágios 1-4 de execução, componentes de risco, Marketplace, boleta de
ordem manual, Jarvis, custo de execução, gate de notícias, guarda de
desvio de preço, curva de equity, Parceiros IB B1-B3, Safe Mode em DEMO)
foram movidos pro histórico — ver
[CLAUDE_HISTORY.md](CLAUDE_HISTORY.md).

O que ainda está genuinamente em aberto:

0. **[ATIVO] Redesenho do cérebro de decisão.** Meta original de ~10
   trades/dia (fixada em 2026-08-04 sem medição por trás) foi testada por 3
   frentes de mais edge (TA clássico julho, score contínuo, arbitragem
   estatística — todas negativas) e por amplitude pura (multi-setup
   hipotético somando toda a cesta) — **nenhum cenário chega perto de
   10/dia com líquido positivo, teto real medido é ~2-6/dia**. Ver
   `research/experiments/2026-08-16-portfolio-amplitude/results/README.md`.
   Decisão de número final da meta revisada pendente do Cleber — ver
   `NEXT_SESSION.md`. Runner Deno (`supabase/functions/ai-runner/`) já
   rodando em produção desde então (superou o "ainda não rodou contra o
   Supabase de verdade" que era a pendência real até 2026-08-05/17).
   **[2026-08-25] Reaberto via NVIDIA NIM Signal Discovery + cuOpt Fase A**
   — ver item do topo deste arquivo, detalhe em
   `research/experiments/2026-08-25-trilho2-nim-signal-discovery/hypothesis.md`
   e `research/experiments/2026-08-25-cuopt-portfolio-optimization/hypothesis.md`.
1. Limpeza de pipelines de preço mortos (código morto, não bloqueante).
2. **Decisão pendente do Cleber (roteamento de cripto)**: manter Binance
   direto pra cripto (exceto BTCUSD, que já vai por MetaAPI) ou reverter tudo
   pra MetaAPI — nenhuma mudança de código feita, aguardando resposta.
3. Vários produtos do catálogo do Marketplace ainda têm
   rating/reviews/vendas fabricados (só o item mais grave, 'strat-001', foi
   removido).
4. **[2026-08-10] Modelo financeiro reconstruído, commit pendente.**
   `projecao-financeira-5anos.xlsx` — 3 cenários mês a mês, preços reais da
   landing, comissão em todos os tiers, pacote de 6 alavancas pra lucro no
   Ano 1. CAC/conversão/rebate ainda são meta, não medição. Detalhe:
   `SESSAO_2026-08-10_MODELO_FINANCEIRO.md`.
5. **[2026-08-17] Ideia registrada, não iniciada: probabilidade de acerto
   calibrada por entrada.** Hoje o `confidence` exibido é heurística não
   calibrada (documentado no código), nunca medida contra resultado real.
   Se retomado: projeto de pesquisa novo (dado, validação out-of-sample,
   calibration curve/Brier score), mesmo escopo do Trilho 2 (hoje pausado).
   Sem próximo passo definido.
6. **[2026-08-18] Programa de Parceiros IB — falta aplicar B4.** B1/B2/B3
   completos (ledger, captura de `?ref=`, marcos do funil). B4 (job de
   apuração periódica) escrito e deployado, mas migration
   `20260818_schedule_partner_commission_accrual.sql` **não aplicada**
   (falta Cleber trocar secret real no SQL Editor). Falta também
   `subscribed_at` (precisa sistema de pagamento). Detalhe:
   `SESSAO_2026-08-18_PROGRAMA_PARCEIROS_IB.md`.
7. **[2026-08-18] Risco estrutural: cliente e servidor decidem fechar
   posição em paralelo, com lógicas independentes.** Safe Mode em DEMO já
   foi neutralizado (não protegia nada de verdade, matava só a UX — ver
   histórico), mas a decisão maior — se o cliente deve perder autoridade de
   fechar trade em LIVE — **ainda não foi tomada**. Detalhe:
   `SESSAO_2026-08-17_BUGS_EXECUCAO_REAL_24_7.md`.

## Convenções do projeto

- Nunca fabricar dado (preço, indicador, resultado de backtest) — sempre erro
  explícito quando não há fonte real. Disciplina histórica do projeto, várias
  sessões passadas encontraram e removeram mock disfarçado de real.
- **Corrigir registro financeiro corrompido nunca é um `UPDATE` silencioso.**
  Motivo (2026-08-18): um trade fechado a preço 0 por bug de feed foi
  corrigido via `UPDATE` direto em `ai_trades` sem nenhum rastro no banco —
  grave porque os trades vão ser mostrados a investidor, e um `UPDATE` sem
  rastro em dado financeiro é indistinguível de manipulação pra esconder
  prejuízo, mesmo feito com boa intenção. Fix estrutural: `ai_trades_audit_log`
  (trigger `AFTER UPDATE`, grava a linha inteira antes/depois de qualquer
  edição) + colunas `corrected_at`/`correction_reason`/`original_values` em
  `ai_trades` — ver `supabase/migrations/20260818_add_ai_trades_audit_trail.sql`.
  Regra daqui pra frente: sempre que possível, corrigir um bug de motor que
  corrompeu dado fechando/anulando com um **registro novo** (ex: trade de
  ajuste explícito), não reescrevendo o original. Quando editar o original
  for mesmo necessário, sempre preencher `correction_reason`/`original_values`
  na mesma operação, nunca depois. Limite conhecido: o log de auditoria vive
  no mesmo Postgres de produção, não é imutável contra quem tem acesso de
  `service_role` — pra "à prova de investidor" de verdade falta exportar
  snapshots periódicos pra um destino write-once fora do Supabase (não
  implementado).
- Nunca prometer edge sem validação estatística (amostra mínima, walk-forward
  sem look-ahead, custo real descontado, correção por múltiplos testes). Ver
  `AI_BRAIN_SPEC.md` seção 8.
- Comunicação sempre em português do Brasil.
- **Padrão de rigor exigido pelo Cleber**: operar neste projeto como
  especialista sênior em mercado financeiro quantitativo, ciência da
  computação, matemática e estatística — e reportar resultado real sempre,
  mesmo quando ruim ou constrangedor. Nunca inflar número, nunca esconder
  achado negativo, nunca apresentar "melhora" sem holdout/correção
  estatística por trás. Isto não é tom, é método: toda alegação de edge
  precisa vir com o dado que a sustenta (ou a ausência dele, declarada).
