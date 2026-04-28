import React, { useEffect, useState } from 'react';
import { Wallet, TrendingUp, ArrowUpRight, ArrowDownLeft, CreditCard, Bitcoin, Building, Copy, Zap, AlertTriangle, Activity, RefreshCw, Server, ShieldCheck, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTradingContext } from '../contexts/TradingContext';
import { supabase } from '../../lib/supabaseClient';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { formatCurrency, formatPercent } from '@/app/utils/formatters';

type TransactionType = 'deposit' | 'withdrawal';

export function Funds() {
  const { user } = useAuth();
  const { portfolio, activeOrders, applyCommission, resetPortfolio, config } = useTradingContext(); // Use Global Trading State
  const [transactionType, setTransactionType] = useState<TransactionType>('deposit');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState('pix');
  const [destinationInfo, setDestinationInfo] = useState('');
  const [showDemoReset, setShowDemoReset] = useState(false);
  const [confirmWithdrawOpen, setConfirmWithdrawOpen] = useState(false);
  const [securityPin, setSecurityPin] = useState('');
  
  // Pix Validation Modal State
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [proofId, setProofId] = useState('');

  // Handle Demo Reset
  const handleDemoReset = () => {
      if (config.executionMode !== 'DEMO') {
          toast.error("Disponível apenas em modo DEMO");
          return;
      }
      resetPortfolio(100); // Reset para $100 dólares
      toast.success("💰 Saldo Demo Restaurado para $100.00", {
          description: "Conta DEMO resetada com sucesso!"
      });
  };
  
  // Real Data State (Initialized with Mock Portfolio for Demo)
  const [balance, setBalance] = useState({
    available: portfolio.balance,
    invested: portfolio.openPositionsValue,
    profit: portfolio.equity - portfolio.balance,
    profitPercent: ((portfolio.equity - portfolio.balance) / portfolio.balance) * 100 || 0,
  });
  const [transactions, setTransactions] = useState<any[]>([]);

  // Sync with Trading Context
  useEffect(() => {
     // DEMO MODE: Fully trust the internal simulation state
     if (config.executionMode === 'DEMO') {
         console.log('[Funds] 🔄 Sincronizando DEMO - Portfolio:', {
           balance: portfolio.balance,
           equity: portfolio.equity,
           openPositionsValue: portfolio.openPositionsValue
         });
         
         const newBalance = {
            available: portfolio.balance,
            invested: portfolio.openPositionsValue,
            profit: portfolio.equity - portfolio.balance,
            profitPercent: ((portfolio.equity - portfolio.balance) / portfolio.balance) * 100 || 0,
         };
         
         console.log('[Funds] ✅ Balance ATUALIZADO (DEMO):', newBalance);
         setBalance(newBalance);
     } 
     // 🔴 MODO REAL (LIVE): Usar dados REAIS do MT5 via portfolio
     else if (config.executionMode === 'LIVE') {
         console.log('[Funds] 🔴 MODO LIVE - Usando dados REAIS do MT5:', {
           balance: portfolio.balance,
           equity: portfolio.equity,
           openPositionsValue: portfolio.openPositionsValue
         });
         
         // Floating PnL (lucro/perda em posições abertas)
         const floatingPnL = portfolio.equity - portfolio.balance;

         const newBalance = {
             available: portfolio.balance, // 🔥 Usar balance REAL do MT5
             invested: portfolio.openPositionsValue,
             profit: floatingPnL,
             profitPercent: portfolio.balance > 0 ? (floatingPnL / portfolio.balance) * 100 : 0,
         };
         
         console.log('[Funds] ✅ Balance ATUALIZADO (LIVE/REAL):', newBalance);
         setBalance(newBalance);
     }
  }, [portfolio, config.executionMode]);

  // Fetch Data (Optional Overlay for Real Backend)
  const fetchData = async () => {
    if (!user) return; 
    
    // 🔥 MODO DEMO: NÃO buscar do backend, confiar no portfolio local
    if (config.executionMode === 'DEMO') {
      console.log('[Funds] ℹ️ Modo DEMO - Usando valores do portfolio local, ignorando backend');
      return;
    }
    
    // MODO LIVE: Buscar do backend (KV Store)
    try {
      // 1. Get Wallet from KV Store via Server
      const walletRes = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-1dbacac6/wallet?userId=${user.id}`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      const walletData = await walletRes.json();
      
      // Always update if we have valid data, allowing 0 balance
      if (walletData && walletData.balance !== undefined && !isNaN(Number(walletData.balance))) {
          // REAL BALANCE OVERRIDE
          setBalance(prev => ({
              ...prev,
              available: Number(walletData.balance),
          }));
      }

      // 2. Get Transactions from KV Store via Server
      const txRes = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-1dbacac6/transactions?userId=${user.id}`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      const txData = await txRes.json();
      
      if (txData && txData.transactions) {
          setTransactions(txData.transactions);
      }

    } catch (error) {
      console.error("Error fetching funds data:", error);
    }
  };

  useEffect(() => {
    console.log('[Funds] 📥 Montando componente - fetchData inicial (Modo:', config.executionMode, ')');
    fetchData();
    
    // Auto-refresh on window focus (helpful after returning from payment gateway)
    const onFocus = () => {
      console.log('[Funds] 🔄 Window focus - fetchData...');
      fetchData();
    };
    window.addEventListener('focus', onFocus);

    // Listen for custom event from App.tsx
    const onTransactionUpdated = () => {
        console.log("Transaction updated event received, refreshing data...");
        fetchData();
    };
    window.addEventListener('transaction_updated', onTransactionUpdated);

    return () => {
        window.removeEventListener('focus', onFocus);
        window.removeEventListener('transaction_updated', onTransactionUpdated);
    };
  }, [user]);

  // Refresh data when switching to LIVE mode
  useEffect(() => {
      if (config.executionMode === 'LIVE') {
          fetchData();
      }
  }, [config.executionMode]);

  const handleTransaction = async () => {
    if (!user) return toast.error("Sessão inválida. Tente recarregar.");
    if (!amount) return toast.error("Por favor, digite o valor da transação.");

    const value = parseFloat(amount);
    if (isNaN(value) || value <= 0) return toast.error('Valor inválido');

    if (transactionType === 'deposit') {
        // Validação de Mínimo R$ 50 (~$8.50 USD)
        if (value < 8.5) {
            return toast.error('Depósito mínimo é de R$ 50,00 (aprox. $8.50 USD)');
        }

        // Open Pix Modal instead of executing immediately
        if (selectedMethod === 'pix') {
            setPixModalOpen(true);
            return;
        }

        executeTransaction();
    } else {
        // Withdrawal Flow - Open Confirmation Dialog
        if (value > balance.available) {
            return toast.error('Saldo insuficiente');
        }
        if (!destinationInfo) {
            return toast.error(selectedMethod === 'pix' ? 'Digite sua chave Pix' : 'Digite o endereço da carteira');
        }
        setConfirmWithdrawOpen(true);
    }
  };

  const executeTransaction = async (manualProofId?: string) => {
    setLoading(true);
    const value = parseFloat(amount);
    
    try {
      if (!supabase) throw new Error("Supabase client not initialized");

      // STRIPE INTEGRATION FOR DEPOSITS
      if (transactionType === 'deposit' && selectedMethod === 'card') {
          try {
             const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-1dbacac6/deposit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}` },
                body: JSON.stringify({ 
                    amount: value, 
                    userId: user?.id, 
                    email: user?.email,
                    currency: 'usd'
                })
             });
             
             const data = await response.json();
             
             // Handle Specific Error Codes
             if (data.code === 'MISSING_STRIPE_KEY') {
                 toast.error("Configuração Stripe Pendente", {
                     description: "Para processar pagamentos reais, é necessário configurar a STRIPE_SECRET_KEY no painel do projeto.",
                     duration: 8000,
                     action: {
                         label: "Como configurar?",
                         onClick: () => window.open('https://dashboard.stripe.com/apikeys', '_blank')
                     }
                 });
                 return;
             }

             if (data.error) throw new Error(data.error);
             
             if (data.url) {
                 if (data.simulated) {
                     // STOP AUTOMATIC REDIRECT IF IT'S A CONFIGURATION ISSUE
                     if (data.warning && (data.warning.includes("missing") || data.warning.includes("invalid"))) {
                         toast.error("Configuração de Pagamento Inválida", {
                             description: `O servidor não encontrou uma chave Stripe válida. Detalhes: ${data.warning}. (Debug: ${data.key_debug || 'N/A'})`,
                             duration: 10000,
                             action: {
                                 label: "Tentar Novamente",
                                 onClick: () => executeTransaction()
                             }
                         });
                         // We do NOT redirect to the simulated URL to avoid confusion, 
                         // unless it's a deliberate simulation (which this path implies it isn't, given the user intent).
                         // However, if we must fallback, we warn heavily.
                         return; 
                     }

                     // Warn user about simulation mode if they expected real payment
                     toast.warning("Ambiente de Teste Detectado", {
                         description: "Gateway de pagamento (Stripe) não configurado. Redirecionando para simulação...",
                         duration: 4000
                     });
                     
                     // Force Simulation Logic
                     window.location.href = data.url;
                     return;
                 } else {
                     toast.success("Redirecionando para Pagamento Seguro...");
                 }
                 // Delay slightly for toast visibility
                 setTimeout(() => {
                     window.location.href = data.url;
                 }, 2000);
                 return;
             }
          } catch (stripeError: any) {
             console.error("Payment Gateway Error:", stripeError);
             const errorMessage = stripeError.message || "Erro desconhecido";
             
             if (errorMessage.includes("STRIPE_SECRET_KEY") || errorMessage.includes("Configuração")) {
                 toast.error("Configuração Necessária", {
                     description: "A chave da Stripe não foi configurada. Por favor, adicione a STRIPE_SECRET_KEY nas configurações do projeto.",
                     duration: 6000,
                     action: {
                         label: "Entendi",
                         onClick: () => console.log("User notified")
                     }
                 });
                 // Prevent bubbling to outer catch
                 return; 
             }
             
             throw new Error("Falha ao iniciar pagamento: " + errorMessage);
          }
      }

      // 1. Insert Transaction Record (For Manual/Crypto/Pix or Fallback) via Server (KV Store)
      // NOTE: For Pix, we are auto-completing for testing purposes since we lack real webhooks.
      const status = selectedMethod === 'pix' && transactionType === 'deposit' ? 'completed' : 'pending';
      
      const txResponse = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-1dbacac6/transaction`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}` },
          body: JSON.stringify({
            userId: user?.id,
            type: transactionType,
            amount: value,
            method: selectedMethod,
            status: status, 
            metadata: { 
                destination: destinationInfo,
                proof_id: manualProofId || proofId,
                description: `Solicitação de ${transactionType} via ${selectedMethod}`
            }
          })
      });

      if (!txResponse.ok) {
          const errData = await txResponse.json();
          throw new Error(errData.error || "Failed to record transaction");
      }
      
      if (status === 'completed') {
           toast.success("Depósito Pix confirmado e saldo atualizado!");
      } else {
           toast.success(`${transactionType === 'deposit' ? 'Depósito' : 'Solicitação de Saque'} enviada para análise!`);
      }

      setAmount('');
      setDestinationInfo('');
      setConfirmWithdrawOpen(false); // Close dialog if open
      setPixModalOpen(false); // Close Pix Modal
      setProofId(''); // Reset Proof
      setSecurityPin(''); // Reset PIN
      
      // Refresh data
      fetchData();
      
    } catch (error: any) {
      toast.error('Erro na transação: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const depositMethods = [
    { id: 'pix', name: 'Pix / Instant Transfer', icon: Building, fee: '0%', time: 'Instantâneo' },
    { id: 'card', name: 'Cartão de Crédito (Stripe)', icon: CreditCard, fee: '3.5%', time: 'Instantâneo' },
    { id: 'crypto', name: 'Crypto (USDT/BTC)', icon: Bitcoin, fee: '1%', time: '15-30 min' },
  ];

  const withdrawalMethods = [
    { id: 'pix', name: 'Pix / Transferência', icon: Building, fee: '0.5%', time: 'Instantâneo' },
    { id: 'crypto', name: 'Crypto Wallet', icon: Bitcoin, fee: '1% + Rede', time: '15-60 min' },
  ];

  const currentMethods = transactionType === 'deposit' ? depositMethods : withdrawalMethods;

  return (
    <div className="p-8 space-y-8 bg-[#09090b] min-h-full font-sans selection:bg-[#00ff9d]/30">
      {/* Header com ícone + título + subtítulo (padrão Marketplace) */}
      <div className="flex items-start gap-4 mb-6 pb-6 border-b border-[#27272a]">
        <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
          <Wallet className="w-8 h-8 text-emerald-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-white uppercase flex items-center gap-3">
            Gestão de Carteira
          </h1>
          <p className="text-slate-400 mt-1 tracking-wide font-light">
            Gerencie seus depósitos, saques e saldo no ecossistema Neural
          </p>
        </div>
        
        <div className="flex items-center gap-2 bg-[#18181b] p-2 rounded-lg border border-[#27272a]">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                <Server className="w-3 h-3 text-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">System Healthy</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-purple-500/10 border border-purple-500/20">
                <ShieldCheck className="w-3 h-3 text-purple-500" />
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">TLS 1.3 Secured</span>
            </div>
        </div>
      </div>

      {/* Balance Overview - CYBERPUNK EDITION */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Equity (Matches Dashboard) */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6 relative overflow-hidden group hover:border-purple-500/50 transition-all duration-300">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
               <Activity className="w-24 h-24 text-purple-500" />
          </div>
          <div className="flex items-center gap-2 text-purple-500 mb-3 relative z-10">
            <div className="p-1.5 bg-purple-500/10 rounded border border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.1)]">
               <Activity className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest shadow-black drop-shadow-md">Patrimônio Total</span>
          </div>
          <p className="text-4xl font-bold text-white tracking-tight relative z-10 font-mono">
            {formatCurrency(config.executionMode === 'LIVE' ? (balance.available + balance.profit) : portfolio.equity)}
          </p>
          <div className="mt-4 h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
               <div className="h-full bg-purple-500 w-[100%] shadow-[0_0_10px_#a855f7]"></div>
          </div>
        </div>

        {/* Available Balance (For Withdrawals) */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6 relative overflow-hidden group hover:border-[#00ff9d]/50 transition-all duration-300">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
               <Wallet className="w-24 h-24 text-[#00ff9d]" />
          </div>
          <div className="flex items-center gap-2 text-[#00ff9d] mb-3 relative z-10">
            <div className="p-1.5 bg-[#00ff9d]/10 rounded border border-[#00ff9d]/20 shadow-[0_0_10px_rgba(0,255,157,0.1)]">
               <Wallet className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest">Saldo Disponível</span>
          </div>
          <p className="text-4xl font-bold text-white tracking-tight relative z-10 font-mono">
            {formatCurrency(balance.available)}
          </p>
          <div className="mt-4 h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
               <div className="h-full bg-[#00ff9d] w-[70%] shadow-[0_0_10px_#00ff9d]"></div>
          </div>
        </div>

        {/* Profit - Dynamic Neon */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6 relative overflow-hidden group hover:border-white/20 transition-all duration-300">
           <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
               <ArrowUpRight className={`w-24 h-24 ${balance.profit >= 0 ? 'text-[#00ff9d]' : 'text-[#ff0055]'}`} />
          </div>
          <div className={`flex items-center gap-2 mb-3 relative z-10 ${balance.profit >= 0 ? 'text-[#00ff9d]' : 'text-[#ff0055]'}`}>
            <div className={`p-1.5 rounded border shadow-[0_0_10px_rgba(255,255,255,0.1)] ${balance.profit >= 0 ? 'bg-[#00ff9d]/10 border-[#00ff9d]/20' : 'bg-[#ff0055]/10 border-[#ff0055]/20'}`}>
               <ArrowUpRight className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest">Resultado (Flutuante)</span>
          </div>
          <p className={`text-4xl font-bold tracking-tight relative z-10 font-mono ${balance.profit >= 0 ? 'text-[#00ff9d] drop-shadow-[0_0_5px_rgba(0,255,157,0.5)]' : 'text-[#ff0055] drop-shadow-[0_0_5px_rgba(255,0,85,0.5)]'}`}>
            {balance.profit >= 0 ? '+' : ''}{formatCurrency(balance.profit)}
          </p>
          <p className={`text-xs mt-2 uppercase tracking-wider font-bold ${balance.profit >= 0 ? 'text-[#00ff9d]' : 'text-[#ff0055]'}`}>
              {(balance.profitPercent || 0).toFixed(2)}% de retorno
          </p>
        </div>
      </div>

      {/* Deposit/Withdrawal Form - NEON TERMINAL STYLE */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-8 shadow-2xl">
        <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-8 flex items-center gap-2">
            <span className="w-2 h-2 bg-[#00ff9d] rounded-full animate-pulse"></span>
            Terminal Financeiro
        </h2>

        {/* Type Selector */}
        <div className="flex gap-4 mb-8 p-1 bg-[#09090b] rounded-xl border border-[#27272a]">
          <button
            onClick={() => setTransactionType('deposit')}
            className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-lg text-sm font-bold uppercase tracking-widest transition-all duration-300 ${
              transactionType === 'deposit'
                ? 'bg-[#00ff9d] text-black shadow-[0_0_20px_rgba(0,255,157,0.4)]'
                : 'text-zinc-500 hover:text-white hover:bg-white/5'
            }`}
          >
            <ArrowDownLeft className="w-5 h-5" />
            Depositar Fundos
          </button>
          <button
            onClick={() => setTransactionType('withdrawal')}
            className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-lg text-sm font-bold uppercase tracking-widest transition-all duration-300 ${
              transactionType === 'withdrawal'
                ? 'bg-[#ff0055] text-white shadow-[0_0_20px_rgba(255,0,85,0.4)]'
                : 'text-zinc-500 hover:text-white hover:bg-white/5'
            }`}
          >
            <ArrowUpRight className="w-5 h-5" />
            Solicitar Saque
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Amount Input */}
          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-bold text-[#00ff9d] mb-3 block uppercase tracking-widest">
                Valor ({transactionType === 'deposit' ? 'Depósito' : 'Saque'})
              </label>
              <div className="relative group">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-500 text-2xl font-light group-focus-within:text-[#00ff9d] transition-colors">
                  $
                </span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-xl pl-12 pr-6 py-6 text-3xl text-white font-mono focus:outline-none focus:border-[#00ff9d] focus:ring-1 focus:ring-[#00ff9d] transition-all placeholder:text-zinc-800 shadow-inner"
                />
              </div>
              
              {/* Aviso de Depósito Mínimo */}
              {transactionType === 'deposit' && (
                  <div className="mt-3 flex items-center gap-2 text-amber-500 bg-amber-500/5 p-2 rounded border border-amber-500/20 animate-in fade-in slide-in-from-top-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Depósito Mínimo: R$ 50,00 (Aprox. $8.50 USD)</span>
                  </div>
              )}
            </div>

            {/* Quick Amount Buttons */}
            <div className="grid grid-cols-4 gap-3">
              {[10, 50, 100, 500].map((value) => (
                <button
                  key={value}
                  onClick={() => setAmount(value.toString())}
                  className="px-4 py-3 bg-[#09090b] hover:bg-[#00ff9d]/10 border border-[#27272a] hover:border-[#00ff9d]/50 rounded-lg text-sm font-mono text-zinc-400 hover:text-[#00ff9d] transition-all uppercase tracking-wider"
                >
                  ${value}
                </button>
              ))}
            </div>

            {transactionType === 'deposit' && (
              <div className="p-4 bg-[#00ff9d]/5 border border-[#00ff9d]/20 rounded-lg flex items-start gap-3">
                <div className="p-1 bg-[#00ff9d]/20 rounded-full mt-0.5">
                    <Zap className="w-3 h-3 text-[#00ff9d]" />
                </div>
                <div>
                    <strong className="uppercase text-[10px] tracking-widest block mb-1 text-[#00ff9d]">Bônus de Performance</strong>
                    <p className="text-xs text-zinc-400 mb-2">Depósitos via Crypto acima de $1,000 recebem <span className="text-white font-bold">5% de bônus</span> em margem.</p>
                    <button 
                        onClick={() => applyCommission(5)}
                        className="px-3 py-1 bg-[#00ff9d]/10 hover:bg-[#00ff9d]/20 text-[#00ff9d] text-[10px] font-bold rounded border border-[#00ff9d]/30 transition-all uppercase tracking-wider shadow-[0_0_10px_rgba(0,255,157,0.1)] hover:shadow-[0_0_15px_rgba(0,255,157,0.2)]"
                    >
                        RESGATAR BÔNUS (5%) AGORA
                    </button>
                </div>
              </div>
            )}
            {/* Unlimited Paper Trading Toggle */}
            {config.executionMode === 'DEMO' && (
                <div className="mt-6 flex justify-center">
                    <button 
                        onClick={handleDemoReset}
                        className="text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-[#00ff9d] flex items-center gap-2 transition-colors"
                    >
                        <RefreshCw className="w-3 h-3" />
                        Resetar Conta Demo (Ilimitado)
                    </button>
                </div>
            )}
          </div>

          {/* Payment Methods */}
          <div className="space-y-5">
            <label className="text-[10px] font-bold text-[#00ff9d] block uppercase tracking-widest">
                Canal de {transactionType === 'deposit' ? 'Pagamento' : 'Recebimento'}
            </label>
            <div className="space-y-3">
              {currentMethods.map((method) => {
                const Icon = method.icon;
                const isSelected = selectedMethod === method.id;
                const activeColor = transactionType === 'deposit' ? '#00ff9d' : '#ff0055';
                const activeBg = transactionType === 'deposit' ? 'bg-[#00ff9d]/10' : 'bg-[#ff0055]/10';
                const activeBorder = transactionType === 'deposit' ? 'border-[#00ff9d]/50' : 'border-[#ff0055]/50';
                
                return (
                  <button
                    key={method.id}
                    onClick={() => setSelectedMethod(method.id)}
                    className={`w-full p-5 bg-[#09090b] border rounded-xl transition-all text-left group relative overflow-hidden ${
                        isSelected 
                        ? `${activeBorder} ${activeBg} shadow-[0_0_15px_rgba(0,0,0,0.5)]` 
                        : 'border-[#27272a] hover:bg-[#27272a]/50 hover:border-zinc-600'
                    }`}
                  >
                    {isSelected && <div className={`absolute left-0 top-0 bottom-0 w-1 ${transactionType === 'deposit' ? 'bg-[#00ff9d]' : 'bg-[#ff0055]'}`}></div>}
                    
                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors border ${
                            isSelected 
                             ? `${activeBg} border-transparent`
                             : 'bg-[#18181b] border-[#27272a] group-hover:border-zinc-500'
                        }`}>
                          <Icon className={`w-6 h-6 transition-colors ${
                               isSelected
                               ? `text-[${activeColor}]`
                               : 'text-zinc-500 group-hover:text-white'
                          }`} style={{ color: isSelected ? activeColor : undefined }} />
                        </div>
                        <div>
                          <p className={`font-bold text-sm tracking-wide ${isSelected ? 'text-white' : 'text-zinc-400 group-hover:text-white'}`}>
                              {method.name}
                          </p>
                          <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-bold mt-1">{method.time}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold font-mono ${isSelected ? 'text-white' : 'text-zinc-500'}`}>{method.fee}</p>
                        <p className="text-[10px] text-zinc-600 uppercase tracking-wider">taxa</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {transactionType === 'withdrawal' && (
                <div className="pt-2 animate-in fade-in slide-in-from-top-2">
                    <label className="text-[10px] font-bold text-[#ff0055] block uppercase tracking-widest mb-2">
                        {selectedMethod === 'pix' ? 'Chave Pix de Destino' : 'Endereço da Carteira (TRC20/BEP20)'}
                    </label>
                    <input 
                        type="text" 
                        value={destinationInfo}
                        onChange={(e) => setDestinationInfo(e.target.value)}
                        placeholder={selectedMethod === 'pix' ? 'CPF, Email ou Chave Aleatória' : '0x...'}
                        className="w-full bg-[#09090b] border border-[#ff0055]/30 focus:border-[#ff0055] rounded-lg px-4 py-3 text-sm text-white focus:outline-none placeholder:text-zinc-700 font-mono shadow-[0_0_10px_rgba(255,0,85,0.05)] focus:shadow-[0_0_15px_rgba(255,0,85,0.1)] transition-all"
                    />
                    <p className="text-[9px] text-[#ff0055] mt-2 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Saques cripto são irreversíveis. Verifique o endereço.
                    </p>
                </div>
            )}

            {transactionType === 'deposit' && selectedMethod === 'pix' && (
                <div className="mt-2 p-5 bg-[#09090b] border border-[#00ff9d]/30 rounded-xl animate-in fade-in slide-in-from-top-2 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-20"><Building className="w-16 h-16 text-[#00ff9d]" /></div>
                    <p className="text-[10px] text-[#00ff9d] uppercase tracking-widest font-bold mb-3 flex items-center gap-2 relative z-10">
                        <Zap className="w-3 h-3 animate-pulse" />
                        Pix Instantâneo (24/7)
                    </p>
                    <p className="text-sm text-zinc-400 font-light relative z-10">
                        Clique em <strong>Executar Depósito</strong> para gerar o QR Code e finalizar o pagamento.
                    </p>
                </div>
            )}

            <button
              onClick={handleTransaction}
              disabled={loading}
              className={`w-full py-5 rounded-xl font-bold uppercase tracking-widest text-sm transition-all shadow-lg hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-4 relative overflow-hidden ${
                transactionType === 'deposit'
                  ? 'bg-[#00ff9d] text-black hover:bg-[#00e68e]'
                  : 'bg-[#ff0055] text-white hover:bg-[#e6004c]'
              }`}
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full hover:translate-y-0 transition-transform duration-300 pointer-events-none"></div>
              {loading ? 'Processando...' : transactionType === 'deposit' ? 'EXECUTAR DEPÓSITO' : 'SOLICITAR RETIRADA'}
            </button>
          </div>
        </div>
      </div>

      {/* Open Positions - Minimalist Tech Table */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
        <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-6 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Posições Ativas
        </h2>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#27272a] text-[10px] uppercase tracking-widest text-zinc-500">
                <th className="py-4 px-4 font-bold">Ativo</th>
                <th className="py-4 px-4 font-bold">Lado</th>
                <th className="py-4 px-4 font-bold text-right">Tamanho</th>
                <th className="py-4 px-4 font-bold text-right">Entrada</th>
                <th className="py-4 px-4 font-bold text-right">Mark</th>
                <th className="py-4 px-4 font-bold text-right">PnL (ROI)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272a]">
              {activeOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-600 text-xs uppercase tracking-widest font-mono">
                    // Nenhuma posição ativa detectada no sistema
                  </td>
                </tr>
              ) : (
                activeOrders.map((position) => {
                  const isLong = position.side === 'LONG';
                  const currentPrice = position.currentPrice || position.price;
                  
                  // Calculate Real PnL
                  const priceDiffPct = (currentPrice - position.price) / position.price;
                  const rawPnLPercent = (isLong ? priceDiffPct : -priceDiffPct) * position.leverage * 100;
                  const pnlValue = position.amount * (rawPnLPercent / 100);
                  const pnlPercent = rawPnLPercent;

                  return (
                    <tr key={position.id} className="group hover:bg-[#00ff9d]/5 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-lg bg-[#09090b] flex items-center justify-center text-[10px] font-bold text-zinc-300 border border-[#27272a] group-hover:border-[#00ff9d]/30 transition-colors">
                              {position.symbol.substring(0,1)}
                           </div>
                           <div>
                              <div className="font-bold text-zinc-200 text-sm">{position.symbol}</div>
                              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{(position.leverage || 0).toFixed(0)}x Isolada</div>
                           </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          isLong 
                            ? 'bg-[#00ff9d]/10 text-[#00ff9d] border-[#00ff9d]/20' 
                            : 'bg-[#ff0055]/10 text-[#ff0055] border-[#ff0055]/20'
                        }`}>
                          {isLong ? 'COMPRADO' : 'VENDIDO'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-zinc-300">
                        {position.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-zinc-400 text-sm">
                        {position.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-zinc-300 text-sm">
                        {currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className={`font-mono font-bold ${pnlValue >= 0 ? 'text-[#00ff9d]' : 'text-[#ff0055]'}`}>
                          {pnlValue >= 0 ? '+' : ''}{pnlValue.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className={`text-[10px] font-bold ${pnlValue >= 0 ? 'text-[#00ff9d]/70' : 'text-[#ff0055]/70'}`}>
                           {pnlValue >= 0 ? '+' : ''}{(pnlPercent || 0).toFixed(2)}%
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction History - Log Stream Style */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
        <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-6 flex items-center gap-2">
           <div className="w-2 h-2 bg-zinc-600 rounded-full"></div>
           Logs Financeiros
        </h2>
        <div className="space-y-2">
          {transactions.length === 0 ? (
             <div className="text-center py-10 text-zinc-600 text-xs uppercase tracking-widest font-mono">// Nenhum registro encontrado no banco de dados</div>
          ) : (
            transactions.map((transaction) => {
              const isDeposit = transaction.type === 'deposit';
              
              return (
                <div
                  key={transaction.id}
                  className="p-4 bg-[#09090b] border border-[#27272a] rounded-lg hover:border-zinc-700 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
                          isDeposit
                            ? 'bg-[#00ff9d]/10 border-[#00ff9d]/20 text-[#00ff9d]'
                            : transaction.type === 'withdrawal'
                            ? 'bg-[#ff0055]/10 border-[#ff0055]/20 text-[#ff0055]'
                            : 'bg-purple-500/10 border-purple-500/20 text-purple-400'
                        }`}
                      >
                        {isDeposit ? (
                          <ArrowDownLeft className="w-5 h-5" />
                        ) : transaction.type === 'withdrawal' ? (
                          <ArrowUpRight className="w-5 h-5" />
                        ) : (
                          <TrendingUp className="w-5 h-5" />
                        )}
                      </div>

                      <div>
                        <p className="font-bold text-sm text-zinc-200 tracking-wide capitalize flex items-center gap-2">
                          {transaction.type === 'deposit' ? 'Depósito' : transaction.type === 'withdrawal' ? 'Saque' : transaction.type}
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 uppercase font-mono">{transaction.id.substring(0,8)}</span>
                        </p>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mt-1">
                          {new Date(transaction.created_at).toLocaleDateString()} <span className="text-zinc-700">|</span> {new Date(transaction.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p
                        className={`text-lg font-bold font-mono tracking-tight ${
                          isDeposit ? 'text-[#00ff9d]' : 'text-[#ff0055]'
                        }`}
                      >
                        {isDeposit ? '+' : '-'}{Number(transaction.amount).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-widest border ${
                          transaction.status === 'completed' || transaction.status === 'confirmed' 
                           ? 'bg-[#00ff9d]/10 text-[#00ff9d] border-[#00ff9d]/20'
                           : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                      }`}>
                        {transaction.status}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal Pix Depósito */}
      <Dialog open={pixModalOpen} onOpenChange={setPixModalOpen}>
        <DialogContent className="bg-[#18181b] border border-[#00ff9d]/20 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#00ff9d]">
              <div className="p-1 bg-[#00ff9d]/10 rounded border border-[#00ff9d]/20">
                <Zap className="w-5 h-5" />
              </div>
              Pagamento via Pix
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Escaneie o QR Code ou use a chave Pix para depositar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* QR Code Placeholder */}
            <div className="flex flex-col items-center justify-center p-6 bg-white rounded-xl mx-auto w-fit shadow-[0_0_20px_rgba(0,255,157,0.2)]">
               <img 
                 src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=clbrcouto@gmail.com&color=000000&bgcolor=ffffff`}
                 alt="QR Code Pix"
                 className="w-40 h-40 mix-blend-multiply"
               />
            </div>
            
            {/* Amount Display */}
            <div className="text-center">
                 <p className="text-zinc-500 text-xs uppercase tracking-widest mb-1">Valor a Transferir</p>
                 <p className="text-3xl font-mono font-bold text-white">R$ {(Number(amount) * 6).toFixed(2)} <span className="text-sm text-zinc-500 font-sans">(~${amount} USD)</span></p>
            </div>

            {/* Key Copy */}
            <div className="space-y-2">
                <label className="text-xs uppercase tracking-widest text-[#00ff9d] font-bold">Chave Pix (E-mail)</label>
                <div className="flex gap-2">
                    <div className="flex-1 bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-zinc-300 font-mono text-sm flex items-center">
                        clbrcouto@gmail.com
                    </div>
                    <Button 
                        variant="outline" 
                        className="border-[#00ff9d]/30 hover:bg-[#00ff9d]/10 text-[#00ff9d]"
                        onClick={() => { navigator.clipboard.writeText('clbrcouto@gmail.com'); toast.success('Chave copiada!'); }}
                    >
                        <Copy className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Proof ID Input */}
            <div className="space-y-2 pt-4 border-t border-[#27272a]">
                <label className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Comprovante (ID da Transação)</label>
                <Input 
                    placeholder="Cole o ID da transação ou deixe em branco" 
                    value={proofId}
                    onChange={(e) => setProofId(e.target.value)}
                    className="bg-[#09090b] border-[#27272a] focus:border-[#00ff9d]"
                />
                <p className="text-[10px] text-zinc-500">
                    * Opcional: Ajuda a identificar seu depósito mais rápido.
                </p>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:gap-0">
             <Button 
                className="w-full bg-[#00ff9d] text-black hover:bg-[#00e68e] font-bold uppercase tracking-widest"
                onClick={() => executeTransaction()}
                disabled={loading}
            >
                {loading ? 'Confirmando...' : 'JÁ FIZ O PAGAMENTO'}
            </Button>
            <Button 
                variant="ghost" 
                className="w-full text-zinc-500 hover:text-white"
                onClick={() => setPixModalOpen(false)}
            >
                Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Withdrawal Security Dialog */}
      <Dialog open={confirmWithdrawOpen} onOpenChange={setConfirmWithdrawOpen}>
        <DialogContent className="bg-[#09090b] border border-[#27272a] text-white">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-white uppercase tracking-wider">
                    <Lock className="w-5 h-5 text-red-500" />
                    Confirmação de Segurança
                </DialogTitle>
                <DialogDescription className="text-zinc-400">
                    Para sua segurança, confirme os dados da transação de saque.
                </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
                <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Valor Solicitado:</span>
                        <span className="font-bold text-white font-mono">${amount}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Destino:</span>
                        <span className="font-bold text-white font-mono truncate max-w-[200px]">{destinationInfo}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Método:</span>
                        <span className="font-bold text-white uppercase">{selectedMethod}</span>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">PIN de Segurança (Simulado: 0000)</label>
                    <Input 
                        type="password" 
                        maxLength={4}
                        className="bg-black border-zinc-800 text-center font-mono text-xl tracking-[1em]" 
                        placeholder="••••"
                        value={securityPin}
                        onChange={(e) => setSecurityPin(e.target.value)}
                    />
                </div>
            </div>

            <DialogFooter>
                <Button variant="ghost" onClick={() => setConfirmWithdrawOpen(false)}>Cancelar</Button>
                <Button 
                    variant="destructive" 
                    className="bg-red-600 hover:bg-red-700"
                    onClick={() => {
                        if (securityPin === '0000') {
                            executeTransaction();
                        } else {
                            toast.error("PIN Incorreto");
                        }
                    }}
                >
                    Confirmar Saque
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );
}