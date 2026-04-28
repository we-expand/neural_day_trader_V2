import { toast } from 'sonner';

export type AlertPriority = 'low' | 'normal' | 'high' | 'critical';
export type AlertType = 'spoofing' | 'correlation' | 'tilt' | 'risk' | 'opportunity' | 'system';

export interface NexusAlert {
  id: string;
  type: AlertType;
  priority: AlertPriority;
  title: string;
  message: string;
  voiceMessage?: string;
  timestamp: number;
  requiresAction?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

interface AlertQueueItem {
  alert: NexusAlert;
  retries: number;
}

class NexusAlertSystemClass {
  private alertQueue: AlertQueueItem[] = [];
  private isProcessing = false;
  private alertHistory: NexusAlert[] = [];
  private maxHistorySize = 100;
  private speak: ((text: string, priority: 'low' | 'normal' | 'high') => void) | null = null;

  // Register the voice synthesis function
  registerVoiceSystem(speakFn: (text: string, priority: 'low' | 'normal' | 'high') => void) {
    this.speak = speakFn;
    console.log('[Nexus Alert System] Voice system registered');
  }

  // Generate unique alert ID
  private generateId(): string {
    return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get alert styling based on type
  private getAlertStyle(type: AlertType): { icon: string; color: string } {
    switch (type) {
      case 'spoofing':
        return { icon: '⚠️', color: 'bg-rose-500' };
      case 'correlation':
        return { icon: '🦋', color: 'bg-cyan-500' };
      case 'tilt':
        return { icon: '🚨', color: 'bg-red-600' };
      case 'risk':
        return { icon: '🛡️', color: 'bg-yellow-500' };
      case 'opportunity':
        return { icon: '✨', color: 'bg-emerald-500' };
      case 'system':
        return { icon: 'ℹ️', color: 'bg-blue-500' };
    }
  }

  // Priority to voice priority mapping
  private getPriorityLevel(priority: AlertPriority): 'low' | 'normal' | 'high' {
    if (priority === 'critical') return 'high';
    if (priority === 'high') return 'high';
    if (priority === 'normal') return 'normal';
    return 'low';
  }

  // Send alert (adds to queue)
  sendAlert(alert: Omit<NexusAlert, 'id' | 'timestamp'>): string {
    const fullAlert: NexusAlert = {
      ...alert,
      id: this.generateId(),
      timestamp: Date.now()
    };

    // Add to history
    this.alertHistory.unshift(fullAlert);
    if (this.alertHistory.length > this.maxHistorySize) {
      this.alertHistory = this.alertHistory.slice(0, this.maxHistorySize);
    }

    // Add to queue
    this.alertQueue.push({
      alert: fullAlert,
      retries: 0
    });

    // Start processing if not already
    if (!this.isProcessing) {
      this.processQueue();
    }

    console.log(`[Nexus Alert] ${fullAlert.type.toUpperCase()} - ${fullAlert.title}`, fullAlert);

    return fullAlert.id;
  }

  // Process alert queue
  private async processQueue() {
    if (this.alertQueue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const item = this.alertQueue.shift()!;
    const { alert } = item;

    try {
      // Display visual notification
      this.displayVisualAlert(alert);

      // Speak voice message if available and voice system is registered
      if (alert.voiceMessage && this.speak) {
        const priority = this.getPriorityLevel(alert.priority);
        this.speak(alert.voiceMessage, priority);
      }

      // Wait before processing next alert (to avoid overwhelming user)
      const delay = alert.priority === 'critical' ? 500 : 
                   alert.priority === 'high' ? 1000 : 
                   alert.priority === 'normal' ? 2000 : 3000;

      setTimeout(() => {
        this.processQueue();
      }, delay);

    } catch (error) {
      console.error('[Nexus Alert] Error processing alert:', error);
      
      // Retry logic for failed alerts
      if (item.retries < 3) {
        item.retries++;
        this.alertQueue.push(item);
      }
      
      this.processQueue();
    }
  }

  // Display visual notification using toast
  private displayVisualAlert(alert: NexusAlert) {
    const style = this.getAlertStyle(alert.type);
    
    // Create message with icon
    const message = `${style.icon} ${alert.title}\n${alert.message}`;

    if (alert.priority === 'critical') {
      toast.error(message, {
        duration: 10000,
        className: 'bg-gradient-to-r from-red-600 to-rose-600 border-2 border-red-400',
      });
    } else if (alert.priority === 'high') {
      toast.warning(message, {
        duration: 7000,
        className: 'bg-gradient-to-r from-yellow-600 to-amber-600 border-2 border-yellow-400',
      });
    } else if (alert.priority === 'normal') {
      toast.info(message, {
        duration: 5000,
        className: 'bg-gradient-to-r from-blue-600 to-cyan-600 border-2 border-blue-400',
      });
    } else {
      toast(message, {
        duration: 3000,
        className: 'bg-gradient-to-r from-slate-700 to-slate-800 border border-slate-600',
      });
    }
  }

  // Convenience methods for specific alert types

  alertSpoofing(price: number, type: 'buy' | 'sell', message: string) {
    this.sendAlert({
      type: 'spoofing',
      priority: 'high',
      title: 'SPOOFING DETECTADO',
      message: `${message} Preço afetado: ${price.toFixed(5)}`,
      voiceMessage: `Atenção! Rastreador de ordens fantasmas detectou spoofing. ${message}. Aguarde validação antes de operar.`
    });
  }

  alertCorrelation(leadAsset: string, targetSymbol: string, impact: 'bullish' | 'bearish', leadTime: number) {
    this.sendAlert({
      type: 'correlation',
      priority: 'high',
      title: 'CORRELAÇÃO BORBOLETA',
      message: `Movimento no ${leadAsset} detectado. Impacto ${impact === 'bullish' ? 'de alta' : 'de baixa'} em ${targetSymbol} previsto em ${leadTime} segundos.`,
      voiceMessage: `Correlação quântica detectada. Movimento no ${leadAsset} deve gerar ${impact === 'bullish' ? 'alta' : 'baixa'} em ${targetSymbol} em ${leadTime} segundos. Prepare-se.`
    });
  }

  alertTilt(stressLevel: number, action: 'pause' | 'reduce' | 'observe') {
    const actionMessage = 
      action === 'pause' ? 'Pausando operações por 10 minutos.' :
      action === 'reduce' ? 'Reduzindo tamanho de posição para modo conservador.' :
      'Modo apenas observação ativado.';

    this.sendAlert({
      type: 'tilt',
      priority: 'critical',
      title: 'ALERTA DE TILT EMOCIONAL',
      message: `Nível de estresse elevado (${stressLevel}%). ${actionMessage}`,
      voiceMessage: `Identifiquei estresse elevado no seu padrão vocal. Por segurança da sua conta Neural Day Trader, ${actionMessage} Respire fundo. Eu monitoro tudo aqui para você.`
    });
  }

  alertRisk(type: 'overleveraging' | 'drawdown' | 'stop_moved', details: string) {
    const titles = {
      overleveraging: 'ALERTA DE ALAVANCAGEM',
      drawdown: 'DRAWDOWN CRÍTICO',
      stop_moved: 'MODIFICAÇÃO DE STOP LOSS'
    };

    this.sendAlert({
      type: 'risk',
      priority: 'high',
      title: titles[type],
      message: details,
      voiceMessage: `Alerta de gerenciamento de risco. ${details}. Mantemos o plano ou você prefere ajustar?`
    });
  }

  alertOpportunity(asset: string, setup: string, confidence: number) {
    this.sendAlert({
      type: 'opportunity',
      priority: 'normal',
      title: 'OPORTUNIDADE DETECTADA',
      message: `${asset}: ${setup}. Confiança: ${confidence}%`,
      voiceMessage: `Setup detectado em ${asset}. ${setup}. Convergência de ${confidence} porcento. Executamos?`
    });
  }

  alertSystem(message: string, priority: AlertPriority = 'low') {
    this.sendAlert({
      type: 'system',
      priority,
      title: 'Sistema Neural Trader',
      message,
      voiceMessage: message
    });
  }

  // Get alert history
  getHistory(limit: number = 20): NexusAlert[] {
    return this.alertHistory.slice(0, limit);
  }

  // Clear history
  clearHistory() {
    this.alertHistory = [];
  }

  // Get queue status
  getQueueStatus() {
    return {
      queueLength: this.alertQueue.length,
      isProcessing: this.isProcessing,
      historySize: this.alertHistory.length
    };
  }
}

// Export singleton instance
export const NexusAlertSystem = new NexusAlertSystemClass();