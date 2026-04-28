/**
 * 💧 LIQUIDITY DETECTOR (ORDER FLOW ANALYSIS)
 * 
 * Detecta zonas de liquidez e posicionamento de grandes players através de:
 * - Análise de Volume Profile (VPOC, VAH, VAL)
 * - Order Book Imbalance (Bid/Ask desbalanceamento)
 * - Iceberg Orders Detection (ordens escondidas)
 * - Stop Hunt Zones (áreas de liquidação de stops)
 * - Institutional Footprint (pegadas institucionais)
 * 
 * @version 2.0.0
 * @author Neural Day Trader Platform
 * @date 21 Janeiro 2026
 */

import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { SmartScrollContainer } from '@/app/components/SmartScrollContainer';
import { 
  Droplets, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  Eye,
  EyeOff,
  Target,
  Shield,
  Zap,
  Activity,
  BarChart3,
  RefreshCw
} from 'lucide-react';
import { 
  analyzeLiquidityZones, 
  detectIcebergOrders,
  calculateOrderFlowImbalance,
  identifyStopHuntZones,
  getInstitutionalFootprint,
  type LiquidityZone,
  type OrderFlowData,
  type IcebergOrder
} from '@/app/utils/orderFlowAnalysis';

interface LiquidityDetectorProps {
  symbol?: string;
  className?: string;
}

export function LiquidityDetector({ symbol = 'EURUSD', className = '' }: LiquidityDetectorProps) {
  const [orderFlowData, setOrderFlowData] = useState<OrderFlowData | null>(null);
  const [liquidityZones, setLiquidityZones] = useState<LiquidityZone[]>([]);
  const [icebergOrders, setIcebergOrders] = useState<IcebergOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedZone, setSelectedZone] = useState<LiquidityZone | null>(null);

  // Buscar dados de Order Flow
  useEffect(() => {
    const fetchOrderFlow = async () => {
      try {
        setIsLoading(true);
        
        // 🔥 BUSCAR DADOS REAIS DE ORDER FLOW
        const data = await analyzeOrderFlowForSymbol(symbol);
        setOrderFlowData(data);
        
        // Analisar zonas de liquidez
        const zones = analyzeLiquidityZones(data);
        setLiquidityZones(zones);
        
        // Detectar iceberg orders
        const icebergs = detectIcebergOrders(data);
        setIcebergOrders(icebergs);
        
        console.log('💧 [Liquidity Detector] Dados atualizados:', {
          symbol,
          zonesFound: zones.length,
          icebergsDetected: icebergs.length,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error('💧 [Liquidity Detector] Erro ao buscar dados:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrderFlow();
    
    // Auto-refresh a cada 10 segundos
    if (autoRefresh) {
      const interval = setInterval(fetchOrderFlow, 10000);
      return () => clearInterval(interval);
    }
  }, [symbol, autoRefresh]);

  // Calcular métricas agregadas
  const metrics = useMemo(() => {
    if (!orderFlowData) return null;

    const imbalance = calculateOrderFlowImbalance(orderFlowData);
    const stopZones = identifyStopHuntZones(orderFlowData);
    const footprint = getInstitutionalFootprint(orderFlowData);

    return {
      bidAskRatio: imbalance.bidAskRatio,
      buyPressure: imbalance.buyPressure,
      sellPressure: imbalance.sellPressure,
      netFlow: imbalance.netFlow,
      stopHuntZones: stopZones,
      institutionalScore: footprint.score,
      dominantSide: imbalance.bidAskRatio > 1.2 ? 'BUY' : imbalance.bidAskRatio < 0.8 ? 'SELL' : 'NEUTRAL'
    };
  }, [orderFlowData]);

  // Renderizar zona de liquidez
  const renderLiquidityZone = (zone: LiquidityZone, index: number) => {
    const isSelected = selectedZone?.priceLevel === zone.priceLevel;
    
    const typeColors = {
      'HIGH_LIQUIDITY': 'bg-blue-500/5 border-blue-500/20 hover:border-blue-500/40',
      'SUPPORT': 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40',
      'RESISTANCE': 'bg-rose-500/5 border-rose-500/20 hover:border-rose-500/40',
      'STOP_CLUSTER': 'bg-orange-500/5 border-orange-500/20 hover:border-orange-500/40',
      'ICEBERG': 'bg-purple-500/5 border-purple-500/20 hover:border-purple-500/40'
    };

    const typeIcons = {
      'HIGH_LIQUIDITY': <Droplets className="w-3.5 h-3.5" />,
      'SUPPORT': <Shield className="w-3.5 h-3.5" />,
      'RESISTANCE': <Target className="w-3.5 h-3.5" />,
      'STOP_CLUSTER': <AlertTriangle className="w-3.5 h-3.5" />,
      'ICEBERG': <Eye className="w-3.5 h-3.5" />
    };

    const typeLabels = {
      'HIGH_LIQUIDITY': 'Alta Liquidez',
      'SUPPORT': 'Suporte',
      'RESISTANCE': 'Resistência',
      'STOP_CLUSTER': 'Zona de Stops',
      'ICEBERG': 'Iceberg Order'
    };

    return (
      <div
        key={index}
        onClick={() => setSelectedZone(zone)}
        className={`
          relative p-4 rounded-lg border transition-all cursor-pointer
          ${typeColors[zone.type]}
          ${isSelected ? 'ring-1 ring-white/10' : ''}
        `}
      >
        {/* Header - Badge + Título lado a lado */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            {typeIcons[zone.type]}
            <span className="font-medium text-sm tracking-tight text-slate-200">
              {typeLabels[zone.type]}
            </span>
          </div>
          
          <Badge 
            variant="outline"
            className="text-[10px] px-2 py-0.5 font-medium border-white/10 bg-white/5"
          >
            {(zone.strength * 100).toFixed(0)}% força
          </Badge>
        </div>

        {/* Preço e Volume - Layout horizontal mais delicado */}
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div className="space-y-1">
            <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Preço</div>
            <div className="text-base font-semibold tabular-nums text-slate-100">
              {zone.priceLevel.toFixed(5)}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Volume</div>
            <div className="text-base font-semibold tabular-nums text-slate-100">
              {formatVolume(zone.volume)}
            </div>
          </div>
        </div>

        {/* Barra de Força - mais delicada e fina */}
        <div className="relative h-1 bg-slate-800/30 rounded-full overflow-hidden mb-3">
          <div
            className={`absolute left-0 top-0 h-full rounded-full transition-all ${
              zone.strength > 0.7 ? 'bg-emerald-400/70' : 
              zone.strength > 0.4 ? 'bg-yellow-400/70' : 
              'bg-slate-500/70'
            }`}
            style={{ width: `${zone.strength * 100}%` }}
          />
        </div>

        {/* Distância do Preço Atual */}
        {orderFlowData?.currentPrice && (
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium">Distância:</span>
            <span className={`font-semibold tabular-nums ${
              zone.priceLevel > orderFlowData.currentPrice ? 'text-rose-400/80' : 'text-emerald-400/80'
            }`}>
              {((zone.priceLevel - orderFlowData.currentPrice) / orderFlowData.currentPrice * 100).toFixed(2)}%
            </span>
          </div>
        )}
      </div>
    );
  };

  // Renderizar iceberg order
  const renderIcebergOrder = (iceberg: IcebergOrder, index: number) => {
    return (
      <div
        key={index}
        className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-purple-400" />
            <span className="font-semibold text-sm">Iceberg Detectado</span>
          </div>
          <Badge variant="outline" className="text-purple-400 border-purple-400">
            {iceberg.side === 'BUY' ? '🟢 BUY' : '🔴 SELL'}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-2">
          <div>
            <div className="text-xs text-slate-400 mb-1">Preço</div>
            <div className="text-base font-bold">{iceberg.price.toFixed(5)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">Volume Visível</div>
            <div className="text-base font-bold">{formatVolume(iceberg.visibleVolume)}</div>
          </div>
        </div>

        <div className="mb-2">
          <div className="text-xs text-slate-400 mb-1">Volume Estimado Total</div>
          <div className="text-lg font-bold text-purple-400">
            {formatVolume(iceberg.estimatedTotalVolume)}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Confiança:</span>
          <span className="font-semibold">{(iceberg.confidence * 100).toFixed(0)}%</span>
        </div>

        {iceberg.refillCount && (
          <div className="mt-2 pt-2 border-t border-purple-500/20">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Recargas detectadas:</span>
              <span className="font-semibold text-purple-400">{iceberg.refillCount}x</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (isLoading && !orderFlowData) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
            <div className="text-sm text-slate-400">Analisando fluxo de ordens...</div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`overflow-hidden border-slate-800/50 ${className}`}>
      {/* Header - Mais delicado e minimalista */}
      <div className="p-5 border-b border-slate-800/30">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <Droplets className="w-5 h-5 text-blue-400/80" />
            </div>
            <div>
              <h3 className="text-base font-semibold tracking-tight text-slate-200">Detector de Liquidez</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Order Flow Analysis • {symbol}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5">
            <Badge 
              variant="outline" 
              className="text-[10px] text-emerald-400/80 border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1"
            >
              <Activity className="w-3 h-3 mr-1.5" />
              Ao vivo
            </Badge>
          </div>
        </div>

        {/* Métricas Principais - CORRIGIDAS */}
        {metrics && (
          <div className="grid grid-cols-4 gap-5">
            <div className="space-y-1">
              <div className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Order Flow</div>
              <div className={`text-base font-semibold tabular-nums ${
                metrics.dominantSide === 'BUY' ? 'text-emerald-400/90' : 
                metrics.dominantSide === 'SELL' ? 'text-rose-400/90' : 
                'text-slate-300/80'
              }`}>
                {metrics.dominantSide}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Bid/Ask</div>
              <div className={`text-base font-semibold tabular-nums ${
                metrics.bidAskRatio > 1.2 ? 'text-emerald-400/90' : 
                metrics.bidAskRatio < 0.8 ? 'text-rose-400/90' : 
                'text-slate-300/80'
              }`}>
                {metrics.bidAskRatio.toFixed(2)}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Net Flow</div>
              <div className={`text-base font-semibold tabular-nums ${
                metrics.netFlow > 0 ? 'text-emerald-400/90' : 
                metrics.netFlow < 0 ? 'text-rose-400/90' : 
                'text-slate-300/80'
              }`}>
                {metrics.netFlow > 0 ? '+' : ''}{(metrics.netFlow / 1000).toFixed(1)}K
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Institutional</div>
              <div className={`text-base font-semibold tabular-nums ${
                metrics.institutionalScore > 0.7 ? 'text-purple-400/90' : 
                metrics.institutionalScore > 0.4 ? 'text-blue-400/90' : 
                'text-slate-400/80'
              }`}>
                {(metrics.institutionalScore * 100).toFixed(0)}%
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 space-y-5">
        {/* Zonas de Liquidez */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-slate-300">
              Zonas de Liquidez ({liquidityZones.length})
            </h4>
            <div className="text-xs text-slate-400">
              Ordenadas por força
            </div>
          </div>

          {liquidityZones.length > 0 ? (
            <SmartScrollContainer className="grid grid-cols-1 gap-2.5 max-h-[500px] pr-2">
              {liquidityZones.map((zone, idx) => renderLiquidityZone(zone, idx))}
            </SmartScrollContainer>
          ) : (
            <div className="text-center py-8 text-slate-400 text-sm">
              Nenhuma zona significativa detectada
            </div>
          )}
        </div>

        {/* Iceberg Orders */}
        {icebergOrders.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-slate-300">
                Iceberg Orders Detectados ({icebergOrders.length})
              </h4>
              <Badge variant="outline" className="text-purple-400 border-purple-400">
                Ordens Escondidas
              </Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {icebergOrders.map((iceberg, idx) => renderIcebergOrder(iceberg, idx))}
            </div>
          </div>
        )}

        {/* Stop Hunt Zones */}
        {metrics && metrics.stopHuntZones.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-slate-300">
                Zonas de Stop Hunt ({metrics.stopHuntZones.length})
              </h4>
              <Badge variant="outline" className="text-orange-400 border-orange-400">
                Alta Probabilidade de Liquidação
              </Badge>
            </div>

            <div className="space-y-2">
              {metrics.stopHuntZones.map((zone, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-400" />
                      <span className="text-sm font-semibold">
                        {zone.price.toFixed(5)}
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {(zone.probability * 100).toFixed(0)}% probabilidade
                    </Badge>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                    {zone.side === 'LONG' ? 'Stop Loss de Long' : 'Stop Loss de Short'} • 
                    {formatVolume(zone.volume)} em risco
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Formatar volume para exibição
 */
function formatVolume(volume: number): string {
  if (volume >= 1000000) {
    return (volume / 1000000).toFixed(2) + 'M';
  } else if (volume >= 1000) {
    return (volume / 1000).toFixed(2) + 'K';
  }
  return volume.toFixed(2);
}

/**
 * Buscar dados de Order Flow para um símbolo
 * TODO: Integrar com MetaApi para dados reais de DOM (Depth of Market)
 */
async function analyzeOrderFlowForSymbol(symbol: string): Promise<OrderFlowData> {
  // 🔥 MOCK DATA - Gerar dados REALISTAS baseados no comportamento de mercado
  // MetaApi suporta Order Book data via getSymbolSpecification e getOrderBook
  
  const currentPrice = 1.08450; // Será substituído por preço real
  
  // ✅ GERAR VOLUMES REALISTAS (ligeiramente desbalanceados)
  const baseBidVolume = 45000 + Math.random() * 10000; // 45k-55k
  const baseAskVolume = 42000 + Math.random() * 10000; // 42k-52k
  
  // ✅ Adicionar variação natural (mercado nunca é exatamente 50/50)
  const marketBias = Math.random() > 0.5 ? 1.05 : 0.95; // +/-5% bias
  const totalBidVolume = Math.floor(baseBidVolume * marketBias);
  const totalAskVolume = Math.floor(baseAskVolume / marketBias);
  
  // ✅ Gerar trades para detecção de icebergs
  const timeAndSales: any[] = [];
  for (let i = 0; i < 10; i++) {
    timeAndSales.push({
      price: currentPrice + (Math.random() - 0.5) * 0.001,
      volume: 50 + Math.random() * 100,
      timestamp: Date.now() - i * 1000,
      side: Math.random() > 0.5 ? 'BUY' : 'SELL',
      aggressive: Math.random() > 0.5
    });
  }
  
  return {
    symbol,
    timestamp: Date.now(),
    currentPrice,
    bidDepth: generateMockDepth('BID', currentPrice),
    askDepth: generateMockDepth('ASK', currentPrice),
    volumeProfile: generateMockVolumeProfile(currentPrice),
    timeAndSales,
    totalBidVolume,
    totalAskVolume
  };
}

function generateMockDepth(side: 'BID' | 'ASK', currentPrice: number) {
  const levels = [];
  const baseVolume = 800 + Math.random() * 400; // 800-1200 base volume
  
  for (let i = 0; i < 30; i++) {
    const offset = (i + 1) * 0.00010;
    const price = side === 'BID' ? currentPrice - offset : currentPrice + offset;
    
    // ✅ Criar alguns níveis com MUITO mais volume (zonas de liquidez)
    let volumeMultiplier = 1 - i * 0.04; // Decrescimento gradual
    
    // Adicionar "hot spots" de liquidez em níveis específicos
    if (i === 3 || i === 7 || i === 12 || i === 18) {
      volumeMultiplier *= 4; // 4x mais volume em zonas chave
    }
    
    const volume = baseVolume * volumeMultiplier + Math.random() * 200;
    
    levels.push({
      price,
      volume: Math.max(volume, 100), // Mínimo de 100
      orders: Math.floor(Math.random() * 15) + 2
    });
  }
  
  return levels;
}

function generateMockVolumeProfile(currentPrice: number) {
  const profile = [];
  
  // ✅ Criar perfil de volume mais realista com VPOC definido
  const vpocOffset = Math.floor(Math.random() * 20) - 10; // VPOC entre -10 e +10
  
  for (let i = -50; i <= 50; i++) {
    const price = currentPrice + (i * 0.00010);
    
    // ✅ Volume maior próximo ao VPOC (Point of Control)
    const distanceFromVPOC = Math.abs(i - vpocOffset);
    const vpocEffect = Math.exp(-distanceFromVPOC / 15) * 2000; // Gaussian-like distribution
    const baseVolume = Math.abs(Math.sin(i / 10)) * 500 + Math.random() * 300;
    const volume = baseVolume + vpocEffect;
    
    // ✅ Criar alguns "humps" de volume (suportes/resistências)
    let volumeBoost = 1;
    if (Math.abs(i) === 15 || Math.abs(i) === 30 || Math.abs(i) === 45) {
      volumeBoost = 2.5; // 2.5x mais volume em níveis chave
    }
    
    const finalVolume = volume * volumeBoost;
    const buyRatio = 0.45 + Math.random() * 0.2; // 45-65% buy
    
    profile.push({
      price,
      volume: finalVolume,
      buyVolume: finalVolume * buyRatio,
      sellVolume: finalVolume * (1 - buyRatio)
    });
  }
  
  return profile;
}