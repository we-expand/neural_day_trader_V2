export const calculatePnL = (
  entryPrice: number,
  currentPrice: number,
  size: number, // Quantity of asset (e.g., 0.5 BTC)
  side: 'buy' | 'sell',
  leverage: number = 1
) => {
  // 1. Calculate Raw Price Difference
  const priceDelta = currentPrice - entryPrice;
  
  // 2. Determine Directional Multiplier
  const direction = side === 'buy' ? 1 : -1;

  // 3. Calculate Gross Profit (Unrealized PnL)
  // Formula: (Price Delta * Direction) * Size
  const grossPnL = (priceDelta * direction) * size;

  // 4. Calculate Margin Used (Invested Collateral)
  // Formula: (Entry Price * Size) / Leverage
  const marginUsed = (entryPrice * size) / leverage;

  // 5. Calculate ROE (Return on Equity %)
  // Formula: (Gross PnL / Margin Used) * 100
  const roePercent = marginUsed > 0 ? (grossPnL / marginUsed) * 100 : 0;

  return {
    pnl: Number(grossPnL.toFixed(2)),
    roe: Number(roePercent.toFixed(2)),
    margin: Number(marginUsed.toFixed(2))
  };
};
