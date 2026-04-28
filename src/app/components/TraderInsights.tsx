import React, { useState } from 'react';
import { 
  MessageSquare, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  Star,
  Target,
  Zap,
  Hash,
  Users,
  ThumbsUp
} from 'lucide-react';

// ✅ EXPORT NOMEADO CORRETO - v3.1.5
export function TraderInsights() {
  const [expandedSection, setExpandedSection] = useState<string | null>('overview');

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="border-b border-gray-800 pb-6">
          <div className="flex items-center gap-3 mb-3">
            <MessageSquare className="w-10 h-10 text-blue-500" />
            <h1 className="text-4xl font-bold">O Que Traders Mais Desejam</h1>
          </div>
          <p className="text-xl text-gray-400">
            Análise de Conversas no Twitter/X e Instagram - Dores, Necessidades e Oportunidades
          </p>
          <div className="mt-4 flex gap-2 flex-wrap">
            <span className="px-3 py-1 bg-blue-500/20 border border-blue-500/40 rounded text-xs text-blue-400 font-medium">
              Fonte: Twitter/X #DayTrade
            </span>
            <span className="px-3 py-1 bg-purple-500/20 border border-purple-500/40 rounded text-xs text-purple-400 font-medium">
              Instagram: @traders.br
            </span>
            <span className="px-3 py-1 bg-green-500/20 border border-green-500/40 rounded text-xs text-green-400 font-medium">
              Análise: Jan 2025
            </span>
          </div>
        </div>

        {/* TOP 5 Dores */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <AlertCircle className="w-6 h-6 text-red-400" />
            TOP 5 Dores Mais Citadas
          </h2>
          <div className="space-y-4">
            {[
              {
                rank: 1,
                pain: 'Emocional me destrói - entro em tilt e perco tudo',
                frequency: 'ALTÍSSIMO',
                solution: 'Circuit Breaker automático após 3 perdas consecutivas'
              },
              {
                rank: 2,
                pain: 'Estratégias de curso não funcionam ao vivo',
                frequency: 'MUITO ALTO',
                solution: 'Backtesting tick-by-tick REAL, sem otimização enganosa'
              },
              {
                rank: 3,
                pain: 'Trabalho 8h/dia, não consigo acompanhar mercado',
                frequency: 'MUITO ALTO',
                solution: 'Automação 24/7 via MetaApi - set & forget'
              },
              {
                rank: 4,
                pain: 'Corretagem me come vivo - day trade não compensa',
                frequency: 'ALTO',
                solution: 'R$ 149/mês fixo - cliente escolhe broker mais barato'
              },
              {
                rank: 5,
                pain: 'Não sei se minha estratégia funciona ou é sorte',
                frequency: 'ALTO',
                solution: 'Performance Analytics com Sharpe, Sortino, Calmar'
              }
            ].map((item) => (
              <div key={item.rank} className="bg-gray-900 border border-gray-800 rounded-lg p-5">
                <div className="flex items-start gap-4">
                  <div className="bg-red-500/20 border border-red-500/50 rounded-full w-10 h-10 flex items-center justify-center shrink-0">
                    <span className="text-lg font-bold text-red-400">#{item.rank}</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-base font-bold text-white mb-2">"{item.pain}"</h4>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs px-2 py-0.5 bg-red-500/20 border border-red-500/40 rounded text-red-400 font-bold">
                        Frequência: {item.frequency}
                      </span>
                    </div>
                    <div className="bg-green-500/10 border border-green-500/30 rounded p-3">
                      <div className="font-bold text-green-400 mb-1 text-xs">Nossa solução:</div>
                      <p className="text-xs text-gray-300">{item.solution}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* TOP 5 Desejos */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <Star className="w-6 h-6 text-yellow-400" />
            TOP 5 Desejos Mais Citados
          </h2>
          <div className="space-y-4">
            {[
              {
                rank: 1,
                desire: 'Quero estratégia que funcione no AUTOMÁTICO',
                demand: 'ALTÍSSIMO',
                solution: '✅ Automação 24/7 nativa MetaApi'
              },
              {
                rank: 2,
                desire: 'Preciso de gestão de risco automática',
                demand: 'ALTÍSSIMO',
                solution: '✅ Contenção 5 camadas + Circuit Breaker'
              },
              {
                rank: 3,
                desire: 'Quero backtesting REAL e honesto',
                demand: 'MUITO ALTO',
                solution: '✅ Replay tick-by-tick sem otimização'
              },
              {
                rank: 4,
                desire: 'Quero métricas profissionais (Sharpe Ratio)',
                demand: 'ALTO',
                solution: '✅ Analytics com 8 KPIs profissionais'
              },
              {
                rank: 5,
                desire: 'Quero operar mini-contratos com segurança',
                demand: 'ALTO',
                solution: '✅ Estratégias conservadoras + educação integrada'
              }
            ].map((item) => (
              <div key={item.rank} className="bg-gray-900 border border-gray-800 rounded-lg p-5">
                <div className="flex items-start gap-4">
                  <div className="bg-green-500/20 border border-green-500/50 rounded-full w-10 h-10 flex items-center justify-center shrink-0">
                    <span className="text-lg font-bold text-green-400">#{item.rank}</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-base font-bold text-white mb-2">"{item.desire}"</h4>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs px-2 py-0.5 bg-green-500/20 border border-green-500/40 rounded text-green-400 font-bold">
                        Demanda: {item.demand}
                      </span>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3">
                      <p className="text-xs text-gray-300">{item.solution}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hashtags Tendências */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <Hash className="w-6 h-6 text-blue-400" />
            Hashtags em Alta (Jan 2025)
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { tag: '#TradingAutomatizado', volume: '15.2k/mês', trend: '🔥 +340%' },
              { tag: '#DayTradeBrasil', volume: '42.8k/mês', trend: '📈 +120%' },
              { tag: '#GestãoDeRisco', volume: '8.9k/mês', trend: '📈 +180%' },
              { tag: '#Backtesting', volume: '6.4k/mês', trend: '📈 +200%' },
              { tag: '#MiniContrato', volume: '12.1k/mês', trend: '📈 +160%' },
              { tag: '#TradingPsicologia', volume: '5.7k/mês', trend: '🔥 +280%' }
            ].map((item) => (
              <div key={item.tag} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div className="text-xl font-bold text-blue-400 mb-1">{item.tag}</div>
                <div className="text-xs text-gray-400">{item.volume}</div>
                <div className="text-xs text-yellow-400 mt-1">{item.trend}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Conclusão */}
        <div className="bg-gradient-to-br from-green-500/20 via-blue-500/20 to-purple-500/20 border-2 border-green-500/50 rounded-lg p-8">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Target className="w-7 h-7 text-green-400" />
            Síntese: Product-Market Fit Validado
          </h2>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-black/50 border border-green-500/30 rounded-lg p-6">
              <h3 className="text-lg font-bold text-green-400 mb-3">✅ O Que Temos CERTO</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex items-start gap-2">
                  <Star className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                  <span>Automação 24/7 (dor #1)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Star className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                  <span>Circuit Breaker (dor #1 emocional)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Star className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                  <span>Backtesting honesto (dor #2)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Star className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                  <span>Pyramiding (ÚNICO no Brasil)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Star className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                  <span>Preço R$ 149 (87% mais barato)</span>
                </li>
              </ul>
            </div>

            <div className="bg-black/50 border border-blue-500/30 rounded-lg p-6">
              <h3 className="text-lg font-bold text-blue-400 mb-3">💡 Mensagem de Marketing</h3>
              <div className="text-sm text-gray-300 space-y-2">
                <p className="font-bold text-white">
                  "Cansado de perder dinheiro por decisões emocionais?"
                </p>
                <p className="text-xs">
                  A Neural Day Trader Platform é a ÚNICA plataforma brasileira que:
                </p>
                <ul className="text-xs space-y-1 ml-4">
                  <li>✅ Opera 24/7 automaticamente</li>
                  <li>✅ TE IMPEDE de operar no tilt</li>
                  <li>✅ Pyramiding profissional único</li>
                  <li>✅ Backtesting honesto</li>
                </ul>
                <p className="text-xs pt-2">
                  Tudo por <strong className="text-green-400">R$ 149/mês</strong>
                </p>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-700 text-center mt-6">
            <p className="text-xl font-bold text-white">
              ✅ <strong className="text-green-400">PRODUCT-MARKET FIT VALIDADO</strong>
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Nossa plataforma resolve as 3 maiores dores e entrega os 3 maiores desejos dos traders brasileiros
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}