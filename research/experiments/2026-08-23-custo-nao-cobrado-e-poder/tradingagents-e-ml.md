# TradingAgents e técnicas de ML honesto — pesquisa 2026-08-23

## Resumo executivo

Duas frentes pesquisadas: (A) o framework "TradingAgents" (multi-agente LLM
para trading) e (B) cinco técnicas quantitativas de ML honesto para
trading. Veredito resumido:

- **TradingAgents (Frente A): não recomendado adotar.** É um projeto de
  pesquisa real, com paper e repositório públicos, mas os números reportados
  no paper original têm risco alto de estarem inflados por vazamento de
  dado — não do tipo clássico (isso o framework evita), mas do tipo mais
  insidioso e sem solução conhecida: **conhecimento futuro codificado nos
  pesos do próprio LLM** (contaminação paramétrica). Não há replicação
  independente que confirme os números do paper original em condição limpa.
  Não é aplicável de forma honesta a um produto real de trading intraday
  hoje.
- **Técnicas B1-B3 (meta-labeling, triple-barrier, purged CV) são
  ferramentas de disciplina estatística maduras e bem estabelecidas** — mas
  pressupõem que existe um "sinal primário" com edge real pra filtrar/rotular.
  O projeto já mediu, com rigor (DSR, custo real, múltiplos ativos/timeframes),
  que **não há edge de sinal técnico comprovado**. Aplicar essas técnicas
  agora seria polir a rotulagem de um sinal que ainda não se provou ter
  poder preditivo — risco de dar falsa sensação de rigor a um problema que
  continua sendo "não há edge", não "o edge está mal rotulado".
- **GARCH/HAR-RV (B4) é o item genuinamente aplicável ao objetivo já
  decidido do projeto** (ML só para volatilidade, nunca direção). Evidência
  real: HAR-RV supera GARCH consistentemente em previsão de volatilidade
  realizada, inclusive intraday — mas a pesquisa não achou comparação
  publicada explícita contra o benchmark mais simples de todos (naive: vol
  realizada recente como previsão do período seguinte), que é o que
  realmente importaria decidir antes de construir algo.
- **Online learning/re-treino contínuo (B5) tem problema estrutural direto
  com o Jarvis do projeto**: reanalisar a cada 6h multiplica o problema de
  múltiplos testes ao longo do tempo exatamente do jeito que o DSR foi
  desenhado pra corrigir uma vez, não repetidamente — sem controle, o Jarvis
  vai "achar" ajuste com aparência de edge por acaso, com frequência
  crescente quanto mais rodar.

---

## Frente A — TradingAgents

### O que é

[TradingAgents: Multi-Agents LLM Financial Trading Framework](https://arxiv.org/abs/2412.20138)
(arXiv 2412.20138, dez/2024), repositório
[TauricResearch/TradingAgents](https://github.com/tauricresearch/tradingagents)
no GitHub. Simula uma firma de trading com sete papéis especializados de
agentes LLM: Analista Fundamentalista, Analista de Sentimento, Analista de
Notícias, Analista Técnico, Pesquisador (com sub-papéis Bull/Bear em
debate), Trader e Gestor de Risco. Os agentes debatem entre si (via
LangGraph) antes do Trader sintetizar uma decisão, e o time de risco
monitora exposição.

O paper reporta que TradingAgents supera estratégias tradicionais e
baselines em retorno acumulado, Sharpe ratio e outras métricas financeiras
(ver [DigitalOcean, resumo do framework](https://www.digitaloceanspaces.com)
e [Hugging Face paper page](https://huggingface.co/papers/2412.20138)).

### Avaliação crítica — o problema de vazamento de dado

O framework implementa busca de notícias históricas "date-aware" — ou seja,
evita explicitamente dar ao agente uma notícia futura na simulação. Isso
resolve o vazamento **clássico** (look-ahead óbvio, tipo backtest lendo o
preço de fechamento de amanhã).

Mas existe uma issue registrada no próprio repositório —
[Temporal Knowledge Leakage in LLM Backtesting (Model-Level Future
Information Contamination) · Issue #805](https://github.com/TauricResearch/TradingAgents/issues/805)
— documentando o problema mais sério: **mesmo alimentando o agente só com
informação contemporânea ao momento simulado, os pesos do próprio LLM (pré-
treinado numa data posterior ao período de teste) já "sabem" o que aconteceu
depois**. O modelo não precisa acessar preço futuro explicitamente — ele
pode ter absorvido, no pré-treino, notícias pós-evento, post-mortems de
mercado, resumos de trajetória de preço e retrospectivas de fim de ano que
descrevem o desfecho do período que está sendo "testado". Isso é
estruturalmente diferente de vazamento de feature: é vazamento **paramétrico**,
embutido no próprio modelo de linguagem, e não tem fix de engenharia simples
(trocar a data de corte do prompt não resolve, porque o conhecimento já está
nos pesos).

Esse ponto tem tratamento acadêmico dedicado e recente:
- [The Alpha Illusion: Reported Alpha from LLM Trading Agents Should Not Be
  Treated as Deployment Evidence](https://arxiv.org/html/2605.16895) — título
  já é o veredito.
- [Summoning the Oracle to Slay It: Mitigating Look-Ahead Bias in Financial
  Backtesting with Large Language Models](https://arxiv.org/pdf/2605.24564)
- [Look-Ahead-Freedom as Temporal Non-Interference: A Verifiable Correctness
  Property for Backtesting and Agentic Trading Pipelines](https://arxiv.org/pdf/2607.04958)
- [Look-Ahead Bias in LLM Trading: Why Your Backtest Is Lying](https://paperswithbacktest.com/course/look-ahead-bias-llm-trading)

Adicionalmente, com múltiplos agentes LLM debatendo (arquitetura swarm), o
risco composto: "a colaboração de múltiplos agentes pode amplificar,
inadvertidamente, a extração de narrativas futuras latentes embutidas nos
modelos-base" — ou seja, o debate entre agentes não reduz o viés, pode
reforçá-lo, já que cada agente pode "vazar" a mesma informação futura de
ângulos diferentes e o conjunto convergir pra ela com aparência de consenso
robusto.

### Replicação independente

Não foi encontrada, na pesquisa realizada, nenhuma replicação independente
publicada que reproduza os números de Sharpe/retorno do paper original em
condição controlada contra o viés paramétrico acima (ex: usando um modelo
com data de corte de treino anterior ao período de teste, ou comparando
contra um LLM "cego" ao período). O que existe é literatura *crítica* da
classe de resultado (os papers de 2026 citados acima), não uma replicação
que confirme o número.

### Veredito

**Demonstração acadêmica de arquitetura interessante, não evidência de
edge real.** Não aplicável de forma honesta a este produto sem, no mínimo,
um protocolo de teste que controle a contaminação paramétrica (ex: usar
apenas um modelo com data de treino comprovadamente anterior ao período de
teste, e mesmo assim tratar o resultado com ceticismo). Isso é
estruturalmente o mesmo problema que motivou a decisão de produto já tomada
neste projeto (edge ≈ 0 em sinal técnico clássico) — trocar o sinal por
"LLM lê notícia e decide" não escapa da exigência de validação
out-of-sample sem vazamento; na verdade, adiciona uma classe de vazamento
mais difícil de detectar do que a que o projeto já sabe caçar.

---

## Frente B — técnicas quantitativas

### B1. Meta-labeling (López de Prado)

O que é: em vez de treinar um classificador para prever a *direção* do
mercado diretamente (o problema de baixíssimo sinal-ruído que o projeto já
mediu ser ≈0 para TA clássico), meta-labeling treina um classificador
**secundário** que recebe um sinal primário já existente (de qualquer
origem — regra, heurística, modelo) e decide apenas **se vale a pena agir
nele ou não** (sim/não), tipicamente também dimensionando a aposta pela
probabilidade. Fonte: [Hudson & Thames — Does Meta Labeling Add to Signal
Efficacy?](https://hudsonthames.org/does-meta-labeling-add-to-signal-efficacy-triple-barrier-method/),
[Quantreo — The Triple Barrier Labeling of Marco Lopez de Prado](https://www.newsletter.quantreo.com/p/the-triple-barrier-labeling-of-marco).

Por que evita o problema de treinar direção direto: separa "quando apostar"
de "pra que lado apostar" — o segundo problema (direção) é o que tem menor
sinal-ruído em mercado eficiente; o primeiro (filtrar falsos positivos de um
sinal existente) é estatisticamente mais tratável porque a base rate pode
ser mais alta.

**Aplicabilidade ao projeto**: pressuposto crítico — precisa de um sinal
primário com **algum** poder preditivo genuíno pra filtrar. O projeto já
mediu que TA clássico não tem esse poder (seção "Cérebro de decisão da IA"
do CLAUDE.md, DSR aplicado, resultado negativo em 5 presets × múltiplos
ativos/timeframes). Meta-labeling em cima de um sinal primário sem edge não
cria edge — só adiciona uma camada de modelo que vai aprender a filtrar
ruído como se fosse sinal, risco de overfitting adicional, não redução.
**Não aplicável agora**, a menos que surja um sinal primário novo com edge
comprovado (o próprio Trilho 2, hoje pausado).

### B2. Triple-barrier method (López de Prado)

O que é: em vez de rotular um trade por retorno fixo num horizonte fixo
(ex: "retorno em 60 min"), rotula pelo evento que acontece primeiro dentre
três barreiras: take-profit, stop-loss, ou expiração por tempo. Fonte:
[Quant Memo — Triple-Barrier Labeling, Explained](https://www.quantmemo.com/concepts/triple-barrier-labeling),
[QuantStrategy.io — The Triple Barrier Method](https://quantstrategy.io/blog/the-triple-barrier-method-revolutionizing-how-we-label/).

Por que é mais honesto: espelha como uma posição real se resolve de fato
(o motor do projeto já opera assim — TP/SL/timeout), em vez de medir um
retorno artificial num ponto fixo no tempo que ignora se o preço bateu
stop antes. Rótulo de retorno fixo pode chamar de "sucesso" um trade que na
prática teria sido stopado no meio do caminho.

**Aplicabilidade**: tecnicamente compatível de imediato — o motor já opera
por TP/SL/timeout, então rotular histórico por essa lógica é natural e
mais correto do que qualquer proxy de retorno fixo que o projeto tenha
usado em backtests. **Mas, de novo**: rotular melhor não cria edge onde não
há — é ferramenta de precisão de medição, útil quando (e se) houver sinal
primário a medir. Vale considerar para qualquer backtest futuro do Trilho 2,
não como iniciativa isolada agora.

### B3. Purged K-fold CV com embargo

O que é: cross-validation padrão assume observações independentes; em
finanças, rótulos são construídos sobre janelas temporais sobrepostas
(ex: o rótulo de um trade que abriu às 10h e fechou às 10h45 "usa" preço de
todo esse intervalo) — então um fold de teste pode compartilhar informação
com um fold de treino vizinho no tempo, inflando artificialmente o
resultado de validação. **Purging** remove do treino qualquer observação
cujo rótulo se sobrepõe temporalmente ao conjunto de teste; **embargo**
exclui adicionalmente uma janela de tempo logo após o conjunto de teste,
pra evitar vazamento residual por autocorrelação. Fonte: [Wikipedia —
Purged cross-validation](https://en.wikipedia.org/wiki/Purged_cross-validation),
[RiskLab AI — Cross-Validation in Finance](https://www.risklab.ai/research/financial-modeling/cross_validation).

**Aplicabilidade**: esta é a técnica mais diretamente relevante e **de
aplicação imediata caso o projeto retome qualquer busca de edge** (Trilho
2) ou qualquer validação de modelo de volatilidade (item B4 abaixo) — CV
k-fold padrão sobre série temporal financeira é conhecido por inflar
resultado, e o projeto já usa DSR pra corrigir por múltiplos testes; purged
CV ataca uma fonte de viés diferente (vazamento entre folds) e complementar,
não substituta do DSR. Recomendação concreta: se/quando o Trilho 2 for
retomado, ou se um modelo de vol (GARCH/HAR-RV) for treinado com
otimização de hiperparâmetro, usar purged K-fold com embargo, não CV padrão.

### B4. GARCH / HAR-RV (previsão de volatilidade realizada)

Este é o único item das cinco técnicas **diretamente alinhado com decisão
de produto já tomada** (ML só pra vol, nunca direção).

Evidência encontrada:
- [HAR-RV supera GARCH e ARFIMA-RV de forma consistente em previsão de
  volatilidade financeira](https://medium.com/@simomenaldo/realized-volatility-and-har-models-a-new-paradigm-for-volatility-forecasting-4a660f2530f3),
  inclusive em horizonte intraday — "medidas de alta frequência resultam em
  previsões de variância mais precisas do que as derivadas de modelos GARCH
  desenhados para retornos diários" ([tese sobre forecasting intraday realized
  volatility](https://thesis.eur.nl/pub/73357/Thesis_Bachelor_Olivier_van_Wel_577295ow.pdf)).
- Existe literatura de extensão combinando os dois (Realized-HAR-GARCH),
  mas a vantagem de HAR-RV sobre GARCH puro é o achado mais robusto e
  replicado.

**Lacuna honesta a declarar**: a pesquisa **não encontrou comparação
publicada explícita de HAR-RV contra o benchmark mais simples possível**
(naive — usar a vol realizada do período recente como previsão do próximo
período, sem modelo nenhum) especificamente em horizonte intraday curto. Essa
é exatamente a pergunta que decidiria se vale a pena construir HAR-RV: se o
ganho sobre naive for pequeno, o custo de manutenção de um modelo (mesmo
simples) pode não compensar frente a uma heurística direta de vol recente
— e isso segue a mesma disciplina que o projeto já aplica a sinal de
direção (nunca prometer edge sem medir contra baseline honesto).

**Recomendação concreta**: antes de implementar HAR-RV como projeto, rodar
um teste interno rápido e barato — comparar HAR-RV (ou até um AR(1) simples
sobre vol realizada) contra "vol realizada da última janela = previsão"
nos próprios dados do projeto (mesmos ativos/timeframes já usados na busca
de edge), com holdout real. Só justifica investir em modelo mais complexo
se o ganho for mensurável e persistente fora da amostra.

### B5. Online learning / re-treino contínuo sem overfitting

O problema central, já vivido pelo projeto de forma adjacente: o DSR
(Deflated Sharpe Ratio, [Bailey & López de Prado](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2460551))
corrige o Sharpe reportado por **quantas estratégias/testes foram feitos**
até achar a que "deu certo" — responde "qual a probabilidade do Sharpe
verdadeiro ser >0, dado que escolhi a melhor de K tentativas?". O projeto já
usa isso, mas numa rodada de teste **finita e documentada** (5 presets, N
combinações ativo×timeframe).

O Jarvis, como desenhado, propõe **re-analisar a cada 6h e propor ajuste**
— isso é, estruturalmente, uma nova rodada de "teste múltiplo" a cada 6h,
indefinidamente. Sem controle, o número de "testes" (K no DSR) cresce sem
limite ao longo do tempo, e a proporção de "achados" que são só ruído
estatístico cresce junto — é o mesmo problema de p-hacking, mas automatizado
e recorrente em vez de único.

Práticas encontradas na pesquisa pra mitigar isso:
- **Combinatorial Purged CV (CPCV)**: mostrado, em [comparação empírica
  recente](https://www.sciencedirect.com/science/article/abs/pii/S0950705124011110),
  como superior a métodos tradicionais em reduzir Probabilidade de Backtest
  Overfitting (PBO) e produzir DSR mais confiável — mas ainda é técnica de
  *validação por rodada*, não resolve sozinha o problema de rodadas
  repetidas ao longo do tempo.
- O ponto estrutural que falta na literatura encontrada (nenhuma fonte trata
  isso de forma pronta-pra-uso): **tratar o histórico completo de decisões do
  Jarvis como um único teste sequencial acumulado**, não como rodadas
  independentes — ou seja, o K do DSR do Jarvis não deveria resetar a cada
  ciclo de 6h, deveria **acumular** desde o primeiro ciclo. Sem isso, o
  Jarvis vai reportar cada ajuste individual como estatisticamente "limpo"
  enquanto o conjunto de todos os ajustes ao longo de semanas/meses carrega
  risco de seleção múltipla não corrigido.

**Recomendação concreta pro Jarvis** (item já registrado como "em desenho"
no projeto): antes de qualquer PENDING virar aplicado automaticamente (ou
mesmo virar sugestão forte pro Cleber aprovar), o Jarvis deveria expor,
junto de cada proposta, **quantos ciclos de análise já rodaram no total** e
tratar esse número como o K do DSR daquele teste — não o K de "quantas
variações testei nesta rodada de 6h". Isso é consistente com a regra já
adotada no projeto de "nunca prometer edge sem correção por múltiplos
testes" — só que aplicada ao tempo, não só à amplitude de uma única rodada.

---

## Recomendação de próximo passo

**Nenhuma implementação nova recomendada agora**, por dois motivos:

1. TradingAgents e meta-labeling/triple-barrier pressupõem ou usam
   arquitetura em cima de sinal com edge — o projeto não tem esse sinal
   hoje (Trilho 2 pausado sem justificativa nova), então adotar essas
   técnicas agora seria investir engenharia em polir a medição de algo que
   ainda não existe.
2. GARCH/HAR-RV é o único item com aplicação direta ao objetivo já
   decidido (vol, não direção) — mas o passo certo antes de construir é
   **barato e não requer nova infraestrutura**: rodar HAR-RV (ou AR(1)
   simples) contra o baseline naive nos dados que o projeto já tem, e só
   avançar se o ganho for real e mensurável fora da amostra. Isso é
   trabalho de análise (algumas horas), não de produto.

Se o Cleber decidir seguir com o Jarvis mesmo com a lacuna de correção por
múltiplos testes ao longo do tempo (item B5), a recomendação mínima antes
do primeiro deploy real é adicionar o contador acumulado de ciclos como
input do próprio julgamento do Jarvis sobre confiança do seu ajuste
proposto — não como feature nova, como disciplina estatística de nascença,
já que corrigir depois (com meses de decisões PENDING acumuladas sem esse
controle) seria mais caro do que desenhar certo agora.

---

## Fontes

- [TradingAgents paper (arXiv 2412.20138)](https://arxiv.org/abs/2412.20138)
- [TauricResearch/TradingAgents (GitHub)](https://github.com/tauricresearch/tradingagents)
- [Issue #805 — Temporal Knowledge Leakage in LLM Backtesting](https://github.com/TauricResearch/TradingAgents/issues/805)
- [The Alpha Illusion (arXiv 2605.16895)](https://arxiv.org/html/2605.16895)
- [Summoning the Oracle to Slay It (arXiv 2605.24564)](https://arxiv.org/pdf/2605.24564)
- [Look-Ahead-Freedom as Temporal Non-Interference (arXiv 2607.04958)](https://arxiv.org/pdf/2607.04958)
- [Look-Ahead Bias in LLM Trading — paperswithbacktest.com](https://paperswithbacktest.com/course/look-ahead-bias-llm-trading)
- [Hudson & Thames — Meta Labeling / Triple Barrier](https://hudsonthames.org/does-meta-labeling-add-to-signal-efficacy-triple-barrier-method/)
- [Quant Memo — Triple-Barrier Labeling, Explained](https://www.quantmemo.com/concepts/triple-barrier-labeling)
- [Wikipedia — Purged cross-validation](https://en.wikipedia.org/wiki/Purged_cross-validation)
- [RiskLab AI — Cross-Validation in Finance](https://www.risklab.ai/research/financial-modeling/cross_validation)
- [Realized Volatility and HAR Models — Simone Menaldo](https://medium.com/@simomenaldo/realized-volatility-and-har-models-a-new-paradigm-for-volatility-forecasting-4a660f2530f3)
- [Forecasting realized volatility at an intra-day horizon (tese)](https://thesis.eur.nl/pub/73357/Thesis_Bachelor_Olivier_van_Wel_577295ow.pdf)
- [Bailey & López de Prado — The Deflated Sharpe Ratio (SSRN)](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2460551)
- [Backtest overfitting in the machine learning era — ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0950705124011110)
