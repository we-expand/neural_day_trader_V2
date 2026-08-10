/**
 * Validação determinística do detector de revenge trading (Bloco D do
 * cérebro cognitivo, `research/AI_COGNITIVE_SPEC.md`).
 *
 * Roda com: npx esbuild src/app/services/risk/__validate__revenge__.ts --bundle --platform=node --outfile=/tmp/validate-revenge.js && node /tmp/validate-revenge.js
 */
import { detectRevengePattern, type ClosedTradeForDetector } from './RevengeTradingDetector';

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

const HOUR = 3_600_000;

function normalHistory(n: number, startMs: number, tradeDurationMs: number, gapMs: number, profit: number): ClosedTradeForDetector[] {
  const out: ClosedTradeForDetector[] = [];
  let t = startMs;
  for (let i = 0; i < n; i++) {
    const open = t;
    const close = open + tradeDurationMs;
    out.push({ amount: 1, currentProfit: profit, timestamp: open, closedAt: close });
    t = close + gapMs;
  }
  return out;
}

// ─── Amostra insuficiente: nunca sinaliza sem dado ──────────────────────────
{
  const history = normalHistory(4, 0, HOUR, HOUR, 10);
  const r = detectRevengePattern(history, { sizePercent: 100, timestamp: 100 * HOUR });
  assertTrue('n=4 < mínimo -> flagged=false, sem opinião', r.flagged === false && r.severity === 'NONE');
}

// ─── Histórico normal (sem perda recente, cadência estável) -> não sinaliza ─
{
  const history = normalHistory(10, 0, HOUR, HOUR, 10); // todos lucrativos
  const r = detectRevengePattern(history, { sizePercent: 1, timestamp: history[history.length - 1].closedAt! + HOUR });
  assertTrue('todos vencedores, tamanho normal, intervalo normal -> não sinaliza', r.flagged === false);
}

// ─── Sinal 1 isolado: escalada de tamanho após perda ────────────────────────
{
  const history = normalHistory(9, 0, HOUR, HOUR, 10); // 9 trades vencedores, tamanho 1
  const lastClose = history[history.length - 1].closedAt!;
  history.push({ amount: 1, currentProfit: -5, timestamp: lastClose + HOUR, closedAt: lastClose + 2 * HOUR }); // 10º: perda
  const proposedTime = history[history.length - 1].closedAt! + HOUR; // intervalo normal, não dispara sinal 2
  const r = detectRevengePattern(history, { sizePercent: 3, timestamp: proposedTime }); // 3x a baseline (1)
  assertTrue('escalada de tamanho (3x baseline) após perda -> sinaliza SIZE_ESCALATION', r.signals.includes('SIZE_ESCALATION'));
  assertTrue('só 1 sinal -> severidade ALERT', r.severity === 'ALERT');
}

// ─── Sinal 2 isolado: pressa após perda ─────────────────────────────────────
{
  const history = normalHistory(9, 0, HOUR, HOUR, 10);
  const lastClose = history[history.length - 1].closedAt!;
  history.push({ amount: 1, currentProfit: -5, timestamp: lastClose + HOUR, closedAt: lastClose + 2 * HOUR });
  const rushedTime = history[history.length - 1].closedAt! + 60_000; // 1min depois, vs. intervalo típico de 1h
  const r = detectRevengePattern(history, { sizePercent: 1, timestamp: rushedTime }); // tamanho normal, não dispara sinal 1
  assertTrue('entrada 1min após perda, vs. intervalo típico de 1h -> sinaliza RUSHED_ENTRY', r.signals.includes('RUSHED_ENTRY'));
  assertTrue('só 1 sinal -> severidade ALERT', r.severity === 'ALERT');
}

// ─── Sinal 3 isolado: sequência de perdas + frequência acelerada ───────────
{
  // Baseline: 10 trades espaçados de 2h cada (cadência ~0,5/h)
  const history = normalHistory(6, 0, HOUR, 2 * HOUR, 10); // 6 vencedores, cadência normal
  let t = history[history.length - 1].closedAt!;
  // 4 perdas seguidas, MUITO mais rápido que a baseline (10min de gap em vez de 2h)
  for (let i = 0; i < 4; i++) {
    const open = t + 600_000; // 10min
    const close = open + 60_000;
    history.push({ amount: 1, currentProfit: -5, timestamp: open, closedAt: close });
    t = close;
  }
  const r = detectRevengePattern(history, { sizePercent: 1, timestamp: t + 3 * HOUR }); // intervalo final normal, não dispara sinal 2
  assertTrue('4 perdas seguidas + cadência muito acima da baseline -> sinaliza LOSS_STREAK_WITH_FREQUENCY_SPIKE', r.signals.includes('LOSS_STREAK_WITH_FREQUENCY_SPIKE'));
}

// ─── Combinação: 2 sinais simultâneos -> REQUIRE_CONFIRMATION ──────────────
{
  const history = normalHistory(9, 0, HOUR, HOUR, 10);
  const lastClose = history[history.length - 1].closedAt!;
  history.push({ amount: 1, currentProfit: -5, timestamp: lastClose + HOUR, closedAt: lastClose + 2 * HOUR });
  const proposedTime = history[history.length - 1].closedAt! + 60_000; // pressa
  const r = detectRevengePattern(history, { sizePercent: 3, timestamp: proposedTime }); // tamanho + pressa
  assertTrue('escalada de tamanho + pressa simultâneos -> 2 sinais', r.signals.length === 2);
  assertTrue('2 sinais -> severidade REQUIRE_CONFIRMATION', r.severity === 'REQUIRE_CONFIRMATION');
}

// ─── Último trade vencedor -> sinais 1 e 2 (condicionais a perda) não disparam ─
{
  const history = normalHistory(9, 0, HOUR, HOUR, 10);
  const lastClose = history[history.length - 1].closedAt!;
  history.push({ amount: 1, currentProfit: +5, timestamp: lastClose + HOUR, closedAt: lastClose + 2 * HOUR }); // vitória, não perda
  const r = detectRevengePattern(history, { sizePercent: 5, timestamp: history[history.length - 1].closedAt! + 1000 }); // tamanho grande + pressa, mas SEM perda antes
  assertTrue('tamanho grande + entrada rápida, mas ÚLTIMO TRADE FOI VITÓRIA -> não sinaliza escalada nem pressa', !r.signals.includes('SIZE_ESCALATION') && !r.signals.includes('RUSHED_ENTRY'));
}

// ─── Reasoning nunca vazio quando flagged, e vazio-informativo quando não ──
{
  const history = normalHistory(10, 0, HOUR, HOUR, 10);
  const r = detectRevengePattern(history, { sizePercent: 1, timestamp: history[history.length - 1].closedAt! + HOUR });
  assertTrue('não sinalizado -> reasoning ainda informativo, não vazio', r.reasoning.length > 0 && !r.flagged);
}

console.log(`\n${passed} passaram, ${failed} falharam.`);
if (failed > 0) process.exit(1);
