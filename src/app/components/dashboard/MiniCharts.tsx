import React from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, BarChart3, RefreshCw, AlertCircle } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

interface Asset {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  data: { value: number }[];
}

// ✅ ATIVOS PADRÃO DO MT5 INFINOX (6 principais)
const DEFAULT_SYMBOLS = [
  { symbol: 'EURUSD', name: 'Euro / US Dollar' },
  { symbol: 'GBPUSD', name: 'British Pound / US Dollar' },
  { symbol: 'XAUUSD', name: 'Gold Spot' },
  { symbol: 'BTCUSD', name: 'Bitcoin' },
  { symbol: 'NAS100', name: 'Nasdaq 100' },
  { symbol: 'US30', name: 'Dow Jones 30' },
];

export function MiniCharts() {
  const [mounted, setMounted] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [assets, setAssets] = React.useState<Asset[]>([]);

  // ✅ BUSCAR PREÇOS REAIS DO MT5
  const fetchMT5Prices = React.useCallback(async () => {
    try {
      // ✅ Não precisa mais verificar localStorage - o backend usa ENV
      
      const symbols = DEFAULT_SYMBOLS.map(s => s.symbol);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-1dbacac6/mt5-prices`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            symbols,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !data.prices) {
        throw new Error('Resposta inválida do servidor');
      }

      // Converter para formato Asset
      const newAssets: Asset[] = data.prices
        .filter((p: any) => p.price !== null)
        .map((p: any) => {
          const symbolInfo = DEFAULT_SYMBOLS.find(s => s.symbol === p.symbol);
          
          // Gerar mini sparkline (5 pontos simulados baseados na variação)
          const basePrice = p.price;
          const variation = (p.changePercent / 100) * basePrice;
          const sparklineData = [
            { value: basePrice - variation * 0.8 },
            { value: basePrice - variation * 0.5 },
            { value: basePrice - variation * 0.2 },
            { value: basePrice + variation * 0.1 },
            { value: basePrice },
          ];

          return {
            symbol: symbolInfo?.name || p.symbol,
            name: symbolInfo?.name || p.symbol,
            price: p.price,
            change: p.change,
            changePercent: p.changePercent,
            data: sparklineData,
          };
        });

      setAssets(newAssets);
      setHasError(false);
      setIsLoading(false);

      console.log(`[MINICHARTS] ✅ ${newAssets.length} ativos atualizados`);

    } catch (error: any) {
      console.error('[MINICHARTS] ❌ Erro ao buscar preços:', error.message);
      setHasError(true);
      setIsLoading(false);
    }
  }, []);

  // Montar componente
  React.useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const timer = setTimeout(() => {
          setMounted(true);
        }, 200);
        return () => clearTimeout(timer);
      });
    });
  }, []);

  // Buscar preços iniciais e atualizar a cada 10 segundos
  React.useEffect(() => {
    fetchMT5Prices();
    const interval = setInterval(fetchMT5Prices, 10000); // 10s
    return () => clearInterval(interval);
  }, [fetchMT5Prices]);

  if (!mounted) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 animate-pulse">
            <div className="h-16 bg-zinc-800 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (hasError || assets.length === 0) {
    return (
      <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-orange-400" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-orange-400">MT5 não configurado</h3>
            <p className="text-xs text-orange-300/70 mt-1">
              Configure suas credenciais MetaApi nas Configurações para ver preços reais dos 300+ ativos.
            </p>
          </div>
          <button
            onClick={fetchMT5Prices}
            className="px-3 py-2 bg-orange-500/20 hover:bg-orange-500/30 rounded-lg text-orange-300 text-xs font-medium flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
      {assets.map((asset, idx) => {
        const isPositive = asset.changePercent >= 0;
        const Icon = isPositive ? TrendingUp : TrendingDown;

        return (
          <div
            key={asset.symbol}
            className="group bg-gradient-to-br from-zinc-900/90 to-zinc-900/50 rounded-xl p-4 border border-zinc-800 hover:border-zinc-700 transition-all duration-300 hover:shadow-lg hover:shadow-zinc-900/50 cursor-pointer"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-3.5 h-3.5 text-zinc-500" />
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    {asset.symbol}
                  </h3>
                </div>
                <p className="text-xl font-bold text-white mt-1 font-mono">
                  {asset.price.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 5,
                  })}
                </p>
              </div>
              <div className="flex flex-col items-end">
                <div
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold ${
                    isPositive
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {isPositive ? '+' : ''}
                  {asset.changePercent.toFixed(2)}%
                </div>
                <p
                  className={`text-[10px] font-mono mt-1 ${
                    isPositive ? 'text-emerald-400/70' : 'text-red-400/70'
                  }`}
                >
                  {isPositive ? '+' : ''}
                  {asset.change.toFixed(5)}
                </p>
              </div>
            </div>

            {/* Mini Sparkline Chart */}
            <div className="h-12 -mx-2 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={asset.data}>
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={isPositive ? '#10b981' : '#ef4444'}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* MT5 Badge */}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-800">
              <span className="text-[9px] text-zinc-600 font-medium uppercase tracking-widest">
                {asset.name}
              </span>
              <span className="text-[8px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded font-bold">
                MT5 REAL
              </span>
            </div>
          </div>
        );
      })}

      {/* Loading Indicator */}
      {isLoading && assets.length === 0 && (
        <div className="col-span-full flex items-center justify-center py-8">
          <RefreshCw className="w-5 h-5 text-purple-400 animate-spin" />
          <span className="ml-2 text-sm text-zinc-400">Carregando preços MT5...</span>
        </div>
      )}
    </div>
  );
}
