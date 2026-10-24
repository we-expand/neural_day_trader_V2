/**
 * Estágio 2 da ponte decisão→execução (Fase 6). Ver research/AI_BRAIN_SPEC.md
 * seção 9.1.
 *
 * TradeVisual.amount (motor de decisão) é capital em $ alocado à posição.
 * OrderParams.volume (BrokerClient/MT5) é lote. Esta função pura faz a
 * conversão — nenhuma outra parte do repo tinha isso pronto.
 */
import { getAssetBySymbol } from '../../config/assetDatabase.ts';
import { calculateRequiredMargin } from '../../services/strategy/TradeSizing.ts';

export interface LotSizeConversionResult {
  /** Lotes prontos para OrderParams.volume, já arredondados/clampados. */
  volume: number;
  /** true se o volume foi ajustado (clampado ao máximo) em relação ao bruto. */
  capped: boolean;
  /** Presente quando a conversão não pôde produzir um volume executável. */
  error?: string;
}

/**
 * Arredonda um número de lotes bruto pro step/mínimo/máximo do ativo.
 * Ponto único de verdade — usado tanto por `amountToLotSize` (conversão
 * $→lote) quanto por qualquer código que já chega com um número de lotes em
 * mãos (ex: `openManualPosition` em useApexLogic.ts, que é o choke point de
 * toda ordem — manual, Pyramiding, Estágio 3/4) e precisa só validar/arredondar.
 *
 * Sem campo de "step" dedicado no Asset — assume-se minLot como step, padrão
 * comum quando o dado não distingue os dois. Arredonda pra BAIXO: nunca
 * aumenta o risco além do que foi pedido.
 */
export function floorToLotStep(symbol: string, rawLots: number): LotSizeConversionResult {
  const asset = getAssetBySymbol(symbol);
  if (!asset) {
    return { volume: 0, capped: false, error: `Ativo desconhecido: ${symbol}` };
  }
  if (!(rawLots > 0)) {
    return { volume: 0, capped: false, error: 'Volume inválido' };
  }

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

/**
 * Margem mínima (em USD) pra abrir 1 lote mínimo do ativo, ao preço atual.
 * `asset.minLot * asset.lotSize * price` dá o NOCIONAL da posição (valor de
 * mercado do que está sendo negociado), não o capital que o usuário precisa
 * ter — quem cobre a diferença é a alavancagem do ativo, exatamente como em
 * qualquer corretora de varejo (fórmula margem = nocional / leverage, já
 * usada pelo motor real em `calculateRequiredMargin`/`clampToMarginAffordability`,
 * TradeSizing.ts, 2026-08-19). Antes desta correção (2026-08-20), esta
 * função retornava o nocional puro e ele era comparado direto contra
 * `allocatedCapital` (dinheiro em caixa) — pra EURUSD isso mostrava "precisa
 * de ~$1.116" quando a margem real, com leverage 500x do catálogo, é ~$2,23.
 * Retorna `null` só se o ativo não existir no catálogo ou o preço não for
 * válido (nunca fabrica um número sem dado real).
 */
export function getMinLotNotionalUsd(symbol: string, price: number): number | null {
  const asset = getAssetBySymbol(symbol);
  if (!asset || !(price > 0)) return null;
  const notionalUsd = asset.minLot * asset.lotSize * price;
  return calculateRequiredMargin(notionalUsd, asset.leverage);
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

  return floorToLotStep(symbol, rawLots);
}
