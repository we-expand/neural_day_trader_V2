import React, { useEffect, useMemo, useState } from 'react';
import { Waves, Box, GitBranch, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { useTradingContext } from '../../contexts/TradingContext';
import { backtestDataService, BacktestDataUnavailableError } from '@/app/services/BacktestDataService';
import { analyzeSmc } from '@/app/services/smc';
import type { SmcAnalysisResult, SmcZone } from '@/app/services/smc';

const TIMEFRAME = '1h' as const;
const CANDLE_WINDOW_DAYS = 14; // ~336 candles de 1h — janela suficiente pra swings/estrutura

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

function ZoneRow({ zone, label, bullish }: { zone: SmcZone; label: string; bullish: boolean }) {
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 border ${
        zone.mitigated ? 'bg-white/[0.02] border-white/5 opacity-50' : 'bg-white/5 border-white/10'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {bullish ? (
          <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        ) : (
          <ArrowDownRight className="w-3.5 h-3.5 text-red-400 shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="text-xs font-mono font-bold text-slate-200 truncate">
            {formatPrice(zone.priceLow)} — {formatPrice(zone.priceHigh)}
          </p>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[10px] text-slate-500">{zone.strength.toFixed(0)}%</p>
        <p className={`text-[9px] font-semibold ${zone.mitigated ? 'text-slate-600' : 'text-cyan-400'}`}>
          {zone.mitigated ? 'mitigado' : 'ativo'}
        </p>
      </div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="text-xs text-slate-600 italic px-3 py-2">{text}</p>;
}

export function LiquidityDetectorCard() {
  const { dashboardActiveSymbol } = useTradingContext();
  const symbol = dashboardActiveSymbol || 'BTCUSD';

  const [result, setResult] = useState<SmcAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const end = new Date();
        const start = new Date(end.getTime() - CANDLE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
        const response = await backtestDataService.fetchHistoricalData(symbol, start, end, TIMEFRAME);

        if (cancelled) return;

        const candles = response.candles.map((c) => ({
          timestamp: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume
        }));

        const analysis = analyzeSmc(candles, symbol, TIMEFRAME);
        setResult(analysis);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof BacktestDataUnavailableError
            ? 'Sem fonte de dados real disponível pra este ativo agora.'
            : err instanceof Error
            ? err.message
            : 'Erro desconhecido ao buscar candles.';
        setErrorMsg(message);
        setResult(null);
        console.warn('[LiquidityDetectorCard] ⚠️ Falha ao carregar/analisar SMC', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 5 * 60 * 1000); // recalcula a cada 5min
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [symbol]);

  const orderBlocks = result?.orderBlocks.slice(0, 3) ?? [];
  const fairValueGaps = result?.fairValueGaps.slice(0, 3) ?? [];
  const liquidityPools = result?.liquidityPools.slice(0, 3) ?? [];
  const lastEvent = result?.lastStructureEvent ?? null;

  const structureLabel = useMemo(() => {
    if (!lastEvent) return null;
    const kindLabel = lastEvent.kind === 'CHoCH' ? 'Mudança de Caráter (CHoCH)' : 'Rompimento de Estrutura (BOS)';
    const dirLabel = lastEvent.direction === 'bullish' ? 'Alta' : 'Baixa';
    return { kindLabel, dirLabel };
  }, [lastEvent]);

  return (
    <div className="bg-neutral-950 border border-white/5 rounded-xl p-5 h-full flex flex-col overflow-y-auto custom-scrollbar">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <Waves className="w-4 h-4" />
          Detector de Liquidez — {symbol}
        </h2>
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          {loading && <RefreshCw className="w-3 h-3 animate-spin" />}
          {result && !loading && <span>calculado {timeAgo(result.computedAt)}</span>}
        </div>
      </div>

      {errorMsg ? (
        <div className="flex-1 flex items-center justify-center text-center px-4">
          <p className="text-xs text-slate-500">{errorMsg}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 flex-1">
          {/* Order Blocks */}
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2 flex items-center gap-1.5">
              <Box className="w-3 h-3" /> Order Blocks
            </p>
            <div className="space-y-1.5">
              {loading && orderBlocks.length === 0 && <EmptyRow text="Calculando..." />}
              {!loading && orderBlocks.length === 0 && <EmptyRow text="Nenhum Order Block relevante nesta janela." />}
              {orderBlocks.map((z) => (
                <ZoneRow key={z.id} zone={z} label="Order Block" bullish={z.type === 'order_block_bullish'} />
              ))}
            </div>
          </div>

          {/* Fair Value Gaps */}
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2 flex items-center gap-1.5">
              <GitBranch className="w-3 h-3" /> Fair Value Gaps
            </p>
            <div className="space-y-1.5">
              {loading && fairValueGaps.length === 0 && <EmptyRow text="Calculando..." />}
              {!loading && fairValueGaps.length === 0 && <EmptyRow text="Nenhum FVG relevante nesta janela." />}
              {fairValueGaps.map((z) => (
                <ZoneRow key={z.id} zone={z} label="FVG" bullish={z.type === 'fvg_bullish'} />
              ))}
            </div>
          </div>

          {/* Liquidity Pools */}
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2 flex items-center gap-1.5">
              <Waves className="w-3 h-3" /> Liquidity Pools
            </p>
            <div className="space-y-1.5">
              {loading && liquidityPools.length === 0 && <EmptyRow text="Calculando..." />}
              {!loading && liquidityPools.length === 0 && <EmptyRow text="Nenhuma piscina de liquidez relevante." />}
              {liquidityPools.map((z) => (
                <ZoneRow
                  key={z.id}
                  zone={z}
                  label={z.type === 'liquidity_pool_buyside' ? 'Buyside' : 'Sellside'}
                  bullish={z.type === 'liquidity_pool_buyside'}
                />
              ))}
            </div>
          </div>

          {/* Estrutura */}
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2 flex items-center gap-1.5">
              <ArrowUpRight className="w-3 h-3" /> Estrutura
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
      )}
    </div>
  );
}
