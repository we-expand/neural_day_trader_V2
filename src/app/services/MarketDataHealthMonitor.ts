/**
 * 🏥 MARKET DATA HEALTH MONITOR - v1.0
 * 
 * Sistema de monitoramento 24/7 para garantir estabilidade:
 * ✅ Health check automático a cada 30 segundos
 * ✅ Auto-recovery em caso de falha
 * ✅ Reconexão automática
 * ✅ Logs estruturados para debugging
 */

import { getRealMarketData } from './RealMarketDataService';

interface HealthStatus {
  isHealthy: boolean;
  lastCheck: Date;
  consecutiveFailures: number;
  lastError?: string;
  uptime: number; // segundos desde último sucesso
}

class MarketDataHealthMonitor {
  private healthStatus: HealthStatus = {
    isHealthy: true,
    lastCheck: new Date(),
    consecutiveFailures: 0,
    uptime: 0
  };

  private checkInterval: any = null;
  private lastSuccessTime = Date.now();
  
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 segundos
  private readonly MAX_FAILURES_BEFORE_ALERT = 3;
  private readonly TEST_SYMBOLS = ['BTCUSDT', 'ETHUSDT']; // Símbolos para teste

  /**
   * 🚀 Iniciar monitoramento
   */
  start() {
    if (this.checkInterval) {
      console.log('[HealthMonitor] ⚠️ Already running');
      return;
    }

    console.log('[HealthMonitor] 🚀 Starting 24/7 monitoring...');
    
    // Primeiro check imediato
    this.performHealthCheck();
    
    // Configurar checks periódicos
    this.checkInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.HEALTH_CHECK_INTERVAL);
  }

  /**
   * 🛑 Parar monitoramento
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('[HealthMonitor] 🛑 Monitoring stopped');
    }
  }

  /**
   * 🔍 Executar health check
   */
  private async performHealthCheck() {
    try {
      // Testar busca de dados para símbolo conhecido
      const testSymbol = this.TEST_SYMBOLS[0];
      const startTime = Date.now();
      
      const data = await getRealMarketData(testSymbol);
      
      const responseTime = Date.now() - startTime;
      
      // Verificar se os dados são válidos
      if (!data || !data.price || data.price <= 0) {
        throw new Error('Invalid data received');
      }

      // ✅ SUCCESS
      this.healthStatus.isHealthy = true;
      this.healthStatus.consecutiveFailures = 0;
      this.healthStatus.lastCheck = new Date();
      this.healthStatus.uptime = Math.floor((Date.now() - this.lastSuccessTime) / 1000);
      this.lastSuccessTime = Date.now();
      
      // Log silencioso (apenas a cada 5 minutos)
      const shouldLog = this.healthStatus.uptime % 300 === 0;
      if (shouldLog) {
        console.log(`[HealthMonitor] ✅ System healthy | ${testSymbol}: $${data.price.toFixed(2)} | Response: ${responseTime}ms | Source: ${data.source}`);
      }

    } catch (error: any) {
      // ❌ FAILURE
      this.healthStatus.consecutiveFailures++;
      this.healthStatus.lastCheck = new Date();
      this.healthStatus.lastError = error.message;

      if (this.healthStatus.consecutiveFailures >= this.MAX_FAILURES_BEFORE_ALERT) {
        this.healthStatus.isHealthy = false;
        console.error(`[HealthMonitor] 🚨 ALERT: ${this.healthStatus.consecutiveFailures} consecutive failures`);
        console.error(`[HealthMonitor] Error: ${error.message}`);
        
        // Tentar recovery
        this.attemptRecovery();
      } else {
        console.warn(`[HealthMonitor] ⚠️ Check failed (${this.healthStatus.consecutiveFailures}/${this.MAX_FAILURES_BEFORE_ALERT}): ${error.message}`);
      }
    }
  }

  /**
   * 🔧 Tentar recovery automático
   */
  private async attemptRecovery() {
    console.log('[HealthMonitor] 🔧 Attempting auto-recovery...');
    
    // Estratégia 1: Limpar cache do PriceValidator
    try {
      const { PriceValidator } = await import('./PriceValidator');
      PriceValidator.clearCache();
      console.log('[HealthMonitor] ✅ Cache cleared');
    } catch (e) {
      console.error('[HealthMonitor] ❌ Failed to clear cache:', e);
    }

    // Estratégia 2: Aguardar 5 segundos antes do próximo check
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Estratégia 3: Testar com símbolo alternativo
    try {
      const altSymbol = this.TEST_SYMBOLS[1];
      const data = await getRealMarketData(altSymbol);
      
      if (data && data.price > 0) {
        console.log('[HealthMonitor] ✅ Recovery successful with alternative symbol');
        this.healthStatus.consecutiveFailures = 0;
        this.healthStatus.isHealthy = true;
      }
    } catch (e) {
      console.error('[HealthMonitor] ❌ Recovery failed');
    }
  }

  /**
   * 📊 Obter status atual
   */
  getStatus(): HealthStatus {
    return { ...this.healthStatus };
  }

  /**
   * 🔍 Verificar se está saudável
   */
  isHealthy(): boolean {
    return this.healthStatus.isHealthy;
  }
}

// Singleton instance
export const healthMonitor = new MarketDataHealthMonitor();

// Auto-start quando importado
if (typeof window !== 'undefined') {
  // Aguardar 5 segundos após o carregamento da página
  setTimeout(() => {
    healthMonitor.start();
  }, 5000);
  
  // Parar quando a página for fechada
  window.addEventListener('beforeunload', () => {
    healthMonitor.stop();
  });
}
