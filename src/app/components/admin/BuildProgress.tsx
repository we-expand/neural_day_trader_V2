import React from 'react';
import { 
  CheckCircle, 
  Clock, 
  BarChart2, 
  Zap, 
  Layout, 
  Shield, 
  Cpu, 
  Lightbulb, 
  TrendingUp,
  Award
} from 'lucide-react';
import { useLabIntelligenceStore } from '../../../hooks/useLabIntelligenceStore';
import { Category } from '../../../data/aiSuggestions';

export function BuildProgress() {
  const { completedSuggestions, activeSuggestions, isInitialized } = useLabIntelligenceStore();

  if (!isInitialized) return null;

  const totalCompleted = completedSuggestions.length;
  const totalActive = activeSuggestions.length;
  
  // Stats by category
  const getCountByCategory = (cat: Category) => completedSuggestions.filter(s => s.category === cat).length;
  
  const categories: { id: Category; label: string; icon: any; color: string }[] = [
    { id: 'DAY_TRADE', label: 'Trading System', icon: BarChart2, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    { id: 'TECH', label: 'Tecnologia', icon: Cpu, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
    { id: 'DESIGN_UX', label: 'UX / Design', icon: Layout, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
    { id: 'FEATURE', label: 'Features', icon: Zap, color: 'text-pink-400 bg-pink-500/10 border-pink-500/20' },
    { id: 'COMPETITION', label: 'Competitividade', icon: Shield, color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
    { id: 'INNOVATION', label: 'Inovação', icon: Lightbulb, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
  ];

  // Calculate Level/Milestone
  const currentLevel = Math.floor(totalCompleted / 10) + 1;
  const progressToNextLevel = (totalCompleted % 10) * 10; // 0-100%

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Progresso do Build
          </h2>
          <p className="text-sm text-neutral-400">Sincronizado com Lab Intelligence</p>
        </div>
        <div className="flex items-center gap-2 bg-neutral-800 px-3 py-1.5 rounded-lg border border-neutral-700">
          <Award className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-semibold text-white">Nível {currentLevel}</span>
        </div>
      </div>

      {/* Main Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-neutral-400">Próximo Milestone (v0.{currentLevel}.0)</span>
          <span className="text-emerald-400 font-mono">{progressToNextLevel}%</span>
        </div>
        <div className="h-3 w-full bg-neutral-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500 ease-out"
            style={{ width: `${progressToNextLevel}%` }}
          />
        </div>
        <p className="text-xs text-neutral-500 mt-2 text-right">
          {10 - (totalCompleted % 10)} features para o próximo nível
        </p>
      </div>

      {/* Category Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        {categories.map(cat => {
          const count = getCountByCategory(cat.id);
          const Icon = cat.icon;
          return (
            <div key={cat.id} className={`p-3 rounded-lg border ${cat.color} flex flex-col items-center justify-center text-center`}>
              <Icon className="w-5 h-5 mb-2 opacity-80" />
              <span className="text-2xl font-bold mb-0.5 leading-none">{count}</span>
              <span className="text-[10px] uppercase tracking-wider opacity-70">{cat.label}</span>
            </div>
          );
        })}
      </div>

      {/* Recent Activity */}
      <div>
        <h3 className="text-sm font-semibold text-neutral-300 mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4" /> Recém Implementados
        </h3>
        <div className="space-y-3">
          {completedSuggestions.slice(0, 5).map((s, i) => (
            <div key={s.id} className="flex items-start gap-3 p-3 bg-neutral-800/30 rounded-lg border border-neutral-800/50">
              <div className="mt-0.5">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <h4 className="text-sm font-medium text-neutral-200">{s.title}</h4>
                <div className="flex items-center gap-2 mt-1">
                   <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-500 border border-neutral-700">
                    {s.category}
                  </span>
                  <span className="text-[10px] text-neutral-600">
                     {new Date().toLocaleDateString()} {/* Mock date since we don't store timestamp yet */}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {completedSuggestions.length === 0 && (
            <p className="text-sm text-neutral-500 italic text-center py-4">
              Nenhuma feature implementada ainda. Vá ao Lab Intelligence!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
