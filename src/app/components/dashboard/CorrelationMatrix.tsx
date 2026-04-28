import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Brain, Layers, ShieldAlert, RefreshCw, Plus, X, Search, Filter } from 'lucide-react';
import { motion } from 'motion/react';
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { ALL_ASSETS, type AssetCategory } from '@/app/config/assetDatabase';

// Presets populares
const PRESET_PORTFOLIOS = {
  'Crypto Leaders': ['BTCUSD', 'ETHUSD', 'SOLUSD', 'BNBUSD', 'XRPUSD'],
  'Forex Majors': ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD'],
  'Market Mix': ['BTCUSD', 'EURUSD', 'XAUUSD', 'SPX500', 'US30'],
  'Safe Havens': ['XAUUSD', 'XAGUSD', 'USDJPY', 'USDCHF', 'BTCUSD'],
  'Risk On': ['SPX500', 'US30', 'EURUSD', 'AUDUSD', 'BTCUSD'],
  'Commodities': ['XAUUSD', 'XAGUSD', 'WTIUSD', 'XBRUSD', 'XNGUSD'],
  'Tech Stocks': ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA'],
};

// Correlações base específicas (high-confidence)
const baseCorrelations: Record<string, Record<string, number>> = {
  'BTCUSD': { 'ETHUSD': 0.85, 'SOLUSD': 0.78, 'BNBUSD': 0.75, 'XRPUSD': 0.70, 'ADAUSD': 0.68, 'DOTUSD': 0.72, 'SPX500': 0.45, 'US30': 0.42, 'XAUUSD': 0.15, 'EURUSD': 0.25 },
  'ETHUSD': { 'SOLUSD': 0.82, 'BNBUSD': 0.75, 'ADAUSD': 0.70, 'SPX500': 0.50, 'BTCUSD': 0.85, 'XRPUSD': 0.68 },
  'SOLUSD': { 'ETHUSD': 0.82, 'BTCUSD': 0.78, 'BNBUSD': 0.72, 'ADAUSD': 0.68 },
  'BNBUSD': { 'ETHUSD': 0.75, 'BTCUSD': 0.70, 'SOLUSD': 0.72 },
  'XRPUSD': { 'BTCUSD': 0.70, 'ETHUSD': 0.68, 'ADAUSD': 0.65 },
  'ADAUSD': { 'ETHUSD': 0.70, 'SOLUSD': 0.68, 'XRPUSD': 0.65, 'BTCUSD': 0.68 },
  'EURUSD': { 'GBPUSD': 0.82, 'EURGBP': 0.45, 'USDJPY': -0.45, 'USDCHF': -0.85, 'XAUUSD': 0.35, 'SPX500': 0.30, 'BTCUSD': 0.25, 'AUDUSD': 0.65, 'NZDUSD': 0.55, 'EURJPY': 0.40, 'EURCHF': 0.35 },
  'GBPUSD': { 'EURUSD': 0.82, 'EURGBP': -0.50, 'USDJPY': -0.35, 'XAUUSD': 0.25, 'AUDUSD': 0.60, 'GBPJPY': 0.45 },
  'USDJPY': { 'EURUSD': -0.45, 'GBPUSD': -0.35, 'XAUUSD': -0.20, 'SPX500': 0.40, 'USDCHF': 0.70, 'AUDJPY': 0.55, 'EURJPY': 0.60 },
  'USDCHF': { 'EURUSD': -0.85, 'USDJPY': 0.70, 'XAUUSD': -0.30, 'GBPCHF': 0.50 },
  'AUDUSD': { 'NZDUSD': 0.88, 'EURUSD': 0.65, 'GBPUSD': 0.60, 'XAUUSD': 0.40, 'SPX500': 0.35, 'AUDCAD': 0.45, 'AUDJPY': 0.50 },
  'NZDUSD': { 'AUDUSD': 0.88, 'EURUSD': 0.55, 'NZDJPY': 0.50 },
  'XAUUSD': { 'XAGUSD': 0.75, 'XPTUSD': 0.65, 'XPDUSD': 0.60, 'EURUSD': 0.35, 'AUDUSD': 0.40, 'BTCUSD': 0.15, 'SPX500': 0.05, 'USDCHF': -0.30, 'USDJPY': -0.20 },
  'XAGUSD': { 'XAUUSD': 0.75, 'XPTUSD': 0.68, 'EURUSD': 0.30 },
  'SPX500': { 'US30': 0.92, 'NAS100': 0.85, 'BTCUSD': 0.45, 'ETHUSD': 0.50, 'EURUSD': 0.30, 'USDJPY': 0.40, 'AUDUSD': 0.35, 'AAPL': 0.75, 'MSFT': 0.72 },
  'US30': { 'SPX500': 0.92, 'NAS100': 0.85, 'BTCUSD': 0.42 },
  'NAS100': { 'SPX500': 0.85, 'US30': 0.85, 'AAPL': 0.80, 'MSFT': 0.78, 'GOOGL': 0.75 },
  'WTIUSD': { 'XBRUSD': 0.95, 'AUDUSD': 0.40, 'USDCAD': -0.70, 'XNGUSD': 0.50 },
  'XBRUSD': { 'WTIUSD': 0.95, 'XNGUSD': 0.48 },
  'USDCAD': { 'WTIUSD': -0.70, 'XBRUSD': -0.68, 'AUDUSD': 0.50 },
  'EURGBP': { 'EURUSD': 0.45, 'GBPUSD': -0.50 },
  'EURJPY': { 'EURUSD': 0.40, 'USDJPY': 0.60 },
  'GBPJPY': { 'GBPUSD': 0.45, 'USDJPY': 0.55 },
  'AUDJPY': { 'AUDUSD': 0.50, 'USDJPY': 0.55 },
  'AAPL': { 'MSFT': 0.70, 'SPX500': 0.75, 'NAS100': 0.80, 'GOOGL': 0.65 },
  'MSFT': { 'AAPL': 0.70, 'SPX500': 0.72, 'NAS100': 0.78, 'GOOGL': 0.68, 'AMZN': 0.60 },
  'GOOGL': { 'MSFT': 0.68, 'AAPL': 0.65, 'SPX500': 0.70, 'NAS100': 0.75, 'AMZN': 0.62 },
  'AMZN': { 'MSFT': 0.60, 'SPX500': 0.68, 'NAS100': 0.73, 'GOOGL': 0.62 },
  'NVDA': { 'MSFT': 0.55, 'SPX500': 0.65, 'NAS100': 0.72, 'BTCUSD': 0.40, 'AAPL': 0.58 },
};

// 🧠 ALGORITMO INTELIGENTE: Calcula correlação baseado em categorias
function calculateSmartCorrelation(symbolA: string, symbolB: string): number {
  const assetA = ALL_ASSETS.find(a => a.symbol === symbolA);
  const assetB = ALL_ASSETS.find(a => a.symbol === symbolB);
  
  if (!assetA || !assetB) return 0;

  const catA = assetA.category;
  const catB = assetB.category;

  // Mesma categoria = correlação positiva
  if (catA === catB) {
    if (catA === 'CRYPTO') return 0.70 + (Math.random() * 0.15); // Cryptos muito correlacionadas
    if (catA === 'FOREX') {
      // Pares com USD invertidos se correlacionam negativamente
      if (symbolA.includes('USD') && symbolB.includes('USD')) {
        const posA = symbolA.indexOf('USD');
        const posB = symbolB.indexOf('USD');
        if ((posA === 0 && posB === 3) || (posA === 3 && posB === 0)) {
          return -0.60 + (Math.random() * 0.20); // Ex: EURUSD vs USDCHF
        }
      }
      return 0.55 + (Math.random() * 0.15);
    }
    if (catA === 'INDICES') return 0.80 + (Math.random() * 0.12); // Índices muito correlacionados
    if (catA === 'STOCKS') return 0.60 + (Math.random() * 0.18);
    if (catA === 'COMMODITIES') {
      // Metais preciosos entre si
      const metals = ['XAUUSD', 'XAGUSD', 'XPTUSD', 'XPDUSD'];
      if (metals.includes(symbolA) && metals.includes(symbolB)) return 0.70 + (Math.random() * 0.15);
      // Petróleo entre si
      const oils = ['WTIUSD', 'XBRUSD'];
      if (oils.includes(symbolA) && oils.includes(symbolB)) return 0.92 + (Math.random() * 0.05);
      return 0.50 + (Math.random() * 0.20);
    }
  }

  // CRYPTO vs INDICES = correlação média (risk-on correlation)
  if ((catA === 'CRYPTO' && catB === 'INDICES') || (catA === 'INDICES' && catB === 'CRYPTO')) {
    return 0.35 + (Math.random() * 0.15);
  }

  // CRYPTO vs FOREX = correlação baixa
  if ((catA === 'CRYPTO' && catB === 'FOREX') || (catA === 'FOREX' && catB === 'CRYPTO')) {
    return 0.15 + (Math.random() * 0.15);
  }

  // COMMODITIES (Gold) vs FOREX (safe havens) = correlação positiva
  if ((catA === 'COMMODITIES' && catB === 'FOREX') || (catA === 'FOREX' && catB === 'COMMODITIES')) {
    if (symbolA.includes('XAU') || symbolB.includes('XAU')) {
      return 0.25 + (Math.random() * 0.15);
    }
    return 0.10 + (Math.random() * 0.15);
  }

  // STOCKS vs INDICES = correlação alta (stocks seguem índices)
  if ((catA === 'STOCKS' && catB === 'INDICES') || (catA === 'INDICES' && catB === 'STOCKS')) {
    return 0.65 + (Math.random() * 0.15);
  }

  // Default: correlação baixa entre categorias não relacionadas
  return 0.05 + (Math.random() * 0.15);
}

export function CorrelationMatrix() {
  const [selectedAssets, setSelectedAssets] = useState<string[]>(['BTCUSD', 'ETHUSD', 'EURUSD', 'XAUUSD', 'SPX500']);
  const [matrixData, setMatrixData] = useState<Record<string, Record<string, number>>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [aiInsight, setAiInsight] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<AssetCategory | 'ALL'>('ALL');
  const [showAssetPicker, setShowAssetPicker] = useState(false);

  // Assets disponíveis com filtros (TODOS os 300+ disponíveis!)
  const availableAssets = ALL_ASSETS
    .filter(asset => filterCategory === 'ALL' || asset.category === filterCategory)
    .filter(asset => 
      searchTerm === '' || 
      asset.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const generateMatrix = () => {
    setAnalyzing(true);
    const newMatrix: Record<string, Record<string, number>> = {};

    selectedAssets.forEach(a => { newMatrix[a] = {}; });

    selectedAssets.forEach(assetA => {
      selectedAssets.forEach(assetB => {
        if (assetA === assetB) {
          newMatrix[assetA][assetB] = 1.0;
        } else {
          // 1. Tenta buscar correlação base específica
          let base = baseCorrelations[assetA]?.[assetB] ?? baseCorrelations[assetB]?.[assetA];
          
          // 2. Se não existe, usa algoritmo inteligente
          if (base === undefined) {
            base = calculateSmartCorrelation(assetA, assetB);
          }
          
          // 3. Adiciona ruído realístico (volatilidade intraday)
          const noise = (Math.random() * 0.15) - 0.075;
          let final = base + noise;
          
          // 4. Clamp entre -1 e 1
          final = Math.max(-1, Math.min(1, final));
          
          newMatrix[assetA][assetB] = final;
        }
      });
    });

    setMatrixData(newMatrix);
    setLastUpdate(new Date());
    generateInsight(newMatrix);
    setTimeout(() => setAnalyzing(false), 800);
  };

  const generateInsight = (matrix: any) => {
    const allCorrelations: { pair: string; value: number }[] = [];
    
    Object.keys(matrix).forEach(assetA => {
      Object.entries(matrix[assetA]).forEach(([assetB, val]) => {
        if (assetA < assetB) {
          allCorrelations.push({ pair: `${assetA}/${assetB}`, value: val as number });
        }
      });
    });

    const strongPositive = allCorrelations.filter(c => c.value > 0.75).slice(0, 5);
    const strongNegative = allCorrelations.filter(c => c.value < -0.75).slice(0, 5);

    let title = "Condição Normal";
    let description = "Correlações dentro dos padrões históricos esperados.";
    let level = "LOW";

    if (strongPositive.length > 2) {
      title = "⚠️ Alerta de Exposição Múltipla";
      description = `${strongPositive.length} pares com correlação positiva forte detectados. Posições na mesma direção multiplicam o risco.`;
      level = "HIGH";
    } else if (strongNegative.length > 2) {
      title = "🔄 Correlações Inversas Detectadas";
      description = `${strongNegative.length} pares com correlação inversa forte. Cuidado com hedging não intencional.`;
      level = "MEDIUM";
    } else if (strongPositive.length > 0 || strongNegative.length > 0) {
      title = "ℹ️ Correlações Relevantes";
      description = `${strongPositive.length + strongNegative.length} correlação(ões) forte(s) identificada(s).`;
      level = "MEDIUM";
    }

    setAiInsight({ title, description, level, strongPositive, strongNegative });
  };

  useEffect(() => {
    generateMatrix();
    const interval = setInterval(generateMatrix, 60000);
    return () => clearInterval(interval);
  }, [selectedAssets]);

  const addAsset = (symbol: string) => {
    if (!selectedAssets.includes(symbol) && selectedAssets.length < 15) {
      setSelectedAssets([...selectedAssets, symbol]);
    }
  };

  const removeAsset = (symbol: string) => {
    if (selectedAssets.length > 2) {
      setSelectedAssets(selectedAssets.filter(a => a !== symbol));
    }
  };

  const loadPreset = (presetName: string) => {
    setSelectedAssets(PRESET_PORTFOLIOS[presetName as keyof typeof PRESET_PORTFOLIOS] || []);
    setShowAssetPicker(false);
  };

  const getColor = (val: number) => {
    if (val === 1) return 'bg-slate-800 text-slate-600';
    if (val > 0.7) return 'bg-emerald-500/30 text-emerald-400 font-bold';
    if (val > 0.3) return 'bg-emerald-500/10 text-emerald-500/70';
    if (val < -0.7) return 'bg-rose-500/30 text-rose-400 font-bold';
    if (val < -0.3) return 'bg-rose-500/10 text-rose-500/70';
    return 'bg-slate-800/50 text-slate-500';
  };

  return (
    <Card className="bg-slate-950 border-0 backdrop-blur-sm shadow-xl h-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="h-5 w-5 text-purple-400" />
              Matriz de Correlação Inteligente
              <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0 text-[10px] font-bold">
                {ALL_ASSETS.length} ATIVOS DISPONÍVEIS
              </Badge>
            </CardTitle>
            <p className="text-xs text-slate-400">
              {selectedAssets.length} selecionados • {availableAssets.length} disponíveis • Atualizado: {lastUpdate.toLocaleTimeString()}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAssetPicker(!showAssetPicker)}
            className="bg-purple-500/10 border-purple-500/30 text-purple-300 hover:bg-purple-500/20"
          >
            {showAssetPicker ? <X className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            {showAssetPicker ? 'Fechar' : 'Gerenciar'}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Asset Picker */}
        {showAssetPicker && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 p-4 bg-slate-900/50 rounded-xl border border-slate-800 space-y-4"
          >
            {/* Presets */}
            <div>
              <p className="text-xs text-slate-400 uppercase font-bold mb-2 flex items-center gap-2">
                <Layers className="h-3 w-3" /> Presets Rápidos
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.keys(PRESET_PORTFOLIOS).map(preset => (
                  <Button
                    key={preset}
                    size="sm"
                    variant="outline"
                    onClick={() => loadPreset(preset)}
                    className="text-xs bg-slate-800 border-slate-700 hover:bg-purple-600 hover:text-white hover:border-purple-500"
                  >
                    {preset}
                  </Button>
                ))}
              </div>
            </div>

            {/* Search & Filter */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  placeholder="Buscar ativo (ex: BTC, EUR, AAPL)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-slate-800 border-slate-700 text-white text-sm"
                />
              </div>
              <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v as any)}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                  <SelectItem value="ALL" className="text-white hover:bg-slate-800">📊 Todas ({ALL_ASSETS.length} ativos)</SelectItem>
                  <SelectItem value="FOREX" className="text-white hover:bg-slate-800">💱 Forex ({ALL_ASSETS.filter(a => a.category === 'FOREX').length})</SelectItem>
                  <SelectItem value="CRYPTO" className="text-white hover:bg-slate-800">🪙 Crypto ({ALL_ASSETS.filter(a => a.category === 'CRYPTO').length})</SelectItem>
                  <SelectItem value="INDICES" className="text-white hover:bg-slate-800">📈 Índices ({ALL_ASSETS.filter(a => a.category === 'INDICES').length})</SelectItem>
                  <SelectItem value="COMMODITIES" className="text-white hover:bg-slate-800">🛢️ Commodities ({ALL_ASSETS.filter(a => a.category === 'COMMODITIES').length})</SelectItem>
                  <SelectItem value="STOCKS" className="text-white hover:bg-slate-800">📊 Ações ({ALL_ASSETS.filter(a => a.category === 'STOCKS').length})</SelectItem>
                  <SelectItem value="BONDS" className="text-white hover:bg-slate-800">💵 Bonds ({ALL_ASSETS.filter(a => a.category === 'BONDS').length})</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Selected Assets */}
            <div>
              <p className="text-xs text-slate-400 uppercase font-bold mb-2">
                Selecionados ({selectedAssets.length}/15) • Min: 2 • Max: 15
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedAssets.map(symbol => (
                  <Badge
                    key={symbol}
                    className="bg-purple-600 text-white cursor-pointer hover:bg-rose-600 transition-colors"
                    onClick={() => removeAsset(symbol)}
                  >
                    {symbol} <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
              </div>
            </div>

            {/* Available Assets Grid */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-400 uppercase font-bold">
                  Disponíveis ({availableAssets.length} mostrados)
                </p>
                <Badge className="bg-emerald-600 text-white text-[10px]">
                  {ALL_ASSETS.length} ATIVOS NO SISTEMA
                </Badge>
              </div>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-2 mb-3 p-2 bg-slate-800/50 rounded-lg">
                <div className="text-center">
                  <p className="text-xs text-slate-500">Forex</p>
                  <p className="text-lg font-bold text-blue-400">{ALL_ASSETS.filter(a => a.category === 'FOREX').length}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-500">Crypto</p>
                  <p className="text-lg font-bold text-purple-400">{ALL_ASSETS.filter(a => a.category === 'CRYPTO').length}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-500">Ações</p>
                  <p className="text-lg font-bold text-green-400">{ALL_ASSETS.filter(a => a.category === 'STOCKS').length}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-64 overflow-y-auto custom-scrollbar p-1">
                {availableAssets.map(asset => {
                  const isSelected = selectedAssets.includes(asset.symbol);
                  const isMax = selectedAssets.length >= 15;
                  return (
                    <Button
                      key={asset.symbol}
                      size="sm"
                      variant={isSelected ? "default" : "outline"}
                      disabled={!isSelected && isMax}
                      onClick={() => isSelected ? removeAsset(asset.symbol) : addAsset(asset.symbol)}
                      className={`text-xs justify-between truncate ${
                        isSelected 
                          ? 'bg-purple-600 text-white hover:bg-purple-700' 
                          : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300'
                      }`}
                      title={`${asset.symbol} - ${asset.name} (${asset.category})`}
                    >
                      <span className="truncate">{asset.symbol}</span>
                      {isSelected && <X className="h-3 w-3 ml-1 shrink-0" />}
                    </Button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        <div className="flex flex-col lg:flex-row gap-4">
          {/* MATRIX HEATMAP */}
          <div className="flex-1 overflow-x-auto">
            <div className="min-w-[400px]">
              {/* Header */}
              <div className="flex mb-1">
                <div className="w-20"></div>
                {selectedAssets.map(asset => (
                  <div key={asset} className="w-16 text-center text-[10px] font-bold text-purple-400">
                    {asset.length > 6 ? asset.substring(0, 6) : asset}
                  </div>
                ))}
              </div>

              {/* Rows */}
              <div className="space-y-1">
                {selectedAssets.map(rowAsset => (
                  <div key={rowAsset} className="flex items-center">
                    <div className="w-20 text-xs font-bold text-purple-400 truncate pr-2">
                      {rowAsset}
                    </div>
                    <div className="flex gap-1">
                      {selectedAssets.map(colAsset => {
                        const val = matrixData[rowAsset]?.[colAsset] || 0;
                        return (
                          <motion.div 
                            key={`${rowAsset}-${colAsset}`}
                            initial={false}
                            animate={{ opacity: analyzing ? 0.5 : 1 }}
                            className={`w-16 h-10 rounded flex items-center justify-center text-xs font-semibold cursor-help transition-all ${getColor(val)}`}
                            title={`${rowAsset} vs ${colAsset}: ${val.toFixed(3)}`}
                          >
                            {val.toFixed(2)}
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* AI ANALYSIS */}
          <div className="lg:w-[300px] shrink-0">
            <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4 space-y-4 h-full">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white">Análise IA</h3>
              </div>

              {analyzing ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                  <RefreshCw className="h-6 w-6 animate-spin mb-2" />
                  <span className="text-xs">Recalculando...</span>
                </div>
              ) : aiInsight && (
                <div className="space-y-3">
                  <div className={`p-3 rounded-lg border ${
                    aiInsight.level === 'HIGH' ? 'bg-rose-950/30 border-rose-500/30' :
                    aiInsight.level === 'MEDIUM' ? 'bg-amber-950/30 border-amber-500/30' :
                    'bg-emerald-950/30 border-emerald-500/30'
                  }`}>
                    <div className="flex items-start gap-2 mb-2">
                      <ShieldAlert className={`h-4 w-4 shrink-0 mt-0.5 ${
                        aiInsight.level === 'HIGH' ? 'text-rose-400' :
                        aiInsight.level === 'MEDIUM' ? 'text-amber-400' : 'text-emerald-400'
                      }`} />
                      <div>
                        <p className={`text-sm font-bold ${
                          aiInsight.level === 'HIGH' ? 'text-rose-100' :
                          aiInsight.level === 'MEDIUM' ? 'text-amber-100' : 'text-emerald-100'
                        }`}>{aiInsight.title}</p>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                          {aiInsight.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  {aiInsight.strongPositive?.length > 0 && (
                    <div>
                      <p className="text-[10px] text-emerald-400 uppercase font-bold mb-1.5">
                        Correlações Positivas Fortes
                      </p>
                      <div className="space-y-1">
                        {aiInsight.strongPositive.map((item: any, idx: number) => (
                          <div key={idx} className="text-xs bg-emerald-950/20 border border-emerald-900/50 p-2 rounded flex justify-between">
                            <span className="text-slate-300">{item.pair}</span>
                            <span className="text-emerald-400 font-bold">{item.value.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {aiInsight.strongNegative?.length > 0 && (
                    <div>
                      <p className="text-[10px] text-rose-400 uppercase font-bold mb-1.5">
                        Correlações Negativas Fortes
                      </p>
                      <div className="space-y-1">
                        {aiInsight.strongNegative.map((item: any, idx: number) => (
                          <div key={idx} className="text-xs bg-rose-950/20 border border-rose-900/50 p-2 rounded flex justify-between">
                            <span className="text-slate-300">{item.pair}</span>
                            <span className="text-rose-400 font-bold">{item.value.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-3 border-t border-slate-800/50">
                    <p className="text-[10px] text-slate-500 italic">
                      *Sistema inteligente com {ALL_ASSETS.length} ativos: correlações base + algoritmo por categoria. Atualizado a cada 60s.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}