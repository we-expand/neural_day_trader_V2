export interface LiquiditySignal {
  strength: number;
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  insight: string;
}

export function getLiquiditySignal(symbol: string, price: number): LiquiditySignal {
  const strength = Math.floor(Math.random() * 100);
  const rand = Math.random();
  let bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  
  if (rand > 0.6) bias = 'BULLISH';
  else if (rand > 0.3) bias = 'BEARISH';
  
  return {
    strength,
    bias,
    insight: bias === 'NEUTRAL' ? 'Acumulação Lateral' : `Pressão de ${bias === 'BULLISH' ? 'Compra' : 'Venda'} Institucional`
  };
}