import sys, json, time, datetime, statistics, importlib.util, math, random
REPO, DATA = sys.argv[1], sys.argv[2]
spec = importlib.util.spec_from_file_location("tm", REPO + "/trader-timemachine/timemachine.py")
tm = importlib.util.module_from_spec(spec); spec.loader.exec_module(tm)
# custo ida+volta em fracao do preco (aprox. spread+comissao da nossa corretora)
COST = {"SPY": 0.0001, "QQQ": 0.0001, "IWM": 0.0002, "DIA": 0.0001, "TSLA": 0.0003, "BTC-USD": 0.0007, "ETH-USD": 0.001}
now = datetime.datetime.utcnow()
rows = []
for sym in COST:
    path = f"{DATA}/{sym}.json"
    try:
        text = open(path).read()
    except FileNotFoundError:
        text = tm.fetch_chart(sym); open(path, "w").write(text); time.sleep(1)
    _, bars, _ = tm.parse_bars(tm.chart_result(text, sym), now)
    sess, _ = tm.full_sessions(tm.split_sessions(bars), "9999-12-31")
    last = tm.SESSION_BARS - 2  # sai 15:55
    for side in ("buy", "sell"):
        for orm in (15, 30):
            for stop in ("or_mid", "or_low" if side == "buy" else "or_high"):
                for tr in (1, 2):
                    h = tm.history_replay(sess, {"setup": "orb", "or_minutes": orm, "stop_rule": stop, "target_r": tr}, last, side)
                    Rs = []
                    for t in h["trades"]:
                        risk = abs(t["entry"] - t["stop"])
                        Rs.append(t["R"] - COST[sym] * t["entry"] / risk)
                    if not Rs: continue
                    g = statistics.mean(t["R"] for t in h["trades"]); n = statistics.mean(Rs)
                    se = statistics.stdev(Rs) / math.sqrt(len(Rs)) if len(Rs) > 1 else float("nan")
                    rows.append((sym, side, orm, stop, tr, len(sess), len(Rs), h["target"], h["stop"], round(g, 3), round(n, 3), round(n / se, 2)))
print("sym side OR stop tgtR sessoes n alvo stop R_bruto R_liq t")
for r in rows: print(*r)
nets = [r[10] for r in rows]
print("\ncombinacoes:", len(rows), "| com R_liq>0:", sum(x > 0 for x in nets), "| |t|>2:", sum(abs(r[11]) > 2 for r in rows))
print("media R_liq de todas:", round(statistics.mean(nets), 3))
