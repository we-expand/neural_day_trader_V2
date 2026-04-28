import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Search, 
  Star, 
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Zap,
  Globe,
  Bitcoin,
  DollarSign,
  Sparkles,
  Target,
  AlertCircle,
  AlertTriangle
} from 'lucide-react';
import { useMarketContext } from '../contexts/MarketContext';
import { VIXWidgetEnhanced } from './tools/VIXWidgetEnhanced';
import { formatCurrency, formatPercent } from '@/app/utils/formatters';

interface Asset {
  symbol: string;
  name: string;
  category: 'forex' | 'crypto' | 'indices' | 'commodities';
  icon: React.ElementType;
  color: string;
}

const ASSETS: Asset[] = [
  // Forex
  { symbol: 'EUR/USD', name: 'Euro / Dólar', category: 'forex', icon: Globe, color: 'blue' },
  { symbol: 'GBP/USD', name: 'Libra / Dólar', category: 'forex', icon: Globe, color: 'blue' },
  { symbol: 'USD/JPY', name: 'Dólar / Iene', category: 'forex', icon: Globe, color: 'blue' },
  { symbol: 'AUD/USD', name: 'Dólar Australiano', category: 'forex', icon: Globe, color: 'blue' },
  
  // Crypto
  { symbol: 'BTC/USD', name: 'Bitcoin', category: 'crypto', icon: Bitcoin, color: 'orange' },
  { symbol: 'ETH/USD', name: 'Ethereum', category: 'crypto', icon: Bitcoin, color: 'purple' },
  { symbol: 'BTCUSDT', name: 'Bitcoin (Tether)', category: 'crypto', icon: Bitcoin, color: 'orange' },
  { symbol: 'ETHUSDT', name: 'Ethereum (Tether)', category: 'crypto', icon: Bitcoin, color: 'purple' },
  
  // Índices
  { symbol: 'SP500', name: 'S&P 500', category: 'indices', icon: TrendingUp, color: 'emerald' },
  { symbol: 'SPX500', name: 'S&P 500', category: 'indices', icon: TrendingUp, color: 'emerald' },
  { symbol: 'NAS100', name: 'Nasdaq 100', category: 'indices', icon: TrendingUp, color: 'cyan' },
  { symbol: 'US30', name: 'Dow Jones 30', category: 'indices', icon: TrendingUp, color: 'yellow' },
  { symbol: 'US200', name: 'Russell 2000', category: 'indices', icon: TrendingUp, color: 'red' },
  { symbol: 'AUS200', name: 'ASX 200', category: 'indices', icon: TrendingUp, color: 'green' },
  
  // Commodities
  { symbol: 'GOLD', name: 'Ouro', category: 'commodities', icon: Sparkles, color: 'amber' },
  { symbol: 'XAUUSD', name: 'Ouro (XAU/USD)', category: 'commodities', icon: Sparkles, color: 'amber' },
];

export function Assets() {
  const { marketState } = useMarketContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'forex' | 'crypto' | 'indices' | 'commodities'>('all');
  const [favorites, setFavorites] = useState<Set<string>>(new Set(['EUR/USD', 'BTC/USD', 'SP500']));
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);

  const categories = [
    { id: 'all' as const, name: 'Todos', icon: Target },
    { id: 'forex' as const, name: 'Forex', icon: Globe },
    { id: 'crypto' as const, name: 'Crypto', icon: Bitcoin },
    { id: 'indices' as const, name: 'Índices', icon: TrendingUp },
    { id: 'commodities' as const, name: 'Commodities', icon: Sparkles },
  ];

  const filteredAssets = ASSETS.filter(asset => {
    const matchesCategory = selectedCategory === 'all' || asset.category === selectedCategory;
    const matchesSearch = asset.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         asset.symbol.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const toggleFavorite = (symbol: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(symbol)) {
        newFavorites.delete(symbol);
      } else {
        newFavorites.add(symbol);
      }
      return newFavorites;
    });
  };

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
      orange: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
      purple: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
      emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
      cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' },
      yellow: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' },
      red: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
      green: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' },
      amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="h-full bg-black overflow-auto">
      <div className="w-full h-full p-4 overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
            <Activity className="w-8 h-8 text-emerald-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight text-white uppercase">
              Ativos & Mercado
            </h1>
            <p className="text-slate-400 mt-1 tracking-wide font-light">
              300+ Ativos disponíveis • Dados em tempo real via MetaApi MT5
            </p>
          </div>
          
          {/* Market Status */}
          <div className="flex items-center gap-2 bg-zinc-950 p-2 rounded-lg border border-zinc-800">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-emerald-500/10 border border-emerald-500/20">
              <Zap className="w-3 h-3 text-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                {marketState.status === 'SYNCED' ? 'LIVE' : marketState.status}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          {/* VIX Widget - Left Side */}
          <div className="xl:col-span-3">
            <VIXWidgetEnhanced />
          </div>

          {/* Assets List - Right Side */}
          <div className="xl:col-span-9 space-y-4">
            {/* Search & Filters */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 shadow-lg">
              {/* Search Bar */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar ativos... (EUR/USD, Bitcoin, S&P 500...)"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Category Tabs */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                {categories.map((category) => {
                  const Icon = category.icon;
                  return (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
                        selectedCategory === category.id
                          ? 'bg-emerald-600 text-white'
                          : 'bg-zinc-900 text-slate-400 hover:bg-zinc-800 border border-zinc-800'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      {category.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Assets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredAssets.map((asset) => {
                const Icon = asset.icon;
                const price = marketState.prices[asset.symbol] || 0;
                const change = marketState.dailyChanges[asset.symbol] || 0;
                const isPositive = change >= 0;
                const isFavorite = favorites.has(asset.symbol);
                const colorClasses = getColorClasses(asset.color);

                return (
                  <div
                    key={asset.symbol}
                    className={`bg-zinc-950 border border-zinc-800 rounded-xl p-4 hover:border-emerald-500/50 transition-all cursor-pointer group ${
                      selectedAsset === asset.symbol ? 'ring-2 ring-emerald-500' : ''
                    }`}
                    onClick={() => setSelectedAsset(asset.symbol)}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 ${colorClasses.bg} rounded-lg border ${colorClasses.border}`}>
                          <Icon className={`w-4 h-4 ${colorClasses.text}`} />
                        </div>
                        <div>
                          <h3 className="text-white font-bold text-sm">{asset.symbol}</h3>
                          <p className="text-slate-500 text-xs">{asset.name}</p>
                        </div>
                      </div>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(asset.symbol);
                        }}
                        className={`p-1.5 rounded-lg transition-all ${
                          isFavorite 
                            ? 'bg-yellow-500/20 text-yellow-400' 
                            : 'bg-zinc-800 text-slate-500 hover:text-yellow-400'
                        }`}
                      >
                        <Star className={`w-3 h-3 ${isFavorite ? 'fill-current' : ''}`} />
                      </button>
                    </div>

                    {/* Price */}
                    <div className="mb-2">
                      <p className="text-2xl font-bold text-white font-mono">
                        {price > 0 ? formatCurrency(price) : '—'}
                      </p>
                    </div>

                    {/* Change */}
                    <div className={`flex items-center gap-1 text-sm font-semibold ${
                      isPositive ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {isPositive ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                      <span>
                        {isPositive ? '+' : ''}{change.toFixed(2)}%
                      </span>
                    </div>

                    {/* Data Source */}
                    {marketState.dataSources[asset.symbol] && (
                      <div className="mt-3 pt-3 border-t border-zinc-800">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                          {marketState.dataSources[asset.symbol]}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* No Results */}
            {filteredAssets.length === 0 && (
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-8 text-center">
                <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-white font-bold mb-2">Nenhum ativo encontrado</h3>
                <p className="text-slate-400 text-sm">
                  Tente ajustar os filtros ou a busca
                </p>
              </div>
            )}

            {/* Market Info */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <Activity className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-white">Status do Mercado</h2>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Ativos Disponíveis</p>
                  <p className="text-white text-2xl font-bold">{ASSETS.length}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Status</p>
                  <p className={`text-lg font-bold ${
                    marketState.status === 'SYNCED' ? 'text-emerald-400' : 
                    marketState.status === 'DRIFTING' ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {marketState.status}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Última Atualização</p>
                  <p className="text-white text-sm font-mono">
                    {marketState.lastUpdate.toLocaleTimeString('pt-BR')}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Favoritos</p>
                  <p className="text-white text-2xl font-bold">{favorites.size}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}