# Varredura de stop x alvo sobre as entradas reais da IA

Gerado em 2026-10-15T15:22:12.746Z. Entradas desde 2026-09-22T03:00:00Z: 153 consolidadas, 147 com velas de 5m (6 sem velas, 0 sem stop gravado). Treino 102 (mais antigas), teste 45 (mais novas).

Unidade de comparacao: **R em unidades do stop ATUAL** (U = stop que o motor usou, ~2x ATR). Stop 1.0x = o stop de hoje. Alvo = rr x stop da combinacao. Ja liquido do custo real de cada entrada. Stop/alvo FIXOS (sem breakeven, trailing, parcial nem reforco do motor).

**Limite PESSIMISTA** (stop e alvo na mesma vela de 5m = stop) e **OTIMISTA** (= alvo). O resultado real fica entre os dois; o gap entre eles mede o quanto a resolucao de 5m atrapalha.

## TREINO (pessimista) (n=102)

E[R] liquido por entrada, em U. Linhas = stop (x do atual), colunas = alvo (rr x stop).

| stop \ rr | 0.3 | 0.5 | 0.6 | 0.8 | 1 | 1.5 | 2 | 3 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 0.5x | -0.25 | -0.24 | -0.23 | -0.25 | -0.24 | -0.22 | -0.18 | -0.14 |
| 0.75x | -0.25 | -0.27 | -0.26 | -0.25 | -0.23 | -0.21 | -0.16 | -0.14 |
| 1x | -0.23 | -0.24 | -0.21 | -0.21 | -0.16 | -0.13 | -0.12 | -0.10 |
| 1.5x | -0.08 | -0.07 | -0.04 | -0.02 | +0.03 | +0.06 | +0.06 | +0.07 |
| 2x | -0.06 | +0.01 | +0.00 | +0.05 | +0.07 | +0.08 | +0.09 | +0.10 |

## TESTE (pessimista) (n=45)

E[R] liquido por entrada, em U. Linhas = stop (x do atual), colunas = alvo (rr x stop).

| stop \ rr | 0.3 | 0.5 | 0.6 | 0.8 | 1 | 1.5 | 2 | 3 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 0.5x | -0.29 | -0.27 | -0.28 | -0.23 | -0.21 | -0.14 | -0.18 | -0.10 |
| 0.75x | -0.25 | -0.21 | -0.18 | -0.15 | -0.11 | -0.15 | -0.05 | +0.02 |
| 1x | -0.33 | -0.24 | -0.24 | -0.18 | -0.25 | -0.12 | -0.10 | +0.08 |
| 1.5x | -0.31 | -0.25 | -0.28 | -0.22 | -0.12 | -0.05 | +0.09 | +0.14 |
| 2x | -0.28 | -0.26 | -0.22 | -0.11 | -0.11 | +0.08 | +0.10 | +0.12 |

## TUDO (pessimista) (n=147)

E[R] liquido por entrada, em U. Linhas = stop (x do atual), colunas = alvo (rr x stop).

| stop \ rr | 0.3 | 0.5 | 0.6 | 0.8 | 1 | 1.5 | 2 | 3 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 0.5x | -0.26 | -0.25 | -0.25 | -0.24 | -0.23 | -0.20 | -0.18 | -0.13 |
| 0.75x | -0.25 | -0.25 | -0.24 | -0.22 | -0.19 | -0.19 | -0.13 | -0.09 |
| 1x | -0.26 | -0.24 | -0.22 | -0.20 | -0.19 | -0.13 | -0.11 | -0.05 |
| 1.5x | -0.15 | -0.12 | -0.12 | -0.08 | -0.01 | +0.03 | +0.07 | +0.09 |
| 2x | -0.12 | -0.07 | -0.07 | +0.00 | +0.01 | +0.08 | +0.09 | +0.10 |

## TUDO (otimista, empate = alvo) (n=147)

| stop \ rr | 0.3 | 0.5 | 0.6 | 0.8 | 1 | 1.5 | 2 | 3 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 0.5x | -0.26 | -0.25 | -0.25 | -0.24 | -0.23 | -0.20 | -0.18 | -0.13 |
| 0.75x | -0.24 | -0.24 | -0.23 | -0.22 | -0.19 | -0.19 | -0.13 | -0.09 |
| 1x | -0.26 | -0.24 | -0.22 | -0.20 | -0.19 | -0.13 | -0.11 | -0.05 |
| 1.5x | -0.15 | -0.12 | -0.12 | -0.08 | -0.01 | +0.03 | +0.07 | +0.09 |
| 2x | -0.12 | -0.07 | -0.07 | +0.00 | +0.01 | +0.08 | +0.09 | +0.10 |

## Melhores pares no TREINO, conferidos no TESTE

| stop | rr | treino E[R] | treino acerto | teste E[R] | teste IC95 | teste acerto |
|---:|---:|---:|---:|---:|---|---:|
| 2x | 3 | +0.10 | 50% | +0.12 | -0.43 a +0.66 | 44% |
| 2x | 2 | +0.09 | 50% | +0.10 | -0.42 a +0.62 | 44% |
| 2x | 1.5 | +0.08 | 50% | +0.08 | -0.42 a +0.58 | 44% |
| 1.5x | 3 | +0.07 | 49% | +0.14 | -0.39 a +0.67 | 44% |
| 2x | 1 | +0.07 | 51% | -0.11 | -0.52 a +0.30 | 44% |
| 1.5x | 1.5 | +0.06 | 50% | -0.05 | -0.47 a +0.37 | 44% |
| 1.5x | 2 | +0.06 | 49% | +0.09 | -0.40 a +0.57 | 44% |
| 2x | 0.8 | +0.05 | 52% | -0.11 | -0.49 a +0.27 | 47% |

Referencia: opcao A atual (stop 1.0x, alvo 0.6x o stop): treino -0.21, teste -0.24.
Referencia: motor real (com breakeven/trailing/parcial/reforco), E[R] liquido -0.29 (IC95 -0.44 a -0.15), acerto 36%, n=147.

## Por ativo (todas as entradas usaveis; n pequeno, so orientacao)

| ativo | n | opcao A (1.0x, rr 0.6) | rr 0.5 | rr 1.0 | rr 2.0 | stop 0.75x rr 1.0 | stop 1.5x rr 1.0 |
|---|---:|---:|---:|---:|---:|---:|---:|
| AUDNZD | 1 | -0.43 | -0.43 | -0.43 | -0.43 | -0.43 | -0.43 |
| AUS200 | 4 | -0.76 | -0.77 | -0.76 | -0.76 | -0.64 | -0.76 |
| BNBUSD | 9 | -0.03 | +0.02 | +0.02 | +0.45 | -0.10 | +0.49 |
| BTCUSD | 34 | +0.11 | +0.04 | +0.16 | +0.19 | +0.03 | +0.31 |
| CHINA50 | 4 | -1.07 | -0.98 | -1.07 | -1.07 | -0.67 | -0.84 |
| EURUSD | 3 | +0.20 | +0.17 | +0.08 | +0.08 | +0.08 | +0.08 |
| FRA40 | 1 | -1.76 | -1.76 | -1.76 | -1.76 | -1.76 | -2.32 |
| GER40 | 3 | +0.40 | +0.39 | +0.67 | +0.63 | +0.50 | +0.46 |
| HKG33 | 1 | -0.22 | -0.22 | -0.22 | -0.22 | -0.22 | -0.22 |
| JPN225 | 8 | -0.16 | -0.19 | -0.01 | +0.17 | -0.04 | +0.17 |
| LNKUSD | 10 | -0.48 | -0.52 | -0.32 | -0.16 | -0.33 | +0.28 |
| NAS100 | 16 | -0.10 | -0.10 | -0.09 | +0.03 | -0.02 | -0.05 |
| SOLUSD | 3 | -0.65 | -0.68 | -0.59 | -0.59 | -0.95 | -0.83 |
| SPX500 | 6 | -0.32 | -0.33 | -0.32 | -0.32 | -0.28 | -0.30 |
| UK100 | 1 | +0.34 | +0.24 | +0.11 | +0.11 | +0.11 | +0.11 |
| UKOUSD | 13 | -0.37 | -0.31 | -0.31 | +0.12 | -0.42 | +0.14 |
| USDSGD | 1 | +0.16 | +0.16 | +0.16 | +0.16 | +0.16 | +0.16 |
| USDTWD | 1 | -0.38 | -0.38 | -0.38 | -0.38 | -0.38 | -0.38 |
| XETUSD | 28 | -0.42 | -0.47 | -0.50 | -0.63 | -0.31 | -0.36 |

Leitura: com direcao sem vantagem todo par converge para -custo; um par so e melhor se o E[R] do TESTE tambem for positivo com IC95 inferior > 0. Com ~147 entradas o IC e largo -- trate como pista, nao como regra.
