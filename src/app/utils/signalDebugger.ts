/**
 * 🎯 SIGNAL DEBUGGER
 * 
 * Utilitário para rastrear e validar consistência de sinais entre componentes
 * 
 * @version 1.0.0
 * @date 24 Janeiro 2026
 */

export interface SignalSnapshot {
  component: string;
  timestamp: number;
  symbol: string;
  timeframe: string;
  signals: {
    rsi?: { value: number; signal: 'BUY' | 'SELL' | 'NEUTRAL' };
    fibonacci?: { value: string; signal: 'BUY' | 'SELL' | 'NEUTRAL' };
    volumetria?: { value: string; signal: 'BUY' | 'SELL' | 'NEUTRAL' };
    obv?: { value: string; signal: 'BUY' | 'SELL' | 'NEUTRAL' };
  };
  score: number;
  classification: string;
  marketPhase: string;
}

class SignalDebugger {
  private static snapshots: SignalSnapshot[] = [];
  private static enabled = false; // Toggle para ativar/desativar logs
  
  /**
   * Registra um snapshot de sinais de um componente
   */
  static capture(snapshot: SignalSnapshot) {
    if (!this.enabled) return;
    
    this.snapshots.push(snapshot);
    
    // Manter apenas últimos 100 snapshots
    if (this.snapshots.length > 100) {
      this.snapshots.shift();
    }
    
    console.log(`[SIGNAL DEBUGGER] 📊 ${snapshot.component} @ ${snapshot.symbol}/${snapshot.timeframe}:`, {
      score: snapshot.score,
      classification: snapshot.classification,
      phase: snapshot.marketPhase,
      signals: snapshot.signals
    });
  }
  
  /**
   * Compara sinais entre dois componentes para o mesmo ativo
   */
  static compare(component1: string, component2: string, symbol: string): boolean {
    if (!this.enabled) return true;
    
    const snap1 = this.snapshots.filter(s => s.component === component1 && s.symbol === symbol).pop();
    const snap2 = this.snapshots.filter(s => s.component === component2 && s.symbol === symbol).pop();
    
    if (!snap1 || !snap2) {
      console.warn(`[SIGNAL DEBUGGER] ⚠️ Não há dados para comparar ${component1} vs ${component2}`);
      return false;
    }
    
    // Verifica se os sinais estão alinhados
    const rsiMatch = snap1.signals.rsi?.signal === snap2.signals.rsi?.signal;
    const scoreMatch = Math.abs(snap1.score - snap2.score) < 10; // Tolerância de 10 pontos
    
    if (!rsiMatch || !scoreMatch) {
      console.error(`[SIGNAL DEBUGGER] ❌ SINAIS DESALINHADOS:`, {
        component1: { score: snap1.score, rsi: snap1.signals.rsi?.signal },
        component2: { score: snap2.score, rsi: snap2.signals.rsi?.signal }
      });
      return false;
    }
    
    console.log(`[SIGNAL DEBUGGER] ✅ Sinais alinhados entre ${component1} e ${component2}`);
    return true;
  }
  
  /**
   * Retorna o último snapshot de um componente
   */
  static getLatest(component: string, symbol?: string): SignalSnapshot | undefined {
    if (symbol) {
      return this.snapshots.filter(s => s.component === component && s.symbol === symbol).pop();
    }
    return this.snapshots.filter(s => s.component === component).pop();
  }
  
  /**
   * Ativa/desativa o debugger
   */
  static toggle(enabled: boolean) {
    this.enabled = enabled;
    console.log(`[SIGNAL DEBUGGER] ${enabled ? '✅ ATIVADO' : '❌ DESATIVADO'}`);
  }
  
  /**
   * Limpa todos os snapshots
   */
  static clear() {
    this.snapshots = [];
    console.log('[SIGNAL DEBUGGER] 🧹 Snapshots limpos');
  }
  
  /**
   * Exporta relatório de consistência
   */
  static report(): void {
    if (this.snapshots.length === 0) {
      console.log('[SIGNAL DEBUGGER] 📊 Nenhum snapshot registrado');
      return;
    }
    
    console.group('[SIGNAL DEBUGGER] 📊 RELATÓRIO DE CONSISTÊNCIA');
    
    // Agrupar por símbolo
    const bySymbol: Record<string, SignalSnapshot[]> = {};
    this.snapshots.forEach(snap => {
      if (!bySymbol[snap.symbol]) bySymbol[snap.symbol] = [];
      bySymbol[snap.symbol].push(snap);
    });
    
    Object.entries(bySymbol).forEach(([symbol, snaps]) => {
      console.group(`📈 ${symbol} (${snaps.length} registros)`);
      
      const latest = snaps[snaps.length - 1];
      console.log('Último estado:', {
        component: latest.component,
        score: latest.score,
        classification: latest.classification,
        signals: latest.signals
      });
      
      // Verificar variação de score
      if (snaps.length > 1) {
        const first = snaps[0];
        const scoreDelta = latest.score - first.score;
        console.log(`Variação de score: ${scoreDelta > 0 ? '+' : ''}${scoreDelta.toFixed(1)}`);
      }
      
      console.groupEnd();
    });
    
    console.groupEnd();
  }
}

// Expor globalmente para debug no console
if (typeof window !== 'undefined') {
  (window as any).SignalDebugger = SignalDebugger;
}

export default SignalDebugger;
