import React, { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { LunaInteractionSettings } from './LunaInteractionSettings';
import { MarketTendencyPanel } from './MarketTendencyPanel';

type OperationMode = 'solo' | 'hibrido' | 'automatico';
type ViewMode = 'chart' | 'tendency';

interface NexusProps {
  activeSymbol?: string;
  timeframe?: string;
  currentPrice?: number;
  dailyChangePercent?: number;
}

export function NexusQuantumAdvisor({ 
  activeSymbol = 'EUR/USD',
  timeframe = '15m',
  currentPrice = 1.10652,
  dailyChangePercent = 0
}: NexusProps) {
  const [mode, setMode] = useState<OperationMode>('hibrido');
  const [viewMode, setViewMode] = useState<ViewMode>('tendency'); // 🔥 NOVO: Mostrar tendência por padrão
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <div className="bg-[#0A0A0A] rounded-xl border border-white/10 h-full flex flex-col overflow-hidden">
        {/* HEADER - EXATAMENTE COMO A IMAGEM */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0f0f0f]">
          {/* Logo + Título (ESQUERDA) */}
          <div className="flex items-center gap-3">
            {/* Ícone de Átomo/Molécula CYAN */}
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="shrink-0">
              <circle cx="16" cy="16" r="3" fill="#06b6d4" />
              <ellipse cx="16" cy="16" rx="13" ry="6" stroke="#06b6d4" strokeWidth="2" fill="none" transform="rotate(60 16 16)" />
              <ellipse cx="16" cy="16" rx="13" ry="6" stroke="#06b6d4" strokeWidth="2" fill="none" transform="rotate(-60 16 16)" />
              <ellipse cx="16" cy="16" rx="13" ry="6" stroke="#06b6d4" strokeWidth="2" fill="none" />
            </svg>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Nexus Quantum Advisor
            </h2>
          </div>
          
          {/* Badge SPOOFING DETECTADO (CENTRO) */}
          <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-red-900/30 text-red-400 border border-red-500/50">
            <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wide">Spoofing Detectado</span>
          </div>

          {/* Modos + View Toggle + Configurações (DIREITA) */}
          <div className="flex items-center gap-3">
            {/* 🔥 NOVO: Toggle Chart/Tendency */}
            <div className="flex items-center gap-1 p-1 bg-black/30 rounded-lg border border-white/10">
              <button
                onClick={() => setViewMode('chart')}
                className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all ${
                  viewMode === 'chart'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                    : 'text-neutral-500 hover:text-neutral-400'
                }`}
              >
                Gráfico
              </button>
              <button
                onClick={() => setViewMode('tendency')}
                className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all ${
                  viewMode === 'tendency'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                    : 'text-neutral-500 hover:text-neutral-400'
                }`}
              >
                Tendência
              </button>
            </div>

            {/* Botão de Configurações da Luna */}
            <button
              onClick={() => setShowSettings(true)}
              className="p-2.5 rounded-lg bg-gradient-to-br from-cyan-500/10 to-purple-500/10 hover:from-cyan-500/20 hover:to-purple-500/20 border border-cyan-500/30 hover:border-cyan-500/50 transition-all group"
              title="Configurações da Luna"
            >
              <Settings className="w-4 h-4 text-cyan-400 group-hover:rotate-90 transition-transform duration-300" />
            </button>

            {(['solo', 'hibrido', 'automatico'] as OperationMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  mode === m
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                    : 'text-neutral-500 border-0'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* CONTEÚDO DINÂMICO - GRÁFICO OU TENDÊNCIA */}
        <div className="flex-1 relative overflow-auto">
          {viewMode === 'chart' ? (
            <div className="h-full bg-[#0d1117]">
              <TradingViewChart 
                symbol={activeSymbol}
                currentPrice={currentPrice}
                timeframe={timeframe}
              />
            </div>
          ) : (
            <div className="h-full p-4">
              <MarketTendencyPanel 
                symbol={activeSymbol}
                currentPrice={currentPrice}
                timeframe={timeframe}
                volume={1000000}
              />
            </div>
          )}
        </div>
      </div>

      {/* Modal de Configurações da Luna */}
      <LunaInteractionSettings 
        isOpen={showSettings}
        onClose={() => setShowSettings(false)} 
      />
    </>
  );
}

function TradingViewChart({ symbol, currentPrice, timeframe }: {
  symbol: string;
  currentPrice: number;
  timeframe: string;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;

    // Fundo
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, W, H);

    const PAD = { top: 20, right: 80, bottom: 50, left: 40 };
    const chartW = W - PAD.left - PAD.right;
    const chartH = H - PAD.top - PAD.bottom;

    // 150 candlesticks FINOS
    const numCandles = 150;
    const candleW = 3;
    const gap = 1;
    const totalW = candleW + gap;

    // Gerar dados
    const basePrice = currentPrice || 1.10652;
    const candles = [];
    for (let i = 0; i < numCandles; i++) {
      const trend = Math.sin(i / 20) * 0.004 - 0.002;
      const noise = (Math.random() - 0.5) * 0.002;
      const open = basePrice + trend + noise;
      const close = open + (Math.random() - 0.5) * 0.003;
      const high = Math.max(open, close) + Math.random() * 0.0015;
      const low = Math.min(open, close) - Math.random() * 0.0015;
      candles.push({ open, high, low, close });
    }

    const allPrices = candles.flatMap(c => [c.high, c.low]);
    const minP = Math.min(...allPrices);
    const maxP = Math.max(...allPrices);
    const rangeP = maxP - minP;
    const margin = rangeP * 0.1;

    const priceToY = (p: number) => {
      return PAD.top + chartH - ((p - (minP - margin)) / (rangeP + 2 * margin)) * chartH;
    };

    // Grid horizontal
    ctx.strokeStyle = '#1a1f2e';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 6; i++) {
      const y = PAD.top + (chartH / 6) * i;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(W - PAD.right, y);
      ctx.stroke();
    }

    // Eixo Y (preços)
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    for (let i = 0; i <= 6; i++) {
      const price = (maxP + margin) - ((rangeP + 2 * margin) / 6) * i;
      const y = PAD.top + (chartH / 6) * i;
      ctx.fillText(price.toFixed(5), W - PAD.right + 10, y + 3);
    }

    // Heatmaps (ATRÁS)
    const heatmaps = [
      { start: 40, width: 100, color: '#4c0000', alpha: 0.3 },
      { start: 90, width: 80, color: '#004c1a', alpha: 0.25 }
    ];
    heatmaps.forEach(({ start, width, color, alpha }) => {
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.fillRect(PAD.left + start * totalW, PAD.top, width, chartH);
      ctx.globalAlpha = 1;
    });

    // Candlesticks (VERDE e LARANJA)
    candles.forEach((c, i) => {
      const x = PAD.left + i * totalW;
      const yO = priceToY(c.open);
      const yC = priceToY(c.close);
      const yH = priceToY(c.high);
      const yL = priceToY(c.low);

      const bull = c.close > c.open;
      const color = bull ? '#10b981' : '#fb923c';

      // Pavio
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + candleW / 2, yH);
      ctx.lineTo(x + candleW / 2, yL);
      ctx.stroke();

      // Corpo
      ctx.fillStyle = color;
      const bodyH = Math.abs(yC - yO);
      ctx.fillRect(x, Math.min(yO, yC), candleW, Math.max(bodyH, 1));
    });

    // Médias móveis
    const drawMA = (period: number, color: string, lineW: number, dots: boolean) => {
      const ma = candles.map((_, i) => {
        if (i < period - 1) return null;
        const sum = candles.slice(i - period + 1, i + 1).reduce((a, c) => a + c.close, 0);
        return sum / period;
      });

      ctx.strokeStyle = color;
      ctx.lineWidth = lineW;
      ctx.beginPath();
      let first = true;
      ma.forEach((p, i) => {
        if (p === null) return;
        const x = PAD.left + i * totalW + candleW / 2;
        const y = priceToY(p);
        if (first) {
          ctx.moveTo(x, y);
          first = false;
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();

      if (dots) {
        ma.forEach((p, i) => {
          if (p === null || i % 8 !== 0) return;
          const x = PAD.left + i * totalW + candleW / 2;
          const y = priceToY(p);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    };

    drawMA(20, '#06b6d4', 2.5, true);  // Cyan
    drawMA(50, '#fbbf24', 2, false);   // Amarelo

    // Escudos (pequenos)
    const shields = [15, 35, 55];
    shields.forEach(idx => {
      if (idx >= candles.length) return;
      const x = PAD.left + idx * totalW + candleW / 2;
      const y = priceToY(candles[idx].high) - 15;
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('🛡️', x, y);
    });

    // Seta tracejada
    const lastIdx = candles.length - 1;
    const lastX = PAD.left + lastIdx * totalW + candleW / 2;
    const lastY = priceToY(candles[lastIdx].close);
    const targetY = priceToY(candles[lastIdx].close * 0.998);
    const endX = lastX + 80;

    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(endX, targetY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Seta
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.moveTo(endX, targetY);
    ctx.lineTo(endX - 6, targetY - 4);
    ctx.lineTo(endX - 6, targetY + 4);
    ctx.fill();

    // Badge CYAN com preço
    const badgeX = endX + 10;
    const badgeY = targetY;
    const priceText = candles[lastIdx].close.toFixed(5);
    
    ctx.fillStyle = '#06b6d4';
    ctx.fillRect(badgeX - 5, badgeY - 14, 75, 28);
    
    ctx.fillStyle = '#000';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(priceText, badgeX, badgeY + 4);

    // Horários (eixo X)
    ctx.fillStyle = '#6b7280';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    const times = ['15:00', '16:00', '17:00', '18:00'];
    const step = chartW / (times.length - 1);
    times.forEach((t, i) => {
      const x = PAD.left + step * i;
      ctx.fillText(t, x, H - PAD.bottom + 25);
    });

  }, [symbol, currentPrice, timeframe]);

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full" style={{ width: '100%', height: '100%' }} />
      
      {/* Box Spoofing (topo direito) */}
      <div className="absolute top-4 right-4 bg-red-900/80 backdrop-blur-sm text-white px-4 py-3 rounded-2xl border border-red-500/50 max-w-[280px] shadow-[0_8px_32px_rgba(220,38,38,0.5)]">
        <div className="text-xs font-bold uppercase tracking-wide text-red-200 mb-1">
          Spoofing Detectado:
        </div>
        <div className="text-sm text-gray-100">
          Ordem fantasma. Pressão artificial de venda.
        </div>
      </div>
      
      {/* Box Correlação (embaixo esquerda) */}
      <div className="absolute bottom-4 left-4 bg-cyan-900/80 backdrop-blur-sm text-white px-4 py-3 rounded-2xl border border-cyan-500/50 max-w-[280px] shadow-[0_8px_32px_rgba(6,182,212,0.5)]">
        <div className="text-xs font-bold uppercase tracking-wide text-cyan-200 mb-1">
          Correlação Borboleta:
        </div>
        <div className="text-sm text-gray-100">
          Movimento US10Y indica queda iminente.
        </div>
      </div>
    </div>
  );
}