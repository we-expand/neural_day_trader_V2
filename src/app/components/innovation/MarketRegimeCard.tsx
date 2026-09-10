import React, { useEffect, useRef, useState } from 'react';
import { Compass, Settings2 } from 'lucide-react';
import type { MarketScoreResult } from '@/app/services/MarketScoreEngine';

/**
 * Classificador de Regime de Mercado — funcionalidade #2 do roadmap da aba
 * "Inteligência de Mercado" (veredito llm-council, 2026-09-09).
 *
 * NÃO prevê nada — classifica o PRESENTE (tendência/lateral/indefinido) a
 * partir de ADX + largura de Bandas de Bollinger sobre candle real, cálculo
 * que já existe e roda em produção dentro do `MarketScoreEngine`
 * (`detectRegime`). Este card só reaproveita `scoreResult`, já calculado
 * pela página, e adiciona explicação qualitativa por voz — sem recalcular
 * nada, sem prometer edge de direção.
 */

const CONFIG_STORAGE_KEY = 'neural_market_regime_config';
const CONFIG_LOG_KEY = 'neural_market_regime_config_log';
const CONFIG_LOG_MAX = 50;

interface RegimeConfig {
  enabled: boolean;
}

function loadConfig(): RegimeConfig {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { enabled: parsed.enabled ?? true };
    }
  } catch {
    // localStorage indisponível — cai pro default
  }
  return { enabled: true };
}

function saveConfig(config: RegimeConfig) {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignora se indisponível
  }
}

function appendConfigLog(entry: { field: string; from: unknown; to: unknown }) {
  try {
    const raw = localStorage.getItem(CONFIG_LOG_KEY);
    const log = raw ? JSON.parse(raw) : [];
    log.unshift({ ...entry, at: new Date().toISOString() });
    localStorage.setItem(CONFIG_LOG_KEY, JSON.stringify(log.slice(0, CONFIG_LOG_MAX)));
  } catch {
    // não bloqueia UI
  }
  console.log('[MarketRegime] config alterada:', entry);
}

const REGIME_LABEL: Record<string, string> = {
  TENDENCIA: 'Tendência',
  LATERAL: 'Lateral',
  INDEFINIDO: 'Indefinido',
};

const REGIME_COLOR: Record<string, string> = {
  TENDENCIA: '#22c55e',
  LATERAL: '#f59e0b',
  INDEFINIDO: '#6b7280',
};

interface MarketRegimeCardProps {
  asset: string;
  scoreResult: MarketScoreResult | null;
  speak?: (text: string, priority?: 'low' | 'normal' | 'high') => void;
}

export function MarketRegimeCard({ asset, scoreResult, speak }: MarketRegimeCardProps) {
  const [config, setConfig] = useState<RegimeConfig>(() => loadConfig());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const lastSpokenRegimeRef = useRef<string | null>(null);

  const hasReal = !!scoreResult && (scoreResult.provenance === 'real' || scoreResult.provenance === 'stale');
  const regime = scoreResult?.regime ?? null;
  const adx = scoreResult?.indicators.adx ?? null;
  const volumeRatio = scoreResult?.indicators.volumeRatio ?? null;

  // Fala uma vez por mudança de regime real, não a cada re-render (evita spam).
  useEffect(() => {
    if (!config.enabled || !speak || !hasReal || !regime) return;
    const key = `${asset}:${regime}`;
    if (lastSpokenRegimeRef.current === key) return;
    lastSpokenRegimeRef.current = key;

    const volumeTxt = volumeRatio == null ? '' : volumeRatio > 1.2 ? ', com volume acima da média' : volumeRatio < 0.8 ? ', com volume abaixo da média' : '';
    if (regime === 'TENDENCIA') {
      speak(`${asset} entrou em regime de tendência${volumeTxt}. Reversões merecem confirmação extra antes de considerar entrada contrária.`, 'low');
    } else if (regime === 'LATERAL') {
      speak(`${asset} está em regime lateral${volumeTxt}. Rompimentos podem ser falsos até confirmação de volume.`, 'low');
    }
  }, [asset, regime, hasReal, volumeRatio, config.enabled, speak]);

  const updateConfig = (patch: Partial<RegimeConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      Object.entries(patch).forEach(([field, to]) => {
        appendConfigLog({ field, from: (prev as any)[field], to });
      });
      saveConfig(next);
      return next;
    });
  };

  const color = regime ? REGIME_COLOR[regime] ?? '#6b7280' : '#6b7280';

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
          <Compass className="w-4 h-4" /> Regime de Mercado
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
            <span className="text-neutral-300">Ativar card + narração de regime</span>
            <button
              onClick={() => updateConfig({ enabled: !config.enabled })}
              className={`w-10 h-5 rounded-full transition-colors relative ${config.enabled ? 'bg-emerald-600' : 'bg-neutral-700'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${config.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          <p className="text-[10px] text-neutral-500">
            Este card é descritivo (classifica o presente via ADX + Bandas de Bollinger reais) —
            não tem threshold configurável porque não é um alarme, é contexto.
          </p>
        </div>
      )}

      {!config.enabled && (
        <div className="text-center py-6 text-neutral-500 text-xs">Card desativado. Ative em Configurações.</div>
      )}

      {config.enabled && !hasReal && (
        <div className="text-center py-6 text-neutral-500 text-xs">Calculando regime real de {asset}...</div>
      )}

      {config.enabled && hasReal && regime && (
        <>
          <span
            className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide"
            style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}55` }}
          >
            {REGIME_LABEL[regime] ?? regime}
          </span>
          <p className="text-[10px] text-neutral-500 mt-1">
            Confiança do score: {scoreResult!.confidence}% · fonte: {scoreResult!.provenance === 'stale' ? 'candle real (desatualizado)' : 'candle real'}
          </p>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-neutral-800/40 rounded-lg p-3">
              <p className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">ADX</p>
              <p className="text-sm font-mono text-white">{adx != null ? adx.toFixed(1) : '—'}</p>
              <p className="text-[9px] text-neutral-600 mt-0.5">Força de tendência real (candle)</p>
            </div>
            <div className="bg-neutral-800/40 rounded-lg p-3">
              <p className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">Volume</p>
              <p className="text-sm font-mono text-white">{volumeRatio != null ? `${(volumeRatio * 100).toFixed(0)}%` : '—'}</p>
              <p className="text-[9px] text-neutral-600 mt-0.5">vs. média recente</p>
            </div>
          </div>

          <p className="text-[10px] text-neutral-500 mt-3">
            Classifica o presente, não prevê o futuro. Fonte: MarketScoreEngine (ADX + largura de Bollinger sobre candle real).
          </p>
        </>
      )}
    </div>
  );
}
