/**
 * 🆕 2026-10-15 — Guarda-costas da ordem MANUAL (ideia 1 da sessão de 15/10).
 *
 * Confere a ordem que o usuário vai mandar pela boleta contra as regras de
 * risco e contra as regras do próprio método (METODO_DA_CASA.md) ANTES de ela
 * sair. Não tenta prever o mercado: só impede o usuário de quebrar as regras
 * dele. Motivo medido: a maior perda do projeto em setembro (-$458 na semana
 * de 21/09) veio de ordens manuais, não da IA.
 *
 * BLOQUEIO = a ordem não sai (hoje só o limite de perda diária).
 * ALERTA   = a ordem só sai com uma segunda confirmação explícita do usuário.
 *
 * Toda verificação fica registrada em `manual_order_guard_log` (ver
 * supabase/migrations/20261015_manual_order_guard_log.sql) — é o dado que
 * vai responder "as entradas manuais têm vantagem?" (ideia 5).
 */
import type { CandleData } from '../market-service';

export type GuardSeverity = 'BLOQUEIO' | 'ALERTA';
export interface GuardFinding {
  id: string;
  severity: GuardSeverity;
  text: string;
}

export interface StochReading {
  tf: '5m' | '1H';
  k: number;
  d: number;
}

export interface GuardInput {
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  riskPercent: number | null;
  maxRiskPercent: number;
  /** custo de ida e volta estimado em US$ (spread + comissão) */
  costUsd: number;
  /** ganho BRUTO até o alvo em US$ (antes do custo); null sem alvo */
  grossRewardUsd: number | null;
  balance: number;
  /** P&L realizado hoje (BRT), em US$ */
  dailyPnl: number;
  dailyLossLimitPct: number;
  openPositions: { symbol: string; side: 'LONG' | 'SHORT' }[];
  /** leituras do estocástico lento 5,3,3; vazio quando não deu pra ler (sem dado real) */
  stoch: StochReading[];
  stochUnavailable: boolean;
  now: Date;
}

// Spread medido na Infinox (market_spread_samples, 05-15/10/2026, dias úteis):
// horas BRT em que o spread mediano sobe X vezes em relação ao resto do dia.
// Fonte: SESSAO_2026-10-14_AFROUXAMENTO_DA_MESA_E_METODO_DA_CASA.md, Parte 5.
const EXPENSIVE_HOURS_BRT: Record<string, { hours: number[]; factor: string }> = {
  GER40: { hours: [17, 18, 19, 20], factor: '8x' },
  UK100: { hours: [17, 18, 19, 20], factor: '10x' },
  AUS200: { hours: [17, 18, 19], factor: '6x' },
  HKG33: { hours: [16, 17, 18, 19, 20, 21], factor: '2x' },
  JPN225: { hours: [18, 19], factor: '2-3x' },
  SPX500: { hours: [18], factor: '2,5x' },
  EURUSD: { hours: [18], factor: '2,7x' },
};

/** Fração do alvo bruto que o custo pode comer antes de virar alerta. */
const COST_SHARE_ALERT = 0.2;

function brtHour(d: Date): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(d));
}

export function evaluateManualOrder(input: GuardInput): GuardFinding[] {
  const out: GuardFinding[] = [];
  const isLong = input.side === 'LONG';

  // 1. Limite de perda diária — único BLOQUEIO. Base = saldo no começo do dia.
  const startBalance = input.balance - input.dailyPnl;
  if (input.dailyPnl < 0 && startBalance > 0 && input.dailyLossLimitPct > 0) {
    const lostPct = (-input.dailyPnl / startBalance) * 100;
    if (lostPct >= input.dailyLossLimitPct) {
      out.push({
        id: 'PERDA_DIARIA',
        severity: 'BLOQUEIO',
        text: `Você já perdeu ${lostPct.toFixed(1)}% hoje (limite ${input.dailyLossLimitPct}%). A boleta fica travada até amanhã.`,
      });
    }
  }

  // 2. Sem stop.
  if (!(input.stopLoss && input.stopLoss > 0)) {
    out.push({ id: 'SEM_STOP', severity: 'ALERTA', text: 'Ordem sem stop: a perda não tem limite.' });
  }

  // 3. Risco acima do configurado.
  if (input.riskPercent != null && input.maxRiskPercent > 0 && input.riskPercent > input.maxRiskPercent) {
    out.push({
      id: 'RISCO_ACIMA',
      severity: 'ALERTA',
      text: `Risco de ${input.riskPercent.toFixed(1)}% do saldo, acima do seu limite de ${input.maxRiskPercent}% por operação.`,
    });
  }

  // 4. Posição oposta aberta no mesmo ativo (incidente do Stop Out de 09/09).
  const opposite = input.openPositions.filter((p) => p.symbol === input.symbol && p.side !== input.side).length;
  if (opposite > 0) {
    out.push({
      id: 'LADO_OPOSTO',
      severity: 'ALERTA',
      text: `Você já tem ${opposite} posição(ões) ${isLong ? 'vendida(s)' : 'comprada(s)'} em ${input.symbol}. Abrir o lado oposto só paga custo duas vezes.`,
    });
  }

  // 5. Estocástico — regras do método (nunca vende em sobrevenda / nunca compra
  //    em sobrecompra; contra o modo atual só depois de um novo cruzamento).
  for (const s of input.stoch) {
    if (!isLong && s.k <= 20) out.push({ id: `ESTOC_${s.tf}_SOBREVENDA`, severity: 'ALERTA', text: `Venda com o estocástico do ${s.tf} em sobrevenda (%K ${s.k.toFixed(0)}). Regra do método: nunca vender em sobrevenda.` });
    if (isLong && s.k >= 80) out.push({ id: `ESTOC_${s.tf}_SOBRECOMPRA`, severity: 'ALERTA', text: `Compra com o estocástico do ${s.tf} em sobrecompra (%K ${s.k.toFixed(0)}). Regra do método: nunca comprar em sobrecompra.` });
    if (!isLong && s.k > s.d) out.push({ id: `ESTOC_${s.tf}_MODO_COMPRA`, severity: 'ALERTA', text: `Estocástico do ${s.tf} em modo de compra (%K ${s.k.toFixed(0)} acima do %D ${s.d.toFixed(0)}). Regra 5: vender só depois de um novo cruzamento para baixo.` });
    if (isLong && s.k < s.d) out.push({ id: `ESTOC_${s.tf}_MODO_VENDA`, severity: 'ALERTA', text: `Estocástico do ${s.tf} em modo de venda (%K ${s.k.toFixed(0)} abaixo do %D ${s.d.toFixed(0)}). Regra 5: comprar só depois de um novo cruzamento para cima.` });
  }
  if (input.stochUnavailable) {
    out.push({ id: 'ESTOC_SEM_DADO', severity: 'ALERTA', text: 'Não deu para ler o estocástico agora (sem vela real). Confira no gráfico antes de enviar.' });
  }

  // 6. Custo comendo o alvo.
  if (input.grossRewardUsd != null && input.grossRewardUsd > 0 && input.costUsd > 0) {
    const share = input.costUsd / input.grossRewardUsd;
    if (share >= COST_SHARE_ALERT) {
      out.push({
        id: 'CUSTO_ALTO',
        severity: 'ALERTA',
        text: `O custo (spread + comissão, ~$${input.costUsd.toFixed(2)}) come ${(share * 100).toFixed(0)}% do seu alvo bruto.`,
      });
    }
  }

  // 7. Horário de spread caro (medido).
  const exp = EXPENSIVE_HOURS_BRT[input.symbol];
  const h = brtHour(input.now);
  if (exp && exp.hours.includes(h)) {
    out.push({ id: 'HORARIO_CARO', severity: 'ALERTA', text: `Às ${h}h (Brasília) o spread de ${input.symbol} costuma ficar ${exp.factor} maior que no resto do dia.` });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Estocástico lento 5,3,3 (o mesmo do MT5 do Cleber e do motor), lido de vela real.
// ---------------------------------------------------------------------------
function sma(xs: number[], n: number): number[] {
  const out: number[] = [];
  for (let i = n - 1; i < xs.length; i++) out.push(xs.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n);
  return out;
}

export function slowStochastic(candles: CandleData[], kPeriod = 5, slowing = 3, dPeriod = 3): { k: number; d: number } | null {
  if (candles.length < kPeriod + slowing + dPeriod) return null;
  const raw: number[] = [];
  for (let i = kPeriod - 1; i < candles.length; i++) {
    const w = candles.slice(i - kPeriod + 1, i + 1);
    const hi = Math.max(...w.map((c) => c.high));
    const lo = Math.min(...w.map((c) => c.low));
    raw.push(hi === lo ? 50 : ((candles[i].close - lo) / (hi - lo)) * 100);
  }
  const k = sma(raw, slowing);
  const d = sma(k, dPeriod);
  if (!k.length || !d.length) return null;
  return { k: k[k.length - 1], d: d[d.length - 1] };
}

/** Lê o estocástico de 5m e 1H com teto de tempo; nunca inventa leitura. */
export async function readStochastics(symbol: string, timeoutMs = 4000): Promise<{ readings: StochReading[]; unavailable: boolean }> {
  const withTimeout = <T,>(p: Promise<T>) =>
    Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs))]);
  // import dinâmico: mantém a regra pura (evaluateManualOrder) testável fora do navegador.
  const { fetchCandles } = await import('../market-service');
  const tfs: StochReading['tf'][] = ['5m', '1H'];
  const results = await Promise.all(
    tfs.map(async (tf) => {
      try {
        const candles = await withTimeout(fetchCandles(symbol, tf, 60));
        const st = candles && candles.length ? slowStochastic(candles) : null;
        return st ? { tf, ...st } : null;
      } catch {
        return null;
      }
    }),
  );
  const readings = results.filter((r): r is StochReading => r !== null);
  return { readings, unavailable: readings.length < tfs.length };
}

// ---------------------------------------------------------------------------
// Registro (best-effort: a falha de gravar NUNCA trava a ordem, mas aparece no console).
// ---------------------------------------------------------------------------
export type GuardDecision = 'BLOQUEADA' | 'CANCELADA' | 'ENVIADA_COM_ALERTA' | 'ENVIADA_LIMPA';

export async function logGuardDecision(entry: {
  symbol: string;
  side: 'LONG' | 'SHORT';
  orderType: string;
  executionMode: string;
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  volume: number;
  findings: GuardFinding[];
  decision: GuardDecision;
}): Promise<void> {
  try {
    const { supabase } = await import('@/lib/supabaseClient');
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { error } = await supabase.from('manual_order_guard_log').insert({
      user_id: data.user.id,
      symbol: entry.symbol,
      side: entry.side,
      order_type: entry.orderType,
      execution_mode: entry.executionMode,
      entry_price: entry.entryPrice,
      stop_loss: entry.stopLoss ?? null,
      take_profit: entry.takeProfit ?? null,
      volume: entry.volume,
      findings: entry.findings,
      decision: entry.decision,
    });
    if (error) console.warn('[manualOrderGuard] registro não gravado (migration aplicada?):', error.message);
  } catch (err) {
    console.warn('[manualOrderGuard] registro não gravado:', err);
  }
}
