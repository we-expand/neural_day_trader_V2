import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Fingerprint, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { startRegistration } from '@simplewebauthn/browser';
import { supabase } from '@/lib/supabaseClient';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { useAuth } from '@/app/contexts/AuthContext';

const WEBAUTHN_FUNCTIONS_BASE = `https://${projectId}.supabase.co/functions/v1/webauthn`;
const TRANSITION = { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const };
const BLUR_BG = "backdrop-blur-2xl bg-slate-950/40 border border-white/5 shadow-2xl";

function dismissKeyFor(email: string) {
  return `passkey_prompt_dismissed_${email.toLowerCase()}`;
}

/**
 * Convite pra cadastrar biometria (Passkey/WebAuthn), mostrado DENTRO da
 * plataforma já autenticada — nunca dentro do AuthOverlay, que é desmontado
 * assim que a sessão do Supabase aparece (o AuthContext seta `user` via
 * onAuthStateChange antes de qualquer checagem pós-login ter chance de
 * rodar, ver App.tsx). Roda uma vez por sessão de usuário; "Agora não"
 * grava dispensa permanente por e-mail no localStorage.
 */
export function PasskeySetupPrompt() {
  const { user, session } = useAuth();
  const [show, setShow] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setChecked(false);
    setShow(false);

    const email = user?.email;
    const webauthnSupported = typeof window !== 'undefined' && !!window.PublicKeyCredential;

    if (!user?.id || !email || !webauthnSupported) {
      setChecked(true);
      return;
    }
    if (window.localStorage.getItem(dismissKeyFor(email)) === '1') {
      setChecked(true);
      return;
    }

    (async () => {
      try {
        const { data: { session: freshSession } } = await supabase.auth.getSession();
        const token = freshSession?.access_token || session?.access_token;
        if (!token) return;

        const res = await fetch(`${WEBAUTHN_FUNCTIONS_BASE}/credentials`, {
          headers: {
            'content-type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: publicAnonKey,
          },
        });
        const body = await res.json().catch(() => ({}));
        const hasPasskey = res.ok && Array.isArray(body?.credentials) && body.credentials.length > 0;
        if (!cancelled && !hasPasskey) {
          setShow(true);
        }
      } catch {
        // Falha ao checar passkeys não deve incomodar o usuário — só não convida agora.
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id, user?.email]);

  const handleSetupNow = async () => {
    if (!user?.email) return;
    setRegistering(true);
    try {
      const { data: { session: freshSession } } = await supabase.auth.getSession();
      const token = freshSession?.access_token;
      if (!token) throw new Error('Sessão expirada, tente novamente.');

      const optionsRes = await fetch(`${WEBAUTHN_FUNCTIONS_BASE}/register-options`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: publicAnonKey,
        },
      });
      const optionsBody = await optionsRes.json();
      if (!optionsRes.ok) throw new Error(optionsBody?.error || 'Falha ao iniciar cadastro');

      const attResp = await startRegistration(optionsBody.options);

      const ua = navigator.userAgent;
      const deviceName = /iPhone|iPad/.test(ua) ? 'iPhone/iPad'
        : /Android/.test(ua) ? 'Android'
        : /Mac/.test(ua) ? 'Mac'
        : /Windows/.test(ua) ? 'Windows'
        : 'Dispositivo';

      const verifyRes = await fetch(`${WEBAUTHN_FUNCTIONS_BASE}/register-verify`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: publicAnonKey,
        },
        body: JSON.stringify({ response: attResp, deviceName }),
      });
      const verifyBody = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok) throw new Error(verifyBody?.error || 'Falha ao cadastrar passkey');

      toast.success("Biometria cadastrada!", { description: "Da próxima vez, entre sem senha." });
      setShow(false);
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        toast.error("Cadastro cancelado", { description: "Nenhuma biometria foi confirmada." });
      } else {
        toast.error("Não foi possível cadastrar biometria", { description: err?.message || 'Tente novamente depois em Configurações.' });
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleDismiss = () => {
    if (user?.email) {
      window.localStorage.setItem(dismissKeyFor(user.email), '1');
    }
    setShow(false);
  };

  if (!checked) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-md flex items-center justify-center px-6"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={TRANSITION}
            className={`${BLUR_BG} rounded-2xl p-8 max-w-md w-full text-center`}
          >
            <div className="w-14 h-14 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mx-auto mb-5">
              <Fingerprint className="w-7 h-7 text-blue-400" />
            </div>
            <h2 className="text-2xl font-light text-white mb-2">Ativar login por biometria?</h2>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              Use Face ID, Touch ID ou Windows Hello pra entrar sem senha da
              próxima vez. A biometria nunca sai do seu dispositivo — o
              servidor só guarda uma chave pública.
            </p>

            <button
              onClick={handleSetupNow}
              disabled={registering}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold rounded-full px-6 py-3.5 transition-colors mb-3"
            >
              {registering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Configurar agora
            </button>
            <button
              onClick={handleDismiss}
              disabled={registering}
              className="w-full text-slate-500 hover:text-white disabled:opacity-60 text-xs uppercase tracking-widest transition-colors py-2"
            >
              Agora não
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
