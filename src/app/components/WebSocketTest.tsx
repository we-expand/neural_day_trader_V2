/**
 * 🧪 COMPONENTE DE TESTE WebSocket
 * Para verificar se o BinancePollingService está funcionando
 */

import React, { useEffect, useState } from 'react';
import { binancePolling } from '@/app/services/BinancePollingService';

export function WebSocketTest() {
  const [updates, setUpdates] = useState(0);
  const [lastPrice, setLastPrice] = useState(0);
  const [lastPercent, setLastPercent] = useState(0);

  useEffect(() => {
    console.log('[WebSocketTest] 🧪 Iniciando teste do POLLING...');
    
    const unsubscribe = binancePolling.subscribe('BTCUSDT', (data) => {
      console.log('[WebSocketTest] 🎯 CALLBACK RECEBIDO (POLLING)!', {
        price: data.price,
        changePercent: data.changePercent,
        timestamp: new Date().toISOString()
      });
      
      setUpdates(prev => prev + 1);
      setLastPrice(data.price);
      setLastPercent(data.changePercent);
    });
    
    return () => {
      console.log('[WebSocketTest] 🧪 Cleanup');
      unsubscribe();
    };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: updates > 0 ? '#00ff00' : '#ff0066',
      color: updates > 0 ? '#000' : '#fff',
      padding: '20px',
      borderRadius: '8px',
      fontFamily: 'monospace',
      fontSize: '14px',
      zIndex: 30,
      fontWeight: 'bold'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>
        🔄 POLLING (REST API)
      </div>
      <div>Updates: {updates}</div>
      <div>Last Price: {lastPrice.toFixed(2)}</div>
      <div>Last %: {lastPercent.toFixed(2)}%</div>
      <div style={{ marginTop: '10px', fontSize: '11px', opacity: 0.8 }}>
        {updates === 0 ? '❌ Aguardando...' : '✅ FUNCIONANDO!'}
      </div>
    </div>
  );
}