# Sessão 2026-08-22 — Parecer estratégico de produto e proposta de reposicionamento

> **Natureza deste documento**: não é sessão de código. É um parecer de
> produto/negócio pedido pelo Cleber, com pesquisa de mercado real (fontes
> no fim) e uma proposta de reposicionamento do produto. **Nenhuma linha de
> código foi alterada nesta sessão.**
>
> **Status**: discussão em aberto, retomada adiada por decisão do Cleber —
> a IA está em teste ao vivo (positiva, sem quebrar o caixa até agora) e a
> decisão é observar o comportamento por uma semana antes de voltar ao
> assunto. Ver seção "Estado no momento da pausa" no fim.

---

## 1. O pedido

Três perguntas encadeadas do Cleber, todas exigindo resposta honesta sem
inflar nada:

1. Parecer profundo sobre o produto — ele vai ser um sucesso? Vai dar
   lucro? Como ele se compara aos concorrentes e ao que existe no mercado?
2. Se o projeto fosse meu, com 100% de autonomia, que produto eu lançaria
   pra resolver uma dor latente e um gap real de mercado?
3. Duas perguntas de refinamento sobre o desenho proposto (canais de venda,
   e o papel do dimensionamento de posição).

---

## 2. Parecer sobre o produto atual — resumo

**Conclusão central**: na forma atual, eu não apostaria em sucesso comercial
grande. Não por falta de competência técnica — que é real e acima da média
do setor — mas porque a pergunta de fundo foi respondida com "não" e a
pergunta seguinte ainda não foi respondida.

### O fato que determina tudo

O projeto mediu, com metodologia séria (DSR, walk-forward sem look-ahead,
custo real descontado, 5 presets × 135 combinações ativo×timeframe), que
**não há edge comprovado**. EV por trade ≈ −custo. Isso não é detalhe
técnico: é a variável que decide se o produto tem chance comercial, e ela
empurra pro lado ruim.

Produto de trading sem edge, vendido como SaaS pra varejo, tem dois
destinos históricos: (a) ferramenta honesta de nicho pequeno, ou (b) precisa
inflar a narrativa pra vender, e colide com o disclosure regulatório do
setor. O nome **Neural Day Trader** promete exatamente o que a engenharia,
com integridade, decidiu não prometer — tensão que já apareceu internamente
(o card "IA Preditiva" era placeholder desconectado, corrigido em
2026-08-21 para "Viabilidade de Execução").

### O que é genuinamente forte

Disciplina de engenharia rara no setor: trilha de auditoria financeira em
vez de `UPDATE` silencioso, guarda de desvio de preço, telemetria de
calibração, `npm run validate` como gate obrigatório, recusa sistemática de
fabricar dado. Isso separa o projeto de 90% dos "bots de IA" do mercado
(majoritariamente amadores ou golpes). É ativo de credibilidade real — mas
sustenta um pitch de nicho, não de massa.

### Onde o modelo de negócio preocupa mais que o motor

Comissão por lote com aporte mínimo de US$50 é estruturalmente um incentivo
a **volume de trade**, não a sucesso do usuário — mesmo conflito que mancha
corretoras B-book e programas de afiliado de CFD. Somado a: CAC e conversão
no modelo financeiro ainda são meta, não medição (pendência 5 do CLAUDE.md).
A receita depende de gente perdendo devagar o bastante pra continuar
pagando, num produto cujo motor admite EV negativo.

### Concorrência

Categoria "bot de trading com IA" saturada e com reputação desgastada.
Concorrentes sérios competem em custo, marca de corretora, ou modelo de
negócio mais alinhado (prop firm lucra de taxa de avaliação, não da perda do
trader). O projeto não tem hoje nenhum desses diferenciais estruturais.

---

## 3. Dados de mercado levantados (pesquisa desta sessão)

| Dado | Número | Fonte |
|---|---|---|
| Contas de varejo CFD/forex que perdem dinheiro | **76-89%** (divulgação obrigatória ESMA/FCA/CySEC) | disclosure regulatório |
| Day traders B3 que perderam dinheiro persistindo >300 dias | **97%** | Chague, De-Losso & Giovannetti (USP/FGV) |
| ...que ganharam mais que o salário mínimo | **1,1%** | idem |
| Evidência de aprendizado com experiência | **nenhuma** (regressão) | idem |
| Mercado de prop firms | **~US$850M/ano, +45% a/a** | track360 2026 |
| Traders financiados / compras de desafio | 2,1M / 12M por ano | idem |
| Concentração top 5 prop firms | 62% da receita | idem |
| Preço da categoria "journal" | Tradezella $29-99/mês, Tradervue $29,95-49,95, Edgewonk $197/16m | páginas dos produtos |
| Custo de viés comportamental pro trader | ~1,5-2% ao ano | literatura de trading psychology |

**Consenso da literatura sobre a causa da perda**: o trader não falha por
não saber a estratégia — falha por **não conseguir executá-la sob pressão**.
Overtrading, revenge trading, FOMO, aumentar tamanho depois de perda.

---

## 4. O insight central da proposta

> **O mercado é imprevisível. O trader não é.**

O projeto gastou meses provando que o preço é imprevisível para o dado
disponível. A conclusão complementar nunca foi tirada: o **comportamento do
trader** é altamente modelável, com amostra pequena, e — diferente do preço
— o valor de prevê-lo é capturável em dinheiro do próprio usuário.

O alfa que o projeto pode encontrar não está no candle. Está no
comportamento.

---

## 5. A pesquisa que me obrigou a corrigir a proposta

Eu ia afirmar que "firewall de disciplina" era oceano azul. **Não é.** A
categoria já existe e está povoada:

- **TradeReign** — motor de enforcement em nuvem para Tradovate; marketing
  central é "enforça da nuvem, fechar o navegador não desliga"
- **LockMyTrades** — EA para MT4/MT5/TradeLocker, cooldown após perda
- **Trading Buddy** — lockout em TopstepX/Tradovate
- **TradeLock**, **Tradesyncer**, **riskguard**, **FomoBlocker**

**Isso é boa notícia, não má.** Categoria virgem costuma ser aviso de que
não há mercado; categoria nascente e povoada é demanda validada por
terceiros.

### O gap real (o que nenhuma delas faz)

1. São EAs finas ou timers de bloqueio, focadas em futuros americanos. **Zero
   espinha dorsal quantitativa.**
2. **Nenhuma prova o próprio valor em dinheiro.** Bloqueiam e pronto — o
   usuário nunca vê quanto o bloqueio salvou, então cancela na primeira vez
   que se sente cerceado.
3. **Nenhuma é vendida pra corretora.** Todas B2C.
4. Nenhuma modela o trader individualmente.
5. **Nenhuma fala português nem conversa com B3 + MT5.**

---

## 6. O produto proposto

**Um firewall de risco comportamental com motor de prova.**

O usuário declara as regras dele (perda máxima diária, número máximo de
trades, cooldown obrigatório após 2 perdas, proibição de aumentar lote
depois de perda, blackout de notícia, R:R mínimo) e o sistema **impede** —
no MT5 e no servidor, 24/7 — que ele as viole.

### O coração: o livro-razão contrafactual

Todo trade bloqueado é registrado com preço e hora do bloqueio, e o sistema
acompanha o que teria acontecido. Depois de 90 dias existe um número real e
auditável:

> *"suas regras te pouparam R$ 4.312 neste trimestre"*

— ou *"custaram R$ 380"*, se for esse o caso, porque o projeto não fabrica
dado.

Esse número é simultaneamente o mecanismo de retenção, o ativo de marketing,
e a base de uma garantia que **nenhum concorrente consegue copiar**:

> *Se no fim do trimestre o razão mostrar que nossas regras não te pouparam
> pelo menos o valor da assinatura, o trimestre é grátis.*

**A obsessão com honestidade de dado — hoje só cultura interna — vira a
única coisa que sustenta uma garantia dessas.** Concorrente sem infra de
medição não consegue oferecer isso sem quebrar. O passivo (não ter edge,
não poder prometer retorno) vira o fosso.

---

## 7. Mapa de reuso — por que isso é ~80% já construído

Não é pivô de fantasia. É reposicionamento de código existente:

| Já existe no repositório | Vira |
|---|---|
| Gates/veto stages (RISK, COST, margem, notícia, desvio de preço) | motor de regras |
| `ai_funnel_snapshots` / `stage_counts` | base do razão contrafactual |
| `price_guard_events` | padrão de registro de evento |
| `ai-runner` no `pg_cron` 1×/min, independente do navegador | **daemon de enforcement 24/7** |
| MetaAPI + credenciais criptografadas + RLS | conectividade de corretora |
| `ai_trades_audit_log` | auditabilidade (requisito B2B) |
| Backtest com custo real calibrado (`research/CostModel.ts`) | simulador do contrafactual |
| `pointValue` por instrumento + gate de margem + aviso de capital mínimo | **motor de dimensionamento** (ver §10) |
| Motor de sinal de entrada | **descartado da proposta de valor** |

O daemon de servidor é o item mais difícil da lista e já está rodando. O
TradeReign vende exatamente isso como diferencial principal. **Foi
construído sem saber que era o produto.**

### O que falta construir

- UI de autoria de regras (com presets de prop firm: FTMO 5%/10%, Topstep)
- Motor contrafactual (acompanhar trade bloqueado adiante, computar PnL evitado)
- Onboarding read-only (diagnóstico retroativo dos últimos 90 dias)
- Modelo comportamental por trader
- Camada multi-tenant / relatório agregado (fase B2B)

---

## 8. Modelo de receita — dois canais, sequenciais

### B2C é a cunha, não o negócio

A ~$35/mês, US$1M de ARR exige ~2.400 assinantes. Factível, não fácil.

**ICP de entrada**: trader de desafio de prop firm. 12 milhões de compras de
desafio por ano, gente que **já paga** $500-1.000, com regras externas
rígidas cuja violação custa a conta na hora. *"Não estoure seu desafio da
FTMO por violação de regra"* é infinitamente mais afiado que "opere melhor" —
dor concreta, deadline, prejuízo quantificado.

### B2B com corretora é onde está o dinheiro

Toda corretora regulada por ESMA/FCA é **obrigada por lei a estampar em cada
anúncio o percentual dos próprios clientes que perde dinheiro**. É um número
de marketing compulsório que elas odeiam. Um white-label que reduz
mortalidade de conta melhora literalmente esse número — e aumenta o LTV,
porque cliente que estoura a conta em 30 dias para de pagar spread.

Uma corretora média com 20 mil clientes ativos a $2-3/cliente/mês =
**$500-700k de ARR em um contrato**. A relação com a Infinox é porta de
entrada.

**Ressalva honesta**: só funciona com corretora A-book/STP e regulada.
Corretora B-book ganha com a perda do cliente e não tem interesse nenhum.
O mercado B2B é um subconjunto, não o mercado todo.

### Por que é sequencial e não simultâneo

Sem os dados do razão contrafactual acumulados no B2C, não há **nada** pra
vender pra corretora. O B2C não é só receita — é o dataset que viabiliza a
venda B2B. Chega-se à corretora com "reduzimos mortalidade em X% sobre N
contas reais, aqui está a auditoria", não com um slide.

### Conflito de interesse — resolver na arquitetura, não no discurso

Se a corretora paga e o usuário é o protegido, há conflito potencial.
Precisa ser fechado no dia 1, no código:

- **As regras são sempre do usuário.** A corretora nunca configura, nunca
  edita, nunca vê regra individual de cliente identificado.
- A corretora recebe **só agregado** (mortalidade, tempo médio de
  sobrevivência, % de contas no vermelho).
- O usuário pode desligar tudo quando quiser, e ver isso claramente.

Sem essa separação arquitetural e auditável, o produto vira ferramenta de
vigilância vendida à corretora com discurso de proteção ao trader.

---

## 9. A IA continua operando? — a linha exata

**Sim, a IA lança a ordem. Ela só não escolhe a direção.**

Três decisões de um trade, com naturezas matemáticas completamente
diferentes:

| Decisão | Natureza | Dá pra melhorar? |
|---|---|---|
| **Direção/timing** | Requer prever o mercado | **Não** — edge medido ≈ 0 |
| **Tamanho** | **Aritmética pura**, não prevê nada | **Sim, com prova formal** |
| **Saída** | Disciplina | **Sim** |

O que sai é a **originação da decisão de direção**. Nunca mais "a IA achou
que era uma boa entrada". O que fica: calcular, dimensionar, lançar e
proteger.

### Por que essa linha

1. **Aritmética**: com edge 0, EV por ordem originada = −custo. Cada ordem
   originada destrói valor por construção. Cada ordem impedida (quando viola
   a regra do próprio usuário) preserva valor. Mesmo motor de gates,
   apontado pro lado onde a matemática é positiva.
2. **Regulatório — material, não nota de rodapé**: software que toma decisão
   de compra e venda por conta do cliente flerta com administração de
   carteira / consultoria de investimento, reguladas pela CVM no Brasil.
   Software que impede violação de limites que o próprio cliente definiu é
   ferramenta de gestão de risco — muito mais distante dessa fronteira.
   **Precisa de parecer jurídico de verdade antes de qualquer lançamento**,
   mas a diferença de exposição é grande o bastante pra ser critério de
   decisão de produto.
3. **Coerência**: "eu te protejo de você mesmo" + "minha IA opera pra você"
   na mesma landing page não sobrevive à primeira pergunta difícil.

### A exceção mantida (valiosa)

**Entrada = 100% humana. Saída = a que o humano já definiu, executada sem
hesitação.** O trader que não consegue puxar o próprio stop é caso clássico
— efeito de aversão à perda (dor de perder ≈ 2× o prazer de ganhar). Um
sistema que executa friamente o stop declarado antes do comprometimento
emocional resolve isso e **não precisa de edge nenhum**.

### Extensão natural

Se o cliente não tem opinião de direção, existe caminho honesto: **ele
declara a estratégia dele em regras, e a IA executa exatamente como escrito,
com o tamanho certo, sem desvio.** Não é a IA prevendo — é a IA sendo o
executor incorruptível da estratégia escolhida pelo usuário. Na prática:
construtor de EA com motor de risco de nível institucional em cima.

---

## 10. Motor de dimensionamento — a matemática

> Observação do Cleber que originou esta seção: *"muitos clientes se destroem
> porque se alavancam demais, porque não fazem conta de quantos contratos tem
> que colocar versus o que eles têm dentro do caixa. Operar é também saber
> lançar ordens com base em cálculos e fundamentos matemáticos."* — correto,
> e reforça a proposta em vez de contradizê-la.

### 10.1 Por que sizing domina

**Num jogo de deriva zero, o sizing é 100% do destino.** Passeio aleatório
com barreira absorvente (o zero da conta) tem probabilidade de ruína que
depende **só** do tamanho relativo da aposta e da distância até a barreira.
O projeto *mediu* que a deriva é zero. Logo, a única variável sob controle
do trader que determina o resultado **é o tamanho da posição**. A pesquisa
do projeto não só permite esse produto — ela prova que é esse o produto.

**Volatility drag**: retorno geométrico ≈ retorno aritmético − σ²/2. Dobrar
a alavancagem dobra o termo linear e **quadruplica** o termo de variância.
Existe alavancagem além da qual mais alavancagem *reduz* o retorno composto
— e é muito mais baixa do que o varejo imagina.

**Kelly**: f* = edge/odds. Acima de 2× Kelly o crescimento esperado fica
**negativo mesmo com edge positivo** — dá pra quebrar tendo razão. Com edge
zero, Kelly ótimo é zero. O varejo opera rotineiramente em 5-20× Kelly sem
saber que esse número existe.

**Margem ≠ risco**: a corretora deixa abrir 10 contratos porque a *margem*
permite. Margem é o que a corretora exige — não é o que o capital suporta
perder. São números sem relação, e o varejo trata o primeiro como o segundo.

**Correlação**: cinco posições "de 1%" em EURUSD, GBPUSD, EURGBP, AUDUSD e
NZDUSD não são 5 riscos de 1%. É essencialmente **um** risco de ~4% em
dólar. Ninguém faz essa conta.

### 10.2 O motor — pilha de restrições, vence a mais apertada

```
N_risco      = floor( (Capital × r) / (D_stop × pointValue) )
N_margem     = floor( (MargemLivre × 0.7) / MargemPorContrato )
N_vol        = floor( (Capital × r) / (k × ATR × pointValue) )
N_portfolio  = teto após somar exposição correlacionada já aberta
N_liquidez   = teto pelo book/volume médio do instrumento

N_final = min(todos)
```

- `r` = risco por trade declarado pelo usuário (tipicamente 0,5-1%)
- `D_stop` = distância do stop em pontos
- `0.7` na margem = buffer de gap (margem nominal não protege gap de abertura)
- `N_portfolio` usa correlação: cluster por moeda/classe, cluster = **uma**
  unidade de risco

`N_margem` quase sempre é enorme e `N_risco` quase sempre é pequeno. **A
distância entre esses dois números é o buraco onde o cliente cai.** A
corretora mostra só o primeiro. Nenhum produto mostra os dois lado a lado.

### 10.3 Quando não há stop definido

Sem stop não há denominador — não dá pra dimensionar. Duas saídas honestas,
nessa ordem:

1. **Derivar o stop da volatilidade**: `D_stop = k × ATR` (k ≈ 1,5-2)
2. **Recusar a ordem.** Ordem sem stop não é trade, é exposição indefinida.
   Não existe tamanho correto pra risco indefinido.

O stop entra **anexado atomicamente** na mesma ordem — nunca existe janela
entre "entrei" e "me protegi".

### 10.4 A verdade dura: contrato é indivisível

`floor()` às vezes devolve **zero**. Exemplo real na B3:

| Cenário | Conta | Stop | Risco/contrato | Limite 1% | N |
|---|---|---|---|---|---|
| WIN (ponto = R$0,20) | R$ 8.000 | 150 pts | R$ 30 | R$ 80 | **2** ✅ |
| WDO (ponto = R$10) | R$ 8.000 | 10 pts | R$ 100 | R$ 80 | **0** ❌ |
| WDO | R$ 2.000 | 10 pts | R$ 100 | R$ 20 | **0** ❌ |

Na última linha o menor lote possível arrisca **5% da conta**. Não existe
disciplina que salve: duas perdas seguidas = 10%, **pura aritmética, sem
psicologia envolvida**.

O motor precisa poder dar a resposta que ninguém dá:

> *"Com R$ 2.000 você não pode operar WDO sob nenhuma regra de risco sã. O
> menor lote possível já viola seu limite em 5×. Com WIN, você pode."*

Isso vira cálculo de onboarding matador — **capital mínimo viável por
instrumento**, dadas as regras declaradas. Número que o usuário nunca viu,
imediatamente útil, e gratuito de calcular porque `pointValue` e margem de
todo o catálogo já existem.

### 10.5 Consequência incômoda pro produto atual

**O aporte mínimo travado em US$50 (≈ R$270) não sobrevive a essa
aritmética.** Com esse capital, praticamente qualquer instrumento do
catálogo tem lote mínimo que arrisca fração enorme da conta por trade. O
mínimo atual é, matematicamente, **uma garantia de sobrealavancagem** —
exatamente o modo de falha descrito pelo Cleber.

Não significa subir o mínimo e perder cliente. Significa que o mínimo tem
que ser **por instrumento e derivado da regra**, não um número único de
marketing. *"Com US$50 você opera estes 3 ativos"* é honesto, converte, e já
é o produto funcionando antes do primeiro pagamento.

### 10.6 Padrões temporais a detectar

Além do tamanho por ordem — onde a conta morre de vez:

- **Aumentar tamanho depois de perder** (martingale disfarçado). Assinatura:
  `tamanho[n] > tamanho[n-1]` após resultado negativo. Bloqueio duro, não aviso.
- **Piramidar contra a posição** ("preço médio"). Aumenta risco e aproxima
  o ponto de ruína.
- **Risco total crescente em dia perdedor**: se a exposição agregada sobe
  enquanto o PnL do dia cai, é tilt medido objetivamente, sem perguntar nada
  ao usuário.

Os três são detectáveis com aritmética simples sobre o histórico de ordens
e, isolados, provavelmente respondem pela maior parte das mortes de conta.

---

## 11. O que eu mataria (com 100% de autonomia)

1. **O autotrader como proposta de valor.** Vender "protejo você de você
   mesmo" e "minha IA opera por você sem edge provado" na mesma página é
   incoerente e destrói o fosso inteiro. Guarda o código, não vende.
2. **O nome.** "Neural Day Trader" promete previsão neural; o produto novo
   promete o oposto.
3. **Comissão por lote.** Incentivo estruturalmente invertido. Assinatura
   fixa. O programa de IB sobrevive como afiliado sobre assinatura.
4. **O Marketplace com rating/reviews/vendas fabricados** (pendência 4 do
   CLAUDE.md). **Bomba existencial**: um produto cujo fosso é honestidade não
   sobrevive a uma thread no Reddit achando reviews inventados. Ou remove,
   ou o resto não importa.

---

## 12. Riscos honestos

- **Enforcement tem limite técnico.** Via MetaAPI não se bloqueia de verdade
  uma ordem digitada no MT5 do usuário — detecta-se e reverte em 1-3s.
  Bloqueio verdadeiro exige EA no terminal. Resposta certa: ter **os dois**
  (EA bloqueia de fato, nuvem sobrevive ao terminal fechado) — e isso é
  diferencial, porque os concorrentes têm um ou outro.
- **Churn por rebeldia.** Quem quer quebrar a própria regra desinstala. O
  razão contrafactual e o deadline da prop firm são mitigação, não solução.
- **Categoria já povoada.** Entrada por trás, com vantagem de infra e de
  idioma, não de tempo.
- **Teto realista**: negócio de US$1-5M de ARR com caminho crível, e US$10M+
  **só se o canal B2B de corretora fechar**. Não é unicórnio. Mas é real e
  defensável, contra um caminho atual de baixa probabilidade de funcionar.

---

## 13. Parecer final em uma frase

**Não mudar de mercado — mudar de lado do problema.** O projeto tentou
vender a cura (previsão) num mercado onde a cura não existe, e provou isso
melhor do que 99% dos concorrentes provam qualquer coisa. O produto a vender
é o cinto de segurança — o único desse setor cuja eficácia **pode ser
demonstrada com dado real** — e esta equipe é, por cultura e por
infraestrutura, das poucas com condição de demonstrar.

---

## 14. Estado no momento da pausa (2026-08-22)

Decisão do Cleber: **adiar a continuação deste assunto.** A IA está em teste
ao vivo, **positiva e sem ter quebrado o caixa nenhuma vez** até o momento.
O plano é observar o comportamento ao longo da semana antes de retomar a
discussão estratégica.

Nada neste documento foi implementado. Nenhuma decisão foi tomada. Nenhuma
linha de código foi alterada nesta sessão.

**Ao retomar**, os pontos que precisam de decisão do Cleber:

1. Adotar ou não o reposicionamento (firewall de risco comportamental)?
2. Se sim: o autotrader vira modo opcional desligado, ou é aposentado?
3. Aporte mínimo passa a ser derivado por instrumento (§10.5)?
4. Marketplace com dados fabricados — remover antes de qualquer lançamento?
5. Buscar parecer jurídico sobre a fronteira CVM (§9, motivo 2)?

Independentemente da decisão estratégica, dois itens desta análise valem por
si só e podem ser implementados sem mudar o rumo do produto:

- **Motor de dimensionamento (§10.2)** — é `min()` sobre peças que já
  existem no repositório, e protege o usuário atual do produto atual.
- **Detecção dos três padrões temporais (§10.6)** — aritmética simples sobre
  o histórico de ordens.

---

## Fontes

- [Day Trading for a Living? — Chague, De-Losso, Giovannetti (USP/FGV, SSRN)](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3423101)
- [Prop Trading Industry Size 2026: $850M Market Analysis](https://track360.io/blog/prop-trading-industry-report-2026-market-analysis)
- [Prop Trading Statistics 2026: Pass Rates & Market Data](https://track360.io/blog/prop-trading-industry-statistics-2026)
- [Forex Broker Marketing Compliance 2026: Rules & Disclosure](https://track360.io/blog/forex-broker-marketing-compliance-promotion-disclosure-2026)
- [Trading is a losing game: an audit of deceptive choice architecture in demo-mode CFD trading apps (Cambridge, Behavioural Public Policy)](https://www.cambridge.org/core/journals/behavioural-public-policy/article/trading-is-a-losing-game-an-audit-of-deceptive-choice-architecture-in-demomode-contract-for-difference-cfd-trading-apps/07BB4E4CC011413D8A41458F9ED32928)
- [Best Trading Journal Software (2026)](https://www.tradezella.com/blog/best-trading-journal-software)
- [TradeReign — Futures Trading Discipline Engine](https://trade-reign.com/)
- [LockMyTrades — Protect Your Trading Capital](https://www.lockmytrades.com/)
- [Tradesyncer — Risk Management Trading Software](https://tradesyncer.com/risk-management-trading-software)
- [The Top 10 Ways A Trading Psychologist Can Help Your Trading](https://tradingpsychologyhelp.com/what-is-a-trading-psychologist/)
