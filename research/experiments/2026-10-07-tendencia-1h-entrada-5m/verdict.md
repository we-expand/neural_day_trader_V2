# Diagnóstico de 07/10: lado, saída e a regra "1H dá a direção, 5m dá a entrada"

Pedido do Cleber: a config deveria ser a de 22/09, a IA "erra o lado", meta de 70% de acerto,
e a regra dele: olhar a 1H para saber para onde o mercado corre, entrar no 5m para esse lado.

Fontes: `ai_trades` (Supabase, só entradas da IA, `is_test_data=true`, parciais consolidadas por
`session_id+symbol+side+entry_time`) e klines públicos da Binance. Scripts nesta pasta.

## 1. Config de hoje x 22/09
Não é a mesma: modelo (Ollama Qwen3.5 4B → Nemotron 120B, 27/09), breakeven 0,5R → 0,35R (27/09),
veredito de direção (unanimidade de 5 sinais → 5m+1H), REVERSAO afrouxada (23/09), vigia mecânico (23/09),
veto de exaustão, custo por spread real, cesta.
22/09 teve **5 entradas, 3 ganhos, +$1,70**. Os 71% reportados contavam a parcial de lucro como trade.

## 2. Entradas reais desde 22/09 (n=103)
33% de acerto, -$97,34 líquido (-$61 bruto, -$36 custo). Ganho médio realizado 0,59R (planejado 1,45R).
Custo médio 0,24R por trade. XETUSD: 27 entradas, 18,5%, -$62 (64% do prejuízo). BTCUSD: 25, 56%, +$7,94.
REVERSAO: 40 entradas, 30% (critério pré-registrado em 23/09: <45% em 10 → reverter).
A favor da 1H do motor: 62 entradas, 30,6%. Contra: 25, 32,0%.

## 3. Lado (`02-lado-entradas-reais.mjs`, 67 entradas em cripto)
Preço a favor 30 min depois: 67%. Alvo antes do stop simétrico (1× o stop do próprio trade, 4h): 60% (32/53).
Era Nemotron 74% (28/38); era Ollama 23-27/09 18% (2/11). BTC 74%; XETUSD 35%. Acerto real das mesmas entradas: 33%.
O rótulo "tendência 1H" do motor (variação de 24 velas, faixa 0,15%) disse o oposto das últimas 6h do gráfico
em 19/67 e o oposto de EMA9/EMA20 em 12/67; as três leituras só coincidem em 19/67.

## 4. Saída (`03-saida-contrafactual.mjs`, mesmas 67 entradas, custo descontado)
| Regra | Acerto | E[R] |
|---|---|---|
| Real | 33% | -0,31 |
| Stop 1R / alvo 1,5R, sem breakeven | 45% | -0,07 |
| + breakeven 0,35R (atual) | 15% | -0,20 |
| + breakeven 0,5R (22/09) | 31% | -0,03 |
| + breakeven 1,0R | 45% | -0,01 |

17 de 67 entradas saíram no zero/negativo depois de andar ≥0,35R a favor. Só era Nemotron (n=50): sem breakeven
+0,22R (t=1,45), **não significativo**.

## 5. A regra, 2 anos de BTC e ETH (`01-tendencia-1h-gatilho-5m.mjs`, 5 a 15 mil trades por variante)
Três definições de 1H (EMA9/20, últimas 6h, a do motor) × três gatilhos de 5m (pullback do estocástico, qualquer
cruzamento, preço e estocástico caminhando juntos). Acerto com alvo 1:1: 47-50% a favor da 1H, 47-49% contra,
47-50% sem filtro. E[R] bruto ≈ 0 em todas; líquido -0,25 a -0,38R (o custo). Igual em 2024, 2025 e 2026.

## Conclusão
- Ler para onde o mercado está correndo é descrição, e o rótulo que a IA recebe hoje descreve mal. Vale consertar.
- Seguir essa leitura não prevê o próximo movimento: 50% em dois anos, com ou sem o filtro.
- O prejuízo medido vem de três coisas mecânicas: breakeven em 0,35R, XETUSD e custo de 0,24R por trade com stop de 5m.
- Nada aqui é edge. O melhor número (+0,22R) tem n=50, t=1,45 e foi escolhido entre vários cortes.

## Limites
103 entradas e ~10 cortes (múltiplos testes, sem correção). Teste de lado só em cripto. Contrafactual usa preço
da Binance, não o da corretora. O teste de 2 anos mede a regra mecânica, não o olho do Cleber.
