import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle, ArrowRight, Download, Share2, Wallet, Home, Copy } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

interface PaymentSuccessProps {
  data: {
    amount?: string | null;
    currency?: string | null;
    plan?: string | null;
    sessionId?: string | null;
    isSimulated?: boolean;
    reason?: string | null;
    keyDebug?: string | null;
    date?: Date;
  };
  onNavigate: (view: any) => void;
}

export function PaymentSuccess({ data, onNavigate }: PaymentSuccessProps) {
  const { amount, currency = 'USD', plan, sessionId, isSimulated, reason, keyDebug, date = new Date() } = data || {};

  const handleCopyId = () => {
    if (sessionId) {
      navigator.clipboard.writeText(sessionId);
      toast.success("ID da transação copiado!");
    }
  };

  return (
    <div className="h-full w-full flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, type: "spring" }}
        className="relative z-10 w-full max-w-lg bg-[#09090b] border border-[#27272a] rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="bg-[#18181b] p-8 text-center border-b border-[#27272a] relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10"></div>
          <div className="relative z-10">
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
            >
              <CheckCircle className="w-10 h-10 text-emerald-500" />
            </motion.div>
            
            <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">
              {isSimulated ? 'Simulação Concluída' : 'Pagamento Confirmado!'}
            </h1>
            <p className="text-zinc-400 text-sm">
              {isSimulated 
                ? "O valor foi creditado na sua conta demo para fins de teste."
                : "Sua transação foi processada e os créditos já estão disponíveis."
              }
            </p>
          </div>
        </div>

        {/* Receipt Details */}
        <div className="p-8 space-y-6">
          <div className="flex flex-col items-center justify-center py-6 bg-[#121214] rounded-xl border border-[#27272a]">
            <p className="text-zinc-500 text-xs uppercase tracking-widest mb-2 font-bold">Valor Total</p>
            <div className="text-4xl font-mono font-bold text-white tracking-tight flex items-baseline gap-1">
              {plan ? (
                <span>{plan.toUpperCase()}</span>
              ) : (
                <>
                  <span className="text-lg text-emerald-500">$</span>
                  {amount}
                  <span className="text-sm text-zinc-500 ml-1">{currency}</span>
                </>
              )}
            </div>
            {isSimulated && (
              <div className="flex flex-col gap-2 items-center mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg w-full">
                 <span className="text-yellow-500 text-xs font-bold uppercase tracking-widest">
                    Ambiente de Teste (Simulado)
                 </span>
                 {reason && (
                    <div className="text-center">
                        <span className="text-xs text-zinc-400 block">Código de Diagnóstico:</span>
                        <code className="text-sm font-mono text-white bg-black/50 px-2 py-1 rounded mt-1 block">
                           {reason}
                        </code>
                        {keyDebug && (
                            <span className="text-[10px] text-zinc-500 block mt-1">
                                Prefixo da Chave: {keyDebug}
                            </span>
                        )}
                        <p className="text-[10px] text-zinc-500 mt-2 max-w-xs mx-auto">
                            Se você esperava um pagamento real, verifique se a variável STRIPE_SECRET_KEY está configurada corretamente no Supabase.
                        </p>
                    </div>
                 )}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-zinc-500">Status</span>
              <span className="text-emerald-500 font-bold flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Concluído
              </span>
            </div>
            <div className="h-px bg-[#27272a]" />
            
            <div className="flex justify-between items-center text-sm">
              <span className="text-zinc-500">Data</span>
              <span className="text-zinc-300 font-mono">
                {date.toLocaleDateString()} <span className="text-zinc-600">|</span> {date.toLocaleTimeString()}
              </span>
            </div>
            <div className="h-px bg-[#27272a]" />

            {sessionId && (
              <div className="flex justify-between items-center text-sm group">
                <span className="text-zinc-500">ID da Transação</span>
                <button 
                  onClick={handleCopyId}
                  className="text-zinc-300 font-mono hover:text-emerald-500 transition-colors flex items-center gap-2 text-xs"
                >
                  {sessionId.slice(0, 12)}...{sessionId.slice(-4)}
                  <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>
            )}
            <div className="h-px bg-[#27272a]" />
            
            <div className="flex justify-between items-center text-sm">
              <span className="text-zinc-500">Método</span>
              <span className="text-zinc-300 capitalize">{isSimulated ? 'Simulação' : 'Stripe / Pix'}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-8 pt-0 flex flex-col gap-3">
          <Button 
            onClick={() => onNavigate('dashboard')}
            className="w-full bg-white text-black hover:bg-zinc-200 font-bold py-6 text-base"
          >
            <Home className="w-4 h-4 mr-2" />
            Voltar ao Dashboard
          </Button>
          
          <div className="grid grid-cols-2 gap-3">
             <Button 
                variant="outline" 
                onClick={() => onNavigate('funds')}
                className="w-full border-[#27272a] hover:bg-[#27272a] hover:text-white"
             >
                <Wallet className="w-4 h-4 mr-2" />
                Ver Carteira
             </Button>
             <Button 
                variant="outline"
                className="w-full border-[#27272a] hover:bg-[#27272a] hover:text-white"
                onClick={() => toast.info("Comprovante baixado (Simulação)")}
             >
                <Download className="w-4 h-4 mr-2" />
                Comprovante
             </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
