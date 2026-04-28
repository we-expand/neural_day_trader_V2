import React, { useState, useEffect } from 'react';
import { Activity, TrendingUp, TrendingDown, Clock, CheckCircle, XCircle, AlertCircle, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AIActivity {
  id: string;
  timestamp: Date;
  type: 'analysis' | 'entry' | 'skip' | 'cooldown' | 'blocked';
  symbol?: string;
  action?: string;
  reason?: string;
  confidence?: number;
  side?: 'LONG' | 'SHORT';
}

export function AIActivityMonitor() {
  const [activities, setActivities] = useState<AIActivity[]>([]);
  const [currentAction, setCurrentAction] = useState<string>('Aguardando...');
  const [nextAnalysis, setNextAnalysis] = useState<number>(5);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // 🎯 Listen to console logs and capture AI activity
  useEffect(() => {
    const originalLog = console.log;
    
    console.log = function(...args) {
      const message = args.join(' ');
      
      // Capturar diferentes tipos de atividade
      if (message.includes('[AI LOOP]')) {
        if (message.includes('Verificando oportunidades')) {
          setIsAnalyzing(true);
          setCurrentAction('🔍 Verificando oportunidades...');
        }
      }
      
      if (message.includes('[TRADING]')) {
        if (message.includes('Analisando')) {
          const symbolMatch = message.match(/Analisando (\w+)/);
          if (symbolMatch) {
            setCurrentAction(`📊 Analisando ${symbolMatch[1]}...`);
            setIsAnalyzing(true);
          }
        }
      }
      
      if (message.includes('[DECISÃO FINAL]')) {
        const sideMatch = message.match(/(COMPRA|VENDA)/);
        const symbolMatch = message.match(/(\w+USD\w+|\w+\d+)/);
        const confidenceMatch = message.match(/Confiança: (\d+)%/);
        
        if (sideMatch && symbolMatch) {
          const activity: AIActivity = {
            id: Date.now().toString(),
            timestamp: new Date(),
            type: 'entry',
            symbol: symbolMatch[1],
            side: sideMatch[1] === 'COMPRA' ? 'LONG' : 'SHORT',
            confidence: confidenceMatch ? parseInt(confidenceMatch[1]) : undefined,
            action: `${sideMatch[1]} ${symbolMatch[1]}`
          };
          
          setActivities(prev => [activity, ...prev.slice(0, 9)]);
          setCurrentAction(`✅ Entrando em ${activity.action}`);
          setTimeout(() => setIsAnalyzing(false), 2000);
        }
      }
      
      if (message.includes('[QUALIDADE]') && message.includes('rejeitado')) {
        const symbolMatch = message.match(/(\w+USD\w+|\w+\d+)/);
        const scoreMatch = message.match(/Score (\d+)%/);
        
        if (symbolMatch) {
          const activity: AIActivity = {
            id: Date.now().toString(),
            timestamp: new Date(),
            type: 'skip',
            symbol: symbolMatch[1],
            reason: `Confiança baixa (${scoreMatch ? scoreMatch[1] : '?'}%)`,
            action: 'Setup rejeitado'
          };
          
          setActivities(prev => [activity, ...prev.slice(0, 9)]);
          setCurrentAction(`⏭️ ${symbolMatch[1]} rejeitado`);
          setTimeout(() => setIsAnalyzing(false), 1500);
        }
      }
      
      if (message.includes('[ESTRATÉGIA]') && message.includes('lateral')) {
        const activity: AIActivity = {
          id: Date.now().toString(),
          timestamp: new Date(),
          type: 'skip',
          reason: 'Mercado lateral',
          action: 'Aguardando setup'
        };
        
        setActivities(prev => [activity, ...prev.slice(0, 9)]);
        setCurrentAction('⏸️ Mercado lateral - aguardando');
        setTimeout(() => setIsAnalyzing(false), 1500);
      }
      
      if (message.includes('[COOLDOWN]')) {
        const timeMatch = message.match(/(\d+)s/);
        if (timeMatch) {
          setCurrentAction(`⏳ Cooldown: ${timeMatch[1]}s`);
          setNextAnalysis(parseInt(timeMatch[1]));
        }
      }
      
      if (message.includes('[ANTI-HEDGING]') || message.includes('[ANTI-REPETIÇÃO]') || message.includes('[ASSET LIMIT]')) {
        const activity: AIActivity = {
          id: Date.now().toString(),
          timestamp: new Date(),
          type: 'blocked',
          reason: message.includes('ANTI-HEDGING') ? 'Anti-hedging ativo' : 
                  message.includes('ANTI-REPETIÇÃO') ? 'Anti-repetição ativo' : 
                  'Limite de ativos atingido',
          action: 'Trade bloqueado'
        };
        
        setActivities(prev => [activity, ...prev.slice(0, 9)]);
        setCurrentAction(`🛡️ ${activity.reason}`);
        setTimeout(() => setIsAnalyzing(false), 1500);
      }
      
      // Call original console.log
      originalLog.apply(console, args);
    };
    
    return () => {
      console.log = originalLog;
    };
  }, []);

  // Countdown timer
  useEffect(() => {
    if (nextAnalysis > 0 && !isAnalyzing) {
      const timer = setInterval(() => {
        setNextAnalysis(prev => Math.max(0, prev - 1));
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [nextAnalysis, isAnalyzing]);

  return (
    <div className="border border-white/10 rounded-xl bg-gradient-to-br from-purple-950/20 to-black p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-purple-400 uppercase tracking-widest flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Atividade da IA
        </h3>
        
        {/* Status Indicator */}
        <div className="flex items-center gap-2">
          {isAnalyzing ? (
            <div className="flex items-center gap-2 text-xs text-purple-400">
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              Analisando
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock className="w-3 h-3" />
              Próxima: {nextAnalysis}s
            </div>
          )}
        </div>
      </div>

      {/* Current Action */}
      <div className="mb-4 p-3 rounded-lg bg-black/40 border border-purple-500/20">
        <div className="text-xs text-slate-400 mb-1">Ação Atual</div>
        <div className="text-sm font-semibold text-white flex items-center gap-2">
          {isAnalyzing && <Zap className="w-4 h-4 text-purple-400 animate-pulse" />}
          {currentAction}
        </div>
      </div>

      {/* Activity Feed */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {activities.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              Nenhuma atividade ainda...
              <br />
              A IA começará a analisar o mercado em breve.
            </div>
          ) : (
            activities.map((activity) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`p-3 rounded-lg border ${
                  activity.type === 'entry' 
                    ? 'bg-emerald-950/30 border-emerald-500/30' 
                    : activity.type === 'skip' 
                    ? 'bg-yellow-950/20 border-yellow-500/20'
                    : activity.type === 'blocked'
                    ? 'bg-red-950/20 border-red-500/20'
                    : 'bg-slate-950/30 border-slate-500/20'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {activity.type === 'entry' && (
                        <>
                          {activity.side === 'LONG' ? (
                            <TrendingUp className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-red-400" />
                          )}
                          <span className="text-xs font-semibold text-emerald-400">
                            {activity.action}
                          </span>
                        </>
                      )}
                      
                      {activity.type === 'skip' && (
                        <>
                          <XCircle className="w-3 h-3 text-yellow-400" />
                          <span className="text-xs font-semibold text-yellow-400">
                            {activity.symbol || 'Setup Rejeitado'}
                          </span>
                        </>
                      )}
                      
                      {activity.type === 'blocked' && (
                        <>
                          <AlertCircle className="w-3 h-3 text-red-400" />
                          <span className="text-xs font-semibold text-red-400">
                            {activity.action}
                          </span>
                        </>
                      )}
                    </div>
                    
                    {activity.reason && (
                      <div className="text-xs text-slate-400 ml-5">
                        {activity.reason}
                      </div>
                    )}
                    
                    {activity.confidence && (
                      <div className="text-xs text-slate-500 ml-5">
                        Confiança: {activity.confidence}%
                      </div>
                    )}
                  </div>
                  
                  <div className="text-xs text-slate-600">
                    {activity.timestamp.toLocaleTimeString('pt-BR', { 
                      hour: '2-digit', 
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
