// Regra descrita pelo Cleber (2026-10-07): direcao = pra onde a EMA9 caminha em relacao a EMA20 (convergencia antecipa o cruzamento);
// LATERAL = preco trabalhando em cima das medias por muito tempo. Parametros fixados ANTES de rodar; so 12 pontos -> validar em graficos novos.
import fs from "node:fs";
const d = JSON.parse(fs.readFileSync("validacao_1h.json", "utf8"));
const mine = ["BAIXA","ALTA","BAIXA","ALTA","LATERAL","ALTA","ALTA","BAIXA","BAIXA","LATERAL","BAIXA","LATERAL"];
const atr = (c) => { const tr=c.map((x,i)=>i?Math.max(x.h-x.l,Math.abs(x.h-c[i-1].c),Math.abs(x.l-c[i-1].c)):x.h-x.l); let a=tr.slice(0,14).reduce((s,x)=>s+x,0)/14; for(let i=14;i<tr.length;i++)a=(a*13+tr[i])/14; return a; };
function read(win, e9, e20, P) {
  const A = atr(win), n = win.length;
  const gap = (i) => (e9[i] - e20[i]) / A;                    // >0: EMA9 acima da EMA20
  const g = gap(n-1), dg = g - gap(n-1-P.look);               // dg>0: EMA9 subindo em relacao a EMA20
  // cruzamentos do preco com a EMA20 nas ultimas P.span velas
  let cross = 0; for (let i = n-P.span+1; i < n; i++) if ((win[i].c - e20[i]) * (win[i-1].c - e20[i-1]) < 0) cross++;
  if (cross >= P.crossMax) return "LATERAL";
  const proj = g + dg * P.proj;                               // onde o gap estaria se a tendencia do gap continuar
  return proj > P.band ? "ALTA" : proj < -P.band ? "BAIXA" : "LATERAL";
}
const grid = [];
for (const look of [5,8]) for (const proj of [1,2]) for (const band of [0.1,0.2]) for (const crossMax of [4,5,6]) for (const span of [30,40]) grid.push({look,proj,band,crossMax,span});
const res = grid.map(P => { const out = d.map(x => read(x.win, x.e9, x.e20, P)); return { P, out, ok: out.filter((o,i)=>o===mine[i]).length, opp: out.filter((o,i)=>o!=="LATERAL"&&mine[i]!=="LATERAL"&&o!==mine[i]).length }; });
res.sort((a,b)=>b.ok-a.ok||a.opp-b.opp);
console.log("combinacoes testadas:", res.length, "(com 12 pontos, ~5-6 acertos por sorte nao e raro)");
for (const r of res.slice(0,6)) console.log(JSON.stringify(r.P), `${r.ok}/12`, `${r.opp} opostos`, r.out.map(o=>o[0]).join(""));
console.log("pior:", res.at(-1).ok+"/12", "| mediana:", res[Math.floor(res.length/2)].ok+"/12");
console.log("voce".padEnd(60), mine.map(o=>o[0]).join(""));
