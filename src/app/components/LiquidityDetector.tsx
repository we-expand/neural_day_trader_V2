import React from 'react';
import { Shield, Target, Zap, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

interface LiquidityZone {
  id: string;
  price: number;
  strength: number;
  type: 'support' | 'resistance';
  touches: number;
  volume: number;
  distance: number;
  significance: 'critical' | 'strong' | 'moderate' | 'weak';
}

interface LiquidityDetectorProps {
  zones: LiquidityZone[];
  currentPrice: number;
}

export function LiquidityDetector({ zones, currentPrice }: LiquidityDetectorProps) {
  const getSignificanceColor = (significance: string) => {
    switch (significance) {
      case 'critical':
        return { bg: 'bg-red-500/20', border: 'border-red-500/50', text: 'text-red-400', glow: 'shadow-red-500/30' };
      case 'strong':
        return { bg: 'bg-orange-500/20', border: 'border-orange-500/50', text: 'text-orange-400', glow: 'shadow-orange-500/30' };
      case 'moderate':
        return { bg: 'bg-yellow-500/20', border: 'border-yellow-500/50', text: 'text-yellow-400', glow: 'shadow-yellow-500/30' };
      default:
        return { bg: 'bg-blue-500/20', border: 'border-blue-500/50', text: 'text-blue-400', glow: 'shadow-blue-500/30' };
    }
  };

  return (
    <div className="w-80 border-l border-gray-700 bg-gradient-to-b from-[#0a0a0a] to-[#050505] flex flex-col shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
            <Zap className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Detector de Liquidez</h3>
            <p className="text-xs text-gray-500">Smart Money Concepts</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-gray-400">{zones.length} zonas detectadas</span>
          </div>
        </div>
      </div>

      {/* Zones List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {zones.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <AlertTriangle className="w-12 h-12 text-gray-600 mb-3" />
            <p className="text-sm text-gray-500">Aguardando dados...</p>
            <p className="text-xs text-gray-600 mt-1">Zonas de liquidez serão detectadas automaticamente</p>
          </div>
        ) : (
          zones.map((zone) => {
            const colors = getSignificanceColor(zone.significance);
            const isNear = Math.abs(zone.distance) < 0.5;
            const isPriceCrossing = Math.abs(zone.distance) < 0.1;
            
            return (
              <div
                key={zone.id}
                className={`
                  relative p-3 rounded-lg border transition-all duration-300 cursor-pointer
                  ${colors.bg} ${colors.border} hover:scale-105
                  ${isPriceCrossing ? `ring-2 ring-yellow-400 animate-pulse ${colors.glow} shadow-lg` : ''}
                  ${isNear && !isPriceCrossing ? 'ring-1 ring-gray-600' : ''}
                `}
              >
                {/* Zone Type Badge */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {zone.type === 'support' ? (
                      <div className="w-6 h-6 rounded bg-green-500/20 flex items-center justify-center">
                        <Shield className="w-3.5 h-3.5 text-green-400" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded bg-red-500/20 flex items-center justify-center">
                        <Target className="w-3.5 h-3.5 text-red-400" />
                      </div>
                    )}
                    <span className={`text-xs font-bold uppercase ${colors.text}`}>
                      {zone.type === 'support' ? 'Suporte' : 'Resistência'}
                    </span>
                  </div>
                  
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                    {zone.significance.toUpperCase()}
                  </span>
                </div>

                {/* Price */}
                <div className="mb-2">
                  <div className="text-lg font-bold text-white">
                    ${zone.price.toFixed(5)}
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    {zone.distance > 0 ? (
                      <TrendingUp className="w-3 h-3 text-green-400" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-red-400" />
                    )}
                    <span className={zone.distance > 0 ? 'text-green-400' : 'text-red-400'}>
                      {zone.distance > 0 ? '+' : ''}{zone.distance.toFixed(3)}%
                    </span>
                    <span className="text-gray-500">do preço atual</span>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-black/30 rounded p-2">
                    <div className="text-xs text-gray-400">Força</div>
                    <div className="flex items-center gap-1">
                      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${zone.type === 'support' ? 'bg-green-500' : 'bg-red-500'} transition-all`}
                          style={{ width: `${zone.strength}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-white">{zone.strength.toFixed(0)}%</span>
                    </div>
                  </div>
                  
                  <div className="bg-black/30 rounded p-2">
                    <div className="text-xs text-gray-400">Toques</div>
                    <div className="flex items-center gap-1">
                      <Zap className="w-3 h-3 text-yellow-400" />
                      <span className="text-xs font-semibold text-white">{zone.touches}x</span>
                    </div>
                  </div>
                </div>

                {/* Volume Indicator */}
                <div className="mt-2 bg-black/30 rounded p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Volume Acumulado</span>
                    <span className="text-xs font-semibold text-blue-400">
                      {(zone.volume / 1000000).toFixed(2)}M
                    </span>
                  </div>
                </div>

                {/* Proximity Alert */}
                {isPriceCrossing && (
                  <div className="mt-2 flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded p-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400 animate-pulse" />
                    <span className="text-xs font-semibold text-yellow-400">
                      PREÇO PRÓXIMO!
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Legend */}
      <div className="p-3 border-t border-gray-800 bg-black/50">
        <div className="text-xs text-gray-500 mb-2 font-semibold">Níveis de Significância:</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-gray-400">Crítico</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-orange-500" />
            <span className="text-gray-400">Forte</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <span className="text-gray-400">Moderado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-gray-400">Fraco</span>
          </div>
        </div>
      </div>
    </div>
  );
}
