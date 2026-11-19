# Leituras ao vivo do Cleber

Cada leitura fica registrada com hora, os números reais medidos no mesmo minuto
(`node scripts/mtf-snapshot.mjs BTCUSD`, estocástico 5,3,3 em velas fechadas) e,
depois, o que o mercado fez. Serve para comparar a leitura com o resultado sem
depender de memória, e como exemplo para a LLM.

---

## L1 — 25/10/2026 15:42 BRT — CANCELADA

Cancelada pelo Cleber logo depois de passar ("cometi um erro"). Não conta na medição
nem serve de exemplo para a LLM.

---

## L2 — 25/10/2026 15:46 BRT (18:46Z) — BTCUSD

**Regra dele (corrigida):** o 1H e o 4H dão a tendência e são eles que se seguem. Fibonacci,
topos e fundos são desenhados no 1H. O 5m só coloca na operação, para entrar já "perdendo
pouquinho" (stop curto, perto da virada).

**Leitura dele agora:** 1H e 4H dando queda. Lado = venda.

**Medido (velas reais da Binance BTCUSDT, só velas fechadas, no instante da venda 18:44Z):**

| TF | Estocástico 5,3,3 | Aponta queda? |
|----|-------------------|---------------|
| 4H | K 69, caindo (K<D) | Sim |
| 1H | K 80, caindo (K<D) | Sim |
| 15m | K 23, caindo | Sim |
| 5m | K 11, no fundo, sem rumo | Repique possível |

> Correção: a primeira versão desta tabela usava as velas arquivadas no banco (`ohlcv_data`),
> que estão erradas (cada vela é gravada ainda em formação e nunca é atualizada,
> `neuralBridge.ts:1643`, `ignoreDuplicates`). Com velas reais, a leitura dele de 1H e 4H em
> queda bate.

**Complemento dele (~15:50 BRT):** no gráfico dele, o estocástico do 1H já cruzou para baixo e o
MACD do 1H vem enfraquecendo → "é hora de participar" (venda). Pelos números acima, a vela de 1H
fechada ainda mostrava K>D; o cruzamento que ele vê é o da vela em formação.

**Previsão a conferir:** queda nas próximas horas a partir de 80.667. Registrar preço, stop e alvo da venda dele.

**Confiança declarada:** 80%. Entrando "mais pesado": lote 0,02.

**Execução (banco):** às 18:44:30Z fechou as 2 compras de 24/10 a 80.660 (−3,49 e −3,55 = −7,04)
e às 18:44:37Z abriu VENDA 0,02 a 80.665,37. Stop e alvo foram colocados logo depois: **stop 81.169,48 (+504 pontos, risco ≈ US$10)** e
**alvo 79.020 (−1.645 pontos, ganho ≈ US$33)**. R:R ≈ 3,3. Lógica do stop (dele): acima do topo do
martelo invertido; se romper, o mercado vira comprador e ele troca de lado, sem perder um
"caminhão" para ter certeza.

**Resultado:** _(preencher: preço em 19:46Z e 22:46Z; máxima e mínima no intervalo)_

**Atualização 16:07 BRT (19:07Z), mesma venda — leitura dele:** 15m com estocástico quase cruzando
para cima lá embaixo, mas MACD do 15m "batendo venda" — "o MACD segura nessas horas", aposta que o
MACD prevalece. 30m: estocástico terminando a exaustão de queda, MACD já em queda. 1H em venda.
2H chegando no alto para virar vendedor. 4H para venda. Conclusão dele: próxima 1h e próximas 4h =
venda; acompanha pelo 15m.

**Medido (Binance, vela fechada):** 15m K 4/D 10, MACD hist −5 e mais vendedor · 30m K 42/D 55
caindo, MACD hist +34 · 1H K 76/D 81 caindo · 2H K 64/D 52 subindo, MACD perdendo força ·
4H K 69/D 78 caindo. Preço 80.546 (venda +119 pontos a favor).

**Teste da regra "no 15m, estocástico no fundo virando + MACD em venda forte → o MACD prevalece"**
(1 ano, velas fechadas): BTC caiu na 1h seguinte em 46,8% dos casos (n=1.239) e em 2h em 45,8%;
ETH 44,4% e 43,8%. Sem o MACD vendedor: 45-49%. O MACD vendedor não fez a queda continuar mais
vezes; o repique pelo estocástico foi um pouco mais comum.

**Atualização 16:20 BRT (19:20Z), mesma venda — decisão de MANTER:** o 15m cruzou o estocástico para
cima lá embaixo, mas ele mantém a venda. Quem manda manter é o 1H: as duas linhas do estocástico
viradas para baixo e o MACD do 1H caindo com o tempo. "A minha certeza de que o mercado vai ser de
queda na próxima 1 hora está aqui."
Regra de gestão que sai disso: **sinal contrário no tempo menor (15m) não tira da operação enquanto o
tempo maior (1H) seguir a favor.**

**Medido (Binance, vela fechada):** 15m K 11 > D 7, subindo (cruzou para cima), MACD hist −12,5 ·
1H K 76 < D 81, caindo, MACD hist +38,9 e caindo (ainda acima do sinal). Preço 80.620,8
(venda +45 pontos a favor).

**Previsão a conferir:** preço abaixo de 80.620 às 20:20Z (17:20 BRT).
