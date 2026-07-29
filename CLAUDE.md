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

**Gate obrigatório antes de qualquer commit que toque o motor**:
```bash
npm run validate
```
Roda type-check estrito do caminho crítico (`tsconfig.engine.json`) + 26
asserções determinísticas (indicadores técnicos + motor SMC). Mantido em
ZERO erros de propósito — é o que torna esse gate confiável em vez de
ignorado.

## Pendências reais em aberto

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
2. **Ponte decisão→execução real** (Fase B/3) — não existe no código ainda.
   **Desenho dos estágios decidido em 2026-07-27** (ver `AI_BRAIN_SPEC.md`
   seção 9.1): 4 estágios (alerta → confirmação manual → execução automática
   com hard-stop → remoção de trava de tamanho mínimo), disclaimer permanente
   de falta de edge nos estágios 1-2, módulo de código isolado (não reaproveita
   `useApexLogic.ts`), zero chamada à MetaAPI compartilhada até estágio 3,
   fechamento automático de posição quando o safe mode dispara, critério de
   avanço de estágio puramente operacional (nunca lucro). **Questão em aberto
   não decidida**: se vale avançar além do estágio 2 dado que não há edge
   comprovado — retomar antes de implementar o estágio 3. Nenhuma linha de
   código desta ponte foi escrita ainda.
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
