/**
 * 🧪 DEV LAB
 * Centro de Inovação e Gestão de Sugestões
 */

import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Code2, 
  Paintbrush, 
  Zap, 
  TrendingUp, 
  Sparkles, 
  Bug, 
  Lightbulb,
  Check,
  Trash2,
  RotateCcw,
  X,
  Plus,
  Filter,
  Beaker
} from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useDevLabStore } from '@/app/hooks/useDevLabStore';
import type { Category, Impact, Effort, SuggestionStatus, Suggestion } from '@/types/devlab';
import { CATEGORY_CONFIG, IMPACT_CONFIG, EFFORT_CONFIG } from '@/types/devlab';

type ViewMode = 'active' | 'completed' | 'trash';

// 🎨 Ícone por Categoria
const CategoryIcon = ({ category }: { category: Category }) => {
  const iconProps = { className: 'w-5 h-5' };
  
  switch (category) {
    case 'TECH': return <Code2 {...iconProps} className="w-5 h-5 text-blue-500" />;
    case 'DESIGN_UX': return <Paintbrush {...iconProps} className="w-5 h-5 text-purple-500" />;
    case 'FEATURE': return <Zap {...iconProps} className="w-5 h-5 text-yellow-500" />;
    case 'COMPETITION': return <TrendingUp {...iconProps} className="w-5 h-5 text-orange-500" />;
    case 'INNOVATION': return <Sparkles {...iconProps} className="w-5 h-5 text-pink-500" />;
    case 'BUG': return <Bug {...iconProps} className="w-5 h-5 text-red-500" />;
    case 'OPTIMIZATION': return <Lightbulb {...iconProps} className="w-5 h-5 text-green-500" />;
  }
};

// 🏷️ Badge de Impacto
const ImpactBadge = ({ impact }: { impact: Impact }) => {
  const config = IMPACT_CONFIG[impact];
  return (
    <span className={`text-xs px-3 py-1 rounded-full border-2 font-bold uppercase ${config.bgColor} ${config.textColor} ${config.borderColor}`}>
      {impact}
    </span>
  );
};

// 🔧 Badge de Esforço
const EffortBadge = ({ effort }: { effort: Effort }) => {
  const config = EFFORT_CONFIG[effort];
  return (
    <div className="flex items-center gap-2 px-3 py-1 rounded-full border-2 bg-white border-gray-200">
      <div className={`w-2 h-2 rounded-full ${config.color}`} />
      <span className="text-xs font-semibold text-gray-700">{config.label}</span>
    </div>
  );
};

export function DevLab() {
  const { suggestions, markAsCompleted, markAsTrash, restoreFromTrash, permanentDelete } = useDevLabStore();
  const [viewMode, setViewMode] = useState<ViewMode>('active');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'ALL'>('ALL');
  const [showNewModal, setShowNewModal] = useState(false);

  // 📊 Estatísticas
  const stats = useMemo(() => ({
    active: suggestions.filter(s => s.status === 'active').length,
    completed: suggestions.filter(s => s.status === 'completed').length,
    trash: suggestions.filter(s => s.status === 'trash').length,
    total: suggestions.length,
  }), [suggestions]);

  // Progresso global (% de sugestões implementadas)
  const progress = useMemo(() => {
    const total = stats.active + stats.completed;
    return total > 0 ? Math.round((stats.completed / total) * 100) : 0;
  }, [stats]);

  // 🔍 Filtrar sugestões
  const filteredSuggestions = useMemo(() => {
    return suggestions
      .filter(s => s.status === viewMode)
      .filter(s => selectedCategory === 'ALL' || s.category === selectedCategory)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [suggestions, viewMode, selectedCategory]);

  // 📊 Dados para gráfico de pizza (por categoria)
  const categoryData = useMemo(() => {
    const activeSuggestions = suggestions.filter(s => s.status === 'active');
    const categories: Record<Category, number> = {
      TECH: 0,
      DESIGN_UX: 0,
      FEATURE: 0,
      COMPETITION: 0,
      INNOVATION: 0,
      BUG: 0,
      OPTIMIZATION: 0,
    };

    activeSuggestions.forEach(s => {
      categories[s.category]++;
    });

    return Object.entries(categories)
      .filter(([_, count]) => count > 0)
      .map(([category, count]) => ({
        name: CATEGORY_CONFIG[category as Category].label,
        value: count,
        color: CATEGORY_CONFIG[category as Category].color.replace('text-', ''),
      }));
  }, [suggestions]);

  // 📊 Dados para gráfico de barras (por impacto)
  const impactData = useMemo(() => {
    const activeSuggestions = suggestions.filter(s => s.status === 'active');
    const impacts = { HIGH: 0, MEDIUM: 0, LOW: 0 };

    activeSuggestions.forEach(s => {
      impacts[s.impact]++;
    });

    return [
      { name: 'Alto', value: impacts.HIGH },
      { name: 'Médio', value: impacts.MEDIUM },
      { name: 'Baixo', value: impacts.LOW },
    ];
  }, [suggestions]);

  // Contador por categoria
  const categoryCounts = useMemo(() => {
    const counts: Record<Category, number> = {
      TECH: 0,
      DESIGN_UX: 0,
      FEATURE: 0,
      COMPETITION: 0,
      INNOVATION: 0,
      BUG: 0,
      OPTIMIZATION: 0,
    };

    suggestions
      .filter(s => s.status === viewMode)
      .forEach(s => {
        counts[s.category]++;
      });

    return counts;
  }, [suggestions, viewMode]);

  const COLORS = {
    'blue-500': '#3b82f6',
    'purple-500': '#a855f7',
    'yellow-500': '#eab308',
    'orange-500': '#f97316',
    'pink-500': '#ec4899',
    'red-500': '#ef4444',
    'green-500': '#22c55e',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* 🎨 HEADER */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-indigo-900 via-purple-900 to-pink-900 text-white relative overflow-hidden"
      >
        {/* Pattern background */}
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%">
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/>
            </pattern>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative px-8 py-12">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Beaker className="w-10 h-10 text-indigo-300" />
                <h1 className="text-5xl font-black uppercase tracking-tight">DEV LAB</h1>
              </div>
              <p className="text-indigo-200 text-lg font-medium">Centro de Inovação e Desenvolvimento</p>
            </div>
          </div>

          {/* Métricas */}
          <div className="grid grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20"
            >
              <div className="text-4xl font-black mb-1">{progress}%</div>
              <div className="text-sm text-indigo-200 font-medium uppercase tracking-wide">Progresso</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20"
            >
              <div className="text-4xl font-black mb-1">{stats.active}</div>
              <div className="text-sm text-indigo-200 font-medium uppercase tracking-wide">Ativas</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20"
            >
              <div className="text-4xl font-black mb-1">{stats.completed}</div>
              <div className="text-sm text-indigo-200 font-medium uppercase tracking-wide">Implementadas</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20"
            >
              <div className="text-4xl font-black mb-1">{stats.total}</div>
              <div className="text-sm text-indigo-200 font-medium uppercase tracking-wide">Total</div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      <div className="p-8 space-y-6">
        {/* 🔘 NAVEGAÇÃO (Tabs) */}
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setViewMode('active')}
            className={`px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wide transition-all ${
              viewMode === 'active'
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            🔵 Ativas: {stats.active}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setViewMode('completed')}
            className={`px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wide transition-all ${
              viewMode === 'completed'
                ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            ✅ Implementadas: {stats.completed}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setViewMode('trash')}
            className={`px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wide transition-all ${
              viewMode === 'trash'
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            📦 Arquivo: {stats.trash}
          </motion.button>

          <div className="flex-1" />

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowNewModal(true)}
            className="px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wide bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nova Sugestão
          </motion.button>
        </div>

        {/* 📊 ANALYTICS GRID */}
        <div className="grid grid-cols-3 gap-6">
          {/* Gráfico de Pizza - Por Categoria */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100"
          >
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Filter className="w-5 h-5 text-indigo-500" />
              Por Categoria
            </h3>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[entry.color as keyof typeof COLORS] || '#888'} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-gray-400">
                Nenhuma sugestão ativa
              </div>
            )}
          </motion.div>

          {/* Gráfico de Barras - Por Impacto */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100"
          >
            <h3 className="text-lg font-bold text-gray-800 mb-4">Por Impacto</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={impactData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Filtro por Categoria */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100"
          >
            <h3 className="text-lg font-bold text-gray-800 mb-4">Filtrar</h3>
            <div className="space-y-2">
              <button
                onClick={() => setSelectedCategory('ALL')}
                className={`w-full text-left px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  selectedCategory === 'ALL'
                    ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-300'
                    : 'text-gray-600 hover:bg-gray-50 border border-transparent'
                }`}
              >
                ☑ Todas ({filteredSuggestions.length})
              </button>

              {(Object.keys(CATEGORY_CONFIG) as Category[]).map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`w-full text-left px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-between ${
                    selectedCategory === category
                      ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-300'
                      : 'text-gray-600 hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <span>{CATEGORY_CONFIG[category].label}</span>
                  <span className="text-xs bg-gray-200 px-2 py-1 rounded-full">{categoryCounts[category]}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </div>

        {/* 📋 LISTA DE SUGESTÕES */}
        <div className="space-y-4">
          {filteredSuggestions.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center border border-gray-100">
              <div className="text-6xl mb-4">🔍</div>
              <p className="text-xl font-bold text-gray-400">Nenhuma sugestão encontrada</p>
            </div>
          ) : (
            filteredSuggestions.map((suggestion, index) => (
              <motion.div
                key={suggestion.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100 hover:border-indigo-300 hover:shadow-xl transition-all group"
              >
                <div className="flex items-start gap-4">
                  {/* Ícone da categoria */}
                  <div className="flex-shrink-0 mt-1">
                    <CategoryIcon category={suggestion.category} />
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1">
                    <h4 className="text-lg font-bold text-gray-800 mb-2">{suggestion.title}</h4>
                    <p className="text-sm text-gray-600 mb-4">{suggestion.description}</p>

                    {/* Badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <ImpactBadge impact={suggestion.impact} />
                      <EffortBadge effort={suggestion.effort} />
                      
                      {/* Tags */}
                      {suggestion.tags.map(tag => (
                        <span key={tag} className="text-xs px-3 py-1 bg-gray-100 text-gray-600 rounded-full font-medium">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex-shrink-0 flex gap-2">
                    {suggestion.status === 'active' && (
                      <>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => markAsCompleted(suggestion.id)}
                          className="w-10 h-10 rounded-lg bg-green-100 hover:bg-green-200 text-green-600 flex items-center justify-center transition-colors"
                          title="Marcar como implementada"
                        >
                          <Check className="w-5 h-5" />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => markAsTrash(suggestion.id)}
                          className="w-10 h-10 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center transition-colors"
                          title="Arquivar"
                        >
                          <Trash2 className="w-5 h-5" />
                        </motion.button>
                      </>
                    )}

                    {suggestion.status === 'completed' && (
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => markAsTrash(suggestion.id)}
                        className="w-10 h-10 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center transition-colors"
                        title="Arquivar"
                      >
                        <Trash2 className="w-5 h-5" />
                      </motion.button>
                    )}

                    {suggestion.status === 'trash' && (
                      <>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => restoreFromTrash(suggestion.id)}
                          className="w-10 h-10 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-600 flex items-center justify-center transition-colors"
                          title="Restaurar"
                        >
                          <RotateCcw className="w-5 h-5" />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => permanentDelete(suggestion.id)}
                          className="w-10 h-10 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center transition-colors"
                          title="Deletar permanentemente"
                        >
                          <X className="w-5 h-5" />
                        </motion.button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default DevLab;
