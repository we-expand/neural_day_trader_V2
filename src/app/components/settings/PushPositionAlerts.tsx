import React, { useEffect, useState } from 'react';
import { Smartphone, BellRing, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/app/contexts/AuthContext';
import {
  getPushSubscriptionStatus,
  subscribeToPush,
  unsubscribeFromPush,
  isRunningAsInstalledApp,
} from '@/lib/pushNotifications';

type Status = 'checking' | 'unsupported' | 'not-installed' | 'denied' | 'subscribed' | 'not-subscribed';

// Card real (não decorativo) — avisa o celular via push nativo do sistema
// quando o LLM Brain abre uma posição de verdade (não é o toggle
// "Alertas de trading" acima, que é só preferência de UI, sem
// mecanismo de entrega por trás).
export function PushPositionAlerts() {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>('checking');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPushSubscriptionStatus().then(setStatus);
  }, []);

  const handleEnable = async () => {
    if (!user?.id) return;
    setBusy(true);
    setError(null);
    const result = await subscribeToPush(user.id);
    setBusy(false);
    if (result.ok) {
      setStatus('subscribed');
    } else {
      setError(result.error || 'Falha ao ativar notificação.');
      setStatus(await getPushSubscriptionStatus());
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    await unsubscribeFromPush();
    setBusy(false);
    setStatus('not-subscribed');
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 shadow-lg">
      <div className="flex items-center gap-3 mb-4">
        <Smartphone className="w-5 h-5 text-emerald-400" />
        <h2 className="text-lg font-bold text-white">Aviso no celular</h2>
      </div>

      <p className="text-xs text-slate-500 mb-4">
        Receba uma notificação no seu iPhone toda vez que uma posição REAL for aberta pela IA,
        e acompanhe as posições abertas direto de um ícone na tela inicial.
      </p>

      {status === 'checking' && (
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Verificando...
        </div>
      )}

      {status === 'not-installed' && (
        <div className="rounded-lg border border-amber-800/40 bg-amber-950/30 p-3 text-xs text-amber-300 space-y-2">
          <p className="font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Passo 1: instale antes de ativar
          </p>
          <p>
            No iPhone (Safari): toque em <strong>Compartilhar</strong> (ícone de quadrado com seta) e depois em{' '}
            <strong>"Adicionar à Tela de Início"</strong>. Abra o app pelo ícone novo — só assim o iPhone libera
            a notificação (exigência da Apple, não é possível ativar direto pelo navegador).
          </p>
        </div>
      )}

      {status === 'unsupported' && (
        <p className="text-xs text-red-400">Este navegador não tem suporte a notificação push.</p>
      )}

      {status === 'denied' && (
        <p className="text-xs text-red-400">
          Notificação bloqueada nas configurações do iPhone. Ative em Ajustes → NDT Posições → Notificações.
        </p>
      )}

      {(status === 'not-subscribed' || status === 'subscribed') && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            {status === 'subscribed' ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Notificações ativas</span>
              </>
            ) : (
              <>
                <BellRing className="w-4 h-4 text-slate-400" />
                <span className="text-slate-400">Notificações desativadas</span>
              </>
            )}
          </div>
          <button
            onClick={status === 'subscribed' ? handleDisable : handleEnable}
            disabled={busy || !user?.id}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 ${
              status === 'subscribed'
                ? 'bg-zinc-800 text-slate-300 hover:bg-zinc-700 border border-zinc-700'
                : 'bg-emerald-600 text-white hover:bg-emerald-500'
            }`}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : status === 'subscribed' ? 'Desativar' : 'Ativar avisos'}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}

      {isRunningAsInstalledApp() && (
        <p className="text-[11px] text-slate-600 mt-3">✓ Rodando como app instalado na tela inicial.</p>
      )}
    </div>
  );
}
