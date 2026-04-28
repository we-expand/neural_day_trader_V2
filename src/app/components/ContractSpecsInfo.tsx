import React from 'react';
import { getContractInfo, getContractSpec } from '@/config/contractSpecs';

interface ContractSpecsInfoProps {
  symbol: string;
  className?: string;
}

/**
 * 💰 Componente de Informações de Especificações de Contrato
 * Exibe detalhes técnicos sobre o ativo sendo negociado
 */
export function ContractSpecsInfo({ symbol, className = '' }: ContractSpecsInfoProps) {
  const info = getContractInfo(symbol);
  const spec = getContractSpec(symbol);

  return (
    <div className={`bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-neutral-200">
          📊 Especificações do Contrato
        </h3>
        <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
          {info.categoryFormatted}
        </span>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-neutral-400">Símbolo:</span>
          <span className="text-neutral-200 font-mono">{spec.symbol}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-neutral-400">Descrição:</span>
          <span className="text-neutral-200">{spec.description}</span>
        </div>

        <div className="h-px bg-neutral-800 my-2" />

        <div className="flex justify-between">
          <span className="text-neutral-400">Tamanho do Tick:</span>
          <span className="text-neutral-200 font-mono">{spec.tickSize.toFixed(5)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-neutral-400">Valor do Tick:</span>
          <span className="text-green-400 font-mono">{spec.currency} {spec.tickValue.toFixed(2)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-neutral-400">Valor do Ponto:</span>
          <span className="text-green-400 font-mono font-semibold">
            {spec.currency} {spec.pointValue.toFixed(2)}
          </span>
        </div>

        <div className="h-px bg-neutral-800 my-2" />

        <div className="flex justify-between">
          <span className="text-neutral-400">Tamanho do Contrato:</span>
          <span className="text-neutral-200">{info.contractSizeFormatted}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-neutral-400">Lote Mínimo:</span>
          <span className="text-neutral-200 font-mono">{spec.minLotSize}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-neutral-400">Moeda:</span>
          <span className="text-neutral-200 font-mono">{spec.currency}</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-neutral-800">
        <p className="text-xs text-neutral-500">
          💡 <strong>Exemplo:</strong> 1 ponto de movimento = {info.pipValueFormatted} de lucro/prejuízo
          para 1 lote padrão.
        </p>
      </div>
    </div>
  );
}

/**
 * 📊 Versão Compacta - Badge com Tooltip
 */
interface ContractSpecsBadgeProps {
  symbol: string;
  showTooltip?: boolean;
}

export function ContractSpecsBadge({ symbol, showTooltip = true }: ContractSpecsBadgeProps) {
  const spec = getContractSpec(symbol);
  const [isHovered, setIsHovered] = React.useState(false);

  const categoryColors = {
    'FOREX': 'bg-blue-500/20 text-blue-400',
    'CRYPTO': 'bg-purple-500/20 text-purple-400',
    'INDICES': 'bg-green-500/20 text-green-400',
    'COMMODITIES': 'bg-yellow-500/20 text-yellow-400',
    'METALS': 'bg-orange-500/20 text-orange-400',
    'ENERGY': 'bg-red-500/20 text-red-400',
    'STOCKS_BR': 'bg-cyan-500/20 text-cyan-400',
    'STOCKS_US': 'bg-indigo-500/20 text-indigo-400',
  };

  const categoryEmojis = {
    'FOREX': '💱',
    'CRYPTO': '₿',
    'INDICES': '📈',
    'COMMODITIES': '🌾',
    'METALS': '🥇',
    'ENERGY': '🛢️',
    'STOCKS_BR': '🇧🇷',
    'STOCKS_US': '🇺🇸',
  };

  return (
    <div className="relative inline-block">
      <div
        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${categoryColors[spec.category]}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <span>{categoryEmojis[spec.category]}</span>
        <span className="font-mono">{spec.pointValue.toFixed(0)}{spec.currency}/pt</span>
      </div>

      {showTooltip && isHovered && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50">
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-3 shadow-xl min-w-[200px]">
            <div className="text-xs space-y-1">
              <div className="font-semibold text-neutral-200 mb-2">{spec.symbol}</div>
              <div className="text-neutral-400">{spec.description}</div>
              <div className="h-px bg-neutral-700 my-2" />
              <div className="flex justify-between">
                <span className="text-neutral-500">Valor/Ponto:</span>
                <span className="text-green-400 font-mono">{spec.currency} {spec.pointValue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Tick Size:</span>
                <span className="text-neutral-300 font-mono">{spec.tickSize.toFixed(5)}</span>
              </div>
            </div>
            {/* Seta apontando para baixo */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
              <div className="border-4 border-transparent border-t-neutral-700" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 📊 Calculadora de P&L Visual
 */
interface PnLCalculatorProps {
  symbol: string;
  entryPrice: number;
  currentPrice: number;
  side: 'LONG' | 'SHORT';
  lotSize: number;
  leverage: number;
}

export function PnLCalculator({ symbol, entryPrice, currentPrice, side, lotSize, leverage }: PnLCalculatorProps) {
  const spec = getContractSpec(symbol);
  
  // Calcular componentes do P&L
  const priceDiff = currentPrice - entryPrice;
  const pointsMoved = Math.abs(priceDiff / spec.tickSize);
  const directionMultiplier = side === 'LONG' ? 1 : -1;
  const effectiveSize = (lotSize * leverage) / entryPrice;
  const grossPnL = (priceDiff / spec.tickSize) * spec.tickValue * effectiveSize * directionMultiplier;
  
  const isProfit = grossPnL > 0;

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-neutral-200 mb-3">
        🧮 Cálculo de P&L Detalhado
      </h3>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-neutral-400">Preço de Entrada:</span>
          <span className="text-neutral-200 font-mono">{spec.currency} {entryPrice.toFixed(spec.category === 'FOREX' ? 5 : 2)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-neutral-400">Preço Atual:</span>
          <span className="text-neutral-200 font-mono">{spec.currency} {currentPrice.toFixed(spec.category === 'FOREX' ? 5 : 2)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-neutral-400">Movimento:</span>
          <span className={`font-mono ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
            {priceDiff > 0 ? '+' : ''}{priceDiff.toFixed(spec.category === 'FOREX' ? 5 : 2)}
          </span>
        </div>

        <div className="h-px bg-neutral-800 my-2" />

        <div className="flex justify-between">
          <span className="text-neutral-400">Pontos Movidos:</span>
          <span className="text-neutral-200 font-mono">{pointsMoved.toFixed(0)} ticks</span>
        </div>

        <div className="flex justify-between">
          <span className="text-neutral-400">Valor por Tick:</span>
          <span className="text-neutral-200 font-mono">{spec.currency} {spec.tickValue.toFixed(2)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-neutral-400">Tamanho Efetivo:</span>
          <span className="text-neutral-200 font-mono">{effectiveSize.toFixed(3)} lotes</span>
        </div>

        <div className="flex justify-between">
          <span className="text-neutral-400">Alavancagem:</span>
          <span className="text-blue-400 font-mono">{leverage}x</span>
        </div>

        <div className="h-px bg-neutral-800 my-2" />

        <div className="flex justify-between items-center pt-2">
          <span className="text-neutral-400 font-semibold">P&L Bruto:</span>
          <span className={`font-mono font-bold text-lg ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
            {isProfit ? '+' : ''}{spec.currency} {grossPnL.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-neutral-800">
        <p className="text-xs text-neutral-500">
          💡 Fórmula: (Pontos × Valor do Tick × Tamanho) × Direção × Leverage
        </p>
      </div>
    </div>
  );
}
