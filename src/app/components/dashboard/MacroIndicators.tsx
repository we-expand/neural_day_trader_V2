import React from 'react';
import { Activity, AlertTriangle, Shield } from 'lucide-react';

export function MacroIndicators() {
  // Mock data
  const vix = 18.42;
  const volatility = 'Média';
  const riskLevel = 'Moderado';

  const getVixColor = () => {
    if (vix < 15) return 'text-emerald-400';
    if (vix < 20) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getVixLabel = () => {
    if (vix < 15) return 'Baixa';
    if (vix < 20) return 'Média';
    return 'Alta';
  };

  return (
    <div className="bg-neutral-950 border border-white/5 rounded-xl p-6">
      <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
        <Activity className="w-4 h-4" />
        Indicadores Macro
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* VIX */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
            VIX (Índice do Medo)
          </div>
          
          <div>
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-bold tracking-tighter ${getVixColor()}`}>
                {vix.toFixed(2)}
              </span>
              <span className="text-slate-500 text-xs font-mono">PTS</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className={`h-1.5 w-1.5 rounded-full ${getVixColor().replace('text-', 'bg-')} animate-pulse`} />
              <span className="text-xs text-slate-400 tracking-wide">
                Volatilidade <span className={`font-bold ${getVixColor()}`}>{getVixLabel()}</span>
              </span>
            </div>
          </div>

          {/* VIX Mini Chart */}
          <div className="pt-4 border-t border-white/5 mt-4">
            <div className="h-16 flex items-end gap-1">
              {[12, 15, 14, 16, 18, 17, 19, 18, 20, 18].map((value, i) => (
                <div
                  key={i}
                  className="flex-1 bg-gradient-to-t from-yellow-500/30 to-yellow-500/10 rounded-t"
                  style={{ height: `${(value / 25) * 100}%` }}
                />
              ))}
            </div>
            <p className="text-[10px] text-slate-600 mt-2 uppercase tracking-widest text-right">Últimas 10 sessões</p>
          </div>
        </div>

        {/* Volatilidade do Dia */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
            Volatilidade do Dia
          </div>
          
          <div>
            <div className="text-4xl font-bold text-yellow-400 tracking-tight">{volatility}</div>
            <p className="text-xs text-slate-500 mt-2 tracking-wide">
              Movimentos moderados esperados
            </p>
          </div>

          <div className="pt-4 space-y-2 mt-4 border-t border-white/5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">EUR/USD</span>
              <span className="text-yellow-400 font-mono">±0.45%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">S&P 500</span>
              <span className="text-yellow-400 font-mono">±0.62%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">BTC/USD</span>
              <span className="text-red-400 font-mono">±2.34%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Gold</span>
              <span className="text-emerald-400 font-mono">±0.28%</span>
            </div>
          </div>
        </div>

        {/* Nível de Risco */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
            Nível de Risco
          </div>
          
          <div>
            <div className="text-4xl font-bold text-orange-400 tracking-tight">{riskLevel}</div>
            <p className="text-xs text-slate-500 mt-2 tracking-wide">
              Gestão de risco recomendada: <span className="text-white font-bold">2%</span>
            </p>
          </div>

          {/* Risk Gauge */}
          <div className="pt-4 mt-4 border-t border-white/5">
            <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
              <div className="absolute inset-0 flex opacity-70">
                <div className="flex-1 bg-emerald-500" />
                <div className="flex-1 bg-yellow-500" />
                <div className="flex-1 bg-orange-500" />
                <div className="flex-1 bg-red-500" />
              </div>
              {/* Indicator */}
              <div 
                className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)] transition-all"
                style={{ left: '50%' }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-600 uppercase tracking-widest mt-2 font-bold">
              <span>Baixo</span>
              <span>Alto</span>
            </div>
          </div>

          <div className="pt-2 px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded-lg flex items-center gap-2 mt-2">
            <AlertTriangle className="w-3 h-3 text-orange-400" />
            <p className="text-[10px] text-orange-300 font-medium tracking-wide">
              Eventos de alto impacto: 2h
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}