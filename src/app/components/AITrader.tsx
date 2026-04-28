import React, { useState, useEffect } from 'react';
import { Bot, Brain, Play, Pause, Settings, TrendingUp, AlertCircle, CheckCircle, CheckCircle2, Activity, Terminal, ShieldAlert, Gauge, Sliders, Target, Crosshair, Zap, Briefcase, Lock, BrainCircuit, X, Save, RefreshCw, RotateCcw, FolderOpen, Clock, Mic } from 'lucide-react';
import { useTradingContext } from '../contexts/TradingContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency, formatNumber } from '@/app/utils/formatters';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { TradingSimulator } from './simulator/TradingSimulator';

import { NeuralLogsEmpty, NeuralPortfolioEmpty } from './dashboard/NeuralEmptyStates';
import { LiveLogTerminal } from './dashboard/LiveLogTerminal';
import { AssetUniverse } from './config/AssetUniverse';
import { VoiceAssistant } from './ai/VoiceAssistant';
import { PositionSizeCalculator } from './tools/PositionSizeCalculator';
import { SessionTimer } from './tools/SessionTimer';
import { EquityChart } from './tools/EquityChart';
import { CurrencyConverter } from './tools/CurrencyConverter';
import { useWorkspaces, WorkspaceSelector, Workspace } from './tools/WorkspaceManager';
import { ResetAccountModal } from './tools/ResetAccountModal';
import { AIToolsControl } from './dashboard/AIToolsControl';
import { SmartScrollContainer } from '@/app/components/SmartScrollContainer';
import { brokerManager } from '@/app/services/brokers/BrokerAdapter';
import { MT5Adapter } from '@/app/services/brokers/MT5Adapter';
import { useMarketData } from '@/app/contexts/MarketDataContext';
import { AITraderVoice } from '@/app/components/modules/AITraderVoice';
import { LiveModeConfirmation } from './trading/LiveModeConfirmation';
import { US30ScalpPreset } from './trading/US30ScalpPreset';
import { AIRecoveryChallenge } from './trading/AIRecoveryChallenge';
import { RecoveryProgressHUD } from './trading/RecoveryProgressHUD';
import { AIActivityMonitor } from './ai/AIActivityMonitor';

type TradingStyle = 'scalping' | 'day-trade' | 'swing';
type Direction = 'AUTO' | 'LONG' | 'SHORT';

export function AITrader({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: (view: string) => void }) {
  console.log('[AI_TRADER] 🤖 v3.1 - AI Trader carregado', { compact, timestamp: Date.now() });
  
  // Mode: 'MONITOR' (Dashboard) | 'ENGINEER' (Configuration) | 'VOICE' (AI Trader Voice) | 'SIMULATOR' (Trading Simulator)
  const [mode, setMode] = useState<'MONITOR' | 'ENGINEER' | 'VOICE' | 'SIMULATOR'>('MONITOR');
  const [showCalculator, setShowCalculator] = useState(false);
  const [showConverter, setShowConverter] = useState(false);
  const [showEquityChart, setShowEquityChart] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false); // ✅ NEW: Premium Reset Modal
  const [showLiveModeConfirmation, setShowLiveModeConfirmation] = useState(false); // 🚨 NEW: Live Mode Confirmation
  const [showRecoveryChallenge, setShowRecoveryChallenge] = useState(false); // 🚀 NEW: AI Recovery Challenge
  const [challengeActive, setChallengeActive] = useState(false); // 🚀 Challenge em andamento
  const [challengeStartTime, setChallengeStartTime] = useState<Date | null>(null);
  const [challengeTargetTime, setChallengeTargetTime] = useState('22:00');
  const [challengeInitialBalance, setChallengeInitialBalance] = useState(0);
  
  // 🆕 MT5 Connection States
  const [showMT5ConfigModal, setShowMT5ConfigModal] = useState(false);
  const [mt5Login, setMt5Login] = useState('');
  const [mt5Password, setMt5Password] = useState('');
  const [mt5Server, setMt5Server] = useState('');
  const [metaApiToken, setMetaApiToken] = useState(''); // 🆕 Token MetaAPI direto no modal
  const [metaApiAccountId, setMetaApiAccountId] = useState(''); // 🆕 ID da conta no MetaAPI (UUID)
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [connectionError, setConnectionError] = useState<string>('');
  
  // 🌐 Market Data Context
  const marketData = useMarketData();
  
  // Workspace Hook
  const { workspaces, saveWorkspace, deleteWorkspace } = useWorkspaces();

  // Force monitor mode if compact
  useEffect(() => {
     if (compact) setMode('MONITOR');
  }, [compact]);

  // 🌐 Sincronizar status de conexão com MarketDataContext
  useEffect(() => {
    setIsConnected(marketData.isConnected);
    setConnectionStatus(marketData.isConnected ? 'connected' : 'disconnected');
  }, [marketData.isConnected]);

  // Use the Global Context for Logic
  const { status, toggleAI, activeOrders, portfolio, recentLogs, config, setConfig, closeHedgedPositions, resetPortfolio, updateBalance, updatePortfolioFromMT5, syncPositionsFromMT5, executionMode, setExecutionMode } = useTradingContext();

  // 🔥 AUTO-SYNC: Quando MT5 conecta, buscar saldo real automaticamente
  useEffect(() => {
    const syncMT5Balance = async () => {
      if (marketData.isConnected && metaApiToken && metaApiAccountId) {
        try {
          console.log('[AITrader] 🔄 MT5 Conectado! Sincronizando saldo automaticamente...');
          const { getMetaAPIClient } = await import('../services/MetaAPIDirectClient');
          const client = getMetaAPIClient(metaApiToken);
          await client.connect(metaApiAccountId);
          const accountInfo = await client.getAccountInfo();
          
          if (accountInfo) {
            console.log('[AITrader] 💰 Saldo MT5 obtido:', accountInfo);
            updatePortfolioFromMT5({
              balance: accountInfo.balance,
              equity: accountInfo.equity || accountInfo.balance
            });
            // ❌ Toast removido - sem banner de sincronização
          }
        } catch (error) {
          console.error('[AITrader] ❌ Erro ao sincronizar saldo MT5:', error);
        }
      }
    };

    syncMT5Balance();
  }, [marketData.isConnected, metaApiToken, metaApiAccountId, updatePortfolioFromMT5]);

  const handleLoadWorkspace = (ws: Workspace) => {
      setConfig(ws.config);
      if (ws.uiPreferences) {
          setShowEquityChart(!!ws.uiPreferences.showEquityChart);
      }
      toast.success(`Workspace "${ws.name}" carregado!`);
  };

  const handleSaveWorkspace = (name: string) => {
      saveWorkspace(name, config, { showEquityChart });
  };

  const toggleAsset = (asset: string) => {
    setConfig(prev => {
      const current = prev.activeAssets || []; // ✅ PROTEÇÃO: Garantir que não seja undefined
      if (current.includes(asset)) {
         if (current.length === 1) {
            toast.error("Mínimo de 1 ativo necessário.");
            return prev;
         }
         return { ...prev, activeAssets: current.filter(a => a !== asset) };
      } else {
         return { ...prev, activeAssets: [...current, asset] };
      }
    });
  };

  // --- OLD PROFILE LOGIC REMOVED (Migrated to WorkspaceManager) ---
  
  // Sync activeAssets with Logic (Implicitly handled by logic monitoring context)
  useEffect(() => {
    // Assets are auto-registered in global context now
  }, [config.activeAssets]);

  // 🔥 NOVO: Carregar Login, Servidor e Token do localStorage ao montar o componente
  useEffect(() => {
    try {
      const savedLogin = localStorage.getItem('mt5_login');
      const savedServer = localStorage.getItem('mt5_server');
      const savedToken = localStorage.getItem('metaapi_token');
      
      if (savedLogin) {
        setMt5Login(savedLogin);
        console.log('[MT5] ✅ Login carregado do localStorage:', savedLogin);
      }
      
      if (savedServer) {
        setMt5Server(savedServer);
        console.log('[MT5] ✅ Servidor carregado do localStorage:', savedServer);
      }

      if (savedToken) {
        setMetaApiToken(savedToken);
        console.log('[MT5] ✅ Token MetaAPI carregado do localStorage:', savedToken.substring(0, 30) + '...');
      }

      // 🆕 Carregar MetaAPI Account ID
      const savedAccountId = localStorage.getItem('metaapi_account_id');
      if (savedAccountId) {
        setMetaApiAccountId(savedAccountId);
        console.log('[MT5] ✅ MetaAPI Account ID carregado:', savedAccountId);
      }
    } catch (error) {
      console.warn('[MT5] ⚠️ Não foi possível carregar credenciais do localStorage:', error);
    }
  }, []); // Executa apenas uma vez ao montar

  // 🔌 MT5 Connection Handlers
  const handleConnectMT5 = async () => {
    if (!mt5Login.trim() || !mt5Password.trim() || !mt5Server.trim()) {
      setConnectionError('Por favor, preencha todos os campos');
      return;
    }

    // 🔥 Validar Token MetaAPI
    if (!metaApiToken.trim()) {
      setConnectionError('❌ Token MetaAPI não configurado. Cole o token no campo abaixo.');
      return;
    }

    if (metaApiToken.length < 100) {
      setConnectionError('❌ Token muito curto - isso parece ser o Login MT5, não o Token MetaAPI!');
      return;
    }

    // 🆕 Validar MetaAPI Account ID
    if (!metaApiAccountId.trim()) {
      setConnectionError('❌ MetaAPI Account ID não configurado. Cole o ID da conta do painel MetaAPI.');
      return;
    }

    // ✅ VALIDAÇÃO MELHORADA - Mensagem MUITO MAIS CLARA
    if (metaApiAccountId.length < 30 || !metaApiAccountId.includes('-')) {
      setConnectionError(
        '❌ ID INVÁLIDO\n\n' +
        '⚠️ VOCÊ COLOCOU O NÚMERO DA CONTA MT5!\n\n' +
        'O campo "MetaAPI Account ID" NÃO é o número 87026945.\n\n' +
        '👉 COMO PEGAR O ID CORRETO:\n' +
        '1. Acesse app.metaapi.cloud/accounts\n' +
        '2. Clique na sua conta MT5\n' +
        '3. Copie o "Account ID" (formato: bb99f865-96fb-4573-98a7-1f32895f84f7)\n' +
        '4. Cole no campo abaixo\n\n' +
        '✅ Exemplo correto: bb99f865-96fb-4573-98a7-1f32895f84f7\n' +
        '❌ Errado: 87026945 (esse é o Login MT5, não o Account ID!)'
      );
      return;
    }

    setConnectionStatus('connecting');
    setConnectionError('');

    try {
      console.log('[MT5] 🔌 Iniciando conexão...');
      console.log('[MT5] 📋 Login MT5:', mt5Login);
      console.log('[MT5] 📋 Servidor:', mt5Server);
      console.log('[MT5] 🆔 MetaAPI Account ID:', metaApiAccountId);
      console.log('[MT5] 🔑 Token length:', metaApiToken.length);
      
      // 💾 SALVAR IMEDIATAMENTE (antes de tentar conectar)
      try {
        localStorage.setItem('mt5_login', mt5Login);
        localStorage.setItem('mt5_server', mt5Server);
        localStorage.setItem('metaapi_token', metaApiToken);
        localStorage.setItem('metaapi_account_id', metaApiAccountId);
        console.log('[MT5] ✅💾 SALVAMENTO IMEDIATO:');
        console.log('[MT5] 💾 Login salvo:', mt5Login);
        console.log('[MT5] 💾 Servidor salvo:', mt5Server);
        console.log('[MT5] 💾 Account ID salvo:', metaApiAccountId);
        console.log('[MT5] 💾 Token salvo (length):', metaApiToken.length);
      } catch (e) {
        console.warn('[MT5] ⚠️ Não foi possível salvar no localStorage:', e);
      }
      
      // 🌐 CONECTAR AO MARKET DATA CONTEXT (GLOBAL)
      console.log('[MT5] 🌐 Conectando ao Market Data Context...');
      toast.info('🌐 Conectando ao MetaAPI...', {
        description: 'Estabelecendo conexão com servidor MT5',
        duration: 5000
      });
      
      const marketDataConnected = await marketData.connect(metaApiToken, metaApiAccountId);
      
      if (!marketDataConnected) {
        throw new Error('Falha ao conectar ao Market Data Context');
      }
      
      console.log('[MT5] ✅ Market Data Context conectado!');
      toast.success('✅ MetaAPI conectado!', {
        description: 'Buscando dados da conta...',
        duration: 3000
      });
      
      // 💰 BUSCAR SALDO REAL E ATUALIZAR PORTFOLIO
      try {
        console.log('[MT5] 💰 Buscando saldo da conta...');
        toast.info('💰 Sincronizando saldo...', {
          description: 'Aguarde, carregando informações da conta',
          duration: 5000
        });
        
        const { getMetaAPIClient } = await import('../services/MetaAPIDirectClient');
        const client = getMetaAPIClient(metaApiToken);
        await client.connect(metaApiAccountId);
        const accountInfo = await client.getAccountInfo();
        
        if (accountInfo) {
          console.log('[MT5] ✅ Saldo obtido:', accountInfo);
          console.log('[MT5] 💵 Balance:', accountInfo.balance);
          console.log('[MT5] 💎 Equity:', accountInfo.equity);
          console.log('[MT5] 💱 Currency:', accountInfo.currency);
          
          // Atualizar portfolio no TradingContext com BALANCE E EQUITY
          updatePortfolioFromMT5({
            balance: accountInfo.balance,
            equity: accountInfo.equity || accountInfo.balance
          });
          console.log('[MT5] ✅ Portfolio atualizado com saldo e equity reais!');
        }
        
        // 📊 BUSCAR POSIÇÕES ABERTAS
        console.log('[MT5] 📊 Buscando posições abertas...');
        const positions = await client.getPositions();
        
        if (positions && positions.length > 0) {
          console.log('[MT5] ✅ Posições encontradas:', positions.length);
          positions.forEach((pos: any) => {
            console.log('[MT5] 📍 Posição:', {
              symbol: pos.symbol,
              type: pos.type,
              volume: pos.volume,
              openPrice: pos.openPrice,
              currentPrice: pos.currentPrice,
              profit: pos.profit
            });
          });
          
          // ✅ SINCRONIZAR POSIÇÕES COM O TRADINGCONTEXT
          console.log('[MT5] 🔄 Sincronizando posições com TradingContext...');
          syncPositionsFromMT5(positions);
        } else {
          console.log('[MT5] ℹ️ Nenhuma posição aberta no MT5');
        }
        
      } catch (balanceError) {
        console.warn('[MT5] ⚠️ Não foi possível carregar dados do MT5:', balanceError);
        console.error('[MT5] 🔍 Detalhes do erro:', balanceError);
        // Não falhar a conexão por causa disso
      }
      
      // ✅ BACKEND REMOVIDO - Conectando apenas via MetaAPI Direct Client
      // A validação VIP do backend estava bloqueando conexões
      console.log('[MT5] ✅ Pulando backend (validação VIP removida)');
      console.log('[MT5] ✅ Usando apenas MetaAPI Direct Client');
      
      // Criar data fake para compatibilidade com código antigo
      const data: any = {
        balance: 0,
        equity: 0
      };
      
      // 🔥 REGISTRAR NO BROKER MANAGER
      const mt5Adapter = new MT5Adapter();
      await mt5Adapter.connect({
        login: mt5Login,
        password: mt5Password,
        server: mt5Server
      });
      
      // Salvar info da conta
      if (data.balance) {
        mt5Adapter.setAccountInfo({ balance: data.balance, equity: data.equity || data.balance });
        updateBalance(data.balance);
      }
      
      // Registrar no manager global
      const adapterId = `mt5_${mt5Login}_${Date.now()}`;
      brokerManager.registerAdapter(adapterId, mt5Adapter);
      brokerManager.setActiveAdapter(adapterId);
      
      console.log('[MT5] ✅ Adapter registrado no BrokerManager:', adapterId);
      
      // (💾 Credenciais já foram salvas no início da função)
      
      // 🎉 SUCESSO TOTAL
      toast.success('✅ MT5 Conectado com Sucesso!', {
        description: `🔗 Conta Real • Login: ${mt5Login} • ${mt5Server} • Dados 100% reais via MetaAPI`,
        duration: 6000
      });
      
      setConnectionStatus('connected');
      setIsConnected(true);
      setShowMT5ConfigModal(false);
      
      console.log('[MT5] ✅ Conexão completa: MetaAPI Direct Client (sem backend)');
    } catch (error: any) {
      console.error('[MT5] ❌ Erro na conexão:', error);
      console.error('[MT5] 🔍 Stack:', error.stack);
      console.error('[MT5] 🔍 Message:', error.message);
      
      // 🎯 Detectar tipos de erros específicos
      const errorMsg = error.message || '';
      let friendlyMsg = 'Erro desconhecido ao conectar.';
      
      // 🔍 DIAGNÓSTICO DETALHADO
      if (errorMsg.includes('Timeout')) {
        friendlyMsg = `⏱️ TIMEOUT - Conta MT5 não respondeu em 30 segundos\n\n` +
          `🔧 POSSÍVEIS CAUSAS:\n` +
          `1. Terminal MT5 está FECHADO (deve estar aberto e logado)\n` +
          `2. Conta no MetaAPI está STOPPED (vá em app.metaapi.cloud e clique em START)\n` +
          `3. Servidor MT5 está offline ou instável\n` +
          `4. Credenciais incorretas\n\n` +
          `💡 TESTE: Abra o MT5 e veja se consegue logar manualmente`;
      } else if (errorMsg.includes('not found') || errorMsg.includes('404')) {
        friendlyMsg = `❌ Conta não encontrada no MetaAPI!\n\n` +
          `🔧 SOLUÇÃO:\n` +
          `1. Acesse: https://app.metaapi.cloud/accounts\n` +
          `2. Verifique se sua conta ${mt5Login} aparece na lista\n` +
          `3. Se não aparecer, clique em "Add Account" e adicione manualmente\n` +
          `4. Aguarde status "DEPLOYED" e "CONNECTED"\n` +
          `5. Copie o Account ID e cole aqui`;
      } else if (errorMsg.includes('VIP') || errorMsg.includes('bloqueado') || errorMsg.includes('Bloqueia')) {
        friendlyMsg = `✅ PROBLEMA CORRIGIDO!\n\nA validação VIP do backend foi removida.\n\nSe ainda vir este erro, recarregue a página (Ctrl+Shift+R) e tente novamente.`;
        console.log('[MT5] ✅ Backend VIP validation bypassed');
      }
      
      setConnectionStatus('error');
      setConnectionError(friendlyMsg);
      
      toast.error('Erro ao conectar', {
        description: friendlyMsg.split('\\n')[0],
        duration: 10000
      });
    }
  };

  const handleDisconnectMT5 = async () => {
    await marketData.disconnect();
    setIsConnected(false);
    setConnectionStatus('disconnected');
    setMt5Password('');
    toast.info('Desconectado do MT5', {
      description: 'Conta MT5 desconectada',
      duration: 2000
    });
  };

  const applyPreset = (preset: 'SCALP' | 'SWING') => {
    if (preset === 'SCALP') {
      setConfig(prev => ({
        ...prev,
        tradingStyle: 'scalping',
        positionSize: 0.01,
        stopLoss: 15,
        takeProfit: 10,
        maxDrawdown: 20,
        riskPerTrade: 2,
        maxOpenTrades: 5,
        direction: 'AUTO',
        aiMode: 'ULTRA_AGGRESSIVE'
      }));
      toast.success('Preset SCALP aplicado!');
    } else if (preset === 'SWING') {
      setConfig(prev => ({
        ...prev,
        tradingStyle: 'swing',
        positionSize: 0.05,
        stopLoss: 100,
        takeProfit: 200,
        maxDrawdown: 30,
        riskPerTrade: 5,
        maxOpenTrades: 3,
        direction: 'AUTO',
        aiMode: 'CONSERVATIVE'
      }));
      toast.success('Preset SWING aplicado!');
    }
  };

  const currentLeverage = portfolio ? (portfolio.openPositionsValue / portfolio.equity) : 0;
  const drawdownPct = portfolio ? portfolio.currentDrawdown : 0;

  // Visual Risk Effect
  const riskOverlayClass = drawdownPct >= config.dailyLossLimit ? "shadow-[inset_0_0_100px_rgba(220,38,38,0.3)] border-red-900/50" : "";

  return (
    <div className={`space-y-6 bg-black min-h-full transition-all duration-500 relative overflow-hidden ${compact ? 'p-4' : 'p-8'} ${riskOverlayClass}`}>
      
      {/* Dynamic Background Grid */}
      <div className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ${mode === 'ENGINEER' ? 'opacity-20' : 'opacity-5'}`}>
         <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
         <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-purple-500 opacity-20 blur-[100px]"></div>
      </div>

      {/* Header */}
      {!compact && (
      <div className="flex items-start gap-4 mb-6 pb-6 border-b border-white/5 relative z-10">
        {/* Icon */}
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/20">
          <Brain className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-white uppercase flex items-center gap-3">
            AI Trader
          </h1>
          <p className="text-slate-400 mt-1 tracking-wide font-light">
            Sistema Autônomo de Trading com IA e Gestão de Risco Avançada
          </p>
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {/* LEFT SIDE - AI Control & MT5 */}
          <div className="flex items-center gap-3">
            {/* START/STOP AI Button */}
            <button
              onClick={toggleAI}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${ 
                status === 'RUNNING' 
                  ? 'bg-emerald-600 border-emerald-500 text-white hover:bg-emerald-700' 
                  : 'bg-purple-600 border-purple-500 text-white hover:bg-purple-700'
              }`}
              title={status === 'RUNNING' ? 'Pausar AI' : 'Iniciar AI'}
            >
              {status === 'RUNNING' ? (
                <>
                  <Pause className="w-4 h-4" /> 
                  <span className="text-xs font-bold uppercase">Pausar AI</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase">Iniciar AI</span>
                </>
              )}
            </button> 

            {/* MT5 Connection Button */}
            <button 
              onClick={() => setShowMT5ConfigModal(true)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                isConnected
                  ? 'bg-green-600 border-green-500 text-white hover:bg-green-700'
                  : 'bg-slate-800 border-white/10 text-slate-300 hover:text-white hover:border-white/20'
              }`}
              title={isConnected ? 'MT5 Conectado' : 'Conectar MT5'}
            >
              <Settings className="w-4 h-4" />
              <span className="text-xs font-bold uppercase">{isConnected ? 'MT5 ON' : 'Conectar MT5'}</span>
              {connectionStatus === 'connecting' && (
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              )}
            </button>

            {/* 🚀 AI RECOVERY CHALLENGE */}
            {executionMode === 'LIVE' && isConnected && (
              <button
                onClick={() => setShowRecoveryChallenge(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-purple-500 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg shadow-purple-500/50"
                title="Iniciar desafio de recuperação com IA ultra-agressiva"
              >
                <Target className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">🚀 Recovery Challenge</span>
              </button>
            )}
          </div>

          {/* Spacer to push right side buttons */}
          <div className="flex-1"></div>

          {/* RIGHT SIDE - Workspace & Settings */}
          <div className="flex items-center gap-3">
            {/* Workspace Selector */}
            <WorkspaceSelector
              workspaces={workspaces}
              currentConfig={config}
              onLoad={handleLoadWorkspace}
              onSave={handleSaveWorkspace}
              onDelete={deleteWorkspace}
            />

            {/* 🚨 LIVE MODE TOGGLE - Movido para o lado direito */}
            <button
              onClick={() => {
                if (executionMode === 'DEMO') {
                  setShowLiveModeConfirmation(true);
                } else {
                  // Desativar modo LIVE e resetar para DEMO
                  setExecutionMode('DEMO');
                  
                  // 🔄 RESET SALDO DEMO: Voltar para $100 default
                  resetPortfolio(100);
                  
                  // Salvar no localStorage
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('neural_execution_mode', 'DEMO');
                  }
                  
                  toast.info('🟢 Modo DEMO ativado', {
                    description: 'Voltou para negociação simulada | Saldo resetado: $100'
                  });
                }
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all font-bold ${
                executionMode === 'LIVE'
                  ? 'bg-gradient-to-r from-red-600 to-red-700 border-red-500 text-white shadow-lg shadow-red-500/50 animate-pulse'
                  : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-gray-500'
              }`}
              title={executionMode === 'LIVE' ? 'Clique para voltar ao modo DEMO' : 'Clique para ativar negociação real'}
            >
              {executionMode === 'LIVE' ? (
                <>
                  <div className="w-2 h-2 bg-red-300 rounded-full animate-pulse"></div>
                  <span className="text-xs uppercase tracking-wider">🔴 MODO REAL</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-wider">MODO DEMO</span>
                </>
              )}
            </button>

            {/* AI Trading Engine Button - NOVO */}
            <button
              onClick={() => onNavigate?.('ai-engine')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all font-bold border-purple-500/30 bg-purple-500/10 text-purple-400 hover:text-white hover:border-purple-500/50 hover:bg-purple-500/20 hover:shadow-lg hover:shadow-purple-500/20"
              title="Abrir AI Trading Engine"
            >
              <BrainCircuit className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider">AI Engine</span>
            </button>

            {/* Configuration Button - Icon Only */}
            <button
              onClick={() => setMode(mode === 'ENGINEER' ? 'MONITOR' : 'ENGINEER')}
              className={`p-3 rounded-lg border transition-all ${
                mode === 'ENGINEER'
                  ? 'bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-500/30'
                  : 'border-white/10 text-slate-400 hover:text-white hover:border-white/20'
              }`}
              title={mode === 'ENGINEER' ? 'Voltar ao Monitor' : 'Configuração do AI'}
            >
              <Sliders className="w-5 h-5" />
            </button>

            {/* AI Voice Button - Icon Only */}
            <button
              onClick={() => setMode(mode === 'VOICE' ? 'MONITOR' : 'VOICE')}
              className={`p-3 rounded-lg border transition-all ${
                mode === 'VOICE'
                  ? 'bg-cyan-600 border-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                  : 'border-white/10 text-slate-400 hover:text-white hover:border-white/20'
              }`}
              title={mode === 'VOICE' ? 'Voltar ao Monitor' : 'AI Trader Voice'}
            >
              <Mic className="w-5 h-5" />
            </button>

            {/* Simulator Button - Icon Only */}
            <button
              onClick={() => setMode(mode === 'SIMULATOR' ? 'MONITOR' : 'SIMULATOR')}
              className={`p-3 rounded-lg border transition-all ${
                mode === 'SIMULATOR'
                  ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/30'
                  : 'border-white/10 text-slate-400 hover:text-white hover:border-white/20'
              }`}
              title={mode === 'SIMULATOR' ? 'Voltar ao Monitor' : 'Simulador de Trading'}
            >
              <Target className="w-5 h-5" />
            </button>

            {/* Reset Button - Icon Only */}
            <button
              onClick={() => setShowResetModal(true)}
              className="p-3 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 transition-all"
              title="Zerar Plataforma"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      )}

      {/* 🔥 AI STATUS BANNER - Mostra quando a IA está ativa */}
      {!compact && status === 'running' && mode === 'MONITOR' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="mb-4 relative overflow-hidden"
        >
          <div className="bg-gradient-to-r from-purple-950/40 via-purple-900/40 to-purple-950/40 border border-purple-500/30 rounded-xl p-4">
            {/* Animated Background */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/10 to-transparent animate-[shimmer_2s_infinite]" />
            
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse shadow-lg shadow-purple-500/50" />
                <div>
                  <div className="text-sm font-bold text-purple-400 uppercase tracking-wide">
                    🤖 AI Trader Ativa
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Analisando mercado • Procurando oportunidades • Gestão automática de risco
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-4 text-xs">
                <div className="text-slate-400">
                  <span className="text-white font-semibold">{activeOrders.length}</span> / {config.maxPositions} posições
                </div>
                <div className="text-slate-400">
                  Modo: <span className="text-white font-semibold">{executionMode}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ACTIVE PORTFOLIO ROW (MOVED HERE) */}
      {!compact && mode === 'MONITOR' && (
        <div className="mb-6 space-y-6">
             {/* EQUITY CHART (Collapsible) */}
             <AnimatePresence>
                {showEquityChart && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <EquityChart />
                    </motion.div>
                )}
             </AnimatePresence>

             {/* ✅ REMOVIDO: AI Tools Control movido para DENTRO do modo MONITOR */}

             {activeOrders.length > 0 ? (
               <>
                {/* 💎 CAPITAL LÍQUIDO EM ABERTO - HUD */}
                <div className="p-4 rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-900/20 to-blue-900/20 backdrop-blur-sm shadow-lg shadow-cyan-500/10">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {/* Total P&L não realizado */}
                    <div className="flex flex-col">
                      <span className="text-xs text-cyan-400/70 uppercase tracking-wider font-bold mb-2">P&L Não Realizado</span>
                      <span className={`text-2xl font-bold font-mono ${
                        activeOrders.reduce((total, order) => {
                          const currentPrice = order.currentPrice || order.price;
                          const priceDiffPct = (currentPrice - order.price) / order.price;
                          const rawPnL = (order.side === 'LONG' ? priceDiffPct : -priceDiffPct) * order.leverage;
                          const pnlValue = (order.amount || 0) * rawPnL;
                          return total + pnlValue;
                        }, 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {activeOrders.reduce((total, order) => {
                          const currentPrice = order.currentPrice || order.price;
                          const priceDiffPct = (currentPrice - order.price) / order.price;
                          const rawPnL = (order.side === 'LONG' ? priceDiffPct : -priceDiffPct) * order.leverage;
                          const pnlValue = (order.amount || 0) * rawPnL;
                          return total + pnlValue;
                        }, 0) >= 0 ? '+' : ''}${activeOrders.reduce((total, order) => {
                          const currentPrice = order.currentPrice || order.price;
                          const priceDiffPct = (currentPrice - order.price) / order.price;
                          const rawPnL = (order.side === 'LONG' ? priceDiffPct : -priceDiffPct) * order.leverage;
                          const pnlValue = (order.amount || 0) * rawPnL;
                          return total + pnlValue;
                        }, 0).toFixed(2)}
                      </span>
                      <span className={`text-xs font-mono mt-1 ${
                        activeOrders.reduce((total, order) => {
                          const currentPrice = order.currentPrice || order.price;
                          const priceDiffPct = (currentPrice - order.price) / order.price;
                          const rawPnL = (order.side === 'LONG' ? priceDiffPct : -priceDiffPct) * order.leverage;
                          return total + rawPnL;
                        }, 0) >= 0 ? 'text-emerald-400/60' : 'text-red-400/60'
                      }`}>
                        {activeOrders.reduce((total, order) => {
                          const currentPrice = order.currentPrice || order.price;
                          const priceDiffPct = (currentPrice - order.price) / order.price;
                          const rawPnL = (order.side === 'LONG' ? priceDiffPct : -priceDiffPct) * order.leverage;
                          return total + rawPnL;
                        }, 0) >= 0 ? '+' : ''}{(activeOrders.reduce((total, order) => {
                          const currentPrice = order.currentPrice || order.price;
                          const priceDiffPct = (currentPrice - order.price) / order.price;
                          const rawPnL = (order.side === 'LONG' ? priceDiffPct : -priceDiffPct) * order.leverage;
                          return total + rawPnL;
                        }, 0) * 100).toFixed(2)}%
                      </span>
                    </div>

                    {/* Capital em Aberto (Margem) */}
                    <div className="flex flex-col">
                      <span className="text-xs text-cyan-400/70 uppercase tracking-wider font-bold mb-2">Capital em Aberto</span>
                      <span className="text-2xl font-bold text-white font-mono">
                        ${activeOrders.reduce((total, order) => total + (order.amount || 0), 0).toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-400/60 font-mono mt-1">Margem investida</span>
                    </div>

                    {/* Operações Abertas */}
                    <div className="flex flex-col">
                      <span className="text-xs text-cyan-400/70 uppercase tracking-wider font-bold mb-2">Operações Abertas</span>
                      <span className="text-2xl font-bold text-white font-mono">{activeOrders.length}</span>
                      <span className="text-xs text-slate-400/60 font-mono mt-1">
                        {activeOrders.filter(o => o.side === 'LONG').length} LONG · {activeOrders.filter(o => o.side === 'SHORT').length} SHORT
                      </span>
                    </div>

                    {/* Equity Projetado */}
                    <div className="flex flex-col">
                      <span className="text-xs text-cyan-400/70 uppercase tracking-wider font-bold mb-2">Equity Projetado</span>
                      <span className={`text-2xl font-bold font-mono ${
                        (portfolio?.equity || 0) + activeOrders.reduce((total, order) => {
                          const currentPrice = order.currentPrice || order.price;
                          const priceDiffPct = (currentPrice - order.price) / order.price;
                          const rawPnL = (order.side === 'LONG' ? priceDiffPct : -priceDiffPct) * order.leverage;
                          const pnlValue = (order.amount || 0) * rawPnL;
                          return total + pnlValue;
                        }, 0) >= (portfolio?.equity || 0) ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        ${((portfolio?.equity || 0) + activeOrders.reduce((total, order) => {
                          const currentPrice = order.currentPrice || order.price;
                          const priceDiffPct = (currentPrice - order.price) / order.price;
                          const rawPnL = (order.side === 'LONG' ? priceDiffPct : -priceDiffPct) * order.leverage;
                          const pnlValue = (order.amount || 0) * rawPnL;
                          return total + pnlValue;
                        }, 0)).toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-400/60 font-mono mt-1">Se fechar agora</span>
                    </div>
                  </div>
                </div>

                {/* Grid de Operações */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                    {activeOrders.map(order => {
                        const currentPrice = order.currentPrice || order.price;
                        const priceDiffPct = (currentPrice - order.price) / order.price;
                        // Calculate Real PnL based on leverage
                        const rawPnLPercent = (order.side === 'LONG' ? priceDiffPct : -priceDiffPct) * order.leverage * 100;
                        const pnlPercent = (rawPnLPercent || 0).toFixed(2);
                        const isPositive = (rawPnLPercent || 0) >= 0;
                        // P&L em USD = margem investida * (percentual / 100)
                        const pnlValue = ((order.amount || 0) * ((rawPnLPercent || 0) / 100)).toFixed(2);
                        
                        // 🔍 DEBUG: Log para verificar valores
                        console.log(`[P&L DEBUG] ${order.symbol}:`, {
                            entryPrice: order.price,
                            currentPrice,
                            side: order.side,
                            marginInvested: order.amount,
                            leverage: order.leverage,
                            priceDiff: ((currentPrice - order.price) / order.price * 100).toFixed(2) + '%',
                            pnlPercent: pnlPercent + '%',
                            pnlUSD: pnlValue
                        });

                        return (
                        <div key={order.id} className="p-4 bg-neutral-900/50 border border-white/10 rounded-xl flex items-center justify-between group hover:border-white/20 transition-all shadow-lg shadow-black/20 hover:shadow-purple-900/10 hover:-translate-y-1 relative overflow-hidden">
                            {/* Status Bar */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${order.side === 'LONG' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                    {order.side === 'LONG' ? 'COMPRADO' : 'VENDIDO'}
                                </span>
                                <span className="font-bold text-white text-sm">{order.symbol.replace('USDT', '/USD')}</span>
                                {/* 🎯 NEW: Contract Count Badge */}
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                    {order.amount} {order.amount === 1 ? 'contrato' : 'contratos'}
                                </span>
                                </div>
                                <div className="flex gap-3 text-[10px] text-slate-500 font-mono">
                                    <span>Entry: ${(order.price || 0).toFixed(2)}</span>
                                    <span>Lev: {(order.leverage || 0).toFixed(1)}x</span>
                                </div>
                            </div>
                            <div className="text-right z-10">
                                <div className={`${isPositive ? 'text-emerald-400' : 'text-red-400'} font-bold font-mono text-lg leading-none mb-1`}>
                                    {isPositive ? '+' : ''}{pnlPercent}%
                                </div>
                                <div className={`text-[10px] uppercase tracking-wider font-mono ${isPositive ? 'text-emerald-500/60' : 'text-red-500/60'}`}>
                                    {isPositive ? '+' : ''}${pnlValue}
                                </div>
                            </div>
                            
                            {/* Background Glow */}
                            <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-24 h-24 blur-3xl opacity-10 pointer-events-none ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        </div>
                        );
                    })}
                </div>
               </>
             ) : (
                  // ✅ SÓ MOSTRA "Aguardando sinais" SE A IA ESTIVER ATIVA (RUNNING)
                  status === 'running' && (
                      <div className="p-4 rounded-xl border border-dashed border-white/10 bg-white/[0.02] flex items-center justify-center gap-3 text-slate-600">
                         <Activity className="w-4 h-4 opacity-50" />
                         <span className="text-xs font-mono uppercase tracking-widest opacity-70">Aguardando sinais de entrada...</span>
                      </div>
                  )
             )}
        </div>
      )}

      {/* Main Content Grid Layout - Horizontal Orientation */}
      <div className={`grid gap-6 ${compact ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-4'}`}>
        
        {/* Left/Center Column (Main Visual Area) */}
        <div className={`${compact ? 'col-span-1' : 'lg:col-span-3'} flex flex-col relative`}>
            <AnimatePresence mode="wait">
                {/* MODE: MONITOR (DASHBOARD) */}
                {mode === 'MONITOR' ? (
                    <motion.div 
                        key="monitor"
                        initial={{ opacity: 0, x: -20, filter: 'blur(10px)' }}
                        animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, x: 20, filter: 'blur(10px)' }}
                        transition={{ duration: 0.4, ease: "anticipate" }}
                        className={`grid gap-4 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'}`}
                    >
                        {/* 1. Equity & Status */}
                        <div className={`p-4 rounded-xl border flex flex-col justify-between transition-all duration-500 ${
                            status === 'running' ? 'bg-emerald-900/10 border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]' : 'bg-neutral-950 border-white/5'
                        }`}>
                            <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Patrimônio Total</h3>
                            {status === 'running' && <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />}
                            </div>
                            <div className="mt-auto">
                            <p className="text-4xl font-bold text-white tracking-tight">
                                ${formatNumber(portfolio?.equity, 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            <p className="text-xs text-slate-500 mt-2 font-mono flex items-center gap-2">
                                {marketData.isConnected ? (
                                    <><span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span> SALDO REAL MT5</>
                                ) : status === 'running' ? (
                                    <><span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> EM EXECUÇÃO (DEMO)</>
                                ) : (
                                    <><span className="w-2 h-2 bg-slate-600 rounded-full"></span> SISTEMA EM ESPERA (DEMO)</>
                                )}
                            </p>
                            </div>
                        </div>

                        {/* 2. Drawdown Thermometer */}
                        <div className="p-4 rounded-xl border border-white/5 bg-neutral-950 relative overflow-hidden group flex flex-col justify-between">
                            <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <ShieldAlert className="w-4 h-4" /> Termômetro de Risco
                            </h3>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                drawdownPct >= config.dailyLossLimit ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-800 text-slate-300'
                            }`}>
                                {(drawdownPct || 0).toFixed(2)}% / {(config.dailyLossLimit || 0).toFixed(2)}%
                            </span>
                            </div>
                            
                            <div className="mt-auto">
                                <div className="h-4 bg-slate-800 rounded-full overflow-hidden relative shadow-inner mb-3">
                                    <div 
                                        className={`h-full transition-all duration-1000 ${
                                            drawdownPct >= (config.dailyLossLimit - 0.5) ? 'bg-red-600 animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.8)]' : 
                                            drawdownPct >= (config.dailyLossLimit / 2) ? 'bg-amber-500' :
                                            drawdownPct >= 0.5 ? 'bg-yellow-400' : 'bg-emerald-500'
                                        }`}
                                        style={{ width: `${Math.min((drawdownPct / config.dailyLossLimit) * 100, 100)}%` }}
                                    />
                                    {/* Limite Marcador */}
                                    <div className="absolute top-0 bottom-0 right-0 w-0.5 bg-red-500 z-10 shadow-[0_0_10px_red]"></div>
                                </div>
                                <p className="text-[10px] text-slate-500 text-right">
                                    {drawdownPct >= config.dailyLossLimit ? '⛔ NEGOCIAÇÃO BLOQUEADA PELO GESTOR DE RISCO' : `Hard Stop Diário: ${config.dailyLossLimit}%`}
                                </p>
                            </div>
                        </div>

                        {/* 3. AI Autonomy Gauge */}
                        <div className={`p-4 rounded-xl border bg-neutral-950 relative overflow-hidden border-white/5 flex flex-col justify-between`}>
                            <div className="flex items-center justify-between mb-4 relative z-10">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Gauge className="w-4 h-4" /> Autonomia da IA
                            </h3>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20`}>
                                ALTA
                            </span>
                            </div>

                            <div className="space-y-4 mt-auto">
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-slate-500 uppercase font-bold">
                                        <span>Alavancagem Dinâmica</span>
                                        <span className="text-white">AUTO</span>
                                    </div>
                                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-purple-500 w-3/4 animate-[pulse_3s_infinite]" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-slate-500 uppercase font-bold">
                                        <span>Gestão de Lote</span>
                                        <span className="text-white">MAX 1</span>
                                    </div>
                                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500 w-1/2 animate-[pulse_4s_infinite]" />
                                    </div>
                                </div>
                            </div>
                            <p className="text-[9px] text-slate-600 mt-4 text-center border-t border-white/5 pt-2">
                                * A IA ajusta a alavancagem para proteger o capital
                            </p>
                        </div>

                        {/* 🧠 AI TOOLS CONTROL PANEL - Logo abaixo de Patrimônio Total */}
                        <div className="col-span-1 md:col-span-3">
                            <AIToolsControl />
                        </div>

                        {/* 🔥 AI Activity Monitor - Mostra o que a IA está fazendo */}
                        {status === 'running' && (
                          <div className="col-span-1 md:col-span-3 mt-2">
                            <AIActivityMonitor />
                          </div>
                        )}

                        {/* 4. Live Execution Terminal */}
                        <div className="col-span-1 md:col-span-3 mt-2">
                            <LiveLogTerminal />
                        </div>
                    </motion.div>
                ) : mode === 'VOICE' ? (
                    /* MODE: VOICE (AI TRADER VOICE) */
                    <motion.div
                        key="voice"
                        initial={{ opacity: 0, scale: 0.98, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: 20 }}
                        transition={{ duration: 0.4, type: "spring", bounce: 0.3 }}
                        className="bg-neutral-900/80 border border-cyan-500/30 rounded-xl backdrop-blur-xl shadow-2xl relative h-full overflow-y-auto"
                    >
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-cyan-500 animate-gradient-x"></div>
                        
                        {/* AI Trader Voice Component */}
                        <div className="p-6">
                          <AITraderVoice embedded={true} />
                        </div>
                    </motion.div>
                ) : mode === 'SIMULATOR' ? (
                    /* MODE: SIMULATOR (TRADING SIMULATOR) */
                    <motion.div
                        key="simulator"
                        initial={{ opacity: 0, scale: 0.98, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: 20 }}
                        transition={{ duration: 0.4, type: "spring", bounce: 0.3 }}
                        className="bg-neutral-900/80 border border-blue-500/30 rounded-xl backdrop-blur-xl shadow-2xl relative h-full overflow-y-auto"
                    >
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-500 animate-gradient-x"></div>
                        
                        {/* Trading Simulator Component */}
                        <div className="p-6">
                          <TradingSimulator 
                            symbol={config.activeAssets?.[0] || 'BTCUSDT'} 
                            currentPrice={portfolio?.lastPrice || 0}
                          />
                        </div>
                    </motion.div>
                ) : (
                    /* MODE: ENGINEER (SETTINGS) */
                    <motion.div
                        key="engineer"
                        initial={{ opacity: 0, scale: 0.98, x: -20 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.98, x: -20 }}
                        transition={{ duration: 0.4, type: "spring", bounce: 0.3 }}
                        className="bg-neutral-900/80 border border-purple-500/30 rounded-xl p-6 backdrop-blur-xl shadow-2xl relative h-full overflow-y-auto"
                    >
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500 animate-gradient-x"></div>
                        
                        {/* Voice Assistant Embedded */}
                        <div className="mb-6">
                           <VoiceAssistant embedded={true} />
                        </div>

                        <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Sliders className="w-5 h-5 text-purple-400" /> Configurações Operacionais da IA
                            </h2>
                            <div className="flex gap-2">
                            <button onClick={() => applyPreset('SCALP')} className="px-3 py-1 text-xs font-bold bg-white/5 hover:bg-white/10 rounded border border-white/10 text-slate-300 transition-all hover:border-purple-500/50">Preset: Scalping</button>
                            <button onClick={() => applyPreset('SWING')} className="px-3 py-1 text-xs font-bold bg-white/5 hover:bg-white/10 rounded border border-white/10 text-slate-300 transition-all hover:border-blue-500/50">Preset: Swing</button>
                            </div>
                        </div>

                        {/* OLD PROFILE UI REPLACED BY WORKSPACE SELECTOR IN HEADER */}
                        
                        {/* 🎯 US30 SCALPING PRESET */}
                        <div className="mb-6">
                            <US30ScalpPreset onApply={(presetConfig) => {
                                setConfig(prev => ({ ...prev, ...presetConfig }));
                            }} />
                        </div>
                        
                        {/* ASSET UNIVERSE SELECTOR */}
                        <div className="mb-8">
                            <AssetUniverse selectedAssets={config.activeAssets} onToggle={toggleAsset} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {/* COLUMN 1: ESTRATÉGIA */}
                            <div className="space-y-6">
                            <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                                <Target className="w-4 h-4" /> Estratégia
                            </h3>

                            {/* Timeframe Selector (NEW) */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2">
                                    <Clock className="w-3 h-3" /> Timeframe Operacional
                                </label>
                                <div className="grid grid-cols-5 gap-1.5">
                                    {['1m', '5m', '15m', '1H', '4H'].map(tf => (
                                        <button
                                            key={tf}
                                            onClick={() => setConfig(prev => ({ ...prev, timeframe: tf }))}
                                            className={`px-1 py-1.5 rounded text-[10px] font-bold border transition-all ${
                                                config.timeframe === tf 
                                                ? 'bg-purple-500/20 border-purple-500 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.2)]' 
                                                : 'bg-white/5 border-transparent text-slate-500 hover:text-white hover:bg-white/10'
                                            }`}
                                        >
                                            {tf}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Market Mode (Trend vs Counter) */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Fluxo de Operação</label>
                                <div className="flex gap-2 p-1 bg-black rounded-lg border border-white/10">
                                <button
                                    onClick={() => setConfig({ ...config, marketMode: 'TREND' })}
                                    className={`flex-1 py-2 rounded text-[10px] font-bold transition-colors ${
                                    config.marketMode === 'TREND'
                                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                                        : 'text-slate-500 hover:text-slate-300'
                                    }`}
                                >
                                    A Favor (Trend)
                                </button>
                                <button
                                    onClick={() => setConfig({ ...config, marketMode: 'COUNTER' })}
                                    className={`flex-1 py-2 rounded text-[10px] font-bold transition-colors ${
                                    config.marketMode === 'COUNTER'
                                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                                        : 'text-slate-500 hover:text-slate-300'
                                    }`}
                                >
                                    Contra (Reversal)
                                </button>
                                </div>
                                {config.marketMode === 'COUNTER' ? (
                                    <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-amber-500/5 border border-amber-500/10 rounded text-[9px] text-amber-500/80 animate-in fade-in slide-in-from-top-1">
                                        <Crosshair className="w-3 h-3" />
                                        <span>A IA buscará entradas em <strong>Suportes e Resistências</strong> Majoritários.</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-blue-500/5 border border-blue-500/10 rounded text-[9px] text-blue-500/80 animate-in fade-in slide-in-from-top-1">
                                        <TrendingUp className="w-3 h-3" />
                                        <span>A IA seguirá o fluxo de <strong>Momentum e Estrutura</strong> do mercado.</span>
                                    </div>
                                )}
                            </div>
                            
                            {/* Direction */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Direção Preferencial</label>
                                <div className="flex gap-2 p-1 bg-black rounded-lg border border-white/10">
                                {['AUTO', 'LONG', 'SHORT'].map(dir => (
                                    <button
                                    key={dir}
                                    onClick={() => setConfig({ ...config, direction: dir as Direction })}
                                    className={`flex-1 py-2 rounded text-[10px] font-bold transition-colors ${
                                        config.direction === dir 
                                        ? dir === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : dir === 'SHORT' ? 'bg-red-500/20 text-red-400' : 'bg-purple-500/20 text-purple-400'
                                        : 'text-slate-500 hover:text-slate-300'
                                    }`}
                                    >
                                    {dir === 'AUTO' ? 'AUTOMÁTICO' : dir === 'LONG' ? 'COMPRADO' : 'VENDIDO'}
                                    </button>
                                ))}
                                </div>
                            </div>

                            {/* Target Points */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Alvo de Lucro (Range)</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['POUCOS', 'MÉDIO', 'MUITOS'].map(opt => (
                                    <button
                                    key={opt}
                                    onClick={() => setConfig({ ...config, targetPoints: opt })}
                                    className={`py-2 rounded border text-[10px] font-bold transition-colors ${
                                        config.targetPoints === opt ? 'border-purple-500 text-purple-400 bg-purple-500/10' : 'border-white/10 text-slate-500 hover:border-white/20'
                                    }`}
                                    >
                                        {opt}
                                    </button>
                                    ))}
                                </div>
                            </div>

                                {/* Stop Loss Mode */}
                                <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Modo Stop Loss</label>
                                <div className="flex gap-2">
                                    <button 
                                    onClick={() => setConfig({ ...config, stopLossMode: 'FIXO' })}
                                    className={`flex-1 py-2 rounded border text-[10px] font-bold ${config.stopLossMode === 'FIXO' ? 'bg-white/10 border-white text-white' : 'border-white/10 text-slate-500'}`}
                                    >
                                    Fixo (%)
                                    </button>
                                    <button 
                                    onClick={() => setConfig({ ...config, stopLossMode: 'DINAMICO' })}
                                    className={`flex-1 py-2 rounded border text-[10px] font-bold ${config.stopLossMode === 'DINAMICO' ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'border-white/10 text-slate-500'}`}
                                    >
                                    Dinâmico (AI/SMC)
                                    </button>
                                </div>
                            </div>
                            </div>

                            {/* COLUMN 2: VOLUMETRIA (Contracts/Assets) */}
                            <div className="space-y-6">
                            <h3 className="text-xs font-bold text-blue-500 uppercase tracking-widest flex items-center gap-2">
                                <Briefcase className="w-4 h-4" /> Gestão de Volumetria
                            </h3>

                            {/* Allocated Capital (Smart Wallet Link) */}
                            <div className="p-3 bg-neutral-900 border border-white/10 rounded-lg space-y-3">
                                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                    <label className="text-[10px] font-bold text-blue-400 uppercase flex items-center gap-2">
                                        <Zap className="w-3 h-3" /> Capital para IA
                                    </label>
                                    <span className="text-[10px] font-mono text-slate-500">
                                        Disponível: <span className="text-white">${formatNumber(portfolio?.balance, 0)}</span>
                                    </span>
                                </div>
                                
                                <div className="flex gap-2 items-center">
                                    <div className="relative flex-1">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
                                        <input 
                                            type="number"
                                            value={config.allocatedCapital}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value);
                                                // Allow typing but clamp on blur or visual validation
                                                setConfig({ ...config, allocatedCapital: val });
                                            }}
                                            onBlur={(e) => {
                                                const val = parseFloat(e.target.value);
                                                const max = portfolio?.balance || 100; 
                                                if (val > max) {
                                                    setConfig({ ...config, allocatedCapital: max });
                                                    toast.error(`Valor limitado ao saldo disponível: $${max}`);
                                                } else if (val < 0) {
                                                    setConfig({ ...config, allocatedCapital: 0 });
                                                }
                                            }}
                                            className="w-full bg-black border border-white/10 rounded px-3 pl-6 py-1.5 text-sm font-mono text-white focus:border-blue-500 focus:outline-none"
                                        />
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                                            <span className="text-[9px] text-emerald-500 bg-emerald-500/10 px-1 rounded border border-emerald-500/20 font-mono">10x LEV</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex gap-1">
                                    {[25, 50, 75, 100].map(pct => (
                                        <button
                                            key={pct}
                                            onClick={() => {
                                                const balance = portfolio?.balance || 100; // Fallback mock
                                                setConfig({ ...config, allocatedCapital: Math.floor(balance * (pct / 100)) });
                                            }}
                                            className="flex-1 py-1 rounded bg-white/5 hover:bg-white/10 text-[9px] font-bold text-slate-400 hover:text-white transition-colors border border-transparent hover:border-white/10"
                                        >
                                            {pct === 100 ? 'MAX' : `${pct}%`}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Max Contracts */}
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Lotes Máximos por Trade</label>
                                    <span className="text-xs font-mono text-white">{(config.maxContracts || 0).toFixed(1)}</span>
                                </div>
                                <input 
                                type="range" 
                                min="0.1" 
                                max="10.0" 
                                step="0.1"
                                value={config.maxContracts} 
                                onChange={(e) => setConfig({ ...config, maxContracts: parseFloat(e.target.value) })}
                                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                />
                                <p className="text-[9px] text-slate-500">A IA ajustará a alavancagem automaticamente para encaixar este tamanho.</p>
                            </div>

                            {/* Max Positions */}
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Máximo de Posições Abertas</label>
                                    <span className="text-xs font-mono text-white">{config.maxPositions}</span>
                                </div>
                                <input 
                                type="range" 
                                min="1" 
                                max="10" 
                                step="1"
                                value={config.maxPositions} 
                                onChange={(e) => setConfig({ ...config, maxPositions: parseInt(e.target.value) })}
                                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                />
                            </div>

                            {/* Max Simultaneous Assets */}
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Ativos Simultâneos</label>
                                    <span className="text-xs font-mono text-white">{config.maxAssets}</span>
                                </div>
                                <input 
                                type="range" 
                                min="1" 
                                max="5" 
                                step="1"
                                value={config.maxAssets} 
                                onChange={(e) => setConfig({ ...config, maxAssets: parseInt(e.target.value) })}
                                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                />
                                <p className="text-[9px] text-slate-500">Ex: Operar BTC e ETH ao mesmo tempo = 2.</p>
                            </div>
                            </div>

                            {/* COLUMN 3: PROTEÇÃO (Risk/News) */}
                            <div className="space-y-6">
                            <h3 className="text-xs font-bold text-red-500 uppercase tracking-widest flex items-center gap-2">
                                <Lock className="w-4 h-4" /> Proteção e Risco
                            </h3>

                            {/* Daily Loss Limit */}
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Limite de Perda Diária (%)</label>
                                    <span className="text-xs font-mono text-red-400">{(config.dailyLossLimit || 0).toFixed(1)}%</span>
                                </div>
                                <input 
                                type="range" 
                                min="0.5" 
                                max="5.0" 
                                step="0.1"
                                value={config.dailyLossLimit} 
                                onChange={(e) => setConfig({ ...config, dailyLossLimit: parseFloat(e.target.value) })}
                                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500"
                                />
                                <p className="text-[9px] text-slate-500">O sistema entra em "Lockdown" se atingir este limite.</p>
                            </div>

                            {/* News Filter */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Filtro de Notícias (Economic Calendar)</label>
                                <div className="flex items-center gap-3 p-3 bg-black border border-white/10 rounded-lg">
                                    <Zap className={`w-4 h-4 ${config.newsFilter ? 'text-yellow-500' : 'text-slate-600'}`} />
                                    <div className="flex-1">
                                    <span className="text-xs font-bold text-white block">Evitar Alta Volatilidade</span>
                                    <span className="text-[9px] text-slate-500">Pausar durante Payroll/FOMC</span>
                                    </div>
                                    <button 
                                    onClick={() => setConfig({ ...config, newsFilter: !config.newsFilter })}
                                    className={`w-10 h-5 rounded-full relative transition-colors ${config.newsFilter ? 'bg-emerald-500' : 'bg-slate-700'}`}
                                    >
                                    <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${config.newsFilter ? 'left-6' : 'left-1'}`} />
                                    </button>
                                </div>
                            </div>
                            </div>
                        </div>

                        {/* ASSET SELECTION REMOVED - REPLACED BY ASSET UNIVERSE COMPONENT */}

                        {/* SAVE ACTIONS FOOTER */}
                        <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-end gap-4 sticky bottom-0 bg-neutral-900/95 backdrop-blur pb-2 -mb-2">
                            <button 
                                onClick={() => setMode('MONITOR')}
                                className="px-4 py-2 rounded text-xs font-bold text-slate-400 hover:text-white transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={() => {
                                    setMode('MONITOR');
                                    // ✅ AUTO-SAVE SILENTIOSO: Configurações já são salvas automaticamente pelo useApexLogic
                                    // Removido toast irritante
                                }}
                                className="px-6 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-widest shadow-lg shadow-emerald-900/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                            >
                                <CheckCircle className="w-4 h-4" />
                                Salvar Configuração
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>

        {/* Right Sidebar - Logs and Portfolio Stacked */}
        {!compact && (
        <div className="lg:col-span-1 flex flex-col gap-4 h-full">
            
            {/* Financial Overview */}
            <div className="bg-neutral-950 border border-white/5 rounded-xl p-5 shadow-lg relative overflow-hidden group shrink-0">
                 <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                    <Briefcase className="w-20 h-20 text-slate-500" />
                 </div>
                 
                 <div className="space-y-4 relative z-10">
                     <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Poder de Compra</p>
                        <p className="text-3xl font-bold text-white tracking-tight font-mono">${formatNumber(portfolio?.equity, 0, {minimumFractionDigits: 2})}</p>
                     </div>
                     
                     <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                        <div>
                           <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">Risco Estimado</p>
                           <p className="text-xs font-bold text-rose-400 font-mono">
                             -${((portfolio?.equity || 0) * ((config.dailyLossLimit || 0)/100)).toFixed(2)} <span className="opacity-70">({config.dailyLossLimit}%)</span>
                           </p>
                        </div>
                        <div>
                           <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">Retorno Alvo (T1)</p>
                           <p className="text-xs font-bold text-emerald-400 font-mono">
                             +${((portfolio?.equity || 0) * 0.05).toFixed(2)} <span className="opacity-70">(5%)</span>
                           </p>
                        </div>
                     </div>
                 </div>
            </div>

            {/* Logs Section */}
            <div className="border border-white/5 rounded-xl bg-neutral-950 p-4 flex flex-col flex-1 min-h-[200px]">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Terminal className="w-4 h-4" /> Logs do Sistema
                </h3>
                <SmartScrollContainer className="flex-1 space-y-2 font-mono text-xs flex flex-col">
                {recentLogs.length === 0 ? (
                    <NeuralLogsEmpty />
                ) : (
                    recentLogs.map((log, i) => (
                        <div key={i} className="flex gap-2">
                            <span className="text-slate-600">[{new Date().toLocaleTimeString()}]</span>
                            <span className={log.includes('EXECUTION') ? 'text-emerald-400' : log.includes('RISK') ? 'text-red-400' : 'text-slate-300'}>
                            {log}
                            </span>
                        </div>
                    ))
                )}
                </SmartScrollContainer>
            </div>
        </div>
        )}
      </div>
      {/* Calculator Modal */}
      <PositionSizeCalculator 
         isOpen={showCalculator} 
         onClose={() => setShowCalculator(false)} 
         currentPrice={0} // Can be passed from context if available
      />

      {/* Currency Converter Modal */}
      <CurrencyConverter
         isOpen={showConverter}
         onClose={() => setShowConverter(false)}
      />

      {/* Reset Account Modal */}
      <ResetAccountModal
         isOpen={showResetModal}
         onClose={() => setShowResetModal(false)}
         onConfirm={() => resetPortfolio(100)}
         activeOrdersCount={activeOrders.length}
      />

      {/* MT5 Configuration Modal */}
      {showMT5ConfigModal && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90]"
            onClick={() => setShowMT5ConfigModal(false)}
          />
          
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] max-h-[90vh] border border-gray-700 bg-[#131722] rounded-lg shadow-2xl z-[100] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 flex-shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-white">Configuração MT5</h2>
                <p className="text-xs text-gray-400 mt-1">Conecte sua conta MetaTrader 5</p>
              </div>
              <button 
                onClick={() => setShowMT5ConfigModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {isConnected ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                      <Settings className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-green-400">Conectado ao MT5</div>
                      <div className="text-xs text-gray-400 mt-0.5">Login: {mt5Login}</div>
                      <div className="text-xs text-gray-400">Servidor: {mt5Server}</div>
                    </div>
                  </div>

                  <div className="bg-[#1e222d] border border-gray-700 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center justify-between">
                      Status da Conexão
                      <span className="text-xs text-green-400 font-normal">💾 Salvo</span>
                    </h3>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Status:</span>
                        <span className="text-green-400 font-semibold">● Online</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Login:</span>
                        <span className="text-white font-mono">{mt5Login}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Servidor:</span>
                        <span className="text-blue-400 font-semibold bg-blue-500/10 px-2 py-1 rounded">{mt5Server}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleDisconnectMT5}
                    className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    Desconectar
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* 🚨 AVISO CRÍTICO - DIFERENÇA ENTRE OS CAMPOS */}
                  <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-2 border-purple-500/40 rounded-lg p-4">
                    <h4 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-purple-400" />
                      🚨 ATENÇÃO: 3 Campos Diferentes!
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-start gap-2">
                        <span className="text-green-400 font-bold">1.</span>
                        <div>
                          <strong className="text-white">Token MetaAPI</strong> <span className="text-gray-400">(~500 caracteres, começa com "eyJ...")</span><br/>
                          <span className="text-gray-400">→ Pegue em <a href="https://app.metaapi.cloud/token" target="_blank" className="text-blue-400 hover:underline">app.metaapi.cloud/token</a></span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-yellow-400 font-bold">2.</span>
                        <div>
                          <strong className="text-white">Login MT5</strong> <span className="text-gray-400">(ex: 87026945)</span><br/>
                          <span className="text-gray-400">→ Número da sua conta no MT5</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-purple-400 font-bold">3.</span>
                        <div>
                          <strong className="text-white">Account ID</strong> <span className="text-gray-400">(UUID com hífens: bb99f865-96fb...)</span><br/>
                          <span className="text-gray-400">→ Pegue em <a href="https://app.metaapi.cloud/accounts" target="_blank" className="text-blue-400 hover:underline">app.metaapi.cloud/accounts</a> → Clique na conta → Copie o ID</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* ⚠️ AVISO IMPORTANTE SOBRE METAAPI TOKEN */}
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-amber-400 mb-2 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      🔑 Token MetaAPI Obrigatório
                    </h4>
                    <p className="text-xs text-gray-300 mb-2">
                      Cole seu <strong>Token MetaAPI</strong> abaixo (é diferente do Login MT5!)
                    </p>
                    <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
                      <li>Acesse <a href="https://app.metaapi.cloud/token" target="_blank" className="text-blue-400 hover:underline">app.metaapi.cloud/token</a></li>
                      <li>Copie o token JWT completo (~500+ caracteres)</li>
                      <li>Cole no campo abaixo</li>
                    </ol>
                  </div>

                  {/* 🔑 CAMPO DE TOKEN METAAPI - DESTAQUE SE VAZIO */}
                  <div className={`${!metaApiToken.trim() ? 'ring-2 ring-red-500/50 rounded-lg p-4 bg-red-500/5' : ''}`}>
                    <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      <span className="font-bold">
                        🔑 Token MetaAPI {!metaApiToken.trim() && <span className="text-red-400 ml-2 animate-pulse">← COLE AQUI PRIMEIRO!</span>}
                      </span>
                    </label>
                    <textarea
                      value={metaApiToken}
                      onChange={(e) => setMetaApiToken(e.target.value)}
                      placeholder="🔴 OBRIGATÓRIO: Cole aqui o token MetaAPI (começa com eyJhbGci...)"
                      rows={3}
                      className={`w-full px-4 py-3 bg-[#1e222d] border rounded-lg text-white placeholder-gray-500 focus:outline-none font-mono text-xs resize-none ${
                        !metaApiToken.trim() 
                          ? 'border-red-500 focus:border-red-400' 
                          : metaApiToken.length >= 500 
                          ? 'border-green-500 focus:border-green-400' 
                          : 'border-amber-500 focus:border-amber-400'
                      }`}
                    />
                    <div className="flex items-center justify-between mt-1">
                      <p className={`text-xs ${metaApiToken.length >= 500 ? 'text-green-400' : metaApiToken.length > 0 && metaApiToken.length < 100 ? 'text-red-400' : 'text-gray-500'}`}>
                        {metaApiToken.length > 0 
                          ? `${metaApiToken.length} caracteres ${metaApiToken.length >= 500 ? '✅' : metaApiToken.length < 100 ? '❌ (muito curto - isso é o Login MT5?)' : '⚠️ (esperado ~500+)'}`
                          : 'Cole o token JWT completo do MetaAPI'
                        }
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Login MT5
                    </label>
                    <input
                      type="text"
                      value={mt5Login}
                      onChange={(e) => {
                        const value = e.target.value;
                        setMt5Login(value);
                        // 💾 Salvar automaticamente ao digitar
                        try {
                          localStorage.setItem('mt5_login', value);
                          console.log('[MT5] 💾 AUTO-SAVE: Login →', value);
                        } catch (err) {
                          console.warn('[MT5] ⚠️ Erro ao auto-salvar login');
                        }
                      }}
                      placeholder="ex: 87026945"
                      className="w-full px-4 py-3 bg-[#1e222d] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Número da sua conta MT5 • 💾 Salvo automaticamente
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Senha MT5
                    </label>
                    <input
                      type="password"
                      value={mt5Password}
                      onChange={(e) => setMt5Password(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 bg-[#1e222d] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Senha da sua conta MT5
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Servidor MT5
                    </label>
                    <input
                      type="text"
                      value={mt5Server}
                      onChange={(e) => {
                        const value = e.target.value;
                        setMt5Server(value);
                        // 💾 Salvar automaticamente ao digitar
                        try {
                          localStorage.setItem('mt5_server', value);
                          console.log('[MT5] 💾 AUTO-SAVE: Servidor →', value);
                        } catch (err) {
                          console.warn('[MT5] ⚠️ Erro ao auto-salvar servidor');
                        }
                      }}
                      placeholder="ex: ICMarkets-Demo, XM-Real, InfinoxLimited-MT5Live"
                      className="w-full px-4 py-3 bg-[#1e222d] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Nome do servidor do seu broker • 💾 Salvo automaticamente
                    </p>
                  </div>

                  {/* 🆕 CAMPO METAAPI ACCOUNT ID - AVISO DESTACADO */}
                  <div className="bg-purple-500/10 border-2 border-purple-500/40 rounded-lg p-4">
                    <label className="block text-sm font-medium text-white mb-2 flex items-center gap-2">
                      <span className="text-purple-400">🆔 MetaAPI Account ID</span>
                      <span className="text-red-400 text-xs font-bold">(NÃO é o Login MT5!)</span>
                    </label>
                    
                    {/* 🚨 AVISO VISUAL GRANDE */}
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded p-2 mb-3">
                      <p className="text-xs text-amber-300 font-semibold">
                        ⚠️ <strong>ATENÇÃO:</strong> O Account ID é diferente do Login MT5!
                      </p>
                      <p className="text-[11px] text-gray-300 mt-1">
                        • Login MT5: <span className="font-mono bg-black/30 px-1 rounded">87026945</span> ❌<br/>
                        • Account ID: <span className="font-mono bg-black/30 px-1 rounded text-[10px]">bb99f865-96fb-4573-98a7...</span> ✅
                      </p>
                    </div>
                    
                    <input
                      type="text"
                      value={metaApiAccountId}
                      onChange={(e) => {
                        const value = e.target.value;
                        setMetaApiAccountId(value);
                        // 💾 Salvar automaticamente ao digitar
                        try {
                          localStorage.setItem('metaapi_account_id', value);
                          console.log('[MT5] 💾 AUTO-SAVE: Account ID →', value);
                        } catch (err) {
                          console.warn('[MT5] ⚠️ Erro ao auto-salvar Account ID');
                        }
                      }}
                      placeholder="bb99f865-96fb-4573-98a7-1f32895f84f7"
                      className={`w-full px-4 py-3 bg-[#1e222d] border-2 rounded-lg text-white placeholder-gray-500 focus:outline-none font-mono text-xs ${
                        metaApiAccountId.length > 0 && (metaApiAccountId.length < 30 || !metaApiAccountId.includes('-'))
                          ? 'border-red-500 focus:border-red-500'
                          : metaApiAccountId.length >= 30 && metaApiAccountId.includes('-')
                          ? 'border-green-500 focus:border-green-500'
                          : 'border-gray-700 focus:border-purple-500'
                      }`}
                    />
                    
                    <div className="mt-2 space-y-1">
                      <p className={`text-xs font-semibold ${
                        metaApiAccountId.length > 0 && (metaApiAccountId.length < 30 || !metaApiAccountId.includes('-'))
                          ? 'text-red-400'
                          : metaApiAccountId.length >= 30 && metaApiAccountId.includes('-')
                          ? 'text-green-400'
                          : 'text-gray-500'
                      }`}>
                        {metaApiAccountId.length > 0 && (metaApiAccountId.length < 30 || !metaApiAccountId.includes('-'))
                          ? '❌ Formato inválido - isso parece ser o Login MT5!'
                          : metaApiAccountId.length >= 30 && metaApiAccountId.includes('-')
                          ? '✅ Formato correto!'
                          : '📋 Cole o Account ID do painel MetaAPI'
                        }
                      </p>
                      <p className="text-[11px] text-gray-400">
                        🔗 Acesse <a href="https://app.metaapi.cloud/accounts" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">app.metaapi.cloud/accounts</a> → Clique na sua conta → Copie o Account ID
                      </p>
                    </div>
                  </div>

                  {connectionError && (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg space-y-2">
                      <p className="text-sm text-red-400 whitespace-pre-line">{connectionError}</p>
                    </div>
                  )}

                  {/* 💾 Aviso compacto */}
                  {(mt5Login || mt5Server || metaApiAccountId || metaApiToken) && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-2">
                      <p className="text-xs text-green-400">
                        💾 Salvo: {mt5Login && `Login ${mt5Login}`} {mt5Server && `• Servidor ${mt5Server}`} {metaApiAccountId && `• ID ${metaApiAccountId.substring(0, 8)}...`}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={handleConnectMT5}
                    disabled={connectionStatus === 'connecting' || !metaApiToken.trim() || metaApiToken.length < 100 || !metaApiAccountId.trim()}
                    className={`w-full px-4 py-3 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 ${
                      !metaApiToken.trim() || metaApiToken.length < 100 || !metaApiAccountId.trim()
                        ? 'bg-gray-700 cursor-not-allowed text-gray-400'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    } disabled:bg-gray-700 disabled:cursor-not-allowed`}
                  >
                    {connectionStatus === 'connecting' ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Conectando... (veja o console F12)</span>
                      </>
                    ) : !metaApiToken.trim() ? (
                      <span>⚠️ Cole o Token MetaAPI Primeiro</span>
                    ) : metaApiToken.length < 100 ? (
                      <span>⚠️ Token Muito Curto</span>
                    ) : !metaApiAccountId.trim() ? (
                      <span>⚠️ Cole o Account ID</span>
                    ) : (
                      <span>Conectar ao MT5</span>
                    )}
                  </button>

                  {/* 🔍 HELPER: Abrir console para ver progresso */}
                  {connectionStatus === 'connecting' && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                      <p className="text-xs text-blue-400 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        <span><strong>Conectando...</strong> Pressione <kbd className="px-2 py-0.5 bg-gray-700 rounded text-[10px]">F12</kbd> e vá na aba <strong>Console</strong> para ver o progresso detalhado</span>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* 🚨 LIVE MODE CONFIRMATION MODAL */}
      {showLiveModeConfirmation && (
        <LiveModeConfirmation
          isOpen={showLiveModeConfirmation}
          onClose={() => setShowLiveModeConfirmation(false)}
          onConfirm={() => {
            setExecutionMode('LIVE');
            setShowLiveModeConfirmation(false);
            // Salvar no localStorage
            if (typeof window !== 'undefined') {
              localStorage.setItem('neural_execution_mode', 'LIVE');
            }
          }}
          currentBalance={portfolio?.balance || 0}
          currentEquity={portfolio?.equity || 0}
          mt5Connected={isConnected}
          riskSettings={{
            dailyLossLimit: config.dailyLossLimit,
            maxContracts: config.maxContracts,
            stopLossMode: config.stopLossMode
          }}
        />
      )}

      {/* 🚀 AI RECOVERY CHALLENGE MODAL */}
      {showRecoveryChallenge && (
        <AIRecoveryChallenge
          isOpen={showRecoveryChallenge}
          onClose={() => setShowRecoveryChallenge(false)}
          onStart={(targetTime) => {
            console.log('[AITrader] 🚀 Recovery Challenge iniciado!');
            setChallengeActive(true);
            setChallengeStartTime(new Date());
            setChallengeInitialBalance(portfolio?.balance || 0);
            setChallengeTargetTime(targetTime);
          }}
          initialBalance={portfolio?.balance || 0}
        />
      )}

      {/* 🎯 RECOVERY PROGRESS HUD */}
      {challengeActive && challengeStartTime && (
        <RecoveryProgressHUD
          initialBalance={challengeInitialBalance}
          targetTime={challengeTargetTime}
          startTime={challengeStartTime}
          onStop={() => {
            setChallengeActive(false);
            setChallengeStartTime(null);
            toast.info('🛑 Recovery Challenge Finalizado', {
              description: `Resultado final: ${portfolio.equity >= challengeInitialBalance ? 'LUCRO' : 'PERDA'} de $${(portfolio.equity - challengeInitialBalance).toFixed(2)}`
            });
            
            // Narração por voz
            if ('speechSynthesis' in window) {
              const profit = portfolio.equity - challengeInitialBalance;
              const utterance = new SpeechSynthesisUtterance(
                `Desafio de recuperação finalizado. ${profit >= 0 ? 'Lucro' : 'Perda'} de ${Math.abs(profit).toFixed(2)} dólares. Capital final: ${portfolio.equity.toFixed(2)} dólares.`
              );
              utterance.lang = 'pt-PT';
              window.speechSynthesis.speak(utterance);
            }
          }}
        />
      )}
    </div>
  );
}

export default AITrader;