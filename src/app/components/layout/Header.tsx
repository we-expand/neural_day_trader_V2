import React from 'react';
import { Bell, LogOut, Search, ShieldCheck, AlertTriangle, User } from 'lucide-react';
import { useTradingContext } from '../../contexts/TradingContext';
import { useUserProfile } from '../../hooks/useUserProfile';
import { BrokerConnectionStatus } from '../BrokerConnectionStatus';

interface HeaderProps {
  currentView: string;
  isAdmin?: boolean;
  onLogout?: () => void;
  user?: { name: string; email: string; role: string } | null;
}

export const Header: React.FC<HeaderProps> = ({ currentView, isAdmin, onLogout, user }) => {
  const { config } = useTradingContext();
  const { fullName, profile, avatarUrl } = useUserProfile();
  const isLive = config.executionMode === 'LIVE';

  const getViewTitle = (view: string) => {
    switch (view) {
      case 'dashboard': return 'Dashboard';
      case 'funds': return 'Carteira';
      case 'chart': return ''; // Vazio - título já existe no componente
      case 'ai-trader': return ''; // Vazio - título já existe no componente
      case 'performance': return ''; // Vazio - título já existe no componente
      case 'settings': return 'Configurações';
      case 'dev-lab': return 'Laboratório';
      case 'innovation': return ''; // Vazio - título já existe no componente
      case 'strategy': return 'Estratégia';
      case 'store': return ''; // Vazio - título já existe no componente (Marketplace)
      case 'prop-challenge': return ''; // Vazio - título já existe no componente
      case 'partners': return ''; // Vazio - título já existe no componente
      default: return 'Dashboard';
    }
  };

  return (
    <header id="app-header" className="min-h-[4rem] h-auto py-2 border-b border-white/5 bg-black/50 backdrop-blur-md px-4 md:px-6 flex flex-wrap md:flex-nowrap items-center justify-between sticky top-0 z-40 gap-y-2">
      {/* Left: Mode Badge only — no view title duplicating sidebar */}
      <div className="flex items-center gap-4 shrink-0">
        {/* Execution Mode Badge */}
        <div className={`flex items-center gap-2 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
            isLive 
            ? 'bg-red-500/10 border border-red-500/30 text-red-400' 
            : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
        }`}>
            {isLive ? <AlertTriangle className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
            {isLive ? 'LIVE' : 'DEMO'}
        </div>
      </div>
      
      {/* Right: Actions & Profile */}
      <div className="flex items-center gap-2 md:gap-4 ml-auto shrink-0">
        {/* 🟢 BROKER CONNECTION STATUS */}
        <BrokerConnectionStatus />

        {/* Notifications */}
        <button className="relative p-2 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-white/5">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>
        </button>

        {/* Logout Button (Explicit) */}
        {onLogout && (
           <button 
             onClick={onLogout}
             className="flex items-center gap-2 px-3 py-1.5 ml-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs font-bold text-red-400 hover:bg-red-500 hover:text-white transition-all"
             title="Sair da Plataforma"
           >
             <LogOut className="w-3.5 h-3.5" />
             <span className="hidden md:inline">Sair</span>
           </button>
        )}

        <div className="h-8 w-[1px] bg-white/10 mx-2"></div>

        {/* User Profile */}
        <div className="flex items-center gap-3 pl-2 cursor-pointer group relative">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-white leading-tight">
              {fullName}
            </p>
            <p className="text-[10px] text-slate-500 font-medium leading-tight">
              {profile?.email || user?.email || 'email@exemplo.com'}
            </p>
          </div>
          
          <div className="relative">
             {/* 🎨 Avatar com imagem do usuário */}
             <img 
               src={avatarUrl}
               alt={fullName}
               className="w-9 h-9 rounded-full border border-white/10 group-hover:border-white/20 transition-colors"
             />
             <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-black rounded-full"></div>
          </div>

          {/* Dropdown / Logout (Simple version) */}
          {onLogout && (
             <div className="absolute top-full right-0 mt-2 w-32 py-1 bg-black border border-white/10 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform origin-top-right z-50">
                <button 
                  onClick={onLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:bg-white/5 text-left"
                >
                  <LogOut className="w-3 h-3" />
                  Sair
                </button>
             </div>
          )}
        </div>
      </div>
    </header>
  );
};