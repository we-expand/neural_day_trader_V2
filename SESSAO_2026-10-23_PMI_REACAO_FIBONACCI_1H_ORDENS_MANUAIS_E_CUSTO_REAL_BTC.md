# Sessão 2026-10-23 → 2026-10-25 — PMI, Fibonacci pela 1H, ordens manuais fora do breakeven e custo real do BTC

Continuação de [SESSAO_2026-10-22_BTC_MANUAL_MEDICAO_1H_MACD_MT5_E_GRAFICO_BLOQUEIO_BINANCE.md](SESSAO_2026-10-22_BTC_MANUAL_MEDICAO_1H_MACD_MT5_E_GRAFICO_BLOQUEIO_BINANCE.md)
(aquela sessão fechou com: medição pela 1H para Alvo MUITOS, MACD igual às barras do MT5 e `/binance-klines` no servidor).

## 1. PMI: a IA nem enxergava o evento
Pedido do Cleber (23/10): "todas as vezes que tem PMI, a LLM tem que responder, entender a direção e fazer uma operação de médios
ou muitos pontos". O gatilho de entrada esperado é o **rompimento do topo ou do fundo** do corredor onde o preço está estacionado,
para cima ou para baixo; depois "desenha-se o Fibonacci e acompanha-se".

Achado: o PMI Flash dos EUA (S&P Global Manufacturing/Services/Composite, **13:45Z = 10:45 BRT**, previsão 55,5 / 58,0) vem marcado
**"medium"** no calendário (`/economic-calendar`). Todo o código de eventos só olhava `impact === "high"`, então a IA não sabia que
o PMI existia. Também ficaria fora da trava de 60 min pós-evento, que é o oposto do que o Cleber quer.

O que foi implementado:
- `atr.ts`: `pmiToday` no calendário (qualquer evento com "PMI" e impacto ≠ low), cache de 20 s perto do PMI (−10 a +30 min),
  `getPmiStatus()` (hora, minutos até/depois, dado publicado vs previsto, "ACIMA/ABAIXO/EM LINHA"), `getPmiCorridor(symbol)` e
  `getPmiBreakout(symbol)` (candle de 5m **fechado** além do topo/fundo; com corredor fixo usa o penúltimo candle).
- `watcher.ts` (`checkPmi`): gatilhos `PMI_LIBERADO` (+2 a +20 min), `PMI_REACAO_15MIN` (+15 a +60 min) para cada ativo da cesta, mesmo
  se o dado ainda não saiu; e `PMI_ROMPIMENTO_ALTA/BAIXA` quando o 5m fecha além do corredor (+2 a +90 min, 1x por ativo e lado).
  Confirmado no log de hoje: `[watcher] PMI_LIBERADO: PMI saiu ha 4.0 min -- acionando LLM em 8 ativo(s). Dado publicado.`
- `tools.ts`: gate `JANELA_PMI` (sem entrada nova de −2 a +2 min da divulgação); setup novo **`PMI_REACAO`** (só de 2 a 90 min depois
  do PMI; exige rompimento fechado no lado da entrada; dispensado do veto de estocástico extremo, do momento imediato e do veredito de
  direção da 1H; mede tudo na 1H).
- `agent.ts`: bloco de PMI no prompt (hora, dado, instrução de procurar o rompimento) e mensagem própria para gatilhos `PMI_*`.
- Corredor do BTC marcado pelo Cleber, fixo no `.env` (não versionado): `PMI_CORRIDORS=BTCUSD:81451.88-82035.03`
  (formato `ATIVO:fundo-topo;OUTRO:a-b`). **É manual por dia.** Ativo sem corredor usa suporte/resistência de 5m (janela ~5 h).
- Alvo/stop do `PMI_REACAO` com corredor fixo: **Fibonacci sempre pela 1H** (pedido do Cleber: a estrutura cresce na 1H, "médios
  ou grandes pontos"). Altura = máx/mín das últimas 24 velas de 1H unidas ao corredor; alvo = extremo rompido ± `PMI_FIB_EXTENSION`
  (default 1,0) × altura; stop = meio do corredor ou o stop calculado, o que for mais largo; se o preço já passou do alvo, não persegue.
  Log: `[PMI-FIB]`. Envs: `PMI_TRIGGER_ENABLED=false` (rollback), `PMI_CORRIDORS`, `PMI_FIB_EXTENSION`, `PMI_FIB_1H_CANDLES`.
- Limites: sem validação estatística de que rompimento pós-PMI tenha vantagem; o tamanho do alvo ainda depende do Alvo de Lucro do
  Setup (MÉDIO hoje); as travas de confiança mínima, R:R, teto de risco e pausa de 3 perdas continuam valendo.
- **Não verificado:** se o motor chegou a abrir alguma entrada `PMI_REACAO` hoje. O gatilho disparou; a entrada nunca foi conferida.

## 2. Ordens manuais de BTC "capturam pouco": duas causas
Duas ordens SHORT de 0,02 lote (0,02 BTC = US$0,02 por ponto; contrato `LOT_SIZE.BTCUSD = 1`), 23/10:

| | Ordem 1 | Ordem 2 |
|---|---|---|
| Entrada (Z) | 81.978,06 (13:45:30) | 81.972,76 (13:53:42) |
| Stop inicial | 82.098 | 82.080 |
| Stop virou a entrada | 13:50:52 | 13:55:42 |
| Saída | 82.013,93 por SL, bruto −US$0,72 | 81.982,01, bruto ≈ −US$0,19 |
| Comissão registrada | US$1,196 | ~US$1,2 |

- A aritmética de P&L está certa. O que cortava o ganho: (a) stop levado ao ponto de entrada e fechado por um recuo de poucos pontos
  (na ordem 2 bate com o breakeven automático do motor: a favor 120 pts > distância do stop 107; na ordem 1 a favor foi só 64 pts, então
  essa movimentação provavelmente foi do próprio Cleber); (b) custo de ~0,073% por ordem.
- **Correção (`neuralBridge.ts`):** `isManualOrder(id)` (is_test_data = false e `ai_reasoning` começando com "Ordem manual", com cache
  por id). Ordem manual fica **fora de parcial, breakeven e trailing automáticos**; o stop e o alvo do usuário continuam valendo
  (SL/TP mecânicos). Rollback: `MT5_MANUAL_ORDERS_AUTO_MANAGE=true`. Ordens da IA seguem como antes.

## 3. Custo real do BTCUSD na Infinox
- Cuidado do Cleber: "eu não tenho como conferir, você precisa ter certeza". Pesquisa na web (subagente): spread indicativo da página
  oficial ≈ US$13 (≈0,016%); comissão de cripto não publicada (STP não cobra, ECN cobra valor não divulgado); contrato e swap da
  Infinox não achados. Consulta direta à especificação/preço na MetaAPI: **504** nas duas regiões, apesar de "CONNECTED".
- Achado: o spread do BTC no custo vinha do **proxy BTC/EUR** (mediana 0,058%) porque `/mt5-prices` manda o BTCUSD para a Binance.
  O modelo documentado de cripto era 0,0145%.
- **Correção:** rota `POST /broker-tick` no servidor (tick bruto do broker, sem cache, sem tocar no preço exibido) e `spreadCollector.ts`
  passou a medir o BTCUSD da Infinox (função `sampleBtcBroker`, independente do lote geral, porque o lote dá timeout) e a **parar de
  gravar o proxy** como BTCUSD.
- Medição real (24–25/10): ticks de US$11,10 a US$15,98 (0,0138%–0,0199%); **260 amostras, média 0,01397%, mediana 0,01379%**.
  Concorda com a página da Infinox e com o modelo antigo de 0,0145%; o app descontava ~4–5× mais.
- O Cleber apagou no banco as linhas `proxy:BTCEUR` (`delete ... where symbol='BTCUSD' and source='proxy:BTCEUR'`). Confirmado: só
  restam as 260 linhas `broker_tick`; `market_spread_current` mostra mediana 0,01379%. O motor recarrega a cada 5 min.
- Estimativa (não recalculada pelo motor): custo da ordem de 0,02 BTC cai de ~US$1,20 para ~US$0,28. Registros já fechados
  continuam com o custo antigo (nenhum registro financeiro foi reescrito).
- **Em aberto:** comissão da conta (STP = 0; ECN = valor desconhecido). A próxima ordem real fechada deve ser comparada com o
  histórico do MT5.

## Operação
- Motor reiniciado várias vezes (PMI 10:25 e 10:37; manuais fora do breakeven; coletor de spread, duas vezes). Instância única
  conferida a cada reinício. Comando: `cd /Users/clebercouto/Projects/we-expand/Neural-Day-Trader/llm-active-brain && ./restart.sh`.
- Função publicada pelo Cleber: `supabase functions deploy server` (inclui `/binance-klines` e `/broker-tick`).
- Commits: o Cleber rodou os de 1H/MACD e `/binance-klines` (`e6062a8fb`, `4b0277440`) e, pelo estado do git ao salvar, também os de
  `atr.ts`, `watcher.ts`, `neuralBridge.ts`, `spreadCollector.ts` e servidor. **Ao salvar este arquivo, `agent.ts` e `tools.ts`
  ainda constavam modificados sem commit** (PMI no prompt, setup `PMI_REACAO`, Fibonacci pela 1H).

## Pendências
1. Commit de `agent.ts` e `tools.ts`.
2. Conferir no log, na próxima janela de PMI, `PMI_ROMPIMENTO`, `[PMI-FIB]` e se a entrada `PMI_REACAO` abriu e fechou como esperado.
3. Marcar o corredor (`PMI_CORRIDORS`) em cada dia de PMI; sem ele vale o S/R de 5m.
4. Resolver a comissão ECN/STP do BTCUSD com uma ordem real e o histórico do MT5.
5. Mantém o alerta: a conta MetaAPI responde 504 a consultas diretas (tick, especificação, histórico), embora marcada como conectada.
