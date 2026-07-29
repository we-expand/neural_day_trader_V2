/**
 * 🎯 ADVANCED TRADE ANALYSIS
 * Análise técnica real (RSI/MACD/ATR/Bollinger calculados sobre candle real)
 * com narração em voz. Nunca fabrica indicador, fluxo de ordem, sentimento
 * ou padrão de candle — campos sem fonte real comprovada foram removidos
 * (ver auditoria de 2026-07-29): não existe fluxo institucional, sentimento
 * por posição, correlação com S&P500 ou detecção de padrão/manipulação
 * calculados de verdade neste projeto, então esses campos não aparecem
 * mais aqui em vez de serem sorteados.
 */

import { calculateRSI, calculateMACD, calculateATR, calculateBollingerBands, type Candle } from '@/app/services/indicators/TechnicalIndicators';

export interface TradePosition {
  type: 'buy' | 'sell';
  entryPrice: number;
  currentPrice: number;
  symbol: string;
  timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
}

export interface AdvancedAnalysis {
  rsi: number | null;
  macd: {
    value: number;
    signal: number;
    histogram: number;
  } | null;
  bollinger: {
    upper: number;
    middle: number;
    lower: number;
    position: 'above' | 'inside' | 'below';
  } | null;
  priceAction: {
    supportLevel: number;
    resistanceLevel: number;
    trend: 'uptrend' | 'downtrend' | 'sideways';
    keyLevel: number;
  };
  volatility: {
    value: number;
    level: 'low' | 'normal' | 'high' | 'extreme';
  };
  risk: {
    stopLoss: number;
    stopLossPercent: number;
    takeProfitTargets: number[];
    riskRewardRatio: number;
  };
  suggestions: {
    action: 'hold' | 'reduce' | 'close';
    reasoning: string;
  };
}

function roundToLevel(price: number): number {
  if (price > 50000) return Math.round(price / 100) * 100;
  if (price > 10000) return Math.round(price / 50) * 50;
  if (price > 1000) return Math.round(price / 20) * 20;
  return Math.round(price / 10) * 10;
}

/**
 * Gera análise a partir de candles reais (fechamento mais recente primeiro).
 * Lança se não houver candle suficiente — nunca fabrica indicador.
 */
export function generateAdvancedAnalysis(position: TradePosition, candles: Candle[]): AdvancedAnalysis {
  const { entryPrice, currentPrice, type } = position;

  if (candles.length < 30) {
    throw new Error('Candles insuficientes para calcular indicadores reais (mínimo 30).');
  }

  const rsiSeries = calculateRSI(candles, 14);
  const macdSeries = calculateMACD(candles);
  const atrSeries = calculateATR(candles, 14);
  const bbSeries = calculateBollingerBands(candles);

  const rsi = rsiSeries[rsiSeries.length - 1];
  const macdLast = macdSeries.macd[macdSeries.macd.length - 1];
  const signalLast = macdSeries.signal[macdSeries.signal.length - 1];
  const histLast = macdSeries.histogram[macdSeries.histogram.length - 1];
  const atr = atrSeries[atrSeries.length - 1];
  const bbUpper = bbSeries.upper[bbSeries.upper.length - 1];
  const bbMiddle = bbSeries.middle[bbSeries.middle.length - 1];
  const bbLower = bbSeries.lower[bbSeries.lower.length - 1];

  if (atr === null) {
    throw new Error('ATR não pôde ser calculado — candle insuficiente.');
  }

  const macd = macdLast !== null && signalLast !== null && histLast !== null
    ? { value: macdLast, signal: signalLast, histogram: histLast }
    : null;

  const bollinger = bbUpper !== null && bbMiddle !== null && bbLower !== null
    ? {
        upper: bbUpper,
        middle: bbMiddle,
        lower: bbLower,
        position: (currentPrice > bbUpper ? 'above' : currentPrice < bbLower ? 'below' : 'inside') as 'above' | 'inside' | 'below'
      }
    : null;

  // Volatilidade real: ATR como % do preço atual.
  const volatilityValue = (atr / currentPrice) * 100;
  let volatilityLevel: 'low' | 'normal' | 'high' | 'extreme' = 'normal';
  if (volatilityValue < 0.3) volatilityLevel = 'low';
  if (volatilityValue > 1.0) volatilityLevel = 'high';
  if (volatilityValue > 2.0) volatilityLevel = 'extreme';

  // Suporte/resistência: bandas de ATR ao redor do preço real (mesma lógica
  // de antes, só que sobre ATR real em vez de `currentPrice * 0.008` fixo).
  let supportLevel: number, resistanceLevel: number;
  if (type === 'sell') {
    resistanceLevel = roundToLevel(currentPrice + (atr * 2.5));
    supportLevel = roundToLevel(currentPrice - (atr * 4.0));
  } else {
    supportLevel = roundToLevel(currentPrice - (atr * 2.5));
    resistanceLevel = roundToLevel(currentPrice + (atr * 4.0));
  }

  let priceActionTrend: 'uptrend' | 'downtrend' | 'sideways' = 'sideways';
  if (currentPrice > entryPrice * 1.005) priceActionTrend = 'uptrend';
  if (currentPrice < entryPrice * 0.995) priceActionTrend = 'downtrend';

  const keyLevel = Math.abs(currentPrice - supportLevel) < Math.abs(currentPrice - resistanceLevel)
    ? supportLevel
    : resistanceLevel;

  // Stop e alvos: mesma estrutura de múltiplos de ATR de antes, agora sobre ATR real.
  let stopLoss: number;
  if (type === 'sell') {
    stopLoss = roundToLevel(entryPrice + (atr * 0.8));
  } else {
    stopLoss = roundToLevel(entryPrice - (atr * 0.8));
  }
  const stopLossPercent = Math.abs((stopLoss - entryPrice) / entryPrice) * 100;

  let tp1: number, tp2: number, tp3: number;
  if (type === 'sell') {
    tp1 = roundToLevel(currentPrice - (atr * 2.5));
    tp2 = roundToLevel(currentPrice - (atr * 4.5));
    tp3 = roundToLevel(currentPrice - (atr * 7.0));
  } else {
    tp1 = roundToLevel(currentPrice + (atr * 2.5));
    tp2 = roundToLevel(currentPrice + (atr * 4.5));
    tp3 = roundToLevel(currentPrice + (atr * 7.0));
  }
  const riskRewardRatio = Math.abs(tp1 - entryPrice) / Math.abs(stopLoss - entryPrice);

  // Sugestão: regra simples e declarada sobre RSI real + P&L real + volatilidade
  // real — nunca um "score de confiança" sem validação estatística por trás.
  const pnl = type === 'sell' ? entryPrice - currentPrice : currentPrice - entryPrice;
  const pnlPercent = (pnl / entryPrice) * 100;

  let action: 'hold' | 'reduce' | 'close' = 'hold';
  let reasoning = 'Sem sinal de alerta nos indicadores — mantém o plano original.';

  if (rsi !== null) {
    if (type === 'sell' && rsi < 30 && pnlPercent < 0) {
      action = 'close';
      reasoning = 'RSI em sobrevenda com a operação no prejuízo — risco de reversão contra a posição.';
    } else if (type === 'buy' && rsi > 70 && pnlPercent < 0) {
      action = 'close';
      reasoning = 'RSI em sobrecompra com a operação no prejuízo — risco de reversão contra a posição.';
    } else if (pnlPercent > 2 && volatilityLevel !== 'low') {
      action = 'reduce';
      reasoning = 'Lucro relevante já acumulado com volatilidade elevada — considere realizar parte.';
    }
  }

  return {
    rsi,
    macd,
    bollinger,
    priceAction: {
      supportLevel,
      resistanceLevel,
      trend: priceActionTrend,
      keyLevel
    },
    volatility: {
      value: volatilityValue,
      level: volatilityLevel
    },
    risk: {
      stopLoss,
      stopLossPercent,
      takeProfitTargets: [tp1, tp2, tp3],
      riskRewardRatio
    },
    suggestions: {
      action,
      reasoning
    }
  };
}

// ==================== VOICE NARRATION ====================

/**
 * Formata número para síntese de voz ler corretamente.
 * Exemplo: 67200 → "67 mil e 200"
 */
function formatPriceForSpeech(price: number): string {
  const rounded = Math.round(price);

  if (rounded >= 100000) {
    const hundreds = Math.floor(rounded / 1000);
    const remainder = rounded % 1000;
    return remainder === 0 ? `${hundreds} mil` : `${hundreds} mil e ${remainder}`;
  }
  if (rounded >= 10000) {
    const tens = Math.floor(rounded / 1000);
    const remainder = rounded % 1000;
    return remainder === 0 ? `${tens} mil` : `${tens} mil e ${remainder}`;
  }
  if (rounded >= 1000) {
    const thousands = Math.floor(rounded / 1000);
    const remainder = rounded % 1000;
    if (remainder === 0) return `${thousands} mil`;
    if (remainder < 100) return `${thousands} mil e ${remainder}`;
    return `${thousands} mil ${remainder}`;
  }
  return rounded.toString();
}

/**
 * Gera narração conversacional a partir só de indicadores reais. A variação de
 * estilo/saudação é só estética (aleatória de propósito, não representa dado
 * de mercado) — igual à variação de frases de marketing na landing page.
 */
export function generateVoiceNarration(position: TradePosition, analysis: AdvancedAnalysis): string[] {
  const messages: string[] = [];
  const { entryPrice, currentPrice, type, symbol } = position;

  const pnl = type === 'sell' ? entryPrice - currentPrice : currentPrice - entryPrice;
  const pnlPercent = (pnl / entryPrice) * 100;

  const narrativeStyle = Math.floor(Math.random() * 4);

  const timeframeNames: Record<string, string> = {
    '1m': 'um minuto',
    '5m': 'cinco minutos',
    '15m': 'quinze minutos',
    '1h': 'uma hora',
    '4h': 'quatro horas',
    '1d': 'diário'
  };
  const timeframeName = position.timeframe ? timeframeNames[position.timeframe] : 'quinze minutos';

  if (narrativeStyle === 0) {
    if (type === 'buy') {
      const starts = [
        `Comprado em ${symbol}. Entrada ${formatPriceForSpeech(entryPrice)}, agora ${formatPriceForSpeech(currentPrice)}.`,
        `${symbol}, gráfico de ${timeframeName}. Comprou em ${formatPriceForSpeech(entryPrice)}.`,
        `Bora lá. ${symbol} comprado em ${formatPriceForSpeech(entryPrice)}. Preço atual: ${formatPriceForSpeech(currentPrice)}.`
      ];
      messages.push(starts[Math.floor(Math.random() * starts.length)]);
    } else {
      const starts = [
        `Short em ${symbol}. Entrada ${formatPriceForSpeech(entryPrice)}, agora ${formatPriceForSpeech(currentPrice)}.`,
        `${symbol}, gráfico de ${timeframeName}. Vendeu em ${formatPriceForSpeech(entryPrice)}.`,
        `Beleza. ${symbol} shortado em ${formatPriceForSpeech(entryPrice)}. Preço: ${formatPriceForSpeech(currentPrice)}.`
      ];
      messages.push(starts[Math.floor(Math.random() * starts.length)]);
    }
    if (pnlPercent > 1.5) messages.push(`Lucro de ${pnlPercent.toFixed(1)} por cento. Tá bom.`);
    else if (pnlPercent > 0) messages.push(`Positivo em ${pnlPercent.toFixed(1)} por cento.`);
    else if (pnlPercent < -1.5) messages.push(`Prejuízo: ${Math.abs(pnlPercent).toFixed(1)} por cento. Atenção.`);
    else if (pnlPercent < 0) messages.push(`Negativo em ${Math.abs(pnlPercent).toFixed(1)} por cento.`);
  } else if (narrativeStyle === 1) {
    if (type === 'buy') {
      messages.push(`Certo, vamos analisar teu comprado em ${symbol}. Timeframe de ${timeframeName}, entrada em ${formatPriceForSpeech(entryPrice)} dólares.`);
    } else {
      messages.push(`Analisando teu short em ${symbol}. Operação no ${timeframeName}, você entrou em ${formatPriceForSpeech(entryPrice)}.`);
    }
    messages.push(`Preço atual está marcando ${formatPriceForSpeech(currentPrice)}.`);
    if (pnlPercent > 2) messages.push(`Olha, tá ${pnlPercent.toFixed(1)} por cento no lucro. Movimentação boa a teu favor.`);
    else if (pnlPercent > 0.5) messages.push(`Lucro de ${pnlPercent.toFixed(1)} por cento até aqui. Seguindo bem.`);
    else if (pnlPercent < -2) messages.push(`Resultado negativo de ${Math.abs(pnlPercent).toFixed(1)} por cento. Mercado indo contra.`);
    else if (pnlPercent < -0.5) messages.push(`Tá ${Math.abs(pnlPercent).toFixed(1)} por cento negativo. Aguarda mais um pouco.`);
    else messages.push(`Quase zero a zero. Mercado indeciso.`);
  } else if (narrativeStyle === 2) {
    const greetings = ['E aí', 'Beleza', 'Opa', 'Vamos lá', 'Bora ver'];
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    if (type === 'buy') {
      messages.push(`${greeting}. Como tá indo essa compra em ${symbol}? Você pegou em ${entryPrice.toFixed(0)}, certo?`);
    } else {
      messages.push(`${greeting}. Teu vendido em ${symbol}... entrou em ${entryPrice.toFixed(0)}, certo?`);
    }
    messages.push(`Agora tá em ${currentPrice.toFixed(0)} dólares.`);
    if (pnlPercent > 2) {
      const reactions = [
        `Cara, ${pnlPercent.toFixed(1)} por cento! Tá voando essa operação!`,
        `Eita! ${pnlPercent.toFixed(1)} por cento no verde. Mandou bem!`,
        `Olha só, ${pnlPercent.toFixed(1)} por cento positivo. Lindeza!`
      ];
      messages.push(reactions[Math.floor(Math.random() * reactions.length)]);
    } else if (pnlPercent > 0.3) messages.push(`${pnlPercent.toFixed(1)} por cento no lucro. Tranquilo.`);
    else if (pnlPercent < -2) messages.push(`Ih, ${Math.abs(pnlPercent).toFixed(1)} por cento no vermelho. Não tá legal.`);
    else if (pnlPercent < -0.3) messages.push(`Tá ${Math.abs(pnlPercent).toFixed(1)} por cento negativo. Mas calma.`);
  } else {
    if (type === 'buy') {
      const casual = [
        `Bom, seu comprado em ${symbol}. Pegou por ${entryPrice.toFixed(0)}.`,
        `${symbol}... você comprou em ${entryPrice.toFixed(0)}.`,
        `Deixa eu ver aqui. ${symbol}, entrada ${entryPrice.toFixed(0)}. Preço: ${currentPrice.toFixed(0)}.`
      ];
      messages.push(casual[Math.floor(Math.random() * casual.length)]);
    } else {
      const casual = [
        `Teu short em ${symbol}. Entrada foi ${entryPrice.toFixed(0)}.`,
        `${symbol}... vendeu em ${entryPrice.toFixed(0)}, cotando ${currentPrice.toFixed(0)} agora.`,
        `Vamos ver. ${symbol} vendido em ${entryPrice.toFixed(0)}. Atual: ${currentPrice.toFixed(0)}.`
      ];
      messages.push(casual[Math.floor(Math.random() * casual.length)]);
    }
    if (pnlPercent > 2.5) messages.push(`Rapaz, ${pnlPercent.toFixed(1)} por cento. Pegou um baita movimento aí.`);
    else if (pnlPercent > 0.5) messages.push(`Tá ${pnlPercent.toFixed(1)} no verde. Segue o jogo.`);
    else if (pnlPercent < -2.5) messages.push(`Olha, ${Math.abs(pnlPercent).toFixed(1)} por cento contra. Vê se vale segurar.`);
    else if (pnlPercent < -0.5) messages.push(`Negativo em ${Math.abs(pnlPercent).toFixed(1)}. Normal, mercado respira.`);
    else messages.push(`Tá empatado ainda. Aguarda o movimento.`);
  }

  // Indicadores reais — só entra na fala se o dado existir.
  const indicators: string[] = [];
  if (analysis.rsi !== null) {
    if (analysis.rsi > 70) indicators.push(`RSI em ${analysis.rsi.toFixed(0)}, sobrecomprado`);
    else if (analysis.rsi < 30) indicators.push(`RSI em ${analysis.rsi.toFixed(0)}, sobrevendido`);
    else indicators.push(`RSI em ${analysis.rsi.toFixed(0)}, neutro`);
  }
  if (analysis.macd) {
    indicators.push(analysis.macd.histogram > 0 ? 'MACD positivo' : 'MACD negativo');
  }
  if (analysis.volatility.level === 'extreme') indicators.push('Volatilidade extrema pelo ATR');
  else if (analysis.volatility.level === 'high') indicators.push(`Volatilidade alta, ATR em ${analysis.volatility.value.toFixed(1)} por cento do preço`);
  else if (analysis.volatility.level === 'low') indicators.push('Volatilidade baixa pelo ATR');

  if (indicators.length > 0) {
    messages.push(indicators.join('. ') + '.');
  }

  const levelStyle = Math.floor(Math.random() * 3);
  if (levelStyle === 0) {
    messages.push(`Suporte em ${formatPriceForSpeech(analysis.priceAction.supportLevel)}, resistência ${formatPriceForSpeech(analysis.priceAction.resistanceLevel)}.`);
  } else if (levelStyle === 1) {
    messages.push(`De olho: fundo em ${formatPriceForSpeech(analysis.priceAction.supportLevel)}, topo em ${formatPriceForSpeech(analysis.priceAction.resistanceLevel)}.`);
  } else {
    messages.push(`Principais níveis: ${formatPriceForSpeech(analysis.priceAction.supportLevel)} e ${formatPriceForSpeech(analysis.priceAction.resistanceLevel)}.`);
  }

  const stopStyles = [
    `Stop: ${formatPriceForSpeech(analysis.risk.stopLoss)}.`,
    `Põe stop em ${formatPriceForSpeech(analysis.risk.stopLoss)}.`,
    `Stop tem que tá em ${formatPriceForSpeech(analysis.risk.stopLoss)}.`,
    `Protege em ${formatPriceForSpeech(analysis.risk.stopLoss)}.`
  ];
  messages.push(stopStyles[Math.floor(Math.random() * stopStyles.length)]);

  const [tp1, tp2, tp3] = analysis.risk.takeProfitTargets;
  const targetStyle = Math.floor(Math.random() * 3);
  if (targetStyle === 0) {
    messages.push(`Primeiro alvo: ${formatPriceForSpeech(tp1)}. Segundo: ${formatPriceForSpeech(tp2)}. Último: ${formatPriceForSpeech(tp3)}.`);
  } else if (targetStyle === 1) {
    messages.push(`Realiza parcial em ${formatPriceForSpeech(tp1)}, depois ${formatPriceForSpeech(tp2)}, e deixa runner até ${formatPriceForSpeech(tp3)}.`);
  } else {
    messages.push(`Alvos: ${formatPriceForSpeech(tp1)}, ${formatPriceForSpeech(tp2)} e ${formatPriceForSpeech(tp3)}. Vai saindo aos poucos.`);
  }

  if (analysis.suggestions.action !== 'hold') {
    messages.push(analysis.suggestions.reasoning);
  }

  return messages;
}
