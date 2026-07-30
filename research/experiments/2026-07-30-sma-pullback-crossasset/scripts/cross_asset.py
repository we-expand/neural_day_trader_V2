"""
Teste estrutural: a razao edge/custo do sinal de pullback e uma propriedade
do ATIVO (varia por classe/liquidez) ou do SINAL (constante, o que fecharia
de vez a busca de edge nesta familia)?

Metodologia identica em todos os ativos, para nao inflar nenhum a favor:
  - mesma estrategia: cruzamento SMA 40/100, M1, entrada no 1o toque da SMA100
    (variacao "C" do teste original — a que teve o edge mais limpo e mais
    significativo em BTCUSD, z=+16,4 sobre 202 mil trades)
  - mesmo dimensionamento RELATIVO: stop 0,10% do preco, alvo 0,1333%
    (R:R 1:1,333, a mesma razao 60:80 do pedido original do usuario)
  - mesma disciplina: walk-forward com embargo (DataSplit.ts), warmup fora
    da amostra, custo aplicado apos a simulacao
  - custo real medido na MESMA fonte (Pepperstone, spread minimo, mesma
    janela de medicao 01-30/04/2026) para os 4 ativos — elimina qualquer
    inconsistencia de unidade entre paginas diferentes de corretoras

Criterio de corte definido ANTES de rodar (acordado com o usuario):
  razao edge/custo de holdout > 1,0 em pelo menos 2 ativos independentes,
  com DSR >= 95% e n >= 100 por ativo.
"""
import numpy as np
import pandas as pd
from numba import njit

from quant import (deflated_sharpe_ratio, expected_max_sharpe_under_null,
                   sharpe_ratio, split_with_embargo)

MAX_TRADES = 400_000
STOP_PCT = 0.0010          # 0,10% do preco
TGT_PCT = STOP_PCT * 4 / 3  # R:R 1:1,333 (60:80 do pedido original)
TIMEOUT_SETUP = 30

# custo round-trip real, Pepperstone, spread MINIMO, mesma janela 01-30/04/2026
# (min, nao medio, para nao usar avg num ativo e min noutro — piso comum)
CUSTO_PCT = {
    "BTCUSD": 10.00 / 108_829.77,
    "EURUSD": (0.0 * 0.0001 + 3.50 * 2 / 100_000) / 1.085,   # spread min + comissao Razor
    "US30":   2.0 / 44_000,
    "US500":  0.4 / 6_000,
}


@njit(cache=True)
def motor(o, h, l, c, sma_f, sma_s, start, end, stop_pct, tgt_pct, timeout):
    """Variacao C: pullback = 1o toque da SMA LENTA, entra no candle a favor seguinte."""
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
        lim = min(i + 1 + timeout, end - 1)
        while j < lim:
            dj0 = sma_f[j - 1] - sma_s[j - 1]
            dj1 = sma_f[j] - sma_s[j]
            if not (np.isnan(dj0) or np.isnan(dj1)):
                if (lado > 0 and dj0 >= 0 and dj1 < 0) or (lado < 0 and dj0 <= 0 and dj1 > 0):
                    break
            if not pull:
                if (lado > 0 and l[j] <= sma_s[j]) or (lado < 0 and h[j] >= sma_s[j]):
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


def remover_mercado_fechado(df: pd.DataFrame, min_run: int = 20) -> pd.DataFrame:
    """
    O feed diario do Dukascopy preenche minutos sem negociacao (fim de semana,
    feriado) com candles achatados (O=H=L=C=ultimo preco, sem indicar buraco).
    Medido: ~40% dos candles de EURUSD/US30/US500 tem range zero, com
    sequencias de ate 4.427 min (~3 dias, batendo com fechamento de fim de
    semana). Se nao removido, o preco "parado" faz a SMA rapida convergir
    mais cedo que a lenta (precisa de menos barras achatadas para 'zerar'),
    podendo gerar cruzamento espurio so pela geometria da media movel, nao
    por preco real. Corrige removendo sequencias de flat >= min_run (20 min,
    bem acima de qualquer lull real de mercado ativo, bem abaixo do menor
    fechamento real). BTCUSD (24/7, sem fins de semana) nao precisa disso.
    """
    flat = (df.high == df.low).to_numpy()
    grp = (flat != np.r_[False, flat[:-1]]).cumsum()
    tam = pd.Series(grp).map(pd.Series(grp).value_counts())
    fechado = flat & (tam.to_numpy() >= min_run)
    return df.loc[~fechado].reset_index(drop=True)


def rodar_ativo(nome_ativo: str, df: pd.DataFrame, n_janelas=4):
    df = df.dropna(subset=["open", "high", "low", "close"]).reset_index(drop=True)
    if nome_ativo != "BTCUSD":
        antes = len(df)
        df = remover_mercado_fechado(df)
        print(f"  {nome_ativo}: removidos {antes - len(df):,} candles de mercado "
              f"fechado ({(antes - len(df)) / antes * 100:.1f}%)", flush=True)
    o = df["open"].to_numpy(float); h = df["high"].to_numpy(float)
    l = df["low"].to_numpy(float);  c = df["close"].to_numpy(float)
    n = len(c)
    preco_med = float(c.mean())
    sma_f = pd.Series(c).rolling(40).mean().to_numpy()
    sma_s = pd.Series(c).rolling(100).mean().to_numpy()

    janelas = split_with_embargo(n, n_janelas, 0.7, 200)
    r_tr, r_ho, p_ho = [], [], []
    for (ini, split_at, warm, fim, first_valid) in janelas:
        _, rt, _ = motor(o, h, l, c, sma_f, sma_s, ini, split_at, STOP_PCT, TGT_PCT, TIMEOUT_SETUP)
        r_tr.append(rt)
        e2, r2, p2 = motor(o, h, l, c, sma_f, sma_s, warm, fim, STOP_PCT, TGT_PCT, TIMEOUT_SETUP)
        msk = e2 >= first_valid
        r_ho.append(r2[msk]); p_ho.append(p2[msk])

    tr = np.concatenate(r_tr) if r_tr else np.array([])
    ho = np.concatenate(r_ho) if r_ho else np.array([])
    ph = np.concatenate(p_ho) if p_ho else np.array([])

    cst = CUSTO_PCT[nome_ativo]
    edge_bruto = float(ho.mean()) if len(ho) else np.nan     # E[retorno bruto] em % do preco
    edge_liq = edge_bruto - cst
    acerto = float((ho > 0).mean()) if len(ho) else np.nan
    neutro = STOP_PCT / (STOP_PCT + TGT_PCT)

    return {
        "ativo": nome_ativo, "n": n, "preco_medio": preco_med,
        "n_tr": len(tr), "n_ho": len(ho),
        "acerto_ho": acerto, "neutro": neutro,
        "edge_bruto_pct": edge_bruto, "custo_pct": cst, "edge_liq_pct": edge_liq,
        "razao_edge_custo": edge_bruto / cst if cst else np.nan,
        "sharpe_tr": sharpe_ratio(tr), "sharpe_ho": sharpe_ratio(ho - cst),
        "ret_liq_total_pct": float((ho - cst).sum()) if len(ho) else np.nan,
    }


if __name__ == "__main__":
    import glob
    resultados = []

    btc = pd.read_parquet("btcusd_m1_long.parquet")
    resultados.append(rodar_ativo("BTCUSD", btc))
    print("BTCUSD ok", flush=True)

    for arq, nome in [("dka_EURUSD.parquet", "EURUSD"),
                      ("dka_USA30IDXUSD.parquet", "US30"),
                      ("dka_USA500IDXUSD.parquet", "US500")]:
        try:
            df = pd.read_parquet(arq)
        except FileNotFoundError:
            print(f"{nome}: {arq} nao encontrado, pulando", flush=True)
            continue
        resultados.append(rodar_ativo(nome, df))
        print(f"{nome} ok", flush=True)

    res = pd.DataFrame(resultados)
    res.to_csv("cross_asset_resultados.csv", index=False)
    pd.set_option("display.width", 220, "display.max_columns", 40)
    print("\n" + res.to_string(index=False, float_format=lambda x: f"{x:,.5f}"))
