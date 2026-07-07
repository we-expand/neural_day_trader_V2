import React, { useState } from 'react';
import { CreditCard, Check, Zap, Shield, Crown, Building } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';

export function BillingSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = async (plan: string) => {
    if (!user) {
        toast.error("Erro de autenticação", { description: "Você precisa estar logado para assinar." });
        return;
    }
    
    setLoading(plan);
    toast.loading(`Iniciando checkout do plano ${plan.toUpperCase()}...`);

    try {
        const response = await fetch(`https://${projectId}.supabase.co/functions/v1/server/checkout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}` },
            body: JSON.stringify({ 
                planId: plan, 
                userId: user.id, 
                email: user.email
            })
        });

        const data = await response.json();
        
        if (data.error) throw new Error(data.error);
        
        if (data.url) {
             if (data.simulated) {
                 toast.dismiss();
                 toast.success("Redirecionando para Checkout Simulado...");
             } else {
                 toast.dismiss();
                 toast.success("Redirecionando para Stripe Checkout...");
             }
             // Delay to allow user to see the toast
             setTimeout(() => {
                 window.location.href = data.url;
             }, 1000);
        }
    } catch (error: any) {
        toast.dismiss();
        toast.error("Erro ao iniciar pagamento", { description: error.message });
        setLoading(null);
    }
  };

  const plans = [
    {
      id: 'starter',
      name: 'Starter Neural',
      price: 'R$ 0,00',
      period: '/mês',
      description: 'Acesso básico ao scanner de mercado.',
      features: ['Scanner com 15min de delay', '3 Ativos Simultâneos', 'Sem acesso à API', 'Suporte via Comunidade'],
      icon: Zap,
      color: 'text-slate-400',
      border: 'border-white/10',
      button: 'Plano Atual',
      current: true
    },
    {
      id: 'pro',
      name: 'Pro Trader',
      price: 'R$ 97,00',
      period: '/mês',
      description: 'Poder total para traders individuais.',
      features: ['Dados em Tempo Real', 'Scanner Ilimitado', 'Integração MT5', 'Sinais via Telegram/Voice', 'Prioridade no Suporte'],
      icon: Crown,
      color: 'text-emerald-400',
      border: 'border-emerald-500/30',
      bg: 'bg-emerald-500/5',
      button: 'Assinar Pro',
      popular: true
    },
    {
      id: 'enterprise',
      name: 'Institutional',
      price: 'R$ 497,00',
      period: '/mês',
      description: 'Infraestrutura dedicada para fundos.',
      features: ['API Dedicada (Low Latency)', 'Multi-Contas MT5', 'Gestão de Risco Avançada', 'Gerente de Conta Dedicado', 'Custom Neural Models'],
      icon: Building,
      color: 'text-purple-400',
      border: 'border-purple-500/30',
      button: 'Falar com Vendas'
    }
  ];

  return (
    <div className="space-y-6">
        <div className="bg-neutral-950/50 border border-white/5 rounded-xl p-6 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                    <CreditCard className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                    <h2 className="text-sm font-bold text-white uppercase tracking-widest">Assinatura & Pagamentos</h2>
                    <p className="text-[10px] text-slate-500">Gerencie seu plano de acesso à Neural Day Trader</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {plans.map((plan) => (
                    <div key={plan.id} className={`relative flex flex-col p-6 rounded-xl border ${plan.border} ${plan.bg || 'bg-black/40'} transition-all hover:border-opacity-100 hover:shadow-2xl hover:shadow-${plan.color.split('-')[1]}-500/10`}>
                        {plan.popular && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-emerald-500 text-black text-[10px] font-bold uppercase tracking-widest rounded-full shadow-lg shadow-emerald-500/20">
                                Mais Popular
                            </div>
                        )}
                        
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`p-2 rounded-lg bg-white/5 ${plan.color}`}>
                                <plan.icon className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                        </div>

                        <div className="mb-6">
                            <span className="text-3xl font-bold text-white">{plan.price}</span>
                            <span className="text-slate-500 text-sm">{plan.period}</span>
                        </div>

                        <ul className="space-y-3 mb-8 flex-1">
                            {plan.features.map((feature, i) => (
                                <li key={i} className="flex items-start gap-3 text-sm text-slate-400">
                                    <Check className={`w-4 h-4 shrink-0 ${plan.color}`} />
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>

                        <button 
                            onClick={() => !plan.current && handleSubscribe(plan.id)}
                            disabled={plan.current || loading === plan.id}
                            className={`w-full py-3 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                                plan.current 
                                    ? 'bg-white/5 text-slate-500 cursor-default' 
                                    : plan.id === 'pro'
                                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20'
                                        : 'bg-white/10 hover:bg-white/20 text-white'
                            }`}
                        >
                            {loading === plan.id ? 'Processando...' : plan.button}
                        </button>
                    </div>
                ))}
            </div>

            <div className="mt-8 p-4 bg-blue-900/10 border border-blue-500/20 rounded-lg flex items-start gap-4">
                <div className="p-2 bg-blue-500/20 rounded-full shrink-0">
                    <Shield className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                    <h4 className="text-sm font-bold text-blue-400 mb-1">Pagamentos Seguros</h4>
                    <p className="text-xs text-blue-200/70 leading-relaxed">
                        Todas as transações são processadas via <strong>Stripe</strong> ou <strong>Asaas</strong> (Pix/Boleto). 
                        Nenhum dado de cartão é armazenado em nossos servidores. Garantia de 7 dias ou seu dinheiro de volta.
                    </p>
                </div>
            </div>
        </div>
    </div>
  );
}
