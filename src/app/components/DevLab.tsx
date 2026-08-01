/**
 * DEV LAB — Centro de Inovação e Gestão de Sugestões
 * Backlog categorizado de melhorias, alimentado manualmente pelo Cleber e
 * por pesquisa real de concorrentes (evidenciada — nunca sugestão fabricada
 * sem fonte). Usado tanto como item de menu principal quanto embutido no
 * Admin (aba "devlab").
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Code2, Paintbrush, Zap, TrendingUp, Sparkles, Bug, Lightbulb,
  Check, Trash2, RotateCcw, X, Plus, Beaker, Megaphone,
  CircleDollarSign, Brain, ExternalLink, Search, RefreshCw, Microscope,
} from 'lucide-react';
import { useAuth } from '@/app/contexts/AuthContext';
import {
  devLabService, Suggestion, Category, Impact, Effort, SuggestionStatus, ResearchRun,
  CATEGORY_CONFIG, IMPACT_CONFIG, EFFORT_CONFIG,
} from '@/app/services/DevLabService';

type ViewMode = 'active' | 'completed' | 'trash' | 'research';

const CATEGORY_ICONS: Record<Category, React.ComponentType<any>> = {
  TECH: Code2,
  DESIGN_UX: Paintbrush,
  FEATURE: Zap,
  COMPETITION: TrendingUp,
  INNOVATION: Sparkles,
  BUG: Bug,
  OPTIMIZATION: Lightbulb,
  GROWTH_MARKETING: Megaphone,
  MONETIZATION: CircleDollarSign,
  AI_BRAIN: Brain,
};

const CategoryIcon = ({ category }: { category: Category }) => {
  const Icon = CATEGORY_ICONS[category];
  return <Icon className={`w-5 h-5 shrink-0 ${CATEGORY_CONFIG[category].color}`} />;
};

const ImpactBadge = ({ impact }: { impact: Impact }) => {
  const config = IMPACT_CONFIG[impact];
  return (
    <span className={`text-[10px] px-2.5 py-1 rounded-full border font-bold uppercase tracking-wide ${config.bgColor} ${config.textColor} ${config.borderColor}`}>
      {config.label}
    </span>
  );
};

const EffortBadge = ({ effort }: { effort: Effort }) => {
  const config = EFFORT_CONFIG[effort];
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 bg-white/5">
      <div className={`w-1.5 h-1.5 rounded-full ${config.color}`} />
      <span className="text-[10px] font-semibold text-slate-300">{config.label}</span>
    </div>
  );
};

const SourceBadge = ({ suggestion }: { suggestion: Suggestion }) => {
  if (suggestion.source_type === 'AI_RESEARCH') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <Microscope className="w-3 h-3" /> Pesquisa real{suggestion.competitor_name ? `: ${suggestion.competitor_name}` : ''}
      </span>
    );
  }
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-500 border border-white/10">
      Manual
    </span>
  );
};

interface DevLabProps {
  embedded?: boolean;
}

export default function DevLab({ embedded = false }: DevLabProps) {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [researchRuns, setResearchRuns] = useState<ResearchRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('active');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'ALL'>('ALL');
  const [showNewModal, setShowNewModal] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const [s, r] = await Promise.all([
      devLabService.getUserSuggestions(user.id),
      devLabService.getResearchRuns(user.id),
    ]);
    setSuggestions(s);
    setResearchRuns(r);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => ({
    active: suggestions.filter((s) => s.status === 'active').length,
    completed: suggestions.filter((s) => s.status === 'completed').length,
    trash: suggestions.filter((s) => s.status === 'trash').length,
    aiResearch: suggestions.filter((s) => s.source_type === 'AI_RESEARCH').length,
    total: suggestions.length,
  }), [suggestions]);

  const filtered = useMemo(() => {
    if (viewMode === 'research') return [];
    return suggestions.filter((s) => {
      if (s.status !== viewMode) return false;
      if (selectedCategory !== 'ALL' && s.category !== selectedCategory) return false;
      return true;
    });
  }, [suggestions, viewMode, selectedCategory]);

  const handleStatus = async (id: string, status: SuggestionStatus) => {
    setSuggestions((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
    await devLabService.updateStatus(id, status);
  };

  const handleDeletePermanent = async (id: string) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
    await devLabService.permanentDelete(id);
  };

  const wrapperClass = embedded ? 'w-full h-full' : 'min-h-screen bg-black text-white';

  return (
    <div className={wrapperClass}>
      <div className={embedded ? 'p-6' : 'max-w-7xl mx-auto p-8'}>
        {!embedded && (
          <div className="flex items-center gap-3 mb-2">
            <Beaker className="w-7 h-7 text-indigo-400" />
            <h1 className="text-2xl font-bold">DEV LAB — Centro de Inovação</h1>
          </div>
        )}
        <p className="text-slate-400 text-sm mb-6">
          Backlog categorizado de melhorias — manuais e vindas de pesquisa real de concorrentes (sempre com fonte e evidência, nunca inventada).
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <StatCard label="Ativas" value={stats.active} color="text-white" />
          <StatCard label="Concluídas" value={stats.completed} color="text-emerald-400" />
          <StatCard label="Lixeira" value={stats.trash} color="text-slate-500" />
          <StatCard label="De pesquisa real" value={stats.aiResearch} color="text-cyan-400" />
          <StatCard label="Total" value={stats.total} color="text-white" />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-4 border-b border-white/10 flex-wrap">
          <TabButton label={`Ativas (${stats.active})`} active={viewMode === 'active'} onClick={() => setViewMode('active')} />
          <TabButton label={`Concluídas (${stats.completed})`} active={viewMode === 'completed'} onClick={() => setViewMode('completed')} />
          <TabButton label={`Lixeira (${stats.trash})`} active={viewMode === 'trash'} onClick={() => setViewMode('trash')} />
          <TabButton label={`Pesquisas de concorrente (${researchRuns.length})`} active={viewMode === 'research'} onClick={() => setViewMode('research')} icon={Search} />
          <div className="flex-1" />
          <button onClick={load} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white px-3 py-2 mb-1">
            <RefreshCw className="w-4 h-4" /> Atualizar
          </button>
          <button onClick={() => setShowNewModal(true)} className="flex items-center gap-2 text-sm bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-lg px-3 py-2 mb-1">
            <Plus className="w-4 h-4" /> Nova sugestão
          </button>
        </div>

        {viewMode !== 'research' && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`text-xs px-3 py-1.5 rounded-full border ${selectedCategory === 'ALL' ? 'bg-white/10 border-white/20 text-white' : 'border-white/10 text-slate-500 hover:text-white'}`}
            >
              Todas categorias
            </button>
            {(Object.keys(CATEGORY_CONFIG) as Category[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${selectedCategory === cat ? 'bg-white/10 border-white/20 text-white' : 'border-white/10 text-slate-500 hover:text-white'}`}
              >
                <CategoryIcon category={cat} /> {CATEGORY_CONFIG[cat].label}
              </button>
            ))}
          </div>
        )}

        {loading && <p className="text-slate-500 text-sm">Carregando...</p>}

        {!loading && viewMode !== 'research' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.length === 0 && (
              <p className="text-slate-500 text-sm col-span-full">Nada aqui ainda.</p>
            )}
            {filtered.map((s) => (
              <div key={s.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CategoryIcon category={s.category} />
                    <span className="text-xs text-slate-500">{CATEGORY_CONFIG[s.category].label}</span>
                  </div>
                  <SourceBadge suggestion={s} />
                </div>
                <h3 className="font-semibold text-white text-sm leading-snug">{s.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{s.description}</p>
                {s.evidence && (
                  <p className="text-[11px] text-slate-500 italic border-l-2 border-white/10 pl-2">"{s.evidence}"</p>
                )}
                {s.competitor_url && (
                  <a href={s.competitor_url.startsWith('http') ? s.competitor_url : `https://${s.competitor_url}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:underline">
                    <ExternalLink className="w-3 h-3" /> {s.competitor_url}
                  </a>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <ImpactBadge impact={s.impact} />
                  <EffortBadge effort={s.effort} />
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-white/5 mt-auto">
                  {viewMode === 'active' && (
                    <>
                      <ActionButton icon={Check} label="Concluir" onClick={() => handleStatus(s.id, 'completed')} color="text-emerald-400 hover:bg-emerald-500/10" />
                      <ActionButton icon={Trash2} label="Descartar" onClick={() => handleStatus(s.id, 'trash')} color="text-red-400 hover:bg-red-500/10" />
                    </>
                  )}
                  {viewMode === 'completed' && (
                    <ActionButton icon={RotateCcw} label="Reabrir" onClick={() => handleStatus(s.id, 'active')} color="text-slate-400 hover:bg-white/10" />
                  )}
                  {viewMode === 'trash' && (
                    <>
                      <ActionButton icon={RotateCcw} label="Restaurar" onClick={() => handleStatus(s.id, 'active')} color="text-slate-400 hover:bg-white/10" />
                      <ActionButton icon={X} label="Apagar de vez" onClick={() => handleDeletePermanent(s.id)} color="text-red-500 hover:bg-red-500/10" />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && viewMode === 'research' && (
          <div className="space-y-3">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-slate-400">
              Cada linha aqui é uma pesquisa real que examinou concorrentes (site, produto, changelog público) e gerou sugestões
              evidenciadas na aba "Ativas" (com fonte e link). Sem pesquisa registrada = sem sugestão "de concorrente" — nunca fabricada.
            </div>
            {researchRuns.length === 0 && <p className="text-slate-500 text-sm">Nenhuma pesquisa registrada ainda.</p>}
            {researchRuns.map((r) => (
              <div key={r.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">{new Date(r.started_at).toLocaleString('pt-BR')}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${r.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : r.status === 'FAILED' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                    {r.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-2">{r.summary}</p>
                <div className="flex flex-wrap gap-1.5 mb-1">
                  {r.competitors_researched.map((c) => (
                    <span key={c} className="text-[10px] bg-white/5 border border-white/10 rounded-full px-2 py-0.5 text-slate-400">{c}</span>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500">{r.suggestions_created} sugestões geradas</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {showNewModal && (
        <NewSuggestionModal
          onClose={() => setShowNewModal(false)}
          onSave={async (data) => {
            if (!user?.id) return;
            const created = await devLabService.addSuggestion(user.id, {
              ...data,
              source_type: 'MANUAL',
              tags: [],
              full_analysis: null,
              competitor_name: null,
              competitor_url: null,
              evidence: null,
              research_run_id: null,
            });
            if (created) setSuggestions((prev) => [created, ...prev]);
            setShowNewModal(false);
          }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function TabButton({ label, active, onClick, icon: Icon }: { label: string; active: boolean; onClick: () => void; icon?: React.ComponentType<any> }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 ${active ? 'border-indigo-400 text-indigo-400' : 'border-transparent text-slate-500 hover:text-white'}`}>
      {Icon && <Icon className="w-3.5 h-3.5" />} {label}
    </button>
  );
}

function ActionButton({ icon: Icon, label, onClick, color }: { icon: React.ComponentType<any>; label: string; onClick: () => void; color: string }) {
  return (
    <button onClick={onClick} title={label} className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg transition-colors ${color}`}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

function NewSuggestionModal({ onClose, onSave }: { onClose: () => void; onSave: (data: { title: string; description: string; category: Category; impact: Impact; effort: Effort }) => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('FEATURE');
  const [impact, setImpact] = useState<Impact>('MEDIUM');
  const [effort, setEffort] = useState<Effort>('MEDIUM');

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Nova sugestão</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-500 hover:text-white" /></button>
        </div>
        <div className="space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição" rows={3} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
          <div className="grid grid-cols-3 gap-2">
            <select value={category} onChange={(e) => setCategory(e.target.value as Category)} className="bg-black border border-white/10 rounded-lg px-2 py-2 text-xs text-white">
              {(Object.keys(CATEGORY_CONFIG) as Category[]).map((c) => <option key={c} value={c}>{CATEGORY_CONFIG[c].label}</option>)}
            </select>
            <select value={impact} onChange={(e) => setImpact(e.target.value as Impact)} className="bg-black border border-white/10 rounded-lg px-2 py-2 text-xs text-white">
              <option value="HIGH">Alto impacto</option>
              <option value="MEDIUM">Médio impacto</option>
              <option value="LOW">Baixo impacto</option>
            </select>
            <select value={effort} onChange={(e) => setEffort(e.target.value as Effort)} className="bg-black border border-white/10 rounded-lg px-2 py-2 text-xs text-white">
              <option value="HIGH">Alto esforço</option>
              <option value="MEDIUM">Médio esforço</option>
              <option value="LOW">Baixo esforço</option>
            </select>
          </div>
        </div>
        <button
          disabled={!title.trim() || !description.trim()}
          onClick={() => onSave({ title, description, category, impact, effort })}
          className="w-full mt-4 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-lg"
        >
          Salvar
        </button>
      </div>
    </div>
  );
}
