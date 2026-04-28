/**
 * 🎯 SIMULATOR CONTEXT
 * Gerencia ordens virtuais, P&L, histórico e saldo da conta virtual
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { toast } from 'sonner';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export type OrderType = 'BUY' | 'SELL';
export type OrderStatus = 'PENDING' | 'OPEN' | 'CLOSED';
export type CloseReason = 'MANUAL' | 'STOP_LOSS' | 'TAKE_PROFIT' | 'TRAILING_STOP';

export interface SimulatedOrder {
  id: string;
  symbol: string;
  type: OrderType;
  volume: number;
  openPrice: number;
  closePrice?: number;
  currentPrice?: number;
  pnl?: number;
  pnlPercentage?: number;
  status: OrderStatus;
  openTime: Date;
  closeTime?: Date;
  closeReason?: CloseReason;
  stopLoss?: number;
  takeProfit?: number;
  trailingStop?: number;
  highestPrice?: number; // Para trailing stop
  lowestPrice?: number;  // Para trailing stop
}

export interface VirtualAccount {
  initial: number;
  current: number;
  equity: number; // Current + Open P&L
  margin: number;
  freeMargin: number;
  peakEquity: number; // Para calcular drawdown
}

export interface TradingStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPNL: number;
  avgPNL: number;
  biggestWin: number;
  biggestLoss: number;
  currentDrawdown: number;
  maxDrawdown: number;
}

interface SimulatorContextType {
  // Estado
  openOrders: SimulatedOrder[];
  closedOrders: SimulatedOrder[];
  account: VirtualAccount;
  stats: TradingStats;
  
  // Ações
  openOrder: (symbol: string, type: OrderType, volume: number, stopLoss?: number, takeProfit?: number) => void;
  closeOrder: (orderId: string, reason?: CloseReason) => void;
  updateOrderPrices: (symbol: string, currentPrice: number) => void;
  resetAccount: () => void;
  
  // Utilidades
  getOrderById: (orderId: string) => SimulatedOrder | undefined;
  getOrdersBySymbol: (symbol: string) => SimulatedOrder[];
  getTotalOpenPNL: () => number;
}

// ═══════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════

const SimulatorContext = createContext<SimulatorContextType | undefined>(undefined);

export const useSimulator = () => {
  const context = useContext(SimulatorContext);
  if (!context) {
    throw new Error('useSimulator must be used within SimulatorProvider');
  }
  return context;
};

// ═══════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════

const INITIAL_BALANCE = 10000;

export const SimulatorProvider = ({ children }: { children: ReactNode }) => {
  const [openOrders, setOpenOrders] = useState<SimulatedOrder[]>([]);
  const [closedOrders, setClosedOrders] = useState<SimulatedOrder[]>([]);
  const [account, setAccount] = useState<VirtualAccount>({
    initial: INITIAL_BALANCE,
    current: INITIAL_BALANCE,
    equity: INITIAL_BALANCE,
    margin: 0,
    freeMargin: INITIAL_BALANCE,
    peakEquity: INITIAL_BALANCE
  });

  // ═══════════════════════════════════════════════════════
  // CALCULAR ESTATÍSTICAS
  // ═══════════════════════════════════════════════════════
  
  const calculateStats = useCallback((): TradingStats => {
    const totalTrades = closedOrders.length;
    const winningTrades = closedOrders.filter(o => (o.pnl || 0) > 0).length;
    const losingTrades = closedOrders.filter(o => (o.pnl || 0) < 0).length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const totalPNL = closedOrders.reduce((sum, o) => sum + (o.pnl || 0), 0);
    const avgPNL = totalTrades > 0 ? totalPNL / totalTrades : 0;
    const biggestWin = closedOrders.length > 0 
      ? Math.max(...closedOrders.map(o => o.pnl || 0)) 
      : 0;
    const biggestLoss = closedOrders.length > 0 
      ? Math.min(...closedOrders.map(o => o.pnl || 0)) 
      : 0;
    const currentDrawdown = ((account.peakEquity - account.equity) / account.peakEquity) * 100;
    const maxDrawdown = currentDrawdown; // Simplificado - pode ser melhorado

    return {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      totalPNL,
      avgPNL,
      biggestWin,
      biggestLoss,
      currentDrawdown,
      maxDrawdown
    };
  }, [closedOrders, account]);

  const stats = calculateStats();

  // ═══════════════════════════════════════════════════════
  // CALCULAR P&L
  // ═══════════════════════════════════════════════════════
  
  const calculatePNL = useCallback((order: SimulatedOrder, closePrice: number): number => {
    const priceDiff = order.type === 'BUY' 
      ? closePrice - order.openPrice 
      : order.openPrice - closePrice;
    
    return priceDiff * order.volume;
  }, []);

  const calculatePNLPercentage = useCallback((order: SimulatedOrder, closePrice: number): number => {
    const pnl = calculatePNL(order, closePrice);
    const invested = order.openPrice * order.volume;
    return (pnl / invested) * 100;
  }, [calculatePNL]);

  // ═══════════════════════════════════════════════════════
  // ABRIR ORDEM
  // ═══════════════════════════════════════════════════════
  
  const openOrder = useCallback((
    symbol: string, 
    type: OrderType, 
    volume: number,
    stopLoss?: number,
    takeProfit?: number
  ) => {
    // Validar se há margem suficiente
    if (account.freeMargin < volume * 100) { // Simplificado: 100 USD por lote
      toast.error('Margem insuficiente!');
      console.error('[Simulator] Margem insuficiente');
      return;
    }

    const newOrder: SimulatedOrder = {
      id: `ORD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      symbol,
      type,
      volume,
      openPrice: 0, // Será definido ao receber preço real
      status: 'PENDING',
      openTime: new Date(),
      stopLoss,
      takeProfit,
      highestPrice: 0,
      lowestPrice: Infinity
    };

    setOpenOrders(prev => [...prev, newOrder]);
    
    toast.success(
      `Ordem ${type} aberta: ${volume} lote(s) de ${symbol}`,
      { duration: 3000 }
    );

    console.log('[Simulator] 📈 Nova ordem:', newOrder);
  }, [account.freeMargin]);

  // ═══════════════════════════════════════════════════════
  // FECHAR ORDEM
  // ═══════════════════════════════════════════════════════
  
  const closeOrder = useCallback((orderId: string, reason: CloseReason = 'MANUAL') => {
    setOpenOrders(prev => {
      const order = prev.find(o => o.id === orderId);
      if (!order || !order.currentPrice) {
        console.error('[Simulator] Ordem não encontrada ou sem preço:', orderId);
        return prev;
      }

      const closePrice = order.currentPrice;
      const pnl = calculatePNL(order, closePrice);
      const pnlPercentage = calculatePNLPercentage(order, closePrice);

      const closedOrder: SimulatedOrder = {
        ...order,
        closePrice,
        pnl,
        pnlPercentage,
        status: 'CLOSED',
        closeTime: new Date(),
        closeReason: reason
      };

      // Adicionar ao histórico
      setClosedOrders(prevClosed => [closedOrder, ...prevClosed]);

      // Atualizar saldo
      setAccount(prevAccount => {
        const newCurrent = prevAccount.current + pnl;
        const newEquity = newCurrent + getTotalOpenPNL();
        const newPeakEquity = Math.max(prevAccount.peakEquity, newEquity);
        
        return {
          ...prevAccount,
          current: newCurrent,
          equity: newEquity,
          peakEquity: newPeakEquity,
          freeMargin: prevAccount.freeMargin + (order.volume * 100) // Liberar margem
        };
      });

      // Toast de feedback
      const emoji = pnl > 0 ? '🎉' : '😔';
      const color = pnl > 0 ? 'green' : 'red';
      toast.success(
        `${emoji} Ordem fechada: ${pnl > 0 ? '+' : ''}$${pnl.toFixed(2)} (${pnlPercentage > 0 ? '+' : ''}${pnlPercentage.toFixed(2)}%)`,
        { duration: 4000 }
      );

      console.log('[Simulator] 💰 Ordem fechada:', closedOrder);

      // Remover da lista de abertas
      return prev.filter(o => o.id !== orderId);
    });
  }, [calculatePNL, calculatePNLPercentage]);

  // ═══════════════════════════════════════════════════════
  // ATUALIZAR PREÇOS
  // ═══════════════════════════════════════════════════════
  
  const updateOrderPrices = useCallback((symbol: string, currentPrice: number) => {
    setOpenOrders(prev => {
      let ordersToClose: string[] = [];
      
      const updated = prev.map(order => {
        if (order.symbol !== symbol) return order;

        // Primeira atualização: definir preço de abertura
        if (order.status === 'PENDING') {
          return {
            ...order,
            openPrice: currentPrice,
            currentPrice,
            status: 'OPEN' as OrderStatus,
            highestPrice: currentPrice,
            lowestPrice: currentPrice
          };
        }

        // Atualizar preço atual e P&L
        const pnl = calculatePNL(order, currentPrice);
        const pnlPercentage = calculatePNLPercentage(order, currentPrice);
        
        // Atualizar highest/lowest para trailing stop
        const newHighest = Math.max(order.highestPrice || 0, currentPrice);
        const newLowest = Math.min(order.lowestPrice || Infinity, currentPrice);

        // Verificar Stop Loss
        if (order.stopLoss && pnl <= -order.stopLoss) {
          ordersToClose.push(order.id);
          console.log(`[Simulator] 🛑 Stop Loss atingido: ${order.id}`);
        }

        // Verificar Take Profit
        if (order.takeProfit && pnl >= order.takeProfit) {
          ordersToClose.push(order.id);
          console.log(`[Simulator] ✅ Take Profit atingido: ${order.id}`);
        }

        return {
          ...order,
          currentPrice,
          pnl,
          pnlPercentage,
          highestPrice: newHighest,
          lowestPrice: newLowest
        };
      });

      // Fechar ordens que atingiram SL/TP
      setTimeout(() => {
        ordersToClose.forEach(orderId => {
          const order = updated.find(o => o.id === orderId);
          if (order) {
            const reason = order.pnl && order.pnl < 0 ? 'STOP_LOSS' : 'TAKE_PROFIT';
            closeOrder(orderId, reason);
          }
        });
      }, 100);

      return updated;
    });

    // Atualizar equity com P&L das ordens abertas
    const openPNL = getTotalOpenPNL();
    setAccount(prev => ({
      ...prev,
      equity: prev.current + openPNL
    }));
  }, [calculatePNL, calculatePNLPercentage, closeOrder]);

  // ═══════════════════════════════════════════════════════
  // RESET
  // ═══════════════════════════════════════════════════════
  
  const resetAccount = useCallback(() => {
    setOpenOrders([]);
    setClosedOrders([]);
    setAccount({
      initial: INITIAL_BALANCE,
      current: INITIAL_BALANCE,
      equity: INITIAL_BALANCE,
      margin: 0,
      freeMargin: INITIAL_BALANCE,
      peakEquity: INITIAL_BALANCE
    });
    
    toast.success('Conta virtual resetada!');
    console.log('[Simulator] 🔄 Conta resetada');
  }, []);

  // ═══════════════════════════════════════════════════════
  // UTILIDADES
  // ═══════════════════════════════════════════════════════
  
  const getOrderById = useCallback((orderId: string) => {
    return openOrders.find(o => o.id === orderId) || 
           closedOrders.find(o => o.id === orderId);
  }, [openOrders, closedOrders]);

  const getOrdersBySymbol = useCallback((symbol: string) => {
    return openOrders.filter(o => o.symbol === symbol);
  }, [openOrders]);

  const getTotalOpenPNL = useCallback(() => {
    return openOrders.reduce((sum, order) => sum + (order.pnl || 0), 0);
  }, [openOrders]);

  // ═══════════════════════════════════════════════════════
  // CONTEXT VALUE
  // ═══════════════════════════════════════════════════════
  
  const value: SimulatorContextType = {
    openOrders,
    closedOrders,
    account,
    stats,
    openOrder,
    closeOrder,
    updateOrderPrices,
    resetAccount,
    getOrderById,
    getOrdersBySymbol,
    getTotalOpenPNL
  };

  return (
    <SimulatorContext.Provider value={value}>
      {children}
    </SimulatorContext.Provider>
  );
};
