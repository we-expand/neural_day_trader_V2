import React from 'react';
import { LayoutDashboard } from 'lucide-react';
import { MarketScoreBoard } from './dashboard/MarketScoreBoard';
import { NewsAndAgenda } from './dashboard/NewsAndAgenda';
import { VIXWidgetEnhanced } from './tools/VIXWidgetEnhanced';
import { RiskThermometer } from './dashboard/RiskThermometer';
import { CorrelationMatrix } from './dashboard/CorrelationMatrix';

export function Dashboard() {
  return (
    <div className="w-full h-full p-4 overflow-y-auto bg-black custom-scrollbar">
      {/* Header — sem logo duplicado */}
      <div className="flex items-start gap-4 mb-6">
        <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
          <LayoutDashboard className="w-8 h-8 text-blue-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white uppercase">
            Dashboard Principal
          </h1>
          <p className="text-slate-400 mt-1 tracking-wide font-light">
            Visão Geral, Métricas e Performance em Tempo Real
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 pb-20">
        <div className="col-span-1 xl:col-span-12 h-auto">
          <div className="bg-zinc-950 rounded-xl overflow-hidden shadow-lg">
            <MarketScoreBoard />
          </div>
        </div>

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

        <div className="col-span-1 xl:col-span-8 min-h-[350px]">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden h-full shadow-lg">
            <div className="h-full p-2 overflow-y-auto custom-scrollbar">
              <CorrelationMatrix />
            </div>
          </div>
        </div>
        
        <div className="col-span-1 xl:col-span-4 min-h-[350px] bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex items-center justify-center">
          <p className="text-slate-500">Report Exporter</p>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;