import React from 'react';
import { getInfinoxStats, INFINOX_CATEGORY_NAMES } from '@/config/infinoxAssets';
import { TrendingUp, Globe, DollarSign, Zap } from 'lucide-react';

/**
 * 📊 INFINOX STATS WIDGET
 * 
 * Widget compacto mostrando estatísticas dos ativos disponíveis na Infinox
 */
export function InfinoxStatsWidget() {
  const stats = getInfinoxStats();

  // Top 4 categorias com mais ativos
  const topCategories = Object.entries(stats.byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-xl border border-white/10 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            🏦 Infinox Assets
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Ativos disponíveis
          </p>
        </div>
        <div className="bg-white/10 px-3 py-1 rounded-full">
          <span className="text-2xl font-bold text-white">{stats.total}</span>
        </div>
      </div>

      {/* Categorias */}
      <div className="grid grid-cols-2 gap-2">
        {topCategories.map(([category, count]) => {
          const icons: Record<string, React.ReactNode> = {
            FOREX: <DollarSign className="w-3 h-3" />,
            STOCKS_UK: <Globe className="w-3 h-3" />,
            STOCKS_EU: <Globe className="w-3 h-3" />,
            STOCKS_US: <TrendingUp className="w-3 h-3" />,
            CRYPTO: <Zap className="w-3 h-3" />,
            INDICES: <TrendingUp className="w-3 h-3" />,
          };

          return (
            <div
              key={category}
              className="bg-white/5 rounded-lg p-2 border border-white/10 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="text-purple-400">
                    {icons[category] || <Globe className="w-3 h-3" />}
                  </div>
                  <span className="text-xs text-slate-400">
                    {(INFINOX_CATEGORY_NAMES[category] || category).replace(/[🏦💱₿📈🥇🛢️🌾🇬🇧🇪🇺🇺🇸📊]/g, '').trim()}
                  </span>
                </div>
                <span className="text-sm font-bold text-white">{count}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-500">
        <span>MT5 Real-time</span>
        <span className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </span>
      </div>
    </div>
  );
}

/**
 * 📊 INFINOX STATS CARD (versão maior)
 * 
 * Card maior com estatísticas detalhadas
 */
export function InfinoxStatsCard() {
  const stats = getInfinoxStats();

  const categoryData = Object.entries(stats.byCategory)
    .map(([category, count]) => ({
      category,
      name: INFINOX_CATEGORY_NAMES[category] || category,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const maxCount = Math.max(...categoryData.map(d => d.count));

  return (
    <div className="bg-[#0a0a0a] rounded-xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="p-6 bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              🏦 Infinox Broker
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              Conectado à plataforma MT5 com acesso a {stats.total}+ ativos
            </p>
          </div>
          <div className="text-right">
            <div className="text-5xl font-bold text-white">{stats.total}</div>
            <div className="text-xs text-slate-500 mt-1">Ativos Totais</div>
          </div>
        </div>
      </div>

      {/* Body - Gráfico de Barras */}
      <div className="p-6 space-y-3">
        {categoryData.map(({ category, name, count }) => {
          const percentage = (count / maxCount) * 100;
          
          return (
            <div key={category} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-300 font-medium">{name}</span>
                <span className="text-white font-bold">{count}</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-4 bg-[#080808] border-t border-white/10">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Neural Day Trader Platform</span>
          <span className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Connection
          </span>
        </div>
      </div>
    </div>
  );
}
