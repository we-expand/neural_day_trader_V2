/**
 * 🎨 STRATEGY BUILDER PRO - NÍVEL AGÊNCIA DDB/BBDO
 * 
 * Sistema Visual Premium de Criação de Estratégias
 * Design: Inspirado em Figma, Notion, Linear
 * UX: Micro-interactions, animações fluidas, feedback imediato
 * IA: Sugestões inteligentes, otimização automática
 */

import React, { useState, useCallback, useMemo } from 'react';
import { 
  X, Plus, Trash2, Save, Sparkles, Eye, Play, Code2, Layers, Settings,
  TrendingUp, TrendingDown, Shield, Zap, Copy, Download, Upload, Share2,
  ChevronRight, AlertCircle, CheckCircle, Lightbulb, Wand2, Grid3x3,
  BarChart3, Activity, Target, Brain, MessageSquare, ChevronDown, Search,
  ArrowRight, Star, TrendingUpIcon, Filter, Sliders, Move, Check
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'motion/react';

// ══════════════════════════════════════════════════════════════
// TIPOS
// ══════════════════════════════════════════════════════════════

type IndicatorType = 
  | 'SMA' | 'EMA' | 'RSI' | 'MACD' | 'BB' | 'STOCH' | 'ADX' | 'ATR' 
  | 'VWAP' | 'ICHIMOKU' | 'OBV' | 'MFI' | 'CCI' | 'WILLIAMS' | 'SAR';

type OperatorType = 
  | 'CROSS_ABOVE' | 'CROSS_BELOW' | 'ABOVE' | 'BELOW' 
  | 'BETWEEN' | 'RISING' | 'FALLING';

interface StrategyBlock {
  id: string;
  type: 'ENTRY' | 'EXIT' | 'FILTER';
  category: string;
  indicator?: IndicatorType;
  period?: number;
  operator?: OperatorType;
  value?: number;
  value2?: number;
  label: string;
  description: string;
  color: string;
  icon: string;
  enabled: boolean;
}

interface Strategy {
  id: string;
  name: string;
  description: string;
  entryBlocks: StrategyBlock[];
  exitBlocks: StrategyBlock[];
  filterBlocks: StrategyBlock[];
  stopLoss: number;
  takeProfit: number;
  trailingStop: boolean;
  maxConcurrentTrades: number;
  timeframe: string;
  aiScore?: number;
  aiSuggestions?: string[];
}

// ══════════════════════════════════════════════════════════════
// BIBLIOTECA DE BLOCOS
// ══════════════════════════════════════════════════════════════

const INDICATORS = [
  { id: 'SMA', label: 'SMA', name: 'Simple Moving Average', icon: '📊', color: 'blue', period: 20, popular: true },
  { id: 'EMA', label: 'EMA', name: 'Exponential Moving Average', icon: '📈', color: 'emerald', period: 20, popular: true },
  { id: 'RSI', label: 'RSI', name: 'Relative Strength Index', icon: '⚡', color: 'purple', period: 14, popular: true },
  { id: 'MACD', label: 'MACD', name: 'Moving Average Convergence Divergence', icon: '🎯', color: 'orange', popular: true },
  { id: 'BB', label: 'Bollinger Bands', name: 'Volatility Bands', icon: '🎭', color: 'pink', period: 20 },
  { id: 'STOCH', label: 'Stochastic', name: 'Stochastic Oscillator', icon: '🌊', color: 'cyan', period: 14 },
  { id: 'ADX', label: 'ADX', name: 'Average Directional Index', icon: '💪', color: 'red', period: 14 },
  { id: 'ATR', label: 'ATR', name: 'Average True Range', icon: '📏', color: 'yellow', period: 14 },
  { id: 'VWAP', label: 'VWAP', name: 'Volume Weighted Avg Price', icon: '⚖️', color: 'indigo', popular: true },
  { id: 'ICHIMOKU', label: 'Ichimoku', name: 'Ichimoku Cloud', icon: '☁️', color: 'teal' },
  { id: 'OBV', label: 'OBV', name: 'On Balance Volume', icon: '📦', color: 'lime' },
  { id: 'MFI', label: 'MFI', name: 'Money Flow Index', icon: '💰', color: 'amber', period: 14 },
];

const PATTERNS = [
  { id: 'DOJI', label: 'Doji', icon: '🕯️', color: 'gray' },
  { id: 'HAMMER', label: 'Hammer', icon: '🔨', color: 'green' },
  { id: 'ENGULFING', label: 'Engulfing', icon: '🎪', color: 'violet' },
  { id: 'MORNING_STAR', label: 'Morning Star', icon: '🌅', color: 'rose' },
];

const TEMPLATES = [
  {
    id: 'trend',
    name: 'Trend Following',
    description: 'Segue tendências com EMA 50/200',
    icon: '📈',
    winRate: 58,
    rr: 2.5,
    difficulty: 'Iniciante',
    color: 'emerald'
  },
  {
    id: 'mean_reversion',
    name: 'Mean Reversion',
    description: 'Reversão à média com RSI e BB',
    icon: '🔄',
    winRate: 65,
    rr: 1.8,
    difficulty: 'Intermediário',
    color: 'purple'
  },
  {
    id: 'breakout',
    name: 'Breakout',
    description: 'Rompimentos com volume e ATR',
    icon: '💥',
    winRate: 52,
    rr: 3.2,
    difficulty: 'Avançado',
    color: 'orange'
  },
  {
    id: 'scalping',
    name: 'Scalping',
    description: 'Operações rápidas com VWAP',
    icon: '⚡',
    winRate: 61,
    rr: 1.5,
    difficulty: 'Avançado',
    color: 'cyan'
  },
];

// ══════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (strategy: Strategy) => void;
  editingStrategy?: Strategy | null;
}

export function StrategyBuilderPro({ isOpen, onClose, onSave, editingStrategy }: Props) {
  const [view, setView] = useState<'builder' | 'templates' | 'ai'>('builder');
  const [activeTab, setActiveTab] = useState<'entry' | 'exit' | 'filters' | 'risk'>('entry');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAI, setShowAI] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false); // 🆕 Feedback visual de drag
  
  const [strategy, setStrategy] = useState<Strategy>(
    editingStrategy || {
      id: Date.now().toString(),
      name: '',
      description: '',
      entryBlocks: [],
      exitBlocks: [],
      filterBlocks: [],
      stopLoss: 2,
      takeProfit: 4,
      trailingStop: false,
      maxConcurrentTrades: 3,
      timeframe: '1H'
    }
  );

  const [aiMessages, setAiMessages] = useState([
    {
      id: '1',
      type: 'ai' as const,
      content: '👋 Olá! Sou seu assistente de estratégias. Como posso ajudar?',
      suggestions: [
        'Criar estratégia de trend following',
        'Otimizar gestão de risco',
        'Sugerir indicadores'
      ]
    }
  ]);

  // ═══ Filtrar indicadores ═══
  const filteredIndicators = useMemo(() => {
    return INDICATORS.filter(ind =>
      ind.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ind.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  // ═══ Adicionar bloco ═══
  const addBlock = useCallback((indicator: any) => {
    const newBlock: StrategyBlock = {
      id: Date.now().toString() + Math.random(),
      type: activeTab === 'entry' ? 'ENTRY' : activeTab === 'exit' ? 'EXIT' : 'FILTER',
      category: 'INDICATOR',
      indicator: indicator.id,
      period: indicator.period || 14,
      operator: 'CROSS_ABOVE',
      value: 0,
      label: indicator.label,
      description: indicator.name,
      color: indicator.color,
      icon: indicator.icon,
      enabled: true
    };

    const listKey = activeTab === 'entry' ? 'entryBlocks' : activeTab === 'exit' ? 'exitBlocks' : 'filterBlocks';
    setStrategy(prev => ({
      ...prev,
      [listKey]: [...prev[listKey], newBlock]
    }));
  }, [activeTab]);

  // ═══ Remover bloco ═══
  const removeBlock = useCallback((id: string) => {
    const listKey = activeTab === 'entry' ? 'entryBlocks' : activeTab === 'exit' ? 'exitBlocks' : 'filterBlocks';
    setStrategy(prev => ({
      ...prev,
      [listKey]: prev[listKey].filter(b => b.id !== id)
    }));
  }, [activeTab]);

  // ═══ Análise da IA ═══
  const analyzeWithAI = useCallback(() => {
    const totalBlocks = strategy.entryBlocks.length + strategy.exitBlocks.length;
    const hasRSI = strategy.entryBlocks.some(b => b.indicator === 'RSI');
    const hasMA = strategy.entryBlocks.some(b => b.indicator === 'EMA' || b.indicator === 'SMA');
    
    let score = 40;
    const suggestions: string[] = [];

    if (totalBlocks >= 3) score += 15;
    if (hasRSI && hasMA) score += 25;
    if (strategy.takeProfit / strategy.stopLoss >= 2) score += 20;
    
    if (!hasRSI) suggestions.push('✨ Adicione RSI para confirmar momentum');
    if (!hasMA) suggestions.push('✨ Use médias móveis para filtrar tendência');
    if (strategy.entryBlocks.length < 2) suggestions.push('✨ Mais condições = maior precisão');
    if (strategy.takeProfit / strategy.stopLoss < 2) suggestions.push('✨ Melhore risco/retorno para 1:2 ou mais');

    setStrategy(prev => ({
      ...prev,
      aiScore: Math.min(100, score),
      aiSuggestions: suggestions
    }));

    setAiMessages(prev => [...prev, {
      id: Date.now().toString(),
      type: 'ai' as const,
      content: `✅ Análise concluída!\n\nScore: ${Math.min(100, score)}/100\n\n${suggestions.length > 0 ? 'Aqui estão minhas sugestões:' : 'Estratégia está ótima!'}`,
      suggestions
    }]);

    setShowAI(true);
  }, [strategy]);

  // ═══ Carregar template ═══
  const loadTemplate = useCallback((templateId: string) => {
    const templates: Record<string, Partial<Strategy>> = {
      trend: {
        name: 'Trend Following Clássico',
        description: 'Estratégia baseada em cruzamento de EMAs 50/200',
        entryBlocks: [
          {
            id: '1',
            type: 'ENTRY',
            category: 'INDICATOR',
            indicator: 'EMA',
            period: 50,
            operator: 'CROSS_ABOVE',
            label: 'EMA 50',
            description: 'EMA 50 cruza acima EMA 200',
            color: 'emerald',
            icon: '📈',
            enabled: true,
            value: 200
          },
          {
            id: '2',
            type: 'ENTRY',
            category: 'INDICATOR',
            indicator: 'RSI',
            period: 14,
            operator: 'ABOVE',
            label: 'RSI',
            description: 'RSI acima de 50',
            color: 'purple',
            icon: '⚡',
            enabled: true,
            value: 50
          }
        ],
        exitBlocks: [],
        filterBlocks: [],
        stopLoss: 2,
        takeProfit: 5,
        trailingStop: true,
        maxConcurrentTrades: 3,
        timeframe: '1H'
      },
      mean_reversion: {
        name: 'Mean Reversion com RSI',
        description: 'Opera reversões usando RSI e Bollinger Bands',
        entryBlocks: [
          {
            id: '1',
            type: 'ENTRY',
            category: 'INDICATOR',
            indicator: 'RSI',
            period: 14,
            operator: 'BELOW',
            label: 'RSI',
            description: 'RSI abaixo de 30 (sobrevenda)',
            color: 'purple',
            icon: '⚡',
            enabled: true,
            value: 30
          },
          {
            id: '2',
            type: 'ENTRY',
            category: 'INDICATOR',
            indicator: 'BB',
            period: 20,
            operator: 'BELOW',
            label: 'Bollinger Bands',
            description: 'Preço toca banda inferior',
            color: 'pink',
            icon: '🎭',
            enabled: true
          }
        ],
        exitBlocks: [
          {
            id: '3',
            type: 'EXIT',
            category: 'INDICATOR',
            indicator: 'RSI',
            period: 14,
            operator: 'ABOVE',
            label: 'RSI',
            description: 'RSI volta acima de 50',
            color: 'purple',
            icon: '⚡',
            enabled: true,
            value: 50
          }
        ],
        filterBlocks: [],
        stopLoss: 1.5,
        takeProfit: 3,
        trailingStop: false,
        maxConcurrentTrades: 5,
        timeframe: '15M'
      }
    };

    const template = templates[templateId];
    if (template) {
      setStrategy(prev => ({ ...prev, ...template }));
      setView('builder');
    }
  }, []);

  // ═══ Salvar ═══
  const handleSave = useCallback(() => {
    if (!strategy.name.trim()) {
      alert('Por favor, dê um nome para sua estratégia');
      return;
    }
    if (strategy.entryBlocks.length === 0) {
      alert('Adicione pelo menos uma condição de entrada');
      return;
    }
    onSave(strategy);
  }, [strategy, onSave]);

  if (!isOpen) return null;

  const currentBlocks = activeTab === 'entry' ? strategy.entryBlocks : activeTab === 'exit' ? strategy.exitBlocks : strategy.filterBlocks;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/90 backdrop-blur-xl"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 20 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="relative w-full max-w-[1600px] h-[90vh] bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 rounded-2xl shadow-2xl border border-zinc-800/50 flex flex-col overflow-hidden"
        >
          {/* ═══ HEADER ═══ */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/50 bg-zinc-900/50 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl flex items-center justify-center shadow-lg shadow-purple-900/50">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Strategy Builder Pro</h1>
                <p className="text-sm text-slate-400">Crie estratégias vencedoras visualmente</p>
              </div>
            </div>

            {/* View Tabs */}
            <div className="flex items-center gap-2 bg-zinc-800/50 rounded-lg p-1">
              <button
                onClick={() => setView('templates')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  view === 'templates'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Grid3x3 className="w-4 h-4 inline mr-2" />
                Templates
              </button>
              <button
                onClick={() => setView('builder')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  view === 'builder'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-4 h-4 inline mr-2" />
                Builder
              </button>
            </div>

            <div className="flex items-center gap-3">
              {strategy.aiScore !== undefined && (
                <div className="px-4 py-2 bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-700/30 rounded-lg">
                  <div className="text-xs text-purple-400 mb-1">AI Score</div>
                  <div className="text-2xl font-bold text-white">{strategy.aiScore}<span className="text-sm text-slate-400">/100</span></div>
                </div>
              )}
              
              <button
                onClick={analyzeWithAI}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-medium transition-all flex items-center gap-2 shadow-lg shadow-purple-900/30"
              >
                <Brain className="w-4 h-4" />
                Analisar com IA
              </button>

              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ═══ CONTENT ═══ */}
          <div className="flex-1 flex overflow-hidden">
            {view === 'templates' ? (
              /* ═══ TEMPLATES VIEW ═══ */
              <div className="flex-1 p-8 overflow-y-auto">
                <div className="max-w-5xl mx-auto">
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold text-white mb-2">Templates Premium</h2>
                    <p className="text-slate-400">Comece com estratégias comprovadas e personalize do seu jeito</p>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    {TEMPLATES.map((template) => (
                      <motion.div
                        key={template.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ scale: 1.02, y: -4 }}
                        className="bg-gradient-to-br from-zinc-900 to-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700 rounded-xl p-6 cursor-pointer transition-all shadow-lg hover:shadow-2xl"
                        onClick={() => loadTemplate(template.id)}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className={`w-14 h-14 bg-gradient-to-br from-${template.color}-600 to-${template.color}-700 rounded-xl flex items-center justify-center text-3xl shadow-lg`}>
                            {template.icon}
                          </div>
                          <div className={`px-3 py-1 bg-${template.color}-900/30 border border-${template.color}-700/30 rounded-full text-xs font-medium text-${template.color}-400`}>
                            {template.difficulty}
                          </div>
                        </div>

                        <h3 className="text-lg font-bold text-white mb-2">{template.name}</h3>
                        <p className="text-sm text-slate-400 mb-4">{template.description}</p>

                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Target className="w-4 h-4 text-emerald-400" />
                            <span className="text-slate-400">WR:</span>
                            <span className="text-white font-medium">{template.winRate}%</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <TrendingUp className="w-4 h-4 text-purple-400" />
                            <span className="text-slate-400">R:R:</span>
                            <span className="text-white font-medium">1:{template.rr}</span>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-zinc-800">
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>Clique para usar</span>
                            <ArrowRight className="w-4 h-4" />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* ═══ BUILDER VIEW ═══ */
              <>
                {/* Sidebar - Blocos Disponíveis */}
                <div className="w-80 border-r border-zinc-800/50 bg-zinc-900/30 flex flex-col">
                  <div className="p-4 border-b border-zinc-800/50">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Buscar indicadores..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
                      />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                      Indicadores Técnicos
                    </div>
                    
                    {filteredIndicators.map((indicator) => (
                      <motion.div
                        key={indicator.id}
                        whileHover={{ scale: 1.02, x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => addBlock(indicator)}
                        draggable={true}
                        onDragStart={(e: React.DragEvent) => {
                          // HTML5 Drag and Drop
                          e.dataTransfer.effectAllowed = 'copy';
                          e.dataTransfer.setData('application/json', JSON.stringify(indicator));
                          e.dataTransfer.setData('text/plain', indicator.label);
                          console.log('[StrategyBuilder] 🎯 Drag started:', indicator.label);
                        }}
                        onDragEnd={(e: React.DragEvent) => {
                          console.log('[StrategyBuilder] 🏁 Drag ended');
                        }}
                        className={`group relative bg-gradient-to-r from-zinc-800/50 to-zinc-800/30 hover:from-${indicator.color}-900/20 hover:to-${indicator.color}-800/10 border border-zinc-700/50 hover:border-${indicator.color}-600/50 rounded-lg p-3 cursor-grab active:cursor-grabbing transition-all`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 bg-gradient-to-br from-${indicator.color}-600 to-${indicator.color}-700 rounded-lg flex items-center justify-center text-xl shrink-0 shadow-lg`}>
                            {indicator.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-bold text-white">{indicator.label}</div>
                              {indicator.popular && (
                                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                              )}
                            </div>
                            <div className="text-xs text-slate-400 truncate">{indicator.name}</div>
                          </div>
                          <div className="flex flex-col gap-1 shrink-0">
                            <Plus className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                            <Move className="w-3 h-3 text-slate-600 group-hover:text-slate-400 transition-colors" />
                          </div>
                        </div>
                      </motion.div>
                    ))}

                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 mt-6">
                      Padrões de Candles
                    </div>
                    
                    {PATTERNS.map((pattern) => (
                      <motion.div
                        key={pattern.id}
                        whileHover={{ scale: 1.02, x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        className={`bg-zinc-800/50 hover:bg-${pattern.color}-900/20 border border-zinc-700/50 hover:border-${pattern.color}-600/50 rounded-lg p-3 cursor-pointer transition-all`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-2xl">{pattern.icon}</div>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-white">{pattern.label}</div>
                          </div>
                          <Plus className="w-4 h-4 text-slate-500" />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Main Area - Canvas */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Strategy Info */}
                  <div className="p-6 border-b border-zinc-800/50 bg-zinc-900/30">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-slate-400 mb-2 block">Nome da Estratégia</label>
                        <input
                          type="text"
                          value={strategy.name}
                          onChange={(e) => setStrategy({ ...strategy, name: e.target.value })}
                          placeholder="Ex: Golden Cross com RSI"
                          className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-400 mb-2 block">Descrição</label>
                        <input
                          type="text"
                          value={strategy.description}
                          onChange={(e) => setStrategy({ ...strategy, description: e.target.value })}
                          placeholder="Descreva sua estratégia..."
                          className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex border-b border-zinc-800/50 bg-zinc-900/20">
                    <button
                      onClick={() => setActiveTab('entry')}
                      className={`flex-1 py-3 px-6 text-sm font-medium transition-all relative ${
                        activeTab === 'entry' ? 'text-emerald-400' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <TrendingUp className="w-4 h-4 inline mr-2" />
                      Entrada ({strategy.entryBlocks.length})
                      {activeTab === 'entry' && (
                        <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
                      )}
                    </button>
                    <button
                      onClick={() => setActiveTab('exit')}
                      className={`flex-1 py-3 px-6 text-sm font-medium transition-all relative ${
                        activeTab === 'exit' ? 'text-red-400' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <TrendingDown className="w-4 h-4 inline mr-2" />
                      Saída ({strategy.exitBlocks.length})
                      {activeTab === 'exit' && (
                        <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500" />
                      )}
                    </button>
                    <button
                      onClick={() => setActiveTab('filters')}
                      className={`flex-1 py-3 px-6 text-sm font-medium transition-all relative ${
                        activeTab === 'filters' ? 'text-blue-400' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Filter className="w-4 h-4 inline mr-2" />
                      Filtros ({strategy.filterBlocks.length})
                      {activeTab === 'filters' && (
                        <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                      )}
                    </button>
                    <button
                      onClick={() => setActiveTab('risk')}
                      className={`flex-1 py-3 px-6 text-sm font-medium transition-all relative ${
                        activeTab === 'risk' ? 'text-purple-400' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Shield className="w-4 h-4 inline mr-2" />
                      Risco
                      {activeTab === 'risk' && (
                        <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />
                      )}
                    </button>
                  </div>

                  {/* Canvas - Blocos da Estratégia */}
                  <div 
                    className="flex-1 p-6 overflow-y-auto"
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'copy';
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      try {
                        const indicatorData = e.dataTransfer.getData('application/json');
                        if (indicatorData) {
                          const indicator = JSON.parse(indicatorData);
                          addBlock(indicator);
                          console.log('[StrategyBuilder] ✅ Dropped:', indicator.label);
                        }
                      } catch (err) {
                        console.error('[StrategyBuilder] ❌ Drop error:', err);
                      }
                    }}
                  >
                    {activeTab === 'risk' ? (
                      /* Risk Management Panel */
                      <div className="max-w-2xl mx-auto space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-slate-300 mb-2 block">Stop Loss (%)</label>
                            <input
                              type="number"
                              value={strategy.stopLoss}
                              onChange={(e) => setStrategy({ ...strategy, stopLoss: parseFloat(e.target.value) || 0 })}
                              step="0.1"
                              className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-slate-300 mb-2 block">Take Profit (%)</label>
                            <input
                              type="number"
                              value={strategy.takeProfit}
                              onChange={(e) => setStrategy({ ...strategy, takeProfit: parseFloat(e.target.value) || 0 })}
                              step="0.1"
                              className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-slate-300 mb-2 block">Timeframe</label>
                            <select
                              value={strategy.timeframe}
                              onChange={(e) => setStrategy({ ...strategy, timeframe: e.target.value })}
                              className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
                            >
                              <option value="1M">1 Minuto</option>
                              <option value="5M">5 Minutos</option>
                              <option value="15M">15 Minutos</option>
                              <option value="1H">1 Hora</option>
                              <option value="4H">4 Horas</option>
                              <option value="1D">1 Dia</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-slate-300 mb-2 block">Trades Simultâneos</label>
                            <input
                              type="number"
                              value={strategy.maxConcurrentTrades}
                              onChange={(e) => setStrategy({ ...strategy, maxConcurrentTrades: parseInt(e.target.value) || 1 })}
                              min="1"
                              className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                            />
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-700/30 rounded-xl p-6">
                          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-purple-400" />
                            Resumo da Estratégia
                          </h3>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="text-slate-400 mb-1">Condições de Entrada</div>
                              <div className="text-2xl font-bold text-white">{strategy.entryBlocks.length}</div>
                            </div>
                            <div>
                              <div className="text-slate-400 mb-1">Condições de Saída</div>
                              <div className="text-2xl font-bold text-white">{strategy.exitBlocks.length}</div>
                            </div>
                            <div>
                              <div className="text-slate-400 mb-1">Risco/Retorno</div>
                              <div className="text-2xl font-bold text-emerald-400">1:{(strategy.takeProfit / strategy.stopLoss).toFixed(2)}</div>
                            </div>
                            <div>
                              <div className="text-slate-400 mb-1">Timeframe</div>
                              <div className="text-2xl font-bold text-blue-400">{strategy.timeframe}</div>
                            </div>
                          </div>
                        </div>

                        {strategy.aiScore !== undefined && strategy.aiSuggestions && strategy.aiSuggestions.length > 0 && (
                          <div className="bg-gradient-to-br from-amber-900/20 to-orange-900/20 border border-amber-700/30 rounded-xl p-6">
                            <h3 className="text-lg font-bold text-amber-400 mb-3 flex items-center gap-2">
                              <Lightbulb className="w-5 h-5" />
                              Sugestões da IA
                            </h3>
                            <div className="space-y-2">
                              {strategy.aiSuggestions.map((suggestion, idx) => (
                                <div key={idx} className="flex items-start gap-3 text-sm text-slate-300">
                                  <div className="w-5 h-5 rounded-full bg-amber-600/20 border border-amber-600/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <Sparkles className="w-3 h-3 text-amber-400" />
                                  </div>
                                  <div>{suggestion}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : currentBlocks.length === 0 ? (
                      /* Empty State */
                      <div className="flex-1 flex items-center justify-center">
                        <div className="text-center max-w-md">
                          <div className="w-24 h-24 bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-700/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <Layers className="w-12 h-12 text-purple-400" />
                          </div>
                          <h3 className="text-xl font-bold text-white mb-2">
                            Arraste blocos para começar
                          </h3>
                          <p className="text-slate-400 mb-6">
                            Clique ou arraste indicadores da biblioteca à esquerda para construir sua estratégia
                          </p>
                          <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-emerald-500" />
                              Entrada
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-red-500" />
                              Saída
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-blue-500" />
                              Filtros
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Blocks List */
                      <div className="max-w-4xl mx-auto space-y-4">
                        <AnimatePresence mode="popLayout">
                          {currentBlocks.map((block, index) => (
                            <motion.div
                              key={block.id}
                              layout
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, x: -100 }}
                              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                              className={`group bg-gradient-to-r from-zinc-900 to-zinc-900/50 border border-zinc-800 hover:border-${block.color}-600/50 rounded-xl p-5 transition-all shadow-lg hover:shadow-xl`}
                            >
                              <div className="flex items-start gap-4">
                                <div className={`w-12 h-12 bg-gradient-to-br from-${block.color}-600 to-${block.color}-700 rounded-lg flex items-center justify-center text-2xl shrink-0 shadow-lg`}>
                                  {block.icon}
                                </div>

                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-3">
                                    <div className={`px-2 py-1 bg-${activeTab === 'entry' ? 'emerald' : activeTab === 'exit' ? 'red' : 'blue'}-900/30 border border-${activeTab === 'entry' ? 'emerald' : activeTab === 'exit' ? 'red' : 'blue'}-700/30 rounded text-xs font-medium text-${activeTab === 'entry' ? 'emerald' : activeTab === 'exit' ? 'red' : 'blue'}-400`}>
                                      #{index + 1}
                                    </div>
                                    <h4 className="text-lg font-bold text-white">{block.label}</h4>
                                  </div>

                                  <div className="grid grid-cols-3 gap-3">
                                    {block.period && (
                                      <div>
                                        <label className="text-xs text-slate-500 mb-1 block">Período</label>
                                        <input
                                          type="number"
                                          value={block.period}
                                          onChange={(e) => {
                                            const listKey = activeTab === 'entry' ? 'entryBlocks' : activeTab === 'exit' ? 'exitBlocks' : 'filterBlocks';
                                            setStrategy(prev => ({
                                              ...prev,
                                              [listKey]: prev[listKey].map(b =>
                                                b.id === block.id ? { ...b, period: parseInt(e.target.value) || 14 } : b
                                              )
                                            }));
                                          }}
                                          className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500/50"
                                        />
                                      </div>
                                    )}
                                    <div>
                                      <label className="text-xs text-slate-500 mb-1 block">Operador</label>
                                      <select
                                        value={block.operator}
                                        onChange={(e) => {
                                          const listKey = activeTab === 'entry' ? 'entryBlocks' : activeTab === 'exit' ? 'exitBlocks' : 'filterBlocks';
                                          setStrategy(prev => ({
                                            ...prev,
                                            [listKey]: prev[listKey].map(b =>
                                              b.id === block.id ? { ...b, operator: e.target.value as OperatorType } : b
                                            )
                                          }));
                                        }}
                                        className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500/50"
                                      >
                                        <option value="CROSS_ABOVE">Cruza Acima</option>
                                        <option value="CROSS_BELOW">Cruza Abaixo</option>
                                        <option value="ABOVE">Acima</option>
                                        <option value="BELOW">Abaixo</option>
                                        <option value="RISING">Subindo</option>
                                        <option value="FALLING">Descendo</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-xs text-slate-500 mb-1 block">Valor</label>
                                      <input
                                        type="number"
                                        value={block.value || 0}
                                        onChange={(e) => {
                                          const listKey = activeTab === 'entry' ? 'entryBlocks' : activeTab === 'exit' ? 'exitBlocks' : 'filterBlocks';
                                          setStrategy(prev => ({
                                            ...prev,
                                            [listKey]: prev[listKey].map(b =>
                                              b.id === block.id ? { ...b, value: parseFloat(e.target.value) || 0 } : b
                                            )
                                          }));
                                        }}
                                        className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500/50"
                                      />
                                    </div>
                                  </div>

                                  <div className="mt-3">
                                    <input
                                      type="text"
                                      value={block.description}
                                      onChange={(e) => {
                                        const listKey = activeTab === 'entry' ? 'entryBlocks' : activeTab === 'exit' ? 'exitBlocks' : 'filterBlocks';
                                        setStrategy(prev => ({
                                          ...prev,
                                          [listKey]: prev[listKey].map(b =>
                                            b.id === block.id ? { ...b, description: e.target.value } : b
                                          )
                                        }));
                                      }}
                                      placeholder="Descreva a condição..."
                                      className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-purple-500/50"
                                    />
                                  </div>
                                </div>

                                <button
                                  onClick={() => removeBlock(block.id)}
                                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-900/20 hover:bg-red-900/40 border border-red-700/30 hover:border-red-700/50 text-red-400 hover:text-red-300 transition-all opacity-0 group-hover:opacity-100"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </motion.div>
                          ))}
                        </AnimatePresence>

                        {activeTab !== 'risk' && (
                          <div className="flex items-center justify-center py-8">
                            <div className="text-sm text-slate-500">
                              Adicione mais condições arrastando blocos da biblioteca →
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ═══ FOOTER ═══ */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800/50 bg-zinc-900/50 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              {strategy.name ? (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span className="text-slate-300">{strategy.name}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-amber-500">
                  <AlertCircle className="w-4 h-4" />
                  <span>Digite um nome para a estratégia</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-slate-300 rounded-lg font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!strategy.name || strategy.entryBlocks.length === 0}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-purple-900/30"
              >
                <Save className="w-4 h-4" />
                Salvar Estratégia
              </button>
            </div>
          </div>
        </motion.div>

        {/* AI Panel Lateral */}
        <AnimatePresence>
          {showAI && (
            <motion.div
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              className="absolute right-6 top-6 bottom-6 w-96 bg-gradient-to-br from-zinc-900 via-zinc-900 to-purple-950/30 border border-purple-700/30 rounded-xl shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50 bg-purple-900/10">
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-400" />
                  <h3 className="font-bold text-white">AI Assistant</h3>
                </div>
                <button
                  onClick={() => setShowAI(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800/50 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {aiMessages.map((msg) => (
                  <div key={msg.id} className={`flex gap-3 ${msg.type === 'ai' ? '' : 'flex-row-reverse'}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      msg.type === 'ai' ? 'bg-purple-600' : 'bg-blue-600'
                    }`}>
                      {msg.type === 'ai' ? <Brain className="w-5 h-5 text-white" /> : <MessageSquare className="w-5 h-5 text-white" />}
                    </div>
                    <div className={`flex-1 ${msg.type === 'ai' ? '' : 'text-right'}`}>
                      <div className={`inline-block px-4 py-2 rounded-xl ${
                        msg.type === 'ai'
                          ? 'bg-zinc-800/50 border border-zinc-700/50 text-slate-300'
                          : 'bg-blue-900/30 border border-blue-700/30 text-blue-300'
                      }`}>
                        <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                      </div>
                      {msg.suggestions && msg.suggestions.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {msg.suggestions.map((suggestion, idx) => (
                            <button
                              key={idx}
                              className="w-full text-left px-3 py-2 bg-purple-900/20 hover:bg-purple-900/30 border border-purple-700/20 hover:border-purple-700/40 rounded-lg text-xs text-purple-300 hover:text-purple-200 transition-all"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-zinc-800/50 bg-zinc-900/50">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Pergunte algo..."
                    className="flex-1 bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
                    onKeyPress={(e) => e.key === 'Enter' && analyzeWithAI()}
                  />
                  <button
                    onClick={analyzeWithAI}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AnimatePresence>
  );
}

// Ícone Send (faltou importar)
function Send({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}