/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  NEURAL DAY TRADER - SYSTEM MODULE                                ║
 * ║  Main Component - Admin & Management                              ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import React, { useState } from 'react';
import {
  Shield,
  Lightbulb,
  Activity,
  Users,
  Lock,
  DollarSign,
  TrendingUp,
  Server,
  Settings,
  Sparkles,
  Database,
} from 'lucide-react';
import { SystemPage } from './types';
import { AdminDashboard } from '@/app/components/admin/AdminDashboard';
import { LabIntelligence } from '@/app/components/admin/LabIntelligence';
import { AssetHealthMonitor } from '@/app/components/system/AssetHealthMonitor';
import { UserIntelligence } from '@/app/components/admin/UserIntelligence';
import { DefensiveArchitecture } from '@/app/components/admin/DefensiveArchitecture';
import { MarketDataControlPanel } from '@/app/components/MarketDataControlPanel';

export function SystemView() {
  const [activePage, setActivePage] = useState<SystemPage>('admin');
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);

  console.log('[SYSTEM] Module loaded, active page:', activePage);

  // Se Admin Dashboard completo estiver ativo, renderizar ele full screen
  if (showAdminDashboard) {
    return <AdminDashboard onExit={() => setShowAdminDashboard(false)} />;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-gradient-to-br from-purple-950/20 via-black to-emerald-950/20">
        <div className="max-w-[1600px] mx-auto px-8 py-12">
          <div className="flex items-start justify-between">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/30 rounded-full text-sm text-purple-400 font-semibold mb-6">
                <Shield className="w-4 h-4" />
                Gestão e Administração
              </div>

              <h1 className="text-5xl font-bold mb-4">
                <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-emerald-400 bg-clip-text text-transparent">
                  Sistema
                </span>
              </h1>

              <p className="text-xl text-slate-400">
                Painel administrativo completo: finanças, inovação e controle da plataforma
              </p>
            </div>

            {/* Status Badge */}
            <div className="px-6 py-4 bg-purple-500/10 border border-purple-500/30 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse" />
                <div>
                  <div className="text-xs text-slate-400">Modo</div>
                  <div className="text-lg font-bold text-purple-400">Admin</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Cards */}
      <div className="max-w-[1600px] mx-auto px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {SYSTEM_PAGES.map(page => (
            <button
              key={page.id}
              onClick={() => {
                if (page.id === 'admin') {
                  setShowAdminDashboard(true);
                } else {
                  setActivePage(page.id);
                }
              }}
              className={`group relative p-8 rounded-3xl border transition-all text-left ${
                activePage === page.id && page.id !== 'admin'
                  ? 'bg-white/10 border-white/20 shadow-2xl shadow-purple-500/10'
                  : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
              }`}
            >
              {/* Icon */}
              <div className={`inline-flex p-4 rounded-2xl mb-6 ${page.color}`}>
                <page.icon className="w-8 h-8" />
              </div>

              {/* Content */}
              <h3 className="text-2xl font-bold mb-2">{page.label}</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                {page.description}
              </p>

              {/* Features */}
              <ul className="space-y-2">
                {page.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-xs text-slate-500">
                    <div className="w-1 h-1 rounded-full bg-slate-600" />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* Arrow indicator */}
              <div className="absolute top-8 right-8 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                  →
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Content Area */}
        {activePage !== 'admin' && (
          <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
            {activePage === 'innovation' && (
              <div className="p-8">
                <div className="mb-8">
                  <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
                    <Sparkles className="w-8 h-8 text-yellow-400" />
                    Innovation & Control Center
                  </h2>
                  <p className="text-slate-400">
                    IA auxiliando com sugestões inteligentes para novas funcionalidades da plataforma
                  </p>
                </div>
                <LabIntelligence embedded={false} />
              </div>
            )}

            {activePage === 'monitoring' && (
              <div className="p-8">
                <div className="mb-8">
                  <h2 className="text-3xl font-bold mb-2">Monitoramento do Sistema</h2>
                  <p className="text-slate-400">
                    Saúde dos ativos, fontes de dados e infraestrutura em tempo real
                  </p>
                </div>
                <AssetHealthMonitor />
              </div>
            )}

            {activePage === 'users' && (
              <div className="p-8">
                <div className="mb-8">
                  <h2 className="text-3xl font-bold mb-2">Gestão de Usuários</h2>
                  <p className="text-slate-400">
                    Análise de comportamento, engajamento e inteligência de usuários
                  </p>
                </div>
                <UserIntelligence />
              </div>
            )}

            {activePage === 'security' && (
              <div className="p-8">
                <div className="mb-8">
                  <h2 className="text-3xl font-bold mb-2">Segurança & Defesa</h2>
                  <p className="text-slate-400">
                    Arquitetura defensiva, proteção contra ataques e monitoramento de ameaças
                  </p>
                </div>
                <DefensiveArchitecture />
              </div>
            )}

            {activePage === 'marketdata' && (
              <div className="p-8">
                <div className="mb-8">
                  <h2 className="text-3xl font-bold mb-2">MT5 Price Validator</h2>
                  <p className="text-slate-400">
                    Validação de preços em tempo real com MT5/MetaAPI para toda a plataforma
                  </p>
                </div>
                <MarketDataControlPanel />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SYSTEM_PAGES = [
  {
    id: 'admin' as SystemPage,
    label: 'Admin Dashboard',
    description: 'Painel administrativo completo com gestão financeira, métricas e controle total da plataforma',
    icon: Shield,
    color: 'bg-purple-500/10 text-purple-400',
    features: [
      'Visão geral do sistema',
      'Gestão financeira e receitas',
      'Marketing e campanhas',
      'Configurações avançadas',
      'Logs e auditoria'
    ]
  },
  {
    id: 'innovation' as SystemPage,
    label: 'Innovation & Control Center',
    description: 'Centro de inovação com IA sugerindo novas funcionalidades e melhorias para a plataforma',
    icon: Lightbulb,
    color: 'bg-yellow-500/10 text-yellow-400',
    features: [
      'Sugestões de IA para features',
      'Sistema de priorização',
      'Roadmap automatizado',
      'Análise de competitividade',
      'Tracking de implementações'
    ]
  },
  {
    id: 'monitoring' as SystemPage,
    label: 'Monitoramento',
    description: 'Monitoramento completo de ativos, fontes de dados e infraestrutura da plataforma',
    icon: Activity,
    color: 'bg-emerald-500/10 text-emerald-400',
    features: [
      'Saúde dos 300+ ativos',
      'Status das fontes de dados',
      'Latência e performance',
      'Alertas automáticos',
      'Histórico de incidentes'
    ]
  },
  {
    id: 'users' as SystemPage,
    label: 'Gestão de Usuários',
    description: 'Inteligência e análise de comportamento dos usuários da plataforma',
    icon: Users,
    color: 'bg-blue-500/10 text-blue-400',
    features: [
      'Análise de engajamento',
      'Tracking de usuários',
      'Métricas de retenção',
      'Behavior analytics',
      'Segmentação inteligente'
    ]
  },
  {
    id: 'security' as SystemPage,
    label: 'Segurança',
    description: 'Arquitetura defensiva e proteção contra ataques e ameaças',
    icon: Lock,
    color: 'bg-red-500/10 text-red-400',
    features: [
      'Defensive architecture',
      'Detecção de ameaças',
      'Firewall e proteção',
      'Logs de segurança',
      'Incident response'
    ]
  },
  {
    id: 'marketdata' as SystemPage,
    label: 'MT5 Price Validator',
    description: 'Validação de preços em tempo real com MT5/MetaAPI para toda a plataforma',
    icon: Database,
    color: 'bg-cyan-500/10 text-cyan-400',
    features: [
      'Conexão direta com MT5',
      'Preços reais via MetaAPI',
      'S&P 500 validado (6020.00)',  // ✅ CORRIGIDO
      'Cache inteligente (5-10s)',
      'Fallback automático'
    ]
  },
];