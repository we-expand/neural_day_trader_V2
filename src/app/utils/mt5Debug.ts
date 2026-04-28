// 🔥 MT5 Debug Utilities - Diagnóstico de Saldo

export function logMT5AccountInfo(info: any, login: string, server: string) {
  console.error('\n' + '='.repeat(100));
  console.error('🏦 DIAGNÓSTICO COMPLETO - CONTA MT5 REAL');
  console.error('='.repeat(100));
  console.error(`📱 Login: ***${login.slice(-4)}`);
  console.error(`🌐 Servidor: ${server}`);
  console.error(`💰 Balance (info.balance): ${info.balance}`);
  console.error(`💵 Equity (info.equity): ${info.equity}`);
  console.error(`📊 Margin (info.margin): ${info.margin}`);
  console.error(`📈 Free Margin (info.freeMargin): ${info.freeMargin}`);
  console.error(`⚖️ Margin Level (info.marginLevel): ${info.marginLevel}`);
  console.error(`💱 Currency (info.currency): ${info.currency}`);
  console.error(`📉 Leverage (info.leverage): ${info.leverage}`);
  console.error(`🏢 Broker (info.broker): ${info.broker}`);
  console.error(`🔑 Type (info.type): ${info.type}`);
  console.error(`🆔 Account ID (info.login): ${info.login}`);
  console.error(`💼 Name (info.name): ${info.name}`);
  console.error(`📧 Email (info.email): ${info.email}`);
  console.error(`🏦 Company (info.company): ${info.company}`);
  console.error('─'.repeat(100));
  console.error('📋 OBJETO COMPLETO getAccountInformation():');
  console.error(JSON.stringify(info, null, 2));
  console.error('─'.repeat(100));
  console.error('🔍 VERIFICANDO CAMPOS ALTERNATIVOS:');
  console.error('  accountInformation?.balance:', (info as any).accountInformation?.balance);
  console.error('  account?.balance:', (info as any).account?.balance);
  console.error('  data?.balance:', (info as any).data?.balance);
  console.error('─'.repeat(100));
  console.error('🧪 TIPO DOS VALORES:');
  console.error(`  typeof info.balance: ${typeof info.balance}`);
  console.error(`  typeof info.equity: ${typeof info.equity}`);
  console.error(`  info.balance === 0: ${info.balance === 0}`);
  console.error(`  info.balance === undefined: ${info.balance === undefined}`);
  console.error(`  info.balance === null: ${info.balance === null}`);
  console.error('='.repeat(100) + '\n');
}

export function extractBalance(info: any): number {
  // Tenta extrair balance de múltiplos caminhos possíveis
  const paths = [
    info?.balance,
    info?.accountInformation?.balance,
    info?.account?.balance,
    info?.data?.balance,
    info?.equity // Fallback para equity se balance não existir
  ];
  
  for (const value of paths) {
    if (typeof value === 'number' && value !== 0) {
      console.error(`✅ Balance encontrado: $${value} (path funcionou)`);
      return value;
    }
  }
  
  console.error('❌ Balance não encontrado em nenhum path conhecido!');
  return 0;
}
