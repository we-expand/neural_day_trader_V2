"""Breakeven de spread, estabilidade temporal, viés direcional e significância."""
import numpy as np
import pandas as pd
from scipy import stats as st

from backtest import rodar, resumo, PONTO_USD, STOP_PTS, ALVO_PTS

pd.set_option("display.width", 220, "display.max_columns", 60)
BE_HIT = STOP_PTS / (STOP_PTS + ALVO_PTS)   # acerto minimo p/ empatar
print(f"Taxa de acerto de equilibrio (60x80): {BE_HIT:.2%}\n")

print("=" * 78)
print("1. SPREAD DE EQUILIBRIO  (quanto de spread a estrategia aguenta)")
print("=" * 78)
for modo, nome in [("toca_sma_rapida", "B) toca SMA 40"),
                   ("toca_sma_lenta", "C) toca SMA 100"),
                   ("candle_contra", "A) candle contra")]:
    linha = []
    for s in [0, 1, 2, 3, 4, 5, 6, 8]:
        t, _ = rodar(modo, spread=float(s))
        linha.append((s, t["usd"].sum()))
    txt = "  ".join(f"s={s}:{v:+7.2f}" for s, v in linha)
    print(f"{nome:18s} {txt}")

print("\n" + "=" * 78)
print("2. MELHOR VARIACAO (C, toca SMA 100) — DETALHE COM SPREAD 0")
print("=" * 78)
t, amb = rodar("toca_sma_lenta", spread=0.0)
t["ts"] = pd.to_datetime(t["ts"], utc=True)
t["mes"] = t["ts"].dt.to_period("M")

print("\n-- por direcao --")
for lado, nm in [(1, "COMPRA"), (-1, "VENDA ")]:
    s = t[t.lado == lado]
    print(f"{nm}: {len(s):5d} trades | acerto {100*(s.pts>0).mean():5.2f}% | "
          f"liq US$ {s.usd.sum():+8.2f}")

print("\n-- por mes --")
m = t.groupby("mes").agg(trades=("pts", "size"),
                         acerto=("pts", lambda x: 100 * (x > 0).mean()),
                         usd=("usd", "sum"))
print(m.to_string(float_format=lambda x: f"{x:,.2f}"))

print("\n-- significancia (spread 0) --")
w = int((t.pts > 0).sum())
res = st.binomtest(w, len(t), BE_HIT, alternative="greater")
se = np.sqrt(BE_HIT * (1 - BE_HIT) / len(t))
z = ((w / len(t)) - BE_HIT) / se
print(f"acerto {100*w/len(t):.2f}% vs equilibrio {100*BE_HIT:.2f}% | "
      f"n={len(t)} | z={z:.2f} | p={res.pvalue:.2e}")

print("\n-- quanto do stop e ruido de 1 candle --")
d = pd.read_parquet("btcusd_m1.parquet")
rng = (d.high - d.low)
print(f"range M1: mediano {rng.median():.0f} pts | medio {rng.mean():.0f} pts | "
      f"p90 {rng.quantile(.9):.0f} pts")
print(f"stop de {STOP_PTS:.0f} pts = {STOP_PTS/rng.median():.1f}x o candle mediano")
print(f"barras ate a saida: mediana {t.barras.median():.0f} min | "
      f"media {t.barras.mean():.1f} min")
print(f"candles com toque duplo (stop+alvo na mesma barra): {amb} "
      f"({100*amb/len(t):.2f}% dos trades)")

print("\n" + "=" * 78)
print("3. RESULTADO EM US$ COM 0.01 CONTRATO — LEITURA FINAL")
print("=" * 78)
cap_risco = STOP_PTS * PONTO_USD
for s, rot in [(0.0, "spread 0 (irreal)"), (2.0, "spread 2 pts"),
               (5.0, "spread 5 pts"), (10.0, "spread 10 pts"),
               (25.0, "spread 25 pts (tipico CFD BTC)")]:
    tt, _ = rodar("toca_sma_lenta", spread=s)
    eq = tt.usd.cumsum()
    print(f"{rot:32s} US$ {tt.usd.sum():+8.2f} em {len(tt):4d} trades | "
          f"risco/trade US$ {cap_risco:.2f} | DD US$ {(eq-eq.cummax()).min():7.2f}")
