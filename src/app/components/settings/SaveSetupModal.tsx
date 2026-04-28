import React, { useState, useEffect } from 'react';
import { X, Save, FolderOpen, Trash2, Download, Upload, Check, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface TradingSetup {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  isFavorite?: boolean;
  
  // Trading Configuration
  config: {
    direction: 'LONG' | 'SHORT' | 'AUTO';
    marketMode: 'TREND' | 'RANGE' | 'VOLATILITY' | 'NEURAL';
    executionMode: 'DEMO' | 'LIVE';
    riskPerTrade: number;
    maxPositions: number;
    maxAssets: number;
    dailyLossLimit: number;
    newsFilter: boolean;
    activeAssets: string[];
    initialBalance?: number;
  };
  
  // Indicators (from ChartToolbar)
  indicators: Array<{
    id: string;
    name: string;
    color?: string;
    settings?: any;
  }>;
  
  // Chart Settings
  chartSettings?: {
    timeframe: string;
    activeSymbol: string;
  };
}

interface SaveSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: any; // From TradingContext
  currentIndicators: any[]; // From ChartToolbar
  onLoadSetup: (setup: TradingSetup) => void;
}

const STORAGE_KEY = 'neuro_trading_setups_v1';

export const SaveSetupModal: React.FC<SaveSetupModalProps> = ({
  isOpen,
  onClose,
  currentConfig,
  currentIndicators,
  onLoadSetup
}) => {
  const [savedSetups, setSavedSetups] = useState<TradingSetup[]>([]);
  const [setupName, setSetupName] = useState('');
  const [setupDescription, setSetupDescription] = useState('');
  const [activeTab, setActiveTab] = useState<'save' | 'load'>('save');

  // Load setups from localStorage
  useEffect(() => {
    if (isOpen) {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          setSavedSetups(JSON.parse(stored));
        } catch (e) {
          console.error('Failed to parse setups:', e);
        }
      }
    }
  }, [isOpen]);

  const saveSetup = () => {
    if (!setupName.trim()) {
      toast.error('Digite um nome para o setup!');
      return;
    }

    const newSetup: TradingSetup = {
      id: Date.now().toString(),
      name: setupName.trim(),
      description: setupDescription.trim() || undefined,
      createdAt: new Date().toISOString(),
      isFavorite: false,
      config: {
        direction: currentConfig.direction,
        marketMode: currentConfig.marketMode,
        executionMode: currentConfig.executionMode,
        riskPerTrade: currentConfig.riskPerTrade,
        maxPositions: currentConfig.maxPositions,
        maxAssets: currentConfig.maxAssets,
        dailyLossLimit: currentConfig.dailyLossLimit,
        newsFilter: currentConfig.newsFilter,
        activeAssets: currentConfig.activeAssets || [],
        initialBalance: currentConfig.initialBalance
      },
      indicators: currentIndicators.map(ind => ({
        id: ind.id,
        name: ind.name,
        color: ind.color,
        settings: ind.settings
      })),
      chartSettings: {
        timeframe: '15m', // TODO: Get from context
        activeSymbol: 'BTCUSDT' // TODO: Get from context
      }
    };

    const updated = [newSetup, ...savedSetups];
    setSavedSetups(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    toast.success(`Setup "${setupName}" salvo com sucesso!`);
    setSetupName('');
    setSetupDescription('');
    setActiveTab('load');
  };

  const loadSetup = (setup: TradingSetup) => {
    onLoadSetup(setup);
    toast.success(`Setup "${setup.name}" carregado!`);
    onClose();
  };

  const deleteSetup = (id: string) => {
    const updated = savedSetups.filter(s => s.id !== id);
    setSavedSetups(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    toast.success('Setup deletado!');
  };

  const toggleFavorite = (id: string) => {
    const updated = savedSetups.map(s => 
      s.id === id ? { ...s, isFavorite: !s.isFavorite } : s
    );
    setSavedSetups(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const exportSetup = (setup: TradingSetup) => {
    const dataStr = JSON.stringify(setup, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${setup.name.replace(/\s+/g, '_')}_setup.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Setup exportado!');
  };

  const importSetup = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target?.result as string) as TradingSetup;
          imported.id = Date.now().toString(); // New ID
          imported.createdAt = new Date().toISOString();
          
          const updated = [imported, ...savedSetups];
          setSavedSetups(updated);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          
          toast.success(`Setup "${imported.name}" importado!`);
        } catch (err) {
          toast.error('Arquivo inválido!');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  if (!isOpen) return null;

  const formatDate = (isoDate: string) => {
    return new Date(isoDate).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10 bg-gradient-to-br from-purple-950/20 to-blue-950/20">
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <Save className="w-6 h-6 text-purple-400" />
                GERENCIAR SETUPS
              </h2>
              <p className="text-xs text-neutral-400 mt-1">
                Salve e carregue suas configurações favoritas
              </p>
            </div>
            
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-neutral-400" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 p-4 bg-black/20 border-b border-white/5">
            <button
              onClick={() => setActiveTab('save')}
              className={`flex-1 px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                activeTab === 'save'
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  : 'bg-white/5 text-neutral-400 hover:bg-white/10 border border-white/10'
              }`}
            >
              <Save className="w-4 h-4 inline mr-2" />
              SALVAR NOVO
            </button>
            <button
              onClick={() => setActiveTab('load')}
              className={`flex-1 px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                activeTab === 'load'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-white/5 text-neutral-400 hover:bg-white/10 border border-white/10'
              }`}
            >
              <FolderOpen className="w-4 h-4 inline mr-2" />
              CARREGAR ({savedSetups.length})
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {activeTab === 'save' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">
                    Nome do Setup *
                  </label>
                  <input
                    type="text"
                    value={setupName}
                    onChange={(e) => setSetupName(e.target.value)}
                    placeholder="Ex: Scalping Agressivo, Day Trade Conservador..."
                    className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:border-purple-500/50 focus:outline-none transition-colors"
                    maxLength={50}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">
                    Descrição (Opcional)
                  </label>
                  <textarea
                    value={setupDescription}
                    onChange={(e) => setSetupDescription(e.target.value)}
                    placeholder="Descreva sua estratégia, horários, ativos preferidos..."
                    className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:border-purple-500/50 focus:outline-none transition-colors resize-none h-24"
                    maxLength={200}
                  />
                </div>

                {/* Preview */}
                <div className="bg-gradient-to-br from-purple-950/10 to-blue-950/10 border border-purple-500/20 rounded-lg p-4">
                  <div className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-3">
                    O QUE SERÁ SALVO:
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-black/40 rounded p-3 border border-white/5">
                      <div className="text-[9px] text-neutral-500 uppercase mb-1">Configuração</div>
                      <div className="text-xs text-white font-bold">{currentConfig.direction} Mode</div>
                      <div className="text-[10px] text-neutral-400 mt-1">
                        {currentConfig.maxAssets} Ativos • {currentConfig.maxPositions} Posições
                      </div>
                    </div>
                    
                    <div className="bg-black/40 rounded p-3 border border-white/5">
                      <div className="text-[9px] text-neutral-500 uppercase mb-1">Indicadores</div>
                      <div className="text-xs text-white font-bold">{currentIndicators.length} Ativos</div>
                      <div className="text-[10px] text-neutral-400 mt-1 truncate">
                        {currentIndicators.map(i => i.name).join(', ') || 'Nenhum'}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {currentConfig.activeAssets.slice(0, 6).map((asset: string) => (
                      <span key={asset} className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded text-[10px] text-purple-400 font-bold">
                        {asset.replace('USDT', '')}
                      </span>
                    ))}
                    {currentConfig.activeAssets.length > 6 && (
                      <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] text-neutral-400 font-bold">
                        +{currentConfig.activeAssets.length - 6}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={saveSetup}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-purple-500/50 flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  SALVAR SETUP
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {savedSetups.length === 0 ? (
                  <div className="text-center py-12">
                    <FolderOpen className="w-16 h-16 text-neutral-600 mx-auto mb-4" />
                    <p className="text-neutral-400 font-bold">Nenhum setup salvo ainda</p>
                    <p className="text-xs text-neutral-500 mt-1">Crie seu primeiro setup na aba "SALVAR NOVO"</p>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={importSetup}
                        className="flex-1 px-4 py-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-500/20 transition-colors flex items-center justify-center gap-2"
                      >
                        <Upload className="w-4 h-4" />
                        IMPORTAR
                      </button>
                    </div>

                    {savedSetups
                      .sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0))
                      .map((setup) => (
                        <motion.div
                          key={setup.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`bg-gradient-to-br from-black/40 to-black/20 border rounded-lg p-4 hover:border-purple-500/30 transition-all group ${
                            setup.isFavorite ? 'border-amber-500/30' : 'border-white/10'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-white">{setup.name}</h3>
                                {setup.isFavorite && (
                                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                                )}
                              </div>
                              {setup.description && (
                                <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
                                  {setup.description}
                                </p>
                              )}
                              <div className="text-[10px] text-neutral-500 mt-2">
                                {formatDate(setup.createdAt)}
                              </div>
                            </div>

                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => toggleFavorite(setup.id)}
                                className="p-2 rounded bg-white/5 hover:bg-amber-500/20 border border-white/10 hover:border-amber-500/30 transition-colors"
                                title="Favoritar"
                              >
                                <Star className={`w-4 h-4 ${setup.isFavorite ? 'text-amber-400 fill-amber-400' : 'text-neutral-400'}`} />
                              </button>
                              <button
                                onClick={() => exportSetup(setup)}
                                className="p-2 rounded bg-white/5 hover:bg-blue-500/20 border border-white/10 hover:border-blue-500/30 transition-colors"
                                title="Exportar"
                              >
                                <Download className="w-4 h-4 text-neutral-400 group-hover:text-blue-400" />
                              </button>
                              <button
                                onClick={() => deleteSetup(setup.id)}
                                className="p-2 rounded bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 transition-colors"
                                title="Deletar"
                              >
                                <Trash2 className="w-4 h-4 text-neutral-400 group-hover:text-red-400" />
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 mb-3">
                            <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded text-[10px] text-purple-400 font-bold">
                              {setup.config.direction}
                            </span>
                            <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] text-blue-400 font-bold">
                              {setup.config.marketMode}
                            </span>
                            <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[10px] text-emerald-400 font-bold">
                              {setup.indicators.length} Indicadores
                            </span>
                            <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-[10px] text-amber-400 font-bold">
                              {setup.config.activeAssets.length} Ativos
                            </span>
                          </div>

                          <button
                            onClick={() => loadSetup(setup)}
                            className="w-full py-2 bg-gradient-to-r from-purple-600/80 to-blue-600/80 hover:from-purple-600 hover:to-blue-600 text-white font-bold rounded-lg text-sm transition-all flex items-center justify-center gap-2"
                          >
                            <Check className="w-4 h-4" />
                            CARREGAR SETUP
                          </button>
                        </motion.div>
                      ))}
                  </>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
