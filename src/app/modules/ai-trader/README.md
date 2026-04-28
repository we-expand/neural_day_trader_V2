# 🤖 AI TRADER MODULE

Módulo completo e isolado do AI Trader para a Neural Day Trader Platform.

## 📦 Estrutura do Módulo

```
/src/app/modules/ai-trader/
├── components/
│   └── AITraderView.tsx           # Componente principal (wrapper)
├── index.ts                       # Barrel export
└── README.md                      # Esta documentação
```

## 🎯 Por que Modularizar?

### ✅ Benefícios

1. **🐛 Debug Facilitado**
   - Logs prefixados: `[AI_TRADER]`
   - Fácil rastrear bugs específicos do AI
   - Console limpo e organizado

2. **📁 Organização Clara**
   - Tudo relacionado ao AI Trader em um único lugar
   - Estrutura previsível e escalável
   - Fácil de encontrar arquivos

3. **♻️ Reutilização**
   - Componente independente
   - Pode ser usado em outros projetos
   - Potencial para virar npm package

4. **🧪 Testabilidade**
   - Testes unitários isolados
   - Mock de dependências simplificado
   - TDD facilitado

5. **👥 Trabalho em Equipe**
   - Diferentes devs podem trabalhar em módulos diferentes
   - Menos conflitos de merge
   - Responsabilidades claras

6. **📚 Documentação**
   - README específico do módulo
   - Exemplos de uso contextualizados
   - Onboarding mais rápido

## 🚀 Funcionalidades do AI Trader

### 🤖 **Sistema de Trading Automatizado**
- ✅ 2 Modos: **MONITOR** (Dashboard) e **ENGINEER** (Configuração)
- ✅ Status: Ativo/Pausado
- ✅ Integração com TradingContext global
- ✅ Logs em tempo real

### 📊 **Configurações Avançadas**
- ✅ **Estilo de Trading:** Scalping, Day-Trade, Swing
- ✅ **Direção:** AUTO, LONG, SHORT
- ✅ **Risk Management:** Stop Loss, Take Profit, Max Drawdown
- ✅ **Gerenciamento de Capital:** % por trade, alavancagem
- ✅ **Universo de Ativos:** Seleção múltipla de 300+ ativos

### 🔧 **Ferramentas Integradas**
- ✅ **Calculadora de Posição:** Calcular tamanho de posição
- ✅ **Conversor de Moedas:** BRL/USD/EUR
- ✅ **Gráfico de Equity:** Evolução do patrimônio
- ✅ **Timer de Sessão:** Controle de tempo de operação
- ✅ **Assistente de Voz:** Comandos por voz

### 💼 **Workspace Manager**
- ✅ Salvar configurações
- ✅ Carregar perfis
- ✅ Múltiplos workspaces
- ✅ Backup automático

### 🔌 **Integração MT5**
- ✅ Conexão com MetaTrader 5
- ✅ Login/Password/Server
- ✅ Status de conexão
- ✅ Validação de token

### 💎 **Features Premium**
- ✅ Reset de conta com modal premium
- ✅ Hedge automático
- ✅ Portfolio visualization
- ✅ Smart Wallet integration

## 🎨 Interface

### Modo MONITOR (Dashboard)
```
┌─────────────────────────────────────────────────────┐
│  🤖 AI TRADER                    [▶️ ATIVO]         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  📊 Portfolio                    📜 Logs           │
│  ┌─────────────┐                 ┌─────────────┐  │
│  │ Balance     │                 │ 10:23:45    │  │
│  │ $100,000    │                 │ ✅ BTCUSD   │  │
│  │             │                 │ Comprado    │  │
│  │ P&L: +5%    │                 │ @ $48,000   │  │
│  └─────────────┘                 └─────────────┘  │
│                                                     │
│  🎯 Posições Ativas (3)                            │
│  ┌───────────────────────────────────────────────┐ │
│  │ [LONG] BTCUSD  +$1,500  @48,000  SL:46,000   │ │
│  │ [SHORT] EURUSD -$200    @1.10    SL:1.12     │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Modo ENGINEER (Configuração)
```
┌─────────────────────────────────────────────────────┐
│  ⚙️ CONFIGURAÇÃO DO AI                              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  🎯 Estratégia                                      │
│  ○ Scalping   ● Day-Trade   ○ Swing               │
│                                                     │
│  📈 Direção                                         │
│  ● AUTO   ○ LONG   ○ SHORT                         │
│                                                     │
│  💰 Risk Management                                 │
│  ├─ Risk por Trade: [2%]                           │
│  ├─ Stop Loss: [1.5%]                              │
│  ├─ Take Profit: [3.0%]                            │
│  └─ Max Drawdown: [10%]                            │
│                                                     │
│  🌍 Ativos (8 selecionados)                        │
│  ☑️ BTCUSD  ☑️ EURUSD  ☑️ AAPL  ☑️ GOLD           │
│                                                     │
│  [💾 SALVAR] [🔄 RESET] [📁 WORKSPACES]            │
└─────────────────────────────────────────────────────┘
```

## 🔧 Como Usar

### Importação Limpa

```typescript
import { AITraderView } from '@/app/modules/ai-trader';

// Uso básico
<AITraderView />

// Modo compacto (apenas monitor)
<AITraderView compact={true} />
```

### Exemplo Completo

```tsx
import React from 'react';
import { AITraderView } from '@/app/modules/ai-trader';

export function TradingDashboard() {
  return (
    <div className="p-8">
      <h1>Painel de Trading</h1>
      
      {/* AI Trader Full */}
      <AITraderView />
      
      {/* Ou modo compacto para Dashboard */}
      <AITraderView compact={true} />
    </div>
  );
}
```

## 📊 Componentes Relacionados

O AI Trader utiliza vários sub-componentes:

```typescript
// Sub-componentes
import { NeuralLogsEmpty, NeuralPortfolioEmpty } from './dashboard/NeuralEmptyStates';
import { LiveLogTerminal } from './dashboard/LiveLogTerminal';
import { AssetUniverse } from './config/AssetUniverse';
import { VoiceAssistant } from './ai/VoiceAssistant';
import { PositionSizeCalculator } from './tools/PositionSizeCalculator';
import { SessionTimer } from './tools/SessionTimer';
import { EquityChart } from './tools/EquityChart';
import { CurrencyConverter } from './tools/CurrencyConverter';
import { WorkspaceSelector, useWorkspaces } from './tools/WorkspaceManager';
import { ResetAccountModal } from './tools/ResetAccountModal';
import { AIToolsControl } from './dashboard/AIToolsControl';
import { SmartScrollContainer } from './SmartScrollContainer';
import { MT5TokenValidator } from './MT5TokenValidator';
```

## 🐛 Debug e Logs

Todos os logs são prefixados para fácil identificação:

```javascript
[AI_TRADER] 🤖 Iniciando AI Trader...
[AI_TRADER] ✅ Configuração carregada
[AI_TRADER] 📊 8 ativos selecionados
[AI_TRADER] ▶️ Trading iniciado
[AI_TRADER] 🎯 Nova ordem: BTCUSD LONG @ $48,000
```

### Filtrar Logs no Console

```javascript
// Filtrar apenas logs do AI Trader
// No DevTools Console, use: [AI_TRADER
```

## 🔮 Integração com Context

O AI Trader usa o **TradingContext** global:

```typescript
const { 
  status,              // Status do AI (active/paused)
  toggleAI,            // Ligar/desligar AI
  activeOrders,        // Ordens ativas
  portfolio,           // Portfolio atual
  recentLogs,          // Logs recentes
  config,              // Configurações
  setConfig,           // Atualizar config
  closeHedgedPositions,// Fechar posições hedge
  resetPortfolio,      // Reset de conta
  updateBalance,       // Atualizar saldo
  executionMode        // DEMO ou LIVE
} = useTradingContext();
```

## ⚙️ Configuração (Config)

```typescript
interface AIConfig {
  // Trading
  tradingStyle: 'scalping' | 'day-trade' | 'swing';
  direction: 'AUTO' | 'LONG' | 'SHORT';
  
  // Risk Management
  riskPerTrade: number;        // % do capital
  stopLoss: number;            // % de stop
  takeProfit: number;          // % de lucro
  maxDrawdown: number;         // % de drawdown máximo
  
  // Capital
  leverage: number;            // Alavancagem
  minPositionSize: number;     // Tamanho mínimo
  maxPositionSize: number;     // Tamanho máximo
  
  // Ativos
  activeAssets: string[];      // Array de symbols
  
  // Modo
  executionMode: 'DEMO' | 'LIVE';
}
```

## 📚 Exemplos Práticos

### Exemplo 1: Ativar AI Trader
```typescript
const { toggleAI, status } = useTradingContext();

// Ligar
if (status === 'paused') {
  toggleAI();
}

// Desligar
if (status === 'active') {
  toggleAI();
}
```

### Exemplo 2: Alterar Configuração
```typescript
const { setConfig } = useTradingContext();

// Mudar para Scalping
setConfig(prev => ({
  ...prev,
  tradingStyle: 'scalping',
  riskPerTrade: 1,
  stopLoss: 0.5,
  takeProfit: 1.0
}));
```

### Exemplo 3: Adicionar Ativos
```typescript
const { setConfig } = useTradingContext();

setConfig(prev => ({
  ...prev,
  activeAssets: [...prev.activeAssets, 'BTCUSD', 'ETHUSD']
}));
```

### Exemplo 4: Reset de Conta
```typescript
const { resetPortfolio } = useTradingContext();

// Reset para $100
resetPortfolio(100);

// Reset para $10,000
resetPortfolio(10000);
```

## 🎯 Workflow Típico

1. **Usuário entra no AI Trader**
   - Modo MONITOR carrega automaticamente
   - Mostra portfolio e logs

2. **Usuário clica em "Configurar" (⚙️)**
   - Muda para modo ENGINEER
   - Exibe todas as configurações

3. **Usuário ajusta configurações**
   - Escolhe estilo: Scalping
   - Define risk: 2%
   - Seleciona ativos: BTCUSD, EURUSD, AAPL

4. **Usuário salva workspace**
   - Clica em "Salvar Workspace"
   - Define nome: "Scalping Crypto"
   - Configurações salvas no localStorage

5. **Usuário inicia AI**
   - Clica em "▶️ Iniciar"
   - AI começa a analisar mercado
   - Logs aparecem em tempo real

6. **AI executa trades**
   - Detecta oportunidade em BTCUSD
   - Abre posição LONG @ $48,000
   - Define SL: $47,280 (1.5%)
   - Define TP: $49,440 (3.0%)

7. **Usuário monitora**
   - Vê posições ativas
   - Acompanha P&L em tempo real
   - Recebe notificações

## 🔌 Integração MT5

```typescript
// 1. Abrir modal de configuração
setShowMT5ConfigModal(true);

// 2. Preencher credenciais
setMt5Login('12345678');
setMt5Password('senha123');
setMt5Server('ICMarkets-Demo');

// 3. Conectar
handleConnectMT5();

// 4. Status muda para 'connected'
// 5. AI pode executar trades reais
```

## ⚠️ Observações

1. **Modo DEMO:** Não executa trades reais
2. **Modo LIVE:** Requer conexão MT5 e saldo real
3. **Risk Management:** Sempre respeita limites configurados
4. **Logs:** Mantém apenas últimos 100 logs (performance)
5. **Workspace:** Salvo no localStorage (não persiste entre browsers)

## 📖 Glossário

- **Scalping:** Trades rápidos (segundos a minutos)
- **Day-Trade:** Trades intraday (horas)
- **Swing:** Trades de múltiplos dias
- **LONG:** Posição de compra (aposta na alta)
- **SHORT:** Posição de venda (aposta na baixa)
- **SL:** Stop Loss (limite de perda)
- **TP:** Take Profit (alvo de lucro)
- **Drawdown:** Queda do pico ao vale
- **Leverage:** Alavancagem
- **Hedge:** Posições opostas para proteção

---

**Status:** ✅ Completo e Funcional  
**Última Atualização:** Fevereiro 2026  
**Neural Day Trader Platform**
