/**
 * 🚨 BREAKOUT ALERT MANAGER
 * 
 * Gerencia alertas de rompimento em múltiplos canais:
 * - Notificações visuais (toast)
 * - Alertas de voz (Luna)
 * - Dashboard indicators
 * - Telegram/Email (futuro)
 * 
 * @version 1.0.0
 * @date 31 Janeiro 2026
 */

import { BreakoutDetector, BreakoutSignal, BreakoutStage } from './BreakoutDetector';
import { NexusAlertSystem } from './NexusAlertSystem';

// ============================================================================
// TYPES
// ============================================================================

interface BreakoutSubscriber {
  symbol: string;
  callback: (signal: BreakoutSignal) => void;
  minConfidence: number;
}

export interface BreakoutNotificationPreferences {
  enableVoiceAlerts: boolean;
  enableVisualAlerts: boolean;
  enableLunaProactive: boolean; // Luna fala proativamente
  minConfidenceForAlert: number; // 0-100
  alertStages: BreakoutStage[]; // Quais estágios alertar
}

// ============================================================================
// BREAKOUT ALERT MANAGER
// ============================================================================

class BreakoutAlertManagerClass {
  private subscribers: BreakoutSubscriber[] = [];
  private lastAlertTimestamp: Map<string, number> = new Map();
  private alertCooldown = 120000; // 2 minutos entre alertas do mesmo ativo
  
  private preferences: BreakoutNotificationPreferences = {
    enableVoiceAlerts: true,
    enableVisualAlerts: true,
    enableLunaProactive: true,
    minConfidenceForAlert: 60,
    alertStages: ['IMMINENT', 'CONFIRMED']
  };

  /**
   * Configura preferências de alerta
   */
  setPreferences(prefs: Partial<BreakoutNotificationPreferences>) {
    this.preferences = { ...this.preferences, ...prefs };
    console.log('[BreakoutAlert] Preferências atualizadas:', this.preferences);
  }

  /**
   * Subscreve para alertas de um ativo
   */
  subscribe(
    symbol: string,
    callback: (signal: BreakoutSignal) => void,
    minConfidence: number = 60
  ) {
    this.subscribers.push({ symbol, callback, minConfidence });
    console.log(`[BreakoutAlert] Nova inscrição: ${symbol} (confiança mín: ${minConfidence}%)`);
  }

  /**
   * Cancela subscrição
   */
  unsubscribe(symbol: string) {
    this.subscribers = this.subscribers.filter(s => s.symbol !== symbol);
  }

  /**
   * Processa novo sinal de breakout
   */
  processBreakoutSignal(signal: BreakoutSignal) {
    // Verificar se deve alertar
    if (!this.shouldAlert(signal)) {
      return;
    }

    console.log(`[BreakoutAlert] 🚀 Processando breakout ${signal.symbol}:`, {
      stage: signal.stage,
      type: signal.type,
      confidence: signal.confidence
    });

    // Registrar timestamp do alerta
    this.lastAlertTimestamp.set(signal.symbol, Date.now());

    // Enviar alertas
    if (this.preferences.enableVisualAlerts) {
      this.sendVisualAlert(signal);
    }

    if (this.preferences.enableVoiceAlerts) {
      this.sendVoiceAlert(signal);
    }

    if (this.preferences.enableLunaProactive) {
      this.sendLunaProactiveAlert(signal);
    }

    // Notificar subscribers
    this.notifySubscribers(signal);
  }

  /**
   * Verifica se deve alertar
   */
  private shouldAlert(signal: BreakoutSignal): boolean {
    // Verificar confiança mínima
    if (signal.confidence < this.preferences.minConfidenceForAlert) {
      return false;
    }

    // Verificar estágio
    if (!this.preferences.alertStages.includes(signal.stage)) {
      return false;
    }

    // Verificar cooldown
    const lastAlert = this.lastAlertTimestamp.get(signal.symbol);
    if (lastAlert && Date.now() - lastAlert < this.alertCooldown) {
      return false;
    }

    return true;
  }

  /**
   * Envia alerta visual
   */
  private sendVisualAlert(signal: BreakoutSignal) {
    const emoji = signal.type === 'BULLISH' ? '🚀' : '📉';
    const stageText = this.getStageText(signal.stage);
    const actionText = this.getActionText(signal.suggestedAction);

    NexusAlertSystem.sendAlert({
      type: 'opportunity',
      priority: signal.stage === 'CONFIRMED' ? 'high' : 'normal',
      title: `${emoji} BREAKOUT ${signal.type} - ${signal.symbol}`,
      message: `${stageText}\nConfiança: ${signal.confidence}%\nAção: ${actionText}\n\nEntry: ${signal.entryPrice.toFixed(2)} | SL: ${signal.stopLoss.toFixed(2)} | TP1: ${signal.takeProfit1.toFixed(2)}\nR:R = 1:${signal.riskRewardRatio.toFixed(1)}`,
      voiceMessage: this.generateVoiceMessage(signal)
    });
  }

  /**
   * Envia alerta de voz (via NexusAlertSystem)
   */
  private sendVoiceAlert(signal: BreakoutSignal) {
    // Já incluído no sendVisualAlert via voiceMessage
  }

  /**
   * Envia alerta proativo via Luna
   */
  private sendLunaProactiveAlert(signal: BreakoutSignal) {
    // Este método será chamado pela Luna quando ela verificar o contexto
    // Por enquanto, apenas logamos
    console.log('[BreakoutAlert] 🎤 Luna deve anunciar:', this.generateLunaMessage(signal));
  }

  /**
   * Notifica subscribers
   */
  private notifySubscribers(signal: BreakoutSignal) {
    this.subscribers
      .filter(s => 
        s.symbol === signal.symbol && 
        signal.confidence >= s.minConfidence
      )
      .forEach(s => {
        try {
          s.callback(signal);
        } catch (error) {
          console.error('[BreakoutAlert] Erro ao notificar subscriber:', error);
        }
      });
  }

  /**
   * Gera mensagem de voz
   */
  private generateVoiceMessage(signal: BreakoutSignal): string {
    const messages = {
      FORMING: [
        `Fique ligado! ${signal.symbol} está se aproximando de uma resistência importante em ${signal.keyLevel.toFixed(2)}. Volume começando a subir, confiança de ${signal.confidence} porcento.`,
        `${signal.symbol} testando área crítica de ${signal.keyLevel.toFixed(2)}. Se romper com volume, vai ser uma bela oportunidade. Preparado?`,
        `Movimento interessante formando em ${signal.symbol}. Preço atual ${signal.currentPrice.toFixed(2)}, resistência em ${signal.keyLevel.toFixed(2)}. Confiança ${signal.confidence} porcento.`
      ],
      IMMINENT: [
        `Atenção total! ${signal.symbol} a poucos pips de romper ${signal.keyLevel.toFixed(2)}. Volume institucional entrando forte, ${signal.volumeRatio.toFixed(1)} vezes acima da média. Confiança ${signal.confidence} porcento. Se posiciona!`,
        `Momento crítico em ${signal.symbol}! Preço em ${signal.currentPrice.toFixed(2)}, nível chave ${signal.keyLevel.toFixed(2)}. RSI em ${signal.rsi.toFixed(0)}, volume explodindo. Isso vai acontecer!`,
        `Alô alô! ${signal.symbol} prestes a decolar! Todos os indicadores convergindo para rompimento de ${signal.keyLevel.toFixed(2)}. Volume ${signal.volumeRatio.toFixed(1)}x, confiança ${signal.confidence} porcento. Preparado para entrar?`
      ],
      CONFIRMED: [
        `ROMPEU! ${signal.symbol} confirmou breakout ${signal.type === 'BULLISH' ? 'de alta' : 'de baixa'} em ${signal.keyLevel.toFixed(2)}! Volume explosivo de ${signal.volumeRatio.toFixed(1)} vezes. Entry em ${signal.entryPrice.toFixed(2)}, stop em ${signal.stopLoss.toFixed(2)}, target em ${signal.takeProfit1.toFixed(2)}. Risk reward de ${signal.riskRewardRatio.toFixed(1)} para um. VAI!`,
        `É AGORA! Breakout confirmado em ${signal.symbol}! Preço rompeu ${signal.keyLevel.toFixed(2)} com volume institucional massivo. Confiança máxima de ${signal.confidence} porcento. Setup completo: entry ${signal.entryPrice.toFixed(2)}, stop ${signal.stopLoss.toFixed(2)}, alvo ${signal.takeProfit1.toFixed(2)}. Executamos?`,
        `MOVIMENTO CONFIRMADO! ${signal.symbol} acabou de romper resistência histórica de ${signal.keyLevel.toFixed(2)}! Volume ${signal.volumeRatio.toFixed(1)}x acima da média, RSI em ${signal.rsi.toFixed(0)}, momentum fortíssimo. Entry ${signal.entryPrice.toFixed(2)}, stop ${signal.stopLoss.toFixed(2)}. Essa vai longe!`
      ],
      FAILED: [
        `Opa! Rompimento falhou em ${signal.symbol}. Preço recuou de ${signal.keyLevel.toFixed(2)}. Fica de fora por enquanto, espera nova confirmação.`,
        `Falso breakout em ${signal.symbol}. Não entrou? Ótimo! Quem entrou, sai fora. Aguarda nova oportunidade com sinais mais claros.`,
        `${signal.symbol} não confirmou. Sem problemas, é assim que protegemos capital. Próxima oportunidade vem melhor!`
      ]
    };

    const options = messages[signal.stage];
    return options[Math.floor(Math.random() * options.length)];
  }

  /**
   * Gera mensagem para Luna (mais contextual)
   */
  private generateLunaMessage(signal: BreakoutSignal): string {
    const personality = [
      // Estilo Trump/Trader confiante
      `Olha só o que eu peguei aqui... ${signal.symbol} vai dar um show. Tá tudo convergindo, volume institutional subindo, RSI marcando ${signal.rsi.toFixed(0)}. Confiança de ${signal.confidence}%? Isso é quase certeza. Entry em ${signal.entryPrice.toFixed(2)}, stop conservador em ${signal.stopLoss.toFixed(2)}. Risk reward de ${signal.riskRewardRatio.toFixed(1)} pra 1. Essas são as operações que fazem diferença no final do mês.`,
      
      `Parceiro, preciso te falar uma coisa URGENTE sobre ${signal.symbol}. Tô olhando o gráfico aqui e sinceramente... isso tá muito óbvio. Nível de ${signal.keyLevel.toFixed(2)} foi testado ${signal.stage === 'CONFIRMED' ? 'E ROMPIDO' : 'várias vezes'}. Volume institucional de ${signal.volumeRatio.toFixed(1)}x. Sabe o que isso significa? Smart money tá entrando. Entry ${signal.entryPrice.toFixed(2)}, target ${signal.takeProfit1.toFixed(2)}. Setup limpo, confiança ${signal.confidence}%. Vamos?`,
      
      `Cara, você precisa ver isso AGORA. ${signal.symbol} montou um setup que eu não via faz tempo. ${signal.stage === 'CONFIRMED' ? 'Já rompeu' : 'Prestes a romper'} ${signal.keyLevel.toFixed(2)} com volume de ${signal.volumeRatio.toFixed(1)} vezes a média. RSI perfeito em ${signal.rsi.toFixed(0)}, momentum ${signal.momentum}. Isso aqui tem tudo pra ser aquela operação que você conta pros amigos. Entry ${signal.entryPrice.toFixed(2)}, stop ${signal.stopLoss.toFixed(2)}, primeiro alvo ${signal.takeProfit1.toFixed(2)}. Risk reward EXCELENTE de ${signal.riskRewardRatio.toFixed(1)}:1. Executamos ou não?`
    ];

    return personality[Math.floor(Math.random() * personality.length)];
  }

  /**
   * Textos auxiliares
   */
  private getStageText(stage: BreakoutStage): string {
    const texts = {
      FORMING: '🔄 Setup Formando',
      IMMINENT: '⚡ Iminente!',
      CONFIRMED: '✅ CONFIRMADO',
      FAILED: '❌ Falhou'
    };
    return texts[stage];
  }

  private getActionText(action: string): string {
    const texts = {
      PREPARE: '🎯 Prepare-se',
      ENTER: '🚀 ENTRE AGORA',
      WAIT: '⏳ Aguarde',
      AVOID: '🚫 Evite'
    };
    return texts[action] || action;
  }

  /**
   * Obtém sinais ativos de um ativo
   */
  getActiveSignals(symbol: string): BreakoutSignal[] {
    return BreakoutDetector.getRecentSignals(symbol);
  }

  /**
   * Limpa sinais expirados (chamar periodicamente)
   */
  cleanUp() {
    BreakoutDetector.cleanExpiredSignals();
    
    // Limpar timestamps antigos
    const now = Date.now();
    this.lastAlertTimestamp.forEach((timestamp, symbol) => {
      if (now - timestamp > 3600000) { // 1 hora
        this.lastAlertTimestamp.delete(symbol);
      }
    });
  }
}

// ============================================================================
// EXPORT SINGLETON
// ============================================================================

export const BreakoutAlertManager = new BreakoutAlertManagerClass();
