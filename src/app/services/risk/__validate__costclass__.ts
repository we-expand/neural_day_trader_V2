/**
 * Validação da resolução de classe de custo (`resolveCostAssetClass`) e da
 * aritmética de alvo usada pelo gate de custo — 2026-08-17.
 *
 * Regressão que este arquivo trava: até hoje o motor derivava a classe de
 * custo de `symbolMappingService` (81 mapeamentos) sobre um catálogo de 480
 * ativos, e todo símbolo de fora caía em FOREX_MAJOR. Medido em produção:
 * XBNUSD (BNB) recebia custo 0,2258% em vez de 0,0291% — 7,8x inflado — e
 * sozinho gerou 312 dos 562 vetos de COST_GATE de 11 dias. COCUSD (cacau)
 * errava para o lado oposto, subestimando o custo.
 *
 * Roda com: npx esbuild src/app/services/risk/__validate__costclass__.ts --bundle --platform=node --outfile=/tmp/validate-costclass.js && node /tmp/validate-costclass.js
 */
import { resolveCostAssetClass } from './CostAssetClass';
import { resolveAtrTargets } from '../strategy/runTradingCycle';
import { estimateCostPercent } from '../../../../research/CostModel';
import { evaluateCostViability } from './CostViabilityGate';

let passed = 0;
let failed = 0;

function assertTrue(label: string, condition: boolean) {
  if (!condition) {
    console.error(`❌ FALHOU: ${label}`);
    failed++;
  } else {
    console.log(`✅ OK: ${label}`);
    passed++;
  }
}

// ─── CASO 1: os símbolos que erravam em produção agora classificam certo ────
{
  const bnb = resolveCostAssetClass('XBNUSD');
  assertTrue('XBNUSD (BNB) resolve como CRYPTO, não FOREX_MAJOR', bnb.assetClass === 'CRYPTO');
  assertTrue('XBNUSD vem do catálogo, não de fallback', bnb.source === 'CATALOG');

  const cocoa = resolveCostAssetClass('COCUSD');
  assertTrue('COCUSD (cacau) resolve como COMMODITY, não FOREX_MAJOR', cocoa.assetClass === 'COMMODITY');

  // O custo de BNB tem que bater com o de outra cripto — era 7,8x maior antes.
  const custoBnb = estimateCostPercent(resolveCostAssetClass('XBNUSD').assetClass, 620, 1) * 2 * 100;
  const custoBtc = estimateCostPercent(resolveCostAssetClass('BTCUSD').assetClass, 63536, 1) * 2 * 100;
  assertTrue('custo round-trip de BNB é igual ao de BTC (mesma classe)', Math.abs(custoBnb - custoBtc) < 1e-9);
}

// ─── CASO 2: classes básicas do catálogo ───────────────────────────────────
{
  assertTrue('BTCUSD -> CRYPTO', resolveCostAssetClass('BTCUSD').assetClass === 'CRYPTO');
  assertTrue('SPX500 -> INDEX', resolveCostAssetClass('SPX500').assetClass === 'INDEX');
  assertTrue('XAUUSD -> COMMODITY', resolveCostAssetClass('XAUUSD').assetClass === 'COMMODITY');
  assertTrue('EURUSD -> FOREX_MAJOR', resolveCostAssetClass('EURUSD').assetClass === 'FOREX_MAJOR');
  assertTrue('AAPL -> STOCK', resolveCostAssetClass('AAPL').assetClass === 'STOCK');
  // Exótico não pode ser tratado como major: subestimaria o custo justamente
  // onde o spread é maior.
  assertTrue('USDRUB (exótico) NÃO é FOREX_MAJOR', resolveCostAssetClass('USDRUB').assetClass !== 'FOREX_MAJOR');
}

// ─── CASO 3: símbolo inexistente cai em fallback SINALIZADO ────────────────
{
  const desconhecido = resolveCostAssetClass('SIMBOLO_QUE_NAO_EXISTE_123');
  assertTrue('símbolo desconhecido -> fallback FOREX_MAJOR', desconhecido.assetClass === 'FOREX_MAJOR');
  assertTrue('fallback é explicitamente sinalizado (nunca se passa por classe real)', desconhecido.source === 'FALLBACK');
}

// ─── CASO 4: alvo é 3,75×ATR e o gate mede contra ELE, não contra 1 barra ───
{
  const atr = 100;
  const pointValue = 1;
  const t = resolveAtrTargets(atr, pointValue, 'TREND');
  assertTrue('stop = 1,5×ATR', t.stopPoints === 150);
  assertTrue('alvo = 2,5× o stop = 3,75×ATR', t.targetPoints === 375);

  // SCALP tem teto explícito — o cap não pode ser esquecido pelo gate de custo,
  // senão ele mediria viabilidade contra um alvo que o motor não vai usar.
  const scalp = resolveAtrTargets(atr, pointValue, 'SCALP');
  assertTrue('SCALP limita alvo a 80 pontos', scalp.targetPoints === 80);
  assertTrue('SCALP limita stop a 35 pontos', scalp.stopPoints === 35);
}

// ─── CASO 5: o denominador certo muda o veredito onde importa ──────────────
// Números reais de produção (ai_decisions, 2026-08-17): XAUUSD com custo
// 0,0077% e ATR de 1 barra 0,0422% era REPROVADO (razão 18,2% > 12%). Medido
// contra o alvo real do trade (3,75×ATR = 0,158%), a razão cai pra 4,9% e o
// mesmo setup é VIÁVEL — sem mexer em nenhum limiar.
{
  const custo = 0.0077;
  const atrBarra = 0.0422;
  const alvo = atrBarra * 3.75;

  const antigo = evaluateCostViability(custo, atrBarra);
  const novo = evaluateCostViability(custo, alvo);

  assertTrue('denominador antigo (1 barra) reprovava XAUUSD real', !antigo.approved);
  assertTrue('denominador correto (alvo do trade) aprova o mesmo setup', novo.approved);
  assertTrue('a razão cai exatamente 3,75x (nenhum limiar foi tocado)', Math.abs(antigo.costAsPercentOfMovement / novo.costAsPercentOfMovement - 3.75) < 1e-9);
}

console.log(`\n${passed} passaram, ${failed} falharam.`);
if (failed > 0) process.exit(1);
