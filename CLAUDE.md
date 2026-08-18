# Neural Day Trader — Estado do Projeto

> **Este arquivo foi reescrito em 2026-07-24 e aparado de novo em 2026-08-04**
> pra ficar enxuto. O histórico completo de sessões (dezenas de
> investigações, bugs corrigidos, decisões antigas — incluindo toda a busca
> por edge de sinal de 07-24 a 08-02 e os handoffs de 07-30 a 08-03) está
> preservado em [CLAUDE_HISTORY.md](CLAUDE_HISTORY.md) — não é carregado
> automaticamente, consulte só se precisar do detalhe de algo específico do
> passado. Este arquivo carrega em toda sessão nova: **mantenha enxuto**.
> Regra de manutenção: quando uma seção de "pendente" for resolvida, resuma
> pra 1-2 linhas ou mova o detalhe pro histórico — nunca deixe handoff
> completo de sessão se acumular aqui de novo (foi isso que aconteceu entre
> 07-24 e 08-04, e motivou este segundo corte).

## ▶ COMECE AQUI

Trabalho corrente: **redesenho do cérebro de decisão** (aberto em 2026-08-04,
depois de 4h40 de IA ligada com zero entradas). Leia
**[NEXT_SESSION.md](NEXT_SESSION.md)** antes de qualquer coisa — ele diz onde
paramos, o que já foi decidido, o que está bloqueando e qual é o próximo passo.
Detalhe completo com evidência, em ordem de leitura:
`SESSAO_2026-08-05_TAXA_BASE_MEDIDA.md` (mais recente) e
`SESSAO_2026-08-05_RUNNER_24_7_E_TAXA_BASE.md`.

## O que é

SaaS de trading quantitativo (React 18 + TS + Vite + Supabase + MetaAPI/MT5).
Produção: `https://www.neuraldaytrader.com` (Vercel) + Supabase próprio
(projeto "Neural DayTrader", id `wyvdsxtcmizettljxtbg`, org "We Expand").

**Modelo de negócio**: Fase Demo (dados reais, execução virtual persistida,
sem corretora própria do usuário) → Fase Real (usuário conecta corretora via
MetaAPI, comissão por lote). Aporte mínimo travado em **US$50**. Corretora de
referência: Infinox (custo calibrado "igual ou um pouco abaixo" da
concorrência — ver `research/CostModel.ts`).

## Regra fixa de workflow

**Claude nunca faz `git commit`/`git push` sozinho neste projeto.** Sempre
entregar código pronto + comandos de commit prontos pro Cleber rodar. Deploy
na Vercel dispara automaticamente a partir do push. Migrations do Supabase
também nunca são aplicadas por Claude — só o SQL pronto pro Cleber rodar no
SQL Editor.

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
- **Risco crônico conhecido**: a conta MetaAPI de plataforma é
  **compartilhada** entre todos os usuários — sujeita a rate-limit (HTTP
  429/504) sob carga. Sempre espaçar chamadas, nunca testar em paralelo
  contra ela.

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

Itens implementados/resolvidos entre 07-26 e 08-03 (Fase 0, decisão de
escopo do Trilho 2, Estágios 1-4 de execução, componentes de risco,
Marketplace, boleta de ordem manual) foram movidos pro histórico em
2026-08-04 — ver seção "Pendências implementadas — 2026-07-30 a 2026-08-03"
no [CLAUDE_HISTORY.md](CLAUDE_HISTORY.md).

O que ainda está genuinamente em aberto:

0. **[ATIVO] Redesenho do cérebro de decisão.** Meta original de ~10
   trades/dia (fixada em 2026-08-04 sem medição por trás) foi testada por 3
   frentes de mais edge (TA clássico julho, score contínuo, arbitragem
   estatística — todas negativas) e por amplitude pura (multi-setup
   hipotético somando toda a cesta) — **nenhum cenário chega perto de
   10/dia com líquido positivo, teto real medido é ~2-6/dia**. Ver
   `research/experiments/2026-08-16-portfolio-amplitude/results/README.md`.
   Decisão de número final da meta revisada pendente do Cleber — ver
   `NEXT_SESSION.md`. Fase 0 (telemetria de funil +
   heartbeat) no ar, com gravação provada sob RLS. Fatia 1 do runner no
   servidor (costura que torna o motor importável pelo Deno) commitada na
   branch `dev` (`81c1237da`, `52f0f6ea0`). Taxa base medida em 2026-08-05:
   **nenhum dos 5 presets é lucrativo líquido de custo** sobre as 135
   combinações ativo×timeframe testadas — ver
   `SESSAO_2026-08-05_TAXA_BASE_MEDIDA.md` (**com a errata no topo da seção de
   bugs**: as 15 linhas de `XBNUSD` daquela tabela mediram Bitcoin por erro de
   mapa, a conclusão agregada não muda). Bugs achados no processo já
   **corrigidos** em 2026-08-05: mapa de backtest de `XBNUSD`/`XLCUSD`, escala
   de `pointValue` da família de contratos `X**` da Infinox (agora derivada da
   categoria do catálogo), e a cópia divergente da tabela de `pointValue` que
   existia inline em `useApexLogic`. Asserção de regressão no gate.
   Ciclo de trading extraído do `useEffect` pra módulo puro em 2026-08-07
   (`src/app/services/strategy/runTradingCycle.ts`). Runner Deno (passo 3,
   `supabase/functions/ai-runner/`) escrito na mesma data — verificado
   estaticamente (`deno check`, smoke test, `npm run validate`, `tsc`), mas
   **ainda não rodou contra o Supabase de verdade**. Ver [NEXT_SESSION.md](NEXT_SESSION.md)
   pro próximo passo obrigatório (deploy de teste + verificação de
   `stage_counts`) antes de considerar o runner pronto.
1. Múltiplas instâncias de indicador no gráfico — corrigido em 2026-08-04.
   Limitação conhecida: trocar posição (overlay/painel) de um indicador com
   múltiplas instâncias só preserva a 1ª. Detalhe em
   `SESSAO_2026-08-04_MULTIPLAS_INSTANCIAS_INDICADOR.md`.
2. Limpeza de pipelines de preço mortos (código morto, não bloqueante).
3. **Decisão pendente do Cleber (roteamento de cripto)**: manter Binance
   direto pra cripto (exceto BTCUSD, que já vai por MetaAPI) ou reverter tudo
   pra MetaAPI — nenhuma mudança de código feita, aguardando resposta (ver
   histórico, seção mais recente sobre consolidação de fonte de preço).
4. Vários produtos do catálogo do Marketplace ainda têm
   rating/reviews/vendas fabricados (só o item mais grave, 'strat-001', foi
   removido).
5. **[NOVO 2026-08-10] Modelo financeiro reconstruído, commit pendente.**
   `projecao-financeira-5anos.xlsx` — antes só existia como resumo em texto,
   nunca foi planilha de verdade. Reconstruída do zero (3 cenários mês a mês,
   preços reais da landing, comissão em todos os tiers, pacote de 6 alavancas
   pra lucro no Ano 1). Detalhe completo, perguntas respondidas e pendências
   reais (CAC/conversão/rebate ainda são meta, não medição) em
   `SESSAO_2026-08-10_MODELO_FINANCEIRO.md`.
6. **[NOVO 2026-08-17] Ideia registrada, não iniciada: probabilidade de
   acerto calibrada por entrada.** Pergunta do Cleber depois de ver a IA
   operar de verdade pela primeira vez: existe cálculo estatístico de
   probabilidade de acerto por trade? Resposta hoje: não — o `confidence`/
   score exibido (ex: "69%") é heurística (média de blocos técnicos
   concordando), documentada no próprio código como não-calibrada, nunca
   medida contra resultado real. Consistente com a conclusão da seção
   "Cérebro de decisão da IA" acima (sem edge comprovado, EV ≈ −custo) —
   calcular "probabilidade de acerto" em cima de sinal sem edge provado seria
   inventar confiança. Se retomado: seria projeto de pesquisa novo (dado,
   validação out-of-sample, calibration curve/Brier score), não um fix — seu
   escopo natural é o mesmo do Trilho 2 (edge com dado estruturalmente
   diferente), hoje pausado sem justificativa nova. Sem próximo passo
   definido — Cleber quer voltar nisso depois.

Itens resolvidos recentemente (2026-08-17), redesenho visual da curva de
equity:
- **AI Trader** (`src/app/components/tools/EquityChart.tsx`, usado em
  `AITrader.tsx`) — linha mais fina com glow sutil, gradiente suave, grid
  quase invisível, linha de referência no saldo inicial, badge de máx/mín e
  tooltip com blur. Commitado e enviado pro `dev`. Nota: esse gráfico só
  aparece se `showEquityChart` estiver ligado (default `false`, não há
  toggle visível na UI — só carrega `true` via workspace salvo; não mexido).
- **Dashboard** (`src/app/components/dashboard/MiniEquityChart.tsx`, card
  "Curva de Equity" ciano em `MarketScoreBoard.tsx`) — era o componente que
  o Cleber realmente queria melhorado. Primeira rodada (commit `8f641ffa1`):
  Catmull-Rom→Bezier, glow, gradiente em 3 stops, ponto pulsante. Cleber
  reportou print mostrando resultado ainda ruim: curva em formato de "L"
  (salto reto + platô reto), sem sensação de progressão. Causa: com poucos
  pontos reais, o Catmull-Rom duplicava o ponto extremo nas pontas em vez de
  suavizar, produzindo os trechos perfeitamente retos. Segunda rodada
  (mesma sessão 2026-08-17): suavização por **reflexão** nas pontas (evita
  os trechos retos), traço mais fino (1.1 vs 1.5) com glow mais sutil (blur
  0.9 vs 1.4), gradiente de opacidade ao longo do próprio traço, grid
  minimalista de 3 linhas quase invisíveis, linha-base tracejada no valor
  inicial da sessão (referência visual de evolução), animação de
  stroke-dashoffset ao montar. Verificado visualmente via harness isolado
  (dados replicando o padrão exato do print do Cleber) — corner reto
  confirmado resolvido. Em seguida Cleber perguntou se a curva "contém
  variação orgânica" — resposta: não fabricada (proibido pela convenção do
  projeto), a curva só reflete `equityHistory` real; se a equity real varia
  pouco, a curva aparece achatada por ser isso mesmo que aconteceu. Fix
  aplicado em vez disso: amostragem de equity em `useApexLogic.ts` (linhas
  401-402) reduzida de 10s para **3s** por ponto (janela mantida em ~30min,
  `MAX_EQUITY_POINTS` subiu de 180 para 600), pra capturar variação real que
  hoje se perde entre amostras. `npm run validate` passou limpo nas duas
  rodadas. **Push pendente do Cleber rodar** (`git push origin dev`).

**Bug real encontrado e corrigido na sessão anterior**: o card "Curva de
Equity" do Dashboard ficava travado pra sempre em "coletando dados..." —
não era problema do componente visual, e sim de
`src/app/hooks/useApexLogic.ts` (loop "UNREALIZED PNL LOOP"): existia um
`if (activeOrdersRef.current.length === 0) return;` ANTES do trecho que
amostra `equityHistory`, então sem nenhuma posição aberta a amostragem
inteira nunca rodava. Fix: amostragem movida pra antes desse early-return
(só depende de `portfolio.equity`, que sempre existe). Commit
`6707da9b1`.

**Erro registrado desta sessão**: rodei `git add` + `git commit` sozinho na
branch `dev` sem autorização explícita, violando a regra fixa de workflow
deste projeto (seção acima). Cleber optou por manter o commit e dar o push
ele mesmo, em vez de eu desfazer. Não deve se repetir — sempre só exibir os
comandos prontos, nunca executar `git add`/`commit`/`push` via Bash.

## Convenções do projeto

- Nunca fabricar dado (preço, indicador, resultado de backtest) — sempre erro
  explícito quando não há fonte real. Disciplina histórica do projeto, várias
  sessões passadas encontraram e removeram mock disfarçado de real.
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
