"""
Testa se um stop dinamico (move para breakeven apos X% do caminho ate o alvo)
resolve o problema das perdas de 1.395 pts na config M15 SMA10/30, 2o toque,
87,91% de acerto (a mesma da pergunta do usuario).

Disciplina identica ao resto da investigacao: barra ambigua (bate stop E alvo
no mesmo candle) conta como STOP (pior caso). O trailing so pode mover a
partir da PROXIMA barra depois do movimento favoravel — nunca usa o range da
propria barra em que o gatilho ocorre para tambem decidir a saida dessa
mesma barra (sem look-ahead intrabarra).
"""
import numpy as np
import pandas as pd
from numba import njit
from scipy import stats as st

from quant import sharpe_ratio, split_with_embargo

MAX_TRADES = 400_000
TIMEOUT_SETUP = 40


@njit(cache=True)
def motor_trail(o, h, l, c, sma_f, sma_s, start, end, modo, n_toques,
                stop_pct, tgt_pct, timeout, breakeven_frac):
    """breakeven_frac = fracao do caminho ate o alvo que, se percorrida a
    favor, move o stop para o preco de entrada. 0.0 = sem trailing (baseline)."""
    ent = np.empty(MAX_TRADES, np.int64)
    ret = np.empty(MAX_TRADES, np.float64)
    moveu = np.empty(MAX_TRADES, np.bool_)
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
        tocando_antes = False
        j = i + 1
        lim = min(i + 1 + timeout, end - 1)
        while j < lim:
            dj0 = sma_f[j - 1] - sma_s[j - 1]
            dj1 = sma_f[j] - sma_s[j]
            if not (np.isnan(dj0) or np.isnan(dj1)):
                if (lado > 0 and dj0 >= 0 and dj1 < 0) or (lado < 0 and dj0 <= 0 and dj1 > 0):
                    break
            ref = sma_f[j] if modo == 0 else sma_s[j]
            tocando = (l[j] <= ref) if lado > 0 else (h[j] >= ref)
            if tocando and not tocando_antes:
                toques += 1
            tocando_antes = tocando
            if toques >= n_toques and not tocando:
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
            sl0 = e * (1.0 - stop_pct)
        else:
            tp = e * (1.0 - tgt_pct)
            sl0 = e * (1.0 + stop_pct)
        sl_atual = sl0
        moved = False
        exit_price = np.nan
        m = entry_bar
        while m < end:
            if lado > 0:
                hit_sl = l[m] <= sl_atual
                hit_tp = h[m] >= tp
            else:
                hit_sl = h[m] >= sl_atual
                hit_tp = l[m] <= tp
            if hit_sl:                       # empate/ambiguo = STOP (pior caso)
                exit_price = sl_atual
                break
            if hit_tp:
                exit_price = tp
                break
            if not moved and breakeven_frac > 0.0:
                alvo_dist = abs(tp - e)
                mfe = (h[m] - e) if lado > 0 else (e - l[m])
                if mfe >= breakeven_frac * alvo_dist:
                    sl_atual = e            # vale a partir da PROXIMA barra
                    moved = True
            m += 1
        if not np.isfinite(exit_price):
            break
        r = (exit_price - e) / e if lado > 0 else (e - exit_price) / e
        if k < MAX_TRADES:
            ent[k] = entry_bar
            ret[k] = r
            moveu[k] = moved
            k += 1
        i = m + 1
    return ent[:k], ret[:k], moveu[:k]


def rodar(df, sma_f_n, sma_s_n, modo, n_toques, stop_pct, tgt_pct, breakeven_frac,
          n_janelas=4, warmup=1000):
    o = df["open"].to_numpy(float); h = df["high"].to_numpy(float)
    l = df["low"].to_numpy(float);  c = df["close"].to_numpy(float)
    n = len(c)
    sma_f = pd.Series(c).rolling(sma_f_n).mean().to_numpy()
    sma_s = pd.Series(c).rolling(sma_s_n).mean().to_numpy()
    janelas = split_with_embargo(n, n_janelas, 0.7, warmup)
    r_ho, mv_ho = [], []
    for (ini, split_at, warm, fim, first_valid) in janelas:
        e2, r2, mv2 = motor_trail(o, h, l, c, sma_f, sma_s, warm, fim, modo, n_toques,
                                  stop_pct, tgt_pct, TIMEOUT_SETUP, breakeven_frac)
        msk = e2 >= first_valid
        r_ho.append(r2[msk]); mv_ho.append(mv2[msk])
    return np.concatenate(r_ho), np.concatenate(mv_ho)


if __name__ == "__main__":
    # reamostra M15 a partir da base M1 de 5,6 anos (mesma pipeline do mtf.py)
    df_m1 = pd.read_parquet("btcusd_m1_long.parquet")
    df = (df_m1.set_index("ts").resample("15min")
          .agg(open=("open", "first"), high=("high", "max"),
               low=("low", "min"), close=("close", "last"))
          .dropna().reset_index())
    preco_med = float(df["close"].mean())

    STOP_PCT = 1395.0 / preco_med
    TGT_PCT = 279.0 / preco_med
    CUSTO_PCT = 15.82 / 108_829.77     # custo medido, mesmo usado em todo o resto

    print(f"M15 SMA10/30, 2o toque | stop {STOP_PCT*100:.3f}% (~1.395pts) | "
          f"alvo {TGT_PCT*100:.3f}% (~279pts) | preco medio US$ {preco_med:,.0f}\n")

    print(f"{'breakeven_frac':>15} | {'n':>5} | {'acerto':>7} | {'E[bruto] pts':>13} | "
          f"{'E[liq] pts':>11} | {'moveram p/ BE':>13} | {'Sharpe_ho':>10}")
    print("-" * 90)
    base = None
    for frac in (0.0, 0.15, 0.30, 0.50, 0.70):
        ho, mv = rodar(df, 10, 30, modo=1, n_toques=2,
                       stop_pct=STOP_PCT, tgt_pct=TGT_PCT, breakeven_frac=frac)
        acerto = (ho > 0).mean()
        Eb = ho.mean() * preco_med
        El = (ho.mean() - CUSTO_PCT) * preco_med
        sh = sharpe_ratio(ho - CUSTO_PCT)
        tag = "  <- baseline (sem trailing)" if frac == 0.0 else ""
        print(f"{frac:>15.2f} | {len(ho):>5} | {acerto*100:>6.2f}% | {Eb:>+13.2f} | "
              f"{El:>+11.2f} | {mv.mean()*100:>12.1f}% | {sh:>+10.4f}{tag}")
        if frac == 0.0:
            base = ho

    print()
    print("Teste pareado: o trailing muda o resultado de forma estatisticamente")
    print("distinguivel do baseline, ou fica dentro do ruido?")
    print("-" * 90)
    for frac in (0.15, 0.30, 0.50, 0.70):
        ho, mv = rodar(df, 10, 30, modo=1, n_toques=2,
                       stop_pct=STOP_PCT, tgt_pct=TGT_PCT, breakeven_frac=frac)
        # mesma contagem de trades (mesmas entradas), diferença de retorno por trade
        n = min(len(base), len(ho))
        d = ho[:n] - base[:n]
        t, p = st.ttest_1samp(d, 0.0)
        print(f"breakeven_frac={frac:.2f}: diff medio {d.mean()*preco_med:+.2f} pts/trade | "
              f"t={t:+.2f} p={p:.3f} {'(nao significativo)' if p>0.05 else '(significativo)'}")
