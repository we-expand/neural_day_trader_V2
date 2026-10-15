// Escalonador automático de risco (2026-10-15, pedido do Cleber "alavancar o que puder").
//
// PRINCÍPIO HONESTO: alavancagem MULTIPLICA o E[R], não cria. Com E[R] negativo,
// mais risco = perder mais rápido. Então este escalonador NUNCA sobe o risco às
// cegas: ele começa num piso baixo e só sobe de degrau quando o E[R] líquido REAL
// (medido nas entradas fechadas recentes, por entrada, já descontado o custo)
// prova estar positivo com significância estatística (limite INFERIOR do IC95 > 0).
// Se a amostra disser que está perdendo (limite SUPERIOR do IC95 < 0), cai direto
// pro piso. É o freio de ruína e o acelerador no mesmo mecanismo.
//
// O que ele NÃO faz: nunca afrouxa o teto DURO de risco por trade
// (mt5MaxRiskPctPerTrade) -- isso continua sendo o limite absoluto por cima. Ele só
// escala, PARA BAIXO a partir do tamanho de hoje, o ALVO de exposição
// (mt5TargetRewardUsd no open_position e o risco% no pyramiding). scale=1.0 reproduz
// exatamente o comportamento atual; scale<1.0 opera menor enquanto o edge não se prova.
//
// Fonte dos números: ai_trades no Supabase, consolidado POR ENTRADA (a parcial de
// lucro grava linha CLOSED extra -- contar linhas infla; mesmo cuidado do
// scripts/error-report.ts). Nunca fabrica dado: sem amostra, fica no piso.
//
// DESLIGADO por padrão (config.mt5RiskScalerEnabled). Stateless: decide só pela
// janela recente, sem gravar estado -- sobrevive a restart sem herdar degrau velho.

import { config } from "./config.js";
import { getSupabaseClient } from "./neuralBridge.js";

export interface RiskTier {
  /** multiplicador aplicado ao ALVO de exposição (1.0 = tamanho de hoje). */
  readonly scale: number;
  /** amostra mínima de entradas fechadas para este degrau. */
  readonly minN: number;
  /** limite INFERIOR do IC95 de E[R] líquido (em R) exigido para promover a este degrau. */
  readonly minCiLow: number;
  readonly label: string;
}

// Escada: começa em 1/4 do tamanho de hoje e sobe só com prova crescente.
// Limiares pensados para uma conta pequena em DEMO; revisáveis via .env se quiser.
export const RISK_TIERS: readonly RiskTier[] = [
  { scale: 0.25, minN: 0, minCiLow: -Infinity, label: "piso (não provado / perdendo)" },
  { scale: 0.5, minN: 40, minCiLow: 0.0, label: "parou de sangrar (IC95 baixo > 0,00 em 40+)" },
  { scale: 0.75, minN: 80, minCiLow: 0.05, label: "edge fraco provado (IC95 baixo > +0,05 em 80+)" },
  { scale: 1.0, minN: 150, minCiLow: 0.1, label: "edge sólido (IC95 baixo > +0,10 em 150+)" },
];

/** Amostra mínima absoluta para o escalonador sair do piso por qualquer motivo. */
const MIN_SAMPLE_TO_ACT = 20;
/** Janela de entradas fechadas analisada (mais recentes). */
const WINDOW_ENTRIES = 150;
const CACHE_TTL_MS = 5 * 60_000;

export interface RiskScaleResult {
  scale: number;
  tierLabel: string;
  n: number;
  meanR: number;
  ciLow: number;
  ciHigh: number;
  reason: string;
}

interface Leg {
  session_id: string;
  symbol: string;
  side: string;
  entry_time: string;
  entry_price: number | null;
  quantity: number | null;
  original_stop_distance: number | null;
  net_pnl: number | null;
  pnl: number | null;
}

/** E[R] líquido por entrada nas últimas WINDOW_ENTRIES entradas fechadas. Null se não der para medir. */
async function recentEntryExpectancy(): Promise<{ n: number; meanR: number; ciLow: number; ciHigh: number } | null> {
  // Puxa pernas suficientes para cobrir ~WINDOW_ENTRIES entradas mesmo com parciais (2-3 pernas/entrada).
  const { data, error } = await getSupabaseClient()
    .from("ai_trades")
    .select("session_id, symbol, side, entry_time, entry_price, quantity, original_stop_distance, net_pnl, pnl")
    .eq("status", "CLOSED")
    .order("entry_time", { ascending: false })
    .limit(WINDOW_ENTRIES * 3);
  if (error || !data) return null;

  const groups = new Map<string, Leg[]>();
  for (const l of data as unknown as Leg[]) {
    const k = `${l.session_id}|${l.symbol}|${l.side}|${l.entry_time}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(l);
  }
  const rs: number[] = [];
  for (const g of groups.values()) {
    const head = g.find((l) => l.original_stop_distance != null && l.entry_price != null) ?? g[0];
    const qty = g.reduce((s, l) => s + (l.quantity ?? 0), 0);
    const dist = head.original_stop_distance;
    if (dist == null || !(dist > 0) || head.entry_price == null || !(head.entry_price > 0) || !(qty > 0)) continue;
    const riskUsd = (dist * qty) / head.entry_price;
    if (!(riskUsd > 0)) continue;
    const netUsd = g.reduce((s, l) => s + (l.net_pnl ?? l.pnl ?? 0), 0);
    rs.push(netUsd / riskUsd);
  }
  // Ordena por recência já veio desc das pernas; pega as WINDOW_ENTRIES entradas mais novas.
  const sample = rs.slice(0, WINDOW_ENTRIES);
  const n = sample.length;
  if (n === 0) return null;
  const mean = sample.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(sample.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1)) : 0;
  const se = n > 1 ? sd / Math.sqrt(n) : Infinity;
  const ciLow = mean - 1.96 * se;
  const ciHigh = mean + 1.96 * se;
  return { n, meanR: mean, ciLow, ciHigh };
}

let cache: { at: number; result: RiskScaleResult } | null = null;

/**
 * Multiplicador de exposição atual. Com o escalonador desligado, devolve 1.0 (comportamento
 * de hoje). Ligado: decide o degrau pela amostra recente. Nunca lança: em qualquer falha,
 * cai no piso (conservador) e diz o motivo.
 */
export async function getRiskScale(): Promise<RiskScaleResult> {
  if (!config.mt5RiskScalerEnabled) {
    return { scale: 1, tierLabel: "escalonador desligado", n: 0, meanR: 0, ciLow: 0, ciHigh: 0, reason: "MT5_RISK_SCALER=false -- sizing normal (1.0x)" };
  }
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.result;

  const floor = RISK_TIERS[0];
  let result: RiskScaleResult;
  try {
    const stats = await recentEntryExpectancy();
    if (!stats || stats.n < MIN_SAMPLE_TO_ACT) {
      result = { scale: floor.scale, tierLabel: floor.label, n: stats?.n ?? 0, meanR: stats?.meanR ?? 0, ciLow: stats?.ciLow ?? 0, ciHigh: stats?.ciHigh ?? 0, reason: `amostra insuficiente (${stats?.n ?? 0} < ${MIN_SAMPLE_TO_ACT}) -- piso ${floor.scale}x` };
    } else if (stats.ciHigh < 0) {
      // Estatisticamente perdendo: freio de ruína, direto pro piso.
      result = { scale: floor.scale, tierLabel: floor.label, n: stats.n, meanR: stats.meanR, ciLow: stats.ciLow, ciHigh: stats.ciHigh, reason: `IC95 superior de E[R] < 0 (${stats.ciHigh.toFixed(2)}) -- perdendo, piso ${floor.scale}x` };
    } else {
      // Maior degrau cujos requisitos (amostra + IC95 inferior) a janela atual satisfaz.
      let chosen = floor;
      for (const t of RISK_TIERS) {
        if (stats.n >= t.minN && stats.ciLow > t.minCiLow) chosen = t;
      }
      result = { scale: chosen.scale, tierLabel: chosen.label, n: stats.n, meanR: stats.meanR, ciLow: stats.ciLow, ciHigh: stats.ciHigh, reason: `E[R] ${stats.meanR.toFixed(2)}R (IC95 ${stats.ciLow.toFixed(2)} a ${stats.ciHigh.toFixed(2)}, n=${stats.n}) -- degrau ${chosen.scale}x` };
    }
  } catch (err) {
    result = { scale: floor.scale, tierLabel: floor.label, n: 0, meanR: 0, ciLow: 0, ciHigh: 0, reason: `falha ao medir E[R] (${err instanceof Error ? err.message : err}) -- piso ${floor.scale}x por segurança` };
  }
  cache = { at: Date.now(), result };
  console.log(`[RISK-SCALER] escala ${result.scale}x | ${result.reason}`);
  return result;
}
