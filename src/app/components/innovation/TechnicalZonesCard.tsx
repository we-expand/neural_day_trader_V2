import React, { useEffect, useMemo, useState } from 'react';
import { MapPin, Settings2 } from 'lucide-react';
import { backtestDataService, type Timeframe } from '@/app/services/BacktestDataService';
import { analyzeSmc, type SmcZone } from '@/app/services/smc';

/**
 * Zonas Técnicas de Interesse — funcionalidade #3 do roadmap da aba
 * "Inteligência de Mercado" (veredito llm-council, 2026-09-09).
 *
 * ⚠️ NUNCA chamar isto de "liquidez institucional" ou "order book" na UI —
 * a corretora (MetaAPI/CFD) não expõe book real L2/L3, só o preço/candle.
 * O que este card mostra é o motor SMC determinístico já existente
 * (`src/app/services/smc/`) — reconhecimento de padrão técnico (Order
 * Blocks, Fair Value Gaps, pools de equalização de topo/fundo) sobre
 * candle real, o mesmo motor que já desenha zonas no `ChartView.tsx`.
 * É contexto histórico de reação de preço, não fluxo real de ordens.
 */

const MS_PER_BAR: Record<Timeframe, number> = {
  '1m': 60_000, '5m': 300_000, '15m': 900_000,
  '1h': 3_600_000, '4h': 14_400_000, '1d': 86_400_000,
};

const CANDLES_NEEDED = 150;

const CONFIG_STORAGE_KEY = 'neural_technical_zones_config';
const CONFIG_LOG_KEY = 'neural_technical_zones_config_log';
const CONFIG_LOG_MAX = 50;

const MAX_ZONES_MIN = 3;
const MAX_ZONES_MAX = 8;
const MAX_ZONES_DEFAULT = 5;

interface ZonesConfig {
  enabled: boolean;
  maxZones: number;
  showMitigated: boolean;
}

function loadConfig(): ZonesConfig {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        enabled: parsed.enabled ?? true,
        maxZones: Math.min(MAX_ZONES_MAX, Math.max(MAX_ZONES_MIN, parsed.maxZones ?? MAX_ZONES_DEFAULT)),
        showMitigated: parsed.showMitigated ?? false,
      };
    }
  } catch {
    // localStorage indisponível — default
  }
  return { enabled: true, maxZones: MAX_ZONES_DEFAULT, showMitigated: false };
}

function saveConfig(config: ZonesConfig) {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignora
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
  console.log('[TechnicalZones] config alterada:', entry);
}

const ZONE_LABEL: Record<SmcZone['type'], string> = {
  order_block_bullish: 'Zona Técnica de Compra',
  order_block_bearish: 'Zona Técnica de Venda',
  fvg_bullish: 'Vazio de Preço (Alta)',
  fvg_bearish: 'Vazio de Preço (Baixa)',
  liquidity_pool_buyside: 'Pool de Equalização (Topo)',
  liquidity_pool_sellside: 'Pool de Equalização (Fundo)',
};

const ZONE_COLOR: Record<SmcZone['type'], string> = {
  order_block_bullish: '#22c55e',
  order_block_bearish: '#ef4444',
  fvg_bullish: '#3b82f6',
  fvg_bearish: '#f59e0b',
  liquidity_pool_buyside: '#a855f7',
  liquidity_pool_sellside: '#a855f7',
};

interface TechnicalZonesCardProps {
  asset: string;
  timeframe: Timeframe;
  currentPrice: number | null;
}

export function TechnicalZonesCard({ asset, timeframe, currentPrice }: TechnicalZonesCardProps) {
  const [config, setConfig] = useState<ZonesConfig>(() => loadConfig());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [zones, setZones] = useState<SmcZone[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!config.enabled) {
      setZones([]);
      setError(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const end = Date.now();
        const start = end - CANDLES_NEEDED * MS_PER_BAR[timeframe] * 1.5;
        const res = await backtestDataService.fetchHistoricalData(asset, new Date(start), new Date(end), timeframe);
        if (cancelled) return;
        if (res.candles.length < 10) {
          setZones([]);
          setError('Candles reais insuficientes para identificar zonas técnicas.');
          return;
        }
        const analysis = analyzeSmc(
          res.candles.map((c) => ({ timestamp: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume })),
          asset,
          timeframe,
        );
        const all = [...analysis.orderBlocks, ...analysis.fairValueGaps, ...analysis.liquidityPools];
        setZones(all);
      } catch (e: any) {
        if (!cancelled) {
          setZones([]);
          setError(e?.message || 'Falha ao buscar candles reais para identificar zonas técnicas.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 120_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [asset, timeframe, config.enabled]);

  const visibleZones = useMemo(() => {
    const filtered = config.showMitigated ? zones : zones.filter((z) => !z.mitigated);
    const withDistance = filtered.map((z) => {
      const mid = (z.priceHigh + z.priceLow) / 2;
      const distance = currentPrice != null ? Math.abs(mid - currentPrice) : Number.POSITIVE_INFINITY;
      return { zone: z, distance };
    });
    withDistance.sort((a, b) => a.distance - b.distance || b.zone.strength - a.zone.strength);
    return withDistance.slice(0, config.maxZones).map((w) => w.zone);
  }, [zones, config.showMitigated, config.maxZones, currentPrice]);

  const updateConfig = (patch: Partial<ZonesConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      Object.entries(patch).forEach(([field, to]) => {
        appendConfigLog({ field, from: (prev as any)[field], to });
      });
      saveConfig(next);
      return next;
    });
  };

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
          <MapPin className="w-4 h-4" /> Zonas Técnicas de Interesse
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
            <span className="text-neutral-300">Ativar zonas técnicas</span>
            <button
              onClick={() => updateConfig({ enabled: !config.enabled })}
              className={`w-10 h-5 rounded-full transition-colors relative ${config.enabled ? 'bg-emerald-600' : 'bg-neutral-700'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${config.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-300">Mostrar zonas já mitigadas</span>
            <button
              onClick={() => updateConfig({ showMitigated: !config.showMitigated })}
              className={`w-10 h-5 rounded-full transition-colors relative ${config.showMitigated ? 'bg-emerald-600' : 'bg-neutral-700'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${config.showMitigated ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          <div className="text-xs">
            <div className="flex items-center justify-between text-neutral-300 mb-1">
              <span>Quantidade de zonas exibidas</span>
              <span className="font-mono text-white">{config.maxZones}</span>
            </div>
            <input
              type="range"
              min={MAX_ZONES_MIN}
              max={MAX_ZONES_MAX}
              step={1}
              value={config.maxZones}
              onChange={(e) => updateConfig({ maxZones: Number(e.target.value) })}
              className="w-full accent-emerald-500"
            />
          </div>
        </div>
      )}

      {!config.enabled && (
        <div className="text-center py-6 text-neutral-500 text-xs">Zonas técnicas desativadas. Ative em Configurações.</div>
      )}

      {config.enabled && loading && zones.length === 0 && (
        <div className="text-center py-6 text-neutral-500 text-xs">Identificando zonas reais...</div>
      )}

      {config.enabled && error && (
        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded p-3 text-center text-xs text-yellow-100">
          {error}
        </div>
      )}

      {config.enabled && !error && visibleZones.length === 0 && !loading && (
        <div className="text-center py-6 text-neutral-500 text-xs">Nenhuma zona técnica próxima identificada agora.</div>
      )}

      {config.enabled && visibleZones.length > 0 && (
        <div className="space-y-2">
          {visibleZones.map((z) => {
            const color = ZONE_COLOR[z.type];
            const mid = (z.priceHigh + z.priceLow) / 2;
            return (
              <div key={z.id} className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-800/30 border border-neutral-800">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  <div>
                    <p className="text-xs font-medium text-white">{ZONE_LABEL[z.type]}</p>
                    <p className="text-[10px] text-neutral-500 font-mono">
                      {z.priceLow.toFixed(5)} – {z.priceHigh.toFixed(5)}
                      {currentPrice != null ? ` · ${(((mid - currentPrice) / currentPrice) * 100).toFixed(2)}% do preço` : ''}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-neutral-400">força {z.strength}</span>
              </div>
            );
          })}
          <p className="text-[10px] text-neutral-500 pt-1">
            Zonas de reação histórica de preço (padrão técnico sobre candle real) — não é book de
            ordens real, esta corretora não expõe profundidade L2/L3.
          </p>
        </div>
      )}
    </div>
  );
}
