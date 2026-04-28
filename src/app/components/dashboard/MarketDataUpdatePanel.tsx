/**
 * 🎛️ PAINEL DE ATUALIZAÇÃO DE DADOS DE MERCADO
 * 
 * Permite visualizar e atualizar os valores de fallback para:
 * - S&P500, NASDAQ, Dow Jones
 * - Ouro, Prata
 * - EURUSD, GBPUSD
 */

import React, { useState, useEffect } from 'react';
import { X, RefreshCw, CheckCircle, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { fetchMarketData, updateFallbackData, getAvailableSymbols } from '@/app/utils/spxRealDataProvider';

interface MarketDataUpdatePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AssetData {
  symbol: string;
  name: string;
  category: string;
  value: number;
  change: number;
  changePercent: number;
  source: string;
  timestamp: Date;
}

export function MarketDataUpdatePanel({ isOpen, onClose }: MarketDataUpdatePanelProps) {
  const [assets, setAssets] = useState<AssetData[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Configuração dos ativos
  const assetConfig = [
    { symbol: 'SPX500', name: 'S&P 500', category: 'Índices' },
    { symbol: 'NAS100', name: 'NASDAQ 100', category: 'Índices' },
    { symbol: 'US30', name: 'Dow Jones', category: 'Índices' },
    { symbol: 'XAUUSD', name: 'Ouro', category: 'Commodities' },
    { symbol: 'XAGUSD', name: 'Prata', category: 'Commodities' },
    { symbol: 'EURUSD', name: 'EUR/USD', category: 'Forex' },
    { symbol: 'GBPUSD', name: 'GBP/USD', category: 'Forex' },
  ];

  // Buscar dados atuais
  const fetchAllData = async () => {
    setLoading(true);
    try {
      const promises = assetConfig.map(async (config) => {
        const data = await fetchMarketData(config.symbol);
        return {
          ...config,
          value: data.value,
          change: data.change,
          changePercent: data.changePercent,
          source: data.source,
          timestamp: data.timestamp,
        };
      });

      const results = await Promise.all(promises);
      setAssets(results);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('[MarketDataPanel] Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  // Buscar ao abrir
  useEffect(() => {
    if (isOpen) {
      fetchAllData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-4xl mx-4 bg-[#131722] rounded-xl border border-gray-700 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              🎛️ Painel de Dados de Mercado
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Monitore dados reais via API e valores de fallback
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Last Update Info */}
          <div className="flex items-center justify-between mb-6">
            <div className="text-sm text-gray-400">
              {lastUpdate && (
                <>
                  Última atualização: <span className="text-white font-mono">{lastUpdate.toLocaleTimeString()}</span>
                </>
              )}
            </div>
            <button
              onClick={fetchAllData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="text-sm font-semibold">Atualizar Todos</span>
            </button>
          </div>

          {/* Assets Grid */}
          <div className="space-y-6">
            {['Índices', 'Commodities', 'Forex'].map((category) => (
              <div key={category}>
                <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                  {category === 'Índices' && '📊'}
                  {category === 'Commodities' && '🥇'}
                  {category === 'Forex' && '💱'}
                  {category}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {assets
                    .filter((asset) => asset.category === category)
                    .map((asset) => (
                      <div
                        key={asset.symbol}
                        className="bg-[#1e222d] border border-gray-700 rounded-lg p-4 hover:border-blue-500/50 transition-all"
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="text-sm font-mono text-gray-400">{asset.symbol}</div>
                            <div className="text-lg font-bold text-white">{asset.name}</div>
                          </div>
                          <div className={`px-2 py-1 rounded text-xs font-bold ${
                            asset.source.includes('Real-Time')
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : asset.source.includes('Fallback')
                              ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          }`}>
                            {asset.source.includes('Real-Time') ? '🌐 REAL' : 
                             asset.source.includes('Fallback') ? '📊 FALLBACK' : 
                             '📊 DATA'}
                          </div>
                        </div>

                        {/* Price */}
                        <div className="flex items-baseline gap-2 mb-2">
                          <span className="text-2xl font-bold text-white font-mono">
                            {asset.symbol === 'SPX500' || asset.symbol === 'NAS100' || asset.symbol === 'US30'
                              ? asset.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                              : asset.value.toFixed(asset.symbol.includes('USD') && !asset.symbol.includes('XAU') ? 4 : 2)}
                          </span>
                          {asset.symbol.includes('USD') && (
                            <span className="text-sm text-gray-400">USD</span>
                          )}
                        </div>

                        {/* Change */}
                        <div className={`flex items-center gap-2 text-sm font-semibold ${
                          asset.changePercent > 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {asset.changePercent > 0 ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : (
                            <TrendingDown className="w-4 h-4" />
                          )}
                          <span>
                            {asset.changePercent > 0 ? '+' : ''}
                            {asset.change.toFixed(2)} ({asset.changePercent > 0 ? '+' : ''}
                            {asset.changePercent.toFixed(2)}%)
                          </span>
                        </div>

                        {/* Timestamp */}
                        <div className="text-xs text-gray-500 mt-2">
                          {new Date(asset.timestamp).toLocaleString()}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>

          {/* Info Box */}
          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-300">
                <div className="font-bold mb-1">ℹ️ Como funciona:</div>
                <ul className="space-y-1 text-blue-300/80">
                  <li>• <span className="text-emerald-400 font-semibold">REAL-TIME</span>: Dados obtidos via APIs financeiras (Finnhub, TwelveData)</li>
                  <li>• <span className="text-yellow-400 font-semibold">FALLBACK</span>: Valores precisos atualizados manualmente quando APIs falham</li>
                  <li>• Atualize esta página diariamente antes do mercado abrir para garantir precisão máxima</li>
                  <li>• Para treinar IA, certifique-se de que os dados estão em modo REAL-TIME</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 flex items-center justify-between">
          <div className="text-sm text-gray-400">
            {assets.filter(a => a.source.includes('Real-Time')).length}/{assets.length} ativos com dados reais
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors font-semibold"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
