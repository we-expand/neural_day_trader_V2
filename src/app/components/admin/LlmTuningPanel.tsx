import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Save, RotateCcw, Copy, Search, SlidersHorizontal, CalendarDays, CalendarOff } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/app/contexts/AuthContext';

type Val = number | boolean | string | string[];
type ProfileKey = 'WEEKDAY' | 'WEEKEND';
type Values = Record<string, Val>;

const TABLE = 'llm_tuning_profiles';

// Rotulos em portugues dos parametros mais usados. O resto aparece com o nome tecnico (a lista vem do proprio motor).
const LABELS: Record<string, [string, string]> = {
  mt5MaxEntriesPerDay: ['Entradas por dia (total)', '0 = sem limite. Zera 00:00 de Brasília.'],
  mt5MaxAssetsPerDay: ['Ativos diferentes por dia', '0 = sem limite. Quantos ativos distintos a LLM pode operar no dia.'],
  mt5MaxEntriesPerAssetPerDay: ['Entradas por ativo por dia', '0 = sem limite.'],
  mt5MaxEntriesPer24h: ['Entradas em 24h (janela deslizante) — dia útil', 'Rede de segurança contra excesso de frequência.'],
  mt5MaxEntriesPer24hWeekend: ['Entradas em 24h (janela deslizante) — fim de semana', ''],
  mt5OverrideMaxSimultaneousAssets: ['Ativos simultâneos (sobrepõe o Setup)', '0 = obedece o Setup do AI Trader.'],
  mt5OverrideMaxOpenPositionsTotal: ['Posições abertas no total (sobrepõe o Setup)', '0 = obedece o Setup.'],
  mt5OverrideMaxLotsPerTrade: ['Lotes máximos por trade (sobrepõe o Setup)', '0 = obedece o Setup.'],
  mt5MaxRiskPctPerTrade: ['Risco máximo por trade (fração do capital)', '0.10 = 10%.'],
  mt5RiskPctPerTrade: ['Risco base por trade (fração)', ''],
  mt5TargetRewardUsd: ['Ganho-alvo por entrada (US$)', 'Dimensiona o lote.'],
  mt5HeavyMultiplier: ['Multiplicador do tamanho "forte"', ''],
  mt5SafetyMaxLots: ['Teto absoluto de lotes', ''],
  mt5MaxNotionalUsd: ['Exposição nocional máxima por posição (US$)', ''],
  mt5MaxCorrelatedNotionalUsd: ['Exposição máxima do grupo correlacionado (US$)', ''],
  mt5RiskScalerEnabled: ['Escalonador de risco ligado', ''],
  mt5StopAtrMultiplier: ['Stop em múltiplos de ATR — dia útil', ''],
  mt5StopAtrMultiplierWeekend: ['Stop em múltiplos de ATR — fim de semana', ''],
  mt5TakeProfitAtrMultiplier: ['Alvo em múltiplos de ATR — dia útil', ''],
  mt5TakeProfitAtrMultiplierWeekend: ['Alvo em múltiplos de ATR — fim de semana', ''],
  mt5StopMinPct: ['Stop mínimo (fração do preço)', '0.0008 = 0,08%.'],
  mt5StopMaxPct: ['Stop máximo (fração do preço)', ''],
  mt5MinRrAbsolute: ['R:R mínimo absoluto', 'Inviolável.'],
  mt5MinRrAfterSrCap: ['R:R mínimo após cortar o alvo no S/R', ''],
  mt5BreakevenTriggerR: ['Breakeven a partir de (R)', ''],
  mt5TrailAtrMultiplier: ['Trailing (ATR)', ''],
  mt5PartialTpEnabled: ['Realização parcial ligada', ''],
  mt5PartialTpTriggerR: ['Parcial a partir de (R)', ''],
  mt5PartialTpFraction: ['Fração realizada na parcial', ''],
  mt5LossStreakThreshold: ['Perdas seguidas para esfriar o ativo', ''],
  mt5LossStreakCooldownMinutes: ['Minutos de espera após sequência de perdas', ''],
  mt5MinConfidenceForOpenPosition: ['Confiança mínima declarada — dia útil (%)', 'Veja a tabela de calibração abaixo antes de mexer.'],
  mt5MinConfidenceForOpenPositionWeekend: ['Confiança mínima declarada — fim de semana (%)', 'Veja a tabela de calibração abaixo.'],
  mt5VolumeElevatedRatio: ['Razão de volume "elevado"', ''],
  mt5VolumeElevatedRatioEvening: ['Razão de volume "elevado" (noite)', ''],
  mt5DayExtremeVetoEnabled: ['Veto de extremo do dia ligado', ''],
  mt5StochExtremeGateAllSetups: ['Veto de estocástico extremo em todos os setups', ''],
  hmmRegimeGateActive: ['Filtro de regime HMM — dia útil', ''],
  hmmRegimeGateActiveWeekend: ['Filtro de regime HMM — fim de semana', ''],
  highImpactNewsGateActive: ['Trava de notícia de alto impacto', ''],
  macd5mTurnGateEnabled: ['Trava do MACD 5m virando contra', ''],
  blockEntryOnStaleIndicators: ['Bloquear entrada com indicador velho', ''],
  mt5SpreadStopSafetyMultiplier: ['Margem do stop sobre o spread', ''],
  mt5DeskMode: ['Mesa de operações', 'off / shadow / veto / enforce'],
  cycleDelaySeconds: ['Intervalo entre ciclos (s)', 'Mínimo 5.'],
  maxIterations: ['Iterações máximas por ciclo', ''],
  llmCallTimeoutMs: ['Timeout por chamada de LLM (ms)', ''],
  llmMaxTokens: ['Máximo de tokens por resposta', ''],
  mt5TrialStartIso: ['Início do período de teste (ISO)', 'Vazio = aborto automático desligado.'],
  mt5TrialAbortConsecutiveLosses: ['Aborto: perdas seguidas', ''],
  mt5TrialAbortPauseMinutes: ['Aborto: minutos de pausa', ''],
  mt5TrialAbortMinEntries: ['Aborto: mínimo de entradas p/ medir E[R]', ''],
  mt5TrialAbortMeanR: ['Aborto: E[R] mínimo', ''],
  mt5TrialAbortDrawdownPct: ['Aborto: perda máxima do capital (fração)', ''],
};

const GROUPS: Array<{ name: string; test: (k: string) => boolean }> = [
  { name: 'Limites diários e frequência', test: (k) => /PerDay|Per24h|Override|LossStreak|MinConfidence|cycleDelay|maxIterations/.test(k) },
  { name: 'Risco e tamanho da posição', test: (k) => /Risk|Lots|Notional|Heavy|RewardUsd|ReferenceCapital|MinNetReward|MinExpectedNet|Scaler/.test(k) && !/Trial|Desk|Cleber|NyOpen|Asym/.test(k) },
  { name: 'Stop, breakeven e trailing', test: (k) => /Stop|Breakeven|Trail/.test(k) && !/Trial|Cleber|NyOpen|Asym|Desk/.test(k) },
  { name: 'Alvo e saída', test: (k) => /Target|TakeProfit|PartialTp|Rr|SrMargin|SrTarget|RangeTarget|LowVolume/.test(k) && !/Trial|Cleber|NyOpen|Asym|Desk|fomc/i.test(k) },
  { name: 'Filtros e travas de entrada', test: (k) => /Gate|Veto|Volume|hmm|macd|Stoch|News|vix|breakout|Lateral|Stale|Confluence|Reasoning|aiSignal/i.test(k) && !/Trial|Desk|fomc/i.test(k) },
  { name: 'Mesa de operações', test: (k) => /Desk/.test(k) },
  { name: 'Aborto automático / período de teste', test: (k) => /Trial/.test(k) },
  { name: 'Abertura de NY', test: (k) => /NyOpen/.test(k) },
  { name: 'Assimetria', test: (k) => /Asym/.test(k) },
  { name: 'Gestão do Cleber', test: (k) => /Cleber/.test(k) },
  { name: 'FOMC / BTC', test: (k) => /fomc/i.test(k) },
  { name: 'Modelo e chamadas de LLM', test: (k) => /^llm|LlmOnly/.test(k) },
];

function groupOf(key: string): string {
  return GROUPS.find((g) => g.test(key))?.name ?? 'Outros';
}

function humanize(key: string): string {
  return key.replace(/^mt5/, '').replace(/([A-Z])/g, ' $1').trim();
}

const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function LlmTuningPanel() {
  const { user } = useAuth() as any;
  const [profile, setProfile] = useState<ProfileKey>('WEEKDAY');
  const [baseline, setBaseline] = useState<Values>({});
  const [saved, setSaved] = useState<Record<ProfileKey, Values>>({ WEEKDAY: {}, WEEKEND: {} });
  const [draft, setDraft] = useState<Record<ProfileKey, Values>>({ WEEKDAY: {}, WEEKEND: {} });
  const [meta, setMeta] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [calib, setCalib] = useState<Array<{ bucket: string; n: number; wins: number; avg: number }>>([]);
  const [calibDays, setCalibDays] = useState(30);

  const loadCalib = useCallback(async () => {
    const since = new Date(Date.now() - calibDays * 86400000).toISOString();
    const { data, error } = await supabase
      .from('ai_trades')
      .select('ai_confidence, net_pnl')
      .eq('status', 'CLOSED')
      .not('ai_confidence', 'is', null)
      .not('net_pnl', 'is', null)
      .gte('entry_time', since)
      .limit(5000);
    if (error) return;
    const buckets: Record<string, { n: number; wins: number; sum: number }> = {};
    for (const r of data ?? []) {
      const c = Number((r as any).ai_confidence);
      const lo = Math.min(90, Math.floor(c / 10) * 10);
      const key = lo >= 90 ? '90-100' : `${lo}-${lo + 9}`;
      const b = (buckets[key] ??= { n: 0, wins: 0, sum: 0 });
      b.n++; b.sum += c; if (Number((r as any).net_pnl) > 0) b.wins++;
    }
    setCalib(Object.entries(buckets).sort().map(([bucket, b]) => ({ bucket, n: b.n, wins: b.wins, avg: b.sum / b.n })));
  }, [calibDays]);
  useEffect(() => { loadCalib(); }, [loadCalib]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from(TABLE).select('profile, values, meta');
    setLoading(false);
    if (error) {
      toast.error(`Falha ao carregar: ${error.message} (migration 20261106_llm_tuning_profiles.sql aplicada?)`);
      return;
    }
    const rows = Object.fromEntries((data ?? []).map((r: any) => [r.profile, r]));
    setBaseline((rows.BASELINE?.values ?? {}) as Values);
    setMeta(rows.BASELINE?.meta ?? {});
    const s = { WEEKDAY: (rows.WEEKDAY?.values ?? {}) as Values, WEEKEND: (rows.WEEKEND?.values ?? {}) as Values };
    setSaved(s);
    setDraft({ WEEKDAY: { ...s.WEEKDAY }, WEEKEND: { ...s.WEEKEND } });
  }, []);

  useEffect(() => { load(); }, [load]);

  const keys = useMemo(() => Object.keys(baseline).sort(), [baseline]);
  const d = draft[profile];
  const dirty = !eq(d, saved[profile]);

  const setValue = (k: string, v: Val) => {
    setDraft((prev) => {
      const next = { ...prev[profile] };
      if (eq(v, baseline[k])) delete next[k]; // igual ao .env = nao e ajuste
      else next[k] = v;
      return { ...prev, [profile]: next };
    });
  };
  const resetKey = (k: string) => setDraft((prev) => { const n = { ...prev[profile] }; delete n[k]; return { ...prev, [profile]: n }; });

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from(TABLE).upsert(
      { profile, values: d, updated_at: new Date().toISOString(), updated_by: user?.email ?? null },
      { onConflict: 'profile' },
    );
    setSaving(false);
    if (error) { toast.error(`Erro ao salvar: ${error.message}`); return; }
    setSaved((p) => ({ ...p, [profile]: { ...d } }));
    toast.success(`Perfil ${profile === 'WEEKDAY' ? 'DIA ÚTIL' : 'FIM DE SEMANA'} salvo (${Object.keys(d).length} ajustes). O motor aplica em até ~15s, sem restart.`);
  };

  const copyFromOther = () => {
    const other: ProfileKey = profile === 'WEEKDAY' ? 'WEEKEND' : 'WEEKDAY';
    setDraft((p) => ({ ...p, [profile]: { ...p[other] } }));
    toast.info(`Ajustes copiados do perfil ${other === 'WEEKDAY' ? 'dia útil' : 'fim de semana'} (ainda não salvo).`);
  };

  const filtered = keys.filter((k) => {
    if (onlyChanged && !(k in d)) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return k.toLowerCase().includes(q) || (LABELS[k]?.[0] ?? '').toLowerCase().includes(q);
  });
  const grouped = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const k of filtered) { const g = groupOf(k); m.set(g, [...(m.get(g) ?? []), k]); }
    const order = [...GROUPS.map((g) => g.name), 'Outros'];
    return order.filter((n) => m.has(n)).map((n) => [n, m.get(n)!] as const);
  }, [filtered]);

  const renderInput = (k: string) => {
    const base = baseline[k];
    const cur = k in d ? d[k] : base;
    const cls = 'bg-black/60 border border-white/15 rounded-md px-2 py-1 text-sm text-white w-44 focus:outline-none focus:border-purple-500';
    if (typeof base === 'boolean') {
      return (
        <button onClick={() => setValue(k, !cur)} className={`px-3 py-1 rounded-md text-xs font-bold border ${cur ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/40' : 'bg-slate-800 text-slate-400 border-white/10'}`}>
          {cur ? 'LIGADO' : 'DESLIGADO'}
        </button>
      );
    }
    if (typeof base === 'number') {
      return <input type="number" step="any" className={cls} value={String(cur)} onChange={(e) => { const n = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(n)) setValue(k, n); }} />;
    }
    if (Array.isArray(base)) {
      return <input className={cls + ' w-64'} value={(cur as string[]).join(',')} onChange={(e) => setValue(k, e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} />;
    }
    return <input className={cls + ' w-64'} value={String(cur)} onChange={(e) => setValue(k, e.target.value)} />;
  };

  const fmt = (v: Val | undefined) => (Array.isArray(v) ? v.join(',') : String(v));

  return (
    <div className="p-6 space-y-5 text-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><SlidersHorizontal className="w-5 h-5 text-purple-400" /> Regulagem da LLM</h2>
          <p className="text-xs text-slate-400 mt-1">
            Dois perfis salvos. O motor usa o perfil do momento (dia útil × fim de semana, sexta 17h → domingo 19h Brasília) e aplica em até ~15s, sem restart.
            Campo igual ao .env não é ajuste. {meta?.activeProfile && <>Ativo agora: <b className="text-purple-300">{meta.activeProfile === 'WEEKEND' ? 'FIM DE SEMANA' : 'DIA ÚTIL'}</b> ({meta.overrideCount ?? 0} ajustes)</>}
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-2 text-xs px-3 py-2 rounded-md border border-white/10 hover:bg-white/5"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Recarregar</button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {(['WEEKDAY', 'WEEKEND'] as ProfileKey[]).map((p) => (
          <button key={p} onClick={() => setProfile(p)} className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-bold ${profile === p ? 'bg-purple-600/30 border-purple-500/50 text-white' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}>
            {p === 'WEEKDAY' ? <CalendarDays className="w-4 h-4" /> : <CalendarOff className="w-4 h-4" />}
            {p === 'WEEKDAY' ? 'Dias de semana' : 'Fim de semana'}
            <span className="text-[10px] font-mono opacity-70">{Object.keys(draft[p]).length} ajustes{!eq(draft[p], saved[p]) ? ' •' : ''}</span>
          </button>
        ))}
        <div className="relative ml-auto">
          <Search className="w-4 h-4 absolute left-2 top-2 text-slate-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar parâmetro…" className="bg-black/60 border border-white/15 rounded-md pl-8 pr-2 py-1.5 text-sm w-56" />
        </div>
        <label className="text-xs text-slate-400 flex items-center gap-1"><input type="checkbox" checked={onlyChanged} onChange={(e) => setOnlyChanged(e.target.checked)} /> só ajustados</label>
        <button onClick={copyFromOther} className="flex items-center gap-1 text-xs px-3 py-2 rounded-md border border-white/10 hover:bg-white/5"><Copy className="w-4 h-4" /> Copiar do outro perfil</button>
        <button onClick={save} disabled={!dirty || saving} className="flex items-center gap-2 px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-bold"><Save className="w-4 h-4" /> {saving ? 'Salvando…' : 'Salvar perfil'}</button>
      </div>

      {keys.length === 0 && !loading && (
        <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-950/20 text-sm text-amber-200">
          Nenhum parâmetro publicado ainda. O motor grava o catálogo (BASELINE) ao iniciar: aplique a migration e reinicie o motor uma vez.
        </div>
      )}

      {grouped.map(([name, ks]) => (
        <section key={name} className="rounded-xl border border-white/10 bg-white/[0.02]">
          <h3 className="px-4 py-2 text-xs uppercase tracking-widest font-bold text-purple-300 border-b border-white/10">{name} <span className="text-slate-500">({ks.length})</span></h3>
          <div className="divide-y divide-white/5">
            {ks.map((k) => {
              const [label, hint] = LABELS[k] ?? [humanize(k), ''];
              const changed = k in d;
              return (
                <div key={k} className={`flex flex-wrap items-center gap-3 px-4 py-2 ${changed ? 'bg-purple-900/10' : ''}`}>
                  <div className="flex-1 min-w-[260px]">
                    <div className="text-sm text-white">{label}</div>
                    <div className="text-[10px] font-mono text-slate-500">{k}{hint ? ` · ${hint}` : ''}</div>
                  </div>
                  <div className="text-[10px] text-slate-500 w-40 truncate" title={fmt(baseline[k])}>.env: {fmt(baseline[k]) || '(vazio)'}</div>
                  {renderInput(k)}
                  <button onClick={() => resetKey(k)} disabled={!changed} title="Voltar ao valor do .env" className="p-1 text-slate-400 hover:text-white disabled:opacity-20"><RotateCcw className="w-4 h-4" /></button>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs uppercase tracking-widest font-bold text-purple-300">Calibração da confiança (declarada × acerto real)</h3>
          <select value={calibDays} onChange={(e) => setCalibDays(Number(e.target.value))} className="bg-black/60 border border-white/15 rounded px-2 py-1 text-xs">
            {[7, 14, 30, 60, 90].map((n) => <option key={n} value={n}>{n} dias</option>)}
          </select>
        </div>
        {calib.length === 0 ? <p className="text-xs text-slate-500">Sem trades fechados com confiança registrada no período.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[10px] uppercase text-slate-500"><th>Confiança declarada</th><th>Trades</th><th>Média declarada</th><th>Acerto real</th><th>Diferença</th></tr></thead>
            <tbody>
              {calib.map((c) => { const real = (c.wins / c.n) * 100; const gap = real - c.avg; return (
                <tr key={c.bucket} className="border-t border-white/5">
                  <td className="py-1">{c.bucket}%</td><td>{c.n}</td><td>{c.avg.toFixed(0)}%</td>
                  <td className="font-bold">{real.toFixed(0)}%</td>
                  <td className={gap < -10 ? 'text-rose-400' : 'text-emerald-400'}>{gap > 0 ? '+' : ''}{gap.toFixed(0)} pts</td>
                </tr>); })}
            </tbody>
          </table>
        )}
        <p className="text-[11px] text-slate-500 mt-2">
          Acerto = trade fechado com lucro líquido. Se o acerto real não sobe junto com a confiança declarada, subir o piso de confiança não melhora a seleção —
          o número que a LLM declara não é uma probabilidade. Amostras pequenas (&lt; 30 por faixa) não provam nada.
        </p>
      </section>

      <p className="text-[11px] text-slate-500">
        Fora do painel de propósito: chaves/segredos, a chave mestra de execução real (MT5_LIVE_EXECUTION_ENABLED), modelo de LLM e concorrência da mesa (só mudam com restart).
        Ativos operáveis, risco por trade do Setup e perda diária continuam no Setup do AI Trader.
      </p>
    </div>
  );
}
