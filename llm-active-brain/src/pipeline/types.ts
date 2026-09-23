// Arquitetura Pipeline (Chain of Responsibility) para validação de open_position.
// Teste novo, isolado do motor congelado em freeze-llm-brain-2026-09-22 --
// não plugado em index.ts/agent.ts ainda.

export type SetupType = "TREND" | "COUNTER" | "REVERSAO" | "LATERAL";

export interface RiskProfile {
  atr: number;
  vixLevel: string | null;
  maxRiskPercent: number;
}

export interface TradeContext {
  sessionId: string;
  symbol: string;
  direction: "LONG" | "SHORT";
  setupType: SetupType;
  tickData: {
    price: number;
    spreadPercent: number;
    ageSeconds: number;
  };
  indicators: Record<string, unknown>;
  technicalScore: number;
  scoreBreakdown: Record<string, number>;
  riskProfile: RiskProfile;
  llmReasoning?: string;
  llmConfidence?: number;
  rejected: boolean;
  rejectionReason?: string;
  rejectionPhase?: string;
}

export class ValidationRejectException extends Error {
  constructor(public phase: string, public rule: string, message: string) {
    super(message);
    this.name = "ValidationRejectException";
  }
}

export interface PipelineStage {
  name: string;
  execute(context: TradeContext): Promise<TradeContext>;
}
