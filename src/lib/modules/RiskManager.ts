/**
 * Módulo 2: Logic & Risk (RiskManager)
 * Responsável por validar se um trade é seguro antes da execução.
 */

export interface RiskConfig {
  maxDailyDrawdownPercent: number; // ex: 3.0 (3%)
  maxPositionSizePercent: number;  // ex: 5.0 (5% da banca)
  kellyFraction: number;           // ex: 0.5 (Meio Kelly)
}

export interface AccountState {
  balance: number;
  dailyStartBalance: number;
  currentDrawdown: number;
  openPositionsCount: number;
}

export class RiskManager {
  private config: RiskConfig;

  constructor(config: RiskConfig) {
    this.config = config;
  }

  public validateTrade(account: AccountState, proposedTradeSize: number): { approved: boolean; reason?: string } {
    // 1. Verificar Drawdown Diário
    const currentDrawdownPercent = (account.dailyStartBalance - account.balance) / account.dailyStartBalance * 100;
    
    // Se já estamos perdendo mais que o permitido, bloqueia novos trades
    // Nota: Se estamos lucrando (balance > start), drawdown é negativo (seguro)
    if (account.balance < account.dailyStartBalance && currentDrawdownPercent > this.config.maxDailyDrawdownPercent) {
      return { 
        approved: false, 
        reason: `Risco Crítico: Drawdown diário excedeu ${this.config.maxDailyDrawdownPercent}%` 
      };
    }

    // 2. Verificar Tamanho da Posição (Position Sizing)
    const maxTradeSize = account.balance * (this.config.maxPositionSizePercent / 100);
    if (proposedTradeSize > maxTradeSize) {
      return { 
        approved: false, 
        reason: `Gerenciamento de Risco: Tamanho da posição excede limite de ${this.config.maxPositionSizePercent}% da banca` 
      };
    }

    return { approved: true };
  }

  public calculateKellyPosition(winRate: number, rewardRiskRatio: number, bankroll: number): number {
    // Fórmula de Kelly: f = (bp - q) / b
    // onde b = odds recebidas (reward), p = prob de vitória, q = prob de derrota (1-p)
    const p = winRate;
    const q = 1 - p;
    const b = rewardRiskRatio;

    let kellyPct = (b * p - q) / b;
    
    // Aplicar Kelly Fracionário para segurança
    kellyPct = kellyPct * this.config.kellyFraction;

    // Nunca arriscar mais que o limite hardcoded de segurança (ex: 5%)
    const maxSafePct = this.config.maxPositionSizePercent / 100;
    
    return bankroll * Math.min(Math.max(kellyPct, 0), maxSafePct);
  }
}