/**
 * 🔧 MT5 PRICE VALIDATOR DASHBOARD
 * Interface visual para conectar e validar preços com o MT5
 */

import { useState, useEffect } from 'react';
import { Shield, CheckCircle, AlertTriangle, Wifi, WifiOff, TrendingUp, DollarSign } from 'lucide-react';
import { getMT5Validator, ValidatedPrice, ValidationResult } from '@/app/services/MT5PriceValidator';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface Props {
  className?: string;
}

export const MT5ValidatorDashboard = ({ className = '' }: Props) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [apiToken, setApiToken] = useState('');
  const [accountId, setAccountId] = useState('');
  const [validatedPrices, setValidatedPrices] = useState<ValidatedPrice[]>([]);
  const [sp500Data, setSp500Data] = useState<{
    price: number;
    changePercent: number;
    source: 'mt5' | 'fallback';
  } | null>(null);

  // Lista de símbolos para validar
  const symbols = ['BTC', 'ETH', 'SPX', 'EURUSD', 'GOLD'];

  /**
   * Conecta ao MT5
   */
  const handleConnect = async () => {
    if (!apiToken || !accountId) {
      toast.error('Preencha o Token e Account ID');
      return;
    }

    setIsConnecting(true);

    try {
      const validator = getMT5Validator(apiToken, accountId);
      const connected = await validator.connect();

      if (connected) {
        setIsConnected(true);
        toast.success('Conectado ao MT5 com sucesso!');
        
        // Buscar preços iniciais
        await fetchPrices();
        await fetchSP500();
      } else {
        toast.error('Falha ao conectar ao MT5');
      }
    } catch (error) {
      console.error('[MT5 Dashboard] Erro ao conectar:', error);
      toast.error('Erro ao conectar: ' + (error as Error).message);
    } finally {
      setIsConnecting(false);
    }
  };

  /**
   * Desconecta do MT5
   */
  const handleDisconnect = async () => {
    try {
      const validator = getMT5Validator();
      await validator.disconnect();
      setIsConnected(false);
      setValidatedPrices([]);
      setSp500Data(null);
      toast.info('Desconectado do MT5');
    } catch (error) {
      console.error('[MT5 Dashboard] Erro ao desconectar:', error);
    }
  };

  /**
   * Busca preços validados
   */
  const fetchPrices = async () => {
    try {
      const validator = getMT5Validator();
      const prices = await validator.getValidatedPrices(symbols);
      setValidatedPrices(prices);
    } catch (error) {
      console.error('[MT5 Dashboard] Erro ao buscar preços:', error);
    }
  };

  /**
   * Busca dados do S&P 500
   */
  const fetchSP500 = async () => {
    try {
      const validator = getMT5Validator();
      const data = await validator.getSP500Data();
      setSp500Data(data);
    } catch (error) {
      console.error('[MT5 Dashboard] Erro ao buscar S&P 500:', error);
    }
  };

  /**
   * Atualização automática a cada 5 segundos quando conectado
   */
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      fetchPrices();
      fetchSP500();
    }, 5000);

    return () => clearInterval(interval);
  }, [isConnected]);

  return (
    <div className={`bg-neutral-950 text-white p-6 rounded-2xl border border-neutral-800 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
            <Shield className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white uppercase tracking-wide">MT5 Price Validator</h3>
            <p className="text-sm text-neutral-400">Validação de preços em tempo real</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-lg ${
            isConnected
              ? 'bg-emerald-500/20 border border-emerald-500/30'
              : 'bg-red-500/20 border border-red-500/30'
          }`}>
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-emerald-400 uppercase">Conectado</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-red-400" />
                <span className="text-xs font-bold text-red-400 uppercase">Desconectado</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Formulário de Conexão */}
      {!isConnected && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 mb-6"
        >
          <h4 className="text-sm font-bold text-white uppercase mb-4">Credenciais MetaAPI</h4>
          
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">
                API Token
              </label>
              <input
                type="password"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder="seu-metaapi-token-aqui"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">
                Account ID
              </label>
              <input
                type="text"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                placeholder="seu-account-id-mt5"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className={`w-full px-4 py-3 rounded-lg font-bold text-sm uppercase transition-all ${
                isConnecting
                  ? 'bg-neutral-700 text-neutral-400 cursor-not-allowed'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-lg shadow-cyan-500/30'
              }`}
            >
              {isConnecting ? 'Conectando...' : 'Conectar ao MT5'}
            </button>
          </div>

          <p className="text-xs text-neutral-500 mt-3 leading-relaxed">
            <strong className="text-amber-400">Nota:</strong> Use suas credenciais da MetaAPI (metaapi.cloud). 
            O token e account ID podem ser obtidos no painel de controle da MetaAPI.
          </p>
        </motion.div>
      )}

      {/* Dashboard de Preços Validados */}
      {isConnected && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          {/* S&P 500 em Destaque */}
          {sp500Data && (
            <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-400" />
                  <h4 className="text-lg font-bold text-white uppercase">S&P 500</h4>
                </div>
                <div className={`text-xs font-bold px-2 py-1 rounded ${
                  sp500Data.source === 'mt5'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {sp500Data.source === 'mt5' ? 'MT5' : 'FALLBACK'}
                </div>
              </div>

              <div className="flex items-baseline gap-4">
                <div className="text-3xl font-bold text-white">
                  {sp500Data.price.toFixed(2)}
                </div>
                <div className={`text-lg font-bold ${
                  sp500Data.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {sp500Data.changePercent >= 0 ? '+' : ''}{sp500Data.changePercent.toFixed(2)}%
                </div>
              </div>

              <p className="text-xs text-neutral-400 mt-2">
                Atualizado em tempo real via {sp500Data.source === 'mt5' ? 'MetaTrader 5' : 'dados de mercado'}
              </p>
            </div>
          )}

          {/* Tabela de Preços Validados */}
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-neutral-800">
              <h4 className="text-sm font-bold text-white uppercase">Preços Validados</h4>
            </div>

            <div className="divide-y divide-neutral-800">
              {validatedPrices.map((price) => (
                <div key={price.symbol} className="p-4 hover:bg-neutral-800/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        price.isValid ? 'bg-emerald-500' : 'bg-amber-500'
                      }`} />
                      <div>
                        <div className="font-bold text-white">{price.symbol}</div>
                        <div className="text-xs text-neutral-400">
                          Bid: {price.bid.toFixed(2)} • Ask: {price.ask.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-bold text-white">
                        ${price.price.toFixed(2)}
                      </div>
                      <div className={`text-xs font-bold ${
                        price.source === 'mt5'
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }`}>
                        {price.source.toUpperCase()}
                      </div>
                    </div>
                  </div>

                  {/* Spread */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="text-xs text-neutral-500">
                      Spread: {price.spread.toFixed(2)} ({((price.spread / price.price) * 100).toFixed(3)}%)
                    </div>
                    <div className="text-xs text-neutral-600">
                      • {new Date(price.timestamp).toLocaleTimeString('pt-BR')}
                    </div>
                  </div>
                </div>
              ))}

              {validatedPrices.length === 0 && (
                <div className="p-8 text-center text-neutral-500">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhum preço disponível</p>
                </div>
              )}
            </div>
          </div>

          {/* Ações */}
          <div className="flex gap-3">
            <button
              onClick={fetchPrices}
              className="flex-1 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg font-bold text-sm uppercase transition-all"
            >
              Atualizar Preços
            </button>
            <button
              onClick={handleDisconnect}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-sm uppercase transition-all"
            >
              Desconectar
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};
