/**
 * 🤖 LIQUIDITY PREDICTION VIEW (IA PREDITIVA)
 * 
 * Componente wrapper para a IA Preditiva completa
 * Importa e renderiza o LiquidityPrediction.tsx correto do backup
 * 
 * Este módulo serve como ponto de entrada organizado
 * para o sistema de predição de liquidez e order flow.
 */

import React from 'react';
import { LiquidityPrediction } from '@/app/components/innovation/LiquidityPrediction';

/**
 * Logs prefixados para debug
 */
const log = {
  info: (...args: any[]) => console.log('[LIQUIDITY_PREDICTION] 🤖', ...args),
  error: (...args: any[]) => console.error('[LIQUIDITY_PREDICTION] ❌', ...args),
  success: (...args: any[]) => console.log('[LIQUIDITY_PREDICTION] ✅', ...args),
  debug: (...args: any[]) => console.log('[LIQUIDITY_PREDICTION] 🔍', ...args)
};

/**
 * LiquidityPredictionView Component
 * 
 * Wrapper principal para a IA Preditiva & Order Flow
 * 
 * @example
 * ```tsx
 * // Uso básico
 * <LiquidityPredictionView />
 * ```
 */
export function LiquidityPredictionView() {
  React.useEffect(() => {
    log.info('IA Preditiva & Order Flow carregada');
    log.debug('Detector de Liquidez Institucional ativo');
    log.debug('300+ ativos disponíveis para análise');
  }, []);

  return (
    <div className="liquidity-prediction-module">
      <LiquidityPrediction />
    </div>
  );
}
