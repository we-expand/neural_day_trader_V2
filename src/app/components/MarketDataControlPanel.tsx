/**
 * 🎛️ MARKET DATA CONTROL PANEL
 * Painel central de controle do MT5 Validator
 * Gerencia conexão e monitora dados em tempo real para TODA a plataforma
 */

import { useState } from 'react';
import { Shield, CheckCircle, AlertTriangle, Wifi, WifiOff, TrendingUp, RefreshCw, Settings, Eye, EyeOff } from 'lucide-react';
import { useMarketData } from '@/app/contexts/MarketDataContext';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface Props {
  className?: string;
  compact?: boolean; // Modo compacto para sidebar
}

export const MarketDataControlPanel = ({ className = '', compact = false }: Props) => {
  const {
    prices,
    sp500,
    isConnected,
    isConnecting,
    connect,
    disconnect,
    refreshPrices,
    watchedSymbols
  } = useMarketData();

  const [apiToken, setApiToken] = useState('');
  const [accountId, setAccountId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [isExpanded, setIsExpanded] = useState(!compact);

  /**
   * Conectar ao MT5
   */
  const handleConnect = async () => {
    if (!apiToken || !accountId) {
      toast.error('Preencha o Token e Account ID');
      return;
    }

    const success = await connect(apiToken, accountId);
    
    if (success) {
      toast.success('MT5 conectado! Dados reais disponíveis para toda a plataforma.');
      setShowForm(false);
    } else {
      toast.error('Falha ao conectar ao MT5. Usando dados de fallback.');
    }
  };

  /**
   * Desconectar
   */
  const handleDisconnect = async () => {
    await disconnect();
    toast.info('MT5 desconectado. Usando dados de fallback.');
  };

  // Modo compacto (sidebar)
  if (compact) {
    return (
      <div className={`bg-neutral-900 border border-neutral-800 rounded-lg ${className}`}>
        {/* Header Compacto */}
        <div
          className="flex items-center justify-between p-3 cursor-pointer hover:bg-neutral-800/50 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-white uppercase">MT5 Data</span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
            }`} />
            {isExpanded ? <EyeOff className="w-3 h-3 text-neutral-400" /> : <Eye className="w-3 h-3 text-neutral-400" />}
          </div>
        </div>

        {/* Conteúdo Expandido */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-neutral-800"
            >
              <div className="p-3 space-y-3">
                {/* Status */}
                <div className="text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-neutral-500">Status:</span>
                    <span className={`font-bold ${isConnected ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isConnected ? 'Conectado' : 'Desconectado'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">Símbolos:</span>
                    <span className="font-bold text-white">{prices.size}/{watchedSymbols.length}</span>
                  </div>
                </div>

                {/* S&P 500 */}
                {sp500 && (
                  <div className="bg-neutral-800/50 rounded p-2">
                    <div className="text-xs text-neutral-500 mb-1">S&P 500</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-bold text-white">{sp500.price.toFixed(2)}</span>
                      <span className={`text-xs font-bold ${sp500.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {sp500.changePercent >= 0 ? '+' : ''}{sp500.changePercent.toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-xs text-neutral-600 mt-1">
                      {sp500.source === 'mt5' ? 'MT5' : 'Fallback'}
                    </div>
                  </div>
                )}

                {/* Ações */}
                <div className="flex gap-2">
                  {!isConnected ? (
                    <button
                      onClick={() => setShowForm(!showForm)}
                      className="flex-1 px-2 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-bold uppercase"
                    >
                      Conectar
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={refreshPrices}
                        className="flex-1 px-2 py-1 bg-neutral-700 hover:bg-neutral-600 text-white rounded text-xs font-bold uppercase"
                      >
                        <RefreshCw className="w-3 h-3 mx-auto" />
                      </button>
                      <button
                        onClick={handleDisconnect}
                        className="flex-1 px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-bold uppercase"
                      >
                        Desconectar
                      </button>
                    </>
                  )}
                </div>

                {/* Form de Conexão */}
                {showForm && !isConnected && (
                  <div className="space-y-2 pt-2 border-t border-neutral-800">
                    <input
                      type="password"
                      value={apiToken}
                      onChange={(e) => setApiToken(e.target.value)}
                      placeholder="API Token"
                      className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-white text-xs focus:outline-none focus:border-cyan-500"
                    />
                    <input
                      type="text"
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                      placeholder="Account ID"
                      className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-white text-xs focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      onClick={handleConnect}
                      disabled={isConnecting}
                      className="w-full px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold uppercase disabled:opacity-50"
                    >
                      {isConnecting ? 'Conectando...' : 'Confirmar'}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Modo completo (dashboard principal)
  return (
    <div className={`bg-neutral-950 text-white rounded-2xl border border-neutral-800 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
            <Shield className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white uppercase tracking-wide">Market Data Control</h3>
            <p className="text-sm text-neutral-400">Dados em tempo real via MT5 para toda a plataforma</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Badge */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
            isConnected
              ? 'bg-emerald-500/20 border-emerald-500/30'
              : 'bg-red-500/20 border-red-500/30'
          }`}>
            {isConnected ? (
              <>
                <Wifi className="w-5 h-5 text-emerald-400" />
                <div className="text-left">
                  <div className="text-xs font-bold text-emerald-400 uppercase">Conectado</div>
                  <div className="text-xs text-emerald-300/60">Dados Reais MT5</div>
                </div>
              </>
            ) : (
              <>
                <WifiOff className="w-5 h-5 text-red-400" />
                <div className="text-left">
                  <div className="text-xs font-bold text-red-400 uppercase">Desconectado</div>
                  <div className="text-xs text-red-300/60">Usando Fallback</div>
                </div>
              </>
            )}
          </div>

          {/* Botão de Atualizar */}
          <button
            onClick={refreshPrices}
            className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
            title="Atualizar preços"
          >
            <RefreshCw className="w-5 h-5 text-neutral-400" />
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="p-6">
        {/* Formulário de Conexão */}
        {!isConnected && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 mb-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-white uppercase">Conectar ao MT5</h4>
              <Settings className="w-4 h-4 text-neutral-500" />
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">
                  MetaAPI Token
                </label>
                <input
                  type="password"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder="seu-metaapi-token-aqui"
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">
                  Account ID (MT5)
                </label>
                <input
                  type="text"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  placeholder="sua-conta-mt5"
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className={`w-full px-4 py-3 rounded-lg font-bold text-sm uppercase transition-all ${
                  isConnecting
                    ? 'bg-neutral-700 text-neutral-400 cursor-not-allowed'
                    : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-lg shadow-cyan-500/30'
                }`}
              >
                {isConnecting ? 'Conectando...' : 'Conectar ao MT5'}
              </button>
            </div>

            <p className="text-xs text-neutral-500 mt-3 leading-relaxed">
              <strong className="text-amber-400">Importante:</strong> A conexão MT5 fornecerá dados em tempo real 
              para TODOS os módulos da plataforma (AI Preditiva, Performance, Dashboard, etc.)
            </p>
          </motion.div>
        )}

        {/* Dashboard de Dados */}
        {isConnected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {/* S&P 500 Destaque */}
            {sp500 && (
              <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-purple-400" />
                    <h4 className="text-lg font-bold text-white uppercase">S&P 500</h4>
                  </div>
                  <div className={`text-xs font-bold px-2 py-1 rounded ${
                    sp500.source === 'mt5'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {sp500.source.toUpperCase()}
                  </div>
                </div>

                <div className="flex items-baseline gap-4">
                  <div className="text-3xl font-bold text-white">
                    {sp500.price.toFixed(2)}
                  </div>
                  <div className={`text-lg font-bold ${
                    sp500.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {sp500.changePercent >= 0 ? '+' : ''}{sp500.changePercent.toFixed(2)}%
                  </div>
                </div>

                <p className="text-xs text-neutral-400 mt-2">
                  Usado globalmente para correlações e análises • Atualização: {new Date(sp500.timestamp).toLocaleTimeString('pt-BR')}
                </p>
              </div>
            )}

            {/* Grid de Preços */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from(prices.values()).map((price) => (
                <div
                  key={price.symbol}
                  className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-3 hover:border-cyan-500/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-white">{price.symbol}</span>
                    <div className={`w-2 h-2 rounded-full ${
                      price.source === 'mt5' ? 'bg-emerald-500' : 'bg-amber-500'
                    }`} />
                  </div>
                  <div className="text-lg font-bold text-white mb-1">
                    ${price.price.toFixed(2)}
                  </div>
                  <div className="text-xs text-neutral-500">
                    Spread: {((price.spread / price.price) * 100).toFixed(3)}%
                  </div>
                </div>
              ))}
            </div>

            {/* Info e Ações */}
            <div className="flex items-center justify-between p-4 bg-neutral-900/50 border border-neutral-800 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <div>
                  <div className="text-sm font-bold text-white">
                    Dados Sincronizados
                  </div>
                  <div className="text-xs text-neutral-400">
                    {prices.size} símbolos ativos • Atualização a cada 5s
                  </div>
                </div>
              </div>

              <button
                onClick={handleDisconnect}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-sm uppercase transition-all"
              >
                Desconectar
              </button>
            </div>
          </motion.div>
        )}

        {/* Info quando desconectado */}
        {!isConnected && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-amber-400 mb-1">Usando Dados de Fallback</h4>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  A plataforma está funcionando com dados simulados realistas. 
                  Conecte ao MT5 para obter preços em tempo real e máxima precisão.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
