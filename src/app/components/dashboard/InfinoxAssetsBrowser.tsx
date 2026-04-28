import React, { useState, useEffect } from 'react';
import { X, Search, TrendingUp, TrendingDown, Clock, Circle, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getInfinoxAssetsByCategory, INFINOX_CATEGORY_NAMES } from '@/config/infinoxAssets';
import { fetchRealPricesBatch } from '@/app/utils/realPriceProvider'; // 🆕 NOVO PROVEDOR
import { getMarketStatus } from '@/app/utils/marketStatus';
import { comparePricesBatch } from '@/app/utils/priceDebugger';

interface InfinoxAssetsBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAsset: string;
  onSelectAsset: (symbol: string) => void;
}

interface AssetData {
  symbol: string;
  price: number;
  change: number;
}

export function InfinoxAssetsBrowser({ isOpen, onClose, selectedAsset, onSelectAsset }: InfinoxAssetsBrowserProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [assetPrices, setAssetPrices] = useState<Record<string, AssetData>>({});
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [autocompleteResults, setAutocompleteResults] = useState<string[]>([]);
  const [selectedAutocompleteIndex, setSelectedAutocompleteIndex] = useState(-1);

  // Obter todos os ativos por categoria (300+)
  const allAssets = getInfinoxAssetsByCategory();
  
  // 🆕 AUTOCOMPLETE INTELIGENTE
  useEffect(() => {
    if (!searchTerm || searchTerm.length < 1) {
      setAutocompleteResults([]);
      setSelectedAutocompleteIndex(-1);
      return;
    }
    
    // Buscar todos os ativos que contêm o termo (não apenas startsWith)
    const allSymbols = Object.values(allAssets).flat();
    const matches = allSymbols
      .filter(symbol => symbol.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => {
        // Priorizar matches que começam com o termo
        const aStarts = a.toLowerCase().startsWith(searchTerm.toLowerCase());
        const bStarts = b.toLowerCase().startsWith(searchTerm.toLowerCase());
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.localeCompare(b);
      })
      .slice(0, 10); // Top 10 resultados
    
    console.log(`[Autocomplete] Busca "${searchTerm}": ${matches.length} resultados`, matches);
    
    setAutocompleteResults(matches);
    setSelectedAutocompleteIndex(-1);
  }, [searchTerm, allAssets]);
  
  // 🆕 KEYBOARD NAVIGATION (Arrow Up/Down, Enter, Escape)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (autocompleteResults.length === 0) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedAutocompleteIndex(prev => 
          prev < autocompleteResults.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedAutocompleteIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedAutocompleteIndex >= 0) {
          const selected = autocompleteResults[selectedAutocompleteIndex];
          setSearchTerm(selected);
          setAutocompleteResults([]);
          onSelectAsset(selected);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setAutocompleteResults([]);
        setSelectedAutocompleteIndex(-1);
        break;
    }
  };

  // ✅ Buscar preços reais quando o modal abrir
  useEffect(() => {
    if (!isOpen) return;

    const fetchPrices = async () => {
      setIsLoadingPrices(true);
      
      // Buscar TODOS os ativos (300+)
      const allSymbols = Object.values(allAssets).flat();
      
      console.log(`[InfinoxAssetsBrowser] 🔄 Buscando preços REAIS de ${allSymbols.length} ativos usando Yahoo Finance + Binance...`);

      // 🆕 USAR NOVO PROVEDOR DE PREÇOS REAIS (Yahoo Finance + Binance)
      const priceData = await fetchRealPricesBatch(allSymbols);
      
      // Converter para formato esperado
      const prices: Record<string, AssetData> = {};
      let successCount = 0;
      
      Object.entries(priceData).forEach(([symbol, data]) => {
        prices[symbol] = {
          symbol,
          price: data.price,
          change: data.changePercent // ✅ CORRIGIDO: era changePercent24h (inexistente)
        };
        
        if (data.source !== 'FALLBACK') {
          successCount++;
        }
      });
      
      setAssetPrices(prices);
      
      console.log(`[InfinoxAssetsBrowser] ✅ Concluído: ${successCount}/${allSymbols.length} preços reais obtidos`);
      setIsLoadingPrices(false);
    };

    fetchPrices();
  }, [isOpen]);

  // Filtrar ativos baseado na pesquisa e categoria selecionada
  const filteredCategories = Object.entries(allAssets)
    .map(([categoryKey, symbols]) => {
      const filtered = symbols.filter(symbol =>
        symbol.toLowerCase().includes(searchTerm.toLowerCase())
      );

      return {
        categoryKey,
        categoryName: INFINOX_CATEGORY_NAMES[categoryKey] || categoryKey,
        symbols: filtered
      };
    })
    .filter(cat => {
      if (selectedCategory && cat.categoryKey !== selectedCategory) return false;
      return cat.symbols.length > 0;
    });

  // Calcular total de ativos
  const totalAssets = Object.values(allAssets).reduce((sum, symbols) => sum + symbols.length, 0);

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
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100]"
          />

          {/* Modal - SEGUINDO DESIGN SYSTEM DA PLATAFORMA */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-4 md:inset-8 lg:inset-16 bg-[#020202] border border-white/10 rounded-3xl z-[101] flex flex-col overflow-hidden shadow-2xl"
          >
            {/* Background Noise */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none" />

            {/* ========== HEADER ========== */}
            <div className="relative z-10 shrink-0 px-6 py-5 border-b border-white/5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_#10B981]" />
                    <span className="text-[10px] font-bold text-slate-500 tracking-[0.2em] uppercase">Infinox</span>
                  </div>
                  <h1 className="text-3xl font-bold tracking-tighter text-white">
                    NAVEGADOR DE <span className="text-slate-600">ATIVOS</span>
                  </h1>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    {totalAssets} instrumentos disponíveis • Dados em tempo real
                  </p>
                </div>
                
                <button
                  onClick={onClose}
                  className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 z-20" />
                <input
                  type="text"
                  placeholder="Buscar símbolo (Ex: US500, BTCUSD, EURUSD)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#080808] border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all relative z-10"
                  autoFocus
                  onKeyDown={handleKeyDown}
                />
                
                {/* 🆕 Autocomplete Dropdown */}
                {autocompleteResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-[#0A0A0A] border border-emerald-500/30 rounded-xl overflow-hidden shadow-2xl z-50"
                  >
                    {autocompleteResults.map((result, index) => (
                      <button
                        key={result}
                        onClick={() => {
                          setSearchTerm(result);
                          setAutocompleteResults([]);
                          onSelectAsset(result);
                        }}
                        className={`w-full px-4 py-3 text-left text-sm font-bold transition-colors ${
                          index === selectedAutocompleteIndex 
                            ? 'bg-emerald-500/20 text-emerald-400' 
                            : 'text-white hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Search className="w-3 h-3 text-emerald-500" />
                          <span>{result}</span>
                          {assetPrices[result] && (
                            <span className={`ml-auto text-xs ${
                              assetPrices[result].change >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {assetPrices[result].change >= 0 ? '+' : ''}{assetPrices[result].change.toFixed(2)}%
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                    
                    <div className="px-4 py-2 bg-white/5 border-t border-white/5">
                      <p className="text-[10px] text-slate-500 font-medium">
                        ↑↓ Navegar • Enter Selecionar • Esc Fechar
                      </p>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* ========== CONTENT ========== */}
            <div className="relative z-10 flex-1 overflow-y-auto px-6 py-6">
              {filteredCategories.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                  <Search className="w-16 h-16 mb-4 opacity-20" />
                  <p className="text-sm font-medium">Nenhum ativo encontrado</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredCategories.map((category) => {
                    const marketStatus = getMarketStatus(category.categoryKey);
                    
                    return (
                      <div key={category.categoryKey}>
                        {/* Category Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-1 h-5 rounded-full ${
                              category.categoryKey === 'CRYPTO' ? 'bg-orange-500' :
                              category.categoryKey === 'INDICES' ? 'bg-blue-500' :
                              category.categoryKey === 'FOREX' ? 'bg-green-500' :
                              category.categoryKey === 'COMMODITIES' ? 'bg-yellow-500' :
                              category.categoryKey === 'STOCKS' ? 'bg-purple-500' :
                              'bg-emerald-500'
                            }`} />
                            <h3 className={`text-sm font-bold uppercase tracking-wider ${
                              category.categoryKey === 'CRYPTO' ? 'text-orange-400' :
                              category.categoryKey === 'INDICES' ? 'text-blue-400' :
                              category.categoryKey === 'FOREX' ? 'text-green-400' :
                              category.categoryKey === 'COMMODITIES' ? 'text-yellow-400' :
                              category.categoryKey === 'STOCKS' ? 'text-purple-400' :
                              'text-white'
                            }`}>
                              {category.categoryName}
                            </h3>
                            <span className="text-xs text-slate-500 font-medium">
                              {category.symbols.length}
                            </span>
                          </div>
                          
                          {/* Market Status */}
                          <div className={`flex items-center gap-2 px-3 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${
                            marketStatus.isOpen
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                          }`}>
                            <Circle className={`w-1.5 h-1.5 fill-current ${marketStatus.isOpen ? 'animate-pulse' : ''}`} />
                            {marketStatus.status}
                          </div>
                        </div>
                        
                        {/* Assets Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                          {category.symbols.map((symbol) => {
                            const isSelected = selectedAsset === symbol;
                            const priceData = assetPrices[symbol];
                            const hasPrice = !!priceData;
                            const isPositive = priceData ? priceData.change >= 0 : null;

                            return (
                              <button
                                key={symbol}
                                onClick={() => {
                                  console.log('[InfinoxAssetsBrowser] Selecionando ativo:', symbol);
                                  onSelectAsset(symbol);
                                }}
                                className={`group relative p-3 rounded-xl border transition-all text-left ${
                                  isSelected
                                    ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                                    : 'bg-[#080808] border-white/5 hover:bg-[#0A0A0A] hover:border-white/10'
                                }`}
                              >
                                {/* Symbol */}
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    {/* 🆕 Bolinha de Status do Mercado (Verde = Aberto / Vermelho = Fechado) */}
                                    <div className={`w-1.5 h-1.5 rounded-full ${
                                      marketStatus.isOpen 
                                        ? 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)] animate-pulse' 
                                        : 'bg-rose-500 shadow-[0_0_4px_rgba(244,63,94,0.6)]'
                                    }`} />
                                    
                                    <span className={`text-sm font-bold tracking-tight ${
                                      isSelected ? 'text-emerald-400' : 'text-white'
                                    }`}>
                                      {symbol}
                                    </span>
                                  </div>
                                  
                                  {isSelected && (
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                  )}
                                </div>
                                
                                {/* Price & Change */}
                                {hasPrice ? (
                                  <div className="space-y-1">
                                    <div className="text-xs font-mono text-slate-400">
                                      ${priceData.price.toLocaleString('en-US', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: priceData.price >= 100 ? 2 : 6
                                      })}
                                    </div>
                                    <div className={`flex items-center gap-1 text-xs font-bold ${
                                      isPositive ? 'text-emerald-400' : 'text-rose-400'
                                    }`}>
                                      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                      {isPositive ? '+' : ''}{priceData.change.toFixed(2)}%
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-xs text-slate-600">
                                    Sem dados
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ========== FOOTER ========== */}
            <div className="relative z-10 shrink-0 px-6 py-4 border-t border-white/5 bg-[#080808]/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs text-slate-400 font-medium">
                      Dados ao vivo
                    </span>
                  </div>
                  
                  {isLoadingPrices && (
                    <>
                      <div className="w-px h-4 bg-white/10" />
                      <span className="text-xs text-slate-500 font-medium">
                        Atualizando preços...
                      </span>
                    </>
                  )}
                </div>
                
                <div className="text-xs text-slate-500 font-medium">
                  Selecionado: <span className="text-emerald-400 font-bold">{selectedAsset || 'Nenhum'}</span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}