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

---

## Adendo (2026-08-28, mesma sessão): sweep de contenção — MFE severo + gatilho apertado pra 0,5R

Pedido do Cleber, urgente, depois de ver o número de MFE: "89,2% dos
perdedores tiveram lucro flutuante real, mediana $0,55 devolvido — medidas
de contenção severas".

**Achado-chave**: o TP parcial acima (gatilho 1R) só cobre os ~26% dos
trades que chegam a 1R inteiro. A maioria do padrão "ganha e devolve"
acontece ANTES de 1R — na faixa de $0,05 a $0,89 (p10-p75 do MFE dos
perdedores), abaixo de onde qualquer proteção existia até esta sessão.

**Sweep**: gatilho de breakeven+parcial (mesmo valor, acoplados de
propósito) de 0,3R a 1,0R × % do parcial (30/50/70%), candle real de 5m
(mais fino que o 15m usado nos experimentos anteriores), 126 trades
válidos de BTC/ETH/SOL (12 dias), réplica fiel de `positionManager.ts`,
sem look-ahead. Script: `scripts/sweep_containment.mjs`.

| Gatilho | Sem parcial | Parcial 30% | Parcial 50% | Parcial 70% |
|---|---|---|---|---|
| 1,0R (prod. até hoje) | +$2,66 | +$4,00 | **+$4,90** | +$5,79 |
| 0,75R | +$3,94 | +$5,36 | +$6,30 | +$7,24 |
| 0,6R | +$7,16 | +$8,38 | +$9,20 | +$10,01 |
| **0,5R** | +$10,98 | +$12,90 | **+$14,17** | +$15,45 |
| 0,4R | +$14,19 | +$15,59 | +$16,52 | +$17,45 |
| 0,3R | +$16,78 | +$17,24 | +$17,54 | +$17,85 |

Sinal monotônico e limpo em toda a grade — mesmo padrão já visto no sweep
de breakeven de 2026-08-26 (Adendo 2), agora confirmado com o TP parcial
incluído e candle mais fino (5m vs 15m).

**Decisão**: `BREAKEVEN_TRIGGER_R` e `PARTIAL_TP_TRIGGER_R` (agora
acoplados por referência, nunca mais dois literais separados) de 1,0R
para **0,5R**, mantendo `PARTIAL_TP_PERCENT` em 50% (não mexi nos dois
parâmetros incertos ao mesmo tempo). Não fui para 0,3R (melhor resultado
bruto do grid, +$17,85): 0,5R já era o valor especificamente validado com
custo de reentrada incluído no experimento de 2026-08-26 (Adendo 6,
+$9,05 ajustado); 0,3R não tem essa medição e reduziria a distância média
até o stop a um ponto onde ruído de candle passa a competir com o sinal —
mesma disciplina anti-overfitting já documentada em `TradeFrictionControls.ts`.

**Ressalva não escondida**: esta reavaliação veio ~2 dias depois de 1R
entrar em produção, não os "150-200 trades" que o comentário de 2026-08-26
tinha planejado como critério pra reavaliar de novo. Acelerada por
severidade (número de MFE) e por convergência de duas medições
independentes (candle 15m em 26/08, candle 5m agora) apontando pra mesma
direção — não é capricho, mas também não é o critério original cumprido.
Reavaliar de novo depois de acumular trades reais em 0,5R.

**Implementado**: `TradeFrictionControls.ts` (`BREAKEVEN_TRIGGER_R = 0.5`,
`PARTIAL_TP_TRIGGER_R` agora referencia a mesma constante),
`__validate__friction__.ts` atualizado. `npm run validate` e
`deno check` limpos. Nenhuma mudança de código adicional necessária —
`positionManager.ts` e `useApexLogic.ts` já leem essas constantes, não
têm o valor hardcoded.

---

## Adendo 2 (2026-08-28): "inverter direção na exaustão" — hipótese testada e REJEITADA

Pedido do Cleber, motivado pelo trade SOLUSD SHORT com RSI 32 ("vendida na
mínima do dia"): em vez de VETAR entrada com RSI/estocástico em exaustão
contra o lado do setup, consultar o indicador e OPERAR O LADO OPOSTO.

**Precedente já registrado neste projeto**: "stop-and-reverse" (reverter
DEPOIS do stop bater) já foi testado e REJEITADO com folga
(`2026-08-26-dynamic-exit-tp-ceiling/verdict.md`, Adendo 7: -$9,65
líquido, 84 piores contra 15 melhores). Esta é uma hipótese DIFERENTE
(inverte NA ENTRADA por RSI extremo, não depois do stop) — testada aqui
como hipótese própria, não presumida rejeitada por associação.

**Metodologia**: 33 trades reais de produção (14 dias, BTC/ETH/SOL) com
RSI em exaustão contra o lado do setup (SHORT com RSI≤35, LONG com
RSI≥65 — mesmos limiares já usados no modo COUNTER existente no motor).
Candle real de 5m, sem look-ahead. Simula a versão invertida (lado
oposto, mesma distância de risco/alvo espelhada a partir da mesma
entrada) e compara contra o resultado REAL gravado. Script:
`scripts/exhaustion_flip_test.mjs`.

| | Direção original (real) | Direção invertida (simulada) |
|---|---|---|
| Net PnL (33 trades) | **+$0,70** | -$0,29 |
| Win rate | 30,3% | 18,2% |

**Resultado**: inverter pioraria tanto o líquido quanto a taxa de acerto.
22 dos 33 trades individualmente teriam saída melhor se invertidos, mas
os 11 que pioram concentram perdas muito maiores — são exatamente os
casos em que o trade original bateu o TP cheio (momentum real continuou
apesar do RSI extremo); invertê-los transforma um ganho de +$1 a +$3 num
prejuízo do mesmo tamanho. Ver `results/exhaustion_flip_detail.json` pro
detalhe trade a trade, incluindo o caso específico que motivou o pedido
(SOLUSD RSI 31, entry_time 2026-08-22 10:21 — nesse caso isolado inverter
teria dado +$4,78 de diferença; a intuição do Cleber estava certa PARA
AQUELE trade, mas não generaliza pro conjunto).

**Achado adicional, honesto**: mesmo na direção ORIGINAL, esta zona (RSI
em exaustão) rende só 30,3% de acerto e +$0,70 líquido em 33 trades — é
uma zona de qualidade baixa/marginal nos dois sentidos, não só no
invertido.

**Decisão: NÃO implementado.** Consistente com a disciplina do projeto
(`CLAUDE.md`: "nunca prometer edge sem validação estatística... reportar
resultado real sempre, mesmo quando ruim") e com o histórico de busca
sistemática por edge técnico já fechado sem resultado (`AI_BRAIN_SPEC.md`
seção 11-14) — inverter direção por RSI/estocástico se junta a
"stop-and-reverse" e "Order Block Fade" na lista de hipóteses de reversão
testadas e rejeitadas neste projeto. Terceiro resultado negativo
consistente na mesma família de hipótese é sinal forte, não ruído.

**Amostra pequena, reconhecido**: 33 trades é pouco — não é prova
definitiva de ausência de edge, é o dado que existe hoje. Se quiser
retestar com mais indicadores de confirmação (estocástico junto, não só
RSI) ou mais dado acumulado, é um próximo passo válido — mas testar mais
variações sobre a mesma amostra pequena sem dado novo seria o exato risco
de overfitting que este documento já adverte em outros pontos.
