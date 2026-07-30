"""
Teste na REGIAO VIAVEL POR CUSTO, com historico estendido.

Por que existe: no grid de 6 meses, o maior stop com amostra >=100 foi 0,8%
(558 pts) — e a serie de Sharpe por faixa de stop era monotonicamente crescente
(-1,07 -> -0,54 -> -0,34), apontando para stops maiores. A tabela de pedagio de
custo diz o mesmo: so a partir de ~1.500 pts o custo para de dominar. Testar
essa regiao exige mais historico, porque stop grande = menos trades.

warmup_bars = 1000 (nao os 200 default do DataSplit.ts): a SMA de 400 periodos
do grid precisa de >=400 barras so para existir, e o default de 200 foi
calibrado para EMA50. Correcao declarada.
"""
import glob
import itertools
import zipfile

import numpy as np
import pandas as pd

from optimize import motor, CUSTO_RT
from quant import sharpe_ratio, split_with_embargo

COLS = ["open_time", "open", "high", "low", "close", "volume", "close_time",
        "quote_volume", "count", "taker_base", "taker_quote", "ignore"]


def montar():
    frames = []
    for path in sorted(glob.glob("data_long/*.zip")) + sorted(glob.glob("data/*.zip")):
        with zipfile.ZipFile(path) as z:
            nm = z.namelist()[0]
            with z.open(nm) as fh:
                head = fh.readline().decode()
            with z.open(nm) as fh:
                frames.append(pd.read_csv(fh, header=None, names=COLS,
                                          skiprows=1 if "open_time" in head else 0))
    raw = pd.concat(frames, ignore_index=True)
    ot = raw["open_time"].astype("int64")
    raw["open_time"] = np.where(ot > 1e15, ot // 1000, ot)
    raw["ts"] = pd.to_datetime(raw["open_time"], unit="ms", utc=True)
    raw = (raw[["ts", "open", "high", "low", "close"]]
           .drop_duplicates(subset="ts").sort_values("ts").reset_index(drop=True))
    return raw


def main():
    df = montar()
    df.to_parquet("btcusd_m1_long.parquet")
    o = df["open"].to_numpy(float)
    h = df["high"].to_numpy(float)
    l = df["low"].to_numpy(float)
    c = df["close"].to_numpy(float)
    n = len(c)
    preco_med = float(c.mean())
    anos = (df["ts"].iloc[-1] - df["ts"].iloc[0]).days / 365.25

    print(f"periodo : {df['ts'].iloc[0]} -> {df['ts'].iloc[-1]}  ({anos:.1f} anos)")
    print(f"candles : {n:,}  | preco medio US$ {preco_med:,.0f} "
          f"(min {df['low'].min():,.0f} / max {df['high'].max():,.0f})")
    print(f"custo round-trip: {CUSTO_RT*100:.2f}% = ~{CUSTO_RT*preco_med:.0f} pts no preco medio\n")

    RAPIDAS, LENTAS = [10, 20, 40, 80], [50, 100, 200, 400]
    STOPS = [0.008, 0.015, 0.025, 0.040, 0.060]     # regiao onde o custo cabe
    RAZOES = [0.75, 1.0, 4 / 3, 2.0, 3.0]
    MODOS = [0, 1]
    pares = [(f, s) for f in RAPIDAS for s in LENTAS if f < s]

    janelas = split_with_embargo(n, num_windows=4, train_pct=0.7, warmup_bars=1000)
    n_trials = len(pares) * len(STOPS) * len(RAZOES) * len(MODOS)
    print(f"grid: {n_trials} trials | 4 janelas walk-forward | warmup 1000 barras\n")

    smas = {p: pd.Series(c).rolling(p).mean().to_numpy() for p in set(RAPIDAS + LENTAS)}
    linhas = []
    for (f, s) in pares:
        sf, ss = smas[f], smas[s]
        for modo, stop_pct, razao in itertools.product(MODOS, STOPS, RAZOES):
            tgt = stop_pct * razao
            r_tr, r_ho = [], []
            for (ini, split_at, warm, fim, first_valid) in janelas:
                _, _, rt = motor(o, h, l, c, sf, ss, ini, split_at, modo, stop_pct, tgt)
                r_tr.append(rt)
                eh, _, rh = motor(o, h, l, c, sf, ss, warm, fim, modo, stop_pct, tgt)
                r_ho.append(rh[eh >= first_valid])
            tr = np.concatenate(r_tr)
            ho = np.concatenate(r_ho)
            linhas.append({
                "rapida": f, "lenta": s, "modo": modo, "razao": razao,
                "stop_pct": stop_pct, "alvo_pct": tgt,
                "stop_pts": stop_pct * preco_med, "alvo_pts": tgt * preco_med,
                "n_tr": len(tr), "sharpe_tr": sharpe_ratio(tr), "ret_tr": float(tr.sum()),
                "acerto_tr": float((tr > 0).mean()) if len(tr) else np.nan,
                "n_ho": len(ho), "sharpe_ho": sharpe_ratio(ho), "ret_ho": float(ho.sum()),
                "acerto_ho": float((ho > 0).mean()) if len(ho) else np.nan,
            })
        print(f"  SMA {f:>3}/{s:<3} ok", flush=True)

    pd.DataFrame(linhas).to_csv("grid_long.csv", index=False)
    print(f"\n{len(linhas)} trials -> grid_long.csv")


if __name__ == "__main__":
    main()
