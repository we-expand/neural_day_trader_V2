import React, { useState, useEffect } from 'react';
import { useTradingContext } from '../../contexts/TradingContext';
import { useAuth } from '../../contexts/AuthContext';
import { Lock, Unlock, RefreshCw, DollarSign, Settings, WifiOff, Wifi, AlertCircle, Terminal, AlertTriangle, ShieldCheck, LogOut, Key, Server, User, RotateCcw, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';

// UI Components
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Alert, AlertTitle, AlertDescription } from '@/app/components/ui/alert';

interface MetaApiCredentials {
  login: string;
  server: string;
  password?: string;
  // Initial Balance removed from here, moved to Config for Demo only
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const MT5ConfigPanel = ({ isOpen, onClose }: Props) => {
  const { config, setConfig } = useTradingContext();
  const { user } = useAuth();
  if (!isOpen) return null;

  // Check if already connected to LIVE
  const isAlreadyConnected = config.executionMode === 'LIVE' && config.metaApiCredentials?.login;

  // Initialize state from existing config if available
  const [credentials, setCredentials] = useState<MetaApiCredentials>(
    config.metaApiCredentials || {
      login: '',
      server: '',
      password: ''
    }
  );
  
  const [mode, setMode] = useState<'DEMO' | 'LIVE'>(config.executionMode || 'DEMO');
  const [demoBalance, setDemoBalance] = useState<number>(config.initialBalance || 100);
  const [metaApiToken, setMetaApiToken] = useState<string>(config.metaApiToken || "");
  const [isSaved, setIsSaved] = useState(false);

  const STORAGE_KEY = 'apex_logic_state_v14_CLEAN';

  // NOVO: Carregar token automaticamente do backend ao montar
  useEffect(() => {
    const loadToken = async () => {
      if (user?.id && !metaApiToken) {
        try {
          const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-1dbacac6/mt5-token/load?userId=${user.id}`, {
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`
            }
          });
          const data = await response.json();
          if (data.token) {
            setMetaApiToken(data.token);
            console.log('✅ Token MT5 carregado automaticamente do backend');
          }
        } catch (err) {
          console.warn('⚠️ Falha ao carregar token (não crítico):', err);
        }
      }
    };
    loadToken();
  }, [user?.id]);

  const handleSave = async () => {
    if (mode === 'LIVE') {
        if (!credentials.login || !credentials.server || !credentials.password) {
            toast.error('Preencha as credenciais da conta MT5 (Server, Login, Password).');
            return;
        }
        
        // 🎯 VALIDAR TOKEN METAAPI
        if (!metaApiToken) {
            toast.error('Token MetaApi obrigatório para modo LIVE');
            return;
        }
        
        if (!metaApiToken.startsWith('eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9')) {
            toast.error('Token MetaApi inválido! Deve começar com "eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9". Copie o token correto do painel MetaApi.');
            return;
        }
        
        console.log('✅ Token MetaApi válido - primeiros 30 chars:', metaApiToken.substring(0, 30) + '...');
    }

    // Determine initial balance
    // For Demo: Use the demoBalance input
    // For Live: Always undefined (auto-detect from API)
    let finalInitialBalance: number | undefined;
    
    if (mode === 'DEMO') {
        finalInitialBalance = demoBalance;
    } else {
        finalInitialBalance = undefined; // Force auto-detect from API
    }

    // Prepare new config
    const newConfig = {
      ...config,
      executionMode: mode,
      metaApiCredentials: mode === 'LIVE' ? credentials : undefined,
      initialBalance: finalInitialBalance,
      metaApiToken: mode === 'LIVE' ? metaApiToken : undefined
    };

    // DIRECT STORAGE MANIPULATION (To ensure persistence before reload)
    try {
        const savedState = localStorage.getItem(STORAGE_KEY);
        let stateToSave;
        
        if (savedState) {
            const parsed = JSON.parse(savedState);

            // INTELLIGENT PORTFOLIO RESET
            let newPortfolio = parsed.portfolio;
            const prevMode = parsed.config?.executionMode || 'DEMO';
            const prevBalance = parsed.portfolio?.initialBalance; // Compare with initialBalance to detect manual changes

            // Logic: Reset Portfolio if Mode changed OR if we are in DEMO and the user requested a different Balance
            if (mode !== prevMode || (mode === 'DEMO' && demoBalance !== prevBalance)) {
                 if (mode === 'DEMO') {
                     newPortfolio = {
                        balance: demoBalance,
                        equity: demoBalance,
                        maxDrawdownLimit: 10.0,
                        currentDrawdown: 0.0,
                        openPositionsValue: 0,
                        initialBalance: demoBalance
                     };
                 } else {
                     // Switching to LIVE (Reset to 0 until connected)
                     newPortfolio = {
                        balance: 0, 
                        equity: 0, 
                        maxDrawdownLimit: 15.0, 
                        currentDrawdown: 0, 
                        openPositionsValue: 0, 
                        initialBalance: 0
                     };
                 }
            }

            stateToSave = {
                ...parsed,
                config: newConfig,
                portfolio: newPortfolio,
                activeOrders: mode !== prevMode ? [] : parsed.activeOrders // Clear orders on mode switch
            };
        } else {
            // If no state exists yet, create a fresh one
            stateToSave = {
                status: 'idle',
                activeOrders: [],
                portfolio: {
                    balance: mode === 'DEMO' ? demoBalance : 0, // Will be updated by logic on load
                    equity: mode === 'DEMO' ? demoBalance : 0,
                    maxDrawdownLimit: 3.0,
                    currentDrawdown: 0,
                    openPositionsValue: 0
                },
                recentLogs: [],
                config: newConfig
            };
        }
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
        // Also save credentials globally for the Logic Core to pick up immediately if needed
        (window as any).__META_API_CREDENTIALS__ = credentials;
        
        // NOVO: Salvar token MT5 no backend para persistência permanente
        if (mode === 'LIVE' && metaApiToken && user?.id) {
            try {
                await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-1dbacac6/mt5-token/save`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${publicAnonKey}`
                    },
                    body: JSON.stringify({
                        userId: user.id,
                        token: metaApiToken
                    })
                });
                console.log('✅ Token MT5 salvo no backend com sucesso');
            } catch (err) {
                console.warn('⚠️ Falha ao salvar token no backend (não crítico):', err);
            }
        }
        
    } catch (e) {
        console.error("Critical: Failed to save to local storage", e);
        toast.error("Erro ao salvar configuração no disco.");
        return;
    }

    // Update Context (Visual Feedback)
    setConfig(newConfig);

    toast.success(`Configuração salva! Conectando...`);
    setIsSaved(true);
    
    // Force reload to ensure clean state transition
    setTimeout(() => {
       window.location.reload();
    }, 500);
    
    if (onClose) onClose();
  };

  const handleDisconnect = () => {
    // Clear LIVE configuration and reset to DEMO mode
    const newConfig = {
      ...config,
      executionMode: 'DEMO' as 'DEMO' | 'LIVE',
      metaApiCredentials: undefined,
      metaApiToken: undefined,
      initialBalance: 100
    };

    try {
      const savedState = localStorage.getItem(STORAGE_KEY);
      if (savedState) {
        const parsed = JSON.parse(savedState);
        const stateToSave = {
          ...parsed,
          config: newConfig,
          portfolio: {
            balance: 100,
            equity: 100,
            maxDrawdownLimit: 10.0,
            currentDrawdown: 0.0,
            openPositionsValue: 0,
            initialBalance: 100
          },
          activeOrders: [] // Clear all orders
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
      }
      
      // Clear global credentials
      (window as any).__META_API_CREDENTIALS__ = undefined;
      
    } catch (e) {
      console.error("Error disconnecting:", e);
      toast.error("Erro ao desconectar da conta MT5.");
      return;
    }

    setConfig(newConfig);
    toast.success("Desconectado da conta real. Voltando ao modo DEMO...");
    
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm fixed inset-0 z-50">
      <Card className="w-full max-w-2xl bg-zinc-950 border-zinc-800 text-zinc-100 shadow-2xl shadow-emerald-500/10">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <Terminal className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-white tracking-wide">
                Integração MetaTrader 5 (Direct)
              </CardTitle>
              <CardDescription className="text-zinc-400">
                Conecte sua conta real institucional do MT5.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          
          {/* Connection Status Alert - Show if already connected */}
          {isAlreadyConnected && (
            <Alert className="bg-emerald-500/10 border-emerald-500/30 text-emerald-200">
              <ShieldCheck className="h-4 w-4 stroke-emerald-400" />
              <AlertTitle className="text-emerald-400">Conta Real Conectada</AlertTitle>
              <AlertDescription className="text-xs opacity-90">
                Você já está conectado à conta MT5 (Login: {config.metaApiCredentials?.login}). 
                Para trocar de conta, clique em "Desconectar" primeiro.
              </AlertDescription>
            </Alert>
          )}

          {/* ERROR/LOCKED ACCOUNT ALERT - Show prominent warning */}
          {isAlreadyConnected && mode === 'LIVE' && (
            <Alert className="bg-red-500/20 border-red-500/50 text-red-100 animate-pulse">
              <AlertTriangle className="h-5 w-5 stroke-red-400" />
              <AlertTitle className="text-red-400 text-lg font-bold">⚠️ Conta Real Ativa</AlertTitle>
              <AlertDescription className="text-sm opacity-90 space-y-3">
                <p>
                  Se você está enfrentando problemas de conexão ou quer apenas testar,
                  <strong className="text-red-300"> clique em "DESCONECTAR"</strong> abaixo para voltar ao modo SIMULAÇÃO.
                </p>
                <p className="text-xs text-red-300/70">
                  ✓ Modo Simulação: Opera com dados reais mas sem risco financeiro<br />
                  ✓ Todas as funcionalidades da plataforma estarão disponíveis
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Mode Selection */}
          <div className="grid grid-cols-2 gap-4 p-1 bg-zinc-900/50 rounded-xl border border-zinc-800">
            <button
              onClick={() => setMode('DEMO')}
              disabled={isAlreadyConnected}
              className={`flex items-center justify-center gap-2 p-3 rounded-lg text-sm font-medium transition-all ${
                mode === 'DEMO'
                  ? 'bg-zinc-800 text-white shadow-lg border border-zinc-700'
                  : 'text-zinc-500 hover:text-zinc-300'
              } ${isAlreadyConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <ShieldCheck className="w-4 h-4" />
              SIMULAÇÃO (Paper Trading)
            </button>
            <button
              onClick={() => setMode('LIVE')}
              disabled={isAlreadyConnected}
              className={`flex items-center justify-center gap-2 p-3 rounded-lg text-sm font-medium transition-all ${
                mode === 'LIVE'
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                  : 'text-zinc-500 hover:text-zinc-300'
              } ${isAlreadyConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <AlertTriangle className="w-4 h-4" />
              CONTA REAL (Live Execution)
            </button>
          </div>

          {mode === 'LIVE' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
              <Alert className="bg-red-500/5 border-red-500/20 text-red-200">
                <AlertTriangle className="h-4 w-4 stroke-red-400" />
                <AlertTitle className="text-red-400">Atenção: Risco Financeiro</AlertTitle>
                <AlertDescription className="text-xs opacity-90">
                  A execução em conta real envia ordens diretamente para sua corretora.
                  Verifique se os dados abaixo correspondem à sua conta MT5 REAL.
                </AlertDescription>
              </Alert>

              <Alert className="bg-blue-500/5 border-blue-500/20 text-blue-200">
                <Key className="h-4 w-4 stroke-blue-400" />
                <AlertTitle className="text-blue-400">Como obter seu Token MetaAPI</AlertTitle>
                <AlertDescription className="text-xs opacity-90 space-y-1">
                  <p>1. Acesse <a href="https://app.metaapi.cloud/token" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300">app.metaapi.cloud/token</a></p>
                  <p>2. Copie o token JWT completo (começa com "eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9")</p>
                  <p>3. Cole no campo "Chave Mestra MetaApi" abaixo</p>
                  <p className="text-yellow-300 font-bold mt-2">⚠️ IMPORTANTE: O Token MetaAPI (~500 chars) é DIFERENTE do Login MT5 (~8 dígitos)</p>
                </AlertDescription>
              </Alert>

              <div className="grid gap-4">
                
                <div className="grid gap-2 p-3 bg-purple-500/5 border border-purple-500/20 rounded-lg">
                  <Label htmlFor="token" className="text-zinc-300 flex items-center gap-2">
                    <Key className="w-4 h-4 text-purple-500" /> Chave Mestra MetaApi (Token JWT ~500+ chars)
                  </Label>
                  <Input
                    id="token"
                    type="password"
                    placeholder="eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9..."
                    className="bg-zinc-950 border-zinc-800 focus:border-purple-500/50 focus:ring-purple-500/20 font-mono text-xs"
                    value={metaApiToken}
                    onChange={(e) => setMetaApiToken(e.target.value)}
                    disabled={isAlreadyConnected}
                  />
                  <p className="text-[10px] text-zinc-500">
                    Defina aqui a chave da <strong>Sua Plataforma</strong>. Seus clientes finais não precisarão preencher isso (o sistema usará esta chave para criar as conexões deles automaticamente).
                  </p>
                  {metaApiToken && !metaApiToken.startsWith('eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9') && (
                    <div className="p-2 bg-red-500/10 border border-red-500/30 rounded">
                      <p className="text-[10px] text-red-400 flex items-center gap-1 font-bold">
                        ⚠️ Token inválido! Deve começar com "eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9"
                      </p>
                      <p className="text-[9px] text-red-300 mt-1">
                        {metaApiToken.length < 100 
                          ? `Você colou o LOGIN MT5 (${metaApiToken.length} chars) ao invés do TOKEN (500+ chars). São campos DIFERENTES!`
                          : 'Copie o token completo do MetaAPI'}
                      </p>
                    </div>
                  )}
                  {metaApiToken && metaApiToken.startsWith('eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9') && (
                    <div className="p-2 bg-green-500/10 border border-green-500/30 rounded flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-green-400" />
                      <p className="text-[10px] text-green-400 font-bold">
                        ✓ Token válido ({metaApiToken.length} caracteres)
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="server" className="text-zinc-300 flex items-center gap-2">
                    <Server className="w-4 h-4 text-emerald-500" /> Broker Server (Servidor)
                  </Label>
                  <Input
                    id="server"
                    placeholder="Ex: XP-MetaTrader5-Live"
                    className="bg-zinc-900 border-zinc-800 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                    value={credentials.server}
                    onChange={(e) => setCredentials(prev => ({ ...prev, server: e.target.value }))}
                    disabled={isAlreadyConnected}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="login" className="text-zinc-300 flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-400" /> Login (Account ID)
                    </Label>
                    <Input
                      id="login"
                      placeholder="12345678"
                      className="bg-zinc-900 border-zinc-800 focus:border-blue-500/50 focus:ring-blue-500/20 font-mono"
                      value={credentials.login}
                      onChange={(e) => setCredentials(prev => ({ ...prev, login: e.target.value }))}
                      disabled={isAlreadyConnected}
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="password" className="text-zinc-300 flex items-center gap-2">
                      <Key className="w-4 h-4 text-rose-400" /> Password (Senha)
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      className="bg-zinc-900 border-zinc-800 focus:border-rose-500/50 focus:ring-rose-500/20 font-mono"
                      value={credentials.password}
                      onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                      disabled={isAlreadyConnected}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-800/50 mt-2">
                    <p className="text-[10px] text-zinc-500 italic text-center">
                        O saldo será sincronizado automaticamente após a conexão.
                    </p>
                </div>



              </div>
            </div>
          )}

          {mode === 'DEMO' && (
             <div className="space-y-4">
                <div className="p-4 rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 text-center space-y-2">
                    <p className="text-zinc-400 text-sm">O Modo de Simulação utiliza dados de mercado em tempo real (quando disponíveis) mas executa ordens em um ambiente virtual isolado.</p>
                    <p className="text-emerald-400 text-xs font-mono">SAFE ENVIRONMENT ACTIVE</p>
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="demoBalance" className="text-zinc-300 flex items-center gap-2">
                        <span className="text-emerald-400">$</span> Initial Balance (Saldo Simulado)
                    </Label>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-6 px-2 text-[10px] border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/30"
                        onClick={() => setDemoBalance(100)}
                    >
                        <RotateCcw className="w-3 h-3 mr-1" /> Reset $100
                    </Button>
                  </div>
                  <Input
                    id="demoBalance"
                    type="number"
                    placeholder="100.00"
                    className="bg-zinc-900 border-zinc-800 focus:border-emerald-500/50 focus:ring-emerald-500/20 font-mono"
                    value={demoBalance}
                    onChange={(e) => setDemoBalance(parseFloat(e.target.value))}
                  />
                  <p className="text-[10px] text-zinc-500">
                    Defina o capital inicial para testar suas estratégias.
                  </p>
                </div>
             </div>
          )}

        </CardContent>

        <CardFooter className="flex justify-between border-t border-zinc-800/50 pt-6">
           <Button variant="ghost" className="text-zinc-400 hover:text-white" onClick={onClose}>
             Cancelar
           </Button>
           
           {isAlreadyConnected ? (
             <Button 
               className="bg-amber-500 hover:bg-amber-600 text-black font-bold px-8 flex items-center gap-2"
               onClick={handleDisconnect}
             >
               <LogOut className="w-4 h-4" />
               DESCONECTAR CONTA REAL
             </Button>
           ) : (
             <Button 
               className={`bg-emerald-500 hover:bg-emerald-600 text-black font-bold px-8 ${mode === 'LIVE' ? 'bg-red-500 hover:bg-red-600 text-white' : ''}`}
               onClick={handleSave}
             >
               {mode === 'LIVE' ? 'CONECTAR & HABILITAR' : 'SALVAR PREFERÊNCIAS'}
             </Button>
           )}
        </CardFooter>
      </Card>
    </div>
  );
};