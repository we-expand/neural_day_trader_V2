import React, { useState } from 'react';
import { BrainCircuit, Settings, Sliders, Target, Clock, Zap, TrendingUp, Activity } from 'lucide-react';
import { motion } from 'motion/react';
import { useTradingContext } from '../contexts/TradingContext';
import { AssetUniverse } from './config/AssetUniverse';
import { VoiceAssistant } from './ai/VoiceAssistant';
import { US30ScalpPreset } from './trading/US30ScalpPreset';

/**
 * 🤖 AI Trading Engine
 * Módulo SEPARADO para configuração avançada da IA de trading
 * Este NÃO é o AI Trader - é um módulo independente para configurações
 */
export function AITradingEngine() {
  const { config, setConfig } = useTradingContext();

  const toggleAsset = (symbol: string) => {
    setConfig(prev => ({
      ...prev,
      activeAssets: prev.activeAssets.includes(symbol)
        ? prev.activeAssets.filter(s => s !== symbol)
        : [...prev.activeAssets, symbol]
    }));
  };

  const applyPreset = (preset: 'SCALP' | 'SWING') => {
    if (preset === 'SCALP') {
      setConfig(prev => ({
        ...prev,
        timeframe: '5m',
        targetGainPct: 2,
        stopLossPct: 1,
        riskPerTrade: 0.5,
        maxPositions: 5,
        marketMode: 'TREND'
      }));
    } else {
      setConfig(prev => ({
        ...prev,
        timeframe: '1H',
        targetGainPct: 5,
        stopLossPct: 3,
        riskPerTrade: 1.5,
        maxPositions: 3,
        marketMode: 'TREND'
      }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-neutral-950 to-purple-950/20 p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto space-y-6"
      >
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center shadow-2xl shadow-purple-500/30">
            <BrainCircuit className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-white uppercase">
              AI Trading Engine
            </h1>
            <p className="text-slate-400 mt-1">
              Configuração Avançada do Motor de Inteligência Artificial
            </p>
          </div>
        </div>

        {/* Voice Assistant Embedded */}
        <div className="bg-neutral-900/80 border border-purple-500/30 rounded-xl p-6 backdrop-blur-xl shadow-2xl">
          <VoiceAssistant embedded={true} />
        </div>

        <div className="bg-neutral-900/80 border border-purple-500/30 rounded-xl p-6 backdrop-blur-xl shadow-2xl relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500 animate-gradient-x"></div>

          <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-purple-400" /> Configurações Operacionais da IA
            </h2>
            <div className="flex gap-2">
              <button onClick={() => applyPreset('SCALP')} className="px-3 py-1 text-xs font-bold bg-white/5 hover:bg-white/10 rounded border border-white/10 text-slate-300 transition-all hover:border-purple-500/50">
                Preset: Scalping
              </button>
              <button onClick={() => applyPreset('SWING')} className="px-3 py-1 text-xs font-bold bg-white/5 hover:bg-white/10 rounded border border-white/10 text-slate-300 transition-all hover:border-blue-500/50">
                Preset: Swing
              </button>
            </div>
          </div>

          {/* US30 SCALPING PRESET */}
          <div className="mb-6">
            <US30ScalpPreset onApply={(presetConfig) => {
              setConfig(prev => ({ ...prev, ...presetConfig }));
            }} />
          </div>

          {/* ASSET UNIVERSE SELECTOR */}
          <div className="mb-8">
            <AssetUniverse selectedAssets={config.activeAssets} onToggle={toggleAsset} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* COLUMN 1: ESTRATÉGIA */}
            <div className="space-y-6">
              <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                <Target className="w-4 h-4" /> Estratégia
              </h3>

              {/* Timeframe Selector */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2">
                  <Clock className="w-3 h-3" /> Timeframe Operacional
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {['1m', '5m', '15m', '1H', '4H'].map(tf => (
                    <button
                      key={tf}
                      onClick={() => setConfig(prev => ({ ...prev, timeframe: tf }))}
                      className={`px-1 py-1.5 rounded text-[10px] font-bold border transition-all ${
                        config.timeframe === tf
                          ? 'bg-purple-500/20 border-purple-500 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                          : 'bg-white/5 border-transparent text-slate-500 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              {/* Market Mode */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Fluxo de Operação</label>
                <div className="flex gap-2 p-1 bg-black rounded-lg border border-white/10">
                  <button
                    onClick={() => setConfig({ ...config, marketMode: 'TREND' })}
                    className={`flex-1 py-2 rounded text-[10px] font-bold transition-colors ${
                      config.marketMode === 'TREND'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    A Favor (Trend)
                  </button>
                  <button
                    onClick={() => setConfig({ ...config, marketMode: 'COUNTER' })}
                    className={`flex-1 py-2 rounded text-[10px] font-bold transition-colors ${
                      config.marketMode === 'COUNTER'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Contra (Reversal)
                  </button>
                </div>
              </div>

              {/* Target Gain */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Ganho Alvo (%)</label>
                  <span className="text-xs font-mono text-white">{config.targetGainPct}%</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="10"
                  step="0.5"
                  value={config.targetGainPct}
                  onChange={(e) => setConfig({ ...config, targetGainPct: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>

              {/* Stop Loss */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Stop Loss (%)</label>
                  <span className="text-xs font-mono text-white">{config.stopLossPct}%</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="5"
                  step="0.25"
                  value={config.stopLossPct}
                  onChange={(e) => setConfig({ ...config, stopLossPct: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>
            </div>

            {/* COLUMN 2: GESTÃO DE RISCO */}
            <div className="space-y-6">
              <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2">
                <Zap className="w-4 h-4" /> Gestão de Risco
              </h3>

              {/* Risk Per Trade */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Risco por Trade (%)</label>
                  <span className="text-xs font-mono text-white">{config.riskPerTrade}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="5"
                  step="0.1"
                  value={config.riskPerTrade}
                  onChange={(e) => setConfig({ ...config, riskPerTrade: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>

              {/* Max Positions */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Máximo de Posições Abertas</label>
                  <span className="text-xs font-mono text-white">{config.maxPositions}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={config.maxPositions}
                  onChange={(e) => setConfig({ ...config, maxPositions: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>

              {/* Daily Loss Limit */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Limite de Perda Diária (%)</label>
                  <span className="text-xs font-mono text-white">{config.dailyLossLimit}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={config.dailyLossLimit}
                  onChange={(e) => setConfig({ ...config, dailyLossLimit: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>
            </div>

            {/* COLUMN 3: AVANÇADO */}
            <div className="space-y-6">
              <h3 className="text-xs font-bold text-blue-500 uppercase tracking-widest flex items-center gap-2">
                <Activity className="w-4 h-4" /> Configurações Avançadas
              </h3>

              {/* Leverage */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Alavancagem</label>
                  <span className="text-xs font-mono text-white">{config.leverage}x</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                  value={config.leverage}
                  onChange={(e) => setConfig({ ...config, leverage: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>

              {/* Trade Interval */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Intervalo entre Trades (s)</label>
                  <span className="text-xs font-mono text-white">{config.tradeInterval}s</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="300"
                  step="5"
                  value={config.tradeInterval}
                  onChange={(e) => setConfig({ ...config, tradeInterval: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>

              {/* Trailing Stop */}
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Trailing Stop</label>
                <button
                  onClick={() => setConfig({ ...config, trailingStop: !config.trailingStop })}
                  className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                    config.trailingStop
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-500 border border-slate-700'
                  }`}
                >
                  {config.trailingStop ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Current Config Summary */}
        <div className="bg-neutral-900/80 border border-blue-500/30 rounded-xl p-6 backdrop-blur-xl shadow-2xl">
          <h3 className="text-sm font-bold text-blue-400 mb-4 uppercase tracking-wider flex items-center gap-2">
            <Settings className="w-4 h-4" /> Configuração Atual
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-500">Timeframe:</span>
              <span className="ml-2 text-white font-mono font-bold">{config.timeframe}</span>
            </div>
            <div>
              <span className="text-slate-500">Modo:</span>
              <span className="ml-2 text-white font-mono font-bold">{config.marketMode}</span>
            </div>
            <div>
              <span className="text-slate-500">Alavancagem:</span>
              <span className="ml-2 text-white font-mono font-bold">{config.leverage}x</span>
            </div>
            <div>
              <span className="text-slate-500">Ativos Ativos:</span>
              <span className="ml-2 text-white font-mono font-bold">{config.activeAssets.length}</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
