# Plano — Scorecard de performance por ativo (realocação de peso, não exclusão)

> Handoff/design doc. Nada implementado ainda — é o desenho técnico pra
> avaliação do Cleber antes de qualquer código. Continua a linha de trabalho
> aberta em `SESSAO_2026-08-21_PLANO_CALIBRACAO_GATES.md` (Passo 1 já medido
> lá), mas muda de direção depois da conversa desta sessão: **não excluir
> ativo permanentemente** (mercado é essencialmente aleatório, ativo ruim
> numa janela não é ativo ruim pra sempre) — em vez disso, **medir
> performance realizada recente por ativo e realocar frequência/peso pra
> onde está funcionando agora**, com trava estatística contra perseguir
> ruído.

## A ideia, em uma frase

O cérebro não sabe prever qual ativo vai bem — mas pode **medir, rápido e
honestamente, qual ativo está indo bem agora** com o próprio histórico de
trades reais, e inclinar a alocação nessa direção sem nunca fechar a porta
de nenhum ativo.

## Por que não é "achar edge disfarçado"

Isso não promete direção de preço (o que a investigação de edge já mostrou
não ter — `AI_BRAIN_SPEC.md`). É controle de risco/execução reagindo a
variância recente do próprio motor, a mesma categoria que o `CLAUDE.md` já
define como o papel certo do cérebro. A armadilha a evitar é a mesma do
`confidence` heurístico (item 6 do `CLAUDE.md`): com amostra pequena,
"parece bom" é ruído, não sinal. Por isso o desenho tem **gate de
significância mínima** como peça central, não opcional.

## Onde isso se encaixa no código (levantado nesta sessão)

- **Cesta de ativos ativos**: `aiConfig.activeAssets`
  (`src/app/types/tradingState.ts:136`), lido em
  `runTradingCycle.ts:259`, filtrado em `universe` (259-279), **ranqueado
  todo ciclo** por `rankCandidates()` (linha 303, definida 489-531).
- **Não existe hoje nenhum multiplicador de peso por ativo** — só um
  `score` por símbolo (via `evaluateStrategyScoreBothSides`, linha 513),
  ordenado decrescente (linha 530), e o loop de execução
  (`for (const candidate of ranked)`, linha 326) abre o primeiro que passa
  todos os gates. **Ponto de inserção natural**: multiplicar o `score` de
  cada candidato por um fator do scorecard, antes do `.sort()` da linha
  530 — sem nunca zerar (isso preservaria a ordem entre ativos bons, só
  empurraria os ruins pro fim da fila, não pra fora dela).
- **Gravação de trade/decisão**: só via `AITradingPersistenceService`
  (`saveTrade`/`updateTrade`, `saveDecision`) — hook de "registrar
  resultado pro scorecard" mais natural é logo após `updateTrade()`
  (fechamento de trade).
- **Padrão de job periódico**: `supabase/functions/partner-commission-accrual/`
  + migration com `cron.schedule(...)` — modelo a replicar pro job que
  recalcula o scorecard.
- **Nenhum gate hoje recebe um "contexto por símbolo" compartilhado**
  (`CostViabilityGate`/`ContextGate` recebem argumentos numéricos ad hoc,
  chamados inline em `analyzeAsset`). O scorecard não deveria virar mais um
  gate binário nesse padrão — deveria ser o multiplicador de `score` dentro
  de `rankCandidates()`, categoria diferente (realocação de peso, não
  veto).

## Desenho

### 1. Métrica: o que conta como "indo bem"

Não só win rate bruto (com payoff assimétrico ~2,6:1 medido na sessão
overnight, um ativo pode ganhar com 35% de acerto). Usar **PnL líquido
médio por trade** na janela como métrica primária, com **limite inferior
de confiança** em vez do valor bruto — evita que 2 trades sortudos pareçam
"ótimo ativo":

```
score_ajustado = média(net_pnl da janela) − z * (desvio_padrão / sqrt(n))
```
(equivalente a um limite inferior de intervalo de confiança ~90-95% sobre o
PnL médio — ativo só pontua acima do neutro se a banda de baixo do
intervalo já for positiva, não só a média)

### 2. Gate de amostra mínima (a peça que evita repetir o erro do `confidence`)

- `n_trades_janela < MIN_AMOSTRA` (proposta inicial: 20 trades fechados,
  a validar com o próprio dado — abaixo disso, hoje a maioria dos ativos
  nem chega perto, ver 1.3 da medição anterior) → multiplicador = **1,0
  (neutro)**, nenhuma influência. Sem exceção.
- Só acima do mínimo o multiplicador pode se afastar de 1,0.

### 3. Janela: rolante, não permanente

- Janela por **contagem de trades** (ex: últimos 30-50 fechados por
  símbolo), não por tempo — ativo líquido acumula amostra mais rápido,
  ativo raro (ex: um índice que opera pouco) não fica anos preso a um
  resultado velho.
- Decaimento: trade sai da janela conforme envelhece (janela deslizante
  simples) — isso já entrega "surpreender a qualquer momento": se o ativo
  virar de ruim pra bom, a amostra nova empurra o multiplicador de volta
  pra cima sem intervenção manual.

### 4. Multiplicador: contínuo e limitado, nunca zero

- Mapear `score_ajustado` (normalizado, ex: em desvios-padrão da média
  global de todos os ativos) pra um multiplicador em faixa fixa, ex:
  **[0,6× — 1,5×]** aplicado ao `score` de ranking em `rankCandidates()`.
- Nunca chega a 0 — o pior cenário é o ativo cair pro fim da fila de
  prioridade no ciclo (menos frequência, nunca exclusão). Se nenhum ativo
  "bom" tiver candidato válido no ciclo, o ativo "ruim" ainda pode ser
  escolhido — preserva exatamente o "pode surpreender a qualquer momento"
  que o Cleber pediu.

### 5. Onde vive o cálculo

- **Job periódico** (não em tempo real por ciclo, pra não consultar
  `ai_trades` a cada tick): nova Edge Function
  `supabase/functions/asset-performance-scorecard/`, mesmo padrão do
  `partner-commission-accrual` — cron a cada N minutos/horas (a decidir;
  overnight já gera ~1 trade a cada ~10-20min por ativo ativo, não precisa
  ser por minuto).
- Escreve numa tabela nova `asset_performance_scorecard` (symbol, user_id,
  n_trades, media_pnl, limite_inferior, multiplicador, updated_at).
- `runTradingCycle.ts` lê essa tabela (via `deps`, cache leve por ciclo,
  não uma query nova por candidato) e aplica o multiplicador em
  `rankCandidates()`.

## O que precisa de validação antes de ir pra produção (regra fixa do projeto)

- Backtest com split treino/holdout cronológico: rodar a lógica do
  scorecard sobre o histórico de `ai_trades` já existente, comparar PnL
  agregado simulado com vs. sem o multiplicador — não assumir que
  "realocar pra quem foi bem" melhora resultado sem medir (pode até
  piorar, se o mercado for tão aleatório quanto a própria tese do Cleber
  diz).
- Escolher `MIN_AMOSTRA` e a faixa do multiplicador **a partir do dado**,
  não de intuição — checar quantos ativos hoje sequer atingiriam o mínimo
  numa janela realista.
- `npm run validate` obrigatório antes de qualquer commit que toque
  `runTradingCycle.ts`.
- Correção por múltiplos testes se mais de uma configuração
  (janela/limiar/faixa) for comparada.

## Próximos passos concretos (nenhum implementado ainda)

1. Medir, com dado real de `ai_trades`, quantos trades fechados por
   símbolo existem hoje e há quanto tempo — decide se `MIN_AMOSTRA` de 20-50
   é realista ou se precisa esperar mais dado acumular primeiro.
2. Prototipar o cálculo do multiplicador (item 1-4 acima) como função pura
   testável, rodar contra o histórico existente (backtest simples, sem
   mexer no motor ainda).
3. Só depois de 1-2 mostrarem resultado líquido melhor (ou pelo menos não
   pior) no holdout, desenhar a integração real em `rankCandidates()` +
   job da Edge Function + migration da tabela nova.

## Métrica de sucesso deste trabalho

Mesma lógica do plano anterior: não é win rate global subir — é o PnL
agregado do backtest com scorecard bater o PnL agregado sem scorecard, e
a variância (desvio padrão do PnL por trade) cair.

## Passos 1-3 executados em 2026-08-21 — resultado: dado insuficiente, não integrar ainda

Protótipo em
[research/experiments/2026-08-21-asset-scorecard/scorecard.ts](research/experiments/2026-08-21-asset-scorecard/scorecard.ts)
(função pura `computeSymbolScorecard`/`computeScorecardSnapshot`/
`walkForwardMultiplierSeries`, testável isoladamente, `npx tsx scorecard.ts`).

**Passo 1 (medição)**: com `MIN_AMOSTRA=20` (proposta original), só 2 de 12
símbolos ativos (BTCUSD n=24, XAUUSD n=23) atingem o mínimo — todo o resto
fica travado em multiplicador neutro por semanas. Cadência recente
(~1-8 trades/dia por símbolo nos dias mais ativos) significa que uma janela
de 20 levaria 1-3 semanas pra se formar, longo demais pro objetivo de
"surpreender a qualquer momento". Achado incidental: **SPX500 tem dado
contaminado** por bug antigo de escala de quantidade (10→754→3893 no mesmo
símbolo, PnL de -950 destoando de tudo mais que é sub-$20, trade de -3810
com gap de preço 6010→7536 em julho) — excluído do dataset de teste, não
investigado a fundo (não bloqueia este trabalho, mas é sintoma do mesmo tipo
de bug já visto em `pointValue` — vale checar se ainda afeta produção).

**Passo 2 (protótipo + sensibilidade)**: função implementada com
`score_ajustado = média − z·(stddev/√n)` mapeado por `tanh` pro range
[0,6×-1,5×]. Achado não previsto no plano original: o parâmetro
`scaleDenominator` (escala do `tanh`) não tinha proposta de valor — testado
com fixos (1,2,3,5,8) e com valor derivado do próprio dado (stddev pooled do
PnL entre símbolos qualificados, ≈6,75 nesta amostra). Com denominador
data-driven, quase todos os multiplicadores ficam comprimidos perto de 1,0×
(0,90-1,01×) porque o ruído por trade (desvio ~$1-2 na maioria dos símbolos)
é grande relativo à diferença de médias entre símbolos — a fórmula funciona,
mas com a amostra de hoje tem pouco poder discriminante.

**Passo 3 (backtest)**: o contrafactual completo do plano (replay de
`rankCandidates()` pra saber se um candidato diferente teria sido escolhido)
**não é possível hoje** — `ai_trades` só grava trades executados, não
candidatos descartados por ciclo; exigiria rodar `runTradingCycle` contra
replay de preço histórico, infraestrutura que não existe. Rodado em vez
disso um **proxy** (disclosed como tal, não como validação completa):
multiplicador walk-forward out-of-sample aplicado como escala de PnL sobre
os 112 trades reais de 12 símbolos (03-21/08). Resultado: **PnL total real
-$129,29 vs. escalado -$129,31 (Δ ≈ -$0,02, ruído)**; stddev por trade caiu
de 6,1644 para 6,1163 (-0,8%, marginal). Em pelo menos 1 símbolo (XAUUSD) o
efeito foi na direção contrária ao desejável (penalizou o único símbolo que
fechou positivo no período, porque o limite inferior de confiança ainda era
negativo apesar do resultado agregado ter sido bom) — comportamento
esperado do desenho (cauteloso com amostra pequena), não bug.

**Conclusão**: mecânica da fórmula valida (reage a resultado real, trava em
neutro sem amostra, nunca zera) mas **não há dado suficiente ainda pra medir
se o scorecard ajuda ou atrapalha** — efeito líquido hoje é indistinguível
de ruído. Decisão: não integrar no motor agora. Repetir o proxy-backtest em
1-2 semanas quando mais símbolos atingirem n≥20 (ou o `MIN_AMOSTRA`
revisado que decidir usar) — só aí o teste tem chance de mostrar sinal de
verdade. Nenhuma mudança no motor de produção feita nesta sessão.

## Infraestrutura implementada em 2026-08-21 (efeito continua desligado)

Depois da conclusão acima, o Cleber pediu pra construir a infraestrutura
mesmo sem validação completa — decisão explícita dele, registrada como tal
(não como resultado medido). Implementado e **confirmado rodando em
produção** no mesmo dia:

- **Motor puro**: [`src/app/services/strategy/AssetScorecard.ts`](src/app/services/strategy/AssetScorecard.ts)
  — mesma fórmula do protótipo (`computeSymbolScorecard`/
  `computeScorecardSnapshot`), portada 1:1.
- **Tabela** `asset_performance_scorecard` (migration
  [`20260821_add_asset_performance_scorecard.sql`](supabase/migrations/20260821_add_asset_performance_scorecard.sql)):
  `user_id, symbol, n_trades, avg_pnl, std_dev, lower_bound, multiplier,
  window_size, updated_at`, RLS (usuário só lê o próprio, só `service_role`
  escreve). **Aplicada no Supabase.**
- **Job periódico**: Edge Function
  [`supabase/functions/asset-performance-scorecard/`](supabase/functions/asset-performance-scorecard/index.ts)
  — lê `ai_trades` (status CLOSED), agrupa por `user_id`×`symbol`, calcula
  scorecard sobre os últimos 12 trades fechados (`WINDOW_SIZE`), faz upsert.
  **Deployada** (`--no-verify-jwt`, auth própria via `x-runner-secret` /
  `ASSET_SCORECARD_SHARED_SECRET`, mesmo padrão do `ai-runner` e do
  `partner-commission-accrual`).
- **Cron**: migration
  [`20260821_schedule_asset_performance_scorecard.sql`](supabase/migrations/20260821_schedule_asset_performance_scorecard.sql)
  — `asset-performance-scorecard-recalc`, `*/30 * * * *`. **Agendado e
  ativo** (`cron.job.active = true`).
- **Ponto de aplicação no motor**: `TradingCycleDeps.assetScorecard`
  (opcional) + switch `ASSET_SCORECARD_ACTIVE = false` em
  [`runTradingCycle.ts`](src/app/services/strategy/runTradingCycle.ts)
  (`rankCandidates`). Multiplicador é calculado mas só é **aplicado** se o
  switch virar `true` — hoje todo símbolo vale 1,0× de verdade em produção,
  nenhuma mudança de comportamento de trading. **Não mude esse switch sem
  repetir a validação** (regra fixa do projeto: nunca prometer melhora sem
  prova estatística).
- **Pendência deliberadamente não fechada**: `ai-runner` ainda não busca
  `asset_performance_scorecard` pra popular `deps.assetScorecard` — sem
  efeito com o switch desligado, então foi adiado pro dia de ligar de
  verdade (evita trabalho sem uso e risco de bug em produção antes da hora).

**Verificação ao vivo (2026-08-21, disparo manual via `net.http_post` direto
no Supabase, fora do cron)**: `200 OK`, `{"upserted":20}` — 20 combinações
usuário×símbolo gravadas com dado real. Amostra: `XAUUSD` (n=12, avg_pnl
+2,11, multiplicador 1,013×), `UKOUSD` (n=12, avg_pnl -1,26, multiplicador
0,849×), todos os símbolos com n<12 travados em 1,000× exatamente como
desenhado. Achado incidental (não bug desta implementação): `SPX500` tem 1
trade com PnL -$3.810 no scorecard — o mesmo dado contaminado por bug de
escala já documentado em
[SESSAO_2026-08-21_GUARDA_DESVIO_PRECO.md](SESSAO_2026-08-21_GUARDA_DESVIO_PRECO.md);
não afeta nada hoje porque esse símbolo não atinge amostra mínima, mas vale
lembrar se algum dia for limpar `ai_trades`.

**Próximo passo real**: esperar 1-2 semanas de acúmulo (job já rodando
sozinho a cada 30min), repetir o proxy-backtest com mais símbolos em
n≥12/n≥20, e só então decidir se `ASSET_SCORECARD_ACTIVE` vira `true`.

## Proxy-backtest repetido em 2026-08-26 (5 dias depois) — ainda sem benefício líquido

Dado real atualizado (`ai_trades`, 259 trades qualificados, entry_time
≥ 2026-08-03): número de símbolos com n≥20 **dobrou** (2→4: SOLUSD,
ETHUSD, XAUUSD, BTCUSD). Script:
[rerun_2026-08-26.ts](research/experiments/2026-08-21-asset-scorecard/rerun_2026-08-26.ts),
dado em
[real_trades_2026-08-26.json](research/experiments/2026-08-21-asset-scorecard/real_trades_2026-08-26.json).

**Resultado, mesma disciplina do proxy original**:
- Δ PnL total: **-0,292** (piora marginal, não melhora)
- Δ stddev/trade: **-0,0035 (-0,0%)** — variância não cai de forma
  perceptível (era -0,8% em 08-21; com o dobro de amostra qualificada, a
  redução de variância ficou ainda mais próxima de zero, não melhorou)

**O mesmo problema já sinalizado em 08-21 se repete e se agrava**: XAUUSD
é o único símbolo com PnL agregado real positivo (+14,33 nos 24 trades),
mas o scorecard **penaliza** ele (escalado cai pra +11,30, Δ -3,031) —
o limite inferior de confiança continua negativo (-0,41) mesmo com
resultado agregado bom, porque a volatilidade por trade (desvio ~5,3) é
grande relativa à média. A métrica pune exatamente o símbolo que estava
indo melhor.

**Conclusão, sem enfeitar**: dobrar a amostra não mudou a resposta — o
scorecard continua sem mostrar benefício líquido mensurável, e a direção
do efeito (levemente pior, não melhor) se mantém igual à medição
anterior. `ASSET_SCORECARD_ACTIVE` continua `false`. Não há evidência
ainda de que esperar mais tempo mude esse quadro — o problema pode ser
estrutural na fórmula (limite de confiança sobre PnL bruto penaliza
volatilidade na mesma direção do que retorno, não separa "ruim" de
"bom mas arriscado"), não só falta de amostra. Se repetir de novo sem
mudança, próximo passo seria reconsiderar a métrica em si (ex: usar
Sharpe/Sortino por símbolo em vez de PnL médio bruto com IC), não só
esperar mais dado.
