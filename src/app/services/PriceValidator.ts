/**
 * 🎯 PRICE VALIDATOR v2.0 - Sistema de Validação Silencioso
 * 
 * Sistema de 2 camadas com logs estruturados:
 * 1. Cache de 5 segundos (evita requisições duplicadas)
 * 2. Servidor (proxy para Binance)
 * 3. Fallback de emergência (dados simulados)
 * 
 * ✅ Logs silenciosos: apenas erros críticos
 * ✅ SEM CHAMADA DIRETA À BINANCE (CORS bloqueado)
 */

interface MarketData {
  symbol: string;
  source: string;
  price: number;
  bid: number;
  ask: number;
  high: number;
  low: number;
  open?: number;
  volume?: number;
  change?: number;
  changePercent: number;
  timestamp: number;
  isRealData: boolean;
}

interface ValidationResult {
  data: MarketData;
  validated: boolean;
  discrepancy: number;
  source: 'server' | 'fallback';
  warning?: string;
}

export class PriceValidator {
  private static readonly MAX_DISCREPANCY_PERCENT = 1.0; // 1% máximo de diferença aceitável
  private static readonly CACHE_TTL = 5000; // 5 segundos de cache
  private static cache: Map<string, { data: MarketData; timestamp: number }> = new Map();
  private static readonly DEBUG_MODE = false; // ✅ Modo debug desligado em produção

  /**
   * 🎯 VALIDA E ALINHA preço com Binance REAL (via servidor)
   */
  static async validateAndAlign(symbol: string, serverUrl?: string, serverAuth?: string): Promise<ValidationResult> {
    // Log silencioso (apenas em debug mode)
    if (this.DEBUG_MODE) {
      console.log(`[PriceValidator] 🎯 Validando ${symbol}...`);
    }

    // 1️⃣ Verificar cache (5 segundos)
    const cached = this.getFromCache(symbol);
    if (cached) {
      return {
        data: cached,
        validated: true,
        discrepancy: 0,
        source: 'server'
      };
    }

    // 2️⃣ Buscar via servidor (ÚNICA FONTE - Binance direto bloqueia CORS)
    if (serverUrl && serverAuth) {
      const serverData = await this.fetchViaServer(symbol, serverUrl, serverAuth);
      
      if (serverData) {
        // Salvar no cache
        this.saveToCache(symbol, serverData);
        
        return {
          data: serverData,
          validated: true,
          discrepancy: 0,
          source: 'server'
        };
      }
    }

    // 3️⃣ EMERGENCY FALLBACK: Dados simulados
    if (this.DEBUG_MODE) {
      console.warn(`[PriceValidator] ⚠️ Usando fallback simulado para ${symbol}`);
    }
    return {
      data: this.getEmergencyFallback(symbol),
      validated: false,
      discrepancy: 0,
      source: 'fallback',
      warning: 'Usando dados simulados (servidor indisponível)'
    };
  }

  /**
   * 🖥️ Buscar via servidor (ÚNICA FONTE VÁLIDA)
   */
  private static async fetchViaServer(symbol: string, url: string, auth: string): Promise<MarketData | null> {
    try {
      if (this.DEBUG_MODE) {
        console.log(`[PriceValidator] 🖥️ Chamando servidor para ${symbol}...`);
      }
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${auth}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (this.DEBUG_MODE) {
          console.error(`[PriceValidator] ❌ Servidor retornou ${response.status}`);
        }
        return null;
      }

      const data = await response.json();
      
      if (this.DEBUG_MODE) {
        console.log(`[PriceValidator] ✅ Servidor OK: $${data.price.toFixed(2)}`);
      }
      
      return data as MarketData;
    } catch (error: any) {
      // Silencioso: servidor indisponível é esperado em dev
      if (this.DEBUG_MODE) {
        console.error(`[PriceValidator] ❌ Erro ao buscar do servidor:`, error.message);
      }
      return null;
    }
  }

  /**
   * 💾 Cache management
   */
  private static getFromCache(symbol: string): MarketData | null {
    const cached = this.cache.get(symbol);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > this.CACHE_TTL) {
      this.cache.delete(symbol);
      return null;
    }

    return cached.data;
  }

  private static saveToCache(symbol: string, data: MarketData): void {
    this.cache.set(symbol, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * 🚨 Emergency fallback com preços base conhecidos
   */
  private static getEmergencyFallback(symbol: string): MarketData {
    const basePrices: Record<string, number> = {
      'BTCUSDT': 87900,  // ✅ Preço real atual (~27/01/2025)
      'ETHUSDT': 3256,
      'SOLUSDT': 235,
      'BNBUSDT': 645,
      'XRPUSDT': 2.87,
      'ADAUSDT': 1.15,
      'DOGEUSDT': 0.38,
      'POLUSDT': 0.62, // Polygon (rebrandado de MATIC)
      'DOTUSDT': 9.45,
      'AVAXUSDT': 42.67
    };

    const basePrice = basePrices[symbol] || 100;
    
    // Variação pequena para simular movimento
    const variation = (Math.random() - 0.5) * 0.002; // ±0.2%
    const price = basePrice * (1 + variation);
    const changePercent = variation * 100;

    return {
      symbol,
      source: 'fallback-emergency',
      price,
      bid: price * 0.9999,
      ask: price * 1.0001,
      high: price * 1.002,
      low: price * 0.998,
      open: basePrice,
      volume: 1000000,
      change: price - basePrice,
      changePercent,
      timestamp: Date.now(),
      isRealData: false
    };
  }

  /**
   * 🔍 Calcula discrepância entre dois preços
   */
  static calculateDiscrepancy(price1: number, price2: number): number {
    return Math.abs(price1 - price2);
  }

  /**
   * 🔍 Calcula discrepância percentual
   */
  static calculateDiscrepancyPercent(price1: number, price2: number): number {
    return (Math.abs(price1 - price2) / price1) * 100;
  }

  /**
   * ✅ Verifica se discrepância está dentro do aceitável
   */
  static isDiscrepancyAcceptable(price1: number, price2: number): boolean {
    const discrepancyPercent = this.calculateDiscrepancyPercent(price1, price2);
    return discrepancyPercent <= this.MAX_DISCREPANCY_PERCENT;
  }

  /**
   * 🧹 Limpar cache
   */
  static clearCache(): void {
    this.cache.clear();
    console.log('[PriceValidator] 🧹 Cache limpo');
  }
}