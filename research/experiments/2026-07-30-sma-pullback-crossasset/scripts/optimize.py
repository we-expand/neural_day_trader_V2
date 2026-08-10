"""
Otimizacao da estrategia de cruzamento de SMA com pullback, sob a disciplina de
research/CRITERIA.md do Neural-Day-Trader:

  - custo real descontado via CostModel.ts (CRYPTO = 0,26% round-trip)
  - split treino/holdout com embargo real via DataSplit.ts (warmup fora da amostra)
  - campeao escolhido SO pelo treino, medido no holdout
  - Deflated Sharpe Ratio via DeflatedSharpe.ts, com N = total de trials testados
  - pisos: n>=100 sinais, degradacao OOS <30% relativa, DSR >=95%

Stop e alvo sao parametrizados em % do preco de entrada (BTC variou 24% no
periodo; stop fixo em pontos nao e comparavel entre janelas). Convertidos para
pontos no relatorio final.
"""
import itertools

import numpy as np
import pandas as pd
from numba import njit

from quant import (deflated_sharpe_ratio, expected_max_sharpe_under_null,
                   sharpe_ratio, split_with_embargo, break_even_win_rate,
                   estimate_cost_percent_crypto)

CUSTO_RT = estimate_cost_percent_crypto() * 2      # 0,0026 = 0,26% round-trip
TIMEOUT_SETUP = 30
MAX_TRADES = 200_000


@njit(cache=True)
def motor(o, h, l, c, sma_f, sma_s, start, end, modo, stop_pct, tgt_pct):
    """
    modo 0 = pullback ate a SMA rapida | modo 1 = pullback ate a SMA lenta.
    Sinal no fechamento de t, entrada na abertura de t+1. Uma posicao por vez.
    Barra que toca stop e alvo conta como STOP (pior caso).
    Retorna (entry_idx[], lado[], ret_liq[]) — ret_liq ja descontado do custo.
    """
    ent = np.empty(MAX_TRADES, np.int64)
    lado_a = np.empty(MAX_TRADES, np.int64)
    ret = np.empty(MAX_TRADES, np.float64)
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

        # aguarda pullback, depois primeiro candle a favor da cruza
        entry_bar = -1
        pull = False
        j = i + 1
        lim = i + 1 + TIMEOUT_SETUP
        if lim > end - 1:
            lim = end - 1
        while j < lim:
            dj0 = sma_f[j - 1] - sma_s[j - 1]
            dj1 = sma_f[j] - sma_s[j]
            if not (np.isnan(dj0) or np.isnan(dj1)):
                if (lado > 0 and dj0 >= 0 and dj1 < 0) or (lado < 0 and dj0 <= 0 and dj1 > 0):
                    break                      # cruza oposta cancela o setup
            if not pull:
                ref = sma_f[j] if modo == 0 else sma_s[j]
                if (lado > 0 and l[j] <= ref) or (lado < 0 and h[j] >= ref):
                    pull = True
            else:
                if (lado > 0 and c[j] > o[j]) or (lado < 0 and c[j] < o[j]):
                    entry_bar = j + 1
                    break
            j += 1
        if entry_bar < 0:
            i = j if j > i else i + 1
            continue

        e = o[entry_bar]
        if lado > 0:
            tp = e * (1.0 + tgt_pct)
            sl = e * (1.0 - stop_pct)
        else:
            tp = e * (1.0 - tgt_pct)
            sl = e * (1.0 + stop_pct)

        saida = np.nan
        k_out = -1
        m = entry_bar
        while m < end:
            if lado > 0:
                hit_tp = h[m] >= tp
                hit_sl = l[m] <= sl
            else:
                hit_tp = l[m] <= tp
                hit_sl = h[m] >= sl
            if hit_sl:
                saida = -stop_pct
                k_out = m
                break
            if hit_tp:
                saida = tgt_pct
                k_out = m
                break
            m += 1
        if k_out < 0:
            break

        if k < MAX_TRADES:
            ent[k] = entry_bar
            lado_a[k] = lado
            ret[k] = saida - CUSTO_RT      # liquido, CostModel.ts toNetReturn
            k += 1
        i = k_out + 1
    return ent[:k], lado_a[:k], ret[:k]


def main():
    df = pd.read_parquet("btcusd_m1.parquet")
    o = df["open"].to_numpy(float)
    h = df["high"].to_numpy(float)
    l = df["low"].to_numpy(float)
    c = df["close"].to_numpy(float)
    n = len(c)
    preco_med = float(c.mean())

    RAPIDAS = [10, 20, 40, 80]
    LENTAS = [50, 100, 200, 400]
    STOPS = [0.002, 0.004, 0.008, 0.015, 0.025, 0.040]     # % do preco
    RAZOES = [0.75, 1.0, 4 / 3, 2.0, 3.0]                  # alvo / stop
    MODOS = [0, 1]

    pares = [(f, s) for f in RAPIDAS for s in LENTAS if f < s]
    janelas = split_with_embargo(n, num_windows=3, train_pct=0.7, warmup_bars=200)

    n_trials = len(pares) * len(STOPS) * len(RAZOES) * len(MODOS)
    print(f"BTCUSD M1 | {n:,} candles | custo round-trip {CUSTO_RT*100:.2f}% "
          f"(~{CUSTO_RT*preco_med:.0f} pts @ preco medio US$ {preco_med:,.0f})")
    print(f"grid: {len(pares)} pares SMA x {len(STOPS)} stops x {len(RAZOES)} razoes "
          f"x {len(MODOS)} pullbacks = {n_trials} trials")
    print(f"janelas walk-forward: {len(janelas)} (treino 70% / holdout 30%, warmup 200 fora da amostra)\n")

    smas = {}
    for p in set(RAPIDAS + LENTAS):
        smas[p] = pd.Series(c).rolling(p).mean().to_numpy()

    linhas = []
    for (f, s) in pares:
        sf, ss = smas[f], smas[s]
        for modo, stop_pct, razao in itertools.product(MODOS, STOPS, RAZOES):
            tgt_pct = stop_pct * razao
            r_tr, r_ho = [], []
            for (ini, split_at, warm, fim, first_valid) in janelas:
                _, _, rt = motor(o, h, l, c, sf, ss, ini, split_at, modo, stop_pct, tgt_pct)
                r_tr.append(rt)
                eh, _, rh = motor(o, h, l, c, sf, ss, warm, fim, modo, stop_pct, tgt_pct)
                r_ho.append(rh[eh >= first_valid])       # descarta warmup
            tr = np.concatenate(r_tr) if r_tr else np.array([])
            ho = np.concatenate(r_ho) if r_ho else np.array([])
            linhas.append({
                "rapida": f, "lenta": s, "modo": modo,
                "stop_pct": stop_pct, "razao": razao, "alvo_pct": tgt_pct,
                "stop_pts": stop_pct * preco_med, "alvo_pts": tgt_pct * preco_med,
                "n_tr": len(tr), "sharpe_tr": sharpe_ratio(tr),
                "ret_tr": float(tr.sum()), "acerto_tr": float((tr > 0).mean()) if len(tr) else np.nan,
                "n_ho": len(ho), "sharpe_ho": sharpe_ratio(ho),
                "ret_ho": float(ho.sum()), "acerto_ho": float((ho > 0).mean()) if len(ho) else np.nan,
            })
        print(f"  SMA {f:>3}/{s:<3} concluido", flush=True)

    res = pd.DataFrame(linhas)
    res.to_csv("grid_resultados.csv", index=False)
    np.save("grid_sharpes_treino.npy", res["sharpe_tr"].to_numpy())
    print(f"\n{len(res)} trials concluidos -> grid_resultados.csv")


if __name__ == "__main__":
    main()
