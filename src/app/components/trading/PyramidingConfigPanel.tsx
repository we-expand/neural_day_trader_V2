/**
 * 🏔️ NEURAL DAY TRADER - PYRAMIDING CONFIGURATION PANEL
 * 
 * Painel ultra-sofisticado de configuração de Pyramiding (Position Scaling)
 * A arte de adicionar posições conforme o trade se move a favor.
 * 
 * ESTRATÉGIAS SUPORTADAS:
 * - Fixed Size: Mesmo tamanho em todas as entradas
 * - Reduced Size: Tamanho decrescente (ex: 1.0, 0.5, 0.25)
 * - Fibonacci: Baseado em sequência de Fibonacci
 * - Exponential: Crescimento exponencial dos contratos
 * - Smart AI: AI decide o melhor tamanho baseado em análise
 * 
 * CARACTERÍSTICAS:
 * - ✅ Trailing Stop Dinâmico por Layer
 * - ✅ Break-Even Automático
 * - ✅ Take Profit Parcial
 * - ✅ AI Risk Analysis em tempo real
 * - ✅ Stop de Emergência (volatilidade/divergências)
 */

import React, { useState } from 'react';
import { 
  Layers, TrendingUp, Shield, Zap, Brain, 
  AlertTriangle, Target, Lock, Unlock, 
  ChevronDown, ChevronUp, Info, Settings2,
  Activity, BarChart3, Gauge, ArrowUpRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface PyramidingConfig {
  // ========== CONFIGURAÇÕES PRINCIPAIS ==========
  enabled: boolean;
  maxLayers: number; // Máximo de entradas (ex: 5 = 1 inicial + 4 adds)
  
  // ========== ESTRATÉGIA DE SCALING ==========
  scalingStrategy: 'fixed' | 'reduced' | 'fibonacci' | 'exponential' | 'smart-ai';
  initialSize: number; // Tamanho inicial em contratos
  sizeMultiplier: number; // Multiplicador para cada layer (usado em algumas estratégias)
  
  // ========== DISTÂNCIA ENTRE ENTRADAS ==========
  entryDistanceType: 'pips' | 'percent' | 'atr' | 'ai-dynamic';
  entryDistance: number; // Distância mínima para próxima entrada
  atrMultiplier: number; // Se usar ATR, multiplicador (ex: 0.5 ATR)
  
  // ========== TRAILING STOP DINÂMICO ==========
  trailingStopEnabled: boolean;
  trailingStopType: 'pips' | 'percent' | 'atr';
  trailingStopDistance: number;
  trailingStopPerLayer: boolean; // Trailing stop independente por layer
  
  // ========== BREAK-EVEN & TAKE PROFIT ==========
  breakEvenEnabled: boolean;
  breakEvenAfterLayers: number; // Mover para break-even após X layers
  partialTakeProfitEnabled: boolean;
  partialTakeProfitPercent: number; // % de posição a fechar em cada TP
  partialTakeProfitLayers: number[]; // Em quais layers fechar parcial (ex: [2, 4])
  
  // ========== AI RISK MANAGEMENT ==========
  aiRiskAnalysisEnabled: boolean;
  maxRiskPercentPerLayer: number; // Risco máximo por layer (% da conta)
  stopAddingOnDivergence: boolean; // Parar se detectar divergência
  stopAddingOnHighVolatility: boolean; // Parar se volatilidade aumentar muito
  requiredMomentumScore: number; // Score mínimo de momentum para adicionar (0-100)
  
  // ========== STOP DE EMERGÊNCIA ==========
  emergencyStopEnabled: boolean;
  emergencyStopLossPercent: number; // Stop loss de emergência para posição total
  closeAllOnReversal: boolean; // Fechar tudo se detectar reversão forte
}

interface PyramidingConfigPanelProps {
  config: PyramidingConfig;
  onChange: (config: PyramidingConfig) => void;
  className?: string;
}

export function PyramidingConfigPanel({ config, onChange, className = '' }: PyramidingConfigPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeSection, setActiveSection] = useState<string>('scaling');

  const updateConfig = (updates: Partial<PyramidingConfig>) => {
    onChange({ ...config, ...updates });
  };

  const sections = [
    { id: 'scaling', label: 'Estratégia de Scaling', icon: Layers },
    { id: 'entry', label: 'Distância entre Entradas', icon: ArrowUpRight },
    { id: 'stops', label: 'Trailing Stops', icon: Shield },
    { id: 'profit', label: 'Take Profit & Break-Even', icon: Target },
    { id: 'ai', label: 'AI Risk Management', icon: Brain },
    { id: 'emergency', label: 'Stop de Emergência', icon: AlertTriangle },
  ];

  const scalingStrategies = [
    {
      id: 'fixed',
      name: 'Fixed Size',
      description: 'Mesmo tamanho em todas as entradas',
      example: '1.0 → 1.0 → 1.0 → 1.0',
      icon: Lock,
      risk: 'Médio'
    },
    {
      id: 'reduced',
      name: 'Reduced Size',
      description: 'Tamanho decrescente para reduzir risco',
      example: '1.0 → 0.5 → 0.25 → 0.125',
      icon: TrendingUp,
      risk: 'Baixo'
    },
    {
      id: 'fibonacci',
      name: 'Fibonacci',
      description: 'Baseado em sequência de Fibonacci',
      example: '1 → 1 → 2 → 3 → 5',
      icon: Activity,
      risk: 'Alto'
    },
    {
      id: 'exponential',
      name: 'Exponential',
      description: 'Crescimento exponencial (muito agressivo)',
      example: '1 → 2 → 4 → 8 → 16',
      icon: Zap,
      risk: 'Muito Alto'
    },
    {
      id: 'smart-ai',
      name: 'Smart AI',
      description: 'AI decide baseado em análise em tempo real',
      example: 'Variável (AI decide)',
      icon: Brain,
      risk: 'Adaptativo'
    }
  ];

  return (
    <div className={`bg-[#0A0A0A] border border-white/10 rounded-2xl overflow-hidden ${className}`}>
      {/* ========== HEADER ========== */}
      <div 
        className="px-6 py-4 border-b border-white/5 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center">
              <Layers className="w-5 h-5 text-amber-400" />
            </div>
            
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Pyramiding Configuration</h3>
                <div className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                  config.enabled 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                }`}>
                  {config.enabled ? 'Ativo' : 'Inativo'}
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Adicione posições conforme o trade se move a favor • Gerenciamento de risco ultra-sofisticado
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {config.enabled && (
              <div className="text-right">
                <div className="text-xs text-slate-500">Max Layers</div>
                <div className="text-sm font-bold text-amber-400">{config.maxLayers}</div>
              </div>
            )}
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                updateConfig({ enabled: !config.enabled });
              }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                config.enabled
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                  : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              {config.enabled ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            </button>
            
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-slate-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-500" />
            )}
          </div>
        </div>
      </div>

      {/* ========== CONTENT ========== */}
      <AnimatePresence>
        {isExpanded && config.enabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="p-6 space-y-6">
              {/* Section Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {sections.map((section) => {
                  const Icon = section.icon;
                  const isActive = activeSection === section.id;
                  
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                        isActive
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {section.label}
                    </button>
                  );
                })}
              </div>

              {/* ========== SCALING STRATEGY ========== */}
              {activeSection === 'scaling' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-amber-400">
                    <Layers className="w-4 h-4" />
                    <h4 className="text-sm font-bold uppercase tracking-wider">Estratégia de Scaling</h4>
                  </div>
                  
                  {/* Strategies Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {scalingStrategies.map((strategy) => {
                      const Icon = strategy.icon;
                      const isSelected = config.scalingStrategy === strategy.id;
                      
                      return (
                        <button
                          key={strategy.id}
                          onClick={() => updateConfig({ scalingStrategy: strategy.id as any })}
                          className={`p-4 rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'bg-amber-500/10 border-amber-500/30'
                              : 'bg-[#080808] border-white/10 hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Icon className={`w-4 h-4 ${isSelected ? 'text-amber-400' : 'text-slate-500'}`} />
                              <span className={`text-sm font-bold ${isSelected ? 'text-amber-400' : 'text-white'}`}>
                                {strategy.name}
                              </span>
                            </div>
                            
                            <div className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${
                              strategy.risk === 'Baixo' ? 'bg-emerald-500/20 text-emerald-400' :
                              strategy.risk === 'Médio' ? 'bg-yellow-500/20 text-yellow-400' :
                              strategy.risk === 'Alto' ? 'bg-orange-500/20 text-orange-400' :
                              strategy.risk === 'Muito Alto' ? 'bg-rose-500/20 text-rose-400' :
                              'bg-blue-500/20 text-blue-400'
                            }`}>
                              {strategy.risk}
                            </div>
                          </div>
                          
                          <p className="text-xs text-slate-400 mb-2">{strategy.description}</p>
                          
                          <div className="px-3 py-2 bg-white/5 rounded-lg">
                            <div className="text-[10px] text-slate-500 mb-1">Exemplo:</div>
                            <div className="text-xs font-mono text-slate-300">{strategy.example}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  
                  {/* Size Configuration */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-2">
                        Tamanho Inicial (contratos)
                      </label>
                      <input
                        type="number"
                        value={config.initialSize}
                        onChange={(e) => updateConfig({ initialSize: parseFloat(e.target.value) })}
                        min="0.01"
                        step="0.01"
                        className="w-full px-3 py-2 bg-[#080808] border border-white/10 rounded-lg text-sm text-white focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 outline-none"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-2">
                        Máximo de Layers
                      </label>
                      <input
                        type="number"
                        value={config.maxLayers}
                        onChange={(e) => updateConfig({ maxLayers: parseInt(e.target.value) })}
                        min="2"
                        max="10"
                        className="w-full px-3 py-2 bg-[#080808] border border-white/10 rounded-lg text-sm text-white focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 outline-none"
                      />
                    </div>
                  </div>
                  
                  {(config.scalingStrategy === 'reduced' || config.scalingStrategy === 'exponential') && (
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-2">
                        Multiplicador de Tamanho
                      </label>
                      <input
                        type="number"
                        value={config.sizeMultiplier}
                        onChange={(e) => updateConfig({ sizeMultiplier: parseFloat(e.target.value) })}
                        min="0.1"
                        max="10"
                        step="0.1"
                        className="w-full px-3 py-2 bg-[#080808] border border-white/10 rounded-lg text-sm text-white focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 outline-none"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        {config.scalingStrategy === 'reduced' 
                          ? 'Cada layer será multiplicado por este valor (ex: 0.5 = reduz pela metade)'
                          : 'Cada layer será multiplicado por este valor (ex: 2 = dobra o tamanho)'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ========== ENTRY DISTANCE ========== */}
              {activeSection === 'entry' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-amber-400">
                    <ArrowUpRight className="w-4 h-4" />
                    <h4 className="text-sm font-bold uppercase tracking-wider">Distância entre Entradas</h4>
                  </div>
                  
                  {/* Distance Type */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { id: 'pips', label: 'Pips', description: 'Distância fixa em pips' },
                      { id: 'percent', label: 'Porcentagem', description: 'Distância em % do preço' },
                      { id: 'atr', label: 'ATR', description: 'Baseado em volatilidade (ATR)' },
                      { id: 'ai-dynamic', label: 'AI Dinâmico', description: 'AI decide baseado em condições' },
                    ].map((type) => (
                      <button
                        key={type.id}
                        onClick={() => updateConfig({ entryDistanceType: type.id as any })}
                        className={`p-3 rounded-lg border text-center transition-all ${
                          config.entryDistanceType === type.id
                            ? 'bg-amber-500/10 border-amber-500/30'
                            : 'bg-[#080808] border-white/10 hover:bg-white/5'
                        }`}
                      >
                        <div className={`text-xs font-bold mb-1 ${
                          config.entryDistanceType === type.id ? 'text-amber-400' : 'text-white'
                        }`}>
                          {type.label}
                        </div>
                        <div className="text-[10px] text-slate-500">{type.description}</div>
                      </button>
                    ))}
                  </div>
                  
                  {/* Distance Value */}
                  {config.entryDistanceType !== 'ai-dynamic' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-2">
                          Distância Mínima {
                            config.entryDistanceType === 'pips' ? '(pips)' :
                            config.entryDistanceType === 'percent' ? '(%)' :
                            '(ATR Multiplier)'
                          }
                        </label>
                        <input
                          type="number"
                          value={config.entryDistanceType === 'atr' ? config.atrMultiplier : config.entryDistance}
                          onChange={(e) => {
                            if (config.entryDistanceType === 'atr') {
                              updateConfig({ atrMultiplier: parseFloat(e.target.value) });
                            } else {
                              updateConfig({ entryDistance: parseFloat(e.target.value) });
                            }
                          }}
                          min="0.1"
                          step="0.1"
                          className="w-full px-3 py-2 bg-[#080808] border border-white/10 rounded-lg text-sm text-white focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 outline-none"
                        />
                      </div>
                    </div>
                  )}
                  
                  <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                      <div className="text-xs text-blue-300">
                        <strong>Recomendação:</strong> Use ATR ou AI Dinâmico para adaptar automaticamente 
                        às condições de mercado. Distâncias muito pequenas aumentam o risco de stop out.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ========== TRAILING STOPS ========== */}
              {activeSection === 'stops' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-amber-400">
                    <Shield className="w-4 h-4" />
                    <h4 className="text-sm font-bold uppercase tracking-wider">Trailing Stops Dinâmicos</h4>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-[#080808] rounded-lg border border-white/10">
                    <div>
                      <div className="text-sm font-bold text-white mb-1">Trailing Stop Ativado</div>
                      <div className="text-xs text-slate-500">Stops que seguem o preço automaticamente</div>
                    </div>
                    <button
                      onClick={() => updateConfig({ trailingStopEnabled: !config.trailingStopEnabled })}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                        config.trailingStopEnabled
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-white/5 text-slate-400 border border-white/10'
                      }`}
                    >
                      {config.trailingStopEnabled ? 'Ativo' : 'Inativo'}
                    </button>
                  </div>
                  
                  {config.trailingStopEnabled && (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'pips', label: 'Pips' },
                          { id: 'percent', label: 'Porcentagem' },
                          { id: 'atr', label: 'ATR' },
                        ].map((type) => (
                          <button
                            key={type.id}
                            onClick={() => updateConfig({ trailingStopType: type.id as any })}
                            className={`p-3 rounded-lg border text-center transition-all ${
                              config.trailingStopType === type.id
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                : 'bg-[#080808] border-white/10 text-slate-400 hover:bg-white/5'
                            }`}
                          >
                            <div className="text-xs font-bold">{type.label}</div>
                          </button>
                        ))}
                      </div>
                      
                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-2">
                          Distância do Trailing Stop
                        </label>
                        <input
                          type="number"
                          value={config.trailingStopDistance}
                          onChange={(e) => updateConfig({ trailingStopDistance: parseFloat(e.target.value) })}
                          min="0.1"
                          step="0.1"
                          className="w-full px-3 py-2 bg-[#080808] border border-white/10 rounded-lg text-sm text-white focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 outline-none"
                        />
                      </div>
                      
                      <div className="flex items-center justify-between p-4 bg-[#080808] rounded-lg border border-white/10">
                        <div>
                          <div className="text-sm font-bold text-white mb-1">Trailing Stop por Layer</div>
                          <div className="text-xs text-slate-500">Cada entrada tem seu próprio trailing stop</div>
                        </div>
                        <button
                          onClick={() => updateConfig({ trailingStopPerLayer: !config.trailingStopPerLayer })}
                          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                            config.trailingStopPerLayer
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-white/5 text-slate-400 border border-white/10'
                          }`}
                        >
                          {config.trailingStopPerLayer ? 'Ativo' : 'Inativo'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ========== PROFIT & BREAK-EVEN ========== */}
              {activeSection === 'profit' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-amber-400">
                    <Target className="w-4 h-4" />
                    <h4 className="text-sm font-bold uppercase tracking-wider">Take Profit & Break-Even</h4>
                  </div>
                  
                  {/* Break-Even */}
                  <div className="p-4 bg-[#080808] rounded-lg border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-white mb-1">Break-Even Automático</div>
                        <div className="text-xs text-slate-500">Move stop para preço de entrada após X layers</div>
                      </div>
                      <button
                        onClick={() => updateConfig({ breakEvenEnabled: !config.breakEvenEnabled })}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                          config.breakEvenEnabled
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-white/5 text-slate-400 border border-white/10'
                        }`}
                      >
                        {config.breakEvenEnabled ? 'Ativo' : 'Inativo'}
                      </button>
                    </div>
                    
                    {config.breakEvenEnabled && (
                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-2">
                          Ativar após quantos layers?
                        </label>
                        <input
                          type="number"
                          value={config.breakEvenAfterLayers}
                          onChange={(e) => updateConfig({ breakEvenAfterLayers: parseInt(e.target.value) })}
                          min="1"
                          max={config.maxLayers}
                          className="w-full px-3 py-2 bg-[#0A0A0A] border border-white/10 rounded-lg text-sm text-white focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 outline-none"
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Partial Take Profit */}
                  <div className="p-4 bg-[#080808] rounded-lg border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-white mb-1">Take Profit Parcial</div>
                        <div className="text-xs text-slate-500">Fechar parte da posição em layers específicos</div>
                      </div>
                      <button
                        onClick={() => updateConfig({ partialTakeProfitEnabled: !config.partialTakeProfitEnabled })}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                          config.partialTakeProfitEnabled
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-white/5 text-slate-400 border border-white/10'
                        }`}
                      >
                        {config.partialTakeProfitEnabled ? 'Ativo' : 'Inativo'}
                      </button>
                    </div>
                    
                    {config.partialTakeProfitEnabled && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-400 mb-2">
                            % da posição a fechar
                          </label>
                          <input
                            type="number"
                            value={config.partialTakeProfitPercent}
                            onChange={(e) => updateConfig({ partialTakeProfitPercent: parseFloat(e.target.value) })}
                            min="10"
                            max="90"
                            step="10"
                            className="w-full px-3 py-2 bg-[#0A0A0A] border border-white/10 rounded-lg text-sm text-white focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-400 mb-2">
                            Fechar nos layers (ex: 2,4)
                          </label>
                          <input
                            type="text"
                            value={config.partialTakeProfitLayers.join(',')}
                            onChange={(e) => {
                              const layers = e.target.value.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
                              updateConfig({ partialTakeProfitLayers: layers });
                            }}
                            placeholder="2,4"
                            className="w-full px-3 py-2 bg-[#0A0A0A] border border-white/10 rounded-lg text-sm text-white focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ========== AI RISK MANAGEMENT ========== */}
              {activeSection === 'ai' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-amber-400">
                    <Brain className="w-4 h-4" />
                    <h4 className="text-sm font-bold uppercase tracking-wider">AI Risk Management</h4>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-[#080808] rounded-lg border border-white/10">
                    <div>
                      <div className="text-sm font-bold text-white mb-1">AI Risk Analysis</div>
                      <div className="text-xs text-slate-500">AI analisa cada add antes de executar</div>
                    </div>
                    <button
                      onClick={() => updateConfig({ aiRiskAnalysisEnabled: !config.aiRiskAnalysisEnabled })}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                        config.aiRiskAnalysisEnabled
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-white/5 text-slate-400 border border-white/10'
                      }`}
                    >
                      {config.aiRiskAnalysisEnabled ? 'Ativo' : 'Inativo'}
                    </button>
                  </div>
                  
                  {config.aiRiskAnalysisEnabled && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-2">
                          Risco Máximo por Layer (% da conta)
                        </label>
                        <input
                          type="number"
                          value={config.maxRiskPercentPerLayer}
                          onChange={(e) => updateConfig({ maxRiskPercentPerLayer: parseFloat(e.target.value) })}
                          min="0.1"
                          max="5"
                          step="0.1"
                          className="w-full px-3 py-2 bg-[#080808] border border-white/10 rounded-lg text-sm text-white focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 outline-none"
                        />
                        <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                          <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                          <p className="text-xs text-yellow-300">
                            Recomendado: 0.5-1% por layer para controle de risco adequado
                          </p>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-2">
                          Score Mínimo de Momentum (0-100)
                        </label>
                        <input
                          type="number"
                          value={config.requiredMomentumScore}
                          onChange={(e) => updateConfig({ requiredMomentumScore: parseInt(e.target.value) })}
                          min="0"
                          max="100"
                          className="w-full px-3 py-2 bg-[#080808] border border-white/10 rounded-lg text-sm text-white focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 outline-none"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          AI só adiciona se momentum estiver acima deste score
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-3 bg-[#080808] rounded-lg border border-white/10">
                          <div className="text-xs font-bold text-white">Parar ao detectar divergência</div>
                          <button
                            onClick={() => updateConfig({ stopAddingOnDivergence: !config.stopAddingOnDivergence })}
                            className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${
                              config.stopAddingOnDivergence
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-white/5 text-slate-400'
                            }`}
                          >
                            {config.stopAddingOnDivergence ? 'Sim' : 'Não'}
                          </button>
                        </div>
                        
                        <div className="flex items-center justify-between p-3 bg-[#080808] rounded-lg border border-white/10">
                          <div className="text-xs font-bold text-white">Parar com alta volatilidade</div>
                          <button
                            onClick={() => updateConfig({ stopAddingOnHighVolatility: !config.stopAddingOnHighVolatility })}
                            className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${
                              config.stopAddingOnHighVolatility
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-white/5 text-slate-400'
                            }`}
                          >
                            {config.stopAddingOnHighVolatility ? 'Sim' : 'Não'}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ========== EMERGENCY STOP ========== */}
              {activeSection === 'emergency' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-rose-400">
                    <AlertTriangle className="w-4 h-4" />
                    <h4 className="text-sm font-bold uppercase tracking-wider">Stop de Emergência</h4>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-rose-500/10 rounded-lg border border-rose-500/30">
                    <div>
                      <div className="text-sm font-bold text-white mb-1">Stop de Emergência Ativado</div>
                      <div className="text-xs text-rose-300">Fecha toda a posição se atingir perda máxima</div>
                    </div>
                    <button
                      onClick={() => updateConfig({ emergencyStopEnabled: !config.emergencyStopEnabled })}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                        config.emergencyStopEnabled
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-white/5 text-slate-400 border border-white/10'
                      }`}
                    >
                      {config.emergencyStopEnabled ? 'Ativo' : 'Inativo'}
                    </button>
                  </div>
                  
                  {config.emergencyStopEnabled && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-2">
                          Stop Loss de Emergência (% da conta)
                        </label>
                        <input
                          type="number"
                          value={config.emergencyStopLossPercent}
                          onChange={(e) => updateConfig({ emergencyStopLossPercent: parseFloat(e.target.value) })}
                          min="1"
                          max="20"
                          step="0.5"
                          className="w-full px-3 py-2 bg-[#080808] border border-white/10 rounded-lg text-sm text-white focus:border-rose-500/50 focus:ring-2 focus:ring-rose-500/20 outline-none"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          Se perder mais que este %, fecha TODA a posição
                        </p>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-[#080808] rounded-lg border border-white/10">
                        <div>
                          <div className="text-xs font-bold text-white mb-1">Fechar tudo em reversão</div>
                          <div className="text-[10px] text-slate-500">Detecta reversão forte e fecha posição</div>
                        </div>
                        <button
                          onClick={() => updateConfig({ closeAllOnReversal: !config.closeAllOnReversal })}
                          className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${
                            config.closeAllOnReversal
                              ? 'bg-rose-500/20 text-rose-400'
                              : 'bg-white/5 text-slate-400'
                          }`}
                        >
                          {config.closeAllOnReversal ? 'Sim' : 'Não'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Default configuration
export const DEFAULT_PYRAMIDING_CONFIG: PyramidingConfig = {
  enabled: false,
  maxLayers: 5,
  scalingStrategy: 'reduced',
  initialSize: 1.0,
  sizeMultiplier: 0.5,
  entryDistanceType: 'atr',
  entryDistance: 20,
  atrMultiplier: 0.5,
  trailingStopEnabled: true,
  trailingStopType: 'atr',
  trailingStopDistance: 1.0,
  trailingStopPerLayer: false,
  breakEvenEnabled: true,
  breakEvenAfterLayers: 2,
  partialTakeProfitEnabled: false,
  partialTakeProfitPercent: 50,
  partialTakeProfitLayers: [2, 4],
  aiRiskAnalysisEnabled: true,
  maxRiskPercentPerLayer: 0.5,
  stopAddingOnDivergence: true,
  stopAddingOnHighVolatility: true,
  requiredMomentumScore: 60,
  emergencyStopEnabled: true,
  emergencyStopLossPercent: 5,
  closeAllOnReversal: true,
};
