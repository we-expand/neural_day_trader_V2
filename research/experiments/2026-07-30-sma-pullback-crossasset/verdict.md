# Veredito — Cruzamento SMA 40/100 com pullback, BTCUSD M1

**Data**: 2026-07-30 · **Status**: REPROVADO, não promover
**Critérios aplicados**: [`research/CRITERIA.md`](../../CRITERIA.md)
**Ferramentas**: `CostModel.ts`, `DataSplit.ts`, `DeflatedSharpe.ts` (portadas para Python, fórmulas e constantes idênticas)

## Hipótese testada

Cruzamento de SMA 40/100 em M1; após a cruza, aguardar pullback e entrar no
primeiro candle a favor; stop 60 pontos, alvo 80 pontos, 0,01 contrato.
Depois: existe algum par (stop, alvo) e algum par de médias que torne o setup
viável líquido de custo?

## Dado

BTCUSDT M1 (Binance, dumps oficiais) — duas amostras:
- 6 meses: 2026-01-30 → 2026-07-29, 260.640 candles, cobertura 100%, zero gaps
- 5,6 anos: 2021-01-01 → 2026-07-29, 2.889.007 candles

## ⚠️ Correção (2026-07-30, mesma sessão): `CostModel.ts` superestima custo de cripto em ~18x

A primeira rodada deste experimento usou `CostModel.ts` CRYPTO = **0,26%
round-trip** e concluiu que a configuração era "matematicamente impossível".
Pesquisa de custo real desmontou essa premissa:

| Fonte | Dado | Data |
|---|---|---|
| Pepperstone (publicado pela corretora) | BTCUSD spread **mín. 10,00 / médio 15,82 USD**, referência de preço 108.829,77 → **0,0092% / 0,0145%** round-trip; **sem comissão** em cripto; **1 lote = 1 BTC** | 01–30/04/2026 |
| `CostModel.ts` CRYPTO | 0,08% comissão + 0,05% slippage por perna = **0,26%** round-trip | 2026-07-24 |

O valor da tabela parece calibrado com taxas de **exchange spot** (0,08%/lado é
típico de Binance/Coinbase), não de **CFD**, onde o custo é o spread e não há
comissão. **Ação sugerida ao projeto**: recalibrar `COST_TABLE.CRYPTO`. As
conclusões da seção 11.13 do `AI_BRAIN_SPEC.md` (cesta cripto) rodaram com esse
custo e devem ser remedidas.

Sobre a **Infinox especificamente**: não publica custo de cripto em lugar
nenhum verificável — a página de Trading Conditions e a de Product Information
trazem tabelas completas de Forex, Ações, Futuros e Índices e **nenhuma linha de
cripto**; a página de instrumentos lista apenas BTCXAU, BTCXBN e BTCXET
(cruzados), sem BTCUSD. A única cifra de terceiros é do AskTraders (jul/2022) e
é internamente contraditória ("0.69 on BTCUSD" e "$69 bid-offer spread" na mesma
página). Não há número da Infinox utilizável; Pepperstone é usada como âncora
medida — mesma prática que o `CostModel.ts` já adota para INDEX.

**O veredito abaixo não muda, mas a margem muda**: não é "impossível", é
"inviável por margem estreita e mensurável". Ver seção 5.

## Resultados

### 1. Gate de viabilidade por custo — com o custo ERRADO (0,26%)

`CostModel.ts` CRYPTO = 0,26% round-trip. Em BTC a US$ 70.000 = **182 pontos**
de custo por operação. Com `breakEvenWinRate(80, 60, 182)`:

| BTC | custo round-trip | p_min (alvo 80 / stop 60) |
|---|---:|---:|
| 60.000 | 156 pts | 154,3% |
| 70.000 | 182 pts | 172,9% |
| 84.000 | 218 pts | 198,9% |

A configuração pedida exige acerto acima de 100%. **Não tem solução possível** —
não é questão de calibrar melhor.

### 2. O sinal bruto existe, e é pequeno demais

Sem custo, em 6 meses, a variação "pullback até a SMA 100" mede acerto de
**48,97%** contra 42,86% de neutralidade (n=1.546, z=4,85, p=7,7e-07), positiva
nos 7 meses e nas duas direções. O controle sem pullback fica em 42,94% — ou
seja, **o pullback é que gera o sinal**, não o cruzamento.

Traduzido em pontos: **+0,085 ponto de vantagem por trade**. O custo é 145-182
pontos. O edge é real, estatisticamente sólido e vive inteiramente dentro do
custo de transação.

### 3. Grid 900 trials, 6 meses, walk-forward — nada sobrevive

15 pares de SMA × 6 stops × 5 razões × 2 definições de pullback. Split
treino/holdout com embargo, warmup fora da amostra.

- 367 trials com n ≥ 100 no holdout
- **0 com Sharpe de holdout positivo**
- SR0 (Sharpe do melhor esperado por acaso, N=900) = 1,208; melhor Sharpe
  observado = **−0,2006**
- Sharpe médio por faixa de stop: 140 pts → −1,07 · 279 pts → −0,54 · 558 pts → −0,34

A monotonia apontava para stops maiores, mas 6 meses não amostram essa região.

### 4. Região viável, 5,6 anos, 750 trials — a hipótese cai

Stops de 0,8% a 6,0% (446 a 3.347 pontos), 4 janelas walk-forward, warmup 1000
barras (o default 200 do `DataSplit.ts` não cobre SMA 400 — correção declarada).

- 608 trials elegíveis; **0 com Sharpe de holdout acima do SR0 (0,2988)**
- melhor caso escolhido a dedo olhando o próprio holdout: DSR = **12,2%** (piso 95%)
- campeão por treino: SMA 80/400, stop 4%, R:R 1:1 → treino +25,22%, holdout
  **−86,90%**, DSR 0,0%

**O teste que decide** — o edge de +6,11pp medido em 60/80 pontos não é
invariante de escala. Nos stops grandes ele é *negativo*:

| stop | acerto medido | neutro | edge bruto | n | z |
|---:|---:|---:|---:|---:|---:|
| 446 pts | 41,96% | 42,86% | −0,90pp | 49.347 | −4,03 |
| 837 pts | 42,19% | 42,86% | −0,67pp | 23.126 | −2,06 |
| 1.395 pts | 42,07% | 42,86% | −0,79pp | 10.713 | −1,65 |
| 2.231 pts | 42,46% | 42,86% | −0,40pp | 4.803 | −0,55 |

Com n de até 49 mil trades, não é falta de poder estatístico: o edge do pullback
**não existe** nessa escala. Ele é um fenômeno de microestrutura de 1-5 minutos,
de magnitude inferior ao custo.

### 5. Re-teste com o custo REAL — 1.050 trials, 5,6 anos

Grid refeito incluindo stops pequenos (56 pts), com o custo aplicado após a
simulação para varrer seis níveis sem re-simular. N acumulado da busca = 2.705.

| Custo round-trip | SR0 | melhor Sharpe holdout | >0 | >SR0 | melhor DSR |
|---|---:|---:|---:|---:|---:|
| 0,0092% (Pepperstone mín.) | 0,119 | +0,2231 | 281/1016 | **5** | 84,8% |
| **0,0145% (Pepperstone médio, medido)** | 0,161 | +0,2222 | 209/1016 | **3** | **72,8%** |
| 0,030% (folga p/ slippage) | 0,309 | +0,2196 | 131/1016 | 0 | 18,9% |
| 0,063% (leitura "$69") | 0,653 | +0,2141 | 97/1016 | 0 | 0,0% |
| 0,260% (`CostModel.ts`) | 2,716 | +0,1813 | 31/1016 | 0 | 0,0% |

No cenário realista, o campeão escolhido **só pelo treino** (SMA 80/400, stop
2.231 pts, R:R 1:1) faz Sharpe +0,0741 no treino e **−0,0702 no holdout**
(retorno líquido −46,40%), DSR **0,2%**. O melhor caso do holdout escolhido a
dedo chega a DSR 72,8% — ainda abaixo do piso de 95%.

### 6. O edge é real, robusto e menor que o custo

Com **202.075 trades** de holdout na faixa da configuração original:

| stop | alvo | acerto | neutro | edge | z | E[bruto]/trade | líq. @custo mín. |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 56 pts | 74 | 44,66% | 42,86% | **+1,80pp** | **+16,38** | +2,35 pts | **−2,78 pts** |
| 112 | 149 | 44,05% | 42,86% | +1,19pp | +9,46 | +3,10 pts | −2,03 pts |
| 223 | 298 | 43,58% | 42,86% | +0,72pp | +4,51 | +3,75 pts | −1,38 pts |
| 446 | 595 | 42,37% | 42,86% | −0,49pp | −2,21 | −5,12 pts | −10,25 pts |
| 1.395 | 1.859 | 42,11% | 42,86% | −0,75pp | −1,57 | −24,39 pts | −29,51 pts |

Duas leituras, ambas necessárias:

1. **O edge existe e é estatisticamente muito sólido** — z=+16,4 sobre 202 mil
   trades não é ruído. Decai monotonicamente com o tamanho do stop e vira
   negativo a partir de 446 pts: é um efeito de microestrutura de curtíssimo
   prazo, não uma propriedade de tendência.
2. **Ele vale ~2,35 pontos por trade e o menor custo de mercado é 5,1 pontos.**
   O edge é 46% do pedágio mínimo. Nenhuma faixa fica positiva líquida.

Os 6 meses mediram +6,11pp de edge; os 5,6 anos medem +1,80pp. A janela
jan–jul/2026 **inflou o edge em 3,4x** — exatamente o padrão da seção 11.11.

## Critérios de promoção

| Critério | Piso | Obtido | |
|---|---|---|---|
| Amostra | ≥100 sinais | 165 | ✅ |
| Líquido de custo | obrigatório | CostModel.ts aplicado | ✅ |
| Walk-forward sem look-ahead | obrigatório | DataSplit.ts, embargo real | ✅ |
| Degradação OOS | < 30% relativa | −444% | ❌ |
| Deflated Sharpe | ≥ 95% | **0,0%** | ❌ |

**REPROVADO.**

## Consistência com o histórico do projeto

Resultado alinhado com as seções 11.5→11.15 do `AI_BRAIN_SPEC.md`: 15
sub-investigações, nenhum arquétipo aprovado. O "Cruzamento EMA+ADX" (mesma
família de sinal) chegou a DSR 85,3% na seção 11.10 e caiu para 39,3% na 11.11
quando o calendário foi estendido — mesmo padrão observado aqui, com a mesma
causa: mais dado dissolve o que parecia edge.

Este experimento **não abre exceção** à decisão de 2026-07-26 (Trilho 2 pausado,
produto focado no pilar (a) execução/gestão de risco).

## 7. Teste estrutural cross-asset (2026-07-30) — fecha a investigação

Hipótese: a razão edge/custo é uma propriedade do **ativo** (BTC caro demais
de operar, outro ativo mais barato revelaria o mesmo sinal como lucrativo) ou
do **sinal** (razão baixa é uma lei da estratégia, não do custo de um ativo
específico)? Critério de corte fixado **antes** de rodar: razão de holdout
> 1,0 em ≥2 ativos independentes, DSR ≥ 95%, n ≥ 100.

Mesma estratégia exata (SMA 40/100, M1, pullback = 1º toque da SMA lenta —
variação "C", a de edge mais limpo em BTC), mesmo dimensionamento relativo
(stop 0,10% do preço, alvo 0,1333%, R:R 1:1,333 = a razão 60:80 original),
mesma disciplina de walk-forward com embargo, custo real medido na mesma
fonte (Pepperstone, spread mínimo, janela 01–30/04/2026) para os 4 ativos.
Dado: BTCUSD (5,6 anos, já existente) + EURUSD/US30/US500 via Dukascopy
(candles M1 oficiais, 2023-01 a 2026-07, ~1,2–1,9M candles cada).

**Problema de dado encontrado e corrigido**: o feed diário do Dukascopy
preenche minutos sem negociação (fim de semana/feriado) com candles achatados
(O=H=L=C=último preço), não com um buraco — ~35–40% dos candles de
EURUSD/US30/US500 tinham range zero, incluindo sequências de até 4.427 min
(~3 dias). Não removido, isso pode gerar cruzamento de SMA espúrio: a SMA
rápida "achata" mais cedo que a lenta durante o preço parado, cruzando por
geometria, não por preço real. Corrigido removendo sequências de flat ≥20 min
(`remover_mercado_fechado` em `cross_asset.py`) — **o resultado não mudou
materialmente** com a correção (EURUSD −1,62→−1,51; US30 −0,50→−0,43; US500
−0,43→−0,46), confirmando que o achado abaixo não é artefato do dado.

| Ativo | n holdout | acerto | neutro | z | edge/custo | DSR |
|---|---:|---:|---:|---:|---:|---:|
| BTCUSD | 4.996 | 45,72% | 42,86% | +4,08 | **+0,726** | 0,0% |
| EURUSD | 791 | 38,69% | 42,86% | −2,37 | **−1,509** | 0,0% |
| US30 | 1.016 | 42,03% | 42,86% | −0,53 | −0,426 | 0,0% |
| US500 | 1.045 | 41,53% | 42,86% | −0,87 | −0,464 | 0,0% |

**0 de 4 ativos com razão > 1,0 — critério de corte não atendido.**

Achado mais forte que o esperado: em **EURUSD, US30 e US500 o edge bruto é
NEGATIVO** (sinal contraprodutivo, não apenas "menor que o custo" como em
BTC). Não é que o custo varie e esconda um edge maior em ativo mais barato —
é que nos outros 3 ativos o padrão "cruza → pullback → resume a favor da
cruza" tende a **reverter** em vez de confirmar. O comportamento de BTC (edge
positivo, z=+4,08) parece específico à estrutura desse mercado (24/7, sem
gap de fim de semana, fluxo dominado por varejo/algo cripto), não uma
propriedade geral de médias móveis com pullback.

**Conclusão: a linha de busca "cruzamento de SMA + pullback" está fechada**,
com base estruturada, não por esgotamento de tentativa. Consistente com a
decisão de 2026-07-26 do projeto (pausar Trilho 2, focar no pilar (a)
execução/gestão de risco).

Reproduzir: `cross_asset.py` · `baixar_dukascopy.py` ·
`cross_asset_resultados.csv` · dados: `btcusd_m1_long.parquet`,
`dka_EURUSD.parquet`, `dka_USA30IDXUSD.parquet`, `dka_USA500IDXUSD.parquet`

## 8. M5/M15, segundo toque e a meta de 80% de acerto (1.600 trials)

Testado a pedido: timeframes M5 e M15, pullback exigindo **segundo toque** na
média, e razões R:R baixas o suficiente para produzir acerto >80%.

**A meta de 80% foi atingida** — 170 de 1.455 configurações elegíveis, melhor
caso 87,91% (M15, SMA 10/30, 2º toque, stop 1.395 / alvo 279). E é vazia:

| R:R | acerto medido | neutro (aritmético) | edge real | US$ médio |
|---|---:|---:|---:|---:|
| 1:0,20 | 80,0% | 83,3% | **−3,31pp** | −120,43 |
| 1:0,50 | 65,1% | 66,7% | −1,54pp | −100,80 |
| 1:1,00 | 49,6% | 50,0% | −0,37pp | −86,09 |
| 1:2,00 | 33,3% | 33,3% | −0,07pp | −75,39 |

A taxa de acerto neutra é `L/(R+L)` — consequência aritmética do R:R, não do
sinal. O acerto vai de 33% a 80% **só mudando o R:R**, com o neutro colado.
Nas faixas de acerto alto a estratégia acerta **menos que o acaso**. Edge médio
das 170 configurações com ≥80%: **−0,03pp**.

O campeão de 87,91%: z=+2,12 contra seu breakeven (83,82%), p bruto = 0,017 —
significativo isoladamente. Corrigido por Bonferroni pelos 1.455 testes:
**p = 1,000**. DSR máximo em qualquer cenário de custo: **1,8%**.

**M5/M15 são piores que M1**: zero configurações acima do SR0 (M1 tinha 3),
consistente com o edge ser de microestrutura de 1–5 min — agregar candles o
destrói. **O segundo toque não ajudou de forma consistente**: melhorou em M5
(−1,29pp → −0,49pp) e piorou em M15 (−1,76pp → −2,33pp); sinais opostos entre
timeframes é assinatura de ruído.

## 9. Stop dinâmico (trailing/breakeven) — testado e refutado

Hipótese do usuário: mover o stop para breakeven quando o preço anda a favor
resolveria as perdas de 1.395 pts da configuração de 87,91%.

| Gatilho breakeven | Acerto | E[líquido] | Sharpe | teste pareado vs baseline |
|---|---:|---:|---:|---|
| **sem trailing** | 87,91% | **+68,54 pts** | +0,1254 | — |
| 15% do caminho | 23,11% | +17,20 pts | +0,0640 | −59,79 pts, p=0,057 |
| 30% | 37,41% | +38,28 pts | +0,1164 | −39,86 pts, p=0,225 |
| 50% | 54,36% | +53,12 pts | +0,1307 | −20,70 pts, p=0,569 |
| 70% | 68,67% | +41,43 pts | +0,0829 | −20,70 pts, p=0,591 |

Os 4 níveis reduziram a expectativa. Individualmente não são significativos
(p>0,05), mas os 4 darem negativo já é informativo — se fosse ruído puro,
esperaríamos ~metade positiva.

**Decomposição exata (caso 30%), confere na casa decimal:**

| | |
|---|---|
| Perdas evitadas | +7,93pp × 1.395 = **+110,64** pts/trade |
| Ganhos sacrificados | −50,50pp × 279 = **−140,90** pts/trade |
| Líquido | **−30,26** pts/trade (medido: 46,39 − 76,65 = −30,26 ✓) |

Salva 7,93% dos trades de perder 1.395, mas sacrifica 50,50% dos que ganhariam
279 — **6,4x mais trades sacrificados que salvos**. Causa: o preço oscila, e um
vencedor de 279 pts frequentemente recua até a entrada antes de chegar lá. O
stop em breakeven fecha um portão que a maioria dos vencedores precisa cruzar.

**Fundamento teórico — Teorema da Parada Opcional (Doob)**: se o preço não tem
drift previsível, qualquer regra de parada que dependa apenas do caminho já
percorrido tem a **mesma expectativa**. Vale para trailing, breakeven, parcial,
stop por ATR, saída por tempo, pirâmide. Elas redistribuem a *distribuição* de
resultados (acerto, variância, assimetria) mantendo a média — e como geram mais
trades (364 → 463 no teste), **adicionam custo** e a expectativa cai.

Uma regra de saída só cria valor se usar **informação nova** que altere a
probabilidade dali para frente — não uma regra geométrica sobre o caminho do
preço. Encontrar essa informação é o problema que as 6.000+ configurações não
resolveram.

**Nota**: mesmo se o trailing tivesse melhorado, não atacaria o problema real —
aquela configuração **já é lucrativa no papel**. O que falta é confiança de que
os 87,91% se repetem (DSR 1,8%). Nenhuma engenharia de saída aumenta
significância estatística; otimizar a saída sobre um número selecionado só
refina o ajuste ao ruído.

## Reprodução

`load_data.py` · `backtest.py` · `quant.py` · `optimize.py` · `veredito.py` ·
`long_run.py` · `veredito_long.py` · `mtf.py` · `veredito_mtf.py` ·
`cross_asset.py` · `baixar_dukascopy.py` · `trailing.py` ·
`grid_resultados.csv` · `grid_long.csv` · `grid_mtf.csv` ·
`cross_asset_resultados.csv`
