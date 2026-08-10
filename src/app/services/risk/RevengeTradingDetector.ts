/**
 * REVENGE TRADING DETECTOR — Bloco D do cérebro cognitivo (research/AI_COGNITIVE_SPEC.md).
 * ============================================================================
 * Maior valor de produto do pedido original do Cleber, invertido: "a IA tem
 * que ter resiliência mental pra levar um stop e zerar a emoção" — mas a IA
 * não tem emoção. Quem faz revenge trading é o USUÁRIO, através da própria
 * configuração (aumentando tamanho, operando mais rápido, ignorando os
 * próprios limites depois de uma perda). Este módulo detecta o padrão
 * MECANICAMENTE, sobre a série real de trades — zero promessa de acurácia,
 * zero previsão de mercado, compatível com a decisão (B)
 * (`AI_BRAIN_SPEC.md` seção 14.5): é disciplina, não alfa.
 *
 * Três sinais, cada um mede uma faceta diferente do mesmo comportamento
 * (nunca dependem de log de decisão específico — só de `TradeVisual[]`, que
 * já existe e já é real):
 *
 * 1. ESCALADA DE TAMANHO — a posição proposta é desproporcionalmente maior
 *    que a baseline recente do PRÓPRIO usuário, logo depois de uma perda.
 *    "Baseline" é medida (mediana dos últimos N trades), nunca um valor
 *    absoluto arbitrário — o mesmo tamanho pode ser normal pra um usuário e
 *    escalada pra outro.
 * 2. PRESSA — intervalo entre o fechamento do último trade (perdedor) e a
 *    nova entrada, comparado ao intervalo típico do PRÓPRIO usuário (mediana
 *    histórica), não um limiar fixo em minutos.
 * 3. SEQUÊNCIA + FREQUÊNCIA — perdas consecutivas acima de um limiar E a
 *    cadência de trades na janela recente subiu em relação à baseline —
 *    "querer recuperar rápido" tem as duas assinaturas juntas; qualquer uma
 *    isolada pode ser normal (perdas consecutivas sozinhas já têm o
 *    cooldown pré-existente de `RiskManager`; frequência maior sozinha pode
 *    só ser um dia de mercado mais ativo).
 *
 * Severidade e ação (registrado, não necessariamente todo com UI pronta —
 * ver AI_COGNITIVE_SPEC.md pro que falta):
 *   ALERT               -> 1 sinal isolado: loga e notifica, não bloqueia.
 *   REQUIRE_CONFIRMATION -> 2 sinais simultâneos: precisa de confirmação
 *                           explícita do usuário antes de prosseguir (UI
 *                           ainda não construída — ver gap declarado).
 *   FORCE_COOLDOWN       -> 3 sinais simultâneos: bloqueia mecanicamente,
 *                           mesmo grau de certeza mecânica do kill-switch.
 */

export interface ClosedTradeForDetector {
  amount: number; // tamanho da posição (mesma unidade usada pela proposta)
  currentProfit?: number; // PnL realizado
  closedAt?: number; // epoch ms
  timestamp: number; // epoch ms de abertura
}

export interface ProposedTrade {
  sizePercent: number; // % do capital que esta nova entrada arrisca/aloca — mesma unidade da baseline
  timestamp: number; // epoch ms de agora
}

export type RevengeSignal = 'SIZE_ESCALATION' | 'RUSHED_ENTRY' | 'LOSS_STREAK_WITH_FREQUENCY_SPIKE';

export interface RevengeDetectionResult {
  flagged: boolean;
  signals: RevengeSignal[];
  severity: 'NONE' | 'ALERT' | 'REQUIRE_CONFIRMATION' | 'FORCE_COOLDOWN';
  reasoning: string;
  /** Amostra usada para medir a baseline do próprio usuário — abaixo do
   *  mínimo, o detector nunca sinaliza (não fabrica "normal" sem dado). */
  baselineSampleSize: number;
}

const MIN_BASELINE_SAMPLE = 5;
const SIZE_ESCALATION_MULTIPLIER = 1.75; // posição >= 1,75x a mediana recente
const RUSHED_ENTRY_RATIO = 0.3; // intervalo <= 30% da mediana histórica do próprio usuário
const LOSS_STREAK_THRESHOLD = 3;
const FREQUENCY_SPIKE_MULTIPLIER = 1.5; // cadência recente >= 1,5x a baseline

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Detecta padrão de revenge trading comparando a entrada PROPOSTA contra a
 * baseline mecânica do próprio usuário, medida sobre `history` (mais antigo
 * primeiro OU mais recente primeiro — a função ordena por `closedAt`
 * internamente, não assume ordem do chamador).
 *
 * Só considera trades FECHADOS (`closedAt` definido) — trade ainda aberto não
 * participa da baseline nem da sequência de perdas.
 */
export function detectRevengePattern(history: ClosedTradeForDetector[], proposed: ProposedTrade): RevengeDetectionResult {
  const closed = history.filter(t => t.closedAt !== undefined).sort((a, b) => (a.closedAt! - b.closedAt!));

  if (closed.length < MIN_BASELINE_SAMPLE) {
    return {
      flagged: false, signals: [], severity: 'NONE',
      reasoning: `Amostra insuficiente (${closed.length} trades fechados < ${MIN_BASELINE_SAMPLE}) para medir baseline do usuário — detector não se pronuncia, nunca assume "normal" sem dado.`,
      baselineSampleSize: closed.length,
    };
  }

  const lastTrade = closed[closed.length - 1];
  const lastTradeWasLoss = (lastTrade.currentProfit ?? 0) < 0;
  const signals: RevengeSignal[] = [];

  // ── Sinal 1: escalada de tamanho, condicional a ter acabado de perder ──
  const sizeBaseline = median(closed.map(t => t.amount));
  if (lastTradeWasLoss && sizeBaseline > 0 && proposed.sizePercent >= sizeBaseline * SIZE_ESCALATION_MULTIPLIER) {
    signals.push('SIZE_ESCALATION');
  }

  // ── Sinal 2: pressa — intervalo desde o fechamento do último trade ──
  const intervals: number[] = [];
  for (let i = 1; i < closed.length; i++) {
    const gap = closed[i].timestamp - closed[i - 1].closedAt!;
    if (gap > 0) intervals.push(gap);
  }
  const intervalBaseline = median(intervals);
  const gapSinceLastClose = proposed.timestamp - (lastTrade.closedAt ?? proposed.timestamp);
  if (lastTradeWasLoss && intervalBaseline > 0 && gapSinceLastClose <= intervalBaseline * RUSHED_ENTRY_RATIO) {
    signals.push('RUSHED_ENTRY');
  }

  // ── Sinal 3: sequência de perdas + cadência recente acima da baseline ──
  let consecutiveLosses = 0;
  for (let i = closed.length - 1; i >= 0; i--) {
    if ((closed[i].currentProfit ?? 0) < 0) consecutiveLosses++;
    else break;
  }
  if (consecutiveLosses >= LOSS_STREAK_THRESHOLD) {
    // Cadência recente = trades/hora nos últimos LOSS_STREAK_THRESHOLD+2 fechamentos,
    // vs. baseline = trades/hora ao longo de todo o histórico disponível.
    const recentWindow = closed.slice(-Math.min(closed.length, LOSS_STREAK_THRESHOLD + 2));
    const recentSpanMs = recentWindow[recentWindow.length - 1].closedAt! - recentWindow[0].timestamp;
    const recentRate = recentSpanMs > 0 ? recentWindow.length / (recentSpanMs / 3_600_000) : 0;

    const fullSpanMs = closed[closed.length - 1].closedAt! - closed[0].timestamp;
    const baselineRate = fullSpanMs > 0 ? closed.length / (fullSpanMs / 3_600_000) : 0;

    if (baselineRate > 0 && recentRate >= baselineRate * FREQUENCY_SPIKE_MULTIPLIER) {
      signals.push('LOSS_STREAK_WITH_FREQUENCY_SPIKE');
    }
  }

  const severity: RevengeDetectionResult['severity'] =
    signals.length >= 3 ? 'FORCE_COOLDOWN' :
    signals.length === 2 ? 'REQUIRE_CONFIRMATION' :
    signals.length === 1 ? 'ALERT' : 'NONE';

  const reasoningParts: string[] = [];
  if (signals.includes('SIZE_ESCALATION')) reasoningParts.push(`tamanho proposto (${proposed.sizePercent.toFixed(2)}) >= ${SIZE_ESCALATION_MULTIPLIER}x a baseline (${sizeBaseline.toFixed(2)}) logo após perda`);
  if (signals.includes('RUSHED_ENTRY')) reasoningParts.push(`entrada ${Math.round(gapSinceLastClose / 1000)}s após fechar no prejuízo, vs. intervalo típico de ${Math.round(intervalBaseline / 1000)}s`);
  if (signals.includes('LOSS_STREAK_WITH_FREQUENCY_SPIKE')) reasoningParts.push(`${consecutiveLosses} perdas seguidas + cadência recente acima da baseline do usuário`);

  return {
    flagged: signals.length > 0,
    signals,
    severity,
    reasoning: reasoningParts.length ? reasoningParts.join('; ') : 'Nenhum sinal de revenge trading detectado.',
    baselineSampleSize: closed.length,
  };
}
