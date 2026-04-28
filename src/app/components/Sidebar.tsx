import React, { memo } from 'react';
import { LayoutDashboard, Wallet, LineChart, Bot, TrendingUp, Settings, Sparkles, ShieldCheck, Compass, ShoppingBag, Users, Layers, BarChart3, Scale, Rocket, MessageSquare, Brain, Beaker, Mic, Zap } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

type View = 'dashboard' | 'wallet' | 'funds' | 'assets' | 'chart' | 'ai-trader' | 'performance' | 'settings' | 'system' | 'dev-lab' | 'innovation' | 'strategy' | 'store' | 'partners' | 'prop-challenge' | 'social' | 'pyramiding' | 'competitive-analysis' | 'quantum-analysis' | 'ai-voice' | 'live-trading-test';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  isAdmin?: boolean;
  onLogout?: () => void;
}

const menuItems = [
  { id: 'dashboard' as View, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'wallet' as View, label: 'Carteira', icon: Wallet },
  { id: 'chart' as View, label: 'Gráfico', icon: LineChart },
  { id: 'ai-trader' as View, label: 'AI Trader', icon: Bot },
  { id: 'ai-voice' as View, label: 'AI Trader Voice', icon: Mic },
  { id: 'innovation' as View, label: 'IA Preditiva', icon: Sparkles },
  { id: 'performance' as View, label: 'Performance', icon: TrendingUp },
  { id: 'store' as View, label: 'Marketplace', icon: ShoppingBag },
  { id: 'partners' as View, label: 'Parceiros', icon: Users },
  { id: 'settings' as View, label: 'Configurações', icon: Settings },
];

export const Sidebar = memo(function Sidebar({ currentView, onViewChange, isAdmin, onLogout }: SidebarProps) {
  const handleViewChange = (view: View) => {
    onViewChange(view);
  };

  return (
    <aside id="app-sidebar" className="w-80 bg-black border-r border-white/5 flex flex-col h-screen font-sans">
      {/* ✅ LOGO — só ícone SVG, sem texto lateral */}
      <div
        className="px-6 py-6 border-b border-white/5 flex justify-center cursor-pointer hover:bg-white/[0.03] transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          handleViewChange('dashboard');
        }}
      >
        <BrandLogo variant="icon-only" size="md" animated={true} />
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-6 py-8 space-y-2 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              onClick={(e) => {
                e.stopPropagation();
                handleViewChange(item.id);
              }}
              className={`w-full flex items-center gap-4 px-5 py-3.5 mx-auto rounded-xl transition-all duration-200 border border-transparent group ${
                isActive
                  ? 'bg-white/10 text-emerald-400 border-white/5 shadow-lg shadow-emerald-500/5'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon className={`w-5 h-5 shrink-0 transition-colors ${isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-white'}`} />
              <span className={`text-sm tracking-wide ${isActive ? 'font-semibold' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}

        {/* System Section */}
        {isAdmin && (
          <div className="pt-8 mt-8 border-t border-white/5">
            <p className="px-6 text-xs font-bold text-slate-600 uppercase tracking-[0.2em] mb-4">
              Sistema
            </p>

            <div className="space-y-1">
              <button
                onClick={() => handleViewChange('dev-lab')}
                className={`w-full flex items-center gap-4 px-5 py-3.5 mx-auto rounded-xl transition-all duration-200 border border-transparent group ${
                  currentView === 'dev-lab'
                    ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                    : 'text-slate-400 hover:bg-white/5 hover:text-indigo-400'
                }`}
              >
                <Beaker className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium tracking-wide">DEV LAB</span>
              </button>

              <button
                onClick={() => handleViewChange('admin' as View)}
                className={`w-full flex items-center gap-4 px-5 py-3.5 mx-auto rounded-xl transition-all duration-200 border border-transparent group ${
                  currentView === 'admin'
                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                    : 'text-slate-400 hover:bg-white/5 hover:text-purple-400'
                }`}
              >
                <ShieldCheck className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium tracking-wide">Admin</span>
              </button>

              <button
                onClick={() => handleViewChange('strategy')}
                className={`w-full flex items-center gap-4 px-5 py-3.5 mx-auto rounded-xl transition-all duration-200 border border-transparent group ${
                  currentView === 'strategy'
                    ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                    : 'text-slate-400 hover:bg-white/5 hover:text-cyan-300'
                }`}
              >
                <Compass className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium tracking-wide">Estratégia</span>
              </button>

              <button
                onClick={() => handleViewChange('pyramiding')}
                className={`w-full flex items-center gap-4 px-5 py-3.5 mx-auto rounded-xl transition-all duration-200 border border-transparent group ${
                  currentView === 'pyramiding'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'text-slate-400 hover:bg-white/5 hover:text-amber-400'
                }`}
              >
                <Layers className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium tracking-wide">Pyramiding</span>
              </button>

              <button
                onClick={() => handleViewChange('competitive-analysis')}
                className={`w-full flex items-center gap-4 px-5 py-3.5 mx-auto rounded-xl transition-all duration-200 border border-transparent group ${
                  currentView === 'competitive-analysis'
                    ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                    : 'text-slate-400 hover:bg-white/5 hover:text-orange-400'
                }`}
              >
                <BarChart3 className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium tracking-wide">Análise Competitiva</span>
              </button>

              <button
                onClick={() => handleViewChange('compliance-analysis' as View)}
                className={`w-full flex items-center gap-4 px-5 py-3.5 mx-auto rounded-xl transition-all duration-200 border border-transparent group ${
                  currentView === 'compliance-analysis'
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    : 'text-slate-400 hover:bg-white/5 hover:text-blue-400'
                }`}
              >
                <Scale className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium tracking-wide">Compliance Legal</span>
              </button>

              <button
                onClick={() => handleViewChange('launch-strategy' as View)}
                className={`w-full flex items-center gap-4 px-5 py-3.5 mx-auto rounded-xl transition-all duration-200 border border-transparent group ${
                  currentView === 'launch-strategy'
                    ? 'bg-green-500/10 text-green-400 border-green-500/20'
                    : 'text-slate-400 hover:bg-white/5 hover:text-green-400'
                }`}
              >
                <Rocket className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium tracking-wide">Estratégia Lançamento</span>
              </button>

              <button
                onClick={() => handleViewChange('trader-insights' as View)}
                className={`w-full flex items-center gap-4 px-5 py-3.5 mx-auto rounded-xl transition-all duration-200 border border-transparent group ${
                  currentView === 'trader-insights'
                    ? 'bg-pink-500/10 text-pink-400 border-pink-500/20'
                    : 'text-slate-400 hover:bg-white/5 hover:text-pink-400'
                }`}
              >
                <MessageSquare className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium tracking-wide">Insights Traders</span>
              </button>

              <button
                onClick={() => handleViewChange('quantum-analysis' as View)}
                className={`w-full flex items-center gap-4 px-5 py-3.5 mx-auto rounded-xl transition-all duration-200 border border-transparent group ${
                  currentView === 'quantum-analysis'
                    ? 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                    : 'text-slate-400 hover:bg-white/5 hover:text-gray-400'
                }`}
              >
                <Brain className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium tracking-wide">Análise Quântica</span>
              </button>

              <button
                onClick={() => handleViewChange('live-trading-test' as View)}
                className={`w-full flex items-center gap-4 px-5 py-3.5 mx-auto rounded-xl transition-all duration-200 border border-transparent group ${
                  currentView === 'live-trading-test'
                    ? 'bg-red-500/10 text-red-400 border-red-500/20'
                    : 'text-slate-400 hover:bg-white/5 hover:text-red-400'
                }`}
              >
                <Zap className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium tracking-wide">Trading ao Vivo</span>
              </button>
            </div>
          </div>
        )}
      </nav>
    </aside>
  );
});