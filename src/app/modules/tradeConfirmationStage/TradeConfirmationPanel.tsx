/**
 * UI do estágio 2 (LIVE + confirmação manual por trade) — ver
 * useTradeConfirmationStage.ts pro contrato. Disclaimer permanente visível
 * sempre no topo e repetido em cada item (mesma decisão do Estágio 1, ver
 * AI_BRAIN_SPEC.md seção 9.1).
 */
import React, { useEffect, useState } from 'react';
import type { PendingTradeConfirmation, ResolvedTradeConfirmation } from './useTradeConfirmationStage';
import { LIVE_ALERT_DISCLAIMER } from '../liveAlertStage/useLiveAlertStage';

interface TradeConfirmationPanelProps {
  pending: PendingTradeConfirmation[];
  history: ResolvedTradeConfirmation[];
  enabled: boolean;
  onToggle: (next: boolean) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

const STATUS_LABEL: Record<ResolvedTradeConfirmation['status'], string> = {
  executed: '✅ Executado',
  failed: '❌ Falhou',
  riskBlocked: '🚫 Bloqueado por risco',
  rejected: '🙅 Rejeitado',
  expired: '⌛ Expirado (sem resposta)',
  cancelled: '⛔ Cancelado (safe mode / modo alterado)',
};

function useCountdown(expiresAt: number) {
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.round((expiresAt - Date.now()) / 1000)));
  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(Math.max(0, Math.round((expiresAt - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);
  return remaining;
}

function PendingItem({
  item,
  onApprove,
  onReject,
}: {
  item: PendingTradeConfirmation;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const secondsLeft = useCountdown(item.expiresAt);

  return (
    <li className="text-xs bg-black/20 rounded p-2 space-y-2 border border-orange-500/30">
      <div className="flex justify-between font-medium">
        <span>{item.side === 'LONG' ? '🟢' : '🔴'} {item.symbol} @ {item.price}</span>
        <span className="text-orange-300">{secondsLeft}s</span>
      </div>
      <div className="text-orange-200/70">{item.reasoning}</div>
      <div className="text-orange-200/70">
        TP {item.tp} | SL {item.sl} | {item.volume} lotes{item.volumeCapped ? ' (ajustado ao máximo permitido)' : ''} | Confiança {item.ai_confidence}%
      </div>
      <div className="text-orange-400/90 font-semibold">{item.disclaimer}</div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onApprove(item.id)}
          className="flex-1 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
        >
          Aprovar
        </button>
        <button
          onClick={() => onReject(item.id)}
          className="flex-1 px-3 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 text-white font-medium"
        >
          Rejeitar
        </button>
      </div>
    </li>
  );
}

export function TradeConfirmationPanel({ pending, history, enabled, onToggle, onApprove, onReject }: TradeConfirmationPanelProps) {
  return (
    <div className="rounded-lg border border-orange-600/40 bg-orange-950/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-orange-200">Estágio 2 — LIVE, confirmação manual por trade</h3>
          <p className="text-xs text-orange-200/70">
            A IA decide, você aprova ou rejeita cada entrada. Só envia ordem real após sua aprovação explícita.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-orange-200/80 cursor-pointer select-none">
          <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
          Ativado
        </label>
      </div>

      <div className="text-xs text-orange-400/90 font-semibold">{LIVE_ALERT_DISCLAIMER}</div>

      <div>
        <h4 className="text-xs font-medium text-orange-200/80 mb-1">Pendentes ({pending.length})</h4>
        {pending.length === 0 ? (
          <p className="text-xs text-orange-200/50">Nenhuma confirmação pendente.</p>
        ) : (
          <ul className="space-y-2 max-h-72 overflow-y-auto">
            {pending.map(item => (
              <PendingItem key={item.id} item={item} onApprove={onApprove} onReject={onReject} />
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4 className="text-xs font-medium text-orange-200/80 mb-1">Histórico</h4>
        {history.length === 0 ? (
          <p className="text-xs text-orange-200/50">Nenhum trade resolvido ainda.</p>
        ) : (
          <ul className="space-y-1 max-h-48 overflow-y-auto">
            {history.map(item => (
              <li key={`${item.id}-${item.resolvedAt}`} className="text-xs bg-black/10 rounded p-2 flex justify-between">
                <span>{item.side === 'LONG' ? '🟢' : '🔴'} {item.symbol} @ {item.price}</span>
                <span>{STATUS_LABEL[item.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
