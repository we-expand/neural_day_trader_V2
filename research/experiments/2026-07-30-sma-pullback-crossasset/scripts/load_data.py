"""Monta o dataset M1 de BTCUSD a partir dos dumps da Binance."""
import glob
import zipfile

import numpy as np
import pandas as pd

COLS = ["open_time", "open", "high", "low", "close", "volume", "close_time",
        "quote_volume", "count", "taker_base", "taker_quote", "ignore"]

frames = []
for path in sorted(glob.glob("data/*.zip")):
    with zipfile.ZipFile(path) as z:
        name = z.namelist()[0]
        with z.open(name) as fh:
            head = fh.readline().decode()
        skip = 1 if "open_time" in head else 0
        with z.open(name) as fh:
            df = pd.read_csv(fh, header=None, names=COLS, skiprows=skip)
    frames.append(df)

raw = pd.concat(frames, ignore_index=True)

# open_time vem em ms ou us dependendo do periodo; normaliza para ms
ot = raw["open_time"].astype("int64")
raw["open_time"] = np.where(ot > 1e15, ot // 1000, ot)

raw["ts"] = pd.to_datetime(raw["open_time"], unit="ms", utc=True)
raw = raw[["ts", "open", "high", "low", "close", "volume"]]
raw = raw.drop_duplicates(subset="ts").sort_values("ts").reset_index(drop=True)

# recorta exatamente os ultimos 6 meses
ini = pd.Timestamp("2026-01-30", tz="UTC")
fim = pd.Timestamp("2026-07-30", tz="UTC")
df = raw[(raw["ts"] >= ini) & (raw["ts"] < fim)].reset_index(drop=True)

esperado = int((fim - ini).total_seconds() // 60)
gaps = df["ts"].diff().dt.total_seconds().div(60).fillna(1)

print(f"periodo      : {df['ts'].iloc[0]}  ->  {df['ts'].iloc[-1]}")
print(f"candles      : {len(df):,}  (esperado {esperado:,}, cobertura {len(df)/esperado:6.2%})")
print(f"buracos >1min: {int((gaps > 1).sum())}  | maior buraco: {gaps.max():.0f} min")
print(f"preco        : min {df['low'].min():,.0f}  max {df['high'].max():,.0f}  "
      f"ini {df['open'].iloc[0]:,.0f}  fim {df['close'].iloc[-1]:,.0f}")
print(f"range M1 mediano : {(df['high'] - df['low']).median():.1f} pontos")
print(f"range M1 medio   : {(df['high'] - df['low']).mean():.1f} pontos")
print(f"|retorno| M1 p95 : {(df['close'] - df['open']).abs().quantile(0.95):.1f} pontos")

df.to_parquet("btcusd_m1.parquet")
print("\nsalvo em btcusd_m1.parquet")
