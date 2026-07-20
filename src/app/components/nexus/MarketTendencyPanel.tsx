import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Activity,
  BarChart3,
  Target,
  BookOpen,
  Building2,
  Zap,
} from 'lucide-react';
import type { MarketScoreResult } from '@/app/services/MarketScoreEngine';

interface MarketTendencyPanelProps {
  symbol: string;
  scoreResult: MarketScoreResult | null;
}

/**
 * Breakdown por fonte do Market Score — TODO campo aqui vem do
 * MarketScoreEngine.ts (o mesmo motor real que já alimenta o Dashboard),
 * nunca de um valor sorteado. Fontes sem dado real disponível (Fluxo
 * Institucional, hoje) aparecem marcadas como "em construção", nunca com
 * número fabricado — mesma regra anti-mock do resto do projeto.
 * Substitui o antigo MarketTendencyEngine.ts (100% Math.random(), deletado
 * em 2026-07-19).
 */
export const MarketTendencyPanel = React.memo(function MarketTendencyPanel({
  symbol,
  scoreResult,
}: MarketTendencyPanelProps) {
  const [expandedSource, setExpandedSource] = useState<string | null>(null);

  if (!scoreResult || scoreResult.symbol !== symbol) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0a0a0a] rounded-xl border border-white/10 p-8">
        <div className="text-center space-y-3">
          <Activity className="w-8 h-8 text-cyan-400 animate-pulse mx-auto" />
          <p className="text-sm text-slate-400">Calculando fatores reais de mercado...</p>
        </div>
      </div>
    );
  }

  const isReal = scoreResult.provenance === 'real' || scoreResult.provenance === 'stale';
  const { factors, indicators, microstructure } = scoreResult;

  const directionConfig = {
    COMPRADOR: {
      icon: TrendingUp,
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
      textColor: 'text-green-400',
      label: 'PRESSÃO COMPRADORA',
    },
    VENDEDOR: {
      icon: TrendingDown,
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30',
      textColor: 'text-red-400',
      label: 'PRESSÃO VENDEDORA',
    },
    LATERAL: {
      icon: Minus,
      bgColor: 'bg-slate-500/10',
      borderColor: 'border-slate-500/30',
      textColor: 'text-slate-400',
      label: 'LATERAL',
    },
  } as const;

  const config = directionConfig[scoreResult.classification];
  const Icon = config.icon;
  const scoreDisplay = (scoreResult.score - 50) * 2; // reusa a escala visual -100..+100 do score 1..99

  return (
    <div className="bg-[#0a0a0a] rounded-xl border border-white/10 overflow-hidden">
      {/* HEADER */}
      <div className={`relative px-6 py-5 bg-gradient-to-br ${config.bgColor} border-b ${config.borderColor}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${config.bgColor} border ${config.borderColor}`}>
              <Icon className={`w-6 h-6 ${config.textColor}`} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-bold text-white uppercase tracking-wider">{config.label}</h3>
                <span className={`text-2xl font-bold ${config.textColor}`}>
                  {scoreDisplay > 0 ? '+' : ''}{scoreDisplay.toFixed(1)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Confiança: {isReal ? scoreResult.confidence.toFixed(0) : 0}%</span>
                <span>•</span>
                <span>{symbol}</span>
                <span>•</span>
                <span>{scoreResult.timeframe}</span>
                {!isReal && (
                  <>
                    <span>•</span>
                    <span className="text-yellow-500">dado indisponível no momento</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-300 leading-relaxed">{scoreResult.insight}</p>
      </div>

      {/* BREAKDOWN DAS FONTES */}
      <div className="p-6 space-y-3">
        <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-1">
          Análise Detalhada por Fonte
        </h4>
        <p className="text-[11px] text-slate-500 mb-3">
          Todas as fontes abaixo vêm do motor real (candles ao vivo) — nenhum valor sorteado.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <SourceCard
            icon={BarChart3}
            title="Tendência"
            score={factors.trend * 100}
            weightLabel="40%"
            color="blue"
            isExpanded={expandedSource === 'trend'}
            onToggle={() => setExpandedSource(expandedSource === 'trend' ? null : 'trend')}
          >
            <Row label="EMA9" value={fmt(indicators.ema9)} />
            <Row label="SMA20" value={fmt(indicators.sma20)} />
            <Row label="SMA200" value={fmt(indicators.sma200)} />
            <Row label="ADX (força)" value={indicators.adx != null ? indicators.adx.toFixed(1) : '—'} />
            <Row label="Regime" value={scoreResult.regime} highlight />
          </SourceCard>

          <SourceCard
            icon={Zap}
            title="Momentum"
            score={factors.momentum * 100}
            weightLabel="25%"
            color="yellow"
            isExpanded={expandedSource === 'momentum'}
            onToggle={() => setExpandedSource(expandedSource === 'momentum' ? null : 'momentum')}
          >
            <Row label="RSI" value={indicators.rsi != null ? indicators.rsi.toFixed(1) : '—'} />
            <Row label="Estocástico K/D" value={`${fmt1(indicators.stochK)} / ${fmt1(indicators.stochD)}`} />
            <Row label="MACD histograma" value={indicators.macdHistogram != null ? indicators.macdHistogram.toFixed(4) : '—'} />
          </SourceCard>

          <SourceCard
            icon={Target}
            title="Estrutura / Fibonacci"
            score={factors.structure * 100}
            weightLabel="20%"
            color="cyan"
            isExpanded={expandedSource === 'structure'}
            onToggle={() => setExpandedSource(expandedSource === 'structure' ? null : 'structure')}
          >
            <Row
              label="Posição no swing"
              value={indicators.fibPosition != null ? `${(indicators.fibPosition * 100).toFixed(0)}% (0=fundo, 100=topo)` : '—'}
            />
            <Row label="Nível Fib mais próximo" value={indicators.fibNearestLevel != null ? indicators.fibNearestLevel.toFixed(3) : '—'} />
          </SourceCard>

          <SourceCard
            icon={Activity}
            title="Volume"
            score={factors.volume * 100}
            weightLabel="15%"
            color="purple"
            isExpanded={expandedSource === 'volume'}
            onToggle={() => setExpandedSource(expandedSource === 'volume' ? null : 'volume')}
          >
            <Row
              label="Volume vs média"
              value={indicators.volumeRatio != null ? `${indicators.volumeRatio.toFixed(2)}x` : '—'}
            />
          </SourceCard>

          <SourceCard
            icon={BookOpen}
            title="Fluxo de Ordens (Order Book)"
            score={microstructure ? microstructure.imbalance.imbalance : null}
            weightLabel="contexto"
            color="indigo"
            isExpanded={expandedSource === 'orderbook'}
            onToggle={() => setExpandedSource(expandedSource === 'orderbook' ? null : 'orderbook')}
            unavailableNote={microstructure ? undefined : 'Disponível só para criptomoedas (Binance) — este ativo não tem order book público.'}
          >
            {microstructure && (
              <>
                <Row label="Volume de compra (±0,5%)" value={microstructure.imbalance.bidVolume.toFixed(2)} />
                <Row label="Volume de venda (±0,5%)" value={microstructure.imbalance.askVolume.toFixed(2)} />
                <Row
                  label="Desequilíbrio"
                  value={`${microstructure.imbalance.imbalance > 0 ? '+' : ''}${microstructure.imbalance.imbalance.toFixed(1)}%`}
                  highlight
                />
              </>
            )}
          </SourceCard>

          <SourceCard
            icon={Building2}
            title="Fluxo Institucional / Posicionamento"
            score={null}
            weightLabel="em construção"
            color="emerald"
            isExpanded={expandedSource === 'institutional'}
            onToggle={() => setExpandedSource(expandedSource === 'institutional' ? null : 'institutional')}
            unavailableNote="Ainda não implementado com dado real. Roadmap: COT Report (CFTC, semanal, forex/commodities) + whale trades via stream da Binance (cripto)."
          />
        </div>
      </div>
    </div>
  );
});

function fmt(v: number | null): string {
  return v != null ? v.toFixed(v < 10 ? 5 : 2) : '—';
}
function fmt1(v: number | null): string {
  return v != null ? v.toFixed(1) : '—';
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-slate-400">{label}:</span>
      <span className={highlight ? 'text-white font-bold' : 'text-white font-mono'}>{value}</span>
    </div>
  );
}

// ============================================
// SOURCE CARD COMPONENT
// ============================================

interface SourceCardProps {
  icon: React.ElementType;
  title: string;
  score: number | null; // null = sem dado real disponível
  weightLabel: string;
  color: string;
  isExpanded: boolean;
  onToggle: () => void;
  unavailableNote?: string;
  children?: React.ReactNode;
}

function SourceCard({
  icon: Icon,
  title,
  score,
  weightLabel,
  color,
  isExpanded,
  onToggle,
  unavailableNote,
  children,
}: SourceCardProps) {
  const colorClasses: Record<string, string> = {
    purple: 'from-purple-500/10 to-purple-500/5 border-purple-500/30 text-purple-400',
    cyan: 'from-cyan-500/10 to-cyan-500/5 border-cyan-500/30 text-cyan-400',
    blue: 'from-blue-500/10 to-blue-500/5 border-blue-500/30 text-blue-400',
    yellow: 'from-yellow-500/10 to-yellow-500/5 border-yellow-500/30 text-yellow-400',
    indigo: 'from-indigo-500/10 to-indigo-500/5 border-indigo-500/30 text-indigo-400',
    emerald: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/30 text-emerald-400',
  };
  const classes = colorClasses[color] || colorClasses.cyan;

  return (
    <div className={`rounded-lg border bg-gradient-to-br ${classes.split('text-')[0]} overflow-hidden`}>
      <button
        onClick={onToggle}
        disabled={!children}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors disabled:hover:bg-transparent disabled:cursor-default"
      >
        <div className="flex items-center gap-3">
          <Icon className={`w-4 h-4 ${classes.split('border-')[0].split('to-')[0].replace('from-', 'text-').replace('/10', '')}`} />
          <div className="text-left">
            <div className="text-sm font-bold text-white">{title}</div>
            <div className="text-xs text-slate-500">{weightLabel}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {score != null ? (
            <div className={`text-sm font-bold ${score > 0 ? 'text-green-400' : score < 0 ? 'text-red-400' : 'text-slate-400'}`}>
              {score > 0 ? '+' : ''}{score.toFixed(1)}
            </div>
          ) : (
            <div className="text-xs text-slate-600 uppercase">—</div>
          )}
          {children && (isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ))}
        </div>
      </button>

      {isExpanded && children && (
        <div className="px-4 pb-4 pt-1 border-t border-white/10 space-y-2">{children}</div>
      )}

      {unavailableNote && (
        <div className="px-4 pb-3 text-[11px] text-slate-500 italic">{unavailableNote}</div>
      )}
    </div>
  );
}
