import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Wifi, WifiOff } from 'lucide-react';
import { getUnifiedMarketData } from '@/app/services/UnifiedMarketDataService';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const MT5_PRICES_URL = `https://${projectId}.supabase.co/functions/v1/server/mt5-prices`;

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
    // ✅ CORRIGIDO 2026-07-08: a versão anterior fazia 45 chamadas HTTP
    // SEQUENCIAIS (um await por vez, ~3-18s cada) a cada 30s. Como um
    // ciclo nunca terminava antes do próximo começar, isso empilhava
    // centenas de requisições concorrentes na conta MetaAPI compartilhada
    // (visto nos logs de produção) — causa raiz do Dashboard/ticker
    // zerando pra TODOS os ativos, não só os de MT5. Também tinha símbolos
    // errados hardcoded (US500 em vez de SPX500, DE40 em vez de GER40,
    // DOGUSD/AVAUSD/MATUSD truncados, OIL/BRENT trocados) que sempre
    // falhavam. Agora: cripto via Binance em paralelo (rápido, sem MT5),
    // e o resto num ÚNICO POST em lote pro /mt5-prices.
    const cryptoAssets = [
      { symbol: 'BTCUSDT', display: 'BTC' },
      { symbol: 'ETHUSDT', display: 'ETH' },
      { symbol: 'XRPUSDT', display: 'XRP' },
      { symbol: 'BNBUSDT', display: 'BNB' },
      { symbol: 'SOLUSDT', display: 'SOL' },
      { symbol: 'ADAUSDT', display: 'ADA' },
      { symbol: 'DOGEUSDT', display: 'DOGE' },
      { symbol: 'AVAXUSDT', display: 'AVAX' },
      { symbol: 'DOTUSDT', display: 'DOT' },
      { symbol: 'POLUSDT', display: 'POL' }, // Polygon (rebrandado de MATIC)
    ];

    const mt5Assets = [
      // Índices
      { mt5Symbol: 'SPX500', display: 'S&P 500' },
      { mt5Symbol: 'NAS100', display: 'NASDAQ' },
      { mt5Symbol: 'US30', display: 'DOW' },
      { mt5Symbol: 'GER40', display: 'DAX' },
      { mt5Symbol: 'UK100', display: 'FTSE' },
      { mt5Symbol: 'JPN225', display: 'NIKKEI' },
      { mt5Symbol: 'HKG33', display: 'HANG SENG' },

      // Forex
      { mt5Symbol: 'EURUSD', display: 'EUR/USD' },
      { mt5Symbol: 'GBPUSD', display: 'GBP/USD' },
      { mt5Symbol: 'USDJPY', display: 'USD/JPY' },
      { mt5Symbol: 'USDCHF', display: 'USD/CHF' },
      { mt5Symbol: 'AUDUSD', display: 'AUD/USD' },
      { mt5Symbol: 'USDCAD', display: 'USD/CAD' },
      { mt5Symbol: 'NZDUSD', display: 'NZD/USD' },
      { mt5Symbol: 'EURGBP', display: 'EUR/GBP' },
      { mt5Symbol: 'EURJPY', display: 'EUR/JPY' },
      { mt5Symbol: 'GBPJPY', display: 'GBP/JPY' },

      // Metais
      { mt5Symbol: 'XAUUSD', display: 'GOLD' },
      { mt5Symbol: 'XAGUSD', display: 'SILVER' },
      { mt5Symbol: 'XPTUSD', display: 'PLATINUM' },
      { mt5Symbol: 'XPDUSD', display: 'PALLADIUM' },

      // Energia — USOUSD = WTI, UKOUSD = Brent (estavam trocados)
      { mt5Symbol: 'USOUSD', display: 'OIL' },
      { mt5Symbol: 'UKOUSD', display: 'BRENT' },

      // Ações
      { mt5Symbol: 'AAPL', display: 'AAPL' },
      { mt5Symbol: 'MSFT', display: 'MSFT' },
      { mt5Symbol: 'GOOGL', display: 'GOOGL' },
      { mt5Symbol: 'AMZN', display: 'AMZN' },
      { mt5Symbol: 'NVDA', display: 'NVDA' },
      { mt5Symbol: 'TSLA', display: 'TSLA' },
      { mt5Symbol: 'META', display: 'META' },
      { mt5Symbol: 'NFLX', display: 'NFLX' },
      { mt5Symbol: 'AMD', display: 'AMD' },
      { mt5Symbol: 'INTC', display: 'INTC' },
    ];

    const fetchTickers = async () => {
      try {
        const formatted: TickerAsset[] = [];

        // ✅ Cripto: Binance em paralelo (rápido, não passa por MT5)
        const cryptoResults = await Promise.allSettled(
          cryptoAssets.map(asset => getUnifiedMarketData(asset.symbol))
        );
        cryptoResults.forEach((result, i) => {
          if (result.status === 'fulfilled' && result.value) {
            formatted.push({
              symbol: cryptoAssets[i].display,
              price: result.value.price,
              change: result.value.changePercent
            });
          }
        });

        // ✅ MT5: UM ÚNICO POST em lote pra todos os símbolos
        try {
          const res = await fetch(MT5_PRICES_URL, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ symbols: mt5Assets.map(a => a.mt5Symbol) }),
          });

          if (res.ok) {
            const result = await res.json();
            const prices: any[] = Array.isArray(result?.prices) ? result.prices : [];
            mt5Assets.forEach(asset => {
              const tick = prices.find(p => p.symbol === asset.mt5Symbol);
              if (tick && tick.price > 0) {
                formatted.push({
                  symbol: asset.display,
                  price: tick.price,
                  change: tick.changePercent || 0
                });
              }
            });
          }
        } catch (e) {
          console.warn('[MarketTicker] Erro ao buscar lote MT5:', e);
        }

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
    // 10s (ajustado a pedido do Cleber) — preço "vivo" (era 30s); já usa batch/
    // Promise.allSettled (ver histórico do arquivo), não empilha chamada por símbolo
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