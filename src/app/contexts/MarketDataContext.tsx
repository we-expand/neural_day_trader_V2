/**
 * 🌐 MARKET DATA CONTEXT - DADOS GLOBAIS DE MERCADO
 * Provê preços validados em tempo real para TODA a plataforma
 * Integração com MT5 Validator para dados 100% reais
 *
 * ✅ CORRIGIDO 2026-07-12: antes, `refreshPrices` exigia `isConnected` (broker
 * PESSOAL do usuário, via MT5PriceValidator com token/accountId próprios) —
 * sem isso, `prices`/`sp500` ficavam permanentemente vazios ("MT5 OBRIGATÓRIO:
 * Sem conexão = sem dados"). Requisito de produto: a maioria dos usuários vai
 * usar a plataforma só como demo/treino, sem nunca conectar corretora própria
 * — pra esses, o app tem que mostrar preço real de qualquer forma. A conta
 * MetaAPI usada por `RealMarketDataService`/`getBatchedMT5Data` é da
 * PLATAFORMA (backend), não do usuário — não depende de `connect()`. Agora
 * `connect`/`disconnect`/`isConnected` continuam existindo (usados por telas
 * que precisam saber se HÁ corretora pessoal pra fins de execução de ordem
 * real), mas a EXIBIÇÃO de preço nunca mais fica vazia por causa disso.
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getMT5Validator, ValidatedPrice } from '@/app/services/MT5PriceValidator';
import { getBatchedMT5Data } from '@/app/services/RealMarketDataService';
import { toast } from 'sonner';

interface MarketDataContextType {
  // Preços validados
  prices: Map<string, ValidatedPrice>;
  
  // S&P 500 específico (usado em múltiplos módulos)
  sp500: {
    price: number;
    change: number;
    changePercent: number;
    timestamp: number;
    source: 'mt5' | 'fallback';
  } | null;
  
  // Status de conexão
  isConnected: boolean;
  isConnecting: boolean;
  
  // Métodos de controle
  connect: (token: string, accountId: string) => Promise<boolean>;
  disconnect: () => Promise<void>;
  getPrice: (symbol: string) => ValidatedPrice | null;
  refreshPrices: () => Promise<void>;
  
  // Símbolos sendo monitorados
  watchedSymbols: string[];
  addSymbol: (symbol: string) => void;
  removeSymbol: (symbol: string) => void;
}

const MarketDataContext = createContext<MarketDataContextType | null>(null);

// Símbolos padrão monitorados
const DEFAULT_SYMBOLS = ['BTC', 'ETH', 'SPX', 'EURUSD', 'GOLD', 'OIL', 'NQ', 'DJI', 'US30'];

// 🔄 MAPEAMENTO DE SÍMBOLOS MT5 → UI
// Diferentes corretoras usam nomes diferentes
const SYMBOL_ALIASES: Record<string, string[]> = {
  'US30': ['DJI', 'US30', 'US30.cash', 'DJ30'],       // Dow Jones 30
  'NQ': ['NQ', 'NAS100', 'US100', 'USTEC'],           // Nasdaq 100
  'SPX': ['SPX', 'SPX500', 'US500', 'SP500'],         // S&P 500 ✅
  'BTC': ['BTC', 'BTCUSD', 'BTCUSDT'],                // Bitcoin
  'ETH': ['ETH', 'ETHUSD', 'ETHUSDT'],                // Ethereum
  'GOLD': ['GOLD', 'XAUUSD', 'GC'],                   // Ouro
  'OIL': ['OIL', 'USOIL', 'CL', 'WTI'],               // Petróleo
};

// Helper: Normalizar símbolo para o padrão da UI
const normalizeSymbol = (symbol: string): string => {
  const upper = symbol.toUpperCase();
  
  for (const [canonical, aliases] of Object.entries(SYMBOL_ALIASES)) {
    if (aliases.some(alias => upper.includes(alias))) {
      console.log(`[normalizeSymbol] 🔄 ${symbol} → ${canonical}`);
      return canonical;
    }
  }
  
  console.log(`[normalizeSymbol] ℹ️ ${symbol} → ${upper} (sem alias)`);
  return upper;
};

export const MarketDataProvider = ({ children }: { children: ReactNode }) => {
  const [prices, setPrices] = useState<Map<string, ValidatedPrice>>(new Map());
  const [sp500, setSp500] = useState<MarketDataContextType['sp500']>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [watchedSymbols, setWatchedSymbols] = useState<string[]>(DEFAULT_SYMBOLS);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // 🔑 Armazenar credenciais MT5 quando conectar
  const [mt5Credentials, setMt5Credentials] = useState<{ token: string; accountId: string } | null>(null);

  /**
   * Conecta ao MT5 Validator
   */
  const connect = useCallback(async (token: string, accountId: string): Promise<boolean> => {
    if (isConnected) {
      console.log('[Market Data] Já conectado');
      return true;
    }

    setIsConnecting(true);
    console.log('[Market Data] 🔌 Conectando ao MT5...');

    try {
      const validator = getMT5Validator(token, accountId);
      const connected = await validator.connect();

      if (connected) {
        setIsConnected(true);
        setMt5Credentials({ token, accountId }); // 🔑 Salvar credenciais
        console.log('[Market Data] ✅ Conectado com sucesso!');
        
        // Buscar preços iniciais
        await refreshPricesInternal(validator);
        
        return true;
      }

      console.error('[Market Data] ❌ Falha na conexão');
      return false;

    } catch (error) {
      console.error('[Market Data] ❌ Erro ao conectar:', error);
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [isConnected]);
  
  /**
   * 🔄 Tenta reconectar automaticamente com credenciais salvas
   */
  const tryAutoReconnect = useCallback(async () => {
    // 🛡️ PROTEÇÃO: Só tentar reconectar se já estiver inicializado
    if (!isInitialized) {
      console.log('[Market Data] ⏳ Aguardando inicialização completa...');
      return;
    }
    
    // 🛡️ PROTEÇÃO: Não tentar reconectar se já estiver conectando ou conectado
    if (isConnecting || isConnected) {
      console.log('[Market Data] ⏩ Pulando reconexão (já conectado/conectando)');
      return;
    }
    
    try {
      // 🔒 Fase 1: credenciais MetaAPI vivem no backend (JWT), não em localStorage.
      // `connect()` já verifica isso via `getBrokerCredentialsStatus()` (BrokerClient) —
      // os parâmetros token/accountId são só compatibilidade legada, ignorados.
      console.log('[Market Data] 🔄 Verificando credenciais no backend...');
      const success = await connect('', '');

      if (success) {
        console.log('[Market Data] ✅ Reconexão automática bem-sucedida!');
        // 🛡️ PROTEÇÃO: Envolver toast em try-catch para prevenir iframe errors
        try {
          toast.success('MT5 reconectado automaticamente');
        } catch (toastError) {
          console.warn('[Market Data] ⚠️ Erro ao exibir toast:', toastError);
        }
      } else {
        console.log('[Market Data] ℹ️ Nenhuma credencial configurada no backend');
      }
    } catch (error) {
      console.error('[Market Data] ❌ Erro na reconexão automática:', error);
      // ⚠️ NÃO PROPAGAR ERRO (evita crash do iframe)
    }
  }, [isInitialized, isConnecting, isConnected, connect]);

  // 🛡️ PROTEÇÃO ANTI-IFRAME ERROR: Inicialização com delay
  useEffect(() => {
    const initTimer = setTimeout(() => {
      try {
        console.log('[Market Data] 🚀 Context inicializado com segurança');
        setIsInitialized(true);
      } catch (error) {
        console.error('[Market Data] ❌ Erro na inicialização:', error);
        setIsInitialized(true);
      }
    }, 120);

    return () => clearTimeout(initTimer);
  }, []); // ✅ SEM DEPENDÊNCIAS - evita re-execução
  
  // 🔄 RECONEXÃO AUTOMÁTICA: Executar APÓS inicialização completa
  useEffect(() => {
    if (isInitialized && !isConnected) {
      // Delay adicional para garantir que o iframe está pronto
      const reconnectTimer = setTimeout(() => {
        tryAutoReconnect();
      }, 300); // 300ms após inicialização
      
      return () => clearTimeout(reconnectTimer);
    }
  }, [isInitialized, isConnected, tryAutoReconnect]);

  /**
   * Desconecta do MT5
   */
  const disconnect = useCallback(async () => {
    if (!isConnected || !mt5Credentials) return;

    try {
      const validator = getMT5Validator(mt5Credentials.token, mt5Credentials.accountId);
      await validator.disconnect();
      setIsConnected(false);
      setMt5Credentials(null); // 🔑 Limpar credenciais
      console.log('[Market Data] 🔌 Desconectado (corretora pessoal) — voltando pra conta de plataforma');
      await refreshPricesFromPlatform(); // não deixar a tela vazia após desconectar
    } catch (error) {
      console.error('[Market Data] ❌ Erro ao desconectar:', error);
    }
  }, [isConnected, mt5Credentials]);

  /**
   * Atualiza preços (interno) — corretora PESSOAL do usuário (quando conectada)
   */
  const refreshPricesInternal = async (validator: ReturnType<typeof getMT5Validator>) => {
    try {
      if (!validator.getConnectionStatus()) {
        console.warn('[Market Data] ⚠️ Não conectado - preços não disponíveis');
        return;
      }

      // Buscar preços dos símbolos monitorados
      const validatedPrices = await validator.getValidatedPrices(watchedSymbols);

      const pricesMap = new Map<string, ValidatedPrice>();
      validatedPrices.forEach(price => {
        pricesMap.set(normalizeSymbol(price.symbol), price);
      });

      setPrices(pricesMap);

      // Buscar S&P 500 específico
      const sp500Data = await validator.getSP500Data();
      setSp500(sp500Data);

      console.log('[Market Data] 📊 Preços atualizados (corretora pessoal):', {
        total: pricesMap.size,
        sp500: sp500Data.price,
        source: sp500Data.source
      });

    } catch (error) {
      console.error('[Market Data] ❌ Erro ao atualizar preços (corretora pessoal):', error);
    }
  };

  /**
   * Atualiza preços (interno) — conta de PLATAFORMA, usada quando o usuário
   * não tem corretora própria conectada (demo/treino). Mesma fonte real do
   * Dashboard (RealMarketDataService), nunca inventa preço.
   */
  const refreshPricesFromPlatform = async () => {
    try {
      const batched = await getBatchedMT5Data(watchedSymbols);

      const pricesMap = new Map<string, ValidatedPrice>();
      for (const symbol of watchedSymbols) {
        const data = batched[symbol.toUpperCase().replace('/', '').replace(' ', '')] ?? batched[symbol];
        if (!data || !data.isRealData) continue; // sem dado real ainda — não exibir número inventado
        pricesMap.set(normalizeSymbol(symbol), {
          symbol,
          price: data.price,
          bid: data.bid ?? data.price,
          ask: data.ask ?? data.price,
          spread: (data.ask ?? data.price) - (data.bid ?? data.price),
          timestamp: data.timestamp,
          source: 'mt5',
          isValid: true,
        });
      }
      setPrices(pricesMap);

      const spx = pricesMap.get('SPX');
      setSp500(spx ? {
        price: spx.price,
        change: batched['SPX']?.change ?? batched['SPX500']?.change ?? 0,
        changePercent: batched['SPX']?.changePercent ?? batched['SPX500']?.changePercent ?? 0,
        timestamp: spx.timestamp,
        source: 'mt5',
      } : null);

      console.log('[Market Data] 📊 Preços atualizados (conta de plataforma):', { total: pricesMap.size });
    } catch (error) {
      console.error('[Market Data] ❌ Erro ao atualizar preços (conta de plataforma):', error);
    }
  };

  /**
   * Atualiza preços (público) — usa a corretora pessoal quando conectada;
   * senão cai pra conta de plataforma (nunca fica vazio por falta de
   * credencial pessoal).
   */
  const refreshPrices = useCallback(async () => {
    if (isConnected && mt5Credentials) {
      const validator = getMT5Validator(mt5Credentials.token, mt5Credentials.accountId);
      await refreshPricesInternal(validator);
      return;
    }

    await refreshPricesFromPlatform();
  }, [isConnected, mt5Credentials, watchedSymbols]);

  /**
   * Obtém preço de um símbolo específico
   */
  const getPrice = useCallback((symbol: string): ValidatedPrice | null => {
    return prices.get(normalizeSymbol(symbol)) || null;
  }, [prices]);

  /**
   * Adiciona símbolo para monitoramento
   */
  const addSymbol = useCallback((symbol: string) => {
    setWatchedSymbols(prev => {
      if (prev.includes(normalizeSymbol(symbol))) return prev;
      return [...prev, normalizeSymbol(symbol)];
    });
  }, []);

  /**
   * Remove símbolo do monitoramento
   */
  const removeSymbol = useCallback((symbol: string) => {
    setWatchedSymbols(prev => prev.filter(s => s !== normalizeSymbol(symbol)));
  }, []);

  /**
   * Auto-atualização a cada 5 segundos
   *
   * ✅ 2026-07-12: não depende mais de `isConnected` — sem corretora pessoal,
   * `refreshPrices` já cai pra conta de plataforma (ver refreshPricesFromPlatform).
   */
  useEffect(() => {
    if (!isInitialized) {
      console.log('[Market Data] ⏸️ Auto-refresh pausado (aguardando inicialização)');
      return;
    }

    // ✅ Carregar preços iniciais
    let isMounted = true;
    
    const loadInitial = async () => {
      if (isMounted) {
        await refreshPrices();
      }
    };
    
    loadInitial();

    // ✅ Auto-atualização com proteção contra unmount
    const interval = setInterval(() => {
      if (isMounted) {
        refreshPrices();
      }
    }, 5000); // A cada 5 segundos

    // 🧹 CLEANUP: Prevenir memory leaks e IframeMessageAbortError
    return () => {
      isMounted = false;
      clearInterval(interval);
      console.log('[Market Data] 🧹 Auto-refresh cleanup executado');
    };
  }, [isConnected, isInitialized]); // ✅ Apenas depende do status de conexão

  /**
   * Log de status
   */
  useEffect(() => {
    console.log('[Market Data] Status:', {
      connected: isConnected,
      pricesCount: prices.size,
      sp500Price: sp500?.price,
      watchedSymbols: watchedSymbols.length
    });
  }, [isConnected, prices.size, sp500, watchedSymbols.length]);

  const value: MarketDataContextType = {
    prices,
    sp500,
    isConnected,
    isConnecting,
    connect,
    disconnect,
    getPrice,
    refreshPrices,
    watchedSymbols,
    addSymbol,
    removeSymbol
  };

  return (
    <MarketDataContext.Provider value={value}>
      {children}
    </MarketDataContext.Provider>
  );
};

/**
 * Hook para acessar dados de mercado globalmente
 */
export const useMarketData = () => {
  const context = useContext(MarketDataContext);
  if (!context) {
    throw new Error('useMarketData deve ser usado dentro de MarketDataProvider');
  }
  return context;
};

/**
 * Hook específico para o S&P 500
 */
export const useSP500 = () => {
  const { sp500 } = useMarketData();
  return sp500;
};

/**
 * Hook para obter preço de um símbolo específico
 */
export const useSymbolPrice = (symbol: string) => {
  const { getPrice, addSymbol } = useMarketData();
  
  useEffect(() => {
    addSymbol(symbol);
  }, [symbol, addSymbol]);
  
  return getPrice(symbol);
};