/**
 * 🚨 LIVE MODE CONFIRMATION MODAL
 * 
 * Modal de confirmação obrigatório para ativar negociação com dinheiro real
 * Inclui checklist de segurança e termo de responsabilidade
 * 
 * @version 1.0.0
 * @author Neural Day Trader Platform
 */

import React, { useState } from 'react';
import { 
  AlertTriangle, 
  DollarSign, 
  Shield, 
  CheckCircle2, 
  X,
  Lock,
  TrendingDown,
  Info
} from 'lucide-react';
import { toast } from 'sonner';

interface LiveModeConfirmationProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentBalance: number;
  currentEquity: number;
  mt5Connected: boolean;
  riskSettings: {
    dailyLossLimit: number;
    maxContracts: number;
    stopLossMode: string;
  };
}

export function LiveModeConfirmation({
  isOpen,
  onClose,
  onConfirm,
  currentBalance,
  currentEquity,
  mt5Connected,
  riskSettings
}: LiveModeConfirmationProps) {
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [confirmedBalance, setConfirmedBalance] = useState(false);
  const [confirmedRisk, setConfirmedRisk] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');

  const canActivate = 
    acceptedTerms && 
    confirmedBalance && 
    confirmedRisk && 
    confirmationText === 'ATIVAR MODO REAL' &&
    mt5Connected;

  const handleActivate = () => {
    if (!canActivate) {
      toast.error('Complete todos os requisitos de segurança');
      return;
    }

    toast.success('🔴 MODO REAL ATIVADO', {
      description: 'Todas as ordens serão executadas com dinheiro real',
      duration: 5000
    });

    onConfirm();
    // Reset state
    setAcceptedTerms(false);
    setConfirmedBalance(false);
    setConfirmedRisk(false);
    setConfirmationText('');
  };

  const handleClose = () => {
    // Reset state on close
    setAcceptedTerms(false);
    setConfirmedBalance(false);
    setConfirmedRisk(false);
    setConfirmationText('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-red-950/90 to-black border-2 border-red-500/50 rounded-2xl shadow-2xl shadow-red-500/20"
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-red-600 to-red-800 p-6 border-b border-red-500/30">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-red-500 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/50">
                <AlertTriangle className="w-8 h-8 text-white animate-pulse" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">
                  ⚠️ ATIVAÇÃO DE MODO REAL
                </h2>
                <p className="text-red-200 text-sm mt-1">
                  Você está prestes a operar com DINHEIRO REAL
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-red-200 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* MT5 Connection Status */}
          <div className={`p-4 rounded-xl border-2 ${
            mt5Connected 
              ? 'bg-green-950/30 border-green-500/50' 
              : 'bg-red-950/30 border-red-500/50'
          }`}>
            <div className="flex items-center gap-3">
              {mt5Connected ? (
                <CheckCircle2 className="w-6 h-6 text-green-400" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-red-400" />
              )}
              <div className="flex-1">
                <h3 className="font-bold text-white">Conexão MT5</h3>
                <p className={`text-sm ${mt5Connected ? 'text-green-400' : 'text-red-400'}`}>
                  {mt5Connected 
                    ? '✅ Conectado - Pronto para operar' 
                    : '❌ Desconectado - Conecte o MT5 primeiro'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Account Balance */}
          <div className="p-4 rounded-xl bg-gray-900/50 border border-gray-700">
            <div className="flex items-center gap-3 mb-3">
              <DollarSign className="w-6 h-6 text-blue-400" />
              <h3 className="font-bold text-white">Saldo da Conta MT5</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400 uppercase">Balance</p>
                <p className="text-2xl font-bold text-white">
                  ${currentBalance.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase">Equity</p>
                <p className="text-2xl font-bold text-white">
                  ${currentEquity.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Risk Settings */}
          <div className="p-4 rounded-xl bg-gray-900/50 border border-gray-700">
            <div className="flex items-center gap-3 mb-3">
              <Shield className="w-6 h-6 text-yellow-400" />
              <h3 className="font-bold text-white">Proteções de Risco Ativas</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Limite de Perda Diária:</span>
                <span className="text-white font-bold">{riskSettings.dailyLossLimit}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Contratos Máximos:</span>
                <span className="text-white font-bold">{riskSettings.maxContracts}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Modo Stop Loss:</span>
                <span className="text-white font-bold">{riskSettings.stopLossMode}</span>
              </div>
            </div>
          </div>

          {/* Safety Checklist */}
          <div className="space-y-3">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-yellow-400" />
              Checklist de Segurança Obrigatório
            </h3>

            <label className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 w-5 h-5 accent-red-500"
              />
              <span className="text-sm text-gray-300">
                <strong className="text-white">Eu confirmo</strong> que entendo que estou operando com DINHEIRO REAL 
                e que posso ter PERDAS REAIS. A plataforma Neural Day Trader não se responsabiliza por perdas financeiras.
              </span>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={confirmedBalance}
                onChange={(e) => setConfirmedBalance(e.target.checked)}
                className="mt-1 w-5 h-5 accent-red-500"
              />
              <span className="text-sm text-gray-300">
                <strong className="text-white">Eu confirmo</strong> que verifiquei meu saldo MT5 
                (${currentBalance.toFixed(2)}) e estou ciente que esse é o capital que será utilizado.
              </span>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={confirmedRisk}
                onChange={(e) => setConfirmedRisk(e.target.checked)}
                className="mt-1 w-5 h-5 accent-red-500"
              />
              <span className="text-sm text-gray-300">
                <strong className="text-white">Eu confirmo</strong> que configurei minhas proteções de risco 
                (Stop Loss, Daily Loss Limit) de acordo com minha tolerância a perdas.
              </span>
            </label>
          </div>

          {/* Confirmation Input */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-white">
              Digite "ATIVAR MODO REAL" para confirmar:
            </label>
            <input
              type="text"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value.toUpperCase())}
              placeholder="Digite aqui..."
              className="w-full px-4 py-3 bg-gray-900 border-2 border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500 transition-colors"
            />
          </div>

          {/* Warning Box */}
          <div className="p-4 rounded-xl bg-yellow-500/10 border-2 border-yellow-500/50">
            <div className="flex items-start gap-3">
              <Info className="w-6 h-6 text-yellow-400 shrink-0 mt-0.5" />
              <div className="space-y-2 text-sm text-yellow-200">
                <p className="font-bold text-yellow-300">⚠️ AVISOS IMPORTANTES:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Trading de CFDs/Forex envolve alto risco de perda de capital</li>
                  <li>Nunca opere com dinheiro que você não pode perder</li>
                  <li>Resultados passados não garantem resultados futuros</li>
                  <li>A IA é uma ferramenta de auxílio, não garante lucros</li>
                  <li>Sempre monitore suas posições abertas</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gradient-to-r from-black to-gray-900 p-6 border-t border-gray-800 flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleActivate}
            disabled={!canActivate}
            className={`flex-1 px-6 py-3 font-bold rounded-lg transition-all ${
              canActivate
                ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg shadow-red-500/50'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            {canActivate ? '🔴 ATIVAR MODO REAL' : '🔒 Complete todos os requisitos'}
          </button>
        </div>
      </div>
    </div>
  );
}