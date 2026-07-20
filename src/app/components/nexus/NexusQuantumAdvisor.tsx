import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { LunaInteractionSettings } from './LunaInteractionSettings';
import { MarketTendencyPanel } from './MarketTendencyPanel';
import type { MarketScoreResult } from '@/app/services/MarketScoreEngine';

interface NexusProps {
  activeSymbol: string;
  scoreResult: MarketScoreResult | null;
}

/**
 * Reescrito em 2026-07-19 — removidos: gráfico canvas 100% Math.random()
 * (heatmaps/setas/médias fake), badge "Spoofing Detectado" hardcoded sempre
 * ligado, caixa "Correlação Borboleta" com texto estático, e os botões de
 * modo solo/híbrido/automático (decorativos, nunca tiveram efeito real —
 * confirmado sem nenhum consumidor do state `mode` no resto do app).
 * O painel de fontes agora consome MarketScoreResult real (mesmo motor do
 * Dashboard), passado como prop em vez de recalculado aqui.
 */
export function NexusQuantumAdvisor({ activeSymbol, scoreResult }: NexusProps) {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
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

          <button
            onClick={() => setShowSettings(true)}
            className="p-2.5 rounded-lg bg-gradient-to-br from-cyan-500/10 to-purple-500/10 hover:from-cyan-500/20 hover:to-purple-500/20 border border-cyan-500/30 hover:border-cyan-500/50 transition-all group"
            title="Configurações da Luna"
          >
            <Settings className="w-4 h-4 text-cyan-400 group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>

        <div className="flex-1 relative overflow-auto p-4">
          <MarketTendencyPanel symbol={activeSymbol} scoreResult={scoreResult} />
        </div>
      </div>

      <LunaInteractionSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </>
  );
}
