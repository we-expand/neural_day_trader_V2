/**
 * Estágio 2 da ponte decisão→execução (Fase 6). Ver research/AI_BRAIN_SPEC.md
 * seção 9.1.
 *
 * TradeVisual.amount (motor de decisão) é capital em $ alocado à posição.
 * OrderParams.volume (BrokerClient/MT5) é lote. Esta função pura faz a
 * conversão — nenhuma outra parte do repo tinha isso pronto.
 */
import { getAssetBySymbol } from '../../config/assetDatabase';

export interface LotSizeConversionResult {
  /** Lotes prontos para OrderParams.volume, já arredondados/clampados. */
  volume: number;
  /** true se o volume foi ajustado (clampado ao máximo) em relação ao bruto. */
  capped: boolean;
  /** Presente quando a conversão não pôde produzir um volume executável. */
  error?: string;
}

export function amountToLotSize(symbol: string, amountUsd: number, price: number): LotSizeConversionResult {
  const asset = getAssetBySymbol(symbol);
  if (!asset) {
    return { volume: 0, capped: false, error: `Ativo desconhecido: ${symbol}` };
  }
  if (!(amountUsd > 0) || !(price > 0)) {
    return { volume: 0, capped: false, error: 'Valor ou preço inválido para conversão de lote' };
  }

  // Valor nocional em unidades do ativo, depois convertido para lotes.
  // `amount` já é o capital alocado à posição (não a margem) — leverage não
  // entra NESTA conversão porque já foi usado rio acima, em
  // clampToMarginAffordability() (runTradingCycle.ts, 2026-08-19), pra
  // limitar `amount` à margem que a conta suporta antes de chegar aqui.
  const units = amountUsd / price;
  const rawLots = units / asset.lotSize;

  // Sem campo de "step" dedicado no Asset — assume-se minLot como step,
  // padrão comum quando o dado não distingue os dois. Arredonda pra BAIXO:
  // nunca aumenta o risco além do que o motor decidiu.
  const step = asset.minLot;
  const flooredLots = Math.floor(rawLots / step) * step;
  const rounded = Number(flooredLots.toFixed(8));

  if (rounded < asset.minLot) {
    return {
      volume: 0,
      capped: false,
      error: `Valor abaixo do lote mínimo de ${symbol} (mín. ${asset.minLot})`,
    };
  }

  if (rounded > asset.maxLot) {
    return { volume: asset.maxLot, capped: true };
  }

  return { volume: rounded, capped: false };
}
