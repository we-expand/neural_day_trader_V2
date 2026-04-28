/**
 * ⚙️ BACKTEST CONFIG MODAL - ENHANCED
 * 
 * Modal de configuração COMPLETO de execução do backtest
 * 
 * FEATURES ADICIONADAS:
 * - Seleção de timeframe do gráfico
 * - Períodos pré-definidos (1M, 3M, 6M, 1Y) + customizado
 * - Direção do trade (Comprado/Vendido/Ambos)
 * - Horários de operação (janelas de trading)
 */

import React, { useState } from 'react';
import { X, Play, Calendar, TrendingUp, Settings, Zap, Clock, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type PeriodPreset = '1M' | '3M' | '6M' | '1Y' | 'custom';
type TradeDirection = 'long' | 'short' | 'both';
type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';

interface TradingHours {
  enabled: boolean;
  startTime: string;  // HH:MM
  endTime: string;    // HH:MM
}

interface BacktestConfig {
  asset: string;
  timeframe: Timeframe;
  periodPreset: PeriodPreset;
  startDate: string;
  endDate: string;
  analysisDate: string;
  quantity: number;
  maxQuantity: number;
  tradeDirection: TradeDirection;
  tradingHours: TradingHours;
  strategyId: string | null;
}

interface BacktestConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (config: BacktestConfig) => void;
  onCreateStrategy: () => void;
}

export function BacktestConfigModal({ 
  isOpen, 
  onClose, 
  onStart,
  onCreateStrategy 
}: BacktestConfigModalProps) {
  const [config, setConfig] = useState<BacktestConfig>({
    asset: 'BTCUSD',
    timeframe: '1h',
    periodPreset: '1M',
    startDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 1);
      return date.toISOString().split('T')[0];
    })(),
    endDate: new Date().toISOString().split('T')[0],
    analysisDate: (() => {
      const date = new Date();
      date.setFullYear(date.getFullYear() - 1);
      return date.toISOString().split('T')[0];
    })(),
    quantity: 1,
    maxQuantity: 10,
    tradeDirection: 'both',
    tradingHours: {
      enabled: false,
      startTime: '09:00',
      endTime: '18:00'
    },
    strategyId: null
  });

  // Períodos pré-definidos
  const periodPresets = [
    { id: '1M' as PeriodPreset, label: 'Último Mês', months: 1 },
    { id: '3M' as PeriodPreset, label: 'Últimos 3 Meses', months: 3 },
    { id: '6M' as PeriodPreset, label: 'Últimos 6 Meses', months: 6 },
    { id: '1Y' as PeriodPreset, label: 'Último Ano', months: 12 }
  ];

  // Timeframes disponíveis
  const timeframes: { value: Timeframe; label: string }[] = [
    { value: '1m', label: '1 minuto' },
    { value: '5m', label: '5 minutos' },
    { value: '15m', label: '15 minutos' },
    { value: '30m', label: '30 minutos' },
    { value: '1h', label: '1 hora' },
    { value: '4h', label: '4 horas' },
    { value: '1d', label: '1 dia' }
  ];

  // Estratégias salvas
  const savedStrategies = [
    { id: '1', name: 'Rompimento', description: 'Estratégia de rompimento de suporte/resistência' },
    { id: '2', name: 'TDSM_98', description: 'Tendência + RSI divergência' },
    { id: '3', name: 'Indicador de Retrocessos', description: 'Fibonacci + EMA' },
    { id: '4', name: 'False Breaktroughs', description: 'Falso rompimento' },
    { id: '5', name: 'AA PURE BREAK', description: 'Breakout puro' },
    { id: '6', name: 'WIKIOSKIT EXECUTION', description: 'Execução baseada em volume' }
  ];

  // Atualizar período quando preset muda
  const handlePeriodPresetChange = (preset: PeriodPreset) => {
    setConfig({ ...config, periodPreset: preset });

    if (preset !== 'custom') {
      const selectedPreset = periodPresets.find(p => p.id === preset);
      if (selectedPreset) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - selectedPreset.months);
        
        setConfig({
          ...config,
          periodPreset: preset,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        });
      }
    }
  };

  const handleStart = () => {
    if (!config.strategyId) {
      alert('Selecione uma estratégia para executar o backtest');
      return;
    }
    onStart(config);
  };

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
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] max-h-[90vh] bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-[101] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded flex items-center justify-center">
                  <Settings className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Configurações de Execução</h2>
                  <p className="text-xs text-slate-500">Configure os parâmetros do backtest</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-zinc-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* ROW 1: Asset + Timeframe */}
                <div className="grid grid-cols-2 gap-6">
                  {/* Asset */}
                  <div>
                    <label className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                      <TrendingUp className="w-4 h-4" />
                      Ativo
                    </label>
                    <div className="flex items-center gap-2 bg-zinc-800 rounded px-3 py-2.5 border border-zinc-700">
                      <div className="w-6 h-6 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-white">₿</span>
                      </div>
                      <span className="text-sm text-white font-medium">BTCUSD</span>
                      <span className="text-xs text-slate-500 ml-auto">Bitcoin</span>
                    </div>
                  </div>

                  {/* Timeframe do Gráfico */}
                  <div>
                    <label className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                      <Clock className="w-4 h-4" />
                      Timeframe do Gráfico
                    </label>
                    <select
                      value={config.timeframe}
                      onChange={(e) => setConfig({ ...config, timeframe: e.target.value as Timeframe })}
                      className="w-full bg-zinc-800 text-slate-300 text-sm rounded px-3 py-2.5 border border-zinc-700 focus:border-blue-500 focus:outline-none"
                    >
                      {timeframes.map(tf => (
                        <option key={tf.value} value={tf.value}>{tf.label}</option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-600 mt-1">Temporalidade dos candles</p>
                  </div>
                </div>

                {/* ROW 2: Período */}
                <div>
                  <label className="flex items-center gap-2 text-sm text-slate-400 mb-3">
                    <Calendar className="w-4 h-4" />
                    Período do Backtest
                  </label>
                  
                  {/* Presets */}
                  <div className="flex gap-2 mb-3">
                    {periodPresets.map(preset => (
                      <button
                        key={preset.id}
                        onClick={() => handlePeriodPresetChange(preset.id)}
                        className={`flex-1 px-3 py-2 text-xs font-medium rounded transition-all ${
                          config.periodPreset === preset.id
                            ? 'bg-blue-600 text-white border border-blue-500'
                            : 'bg-zinc-800 text-slate-400 hover:text-white border border-zinc-700 hover:border-zinc-600'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                    <button
                      onClick={() => setConfig({ ...config, periodPreset: 'custom' })}
                      className={`flex-1 px-3 py-2 text-xs font-medium rounded transition-all ${
                        config.periodPreset === 'custom'
                          ? 'bg-blue-600 text-white border border-blue-500'
                          : 'bg-zinc-800 text-slate-400 hover:text-white border border-zinc-700 hover:border-zinc-600'
                      }`}
                    >
                      Personalizado
                    </button>
                  </div>

                  {/* Datas Customizadas */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Data Inicial</label>
                      <input
                        type="date"
                        value={config.startDate}
                        onChange={(e) => setConfig({ ...config, startDate: e.target.value, periodPreset: 'custom' })}
                        className="w-full bg-zinc-800 text-slate-300 text-sm rounded px-3 py-2 border border-zinc-700 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Data Final</label>
                      <input
                        type="date"
                        value={config.endDate}
                        onChange={(e) => setConfig({ ...config, endDate: e.target.value, periodPreset: 'custom' })}
                        className="w-full bg-zinc-800 text-slate-300 text-sm rounded px-3 py-2 border border-zinc-700 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* ROW 3: Direção + Horários */}
                <div className="grid grid-cols-2 gap-6">
                  {/* Direção do Trade */}
                  <div>
                    <label className="flex items-center gap-2 text-sm text-slate-400 mb-3">
                      <ArrowUpDown className="w-4 h-4" />
                      Direção do Trade
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setConfig({ ...config, tradeDirection: 'long' })}
                        className={`flex flex-col items-center justify-center py-3 px-2 rounded transition-all ${
                          config.tradeDirection === 'long'
                            ? 'bg-emerald-600/20 border-2 border-emerald-500 text-emerald-400'
                            : 'bg-zinc-800 border border-zinc-700 text-slate-400 hover:border-zinc-600'
                        }`}
                      >
                        <ArrowUp className="w-5 h-5 mb-1" />
                        <span className="text-xs font-medium">Comprado</span>
                        <span className="text-[10px] text-slate-600">Long</span>
                      </button>
                      <button
                        onClick={() => setConfig({ ...config, tradeDirection: 'short' })}
                        className={`flex flex-col items-center justify-center py-3 px-2 rounded transition-all ${
                          config.tradeDirection === 'short'
                            ? 'bg-red-600/20 border-2 border-red-500 text-red-400'
                            : 'bg-zinc-800 border border-zinc-700 text-slate-400 hover:border-zinc-600'
                        }`}
                      >
                        <ArrowDown className="w-5 h-5 mb-1" />
                        <span className="text-xs font-medium">Vendido</span>
                        <span className="text-[10px] text-slate-600">Short</span>
                      </button>
                      <button
                        onClick={() => setConfig({ ...config, tradeDirection: 'both' })}
                        className={`flex flex-col items-center justify-center py-3 px-2 rounded transition-all ${
                          config.tradeDirection === 'both'
                            ? 'bg-blue-600/20 border-2 border-blue-500 text-blue-400'
                            : 'bg-zinc-800 border border-zinc-700 text-slate-400 hover:border-zinc-600'
                        }`}
                      >
                        <ArrowUpDown className="w-5 h-5 mb-1" />
                        <span className="text-xs font-medium">Ambos</span>
                        <span className="text-[10px] text-slate-600">Long & Short</span>
                      </button>
                    </div>
                  </div>

                  {/* Horários de Operação */}
                  <div>
                    <label className="flex items-center gap-2 text-sm text-slate-400 mb-3">
                      <Clock className="w-4 h-4" />
                      Horários de Operação
                    </label>
                    
                    {/* Toggle */}
                    <div className="flex items-center gap-3 mb-3">
                      <button
                        onClick={() => setConfig({
                          ...config,
                          tradingHours: { ...config.tradingHours, enabled: !config.tradingHours.enabled }
                        })}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          config.tradingHours.enabled ? 'bg-blue-600' : 'bg-zinc-700'
                        }`}
                      >
                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                          config.tradingHours.enabled ? 'translate-x-[26px]' : 'translate-x-0.5'
                        }`} />
                      </button>
                      <span className="text-xs text-slate-400">
                        {config.tradingHours.enabled ? 'Ativado' : 'Desativado (24h)'}
                      </span>
                    </div>

                    {/* Time Inputs */}
                    {config.tradingHours.enabled && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block">Início</label>
                          <input
                            type="time"
                            value={config.tradingHours.startTime}
                            onChange={(e) => setConfig({
                              ...config,
                              tradingHours: { ...config.tradingHours, startTime: e.target.value }
                            })}
                            className="w-full bg-zinc-800 text-slate-300 text-sm rounded px-3 py-2 border border-zinc-700 focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block">Fim</label>
                          <input
                            type="time"
                            value={config.tradingHours.endTime}
                            onChange={(e) => setConfig({
                              ...config,
                              tradingHours: { ...config.tradingHours, endTime: e.target.value }
                            })}
                            className="w-full bg-zinc-800 text-slate-300 text-sm rounded px-3 py-2 border border-zinc-700 focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ROW 4: Análise + Quantidade */}
                <div className="grid grid-cols-2 gap-6">
                  {/* Período de Análise */}
                  <div>
                    <label className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                      <Calendar className="w-4 h-4" />
                      Período de Análise (Warmup)
                    </label>
                    <input
                      type="date"
                      value={config.analysisDate}
                      onChange={(e) => setConfig({ ...config, analysisDate: e.target.value })}
                      className="w-full bg-zinc-800 text-slate-300 text-sm rounded px-3 py-2 border border-zinc-700 focus:border-blue-500 focus:outline-none"
                    />
                    <p className="text-xs text-slate-600 mt-1">Período usado para cálculo de indicadores</p>
                  </div>

                  {/* Quantidade */}
                  <div>
                    <label className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                      <Zap className="w-4 h-4" />
                      Quantidade
                    </label>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-xs text-slate-500 mb-1 block">Contratos</label>
                        <input
                          type="number"
                          min="1"
                          value={config.quantity}
                          onChange={(e) => setConfig({ ...config, quantity: parseInt(e.target.value) || 1 })}
                          className="w-full bg-zinc-800 text-slate-300 text-sm rounded px-3 py-2 border border-zinc-700 focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-slate-500 mb-1 block">Máximo</label>
                        <input
                          type="number"
                          min="1"
                          value={config.maxQuantity}
                          onChange={(e) => setConfig({ ...config, maxQuantity: parseInt(e.target.value) || 1 })}
                          className="w-full bg-zinc-800 text-slate-300 text-sm rounded px-3 py-2 border border-zinc-700 focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ROW 5: Estratégia */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="flex items-center gap-2 text-sm text-slate-400">
                      <Settings className="w-4 h-4" />
                      Estratégia
                    </label>
                    <button
                      onClick={onCreateStrategy}
                      className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                    >
                      + Personalizado
                    </button>
                  </div>
                  
                  <div className="bg-zinc-800/50 rounded border border-zinc-700 p-3 max-h-[200px] overflow-y-auto space-y-2">
                    {savedStrategies.map((strategy) => (
                      <button
                        key={strategy.id}
                        onClick={() => setConfig({ ...config, strategyId: strategy.id })}
                        className={`w-full text-left px-3 py-2.5 rounded transition-all ${
                          config.strategyId === strategy.id
                            ? 'bg-blue-600/20 border border-blue-500/50'
                            : 'bg-zinc-800 hover:bg-zinc-700 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-2 h-2 rounded-full ${
                            config.strategyId === strategy.id ? 'bg-blue-500' : 'bg-slate-600'
                          }`} />
                          <span className={`text-sm font-medium ${
                            config.strategyId === strategy.id ? 'text-blue-400' : 'text-white'
                          }`}>
                            {strategy.name}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 pl-4">{strategy.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-900/50">
              <div className="text-xs text-slate-500">
                {config.strategyId ? (
                  <span className="text-blue-400">✓ Pronto para executar</span>
                ) : (
                  <span className="text-orange-400">⚠ Selecione uma estratégia</span>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-slate-300 text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleStart}
                  disabled={!config.strategyId}
                  className="px-6 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Play className="w-4 h-4" fill="white" />
                  Executar Backtest
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}