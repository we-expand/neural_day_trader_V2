# Replay: medir antes de ligar

Ferramenta para testar qualquer regra, prompt ou ajuste de saída contra o histórico real **antes** de ir para o motor ao vivo. O processo segue [`../CRITERIA.md`](../CRITERIA.md): no mínimo 100 sinais, resultado líquido de custo, IC 95% e separação dentro/fora da amostra.

## Como rodar
```bash
node --max-old-space-size=4096 research/replay/01-auditoria-llm.mjs 2026-09-01 2026-10-01
node --max-old-space-size=4096 research/replay/02-saidas-e-ativos.mjs
```
Os resultados vão para `resultados/` (`.md` legível e `.json` por decisão). Os candles ficam em cache em `cache/` (não versionado).

## Peças
| Arquivo | O que faz |
|---|---|
| `lib/data.mjs` | Candles: Binance para BTC/ETH/LINK; `ohlcv_data` (velas reais da MetaAPI arquivadas pelo motor) para índices e commodities. Lê `NEURAL_SUPABASE_*` de `llm-active-brain/.env`, só leitura. |
| `lib/indicators.mjs` | Mesmos parâmetros do motor (`atr.ts`): ATR14, Estocástico 5/3/3, MACD 12/26/9, EMA9/SMA20/SMA200, trend 1h/24h, consenso 5m+1H. Sem look-ahead: só usa velas fechadas. |
| `lib/sim.mjs` | Saída igual à do motor: stop 2×ATR (piso 0,3%, teto 2%, fallback 0,5%), alvo 3×ATR, parcial de 40% em 1R, breakeven em 0,35R, trailing 1,6×ATR (2,2× após 1R). Custo = spread medido. |
| `lib/decisions.mjs` | Lê cada `open_position` do ledger (aberta ou barrada, com o gate que barrou) e agrupa repetições de 30 min. |
| `lib/stats.mjs` | Acerto com IC de Wilson, E[R] com IC 95% e t. |

## Limites conhecidos (não esconder)
1. O simulador não aplica os encolhimentos de alvo/stop por suporte-resistência, máxima/mínima de 24h e range ESTREITO. O alvo simulado tende a ficar maior que o real.
2. A resolução é vela a vela de 5m, não tick. Na mesma vela o stop é checado antes do alvo (conservador).
3. `ohlcv_data` tem buracos (SPX500 ~48%, UKOUSD ~43%, XAGUSD ~7% das velas de 5m em set/2026). Entradas cujo caminho cai num buraco são descartadas, o que pode enviesar os índices.
4. Cripto via Binance, não pelo feed da Infinox: o movimento é o mesmo, o preço absoluto difere um pouco. O custo usa o spread medido da Infinox.
5. Sanidade: nas trades executadas de setembro o simulador dá 38% de acerto contra 36% real (`ai_trades`). NAS100 bate (sim 70% × real 69%, n=32). SPX500 não bate (sim 71% × real 40%, n=15): não confiar no SPX500 simulado até ter mais dado.
