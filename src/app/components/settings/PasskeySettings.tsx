import React, { useEffect, useState, useCallback } from 'react';
import { Fingerprint, Trash2, Plus, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { startRegistration } from '@simplewebauthn/browser';
import { supabase } from '@/lib/supabaseClient';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { useAuth } from '@/app/contexts/AuthContext';

const FUNCTIONS_BASE = `https://${projectId}.supabase.co/functions/v1/webauthn`;

interface PasskeyRow {
  id: string;
  device_name: string | null;
  device_type: string | null;
  created_at: string;
  last_used_at: string | null;
}

async function authedFetch(path: string, init: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || publicAnonKey;
  const res = await fetch(`${FUNCTIONS_BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: publicAnonKey,
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error || `Falha na requisição (${res.status})`);
  }
  return body;
}

export function PasskeySettings() {
  const { user } = useAuth();
  const [passkeys, setPasskeys] = useState<PasskeyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadPasskeys = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const body = await authedFetch('/credentials');
      setPasskeys(body.credentials ?? []);
    } catch (err: any) {
      setError(err?.message ?? 'Falha ao carregar passkeys');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadPasskeys();
  }, [loadPasskeys]);

  const handleRegister = async () => {
    setRegistering(true);
    setError(null);
    setSuccess(null);
    try {
      const { options } = await authedFetch('/register-options', { method: 'POST' });
      const attResp = await startRegistration(options);

      const deviceName = (() => {
        const ua = navigator.userAgent;
        if (/iPhone|iPad/.test(ua)) return 'iPhone/iPad';
        if (/Android/.test(ua)) return 'Android';
        if (/Mac/.test(ua)) return 'Mac';
        if (/Windows/.test(ua)) return 'Windows';
        return 'Dispositivo';
      })();

      await authedFetch('/register-verify', {
        method: 'POST',
        body: JSON.stringify({ response: attResp, deviceName }),
      });

      setSuccess('Passkey cadastrada com sucesso.');
      await loadPasskeys();
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        setError('Cadastro cancelado ou não autorizado pelo dispositivo.');
      } else {
        setError(err?.message ?? 'Falha ao cadastrar passkey');
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    setSuccess(null);
    try {
      await authedFetch(`/credentials/${id}`, { method: 'DELETE' });
      setPasskeys((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      setError(err?.message ?? 'Falha ao remover passkey');
    }
  };

  const webauthnSupported = typeof window !== 'undefined' && !!window.PublicKeyCredential;

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 shadow-lg">
      <div className="flex items-center gap-3 mb-4">
        <Fingerprint className="w-5 h-5 text-emerald-400" />
        <h2 className="text-lg font-bold text-white">Login por Biometria (Passkey)</h2>
      </div>

      <p className="text-xs text-slate-500 mb-4">
        Entre com Face ID, Touch ID ou Windows Hello — sem senha. A biometria nunca
        sai do seu dispositivo: o servidor só guarda uma chave pública, nunca a
        digital em si.
      </p>

      {!webauthnSupported && (
        <div className="flex items-start gap-2 bg-amber-950/40 border border-amber-900 rounded-lg p-3 mb-4 text-amber-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          Este navegador/dispositivo não suporta passkeys (WebAuthn).
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-red-950/40 border border-red-900 rounded-lg p-3 mb-4 text-red-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-start gap-2 bg-emerald-950/40 border border-emerald-900 rounded-lg p-3 mb-4 text-emerald-300 text-xs">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
          {success}
        </div>
      )}

      <div className="space-y-2 mb-4">
        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
          </div>
        ) : passkeys.length === 0 ? (
          <p className="text-slate-500 text-sm">Nenhuma passkey cadastrada ainda.</p>
        ) : (
          passkeys.map((pk) => (
            <div
              key={pk.id}
              className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2"
            >
              <div>
                <p className="text-sm text-white font-medium">{pk.device_name || 'Dispositivo'}</p>
                <p className="text-xs text-slate-500">
                  Cadastrada em {new Date(pk.created_at).toLocaleDateString('pt-BR')}
                  {pk.last_used_at ? ` · último uso ${new Date(pk.last_used_at).toLocaleDateString('pt-BR')}` : ''}
                </p>
              </div>
              <button
                onClick={() => handleDelete(pk.id)}
                className="text-slate-500 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-950/40"
                title="Remover passkey"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      <button
        onClick={handleRegister}
        disabled={registering || !webauthnSupported}
        className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-slate-500 text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition-colors"
      >
        {registering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        Cadastrar biometria neste dispositivo
      </button>
    </div>
  );
}
