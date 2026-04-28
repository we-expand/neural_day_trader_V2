/**
 * 🎯 HOOK DE SPREADS
 * 
 * Gerencia aplicação de spreads em modo DEMO
 * Modo LIVE usa spreads reais do broker
 */

import { useCallback, useMemo } from 'react';
import { 
  getSpread, 
  applySpread, 
  calculateSpreadCost, 
  getSpreadInfo,
  pipsToDecimal 
} from '@/config/spreads';

export interface SpreadInfo {
  symbol: string;
  spreadPips: number;
  spreadDecimal: number;
  spreadPercentage: string;
  hasSpreads: boolean;
}

export function useSpreads(accountMode: 'DEMO' | 'LIVE') {
  /**
   * Verificar se deve aplicar spreads
   * DEMO: Sim (simular custos reais)
   * LIVE: Não (broker já aplica spreads)
   */
  const shouldApplySpreads = useMemo(() => {
    return accountMode === 'DEMO';
  }, [accountMode]);

  /**
   * Obter spread para um símbolo
   */
  const getSymbolSpread = useCallback((symbol: string): number => {
    if (!shouldApplySpreads) return 0;
    return getSpread(symbol);
  }, [shouldApplySpreads]);

  /**
   * Aplicar spread ao preço de entrada
   */
  const applyEntrySpread = useCallback((
    price: number, 
    symbol: string, 
    side: 'BUY' | 'SELL'
  ): number => {
    if (!shouldApplySpreads) return price;
    return applySpread(price, symbol, side);
  }, [shouldApplySpreads]);

  /**
   * Calcular custo do spread
   */
  const getSpreadCost = useCallback((symbol: string, lots: number): number => {
    if (!shouldApplySpreads) return 0;
    return calculateSpreadCost(symbol, lots);
  }, [shouldApplySpreads]);

  /**
   * Obter informações detalhadas do spread
   */
  const getSymbolSpreadInfo = useCallback((symbol: string): SpreadInfo => {
    return getSpreadInfo(symbol);
  }, []);

  /**
   * Converter pips para decimal
   */
  const convertPipsToDecimal = useCallback((symbol: string, pips: number): number => {
    return pipsToDecimal(symbol, pips);
  }, []);

  /**
   * Calcular preço de entrada ajustado (com spread)
   * Este é o preço que será usado para cálculo de P&L
   */
  const getAdjustedEntryPrice = useCallback((
    marketPrice: number,
    symbol: string,
    side: 'BUY' | 'SELL'
  ): number => {
    if (!shouldApplySpreads) {
      return marketPrice;
    }

    const spreadPips = getSpread(symbol);
    const spreadValue = pipsToDecimal(symbol, spreadPips);
    
    // BUY: entra a preço ASK (market + metade do spread)
    // SELL: entra a preço BID (market - metade do spread)
    if (side === 'BUY') {
      return marketPrice + (spreadValue / 2);
    } else {
      return marketPrice - (spreadValue / 2);
    }
  }, [shouldApplySpreads]);

  /**
   * Calcular P&L considerando spread
   * 
   * @param entryPrice - Preço de entrada (já com spread se DEMO)
   * @param currentPrice - Preço atual de mercado
   * @param side - BUY ou SELL
   * @param symbol - Símbolo do ativo
   * @param lots - Tamanho da posição
   * @returns P&L em USD
   */
  const calculatePnLWithSpread = useCallback((
    entryPrice: number,
    currentPrice: number,
    side: 'BUY' | 'SELL',
    symbol: string,
    lots: number
  ): number => {
    // Calcular P&L base
    let pnl = 0;
    
    if (side === 'BUY') {
      pnl = (currentPrice - entryPrice) * 100000 * lots;
    } else {
      pnl = (entryPrice - currentPrice) * 100000 * lots;
    }

    // Normalizar para USD (considerando JPY pairs, etc)
    const normalizedSymbol = symbol.toUpperCase();
    if (normalizedSymbol.includes('JPY')) {
      pnl = pnl / 100; // Ajuste para pares JPY
    }

    return pnl;
  }, []);

  return {
    shouldApplySpreads,
    getSymbolSpread,
    applyEntrySpread,
    getSpreadCost,
    getSymbolSpreadInfo,
    convertPipsToDecimal,
    getAdjustedEntryPrice,
    calculatePnLWithSpread
  };
}
