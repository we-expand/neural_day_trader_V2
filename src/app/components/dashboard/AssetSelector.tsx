import React, { useState } from 'react';
import { Search, Star, TrendingUp, DollarSign, Activity, Globe, Zap, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getInfinoxAssetsByCategory, INFINOX_CATEGORY_NAMES } from '@/config/infinoxAssets';

export type AssetCategory = 'FOREX' | 'CRYPTO' | 'INDICES' | 'METALS' | 'ENERGY' | 'COMMODITIES' | 'STOCKS_UK' | 'STOCKS_EU' | 'STOCKS_US' | 'BONDS' | 'FUTURES';

interface AssetSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (symbol: string) => void;
  currentSymbol: string;
}

export function AssetSelector({ isOpen, onClose, onSelect, currentSymbol }: AssetSelectorProps) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<AssetCategory>('FOREX');

  // Obter ativos da Infinox organizados por categoria
  const infinoxAssets = getInfinoxAssetsByCategory();
  
  // Filtrar ativos baseado na pesquisa
  const filteredAssets = search 
    ? Object.entries(infinoxAssets).reduce((acc, [category, assets]) => {
        const filtered = assets.filter(symbol => 
          symbol.toLowerCase().includes(search.toLowerCase())
        );
        if (filtered.length > 0) {
          acc[category] = filtered;
        }
        return acc;
      }, {} as Record<string, string[]>)
    : { [activeTab]: infinoxAssets[activeTab] || [] };

  const categories: { id: AssetCategory; label: string; icon: React.ReactNode }[] = [
    { id: 'FOREX', label: 'Forex', icon: <DollarSign className="w-3 h-3" /> },
    { id: 'CRYPTO', label: 'Crypto', icon: <Zap className="w-3 h-3" /> },
    { id: 'INDICES', label: 'Índices', icon: <Activity className="w-3 h-3" /> },
    { id: 'METALS', label: 'Metais', icon: <Globe className="w-3 h-3" /> },
    { id: 'ENERGY', label: 'Energia', icon: <TrendingUp className="w-3 h-3" /> },
    { id: 'STOCKS_UK', label: 'Ações UK', icon: <Star className="w-3 h-3" /> },
    { id: 'STOCKS_EU', label: 'Ações EU', icon: <Star className="w-3 h-3" /> },
    { id: 'STOCKS_US', label: 'Ações US', icon: <Star className="w-3 h-3" /> },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />
          
          {/* Modal - MAIOR z-index para ficar SOBRE tudo */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 w-[700px] max-h-[80vh] bg-[#0c0c0c] border border-white/10 rounded-xl shadow-2xl z-[100] overflow-hidden flex flex-col"
          >
            {/* Header / Search */}
            <div className="p-4 border-b border-white/5 space-y-4">
               <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input 
                    autoFocus
                    type="text" 
                    placeholder="Buscar ativo Infinox (ex: EURUSD, AAPL, Gold)..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all placeholder:text-slate-600"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                     <span className="text-[10px] text-slate-600 border border-white/5 px-1.5 rounded">ESC to close</span>
                  </div>
               </div>

               {/* Tabs */}
               {!search && (
                 <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {categories.map(cat => (
                       <button
                          key={cat.id}
                          onClick={() => setActiveTab(cat.id)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                             activeTab === cat.id 
                                ? 'bg-white text-black shadow-lg' 
                                : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                          }`}
                       >
                          {cat.icon}
                          {cat.label}
                       </button>
                    ))}
                 </div>
               )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-white/10 space-y-6">
               {Object.keys(filteredAssets).length > 0 ? (
                  Object.entries(filteredAssets).map(([category, assets]) => (
                     <div key={category}>
                        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 pl-1 border-l-2 border-purple-500/50">
                           {INFINOX_CATEGORY_NAMES[category] || category} ({assets.length} ativos)
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                           {assets.map(symbol => (
                              <button
                                 key={symbol}
                                 onClick={() => {
                                    onSelect(symbol);
                                    onClose();
                                 }}
                                 className={`group flex items-center justify-between p-3 rounded-lg border border-transparent transition-all ${
                                    currentSymbol === symbol 
                                       ? 'bg-purple-500/10 border-purple-500/20' 
                                       : 'hover:bg-white/5 hover:border-white/5'
                                 }`}
                              >
                                 <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                       currentSymbol === symbol ? 'bg-purple-500 text-white' : 'bg-white/10 text-slate-400 group-hover:bg-white/20 group-hover:text-white'
                                    }`}>
                                       {symbol.substring(0,1)}
                                    </div>
                                    <div className="text-left">
                                       <div className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors flex items-center gap-2">
                                          {symbol}
                                       </div>
                                    </div>
                                 </div>
                                 
                                 <div className="text-right">
                                    <div className="text-[10px] text-emerald-500 flex items-center justify-end gap-1">
                                       <TrendingUp className="w-3 h-3" /> Live
                                    </div>
                                 </div>
                              </button>
                           ))}
                        </div>
                     </div>
                  ))
               ) : (
                  <div className="text-center py-12 text-slate-600">
                     <p>Nenhum ativo encontrado na Infinox.</p>
                  </div>
               )}
            </div>
            
            {/* Footer */}
            <div className="p-3 border-t border-white/5 bg-[#0a0a0a] text-[10px] text-slate-500 flex justify-between">
               <span>🏦 Infinox Broker - {Object.values(infinoxAssets).flat().length}+ ativos</span>
               <span className="flex items-center gap-2"><Clock className="w-3 h-3"/> Real-time MT5</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}