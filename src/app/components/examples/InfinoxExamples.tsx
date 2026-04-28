/**
 * 📚 EXEMPLOS DE USO DOS COMPONENTES INFINOX
 * 
 * Este arquivo demonstra como usar os componentes e funções
 * do sistema de ativos Infinox na plataforma Neural Day Trader
 */

import React, { useState } from 'react';
import { AssetSelector } from '../dashboard/AssetSelector';
import { AssetSpecsSelector } from '../AssetSpecsSelector';
import { InfinoxAssetsBrowser } from '../dashboard/InfinoxAssetsBrowser';
import { InfinoxStatsWidget, InfinoxStatsCard } from '../dashboard/InfinoxStatsWidget';
import { 
  getInfinoxAssetsByCategory, 
  isInfinoxAsset, 
  getInfinoxCategory,
  getInfinoxStats 
} from '@/config/infinoxAssets';
import { getContractSpec } from '@/config/contractSpecs';

/**
 * 🎯 EXEMPLO 1: Asset Selector Modal
 * Modal elegante para seleção rápida de ativos
 */
export function Example1_AssetSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('EURUSD');

  return (
    <div className="p-6 bg-[#0a0a0a] rounded-xl border border-white/10">
      <h2 className="text-xl font-bold text-white mb-4">
        Exemplo 1: Asset Selector Modal
      </h2>
      
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
      >
        Abrir Seletor de Ativos
      </button>

      <div className="mt-4 p-3 bg-white/5 rounded-lg">
        <p className="text-sm text-slate-400">Ativo selecionado:</p>
        <p className="text-lg font-bold text-white mt-1">{selectedSymbol}</p>
      </div>

      <AssetSelector
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSelect={(symbol) => {
          setSelectedSymbol(symbol);
          console.log('Ativo selecionado:', symbol);
        }}
        currentSymbol={selectedSymbol}
      />
    </div>
  );
}

/**
 * 🎯 EXEMPLO 2: Asset Browser Completo
 * Navegador completo com todas as categorias
 */
export function Example2_AssetBrowser() {
  const [selectedAsset, setSelectedAsset] = useState('EURUSD');

  return (
    <div className="p-6 bg-[#0a0a0a] rounded-xl border border-white/10">
      <h2 className="text-xl font-bold text-white mb-4">
        Exemplo 2: Asset Browser Completo
      </h2>
      
      <div className="h-[600px]">
        <InfinoxAssetsBrowser
          onSelectAsset={(symbol) => {
            setSelectedAsset(symbol);
            console.log('Navegando para:', symbol);
          }}
          selectedAsset={selectedAsset}
        />
      </div>
    </div>
  );
}

/**
 * 🎯 EXEMPLO 3: Asset Specs Selector
 * Seletor com especificações detalhadas de contrato
 */
export function Example3_AssetSpecs() {
  const [selectedAsset, setSelectedAsset] = useState('EURUSD');

  return (
    <div className="p-6 bg-[#0a0a0a] rounded-xl border border-white/10">
      <h2 className="text-xl font-bold text-white mb-4">
        Exemplo 3: Asset Specs Selector
      </h2>
      
      <AssetSpecsSelector
        onSelectAsset={setSelectedAsset}
        selectedAsset={selectedAsset}
        className="max-w-4xl"
      />
    </div>
  );
}

/**
 * 🎯 EXEMPLO 4: Stats Widgets
 * Widgets de estatísticas dos ativos
 */
export function Example4_StatsWidgets() {
  return (
    <div className="p-6 bg-[#0a0a0a] rounded-xl border border-white/10 space-y-6">
      <h2 className="text-xl font-bold text-white mb-4">
        Exemplo 4: Stats Widgets
      </h2>
      
      {/* Widget Compacto */}
      <div>
        <h3 className="text-sm font-bold text-slate-400 mb-2">Widget Compacto:</h3>
        <InfinoxStatsWidget />
      </div>

      {/* Card Completo */}
      <div>
        <h3 className="text-sm font-bold text-slate-400 mb-2">Card Completo:</h3>
        <InfinoxStatsCard />
      </div>
    </div>
  );
}

/**
 * 🎯 EXEMPLO 5: Usando Funções Utilitárias
 * Demonstração das funções de consulta
 */
export function Example5_UtilityFunctions() {
  const [testSymbol, setTestSymbol] = useState('EURUSD');
  
  // Testar funções
  const isAvailable = isInfinoxAsset(testSymbol);
  const category = getInfinoxCategory(testSymbol);
  const spec = isAvailable ? getContractSpec(testSymbol) : null;
  const stats = getInfinoxStats();

  return (
    <div className="p-6 bg-[#0a0a0a] rounded-xl border border-white/10">
      <h2 className="text-xl font-bold text-white mb-4">
        Exemplo 5: Funções Utilitárias
      </h2>
      
      {/* Input de teste */}
      <div className="mb-6">
        <label className="block text-sm text-slate-400 mb-2">
          Testar Símbolo:
        </label>
        <input
          type="text"
          value={testSymbol}
          onChange={(e) => setTestSymbol(e.target.value.toUpperCase())}
          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
          placeholder="Ex: EURUSD, AAPL, BTCUSD"
        />
      </div>

      {/* Resultados */}
      <div className="space-y-4">
        {/* Is Available */}
        <div className="p-4 bg-white/5 rounded-lg">
          <p className="text-sm text-slate-400 mb-1">isInfinoxAsset('{testSymbol}'):</p>
          <p className={`text-lg font-bold ${isAvailable ? 'text-green-400' : 'text-red-400'}`}>
            {isAvailable ? '✅ Disponível' : '❌ Não Disponível'}
          </p>
        </div>

        {/* Category */}
        {isAvailable && (
          <div className="p-4 bg-white/5 rounded-lg">
            <p className="text-sm text-slate-400 mb-1">getInfinoxCategory('{testSymbol}'):</p>
            <p className="text-lg font-bold text-purple-400">
              {category}
            </p>
          </div>
        )}

        {/* Contract Spec */}
        {spec && (
          <div className="p-4 bg-white/5 rounded-lg">
            <p className="text-sm text-slate-400 mb-3">getContractSpec('{testSymbol}'):</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-500">Descrição:</span>
                <p className="text-white font-medium">{spec.description}</p>
              </div>
              <div>
                <span className="text-slate-500">Valor/Ponto:</span>
                <p className="text-green-400 font-bold">{spec.currency} {spec.pointValue.toFixed(2)}</p>
              </div>
              <div>
                <span className="text-slate-500">Tick Size:</span>
                <p className="text-blue-400 font-mono">{spec.tickSize.toFixed(5)}</p>
              </div>
              <div>
                <span className="text-slate-500">Min Lote:</span>
                <p className="text-yellow-400 font-bold">{spec.minLotSize}</p>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="p-4 bg-white/5 rounded-lg">
          <p className="text-sm text-slate-400 mb-3">getInfinoxStats():</p>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Total de Ativos:</span>
              <span className="text-white font-bold">{stats.total}</span>
            </div>
            {Object.entries(stats.byCategory).slice(0, 5).map(([cat, count]) => (
              <div key={cat} className="flex justify-between">
                <span className="text-slate-400">{cat}:</span>
                <span className="text-purple-400 font-bold">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 🎯 EXEMPLO 6: Listar Ativos por Categoria
 * Visualização simples de ativos por categoria
 */
export function Example6_ListByCategory() {
  const [selectedCategory, setSelectedCategory] = useState('FOREX');
  const assetsByCategory = getInfinoxAssetsByCategory();
  const categories = Object.keys(assetsByCategory);

  return (
    <div className="p-6 bg-[#0a0a0a] rounded-xl border border-white/10">
      <h2 className="text-xl font-bold text-white mb-4">
        Exemplo 6: Listar Ativos por Categoria
      </h2>
      
      {/* Seletor de Categoria */}
      <div className="mb-4">
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500"
        >
          {categories.map(cat => (
            <option key={cat} value={cat}>
              {cat} ({assetsByCategory[cat].length} ativos)
            </option>
          ))}
        </select>
      </div>

      {/* Lista de Ativos */}
      <div className="p-4 bg-white/5 rounded-lg max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
        <div className="grid grid-cols-3 gap-2">
          {assetsByCategory[selectedCategory].map(symbol => (
            <div
              key={symbol}
              className="p-2 bg-white/5 rounded border border-white/10 hover:bg-white/10 transition-colors"
            >
              <p className="text-sm font-mono text-white">{symbol}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 🎯 EXEMPLO COMPLETO: Demonstração de Todos os Componentes
 */
export function InfinoxCompleteExample() {
  return (
    <div className="min-h-screen bg-black p-8 space-y-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-2">
          🏦 Infinox Assets - Exemplos de Uso
        </h1>
        <p className="text-slate-400 mb-8">
          Demonstração completa dos componentes e funções do sistema de ativos Infinox
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Example1_AssetSelector />
          <Example4_StatsWidgets />
          <div className="lg:col-span-2">
            <Example2_AssetBrowser />
          </div>
          <div className="lg:col-span-2">
            <Example3_AssetSpecs />
          </div>
          <Example5_UtilityFunctions />
          <Example6_ListByCategory />
        </div>
      </div>
    </div>
  );
}

export default InfinoxCompleteExample;
