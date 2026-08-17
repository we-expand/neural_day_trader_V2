# Pesos não-uniformes por bloco + validação treino/teste — item 2 do redesenho (continuação)

Piso de score fixo em 60. Split cronológico 60% treino / 40% teste por símbolo×tf. Peso escolhido só com TREINO (grade [0.9/0.1..0.1/0.9] entre os 2 blocos de entrada), aplicado congelado em TESTE (dado nunca visto na escolha).

| Preset | Peso escolhido (treino) | Líq% médio treino | Combos comparáveis (teste) | Líq% médio teste (peso escolhido) | Líq% médio teste (pesos iguais) | Líq% médio teste (gate binário) | Vitórias vs. uniforme | Vitórias vs. gate |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Cruzamento de Médias com Filtro de Regime | 0.7/0.3 | 0.17% | 16 | -1.48% | -1.30% | -0.65% | 4/16 | 3/16 |
| Reversão à Média (RSI + Bollinger) | 0.3/0.7 | -1.23% | 12 | -0.71% | -0.64% | -0.25% | 2/12 | 6/12 |
| Rompimento Confirmado (Volume) | 0.9/0.1 | -5.50% | 16 | -8.42% | -9.90% | -7.18% | 11/16 | 7/16 |
| Momentum de Curto Prazo (Scalp) | 0.7/0.3 | -11.60% | 16 | -8.99% | -9.16% | -2.24% | 10/16 | 7/16 |
