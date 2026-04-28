/**
 * 🤖 AI PREDICTIVE CARD - TEMPORARY SIMPLE VERSION
 */

import React from 'react';
import { Brain, Activity } from 'lucide-react';

export const AIPredictiveCard: React.FC = () => {
  return (
    <div className="h-full flex flex-col">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">IA Preditiva</h2>
            <p className="text-sm text-slate-400">Análise em tempo real com machine learning</p>
          </div>
        </div>

        <div className="text-sm text-slate-500 font-bold">
          🚀 Em breve
        </div>
      </div>

      {/* CONTEÚDO */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-16 h-16 text-purple-400 mx-auto mb-4 animate-pulse" />
          <h3 className="text-xl font-bold text-white mb-2">
            Sistema de IA em Desenvolvimento
          </h3>
          <p className="text-sm text-slate-400 max-w-md">
            O sistema completo de análise preditiva com 300+ ativos e gráficos avançados
            está sendo otimizado para você.
          </p>
        </div>
      </div>
    </div>
  );
};
