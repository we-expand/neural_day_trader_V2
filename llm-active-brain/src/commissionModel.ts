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
const COMMODITY_SYMBOLS = new Set(["XAUUSD", "UKOUSD"]);
const INDEX_SYMBOLS = new Set([
  "GER40", "SPX500", "NAS100", "UK100", "FRA40", "AUS200", "JPN225", "HKG33", "CHINA50",
]);
const FOREX_MAJOR_SYMBOLS = new Set(["EURUSD"]);

function resolveAssetClass(symbol: string): AssetClass {
  const s = symbol.toUpperCase();
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
    const pointValue = getPointValue(symbol);
    const roundTripPercent = estimateCostPercent(assetClass, priceLevel, pointValue) * 2;
    if (!Number.isFinite(roundTripPercent) || roundTripPercent < 0) return 0;
    return notionalUsd * roundTripPercent;
  } catch (err) {
    console.warn(`[commissionModel] Falha ao estimar comissão de ${symbol}, gravando 0:`, err instanceof Error ? err.message : err);
    return 0;
  }
}
