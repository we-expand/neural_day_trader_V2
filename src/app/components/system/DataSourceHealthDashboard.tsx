import React, { useState, useEffect, useRef } from 'react';
import { Server, CheckCircle2, AlertTriangle, XCircle, Zap, Clock, Activity } from 'lucide-react';
import { getMT5Validator } from '@/app/services/MT5PriceValidator';
import { fetchDirectBinance } from '@/app/services/DirectBinanceService';

interface DataSourceStatus {
  name: string;
  status: 'online' | 'offline';
  responseTime: number | null; // ms reais, null quando não aplicável (ex: MT5 é boolean)
  successRate: number | null; // % real dos últimos checks desta sessão, null até ter histórico
  lastCheck: Date;
}

const HISTORY_WINDOW = 20;

/**
 * Monitor de saúde das fontes de dado — antes simulava 5 provedores
 * (MetaAPI, Trading Economics, S&P Global, Alpha Vantage, CoinGecko) com
 * `setTimeout(Math.random())` fingindo latência/taxa de sucesso/requisições
 * por dia, nenhuma chamada de rede real acontecia (auditoria 2026-07-29).
 * Reescrito pra só monitorar as 2 fontes que o caminho crítico realmente usa
 * — MetaAPI (MT5) e Binance (preço cripto real) — com checagem de verdade:
 * status de conexão real do MT5Validator, e round-trip real medido contra a
 * API pública da Binance. Taxa de sucesso é calculada sobre o histórico real
 * desta sessão (últimos 20 checks), não sorteada.
 */
export function DataSourceHealthDashboard() {
  const [sources, setSources] = useState<DataSourceStatus[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const historyRef = useRef<Record<string, boolean[]>>({ 'MetaAPI (MT5)': [], 'Binance (dado cripto real)': [] });

  const pushHistory = (name: string, ok: boolean) => {
    const arr = historyRef.current[name];
    arr.push(ok);
    if (arr.length > HISTORY_WINDOW) arr.shift();
  };

  const successRateFor = (name: string): number | null => {
    const arr = historyRef.current[name];
    if (arr.length === 0) return null;
    return Math.round((arr.filter(Boolean).length / arr.length) * 100);
  };

  const runHealthChecks = async () => {
    const now = new Date();

    // MetaAPI: status de conexão real (boolean), sem latência simulada.
    // getMT5Validator() lança se nunca foi inicializado com token/accountId
    // (usuário não conectou corretora ainda) — isso é "offline" de verdade,
    // não motivo pra travar o resto do health check.
    let mt5Connected = false;
    try {
      mt5Connected = getMT5Validator().getConnectionStatus();
    } catch {
      mt5Connected = false;
    }
    pushHistory('MetaAPI (MT5)', mt5Connected);

    // Binance: round-trip real medido contra a API pública.
    const binanceStart = performance.now();
    let binanceOk = false;
    try {
      const data = await fetchDirectBinance('BTCUSDT');
      binanceOk = data !== null;
    } catch {
      binanceOk = false;
    }
    const binanceLatency = Math.round(performance.now() - binanceStart);
    pushHistory('Binance (dado cripto real)', binanceOk);

    const results: DataSourceStatus[] = [
      {
        name: 'MetaAPI (MT5)',
        status: mt5Connected ? 'online' : 'offline',
        responseTime: null,
        successRate: successRateFor('MetaAPI (MT5)'),
        lastCheck: now
      },
      {
        name: 'Binance (dado cripto real)',
        status: binanceOk ? 'online' : 'offline',
        responseTime: binanceLatency,
        successRate: successRateFor('Binance (dado cripto real)'),
        lastCheck: now
      }
    ];

    setSources(results);
    setLastUpdate(now);
  };

  useEffect(() => {
    if (isMonitoring) {
      runHealthChecks();
      intervalRef.current = setInterval(runHealthChecks, 15000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMonitoring]);

  const stats = {
    online: sources.filter(s => s.status === 'online').length,
    offline: sources.filter(s => s.status === 'offline').length
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/30">
            <Server className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Status das Fontes de Dados</h3>
            <p className="text-slate-400 text-sm">
              Checagem real • Última atualização: {lastUpdate.toLocaleTimeString('pt-BR')}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsMonitoring(!isMonitoring)}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${
            isMonitoring
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
              : 'bg-zinc-800 hover:bg-zinc-700 text-slate-300'
          }`}
        >
          {isMonitoring ? (<><Zap className="w-4 h-4" />Monitorando</>) : (<><Activity className="w-4 h-4" />Pausado</>)}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <p className="text-emerald-400 text-xs font-semibold uppercase">Online</p>
          </div>
          <p className="text-white text-3xl font-bold">{stats.online}</p>
        </div>

        <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-5 h-5 text-red-400" />
            <p className="text-red-400 text-xs font-semibold uppercase">Offline</p>
          </div>
          <p className="text-white text-3xl font-bold">{stats.offline}</p>
        </div>
      </div>

      <div className="space-y-4">
        {sources.length === 0 ? (
          <div className="text-center py-8">
            <Server className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500">Verificando fontes de dados...</p>
          </div>
        ) : (
          sources.map(source => (
            <div
              key={source.name}
              className={`border rounded-xl p-4 transition-all ${
                source.status === 'online' ? 'bg-emerald-900/10 border-emerald-800/30' : 'bg-red-900/10 border-red-800/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {source.status === 'online' ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-red-400" />
                  )}
                  <div>
                    <h4 className="text-white font-bold text-lg">{source.name}</h4>
                    <p className="text-slate-400 text-xs mt-0.5">
                      Última verificação: {source.lastCheck.toLocaleTimeString('pt-BR')}
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 text-right">
                  {source.responseTime !== null && (
                    <div>
                      <p className="text-slate-500 text-xs flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3" /> Round-trip real
                      </p>
                      <p className={`text-lg font-bold font-mono ${
                        source.responseTime < 200 ? 'text-emerald-400' : source.responseTime < 600 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {source.responseTime}ms
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-slate-500 text-xs">Taxa de sucesso (sessão)</p>
                    <p className="text-lg font-bold text-white">
                      {source.successRate !== null ? `${source.successRate}%` : '—'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
