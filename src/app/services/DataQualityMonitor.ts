/**
 * 🔍 DATA QUALITY MONITOR
 * 
 * Sistema automatizado de validação de qualidade de dados que:
 * - Compara preços entre múltiplas fontes
 * - Detecta discrepâncias e anomalias
 * - Calcula score de confiabilidade
 * - Gera alertas automáticos de qualidade
 * - Monitora consistência temporal
 * 
 * CRITÉRIOS DE VALIDAÇÃO:
 * - Discrepância entre fontes < 1% = EXCELENTE
 * - Discrepância entre fontes < 3% = BOM
 * - Discrepância entre fontes < 5% = ACEITÁVEL
 * - Discrepância entre fontes > 5% = RUIM
 */

import { dataSourceRouter, type SourcedMarketData, type DataSource } from './DataSourceRouter';
import { symbolMappingService } from './SymbolMappingService';
import { debugLog, debugWarn, debugError } from '@/app/config/debug';

export interface ValidationResult {
  symbol: string;
  primary: SourcedMarketData;
  alternative?: SourcedMarketData;
  discrepancy: number; // Percentual de diferença
  status: 'excellent' | 'good' | 'acceptable' | 'warning' | 'critical';
  issues: ValidationIssue[];
  confidence: number; // 0-100
  recommendation: string;
  timestamp: number;
}

export interface ValidationIssue {
  severity: 'info' | 'warning' | 'error';
  message: string;
  source?: DataSource;
}

export interface MonitoringStats {
  totalValidations: number;
  successRate: number;
  averageDiscrepancy: number;
  criticalIssues: number;
  lastValidation: number;
}

/**
 * 🔍 DATA QUALITY MONITOR
 */
export class DataQualityMonitor {
  private validationHistory = new Map<string, ValidationResult[]>();
  private stats: MonitoringStats = {
    totalValidations: 0,
    successRate: 100,
    averageDiscrepancy: 0,
    criticalIssues: 0,
    lastValidation: Date.now()
  };
  
  // Thresholds de validação
  private readonly THRESHOLDS = {
    EXCELLENT: 1,    // < 1%
    GOOD: 3,         // < 3%
    ACCEPTABLE: 5,   // < 5%
    WARNING: 10,     // < 10%
    CRITICAL: 10     // >= 10%
  };

  /**
   * 🎯 MÉTODO PRINCIPAL: Validar dados de um símbolo
   */
  async validateSymbol(symbol: string): Promise<ValidationResult> {
    debugLog('QUALITY', `🔍 Iniciando validação para ${symbol}`);
    
    const issues: ValidationIssue[] = [];
    
    // 1️⃣ Obter dados da fonte primária
    const primaryData = await dataSourceRouter.getMarketData(symbol);
    
    // 2️⃣ Validar dados básicos
    this.validateBasicData(primaryData, issues);
    
    // 3️⃣ Tentar obter dados de fonte alternativa para comparação
    let alternativeData: SourcedMarketData | undefined;
    let discrepancy = 0;
    
    try {
      alternativeData = await this.fetchAlternativeSource(symbol, primaryData.source);
      
      if (alternativeData && alternativeData.price > 0) {
        discrepancy = this.calculateDiscrepancy(primaryData.price, alternativeData.price);
        
        // Validar discrepância
        this.validateDiscrepancy(discrepancy, primaryData.source, alternativeData.source, issues);
      }
    } catch (error) {
      debugWarn('QUALITY', `⚠️ Não foi possível obter fonte alternativa para ${symbol}`);
      issues.push({
        severity: 'info',
        message: 'Validação cruzada não disponível - usando apenas fonte primária'
      });
    }
    
    // 4️⃣ Validar histórico e consistência temporal
    this.validateTemporalConsistency(symbol, primaryData, issues);
    
    // 5️⃣ Calcular status geral
    const status = this.determineStatus(primaryData, discrepancy, issues);
    const confidence = this.calculateConfidence(primaryData, discrepancy, issues);
    const recommendation = this.generateRecommendation(status, discrepancy, primaryData);
    
    // 6️⃣ Criar resultado
    const result: ValidationResult = {
      symbol,
      primary: primaryData,
      alternative: alternativeData,
      discrepancy,
      status,
      issues,
      confidence,
      recommendation,
      timestamp: Date.now()
    };
    
    // 7️⃣ Atualizar histórico
    this.updateHistory(symbol, result);
    this.updateStats(result);
    
    debugLog('QUALITY', `✅ Validação concluída para ${symbol}:`, {
      status,
      confidence,
      discrepancy: `${discrepancy.toFixed(2)}%`,
      issues: issues.length
    });
    
    return result;
  }

  /**
   * 🔍 Buscar dados de fonte alternativa
   */
  private async fetchAlternativeSource(
    symbol: string,
    primarySource: DataSource
  ): Promise<SourcedMarketData | undefined> {
    const { config } = dataSourceRouter.getSourceInfo(symbol);
    
    // Usar primeira fonte de fallback disponível
    for (const fallbackSource of config.fallback) {
      if (fallbackSource === 'fallback') continue; // Pular dados mock
      
      try {
        const data = await dataSourceRouter.getMarketData(symbol);
        if (data && data.source !== primarySource && data.price > 0) {
          return data;
        }
      } catch (error) {
        continue;
      }
    }
    
    return undefined;
  }

  /**
   * ✅ Validar dados básicos
   */
  private validateBasicData(data: SourcedMarketData, issues: ValidationIssue[]): void {
    // Preço zero ou negativo
    if (data.price <= 0) {
      issues.push({
        severity: 'error',
        message: `Preço inválido: ${data.price}`,
        source: data.source
      });
    }
    
    // Mudança percentual absurda (>50% em 1 dia)
    if (Math.abs(data.changePercent) > 50) {
      issues.push({
        severity: 'warning',
        message: `Mudança de ${data.changePercent.toFixed(2)}% parece anormal - verificar se está correto`,
        source: data.source
      });
    }
    
    // Dados muito antigos (>1 hora)
    const dataAge = Date.now() - data.timestamp;
    if (dataAge > 60 * 60 * 1000) {
      issues.push({
        severity: 'warning',
        message: `Dados com ${Math.floor(dataAge / 60000)} minutos - podem estar desatualizados`,
        source: data.source
      });
    }
    
    // Fallback usado
    if (data.fallbackUsed) {
      issues.push({
        severity: 'info',
        message: `Fonte primária indisponível - usando fallback ${data.source}`,
        source: data.source
      });
    }
  }

  /**
   * 📊 Calcular discrepância percentual entre preços
   */
  private calculateDiscrepancy(price1: number, price2: number): number {
    if (price1 === 0 || price2 === 0) return 100; // Máximo se algum for zero
    
    const diff = Math.abs(price1 - price2);
    const avg = (price1 + price2) / 2;
    
    return (diff / avg) * 100;
  }

  /**
   * 🔍 Validar discrepância entre fontes
   */
  private validateDiscrepancy(
    discrepancy: number,
    source1: DataSource,
    source2: DataSource,
    issues: ValidationIssue[]
  ): void {
    if (discrepancy < this.THRESHOLDS.EXCELLENT) {
      issues.push({
        severity: 'info',
        message: `✅ Excelente: Discrepância de apenas ${discrepancy.toFixed(2)}% entre ${source1} e ${source2}`
      });
    } else if (discrepancy < this.THRESHOLDS.GOOD) {
      issues.push({
        severity: 'info',
        message: `✅ Bom: Discrepância de ${discrepancy.toFixed(2)}% entre ${source1} e ${source2}`
      });
    } else if (discrepancy < this.THRESHOLDS.ACCEPTABLE) {
      issues.push({
        severity: 'warning',
        message: `⚠️ Aceitável: Discrepância de ${discrepancy.toFixed(2)}% entre ${source1} e ${source2}`
      });
    } else if (discrepancy < this.THRESHOLDS.WARNING) {
      issues.push({
        severity: 'warning',
        message: `⚠️ Atenção: Discrepância de ${discrepancy.toFixed(2)}% entre ${source1} e ${source2} - verificar fonte`
      });
    } else {
      issues.push({
        severity: 'error',
        message: `🚨 CRÍTICO: Discrepância de ${discrepancy.toFixed(2)}% entre ${source1} e ${source2} - provável erro nos dados!`
      });
    }
  }

  /**
   * ⏱️ Validar consistência temporal
   */
  private validateTemporalConsistency(
    symbol: string,
    currentData: SourcedMarketData,
    issues: ValidationIssue[]
  ): void {
    const history = this.validationHistory.get(symbol) || [];
    
    if (history.length === 0) {
      return; // Primeira validação
    }
    
    const lastValidation = history[history.length - 1];
    const timeDiff = currentData.timestamp - lastValidation.timestamp;
    
    // Se passou menos de 1 minuto, verificar se mudança é muito grande
    if (timeDiff < 60000) {
      const priceDiff = Math.abs(currentData.price - lastValidation.primary.price);
      const priceDiffPercent = (priceDiff / lastValidation.primary.price) * 100;
      
      // Mudança > 5% em menos de 1 minuto é suspeita
      if (priceDiffPercent > 5) {
        issues.push({
          severity: 'warning',
          message: `⚠️ Mudança de ${priceDiffPercent.toFixed(2)}% em ${Math.floor(timeDiff / 1000)}s - verificar se está correto`
        });
      }
    }
  }

  /**
   * 🎯 Determinar status geral
   */
  private determineStatus(
    data: SourcedMarketData,
    discrepancy: number,
    issues: ValidationIssue[]
  ): ValidationResult['status'] {
    // Se tem erros críticos
    const hasErrors = issues.some(i => i.severity === 'error');
    if (hasErrors || discrepancy >= this.THRESHOLDS.CRITICAL) {
      return 'critical';
    }
    
    // Se tem warnings ou discrepância alta
    const hasWarnings = issues.some(i => i.severity === 'warning');
    if (hasWarnings || discrepancy >= this.THRESHOLDS.WARNING) {
      return 'warning';
    }
    
    // Baseado na discrepância
    if (discrepancy < this.THRESHOLDS.EXCELLENT) return 'excellent';
    if (discrepancy < this.THRESHOLDS.GOOD) return 'good';
    return 'acceptable';
  }

  /**
   * 📊 Calcular score de confiança
   */
  private calculateConfidence(
    data: SourcedMarketData,
    discrepancy: number,
    issues: ValidationIssue[]
  ): number {
    let confidence = 100;
    
    // Penalizar por discrepância
    confidence -= Math.min(50, discrepancy * 5);
    
    // Penalizar por issues
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    
    confidence -= errorCount * 20;
    confidence -= warningCount * 10;
    
    // Penalizar se fallback foi usado
    if (data.fallbackUsed) {
      confidence -= 15;
    }
    
    // Bonus por qualidade da fonte
    if (data.quality === 'excellent') confidence += 10;
    else if (data.quality === 'good') confidence += 5;
    
    return Math.max(0, Math.min(100, confidence));
  }

  /**
   * 💡 Gerar recomendação
   */
  private generateRecommendation(
    status: ValidationResult['status'],
    discrepancy: number,
    data: SourcedMarketData
  ): string {
    if (status === 'critical') {
      return `🚨 AÇÃO NECESSÁRIA: Discrepância de ${discrepancy.toFixed(1)}% detectada. Verificar manualmente os dados ou trocar de fonte.`;
    }
    
    if (status === 'warning') {
      return `⚠️ Atenção: Dados podem estar imprecisos. Considere validar com fonte alternativa.`;
    }
    
    if (status === 'acceptable') {
      return `✅ Dados aceitáveis com pequenas discrepâncias (${discrepancy.toFixed(1)}%).`;
    }
    
    if (status === 'good') {
      return `✅ Dados de boa qualidade com baixa discrepância (${discrepancy.toFixed(1)}%).`;
    }
    
    return `✅ Dados excelentes com discrepância mínima (${discrepancy.toFixed(1)}%).`;
  }

  /**
   * 📝 Atualizar histórico
   */
  private updateHistory(symbol: string, result: ValidationResult): void {
    let history = this.validationHistory.get(symbol) || [];
    
    // Manter apenas últimas 100 validações
    history.push(result);
    if (history.length > 100) {
      history = history.slice(-100);
    }
    
    this.validationHistory.set(symbol, history);
  }

  /**
   * 📊 Atualizar estatísticas globais
   */
  private updateStats(result: ValidationResult): void {
    this.stats.totalValidations++;
    this.stats.lastValidation = result.timestamp;
    
    // Atualizar média de discrepância
    const totalDiscrepancy = this.stats.averageDiscrepancy * (this.stats.totalValidations - 1) + result.discrepancy;
    this.stats.averageDiscrepancy = totalDiscrepancy / this.stats.totalValidations;
    
    // Contar issues críticos
    if (result.status === 'critical') {
      this.stats.criticalIssues++;
    }
    
    // Calcular success rate
    const successfulValidations = this.stats.totalValidations - this.stats.criticalIssues;
    this.stats.successRate = (successfulValidations / this.stats.totalValidations) * 100;
  }

  /**
   * 📊 Validar múltiplos símbolos em lote
   */
  async validateBatch(symbols: string[]): Promise<Map<string, ValidationResult>> {
    const results = new Map<string, ValidationResult>();
    
    debugLog('QUALITY', `🔍 Validando lote de ${symbols.length} símbolos`);
    
    // Validar em paralelo (máximo 5 por vez para não sobrecarregar)
    const batchSize = 5;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(symbol => this.validateSymbol(symbol))
      );
      
      batchResults.forEach((result, index) => {
        results.set(batch[index], result);
      });
    }
    
    debugLog('QUALITY', `✅ Lote validado: ${results.size} símbolos`);
    
    return results;
  }

  /**
   * 📊 Obter histórico de validação
   */
  getHistory(symbol: string, limit: number = 10): ValidationResult[] {
    const history = this.validationHistory.get(symbol) || [];
    return history.slice(-limit);
  }

  /**
   * 📊 Obter estatísticas globais
   */
  getStats(): MonitoringStats {
    return { ...this.stats };
  }

  /**
   * 🔍 Obter resumo de todos os símbolos monitorados
   */
  getSummary(): Map<string, { lastStatus: ValidationResult['status']; lastValidation: number }> {
    const summary = new Map<string, { lastStatus: ValidationResult['status']; lastValidation: number }>();
    
    for (const [symbol, history] of this.validationHistory) {
      if (history.length > 0) {
        const last = history[history.length - 1];
        summary.set(symbol, {
          lastStatus: last.status,
          lastValidation: last.timestamp
        });
      }
    }
    
    return summary;
  }
}

// 🌍 Instância global
export const dataQualityMonitor = new DataQualityMonitor();
