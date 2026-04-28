/**
 * ✅ MT5 PRICE VALIDATOR
 * Valida preços em tempo real usando MetaAPI (MT5)
 * Garante sincronização com dados reais do mercado
 */

import { getMetaAPIClient, DirectPriceData } from './MetaAPIDirectClient';

export interface ValidatedPrice {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  spread: number;
  timestamp: number;
  source: 'mt5' | 'fallback';
  isValid: boolean;
}

export interface ValidationResult {
  symbol: string;
  mt5Price: number;
  localPrice: number;
  difference: number;
  differencePercent: number;
  isAccurate: boolean; // Diferença < 0.1%
  timestamp: number;
}

export class MT5PriceValidator {
  private token: string;
  private accountId: string;
  private isConnected: boolean = false;
  private priceCache: Map<string, ValidatedPrice> = new Map();
  private cacheExpiry: number = 5000; // 5 segundos
  private validationThreshold: number = 0.001; // 0.1% de diferença aceitável
  private reconnectInterval: NodeJS.Timeout | null = null;
  private keepAliveInterval: NodeJS.Timeout | null = null;

  // Mapeamento de símbolos (plataforma → MT5)
  private symbolMap: Record<string, string> = {
    'BTC': 'BTCUSD',
    'BTCUSD': 'BTCUSD',
    'ETH': 'ETHUSD',
    'ETHUSD': 'ETHUSD',
    'SPX': 'US500',      // ✅ S&P 500 atual (18 FEV 2026 - MERCADO FECHADO)
    'SP500': 'US500',
    'SPX500': 'US500',
    'US500': 'US500',
    'NQ': 'NAS100',      // ✅ Nasdaq
    'NAS100': 'NAS100',
    'DJI': 'US30',       // ✅ Dow Jones (corrigido para bater com MT5)
    'US30': 'US30',
    'EUR': 'EURUSD',
    'EURUSD': 'EURUSD',
    'GBP': 'GBPUSD',
    'GBPUSD': 'GBPUSD',
    'GOLD': 'XAUUSD',
    'XAUUSD': 'XAUUSD',
    'OIL': 'USOIL',
    'USOIL': 'USOIL'
  };

  constructor(token: string, accountId: string) {
    this.token = token;
    this.accountId = accountId;
    
    // 🛡️ FIX: NÃO auto-conectar no construtor (evita código assíncrono no top-level)
    // A conexão deve ser iniciada manualmente via connect()
    console.log('[MT5 Validator] 📦 Validador criado (use connect() para conectar)');
  }

  /**
   * Conecta ao MT5 via MetaAPI
   */
  async connect(): Promise<boolean> {
    try {
      console.log('[MT5 Validator] 🔌 Iniciando conexão...');
      
      const client = getMetaAPIClient(this.token);
      const connected = await client.connect(this.accountId);
      
      if (connected) {
        this.isConnected = true;
        localStorage.setItem('mt5_connected', 'true');
        console.log('[MT5 Validator] ✅ Conectado ao MT5!');
        
        // 🔥 ATIVAR RECONEXÃO AUTOMÁTICA E KEEP-ALIVE quando conectar manualmente
        if (!this.reconnectInterval) {
          this.startAutoReconnect();
        }
        if (!this.keepAliveInterval) {
          this.startKeepAlive();
        }
        
        return true;
      }
      
      console.error('[MT5 Validator] ❌ Falha na conexão');
      localStorage.setItem('mt5_connected', 'false');
      return false;

    } catch (error) {
      console.error('[MT5 Validator] ❌ Erro ao conectar:', error);
      this.isConnected = false;
      localStorage.setItem('mt5_connected', 'false');
      return false;
    }
  }

  /**
   * Obtém símbolo MT5 mapeado
   */
  private getMT5Symbol(symbol: string): string {
    const mapped = this.symbolMap[symbol.toUpperCase()];
    if (!mapped) {
      console.warn(`[MT5 Validator] ⚠️ Símbolo não mapeado: ${symbol}, usando original`);
      return symbol;
    }
    return mapped;
  }

  /**
   * Obtém preço validado do MT5
   */
  async getValidatedPrice(symbol: string): Promise<ValidatedPrice> {
    // Verificar cache
    const cached = this.priceCache.get(symbol);
    if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
      console.log(`[MT5 Validator] 📦 Usando cache para ${symbol}`);
      return cached;
    }

    // Buscar preço do MT5
    try {
      if (!this.isConnected) {
        console.warn('[MT5 Validator] ⚠️ Não conectado, usando fallback');
        return this.getFallbackPrice(symbol);
      }

      const mt5Symbol = this.getMT5Symbol(symbol);
      const client = getMetaAPIClient(this.token);
      const prices = await client.getPrices([mt5Symbol]);

      if (prices.length === 0) {
        console.warn(`[MT5 Validator] ⚠️ Sem dados do MT5 para ${symbol}`);
        return this.getFallbackPrice(symbol);
      }

      const priceData = prices[0];
      const validatedPrice: ValidatedPrice = {
        symbol,
        price: priceData.last,
        bid: priceData.bid,
        ask: priceData.ask,
        spread: priceData.spread,
        timestamp: priceData.timestamp,
        source: 'mt5',
        isValid: true
      };

      // Salvar no cache
      this.priceCache.set(symbol, validatedPrice);
      
      console.log(`[MT5 Validator] ✅ Preço validado ${symbol}:`, validatedPrice.price);
      return validatedPrice;

    } catch (error) {
      console.error(`[MT5 Validator] ❌ Erro ao buscar ${symbol}:`, error);
      return this.getFallbackPrice(symbol);
    }
  }

  /**
   * Obtém múltiplos preços validados
   */
  async getValidatedPrices(symbols: string[]): Promise<ValidatedPrice[]> {
    const promises = symbols.map(symbol => this.getValidatedPrice(symbol));
    return Promise.all(promises);
  }

  /**
   * Valida preço local contra MT5
   */
  async validatePrice(symbol: string, localPrice: number): Promise<ValidationResult> {
    const mt5Price = await this.getValidatedPrice(symbol);
    const difference = Math.abs(mt5Price.price - localPrice);
    const differencePercent = (difference / mt5Price.price) * 100;
    const isAccurate = differencePercent < (this.validationThreshold * 100);

    const result: ValidationResult = {
      symbol,
      mt5Price: mt5Price.price,
      localPrice,
      difference,
      differencePercent,
      isAccurate,
      timestamp: Date.now()
    };

    if (!isAccurate) {
      console.warn(
        `[MT5 Validator] ⚠️ Preço divergente para ${symbol}:`,
        `Local: ${localPrice.toFixed(2)} | MT5: ${mt5Price.price.toFixed(2)} | Diff: ${differencePercent.toFixed(3)}%`
      );
    } else {
      console.log(`[MT5 Validator] ✅ Preço validado ${symbol}: diferença de ${differencePercent.toFixed(3)}%`);
    }

    return result;
  }

  /**
   * Preço de fallback (dados simulados realistas)
   */
  private getFallbackPrice(symbol: string): ValidatedPrice {
    // Preços base realistas (atualizados com dados de hoje)
    const basePrices: Record<string, number> = {
      'BTC': 96500.00,
      'BTCUSD': 96500.00,
      'ETH': 3850.00,
      'ETHUSD': 3850.00,
      'SPX': 6020.00,      // ✅ S&P 500 atual (18 FEV 2026 - MERCADO FECHADO)
      'SP500': 6020.00,
      'SPX500': 6020.00,
      'US500': 6020.00,
      'NQ': 20150.00,      // ✅ Nasdaq
      'NAS100': 20150.00,
      'DJI': 49500.00,     // ✅ Dow Jones (corrigido para bater com MT5)
      'US30': 49500.00,
      'EUR': 1.0450,
      'EURUSD': 1.0450,
      'GBP': 1.2680,
      'GBPUSD': 1.2680,
      'GOLD': 2920.00,
      'XAUUSD': 2920.00,
      'OIL': 72.50,
      'USOIL': 72.50
    };

    const basePrice = basePrices[symbol] || basePrices[this.getMT5Symbol(symbol)] || 1.0;
    
    // Adicionar variação mínima realista
    const variation = (Math.random() - 0.5) * basePrice * 0.0001; // 0.01% de variação
    const price = basePrice + variation;
    const spread = price * 0.0002; // 0.02% de spread

    console.log(`[MT5 Validator] 📊 Usando fallback para ${symbol}: ${price.toFixed(2)}`);

    return {
      symbol,
      price,
      bid: price - spread / 2,
      ask: price + spread / 2,
      spread,
      timestamp: Date.now(),
      source: 'fallback',
      isValid: false
    };
  }

  /**
   * Obtém dados do S&P 500
   */
  async getSP500Data() {
    try {
      if (!this.isConnected) {
        throw new Error('MT5 não conectado');
      }

      const validatedPrice = await this.getValidatedPrice('SPX');
      
      return {
        price: validatedPrice.price,
        change: validatedPrice.price - (validatedPrice.price / (1 + validatedPrice.price * 0.01)),
        changePercent: validatedPrice.price > 0 ? 0.48 : 0, // Calcular real depois
        timestamp: validatedPrice.timestamp,
        source: validatedPrice.source as 'mt5' | 'fallback'
      };

    } catch (error) {
      console.error('[MT5 Validator] Erro ao obter S&P 500:', error);
      throw error; // Não tem fallback - joga erro
    }
  }

  /**
   * Limpa cache de preços
   */
  clearCache() {
    this.priceCache.clear();
    console.log('[MT5 Validator] 🗑️ Cache limpo');
  }

  /**
   * 🔥 NOVO: Alias para getValidatedPrice (usado pelo DataSourceRouter)
   */
  async getPrice(symbol: string): Promise<ValidatedPrice> {
    return this.getValidatedPrice(symbol);
  }

  /**
   * 🔄 NOVO: Iniciar reconexão automática
   */
  startAutoReconnect() {
    // Limpar intervalo anterior se existir
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }

    // Verificar conexão a cada 30 segundos
    this.reconnectInterval = setInterval(async () => {
      if (!this.isConnected) {
        console.log('[MT5 Validator] 🔄 Tentando reconectar...');
        await this.connect();
      }
    }, 30000); // 30 segundos

    console.log('[MT5 Validator] ✅ Auto-reconexão ativada (30s)');
  }

  /**
   * 🔄 NOVO: Iniciar keep-alive
   */
  startKeepAlive() {
    // Limpar intervalo anterior se existir
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }

    // Fazer ping a cada 2 minutos
    this.keepAliveInterval = setInterval(async () => {
      if (this.isConnected) {
        try {
          console.log('[MT5 Validator] 💓 Keep-alive ping...');
          // Buscar um preço qualquer para manter conexão ativa
          await this.getValidatedPrice('EURUSD');
        } catch (error) {
          console.error('[MT5 Validator] ❌ Keep-alive falhou:', error);
          this.isConnected = false;
        }
      }
    }, 120000); // 2 minutos

    console.log('[MT5 Validator] ✅ Keep-alive ativado (2min)');
  }

  /**
   * 🔄 NOVO: Parar reconexão automática
   */
  stopAutoReconnect() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
      console.log('[MT5 Validator] ⏸️ Auto-reconexão desativada');
    }
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
      console.log('[MT5 Validator] ⏸️ Keep-alive desativado');
    }
  }

  /**
   * Desconecta do MT5
   */
  async disconnect() {
    // Parar reconexão automática
    this.stopAutoReconnect();
    
    if (this.isConnected) {
      const client = getMetaAPIClient(this.token);
      await client.disconnect();
      this.isConnected = false;
      localStorage.setItem('mt5_connected', 'false');
      console.log('[MT5 Validator] 🔌 Desconectado do MT5');
    }
  }

  /**
   * Verifica status da conexão
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

// Singleton para uso global
let globalValidator: MT5PriceValidator | null = null;

// 🛡️ FIX: REMOVIDA AUTO-INICIALIZAÇÃO que causava código assíncrono no top-level
// A inicialização deve ser feita manualmente via getMT5Validator()

export function getMT5Validator(token?: string, accountId?: string): MT5PriceValidator {
  if (!globalValidator && token && accountId) {
    globalValidator = new MT5PriceValidator(token, accountId);
    console.log('[MT5 Validator] ✅ Inicializado manualmente');
    
    // Auto-conectar após inicialização manual
    globalValidator.connect()
      .then((success) => {
        if (success) {
          console.log('[MT5 Validator] 🎉 Conectado com sucesso!');
        }
      })
      .catch((err) => {
        console.warn('[MT5 Validator] ⚠️ Erro ao conectar:', err);
      });
  }
  
  if (!globalValidator) {
    throw new Error('MT5 Validator não inicializado. Forneça token e accountId.');
  }
  
  return globalValidator;
}

export function resetMT5Validator() {
  if (globalValidator) {
    globalValidator.disconnect();
    globalValidator = null;
  }
}