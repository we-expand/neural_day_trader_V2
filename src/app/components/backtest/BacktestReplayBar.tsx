/**
 * 🎬 BACKTEST REPLAY BAR - REDESIGNED (Compact & Elegant)
 * 
 * Barra de controle COMPACTA (~50px altura) no rodapé do gráfico
 * Design minimalista e alinhado com a identidade visual
 * 
 * FEATURES:
 * - Ultra compacta e não intrusiva
 * - Controles essenciais inline
 * - Cores sutis e modernas
 */

import React, { useState } from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  RotateCcw,
  X,
  Calendar,
  Clock
} from 'lucide-react';
import { useBacktestReplay, ReplaySpeed } from '../../hooks/useBacktestReplay';
import { Timeframe } from '../../services/BacktestDataService';

interface BacktestReplayBarProps {
  onClose: () => void;
  onCandleChange?: (candle: any) => void;
}

export function BacktestReplayBar({ onClose, onCandleChange }: BacktestReplayBarProps) {
  const replay = useBacktestReplay();
  
  const [selectedDate, setSelectedDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  });
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('1m');

  // Formatar tempo (MM:SS)
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleStartReplay = async () => {
    const date = new Date(selectedDate);
    await replay.startReplay(date, selectedTimeframe);
  };

  const handleSpeedChange = () => {
    const speeds: ReplaySpeed[] = [0.5, 1, 2, 5, 10];
    const currentIndex = speeds.indexOf(replay.speed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    replay.setSpeed(speeds[nextIndex]);
  };

  React.useEffect(() => {
    if (replay.currentCandle && onCandleChange) {
      onCandleChange(replay.currentCandle);
    }
  }, [replay.currentCandle, onCandleChange]);

  const isActive = replay.state !== 'idle';
  const isPlaying = replay.state === 'playing';
  const isLoading = replay.state === 'loading';

  return (
    <div className="absolute bottom-0 left-0 right-0 h-[50px] bg-zinc-900/98 backdrop-blur border-t border-zinc-800 shadow-xl z-50">
      <div className="h-full px-4 flex items-center gap-3">
        {/* LEFT: Logo + Controls */}
        <div className="flex items-center gap-3">
          {/* Replay Icon */}
          <div className="w-7 h-7 bg-gradient-to-br from-orange-500 to-orange-600 rounded flex items-center justify-center">
            <RotateCcw className="w-3.5 h-3.5 text-white" />
          </div>

          {/* Asset Badge */}
          <div className="flex items-center gap-1.5 bg-zinc-800 rounded px-2 py-1">
            <div className="w-4 h-4 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center">
              <span className="text-[9px] font-bold text-white">₿</span>
            </div>
            <span className="text-xs text-slate-300 font-medium">BTCUSD</span>
          </div>

          {/* Date Picker */}
          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              disabled={isActive}
              className="bg-zinc-800 text-slate-300 text-xs rounded px-2 py-1 pr-6 border border-zinc-700 focus:border-orange-500 focus:outline-none disabled:opacity-50 w-[130px]"
            />
            <Calendar className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
          </div>

          {/* Timeframe */}
          <select
            value={selectedTimeframe}
            onChange={(e) => setSelectedTimeframe(e.target.value as Timeframe)}
            disabled={isActive}
            className="bg-zinc-800 text-slate-300 text-xs rounded px-2 py-1 border border-zinc-700 focus:border-orange-500 focus:outline-none disabled:opacity-50"
          >
            <option value="1m">1m</option>
            <option value="5m">5m</option>
            <option value="15m">15m</option>
            <option value="1h">1h</option>
            <option value="4h">4h</option>
            <option value="1d">1d</option>
          </select>

          {/* Start/End */}
          {!isActive ? (
            <button
              onClick={handleStartReplay}
              disabled={isLoading}
              className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Loading...' : 'Start'}
            </button>
          ) : (
            <button
              onClick={replay.stopReplay}
              className="bg-zinc-700 hover:bg-zinc-600 text-slate-300 px-3 py-1 rounded text-xs font-medium transition-colors"
            >
              End
            </button>
          )}
        </div>

        {/* CENTER: Timeline & Controls */}
        {isActive && (
          <>
            {/* Divider */}
            <div className="h-6 w-px bg-zinc-700" />

            {/* Playback Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => replay.skipBackward(60)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-800 text-slate-400 hover:text-white transition-colors"
              >
                <SkipBack className="w-3.5 h-3.5" fill="currentColor" />
              </button>

              <button
                onClick={replay.togglePlayPause}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-orange-600 hover:bg-orange-700 text-white transition-all"
              >
                {isPlaying ? (
                  <Pause className="w-3.5 h-3.5" fill="white" />
                ) : (
                  <Play className="w-3.5 h-3.5 ml-0.5" fill="white" />
                )}
              </button>

              <button
                onClick={() => replay.skipForward(60)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-800 text-slate-400 hover:text-white transition-colors"
              >
                <SkipForward className="w-3.5 h-3.5" fill="currentColor" />
              </button>

              <button
                onClick={replay.reset}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-800 text-slate-400 hover:text-white transition-colors ml-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handleSpeedChange}
                className="ml-2 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-slate-300 text-xs font-medium transition-colors min-w-[40px]"
              >
                {replay.speed}x
              </button>
            </div>

            {/* Divider */}
            <div className="h-6 w-px bg-zinc-700" />

            {/* Timeline */}
            <div className="flex-1 flex items-center gap-3 min-w-0">
              {/* Time Display */}
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-slate-500" />
                <span className="text-xs font-mono font-bold text-orange-500 tabular-nums">
                  {formatTime(replay.elapsedTime)}
                </span>
                <span className="text-xs text-slate-600">/</span>
                <span className="text-xs font-mono text-slate-500 tabular-nums">
                  {formatTime(replay.totalTime)}
                </span>
              </div>

              {/* Slider */}
              <input
                type="range"
                min="0"
                max="100"
                value={replay.progress}
                onChange={(e) => replay.seekToProgress(parseFloat(e.target.value))}
                className="flex-1 h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer replay-slider-compact"
                style={{
                  background: `linear-gradient(to right, #f97316 0%, #f97316 ${replay.progress}%, #3f3f46 ${replay.progress}%, #3f3f46 100%)`
                }}
              />

              {/* Progress */}
              <span className="text-xs text-slate-500 tabular-nums min-w-[50px] text-right">
                {replay.currentIndex + 1}/{replay.totalCandles}
              </span>
            </div>
          </>
        )}

        {/* RIGHT: Close */}
        <div className="ml-auto">
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-800 text-slate-500 hover:text-red-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <style>{`
        .replay-slider-compact::-webkit-slider-thumb {
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #f97316;
          cursor: pointer;
          box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.2);
          transition: all 0.2s;
        }
        
        .replay-slider-compact::-webkit-slider-thumb:hover {
          transform: scale(1.1);
          box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.3);
        }
        
        .replay-slider-compact::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #f97316;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.2);
        }
      `}</style>
    </div>
  );
}