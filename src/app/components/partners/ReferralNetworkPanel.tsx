/**
 * Painel de acompanhamento da rede de indicados — 2026-08-18.
 *
 * Referência: o painel de IB da Infinox (print enviado pelo Cleber), que lista
 * ID, logins, e-mail, telefone, lotes, depósitos, saques, saldo e comissão.
 *
 * O que este painel faz DIFERENTE, de propósito:
 *
 *  1. Não expõe e-mail nem telefone do indicado. O painel da corretora mostra
 *     `victor.vepstas@gmail.com` e `+5511962640083` em texto puro para o
 *     parceiro. Aqui o indicado aparece por um ID público estável — o parceiro
 *     precisa distinguir um do outro, não precisa do dado pessoal (LGPD,
 *     minimização: art. 6º III).
 *  2. Mostra o ESTÁGIO do funil com data, não só um saldo. "Cadastrou mas
 *     nunca conectou a conta" é acionável; "Lots: 0.00" não é.
 *  3. Abre a conta da comissão linha a linha (receita → imposto → custo de
 *     servir → base → sua parte). O parceiro audita o próprio pagamento em vez
 *     de confiar num número solto.
 *  4. Não mostra depósito, saque nem saldo do indicado. É dado financeiro
 *     pessoal de terceiro e não tem função nenhuma no cálculo da comissão.
 */
import React, { useMemo, useState } from 'react';
import {
  ChevronDown, ChevronRight, Search, Download, Users, AlertCircle,
  Link2, Activity, CreditCard, UserX, ArrowUpDown,
} from 'lucide-react';
import type { ReferralRow } from '@/app/services/partners/PartnerProgramService';

const BRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

const STAGES = {
  SIGNED_UP: { label: 'Cadastrou',  icon: Users,      tone: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
  LINKED:    { label: 'Conectou',   icon: Link2,      tone: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  TRADING:   { label: 'Operando',   icon: Activity,   tone: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  PAYING:    { label: 'Assinante',  icon: CreditCard, tone: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  CHURNED:   { label: 'Inativo',    icon: UserX,      tone: 'text-red-400/80 bg-red-500/10 border-red-500/20' },
} as const;

type SortKey = 'signedUpAt' | 'periodLots' | 'periodCommission' | 'stage';

interface Props {
  referrals: ReferralRow[];
  /** Alíquota vigente do parceiro — usada só para explicar a conta na expansão. */
  marginShare: number;
  periodLabel: string;
}

export function ReferralNetworkPanel({ referrals, marginShare, periodLabel }: Props) {
  const [query, setQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<'ALL' | ReferralRow['stage']>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('periodCommission');
  const [expanded, setExpanded] = useState<string | null>(null);

  const visible = useMemo(() => {
    const filtered = referrals.filter((r) => {
      const matchesQuery = !query || r.publicId.toLowerCase().includes(query.toLowerCase());
      const matchesStage = stageFilter === 'ALL' || r.stage === stageFilter;
      return matchesQuery && matchesStage;
    });
    const order: Record<ReferralRow['stage'], number> = { PAYING: 0, TRADING: 1, LINKED: 2, SIGNED_UP: 3, CHURNED: 4 };
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'periodLots': return b.periodLots - a.periodLots;
        case 'periodCommission': return b.periodCommission - a.periodCommission;
        case 'stage': return order[a.stage] - order[b.stage];
        default: return new Date(b.signedUpAt).getTime() - new Date(a.signedUpAt).getTime();
      }
    });
  }, [referrals, query, stageFilter, sortKey]);

  const totals = useMemo(() => visible.reduce((acc, r) => ({
    lots: acc.lots + r.periodLots,
    gross: acc.gross + r.periodGrossRevenue,
    base: acc.base + r.periodMarginBase,
    commission: acc.commission + r.periodCommission,
  }), { lots: 0, gross: 0, base: 0, commission: 0 }), [visible]);

  const exportCsv = () => {
    const header = ['id_publico', 'estagio', 'cadastro', 'conectou_conta', 'primeiro_trade', 'assinou', 'lotes_periodo', 'receita_gerada', 'base_comissao', 'sua_comissao'];
    const lines = visible.map((r) => [
      r.publicId, STAGES[r.stage].label, r.signedUpAt, r.brokerLinkedAt ?? '', r.firstTradeAt ?? '', r.subscribedAt ?? '',
      r.periodLots.toFixed(2), r.periodGrossRevenue.toFixed(2), r.periodMarginBase.toFixed(2), r.periodCommission.toFixed(2),
    ].join(';'));
    const blob = new Blob([[header.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rede-indicados-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-neutral-950 border border-white/5 rounded-xl overflow-hidden">
      {/* Barra de controles */}
      <div className="p-5 border-b border-white/5 flex flex-wrap items-center gap-3">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-widest">Sua rede</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {visible.length} {visible.length === 1 ? 'indicado' : 'indicados'} · {periodLabel}
          </p>
        </div>

        <div className="flex-1" />

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por ID"
            className="bg-black border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-emerald-500/40 w-44"
          />
        </div>

        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value as typeof stageFilter)}
          className="bg-black border border-white/10 text-xs text-slate-300 rounded-lg px-3 py-2 outline-none focus:border-emerald-500/40"
        >
          <option value="ALL">Todos os estágios</option>
          {Object.entries(STAGES).map(([key, s]) => <option key={key} value={key}>{s.label}</option>)}
        </select>

        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="bg-black border border-white/10 text-xs text-slate-300 rounded-lg px-3 py-2 outline-none focus:border-emerald-500/40"
        >
          <option value="periodCommission">Maior comissão</option>
          <option value="periodLots">Maior volume</option>
          <option value="signedUpAt">Mais recente</option>
          <option value="stage">Estágio</option>
        </select>

        <button
          onClick={exportCsv}
          disabled={visible.length === 0}
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 border border-white/10 text-xs text-slate-300 rounded-lg px-3 py-2 transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> CSV
        </button>
      </div>

      {/* Tabela */}
      {visible.length === 0 ? (
        <div className="p-12 text-center">
          <Users className="w-10 h-10 text-slate-700 mx-auto mb-4" />
          <p className="text-sm text-slate-400 font-medium">
            {referrals.length === 0 ? 'Nenhum indicado ainda' : 'Nenhum indicado com esse filtro'}
          </p>
          <p className="text-xs text-slate-600 mt-2 max-w-md mx-auto leading-relaxed">
            {referrals.length === 0
              ? 'Assim que alguém se cadastrar pelo seu link, ele aparece aqui com o estágio em que está — mesmo antes de gerar comissão.'
              : 'Ajuste a busca ou o filtro de estágio.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/[0.03] border-b border-white/5">
                <th className="p-4 w-8" />
                <th className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Indicado</th>
                <th className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Estágio</th>
                <th className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cadastro</th>
                <th className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Lotes</th>
                <th className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Receita gerada</th>
                <th className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Base</th>
                <th className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Sua comissão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {visible.map((r) => {
                const stage = STAGES[r.stage];
                const StageIcon = stage.icon;
                const isOpen = expanded === r.id;
                return (
                  <React.Fragment key={r.id}>
                    <tr
                      onClick={() => setExpanded(isOpen ? null : r.id)}
                      className="hover:bg-white/[0.03] transition-colors cursor-pointer"
                    >
                      <td className="p-4 text-slate-600">
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </td>
                      <td className="p-4">
                        <span className="text-sm font-mono font-medium text-white">{r.publicId}</span>
                        {r.sourceChannel && (
                          <span className="block text-[10px] text-slate-600 mt-0.5">via {r.sourceChannel}</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${stage.tone}`}>
                          <StageIcon className="w-3 h-3" /> {stage.label}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-slate-400 font-mono">
                        {new Date(r.signedUpAt).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="p-4 text-sm text-right font-mono text-slate-300">{r.periodLots.toFixed(2)}</td>
                      <td className="p-4 text-sm text-right font-mono text-slate-400">{BRL(r.periodGrossRevenue)}</td>
                      <td className="p-4 text-sm text-right font-mono text-slate-400">{BRL(r.periodMarginBase)}</td>
                      <td className={`p-4 text-sm text-right font-mono font-bold ${r.periodCommission > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                        {r.periodCommission > 0 ? BRL(r.periodCommission) : '—'}
                      </td>
                    </tr>

                    {isOpen && (
                      <tr className="bg-black/60">
                        <td colSpan={8} className="px-4 pb-5 pt-1">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            {/* Demonstração da conta */}
                            <div className="bg-neutral-950/80 border border-white/5 rounded-lg p-4">
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                                Como sua comissão foi calculada
                              </p>
                              {r.periodMarginBase > 0 ? (
                                <div className="space-y-1.5 font-mono text-xs">
                                  <Line label="Receita gerada pelo indicado" value={BRL(r.periodGrossRevenue)} />
                                  <Line
                                    label="(−) Impostos e custo de servir"
                                    value={`− ${BRL(Math.max(0, r.periodGrossRevenue - r.periodMarginBase))}`}
                                    muted
                                  />
                                  <div className="border-t border-white/10 my-2" />
                                  <Line label="(=) Base de comissão" value={BRL(r.periodMarginBase)} />
                                  <Line label={`(×) Sua alíquota (nível vigente)`} value={`${(marginShare * 100).toFixed(0)}%`} muted />
                                  <div className="border-t border-white/10 my-2" />
                                  <Line label="(=) Sua comissão" value={BRL(r.periodCommission)} highlight />
                                  {r.periodLots > 0 && (
                                    <p className="text-[10px] text-slate-600 pt-2">
                                      Equivale a {BRL(r.periodCommission / r.periodLots)} por lote operado.
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-start gap-2.5 text-xs text-slate-500 leading-relaxed">
                                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-slate-600" />
                                  <span>
                                    Este indicado ainda não gerou base de comissão no período. A comissão só existe
                                    quando a receita dele cobre o custo de operação da conta — é isso que impede o
                                    programa de pagar sobre prejuízo.
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Linha do tempo do funil */}
                            <div className="bg-neutral-950/80 border border-white/5 rounded-lg p-4">
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                                Jornada do indicado
                              </p>
                              <ol className="space-y-2.5">
                                <Milestone label="Cadastrou pelo seu link" at={r.signedUpAt} done />
                                <Milestone label="Conectou conta na corretora" at={r.brokerLinkedAt} done={!!r.brokerLinkedAt} />
                                <Milestone label="Executou o primeiro lote" at={r.firstTradeAt} done={!!r.firstTradeAt} />
                                <Milestone label="Assinou um plano" at={r.subscribedAt} done={!!r.subscribedAt} />
                                {r.churnedAt && <Milestone label="Saiu da plataforma" at={r.churnedAt} done danger />}
                              </ol>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>

            {/* Totalizador — equivalente à linha "Total" do painel da corretora */}
            <tfoot>
              <tr className="bg-white/[0.03] border-t border-white/10">
                <td className="p-4" />
                <td className="p-4 text-[11px] font-bold text-slate-300 uppercase tracking-wider" colSpan={3}>
                  Total · {visible.length} {visible.length === 1 ? 'indicado' : 'indicados'}
                </td>
                <td className="p-4 text-sm text-right font-mono font-bold text-slate-200">{totals.lots.toFixed(2)}</td>
                <td className="p-4 text-sm text-right font-mono font-bold text-slate-200">{BRL(totals.gross)}</td>
                <td className="p-4 text-sm text-right font-mono font-bold text-slate-200">{BRL(totals.base)}</td>
                <td className="p-4 text-sm text-right font-mono font-bold text-emerald-400">{BRL(totals.commission)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function Line({ label, value, muted, highlight }: { label: string; value: string; muted?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className={muted ? 'text-slate-600' : 'text-slate-400'}>{label}</span>
      <span className={highlight ? 'text-emerald-400 font-bold text-sm' : muted ? 'text-slate-500' : 'text-slate-200'}>
        {value}
      </span>
    </div>
  );
}

function Milestone({ label, at, done, danger }: { label: string; at: string | null; done: boolean; danger?: boolean }) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${
          danger ? 'bg-red-500' : done ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-white/15'
        }`}
      />
      <span className={`text-xs flex-1 ${done ? 'text-slate-300' : 'text-slate-600'}`}>{label}</span>
      <span className="text-[10px] font-mono text-slate-600">
        {at ? new Date(at).toLocaleDateString('pt-BR') : '—'}
      </span>
    </li>
  );
}
