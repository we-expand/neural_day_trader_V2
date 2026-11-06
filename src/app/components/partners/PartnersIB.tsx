/**
 * Programa de Parceiros IB — tela principal. Reconstruída em 2026-08-18.
 *
 * A versão anterior (`Partners.tsx`) era uma maquete: código de indicação
 * gerado no localStorage, 12 indicados inventados com e-mails fictícios,
 * US$1.250 de "Comissão Total", gráfico de receita com 4 pontos fixos no
 * código, níveis "Officer 20% / Commander 25%" sem nenhum modelo por trás e um
 * "ganhe até 30% recorrente" que não correspondia a nada. Nada daquilo tinha
 * banco, cálculo ou regra — e um usuário leria como saldo real.
 *
 * Esta versão:
 *   • Só mostra dado que existe (`PartnerProgramService`), com estado explícito
 *     quando não existe — nunca preenche a tela com número inventado.
 *   • Os percentuais vêm de `CommissionModel`, calibrado contra os 3 cenários
 *     da planilha financeira e travado por asserção no `npm run validate`.
 *   • O simulador é claramente rotulado como projeção.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import {
  Users, Copy, Check, Wallet, Clock, TrendingUp, Network, Database,
  AlertTriangle, ArrowRight, Share2, Loader2, ReceiptText, BookOpen,
} from 'lucide-react';
import { useAuth } from '@/app/contexts/AuthContext';
import {
  loadPartnerDashboard, enrollPartner, requestPayout,
  type PartnerDataState, type PartnerDashboard,
} from '@/app/services/partners/PartnerProgramService';
import { PARTNER_TIERS, PROGRAM_RULES, resolveTier } from '@/app/services/partners/CommissionModel';
import { ReferralNetworkPanel } from './ReferralNetworkPanel';
import { TierLadder, EarningsSimulator, ProgramRules } from './ProgramExplainer';

const BRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

type Tab = 'network' | 'statement' | 'program';

const PERIODS = [
  { id: '30d', label: 'Últimos 30 dias', days: 30 },
  { id: '90d', label: 'Últimos 90 dias', days: 90 },
  { id: '12m', label: 'Últimos 12 meses', days: 365 },
] as const;

export function PartnersIB() {
  const { user } = useAuth();
  const [state, setState] = useState<PartnerDataState>({ kind: 'LOADING' });
  const [tab, setTab] = useState<Tab>('network');
  const [periodId, setPeriodId] = useState<(typeof PERIODS)[number]['id']>('30d');
  const [copied, setCopied] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  const period = PERIODS.find((p) => p.id === periodId)!;

  const load = useCallback(async () => {
    if (!user?.id) {
      setState({ kind: 'ERROR', detail: 'Faça login para acessar o programa de parceiros.' });
      return;
    }
    const to = new Date();
    const from = new Date(to.getTime() - period.days * 86_400_000);
    setState(await loadPartnerDashboard(user.id, { from, to }));
  }, [user?.id, period.days]);

  useEffect(() => { void load(); }, [load]);

  const handleEnroll = async () => {
    if (!user?.id) return;
    setEnrolling(true);
    const result = await enrollPartner(user.id);
    setEnrolling(false);
    if (result.ok) {
      toast.success('Você entrou no programa', { description: `Seu código é ${result.code}.` });
      void load();
    } else {
      toast.error('Não foi possível criar sua conta de parceiro', { description: result.error });
    }
  };

  // ── Estados que não são "pronto" ──────────────────────────────────────────
  if (state.kind === 'LOADING') return <Shell><Centered><Loader2 className="w-6 h-6 text-emerald-500 animate-spin" /></Centered></Shell>;

  if (state.kind === 'ERROR') {
    return (
      <Shell>
        <Notice
          icon={AlertTriangle}
          tone="red"
          title="Não foi possível carregar seus dados de parceiro"
          body={state.detail}
          action={{ label: 'Tentar de novo', onClick: () => void load() }}
        />
      </Shell>
    );
  }

  if (state.kind === 'NOT_PROVISIONED') {
    return (
      <Shell>
        <Notice
          icon={Database}
          tone="amber"
          title="Programa ainda não provisionado no banco"
          body={`${state.detail} Enquanto isso, as regras e o simulador abaixo já refletem o modelo definitivo — eles são cálculo, não dependem de banco.`}
        />
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
          <div className="xl:col-span-2 space-y-6">
            <EarningsSimulator />
            <ProgramRules />
          </div>
          <TierLadder currentTier="NODE" activeReferrals={0} />
        </div>
      </Shell>
    );
  }

  if (state.kind === 'NOT_ENROLLED') {
    return (
      <Shell>
        <div className="bg-neutral-950 border border-emerald-500/20 rounded-xl p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-5">
            <Network className="w-7 h-7 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Você ainda não é parceiro</h2>
          <p className="text-sm text-slate-400 max-w-xl mx-auto leading-relaxed mb-6">
            Ao entrar no programa você recebe um link próprio e passa a receber de {(PARTNER_TIERS[0].marginShare * 100).toFixed(0)}%
            a {(PARTNER_TIERS[PARTNER_TIERS.length - 1].marginShare * 100).toFixed(0)}% sobre a base de comissão gerada por quem
            se cadastrar por ele — recorrente, enquanto essas pessoas operarem.
          </p>
          <button
            onClick={handleEnroll}
            disabled={enrolling}
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold text-sm uppercase tracking-wider px-6 py-3 rounded-lg transition-colors"
          >
            {enrolling ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            Ativar meu link
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
          <div className="xl:col-span-2 space-y-6">
            <EarningsSimulator />
            <ProgramRules />
          </div>
          <TierLadder currentTier="NODE" activeReferrals={0} />
        </div>
      </Shell>
    );
  }

  // ── Estado pronto ─────────────────────────────────────────────────────────
  return (
    <PartnerDashboardView
      data={state.data}
      periodId={periodId}
      onPeriodChange={setPeriodId}
      onReload={() => void load()}
      tab={tab}
      onTabChange={setTab}
      copied={copied}
      onCopied={setCopied}
    />
  );
}

/**
 * Apresentação pura do painel de um parceiro já carregado. Separada do
 * container acima de propósito: é o que permite verificar a tela inteira sem
 * banco e sem sessão (harness de verificação visual), e o que mantém a busca de
 * dados fora do componente que desenha.
 */
export function PartnerDashboardView({
  data, periodId, onPeriodChange, onReload, tab, onTabChange, copied, onCopied,
}: {
  data: PartnerDashboard;
  periodId: (typeof PERIODS)[number]['id'];
  onPeriodChange: (id: (typeof PERIODS)[number]['id']) => void;
  onReload: () => void;
  tab: Tab;
  onTabChange: (t: Tab) => void;
  copied: boolean;
  onCopied: (v: boolean) => void;
}) {
  const period = PERIODS.find((p) => p.id === periodId)!;
  const tier = PARTNER_TIERS.find((t) => t.id === data.tier) ?? resolveTier(data.activeReferrals);
  const link = `${window.location.origin}/?ref=${data.referralCode}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(link);
    onCopied(true);
    setTimeout(() => onCopied(false), 2000);
    toast.success('Link copiado');
  };

  const handlePayout = async () => {
    if (data.availableBalance < PROGRAM_RULES.minPayoutBRL) return;
    const result = await requestPayout(data.partnerId, data.availableBalance, 'PIX');
    if (result.ok) {
      toast.success('Saque solicitado', { description: 'Você recebe a confirmação quando for processado.' });
      onReload();
    } else {
      toast.error('Não foi possível solicitar o saque', { description: result.error });
    }
  };

  return (
    <Shell
      tier={tier.label}
      share={tier.marginShare}
      period={periodId}
      onPeriodChange={onPeriodChange}
    >
      {/* Link de indicação */}
      <div className="bg-gradient-to-r from-emerald-500/[0.07] to-transparent border border-emerald-500/20 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <div className="p-2.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
            <Share2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-emerald-400/70 uppercase tracking-widest">Seu link</p>
            <p className="text-lg font-bold text-white font-mono tracking-tight">{data.referralCode}</p>
          </div>
        </div>

        <div className="flex-1 flex items-center gap-2 bg-black/50 border border-white/10 rounded-lg px-3 py-2.5 min-w-0">
          <code className="text-xs text-slate-300 font-mono truncate flex-1">{link}</code>
          <button
            onClick={copyLink}
            className="p-1.5 hover:bg-white/10 rounded transition-colors text-slate-400 hover:text-emerald-400 shrink-0"
            title="Copiar link"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* KPIs — todos vindos do banco */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi
          label="Disponível para saque"
          value={BRL(data.availableBalance)}
          icon={Wallet}
          accent
          footer={
            data.availableBalance >= PROGRAM_RULES.minPayoutBRL ? (
              <button
                onClick={handlePayout}
                className="w-full mt-1 text-[11px] font-bold text-black bg-emerald-500 hover:bg-emerald-400 px-4 py-2 rounded uppercase tracking-wider transition-colors"
              >
                Solicitar saque
              </button>
            ) : (
              <span className="text-[10px] text-slate-600">
                Mínimo de {BRL(PROGRAM_RULES.minPayoutBRL)} para sacar
              </span>
            )
          }
        />
        <Kpi
          label="Em maturação"
          value={BRL(data.pendingBalance)}
          icon={Clock}
          footer={<span className="text-[10px] text-slate-600">Liberado {PROGRAM_RULES.maturityDays} dias após a apuração</span>}
        />
        <Kpi
          label="Ganho acumulado"
          value={BRL(data.lifetimeEarned)}
          icon={TrendingUp}
          footer={<span className="text-[10px] text-slate-600">{data.lifetimeLots.toFixed(2)} lotes gerados pela sua rede</span>}
        />
        <Kpi
          label="Indicados ativos"
          value={String(data.activeReferrals)}
          icon={Users}
          footer={<span className="text-[10px] text-slate-600">de {data.totalReferrals} cadastrados pelo seu link</span>}
        />
      </div>

      {/* Funil */}
      <FunnelStrip data={data} />

      {/* Abas */}
      <div className="flex items-center gap-1 border-b border-white/5">
        <TabButton active={tab === 'network'} onClick={() => onTabChange('network')} icon={Network} label="Rede" />
        <TabButton active={tab === 'statement'} onClick={() => onTabChange('statement')} icon={ReceiptText} label="Extrato" />
        <TabButton active={tab === 'program'} onClick={() => onTabChange('program')} icon={BookOpen} label="Programa" />
      </div>

      {tab === 'network' && (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-3">
            <ReferralNetworkPanel
              referrals={data.referrals}
              marginShare={tier.marginShare}
              periodLabel={period.label.toLowerCase()}
            />
          </div>
          <TierLadder currentTier={data.tier} activeReferrals={data.activeReferrals} />
        </div>
      )}

      {tab === 'statement' && <StatementPanel data={data} />}

      {tab === 'program' && (
        <div className="space-y-6">
          <EarningsSimulator />
          <ProgramRules />
        </div>
      )}
    </Shell>
  );
}

// ─── Estrutura da página ────────────────────────────────────────────────────

function Shell({ children, tier, share, period, onPeriodChange }: {
  children: React.ReactNode;
  tier?: string;
  share?: number;
  period?: string;
  onPeriodChange?: (id: (typeof PERIODS)[number]['id']) => void;
}) {
  return (
    <div className="p-4 md:p-8 space-y-6 bg-black min-h-full text-slate-200 font-sans">
      <div className="flex flex-wrap items-start gap-4 pb-6 border-b border-white/5">
        <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
          <Network className="w-8 h-8 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-[240px]">
          <h1 className="text-3xl font-bold tracking-tight text-white uppercase">Parceiros IB</h1>
          <p className="text-slate-400 mt-1 tracking-wide font-light">
            Indique traders e receba sobre o que eles geram — de forma recorrente e auditável
          </p>
        </div>

        {onPeriodChange && (
          <select
            value={period}
            onChange={(e) => onPeriodChange(e.target.value as (typeof PERIODS)[number]['id'])}
            className="bg-black border border-white/10 text-xs text-slate-300 rounded-lg px-3 py-2.5 outline-none focus:border-emerald-500/40"
          >
            {PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        )}

        {tier && share !== undefined && (
          <div className="flex items-center gap-3 bg-emerald-950/30 border border-emerald-500/20 px-4 py-2.5 rounded-lg">
            <div>
              <p className="text-[10px] text-emerald-400/70 font-bold uppercase tracking-widest">Seu nível</p>
              <p className="text-sm font-bold text-white">
                {tier} <span className="text-xs font-normal text-emerald-400 ml-1">{(share * 100).toFixed(0)}% da base</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {children}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-center min-h-[400px]">{children}</div>;
}

function Notice({ icon: Icon, tone, title, body, action }: {
  icon: React.ElementType; tone: 'red' | 'amber'; title: string; body: string;
  action?: { label: string; onClick: () => void };
}) {
  const tones = {
    red: 'border-red-500/20 bg-red-500/[0.04] text-red-400',
    amber: 'border-amber-500/20 bg-amber-500/[0.04] text-amber-400',
  };
  return (
    <div className={`border rounded-xl p-6 flex items-start gap-4 ${tones[tone]}`}>
      <Icon className="w-6 h-6 shrink-0 mt-0.5" />
      <div className="flex-1">
        <h3 className="text-sm font-bold text-white mb-1.5">{title}</h3>
        <p className="text-xs text-slate-400 leading-relaxed">{body}</p>
        {action && (
          <button
            onClick={action.onClick}
            className="mt-4 text-xs font-bold text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded transition-colors"
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, footer, accent }: {
  label: string; value: string; icon: React.ElementType; footer?: React.ReactNode; accent?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-neutral-950 border rounded-xl p-5 flex flex-col gap-3 ${accent ? 'border-emerald-500/25' : 'border-white/5'}`}
    >
      <div className="flex items-start justify-between">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</p>
        <Icon className={`w-4 h-4 ${accent ? 'text-emerald-500/60' : 'text-slate-700'}`} />
      </div>
      <p className="text-2xl font-bold text-white tracking-tight tabular-nums">{value}</p>
      {footer && <div className="mt-auto">{footer}</div>}
    </motion.div>
  );
}

function FunnelStrip({ data }: { data: PartnerDashboard }) {
  const steps = [
    { label: 'Cadastraram', value: data.totalReferrals },
    { label: 'Conectaram conta', value: data.linkedReferrals },
    { label: 'Começaram a operar', value: data.tradingReferrals },
    { label: 'Assinaram um plano', value: data.payingReferrals },
  ];
  const top = Math.max(1, steps[0].value);

  return (
    <div className="bg-neutral-950 border border-white/5 rounded-xl p-5">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Funil da sua rede</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {steps.map((step, i) => {
          const pct = (step.value / top) * 100;
          const prev = i === 0 ? null : steps[i - 1].value;
          const drop = prev && prev > 0 ? ((prev - step.value) / prev) * 100 : null;
          return (
            <div key={step.label}>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white tabular-nums">{step.value}</span>
                {drop !== null && drop > 0 && (
                  <span className="text-[10px] text-red-400/70 font-mono">−{drop.toFixed(0)}%</span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mb-2">{step.label}</p>
              <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, delay: i * 0.08 }}
                  className="h-full bg-emerald-500/60"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: {
  active: boolean; onClick: () => void; icon: React.ElementType; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
        active ? 'text-emerald-400 border-emerald-500' : 'text-slate-500 border-transparent hover:text-slate-300'
      }`}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

function StatementPanel({ data }: { data: PartnerDashboard }) {
  const STATUS = {
    PENDING:   { label: 'Em maturação', tone: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    AVAILABLE: { label: 'Disponível',   tone: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    PAID:      { label: 'Pago',         tone: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
    REVERSED:  { label: 'Estornado',    tone: 'text-red-400 bg-red-500/10 border-red-500/20' },
  } as const;

  if (data.entries.length === 0) {
    return (
      <div className="bg-neutral-950 border border-white/5 rounded-xl p-12 text-center">
        <ReceiptText className="w-10 h-10 text-slate-700 mx-auto mb-4" />
        <p className="text-sm text-slate-400 font-medium">Nenhum lançamento no período</p>
        <p className="text-xs text-slate-600 mt-2 max-w-md mx-auto leading-relaxed">
          A apuração roda uma vez por mês. Cada linha aqui guarda a alíquota e a base usadas no cálculo —
          o extrato é append-only: correção entra como estorno, nunca como edição do lançamento original.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-neutral-950 border border-white/5 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-white/[0.03] border-b border-white/5">
              <th className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Competência</th>
              <th className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nível</th>
              <th className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Lotes</th>
              <th className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Base</th>
              <th className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Alíquota</th>
              <th className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Valor</th>
              <th className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data.entries.map((e) => {
              const status = STATUS[e.status];
              return (
                <tr key={e.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="p-4 text-xs text-slate-300 font-mono">
                    {new Date(e.periodStart).toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}
                  </td>
                  <td className="p-4 text-xs text-slate-400">{e.tierAtAccrual}</td>
                  <td className="p-4 text-xs text-right font-mono text-slate-300">{e.lots.toFixed(2)}</td>
                  <td className="p-4 text-xs text-right font-mono text-slate-400">{BRL(e.marginBase)}</td>
                  <td className="p-4 text-xs text-right font-mono text-slate-400">{(e.marginShare * 100).toFixed(0)}%</td>
                  <td className={`p-4 text-sm text-right font-mono font-bold ${e.amount < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {BRL(e.amount)}
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${status.tone}`}>
                      {status.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
