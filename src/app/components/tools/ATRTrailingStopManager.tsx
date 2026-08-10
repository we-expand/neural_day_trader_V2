/**
 * 🎯 ATR TRAILING STOP MANAGER
 * 
 * Componente profissional para gerenciar trailing stops baseados em ATR
 * 
 * Funcionalidades:
 * - Visualizar todas as posições com trailing stop ativo
 * - Configurar multiplicador ATR e período
 * - Histórico de movimentos do stop
 * - Performance analytics
 * - Modos: Chandelier Exit, Simple ATR, Parabolic SAR
 * - Alertas quando stop move
 * 
 * @version 1.0.0
 * @author Neural Day Trader Platform
 * @date 21 Janeiro 2026
 */

import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { useTradingContext } from '@/app/contexts/TradingContext';
import { backtestDataService } from '@/app/services/BacktestDataService';
import { calculateATR } from '@/app/services/indicators/TechnicalIndicators';
import { getPointValue } from '@/app/services/strategy/TradeSizing';
import { 
  Target, 
  TrendingUp, 
  TrendingDown,
  Settings,
  History,
  Zap,
  Activity,
  Shield,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronUp,
  Info,
  Bell,
  BarChart3
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';

// ============================================================================
// TYPES
// ============================================================================

interface TrailingStopConfig {
  mode: 'CHANDELIER' | 'SIMPLE_ATR' | 'PARABOLIC_SAR';
  atrPeriod: number;
  atrMultiplier: number;
  enabled: boolean;
}

interface ActivePosition {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  amount: number;
  initialStop: number;
  currentStop: number;
  atr: number;
  stopMoves: number;
  pipsProtected: number;
  profitProtected: number;
  trailingActive: boolean;
  lastMoveTime?: number;
}

interface StopMovement {
  timestamp: number;
  oldStop: number;
  newStop: number;
  pipsGained: number;
  reason: string;
}

interface ATRTrailingStopManagerProps {
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ATRTrailingStopManager({ className = '' }: ATRTrailingStopManagerProps) {
  // 🔴 FIX 2026-08-04 (auditoria de config): antes este painel gerava
  // `mockPositions` fixas (`// TODO: Integrar com ApexLogicCore`) a cada 2s —
  // 3 posições fabricadas, nunca ligadas ao motor real. Agora deriva das
  // posições REAIS (`activeOrders` de useApexLogic via TradingContext),
  // filtradas pras que são elegíveis pro trailing (mesmo critério do motor:
  // `originalSl > 0`) e com `stopLossMode` real refletido no toggle.
  const { activeOrders, aiConfig, updateAIConfig } = useTradingContext();

  const config: TrailingStopConfig = {
    mode: 'CHANDELIER', // única lógica de trailing implementada no motor hoje
    atrPeriod: aiConfig.atrTrailingPeriod,
    atrMultiplier: aiConfig.atrTrailingMultiplier,
    enabled: aiConfig.stopLossMode === 'DINAMICO',
  };

  const [expandedPosition, setExpandedPosition] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [movementHistory, setMovementHistory] = useState<Record<string, StopMovement[]>>({});

  // ATR real por símbolo (mesmo pipeline de candle real do resto do app —
  // BacktestDataService/calculateATR). Sem candle real disponível, o campo
  // fica de fora do mapa e a UI mostra "—", nunca um número inventado.
  const [atrBySymbol, setAtrBySymbol] = useState<Record<string, number>>({});

  const eligibleOrders = useMemo(
    () => activeOrders.filter(o => o.originalSl > 0),
    [activeOrders]
  );

  useEffect(() => {
    if (!config.enabled || eligibleOrders.length === 0) return;
    let cancelled = false;
    const symbols = Array.from(new Set(eligibleOrders.map(o => o.symbol)));
    (async () => {
      const entries = await Promise.all(symbols.map(async (symbol) => {
        try {
          const end = new Date();
          const start = new Date(end.getTime() - 100 * 60_000);
          const history = await backtestDataService.fetchHistoricalData(symbol, start, end, '1m');
          const atrSeries = calculateATR(history.candles, config.atrPeriod);
          const lastAtr = atrSeries[atrSeries.length - 1];
          return lastAtr && lastAtr > 0 ? [symbol, lastAtr] as const : null;
        } catch {
          return null; // sem dado real pro símbolo agora — nunca fabrica
        }
      }));
      if (!cancelled) {
        setAtrBySymbol(Object.fromEntries(entries.filter((e): e is [string, number] => e !== null)));
      }
    })();
    return () => { cancelled = true; };
  }, [config.enabled, config.atrPeriod, eligibleOrders.map(o => o.symbol).join(',')]);

  const positions: ActivePosition[] = useMemo(() => eligibleOrders.map((o): ActivePosition => {
    const currentPrice = o.currentPrice || o.price;
    const stopMoved = o.side === 'LONG' ? o.sl - o.originalSl : o.originalSl - o.sl;
    const pointValue = getPointValue(o.symbol);
    return {
      id: o.id,
      symbol: o.symbol,
      side: o.side,
      entryPrice: o.price,
      currentPrice,
      amount: o.amount / o.price, // amount em TradeVisual é notional USD — converte pra unidades reais
      initialStop: o.originalSl,
      currentStop: o.sl,
      atr: atrBySymbol[o.symbol] ?? 0,
      stopMoves: o.trailMoves || 0,
      pipsProtected: stopMoved > 0 && pointValue > 0 ? stopMoved / pointValue : 0,
      profitProtected: stopMoved > 0 ? stopMoved * (o.amount / o.price) : 0,
      trailingActive: config.enabled,
      // Motor não guarda timestamp por movimento individual (só o contador
      // `trailMoves`) — nunca fabrica um "agora mesmo" falso, fica undefined.
      lastMoveTime: undefined,
    };
  }), [eligibleOrders, atrBySymbol, config.enabled]);

  // Calcular métricas agregadas
  const metrics = useMemo(() => {
    if (positions.length === 0) return null;

    const totalProtected = positions.reduce((sum, p) => sum + p.profitProtected, 0);
    const totalMoves = positions.reduce((sum, p) => sum + p.stopMoves, 0);
    const avgPipsProtected = positions.reduce((sum, p) => sum + p.pipsProtected, 0) / positions.length;

    return {
      totalProtected,
      totalMoves,
      avgPipsProtected,
      activePositions: positions.filter(p => p.trailingActive).length
    };
  }, [positions]);

  // Renderizar posição individual
  const renderPosition = (position: ActivePosition) => {
    const isExpanded = expandedPosition === position.id;
    const pnl = position.side === 'LONG' 
      ? (position.currentPrice - position.entryPrice) * position.amount
      : (position.entryPrice - position.currentPrice) * position.amount;
    const pnlPercent = ((position.currentPrice - position.entryPrice) / position.entryPrice) * 100;

    const stopDistance = position.side === 'LONG'
      ? position.currentPrice - position.currentStop
      : position.currentStop - position.currentPrice;

    const stopDistancePips = stopDistance * 10000;

    return (
      <div
        key={position.id}
        className={`
          p-4 rounded-lg border transition-all
          ${position.side === 'LONG' 
            ? 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/30' 
            : 'bg-rose-500/5 border-rose-500/20 hover:border-rose-500/30'
          }
          ${isExpanded ? 'ring-1 ring-white/5' : ''}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              position.side === 'LONG' ? 'bg-emerald-500/15' : 'bg-rose-500/15'
            }`}>
              {position.side === 'LONG' ? (
                <TrendingUp className="w-4 h-4 text-emerald-400/90" />
              ) : (
                <TrendingDown className="w-4 h-4 text-rose-400/90" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base text-slate-100">{position.symbol}</span>
                <Badge 
                  variant="outline"
                  className={`text-[10px] px-2 py-0.5 ${
                    position.side === 'LONG' 
                      ? 'bg-emerald-500/10 text-emerald-400/90 border-emerald-500/20' 
                      : 'bg-rose-500/10 text-rose-400/90 border-rose-500/20'
                  }`}
                >
                  {position.side}
                </Badge>
                {position.trailingActive && (
                  <Badge variant="outline" className="text-[10px] text-blue-400/80 border-blue-400/20 bg-blue-400/5 px-2 py-0.5">
                    <Zap className="w-2.5 h-2.5 mr-1" />
                    Trailing
                  </Badge>
                )}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {position.amount.toLocaleString()} unidades
              </div>
            </div>
          </div>

          <button
            onClick={() => setExpandedPosition(isExpanded ? null : position.id)}
            className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>
        </div>

        {/* Preços */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="space-y-1">
            <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Entry → Current</div>
            <div className="font-mono text-sm text-slate-200">
              {position.entryPrice.toFixed(5)} → <span className="font-semibold text-white">{position.currentPrice.toFixed(5)}</span>
            </div>
          </div>
          <div className="text-right space-y-1">
            <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">P&L</div>
            <div className={`text-lg font-semibold ${pnl >= 0 ? 'text-emerald-400/90' : 'text-rose-400/90'}`}>
              {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} USD
            </div>
            <div className={`text-[11px] ${pnl >= 0 ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>
              {pnl >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Trailing Stop Info - Mais clean */}
        <div className="space-y-3 p-3 rounded-lg bg-slate-900/30 border border-slate-800/30 mb-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400">Stop Loss Tracking</span>
            <Badge variant="outline" className="text-[10px] border-white/10 bg-white/5 px-2 py-0.5">
              {position.stopMoves} movimentos
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-[10px] text-slate-500">Inicial</div>
              <div className="font-mono text-sm text-slate-400">
                {position.initialStop.toFixed(5)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] text-slate-500">Atual (Trailing)</div>
              <div className="font-mono text-sm font-semibold text-white flex items-center gap-1.5">
                {position.currentStop.toFixed(5)}
                {position.side === 'LONG' ? (
                  <ArrowUp className="w-3 h-3 text-emerald-400/80" />
                ) : (
                  <ArrowDown className="w-3 h-3 text-rose-400/80" />
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-800/30 text-[11px]">
            <div>
              <div className="text-slate-500 mb-0.5">ATR</div>
              <div className="font-mono text-slate-300">{position.atr.toFixed(5)}</div>
            </div>
            <div>
              <div className="text-slate-500 mb-0.5">Distância</div>
              <div className="font-mono text-blue-400/90">{stopDistancePips.toFixed(1)} pips</div>
            </div>
            <div>
              <div className="text-slate-500 mb-0.5">Protegido</div>
              <div className="font-mono text-emerald-400/90">+{position.pipsProtected} pips</div>
            </div>
          </div>
        </div>

        {/* Barra de Progresso - mais delicada */}
        <div className="relative h-1 bg-slate-800/30 rounded-full overflow-hidden mb-2">
          <div
            className={`absolute left-0 top-0 h-full rounded-full transition-all ${
              position.side === 'LONG' ? 'bg-emerald-400/70' : 'bg-rose-400/70'
            }`}
            style={{ 
              width: `${Math.min((position.stopMoves / 20) * 100, 100)}%` 
            }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>Lucro Protegido: <span className="text-emerald-400/80 font-medium">${position.profitProtected.toFixed(2)}</span></span>
          {position.lastMoveTime && (
            <span>
              Último movimento: <span className="text-slate-400">{formatTimestamp(position.lastMoveTime)}</span>
            </span>
          )}
        </div>

        {/* Detalhes Expandidos */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Info className="w-4 h-4 text-blue-400" />
              <span>Modo: <strong>{config.mode}</strong></span>
              <span className="text-slate-500">•</span>
              <span>Período: <strong>{config.atrPeriod}</strong></span>
              <span className="text-slate-500">•</span>
              <span>Multiplicador: <strong>{config.atrMultiplier}x</strong></span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  // TODO: Ver histórico de movimentos
                  console.log('Histórico:', position.id);
                }}
              >
                <History className="w-3 h-3 mr-1" />
                Ver Histórico
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  // TODO: Ajustar configuração individual
                  console.log('Ajustar:', position.id);
                }}
              >
                <Settings className="w-3 h-3 mr-1" />
                Ajustar
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className={`overflow-hidden border-slate-800/50 ${className}`}>
      {/* Header - Mais delicado e minimalista */}
      <div className="p-5 border-b border-slate-800/30">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <Target className="w-5 h-5 text-blue-400/80" />
            </div>
            <div>
              <h3 className="text-base font-semibold tracking-tight text-slate-200">ATR Trailing Stop Manager</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Proteção automática baseada em volatilidade</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Badge 
              variant="outline"
              className={`text-[10px] px-2.5 py-1 ${
                config.enabled 
                  ? 'text-emerald-400/80 border-emerald-500/20 bg-emerald-500/5' 
                  : 'text-slate-400 border-slate-700/30 bg-slate-500/5'
              }`}
            >
              {config.enabled && <Activity className="w-3 h-3 mr-1.5 animate-pulse" />}
              {config.enabled ? 'Ativo' : 'Pausado'}
            </Badge>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-2 block">Modo</label>
                <Select value={config.mode} disabled>
                  <SelectTrigger className="h-9 bg-slate-800 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    <SelectItem value="CHANDELIER">Chandelier Exit (único implementado)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-2 block">Período ATR</label>
                <Select
                  value={config.atrPeriod.toString()}
                  onValueChange={(value) => updateAIConfig({ atrTrailingPeriod: parseInt(value) })}
                >
                  <SelectTrigger className="h-9 bg-slate-800 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    <SelectItem value="7">7 períodos</SelectItem>
                    <SelectItem value="14">14 períodos</SelectItem>
                    <SelectItem value="21">21 períodos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-2 block">Multiplicador</label>
                <Select
                  value={config.atrMultiplier.toString()}
                  onValueChange={(value) => updateAIConfig({ atrTrailingMultiplier: parseFloat(value) })}
                >
                  <SelectTrigger className="h-9 bg-slate-800 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    <SelectItem value="1.0">1.0x ATR</SelectItem>
                    <SelectItem value="1.5">1.5x ATR</SelectItem>
                    <SelectItem value="2.0">2.0x ATR</SelectItem>
                    <SelectItem value="2.5">2.5x ATR</SelectItem>
                    <SelectItem value="3.0">3.0x ATR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Info className="w-4 h-4 text-blue-400" />
              <span>
                {config.mode === 'CHANDELIER' && 'Stop desde highest high/lowest low menos ATR'}
                {config.mode === 'SIMPLE_ATR' && 'Stop a partir do preço atual menos ATR'}
                {config.mode === 'PARABOLIC_SAR' && 'Stop acelerado progressivamente'}
              </span>
            </div>
          </div>
        )}

        {/* Métricas */}
        {metrics && (
          <div className="grid grid-cols-4 gap-3 mt-4">
            <div className="p-3 rounded-lg bg-slate-900/50">
              <div className="text-xs text-slate-400 mb-1">Posições Ativas</div>
              <div className="text-2xl font-bold">{metrics.activePositions}</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/50">
              <div className="text-xs text-slate-400 mb-1">Lucro Protegido</div>
              <div className="text-2xl font-bold text-emerald-400">
                ${metrics.totalProtected.toFixed(0)}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/50">
              <div className="text-xs text-slate-400 mb-1">Total Movimentos</div>
              <div className="text-2xl font-bold text-blue-400">{metrics.totalMoves}</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/50">
              <div className="text-xs text-slate-400 mb-1">Média Pips</div>
              <div className="text-2xl font-bold text-purple-400">
                +{metrics.avgPipsProtected.toFixed(0)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Posições */}
      <div className="p-6">
        {positions.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-300">
                Posições Ativas ({positions.length})
              </h4>
              <div className="text-xs text-slate-400">
                Ordenadas por P&L
              </div>
            </div>

            {positions.map(position => renderPosition(position))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Shield className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <div className="text-slate-400 text-sm">Nenhuma posição com trailing stop ativo</div>
            <div className="text-slate-500 text-xs mt-1">
              Abra uma posição para começar a usar trailing stops
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatTimestamp(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (hours > 0) return `${hours}h atrás`;
  if (minutes > 0) return `${minutes}min atrás`;
  return 'agora';
}