# Sessão 2026-08-28 — Gerenciamento de saída + início do cérebro analítico

> Handoff completo pra continuar exatamente de onde parou. Detalhe técnico
> de cada item tem link pro código/experimento; este arquivo é o "estado da
> sessão", não repete o que já está documentado nos experimentos.

## O que foi corrigido/implementado hoje, em ordem

### 1. TP parcial 50% em +1R (depois apertado pra +0,5R — ver item 2)
Achado: motor não realizava nenhum lucro parcial fora de pyramiding — 89,2%
dos trades perdedores (candle real, sem look-ahead) tiveram lucro flutuante
real antes de reverter, mediana $0,55 devolvido. Implementado
`evaluateSinglePositionPartialTP` em `positionManager.ts`, migration
`20260828_add_partial_tp_tracking.sql` (coluna `partial_tp_taken` pra
idempotência entre invocações do cron). **Commitado e deployado.**

### 2. Gatilho de breakeven+parcial apertado de 1R pra 0,5R
Sweep de contenção (candle 5m, 126 trades reais) mostrou sinal monotônico
limpo: quanto mais cedo o gatilho, melhor. `BREAKEVEN_TRIGGER_R = 0.5` em
`TradeFrictionControls.ts`, e `PARTIAL_TP_TRIGGER_R` agora REFERENCIA a
mesma constante (nunca mais dois literais separados). Não fomos pro
extremo do grid (0,3R, melhor resultado bruto) — 0,5R já era o valor
validado com custo de reentrada incluído no experimento de 2026-08-26.
**Commitado e deployado.**

### 3. Linha de stop dupla (cliente via um cálculo, servidor via outro)
Achado grave (classificado pelo Cleber como risco jurídico/credibilidade):
o loop de 1s do cliente recalculava trailing/breakeven com feed PRÓPRIO e
sobrescrevia `order.sl` a cada segundo, mesmo em DEMO — onde o servidor é
autoridade única de fechamento desde 18/08. Fix em `useApexLogic.ts`: em
DEMO, o cliente nunca mais recalcula, só reflete o SL sincronizado do
servidor via reconciliação. Contador "movimentos do stop" (widget ATR
Trailing) também migrado pra essa mesma fonte real. **Commitado e
deployado** (mudança só de cliente, deploy automático via Vercel).

### 4. Janela cega de detecção de stop
Servidor só comparava preço PONTUAL contra o stop — nada verificava o gap
entre invocações do cron (~5s) nem entre dois ticks de 1s. Nova função
`checkGapWindowBreaches` em `positionManager.ts`: roda **1x por invocação**
(não por tick — de propósito, pra não sobrecarregar a conta MetaAPI
compartilhada, que já tem histórico de rate-limit), busca o candle de 1min
mais recente por símbolo com posição aberta e verifica se o HIGH/LOW da
janela cruzou o SL/TP. **Commitado e deployado.**

### 5. Inversão de direção por RSI/estocástico em exaustão — TESTADA E REJEITADA
Pedido do Cleber: quando RSI mostra exaustão contra o lado do setup (o caso
do SOLUSD vendido na mínima do dia, RSI 32), inverter o lado em vez de
vetar. Testado com dado real (33 trades reais, candle 5m, mesma distância
de risco/alvo espelhada): inverter piora tanto o líquido (+$0,70 →
-$0,29) quanto a taxa de acerto (30,3% → 18,2%) — os piores casos de
inversão são exatamente os trades que bateram TP cheio na direção
original. **Não implementado** — mesma disciplina de "reportar resultado
real mesmo quando ruim" que já rejeitou "stop-and-reverse" (26/08) e
"Order Block Fade" (24/08). Detalhe:
`research/experiments/2026-08-28-partial-tp-1r/verdict.md` (Adendo 2).

### 6. Redesenho do cérebro de decisão — Fase 0 (modo sombra) implementada e AO VIVO
Pedido maior do Cleber: um "operador gênio" com julgamento contextual (não
regra fixa), persona adaptativa por regime com princípios de Soros/Jim
Simons/Jesse Livermore/Paul Tudor Jones/Stanley Druckenmiller — dentro de
uma jaula de risco mecânica que NUNCA pode ser flexibilizada pelo
julgamento do próprio cérebro (Livermore quebrou várias fortunas por
ignorar isso, é o motivo real, não só a regra).

**Achado que definiu a validação**: este projeto já tinha rejeitado
arquitetura de decisão LLM antes
(`research/experiments/2026-08-23-custo-nao-cobrado-e-poder/tradingagents-e-ml.md`)
por risco de vazamento temporal — um LLM pode ter memorizado nos pesos o
que aconteceu no período histórico usado pra backtestar. Por isso este
cérebro só pode ser validado **pra frente** (modo sombra, nunca decide de
verdade, acumula amostra real).

Plano completo, com todas as fases e decisões pendentes:
[research/experiments/2026-08-28-decision-brain-shadow-mode/hypothesis.md](research/experiments/2026-08-28-decision-brain-shadow-mode/hypothesis.md)

**Implementado e CONFIRMADO AO VIVO** (`ai_decision_brain_shadow` recebendo
linhas reais desde 12:52 UTC de hoje, latência 1,5-9,5s, raciocínio
coerente — ex: XAUUSD, ranking mecânico sugeria SHORT 85% confiança, cérebro
respondeu SKIP citando RSI neutro e MACD fraco):
- Migration `20260828_add_decision_brain_shadow.sql`
- `supabase/functions/ai-runner/lib/llmClient.ts` (client enxuto, reusa `LLM_PROVIDER`)
- `supabase/functions/ai-runner/lib/decisionBrainPrompt.ts` (persona + schema)
- `supabase/functions/ai-runner/lib/decisionBrain.ts` (orquestração + log)
- `runTradingCycle.ts`: dep opcional `onDecisionPoint`, fire-and-forget, só candidato #1
- `ai-runner/index.ts`: fiação do hook

**Commitado?** Verificar no início da próxima sessão — a migration e o
deploy já foram feitos pelo Cleber e confirmados funcionando em produção;
falta confirmar se o `git commit` do código (mensagem de commit já
preparada na sessão) foi de fato rodado.

## ⏸️ EXATAMENTE ONDE PARAMOS — próximo passo

Cleber pediu explicitamente: **"ele tem que entender o que fez de errado
para não repetir"** — o cérebro precisa aprender com o próprio histórico.

Alinhamos a forma seguindo o mesmo padrão de rigor do resto da sessão:

- **Forma arriscada, descartada**: o modelo mudar os próprios
  pesos/parâmetros com base no resultado (fine-tuning/retraining
  automático). Já documentado neste projeto como estruturalmente perigoso
  (`tradingagents-e-ml.md`) — sem controle rígido de K acumulando por TODA
  a vida do sistema, o cérebro vai "achar" edge falso com frequência
  crescente quanto mais rodar. **Não fazer.**
- **Forma segura, aprovada pelo Cleber, ainda NÃO implementada**: o
  cérebro não muda de "cérebro" — ele passa a **ver o próprio histórico**
  antes de decidir. Antes de cada nova decisão, buscar as decisões
  passadas em situação parecida (mesmo símbolo/regime) junto com o
  resultado real que aconteceu depois, e injetar isso como contexto no
  prompt (ex: "nas suas últimas 20 decisões de SKIP em regime lateral, 15
  estavam certas; nas suas 10 decisões de FLIP por RSI extremo, 8
  erraram"). É raciocínio sobre histórico auditável (equivalente a um
  trader revisando o próprio diário antes de operar), não mudança de
  peso/parâmetro — não reabre o risco estatístico que motivou rejeitar a
  forma arriscada.

**O que falta construir, nesta ordem, pra isso funcionar** (nada disto foi
começado ainda):

1. **Cálculo de resultado hipotético por decisão logada** — hoje
   `ai_decision_brain_shadow` grava a decisão e o contexto no momento, mas
   NÃO o resultado real que aconteceu depois (isso já estava planejado só
   pra Fase 2, ver hypothesis.md). Precisa de uma função/job que, passado
   tempo suficiente desde `created_at`, busca candle real subsequente
   (reaproveitar a mesma lógica de MFE/replay usada hoje nos experimentos
   de TP parcial e do teste de inversão de RSI — candle real, sem
   look-ahead) e preenche um resultado (ex: colunas novas
   `hypothetical_outcome_pnl`, `hypothetical_outcome_computed_at`, ou
   tabela separada).
2. **Módulo de recuperação de histórico** — dado um novo candidato
   (símbolo, regime, contexto), busca as N decisões passadas mais
   parecidas COM resultado já calculado, monta um resumo estatístico
   simples (taxa de acerto por tipo de decisão/regime).
3. **Injeção no prompt** — `decisionBrainPrompt.ts` ganha uma seção nova de
   "seu histórico recente" antes do contexto do candidato atual.
4. **Gate natural, não é atalho**: só faz sentido ligar isto depois que
   houver amostra real suficiente de decisões COM resultado calculado —
   não faz sentido "revisar histórico" com poucas linhas. Isso significa
   esperar pelo menos os primeiros dias/semana de acúmulo da Fase 1 antes
   do passo 1 acima ter dado suficiente pra valer a pena.

**Decisão explícita do Cleber nesta sessão**: construir isso ("pode
construir"), mas primeiro documentar e pausar pra continuar em nova sessão
— é este arquivo.

## [2026-08-29] Passo 1 implementado — cálculo de resultado hipotético

Construído o item 1 da lista acima (cálculo de resultado hipotético por
decisão logada). Ainda **não commitado nem deployado** — código pronto,
pendente do Cleber rodar os comandos abaixo.

O que foi feito:
- `supabase/migrations/20260829_add_decision_brain_hypothetical_outcome.sql`
  — novas colunas em `ai_decision_brain_shadow`: `entry_price_snapshot`,
  `atr_snapshot` (gravados no MOMENTO da decisão, nunca depois),
  `hypothetical_outcome` (WIN/LOSS/TIMEOUT/NO_DATA),
  `hypothetical_r_multiple`, `hypothetical_outcome_computed_at`.
- `runTradingCycle.ts`: `onDecisionPoint` agora também entrega
  `entryPriceSnapshot` (close do candle mais recente) e `atrSnapshot`
  (ATR14 no momento) — mesmos dados que o motor real já calcula pro
  stop/alvo, sem chamada de rede extra.
- `decisionBrain.ts`/`index.ts` (ai-runner): repassam esses dois campos pro
  INSERT em `ai_decision_brain_shadow`.
- **Novo job independente** `supabase/functions/decision-brain-outcome/`
  (não roda dentro do `ai-runner` de propósito — cadência diferente, não
  quis aumentar carga na conta MetaAPI compartilhada a cada 1min). Lê até
  50 linhas pendentes por invocação, busca candle real de 1m desde a
  decisão (uma busca por símbolo, reaproveitada entre linhas), reconstrói o
  stop/alvo hipotético do `mechanical_side` com a MESMA aritmética do motor
  real (stop=2×ATR, alvo=3×stop — `STOP_ATR_MULTIPLIER`/
  `RISK_REWARD_MULTIPLE`, única fonte, importados de `runTradingCycle.ts`)
  e caminha os candles em ordem cronológica (stop primeiro em caso de
  ambiguidade, mesma convenção de `checkGapWindowBreaches`). Marca WIN/LOSS
  se bateu, TIMEOUT com R a mercado se passou 24h sem bater nenhum, NO_DATA
  se o candle real não estava disponível. **Só calcula o lado mecânico** —
  o resultado do FLIP (lado oposto) é o espelho matemático
  (`-hypothetical_r_multiple`), não precisa de uma segunda passada.
- `npm run validate` 100% (37 asserções + suíte de indicadores/motor).

**Comandos pendentes pro Cleber** (nesta ordem):
1. Aplicar a migration `20260829_add_decision_brain_hypothetical_outcome.sql`
   no SQL Editor do Supabase.
2. Deploy do novo job:
   ```
   supabase functions deploy decision-brain-outcome --no-verify-jwt
   ```
   (precisa de `--no-verify-jwt` como o `ai-runner` — não tem sessão de
   usuário, só o secret `x-runner-secret` opcional via
   `DECISION_BRAIN_OUTCOME_SHARED_SECRET`, se quiser proteger o endpoint;
   sem o secret setado, o job aceita qualquer chamada, igual o
   comportamento de `asset-performance-scorecard` hoje.)
3. Agendar via `pg_cron` — sugestão: a cada 30min (mais que suficiente,
   linhas só ficam elegíveis 10min depois de criadas e o resultado real
   leva de minutos a poucas horas pra se resolver). Exemplo de SQL (ajustar
   URL/secret reais):
   ```sql
   SELECT cron.schedule(
     'decision-brain-outcome-30min',
     '*/30 * * * *',
     $$
     SELECT net.http_post(
       url := 'https://wyvdsxtcmizettljxtbg.supabase.co/functions/v1/decision-brain-outcome',
       headers := jsonb_build_object('Content-Type', 'application/json')
     );
     $$
   );
   ```
4. Deploy do código atualizado do `ai-runner` (mudou `index.ts` e
   `lib/decisionBrain.ts` — precisa de redeploy, `git push` sozinho não
   basta, ver regra em CLAUDE.md):
   ```
   supabase functions deploy ai-runner --no-verify-jwt
   ```
5. Commit do código (`git add`/`git commit`/`git push` — Claude nunca roda
   isso sozinho, comando pronto na entrega desta sessão).

**Próximo passo real (item 2 da lista, ainda não iniciado)**: esperar
acumular algumas linhas com `hypothetical_outcome_computed_at` preenchido
em produção, então construir o módulo de recuperação de histórico (busca
as N decisões passadas mais parecidas COM resultado já calculado) e a
injeção no prompt — só depois de confirmar que o passo 1 está gravando
resultado real corretamente ao vivo.

## Pendências antigas que continuam de pé (não tocadas hoje)

- Volume de trades (5 no dia 27) — Cleber pediu meta de ~10/dia. Já
  registrado no CLAUDE.md que 10/dia foi testado extensivamente sem líquido
  positivo (teto real ~2-6/dia). Ofereci puxar o funil de decisão do dia 27
  específico pra separar "teto real de edge" de "gate apertado demais" —
  **não feito ainda**, Cleber não respondeu esse ponto.
- Orçamento de newsfeed pago (bloqueia parte da persona do cérebro —
  "notícia mundial quase online") — pendente, já registrado no CLAUDE.md.
- Auditar se o bug de PnL 20x de índices (corrigido 27/08 só pra NAS100)
  afeta outros símbolos INDICES.

## Comandos pendentes (se ainda não rodados)

Verificar `git log` no início da próxima sessão — se os commits abaixo (ou
equivalentes) não aparecerem, ainda precisam ser rodados pelo Cleber:
- TP parcial + gatilho 0,5R + stop unificado + janela cega + rejeição de
  inversão por RSI: múltiplos commits já com mensagem preparada nesta
  sessão (ver histórico do chat se precisar recuperar a mensagem exata).
- Fase 0 do cérebro de decisão: commit preparado, migration e deploy JÁ
  confirmados em produção — falta só confirmar se o `git commit`/`push` do
  código rodou.
