import React, { useState, useEffect } from 'react';
import { Calendar, RefreshCw, Star } from 'lucide-react';
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

// Tradução de nomes de eventos (Inglês → Português) — o backend já traduz o
// nome do país (translate-events.ts), mas o nome do EVENTO em si vem cru da
// fonte (MQL5/Yahoo/Investing.com), sempre em inglês.
const EVENT_TRANSLATIONS: [string, string][] = [
  ['Non-Farm Payrolls', 'Folha de Pagamento Não-Agrícola (NFP)'],
  ['Nonfarm Payrolls', 'Folha de Pagamento Não-Agrícola (NFP)'],
  ['NFP', 'Folha de Pagamento Não-Agrícola (NFP)'],
  ['Initial Jobless Claims', 'Pedidos Iniciais de Seguro-Desemprego'],
  ['Continuing Jobless Claims', 'Pedidos Contínuos de Seguro-Desemprego'],
  ['Unemployment Rate', 'Taxa de Desemprego'],
  ['Federal Funds Rate', 'Taxa de Juros do Fed'],
  ['Interest Rate Decision', 'Decisão da Taxa de Juros'],
  ['FOMC Meeting', 'Reunião do FOMC (Fed)'],
  ['FOMC Statement', 'Declaração do FOMC'],
  ['FOMC Press Conference', 'Coletiva de Imprensa do FOMC'],
  ['Fed Chair Powell Speech', 'Discurso do Presidente do Fed (Powell)'],
  ['Beige Book', 'Livro Bege (Fed)'],
  ['Gross Domestic Product', 'Produto Interno Bruto (PIB)'],
  ['GDP', 'PIB'],
  ['Consumer Price Index', 'Índice de Preços ao Consumidor (IPC)'],
  ['Core CPI', 'IPC Núcleo'],
  ['CPI', 'IPC (Índice de Preços ao Consumidor)'],
  ['Producer Price Index', 'Índice de Preços ao Produtor (IPP)'],
  ['PPI', 'IPP (Índice de Preços ao Produtor)'],
  ['Retail Sales', 'Vendas no Varejo'],
  ['Trade Balance', 'Balança Comercial'],
  ['Manufacturing PMI', 'PMI Industrial'],
  ['Services PMI', 'PMI de Serviços'],
  ['PMI', 'PMI (Índice de Gerentes de Compras)'],
  ['Personal Income', 'Renda Pessoal'],
  ['Personal Spending', 'Gastos Pessoais'],
  ['Consumer Spending', 'Gastos do Consumidor'],
  ['Core PCE Price Index', 'Índice de Preços PCE Núcleo'],
  ['Core PCE', 'PCE Núcleo'],
  ['PCE Price Index', 'Índice de Preços PCE'],
  ['PCE', 'PCE (Índice de Gastos de Consumo Pessoal)'],
  ['Crude Oil Inventories', 'Estoques de Petróleo Bruto'],
  ['Natural Gas Storage', 'Estoques de Gás Natural'],
  ['Building Permits', 'Licenças de Construção'],
  ['Housing Starts', 'Início de Construções'],
  ['Industrial Production', 'Produção Industrial'],
  ['Capacity Utilization', 'Utilização da Capacidade'],
  ['Durable Goods Orders', 'Pedidos de Bens Duráveis'],
  ['Factory Orders', 'Pedidos Industriais'],
  ['ISM Manufacturing', 'ISM Industrial'],
  ['ISM Services', 'ISM de Serviços'],
  ['Consumer Confidence', 'Confiança do Consumidor'],
  ['Michigan Consumer Sentiment', 'Sentimento do Consumidor (Michigan)'],
  ['CB Consumer Confidence', 'Confiança do Consumidor (CB)'],
  ['ADP Employment', 'Emprego ADP'],
  ['Average Hourly Earnings', 'Rendimento Médio por Hora'],
  ['Existing Home Sales', 'Vendas de Casas Usadas'],
  ['New Home Sales', 'Vendas de Casas Novas'],
  ['Pending Home Sales', 'Vendas de Casas Pendentes'],
  ['MBA Mortgage Applications', 'Pedidos de Hipotecas MBA'],
  ['JOLTs Job Openings', 'Vagas de Emprego (JOLTs)'],
  ['Challenger Job Cuts', 'Cortes de Emprego (Challenger)'],
  ['Empire State Manufacturing', 'Índice Industrial Empire State'],
  ['NFIB Small Business', 'Otimismo de Pequenas Empresas (NFIB)'],
  ['Case Shiller', 'Índice de Preços de Imóveis Case-Shiller'],
];

function translateEventName(name: string): string {
  for (const [en, pt] of EVENT_TRANSLATIONS) {
    if (name.toLowerCase() === en.toLowerCase()) return pt;
  }
  let translated = name;
  const sorted = [...EVENT_TRANSLATIONS].sort((a, b) => b[0].length - a[0].length);
  for (const [en, pt] of sorted) {
    const regex = new RegExp(`\\b${en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    translated = translated.replace(regex, pt);
  }
  return translated;
}

const API_URL = `https://${projectId}.supabase.co/functions/v1/server/economic-calendar`;

// Detecta o idioma do usuário (navigator.language, ex: "pt-BR" → "pt") pra
// pedir a tradução do NOME do evento no idioma certo — mesmo padrão já
// usado em NewsFeed.tsx. O backend agora traduz de verdade (Google
// Translate), não só o dicionário estático local abaixo (que cobre só
// termos comuns, como resposta instantânea antes do backend responder).
function detectUserLang(): string {
  const lang = (navigator.language || 'pt-BR').split('-')[0].toLowerCase();
  return lang || 'pt';
}

export function EconomicCalendar() {
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dataSource, setDataSource] = useState<string>('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [agendaDate, setAgendaDate] = useState<string | null>(null);
  const [isToday, setIsToday] = useState(true);
  const userLang = React.useRef(detectUserLang()).current;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadEvents();

    // Auto-atualização a cada 3 minutos durante o dia (pega Actual/Forecast
    // conforme os eventos vão saindo).
    const refreshInterval = setInterval(loadEvents, 180000);

    // Auto-atualização diária às 00:01 (recarrega a agenda do dia seguinte).
    const scheduleMidnightRefresh = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 1, 0, 0);

      const msUntilMidnight = tomorrow.getTime() - now.getTime();
      const midnightTimeout = setTimeout(() => {
        loadEvents();
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
      const response = await fetch(`${API_URL}?country=US&lang=${userLang}&t=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();

      const rawEvents: any[] = Array.isArray(data.events) ? data.events : [];
      const mapped: EconomicEvent[] = rawEvents.map((ev, idx) => ({
        id: `${ev.time}-${idx}`,
        event_time: ev.time,
        country: ev.country || 'Estados Unidos',
        currency: ev.currency || 'USD',
        event: translateEventName(ev.event || 'Evento Econômico'),
        impact: (ev.impact as 'high' | 'medium' | 'low') || 'low',
        actual: ev.actual || '',
        forecast: ev.forecast || '',
        previous: ev.previous || '',
      })).sort((a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime());

      setEvents(mapped);
      setDataSource(data.source || '');
      setAgendaDate(data.date || null);
      setIsToday(data.isToday !== false); // ausente (fontes antigas) = trata como hoje
      setLoadError(mapped.length === 0 ? 'Nenhuma fonte real respondeu no momento' : null);
      setLoading(false);
    } catch (error: any) {
      console.error('[EconomicCalendar] Erro ao carregar eventos reais:', error);
      setLoadError(error.message || 'Falha ao carregar a agenda econômica');
      setLoading(false);
      // Sem fallback fabricado — mantém a última leitura real na tela em
      // vez de gerar números aleatórios de Actual/Forecast/Previous.
    }
  }

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const formatAgendaDateLabel = (dateStr: string) => {
    // ✅ evita bug de fuso: parseia YYYY-MM-DD como data local, não UTC
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long' });
    const shortDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return `${weekday} (${shortDate})`;
  };

  const getCountdown = (target: string) => {
    const diff = new Date(target).getTime() - currentTime.getTime();
    const absDiff = Math.abs(diff);

    const hours = Math.floor(absDiff / (1000 * 60 * 60));
    const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((absDiff % (1000 * 60)) / 1000);

    const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    if (diff < 0) return { text: `-${timeString}`, status: 'past' };
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
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 bg-[#080808]">
        <div className="flex items-center gap-2">
          <Calendar className="w-3 h-3 text-amber-400" />
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Agenda Econômica — EUA</h2>
          {dataSource && !loadError && (
            <span className="text-[8px] px-1.5 py-0.5 rounded font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              🟢 REAL • {dataSource}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-mono text-slate-500">{currentTime.toLocaleTimeString('pt-BR')}</span>
        </div>
      </div>

      {/* Aviso quando a agenda exibida não é a de hoje (ex: domingo sem
          divulgação econômica — mostra o último dia útil real, sexta-feira) */}
      {!loading && !isToday && agendaDate && events.length > 0 && (
        <div className="px-3 py-1 bg-amber-500/10 border-b border-amber-500/20 text-[9px] text-amber-400 flex items-center gap-1.5">
          <Calendar className="w-3 h-3 shrink-0" />
          <span>Hoje não há divulgação econômica americana — mostrando {formatAgendaDateLabel(agendaDate)}, o último dia com eventos reais.</span>
        </div>
      )}

      {/* Table Header */}
      <div className="grid grid-cols-12 gap-2 px-3 py-1 bg-white/[0.02] border-b border-white/5 text-[8px] font-bold text-slate-500 uppercase tracking-wider">
        <div className="col-span-2">Hora</div>
        <div className="col-span-1">Imp</div>
        <div className="col-span-5">Evento</div>
        <div className="col-span-1 text-right">Atual</div>
        <div className="col-span-1 text-right">Proj</div>
        <div className="col-span-2 text-right">Contagem</div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-black/20 pb-1">
        {loading ? (
          <div className="p-4 flex justify-center"><RefreshCw className="w-4 h-4 animate-spin text-slate-600" /></div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-slate-600 px-4 text-center gap-2">
            <Calendar className="w-6 h-6 opacity-40" />
            <p className="text-[10px]">
              {loadError ? 'Nenhuma fonte real respondeu no momento — tentando novamente automaticamente.' : 'Nenhum evento agendado hoje.'}
            </p>
          </div>
        ) : (
          events.map(ev => {
            const countdown = getCountdown(ev.event_time);
            const isUrgent = countdown.status === 'future' && parseInt(countdown.text.split(':')[1]) < 15 && parseInt(countdown.text.split(':')[0]) === 0;

            return (
              <div key={ev.id} className={`grid grid-cols-12 gap-2 px-3 py-1.5 border-b border-white/5 items-center hover:bg-white/[0.02] transition-colors group ${isUrgent ? 'bg-amber-500/5' : ''}`}>

                <div className="col-span-2 flex flex-col">
                  <span className="text-[9px] font-bold text-slate-300">{formatTime(ev.event_time)}</span>
                  <span className="text-[8px] font-bold text-slate-500">{ev.currency}</span>
                </div>

                <div className="col-span-1 flex items-center" title={`Impacto: ${ev.impact}`}>
                  {getImpactStars(ev.impact)}
                </div>

                <div className="col-span-5 pr-2">
                  <span className="text-[9px] font-medium text-slate-300 group-hover:text-white transition-colors leading-tight block">
                    {ev.event}
                  </span>
                </div>

                <div className={`col-span-1 text-right text-[9px] font-mono font-bold ${ev.actual ? 'text-white' : 'text-slate-600'}`}>
                  {ev.actual || '---'}
                </div>
                <div className="col-span-1 text-right text-[9px] font-mono text-slate-500">
                  {ev.forecast || '-'}
                </div>

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

      {/* Legend */}
      <div className="px-3 py-1 border-t border-white/5 bg-[#080808] flex justify-between">
        <div className="flex gap-2">
          <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-slate-800 border border-slate-600"></div><span className="text-[8px] text-slate-500">Baixo</span></div>
          <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-white"></div><span className="text-[8px] text-slate-500">Alto</span></div>
        </div>
      </div>
    </div>
  );
}
