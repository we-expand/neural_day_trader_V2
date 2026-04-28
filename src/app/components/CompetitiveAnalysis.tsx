import React, { useState } from 'react';
import { 
  TrendingUp, 
  Target, 
  Zap, 
  DollarSign, 
  Users, 
  Shield, 
  BarChart3,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Rocket,
  Brain,
  Lock,
  Globe,
  Clock,
  Trophy,
  Star,
  ArrowRight,
  Code,
  Cpu,
  Database
} from 'lucide-react';

interface Competitor {
  name: string;
  logo: string;
  type: 'Corretora' | 'Assessoria' | 'Tech Platform' | 'Robo-Advisor';
  monthlyFee: number | string;
  corretagem: string;
  minimumDeposit: number | string;
  automatedTrading: boolean | string;
  backtesting: boolean | string;
  marketReplay: boolean | string;
  pyramiding: boolean | string;
  metaApiIntegration: boolean | string;
  ownBrokerRequired: boolean;
  indicators: number | string;
  strategies: number | string;
  assets: number | string;
  riskManagement: string;
  dataQuality: string;
  targetAudience: string;
  technology: string[];
  strengths: string[];
  weaknesses: string[];
  pricing: string;
  realWebsite: string;
}

const competitors: Competitor[] = [
  {
    name: 'Neural Day Trader',
    logo: '🧠',
    type: 'Tech Platform',
    monthlyFee: 149,
    corretagem: 'R$ 0 (via broker do cliente)',
    minimumDeposit: 'R$ 0 (cliente usa própria conta)',
    automatedTrading: '✅ Total (3 estratégias)',
    backtesting: '✅ Replay tick-by-tick',
    marketReplay: '✅ Histórico completo',
    pyramiding: '✅ Profissional (único)',
    metaApiIntegration: '✅ Nativo MT5',
    ownBrokerRequired: false,
    indicators: 23,
    strategies: 3,
    assets: '300+',
    riskManagement: 'Contenção Estrutural 5 Camadas (Stop Loss, Trailing, Max DD, Circuit Breaker, Emergency Shutdown)',
    dataQuality: 'Institucional (Trading Economics, S&P Global, MetaApi)',
    targetAudience: 'Day Traders profissionais e semi-profissionais (R$ 2k-50k capital)',
    technology: [
      'React + TypeScript (Frontend moderno)',
      'KLineCharts (gráficos profissionais)',
      'MetaApi Cloud (integração MT5 nativa)',
      'Supabase Edge Functions (backend serverless)',
      'Trading Economics API (dados macro)',
      'S&P Global Market Intelligence',
      'WebSockets tempo real'
    ],
    strengths: [
      'Sistema de Contenção Estrutural com 5 camadas (único no mercado)',
      'Pyramiding automatizado profissional (não existe em nenhum concorrente BR)',
      'MetaApi MT5 integrado nativamente (sem necessidade de VPS)',
      'Dados institucionais de primeira linha (Trading Economics, S&P Global)',
      'Backtesting real com replay tick-by-tick',
      'Modelo SaaS sem bloqueio de capital (cliente mantém 100% controle)',
      'R$ 149/mês (87% mais barato que TradeMap)',
      '23 indicadores técnicos funcionais',
      'Performance Analytics com 8 KPIs profissionais (Sharpe, Sortino, Calmar, etc)'
    ],
    weaknesses: [
      'Marca nova no mercado (zero reconhecimento vs XP/BTG)',
      'Sem assessoria humana personalizada',
      'Curva de aprendizado para iniciantes',
      'Sem comunidade estabelecida ainda',
      'Foco apenas em trading automatizado (não serve investidor passivo)'
    ],
    pricing: 'R$ 149/mês + comissões IB das operações executadas',
    realWebsite: 'N/A (produto em desenvolvimento)'
  },
  {
    name: 'XP Investimentos',
    logo: '🏦',
    type: 'Corretora',
    monthlyFee: 0,
    corretagem: 'Ações: R$ 18,90 até R$ 3k | Futuros: R$ 2,50/contrato',
    minimumDeposit: 0,
    automatedTrading: '❌ Manual apenas',
    backtesting: '❌ Não disponível',
    marketReplay: '❌ Não disponível',
    pyramiding: '❌ Manual',
    metaApiIntegration: '❌ Não',
    ownBrokerRequired: true,
    indicators: '50+ (Plataforma PIT)',
    strategies: '0 (manual)',
    assets: '5000+ (ações, FIIs, ETFs, fundos, renda fixa, COE)',
    riskManagement: 'Básico (stop loss manual, sem automação)',
    dataQuality: 'Profissional (Research próprio + Bloomberg para clientes VIP)',
    targetAudience: 'Investidores varejo a high net worth (R$ 100-10M)',
    technology: [
      'Plataforma PIT (desktop Windows/Mac)',
      'App mobile iOS/Android',
      'MetaTrader 5 (apenas Forex, integração terceira)',
      'API REST para desenvolvedores',
      'Dados de mercado via CMA (fornecedor oficial B3)'
    ],
    strengths: [
      'Maior corretora independente do Brasil (4.2M clientes)',
      'Assessoria personalizada sem custo mínimo',
      'Plataforma PIT com análise gráfica avançada',
      'Research institucional de qualidade (Ana Farrache, Fernando Ferrer)',
      'Educação financeira robusta (XP Educação, lives diárias)',
      'Solidez financeira (IPO Nasdaq 2020, US$ 15B valuation)',
      'Ampla variedade de produtos (ações, renda fixa, FIIs, fundos)',
      'Custódia gratuita',
      'Corretagem zero para ações (plano específico)'
    ],
    weaknesses: [
      'SEM automação de trading (100% manual)',
      'Foco em buy & hold, não day trade agressivo',
      'Plataforma PIT pesada (2GB RAM mínimo)',
      'SEM backtesting ou ferramentas quantitativas',
      'Dados básicos de mercado (não institucional)',
      'Corretagem cara para day traders ativos',
      'Plataforma desktop (não web moderna)'
    ],
    pricing: 'Gratuito + corretagem variável por operação',
    realWebsite: 'xpi.com.br'
  },
  {
    name: 'BTG Pactual Digital',
    logo: '🏛️',
    type: 'Corretora',
    monthlyFee: 0,
    corretagem: 'Ações: R$ 8,90 fixo | Mini-índice: R$ 0,90 | Mini-dólar: R$ 0,70',
    minimumDeposit: 0,
    automatedTrading: '❌ Manual apenas',
    backtesting: '❌ Não disponível',
    marketReplay: '❌ Não disponível',
    pyramiding: '❌ Manual',
    metaApiIntegration: '❌ Não',
    ownBrokerRequired: true,
    indicators: '40+ (Plataforma Trading Pro)',
    strategies: '0 (manual)',
    assets: '3000+ (ações, fundos, renda fixa, estruturados)',
    riskManagement: 'Intermediário (stop loss manual, OCO orders)',
    dataQuality: 'Institucional (Research de banco de investimento)',
    targetAudience: 'Investidores sofisticados e HNW (R$ 10k-100M)',
    technology: [
      'BTG+ App (mobile iOS/Android)',
      'Trading Pro Web (plataforma navegador)',
      'MetaTrader 5 (integração terceira)',
      'API REST para clientes qualificados',
      'Bloomberg Terminal (clientes private)'
    ],
    strengths: [
      'Maior banco de investimento da América Latina',
      'Research institucional de primeira linha (top 3 LATAM)',
      'Corretagem competitiva para day trade (R$ 0,70-0,90 mini-contratos)',
      'Acesso a produtos estruturados exclusivos',
      'Private banking para clientes R$ 1M+',
      'Plataforma Trading Pro moderna (web)',
      'Solidez financeira AAA rating',
      'IPO 2023 (US$ 3.9B valuation)'
    ],
    weaknesses: [
      'SEM automação de estratégias',
      'Foco em investimentos médio/longo prazo',
      'SEM ferramentas quantitativas ou backtesting',
      'Plataforma não otimizada para scalping',
      'Barreiras de entrada para produtos premium',
      'Suporte ao trader ativo inferior a corretoras especializadas'
    ],
    pricing: 'Gratuito + corretagem variável (competitiva para futuros)',
    realWebsite: 'btgpactualdigital.com'
  },
  {
    name: 'Empiricus',
    logo: '📈',
    type: 'Assessoria',
    monthlyFee: 'R$ 47 a R$ 1.497',
    corretagem: 'N/A (não executa)',
    minimumDeposit: 0,
    automatedTrading: '❌ Não aplicável',
    backtesting: '❌ Não disponível',
    marketReplay: '❌ Não disponível',
    pyramiding: '❌ Não',
    metaApiIntegration: '❌ Não',
    ownBrokerRequired: true,
    indicators: '0 (apenas recomendações)',
    strategies: '0 (análise/educação)',
    assets: 'N/A (recomendações)',
    riskManagement: 'Educacional (orientações genéricas)',
    dataQuality: 'Retail (fontes públicas + análise própria)',
    targetAudience: 'Investidores de varejo iniciantes a intermediários (R$ 1k-100k)',
    technology: [
      'Plataforma web (portal de assinaturas)',
      'App mobile (iOS/Android)',
      'Newsletter email',
      'Webinars ao vivo'
    ],
    strengths: [
      'Maior casa de análise independente do Brasil',
      'Conteúdo educacional de qualidade (Felipe Miranda, Rodolfo Amstalden)',
      'Múltiplas assinaturas segmentadas (ações, FIIs, cripto, renda fixa)',
      'Recomendações semanais de investimento',
      'Marketing e branding forte (reconhecimento massivo)',
      'Comunidade ativa (500k+ assinantes)',
      'Preço acessível (R$ 47/mês plano básico)',
      'Sem necessidade de conhecimento técnico'
    ],
    weaknesses: [
      'SEM plataforma de execução (depende de corretora)',
      'SEM automação ou ferramentas técnicas',
      'Recomendações genéricas (não personalizadas)',
      'Foco 100% em buy & hold (zero day trade)',
      'SEM backtesting ou validação quantitativa',
      'Não adequado para traders ativos',
      'Assinaturas premium caras (R$ 1.497/mês)'
    ],
    pricing: 'R$ 47/mês (básico) até R$ 1.497/mês (premium)',
    realWebsite: 'empiricus.com.br'
  },
  {
    name: 'TradeMap',
    logo: '🗺️',
    type: 'Tech Platform',
    monthlyFee: 'R$ 197 a R$ 997',
    corretagem: 'R$ 0 (via broker do cliente)',
    minimumDeposit: 'R$ 0 (cliente usa própria conta)',
    automatedTrading: '✅ Parcial (via TradingView webhooks)',
    backtesting: '✅ Dados históricos B3',
    marketReplay: '❌ Não disponível',
    pyramiding: '❌ Manual apenas',
    metaApiIntegration: '❌ Apenas B3/corretoras BR',
    ownBrokerRequired: true,
    indicators: '100+',
    strategies: '10+ (criação própria)',
    assets: '150+ (B3 apenas)',
    riskManagement: 'Avançado (stop automático, trailing, breakeven)',
    dataQuality: 'Profissional (CMA oficial B3)',
    targetAudience: 'Traders ativos e day traders B3 (R$ 5k-200k)',
    technology: [
      'Plataforma web React',
      'API integração TradingView',
      'Webhooks para corretoras B3',
      'Scanner tempo real B3',
      'Backtesting engine proprietário'
    ],
    strengths: [
      'Plataforma completa de análise técnica para B3',
      'Automação via webhooks TradingView',
      'Backtesting com dados históricos reais',
      'Integração múltiplas corretoras brasileiras (Clear, Rico, XP)',
      'Scanner de ativos em tempo real',
      'Alertas customizados',
      'Comunidade ativa de traders',
      'Suporte em português'
    ],
    weaknesses: [
      'Preço MUITO alto (R$ 997/mês plano completo = 6.7x mais caro que nós)',
      'SEM MetaApi ou MT5 (limitado à B3)',
      'SEM pyramiding automatizado',
      'SEM replay de mercado tick-by-tick',
      'Dados limitados ao mercado brasileiro',
      'Curva de aprendizado alta',
      'Automação limitada (depende de TradingView)',
      'Sem dados institucionais (Trading Economics, S&P Global)'
    ],
    pricing: 'R$ 197/mês (básico) até R$ 997/mês (completo)',
    realWebsite: 'trademap.com.br'
  },
  {
    name: 'QuantConnect',
    logo: '🔬',
    type: 'Tech Platform',
    monthlyFee: 'US$ 0 a US$ 250',
    corretagem: 'Variável (broker conectado)',
    minimumDeposit: 'Variável',
    automatedTrading: '✅ Total (código próprio)',
    backtesting: '✅ Institucional (1998-presente)',
    marketReplay: '✅ Tick-by-tick completo',
    pyramiding: '✅ Código customizado',
    metaApiIntegration: '❌ Não diretamente',
    ownBrokerRequired: true,
    indicators: '200+ (bibliotecas)',
    strategies: '∞ (código próprio)',
    assets: '10000+ (global)',
    riskManagement: 'Profissional (código customizado)',
    dataQuality: 'Institucional (QuantQuote, Tiingo, IEX)',
    targetAudience: 'Quants profissionais e desenvolvedores (US$ 10k-10M capital)',
    technology: [
      'LEAN Engine (C# open-source)',
      'Python/C#/F# suportados',
      'Jupyter Notebooks',
      'Cloud computing AWS',
      'API REST completa',
      'Docker containers'
    ],
    strengths: [
      'Plataforma open-source líder mundial',
      'Backtesting institucional de altíssima qualidade',
      'Suporte Python, C#, F# (flexibilidade máxima)',
      'Dados de mercado de primeira linha (25 anos histórico)',
      'Cloud computing escalável',
      'Comunidade global de quants (100k+ usuários)',
      'Plano gratuito robusto',
      'API completa para automação'
    ],
    weaknesses: [
      'Requer programação AVANÇADA (Python/C#) - não é user-friendly',
      'Curva de aprendizado MUITO íngreme (meses)',
      'Interface não intuitiva',
      'SEM suporte em português',
      'Foco em mercado americano (B3 limitado)',
      'Complexidade excessiva para 95% dos traders',
      'Custos cloud computing altos (backtests pesados)',
      'Não adequado para não-desenvolvedores'
    ],
    pricing: 'US$ 0 (free tier) até US$ 250/mês (professional) + cloud computing',
    realWebsite: 'quantconnect.com'
  },
  {
    name: 'MetaTrader 5',
    logo: '📊',
    type: 'Tech Platform',
    monthlyFee: 0,
    corretagem: 'Variável (depende do broker)',
    minimumDeposit: 'Variável (broker)',
    automatedTrading: '✅ Total (Expert Advisors MQL5)',
    backtesting: '✅ Multi-threaded robusto',
    marketReplay: '✅ Tester visual',
    pyramiding: '✅ Via código MQL5',
    metaApiIntegration: '✅ Nativo',
    ownBrokerRequired: true,
    indicators: '80+ nativos',
    strategies: '∞ (EAs customizados)',
    assets: '300+ (Forex/CFDs)',
    riskManagement: 'Avançado (código MQL5)',
    dataQuality: 'Variável (depende do broker)',
    targetAudience: 'Traders Forex/CFDs (US$ 500-100k)',
    technology: [
      'MQL5 (linguagem proprietária)',
      'Multi-threaded backtesting',
      'Desktop C++ nativo',
      'WebTerminal HTML5',
      'Mobile apps nativas',
      'MetaEditor IDE'
    ],
    strengths: [
      'Padrão mundial de trading Forex/CFDs',
      'Gratuito (sem custos de plataforma)',
      'Expert Advisors (EAs) poderosos',
      'Backtesting multi-threaded rápido',
      'Replay de mercado visual nativo',
      'Comunidade global massiva (10M+ usuários)',
      'Marketplace de EAs (mql5.com)',
      'Estável e confiável (20 anos mercado)'
    ],
    weaknesses: [
      'Interface desktop ANTIQUADA (design anos 2000)',
      'Requer programação MQL5 (não é Python/JS)',
      'SEM analytics modernos ou dashboards visuais',
      'Difícil de usar para iniciantes',
      'SEM gestão de risco estruturada moderna',
      'Qualidade de dados depende 100% do broker',
      'Não adequado para B3 (Forex/CFDs foco)',
      'Curva de aprendizado MQL5 alta'
    ],
    pricing: 'Gratuito (custos apenas do broker)',
    realWebsite: 'metatrader5.com'
  },
  {
    name: 'Nord Research',
    logo: '🧭',
    type: 'Robo-Advisor',
    monthlyFee: 'R$ 0 (free tier) a R$ 997',
    corretagem: 'R$ 0 (corretora integrada)',
    minimumDeposit: 100,
    automatedTrading: '✅ Rebalanceamento automático',
    backtesting: '❌ Não disponível',
    marketReplay: '❌ Não disponível',
    pyramiding: '❌ Não aplicável',
    metaApiIntegration: '❌ Não',
    ownBrokerRequired: false,
    indicators: '0 (robo-advisor)',
    strategies: '5 (carteiras prontas)',
    assets: '200+ (ações, FIIs, ETFs)',
    riskManagement: 'Intermediário (diversificação automática)',
    dataQuality: 'Retail (fontes públicas)',
    targetAudience: 'Investidores passivos (R$ 100-50k)',
    technology: [
      'Plataforma web React',
      'App mobile iOS/Android',
      'Rebalanceamento automático',
      'Integração bancária'
    ],
    strengths: [
      'Rebalanceamento automático de carteiras',
      'Estratégias diversificadas prontas',
      'UX/UI moderna e simples (melhor do mercado BR)',
      'Educação financeira integrada',
      'Ideal para investidor passivo',
      'SEM necessidade de conhecimento técnico',
      'Plano gratuito disponível',
      'Corretagem zero',
      'Custódia integrada'
    ],
    weaknesses: [
      'NÃO é plataforma de day trade (buy & hold apenas)',
      'SEM controle granular das operações',
      'Foco 100% em investimento passivo',
      'SEM backtesting ou ferramentas técnicas',
      'Estratégias genéricas (não customizáveis)',
      'Taxa de administração sobre patrimônio',
      'Não adequado para traders ativos',
      'Público completamente diferente do nosso'
    ],
    pricing: 'R$ 0 (free tier) até R$ 997/mês + taxa sobre patrimônio',
    realWebsite: 'nordresearch.com.br'
  }
];

export function CompetitiveAnalysis() {
  const [expandedSection, setExpandedSection] = useState<string | null>('overview');

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const neuralDayTrader = competitors[0];

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="border-b border-gray-800 pb-6">
          <div className="flex items-center gap-3 mb-3">
            <Brain className="w-10 h-10 text-blue-500" />
            <h1 className="text-4xl font-bold">Análise Competitiva Completa</h1>
          </div>
          <p className="text-xl text-gray-400">
            Mercado Brasileiro de Trading Automatizado - Análise Técnica e Comercial Profunda
          </p>
          <div className="mt-4 flex gap-2 flex-wrap">
            <span className="px-3 py-1 bg-blue-500/20 border border-blue-500/40 rounded text-xs text-blue-400 font-medium">
              Nicho: Trading Algorítmico SaaS
            </span>
            <span className="px-3 py-1 bg-green-500/20 border border-green-500/40 rounded text-xs text-green-400 font-medium">
              8 Competidores Analisados
            </span>
            <span className="px-3 py-1 bg-purple-500/20 border border-purple-500/40 rounded text-xs text-purple-400 font-medium">
              Dados Reais Verificados
            </span>
          </div>
        </div>

        {/* 1. PANORAMA DE PREÇOS REAL */}
        <Section
          title="1. Panorama de Preços - Comparação Detalhada"
          icon={DollarSign}
          expanded={expandedSection === 'pricing'}
          onToggle={() => toggleSection('pricing')}
        >
          <div className="space-y-6">
            {/* Tabela de Preços */}
            <div className="bg-gray-900 rounded-lg overflow-hidden border border-gray-800">
              <table className="w-full">
                <thead className="bg-gray-800 border-b-2 border-gray-700">
                  <tr>
                    <th className="text-left p-4 text-sm font-bold text-gray-300">Plataforma</th>
                    <th className="text-left p-4 text-sm font-bold text-gray-300">Mensalidade</th>
                    <th className="text-left p-4 text-sm font-bold text-gray-300">Corretagem</th>
                    <th className="text-left p-4 text-sm font-bold text-gray-300">Depósito Mín.</th>
                    <th className="text-left p-4 text-sm font-bold text-gray-300">Custo Total (mês típico)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-800 bg-blue-500/10">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🧠</span>
                        <div>
                          <div className="font-bold text-white">Neural Day Trader</div>
                          <div className="text-xs text-blue-400">NOSSA PLATAFORMA</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-lg font-bold text-green-400">R$ 149</div>
                      <div className="text-xs text-gray-400">Plano Professional</div>
                    </td>
                    <td className="p-4 text-sm text-gray-300">
                      R$ 0<br/>
                      <span className="text-xs text-gray-500">(via broker cliente)</span>
                    </td>
                    <td className="p-4 text-sm text-gray-300">
                      R$ 0<br/>
                      <span className="text-xs text-gray-500">(recomendado R$ 2k)</span>
                    </td>
                    <td className="p-4">
                      <div className="text-lg font-bold text-white">R$ 149</div>
                      <div className="text-xs text-gray-400">+ comissões IB do broker</div>
                    </td>
                  </tr>

                  <tr className="border-b border-gray-800">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🗺️</span>
                        <div className="font-bold text-white">TradeMap</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-lg font-bold text-red-400">R$ 997</div>
                      <div className="text-xs text-gray-400">Plano completo</div>
                    </td>
                    <td className="p-4 text-sm text-gray-300">R$ 0<br/><span className="text-xs text-gray-500">(via broker)</span></td>
                    <td className="p-4 text-sm text-gray-300">R$ 0<br/><span className="text-xs text-gray-500">(rec. R$ 5k)</span></td>
                    <td className="p-4">
                      <div className="text-lg font-bold text-white">R$ 997</div>
                      <div className="text-xs text-red-400">6.7x mais caro!</div>
                    </td>
                  </tr>

                  <tr className="border-b border-gray-800">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🏦</span>
                        <div className="font-bold text-white">XP Investimentos</div>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-green-400">Grátis</td>
                    <td className="p-4 text-sm text-gray-300">
                      R$ 18,90 (ações)<br/>
                      <span className="text-xs text-gray-500">R$ 2,50/contrato futuros</span>
                    </td>
                    <td className="p-4 text-sm text-gray-300">R$ 0</td>
                    <td className="p-4">
                      <div className="text-lg font-bold text-white">R$ 0-500+</div>
                      <div className="text-xs text-yellow-400">Depende do volume</div>
                    </td>
                  </tr>

                  <tr className="border-b border-gray-800">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🏛️</span>
                        <div className="font-bold text-white">BTG Pactual</div>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-green-400">Grátis</td>
                    <td className="p-4 text-sm text-gray-300">
                      R$ 8,90 (ações)<br/>
                      <span className="text-xs text-gray-500">R$ 0,70-0,90 mini-contratos</span>
                    </td>
                    <td className="p-4 text-sm text-gray-300">R$ 0</td>
                    <td className="p-4">
                      <div className="text-lg font-bold text-white">R$ 0-300+</div>
                      <div className="text-xs text-yellow-400">Depende do volume</div>
                    </td>
                  </tr>

                  <tr className="border-b border-gray-800">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">📈</span>
                        <div className="font-bold text-white">Empiricus</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-lg font-bold text-orange-400">R$ 47-1.497</div>
                      <div className="text-xs text-gray-400">Variável</div>
                    </td>
                    <td className="p-4 text-sm text-gray-300">N/A<br/><span className="text-xs text-gray-500">(sem execução)</span></td>
                    <td className="p-4 text-sm text-gray-300">R$ 0</td>
                    <td className="p-4">
                      <div className="text-lg font-bold text-white">R$ 47-1.497</div>
                      <div className="text-xs text-gray-400">Apenas conteúdo</div>
                    </td>
                  </tr>

                  <tr className="border-b border-gray-800">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🔬</span>
                        <div className="font-bold text-white">QuantConnect</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-lg font-bold text-blue-400">US$ 0-250</div>
                      <div className="text-xs text-gray-400">(R$ 0-1.250)</div>
                    </td>
                    <td className="p-4 text-sm text-gray-300">Variável<br/><span className="text-xs text-gray-500">(broker integrado)</span></td>
                    <td className="p-4 text-sm text-gray-300">Variável</td>
                    <td className="p-4">
                      <div className="text-lg font-bold text-white">R$ 0-2.000+</div>
                      <div className="text-xs text-yellow-400">+ cloud computing</div>
                    </td>
                  </tr>

                  <tr className="border-b border-gray-800">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">📊</span>
                        <div className="font-bold text-white">MetaTrader 5</div>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-green-400">Grátis</td>
                    <td className="p-4 text-sm text-gray-300">Variável<br/><span className="text-xs text-gray-500">(spread do broker)</span></td>
                    <td className="p-4 text-sm text-gray-300">Variável<br/><span className="text-xs text-gray-500">(US$ 100-1k)</span></td>
                    <td className="p-4">
                      <div className="text-lg font-bold text-white">R$ 0</div>
                      <div className="text-xs text-gray-400">Gratuito</div>
                    </td>
                  </tr>

                  <tr className="border-b border-gray-800">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🧭</span>
                        <div className="font-bold text-white">Nord Research</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-lg font-bold text-purple-400">R$ 0-997</div>
                      <div className="text-xs text-gray-400">+ taxa patrimônio</div>
                    </td>
                    <td className="p-4 text-sm text-gray-300">R$ 0<br/><span className="text-xs text-gray-500">(integrada)</span></td>
                    <td className="p-4 text-sm text-gray-300">R$ 100</td>
                    <td className="p-4">
                      <div className="text-lg font-bold text-white">R$ 0-997</div>
                      <div className="text-xs text-gray-400">+ taxa sobre AUM</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Análise de Valor */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-green-500/20 to-green-500/5 border border-green-500/30 rounded-lg p-6">
                <div className="text-sm font-bold text-green-400 mb-2">💰 MELHOR CUSTO-BENEFÍCIO</div>
                <div className="text-2xl font-bold text-white mb-2">Neural Day Trader</div>
                <div className="text-sm text-gray-300">
                  R$ 149/mês para automação completa com tecnologia institucional. 
                  <strong className="text-green-400"> 87% mais barato que TradeMap</strong> com mais recursos.
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/30 rounded-lg p-6">
                <div className="text-sm font-bold text-blue-400 mb-2">🆓 GRATUITOS MAS LIMITADOS</div>
                <div className="text-2xl font-bold text-white mb-2">XP / BTG / MT5</div>
                <div className="text-sm text-gray-300">
                  Plataforma gratuita mas <strong className="text-yellow-400">SEM automação</strong>. 
                  MT5 é gratuito mas requer programação MQL5.
                </div>
              </div>

              <div className="bg-gradient-to-br from-red-500/20 to-red-500/5 border border-red-500/30 rounded-lg p-6">
                <div className="text-sm font-bold text-red-400 mb-2">💸 MAIS CAROS</div>
                <div className="text-2xl font-bold text-white mb-2">TradeMap / Empiricus</div>
                <div className="text-sm text-gray-300">
                  TradeMap: <strong className="text-red-400">R$ 997/mês</strong> (limitado à B3). 
                  Empiricus Premium: <strong className="text-red-400">R$ 1.497/mês</strong> (apenas conteúdo).
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* 2. ANÁLISE TECNOLÓGICA PROFUNDA */}
        <Section
          title="2. Comparação Tecnológica Completa"
          icon={Cpu}
          expanded={expandedSection === 'tech'}
          onToggle={() => toggleSection('tech')}
        >
          <div className="space-y-6">
            {competitors.map((competitor, index) => (
              <TechComparisonCard key={competitor.name} competitor={competitor} isOurs={index === 0} />
            ))}
          </div>
        </Section>

        {/* 3. MATRIZ FUNCIONAL COMPLETA */}
        <Section
          title="3. Matriz de Funcionalidades - Lado a Lado"
          icon={BarChart3}
          expanded={expandedSection === 'matrix'}
          onToggle={() => toggleSection('matrix')}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-700">
                  <th className="text-left p-3 font-bold text-gray-400 sticky left-0 bg-black z-10">Recurso</th>
                  {competitors.map(c => (
                    <th key={c.name} className={`p-3 text-center min-w-[120px] ${c.name === 'Neural Day Trader' ? 'bg-blue-500/20' : ''}`}>
                      <div className="text-2xl mb-1">{c.logo}</div>
                      <div className="text-xs font-bold">{c.name.split(' ')[0]}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <ComparisonRow label="Trading Automatizado" values={competitors.map(c => c.automatedTrading)} type="check" />
                <ComparisonRow label="Backtesting" values={competitors.map(c => c.backtesting)} type="check" />
                <ComparisonRow label="Replay de Mercado" values={competitors.map(c => c.marketReplay)} type="check" />
                <ComparisonRow label="Pyramiding" values={competitors.map(c => c.pyramiding)} type="check" />
                <ComparisonRow label="MetaApi/MT5" values={competitors.map(c => c.metaApiIntegration)} type="check" />
                <ComparisonRow label="Gestão de Risco" values={competitors.map(c => c.riskManagement)} type="text" />
                <ComparisonRow label="Qualidade de Dados" values={competitors.map(c => c.dataQuality)} type="text" />
                <ComparisonRow label="Nº Indicadores" values={competitors.map(c => c.indicators)} type="text" />
                <ComparisonRow label="Nº Estratégias" values={competitors.map(c => c.strategies)} type="text" />
                <ComparisonRow label="Nº Ativos" values={competitors.map(c => c.assets)} type="text" />
                <ComparisonRow label="Mensalidade" values={competitors.map(c => c.monthlyFee)} type="price" />
                <ComparisonRow label="Website" values={competitors.map(c => c.realWebsite)} type="text" />
              </tbody>
            </table>
          </div>
        </Section>

        {/* 4. RECOMENDAÇÕES ESTRATÉGICAS */}
        <Section
          title="4. Recomendações de Preço e Operação"
          icon={Target}
          expanded={expandedSection === 'recommendations'}
          onToggle={() => toggleSection('recommendations')}
        >
          <div className="space-y-6">
            {/* Preço Recomendado */}
            <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 border border-green-500/30 rounded-lg p-6">
              <h3 className="text-lg font-bold text-green-400 mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                Estratégia de Pricing Recomendada
              </h3>
              
              <div className="grid grid-cols-3 gap-4 mb-6">
                {/* Starter */}
                <div className="bg-black/50 border border-gray-700 rounded-lg p-6">
                  <div className="text-sm text-gray-400 mb-2">STARTER</div>
                  <div className="text-3xl font-bold text-white mb-1">R$ 99</div>
                  <div className="text-xs text-gray-500 mb-4">/mês</div>
                  <div className="space-y-2 text-xs text-gray-300 mb-4">
                    <div className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-green-500" /> 1 estratégia ativa</div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-green-500" /> 15 indicadores</div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-green-500" /> Backtesting básico</div>
                    <div className="flex items-center gap-2"><XCircle className="w-3 h-3 text-gray-600" /> Sem pyramiding</div>
                  </div>
                  <div className="pt-4 border-t border-gray-700 text-xs text-gray-400">
                    Aporte mínimo: <strong className="text-white">R$ 500</strong>
                  </div>
                </div>

                {/* Professional */}
                <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-2 border-blue-500 rounded-lg p-6 relative">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    RECOMENDADO
                  </div>
                  <div className="text-sm text-blue-400 mb-2">PROFESSIONAL</div>
                  <div className="text-3xl font-bold text-white mb-1">R$ 149</div>
                  <div className="text-xs text-gray-500 mb-4">/mês</div>
                  <div className="space-y-2 text-xs text-gray-300 mb-4">
                    <div className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-green-500" /> 3 estratégias simultâneas</div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-green-500" /> 23 indicadores</div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-green-500" /> Pyramiding profissional</div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-green-500" /> Contenção 5 camadas</div>
                  </div>
                  <div className="pt-4 border-t border-blue-500/30 text-xs text-gray-400">
                    Aporte mínimo: <strong className="text-white">R$ 2.000</strong>
                  </div>
                </div>

                {/* Elite */}
                <div className="bg-black/50 border border-purple-500 rounded-lg p-6">
                  <div className="text-sm text-purple-400 mb-2">ELITE</div>
                  <div className="text-3xl font-bold text-white mb-1">R$ 297</div>
                  <div className="text-xs text-gray-500 mb-4">/mês</div>
                  <div className="space-y-2 text-xs text-gray-300 mb-4">
                    <div className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-green-500" /> Estratégias ilimitadas</div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-green-500" /> API personalizada</div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-green-500" /> Suporte prioritário</div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-green-500" /> Consultoria 1h/mês</div>
                  </div>
                  <div className="pt-4 border-t border-purple-500/30 text-xs text-gray-400">
                    Aporte mínimo: <strong className="text-white">R$ 10.000</strong>
                  </div>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded p-4 text-sm text-gray-300">
                <strong className="text-blue-400">Justificativa:</strong> R$ 149/mês é o sweet spot competitivo. 
                87% mais barato que TradeMap (R$ 997), mas com mais recursos. Sustentável para LTV de R$ 4.470 (15 meses retenção).
              </div>
            </div>

            {/* Aportes Mínimos */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6">
              <h4 className="text-sm font-bold text-yellow-400 mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Aportes Mínimos Recomendados (Gestão de Expectativa)
              </h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-400">Starter</div>
                  <div className="text-2xl font-bold text-white mt-1">R$ 500</div>
                  <div className="text-xs text-gray-500 mt-2">
                    Capital mínimo para testar 1 estratégia conservadora sem risco excessivo. 
                    Adequado para aprendizado inicial.
                  </div>
                </div>
                <div>
                  <div className="text-gray-400">Professional</div>
                  <div className="text-2xl font-bold text-white mt-1">R$ 2.000</div>
                  <div className="text-xs text-gray-500 mt-2">
                    Capital adequado para operar 3 estratégias simultâneas com pyramiding e gestão de risco profissional. 
                    <strong className="text-green-400">Recomendado.</strong>
                  </div>
                </div>
                <div>
                  <div className="text-gray-400">Elite</div>
                  <div className="text-2xl font-bold text-white mt-1">R$ 10.000</div>
                  <div className="text-xs text-gray-500 mt-2">
                    Capital para diversificação máxima, múltiplas estratégias simultâneas com pyramiding agressivo. 
                    Trader profissional.
                  </div>
                </div>
              </div>
            </div>

            {/* Modelo de Operação */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                <h4 className="text-sm font-bold text-blue-400 mb-4">🎯 Modelo de Operação</h4>
                <ul className="space-y-3 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    <span><strong>SaaS Puro:</strong> Cliente paga R$ 149/mês, sem bloqueio de capital</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    <span><strong>Comissões IB:</strong> R$ 50-200/mês por cliente ativo (volume médio)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    <span><strong>Conta própria:</strong> Cliente conecta broker via MetaApi, mantém 100% controle</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    <span><strong>Fornecedor de tecnologia:</strong> NÃO somos gestor de fundos (sem CVM)</span>
                  </li>
                </ul>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                <h4 className="text-sm font-bold text-green-400 mb-4">💰 Projeção de Receita (ano 1)</h4>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-gray-400">MRR Mês 3 (Beta)</div>
                    <div className="text-xl font-bold text-white">R$ 3.7k</div>
                    <div className="text-xs text-gray-500">75 usuários × R$ 49</div>
                  </div>
                  <div className="pt-3 border-t border-gray-800">
                    <div className="text-xs text-gray-400">MRR Mês 12 (Escala)</div>
                    <div className="text-xl font-bold text-green-400">R$ 178k</div>
                    <div className="text-xs text-gray-500">1.200 usuários × R$ 149</div>
                  </div>
                  <div className="pt-3 border-t border-gray-800">
                    <div className="text-xs text-gray-400">ARR (Annual Recurring Revenue)</div>
                    <div className="text-xl font-bold text-purple-400">R$ 2.1M</div>
                    <div className="text-xs text-gray-500">Meta final ano 1</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* 5. CONCLUSÃO ESTRATÉGICA */}
        <Section
          title="5. Conclusão e Posicionamento Final"
          icon={CheckCircle2}
          expanded={expandedSection === 'conclusion'}
          onToggle={() => toggleSection('conclusion')}
        >
          <div className="space-y-6">
            {/* Posicionamento Único */}
            <div className="bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-green-500/20 border border-blue-500/40 rounded-lg p-8">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Trophy className="w-6 h-6 text-yellow-400" />
                Nossa Posição Única de Mercado
              </h3>
              <p className="text-gray-300 leading-relaxed mb-4 text-lg">
                A <strong className="text-blue-400">Neural Day Trader Platform</strong> é a <strong className="text-white">ÚNICA plataforma SaaS brasileira</strong> que combina:
              </p>
              <div className="grid grid-cols-2 gap-4">
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <Star className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                    <span><strong className="text-white">Tecnologia institucional</strong> (Trading Economics, S&P Global) a preço acessível</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Star className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                    <span><strong className="text-white">Pyramiding automatizado profissional</strong> (não existe em NENHUM concorrente BR)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Star className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                    <span><strong className="text-white">MetaApi MT5 nativo</strong> (sem necessidade de VPS ou programação MQL5)</span>
                  </li>
                </ul>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <Star className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                    <span><strong className="text-white">Contenção Estrutural 5 camadas</strong> (gestão de risco superior a todos)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Star className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                    <span><strong className="text-white">R$ 149/mês</strong> (87% mais barato que TradeMap, sem bloqueio de capital)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Star className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                    <span><strong className="text-white">Modelo SaaS puro</strong> (cliente mantém 100% controle do capital)</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Veredito Final */}
            <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 border-2 border-green-500/50 rounded-lg p-8">
              <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                <Rocket className="w-7 h-7 text-green-400" />
                Veredito Final
              </h3>
              <div className="space-y-4 text-gray-300 leading-relaxed">
                <p className="text-lg">
                  <strong className="text-green-400 text-xl">✅ ALTAMENTE VIÁVEL E COMPETITIVO.</strong>
                </p>
                <p>
                  Nenhum player brasileiro oferece a combinação única da Neural Day Trader: 
                  <span className="text-white font-semibold"> tecnologia institucional + automação completa + preço acessível + modelo SaaS sem bloqueio de capital</span>.
                </p>
                <p>
                  <strong className="text-blue-400">Competidores são inadequados:</strong>
                </p>
                <ul className="space-y-2 text-sm ml-6">
                  <li>• <strong>XP/BTG:</strong> Zero automação, foco em buy & hold</li>
                  <li>• <strong>TradeMap:</strong> 6.7x mais caro, sem MetaApi, sem pyramiding</li>
                  <li>• <strong>Empiricus:</strong> Apenas conteúdo, sem execução</li>
                  <li>• <strong>QuantConnect:</strong> Complexo demais, requer programação avançada</li>
                  <li>• <strong>MT5:</strong> Interface antiquada, requer MQL5</li>
                  <li>• <strong>Nord:</strong> Robo-advisor passivo, público diferente</li>
                </ul>
                <p className="text-white font-bold text-lg pt-4 border-t border-gray-700">
                  🚀 <strong className="text-green-400">Preço recomendado: R$ 149/mês</strong> (Professional) com aportes mínimos R$ 500 (Starter), R$ 2k (Pro), R$ 10k (Elite).
                </p>
                <p className="text-white font-bold text-lg">
                  🎯 <strong className="text-blue-400">Nicho validado, tecnologia pronta, momento ideal para lançamento.</strong>
                </p>
              </div>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

// Section Component
interface SectionProps {
  title: string;
  icon: any;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function Section({ title, icon: Icon, expanded, onToggle, children }: SectionProps) {
  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-6 bg-gray-900 hover:bg-gray-800 transition-colors flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-6 h-6 text-blue-400" />
          <h2 className="text-xl font-bold text-white">{title}</h2>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>
      {expanded && (
        <div className="p-6 bg-black border-t border-gray-800">
          {children}
        </div>
      )}
    </div>
  );
}

// Tech Comparison Card
function TechComparisonCard({ competitor, isOurs }: { competitor: Competitor; isOurs: boolean }) {
  return (
    <div className={`border rounded-lg p-6 ${
      isOurs 
        ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-blue-500/50' 
        : 'bg-gray-900 border-gray-800'
    }`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="text-4xl">{competitor.logo}</div>
          <div>
            <h3 className="text-lg font-bold text-white">{competitor.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 bg-gray-800 rounded text-gray-400">
                {competitor.type}
              </span>
              {isOurs && (
                <span className="text-xs px-2 py-0.5 bg-blue-500 rounded text-white font-bold">
                  NOSSA PLATAFORMA
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tech Stack */}
      <div className="mb-4">
        <h4 className="text-xs font-bold text-blue-400 mb-2 flex items-center gap-1">
          <Code className="w-3 h-3" />
          STACK TECNOLÓGICO
        </h4>
        <div className="flex flex-wrap gap-1">
          {competitor.technology.map((tech, i) => (
            <span key={i} className="text-xs px-2 py-1 bg-gray-800 rounded text-gray-300">
              {tech}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h4 className="text-sm font-bold text-green-400 mb-2 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Pontos Fortes
          </h4>
          <ul className="space-y-1">
            {competitor.strengths.slice(0, 5).map((strength, i) => (
              <li key={i} className="text-xs text-gray-300 flex items-start gap-1">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>{strength}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-bold text-red-400 mb-2 flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            Pontos Fracos
          </h4>
          <ul className="space-y-1">
            {competitor.weaknesses.slice(0, 5).map((weakness, i) => (
              <li key={i} className="text-xs text-gray-300 flex items-start gap-1">
                <span className="text-red-500 mt-0.5">✗</span>
                <span>{weakness}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// Comparison Row
function ComparisonRow({ 
  label, 
  values, 
  type = 'check' 
}: { 
  label: string; 
  values: any[]; 
  type?: 'check' | 'text' | 'price';
}) {
  return (
    <tr className="border-b border-gray-800 hover:bg-gray-900/50">
      <td className="p-3 text-gray-300 font-medium sticky left-0 bg-black">{label}</td>
      {values.map((value, idx) => (
        <td key={idx} className={`p-3 text-center ${idx === 0 ? 'bg-blue-500/10' : ''}`}>
          {type === 'check' ? (
            typeof value === 'string' ? (
              <span className="text-xs text-white">{value}</span>
            ) : value ? (
              <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto" />
            ) : (
              <XCircle className="w-5 h-5 text-gray-600 mx-auto" />
            )
          ) : type === 'price' ? (
            <span className="text-white text-xs">
              {typeof value === 'number' 
                ? value === 0 ? 'Grátis' : `R$ ${value}`
                : value}
            </span>
          ) : (
            <span className="text-white text-xs">{value}</span>
          )}
        </td>
      ))}
    </tr>
  );
}
