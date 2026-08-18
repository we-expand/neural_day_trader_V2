/**
 * Regras do programa, escada de níveis e simulador de ganhos — 2026-08-18.
 *
 * O simulador é PROJEÇÃO declarada, não dado realizado: os números saem de
 * `projectEarnings()` sobre premissas que o próprio usuário mexe, e a tela diz
 * isso em texto. Isso é diferente do que a tela antiga fazia (exibir R$1.250 de
 * "Comissão Total" fabricada como se fosse saldo real).
 */
import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Calculator, Info, Lock, ShieldCheck, TrendingUp } from 'lucide-react';
import {
  PARTNER_TIERS,
  REALISTIC_SCENARIO,
  PROGRAM_RULES,
  projectEarnings,
  resolveTier,
  type PartnerTierId,
} from '@/app/services/partners/CommissionModel';

const BRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const BRL2 = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

// ─────────────────────────────────────────────────────────────────────────────

export function TierLadder({ currentTier, activeReferrals }: { currentTier: PartnerTierId; activeReferrals: number }) {
  return (
    <div className="bg-neutral-950 border border-white/5 rounded-xl p-6">
      <div className="flex items-baseline justify-between mb-5">
        <h3 className="text-sm font-bold text-white uppercase tracking-widest">Níveis</h3>
        <span className="text-[11px] text-slate-500">
          {activeReferrals} {activeReferrals === 1 ? 'indicado ativo' : 'indicados ativos'}
        </span>
      </div>

      <div className="space-y-2.5">
        {PARTNER_TIERS.map((tier) => {
          const isCurrent = tier.id === currentTier;
          const isReached = activeReferrals >= tier.minActiveReferrals;
          const previous = PARTNER_TIERS[PARTNER_TIERS.indexOf(tier) - 1];
          const floor = previous ? previous.minActiveReferrals : 0;
          const progress = Math.min(100, Math.max(0,
            ((activeReferrals - floor) / Math.max(1, tier.minActiveReferrals - floor)) * 100));

          return (
            <div
              key={tier.id}
              className={`rounded-lg border p-4 transition-colors ${
                isCurrent
                  ? 'border-emerald-500/40 bg-emerald-500/[0.06]'
                  : isReached
                    ? 'border-white/10 bg-white/[0.02]'
                    : 'border-white/5 bg-transparent'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className={`text-sm font-bold tracking-tight ${isCurrent ? 'text-emerald-400' : isReached ? 'text-slate-200' : 'text-slate-500'}`}>
                    {tier.label}
                  </span>
                  {isCurrent && (
                    <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded">
                      Atual
                    </span>
                  )}
                  {!isReached && <Lock className="w-3 h-3 text-slate-700" />}
                </div>
                <div className="text-right">
                  <span className={`text-lg font-bold tabular-nums ${isCurrent ? 'text-emerald-400' : isReached ? 'text-slate-300' : 'text-slate-600'}`}>
                    {(tier.marginShare * 100).toFixed(0)}%
                  </span>
                  <span className="text-[10px] text-slate-600 block -mt-1">da base</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">{tier.perk}</p>

              {!isReached && (
                <div className="mt-3">
                  <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className="h-full bg-slate-500"
                    />
                  </div>
                  <p className="text-[10px] text-slate-600 mt-1.5">
                    Faltam {tier.minActiveReferrals - activeReferrals} indicados ativos
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function EarningsSimulator() {
  const [referrals, setReferrals] = useState(10);
  const [payingShare, setPayingShare] = useState(0.3);
  const [lotsPerPaying, setLotsPerPaying] = useState(5);

  const projection = useMemo(
    () => projectEarnings({
      referrals,
      payingShare,
      lotsPerPayingReferral: lotsPerPaying,
      lotsPerFreeReferral: 0.7,
      averageSubscription: 249,
    }),
    [referrals, payingShare, lotsPerPaying],
  );

  const tier = resolveTier(referrals);

  return (
    <div className="bg-neutral-950 border border-white/5 rounded-xl p-6">
      <div className="flex items-center gap-2.5 mb-1">
        <Calculator className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-bold text-white uppercase tracking-widest">Simulador de ganhos</h3>
      </div>
      <p className="text-[11px] text-slate-500 mb-6">
        Projeção a partir de premissas que você controla — não é saldo, não é previsão de resultado.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <Slider
            label="Indicados ativos"
            value={referrals}
            display={String(referrals)}
            min={0} max={100} step={1}
            onChange={setReferrals}
          />
          <Slider
            label="Quantos viram assinantes"
            value={payingShare}
            display={`${(payingShare * 100).toFixed(0)}%`}
            min={0} max={1} step={0.05}
            onChange={setPayingShare}
          />
          <Slider
            label="Lotes/mês por assinante"
            value={lotsPerPaying}
            display={lotsPerPaying.toFixed(1)}
            min={0.5} max={20} step={0.5}
            onChange={setLotsPerPaying}
          />

          <div className="flex items-start gap-2.5 pt-1">
            <Info className="w-3.5 h-3.5 text-slate-600 shrink-0 mt-0.5" />
            <p className="text-[10px] text-slate-600 leading-relaxed">
              Premissas fixas: mensalidade média de {BRL(249)}, {BRL(REALISTIC_SCENARIO.ownCommissionPerLot + REALISTIC_SCENARIO.brokerRebatePerLot)} de
              receita por lote operado, imposto de {(REALISTIC_SCENARIO.taxRate * 100).toFixed(0)}% e custo de operação
              de {BRL2(REALISTIC_SCENARIO.infraCostPerUser)} por conta ativa/mês. São as mesmas premissas do
              modelo financeiro do produto, não números escolhidos para impressionar.
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-5">
          <div className="bg-black/60 border border-emerald-500/20 rounded-xl p-5">
            <p className="text-[10px] font-bold text-emerald-400/70 uppercase tracking-widest mb-1">
              Projeção mensal · nível {tier.label}
            </p>
            <p className="text-4xl font-bold text-white tracking-tight tabular-nums">
              {BRL(projection.monthlyCommission)}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              {BRL(projection.yearlyCommission)} em 12 meses, mantido o mesmo cenário
            </p>

            {projection.perPaying.equivalentPerLot !== null && projection.monthlyCommission > 0 && (
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 text-xs">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-400">
                  Equivale a <strong className="text-emerald-400 font-mono">
                    {BRL2(projection.perPaying.equivalentPerLot)}
                  </strong> por lote de um assinante
                </span>
              </div>
            )}
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">A conta dos dois lados</p>
            </div>
            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Sua parte</span>
                <span className="text-emerald-400">{BRL(projection.monthlyCommission)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Fica com a plataforma</span>
                <span className="text-slate-300">{BRL(projection.platformNet)}</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-white/5">
                <span className="text-slate-600">Sua fatia da margem</span>
                <span className="text-slate-400">{(projection.effectiveShareOfMargin * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slider({ label, value, display, min, max, step, onChange }: {
  label: string; value: number; display: string; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{label}</label>
        <span className="text-sm font-bold text-white font-mono tabular-nums">{display}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-emerald-500"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function ProgramRules() {
  return (
    <div className="bg-neutral-950 border border-white/5 rounded-xl p-6">
      <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-1">Como a comissão é calculada</h3>
      <p className="text-[11px] text-slate-500 mb-6">
        Uma regra só, aplicada igual para todo mundo, com a conta aberta em cada indicado.
      </p>

      <div className="bg-black/60 border border-white/10 rounded-lg p-5 mb-6 font-mono text-xs space-y-1.5">
        <p className="text-slate-400">receita gerada pelo indicado <span className="text-slate-600">(execução + assinatura + marketplace)</span></p>
        <p className="text-slate-600">− impostos sobre faturamento</p>
        <p className="text-slate-600">− custo de manter a conta dele rodando</p>
        <p className="text-emerald-400 pt-1.5 border-t border-white/10">= base de comissão × sua alíquota do nível</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Rule
          title="Você ganha enquanto ele operar"
          body="A comissão de execução é recorrente e não tem prazo: enquanto o indicado operar, você recebe sobre cada lote. Não é bônus único de cadastro."
        />
        <Rule
          title={`Liberação em ${PROGRAM_RULES.maturityDays} dias`}
          body="A corretora repassa o rebate com defasagem e pode estornar operações. A comissão fica em maturação nesse período e depois vira saldo sacável."
        />
        <Rule
          title={`Saque a partir de ${BRL(PROGRAM_RULES.minPayoutBRL)}`}
          body="Via PIX, transferência ou USDT. Abaixo desse valor o custo da transferência consumiria boa parte do que você ganhou."
        />
        <Rule
          title="Cadastro parado não gera comissão"
          body="Só existe comissão quando o indicado gera receita acima do custo de manter a conta dele. É o que impede o programa de pagar sobre prejuízo — e o que mantém o programa de pé."
        />
        <Rule
          title="Indicação direta apenas"
          body="Você ganha sobre quem você indicou. Não há comissão sobre indicação de indicação: isso caracterizaria remuneração por recrutamento, com risco regulatório real no Brasil."
        />
        <Rule
          title="Sem dado pessoal de terceiro"
          body="Você acompanha cada indicado por um ID e pelo estágio dele no funil. E-mail, telefone, depósito e saldo do indicado não aparecem — nem para você, nem para ninguém do programa."
        />
      </div>
    </div>
  );
}

function Rule({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-white/5 rounded-lg p-4 bg-white/[0.015]">
      <p className="text-xs font-bold text-slate-200 mb-1.5">{title}</p>
      <p className="text-[11px] text-slate-500 leading-relaxed">{body}</p>
    </div>
  );
}
