import React, { useState } from 'react';
import { Search, Download, AlertTriangle, CheckCircle2, XCircle, Play, Loader2, FileText, TrendingUp, Clock } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

interface DiagnosticResult {
  symbol: string;
  name: string;
  category: string;
  status: 'success' | 'warning' | 'error';
  price: number | null;
  change24h: number | null;
  issues: string[];
  timestamp: Date;
  source: string;
  latency: number;
  discrepancy?: number;
  quality?: string;
  sources?: {
    metaapi?: number;
    fallback?: number;
  };
}

interface DiagnosticReport {
  startTime: Date;
  endTime: Date;
  totalAssets: number;
  successful: number;
  warnings: number;
  errors: number;
  results: DiagnosticResult[];
}

export function MassAssetDiagnostics() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentAsset, setCurrentAsset] = useState('');
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [filter, setFilter] = useState<'all' | 'success' | 'warning' | 'error'>('all');

  // Lista completa de ativos (100+ para teste realista)
  const ALL_ASSETS = [
    // Crypto (10)
    { symbol: 'BTCUSD', name: 'Bitcoin', category: 'Crypto' },
    { symbol: 'ETHUSD', name: 'Ethereum', category: 'Crypto' },
    { symbol: 'BNBUSD', name: 'Binance Coin', category: 'Crypto' },
    { symbol: 'XRPUSD', name: 'Ripple', category: 'Crypto' },
    { symbol: 'ADAUSD', name: 'Cardano', category: 'Crypto' },
    { symbol: 'DOGEUSD', name: 'Dogecoin', category: 'Crypto' },
    { symbol: 'SOLUSD', name: 'Solana', category: 'Crypto' },
    { symbol: 'MATICUSD', name: 'Polygon', category: 'Crypto' },
    { symbol: 'DOTUSD', name: 'Polkadot', category: 'Crypto' },
    { symbol: 'LTCUSD', name: 'Litecoin', category: 'Crypto' },
    
    // Forex Majors (7)
    { symbol: 'EURUSD', name: 'Euro/Dollar', category: 'Forex' },
    { symbol: 'GBPUSD', name: 'Pound/Dollar', category: 'Forex' },
    { symbol: 'USDJPY', name: 'Dollar/Yen', category: 'Forex' },
    { symbol: 'USDCHF', name: 'Dollar/Swiss Franc', category: 'Forex' },
    { symbol: 'AUDUSD', name: 'Australian Dollar/USD', category: 'Forex' },
    { symbol: 'USDCAD', name: 'Dollar/Canadian Dollar', category: 'Forex' },
    { symbol: 'NZDUSD', name: 'New Zealand Dollar/USD', category: 'Forex' },
    
    // Forex Minors (20)
    { symbol: 'EURGBP', name: 'Euro/Pound', category: 'Forex' },
    { symbol: 'EURJPY', name: 'Euro/Yen', category: 'Forex' },
    { symbol: 'GBPJPY', name: 'Pound/Yen', category: 'Forex' },
    { symbol: 'EURCHF', name: 'Euro/Swiss Franc', category: 'Forex' },
    { symbol: 'EURAUD', name: 'Euro/Australian Dollar', category: 'Forex' },
    { symbol: 'GBPAUD', name: 'Pound/Australian Dollar', category: 'Forex' },
    { symbol: 'AUDCAD', name: 'Australian Dollar/Canadian Dollar', category: 'Forex' },
    { symbol: 'AUDCHF', name: 'Australian Dollar/Swiss Franc', category: 'Forex' },
    { symbol: 'AUDJPY', name: 'Australian Dollar/Yen', category: 'Forex' },
    { symbol: 'AUDNZD', name: 'Australian Dollar/New Zealand Dollar', category: 'Forex' },
    { symbol: 'CADCHF', name: 'Canadian Dollar/Swiss Franc', category: 'Forex' },
    { symbol: 'CADJPY', name: 'Canadian Dollar/Yen', category: 'Forex' },
    { symbol: 'CHFJPY', name: 'Swiss Franc/Yen', category: 'Forex' },
    { symbol: 'EURCAD', name: 'Euro/Canadian Dollar', category: 'Forex' },
    { symbol: 'EURNZD', name: 'Euro/New Zealand Dollar', category: 'Forex' },
    { symbol: 'GBPCAD', name: 'Pound/Canadian Dollar', category: 'Forex' },
    { symbol: 'GBPCHF', name: 'Pound/Swiss Franc', category: 'Forex' },
    { symbol: 'GBPNZD', name: 'Pound/New Zealand Dollar', category: 'Forex' },
    { symbol: 'NZDCAD', name: 'New Zealand Dollar/Canadian Dollar', category: 'Forex' },
    { symbol: 'NZDCHF', name: 'New Zealand Dollar/Swiss Franc', category: 'Forex' },
    { symbol: 'NZDJPY', name: 'New Zealand Dollar/Yen', category: 'Forex' },
    
    // Commodities (8)
    { symbol: 'XAUUSD', name: 'Gold', category: 'Commodities' },
    { symbol: 'XAGUSD', name: 'Silver', category: 'Commodities' },
    { symbol: 'USOIL', name: 'US Crude Oil', category: 'Commodities' },
    { symbol: 'UKOIL', name: 'UK Brent Oil', category: 'Commodities' },
    { symbol: 'NATGAS', name: 'Natural Gas', category: 'Commodities' },
    { symbol: 'COPPER', name: 'Copper', category: 'Commodities' },
    { symbol: 'PLATINUM', name: 'Platinum', category: 'Commodities' },
    { symbol: 'PALLADIUM', name: 'Palladium', category: 'Commodities' },
    
    // Indices (12)
    { symbol: 'US30', name: 'Dow Jones Industrial Average', category: 'Indices' },
    { symbol: 'NAS100', name: 'Nasdaq 100', category: 'Indices' },
    { symbol: 'SPX500', name: 'S&P 500', category: 'Indices' },
    { symbol: 'GER40', name: 'DAX', category: 'Indices' },
    { symbol: 'UK100', name: 'FTSE 100', category: 'Indices' },
    { symbol: 'FRA40', name: 'CAC 40', category: 'Indices' },
    { symbol: 'JPN225', name: 'Nikkei 225', category: 'Indices' },
    { symbol: 'AUS200', name: 'ASX 200', category: 'Indices' },
    { symbol: 'HKG50', name: 'Hang Seng', category: 'Indices' },
    { symbol: 'CHINA50', name: 'China A50', category: 'Indices' },
    { symbol: 'ESP35', name: 'IBEX 35', category: 'Indices' },
    { symbol: 'ITA40', name: 'FTSE MIB', category: 'Indices' },
    
    // US Stocks (30)
    { symbol: 'AAPL', name: 'Apple Inc.', category: 'Stocks' },
    { symbol: 'MSFT', name: 'Microsoft Corp.', category: 'Stocks' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', category: 'Stocks' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', category: 'Stocks' },
    { symbol: 'TSLA', name: 'Tesla Inc.', category: 'Stocks' },
    { symbol: 'META', name: 'Meta Platforms Inc.', category: 'Stocks' },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', category: 'Stocks' },
    { symbol: 'BRK.B', name: 'Berkshire Hathaway', category: 'Stocks' },
    { symbol: 'JPM', name: 'JPMorgan Chase & Co.', category: 'Stocks' },
    { symbol: 'JNJ', name: 'Johnson & Johnson', category: 'Stocks' },
    { symbol: 'V', name: 'Visa Inc.', category: 'Stocks' },
    { symbol: 'PG', name: 'Procter & Gamble', category: 'Stocks' },
    { symbol: 'UNH', name: 'UnitedHealth Group', category: 'Stocks' },
    { symbol: 'HD', name: 'Home Depot', category: 'Stocks' },
    { symbol: 'MA', name: 'Mastercard Inc.', category: 'Stocks' },
    { symbol: 'DIS', name: 'Walt Disney Co.', category: 'Stocks' },
    { symbol: 'PYPL', name: 'PayPal Holdings', category: 'Stocks' },
    { symbol: 'BAC', name: 'Bank of America', category: 'Stocks' },
    { symbol: 'NFLX', name: 'Netflix Inc.', category: 'Stocks' },
    { symbol: 'ADBE', name: 'Adobe Inc.', category: 'Stocks' },
    { symbol: 'CMCSA', name: 'Comcast Corp.', category: 'Stocks' },
    { symbol: 'CRM', name: 'Salesforce Inc.', category: 'Stocks' },
    { symbol: 'NKE', name: 'Nike Inc.', category: 'Stocks' },
    { symbol: 'PFE', name: 'Pfizer Inc.', category: 'Stocks' },
    { symbol: 'T', name: 'AT&T Inc.', category: 'Stocks' },
    { symbol: 'INTC', name: 'Intel Corp.', category: 'Stocks' },
    { symbol: 'VZ', name: 'Verizon Communications', category: 'Stocks' },
    { symbol: 'WMT', name: 'Walmart Inc.', category: 'Stocks' },
    { symbol: 'KO', name: 'Coca-Cola Co.', category: 'Stocks' },
    { symbol: 'MRK', name: 'Merck & Co.', category: 'Stocks' },
  ];

  // 🔥 DIAGNÓSTICO REAL COM VALIDAÇÃO DE API
  const diagnoseAsset = async (asset: { symbol: string; name: string; category: string }): Promise<DiagnosticResult> => {
    const startTime = Date.now();
    
    try {
      // Buscar dados REAIS da API (✅ CORRIGIDO: path parameter)
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-1dbacac6/market-data/${asset.symbol}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      // 🚨 ANÁLISE DETALHADA
      const issues: string[] = [];
      let status: 'success' | 'warning' | 'error' = 'success';

      // 1. Verificar preço (✅ CORRIGIDO: 'last' ao invés de 'price')
      if (!data.last || data.last === 0) {
        status = 'error';
        issues.push('Preço indisponível ou zerado');
      }

      // 2. 🔥 PROBLEMA CRÍTICO: Variação zerada (✅ CORRIGIDO: 'changePercent')
      if (data.changePercent === 0 || data.changePercent === null) {
        if (status !== 'error') status = 'warning';
        issues.push('Variação 24h zerada - Problema timezone MT5/D1 candle');
      }

      // 3. Verificar qualidade (source)
      if (data.source && data.source !== 'metaapi' && data.source !== 'metaapi-candles') {
        if (status !== 'error') status = 'warning';
        issues.push(`Fonte fallback: ${data.source}`);
      }

      // 4. 🔥 DISCREPÂNCIA ENTRE FONTES
      let discrepancy: number | undefined;
      if (data.sources?.metaapi && data.sources?.fallback) {
        const diff = Math.abs(data.sources.metaapi - data.sources.fallback);
        discrepancy = (diff / data.sources.metaapi) * 100;
        
        if (discrepancy > 2) {
          status = 'error';
          issues.push(`CRÍTICO: Discrepância ${discrepancy.toFixed(2)}% entre fontes`);
        } else if (discrepancy > 0.5) {
          if (status !== 'error') status = 'warning';
          issues.push(`Discrepância ${discrepancy.toFixed(2)}% detectada`);
        }
      }

      // 5. Verificar latência
      if (latency > 3000) {
        if (status !== 'error') status = 'warning';
        issues.push(`Alta latência: ${latency}ms`);
      }

      // 6. Verificar fonte de dados
      let source = 'Unknown';
      if (data.source === 'metaapi') {
        source = 'MetaAPI (Primary)';
      } else if (data.source === 'tradingeconomics') {
        source = 'Trading Economics (Fallback)';
      } else if (data.source === 'coingecko') {
        source = 'CoinGecko (Fallback)';
      }

      return {
        symbol: asset.symbol,
        name: asset.name,
        category: asset.category,
        status,
        price: data.last || null,
        change24h: data.changePercent || null,
        issues,
        timestamp: new Date(),
        source,
        latency,
        discrepancy,
        quality: data.quality,
        sources: data.sources
      };

    } catch (error: any) {
      const latency = Date.now() - startTime;
      return {
        symbol: asset.symbol,
        name: asset.name,
        category: asset.category,
        status: 'error',
        price: null,
        change24h: null,
        issues: [`Erro crítico: ${error.message}`],
        timestamp: new Date(),
        source: 'N/A',
        latency
      };
    }
  };

  // Executar diagnóstico em massa
  const runDiagnostics = async () => {
    setIsRunning(true);
    setProgress(0);
    setReport(null);
    
    const startTime = new Date();
    const results: DiagnosticResult[] = [];
    
    console.log('[MassAssetDiagnostics] 🚀 Iniciando diagnóstico REAL de', ALL_ASSETS.length, 'ativos...');
    
    for (let i = 0; i < ALL_ASSETS.length; i++) {
      const asset = ALL_ASSETS[i];
      setCurrentAsset(`${asset.symbol} (${asset.category})`);
      
      const result = await diagnoseAsset(asset);
      results.push(result);
      
      setProgress(Math.round(((i + 1) / ALL_ASSETS.length) * 100));
      
      // Log de problemas críticos em tempo real
      if (result.status === 'error') {
        console.error(`[MassAssetDiagnostics] ❌ ${result.symbol}:`, result.issues);
      } else if (result.status === 'warning') {
        console.warn(`[MassAssetDiagnostics] ⚠️ ${result.symbol}:`, result.issues);
      }
    }
    
    const endTime = new Date();
    const successful = results.filter(r => r.status === 'success').length;
    const warnings = results.filter(r => r.status === 'warning').length;
    const errors = results.filter(r => r.status === 'error').length;
    
    const finalReport: DiagnosticReport = {
      startTime,
      endTime,
      totalAssets: ALL_ASSETS.length,
      successful,
      warnings,
      errors,
      results
    };
    
    setReport(finalReport);
    setIsRunning(false);
    setCurrentAsset('');
    
    // 🚨 RESUMO DE PROBLEMAS
    const problematicos = results.filter(r => r.status !== 'success');
    console.log('[MassAssetDiagnostics] 📊 RESUMO:', {
      total: ALL_ASSETS.length,
      sucessos: successful,
      avisos: warnings,
      erros: errors,
      taxa_sucesso: `${((successful / ALL_ASSETS.length) * 100).toFixed(1)}%`,
      duracao: `${((endTime.getTime() - startTime.getTime()) / 1000).toFixed(1)}s`
    });
    
    if (problematicos.length > 0) {
      console.warn('[MassAssetDiagnostics] 🚨 ATIVOS COM PROBLEMAS:', problematicos.map(p => ({
        symbol: p.symbol,
        status: p.status,
        issues: p.issues
      })));
    }
  };

  // Exportar relatório
  const exportReport = () => {
    if (!report) return;
    
    const csv = [
      ['Symbol', 'Name', 'Category', 'Status', 'Price', 'Change 24h', 'Discrepancy %', 'Issues', 'Quality', 'Source', 'Latency (ms)', 'Timestamp'].join(','),
      ...report.results.map(r => [
        r.symbol,
        `"${r.name}"`,
        r.category,
        r.status,
        r.price?.toFixed(4) || 'N/A',
        r.change24h?.toFixed(2) || 'N/A',
        r.discrepancy?.toFixed(2) || 'N/A',
        `"${r.issues.join('; ')}"`,
        r.quality || 'N/A',
        r.source,
        r.latency.toString(),
        r.timestamp.toISOString()
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asset-diagnostics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    
    console.log('[MassAssetDiagnostics] 📥 Relatório exportado:', report.results.length, 'ativos');
  };

  const filteredResults = report?.results.filter(r => filter === 'all' || r.status === filter) || [];

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/30">
            <Search className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Diagnóstico em Massa (DADOS REAIS)</h3>
            <p className="text-slate-400 text-sm">
              Testa {ALL_ASSETS.length} ativos com validação cruzada de fontes
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          {report && (
            <button
              onClick={exportReport}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-lg transition-all flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </button>
          )}
          <button
            onClick={runDiagnostics}
            disabled={isRunning}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${
              isRunning
                ? 'bg-zinc-700 text-slate-400 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-500 text-white'
            }`}
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Executando...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Executar Diagnóstico
              </>
            )}
          </button>
        </div>
      </div>

      {/* Progress */}
      {isRunning && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-400 text-sm">
              Testando: <span className="text-white font-semibold">{currentAsset}</span>
            </p>
            <p className="text-cyan-400 font-bold">{progress}%</p>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-purple-600 to-cyan-500 h-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Report Summary */}
      {report && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-cyan-900/20 border border-cyan-700/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                <p className="text-cyan-400 text-xs font-semibold uppercase">Total Testados</p>
              </div>
              <p className="text-white text-3xl font-bold">{report.totalAssets}</p>
              <p className="text-cyan-400/70 text-xs mt-1">
                Duração: {((report.endTime.getTime() - report.startTime.getTime()) / 1000).toFixed(1)}s
              </p>
            </div>

            <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <p className="text-emerald-400 text-xs font-semibold uppercase">Sucesso</p>
              </div>
              <p className="text-white text-3xl font-bold">{report.successful}</p>
              <p className="text-emerald-400/70 text-xs mt-1">
                {Math.round((report.successful / report.totalAssets) * 100)}% do total
              </p>
            </div>

            <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                <p className="text-yellow-400 text-xs font-semibold uppercase">Avisos</p>
              </div>
              <p className="text-white text-3xl font-bold">{report.warnings}</p>
              <p className="text-yellow-400/70 text-xs mt-1">
                {Math.round((report.warnings / report.totalAssets) * 100)}% do total
              </p>
            </div>

            <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-5 h-5 text-red-400" />
                <p className="text-red-400 text-xs font-semibold uppercase">Erros</p>
              </div>
              <p className="text-white text-3xl font-bold">{report.errors}</p>
              <p className="text-red-400/70 text-xs mt-1">
                {Math.round((report.errors / report.totalAssets) * 100)}% do total
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === 'all'
                  ? 'bg-purple-600 text-white'
                  : 'bg-zinc-800 text-slate-400 hover:bg-zinc-700'
              }`}
            >
              Todos ({report.results.length})
            </button>
            <button
              onClick={() => setFilter('success')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === 'success'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-800 text-slate-400 hover:bg-zinc-700'
              }`}
            >
              Sucesso ({report.successful})
            </button>
            <button
              onClick={() => setFilter('warning')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === 'warning'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-zinc-800 text-slate-400 hover:bg-zinc-700'
              }`}
            >
              Avisos ({report.warnings})
            </button>
            <button
              onClick={() => setFilter('error')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === 'error'
                  ? 'bg-red-600 text-white'
                  : 'bg-zinc-800 text-slate-400 hover:bg-zinc-700'
              }`}
            >
              Erros ({report.errors})
            </button>
          </div>

          {/* Results List */}
          <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
            {filteredResults.map(result => (
              <div
                key={result.symbol}
                className={`p-3 rounded-lg border ${
                  result.status === 'success'
                    ? 'bg-emerald-900/10 border-emerald-800/30'
                    : result.status === 'warning'
                    ? 'bg-yellow-900/10 border-yellow-800/30'
                    : 'bg-red-900/10 border-red-800/30'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {result.status === 'success' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    ) : result.status === 'warning' ? (
                      <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-white font-semibold text-sm">{result.symbol}</p>
                        <span className="px-2 py-0.5 bg-zinc-800 text-slate-400 text-xs rounded">
                          {result.category}
                        </span>
                        {result.discrepancy !== undefined && result.discrepancy > 0 && (
                          <span className={`px-2 py-0.5 text-xs rounded font-semibold ${
                            result.discrepancy > 2 
                              ? 'bg-red-900/30 text-red-400' 
                              : 'bg-yellow-900/30 text-yellow-400'
                          }`}>
                            ⚠️ {result.discrepancy.toFixed(2)}%
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400 text-xs mb-1">{result.name}</p>
                      
                      {result.issues.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {result.issues.map((issue, idx) => (
                            <p key={idx} className="text-xs text-orange-400 font-semibold">
                              🚨 {issue}
                            </p>
                          ))}
                        </div>
                      )}
                      
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                        <span>Fonte: {result.source}</span>
                        <span>•</span>
                        <span>Latência: {result.latency}ms</span>
                        {result.quality && (
                          <>
                            <span>•</span>
                            <span>Qualidade: {result.quality}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {result.price !== null && (
                      <div className="text-right">
                        <p className="text-white font-mono text-sm">
                          ${result.price.toFixed(result.price > 100 ? 2 : 4)}
                        </p>
                        {result.change24h !== null && result.change24h !== 0 ? (
                          <p
                            className={`text-xs font-semibold mt-1 ${
                              result.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {result.change24h >= 0 ? '+' : ''}
                            {result.change24h.toFixed(2)}%
                          </p>
                        ) : (
                          <p className="text-xs text-yellow-400 mt-1 font-semibold">⚠️ 0.00%</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Empty State */}
      {!isRunning && !report && (
        <div className="text-center py-12">
          <Search className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 text-lg font-semibold mb-2">
            Nenhum diagnóstico executado
          </p>
          <p className="text-slate-500 text-sm mb-4">
            Clique em "Executar Diagnóstico" para testar todos os {ALL_ASSETS.length} ativos
          </p>
          <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-4 max-w-2xl mx-auto">
            <p className="text-yellow-300 text-sm font-semibold mb-2">
              ⚡ Este diagnóstico usa dados REAIS da API
            </p>
            <p className="text-yellow-400/70 text-xs">
              Detecta: variação zerada, discrepâncias entre fontes, problemas de timezone MT5, alta latência e mais
            </p>
          </div>
        </div>
      )}
    </div>
  );
}