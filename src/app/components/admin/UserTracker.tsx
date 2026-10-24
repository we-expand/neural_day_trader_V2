import React, { useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { projectId } from '../../../../utils/supabase/info';
import { supabase } from '@/lib/supabaseClient';

// 🚨 Reescrito 2026-09-09: componente existia pronto desde antes de
// 2026-08-03 mas nunca foi montado (ver auditoria em UserIntelligence.tsx) --
// decisão do Cleber ao ligar: base legal é o aceite dos Termos de Uso no
// cadastro (sem banner de opt-in separado), e o IP do usuário NUNCA mais é
// enviado a um terceiro (ipapi.co) direto do navegador -- geolocalização
// agora é resolvida no servidor (ver /telemetry/track em
// supabase/functions/server/index.ts), a partir do IP real da requisição,
// não de um valor que o client poderia forjar.
const HEARTBEAT_INTERVAL_MS = 3 * 60 * 1000; // manter "online agora" fresco

export function UserTracker() {
  const { user } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) return;

    const sendHeartbeat = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) return;

        const device = {
          os: navigator.platform,
          browser: navigator.userAgent,
          screen: `${window.screen.width}x${window.screen.height}`,
          // @ts-ignore -- API experimental, sem tipo padrão no lib.dom
          connection: navigator.connection?.effectiveType || 'unknown',
          language: navigator.language,
        };

        await fetch(`https://${projectId}.supabase.co/functions/v1/server/telemetry/track`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ device }),
        });
      } catch (error) {
        console.warn('[UserTracker] Falha ao enviar heartbeat de telemetria:', error);
      }
    };

    sendHeartbeat();
    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') sendHeartbeat();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [user]);

  return null; // Componente invisível
}
