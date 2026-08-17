# Item 4 do redesenho do cérebro — arbitragem estatística (pairs trading) (2026-08-16)

## O que foi medido

Reabertura do Trilho 2 (pausado desde a busca de edge de julho/agosto — ver
`CLAUDE.md`), motivada pela consultoria + pesquisa sobre Renaissance/Two
Sigma/market makers desta sessão. Diferente de tudo testado até aqui: em vez
de indicador técnico sobre 1 ativo, mede a relação estatística ENTRE dois
ativos correlacionados (cointegração/spread mean-reverting).

Método (walk-forward, sem look-ahead): hedge ratio via OLS numa janela
trailing de 100 candles, z-score do spread na mesma janela, entrada em
|z|≥2,0, saída em |z|≤0,5 (reversão) ou |z|≥3,5 (rompimento da relação) ou 50
candles sem reverter (timeout). Parâmetros fixos, não otimizados — só uma
configuração razoável testada, não busca de melhor config (evitar o mesmo
p-hacking que a busca de TA corrigiu com DSR). Custo real (`CostModel.ts`)
descontado nas DUAS pernas. 6 pares × 2 timeframes (15m/1h) = 12 combinações,
dado real em cache. Script: `scripts/pairsBacktest.ts`. Tabela completa:
`pairs_backtest.md`.

## Resultado

**Sem edge robusto — maioria perde dinheiro líquido de custo.**

- 9 de 12 combinações têm resultado líquido total negativo.
- As 3 combinações positivas têm amostra pequena (35-84 trades) e edge médio
  por trade quase zero (0,010% a 0,027%) — a magnitude é da ordem do ruído
  de arredondamento de custo, não de um sinal real. Não sustenta a barra de
  "edge comprovado" que o projeto já usa (ver `AI_BRAIN_SPEC.md` seção 8):
  amostra mínima, degradação estatística, custo real descontado — aqui falta
  especificamente amostra suficiente e qualquer correção por múltiplos
  testes (12 combinações testadas, nenhuma correção aplicada, então mesmo os
  "positivos" têm bom motivo pra serem falso-positivo por chance).
- O par com pior resultado (`XAUUSD/XAGUSD` 15m, -25,47% líquido total,
  win rate 28,9%) é justamente o par "clássico" de cointegração em
  commodities — não confirma a intuição de manual de curso, o que reforça
  que isto é medição real, não confirmação de viés.

## Por que isso pode estar acontecendo (hipótese, não medida separadamente)

1. **CFD, não ações/futuros do mesmo mercado**: cointegração de livro-texto é
   sobre o MESMO instrumento subjacente (ex. ações do mesmo setor, futuros do
   mesmo índice em vencimentos diferentes). Índices de países diferentes
   (GER40/US30) ou commodities relacionadas mas com dinâmica de oferta/demanda
   própria (ouro/prata) têm cointegração mais fraca e instável do que o
   método assume.
2. **Janela de calibração fixa (100 candles) pode ser curta ou longa demais**
   pra capturar a relação real — não testamos sensibilidade de propósito
   (ver "parâmetros fixos" acima), então não dá pra distinguir "a ideia não
   funciona" de "esta configuração específica não funciona".
3. **Custo por trade em CFD é caro o bastante pra consumir edges pequenos
   rápido** — mesma lição do gate de custo de scalp 1m (2026-08-16): a
   frequência mais alta que arbitragem estatística produz (1-1,5 trades/dia
   em 15m) multiplica o custo total mais rápido do que a média de reversões
   pequenas compensa.

## Decisão

**Não implementar arbitragem estatística em produção com esta configuração.**
Diferente do achado do item 2 (score contínuo), aqui a causa mais provável
não é "a ideia está errada" — é "esta primeira tentativa não validou, e não
sabemos ainda se é a ideia ou a calibração". Antes de declarar esta frente
fechada (como TA clássico foi em julho), seria preciso pelo menos:

1. Testar sensibilidade de parâmetros com correção por múltiplos testes
   (DSR), não só 1 configuração.
2. Testar pares de instrumentos mais próximos (ex. futuros de índice do
   mesmo mercado em vencimentos diferentes, se disponíveis via MetaAPI —
   hoje não temos esse dado).
3. Considerar que o produto (CFD via corretora de varejo, custo mais alto
   que exchange/futuros institucional) pode simplesmente não ter margem pra
   esse tipo de estratégia, independente da qualidade do sinal — é um limite
   estrutural, não de calibração.

Sem dado adicional, não há base pra prometer edge aqui — mesma disciplina
aplicada ao Trilho 1 (TA clássico) em julho.

## Estado ao fim desta medição

Trilho 2 reaberto e testado uma primeira vez — resultado não sustenta
promoção, mas também não fecha a porta definitivamente (ao contrário do
Trilho 1, que teve DSR e múltiplas rodadas antes de fechar). Se retomado,
próximo passo é (1)-(3) acima, não repetir esta mesma configuração.

## Addendum — sensibilidade de parâmetros com DSR (mesma sessão, retomada)

Executado o item (1) do que faltava: varredura de 18 configurações por
par×timeframe (janela de OLS ∈ {50,100,150}, z de entrada ∈ {1,5, 2,0, 2,5},
z de saída ∈ {0,5, 1,0}, stop-z e hold-máx mantidos fixos) — 216 backtests no
total sobre os mesmos 6 pares × 2 timeframes, mesmo dado real em cache,
mesmo custo nas duas pernas, mesma disciplina walk-forward sem look-ahead.
Por par×timeframe, aplicado DSR (`research/DeflatedSharpe.ts`, já usado na
busca de TA de julho) sobre a melhor config, usando as 18 tentativas como
`nTrials` — corrige exatamente o viés de "escolher a config que deu melhor
depois de olhar o resultado". Script:
`scripts/pairsSensitivity.ts`. Tabela completa: `pairs_sensitivity_summary.md`.

**Resultado: nenhum par×timeframe passa perto do piso convencional de DSR
95%.** Melhor caso é US30/NAS100 1h com DSR=54,6% (Sharpe=0,167, 58 trades,
+4,41% líquido total) — ainda abaixo de "provavelmente real". A maioria fica
bem mais baixa (vários em 0,0%–7,4%), incluindo XAUUSD/XAGUSD nos dois
timeframes.

**Isto responde a pergunta que ficou em aberto no corpo do documento acima:**
não era "calibração errada" — mesmo dando 18 chances de calibração por par
(janela e limiares diferentes), nenhum resultado sobrevive à correção por
múltiplos testes. Isso é evidência mais forte que a rodada original contra
a hipótese de que exista edge explorável nesses pares específicos com este
método (spread OLS + z-score de reversão à média), nesta configuração de
timeframes (15m/1h) e neste conjunto de 6 pares.

**Decisão atualizada**: não prosseguir com arbitragem estatística nestes
pares/timeframes/método. Os itens (2) e (3) do corpo do documento (pares de
instrumento mais próximos do mesmo mercado, e o limite estrutural de custo
de CFD de varejo) continuam não testados e são o que restaria SE alguém
quisesse reabrir esta frente — mas dado que nem a sensibilidade de
calibração ampla salvou nenhum par, a probabilidade de que "pares mais
próximos" resolva sozinho é baixa sem indício adicional. Recomendação: não
investir mais tempo aqui sem uma fonte de dado genuinamente nova
(instrumentos do mesmo mercado, hoje indisponíveis via MetaAPI).
