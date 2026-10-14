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
   cruzando para baixo é venda. Esse é o melhor gatilho, mas NÃO o único.
5. O estocástico tem ESTADO: %K acima de %D = modo de compra; %K abaixo de %D =
   modo de venda. Vender com o estocástico em modo de compra (ou comprar em modo
   de venda) só depois de um NOVO cruzamento a favor do lado. Vale em todos os
   tempos gráficos (5m, 15m, 1H), sem exceção, e nenhum outro gatilho (C, D, E)
   substitui isso. Além disso: nunca se vende em sobrevenda, nunca se compra em
   sobrecompra.
6. Direção é o que vem a seguir (a virada que está a caminho), não só o lado em
   que as médias estão agora.
7. MACD: histograma encolhendo é força morrendo. Negativo subindo para zero é a
   queda cansando, não a queda ganhando força.

## Gatilhos válidos (basta UM, com o resto não contra)

- A. Estocástico cruzando dentro do extremo a favor do lado (o melhor).
- B. Estocástico cruzando na zona neutra a favor do lado, com o MACD do mesmo lado.
- C. MACD cruzando ou virando a favor, com o preço do lado certo das médias de 9 e 20.
- D. Retomada: o preço volta a tocar a média de 9 ou 20 na direção do tempo maior
  (entrada no recuo, não no topo) e o estocástico volta a apontar a favor.
- E. Padrão de candle a favor (engolfo, martelo, estrela cadente, torres gêmeas)
  num nível que importa (suporte, resistência, média).
- Tendência forte esticada (estocástico colado em sobrecompra por muito tempo):
  NÃO se compra o topo; espera-se o recuo e o gatilho D.

## Onde não se entra

8. Mínima do dia costuma segurar e máxima do dia costuma barrar. Vender colado
   na mínima ou comprar colado na máxima só com rompimento confirmado por
   fechamento de vela e com motivo forte. Sem isso, o preço bate e devolve.
9. Dúvida grande, indecisão (candle de indecisão, tempos brigando sem lado
   claro) é sinal de não operar. Dúvida pequena, com um gatilho válido e um tempo
   gráfico discordando, é entrada com metade do tamanho. Nenhuma entrada real tem
   todos os indicadores alinhados: exigir isso é ficar fora o dia todo.
10. Não existe ativo de estimação. Se este está confuso, o certo é esperar
    outro em que estocástico e MACD estejam limpos.

## Como se opera

11. Poucas entradas, mas para acertar. Entrada sem convicção não se faz.
12. É scalp: o alvo é CURTO, e o alvo curto é o que justifica a entrada. Só entra
    se houver espaço livre até o próximo suporte ou resistência para o alvo caber.
13. Stop é sagrado. A entrada é que tem de ser boa.
