import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Shield, Activity, Newspaper, Waves, Gauge, Settings } from 'lucide-react';
import { motion } from 'motion/react';
import { useTradingContext } from '../../contexts/TradingContext';
import type { MarketScoreResult } from '@/app/services/MarketScoreEngine';
import { getLastKnownRealPrice } from '@/app/services/RealMarketDataService';
import { getAssetBySymbol } from '@/app/config/assetDatabase';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { LunaInteractionSettings } from '../nexus/LunaInteractionSettings';

interface EconomicEvent {
  event_time: string; // ISO
  currency: string;
  impact: 'high' | 'medium' | 'low';
  event: string;
}

// Índices sem par de moeda explícito no símbolo — moeda que move o instrumento.
const INDEX_CURRENCY: Record<string, string> = {
  US30: 'USD', SPX500: 'USD', NAS100: 'USD', US2000: 'USD',
  GER40: 'EUR', FRA40: 'EUR', ESP35: 'EUR', EUSTX50: 'EUR',
  UK100: 'GBP', JP225: 'JPY', AUS200: 'AUD',
  HK50: 'HKD', HKG33: 'HKD', CHINA50: 'CNY',
};

/** Moedas cujo calendário econômico importa pra decidir se é arriscado operar
 *  esse ativo agora. Cripto fica de fora de propósito — não existe hoje uma
 *  fonte de calendário confiável ligada a cripto no projeto (mesmo padrão já
 *  usado pro order book: só real quando existe, nunca aproximado). */
function getRelevantCurrencies(symbol: string): string[] {
  const asset = getAssetBySymbol(symbol);
  const category = asset?.category;
  if (category === 'CRYPTO') return [];
  if (INDEX_CURRENCY[symbol]) return [INDEX_CURRENCY[symbol]];
  if (category === 'FOREX' && symbol.length === 6) {
    return [symbol.slice(0, 3).toUpperCase(), symbol.slice(3, 6).toUpperCase()];
  }
  // Metais/energia/ações: aproximação deliberada — a maioria do catálogo é
  // cotada/dirigida por dado macro americano (USD). Não é exato pra cada ação
  // europeia individual, mas é o sinal real disponível hoje, não um "chute".
  return ['USD'];
}

let calendarCache: { fetchedAt: number; events: EconomicEvent[] } | null = null;
const CALENDAR_CACHE_MS = 5 * 60 * 1000;

async function fetchCalendarCached(): Promise<EconomicEvent[]> {
  if (calendarCache && Date.now() - calendarCache.fetchedAt < CALENDAR_CACHE_MS) {
    return calendarCache.events;
  }
  const res = await fetch(`https://${projectId}.supabase.co/functions/v1/server/economic-calendar`, {
    headers: { Authorization: `Bearer ${publicAnonKey}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const events: EconomicEvent[] = (Array.isArray(data.events) ? data.events : []).map((ev: any) => ({
    event_time: ev.time,
    currency: (ev.currency || '').toUpperCase(),
    impact: ev.impact || 'low',
    event: ev.event || 'Evento Econômico',
  }));
  calendarCache = { fetchedAt: Date.now(), events };
  return events;
}

type NewsTier = 'none' | 'medium' | 'high';
interface NewsRisk { tier: NewsTier; event?: EconomicEvent; minutesAway?: number }

function computeNewsRisk(events: EconomicEvent[], currencies: string[]): NewsRisk {
  if (currencies.length === 0) return { tier: 'none' };
  const now = Date.now();
  let best: { event: EconomicEvent; diffMin: number } | null = null;
  for (const ev of events) {
    if (ev.impact !== 'high') continue;
    if (!currencies.includes(ev.currency)) continue;
    const t = new Date(ev.event_time).getTime();
    if (!Number.isFinite(t)) continue;
    const diffMin = (t - now) / 60000;
    if (diffMin < -30 || diffMin > 240) continue; // fora da janela relevante (efeito passado ou longe demais)
    if (!best || Math.abs(diffMin) < Math.abs(best.diffMin)) best = { event: ev, diffMin };
  }
  if (!best) return { tier: 'none' };
  const absMin = Math.abs(best.diffMin);
  return { tier: absMin <= 60 ? 'high' : 'medium', event: best.event, minutesAway: best.diffMin };
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export function RiskThermometer() {
  // Botão de config da Luna migrado pra cá em 2026-07-20, quando o box do
  // "Nexus Quantum Advisor" (que ficava logo acima, à direita) foi eliminado
  // a pedido do Cleber — o Termômetro de Risco é o box abaixo, mesma posição
  // vertical (coluna direita do Dashboard).
  const [showLunaSettings, setShowLunaSettings] = useState(false);

  // scoreResult vem PRONTO do MarketScoreBoard (mesmo motor, mesmo cálculo já
  // exibido no Dashboard) — nunca recalculado aqui. Uma 2ª chamada ao
  // MarketScoreEngine pro mesmo ativo dobraria a carga na conta MetaAPI
  // compartilhada (rate-limit documentado no projeto) e podia falhar mesmo com
  // o Dashboard funcionando normalmente — era a causa real do "sem dados".
  const { dashboardActiveSymbol, dashboardScoreResult } = useTradingContext();
  const symbol = dashboardActiveSymbol || 'BTCUSD';
  const scoreResult = dashboardScoreResult as MarketScoreResult | null;

  const [newsRisk, setNewsRisk] = useState<NewsRisk>({ tier: 'none' });
  const [newsError, setNewsError] = useState(false);

  // Calendário econômico real (cacheado 5min) — filtrado pela(s) moeda(s) do ativo.
  useEffect(() => {
    let cancelled = false;
    const currencies = getRelevantCurrencies(symbol);
    if (currencies.length === 0) {
      setNewsRisk({ tier: 'none' });
      setNewsError(false);
      return;
    }
    const load = async () => {
      try {
        const events = await fetchCalendarCached();
        if (!cancelled) {
          setNewsRisk(computeNewsRisk(events, currencies));
          setNewsError(false);
        }
      } catch {
        if (!cancelled) setNewsError(true);
      }
    };
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [symbol]);

  const hasRealScore = !!scoreResult && (scoreResult.provenance === 'real' || scoreResult.provenance === 'stale') && scoreResult.symbol === symbol;
  const isLoading = !scoreResult || scoreResult.symbol !== symbol;

  // Cripto roteada pela corretora (BTC, SOL, BNB, XRP, ADA, DOT — ver
  // brokerRegistry.ts) fica em cache sob o símbolo UNIFICADO sem "T" (ex:
  // BTCUSD), mas o Dashboard seleciona no formato nativo da Binance (BTCUSDT)
  // — getLastKnownRealPrice(symbol) nunca batia com a chave certa, ficava
  // sempre "—". Tenta o símbolo cru primeiro, cai pro formato USD como fallback.
  const price = getLastKnownRealPrice(symbol)?.price
    ?? getLastKnownRealPrice(symbol.replace(/USDT$/, 'USD'))?.price
    ?? 0;
  const atr = hasRealScore ? scoreResult!.indicators.atr : null;
  const atrPercent = atr != null && price > 0 ? (atr / price) * 100 : null;

  const regime = scoreResult?.symbol === symbol ? scoreResult!.regime : 'INDEFINIDO';
  const confidence = hasRealScore ? scoreResult!.confidence : null;

  // Cada fator vira um score 0-100 independente; o risco geral é o PIOR deles
  // (gate, não média) — um único fator crítico já é motivo real de cautela,
  // mesmo que os outros três estejam tranquilos.
  const volatilityScore = atrPercent != null ? clamp((atrPercent / 3) * 100, 0, 100) : 0;
  const regimeScore = regime === 'LATERAL' ? 55 : regime === 'INDEFINIDO' ? 20 : 0;
  const confidenceScore = confidence != null ? clamp((100 - confidence) * 0.5, 0, 100) : 0;
  const newsScore = newsRisk.tier === 'high' ? 85 : newsRisk.tier === 'medium' ? 45 : 0;

  const riskScore = isLoading ? 0 : Math.max(volatilityScore, regimeScore, confidenceScore, newsScore);

  let riskLevel = isLoading ? 'Calculando…' : 'Seguro';
  let riskColor = 'text-slate-400';
  if (!isLoading) {
    riskColor = 'text-emerald-400';
    if (riskScore > 30) { riskLevel = 'Moderado'; riskColor = 'text-yellow-400'; }
    if (riskScore > 60) { riskLevel = 'Alto'; riskColor = 'text-orange-400'; }
    if (riskScore > 90) { riskLevel = 'Crítico'; riskColor = 'text-red-500'; }
  }

  const newsLabel = useMemo(() => {
    if (getRelevantCurrencies(symbol).length === 0) return 'N/D (cripto)';
    if (newsError) return 'Falha ao carregar';
    if (newsRisk.tier === 'none') return 'Nenhum evento próximo';
    const mins = Math.round(newsRisk.minutesAway ?? 0);
    const when = mins >= 0 ? `em ${mins}min` : `há ${Math.abs(mins)}min`;
    return `${newsRisk.event?.event ?? 'Evento de alto impacto'} (${when})`;
  }, [symbol, newsRisk, newsError]);

  return (
    <div className="bg-neutral-950 border border-white/5 rounded-xl p-5 h-full flex flex-col overflow-y-auto custom-scrollbar">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Risco de Mercado — {symbol}
        </h2>
        <div className="flex items-center gap-3">
          <div className="text-right">
              <p className="text-[10px] text-slate-500 uppercase">ATR</p>
              <p className={`text-xl font-mono font-bold ${riskColor}`}>
                  {atrPercent != null ? `${atrPercent.toFixed(2)}%` : '—'}
              </p>
          </div>
          <button
            onClick={() => setShowLunaSettings(true)}
            className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/10 to-purple-500/10 hover:from-cyan-500/20 hover:to-purple-500/20 border border-cyan-500/30 hover:border-cyan-500/50 transition-all group shrink-0"
            title="Configurações da Luna"
          >
            <Settings className="w-4 h-4 text-cyan-400 group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-between gap-4">
        <div className="text-center">
            <motion.div
                key={riskLevel}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`text-4xl font-bold tracking-tight mb-2 ${riskColor}`}
            >
                {riskLevel}
            </motion.div>
            <p className="text-xs text-slate-500 tracking-wide leading-relaxed">
              Risco de operar {symbol} agora
            </p>
        </div>

        {/* Gauge Visual */}
        <div className="relative pt-2">
           <div className="flex justify-between text-[10px] text-slate-600 uppercase tracking-widest font-bold mb-2 px-1">
              <span>Seguro</span>
              <span>Crítico</span>
           </div>

           <div className="relative h-4 bg-white/5 rounded-full overflow-hidden border border-white/5">
              <div className="absolute inset-0 opacity-80 bg-gradient-to-r from-emerald-500 via-yellow-500 to-red-600" />
           </div>

           <motion.div
              className="absolute w-0.5 h-6 bg-white shadow-[0_0_10px_rgba(255,255,255,1)] z-10"
              initial={{ left: '0%' }}
              animate={{ left: `${riskScore}%` }}
              transition={{ type: "spring", stiffness: 50, damping: 10 }}
              style={{ transform: 'translateX(-50%)', top: '22px' }}
           >
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full shadow-[0_0_5px_rgba(255,255,255,0.8)]" />
           </motion.div>
        </div>

        {/* Breakdown real dos 4 fatores. "Lateralização": mede se o preço está
            andando de lado (sem direção clara) em vez de em tendência — nesse
            caso, estratégias de rompimento erram mais (falso sinal). */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/5 rounded-lg px-3 py-2.5 flex items-center gap-2.5">
            <Waves className={`w-4 h-4 shrink-0 ${volatilityScore > 60 ? 'text-orange-400' : 'text-slate-400'}`} />
            <div className="min-w-0">
              <p className="text-[9px] text-slate-500 uppercase tracking-wide">Volatilidade</p>
              <p className="text-xs font-mono font-bold text-slate-200">
                {atrPercent != null ? `${atrPercent.toFixed(2)}%` : '—'}
              </p>
            </div>
          </div>
          <div className="bg-white/5 rounded-lg px-3 py-2.5 flex items-center gap-2.5">
            <Gauge className={`w-4 h-4 shrink-0 ${regime === 'LATERAL' ? 'text-orange-400' : 'text-slate-400'}`} />
            <div className="min-w-0">
              <p className="text-[9px] text-slate-500 uppercase tracking-wide">Lateralização</p>
              <p className="text-xs font-mono font-bold text-slate-200">
                {regime === 'TENDENCIA' ? 'Em tendência' : regime === 'LATERAL' ? 'Lateralizado' : '—'}
              </p>
            </div>
          </div>
          <div className="bg-white/5 rounded-lg px-3 py-2.5 flex items-center gap-2.5">
            <Activity className={`w-4 h-4 shrink-0 ${confidenceScore > 60 ? 'text-orange-400' : 'text-slate-400'}`} />
            <div className="min-w-0">
              <p className="text-[9px] text-slate-500 uppercase tracking-wide">Confiança do Motor</p>
              <p className="text-xs font-mono font-bold text-slate-200">
                {confidence != null ? `${confidence}%` : '—'}
              </p>
            </div>
          </div>
          <div className="bg-white/5 rounded-lg px-3 py-2.5 flex items-center gap-2.5">
            <Newspaper className={`w-4 h-4 shrink-0 ${newsRisk.tier === 'high' ? 'text-red-400' : newsRisk.tier === 'medium' ? 'text-orange-400' : 'text-slate-400'}`} />
            <div className="min-w-0">
              <p className="text-[9px] text-slate-500 uppercase tracking-wide">Notícias</p>
              <p className="text-[11px] font-mono font-bold text-slate-200 leading-tight truncate" title={newsLabel}>
                {newsLabel}
              </p>
            </div>
          </div>
        </div>

        {/* Info Box */}
        {!isLoading && riskScore > 50 && (
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3.5 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
            <div>
                <h4 className="text-xs font-bold text-orange-400 uppercase mb-1">Atenção ao Operar {symbol}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                    {newsRisk.tier !== 'none'
                      ? `Evento de alto impacto (${newsLabel}) pode gerar movimento brusco fora do padrão técnico.`
                      : regime === 'LATERAL'
                      ? 'Mercado lateralizado — estratégias de rompimento têm mais chance de sinal falso agora.'
                      : atrPercent != null && atrPercent > 1.5
                      ? `Volatilidade acima do normal (ATR ${atrPercent.toFixed(2)}%) — stops podem ser atingidos com mais facilidade.`
                      : 'Confiança do motor de análise está baixa para este ativo agora — sinais menos confiáveis.'}
                </p>
            </div>
            </div>
        )}

        {!isLoading && riskScore <= 50 && (
             <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3.5 flex items-start gap-3">
                <Activity className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                    <h4 className="text-xs font-bold text-emerald-400 uppercase mb-1">Condições Favoráveis</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        Volatilidade, lateralização, confiança do motor e agenda econômica sem sinal de risco elevado para {symbol} agora.
                    </p>
                </div>
             </div>
        )}
      </div>

      <LunaInteractionSettings
        isOpen={showLunaSettings}
        onClose={() => setShowLunaSettings(false)}
      />
    </div>
  );
}
