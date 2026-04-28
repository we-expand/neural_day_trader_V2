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
  const [config, setConfig] = useState<TrailingStopConfig>({
    mode: 'CHANDELIER',
    atrPeriod: 14,
    atrMultiplier: 2.0,
    enabled: true
  });

  const [positions, setPositions] = useState<ActivePosition[]>([]);
  const [expandedPosition, setExpandedPosition] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [movementHistory, setMovementHistory] = useState<Record<string, StopMovement[]>>({});

  // Buscar posições ativas
  useEffect(() => {
    const fetchPositions = async () => {
      // TODO: Integrar com ApexLogicCore para buscar posições reais
      // Por enquanto, mock data
      const mockPositions: ActivePosition[] = [
        {
          id: 'pos-1',
          symbol: 'EURUSD',
          side: 'LONG',
          entryPrice: 1.08450,
          currentPrice: 1.08650,
          amount: 10000,
          initialStop: 1.08200,
          currentStop: 1.08420,
          atr: 0.00085,
          stopMoves: 8,
          pipsProtected: 22,
          profitProtected: 22,
          trailingActive: true,
          lastMoveTime: Date.now() - 3600000
        },
        {
          id: 'pos-2',
          symbol: 'GBPUSD',
          side: 'SHORT',
          entryPrice: 1.26800,
          currentPrice: 1.26450,
          amount: 5000,
          initialStop: 1.27100,
          currentStop: 1.26680,
          atr: 0.00120,
          stopMoves: 5,
          pipsProtected: 42,
          profitProtected: 21,
          trailingActive: true,
          lastMoveTime: Date.now() - 1800000
        },
        {
          id: 'pos-3',
          symbol: 'XAUUSD',
          side: 'LONG',
          entryPrice: 2042.50,
          currentPrice: 2048.80,
          amount: 1,
          initialStop: 2038.00,
          currentStop: 2044.20,
          atr: 3.50,
          stopMoves: 3,
          pipsProtected: 620,
          profitProtected: 6.20,
          trailingActive: true,
          lastMoveTime: Date.now() - 900000
        }
      ];

      setPositions(mockPositions);
    };

    fetchPositions();
    const interval = setInterval(fetchPositions, 2000); // 🚀 OTIMIZADO: Update a cada 2s (foi 5s)
    return () => clearInterval(interval);
  }, []);

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
                <Select
                  value={config.mode}
                  onValueChange={(value: any) => setConfig({ ...config, mode: value })}
                >
                  <SelectTrigger className="h-9 bg-slate-800 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    <SelectItem value="CHANDELIER">Chandelier Exit</SelectItem>
                    <SelectItem value="SIMPLE_ATR">Simple ATR</SelectItem>
                    <SelectItem value="PARABOLIC_SAR">Parabolic SAR</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-2 block">Período ATR</label>
                <Select
                  value={config.atrPeriod.toString()}
                  onValueChange={(value) => setConfig({ ...config, atrPeriod: parseInt(value) })}
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
                  onValueChange={(value) => setConfig({ ...config, atrMultiplier: parseFloat(value) })}
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