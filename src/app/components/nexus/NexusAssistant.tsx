import React from 'react';
import { MarketTendencyPanel } from './MarketTendencyPanel';
import type { MarketScoreResult } from '@/app/services/MarketScoreEngine';

interface NexusProps {
  activeSymbol: string;
  scoreResult: MarketScoreResult | null;
}

/**
 * NEXUS — card de "Análise por Fonte" no Dashboard.
 * Substitui o antigo NexusQuantumAdvisor/Luna (removidos). Continua
 * consumindo MarketScoreResult real (mesmo motor do Dashboard), sem
 * configurações de voz aqui — o assistente conversacional completo
 * (LLM + voz) vive na tela dedicada NEXUS, não neste card compacto.
 */
export function NexusAssistant({ activeSymbol, scoreResult }: NexusProps) {
  return (
    <div className="bg-[#0A0A0A] rounded-xl border border-white/10 h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0f0f0f]">
        <div className="flex items-center gap-3">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="shrink-0">
            <circle cx="16" cy="16" r="3" fill="#06b6d4" />
            <ellipse cx="16" cy="16" rx="13" ry="6" stroke="#06b6d4" strokeWidth="2" fill="none" transform="rotate(60 16 16)" />
            <ellipse cx="16" cy="16" rx="13" ry="6" stroke="#06b6d4" strokeWidth="2" fill="none" transform="rotate(-60 16 16)" />
            <ellipse cx="16" cy="16" rx="13" ry="6" stroke="#06b6d4" strokeWidth="2" fill="none" />
          </svg>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Análise por Fonte
          </h2>
        </div>
      </div>

      <div className="flex-1 relative overflow-auto p-4">
        <MarketTendencyPanel symbol={activeSymbol} scoreResult={scoreResult} />
      </div>
    </div>
  );
}
