# Fila de pedidos do LLM Brain

Regra (llm-council de 2026-10-07): durante a janela congelada do pacote de 07/10 (100 entradas contadas pelo marcador
`reversalRule = padrao-candle-confirmado-v2`) NADA daqui entra no motor. Pedido novo vira linha aqui; só se decide
no fim da janela, e só o que passar num teste fora da amostra que o gerou. Pesquisa offline (sem tocar o motor) é permitida.

## Aberta

| Data | Pedido (palavras do Cleber, resumidas) | Já medido? | Próximo passo | Status |
|---|---|---|---|---|
| 07/10 | Estocástico emaranhado / sem rumo claro = ficar de fora, "via de regra" | Não. O marcador já tem "Fora (na dúvida)" para ele registrar quando isso acontece | Definir "emaranhado" por número (ex.: cruzamentos %K/%D nas últimas N velas, %K preso entre 40-60) e medir se a entrada nesses momentos rende menos | pesquisa offline |
| 07/10 | Poucas entradas por dia, mas "para matar": seletividade alta | Parcial: 103 entradas em ~15 dias, 33% de acerto, -0,35R; o conselho pediu menos cadência | Medir E[R] por faixa de confiança/confluência nas entradas do pacote (relatório diário já mostra por setup) | acompanhar no relatório |
| 07/10 | Sem "ativo de estimação": se um ativo está confuso, ir para outro onde estocástico e MACD fluem limpos | Não. XETUSD mostrou o problema oposto: insistir no mesmo ativo perdeu nos dois lados (27 entradas, -$62) | "Pontuação de fluidez" por ativo (estocástico limpo + MACD alinhado) e ranking antes de entrar; testar em histórico se operar só o melhor ativo da cesta melhora E[R] | pesquisa offline |
| 07/10 | Inverter na sequência: estocástico chega embaixo e cruza para cima -> comprar; "pegar na ida e na volta" quando o gráfico está "bonitinho" | Parcial e desfavorável sem filtro: cruzamento em zona extrema no 5m deu 36% e -0,36R (BTC/ETH, 2-3 anos, 23/09); "stop-and-reverse" já rejeitado antes. NÃO foi testado condicionado a gráfico limpo | Testar o cruzamento extremo SÓ quando a "fluidez" for alta (mesma pontuação do item acima). Se não melhorar, descartar | pesquisa offline |
| 07/10 | A IA deve usar padrões de candle (martelo, torre gêmea) como o Cleber usa | Hoje a IA só recebe padrão de candle e MACD no timeframe operacional (5m), não no 1H | Comparar a detecção do motor com as marcações dele (padrões marcados no marcador) antes de qualquer mudança | depende do marcador |
| 07/10 | A IA deveria aprender com o histórico de trades e saber onde erra | Parcial: relatório diário de erros (20h) já existe, somente leitura | No fim da janela, decidir quais candidatos a veto do relatório repetem em dados novos | acompanhar |

## Decididas / descartadas

| Data | Pedido | Decisão |
|---|---|---|
| 07/10 | Nova leitura de 1H por médias | Reprovada na validação cega com o Cleber (4/12; depois 3/12 e 6/12 nas variantes). Não entra |
| 07/10 | Confirmar em 1H, 2H e 4H antes de entrar no 5m; contexto do dia ("mercado cansado") | Medido (12-alinhamento-1h-2h-4h.mjs, 2 anos, 6 ativos, ~70 mil gatilhos): acerto 37-40% e -0,34R a -0,39R em todas as faixas, sem melhora com mais prazos nem com o dia contra. Descartada como regra mecânica: NÃO vira trava no motor; segue só como registro no diário e nas revisões |
