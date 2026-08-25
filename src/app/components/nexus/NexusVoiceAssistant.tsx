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
import { Send, AlertTriangle, Newspaper, CalendarClock, Volume2, Ear } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useNexusVoice } from './useNexusVoice';
import { useNexusWakeWord } from './useNexusWakeWord';
import { NexusScene } from './NexusScene';
import { useVoiceCoordinator } from '@/app/contexts/VoiceCoordinatorContext';
import { useTradingContext } from '@/app/contexts/TradingContext';
import { backtestDataService } from '@/app/services/BacktestDataService';
import { generateAdvancedAnalysis, TradePosition } from '@/app/utils/advancedTradeAnalysis';
import { supabase } from '@/lib/supabaseClient';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { getRelevantCurrencies } from '@/app/services/risk/NewsCurrencyRelevance';
import { ALL_ASSETS } from '@/app/config/assetDatabase';

// Apelido comum (PT-BR, fala natural) -> símbolo real do catálogo. Só cobre
// os termos mais óbvios — qualquer símbolo exato (ex: "XAUUSD", "SOLUSD")
// já é pego direto pelo match contra ALL_ASSETS, sem precisar de apelido.
const SYMBOL_ALIASES: Record<string, string> = {
  ouro: 'XAUUSD',
  prata: 'XAGUSD',
  petroleo: 'UKOUSD',
  petróleo: 'UKOUSD',
  bitcoin: 'BTCUSD',
  ethereum: 'ETHUSD',
  solana: 'SOLUSD',
  dogecoin: 'DOGEUSD',
  nasdaq: 'NAS100',
  dow: 'US30',
  'dow jones': 'US30',
  dax: 'GER40',
  cac: 'FRA40',
  's&p': 'SPX500',
  sp500: 'SPX500',
  'ibovespa': 'BVSPX',
};

const KNOWN_SYMBOLS = Array.from(new Set(ALL_ASSETS.map((a) => a.symbol)));

// Distância de Levenshtein simples — só usada pra tolerar erro de digitação
// ou de transcrição de voz (ex: "smpx 500" por "SPX500", "biscoin" por
// "bitcoin"), nunca pra "adivinhar" um ativo qualquer sem base real.
function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

// Quantos erros tolerar em função do tamanho da palavra — string curta
// tolera menos (evita falso positivo tipo "EUR" virando qualquer coisa de 3
// letras), string longa tolera mais (erro de STT costuma ser proporcional).
function fuzzyTolerance(len: number): number {
  if (len <= 4) return 1;
  if (len <= 8) return 2;
  return 3;
}

function fuzzyFind(candidate: string, pool: string[]): string | null {
  let best: { symbol: string; dist: number } | null = null;
  for (const symbol of pool) {
    if (Math.abs(symbol.length - candidate.length) > fuzzyTolerance(symbol.length)) continue;
    const dist = levenshtein(candidate, symbol);
    if (dist <= fuzzyTolerance(symbol.length) && (!best || dist < best.dist || (dist === best.dist && symbol.length > best.symbol.length))) {
      best = { symbol, dist };
    }
  }
  return best?.symbol ?? null;
}

// Se o usuário mencionar outro ativo na pergunta (ex: "e o ouro, como tá?"),
// o NEXUS responde sobre ESSE ativo, não fica travado no que está selecionado
// no Dashboard — pedido explícito do Cleber (2026-08-25): "livre para
// perguntar sobre qualquer ativo". Tolerante a erro de digitação/STT
// (2026-08-25: "smpx 500" não batia com "SPX500" e caía sempre no ativo do
// Dashboard, parecendo "viciado" num único ativo).
function detectSymbolInQuestion(question: string): string | null {
  const upper = question.toUpperCase().replace(/[^A-Z0-9\s]/g, ' ');
  const tokens = upper.split(/\s+/).filter(Boolean);

  // 1) Match exato — token isolado ou par de tokens colados (ex: "SPX 500" -> "SPX500").
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].length >= 3 && KNOWN_SYMBOLS.includes(tokens[i])) return tokens[i];
    if (i + 1 < tokens.length) {
      const joined = tokens[i] + tokens[i + 1];
      if (joined.length >= 4 && KNOWN_SYMBOLS.includes(joined)) return joined;
    }
  }

  // 2) Apelido comum em PT-BR.
  const lower = question.toLowerCase();
  for (const [alias, symbol] of Object.entries(SYMBOL_ALIASES)) {
    if (lower.includes(alias)) return symbol;
  }

  // 3) Fuzzy — só pra candidatos com "cara" de símbolo (>=3 chars, tem letra
  // e não é uma palavra comum de português que por acaso é curta).
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].length >= 4) {
      const hit = fuzzyFind(tokens[i], KNOWN_SYMBOLS);
      if (hit) return hit;
    }
    if (i + 1 < tokens.length) {
      const joined = tokens[i] + tokens[i + 1];
      if (joined.length >= 5) {
        const hit = fuzzyFind(joined, KNOWN_SYMBOLS);
        if (hit) return hit;
      }
    }
  }

  return null;
}

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

const NEXUS_BRAIN_URL = `https://${projectId}.supabase.co/functions/v1/nexus-brain`;

export const NexusVoiceAssistant = ({ embedded = false }: { embedded?: boolean }) => {
  const { dashboardActiveSymbol } = useTradingContext();
  const { speak, stop: stopSpeaking, isSpeaking, voiceMode } = useNexusVoice();
  const { claimVoice, releaseVoice, onPreempted } = useVoiceCoordinator();

  const [isActive, setIsActive] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [textInput, setTextInput] = useState('');
  const [alerts, setAlerts] = useState<NexusAlertRow[]>([]);
  const [contextError, setContextError] = useState<string | null>(null);

  const symbolRef = useRef(dashboardActiveSymbol);
  symbolRef.current = dashboardActiveSymbol;

  // 🎙️ Mutex de voz com as outras telas que falam (IA Preditiva etc) — só
  // interrompe a fala em andamento, nunca desativa a escuta. Sem botão
  // manual (removido a pedido do Cleber, "zero interação exigida"),
  // desativar aqui deixaria o NEXUS surdo pro resto da sessão sem jeito de
  // reativar. askNexus() já reclama a voz de volta sozinho a cada resposta.
  useEffect(() => {
    return onPreempted('nexus', () => stopSpeaking());
  }, [onPreempted, stopSpeaking]);

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
  const buildContextPackage = useCallback(async (symbolOverride?: string) => {
    const symbol = symbolOverride || symbolRef.current;
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
        const mentionedSymbol = question ? detectSymbolInQuestion(question) : null;
        const contextPackage = await buildContextPackage(mentionedSymbol || undefined);
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
        claimVoice('nexus'); // reconquista a prioridade de fala, mesmo se outra tela tinha tomado
        await speak(text);
      } catch (e: any) {
        const msg = e?.message || 'Falha ao consultar o NEXUS.';
        setContextError(msg);
        toast.error(msg);
      } finally {
        setIsThinking(false);
      }
    },
    [buildContextPackage, chat, speak, claimVoice]
  );

  // Wake-word — escuta SEMPRE que a tela está aberta, zero interação
  // manual exigida. Pedido explícito do Cleber (2026-08-25): "não precisa
  // ter nenhum botão para que o usuário tenha que interagir". Qualquer
  // frase que contenha "nexus" ativa — inclusive "bom dia Nexus", "boa
  // tarde Nexus" etc, já que o regex de wake-word (useNexusWakeWord.ts)
  // casa a palavra em qualquer posição da frase. Se disser só a saudação
  // (sem pergunta junto), o NEXUS responde na hora (question=null vira
  // narração curta), não fica mudo esperando.
  const handleWakeQuestion = useCallback((question: string | null) => askNexus(question ?? undefined), [askNexus]);
  const { micState } = useNexusWakeWord({ enabled: isActive, isSpeaking, onQuestion: handleWakeQuestion });

  useEffect(() => {
    if (embedded) return;
    claimVoice('nexus');
    setIsActive(true);
    return () => releaseVoice('nexus');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded]);

  const handleSendText = () => {
    const q = textInput.trim();
    if (!q) return;
    setTextInput('');
    askNexus(q);
  };

  const unreadCritical = alerts.filter((a) => !a.read_at && a.severity !== 'info').length;
  const sceneStatus = micState === 'listening' || micState === 'awaiting-question' ? 'listening' : isSpeaking ? 'speaking' : isThinking ? 'thinking' : 'idle';
  const sceneHealth = contextError || unreadCritical > 0 ? (unreadCritical > 0 ? 'warning' : 'critical') : 'normal';

  return (
    <div className={`h-full ${embedded ? 'bg-transparent' : 'bg-[#050608]'} text-white relative overflow-hidden`}>
      <div className={`relative h-full overflow-y-auto ${embedded ? 'p-0' : 'p-6 md:p-10'}`}>
        <div className="max-w-3xl mx-auto flex flex-col min-h-full">
          {!embedded && (
            <div className="flex items-center justify-between gap-4 mb-5">
              <div className="flex items-center gap-4 min-w-0">
                {/* Orbe 3D — janela compacta e arredondada, nunca atrás do texto */}
                <div className="relative w-48 h-48 md:w-56 md:h-56 shrink-0 rounded-full overflow-hidden border border-white/10 bg-black shadow-lg shadow-cyan-500/10">
                  <NexusScene status={sceneStatus} health={sceneHealth} />
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl md:text-3xl font-bold tracking-[0.15em] text-white uppercase flex items-center gap-3">
                    NEXUS
                    {unreadCritical > 0 && (
                      <span className="text-xs font-bold px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 tracking-normal">
                        {unreadCritical} alerta{unreadCritical > 1 ? 's' : ''}
                      </span>
                    )}
                  </h1>
                  <p className="text-slate-400 mt-1 text-sm tracking-wide font-light flex items-center gap-2 flex-wrap">
                    Parceiro de day trade — pergunte sobre qualquer ativo, dado real, sem previsão de direção
                  </p>
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    {voiceMode && (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-cyan-500/70 border border-cyan-500/20 rounded px-1.5 py-0.5">
                        <Volume2 className="w-3 h-3" />
                        {voiceMode === 'neural' ? 'voz neural' : 'voz do navegador'}
                      </span>
                    )}
                    {isActive && micState !== 'unsupported' && (
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 border ${
                          micState === 'awaiting-question'
                            ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                            : 'text-cyan-400 border-cyan-500/20'
                        }`}
                      >
                        <Ear className="w-3 h-3" />
                        {micState === 'awaiting-question' ? 'ouvindo a pergunta...' : 'diga "nexus" pra falar'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {contextError && (
            <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm flex items-center gap-2 backdrop-blur-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {contextError}
            </div>
          )}

          {/* Alertas proativos recentes (gravados pelo servidor, mesmo com a tela fechada) */}
          {alerts.length > 0 && (
            <div className="mb-4 space-y-2">
              {alerts.slice(0, 3).map((a) => (
                <div
                  key={a.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border text-sm backdrop-blur-sm ${
                    a.severity === 'critical'
                      ? 'bg-red-500/10 border-red-500/30 text-red-300'
                      : a.severity === 'warning'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                      : 'bg-neutral-800/40 border-neutral-700/60 text-neutral-300'
                  }`}
                >
                  {a.kind === 'news' ? <Newspaper className="w-4 h-4 mt-0.5 shrink-0" /> : <CalendarClock className="w-4 h-4 mt-0.5 shrink-0" />}
                  <span>{a.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* Chat — fundo sólido próprio, nunca disputa espaço com a arte da orbe */}
          <div className="flex-1 flex flex-col justify-end min-h-[240px] mb-4 bg-neutral-950/80 border border-white/5 rounded-2xl p-4">
            {chat.length === 0 && !isThinking && (
              <div className="text-center py-10">
                <p className="text-neutral-400 text-sm max-w-md mx-auto leading-relaxed">
                  Pergunte qualquer coisa sobre qualquer ativo — preço, indicador, notícia, risco de calendário ou sua
                  posição aberta. Sempre dado real, nunca invento número.
                </p>
              </div>
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
                    className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-lg ${
                      m.role === 'user'
                        ? 'bg-cyan-600/25 border border-cyan-500/40 text-cyan-50 rounded-br-sm'
                        : 'bg-neutral-900 border border-white/10 text-neutral-100 rounded-bl-sm'
                    }`}
                  >
                    {m.text}
                  </div>
                </motion.div>
              ))}
              <AnimatePresence>
                {isThinking && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-neutral-400 text-sm">
                    <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                    <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse [animation-delay:300ms]" />
                    <span className="ml-1">NEXUS está consultando o dado real...</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Input — sempre disponível, conversa não exige "ativar" antes */}
          <div className="sticky bottom-0 pb-2 pt-2">
            <div
              className={`flex items-center gap-2 bg-neutral-900/70 backdrop-blur-xl border rounded-2xl p-2 shadow-2xl shadow-black/40 transition-colors ${
                micState === 'awaiting-question' ? 'border-amber-500/60' : micState === 'listening' ? 'border-cyan-500/30' : 'border-white/10'
              }`}
            >
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                placeholder={isActive ? `Diga "Nexus" ou digite sua pergunta...` : `Converse com o NEXUS sobre ${dashboardActiveSymbol}...`}
                className="flex-1 bg-transparent px-2 py-2 text-white text-sm placeholder:text-neutral-500 focus:outline-none"
              />
              <button
                onClick={handleSendText}
                disabled={!textInput.trim() || isThinking}
                className="p-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
