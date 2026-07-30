"""
Re-teste com custo REAL medido, nao com o CostModel.ts.

Motivo: CostModel.ts CRYPTO = 0,26% round-trip (0,08% comissao + 0,05% slippage
por perna). Pesquisa de 2026-07-30 mediu o custo real de BTCUSD CFD:
Pepperstone, spread medio 15,82 USD sobre preco de referencia 108.829,77
(dado da corretora, janela 01-30/04/2026), SEM comissao em cripto, 1 lote = 1 BTC.
Isso da 0,0145% round-trip — ~18x menor que o CostModel. O grid anterior rodou
com custo superestimado; este script refaz com a faixa real.

O motor devolve retorno BRUTO + preco de entrada; o custo e aplicado depois,
o que permite varrer varios niveis sem re-simular.
"""
import itertools

import numpy as np
import pandas as pd
from numba import njit

from quant import (deflated_sharpe_ratio, expected_max_sharpe_under_null,
                   sharpe_ratio, split_with_embargo, break_even_win_rate)

TIMEOUT_SETUP = 30
MAX_TRADES = 400_000

# Cenarios de custo round-trip, em fracao do nocional
CUSTOS = {
    "0,0092% (Pepperstone min)": 10.0 / 108_829.77,
    "0,0145% (Pepperstone medio, medido)": 15.82 / 108_829.77,
    "0,030% (folga p/ slippage)": 0.00030,
    "0,050%": 0.00050,
    "0,063% (leitura '$69' AskTraders)": 69.0 / 108_829.77,
    "0,260% (CostModel.ts atual)": 0.0026,
}


@njit(cache=True)
def motor_bruto(o, h, l, c, sma_f, sma_s, start, end, modo, stop_pct, tgt_pct):
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
        pull = False
        j = i + 1
        lim = min(i + 1 + TIMEOUT_SETUP, end - 1)
        while j < lim:
            dj0 = sma_f[j - 1] - sma_s[j - 1]
            dj1 = sma_f[j] - sma_s[j]
            if not (np.isnan(dj0) or np.isnan(dj1)):
                if (lado > 0 and dj0 >= 0 and dj1 < 0) or (lado < 0 and dj0 <= 0 and dj1 > 0):
                    break
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
            if hit_sl:
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


def main():
    df = pd.read_parquet("btcusd_m1_long.parquet")
    o = df["open"].to_numpy(float); h = df["high"].to_numpy(float)
    l = df["low"].to_numpy(float);  c = df["close"].to_numpy(float)
    n = len(c); preco_med = float(c.mean())

    RAPIDAS, LENTAS = [10, 20, 40, 80], [50, 100, 200, 400]
    STOPS = [0.001, 0.002, 0.004, 0.008, 0.015, 0.025, 0.040]
    RAZOES = [0.75, 1.0, 4 / 3, 2.0, 3.0]
    MODOS = [0, 1]
    pares = [(f, s) for f in RAPIDAS for s in LENTAS if f < s]
    janelas = split_with_embargo(n, 4, 0.7, 1000)
    n_trials = len(pares) * len(STOPS) * len(RAZOES) * len(MODOS)

    print(f"BTCUSD M1 | {n:,} candles | 5,6 anos | preco medio US$ {preco_med:,.0f}")
    print(f"grid {n_trials} trials x {len(CUSTOS)} niveis de custo\n")
    smas = {p: pd.Series(c).rolling(p).mean().to_numpy() for p in set(RAPIDAS + LENTAS)}

    linhas = []
    for (f, s) in pares:
        sf, ss = smas[f], smas[s]
        for modo, stop_pct, razao in itertools.product(MODOS, STOPS, RAZOES):
            tgt = stop_pct * razao
            br_tr, px_tr, br_ho, px_ho = [], [], [], []
            for (ini, split_at, warm, fim, first_valid) in janelas:
                _, r1, p1 = motor_bruto(o, h, l, c, sf, ss, ini, split_at, modo, stop_pct, tgt)
                br_tr.append(r1); px_tr.append(p1)
                e2, r2, p2 = motor_bruto(o, h, l, c, sf, ss, warm, fim, modo, stop_pct, tgt)
                msk = e2 >= first_valid
                br_ho.append(r2[msk]); px_ho.append(p2[msk])
            btr = np.concatenate(br_tr); ptr = np.concatenate(px_tr)
            bho = np.concatenate(br_ho); pho = np.concatenate(px_ho)
            base = {"rapida": f, "lenta": s, "modo": modo, "razao": razao,
                    "stop_pct": stop_pct, "stop_pts": stop_pct * preco_med,
                    "alvo_pts": tgt * preco_med, "n_tr": len(btr), "n_ho": len(bho),
                    "acerto_ho": float((bho > 0).mean()) if len(bho) else np.nan}
            for nome, cst in CUSTOS.items():
                # custo em % do nocional aplicado sobre o preco de entrada
                rtr = btr - cst
                rho = bho - cst
                base[f"sh_tr|{nome}"] = sharpe_ratio(rtr)
                base[f"sh_ho|{nome}"] = sharpe_ratio(rho)
                base[f"ret_ho|{nome}"] = float(rho.sum())
            linhas.append(base)
        print(f"  SMA {f:>3}/{s:<3} ok", flush=True)

    res = pd.DataFrame(linhas)
    res.to_csv("grid_recusto.csv", index=False)
    print(f"\n{len(res)} trials -> grid_recusto.csv")


if __name__ == "__main__":
    main()
