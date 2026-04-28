/**
 * 🧪 TEST DATA SYSTEM
 * 
 * Script de teste para validar o sistema de roteamento e validação.
 * Pode ser executado no console do navegador.
 * 
 * USO:
 * ```javascript
 * import { runAllTests } from '@/app/utils/testDataSystem';
 * runAllTests();
 * ```
 */

import { dataSourceRouter } from '@/app/services/DataSourceRouter';
import { dataQualityMonitor } from '@/app/services/DataQualityMonitor';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
  data?: any;
}

export async function testSingleSymbol(symbol: string): Promise<TestResult> {
  try {
    console.log(`[TEST] 🧪 Testando ${symbol}...`);
    
    // 1. Buscar dados
    const data = await dataSourceRouter.getMarketData(symbol);
    
    // 2. Validar qualidade
    const validation = await dataQualityMonitor.validateSymbol(symbol);
    
    // 3. Verificar resultados
    const passed = data.price > 0 && validation.status !== 'critical';
    
    const details = `
      Fonte: ${data.source}
      Preço: $${data.price.toFixed(2)}
      Qualidade: ${validation.status}
      Discrepância: ${validation.discrepancy.toFixed(2)}%
      Confiança: ${validation.confidence}%
    `;
    
    console.log(`[TEST] ${passed ? '✅' : '❌'} ${symbol}:`, {
      source: data.source,
      price: data.price,
      quality: validation.status,
      discrepancy: validation.discrepancy,
      confidence: validation.confidence
    });
    
    return {
      name: symbol,
      passed,
      details,
      data: { data, validation }
    };
  } catch (error: any) {
    console.error(`[TEST] ❌ ${symbol} falhou:`, error);
    
    return {
      name: symbol,
      passed: false,
      details: `Erro: ${error.message}`,
      data: null
    };
  }
}

export async function runAllTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('🧪 INICIANDO TESTES DO SISTEMA DE DADOS');
  console.log('='.repeat(60));
  
  const testSymbols = [
    { symbol: 'BTCUSD', expected: 'binance', type: 'Crypto' },
    { symbol: 'ETHUSD', expected: 'binance', type: 'Crypto' },
    { symbol: 'EURUSD', expected: 'metaapi', type: 'Forex' },
    { symbol: 'US30', expected: 'yahoo', type: 'Índice' },
    { symbol: 'SPX500', expected: 'yahoo', type: 'Índice' },
    { symbol: 'NAS100', expected: 'yahoo', type: 'Índice' },
    { symbol: 'XAUUSD', expected: 'metaapi', type: 'Commodity' }
  ];
  
  const results: TestResult[] = [];
  
  for (const test of testSymbols) {
    console.log(`\n[TEST] Testando ${test.symbol} (${test.type})...`);
    const result = await testSingleSymbol(test.symbol);
    results.push(result);
    
    // Verificar se fonte está correta
    if (result.data?.data.source !== test.expected) {
      console.warn(
        `[TEST] ⚠️ ${test.symbol}: Fonte esperada ${test.expected}, recebida ${result.data?.data.source}`
      );
    }
    
    // Aguardar 500ms entre testes para não sobrecarregar
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Resumo
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMO DOS TESTES');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const successRate = (passed / results.length) * 100;
  
  console.log(`✅ Passou: ${passed}/${results.length}`);
  console.log(`❌ Falhou: ${failed}/${results.length}`);
  console.log(`📈 Taxa de Sucesso: ${successRate.toFixed(1)}%`);
  
  // Detalhes dos falhos
  if (failed > 0) {
    console.log('\n❌ TESTES QUE FALHARAM:');
    results.filter(r => !r.passed).forEach(result => {
      console.log(`\n${result.name}:`);
      console.log(result.details);
    });
  }
  
  // Tabela de resultados
  console.log('\n📋 TABELA DE RESULTADOS:');
  console.table(
    results.map(r => ({
      Símbolo: r.name,
      Status: r.passed ? '✅ Pass' : '❌ Fail',
      Fonte: r.data?.data.source || 'N/A',
      Preço: r.data?.data.price ? `$${r.data.data.price.toFixed(2)}` : 'N/A',
      Qualidade: r.data?.validation.status || 'N/A',
      Discrepância: r.data?.validation.discrepancy ? `${r.data.validation.discrepancy.toFixed(2)}%` : 'N/A'
    }))
  );
  
  console.log('\n' + '='.repeat(60));
  console.log('🎉 TESTES CONCLUÍDOS');
  console.log('='.repeat(60));
  
  return;
}

export async function testRouterHealth(): Promise<void> {
  console.log('\n🏥 TESTANDO SAÚDE DO ROUTER...\n');
  
  const health = dataSourceRouter.getHealthStatus();
  
  console.table(
    Array.from(health.entries()).map(([source, status]) => ({
      Fonte: source,
      'Taxa de Sucesso': `${status.successRate.toFixed(1)}%`,
      'Última Sucesso': new Date(status.lastSuccess).toLocaleTimeString(),
      'Erros': status.errors
    }))
  );
}

export async function testMonitorStats(): Promise<void> {
  console.log('\n📊 ESTATÍSTICAS DO MONITOR...\n');
  
  const stats = dataQualityMonitor.getStats();
  
  console.log('Total de Validações:', stats.totalValidations);
  console.log('Taxa de Sucesso:', `${stats.successRate.toFixed(1)}%`);
  console.log('Discrepância Média:', `${stats.averageDiscrepancy.toFixed(2)}%`);
  console.log('Issues Críticos:', stats.criticalIssues);
  console.log('Última Validação:', new Date(stats.lastValidation).toLocaleString());
}

export async function fullSystemTest(): Promise<void> {
  console.log('\n🚀 EXECUTANDO TESTE COMPLETO DO SISTEMA...\n');
  
  // 1. Testar todos os símbolos
  await runAllTests();
  
  // 2. Verificar saúde do router
  await testRouterHealth();
  
  // 3. Verificar estatísticas do monitor
  await testMonitorStats();
  
  console.log('\n✨ TESTE COMPLETO FINALIZADO!\n');
}

// Expor no window para uso no console
if (typeof window !== 'undefined') {
  (window as any).testDataSystem = {
    runAllTests,
    testSingleSymbol,
    testRouterHealth,
    testMonitorStats,
    fullSystemTest
  };
  
  console.log('✅ Test utilities disponíveis em window.testDataSystem');
  console.log('💡 Execute: window.testDataSystem.fullSystemTest()');
}
