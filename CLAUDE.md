# Neural Day Trader — Estado do Projeto

> **Este arquivo foi reescrito em 2026-07-24 para ser enxuto.** O histórico
> completo de sessões (dezenas de investigações, bugs corrigidos, decisões
> antigas) está preservado em [CLAUDE_HISTORY.md](CLAUDE_HISTORY.md) — não é
> carregado automaticamente, consulte só se precisar do detalhe de algo
> específico do passado. Este arquivo carrega em toda sessão nova: mantenha
> enxuto. Regra de manutenção: quando uma seção de "pendente" for resolvida,
> resuma para 1-2 linhas ou mova o detalhe para o histórico — nunca deixe
> handoff completo de sessão se acumular aqui de novo.

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
  Function acessa). **Atualização (2026-07-29)**: "auth mock removido" acima
  estava desatualizado — `mockLogin` (`AuthContext.tsx`) ainda existia e era
  chamado em produção *depois* de todo login real (`App.tsx`), sobrescrevendo
  o `user.id` UUID real do Supabase por um valor fixo `'mock-user-123'` e
  persistindo isso em `sessionStorage`. Como `user_id` nas tabelas
  `ai_sessions`/`ai_trades`/`ai_portfolio_snapshots` é `uuid NOT NULL` com RLS
  `auth.uid() = user_id`, o efeito não era vazamento entre contas — era
  **falha de persistência para todo usuário logado** (erro de cast na
  inserção). Corrigido removendo a chamada a `mockLogin` do callback
  `onAuthenticated` em `App.tsx` (a sessão real já é setada pelo listener
  `onAuthStateChange` do próprio `AuthContext`). `mockLogin` continua existindo
  no `AuthContext` só disponível para um eventual modo demo explícito sem
  sessão real, não é mais acionado no fluxo de login de produção.
- **Persistência (Fase 2)**: sessões/trades/portfolio da IA em modo DEMO
  persistem no Supabase (`ai_sessions`/`ai_trades`/`ai_portfolio_snapshots`).
- **Execução real (Fase 3)**: `/broker/execute` existe e funciona (testado
  manualmente), com deploy/undeploy automático de conta MetaAPI por
  inatividade. **Mas o motor de decisão automático (`useApexLogic.ts`) nunca
  chama isso** — hoje só manipula estado local, mesmo em modo LIVE. A ponte
  decisão→execução real não existe ainda (ver seção do cérebro de IA abaixo).
- **Pipeline de preço**: consolidado em `RealMarketDataService.ts` (única
  fonte real hoje). Vários serviços concorrentes antigos (`DataSourceRouter`,
  `UnifiedMarketDataService`, `MetaApiService` etc.) ainda existem no repo
  como código morto — não usados pelo caminho crítico, não removidos ainda.
- **Risco crônico conhecido**: a conta MetaAPI de plataforma é
  **compartilhada** entre todos os usuários — sujeita a rate-limit (HTTP
  429/504) sob carga, inclusive de testes de sessão (curl em rajada já causou
  isso várias vezes no passado — sempre espaçar chamadas, nunca testar em
  paralelo contra ela).

## Cérebro de decisão da IA — trabalho em andamento

**Fonte de verdade única, sempre ler antes de mexer no motor de decisão**:
[research/AI_BRAIN_SPEC.md](research/AI_BRAIN_SPEC.md). Cobre: função
objetivo, arquitetura em camadas, arquétipos de estratégia, gate de
viabilidade por custo, envelope de risco, critérios de validação, e o
histórico de pesquisa/calibração (o que já foi testado e o resultado real).

**Estado resumido (2026-07-25)**: 5 estratégias-preset redesenhadas com fonte
de evidência declarada (`src/app/data/presetStrategies.ts`), motor de
ATR/Donchian real, custo de transação calibrado contra concorrência real. Uma
busca sistemática com correção estatística (Deflated Sharpe Ratio) testou 106
combinações de parâmetro em 4 arquétipos sobre BTCUSDT — **nenhum passou o
piso de edge comprovado**. Ensemble desses 4 sinais por peso de regime (seção
11.6/11.7) — **piorou** (DSR 0%, holdout -42%), revelou 2 dos 4 arquétipos
essencialmente o mesmo sinal (correlação 0,74). Repetida a mesma busca (106
combinações) em EURUSD real via MetaAPI (seção 11.8, hipótese #1 da 11.5) —
**falhou de novo, pior que em cripto**: 3 dos 4 campeões com Sharpe holdout
negativo. Refeito o ensemble numa versão limpa (seção 11.9): removida a
duplicação Donchian/Rompimento Confirmado (3 sinais agora genuinamente
decorrelacionados, correlação ≤0,05) e a saída original de cada arquétipo
preservada por posição, em vez de saída genérica única — **melhorou (DSR
29,2% vs. 0% da v1) mas ainda não passou o piso de 95%**, holdout do campeão
segue com Sharpe negativo. As 3 hipóteses da seção 11.5 (instrumento, sinal
único, reposicionamento de risco) estão todas exploradas agora
(11.5→11.7→11.8→11.9); nenhuma produziu edge comprovado. Ver seções 11-11.9 da
spec pro detalhe completo e os scripts reproduzíveis em
`research/experiments/2026-07-24-strategy-validation/`,
`research/experiments/2026-07-25-ensemble/`,
`research/experiments/2026-07-25-forex-major/` e
`research/experiments/2026-07-25-ensemble-v2/`.

**Atualização (2026-07-25, pooling cross-sectional)**: diagnóstico de que as
buscas anteriores podem ter sido subdimensionadas estatisticamente (holdout
de n=19-20 tem pouco poder pra detectar Sharpe moderado). Corrigido rodando
os mesmos parâmetros JÁ calibrados (sem grid search novo) sobre 7 pares forex
major pooled — Donchian confirma sem edge (n=80, DSR 34%), mas Cruzamento
EMA+ADX subiu pra DSR 85,3% (n=92, Sharpe pooled +0,110, +6,72%, positivo nos
7 pares individuais) — melhor resultado da investigação até então, ainda
abaixo do piso de 95%. Ver seção 11.10 do `AI_BRAIN_SPEC.md`.

**Atualização (2026-07-25, calendário estendido — seção 11.11)**: pendência
executada no mesmo dia. Estendido `yearsBack` de 3 para 10 anos (mesmo
script, zero ajuste de parâmetro), n_holdout pooled foi de 92 para 322
(passa do n≈226 calculado como suficiente). **Resultado reverteu, não
confirmou**: Sharpe pooled caiu de +0,110 para **-0,015**, DSR caiu de 85,3%
para **39,3% ❌**, só 3 dos 7 pares continuam com Sharpe holdout positivo (era
7 de 7). Leitura honesta: o DSR 85,3% da 11.10 não sobreviveu a mais dado —
mais provável que fosse resultado favorecido pela janela de calendário
específica (2023-2026) do que edge real. **Nenhum dos 2 arquétipos testados
na cesta forex major tem edge comprovado.** Fecha as hipóteses das seções
11.5→11.10 sem candidato à promoção.

**Atualização (2026-07-25, arquétipos restantes — seção 11.12)**: Cleber
escolheu testar os 3 presets ainda sem pooling (Reversão à Média, Rompimento
Confirmado, Scalp), mesma disciplina (zero ajuste, 10 anos desde já). **Todos
os 3 falharam com DSR 0,0%** — Reversão à Média (Sharpe pooled -0,311, 1/7
pares positivos), Rompimento Confirmado (-0,204, 0/7) e Scalp (**-1,032**,
0/7, pior resultado de toda a investigação). **Os 5 presets da spec estão
todos testados agora e nenhum tem edge comprovado.** Fecha a opção "testar
arquétipos novos" — não sobra mais nenhum preset não testado.

**Atualização (2026-07-25/26, cesta cripto ampliada — seção 11.13)**: Cleber
escolheu ampliar instrumentos (opção b), cripto adicional (BTCUSDT, ETHUSDT,
BNBUSDT, SOLUSDT, XRPUSDT, ADAUSDT, DOGEUSDT via Binance público). Primeira
rodada deu retornos absurdos em XRP/ADA/DOGE (até -80.161% agregado) — **bug
real encontrado e corrigido**: `estimateCostPercent('CRYPTO', ...)` em
`research/CostModel.ts` usava fórmula de custo calibrada pra forex/BTC-scale,
gerando até 136,7% de custo round-trip por trade em moedas sub-US$1 (DOGE a
US$0,073). Corrigido pra tratar custo cripto como % direto do preço (o
comentário da tabela já dizia isso desde 2026-07-24, nunca tinha sido
implementado). `npm run validate` passou 28/28 depois da correção. **Resultado
real depois de corrigir**: ainda nenhum arquétipo passa o piso de 95% DSR, mas
**Donchian em cripto é o melhor sinal de toda a investigação** — DSR 52,0%
(Sharpe pooled ~0,003, quase zero em vez de negativo, 4/7 pares positivos).
Scalp confirma ser o pior arquétipo (Sharpe pooled -3,36 em cripto limpo).
Ver seção 11.13 do `AI_BRAIN_SPEC.md` pro detalhe completo do bug e do
resultado.

**ENCERRAMENTO DA BUSCA POR EDGE DE SINAL (2026-07-30) — ler antes de propor
qualquer experimento novo de stop/alvo.** Ver `AI_BRAIN_SPEC.md` **seção 14**
(completa, com os números). Resumo do que ficou decidido:

- Testados 4 desenhos de saída sobre SMA40/100+pullback e 1 sobre rompimento
  Donchian(20/10) (diagnóstico MFE/MAE com n=4.058 + teste executável com custo
  real e contrato 0,01 BTC). O payoff assimétrico pedido pelo Cleber **é
  mecanicamente construível** (payoff ratio real 1,79x a 1,88x medido), mas o
  win rate cai exatamente na mesma proporção — EV bruto ≈ 0 em todos os
  desenhos, antes de qualquer custo.
- **Razão matemática, não empírica**: teorema da parada opcional. Stop e alvo
  escolhem a FORMA da distribuição de payoff, nunca a MÉDIA. Qualquer proposta
  futura do tipo "testar stop X com alvo Y" está **refutada a priori**, salvo se
  vier com evidência de que o sinal prevê **magnitude** condicional (não só
  direção). Não é preciso rodar o backtest pra saber o resultado.
- ~~**Gate de viabilidade por custo, quantificado**: custo round-trip 0,26%...~~
  **❌ DERRUBADO EM 2026-08-02 — ver seção 14.7 do `AI_BRAIN_SPEC.md`.** Os 0,26%
  eram ~8,9x o custo real de cripto CFD (o `commissionPercent: 0.08` era taxa de
  exchange **spot**, não CFD). Real: **0,0291%** round-trip; `CostModel.ts`
  corrigido. Com o custo certo, 15m gasta 2,8% do movimento e 1h gasta 1,2% —
  nenhum teste daquela sessão rodou abaixo do piso de viabilidade, ao contrário
  do que ficou registrado. Re-medindo o teste executável sobre os mesmos trades,
  1h pooled vira de −US$73,55 para +US$197,94. **Isto NÃO é evidência de edge**:
  nada passa o piso de 95% de DSR, e as amostras da seção 14 têm poder de 6,7% a
  29,1% — o veredicto passa de "medido como negativo" para "nunca medido com
  poder suficiente". Handoff completo das duas sessões de 02/08:
  `SESSAO_2026-08-02_GATES_VIABILIDADE.md` (diagnóstico) e
  `SESSAO_2026-08-02_CORRECAO_CUSTO_SECAO14.md` (correções aplicadas + próximo passo).
- **Erro metodológico nomeado**: a cesta de 7 criptos usada em 11.13 e nos testes
  de 2026-07-30 tem correlação 0,7-0,9 entre pares — é **~1,5 apostas
  independentes, não 7**. O pooling aumentou o `n` da mesma aposta, nunca a
  diversificação real.
- **DECISÃO DE PRODUTO DO CLEBER (2026-07-30): opção (B)** — o produto **segue
  intraday** e o cérebro é assumidamente de **execução e disciplina, não de
  alfa**. Recusada a opção (A) (trend-following diário/swing multi-classe, onde
  a convexidade comprovadamente vive, mas que exigiria reposicionar o produto
  pra fora de day trading).
- **Função objetivo do cérebro sob (B)**: minimizar perda por causa evitável,
  com burn rate mínimo e comportamento auditável. Com edge ≈ 0, EV por trade é
  ≈ `−custo`, logo **o cérebro mais eficiente é o que opera menos** (matemática,
  não conservadorismo). "Perde pouco" é garantível mecanicamente; "ganha muito"
  só condicionalmente. ML entra apenas em **previsão de volatilidade** (tratável,
  autocorrelacionada), **nunca de direção**.

**Gate obrigatório antes de qualquer commit que toque o motor**:
```bash
npm run validate
```
Roda type-check estrito do caminho crítico (`tsconfig.engine.json`) + 26
asserções determinísticas (indicadores técnicos + motor SMC). Mantido em
ZERO erros de propósito — é o que torna esse gate confiável em vez de
ignorado.

## Pendências reais em aberto

0. **Fase 0 (remover dado fabricado): CONCLUÍDA em 2026-07-29** — Auditoria
   sweep de ~60 arquivos com `Math.random()` encontrou 9 casos em que números
   aleatórios eram apresentados como capacidade real do sistema (latência,
   uptime, risco de cliente, força de correlação, sincronização com broker).
   Removidos: `SystemPerformance.tsx`, `QuantumChart.tsx`, `ButterflyMatrix.tsx`,
   `MarketScore.tsx`, `LiquidityDetector.tsx`, `ChartViewSimple.tsx`,
   `NeuralBridge.ts`, `liquiditySignals.ts`. Desativados/reescritos:
   `DefensiveArchitecture.tsx`, `MT5Validator.tsx`, `StrategyDashboard.tsx`,
   `LiquidityPrediction.tsx`, `UserIntelligence.tsx`, `QuantumAnalysis.tsx`.
   Motor de decisão intacto (`npm run validate` 28/28 ✅). Commit:
   "fix: remover dado fabricado (Math.random) da Fase 0 — auditoria completa".

1. **Decisão de escopo tomada em 2026-07-26: linha 11.5→11.15 fechada, sem
   candidato promovido.** 15 sub-investigações (5 presets × 2 cestas ×
   timeframes × Sharpe/Sortino) não encontraram edge em indicador técnico
   clássico sobre preço público — resultado consistente com mercado eficiente
   pra esse tipo de sinal, não falta de tentativa. **Produto agora tem 2
   pilares declarados**: (a) execução/gestão de risco disciplinada — vendável
   já, sem depender de edge de sinal; (b) busca de edge com dado
   estruturalmente diferente (order book cripto, calendário como filtro de
   regime, features cross-asset) — ver seção 13 do `AI_BRAIN_SPEC.md`
   ("Trilho 2"), com prazo-teto de 3-4 semanas e critério de corte explícito
   definido antes de começar. **Fase Real (dinheiro de usuário) não depende
   do sucesso do Trilho 2** — pode avançar só com o pilar (a). **Atualização
   (2026-07-27, seção 13.7)**: rodada etapa 0 (grátis, antes de pagar
   Tardis.dev/CoinAPI) testando proxy de fluxo de execução (CVD via
   `aggTrades` Binance) como triagem — 0 de 16 combinações ativo×horizonte
   passaram significância corrigida (Bonferroni) + consistência de sinal
   entre subjanelas. Não justifica gasto em dado pago agora. **Atualização
   (2026-07-27, seção 13.8)**: testada a alternativa grátis "calendário como
   filtro de regime" antes de decidir — bloqueada por falta de dado: não
   existe fonte grátis de calendário econômico com histórico acessível (só
   feed ao vivo da semana atual, sem arquivo de 60-90 dias), e hardcodar
   datas de memória foi descartado por violar a regra de nunca fabricar
   dado. **Decisão de Cleber (2026-07-27): produto foca 100% no pilar (a)
   agora.** Trilho 2 (busca de edge de sinal, pilar b) fica formalmente
   pausado, sem novo trabalho de pesquisa até haver justificativa nova (dado
   pago aceito conscientemente, ou nova fonte grátis viável).
2. **Ponte decisão→execução real (Fase B/3): Estágios 1-3 IMPLEMENTADOS em
   2026-07-31.** Desenho de 4 estágios (`AI_BRAIN_SPEC.md` seção 9.1): alerta
   → confirmação manual → execução automática com hard-stop → remoção de
   trava de tamanho mínimo. Implementados como módulos isolados (não
   reaproveitam `useApexLogic.ts`, só importam o tipo `TradeVisual`):
   `src/app/modules/liveAlertStage/useLiveAlertStage.ts` (Estágio 1, commit
   `fb57ea900`), `src/app/modules/tradeConfirmationStage/useTradeConfirmationStage.ts`
   (Estágio 2, commit `4073bb0fc`), `src/app/modules/autoExecutionStage/useAutoExecutionStage.ts`
   (Estágio 3, commit `eabb377dc`). Orquestrados em `TradingContext.tsx`
   (`forwardLiveDecision`, precedência Estágio 3 > 2 > 1), cada um com toggle
   próprio em `localStorage`, todos desligados por padrão — nenhuma
   progressão automática entre estágios existe no código, é decisão manual
   do usuário. Disclaimer permanente (`LIVE_ALERT_DISCLAIMER`) presente nos
   3 estágios. Estágio 3 usa sempre `asset.minLot` (ignora o `amount`
   calculado pelo motor) e não reimplementa hard-stop — confia no Health
   Check Guardian/kill-switch de `useApexLogic.ts` (ver item abaixo) pra
   fechar posição já aberta. **Estágio 4 IMPLEMENTADO em 2026-07-31**
   (mesma sessão da correlação ao vivo/cooldown abaixo): módulo isolado
   `src/app/modules/fullSizeExecutionStage/useFullSizeExecutionStage.ts` —
   usa `amountToLotSize(decision.amount)` (tamanho real do motor) em vez de
   `asset.minLot`, exige o Estágio 3 ligado como pré-requisito rígido
   (checado dentro do próprio hook e em `TradingContext.tsx`, que desliga o
   4 automaticamente se o 3 for desligado), mesmo disclaimer permanente,
   desligado por padrão, precedência 4>3>2>1 em `forwardLiveDecision`. UI em
   `FullSizeExecutionPanel.tsx`, montada em `AITrader.tsx`. Só validado via
   `npm run validate` (type-check + os testes puros existentes cobrem os
   outros módulos) — **ainda não testado no navegador**, mesma ressalva do
   Estágio 3. Detalhe completo em `SESSAO_2026-07-31_PONTE_EXECUCAO.md`.
5. **Componentes do cérebro de execução (pilar A).** **Achado de 2026-07-30
   (2ª sessão)**: o `RISK_MODULE_SPEC.md` estava desatualizado — ele descreve
   `RiskRules`/`evaluateRiskGate` como "proposto, não implementado", mas
   `useApexLogic.ts` **já tinha**, antes desta sessão, um `RiskManager` real
   (`src/lib/modules/RiskManager.ts`, daily loss limit + drawdown + kill-switch
   síncrono pré-trade), **sizing por ATR** (`aiConfig.positionSizingMode ===
   'ATR'`, ~linha 1631) e um **guard de correlação por grupo estático**
   (`aiConfig.correlationGuardEnabled`, ~linha 1647) — ou seja, os
   Componentes 2 e 3 da lista abaixo já estavam parcialmente implementados
   antes de qualquer trabalho desta sessão. Não confiar no `RISK_MODULE_SPEC.md`
   sem checar o código antes de reportar o que existe.
   Ordem de prioridade acordada com o Cleber: (1) **gate de viabilidade por
   custo** — recusa operar onde o custo devora o movimento esperado.
   **Implementado e LIGADO no motor em 2026-07-30**:
   `src/app/services/risk/CostViabilityGate.ts` (função pura
   `evaluateCostViability(costPercent, typicalMovementPercent)`, limiares
   7%/12% calibrados pra reproduzir a coluna "Viável?" da tabela 14.3) +
   `__validate__.ts` (14 asserções, na suíte do `npm run validate`) + chamada
   real em `useApexLogic.ts`, logo após o filtro de direção e antes do
   `RiskManager`, antes de qualquer entrada. **Diferença importante da
   medição original**: a tabela 14.3 mede "movimento típico" como MFE
   (Maximum Favorable Excursion) do backtest, só calculado pra BTCUSDT — não
   dá pra extrapolar pra outro ativo sem medição própria (regra de nunca
   fabricar dado). A integração ao vivo usa **ATR(14) real do candle buffer**
   como proxy de volatilidade/movimento por ativo — é uma aproximação
   deliberada (ATR ≠ MFE), não a mesma métrica calibrada. Classe de custo por
   ativo reaproveita `SymbolMappingService.findMapping().type`
   (forex/crypto/commodity/index/stock); forex sempre cai em FOREX_MAJOR
   (mais barato) por falta de granularidade minor/exotic nesse mapeamento —
   pode SUBESTIMAR custo em pares forex minor/exotic reais, registrado como
   aproximação nos comentários do código, não medido. (2) **sizing
   condicional à volatilidade** — já existe (ver achado acima), modo ATR
   opcional via `aiConfig.positionSizingMode`; (3) **detector de correlação
   real de portfólio — IMPLEMENTADO em 2026-07-31**:
   `src/app/services/risk/LiveCorrelationGuard.ts` (`computeLiveCorrelationGuard`,
   Pearson real sobre log-returns, candle real reaproveitado do mesmo
   `candleBufferRef` que `useApexLogic.ts` já mantém por ativo — sem chamada
   de rede extra) + `__validate__correlation__.ts` (16 asserções). Bloqueia
   (não só reduz tamanho) a nova entrada quando a correlação real com uma
   posição já aberta ultrapassa `aiConfig.correlationThreshold`. Decisão
   registrada em comentário no código: o guard heurístico antigo por grupo
   estático (`getCorrelationGroup`) foi MANTIDO como fallback — quando não há
   candle real suficiente no buffer pra algum par, o módulo novo recusa
   calcular (`insufficientData`) e o motor cai de volta pro heurístico em vez
   de operar sem guard nenhum. Também IMPLEMENTADO nesta sessão: cooldown
   pós-perdas-consecutivas + limite rígido de trades/dia
   (`RISK_MODULE_SPEC.md` 3.3/3.4) — a lógica já estava inline em
   `useApexLogic.ts` de sessão anterior (achado ao ler o código antes de
   mexer), extraída pra funções puras testáveis
   (`evaluateCooldownGate`/`evaluateMaxTradesPerDayGate` em
   `RiskManager.ts`) + 12 asserções em `__validate__cooldown__.ts`, sem mudar
   comportamento. (4) **hard stop + daily loss limit — AUDITADO em 2026-07-30,
   achado real de burla**: o Health Check Guardian (`useApexLogic.ts`,
   intervalo de 5s) e o Kill-Switch síncrono (`riskManager.shouldActivateKillSwitch`,
   chamado só na hora de avaliar uma ENTRADA nova) só impedem *abrir* trade
   novo — nenhum dos dois fecha posição real já aberta na corretora. O
   Kill-Switch chama `setActiveOrders([])`, que só limpa o estado local
   (rastreamento de DEMO), nunca chama a corretora. Para trades LIVE reais, a
   única via de abertura é o Estágio 2 (`useTradeConfirmationStage.ts`,
   confirmação manual → `/broker/execute` via `BrokerClient.ts`); quando safe
   mode/kill-switch dispara, esse módulo só cancela confirmações AINDA
   PENDENTES — não fecha posições já executadas na MetaAPI. `BrokerClient.ts`
   já expõe `closePosition`/`closeAllPositions` (chamam `/broker/execute` com
   `action: 'closePosition'`/`'closeAllPositions'`), mas essas funções só são
   chamadas por um componente de teste manual (`LiveTradingTest.tsx`) — nunca
   automaticamente pelo `RiskManager` ou pelo Health Check Guardian.
   **Conclusão: o hard stop hoje é "não-burlável" só contra a IA abrir
   posição nova; uma posição LIVE já aberta no momento em que o limite é
   violado fica sem gestão automática até o usuário intervir manualmente.**
   **Fix IMPLEMENTADO em 2026-07-31** (commit `768356c93`):
   `src/app/services/risk/LiveEmergencyClose.ts` →
   `forceCloseAllLivePositions()` — retry com backoff exponencial (5
   tentativas) chamando `closeAllPositions()` de `BrokerClient.ts`, e depois
   de cada tentativa confirma via `getPositions()` que não sobrou posição
   aberta antes de reportar sucesso (nunca assume "fechado" só pelo
   `result.success`). Chamado nos dois pontos do achado — Health Check
   Guardian (~linha 965-980 de `useApexLogic.ts`) e kill-switch síncrono
   (~linha 1686-1701) — só quando `executionMode === 'LIVE'`; se esgotar as
   tentativas sem confirmar, dispara toast persistente (`duration: 0`)
   pedindo intervenção manual, nunca finge sucesso. Ainda não testado em
   ambiente real (só `npm run validate`); (5) **diagnóstico de eficiência de saída —
   IMPLEMENTADO em 2026-07-30** (análise retrospectiva, zero previsão):
   `src/app/services/analysis/TradeEfficiencyDiagnostic.ts`. Reconstrói
   MFE/MAE real de cada trade fechado do usuário buscando candle real
   (`backtestDataService`) na janela entrada→saída (mesma fórmula de
   excursão do `BacktestEngine.ts`), reporta `exitEfficiency` (quanto do MFE
   foi capturado no resultado realizado) e `gaveBackPercent` por trade +
   agregado. `__validate__.ts` cobre a parte pura (13 asserções, entra em
   `npm run validate`); a busca de candle real não tem teste automatizado
   ainda (mesma exceção do resto da suíte). **LIGADO À UI em 2026-07-31**:
   `TradeEfficiencyPanel.tsx` (novo, `src/app/components/performance/`),
   montado em `Performance.tsx` logo após o histórico de trades — chama
   `diagnoseClosedTrades` sob demanda (botão, não automático a cada render,
   por causa do custo de rede), mostra `exitEfficiency`/`gaveBackPercent`
   por trade + agregado, texto explícito "análise RETROSPECTIVA", estado
   vazio honesto quando não há trade fechado suficiente.
6. **Marketplace.tsx — RESOLVIDO em 2026-07-31**: o item 'strat-001'
   ("Neural Scalper Pro", 87% win rate fabricado + rating/reviews/vendas
   hardcoded) foi REMOVIDO do catálogo (decisão registrada em comentário no
   código). Os demais produtos do catálogo continuam com rating/reviews/
   vendas fabricados — não tratado nesta sessão (fora do escopo pedido,
   `Product` exigiria campos opcionais pra tratar sem remover os outros
   itens também).
3. Limpeza de pipelines de preço mortos (código morto, não bloqueante).
4. ~~`node_modules` versionado no git (282MB no `.git`, 81 mil arquivos)~~ —
   **resolvido em 2026-07-25**: removido do índice + adicionado ao
   `.gitignore` (commit `chore: remove node_modules do controle de versão`).
   `.git` local ainda carrega o histórico antigo com esses blobs — `git gc`
   opcional se o tamanho incomodar, não urgente.

## Convenções do projeto

- Nunca fabricar dado (preço, indicador, resultado de backtest) — sempre erro
  explícito quando não há fonte real. Disciplina histórica do projeto, várias
  sessões passadas encontraram e removeram mock disfarçado de real.
- Nunca prometer edge sem validação estatística (amostra mínima, walk-forward
  sem look-ahead, custo real descontado, correção por múltiplos testes). Ver
  `AI_BRAIN_SPEC.md` seção 8.
- Comunicação sempre em português do Brasil.
- **Padrão de rigor exigido pelo Cleber (2026-07-25)**: operar neste projeto
  como especialista sênior em mercado financeiro quantitativo, ciência da
  computação, matemática e estatística — e reportar resultado real sempre,
  mesmo quando ruim ou constrangedor (ex: seção 11.7, ensemble que piorou).
  Nunca inflar número, nunca esconder achado negativo, nunca apresentar
  "melhora" sem holdout/correção estatística por trás. Isto não é tom, é
  método: toda alegação de edge precisa vir com o dado que a sustenta (ou a
  ausência dele, declarada).
