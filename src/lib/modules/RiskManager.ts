/**
 * Módulo 2: Logic & Risk (RiskManager)
 * Responsável por validar se um trade é seguro antes da execução.
 *
 * Fase 1: Daily Loss Limit, Drawdown, Position Sizing, Cooldown, Max Trades/Day, Kill-Switch
 */

export interface RiskConfig {
  maxDailyLossPercent: number;      // ex: 5.0 (perda máxima de 5% do capital inicial do dia)
  maxDrawdownPercent: number;       // ex: 15.0 (drawdown máximo 15%)
  maxPositionSizePercent: number;   // ex: 5.0 (5% da banca por posição)
  kellyFraction: number;             // ex: 0.5 (Meio Kelly)
  cooldownEnabled?: boolean;         // pausa automática pós-perdas
  cooldownMinutes?: number;          // minutos de pausa
  maxTradesPerDay?: number;          // limite de trades/dia (0 = sem limite)
  killSwitchThreshold?: number;      // % perda que ativa kill-switch automático (ex: 10.0)
}

export interface AccountState {
  balance: number;                   // saldo atual
  initialBalance: number;            // saldo inicial da sessão (ou do dia)
  dailyStartBalance: number;         // saldo no início do dia UTC
  currentDrawdown: number;           // drawdown atual (%)
  openPositionsCount: number;        // número de posições abertas
}

export interface DailyStats {
  closedTradesCount: number;        // trades fechados hoje
  realizedPnL: number;              // lucro/perda realizado hoje
  unrealizedPnL: number;            // lucro/perda não-realizado (posições abertas)
  largestLoss: number;              // maior perda em um trade hoje
  consecutiveLosses: number;        // perdas seguidas
}

export class RiskManager {
  private config: RiskConfig;

  constructor(config: RiskConfig) {
    this.config = config;
  }

  /**
   * Valida se um novo trade é permitido (gateway único antes de qualquer entrada).
   * Retorna { approved: true } ou { approved: false, reason: "..." }
   */
  public validateTrade(
    account: AccountState,
    proposedTradeSize: number,
    dailyStats: DailyStats
  ): { approved: boolean; reason?: string } {
    // 1. Daily Loss Limit — bloqueia se perdeu X% do capital inicial do dia
    const dailyLoss = account.dailyStartBalance - account.balance;
    const dailyLossPercent = (dailyLoss / account.dailyStartBalance) * 100;

    if (dailyLoss > 0 && dailyLossPercent >= this.config.maxDailyLossPercent) {
      return {
        approved: false,
        reason: `Limite diário de perda atingido: -${dailyLossPercent.toFixed(2)}% (limite ${this.config.maxDailyLossPercent}%)`
      };
    }

    // 2. Drawdown Check — bloqueia se drawdown > limite
    if (account.currentDrawdown > this.config.maxDrawdownPercent) {
      return {
        approved: false,
        reason: `Drawdown excedido: ${account.currentDrawdown.toFixed(2)}% (limite ${this.config.maxDrawdownPercent}%)`
      };
    }

    // 3. Position Sizing — valida tamanho da posição proposta
    const maxTradeSize = account.balance * (this.config.maxPositionSizePercent / 100);
    if (proposedTradeSize > maxTradeSize) {
      return {
        approved: false,
        reason: `Tamanho da posição excede limite: ${proposedTradeSize.toFixed(2)} > ${maxTradeSize.toFixed(2)} (max ${this.config.maxPositionSizePercent}%)`
      };
    }

    return { approved: true };
  }

  /**
   * Calcula Kelly Criterion para position sizing dinâmico.
   */
  public calculateKellyPosition(winRate: number, rewardRiskRatio: number, bankroll: number): number {
    // Fórmula de Kelly: f = (bp - q) / b
    // onde b = reward ratio, p = prob vitória, q = prob derrota
    const p = winRate / 100; // converter % para decimal
    const q = 1 - p;
    const b = rewardRiskRatio;

    let kellyPct = (b * p - q) / b;

    // Kelly Fracionário para segurança
    kellyPct = kellyPct * this.config.kellyFraction;

    // Nunca arriscar mais que o limite configurado
    const maxSafePct = this.config.maxPositionSizePercent / 100;

    return bankroll * Math.min(Math.max(kellyPct, 0), maxSafePct);
  }

  /**
   * Calcula tamanho da posição baseado em ATR (volatilidade).
   * Quanto maior a volatilidade, menor a posição (risco fixo).
   */
  public calculateAtrPositionSize(
    bankroll: number,
    entryPrice: number,
    atrValue: number,
    riskPercent: number = 1.0 // risco de 1% do bankroll por trade
  ): number {
    if (atrValue <= 0 || entryPrice <= 0) return 0;

    // Risco máximo em dólares = 1% do bankroll
    const maxRiskDollars = bankroll * (riskPercent / 100);

    // Stop Loss = ATR (em pontos) → converter pra $ por contrato
    // Tamanho = Risco / (SL em $)
    const positionSize = maxRiskDollars / atrValue;

    // Capetar em 5% do bankroll (segurança)
    const maxPositionDollars = bankroll * (this.config.maxPositionSizePercent / 100);

    return Math.min(positionSize, maxPositionDollars / entryPrice);
  }

  /**
   * Valida se o kill-switch deve ser ativado (perda catastrófica).
   * Tópico 6: Kill-Switch automático por loss crítico.
   */
  public shouldActivateKillSwitch(account: AccountState): { triggered: boolean; reason?: string } {
    if (!this.config.killSwitchThreshold || this.config.killSwitchThreshold <= 0) {
      return { triggered: false };
    }

    const dailyLoss = account.dailyStartBalance - account.balance;
    const dailyLossPercent = (dailyLoss / account.dailyStartBalance) * 100;

    if (dailyLoss > 0 && dailyLossPercent >= this.config.killSwitchThreshold) {
      return {
        triggered: true,
        reason: `Kill-Switch ativado: perda diária ${dailyLossPercent.toFixed(2)}% ≥ limite de ${this.config.killSwitchThreshold}%`
      };
    }

    // Também ativa se drawdown for crítico (ex: 20%)
    if (account.currentDrawdown >= this.config.killSwitchThreshold) {
      return {
        triggered: true,
        reason: `Kill-Switch ativado: drawdown ${account.currentDrawdown.toFixed(2)}% ≥ limite de ${this.config.killSwitchThreshold}%`
      };
    }

    return { triggered: false };
  }

  /**
   * Valida múltiplos tópicos de risco em uma única passada (utilitário).
   */
  public validateAllRisks(
    account: AccountState,
    proposedTradeSize: number,
    dailyStats: DailyStats,
    currentTradesCount?: number
  ): { approved: boolean; reason?: string; killSwitchTriggered?: boolean } {
    // 1. Kill-Switch (crítico — pára tudo)
    const killSwitchCheck = this.shouldActivateKillSwitch(account);
    if (killSwitchCheck.triggered) {
      return {
        approved: false,
        reason: killSwitchCheck.reason,
        killSwitchTriggered: true
      };
    }

    // 2. Validação padrão (daily loss, drawdown, position size)
    return this.validateTrade(account, proposedTradeSize, dailyStats);
  }
}