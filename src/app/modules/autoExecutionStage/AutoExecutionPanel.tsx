/**
 * UI do estágio 3 (LIVE + execução automática, tamanho mínimo travado) — ver
 * useAutoExecutionStage.ts pro contrato. Ligar isto é a única ação de UI que
 * tira o humano do loop de aprovação por trade — o toggle exige confirmação
 * explícita adicional (window.confirm) antes de ligar, nunca desligar.
 */
import React from 'react';
import type { AutoExecutedTrade } from './useAutoExecutionStage';
import { LIVE_ALERT_DISCLAIMER } from '../liveAlertStage/useLiveAlertStage';

interface AutoExecutionPanelProps {
  history: AutoExecutedTrade[];
  enabled: boolean;
  onToggle: (next: boolean) => void;
}

const STATUS_LABEL: Record<AutoExecutedTrade['status'], string> = {
  executed: '✅ Executado',
  failed: '❌ Falhou',
  riskBlocked: '🚫 Bloqueado por risco',
  skipped: '⛔ Pulado (safe mode / erro de conversão)',
};

export function AutoExecutionPanel({ history, enabled, onToggle }: AutoExecutionPanelProps) {
  const handleToggle = (checked: boolean) => {
    if (checked) {
      const confirmed = window.confirm(
        'Ligar o Estágio 3 faz a IA abrir ordens reais na corretora SOZINHA, sem sua aprovação por trade ' +
          '(tamanho travado no lote mínimo). O motor não tem edge estatístico comprovado. Confirma que quer ligar?'
      );
      if (!confirmed) return;
    }
    onToggle(checked);
  };

  return (
    <div className="rounded-lg border border-red-600/50 bg-red-950/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-red-200">Estágio 3 — LIVE, execução automática (lote mínimo travado)</h3>
          <p className="text-xs text-red-200/70">
            A IA abre e fecha ordens reais sozinha, sem aprovação por trade. Tamanho sempre no lote mínimo do ativo.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-red-200/80 cursor-pointer select-none">
          <input type="checkbox" checked={enabled} onChange={(e) => handleToggle(e.target.checked)} />
          Ativado
        </label>
      </div>

      <div className="text-xs text-red-400/90 font-semibold">{LIVE_ALERT_DISCLAIMER}</div>

      <div>
        <h4 className="text-xs font-medium text-red-200/80 mb-1">Histórico</h4>
        {history.length === 0 ? (
          <p className="text-xs text-red-200/50">Nenhum trade automático ainda.</p>
        ) : (
          <ul className="space-y-1 max-h-48 overflow-y-auto">
            {history.map(item => (
              <li key={`${item.id}-${item.timestamp}`} className="text-xs bg-black/10 rounded p-2 flex justify-between">
                <span>{item.side === 'LONG' ? '🟢' : '🔴'} {item.symbol} @ {item.price} ({item.volume} lotes)</span>
                <span>{STATUS_LABEL[item.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
