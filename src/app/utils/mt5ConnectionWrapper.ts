// 🔥 MT5 Connection Wrapper com Debug Avançado

export function wrapMT5Connection(connection: any, login: string, server: string) {
  const originalGetAccountInfo = connection.getAccountInformation.bind(connection);
  
  connection.getAccountInformation = async function() {
    const info = await originalGetAccountInfo();
    
    console.error('\n' + '='.repeat(100));
    console.error('🏦 DIAGNÓSTICO MT5 - SALDO REAL');
    console.error('='.repeat(100));
    console.error(`📱 Conta: ***${login.slice(-4)} | Servidor: ${server}`);
    console.error('─'.repeat(100));
    console.error('💰 DADOS FINANCEIROS:');
    console.error(`  Balance: $${info.balance} (${typeof info.balance})`);
    console.error(`  Equity: $${info.equity} (${typeof info.equity})`);
    console.error(`  Margin: $${info.margin} (${typeof info.margin})`);
    console.error(`  Free Margin: $${info.freeMargin} (${typeof info.freeMargin})`);
    console.error(`  Margin Level: ${info.marginLevel}%`);
    console.error('─'.repeat(100));
    console.error('📊 INFORMAÇÕES DA CONTA:');
    console.error(`  Currency: ${info.currency}`);
    console.error(`  Leverage: 1:${info.leverage}`);
    console.error(`  Broker: ${info.broker}`);
    console.error(`  Type: ${info.type}`);
    console.error(`  Login: ${info.login}`);
    console.error('─'.repeat(100));
    console.error('🔍 OBJETO COMPLETO:');
    console.error(JSON.stringify(info, null, 2));
    console.error('─'.repeat(100));
    console.error('🧪 TESTES:');
    console.error(`  info.balance === 0: ${info.balance === 0}`);
    console.error(`  info.balance === undefined: ${info.balance === undefined}`);
    console.error(`  info.balance === null: ${info.balance === null}`);
    console.error(`  Boolean(info.balance): ${Boolean(info.balance)}`);
    console.error('─'.repeat(100));
    
    // TENTA EXTRAIR SALDO DE MÚLTIPLOS CAMINHOS
    const possibleBalances = {
      'info.balance': info.balance,
      'info.equity': info.equity,
      'info.accountInformation?.balance': (info as any).accountInformation?.balance,
      'info.account?.balance': (info as any).account?.balance,
      'info.data?.balance': (info as any).data?.balance,
    };
    
    console.error('🔎 TENTANDO EXTRAIR DE CAMINHOS ALTERNATIVOS:');
    for (const [path, value] of Object.entries(possibleBalances)) {
      if (value !== undefined && value !== null) {
        console.error(`  ✅ ${path}: $${value}`);
      } else {
        console.error(`  ❌ ${path}: ${value}`);
      }
    }
    
    // ENCONTRAR PRIMEIRO VALOR VÁLIDO
    const realBalance = Object.values(possibleBalances).find(v => typeof v === 'number' && v > 0) || info.balance || 0;
    
    console.error('─'.repeat(100));
    console.error(`🎯 SALDO EXTRAÍDO: $${realBalance}`);
    console.error('='.repeat(100) + '\n');
    
    return info;
  };
  
  return connection;
}
