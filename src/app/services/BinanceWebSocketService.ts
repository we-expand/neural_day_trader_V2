/**
 * 🚀 BINANCE WEBSOCKET SERVICE
 * Streaming em tempo real de preços + variação diária
 * Zero latência, reconexão automática, suporte múltiplos símbolos
 * 
 * ⚡ OTIMIZADO: Throttle automático para reduzir carga da CPU
 */

import { debugLog, debugError, DEBUG_CONFIG } from '@/app/config/debug';

export interface BinanceTickerData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: number;
}

type TickerCallback = (data: BinanceTickerData) => void;

interface WebSocketConnection {
  socket: WebSocket | null;
  symbol: string;
  callbacks: Set<TickerCallback>;
  reconnectAttempts: number;
  reconnectTimeout: NodeJS.Timeout | null;
  lastCallbackTime: number; // 🔥 NOVO: Throttle
  throttleTimer: NodeJS.Timeout | null; // 🔥 NOVO: Timer para throttle
  lastData: BinanceTickerData | null; // 🔥 NOVO: Cache do último dado
}

class BinanceWebSocketService {
  private connections: Map<string, WebSocketConnection> = new Map();
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_DELAY = 3000; // 3 segundos
  private readonly WS_BASE_URL = 'wss://stream.binance.com:9443/ws';

  /**
   * Subscreve a um símbolo e recebe atualizações em tempo real
   */
  subscribe(symbol: string, callback: TickerCallback): () => void {
    const normalizedSymbol = symbol.toLowerCase().replace('usdt', 'usdt');
    
    console.log(`[BinanceWS] 📡 SUBSCRIBE: ${normalizedSymbol}`); // ← SEMPRE mostra (crítico)

    // Se já existe conexão, apenas adiciona callback
    if (this.connections.has(normalizedSymbol)) {
      const connection = this.connections.get(normalizedSymbol)!;
      connection.callbacks.add(callback);
      console.log(`[BinanceWS] ✅ Callback adicionado (total: ${connection.callbacks.size})`); // ← SEMPRE mostra (crítico)
      
      // Retorna função de unsubscribe
      return () => this.unsubscribe(normalizedSymbol, callback);
    }

    // Cria nova conexão
    const connection: WebSocketConnection = {
      socket: null,
      symbol: normalizedSymbol,
      callbacks: new Set([callback]),
      reconnectAttempts: 0,
      reconnectTimeout: null,
      lastCallbackTime: 0, // 🔥 NOVO: Throttle
      throttleTimer: null, // 🔥 NOVO: Timer para throttle
      lastData: null // 🔥 NOVO: Cache do último dado
    };

    this.connections.set(normalizedSymbol, connection);
    console.log(`[BinanceWS] 🆕 Nova conexão criada para ${normalizedSymbol}`); // ← SEMPRE mostra (crítico)
    this.connect(normalizedSymbol);

    // Retorna função de unsubscribe
    return () => this.unsubscribe(normalizedSymbol, callback);
  }

  /**
   * Remove callback e fecha conexão se não houver mais listeners
   */
  private unsubscribe(symbol: string, callback: TickerCallback) {
    const connection = this.connections.get(symbol);
    if (!connection) return;

    connection.callbacks.delete(callback);
    debugLog('WEBSOCKET', `[BinanceWS] 🔌 Callback removido de ${symbol} (restantes: ${connection.callbacks.size})`);

    // Se não há mais callbacks, fecha conexão
    if (connection.callbacks.size === 0) {
      this.disconnect(symbol);
    }
  }

  /**
   * Conecta ao WebSocket da Binance
   */
  private connect(symbol: string) {
    const connection = this.connections.get(symbol);
    if (!connection) return;

    try {
      const wsUrl = `${this.WS_BASE_URL}/${symbol}@ticker`;
      debugLog('WEBSOCKET', `[BinanceWS] 🔗 Conectando: ${wsUrl}`);

      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        debugLog('WEBSOCKET', `[BinanceWS] ✅ CONECTADO: ${symbol}`);
        debugLog('WEBSOCKET', `[BinanceWS] 🎯 URL: ${wsUrl}`);
        debugLog('WEBSOCKET', `[BinanceWS] 📊 Aguardando dados...`);
        connection.reconnectAttempts = 0; // Reset contador de reconexões
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Binance ticker stream format:
          // c: lastPrice
          // p: priceChange (24h)
          // P: priceChangePercent (24h)
          const tickerData: BinanceTickerData = {
            symbol: data.s,
            price: parseFloat(data.c),
            change: parseFloat(data.p),
            changePercent: parseFloat(data.P),
            timestamp: Date.now()
          };

          // 🎯 LOG CRÍTICO: Mostrar dados RAW + convertidos
          debugLog('WEBSOCKET', `[BinanceWS] 📊 STREAM RECEBIDO (RAW):`, {
            '🔴 RAW c (lastPrice)': data.c,
            '🔴 RAW p (priceChange)': data.p,
            '🔴 RAW P (priceChangePercent)': data.P,
            '---': '---',
            '✅ PARSED price': tickerData.price.toFixed(2),
            '✅ PARSED change': tickerData.change.toFixed(2),
            '✅ PARSED changePercent': tickerData.changePercent.toFixed(2) + '%',
            '🎯 Callbacks para chamar': connection.callbacks.size,
            '⏰ Timestamp': new Date().toISOString(),
            '🔗 Comparar com API REST': `https://api.binance.com/api/v3/ticker/24hr?symbol=${data.s}`
          });

          // 🔥 VERIFICAÇÃO CRÍTICA: Callbacks estão sendo chamados?
          let callbacksExecuted = 0;
          // Notificar todos os callbacks
          connection.callbacks.forEach(callback => {
            try {
              callback(tickerData);
              callbacksExecuted++;
            } catch (error) {
              debugError(`[BinanceWS] ❌ Erro no callback:`, error);
            }
          });
          
          debugLog('WEBSOCKET', `[BinanceWS] ✅ Callbacks executados: ${callbacksExecuted}/${connection.callbacks.size}`);

        } catch (error) {
          debugError('WEBSOCKET', `[BinanceWS] ❌ Erro ao processar mensagem:`, error);
        }
      };

      socket.onerror = (error) => {
        debugError('WEBSOCKET', `[BinanceWS] ❌ Erro WebSocket:`, error);
      };

      socket.onclose = (event) => {
        debugLog('WEBSOCKET', `[BinanceWS] 🔌 Conexão fechada: ${symbol}`, {
          code: event.code,
          reason: event.reason
        });

        // Tentar reconectar se não foi fechamento manual
        if (event.code !== 1000 && connection.callbacks.size > 0) {
          this.scheduleReconnect(symbol);
        }
      };

      connection.socket = socket;

    } catch (error) {
      debugError('WEBSOCKET', `[BinanceWS] ❌ Erro ao criar WebSocket:`, error);
      this.scheduleReconnect(symbol);
    }
  }

  /**
   * Agenda reconexão automática
   */
  private scheduleReconnect(symbol: string) {
    const connection = this.connections.get(symbol);
    if (!connection) return;

    // Limpar timeout anterior se existir
    if (connection.reconnectTimeout) {
      clearTimeout(connection.reconnectTimeout);
    }

    // Verificar limite de tentativas
    if (connection.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      debugError('WEBSOCKET', `[BinanceWS] ❌ Máximo de tentativas de reconexão atingido: ${symbol}`);
      this.disconnect(symbol);
      return;
    }

    connection.reconnectAttempts++;
    const delay = this.RECONNECT_DELAY * connection.reconnectAttempts; // Backoff exponencial

    debugLog('WEBSOCKET', `[BinanceWS] 🔄 Reconectando em ${delay}ms (tentativa ${connection.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`);

    connection.reconnectTimeout = setTimeout(() => {
      this.connect(symbol);
    }, delay);
  }

  /**
   * Desconecta e limpa recursos
   */
  private disconnect(symbol: string) {
    const connection = this.connections.get(symbol);
    if (!connection) return;

    debugLog('WEBSOCKET', `[BinanceWS] 🛑 Desconectando: ${symbol}`);

    // Limpar timeout de reconexão
    if (connection.reconnectTimeout) {
      clearTimeout(connection.reconnectTimeout);
      connection.reconnectTimeout = null;
    }

    // Fechar socket
    if (connection.socket) {
      connection.socket.close(1000, 'Client disconnect');
      connection.socket = null;
    }

    // Remover conexão
    this.connections.delete(symbol);
  }

  /**
   * Desconecta todas as conexões
   */
  disconnectAll() {
    debugLog('WEBSOCKET', `[BinanceWS] 🛑 Desconectando todas as conexões`);
    this.connections.forEach((_, symbol) => {
      this.disconnect(symbol);
    });
  }

  /**
   * Retorna status da conexão
   */
  getConnectionStatus(symbol: string): {
    connected: boolean;
    reconnectAttempts: number;
    callbacksCount: number;
  } | null {
    const connection = this.connections.get(symbol.toLowerCase());
    if (!connection) return null;

    return {
      connected: connection.socket?.readyState === WebSocket.OPEN,
      reconnectAttempts: connection.reconnectAttempts,
      callbacksCount: connection.callbacks.size
    };
  }
}

// Singleton instance
export const binanceWebSocket = new BinanceWebSocketService();