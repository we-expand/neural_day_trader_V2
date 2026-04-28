import React, { useState } from 'react';
import { 
  Rocket, 
  Target, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Zap,
  BarChart3
} from 'lucide-react';

// ✅ EXPORT NOMEADO - v3.1.2
export function LaunchStrategy() {
  const [expandedSection, setExpandedSection] = useState<string | null>('overview');

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="border-b border-gray-800 pb-6">
          <div className="flex items-center gap-3 mb-3">
            <Rocket className="w-10 h-10 text-blue-500" />
            <h1 className="text-4xl font-bold">Estratégia de Lançamento</h1>
          </div>
          <p className="text-xl text-gray-400">
            Roadmap Completo para Atingir R$ 178k MRR em 12 Meses
          </p>
          <div className="mt-4 flex gap-2 flex-wrap">
            <span className="px-3 py-1 bg-blue-500/20 border border-blue-500/40 rounded text-xs text-blue-400 font-medium">
              Meta: 1.200 usuários pagantes
            </span>
            <span className="px-3 py-1 bg-green-500/20 border border-green-500/40 rounded text-xs text-green-400 font-medium">
              Ticket: R$ 149/mês
            </span>
            <span className="px-3 py-1 bg-purple-500/20 border border-purple-500/40 rounded text-xs text-purple-400 font-medium">
              ARR Ano 1: R$ 2.1M
            </span>
          </div>
        </div>

        {/* Roadmap Trimestral */}
        <div className="grid grid-cols-2 gap-6">
          {/* Q1 */}
          <div className="bg-gradient-to-r from-blue-500/20 to-blue-500/5 border border-blue-500/50 rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-sm font-bold text-gray-400 mb-1">Q1</div>
                <h3 className="text-xl font-bold text-white">FASE ALPHA</h3>
                <p className="text-sm text-gray-400">Mês 1-3 - Validação</p>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400">Usuários</div>
                <div className="text-lg font-bold text-white">15 → 75</div>
                <div className="text-xs text-gray-400 mt-2">MRR</div>
                <div className="text-lg font-bold text-green-400">R$ 0 → 3.7k</div>
              </div>
            </div>
            <div className="bg-black/30 border border-gray-700 rounded p-3 text-sm">
              <strong className="text-blue-400">Pricing:</strong> R$ 49/mês (early adopter)<br/>
              <strong className="text-yellow-400">CAC:</strong> R$ 0 (orgânico)<br/>
              <strong className="text-green-400">Objetivo:</strong> Validar produto-mercado fit
            </div>
          </div>

          {/* Q2 */}
          <div className="bg-gradient-to-r from-green-500/20 to-green-500/5 border border-green-500/50 rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-sm font-bold text-gray-400 mb-1">Q2</div>
                <h3 className="text-xl font-bold text-white">FASE BETA</h3>
                <p className="text-sm text-gray-400">Mês 4-6 - Tração Inicial</p>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400">Usuários</div>
                <div className="text-lg font-bold text-white">75 → 300</div>
                <div className="text-xs text-gray-400 mt-2">MRR</div>
                <div className="text-lg font-bold text-green-400">R$ 3.7k → 44.7k</div>
              </div>
            </div>
            <div className="bg-black/30 border border-gray-700 rounded p-3 text-sm">
              <strong className="text-blue-400">Pricing:</strong> R$ 149/mês (final)<br/>
              <strong className="text-yellow-400">Budget:</strong> R$ 9k/mês (Ads + Afiliados)<br/>
              <strong className="text-green-400">Objetivo:</strong> Escalar aquisição
            </div>
          </div>

          {/* Q3 */}
          <div className="bg-gradient-to-r from-purple-500/20 to-purple-500/5 border border-purple-500/50 rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-sm font-bold text-gray-400 mb-1">Q3</div>
                <h3 className="text-xl font-bold text-white">FASE GROWTH</h3>
                <p className="text-sm text-gray-400">Mês 7-9 - Escala Agressiva</p>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400">Usuários</div>
                <div className="text-lg font-bold text-white">300 → 700</div>
                <div className="text-xs text-gray-400 mt-2">MRR</div>
                <div className="text-lg font-bold text-green-400">R$ 44.7k → 104.3k</div>
              </div>
            </div>
            <div className="bg-black/30 border border-gray-700 rounded p-3 text-sm">
              <strong className="text-blue-400">Pricing:</strong> R$ 149 + Elite R$ 297<br/>
              <strong className="text-yellow-400">Budget:</strong> R$ 39k/mês (Scale-up)<br/>
              <strong className="text-green-400">Objetivo:</strong> Upsell + Influencers
            </div>
          </div>

          {/* Q4 */}
          <div className="bg-gradient-to-r from-orange-500/20 to-orange-500/5 border border-orange-500/50 rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-sm font-bold text-gray-400 mb-1">Q4</div>
                <h3 className="text-xl font-bold text-white">FASE SCALE</h3>
                <p className="text-sm text-gray-400">Mês 10-12 - Consolidação</p>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400">Usuários</div>
                <div className="text-lg font-bold text-white">700 → 1.200</div>
                <div className="text-xs text-gray-400 mt-2">MRR</div>
                <div className="text-lg font-bold text-green-400">R$ 104k → 178k ✅</div>
              </div>
            </div>
            <div className="bg-black/30 border border-gray-700 rounded p-3 text-sm">
              <strong className="text-blue-400">Pricing:</strong> + Enterprise (custom)<br/>
              <strong className="text-yellow-400">Budget:</strong> R$ 50k/mês<br/>
              <strong className="text-green-400">Objetivo:</strong> META ATINGIDA!
            </div>
          </div>
        </div>

        {/* Métricas Principais */}
        <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 border border-green-500/40 rounded-lg p-6">
          <h3 className="text-lg font-bold text-white mb-4">📊 Métricas-Chave (Mês 12)</h3>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-black/50 border border-gray-700 rounded p-4">
              <div className="text-xs text-gray-400">CAC</div>
              <div className="text-2xl font-bold text-white">R$ 150</div>
              <div className="text-xs text-green-400">✅ Meta: &lt; R$ 200</div>
            </div>
            <div className="bg-black/50 border border-gray-700 rounded p-4">
              <div className="text-xs text-gray-400">LTV</div>
              <div className="text-2xl font-bold text-white">R$ 4.470</div>
              <div className="text-xs text-green-400">✅✅ 30 meses</div>
            </div>
            <div className="bg-black/50 border border-gray-700 rounded p-4">
              <div className="text-xs text-gray-400">LTV/CAC</div>
              <div className="text-2xl font-bold text-white">29.8x</div>
              <div className="text-xs text-green-400">✅✅✅ Benchmark: 3x</div>
            </div>
            <div className="bg-black/50 border border-gray-700 rounded p-4">
              <div className="text-xs text-gray-400">Payback</div>
              <div className="text-2xl font-bold text-white">2 meses</div>
              <div className="text-xs text-green-400">✅✅✅ Excelente</div>
            </div>
          </div>
        </div>

        {/* Conclusão */}
        <div className="bg-gradient-to-br from-green-500/20 via-blue-500/20 to-purple-500/20 border-2 border-green-500/50 rounded-lg p-8">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
            <Rocket className="w-7 h-7 text-green-400" />
            Conclusão: META ATINGÍVEL
          </h2>
          <p className="text-lg text-gray-300">
            <strong className="text-green-400">✅ R$ 178k MRR EM 12 MESES É ATINGÍVEL</strong> com execução disciplinada.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div className="bg-black/50 border border-gray-700 rounded p-4">
              <p className="font-bold text-white mb-2">Fatores de Sucesso:</p>
              <ul className="space-y-1 text-xs text-gray-300">
                <li>✅ Produto diferenciado (pyramiding único)</li>
                <li>✅ Pricing agressivo (87% mais barato)</li>
                <li>✅ Unit economics saudáveis (LTV/CAC 29.8x)</li>
                <li>✅ Mercado em crescimento</li>
              </ul>
            </div>
            <div className="bg-black/50 border border-gray-700 rounded p-4">
              <p className="font-bold text-white mb-2">Próximos Passos:</p>
              <ul className="space-y-1 text-xs text-gray-300">
                <li>1️⃣ Finalizar compliance (2 semanas)</li>
                <li>2️⃣ Recrutar 15 beta testers</li>
                <li>3️⃣ Setup analytics</li>
                <li>4️⃣ Lançar landing page</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}