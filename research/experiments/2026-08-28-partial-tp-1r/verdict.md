# Veredito: TP parcial (50%) em +1R — hipótese testada e CONFIRMADA pelo dado real

## Pergunta

Reclamação do Cleber (2026-08-28): trade em SOLUSD chegou a ~$5 de lucro
flutuante e devolveu mais da metade até fechar em $2,38 (net). Achado de
código: `positionManager.ts` não realiza NENHUM lucro parcial fora de
pyramiding (que só se aplica a grupos com 2+ camadas — a maioria dos
trades são posição única). Breakeven já arma em +1R
(`BREAKEVEN_TRIGGER_R`, ver `TradeFrictionControls.ts`, validado em
`research/experiments/2026-08-26-dynamic-exit-tp-ceiling/verdict.md`
Adendos 2 e 6). Testado aqui: fechar 50% da posição no MESMO gatilho de
1R, deixando o resto correr com stop em breakeven.

## Metodologia

Reaproveita **exatamente o mesmo dado real** (candle 15m Binance,
BTCUSD/ETHUSD/SOLUSD, mesmos 166 trades reais e mapeamento de sessão
FIXO/DINAMICO) do experimento de 2026-08-26 — cache copiado de
`research/experiments/2026-08-26-dynamic-exit-tp-ceiling/data/`, sem novo
fetch. Réplica fiel de `positionManager.ts` (breakeven, trailing ATR(14)
mult=2, checagem sem look-ahead: cada tick só usa candles até aquele
ponto). Script: `scripts/backtest_partial_tp.mjs`.

**Checagem de sanidade**: réplica A (produção atual, sem parcial) deu
netSum = **+$2,3599** sobre os 123 trades válidos — bate exatamente com a
linha "1,0R" da tabela do Adendo 2 do experimento anterior (+$2,36),
mesma metodologia, mesmo dado. Confirma que o motor de replay está
correto antes de confiar na réplica nova (C).

**Réplica C**: mesmo motor + fecha 50% da posição no primeiro toque do
preço correspondente a +1R (mesmo preço-gatilho do breakeven), deixando o
resto seguir com breakeven já armado e trailing ATR normal. Ambiguidade
dentro do mesmo candle (SL original e gatilho de parcial tocados juntos):
assume SL primeiro — mesma convenção conservadora do experimento
original.

**Ressalva herdada, não escondida**: candle de 15m favorece o backtest
sobre o real de produção (tick de 1min) — ver a mesma ressalva no
experimento de 2026-08-26. Números absolutos não são "resultado real
esperado"; a comparação relativa entre A e C, rodando o mesmo viés, é
válida.

**Custo**: aproximado como a comissão total do trade original, sem
modelar separadamente o custo de dois fechamentos (parcial + remanescente)
— `ExecutionCost.ts` não foi portado pra este script standalone em JS.
Ressalva: a implementação real (`positionManager.ts`) usa
`calculateRoundTripCost` por fração fechada, então o custo real pode ser
marginalmente maior que o modelado aqui (duas chamadas de custo em vez de
uma). Não deveria mudar a direção do resultado (a diferença de $3,57 é
grande o suficiente pra sobreviver a um custo extra de poucos centavos),
mas não foi medido com precisão nesta rodada.

## Resultado

| | Réplica A (produção atual) | Réplica C (parcial 50% em +1R) |
|---|---|---|
| Net PnL (123 trades) | +$2,36 | **+$5,93** |
| Win rate | 37,4% | 54,5% |
| Delta C − A | | **+$3,57 (+151%)** |

Pareado (mesmo trade, mesmo candle, só muda se o parcial dispara):
**21 trades melhoraram, 3 pioraram, 99 idênticos** (nunca chegaram a 1R,
parcial nunca dispara — comportamento inalterado). 25 dos 123 trades
(20,3%) dispararam o parcial.

## O caso que piorou mais (auditado, não escondido)

`SOLUSD 4cee8a28` (2026-08-17): réplica A capturou o TP cheio
(+$7,12) — o candle de entrada já continha o movimento inteiro até o
alvo (barsHeld=1). A réplica C, correta e mecanicamente, fechou 50% no
preço do gatilho de 1R (mais baixo que o TP) e só o resto pegou o TP
cheio: +$4,51. Perda de $2,61 é o preço estrutural de qualquer TP
parcial: em trades que vão direto ao alvo sem nunca recuar, não realizar
parcial teria sido melhor. **É a natureza do trade-off, não um bug** — a
razão 21-melhoram : 3-pioram mostra que compensa na amostra.

## Interpretação

Confirma a suspeita do Cleber com dado real: sem TP parcial, o motor
realiza ganho garantido só no fechamento total (raro — só 29/210 trades
recentes batem TP cheio, ver diagnóstico de produção da sessão), e passa
por cima de toda a faixa de "chegou a lucrar, devolveu tudo" (55/210
trades nos últimos 10 dias em produção — 26,2% da amostra). TP parcial no
mesmo gatilho que já arma o breakeven é uma mudança pequena e coerente com
o resto do gerenciamento de saída existente, sem introduzir parâmetro
novo desalinhado.

## Implementado nesta sessão (2026-08-28)

- Migration `supabase/migrations/20260828_add_partial_tp_tracking.sql`:
  coluna `partial_tp_taken` em `ai_trades` (idempotência entre invocações
  do runner — pendente de aplicação pelo Cleber).
- `positionManager.ts`: nova função `evaluateSinglePositionPartialTP`,
  reusa `partialClosePosition` já existente (infra de pyramiding),
  aplicada agora também a posições sem pyramiding.
- `TradeFrictionControls.ts`: `PARTIAL_TP_TRIGGER_R = 1.0` (mesmo valor
  de `BREAKEVEN_TRIGGER_R`, de propósito) e `PARTIAL_TP_PERCENT = 50`.
- `ai-runner/index.ts`: fiação do novo tick em `positionManagerTick`,
  `partialTpTakenIds` no estado da sessão.
- `npm run validate`: [preencher após rodar].
- Pendente: commit + push (Cleber) + aplicar migration + `supabase
  functions deploy ai-runner --no-verify-jwt`. Client não precisa de
  mudança (fechamento em DEMO já é autoridade exclusiva do servidor desde
  2026-08-18; reconciliação por polling já reflete `quantity` reduzida e
  a nova linha CLOSED parcial automaticamente).

## O que ainda vale testar (não feito nesta rodada)

- Sensibilidade do % parcial (30/40/50/60/70) sobre este MESMO motor
  candle-a-candle (o proxy inicial, mais grosseiro, sugeriu que % maior
  tende a ajudar mais enquanto a taxa de acerto no alvo cheio for baixa —
  não confirmado ainda com o motor rigoroso desta rodada).
- Medir o custo real de dois fechamentos via `ExecutionCost.ts` em vez da
  aproximação usada aqui.
- Reavaliar depois de acumular mais trades reais com a mudança em
  produção (mesma disciplina do experimento de 2026-08-26: não travar
  parâmetro fino numa amostra de ~9 dias sem reconfirmar depois).
