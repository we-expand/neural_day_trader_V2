/**
 * Caixa contábil da comissão própria da plataforma (LIVE) — 2026-09-11.
 *
 * Pedido do Cleber: "esse dinheiro tem que ser gerenciado, tem que ter um
 * caixa que direciona o dinheiro ganho pelo spread, faz a contabilidade
 * disso". Este módulo grava UM lançamento em `platform_commission_ledger`
 * (ver migration `20260911_platform_commission_ledger.sql`) por trade LIVE
 * fechado, travando a taxa aplicada NAQUELE momento -- nunca recalculado
 * depois, mesma disciplina de nunca reescrever registro financeiro (ver
 * `ai_trades_audit_log` no schema principal).
 *
 * Tabela de taxa por classe de ativo DUPLICADA de propósito de
 * `supabase/functions/server/platformCommission.ts` (mesmo motivo de toda
 * duplicação cross-runtime já documentada neste projeto: Edge Function roda
 * em Deno, `llm-active-brain` roda como processo Node separado, sem import
 * compartilhado). Se recalibrar a taxa, mudar nos DOIS lugares -- o Deno só
 * é usado hoje pra exibir/agregar o legado pré-ledger; a partir desta
 * migration, a fonte de verdade passa a ser esta tabela.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type PlatformAssetClass = "FOREX_MAJOR" | "GOLD" | "OIL" | "INDEX" | "CRYPTO";

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
  return "FOREX_MAJOR";
}

// Ver supabase/functions/server/platformCommission.ts para a fonte/cálculo
// de cada taxa (pesquisa de mercado real, 2026-09-11) -- mesmos números.
const PLATFORM_COMMISSION_PERCENT_ROUND_TRIP: Record<PlatformAssetClass, number> = {
  FOREX_MAJOR: 7 / 110_000,
  GOLD: 7 / 260_000,
  OIL: 0.70 / 75_000,
  INDEX: 2 / 29_000,
  CRYPTO: 10 / 79_000,
};

/**
 * Grava um lançamento no caixa da comissão própria pra um trade LIVE fechado.
 * Nunca lança -- falha de log não pode derrubar o fechamento real do trade
 * (mesma filosofia de robustez do resto deste arquivo/projeto). Chamar só
 * para trades com `brokerPositionId` confirmado (execução real).
 */
export async function recordPlatformCommission(
  sb: SupabaseClient,
  params: {
    tradeId: string;
    userId: string | null;
    sessionId: string | null;
    symbol: string;
    notionalUsd: number;
    closedAt: string;
  }
): Promise<void> {
  try {
    if (!Number.isFinite(params.notionalUsd) || params.notionalUsd <= 0) return;
    const assetClass = resolveAssetClass(params.symbol);
    const ratePercent = PLATFORM_COMMISSION_PERCENT_ROUND_TRIP[assetClass];
    const accruedUsd = params.notionalUsd * ratePercent;
    if (!Number.isFinite(accruedUsd) || accruedUsd <= 0) return;

    const { error } = await sb.from("platform_commission_ledger").insert({
      trade_id: params.tradeId,
      user_id: params.userId,
      session_id: params.sessionId,
      symbol: params.symbol,
      asset_class: assetClass,
      notional_usd: params.notionalUsd,
      rate_percent: ratePercent,
      accrued_usd: accruedUsd,
      closed_at: params.closedAt,
    });
    if (error) {
      console.error("[platformCommissionLedger] falha ao gravar lançamento:", error.message);
    }
  } catch (err) {
    console.error("[platformCommissionLedger] erro inesperado:", err instanceof Error ? err.message : err);
  }
}
