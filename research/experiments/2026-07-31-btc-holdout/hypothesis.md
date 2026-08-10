# Hipótese — a anomalia BTCUSDT sobrevive fora de amostra?

**Data**: 2026-07-31 · **Escrito ANTES de rodar** · Continuação direta de
[`../2026-07-31-marketscore-baseline/`](../2026-07-31-marketscore-baseline/)

## O que se testa

No baseline, 20 de 21 combinações ativo×timeframe falharam (hit rate pooled de
convicção **46,12%**, correlação ~0). Uma passou todos os 4 critérios:

| Combinação | n | Hit | Compra | Venda | p | netEdge |
|---|---|---|---|---|---|---|
| BTCUSDT 4h | 88 | 68,2% | 68,8% | 67,5% | 0,0004 | +0,390% |
| BTCUSDT 1h | 90 | 61,1% | 61,3% | 61,0% | 0,0223 | +0,069% |

**Pergunta**: isso é estrutura real do BTC, ou é vazamento de calibração?

A suspeita é concreta e nomeada: os pesos e limiares do `MarketScoreEngine`
foram calibrados historicamente **contra BTCUSDT** (seções 11.5, 11.13 e os
testes de 2026-07-30 são todos BTC-centrados). O Bonferroni do baseline corrige
as 21 comparações **daquele** teste; não corrige graus de liberdade gastos
**antes**, na escolha dos pesos. Se o 68,2% for in-sample, ele desaparece fora
da janela usada na calibração.

**Precedente direto neste projeto**: seção 11.10 mediu DSR 85,3% no Cruzamento
EMA+ADX; a seção 11.11 estendeu o calendário sem mexer em nenhum parâmetro e o
DSR caiu para 39,3%, com o Sharpe pooled indo de +0,110 para −0,015. Este
experimento é a mesma manobra aplicada ao Market Score.

## Desenho

1. **Histórico completo** da Binance para BTCUSDT (desde 2017-08) em 1h e 4h.
2. **Corte por calendário**, sem recalibrar nada:
   - **IS** (dentro da amostra do baseline): a janela final que o baseline usou
     — mesma fórmula do `validateScore` (`1500 × msPorBarra × 2,4`);
   - **OOS**: **todo o período anterior a essa janela**, que o baseline nunca
     tocou.
3. **Controle**: os outros 6 ativos da cesta em 4h, também com histórico
   completo. Serve para separar duas explicações rivais —
   - *"BTC é especial"* → BTC melhora/se mantém no OOS e os outros não;
   - *"faltava dado"* → todos melhoram com histórico estendido.
4. **Estabilidade por ano**: hit rate de convicção ano a ano, para ver se o
   efeito é persistente ou concentrado num único regime.

### Otimização de desempenho (com verificação obrigatória)

O baseline passava a fatia inteira do histórico a cada barra —
O(n²), inviável em 78 mil barras. Aqui a fatia passa a ser uma **janela móvel de
500 barras**, o que é matematicamente idêntico para indicadores de lookback
limitado (o maior é SMA200; o próprio validador usa `minLookback = 240`
justificando "SMA200 + folga").

**Verificação de que a otimização não muda o resultado**: antes de qualquer
conclusão, o runner reproduz a janela IS e compara com o baseline. Se BTC 4h IS
não reproduzir ~68,2%, a otimização está errada e o experimento é descartado.
Isso está no `results.json` como `reproductionCheck`.

## Critérios de sucesso (pré-registrados)

Aplicados **ao período OOS**, que é o que importa:

1. **Significância**: hit rate de convicção > 50%, teste binomial unilateral,
   p < 0,025 (Bonferroni para 2 timeframes de BTC).
2. **Consistência**: efeito presente em compra **e** venda.
3. **Relevância econômica**: retorno médio de convicção > custo round-trip
   (0,260% para cripto, tabela 14.3).
4. **Amostra**: n ≥ 100 leituras de convicção no OOS.
5. **Especificidade**: BTC precisa se destacar dos 6 controles. Se os 7 ativos
   melhorarem juntos no histórico estendido, não há nada de BTC — há um efeito
   de amostra.

## Expectativa honesta antes de rodar

**Espero que falhe**, pelo precedente da 11.10→11.11 e porque a explicação
"vazamento de calibração" é a mais econômica para explicar por que exatamente o
ativo mais calibrado do projeto é o único que funciona.

Ambas as saídas são acionáveis:

- **Se falhar** (esperado): a anomalia era in-sample, o `AI_COGNITIVE_SPEC.md`
  fica com o Bloco B construído sobre ATR/ADX/spread crus, e o Trilho 2
  permanece pausado — agora com uma medição a mais sustentando isso.
- **Se sobreviver**: é a **primeira evidência direcional fora de amostra da
  história deste projeto**, e reabre o Trilho 2 legitimamente — por dado, não
  por vontade. Nesse caso o próximo passo obrigatório **não** é operar: é
  testar em ativo fora da cesta cripto, para separar "o score funciona" de
  "o BTC tem estrutura".

## O que este experimento não pode decidir

Nada sobre o valor do score como **veto** (uso real em produção,
`useApexLogic.ts:1397`). Essa medição exige o registro das decisões recusadas —
Bloco A do `AI_COGNITIVE_SPEC.md`, que ainda não existe.
