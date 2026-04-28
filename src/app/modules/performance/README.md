# 📊 PERFORMANCE MODULE

## 🎯 **VISÃO GERAL**

Módulo independente e isolado para análise completa de performance de trading.

**Localização:** `/src/app/modules/performance/`

**Logs prefixados:** `[PERFORMANCE]`

---

## 📁 **ESTRUTURA**

```
/src/app/modules/performance/
├── index.tsx                 # Exports principais
├── PerformanceView.tsx       # Componente principal (wrapper)
├── types.ts                  # Tipos TypeScript
├── utils.ts                  # Funções auxiliares
└── README.md                 # Esta documentação
```

---

## ✨ **FEATURES**

### **1. Métricas Gerais**
- ✅ Lucro/Prejuízo Líquido
- ✅ Taxa de Acerto (Win Rate)
- ✅ Profit Factor
- ✅ Total de Trades
- ✅ ROI (Return on Investment)
- ✅ Volume Total Negociado

### **2. Métricas Avançadas**
- ✅ Sharpe Ratio
- ✅ Max Drawdown
- ✅ Melhor/Pior Trade
- ✅ Média de Lucro/Prejuízo
- ✅ Wins/Losses Consecutivos
- ✅ Tempo Médio de Holding

### **3. Gráficos Interativos**
- ✅ P&L Acumulado (área)
- ✅ Performance Mensal (barras)
- ✅ Performance por Ativo
- ✅ Comparação temporal

### **4. Filtros**
- ✅ Timeframe (24h, 7d, 30d, 90d, 1y, all)
- ✅ Por Ativo (BTC, ETH, etc.)
- ✅ Por Status (OPEN, CLOSED)

### **5. Tabela de Trades**
- ✅ Histórico completo
- ✅ Ordenação por data
- ✅ Status visual
- ✅ P&L colorido

### **6. Exportação**
- ✅ Export CSV (em desenvolvimento)
- ✅ Refresh manual
- ✅ Filtros aplicáveis

---

## 🚀 **COMO USAR**

### **1. Importar no App.tsx**

```typescript
import { PerformanceView } from '@/app/modules/performance';

// Adicionar na view
{currentView === 'performance' && <PerformanceView />}
```

### **2. Adicionar rota no Sidebar**

```typescript
const menuItems = [
  // ...
  { id: 'performance', label: 'Performance', icon: TrendingUp },
];
```

### **3. Navegação**

```typescript
// Programaticamente
setCurrentView('performance');

// Via Sidebar (já configurado)
// Usuário clica em "Performance" no menu
```

---

## 📊 **TIPOS PRINCIPAIS**

### **TradeHistory**
```typescript
interface TradeHistory {
  id: string;
  asset_symbol: string;
  type: 'BUY' | 'SELL';
  entry_price: number;
  exit_price?: number;
  quantity: number;
  profit_loss?: number;
  profit_loss_percent?: number;
  opened_at: string;
  closed_at?: string;
  status: 'OPEN' | 'CLOSED' | 'PENDING';
  strategy?: string;
  notes?: string;
}
```

### **PerformanceMetrics**
```typescript
interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalProfit: number;
  totalLoss: number;
  netProfit: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  avgHoldingTime: number;
  bestTrade: number;
  worstTrade: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  roi: number;
  totalVolume: number;
}
```

---

## 🔧 **FUNÇÕES UTILITÁRIAS**

### **calculatePerformanceMetrics()**
Calcula todas as métricas de performance a partir do histórico de trades.

```typescript
const metrics = calculatePerformanceMetrics(trades);
// Retorna: PerformanceMetrics
```

### **groupTradesByDay()**
Agrupa trades por dia para gráfico temporal.

```typescript
const daily = groupTradesByDay(trades);
// Retorna: DailyPerformance[]
```

### **groupPerformanceByAsset()**
Agrupa performance por ativo.

```typescript
const byAsset = groupPerformanceByAsset(trades);
// Retorna: AssetPerformance[]
```

### **groupTradesByMonth()**
Agrupa trades por mês.

```typescript
const monthly = groupTradesByMonth(trades);
// Retorna: MonthlyStats[]
```

### **formatCurrency()**
Formata valores monetários em USD.

```typescript
formatCurrency(1234.56); // "$1,234.56"
formatCurrency(-500);     // "-$500.00"
```

### **formatPercent()**
Formata percentuais com sinal.

```typescript
formatPercent(5.67);  // "+5.67%"
formatPercent(-2.34); // "-2.34%"
```

### **generateMockTrades()**
Gera dados mock para testes.

```typescript
const mockTrades = generateMockTrades(100);
// Retorna: TradeHistory[] com 100 trades simulados
```

---

## 🎨 **COMPONENTES UI**

### **Metrics Cards**
4 cards principais com métricas em destaque:
- Lucro Líquido (verde/vermelho)
- Taxa de Acerto (roxo)
- Profit Factor (cyan)
- Total de Trades (âmbar)

### **Charts**
2 gráficos interativos (Recharts):
- P&L Acumulado (AreaChart)
- Performance Mensal (BarChart)

### **Asset Performance**
Lista scrollable com performance por ativo:
- Net Profit
- Win Rate
- Trades Count
- Avg Profit

### **Stats Panel**
Painel lateral com métricas adicionais:
- Sharpe Ratio (com barra de progresso)
- Max Drawdown
- Best/Worst Trade
- Tempo Médio
- Wins/Losses Consecutivos

### **Trades Table**
Tabela completa com:
- Data
- Ativo
- Tipo (BUY/SELL)
- Entrada/Saída
- Quantidade
- P&L
- Status

---

## 🔄 **INTEGRAÇÃO COM SUPABASE**

### **Tabela: trades**

```sql
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  asset_symbol VARCHAR(20) NOT NULL,
  type VARCHAR(10) NOT NULL, -- BUY, SELL
  entry_price DECIMAL(20, 8) NOT NULL,
  exit_price DECIMAL(20, 8),
  quantity DECIMAL(20, 8) NOT NULL,
  profit_loss DECIMAL(20, 2),
  profit_loss_percent DECIMAL(10, 2),
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'OPEN', -- OPEN, CLOSED, PENDING
  strategy VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### **Carregar dados reais:**

```typescript
// TODO: Implementar integração com Supabase
import { supabase } from '@/lib/supabase';

useEffect(() => {
  const loadTrades = async () => {
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', user.id)
      .order('opened_at', { ascending: false });

    if (data) setTrades(data);
  };

  loadTrades();
}, [user]);
```

---

## 📈 **CÁLCULOS**

### **Win Rate**
```
Win Rate = (Trades Vencedores / Total de Trades) × 100
```

### **Profit Factor**
```
Profit Factor = Total de Lucros / Total de Prejuízos
```

### **Sharpe Ratio** (simplificado)
```
Sharpe Ratio = Retorno Médio / Desvio Padrão dos Retornos
```

### **Max Drawdown**
```
Max Drawdown = Máxima queda do pico até o vale
```

### **ROI**
```
ROI = (Lucro Líquido / Capital Inicial) × 100
```

---

## 🐛 **DEBUGGING**

### **Ativar logs:**

```typescript
// Todos os logs possuem prefixo [PERFORMANCE]
console.log('[PERFORMANCE] 🚀 Performance View mounted');
console.log('[PERFORMANCE] 📊 Calculating performance metrics...');
console.log('[PERFORMANCE] ✅ Metrics calculated:', metrics);
```

### **Filtrar logs no console:**

```javascript
// Chrome DevTools Console
// Filter: [PERFORMANCE]
```

---

## 🔮 **PRÓXIMAS FEATURES**

### **1. Integração Supabase Real** ⏳
- Carregar trades do banco de dados
- Sincronização em tempo real
- Filtros por usuário

### **2. Export CSV** ⏳
- Download de relatórios
- Formatação customizada
- Agendamento de relatórios

### **3. Comparação com Benchmark** ⏳
- S&P 500
- Bitcoin
- Índices customizados

### **4. Análise de Risco** ⏳
- Value at Risk (VaR)
- Expected Shortfall (CVaR)
- Sortino Ratio
- Calmar Ratio

### **5. Alertas Inteligentes** ⏳
- Notificações de drawdown
- Alertas de win rate
- Metas de performance

### **6. Dashboard Mobile** ⏳
- Responsividade total
- Gestos touch
- Layout otimizado

---

## 📝 **CHANGELOG**

### **v1.0.0 (2026-02-13)**
- ✅ Estrutura modular independente
- ✅ Métricas completas de performance
- ✅ Gráficos interativos (Recharts)
- ✅ Filtros por timeframe e ativo
- ✅ Tabela de histórico de trades
- ✅ Performance por ativo
- ✅ Stats mensais
- ✅ Dados mock para testes
- ✅ Integração no App.tsx
- ✅ Logs prefixados [PERFORMANCE]

---

## 🤝 **CONTRIBUINDO**

### **Para adicionar nova métrica:**

1. Adicionar tipo em `types.ts`:
```typescript
export interface PerformanceMetrics {
  // ...
  myNewMetric: number; // Nova métrica
}
```

2. Calcular em `utils.ts`:
```typescript
export function calculatePerformanceMetrics(trades: TradeHistory[]): PerformanceMetrics {
  // ...
  const myNewMetric = calculateMyMetric(trades);
  
  return {
    // ...
    myNewMetric,
  };
}
```

3. Exibir em `PerformanceView.tsx`:
```typescript
<div className="p-3 rounded-lg bg-neutral-800/40">
  <span className="text-xs text-neutral-400">Minha Métrica</span>
  <span className="text-sm font-bold text-white">
    {metrics.myNewMetric}
  </span>
</div>
```

---

## 📞 **SUPORTE**

- **Logs:** Filtrar por `[PERFORMANCE]` no console
- **Estrutura:** `/src/app/modules/performance/`
- **Tipos:** `types.ts`
- **Utils:** `utils.ts`
- **Main:** `PerformanceView.tsx`

---

## ✅ **STATUS**

- 🟢 **Módulo:** Funcional e independente
- 🟢 **UI:** Completa e responsiva
- 🟡 **Dados:** Mock (aguardando Supabase real)
- 🟡 **Export:** Em desenvolvimento
- 🟢 **Performance:** Otimizado com useMemo

---

**MÓDULO PRONTO PARA USO!** 🚀📊

---

**Desenvolvido em:** 13/02/2026  
**Versão:** 1.0.0  
**Status:** ✅ Estável
