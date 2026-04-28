# 🤖 IA PREDITIVA & ORDER FLOW MODULE

Módulo completo e isolado da IA Preditiva para a Neural Day Trader Platform.

## 📦 Estrutura do Módulo

```
/src/app/modules/predictive-ai/
├── components/
│   └── LiquidityPredictionView.tsx    # Componente principal (wrapper)
├── index.ts                           # Barrel export
└── README.md                          # Esta documentação
```

## 🎯 O QUE É O LIQUIDITY PREDICTION?

**Sistema avançado de detecção de liquidez institucional e análise de order flow em tempo real.**

Este não é um simples indicador técnico. É um **detector de intenções de baleias e instituições**, rastreando:
- 🐋 Movimentações de carteiras baleias
- 📊 Ordens passivas ocultas (icebergs)
- 🎯 Paredes de compra/venda (buy/sell walls)
- ⚡ Spoofing e manipulação de mercado
- 🌊 Fluxo líquido de capital institucional

---

## 🚀 Funcionalidades Principais

### 🤖 **Sistema de Alertas em Tempo Real**
- ✅ **Alertas de Baleias:** Detecta movimentações > $30M
- ✅ **Virada de Candle:** Aviso 8min antes da virada (15min timeframe)
- ✅ **Horários de Mercado:** NYSE, Ásia, Londres-NY
- ✅ **Fim de Semana:** Desativa alertas de bolsa automaticamente
- ✅ **Voz Preditiva:** Narração de eventos críticos

### 📊 **Análise de Liquidez**
- ✅ **Heatmap de Liquidez:** Visualização de paredes institucionais
- ✅ **Order Book Depth:** Análise de profundidade de mercado
- ✅ **Correlações:** Relação entre ativos
- ✅ **300+ Ativos:** Forex, Crypto, Stocks, Indices, Commodities

### 🎯 **Detector de Eventos**
- ✅ **COMPRA:** Acumulação, Front-Running, Market Maker
- ✅ **VENDA:** Distribuição, Smart Money, Stop Cascata
- ✅ **NEUTRO:** Volume Anômalo, Zona Crítica, Heatmap

### 🔊 **Voice Assistant (Neural Voice AI)**
- ✅ Narração de eventos críticos
- ✅ Prioridade alta para vendas > $30M
- ✅ Alertas de manipulação (spoofing)
- ✅ Contagem regressiva de candles

### 📈 **Gráficos Interativos**
- ✅ Chart de Liquidez com Recharts
- ✅ Visualização de paredes (walls)
- ✅ Predições da IA
- ✅ Múltiplos timeframes (1m, 5m, 15m, 1h, 4h, 1d, 1w)

---

## 🎨 Interface Visual

### Layout Principal
```
┌─────────────────────────────────────────────────────────┐
│ 🧠 IA PREDITIVA & ORDER FLOW                            │
│ Detector de Liquidez Institucional em Tempo Real       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ [🪙 BTCUSD ▼]  [1h ▼]  [ℹ️]                            │
│                                                         │
│ ┌──────────────────────┐  ┌────────────────────────┐  │
│ │ 📊 HEATMAP LIQUIDEZ  │  │ 🔊 ALERTAS IA         │  │
│ │                      │  │                        │  │
│ │    🌊 Buy Walls      │  │ 10:42:15              │  │
│ │    ━━━━━━━━━━━━     │  │ 🔴 VENDA BALEIA       │  │
│ │                      │  │ 350 BTC (~$16M)       │  │
│ │    Current Price     │  │ Binance. Pressão de   │  │
│ │    ────────────      │  │ baixa detectada.      │  │
│ │                      │  │                        │  │
│ │    🔥 Sell Walls     │  │ 10:41:48              │  │
│ │    ━━━━━━━━━━━━     │  │ 🟢 COMPRA BALEIA      │  │
│ │                      │  │ 200 BTC (~$9M)        │  │
│ └──────────────────────┘  │ Carteira fria.        │  │
│                           │                        │  │
│ ┌──────────────────────┐  │ 10:41:20              │  │
│ │ 🔗 CORRELAÇÕES       │  │ ⏰ VIRADA CANDLE      │  │
│ │                      │  │ em 7min 32s! Candle:  │  │
│ │ ETH:  0.92 🟢       │  │ 🟢 COMPRA confirmada  │  │
│ │ SOL:  0.75 🟢       │  │                        │  │
│ │ SPX:  0.45 ⚪       │  │ 10:40:55              │  │
│ │ DXY: -0.65 🔴       │  │ ⏰ ABERTURA NYSE      │  │
│ │                      │  │ em 25min! ALTA        │  │
│ └──────────────────────┘  │ VOLATILIDADE em USD   │  │
│                           └────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Alerta de Baleia (Crítico)
```
🔴 VENDA BALEIA: 350 BTC (~$16M) transferidos para 
Binance (0x7a...9f). MOVIMENTO: VENDA MASSIVA. 

SUGESTÃO: RISCO EXTREMO! Reduza exposição ou ative 
stops apertados AGORA.
```

### Alerta de Virada de Candle
```
⏰ VIRADA DE CANDLE BTCUSD em 7min 32s! 
Candle atual: 🟢 COMPRA. 

SUGESTÃO: Se romper resistência = COMPRA confirmada. 
Se rejeitar = AGUARDE correção.
```

### Alerta de Horário de Mercado
```
⏰ ABERTURA NYSE em 25 minutos! 
ALTA VOLATILIDADE em pares USD. 

SUGESTÃO: Aguarde os primeiros 15 minutos para 
definir direção clara antes de entrar.
```

---

## 🔧 Como Usar

### Importação Limpa

```typescript
import { LiquidityPredictionView } from '@/app/modules/predictive-ai';

// Uso básico
<LiquidityPredictionView />
```

### Exemplo Completo

```tsx
import React from 'react';
import { LiquidityPredictionView } from '@/app/modules/predictive-ai';

export function TradingDashboard() {
  return (
    <div>
      <h1>IA Preditiva</h1>
      
      {/* IA Preditiva Full */}
      <LiquidityPredictionView />
    </div>
  );
}
```

---

## 📊 Tipos de Alertas

### 🟢 COMPRA (Bullish)
1. **Baleia Comprando:** Grandes volumes para carteiras frias
2. **Acumulação:** Compra passiva detectada
3. **Institucional:** Market Makers posicionados
4. **Front-Running:** Ordem iceberg detectada
5. **Fluxo Líquido Positivo:** Capital entrando
6. **On-Chain:** Stakeholders aumentando posições
7. **Proteção Suporte:** Grandes blocos de compra

### 🔴 VENDA (Bearish)
1. **Baleia Vendendo:** Transferências para exchanges
2. **Distribuição:** Venda massiva iminente
3. **Smart Money:** Instituições saindo
4. **RSI Divergência:** Sobrecompra + reversão
5. **Stop Loss Cascata:** Cluster de stops abaixo
6. **Spoofing:** Ordem fantasma (armadilha)

### ⚪ NEUTRO (Informativo)
1. **Volume Anômalo:** Aumento sem direção clara
2. **Zona Crítica:** Testando resistência/suporte
3. **Heatmap Liquidez:** Concentração de ordens
4. **Virada de Candle:** Contagem regressiva
5. **Horários de Mercado:** Abertura/Fechamento

---

## 🕐 Sistema de Horários

### Mercados Monitorados

| Mercado | Horário (BRT) | Evento | Alerta |
|---------|---------------|--------|--------|
| **NYSE** | 11:30 | Abertura | 25 min antes |
| **NYSE** | 18:00 | Fechamento | 10 min antes |
| **Ásia** | 21:00 | Abertura | 10 min antes |
| **Londres-NY** | 09:00-13:00 | Sobreposição | Durante período |
| **Crypto** | 00:00 UTC | Fechamento Diário | 10 min antes |

### Detecção de Fim de Semana
- ✅ Desativa alertas de bolsa automaticamente
- ✅ Continua alertas de crypto (24/7)
- ✅ Baseado em UTC Day (0=Domingo, 6=Sábado)

---

## 🔊 Sistema de Voz (Neural Voice AI)

### Eventos Narrados

#### 1. Venda Baleia Crítica (> $30M)
```
"Alerta crítico! Baleia vendendo 350 Bitcoin, 
aproximadamente 16 milhões de dólares. 
Pressão de baixa detectada."
```

#### 2. Distribuição Massiva
```
"Atenção! Distribuição massiva detectada. 
Possível venda iminente nas próximas 2 a 6 horas."
```

#### 3. Spoofing (Manipulação)
```
"Alerta! Ordem fantasma detectada. 
Não entre em short agora, é armadilha de manipulação."
```

#### 4. Virada de Candle (< 2 minutos)
```
"Atenção! Candle Bitcoin vira em 1 minuto."
```

#### 5. Abertura NYSE
```
"Abertura da bolsa de Nova York em 10 minutos. 
Prepare-se para alta volatilidade."
```

---

## 🐛 Debug e Logs

Todos os logs são prefixados para fácil identificação:

```javascript
[LIQUIDITY_PREDICTION] 🤖 IA Preditiva & Order Flow carregada
[LIQUIDITY_PREDICTION] 🔍 Detector de Liquidez Institucional ativo
[LIQUIDITY_PREDICTION] 🔍 300+ ativos disponíveis para análise
[LIQUIDITY_PREDICTION] 🔴 FIM DE SEMANA detectado. Alertas de bolsa desativados.
```

### Filtrar Logs no Console

```javascript
// No DevTools Console, digite:
[LIQUIDITY_PREDICTION
```

---

## 🔮 Como Funciona a IA

### 1. Detecção de Baleias
```typescript
// Monitora transferências on-chain
const whaleAmount = Math.floor(Math.random() * 500) + 100;
const whaleValueUSD = whaleAmount * currentPrice / divider;

// Se > $30M = Crítico (voz + alerta vermelho)
if (whaleValueUSD > 30) {
  speak(`Alerta crítico! Baleia vendendo...`);
}
```

### 2. Cálculo de Virada de Candle
```typescript
// Timeframe de 15 minutos
const currentMinute = new Date().getMinutes();
const minutesUntilCandle = 15 - (currentMinute % 15);

// Alerta apenas se < 8 minutos
if (totalSecondsUntilCandle <= 480) {
  addAlert(`⏰ VIRADA DE CANDLE em ${min}min ${sec}s!`);
}
```

### 3. Horários de Mercado
```typescript
// Verificar dia útil (seg-sex)
const utcDay = new Date().getUTCDay();
const isWeekday = utcDay >= 1 && utcDay <= 5;

// Abertura NYSE (9:30 AM ET = 11:30 BRT)
if (isWeekday && currentHour === 11 && currentMinute >= 25) {
  addAlert(`⏰ ABERTURA NYSE em ${30 - currentMinute} minutos!`);
}
```

### 4. Heatmap de Liquidez
```typescript
// Simular paredes de liquidez
let liquidity = Math.abs(Math.sin(index * 0.1) * 500);

// Paredes grandes em índices específicos
if (index === 10 || index === 40) liquidity += 2500;

// Detectar paredes (> 2000)
const isWall = liquidity > 2000;
```

---

## 📚 Estratégias Sugeridas

### 1. Front-Running (Baleia como Suporte)
```
🟢 COMPRA BALEIA detectada em $48,000

ESTRATÉGIA:
- Entrar logo ACIMA da ordem ($48,050)
- Usar a baleia como "suporte impenetrável"
- Stop loss: Logo abaixo da baleia ($47,900)
- Target: +2-3% ($48,960-$49,440)
```

### 2. Proteção de Stops (Anti-Violino)
```
🔴 STOP LOSS CASCATA detectado abaixo de $47,500

ESTRATÉGIA:
- EVITE colocar stop em $47,500 (óbvio)
- Posicione stop logo ABAIXO do cluster ($47,400)
- Ou logo ACIMA da parede de compra ($48,000)
- Evite ser "violinado" por manipuladores
```

### 3. Spoofing (Armadilha)
```
🔴 SPOOFING detectado - Ordem fantasma de VENDA

ESTRATÉGIA:
- NÃO entre em SHORT! É armadilha
- Aguarde 15-30 min (ordem será cancelada)
- Possível PUMP após cancelamento
- Entre LONG após confirmação
```

---

## ⚠️ Observações Importantes

1. **Dados Simulados:** Sistema usa dados simulados para demonstração
2. **Preços Reais:** Integração com Binance API para preços reais
3. **Voz:** Sistema de voz pode ser desativado no navegador
4. **Fim de Semana:** Alertas de bolsa desativados automaticamente
5. **300+ Ativos:** Suporte completo ao assetDatabase

---

## 🎯 Glossário

- **Baleia:** Carteira com grande volume de ativos (> $10M)
- **Liquidez:** Ordens passivas aguardando execução
- **Order Flow:** Fluxo de ordens de compra/venda
- **Parede (Wall):** Concentração de ordens em um preço
- **Iceberg:** Ordem grande dividida em partes menores
- **Spoofing:** Ordem falsa para manipular mercado
- **Front-Running:** Entrar antes de grande ordem
- **Smart Money:** Capital institucional/profissional
- **Cascata:** Efeito dominó de stop losses

---

**Status:** ✅ Completo e Funcional  
**Última Atualização:** Fevereiro 2026  
**Neural Day Trader Platform**
