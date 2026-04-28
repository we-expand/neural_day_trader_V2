import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Bell, 
  Shield, 
  Database, 
  Trash2, 
  Download, 
  User, 
  CreditCard, 
  Globe, 
  Eye, 
  EyeOff, 
  ChevronRight, 
  AlertTriangle, 
  CheckCircle2, 
  Lock, 
  TrendingUp, 
  Zap,
  DollarSign,
  Key,
  Palette,
  Moon,
  Activity,
  Save,
  RefreshCw,
  Copy,
  Server,
  Monitor
} from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { VoiceSettings } from '@/app/components/settings/VoiceSettings';
import { BrokerConnections } from '@/app/components/settings/BrokerConnections';
import { AssetHealthMonitor } from '@/app/components/system/AssetHealthMonitor';
import { MassAssetDiagnostics } from '@/app/components/system/MassAssetDiagnostics';
import { DataSourceHealthDashboard } from '@/app/components/system/DataSourceHealthDashboard';
import { AlertSystemPanel } from '@/app/components/system/AlertSystemPanel';
import { useAuth } from '@/app/contexts/AuthContext';

export function Settings() {
  const { user } = useAuth();
  
  // Estados para todas as configurações
  const [tradingNotifications, setTradingNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [performanceAlerts, setPerformanceAlerts] = useState(true);
  const [riskAlerts, setRiskAlerts] = useState(true);
  
  const [autoTrade, setAutoTrade] = useState(false);
  const [autoStopLoss, setAutoStopLoss] = useState(true);
  const [autoTakeProfit, setAutoTakeProfit] = useState(true);
  
  const [maxDailyLoss, setMaxDailyLoss] = useState('5');
  const [maxPositionSize, setMaxPositionSize] = useState('10');
  const [leverage, setLeverage] = useState('1');
  
  const [metaApiKey, setMetaApiKey] = useState('');
  const [metaApiAccountId, setMetaApiAccountId] = useState('');
  const [tradingEconomicsKey, setTradingEconomicsKey] = useState('');
  const [spGlobalKey, setSpGlobalKey] = useState('');
  
  const [theme, setTheme] = useState('dark');
  const [language, setLanguage] = useState('pt');
  const [chartType, setChartType] = useState('candlestick');
  
  const [showBalances, setShowBalances] = useState(true);
  const [showPositions, setShowPositions] = useState(true);
  
  const [activeTab, setActiveTab] = useState<'general' | 'trading' | 'risk' | 'api' | 'display' | 'brokers' | 'system'>('general');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [isLoadingToken, setIsLoadingToken] = useState(false);

  // 🔥 NOVO: Carregar token do backend ao montar o componente
  useEffect(() => {
    const loadTokenFromBackend = async () => {
      if (!user?.id) {
        console.log('[Settings] ⏭️ Usuário não logado, pulando carregamento do token');
        return;
      }

      setIsLoadingToken(true);
      
      try {
        console.log('[Settings] 🔄 Carregando token do backend...');
        
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-1dbacac6/mt5-token/load?userId=${user.id}`,
          {
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`
            }
          }
        );

        const data = await response.json();

        if (data.token) {
          setMetaApiKey(data.token);
          console.log('[Settings] ✅ Token carregado do backend:', data.token.substring(0, 30) + '...');
        } else {
          console.log('[Settings] ℹ️ Nenhum token salvo no backend');
        }
      } catch (error) {
        console.error('[Settings] ❌ Erro ao carregar token:', error);
      } finally {
        setIsLoadingToken(false);
      }
    };

    loadTokenFromBackend();
  }, [user?.id]); // Recarrega se o usuário mudar

  // 💾 Função para salvar o token no backend
  const handleSaveMetaApiToken = async () => {
    if (!metaApiKey.trim()) {
      alert('❌ Por favor, insira o token MetaAPI');
      return;
    }

    setSaveStatus('saving');
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-1dbacac6/save-metaapi-token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            token: metaApiKey.trim()
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Erro ao salvar token');
      }

      setSaveStatus('success');
      
      // 🔥 Salvar também no localStorage para uso imediato
      try {
        localStorage.setItem('metaapi_token', metaApiKey.trim());
        console.log('[Settings] ✅ Token salvo no localStorage também');
      } catch (e) {
        console.warn('[Settings] ⚠️ Não foi possível salvar no localStorage:', e);
      }
      
      alert('✅ Token MetaAPI salvo com sucesso! A plataforma agora usará este token.');
      
      // Reset status após 2 segundos
      setTimeout(() => setSaveStatus('idle'), 2000);
      
    } catch (error: any) {
      console.error('❌ Erro ao salvar token:', error);
      setSaveStatus('error');
      alert(`❌ ${error.message || 'Erro ao salvar token. Tente novamente.'}`);
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  // 🗑️ Função para limpar o token do KV store
  const handleClearMetaApiToken = async () => {
    if (!confirm('🗑️ Tem certeza que deseja limpar o token do cache? O sistema usará apenas a variável de ambiente METAAPI_TOKEN.')) {
      return;
    }

    setSaveStatus('saving');
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-1dbacac6/clear-metaapi-token`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Erro ao limpar token');
      }

      setSaveStatus('success');
      setMetaApiKey(''); // Limpar input também
      
      // 🔥 Limpar também do localStorage
      try {
        localStorage.removeItem('metaapi_token');
        console.log('[Settings] ✅ Token removido do localStorage também');
      } catch (e) {
        console.warn('[Settings] ⚠️ Não foi possível remover do localStorage:', e);
      }
      
      alert('✅ Token removido do cache! O sistema agora usará a variável de ambiente METAAPI_TOKEN.');
      
      setTimeout(() => setSaveStatus('idle'), 2000);
      
    } catch (error: any) {
      console.error('❌ Erro ao limpar token:', error);
      setSaveStatus('error');
      alert(`❌ ${error.message || 'Erro ao limpar token. Tente novamente.'}`);
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  const handleSaveSettings = () => {
    console.log('💾 Salvando configurações...');
    // TODO: Implementar salvamento no backend
    alert('✅ Configurações salvas com sucesso!');
  };

  return (
    <div className="h-full bg-black overflow-auto">
      <div className="w-full h-full p-4 overflow-y-auto custom-scrollbar">
        {/* Header - Padrão Dashboard */}
        <div className="flex items-start gap-4 mb-6">
          <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
            <SettingsIcon className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white uppercase">
              Configurações
            </h1>
            <p className="text-slate-400 mt-1 tracking-wide font-light">
              Gerencie suas preferências e configurações da plataforma
            </p>
          </div>
        </div>

        {/* Tabs - Mais compacto */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
              activeTab === 'general'
                ? 'bg-emerald-600 text-white'
                : 'bg-zinc-900 text-slate-400 hover:bg-zinc-800 border border-zinc-800'
            }`}
          >
            <Bell className="w-4 h-4 inline mr-2" />
            Geral
          </button>
          <button
            onClick={() => setActiveTab('trading')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
              activeTab === 'trading'
                ? 'bg-emerald-600 text-white'
                : 'bg-zinc-900 text-slate-400 hover:bg-zinc-800 border border-zinc-800'
            }`}
          >
            <Zap className="w-4 h-4 inline mr-2" />
            Trading
          </button>
          <button
            onClick={() => setActiveTab('risk')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
              activeTab === 'risk'
                ? 'bg-emerald-600 text-white'
                : 'bg-zinc-900 text-slate-400 hover:bg-zinc-800 border border-zinc-800'
            }`}
          >
            <Shield className="w-4 h-4 inline mr-2" />
            Gestão de Risco
          </button>
          <button
            onClick={() => setActiveTab('api')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
              activeTab === 'api'
                ? 'bg-emerald-600 text-white'
                : 'bg-zinc-900 text-slate-400 hover:bg-zinc-800 border border-zinc-800'
            }`}
          >
            <Key className="w-4 h-4 inline mr-2" />
            APIs & Integração
          </button>
          <button
            onClick={() => setActiveTab('display')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
              activeTab === 'display'
                ? 'bg-emerald-600 text-white'
                : 'bg-zinc-900 text-slate-400 hover:bg-zinc-800 border border-zinc-800'
            }`}
          >
            <Palette className="w-4 h-4 inline mr-2" />
            Exibição
          </button>
          <button
            onClick={() => setActiveTab('brokers')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
              activeTab === 'brokers'
                ? 'bg-emerald-600 text-white'
                : 'bg-zinc-900 text-slate-400 hover:bg-zinc-800 border border-zinc-800'
            }`}
          >
            <Server className="w-4 h-4 inline mr-2" />
            Corretoras
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
              activeTab === 'system'
                ? 'bg-cyan-600 text-white'
                : 'bg-zinc-900 text-slate-400 hover:bg-zinc-800 border border-zinc-800'
            }`}
          >
            <Monitor className="w-4 h-4 inline mr-2" />
            Sistema
          </button>
        </div>

        {/* Content - Grid compacto */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 pb-20">
          {/* TAB: GERAL */}
          {activeTab === 'general' && (
            <>
              {/* ✅ VOZ DA IA - NOVA SEÇÃO */}
              <div className="col-span-1 xl:col-span-2">
                <VoiceSettings />
              </div>

              {/* Notificações */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <Bell className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-lg font-bold text-white">Notificações</h2>
                </div>
                
                <div className="space-y-3">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex-1">
                      <span className="text-slate-300 text-sm font-medium">Alertas de trading</span>
                      <p className="text-xs text-slate-500">Notificações de ordens executadas</p>
                    </div>
                    <div className="relative ml-4">
                      <input
                        type="checkbox"
                        checked={tradingNotifications}
                        onChange={(e) => setTradingNotifications(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </div>
                  </label>

                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex-1">
                      <span className="text-slate-300 text-sm font-medium">Email diário</span>
                      <p className="text-xs text-slate-500">Resumo de performance por email</p>
                    </div>
                    <div className="relative ml-4">
                      <input
                        type="checkbox"
                        checked={emailNotifications}
                        onChange={(e) => setEmailNotifications(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </div>
                  </label>

                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex-1">
                      <span className="text-slate-300 text-sm font-medium">Alertas de performance</span>
                      <p className="text-xs text-slate-500">Metas de lucro/prejuízo</p>
                    </div>
                    <div className="relative ml-4">
                      <input
                        type="checkbox"
                        checked={performanceAlerts}
                        onChange={(e) => setPerformanceAlerts(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </div>
                  </label>

                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex-1">
                      <span className="text-slate-300 text-sm font-medium">Alertas de risco</span>
                      <p className="text-xs text-slate-500">Limites de risco atingidos</p>
                    </div>
                    <div className="relative ml-4">
                      <input
                        type="checkbox"
                        checked={riskAlerts}
                        onChange={(e) => setRiskAlerts(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Idioma & Região */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <Globe className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-lg font-bold text-white">Idioma & Região</h2>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-400 text-xs font-semibold uppercase mb-2">Idioma</label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="pt">Português (Brasil)</option>
                      <option value="en">English (US)</option>
                      <option value="es">Español</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 text-xs font-semibold uppercase mb-2">Fuso Horário</label>
                    <select className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500">
                      <option>GMT-3 (São Paulo)</option>
                      <option>GMT-5 (New York)</option>
                      <option>GMT+0 (London)</option>
                      <option>GMT+8 (Hong Kong)</option>
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB: TRADING */}
          {activeTab === 'trading' && (
            <>
              {/* Trading Automático */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <Zap className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-lg font-bold text-white">Trading Automático</h2>
                </div>
                
                <div className="space-y-3">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex-1">
                      <span className="text-slate-300 text-sm font-medium">Auto-trade</span>
                      <p className="text-xs text-slate-500">Execução automática de ordens</p>
                    </div>
                    <div className="relative ml-4">
                      <input
                        type="checkbox"
                        checked={autoTrade}
                        onChange={(e) => setAutoTrade(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </div>
                  </label>

                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex-1">
                      <span className="text-slate-300 text-sm font-medium">Stop-Loss automático</span>
                      <p className="text-xs text-slate-500">Adicionar SL em todas ordens</p>
                    </div>
                    <div className="relative ml-4">
                      <input
                        type="checkbox"
                        checked={autoStopLoss}
                        onChange={(e) => setAutoStopLoss(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </div>
                  </label>

                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex-1">
                      <span className="text-slate-300 text-sm font-medium">Take-Profit automático</span>
                      <p className="text-xs text-slate-500">Adicionar TP em todas ordens</p>
                    </div>
                    <div className="relative ml-4">
                      <input
                        type="checkbox"
                        checked={autoTakeProfit}
                        onChange={(e) => setAutoTakeProfit(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Estratégias Ativas */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-lg font-bold text-white">Estratégias Ativas</h2>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                    <div className="flex items-center gap-3 flex-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <div>
                        <p className="text-white text-sm font-medium">Momentum Breakout</p>
                        <p className="text-xs text-slate-400">Win Rate: 68% • Sharpe: 2.1</p>
                      </div>
                    </div>
                    <div className="relative ml-4">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                    <div className="flex items-center gap-3 flex-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <div>
                        <p className="text-white text-sm font-medium">Mean Reversion</p>
                        <p className="text-xs text-slate-400">Win Rate: 72% • Sharpe: 1.8</p>
                      </div>
                    </div>
                    <div className="relative ml-4">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                    <div className="flex items-center gap-3 flex-1">
                      <Activity className="w-4 h-4 text-slate-600 flex-shrink-0" />
                      <div>
                        <p className="text-white text-sm font-medium">Scalping Neural</p>
                        <p className="text-xs text-slate-400">Win Rate: 65% • Sharpe: 1.5</p>
                      </div>
                    </div>
                    <div className="relative ml-4">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB: GESTÃO DE RISCO */}
          {activeTab === 'risk' && (
            <>
              {/* Limites de Risco */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 shadow-lg col-span-1 xl:col-span-2">
                <div className="flex items-center gap-3 mb-4">
                  <Shield className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-lg font-bold text-white">Limites de Risco</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">
                      Perda máxima diária (%)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="1"
                        max="20"
                        value={maxDailyLoss}
                        onChange={(e) => setMaxDailyLoss(e.target.value)}
                        className="flex-1"
                      />
                      <input
                        type="number"
                        value={maxDailyLoss}
                        onChange={(e) => setMaxDailyLoss(e.target.value)}
                        className="w-16 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-sm text-white text-center focus:outline-none focus:border-emerald-500"
                      />
                      <span className="text-slate-400 text-sm">%</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Sistema interrompe ao atingir limite</p>
                  </div>

                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">
                      Tamanho máx. posição (%)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="1"
                        max="50"
                        value={maxPositionSize}
                        onChange={(e) => setMaxPositionSize(e.target.value)}
                        className="flex-1"
                      />
                      <input
                        type="number"
                        value={maxPositionSize}
                        onChange={(e) => setMaxPositionSize(e.target.value)}
                        className="w-16 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-sm text-white text-center focus:outline-none focus:border-emerald-500"
                      />
                      <span className="text-slate-400 text-sm">%</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">% do capital por operação</p>
                  </div>

                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">
                      Alavancagem máxima
                    </label>
                    <select
                      value={leverage}
                      onChange={(e) => setLeverage(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="1">1:1 (Sem alavancagem)</option>
                      <option value="2">1:2</option>
                      <option value="5">1:5</option>
                      <option value="10">1:10</option>
                      <option value="20">1:20</option>
                      <option value="50">1:50</option>
                      <option value="100">1:100</option>
                    </select>
                    <p className="text-xs text-slate-500 mt-1">Alavancagem permitida</p>
                  </div>
                </div>
              </div>

              {/* Sistema de Contenção */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 shadow-lg col-span-1 xl:col-span-2">
                <div className="flex items-center gap-3 mb-4">
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                  <h2 className="text-lg font-bold text-white">Sistema de Contenção Estrutural</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  {[
                    { name: 'Stop-Loss Dinâmico', status: 'Ativa', layer: '1' },
                    { name: 'Trailing Stop', status: 'Ativa', layer: '2' },
                    { name: 'Limite Diário', status: 'Ativa', layer: '3' },
                    { name: 'Circuit Breaker', status: 'Ativa', layer: '4' },
                    { name: 'Kill Switch', status: 'Standby', layer: '5' }
                  ].map((layer) => (
                    <div key={layer.layer} className="p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                      <div className="text-slate-500 text-xs font-semibold mb-1">Camada {layer.layer}</div>
                      <div className="text-white text-sm font-medium mb-1">{layer.name}</div>
                      <span className={`text-xs font-semibold ${
                        layer.status === 'Ativa' ? 'text-emerald-400' : 'text-yellow-400'
                      }`}>
                        {layer.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* TAB: APIs & INTEGRAÇÃO */}
          {activeTab === 'api' && (
            <>
              {/* MetaApi (MT5) */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Server className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h2 className="text-lg font-bold text-white">MetaApi (MT5)</h2>
                      <p className="text-xs text-slate-400">Prioridade #1 • Conexão principal</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-emerald-600/20 text-emerald-400 text-xs font-semibold rounded-full">
                    CONECTADO
                  </span>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-400 text-xs font-semibold uppercase mb-2">
                      API Token
                      {isLoadingToken && (
                        <span className="ml-2 text-blue-400 text-[10px] animate-pulse">🔄 Carregando...</span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        value={metaApiKey}
                        onChange={(e) => setMetaApiKey(e.target.value)}
                        placeholder={isLoadingToken ? "Carregando token..." : "••••••••••••••••••••"}
                        disabled={isLoadingToken}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 pr-20 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 disabled:opacity-50 disabled:cursor-wait"
                      />
                      <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-zinc-800 rounded-lg transition-colors">
                        <Copy className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                    <p className="text-xs text-blue-400 mt-1">
                      🔗 Obtenha seu token em: <a href="https://app.metaapi.cloud/token" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-300">https://app.metaapi.cloud/token</a>
                    </p>
                  </div>

                  <div>
                    <label className="block text-slate-400 text-xs font-semibold uppercase mb-2">Account ID</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={metaApiAccountId}
                        onChange={(e) => setMetaApiAccountId(e.target.value)}
                        placeholder="abc123def456..."
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 pr-20 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                      <button 
                        onClick={handleSaveMetaApiToken}
                        disabled={saveStatus === 'saving'}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-white text-xs font-semibold rounded-lg transition-colors ${
                          saveStatus === 'saving' ? 'bg-gray-600 cursor-not-allowed' :
                          saveStatus === 'success' ? 'bg-green-600' :
                          saveStatus === 'error' ? 'bg-red-600' :
                          'bg-emerald-600 hover:bg-emerald-500'
                        }`}
                      >
                        {saveStatus === 'saving' ? 'Salvando...' : 
                         saveStatus === 'success' ? '✓ Salvo' : 
                         saveStatus === 'error' ? '✗ Erro' : 
                         'Salvar'}
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-emerald-900/20 border border-emerald-800 rounded-lg">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-emerald-300 text-sm font-medium">Conexão ativa</p>
                        <p className="text-xs text-emerald-400/70">Última sincronização: há 2 minutos</p>
                      </div>
                    </div>
                  </div>

                  {/* Botão de limpar cache do token */}
                  <div className="p-3 bg-yellow-900/20 border border-yellow-800/50 rounded-lg">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-yellow-300 text-sm font-medium mb-1">⚙️ Gerenciamento de Cache</p>
                        <p className="text-xs text-yellow-400/70">
                          Se você está tendo problemas com o token, limpe o cache. O sistema usará apenas a variável de ambiente METAAPI_TOKEN.
                        </p>
                      </div>
                      <button
                        onClick={handleClearMetaApiToken}
                        disabled={saveStatus === 'saving'}
                        className="px-3 py-1.5 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-600/50 text-yellow-300 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        🗑️ Limpar Cache
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Trading Economics */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Database className="w-5 h-5 text-blue-400" />
                    <div>
                      <h2 className="text-lg font-bold text-white">Trading Economics</h2>
                      <p className="text-xs text-slate-400">Prioridade #2 • Dados macro</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-blue-600/20 text-blue-400 text-xs font-semibold rounded-full">
                    CONFIGURADO
                  </span>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-400 text-xs font-semibold uppercase mb-2">API Key</label>
                    <div className="relative">
                      <input
                        type="password"
                        value={tradingEconomicsKey}
                        onChange={(e) => setTradingEconomicsKey(e.target.value)}
                        placeholder="••••••••••••••••••••"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 pr-20 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                      <button className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors">
                        Testar
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* S&P Global */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-purple-400" />
                    <div>
                      <h2 className="text-lg font-bold text-white">S&P Global</h2>
                      <p className="text-xs text-slate-400">Prioridade #3 • Dados corporativos</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-zinc-700 text-slate-400 text-xs font-semibold rounded-full">
                    NÃO CONECTADO
                  </span>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-400 text-xs font-semibold uppercase mb-2">API Key</label>
                    <div className="relative">
                      <input
                        type="password"
                        value={spGlobalKey}
                        onChange={(e) => setSpGlobalKey(e.target.value)}
                        placeholder="••••••••••••••••••••"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 pr-20 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                      <button className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg transition-colors">
                        Conectar
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ordem de Prioridade */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <Activity className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-lg font-bold text-white">Ordem de Prioridade</h2>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-3 bg-emerald-900/20 border border-emerald-800 rounded-lg">
                    <span className="text-xl font-bold text-emerald-400 w-6">1</span>
                    <div>
                      <p className="text-white text-sm font-medium">MetaApi (MT5)</p>
                      <p className="text-xs text-emerald-400">Fonte principal em tempo real</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-blue-900/20 border border-blue-800 rounded-lg">
                    <span className="text-xl font-bold text-blue-400 w-6">2</span>
                    <div>
                      <p className="text-white text-sm font-medium">Trading Economics</p>
                      <p className="text-xs text-blue-400">Fallback e dados macro</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-purple-900/20 border border-purple-800 rounded-lg">
                    <span className="text-xl font-bold text-purple-400 w-6">3</span>
                    <div>
                      <p className="text-white text-sm font-medium">S&P Global</p>
                      <p className="text-xs text-purple-400">Dados corporativos</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB: EXIBIÇÃO */}
          {activeTab === 'display' && (
            <>
              {/* Tema */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <Moon className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-lg font-bold text-white">Tema da interface</h2>
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setTheme('dark')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      theme === 'dark'
                        ? 'border-emerald-500 bg-emerald-900/20'
                        : 'border-zinc-700 bg-zinc-900/50 hover:border-zinc-600'
                    }`}
                  >
                    <div className="w-full h-16 bg-slate-900 rounded mb-2"></div>
                    <p className="text-white text-sm font-medium">Escuro</p>
                  </button>

                  <button
                    onClick={() => setTheme('light')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      theme === 'light'
                        ? 'border-emerald-500 bg-emerald-900/20'
                        : 'border-zinc-700 bg-zinc-900/50 hover:border-zinc-600'
                    }`}
                  >
                    <div className="w-full h-16 bg-white rounded mb-2"></div>
                    <p className="text-white text-sm font-medium">Claro</p>
                  </button>

                  <button
                    onClick={() => setTheme('auto')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      theme === 'auto'
                        ? 'border-emerald-500 bg-emerald-900/20'
                        : 'border-zinc-700 bg-zinc-900/50 hover:border-zinc-600'
                    }`}
                  >
                    <div className="w-full h-16 bg-gradient-to-r from-slate-900 to-white rounded mb-2"></div>
                    <p className="text-white text-sm font-medium">Auto</p>
                  </button>
                </div>
              </div>

              {/* Tipo de Gráfico */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <Activity className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-lg font-bold text-white">Tipo de gráfico</h2>
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'candlestick', name: 'Candlestick' },
                    { id: 'line', name: 'Linha' },
                    { id: 'area', name: 'Área' }
                  ].map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setChartType(type.id)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        chartType === type.id
                          ? 'border-emerald-500 bg-emerald-900/20'
                          : 'border-zinc-700 bg-zinc-900/50 hover:border-zinc-600'
                      }`}
                    >
                      <p className="text-white text-sm font-medium">{type.name}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Privacidade */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 shadow-lg col-span-1 xl:col-span-2">
                <div className="flex items-center gap-3 mb-4">
                  <Eye className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-lg font-bold text-white">Privacidade de dados</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="flex items-center justify-between cursor-pointer group p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                    <div className="flex-1">
                      <span className="text-slate-300 text-sm font-medium">Mostrar saldos</span>
                      <p className="text-xs text-slate-500">Valores de carteira e patrimônio</p>
                    </div>
                    <div className="relative ml-4">
                      <input
                        type="checkbox"
                        checked={showBalances}
                        onChange={(e) => setShowBalances(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </div>
                  </label>

                  <label className="flex items-center justify-between cursor-pointer group p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                    <div className="flex-1">
                      <span className="text-slate-300 text-sm font-medium">Mostrar posições</span>
                      <p className="text-xs text-slate-500">Detalhes de trades ativos</p>
                    </div>
                    <div className="relative ml-4">
                      <input
                        type="checkbox"
                        checked={showPositions}
                        onChange={(e) => setShowPositions(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </div>
                  </label>
                </div>
              </div>
            </>
          )}

          {/* TAB: CORRETORAS */}
          {activeTab === 'brokers' && (
            <div className="col-span-1 xl:col-span-2">
              <BrokerConnections />
            </div>
          )}

          {/* TAB: SISTEMA */}
          {activeTab === 'system' && (
            <>
              <div className="col-span-1 xl:col-span-2">
                <div className="bg-gradient-to-br from-cyan-950/30 to-blue-950/20 border-2 border-cyan-800/50 rounded-xl p-6 shadow-xl mb-4">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/30">
                      <Monitor className="w-8 h-8 text-cyan-400" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white tracking-tight">FERRAMENTAS DE SISTEMA</h2>
                      <p className="text-cyan-300/70 text-sm mt-1">
                        Diagnóstico, monitoramento e alertas em tempo real • Polling a cada 10 segundos
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-cyan-900/20 border border-cyan-700/30 rounded-lg p-4">
                      <p className="text-cyan-400 text-xs font-semibold uppercase mb-1">Ativos Monitorados</p>
                      <p className="text-white text-2xl font-bold">300+</p>
                    </div>
                    <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4">
                      <p className="text-blue-400 text-xs font-semibold uppercase mb-1">Update Interval</p>
                      <p className="text-white text-2xl font-bold">10s</p>
                    </div>
                    <div className="bg-purple-900/20 border border-purple-700/30 rounded-lg p-4">
                      <p className="text-purple-400 text-xs font-semibold uppercase mb-1">Fontes de Dados</p>
                      <p className="text-white text-2xl font-bold">5</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ✅ AI Trader Voice - ADICIONADO NA ABA SISTEMA */}
              <div className="col-span-1 xl:col-span-2">
                <VoiceSettings />
              </div>

              {/* Asset Health Monitor */}
              <div className="col-span-1 xl:col-span-2">
                <AssetHealthMonitor />
              </div>

              {/* Mass Asset Diagnostics */}
              <div className="col-span-1 xl:col-span-2">
                <MassAssetDiagnostics />
              </div>

              {/* Data Source Health Dashboard */}
              <div className="col-span-1 xl:col-span-2">
                <DataSourceHealthDashboard />
              </div>

              {/* Alert System Panel */}
              <div className="col-span-1 xl:col-span-2">
                <AlertSystemPanel />
              </div>
            </>
          )}
        </div>

        {/* Botões de Ação - Fixos no bottom */}
        <div className="fixed bottom-20 left-64 right-0 p-4 bg-black/95 border-t border-zinc-800 backdrop-blur-sm z-10">
          <div className="max-w-7xl mx-auto flex gap-3">
            <button 
              onClick={handleSaveSettings}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              Salvar Configurações
            </button>
            <button className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              Resetar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}