# Custo de execução — fonte única de verdade (2026-09-23)

**Regra do produto (Cleber):** o que a boleta mostra é o que o log registra. O
usuário só ganha depois de pagar o spread; boleta, posição aberta, prévia de
risco/retorno, fechamento e `ai_trades.net_pnl` usam o MESMO custo.

## De onde vem o número
`custo round-trip = spread REAL medido (1x) + slippage (provisão) + comissão publicada`

| Componente | Fonte | Status |
|---|---|---|
| Spread | `market_spread_samples` (bid/ask do feed da Infinox, 1 amostra/5 min/símbolo) → mediana 7d em `market_spread_current` | **MEDIDO**, diário |
| Comissão | Infinox ECN: $7/lote forex e ouro, $0,70 petróleo, $2 índices, cripto 0 (`publishedCommissionRoundTripPct`, `CostModel.ts`) | Publicado |
| Slippage | tabela estática de `CostModel.ts` | **Provisão, NÃO medida** (medir com execução real: preço pedido vs preenchido) |
| Fallback | tabela estática de `CostModel.ts` quando há < 6 amostras | `source = 'STATIC_MODEL'` |

Cada cálculo devolve `source` (`MEASURED_7D`/`STATIC_MODEL`) e `measuredSpreadPct`.

## Código (não duplicar a fórmula)
- Coletor: `llm-active-brain/src/spreadCollector.ts` (sobe com o motor)
- Estado em memória: `research/MeasuredSpreads.ts`
- Cliente: `ExecutionCost.ts` + `MeasuredSpreadsLoader.ts` (recarrega a cada 15 min)
- Servidor: `llm-active-brain/src/commissionModel.ts`
- Migration: `supabase/migrations/20260923_market_spread_samples.sql`
- Séries: `select * from market_spread_daily order by day desc, symbol;`

## Pesquisa (2026-09-23)
- Modelo antigo de cripto: 0,029% round-trip, do spread do Pepperstone (BTC, abr/2026).
- Mercado hoje: spread médio de BTC CFD ~US$42 (~0,05%) em corretoras grandes
  (forexbrokers/compareforexbrokers, 2026). Infinox: STP sem comissão (spread maior) ou ECN $7/lote.
- Medido no feed da Infinox (mediana de 6 leituras): BTCEUR 0,068% · ETH 0,097% · BNB 0,089% ·
  SOL 0,46% · LINK 0,69% · DOGE 1,3% · ADA 2,7% · DOT 7,9% · FIL 13,9%; forex majors 0,01–0,02%
  (EURUSD ≈ 0,11 pip = perfil ECN raw); NAS100 0,003% · SPX500 0,006% · XAU 0,006% · GER40 0,033%.
- **BTCUSD é roteado pra Binance no servidor** (spread ~0,00001%): o real vem do proxy BTCEUR.
- Impacto: 1 BTC a $84k passa de ~$24,5 para ~$70 de custo round-trip; ETH ~$7,8 → ~$30;
  forex/ouro/índice mudam pouco.

## Limites conhecidos
1. Spread do feed pode diferir da execução real (STP vs ECN, horário). Recalibrar com execução real LIVE.
2. Mediana de 7 dias mistura horários; hora-a-hora fica pra quando houver amostra.
3. Sem histórico no primeiro dia: usa fallback estático até 30 min de amostras.
4. Slippage continua não medido.
