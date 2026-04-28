import React, { useState, useEffect } from 'react';
import { Copy, Users, DollarSign, TrendingUp, Shield, CheckCircle, Clock, AlertTriangle, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Referral {
  id: string;
  user: string;
  date: string;
  status: 'ACTIVE' | 'PENDING' | 'INACTIVE';
  commission: number;
}

export function Partners() {
  const [referralCode, setReferralCode] = useState<string>('');
  const [stats, setStats] = useState({
    totalRefers: 0,
    activeRefers: 0,
    totalEarnings: 0,
    pendingEarnings: 0,
    conversionRate: 0,
  });
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Mock Data & Initialization
  useEffect(() => {
    // Simulating API fetch
    setTimeout(() => {
      const savedCode = localStorage.getItem('neural_ref_code') || generateCode();
      if (!localStorage.getItem('neural_ref_code')) {
        localStorage.setItem('neural_ref_code', savedCode);
      }
      setReferralCode(savedCode);

      // Mock Data Generation
      setStats({
        totalRefers: 12,
        activeRefers: 8,
        totalEarnings: 1250.00,
        pendingEarnings: 340.50,
        conversionRate: 3.2,
      });

      setReferrals([
        { id: '1', user: 'u***9@gmail.com', date: '2024-01-10', status: 'ACTIVE', commission: 150.00 },
        { id: '2', user: 'j***k@yahoo.com', date: '2024-01-08', status: 'PENDING', commission: 0 },
        { id: '3', user: 'm***1@outlook.com', date: '2024-01-05', status: 'ACTIVE', commission: 150.00 },
        { id: '4', user: 'tr***x@proton.me', date: '2023-12-28', status: 'INACTIVE', commission: 50.00 },
        { id: '5', user: 'al***9@gmail.com', date: '2023-12-20', status: 'ACTIVE', commission: 300.00 },
      ]);

      setIsLoading(false);
    }, 800);
  }, []);

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const copyLink = () => {
    const link = `${window.location.origin}/register?ref=${referralCode}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copiado!', {
      description: 'Envie para seus contatos e comece a lucrar.',
      icon: <CheckCircle className="text-emerald-500" />
    });
  };

  const chartData = [
    { name: 'Sem 1', value: 400 },
    { name: 'Sem 2', value: 300 },
    { name: 'Sem 3', value: 550 },
    { name: 'Sem 4', value: 1250 },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8 bg-black min-h-full text-slate-200 font-sans">
      {/* Header com ícone + título + subtítulo (padrão Marketplace) */}
      <div className="flex items-start gap-4 mb-6 pb-6 border-b border-white/5">
        <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
          <Users className="w-8 h-8 text-emerald-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-white uppercase flex items-center gap-3">
            Programa de Parceiros
          </h1>
          <p className="text-slate-400 mt-1 tracking-wide font-light">
            Gerencie suas indicações e comissões da Rede Neural
          </p>
        </div>
        
        <div className="flex items-center gap-3 bg-emerald-950/30 border border-emerald-500/20 px-4 py-2 rounded-lg">
           <Shield className="w-5 h-5 text-emerald-400" />
           <div>
             <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Nível Atual</p>
             <p className="text-sm font-bold text-white">OFFICER <span className="text-xs font-normal text-emerald-500/70 ml-1">(20%)</span></p>
           </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Earnings */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-neutral-950 border border-emerald-500/20 rounded-xl p-6 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <DollarSign className="w-12 h-12 text-emerald-500" />
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Comissão Total</p>
          <p className="text-3xl font-bold text-white tracking-tight">${stats.totalEarnings.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          <div className="mt-4 flex items-center gap-2 text-xs font-medium text-emerald-400 bg-emerald-500/10 w-fit px-2 py-1 rounded">
             <TrendingUp className="w-3 h-3" />
             +12.5% este mês
          </div>
        </motion.div>

        {/* Pending */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-neutral-950 border border-white/5 rounded-xl p-6 relative overflow-hidden"
        >
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Disponível para Saque</p>
          <p className="text-3xl font-bold text-white tracking-tight">${stats.pendingEarnings.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          <button className="mt-4 text-xs font-bold text-black bg-emerald-500 hover:bg-emerald-400 px-4 py-2 rounded transition-colors w-full uppercase tracking-wider">
            Solicitar Retirada
          </button>
        </motion.div>

        {/* Referrals Count */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-neutral-950 border border-white/5 rounded-xl p-6 relative overflow-hidden"
        >
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Usuários Indicados</p>
          <p className="text-3xl font-bold text-white tracking-tight">{stats.totalRefers}</p>
          <p className="text-xs text-slate-500 mt-2">{stats.activeRefers} usuários ativos na plataforma</p>
        </motion.div>

        {/* Link Generator */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-neutral-950 border border-white/5 rounded-xl p-6 flex flex-col justify-center"
        >
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Seu Link de Indicação</p>
          <div className="flex items-center gap-2 bg-white/5 p-2 rounded-lg border border-white/10 group-hover:border-emerald-500/50 transition-colors">
            <code className="text-xs text-emerald-400 font-mono truncate flex-1">
              neuraltrader.ai/ref/{referralCode}
            </code>
            <button 
              onClick={copyLink}
              className="p-2 hover:bg-white/10 rounded-md transition-colors text-slate-400 hover:text-white"
              title="Copiar Link"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-2 text-center">Compartilhe e ganhe até 30% recorrente.</p>
        </motion.div>
      </div>

      {/* Chart & History Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart */}
        <div className="lg:col-span-2 bg-neutral-950 border border-white/5 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
             <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Performance de Receita</h3>
             <select className="bg-black border border-white/10 text-xs text-slate-400 rounded px-2 py-1 outline-none focus:border-emerald-500/50">
               <option>Últimos 30 dias</option>
               <option>Últimos 90 dias</option>
             </select>
          </div>
          <div className="h-[250px] w-full" style={{ minHeight: '250px' }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <XAxis dataKey="name" stroke="#525252" tick={{fontSize: 10}} />
                <YAxis stroke="#525252" tick={{fontSize: 10}} prefix="$" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#000', borderColor: '#333', borderRadius: '8px' }}
                  itemStyle={{ color: '#10b981' }}
                />
                <Area type="monotone" dataKey="value" stroke="#10b981" fillOpacity={1} fill="url(#colorEarnings)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Actions / Tiers */}
        <div className="bg-neutral-950 border border-white/5 rounded-xl p-6 space-y-6">
           <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Metas de Nível</h3>
           
           <div className="space-y-4">
             <div className="relative pt-1">
               <div className="flex mb-2 items-center justify-between">
                 <div>
                   <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-emerald-400 bg-emerald-500/10">
                     Officer (Atual)
                   </span>
                 </div>
                 <div className="text-right">
                   <span className="text-xs font-semibold inline-block text-emerald-400">
                     20%
                   </span>
                 </div>
               </div>
               <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-white/10">
                 <div style={{ width: "100%" }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-emerald-500"></div>
               </div>
             </div>

             <div className="relative pt-1 opacity-50">
               <div className="flex mb-2 items-center justify-between">
                 <div>
                   <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-slate-400 bg-slate-500/10">
                     Commander (Próximo)
                   </span>
                 </div>
                 <div className="text-right">
                   <span className="text-xs font-semibold inline-block text-slate-400">
                     25%
                   </span>
                 </div>
               </div>
               <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-white/10">
                 <div style={{ width: "45%" }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-slate-600"></div>
               </div>
               <p className="text-[10px] text-slate-500 mt-1">Faltam 8 indicações ativas para subir de nível.</p>
             </div>
           </div>

           <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                 <AlertTriangle className="w-5 h-5 text-blue-400 shrink-0" />
                 <div>
                    <h4 className="text-xs font-bold text-blue-400 uppercase mb-1">Dica Pro</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                       Usuários indicados que depositam via Cripto geram comissões instantâneas.
                    </p>
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* Referrals Table */}
      <div className="bg-neutral-950 border border-white/5 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
           <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Últimas Indicações</h3>
           <button className="text-xs text-emerald-400 font-bold hover:text-emerald-300 transition-colors flex items-center gap-1">
             Ver Todos <ArrowRight className="w-3 h-3" />
           </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/5">
                <th className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Usuário</th>
                <th className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Data</th>
                <th className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Comissão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {referrals.map((ref) => (
                <tr key={ref.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-4 text-sm font-medium text-white font-mono">{ref.user}</td>
                  <td className="p-4 text-xs text-slate-400">{new Date(ref.date).toLocaleDateString()}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                      ref.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      ref.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                      'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {ref.status === 'ACTIVE' ? 'Ativo' : ref.status === 'PENDING' ? 'Pendente' : 'Inativo'}
                    </span>
                  </td>
                  <td className="p-4 text-sm font-bold text-right text-emerald-400 font-mono">
                    {ref.commission > 0 ? `+$${ref.commission.toFixed(2)}` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}