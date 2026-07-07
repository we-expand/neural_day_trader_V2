import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { CheckCircle2, ShieldCheck, Wallet, Loader2, AlertTriangle, QrCode, CreditCard, Banknote } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { useTradingContext } from '../../contexts/TradingContext';
import { supabase } from '../../../lib/supabaseClient';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DepositModal({ isOpen, onClose }: DepositModalProps) {
  const [amount, setAmount] = useState<string>('100');
  const [currency, setCurrency] = useState<'BRL' | 'USD'>('BRL');
  const [loading, setLoading] = useState(false);
  const { config } = useTradingContext();

  const handleDeposit = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 10) {
      toast.error('Valor mínimo para depósito é 10.00');
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('Você precisa estar logado para depositar.');
        setLoading(false);
        return;
      }

      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/server/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          amount: numAmount,
          currency: currency.toLowerCase(),
          userId: user.id,
          email: user.email
        })
      });

      const data = await response.json();

      if (data.error) throw new Error(data.error);
      
      if (data.url) {
        if (data.simulated) {
             toast.warning("Redirecionando para Ambiente Simulado", {
                 description: data.warning || "Chave de pagamento inválida ou ausente.",
                 duration: 5000
             });
        }
        // Redirect to Stripe
        window.location.href = data.url;
      } else {
        toast.error('Erro ao gerar link de pagamento.');
      }

    } catch (error: any) {
      console.error('Deposit Error:', error);
      toast.error(`Falha no depósito: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-[#0A0A0A] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black tracking-tight">
            <Wallet className="w-6 h-6 text-emerald-500" />
            Adicionar Fundos
          </DialogTitle>
          <DialogDescription className="text-neutral-400">
            Deposite fundos reais na sua carteira segura.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          
          <Tabs defaultValue="BRL" onValueChange={(v) => setCurrency(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-neutral-900">
              <TabsTrigger value="BRL" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white font-bold">
                 🇧🇷 Real Brasileiro (BRL)
              </TabsTrigger>
              <TabsTrigger value="USD" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white font-bold">
                 🇺🇸 Dólar (USD)
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid gap-2">
            <Label htmlFor="amount" className="text-neutral-300 font-bold">Valor do Depósito</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 font-bold">
                {currency === 'BRL' ? 'R$' : '$'}
              </span>
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-10 bg-black/20 border-white/10 text-white font-mono text-lg font-bold focus:border-emerald-500/50"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="bg-emerald-900/10 border border-emerald-500/20 rounded-lg p-3 flex gap-3 items-start">
             <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
             <div className="space-y-1">
                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Pagamento Seguro</h4>
                <p className="text-[11px] text-neutral-400 leading-snug">
                   Processado via Stripe Payments. Seus dados são criptografados.
                   {currency === 'BRL' && <span className="block mt-1 text-emerald-300 font-bold flex items-center gap-1"><QrCode className="w-3 h-3"/> PIX Disponível no Checkout</span>}
                </p>
             </div>
          </div>

          {config.executionMode === 'DEMO' && (
             <div className="bg-amber-900/10 border border-amber-500/20 rounded-lg p-3 flex gap-3 items-start">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                   <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Modo Simulação Ativo</h4>
                   <p className="text-[11px] text-neutral-400 leading-snug">
                      Você está em modo DEMO. Depósitos reais creditarão na sua conta, mas para usar em trading real, mude para modo LIVE nas configurações.
                   </p>
                </div>
             </div>
          )}
        </div>

        <DialogFooter>
          <Button 
            onClick={handleDeposit} 
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold tracking-wide"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Confirmar Depósito
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
