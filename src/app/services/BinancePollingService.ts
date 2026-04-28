/**
 * 🔄 BINANCE POLLING SERVICE
 *
 * Fallback quando WebSocket não funciona (CSP/CORS do Figma Make)
 * Atualiza preços via REST API a cada 120 segundos
 *
 * 🆕 USA PROXY DO BACKEND ou DIRECT BINANCE API (fallback automático)
 */

import { debugLog, debugError } from '@/app/config/debug';
import { getApiUrl, API_ENDPOINTS } from '/utils/api/config'; // 🆕 API centralizada
import { fetchDirectBinance } from './DirectBinanceService'; // 🚀 Fallback direto Binance

export interface BinanceTickerData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: number;
}

type TickerCallback = (data: BinanceTickerData) => void;

interface PollingSubscription {
  symbol: string;
  callbacks: Set<TickerCallback>;
  intervalId: NodeJS.Timeout | null;
  lastData: BinanceTickerData | null;
}

class BinancePollingService {
  private subscriptions: Map<string, PollingSubscription> = new Map();
  private readonly POLL_INTERVAL = 120000; // 120 segundos (2 minutos) - OTIMIZADO para economizar quota

  /**
   * Subscreve a um símbolo e recebe atualizações via polling
   */
  subscribe(symbol: string, callback: TickerCallback): () => void {
    const normalizedSymbol = symbol.toUpperCase();
    
    console.log(`[BinancePolling] 🔄 SUBSCRIBE: ${normalizedSymbol}`);

    // Se já existe subscription, apenas adiciona callback
    if (this.subscriptions.has(normalizedSymbol)) {
      const sub = this.subscriptions.get(normalizedSymbol)!;
      sub.callbacks.add(callback);
      console.log(`[BinancePolling] ✅ Callback adicionado (total: ${sub.callbacks.size})`);
      
      // Se já tem dados em cache, chama callback imediatamente
      if (sub.lastData) {
        callback(sub.lastData);
      }
      
      return () => this.unsubscribe(normalizedSymbol, callback);
    }

    // Cria nova subscription
    const sub: PollingSubscription = {
      symbol: normalizedSymbol,
      callbacks: new Set([callback]),
      intervalId: null,
      lastData: null
    };

    this.subscriptions.set(normalizedSymbol, sub);
    console.log(`[BinancePolling] 🆕 Nova subscription criada para ${normalizedSymbol}`);
    
    this.startPolling(normalizedSymbol);

    return () => this.unsubscribe(normalizedSymbol, callback);
  }

  /**
   * Remove callback de um símbolo
   */
  private unsubscribe(symbol: string, callback: TickerCallback): void {
    const sub = this.subscriptions.get(symbol);
    if (!sub) return;

    sub.callbacks.delete(callback);
    console.log(`[BinancePolling] ❌ Callback removido (restantes: ${sub.callbacks.size})`);

    // Se não há mais callbacks, para o polling
    if (sub.callbacks.size === 0) {
      this.stopPolling(symbol);
      this.subscriptions.delete(symbol);
      console.log(`[BinancePolling] 🛑 Polling parado para ${symbol}`);
    }
  }

  /**
   * Inicia polling para um símbolo
   */
  private startPolling(symbol: string): void {
    const sub = this.subscriptions.get(symbol);
    if (!sub) return;

    console.log(`[BinancePolling] ▶️ Iniciando polling para ${symbol} (${this.POLL_INTERVAL}ms)`);

    // Faz primeira requisição imediatamente
    this.fetchAndNotify(symbol);

    // Configura intervalo
    sub.intervalId = setInterval(() => {
      this.fetchAndNotify(symbol);
    }, this.POLL_INTERVAL);
  }

  /**
   * Para polling para um símbolo
   */
  private stopPolling(symbol: string): void {
    const sub = this.subscriptions.get(symbol);
    if (!sub || !sub.intervalId) return;

    clearInterval(sub.intervalId);
    sub.intervalId = null;
  }

  /**
   * Busca dados da API e notifica callbacks
   */
  private async fetchAndNotify(symbol: string): Promise<void> {
    const sub = this.subscriptions.get(symbol);
    if (!sub) return;

    let tickerData: BinanceTickerData | null = null;

    try {
      // 🔥 TENTATIVA 1: Busca via API (Vercel ou Supabase)
      const apiUrl = getApiUrl(API_ENDPOINTS.binance(symbol));
      const response = await fetch(apiUrl, {
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const data = await response.json();
        tickerData = {
          symbol: data.symbol,
          price: parseFloat(data.lastPrice || data.price),
          change: parseFloat(data.priceChange || data.change),
          changePercent: parseFloat(data.priceChangePercent || data.changePercent),
          timestamp: Date.now()
        };
        debugLog('MARKET_DATA', `[BinancePolling] 📊 Dados via API: ${tickerData.symbol} ${tickerData.price.toFixed(2)}`);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }

    } catch {
      // 🚀 FALLBACK silencioso: Binance direta (com proxy CORS automático)
      try {
        tickerData = await fetchDirectBinance(symbol);
      } catch {
        // Falha total — silencioso, sem spam no console
      }
    }

    // Se conseguiu dados (de qualquer fonte), processa
    if (tickerData) {
      sub.lastData = tickerData;
      sub.callbacks.forEach(callback => {
        try { callback(tickerData!); } catch { /* ignorar erros de callback */ }
      });
    }
  }

  /**
   * Para todos os pollings (cleanup)
   */
  destroy(): void {
    console.log(`[BinancePolling] 🧹 Cleanup: parando ${this.subscriptions.size} pollings`);
    
    this.subscriptions.forEach((sub, symbol) => {
      this.stopPolling(symbol);
    });
    
    this.subscriptions.clear();
  }
}

// Singleton instance
export const binancePolling = new BinancePollingService();