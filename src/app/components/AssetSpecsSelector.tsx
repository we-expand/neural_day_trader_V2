import React, { useState, useMemo } from 'react';
import { CONTRACT_SPECS, getContractSpec, type ContractSpec } from '@/config/contractSpecs';
import { getInfinoxAssetsByCategory, isInfinoxAsset, getInfinoxCategory } from '@/config/infinoxAssets';
import { Search, TrendingUp, DollarSign, Zap } from 'lucide-react';

interface AssetSpecsSelectorProps {
  onSelectAsset?: (symbol: string) => void;
  selectedAsset?: string;
  className?: string;
}

/**
 * 🎯 Seletor Visual de Ativos com Especificações - INFINOX EDITION
 * Permite filtrar e visualizar detalhes de cada ativo da corretora Infinox
 */
export function AssetSpecsSelector({ onSelectAsset, selectedAsset, className = '' }: AssetSpecsSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Obter ativos Infinox
  const infinoxAssetsByCategory = getInfinoxAssetsByCategory();

  // Categorias disponíveis
  const categories = [
    { value: 'ALL', label: 'Todos', emoji: '🌍', count: 0 },
    { value: 'FOREX', label: 'Forex', emoji: '💱', count: 0 },
    { value: 'CRYPTO', label: 'Cripto', emoji: '₿', count: 0 },
    { value: 'INDICES', label: 'Índices', emoji: '📈', count: 0 },
    { value: 'METALS', label: 'Metais', emoji: '🥇', count: 0 },
    { value: 'ENERGY', label: 'Energia', emoji: '🛢️', count: 0 },
    { value: 'COMMODITIES', label: 'Commodities', emoji: '🌾', count: 0 },
    { value: 'STOCKS_UK', label: 'Ações UK', emoji: '🇬🇧', count: 0 },
    { value: 'STOCKS_EU', label: 'Ações EU', emoji: '🇪🇺', count: 0 },
    { value: 'STOCKS_US', label: 'Ações US', emoji: '🇺🇸', count: 0 },
    { value: 'BONDS', label: 'Bonds', emoji: '📊', count: 0 },
    { value: 'FUTURES', label: 'Futuros', emoji: '📈', count: 0 },
  ];

  // Contar ativos por categoria
  const categoriesWithCount = useMemo(() => {
    const counts = categories.map(cat => {
      const count = cat.value === 'ALL' 
        ? Object.values(infinoxAssetsByCategory).flat().length
        : (infinoxAssetsByCategory[cat.value]?.length || 0);
      return { ...cat, count };
    });
    return counts.filter(cat => cat.count > 0);
  }, []);

  // Filtrar ativos
  const filteredAssets = useMemo(() => {
    let assetSymbols: string[] = [];

    // Filtro de categoria
    if (selectedCategory === 'ALL') {
      assetSymbols = Object.values(infinoxAssetsByCategory).flat();
    } else {
      assetSymbols = infinoxAssetsByCategory[selectedCategory] || [];
    }

    // Filtro de busca
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      assetSymbols = assetSymbols.filter(symbol => 
        symbol.toLowerCase().includes(query)
      );
    }

    // Mapear para ContractSpec e ordenar
    return assetSymbols
      .map(symbol => getContractSpec(symbol))
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [selectedCategory, searchQuery, infinoxAssetsByCategory]);

  return (
    <div className={`bg-neutral-900 border border-neutral-800 rounded-lg ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-neutral-800">
        <h2 className="text-lg font-semibold text-neutral-100 mb-4">
          🏦 Infinox Broker - Especificações de Contrato
        </h2>

        {/* Busca */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Buscar ativo Infinox..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Filtros de Categoria */}
        <div className="flex gap-2 flex-wrap">
          {categoriesWithCount.map(category => (
            <button
              key={category.value}
              onClick={() => setSelectedCategory(category.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedCategory === category.value
                  ? 'bg-blue-500 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
              }`}
            >
              <span className="mr-1">{category.emoji}</span>
              {category.label}
              <span className="ml-1 opacity-60">({category.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Ativos */}
      <div className="max-h-[500px] overflow-y-auto">
        {filteredAssets.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-neutral-500">Nenhum ativo Infinox encontrado</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-800">
            {filteredAssets.map(asset => (
              <AssetCard
                key={asset.symbol}
                asset={asset}
                isSelected={selectedAsset === asset.symbol}
                onClick={() => onSelectAsset?.(asset.symbol)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer com Estatísticas */}
      <div className="p-3 border-t border-neutral-800 bg-neutral-900/50">
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span>Total: {filteredAssets.length} ativos Infinox</span>
          <span>Especificações Realistas • MT5 Real-time</span>
        </div>
      </div>
    </div>
  );
}

/**
 * 📇 Card Individual de Ativo
 */
interface AssetCardProps {
  asset: ContractSpec;
  isSelected: boolean;
  onClick: () => void;
}

function AssetCard({ asset, isSelected, onClick }: AssetCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const categoryColors = {
    'FOREX': 'text-blue-400',
    'CRYPTO': 'text-purple-400',
    'INDICES': 'text-green-400',
    'COMMODITIES': 'text-yellow-400',
    'METALS': 'text-orange-400',
    'ENERGY': 'text-red-400',
    'STOCKS_BR': 'text-cyan-400',
    'STOCKS_US': 'text-indigo-400',
  };

  const categoryEmojis = {
    'FOREX': '💱',
    'CRYPTO': '₿',
    'INDICES': '📈',
    'COMMODITIES': '🌾',
    'METALS': '🥇',
    'ENERGY': '🛢️',
    'STOCKS_BR': '🇧🇷',
    'STOCKS_US': '🇺🇸',
  };

  return (
    <div
      className={`p-4 cursor-pointer transition-colors ${
        isSelected ? 'bg-blue-500/10 border-l-2 border-blue-500' : 'hover:bg-neutral-800/50'
      }`}
      onClick={onClick}
    >
      {/* Header do Card */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{categoryEmojis[asset.category]}</span>
            <h3 className="font-mono font-bold text-neutral-100">{asset.symbol}</h3>
            <span className={`text-xs px-2 py-0.5 rounded ${categoryColors[asset.category]} bg-current/10`}>
              {asset.category}
            </span>
          </div>
          <p className="text-sm text-neutral-400">{asset.description}</p>
        </div>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="text-neutral-500 hover:text-neutral-300 text-xs"
        >
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      {/* Métricas Principais */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        <div className="bg-neutral-800/50 rounded px-2 py-1.5">
          <div className="flex items-center gap-1 mb-0.5">
            <DollarSign className="w-3 h-3 text-green-400" />
            <span className="text-xs text-neutral-500">Valor/Ponto</span>
          </div>
          <p className="text-sm font-mono font-semibold text-green-400">
            {asset.currency} {asset.pointValue.toFixed(2)}
          </p>
        </div>

        <div className="bg-neutral-800/50 rounded px-2 py-1.5">
          <div className="flex items-center gap-1 mb-0.5">
            <TrendingUp className="w-3 h-3 text-blue-400" />
            <span className="text-xs text-neutral-500">Tick Size</span>
          </div>
          <p className="text-sm font-mono font-semibold text-blue-400">
            {asset.tickSize.toFixed(5)}
          </p>
        </div>

        <div className="bg-neutral-800/50 rounded px-2 py-1.5">
          <div className="flex items-center gap-1 mb-0.5">
            <Zap className="w-3 h-3 text-yellow-400" />
            <span className="text-xs text-neutral-500">Min Lote</span>
          </div>
          <p className="text-sm font-mono font-semibold text-yellow-400">
            {asset.minLotSize}
          </p>
        </div>
      </div>

      {/* Detalhes Expandidos */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-neutral-800 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-neutral-500">Tick Value:</span>
            <span className="font-mono text-neutral-300">{asset.currency} {asset.tickValue.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Contract Size:</span>
            <span className="font-mono text-neutral-300">{asset.contractSize.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Moeda:</span>
            <span className="font-mono text-neutral-300">{asset.currency}</span>
          </div>
          
          {/* Exemplo de P&L */}
          <div className="mt-3 p-2 bg-blue-500/10 border border-blue-500/20 rounded">
            <p className="text-neutral-400 mb-1">💡 Exemplo de P&L:</p>
            <p className="text-neutral-300">
              1 ponto de movimento = <strong className="text-green-400">{asset.currency} {asset.pointValue.toFixed(2)}</strong> de lucro/prejuízo para 1 lote padrão
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 📊 Versão Compacta - Dropdown Simples
 */
interface AssetSpecsDropdownProps {
  value: string;
  onChange: (symbol: string) => void;
  category?: string;
  className?: string;
}

export function AssetSpecsDropdown({ value, onChange, category, className = '' }: AssetSpecsDropdownProps) {
  const assets = useMemo(() => {
    let filtered = Object.values(CONTRACT_SPECS);
    if (category) {
      filtered = filtered.filter(asset => asset.category === category);
    }
    return filtered.sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [category]);

  const selectedAsset = getContractSpec(value);

  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
      >
        {assets.map(asset => (
          <option key={asset.symbol} value={asset.symbol}>
            {asset.symbol} - {asset.description} (${asset.pointValue}/pt)
          </option>
        ))}
      </select>
      
      {/* Info Badge */}
      <div className="mt-2 text-xs text-neutral-500">
        <span className="font-mono">{selectedAsset.pointValue.toFixed(2)} {selectedAsset.currency}</span> por ponto
        • <span className="font-mono">{selectedAsset.tickSize.toFixed(5)}</span> tick size
      </div>
    </div>
  );
}