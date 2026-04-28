import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Wifi, WifiOff } from 'lucide-react';
import { getMarketData } from '@/app/services/MetaApiService';

interface TickerAsset {
  symbol: string;
  price: number;
  change: number;
}

export function MarketTicker() {
  const [assets, setAssets] = useState<TickerAsset[]>([
    // ✅ 50+ ATIVOS PARA LOOPING INFINITO SEM ESPAÇOS
    // Criptos Top
    { symbol: 'BTC', price: 0, change: 0 },
    { symbol: 'ETH', price: 0, change: 0 },
    { symbol: 'XRP', price: 0, change: 0 },
    { symbol: 'BNB', price: 0, change: 0 },
    { symbol: 'SOL', price: 0, change: 0 },
    { symbol: 'ADA', price: 0, change: 0 },
    { symbol: 'DOGE', price: 0, change: 0 },
    { symbol: 'AVAX', price: 0, change: 0 },
    { symbol: 'DOT', price: 0, change: 0 },
    { symbol: 'POL', price: 0, change: 0 }, // Polygon (rebrandado de MATIC)
    
    // Índices Globais
    { symbol: 'S&P 500', price: 0, change: 0 },
    { symbol: 'NASDAQ', price: 0, change: 0 },
    { symbol: 'DOW', price: 0, change: 0 },
    { symbol: 'DAX', price: 0, change: 0 },
    { symbol: 'FTSE', price: 0, change: 0 },
    { symbol: 'NIKKEI', price: 0, change: 0 },
    { symbol: 'HANG SENG', price: 0, change: 0 },
    
    // Forex Majors
    { symbol: 'EUR/USD', price: 0, change: 0 },
    { symbol: 'GBP/USD', price: 0, change: 0 },
    { symbol: 'USD/JPY', price: 0, change: 0 },
    { symbol: 'USD/CHF', price: 0, change: 0 },
    { symbol: 'AUD/USD', price: 0, change: 0 },
    { symbol: 'USD/CAD', price: 0, change: 0 },
    { symbol: 'NZD/USD', price: 0, change: 0 },
    
    // Forex Crosses
    { symbol: 'EUR/GBP', price: 0, change: 0 },
    { symbol: 'EUR/JPY', price: 0, change: 0 },
    { symbol: 'GBP/JPY', price: 0, change: 0 },
    
    // Metais
    { symbol: 'GOLD', price: 0, change: 0 },
    { symbol: 'SILVER', price: 0, change: 0 },
    { symbol: 'PLATINUM', price: 0, change: 0 },
    { symbol: 'PALLADIUM', price: 0, change: 0 },
    
    // Energia
    { symbol: 'OIL', price: 0, change: 0 },
    { symbol: 'BRENT', price: 0, change: 0 },
    { symbol: 'NAT GAS', price: 0, change: 0 },
    
    // Ações USA Top
    { symbol: 'AAPL', price: 0, change: 0 },
    { symbol: 'MSFT', price: 0, change: 0 },
    { symbol: 'GOOGL', price: 0, change: 0 },
    { symbol: 'AMZN', price: 0, change: 0 },
    { symbol: 'NVDA', price: 0, change: 0 },
    { symbol: 'TSLA', price: 0, change: 0 },
    { symbol: 'META', price: 0, change: 0 },
    { symbol: 'NFLX', price: 0, change: 0 },
    { symbol: 'AMD', price: 0, change: 0 },
    { symbol: 'INTC', price: 0, change: 0 },
    
    // Commodities
    { symbol: 'COPPER', price: 0, change: 0 },
    { symbol: 'WHEAT', price: 0, change: 0 },
    { symbol: 'COFFEE', price: 0, change: 0 },
    { symbol: 'SUGAR', price: 0, change: 0 },
  ]);

  useEffect(() => {
    const fetchTickers = async () => {
      try {
        // ✅ Lista completa de 50+ ativos com mapeamento MT5
        const assetsToFetch = [
          // Criptos
          { symbol: 'BTCUSDT', display: 'BTC', mt5Symbol: 'BTCUSD' },
          { symbol: 'ETHUSDT', display: 'ETH', mt5Symbol: 'ETHUSD' },
          { symbol: 'XRPUSDT', display: 'XRP', mt5Symbol: 'XRPUSD' },
          { symbol: 'BNBUSDT', display: 'BNB', mt5Symbol: 'BNBUSD' },
          { symbol: 'SOLUSDT', display: 'SOL', mt5Symbol: 'SOLUSD' },
          { symbol: 'ADAUSDT', display: 'ADA', mt5Symbol: 'ADAUSD' },
          { symbol: 'DOGEUSDT', display: 'DOGE', mt5Symbol: 'DOGUSD' },
          { symbol: 'AVAXUSDT', display: 'AVAX', mt5Symbol: 'AVAUSD' },
          { symbol: 'DOTUSDT', display: 'DOT', mt5Symbol: 'DOTUSD' },
          { symbol: 'MATICUSDT', display: 'POL', mt5Symbol: 'MATUSD' }, // Polygon (rebrandado de MATIC)
          
          // Índices
          { symbol: 'US500', display: 'S&P 500', mt5Symbol: 'US500' },
          { symbol: 'NAS100', display: 'NASDAQ', mt5Symbol: 'NAS100' },
          { symbol: 'US30', display: 'DOW', mt5Symbol: 'US30' },
          { symbol: 'DE40', display: 'DAX', mt5Symbol: 'DE40' },
          { symbol: 'UK100', display: 'FTSE', mt5Symbol: 'UK100' },
          { symbol: 'JPN225', display: 'NIKKEI', mt5Symbol: 'JPN225' },
          { symbol: 'HKG33', display: 'HANG SENG', mt5Symbol: 'HKG33' },
          
          // Forex
          { symbol: 'EURUSD', display: 'EUR/USD', mt5Symbol: 'EURUSD' },
          { symbol: 'GBPUSD', display: 'GBP/USD', mt5Symbol: 'GBPUSD' },
          { symbol: 'USDJPY', display: 'USD/JPY', mt5Symbol: 'USDJPY' },
          { symbol: 'USDCHF', display: 'USD/CHF', mt5Symbol: 'USDCHF' },
          { symbol: 'AUDUSD', display: 'AUD/USD', mt5Symbol: 'AUDUSD' },
          { symbol: 'USDCAD', display: 'USD/CAD', mt5Symbol: 'USDCAD' },
          { symbol: 'NZDUSD', display: 'NZD/USD', mt5Symbol: 'NZDUSD' },
          { symbol: 'EURGBP', display: 'EUR/GBP', mt5Symbol: 'EURGBP' },
          { symbol: 'EURJPY', display: 'EUR/JPY', mt5Symbol: 'EURJPY' },
          { symbol: 'GBPJPY', display: 'GBP/JPY', mt5Symbol: 'GBPJPY' },
          
          // Metais
          { symbol: 'XAUUSD', display: 'GOLD', mt5Symbol: 'XAUUSD' },
          { symbol: 'XAGUSD', display: 'SILVER', mt5Symbol: 'XAGUSD' },
          { symbol: 'XPTUSD', display: 'PLATINUM', mt5Symbol: 'XPTUSD' },
          { symbol: 'XPDUSD', display: 'PALLADIUM', mt5Symbol: 'XPDUSD' },
          
          // Energia
          { symbol: 'UKOUSD', display: 'OIL', mt5Symbol: 'UKOUSD' },
          { symbol: 'USOUSD', display: 'BRENT', mt5Symbol: 'USOUSD' },
          { symbol: 'NGAS', display: 'NAT GAS', mt5Symbol: 'NGAS' },
          
          // Ações
          { symbol: 'AAPL', display: 'AAPL', mt5Symbol: 'AAPL' },
          { symbol: 'MSFT', display: 'MSFT', mt5Symbol: 'MSFT' },
          { symbol: 'GOOGL', display: 'GOOGL', mt5Symbol: 'GOOGL' },
          { symbol: 'AMZN', display: 'AMZN', mt5Symbol: 'AMZN' },
          { symbol: 'NVDA', display: 'NVDA', mt5Symbol: 'NVDA' },
          { symbol: 'TSLA', display: 'TSLA', mt5Symbol: 'TSLA' },
          { symbol: 'META', display: 'META', mt5Symbol: 'META' },
          { symbol: 'NFLX', display: 'NFLX', mt5Symbol: 'NFLX' },
          { symbol: 'AMD', display: 'AMD', mt5Symbol: 'AMD' },
          { symbol: 'INTC', display: 'INTC', mt5Symbol: 'INTC' },
          
          // Commodities
          { symbol: 'COPPER', display: 'COPPER', mt5Symbol: 'COPPER' },
          { symbol: 'WHEAT', display: 'WHEAT', mt5Symbol: 'WHEAT' },
          { symbol: 'COFFEE', display: 'COFFEE', mt5Symbol: 'Coffee' },
          { symbol: 'SUGAR', display: 'SUGAR', mt5Symbol: 'SUGAR' },
        ];

        const formatted: TickerAsset[] = [];

        // ✅ Buscar dados reais do MetaApi
        for (const asset of assetsToFetch) {
          try {
            const metaData = await getMarketData(asset.mt5Symbol);
            
            if (metaData) {
              formatted.push({
                symbol: asset.display,
                price: metaData.price,
                change: metaData.changePercent
              });
            } else {
              // ✅ REMOVIDO: Fallback Binance (apenas MT5 agora)
              // Se não conseguir do MT5, manter valor anterior
              const existing = assets.find(a => a.symbol === asset.display);
              if (existing && existing.price > 0) {
                formatted.push(existing);
              }
            }
          } catch (e) {
            const existing = assets.find(a => a.symbol === asset.display);
            if (existing && existing.price > 0) {
              formatted.push(existing);
            }
          }
        }

        if (formatted.length > 0) {
          setAssets(formatted);
        }
      } catch (e) {
        console.warn('[MarketTicker] Erro ao buscar dados:', e);
      }
    };

    fetchTickers();
    const interval = setInterval(fetchTickers, 30000);
    return () => clearInterval(interval);
  }, []);

  // ✅ TRIPLICAR ativos para garantir looping infinito sem espaços
  const duplicatedAssets = [...assets, ...assets, ...assets];

  return (
    <div className="w-full overflow-hidden bg-black/60 border-t border-white/5 backdrop-blur-sm">
      <div className="relative flex">
        {/* Gradient masks for fade effect */}
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-black/60 via-black/40 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-black/60 via-black/40 to-transparent z-10 pointer-events-none" />
        
        {/* Scrolling ticker - LOOPING INFINITO */}
        <div className="flex animate-ticker-scroll">
          {duplicatedAssets.map((asset, idx) => (
            <div
              key={`${asset.symbol}-${idx}`}
              className="flex items-center gap-3 px-6 py-2.5 whitespace-nowrap border-r border-white/5 hover:bg-white/5 transition-colors cursor-pointer group"
            >
              <span className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">
                {asset.symbol}
              </span>
              <span className="text-xs font-mono text-slate-300 group-hover:text-white transition-colors">
                ${asset.price > 0 ? asset.price.toLocaleString('en-US', { 
                  minimumFractionDigits: asset.price >= 100 ? 0 : 2, 
                  maximumFractionDigits: asset.price >= 100 ? 0 : 4 
                }) : '---'}
              </span>
              <div className={`flex items-center gap-1 text-xs font-bold ${asset.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {asset.change >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                <span>{asset.change >= 0 ? '+' : ''}{asset.change.toFixed(2)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}