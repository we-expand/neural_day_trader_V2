import React, { useState } from 'react';
import { 
  Brain, 
  Trash2, 
  CheckCircle, 
  X, 
  Zap, 
  Layout, 
  BarChart2, 
  Shield, 
  Cpu,
  RotateCcw,
  Inbox,
  Beaker,
  Lightbulb,
  LayoutDashboard,
  Search
} from 'lucide-react';
import { Suggestion, Category, AI_SUGGESTIONS_POOL } from '../../../data/aiSuggestions';
import { useLabIntelligenceStore } from '../../../hooks/useLabIntelligenceStore';
import { WasmChartDemo } from './WasmChartDemo';
import { BuildProgress } from './BuildProgress';
import { SlippageSimulator } from './SlippageSimulator';

export function LabIntelligence({ embedded = false }: { embedded?: boolean }) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'active' | 'completed' | 'trash' | 'wasm' | 'slippage'>('dashboard');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'ALL'>('ALL');
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);

  const { 
    activeSuggestions, 
    completedSuggestions, 
    trashSuggestions, 
    markAsCompleted, 
    markAsTrash, 
    restoreFromTrash,
    isInitialized
  } = useLabIntelligenceStore();

  const handleComplete = (suggestion: Suggestion) => {
    markAsCompleted(suggestion);
    setSelectedSuggestion(null);
  };

  const handleDelete = (suggestion: Suggestion) => {
    markAsTrash(suggestion);
    setSelectedSuggestion(null);
  };

  const handleRestore = (suggestion: Suggestion) => {
    restoreFromTrash(suggestion);
    setSelectedSuggestion(null);
  };

  const handleAutoResearch = (category: Category | 'ALL') => {
    // Simulation of "Auto Research" - in reality, useLabIntelligenceStore handles replenishment automatically on completion
    // This could force-add new items if implemented in store, but for now we rely on the store's logic
    alert(`Pesquisa automática iniciada para: ${category === 'ALL' ? 'Todas as Categorias' : category}. Novos itens serão adicionados à fila.`);
  };

  const getCategoryName = (cat: Category) => {
    const map: Record<Category, string> = {
      'DAY_TRADE': 'Day Trade & Algo',
      'TECH': 'Tecnologia & Core',
      'DESIGN_UX': 'UX & Interface',
      'FEATURE': 'Features & Tools',
      'COMPETITION': 'Competitividade',
      'INNOVATION': 'Inovação & AI'
    };
    return map[cat];
  };

  const getCategoryIcon = (cat: Category) => {
    switch (cat) {
      case 'DAY_TRADE': return <BarChart2 className="w-4 h-4" />;
      case 'TECH': return <Cpu className="w-4 h-4" />;
      case 'DESIGN_UX': return <Layout className="w-4 h-4" />;
      case 'FEATURE': return <Zap className="w-4 h-4" />;
      case 'COMPETITION': return <Shield className="w-4 h-4" />;
      case 'INNOVATION': return <Lightbulb className="w-4 h-4" />;
    }
  };

  const categories: Category[] = ['DAY_TRADE', 'TECH', 'DESIGN_UX', 'FEATURE', 'COMPETITION', 'INNOVATION'];

  const filteredSuggestions = (list: Suggestion[]) => {
    if (selectedCategory === 'ALL') return list;
    return list.filter(s => s.category === selectedCategory);
  };

  const renderListItem = (suggestion: Suggestion, type: 'active' | 'completed' | 'trash') => (
    <div 
      key={suggestion.id}
      onClick={() => setSelectedSuggestion(suggestion)}
      className="group p-4 bg-neutral-900/50 hover:bg-neutral-800 border border-neutral-800 rounded-xl cursor-pointer transition-all hover:border-neutral-700 hover:shadow-lg relative overflow-hidden"
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${
        suggestion.impact === 'HIGH' ? 'bg-emerald-500' : 
        suggestion.impact === 'MEDIUM' ? 'bg-blue-500' : 'bg-neutral-600'
      }`}></div>
      
      <div className="flex items-start justify-between pl-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
              type === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
              type === 'trash' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
              'bg-neutral-800 text-neutral-400 border-neutral-700'
            }`}>
              {getCategoryName(suggestion.category)}
            </span>
            {suggestion.impact === 'HIGH' && (
              <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                <Zap className="w-3 h-3" /> HIGH IMPACT
              </span>
            )}
          </div>
          <h3 className={`font-semibold text-neutral-200 group-hover:text-white transition-colors ${type === 'completed' ? 'line-through opacity-50' : ''}`}>
            {suggestion.title}
          </h3>
          <p className="text-sm text-neutral-500 mt-1 line-clamp-1">{suggestion.description}</p>
        </div>
        
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
           {type === 'active' && (
             <button 
               onClick={(e) => { e.stopPropagation(); handleComplete(suggestion); }}
               className="p-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-lg transition-colors"
               title="Aprovar"
             >
               <CheckCircle className="w-4 h-4" />
             </button>
           )}
           {type === 'active' && (
             <button 
                onClick={(e) => { e.stopPropagation(); handleDelete(suggestion); }}
                className="p-2 bg-neutral-800 hover:bg-red-500/10 text-neutral-400 hover:text-red-400 rounded-lg transition-colors"
                title="Descartar"
             >
               <Trash2 className="w-4 h-4" />
             </button>
           )}
           {type === 'trash' && (
             <button 
                onClick={(e) => { e.stopPropagation(); handleRestore(suggestion); }}
                className="p-2 bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-white rounded-lg transition-colors"
                title="Restaurar"
             >
               <RotateCcw className="w-4 h-4" />
             </button>
           )}
        </div>
      </div>
    </div>
  );

  return (
    <div className={embedded 
      ? "flex flex-col md:flex-row h-full w-full bg-black/95 overflow-hidden rounded-xl border border-slate-800" 
      : "fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col md:flex-row overflow-hidden"
    }>
      {/* Sidebar Navigation for Lab */}
      <div className="w-full md:w-64 bg-neutral-900 border-r border-neutral-800 p-6 flex flex-col">
        <div className="flex items-center gap-3 mb-8 text-emerald-400">
          <Beaker className="w-8 h-8" />
          <div>
            <h1 className="font-bold text-xl leading-none">Laboratório Neural</h1>
            <span className="text-[10px] text-neutral-500 uppercase tracking-widest">IA Interna</span>
          </div>
        </div>

        <nav className="space-y-2">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center justify-between p-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'dashboard' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-neutral-400 hover:bg-neutral-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4" />
              Visão Geral
            </div>
          </button>

          <button 
            onClick={() => setActiveTab('active')}
            className={`w-full flex items-center justify-between p-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-neutral-400 hover:bg-neutral-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4" />
              Sugestões
            </div>
            <span className="text-xs bg-neutral-800 px-2 py-0.5 rounded-full text-neutral-300">
              {activeSuggestions.length}
            </span>
          </button>

          <button 
            onClick={() => setActiveTab('wasm')}
            className={`w-full flex items-center justify-between p-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'wasm' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'text-neutral-400 hover:bg-neutral-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              Motor Wasm
            </div>
            <span className="text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">BETA</span>
          </button>

          <button 
            onClick={() => setActiveTab('slippage')}
            className={`w-full flex items-center justify-between p-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'slippage' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-neutral-400 hover:bg-neutral-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Simulador Slippage
            </div>
          </button>
          
          <button 
            onClick={() => setActiveTab('completed')}
            className={`w-full flex items-center justify-between p-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'completed' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-neutral-400 hover:bg-neutral-800'
            }`}
          >
             <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Concluídas
            </div>
            <span className="text-xs bg-neutral-800 px-2 py-0.5 rounded-full text-neutral-300">
              {completedSuggestions.length}
            </span>
          </button>

          <button 
            onClick={() => setActiveTab('trash')}
            className={`w-full flex items-center justify-between p-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'trash' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'text-neutral-400 hover:bg-neutral-800'
            }`}
          >
             <div className="flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              Lixeira
            </div>
            <span className="text-xs bg-neutral-800 px-2 py-0.5 rounded-full text-neutral-300">
              {trashSuggestions.length}
            </span>
          </button>
        </nav>

        <div className="mt-auto pt-6 border-t border-neutral-800">
          <div className="bg-neutral-800/50 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-neutral-300 mb-2">Status da IA</h4>
            <div className="flex items-center gap-2 text-xs text-emerald-400 mb-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Monitorando Mercado
            </div>
            <div className="w-full bg-neutral-700 h-1 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full w-2/3 animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-black p-6 md:p-10 overflow-y-auto">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">
              {activeTab === 'dashboard' && 'Dashboard de Evolução'}
              {activeTab === 'active' && 'Sugestões de Desenvolvimento'}
              {activeTab === 'completed' && 'Histórico de Implementações'}
              {activeTab === 'trash' && 'Itens Descartados'}
              {activeTab === 'wasm' && 'Wasm Benchmark'}
              {activeTab === 'slippage' && 'Day Trade & Algo: Stress Test'}
            </h2>
            <p className="text-neutral-400 text-sm">
              {activeTab === 'dashboard' && 'Acompanhe o progresso da construção da Neuro Trade Platform.'}
              {activeTab === 'active' && 'Analise as recomendações da IA para evoluir a plataforma.'}
              {activeTab === 'completed' && 'Funcionalidades e melhorias já integradas ou aprovadas.'}
              {activeTab === 'trash' && 'Sugestões rejeitadas. Você pode restaurá-las a qualquer momento.'}
              {activeTab === 'wasm' && 'Teste de performance da engine gráfica.'}
              {activeTab === 'slippage' && 'Simule condições reais de liquidez para validar a robustez da estratégia.'}
            </p>
          </div>
          
          <button onClick={() => window.history.back()} className="md:hidden px-4 py-2 bg-neutral-800 rounded text-sm">
            Voltar
          </button>
        </header>

        {activeTab === 'dashboard' ? (
          <BuildProgress />
        ) : activeTab === 'wasm' ? (
          <WasmChartDemo />
        ) : activeTab === 'slippage' ? (
          <SlippageSimulator />
        ) : (
          <>
            {/* Category Filter & Actions */}
            <div className="flex items-center justify-between mb-6 gap-4">
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide flex-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                      selectedCategory === cat
                        ? 'bg-emerald-500 text-white border-emerald-500'
                        : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800'
                    }`}
                  >
                    {cat === 'ALL' ? 'Todas' : getCategoryName(cat as Category)}
                  </button>
                ))}
              </div>

              {/* AI Auto-Research Button */}
              <button
                onClick={() => handleAutoResearch(selectedCategory)}
                className="shrink-0 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                title="Pesquisar e instalar 20 novos resultados nesta categoria"
              >
                <Search className="w-4 h-4" />
                <span className="hidden md:inline">Instalar Auto (20)</span>
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {activeTab === 'active' && filteredSuggestions(activeSuggestions).map(s => renderListItem(s, 'active'))}
              {activeTab === 'completed' && filteredSuggestions(completedSuggestions).map(s => renderListItem(s, 'completed'))}
              {activeTab === 'trash' && filteredSuggestions(trashSuggestions).map(s => renderListItem(s, 'trash'))}
            </div>
            
            {((activeTab === 'active' && filteredSuggestions(activeSuggestions).length === 0) ||
              (activeTab === 'completed' && filteredSuggestions(completedSuggestions).length === 0) ||
              (activeTab === 'trash' && filteredSuggestions(trashSuggestions).length === 0)) && (
              <div className="flex flex-col items-center justify-center h-64 text-neutral-500 opacity-50">
                <Inbox className="w-12 h-12 mb-4" />
                <p>Nenhum item nesta lista.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      {selectedSuggestion && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={() => setSelectedSuggestion(null)}>
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl shadow-black" onClick={e => e.stopPropagation()}>
            <div className="p-6 md:p-8">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-neutral-800 ${
                    selectedSuggestion.impact === 'HIGH' ? 'text-emerald-400' : 'text-blue-400'
                  }`}>
                    {getCategoryIcon(selectedSuggestion.category)}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
                      {getCategoryName(selectedSuggestion.category)}
                    </span>
                    <h2 className="text-2xl font-bold text-white mt-1">{selectedSuggestion.title}</h2>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedSuggestion(null)}
                  className="p-2 hover:bg-neutral-800 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-neutral-400" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-neutral-800/30 rounded-xl p-5 border border-neutral-800">
                  <h3 className="text-sm font-semibold text-neutral-300 mb-2 flex items-center gap-2">
                    <Brain className="w-4 h-4" /> Análise da IA
                  </h3>
                  <p className="text-neutral-300 leading-relaxed">
                    {selectedSuggestion.fullAnalysis}
                  </p>
                </div>
                
                <div className="flex flex-wrap gap-2 pt-2">
                  {selectedSuggestion.tags.map(tag => (
                    <span key={tag} className="px-3 py-1 rounded-full bg-neutral-800 border border-neutral-700 text-xs text-neutral-400">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-neutral-800 flex justify-end gap-3">
                {activeTab === 'active' && (
                  <>
                     <button 
                      onClick={() => handleDelete(selectedSuggestion)}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Descartar
                    </button>
                    <button 
                      onClick={() => handleComplete(selectedSuggestion)}
                      className="px-6 py-2 rounded-lg text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Aprovar & Implementar
                    </button>
                  </>
                )}
                {activeTab === 'trash' && (
                   <button 
                      onClick={() => handleRestore(selectedSuggestion)}
                      className="px-6 py-2 rounded-lg text-sm font-semibold bg-blue-500 text-white hover:bg-blue-600 transition-all flex items-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Restaurar
                    </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
