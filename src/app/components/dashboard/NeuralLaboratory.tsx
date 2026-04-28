import React, { useState } from 'react';
import { Brain, Cpu, Dna, Lock, Unlock, Zap, BarChart2, TrendingUp, Globe, Activity, MousePointer2, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

type TraderProfile = {
  id: string;
  name: string;
  role: string;
  philosophy: string;
  coreStrategy: string;
  focus: string[];
  status: 'LOCKED' | 'ACTIVE' | 'AVAILABLE';
  price: string;
  color: string;
  icon: any;
};

const TRADERS: TraderProfile[] = [
  {
    id: 'soros',
    name: 'George Soros',
    role: 'The Alchemist',
    philosophy: 'Teoria da Reflexividade',
    coreStrategy: 'Identificar ciclos de "boom/bust" onde a percepção dos participantes afeta a realidade do mercado.',
    focus: ['Falsos Rompimentos', 'Divergência de Sentimento', 'Feedback Loops'],
    status: 'ACTIVE',
    price: 'OWNED',
    color: 'text-emerald-400',
    icon: Globe
  },
  {
    id: 'livermore',
    name: 'Jesse Livermore',
    role: 'The Speculator',
    philosophy: 'Price Action Puro',
    coreStrategy: 'Comprar em "Pivot Points" e aumentar posições vencedoras (Pyramiding).',
    focus: ['Volume Confirmation', 'Pivot Points', 'Paciência'],
    status: 'AVAILABLE',
    price: '$99',
    color: 'text-amber-400',
    icon: TrendingUp
  },
  {
    id: 'ptj',
    name: 'Paul Tudor Jones',
    role: 'The Macro Trader',
    philosophy: 'Contrarian Aggressive',
    coreStrategy: 'Buscar topos e fundos com Risco:Retorno assimétrico (5:1). Uso massivo da MA200.',
    focus: ['200-Day MA', 'Risk/Reward 5:1', 'Extremos de Mercado'],
    status: 'AVAILABLE',
    price: '$99',
    color: 'text-blue-400',
    icon: Activity
  },
  {
    id: 'druckenmiller',
    name: 'Stanley Druckenmiller',
    role: 'The Growth Macro',
    philosophy: 'Liquidez & Concentração',
    coreStrategy: 'Analisar fluxos de Bancos Centrais. Apostar grande quando a convicção é alta.',
    focus: ['Política Monetária', 'Fluxo de Liquidez', 'Apostas Concentradas'],
    status: 'AVAILABLE',
    price: '$149',
    color: 'text-purple-400',
    icon: BarChart2
  },
  {
    id: 'dennis',
    name: 'Richard Dennis',
    role: 'The Turtle',
    philosophy: 'Trend Following',
    coreStrategy: 'Seguir a tendência mecanicamente. Comprar rompimentos de 20 ou 55 dias.',
    focus: ['Breakouts', 'Gestão de Volatilidade (N)', 'Trailing Stops'],
    status: 'AVAILABLE',
    price: '$79',
    color: 'text-teal-400',
    icon: MousePointer2
  },
  {
    id: 'simons',
    name: 'Jim Simons',
    role: 'The Quant King',
    philosophy: 'Matemática Pura',
    coreStrategy: 'Arbitragem estatística e reconhecimento de padrões não-lineares.',
    focus: ['Anomalias Estatísticas', 'Trading Algorítmico', 'Pattern Recognition'], // ✅ MUDADO: High Frequency → Trading Algorítmico
    status: 'LOCKED',
    price: '$299',
    color: 'text-rose-400',
    icon: Cpu
  }
];

export function NeuralLaboratory() {
  const [profiles, setProfiles] = useState(TRADERS);

  const handleInstall = (id: string, price: string) => {
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 2000)),
      {
        loading: `Processando pagamento de ${price}...`,
        success: () => {
          setProfiles(prev => prev.map(p => p.id === id ? { ...p, status: 'ACTIVE', price: 'OWNED' } : p));
          return 'Pagamento Aprovado: Algoritmo Integrado';
        },
        error: 'Erro na transação'
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-white/5 pb-4">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
            <Brain className="w-4 h-4 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-widest">Laboratório Neural</h2>
          <p className="text-[10px] text-slate-500">Módulos de IA baseados em Traders Lendários</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {profiles.map((trader) => (
          <div 
            key={trader.id}
            className={`
              relative p-5 rounded-xl border transition-all duration-300 group
              ${trader.status === 'ACTIVE' 
                ? 'bg-emerald-500/5 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                : 'bg-black/40 border-white/5 hover:border-white/15 hover:bg-white/[0.02]'
              }
            `}
          >
            {/* Status Indicator */}
            <div className="absolute top-4 right-4">
               {trader.status === 'ACTIVE' && (
                 <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-400 uppercase">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Ativo
                 </div>
               )}
               {trader.status === 'LOCKED' && (
                 <Lock className="w-4 h-4 text-slate-700" />
               )}
            </div>

            {/* Header */}
            <div className="flex items-center gap-4 mb-4">
               <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-black border border-white/10 ${trader.color}`}>
                  <trader.icon className="w-6 h-6" />
               </div>
               <div>
                  <h3 className="text-sm font-bold text-white">{trader.name}</h3>
                  <span className={`text-[10px] font-mono uppercase tracking-wider ${trader.color} opacity-80`}>
                     {trader.role}
                  </span>
               </div>
            </div>

            {/* Content */}
            <div className="space-y-3 mb-6">
               <div>
                  <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Filosofia</span>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed border-l-2 border-white/10 pl-3">
                    "{trader.philosophy}"
                  </p>
               </div>
               
               <div>
                  <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Core Strategy</span>
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                     {trader.coreStrategy}
                  </p>
               </div>

               <div className="flex flex-wrap gap-1.5 mt-2">
                  {trader.focus.map((tag, idx) => (
                     <span key={idx} className="px-2 py-0.5 rounded bg-white/5 border border-white/5 text-[9px] text-slate-400 font-mono">
                        {tag}
                     </span>
                  ))}
               </div>
            </div>

            {/* Action Button */}
            {trader.status === 'AVAILABLE' && (
               <button 
                 onClick={() => handleInstall(trader.id, trader.price)}
                 className="w-full py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 text-xs font-bold text-white uppercase tracking-wider transition-all flex items-center justify-center gap-2 group-hover:bg-indigo-500 group-hover:border-indigo-500 group-hover:text-white"
               >
                  <CreditCard className="w-3 h-3" />
                  Comprar {trader.price}
               </button>
            )}
             {trader.status === 'LOCKED' && (
               <button 
                 disabled
                 className="w-full py-2 rounded-lg bg-black/20 border border-white/5 text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center justify-center gap-2 cursor-not-allowed"
               >
                  <Lock className="w-3 h-3" />
                  Nível Insuficiente ({trader.price})
               </button>
            )}
             {trader.status === 'ACTIVE' && (
               <div className="w-full py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center justify-center gap-2">
                  <Zap className="w-3 h-3" />
                  Instalado
               </div>
            )}

          </div>
        ))}
      </div>
    </div>
  );
}