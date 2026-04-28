import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { subscribeToMarketData, MarketDataPoint } from '../services/RealMarketDataService';

// Definição dos ativos suportados
export type AssetSymbol = 'EUR/USD' | 'BTC/USD' | 'ETH/USD' | 'SP500' | 'GOLD';

interface MarketState {
  prices: Record<string, number>;
  spreads: Record<string, number>;
  status: 'SYNCED' | 'DRIFTING' | 'DISCONNECTED';
  lastUpdate: Date;
  calibrationOffset: Record<string, number>; // Diferença entre Feed Web e MT5
  dailyChanges: Record<string, number>;
  dataSources: Record<string, string>; // ✅ NOVO: Rastreamento da fonte de dados
}

interface MarketContextType {
  marketState: MarketState;
  updatePrice: (symbol: string, price: number, change?: number) => void;
  setCalibration: (symbol: string, mt5Price: number) => void;
  calibrateAll: (mt5Data: Record<string, number>) => void;
}

const MarketContext = createContext<MarketContextType | undefined>(undefined);

export const useMarketContext = () => {
  const context = useContext(MarketContext);
  if (!context) {
    // Fallback silencioso durante hot reload / montagem inicial
    // O MarketProvider envolve tudo — se não estiver disponível é transitório
    return {
      marketState: {
        prices: {},
        spreads: {},
        status: 'DISCONNECTED' as const,
        lastUpdate: new Date(),
        calibrationOffset: {},
        dailyChanges: {},
        dataSources: {}
      },
      updatePrice: () => {},
      setCalibration: () => {},
      calibrateAll: () => {}
    };
  }
  return context;
};

export const MarketProvider = ({ children }: { children: ReactNode }) => {
  const [marketState, setMarketState] = useState<MarketState>({
    prices: {
      // ✅ VALORES INICIAIS - Serão substituídos por dados reais
      'EUR/USD': 1.0845,
      'BTC/USD': 96000.00,
      'ETH/USD': 3500.00,
      'SP500': 6800.46,
      'SPX500': 6800.46,
      'GOLD': 2650.00,
      'XAUUSD': 2650.00,
      'VIX': 13.45,
      'BTCUSDT': 96000.00,
      'ETHUSDT': 3500.00,
      'NAS100': 21000.00,
      'US30': 43000.00,
      'AUS200': 8857.54, // ✅ CORRIGIDO: Valor real do MT5
      'US200': 8857.54
    },
    spreads: {},
    status: 'SYNCED',
    lastUpdate: new Date(),
    calibrationOffset: {},
    dailyChanges: {
      'EUR/USD': 0.12,
      'BTC/USD': 0.55,
      'ETH/USD': -0.80,
      'SP500': -1.19,
      'SPX500': -1.19,
      'GOLD': 0.80,
      'VIX': -1.50
    },
    dataSources: {} // ✅ NOVO
  });

  // Função para atualizar preço vindo do Websocket/API
  const updatePrice = (symbol: string, rawPrice: number, change?: number) => {
    setMarketState(prev => {
      const offset = prev.calibrationOffset[symbol] || 0;
      // O preço final é o preço cru da API + o ajuste fino para bater com o MT5
      const finalPrice = rawPrice + offset;
      
      return {
        ...prev,
        prices: {
          ...prev.prices,
          [symbol]: finalPrice
        },
        dailyChanges: change !== undefined ? {
            ...prev.dailyChanges,
            [symbol]: change
        } : prev.dailyChanges,
        lastUpdate: new Date(),
        status: 'SYNCED'
      };
    });
  };

  // Calibrador Manual/Automático: O usuário informa o preço do MT5 e o sistema calcula o offset
  const setCalibration = (symbol: string, mt5Price: number) => {
    setMarketState(prev => {
      const currentWebPrice = prev.prices[symbol];
      // Se Web é 1.08502 e MT5 é 1.08500, o offset é -0.00002
      // Na próxima atualização, se a Web vier 1.08505, aplicamos -0.00002 -> 1.08503 (Mantendo a curva, mas ajustada ao nível do MT5)
      // *Nota: Para perfeição absoluta, idealmente o MT5 empurra o preço diretamente via Supabase.
      // Esta lógica serve para alinhar feeds externos (ex: Binance) com o MT5 do usuário.
      
      const newOffset = mt5Price - (currentWebPrice - (prev.calibrationOffset[symbol] || 0));

      return {
        ...prev,
        calibrationOffset: {
          ...prev.calibrationOffset,
          [symbol]: newOffset
        },
        prices: {
          ...prev.prices,
          [symbol]: mt5Price // Força o preço exato instantaneamente
        }
      };
    });
  };

  const calibrateAll = (mt5Data: Record<string, number>) => {
      Object.entries(mt5Data).forEach(([symbol, price]) => {
          setCalibration(symbol, price);
      });
  };

  // ✅ SISTEMA REAL DE MARKET DATA - Conecta às APIs Oficiais
  useEffect(() => {
    // ✅ REALMARKETDATASERVICE RE-HABILITADO - Proteções mantidas para prevenir IframeMessageAbortError
    console.log('[MarketContext] 🚀 Iniciando RealMarketDataService...');
    
    // Lista de ativos principais para monitorar
    const MONITORED_ASSETS = [
      // Crypto (Binance)
      'BTCUSDT', 'ETHUSDT', 'SOLUSDT',
      // Forex (MetaApi)
      'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD',
      // Índices (MetaApi)
      'SPX500', 'NAS100', 'US30', 'AUS200',
      // Metais (MetaApi)
      'XAUUSD', 'XAGUSD'
    ];
    
    // Subscrever aos dados reais
    const unsubscribe = subscribeToMarketData(
      MONITORED_ASSETS,
      (symbol: string, data: MarketDataPoint) => {
        console.log(`[MarketContext] ✅ ${symbol}:`, {
          price: data.price,
          change: data.changePercent,
          source: data.source
        });
        
        // Atualizar state
        setMarketState(prev => ({
          ...prev,
          prices: {
            ...prev.prices,
            [symbol]: data.price
          },
          dailyChanges: {
            ...prev.dailyChanges,
            [symbol]: data.changePercent
          },
          dataSources: {
            ...prev.dataSources,
            [symbol]: data.source
          },
          lastUpdate: new Date(),
          status: 'SYNCED'
        }));
      },
      120000 // Atualizar a cada 2 minutos (OTIMIZADO para economizar quota Edge Functions)
    );
    
    // Cleanup
    return () => {
      console.log('[MarketContext] 🔄 Desconectando RealMarketDataService...');
      unsubscribe();
    };
  }, []);

  return (
    <MarketContext.Provider value={{ marketState, updatePrice, setCalibration, calibrateAll }}>
      {children}
    </MarketContext.Provider>
  );
};