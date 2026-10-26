# Planejador de alvo (matemático) + duração das pernas do estocástico — estudo offline
Declarado ANTES de rodar. Só leitura, não toca no motor. Sem custo (estuda probabilidade de atingir o alvo, não lucro).

## Parte A — o alvo dinâmico tem base?
- Amostras: a cada 12 candles de 5m, para os 2 lados. Entrada no fechamento. Stop S = 1,5×ATR14(5m). Alvos X ∈ {0,75; 1,5; 3}×ATR.
  Resolve em 36 candles; stop e alvo na mesma vela = stop; timeout excluído (fração reportada).
- Base (M0): ruína do jogador P0 = S/(S+X) (passeio aleatório sem deriva).
- M1: regressão logística com features de alvo: faixa do dia já consumida (range hoje / média 20 dias anteriores), espaço até a
  máxima/mínima do dia no sentido do trade (em ATR), ATR% (log) e hora (sen/cos).
- M2: M1 + estocástico 5,3,3 orientado ao lado (5m, 15m, 1H), inclinação do %K15, idade da perna no 15m.
- Treino: 1ª metade do tempo; teste: 2ª metade. Métrica: Brier no teste, ganho sobre M0 (IC por bootstrap em blocos semanais) e AUC.
- Critério de utilidade: M1 (e M2) com Brier menor que M0 e IC do ganho acima de zero, em BTC e ETH e sem inverter nos outros ativos.

## Parte B — duração das pernas do estocástico
- Perna de queda: começa quando %K cruza abaixo de %D com %K≥80; termina quando %K≤20 (chegou ao fundo) ou quando %K cruza de volta acima de %D
  (reverteu) ou 60 candles (censura). Perna de alta é simétrica. 5m e 15m.
- Reportar: % que chega ao fundo, quantis de duração, e P(chegar ao fundo nos próximos 4 candles | já durou t sem terminar), t=2,4,6,8.
- Pergunta do Cleber: a duração varia muito entre pernas, e o que está na vela (1H caindo junto, inclinação) separa as longas das curtas?

Sem promessa de edge: se M1/M2 não bater M0 fora da amostra, a ideia do alvo/duração dinâmicos não tem base.
