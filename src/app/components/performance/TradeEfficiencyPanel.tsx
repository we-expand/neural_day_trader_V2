/**
 * Painel de eficiência de saída — liga `diagnoseClosedTrades`
 * (`src/app/services/analysis/TradeEfficiencyDiagnostic.ts`, Componente 5 do
 * cérebro de execução) à tela de Performance (CLAUDE.md pendência #5, "ainda
 * não ligado a nenhuma tela/UI").
 *
 * Análise RETROSPECTIVA pura: reconstrói MFE/MAE real de cada trade fechado
 * do usuário buscando candle real (backtestDataService) e mede quanto do
 * movimento favorável disponível foi capturado no resultado realizado. Não
 * prevê nada sobre o próximo trade — nunca deve ser lido como sinal de
 * entrada/saída futuro.
 */
import React from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import type { TradeVisual } from '../../hooks/useApexLogic';
import {
  diagnoseClosedTrades,
  type TradeEfficiencyReport,
  type ClosedTradeInput,
} from '../../services/analysis/TradeEfficiencyDiagnostic';

interface TradeEfficiencyPanelProps {
  tradeHistory: TradeVisual[];
}

/** Mínimo de trades fechados pra vale a pena mostrar o painel — abaixo disso é estado vazio honesto, não dado fabricado. */
const MIN_CLOSED_TRADES = 1;

function toClosedTradeInputs(trades: TradeVisual[]): ClosedTradeInput[] {
  return trades
    .filter(t => t.closedAt && t.closedAt > t.timestamp && t.price > 0)
    .map(t => ({
      id: t.id,
      symbol: t.symbol,
      side: t.side,
      entryPrice: t.price,
      entryTime: t.timestamp,
      exitTime: t.closedAt as number,
      // currentProfit vem do motor como $ absoluto, não % — convertido aqui
      // pro % de entrada esperado por diagnoseClosedTrade (mesma base do MFE/MAE).
      realizedPercent: t.amount > 0 ? ((t.currentProfit || 0) / t.amount) * 100 : 0,
    }));
}

export function TradeEfficiencyPanel({ tradeHistory }: TradeEfficiencyPanelProps) {
  const [report, setReport] = React.useState<TradeEfficiencyReport | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const closedInputs = React.useMemo(() => toClosedTradeInputs(tradeHistory || []), [tradeHistory]);

  const runDiagnostic = React.useCallback(async () => {
    if (closedInputs.length < MIN_CLOSED_TRADES) return;
    setLoading(true);
    setError(null);
    try {
      const result = await diagnoseClosedTrades(closedInputs);
      setReport(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [closedInputs]);

  if (closedInputs.length < MIN_CLOSED_TRADES) {
    return (
      <div className="bg-neutral-950 border border-white/5 rounded-xl p-6">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">
          Eficiência de Saída (análise retrospectiva)
        </h2>
        <p className="text-xs text-slate-600">
          Sem trades fechados suficientes ainda para calcular eficiência de saída real.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-neutral-950 border border-white/5 rounded-xl p-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
          Eficiência de Saída
        </h2>
        <button
          onClick={runDiagnostic}
          disabled={loading}
          className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-purple-400 hover:text-purple-300 disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Calculando…' : 'Calcular com candle real'}
        </button>
      </div>
      <p className="text-[11px] text-slate-600 mb-4">
        Análise RETROSPECTIVA dos seus trades já fechados, com candle real (MFE/MAE) — não é previsão nem promessa de retorno futuro.
      </p>

      {error && (
        <p className="text-xs text-red-400 mb-4">Erro ao buscar candle real: {error}</p>
      )}

      {!report && !loading && !error && (
        <p className="text-xs text-slate-600">Clique em "Calcular com candle real" para rodar o diagnóstico.</p>
      )}

      {report && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Amostra</p>
              <p className="text-lg font-bold text-white font-mono">{report.sampleSize}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Com MFE &gt; 0</p>
              <p className="text-lg font-bold text-white font-mono">{report.sampleSizeWithMovement}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Eficiência média</p>
              <p className="text-lg font-bold text-white font-mono">
                {report.averageExitEfficiency !== null ? `${(report.averageExitEfficiency * 100).toFixed(1)}%` : '—'}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Devolvido médio</p>
              <p className="text-lg font-bold text-white font-mono">
                {report.averageGaveBackPercent !== null ? `${report.averageGaveBackPercent.toFixed(1)}%` : '—'}
              </p>
            </div>
          </div>

          {report.failedTrades.length > 0 && (
            <p className="text-[10px] text-yellow-500/80 mb-4">
              {report.failedTrades.length} trade(s) sem candle real disponível para reconstruir a excursão — excluído(s) do cálculo, não estimado.
            </p>
          )}

          {report.perTrade.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Activity className="w-6 h-6 text-slate-700 mb-2" />
              <p className="text-xs text-slate-600">Nenhum trade pôde ser reconstruído com candle real.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left py-2 px-3 text-[10px] text-slate-500 font-bold uppercase tracking-widest">Ativo</th>
                    <th className="text-right py-2 px-3 text-[10px] text-slate-500 font-bold uppercase tracking-widest">MFE</th>
                    <th className="text-right py-2 px-3 text-[10px] text-slate-500 font-bold uppercase tracking-widest">MAE</th>
                    <th className="text-right py-2 px-3 text-[10px] text-slate-500 font-bold uppercase tracking-widest">Realizado</th>
                    <th className="text-right py-2 px-3 text-[10px] text-slate-500 font-bold uppercase tracking-widest">Eficiência</th>
                    <th className="text-right py-2 px-3 text-[10px] text-slate-500 font-bold uppercase tracking-widest">Devolvido</th>
                  </tr>
                </thead>
                <tbody>
                  {report.perTrade.map(t => (
                    <tr key={t.tradeId} className="border-b border-white/5">
                      <td className="py-2 px-3 text-xs font-bold text-white">{t.symbol}</td>
                      <td className="py-2 px-3 text-xs font-mono text-right text-slate-300">{t.mfePercent.toFixed(2)}%</td>
                      <td className="py-2 px-3 text-xs font-mono text-right text-slate-300">{t.maePercent.toFixed(2)}%</td>
                      <td className={`py-2 px-3 text-xs font-mono text-right ${t.realizedPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {t.realizedPercent.toFixed(2)}%
                      </td>
                      <td className="py-2 px-3 text-xs font-mono text-right text-slate-300">
                        {t.exitEfficiency !== null ? `${(t.exitEfficiency * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td className="py-2 px-3 text-xs font-mono text-right text-slate-300">
                        {t.gaveBackPercent !== null ? `${t.gaveBackPercent.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
