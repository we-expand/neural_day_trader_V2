# Veredito: teto de TP fixo — hipótese testada e REJEITADA pelo dado real

## Pergunta

Se o motor não fechasse a posição ao bater o take-profit original (só
usasse breakeven+trailing ATR pra proteger o lucro e deixasse correr até a
reversão de fato bater o stop), o resultado líquido teria sido melhor?
Motivado pelo trade manual do Cleber em BTCUSD que "deixou correr" e ganhou
+$29,95 em vez de sair num alvo fixo.

## Metodologia

- 166 trades reais fechados via SL/TP em BTCUSD/ETHUSD/SOLUSD (últimos 45
  dias, `stop_loss > 0`, exclui o lote de teste antigo já identificado).
- Cada trade mapeado pra sua sessão real e o `stopLossMode` (`FIXO` ou
  `DINAMICO`) que estava configurado **naquele momento** (31 sessões,
  alternam ao longo do período — checado, não assumido).
- A hipótese só faz sentido em sessões `DINAMICO` (é a única com trailing
  ativo pra proteger lucro sem o TP fechar antes) — **144 dos 166 trades**
  são desse grupo.
- Candle real 15m da Binance (BTCUSDT/ETHUSDT/SOLUSDT), réplica fiel de
  `positionManager.ts` (breakeven +1,5R, trailing ATR período 14
  multiplicador 2 — mesmos parâmetros da sessão de produção). Sem
  look-ahead: ATR e trailing em cada candle só usam candles até aquele
  ponto.
- **110 dos 144** trades DINAMICO tinham candle real suficiente pra
  simular as duas variantes (34 ficaram de fora por falta de dado —
  aquecimento de ATR ou trade recente demais sem candle de saída ainda).
- Comparação pareada: mesma metodologia, mesmo candle, mesmo trade — só
  muda se o TP fecha a posição (variante A, réplica do comportamento real)
  ou não (variante B, a hipótese).

## Checagem de fidelidade (importante, não escondo isto)

A réplica A (que deveria reproduzir o comportamento real) ficou **mais
otimista que o resultado real gravado** nesses mesmos 110 trades: real
-$15,23 vs. réplica A +$3,24. Causa provável: a réplica usa OHLC de 15
minutos (assume que o trailing alcança a máxima/mínima do candle inteiro
antes de checar o stop), enquanto a produção real roda a cada 1 minuto
sobre preço ao vivo — granularidade mais grosseira tende a favorecer a
réplica. **Isso significa que os números absolutos de A e B não devem ser
lidos como prova do desempenho real** — mas como A e B usam exatamente a
mesma simulação (mesmo viés aplicado aos dois lados), a comparação
**relativa** entre A e B continua válida para responder a pergunta feita.

## Resultado

| | A (com teto de TP, réplica do real) | B (sem teto, hipótese) |
|---|---|---|
| Net PnL (110 trades) | +$3,24 | -$2,95 |
| Delta B - A | | **-$6,19** |
| Trades em que B melhorou | **0** | |
| Trades em que B piorou | 3 | |
| Trades sem diferença (nunca bateram no TP original) | 107 | |

**A hipótese está rejeitada pelo dado real**: em nenhum dos 110 trades
reais testados, remover o teto de TP e deixar correr produziu resultado
melhor. Nos 3 casos em que o preço bateu o TP original e continuou sendo
simulado sem fechar, o mercado reverteu depois e devolveu lucro antes do
trailing (2×ATR, bem largo) reagir — pior em todos os 3, nunca melhor.

## Interpretação

O trade manual do Cleber funcionou porque aquela hora específica de BTCUSD
teve tendência sustentada — "deixar correr" só compensa quando o
movimento continua. Aplicado como regra geral sobre um motor que abre
dezenas de trades por dia em condições de mercado variadas, "sempre deixar
correr sem teto" perde mais nas reversões do que ganha nas continuações,
pelo menos nesta amostra de 9 dias reais. Não é evidência de que "correr
mais gera lucro" generaliza — é o oposto: reforça que intuição de 1
trade não substitui teste contra dado real, exatamente a disciplina que
motivou este backtest.

## O que ainda vale testar (não feito nesta rodada)

Uma versão condicional: só suspender o teto de TP quando o mesmo sinal de
momentum já usado no gate de entrada (`MACD_MOMENTUM_FADING`) ainda estiver
**acelerando a favor** no momento em que o preço toca o TP — em vez de
"sempre deixar correr", deixar correr só quando há evidência de que o
movimento não acabou. Reusa infraestrutura já existente (cálculo de MACD
histograma já roda no motor), é testável com o mesmo método deste
experimento.

## Adendo 1: quantos trades reverteram de lucro pra prejuízo (pedido do Cleber)

Diagnóstico separado, sobre a janela REAL de vida de cada trade (entrada →
saída real gravada, sem simular fechamento): quantos chegaram a ter
excursão favorável (MFE, preço andando a favor) e mesmo assim fecharam no
prejuízo ou no zero?

- **76 de 123 trades reais (61,8%)** reverteram de lucro flutuante pra
  fechamento ≤ $0. Soma do PnL real desses 76: **-$57,88**.
- **58 desses 76 (76%) nunca chegaram no gatilho de breakeven atual
  (1,5R)** — pra esses, o mecanismo de proteção de entrada de hoje nunca
  tinha chance de agir, porque o movimento a favor nunca foi grande o
  suficiente pra armar.
- **18 dos 76 chegaram a bater ≥1,5R e deveriam ter sido protegidos perto
  de zero pelo breakeven já documentado — e mesmo assim fecharam negativo**.
  A maioria é perda pequena (US$0,02–0,66, compatível com custo de
  spread/slippage num fechamento perto do zero, não é bug). Mas pelo menos
  4-5 casos (ex: SOLUSD `4cee8a28` com MFE 4,58R fechando -$2,03; SOLUSD
  `3efe52b7` com MFE 1,71R fechando -$2,64; SOLUSD `fe0adc2e` com MFE 5,19R
  fechando -$1,65) têm perda grande demais pra ser só custo residual —
  merecem investigação de código à parte (reversão rápida que pulou o
  stop de breakeven? candle de 15m escondendo um movimento intrabar
  abrupto?). Não investigado nesta rodada.

## Adendo 2: variando o gatilho de breakeven (0,5R a 2R)

Mesma réplica, variando só `BREAKEVEN_TRIGGER_R` (hoje travado em 1,5,
subiu de 1 pra 1,5 em 2026-08-25), sobre os mesmos 123 trades:

| Gatilho | Net PnL simulado |
|---|---|
| 0,5R | **+$9,79** |
| 0,75R | +$3,34 |
| 1,0R | +$2,36 |
| 1,25R | +$0,59 |
| **1,5R (produção hoje)** | **-$2,68** |
| 2,0R | -$5,73 |

Sinal monotônico e limpo: quanto mais apertado o gatilho, melhor o
resultado fechado nesta amostra — e o valor **atual em produção está do
lado ruim da curva**.

**Ressalva importante, não posso omitir**: a mudança de 1R pra 1,5R em
2026-08-25 foi motivada por um custo que este sweep NÃO mede — reabertura
rápida depois de um stop prematuro perto de zero, pagando spread/comissão
de novo (round-trip). Este teste só mede o PnL do trade fechado, não o
efeito de segunda ordem de reentrada. Not fair comparar direto sem incluir
esse custo — antes de sequer cogitar mexer no valor de produção, falta
testar as duas coisas juntas (PnL do fechamento + custo de reentrada) no
mesmo backtest.

## Adendo 3: TP condicional a momentum (MACD), a versão refinada pedida

Testei a versão "mais esperta" da hipótese rejeitada acima: só suspende o
teto de TP quando o histograma MACD ainda está acelerando a favor no
momento em que o preço toca o alvo (reusa o mesmo sinal do gate de
entrada `MACD_MOMENTUM_FADING`).

110 trades DINAMICO pareados: net com teto fixo +$3,24, net com teto
condicional a momentum +$2,23 (**delta -$1,01**) — **0 melhoraram, 2
pioraram, 108 idênticos** (a condição de "momentum ainda acelerando
exatamente no toque do TP" quase nunca se sustenta neste dado real).
Também rejeitado.

## Adendo 4: proposta refinada do Cleber (breakeven mais cedo + trailing mais apertado, sem teto) — achado de artefato de método, não de mercado

Pedido: testar breakeven bem mais cedo + stop "pouco atrás do preço"
(trailing mais apertado) + sem teto de TP, pra ver se isso destrava o
"deixar correr com segurança" que os testes anteriores rejeitaram com o
trailing atual (2×ATR, largo).

Rodei uma varredura 2D: breakeven ∈ {0,25R...1,5R} × multiplicador de ATR
do trailing ∈ {0,5...2,0}, sem teto de TP, sobre os 110 trades DINAMICO.

**Primeiro resultado (não confiável — encontrei e não escondo)**: com
multiplicador ≤ 0,5×ATR, o resultado simulado saltou pra **+$49 a +$52**,
contra +$3,24 do baseline real de produção — e o número saiu **idêntico
bit a bit** pra 0,75R, 1R e 1,5R de breakeven, o que é logicamente
impossível se o teste fosse limpo (parâmetros diferentes não podem dar o
mesmo resultado exato por coincidência num backtest com side real). Isso é
a assinatura de um artefato de método, não de um edge real.

Investiguei a causa: minha simulação usa candle de 15 minutos e, dentro de
cada candle, deixa o trailing "alcançar" a máxima/mínima do candle antes de
checar se o stop foi batido — uma ordem de eventos otimista que só é
inofensiva quando a distância do trailing é maior que o range típico de um
candle. Medi: **92% dos candles de 15m do SOLUSD têm range (máxima-mínima)
maior que 0,5×ATR** — ou seja, pra um trailing tão apertado, minha
simulação está efetivamente "vendo o futuro dentro do candle" quase toda
vez. **Descartado. Não é um achado de mercado, é limite do método.**

**O que sobra de confiável**: só a parte da grade onde a distância do
trailing é maior que o candle típico (mult 1,5–2,0), onde essa ambiguidade
importa bem menos. Ali o sinal é modesto, não o "+$49":

| Config | Net (110 trades) |
|---|---|
| Produção hoje (breakeven 1,5R, trail 2×ATR, **com teto**) | +$3,24 |
| Sem teto, trail 2×ATR (testado no Adendo 1) | -$2,95 |
| Sem teto, trail 1,5×ATR, breakeven 1–1,5R | **+$4,94 a +$4,97** |

Ou seja: apertar o trailing de 2× pra 1,5×ATR e tirar o teto de TP dá uma
melhora real mas pequena (~+$1,7 sobre 110 trades em 9 dias) — nada perto
de "ganhar muito". Pra testar de verdade a parte mais apertada da sua
intuição (trailing bem colado no preço), preciso de candle de 1 minuto
(granularidade real do `ai-runner`, que roda a cada 1min), não 15min — é
o próximo passo, não feito nesta rodada.

## Adendo 5: o motor já tem detector de tendência — só é muito novo pra validar

Cleber pediu pra investigar se o motor "entende o que é tendência". Achado
de código: **já existe**, não precisa construir do zero.
`src/app/services/MarketScoreEngine.ts` → `detectRegime(adx, bbWidth)`:
ADX>25 → `TENDENCIA`, ADX<18 → `LATERAL`, entre os dois → `INDEFINIDO`
(ADX é uma medida clássica e legítima de força de tendência, não
inventada agora). A sessão de produção atual já está configurada com
`marketMode: 'TREND'` — ou seja, o pedido já é a preferência ativa
configurada, só ainda soft-gate (exige confiança extra quando o regime
medido diverge, não bloqueia, desde 2026-08-17).

**Limite real**: o regime só passou a ser gravado por trade (join
`ai_decisions.technical_signals→ai_trades`) a partir de 2026-08-24 —
2 dias de dado real até agora. Leitura inicial, não validação:

| Regime na entrada | Trades | Net PnL | Win rate |
|---|---|---|---|
| TENDENCIA (ADX>25) | 17 | -$0,36 | 29,4% |
| INDEFINIDO | 14 | -$1,25 | 21,4% |

Direção consistente com a intuição do Cleber (tendência real performa
melhor), mas amostra pequena demais e concentrada em poucos trades
grandes pra validar — precisa de mais semanas de dado, mesma disciplina
de todo o resto deste documento.

Testei também a versão natural de "deixar correr só quando o regime na
entrada for TENDENCIA" (reusa a réplica do Adendo 1) — **inconclusivo**:
só 6 trades têm regime gravado + rodaram em DINAMICO + têm candle
suficiente, e nenhum sequer chegou a tocar o TP original nessa janela.
Não é rejeição, é "não dá pra saber ainda" — precisa esperar a coluna de
regime acumular mais histórico antes de testar de novo.

## Adendo 6: fechando a pendência do Adendo 2 — custo de reentrada medido de verdade

A ressalva do Adendo 2 (apertar o breakeven pode só estar empurrando custo
de reentrada pra debaixo do tapete) tinha que ser fechada antes de
recomendar qualquer coisa. Medi empiricamente em produção (45 dias,
BTC/ETH/SOL): depois de um fechamento perto de zero (|net_pnl|<$0,15), a
chance real de reabrir o mesmo símbolo/sessão em até 30min é **57,8%**,
contra **48,4%** pra fechamentos normais — diferença real mas modesta
(9,4pp), custo médio da reentrada quando acontece: **$0,0114**.

Apliquei esse custo esperado (medido, não estimado) em cada nível de
breakeven do Adendo 2:

| Gatilho | Net bruto | Fechamentos perto de zero | Custo esperado de reentrada | **Net ajustado** |
|---|---|---|---|---|
| 0,5R | +$9,79 | 55 | -$0,74 | **+$9,05** |
| 0,75R | +$3,34 | 41 | -$0,72 | **+$2,61** |
| 1,0R | +$2,36 | 36 | -$0,72 | **+$1,64** |
| 1,25R | +$0,59 | 29 | -$0,71 | **-$0,12** |
| **1,5R (produção hoje)** | -$2,68 | 18 | -$0,70 | **-$3,38** |
| 2,0R | -$5,73 | 12 | -$0,69 | **-$6,43** |

**Conclusão: a ressalva não derruba o achado.** O custo extra de reentrada
em gatilhos apertados é real mas pequeno (~$0,70 em todos os níveis,
porque a diferença de taxa de reabertura entre fechamento perto de zero e
normal é de só 9,4pp) — não chega perto de anular a melhora de ~$12 entre
1,5R e 0,5R. **Esta é agora a recomendação mais validada de toda a
sessão**: o gatilho de breakeven em produção (1,5R) está calibrado do lado
pior da curva, mesmo depois de contabilizar o motivo que levou a subi-lo
em 2026-08-25.

Limite que continua valendo (não escondo): a taxa de reabertura foi medida
com o sistema real alternando modos e gatilho — não é garantia de que se
comportaria idêntico com 0,5R fixo o tempo todo. Ainda assim, a margem de
segurança (~$12 vs ~$0,70) é grande o suficiente pra sustentar a
recomendação mesmo com essa incerteza.

## Adendo 7: "stop-and-reverse" (entrar do lado oposto quando o stop bate) — rejeitado

Pedido do Cleber, inspirado no próprio trade manual (short perdeu pouco →
virou long → ganhou grande): quando o stop bate, abrir automaticamente uma
posição no lado oposto, mesma distância de risco espelhada (R:R 1:3),
usando candle real posterior à saída (sem look-ahead).

**118 reversões testadas sobre trades reais que fecharam por SL**: a
reversão sozinha perdeu -$9,65 líquido (só 6 de 118 bateram TP, 112
bateram o próprio SL). Ajudou em 15 casos, piorou em 84. Combinado
(trade original + reversão), o resultado ficou PIOR que o trade original
sozinho (-$24,23 vs. -$14,58).

**Rejeitado com folga, mesma leitura estatística de sempre**: um stop
batendo é um dado sobre aquela direção específica ter falhado — não é
evidência de que a direção oposta tem valor esperado positivo. Reverter
sem nenhum filtro é apostar de novo, com o mesmo custo, sem edge adicional.
Uma versão condicionada a regime/momentum poderia, em teoria, filtrar
melhor — mas dado o tamanho da rejeição (84 contra 15), não há sinal de
sobra aqui pra apostar que um filtro resolveria; não recomendo perseguir
essa variante sem achado novo que justifique.

## Implementado nesta sessão (2026-08-26)

`BREAKEVEN_TRIGGER_R`: **1,5R → 1R** (reversão pro valor anterior já
testado em produção, não o ótimo do backtest — ver comentário em
`TradeFrictionControls.ts` pra justificativa completa e a ressalva de
overfitting). `npm run validate` passou limpo. Falta: commit + push
(Cleber) + `supabase functions deploy ai-runner --no-verify-jwt` (client
sozinho não muda o motor real).

## Aside não conclusivo

Nos dados reais, sessões em modo `FIXO` (sem trailing) teiveram resultado
líquido menos negativo (-$2,45 em 22 trades) que sessões `DINAMICO`
(-$16,56 em 144 trades) no mesmo período. Amostra pequena e desbalanceada
demais (22 vs. 144, períodos de mercado diferentes) pra tirar conclusão —
registrado aqui só para não esconder, não como achado.
