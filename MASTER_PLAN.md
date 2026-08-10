# Neural Day Trader — Plano Mestre (Cérebro + Caminho para Investidor)

> **Este documento substitui `ROADMAP-INVESTIDORES-NEURAL-DAY-TRADER.md`,
> `ROADMAP_SIMULADOR.md` e `ROADMAP_AI_TRADING_DEMO.md`.** Os três ficaram
> desatualizados, sobrepostos entre si e alguns descreviam funcionalidade que
> já existe. Este é o único documento de planejamento de produto/negócio a
> partir de 2026-07-30. Os três antigos devem ser deletados depois que este
> for revisado.
>
> **Regra de manutenção**: qualquer IA que assumir este projeto lê este
> arquivo inteiro antes de tocar no motor de decisão ou nas estratégias.
> Não é opcional — é o registro de por que a versão atual do cérebro não
> pode ser confiada, com prova, não opinião.

---

## 0. Como ler este documento

Ele tem 6 partes, nesta ordem porque a ordem importa:

1. **Premissa operacional permanente** — como qualquer IA/pessoa deve pensar neste projeto daqui pra frente.
2. **O que é fato, o que é hipótese, o que é desconhecido** — separação explícita, porque a Parte 3 só faz sentido em cima dela.
3. **Auditoria do cérebro atual** — 6 defeitos confirmados por medição, com número, não opinião.
4. **O que a literatura financeira real diz** — inclusive as réplicas que derrubaram os papers usados como base, e o que sobrevive.
5. **Arquitetura proposta** — o motor que substitui o atual.
6. **Plano de execução** — fases, critério de saída de cada uma, e o caminho até um Beta demonstrável para investidor.

---

## 1. Premissa operacional permanente

**Adotada em 2026-07-30, vale por toda a vida do projeto, revisitar só se o
Cleber pedir explicitamente.**

Toda IA que trabalhar no cérebro de decisão deste projeto — hoje ou daqui a
um ano — assume esta postura, sempre:

- **Rigor de matemático + ceticismo de cientista experimental.** Nenhuma
  afirmação sobre edge, Sharpe, DSR ou qualquer métrica de performance entra
  neste projeto sem (a) o script que gerou o número, (b) o output salvo em
  arquivo, (c) a conta de poder estatístico que diz se o `n` era suficiente
  para a pergunta feita. Prosa sem output salvo é opinião, não achado —
  ver §3.6, o problema que criou esta regra.
- **Honestidade radical, sempre, mesmo quando o resultado é ruim ou
  constrangedor.** Se uma estratégia perde dinheiro, o relatório diz que
  perde dinheiro. Se um bug foi introduzido na mesma sessão que corrigiu
  outro, isso é relatado. Nunca inflar um número, nunca esconder um achado
  negativo, nunca apresentar "melhora" sem holdout genuíno por trás.
- **Nunca fabricar dado.** Preço, indicador, resultado de backtest — erro
  explícito quando não há fonte real. Regra herdada do projeto (Fase 0,
  ver `CLAUDE.md`), reafirmada aqui porque o motor de decisão é onde ela
  mais importa.
- **Gestão de risco não é alpha.** Position sizing, stops e circuit breakers
  reduzem a velocidade de ruína de um sistema com edge negativo — não o
  transformam em um sistema com edge positivo. Ver §5.0. Confundir os dois
  na comunicação com investidor é o mesmo tipo de inflação que a Fase 0 já
  removeu da landing page.
- **Todo experimento de validação estatística passa pela disciplina que
  reprovou o cérebro atual** (ver §3): sem look-ahead, com custo real
  descontado, com Deflated Sharpe Ratio corrigido por seleção, com análise
  de poder estatístico **feita antes de rodar o teste** — se o efeito
  mínimo detectável for maior que o efeito real plausível pela literatura,
  o teste não roda, porque não pode informar nada.
- **Todo desvio de código em relação à descrição em prosa é um bug até
  prova em contrário.** O motor de decisão é pequeno o bastante para ser
  lido linha a linha; a auditoria da §3 nasceu de comparar o que o
  `presetStrategies.ts` *diz* que faz com o que `StrategyEvaluator.ts`
  *de fato* faz — e os dois divergiam.
- **A referência intelectual permanente para este cérebro** combina:
  - **Rigor probabilístico e de poder estatístico** — Claude Shannon (teoria
    da informação: um sinal sem informação não vira edge por manipulação
    de estatística), John von Neumann (teoria de jogos/utilidade, a base
    formal por trás de Kelly), Alan Turing (decidibilidade — saber quando
    uma pergunta *não pode* ser respondida com o dado disponível, em vez de
    forçar uma resposta).
  - **Aprendizado e calibração honesta** — Geoffrey Hinton (nunca confundir
    ajuste em amostra com generalização; todo "modelo melhorou" exige
    holdout genuíno).
  - **Prática de mercado e psicologia do operador** — Alexandre Wolwacz
    (disciplina de risco como o que realmente separa sobrevivente de
    estourado, o "1-2% por trade" não é enfeite), Jesse Livermore (o edge
    de tendência vem de assimetria de payoff, não de taxa de acerto — "a
    tendência é sua amiga" é sobre deixar o vencedor correr, não sobre
    prever a direção), Richard Wyckoff (volume como esforço vs. resultado,
    fase de mercado como gate de regime, não como decoração).
  - **Medição de sistema, não de trade isolado** — Lars Kestner (K-ratio:
    mede a consistência da curva de capital inteira, não só a média/desvio
    dos retornos; e a conclusão dele de testar dezenas de sistemas técnicos
    sistemáticos foi que a maioria falha — a mesma conclusão preliminar
    deste projeto, ver §3 e §4).

Esta seção não é estilo de escrita. É um filtro: toda proposta de mudança
no motor passa por "isso resistiria ao escrutínio de Shannon sobre se há
informação real aqui, e ao escrutínio do Kestner sobre se a curva de
capital é consistente, não só a média"? Se não, não entra em produção.

---

## 2. O que é fato, hipótese, e desconhecido

Esta seção existe porque a sessão anterior (2026-07-29/30) apresentou uma
auditoria de código como se fosse conclusão definitiva sobre os arquétipos.
Era rigorosa como leitura de código, mas **nenhum número foi remedido**.
Fechar essa lacuna era pré-requisito para este documento — e foi feito nas
últimas horas de trabalho, com prova.

### 2.1 Fatos confirmados por medição (não por leitura)

Estes 4 itens foram *executados*, não só lidos, nas últimas horas:

1. **O ADX do projeto diverge do ADX de Wilder padrão em 4,77 pontos de
   erro médio, até 12 pontos de erro máximo**, sobre uma série sintética
   determinística de 3.000 candles. O gate de regime (ADX>18/20/22) muda
   de decisão em **5,7% a 10,7% das barras** entre as duas versões. Ver
   §3.1 — script em `research/experiments/2026-07-30-engine-audit/`.
2. **O gerador de números pseudo-aleatórios do bootstrap de significância
   (`bootstrapSortinoSignificance`, `DeflatedSharpe.ts:128`) tem período de
   10.466** — com 2000 iterações × ~92 retornos por chamada (uso real na
   seção 11.9 do `AI_BRAIN_SPEC.md`), a sequência de números se repete
   ~17,6 vezes inteiras. Confirmado por teste de ciclo direto no LCG. O
   teste de uniformidade (qui-quadrado, 10 buckets, 200 mil amostras)
   passa — os números individuais parecem uniformes — mas a
   **autocorrelação por repetição de período invalida a premissa de
   amostragem independente** que o bootstrap exige.
3. **A simplificação gaussiana do DSR (`γ3=0, γ4=3`) NÃO é uniformemente
   liberal, como o comentário do código afirma** ("tende a ser LIBERAL
   demais, não conservadora" — `DeflatedSharpe.ts:21`). Recalculando a
   fórmula completa de Bailey & López de Prado com assimetria/curtose
   típicas de trend-following (γ3≈1,5, γ4≈8): no regime de Sharpe baixo
   observado neste projeto (SR/trade entre 0,003 e 0,15), **o termo de
   assimetria domina o de curtose e empurra o DSR completo para CIMA**, não
   para baixo — ou seja, a simplificação do projeto foi **conservadora**
   nesse regime específico, o oposto do que o comentário alega. A diferença
   medida foi pequena nos casos testados (+0,6 a +1,9pp), mas o sentido do
   viés está documentado errado no código — corrigir o comentário é tarefa
   de higiene, não é urgente para a decisão de produto.
4. **Nenhum output de experimento de pesquisa (seções 11.x do
   `AI_BRAIN_SPEC.md`) está salvo em arquivo.** `research/experiments/`
   contém só os scripts `.ts` — nenhum `.json`/`.csv`/`.log` com o resultado
   bruto de nenhuma das ~15 rodadas de validação citadas na spec. Todo
   número reportado nas seções 11-11.15 existe apenas como prosa —
   **nenhum é reproduzível sem rerodar contra a API MetaAPI ao vivo**
   (que muda no tempo, então nem sempre reproduz o mesmo resultado).

### 2.2 Hipóteses fortes, não confirmadas por remedição

Estes vieram de leitura de código na sessão anterior. São **prováveis**,
mas continuam não verificados até serem remedidos:

- A Reversão à Média (preset 3) opera invertida (compra quando devia vender)
  por causa da inferência de direção por contagem de operador em
  `StrategyEvaluator.ts:220-222`.
- Os presets 1, 2, 4, 5 são long-only apesar da documentação alegar
  simetria (a perna short nunca foi implementada).
- O Rompimento Confirmado (preset 4) sai em ~1,7 barras por causa do
  exitBlock `ATR FALLING`.
- O trailing stop tem look-ahead leve (usa close da barra para mover o
  stop, testa contra o low da mesma barra) — material nos presets 3/4/5
  (stop apertado), desprezível nos presets 1/2 (stop largo).
- O position sizing usa % de capital como nocional fixo, não normaliza
  risco pela distância do stop, ao contrário do que o comentário do código
  afirma — mas isso **não contamina** os Sharpes/DSRs já calculados, porque
  o script de pesquisa usa retorno percentual, não valor monetário.
- O split treino/holdout tem sobreposição de 60 barras (usada como warmup),
  o oposto do embargo que a seção 8 do `AI_BRAIN_SPEC.md` exige.

**Consequência prática**: as conclusões "nenhum arquétipo passou 95% DSR"
das seções 11-11.15 **não são evidência de ausência de edge nos arquétipos
canônicos** (Donchian, cruzamento de médias, mean-reversion, etc.) — são
evidência de que **esta implementação específica**, com os bugs acima,
perde dinheiro. As duas coisas parecem iguais na prosa da spec antiga; não
são a mesma afirmação, e a diferença é o motivo de este documento existir.

### 2.3 Desconhecido, e vai continuar desconhecido até ação específica

- **Se os arquétipos corrigidos têm edge real** — só descobrimos rerodando
  com o motor corrigido (§6, Fase 1).
- **Se a anomalia de momentum 12-1 documentada por Moskowitz-Ooi-Pedersen
  existe neste conjunto de instrumentos** — nunca foi testada; o que foi
  testado (intradiário, 1h/4h) é um objeto diferente (ver §4.3).
- **Se o poder estatístico disponível (n de holdout realista neste
  produto) consegue distinguir "sem edge" de "edge modesto e real"** para
  qualquer arquétipo — depende do horizonte e do número de instrumentos;
  calculado em §4.5, e o resultado é desconfortável: **provavelmente não**,
  no horizonte intradiário testado até agora.

---

## 3. Auditoria do cérebro atual — 6 defeitos confirmados

Detalhe técnico completo (arquivo:linha, trecho de código, script de
verificação) preservado em `CLAUDE_HISTORY.md` e na sessão de 2026-07-30.
Resumo executivo aqui, para quem só precisa saber *o que* e *por quê*:

### 3.1 ADX diverge do padrão de Wilder — CONFIRMADO POR MEDIÇÃO
`TechnicalIndicators.ts:194-239` usa SMA (média simples) para suavizar a
série de DX. O ADX de Wilder padrão usa RMA (a mesma suavização de Wilder
usada — corretamente — em `wilderSmooth` logo abaixo, no ATR). Erro médio
medido: 4,77 pontos, sobre um indicador cujos gates de regime são 18/20/22.
Muda a decisão do gate em 5,7-10,7% das barras. **Severidade: alta** — 4 dos
5 presets usam ADX como filtro obrigatório de regime.

### 3.2 Reversão à Média provavelmente invertida — HIPÓTESE FORTE
`StrategyEvaluator.ts:220-222` infere a direção do sinal contando quantos
blocos de entrada usam operador "bearish" (`CROSS_BELOW`/`BELOW`/`FALLING`).
O preset 3 tem 2 blocos de entrada, ambos bearish por esse critério
(`PRICE CROSS_BELOW BB_LOWER`, `RSI BELOW 30`) → o sistema classifica como
sinal de **venda**, quando a intenção declarada (compra na sobrevenda,
espera reversão para cima) é o oposto. Não remedido ainda — é a primeira
correção da Fase 1 (§6).

### 3.3 Arquétipos de tendência são long-only — CORRIGIDO (documentação), simetria real ADIADA por decisão explícita

**Status em 2026-07-30, pós Fase 1 parcial**: a direção do sinal agora é
declarada explicitamente (`Strategy.entrySignal`, ver `types/strategy.ts`),
removendo a inferência por contagem de operador que causou o bug do §3.2.
Isso confirmou que os presets 1, 2, 4, 5 são **long-only por implementação**
— nenhum bloco de entrada short existe. A documentação de cada preset
(`presetStrategies.ts`) foi corrigida para declarar isso explicitamente
("Somente lado comprado — LONG-ONLY"), removendo a linguagem que alegava
simetria ("vende no rompimento da mínima", "máxima/mínima... abaixo/acima")
quando na verdade descrevia o **exitBlock** (fecha o long), não uma entrada
short real.

**Decisão de escopo, registrada 2026-07-30**: não implementar a perna short
real nesta rodada. Motivo: fazê-lo corretamente exige que `exitBlocks`
também se tornem conscientes do lado da posição — hoje a regra de saída é
uma só, orientada para fechar um LONG (ex: preset 1 sai por
`CROSS_BELOW DONCHIAN_LOWER`, que seria a regra ERRADA se aplicada a um
SHORT, que precisaria de `CROSS_ABOVE DONCHIAN_UPPER`). Implementar a
simetria sem resolver isso introduziria uma classe nova de bug silencioso,
exatamente no momento em que ainda não se sabe se o lado comprado tem edge
real após as correções do motor (§3.1, §3.2, §3.5). **Revisitar depois da
Fase 2 (remedição dos arquétipos corrigidos)** — só vale o investimento de
engenharia (redesenho do modelo de exitBlocks para suportar os dois lados)
se o lado long mostrar sinal de edge que justifique testar o par completo.

**Consequência que permanece, herdada da versão anterior deste documento**:
qualquer teste já rodado em pares com tendência de dólar forte (3 de base
USD vs. 4 cotados em USD, na cesta de 7 majors usada nas seções
11.10-11.11) mediu principalmente **exposição direcional ao dólar**, não ao
arquétipo de tendência em si — isso não muda até a Fase 2 remedir.

### 3.4 Saída do Rompimento Confirmado provavelmente anula o sinal
`ATR FALLING` como único exitBlock do preset 4 dispara em ~50-60% das
barras (ATR suavizado oscila para baixo com essa frequência). Holding
period esperado ≈ 1,7 barras em 1h — insuficiente para qualquer rompimento
de tendência se desenvolver, mas suficiente para pagar custo de transação
a cada ocorrência.

### 3.5 Look-ahead leve no trailing stop
`BacktestEngine.ts:100-105`: o stop é recalculado usando o *close* da barra
`i`, depois testado contra o *low* da mesma barra `i`. Gera stop-outs
espúrios quando `(close - low) > distância do stop` na mesma barra —
condição rara com stop largo (presets 1/2, k=4/4,5×ATR), comum com stop
apertado (presets 3/4/5, k=1-1,5×ATR).

### 3.6 Zero governança de reprodutibilidade em pesquisa
Nenhum dos ~15 experimentos de validação (seções 11-11.15 do
`AI_BRAIN_SPEC.md`) salvou seu output em arquivo. Todo número citado na
spec existe só em prosa. Esta é, honestamente, a falha mais grave do ponto
de vista de disciplina científica — pior que qualquer bug isolado, porque
significa que **nenhuma conclusão anterior pode ser auditada sem rerodar
tudo contra uma API que muda no tempo**. Corrigido a partir de agora: todo
experimento grava `research/experiments/<data>-<nome>/output.json` com o
resultado bruto, além do script.

**Nota importante de proporção**: os itens 3.1-3.5 são bugs em uma
implementação. Eles invalidam a conclusão "os arquétipos não têm edge" —
não provam o oposto. A resposta certa é remedir com o motor corrigido
(§6, Fase 1), não assumir que os arquétipos funcionam.

---

## 4. O que a literatura financeira real diz — inclusive as réplicas

Esta seção existe para responder à pergunta do Cleber: "essas estratégias
são imprescindíveis para um cérebro eficiente?" — não. E a literatura mais
recente (2019-2024) é mais dura com o paradigma de sinal direcional
puro do que a versão que o `AI_BRAIN_SPEC.md` original citou.

### 4.1 Volatility targeting — a alegação original era otimista, a réplica derruba

**Moreira & Muir, "Volatility-Managed Portfolios" (Journal of Finance,
2017)**: escalar exposição inversamente à volatilidade realizada melhora
o Sharpe de um fluxo de retorno existente. Citado originalmente neste
projeto como prêmio "gratuito" (não exige previsão direcional).

**Réplica que derruba, com peso**: Cederburg, O'Doherty, Wang & Yan, "On
the Performance of Volatility-Managed Portfolios" (2020, publicado em
*Journal of Financial Economics*) testaram **103 estratégias de equity** e
encontraram que o efeito **não sobrevive fora de amostra em tempo real** —
o resultado de Moreira-Muir depende de uma regressão *in-sample* cujo
retrofit não é implementável ao vivo; versões honestas out-of-sample têm
Sharpe **pior**, não melhor, que o ativo sem gestão de volatilidade. **Causa
raiz identificada**: instabilidade estrutural da regressão subjacente.

**Segunda camada da réplica**: Barroso & Detzel mostram que o efeito, onde
sobrevive, **não sobrevive a custo de transação real**.

**Contrarréplica parcial, mais recente**: DeMiguel, Martin-Utrera & Uppal,
"A Multifactor Perspective on Volatility-Managed Portfolios" (*Journal of
Finance*, 2024) — construíram uma versão **condicional multifatorial** que
supera a versão não-condicional mesmo out-of-sample e líquida de custo
(+13% de Sharpe). Mas o preço de admissão é sofisticação real (múltiplos
fatores, condicionamento explícito) — não é "escalar por 1/σ" ingênuo.

**Achado à parte, aplicável direto a este produto**: Harvey, Hoyle,
Korgaonkar, Rattray, Sargaison & Van Hemert, "The Impact of Volatility
Targeting" (*Journal of Portfolio Management*, 2018) — testado sobre 60
ativos, 1926-2017. O efeito no Sharpe **só existe de fato para ativos de
risco (equity, crédito)** — para **forex, commodities e bonds** (a maior
parte do catálogo deste produto), **o impacto no Sharpe é desprezível**.
O que sobrevive universalmente, em qualquer classe: **redução de eventos de
cauda extrema** — o vol targeting reduz o tamanho do pior dia porque reduz
exposição justamente quando a volatilidade já subiu.

**Veredito honesto para este projeto**: volatility targeting não é o
"prêmio gratuito" que a versão anterior deste documento sugeriu. É real
para renda variável, fraco para o catálogo de FX/commodities que este
produto de fato opera, e a versão simples (1/σ) tem réplica que a derruba.
**O valor que sobrevive é redução de cauda — que é exatamente o que o
módulo de risco (Fase 1, já implementado) já persegue por outro caminho.**
Não é um pilar novo de alpha; é reforço do que já existe.

### 4.2 Prêmio de rebalanceamento — matematicamente garantido, pequeno em valor

Teoria estocástica de portfólio (Fernholz): uma carteira de ativos
imperfeitamente correlacionados, rebalanceada, tem taxa de crescimento em
excesso `γ* = ½(Σwᵢσᵢ² − σ²carteira) > 0` sempre que correlação < 1. **Isto
é teorema, não achado empírico — não tem réplica que possa derrubar,
porque não depende de previsão nenhuma.** Mas a magnitude é pequena: com
7 pares de FX a ~15% de vol anualizada e correlação média ~0,2,
`γ* ≈ 0,8%/ano`. Cabe sob o custo de round-trip com rebalanceamento
mensal, mas não é o motor principal de retorno de um produto.

### 4.3 Time-series momentum — a anomalia citada nunca foi testada aqui, e a réplica é séria

**Moskowitz, Ooi & Pedersen, "Time Series Momentum" (2012)**: lookback de
12 meses, holding de 1 mês, sobre **58 instrumentos multi-classe** (FX,
equity index, bond, commodity). É a base citada pelo `AI_BRAIN_SPEC.md`
para justificar Donchian/cruzamento de médias.

**O que foi de fato testado neste projeto**: barras de 1h/4h, holding de
horas, 7 pares de uma única classe (FX major). **Objeto completamente
diferente do documentado.** Este é o maior gap metodológico da pesquisa —
maior que qualquer bug de código.

**Réplica que precisa ser levada a sério**: Huang, Li, Wang & Zhou,
"Time-Series Momentum: Is It There?" (*Journal of Financial Economics*,
2020) — reexaminaram a afirmação original e encontraram que, **regressão
ativo-por-ativo mostra pouca evidência de TSM, dentro e fora de amostra**.
A força aparente em regressões *pooled* não é estatisticamente confiável —
o t-stat pooled é menor que os valores críticos de bootstrap paramétrico e
não-paramétrico apropriados. **Achado adicional relevante**: o desempenho
de investimento do TSM é **quase idêntico** ao de uma estratégia baseada
simplesmente na média histórica amostral, sem qualquer "previsibilidade"
real por trás — ou seja, mesmo onde a estratégia é lucrativa, o mecanismo
alegado (momentum como previsão) pode não ser a causa real.

**Consequência prática, honesta**: a técnica de *pooling* usada nas seções
11.10/11.11 deste projeto (agrupar trades de vários pares num único vetor)
é exatamente o tipo de análise que Huang et al. mostram que **infla a
aparência de significância** sem ela ser real quando testada
instrumento-por-instrumento. Isso não invalida a metodologia de pooling
por si (ela é estatisticamente válida para ganhar `n`, ver §2 do
raciocínio anterior) — mas exige, doravante, **sempre reportar o teste
por instrumento junto com o pooled**, e desconfiar de qualquer resultado
onde o pooled é forte mas o individual não é consistente.

### 4.4 Trend-following: decaimento documentado, e é específico de velocidade de sinal

Pesquisa recente sobre performance real de CTAs de trend-following mostra:
**PnL acumulado essencialmente plano desde 2009** — o efeito que existia
antes da crise de 2008 se deteriorou de forma persistente depois. E o
efeito é **heterogêneo por velocidade de sinal**: sinais rápidos (o
equivalente ao horizonte de 1h/4h testado neste projeto) foram os **mais
afetados** pelo decaimento; sinais lentos (o horizonte mensal de
Moskowitz-Ooi-Pedersen) sofreram menos. Em 2025, os índices agregados de
trend-following seguem no vermelho (ex.: TTU Trend Following Index, -9,38%
YTD).

**Implicação direta e desconfortável para este projeto**: os arquétipos 1,
2 e 4 (Donchian, cruzamento de médias, rompimento) rodam exatamente no
segmento de velocidade de sinal — intradiário — mais associado a este
decaimento na literatura. Isso não é razão para desistir, mas é razão para
não esperar edge fácil ali, e para priorizar testar no horizonte lento
(diário/semanal, próximo ao 12-1 mês original) antes de investir mais
tempo recalibrando a versão rápida.

### 4.5 Poder estatístico — o gate de 95% DSR pode estar pedindo o impossível

Cálculo de poder feito sobre os próprios números da seção 11.11
(`n_holdout=322`, 10 anos, 7 pares): erro padrão do Sharpe por trade
`SE(SR) ≈ √(1/322) ≈ 0,0557`. Para o DSR cruzar 95% (`z≥1,645`), o Sharpe
real por trade precisaria ser `≥ 0,092`. Anualizando com ~15 trades/par-ano
(estimativa da própria cesta): `0,092 × √15 ≈ 0,36` de Sharpe anualizado.

**O piso de 95% DSR está, portanto, pedindo para detectar um Sharpe
anualizado verdadeiro de ~0,36 com 95% de confiança** — e o Sharpe de longo
prazo documentado para trend-following diversificado multi-ativo (o
produto que o AQR realmente vende) é 0,5-0,8; para uma perna única numa
única classe, tipicamente 0,2-0,4. **O teste, como desenhado, tem poder
insuficiente para distinguir "sem edge" de "edge real e modesto"** — na
melhor hipótese, ~50% de poder. Isso não significa que há edge escondido;
significa que **o teste não pode responder essa pergunta com o `n`
disponível neste horizonte**, e é preciso ou (a) aumentar `n` via mais
instrumentos/mais tempo, (b) mudar de horizonte para reduzir a variância
por observação, ou (c) mudar o objeto de medição (§4.6).

### 4.6 O que Kestner e Livermore sugerem em vez de perseguir o Sharpe

**Kestner** testou sistematicamente dezenas de sistemas técnicos clássicos
e chegou à mesma conclusão preliminar deste projeto: a maioria falha. A
conclusão dele não foi abandonar sistemática — foi que **sobreviventes são
simples, lentos, e diversificados por muitos mercados**, e que a métrica
certa para avaliar consistência é o **K-ratio** (regressão do log da
equity curve contra o tempo, normalizada pelo erro padrão da inclinação) —
mais informativo que Sharpe puro para amostra pequena de um único caminho,
porque usa toda a trajetória, não só média/desvio dos retornos.

**Livermore**, traduzido para linguagem estatística: o edge de
trend-following historicamente não vem de taxa de acerto (tipicamente
30-40% em sistemas de tendência reais) — vem de **assimetria de payoff**
(poucas perdas grandes evitadas por stop, raros ganhos muito grandes que
pagam todo o resto). **Consequência metodológica poderosa e barata**:
assimetria/convexidade é uma propriedade da **forma** da distribuição de
retorno, detectável com amostra bem menor que a exigida para testar a
**média** com significância (que é o que o Sharpe/DSR faz). Antes de gastar
o orçamento de `n` inteiro tentando provar que a média é positiva, vale
testar a pergunta mais barata e logicamente anterior: **a distribuição de
MFE/MAE do arquétipo mostra skew positivo condicional à entrada?** Se não
mostrar, o arquétipo de tendência está morto por desenho — descoberto sem
gastar o `n` inteiro.

---

## 5. Arquitetura proposta — o cérebro que substitui o atual

### 5.0 A verdade matemática que organiza tudo o resto

**Gestão de risco não cria expectância positiva.** Com edge negativo, a
fração de Kelly ótima é zero — qualquer alocação positiva tem
`E[log W] < 0`. Position sizing, stop-loss, circuit breaker: todos
transformam um sistema de expectância negativa em um sistema que **perde
mais devagar e com menos risco de ruína**, nunca em um vencedor. Isso é
formalmente correto e não é opinião.

**Consequência de produto**: o "pilar de disciplina de execução" (Fase 1
de risco, já implementada) tem valor real e defensável — evita a causa nº1
de ruína no varejo (Wolwacz). Mas **não é alpha**, e comunicá-lo como se
fosse repete o mesmo erro de inflação que a Fase 0 já removeu da landing
page. Ao investidor: "sistema de controle de risco institucional" é a
frase correta; "sistema que gera retorno" não é, até haver edge
comprovado (§6, Fase 1-2).

### 5.1 O defeito estrutural do cérebro atual

Os 5 arquétipos são uma única família: **preditores direcionais de padrão
de preço sobre um instrumento único**. Todos respondem "para que lado o
preço vai?" — a pergunta mais competida do mercado. A equação implícita é:

```
retorno esperado = (edge do sinal direcional) − custo
```

Quando o edge → 0 (o que a medição, mesmo com bugs, sugere que pode estar
acontecendo no horizonte testado), retorno esperado → **negativo**. Ponto
único de falha.

### 5.2 A arquitetura alvo

```
retorno = Σ prêmios estruturais (rebalanceamento, carry)      ← não exige previsão, §4.2
        × escala de volatilidade (onde o efeito é real, §4.1)  ← reforça o módulo de risco existente
        × (1 + tilt direcional com shrinkage → 0)              ← degrada graciosamente a zero
        − custo (gate já implementado, CostModel.ts)
        sujeito a envelope de risco (Fase 1 de risco, já implementada e testada)
```

A diferença que importa em relação ao cérebro atual: quando o `tilt`
direcional tem edge zero (cenário que a medição atual, mesmo viciada,
aponta como plausível no horizonte intradiário), este sistema ainda
entrega os prêmios estruturais menos custo — não fica negativo por
desenho. O sistema atual, com edge zero, entrega só `−custo`.

### 5.3 Componentes concretos, em ordem de prioridade de implementação

1. **Motor de backtest corrigido** (pré-requisito de tudo, §6 Fase 1).
2. **Medição de convexidade/assimetria** como critério de vida-ou-morte de
   um arquétipo de tendência, **antes** de gastar `n` testando a média
   (§4.6) — barato, poder estatístico maior com o mesmo dado.
3. **Momentum de série temporal no horizonte documentado** (12 meses/1 mês,
   cesta multi-classe) — o teste que a spec sempre alegou embasar e nunca
   fez (§4.3).
4. **Volatility targeting**, escopado para onde a literatura mostra que
   funciona (ativos de risco) e não onde não funciona (FX/commodities) —
   tratado como reforço do módulo de risco, não como pilar de retorno novo.
5. **Prêmio de rebalanceamento** — pequeno, mas matematicamente garantido,
   e essencialmente gratuito de adicionar dado o que já existe.
6. **Volume como variável de regime** (impacto de preço por unidade de
   volume, à la Kyle-λ) em vez de `OBV RISING` como flip binário — o uso
   real do princípio de Wyckoff, ainda não implementado neste projeto.
7. **Carry** (diferencial de juros via swap rate MT5) — estrutural, sem
   sinal, com risco de cauda conhecido que o envelope de risco já sabe
   controlar.

---

## 6. Plano de execução

**Princípio geral, herdado do `research/CRITERIA.md`**: cada fase tem
critério de saída explícito, decidido *antes* de começar. Não se avança de
fase por otimismo — avança-se porque o critério foi cumprido, documentado,
com dado real por trás.

**O item mais importante, decidido nesta sessão**: *"Precisamos de uma
versão Beta do cérebro para testes demo"* é o fator crítico do projeto
agora. Todo o plano abaixo está sequenciado para chegar lá o mais rápido
possível sem pular a correção que invalidaria o resultado.

### Fase 1 — Corrigir o motor de backtest — ✅ CONCLUÍDA (2026-07-30)

Nenhum experimento de validação roda antes disto ter sido feito. Rodar em
cima do motor com os bugs conhecidos produziria só mais números não
confiáveis — por isso esta fase bloqueava tudo, e foi executada por completo
antes de qualquer remedição.

**Entregáveis, todos concluídos**:
1. ✅ ADX corrigido para RMA (Wilder), não SMA — `TechnicalIndicators.ts`.
   Verificado numericamente: erro que era de 4,77 pontos médios (até 12 no
   pior caso) caiu para 0,000 contra a fórmula de referência. Ver
   `research/experiments/2026-07-30-engine-audit/`.
2. ✅ Direção do sinal agora **explícita** (`Strategy.entrySignal`,
   `types/strategy.ts`), não mais inferida por contagem de operador.
   Corrigiu a inversão confirmada do preset 3 (Reversão à Média — antes
   emitia SELL na sobrevenda, devia emitir BUY). Asserção de regressão em
   `src/app/services/indicators/__validate__.ts` (caso 10).
3. ✅ **Decisão explícita tomada** (não implementação): a perna short
   simétrica dos presets 1, 2, 4, 5 fica **adiada**, não implementada nesta
   rodada — motivo registrado em `presetStrategies.ts` (comentário no
   preset 1) e em §3.3 acima: implementar exigiria que `exitBlocks` também
   se tornassem conscientes do lado da posição (hoje a regra de saída é
   orientada só pra fechar LONG), o que introduziria uma classe nova de bug
   antes de saber se o lado comprado tem edge. Documentação de cada preset
   corrigida para declarar "LONG-ONLY" explicitamente, removendo a
   linguagem que alegava simetria inexistente.
4. ✅ ExitBlock `ATR FALLING` do preset 4 **removido** — media (não estimava)
   disparo em 44,3% das barras, holding period esperado ≈2,26 barras.
   Saída agora só por TP/SL (ATR, R:R 1:2) + trailing, já bem definidos.
5. ✅ Trailing stop corrigido para usar o close de `i-1`, nunca o de `i`,
   antes de testar contra o low/high de `i` — `BacktestEngine.ts`.
6. ✅ Empate TP/SL na mesma barra resolvido a favor do SL (pior caso), não
   do TP — remove viés otimista sistemático.
7. ✅ Sizing corrigido para considerar a distância do stop
   (`TradeSizing.calculatePositionSize`, novo parâmetro
   `stopDistancePercent`) — fixed-fractional de verdade agora, aplicado só
   ao `BacktestEngine.ts` (motor ao vivo `useApexLogic.ts` tem sizing
   próprio, fora de escopo desta correção). Confirmado que isso não afeta
   os Sharpes/DSRs já medidos (que usam retorno %, não valor monetário) —
   afeta o dinheiro real, que é o que importa quando o produto opera de
   verdade.
8. ✅ Helper de split com embargo real criado (`research/DataSplit.ts`) —
   substitui o padrão antigo que sobrepunha 60 barras entre treino e
   holdout. `Trade.entryIndex` exposto em `BacktestEngine.ts` para permitir
   filtrar trades cuja entrada caiu na região de warmup. **Nenhum
   experimento antigo foi retrofitado** (os resultados de 11.5-11.15 já
   estão marcados como não confiáveis e serão remedidos do zero na Fase 2,
   usando este helper desde o início).
9. ✅ LCG do bootstrap substituído por mulberry32 (período 2³², vs. o
   período de ~10.466 medido no LCG antigo) — `DeflatedSharpe.ts`.
   Verificado: sem duplicatas anômalas em 500k amostras, qui-quadrado de
   uniformidade passa.
10. ✅ Scripts de auditoria desta sessão salvos com output em
    `research/experiments/2026-07-30-engine-audit/` (README explica cada
    um) — cumprindo a própria regra que este item criou.

**Critério de saída, cumprido**: `npm run validate` verde — 20 asserções em
indicadores (`indicators/__validate__.ts`, 4 novas cobrindo ADX e o fix do
preset 3/4) + 12 no motor SMC (inalteradas) + 5 novas no motor de backtest
(`strategy/__validate__.ts`, novo — trailing stop, empate TP/SL, sizing),
37 no total, 0 falhas, type-check limpo. Cada um dos 6 bugs originais tem
um caso sintético que provaria a regressão se o bug fosse reintroduzido.

### Fase 2 — Remedir os 5 arquétipos com o motor corrigido (1 semana)

**Não** para promover nenhum arquétipo automaticamente — para saber o que
a evidência real diz, pela primeira vez.

**Entregáveis**:
1. Rerodar as mesmas cestas já usadas (forex major, cripto) com o motor
   corrigido, mesma disciplina de holdout/DSR, agora com output salvo.
2. Reportar por instrumento **e** pooled, sempre os dois juntos (lição de
   Huang et al., §4.3) — nunca só o pooled.
3. Medir convexidade/skew de MFE-MAE **antes** de correr atrás de
   significância de média (lição de Livermore/Kestner, §4.6) — é o
   critério de corte mais barato.
4. Reportar honestamente, incluindo se a Reversão à Média muda de sinal
   dramaticamente (predição registrada: deveria, se a hipótese de inversão
   estiver certa) — se não mudar, é achado forte por si só.

**Critério de saída**: relatório com número real por arquétipo, incluindo
os que continuarem sem edge — decisão de produto documentada em cima do
resultado real, não da esperança.

### Fase 3 — Testar a anomalia real, no horizonte documentado (1-2 semanas)

**Entregáveis**:
1. Momentum de série temporal 12-1 mês, holding mensal, cesta multi-classe
   (FX + índice + commodity, o que o catálogo do produto já cobre) — o
   teste que a spec sempre citou como base e nunca executou.
2. Cálculo de poder estatístico **antes** de rodar — se o `n` disponível
   não permitir detectar o efeito mínimo plausível pela literatura
   (Sharpe ~0,3-0,5 anualizado para esta classe), documentar isso
   explicitamente em vez de rodar um teste que não pode informar.

**Critério de saída**: resposta com número real sobre se a anomalia
documentada por Moskowitz-Ooi-Pedersen aparece neste conjunto de
instrumentos — mesmo que a resposta seja "não" ou "poder insuficiente para
saber".

### Fase 4 — Componentes estruturais sem previsão, em paralelo à Fase 3

Não dependem do resultado das Fases 2-3 — podem começar em paralelo.

**Entregáveis**:
1. Prêmio de rebalanceamento (matematicamente garantido, §4.2/5.3) —
   implementação simples, baixo risco de engenharia.
2. Volatility targeting escopado só para onde a literatura mostra efeito
   real (ativos de risco, não FX/commodity puro) — integrado ao módulo de
   risco já existente, não como feature separada.
3. Carry via swap rate MT5 — estrutural, com risco de cauda conhecido.

**Critério de saída**: cada componente com o número real do seu próprio
teste de significância (mesma disciplina — nunca aceito "por ser óbvio").

### Fase 5 — Cérebro Beta para demo (o objetivo declarado como mais
importante desta sessão)

**Composição do Beta**, montada com o que sobreviver das Fases 2-4:

```
Beta = componentes estruturais validados (Fase 4)
     + tilt direcional dos arquétipos que sobreviverem à Fase 2/3
       (shrinkage para zero se nenhum sobreviver — o Beta ainda funciona,
       só sem tilt, entregando os prêmios estruturais menos custo)
     + envelope de risco (Fase 1 de risco do produto, já implementada)
     + Estágios 1-2 da ponte decisão→execução (já implementados)
```

**Ponto crítico de honestidade**: é matematicamente possível — e seria o
resultado mais provável dado o histórico de decaimento de trend-following
intradiário (§4.4) — que **nenhum arquétipo direcional sobreviva** às
Fases 2-3. Isso **não impede** o Beta de existir: o Beta com tilt zerado
ainda é um sistema real, com prêmios estruturais mensuráveis, envelope de
risco de nível institucional, e execução com confirmação manual — só não
tem alpha direcional. Este é exatamente o cenário que precisa estar
comunicado ao Cleber **antes** de qualquer conversa com investidor, para a
mensagem ser "disciplina + prêmios estruturais mensuráveis" e não "IA que
prevê o mercado" — a mesma correção que a Fase 0 do roadmap de investidor
já fez na landing page, agora aplicada à comunicação sobre o cérebro.

**Entregáveis**:
1. Cérebro Beta rodando em modo DEMO (dado real, execução virtual
   persistida) com a composição acima.
2. Dashboard mostrando, separadamente: retorno atribuído a prêmio
   estrutural vs. retorno atribuído a tilt direcional vs. custo — nunca um
   número agregado que esconda a origem.
3. Disclaimer permanente (herdado do desenho de Fase 6/9.1 do
   `AI_BRAIN_SPEC.md`) sempre que o tilt direcional estiver ativo e sem
   validação estatística completa.

**Critério de saída**: Beta rodando em DEMO por período mínimo (2-4
semanas) sem falha operacional, com atribuição de retorno honesta e
auditável — pronto para ser mostrado a um investidor como *demonstração
de disciplina de sistema*, com a alegação de alpha (se houver) rotulada
exatamente pelo grau de confiança estatística real que tiver.

### Fase 6 — Trilha de investidor (paralela desde o dia 1, como já estava
no roadmap anterior)

Herdado do `ROADMAP-INVESTIDORES-NEURAL-DAY-TRADER.md` anterior, sem
mudança de mérito — só consolidado aqui:

1. **Trilha jurídica** (mercado de capitais, não é o mesmo advogado de
   tech/LGPD) — inicia imediatamente, maior lead time, pode redesenhar o
   modelo de receita.
2. **Validação com usuários reais em demo** — 10 usuários externos,
   métricas definidas antes de começar (retenção, enforcement de risco em
   ação, disposição a pagar).
3. **Primeiros usuários pagantes** — receita recorrente pequena e real.
4. **Higiene financeira** — projeção corrigida com impostos, CAC real,
   churn pessimista.
5. **Materiais e mapeamento de investidor** — só depois que 1-4 fecharem.

### Resumo visual de dependência

```
Fase 1 (motor corrigido) ─┬─→ Fase 2 (remedir arquétipos) ─┬─→ Fase 5 (Beta demo)
                          │                                 │
                          └─→ Fase 3 (momentum real) ───────┤
                                                             │
                          Fase 4 (estrutural, paralela) ─────┘

Fase 6 (investidor) roda em paralelo a tudo, desde o dia 1,
mas a Fase 7 dela (materiais/pitch) só começa depois da Fase 5 render Beta.
```

---

## 7. O que fica explicitamente fora de escopo por agora

- **Estágio 3 da ponte decisão→execução** (execução automática real) —
  fica para depois do Beta (Fase 5) rodar um período mínimo sem falha
  operacional. Critério de avanço é operacional, nunca lucro (decisão já
  travada em `AI_BRAIN_SPEC.md` §9.1).
- **Trilho 2 antigo** (order book, calendário como filtro, features
  cross-asset com dado pago) — permanece pausado; nada nas Fases 1-5 deste
  plano depende dele.
- **Segunda corretora / diversificação de parceiro MetaAPI** — só se o
  volume da Fase 6.2 (validação com usuário real) exigir.

---

## 8. Lembretes fixos (herdados, continuam valendo)

- Comunicação sempre em português do Brasil.
- Nunca `git commit`/`git push` sozinho — sempre entregar comando pronto.
- Nunca fabricar dado — erro explícito quando não há fonte real.
- `npm run validate` obrigatório antes de qualquer commit que toque o
  motor de decisão.
- Rigor de especialista + honestidade radical — sempre, mesmo quando o
  resultado é ruim ou constrangedor (esta sessão é o exemplo mais recente
  do porquê essa regra existe).
- `main` = manutenção deliberada, `dev` = app real (preview protegido).

---

## Fontes citadas nesta seção (§4), para auditoria futura

- Moreira, A. & Muir, T. (2017). "Volatility-Managed Portfolios." *Journal
  of Finance.*
- Cederburg, S., O'Doherty, M., Wang, F. & Yan, X. (2020). "On the
  Performance of Volatility-Managed Portfolios." *Journal of Financial
  Economics.*
- DeMiguel, V., Martin-Utrera, A. & Uppal, R. (2024). "A Multifactor
  Perspective on Volatility-Managed Portfolios." *Journal of Finance.*
- Harvey, C., Hoyle, E., Korgaonkar, R., Rattray, S., Sargaison, M. & Van
  Hemert, O. (2018). "The Impact of Volatility Targeting." *Journal of
  Portfolio Management.*
- Moskowitz, T., Ooi, Y. H. & Pedersen, L. H. (2012). "Time Series
  Momentum." *Journal of Financial Economics.*
- Huang, D., Li, J., Wang, L. & Zhou, G. (2020). "Time-Series Momentum: Is
  It There?" *Journal of Financial Economics.*
- Hurst, B., Ooi, Y. H. & Pedersen, L. H. (2017). "A Century of Evidence
  on Trend-Following Investing." *Journal of Portfolio Management* (AQR).
- Bailey, D., Borwein, J., López de Prado, M. & Zhu, Q. J. (2014).
  "Pseudo-Mathematics and Financial Charlatanism: The Effects of Backtest
  Overfitting on Out-of-Sample Performance." *Notices of the AMS.*
- Bailey, D. & López de Prado, M. (2014). "The Deflated Sharpe Ratio:
  Correcting for Selection Bias, Backtest Overfitting and Non-Normality."
  *Journal of Portfolio Management.*
- Kestner, L. (2003). "Quantitative Trading Strategies." K-ratio.
