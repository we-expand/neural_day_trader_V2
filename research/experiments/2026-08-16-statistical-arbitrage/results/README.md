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
