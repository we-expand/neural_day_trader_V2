import numpy as np, json, urllib.request, analise as A
from datetime import datetime, timezone
orig=A.anchors
def anchors(ts,step,kind):
    if kind!="ny18": return orig(ts,step,kind)
    out=[]
    for i,t in enumerate(ts):
        l=datetime.fromtimestamp(t/1000,timezone.utc).astimezone(A.NY)
        if l.hour==18 and l.minute==0 and l.weekday()!=5: out.append(i)   # Dom-Sex 18:00 NY = 20:00 Brasilia
    return np.array(out)
A.anchors=anchors
allres={}
for s in ["ES=F","NQ=F","YM=F","RTY=F"]:
    j=json.loads(urllib.request.urlopen(urllib.request.Request(f"https://query1.finance.yahoo.com/v8/finance/chart/{s}?interval=5m&range=60d",headers={"User-Agent":"Mozilla/5.0"}),timeout=30).read())["chart"]["result"][0]
    q=j["indicators"]["quote"][0]; t=j["timestamp"]
    a0=np.array([(t[i]*1000,q["open"][i],q["high"][i],q["low"][i],q["close"][i],0) for i in range(len(t)) if None not in (q["open"][i],q["high"][i],q["low"][i],q["close"][i])])
    real=set(a0[:,0].astype(np.int64).tolist())
    grid=np.arange(int(a0[0,0]),int(a0[-1,0])+1,300000,dtype=np.int64)
    a=np.zeros((len(grid),6)); a[:,0]=grid; last=a0[0,4]; k=0; valid=np.zeros(len(grid),bool)
    m={int(r[0]):r for r in a0}
    for g,ts_ in enumerate(grid):
        r=m.get(int(ts_))
        if r is not None: a[g,1:5]=r[1:5]; last=r[4]; valid[g]=True
        else: a[g,1:5]=last
    VALID=set(grid[valid].tolist())
    _o=A.anchors
    A.anchors=lambda ts,st,kd: np.array([i for i in anchors(ts,st,kd) if int(ts[i]) in VALID])
    n,amb,res=A.run(a,5,"ny18"); A.anchors=anchors
    print(f"\n=== {s}: {len(a)} velas 5m, {n} reaberturas 18:00 NY, {amb} ambiguas ===")
    print(A.summ(res))
    for H in res: allres.setdefault(H,[]).extend(res[H])
print("\n=== 4 indices juntos ===")
print(A.summ(allres))
