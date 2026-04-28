/**
 * 🔌 MT5 STATUS BADGE
 * 
 * Badge visual que mostra se o MT5 está conectado ou não
 */

import React, { useState, useEffect } from 'react';
import { Zap, ZapOff, Loader2 } from 'lucide-react';

export function MT5StatusBadge() {
  const [status, setStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [accountInfo, setAccountInfo] = useState<{ login?: string; broker?: string } | null>(null);

  useEffect(() => {
    checkMT5Connection();
  }, []);

  const checkMT5Connection = async () => {
    try {
      const token = localStorage.getItem('metaapi_token');
      const accountId = localStorage.getItem('metaapi_account_id');

      if (!token || !accountId) {
        setStatus('disconnected');
        return;
      }

      // Testar conexão
      const url = `https://mt-client-api-v1.new-york.agiliumtrade.ai/users/current/accounts/${accountId}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'auth-token': token,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStatus('connected');
        setAccountInfo({
          login: data.login,
          broker: data.brokerName,
        });
      } else {
        setStatus('disconnected');
      }
    } catch (error) {
      console.error('[MT5 Status] Erro ao verificar conexão:', error);
      setStatus('disconnected');
    }
  };

  if (status === 'checking') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-700/50 border border-gray-600 rounded-lg">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
        <span className="text-[10px] font-mono text-gray-400">MT5...</span>
      </div>
    );
  }

  if (status === 'connected') {
    return (
      <div 
        className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg"
        title={`Conectado: ${accountInfo?.login || ''} @ ${accountInfo?.broker || 'MT5'}`}
      >
        <Zap className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
          MT5 REAL
        </span>
      </div>
    );
  }

  return (
    <div 
      className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg"
      title="MT5 não conectado - Clique em 'MT5 REAL' para conectar"
    >
      <ZapOff className="w-3.5 h-3.5 text-red-400" />
      <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">
        OFFLINE
      </span>
    </div>
  );
}
