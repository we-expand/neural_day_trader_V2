import React from 'react';
import { LayoutDashboard, Brain } from 'lucide-react';
import { LiveLogTerminal } from './LiveLogTerminal';
import { VIXWidgetEnhanced } from '../tools/VIXWidgetEnhanced';
import { RiskThermometer } from './RiskThermometer';
import { CorrelationMatrix } from './CorrelationMatrix';
import { ReportExporter } from './ReportExporter';
import { MarketScoreBoard } from './MarketScoreBoard';
import { NewsAndAgenda } from './NewsAndAgenda';
import { ContextualNews } from '../ContextualNews';
import { AIPredictiveCard } from './AIPredictiveCard';
import { useTradingContext } from '../../contexts/TradingContext'; // 🔥 NOVO

export function ModularDashboard() {
  console.log('[MODULAR_DASHBOARD] 🎨 ModularDashboard montando...');
  
  // 🔥 USAR ATIVO GLOBAL DO TradingContext (sincronizado!)
  const { selectedAsset } = useTradingContext();
  
  React.useEffect(() => {
    console.log('[MODULAR_DASHBOARD] ✅ ModularDashboard montado');
    return () => console.log('[MODULAR_DASHBOARD] 🔄 ModularDashboard desmontando');
  }, []);
  
  return (
    <div id="modular-dashboard" className="w-full h-full p-4 overflow-y-auto bg-black custom-scrollbar">
      {/* Header com ícone + título + subtítulo (padrão Marketplace) */}
      <div className="flex items-start gap-4 mb-6">
        <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
          <LayoutDashboard className="w-8 h-8 text-blue-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white uppercase flex items-center gap-3">
            Dashboard Principal
          </h1>
          <p className="text-slate-400 mt-1 tracking-wide font-light">
            Visão Geral, Métricas e Performance em Tempo Real
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 pb-20">
          
          {/* Row 1: MarketScoreBoard full width */}
          <div className="col-span-1 xl:col-span-12 h-auto">
             <div className="bg-zinc-950 rounded-xl overflow-hidden shadow-lg">
                <MarketScoreBoard />
             </div>
          </div>

          {/* Row 2: NewsAndAgenda (6) + VIX (3) + Risk (3) */}
          <div className="col-span-1 xl:col-span-6 h-[490px]">
             <NewsAndAgenda />
          </div>

          <div className="col-span-1 xl:col-span-3 h-[490px]">
             <VIXWidgetEnhanced />
          </div>

          <div className="col-span-1 xl:col-span-3 h-[490px]">
             <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden h-full shadow-lg">
                <div className="h-full p-2">
                   <RiskThermometer />
                </div>
             </div>
          </div>

          {/* Row 4: Correlation (8) + Reports (4) */}
          <div className="col-span-1 xl:col-span-8 min-h-[350px]">
             <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden h-full shadow-lg">
                <div className="h-full p-2 overflow-y-auto custom-scrollbar">
                   <CorrelationMatrix />
                </div>
             </div>
          </div>

          <div className="col-span-1 xl:col-span-4 min-h-[350px]">
             <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden h-full shadow-lg">
                <div className="h-full p-2 overflow-y-auto custom-scrollbar">
                   <ReportExporter />
                </div>
             </div>
          </div>

          {/* Row 5: IA Preditiva (full width) */}
          <div className="col-span-1 xl:col-span-12 min-h-[600px]">
             <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden h-full shadow-lg">
                <div className="h-full p-2 overflow-y-auto custom-scrollbar">
                   <AIPredictiveCard />
                </div>
             </div>
          </div>

          {/* Footer: Terminal */}
          <div className="col-span-1 xl:col-span-12 h-[300px]">
             <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden h-full flex flex-col shadow-lg">
                <LiveLogTerminal />
             </div>
          </div>
      </div>
    </div>
  );
}