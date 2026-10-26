import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Settings2, Volume2, VolumeX } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { backtestDataService, type Timeframe } from '@/app/services/BacktestDataService';
import {
  computeVolatilityForecast,
  VolatilityForecastInsufficientDataError,
  VOLATILITY_REGIME_LABEL,
  VOLATILITY_REGIME_COLOR,
  VOLATILITY_PERCENTILE_MIN,
  VOLATILITY_PERCENTILE_MAX,
  VOLATILITY_PERCENTILE_DEFAULT,
  type VolatilityForecastResult,
} from '@/app/utils/volatilityForecast';

const MS_PER_BAR: Record<Timeframe, number> = {
  '1m': 60_000, '5m': 300_000, '15m': 900_000,
  '1h': 3_600_000, '4h': 14_400_000, '1d': 86_400_000,
};

const CANDLES_NEEDED = 200; // amostra folgada acima do mínimo (60) pra distribuição de percentil ter sentido

interface VolatilityConfig {
  enabled: boolean;
  percentileThreshold: number;
  voiceAlertsEnabled: boolean;
}

const CONFIG_STORAGE_KEY = 'neural_volatility_forecast_config';
const CONFIG_LOG_KEY = 'neural_volatility_forecast_config_log';
const CONFIG_LOG_MAX = 50;

function loadConfig(): VolatilityConfig {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        enabled: parsed.enabled ?? true,
        percentileThreshold: Math.min(
          VOLATILITY_PERCENTILE_MAX,
          Math.max(VOLATILITY_PERCENTILE_MIN, parsed.percentileThreshold ?? VOLATILITY_PERCENTILE_DEFAULT),
        ),
        voiceAlertsEnabled: parsed.voiceAlertsEnabled ?? false,
      };
    }
  } catch {
    // localStorage indisponível (modo privado, etc) — cai pro default
  }
  return { enabled: true, percentileThreshold: VOLATILITY_PERCENTILE_DEFAULT, voiceAlertsEnabled: false };
}

/**
 * Log auditável de config (MVP local — persiste no navegador do usuário).
 * NOTA: uma versão futura deveria gravar em Supabase (mesma disciplina do
 * `ai_trades_audit_log`) pra o log sobreviver a troca de dispositivo/navegador
 * e ficar visível pro operador da plataforma, não só pro usuário. Deixado
 * como próximo passo — este MVP já cumpre "toda mudança fica rastreável",
 * só ainda não é centralizado.
 */
function appendConfigLog(entry: { field: string; from: unknown; to: unknown }) {
  try {
    const raw = localStorage.getItem(CONFIG_LOG_KEY);
    const log = raw ? JSON.parse(raw) : [];
    log.unshift({ ...entry, at: new Date().toISOString() });
    localStorage.setItem(CONFIG_LOG_KEY, JSON.stringify(log.slice(0, CONFIG_LOG_MAX)));
  } catch {
    // não bloqueia a UI se o log falhar
  }
  console.log('[VolatilityForecast] config alterada:', entry);
}

function saveConfig(config: VolatilityConfig) {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignora se localStorage indisponível
  }
}

interface VolatilityForecastCardProps {
  asset: string;
  timeframe: Timeframe;
  speak?: (text: string, priority?: 'low' | 'normal' | 'high') => void;
}

/**
 * Previsão de Volatilidade (EWMA) — funcionalidade #1 do roadmap da aba
 * "Inteligência de Mercado" (veredito llm-council 2026-09-09). Ver
 * `src/app/utils/volatilityForecast.ts` pro método e a disciplina de dado
 * real por trás. NUNCA prevê direção — só amplitude esperada de movimento.
 */
export function VolatilityForecastCard({ asset, timeframe, speak }: VolatilityForecastCardProps) {
  const [config, setConfig] = useState<VolatilityConfig>(() => loadConfig());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [result, setResult] = useState<VolatilityForecastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSpokenRegimeRef = useRef<string | null>(null);

  useEffect(() => {
    if (!config.enabled) {
      setResult(null);
      setError(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const end = Date.now();
        const start = end - CANDLES_NEEDED * MS_PER_BAR[timeframe] * 1.5; // folga pra gaps de calendário
        const res = await backtestDataService.fetchHistoricalData(asset, new Date(start), new Date(end), timeframe);
        if (cancelled) return;
        const forecast = computeVolatilityForecast(
          res.candles.map((c) => ({ time: c.time, close: c.close })),
          asset,
          config.percentileThreshold,
        );
        setResult(forecast);

        if (config.voiceAlertsEnabled && speak && (forecast.regime === 'ALTA' || forecast.regime === 'EXTREMA')) {
          if (lastSpokenRegimeRef.current !== `${asset}:${forecast.regime}`) {
            lastSpokenRegimeRef.current = `${asset}:${forecast.regime}`;
            const priority = forecast.regime === 'EXTREMA' ? 'high' : 'normal';
            speak(
              `Atenção. Volatilidade de ${asset} entrou em zona ${forecast.regime === 'EXTREMA' ? 'extrema' : 'alta'}. Considere ajustar o tamanho da posição.`,
              priority,
            );
          }
        } else if (forecast.regime === 'BAIXA' || forecast.regime === 'NORMAL') {
          lastSpokenRegimeRef.current = null; // permite falar de novo se voltar a subir depois
        }
      } catch (e: any) {
        if (cancelled) return;
        setResult(null);
        if (e instanceof VolatilityForecastInsufficientDataError) {
          setError(e.message);
        } else {
          setError(e?.message || 'Falha ao buscar candles reais para o cálculo de volatilidade.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [asset, timeframe, config.enabled, config.percentileThreshold, config.voiceAlertsEnabled, speak]);

  const chartData = useMemo(() => {
    if (!result) return [];
    return result.series.slice(-100).map((p) => ({
      time: new Date(p.time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      vol: p.ewmaVol,
    }));
  }, [result]);

  const updateConfig = (patch: Partial<VolatilityConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      Object.entries(patch).forEach(([field, to]) => {
        appendConfigLog({ field, from: (prev as any)[field], to });
      });
      saveConfig(next);
      return next;
    });
  };

  const regimeColor = result ? VOLATILITY_REGIME_COLOR[result.regime] : '#6b7280';

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
          <Activity className="w-4 h-4" /> Previsão de Volatilidade (EWMA)
        </h3>
        <button
          onClick={() => setSettingsOpen((v) => !v)}
          className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
          title="Configurações"
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>

      {settingsOpen && (
        <div className="mb-4 p-4 rounded-xl bg-neutral-800/40 border border-neutral-700 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-300">Ativar previsão de volatilidade</span>
            <button
              onClick={() => updateConfig({ enabled: !config.enabled })}
              className={`w-10 h-5 rounded-full transition-colors relative ${config.enabled ? 'bg-emerald-600' : 'bg-neutral-700'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${config.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-300 flex items-center gap-1.5">
              {config.voiceAlertsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              Alerta por voz em vol. alta/extrema
            </span>
            <button
              onClick={() => updateConfig({ voiceAlertsEnabled: !config.voiceAlertsEnabled })}
              className={`w-10 h-5 rounded-full transition-colors relative ${config.voiceAlertsEnabled ? 'bg-emerald-600' : 'bg-neutral-700'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${config.voiceAlertsEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          <div className="text-xs">
            <div className="flex items-center justify-between text-neutral-300 mb-1">
              <span>Sensibilidade (percentil de corte)</span>
              <span className="font-mono text-white">{config.percentileThreshold}º</span>
            </div>
            <input
              type="range"
              min={VOLATILITY_PERCENTILE_MIN}
              max={VOLATILITY_PERCENTILE_MAX}
              step={1}
              value={config.percentileThreshold}
              onChange={(e) => updateConfig({ percentileThreshold: Number(e.target.value) })}
              className="w-full accent-emerald-500"
            />
            <p className="text-[10px] text-neutral-500 mt-1">
              Travado entre {VOLATILITY_PERCENTILE_MIN}º e {VOLATILITY_PERCENTILE_MAX}º percentil da
              distribuição histórica real do próprio ativo — não é um número livre, pra evitar recalibrar
              até "achar" um valor que pareça funcionar numa amostra pequena.
            </p>
          </div>
        </div>
      )}

      {!config.enabled && (
        <div className="text-center py-6 text-neutral-500 text-xs">
          Previsão de volatilidade desativada para este ativo. Ative em Configurações.
        </div>
      )}

      {config.enabled && loading && !result && (
        <div className="text-center py-6 text-neutral-500 text-xs">Calculando volatilidade real...</div>
      )}

      {config.enabled && error && (
        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded p-3 text-center text-xs text-yellow-100">
          {error}
        </div>
      )}

      {config.enabled && result && (
        <>
          <div className="flex items-center justify-between mb-3">
            <div>
              <span
                className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide"
                style={{ backgroundColor: `${regimeColor}22`, color: regimeColor, border: `1px solid ${regimeColor}55` }}
              >
                {VOLATILITY_REGIME_LABEL[result.regime]}
              </span>
              <p className="text-[10px] text-neutral-500 mt-1">
                Percentil {result.percentileOfCurrent.toFixed(0)} · amostra de {result.sampleSize} barras reais ({timeframe})
              </p>
            </div>
          </div>

          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="volGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={regimeColor} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={regimeColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" hide />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ background: '#171717', border: '1px solid #333', borderRadius: 8, fontSize: 11 }}
                  formatter={(v: number) => [v.toExponential(2), 'Vol EWMA']}
                />
                <Area type="monotone" dataKey="vol" stroke={regimeColor} strokeWidth={2} fill="url(#volGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <p className="text-[10px] text-neutral-500 mt-2">
            Amplitude esperada de movimento — não é previsão de direção. Método: EWMA (λ=0.94, RiskMetrics)
            sobre retornos reais de {asset}.
          </p>
        </>
      )}
    </div>
  );
}
