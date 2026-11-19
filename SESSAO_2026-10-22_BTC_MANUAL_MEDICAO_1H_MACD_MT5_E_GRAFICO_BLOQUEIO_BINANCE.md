# Sessão 2026-10-22 (noite) → 2026-10-23 — BTC manual do Cleber, medição pela 1H, MACD igual ao MT5 e gráfico sem Binance

## Contexto
O Cleber comprou BTCUSD à mão (LONG 81.446,01 às 21:14:44Z = 18:14 BRT; stop 80.933, alvo 82.800) apostando em reversão:
dia −3,8%, estocásticos de período longo em condição de compra. Perguntou por que a LLM "nem viu" ou não executou.

## 1. Por que a LLM não entrou (diagnóstico, nada a corrigir ali)
- A LLM VIU: o vigia disparou `BTCUSD MACD_CRUZOU_PARA_CIMA @ 81.440` no mesmo instante; o ciclo listou a posição manual e recusou
  abrir outra ("já tem LONG; confluência favorece SHORT").
- Regras que apontavam para vender na hora: lado pela 1H (MACD 1H BAIXA → "operar só VENDA ou REVERSÃO confirmada"); estocástico 5m
  em 98,5 ("nunca abrir compra por causa disto"); dia −3,77% votou BAIXA. REVERSÃO exige padrão de candle + candle seguinte
  (`candlePatterns` estava vazio).
- Hoje o motor tentou SHORT em BTC várias vezes e foi barrado pela pausa de 60 min após 3 perdas seguidas. Essa trava conta só
  `is_test_data=true` (motor), não as manuais.
- Tese contra os números (Binance BTCUSDT, 22/10 21:23Z): estocástico 4H sobrevendido (K 18,8 / D 11,5 em 5,3,3; 13,3/14,0 em
  14,3,3); diário NÃO em extremo (K 58–62); semanal 14,3,3 sobrecomprado (81/87). "Todos os longos" não bate; só o 4H.
- Contexto de memória: após dia ≤ −2% no fim da tarde, SHORT acerta 39–43%, mas o LONG contrário não pagava o custo. Uma ordem = 1ª amostra.

## 2. Decisão do Cleber: NÃO ensinar reversão por 4H
Pedido final: "é só linkar certo" — consultar indicadores na 1H e no 5m e entrar; para buscar grandes pontos, medir tudo pela 1H.
Implementado em `llm-active-brain/src/tools.ts`: função `measurementTimeframe(userConfig)`.
- `targetPoints === "MUITOS"` → indicadores, S/R, ATR do stop e alvo, invalidação e reforço usam a **1H**; 5m só consulta de timing.
- Outros alvos seguem o "Timeframe Operacional" do Setup (hoje 5m). Rollback: `MT5_BIG_TARGET_MEASURE_1H=false`.
- **Atenção:** o Setup do Cleber está em MÉDIO/5m; a mudança só vale ao trocar o Alvo de Lucro para MUITOS (ou o timeframe do Setup para 1H).
- Efeito esperado: stops/alvos bem maiores, menos entradas. Sem validação estatística.

## 3. MACD do motor ≠ MT5 (achado e correção)
Cleber: MT5 mostrava venda forte, o motor compra. Causa: o cálculo (12/26/9 sobre fechamento) estava certo, mas o **rótulo** usava
`macd − signal`, enquanto o MT5 desenha como BARRAS a própria linha MACD (EMA12−EMA26). Exemplo 1H do BTC: MACD −487 (venda
forte no MT5) com macd−signal = +5,7 (motor dizia ALTA).
- `atr.ts` (`getMacd`): rótulo ALTA/BAIXA/NEUTRO agora segue a linha MACD vs zero. `histogram`, `crossing`, `turning` seguem como
  antes. Rollback: `MT5_MACD_LABEL_BY_HISTOGRAM=true`. Afeta o lado pela 1H (`computeMarketDirection` usa o rótulo).
- Ressalva não corrigida: o motor busca só 60 velas (`limit: 60` em `fetchCandlesFromNetwork`); o MACD diverge um pouco do
  convergido (15m: −36 vs −43). Não aumentado porque o mesmo array alimenta S/R (`lookbackMinutes = candles.length × tf`).
- Mesa de Operações (`deskReadings.ts`) segue lendo `m.histogram` para o viés; está OFF desde 20/10, não alterada.

## 4. Gráfico do BTC sumiu — rede do Cleber bloqueia a Binance
- Causa: o front buscava candles de cripto direto em `api.binance.com`. A rede dele (firewall pfSense/pfBlockerNG DNSBL, cert
  "pfBlockerNG DNSBL Self-Signed Certificate" emitido em 18/09) passou a responder no lugar da Binance. Supabase e motor não são afetados.
- Correção (decisão do Cleber: pelo servidor):
  - `supabase/functions/server/index.ts`: rota nova `GET /binance-klines` (valida símbolo/intervalo/limite, repassa o array cru da
    Binance, erro explícito em falha; nunca fabrica candle).
  - `src/app/services/market-service.ts`: `fetchCandlesFromBinance` chama essa rota (Bearer `publicAnonKey`, timeout 15 s).
- Alternativa que continua válida: liberar `api.binance.com` no whitelist do pfBlockerNG.
- Não coberto: `fetchQuote` (market-service) e `BacktestDataService` ainda chamam a Binance direto; o preço do gráfico vem de
  outros caminhos. Se algo ficar vazio depois do deploy, olhar esses.

## Operação
- Motor reiniciado duas vezes (`./restart.sh` dentro de `llm-active-brain`): 1ª para a medição pela 1H, 2ª para o MACD novo.
  Instância única conferida (PID 36139, depois 36484). Comando de restart:
  `cd /Users/clebercouto/Projects/we-expand/Neural-Day-Trader/llm-active-brain && ./restart.sh`.
- Commits (feitos pelo Cleber): `e6062a8fb` (1H + MACD) e `4b0277440` (/binance-klines).
- **Pendente:** `supabase functions deploy server` (sem isso a rota não existe) e confirmar o gráfico do BTC ao vivo; conferir no MT5
  que as barras do MACD 1H do BTC batem com o rótulo novo; alvo MUITOS só passa a valer quando o Cleber o selecionar no Setup.
