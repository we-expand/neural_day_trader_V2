/**
 * 💰 VIRTUAL ACCOUNT
 * Exibe saldo, equity, margem e estatísticas da conta virtual
 */

import React from 'react';
import { useSimulator } from '@/app/contexts/SimulatorContext';
import { TrendingUp, TrendingDown, DollarSign, Activity, BarChart3 } from 'lucide-react';

export function VirtualAccount() {
  const { account, stats, getTotalOpenPNL } = useSimulator();
  
  const openPNL = getTotalOpenPNL();
  const totalPNL = account.current - account.initial;
  const totalPNLPercentage = ((totalPNL / account.initial) * 100);
  
  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700/50 p-6 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Conta Virtual</h3>
            <p className="text-xs text-slate-400">Simulação de Trading</p>
          </div>
        </div>
        
        {/* P&L Total Badge */}
        <div className={`px-4 py-2 rounded-lg ${
          totalPNL >= 0 
            ? 'bg-green-500/20 border border-green-500/30' 
            : 'bg-red-500/20 border border-red-500/30'
        }`}>
          <div className="flex items-center gap-2">
            {totalPNL >= 0 ? (
              <TrendingUp className="w-4 h-4 text-green-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-400" />
            )}
            <span className={`font-bold ${totalPNL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalPNL >= 0 ? '+' : ''}${totalPNL.toFixed(2)}
            </span>
            <span className={`text-xs ${totalPNL >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
              ({totalPNLPercentage >= 0 ? '+' : ''}{totalPNLPercentage.toFixed(2)}%)
            </span>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Saldo */}
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/30">
          <div className="text-xs text-slate-400 mb-1">Saldo</div>
          <div className="text-2xl font-bold text-white">
            ${account.current.toFixed(2)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Inicial: ${account.initial.toFixed(2)}
          </div>
        </div>

        {/* Equity */}
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/30">
          <div className="text-xs text-slate-400 mb-1">Equity</div>
          <div className="text-2xl font-bold text-blue-400">
            ${account.equity.toFixed(2)}
          </div>
          <div className={`text-xs mt-1 ${openPNL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            Open P&L: {openPNL >= 0 ? '+' : ''}${openPNL.toFixed(2)}
          </div>
        </div>

        {/* Margem */}
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/30">
          <div className="text-xs text-slate-400 mb-1">Margem Usada</div>
          <div className="text-2xl font-bold text-orange-400">
            ${account.margin.toFixed(2)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {((account.margin / account.equity) * 100).toFixed(1)}% usado
          </div>
        </div>

        {/* Margem Livre */}
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/30">
          <div className="text-xs text-slate-400 mb-1">Margem Livre</div>
          <div className="text-2xl font-bold text-green-400">
            ${account.freeMargin.toFixed(2)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Disponível
          </div>
        </div>
      </div>

      {/* Trading Stats */}
      <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/20">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-blue-400" />
          <h4 className="font-bold text-white text-sm">Estatísticas de Trading</h4>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Trades */}
          <div>
            <div className="text-xs text-slate-400">Total Trades</div>
            <div className="text-lg font-bold text-white">{stats.totalTrades}</div>
          </div>

          {/* Win Rate */}
          <div>
            <div className="text-xs text-slate-400">Win Rate</div>
            <div className={`text-lg font-bold ${
              stats.winRate >= 50 ? 'text-green-400' : 'text-red-400'
            }`}>
              {stats.winRate.toFixed(1)}%
            </div>
            <div className="text-xs text-slate-500">
              {stats.winningTrades}W / {stats.losingTrades}L
            </div>
          </div>

          {/* Avg P&L */}
          <div>
            <div className="text-xs text-slate-400">Média P&L</div>
            <div className={`text-lg font-bold ${
              stats.avgPNL >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {stats.avgPNL >= 0 ? '+' : ''}${stats.avgPNL.toFixed(2)}
            </div>
          </div>

          {/* Drawdown */}
          <div>
            <div className="text-xs text-slate-400">Drawdown</div>
            <div className="text-lg font-bold text-orange-400">
              {stats.currentDrawdown.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Best/Worst Trade */}
        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-700/30">
          <div>
            <div className="text-xs text-slate-400">Maior Ganho</div>
            <div className="text-sm font-bold text-green-400">
              +${stats.biggestWin.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Maior Perda</div>
            <div className="text-sm font-bold text-red-400">
              ${stats.biggestLoss.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Equity Progress Bar */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-slate-400 mb-2">
          <span>Progresso da Equity</span>
          <span>{((account.equity / account.peakEquity) * 100).toFixed(1)}%</span>
        </div>
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ${
              account.equity >= account.initial 
                ? 'bg-gradient-to-r from-green-500 to-green-400' 
                : 'bg-gradient-to-r from-red-500 to-red-400'
            }`}
            style={{ width: `${Math.min((account.equity / account.peakEquity) * 100, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
