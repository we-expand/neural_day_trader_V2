/**
 * 📚 MARKET DATA - EXEMPLOS DE USO
 * 
 * Exemplos práticos de como usar o sistema de dados de mercado
 * em qualquer módulo da plataforma
 */

import { useMarketData, useSP500, useSymbolPrice } from '@/app/contexts/MarketDataContext';
import { TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react';

// ============================================================================
// EXEMPLO 1: Hook Completo - Acesso a todos os dados
// ============================================================================

export function ExemploHookCompleto() {
  const {
    prices,          // Map<string, ValidatedPrice> - Todos os preços
    sp500,           // Dados específicos do S&P 500
    isConnected,     // Status da conexão MT5
    isConnecting,    // Se está conectando
    refreshPrices,   // Função para atualizar manualmente
    watchedSymbols   // Lista de símbolos monitorados
  } = useMarketData();

  return (
    <div className="p-6 bg-neutral-900 rounded-lg">
      <h3 className="text-xl font-bold mb-4">Market Data Dashboard</h3>
      
      {/* Status da Conexão */}
      <div className={`mb-4 p-3 rounded ${isConnected ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
        <p className="text-sm font-bold">
          {isConnected ? '✅ Conectado ao MT5' : '❌ Desconectado (usando fallback)'}
        </p>
      </div>

      {/* S&P 500 em Destaque */}
      {sp500 && (
        <div className="mb-4 p-4 bg-purple-900/20 rounded-lg border border-purple-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-400">S&P 500</p>
              <p className="text-2xl font-bold">{sp500.price.toFixed(2)}</p>
            </div>
            <div className={`text-lg font-bold ${sp500.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {sp500.changePercent >= 0 ? '+' : ''}{sp500.changePercent.toFixed(2)}%
            </div>
          </div>
          <p className="text-xs text-neutral-500 mt-2">
            Fonte: {sp500.source === 'mt5' ? 'MetaTrader 5' : 'Fallback'}
          </p>
        </div>
      )}

      {/* Grid de Preços */}
      <div className="grid grid-cols-2 gap-3">
        {Array.from(prices.values()).map((price) => (
          <div key={price.symbol} className="p-3 bg-neutral-800 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold">{price.symbol}</span>
              <div className={`w-2 h-2 rounded-full ${
                price.source === 'mt5' ? 'bg-emerald-500' : 'bg-amber-500'
              }`} />
            </div>
            <p className="text-lg font-bold">${price.price.toFixed(2)}</p>
            <p className="text-xs text-neutral-500">
              Spread: {((price.spread / price.price) * 100).toFixed(3)}%
            </p>
          </div>
        ))}
      </div>

      {/* Botão de Atualização Manual */}
      <button
        onClick={refreshPrices}
        className="mt-4 w-full px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg font-bold text-sm uppercase"
      >
        Atualizar Preços Manualmente
      </button>

      {/* Símbolos Monitorados */}
      <div className="mt-4 p-3 bg-neutral-800/50 rounded-lg">
        <p className="text-xs text-neutral-500 mb-2">Símbolos Monitorados:</p>
        <div className="flex flex-wrap gap-2">
          {watchedSymbols.map(symbol => (
            <span key={symbol} className="px-2 py-1 bg-neutral-700 rounded text-xs">
              {symbol}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// EXEMPLO 2: Hook S&P 500 - Acesso rápido ao S&P
// ============================================================================

export function ExemploSP500() {
  const sp500 = useSP500();

  if (!sp500) {
    return <div>Carregando S&P 500...</div>;
  }

  return (
    <div className="p-4 bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-lg border border-purple-500/30">
      <div className="flex items-center gap-3 mb-3">
        {sp500.changePercent >= 0 ? (
          <TrendingUp className="w-6 h-6 text-emerald-400" />
        ) : (
          <TrendingDown className="w-6 h-6 text-red-400" />
        )}
        <div>
          <p className="text-xs text-neutral-400">S&P 500 Index</p>
          <p className="text-2xl font-bold text-white">{sp500.price.toFixed(2)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-neutral-500">Variação Diária</p>
          <p className={`text-lg font-bold ${sp500.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {sp500.changePercent >= 0 ? '+' : ''}{sp500.changePercent.toFixed(2)}%
          </p>
        </div>
        <div>
          <p className="text-xs text-neutral-500">Fonte</p>
          <p className="text-sm font-bold text-white">
            {sp500.source === 'mt5' ? '🟢 MT5' : '🟡 Fallback'}
          </p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-white/10">
        <p className="text-xs text-neutral-500">
          Atualizado: {new Date(sp500.timestamp).toLocaleTimeString('pt-BR')}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// EXEMPLO 3: Hook de Símbolo Específico
// ============================================================================

export function ExemploPrecoBTC() {
  const btcPrice = useSymbolPrice('BTC');

  if (!btcPrice) {
    return (
      <div className="p-4 bg-neutral-900 rounded-lg">
        <div className="animate-pulse">
          <div className="h-4 bg-neutral-700 rounded w-20 mb-2"></div>
          <div className="h-8 bg-neutral-700 rounded w-32"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-800">
      <div className="flex items-center gap-3 mb-3">
        <DollarSign className="w-6 h-6 text-amber-400" />
        <div>
          <p className="text-xs text-neutral-400">Bitcoin (BTC)</p>
          <p className="text-2xl font-bold text-white">${btcPrice.price.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-xs text-neutral-500">Bid</p>
          <p className="text-sm font-bold text-emerald-400">${btcPrice.bid.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-neutral-500">Ask</p>
          <p className="text-sm font-bold text-red-400">${btcPrice.ask.toLocaleString()}</p>
        </div>
      </div>

      <div className="p-2 bg-neutral-800 rounded">
        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-500">Spread:</span>
          <span className="text-xs font-bold text-white">
            ${btcPrice.spread.toFixed(2)} ({((btcPrice.spread / btcPrice.price) * 100).toFixed(3)}%)
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className={`text-xs font-bold ${
          btcPrice.source === 'mt5' ? 'text-emerald-400' : 'text-amber-400'
        }`}>
          {btcPrice.source === 'mt5' ? '✅ Dados Reais MT5' : '⚠️ Dados Fallback'}
        </div>
        <div className={`w-2 h-2 rounded-full ${
          btcPrice.isValid ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
        }`} />
      </div>
    </div>
  );
}

// ============================================================================
// EXEMPLO 4: Correlação BTC/S&P 500 (Para AI Preditiva)
// ============================================================================

export function ExemploCorrelacao() {
  const btcPrice = useSymbolPrice('BTC');
  const sp500 = useSP500();

  if (!btcPrice || !sp500) {
    return <div>Carregando dados...</div>;
  }

  // Calcular correlação simples (exemplo didático)
  const btcChange = Math.random() * 4 - 2; // Simulado
  const sp500Change = sp500.changePercent;
  
  const sameDirection = (btcChange > 0 && sp500Change > 0) || (btcChange < 0 && sp500Change < 0);
  const correlationStrength = Math.abs(btcChange - sp500Change) < 1 ? 'FORTE' : 'MODERADA';

  return (
    <div className="p-6 bg-gradient-to-br from-cyan-900/20 to-purple-900/20 rounded-lg border border-cyan-500/30">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-5 h-5 text-cyan-400" />
        <h3 className="text-lg font-bold text-white">Correlação BTC/S&P 500</h3>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="p-3 bg-black/20 rounded-lg">
          <p className="text-xs text-neutral-400 mb-1">Bitcoin</p>
          <p className="text-xl font-bold text-white">${btcPrice.price.toLocaleString()}</p>
          <p className={`text-sm font-bold ${btcChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {btcChange >= 0 ? '+' : ''}{btcChange.toFixed(2)}%
          </p>
        </div>

        <div className="p-3 bg-black/20 rounded-lg">
          <p className="text-xs text-neutral-400 mb-1">S&P 500</p>
          <p className="text-xl font-bold text-white">{sp500.price.toFixed(2)}</p>
          <p className={`text-sm font-bold ${sp500Change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {sp500Change >= 0 ? '+' : ''}{sp500Change.toFixed(2)}%
          </p>
        </div>
      </div>

      <div className={`p-4 rounded-lg border ${
        sameDirection
          ? 'bg-emerald-500/10 border-emerald-500/30'
          : 'bg-red-500/10 border-red-500/30'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-400">Status da Correlação</p>
            <p className={`text-lg font-bold ${sameDirection ? 'text-emerald-400' : 'text-red-400'}`}>
              {sameDirection ? 'ALINHADOS' : 'DIVERGINDO'}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-400">Força</p>
            <p className="text-lg font-bold text-white">{correlationStrength}</p>
          </div>
        </div>
      </div>

      <p className="text-xs text-neutral-500 mt-3">
        {sameDirection
          ? '✅ BTC e S&P 500 movendo na mesma direção - correlação positiva'
          : '⚠️ BTC e S&P 500 movendo em direções opostas - possível oportunidade de hedge'}
      </p>
    </div>
  );
}

// ============================================================================
// EXEMPLO 5: Validação de Preço (Comparar fontes)
// ============================================================================

export function ExemploValidacao() {
  const { getPrice } = useMarketData();
  const btcPrice = getPrice('BTC');
  
  // Simular preço de outra fonte (ex: Binance)
  const binancePrice = 96520.00;

  if (!btcPrice) return <div>Carregando...</div>;

  const difference = Math.abs(btcPrice.price - binancePrice);
  const differencePercent = (difference / btcPrice.price) * 100;
  const isAccurate = differencePercent < 0.1;

  return (
    <div className="p-6 bg-neutral-900 rounded-lg border border-neutral-800">
      <h3 className="text-lg font-bold mb-4">Validação de Preços</h3>

      <div className="space-y-3">
        {/* MT5 Price */}
        <div className="p-3 bg-emerald-900/20 border border-emerald-500/30 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-neutral-400">MT5 (MetaAPI)</p>
              <p className="text-xl font-bold text-white">${btcPrice.price.toFixed(2)}</p>
            </div>
            <div className="text-xs font-bold text-emerald-400">
              {btcPrice.source === 'mt5' ? 'REAL' : 'FALLBACK'}
            </div>
          </div>
        </div>

        {/* Binance Price (Simulado) */}
        <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-neutral-400">Binance (Simulado)</p>
              <p className="text-xl font-bold text-white">${binancePrice.toFixed(2)}</p>
            </div>
            <div className="text-xs font-bold text-blue-400">API</div>
          </div>
        </div>

        {/* Comparação */}
        <div className={`p-4 rounded-lg border ${
          isAccurate
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : 'bg-amber-500/10 border-amber-500/30'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-white">Diferença</span>
            <span className={`text-lg font-bold ${isAccurate ? 'text-emerald-400' : 'text-amber-400'}`}>
              ${difference.toFixed(2)} ({differencePercent.toFixed(3)}%)
            </span>
          </div>
          <p className="text-xs text-neutral-400">
            {isAccurate
              ? '✅ Preços alinhados - diferença < 0.1%'
              : '⚠️ Divergência detectada - verificar fontes'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// EXEMPLO 6: Watchlist Dinâmica
// ============================================================================

export function ExemploWatchlist() {
  const { watchedSymbols, addSymbol, removeSymbol, getPrice } = useMarketData();
  const [newSymbol, setNewSymbol] = React.useState('');

  const handleAddSymbol = () => {
    if (newSymbol && !watchedSymbols.includes(newSymbol.toUpperCase())) {
      addSymbol(newSymbol.toUpperCase());
      setNewSymbol('');
    }
  };

  return (
    <div className="p-6 bg-neutral-900 rounded-lg">
      <h3 className="text-lg font-bold mb-4">Watchlist Personalizada</h3>

      {/* Adicionar Símbolo */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={newSymbol}
          onChange={(e) => setNewSymbol(e.target.value)}
          placeholder="Ex: AAPL, TSLA..."
          className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white"
        />
        <button
          onClick={handleAddSymbol}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded font-bold text-sm"
        >
          Adicionar
        </button>
      </div>

      {/* Lista de Símbolos */}
      <div className="space-y-2">
        {watchedSymbols.map(symbol => {
          const price = getPrice(symbol);
          return (
            <div key={symbol} className="flex items-center justify-between p-3 bg-neutral-800 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${
                  price?.source === 'mt5' ? 'bg-emerald-500' : 'bg-amber-500'
                }`} />
                <div>
                  <p className="text-sm font-bold text-white">{symbol}</p>
                  {price && (
                    <p className="text-xs text-neutral-400">${price.price.toFixed(2)}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => removeSymbol(symbol)}
                className="px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-xs font-bold"
              >
                Remover
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// EXPORT ALL
// ============================================================================

export const MarketDataExamples = {
  HookCompleto: ExemploHookCompleto,
  SP500: ExemploSP500,
  PrecoBTC: ExemploPrecoBTC,
  Correlacao: ExemploCorrelacao,
  Validacao: ExemploValidacao,
  Watchlist: ExemploWatchlist
};
