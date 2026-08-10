// DSR de Bailey & Lopez de Prado (2014), formula completa:
//   z = (SR - SR0)*sqrt(T-1) / sqrt(1 - g3*SR + ((g4-1)/4)*SR^2)
// O projeto assume g3=0, g4=3 -> denom = sqrt(1 + SR^2/2)
const ncdf = x => 0.5*(1+erf(x/Math.SQRT2));
function erf(x){const s=x<0?-1:1,a=Math.abs(x);const[a1,a2,a3,a4,a5,p]=[0.254829592,-0.284496736,1.421413741,-1.453152027,1.061405429,0.3275911];const t=1/(1+p*a);return s*(1-(((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-a*a));}

const projDenom = SR => Math.sqrt(1 + SR*SR/2);
const fullDenom = (SR,g3,g4) => Math.sqrt(1 - g3*SR + ((g4-1)/4)*SR*SR);
const dsr = (SR,n,denom) => ncdf((SR-0)*Math.sqrt(n-1)/denom);

console.log('=== DSR: simplificacao gaussiana vs formula completa ===');
console.log('Header do DeflatedSharpe.ts afirma: "tende a ser LIBERAL demais, nao conservadora"\n');

const casos = [
  { nome: 'secao 11.10 (EMA+ADX pooled 3a)', SR: 0.110, n: 92 },
  { nome: 'secao 11.11 (EMA+ADX pooled 10a)', SR: -0.015, n: 322 },
  { nome: 'secao 11.13 (Donchian cripto)',    SR: 0.003, n: 80 },
  { nome: 'hipotetico com edge real',          SR: 0.150, n: 300 },
];
// g3 positivo = skew positivo (assinatura de trend-following); g4>3 = cauda gorda
const perfis = [
  { nome: 'trend-following tipico', g3: 1.5, g4: 8 },
  { nome: 'skew leve',              g3: 0.5, g4: 6 },
  { nome: 'mean-reversion (skew-)', g3: -1.0, g4: 8 },
];

for (const c of casos) {
  const dProj = projDenom(c.SR);
  const dsrProj = dsr(c.SR, c.n, dProj);
  console.log(`\n${c.nome}  SR/trade=${c.SR}  n=${c.n}`);
  console.log(`  projeto (g3=0,g4=3): DSR = ${(dsrProj*100).toFixed(1)}%`);
  for (const p of perfis) {
    const dFull = fullDenom(c.SR, p.g3, p.g4);
    const dsrFull = dsr(c.SR, c.n, dFull);
    const delta = (dsrFull - dsrProj)*100;
    const veredito = delta > 0.5 ? 'projeto foi CONSERVADOR (subestimou)' : delta < -0.5 ? 'projeto foi LIBERAL (superestimou)' : 'diferenca desprezivel';
    console.log(`  ${p.nome.padEnd(24)} g3=${String(p.g3).padStart(4)} g4=${p.g4}: DSR = ${(dsrFull*100).toFixed(1)}%  (${delta>=0?'+':''}${delta.toFixed(1)}pp) -> ${veredito}`);
  }
}
console.log('\n=== Decomposicao: qual termo domina no regime de SR observado? ===');
for (const SR of [0.01, 0.05, 0.11, 0.3, 1.0]) {
  const termoSkew = -1.5*SR;               // g3=1.5
  const termoKurt = ((8-1)/4)*SR*SR;       // g4=8
  console.log(`  SR=${String(SR).padEnd(5)} termo skew(-g3*SR)=${termoSkew.toFixed(4)}  termo curtose=${termoKurt.toFixed(4)}  dominante: ${Math.abs(termoSkew)>Math.abs(termoKurt)?'SKEW (empurra DSR pra CIMA)':'CURTOSE (empurra DSR pra BAIXO)'}`);
}
