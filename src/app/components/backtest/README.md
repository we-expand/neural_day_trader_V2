# 🎬 Backtest & Replay Module - COMPLETO v2.0

Sistema profissional e completo de Backtest e Replay de Mercado.

## 📦 Arquivos do Módulo

```
/src/app/components/backtest/
├── BacktestReplayBar.tsx          # Barra compacta de replay (50px)
├── BacktestConfigModal.tsx        # Modal de configuração COMPLETO
├── BacktestConfigSummary.tsx      # Resumo visual das configurações
├── StrategyBuilder.tsx            # Construtor visual de estratégias
├── BacktestDemo.tsx               # Demonstração standalone
└── README.md                      # Esta documentação

/src/app/hooks/
└── useBacktestReplay.ts           # Hook de estado do replay

/src/app/services/
└── BacktestDataService.ts         # Serviço de dados da Binance

/src/app/utils/
└── backtestHelpers.ts             # Funções utilitárias
```

## 🎯 Funcionalidades - COMPLETO

### 1. **Replay de Mercado** 🎬
✅ Barra compacta (50px)  
✅ Controles: play, pause, skip, reset  
✅ Velocidade: 0.5x, 1x, 2x, 5x, 10x  
✅ Timeline interativa  
✅ Efeito de "piscada" ao iniciar  
✅ Apenas Bitcoin

### 2. **Configuração de Backtest** ⚙️ (NOVO!)

#### 2.1 **Timeframe do Gráfico**
- ✅ 1 minuto
- ✅ 5 minutos
- ✅ 15 minutos
- ✅ 30 minutos
- ✅ 1 hora
- ✅ 4 horas
- ✅ 1 dia

**Descrição:** Define a temporalidade dos candles usados no backtest.

#### 2.2 **Períodos Pré-definidos + Customizado**
- ✅ **Último Mês** (1M)
- ✅ **Últimos 3 Meses** (3M)
- ✅ **Últimos 6 Meses** (6M)
- ✅ **Último Ano** (1Y)
- ✅ **Personalizado** (datas customizadas)

**Funcionalidade:** Ao clicar em um preset, as datas são calculadas automaticamente. O usuário pode customizar manualmente.

#### 2.3 **Direção do Trade**
- ✅ **Comprado (Long)** - Apenas posições de compra
- ✅ **Vendido (Short)** - Apenas posições de venda
- ✅ **Ambos** - Long e Short

**Visual:** Botões com ícones de setas e cores:
- 🟢 Verde para Long
- 🔴 Vermelho para Short
- 🔵 Azul para Ambos

#### 2.4 **Horários de Operação**
- ✅ **Toggle** ativado/desativado
- ✅ **Desativado:** Opera 24 horas
- ✅ **Ativado:** Define janela de horário
  - Horário de início (ex: 09:00)
  - Horário de fim (ex: 18:00)

**Uso:** Simula operações apenas nos horários definidos. Útil para traders que operam em horários específicos.

#### 2.5 **Outras Configurações**
- ✅ Período de análise (warmup para indicadores)
- ✅ Quantidade de contratos
- ✅ Máximo de contratos simultâneos
- ✅ Seleção de estratégia

### 3. **Strategy Builder** 🧠
- ✅ Construtor visual com blocos
- ✅ 6 tipos de condições
- ✅ Gerenciamento de risco (SL/TP)
- ✅ Salvamento em JSON

## 🎨 Interface Visual

### Modal de Configuração (Layout)

```
┌─────────────────────────────────────────────┐
│  ⚙️ Configurações de Execução               │
├─────────────────────────────────────────────┤
│                                             │
│  ATIVO              │  TIMEFRAME            │
│  ┌─────────────┐    │  ┌─────────────┐     │
│  │ ₿ BTCUSD   │    │  │ 1 hora ▼   │     │
│  └─────────────┘    │  └─────────────┘     │
│                                             │
│  PERÍODO DO BACKTEST                        │
│  [ 1M ] [ 3M ] [ 6M ] [ 1Y ] [Personalizado]│
│  ┌──────────────┐   ┌──────────────┐       │
│  │ Data Inicial │   │ Data Final   │       │
│  └──────────────┘   └──────────────┘       │
│                                             │
│  DIREÇÃO          │  HORÁRIOS               │
│  [🟢Long] [🔴Short] [🔵Ambos]              │
│                   │  Toggle: [ ON / OFF ]   │
│                   │  09:00 - 18:00          │
│                                             │
│  ESTRATÉGIA                                 │
│  [ ] Rompimento                             │
│  [✓] TDSM_98                                │
│  [ ] False Breaktroughs                     │
│                                             │
│              [Cancelar]  [▶️ Executar]      │
└─────────────────────────────────────────────┘
```

## 🚀 Fluxo de Uso Completo

### Cenário 1: Backtest Simples
```
1. Clique em "Backtest"
2. Selecione timeframe: "1 hora"
3. Clique em "Último Mês"
4. Direção: "Comprado"
5. Horários: Desativado (24h)
6. Selecione estratégia
7. Clique em "Executar Backtest"
```

### Cenário 2: Backtest Personalizado
```
1. Clique em "Backtest"
2. Timeframe: "15 minutos"
3. Período: "Personalizado"
   - Data inicial: 01/01/2026
   - Data final: 31/01/2026
4. Direção: "Ambos"
5. Horários: Ativado
   - Início: 14:00
   - Fim: 18:00
6. Quantidade: 2 contratos
7. Selecione estratégia
8. Executar
```

### Cenário 3: Criar Estratégia Nova
```
1. Clique em "Backtest"
2. Clique em "+ Nova Estratégia"
3. Strategy Builder abre
4. Nome: "Minha Estratégia"
5. Adicione condições de entrada
6. Adicione condições de saída
7. Configure SL/TP
8. Salve
9. Volta para configuração
10. Execute
```

## 📊 Tipos de Configuração

### BacktestConfig (Interface TypeScript)

```typescript
interface BacktestConfig {
  // Básico
  asset: string;                    // Ex: "BTCUSD"
  timeframe: Timeframe;             // Ex: "1h"
  
  // Período
  periodPreset: PeriodPreset;       // "1M" | "3M" | "6M" | "1Y" | "custom"
  startDate: string;                // "2026-01-01"
  endDate: string;                  // "2026-01-31"
  analysisDate: string;             // Warmup
  
  // Operação
  tradeDirection: TradeDirection;   // "long" | "short" | "both"
  quantity: number;                 // Contratos
  maxQuantity: number;              // Máximo simultâneo
  
  // Horários
  tradingHours: {
    enabled: boolean;               // Ativar/desativar
    startTime: string;              // "09:00"
    endTime: string;                // "18:00"
  };
  
  // Estratégia
  strategyId: string | null;        // ID da estratégia selecionada
}
```

## 🎯 Validações e Lógica

### Validação de Horários
```typescript
// Se horários estão ativados, validar trades apenas na janela
if (tradingHours.enabled) {
  const currentTime = candle.time.getHours() * 60 + candle.time.getMinutes();
  const startMinutes = parseTime(tradingHours.startTime);
  const endMinutes = parseTime(tradingHours.endTime);
  
  if (currentTime < startMinutes || currentTime > endMinutes) {
    // Pular este candle
    continue;
  }
}
```

### Validação de Direção
```typescript
// Filtrar sinais baseado na direção
if (tradeDirection === 'long' && signal.type === 'SHORT') {
  continue; // Pular shorts
}

if (tradeDirection === 'short' && signal.type === 'LONG') {
  continue; // Pular longs
}
```

### Cálculo de Período
```typescript
// Converter preset para datas
function getPeriodDates(preset: PeriodPreset) {
  const endDate = new Date();
  const startDate = new Date();
  
  switch (preset) {
    case '1M': startDate.setMonth(startDate.getMonth() - 1); break;
    case '3M': startDate.setMonth(startDate.getMonth() - 3); break;
    case '6M': startDate.setMonth(startDate.getMonth() - 6); break;
    case '1Y': startDate.setFullYear(startDate.getFullYear() - 1); break;
  }
  
  return { startDate, endDate };
}
```

## 📝 Checklist de Implementação

### ✅ COMPLETO
- [x] Timeframe do gráfico (7 opções)
- [x] Períodos pré-definidos (1M, 3M, 6M, 1Y)
- [x] Período customizado (datas manuais)
- [x] Direção do trade (Long/Short/Ambos)
- [x] Toggle de horários de operação
- [x] Seletor de horário início/fim
- [x] Visual com ícones e cores
- [x] Resumo da configuração
- [x] Validações de formulário

### ⏳ PRÓXIMO (Engine de Execução)
- [ ] Executar backtest real
- [ ] Aplicar filtros de horário
- [ ] Aplicar filtros de direção
- [ ] Calcular estatísticas
- [ ] Visualizar resultados

## 🎨 Design System

### Cores por Módulo
| Módulo | Cor | Uso |
|--------|-----|-----|
| Replay | Orange (#f97316) | Barra e controles |
| Backtest | Blue (#3b82f6) | Modal e botões |
| Strategy | Purple (#a855f7) | Construtor |
| Long | Emerald (#10b981) | Direção comprada |
| Short | Red (#ef4444) | Direção vendida |
| Both | Blue (#3b82f6) | Ambas direções |

## 🐛 Debug e Logs

```javascript
// Configuração
console.log('[BACKTEST_CONFIG] 📋 Configuração:', config);
console.log('[BACKTEST_CONFIG] ⏰ Horários:', tradingHours);
console.log('[BACKTEST_CONFIG] 📊 Timeframe:', timeframe);

// Execução
console.log('[BACKTEST_EXEC] 🚀 Iniciando backtest...');
console.log('[BACKTEST_EXEC] 📈 Período:', startDate, 'até', endDate);
console.log('[BACKTEST_EXEC] 🎯 Direção:', tradeDirection);
```

## 📚 Exemplos de Uso

### Exemplo 1: Day Trade
```json
{
  "timeframe": "5m",
  "period": "1M",
  "tradeDirection": "both",
  "tradingHours": {
    "enabled": true,
    "startTime": "10:00",
    "endTime": "16:00"
  }
}
```

### Exemplo 2: Swing Trade
```json
{
  "timeframe": "4h",
  "period": "6M",
  "tradeDirection": "long",
  "tradingHours": {
    "enabled": false
  }
}
```

### Exemplo 3: Scalping
```json
{
  "timeframe": "1m",
  "period": "custom",
  "startDate": "2026-02-01",
  "endDate": "2026-02-07",
  "tradeDirection": "both",
  "tradingHours": {
    "enabled": true,
    "startTime": "14:30",
    "endTime": "17:00"
  }
}
```

## 🔮 Roadmap

### v2.1 - Engine de Execução
- [ ] Executar backtest candle por candle
- [ ] Aplicar estratégias
- [ ] Calcular P&L
- [ ] Gerar trades

### v2.2 - Visualização
- [ ] Marcar trades no gráfico
- [ ] Estatísticas completas
- [ ] Equity curve
- [ ] Relatório PDF

### v2.3 - Otimização
- [ ] Grid search de parâmetros
- [ ] Walk-forward analysis
- [ ] Monte Carlo
- [ ] Machine Learning

## ⚠️ Observações Importantes

### Horários de Mercado por Ativo

#### Bitcoin (24/7)
- Sempre disponível
- Sem restrições

#### Forex
- Segunda 00:00 - Sexta 23:00 UTC
- Melhor liquidez: 08:00-17:00 UTC

#### US Stocks
- Segunda-Sexta 14:30-21:00 UTC (9:30-16:00 EST)
- Pre-market: 09:00-14:30 UTC
- After-hours: 21:00-01:00 UTC

#### Commodities
- Variam por commodity
- Ouro: 23:00-22:00 UTC (dom-sex)

### Recomendações de Uso

1. **Day Trading:** Use timeframes curtos (1m-15m) com horários específicos
2. **Swing Trading:** Use timeframes médios (1h-4h) sem restrição de horários
3. **Position Trading:** Use timeframes longos (4h-1d) sem restrição

---

**Status Atual:** ✅ UI COMPLETA | ⏳ Engine em Desenvolvimento  
**Última Atualização:** Fevereiro 2026  
**Neural Day Trader Platform**
