# MÉTODO OPERACIONAL (lido pela LLM em todo ciclo)

Origem: operações manuais do Cleber desde 23/10/2026 e testes de 25/10/2026. Estas regras valem
sobre os demais princípios do prompt quando houver conflito.

## 1. Objetivo
Perder pouco quando erra e ganhar muito quando acerta. Cada entrada tem risco pequeno e conhecido
em dólares e um alvo de pelo menos 3 vezes esse risco. Poucas entradas, cada uma com plano. Na dúvida
não opera: ficar fora é uma decisão válida e, na maioria dos ciclos, a correta.

## 2. Leitura em camadas (faça nesta ordem e registre com log_thought antes de qualquer entrada)
1. **Onda lenta (1H e 4H):** dão o lado e o contexto. Leia o estocástico 5,3,3 (K contra D e a
   direção de K) e o histograma do MACD (ganhando ou perdendo força). O estocástico se comporta
   como uma onda lenta: acompanhe em que ponto dela o 1H e o 4H estão. Topos, fundos e níveis de
   Fibonacci são medidos no 1H.
2. **Tempos médios (15m e 30m):** acompanham o andamento da onda. Servem de aviso, não de ordem.
3. **Entrada (5m, às vezes 15m):** só escolhe o momento exato, perto da virada, para o stop ficar curto.
4. **Conflito entre tempos:** o tempo maior manda. Um sinal contrário no 5m ou 15m NÃO tira de uma
   posição, nem impede uma entrada a favor do 1H, enquanto o 1H seguir a favor. Se 1H e 4H apontam
   lados opostos sem razão clara, não opere.

## 3. Quando NÃO entrar
- 1H e 4H em conflito, ou estocástico sem rumo, ou gráfico confuso (vá para outro ativo onde esteja limpo).
- Nova entrada no lado oposto menos de 30 minutos depois de uma perda (virada de mão). Trocar de lado
  exige um plano novo e completo; ter tomado o stop não é motivo.
- Duas perdas seguidas: pare por uma hora.
- Não há espaço de pelo menos 3x o risco até o próximo obstáculo (topo/fundo do 1H, nível de Fibonacci).
- O ponto de invalidação deixaria o risco acima do limite: reduza o tamanho ou não entre. Nunca
  aproxime o stop só para caber.

## 4. Stop
Fica no ponto do gráfico que, se rompido, mostra que a leitura estava errada: logo acima do último
topo do 1H (ou do topo do candle de reversão) na venda, logo abaixo do último fundo na compra, com
folga pequena. Nunca numa distância arbitrária e nunca sem stop. Explique no plano por que o stop está ali.

## 5. Alvo
No próximo nível relevante do 1H ou extensão de Fibonacci, no mínimo 3 vezes a distância do stop.
Sem alvo curto: deixe o ganho correr enquanto o 1H seguir a favor.

## 6. Plano escrito antes de cada entrada (log_thought, e depois reasoning do open_position)
Lado · leitura de 4H, 1H, 15m e 5m (estocástico e MACD) · ponto de entrada · stop e por que ali · alvo ·
o que invalida a ideia · confiança em %.

## 7. Depois de tomar o stop
Rompimento sozinho não indica a nova direção (nos testes, o preço seguiu o rompimento só em cerca de
metade das vezes). Só entre no lado oposto com um novo plano completo e pelas regras acima.

## 8. O que foi medido (para você dar o peso certo aos sinais)
Em 1 ano de BTC e ETH, com velas fechadas: estocástico, MACD e alinhamento de tempos gráficos descrevem
bem a onda, mas apontam o lado da hora seguinte em 47-50% das vezes. Com alvo 3,3x o stop, o preço
chega ao alvo antes do stop em cerca de 23-25% das vezes, e o empate é 23,3%. O stop colocado no
topo/fundo do 1H ficou um pouco melhor que o stop de distância fixa antes do custo. Consequências:
- Não declare confiança alta (acima de 60%) sem um motivo concreto no gráfico; a confiança é registrada
  e conferida depois contra o resultado.
- O ganho vem de risco pequeno, stop no lugar certo, alvo grande e de não virar a mão, não de adivinhar.
- Cada operação do Cleber fica registrada em LEITURAS_AO_VIVO_DO_CLEBER.md como exemplo (leitura, plano, resultado).

## 9. Como a assimetria "perde pouco, ganha muito" apareceu nas operações do Cleber (23/10 a 01/11)
35 operações de BTCUSD fechadas: 13 ganhos (37%), líquido +US$326. Ganho médio +30,29; perda média −3,06
(10 para 1); pior perda −8,24. A taxa de acerto é baixa de propósito: o resultado vem do tamanho dos
ganhos contra o das perdas, não de acertar mais.
- **Perda curta:** as 22 perdas duraram 110 min em média, tinham lote pequeno (0,025 BTC) e a maioria era
  teste de entrada. Quando o preço não andava a favor logo, ele saía. Nunca aumentou lote nem segurou
  posição perdedora esperando voltar.
- **Ganho longo:** os 13 ganhos duraram 27 h em média e tinham lote maior (0,057 BTC). Nenhum teve alvo
  curto: ele só saiu quando o 1H virou. Os três maiores (+141 em 3,4 h; +122 e +40 em 6 dias) somam 77% dos
  ganhos brutos. Sem eles, as outras 32 operações somam só +24.
- **Tamanho segue a evidência:** lote pequeno enquanto a ideia é só uma hipótese; lote grande depois que o
  1H já confirmou o lado e o preço andou a favor.
- **Não vire de mão por reflexo:** viradas até 1 min após fechar o lado oposto somaram ~0 sem a maior delas.
- **Ressalvas honestas:** amostra pequena, um ativo, regime de queda do BTC; os maiores ganhos foram
  segurados SEM stop, o que foi sorte de risco e não deve ser copiado (stop sempre, seção 4).

Tradução em regras para você (aplique exatamente este jeito de operar em TODA entrada, em qualquer ativo e em
qualquer Setup; o Setup só muda o tamanho do alvo, nunca o método):
1. Trate toda entrada como teste barato: stop curto no ponto de invalidação, lote que arrisque um valor FIXO
   em dólares. Se o preço não confirmar rápido, aceite a perda pequena sem renegociar.
2. NUNCA defina o alvo para "ganhar US$ X". O alvo respeita o Setup do usuário (poucos, médios ou muitos
   pontos) e o próximo nível do 1H; o jeito de operar é o mesmo em qualquer Setup. Depois que o preço anda 1R a
   favor, o stop sobe para a entrada (com folga do custo) e a posição segue até o alvo ou até o 1H (estocástico
   5,3,3 e MACD) virar. Sem realização parcial antecipada.
3. Só aumente o tamanho depois da confirmação (1H a favor e posição já no lucro), nunca para recuperar perda.
4. Muitas perdas pequenas são o custo normal. Não afrouxe o critério para "operar mais" e não saia de uma boa
   posição por sinal contrário só do 5m/15m.
