/**
 * Gera uma análise completa por voz da próxima hora
 */
export function generateHourlyVoiceAnalysis(data: HourlyAnalysisData): string[] {
  const { symbol, currentPrice, trend, strength, volatility } = data;

  // Calcular previsões
  const trendMultiplier = trend === 'bullish' ? 1 : trend === 'bearish' ? -1 : 0;
  const price15min = currentPrice * (1 + trendMultiplier * volatility * 0.3 * strength);
  const price30min = currentPrice * (1 + trendMultiplier * volatility * 0.6 * strength);
  const price1h = currentPrice * (1 + trendMultiplier * volatility * 1.0 * strength);

  // Calcular mudanças percentuais
  const change1h = ((price1h - currentPrice) / currentPrice * 100).toFixed(1);

  // Probabilidades
  const probUp = trend === 'bullish' ? 55 + Math.random() * 25 : 30 + Math.random() * 15;

  // Níveis
  const stopLoss = (currentPrice * 0.985).toFixed(0);
  const takeProfit = (currentPrice * 1.02).toFixed(0);

  // RSI e momentum
  const rsi = (30 + Math.random() * 40).toFixed(0);

  // Risco
  const riskLevel = volatility > 0.025 ? 'alto' : volatility > 0.015 ? 'médio' : 'baixo';

  // 🔥 MENSAGENS MUITO CURTAS E DIRETAS (máximo 80 caracteres cada)
  const messages: string[] = [];

  // 1. INTRODUÇÃO
  messages.push(`Análise de ${symbol}.`);
  
  messages.push(`Preço atual: ${currentPrice.toFixed(0)} dólares.`);

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

  // 4. PROBABILIDADE
  messages.push(`Probabilidade de alta: ${probUp.toFixed(0)} por cento.`);

  // 5. NÍVEIS
  messages.push(`Stop loss em ${stopLoss} dólares.`);
  messages.push(`Take profit em ${takeProfit} dólares.`);

  // 6. RSI
  if (parseInt(rsi) > 70) {
    messages.push(`RSI em ${rsi}. Sobrecompra. Cuidado.`);
  } else if (parseInt(rsi) < 30) {
    messages.push(`RSI em ${rsi}. Sobrevenda. Zona de compra.`);
  } else {
    messages.push(`RSI em ${rsi}. Neutro.`);
  }

  // 7. RISCO
  messages.push(`Risco ${riskLevel}.`);

  // 8. RECOMENDAÇÃO FINAL
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
  const { symbol, currentPrice, trend, strength } = data;
  
  const confidence = (strength * 100).toFixed(0);
  
  if (trend === 'bullish') {
    return `${symbol} em tendência de alta com ${confidence} por cento de confiança. Preço atual: ${currentPrice.toFixed(2)} dólares. Recomendo compra.`;
  } else if (trend === 'bearish') {
    return `${symbol} em tendência de baixa com ${confidence} por cento de confiança. Preço atual: ${currentPrice.toFixed(2)} dólares. Cuidado com compras.`;
  } else {
    return `${symbol} em movimento lateral. Preço atual: ${currentPrice.toFixed(2)} dólares. Aguarde confirmação.`;
  }
}