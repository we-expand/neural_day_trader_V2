import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Wifi, WifiOff } from 'lucide-react';
import { getBatchedMT5Data } from '@/app/services/RealMarketDataService';

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
    // ✅ 2026-07-13: migrado pro pipeline único getBatchedMT5Data
    // (RealMarketDataService.ts) — antes o rodapé buscava cripto via
    // UnifiedMarketDataService (tinha fallback com Math.random()) e o resto
    // via fetch direto duplicado do mesmo /mt5-prices que getBatchedMT5Data
    // já encapsula (chunking anti-rate-limit, roteamento de cripto CFD vs
    // Binance, fallback Yahoo real pro que não está na corretora). Também
    // corrige 4 ativos que apareciam na lista mas NUNCA eram buscados
    // (NAT GAS, WHEAT, COFFEE, SUGAR — esquecidos do array antigo).
    const symbolMap: Record<string, string> = {
      // Cripto
      BTCUSD: 'BTC', ETHUSD: 'ETH', XRPUSD: 'XRP', BNBUSD: 'BNB', SOLUSD: 'SOL',
      ADAUSD: 'ADA', DOGEUSD: 'DOGE', AVAXUSD: 'AVAX', DOTUSD: 'DOT', POLUSD: 'POL',

      // Índices
      SPX500: 'S&P 500', NAS100: 'NASDAQ', US30: 'DOW', GER40: 'DAX',
      UK100: 'FTSE', JPN225: 'NIKKEI', HKG33: 'HANG SENG',

      // Forex
      EURUSD: 'EUR/USD', GBPUSD: 'GBP/USD', USDJPY: 'USD/JPY', USDCHF: 'USD/CHF',
      AUDUSD: 'AUD/USD', USDCAD: 'USD/CAD', NZDUSD: 'NZD/USD',
      EURGBP: 'EUR/GBP', EURJPY: 'EUR/JPY', GBPJPY: 'GBP/JPY',

      // Metais
      XAUUSD: 'GOLD', XAGUSD: 'SILVER', XPTUSD: 'PLATINUM', XPDUSD: 'PALLADIUM',

      // Energia — USOUSD = WTI, UKOUSD = Brent
      USOUSD: 'OIL', UKOUSD: 'BRENT', XNGUSD: 'NAT GAS',

      // Ações
      AAPL: 'AAPL', MSFT: 'MSFT', GOOGL: 'GOOGL', AMZN: 'AMZN', NVDA: 'NVDA',
      TSLA: 'TSLA', META: 'META', NFLX: 'NFLX', AMD: 'AMD', INTC: 'INTC',

      // Agrícolas — WHEUSD/COFUSD confirmados na corretora; SUGUSD cai no
      // fallback Yahoo real dentro de getBatchedMT5Data (não está na Infinox)
      WHEUSD: 'WHEAT', COFUSD: 'COFFEE', SUGUSD: 'SUGAR',
    };

    const fetchTickers = async () => {
      try {
        const data = await getBatchedMT5Data(Object.keys(symbolMap));

        const formatted: TickerAsset[] = Object.entries(symbolMap)
          .filter(([unifiedSymbol]) => data[unifiedSymbol]?.isRealData && data[unifiedSymbol].price > 0)
          .map(([unifiedSymbol, display]) => ({
            symbol: display,
            price: data[unifiedSymbol].price,
            change: data[unifiedSymbol].changePercent ?? 0,
          }));

        if (formatted.length > 0) {
          setAssets(prev => {
            // Mantém posições com dado anterior caso o novo fetch não tenha trazido nada pra elas
            const byDisplay = new Map(formatted.map(a => [a.symbol, a]));
            return prev.map(p => byDisplay.get(p.symbol) || p);
          });
        }
      } catch (e) {
        console.warn('[MarketTicker] Erro ao buscar dados:', e);
      }
    };

    fetchTickers();
    // 10s (ajustado a pedido do Cleber) — preço "vivo" (era 30s); getBatchedMT5Data
    // já faz uma única chamada em lote, não empilha chamada por símbolo
    const interval = setInterval(fetchTickers, 10000);
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