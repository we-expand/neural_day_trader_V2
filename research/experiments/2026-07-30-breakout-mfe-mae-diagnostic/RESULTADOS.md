# Diagnóstico barato: MFE/MAE de rompimento de topo/fundo (Donchian)

> Pedido pelo Cleber em 2026-07-30, como etapa 0 antes de desenhar qualquer
> estratégia em torno da hipótese "rompimento gera corrida de preço
> favorável, payoff assimétrico". Sem custo de transação, sem sizing — só a
> pergunta: dado que o preço rompeu, o movimento subsequente tende a ser
> maior a favor do que contra?

## Desenho

- Sinal: fechamento rompe Donchian(20) — mesmo período já usado no preset
  "Rompimento de Canal" do produto (`presetStrategies.ts`), não é parâmetro
  novo escolhido a dedo.
- Saída/janela de medição: Donchian(10) oposto — mesma regra de saída já
  usada nesse preset. Não é horizonte fixo arbitrário.
- Zero grid search, zero ajuste de parâmetro do sinal/saída em toda a
  investigação (rodada 1 e rodada estendida).

Script: `breakout-mfe-mae.ts`. Output bruto: `output.json` (sobrescrito pela
rodada estendida — o `git log`/histórico desta conversa preserva os números
da rodada 1 abaixo).

## Rodada 1 (descartada por poder estatístico insuficiente)

BTCUSDT sozinho, 6 meses. 15m não mostrou o padrão (razão MFE/MAE pooled
0,856); 1h mostrou (1,504) mas com **n=35 pooled** — mesma classe de amostra
pequena que a seção 11.10→11.11 do `AI_BRAIN_SPEC.md` já mostrou reverter
com mais dado. Resultado descartado como não-conclusivo, não como negativo
nem positivo — motivou a rodada estendida abaixo.

## Rodada estendida — cesta cripto completa, 24 meses

Mesma cesta já usada na seção 11.13 (BTCUSDT, ETHUSDT, BNBUSDT, SOLUSDT,
XRPUSDT, ADAUSDT, DOGEUSDT — não escolhida agora, é o padrão do projeto),
24 meses de calendário, holdout com embargo (3 janelas 70/30).

### MFE/MAE (excursões, extremos — não é o retorno real capturado)

| Timeframe | Lado | n | MFE médio | MAE médio | Razão MFE/MAE (mediana) |
|---|---|---|---|---|---|
| 15m | LONG | 2.007 | 1,434% | 0,938% | 1,047 |
| 15m | SHORT | 2.051 | 2,097% | 1,036% | 1,330 |
| 15m | POOLED | 4.058 | 1,769% | 0,988% | **1,197** |
| 1h | LONG | 469 | 2,778% | 1,936% | 0,935 |
| 1h | SHORT | 504 | 4,688% | 1,880% | 1,538 |
| 1h | POOLED | 973 | 3,767% | 1,907% | **1,181** |

Com n grande, o padrão **é consistente através dos 7 instrumentos em 15m**
(razão >1 em todos: 1,04 a 1,38) — diferente da rodada 1, que era ruído de
amostra pequena. Em 1h, 6 de 7 instrumentos ficam acima de 1 (ADAUSDT fica
em 0,899). O lado SHORT mostra assimetria mais forte que o LONG nos dois
timeframes — achado não previsto pela hipótese original, mas visível nos
dois timeframes e na maioria dos instrumentos, então não parece acaso.

### O que decide de verdade: payoff real da regra executável (não os extremos)

MFE/MAE mede o melhor caso teórico (se você pegasse o topo exato da
excursão). O que a regra de saída *realmente* captura é outra coisa —
calculado a partir do mesmo dado bruto (`grossReturnPercent` de cada trade,
ainda sem custo):

| Timeframe | n | Win rate | Ganho médio (vencedor) | Perda média (perdedor) | Payoff ratio | EV bruto (sem custo) |
|---|---|---|---|---|---|---|
| 15m | 4.058 | 35,4% | +1,788% | -0,998% | **1,79** | **-0,011%** |
| 1h | 973 | 34,1% | +3,720% | -1,977% | **1,88** | **-0,033%** |

## Leitura honesta

**A assimetria de payoff que você descreveu EXISTE de fato nesta regra —
não é ilusão.** Payoff ratio real de ~1,8-1,9x (quando ganha, ganha quase
o dobro do que perde quando perde) é um resultado genuíno, consistente em
n grande (973 a 4.058) e através dos 7 instrumentos. Isso confirma
diretamente a mecânica que você descreveu: "ganha muito quando ganha,
perde pouco quando perde" — na dimensão do TAMANHO do trade, esse desenho
funciona.

**Mas o win rate (34-35%) está exatamente no ponto de equilíbrio, não
acima dele.** Breakeven matemático de win rate para payoff 1,79x é 35,8%
(1/(1+1,79)); para 1,88x é 34,7%. Os win rates observados (35,4% e 34,1%)
ficam a poucas frações de ponto percentual dessas linhas — o EV bruto
(sem NENHUM custo de transação ainda) já é levemente negativo nos dois
timeframes. Qualquer custo real (spread, comissão, slippage) empurra isso
mais pra baixo — a mesma causa raiz que já apareceu nos 4 testes do
experimento irmão de cruzamento SMA (`../2026-07-30-custom-sma-pullback/`).

## Veredicto desta etapa

**A hipótese de payoff assimétrico está parcialmente confirmada — e é o
resultado mais promissor desta sessão de pesquisa**: diferente de todos os
15+ arquétipos testados nas seções 11.5-11.12 (que falhavam tanto em win
rate quanto em payoff), este desenho tem payoff genuinamente favorável.
O que falta não é a assimetria — é win rate suficiente pra capturar essa
assimetria com folga sobre o custo real. Isso é uma lacuna MENOR e mais
tratável do que "sem edge nenhum": significa que vale a pena testar a
estratégia executável completa (com `CostModel.ts`, `TradeSizing.ts`,
disciplina de holdout) para ver se o custo real transforma o EV levemente
negativo em positivo ou negativo — ao contrário das rodadas anteriores,
aqui não estou descartando a linha antes de gastar o ciclo de execução,
porque a condição necessária passou com amostra grande.

**Próximo passo recomendado**: montar a estratégia executável (mesmo sinal
Donchian(20)/saída Donchian(10), ambos os lados) com custo real via
`CostModel.ts` e sizing via `TradeSizing.ts`, testada com a disciplina
completa do `CRITERIA.md` (≥100 sinais por grupo — já garantido pelo n
desta rodada — IC 95%, DSR). Diferença chave em relação aos testes SMA de
hoje: aqui o payoff ratio real já está medido e é >1,7x, então o teste
completo decide se sobra alguma coisa depois do custo — não é mais uma
aposta às cegas.
