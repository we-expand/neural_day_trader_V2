/**
 * 🔥 LIVE TRADING TEST
 * Interface de teste para execução de trades REAIS no MT5
 * 
 * ⚠️ ATENÇÃO: Este componente opera com DINHEIRO REAL!
 */

import React, { useState, useEffect } from 'react';
import { getMetaAPIClient, TradeResult } from '@/app/services/MetaAPIDirectClient';
import { 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  X, 
  DollarSign, 
  Activity,
  Shield,
  Zap,
  Target,
  Lock,
  Unlock
} from 'lucide-react';
import { toast } from 'sonner';

interface Position {
  id: string;
  symbol: string;
  type: string;
  volume: number;
  openPrice: number;
  currentPrice: number;
  profit: number;
  stopLoss?: number;
  takeProfit?: number;
}

export function LiveTradingTest() {
  const [isConnected, setIsConnected] = useState(false);
  const [liveMode, setLiveMode] = useState(false);
  const [confirmLive, setConfirmLive] = useState(false);
  
  // Trade Parameters
  const [symbol, setSymbol] = useState('BTCUSD');
  const [volume, setVolume] = useState(0.01);
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  
  // Account Info
  const [balance, setBalance] = useState(0);
  const [equity, setEquity] = useState(0);
  const [freeMargin, setFreeMargin] = useState(0);
  
  // Prices
  const [currentPrice, setCurrentPrice] = useState(0);
  const [bid, setBid] = useState(0);
  const [ask, setAsk] = useState(0);
  
  // Positions
  const [positions, setPositions] = useState<Position[]>([]);
  
  // Loading states
  const [loading, setLoading] = useState(false);
  const [executingTrade, setExecutingTrade] = useState(false);

  // Check connection status
  useEffect(() => {
    const client = getMetaAPIClient();
    setIsConnected(client.isConnected());
  }, []);

  // Refresh account info
  const refreshAccountInfo = async () => {
    try {
      const client = getMetaAPIClient();
      if (!client.isConnected()) {
        toast.error('MT5 não conectado!');
        return;
      }

      setLoading(true);
      
      const accountInfo = await client.getAccountInfo();
      if (accountInfo) {
        setBalance(accountInfo.balance);
        setEquity(accountInfo.equity);
        setFreeMargin(accountInfo.freeMargin);
      }

      const prices = await client.getPrices([symbol]);
      if (prices.length > 0) {
        setBid(prices[0].bid);
        setAsk(prices[0].ask);
        setCurrentPrice(prices[0].bid);
      }

      const openPositions = await client.getPositions();
      setPositions(openPositions || []);

      setLoading(false);
    } catch (error) {
      console.error('Erro ao atualizar info:', error);
      toast.error('Erro ao buscar informações da conta');
      setLoading(false);
    }
  };

  // Auto-refresh every 5 seconds
  useEffect(() => {
    if (isConnected) {
      refreshAccountInfo();
      const interval = setInterval(refreshAccountInfo, 5000);
      return () => clearInterval(interval);
    }
  }, [isConnected, symbol]);

  // Execute BUY order
  const executeBuy = async () => {
    if (!liveMode || !confirmLive) {
      toast.error('⛔ Ative o MODO LIVE e confirme para executar!');
      return;
    }

    try {
      setExecutingTrade(true);
      
      const client = getMetaAPIClient();
      
      const result = await client.createMarketBuyOrder({
        symbol,
        volume,
        stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
        takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
        comment: 'Neural Day Trader - LIVE TEST'
      });

      if (result.success) {
        toast.success('✅ COMPRA EXECUTADA!', {
          description: `${symbol} ${volume} lotes @ ${result.price}`,
          duration: 5000
        });
        refreshAccountInfo();
      } else {
        toast.error('❌ Falha ao executar compra', {
          description: result.error || 'Erro desconhecido',
          duration: 5000
        });
      }

      setExecutingTrade(false);
    } catch (error: any) {
      console.error('Erro ao executar compra:', error);
      toast.error('❌ ERRO CRÍTICO', {
        description: error.message,
        duration: 5000
      });
      setExecutingTrade(false);
    }
  };

  // Execute SELL order
  const executeSell = async () => {
    if (!liveMode || !confirmLive) {
      toast.error('⛔ Ative o MODO LIVE e confirme para executar!');
      return;
    }

    try {
      setExecutingTrade(true);
      
      const client = getMetaAPIClient();
      
      const result = await client.createMarketSellOrder({
        symbol,
        volume,
        stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
        takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
        comment: 'Neural Day Trader - LIVE TEST'
      });

      if (result.success) {
        toast.success('✅ VENDA EXECUTADA!', {
          description: `${symbol} ${volume} lotes @ ${result.price}`,
          duration: 5000
        });
        refreshAccountInfo();
      } else {
        toast.error('❌ Falha ao executar venda', {
          description: result.error || 'Erro desconhecido',
          duration: 5000
        });
      }

      setExecutingTrade(false);
    } catch (error: any) {
      console.error('Erro ao executar venda:', error);
      toast.error('❌ ERRO CRÍTICO', {
        description: error.message,
        duration: 5000
      });
      setExecutingTrade(false);
    }
  };

  // Close position
  const closePosition = async (positionId: string) => {
    if (!liveMode || !confirmLive) {
      toast.error('⛔ Ative o MODO LIVE e confirme para fechar posição!');
      return;
    }

    try {
      const client = getMetaAPIClient();
      
      const result = await client.closePosition(positionId);

      if (result.success) {
        toast.success('✅ POSIÇÃO FECHADA!', {
          description: result.message,
          duration: 3000
        });
        refreshAccountInfo();
      } else {
        toast.error('❌ Falha ao fechar posição', {
          description: result.error || 'Erro desconhecido',
          duration: 5000
        });
      }
    } catch (error: any) {
      console.error('Erro ao fechar posição:', error);
      toast.error('❌ ERRO CRÍTICO', {
        description: error.message,
        duration: 5000
      });
    }
  };

  // EMERGENCY: Close all positions
  const emergencyCloseAll = async () => {
    if (!liveMode || !confirmLive) {
      toast.error('⛔ Ative o MODO LIVE e confirme para usar emergência!');
      return;
    }

    const confirmed = window.confirm(
      '🚨 EMERGÊNCIA: FECHAR TODAS AS POSIÇÕES?\n\n' +
      'Esta ação é IRREVERSÍVEL!\n' +
      'Todas as posições abertas serão fechadas IMEDIATAMENTE.\n\n' +
      'Tem certeza?'
    );

    if (!confirmed) return;

    try {
      const client = getMetaAPIClient();
      
      const result = await client.closeAllPositions();

      if (result.success) {
        toast.success('🚨 EMERGÊNCIA: TODAS POSIÇÕES FECHADAS!', {
          description: result.message,
          duration: 10000
        });
        refreshAccountInfo();
      } else {
        toast.error('❌ Erro na emergência', {
          description: result.error || 'Erro desconhecido',
          duration: 5000
        });
      }
    } catch (error: any) {
      console.error('Erro no fechamento emergencial:', error);
      toast.error('❌ ERRO CRÍTICO NA EMERGÊNCIA', {
        description: error.message,
        duration: 10000
      });
    }
  };

  if (!isConnected) {
    return (
      <div className="p-8 bg-zinc-900 rounded-lg border border-red-500/50">
        <div className="flex items-center gap-3 text-red-400 mb-4">
          <AlertTriangle className="w-6 h-6" />
          <h2 className="text-xl font-bold">MT5 NÃO CONECTADO</h2>
        </div>
        <p className="text-zinc-400">
          Conecte ao MT5 através do módulo AI Trader antes de usar o Live Trading Test.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* HEADER WARNING */}
      <div className="bg-gradient-to-r from-red-900/50 to-orange-900/50 border border-red-500/50 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <AlertTriangle className="w-8 h-8 text-red-400 flex-shrink-0 mt-1" />
          <div>
            <h1 className="text-2xl font-bold text-red-400 mb-2">
              🔥 LIVE TRADING TEST - DINHEIRO REAL
            </h1>
            <p className="text-red-300 mb-3">
              Este módulo executa trades REAIS no MT5. Você está operando com DINHEIRO REAL.
            </p>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-red-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={liveMode}
                  onChange={(e) => {
                    setLiveMode(e.target.checked);
                    if (!e.target.checked) setConfirmLive(false);
                  }}
                  className="w-4 h-4"
                />
                Ativar MODO LIVE
              </label>
              {liveMode && (
                <label className="flex items-center gap-2 text-sm text-orange-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmLive}
                    onChange={(e) => setConfirmLive(e.target.checked)}
                    className="w-4 h-4"
                  />
                  Confirmo que entendo os riscos
                </label>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ACCOUNT INFO */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-zinc-800 rounded-lg p-4 border border-emerald-500/30">
          <div className="flex items-center gap-2 text-emerald-400 mb-2">
            <DollarSign className="w-4 h-4" />
            <span className="text-sm font-medium">Saldo</span>
          </div>
          <div className="text-2xl font-bold text-white">
            ${balance.toFixed(2)}
          </div>
        </div>

        <div className="bg-zinc-800 rounded-lg p-4 border border-blue-500/30">
          <div className="flex items-center gap-2 text-blue-400 mb-2">
            <Activity className="w-4 h-4" />
            <span className="text-sm font-medium">Equity</span>
          </div>
          <div className="text-2xl font-bold text-white">
            ${equity.toFixed(2)}
          </div>
        </div>

        <div className="bg-zinc-800 rounded-lg p-4 border border-purple-500/30">
          <div className="flex items-center gap-2 text-purple-400 mb-2">
            <Shield className="w-4 h-4" />
            <span className="text-sm font-medium">Margem Livre</span>
          </div>
          <div className="text-2xl font-bold text-white">
            ${freeMargin.toFixed(2)}
          </div>
        </div>
      </div>

      {/* CURRENT PRICE */}
      <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-white">{symbol}</h3>
          <button
            onClick={refreshAccountInfo}
            disabled={loading}
            className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-sm text-white disabled:opacity-50"
          >
            {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-zinc-400 mb-1">BID</div>
            <div className="text-xl font-bold text-red-400">${bid.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-400 mb-1">ASK</div>
            <div className="text-xl font-bold text-emerald-400">${ask.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-400 mb-1">SPREAD</div>
            <div className="text-xl font-bold text-amber-400">${(ask - bid).toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* TRADE FORM */}
      <div className="bg-zinc-800 rounded-lg p-6 border border-zinc-700">
        <h3 className="text-lg font-bold text-white mb-4">📊 Executar Trade</h3>
        
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Símbolo</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded text-white"
              placeholder="BTCUSD"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Volume (Lotes)</label>
            <input
              type="number"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              step="0.01"
              min="0.01"
              className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Stop Loss (opcional)</label>
              <input
                type="number"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                step="0.01"
                className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded text-white"
                placeholder="Ex: 95000"
              />
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">Take Profit (opcional)</label>
              <input
                type="number"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                step="0.01"
                className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded text-white"
                placeholder="Ex: 105000"
              />
            </div>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={executeBuy}
            disabled={!liveMode || !confirmLive || executingTrade}
            className="flex items-center justify-center gap-2 px-6 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg text-white font-bold transition-all"
          >
            {executingTrade ? (
              <>Executando...</>
            ) : (
              <>
                <TrendingUp className="w-5 h-5" />
                COMPRAR (BUY)
              </>
            )}
          </button>

          <button
            onClick={executeSell}
            disabled={!liveMode || !confirmLive || executingTrade}
            className="flex items-center justify-center gap-2 px-6 py-4 bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg text-white font-bold transition-all"
          >
            {executingTrade ? (
              <>Executando...</>
            ) : (
              <>
                <TrendingDown className="w-5 h-5" />
                VENDER (SELL)
              </>
            )}
          </button>
        </div>

        {(!liveMode || !confirmLive) && (
          <div className="mt-4 p-3 bg-amber-900/30 border border-amber-500/50 rounded text-amber-300 text-sm text-center">
            ⚠️ Ative o MODO LIVE e confirme os riscos para executar trades
          </div>
        )}
      </div>

      {/* OPEN POSITIONS */}
      {positions.length > 0 && (
        <div className="bg-zinc-800 rounded-lg p-6 border border-zinc-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">🎯 Posições Abertas ({positions.length})</h3>
            <button
              onClick={emergencyCloseAll}
              disabled={!liveMode || !confirmLive}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded text-white font-bold text-sm"
            >
              <AlertTriangle className="w-4 h-4" />
              FECHAR TODAS (EMERGÊNCIA)
            </button>
          </div>

          <div className="space-y-3">
            {positions.map((position) => (
              <div
                key={position.id}
                className="bg-zinc-900 rounded-lg p-4 border border-zinc-700"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`px-3 py-1 rounded text-sm font-bold ${
                      position.type === 'BUY' 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-red-600 text-white'
                    }`}>
                      {position.type}
                    </div>
                    <div>
                      <div className="font-bold text-white">{position.symbol}</div>
                      <div className="text-sm text-zinc-400">
                        {position.volume} lotes @ ${position.openPrice?.toFixed(2) || '---'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className={`text-lg font-bold ${
                        (position.profit || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {(position.profit || 0) >= 0 ? '+' : ''}${position.profit?.toFixed(2) || '0.00'}
                      </div>
                      <div className="text-xs text-zinc-400">
                        SL: {position.stopLoss || '---'} | TP: {position.takeProfit || '---'}
                      </div>
                    </div>

                    <button
                      onClick={() => closePosition(position.id)}
                      disabled={!liveMode || !confirmLive}
                      className="p-2 bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 rounded"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {positions.length === 0 && (
        <div className="bg-zinc-800 rounded-lg p-6 border border-zinc-700 text-center text-zinc-400">
          Nenhuma posição aberta
        </div>
      )}
    </div>
  );
}
