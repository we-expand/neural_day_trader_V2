import numpy as np, time, sys, json, urllib.request, urllib.parse
def get(url,params=None,headers=None):
    if params: url+='?'+urllib.parse.urlencode(params)
    return json.loads(urllib.request.urlopen(urllib.request.Request(url,headers=headers or {}),timeout=30).read())
from concurrent.futures import ThreadPoolExecutor
DAYS=365
def fetch(sym):
    end=int(time.time()*1000)//60000*60000; start=end-DAYS*86400000
    rows=[]; s=start
    while s<end:
        for _ in range(5):
            try:
                k=get("https://api.binance.com/api/v3/klines",dict(symbol=sym,interval="1m",startTime=s,limit=1000)); break
            except Exception: time.sleep(2)
        if not k: break
        rows+= [(int(x[0]),float(x[1]),float(x[2]),float(x[3]),float(x[4]),float(x[5])) for x in k]
        s=int(k[-1][0])+60000
    a=np.array(rows); np.save(f"d/{sym}.npy",a); print(sym,len(a),flush=True)
with ThreadPoolExecutor(6) as ex: list(ex.map(fetch,["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT","DOGEUSDT"]))
# forex 5m, Yahoo, ~60d
import json
for s in ["EURUSD=X","GBPUSD=X","USDJPY=X","AUDUSD=X"]:
    j=get(f"https://query1.finance.yahoo.com/v8/finance/chart/{s}?interval=5m&range=60d",headers={"User-Agent":"Mozilla/5.0"})["chart"]["result"][0]
    q=j["indicators"]["quote"][0]; t=j["timestamp"]
    a=np.array([(t[i]*1000,q["open"][i],q["high"][i],q["low"][i],q["close"][i],0) for i in range(len(t)) if None not in (q["open"][i],q["high"][i],q["low"][i],q["close"][i])])
    np.save(f"d/{s.replace('=','_')}.npy",a); print(s,len(a),flush=True)
