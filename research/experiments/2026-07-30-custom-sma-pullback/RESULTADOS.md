# Teste ad-hoc: Cruzamento SMA40/SMA100 + pullback — BTCUSDT

> Testes pedidos pelo Cleber em 2026-07-30, fora da linha 11.5-11.15 do
> `AI_BRAIN_SPEC.md` e fora da Fase 2 do `MASTER_PLAN.md` — estratégia nova,
> nunca testada antes neste projeto. Dado real via Binance spot público
> (klines), sem depender da conta MetaAPI compartilhada (que estava sob
> rate-limit sustentado nesta sessão — ver handoff do MASTER_PLAN.md).

## Regra de entrada (mesma em todos os testes)

1. **Cruzamento**: SMA40 cruza acima da SMA100 (viés de ALTA) ou abaixo
   (viés de BAIXA) — ambos os lados habilitados (LONG e SHORT).
2. **Pullback**: depois do cruzamento, espera pelo menos 1 candle CONTRA a
   direção da cruza (candle vermelho após cruza de alta, ou verde após
   cruza de baixa).
3. **Entrada**: no primeiro candle SEGUINTE que fechar A FAVOR da direção
   da cruza. Entra no close desse candle.

Um novo cruzamento oposto antes do pullback resolver reseta o estado (não
empilha sinal de cruzamento velho). Sem filtro adicional (sem ADX, sem
volume) — teste direto da regra como descrita, não uma versão "melhorada".

Zero grid search, zero ajuste de parâmetro em qualquer teste — períodos de
SMA (40/100) e regra de pullback vieram literalmente do pedido do Cleber.

Scripts-fonte (reprodutíveis):
- `backtest-sma-crossover-pullback.ts` — 1min, stop/alvo por ATR
- `backtest-sma-crossover-pullback-mtf.ts` — 15m e 1h, stop/alvo por ATR
- `backtest-sma-crossover-pullback-fixedpoints.ts` — 1min, stop/alvo fixos em pontos (parametrizável)

---

## Teste 1 — 1min, stop/alvo por ATR (SL 1,5×ATR14, TP 3×ATR14, R:R 1:2 real)

6 meses (2026-01-31 a 2026-07-30), 259.200 candles, holdout n=872 (split
cronológico com embargo, 3 janelas 70/30).

| | LONG | SHORT | Pooled |
|---|---|---|---|
| n trades | 437 | 435 | 872 |
| Win rate (líquido de custo) | 2,1% | 2,8% | 2,4% |
| Sharpe | -2,609 | -2,582 | -2,597 |
| Retorno agregado (%) | -110,5% | -109,7% | -220,2% |
| DSR | — | — | 0,0% ❌ |

- Skew MFE/MAE: razão mediana MFE/MAE = 0,876 (sem assimetria de payoff a favor).
- **Achado central**: o sinal de entrada em si não é ruim — taxa de acerto
  BRUTA (antes de custo) de **40,5%**, retorno médio bruto por trade de
  **+0,0074%**, essencially empate técnico pré-custo. O problema é
  puramente custo de transação: no timeframe de 1min o alvo por ATR fica
  minúsculo (BTC se move pouco em % por candle de 1min), e o custo
  round-trip real de BTCUSDT (~0,26%) é maior que o alvo do trade inteiro.
  Mesma causa raiz já documentada pro preset "Scalp" (pior arquétipo do
  projeto).

Output bruto: `output.json`.

---

## Teste 2 — 15min e 1h, stop/alvo por ATR (mesma regra, variação de timeframe)

Mesmos 6 meses de calendário, contrato fixo 0,01 BTC introduzido a partir
daqui (resultado em dólar).

| | 15m | 1h |
|---|---|---|
| n trades (holdout) | 59 | 15 |
| Win rate | 25,4% | 26,7% |
| Resultado líquido total | -US$120,91 | -US$37,37 |
| Ganho médio (vencedor) | +US$2,68 | +US$7,60 |
| Perda média (perdedor) | -US$3,66 | -US$6,16 |
| Melhor trade | +US$4,79 | +US$11,58 |
| Pior trade | -US$6,49 | -US$10,52 |
| Máximo drawdown | -US$124,50 | -US$42,07 |
| Sharpe | -0,672 | -0,402 |
| DSR | 0,0% ❌ | 7,4% ❌ (n=15, poder estatístico irrisório) |

- Melhora o problema de custo (win rate sobe de 2% pra ~26%), mas ainda
  negativo nos dois casos — a perda média por trade perdedor continua maior
  que o ganho médio do vencedor (R:R efetivo pior que 1:1, mesmo o desenho
  pedindo 1:2 nominal — trailing aperta o alvo antes do TP fixo com mais
  frequência que idealizado).
- `n` pequeno demais pra conclusão forte, principalmente 1h (15 trades) —
  DSR 7,4% não é evidência de nada.

Output bruto: `output-mtf.json`.

---

## Teste 3 — 1min, stop fixo 100 pontos / alvo fixo 400 pontos (contrato 0,01 BTC)

> Nota de rigor: 400/100 = razão 4:1, não "1:2" como mencionado no pedido —
> segui os números literais fornecidos, não o rótulo verbal.

Mesmos 6 meses, 259.200 candles, holdout n=789.

| | LONG | SHORT | Pooled |
|---|---|---|---|
| n trades | 396 | 393 | 789 |
| Win rate | 9,6% | 10,7% | 10,1% |
| Resultado líquido | -US$689,87 | -US$676,18 | **-US$1.366,05** |

- Ganho médio (vencedor): +US$1,23 | Perda média (perdedor): -US$2,07
- Melhor trade: +US$2,36 | Pior trade: -US$3,12
- Máximo drawdown: -US$1.366,05 (nunca recuperou até o fim do período)
- Sharpe: -1,374 | DSR: 0,0% ❌
- **Leitura**: alvo de $400 é grande demais pra ser alcançado com frequência
  no timeframe de 1min — o preço quase sempre bate o stop de $100 antes de
  percorrer $400 na direção certa (win rate de só 10%, precisaria de ~8x de
  payoff assimétrico pra empatar, tem só ~0,6x).

Output bruto: `output-fixedpoints.json` (sobrescrito pelo Teste 4 — rodar de
novo com `STOP_POINTS=100`/`TARGET_POINTS=400` reproduz este teste).

---

## Teste 4 — 1min, stop fixo 30 pontos / alvo fixo 200 pontos (contrato 0,01 BTC)

> Mesma nota de rigor: 200/30 = razão 6,7:1, não "1:2".

Mesmos 6 meses, 259.200 candles, holdout n=874.

| | LONG | SHORT | Pooled |
|---|---|---|---|
| n trades | 439 | 435 | 874 |
| Win rate | 3,9% | 3,7% | 3,8% |
| Resultado líquido | -US$755,10 | -US$758,65 | **-US$1.513,75** |

- Ganho médio (vencedor): +US$0,22 | Perda média (perdedor): -US$1,81
- Melhor trade: +US$0,38 | Pior trade: -US$2,42
- Máximo drawdown: -US$1.513,75 (pior que o Teste 3)
- Sharpe: -3,050 | DSR: 0,0% ❌
- **Leitura**: piorou em relação ao Teste 3. Stop de 30 pontos (~US$21 reais
  de distância em BTC ~US$70k, ~0,04% do preço) é curto demais pro ruído
  normal de 1 candle de 1min — o trade sai por stop antes do movimento real
  (a favor ou contra) se manifestar. Win rate caiu de 10,1% pra 3,8%.

Output bruto: `output-fixedpoints.json`.

---

## Síntese honesta (todos os testes)

- **A regra de entrada em si (cruzamento + pullback) tem uma taxa de acerto
  bruta razoável (~40% pré-custo)** — não está quebrada.
- **Todo teste no timeframe de 1min falhou**, e por motivos DIFERENTES
  dependendo do desenho de saída:
  - ATR-based: alvo minúsculo, devorado pelo custo de transação.
  - Stop fixo largo (100) + alvo muito largo (400): alvo raramente
    alcançado no timeframe.
  - Stop fixo curto (30) + alvo largo (200): stop atingido por ruído antes
    do movimento se desenvolver.
- **15m/1h por ATR** teve o melhor resultado relativo (ainda negativo, mas
  ordens de grandeza menor de prejuízo) — sugere que o timeframe de 1min é
  estruturalmente desfavorável pra esta regra com BTCUSDT, independente de
  como o stop/alvo é desenhado.
- **Nenhum teste aqui passa a disciplina de evidência da Fase 2** (7
  instrumentos pooled, DSR≥95%) — são todos single-instrument, single-run,
  ad-hoc. Amostra pequena em alguns casos (1h, n=15) tem poder estatístico
  muito baixo. Nenhum resultado aqui deve ser tratado como prova de que a
  regra "não funciona" de forma definitiva — só que, nas configurações
  testadas até agora, ela perde dinheiro.
