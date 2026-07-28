/**
 * UI do estágio 1 (LIVE + somente alerta) — ver useLiveAlertStage.ts pro
 * contrato. Mostra o histórico local de alertas com o disclaimer permanente
 * repetido em cada item (decisão travada em AI_BRAIN_SPEC.md seção 9.1: o
 * disclaimer não pode aparecer só uma vez, se perde da memória do usuário).
 */
import React from 'react';
import type { LiveAlertEvent } from './useLiveAlertStage';

interface LiveAlertPanelProps {
  alerts: LiveAlertEvent[];
  enabled: boolean;
  onToggle: (next: boolean) => void;
}

export function LiveAlertPanel({ alerts, enabled, onToggle }: LiveAlertPanelProps) {
  return (
    <div className="rounded-lg border border-yellow-600/40 bg-yellow-950/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-yellow-200">Estágio 1 — LIVE, somente alerta</h3>
          <p className="text-xs text-yellow-200/70">
            A IA mostra a decisão, mas nunca envia ordem real. Nenhuma chamada ao broker.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-yellow-200/80 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
          />
          Ativado
        </label>
      </div>

      {alerts.length === 0 ? (
        <p className="text-xs text-yellow-200/50">Nenhum alerta ainda.</p>
      ) : (
        <ul className="space-y-2 max-h-64 overflow-y-auto">
          {alerts.map(alert => (
            <li key={alert.id} className="text-xs bg-black/20 rounded p-2 space-y-1">
              <div className="flex justify-between font-medium">
                <span>{alert.side === 'LONG' ? '🟢' : '🔴'} {alert.symbol} @ {alert.price}</span>
                <span>{alert.ai_confidence}%</span>
              </div>
              <div className="text-yellow-200/70">{alert.reasoning}</div>
              <div className="text-yellow-400/90 font-semibold">{alert.disclaimer}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
