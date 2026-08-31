# Hipótese: teto de TP fixo impede o motor de "deixar correr" um trade vencedor

## Contexto

Sessão de 2026-08-26. Cleber operou manualmente por ~1h em BTCUSD (3 trades,
sem stop, fechamento 100% discricionário) e teve resultado líquido de
+$35,54 — bem acima do motor automatizado no mesmo dia. Ao investigar, dois
achados relevantes:

1. O motor **avalia** a cesta inteira (15 símbolos/dia, incluindo
   índices/commodities) — não ignora nada por preguiça, mas 4-5 gates
   (`COST_GATE`, `CONTEXT_SCORE_LATERAL`, `CONTEXT_CONFIDENCE`,
   `MACD_MOMENTUM_FADING`) rejeitam >99% de tudo, e cripto (mais volátil
   percentualmente) limpa esses gates com mais frequência que os outros
   ativos — não é um "esquecimento" do S&P/índices.
2. **Achado de código, não de comportamento observado**: em
   `supabase/functions/ai-runner/lib/positionManager.ts` (`tickPositionManager`,
   linha ~161), mesmo com `stopLossMode = 'DINAMICO'` ativo (confirmado na
   sessão `RUNNING` de produção: ATR período 14, multiplicador 2), o
   `take_profit` **nunca é atualizado** — só o `effectiveSl` recebe
   breakeven (+1,5R) e trailing ATR. O fechamento por TP (`hitTP`) sempre
   compara contra `pos.tp` original, fixado na abertura do trade. Ou seja:
   **o motor pode proteger lucro cada vez melhor conforme o preço anda a
   favor, mas nunca pode capturar mais do que o alvo original definido na
   entrada** — mesmo que o momentum continue forte depois de bater o TP.

Isso é exatamente o padrão que aconteceu no 3º trade manual do Cleber
(BTCUSD LONG 78.454,16 → 78.776,51, +$29,95): ele viu o movimento continuar
e não vendeu num alvo fixo — vendeu quando achou que tinha acabado. O motor,
no mesmo cenário, teria fechado no TP original (1:3 do risco) e não
capturado o resto do movimento.

## Hipótese testável

Se o `take_profit` fosse tratado como **alvo mínimo, não teto** — ou seja,
ao bater o TP original o motor não fecha, só passa a usar
breakeven+trailing ATR pra proteger o lucro acumulado e deixa a posição
correr até a reversão de fato bater o stop — o resultado líquido dos trades
reais fechados via TP/SL nos últimos ~9 dias teria sido melhor?

## Metodologia (sem look-ahead, sem dado fabricado)

1. Universo: todos os 166 trades reais fechados via `SL`/`TP` em
   BTCUSD/ETHUSD/SOLUSD dos últimos 45 dias com `stop_loss > 0` — exclui
   explicitamente os lotes de teste antigos já identificados (`stop_loss=0`,
   `exit_reason=MANUAL`) que contaminam o histórico. Dado bruto em
   `data/real_trades.json` (extraído direto do Supabase de produção).
2. Preço real: candles de 15 minutos da Binance (mesmo timeframe configurado
   na sessão de produção, `config.timeframe = '15m'`) para
   BTCUSDT/ETHUSDT/SOLUSDT, cobrindo todo o período com folga (aquecimento
   do ATR-14 antes do primeiro trade, ~24h depois do último pra cobrir
   holds longos).
3. **Réplica de validação** (variante A): reimplementa exatamente a lógica
   de `tickPositionManager` (breakeven +1,5R, trailing ATR período 14
   multiplicador 2, fecha em TP OU SL) sobre o candle real, andando candle a
   candle a partir da entrada. Resultado tem que bater aproximadamente com o
   que está gravado em produção — se não bater, o método de réplica está
   errado e o teste da variante B não vale nada.
4. **Variante B (hipótese)**: mesma lógica, mas o toque no TP original não
   fecha a posição — só a reversão que acionar o trailing/breakeven fecha.
   Corte de segurança: fecha de qualquer forma depois de N horas (evitar
   posição "imortal" em dado sintético/gap).
5. Comparar PnL líquido agregado real vs. variante A (sanity check) vs.
   variante B (hipótese), custo de execução já embutido nos números
   gravados/replicados.

## Critério de sucesso

Só é edge de verdade se a variante B superar o resultado real por uma
margem que não seja explicável por 1-2 trades outliers isolados — reportar
também o resultado excluindo o maior outlier de cada lado, e o número de
trades onde B fecha pior que o real (o risco simétrico: deixar correr
também pode devolver lucro que o TP fixo já tinha garantido).

## Escopo desta primeira rodada

Só cripto (Binance, sem risco de rate-limit da conta MetaAPI compartilhada).
Forex/índices/commodities ficam pra uma rodada seguinte com a Edge Function
`mt5-candles-history`, chamadas seriais.
