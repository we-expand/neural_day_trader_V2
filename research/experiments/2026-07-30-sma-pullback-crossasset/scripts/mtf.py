"""
M5 e M15, pullback com SEGUNDO TOQUE, grid amplo de R:R incluindo razoes que
produzem acerto >80% por construcao.

Definicao de toque: o preco toca a media de referencia (low<=media em compra,
high>=media em venda). Para o 2o toque contar como toque separado, exige-se ao
menos 1 candle SEM contato entre eles — senao uma sequencia de candles colados
na media contaria como N toques.

Custo aplicado depois da simulacao (o motor devolve retorno bruto + preco de
entrada), permitindo varrer cenarios sem re-simular.
"""
import itertools

import numpy as np
import pandas as pd
from numba import njit

from quant import sharpe_ratio, split_with_embargo

MAX_TRADES = 400_000

# custo round-trip: (nome, pontos_fixos, fracao_do_preco)
CENARIOS_CUSTO = [
    ("0,60 pts (pedido)", 0.60, 0.0),
    ("15,82 pts medidos (0,0145%)", 0.0, 15.82 / 108_829.77),
    ("30 pts (folga slippage)", 0.0, 30.0 / 108_829.77),
]


@njit(cache=True)
def motor(o, h, l, c, sma_f, sma_s, start, end, modo, n_toques,
          stop_pct, tgt_pct, timeout):
    """modo 0 = referencia SMA rapida | 1 = SMA lenta. n_toques = 1 ou 2."""
    ent = np.empty(MAX_TRADES, np.int64)
    ret = np.empty(MAX_TRADES, np.float64)
    px = np.empty(MAX_TRADES, np.float64)
    k = 0
    i = start + 1
    while i < end - 1:
        d0 = sma_f[i - 1] - sma_s[i - 1]
        d1 = sma_f[i] - sma_s[i]
        if np.isnan(d0) or np.isnan(d1):
            i += 1
            continue
        lado = 0
        if d0 <= 0 and d1 > 0:
            lado = 1
        elif d0 >= 0 and d1 < 0:
            lado = -1
        if lado == 0:
            i += 1
            continue

        entry_bar = -1
        toques = 0
        tocando_antes = False      # o candle anterior estava em contato?
        j = i + 1
        lim = min(i + 1 + timeout, end - 1)
        while j < lim:
            dj0 = sma_f[j - 1] - sma_s[j - 1]
            dj1 = sma_f[j] - sma_s[j]
            if not (np.isnan(dj0) or np.isnan(dj1)):
                if (lado > 0 and dj0 >= 0 and dj1 < 0) or (lado < 0 and dj0 <= 0 and dj1 > 0):
                    break                       # cruza oposta cancela
            ref = sma_f[j] if modo == 0 else sma_s[j]
            tocando = (l[j] <= ref) if lado > 0 else (h[j] >= ref)
            if tocando and not tocando_antes:
                toques += 1                     # so conta na BORDA de contato
            tocando_antes = tocando
            if toques >= n_toques and not tocando:
                # ja completou os toques e o preco se descolou: espera candle a favor
                if (lado > 0 and c[j] > o[j]) or (lado < 0 and c[j] < o[j]):
                    entry_bar = j + 1
                    break
            j += 1
        if entry_bar < 0:
            i = j if j > i else i + 1
            continue

        e = o[entry_bar]
        if lado > 0:
            tp, sl = e * (1.0 + tgt_pct), e * (1.0 - stop_pct)
        else:
            tp, sl = e * (1.0 - tgt_pct), e * (1.0 + stop_pct)
        saida = np.nan
        k_out = -1
        m = entry_bar
        while m < end:
            if lado > 0:
                hit_tp, hit_sl = h[m] >= tp, l[m] <= sl
            else:
                hit_tp, hit_sl = l[m] <= tp, h[m] >= sl
            if hit_sl:                          # empate na barra = STOP (pior caso)
                saida, k_out = -stop_pct, m
                break
            if hit_tp:
                saida, k_out = tgt_pct, m
                break
            m += 1
        if k_out < 0:
            break
        if k < MAX_TRADES:
            ent[k], ret[k], px[k] = entry_bar, saida, e
            k += 1
        i = k_out + 1
    return ent[:k], ret[:k], px[:k]


def reamostrar(df, minutos):
    r = (df.set_index("ts")
           .resample(f"{minutos}min")
           .agg(open=("open", "first"), high=("high", "max"),
                low=("low", "min"), close=("close", "last"))
           .dropna()
           .reset_index())
    return r


def rodar_tf(df_m1, tf, linhas):
    df = reamostrar(df_m1, tf)
    o = df["open"].to_numpy(float); h = df["high"].to_numpy(float)
    l = df["low"].to_numpy(float);  c = df["close"].to_numpy(float)
    n = len(c); preco_med = float(c.mean())
    print(f"\n=== M{tf}: {n:,} candles | preco medio US$ {preco_med:,.0f}")

    PARES = [(10, 30), (20, 50), (40, 100), (50, 200), (100, 200)]
    STOPS = [0.002, 0.004, 0.008, 0.015, 0.025]
    RAZOES = [0.20, 0.25, 1 / 3, 0.5, 0.75, 1.0, 4 / 3, 2.0]
    TOQUES = [1, 2]
    MODOS = [0, 1]
    timeout = 40

    warmup = 1000 if tf == 5 else 600
    janelas = split_with_embargo(n, 4, 0.7, warmup)
    smas = {p: pd.Series(c).rolling(p).mean().to_numpy()
            for p in set([x for pr in PARES for x in pr])}

    for (f, s) in PARES:
        sf, ss = smas[f], smas[s]
        for modo, ntq, stop_pct, razao in itertools.product(MODOS, TOQUES, STOPS, RAZOES):
            tgt = stop_pct * razao
            btr, bho, pho = [], [], []
            for (ini, split_at, warm, fim, first_valid) in janelas:
                _, r1, _ = motor(o, h, l, c, sf, ss, ini, split_at, modo, ntq,
                                 stop_pct, tgt, timeout)
                btr.append(r1)
                e2, r2, p2 = motor(o, h, l, c, sf, ss, warm, fim, modo, ntq,
                                   stop_pct, tgt, timeout)
                msk = e2 >= first_valid
                bho.append(r2[msk]); pho.append(p2[msk])
            tr = np.concatenate(btr); ho = np.concatenate(bho); ph = np.concatenate(pho)
            if len(ho) == 0 or len(tr) == 0:
                continue
            base = {"tf": tf, "rapida": f, "lenta": s, "modo": modo, "toques": ntq,
                    "razao": razao, "stop_pct": stop_pct,
                    "stop_pts": stop_pct * preco_med, "alvo_pts": tgt * preco_med,
                    "n_tr": len(tr), "n_ho": len(ho),
                    "acerto_ho": float((ho > 0).mean()),
                    "acerto_neutro": 1.0 / (1.0 + razao)}
            for nome, pts, frac in CENARIOS_CUSTO:
                cst_tr = pts / ph.mean() + frac if pts else frac
                cst_ho = pts / ph + frac if pts else frac
                base[f"sh_tr|{nome}"] = sharpe_ratio(tr - cst_tr)
                rho = ho - cst_ho
                base[f"sh_ho|{nome}"] = sharpe_ratio(rho)
                base[f"ret_ho|{nome}"] = float(rho.sum())
                # US$ com 0.01 contrato: retorno % * preco de entrada * 0.01
                base[f"usd_ho|{nome}"] = float((rho * ph * 0.01).sum())
            linhas.append(base)
        print(f"  SMA {f:>3}/{s:<3} ok", flush=True)


def main():
    df_m1 = pd.read_parquet("btcusd_m1_long.parquet")
    print(f"base M1: {len(df_m1):,} candles | {df_m1.ts.iloc[0]} -> {df_m1.ts.iloc[-1]}")
    linhas = []
    for tf in (5, 15):
        rodar_tf(df_m1, tf, linhas)
    res = pd.DataFrame(linhas)
    res.to_csv("grid_mtf.csv", index=False)
    print(f"\n{len(res)} trials -> grid_mtf.csv")


if __name__ == "__main__":
    main()
