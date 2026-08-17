// Banner "IA ligada mas travada" — ver useAIStuckDetector.ts pro racional
// completo. Renderiza só quando o hook detecta dominância real; não monta
// nada (nem consulta nada) quando a IA está desligada ou operando normal.

import { AlertTriangle } from 'lucide-react';
import { useAIStuckDetector } from '@/app/hooks/useAIStuckDetector';

export function AIStuckBanner() {
  const verdict = useAIStuckDetector();

  if (!verdict.stuck || !verdict.dominantLabel) return null;

  const sharePercent = Math.round(verdict.dominantShare * 100);

  return (
    <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-amber-300 font-semibold text-sm">
          A IA está ligada, mas quase nenhuma configuração está passando dos filtros
        </p>
        <p className="text-amber-200/90 text-sm mt-1">
          Nos últimos ciclos, <span className="font-medium">{sharePercent}%</span> das avaliações
          foram descartadas pelo mesmo motivo: <span className="font-medium">{verdict.dominantLabel}</span>.
        </p>
        {verdict.suggestion && (
          <p className="text-amber-200/70 text-sm mt-2">{verdict.suggestion}</p>
        )}
      </div>
    </div>
  );
}
