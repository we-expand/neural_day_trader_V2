"""
Baixa candles M1 do Dukascopy (endpoint de candle diario pre-agregado,
1 arquivo = 1 dia inteiro, LZMA, registros de 24 bytes: ts_seg,o,h,l,c,vol).

Instrumentos e o "point" (fator de escala de preco) confirmados por
inspecao manual contra o nivel de preco real de jan/2024:
  EURUSD        point=100000  (1.09316 -> Jan/2024, correto)
  USA30IDXUSD   point=1000    (37.509,7 -> Dow Jan/2024, correto)
  USA500IDXUSD  point=1000    (4.753,7  -> SP500 Jan/2024, correto)
"""
import concurrent.futures as cf
import datetime as dt
import lzma
import struct
import sys
import time

import pandas as pd
import requests

POINTS = {
    "EURUSD": 100_000,
    "USA30IDXUSD": 1_000,
    "USA500IDXUSD": 1_000,
}

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "research-backtest/1.0 (contato: pesquisa quant pessoal)"})


def baixar_dia(symbol: str, data: dt.date):
    url = (f"https://datafeed.dukascopy.com/datafeed/{symbol}/"
           f"{data.year}/{data.month - 1:02d}/{data.day:02d}/BID_candles_min_1.bi5")
    espera = 2.0
    for tentativa in range(6):
        try:
            r = SESSION.get(url, timeout=20)
        except Exception:
            time.sleep(espera)
            espera *= 2
            continue
        if r.status_code == 429:
            time.sleep(espera)
            espera *= 2
            continue
        if r.status_code != 200 or len(r.content) == 0:
            return None
        break
    else:
        return None          # esgotou tentativas, ainda 429 — desiste deste dia
    try:
        dec = lzma.decompress(r.content)
        n = len(dec) // 24
        if n == 0:
            return None
        point = POINTS[symbol]
        rows = []
        base = dt.datetime.combine(data, dt.time.min, tzinfo=dt.timezone.utc)
        for i in range(n):
            ts, o, h, l, c, vol = struct.unpack(">iiiiif", dec[i * 24:(i + 1) * 24])
            rows.append((base + dt.timedelta(seconds=ts), o / point, h / point,
                        l / point, c / point))
        return rows
    except Exception:
        return None


def baixar_periodo(symbol: str, ini: dt.date, fim: dt.date, max_workers: int = 4):
    dias = []
    d = ini
    while d <= fim:
        dias.append(d)
        d += dt.timedelta(days=1)

    todas = []
    ok, vazio = 0, 0
    with cf.ThreadPoolExecutor(max_workers=max_workers) as ex:
        futs = {ex.submit(baixar_dia, symbol, d): d for d in dias}
        for i, fut in enumerate(cf.as_completed(futs)):
            r = fut.result()
            if r:
                todas.extend(r)
                ok += 1
            else:
                vazio += 1
            if (i + 1) % 200 == 0:
                print(f"  {symbol}: {i+1}/{len(dias)} dias processados "
                      f"({ok} com dado, {vazio} vazios/fim de semana)", flush=True)

    df = pd.DataFrame(todas, columns=["ts", "open", "high", "low", "close"])
    df = df.drop_duplicates(subset="ts").sort_values("ts").reset_index(drop=True)
    return df


if __name__ == "__main__":
    symbol = sys.argv[1]
    ini = dt.date.fromisoformat(sys.argv[2])
    fim = dt.date.fromisoformat(sys.argv[3])
    print(f"baixando {symbol} de {ini} a {fim} ...")
    df = baixar_periodo(symbol, ini, fim)
    print(f"{symbol}: {len(df):,} candles M1 | {df.ts.iloc[0]} -> {df.ts.iloc[-1]}")
    out = f"dka_{symbol}.parquet"
    df.to_parquet(out)
    print(f"salvo em {out}")
