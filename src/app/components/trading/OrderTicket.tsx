import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ShieldAlert, Loader2, Link2Off, Settings2, X, Zap, Target, AlertTriangle, Layers } from 'lucide-react';
import { toast } from 'sonner';

import { useTradingContext } from '../../contexts/TradingContext';
import { getAssetBySymbol } from '../../config/assetDatabase';
import { getContractSpec } from '../../../config/contractSpecs';
import { formatPrice } from '../../utils/priceFormatter';
import {
  createMarketBuyOrder,
  createMarketSellOrder,
  createLimitBuyOrder,
  createLimitSellOrder,
  createStopBuyOrder,
  createStopSellOrder,
  createStopLimitBuyOrder,
  createStopLimitSellOrder,
  getBrokerCredentialsStatus,
} from '../../services/BrokerClient';
import { LIVE_ALERT_DISCLAIMER } from '../../modules/liveAlertStage/useLiveAlertStage';

type Side = 'BUY' | 'SELL';
type OrderType = 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';

interface OrderTicketProps {
  symbol: string;
  currentPrice: number | null;
}

const ORDER_TYPE_TABS: { type: OrderType; label: string; icon: typeof Zap }[] = [
  { type: 'MARKET', label: 'Execução de Mercado', icon: Zap },
  { type: 'LIMIT', label: 'Ordem Limit', icon: Target },
  { type: 'STOP', label: 'Ordem Stop', icon: AlertTriangle },
  { type: 'STOP_LIMIT', label: 'Ordem Stop Limit', icon: Layers },
];

/**
 * Boleta de ordem, ancorada dentro do gráfico (canto superior direito, estilo
 * "one-click trading" de terminal profissional — MT5/cTrader). Recolhida:
 * barra compacta SELL/BUY a mercado com stepper de volume. Expandida: ficha
 * completa com abas de tipo de ordem (Execução de Mercado / Limit / Stop /
 * Stop Limit), mesmo vocabulário do "New Order" do MT5.
 *
 * DEMO: mercado e limit/stop são reais (posição/ordem virtual persistida,
 * monitorada por preço real na tela — ver checkPendingOrderTriggers em
 * useApexLogic.ts). Stop Limit não tem equivalente DEMO (exigiria simular uma
 * segunda perna de preço-limite sem dado de profundidade real — decisão de
 * não fabricar) — só funciona em LIVE, onde é a própria MetaAPI que resolve.
 * LIVE: todos os 4 tipos são reais via BrokerClient/MetaAPI, mesma rota que
 * já valida risco fail-closed no servidor.
 */
export function OrderTicket({ symbol, currentPrice }: OrderTicketProps) {
  const { executionMode, portfolio, openManualPosition, openManualPendingOrder } = useTradingContext();

  const asset = useMemo(() => getAssetBySymbol(symbol), [symbol]);
  const contractSpec = useMemo(() => getContractSpec(symbol), [symbol]);

  const [expanded, setExpanded] = useState(false);
  const [orderType, setOrderType] = useState<OrderType>('MARKET');
  const [volume, setVolume] = useState<number>(asset ? asset.minLot : 0.01);

  // 🐛 FIX: `volume` só era inicializado uma vez, no mount — trocar de ativo no
  // gráfico (ex: BTCUSD minLot 0.01 → SPX500 minLot 0.1) deixava o volume fora
  // do range do NOVO ativo sem nenhum aviso. `volumeValid` virava false,
  // `canTrade` virava false, e o clique em COMPRAR/VENDER simplesmente não
  // fazia nada — sem toast, sem erro, porque o botão nem chegava a disparar
  // o handler (disabled). Resincroniza sempre que o ativo muda.
  React.useEffect(() => {
    if (!asset) return;
    setVolume((v) => Math.min(asset.maxLot, Math.max(asset.minLot, v)));
  }, [asset]);
  const [triggerPrice, setTriggerPrice] = useState('');
  const [stopLimitPrice, setStopLimitPrice] = useState('');
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
  const triggerNum = Number(triggerPrice.replace(',', '.'));
  const stopLimitNum = Number(stopLimitPrice.replace(',', '.'));

  const isPending = orderType === 'LIMIT' || orderType === 'STOP';
  const isStopLimit = orderType === 'STOP_LIMIT';
  const demoStopLimitUnsupported = isStopLimit && executionMode === 'DEMO';

  function directionValid(side: Side): { ok: boolean; error?: string } {
    if (slSet) {
      const bad = side === 'BUY' ? slNum >= (currentPrice ?? Infinity) : slNum <= (currentPrice ?? 0);
      if (bad) return { ok: false, error: `Perda máxima inválida para ${side === 'BUY' ? 'compra' : 'venda'}` };
    }
    if (tpSet) {
      const bad = side === 'BUY' ? tpNum <= (currentPrice ?? 0) : tpNum >= (currentPrice ?? Infinity);
      if (bad) return { ok: false, error: `Lucro máximo inválido para ${side === 'BUY' ? 'compra' : 'venda'}` };
    }
    if ((isPending || isStopLimit) && !(triggerNum > 0)) {
      return { ok: false, error: 'Informe o preço de gatilho da ordem' };
    }
    if (isPending && currentPrice != null) {
      const isBuy = side === 'BUY';
      const aboveMarket = triggerNum > currentPrice;
      const ok = orderType === 'LIMIT' ? (isBuy ? !aboveMarket : aboveMarket) : (isBuy ? aboveMarket : !aboveMarket);
      if (!ok) {
        return {
          ok: false,
          error: `${orderType === 'LIMIT' ? 'Limit' : 'Stop'} de ${isBuy ? 'compra' : 'venda'} precisa estar ${
            (orderType === 'LIMIT') === isBuy ? 'abaixo' : 'acima'
          } do preço atual`,
        };
      }
    }
    if (isStopLimit && !(stopLimitNum > 0)) {
      return { ok: false, error: 'Informe o preço-limite da ordem stop limit' };
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
  const canTrade = currentPrice != null && volumeValid && !submitting && !brokerBlocked && !demoStopLimitUnsupported;

  // Motivo visível do bloqueio — nunca mais um botão desabilitado sem explicação
  // (foi exatamente isso que escondeu o bug do volume dessincronizado ao trocar
  // de ativo: clique não fazia nada, sem toast, sem pista nenhuma na tela).
  const blockedReason = currentPrice == null
    ? 'Aguardando preço do ativo…'
    : !volumeValid
      ? `Volume fora do intervalo permitido (${asset ? `${asset.minLot}–${asset.maxLot}` : '> 0'})`
      : brokerBlocked
        ? 'Conecte uma corretora para operar em LIVE'
        : demoStopLimitUnsupported
          ? 'Stop Limit indisponível em DEMO'
          : null;

  function adjustVolume(delta: number) {
    if (!asset) return;
    setVolume((v) => {
      const next = Number((v + delta).toFixed(8));
      return Math.min(asset.maxLot, Math.max(asset.minLot, next));
    });
  }

  function resetOptionalFields() {
    setStopLoss('0.00');
    setTakeProfit('0.00');
    setTriggerPrice('');
    setStopLimitPrice('');
  }

  async function executeOrder(side: Side) {
    // Log explícito de diagnóstico — fica permanente (não é debug temporário):
    // é a única forma de saber, olhando o console, se o clique realmente
    // chegou até aqui e por que parou, sem precisar reproduzir o bug de novo.
    console.error('🟢[OrderTicket] executeOrder chamado', { side, symbol, orderType, executionMode, currentPrice, volume, canTrade, asset: !!asset });
    if (!currentPrice || !asset || !canTrade) {
      console.warn('[OrderTicket] executeOrder abortado — guarda inicial falhou', { currentPrice, asset: !!asset, canTrade, blockedReason });
      return;
    }
    const direction = directionValid(side);
    if (!direction.ok) {
      console.warn('[OrderTicket] executeOrder recusado por direção inválida', direction.error);
      toast.error('Ordem recusada', { description: direction.error });
      return;
    }

    setSubmitting(side);
    try {
      // ── Execução a mercado ──
      if (orderType === 'MARKET') {
        if (executionMode === 'DEMO') {
          const result = openManualPosition({
            symbol,
            side: side === 'BUY' ? 'LONG' : 'SHORT',
            volume,
            entryPrice: currentPrice,
            stopLoss: slSet ? slNum : undefined,
            takeProfit: tpSet ? tpNum : undefined,
          });
          console.error('🟢[OrderTicket] openManualPosition retornou', result);
          if (result.success) {
            toast.success(`${side === 'BUY' ? 'Compra' : 'Venda'} enviada`, {
              description: `${symbol} · ${volume} lote(s) @ ${formatPrice(currentPrice, symbol)} (DEMO)`,
            });
            resetOptionalFields();
          } else {
            toast.error('Ordem recusada', { description: result.error });
          }
        } else {
          const params = { symbol, volume, stopLoss: slSet ? slNum : undefined, takeProfit: tpSet ? tpNum : undefined, comment: comment || 'Ordem manual (boleta)' };
          const result = side === 'BUY' ? await createMarketBuyOrder(params) : await createMarketSellOrder(params);
          if (result.success) {
            toast.success(`${side === 'BUY' ? 'Compra' : 'Venda'} executada`, { description: `${symbol} · ${volume} lote(s) na corretora` });
            resetOptionalFields();
          } else {
            toast.error('Ordem recusada pela corretora', { description: result.error || result.message });
          }
        }
        return;
      }

      // ── Ordem pendente: Limit / Stop ──
      if (isPending) {
        if (executionMode === 'DEMO') {
          const result = openManualPendingOrder({
            symbol,
            side: side === 'BUY' ? 'LONG' : 'SHORT',
            orderType: orderType as 'LIMIT' | 'STOP',
            volume,
            triggerPrice: triggerNum,
            currentPrice,
            stopLoss: slSet ? slNum : undefined,
            takeProfit: tpSet ? tpNum : undefined,
          });
          if (result.success) {
            toast.success(`Ordem ${orderType.toLowerCase()} criada`, {
              description: `${symbol} · ${side === 'BUY' ? 'compra' : 'venda'} @ ${formatPrice(triggerNum, symbol)} (DEMO, aguardando gatilho)`,
            });
            resetOptionalFields();
          } else {
            toast.error('Ordem recusada', { description: result.error });
          }
        } else {
          const params = { symbol, volume, price: triggerNum, stopLoss: slSet ? slNum : undefined, takeProfit: tpSet ? tpNum : undefined, comment: comment || 'Ordem manual (boleta)' };
          const result = orderType === 'LIMIT'
            ? (side === 'BUY' ? await createLimitBuyOrder(params) : await createLimitSellOrder(params))
            : (side === 'BUY' ? await createStopBuyOrder(params) : await createStopSellOrder(params));
          if (result.success) {
            toast.success(`Ordem ${orderType.toLowerCase()} enviada`, { description: `${symbol} · ${side === 'BUY' ? 'compra' : 'venda'} @ ${formatPrice(triggerNum, symbol)} na corretora` });
            resetOptionalFields();
          } else {
            toast.error('Ordem recusada pela corretora', { description: result.error || result.message });
          }
        }
        return;
      }

      // ── Stop Limit — só LIVE (ver nota da doc do componente) ──
      if (isStopLimit) {
        const params = { symbol, volume, price: triggerNum, stopLimitPrice: stopLimitNum, stopLoss: slSet ? slNum : undefined, takeProfit: tpSet ? tpNum : undefined, comment: comment || 'Ordem manual (boleta)' };
        const result = side === 'BUY' ? await createStopLimitBuyOrder(params) : await createStopLimitSellOrder(params);
        if (result.success) {
          toast.success('Ordem stop limit enviada', { description: `${symbol} · ${side === 'BUY' ? 'compra' : 'venda'} na corretora` });
          resetOptionalFields();
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
              title="Mais opções (Limit/Stop/SL/TP)"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 px-2.5 py-1.5 border-b border-white/5">
          <button type="button" onClick={() => adjustVolume(-step)} className="w-5 h-5 flex items-center justify-center rounded bg-white/5 text-slate-300 hover:bg-white/10">
            <ChevronDown className="w-3 h-3" />
          </button>
          <span className="text-xs font-mono text-white w-14 text-center">{volume.toFixed(2)}</span>
          <button type="button" onClick={() => adjustVolume(step)} className="w-5 h-5 flex items-center justify-center rounded bg-white/5 text-slate-300 hover:bg-white/10">
            <ChevronUp className="w-3 h-3" />
          </button>
          <span className="text-[9px] text-slate-500 font-mono">lotes</span>
        </div>

        <div className="grid grid-cols-2">
          <button
            type="button"
            disabled={!canTrade}
            onClick={() => executeOrder('SELL')}
            className="flex flex-col items-center justify-center gap-0.5 px-4 py-2.5 bg-red-600/90 hover:bg-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed border-r border-black/30"
          >
            <span className="text-[9px] font-bold text-red-100 tracking-widest">SELL</span>
            {submitting === 'SELL' ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <span className="text-lg font-black font-mono text-white leading-none">{priceLabel}</span>}
          </button>
          <button
            type="button"
            disabled={!canTrade}
            onClick={() => executeOrder('BUY')}
            className="flex flex-col items-center justify-center gap-0.5 px-4 py-2.5 bg-emerald-600/90 hover:bg-emerald-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="text-[9px] font-bold text-emerald-100 tracking-widest">BUY</span>
            {submitting === 'BUY' ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <span className="text-lg font-black font-mono text-white leading-none">{priceLabel}</span>}
          </button>
        </div>

        {blockedReason && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 text-[9px] text-amber-300 bg-amber-500/10 border-t border-amber-500/20">
            <Link2Off className="w-3 h-3 shrink-0" /> {blockedReason}
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────── Modo expandido ───────────────────────────
  const sideLabels: Record<OrderType, { sell: string; buy: string }> = {
    MARKET: { sell: 'Sell a mercado', buy: 'Buy a mercado' },
    LIMIT: { sell: 'Vender Limit', buy: 'Comprar Limit' },
    STOP: { sell: 'Vender Stop', buy: 'Comprar Stop' },
    STOP_LIMIT: { sell: 'Vender Stop Limit', buy: 'Comprar Stop Limit' },
  };

  return (
    <div className="flex bg-gradient-to-br from-neutral-950 to-black border-2 border-white/10 rounded-xl overflow-hidden shadow-2xl" data-testid="order-ticket-expanded">
      {/* Navegação de tipo de ordem — mesmo padrão da lista lateral do MT5 */}
      <div className="w-[168px] border-r border-white/10 bg-black/40 py-2 shrink-0">
        {ORDER_TYPE_TABS.map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            type="button"
            onClick={() => setOrderType(type)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold transition-colors ${
              orderType === type ? 'bg-white/10 text-white border-l-2 border-emerald-500' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border-l-2 border-transparent'
            }`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            {label}
          </button>
        ))}
      </div>

      {/* Ficha */}
      <div className="w-[300px] p-4 relative">
        <div className="flex items-center justify-between mb-3 relative z-10">
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">{ORDER_TYPE_TABS.find(t => t.type === orderType)?.label}</p>
            <p className="text-sm font-black text-white tracking-tight">{symbol}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`text-[9px] font-bold px-2 py-1 rounded-md border tracking-widest ${executionMode === 'LIVE' ? 'text-red-300 bg-red-500/10 border-red-400/30' : 'text-blue-300 bg-blue-500/10 border-blue-400/20'}`}>
              {executionMode}
            </span>
            <button type="button" onClick={() => setExpanded(false)} className="w-6 h-6 flex items-center justify-center rounded-md bg-white/5 text-slate-400 hover:text-white hover:bg-white/10" title="Recolher">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="bg-black/30 rounded-lg p-3 border border-white/5 mb-3 relative z-10 flex items-center justify-between">
          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Referência</span>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-lg font-black font-mono tracking-tight text-white">{priceLabel}</span>
          </div>
        </div>

        <div className="mb-3 relative z-10">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Volume</label>
            {asset && <span className="text-[10px] text-slate-500 font-mono">mín. {asset.minLot} · máx. {asset.maxLot}</span>}
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => adjustVolume(-step)} className="w-9 h-9 flex items-center justify-center rounded-md bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10">
              <ChevronDown className="w-4 h-4" />
            </button>
            <input
              type="text"
              inputMode="decimal"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value.replace(',', '.')) || 0)}
              className={`flex-1 h-9 rounded-md border bg-black/40 px-3 text-sm font-mono text-white text-center outline-none focus:ring-2 ${volumeValid ? 'border-white/10 focus:ring-white/20' : 'border-red-500/60 focus:ring-red-500/30'}`}
            />
            <button type="button" onClick={() => adjustVolume(step)} className="w-9 h-9 flex items-center justify-center rounded-md bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10">
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
        </div>

        {(isPending || isStopLimit) && (
          <div className="grid grid-cols-2 gap-2 mb-3 relative z-10">
            <div>
              <label className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1 block">Preço {isPending ? `(${orderType === 'LIMIT' ? 'limit' : 'stop'})` : '(stop)'}</label>
              <input
                type="text"
                inputMode="decimal"
                value={triggerPrice}
                onChange={(e) => setTriggerPrice(e.target.value)}
                placeholder={priceLabel}
                className="w-full h-8 rounded-md border border-white/10 bg-black/40 px-2 text-xs font-mono text-white outline-none placeholder:text-slate-600 focus:ring-2 focus:ring-white/20"
              />
            </div>
            {isStopLimit && (
              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1 block">Preço limite</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={stopLimitPrice}
                  onChange={(e) => setStopLimitPrice(e.target.value)}
                  placeholder={priceLabel}
                  className="w-full h-8 rounded-md border border-white/10 bg-black/40 px-2 text-xs font-mono text-white outline-none placeholder:text-slate-600 focus:ring-2 focus:ring-white/20"
                />
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mb-3 relative z-10">
          <div>
            <label className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1 block">Perda máxima</label>
            <input type="text" inputMode="decimal" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} className="w-full h-8 rounded-md border border-white/10 bg-black/40 px-2 text-xs font-mono text-white outline-none focus:ring-2 focus:ring-white/20" />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1 block">Lucro máximo</label>
            <input type="text" inputMode="decimal" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} className="w-full h-8 rounded-md border border-white/10 bg-black/40 px-2 text-xs font-mono text-white outline-none focus:ring-2 focus:ring-white/20" />
          </div>
        </div>

        <div className="mb-3 relative z-10">
          <label className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1 block">Comentário</label>
          <input type="text" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="opcional" className="w-full h-8 rounded-md border border-white/10 bg-black/40 px-2 text-xs text-white outline-none placeholder:text-slate-600 focus:ring-2 focus:ring-white/20" />
        </div>

        <div className="bg-black/30 rounded-lg p-3 border border-white/5 mb-3 relative z-10 space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-400 font-mono">Risco (perda máx.)</span>
            <span className={`text-xs font-bold font-mono ${riskUsd != null ? 'text-red-400' : 'text-slate-600'}`}>{riskUsd != null ? `$${riskUsd.toFixed(2)} (${riskPercent?.toFixed(1)}%)` : '—'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-400 font-mono">Retorno (lucro máx.)</span>
            <span className={`text-xs font-bold font-mono ${rewardUsd != null ? 'text-emerald-400' : 'text-slate-600'}`}>{rewardUsd != null ? `$${rewardUsd.toFixed(2)}` : '—'}</span>
          </div>
          <div className="h-px bg-white/5 my-1" />
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-400 font-mono">Margem estimada</span>
            <span className="text-xs font-bold font-mono text-slate-300">{marginEstimate != null ? `$${marginEstimate.toFixed(2)}` : '—'}</span>
          </div>
        </div>

        {!volumeValid && (
          <div className="mb-3 flex items-start gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 relative z-10">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{blockedReason}</span>
          </div>
        )}
        {demoStopLimitUnsupported && (
          <div className="mb-3 flex items-start gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 relative z-10">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Stop Limit não existe em modo DEMO (exigiria simular preço de execução sem dado real de profundidade). Disponível só em LIVE, onde a corretora resolve de verdade.</span>
          </div>
        )}
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

        <div className="grid grid-cols-2 gap-2 relative z-10">
          <button type="button" disabled={!canTrade} onClick={() => executeOrder('SELL')} className="h-11 rounded-lg font-black tracking-wide text-xs flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 shadow-lg shadow-red-500/30 text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-all px-1">
            {submitting === 'SELL' ? <Loader2 className="w-4 h-4 animate-spin" /> : sideLabels[orderType].sell}
          </button>
          <button type="button" disabled={!canTrade} onClick={() => executeOrder('BUY')} className="h-11 rounded-lg font-black tracking-wide text-xs flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/30 text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-all px-1">
            {submitting === 'BUY' ? <Loader2 className="w-4 h-4 animate-spin" /> : sideLabels[orderType].buy}
          </button>
        </div>
      </div>
    </div>
  );
}
