/**
 * 🛰️ NEXUS — PARCEIRO DE DAY TRADE (LLM real + voz + alerta proativo)
 *
 * Substitui o AITraderVoice.tsx antigo (travado em 'BTC' hardcoded, sem LLM,
 * só template/Math.random pra variar frase). NEXUS:
 *  - Segue o ativo REAL que o usuário está olhando agora
 *    (TradingContext.dashboardActiveSymbol).
 *  - Monta um pacote de contexto 100% real (preço/indicadores/posição aberta
 *    real/agenda econômica/notícia) e manda pra edge function `nexus-brain`,
 *    que chama a API da Anthropic — nunca gera texto localmente.
 *  - Fala a resposta (TTS nativo) e aceita pergunta por voz (STT nativo) ou
 *    texto.
 *  - Mostra os alertas proativos já gravados em `nexus_alerts` pelo tick do
 *    servidor (ai-runner), mesmo que tenham sido gerados com a tela fechada.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Send, AlertTriangle, Newspaper, CalendarClock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useSpeechAlert } from '@/app/hooks/useSpeechAlert';
import { useVoiceCoordinator } from '@/app/contexts/VoiceCoordinatorContext';
import { useTradingContext } from '@/app/contexts/TradingContext';
import { backtestDataService } from '@/app/services/BacktestDataService';
import { generateAdvancedAnalysis, TradePosition } from '@/app/utils/advancedTradeAnalysis';
import { supabase } from '@/lib/supabaseClient';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { getRelevantCurrencies } from '@/app/services/risk/NewsCurrencyRelevance';
import { JarvisOrb } from '@/app/components/jarvis/JarvisOrb';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

interface NexusAlertRow {
  id: string;
  symbol: string;
  severity: 'info' | 'warning' | 'critical';
  kind: string;
  message: string;
  created_at: string;
  read_at: string | null;
}

interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

const NEXUS_BRAIN_URL = `https://${projectId}.supabase.co/functions/v1/nexus-brain`;

export const NexusVoiceAssistant = ({ embedded = false }: { embedded?: boolean }) => {
  const { dashboardActiveSymbol } = useTradingContext();
  const { speak } = useSpeechAlert({ rate: 0.95, volume: 1.0 });
  const { claimVoice, releaseVoice, onPreempted } = useVoiceCoordinator();

  const [isActive, setIsActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [textInput, setTextInput] = useState('');
  const [alerts, setAlerts] = useState<NexusAlertRow[]>([]);
  const [contextError, setContextError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const symbolRef = useRef(dashboardActiveSymbol);
  symbolRef.current = dashboardActiveSymbol;

  // 🎙️ Mutex de voz com as outras telas que falam (IA Preditiva etc).
  useEffect(() => {
    return onPreempted('nexus', () => setIsActive(false));
  }, [onPreempted]);

  // Carrega os alertas proativos já persistidos pelo servidor pra este ativo.
  const loadAlerts = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;
    const { data, error } = await supabase
      .from('nexus_alerts')
      .select('id, symbol, severity, kind, message, created_at, read_at')
      .eq('user_id', userData.user.id)
      .eq('symbol', symbolRef.current)
      .order('created_at', { ascending: false })
      .limit(10);
    if (!error && data) setAlerts(data as NexusAlertRow[]);
  }, []);

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 60_000);
    return () => clearInterval(interval);
  }, [loadAlerts, dashboardActiveSymbol]);

  // Monta o pacote de contexto 100% real — única fonte de verdade que o
  // nexus-brain pode usar pra falar sobre o ativo atual.
  const buildContextPackage = useCallback(async () => {
    const symbol = symbolRef.current;
    const end = Date.now();
    const lookbackBars = 200;
    const start = end - lookbackBars * 15 * 60_000; // janela de 15m

    const candleRes = await backtestDataService.fetchHistoricalData(symbol, new Date(start), new Date(end), '15m');
    if (candleRes.candles.length < 30) {
      throw new Error('Candle real insuficiente para calcular indicadores agora.');
    }
    const lastCandle = candleRes.candles[candleRes.candles.length - 1];

    // Posição real aberta pro usuário/ativo (se existir) — nunca fabricada.
    const { data: userData } = await supabase.auth.getUser();
    let openPosition: any = null;
    if (userData?.user) {
      const { data: trade } = await supabase
        .from('ai_trades')
        .select('side, entry_price, entry_time, stop_loss, take_profit, quantity')
        .eq('user_id', userData.user.id)
        .eq('symbol', symbol)
        .eq('status', 'OPEN')
        .order('entry_time', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (trade) openPosition = trade;
    }

    // Indicadores técnicos reais — reaproveita o motor já existente.
    const position: TradePosition = {
      type: openPosition?.side === 'SHORT' ? 'sell' : 'buy',
      entryPrice: openPosition?.entry_price ?? lastCandle.close,
      currentPrice: lastCandle.close,
      symbol,
      timeframe: '15m',
    };
    const analysis = generateAdvancedAnalysis(position, candleRes.candles);

    // Agenda econômica real (mesma fonte do gate de notícia do motor).
    const relevantCurrencies = getRelevantCurrencies(symbol);
    let calendarEvents: any[] = [];
    try {
      const calRes = await fetch(`https://${projectId}.supabase.co/functions/v1/server/economic-calendar`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      if (calRes.ok) {
        const calData = await calRes.json();
        const events = Array.isArray(calData?.events) ? calData.events : Array.isArray(calData) ? calData : [];
        calendarEvents = events
          .filter((e: any) => relevantCurrencies.includes((e.currency || '').toUpperCase()))
          .slice(0, 5);
      }
    } catch {
      // Sem calendário real disponível agora — segue sem essa fatia do contexto, nunca fabrica.
    }

    // Notícia real recente (RSS agregado já existente no servidor).
    let newsHeadlines: any[] = [];
    try {
      const newsRes = await fetch(`https://${projectId}.supabase.co/functions/v1/server/news/aggregate`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      if (newsRes.ok) {
        const newsData = await newsRes.json();
        const items = Array.isArray(newsData?.items) ? newsData.items : [];
        newsHeadlines = items.slice(0, 8).map((n: any) => ({ title: n.title, source: n.source, categoria: n.category, quando: n.timestamp ? new Date(n.timestamp).toISOString() : null }));
      }
    } catch {
      // Sem notícia real disponível agora — segue sem essa fatia do contexto.
    }

    return {
      symbol,
      priceReal: lastCandle.close,
      timeframe: '15m',
      indicadoresTecnicos: {
        rsi: analysis.rsi,
        macd: analysis.macd,
        volatilidade: analysis.volatility,
        suporteResistencia: analysis.priceAction,
        risco: analysis.risk,
      },
      posicaoAbertaReal: openPosition
        ? {
            lado: openPosition.side,
            precoEntrada: openPosition.entry_price,
            stopLoss: openPosition.stop_loss,
            takeProfit: openPosition.take_profit,
            quantidade: openPosition.quantity,
            entrouEm: openPosition.entry_time,
          }
        : null,
      agendaEconomicaRelevante: calendarEvents,
      noticiaRecente: newsHeadlines,
      alertasProativosRecentes: alerts.slice(0, 5).map((a) => ({ severidade: a.severity, tipo: a.kind, mensagem: a.message, quando: a.created_at })),
    };
  }, [alerts]);

  const askNexus = useCallback(
    async (question?: string) => {
      setIsThinking(true);
      setContextError(null);
      try {
        const contextPackage = await buildContextPackage();
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) throw new Error('Sessão inválida — faça login novamente.');

        const res = await fetch(NEXUS_BRAIN_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            question,
            contextPackage,
            history: chat.slice(-6).map((m) => ({ role: m.role, content: m.text })),
          }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody?.error || `nexus-brain retornou ${res.status}`);
        }
        const { text } = await res.json();

        if (question) setChat((prev) => [...prev, { role: 'user', text: question }]);
        setChat((prev) => [...prev, { role: 'assistant', text }]);
        setIsSpeaking(true);
        await speak(text, 'high');
        setIsSpeaking(false);
      } catch (e: any) {
        const msg = e?.message || 'Falha ao consultar o NEXUS.';
        setContextError(msg);
        toast.error(msg);
      } finally {
        setIsThinking(false);
      }
    },
    [buildContextPackage, chat, speak]
  );

  const handleToggleActive = () => {
    if (!isActive) {
      claimVoice('nexus');
      setIsActive(true);
      askNexus(); // narração proativa inicial, sem pergunta
    } else {
      window.speechSynthesis?.cancel();
      releaseVoice('nexus');
      setIsActive(false);
    }
  };

  const handleSendText = () => {
    const q = textInput.trim();
    if (!q) return;
    setTextInput('');
    askNexus(q);
  };

  const handleToggleListening = () => {
    const { webkitSpeechRecognition, SpeechRecognition } = window as unknown as IWindow;
    const Recognition = SpeechRecognition || webkitSpeechRecognition;
    if (!Recognition) {
      toast.error('Reconhecimento de voz não suportado neste navegador.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'pt-BR';
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => {
      setIsListening(false);
      toast.error('Não entendi — tenta de novo.');
    };
    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      askNexus(text);
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const unreadCritical = alerts.filter((a) => !a.read_at && a.severity !== 'info').length;
  const orbStatus = isListening ? 'listening' : isSpeaking ? 'speaking' : isThinking ? 'thinking' : 'idle';
  const orbHealth = contextError || unreadCritical > 0 ? (unreadCritical > 0 ? 'warning' : 'critical') : 'normal';

  return (
    <div className={`${embedded ? 'p-0' : 'p-8'} h-full ${embedded ? 'bg-transparent' : 'bg-neutral-950'} text-white overflow-y-auto relative`}>
      <div className="relative">
        {!embedded && (
          <div className="flex items-start gap-4 mb-6 pb-6 border-b border-white/5">
            <div className="w-20 h-20 -m-2 shrink-0">
              <JarvisOrb status={orbStatus} health={orbHealth} />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold tracking-tight text-white uppercase flex items-center gap-3">
                NEXUS
                {unreadCritical > 0 && (
                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40">
                    {unreadCritical} alerta{unreadCritical > 1 ? 's' : ''}
                  </span>
                )}
              </h1>
              <p className="text-slate-400 mt-1 tracking-wide font-light">
                Parceiro de day trade — {dashboardActiveSymbol}, dado real, sem previsão de direção
              </p>
            </div>
            <button
              onClick={handleToggleActive}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all ${
                isActive
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/30'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
              }`}
            >
              {isActive ? <><MicOff className="w-5 h-5" />Pausar</> : <><Mic className="w-5 h-5" />Ativar NEXUS</>}
            </button>
          </div>
        )}

        {contextError && (
          <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {contextError}
          </div>
        )}

        {/* Alertas proativos recentes (gravados pelo servidor, mesmo com a tela fechada) */}
        {alerts.length > 0 && (
          <div className="mb-6 space-y-2">
            {alerts.slice(0, 3).map((a) => (
              <div
                key={a.id}
                className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${
                  a.severity === 'critical'
                    ? 'bg-red-500/10 border-red-500/30 text-red-300'
                    : a.severity === 'warning'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-neutral-800/50 border-neutral-700 text-neutral-300'
                }`}
              >
                {a.kind === 'news' ? <Newspaper className="w-4 h-4 mt-0.5 shrink-0" /> : <CalendarClock className="w-4 h-4 mt-0.5 shrink-0" />}
                <span>{a.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Chat */}
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 mb-4 min-h-[280px] max-h-[440px] overflow-y-auto">
          {chat.length === 0 && !isThinking && (
            <p className="text-neutral-500 text-sm">
              Ative o NEXUS ou pergunte algo sobre {dashboardActiveSymbol} — ele responde só com dado real (preço, indicador, posição aberta, agenda econômica e notícia), nunca inventa número.
            </p>
          )}
          <div className="space-y-3">
            {chat.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2.5 rounded-xl text-sm leading-relaxed ${
                    m.role === 'user' ? 'bg-cyan-600/20 border border-cyan-500/30 text-cyan-50' : 'bg-neutral-800 border border-neutral-700 text-neutral-200'
                  }`}
                >
                  {m.text}
                </div>
              </motion.div>
            ))}
            <AnimatePresence>
              {isThinking && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-neutral-500 text-sm flex items-center gap-2">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                  NEXUS está consultando o dado real...
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Input */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleListening}
            className={`p-3 rounded-lg border transition-all ${
              isListening ? 'bg-red-600/20 border-red-500 text-red-400 animate-pulse' : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-cyan-400'
            }`}
            title="Falar com o NEXUS"
          >
            <Mic className="w-5 h-5" />
          </button>
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
            placeholder={`Pergunte sobre ${dashboardActiveSymbol}...`}
            className="flex-1 px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          />
          <button
            onClick={handleSendText}
            disabled={!textInput.trim() || isThinking}
            className="p-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
