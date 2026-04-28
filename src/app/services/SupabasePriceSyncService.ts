/**
 * Supabase Price Sync Service
 * Sincroniza preços da Binance/MT5 com Supabase em tempo real
 * Atualiza todos os clientes conectados via Realtime
 */

import { supabase, isSupabaseActive } from '@/lib/supabaseClient';
import { ALL_ASSETS } from '@/app/config/assetDatabase';

interface PriceSyncConfig {
  syncInterval: number; // milliseconds
  batchSize: number;
  enableBroadcast: boolean;
  enableStorage: boolean;
}

const DEFAULT_CONFIG: PriceSyncConfig = {
  syncInterval: 5000, // 5 seconds
  batchSize: 50,
  enableBroadcast: true,
  enableStorage: true,
};

class SupabasePriceSyncService {
  private config: PriceSyncConfig;
  private syncInterval: NodeJS.Timeout | null = null;
  private channel: any = null;
  private isRunning = false;
  private priceCache: Map<string, any> = new Map();

  constructor(config: Partial<PriceSyncConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Iniciar sincronização automática
   */
  async start() {
    if (!isSupabaseActive || !supabase) {
      console.log('[PRICE_SYNC] ⚠️ Supabase not active, skipping sync');
      return;
    }

    if (this.isRunning) {
      console.log('[PRICE_SYNC] ⚠️ Already running');
      return;
    }

    console.log('[PRICE_SYNC] 🚀 Starting price sync service...');
    this.isRunning = true;

    // Setup broadcast channel
    if (this.config.enableBroadcast) {
      this.channel = supabase.channel('price-sync');
      
      // 🔥 CRITICAL: Subscribe before using send()
      await new Promise<void>((resolve) => {
        this.channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[PRICE_SYNC] 📡 Broadcast channel ready');
            resolve();
          }
        });
      });
    }

    // Start periodic sync
    this.syncInterval = setInterval(() => {
      this.syncAllPrices();
    }, this.config.syncInterval);

    // Initial sync
    await this.syncAllPrices();
  }

  /**
   * Parar sincronização
   */
  async stop() {
    console.log('[PRICE_SYNC] 🛑 Stopping price sync service...');
    this.isRunning = false;

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    if (this.channel) {
      await this.channel.unsubscribe();
      this.channel = null;
    }
  }

  /**
   * Sincronizar todos os preços dos ativos
   */
  private async syncAllPrices() {
    if (!isSupabaseActive || !supabase) return;

    try {
      // Buscar preços da Binance para criptos
      const cryptoSymbols = ALL_ASSETS
        .filter(a => a.category === 'CRYPTO')
        .slice(0, this.config.batchSize)
        .map(a => `${a.symbol}USDT`);

      if (cryptoSymbols.length === 0) return;

      const promises = cryptoSymbols.map(symbol =>
        fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      );

      const results = await Promise.all(promises);
      const prices: any[] = [];

      results.forEach((data, idx) => {
        if (!data) return;

        const symbol = cryptoSymbols[idx].replace('USDT', '');
        const price = parseFloat(data.lastPrice);
        const change24h = parseFloat(data.priceChange);
        const changePercent = parseFloat(data.priceChangePercent);
        const volume = parseFloat(data.volume);
        const high = parseFloat(data.highPrice);
        const low = parseFloat(data.lowPrice);
        const bid = parseFloat(data.bidPrice);
        const ask = parseFloat(data.askPrice);

        const priceData = {
          asset_symbol: symbol,
          price,
          bid,
          ask,
          volume,
          change_24h: change24h,
          change_percent_24h: changePercent,
          high_24h: high,
          low_24h: low,
          source: 'binance',
          timestamp: new Date().toISOString(),
        };

        prices.push(priceData);

        // Cache para evitar duplicatas
        this.priceCache.set(symbol, priceData);

        // Broadcast individual price update
        if (this.config.enableBroadcast && this.channel) {
          this.channel.send({
            type: 'broadcast',
            event: 'price-update',
            payload: priceData
          });
        }
      });

      // Salvar em lote no banco
      if (this.config.enableStorage && prices.length > 0) {
        const { error } = await supabase
          .from('asset_prices')
          .insert(prices);

        if (error && !error.message.includes('duplicate')) {
          console.error('[PRICE_SYNC] ❌ Batch insert failed:', error.message);
        } else {
          console.log(`[PRICE_SYNC] ✅ Synced ${prices.length} prices`);
        }
      }
    } catch (error) {
      console.error('[PRICE_SYNC] ❌ Sync failed:', error);
    }
  }

  /**
   * Sincronizar preço individual
   */
  async syncSinglePrice(assetSymbol: string, price: number, metadata?: any) {
    if (!isSupabaseActive || !supabase) return;

    const priceData = {
      asset_symbol: assetSymbol,
      price,
      ...metadata,
      source: metadata?.source || 'internal',
      timestamp: new Date().toISOString(),
    };

    try {
      // Save to database
      if (this.config.enableStorage) {
        await supabase
          .from('asset_prices')
          .insert(priceData);
      }

      // Broadcast to all clients
      if (this.config.enableBroadcast && this.channel) {
        await this.channel.send({
          type: 'broadcast',
          event: 'price-update',
          payload: priceData
        });
      }

      console.log(`[PRICE_SYNC] 📊 Synced ${assetSymbol}: $${price}`);
    } catch (error) {
      console.error(`[PRICE_SYNC] ❌ Failed to sync ${assetSymbol}:`, error);
    }
  }

  /**
   * Obter último preço do cache
   */
  getCachedPrice(assetSymbol: string) {
    return this.priceCache.get(assetSymbol);
  }

  /**
   * Limpar cache
   */
  clearCache() {
    this.priceCache.clear();
    console.log('[PRICE_SYNC] 🗑️ Cache cleared');
  }

  /**
   * Status do serviço
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      cacheSize: this.priceCache.size,
      config: this.config,
      channelConnected: !!this.channel,
    };
  }
}

// Singleton instance
export const priceSyncService = new SupabasePriceSyncService();

// Auto-start on load (opcional)
if (typeof window !== 'undefined') {
  // priceSyncService.start(); // Descomente para auto-start
}

export default SupabasePriceSyncService;