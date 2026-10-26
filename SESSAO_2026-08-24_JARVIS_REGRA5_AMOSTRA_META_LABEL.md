# Sessão 2026-08-24 — Regra 5 do Jarvis (limiar de amostra pro meta-label) + disciplina de alimentar o Jarvis

## Contexto

Sessão iniciada com uma pergunta de panorama sobre pontos/pips de TP-SL do
motor (presets de estratégia, tabela `TARGET_POINTS_TABLE`), evoluiu para uma
pergunta mais profunda do Cleber: entender por que os trades tomam loss e se
Machine Learning poderia ajudar a evoluir automaticamente e evitar repetir
erros.

## 1) Panorama de pontos/pips (resumo, sem mudança de código)

- Motor real em produção (`runTradingCycle.ts`): stop = 1,5×ATR(14), alvo =
  stop×2,5 — com teto de 80 pontos (alvo) / 35 pontos (stop) quando
  `marketMode === 'SCALP'`.
- Preset #5 "Momentum de Curto Prazo (Scalp)" (`presetStrategies.ts`): ATR×1
  stop / ATR×1,5 alvo — R:R 1:1,5. Experimento de R:R 1:3 (2026-08-18/19) já
  foi testado e **revertido** por win rate real de 16% (4/25 trades).
- Tabela legada `TARGET_POINTS_TABLE` (`TradeSizing.ts`, caminho auxiliar
  `calculateTpSl`, não o principal): POUCOS 150/50, MÉDIO 400/120, MUITOS
  1500/300, CURTO 80/35, LONGO 800/200 (alvo/stop em pontos).

## 2) Por que os trades tomam loss — dado real investigado

Consultei o Supabase de produção (projeto `wyvdsxtcmizettljxtbg`) direto,
não fabriquei nada:

- `ai_trades` não tem nenhuma coluna de MFE (Maximum Favorable Excursion) —
  não é possível saber hoje se um trade esteve em lucro antes de reverter
  pra loss. `ai_portfolio_snapshots` só rastreia equity agregada da conta,
  não por posição. Isso é uma lacuna real de instrumentação, não um bug.
- Distribuição de loss por símbolo (191 trades fechados por SL): SOLUSD
  70,6% loss (n=68), ETHUSD 71,0% (n=62), UKOUSD 78,9% (n=19), BTCUSD 62,5%
  mas com PnL médio de loss **-$4,59** (ordem de grandeza maior que os
  demais — mesmo padrão de suspeita do incidente SPX500 já corrigido pelo
  price-deviation guard em 2026-08-21), XAUAUD 88,9% (n=9, amostra pequena
  demais).
- `confidence_score` já foi testado pelo Jarvis em 2026-08-24: **AUC=0,50**
  — não discrimina trade vencedor de perdedor melhor que acaso.
- Meta-labeling do `confidence_score` (ML aplicado a esse problema) já foi
  desenhado e está **bloqueado por amostra insuficiente**: n=278 trades
  fechados com feature completo, limiar de retomada ~450-500 (ver
  `jarvis_knowledge` e memória `project_jarvis_meta_label_blocked`).

Achado desta sessão registrado em `jarvis_knowledge` (pattern
`loss_rate_concentration_by_symbol_crypto_and_btcusd_avg_loss_outlier`),
com `status: observed_unvalidated` — não é conclusão fechada, é observação
pra revalidar quando a amostra geral passar do mesmo limiar de 450-500.

**Posição sobre ML**: não é resistência — é que ligar um modelo agora
repetiria um erro já identificado pelo próprio projeto (rodar teste
estatístico em amostra insuficiente, violando a disciplina de
`AI_BRAIN_SPEC.md` seção 8). Recomendação dada: esperar o limiar de
amostra, então rodar meta-labeling com walk-forward + correção estatística,
e manter o escopo do ML em **calibração de risco/exposição** (qual
ativo/horário historicamente teve pior odds — o scorecard por ativo e o
Jarvis já fazem isso), nunca em previsão de direção de preço (fronteira já
testada e sem edge, ver seção "Cérebro de decisão da IA" do CLAUDE.md).

## 3) Regra 5 do Jarvis — implementada e deployada

Adicionada em `supabase/functions/jarvis/index.ts`:
`checkMetaLabelSampleThreshold`, chamada no ciclo principal (roda a cada 6h
via `pg_cron`, job `jarvis-analysis-6h`).

- Conta `ai_trades` CLOSED com `net_pnl`+`ai_confidence`+
  `indicators_snapshot` preenchidos.
- Se já existe uma decisão `PENDING`/`ACTIVE` pra este alvo
  (`meta_label_sample_threshold`), não duplica.
- Quando o total cruzar **450**, marca o `jarvis_knowledge` original como
  `threshold_reached_pending_review` e grava uma decisão `TEST_SIGNAL` em
  `jarvis_decisions` — como não existe guardrail configurado pra esse alvo,
  ela nasce `PENDING` por padrão (nunca autoaplica o experimento sozinha,
  só avisa que já dá pra desenhar).

Verificado com `deno check` (limpo) antes do deploy. **Deployado e
confirmado ao vivo** nesta sessão: `get_edge_function` mostra `jarvis`
versão 5, `status: ACTIVE`, código-fonte batendo com o que foi escrito.

Contagem real no momento do deploy: 289 trades fechados com feature
completo, ritmo de ~196/semana (acelerou desde que o runner passou a operar
24/7) — projeção de atingir o limiar de 450 em ~6-8 dias.

## 4) Regra nova de processo — alimentar o Jarvis sempre

A pedido do Cleber: todo achado relevante de sessão sobre o motor/IA deve
ser registrado em `jarvis_knowledge` (não só documentado em markdown do
repo), pra que o Jarvis realmente aprenda com o histórico de decisões e
investigações. Salvo como memória permanente
(`feedback_alimentar_jarvis.md`) — vale pra toda sessão futura que toque o
motor de decisão.

## Pendências reais em aberto

- Nenhum commit/push feito nesta sessão de código (deploy de Edge Function
  não passa por git — ver regra do projeto). Se quiser versionar o
  `jarvis/index.ts` atualizado no git, comando pronto:

  ```bash
  git add supabase/functions/jarvis/index.ts
  git commit -m "feat: Jarvis regra 5 — alerta de limiar de amostra pro meta-label do confidence_score"
  git push origin dev
  ```

- Instrumentação de MFE (preço de pico durante o trade) segue como lacuna
  real — não implementada. Se quiser medir "quantas vezes o motor esteve
  vencedor e depois reverteu pra loss" de verdade, é um projeto novo de
  instrumentação (tabela nova, o `ai-runner` grava o preço/PnL não
  realizado periodicamente por posição aberta).
- Threshold de 450 trades pro meta-labeling: aguardar o próprio Jarvis
  avisar (Regra 5) — projeção ~6-8 dias no ritmo atual.
