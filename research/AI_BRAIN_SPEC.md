# Cérebro de Decisão da AI Trader — Especificação

> Documento fundador do motor de decisão autônomo. Escrito em 2026-07-24 a partir do
> briefing do Cleber. Substitui qualquer premissa anterior sobre o comportamento da IA.
>
> **Regra deste documento:** nada entra em produção sem passar pelos critérios da seção 8.
> Se um item aqui não puder ser validado com dado real, ele não é implementado — é
> registrado na seção 10 como limitação conhecida.

---

## 1. Objetivo declarado (função objetivo formal)

O sistema maximiza **retorno ajustado a risco sob restrição de sobrevivência**.

Formalmente, maximizar o Sharpe/Sortino da curva de capital sujeito a:

- `drawdown(t) ≤ D_max` para todo t (restrição rígida, não penalidade)
- perda diária ≤ `L_dia`
- exposição simultânea ≤ `E_max`

A restrição de sobrevivência tem precedência absoluta sobre o retorno. Um sistema que
rende 200% e depois zera a conta tem utilidade negativa — a ruína é absorvente, não é
"um drawdown grande". Toda decisão de dimensionamento deriva disso.

**O que NÃO é a função objetivo:** retorno absoluto máximo, win rate alto, número de
trades. Cada um desses, otimizado isoladamente, degrada o objetivo real (win rate alto
é trivialmente atingível aceitando cauda de perda ilimitada).

---

## 2. Comportamento alvo (briefing do usuário, traduzido em requisitos)

| # | Requisito | Status técnico |
|---|---|---|
| R1 | Liga uma vez, opera continuamente (entra, sai, entra de novo) sem reintervenção | Já suportado pelo loop atual |
| R2 | Varre os ativos selecionados pelo usuário e escolhe onde a próxima entrada rende mais **em dinheiro** | Núcleo novo — seção 5 |
| R3 | Três modos de alvo: Scalper, Médio (200–600 pts), Amplo (>600 pts) | Seção 4 |
| R4 | Domina Price Action, S/R, Fibonacci, estrutura de mercado | Base existe (motor SMC validado) — seção 3 |
| R5 | Usa volume, volatilidade e pressão de mercado no instante da entrada | Parcial — ver limitação L2 |
| R6 | Consciência de notícias do dia e surpresas intradiárias | Parcial — ver limitação L3 |
| R7 | Aprende continuamente e registra padrões para uso futuro | Seção 6 — implementação difere do pedido literal, ver justificativa |
| R8 | Gerenciamento de risco que impede a quebra da banca | Seção 7 |
| R9 | Conhece a dinâmica e peculiaridade de cada ativo | Seção 6.2 (perfil por ativo) |

---

## 3. Arquitetura em camadas

Cada camada tem uma responsabilidade única e é testável isoladamente. Nenhuma camada
"chuta" quando não tem dado — ela declara indisponibilidade e a camada acima decide.

```
┌─ L5 EXECUÇÃO ──────── envelope de risco → ordem (DEMO ou REAL)
│
├─ L4 ALOCAÇÃO ──────── quanto apostar (Kelly fracionário + tetos)
│
├─ L3 SELEÇÃO ───────── qual ativo, entre os candidatos (expectativa em $)
│
├─ L2 AVALIAÇÃO ─────── por ativo: probabilidade calibrada + payoff esperado
│
└─ L1 EVIDÊNCIA ─────── sinais brutos, cada um com proveniência declarada
```

**L1 — Evidência.** Fontes independentes, cada uma retornando valor + confiança +
proveniência (`real` / `stale` / `unavailable`). Nunca fabrica. Fontes disponíveis hoje:

- Estrutura de mercado / Price Action: motor SMC (`src/app/services/smc/`) — Order Blocks,
  FVG, Liquidity Pools, BOS/CHoCH. Determinístico, 12 asserções validadas.
- Tendência / momentum / volume: `MarketScoreEngine` — validado por walk-forward.
- Indicadores técnicos: `TechnicalIndicators` — 14 asserções validadas.
- Níveis: S/R por proximidade + zonas macro não mitigadas; Fibonacci sobre swing real.
- Microestrutura: desequilíbrio de book — **só cripto** (Binance). Ver L2.
- Contexto macro: calendário econômico e notícias. Ver L3.

**L2 — Avaliação por ativo.** Converte evidência em duas grandezas, e só nelas:

- `p` = probabilidade **calibrada** de o alvo ser atingido antes do stop
- `payoff` = razão alvo/stop em pontos, convertida em dinheiro pelo contrato do ativo

Calibração é obrigatória e é o que separa isto de um brinquedo: um score de 80 não é
80% de acerto. A conversão score → probabilidade vem de regressão isotônica ajustada
sobre resultados históricos reais e revalidada periodicamente (seção 6).

**L3 — Seleção entre ativos.** Seção 5.

**L4 — Alocação.** Kelly fracionário (fração ≤ 0,25 do Kelly pleno) sobre `p` e `payoff`,
limitado por: risco máximo por trade, exposição por grupo de correlação, exposição total.
Kelly pleno é matematicamente ótimo para crescimento e praticamente suicida — a estimativa
de `p` tem erro, e Kelly amplifica erro de estimativa.

**L5 — Execução.** Envelope de risco (seção 7) + ponte demo/real (documento à parte —
essa camada não é escopo desta spec e tem requisitos de segurança próprios).

---

## 4. Modos operacionais e viabilidade por custo

Três modos, definidos pelo alvo em pontos:

| Modo | Alvo | Horizonte típico |
|---|---|---|
| Scalper | abaixo de 200 pts | minutos |
| Médio | 200–600 pts | horas |
| Amplo | acima de 600 pts | horas a dias |

**Gate de viabilidade (obrigatório, roda antes de qualquer entrada).** Para cada par
(ativo, modo), o custo total de ida e volta — spread + comissão + slippage estimado — é
convertido em pontos e comparado ao alvo. Define-se o *break-even win rate*:

```
p_min = (L + C) / (R + L)
```

onde R = alvo em $, L = stop em $, C = custo total em $.

Se a probabilidade calibrada `p` do setup não superar `p_min` com margem de segurança,
**o par (ativo, modo) é recusado** e o motivo é registrado no log. Não há entrada
"na esperança".

Consequência esperada e aceita: em vários ativos, o modo Scalper será recusado quase
sempre — porque com spread de CFD o custo consome o alvo. Isso não é falha do sistema;
é o sistema se recusando a operar com expectativa negativa. O log deve deixar isso
explícito para o usuário entender por que a IA não opera scalp naquele ativo.

---

## 5. Seleção de ativo — o núcleo novo

**Problema:** dados N ativos selecionados pelo usuário, escolher onde entrar agora.

**Formulação.** Para cada ativo candidato i, com probabilidade calibrada `p_i`, ganho
`R_i` e perda `L_i` em dinheiro (já descontado custo `C_i`):

```
E_i  = p_i · R_i − (1 − p_i) · L_i − C_i        (expectativa em $)
S_i  = E_i / σ_i                                 (expectativa por unidade de risco)
```

Escolher `argmax S_i`, não `argmax E_i` — maximizar expectativa bruta concentra
sistematicamente nos ativos mais voláteis, que é como se quebra uma conta.

### 5.1 Correção obrigatória de viés de seleção

Escolher o máximo entre N estimativas ruidosas produz um valor enviesado para cima:
mesmo com N ativos sem edge nenhum, o "melhor" parecerá bom. Duas correções, ambas
obrigatórias:

1. **Shrinkage.** Puxar cada `p_i` na direção da taxa-base histórica daquele ativo,
   com intensidade inversa ao tamanho da amostra disponível. Ativo com poucos trades
   registrados tem estimativa fortemente encolhida — não pode "ganhar" a seleção por
   sorte de amostra pequena.
2. **Limiar que cresce com N.** O `S_i` vencedor precisa superar um piso que aumenta
   com o número de candidatos avaliados. Varrer 50 ativos exige evidência mais forte
   que varrer 5, porque a chance de um falso positivo aparecer cresce com N.

Se nenhum candidato passar o limiar: **não opera**. Ficar de fora é uma decisão válida
e deve ser a mais comum. Um sistema que sempre encontra uma entrada não está
selecionando — está racionalizando.

### 5.1.1 Gate de capital mínimo (aporte mínimo definido: US$50)

Além do gate de viabilidade por custo (seção 4), a seleção precisa recusar qualquer
ativo cujo **lote mínimo negociável**, dado o capital do usuário, exigiria arriscar
mais do que o envelope de risco permite (seção 7) — ou exigiria alavancagem alta o
bastante pra tornar 1-2 trades ruins um evento de margin call.

Com US$50 de capital, contratos de índice/CFD padrão (ex: US30 a $1/ponto) costumam
ser inoperáveis dentro de um risco de 1-2% por trade sem alavancagem excessiva — isso
não é uma exceção rara, é o caso comum no aporte mínimo. O universo efetivamente
operável por conta pequena tende a ser mais estreito (majors de forex com lote micro,
cripto fracionável) do que o catálogo completo que o usuário pode selecionar na tela.

Consequência de design: o motor precisa checar, por (ativo, capital do usuário),
se existe um tamanho de posição que respeita simultaneamente (a) o lote mínimo da
corretora e (b) o risco máximo por trade — e recusar o ativo quando não existe,
com o motivo explícito no log ("US30 requer risco mínimo de $X por lote, acima do
permitido para este capital"). Mesmo princípio do gate de custo: reportar por que
não operou, nunca forçar um tamanho que viola o envelope.

### 5.2 Diversificação

Se já houver posição aberta, candidatos do mesmo grupo de correlação têm `S_i`
penalizado. Duas posições correlacionadas são uma posição com o dobro do tamanho —
o risco real é o da carteira, nunca o do trade isolado.

---

## 6. Aprendizado — o que é seguro e o que não é

> **Decisão de produto travada (2026-07-24): aporte mínimo por usuário = US$50.** Alimenta
> diretamente o gate de capital mínimo da seção 5.1.1 — o universo de ativos operável no
> aporte mínimo é mais estreito que o catálogo completo, isso é esperado e deve ser
> comunicado ao usuário via log, nunca contornado afrouxando o risco por trade.

> **Divergência consciente do pedido literal.** O briefing pede aprendizado "a cada
> trade". Implementado literalmente, isso destrói o sistema: um trade não é amostra
> estatística, e atualizar parâmetros com base nele é aprender ruído. O desenho abaixo
> entrega o efeito desejado — a IA melhora continuamente com a experiência real — sem
> o modo de falha. Esta divergência foi explicitada ao usuário antes da implementação.

### 6.1 Três ritmos distintos

**Registro — a cada trade, sempre.** No instante da entrada, grava o vetor completo de
features (todos os sinais de L1, regime, volatilidade, sessão, contexto de notícia,
custo estimado) mais a probabilidade prevista. Na saída, grava o resultado. Isso é o
diário da IA e não tem risco nenhum: é observação, não ajuste.

**Calibração — periódica (semanal ou a cada N trades fechados, o que vier depois).**
Compara probabilidade prevista com frequência observada e reajusta a curva de calibração.
Se o modelo diz 70% e a realidade é 55%, a correção é aqui. É aprendizado real, mede
uma propriedade estável, e é seguro porque não altera *quais* sinais são usados — só
corrige a tradução de score para probabilidade.

**Retreino — em ciclos, com gate de promoção.** Reajuste de pesos e limiares só entra em
produção após passar a validação da seção 8, com margem sobre o modelo vigente. Modelo
novo que empata não substitui o antigo (evita rotatividade por ruído). Todo modelo
promovido fica versionado, com data e métricas — e é revogável.

### 6.2 Perfil por ativo (requisito R9)

Cada ativo acumula seu próprio perfil estatístico a partir do registro: taxa-base de
acerto por modo, distribuição de MFE/MAE, comportamento por sessão (asiática/europeia/
americana), sensibilidade a evento macro, custo efetivo medido (slippage real, não
estimado). Esse perfil alimenta o shrinkage de 5.1 e o gate de 4.

É assim que "conhecer a peculiaridade de cada ativo" vira número em vez de sensação —
e a única forma honesta: derivado do que aconteceu, não de regra escrita à mão.

---

## 7. Envelope de risco (restrição rígida)

Aplicado em duas camadas: gate pré-trade (síncrono, veta a entrada) e Health Check
(assíncrono, pausa o sistema). Já parcialmente implementado — ver `RISK_MODULE_SPEC.md`.

| Limite | Comportamento ao violar |
|---|---|
| Risco por trade | reduz tamanho; se inviável, recusa |
| Drawdown (âncora INTRADAY_PEAK ou DAILY_CLOSE) | Safe Mode |
| Perda diária | Safe Mode até o próximo dia |
| Trades por dia | recusa novas entradas |
| Exposição por grupo de correlação | reduz tamanho da nova posição |
| Perdas consecutivas | cooldown temporizado |
| Win rate abaixo do mínimo (amostra ≥ 10) | Safe Mode |

**Princípio inegociável:** o envelope é verificado *antes* da decisão de entrada, nunca
depois. Um gate que roda após a ordem não é gate, é relatório.

---

## 8. Validação e critérios de promoção

Nenhuma mudança no cérebro entra em produção sem:

1. **`npm run validate` verde** — type-check do motor + asserções determinísticas.
2. **Walk-forward sem look-ahead**, com *purging* e *embargo* entre treino e teste
   (barras adjacentes vazam informação; sem purging o resultado é otimista e falso).
3. **Custo de transação descontado** — resultado bruto não é aceito como evidência.
4. **Deflated Sharpe Ratio** — corrige o Sharpe pelo número de configurações testadas.
   Testar 50 variações e escolher a melhor produz Sharpe alto por acaso; sem essa
   correção, calibração vira busca de ruído com aparência de rigor.
5. **Amostra mínima** — abaixo de ~100 sinais no conjunto de teste, o resultado é
   inconclusivo e o modelo não é promovido, mesmo que pareça excelente.
6. **Degradação out-of-sample dentro do limite** — queda de desempenho fora da amostra
   acima do aceitável reprova, mesmo com resultado in-sample forte.

Critério de reprovação explícito: se o modelo novo não supera o vigente com margem
estatística, **o vigente permanece**. O padrão é não mudar.

---

## 9. Roadmap

Cada fase entrega algo verificável e é pré-requisito da seguinte. Nenhuma fase começa
com a anterior "quase pronta".

**Fase 1 — Instrumento de medição.** Modelo de custo real por ativo (spread, comissão,
slippage); integração ao validador; purging/embargo; Deflated Sharpe. *Entregável: as
estratégias atuais medidas com custo real — a resposta honesta sobre o que já funciona.*

**Fase 2 — Probabilidade calibrada.** Pipeline de registro de features; curva de
calibração score → probabilidade validada out-of-sample. *Entregável: a IA passa a dizer
"62% de chance" e isso ser verdade, verificável.*

**Fase 3 — Seleção entre ativos.** Expectativa em dinheiro, shrinkage, limiar por N,
gate de viabilidade por modo. *Entregável: R2 e R3 funcionando de fato.*

**Fase 4 — Alocação.** Kelly fracionário ligado à probabilidade calibrada, com tetos.
*Entregável: tamanho de posição derivado do edge, não arbitrário.*

**Fase 5 — Perfil por ativo e ciclo de aprendizado.** Perfis estatísticos, calibração
periódica automática, gate de promoção de modelo. *Entregável: R7 e R9.*

**Fase 6 — Ponte de execução real.** Documento e projeto próprios. Circuito de segurança
antes de qualquer código; conta demo de corretora; shadow mode com prova acumulada;
só então dinheiro real, com tamanho mínimo.

---

## 11. Redesenho das estratégias-preset e calibração de custo (2026-07-24)

As 6 estratégias-preset originais (herdadas do Figma Make: "Rompimento", "TDSM_98",
"Indicador de Retrocessos", "False Breaktroughs", "AA PURE BREAK", "WIKIOSKIT
EXECUTION") foram substituídas por 4 arquétipos com desenho e fonte declarados —
ver `src/app/data/presetStrategies.ts`. Motivo: SL/TP fixo em pontos, igual para
qualquer ativo/volatilidade, é problema conhecido na literatura (não debate) —
normaliza mal o risco entre EURUSD e um índice, e corta trades de tendência forte
no mesmo alvo que um trade fraco atinge por acaso. Nenhuma das 6 tinha filtro de
regime real (ADX como gate, não decoração), o que a pesquisa aponta como a causa
mais provável de falha fora de amostra em sistemas de cruzamento de médias.

**Arquétipos novos** (todos com `regime` declarado + FILTER de ADX real):
1. **Rompimento de Canal (Donchian)** — TREND. Compra no rompimento da máxima de
   20 períodos, stop 2×ATR, sem alvo fixo (`takeProfitMode:'TRAILING_ONLY'`, deixa
   o lucro correr via trailing/reversão de canal). Desenho canônico de
   trend-following sistemático (Turtle Traders, Dennis/Eckhardt — amplamente
   reportado, não verificado em texto primário nesta pesquisa); suporte de longo
   prazo em Hurst/Ooi/Pedersen, "A Century of Evidence on Trend-Following
   Investing" (AQR/SSRN, Journal of Portfolio Management 2017).
2. **Cruzamento de Médias com Filtro de Regime** — TREND. EMA20×EMA50 + EMA50
   inclinada + ADX>20. O ADX é o fix direto do problema #1 do diagnóstico.
3. **Reversão à Média (RSI + Bollinger)** — RANGE. Só opera com ADX<22 (mercado
   lateral) — mean-reversion documentado como pior em tendência forte
   (Quantpedia).
4. **Rompimento Confirmado (Volume)** — BREAKOUT. Donchian + OBV subindo
   (confirmação de volume), reduz falso rompimento vs. breakout que reage só ao
   toque do nível.

Todas usam position sizing 1% fixed-fractional (não 2% linear como antes) — Van
Tharp: fixed-fractional 1-2% é o padrão de mercado para trading de varejo; Kelly
pleno amplifica erro de estimativa de win rate em drawdown extremo.

**Suporte de engine adicionado para isso ser real, não só dado**: `calculateDonchian`
(`TechnicalIndicators.ts`, sem look-ahead — janela `[i-period, i-1]`, testado);
`Strategy.stopLossMode`/`takeProfitMode` ('POINTS'|'ATR'|'TRAILING_ONLY',
`types/strategy.ts`); `TradeSizing.resolveTpSl` (calcula distância real por ATR do
candle de entrada); `useBacktestLiveProgress.ts` ligado a isso. O builder manual
(`StrategyBuilderPro.tsx`) continua 100% em pontos fixos — nada mudou lá, escopo
consciente.

**Gap conhecido, não fechado nesta rodada**: a IA ao vivo (`useApexLogic.ts`) usa
`aiConfig.targetPoints` (preset do usuário) para TP/SL, não `strategy.stopLoss`/
`stopLossMode` da estratégia selecionada — os dois sistemas nunca foram
unificados. O ATR-based sizing desta rodada vale hoje só para o Backtest (onde
`strategy.stopLoss/takeProfit` de fato é lido). Unificar isso é trabalho do
"cérebro definitivo" (fases 3-4 do roadmap), não desta limpeza pontual.

**Migração de dados**: presets antigos com `id` fora de `['1','2','3','4']` podem
existir como linha seed no Supabase (`strategies`, `is_preset:true`,
`definition:{}`) de sessões anteriores. `useStrategies.ts` descarta essas linhas
no client (nunca expõe preset órfão sem definição local) — nenhuma migration de
banco é necessária, e nenhuma config de usuário salva com um `activeStrategyId`
antigo deveria mais crashar (a linha vira `null` e é filtrada antes de chegar ao
motor).

### Calibração de custo de transação (CostModel.ts)

Pesquisa real contra concorrentes (IC Markets, Pepperstone, FXTM, Exness — contas
Raw/ECN, o modelo relevante para execução automatizada via MT5/MetaAPI) recalibrou
`research/CostModel.ts`. Custo round-trip recomendado por classe: forex major
0,5pt spread + 0,2pt slippage (≈0,7-0,9pt total); exótico ancorado em USDTRY real
(~16pt, Pepperstone) com folga de slippage; XAUUSD ~1,2pt (Infinox/Pepperstone
Raw); índice ~3pt+1,5pt slippage (Pepperstone US30 Raw); cripto modelado em %
(0,08%) por ter spread proporcional ao preço, não pips fixos.

**Lacunas explícitas, não escondidas**: EURGBP (minor) e USDZAR não têm spread
publicado encontrado — os valores de `FOREX_MINOR`/parte de `FOREX_EXOTIC` são
extrapolação marcada como tal no comentário do código, não dado confirmado. Ação
CFD não foi pesquisada nesta rodada — o valor antigo (não calibrado) permanece,
sinalizado. Slippage em geral não é publicado por nenhuma corretora — todos os
valores de slippage no modelo são estimativa baseada em liquidez conhecida da
classe, nunca dado de mercado medido. O número real de execução (comparando preço
solicitado vs. preço reportado por `/broker/execute`) só existirá depois que a
Fase B (execução real) rodar — é o próximo ponto de recalibração.

## 11.1 Arquétipo Scalp (2026-07-24, continuação) — candidato, não recomendação

Adicionado 5º preset (`id:'5'`, "Momentum de Curto Prazo (Scalp)", `regime:'SCALP'`):
MACD cruza acima de zero + RSI 50-70 + ADX>18, timeframe 1m, stop 1×ATR/alvo
1,5×ATR. Desenho de momentum de curto prazo, não "pegar ruído".

**Por que é tratado diferente dos outros 4**: com o custo calibrado (seção 11), o
spread em si cabe no orçamento de um scalp em forex major (~0,7-0,9pt round-trip
contra um alvo de ~10-15pt). O problema real e específico desta plataforma é
**latência de execução** — documentado extensivamente no histórico do projeto
(`CLAUDE.md`, dezenas de sessões): a conta MetaAPI compartilhada responde
tipicamente em 3-9s por chamada, às vezes com rate-limit (HTTP 429/504).
Scalping exige execução em frações de segundo; nessa latência, o preço já andou
antes da ordem sair — isso não é custo que se desconta, é limite físico da
infraestrutura atual.

**Gate de viabilidade implementado** (`research/CostModel.ts`):
`breakEvenWinRate(alvo, stop, custoRoundTrip)` — converte o custo real na taxa de
acerto mínima que a estratégia precisa bater só para empatar. Ainda não ligado a
nenhum caminho de produto (mesmo estado do resto do CostModel) — é o próximo
passo antes de sequer considerar habilitar scalp por padrão: medir a taxa de
acerto real via `MarketScoreValidator` por ativo, comparar contra `breakEvenWinRate`,
e só então decidir. Latência de execução real só é mensurável depois da Fase B.

**Decisão explícita**: este preset existe no catálogo (usuário pode selecioná-lo
manualmente), mas NÃO é o `activeStrategyId` default de nenhum fluxo, e não deve
ser recomendado ao usuário como "pronto" até os 3 passos acima acontecerem.

## 11.2 Decisão: "Rompimento de Topo com Fibonacci" NÃO virou 6º arquétipo (2026-07-24)

Cleber perguntou se valia contemplar um arquétipo de rompimento usando Fibonacci.
Avaliação honesta, para não ser relitigada sem contexto numa sessão futura:

Fibonacci de retração/extensão é o item de análise técnica com evidência mais
fraca entre os candidatos considerados nesta rodada — o mecanismo real por trás
não é lei de mercado, é profecia autorrealizável (gente suficiente observa o
mesmo nível e coloca ordem ali), categoria mais próxima de "número redondo"/pivot
clássico do que de trend-following/mean-reversion com décadas de replicação
(Turtle/AQR, Quantpedia) usados nos arquétipos 1-4. Adicionar um 6º arquétipo
"Fibonacci breakout" com a mesma pretensão de evidência dos outros cinco quebraria
a disciplina usada para desenhá-los.

**Decisão**: não adicionado como arquétipo próprio. Fibonacci já existe no sistema
do jeito que é defensável — como um dos 4 fatores do `MarketScoreEngine`
(`fibPosition`, peso 20%, validado indiretamente pelo walk-forward do
`MarketScoreValidator`), nunca como sinal isolado. Se no futuro fizer sentido usar
extensão de Fibonacci (127,2%/161,8%) como alvo de saída alternativo do Arquétipo 1
(rompimento Donchian, hoje `takeProfitMode:'TRAILING_ONLY'`), isso é uma extensão
pontual do arquétipo existente — não um arquétipo novo com pretensão de evidência
própria. Não implementado; revisitar só com pesquisa real se o Cleber pedir de novo.

## 12. Decisão de produto: aporte mínimo

Ver seção 5.1.1 e a nota no início da seção 6 — aporte mínimo travado em **US$50**.

## 10. Limitações conhecidas (declaradas, não escondidas)

**L1 — Sem microestrutura em não-cripto.** Order book real existe só para cripto
(Binance). CFD de forex/índice não tem book público — a corretora é market maker.
"Pressão de mercado" para esses ativos será derivada de volume de tick e delta de
candle, com confiança declarada menor, ou marcada indisponível. Nunca fabricada.

**L2 — Volume em CFD é volume de tick.** Não é volume negociado real (que não existe em
mercado OTC). Serve como proxy de atividade, não como fluxo institucional. Qualquer
conclusão sobre "fluxo institucional" a partir daí seria invenção.

**L3 — Notícias têm latência de minutos.** O agregador RSS e o calendário econômico
cobrem eventos programados bem e surpresas com atraso. O sistema pode *evitar* operar
em janelas de risco conhecido; não pode reagir a manchete em segundos. Prometer isso
seria falso.

**L4 — Slippage só é conhecido após operar.** A estimativa inicial vem de tabela por
classe de ativo; o valor real entra no perfil do ativo conforme trades acontecem. Até
lá, o custo é estimado conservadoramente (a favor da recusa, nunca da entrada).

**L5 — Nenhum edge é permanente.** Todo modelo promovido tem prazo de validade e
revalidação obrigatória. Degradação de desempenho é esperada, não é anomalia — a
resposta é reduzir exposição e revalidar, nunca "esperar voltar".
