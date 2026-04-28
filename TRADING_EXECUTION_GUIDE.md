# 🔥 GUIA DE EXECUÇÃO DE TRADES REAIS - MetaAPI Direct Client

## ✅ MÉTODOS IMPLEMENTADOS

Todos os métodos de execução de ordens reais foram implementados em `/src/app/services/MetaAPIDirectClient.ts`

---

## 📖 REFERÊNCIA RÁPIDA

### 1️⃣ COMPRA A MERCADO (BUY)

```typescript
const result = await client.createMarketBuyOrder({
  symbol: 'BTCUSD',
  volume: 0.01,              // 0.01 lotes
  stopLoss: 95000,           // Opcional: SL a $95,000
  takeProfit: 105000,        // Opcional: TP a $105,000
  comment: 'AI Neural Trade',
  magic: 123456
});

if (result.success) {
  console.log('✅ COMPRA EXECUTADA:', result.orderId);
  console.log('Preço:', result.price);
} else {
  console.error('❌ ERRO:', result.error);
}
```

---

### 2️⃣ VENDA A MERCADO (SELL)

```typescript
const result = await client.createMarketSellOrder({
  symbol: 'BTCUSD',
  volume: 0.01,
  stopLoss: 105000,          // SL acima do preço (venda)
  takeProfit: 95000,         // TP abaixo do preço (venda)
  comment: 'AI Neural Trade',
  magic: 123456
});
```

---

### 3️⃣ FECHAR POSIÇÃO

```typescript
// Fechar posição completa
const result = await client.closePosition('12345678');

if (result.success) {
  console.log('✅ POSIÇÃO FECHADA');
}
```

---

### 4️⃣ FECHAR POSIÇÃO PARCIALMENTE

```typescript
// Fechar apenas 50% da posição (ex: 0.05 lotes de 0.10 total)
const result = await client.closePositionPartially('12345678', 0.05);
```

---

### 5️⃣ MODIFICAR STOP LOSS / TAKE PROFIT

```typescript
// Alterar SL/TP de posição existente
const result = await client.modifyPosition(
  '12345678',     // Position ID
  96000,          // Novo Stop Loss
  104000          // Novo Take Profit
);
```

---

### 6️⃣ FECHAR TODAS POSIÇÕES DE UM SÍMBOLO

```typescript
// Fechar todas posições de BTCUSD
const result = await client.closeAllPositionsBySymbol('BTCUSD');

console.log(result.message); 
// Ex: "3 posições fechadas de BTCUSD (0 falharam)"
```

---

### 7️⃣ FECHAR TODAS AS POSIÇÕES (BOTÃO DE PÂNICO 🚨)

```typescript
// EMERGÊNCIA: Fecha TODAS as posições da conta
const result = await client.closeAllPositions();

console.log(result.message);
// Ex: "12 posições fechadas (0 falharam)"
```

---

### 8️⃣ OBTER INFORMAÇÕES DE UMA POSIÇÃO

```typescript
const position = await client.getPositionById('12345678');

if (position) {
  console.log('Símbolo:', position.symbol);
  console.log('Volume:', position.volume);
  console.log('Profit:', position.profit);
  console.log('Tipo:', position.type); // BUY ou SELL
}
```

---

## 🛡️ EXEMPLO COMPLETO: TRADE COM PROTEÇÃO

```typescript
import { getMetaAPIClient } from '@/app/services/MetaAPIDirectClient';

async function executeProtectedTrade() {
  try {
    // 1. Obter cliente
    const client = getMetaAPIClient();
    
    // 2. Verificar se está conectado
    if (!client.isConnected()) {
      console.error('❌ MT5 não conectado!');
      return;
    }

    // 3. Obter preço atual
    const prices = await client.getPrices(['BTCUSD']);
    const currentPrice = prices[0]?.bid || 0;

    if (currentPrice === 0) {
      console.error('❌ Preço não disponível');
      return;
    }

    // 4. Calcular SL e TP (Risk:Reward 1:2)
    const stopLoss = currentPrice - 1000;   // SL -$1000
    const takeProfit = currentPrice + 2000; // TP +$2000

    // 5. Executar compra
    const result = await client.createMarketBuyOrder({
      symbol: 'BTCUSD',
      volume: 0.01,
      stopLoss,
      takeProfit,
      comment: 'AI Neural Trade - Protected',
      magic: 123456
    });

    // 6. Verificar resultado
    if (result.success) {
      console.log('✅ TRADE EXECUTADO COM SUCESSO!');
      console.log('Order ID:', result.orderId);
      console.log('Position ID:', result.positionId);
      console.log('Preço:', result.price);
      console.log('Volume:', result.volume);
      console.log('SL:', stopLoss);
      console.log('TP:', takeProfit);
    } else {
      console.error('❌ FALHA AO EXECUTAR TRADE:', result.error);
    }

  } catch (error) {
    console.error('❌ ERRO CRÍTICO:', error);
  }
}
```

---

## ⚠️ VALIDAÇÕES IMPORTANTES

### Antes de executar qualquer trade REAL:

```typescript
// 1. Verificar conexão MT5
if (!client.isConnected()) {
  throw new Error('MT5 desconectado!');
}

// 2. Verificar saldo disponível
const accountInfo = await client.getAccountInfo();
if (!accountInfo || accountInfo.freeMargin < requiredMargin) {
  throw new Error('Margem insuficiente!');
}

// 3. Validar volume mínimo/máximo
const minVolume = 0.01; // MT5 padrão
const maxVolume = 100;  // Depende do broker
if (volume < minVolume || volume > maxVolume) {
  throw new Error('Volume inválido!');
}

// 4. Validar símbolo
const validSymbols = ['BTCUSD', 'ETHUSD', 'EURUSD', 'US30', ...];
if (!validSymbols.includes(symbol)) {
  throw new Error('Símbolo não suportado!');
}
```

---

## 🚨 MODO DEMO vs LIVE

```typescript
// Verificar modo de execução
const executionMode = 'LIVE'; // ou 'DEMO'

if (executionMode === 'LIVE') {
  // CONFIRMAÇÃO DUPLA OBRIGATÓRIA
  const confirmed = await showLiveModeConfirmation();
  
  if (!confirmed) {
    console.log('⛔ Trade cancelado pelo usuário');
    return;
  }
}

// Executar trade
const result = await client.createMarketBuyOrder({...});
```

---

## 📊 ESTRUTURA DE RESPOSTA

Todos os métodos retornam `TradeResult`:

```typescript
interface TradeResult {
  success: boolean;        // true se executou com sucesso
  orderId?: string;        // ID da ordem (se sucesso)
  positionId?: string;     // ID da posição (se sucesso)
  error?: string;          // Mensagem de erro (se falha)
  message?: string;        // Mensagem descritiva
  price?: number;          // Preço de execução (se sucesso)
  volume?: number;         // Volume executado (se sucesso)
}
```

---

## 🔐 SEGURANÇA

### ✅ PROTEÇÕES IMPLEMENTADAS:

1. **Verificação de conexão** - Não executa se MT5 desconectado
2. **Try-Catch em todos os métodos** - Erros sempre retornam `success: false`
3. **Logging completo** - Todos trades são logados no console
4. **Magic Number** - Identifica trades da plataforma (padrão: 123456)
5. **Comentários** - Todas ordens têm "Neural Day Trader" como comentário

### ⚠️ RECOMENDAÇÕES:

- **SEMPRE testar em DEMO primeiro**
- **NUNCA executar trades sem confirmação do usuário em modo LIVE**
- **Implementar limites de perda diária/semanal**
- **Monitorar margem disponível antes de cada trade**
- **Implementar circuit breaker** (parar após X perdas consecutivas)

---

## 🎯 PRÓXIMOS PASSOS

1. ✅ Métodos de execução implementados
2. 🔲 Integrar com AI Trading Engine
3. 🔲 Adicionar validações de risco
4. 🔲 Implementar circuit breaker
5. 🔲 Adicionar confirmação visual em modo LIVE
6. 🔲 Criar dashboard de execução em tempo real
7. 🔲 Implementar trailing stop loss
8. 🔲 Adicionar gestão de risco automática

---

## ✅ STATUS ATUAL

**A plataforma AGORA PODE executar trades reais no MT5 via MetaAPI! 🚀**

Todos os métodos estão implementados e prontos para uso:
- ✅ Compra a mercado
- ✅ Venda a mercado
- ✅ Fechar posição
- ✅ Fechar parcialmente
- ✅ Modificar SL/TP
- ✅ Fechar por símbolo
- ✅ Fechar todas (emergência)
- ✅ Obter info de posição

---

**⚠️ LEMBRE-SE: Com grandes poderes vêm grandes responsabilidades!**

Teste exaustivamente em DEMO antes de usar dinheiro real! 💰
