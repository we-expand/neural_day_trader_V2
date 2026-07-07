import React, { useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { projectId } from '../../../../utils/supabase/info';

export function UserTracker() {
  const { user } = useAuth();

  useEffect(() => {
    const trackUser = async () => {
      try {
        // Safe check: only track if user exists
        if (!user) return;
        
        // Verifica se já trackeou nesta sessão para não spamar o banco
        const sessionTracked = sessionStorage.getItem('nt_tracked');
        if (sessionTracked) return;

        // 1. Coleta dados de IP e Geolocalização
        const ipResponse = await fetch('https://ipapi.co/json/');
        const ipData = await ipResponse.json();

        // 2. Coleta dados do Dispositivo
        const userAgent = navigator.userAgent;
        const platform = navigator.platform;
        const language = navigator.language;
        const screenRes = `${window.screen.width}x${window.screen.height}`;
        // @ts-ignore
        const connection = navigator.connection ? navigator.connection.effectiveType : 'unknown';

        // 3. Monta o Payload
        const fingerprint = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            user_email: user?.email || 'Visitante Anônimo', // Se estiver logado
            user_id: user?.id || 'anon',
            ip: ipData.ip,
            city: ipData.city,
            region: ipData.region,
            country: ipData.country_name,
            provider: ipData.org,
            device: {
                os: platform,
                browser: userAgent,
                screen: screenRes,
                connection: connection,
                language: language
            }
        };

        // 4. Envia para o Servidor (Telemetria)
        await fetch(`https://${projectId}.supabase.co/functions/v1/server/telemetry/track`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Authorization headers if needed, but this is a public tracking endpoint
            },
            body: JSON.stringify({ fingerprint })
        });
        
        // Marca como trackeado na sessão
        sessionStorage.setItem('nt_tracked', 'true');
        console.log('Dados de telemetria enviados ao Neural Core.');

      } catch (error) {
        console.error('Falha na telemetria:', error);
      }
    };

    trackUser();
  }, [user]);

  return null; // Componente invisível
}