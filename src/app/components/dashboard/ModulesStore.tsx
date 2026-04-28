import React from 'react';
import { ShoppingBag, Zap, Shield, Globe, Download, Check, ArrowRight, Activity, Lock } from 'lucide-react';
import { motion } from 'motion/react';

export function ModulesStore() {
  return (
    <div className="p-8 h-full overflow-y-auto pb-20">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Módulos & Expansões</h1>
            <p className="text-slate-400 mt-2">Potencialize sua operação com ferramentas institucionais apartadas.</p>
          </div>
          <div className="flex gap-4">
             <div className="text-right">
                <div className="text-[10px] text-slate-500 uppercase tracking-widest">Saldo Disponível</div>
                <div className="text-xl font-mono text-emerald-400">$100.00</div>
             </div>
          </div>
        </div>

        {/* Featured Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* PRODUCT 1: NEURAL MACRO SNIPER (NEWS) */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative group rounded-2xl bg-gradient-to-b from-[#1a1a1a] to-[#0c0c0c] border border-white/10 overflow-hidden hover:border-purple-500/30 transition-all duration-300"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
               <Globe className="w-32 h-32 text-purple-500" />
            </div>
            
            <div className="p-8 relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold mb-4">
                <Zap className="w-3 h-3" />
                NEWS TRADING AI
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-2">Neural Macro Sniper</h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-6 h-12">
                A IA opera automaticamente a volatilidade de notícias de alto impacto (CPI, Payroll, FOMC). Entradas cirúrgicas em momentos de caos.
              </p>

              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-3 text-sm text-slate-300">
                   <Check className="w-4 h-4 text-emerald-500" /> 
                   <span>Monitoramento de Agenda Econômica 24/7</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-300">
                   <Check className="w-4 h-4 text-emerald-500" /> 
                   <span>Execução de Breakout em <span className="text-white font-bold">12ms</span></span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-300">
                   <Check className="w-4 h-4 text-emerald-500" /> 
                   <span>Proteção contra "Slippage" (Deslizamento)</span>
                </div>
              </div>

              <div className="flex items-end justify-between border-t border-white/5 pt-6">
                <div>
                   <div className="text-sm text-slate-500 line-through">$149.00</div>
                   <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-white">$67.00</span>
                      <span className="text-xs text-slate-400">/mês</span>
                   </div>
                </div>
                <button className="px-6 py-3 bg-white text-black font-bold rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2">
                   Assinar Módulo <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>


          {/* PRODUCT 2: TITAN RISK GUARD (MT5) */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative group rounded-2xl bg-gradient-to-b from-[#1a1a1a] to-[#0c0c0c] border border-white/10 overflow-hidden hover:border-emerald-500/30 transition-all duration-300"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
               <Shield className="w-32 h-32 text-emerald-500" />
            </div>

            <div className="p-8 relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-4">
                <Shield className="w-3 h-3" />
                RISK MANAGER
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-2">Titan Risk Guard</h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-6 h-12">
                O gerenciador de risco institucional da nossa plataforma, agora para seu MetaTrader 4/5. Trava de Drawdown, Stop Móvel no servidor.
              </p>

              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-3 text-sm text-slate-300">
                   <Check className="w-4 h-4 text-emerald-500" /> 
                   <span>Bridge Oficial para <strong>MetaTrader 5</strong></span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-300">
                   <Check className="w-4 h-4 text-emerald-500" /> 
                   <span>Bloqueio de Conta (Hard Stop Diário)</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-300">
                   <Check className="w-4 h-4 text-emerald-500" /> 
                   <span>Painel Web Externo de Risco</span>
                </div>
              </div>

              <div className="flex items-end justify-between border-t border-white/5 pt-6">
                <div>
                   <div className="text-xs text-emerald-400 font-bold mb-1">PAGAMENTO ÚNICO</div>
                   <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-white">$90.00</span>
                      <span className="text-xs text-slate-400">lifetime</span>
                   </div>
                </div>
                <button className="px-6 py-3 bg-emerald-600/20 border border-emerald-500/50 text-emerald-400 font-bold rounded-lg hover:bg-emerald-600/30 transition-colors flex items-center gap-2">
                   <Download className="w-4 h-4" /> Comprar Licença
                </button>
              </div>
            </div>
          </motion.div>

        </div>

        {/* Upcoming Section */}
        <div className="pt-8">
           <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Em Breve</h3>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] flex items-center gap-4 opacity-50 cursor-not-allowed">
                 <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-slate-400" />
                 </div>
                 <div>
                    <div className="text-sm font-bold text-slate-300">Copy Trading Social</div>
                    <div className="text-xs text-slate-600">Q3 2025</div>
                 </div>
                 <Lock className="w-4 h-4 text-slate-700 ml-auto" />
              </div>
           </div>
        </div>

      </div>
    </div>
  );
}
