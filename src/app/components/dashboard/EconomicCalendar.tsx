import React, { useState, useEffect } from 'react';
import { Calendar, Clock, AlertTriangle, RefreshCw, Star } from 'lucide-react';
import { supabase, isSupabaseActive } from '../../../lib/supabaseClient';
import { projectId, publicAnonKey } from '/utils/supabase/info';

interface EconomicEvent {
  id: string;
  event_time: string; // ISO string
  country: string;
  currency: string;
  event: string;
  impact: 'high' | 'medium' | 'low';
  actual: string;
  forecast: string;
  previous: string;
}

export function EconomicCalendar() {
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isRealData, setIsRealData] = useState(false); // ✅ NOVO: Flag para saber se é real
  const [dataSource, setDataSource] = useState<string>(''); // ✅ NOVO: Nome da fonte

  // Timer for countdowns - 🔥 OTIMIZADO: Atualizar apenas a cada 30 segundos ao invés de 1 segundo
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000); // 30 segundos
    return () => clearInterval(timer);
  }, []);

  // Data Fetching Logic
  useEffect(() => {
    loadEvents();
    
    // ✅ AUTO-ATUALIZAÇÃO: A cada 3 minutos durante o dia
    const refreshInterval = setInterval(loadEvents, 180000); // 3 min
    
    // ✅ AUTO-ATUALIZAÇÃO DIÁRIA: Recarregar às 00:00 (meia-noite)
    const scheduleMidnightRefresh = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0); // Definir para meia-noite
      
      const msUntilMidnight = tomorrow.getTime() - now.getTime();
      
      console.log(`🕐 [AGENDA] Próxima atualização automática em: ${(msUntilMidnight / 1000 / 60 / 60).toFixed(2)} horas (meia-noite)`);
      
      // Agendar atualização para meia-noite
      const midnightTimeout = setTimeout(() => {
        console.log('🌃 [AGENDA] ✅ ATUALIZAÇÃO AUTOMÁTICA DE MEIA-NOITE');
        loadEvents();
        // Reagendar para a próxima meia-noite
        scheduleMidnightRefresh();
      }, msUntilMidnight);
      
      return midnightTimeout;
    };
    
    const midnightTimer = scheduleMidnightRefresh();
    
    return () => {
      clearInterval(refreshInterval);
      clearTimeout(midnightTimer);
    };
  }, []);

  async function loadEvents() {
    try {
      console.log('🔄 [AGENDA] Iniciando carregamento de eventos...');
      
      // ✅ PRIORIDADE 1: Buscar dados REAIS da API (Multi-fonte)
      const realEvents = await fetchRealEconomicData();
      if (realEvents && realEvents.events && realEvents.events.length > 0) {
        console.log('✅ [AGENDA] Dados reais recebidos:', realEvents.source);
        setEvents(realEvents.events);
        setLoading(false);
        setIsRealData(true); // ✅ NOVO: Marcar como real
        setDataSource(realEvents.source || 'API'); // ✅ NOVO: Definir fonte
        return;
      }

      console.log('⚠️ [AGENDA] API não retornou dados, usando mock...');
      
      // ✅ FALLBACK: Mock data
      const userRegion = localStorage.getItem('neural_user_region') || 'BR';
      generateMockEvents(userRegion);
      setLoading(false);
      setIsRealData(false);
      setDataSource('Mock');

    } catch (error) {
      console.error('[EconomicCalendar] Erro ao carregar eventos:', error);
      const userRegion = localStorage.getItem('neural_user_region') || 'BR';
      generateMockEvents(userRegion);
      setLoading(false);
      setIsRealData(false);
      setDataSource('Mock');
    }
  }

  // ✅ NOVA FUNÇÃO: Buscar dados reais da API (Multi-fonte)
  async function fetchRealEconomicData(): Promise<{ events: EconomicEvent[], source: string } | null> {
    try {
      // 🚨 MODO OFFLINE: Supabase desabilitado (quota excedida)
      console.log('[AGENDA ECONÔMICA] 🔄 Modo offline ativado - usando mock');
      return null;

      /* DESATIVADO - Quota Supabase excedida */

    } catch (error) {
      console.error('[AGENDA ECONÔMICA] ❌ Erro ao buscar dados:', error);
      return null;
    }
  }

  // ✅ TRADUÇÃO DE EVENTOS ECONÔMICOS (Inglês → Português)
  function translateEventName(englishName: string): string {
    const translations: Record<string, string> = {
      // ====== PRINCIPAIS EVENTOS (High Impact) ======
      'Non-Farm Payrolls': 'Folha de Pagamento Não-Agrícola (NFP)',
      'Nonfarm Payrolls': 'Folha de Pagamento Não-Agrícola (NFP)',
      'NFP': 'Folha de Pagamento Não-Agrícola (NFP)',
      'Initial Jobless Claims': 'Pedidos Iniciais de Seguro-Desemprego',
      'Unemployment Rate': 'Taxa de Desemprego',
      'Federal Funds Rate': 'Taxa de Juros do Fed',
      'Interest Rate Decision': 'Decisão da Taxa de Juros',
      'FOMC Meeting': 'Reunião do FOMC (Fed)',
      'GDP': 'PIB',
      'Gross Domestic Product': 'Produto Interno Bruto (PIB)',
      'CPI': 'IPC (Índice de Preços ao Consumidor)',
      'Consumer Price Index': 'Índice de Preços ao Consumidor (IPC)',
      'Core CPI': 'IPC Núcleo',
      'PPI': 'IPP (Índice de Preços ao Produtor)',
      'Producer Price Index': 'Índice de Preços ao Produtor (IPP)',
      'Retail Sales': 'Vendas no Varejo',
      'Trade Balance': 'Balança Comercial',
      'PMI': 'PMI (Índice de Gerentes de Compras)',
      'Manufacturing PMI': 'PMI Industrial',
      'Services PMI': 'PMI de Serviços',
      
      // ====== FED / BANCO CENTRAL US ======
      'Fed Chair Powell Speech': 'Discurso do Presidente do Fed (Powell)',
      'FOMC Statement': 'Declaração do FOMC',
      'FOMC Press Conference': 'Coletiva de Imprensa do FOMC',
      'Fed Interest Rate Decision': 'Decisão de Taxa de Juros do Fed',
      'Kansas City Fed': 'Fed de Kansas City',
      'KC Fed': 'Fed de Kansas City',
      'Dallas Fed': 'Fed de Dallas',
      'Philadelphia Fed': 'Fed de Filadélfia',
      'Philly Fed': 'Fed de Filadélfia',
      'Richmond Fed': 'Fed de Richmond',
      'Chicago Fed': 'Fed de Chicago',
      'Atlanta Fed': 'Fed de Atlanta',
      'New York Fed': 'Fed de Nova York',
      'NY Fed': 'Fed de Nova York',
      'San Francisco Fed': 'Fed de São Francisco',
      
      // ====== GASTOS E RENDA PESSOAL (EUA) ======
      'Personal Income': 'Renda Pessoal',
      'Personal Spending': 'Gastos Pessoais',
      'Personal Consumption': 'Consumo Pessoal',
      'Real Personal Consumption': 'Consumo Pessoal Real',
      'Real Personal Income': 'Renda Pessoal Real',
      'Consumer Spending': 'Gastos do Consumidor',
      
      // ====== PCE (ÍNDICE PREFERIDO DO FED) ======
      'PCE': 'PCE (Índice de Gastos de Consumo Pessoal)',
      'PCE Price Index': 'Índice de Preços PCE',
      'Core PCE': 'PCE Núcleo',
      'Core PCE Price Index': 'Índice de Preços PCE Núcleo',
      'Dallas Fed PCE': 'PCE do Fed de Dallas',
      'Trimmed Mean PCE': 'PCE Média Aparada',
      
      // ====== ENERGIA E COMMODITIES ======
      'Natural Gas Storage': 'Estoques de Gás Natural',
      'Natural Gas': 'Gás Natural',
      'Crude Oil Inventories': 'Estoques de Petróleo Bruto',
      'Crude Oil': 'Petróleo Bruto',
      'Oil Inventories': 'Estoques de Petróleo',
      'Gasoline Inventories': 'Estoques de Gasolina',
      'Heating Oil Inventories': 'Estoques de Óleo de Aquecimento',
      'Distillate Inventories': 'Estoques de Destilados',
      'EIA Crude Oil': 'Petróleo Bruto (EIA)',
      'EIA Natural Gas': 'Gás Natural (EIA)',
      'API Crude Oil': 'Petróleo Bruto (API)',
      'Baker Hughes Oil Rig': 'Contagem de Plataformas de Petróleo (Baker Hughes)',
      'Baker Hughes Gas Rig': 'Contagem de Plataformas de Gás (Baker Hughes)',
      
      // ====== EUROPA / BCE (EXPANDIDO) ======
      'ECB Interest Rate Decision': 'Decisão da Taxa de Juros do BCE',
      'ECB Press Conference': 'Coletiva de Imprensa do BCE',
      'Lagarde Speech': 'Discurso de Lagarde (BCE)',
      'German GDP': 'PIB Alemão',
      'German ZEW Economic Sentiment': 'Sentimento Econômico ZEW (Alemanha)',
      'German IFO Business Climate': 'Clima de Negócios IFO (Alemanha)',
      'Eurozone CPI': 'IPC da Zona do Euro',
      'Eurozone GDP': 'PIB da Zona do Euro',
      'BCE Publishes Account of Monetary Policy': 'BCE Publica Ata de Política Monetária',
      'ECB Monetary Policy Account': 'Ata de Política Monetária do BCE',
      'ECB Account': 'Ata do BCE',
      'Account of Monetary Policy': 'Ata de Política Monetária',
      'Monetary Policy Account': 'Ata de Política Monetária',
      'Publishes Account': 'Publica Ata',
      'ECB Minutes': 'Ata do BCE',
      'Governing Council': 'Conselho do Governador',
      'European Central Bank': 'Banco Central Europeu',
      'ECB': 'BCE (Banco Central Europeu)',
      'Euro Area': 'Zona do Euro',
      'Eurozone': 'Zona do Euro',
      'German Ifo': 'Ifo Alemão',
      'ZEW': 'ZEW (Centro de Pesquisa Econômica Europeia)',
      
      // ====== UK / BANCO DA INGLATERRA ======
      'BoE Interest Rate Decision': 'Decisão da Taxa de Juros do BoE',
      'Bank of England': 'Banco da Inglaterra',
      'UK GDP': 'PIB do Reino Unido',
      'UK CPI': 'IPC do Reino Unido',
      'UK Retail Sales': 'Vendas no Varejo (Reino Unido)',
      'UK Employment': 'Emprego no Reino Unido',
      'Claimant Count': 'Contagem de Beneficiários de Desemprego',
      
      // ====== JAPÃO ======
      'BoJ Interest Rate Decision': 'Decisão da Taxa de Juros do BoJ',
      'Bank of Japan': 'Banco do Japão',
      'Japan GDP': 'PIB do Japão',
      'Japan CPI': 'IPC do Japão',
      'Tankan Survey': 'Pesquisa Tankan',
      'Japan Trade Balance': 'Balança Comercial do Japão',
      
      // ====== CHINA ======
      'China GDP': 'PIB da China',
      'China CPI': 'IPC da China',
      'China PMI': 'PMI da China',
      'China Trade Balance': 'Balança Comercial da China',
      'Caixin PMI': 'PMI Caixin (China)',
      'NBS PMI': 'PMI NBS (China)',
      
      // ====== AUSTRÁLIA ======
      'RBA Interest Rate Decision': 'Decisão da Taxa de Juros do RBA',
      'Reserve Bank of Australia': 'Banco Central da Austrália (RBA)',
      'Australia GDP': 'PIB da Austrália',
      'Australia Employment': 'Emprego na Austrália',
      
      // ====== CANADÁ ======
      'BoC Interest Rate Decision': 'Decisão da Taxa de Juros do BoC',
      'Bank of Canada': 'Banco do Canadá',
      'Canada GDP': 'PIB do Canadá',
      'Canada Employment Change': 'Variação do Emprego no Canadá',
      'Ivey PMI': 'PMI Ivey (Canadá)',
      
      // ====== BRASIL ======
      'Brazil Interest Rate': 'Taxa Selic (Brasil)',
      'Selic Rate': 'Taxa Selic',
      'IPCA': 'IPCA (Inflação Brasil)',
      'Brazil GDP': 'PIB do Brasil',
      'Brazil Trade Balance': 'Balança Comercial Brasileira',
      'IBC-Br': 'IBC-Br (Prévia do PIB)',
      'BCB National Monetary Council': 'Reunião do Copom (BCB)',
      'National Monetary Council': 'Conselho Monetário Nacional',
      'Monetary Council': 'Conselho Monetário',
      'Copom Meeting': 'Reunião do Copom',
      'Copom Minutes': 'Ata do Copom',
      'Brazil Inflation': 'Inflação do Brasil',
      'Brazil Central Bank': 'Banco Central do Brasil',
      'BCB': 'Banco Central do Brasil',
      'FGV Inflation': 'Inflação FGV',
      'IGP-M': 'IGP-M (Inflação)',
      'Focus Survey': 'Boletim Focus',
      'Focus Report': 'Relatório Focus',
      
      // ====== OUTROS EVENTOS IMPORTANTES ======
      'Building Permits': 'Licenças de Construção',
      'Housing Starts': 'Início de Construções',
      'Industrial Production': 'Produção Industrial',
      'Capacity Utilization': 'Utilização da Capacidade',
      'Business Inventories': 'Estoques Empresariais',
      'Durable Goods Orders': 'Pedidos de Bens Duráveis',
      'Factory Orders': 'Pedidos Industriais',
      'ISM Manufacturing': 'ISM Industrial',
      'ISM Services': 'ISM de Serviços',
      'ISM Non-Manufacturing': 'ISM Não-Industrial',
      'Consumer Confidence': 'Confiança do Consumidor',
      'Michigan Consumer Sentiment': 'Sentimento do Consumidor (Michigan)',
      'CB Consumer Confidence': 'Confiança do Consumidor (CB)',
      'ADP Employment': 'Emprego ADP',
      'Continuing Jobless Claims': 'Pedidos Contínuos de Seguro-Desemprego',
      'Average Hourly Earnings': 'Rendimento Médio por Hora',
      'Labor Force Participation': 'Taxa de Participação da Força de Trabalho',
      'Existing Home Sales': 'Vendas de Casas Usadas',
      'New Home Sales': 'Vendas de Casas Novas',
      'Pending Home Sales': 'Vendas de Casas Pendentes',
      'MBA Mortgage Applications': 'Pedidos de Hipotecas MBA',
      'Wholesale Inventories': 'Estoques no Atacado',
      'JOLTs Job Openings': 'Vagas de Emprego (JOLTs)',
      'Challenger Job Cuts': 'Cortes de Emprego (Challenger)',
      'Empire State Manufacturing': 'Índice Industrial Empire State',
      'Beige Book': 'Livro Bege (Fed)',
      'NFIB Small Business': 'Otimismo de Pequenas Empresas (NFIB)',
      'Redbook': 'Vendas no Varejo Redbook',
      
      // ====== HABITAÇÃO ======
      'Home Sales': 'Vendas de Casas',
      'Housing': 'Habitação',
      'Mortgage': 'Hipoteca',
      'NAHB Housing Market': 'Índice do Mercado Imobiliário NAHB',
      'S&P/CS Home Price': 'Índice de Preços de Imóveis S&P/CS',
      'Case Shiller': 'Case-Shiller',
      
      // ====== INDICADORES DE SENTIMENTO ======
      'Business Confidence': 'Confiança Empresarial',
      'Economic Optimism': 'Otimismo Econômico',
      'Leading Indicators': 'Indicadores Antecedentes',
      'Coincident Indicators': 'Indicadores Coincidentes',
      
      // ====== PALAVRAS-CHAVE COMUNS ======
      'Storage': 'Estoques',
      'Inventories': 'Estoques',
      'Stocks': 'Estoques',
      'Inflation': 'Inflação',
      'Employment': 'Emprego',
      'Jobs': 'Empregos',
      'Rate': 'Taxa',
      'Index': 'Índice',
      'Sentiment': 'Sentimento',
      'Confidence': 'Confiança',
      'Output': 'Produção',
      'Sales': 'Vendas',
      'Orders': 'Pedidos',
      'Balance': 'Balança',
      'Survey': 'Pesquisa',
      'Report': 'Relatório',
      'Data': 'Dados',
      'Release': 'Divulgação',
      'Speech': 'Discurso',
      'Meeting': 'Reunião',
      'Decision': 'Decisão',
      'Statement': 'Declaração',
      'Press Conference': 'Coletiva de Imprensa',
      'Minutes': 'Ata',
      'Price': 'Preço',
      'Prices': 'Preços',
      'Income': 'Renda',
      'Spending': 'Gastos',
      'Consumption': 'Consumo',
      'Production': 'Produção',
      'United States': 'Estados Unidos',
      'Germany': 'Alemanha',
      'France': 'França',
      'Italy': 'Itália',
      'Spain': 'Espanha',
      'Portugal': 'Portugal',
      'Brazil': 'Brasil',
      'Canada': 'Canadá',
      'Australia': 'Austrália',
      'Japan': 'Japão',
      'China': 'China',
    };
    
    // Tentar tradução exata primeiro
    if (translations[englishName]) {
      return translations[englishName];
    }
    
    // Tradução parcial (buscar palavras-chave) - usar regex de palavra completa
    let translated = englishName;
    
    // Ordenar por tamanho (palavras maiores primeiro) para evitar substituições parciais
    const sortedKeys = Object.keys(translations).sort((a, b) => b.length - a.length);
    
    for (const key of sortedKeys) {
      // Usar word boundary para evitar substituições parciais
      const regex = new RegExp(`\\b${key}\\b`, 'gi');
      if (translated.match(regex)) {
        translated = translated.replace(regex, translations[key]);
      }
    }
    
    // Se não mudou nada, retornar original
    return translated === englishName ? englishName : translated;
  }

  function getRelevantCurrencies(region: string) {
      switch(region) {
          case 'BR': return ['BRL', 'USD', 'EUR'];
          case 'PT': return ['EUR', 'USD', 'GBP'];
          case 'US': return ['USD', 'EUR', 'JPY', 'CAD'];
          case 'UK': return ['GBP', 'EUR', 'USD'];
          default: return ['USD', 'EUR'];
      }
  }

  function generateMockEvents(region: string = 'BR') {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    // Pool of realistic events
    const allEvents = [
        { c: 'US', cur: 'USD', e: 'Pedidos Iniciais de Seguro-Desemprego', i: 'high' },
        { c: 'US', cur: 'USD', e: 'Payroll (NFP)', i: 'high' },
        { c: 'US', cur: 'USD', e: 'Decisão da Taxa de Juros do Fed', i: 'high' },
        { c: 'EU', cur: 'EUR', e: 'IPC (Anual)', i: 'high' },
        { c: 'EU', cur: 'EUR', e: 'Discurso de Lagarde (BCE)', i: 'medium' },
        { c: 'GB', cur: 'GBP', e: 'PIB (QoQ)', i: 'high' },
        { c: 'JP', cur: 'JPY', e: 'Balança Comercial', i: 'medium' },
        { c: 'CN', cur: 'CNY', e: 'PMI Industrial', i: 'medium' },
        { c: 'BR', cur: 'BRL', e: 'IPCA (Mensal)', i: 'high' },
        { c: 'BR', cur: 'BRL', e: 'Taxa Selic', i: 'high' },
        { c: 'BR', cur: 'BRL', e: 'IBC-Br (Prévia PIB)', i: 'medium' },
        { c: 'BR', cur: 'BRL', e: 'Balança Comercial Brasileira', i: 'medium' },
        { c: 'PT', cur: 'EUR', e: 'IPC Portugal', i: 'medium' },
        { c: 'PT', cur: 'EUR', e: 'Taxa de Desemprego (PT)', i: 'medium' },
        { c: 'DE', cur: 'EUR', e: 'Sentimento Econômico ZEW', i: 'medium' },
        { c: 'US', cur: 'USD', e: 'Estoques de Petróleo Bruto', i: 'high' },
        { c: 'US', cur: 'USD', e: 'Vendas no Varejo', i: 'high' },
        { c: 'CA', cur: 'CAD', e: 'Taxa de Desemprego', i: 'high' },
        { c: 'AU', cur: 'AUD', e: 'Decisão da Taxa de Juros (RBA)', i: 'high' }
    ];

    // Filter events based on region preference
    // Always include High Impact global events (US/EU/CN)
    // Include ALL local events for the region
    const relevantCurrencies = getRelevantCurrencies(region);
    const eventPool = allEvents.filter(e => 
        relevantCurrencies.includes(e.cur) || 
        e.i === 'high' || 
        (region === 'BR' && e.c === 'BR') ||
        (region === 'PT' && e.c === 'PT')
    );

    // Generate ~15 events for "Today" distributed around the clock
    const mockData: EconomicEvent[] = [];
    
    // 1. Past events (earlier today)
    for (let i = 0; i < 5; i++) {
        const item = eventPool[Math.floor(Math.random() * eventPool.length)];
        const time = new Date(now.getTime() - (Math.random() * 8 * 60 * 60 * 1000)); // 0-8 hours ago
        mockData.push({
            id: `past_${i}`,
            event_time: time.toISOString(),
            country: item.c,
            currency: item.cur,
            event: item.e,
            impact: item.i as 'high' | 'medium' | 'low',
            actual: (Math.random() * 5).toFixed(1) + '%',
            forecast: (Math.random() * 5).toFixed(1) + '%',
            previous: (Math.random() * 5).toFixed(1) + '%'
        });
    }

    // 2. Immediate Future (Next 2 hours) - The most important for "Dash"
    for (let i = 0; i < 4; i++) {
        const item = eventPool[Math.floor(Math.random() * eventPool.length)];
        const time = new Date(now.getTime() + (Math.random() * 120 * 60000)); // 0-120 mins
        mockData.push({
            id: `soon_${i}`,
            event_time: time.toISOString(),
            country: item.c,
            currency: item.cur,
            event: item.e,
            impact: item.i as 'high' | 'medium' | 'low',
            actual: '',
            forecast: (Math.random() * 5).toFixed(1) + '%',
            previous: (Math.random() * 5).toFixed(1) + '%'
        });
    }

    // 3. Later today
    for (let i = 0; i < 6; i++) {
        const item = eventPool[Math.floor(Math.random() * eventPool.length)];
        const time = new Date(now.getTime() + (2 + Math.random() * 10) * 3600000); // 2-12 hours later
        mockData.push({
            id: `later_${i}`,
            event_time: time.toISOString(),
            country: item.c,
            currency: item.cur,
            event: item.e,
            impact: item.i as 'high' | 'medium' | 'low',
            actual: '',
            forecast: (Math.random() * 5).toFixed(1) + '%',
            previous: (Math.random() * 5).toFixed(1) + '%'
        });
    }

    // Sort by time
    mockData.sort((a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime());
    
    setEvents(mockData);
  }

  // Formatting Helpers
  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  
  const getCountdown = (target: string) => {
    const diff = new Date(target).getTime() - currentTime.getTime();
    const absDiff = Math.abs(diff);
    
    const hours = Math.floor(absDiff / (1000 * 60 * 60));
    const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((absDiff % (1000 * 60)) / 1000);

    const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    if (diff < 0) return { text: `-${timeString}`, status: 'past' }; // Retroactive count
    return { text: timeString, status: 'future' };
  };

  const getImpactStars = (impact: 'high' | 'medium' | 'low') => {
      const count = impact === 'high' ? 3 : impact === 'medium' ? 2 : 1;
      return (
          <div className="flex gap-0.5">
              {[...Array(3)].map((_, i) => (
                  <Star 
                    key={i} 
                    className={`w-3 h-3 ${i < count ? 'fill-current text-white' : 'text-slate-800'}`} 
                    fill={i < count ? "currentColor" : "none"}
                  />
              ))}
          </div>
      );
  };

  return (
    <div className="bg-[#050505] border border-white/5 rounded-xl h-full flex flex-col">
      {/* Header - Compacto */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 bg-[#080808]">
        <div className="flex items-center gap-2">
          <Calendar className="w-3 h-3 text-amber-400" />
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Agenda Econômica</h2>
          {/* ✅ INDICADOR DE FONTE DE DADOS */}
          {dataSource && (
            <span className={`text-[8px] px-1.5 py-0.5 rounded font-mono ${
              isRealData 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
              {isRealData ? '🟢 REAL' : '🔴 MOCK'} • {dataSource}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
           <span className="text-[8px] font-mono text-slate-500">{currentTime.toLocaleTimeString('pt-BR')}</span>
        </div>
      </div>

      {/* Table Header - Compacto */}
      <div className="grid grid-cols-12 gap-2 px-3 py-1 bg-white/[0.02] border-b border-white/5 text-[8px] font-bold text-slate-500 uppercase tracking-wider">
          <div className="col-span-2">Hora</div>
          <div className="col-span-1">Imp</div>
          <div className="col-span-5">Evento</div>
          <div className="col-span-1 text-right">Atual</div>
          <div className="col-span-1 text-right">Proj</div>
          <div className="col-span-2 text-right">Contagem</div>
      </div>

      {/* List - Compacto */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-black/20 pb-1">
        {loading ? (
            <div className="p-4 flex justify-center"><RefreshCw className="w-4 h-4 animate-spin text-slate-600" /></div>
        ) : (
            events.map(ev => {
                const countdown = getCountdown(ev.event_time);
                const isUrgent = countdown.status === 'future' && parseInt(countdown.text.split(':')[1]) < 15 && parseInt(countdown.text.split(':')[0]) === 0;

                return (
                    <div key={ev.id} className={`grid grid-cols-12 gap-2 px-3 py-1.5 border-b border-white/5 items-center hover:bg-white/[0.02] transition-colors group ${isUrgent ? 'bg-amber-500/5' : ''}`}>
                        
                        {/* Time & Currency */}
                        <div className="col-span-2 flex flex-col">
                            <span className="text-[9px] font-bold text-slate-300">{formatTime(ev.event_time)}</span>
                            <span className="text-[8px] font-bold text-slate-500">{ev.currency}</span>
                        </div>

                        {/* Impact */}
                        <div className="col-span-1 flex items-center" title={`Impacto: ${ev.impact}`}>
                             {getImpactStars(ev.impact)}
                        </div>

                        {/* Event Name */}
                        <div className="col-span-5 pr-2">
                            <span className="text-[9px] font-medium text-slate-300 group-hover:text-white transition-colors leading-tight block">
                                {ev.event}
                            </span>
                        </div>

                        {/* Data Columns */}
                        <div className={`col-span-1 text-right text-[9px] font-mono font-bold ${ev.actual ? 'text-white' : 'text-slate-600'}`}>
                            {ev.actual || '---'}
                        </div>
                        <div className="col-span-1 text-right text-[9px] font-mono text-slate-500">
                            {ev.forecast || '-'}
                        </div>

                        {/* Countdown */}
                        <div className="col-span-2 text-right">
                            <span className={`text-[8px] font-mono font-bold px-1 py-0.5 rounded ${
                                countdown.status === 'past' 
                                ? 'text-slate-600' 
                                : isUrgent 
                                    ? 'bg-amber-500 text-black animate-pulse' 
                                    : 'text-emerald-400 bg-emerald-500/10'
                            }`}>
                                {countdown.text}
                            </span>
                        </div>
                    </div>
                );
            })
        )}
      </div>
      
      {/* Legend - Compacto */}
      <div className="px-3 py-1 border-t border-white/5 bg-[#080808] flex justify-between">
          <div className="flex gap-2">
             <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-slate-800 border border-slate-600"></div><span className="text-[8px] text-slate-500">Baixo</span></div>
             <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-white"></div><span className="text-[8px] text-slate-500">Alto</span></div>
          </div>
      </div>
    </div>
  );
}