/**
 * 🏔️ NEURAL DAY TRADER - PYRAMIDING EXAMPLE
 * 
 * Exemplo completo de como integrar o sistema de Pyramiding
 * Este arquivo serve como referência para integração no TradingPanel.tsx
 */

import React, { useState, useEffect } from 'react';
import { PyramidingConfigPanel, DEFAULT_PYRAMIDING_CONFIG, type PyramidingConfig } from './PyramidingConfigPanel';
import { PyramidingVisualizer } from './PyramidingVisualizer';
import { PyramidingMonitor } from './PyramidingMonitor';
import { pyramidingManager, type PyramidPosition, type PyramidLayer } from '@/app/services/pyramidingManager';
import { Play, Pause, X } from 'lucide-react';

export function PyramidingExample() {
  const [config, setConfig] = useState<PyramidingConfig>(DEFAULT_PYRAMIDING_CONFIG);
  const [activePyramid, setActivePyramid] = useState<PyramidPosition | null>(null);
  const [currentPrice, setCurrentPrice] = useState(1.10000);
  const [isSimulating, setIsSimulating] = useState(false);

  // ========== SIMULAÇÃO DE PREÇO (para demonstração) ==========
  useEffect(() => {
    if (!isSimulating || !activePyramid) return;

    const interval = setInterval(() => {
      // Simular movimento de preço (tendência de alta)
      setCurrentPrice(prev => {
        const change = (Math.random() - 0.4) * 0.0001; // Bias de alta
        return prev + change;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isSimulating, activePyramid]);

  // ========== ATUALIZAR PYRAMID CONFORME PREÇO MUDA ==========
  useEffect(() => {
    if (!activePyramid) return;

    // Atualizar PnL de cada layer
    const updatedLayers = activePyramid.layers.map(layer => {
      const direction = activePyramid.basePosition.direction;
      const pnl = direction === 'long'
        ? (currentPrice - layer.entryPrice) * layer.size * 100000
        : (layer.entryPrice - currentPrice) * layer.size * 100000;
      
      const pnlPercent = direction === 'long'
        ? ((currentPrice - layer.entryPrice) / layer.entryPrice) * 100
        : ((layer.entryPrice - currentPrice) / layer.entryPrice) * 100;

      return {
        ...layer,
        pnl,
        pnlPercent
      };
    });

    // Atualizar trailing stops
    const layersWithTrailing = pyramidingManager.updateTrailingStops(
      activePyramid,
      currentPrice
    );

    // Calcular totais
    const totalPnL = updatedLayers.reduce((sum, l) => sum + l.pnl, 0);
    const totalSize = updatedLayers.reduce((sum, l) => sum + l.size, 0);
    const averageEntry = updatedLayers.reduce((sum, l) => sum + (l.entryPrice * l.size), 0) / totalSize;
    const totalPnLPercent = ((currentPrice - averageEntry) / averageEntry) * 100;

    setActivePyramid({
      ...activePyramid,
      layers: layersWithTrailing.length > 0 ? layersWithTrailing : updatedLayers,
      totalSize,
      averageEntry,
      totalPnL,
      totalPnLPercent
    });

    // Verificar se pode adicionar mais layers
    checkAndAddLayer();
  }, [currentPrice]);

  // ========== VERIFICAR E ADICIONAR LAYER ==========
  const checkAndAddLayer = async () => {
    if (!activePyramid || !config.enabled) return;
    if (activePyramid.layers.length >= config.maxLayers) return;

    const lastLayer = activePyramid.layers[activePyramid.layers.length - 1];
    const direction = activePyramid.basePosition.direction;
    
    // Calcular distância necessária
    const requiredDistance = pyramidingManager.calculateNextEntryDistance(
      config,
      currentPrice,
      0.0001 // ATR simulado
    );

    // Verificar se preço moveu o suficiente
    const currentDistance = direction === 'long'
      ? currentPrice - lastLayer.entryPrice
      : lastLayer.entryPrice - currentPrice;

    if (currentDistance < requiredDistance) return;

    // Análise de AI
    const aiAnalysis = await pyramidingManager.analyzeRisk(
      activePyramid.basePosition.symbol,
      direction,
      currentPrice,
      config
    );

    if (!aiAnalysis.canAddPosition) {
      console.log('[Pyramiding] AI bloqueou add:', aiAnalysis.reason);
      setActivePyramid({
        ...activePyramid,
        aiAnalysis,
        canAddMore: false
      });
      return;
    }

    // ✅ ADICIONAR NOVO LAYER
    const nextLayerNumber = activePyramid.layers.length + 1;
    const size = pyramidingManager.calculateNextPositionSize(config, nextLayerNumber);
    
    const stopDistance = config.trailingStopDistance * 0.0001;
    const stopLoss = direction === 'long'
      ? currentPrice - stopDistance
      : currentPrice + stopDistance;

    const newLayer: PyramidLayer = {
      layerNumber: nextLayerNumber,
      entryPrice: currentPrice,
      size,
      stopLoss,
      trailingStop: stopLoss,
      entryTime: Date.now(),
      pnl: 0,
      pnlPercent: 0,
      status: 'active'
    };

    console.log('✅ [Pyramiding] Adicionando Layer #', nextLayerNumber, 'em', currentPrice);

    setActivePyramid({
      ...activePyramid,
      layers: [...activePyramid.layers, newLayer],
      lastAddTime: Date.now(),
      aiAnalysis,
      canAddMore: nextLayerNumber < config.maxLayers
    });
  };

  // ========== INICIAR POSIÇÃO ==========
  const startPosition = async () => {
    const direction = 'long'; // Simular long
    const entryPrice = currentPrice;
    const size = config.initialSize;
    
    const stopDistance = config.trailingStopDistance * 0.0001;
    const stopLoss = direction === 'long'
      ? entryPrice - stopDistance
      : entryPrice + stopDistance;

    // Primeira layer
    const firstLayer: PyramidLayer = {
      layerNumber: 1,
      entryPrice,
      size,
      stopLoss,
      trailingStop: stopLoss,
      entryTime: Date.now(),
      pnl: 0,
      pnlPercent: 0,
      status: 'active'
    };

    // AI Analysis inicial
    const aiAnalysis = await pyramidingManager.analyzeRisk(
      'EURUSD',
      direction,
      currentPrice,
      config
    );

    const pyramid: PyramidPosition = {
      basePosition: {
        id: 'demo-1',
        symbol: 'EURUSD',
        direction,
        entryPrice,
        currentPrice,
        size,
        stopLoss,
        takeProfit: entryPrice + 0.01,
        openTime: Date.now(),
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0
      },
      layers: [firstLayer],
      totalSize: size,
      averageEntry: entryPrice,
      totalPnL: 0,
      totalPnLPercent: 0,
      config,
      lastAddTime: Date.now(),
      canAddMore: true,
      aiAnalysis
    };

    setActivePyramid(pyramid);
    setIsSimulating(true);
    console.log('🚀 [Pyramiding] Posição iniciada em', entryPrice);
  };

  // ========== FECHAR POSIÇÃO ==========
  const closePosition = () => {
    setActivePyramid(null);
    setIsSimulating(false);
    console.log('🛑 [Pyramiding] Posição fechada');
  };

  return (
    <div className="min-h-screen bg-black p-6 space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          🏔️ Pyramiding System - <span className="text-amber-400">Demo</span>
        </h1>
        <p className="text-slate-400">
          Sistema completo de Position Scaling com AI Risk Management
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        {!activePyramid ? (
          <button
            onClick={startPosition}
            disabled={!config.enabled}
            className="px-6 py-3 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-xl text-emerald-400 font-bold flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-5 h-5" />
            Iniciar Posição Demo
          </button>
        ) : (
          <>
            <button
              onClick={() => setIsSimulating(!isSimulating)}
              className={`px-6 py-3 border rounded-xl font-bold flex items-center gap-2 transition-all ${
                isSimulating
                  ? 'bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-500/30 text-yellow-400'
                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/30 text-emerald-400'
              }`}
            >
              {isSimulating ? (
                <>
                  <Pause className="w-5 h-5" />
                  Pausar Simulação
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Retomar Simulação
                </>
              )}
            </button>

            <button
              onClick={closePosition}
              className="px-6 py-3 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 rounded-xl text-rose-400 font-bold flex items-center gap-2 transition-all"
            >
              <X className="w-5 h-5" />
              Fechar Posição
            </button>
          </>
        )}
      </div>

      {/* Configuration Panel */}
      <PyramidingConfigPanel
        config={config}
        onChange={setConfig}
      />

      {/* Visualizer (só aparece se tiver posição) */}
      {activePyramid && (
        <PyramidingVisualizer
          layers={activePyramid.layers}
          currentPrice={currentPrice}
          direction={activePyramid.basePosition.direction}
          averageEntry={activePyramid.averageEntry}
          totalPnL={activePyramid.totalPnL}
          totalPnLPercent={activePyramid.totalPnLPercent}
          totalSize={activePyramid.totalSize}
          aiRiskScore={activePyramid.aiAnalysis.momentum.score}
        />
      )}

      {/* Monitor (floating, só aparece se tiver posição) */}
      {activePyramid && (
        <PyramidingMonitor
          pyramid={activePyramid}
          currentPrice={currentPrice}
        />
      )}

      {/* Instruções */}
      <div className="max-w-4xl mx-auto bg-blue-500/10 border border-blue-500/30 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-blue-400 mb-4">📖 Como Usar</h3>
        <div className="space-y-3 text-sm text-blue-300">
          <div className="flex gap-3">
            <span className="text-blue-400 font-bold">1.</span>
            <p>Configure o Pyramiding no painel acima (estratégia, layers, stops, etc)</p>
          </div>
          <div className="flex gap-3">
            <span className="text-blue-400 font-bold">2.</span>
            <p>Clique em "Iniciar Posição Demo" para simular uma entrada LONG em EURUSD</p>
          </div>
          <div className="flex gap-3">
            <span className="text-blue-400 font-bold">3.</span>
            <p>O preço vai se mover automaticamente (com bias de alta)</p>
          </div>
          <div className="flex gap-3">
            <span className="text-blue-400 font-bold">4.</span>
            <p>A AI vai analisar e adicionar layers automaticamente quando seguro</p>
          </div>
          <div className="flex gap-3">
            <span className="text-blue-400 font-bold">5.</span>
            <p>Observe o Monitor (canto inferior direito) para acompanhar tudo em tempo real</p>
          </div>
          <div className="flex gap-3">
            <span className="text-blue-400 font-bold">6.</span>
            <p>Use "Pausar" para congelar a simulação e analisar melhor</p>
          </div>
        </div>
      </div>
    </div>
  );
}
