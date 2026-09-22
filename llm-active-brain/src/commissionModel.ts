/**
 * Comissão/custo de execução REAL de um trade fechado, em dólares.
 *
 * 🔴 2026-09-11 (pedido do Cleber: "todo usuário tem que pagar comissão,
 * computada e gerenciada pelo sistema"): auditoria achou que `ai_trades.
 * commission` está hardcoded em 0 em TODOS os pontos de gravação de
 * `neuralBridge.ts` (openMt5Position, closeMt5Position, realizePartialProfit)
 * -- 281 de 292 trades fechados nos últimos 10 dias, confirmado via SQL.
 * O fix de 2026-08-24 (mesmo achado, mesma causa) só foi aplicado no motor
 * mecânico antigo (`ai-runner`), desligado desde 2026-08-31 quando o LLM
 * Active Brain virou motor único -- nunca foi portado pra cá.
 *
 * Modelo aprovado pelo Cleber: markup de execução por lote (round-trip
 * spread+slippage+comissão), o mesmo conceito já usado no programa de
 * parceiros IB (`execution_revenue`, `20260818_partner_ib_program.sql`) --
 * não uma fatia do lucro, e sim um custo cobrado sobre o volume operado,
 * ganhe ou perca o trade.
 *
 * NÃO reinventa a fórmula: reusa a MESMA fonte calibrada que o app principal
 * já usa (`research/CostModel.ts` + `TradeSizing.ts:getPointValue`), pelas
 * mesmas 2 razões documentadas em `src/app/services/risk/ExecutionCost.ts` --
 * (1) já foi medido em produção que sem isso o PnL exibido fica otimista por
 * construção (achado de 2026-08-23, custo não cobrado = 105% do |PnL bruto|
 * da amostra); (2) este projeto já foi mordido 2x pela mesma fórmula
 * financeira existindo em cópias divergentes. Import relativo direto (não
 * `@/`) porque `llm-active-brain` roda como processo Node separado, sem alias
 * de path configurado -- a cadeia inteira (CostModel.ts, TradeSizing.ts,
 * strategy.ts, assetDatabase.ts) já é livre de import `@/`/React, verificado
 * antes de puxar pra cá.
 *
 * Classe de custo por símbolo: NÃO usa `resolveCostAssetClass` (que depende
 * de `@/app/services/SymbolMappingService.ts`, com alias `@/`) -- mapeada
 * manualmente contra a composição real e já documentada de `MT5_ASSET_BASKET`
 * (`assetBasket.ts`), evitando puxar mais uma dependência transitiva só por
 * isso. Cobre os 27 símbolos atuais da cesta; símbolo novo cai no fallback
 * FOREX_MAJOR (mesmo default conservador do resto do projeto) com log de
 * aviso, nunca falha silenciosa.
 */
import { estimateCostPercent, type AssetClass } from "../../research/CostModel.ts";
import { getPointValue } from "../../src/app/services/strategy/TradeSizing.ts";

// Composição real de MT5_ASSET_BASKET (assetBasket.ts) -- cripto/cross vs.
// forex/commodity/índice. Ver cabeçalho acima pro motivo de não resolver via
// catálogo.
const CRYPTO_SYMBOLS = new Set([
  "BTCUSD", "XETUSD", "BTCXBN", "DOGUSD", "DOTUSD", "XRPUSD", "SOLUSD",
  "ADAUSD", "LNKUSD", "UNIUSD", "TRXUSD", "ATMUSD", "XLMUSD", "FILUSD",
  "BNBUSD", "AVAUSD",
]);
const COMMODITY_SYMBOLS = new Set(["XAUUSD", "UKOUSD", "XAUJPY"]);
const INDEX_SYMBOLS = new Set([
  "GER40", "SPX500", "NAS100", "UK100", "FRA40", "AUS200", "JPN225", "HKG33", "CHINA50",
]);
// 🔴 2026-09-22: pares da sessao asiatica adicionados a cesta (ver
// assetBasket.ts). Mesma taxa FOREX_MAJOR (Infinox cobra comissao por lote
// igual em qualquer par forex) -- antes caiam no mesmo fallback, agora
// explicitos pra nao gerar warning.
const FOREX_MAJOR_SYMBOLS = new Set([
  "EURUSD", "USDJPY", "AUDUSD", "NZDUSD", "AUDJPY", "NZDJPY", "EURJPY", "GBPJPY",
  "USDCNH", "USDSGD", "USDTWD",
]);

// 🔴 2026-09-22 (pares asiaticos, achado ao adicionar): getPointValue
// (TradeSizing.ts, compartilhado com o app) devolve pip 0.0001 pra QUALQUER
// simbolo com "JPY" no nome -- pip real de par cotado em iene e 0.01, entao o
// custo desses pares saia ~100x subestimado (medido: USDJPY 0.0001%
// round-trip vs spread real 0.0064%). Mesmo problema de escala em
// USDCNH/USDTWD/XAUJPY. Override LOCAL (nao mexe no TradeSizing.ts, que o
// app inteiro usa) com pip real + classe de custo por par, calibrado contra o
// spread real medido ao vivo em 2026-09-22 (mesma calibracao do EURUSD:
// custo modelado ~1,4x o spread cru, pra cobrir comissao/slippage):
//   USDJPY major pip 0.01 -> 0.0089% (spread real 0.0064%)
//   xxxJPY minor pip 0.01 -> ~0.02%  (spread real 0.008-0.019%)
//   USDCNH exotic pip 0.0001 -> ~0.045% (spread real 0.024%)
//   USDTWD exotic pip 0.001 -> ~0.095% (spread real 0.104%)
//   XAUJPY commodity, ponto = 0.1 oz-USD convertido (~0.1*USDJPY)
const PAIR_COST_OVERRIDE: Record<string, { assetClass: AssetClass; pointValue: number }> = {
  USDJPY: { assetClass: "FOREX_MAJOR", pointValue: 0.01 },
  AUDJPY: { assetClass: "FOREX_MINOR", pointValue: 0.01 },
  NZDJPY: { assetClass: "FOREX_MINOR", pointValue: 0.01 },
  EURJPY: { assetClass: "FOREX_MINOR", pointValue: 0.01 },
  GBPJPY: { assetClass: "FOREX_MINOR", pointValue: 0.01 },
  AUDUSD: { assetClass: "FOREX_MAJOR", pointValue: 0.0001 },
  NZDUSD: { assetClass: "FOREX_MAJOR", pointValue: 0.0001 },
  USDSGD: { assetClass: "FOREX_MINOR", pointValue: 0.0001 },
  USDCNH: { assetClass: "FOREX_EXOTIC", pointValue: 0.0001 },
  USDTWD: { assetClass: "FOREX_EXOTIC", pointValue: 0.001 },
  XAUJPY: { assetClass: "COMMODITY", pointValue: 15.75 },
};

function resolveAssetClass(symbol: string): AssetClass {
  const s = symbol.toUpperCase();
  if (PAIR_COST_OVERRIDE[s]) return PAIR_COST_OVERRIDE[s].assetClass;
  if (CRYPTO_SYMBOLS.has(s)) return "CRYPTO";
  if (COMMODITY_SYMBOLS.has(s)) return "COMMODITY";
  if (INDEX_SYMBOLS.has(s)) return "INDEX";
  if (FOREX_MAJOR_SYMBOLS.has(s)) return "FOREX_MAJOR";
  console.warn(`[commissionModel] Símbolo fora da classificação conhecida da cesta: ${s} -- usando FOREX_MAJOR como fallback conservador.`);
  return "FOREX_MAJOR";
}

/**
 * Comissão/custo de execução round-trip (entrada+saída), em dólares, pra um
 * trade de `notionalUsd` no `symbol` dado, ao `priceLevel` de entrada.
 *
 * Retorna 0 (nunca lança) se as entradas não forem finitas/positivas --
 * cobrar custo não pode ser o motivo de uma posição não fechar. Espelha
 * `ExecutionCost.ts:calculateRoundTripCost` de propósito, mesma convenção.
 */
export function estimateCommissionUsd(symbol: string, notionalUsd: number, priceLevel: number): number {
  if (!Number.isFinite(notionalUsd) || notionalUsd <= 0 || !Number.isFinite(priceLevel) || priceLevel <= 0) {
    return 0;
  }
  try {
    const assetClass = resolveAssetClass(symbol);
    const pointValue = PAIR_COST_OVERRIDE[symbol.toUpperCase()]?.pointValue ?? getPointValue(symbol);
    const roundTripPercent = estimateCostPercent(assetClass, priceLevel, pointValue) * 2;
    if (!Number.isFinite(roundTripPercent) || roundTripPercent < 0) return 0;
    return notionalUsd * roundTripPercent;
  } catch (err) {
    console.warn(`[commissionModel] Falha ao estimar comissão de ${symbol}, gravando 0:`, err instanceof Error ? err.message : err);
    return 0;
  }
}
