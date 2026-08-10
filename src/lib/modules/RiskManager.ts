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
   *
   * ⚠️ Achado de auditoria (2026-07-31, `research/AI_COGNITIVE_SPEC.md` Bloco C):
   * este método é CÓDIGO MORTO — nenhum arquivo do projeto o chama. Além
   * disso, `winRate`/`rewardRiskRatio` são recebidos crus do chamador, sem
   * garantia de que vêm de dado MEDIDO (viola a regra de nunca fabricar
   * número apresentado como real). Preferir
   * `src/app/services/risk/ExpectancyEngine.ts` → `computeHonestKelly()`,
   * que exige um `ExpectancyResult` de `computeExpectancy()` (medido sobre
   * trades reais, com intervalo de confiança e guarda de amostra pequena) em
   * vez de aceitar winRate/payoff soltos. Mantido aqui sem remoção — pode ter
   * consumidor futuro fora do caminho crítico — mas não usar em código novo.
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

// ─────────────────────────────────────────────────────────────────────────
// TAREFA 3 (2026-07-31, RISK_MODULE_SPEC.md seção 3.3/3.4): extraídas como
// funções puras testáveis a lógica de cooldown pós-perdas-consecutivas e o
// limite rígido de trades/dia que já estava inline em `useApexLogic.ts`
// (achado ao ler o código antes de implementar — a lógica de enforcement já
// existia lá, só faltavam as funções puras + as asserções determinísticas
// pedidas). `useApexLogic.ts` foi atualizado pra chamar estas funções em vez
// de reimplementar a mesma conta inline, sem mudar o comportamento.
// ─────────────────────────────────────────────────────────────────────────

export interface CooldownGateConfig {
  cooldownEnabled: boolean;
  consecutiveLossesTrigger: number;
  cooldownMinutes: number;
}

export interface CooldownGateResult {
  blocked: boolean;
  reason?: string;
  /** Novo timestamp de expiração do cooldown, só presente quando o cooldown é ATIVADO por esta chamada (perdas consecutivas atingiram o gatilho agora). */
  newCooldownUntil?: number;
}

/**
 * Decide se uma nova entrada deve ser bloqueada por cooldown pós-perdas
 * consecutivas. Função pura — não lê relógio nem estado global, recebe tudo
 * como parâmetro (testável sem mock de tempo).
 *
 * @param consecutiveLosses perdas seguidas contadas do fim do histórico real de trades pro trade vencedor mais recente (para no primeiro win).
 * @param now timestamp atual (ms).
 * @param cooldownUntil timestamp (ms) até quando o cooldown já ativo expira (0 = nenhum cooldown ativo ainda).
 */
export function evaluateCooldownGate(
  consecutiveLosses: number,
  now: number,
  cooldownUntil: number,
  config: CooldownGateConfig,
): CooldownGateResult {
  if (!config.cooldownEnabled) {
    return { blocked: false };
  }

  // Cooldown já ativo e ainda não expirou -> bloqueia sem recalcular.
  if (now < cooldownUntil) {
    const remainingMin = Math.ceil((cooldownUntil - now) / 60_000);
    return {
      blocked: true,
      reason: `Cooldown ativo — ${remainingMin}min restantes (${config.consecutiveLossesTrigger} perdas seguidas)`,
    };
  }

  // Cooldown expirado (ou nunca ativado) — checa se o gatilho de perdas consecutivas foi atingido agora.
  if (consecutiveLosses >= config.consecutiveLossesTrigger) {
    const newCooldownUntil = now + config.cooldownMinutes * 60_000;
    return {
      blocked: true,
      reason: `Cooldown recém-ativado: ${consecutiveLosses} perdas seguidas — bloqueando por ${config.cooldownMinutes}min`,
      newCooldownUntil,
    };
  }

  return { blocked: false };
}

export interface MaxTradesPerDayResult {
  blocked: boolean;
  reason?: string;
  tradesToday: number;
}

/**
 * Limite rígido de trades/dia. Função pura — `tradesTodayCount` já vem
 * calculado por quem chama (mesma janela "desde 00:00 UTC" usada pelo daily
 * loss limit do Health Check Guardian, ver `useApexLogic.ts`).
 */
export function evaluateMaxTradesPerDayGate(tradesTodayCount: number, maxTradesPerDay: number): MaxTradesPerDayResult {
  if (!(maxTradesPerDay > 0)) {
    return { blocked: false, tradesToday: tradesTodayCount };
  }
  if (tradesTodayCount >= maxTradesPerDay) {
    return {
      blocked: true,
      reason: `Limite de trades/dia atingido: ${tradesTodayCount}/${maxTradesPerDay}`,
      tradesToday: tradesTodayCount,
    };
  }
  return { blocked: false, tradesToday: tradesTodayCount };
}