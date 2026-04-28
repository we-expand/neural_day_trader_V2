import React, { useState, useEffect } from 'react';

interface DebugPanelProps {
  currentView: string;
  user: any;
  loading: boolean;
}

export function DebugPanel({ currentView, user, loading }: DebugPanelProps) {
  const [renderCount, setRenderCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [showBigAlert, setShowBigAlert] = useState(false);

  useEffect(() => {
    setRenderCount(prev => prev + 1);
    setLastUpdate(Date.now());
    
    // 🔥 Mostrar alerta gigante quando mudar para settings
    if (currentView === 'settings') {
      console.log('🚨🚨🚨 SETTINGS DETECTADO! View:', currentView);
      setShowBigAlert(true);
    }
  }, [currentView, user, loading]);

  // 🚨 ALERTA DE LOOP INFINITO
  useEffect(() => {
    if (renderCount > 10) {
      console.error('🚨🚨🚨 LOOP INFINITO DETECTADO! RenderCount:', renderCount);
      setShowBigAlert(true);
    }
  }, [renderCount]);

  return (
    <>
      {/* OVERLAY GIGANTE quando settings for clicado */}
      {showBigAlert && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[99999] flex items-center justify-center">
          <div className="bg-gradient-to-br from-red-900 to-purple-900 border-4 border-red-500 rounded-3xl p-12 max-w-2xl animate-pulse">
            <h1 className="text-6xl font-black text-white mb-6 text-center">
              🚨 DEBUG ATIVO 🚨
            </h1>
            <div className="space-y-4 text-2xl text-white font-bold">
              <p>View atual: <span className="text-red-300">{currentView}</span></p>
              <p>Renders: <span className="text-yellow-300">{renderCount}</span></p>
              <p>Status: <span className="text-emerald-300">{renderCount > 10 ? 'LOOP INFINITO!' : 'OK'}</span></p>
            </div>
            <button
              onClick={() => setShowBigAlert(false)}
              className="mt-8 w-full bg-red-600 hover:bg-red-500 text-white py-4 rounded-xl text-xl font-bold"
            >
              FECHAR ALERTA
            </button>
          </div>
        </div>
      )}
      
      {/* Painel pequeno no canto */}
      <div className="fixed bottom-4 right-4 bg-black/90 border-2 border-emerald-500 rounded-lg p-4 text-xs font-mono z-[9999] max-w-sm shadow-2xl">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-emerald-500/30">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          <span className="text-emerald-400 font-bold">DEBUG PANEL</span>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-500">View:</span>
            <span className={`font-bold ${currentView === 'settings' ? 'text-red-400' : 'text-emerald-400'}`}>
              {currentView}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-slate-500">User:</span>
            <span className="text-slate-300">
              {user ? user.email?.substring(0, 12) + '...' : 'null'}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-slate-500">Loading:</span>
            <span className={loading ? 'text-yellow-400' : 'text-emerald-400'}>
              {loading ? 'true' : 'false'}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-slate-500">Renders:</span>
            <span className={`font-bold ${renderCount > 10 ? 'text-red-400' : 'text-slate-300'}`}>
              {renderCount} {renderCount > 10 ? '🚨' : ''}
            </span>
          </div>
          
          <div className="flex justify-between text-[10px]">
            <span className="text-slate-500">Updated:</span>
            <span className="text-slate-400">
              {new Date(lastUpdate).toLocaleTimeString()}
            </span>
          </div>
        </div>
        
        {renderCount > 10 && (
          <div className="mt-3 pt-3 border-t border-red-500/30">
            <div className="text-red-400 font-bold animate-pulse">
              ⚠️ LOOP INFINITO!
            </div>
            <div className="text-red-300 text-[10px] mt-1">
              Mais de 10 re-renders detectados
            </div>
          </div>
        )}
        
        <button
          onClick={() => setShowBigAlert(true)}
          className="mt-3 w-full bg-red-600 hover:bg-red-500 text-white py-2 rounded text-xs font-bold"
        >
          MOSTRAR ALERTA
        </button>
      </div>
    </>
  );
}