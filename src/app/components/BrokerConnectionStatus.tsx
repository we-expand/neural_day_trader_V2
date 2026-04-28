import React, { useState, useEffect } from 'react';
import { CheckCircle, Wifi, WifiOff } from 'lucide-react';
import { brokerManager } from '@/app/services/brokers/BrokerAdapter';
import { useTradingContext } from '@/app/contexts/TradingContext';

/**
 * 🟢 BROKER CONNECTION STATUS
 * 
 * Mostra o status global de conexão com brokers
 * Detecta automaticamente MT5, Infinox, Binance, etc.
 */

export const BrokerConnectionStatus: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [brokerName, setBrokerName] = useState<string>('');
  const { config } = useTradingContext();
  
  // Verificar se MT5 está conectado via config
  const isMT5Connected = config.mt5?.accountId && config.mt5?.server;

  useEffect(() => {
    // Função para verificar status de conexão
    const checkConnection = () => {
      const hasConnection = brokerManager.hasConnectedAdapter() || isMT5Connected;
      const activeAdapter = brokerManager.getActiveAdapter();
      
      setIsConnected(hasConnection);
      
      // Priorizar nome da Infinox se MT5 estiver conectado
      if (isMT5Connected) {
        setBrokerName('Infinox');
      } else {
        setBrokerName(activeAdapter?.getName() || '');
      }
    };

    // Verificar imediatamente
    checkConnection();

    // Verificar a cada 5 segundos (reduzido de 2s para evitar sobrecarga)
    const interval = setInterval(checkConnection, 5000);

    // Limpar interval quando componente desmontar
    return () => {
      clearInterval(interval);
    };
  }, [isMT5Connected]);

  if (!isConnected) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs">
        <WifiOff className="w-3 h-3" />
        <span>Nenhum broker conectado</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
      {/* Logo Infinox */}
      {brokerName === 'Infinox' ? (
        <div className="flex items-center justify-center w-5 h-5">
          <img 
            src="https://infinox.com/uk/wp-content/uploads/2023/10/Infinox_Logo_Green-1.svg" 
            alt="Infinox"
            className="h-4 w-auto brightness-0 invert opacity-90"
            onError={(e) => {
              // Fallback para texto se logo não carregar
              e.currentTarget.outerHTML = '<span class="text-xs font-bold">IX</span>';
            }}
          />
        </div>
      ) : (
        <CheckCircle className="w-3 h-3" />
      )}
      <span className="font-bold">{brokerName}</span>
    </div>
  );
};