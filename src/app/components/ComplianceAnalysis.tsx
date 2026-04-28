import React, { useState } from 'react';
import { 
  Scale, 
  Shield, 
  AlertTriangle, 
  CheckCircle2, 
  FileText, 
  Building2, 
  Lock, 
  Users, 
  DollarSign,
  ChevronDown,
  ChevronUp,
  Globe,
  BookOpen,
  Briefcase,
  XCircle,
  AlertCircle,
  TrendingUp,
  Clock
} from 'lucide-react';

// ✅ EXPORT NOMEADO - v3.1.1
export function ComplianceAnalysis() {
  const [expandedSection, setExpandedSection] = useState<string | null>('overview');

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="border-b border-gray-800 pb-6">
          <div className="flex items-center gap-3 mb-3">
            <Scale className="w-10 h-10 text-blue-500" />
            <h1 className="text-4xl font-bold">Análise Jurídica e Compliance</h1>
          </div>
          <p className="text-xl text-gray-400">
            Requisitos Legais para Operação no Brasil e Portugal - Neural Day Trader Platform
          </p>
          <div className="mt-4 flex gap-2 flex-wrap">
            <span className="px-3 py-1 bg-blue-500/20 border border-blue-500/40 rounded text-xs text-blue-400 font-medium">
              Modelo: Fornecedor de Tecnologia SaaS
            </span>
            <span className="px-3 py-1 bg-green-500/20 border border-green-500/40 rounded text-xs text-green-400 font-medium">
              Jurisdição: Brasil + Portugal
            </span>
            <span className="px-3 py-1 bg-yellow-500/20 border border-yellow-500/40 rounded text-xs text-yellow-400 font-medium">
              Status: Não é Gestor de Fundos
            </span>
          </div>
        </div>

        {/* Conteúdo simplificado */}
        <div className="bg-gradient-to-br from-green-500/20 via-blue-500/20 to-purple-500/20 border-2 border-green-500/50 rounded-lg p-8">
          <h2 className="text-2xl font-bold text-white mb-6">✅ Análise Jurídica Completa Disponível</h2>
          
          <div className="space-y-4 text-gray-300">
            <p className="text-lg">
              A Neural Day Trader Platform é uma <strong className="text-blue-400">plataforma SaaS</strong> (Software as a Service) que fornece tecnologia de automação de trading.
            </p>
            
            <div className="bg-black/50 border border-green-500/30 rounded-lg p-6">
              <h3 className="text-lg font-bold text-green-400 mb-3">✅ O QUE SOMOS:</h3>
              <ul className="space-y-2 ml-6">
                <li>• Fornecedor de software de análise técnica e automação</li>
                <li>• Plataforma de integração com brokers via API (MetaApi)</li>
                <li>• Provedor de indicadores, estratégias e ferramentas quantitativas</li>
                <li>• Empresa de tecnologia SaaS com modelo de assinatura mensal</li>
              </ul>
            </div>

            <div className="bg-black/50 border border-red-500/30 rounded-lg p-6">
              <h3 className="text-lg font-bold text-red-400 mb-3">❌ O QUE NÃO SOMOS:</h3>
              <ul className="space-y-2 ml-6">
                <li>• <strong>NÃO</strong> somos gestor de fundos ou administrador de recursos</li>
                <li>• <strong>NÃO</strong> temos custódia de valores dos clientes</li>
                <li>• <strong>NÃO</strong> prestamos consultoria de investimento personalizada</li>
                <li>• <strong>NÃO</strong> garantimos retornos ou performance</li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded p-4">
                <h4 className="font-bold text-white mb-2">🇧🇷 Brasil</h4>
                <p className="text-sm">
                  <strong className="text-green-400">✅ Viável:</strong> LTDA com CNAE 62.01-5-01<br/>
                  <strong className="text-yellow-400">Custo inicial:</strong> R$ 12-35k<br/>
                  <strong className="text-blue-400">Compliance:</strong> LGPD obrigatório
                </p>
              </div>
              
              <div className="bg-purple-500/10 border border-purple-500/30 rounded p-4">
                <h4 className="font-bold text-white mb-2">🇵🇹 Portugal</h4>
                <p className="text-sm">
                  <strong className="text-green-400">✅ Viável:</strong> Unipessoal Lda. (€1 capital)<br/>
                  <strong className="text-yellow-400">Custo inicial:</strong> €7-20k<br/>
                  <strong className="text-blue-400">Compliance:</strong> GDPR obrigatório
                </p>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-700 text-center">
              <p className="text-xl font-bold text-white">
                💼 <strong className="text-green-400">PROJETO É LEGALMENTE VIÁVEL</strong> em ambas jurisdições
              </p>
              <p className="text-sm text-gray-400 mt-2">
                Recomendação: Iniciar no Brasil (mercado-alvo + custos menores)
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}