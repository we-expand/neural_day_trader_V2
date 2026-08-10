import { calculateADX, Candle } from '/Users/clebercouto/Projects/we-expand/Neural-Day-Trader/src/app/services/indicators/TechnicalIndicators';

// ADX de Wilder CORRETO: RMA (Wilder smoothing) do DX, nao SMA.
function correctADX(candles: Candle[], period = 14): (number | null)[] {
  const len = candles.length;
  const plusDM = new Array(len).fill(0), minusDM = new Array(len).fill(0), tr = new Array(len).fill(0);
  for (let i = 1; i < len; i++) {
    const up = candles[i].high - candles[i-1].high;
    const dn = candles[i-1].low - candles[i].low;
    plusDM[i] = up > dn && up > 0 ? up : 0;
    minusDM[i] = dn > up && dn > 0 ? dn : 0;
    const pc = candles[i-1].close;
    tr[i] = Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - pc), Math.abs(candles[i].low - pc));
  }
  const ws = (v: number[]) => { const o: (number|null)[] = new Array(len).fill(null); let p: number|null = null;
    for (let i=0;i<len;i++){ if(i===period){p=v.slice(1,period+1).reduce((a,b)=>a+b,0);o[i]=p;} else if(i>period){p=(p as number)-(p as number)/period+v[i];o[i]=p;} } return o; };
  const sTR=ws(tr), sP=ws(plusDM), sM=ws(minusDM);
  const dx: (number|null)[] = new Array(len).fill(null);
  for(let i=0;i<len;i++){ const t=sTR[i],p=sP[i],m=sM[i]; if(t===null||p===null||m===null||t===0)continue;
    const pdi=(p/t)*100, mdi=(m/t)*100, s=pdi+mdi; dx[i]= s===0?0:(Math.abs(pdi-mdi)/s)*100; }
  // Wilder RMA do DX (o que o projeto faz com SMA)
  const out: (number|null)[] = new Array(len).fill(null);
  const first = dx.findIndex(v=>v!==null);
  if(first===-1) return out;
  const vals = dx.slice(first).map(v=>v as number);
  let prev: number|null = null;
  for(let i=0;i<vals.length;i++){
    if(i===period-1){ prev = vals.slice(0,period).reduce((a,b)=>a+b,0)/period; out[first+i]=prev; }
    else if(i>=period){ prev = ((prev as number)*(period-1)+vals[i])/period; out[first+i]=prev; }
  }
  return out;
}

// Serie sintetica realista determinística (random walk com regimes, sem Math.random)
function makeSeries(n: number): Candle[] {
  const c: Candle[] = []; let price = 100;
  for (let i = 0; i < n; i++) {
    const trend = Math.sin(i / 40) * 0.35;               // regimes alternando
    const noise = Math.sin(i * 2.399963229728653) * 0.6;  // pseudo-ruido deterministico
    price = Math.max(1, price + trend + noise);
    const rng = 0.4 + Math.abs(Math.sin(i * 1.7)) * 0.6;
    c.push({ time: i, open: price - noise/2, high: price + rng, low: price - rng, close: price, volume: 1000 + i%97 });
  }
  return c;
}

const candles = makeSeries(3000);
const proj = calculateADX(candles, 14);
const corr = correctADX(candles, 14);

let n=0, sumAbs=0, maxAbs=0;
let gate22diff=0, gate20diff=0, gate18diff=0, gateBelow22diff=0, valid=0;
for (let i=0;i<candles.length;i++){
  const a=proj[i], b=corr[i];
  if(a===null||b===null) continue;
  valid++;
  const d=Math.abs(a-b); sumAbs+=d; if(d>maxAbs)maxAbs=d; n++;
  if((a>22)!==(b>22)) gate22diff++;
  if((a>20)!==(b>20)) gate20diff++;
  if((a>18)!==(b>18)) gate18diff++;
  if((a<22)!==(b<22)) gateBelow22diff++;
}
console.log('=== ADX: implementacao do projeto (SMA do DX) vs Wilder correto (RMA do DX) ===');
console.log('barras validas comparadas:', valid);
console.log('erro absoluto medio: ', (sumAbs/n).toFixed(3), 'pontos de ADX');
console.log('erro absoluto maximo:', maxAbs.toFixed(3), 'pontos de ADX');
console.log('');
console.log('DIVERGENCIA DE DECISAO DO GATE DE REGIME:');
console.log(`  ADX>22 (presets 1,3-inv): ${gate22diff} barras divergem = ${(100*gate22diff/valid).toFixed(2)}%`);
console.log(`  ADX>20 (preset 2):        ${gate20diff} barras divergem = ${(100*gate20diff/valid).toFixed(2)}%`);
console.log(`  ADX>18 (preset 5):        ${gate18diff} barras divergem = ${(100*gate18diff/valid).toFixed(2)}%`);
console.log(`  ADX<22 (preset 3):        ${gateBelow22diff} barras divergem = ${(100*gateBelow22diff/valid).toFixed(2)}%`);
console.log('');
console.log('amostra (i, projeto, correto):');
for(let i=100;i<160;i+=10) console.log(`  ${i}  proj=${proj[i]?.toFixed(2)}  correto=${corr[i]?.toFixed(2)}`);
