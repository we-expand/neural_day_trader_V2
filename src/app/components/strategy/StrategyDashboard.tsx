import React, { useState, useMemo, useEffect } from 'react';
import { 
  Area, 
  Bar, 
  CartesianGrid, 
  ComposedChart, 
  Line, 
  ResponsiveContainer, 
  Tooltip, 
  XAxis, 
  YAxis,
  BarChart,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { NeuralLogo } from '../BrandLogo';
import { 
  TrendingUp, 
  Target, 
  ShieldAlert, 
  Zap, 
  Search, 
  BarChart3, 
  PieChart, 
  ArrowUpRight,
  ShieldCheck,
  BoxSelect
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { BoxBuilder } from './BoxBuilder';
import { useMarketContext } from '../../contexts/MarketContext';
import { toast } from 'sonner';

// --- TYES & CONFIG ---
type Timeframe = '1y' | '2y' | '3y' | '5y';
type TabView = 'execution' | 'financial' | 'swot' | 'benchmark';

// --- LOGIC: FINANCIAL GENERATOR (J-CURVE) ---
const generateFinancialData = (timeframe: Timeframe) => {
  const monthsMap = { '1y': 12, '2y': 24, '3y': 36, '5y': 60 };
  const totalMonths = monthsMap[timeframe];
  const data = [];

  // Configuração Inicial
  let users = 100; // Base inicial baixa
  const ARPU = 49.90; // Ticket médio aumentado (Institucional)
  const fixedCost = 15000; // Custo fixo base (Infra, Equipe Core)
  const variableCostPerUser = 8; // Custo variável (Servidor, Dados, Suporte)

  for (let m = 1; m <= totalMonths; m++) {
    // Lógica de Crescimento (J-Curve Agressiva)
    let growthRate = 0.08; // Base 8% ao mês
    
    if (m <= 12) {
      // Ano 1: Tração Inicial
      growthRate = 0.12 + (Math.random() * 0.05); 
    } else if (m <= 24) {
      // Ano 2: Scale-up (Viralidade)
      growthRate = 0.07 + (Math.random() * 0.03); 
    } else {
      // Ano 3+: Maturidade e Consolidação
      growthRate = 0.03 + (Math.random() * 0.02); 
    }

    users = Math.floor(users * (1 + growthRate));
    
    // Economia de Escala
    const currentVarCost = variableCostPerUser * (1 - (Math.min(users, 100000) / 200000));
    
    const revenue = Math.floor(users * ARPU);
    
    // Custos aumentam em degraus (Contratações, Escritório, Compliance)
    const stepCosts = Math.floor(m / 6) * 5000; 
    const marketingSpend = m <= 12 ? 8000 : (m <= 24 ? 15000 : 25000); 
    
    const costs = Math.floor(fixedCost + stepCosts + (users * currentVarCost) + marketingSpend);
    
    const profit = revenue - costs;

    // Probabilidade de Sucesso (Baseado em Runway e Crescimento)
    // Começa baixo (risco alto) e sobe conforme receita recorrente aumenta
    let successProb = 0;
    if (m <= 12) successProb = 15 + (m * 2); // 15% -> 39%
    else if (m <= 36) successProb = 40 + ((m-12) * 1.5); // 40% -> 76%
    else successProb = Math.min(98, 76 + ((m-36) * 0.5)); // -> 98%

    data.push({
      month: `Mês ${m}`,
      revenue,
      costs,
      profit,
      users,
      successProb: Math.floor(successProb)
    });
  }
  return data;
};

// --- DATA: SWOT ---
const swotData = [
  // STRENGTHS (FORÇAS)
  {
    id: 's1',
    type: 'Força',
    title: 'Motor AI Proprietário (Neural Core)',
    desc: 'Algoritmo de previsão de liquidez com 94% de assertividade backtested.',
    icon: Zap,
    color: 'border-l-emerald-500 bg-emerald-500/5'
  },
  {
    id: 's2',
    type: 'Força',
    title: 'UX "Dark Premium" Institucional',
    desc: 'Interface focada em baixa fadiga visual para operações de alta frequência.',
    icon: Search,
    color: 'border-l-emerald-500 bg-emerald-500/5'
  },
  {
    id: 's3',
    type: 'Força',
    title: 'Arquitetura Híbrida',
    desc: 'Processamento off-chain para velocidade + liquidação on-chain para segurança.',
    icon: ShieldAlert,
    color: 'border-l-emerald-500 bg-emerald-500/5'
  },
  
  // WEAKNESSES (FRAQUEZAS)
  {
    id: 'w1',
    type: 'Fraqueza',
    title: 'Dependência de Dados Externos',
    desc: 'Custos elevados com oráculos premium e APIs de exchanges (CoinGecko/Binance).',
    icon: BarChart3,
    color: 'border-l-rose-500 bg-rose-500/5'
  },
  {
    id: 'w2',
    type: 'Fraqueza',
    title: 'Curva de Aprendizado',
    desc: 'Ferramentas complexas podem afastar investidores de varejo iniciantes.',
    icon: Target,
    color: 'border-l-rose-500 bg-rose-500/5'
  },

  // OPPORTUNITIES (OPORTUNIDADES)
  {
    id: 'o1',
    type: 'Oportunidade',
    title: 'Expansão DeFi & Web3',
    desc: 'Integração nativa com DEXs (Uniswap, Curve) para arbitragem automatizada.',
    icon: TrendingUp,
    color: 'border-l-cyan-500 bg-cyan-500/5'
  },
  {
    id: 'o2',
    type: 'Oportunidade',
    title: 'Modelo White-Label',
    desc: 'Licenciar a tecnologia Neural para neobancos e family offices.',
    icon: ArrowUpRight,
    color: 'border-l-cyan-500 bg-cyan-500/5'
  },
  {
    id: 'o3',
    type: 'Oportunidade',
    title: 'Tokenização de Ativos',
    desc: 'Lançamento do token de governança $NEURAL para staking e descontos.',
    icon: PieChart,
    color: 'border-l-cyan-500 bg-cyan-500/5'
  },

  // THREATS (AMEAÇAS)
  {
    id: 't1',
    type: 'Ameaça',
    title: 'Regulação Global (SEC/MiCA)',
    desc: 'Endurecimento das leis de custódia e operação de derivativos cripto.',
    icon: ShieldAlert,
    color: 'border-l-amber-500 bg-amber-500/5'
  },
  {
    id: 't2',
    type: 'Ameaça',
    title: 'Concorrência Tradicional',
    desc: 'Entrada de gigantes (Bloomberg, BlackRock) no nicho de analytics cripto.',
    icon: Zap,
    color: 'border-l-amber-500 bg-amber-500/5'
  }
];

// --- DATA: BENCHMARK ---
const benchmarkData = [
  { name: 'Terminal Bloomberg', speed: '450ms', cost: '$24k/ano', ui: 'Legacy (1980s)', ai: 'Limitada', type: 'Tradicional' },
  { name: 'TradingView Premium', speed: '120ms', cost: '$600/ano', ui: 'Moderna', ai: 'Scripts (Pine)', type: 'Varejo' },
  { name: 'Glassnode Studio', speed: 'N/A', cost: '$9.6k/ano', ui: 'Analítica', ai: 'Não', type: 'On-Chain' },
  { name: 'Neural Finance', speed: '45ms', cost: '$6k/ano', ui: 'Futurista', ai: 'Nativa (Deep Learning)', highlight: true, type: 'Institucional' },
  { name: 'Bots Open Source', speed: '800ms', cost: 'Grátis', ui: 'Linha de Comando', ai: 'Regras Básicas', type: 'Maker' },
];

// --- DATA: COSTS BREAKDOWN ---
const costStructureData = [
  { name: 'Infraestrutura GPU/Cloud', value: 40, fill: '#38bdf8' },
  { name: 'Licenciamento de Dados', value: 20, fill: '#818cf8' },
  { name: 'P&D (Engenharia de IA)', value: 25, fill: '#c084fc' },
  { name: 'Marketing & Vendas', value: 15, fill: '#f472b6' },
];

export const StrategyDashboard = () => {
  const [activeTab, setActiveTab] = useState<TabView>('execution');
  const [timeframe, setTimeframe] = useState<Timeframe>('5y');
  const [mounted, setMounted] = useState(false);

  // Market Context
  const { marketState } = useMarketContext();
  const symbol = "EUR/USD"; // Default active symbol for strategy view
  
  // Memoize data calculation to avoid stutter during renders
  const financialData = useMemo(() => generateFinancialData(timeframe), [timeframe]);

  // Mount effect
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Calcular métricas chave para os Cards de Resumo
  const lastMonth = financialData[financialData.length - 1];
  const breakEvenMonthIndex = financialData.findIndex(d => d.profit > 0);
  const breakEvenMonth = breakEvenMonthIndex !== -1 ? `Mês ${breakEvenMonthIndex + 1}` : 'N/A';
  const totalRevenue = financialData.reduce((acc, curr) => acc + curr.revenue, 0);
  const totalProfit = financialData.reduce((acc, curr) => acc + curr.profit, 0);

  const handleApplyBox = (box: { high: number; low: number; type: 'BREAKOUT' | 'BOUNCE' }) => {
    // Logic to save strategy would go here
    console.log("Applying Box Strategy:", box);
  };

  return (
    <div className="flex flex-col h-full bg-black overflow-hidden">
      {/* Header com ícone + título + subtítulo (padrão Marketplace) */}
      <div className="flex items-start gap-4 px-6 pt-6 pb-4 border-b border-white/5 flex-none bg-black/50 backdrop-blur-md z-10">
        <div className="p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
          <Target className="w-8 h-8 text-cyan-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-white uppercase flex items-center gap-3">
            Centro de Estratégia
          </h1>
          <p className="text-slate-400 mt-1 tracking-wide font-light">
            Inteligência de Mercado, Análise Competitiva e Planejamento Financeiro
          </p>
        </div>
        
        <div className="flex bg-slate-900/50 p-0.5 rounded-lg border border-white/5 backdrop-blur-sm overflow-x-auto">
          {[
            { id: 'execution', label: 'Execução' },
            { id: 'financial', label: 'Financeiro' }, 
            { id: 'swot', label: 'SWOT' }, 
            { id: 'benchmark', label: 'Benchmark' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabView)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all duration-300 relative whitespace-nowrap ${
                activeTab === tab.id ? 'text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-white/10 rounded-md border border-white/10 shadow-sm"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <span className="relative z-10">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* CONTENT SCROLLABLE AREA - MAXIMIZADO */}
      <div className="flex-1 overflow-y-auto px-4 py-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <div className="max-w-[1920px] mx-auto">
          <AnimatePresence mode="wait">
            
            {/* --- VIEW: EXECUTION (NEW) --- */}
            {activeTab === 'execution' && (
              <motion.div
                key="execution"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between mb-1">
                   <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <BoxSelect className="w-5 h-5 text-purple-400" />
                      Matriz Estratégica EUR/USD
                   </h3>
                   <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20 animate-pulse">
                      MERCADO ABERTO
                   </span>
                </div>

                {/* THE NEW BOX BUILDER */}
                <BoxBuilder symbol="EUR/USD" onApply={handleApplyBox} />

                {/* Additional Strategy Info - COMPACTADO */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                   <Card className="bg-black/40 border-white/10">
                      <CardHeader className="pb-2">
                         <CardTitle className="text-xs font-bold text-slate-300">Volatilidade (ATR)</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                         <div className="text-xl font-mono text-white">0.0045 <span className="text-xs text-slate-500">Baixa</span></div>
                         <div className="h-1 w-full bg-slate-800 rounded mt-1.5">
                            <div className="h-full bg-blue-500 w-[30%]" />
                         </div>
                      </CardContent>
                   </Card>
                   <Card className="bg-black/40 border-white/10">
                      <CardHeader className="pb-2">
                         <CardTitle className="text-xs font-bold text-slate-300">Sentimento Institucional</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                         <div className="text-xl font-mono text-emerald-400">ALTA (BULLISH)</div>
                         <p className="text-[10px] text-slate-500 mt-0.5">Fluxo de compra detectado em 1.08450</p>
                      </CardContent>
                   </Card>
                </div>
              </motion.div>
            )}
            
            {/* --- VIEW: FINANCIAL --- */}
          {activeTab === 'financial' && (
            <motion.div
              key="financial"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-3"
            >
              {/* Resumo Executivo (KPIs) - COMPACTADO */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="bg-black/40 border-emerald-500/20 backdrop-blur-md">
                   <CardContent className="p-3">
                     <p className="text-[10px] text-slate-500 uppercase tracking-wider">Break-even</p>
                     <p className="text-xl font-bold text-emerald-400 mt-0.5">{breakEvenMonth}</p>
                     <p className="text-[9px] text-emerald-500/70 mt-0.5">ROI Positivo</p>
                   </CardContent>
                </Card>
                <Card className="bg-black/40 border-cyan-500/20 backdrop-blur-md">
                   <CardContent className="p-3">
                     <p className="text-[10px] text-slate-500 uppercase tracking-wider">Prob. de Êxito</p>
                     <p className="text-xl font-bold text-cyan-400 mt-0.5">{lastMonth.successProb}%</p>
                     <p className="text-[9px] text-cyan-500/70 mt-0.5">Crescimento atual</p>
                   </CardContent>
                </Card>
                 <Card className="bg-black/40 border-purple-500/20 backdrop-blur-md">
                   <CardContent className="p-3">
                     <p className="text-[10px] text-slate-500 uppercase tracking-wider">ARR Ano {timeframe.replace('y','')}</p>
                     <p className="text-xl font-bold text-purple-400 mt-0.5">${(lastMonth.revenue * 12 / 1000000).toFixed(1)}M</p>
                     <p className="text-[9px] text-purple-500/70 mt-0.5">Receita Anual</p>
                   </CardContent>
                </Card>
                <Card className="bg-black/40 border-white/10 backdrop-blur-md">
                   <CardContent className="p-3">
                     <p className="text-[10px] text-slate-500 uppercase tracking-wider">Usuários Ativos</p>
                     <p className="text-xl font-bold text-white mt-0.5">{lastMonth.users.toLocaleString()}</p>
                     <p className="text-[9px] text-slate-500 mt-0.5">Institucionais & Pro</p>
                   </CardContent>
                </Card>
              </div>

              {/* Controls - COMPACTADO */}
              <div className="flex justify-between items-center">
                 <h3 className="text-base font-light text-slate-200">Fluxo de Caixa Projetado</h3>
                 <div className="flex gap-1.5">
                  {(['1y', '2y', '3y', '5y'] as Timeframe[]).map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setTimeframe(tf)}
                      className={`px-2.5 py-0.5 text-[10px] font-mono rounded border transition-colors ${
                        timeframe === tf 
                          ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' 
                          : 'bg-transparent border-slate-800 text-slate-500 hover:border-slate-600'
                      }`}
                    >
                      {tf.toUpperCase().replace('Y', ' ANOS')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {/* Main Chart - ALTURA OTIMIZADA */}
                <Card className="lg:col-span-2 bg-black/40 border-white/10 backdrop-blur-md shadow-xl">
                  <CardContent className="h-[350px] pt-4" style={{ minHeight: '350px' }}>
                    {mounted ? (
                      <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={300}>
                        <ComposedChart data={financialData}>
                          <defs>
                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#22D3EE" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#22D3EE" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.1} vertical={false} />
                          <XAxis 
                            dataKey="month" 
                            stroke="#64748b" 
                            fontSize={10} 
                            tickLine={false}
                            interval={timeframe === '5y' ? 11 : (timeframe === '3y' ? 5 : 2)} 
                          />
                          <YAxis stroke="#64748b" fontSize={10} tickLine={false} tickFormatter={(val) => `$${val/1000}k`} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                            itemStyle={{ color: '#e2e8f0' }}
                            formatter={(val: number, name: string) => [
                              name === 'Prob. Sucesso' ? `${val}%` : `$${val.toLocaleString()}`, 
                              name
                            ]}
                            labelStyle={{ color: '#94a3b8' }}
                          />
                          {/* Area: Revenue */}
                          <Area 
                            type="monotone" 
                            dataKey="revenue" 
                            stroke="#22D3EE" 
                            fillOpacity={1} 
                            fill="url(#colorRevenue)" 
                            strokeWidth={2}
                            name="Receita"
                          />
                           {/* Area: Profit (Positive part usually) */}
                           <Area 
                            type="monotone" 
                            dataKey="profit" 
                            stroke="#10B981" 
                            fillOpacity={1} 
                            fill="url(#colorProfit)" 
                            strokeWidth={2}
                            name="Lucro Operacional"
                          />
                          {/* Line: Costs */}
                          <Line 
                            type="monotone" 
                            dataKey="costs" 
                            stroke="#F43F5E" 
                            strokeWidth={2} 
                            strokeDasharray="4 4"
                            dot={false}
                            name="Custos Totais"
                          />
                           {/* Line: Success Probability (Secondary Axis idea, but kept simple here just as tooltip data or hidden line if needed, but keeping it off chart to avoid scale mess) */}
                        </ComposedChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-sm text-slate-500">Carregando...</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Cost Structure - ALTURA OTIMIZADA */}
                <Card className="bg-black/40 border-white/10 backdrop-blur-md shadow-xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-light flex items-center gap-2">
                      <PieChart className="w-4 h-4 text-rose-400" />
                      Estrutura de Custos
                    </CardTitle>
                    <CardDescription className="text-[10px]">Onde investimos o capital</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[290px]" style={{ minHeight: '290px' }}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={250}>
                      <BarChart layout="vertical" data={costStructureData} margin={{ left: 0, right: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" opacity={0.2} />
                        <XAxis type="number" hide />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          stroke="#94a3b8" 
                          fontSize={10} 
                          tickLine={false} 
                          width={110}
                        />
                        <Tooltip 
                          cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}
                        />
                        <Bar dataKey="value" name="Percentual (%)" radius={[0, 4, 4, 0]} barSize={28}>
                          {costStructureData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          )}

          {/* --- VIEW: SWOT --- */}
          {activeTab === 'swot' && (
            <motion.div
              key="swot"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-3"
            >
              {swotData.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.08 }}
                >
                  <Card className={`h-full bg-black/40 border backdrop-blur-sm hover:bg-white/5 transition-colors ${item.color.split(' ')[0]} ${item.color.split(' ')[1]}`}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2.5">
                           <div className="p-1.5 rounded-lg bg-black/20 backdrop-blur-md border border-white/5">
                            <item.icon className="w-4 h-4 text-white" />
                          </div>
                          <h3 className="text-base text-white font-medium">{item.title}</h3>
                        </div>
                        <span className="text-[9px] uppercase tracking-widest text-slate-400 font-mono bg-black/30 px-1.5 py-0.5 rounded border border-white/5">
                          {item.type}
                        </span>
                      </div>
                      <p className="text-slate-400 text-xs leading-relaxed pl-8">{item.desc}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* --- VIEW: BENCHMARK --- */}
          {activeTab === 'benchmark' && (
            <motion.div
              key="benchmark"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-3"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                 <Card className="bg-gradient-to-br from-cyan-900/20 to-black border border-cyan-500/30">
                    <CardContent className="p-4 flex flex-col items-center text-center">
                       <Zap className="w-7 h-7 text-cyan-400 mb-2" />
                       <h4 className="text-sm text-white font-bold mb-0.5">Velocidade Extrema</h4>
                       <p className="text-[10px] text-slate-400">Nossa infraestrutura é 10x mais rápida que concorrentes web tradicionais.</p>
                    </CardContent>
                 </Card>
                 <Card className="bg-gradient-to-br from-purple-900/20 to-black border border-purple-500/30">
                    <CardContent className="p-4 flex flex-col items-center text-center">
                       <Target className="w-7 h-7 text-purple-400 mb-2" />
                       <h4 className="text-sm text-white font-bold mb-0.5">Precisão AI</h4>
                       <p className="text-[10px] text-slate-400">Única plataforma com motor preditivo nativo, não apenas scripts técnicos.</p>
                    </CardContent>
                 </Card>
                 <Card className="bg-gradient-to-br from-emerald-900/20 to-black border border-emerald-500/30">
                    <CardContent className="p-4 flex flex-col items-center text-center">
                       <ShieldCheck className="w-7 h-7 text-emerald-400 mb-2" />
                       <h4 className="text-sm text-white font-bold mb-0.5">Custo-Benefício</h4>
                       <p className="text-[10px] text-slate-400">Ferramentas institucionais acessíveis por uma fração do custo Bloomberg.</p>
                    </CardContent>
                 </Card>
              </div>

              <Card className="bg-black/40 border-white/10 backdrop-blur-md overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="w-4 h-4 text-cyan-400" />
                    Comparativo de Mercado
                  </CardTitle>
                  <CardDescription className="text-[10px]">Neural Day Trader vs Soluções Existentes</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="w-full overflow-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-[10px] text-slate-500 uppercase bg-white/5">
                        <tr>
                          <th className="px-4 py-2.5 font-medium tracking-wider">Plataforma</th>
                          <th className="px-4 py-2.5 font-medium tracking-wider">Tipo</th>
                          <th className="px-4 py-2.5 font-medium tracking-wider">Latência</th>
                          <th className="px-4 py-2.5 font-medium tracking-wider">Custo Anual</th>
                          <th className="px-4 py-2.5 font-medium tracking-wider">Interface</th>
                          <th className="px-4 py-2.5 font-medium tracking-wider">Integração AI</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {benchmarkData.map((row) => (
                          <motion.tr 
                            key={row.name}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className={`
                              group transition-colors
                              ${row.highlight ? 'bg-cyan-900/10 hover:bg-cyan-900/20' : 'hover:bg-white/5'}
                            `}
                          >
                            <td className="px-4 py-3 font-medium text-white flex items-center gap-2">
                              {row.name}
                              {row.highlight && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-[0_0_10px_rgba(34,211,238,0.2)]">
                                  NÓS
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-400 text-xs">{row.type}</td>
                            <td className="px-4 py-3 text-slate-300 font-mono text-xs">{row.speed}</td>
                            <td className="px-4 py-3 text-slate-300 text-xs">{row.cost}</td>
                            <td className="px-4 py-3 text-slate-300 text-xs">{row.ui}</td>
                            <td className="px-4 py-3">
                              <span className={`
                                inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border
                                ${row.ai.includes('Nativa') 
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]' 
                                  : 'text-slate-500 bg-slate-800/50 border-transparent'}
                              `}>
                                {row.ai}
                              </span>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

        </AnimatePresence>
        </div>
      </div>
    </div>
  );
};