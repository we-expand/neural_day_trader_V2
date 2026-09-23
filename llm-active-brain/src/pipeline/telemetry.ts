// Telemetria granular do pipeline, modo observacional (2026-09-23).
// Não decide nada -- só loga no formato [REJECTED]/[OK] pedido no plano,
// pra dar dado real pras 3 métricas que o Cleber pediu pra acompanhar
// (drop-off por fase, win rate vs payoff, estabilidade de risco em $)
// ANTES de trocar qualquer trava de verdade por score. Fase 3 (MACD/
// momentum/consenso/estocástico) continua sendo hard-block booleano,
// como está hoje -- só ganhou log, nenhuma regra mudou.

export type PipelinePhase = "Phase1-StateValidator" | "Phase2-RiskValidator" | "Phase3-TechnicalScoring" | "Phase4-LLMValidator";

export function logPipelineReject(phase: PipelinePhase, rule: string, symbol: string, detail: string): void {
  console.log(`[REJECTED] ${phase} - ${rule} - ${symbol} - ${detail}`);
}

export function logPipelineOk(phase: PipelinePhase, symbol: string, detail?: string): void {
  console.log(`[OK] ${phase} - ${symbol}${detail ? ` - ${detail}` : ""}`);
}
