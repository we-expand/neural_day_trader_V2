import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Building2, CreditCard, DollarSign, FileText, ArrowUpRight, ArrowDownRight, RefreshCw, ShieldCheck, Zap, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import { useFinanceStore } from '../../../hooks/useFinanceStore';
import { supabase } from '@/lib/supabaseClient';
import { format } from 'date-fns';

// 🔴 2026-09-11 (auditoria pedida pelo Cleber -- achado real): esta tela
// inteira estava quase 100% fabricada -- gráfico de fluxo de caixa, 3 contas
// bancárias, obrigações fiscais e os 4 números abaixo (Receita YTD, Despesas,
// Cash Runway, Provisão Fiscal) eram arrays/strings hardcoded no componente,
// sem tabela nenhuma por trás. `houseStats` (card de comissão) também nunca
// era calculado -- ficava em $0 pra sempre. Corrigido aqui: card de comissão
// agora consulta `/admin/commission-summary` (agregado real de
// `ai_trades.commission`, calculado no motor via commissionModel.ts). O
// resto (contas bancárias, impostos, fluxo de caixa, YTD) segue mockado --
// fora do escopo desta rodada, marcado explicitamente como tal na UI abaixo
// em vez de continuar se passando por dado real.
interface CommissionSummary {
  totalClosedTrades: number;
  demo: { trades: number; totalCommissionUsd: number; totalNetPnlUsd: number; totalGrossPnlUsd: number };
  live: { trades: number; totalCommissionUsd: number; totalNetPnlUsd: number; totalGrossPnlUsd: number; note: string };
  last30Days: { trades: number; totalCommissionUsd: number };
}

function useCommissionSummary() {
  const [summary, setSummary] = useState<CommissionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) throw new Error('Sessão expirada — faça login novamente');
        const res = await fetch(
          `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/server/admin/commission-summary`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        const json = await res.json();
        if (!cancelled) setSummary(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Falha ao carregar comissão real');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { summary, loading, error };
}

const data = [
  { name: 'Jan', revenue: 45000, expenses: 32000 },
  { name: 'Feb', revenue: 52000, expenses: 34000 },
  { name: 'Mar', revenue: 49000, expenses: 31000 },
  { name: 'Apr', revenue: 63000, expenses: 42000 },
  { name: 'May', revenue: 78000, expenses: 45000 },
  { name: 'Jun', revenue: 92000, expenses: 51000 },
];

const bankAccounts = [
  { id: 1, bank: 'Millennium BCP', type: 'Conta Operacional', balance: '€ 142.302,00', status: 'Active', icon: Building2 },
  { id: 2, bank: 'Revolut Business', type: 'Tesouraria Intl.', balance: '€ 85.420,50', status: 'Active', icon: CreditCard },
  { id: 3, bank: 'Caixa Geral', type: 'Fundo Fiscal', balance: '€ 32.100,00', status: 'Reserved', icon: ShieldCheck },
];

const taxes = [
  { id: 1, name: 'IVA - Declaração Trimestral', amount: '€ 12.450,00', due: '15 Mai', status: 'Pending' },
  { id: 2, name: 'TSU (Segurança Social)', amount: '€ 4.230,00', due: '20 Mai', status: 'Scheduled' },
  { id: 3, name: 'IRC - Pagamento por Conta', amount: '€ 8.100,00', due: '30 Jun', status: 'Upcoming' },
];

export function FinanceModule() {
  const { sales, revenue } = useFinanceStore();
  const { summary, loading: commissionLoading, error: commissionError } = useCommissionSummary();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* HOUSE REVENUE CARD — dado real (achado 2026-09-11: antes ficava
            sempre $0, `houseStats` nunca era calculado em lugar nenhum) */}
        <Card className="bg-emerald-900/20 border-emerald-500/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-bl-full -mr-4 -mt-4 pointer-events-none"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-emerald-400">Comissões da Casa (DEMO)</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent className="relative z-10">
            {commissionError ? (
              <div className="text-xs text-rose-400 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {commissionError}</div>
            ) : (
              <>
                <div className="text-2xl font-bold text-white">
                  {commissionLoading ? '...' : `US$ ${(summary?.demo.totalCommissionUsd ?? 0).toFixed(2)}`}
                </div>
                <p className="text-xs text-emerald-500/80 flex items-center mt-1">
                  <ArrowUpRight className="h-3 w-3 mr-1" /> {summary?.demo.trades ?? 0} trades comissionados
                </p>
                <div className="mt-3 pt-3 border-t border-emerald-500/20 flex justify-between text-[10px] text-slate-400">
                   <span>Últimos 30d: US${(summary?.last30Days.totalCommissionUsd ?? 0).toFixed(2)}</span>
                   <span>{summary?.last30Days.trades ?? 0} trades</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* HOUSE REVENUE CARD — LIVE (dinheiro real). Número real, mas ainda
            zerado de propósito: cobrança de comissão em execução real ainda
            não foi implementada (só o cálculo simulado/DEMO, aprovado nesta
            rodada) — ver nota do backend, exibida abaixo em vez de escondida. */}
        <Card className="bg-amber-900/10 border-amber-500/20 relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-400">Comissões da Casa (LIVE)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {commissionLoading ? '...' : `US$ ${(summary?.live.totalCommissionUsd ?? 0).toFixed(2)}`}
            </div>
            <p className="text-xs text-amber-500/80 mt-1">{summary?.live.trades ?? 0} trades reais fechados</p>
            <p className="text-[10px] text-amber-600/80 mt-2 leading-snug">
              Cobrança de comissão em execução real ainda não implementada — mecanismo de coleta pendente de decisão.
            </p>
          </CardContent>
        </Card>

        {/* PREMIUM SALES CARD */}
        <Card className="bg-purple-900/20 border-purple-500/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-300">Vendas Premium (Upsell)</CardTitle>
            <Zap className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">US$ {revenue.toFixed(2)}</div>
            <p className="text-xs text-purple-400 flex items-center mt-1">
              <ArrowUpRight className="h-3 w-3 mr-1" /> {sales.length} vendas realizadas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 🔴 2026-09-11: tudo abaixo (YTD/Despesas/Cash Runway/Provisão,
          contas bancárias, obrigações fiscais, fluxo de caixa) é dado de
          EXEMPLO hardcoded no componente -- nunca foi real, achado na
          auditoria desta sessão. Marcado explicitamente em vez de continuar
          se passando por real. Fora do escopo desta rodada (era sobre
          comissão); reconstruir com dado real é trabalho separado. */}
      <div className="flex items-center gap-2 px-1 text-amber-400/90 text-xs font-bold uppercase tracking-wider">
        <AlertTriangle className="h-3.5 w-3.5" /> Seções abaixo: dados de exemplo (mock), não refletem números reais da empresa
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Receita Total (YTD)</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">€ 379.000,00</div>
            <p className="text-xs text-emerald-400 flex items-center mt-1">
              <ArrowUpRight className="h-3 w-3 mr-1" /> +20.1% vs ano anterior
            </p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Despesas Operacionais</CardTitle>
            <ArrowDownRight className="h-4 w-4 text-rose-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">€ 235.000,00</div>
            <p className="text-xs text-slate-500 mt-1">Custos de infraestrutura e pessoal</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Cash Runway</CardTitle>
            <RefreshCw className="h-4 w-4 text-cyan-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">14 Meses</div>
            <p className="text-xs text-slate-500 mt-1">Baseado no burn rate atual</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Provisão Fiscal</CardTitle>
            <ShieldCheck className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">€ 24.780,00</div>
            <p className="text-xs text-amber-400 mt-1">IVA e IRC acumulados</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        
        {/* RECENT SALES TABLE */}
        <Card className="col-span-7 bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
               <Zap className="w-4 h-4 text-purple-500" /> Vendas Recentes: Nucleo Premium
            </CardTitle>
            <CardDescription className="text-slate-400">Transações de Upsell direto da plataforma de Trading</CardDescription>
          </CardHeader>
          <CardContent>
            {sales.length === 0 ? (
               <div className="text-center py-8 text-slate-500 italic text-sm">Nenhuma venda registrada hoje.</div>
            ) : (
               <div className="relative overflow-x-auto">
                  <table className="w-full text-sm text-left text-slate-400">
                     <thead className="text-xs text-slate-500 uppercase bg-slate-900/50">
                        <tr>
                           <th scope="col" className="px-6 py-3">Produto</th>
                           <th scope="col" className="px-6 py-3">Cliente</th>
                           <th scope="col" className="px-6 py-3">Valor</th>
                           <th scope="col" className="px-6 py-3">Status</th>
                           <th scope="col" className="px-6 py-3">Data</th>
                        </tr>
                     </thead>
                     <tbody>
                        {sales.map((sale) => (
                           <tr key={sale.id} className="bg-slate-900/20 border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                              <td className="px-6 py-4 font-medium text-white">{sale.productName}</td>
                              <td className="px-6 py-4">{sale.customerName}</td>
                              <td className="px-6 py-4 text-emerald-400 font-bold">US$ {sale.amount.toFixed(2)}</td>
                              <td className="px-6 py-4">
                                 <span className="bg-emerald-500/10 text-emerald-500 text-xs font-bold px-2 py-0.5 rounded border border-emerald-500/20 uppercase">
                                    {sale.status === 'completed' ? 'Aprovado' : sale.status}
                                 </span>
                              </td>
                              <td className="px-6 py-4 font-mono text-xs text-slate-500">
                                 {new Date(sale.date).toLocaleString()}
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-4 bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Fluxo de Caixa</CardTitle>
            <CardDescription className="text-slate-400">Análise de Entradas vs Saídas (2024)</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px]" style={{ minHeight: '300px' }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={250}>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" />
                  <YAxis stroke="#64748b" tickFormatter={(value) => `€${value/1000}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                    itemStyle={{ color: '#f8fafc' }}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="expenses" stroke="#f43f5e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3 bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Obrigações Fiscais (Portugal)</CardTitle>
            <CardDescription className="text-slate-400">Autoridade Tributária & Segurança Social</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {taxes.map((tax) => (
                <div key={tax.id} className="flex items-center justify-between p-4 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-slate-900 rounded-full">
                      <FileText className="h-4 w-4 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{tax.name}</p>
                      <p className="text-xs text-slate-500">Vence em: {tax.due}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white">{tax.amount}</p>
                    <Badge variant="outline" className={
                      tax.status === 'Pending' ? "text-amber-400 border-amber-400/20 bg-amber-400/10" :
                      tax.status === 'Scheduled' ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/10" :
                      "text-slate-400 border-slate-400/20"
                    }>
                      {tax.status === 'Pending' ? 'Pagar' : tax.status === 'Scheduled' ? 'Agendado' : 'Futuro'}
                    </Badge>
                  </div>
                </div>
              ))}
              <Button className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white">
                Automatizar Pagamentos Pendentes
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {bankAccounts.map((account) => (
          <Card key={account.id} className="bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">{account.bank}</CardTitle>
              <account.icon className="h-4 w-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{account.balance}</div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-slate-500">{account.type}</span>
                <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}