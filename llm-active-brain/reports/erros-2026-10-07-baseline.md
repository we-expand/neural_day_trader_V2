# Relatório de erros do LLM Brain

Gerado em 2026-10-07T23:25:51.480Z | escopo: entradas da IA desde 2026-09-22

Somente leitura. Etiquetas são triagem, não veredito; ver cabeçalho de scripts/error-report.ts.

## Total

- entradas: 103 (excluídas por falta de stop/quantidade para medir risco: 0)
- acerto: 33.0% (IC95 25-43)
- E[R] líquido: -0.35 por entrada (IC95 -0.52 a -0.19) | custo médio 0.11R | P&L líquido $-97.34
- progresso da janela congelada de 100 entradas (só as do pacote de 07/10, reversalRule = padrao-candle-confirmado-v2): 0/100
- últimas 10 entradas: PPPGGPGPPP (G=ganho, P=perda), -6.47 $

## Onde perde (ordenado do pior para o melhor, por E[R] × n)

### Ativo + lado

| balde | n | acerto (IC95) | E[R] líquido (IC95) | custo em R | P&L $ | etiqueta |
|---|---:|---|---|---:|---:|---|
| XETUSD SHORT | 18 | 17% (6-39) | -0.62 (-0.98 a -0.27) | 0.13 | -42.28 | POUCA AMOSTRA |
| XETUSD LONG | 9 | 22% (6-55) | -0.52 (-1.11 a +0.08) | 0.08 | -19.98 | POUCA AMOSTRA |
| NAS100 SHORT | 5 | 40% (12-77) | -0.82 (-2.16 a +0.52) | 0.08 | -11.31 | POUCA AMOSTRA |
| LNKUSD LONG | 5 | 20% (4-62) | -0.77 (-1.33 a -0.22) | 0.03 | -0.46 | POUCA AMOSTRA |
| AUS200 LONG | 2 | 0% (0-66) | -1.29 (-1.42 a -1.16) | 0.27 | -10.29 | POUCA AMOSTRA |
| SOLUSD LONG | 2 | 0% (0-66) | -1.06 (-1.06 a -1.06) | 0.04 | -1.68 | POUCA AMOSTRA |
| JPN225 LONG | 2 | 0% (0-66) | -1.04 (-1.05 a -1.03) | 0.04 | -6.30 | POUCA AMOSTRA |
| SPX500 SHORT | 2 | 0% (0-66) | -0.93 (-1.35 a -0.51) | 0.26 | -5.27 | POUCA AMOSTRA |
| SPX500 LONG | 2 | 0% (0-66) | -0.90 (-1.57 a -0.23) | 0.24 | -7.59 | POUCA AMOSTRA |
| CHINA50 LONG | 2 | 0% (0-66) | -0.64 (-1.77 a +0.48) | 0.21 | -4.13 | POUCA AMOSTRA |
| LNKUSD SHORT | 5 | 20% (4-62) | -0.22 (-1.06 a +0.63) | 0.03 | -0.15 | POUCA AMOSTRA |
| SOLUSD SHORT | 1 | 0% (0-79) | -1.05 (n/d a +n/d) | 0.04 | -0.84 | POUCA AMOSTRA |
| NAS100 LONG | 4 | 25% (5-70) | -0.25 (-1.34 a +0.84) | 0.06 | -5.93 | POUCA AMOSTRA |
| BNBUSD SHORT | 3 | 33% (6-79) | -0.17 (-1.52 a +1.17) | 0.24 | +0.09 | POUCA AMOSTRA |
| FRA40 LONG | 1 | 0% (0-79) | -0.37 (n/d a +n/d) | 0.38 | -0.96 | POUCA AMOSTRA |
| BNBUSD LONG | 1 | 0% (0-79) | -0.34 (n/d a +n/d) | 0.34 | -0.79 | POUCA AMOSTRA |
| AUDNZD SHORT | 1 | 0% (0-79) | -0.33 (n/d a +n/d) | 0.04 | -1.20 | POUCA AMOSTRA |
| UKOUSD SHORT | 3 | 33% (6-79) | -0.03 (-1.59 a +1.53) | 0.08 | +3.48 | POUCA AMOSTRA |
| GER40 SHORT | 2 | 50% (9-91) | -0.03 (-2.19 a +2.14) | 0.10 | +0.80 | POUCA AMOSTRA |
| UK100 SHORT | 1 | 100% (21-100) | +0.07 (n/d a +n/d) | 0.26 | +0.24 | POUCA AMOSTRA |
| EURUSD SHORT | 2 | 50% (9-91) | +0.05 (-0.12 a +0.22) | 0.03 | +0.96 | POUCA AMOSTRA |
| GER40 LONG | 1 | 100% (21-100) | +0.19 (n/d a +n/d) | 0.12 | +0.56 | POUCA AMOSTRA |
| UKOUSD LONG | 1 | 100% (21-100) | +0.20 (n/d a +n/d) | 0.10 | +0.69 | POUCA AMOSTRA |
| USDTWD LONG | 1 | 100% (21-100) | +0.30 (n/d a +n/d) | 0.19 | +1.48 | POUCA AMOSTRA |
| USDSGD LONG | 1 | 100% (21-100) | +0.51 (n/d a +n/d) | 0.04 | +2.53 | POUCA AMOSTRA |
| BTCUSD LONG | 12 | 67% (39-86) | +0.05 (-0.26 a +0.36) | 0.10 | +4.20 | POUCA AMOSTRA |
| AUS200 SHORT | 1 | 100% (21-100) | +0.81 (n/d a +n/d) | 0.35 | +3.04 | POUCA AMOSTRA |
| BTCUSD SHORT | 13 | 46% (23-71) | +0.11 (-0.30 a +0.51) | 0.09 | +3.74 | POUCA AMOSTRA |

### Setup declarado pela IA

| balde | n | acerto (IC95) | E[R] líquido (IC95) | custo em R | P&L $ | etiqueta |
|---|---:|---|---|---:|---:|---|
| REVERSAO | 40 | 30% (18-45) | -0.35 (-0.59 a -0.10) | 0.14 | -32.65 | PERDE |
| ROMPIMENTO | 10 | 10% (2-40) | -0.83 (-1.15 a -0.51) | 0.10 | -32.28 | POUCA AMOSTRA |
| CRUZAMENTO_MEDIAS | 4 | 0% (0-49) | -1.65 (-2.73 a -0.58) | 0.13 | -18.56 | POUCA AMOSTRA |
| (sem setup) | 36 | 42% (27-58) | -0.10 (-0.37 a +0.17) | 0.09 | -3.86 | INCONCLUSIVO |
| CONTINUACAO | 2 | 0% (0-66) | -1.14 (-1.30 a -0.98) | 0.12 | -8.57 | POUCA AMOSTRA |
| OTRO | 1 | 0% (0-79) | -1.13 (n/d a +n/d) | 0.10 | -3.12 | POUCA AMOSTRA |
| OUTRO | 10 | 60% (31-83) | -0.05 (-0.55 a +0.45) | 0.09 | +1.69 | POUCA AMOSTRA |

### Hora de entrada (Brasília)

| balde | n | acerto (IC95) | E[R] líquido (IC95) | custo em R | P&L $ | etiqueta |
|---|---:|---|---|---:|---:|---|
| 17h | 6 | 17% (3-56) | -0.99 (-1.98 a +0.00) | 0.16 | -12.23 | POUCA AMOSTRA |
| 19h | 6 | 0% (0-39) | -0.86 (-1.18 a -0.54) | 0.13 | -11.86 | POUCA AMOSTRA |
| 01h | 6 | 33% (10-70) | -0.65 (-1.30 a +0.01) | 0.13 | -14.04 | POUCA AMOSTRA |
| 07h | 3 | 0% (0-56) | -1.05 (-1.45 a -0.64) | 0.17 | -11.32 | POUCA AMOSTRA |
| 18h | 7 | 43% (16-75) | -0.36 (-1.08 a +0.37) | 0.06 | -14.43 | POUCA AMOSTRA |
| 22h | 3 | 0% (0-56) | -0.80 (-1.29 a -0.30) | 0.07 | -8.16 | POUCA AMOSTRA |
| 06h | 4 | 25% (5-70) | -0.58 (-1.64 a +0.47) | 0.14 | -10.22 | POUCA AMOSTRA |
| 11h | 3 | 0% (0-56) | -0.77 (-1.43 a -0.11) | 0.08 | -9.27 | POUCA AMOSTRA |
| 23h | 3 | 33% (6-79) | -0.64 (-1.49 a +0.22) | 0.07 | -2.59 | POUCA AMOSTRA |
| 15h | 7 | 43% (16-75) | -0.27 (-0.90 a +0.37) | 0.08 | +2.37 | POUCA AMOSTRA |
| 08h | 1 | 0% (0-79) | -1.39 (n/d a +n/d) | 0.11 | -4.29 | POUCA AMOSTRA |
| 21h | 2 | 0% (0-66) | -0.68 (-1.66 a +0.31) | 0.08 | -3.08 | POUCA AMOSTRA |
| 12h | 7 | 43% (16-75) | -0.17 (-0.77 a +0.43) | 0.08 | -5.32 | POUCA AMOSTRA |
| 14h | 12 | 42% (19-68) | -0.10 (-0.41 a +0.21) | 0.11 | -0.12 | POUCA AMOSTRA |
| 13h | 7 | 29% (8-64) | -0.15 (-0.78 a +0.47) | 0.06 | +0.39 | POUCA AMOSTRA |
| 02h | 2 | 50% (9-91) | -0.51 (-1.63 a +0.60) | 0.06 | -2.81 | POUCA AMOSTRA |
| 03h | 3 | 33% (6-79) | -0.25 (-1.05 a +0.55) | 0.09 | -3.56 | POUCA AMOSTRA |
| 16h | 6 | 33% (10-70) | -0.07 (-1.03 a +0.89) | 0.19 | -1.49 | POUCA AMOSTRA |
| 10h | 4 | 50% (15-85) | -0.04 (-1.02 a +0.94) | 0.14 | +1.03 | POUCA AMOSTRA |
| 05h | 4 | 25% (5-70) | +0.01 (-0.93 a +0.95) | 0.06 | +2.81 | POUCA AMOSTRA |
| 09h | 1 | 100% (21-100) | +0.52 (n/d a +n/d) | 0.10 | +1.88 | POUCA AMOSTRA |
| 00h | 2 | 100% (34-100) | +0.45 (-0.24 a +1.15) | 0.20 | +3.47 | POUCA AMOSTRA |
| 04h | 2 | 50% (9-91) | +0.49 (-1.19 a +2.17) | 0.23 | +2.60 | POUCA AMOSTRA |
| 20h | 2 | 100% (34-100) | +0.56 (+0.33 a +0.80) | 0.23 | +2.90 | POUCA AMOSTRA |

### Sessão de mercado na entrada

| balde | n | acerto (IC95) | E[R] líquido (IC95) | custo em R | P&L $ | etiqueta |
|---|---:|---|---|---:|---:|---|
| NY | 53 | 34% (23-47) | -0.29 (-0.52 a -0.05) | 0.11 | -30.93 | PERDE |
| ASIA | 21 | 33% (17-55) | -0.50 (-0.79 a -0.20) | 0.10 | -30.77 | PERDE |
| ROLLOVER | 14 | 36% (16-61) | -0.38 (-0.82 a +0.06) | 0.11 | -17.11 | POUCA AMOSTRA |
| LONDRES | 15 | 27% (11-52) | -0.35 (-0.85 a +0.14) | 0.13 | -18.53 | POUCA AMOSTRA |

> A tabela abaixo descreve o RESULTADO (quem sai por stop perde, por definição): serve para ver o formato dos ganhos e perdas, não para achar causa. Nunca vira candidato a veto.

### Como saiu

| balde | n | acerto (IC95) | E[R] líquido (IC95) | custo em R | P&L $ | etiqueta |
|---|---:|---|---|---:|---:|---|
| SL | 78 | 19% (12-29) | -0.60 (-0.73 a -0.47) | 0.11 | -132.30 | PERDE |
| MANUAL | 4 | 25% (5-70) | -1.01 (-2.51 a +0.50) | 0.08 | -7.43 | POUCA AMOSTRA |
| AI_SIGNAL | 3 | 0% (0-56) | -0.75 (-0.87 a -0.62) | 0.20 | -6.23 | POUCA AMOSTRA |
| TP+SL | 3 | 100% (44-100) | +0.52 (+0.33 a +0.70) | 0.07 | +3.70 | POUCA AMOSTRA |
| SL+TP | 4 | 100% (51-100) | +0.45 (+0.26 a +0.64) | 0.19 | +4.94 | POUCA AMOSTRA |
| TP | 11 | 100% (74-100) | +1.21 (+1.11 a +1.31) | 0.11 | +39.97 | POUCA AMOSTRA |

### Lado vs tendência 1H do motor

| balde | n | acerto (IC95) | E[R] líquido (IC95) | custo em R | P&L $ | etiqueta |
|---|---:|---|---|---:|---:|---|
| a favor | 62 | 31% (21-43) | -0.44 (-0.67 a -0.21) | 0.11 | -78.03 | PERDE |
| lateral | 16 | 44% (23-67) | -0.29 (-0.63 a +0.05) | 0.13 | -9.41 | POUCA AMOSTRA |
| contra | 25 | 32% (17-52) | -0.18 (-0.48 a +0.13) | 0.12 | -9.90 | INCONCLUSIVO |

### Lado vs veredito 5m+1H

| balde | n | acerto (IC95) | E[R] líquido (IC95) | custo em R | P&L $ | etiqueta |
|---|---:|---|---|---:|---:|---|
| a favor | 54 | 35% (24-49) | -0.37 (-0.62 a -0.13) | 0.09 | -55.28 | PERDE |
| divergente | 24 | 29% (15-49) | -0.26 (-0.61 a +0.09) | 0.15 | -10.91 | INCONCLUSIVO |
| contra | 13 | 23% (8-50) | -0.47 (-0.79 a -0.16) | 0.13 | -15.24 | POUCA AMOSTRA |
| indefinido | 12 | 42% (19-68) | -0.32 (-0.74 a +0.11) | 0.14 | -15.92 | POUCA AMOSTRA |

### Lado vs estocástico 1H

| balde | n | acerto (IC95) | E[R] líquido (IC95) | custo em R | P&L $ | etiqueta |
|---|---:|---|---|---:|---:|---|
| NEUTRO | 55 | 33% (22-46) | -0.31 (-0.52 a -0.09) | 0.10 | -68.19 | PERDE |
| SOBREVENDIDO | 25 | 20% (9-39) | -0.52 (-0.80 a -0.25) | 0.13 | -23.81 | PERDE |
| SOBRECOMPRADO | 19 | 47% (27-68) | -0.11 (-0.52 a +0.29) | 0.14 | -1.53 | POUCA AMOSTRA |

## Ganho devolvido

Entradas que andaram >= 0,5R a favor e terminaram no zero ou no prejuízo: 10 de 103 (10%), somando -4.90 $.
Entradas que nunca andaram a favor (MFE < 0,2R) e perderam: 37 de 103 (36%).

## Candidatos a veto (etiqueta PERDE)

- setup: **REVERSAO** — n=40, E[R] -0.35 (IC95 -0.59 a -0.10), P&L -32.65 $

Regra do projeto: nada disso vira trava durante a janela congelada. Decidir no fim, e só o que se repetir em entradas que não geraram o candidato.
