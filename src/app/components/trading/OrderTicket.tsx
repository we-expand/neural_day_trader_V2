import React, { useMemo, useState } from 'react';
import { ArrowUpRight, ArrowDownRight, ShieldAlert, Wallet, Loader2, Link2Off } from 'lucide-react';
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
 * Boleta de ordem a mercado, ancorada no gráfico. Suporta os dois modos:
 * DEMO (posição virtual, via useApexLogic/openManualPosition, persistida em
 * ai_trades) e LIVE (broker real via BrokerClient — mesma rota
 * /broker/execute que já valida risco fail-closed no servidor). Não suporta
 * ordem pendente (limit/stop) — o backend não tem esse endpoint hoje.
 */
export function OrderTicket({ symbol, currentPrice }: OrderTicketProps) {
  const { executionMode, portfolio, openManualPosition } = useTradingContext();

  const asset = useMemo(() => getAssetBySymbol(symbol), [symbol]);
  const contractSpec = useMemo(() => getContractSpec(symbol), [symbol]);

  const [side, setSide] = useState<Side>('BUY');
  const [volume, setVolume] = useState<string>(asset ? String(asset.minLot) : '0.01');
  const [useStopLoss, setUseStopLoss] = useState(false);
  const [useTakeProfit, setUseTakeProfit] = useState(false);
  const [stopLossPrice, setStopLossPrice] = useState('');
  const [takeProfitPrice, setTakeProfitPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [brokerConfigured, setBrokerConfigured] = useState<boolean | null>(null);
  React.useEffect(() => {
    if (executionMode !== 'LIVE') return;
    let cancelled = false;
    getBrokerCredentialsStatus()
      .then((status) => { if (!cancelled) setBrokerConfigured(status.configured); })
      .catch(() => { if (!cancelled) setBrokerConfigured(false); });
    return () => { cancelled = true; };
  }, [executionMode]);

  const volumeNum = Number(volume.replace(',', '.'));
  const slNum = Number(stopLossPrice.replace(',', '.'));
  const tpNum = Number(takeProfitPrice.replace(',', '.'));

  const volumeValid = asset
    ? volumeNum > 0 && volumeNum >= asset.minLot && volumeNum <= asset.maxLot
    : volumeNum > 0;

  const slValid = !useStopLoss || (slNum > 0 && (side === 'BUY' ? slNum < (currentPrice ?? Infinity) : slNum > (currentPrice ?? 0)));
  const tpValid = !useTakeProfit || (tpNum > 0 && (side === 'BUY' ? tpNum > (currentPrice ?? 0) : tpNum < (currentPrice ?? Infinity)));

  const riskUsd = useMemo(() => {
    if (!useStopLoss || !currentPrice || !slValid || !(volumeNum > 0)) return null;
    const priceDelta = Math.abs(currentPrice - slNum);
    const ticks = contractSpec.tickSize > 0 ? priceDelta / contractSpec.tickSize : 0;
    return ticks * contractSpec.tickValue * volumeNum;
  }, [useStopLoss, currentPrice, slNum, slValid, volumeNum, contractSpec]);

  const riskPercent = riskUsd != null && portfolio.balance > 0 ? (riskUsd / portfolio.balance) * 100 : null;

  const rewardUsd = useMemo(() => {
    if (!useTakeProfit || !currentPrice || !tpValid || !(volumeNum > 0)) return null;
    const priceDelta = Math.abs(tpNum - currentPrice);
    const ticks = contractSpec.tickSize > 0 ? priceDelta / contractSpec.tickSize : 0;
    return ticks * contractSpec.tickValue * volumeNum;
  }, [useTakeProfit, currentPrice, tpNum, tpValid, volumeNum, contractSpec]);

  const riskRewardRatio = riskUsd && rewardUsd && riskUsd > 0 ? rewardUsd / riskUsd : null;

  const marginEstimate = useMemo(() => {
    if (!currentPrice || !asset || !(volumeNum > 0)) return null;
    const notional = volumeNum * asset.lotSize * currentPrice;
    return asset.leverage > 0 ? notional / asset.leverage : notional;
  }, [currentPrice, asset, volumeNum]);

  const canSubmit =
    !submitting &&
    currentPrice != null &&
    volumeValid &&
    slValid &&
    tpValid &&
    (executionMode === 'DEMO' || brokerConfigured === true);

  async function handleSubmit() {
    if (!currentPrice || !asset) return;
    setSubmitting(true);
    try {
      if (executionMode === 'DEMO') {
        const result = openManualPosition({
          symbol,
          side: side === 'BUY' ? 'LONG' : 'SHORT',
          volume: volumeNum,
          entryPrice: currentPrice,
          stopLoss: useStopLoss ? slNum : undefined,
          takeProfit: useTakeProfit ? tpNum : undefined,
        });
        if (result.success) {
          toast.success(`${side === 'BUY' ? 'Compra' : 'Venda'} enviada`, {
            description: `${symbol} · ${volumeNum} lote(s) @ ${formatPrice(currentPrice, symbol)} (DEMO)`,
          });
          setStopLossPrice('');
          setTakeProfitPrice('');
        } else {
          toast.error('Ordem recusada', { description: result.error });
        }
      } else {
        const params = {
          symbol,
          volume: volumeNum,
          stopLoss: useStopLoss ? slNum : undefined,
          takeProfit: useTakeProfit ? tpNum : undefined,
          comment: 'Ordem manual (boleta)',
        };
        const result = side === 'BUY'
          ? await createMarketBuyOrder(params)
          : await createMarketSellOrder(params);
        if (result.success) {
          toast.success(`${side === 'BUY' ? 'Compra' : 'Venda'} executada`, {
            description: `${symbol} · ${volumeNum} lote(s) na corretora`,
          });
          setStopLossPrice('');
          setTakeProfitPrice('');
        } else {
          toast.error('Ordem recusada pela corretora', { description: result.error || result.message });
        }
      }
    } catch (err: any) {
      toast.error('Falha ao enviar ordem', { description: err?.message || 'Erro desconhecido' });
    } finally {
      setSubmitting(false);
    }
  }

  // Classes Tailwind precisam ser strings literais completas (JIT escaneia o
  // fonte estaticamente) — nunca interpolar o nome da cor em runtime.
  const cardClass = side === 'BUY'
    ? 'bg-gradient-to-br from-emerald-950/40 to-black/40 border-2 border-emerald-500/30 rounded-xl p-4 relative overflow-hidden group shadow-lg shadow-emerald-500/10 transition-colors duration-500'
    : 'bg-gradient-to-br from-red-950/40 to-black/40 border-2 border-red-500/30 rounded-xl p-4 relative overflow-hidden group shadow-lg shadow-red-500/10 transition-colors duration-500';
  const glowClass = side === 'BUY'
    ? 'absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none'
    : 'absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none';

  return (
    <div className={cardClass} data-testid="order-ticket">
      <div className={glowClass} />

      {/* Header */}
      <div className="flex items-center justify-between mb-3 relative z-10">
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Boleta de Ordem</p>
          <p className="text-sm font-black text-white tracking-tight">{symbol}</p>
        </div>
        <span
          className={`text-[9px] font-bold px-2 py-1 rounded-md border tracking-widest ${
            executionMode === 'LIVE'
              ? 'text-red-300 bg-red-500/10 border-red-400/30'
              : 'text-blue-300 bg-blue-500/10 border-blue-400/20'
          }`}
        >
          {executionMode}
        </span>
      </div>

      {/* Preço de referência */}
      <div className="bg-black/30 rounded-lg p-3 border border-white/5 mb-3 relative z-10 flex items-center justify-between">
        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Referência</span>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-lg font-black font-mono tracking-tight text-white">
            {currentPrice != null ? formatPrice(currentPrice, symbol) : '----.--'}
          </span>
        </div>
      </div>

      {/* Toggle BUY/SELL */}
      <div className="grid grid-cols-2 gap-2 mb-3 relative z-10">
        <button
          type="button"
          onClick={() => setSide('BUY')}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-black tracking-wide transition-all ${
            side === 'BUY'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30'
              : 'bg-white/5 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/10'
          }`}
        >
          <ArrowUpRight className="w-4 h-4" /> COMPRAR
        </button>
        <button
          type="button"
          onClick={() => setSide('SELL')}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-black tracking-wide transition-all ${
            side === 'SELL'
              ? 'bg-red-600 text-white shadow-md shadow-red-500/30'
              : 'bg-white/5 text-red-400 border border-red-500/20 hover:bg-red-500/10'
          }`}
        >
          <ArrowDownRight className="w-4 h-4" /> VENDER
        </button>
      </div>

      {/* Volume */}
      <div className="mb-3 relative z-10">
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Volume (lotes)</label>
          {asset && (
            <span className="text-[10px] text-slate-500 font-mono">
              mín. {asset.minLot} · máx. {asset.maxLot}
            </span>
          )}
        </div>
        <input
          type="text"
          inputMode="decimal"
          value={volume}
          onChange={(e) => setVolume(e.target.value)}
          className={`w-full h-9 rounded-md border bg-black/40 px-3 text-sm font-mono text-white outline-none focus:ring-2 ${
            volumeValid ? 'border-white/10 focus:ring-white/20' : 'border-red-500/60 focus:ring-red-500/30'
          }`}
        />
        {asset && (
          <div className="flex gap-1.5 mt-1.5">
            {[asset.minLot, asset.minLot * 5, asset.minLot * 10].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVolume(String(Number(v.toFixed(4))))}
                className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10"
              >
                {v.toFixed(2)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* SL / TP */}
      <div className="grid grid-cols-2 gap-2 mb-3 relative z-10">
        <div>
          <label className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">
            <input type="checkbox" checked={useStopLoss} onChange={(e) => setUseStopLoss(e.target.checked)} className="accent-red-500" />
            Stop Loss
          </label>
          <input
            type="text"
            inputMode="decimal"
            disabled={!useStopLoss}
            value={stopLossPrice}
            onChange={(e) => setStopLossPrice(e.target.value)}
            placeholder={currentPrice ? formatPrice(currentPrice, symbol) : '—'}
            className={`w-full h-8 rounded-md border bg-black/40 px-2 text-xs font-mono text-white outline-none disabled:opacity-40 focus:ring-2 ${
              slValid ? 'border-white/10 focus:ring-white/20' : 'border-red-500/60 focus:ring-red-500/30'
            }`}
          />
        </div>
        <div>
          <label className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">
            <input type="checkbox" checked={useTakeProfit} onChange={(e) => setUseTakeProfit(e.target.checked)} className="accent-emerald-500" />
            Take Profit
          </label>
          <input
            type="text"
            inputMode="decimal"
            disabled={!useTakeProfit}
            value={takeProfitPrice}
            onChange={(e) => setTakeProfitPrice(e.target.value)}
            placeholder={currentPrice ? formatPrice(currentPrice, symbol) : '—'}
            className={`w-full h-8 rounded-md border bg-black/40 px-2 text-xs font-mono text-white outline-none disabled:opacity-40 focus:ring-2 ${
              tpValid ? 'border-white/10 focus:ring-white/20' : 'border-emerald-500/60 focus:ring-emerald-500/30'
            }`}
          />
        </div>
      </div>

      {/* Risco / margem */}
      <div className="bg-black/30 rounded-lg p-3 border border-white/5 mb-3 relative z-10 space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-slate-400 font-mono">Risco (SL)</span>
          <span className={`text-xs font-bold font-mono ${riskUsd != null ? 'text-red-400' : 'text-slate-600'}`}>
            {riskUsd != null ? `$${riskUsd.toFixed(2)} (${riskPercent?.toFixed(1)}%)` : '—'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-slate-400 font-mono">Retorno (TP)</span>
          <span className={`text-xs font-bold font-mono ${rewardUsd != null ? 'text-emerald-400' : 'text-slate-600'}`}>
            {rewardUsd != null ? `$${rewardUsd.toFixed(2)}` : '—'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-slate-400 font-mono">Risco:Retorno</span>
          <span className="text-xs font-bold font-mono text-slate-300">
            {riskRewardRatio != null ? `1:${riskRewardRatio.toFixed(2)}` : '—'}
          </span>
        </div>
        <div className="h-px bg-white/5 my-1" />
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1"><Wallet className="w-3 h-3" /> Margem estimada</span>
          <span className="text-xs font-bold font-mono text-slate-300">
            {marginEstimate != null ? `$${marginEstimate.toFixed(2)}` : '—'}
          </span>
        </div>
      </div>

      {/* LIVE: gating + disclaimer */}
      {executionMode === 'LIVE' && brokerConfigured === false && (
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

      {/* Submit */}
      <button
        type="button"
        disabled={!canSubmit}
        onClick={handleSubmit}
        className={`w-full h-11 rounded-lg font-black tracking-wide text-sm flex items-center justify-center gap-2 transition-all relative z-10 ${
          side === 'BUY'
            ? 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/30'
            : 'bg-red-600 hover:bg-red-500 shadow-lg shadow-red-500/30'
        } text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none`}
      >
        {submitting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>{side === 'BUY' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}</>
        )}
        {submitting ? 'Enviando…' : `${side === 'BUY' ? 'COMPRAR' : 'VENDER'} ${symbol}`}
      </button>
    </div>
  );
}
