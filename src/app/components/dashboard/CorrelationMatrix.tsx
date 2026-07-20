import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Brain, Layers, ShieldAlert, RefreshCw, Plus, X, Search, Filter,
  TrendingUp, TrendingDown, GitBranch, Target, Sparkles, AlertTriangle,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { ALL_ASSETS, type AssetCategory } from '@/app/config/assetDatabase';
import { backtestDataService, BacktestDataUnavailableError } from '@/app/services/BacktestDataService';

// Presets populares (mais amplos, cobrindo mais classes de ativo por padrão)
const PRESET_PORTFOLIOS: Record<string, string[]> = {
  'Crypto Leaders': ['BTCUSD', 'ETHUSD', 'SOLUSD', 'BNBUSD', 'XRPUSD', 'ADAUSD'],
  'Forex Majors': ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'NZDUSD'],
  'Diversificado Global': ['BTCUSD', 'EURUSD', 'XAUUSD', 'SPX500', 'US30', 'USOUSD', 'GER40', 'AAPL'],
  'Safe Havens': ['XAUUSD', 'XAGUSD', 'USDJPY', 'USDCHF', 'BTCUSD'],
  'Risk On': ['SPX500', 'US30', 'NAS100', 'EURUSD', 'AUDUSD', 'BTCUSD'],
  'Commodities': ['XAUUSD', 'XAGUSD', 'USOUSD', 'UKOUSD', 'XNGUSD'],
  'Tech Stocks + Cripto': ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'BTCUSD', 'ETHUSD'],
  'Índices Globais': ['SPX500', 'US30', 'NAS100', 'GER40', 'UK100', 'JP225'],
};

const DEFAULT_ASSETS = [
  'BTCUSD', 'ETHUSD', 'SOLUSD', 'BNBUSD',
  'EURUSD', 'GBPUSD', 'USDJPY',
  'XAUUSD', 'XAGUSD', 'USOUSD',
  'SPX500', 'US30', 'NAS100', 'GER40',
  'AAPL', 'MSFT',
];
const MAX_ASSETS = 24;
const MIN_ASSETS = 2;
const INSIGHT_LIST_VISIBLE = 4; // linhas mostradas por lista antes do "+N mais" — evita clipping/overlap visual
const LOOKBACK_DAYS = 120; // ~4 meses de candles diários — janela padrão de mercado para correlação
const MIN_OVERLAP_POINTS = 15; // mínimo de retornos diários em comum para considerar a correlação confiável
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5min — correlação sobre 120 dias não muda em escala de segundos

interface CorrelationCell {
  value: number | null; // null = dados insuficientes/indisponíveis
  n: number; // tamanho da amostra usada (dias em comum)
}

type MatrixData = Record<string, Record<string, CorrelationCell>>;

interface PairInsight {
  pair: string;
  value: number;
  n: number;
}

interface AiInsight {
  title: string;
  description: string;
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  strongPositive: PairInsight[];
  relevant: PairInsight[];
  strongNegative: PairInsight[];
  diversificationScore: number; // 0-100, quanto maior mais diversificado (menos correlacionado)
  mostIndependent: { symbol: string; avgAbsCorr: number } | null;
  bestHedge: PairInsight | null;
  cluster: string[] | null;
}

function dayKeyUTC(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Retorna diário (variação % dia-a-dia) a partir dos candles, indexado por dia (UTC). */
function computeDailyReturns(candles: { time: number; close: number }[]): Map<string, number> {
  const byDay = new Map<string, number>();
  for (const c of candles) {
    byDay.set(dayKeyUTC(c.time), c.close); // se houver mais de um candle no mesmo dia, fica o último
  }
  const days = Array.from(byDay.keys()).sort();
  const returns = new Map<string, number>();
  for (let i = 1; i < days.length; i++) {
    const prevClose = byDay.get(days[i - 1])!;
    const close = byDay.get(days[i])!;
    if (prevClose > 0) {
      returns.set(days[i], (close - prevClose) / prevClose);
    }
  }
  return returns;
}

/** Corrida contra um limite de tempo — sem isso, um fetch travado (rede/CORS/conta
 * MetaAPI compartilhada sob rate-limit, já documentado neste projeto) prendia a
 * matriz inteira em "carregando" para sempre, já que o loop nunca avançava para o
 * próximo símbolo nem chegava a `setAnalyzing(false)`. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Tempo esgotado (${ms}ms) buscando ${label}`)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); }
    );
  });
}

function pearsonCorrelation(a: number[], b: number[]): number {
  const n = a.length;
  if (n === 0) return 0;
  const meanA = a.reduce((s, v) => s + v, 0) / n;
  const meanB = b.reduce((s, v) => s + v, 0) / n;
  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  return den === 0 ? 0 : Math.max(-1, Math.min(1, num / den));
}

function correlateReturnSeries(
  returnsA: Map<string, number>,
  returnsB: Map<string, number>
): CorrelationCell {
  const commonDays = Array.from(returnsA.keys()).filter(d => returnsB.has(d)).sort();
  if (commonDays.length < MIN_OVERLAP_POINTS) {
    return { value: null, n: commonDays.length };
  }
  const seriesA = commonDays.map(d => returnsA.get(d)!);
  const seriesB = commonDays.map(d => returnsB.get(d)!);
  return { value: pearsonCorrelation(seriesA, seriesB), n: commonDays.length };
}

export function CorrelationMatrix() {
  const [selectedAssets, setSelectedAssets] = useState<string[]>(DEFAULT_ASSETS);
  const [matrixData, setMatrixData] = useState<MatrixData>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [aiInsight, setAiInsight] = useState<AiInsight | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<AssetCategory | 'ALL'>('ALL');
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const requestIdRef = useRef(0);

  // Assets disponíveis com filtros (TODOS os 370+ disponíveis!)
  const availableAssets = ALL_ASSETS
    .filter(asset => filterCategory === 'ALL' || asset.category === filterCategory)
    .filter(asset =>
      searchTerm === '' ||
      asset.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const generateMatrix = useCallback(async () => {
    const myRequestId = ++requestIdRef.current;
    setAnalyzing(true);

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - LOOKBACK_DAYS * 86_400_000);

    // ✅ 2026-07-20: busca era SEQUENCIAL (1 símbolo por vez, timeout 15s cada) —
    // com os DEFAULT_ASSETS (16 símbolos) o pior caso batia ~16×15s = 4min.
    // Trocado pra pool de concorrência (16 símbolos / 4 em voo = ~30s reportado
    // pelo Cleber). Subido pra 8 em voo — dobra o paralelismo (16 símbolos em
    // só 2 lotes em vez de 4), ainda dentro do mesmo limite de concorrência já
    // usado com segurança pela conta MetaAPI compartilhada em outras partes do
    // backend (mapWithConcurrency em /mt5-prices usa o mesmo valor).
    const CONCURRENCY = 8;
    const FETCH_TIMEOUT_MS = 10000;
    const returnsBySymbol = new Map<string, Map<string, number>>();
    const failed: string[] = [];

    async function fetchOne(symbol: string) {
      try {
        const { candles } = await withTimeout(
          backtestDataService.fetchHistoricalData(symbol, startDate, endDate, '1d'),
          FETCH_TIMEOUT_MS,
          symbol
        );
        returnsBySymbol.set(symbol, computeDailyReturns(candles));
      } catch (error) {
        const reason = error instanceof BacktestDataUnavailableError ? error.message : String(error);
        console.warn(`[CorrelationMatrix] ⚠️ Sem dado real para ${symbol}: ${reason}`);
        failed.push(symbol);
      }
    }

    try {
      const queue = [...selectedAssets];
      const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
        while (queue.length > 0) {
          if (myRequestId !== requestIdRef.current) return; // corrida mais nova assumiu
          const symbol = queue.shift();
          if (!symbol) return;
          await fetchOne(symbol);
        }
      });
      await Promise.all(workers);

      if (myRequestId !== requestIdRef.current) return;

      const availableSymbols = selectedAssets.filter(s => returnsBySymbol.has(s));
      const newMatrix: MatrixData = {};
      availableSymbols.forEach(a => { newMatrix[a] = {}; });

      availableSymbols.forEach(assetA => {
        availableSymbols.forEach(assetB => {
          if (assetA === assetB) {
            newMatrix[assetA][assetB] = { value: 1, n: returnsBySymbol.get(assetA)!.size };
          } else {
            newMatrix[assetA][assetB] = correlateReturnSeries(
              returnsBySymbol.get(assetA)!,
              returnsBySymbol.get(assetB)!
            );
          }
        });
      });

      setMatrixData(newMatrix);
      setUnavailable(failed);
      setLastUpdate(new Date());
      generateInsight(newMatrix, availableSymbols);
    } finally {
      // Garante que o spinner nunca fica preso, mesmo se algo inesperado
      // acima lançar uma exceção não prevista.
      if (myRequestId === requestIdRef.current) setAnalyzing(false);
    }
  }, [selectedAssets]);

  const generateInsight = (matrix: MatrixData, assets: string[]) => {
    const allPairs: PairInsight[] = [];
    assets.forEach(assetA => {
      assets.forEach(assetB => {
        if (assetA < assetB) {
          const cell = matrix[assetA]?.[assetB];
          if (cell && cell.value !== null) {
            allPairs.push({ pair: `${assetA}/${assetB}`, value: cell.value, n: cell.n });
          }
        }
      });
    });

    const strongPositive = allPairs.filter(c => c.value > 0.7).sort((a, b) => b.value - a.value).slice(0, 8);
    const strongNegative = allPairs.filter(c => c.value < -0.7).sort((a, b) => a.value - b.value).slice(0, 8);
    const relevant = allPairs
      .filter(c => Math.abs(c.value) >= 0.4 && Math.abs(c.value) <= 0.7)
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, 8);

    // Diversificação: média da correlação absoluta entre todos os pares —
    // quanto mais perto de 0, mais os ativos se movem de forma independente.
    const avgAbsCorr = allPairs.length > 0
      ? allPairs.reduce((s, c) => s + Math.abs(c.value), 0) / allPairs.length
      : 0;
    const diversificationScore = Math.round((1 - avgAbsCorr) * 100);

    // Ativo mais independente: menor correlação média absoluta com o resto da seleção.
    let mostIndependent: { symbol: string; avgAbsCorr: number } | null = null;
    assets.forEach(symbol => {
      const others = assets.filter(s => s !== symbol);
      if (others.length === 0) return;
      const vals = others
        .map(o => matrix[symbol]?.[o]?.value)
        .filter((v): v is number => v !== null && v !== undefined);
      if (vals.length === 0) return;
      const avg = vals.reduce((s, v) => s + Math.abs(v), 0) / vals.length;
      if (!mostIndependent || avg < mostIndependent.avgAbsCorr) {
        mostIndependent = { symbol, avgAbsCorr: avg };
      }
    });

    // Melhor par para hedge: correlação mais negativa disponível.
    const bestHedge = strongNegative[0] || (allPairs.length > 0
      ? [...allPairs].sort((a, b) => a.value - b.value)[0]
      : null);

    // Cluster de risco: grupo de 3+ ativos todos mutuamente correlacionados > 0.75
    // (concentração de risco — posições nesses ativos ao mesmo tempo multiplicam exposição).
    let cluster: string[] | null = null;
    const HIGH = 0.75;
    for (let i = 0; i < assets.length && !cluster; i++) {
      for (let j = i + 1; j < assets.length && !cluster; j++) {
        const a = assets[i], b = assets[j];
        if ((matrix[a]?.[b]?.value ?? 0) <= HIGH) continue;
        for (let k = j + 1; k < assets.length; k++) {
          const c = assets[k];
          const ac = matrix[a]?.[c]?.value ?? 0;
          const bc = matrix[b]?.[c]?.value ?? 0;
          if (ac > HIGH && bc > HIGH) {
            cluster = [a, b, c];
            break;
          }
        }
      }
    }

    let title = 'Condição Normal';
    let description = 'Correlações dentro dos padrões históricos esperados, calculadas sobre retornos diários reais.';
    let level: AiInsight['level'] = 'LOW';

    if (cluster) {
      title = '⚠️ Cluster de Concentração de Risco';
      description = `${cluster.join(', ')} formam um grupo mutuamente correlacionado (>0.75). Operar vários ao mesmo tempo multiplica a exposição ao mesmo risco.`;
      level = 'HIGH';
    } else if (strongPositive.length > 2) {
      title = '⚠️ Alerta de Exposição Múltipla';
      description = `${strongPositive.length} pares com correlação positiva forte (>0.70). Posições na mesma direção multiplicam o risco.`;
      level = 'HIGH';
    } else if (strongNegative.length > 2) {
      title = '🔄 Correlações Inversas Detectadas';
      description = `${strongNegative.length} pares com correlação inversa forte. Cuidado com hedging não intencional.`;
      level = 'MEDIUM';
    } else if (strongPositive.length > 0 || strongNegative.length > 0 || relevant.length > 0) {
      title = 'ℹ️ Correlações Relevantes';
      description = `${strongPositive.length + strongNegative.length + relevant.length} correlação(ões) relevante(s) identificada(s) na seleção atual.`;
      level = 'MEDIUM';
    }

    setAiInsight({
      title, description, level,
      strongPositive, relevant, strongNegative,
      diversificationScore,
      mostIndependent,
      bestHedge,
      cluster,
    });
  };

  useEffect(() => {
    generateMatrix();
    const interval = setInterval(generateMatrix, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [generateMatrix]);

  const addAsset = (symbol: string) => {
    if (!selectedAssets.includes(symbol) && selectedAssets.length < MAX_ASSETS) {
      setSelectedAssets([...selectedAssets, symbol]);
    }
  };

  const removeAsset = (symbol: string) => {
    if (selectedAssets.length > MIN_ASSETS) {
      setSelectedAssets(selectedAssets.filter(a => a !== symbol));
    }
  };

  const loadPreset = (presetName: string) => {
    setSelectedAssets(PRESET_PORTFOLIOS[presetName] || []);
    setShowAssetPicker(false);
  };

  const getColor = (cell: CorrelationCell | undefined) => {
    if (!cell || cell.value === null) return 'bg-slate-800/30 text-slate-600';
    const val = cell.value;
    if (val === 1) return 'bg-slate-800 text-slate-600';
    if (val > 0.7) return 'bg-emerald-500/30 text-emerald-400 font-bold';
    if (val > 0.3) return 'bg-emerald-500/10 text-emerald-500/70';
    if (val < -0.7) return 'bg-rose-500/30 text-rose-400 font-bold';
    if (val < -0.3) return 'bg-rose-500/10 text-rose-500/70';
    return 'bg-slate-800/50 text-slate-500';
  };

  const displayedAssets = selectedAssets.filter(a => matrixData[a]);

  return (
    <Card className="bg-slate-950 border-0 backdrop-blur-sm shadow-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="space-y-1">
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2 flex-wrap">
              <Layers className="h-5 w-5 text-purple-400" />
              Matriz de Correlação Inteligente
              <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0 text-[10px] font-bold">
                {ALL_ASSETS.length} ATIVOS DISPONÍVEIS
              </Badge>
            </CardTitle>
            <p className="text-xs text-slate-400">
              {selectedAssets.length} selecionados • {availableAssets.length} filtrados • Atualizado: {lastUpdate.toLocaleTimeString()}
              {unavailable.length > 0 && (
                <span className="text-rose-400"> • {unavailable.length} sem dado real agora ({unavailable.join(', ')})</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => generateMatrix()}
              disabled={analyzing}
              className="bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${analyzing ? 'animate-spin' : ''}`} />
              Recalcular
            </Button>
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
                Selecionados ({selectedAssets.length}/{MAX_ASSETS}) • Min: {MIN_ASSETS} • Max: {MAX_ASSETS}
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedAssets.map(symbol => (
                  <Badge
                    key={symbol}
                    className={`text-white cursor-pointer transition-colors ${
                      unavailable.includes(symbol) ? 'bg-rose-700/70 hover:bg-rose-600' : 'bg-purple-600 hover:bg-rose-600'
                    }`}
                    onClick={() => removeAsset(symbol)}
                    title={unavailable.includes(symbol) ? 'Sem dado histórico real disponível' : undefined}
                  >
                    {symbol} <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
              </div>
              {unavailable.length > 0 && (
                <p className="text-[11px] text-rose-400 mt-2 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Sem fonte real de dados no momento: {unavailable.join(', ')} — excluídos da matriz (nunca preenchidos com valor sintético).
                </p>
              )}
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
                  const isMax = selectedAssets.length >= MAX_ASSETS;
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

        {/* ✅ 2026-07-20: Análise IA desce pra baixo da matriz (era coluna lateral
            de 320px) — mesma largura da matriz, layout empilhado verticalmente em
            vez de lado a lado. Conteúdo interno da Análise IA reorganizado em
            linhas horizontais (grid), aproveitando a largura extra disponível. */}
        <div className="flex flex-col gap-4">
          {/* MATRIX HEATMAP */}
          <div className="bg-slate-900/30 rounded-xl border border-slate-800/70 p-4 flex flex-col max-h-[640px] overflow-y-auto custom-scrollbar">
            {analyzing && displayedAssets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                <RefreshCw className="h-8 w-8 animate-spin mb-3" />
                <span className="text-sm">Buscando candles reais e calculando correlações...</span>
              </div>
            ) : (
              <div className="overflow-x-auto custom-scrollbar pb-1">
                <div
                  className="grid gap-1"
                  style={{ gridTemplateColumns: `76px repeat(${displayedAssets.length}, minmax(52px, 1fr))` }}
                >
                  {/* Canto vazio */}
                  <div />
                  {/* Header (linha de rótulos das colunas) */}
                  {displayedAssets.map(asset => (
                    <div key={`col-${asset}`} className="text-center text-[11px] font-bold text-purple-400 truncate px-0.5 flex items-end justify-center pb-1">
                      {asset.length > 7 ? asset.substring(0, 7) : asset}
                    </div>
                  ))}

                  {/* Linhas: rótulo + células */}
                  {displayedAssets.map(rowAsset => (
                    <React.Fragment key={rowAsset}>
                      <div className="text-xs font-bold text-purple-400 truncate pr-2 flex items-center">
                        {rowAsset}
                      </div>
                      {displayedAssets.map(colAsset => {
                        const cell = matrixData[rowAsset]?.[colAsset];
                        const label = cell?.value === null || cell === undefined ? '—' : cell.value.toFixed(2);
                        const title = cell?.value === null || cell === undefined
                          ? `${rowAsset} vs ${colAsset}: dados insuficientes (${cell?.n ?? 0} dias em comum)`
                          : `${rowAsset} vs ${colAsset}: ${cell.value.toFixed(3)} (${cell.n} dias em comum)`;
                        return (
                          <motion.div
                            key={`${rowAsset}-${colAsset}`}
                            initial={false}
                            animate={{ opacity: analyzing ? 0.5 : 1 }}
                            className={`h-10 rounded-md flex items-center justify-center text-xs font-semibold cursor-help transition-all ${getColor(cell)}`}
                            title={title}
                          >
                            {label}
                          </motion.div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}

            {/* Legenda de cores — usabilidade */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 pt-3 border-t border-slate-800/50 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500/30" /> Positiva forte</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500/10" /> Positiva fraca</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-rose-500/30" /> Negativa forte</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-rose-500/10" /> Negativa fraca</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-800/30" /> Sem dado (—)</span>
            </div>
          </div>

          {/* AI ANALYSIS — mesma largura da matriz (era coluna lateral estreita),
              conteúdo reorganizado em linhas horizontais pra aproveitar a largura. */}
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-400" />
              <h3 className="text-sm font-bold text-white">Análise IA</h3>
            </div>

            {analyzing && !aiInsight ? (
              <div className="flex flex-col items-center justify-center py-6 text-slate-500">
                <RefreshCw className="h-5 w-5 animate-spin mb-2" />
                <span className="text-xs">Recalculando...</span>
              </div>
            ) : aiInsight && (
              <div className="space-y-3">
                {/* Linha 1: alerta principal (largura total) + 3 stat cards lado a lado */}
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_1fr_1fr_1fr] gap-2">
                  <div className={`p-2.5 rounded-lg border ${
                    aiInsight.level === 'HIGH' ? 'bg-rose-950/30 border-rose-500/30' :
                    aiInsight.level === 'MEDIUM' ? 'bg-amber-950/30 border-amber-500/30' :
                    'bg-emerald-950/30 border-emerald-500/30'
                  }`}>
                    <div className="flex items-start gap-2">
                      <ShieldAlert className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${
                        aiInsight.level === 'HIGH' ? 'text-rose-400' :
                        aiInsight.level === 'MEDIUM' ? 'text-amber-400' : 'text-emerald-400'
                      }`} />
                      <div>
                        <p className={`text-xs font-bold ${
                          aiInsight.level === 'HIGH' ? 'text-rose-100' :
                          aiInsight.level === 'MEDIUM' ? 'text-amber-100' : 'text-emerald-100'
                        }`}>{aiInsight.title}</p>
                        <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                          {aiInsight.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700/50">
                    <div className="flex items-center gap-1 mb-0.5">
                      <Sparkles className="h-3 w-3 text-blue-400" />
                      <p className="text-[9px] text-slate-400 uppercase font-bold">Diversificação</p>
                    </div>
                    <p className={`text-base font-bold leading-tight ${
                      aiInsight.diversificationScore >= 60 ? 'text-emerald-400' :
                      aiInsight.diversificationScore >= 35 ? 'text-amber-400' : 'text-rose-400'
                    }`}>
                      {aiInsight.diversificationScore}%
                    </p>
                    <p className="text-[9px] text-slate-500 leading-tight">
                      {aiInsight.diversificationScore >= 60 ? 'Boa independência' : aiInsight.diversificationScore >= 35 ? 'Moderada' : 'Baixa (concentrado)'}
                    </p>
                  </div>

                  <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700/50">
                    <div className="flex items-center gap-1 mb-0.5">
                      <Target className="h-3 w-3 text-cyan-400" />
                      <p className="text-[9px] text-slate-400 uppercase font-bold">Mais Independente</p>
                    </div>
                    {aiInsight.mostIndependent ? (
                      <>
                        <p className="text-xs font-bold text-cyan-300 truncate leading-tight">{aiInsight.mostIndependent.symbol}</p>
                        <p className="text-[9px] text-slate-500 leading-tight">corr. média {aiInsight.mostIndependent.avgAbsCorr.toFixed(2)}</p>
                      </>
                    ) : <p className="text-[9px] text-slate-500">—</p>}
                  </div>

                  <div className={`rounded-lg p-2 border ${aiInsight.bestHedge ? 'bg-indigo-950/20 border-indigo-900/50' : 'bg-slate-800/50 border-slate-700/50'}`}>
                    <div className="flex items-center gap-1 mb-0.5">
                      <GitBranch className="h-3 w-3 text-indigo-400" />
                      <p className="text-[9px] text-indigo-300 uppercase font-bold">Melhor Par p/ Hedge</p>
                    </div>
                    {aiInsight.bestHedge ? (
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-300">{aiInsight.bestHedge.pair}</span>
                        <span className={`font-bold ${aiInsight.bestHedge.value < 0 ? 'text-indigo-300' : 'text-slate-400'}`}>
                          {aiInsight.bestHedge.value.toFixed(2)}
                        </span>
                      </div>
                    ) : <p className="text-[9px] text-slate-500">—</p>}
                  </div>
                </div>

                {/* Linha 2: as 3 listas de pares lado a lado (era empilhado) */}
                {(aiInsight.strongPositive?.length > 0 || aiInsight.relevant?.length > 0 || aiInsight.strongNegative?.length > 0) && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {aiInsight.strongPositive?.length > 0 && (
                      <div>
                        <p className="text-[9px] text-emerald-400 uppercase font-bold mb-1 flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" /> Positivas Fortes ({aiInsight.strongPositive.length})
                        </p>
                        <div className="space-y-1">
                          {aiInsight.strongPositive.slice(0, INSIGHT_LIST_VISIBLE).map((item, idx) => (
                            <div key={idx} className="text-[11px] bg-emerald-950/20 border border-emerald-900/50 px-2 py-1 rounded flex justify-between">
                              <span className="text-slate-300">{item.pair}</span>
                              <span className="text-emerald-400 font-bold">{item.value.toFixed(2)}</span>
                            </div>
                          ))}
                          {aiInsight.strongPositive.length > INSIGHT_LIST_VISIBLE && (
                            <p className="text-[9px] text-slate-500 pl-1">+{aiInsight.strongPositive.length - INSIGHT_LIST_VISIBLE} mais</p>
                          )}
                        </div>
                      </div>
                    )}

                    {aiInsight.relevant?.length > 0 && (
                      <div>
                        <p className="text-[9px] text-amber-400 uppercase font-bold mb-1 flex items-center gap-1">
                          <Sparkles className="h-3 w-3" /> Relevantes ({aiInsight.relevant.length})
                        </p>
                        <div className="space-y-1">
                          {aiInsight.relevant.slice(0, INSIGHT_LIST_VISIBLE).map((item, idx) => (
                            <div key={idx} className="text-[11px] bg-amber-950/20 border border-amber-900/50 px-2 py-1 rounded flex justify-between">
                              <span className="text-slate-300">{item.pair}</span>
                              <span className="text-amber-400 font-bold">{item.value.toFixed(2)}</span>
                            </div>
                          ))}
                          {aiInsight.relevant.length > INSIGHT_LIST_VISIBLE && (
                            <p className="text-[9px] text-slate-500 pl-1">+{aiInsight.relevant.length - INSIGHT_LIST_VISIBLE} mais</p>
                          )}
                        </div>
                      </div>
                    )}

                    {aiInsight.strongNegative?.length > 0 && (
                      <div>
                        <p className="text-[9px] text-rose-400 uppercase font-bold mb-1 flex items-center gap-1">
                          <TrendingDown className="h-3 w-3" /> Negativas Fortes ({aiInsight.strongNegative.length})
                        </p>
                        <div className="space-y-1">
                          {aiInsight.strongNegative.slice(0, INSIGHT_LIST_VISIBLE).map((item, idx) => (
                            <div key={idx} className="text-[11px] bg-rose-950/20 border border-rose-900/50 px-2 py-1 rounded flex justify-between">
                              <span className="text-slate-300">{item.pair}</span>
                              <span className="text-rose-400 font-bold">{item.value.toFixed(2)}</span>
                            </div>
                          ))}
                          {aiInsight.strongNegative.length > INSIGHT_LIST_VISIBLE && (
                            <p className="text-[9px] text-slate-500 pl-1">+{aiInsight.strongNegative.length - INSIGHT_LIST_VISIBLE} mais</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-2 border-t border-slate-800/50">
                  <p className="text-[9px] text-slate-500 italic leading-snug">
                    *Correlação de Pearson sobre retornos diários reais (candles de até {LOOKBACK_DAYS} dias, mínimo {MIN_OVERLAP_POINTS} pregões em comum). Atualizado a cada {REFRESH_INTERVAL_MS / 60000} min.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
