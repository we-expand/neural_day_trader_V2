import React, { useEffect, useMemo, useState } from 'react';
import { Waves, Box, GitBranch, ArrowUpRight, ArrowDownRight, RefreshCw, History, Target, Info } from 'lucide-react';
import { useTradingContext } from '../../contexts/TradingContext';
import { backtestDataService, BacktestDataUnavailableError } from '@/app/services/BacktestDataService';
import { analyzeSmc } from '@/app/services/smc';
import type { SmcAnalysisResult, SmcZone, SmcZoneType } from '@/app/services/smc';

// Duas janelas combinadas: a "micro" (1h/14 dias) cobre estrutura recente/intradiária;
// a "macro" (1D/5 anos) cobre estrutura de longo prazo (ex: uma máxima histórica de
// meses/anos atrás) — sem ela, qualquer zona formada fora da janela curta fica
// invisível, e o card erra ao parecer que "não existe nada acima do preço" quando
// na verdade só não olhou longe o suficiente pra trás.
const MICRO_TIMEFRAME = '1h' as const;
const MICRO_WINDOW_DAYS = 14;
const MACRO_TIMEFRAME = '1d' as const;
const MACRO_WINDOW_DAYS = 1825; // ~5 anos
const MACRO_REFRESH_MS = 30 * 60 * 1000; // dado diário muda pouco — atualiza a cada 30min, não 5min
const MICRO_REFRESH_MS = 5 * 60 * 1000;
const MAX_TARGETS = 10;

type SourceTimeframe = typeof MICRO_TIMEFRAME | typeof MACRO_TIMEFRAME;
type TaggedZone = SmcZone & { sourceTimeframe: SourceTimeframe };

function formatPrice(value: number): string {
  return value >= 100 ? value.toFixed(2) : value.toFixed(5);
}

function timeAgo(ms: number): string {
  const diffMin = Math.round((Date.now() - ms) / 60000);
  if (diffMin < 1) return 'agora mesmo';
  if (diffMin < 60) return `há ${diffMin}min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `há ${diffH}h`;
  return `há ${Math.round(diffH / 24)}d`;
}

const ZONE_META: Record<SmcZoneType, { category: string; icon: typeof Box; bullish: boolean }> = {
  order_block_bullish: { category: 'Bloco de Ordem', icon: Box, bullish: true },
  order_block_bearish: { category: 'Bloco de Ordem', icon: Box, bullish: false },
  fvg_bullish: { category: 'FVG', icon: GitBranch, bullish: true },
  fvg_bearish: { category: 'FVG', icon: GitBranch, bullish: false },
  liquidity_pool_buyside: { category: 'Piscina de Liquidez · Lado Comprador', icon: Waves, bullish: true },
  liquidity_pool_sellside: { category: 'Piscina de Liquidez · Lado Vendedor', icon: Waves, bullish: false }
};

const TIMEFRAME_LABEL: Record<SourceTimeframe, string> = {
  '1h': '1H · recente',
  '1d': '1D · longo prazo'
};

type ZoneDirection = 'acima' | 'abaixo' | 'dentro';

interface ZoneWithDistance {
  zone: TaggedZone;
  direction: ZoneDirection;
  distanceAbs: number;
  distancePct: number;
}

function computeDistance(zone: TaggedZone, currentPrice: number): ZoneWithDistance {
  let direction: ZoneDirection;
  let distanceAbs: number;

  if (currentPrice < zone.priceLow) {
    direction = 'acima';
    distanceAbs = zone.priceLow - currentPrice;
  } else if (currentPrice > zone.priceHigh) {
    direction = 'abaixo';
    distanceAbs = currentPrice - zone.priceHigh;
  } else {
    direction = 'dentro';
    distanceAbs = 0;
  }

  return { zone, direction, distanceAbs, distancePct: (distanceAbs / currentPrice) * 100 };
}

function tagZones(result: SmcAnalysisResult | null, tf: SourceTimeframe): TaggedZone[] {
  if (!result) return [];
  return [...result.orderBlocks, ...result.fairValueGaps, ...result.liquidityPools].map((z) => ({
    ...z,
    id: `${tf}_${z.id}`,
    sourceTimeframe: tf
  }));
}

function EmptyRow({ text }: { text: string }) {
  return <p className="text-xs text-slate-600 italic px-3 py-2">{text}</p>;
}

function TargetRow({ item }: { item: ZoneWithDistance }) {
  const { zone, direction, distancePct } = item;
  const meta = ZONE_META[zone.type];
  const Icon = meta.icon;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 border bg-white/5 border-white/10">
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center ${
            meta.bullish ? 'bg-emerald-500/10' : 'bg-red-500/10'
          }`}
        >
          <Icon className={`w-3.5 h-3.5 ${meta.bullish ? 'text-emerald-400' : 'text-red-400'}`} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide truncate">
            {meta.category}
            <span className="text-slate-600 normal-case"> · {TIMEFRAME_LABEL[zone.sourceTimeframe]}</span>
          </p>
          <p className="text-xs font-mono font-bold text-slate-200 truncate">
            {formatPrice(zone.priceLow)} — {formatPrice(zone.priceHigh)}
          </p>
        </div>
      </div>
      <div className="text-right shrink-0">
        {direction === 'dentro' ? (
          <p className="text-[10px] font-semibold text-amber-400">preço dentro da zona</p>
        ) : (
          <p className={`text-xs font-bold ${direction === 'acima' ? 'text-emerald-400' : 'text-red-400'}`}>
            {direction === 'acima' ? '▲' : '▼'} {distancePct.toFixed(2)}%
          </p>
        )}
        <p className="text-[10px] text-slate-500">força {zone.strength.toFixed(0)}%</p>
      </div>
    </div>
  );
}

function HistoryRow({ zone }: { zone: TaggedZone }) {
  const meta = ZONE_META[zone.type];
  const Icon = meta.icon;
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 border bg-white/[0.02] border-white/5 opacity-60">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className={`w-3.5 h-3.5 shrink-0 ${meta.bullish ? 'text-emerald-400' : 'text-red-400'}`} />
        <div className="min-w-0">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide truncate">
            {meta.category}
            <span className="text-slate-700 normal-case"> · {TIMEFRAME_LABEL[zone.sourceTimeframe]}</span>
          </p>
          <p className="text-xs font-mono font-bold text-slate-300 truncate">
            {formatPrice(zone.priceLow)} — {formatPrice(zone.priceHigh)}
          </p>
        </div>
      </div>
      <p className="text-[10px] text-slate-600 shrink-0">
        testada {zone.mitigatedAt ? timeAgo(zone.mitigatedAt) : ''}
      </p>
    </div>
  );
}

export function LiquidityDetectorCard() {
  const { dashboardActiveSymbol } = useTradingContext();
  const symbol = dashboardActiveSymbol || 'BTCUSD';

  const [microResult, setMicroResult] = useState<SmcAnalysisResult | null>(null);
  const [macroResult, setMacroResult] = useState<SmcAnalysisResult | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [macroLoading, setMacroLoading] = useState(true);
  const [macroUnavailable, setMacroUnavailable] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Janela recente (1H/14 dias) — também é a fonte do preço atual, sempre a mais fresca.
  useEffect(() => {
    let cancelled = false;
    setShowHistory(false);

    const load = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const end = new Date();
        const start = new Date(end.getTime() - MICRO_WINDOW_DAYS * 24 * 60 * 60 * 1000);
        const response = await backtestDataService.fetchHistoricalData(symbol, start, end, MICRO_TIMEFRAME);

        if (cancelled) return;

        const candles = response.candles.map((c) => ({
          timestamp: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume
        }));

        const analysis = analyzeSmc(candles, symbol, MICRO_TIMEFRAME);
        setMicroResult(analysis);
        setCurrentPrice(candles.length > 0 ? candles[candles.length - 1].close : null);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof BacktestDataUnavailableError
            ? 'Sem fonte de dados real disponível pra este ativo agora.'
            : err instanceof Error
            ? err.message
            : 'Erro desconhecido ao buscar candles.';
        setErrorMsg(message);
        setMicroResult(null);
        setCurrentPrice(null);
        console.warn('[LiquidityDetectorCard] ⚠️ Falha ao carregar/analisar SMC (micro)', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, MICRO_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [symbol]);

  // Janela longa (1D/5 anos) — pega estrutura de longo prazo (ex: uma máxima histórica
  // de meses/anos atrás) que a janela recente nunca alcançaria. Falha aqui não derruba
  // o card inteiro — só reduz a cobertura pra zonas recentes, com aviso explícito.
  useEffect(() => {
    let cancelled = false;

    const loadMacro = async () => {
      setMacroLoading(true);
      setMacroUnavailable(false);
      try {
        const end = new Date();
        const start = new Date(end.getTime() - MACRO_WINDOW_DAYS * 24 * 60 * 60 * 1000);
        const response = await backtestDataService.fetchHistoricalData(symbol, start, end, MACRO_TIMEFRAME);

        if (cancelled) return;

        const candles = response.candles.map((c) => ({
          timestamp: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume
        }));

        setMacroResult(analyzeSmc(candles, symbol, MACRO_TIMEFRAME));
      } catch (err) {
        if (cancelled) return;
        setMacroResult(null);
        setMacroUnavailable(true);
        console.warn('[LiquidityDetectorCard] ⚠️ Falha ao carregar/analisar SMC (macro, 1D/5 anos)', err);
      } finally {
        if (!cancelled) setMacroLoading(false);
      }
    };

    loadMacro();
    const interval = setInterval(loadMacro, MACRO_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [symbol]);

  const allZones = useMemo(
    () => [...tagZones(microResult, MICRO_TIMEFRAME), ...tagZones(macroResult, MACRO_TIMEFRAME)],
    [microResult, macroResult]
  );

  // Todas as zonas não testadas, com direção calculada — base pra contagem por lado
  // e pro corte de exibição (upcomingTargets), sem perder a informação de quantas
  // existem de cada lado quando o corte de MAX_TARGETS deixa alguma de fora.
  const allUpcoming = useMemo(() => {
    if (!currentPrice) return [];
    return allZones.filter((z) => !z.mitigated).map((z) => computeDistance(z, currentPrice));
  }, [allZones, currentPrice]);

  // Alvos futuros: zonas que o preço ainda não visitou, ordenadas da mais
  // próxima pra mais distante — é a leitura de "pra onde a liquidez tende a puxar o preço a seguir".
  const upcomingTargets = useMemo(
    () => [...allUpcoming].sort((a, b) => a.distanceAbs - b.distanceAbs).slice(0, MAX_TARGETS),
    [allUpcoming]
  );

  const countAbove = allUpcoming.filter((t) => t.direction === 'acima').length;
  const countBelow = allUpcoming.filter((t) => t.direction === 'abaixo').length;

  const historyZones = useMemo(() => {
    return allZones
      .filter((z) => z.mitigated)
      .sort((a, b) => (b.mitigatedAt ?? 0) - (a.mitigatedAt ?? 0));
  }, [allZones]);

  const lastEvent = microResult?.lastStructureEvent ?? null;
  const structureLabel = useMemo(() => {
    if (!lastEvent) return null;
    const kindLabel = lastEvent.kind === 'CHoCH' ? 'Mudança de Caráter (CHoCH)' : 'Rompimento de Estrutura (BOS)';
    const dirLabel = lastEvent.direction === 'bullish' ? 'Alta' : 'Baixa';
    return { kindLabel, dirLabel };
  }, [lastEvent]);

  return (
    <div className="bg-neutral-950 border border-white/5 rounded-xl p-5 h-full flex flex-col overflow-y-auto custom-scrollbar">
      <div className="flex justify-between items-start mb-1">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <Waves className="w-4 h-4" />
          Detector de Liquidez — {symbol}
        </h2>
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          {(loading || macroLoading) && <RefreshCw className="w-3 h-3 animate-spin" />}
          {microResult && !loading && <span>calculado {timeAgo(microResult.computedAt)}</span>}
        </div>
      </div>
      <p className="text-[10px] text-slate-600 mb-4">
        Zonas de liquidez que o preço ainda não visitou — combina os últimos {MICRO_WINDOW_DAYS} dias (1H) com até 5
        anos de histórico (1D), pra pegar tanto estrutura recente quanto máximas/mínimas antigas ainda não testadas.
      </p>

      {errorMsg ? (
        <div className="flex-1 flex items-center justify-center text-center px-4">
          <p className="text-xs text-slate-500">{errorMsg}</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Próximos alvos (preditivo) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold flex items-center gap-1.5">
                  <Target className="w-3 h-3" /> Próximos Alvos de Liquidez
                </p>
                {!loading && (countAbove > 0 || countBelow > 0) && (
                  <p className="text-[10px] font-semibold shrink-0">
                    <span className="text-emerald-400">▲ {countAbove} acima</span>
                    <span className="text-slate-600"> · </span>
                    <span className="text-red-400">▼ {countBelow} abaixo</span>
                  </p>
                )}
              </div>

              {macroUnavailable && !macroLoading && (
                <div className="flex items-start gap-2 rounded-lg px-3 py-2 mb-2 bg-amber-500/10 border border-amber-500/20">
                  <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-300 leading-relaxed">
                    Histórico de longo prazo (1D/5 anos) indisponível agora — mostrando só estrutura dos últimos{' '}
                    {MICRO_WINDOW_DAYS} dias. Zonas antigas (ex: máximas/mínimas históricas) podem não aparecer.
                  </p>
                </div>
              )}

              {!loading && !macroLoading && (countAbove === 0 || countBelow === 0) && (countAbove > 0 || countBelow > 0) && (
                <div className="flex items-start gap-2 rounded-lg px-3 py-2 mb-2 bg-blue-500/10 border border-blue-500/20">
                  <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-blue-300 leading-relaxed">
                    {countAbove === 0
                      ? `Nenhuma zona identificada acima do preço mesmo olhando ${MACRO_WINDOW_DAYS >= 365 ? Math.round(MACRO_WINDOW_DAYS / 365) : MACRO_WINDOW_DAYS}${MACRO_WINDOW_DAYS >= 365 ? ' anos' : ' dias'} pra trás — o preço atual está na máxima histórica dessa janela, sem nenhuma estrutura de reversão registrada acima dele. Não é uma previsão de queda, é ausência real de dado ali.`
                      : `Nenhuma zona identificada abaixo do preço mesmo olhando ${MACRO_WINDOW_DAYS >= 365 ? Math.round(MACRO_WINDOW_DAYS / 365) : MACRO_WINDOW_DAYS}${MACRO_WINDOW_DAYS >= 365 ? ' anos' : ' dias'} pra trás — o preço atual está na mínima histórica dessa janela, sem nenhuma estrutura de reversão registrada abaixo dele. Não é uma previsão de alta, é ausência real de dado ali.`}
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                {(loading || macroLoading) && upcomingTargets.length === 0 && <EmptyRow text="Calculando..." />}
                {!loading && !macroLoading && upcomingTargets.length === 0 && (
                  <EmptyRow text="Nenhuma zona não testada nesta janela." />
                )}
                {upcomingTargets.map((item) => (
                  <TargetRow key={item.zone.id} item={item} />
                ))}
              </div>
            </div>

            {/* Estrutura */}
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2 flex items-center gap-1.5">
                <ArrowUpRight className="w-3 h-3" /> Estrutura (contexto de tendência)
              </p>
              {loading && !structureLabel && <EmptyRow text="Calculando..." />}
              {!loading && !structureLabel && <EmptyRow text="Sem evento de estrutura detectado." />}
              {structureLabel && lastEvent && (
                <div
                  className={`rounded-lg px-3 py-2.5 border ${
                    lastEvent.direction === 'bullish'
                      ? 'bg-emerald-500/10 border-emerald-500/20'
                      : 'bg-red-500/10 border-red-500/20'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {lastEvent.direction === 'bullish' ? (
                      <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4 text-red-400" />
                    )}
                    <p className="text-xs font-bold text-slate-200">{structureLabel.kindLabel}</p>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {structureLabel.dirLabel} · {formatPrice(lastEvent.price)} · {timeAgo(lastEvent.time)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Histórico (zonas já testadas) — escondido por padrão */}
          <div className="border-t border-white/5 pt-3">
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="text-[10px] text-slate-500 hover:text-slate-300 uppercase tracking-widest font-bold flex items-center gap-1.5 transition-colors"
            >
              <History className="w-3 h-3" />
              {showHistory ? 'Ocultar' : 'Ver'} histórico ({historyZones.length} zona{historyZones.length === 1 ? '' : 's'} já testada{historyZones.length === 1 ? '' : 's'})
            </button>
            {showHistory && (
              <div className="space-y-1.5 mt-2">
                {historyZones.length === 0 && <EmptyRow text="Nenhuma zona testada nesta janela." />}
                {historyZones.map((z) => (
                  <HistoryRow key={z.id} zone={z} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
