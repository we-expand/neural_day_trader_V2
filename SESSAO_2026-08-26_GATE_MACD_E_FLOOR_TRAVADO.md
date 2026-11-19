# Sessão 2026-08-26 (2ª parte): Gate real de MACD + achado do floor travado em produção

> **Status**: ✅ Deployado (commit+push feito, migration da CHECK
> constraint rodada no Supabase, `ai-runner` redeployado — confirmado pelo
> Cleber em 2026-08-26). Próximo passo real: observar produção nas
> próximas horas/dias — ver se o gate de MACD reduz o padrão de entrada
> "infantil" e se o funil passa a considerar mais ativos da cesta (efeito
> do item 4) sem indicar que o gate ficou frouxo demais.

## Contexto: 3 perguntas do Cleber nesta sessão

1. "Se ele tivesse olhado o MACD, saberia que não devia ter entrado" — a
   única entrada em 13h perdeu de forma "infantil".
2. "A cada entrada que pega, pega muito pouco dinheiro do mercado."
3. "Por que só opera Solana/Ethereum? As duas de hoje foram Solana."

## 1. MACD nunca influenciava a decisão — só um rótulo cosmético

Confirmado por grep: `calculateMACD` só era chamado em
`runTradingCycle.ts:1509`, dentro do objeto do trade já decidido, pra
preencher `indicators.macd` (rótulo BULLISH/BEARISH mostrado na UI). Em
nenhum lugar do funil de decisão (RSI, Market Score, custo, etc.) o MACD
entrava como filtro. O comentário de 2026-08-20 já tinha corrigido o
rótulo pra derivar de linha vs. sinal (era antes só um espelho do lado da
entrada), mas isso é cosmético — nunca virou gate.

**Trade real que expôs o problema**: `ai_trades` id
`a98f306e-1f5a-4d08-9032-c403eef518ca` — SOLUSD LONG, entrou
2026-08-26 10:39:25 UTC com confiança 76%, rótulo "MACD: BULLISH" na
entrada. Fechou por stop loss 59min depois (`net_pnl` −$0.54). O
cruzamento MACD>sinal era real (rótulo não estava errado), mas um
cruzamento bullish com histograma já encolhendo é sinal fraco/morrendo —
exatamente o padrão que o rótulo binário não captura.

**Fix**: `src/app/services/strategy/runTradingCycle.ts` (~linha 766,
antes do gate de `MIN_CONFIDENCE`) — gate novo `MACD_MOMENTUM_FADING`.
Se o histograma do MACD está do lado errado do zero OU encolhendo na
direção do trade (comparando última barra com a anterior), exige +15
pontos de confiança acima do mínimo do perfil — mesmo padrão já usado
pros outros filtros de momentum (RSI neutro, Market Score lateral).

Arquivos tocados (union do vetoStage + mapeamento de funil, em 4 lugares
que precisam ficar em sincronia — documentado no próprio código):
- `src/app/services/strategy/runTradingCycle.ts` (gate)
- `src/app/services/telemetry/FunnelTelemetry.ts` (stage `MACD_MOMENTUM_FADING`)
- `src/app/services/AITradingPersistenceService.ts` (union do driver browser)
- `src/app/hooks/useAIPersistence.ts` (mapeamento do driver browser)
- `supabase/functions/ai-runner/lib/persistence.ts` (union + mapeamento do runner Deno — **é este que roda em produção de verdade**)
- `supabase/migrations/20260826_add_macd_momentum_veto_stage.sql` (CHECK constraint novo — **precisa rodar antes do deploy do ai-runner**, senão todo insert com esse veto quebra)

`npm run validate` passou (motor + ~40 asserções, zero erros).

## 2. Por que só Solana/Ethereum: achado real, não é limitação do motor

A "otimização" de 08-26 (documentada em
`SESSAO_2026-08-26_OTIMIZACOES_MOTOR.md`) reduziu `signalScoreFloor` de
60 → 45 em `useApexLogic.ts` — **mas esse arquivo é o hook do
browser/cliente**. O motor que roda de verdade em produção é o
`ai-runner` (Deno, cron 1×/min), que lê a config de `ai_sessions.config`
no Supabase, não o default do código-fonte.

Consultei a sessão `RUNNING` de produção agora
(`7e25c0d5-15a1-4112-ac26-a34c2df888b0`, `updated_at` hoje 12:11 UTC):
**`config->>'signalScoreFloor'` ainda é `60`**, o valor antigo. O código
mudou, mas a config já persistida no banco sobrepõe o default — mesmo
padrão do "secret sobrepõe default do código" já documentado no
`CLAUDE.md` pro NEXUS, só que aqui é config de sessão em vez de secret.
Resultado: BTCUSD (score ~48), XAUUSD, EURUSD e o resto continuam
descartados no ranking ANTES de chegarem em qualquer gate de qualidade —
só o que já pontua ≥60 (SOL/ETH, aparentemente) chega a ser avaliado.
Confirmado batendo os `ai_decisions` das últimas 24h: XAUUSD (1951),
ETHUSD (1663), EURUSD (1161), UKOUSD (1008), BTCUSD (903) e SOLUSD (620)
são TODOS avaliados/rejeitados — o motor não está cego aos outros
ativos, só que o piso alto historicamente favorece SOL/ETH pra passar.

**Ação pendente do Cleber** (dado, não migration — SQL pronto abaixo):

```sql
UPDATE ai_sessions
SET config = jsonb_set(config, '{signalScoreFloor}', '45')
WHERE id = '7e25c0d5-15a1-4112-ac26-a34c2df888b0' AND status = 'RUNNING';
```

Confirmar o id certo antes de rodar (`select id, status, updated_at from
ai_sessions where status='RUNNING'`), caso uma sessão nova já tenha
começado entre esta investigação e a execução do SQL.

## 3. "Captura pouco dinheiro por trade" — não é bug novo, é breakeven já calibrado

Investiguei 25 trades fechados recentes (`ai_trades`, últimos 10 dias).
Padrão real:
- Perdedores "normais" (SL original bateu): capturam ~30-50% da
  distância até o alvo contra o trade — matemática esperada de um R:R
  1:3 (stop = ~33% da distância do alvo).
- **~20% dos trades fecham com `stop_loss == entry_price` exato** (perda
  ~$0, às vezes 30-165min de capital parado): é o mecanismo de
  breakeven do `positionManager.ts` (trava o stop no preço de entrada
  quando o preço anda +1,5R a favor), **já documentado e recalibrado em
  2026-08-25** (era 1R, subiu pra 1,5R depois de medir que 27% dos "SL"
  fechavam em ~zero e o motor reabria minutos depois, pagando round-trip
  de novo). Não é bug novo — é um trade-off de risco já ajustado uma vez.
- Quando bate TP, captura em média 100-125% do alvo (bom).

**Diagnóstico real**: o gargalo de "$ por trade" não é o breakeven — é o
win rate. Com win rate baixo, a maioria das operações nunca chega perto
do alvo cheio; o gate de MACD (item 1) ataca exatamente essa causa raiz
(entradas com momentum já morrendo), não o mecanismo de breakeven. Não
mexi no breakeven agora — reabrir isso exigiria nova medição própria
(mesma disciplina que motivou o ajuste de 08-25), não uma segunda rodada
de ajuste sem dado novo.

## Comandos pro Cleber

```bash
git add src/app/services/strategy/runTradingCycle.ts \
        src/app/services/telemetry/FunnelTelemetry.ts \
        src/app/services/AITradingPersistenceService.ts \
        src/app/hooks/useAIPersistence.ts \
        supabase/functions/ai-runner/lib/persistence.ts \
        supabase/migrations/20260826_add_macd_momentum_veto_stage.sql

git commit -m "feat(motor): gate real de momentum MACD na decisão de entrada (era só rótulo cosmético)"

git push
```

Depois do push (dev → Vercel sobe sozinho):
1. Rodar a migration `20260826_add_macd_momentum_veto_stage.sql` no SQL
   Editor do Supabase (CHECK constraint novo).
2. `supabase functions deploy ai-runner --no-verify-jwt` (o gate só
   afeta produção depois do redeploy — client-side sozinho não muda o
   motor real).
3. ~~Rodar o `UPDATE ai_sessions ...` do item 2~~ — **ficou irrelevante
   depois do item 4**: o piso de score não filtra mais nada, então o valor
   de `signalScoreFloor` persistido (60 ou 45) não muda o comportamento.
   Não precisa rodar o UPDATE.

## 4. Adicionado depois: piso de score deixou de EXCLUIR ativo da análise

Observação do Cleber depois da investigação acima: mesmo corrigindo o
valor do `signalScoreFloor` (item 2), o desenho continuava sendo "corta
o ativo da cesta ANTES de qualquer gate de qualidade olhar pra ele" —
pedido explícito: todo ativo do "Universo de Ativos" da tela tem que
entrar em análise, não ser descartado por um score isolado que não sabe
de RSI/MACD/Market Score.

**Fix**: `rankCandidates()` em `runTradingCycle.ts` não corta mais por
`scored.score < floor` — só descarta quando não há sinal de entrada
nenhum (`!scored.side`, ou seja, a estratégia genuinamente não viu setup
LONG nem SHORT). Todo ativo com QUALQUER sinal entra no ranking e é
ordenado por score; o loop de execução (Fase 3) agora tenta a cesta
ranqueada INTEIRA (era um teto fixo de 5 tentativas — com o piso vetando
menos gente na Fase 2, 5 deixou de ser suficiente pra cobrir cestas
maiores). O controle de qualidade real continua nos gates de
`analyzeAsset` (MIN_CONFIDENCE, RSI neutro, MACD momentum, Market Score,
custo) — que agora enxergam TODOS os candidatos com sinal, não só os que
já tinham passado num piso cego a esses fatores.

Efeito esperado: mais ativos da cesta aparecem em `ai_decisions` com
motivo de rejeição específico (RSI, MACD, Score, custo) em vez de nunca
aparecerem porque nem chegaram a ser avaliados — e o item 2
(`signalScoreFloor` travado em 60 no banco) passa a ser irrelevante,
porque o piso não filtra mais nada.

`npm run validate` rodado de novo depois desta mudança — passou limpo.

Arquivo tocado (só este, é uma mudança de ranking, não de gate novo):
`src/app/services/strategy/runTradingCycle.ts`.
