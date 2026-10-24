// Baixa candles do MetaAPI via a rota /mt5-candles-history (sequencial, 1 por vez, pra nao disputar a conta com o motor).
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync("../../../llm-active-brain/.env","utf8").split("\n").filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.split("=")[0],l.slice(l.indexOf("=")+1).trim().replace(/^["']|["']$/g,"")]));
const url=`${env.NEURAL_SUPABASE_URL}/functions/v1/server/mt5-candles-history`, key=env.NEURAL_SUPABASE_ANON_KEY;
const out=process.argv[2]; const jobs=[["UKOUSD","15m",180],["NAS100","15m",180],["XAUUSD","15m",180],["EURUSD","15m",180],["UKOUSD","5m",60],["NAS100","5m",60],["XAUUSD","5m",60],["EURUSD","5m",60]];
const CH={"15m":12,"5m":4}; // dias por bloco
for(const [sym,tf,days] of jobs){
  const f=`${out}/mt5_${sym}_${tf}.json`; if(fs.existsSync(f)){console.log("cache",f);continue;}
  let all=new Map(), fails=0; const t0=Date.now();
  for(let d=days; d>0; d-=CH[tf]){
    const end=new Date(Date.now()-(d-CH[tf])*864e5), start=new Date(Date.now()-d*864e5);
    try{
      const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${key}`},body:JSON.stringify({symbol:sym,timeframe:tf,startTime:start.toISOString(),endTime:end.toISOString()}),signal:AbortSignal.timeout(60000)});
      const j=await r.json(); if(j.success&&!j.stale&&j.source&&!/sim/i.test(j.source)) (j.candles||[]).forEach(c=>all.set(c.timestamp,c)); else fails++;
    }catch(e){fails++;}
    await new Promise(r=>setTimeout(r,1500));
  }
  console.log(sym,tf,"candles",all.size,"blocos falhos",fails,((Date.now()-t0)/1000).toFixed(0)+"s");
  if(all.size>500) fs.writeFileSync(f,JSON.stringify([...all.values()].sort((a,b)=>a.timestamp-b.timestamp)));
}
