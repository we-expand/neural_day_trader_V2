# Teste de stop 1,5× e alvo 1,5× no scalp — iniciado 2026-10-15 12:26 BRT

> Pedido do Cleber (15/10): regulagem fina de stop × alvo, para a IA operar qualquer ativo que o usuário escolher.
> Nada commitado. Motor reiniciado às **12:26:20 BRT (PID 31431, instância única)**.

## O que está ligado (`llm-active-brain/.env`)
- `MT5_SCALP_STOP_FACTOR=1.5` — no scalp (`targetPoints=POUCOS`, dia útil) o stop vira 1,5× o de hoje (3,0× ATR) e a
  referência do alvo escala igual; com o R:R de POUCOS (1,5) o alvo fica em **1,5× o novo stop** (4,5× ATR).
  Código: `config.ts` (`mt5ScalpStopFactor`) e `tools.ts` (`scalpStopFactor`, antes do cálculo do stop e do alvo).
- `MT5_SCALP_TARGET_MAX_PCT=0` (era 0,25) — teto fixo de alvo desligado (senão cortava o alvo novo).
- `MT5_SCALP_TARGET_STOP_FRACTION=0` — opção A (alvo = 0,6× stop) desligada: deu −0,22R na varredura.

## Rollback
`MT5_SCALP_STOP_FACTOR=1` e `MT5_SCALP_TARGET_MAX_PCT=0.25`, depois `./restart.sh` (dentro de `llm-active-brain`).

## Por que (varredura em 147 entradas reais, `llm-active-brain/reports/stop-target-sweep.md`)
- Stop mais apertado que o atual (0,5×–0,75×) foi sempre pior (−0,2 a −0,26R); alvo pequeno (0,3–0,6× stop) também.
- Única região positiva: stop 1,5×–2× com alvo ≥ 1,5× o stop: +0,07 a +0,10R (teste +0,12, IC95 −0,43 a +0,66 — **não
  significativo**). 40 combinações em 147 entradas: o melhor par pode ser sorte. Velas de 5m, stop/alvo fixos (sem
  breakeven/trailing/parcial/reforço do motor).
- Por ativo, XETUSD/LNKUSD/SOLUSD/CHINA50/AUS200/SPX500 ficaram negativos em qualquer par: aí o problema é o lado.

## Critério de 10 entradas (proposto por mim, aceito pelo Cleber)
Contar **10 entradas fechadas e consolidadas** (parcial não conta separado) abertas **depois de 12:26 BRT**:
- **ABORTAR** se E[R] líquido < −0,3R por entrada **ou** acerto < 30%.
- **MANTER e seguir para o próximo ajuste** se E[R] ≥ −0,15R.
- Entre −0,3R e −0,15R: inconclusivo, estender para 15.
Conferir com: `cd llm-active-brain && npx tsx scripts/error-report.ts --since=2026-10-15T15:26:00Z --out=reports/teste-stop-1-5x.md`
(15:26 UTC = 12:26 BRT). Dez entradas não provam nada estatisticamente; servem só para abortar ou continuar.

## Cuidados
- Stop mais largo com risco fixo em $ → lote menor. Breakeven em 1R (`MT5_BREAKEVEN_TRIGGER_R=1.0`) agora fica 1,5× mais longe.
- Fim de semana não é afetado (usa o stop próprio).
- O log `[ALVO-SCALP]` não aparece neste modo (o teto fixo está desligado); conferir stop e alvo no `open_position` /
  `ai_trades` (`stop_loss`, `take_profit`, `original_stop_distance`): alvo ≈ 1,5× a distância do stop.
