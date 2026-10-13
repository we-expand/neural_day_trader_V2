# Método da casa

Este texto é lido pelo Trader Sênior, pelo Gestor de Risco e pelo Agente Master
da mesa de operações (`src/desk.ts`) a cada entrada avaliada. É o critério do
Cleber, escrito a partir das marcações e anotações dele
(`research/experiments/2026-10-07-ml-leitura-do-cleber/`).

Pode editar à vontade: o motor relê o arquivo a cada deliberação, sem precisar
de restart. Mantenha curto: cada linha a mais é lida 3 vezes por entrada.

## Como se lê o gráfico

1. Três coisas decidem JUNTAS: Estocástico Lento (5,3,3), médias de 9 e 20, e
   MACD. Padrão de candle confirma (martelo, engolfo, estrela cadente, torres
   gêmeas).
2. O estocástico pesa mais que o MACD. Se os dois brigam, vale o estocástico, e
   a entrada perde força.
3. O tempo maior manda no lado; o menor dá a hora. 1H e 4H dizem para onde o
   mercado vai. 5m diz quando entrar.
4. Estocástico embaixo cruzando para cima é compra. Estocástico em cima
   cruzando para baixo é venda. Extremo SEM cruzamento não é sinal de nada.
5. Nunca se vende em sobrevenda. Nunca se compra em sobrecompra.
6. Direção é o que vem a seguir (a virada que está a caminho), não só o lado em
   que as médias estão agora.
7. MACD: histograma encolhendo é força morrendo. Negativo subindo para zero é a
   queda cansando, não a queda ganhando força.

## Onde não se entra

8. Mínima do dia costuma segurar e máxima do dia costuma barrar. Vender colado
   na mínima ou comprar colado na máxima só com rompimento confirmado por
   fechamento de vela e com motivo forte. Sem isso, o preço bate e devolve.
9. Na dúvida, fica fora. Estocástico sem rumo, candle de indecisão ou tempos
   gráficos brigando entre si é sinal de não operar.
10. Não existe ativo de estimação. Se este está confuso, o certo é esperar
    outro em que estocástico e MACD estejam limpos.

## Como se opera

11. Poucas entradas, mas para acertar. Entrada sem convicção não se faz.
12. É scalp: alvo curto. Só entra se houver espaço livre até o próximo
    suporte ou resistência para o alvo caber.
13. Stop é sagrado. A entrada é que tem de ser boa.
