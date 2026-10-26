# Order Block Fade — veredito (2026-08-24)

## Resultado

**1 de 21 séries testadas fechou positiva líquida de custo no holdout**
(XAUUSD 15m, +2,70%, DSR 53,1% — abaixo do piso de 95% do projeto, e essa
DSR nem corrige pela seleção entre as 21 séries, só pelos 4 R:Rs internos
daquela série; corrigindo por 21, fica ainda mais fraco). As outras 20 são
negativas líquidas, incluindo perdas grandes (XAGUSD 15m −34,5%, BTCUSD 1h
−19,5%). **Taxa de acerto média no holdout: 32,3%** — bem abaixo do que
qualquer R:R ≥ 1 precisa pra empatar com custo.

**Conclusão: sem edge comprovado.** Resultado consistente com a busca
sistemática de julho/agosto já fechada no projeto (nenhum dos 5 presets de
TA clássico foi lucrativo líquido de custo) — Order Block, apesar de vir de
um indicador de terceiro pago, é mais um método de leitura de preço público
sem edge estatístico detectável nesta amostra.

## Por que a hipótese do Cleber (alta taxa de acerto na zona) não se
confirmou

A observação dele — "quando o preço retorna à zona, reage muito" — é real
como PADRÃO VISUAL (é literalmente como o indicador é desenhado: zona =
onde já houve reação de preço antes). O que não se sustenta é o próximo
passo: que esse padrão visual, testado como regra de entrada objetiva
contra dado real e custo real, gera taxa de acerto suficiente pra cobrir o
R:R necessário. 32% de acerto médio é MUITO abaixo do que o cérebro humano
percebe olhando um gráfico — viés de confirmação clássico: quem olha o
gráfico lembra das vezes que a zona "segurou" e não registra as vezes que
rompeu direto, porque romper não deixa uma "reação visual" pra notar.

## Achado metodológico relevante (self-correção durante o experimento)

A primeira rodada deste backtest (antes de corrigir) deu resultado forte
POSITIVO em várias séries (DSR até 100% em NAS100 15m e XAUUSD 15m) — no
meio do processo, encontrei um bug de look-ahead na minha própria simulação
(não em produção): o campo `mitigatedAt` de `orderBlocks.ts` pode marcar uma
zona como "mitigada" ANTES do candle de rompimento que a confirma (o scan
de mitigação varre a partir de `baseIndex+1`, que fica até 20 candles antes
do rompimento). Usar esse timestamp puro como gatilho de entrada equivale a
operar uma zona antes dela existir. Corrigido em `zonesCausal.ts`
(entrada só válida se a mitigação acontecer DEPOIS do rompimento). Depois do
fix, o resultado colapsou de "parece ter edge forte" pra "sem edge" — **é
exatamente o tipo de armadilha que a disciplina de walk-forward/DSR do
projeto existe pra pegar**, e desta vez pegou dentro do próprio processo de
teste, antes de qualquer promoção incorreta pra produto.

## Também achado, reportado, não corrigido em produção

`detectStructureEvents` (`src/app/services/smc/marketStructure.ts`) usa o
índice bruto do swing como o momento em que ele fica "conhecido", mas o
método fractal (lookback=2) só confirma um swing 2 candles depois. É um
viés de look-ahead pequeno (~2 candles) que não afeta a exibição visual do
card "Detector de Liquidez" do Dashboard de forma perceptível, mas afetaria
qualquer decisão de trade que viesse a usar esse motor diretamente. Não
corrigido aqui (fora de escopo — motor de produção só muda com decisão do
Cleber + gate `npm run validate`), só documentado.

## Cobertura de dado

21/27 séries com dado real (9 ativos × {15m, 1h} completo; 5m só cripto —
a Edge Function `/mt5-candles-history` estourou recurso de computação pra
45 dias de 5m nos ativos MetaAPI, falha sistemática de infraestrutura, não
um problema deste teste). Sem dado fabricado em nenhum ponto.

## Decisão de produto sugerida

Não promover Order Block Fade como estratégia do motor. Mantém
`orderBlocks.ts`/card "Detector de Liquidez" como estão hoje — exibição
visual, sem decisão de trade atrelada. Consistente com a decisão de produto
já registrada em `CLAUDE.md` ("cérebro de execução e disciplina, não de
alfa").
