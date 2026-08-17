# Item 2 do redesenho do cérebro — score contínuo vs. gate binário (2026-08-16)

## O que foi medido

Mesmo dado real em cache (`2026-08-05-taxa-base/data/`, 15m/1h, 8 ativos × 5
presets = 80 combinações), mesmo motor de saída (TP/SL/trailing de
`BacktestEngine.ts`, sem alteração), mesmo `CostModel.ts`. Única variável:
entrada por `evaluateStrategyScoreAt` (score contínuo, pesos iguais, ver
`StrategyEvaluator.ts`) com piso em 40/50/60/70, comparada contra o gate
binário atual (`evaluateStrategyAt`, produção).

Script: `scripts/compare.ts`. Dado bruto: `score_vs_gate.json`. Tabela
completa: `score_vs_gate.md`.

## Resultado

**O score contínuo, do jeito que foi especificado (pesos iguais entre
blocos), piora o cérebro — não melhora.**

| Piso | Frequência média (× gate) | Melhor que gate | Pior que gate | Delta médio de resultado líquido |
|---|---:|---:|---:|---:|
| 40 | 7,54x | 27/80 | 53/80 | -19,14 p.p. |
| 50 | 6,84x | 26/80 | 53/80 | -18,67 p.p. |
| 60 | 2,06x | 29/80 | 50/80 | -4,21 p.p. |
| 70 | 1,90x | 32/80 | 47/80 | -3,24 p.p. |

Em todo piso testado, a maioria das 80 combinações fica pior (líquido de
custo) que o gate binário — mesmo no piso mais alto (70), que já se aproxima
da frequência do gate (1,9x), o resultado médio ainda é pior, não melhor.
Casos extremos: `Rompimento Confirmado (Volume)` em XAGUSD 15m vai de -96%
(gate) pra -443% no piso 40 — não é ruído de amostra pequena, é sistemático.

## Por que isso acontece (hipótese, não medida separadamente)

Com pesos iguais, um bloco fraco "carrega" um bloco forte até o piso: um
setup que teria falhado no gate binário (1 de 3 blocos não bate) ainda passa
no score contínuo se os outros 2 blocos compensarem a média. Isso destrava
MUITO mais entradas ruins do que entradas boas — a frequência sobe 2x-7x mas
a qualidade cai mais rápido do que a quantidade compensa.

## Decisão

**Não promover o score contínuo pra produção nesta forma.** Isso não invalida
o item 1 (a infraestrutura de `scoreFn`/`evaluateStrategyScoreAt` continua
correta e testada) — invalida a hipótese "pesos iguais + piso simples resolve
frequência". Alternativas a considerar antes de tentar de novo (não
implementadas, precisam de nova rodada de medição cada uma):

1. Pesos não-uniformes por bloco (a pergunta 3 do Cleber em 2026-08-16 já
   previa isso como possibilidade a testar, não a decisão default).
2. Piso mais alto que 70 (não testado aqui — risco de convergir pro próprio
   gate binário sem ganho real de frequência).
3. Score contínuo só como DESEMPATE entre setups que já passam no gate
   binário (mantém a barra de qualidade do gate, usa o score só pra
   `multi-setup` — decisão de "maior score vence" do Cleber já cobre isso),
   não como substituto do piso de entrada.

## Estado ao fim desta medição

Item 1 (infraestrutura de score) implementado e testado — commitado.
Item 2 (esta medição) mostra que a abordagem simples de piso de score não
funciona — **não ligar em `runTradingCycle.ts`**. Item 3 do plano original
(reabrir com pesos ajustados ou score-como-desempate) fica como próximo passo
real, não o item 3 antigo do plano de 5 frentes.
