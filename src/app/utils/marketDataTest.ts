/**
 * 🧪 TESTE DE DADOS DE MERCADO
 * 
 * Utilitário para validar se os dados da plataforma correspondem aos da Binance
 * Use no console: `window.testMarketData('BTCUSDT')`
 */

import { getBinanceRawData } from './binanceValidator';
import { getUnifiedMarketData } from '@/app/services/UnifiedMarketDataService';

export async function testMarketData(symbol: string) {
  console.log(`\n🧪 === TESTE DE DADOS: ${symbol} ===\n`);
  
  // 1. Buscar dados da Binance (fonte de verdade)
  console.log('📡 Buscando dados da Binance...');
  const binanceData = await getBinanceRawData(symbol);
  
  if (!binanceData) {
    console.error('❌ Falha ao buscar dados da Binance');
    return;
  }
  
  console.log('✅ Binance RAW Data:', {
    symbol: binanceData.symbol,
    lastPrice: binanceData.lastPrice,
    openPrice: binanceData.openPrice,
    priceChange: binanceData.priceChange,
    priceChangePercent: binanceData.priceChangePercent,
    highPrice: binanceData.highPrice,
    lowPrice: binanceData.lowPrice,
    volume: binanceData.volume
  });
  
  // 2. Buscar dados da plataforma
  console.log('\n📡 Buscando dados da plataforma...');
  const platformData = await getUnifiedMarketData(symbol);
  
  console.log('✅ Platform Data:', {
    symbol: platformData.symbol,
    price: platformData.price,
    change: platformData.change,
    changePercent: platformData.changePercent,
    openPrice: platformData.openPrice,
    high: platformData.high,
    low: platformData.low,
    volume: platformData.volume,
    source: platformData.source
  });
  
  // 3. Comparar valores
  console.log('\n📊 === COMPARAÇÃO ===\n');
  
  const priceDiff = Math.abs(binanceData.lastPrice - platformData.price);
  const changeDiff = Math.abs(binanceData.priceChange - platformData.change);
  const changePercentDiff = Math.abs(binanceData.priceChangePercent - platformData.changePercent);
  
  const priceMatch = priceDiff < 0.01;
  const changeMatch = changeDiff < 0.01;
  const changePercentMatch = changePercentDiff < 0.01;
  
  console.log(`Price: ${priceMatch ? '✅' : '❌'}`);
  console.log(`  Binance: ${binanceData.lastPrice}`);
  console.log(`  Platform: ${platformData.price}`);
  console.log(`  Diff: ${priceDiff.toFixed(8)}`);
  
  console.log(`\nChange: ${changeMatch ? '✅' : '❌'}`);
  console.log(`  Binance: ${binanceData.priceChange}`);
  console.log(`  Platform: ${platformData.change}`);
  console.log(`  Diff: ${changeDiff.toFixed(8)}`);
  
  console.log(`\nChange %: ${changePercentMatch ? '✅' : '❌'}`);
  console.log(`  Binance: ${binanceData.priceChangePercent}%`);
  console.log(`  Platform: ${platformData.changePercent}%`);
  console.log(`  Diff: ${changePercentDiff.toFixed(4)}%`);
  
  // 4. Cálculo manual da variação
  console.log('\n🧮 === CÁLCULO MANUAL ===\n');
  const manualChange = binanceData.lastPrice - binanceData.openPrice;
  const manualChangePercent = (manualChange / binanceData.openPrice) * 100;
  
  console.log(`Manual Change: ${manualChange.toFixed(8)}`);
  console.log(`Manual Change %: ${manualChangePercent.toFixed(4)}%`);
  console.log(`Binance fornece: ${binanceData.priceChangePercent}%`);
  console.log(`Match: ${Math.abs(manualChangePercent - binanceData.priceChangePercent) < 0.01 ? '✅' : '❌'}`);
  
  // 5. Resultado final
  console.log('\n🎯 === RESULTADO ===\n');
  
  if (priceMatch && changeMatch && changePercentMatch) {
    console.log('✅ PERFEITO! Todos os valores correspondem à Binance');
  } else {
    console.warn('⚠️ DISCREPÂNCIA DETECTADA!');
    
    if (!priceMatch) {
      console.error(`  - Price com diferença de ${priceDiff.toFixed(8)}`);
    }
    if (!changeMatch) {
      console.error(`  - Change com diferença de ${changeDiff.toFixed(8)}`);
    }
    if (!changePercentMatch) {
      console.error(`  - Change % com diferença de ${changePercentDiff.toFixed(4)}%`);
    }
  }
  
  console.log('\n=================================\n');
}

// Expor globalmente para uso no console
if (typeof window !== 'undefined') {
  (window as any).testMarketData = testMarketData;
  console.log('🧪 Test utility loaded! Use: window.testMarketData("BTCUSDT")');
}
