/**
 * 📊 ASSET BROWSER
 * 
 * Navegador profissional de ativos
 * - Categorias organizadas
 * - Busca em tempo real
 * - Filtros avançados
 * - Visual igual ao MetaTrader 5
 */

import React, { useState, useMemo } from 'react';
import { Search, Filter, TrendingUp, TrendingDown, Star, X } from 'lucide-react';
import {
  ALL_ASSETS,
  Asset,
  AssetCategory,
  AssetSubCategory,
  searchAssets,
  getAssetsByCategory,
  getAssetsBySubCategory,
} from '@/app/config/assetDatabase';

interface AssetBrowserProps {
  onAssetSelect?: (asset: Asset) => void;
  selectedAsset?: string;
  favorites?: string[];
  onToggleFavorite?: (symbol: string) => void;
  compact?: boolean;
}

export const AssetBrowser: React.FC<AssetBrowserProps> = ({
  onAssetSelect,
  selectedAsset,
  favorites = [],
  onToggleFavorite,
  compact = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory | 'ALL' | 'FAVORITES'>('ALL');
  const [selectedSubCategory, setSelectedSubCategory] = useState<AssetSubCategory | 'ALL'>('ALL');

  // Categorias disponíveis
  const categories: Array<{ id: AssetCategory | 'ALL' | 'FAVORITES', name: string, icon: string }> = [
    { id: 'ALL', name: 'Todos', icon: '🌐' },
    { id: 'FAVORITES', name: 'Favoritos', icon: '⭐' },
    { id: 'FOREX', name: 'Forex', icon: '💱' },
    { id: 'CRYPTO', name: 'Crypto', icon: '🪙' },
    { id: 'INDICES', name: 'Índices', icon: '📊' },
    { id: 'COMMODITIES', name: 'Commodities', icon: '🏅' },
    { id: 'STOCKS', name: 'Ações', icon: '📈' },
    { id: 'BONDS', name: 'Títulos', icon: '📜' },
  ];

  // Subcategorias dinâmicas baseadas na categoria selecionada
  const subCategories = useMemo(() => {
    if (selectedCategory === 'ALL' || selectedCategory === 'FAVORITES') return [];

    const assets = getAssetsByCategory(selectedCategory);
    const uniqueSubs = Array.from(new Set(assets.map(a => a.subCategory)));
    return uniqueSubs;
  }, [selectedCategory]);

  // Filtrar ativos
  const filteredAssets = useMemo(() => {
    let result = ALL_ASSETS;

    // Filtro por busca
    if (searchQuery.trim()) {
      result = searchAssets(searchQuery);
    }

    // Filtro por categoria
    if (selectedCategory === 'FAVORITES') {
      result = result.filter(a => favorites.includes(a.symbol));
    } else if (selectedCategory !== 'ALL') {
      result = result.filter(a => a.category === selectedCategory);
    }

    // Filtro por subcategoria
    if (selectedSubCategory !== 'ALL') {
      result = result.filter(a => a.subCategory === selectedSubCategory);
    }

    return result;
  }, [searchQuery, selectedCategory, selectedSubCategory, favorites]);

  // Agrupar por subcategoria
  const groupedAssets = useMemo(() => {
    const groups: Record<string, Asset[]> = {};

    filteredAssets.forEach(asset => {
      const key = asset.subCategory;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(asset);
    });

    return groups;
  }, [filteredAssets]);

  return (
    <div className={`flex flex-col h-full bg-slate-900 ${compact ? '' : 'rounded-xl border border-slate-700'}`}>
      {/* HEADER */}
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          📊 Navegador de Ativos
          <span className="text-sm text-slate-400 font-normal">
            ({filteredAssets.length} ativos)
          </span>
        </h2>

        {/* BUSCA */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar ativo (ex: EURUSD, Bitcoin, Apple...)"
            className="w-full pl-10 pr-10 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* CATEGORIAS */}
        <div className="flex gap-2 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id);
                setSelectedSubCategory('ALL');
              }}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                selectedCategory === cat.id
                  ? 'bg-cyan-600 text-white shadow-lg'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>

        {/* SUBCATEGORIAS */}
        {subCategories.length > 0 && (
          <div className="flex gap-2 flex-wrap mt-3">
            <button
              onClick={() => setSelectedSubCategory('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                selectedSubCategory === 'ALL'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              Todos
            </button>
            {subCategories.map(sub => (
              <button
                key={sub}
                onClick={() => setSelectedSubCategory(sub)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedSubCategory === sub
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* LISTA DE ATIVOS */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {Object.keys(groupedAssets).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <Filter className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg font-bold">Nenhum ativo encontrado</p>
            <p className="text-sm">Tente ajustar os filtros</p>
          </div>
        ) : (
          Object.entries(groupedAssets).map(([subCat, assets]) => (
            <div key={subCat}>
              {/* SUBCATEGORIA HEADER */}
              <h3 className="text-sm font-bold text-cyan-400 mb-3 flex items-center gap-2 sticky top-0 bg-slate-900 py-2">
                <span className="w-2 h-2 bg-cyan-400 rounded-full"></span>
                {subCat}
                <span className="text-slate-600">({assets.length})</span>
              </h3>

              {/* ATIVOS */}
              <div className="space-y-2">
                {assets.map(asset => {
                  const isFavorite = favorites.includes(asset.symbol);
                  const isSelected = selectedAsset === asset.symbol;

                  return (
                    <div
                      key={asset.symbol}
                      onClick={() => onAssetSelect?.(asset)}
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all group ${
                        isSelected
                          ? 'bg-cyan-600 shadow-lg'
                          : 'bg-slate-800 hover:bg-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* ÍCONE */}
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-xl flex-shrink-0">
                          {asset.icon || '💹'}
                        </div>

                        {/* INFO */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className={`font-bold ${isSelected ? 'text-white' : 'text-white'}`}>
                              {asset.symbol}
                            </h4>
                            {asset.leverage && (
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                isSelected ? 'bg-cyan-700 text-cyan-100' : 'bg-slate-700 text-slate-400'
                              }`}>
                                {asset.leverage}:1
                              </span>
                            )}
                          </div>
                          <p className={`text-xs truncate ${isSelected ? 'text-cyan-100' : 'text-slate-400'}`}>
                            {asset.name}
                          </p>
                        </div>
                      </div>

                      {/* ACTIONS */}
                      <div className="flex items-center gap-2 ml-2">
                        {/* FAVORITO */}
                        {onToggleFavorite && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleFavorite(asset.symbol);
                            }}
                            className={`p-2 rounded-lg transition-all ${
                              isFavorite
                                ? 'text-yellow-400 hover:text-yellow-300'
                                : 'text-slate-600 hover:text-yellow-400 opacity-0 group-hover:opacity-100'
                            }`}
                          >
                            <Star className="w-4 h-4" fill={isFavorite ? 'currentColor' : 'none'} />
                          </button>
                        )}

                        {/* SETA */}
                        <div className={`${isSelected ? 'text-white' : 'text-slate-600'}`}>
                          →
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* FOOTER */}
      <div className="p-4 border-t border-slate-700 bg-slate-800">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <span>💱 {ALL_ASSETS.filter(a => a.category === 'FOREX').length} Forex</span>
            <span>🪙 {ALL_ASSETS.filter(a => a.category === 'CRYPTO').length} Crypto</span>
            <span>📊 {ALL_ASSETS.filter(a => a.category === 'INDICES').length} Índices</span>
            <span>🏅 {ALL_ASSETS.filter(a => a.category === 'COMMODITIES').length} Commodities</span>
          </div>
          <div className="font-bold text-cyan-400">
            {ALL_ASSETS.length} Total
          </div>
        </div>
      </div>
    </div>
  );
};
