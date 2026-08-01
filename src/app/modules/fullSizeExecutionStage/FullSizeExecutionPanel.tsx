/**
 * UI do estágio 4 (LIVE + execução automática, TAMANHO REAL do motor) — ver
 * useFullSizeExecutionStage.ts pro contrato. É o toggle mais consequente do
 * produto: dinheiro real, tamanho real, sem aprovação por trade, sem edge
 * estatístico comprovado. Exige o Estágio 3 já ligado (toggle desabilitado
 * se não estiver) e confirmação explícita adicional antes de ligar.
 */
import React from 'react';
import type { FullSizeExecutedTrade } from './useFullSizeExecutionStage';
import { LIVE_ALERT_DISCLAIMER } from '../liveAlertStage/useLiveAlertStage';

interface FullSizeExecutionPanelProps {
  history: FullSizeExecutedTrade[];
  enabled: boolean;
  stage3Enabled: boolean;
  onToggle: (next: boolean) => void;
}

const STATUS_LABEL: Record<FullSizeExecutedTrade['status'], string> = {
  executed: '✅ Executado',
  failed: '❌ Falhou',
  riskBlocked: '🚫 Bloqueado por risco',
  skipped: '⛔ Pulado (safe mode / erro de conversão)',
};

export function FullSizeExecutionPanel({ history, enabled, stage3Enabled, onToggle }: FullSizeExecutionPanelProps) {
  const handleToggle = (checked: boolean) => {
    if (checked) {
      const confirmed = window.confirm(
        'Ligar o Estágio 4 faz a IA abrir ordens reais na corretora SOZINHA, no TAMANHO REAL calculado pelo motor ' +
          '(não mais o lote mínimo). Dinheiro real, tamanho real, sem aprovação por trade. O motor não tem edge ' +
          'estatístico comprovado. Confirma que quer ligar?'
      );
      if (!confirmed) return;
    }
    onToggle(checked);
  };

  return (
    <div className="rounded-lg border border-red-600/50 bg-red-950/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-red-200">Estágio 4 — LIVE, execução automática (TAMANHO REAL)</h3>
          <p className="text-xs text-red-200/70">
            A IA abre e fecha ordens reais sozinha, sem aprovação por trade, no tamanho real calculado pelo motor (não o lote mínimo).
          </p>
          {!stage3Enabled && (
            <p className="text-xs text-yellow-400 mt-1">
              Pré-requisito: o Estágio 3 precisa estar ligado antes de ligar este.
            </p>
          )}
        </div>
        <label className={`flex items-center gap-2 text-xs text-red-200/80 select-none ${stage3Enabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
          <input
            type="checkbox"
            checked={enabled}
            disabled={!stage3Enabled}
            onChange={(e) => handleToggle(e.target.checked)}
          />
          Ativado
        </label>
      </div>

      <div className="text-xs text-red-400/90 font-semibold">
        DINHEIRO REAL EM TAMANHO REAL — {LIVE_ALERT_DISCLAIMER}
      </div>

      <div>
        <h4 className="text-xs font-medium text-red-200/80 mb-1">Histórico</h4>
        {history.length === 0 ? (
          <p className="text-xs text-red-200/50">Nenhum trade automático de tamanho real ainda.</p>
        ) : (
          <ul className="space-y-1 max-h-48 overflow-y-auto">
            {history.map(item => (
              <li key={`${item.id}-${item.timestamp}`} className="text-xs bg-black/10 rounded p-2 flex justify-between">
                <span>{item.side === 'LONG' ? '🟢' : '🔴'} {item.symbol} @ {item.price} ({item.volume} lotes{item.volumeCapped ? ', capado' : ''})</span>
                <span>{STATUS_LABEL[item.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
