"""
Backtest: cruzamento SMA 40/100 em M1 no BTCUSD, entrada apos pullback.

Convencoes
----------
- 1 ponto = US$ 1,00 de variacao no preco do BTC.
- 0.01 contrato = 0.01 BTC  ->  US$ 0,01 por ponto.
- Stop 60 pontos = -US$ 0,60 | Alvo 80 pontos = +US$ 0,80 (antes de custo).
- Sinal lido no FECHAMENTO do candle t, execucao na ABERTURA do candle t+1.
  Nenhuma decisao usa informacao do proprio candle de execucao.
- Spread S embutido em preco mid: para long o alvo fica S mais longe e o
  stop S mais perto (equivale a entrar no ask e sair no bid).
- Quando um mesmo candle toca stop e alvo, assume STOP (pior caso). O numero
  de barras ambiguas e reportado.
"""
import numpy as np
import pandas as pd

PONTO_USD = 0.01        # 0.01 BTC * US$1 de movimento
STOP_PTS = 60.0
ALVO_PTS = 80.0
TIMEOUT_SETUP = 30      # candles para o pullback acontecer, senao cancela

df = pd.read_parquet("btcusd_m1.parquet")
o = df["open"].to_numpy(float)
h = df["high"].to_numpy(float)
l = df["low"].to_numpy(float)
c = df["close"].to_numpy(float)
ts = df["ts"].to_numpy()

sma_f = pd.Series(c).rolling(40).mean().to_numpy()
sma_s = pd.Series(c).rolling(100).mean().to_numpy()
n = len(c)

diff = sma_f - sma_s
cruz = np.zeros(n, dtype=int)          # +1 cruz de alta, -1 cruz de baixa
valid = ~np.isnan(diff)
prev_ok = np.r_[False, valid[:-1] & valid[1:]]
up = prev_ok & (np.r_[np.nan, diff[:-1]] <= 0) & (diff > 0)
dn = prev_ok & (np.r_[np.nan, diff[:-1]] >= 0) & (diff < 0)
cruz[up] = 1
cruz[dn] = -1


def achou_pullback(modo, lado, i, i0):
    """Pullback ocorreu no candle i, para um setup cruzado em i0?"""
    if modo == "candle_contra":         # ao menos 1 candle contra a cruza
        return c[i] < o[i] if lado > 0 else c[i] > o[i]
    if modo == "toca_sma_rapida":
        return l[i] <= sma_f[i] if lado > 0 else h[i] >= sma_f[i]
    if modo == "toca_sma_lenta":
        return l[i] <= sma_s[i] if lado > 0 else h[i] >= sma_s[i]
    if modo == "volta_nivel_cruz":      # preco retorna ao preco do cruzamento
        return l[i] <= c[i0] if lado > 0 else h[i] >= c[i0]
    raise ValueError(modo)


def confirma(lado, i):
    """Candle i e 'a favor da cruza'."""
    return c[i] > o[i] if lado > 0 else c[i] < o[i]


def rodar(modo, spread=0.0, timeout=TIMEOUT_SETUP):
    """modo='imediato' entra na cruza sem esperar pullback (controle)."""
    trades = []
    ambiguos = 0
    i = 0
    while i < n - 1:
        if cruz[i] == 0:
            i += 1
            continue

        lado, i0 = cruz[i], i

        if modo == "imediato":
            entry_bar = i + 1
        else:
            # procura pullback e depois o primeiro candle a favor
            entry_bar, pull_ok, j = None, False, i + 1
            while j < min(i + 1 + timeout, n - 1):
                if cruz[j] == -lado:            # cruza oposta cancela o setup
                    break
                if not pull_ok:
                    if achou_pullback(modo, lado, j, i0):
                        pull_ok = True
                elif confirma(lado, j):
                    entry_bar = j + 1
                    break
                j += 1
            if entry_bar is None:
                i = j if j > i else i + 1
                continue

        e = o[entry_bar]
        if lado > 0:
            tp, sl = e + ALVO_PTS + spread, e - STOP_PTS + spread
        else:
            tp, sl = e - ALVO_PTS - spread, e + STOP_PTS - spread

        saida = None
        k = entry_bar
        while k < n:
            bateu_tp = h[k] >= tp if lado > 0 else l[k] <= tp
            bateu_sl = l[k] <= sl if lado > 0 else h[k] >= sl
            if bateu_tp and bateu_sl:
                ambiguos += 1
                saida, k_out = -STOP_PTS, k
                break
            if bateu_sl:
                saida, k_out = -STOP_PTS, k
                break
            if bateu_tp:
                saida, k_out = ALVO_PTS, k
                break
            k += 1
        if saida is None:
            break

        trades.append({
            "ts": ts[entry_bar], "lado": lado, "entrada": e,
            "pts": saida, "barras": k_out - entry_bar + 1,
        })
        i = k_out + 1                    # 1 posicao por vez

    t = pd.DataFrame(trades)
    if len(t):
        t["usd"] = t["pts"] * PONTO_USD
    return t, ambiguos


def resumo(t, nome, ambiguos=0):
    if not len(t):
        return {"variacao": nome, "trades": 0}
    wins = (t["pts"] > 0).sum()
    eq = t["usd"].cumsum()
    dd = (eq - eq.cummax()).min()
    g_win = t.loc[t.pts > 0, "usd"].sum()
    g_loss = -t.loc[t.pts < 0, "usd"].sum()
    return {
        "variacao": nome,
        "trades": len(t),
        "acerto_%": 100 * wins / len(t),
        "pts_liq": t["pts"].sum(),
        "usd_liq": t["usd"].sum(),
        "usd_medio": t["usd"].mean(),
        "profit_factor": (g_win / g_loss) if g_loss else np.inf,
        "max_dd_usd": dd,
        "barras_med": t["barras"].mean(),
        "amb_%": 100 * ambiguos / len(t),
    }


MODOS = [
    ("candle_contra",    "A) pullback = 1 candle contra a cruza"),
    ("toca_sma_rapida",  "B) pullback = preco toca a SMA 40"),
    ("toca_sma_lenta",   "C) pullback = preco toca a SMA 100"),
    ("volta_nivel_cruz", "D) pullback = volta ao preco do cruzamento"),
    ("imediato",         "E) CONTROLE: entra na cruza, sem pullback"),
]

if __name__ == "__main__":
    SPREAD = float(__import__("sys").argv[1]) if len(__import__("sys").argv) > 1 else 0.0
    print(f"BTCUSD M1 | {ts[0]} -> {ts[-1]} | {n:,} candles")
    print(f"SMA 40/100 | stop {STOP_PTS:.0f} pts | alvo {ALVO_PTS:.0f} pts | "
          f"0.01 contrato = US$ {PONTO_USD:.2f}/ponto | spread {SPREAD:.0f} pts\n")
    print(f"cruzamentos no periodo: {int((cruz != 0).sum()):,}\n")

    linhas = []
    for modo, nome in MODOS:
        t, amb = rodar(modo, spread=SPREAD)
        linhas.append(resumo(t, nome, amb))
        t.to_csv(f"trades_{modo}_s{int(SPREAD)}.csv", index=False)

    out = pd.DataFrame(linhas)
    pd.set_option("display.width", 200, "display.max_columns", 50)
    print(out.to_string(index=False, float_format=lambda x: f"{x:,.2f}"))
