/**
 * Viabilidade de Execução — leitura em tempo real do MESMO gate de custo
 * (`CostViabilityGate.ts`) que o motor real (`runTradingCycle.ts`) aplica
 * antes de qualquer trade, exposta ao usuário pro ativo que ele está vendo
 * no Dashboard agora.
 *
 * Substitui o antigo card "IA Preditiva" (2026-08-21), que era um stub sem
 * dado nenhum ("🚀 Em breve"). Não é uma "previsão" no sentido de prever
 * direção — é aritmética honesta sobre um dado real (custo estimado vs.
 * movimento até o alvo), a mesma disciplina do resto do projeto: nunca
 * promete edge, só mostra se o custo de operar agora devora o resultado
 * esperado. Zero fetch novo: reaproveita `dashboardScoreResult` (mesmo
 * Market Score já calculado pelo Dashboard) e `getLastKnownRealPrice`
 * (mesma fonte de preço já usada por `RiskThermometer.tsx`) — nenhuma
 * chamada adicional à conta MetaAPI compartilhada.
 */

import React, { useMemo } from 'react';
import { Gauge, TrendingDown, TrendingUp, CircleAlert } from 'lucide-react';
import { useTradingContext } from '../../contexts/TradingContext';
import type { MarketScoreResult } from '@/app/services/MarketScoreEngine';
import { getLastKnownRealPrice } from '@/app/services/RealMarketDataService';
import { getPointValue } from '@/app/services/strategy/TradeSizing';
import { resolveCostAssetClass } from '@/app/services/risk/CostAssetClass';
import { estimateCostPercent } from '../../../../research/CostModel';
import { evaluateCostViability, type CostViabilityClassification } from '@/app/services/risk/CostViabilityGate';
import { resolveAtrTargets, STOP_ATR_MULTIPLIER, RISK_REWARD_MULTIPLE } from '@/app/services/strategy/runTradingCycle';

const CLASSIFICATION_STYLE: Record<CostViabilityClassification, { label: string; color: string; bg: string; border: string; Icon: typeof TrendingUp }> = {
  VIAVEL: { label: 'Viável', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', Icon: TrendingUp },
  FRONTEIRA: { label: 'Fronteira', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', Icon: CircleAlert },
  INVIAVEL: { label: 'Inviável', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', Icon: TrendingDown },
};

export const AIPredictiveCard: React.FC = () => {
  const { dashboardActiveSymbol, dashboardScoreResult } = useTradingContext();
  const symbol = dashboardActiveSymbol || 'BTCUSD';
  const scoreResult = dashboardScoreResult as MarketScoreResult | null;

  const hasRealScore = !!scoreResult && (scoreResult.provenance === 'real' || scoreResult.provenance === 'stale') && scoreResult.symbol === symbol;
  const atr = hasRealScore ? scoreResult!.indicators.atr : null;

  const price = getLastKnownRealPrice(symbol)?.price
    ?? getLastKnownRealPrice(symbol.replace(/USDT$/, 'USD'))?.price
    ?? 0;

  const viability = useMemo(() => {
    if (!atr || atr <= 0 || !price || price <= 0) return null;
    const pointValue = getPointValue(symbol);
    const { assetClass, source: costClassSource } = resolveCostAssetClass(symbol);
    // 'TREND' — sem teto de SCALP, mesmo alvo "padrão" (1,5×ATR × R:R 2,5)
    // que o motor usa fora do modo SCALP, ver `resolveAtrTargets`.
    const targets = resolveAtrTargets(atr, pointValue, 'TREND');
    const targetDistancePercent = (targets.targetPoints * pointValue / price) * 100;
    const costPercent = estimateCostPercent(assetClass, price, pointValue) * 2 * 100; // round-trip
    const result = evaluateCostViability(costPercent, targetDistancePercent);
    return { ...result, assetClass, costClassSource, targetDistancePercent, costPercent };
  }, [symbol, atr, price]);

  const style = viability ? CLASSIFICATION_STYLE[viability.classification] : null;
  const StyleIcon = style?.Icon ?? Gauge;

  return (
    <div className="h-full flex flex-col">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
            <Gauge className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Viabilidade de Execução — {symbol}</h2>
            <p className="text-sm text-slate-400">Mesmo gate de custo que o motor aplica antes de abrir posição — não é previsão de direção</p>
          </div>
        </div>
      </div>

      {/* CONTEÚDO */}
      {!viability ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Gauge className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-300 mb-2">Sem dado real suficiente ainda</h3>
            <p className="text-sm text-slate-500 max-w-md">
              Aguardando ATR/preço real de {symbol} (mesmo cálculo do Market Score) — nenhum número é fabricado enquanto isso.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-6">
          <div className={`rounded-xl border p-5 flex items-center justify-between ${style!.bg} ${style!.border}`}>
            <div className="flex items-center gap-3">
              <StyleIcon className={`w-8 h-8 ${style!.color}`} />
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">Classificação do gate de custo</p>
                <p className={`text-3xl font-bold tracking-tight ${style!.color}`}>{style!.label}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">Custo / Movimento até o alvo</p>
              <p className={`text-2xl font-mono font-bold ${style!.color}`}>{(viability.costAsPercentOfMovement * 100).toFixed(1)}%</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white/5 rounded-lg px-3 py-2.5">
              <p className="text-[9px] text-slate-500 uppercase tracking-wide">Custo round-trip est.</p>
              <p className="text-sm font-mono font-bold text-slate-200">{viability.costPercent.toFixed(3)}%</p>
            </div>
            <div className="bg-white/5 rounded-lg px-3 py-2.5">
              <p className="text-[9px] text-slate-500 uppercase tracking-wide">Distância até alvo ({STOP_ATR_MULTIPLIER}×ATR × {RISK_REWARD_MULTIPLE})</p>
              <p className="text-sm font-mono font-bold text-slate-200">{viability.targetDistancePercent.toFixed(3)}%</p>
            </div>
            <div className="bg-white/5 rounded-lg px-3 py-2.5">
              <p className="text-[9px] text-slate-500 uppercase tracking-wide">Classe de custo</p>
              <p className="text-sm font-mono font-bold text-slate-200">{viability.assetClass}{viability.costClassSource === 'FALLBACK' ? ' (aprox.)' : ''}</p>
            </div>
            <div className="bg-white/5 rounded-lg px-3 py-2.5">
              <p className="text-[9px] text-slate-500 uppercase tracking-wide">ATR atual</p>
              <p className="text-sm font-mono font-bold text-slate-200">{atr!.toFixed(atr! < 1 ? 5 : 2)}</p>
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            {viability.reason} — mesmo motivo que o motor grava em <code className="text-slate-400">ai_decisions.veto_stage = COST_GATE</code> quando recusa um trade por custo, aplicado aqui só como leitura, sem decidir nada.
          </p>
        </div>
      )}
    </div>
  );
};
