// Reproduz EXATAMENTE o LCG de research/DeflatedSharpe.ts:130-134
let state = 42;
const lcgRandom = () => {
  state = (state * 1103515245 + 12345) & 0x7fffffff;
  return state / 0x7fffffff;
};

const seen = new Map();
const vals = [];
let periodo = null;
for (let i = 0; i < 200000; i++) {
  const v = lcgRandom();
  vals.push(v);
  if (seen.has(state) && periodo === null) { periodo = i - seen.get(state); break; }
  if (!seen.has(state)) seen.set(state, i);
}
console.log('=== TESTE DO LCG (DeflatedSharpe.ts:130-134) ===');
console.log('período detectado:', periodo === null ? '>200000 (ok)' : periodo);
console.log('valores únicos nos primeiros 200k:', new Set(vals).size);
console.log('primeiros 12 valores:', vals.slice(0,12).map(v=>v.toFixed(6)).join(' '));

// Uniformidade: 10 buckets
const buckets = new Array(10).fill(0);
for (const v of vals) buckets[Math.min(9, Math.floor(v*10))]++;
console.log('histograma 10 buckets:', buckets.join(' '));
const esperado = vals.length/10;
const chi2 = buckets.reduce((a,b)=>a+((b-esperado)**2)/esperado,0);
console.log('chi2 uniformidade (df=9, crítico 5% = 16.9):', chi2.toFixed(1), chi2>16.9?'❌ REPROVA':'✅ passa');

// Perda de precisão: state*1103515245 excede 2^53?
console.log('');
console.log('=== PERDA DE PRECISÃO ===');
console.log('Number.MAX_SAFE_INTEGER =', Number.MAX_SAFE_INTEGER);
const s = 0x7fffffff;
console.log('pior caso state*1103515245 =', s*1103515245, '| excede 2^53?', s*1103515245 > Number.MAX_SAFE_INTEGER);
