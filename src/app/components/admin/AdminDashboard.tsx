import React, { useState } from 'react';
import { motion } from 'motion/react';
import { LayoutDashboard, Wallet, Megaphone, Settings, LogOut, Bell, Search, Menu, X, Beaker, User, Share2, Users, Radio, Activity, Terminal, Shield, Database, Bot } from 'lucide-react';
import { FinanceModule } from './FinanceModule';
import { MarketingModule } from './MarketingModule';
import { AdminSettings } from './AdminSettings';
import { LabIntelligence } from './LabIntelligence';
import { SocialMediaManager } from './SocialMediaManager';
import { UserIntelligence } from './UserIntelligence';
import { DefensiveArchitecture } from './DefensiveArchitecture';
import { UserDataDashboard } from './UserDataDashboard';
import { CrawlerMonitor } from './CrawlerMonitor';
import { Button } from "../ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { toast } from "sonner";
import { NotificationCenter } from '../layout/NotificationCenter';

interface AdminDashboardProps {
  onExit: () => void;
}

export function AdminDashboard({ onExit }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'finance' | 'marketing' | 'devlab' | 'settings' | 'social' | 'users' | 'defensive' | 'userdata' | 'crawler'>('userdata');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const handleExit = () => {
    toast.info("Encerrando sessão administrativa...");
    setTimeout(onExit, 500);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <AdminOverview setActiveTab={setActiveTab} />;
      case 'finance':
        return <FinanceModule />;
      case 'users':
        return <UserIntelligence />;
      case 'social':
        return <SocialMediaManager />;
      case 'marketing':
        return <MarketingModule />;
      case 'defensive':
        return <DefensiveArchitecture />;
      case 'settings':
        return <AdminSettings />;
      case 'devlab':
        // Important: h-full here ensures the DevLab (flex container) fills the available space
        return (
          <div className="h-full w-full min-h-[calc(100vh-140px)]">
            <LabIntelligence embedded={true} />
          </div>
        );
      case 'userdata':
        return <UserDataDashboard />;
      case 'crawler':
        return <CrawlerMonitor />;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500">
            <LayoutDashboard className="h-16 w-16 mb-4 opacity-20" />
            <p>Módulo em desenvolvimento</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-black flex font-sans text-slate-200 overflow-hidden selection:bg-purple-500/30">
      
      {/* BACKGROUND EFFECTS */}
      <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/10 blur-[120px] rounded-full mix-blend-screen" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-900/10 blur-[120px] rounded-full mix-blend-screen" />
      </div>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 80 }}
        className="relative z-50 flex flex-col border-r border-white/10 bg-black/95 backdrop-blur-xl transition-all duration-300"
      >
        <div className="h-20 flex items-center justify-center border-b border-white/10 shrink-0 relative">
          <div className={`flex items-center gap-3 transition-all duration-300 ${isSidebarOpen ? 'w-full px-6' : 'w-auto'}`}>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-[0_0_20px_rgba(147,51,234,0.3)] shrink-0 border border-white/10">
              N
            </div>
            {isSidebarOpen && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex flex-col"
              >
                <span className="font-bold text-white tracking-tight whitespace-nowrap text-lg">NEURO ADMIN</span>
                <span className="text-[9px] text-purple-400 uppercase tracking-widest font-mono">System Command V2.0</span>
              </motion.div>
            )}
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
          <SidebarItem 
            icon={LayoutDashboard} 
            label="Visão Geral" 
            isActive={activeTab === 'overview'} 
            isExpanded={isSidebarOpen} 
            onClick={() => setActiveTab('overview')} 
          />
          <SidebarItem 
            icon={Users} 
            label="Inteligência de Usuários" 
            isActive={activeTab === 'users'} 
            isExpanded={isSidebarOpen} 
            onClick={() => setActiveTab('users')} 
          />
          <SidebarItem 
            icon={Database} 
            label="Dados de Usuários (LGPD)" 
            isActive={activeTab === 'userdata'} 
            isExpanded={isSidebarOpen} 
            onClick={() => setActiveTab('userdata')} 
          />
          <SidebarItem 
            icon={Beaker} 
            label="Laboratório Neural" 
            isActive={activeTab === 'devlab'} 
            isExpanded={isSidebarOpen} 
            onClick={() => setActiveTab('devlab')} 
          />
          <SidebarItem 
            icon={Shield} 
            label="Arquitetura Defensiva" 
            isActive={activeTab === 'defensive'} 
            isExpanded={isSidebarOpen} 
            onClick={() => setActiveTab('defensive')} 
          />
          <SidebarItem 
            icon={Bot} 
            label="Crawler Monitor" 
            isActive={activeTab === 'crawler'} 
            isExpanded={isSidebarOpen} 
            onClick={() => setActiveTab('crawler')} 
          />
          
          <div className={`my-4 border-t border-white/5 ${!isSidebarOpen && 'hidden'}`}>
             <span className="text-[10px] uppercase text-slate-600 font-bold tracking-widest px-4 py-2 block">Módulos</span>
          </div>

          <SidebarItem 
            icon={Share2} 
            label="Social Matrix" 
            isActive={activeTab === 'social'} 
            isExpanded={isSidebarOpen} 
            onClick={() => setActiveTab('social')} 
          />
          <SidebarItem 
            icon={Wallet} 
            label="Tesouraria Global" 
            isActive={activeTab === 'finance'} 
            isExpanded={isSidebarOpen} 
            onClick={() => setActiveTab('finance')} 
          />
          <SidebarItem 
            icon={Megaphone} 
            label="Marketing AI" 
            isActive={activeTab === 'marketing'} 
            isExpanded={isSidebarOpen} 
            onClick={() => setActiveTab('marketing')} 
          />
        </nav>

        <div className="p-4 border-t border-white/10 shrink-0 bg-black/50">
           <SidebarItem 
              icon={Settings} 
              label="Configurações do Sistema" 
              isActive={activeTab === 'settings'} 
              isExpanded={isSidebarOpen} 
              onClick={() => setActiveTab('settings')} 
            />
          <div className="h-4" />
          <button 
            onClick={handleExit}
            className={`flex items-center gap-3 w-full p-3 rounded-lg text-rose-400 hover:text-white hover:bg-rose-950/30 border border-transparent hover:border-rose-500/30 transition-all group ${!isSidebarOpen && 'justify-center'}`}
          >
            <LogOut className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
            {isSidebarOpen && <span className="font-bold text-sm">Desconectar</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main 
        className="flex-1 flex flex-col min-w-0 transition-all duration-300 h-screen relative z-10"
      >
        {/* Header */}
        <header className="h-20 border-b border-white/5 bg-black/80 backdrop-blur-md px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-6">
            <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-slate-400 hover:text-white">
              {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            
            <div className="hidden md:flex flex-col">
                 <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-3">
                   {activeTab === 'finance' ? <><Wallet className="w-5 h-5 text-emerald-400"/> Gestão Institucional</> : 
                    activeTab === 'marketing' ? <><Megaphone className="w-5 h-5 text-pink-400"/> Automação de Marketing</> : 
                    activeTab === 'settings' ? <><Settings className="w-5 h-5 text-slate-400"/> Configurações Master</> :
                    activeTab === 'devlab' ? <><Beaker className="w-5 h-5 text-purple-400"/> Laboratório Neural</> :
                    activeTab === 'users' ? <><Users className="w-5 h-5 text-blue-400"/> Base de Usuários</> :
                    activeTab === 'userdata' ? <><Database className="w-5 h-5 text-emerald-400"/> Dados de Usuários (LGPD)</> :
                    activeTab === 'social' ? <><Share2 className="w-5 h-5 text-indigo-400"/> Social Intelligence</> :
                    activeTab === 'defensive' ? <><Shield className="w-5 h-5 text-red-400"/> Arquitetura Defensiva</> :
                    activeTab === 'crawler' ? <><Bot className="w-5 h-5 text-cyan-400"/> Intelligent Crawler Monitor</> :
                    <><LayoutDashboard className="w-5 h-5 text-emerald-400"/> Painel de Controle</>}
                 </h2>
                 <span className="text-xs text-slate-500 font-mono flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    SYSTEM ONLINE • LATENCY: 12ms • SERVER: US-EAST-1
                 </span>
            </div>
          </div>

          <div className="flex items-center gap-6">
             {/* Status Indicators */}
            <div className="hidden lg:flex items-center gap-4 mr-4 px-4 py-2 bg-white/5 rounded-full border border-white/5">
                <div className="flex flex-col items-center px-2">
                    <span className="text-[9px] text-slate-500 font-bold uppercase">CPU Load</span>
                    <span className="text-xs font-mono text-emerald-400">12%</span>
                </div>
                <div className="w-px h-6 bg-white/10" />
                <div className="flex flex-col items-center px-2">
                    <span className="text-[9px] text-slate-500 font-bold uppercase">Memory</span>
                    <span className="text-xs font-mono text-blue-400">4.2GB</span>
                </div>
                <div className="w-px h-6 bg-white/10" />
                 <div className="flex flex-col items-center px-2">
                    <span className="text-[9px] text-slate-500 font-bold uppercase">Active Nodes</span>
                    <span className="text-xs font-mono text-purple-400">84</span>
                </div>
            </div>

            <div className="flex items-center gap-3">
              <NotificationCenter />
              <div className="h-10 w-px bg-white/10 mx-2" />
              <div className="flex items-center gap-3 bg-white/5 p-1 pr-4 rounded-full border border-white/5 hover:bg-white/10 transition-colors cursor-pointer group">
                  <Avatar className="h-8 w-8 border border-purple-500/30">
                    <AvatarImage src="https://github.com/shadcn.png" />
                    <AvatarFallback>AD</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                      <span className="text-xs font-bold text-white group-hover:text-purple-400 transition-colors">Admin User</span>
                      <span className="text-[9px] text-slate-500 uppercase tracking-widest">Level 10 Access</span>
                  </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className={`flex-1 overflow-auto custom-scrollbar ${activeTab === 'devlab' ? 'p-0' : 'p-0'}`}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            {renderContent()}
          </motion.div>
        </div>
      </main>
    </div>
  );
}

function SidebarItem({ icon: Icon, label, isActive, isExpanded, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center w-full px-4 py-3.5 rounded-xl transition-all duration-200 group relative
        ${isActive 
          ? 'bg-gradient-to-r from-purple-900/30 to-blue-900/10 text-white border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.1)]' 
          : 'text-slate-500 hover:text-white hover:bg-white/5 border border-transparent'}
        ${!isExpanded && 'justify-center'}
      `}
    >
      <Icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-purple-400' : 'text-slate-500 group-hover:text-white'} transition-colors duration-300`} />
      
      {isExpanded && (
        <span className={`ml-3 font-medium text-sm tracking-wide whitespace-nowrap overflow-hidden text-ellipsis ${isActive ? 'font-bold' : ''}`}>
          {label}
        </span>
      )}
      
      {isActive && isExpanded && (
        <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.8)] animate-pulse" />
      )}
      
      {!isExpanded && isActive && (
         <div className="absolute right-2 top-2 w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.8)] animate-pulse" />
      )}
    </button>
  );
}

// Sub-component for Overview to fix structure
function AdminOverview({ setActiveTab }: { setActiveTab: (t: any) => void }) {
    return (
        <div className="p-8 grid grid-cols-12 gap-6 h-full auto-rows-min">
            {/* KPI Cards */}
            <div className="col-span-12 grid grid-cols-1 md:grid-cols-4 gap-4">
                <KPICard title="Total Users" value="12,845" change="+12%" icon={Users} color="blue" />
                <KPICard title="System Revenue" value="$482,900" change="+8.4%" icon={Wallet} color="emerald" />
                <KPICard title="Active Nodes" value="84/100" change="Stable" icon={Activity} color="purple" />
                <KPICard title="AI Accuracy" value="94.2%" change="+0.8%" icon={Beaker} color="rose" />
            </div>

            {/* Quick Actions */}
            <div className="col-span-12 md:col-span-8 bg-[#0a0a0a] border border-white/10 rounded-xl p-6 relative overflow-hidden">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-slate-400"/> 
                    Quick Actions
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <ActionBtn label="User Audit" icon={Users} onClick={() => setActiveTab('users')} />
                    <ActionBtn label="Finances" icon={Wallet} onClick={() => setActiveTab('finance')} />
                    <ActionBtn label="Marketing" icon={Megaphone} onClick={() => setActiveTab('marketing')} />
                    <ActionBtn label="System Logs" icon={Activity} />
                </div>
            </div>

            {/* System Status */}
            <div className="col-span-12 md:col-span-4 bg-[#0a0a0a] border border-white/10 rounded-xl p-6">
                 <h3 className="text-lg font-bold text-white mb-4">System Health</h3>
                 <div className="space-y-4">
                     <StatusRow label="Database" status="Operational" color="emerald" />
                     <StatusRow label="API Gateway" status="Operational" color="emerald" />
                     <StatusRow label="Neural Engine" status="Training" color="yellow" />
                     <StatusRow label="Payments" status="Operational" color="emerald" />
                 </div>
            </div>
        </div>
    )
}

function KPICard({ title, value, change, icon: Icon, color }: any) {
    const colorMap: any = {
        blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
        rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    };
    const style = colorMap[color] || colorMap.blue;

    return (
        <div className={`p-6 rounded-xl border ${style.split(' ')[2]} bg-[#0a0a0a] flex items-start justify-between group hover:scale-[1.02] transition-transform duration-300`}>
            <div>
                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-1">{title}</p>
                <h4 className="text-3xl font-bold text-white font-mono tracking-tighter">{value}</h4>
                <span className={`text-xs font-bold ${style.split(' ')[0]} mt-2 block`}>{change} from last month</span>
            </div>
            <div className={`p-3 rounded-lg ${style}`}>
                <Icon className="w-6 h-6" />
            </div>
        </div>
    )
}

function ActionBtn({ label, icon: Icon, onClick }: any) {
    return (
        <button onClick={onClick} className="flex flex-col items-center justify-center p-4 bg-white/5 border border-white/5 rounded-lg hover:bg-white/10 hover:border-purple-500/30 transition-all group">
            <Icon className="w-6 h-6 text-slate-400 group-hover:text-white mb-2 transition-colors" />
            <span className="text-xs font-bold text-slate-500 group-hover:text-white transition-colors">{label}</span>
        </button>
    )
}

function StatusRow({ label, status, color }: any) {
    const colorClass = color === 'emerald' ? 'bg-emerald-500' : color === 'yellow' ? 'bg-yellow-500' : 'bg-red-500';
    return (
        <div className="flex items-center justify-between p-3 bg-white/5 rounded border border-white/5">
            <span className="text-sm font-medium text-slate-300">{label}</span>
            <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${colorClass} animate-pulse`} />
                <span className="text-xs font-bold text-white uppercase tracking-wider">{status}</span>
            </div>
        </div>
    )
}