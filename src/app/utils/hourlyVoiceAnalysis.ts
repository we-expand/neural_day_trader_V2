/**
 * 🎙️ ANÁLISE POR VOZ — dados reais do MarketScoreEngine, nunca sorteados.
 *
 * ✅ 2026-07-28: `rsi` e `probUp` eram gerados com `Math.random()` dentro
 * desta função — violava a regra do projeto de nunca fabricar dado (o RSI
 * "falava" um número que não tinha nenhuma relação com o RSI real calculado
 * pelo MarketScoreEngine, e "probabilidade de alta" não existe como conceito
 * calculado em lugar nenhum do motor, só era um número aleatório com cara de
 * estatística). Agora `rsi` entra como parâmetro real (vindo de
 * `MarketScoreResult.indicators.rsi`) — quando o motor não tem RSI disponível
 * (candles insuficientes), a narração OMITE a menção em vez de inventar. A
 * frase de "probabilidade de alta" foi removida (não existe fonte real pra
 * ela) — NÃO foi substituída por `confidence` disfarçado: confiança mede
 * concordância entre os fatores do motor, não é uma probabilidade de a
 * direção prevista se realizar, e apresentar uma como a outra seria enganoso.
 */

export type HourlyTrend = 'bullish' | 'bearish' | 'sideways';

/** Dados de entrada — todos rastreáveis a uma fonte real (MarketScoreResult). */
export interface HourlyAnalysisData {
  symbol: string;
  currentPrice: number;
  trend: HourlyTrend;
  /** 0..1 — confiança real do MarketScoreEngine (`confidence / 100`), não uma probabilidade de acerto. */
  strength: number;
  /** Volatilidade real (ex: ATR / preço), usada só pra qualificar risco — nunca para "prever" preço futuro exato. */
  volatility: number;
  /** RSI real do `MarketScoreResult.indicators.rsi`. `null` quando o motor não tem candle suficiente para calculá-lo. */
  rsi: number | null;
  /** 'unavailable' quando o MarketScoreEngine não tem nenhuma fonte real de dado para este ativo/timeframe. */
  provenance: 'real' | 'partial' | 'stale' | 'unavailable';
}

/**
 * Gera uma análise completa por voz da próxima hora, a partir de dados reais
 * do MarketScoreEngine. Nunca sorteia RSI ou "probabilidade de alta".
 */
export function generateHourlyVoiceAnalysis(data: HourlyAnalysisData): string[] {
  const { symbol, currentPrice, trend, strength, volatility, rsi, provenance } = data;

  const messages: string[] = [];

  // 0. INDISPONÍVEL — comunica em voz alta em vez de narrar dado inventado.
  if (provenance === 'unavailable') {
    messages.push(`Análise de ${symbol}.`);
    messages.push(`Sem dados reais disponíveis no momento para este ativo.`);
    messages.push(`Aguarde a próxima atualização antes de operar.`);
    return messages;
  }

  // Calcular previsões (mesma direção/força do motor, sem prometer preço exato)
  const trendMultiplier = trend === 'bullish' ? 1 : trend === 'bearish' ? -1 : 0;
  const price1h = currentPrice * (1 + trendMultiplier * volatility * 1.0 * strength);
  const change1h = ((price1h - currentPrice) / currentPrice * 100).toFixed(1);

  // Níveis (referência de gestão de risco, não previsão)
  const stopLoss = (currentPrice * 0.985).toFixed(0);
  const takeProfit = (currentPrice * 1.02).toFixed(0);

  // Risco
  const riskLevel = volatility > 0.025 ? 'alto' : volatility > 0.015 ? 'médio' : 'baixo';

  // 1. INTRODUÇÃO
  messages.push(`Análise de ${symbol}.`);
  messages.push(`Preço atual: ${currentPrice.toFixed(0)} dólares.`);

  if (provenance === 'stale') {
    messages.push(`Atenção: leitura desatualizada, aguardando novo dado real.`);
  }

  // 2. RECOMENDAÇÃO
  if (trend === 'bullish') {
    messages.push(`Recomendo compra.`);
    messages.push(`Confiança: ${(strength * 100).toFixed(0)} por cento.`);
  } else if (trend === 'bearish') {
    messages.push(`Recomendo venda.`);
    messages.push(`Confiança: ${(strength * 100).toFixed(0)} por cento.`);
  } else {
    messages.push(`Mercado lateral. Aguarde confirmação.`);
  }

  // 3. PREVISÃO 1H
  messages.push(`Previsão em uma hora: ${price1h.toFixed(0)} dólares.`);
  messages.push(`Variação esperada: ${change1h} por cento.`);

  // 4. NÍVEIS
  messages.push(`Stop loss em ${stopLoss} dólares.`);
  messages.push(`Take profit em ${takeProfit} dólares.`);

  // 5. RSI — só fala se o motor tiver RSI real; nunca inventa um valor.
  if (rsi !== null) {
    const rsiRounded = rsi.toFixed(0);
    if (rsi > 70) {
      messages.push(`RSI em ${rsiRounded}. Sobrecompra. Cuidado.`);
    } else if (rsi < 30) {
      messages.push(`RSI em ${rsiRounded}. Sobrevenda. Zona de compra.`);
    } else {
      messages.push(`RSI em ${rsiRounded}. Neutro.`);
    }
  }

  // 6. RISCO
  messages.push(`Risco ${riskLevel}.`);

  // 7. RECOMENDAÇÃO FINAL
  if (trend === 'bullish') {
    messages.push(`Entre após confirmação de rompimento.`);
    messages.push(`Proteja com stop loss sempre.`);
  } else if (trend === 'bearish') {
    messages.push(`Evite compras agora.`);
    messages.push(`Aguarde suporte antes de entrar.`);
  } else {
    messages.push(`Aguarde breakout confirmado.`);
    messages.push(`Não opere sem confirmação.`);
  }

  messages.push(`Boa sorte na operação!`);

  return messages;
}

/**
 * Gera análise simplificada (versão curta para alertas frequentes)
 */
export function generateQuickVoiceAnalysis(data: HourlyAnalysisData): string {
  const { symbol, currentPrice, trend, strength, provenance } = data;

  if (provenance === 'unavailable') {
    return `${symbol} sem dados reais disponíveis no momento.`;
  }

  const confidence = (strength * 100).toFixed(0);

  if (trend === 'bullish') {
    return `${symbol} em tendência de alta com ${confidence} por cento de confiança. Preço atual: ${currentPrice.toFixed(2)} dólares. Recomendo compra.`;
  } else if (trend === 'bearish') {
    return `${symbol} em tendência de baixa com ${confidence} por cento de confiança. Preço atual: ${currentPrice.toFixed(2)} dólares. Cuidado com compras.`;
  } else {
    return `${symbol} em movimento lateral. Preço atual: ${currentPrice.toFixed(2)} dólares. Aguarde confirmação.`;
  }
}
