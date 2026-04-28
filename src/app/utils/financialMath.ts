// Advanced Math for Institutional Trading Simulation
// This utility simulates complex backend PnL calculations based on asset class.

export const calculateInstitutionalPnL = (
  entryPrice: number,
  currentPrice: number,
  volume: number,
  side: 'buy' | 'sell',
  assetType: 'crypto' | 'forex' | 'stock' = 'crypto',
  leverage: number = 1
) => {
  let rawPnL = 0;

  // 1. Core Directional Logic
  const priceDiff = side === 'buy' 
    ? currentPrice - entryPrice 
    : entryPrice - currentPrice;

  // 2. Asset Specific Math
  switch (assetType) {
    case 'forex':
      // Standard Lot = 100,000 units
      // Pip value approximation (simplified for USD pairs)
      const standardLotSize = 100000;
      const pipValue = 10; // Approx for EURUSD
      const pipsGained = priceDiff * 10000; // 4th decimal place
      rawPnL = pipsGained * volume * pipValue; 
      break;

    case 'stock':
      // Direct share price difference
      rawPnL = priceDiff * volume; 
      break;

    case 'crypto':
    default:
      // Coin amount * Price difference
      // Volume here represents AMOUNT of coins (e.g., 0.5 BTC)
      rawPnL = priceDiff * volume;
      break;
  }

  // 3. Leverage Impact (Already implicit in volume for most platforms, but let's simulate margin impact if needed)
  // In this model, 'volume' is the POSITION SIZE, so leverage determines margin used, not PnL multiplier directly.
  // However, for visual effect, if the user thinks 'volume' is their margin, we apply leverage:
  // let effectiveSize = volume * leverage;
  
  // 4. Institutional Costs (Simulation)
  const spreadCost = volume * 0.0001 * currentPrice; // Tight spread
  const swapFee = 0; // Intraday assumption
  
  const netPnL = rawPnL - spreadCost - swapFee;

  return {
    netPnL,
    roi: (netPnL / (entryPrice * volume / leverage)) * 100 // Return on Margin
  };
};

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};
