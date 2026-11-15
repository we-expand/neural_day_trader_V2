import numpy as np, sys, glob, os
from zoneinfo import ZoneInfo
from datetime import datetime, timezone, timedelta
D=0.0001  # 0,01%
NY=ZoneInfo("America/New_York")

def anchors(ts, step_min, kind):
    """indices das velas de ancora. kind: utc12 (00/12 UTC), ny12 (17/05 NY), utc24 (00 UTC), ctrl (toda meia hora)"""
    out=[]
    for i,t in enumerate(ts):
        dt=datetime.fromtimestamp(t/1000,timezone.utc)
        if dt.minute%30: continue
        if kind=="ctrl": out.append(i); continue
        if kind=="utc12" and dt.minute==0 and dt.hour in (0,12): out.append(i)
        elif kind=="utc24" and dt.minute==0 and dt.hour==0: out.append(i)
        elif kind=="ny12":
            l=dt.astimezone(NY)
            if l.minute==0 and l.hour in (17,5): out.append(i)
        elif kind=="nyopen":
            l=dt.astimezone(NY)
            if l.minute==30 and l.hour==9 and l.weekday()<5: out.append(i)
    return np.array(out)

def run(a, step, kind, Hmins=(60,240,720)):
    ts,o,h,l,c=a[:,0],a[:,1],a[:,2],a[:,3],a[:,4]
    res={H:[] for H in Hmins}; amb=0; n=0
    for i in anchors(ts,step,kind):
        Hmax=max(Hmins)//step
        if i+Hmax>=len(a): continue
        # janela precisa ser continua (sem buracos)
        if ts[i+Hmax]-ts[i]!=Hmax*step*60000: continue
        n+=1
        ref=o[i]; up=ref*(1+D); dn=ref*(1-D)
        hh=h[i:i+Hmax]; ll=l[i:i+Hmax]
        bu=np.argmax(hh>=up) if (hh>=up).any() else -1
        bd=np.argmax(ll<=dn) if (ll<=dn).any() else -1
        if bu<0 and bd<0: continue
        if bu>=0 and (bd<0 or bu<bd): j,dr=bu,1
        elif bd>=0 and (bu<0 or bd<bu): j,dr=bd,-1
        else: amb+=1; continue
        ent=up if dr==1 else dn
        for H in Hmins:
            e=H//step
            if j>=e-1: continue
            path_h=h[i+j+1:i+e]; path_l=l[i+j+1:i+e]
            # volta ao preco de abertura (generoso: so depois da vela da entrada; rigido: inclui a vela)
            if dr==1: back_gen=(path_l<=ref).any(); back_str=(l[i+j]<=ref) or back_gen
            else:     back_gen=(path_h>=ref).any(); back_str=(h[i+j]>=ref) or back_gen
            exitp=c[i+e-1]; hold=dr*(exitp-ent)/ent
            def stop(s):  # stop a s% da entrada; perda = -s
                lv=ent*(1-dr*s)
                if dr==1: hit=(path_l<=lv)
                else: hit=(path_h>=lv)
                return -s if hit.any() else hold
            s0=-D if back_gen else hold
            res[H].append((hold,back_gen,back_str,s0,stop(0.001),stop(0.003),i))
    return n,amb,res

def summ(res,costs=(0,0.0004,0.0007,0.001)):
    out=[]
    for H,r in res.items():
        if not r: continue
        r=np.array(r,dtype=float); N=len(r)
        line=f" H={H//60:>2}h N={N:>5} nao-volta(gen)={100*(1-r[:,1].mean()):5.1f}% nao-volta(rig)={100*(1-r[:,2].mean()):5.1f}% |"
        for nm,k in (("segura",0),("stop0",3),("stop.1%",4),("stop.3%",5)):
            m=r[:,k].mean()*100; se=r[:,k].std(ddof=1)/np.sqrt(N)*100
            line+=f" {nm}: {m:+.4f}%(±{1.96*se:.4f}) acerto {100*(r[:,k]>0).mean():.0f}% |"
        out.append(line)
    return "\n".join(out)

if __name__=="__main__":
    base=os.path.dirname(os.path.abspath(__file__))
    for f in sorted(glob.glob(base+"/d/*.npy")):
        a=np.load(f); name=os.path.basename(f)[:-4]
        step=5 if "_X" in name else 1
        kinds=["utc12","ny12","utc24","nyopen","ctrl"] if step==1 else ["utc12","ny12","ctrl"]
        print(f"\n=== {name} ({len(a)} velas, {step}m) ===",flush=True)
        for k in kinds:
            n,amb,res=run(a,step,k)
            print(f"-- ancora {k}: {n} aberturas, {amb} ambiguas (sobe e desce 0,01% na mesma vela)")
            print(summ(res),flush=True)
