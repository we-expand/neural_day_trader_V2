import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ShieldAlert, Loader2, Link2Off, Settings2, X } from 'lucide-react';
import { toast } from 'sonner';

import { useTradingContext } from '../../contexts/TradingContext';
import { getAssetBySymbol } from '../../config/assetDatabase';
import { getContractSpec } from '../../../config/contractSpecs';
import { formatPrice } from '../../utils/priceFormatter';
import {
  createMarketBuyOrder,
  createMarketSellOrder,
  getBrokerCredentialsStatus,
} from '../../services/BrokerClient';
import { LIVE_ALERT_DISCLAIMER } from '../../modules/liveAlertStage/useLiveAlertStage';

type Side = 'BUY' | 'SELL';

interface OrderTicketProps {
  symbol: string;
  currentPrice: number | null;
}

/**
 * Boleta de ordem a mercado, ancorada dentro do gráfico (canto superior
 * esquerdo, estilo "one-click trading" de terminal profissional — MT5/cTrader).
 * Recolhida: barra compacta SELL/BUY com stepper de volume. Expandida: ficha
 * completa (Perda máxima/Lucro máximo/Comentário), mesmo padrão de campos do
 * "New Order" do MT5. Suporta DEMO (posição virtual persistida) e LIVE
 * (broker real via BrokerClient — a mesma rota /broker/execute já valida
 * risco fail-closed no servidor). Sem ordem pendente (limit/stop) — o backend
 * não expõe esse endpoint hoje.
 */
export function OrderTicket({ symbol, currentPrice }: OrderTicketProps) {
  const { executionMode, portfolio, openManualPosition } = useTradingContext();

  const asset = useMemo(() => getAssetBySymbol(symbol), [symbol]);
  const contractSpec = useMemo(() => getContractSpec(symbol), [symbol]);

  const [expanded, setExpanded] = useState(false);
  const [volume, setVolume] = useState<number>(asset ? asset.minLot : 0.01);
  const [stopLoss, setStopLoss] = useState('0.00');
  const [takeProfit, setTakeProfit] = useState('0.00');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState<Side | null>(null);

  const [brokerConfigured, setBrokerConfigured] = useState<boolean | null>(null);
  React.useEffect(() => {
    if (executionMode !== 'LIVE') return;
    let cancelled = false;
    getBrokerCredentialsStatus()
      .then((status) => { if (!cancelled) setBrokerConfigured(status.configured); })
      .catch(() => { if (!cancelled) setBrokerConfigured(false); });
    return () => { cancelled = true; };
  }, [executionMode]);

  const step = asset?.minLot ?? 0.01;
  const volumeValid = asset ? volume > 0 && volume >= asset.minLot && volume <= asset.maxLot : volume > 0;

  const slNum = Number(stopLoss.replace(',', '.'));
  const tpNum = Number(takeProfit.replace(',', '.'));
  const slSet = slNum > 0;
  const tpSet = tpNum > 0;

  function directionValid(side: Side): { ok: boolean; error?: string } {
    if (slSet) {
      const bad = side === 'BUY' ? slNum >= (currentPrice ?? Infinity) : slNum <= (currentPrice ?? 0);
      if (bad) return { ok: false, error: `Perda máxima inválida para ${side === 'BUY' ? 'compra' : 'venda'}` };
    }
    if (tpSet) {
      const bad = side === 'BUY' ? tpNum <= (currentPrice ?? 0) : tpNum >= (currentPrice ?? Infinity);
      if (bad) return { ok: false, error: `Lucro máximo inválido para ${side === 'BUY' ? 'compra' : 'venda'}` };
    }
    return { ok: true };
  }

  const riskUsd = useMemo(() => {
    if (!slSet || !currentPrice || !(volume > 0)) return null;
    const priceDelta = Math.abs(currentPrice - slNum);
    const ticks = contractSpec.tickSize > 0 ? priceDelta / contractSpec.tickSize : 0;
    return ticks * contractSpec.tickValue * volume;
  }, [slSet, currentPrice, slNum, volume, contractSpec]);

  const riskPercent = riskUsd != null && portfolio.balance > 0 ? (riskUsd / portfolio.balance) * 100 : null;

  const rewardUsd = useMemo(() => {
    if (!tpSet || !currentPrice || !(volume > 0)) return null;
    const priceDelta = Math.abs(tpNum - currentPrice);
    const ticks = contractSpec.tickSize > 0 ? priceDelta / contractSpec.tickSize : 0;
    return ticks * contractSpec.tickValue * volume;
  }, [tpSet, currentPrice, tpNum, volume, contractSpec]);

  const marginEstimate = useMemo(() => {
    if (!currentPrice || !asset || !(volume > 0)) return null;
    const notional = volume * asset.lotSize * currentPrice;
    return asset.leverage > 0 ? notional / asset.leverage : notional;
  }, [currentPrice, asset, volume]);

  const brokerBlocked = executionMode === 'LIVE' && brokerConfigured !== true;
  const canTrade = currentPrice != null && volumeValid && !submitting && !brokerBlocked;

  function adjustVolume(delta: number) {
    if (!asset) return;
    setVolume((v) => {
      const next = Number((v + delta).toFixed(8));
      return Math.min(asset.maxLot, Math.max(asset.minLot, next));
    });
  }

  async function executeOrder(side: Side) {
    if (!currentPrice || !asset || !canTrade) return;
    const direction = directionValid(side);
    if (!direction.ok) {
      toast.error('Ordem recusada', { description: direction.error });
      return;
    }

    setSubmitting(side);
    try {
      if (executionMode === 'DEMO') {
        const result = openManualPosition({
          symbol,
          side: side === 'BUY' ? 'LONG' : 'SHORT',
          volume,
          entryPrice: currentPrice,
          stopLoss: slSet ? slNum : undefined,
          takeProfit: tpSet ? tpNum : undefined,
        });
        if (result.success) {
          toast.success(`${side === 'BUY' ? 'Compra' : 'Venda'} enviada`, {
            description: `${symbol} · ${volume} lote(s) @ ${formatPrice(currentPrice, symbol)} (DEMO)`,
          });
          setStopLoss('0.00');
          setTakeProfit('0.00');
        } else {
          toast.error('Ordem recusada', { description: result.error });
        }
      } else {
        const params = {
          symbol,
          volume,
          stopLoss: slSet ? slNum : undefined,
          takeProfit: tpSet ? tpNum : undefined,
          comment: comment || 'Ordem manual (boleta)',
        };
        const result = side === 'BUY'
          ? await createMarketBuyOrder(params)
          : await createMarketSellOrder(params);
        if (result.success) {
          toast.success(`${side === 'BUY' ? 'Compra' : 'Venda'} executada`, {
            description: `${symbol} · ${volume} lote(s) na corretora`,
          });
          setStopLoss('0.00');
          setTakeProfit('0.00');
        } else {
          toast.error('Ordem recusada pela corretora', { description: result.error || result.message });
        }
      }
    } catch (err: any) {
      toast.error('Falha ao enviar ordem', { description: err?.message || 'Erro desconhecido' });
    } finally {
      setSubmitting(null);
    }
  }

  const priceLabel = currentPrice != null ? formatPrice(currentPrice, symbol) : '----.--';

  // ─────────────────────────── Modo recolhido ───────────────────────────
  if (!expanded) {
    return (
      <div
        className="inline-flex flex-col bg-black/90 backdrop-blur-sm border border-white/10 rounded-lg overflow-hidden shadow-2xl select-none"
        data-testid="order-ticket-compact"
      >
        {/* Cabeçalho: símbolo + modo + expandir */}
        <div className="flex items-center justify-between gap-3 px-2.5 py-1.5 border-b border-white/5 bg-white/[0.02]">
          <span className="text-[10px] font-black text-white tracking-tight">{symbol}</span>
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[8px] font-bold px-1.5 py-0.5 rounded tracking-widest ${
                executionMode === 'LIVE' ? 'text-red-300 bg-red-500/10' : 'text-blue-300 bg-blue-500/10'
              }`}
            >
              {executionMode}
            </span>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="text-slate-400 hover:text-white transition-colors"
              title="Mais opções (SL/TP/comentário)"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Stepper de volume compartilhado */}
        <div className="flex items-center justify-center gap-2 px-2.5 py-1.5 border-b border-white/5">
          <button
            type="button"
            onClick={() => adjustVolume(-step)}
            className="w-5 h-5 flex items-center justify-center rounded bg-white/5 text-slate-300 hover:bg-white/10"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
          <span className="text-xs font-mono text-white w-14 text-center">{volume.toFixed(2)}</span>
          <button
            type="button"
            onClick={() => adjustVolume(step)}
            className="w-5 h-5 flex items-center justify-center rounded bg-white/5 text-slate-300 hover:bg-white/10"
          >
            <ChevronUp className="w-3 h-3" />
          </button>
          <span className="text-[9px] text-slate-500 font-mono">lotes</span>
        </div>

        {/* SELL | BUY — clique executa a mercado (one-click trading) */}
        <div className="grid grid-cols-2">
          <button
            type="button"
            disabled={!canTrade}
            onClick={() => executeOrder('SELL')}
            className="flex flex-col items-center justify-center gap-0.5 px-4 py-2.5 bg-red-600/90 hover:bg-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed border-r border-black/30"
          >
            <span className="text-[9px] font-bold text-red-100 tracking-widest">SELL</span>
            {submitting === 'SELL' ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <span className="text-lg font-black font-mono text-white leading-none">{priceLabel}</span>
            )}
          </button>
          <button
            type="button"
            disabled={!canTrade}
            onClick={() => executeOrder('BUY')}
            className="flex flex-col items-center justify-center gap-0.5 px-4 py-2.5 bg-emerald-600/90 hover:bg-emerald-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="text-[9px] font-bold text-emerald-100 tracking-widest">BUY</span>
            {submitting === 'BUY' ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <span className="text-lg font-black font-mono text-white leading-none">{priceLabel}</span>
            )}
          </button>
        </div>

        {brokerBlocked && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 text-[9px] text-amber-300 bg-amber-500/10 border-t border-amber-500/20">
            <Link2Off className="w-3 h-3 shrink-0" /> Sem corretora conectada
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────── Modo expandido ───────────────────────────
  return (
    <div
      className="w-[300px] bg-gradient-to-br from-neutral-950 to-black border-2 border-white/10 rounded-xl p-4 relative overflow-hidden shadow-2xl"
      data-testid="order-ticket-expanded"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 relative z-10">
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Execução de Mercado</p>
          <p className="text-sm font-black text-white tracking-tight">{symbol}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`text-[9px] font-bold px-2 py-1 rounded-md border tracking-widest ${
              executionMode === 'LIVE'
                ? 'text-red-300 bg-red-500/10 border-red-400/30'
                : 'text-blue-300 bg-blue-500/10 border-blue-400/20'
            }`}
          >
            {executionMode}
          </span>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="w-6 h-6 flex items-center justify-center rounded-md bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
            title="Recolher"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Preço de referência */}
      <div className="bg-black/30 rounded-lg p-3 border border-white/5 mb-3 relative z-10 flex items-center justify-between">
        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Referência</span>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-lg font-black font-mono tracking-tight text-white">{priceLabel}</span>
        </div>
      </div>

      {/* Volume */}
      <div className="mb-3 relative z-10">
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Volume</label>
          {asset && (
            <span className="text-[10px] text-slate-500 font-mono">mín. {asset.minLot} · máx. {asset.maxLot}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => adjustVolume(-step)}
            className="w-9 h-9 flex items-center justify-center rounded-md bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <input
            type="text"
            inputMode="decimal"
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value.replace(',', '.')) || 0)}
            className={`flex-1 h-9 rounded-md border bg-black/40 px-3 text-sm font-mono text-white text-center outline-none focus:ring-2 ${
              volumeValid ? 'border-white/10 focus:ring-white/20' : 'border-red-500/60 focus:ring-red-500/30'
            }`}
          />
          <button
            type="button"
            onClick={() => adjustVolume(step)}
            className="w-9 h-9 flex items-center justify-center rounded-md bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Perda máxima / Lucro máximo */}
      <div className="grid grid-cols-2 gap-2 mb-3 relative z-10">
        <div>
          <label className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1 block">Perda máxima</label>
          <input
            type="text"
            inputMode="decimal"
            value={stopLoss}
            onChange={(e) => setStopLoss(e.target.value)}
            className="w-full h-8 rounded-md border border-white/10 bg-black/40 px-2 text-xs font-mono text-white outline-none focus:ring-2 focus:ring-white/20"
          />
        </div>
        <div>
          <label className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1 block">Lucro máximo</label>
          <input
            type="text"
            inputMode="decimal"
            value={takeProfit}
            onChange={(e) => setTakeProfit(e.target.value)}
            className="w-full h-8 rounded-md border border-white/10 bg-black/40 px-2 text-xs font-mono text-white outline-none focus:ring-2 focus:ring-white/20"
          />
        </div>
      </div>

      {/* Comentário */}
      <div className="mb-3 relative z-10">
        <label className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1 block">Comentário</label>
        <input
          type="text"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="opcional"
          className="w-full h-8 rounded-md border border-white/10 bg-black/40 px-2 text-xs text-white outline-none placeholder:text-slate-600 focus:ring-2 focus:ring-white/20"
        />
      </div>

      {/* Risco / margem */}
      <div className="bg-black/30 rounded-lg p-3 border border-white/5 mb-3 relative z-10 space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-slate-400 font-mono">Risco (perda máx.)</span>
          <span className={`text-xs font-bold font-mono ${riskUsd != null ? 'text-red-400' : 'text-slate-600'}`}>
            {riskUsd != null ? `$${riskUsd.toFixed(2)} (${riskPercent?.toFixed(1)}%)` : '—'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-slate-400 font-mono">Retorno (lucro máx.)</span>
          <span className={`text-xs font-bold font-mono ${rewardUsd != null ? 'text-emerald-400' : 'text-slate-600'}`}>
            {rewardUsd != null ? `$${rewardUsd.toFixed(2)}` : '—'}
          </span>
        </div>
        <div className="h-px bg-white/5 my-1" />
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-slate-400 font-mono">Margem estimada</span>
          <span className="text-xs font-bold font-mono text-slate-300">
            {marginEstimate != null ? `$${marginEstimate.toFixed(2)}` : '—'}
          </span>
        </div>
      </div>

      {brokerBlocked && (
        <div className="mb-3 flex items-start gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 relative z-10">
          <Link2Off className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Nenhuma corretora conectada. Conecte uma conta MetaAPI nas configurações para operar em modo LIVE.</span>
        </div>
      )}
      {executionMode === 'LIVE' && (
        <div className="mb-3 flex items-start gap-2 relative z-10">
          <ShieldAlert className="w-3.5 h-3.5 text-red-400/90 shrink-0 mt-0.5" />
          <p className="text-xs font-semibold text-red-400/90">{LIVE_ALERT_DISCLAIMER}</p>
        </div>
      )}

      {/* Sell / Buy a mercado */}
      <div className="grid grid-cols-2 gap-2 relative z-10">
        <button
          type="button"
          disabled={!canTrade}
          onClick={() => executeOrder('SELL')}
          className="h-11 rounded-lg font-black tracking-wide text-sm flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 shadow-lg shadow-red-500/30 text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-all"
        >
          {submitting === 'SELL' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sell a mercado'}
        </button>
        <button
          type="button"
          disabled={!canTrade}
          onClick={() => executeOrder('BUY')}
          className="h-11 rounded-lg font-black tracking-wide text-sm flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/30 text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-all"
        >
          {submitting === 'BUY' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buy a mercado'}
        </button>
      </div>
    </div>
  );
}
