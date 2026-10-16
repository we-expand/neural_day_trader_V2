/**
 * Comissão PRÓPRIA da plataforma sobre volume real executado (LIVE) — 2026-09-11.
 *
 * Pedido do Cleber: "todo usuário tem que pagar [comissão]... cobre o que é
 * praticado no mercado, cada ativo tem um spread/comissão diferente". Decisão
 * já tomada nesta mesma conversa: como cada usuário conecta a PRÓPRIA conta MT5
 * na Infinox (execução acontece direto no book real da corretora, não numa
 * mesa própria), a plataforma NÃO pode alargar o spread mostrado ao usuário
 * sem virar ela mesma uma corretora licenciada (B-book) — isso é cobrança de
 * COMISSÃO por lote/volume operado, transparente, o mesmo modelo que toda
 * corretora ECN/Raw já pratica em cima do spread cru.
 *
 * Taxas abaixo vêm de pesquisa real de mercado (WebSearch, 2026-09-11), não
 * inventadas — mesma disciplina de `research/CostModel.ts`:
 *   - Forex & Ouro: US$7,00 round-turn por lote padrão (Infinox conta ECN,
 *     confirmado em múltiplas fontes: fxscouts.com, tradingfinder.com,
 *     investortrip.com — "ECN accounts charge a fixed commission of $7 per
 *     standard round-turn lot ($3.50 per side) for forex and gold").
 *   - Petróleo (UKOUSD): US$0,70 round-turn por lote (mesma fonte, tabela de
 *     comissão por classe de ativo da Infinox ECN).
 *   - Índices: US$2,00 round-turn por lote (mesma fonte).
 *   - Cripto CFD: a Infinox NÃO publica comissão separada — conta cripto é
 *     spread-only (ex.: spread de US$69 citado pra BTCUSD, sem comissão em
 *     cima). Mercado mais amplo de CFD cripto em conta "Raw"/ECN de outras
 *     corretoras pratica comissão adicional de referência ~US$5/lado
 *     (~US$10 round-turn) quando cobrada separadamente. Usado aqui como teto
 *     de referência pra converter em %, não como fato da Infinox.
 *
 * Conversão pra %: como este projeto grava `ai_trades.quantity` como
 * EXPOSIÇÃO EM DÓLAR (notional), não lote MT5 (ver `neuralBridge.ts`,
 * comentário de 2026-08-30 sobre a convenção), a comissão por lote publicada
 * pelo mercado é convertida pra round-trip % do notional usando um preço/
 * contrato de referência típico por classe — a mesma técnica já usada em
 * `research/CostModel.ts` pra calibrar custo de execução. Cada cálculo fica
 * documentado abaixo, símbolo a símbolo, pra nunca virar número opaco.
 *
 * Isto é RECEITA DA CASA (o que a plataforma cobra por cima), diferente de
 * `llm-active-brain/src/commissionModel.ts` (custo estimado que o usuário já
 * paga à corretora, usado só pra calcular PnL líquido do trade).
 *
 * ⚠️ Isto é um valor ACUMULADO (accrued) sobre volume real já confirmado —
 * NÃO significa que o dinheiro já foi efetivamente cobrado/recebido. Não
 * existe ainda mecanismo de cobrança (fatura, débito em conta, gateway de
 * pagamento) — ver nota devolvida por `/admin/commission-summary`.
 */

export type PlatformAssetClass = "FOREX_MAJOR" | "GOLD" | "OIL" | "INDEX" | "CRYPTO";

// Mesma composição real de MT5_ASSET_BASKET usada em
// `llm-active-brain/src/commissionModel.ts` (assetBasket.ts) -- duplicada
// aqui de propósito: esta Edge Function roda em Deno, sem acesso ao código
// do `llm-active-brain` (processo Node separado), mesmo padrão de
// duplicação documentado no cabeçalho daquele arquivo.
const CRYPTO_SYMBOLS = new Set([
  "BTCUSD", "XETUSD", "BTCXBN", "DOGUSD", "DOTUSD", "XRPUSD", "SOLUSD",
  "ADAUSD", "LNKUSD", "UNIUSD", "TRXUSD", "ATMUSD", "XLMUSD", "FILUSD",
  "BNBUSD", "AVAUSD",
]);
const GOLD_SYMBOLS = new Set(["XAUUSD", "XAUJPY"]);
const OIL_SYMBOLS = new Set(["UKOUSD"]);
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

function resolveAssetClass(symbol: string): PlatformAssetClass {
  const s = (symbol || "").toUpperCase();
  if (GOLD_SYMBOLS.has(s)) return "GOLD";
  if (OIL_SYMBOLS.has(s)) return "OIL";
  if (CRYPTO_SYMBOLS.has(s)) return "CRYPTO";
  if (INDEX_SYMBOLS.has(s)) return "INDEX";
  if (FOREX_MAJOR_SYMBOLS.has(s)) return "FOREX_MAJOR";
  // Fallback conservador (mesmo critério do commissionModel.ts do motor):
  // símbolo novo/desconhecido cai na classe de menor comissão relativa em vez
  // de arriscar cobrar demais por um ativo nunca calibrado.
  return "FOREX_MAJOR";
}

/**
 * Round-trip % do notional, derivado de US$/lote publicado ÷ notional típico
 * de 1 lote padrão daquela classe (cálculo explícito em cada linha).
 */
const PLATFORM_COMMISSION_PERCENT_ROUND_TRIP: Record<PlatformAssetClass, number> = {
  // US$7 / lote (100.000 unidades) a ~1,10 EURUSD = US$110.000 notional
  FOREX_MAJOR: 7 / 110_000,       // 0,00636%
  // US$7 / lote (100 oz) a ~US$2.600/oz (referência 2026) = US$260.000 notional
  GOLD: 7 / 260_000,              // 0,00269%
  // US$0,70 / lote (1.000 barris) a ~US$75/barril = US$75.000 notional
  OIL: 0.70 / 75_000,             // 0,00093%
  // US$2 / lote de índice a ~US$29.000 notional de referência (ex.: NAS100)
  INDEX: 2 / 29_000,              // 0,0069%
  // Referência de mercado (não Infinox, que não cobra comissão separada em
  // cripto): ~US$10 round-turn / lote a ~US$79.000 notional (BTC, preço de
  // referência ~2026 segundo CLAUDE.md) -- teto conservador, nunca o real
  // spread-only da Infinox, que seria 0.
  CRYPTO: 10 / 79_000,            // 0,01266%
};

/**
 * Comissão própria da plataforma (round-trip), em dólares, para um trade
 * fechado de `notionalUsd` no `symbol` dado. Nunca lança -- retorna 0 em
 * entrada inválida (mesma convenção defensiva do commissionModel.ts do motor).
 */
export function estimatePlatformCommissionUsd(symbol: string, notionalUsd: number): number {
  if (!Number.isFinite(notionalUsd) || notionalUsd <= 0) return 0;
  const assetClass = resolveAssetClass(symbol);
  const percent = PLATFORM_COMMISSION_PERCENT_ROUND_TRIP[assetClass];
  if (!Number.isFinite(percent) || percent < 0) return 0;
  return notionalUsd * percent;
}

export function resolvePlatformAssetClass(symbol: string): PlatformAssetClass {
  return resolveAssetClass(symbol);
}
