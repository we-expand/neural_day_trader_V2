// Testa regras candidatas de leitura de 1H contra as marcacoes do Cleber (12 graficos, 2026-10-07).
// Regras definidas ANTES de olhar o resultado; com 12 pontos so serve pra descartar, nao pra provar -> precisa de graficos novos.
import fs from "node:fs";
const d = JSON.parse(fs.readFileSync("validacao_1h.json", "utf8"));
const mine = ["BAIXA","ALTA","BAIXA","ALTA","LATERAL","ALTA","ALTA","BAIXA","BAIXA","LATERAL","BAIXA","LATERAL"];
const atr = (c) => { const tr = c.map((x,i)=>i?Math.max(x.h-x.l,Math.abs(x.h-c[i-1].c),Math.abs(x.l-c[i-1].c)):x.h-x.l); let a=tr.slice(0,14).reduce((s,x)=>s+x,0)/14; for(let i=14;i<tr.length;i++)a=(a*13+tr[i])/14; return a; };
const rules = {
  "V1 inclinacao EMA20 (10 velas) > 0,3 ATR": (c,e9,e20,A)=>{ const s=(e20.at(-1)-e20.at(-11))/A; return s>0.3?"ALTA":s<-0.3?"BAIXA":"LATERAL"; },
  "V2 inclinacao EMA20 (10 velas) > 0,6 ATR": (c,e9,e20,A)=>{ const s=(e20.at(-1)-e20.at(-11))/A; return s>0.6?"ALTA":s<-0.6?"BAIXA":"LATERAL"; },
  "V3 EMA9 vs EMA20 (distancia > 0,15 ATR)": (c,e9,e20,A)=>{ const s=(e9.at(-1)-e20.at(-1))/A; return s>0.15?"ALTA":s<-0.15?"BAIXA":"LATERAL"; },
  "V4 EMA9 vs EMA20 + preco do lado certo da EMA20": (c,e9,e20,A)=>{ const l=c.at(-1).c; return e9.at(-1)>e20.at(-1)&&l>e20.at(-1)?"ALTA":e9.at(-1)<e20.at(-1)&&l<e20.at(-1)?"BAIXA":"LATERAL"; },
  "V5 inclinacao EMA20 (20 velas) > 0,5 ATR": (c,e9,e20,A)=>{ const s=(e20.at(-1)-e20.at(-21))/A; return s>0.5?"ALTA":s<-0.5?"BAIXA":"LATERAL"; },
  "V6 variacao 20 velas > 1 ATR": (c,e9,e20,A)=>{ const s=(c.at(-1).c-c.at(-21).c)/A; return s>1?"ALTA":s<-1?"BAIXA":"LATERAL"; },
  "V7 variacao 12 velas > 0,75 ATR": (c,e9,e20,A)=>{ const s=(c.at(-1).c-c.at(-13).c)/A; return s>0.75?"ALTA":s<-0.75?"BAIXA":"LATERAL"; },
};
const rows = d.map((x,i)=>{ const c=x.win.map(k=>({h:k.h,l:k.l,c:k.c})); return { c, e9:x.e9, e20:x.e20, A:atr(c), mine:mine[i], old:x.antiga, neu:x.nova }; });
for (const [name, fn] of Object.entries(rules)) {
  const out = rows.map(r=>fn(r.c,r.e9,r.e20,r.A));
  const ok = out.filter((o,i)=>o===mine[i]).length, opp = out.filter((o,i)=>(o==="ALTA"&&mine[i]==="BAIXA")||(o==="BAIXA"&&mine[i]==="ALTA")).length;
  console.log(name.padEnd(52), `${ok}/12 bate`, `${opp} opostos`, out.map(o=>o[0]).join(""));
}
console.log("voce".padEnd(52), "", "", mine.map(o=>o[0]).join(""));
