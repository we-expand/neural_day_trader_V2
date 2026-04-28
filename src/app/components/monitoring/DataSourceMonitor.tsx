/**
 * 📊 DATA SOURCE MONITOR
 * 
 * Painel visual de monitoramento de qualidade de dados em tempo real:
 * - Status de cada ativo (excelente/bom/warning/crítico)
 * - Discrepâncias detectadas automaticamente
 * - Fonte de dados sendo usada
 * - Opção de trocar fonte manualmente
 * - Histórico de validações
 * - Estatísticas globais
 */

import { useState, useEffect } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Database,
  TrendingUp,
  AlertCircle,
  Info,
  Settings,
  Eye,
  EyeOff
} from 'lucide-react';
import { dataQualityMonitor, type ValidationResult } from '@/app/services/DataQualityMonitor';
import { dataSourceRouter, type DataSource } from '@/app/services/DataSourceRouter';

interface DataSourceMonitorProps {
  symbols: string[];
  autoRefresh?: boolean;
  refreshInterval?: number; // em segundos
}

export function DataSourceMonitor({ 
  symbols, 
  autoRefresh = true, 
  refreshInterval = 60 
}: DataSourceMonitorProps) {
  const [validations, setValidations] = useState<Map<string, ValidationResult>>(new Map());
  const [isValidating, setIsValidating] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState(dataQualityMonitor.getStats());

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !isOpen) return;

    const interval = setInterval(() => {
      validateAll();
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, symbols, isOpen]);

  // Validar ao abrir
  useEffect(() => {
    if (isOpen && validations.size === 0) {
      validateAll();
    }
  }, [isOpen]);

  const validateAll = async () => {
    setIsValidating(true);
    try {
      console.log('🔄 [DataSourceMonitor] INICIANDO VALIDAÇÃO DE TODOS OS SÍMBOLOS...', symbols);
      const results = await dataQualityMonitor.validateBatch(symbols);
      console.log('✅ [DataSourceMonitor] RESULTADOS RECEBIDOS:', 
        Array.from(results.entries()).map(([sym, val]) => ({
          symbol: sym,
          price: val.primary.price,
          changePercent: val.primary.changePercent,
          source: val.primary.source,
          status: val.status
        }))
      );
      setValidations(results);
      setStats(dataQualityMonitor.getStats());
    } catch (error) {
      console.error('[DataSourceMonitor] Erro ao validar:', error);
    } finally {
      setIsValidating(false);
    }
  };

  const validateSingle = async (symbol: string) => {
    setIsValidating(true);
    try {
      const result = await dataQualityMonitor.validateSymbol(symbol);
      setValidations(prev => new Map(prev).set(symbol, result));
      setStats(dataQualityMonitor.getStats());
    } catch (error) {
      console.error(`[DataSourceMonitor] Erro ao validar ${symbol}:`, error);
    } finally {
      setIsValidating(false);
    }
  };

  const getStatusIcon = (status: ValidationResult['status']) => {
    switch (status) {
      case 'excellent':
      case 'good':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'acceptable':
        return <Info className="w-4 h-4 text-blue-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'critical':
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusColor = (status: ValidationResult['status']) => {
    switch (status) {
      case 'excellent':
      case 'good':
        return 'bg-green-500/10 border-green-500/30 text-green-400';
      case 'acceptable':
        return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
      case 'warning':
        return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
      case 'critical':
        return 'bg-red-500/10 border-red-500/30 text-red-400';
    }
  };

  const getSourceBadgeColor = (source: DataSource) => {
    switch (source) {
      case 'binance':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'metaapi':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'yahoo':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'trading_economics':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'fallback':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 z-50 flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg hover:bg-zinc-800 transition-colors"
      >
        <Activity className="w-4 h-4 text-cyan-400" />
        <span className="text-sm text-white">Monitor de Qualidade</span>
        {stats.criticalIssues > 0 && (
          <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full border border-red-500/30">
            {stats.criticalIssues}
          </span>
        )}
      </button>
    );
  }

  const selectedValidation = selectedSymbol ? validations.get(selectedSymbol) : null;

  return (
    <div className="fixed bottom-4 left-4 z-50 w-[800px] max-h-[600px] bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl flex flex-col overflow-hidden">
      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-800 border-b border-zinc-700">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-cyan-400" />
          <div>
            <h3 className="text-sm font-bold text-white">Monitor de Qualidade de Dados</h3>
            <p className="text-xs text-slate-400">
              {validations.size} ativos monitorados • Success Rate: {stats.successRate.toFixed(1)}%
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={validateAll}
            disabled={isValidating}
            className="p-2 hover:bg-zinc-700 rounded transition-colors disabled:opacity-50"
            title="Revalidar todos"
          >
            <RefreshCw className={`w-4 h-4 text-cyan-400 ${isValidating ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-zinc-700 rounded transition-colors"
          >
            <EyeOff className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* LISTA DE SÍMBOLOS */}
        <div className="w-64 border-r border-zinc-700 overflow-y-auto">
          <div className="p-2 space-y-1">
            {symbols.map(symbol => {
              const validation = validations.get(symbol);
              const isSelected = selectedSymbol === symbol;
              
              return (
                <button
                  key={symbol}
                  onClick={() => setSelectedSymbol(symbol)}
                  className={`w-full text-left px-3 py-2 rounded transition-colors ${
                    isSelected ? 'bg-zinc-700' : 'hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {validation && getStatusIcon(validation.status)}
                      <span className="text-sm font-medium text-white">{symbol}</span>
                    </div>
                    
                    {validation && (
                      <span className={`px-1.5 py-0.5 text-[10px] rounded border ${getSourceBadgeColor(validation.primary.source)}`}>
                        {validation.primary.source}
                      </span>
                    )}
                  </div>
                  
                  {validation && (
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                      <span>
                        Conf: {validation.confidence}%
                      </span>
                      {validation.discrepancy > 0 && (
                        <span className={validation.discrepancy > 5 ? 'text-yellow-400' : ''}>
                          Δ {validation.discrepancy.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* DETALHES DO SÍMBOLO SELECIONADO */}
        <div className="flex-1 overflow-y-auto">
          {selectedValidation ? (
            <div className="p-4 space-y-4">
              {/* STATUS GERAL */}
              <div className={`p-3 rounded-lg border ${getStatusColor(selectedValidation.status)}`}>
                <div className="flex items-center gap-2 mb-2">
                  {getStatusIcon(selectedValidation.status)}
                  <span className="text-sm font-bold uppercase">
                    {selectedValidation.status}
                  </span>
                </div>
                <p className="text-sm">{selectedValidation.recommendation}</p>
              </div>

              {/* DADOS PRIMÁRIOS */}
              <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase">Fonte Primária</h4>
                  <span className={`px-2 py-1 text-xs rounded border ${getSourceBadgeColor(selectedValidation.primary.source)}`}>
                    {selectedValidation.primary.source}
                  </span>
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Preço:</span>
                    <span className="text-white font-bold">${selectedValidation.primary.price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Mudança:</span>
                    <span className={selectedValidation.primary.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {selectedValidation.primary.changePercent >= 0 ? '+' : ''}
                      {selectedValidation.primary.changePercent.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Qualidade:</span>
                    <span className="text-white capitalize">{selectedValidation.primary.quality}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Confiança:</span>
                    <span className="text-white">{selectedValidation.confidence}%</span>
                  </div>
                </div>
              </div>

              {/* DADOS ALTERNATIVOS (se disponível) */}
              {selectedValidation.alternative && (
                <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase">Fonte Alternativa</h4>
                    <span className={`px-2 py-1 text-xs rounded border ${getSourceBadgeColor(selectedValidation.alternative.source)}`}>
                      {selectedValidation.alternative.source}
                    </span>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Preço:</span>
                      <span className="text-white font-bold">${selectedValidation.alternative.price.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Discrepância:</span>
                      <span className={selectedValidation.discrepancy > 5 ? 'text-red-400' : 'text-green-400'}>
                        {selectedValidation.discrepancy.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ISSUES DETECTADOS */}
              {selectedValidation.issues.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase">Issues Detectados</h4>
                  {selectedValidation.issues.map((issue, index) => (
                    <div
                      key={index}
                      className={`p-2 rounded text-xs border ${
                        issue.severity === 'error'
                          ? 'bg-red-500/10 border-red-500/30 text-red-400'
                          : issue.severity === 'warning'
                          ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                          : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                      }`}
                    >
                      {issue.message}
                    </div>
                  ))}
                </div>
              )}

              {/* AÇÕES */}
              <div className="flex gap-2 pt-2 border-t border-zinc-700">
                <button
                  onClick={() => validateSingle(selectedSymbol!)}
                  disabled={isValidating}
                  className="flex-1 py-2 px-3 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 inline mr-1 ${isValidating ? 'animate-spin' : ''}`} />
                  Revalidar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500">
              <div className="text-center">
                <Database className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Selecione um símbolo para ver detalhes</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FOOTER COM STATS */}
      <div className="px-4 py-2 bg-zinc-800 border-t border-zinc-700 flex items-center justify-between text-xs">
        <div className="flex gap-4">
          <span className="text-slate-400">
            Total: <span className="text-white font-medium">{stats.totalValidations}</span>
          </span>
          <span className="text-slate-400">
            Avg. Discrepância: <span className="text-white font-medium">{stats.averageDiscrepancy.toFixed(2)}%</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {stats.criticalIssues > 0 && (
            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded border border-red-500/30">
              {stats.criticalIssues} críticos
            </span>
          )}
          <span className="text-slate-400">
            Última atualização: {new Date(stats.lastValidation).toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
}