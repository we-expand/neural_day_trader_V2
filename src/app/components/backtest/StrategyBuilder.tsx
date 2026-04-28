/**
 * 🧠 STRATEGY BUILDER
 * 
 * Construtor Visual de Estratégias de Trading
 * Permite criar estratégias complexas sem código
 * 
 * CONCEITO:
 * - Drag & Drop de condições
 * - Editor visual de regras de entrada/saída
 * - Salvamento em formato JSON
 * - Biblioteca de blocos pré-definidos
 * 
 * ESTRUTURA DE ESTRATÉGIA:
 * {
 *   name: string,
 *   description: string,
 *   entryRules: Rule[],
 *   exitRules: Rule[],
 *   stopLoss: number,
 *   takeProfit: number
 * }
 */

import React, { useState } from 'react';
import { X, Plus, Trash2, Save, Code, Eye, Settings, TrendingUp, TrendingDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Tipos de condições disponíveis
type ConditionType = 
  | 'indicator_cross'      // Cruzamento de indicadores
  | 'price_level'          // Preço acima/abaixo de nível
  | 'candle_pattern'       // Padrão de candle
  | 'volume'               // Volume
  | 'time'                 // Horário
  | 'trend';               // Tendência

interface Condition {
  id: string;
  type: ConditionType;
  indicator1?: string;     // Ex: "EMA_9"
  indicator2?: string;     // Ex: "EMA_21"
  operator?: 'above' | 'below' | 'cross_above' | 'cross_below' | 'equals';
  value?: number;
  description: string;
}

interface Strategy {
  id: string;
  name: string;
  description: string;
  entryConditions: Condition[];
  exitConditions: Condition[];
  stopLoss: number;        // Porcentagem
  takeProfit: number;      // Porcentagem
  maxTrades: number;
  tradeDirection: 'long' | 'short' | 'both';
}

interface StrategyBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (strategy: Strategy) => void;
  editingStrategy?: Strategy | null;
}

export function StrategyBuilder({ 
  isOpen, 
  onClose, 
  onSave,
  editingStrategy 
}: StrategyBuilderProps) {
  const [strategy, setStrategy] = useState<Strategy>(
    editingStrategy || {
      id: Date.now().toString(),
      name: '',
      description: '',
      entryConditions: [],
      exitConditions: [],
      stopLoss: 2,
      takeProfit: 4,
      maxTrades: 3,
      tradeDirection: 'both'
    }
  );

  const [activeTab, setActiveTab] = useState<'entry' | 'exit' | 'risk'>('entry');

  // Blocos de condições disponíveis
  const availableBlocks = [
    { 
      type: 'indicator_cross' as ConditionType, 
      label: 'Cruzamento de Indicadores',
      icon: '📊',
      description: 'EMA, SMA, RSI, MACD...'
    },
    { 
      type: 'price_level' as ConditionType, 
      label: 'Nível de Preço',
      icon: '💰',
      description: 'Preço acima/abaixo'
    },
    { 
      type: 'candle_pattern' as ConditionType, 
      label: 'Padrão de Candle',
      icon: '🕯️',
      description: 'Doji, Engolfo, Martelo...'
    },
    { 
      type: 'volume' as ConditionType, 
      label: 'Volume',
      icon: '📈',
      description: 'Volume anormal'
    },
    { 
      type: 'time' as ConditionType, 
      label: 'Horário',
      icon: '⏰',
      description: 'Horário de trading'
    },
    { 
      type: 'trend' as ConditionType, 
      label: 'Tendência',
      icon: '📉',
      description: 'Tendência de alta/baixa'
    }
  ];

  const addCondition = (type: ConditionType, isEntry: boolean) => {
    const newCondition: Condition = {
      id: Date.now().toString(),
      type,
      description: `Nova condição ${type}`,
      operator: 'above'
    };

    if (isEntry) {
      setStrategy({
        ...strategy,
        entryConditions: [...strategy.entryConditions, newCondition]
      });
    } else {
      setStrategy({
        ...strategy,
        exitConditions: [...strategy.exitConditions, newCondition]
      });
    }
  };

  const removeCondition = (id: string, isEntry: boolean) => {
    if (isEntry) {
      setStrategy({
        ...strategy,
        entryConditions: strategy.entryConditions.filter(c => c.id !== id)
      });
    } else {
      setStrategy({
        ...strategy,
        exitConditions: strategy.exitConditions.filter(c => c.id !== id)
      });
    }
  };

  const handleSave = () => {
    if (!strategy.name) {
      alert('Digite um nome para a estratégia');
      return;
    }
    if (strategy.entryConditions.length === 0) {
      alert('Adicione pelo menos uma condição de entrada');
      return;
    }
    onSave(strategy);
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
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[1100px] h-[700px] bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-[111] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded flex items-center justify-center">
                  <Code className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Construtor de Estratégia</h2>
                  <p className="text-xs text-slate-500">Crie sua estratégia de trading personalizada</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-zinc-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Strategy Info */}
            <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Nome da Estratégia</label>
                  <input
                    type="text"
                    value={strategy.name}
                    onChange={(e) => setStrategy({ ...strategy, name: e.target.value })}
                    placeholder="Ex: Rompimento com RSI"
                    className="w-full bg-zinc-800 text-slate-300 text-sm rounded px-3 py-2 border border-zinc-700 focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Descrição</label>
                  <input
                    type="text"
                    value={strategy.description}
                    onChange={(e) => setStrategy({ ...strategy, description: e.target.value })}
                    placeholder="Breve descrição da estratégia"
                    className="w-full bg-zinc-800 text-slate-300 text-sm rounded px-3 py-2 border border-zinc-700 focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-zinc-800">
              <button
                onClick={() => setActiveTab('entry')}
                className={`px-6 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === 'entry'
                    ? 'text-emerald-400 bg-zinc-800/50'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <TrendingUp className="w-4 h-4 inline mr-2" />
                Condições de Entrada ({strategy.entryConditions.length})
                {activeTab === 'entry' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('exit')}
                className={`px-6 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === 'exit'
                    ? 'text-red-400 bg-zinc-800/50'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <TrendingDown className="w-4 h-4 inline mr-2" />
                Condições de Saída ({strategy.exitConditions.length})
                {activeTab === 'exit' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('risk')}
                className={`px-6 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === 'risk'
                    ? 'text-blue-400 bg-zinc-800/50'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Settings className="w-4 h-4 inline mr-2" />
                Gerenciamento de Risco
                {activeTab === 'risk' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                )}
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden flex">
              {/* Sidebar: Available Blocks */}
              <div className="w-64 border-r border-zinc-800 bg-zinc-900/30 p-4 overflow-y-auto">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Blocos Disponíveis
                </h3>
                <div className="space-y-2">
                  {availableBlocks.map((block) => (
                    <button
                      key={block.type}
                      onClick={() => addCondition(block.type, activeTab === 'entry')}
                      className="w-full text-left p-3 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-purple-500/50 transition-all group"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{block.icon}</span>
                        <span className="text-xs font-medium text-white">{block.label}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 group-hover:text-slate-400">
                        {block.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Main Area: Conditions */}
              <div className="flex-1 p-6 overflow-y-auto">
                {activeTab === 'entry' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-white">Regras de Entrada</h3>
                      <span className="text-xs text-slate-500">
                        Todas as condições devem ser verdadeiras (AND)
                      </span>
                    </div>

                    {strategy.entryConditions.length === 0 ? (
                      <div className="text-center py-12">
                        <Plus className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                        <p className="text-sm text-slate-500 mb-1">Nenhuma condição adicionada</p>
                        <p className="text-xs text-slate-600">
                          Arraste um bloco da esquerda ou clique para adicionar
                        </p>
                      </div>
                    ) : (
                      strategy.entryConditions.map((condition, index) => (
                        <div
                          key={condition.id}
                          className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 hover:border-emerald-500/50 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">
                                {index + 1}
                              </div>
                              <span className="text-sm font-medium text-white">
                                {condition.type.replace('_', ' ').toUpperCase()}
                              </span>
                            </div>
                            <button
                              onClick={() => removeCondition(condition.id, true)}
                              className="text-slate-500 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <input
                            type="text"
                            value={condition.description}
                            onChange={(e) => {
                              const updated = strategy.entryConditions.map(c =>
                                c.id === condition.id ? { ...c, description: e.target.value } : c
                              );
                              setStrategy({ ...strategy, entryConditions: updated });
                            }}
                            placeholder="Descreva a condição..."
                            className="w-full bg-zinc-900 text-slate-300 text-xs rounded px-3 py-2 border border-zinc-700 focus:border-emerald-500 focus:outline-none"
                          />
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'exit' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-white">Regras de Saída</h3>
                      <span className="text-xs text-slate-500">
                        Qualquer condição verdadeira fecha a posição (OR)
                      </span>
                    </div>

                    {strategy.exitConditions.length === 0 ? (
                      <div className="text-center py-12">
                        <Plus className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                        <p className="text-sm text-slate-500 mb-1">Nenhuma condição adicionada</p>
                        <p className="text-xs text-slate-600">
                          Use Stop Loss e Take Profit como saídas padrão
                        </p>
                      </div>
                    ) : (
                      strategy.exitConditions.map((condition, index) => (
                        <div
                          key={condition.id}
                          className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 hover:border-red-500/50 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded bg-red-600 text-white text-xs font-bold flex items-center justify-center">
                                {index + 1}
                              </div>
                              <span className="text-sm font-medium text-white">
                                {condition.type.replace('_', ' ').toUpperCase()}
                              </span>
                            </div>
                            <button
                              onClick={() => removeCondition(condition.id, false)}
                              className="text-slate-500 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <input
                            type="text"
                            value={condition.description}
                            onChange={(e) => {
                              const updated = strategy.exitConditions.map(c =>
                                c.id === condition.id ? { ...c, description: e.target.value } : c
                              );
                              setStrategy({ ...strategy, exitConditions: updated });
                            }}
                            placeholder="Descreva a condição..."
                            className="w-full bg-zinc-900 text-slate-300 text-xs rounded px-3 py-2 border border-zinc-700 focus:border-red-500 focus:outline-none"
                          />
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'risk' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-bold text-white mb-4">Gerenciamento de Risco</h3>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-slate-500 mb-2 block">Stop Loss (%)</label>
                          <input
                            type="number"
                            value={strategy.stopLoss}
                            onChange={(e) => setStrategy({ ...strategy, stopLoss: parseFloat(e.target.value) || 0 })}
                            step="0.5"
                            className="w-full bg-zinc-800 text-slate-300 text-sm rounded px-3 py-2 border border-zinc-700 focus:border-blue-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-xs text-slate-500 mb-2 block">Take Profit (%)</label>
                          <input
                            type="number"
                            value={strategy.takeProfit}
                            onChange={(e) => setStrategy({ ...strategy, takeProfit: parseFloat(e.target.value) || 0 })}
                            step="0.5"
                            className="w-full bg-zinc-800 text-slate-300 text-sm rounded px-3 py-2 border border-zinc-700 focus:border-blue-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-xs text-slate-500 mb-2 block">Máximo de Trades Simultâneos</label>
                          <input
                            type="number"
                            value={strategy.maxTrades}
                            onChange={(e) => setStrategy({ ...strategy, maxTrades: parseInt(e.target.value) || 1 })}
                            min="1"
                            className="w-full bg-zinc-800 text-slate-300 text-sm rounded px-3 py-2 border border-zinc-700 focus:border-blue-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-xs text-slate-500 mb-2 block">Direção do Trade</label>
                          <select
                            value={strategy.tradeDirection}
                            onChange={(e) => setStrategy({ ...strategy, tradeDirection: e.target.value as any })}
                            className="w-full bg-zinc-800 text-slate-300 text-sm rounded px-3 py-2 border border-zinc-700 focus:border-blue-500 focus:outline-none"
                          >
                            <option value="both">Long e Short</option>
                            <option value="long">Apenas Long</option>
                            <option value="short">Apenas Short</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-blue-400 mb-2">Resumo da Estratégia</h4>
                      <div className="space-y-1 text-xs text-slate-400">
                        <p>• {strategy.entryConditions.length} condições de entrada</p>
                        <p>• {strategy.exitConditions.length} condições de saída</p>
                        <p>• Stop Loss: {strategy.stopLoss}%</p>
                        <p>• Take Profit: {strategy.takeProfit}%</p>
                        <p>• Risk/Reward: 1:{(strategy.takeProfit / strategy.stopLoss).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-900/50">
              <div className="text-xs text-slate-500">
                {strategy.name ? (
                  <span className="text-purple-400">✓ {strategy.name}</span>
                ) : (
                  <span className="text-orange-400">⚠ Digite um nome para a estratégia</span>
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
                  onClick={handleSave}
                  disabled={!strategy.name || strategy.entryConditions.length === 0}
                  className="px-6 py-2 rounded bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Salvar Estratégia
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
