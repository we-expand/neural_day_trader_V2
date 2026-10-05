# Sessão 2026-09-23 (tarde/noite) — Boleta = log e custo pelo spread REAL medido

## Pedido do Cleber
1. Fechou um BTCUSD SHORT: a boleta mostrava ~+$30, o log registrou $8. Regra: **o que
   está na boleta é o que vai pro log; o usuário só ganha depois de pagar o nosso spread.**
2. "Precisamos saber quanto o mercado pratica diariamente, pra saber quanto devemos
   praticar. Pesquisa aprofundada, e isso tem que estar claro em todo o projeto."

## Diagnóstico do 1º pedido
Trade no banco (`ai_trades`, 2026-09-23 20:02 UTC): BTCUSD SHORT, bruto **$32,62**,
custo (`commission`) **$24,56**, `net_pnl` **$8,06**. A boleta mostrava o bruto.
- O fix de P&L aberto líquido (`useApexLogic.ts`, commit `1a03ec9d2`, 16:23) já estava no
  `origin/dev`, mas o trade abriu antes; a aba provavelmente rodava o bundle antigo
  (recarregar após o deploy). Não confirmado ao vivo (dev local exige login).
- Segunda causa real: a prévia **Risco/Retorno** de `OrderTicket.tsx` era bruta. Corrigida
  (DEMO): Retorno = bruto − custo; Risco = perda + custo. Commit entregue ao Cleber.

## Pesquisa e medição (2º pedido)
Medição ao vivo via `/mt5-prices` (mediana de 6 leituras, feed Infinox):
BTCEUR 0,068% · ETH(XETUSD) 0,097% · BNB 0,089% · SOL 0,46% · LINK 0,69% · DOGE 1,3% ·
ADA 2,7% · DOT 7,9% · FIL 13,9% · forex majors 0,01–0,02% (EURUSD ≈ 0,11 pip, perfil ECN) ·
NAS100 0,003% · SPX500 0,006% · XAU 0,006% · GER40 0,033%.

Web (Infinox/comparativos 2026): ECN $7/lote forex e ouro, $0,70 petróleo, $2 índices;
STP sem comissão (spread maior); spread médio de BTC CFD ~US$42 (~0,05%) em corretoras grandes.

Achados:
- O modelo estático de cripto (0,029% round-trip, Pepperstone/abr) **subestimava** o mercado.
- **BTCUSD é roteado pra Binance** no servidor (spread ~0,00001%): nunca via o spread real
  da corretora. Proxy usado: BTCEUR.
- Impacto esperado: 1 BTC a $84k ~$24,5 → ~$70; 1 ETH ~$8 → ~$30; forex/ouro/índice mudam pouco.

## O que foi implementado (nada commitado/aplicado por mim)
- `supabase/migrations/20260923_market_spread_samples.sql` — tabela de amostras + views
  `market_spread_current` (mediana 7d) e `market_spread_daily`.
- `llm-active-brain/src/spreadCollector.ts` — amostra 35 símbolos a cada 5 min, retenção 30d,
  recarrega a mediana; ligado em `index.ts`.
- `research/MeasuredSpreads.ts` — estado em memória (mín. 6 amostras, aliases do catálogo).
- `research/CostModel.ts` — `estimateCostPercentMeasured` + `publishedCommissionRoundTripPct`.
- `ExecutionCost.ts` (app) e `commissionModel.ts` (servidor) — mesmo cálculo; retornam
  `source` (`MEASURED_7D`/`STATIC_MODEL`) e `measuredSpreadPct`.
- `MeasuredSpreadsLoader.ts` + `App.tsx` — carrega/recarrega a cada 15 min no cliente.
- `research/COST_SOURCE_OF_TRUTH.md` — documento de fonte única; `CLAUDE.md` com ponteiro.

Verificação: `tsc` do motor limpo; teste numérico (tsx) com spreads medidos confirmou os
custos acima; `npm run validate` tem 3 etapas falhando **já antes** das mudanças
("Dynamic require of stream"), 37 asserções OK.

## Pendências
1. Rodar a migration no SQL Editor; `git commit` (comando entregue); `./restart.sh` em
   `llm-active-brain/` (só com pedido do Cleber). Custo cai no estático até ~30 min de amostras.
2. Slippage continua provisão não medida — calibrar com execução LIVE real.
3. Spread do feed pode diferir do executado (STP vs ECN, horário); mediana 7d mistura horários.
4. Painel visual "Custos de Mercado" (spread do dia por ativo vs. nosso custo) não feito;
   só faz sentido após alguns dias de coleta.
5. Confirmar ao vivo que a boleta líquida bate com o log após reload/deploy.

## Fontes
- https://www.infinox.com/global/en/conditions/
- https://tradersunion.com/brokers/forex/view/infinox/
- https://www.infinox.com/global/en/btcusd-cfds-on-app/
- https://www.forexbrokers.com/compare/ic-markets-vs-pepperstone
- https://www.financemagnates.com/forex/best-crypto-cfd-brokers-in-2026-compare-the-top-brokers/
