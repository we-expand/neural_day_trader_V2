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

### 9.1 Fase 6 — desenho dos estágios (decidido em 2026-07-27, ainda não implementado)

Discussão de design conduzida com Cleber antes de qualquer código na ponte
decisão→execução (`useApexLogic.ts` → `/broker/execute`). Nada disto está
implementado ainda — é o contrato a seguir quando a implementação começar.

**Estágios sequenciais**, cada um só libera o próximo com prova acumulada
*operacional* (nunca lucro):

1. **LIVE + somente alerta.** Motor decide, mostra a decisão pro usuário
   (toast/log), não chama `/broker/execute`. Zero risco de dinheiro real.
2. **LIVE + confirmação manual por trade.** Motor decide, usuário aprova/
   rejeita cada entrada antes de ir pro `/broker/execute`.
3. **LIVE + execução automática**, com o circuito de segurança do health-check
   já existente (`useApexLogic.ts:798-868`) + tamanho de posição mínimo
   travado + hard-stop.
4. Remoção da trava de tamanho mínimo — só depois de estágio 3 provado.

**Decisões travadas para os estágios 1-2:**

- **Disclaimer obrigatório e permanente**: todo alerta/decisão LIVE exibido ao
  usuário vem sempre acompanhado do aviso "⚠️ Decisão baseada em regra técnica
  — sem validação estatística de edge comprovada." Em todo evento, não só
  onboarding — motivo: o motor não tem edge estatístico comprovado (seções
  11-11.15) e um disclaimer único se perde da memória do usuário.
- **Caminho de código isolado**: estágios 1-2 usam um módulo novo e pequeno,
  que só lê a decisão do motor e decide alertar/confirmar/executar — não
  reaproveita o `useApexLogic.ts` inteiro. Motivo: o motor atual já carrega
  histórico de bugs corrigidos (`targetPoints` vs. `strategy.stopLoss` nunca
  unificados — seção 11 acima; cálculo de custo cripto errado até 2026-07-25/
  26 — seção 11.13); herdar essa superfície pro caminho que eventualmente
  toca dinheiro real amplia o raio de um bug futuro.
- **Zero chamadas à MetaAPI compartilhada nesses estágios** — não há ordem
  real, então não há motivo pra tocar na conta. Throttling explícito no
  código (não só disciplina manual de teste) só entra a partir do estágio 3.

**Decisões travadas para o estágio 3:**

- **Fechamento automático de toda posição aberta quando o safe mode dispara**
  — nunca "deixar correr até TP/SL". O health-check (`useApexLogic.ts:798-
  868`) já decide que o comportamento do motor não é confiável quando dispara
  (drawdown, MT5 caído, win rate); deixar posição aberta correndo seria
  apostar contra o próprio alarme que o sistema disparou.

**Critério de avanço de estágio**: puramente operacional (X dias sem falha
do circuito de segurança, sem bug de execução, sem timeout de MetaAPI).
**Nunca lucro/perda acumulado** — o motor não tem edge comprovado, então
"parecer estar acertando" não pode ser sinal de que o próximo estágio de
risco é seguro.

**Questão em aberto, não decidida**: dado que nenhum dos 5 presets passou o
piso estatístico (seções 11-11.15) e o Trilho 2 está pausado, considerar
deliberadamente não avançar além do estágio 2 (confirmação manual) por tempo
indefinido, como posição de produto, não como estágio de passagem. Automatizar
execução de um motor sem edge comprovado piora quanto mais cedo é feito, não
melhora. Cleber ainda não decidiu isto — retomar na próxima sessão antes de
iniciar qualquer implementação do estágio 3.

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

## 11.3 Validação real das 5 estratégias — resultado e decomposição por motivo de saída (2026-07-24)

Primeira medição real (não teórica) das 5 estratégias-preset redesenhadas: candle
real (backend do produto/MetaAPI para EURUSD, Binance pública paginada para
BTCUSDT, ~3 anos em 1h/4h), motor de backtest real (`BacktestEngine.runBacktest`,
extraído do hook pra módulo puro reutilizável em script Node — antes só existia
dentro do hook React, sem forma de medir fora do navegador), custo real descontado
(`CostModel.ts`, calibração da seção 11). Script em
`research/experiments/2026-07-24-strategy-validation/run.ts`.

**Resultado, nos 3 datasets com amostra grande o bastante pra não ser ruído (79,
101 e 872 trades — este último claramente estatisticamente robusto)**: nenhuma
das três mostrou retorno líquido positivo. Isso não é veredito final de "essas
estratégias não funcionam" (amostra ainda curta em calendário, um único ativo
testável em profundidade neste ambiente) — é o resultado real medido até agora,
e a Fase 1 existe justamente para produzir esse tipo de resposta honesta antes de
qualquer promoção a produto.

**Decomposição por motivo de saída revelou DOIS problemas diferentes, não um só**
(pedido do Cleber depois da 1ª rodada, que só mostrava o resultado agregado):

- **Trend-following (Rompimento Donchian, Cruzamento EMA+ADX)**: 89-91% dos
  trades fecham por STOP LOSS, não por regra de saída. Não é saída prematura — é
  taxa de acerto real baixa. A causa mais provável é o filtro de entrada deixando
  passar ruído, ou o stop (2×ATR / 2,5×ATR) estreito demais pra sobreviver ao
  ruído normal antes de uma tendência real se desenvolver. Quando o TP é
  atingido (raro, 5% no Cruzamento), o resultado é ótimo (+4,83%) — mas raro
  demais pra compensar o resto.
- **Rompimento Confirmado (Volume)**: 67-82% dos trades fecham pela regra "ATR em
  contração" (exitBlock), com retorno médio ~0% (872 trades no BTC 1h) — a
  regra de saída fecha o trade num empate sistemático ANTES dele ter chance de
  valer o R:R desenhado (1,5×ATR stop / 3×ATR alvo). Só 4-18% chegam a bater
  TP/SL de verdade.

**Nenhuma recalibração foi feita a partir deste achado** — decisão consciente,
consistente com a regra já estabelecida de nunca ajustar parâmetro pra "melhorar
o número" no mesmo dado que serviu de diagnóstico (isso seria otimização
retroativa/overfitting, exatamente o que o Deflated Sharpe da seção 8 existe para
proteger contra). Próximo passo é decisão do Cleber: (a) investigar/ajustar a
regra de saída do Arquétipo 4 (permitir o trade rodar mais antes de fechar por
contração de ATR) e o stop dos Arquétipos 1-2 (testar múltiplos maiores de ATR),
sempre validando de novo com este mesmo script antes de aceitar qualquer mudança;
ou (b) aceitar que as 5 estratégias ficam marcadas como "em pesquisa, não
validadas" até uma rodada de calibração formal acontecer.

**Reprodução**: `npx esbuild research/experiments/2026-07-24-strategy-validation/run.ts --bundle --platform=node --format=esm --outfile=/tmp/validate-strategies.mjs && node /tmp/validate-strategies.mjs`

## 11.4 Investigação com holdout (2026-07-24, mesma continuação) — melhora real, sem edge

Cleber perguntou se a simulação da seção 11.3 usava stop dinâmico ou fixo:
**dinâmico** — `trailingStop:true` em todos os 5 presets. Mas o trailing só aperta
o stop A FAVOR do trade (nunca alarga, nunca ajuda trade que nunca ficou no
lucro) — pro grupo "89-91% batem stop" isso não muda nada, porque um trade que
vai contra a posição desde a entrada nunca chega a ter o que o trailing possa
apertar. A pergunta certa era a distância INICIAL do stop, não dinâmico-vs-fixo.

**Investigação com split treino(70%)/holdout(30%) cronológico** (nunca
embaralhado, mesma disciplina walk-forward do MarketScoreValidator — script em
`research/experiments/2026-07-24-strategy-validation/investigate.ts`), BTCUSDT
1h, ~3 anos:

- **Donchian**: `atrStopMultiplier` 2→4 reduziu a perda líquida de forma
  consistente e **sustentou no holdout** (nunca visto durante o ajuste):
  -0,55% → -0,52%. Aplicado em `presetStrategies.ts`.
- **Cruzamento EMA+ADX**: `atrStopMultiplier` 2,5→4,5, mesmo padrão, sustentou
  no holdout: -0,28% → -0,14%. Aplicado.
- **Rompimento Confirmado**: hipótese de que a saída "ATR em contração" cortava
  lucro cedo estava **errada** — removê-la piorou no treino (não chegou a ser
  testada no holdout, por desenho do processo: só testa fora de amostra o que
  já melhorou dentro da amostra). A regra não rouba lucro, evita perda maior
  (sem ela, mais trades vão até o stop cheio). Nenhuma mudança aplicada aqui.

**Veredito, sem inflar como sucesso**: as duas mudanças aplicadas são reais e
validadas fora de amostra — não é acaso, não é ajuste ao ruído do treino. Mas
**as duas estratégias continuam com retorno líquido NEGATIVO** mesmo depois do
ajuste, no dado testado (BTCUSDT 1h/4h, ~3 anos). Isso não é "encontramos o
conserto" — é "encontramos uma melhora real e mensurável, insuficiente pra virar
edge". As 5 estratégias continuam sem status de "validadas para produção" — a
Fase 1 está fazendo exatamente o que deveria: impedir promoção precipitada.

## 11.5 Busca sistemática com Deflated Sharpe Ratio (2026-07-24) — nenhum arquétipo passou

Pedido do Cleber depois da seção 11.4 ("vamos pesquisar a fundo até acertar").
Implementado `research/DeflatedSharpe.ts` (Bailey & López de Prado 2014 — nunca
tinha sido implementado apesar de citado na spec desde a criação, seção 8 item
4; simplificação gaussiana declarada no cabeçalho do arquivo, não escondida) e
`research/experiments/2026-07-24-strategy-validation/grid-search.ts`: 106
combinações de parâmetro testadas ao todo (16 Donchian, 27 Cruzamento EMA+ADX,
36 Reversão à Média, 27 Rompimento Confirmado), cada uma em 3 janelas
cronológicas não sobrepostas do BTCUSDT real (regimes de mercado diferentes,
não o mesmo período fatiado), cada janela com split treino(70%)/holdout(30%) —
a escolha do "melhor" candidato usa só o treino, o holdout nunca influencia a
escolha, só mede.

**Resultado: nenhum dos 4 arquétipos passou o piso de DSR≥95%** (o critério que
research/AI_BRAIN_SPEC.md seção 8 já exigia desde o início para promoção).
Donchian chegou a 30,5%; os outros três ficaram abaixo de 1% — "mais provável
que seja acaso do que edge real", mesmo depois de testar dezenas de
combinações.

**Achado instrutivo, não só negativo**: o Donchian mostrou +16,74% de retorno
holdout — pareceria sucesso sem a correção estatística, mas eram só 19 trades
(Sharpe 0,114, variância alta demais pra confiar). A Reversão à Média mostrou o
padrão clássico de overfitting: Sharpe 1,035 no treino (parecia excelente) virou
-0,513 no holdout (4 trades) — a busca por 36 combinações achou uma que se
ajustava bem ao ruído do treino especificamente, sem generalizar. Esses dois
casos são a demonstração prática de por que o DSR existe: sem ele, qualquer um
dos dois teria sido promovido por engano.

**Conclusão honesta**: testado sistematicamente, com múltiplas janelas de
mercado e correção estatística real, nenhum dos 4 arquétipos tem edge líquido
comprovado em BTCUSDT nos timeframes testados. Três hipóteses não testadas
ainda, registradas para decisão do Cleber:

1. **Instrumento pode ser o problema**: a literatura de trend-following
   (Turtle Traders, AQR) foi construída sobre décadas de futuros de
   commodities/moedas/índices, mercados com dinâmica macro diferente de
   cripto (liquidez de exchange, sentimento, ciclos de alavancagem). Testar
   os mesmos arquétipos em forex major é o teste justo ainda não feito nesta
   rodada — limitado pelo rate-limit da conta MetaAPI compartilhada, viável
   com paciência (chamadas espaçadas, como já feito na seção 11.3).
2. **Sinal único raramente tem edge sozinho** — a própria spec (seção 3,
   ensemble decorrelacionado) já previa isso como etapa posterior à validação
   individual, nunca pulada de propósito até agora.
3. **Consistente com o reposicionamento estratégico anterior do projeto**
   (documentado em memória de sessão: "de 'IA que gera rentabilidade
   exponencial' pra 'plataforma que impede o trader de se destruir'") — edge
   de entrada sistemático e replicável é raro por natureza (é por isso que o
   Medallion Fund nunca abriu capital externo). Este resultado não contradiz
   essa decisão, é evidência a favor dela.

**Nenhuma das 4 estratégias foi promovida ou marcada como pronta.** Reprodução:
`npx esbuild research/experiments/2026-07-24-strategy-validation/grid-search.ts --bundle --platform=node --format=esm --outfile=/tmp/grid-search.mjs && node /tmp/grid-search.mjs`

## 11.6 Proposta de desenho: ensemble de sinais (2026-07-25) — implementada e testada, ver 11.7

Cleber questionou o modelo de "estratégia única engessada" (uma das 5 escolhida
e seguida à risca) como pouco realista para day trade, dado que a dinâmica de
mercado muda por dia/ativo/notícia. A pergunta bate diretamente na hipótese #2
já registrada na seção 11.5 ("sinal único raramente tem edge sozinho") e na
arquitetura em camadas já desenhada desde a seção 3 — que sempre prev­iu L1
como "sinais brutos" plurais, nunca "a estratégia escolhida". O ensemble abaixo
é a concretização dessa camada para os 4 arquétipos já existentes, não um
desenho novo do zero.

**Distinção importante, para não confundir com "IA decide sozinha o que fazer
por intuição de mercado"**: isso continua sendo regras determinísticas e
validáveis — a diferença é que a decisão final passa a ser uma COMBINAÇÃO
ponderada de sinais, com o peso de cada sinal modulado pelo regime detectado
(`MarketScoreEngine.detectRegime`, ADX-based, já existe), em vez de "escolher 1
estratégia e obedecer cegamente". Não é discricionário, é mensurável.

**Desenho proposto:**

1. **Cada arquétipo vira um gerador de sinal, não uma estratégia exclusiva.**
   Donchian, Cruzamento EMA+ADX, Reversão à Média, Rompimento Confirmado rodam
   em paralelo a cada candle fechado, cada um emitindo `{direção: -1|0|+1,
   força: 0..1}` — não mais "ligado/desligado" por seleção do usuário.

2. **Peso por regime, não peso fixo.** O regime já classificado pelo
   `MarketScoreEngine` (`TENDENCIA`/`LATERAL`/`INDEFINIDO`) modula o peso de
   cada sinal: trend-following (Donchian, Cruzamento) pesa mais em
   `TENDENCIA`; mean-reversion pesa mais em `LATERAL`; em `INDEFINIDO` todos
   pesam pouco (menos operações, não mais). Isso é o mecanismo que resolve a
   objeção do Cleber ("dia/ativo diferente muda a dinâmica") sem virar
   discricionário: o regime já é medido, só falta usá-lo para ponderar em vez
   de servir só de gate binário como hoje.

3. **Requisito de decorrelação antes de combinar.** A seção 3 já exige "grupo
   de correlação" na alocação (L4) — o mesmo princípio precisa valer entre
   sinais: dois arquétipos que concordam 95% das vezes não são 2 fontes de
   evidência, são 1 fonte duplicada. Antes de qualquer combinação, medir
   correlação par-a-par dos sinais (mesmo dataset de 2026-07-24) e descartar/
   fundir os que forem redundantes. Sem isso, o ensemble pode parecer mais
   robusto só por estar "votando" com a mesma opinião 3 vezes.

4. **Threshold de entrada = soma ponderada, não voto majoritário simples.**
   Entra na direção só se `Σ(peso_i × força_i × direção_i)` passar um limiar
   calibrado (não 50/50 arbitrário) — o mesmo tipo de calibração isotônica já
   previsto na L2 (seção 3) se aplica aqui: o valor do ensemble precisa ser
   validado contra taxa de acerto real, não assumido.

5. **Validação do CONJUNTO, não de cada sinal isolado.** O critério de
   promoção continua sendo DSR≥95% (seção 8, já implementado em
   `DeflatedSharpe.ts`) — mas aplicado à curva de equity do ensemble
   combinado, com o mesmo protocolo já usado (múltiplas janelas cronológicas,
   split treino/holdout, holdout nunca influencia escolha de parâmetro). Um
   ensemble que ainda falha o DSR não deveria ser promovido só por "parecer"
   mais sofisticado — a disciplina da seção 11.5 vale igual.

**O que isso NÃO resolve sozinho**: se os 4 sinais de base não têm edge
individual nenhum (achado real da seção 11.5, DSR<1% em 3 dos 4), combiná-los
com peso pode reduzir ruído (múltiplas fontes concordando é mais informativo
que uma só) mas não cria edge do nada — sinais sem informação combinados
continuam sem informação, só com variância menor. Por isso a hipótese #1 da
seção 11.5 (testar em forex major, onde a literatura de origem foi construída)
continua sendo um pré-requisito honesto a considerar em paralelo, não uma
alternativa descartada pelo ensemble.

**Próximo passo concreto, se aprovado**: estender
`research/experiments/2026-07-24-strategy-validation/grid-search.ts` para (a)
computar a matriz de correlação dos 4 sinais no mesmo dataset já usado, (b)
combinar com peso por regime, (c) rodar `DeflatedSharpe.ts` sobre a curva
combinada com o mesmo protocolo de janelas/holdout. Não implementado ainda —
aguardando decisão do Cleber sobre priorizar isso vs. hipótese #1 (forex major)
vs. aceitar o reposicionamento de risco.

## 11.7 Resultado real do ensemble (2026-07-25) — piorou, não passou o DSR

Implementado `research/experiments/2026-07-25-ensemble/ensemble-validate.ts`
seguindo o desenho da seção 11.6: os 4 arquétipos calibrados (seção 11.4)
rodando em paralelo sobre BTCUSDT 1h (27.000 candles reais, Binance
paginado), combinados por peso de regime (tabela declarada, não otimizada),
testados em 8 candidatos (4 thresholds × peso-por-regime/peso-plano), 3
janelas cronológicas × split treino/holdout, DSR corrigindo pelos 8 trials.

**Matriz de correlação — achado real, não hipotético**: Donchian e Rompimento
Confirmado correlacionam em **0,74** — ambos são variações de rompimento de
canal Donchian (o 2º adiciona só confirmação de volume), então são
essencialmente o MESMO sinal, não dois independentes. Isso valida a
preocupação da seção 11.6 item 3 na prática: metade dos "4 sinais" do
catálogo é 1 sinal duplicado, não 4 fontes de evidência distintas. Cruzamento
EMA+ADX e Reversão à Média ficaram quase descorrelacionados de tudo (0,00-0,05)
— mas isso porque Reversão à Média praticamente não dispara sinal em BTC (regime
majoritariamente de tendência no dataset, gate `ADX<22` raramente satisfeito),
não porque seja genuinamente decorrelacionada por mérito próprio.

**Resultado de validação: pior que os arquétipos isolados, não melhor.**
Nenhum dos 8 candidatos passou DSR≥95% — o campeão do treino (peso-por-regime,
threshold=0,25) ficou em **DSR 0,0%** no holdout, com retorno agregado de
**-42,53%** (75 trades). Todos os 8 candidatos ficaram com Sharpe holdout
negativo. Isso é PIOR que os resultados individuais da seção 11.5 (Donchian
sozinho chegou a DSR 30,5%, mesmo não passando o piso).

**Por que o ensemble piorou em vez de ajudar — leitura honesta, não só o
número**: a combinação ponderada com saída por "reversão de consenso" (fechar
quando o score combinado inverte além de ±0,10) fecha trades de forma muito
mais frequente e muito mais cedo do que a saída original de cada arquétipo
(trailing stop puro do Donchian, regra de saída específica do Rompimento
Confirmado etc.) — a simplificação da seção 11.6 item 5 ("gestão de risco
única pro ensemble, pra isolar o efeito da combinação") teve um custo real que
não tinha sido antecipado: ela descarta a lógica de saída que cada arquétipo
tinha, e essa lógica de saída (não só a de entrada) fazia parte do que estava
sendo validado antes. Combinar SÓ a entrada e trocar a saída por uma regra
genérica não isola a variável como pretendido — muda duas coisas ao mesmo
tempo. Além disso, dado que nenhum dos 4 sinais de base tem edge individual
comprovado (seção 11.5), e dois deles são efetivamente o mesmo sinal (achado
desta seção), o ensemble não tinha material de entrada com informação real
para combinar — a hipótese "reduz ruído, não cria edge do nada" da seção 11.6
se confirma no pior sentido possível aqui: sem edge de entrada, adicionar uma
saída pior só piora.

**Conclusão honesta**: o ensemble como desenhado NÃO deve ser promovido nem
adotado. Isto não invalida a ideia de ensemble em si — invalida ESTA
implementação específica (peso não otimizado, saída genérica que descarta a
lógica original de cada arquétipo, sobre sinais de base sem edge comprovado e
parcialmente duplicados). Se o Cleber quiser retomar esta linha no futuro, o
próximo passo correto não é reajustar o ensemble no mesmo dado (seria
otimização retroativa) — é primeiro resolver os dois problemas de fundo
expostos aqui: (a) remover a duplicação Donchian/Rompimento Confirmado do
catálogo antes de combinar de novo, (b) preservar a saída original de cada
arquétipo em vez de uma saída genérica de consenso. Isso reforça, com dado
real e não só teoria, a hipótese #1 da seção 11.5 (testar em instrumento
diferente, onde os arquétipos de origem foram construídos) como a linha mais
promissora ainda não tentada.

**Reprodução**: `npx esbuild research/experiments/2026-07-25-ensemble/ensemble-validate.ts --bundle --platform=node --format=esm --outfile=/tmp/ensemble-validate.mjs && node /tmp/ensemble-validate.mjs`

## 11.8 Hipótese #1 testada: os 4 arquétipos em forex major (EURUSD) — falhou de novo, pior que em cripto (2026-07-25)

Cleber escolheu testar a hipótese #1 da seção 11.5 (instrumento pode ser o
problema — a literatura de trend-following foi construída sobre forex/
commodities, não cripto). Implementado
`research/experiments/2026-07-25-forex-major/grid-search-forex.ts`: mesma
metodologia exata da seção 11.5 (106 combinações, mesmas 4 famílias de
parâmetro, 3 janelas cronológicas × split treino/holdout, DSR corrigido pelo
número de trials), trocando só a fonte de dado (EURUSD real via MetaAPI,
`/mt5-candles-history` — rota que nunca cai em dado simulado, erro explícito
se não houver dado real) e a classe de custo (FOREX_MAJOR em vez de CRYPTO).
Dataset: 4.000 candles 4h (~4 anos), 11.000 candles 1h (~3 anos), 25.000
candles 15m (~1 ano) — histórico real da corretora, não sintético.

**Resultado: nenhum dos 4 arquétipos passou o piso de DSR≥95% — e o resultado
é PIOR que em BTCUSDT (seção 11.5), não melhor.**

| Arquétipo | Sharpe holdout | Retorno agregado holdout | DSR |
|---|---|---|---|
| Donchian | -0,436 (n=19) | -5,23% | 0,2% ❌ |
| Cruzamento EMA+ADX | 0,060 (n=5) | +0,16% | 28,8% ❌ |
| Reversão à Média | 0,000 (n=1) | -0,10% | 0,0% ❌ |
| Rompimento Confirmado | -0,078 (n=180) | -2,06% | 0,1% ❌ |

Três dos quatro campeões (escolhidos só pelo treino) tiveram Sharpe **negativo**
no holdout — pior que o BTCUSDT original, onde ao menos o Donchian mostrou um
retorno holdout positivo (ainda que sem DSR suficiente). O caso da Reversão à
Média é sintoma claro de amostra pequena demais para significar algo: só 1
trade no holdout inteiro (36 candidatos testados, SR0 esperado só por acaso
sobe para 4,098 — a busca por tantas combinações sobre tão poucos sinais reais
infla o "custo" estatístico de qualquer candidato individual).

**Conclusão honesta**: a hipótese #1 (instrumento) está descartada como causa
raiz — testado com a mesma disciplina estatística, EURUSD não revelou edge
onde BTCUSDT também não revelou; ao contrário, os campeões holdout pioraram.
Isso desloca peso relativo para a hipótese #2 (sinal único raramente tem edge
sozinho — mas o ensemble da seção 11.7 já testou isso com os problemas
conhecidos: sinais duplicados e saída genérica, não uma versão limpa) e para a
hipótese #3 (reposicionamento "risco como diferencial" já documentado — este
resultado é evidência a favor, não contra). As três hipóteses da seção 11.5
foram todas exploradas nesta linha de investigação (11.5→11.7→11.8); nenhuma
produziu um arquétipo ou combinação com edge estatisticamente distinguível de
acaso.

**Reprodução**: `npx esbuild research/experiments/2026-07-25-forex-major/grid-search-forex.ts --bundle --platform=node --format=esm --outfile=/tmp/grid-search-forex.mjs && node /tmp/grid-search-forex.mjs`

## 11.9 Ensemble v2, versão limpa (2026-07-25) — melhorou, ainda não passou o DSR

Cleber escolheu a opção "refazer o ensemble corrigindo os 2 problemas" depois
do resultado da 11.8. Implementado
`research/experiments/2026-07-25-ensemble-v2/ensemble-validate-v2.ts`,
corrigindo exatamente os dois problemas apontados na conclusão da seção 11.7:

1. **Duplicação removida**: Rompimento Confirmado saiu do ensemble (era 0,74
   correlacionado com Donchian). Ficaram só 3 sinais: Donchian, Cruzamento
   EMA+ADX, Reversão à Média.
2. **Saída original preservada por arquétipo**: em vez da saída genérica única
   (stop 3×ATR trailing + "reversão de consenso") que a 11.7 usava pra toda
   posição, aqui a posição usa o SL/TP/exitBlocks ORIGINAIS do arquétipo que
   dominou a combinação no candle de entrada (maior `|peso×força×direção|`
   entre os 3) — só a entrada é combinada, a gestão da posição é a mesma já
   calibrada individualmente na seção 11.4, via `resolveTpSl`/`evaluateExitAt`
   (as mesmas funções do BacktestEngine real, não uma reimplementação).

**A correção #1 funcionou de verdade**: matriz de correlação nova confirma os
3 sinais genuinamente decorrelacionados (Donchian×Cruzamento 0,05,
Donchian×Reversão 0,00, Cruzamento×Reversão 0,00) — bem diferente do 0,74
espúrio da 11.7.

**Resultado: melhor que o ensemble v1, mas ainda não passa o piso.** Campeão
no treino (peso-por-regime, threshold=0,45): holdout n=14, Sharpe=-0,042,
retorno agregado=-0,92%, **DSR 29,2%**. Não é mais o colapso total da v1 (DSR
0%, holdout -42%) — mas 29,2% continua bem abaixo do piso de 95%, e o Sharpe
holdout do campeão continua negativo. Dos 8 candidatos testados, só 2
combinações distintas de threshold/peso produziram holdout com Sharpe
positivo (+0,270, n=4 — amostra pequena demais pra significar algo, mesmo
problema da Reversão à Média isolada na seção 11.5/11.8).

**Conclusão honesta**: corrigir os dois problemas de desenho da v1 melhorou a
qualidade estatística do experimento (sinais realmente independentes, gestão
de risco preservada por arquétipo) mas não criou edge que não existia — os 3
sinais de base continuam sem edge individual comprovado (seção 11.5), e
"decorrelacionado + bem gerenciado" não substitui "informativo". Isso fecha o
ciclo de investigação das 3 hipóteses da seção 11.5 (11.5→11.7→11.8→11.9):
instrumento testado (falhou, pior), ensemble testado em duas versões — bruta e
limpa (ambas falharam, a limpa menos mal) — e a hipótese #3 (reposicionamento
"risco como diferencial") permanece como a única não contrariada por dado
real até aqui.

**Reprodução**: `npx esbuild research/experiments/2026-07-25-ensemble-v2/ensemble-validate-v2.ts --bundle --platform=node --format=esm --outfile=/tmp/ensemble-validate-v2.mjs && node /tmp/ensemble-validate-v2.mjs`

## 11.10 Pooling cross-sectional (2026-07-25) — Cruzamento EMA+ADX sobe a DSR 85,3%, ainda não passa

Diagnóstico de um consultor externo (sessão 2026-07-25): as rodadas 11.5→11.9
podem ter sido subdimensionadas estatisticamente, não necessariamente "sem
edge". Erro padrão do Sharpe estimado (Lo, 2002): `SE(SR) ≈ √((1 + 0,5·SR²)/n)`.
Com n=19 (holdout Donchian, seção 11.5/11.8), mesmo um Sharpe real de 0,5 tem
`SE≈0,24` — t-stat na fronteira da significância ANTES da correção por
múltiplos testes. As rodadas anteriores não tinham poder suficiente pra
distinguir "sem edge" de "edge moderado, amostra pequena demais pra provar".

**Correção proposta e implementada**: em vez de mais grid search (que já
esgotou o edge barato e só infla a penalidade do DSR), usar os parâmetros JÁ
calibrados fora de amostra na seção 11.4 (Donchian stop=4×ATR, Cruzamento
EMA+ADX stop=4,5×ATR — sem nenhum ajuste novo) e rodar a mesma estratégia
FIXA sobre uma cesta de 7 pares forex major (EURUSD, GBPUSD, USDJPY, AUDUSD,
USDCAD, NZDUSD, USDCHF via MetaAPI real), agrupando (pooling) os trades de
holdout de todos os pares num único vetor. Como nenhum parâmetro foi ajustado
olhando este dado, `nTrials=1` — a penalidade de seleção do DSR é zero por
desenho (`sr0=0`), e o DSR pooled é um teste direto de significância do
Sharpe contra zero, com ~7× mais observações que testar 1 ativo isolado.
Script: `research/experiments/2026-07-25-pooled-crosssectional/pooled-validate.ts`.

**Resultado real**:

| Arquétipo | n holdout pooled | Sharpe pooled | Retorno agregado | DSR |
|---|---|---|---|---|
| Donchian (4h) | 80 | -0,047 | -3,46% | 34,0% ❌ |
| Cruzamento EMA+ADX (1h) | 92 | **+0,110** | **+6,72%** | **85,3%** ⚠️ |

**Donchian**: confirma o resultado anterior (sem edge), agora com poder
estatístico bem maior (n=80 vs. n=19 da seção 11.5/11.8) — a rejeição fica
mais confiável, não é mais "amostra pequena demais pra saber".

**Cruzamento EMA+ADX — achado novo e digno de nota, sem inflar**: é o
resultado mais forte de toda a linha de investigação (11.5→11.9→11.10). Dois
sinais de qualidade além do DSR isolado: (a) **todos os 7 pares individuais
tiveram Sharpe holdout positivo** (0,041 a 0,302) — não é 1 ativo sortudo
carregando a média, é direção consistente entre instrumentos independentes;
(b) o DSR saltou de <1% (seção 11.5, BTCUSDT) e de 28,8%/negativo (seção
11.8, EURUSD isolado) para 85,3% pooled — mudança grande demais pra ser só
ruído de mais dado, é o efeito esperado de corrigir o problema de poder.
**Ainda não passa o piso de 95%** — não deve ser promovido agora.

**Cálculo de quanto falta** (mesma fórmula do DSR, resolvendo pra n com o
Sharpe atual constante): para `z=1,645` (limiar de 95%) com Sharpe pooled
mantido em 0,110, precisa de `n≈226` — cerca de **2,5× o n atual (92)**.
Caminho concreto pra chegar lá sem violar a disciplina anti-overfitting
(nenhum ajuste de parâmetro): estender o histórico de anos por par (hoje
~3 anos/11-12mil candles 1h por par — mais anos de calendário, não mais
combinações) e/ou adicionar pares adicionais (majors extras se existirem,
minors só com calibração de custo confirmada — ver lacuna declarada na
seção 11 sobre `FOREX_MINOR` não ter spread publicado real).

**Conclusão honesta**: nenhuma promoção ainda. Mas isto é o primeiro sinal
com direção consistente entre múltiplos instrumentos independentes em toda a
investigação — vale mais uma rodada (mais calendário, mesmos parâmetros,
zero ajuste) antes de decidir entre promover ou arquivar o Cruzamento
EMA+ADX. Reprodução: `npx esbuild research/experiments/2026-07-25-pooled-crosssectional/pooled-validate.ts --bundle --platform=node --format=esm --outfile=/tmp/pooled-validate.mjs && node /tmp/pooled-validate.mjs`

## 11.11 Pooling com calendário estendido (2026-07-25) — o edge do Cruzamento EMA+ADX não se confirma, some com mais dado

Ação direta da pendência #1 deixada na seção 11.10: estender o histórico de
calendário pooled sem tocar em nenhum parâmetro da estratégia, pra ver se
`n≈226` (2,5× o n=92 da 11.10) confirmava o DSR 85,3% ou revelava que era
amostra pequena demais. `yearsBack` do Cruzamento EMA+ADX (preset id `'2'`,
stop=4,5×ATR, timeframe 1h) foi levado de 3 para 10 anos — mesmo script
(`research/experiments/2026-07-25-pooled-crosssectional/pooled-validate.ts`),
zero ajuste de parâmetro. Teto real de histórico no broker via MetaAPI:
maioria dos pares devolveu ~40-41 mil candles de 1h (~4,6-4,7 anos), NZDUSD
só 24144 (~2,75 anos) — mais uma vez confirma que o pool não é perfeitamente
simétrico entre pares.

**Resultado real — reverteu, não confirmou**:

| | Seção 11.10 (3 anos, n=92) | Aqui (10 anos, n=322) |
|---|---|---|
| Sharpe holdout pooled | +0,110 | **-0,015** |
| Retorno agregado holdout | +6,72% | **-2,87%** |
| DSR | 85,3% | **39,3% ❌** |
| Pares individuais com Sharpe holdout positivo | 7 de 7 | **3 de 7** (GBPUSD +0,039, USDCAD +0,202, NZDUSD +0,013) |

EURUSD (-0,215), USDJPY (-0,027), AUDUSD (-0,082) e USDCHF (-0,026) viraram
negativos ou neutros com mais anos de calendário. `n=322` já passa
confortavelmente do `n≈226` calculado como suficiente na seção 11.10 — não é
mais uma questão de poder estatístico insuficiente.

**Leitura honesta**: a própria seção 11.10 tinha levantado a hipótese
alternativa de que mais poder estatístico poderia "confirmar sem edge" em vez
de confirmar o edge — foi exatamente isso que aconteceu, na direção oposta à
esperança. O DSR 85,3% da 11.10 não sobrevive a mais dado; o cenário mais
provável é que era um resultado favorecido pela janela de calendário
específica usada (2023-2026), não um edge real e estável do arquétipo. Isso
fecha as 3 hipóteses da seção 11.5 (instrumento, sinal único, reposicionamento
de risco — 11.5→11.7→11.8→11.9) **e** a hipótese de poder estatístico
insuficiente (11.10→11.11): nenhuma produziu edge que sobrevive a mais dado
ou mais rigor.

**Conclusão**: nenhum dos 2 arquétipos testados na cesta forex major (Donchian,
Cruzamento EMA+ADX) tem edge comprovado sob a disciplina desta spec (DSR≥95%,
holdout out-of-sample, correção por múltiplos testes). Não há candidato à
promoção no momento. Reprodução:
`npx esbuild research/experiments/2026-07-25-pooled-crosssectional/pooled-validate.ts --bundle --platform=node --format=esm --outfile=/tmp/pooled-validate.mjs && node /tmp/pooled-validate.mjs`
(script editado para pular a fase Donchian, já descartada, e rodar yearsBack=10
só no Cruzamento).

## 11.12 Pooling dos 3 arquétipos restantes (2026-07-25) — todos os 5 presets da spec agora testados, nenhum passou

Ação direta da pendência #1 deixada na 11.11: o Cleber escolheu testar
arquétipos novos em vez de ampliar instrumentos ou pausar. Reversão à Média
(id '3'), Rompimento Confirmado (id '4') e Scalp (id '5') nunca tinham
passado pelo pooling cross-sectional (só grid search cripto na 11.5 e forex
isolado na 11.8) — eram os 3 únicos presets ainda sem esse tratamento.

Mesma disciplina anti-overfitting das seções 11.10/11.11: zero grid search
novo, parâmetros de produção de `presetStrategies.ts` sem nenhum ajuste
(nTrials=1, sr0=0 por desenho), calendário longo (10 anos) desde a primeira
rodada — a 11.11 já tinha mostrado que confirmar em janela curta primeiro e
estender depois é enganoso. Script:
`research/experiments/2026-07-25-pooled-crosssectional/pooled-validate-345.ts`.

Execução real precisou de retry com backoff exponencial (30s→240s) por HTTP
429 repetido na conta MetaAPI compartilhada — mesmo risco crônico documentado
no CLAUDE.md, agravado porque os 3 arquétipos juntos fazem 21 buscas
sequenciais.

**Resultado real — nenhum arquétipo passou, dois com Sharpe pooled fortemente negativo**:

| Arquétipo | Timeframe | n holdout pooled | Sharpe pooled | Retorno agregado | Pares c/ Sharpe>0 | DSR |
|---|---|---|---|---|---|---|
| Reversão à Média (RSI+Bollinger) | 15m | 156 | -0,311 | -5,02% | 1 de 7 | 0,0% ❌ |
| Rompimento Confirmado (Volume/OBV) | 1h | 3007 | -0,204 | -78,61% | 0 de 7 | 0,0% ❌ |
| Momentum de Curto Prazo (Scalp) | 1m | 1367 | **-1,032** | -22,41% | 0 de 7 | 0,0% ❌ |

Scalp foi o pior de toda a linha de investigação (11.5→11.12) — Sharpe pooled
fortemente negativo em todos os 7 pares, sem exceção. Consistente com o aviso
já registrado no próprio preset sobre risco de latência de execução via conta
MetaAPI compartilhada (3-9s por chamada historicamente), mas aqui é o sinal
de entrada em si que falha, não só a execução.

**Conclusão honesta**: os 5 presets da spec agora foram todos testados com o
método mais rigoroso disponível (pooling cross-sectional, calendário longo,
DSR≥95%). **Nenhum tem edge comprovado.** Isso fecha a opção (a) da pendência
#1 da seção 11.11 ("tentar arquétipos novos" — não havia mais arquétipos
novos na spec, só estes 3, e todos falharam). Restam as opções (b) ampliar a
cesta de instrumentos, (c) revisar a função objetivo/timeframe antes de
continuar testando variações da mesma receita, ou (d) pausar a busca
sistemática por edge de entrada. Reprodução:
`npx esbuild research/experiments/2026-07-25-pooled-crosssectional/pooled-validate-345.ts --bundle --platform=node --format=esm --outfile=/tmp/pooled-validate-345.mjs && node /tmp/pooled-validate-345.mjs`

## 11.13 Ampliação pra cesta cripto (2026-07-25/26) — bug real de custo encontrado e corrigido, depois: nenhum arquétipo passa, Donchian é o melhor sinal da investigação (DSR 52%, ainda abaixo do piso)

Ação da opção (b) da pendência #1 (11.12): Cleber escolheu ampliar a cesta de
instrumentos em vez de inventar um 6º arquétipo. Forex minors ficaram de fora
(spread extrapolado, não medido — violaria a disciplina "nunca fabricar
dado"); índices ficaram de fora (sem `pointValue` em `TradeSizing.ts`,
disponibilidade de símbolo não confirmada — trabalho de engenharia não feito
ainda). Cripto adicional era a única opção pronta: dado público via Binance
(sem depender da conta MetaAPI compartilhada), custo modelado de forma real.
Cesta: BTCUSDT, ETHUSDT, BNBUSDT, SOLUSDT, XRPUSDT, ADAUSDT, DOGEUSDT — 7
pares, paralelo ao tamanho da cesta forex. Todos os 5 presets testados, zero
ajuste de parâmetro (mesma disciplina 11.10→11.12). Script:
`research/experiments/2026-07-25-crypto-basket/pooled-validate-crypto.ts`.

**Primeira rodada — resultado inválido, bug de custo descoberto**: XRPUSDT,
ADAUSDT e DOGEUSDT (todos sub-US$1) deram retornos agregados absurdos
(-736% a -80.161%, Sharpe isolado até -79,6 em DOGEUSDT no Scalp). Investigado
com script de diagnóstico dedicado
(`research/experiments/2026-07-25-crypto-basket/diagnose-sizing-bug.ts`):
`estimateCostPercent()` em `research/CostModel.ts` calculava custo de CRYPTO
com a mesma fórmula `pontos÷preço` usada pra forex/índice — fórmula correta
quando "ponto" escala com `pointValue` (pip forex), mas para CRYPTO os
valores da tabela (`slippagePoints: 0,05`, câmbio já intencionado como
percentual direto, conforme o próprio comentário da tabela desde 2026-07-24:
"cripto tem spread proporcional ao preço, não pips fixos") nunca tiveram esse
tratamento implementado. Resultado: pra ativos de escala BTC (~US$60.000) o
erro é desprezível (~0,0001%), mas pra DOGEUSDT (~US$0,073) a mesma fórmula
gerava **136,7% de custo round-trip por trade** — garantindo perda
catastrófica em qualquer trade, independente do sinal da estratégia. Um trade
citado como exemplo: retorno bruto real -18,2%, mas reportado como -154,7%
por causa do custo inflado. Confirmado por cálculo direto antes de tocar no
código (não é suposição).

**Correção aplicada**: `estimateCostPercent()` agora trata CRYPTO como caso
especial — `spreadPoints`/`slippagePoints` interpretados como percentual
direto do preço (não mais dividido por `priceLevel`), como o comentário da
tabela sempre disse que deveria ser. Efeito colateral corrigido de brinde: a
função também usava um único `priceLevel` (o candle mais recente de toda a
série, ~10 anos) pra todos os trades históricos — com custo agora
percentual e não dependente de preço, isso deixa de importar pra CRYPTO.
`npm run validate` rodado depois da mudança (gate obrigatório, `CostModel.ts`
está dentro de `research/**/*.ts` no `tsconfig.engine.json`) — 28/28
asserções passaram. Diagnóstico re-rodado confirma: mesmo trade que dava
-154,7% agora dá -18,2% (bate com o retorno bruto real), zero trades com
|profitPercent|>150% nos 133 trades testados.

**Resultado real, depois da correção**:

| Arquétipo | n holdout pooled | Sharpe pooled | Pares c/ Sharpe>0 | DSR |
|---|---|---|---|---|
| Rompimento de Canal (Donchian, 4h) | 329 | **+0,003** | 4 de 7 | **52,0%** ⚠️ |
| Cruzamento EMA+ADX (1h) | 564 | -0,053 | 2 de 7 | 10,4% ❌ |
| Reversão à Média (15m) | 125 | -0,666 | 0 de 7 | 0,0% ❌ |
| Rompimento Confirmado (1h) | 4364 | -0,283 | 0 de 7 | 0,0% ❌ |
| Momentum de Curto Prazo/Scalp (1m) | 1355 | **-3,360** | 0 de 7 | 0,0% ❌ |

**Donchian em cripto é o melhor sinal de toda a investigação (11.5→11.13)**:
DSR 52,0%, ainda bem abaixo do piso de 95%, mas Sharpe pooled ~0,003 (~zero,
não claramente negativo) com 4 de 7 pares individualmente positivos — não é
edge comprovado, é ruído em torno de zero em vez de perda sistemática. Não
deve ser promovido nem lido como "quase lá" sem mais evidência — 52% de DSR
significa que ainda é bem mais provável ser acaso do que edge real (a mesma
lição da 11.10→11.11 sobre não confirmar cedo demais se aplica aqui).

**Scalp confirma ser o pior arquétipo da spec inteira**, agora em dado sem o
artefato de custo: Sharpe pooled -3,36, todos os 7 pares fortemente
negativos, consistente com o aviso operacional já registrado no próprio
preset sobre risco de latência de execução — aqui é o sinal de entrada em si
que falha, independente da questão de latência.

**Conclusão honesta**: ampliar a cesta pra cripto não produziu edge
comprovado em nenhum arquétipo. Donchian é o único ponto positivo real da
investigação até agora (Sharpe pooled não-negativo, direção consistente em
57% dos pares), mas "não claramente negativo" está muito longe de "edge
comprovado" — não deve ser tratado como sucesso. Reprodução:
`npx esbuild research/experiments/2026-07-25-crypto-basket/pooled-validate-crypto.ts --bundle --platform=node --format=esm --outfile=/tmp/pooled-validate-crypto.mjs && node /tmp/pooled-validate-crypto.mjs`

## 11.14 Donchian em timeframe mais longo (2026-07-26) — inconclusivo, amostra insuficiente

Ação da opção (c) da pendência #1 (11.13): Cleber escolheu revisar timeframe
antes de reformular a função objetivo. Donchian é o único arquétipo com sinal
não-negativo de toda a investigação (11.13: DSR 52,0% em cripto 4h) e é
trend-following clássico (Turtle Traders/AQR, citado em 11.5) — estilo
historicamente construído sobre barras diárias/semanais, nunca testado acima
de 4h neste projeto. Testado o MESMO Donchian (zero ajuste de parâmetro) em
1d e 1w, mesma cesta cripto de 7 pares da 11.13. Script:
`research/experiments/2026-07-26-donchian-timeframe/donchian-daily-weekly.ts`.

**Resultado — não confirma nem refuta, inconclusivo por desenho**:

| Timeframe | n_holdout pooled | Sharpe pooled | DSR | Pares c/ Sharpe>0 |
|---|---|---|---|---|
| 4h (referência, 11.13) | 329 | 0,003 | 52,0% | 4 de 7 |
| 1d | **48** | 0,116 | 78,7% ⚠️ | 4 de 7 |
| 1w | 1 | 0,000 | 0,0% ❌ | 0 de 7 |

**Leitura honesta, sem inflar o número maior**: o DSR de 1d (78,7%) parece
melhor que o de 4h, mas `n_holdout=48` está bem abaixo do piso mínimo de 100
sinais que a própria seção 8 exige — e é MENOR que o `n=92` da seção 11.10,
que já se mostrou enganoso (DSR 85,3%→39,3% ao dobrar a amostra em 11.11).
Mesmo padrão aqui, mais extremo: menos evidência, não mais. Um DSR mais alto
vindo de uma amostra menor não é progresso, é o próprio sintoma que a seção
11.10 já tinha ensinado a desconfiar. **1w é inutilizável**: só 1 trade
pooled em ~9 anos de histórico cripto disponível — a maioria dos pares
listados 2017-2020 não gera amostra suficiente em barra semanal.

**Conclusão**: a hipótese "timeframe mais longo revela edge de
trend-following" não foi testada de forma conclusiva — o histórico de cripto
disponível (limitado a ~9 anos pros pares mais antigos, menos pros mais
recentes) é curto demais pra gerar `n≥100` em barra diária com só 7 pares.
Caminho pra testar de verdade: mais instrumentos no pool (compensar poucos
trades/par) ou usar forex major (histórico mais longo que cripto, mas
Donchian em 1d/1w nunca foi testado lá — só em 4h, seção 11.10/11.11).
Reprodução:
`npx esbuild research/experiments/2026-07-26-donchian-timeframe/donchian-daily-weekly.ts --bundle --platform=node --format=esm --outfile=/tmp/donchian-daily-weekly.mjs && node /tmp/donchian-daily-weekly.mjs`

## 11.15 Reformulação da função objetivo: Sharpe → Sortino (2026-07-26) — hipótese refutada na única amostra válida

Ação da opção "reformular a função objetivo" da pendência #1 (11.12→11.14).
Toda a investigação 11.5→11.14 mediu Sharpe, que penaliza variância de GANHO
igual a variância de PERDA. A seção 1 do `AI_BRAIN_SPEC.md` já declara o
objetivo formal como "Sharpe/**Sortino** da curva de capital sujeito a
restrição de sobrevivência" — Sortino nunca tinha sido medido de fato.
Hipótese: Donchian (melhor resultado da investigação, 11.13) é
trend-following com retornos assimetricamente positivos (muitas perdas
pequenas capadas por stop, raros ganhos grandes) — Sharpe pode estar
escondendo edge que Sortino revelaria.

Implementado `sortinoRatio`, `deflatedSortinoRatio` (mesma estrutura da
fórmula de Bailey & López de Prado, aviso mais forte que a do Sharpe: a
derivação formal é pro Sharpe, não pro Sortino — ver cabeçalho da função em
`research/DeflatedSharpe.ts`) e `bootstrapSortinoSignificance` (reamostragem
determinística, sem assumir forma de distribuição — teste mais confiável dos
três). `npm run validate` passou 28/28 antes de rodar qualquer experimento.
Testado o MESMO Donchian (zero ajuste de parâmetro), mesma cesta cripto de 7
pares, nos 3 timeframes já testados (4h — 11.13, 1d e 1w — 11.14). Script:
`research/experiments/2026-07-26-sortino-objective/donchian-sortino.ts`.

**Resultado**:

| Timeframe | n | Sharpe | Sortino | Deflated Sortino | Bootstrap P(Sortino real>0) |
|---|---|---|---|---|---|
| 4h (única amostra válida, n≥100) | 323 | 0,003 | 0,006 | 54,0% | **44,8%** |
| 1d (n<100, inconclusivo) | 48 | 0,116 | 0,238 | 94,6% | 76,8% |
| 1w (n=1, inutilizável) | 1 | 0,000 | 0,000 | 0,0% | 0,0% |

**Leitura honesta — hipótese refutada, não ambígua**: na única janela com
amostra estatisticamente suficiente (4h, n=323), Sortino pooled é
praticamente zero (0,006) — trocar a métrica não revelou edge nenhum. O
bootstrap, teste mais confiável dos três por não assumir forma de
distribuição, dá **44,8% de probabilidade do Sortino real ser positivo —
abaixo de 50%**, ou seja, mais provável que o Sortino real seja negativo do
que positivo. Isso fecha a hipótese "Sharpe estava escondendo assimetria
positiva do Donchian" com resultado negativo claro. O resultado de 1d parece
melhor (Deflated Sortino 94,6%) mas replica o mesmo padrão de amostra
insuficiente inflando o número já visto em 11.10 e 11.14 (`n=48` abaixo do
piso mínimo) — não deve ser lido como confirmação.

**Conclusão**: reformular Sharpe→Sortino não resgata o Donchian nem nenhum
outro candidato da investigação. Diferente das rodadas anteriores (11.10,
11.14), aqui o teste mais rigoroso disponível (bootstrap, amostra válida)
aponta na direção NEGATIVA, não apenas "inconclusivo" — é a evidência mais
forte contra promoção de toda a linha 11.5→11.15. Reprodução:
`npx esbuild research/experiments/2026-07-26-sortino-objective/donchian-sortino.ts --bundle --platform=node --format=esm --outfile=/tmp/donchian-sortino.mjs && node /tmp/donchian-sortino.mjs`

## 12. Decisão de produto: aporte mínimo

Ver seção 5.1.1 e a nota no início da seção 6 — aporte mínimo travado em **US$50**.

## 13. Trilho 2 — investigação com dado estrutural (2026-07-26) — proposta, não executada

**Decisão de escopo (2026-07-26)**: a linha 11.5→11.15 fecha oficialmente sem candidato
promovido. Motivo declarado a Cleber: indicador técnico clássico (Donchian, EMA, ADX,
Reversão, Scalp) sobre preço público, testado com todo o rigor disponível (DSR, Sortino,
bootstrap, 2 cestas, múltiplos timeframes), não produziu edge — resultado consistente
com a hipótese de mercado eficiente na forma fraca para esse tipo de sinal. Continuar
girando a mesma busca (cesta nova, timeframe novo) é reconhecidamente busca de ruído
com diminishing returns. Duas decisões de produto tomadas em paralelo a isto:

1. **O produto passa a ter dois pilares declarados**, não um só: (a) execução e gestão de
   risco disciplinada — vendável e defensável hoje, independente de edge de sinal; (b)
   busca de edge de sinal — aposta de pesquisa, orçada e com critério de corte, não
   trabalho indefinido.
2. **Nenhum lançamento da Fase Real (dinheiro de usuário)** depende do sucesso deste
   trilho. Fase Real pode avançar só com o pilar (a) — disciplina/risco — e uma
   comunicação honesta ao usuário de que o motor ainda não tem edge de sinal comprovado.

Esta seção escopa o pilar (b). Diferença deliberada em relação a 11.5→11.15: **dado de
entrada estruturalmente diferente**, não mais um indicador técnico novo sobre o mesmo
candle público. A hipótese aqui não é "existe uma combinação de parâmetros que ainda não
tentamos", é "existe informação que o preço OHLCV não captura e que ainda não foi testada".

### 13.1 Fontes de dado candidatas (por ordem de disponibilidade real, não de ambição)

| Fonte | Disponibilidade hoje | Uso pretendido |
|---|---|---|
| Order book (desequilíbrio, profundidade) | **Só cripto (Binance)** — ver limitação L1 (seção 10) | Feature de curtíssimo prazo (minutos): pressão compradora/vendedora antes de movimento |
| Calendário econômico (eventos programados) | Existe, com latência de minutos (L3) | **Filtro de regime**, não sinal isolado — evitar operar N minutos antes/depois de evento de alto impacto; medir se isso já reduz variância de perda |
| Cross-asset (correlação, regime de volatilidade entre pares) | Dado já disponível (mesmos feeds), nunca usado como feature | Feature de contexto: ex. BTC lidera altcoins, DXY lidera forex majors — testar se o regime do "líder" prevê o "seguidor" |
| Volume de tick (CFD) | Existe, mas é proxy fraco (L2) | Só como feature auxiliar, nunca como sinal principal — confiança declarada baixa |
| Notícia em texto livre / sentimento | **Não existe pipeline hoje** | Fora de escopo deste trilho — exigiria fonte paga + NLP, custo/complexidade não justificado antes de validar as fontes acima |

Consequência honesta: o único dado genuinamente novo com qualidade real disponível
**hoje, sem custo adicional**, é order book de cripto + calendário como filtro de regime
+ features cross-asset. Notícia em texto e dado alternativo pago ficam fora deste
trilho — não têm pipeline, e não se justifica construir um antes de esgotar o que já
está disponível.

### 13.2 Escopo restrito (deliberadamente pequeno)

- **Ativos**: 3-4 pares de cripto líquidos com book Binance de qualidade (BTC/ETH/BNB/SOL
  — reusar a cesta de 11.13). Não expandir pra forex/índice neste trilho — lá não existe
  order book real (L1), então a hipótese central não se aplica.
- **Timeframe**: minutos (1m-15m), não 4h/1d como nos testes anteriores — desequilíbrio
  de book é um sinal de curtíssimo prazo por natureza; testá-lo em 4h descartaria a
  informação que ele carrega.
- **Modelo**: probabilidade calibrada via modelo simples e interpretável (regressão
  logística ou gradient boosting raso) sobre o feature set — não rede neural profunda.
  Motivo: com poucos meses de dado de book em alta frequência, um modelo complexo
  overfita antes de generalizar, e perde-se a capacidade de auditar por que decidiu algo
  (requisito de todo o resto da spec — nenhuma camada "chuta" sem explicar).
- **Fora de escopo explícito**: notícia em texto/NLP, dado pago de terceiros, forex/índice,
  timeframe acima de 15m, ensemble com os arquétipos já testados (misturar sinal sem
  edge com sinal novo só dilui/mascara resultado).

### 13.3 Metodologia de validação (reusa integralmente a seção 8, sem exceção)

Mesma disciplina de 11.5→11.15: walk-forward com purge/embargo, custo real descontado
(`CostModel.ts`), Deflated Sharpe **e** Sortino com bootstrap (aprendido em 11.15 — não
confiar em Sharpe sozinho), amostra mínima — e por operar em timeframe de minutos, a
amostra mínima efetiva sobe (mais trades esperados, então o piso de n pode ser mais alto
antes de aceitar qualquer leitura, evitando o erro de 11.10/11.14 de ler n pequeno como
sinal).

### 13.4 Orçamento e critério de corte (obrigatório, decidido antes de começar)

- **Prazo-teto: 3-4 semanas de investigação**, não indefinido. Ao final, produz-se um
  veredito, promovido ou não — não se estende automaticamente pra "mais uma variação".
- **Critério de sucesso**: pelo menos 1 feature (book, calendário-como-filtro ou
  cross-asset) mostra Deflated Sortino ≥ piso da seção 8 **e** bootstrap com
  P(Sortino real > 0) claramente acima de 50% (ideal ≥70%, para ter margem — 11.15
  mostrou que perto de 50% não é confiável), em amostra ≥ piso mínimo.
- **Critério de corte (fracasso honesto)**: se, ao fim do prazo, nenhuma fonte nova
  passar o critério acima, a conclusão registrada é **"edge de sinal não é viável para
  este produto com os dados hoje disponíveis"** — com essa frase, sem eufemismo — e o
  pilar (b) é oficialmente pausado (não abandonado: fica documentado o que faria mudar
  essa conclusão — ex. dado pago, mudança de corretora com book real em forex). O produto
  segue 100% no pilar (a).

### 13.5 Por que isto é diferente de "mais uma rodada de 11.x"

11.5→11.15 testaram *parâmetros e métricas diferentes sobre o mesmo tipo de dado*
(preço OHLCV público). Isso é o domínio onde mercado eficiente prevê, com razão teórica
forte, que não sobra edge. Este trilho testa *um tipo de dado diferente* (book,
calendário como filtro, estrutura cross-asset) — tem justificativa teórica distinta
(informação de curtíssimo prazo que não está no candle) e é a única direção restante
que não foi refutada por nenhum dos 15 testes já feitos. Se também falhar, a conclusão
"este produto não tem edge de sinal viável" passa a ter uma base muito mais sólida do
que temos hoje — e vale mais do que continuar girando a mesma manivela.

### 13.6 Nota de contexto: Renaissance/HMM (conversa 2026-07-26, fora do motor)

Cleber perguntou sobre o modelo de arbitragem da Renaissance Technologies e sobre Hidden
Markov Models (HMM) como técnica de detecção de regime — não um pedido de implementação,
registrado aqui só para não perder o contexto caso a linha do Trilho 2 avance.

**Resumo da resposta dada**: Renaissance não faz arbitragem clássica entre mercados — faz
stat arb de curtíssimo prazo sobre milhares de sinais fracos e independentes, com base
matemática (HMM, processamento de sinal) vinda de Jim Simons/Leonard Baum. HMM modela um
**estado oculto** (ex: regime de mercado) inferido probabilisticamente a partir de
observações ruidosas (preço, volume) — via Baum-Welch (treino), Viterbi (decodificação) e
Forward-Backward (avaliação de verossimilhança).

**Avaliação honesta de aplicabilidade a este projeto, dada nesta conversa**: o
`MarketScoreEngine.detectRegime()` já existente é um filtro de regime determinístico
(threshold de ADX), não um HMM real. Mas o achado central das seções 11.5→11.15 — nenhum
indicador técnico clássico sobre preço OHLCV público mostrou edge, e o próprio ensemble
ponderado por regime (11.6/11.7) piorou em vez de melhorar — implica que aplicar um HMM
sobre o MESMO dado (preço/volume público) provavelmente sofreria o mesmo destino: HMM
detecta regime, mas regime não é edge por si só; é um filtro de quando aplicar um sinal
que já não carrega informação.

**Onde faria sentido de verdade**: dentro do Trilho 2 (seção 13), como técnica candidata
para inferir estado latente a partir de **dado estrutural novo** (order book de cripto,
seção 13.1) — ex. um HMM cujos estados ocultos sejam algo como "acumulação" vs.
"distribuição" inferidos de desequilíbrio de book, não de EMA/RSI. Isso teria justificativa
teórica distinta (informação de curtíssimo prazo fora do candle) e ainda não foi testado
por nenhuma das 15 sub-investigações fechadas. **Não implementado, não escopado
formalmente ainda** — registrado só como candidato técnico a considerar se/quando o
Trilho 2 (order book) for executado, não como adição à metodologia de 13.2/13.3.

### 13.7 Etapa 0 — probe de viabilidade em proxy de fluxo de execução (2026-07-26/27)

**Contexto**: antes de comprometer orçamento (Tardis.dev US$50-900/mês ou CoinAPI Flat
Files a partir de US$79/mês) para dado real de order book, foi rodado um probe barato e
reversível — 100% grátis, sem chave de API — pra checar se existe qualquer sinal
preditivo detectável em fluxo de execução, como triagem antes do dado real de book. Isto
**não é o teste do Trilho 2 em si** (não é order book, não segue a metodologia completa
da seção 13.3) — é uma etapa 0 de "vale a pena gastar dinheiro nisso?".

**Dado usado**: `aggTrades` histórico público da Binance (grátis, sem chave), BTC/ETH/
BNB/SOL, barras de 5 minutos. Proxy calculado: CVD (Cumulative Volume Delta) — soma de
volume comprador-agressor menos vendedor-agressor por barra — e imbalance normalizado
(`cvd/volume`, em [-1,1]). **Limitação declarada desde o desenho**: isto não é
desequilíbrio de LIVRO (book), é pressão de EXECUÇÃO (trades já batidos) — não captura
ordens que nunca viraram trade. Um resultado negativo aqui não refuta necessariamente
order book real; um resultado positivo já justificaria investir no dado real.

**v1 (10 dias, 4 ativos, 4 horizontes, limiar simples `|IC| > 0,02`)**: passou
mecanicamente em 4/4 ativos. **Rejeitado antes de qualquer decisão de gasto** — os sinais
eram inconsistentes até dentro do mesmo ativo (ex. BTC: IC -0,042 em +1 barra, +0,016 em
+3, -0,080 em +6, sem padrão coerente de decaimento), sem correção por múltiplos testes
(16 testes rodados, limiar arbitrário) e com amostra pequena — exatamente o padrão de
falso-positivo já visto na seção 11.10 (DSR 85,3% que virou 39,3% só de estender a
janela de calendário). Critério da v1 era simplista demais; falha de desenho do probe,
não conclusão sobre o dado.

**v2 (60 dias = 6 subjanelas de 10 dias, mesmos 4 ativos e 4 horizontes, com correção)**:
critério reforçado exigindo **as duas coisas ao mesmo tempo**: (a) significância
estatística do IC agregado com correção de Bonferroni (α = 0,05/16 = 0,00313, aproximação
normal do IC de Spearman) e (b) consistência de sinal em ≥5 das 6 subjanelas
cronológicas de 10 dias (não só no agregado do período inteiro).

**Resultado v2: 0 de 16 combinações ativo×horizonte passam.** Melhor p-valor observado foi
0,041 (ETHUSDT, horizonte +3 barras) — muito acima do limiar corrigido de 0,00313; a
maioria ficou entre 0,1 e 0,95. Inspeção caso a caso confirmou que mesmo combinações com
alta contagem de "mesmo sinal" (5/6 ou 6/6 subjanelas) tinham IC agregado próximo de zero
e sem separação real de ruído (ex. SOLUSDT +1 barra: ICs por subjanela
[-0,001, -0,004, -0,010, -0,057, -0,004, -0,023] — tecnicamente 6/6 negativos, mas
magnitude desprezível).

**Conclusão honesta**: o proxy de fluxo de execução (CVD via `aggTrades`) não mostra
nenhum sinal preditivo detectável em 60 dias, 4 ativos, 4 horizontes de curtíssimo prazo,
com correção estatística adequada. **Isto não gera base pra justificar gasto em Tardis.dev
ou CoinAPI agora.** Não refuta a hipótese central do Trilho 2 (order book real captura
intenção não-executada que trade não vê, e isso é teoricamente distinto de fluxo de
execução) — mas remove o único argumento barato disponível a favor de avançar, então o
Trilho 2 segue **pausado por decisão de custo/risco**, não decidido a favor nem contra,
até haver justificativa nova (ex. mudança de escopo, ou aceitar gastar sem essa validação
prévia, o que contraria a disciplina de nunca prometer edge sem evidência).

Scripts reproduzíveis:
`research/experiments/2026-07-26-orderflow-proxy/fetch-and-probe.ts` (v1 e v2 no mesmo
arquivo, versão v2 é a que está no arquivo hoje).

### 13.8 Etapa 0 — calendário como filtro de regime: bloqueio de dado (2026-07-27)

**Contexto**: opção 3 do handoff pós-13.7 (testar calendário econômico como filtro de
regime, seção 13.1, antes de decidir entre focar no pilar (a) ou gastar em dado pago).
Hipótese: eventos de alto impacto (FOMC, CPI, NFP) geram volatilidade/variância de perda
elevada em torno do horário de divulgação — se comprovado, o filtro seria "evitar operar
N minutos antes/depois do evento", testável com a mesma disciplina estatística de 8/13.3.

**Bloqueio encontrado antes de qualquer análise**: não existe fonte grátis de calendário
econômico com **histórico** acessível sem chave de API. Testado em 2026-07-27:
`https://nfs.faireconomy.media/ff_calendar_thisweek.json` (feed do ForexFactory, usado
por `newsCrawler.ts`) responde HTTP 200 e serve a semana atual — mas os endpoints
equivalentes de semanas passadas (`ff_calendar_lastweek.json`, `_nextweek`, `_thismonth`)
retornam **HTTP 404**. Confirmado via `curl` direto, sem intermediário. O
`TradingEconomics RSS` (`tradingeconomics.com/rss/calendar.xml`) usado pelo mesmo arquivo
tem a mesma limitação estrutural de RSS: só eventos recentes/futuros, sem arquivo
histórico de 60-90 dias.

**Alternativa descartada por disciplina do projeto**: hardcodar de memória as datas
históricas de reuniões do FOMC e divulgações de CPI/NFP de 2026. Rejeitado — não há
certeza suficiente sobre essas datas vindas de memória do modelo pra tratá-las como dado
real; isso violaria a regra de "nunca fabricar dado" (seção de convenções do
`CLAUDE.md`) e contaminaria qualquer resultado estatístico sem que o erro fosse visível.

**Conclusão honesta**: a linha "existe, com latência de minutos" descrita para a fonte
calendário na tabela da seção 13.1 estava correta só para uso **ao vivo** (evitar operar
próximo a um evento futuro conhecido), não para **validação estatística retroativa**, que
é o que o critério de corte da seção 13.4 exige. Sem histórico grátis, esta fonte não é
testável como etapa 0 hoje. Decisão registrada com Cleber (2026-07-27): não perseguir
esta linha agora — voltar a escolher entre pilar (a) e opção 2 (gastar em dado pago sem
validação prévia), ou revisitar calendário só se/quando o produto passar a coletar o
feed `thisweek` ao vivo por várias semanas, construindo histórico próprio (não fizemos
isso ainda — adiaria a decisão em semanas, foi descartado por ora).

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
