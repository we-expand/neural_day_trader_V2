# NEURAL DAY TRADER PLATFORM — BLUEPRINT COMPLETO
### Documento técnico para reconstrução da plataforma do zero (sem os bugs atuais)
---

## ÍNDICE
1. [Visão Geral da Plataforma](#1-visão-geral)
2. [Stack Tecnológica](#2-stack-tecnológica)
3. [Arquitetura Geral](#3-arquitetura-geral)
4. [Sistema de Autenticação](#4-sistema-de-autenticação)
5. [Navegação e Rotas (Views)](#5-navegação-e-rotas)
6. [Landing Page](#6-landing-page)
7. [Dashboard Principal](#7-dashboard-principal)
8. [Módulo: Gráfico (ChartView)](#8-módulo-gráfico)
9. [Módulo: AI Trader](#9-módulo-ai-trader)
10. [Módulo: AI Trading Engine](#10-módulo-ai-trading-engine)
11. [Módulo: IA Preditiva (LiquidityPrediction)](#11-módulo-ia-preditiva)
12. [Módulo: Análise Quântica (QuantumAnalysis)](#12-módulo-análise-quântica)
13. [Módulo: Carteira / Fundos (Funds)](#13-módulo-carteira)
14. [Módulo: Ativos (Assets)](#14-módulo-ativos)
15. [Módulo: Performance](#15-módulo-performance)
16. [Módulo: Backtest](#16-módulo-backtest)
17. [Módulo: Simulador de Trading](#17-módulo-simulador)
18. [Módulo: Strategy Builder Pro](#18-módulo-strategy-builder)
19. [Módulo: Pyramiding](#19-módulo-pyramiding)
20. [Módulo: Prop Challenge](#20-módulo-prop-challenge)
21. [Módulo: Marketplace](#21-módulo-marketplace)
22. [Módulo: Parceiros / Afiliados](#22-módulo-parceiros)
23. [Módulo: Configurações](#23-módulo-configurações)
24. [Módulo: Perfil do Usuário](#24-módulo-perfil-do-usuário)
25. [Módulo: Admin Dashboard](#25-módulo-admin)
26. [Neural Assistant (Assistente de Voz)](#26-neural-assistant)
27. [Camada de Serviços (Services)](#27-camada-de-serviços)
28. [Camada de Contextos (State Global)](#28-contextos-estado-global)
29. [Hooks Customizados](#29-hooks-customizados)
30. [Componentes Globais do Layout](#30-componentes-do-layout)
31. [Componentes de UI (Design System)](#31-design-system)
32. [Banco de Dados / Supabase](#32-supabase)
33. [Integrações Externas](#33-integrações-externas)
34. [Bugs Identificados e Como Evitá-los](#34-bugs-e-soluções)
35. [Guia de Reconstrução Limpa](#35-guia-de-reconstrução)

---

## 1. VISÃO GERAL

A **Neural Day Trader Platform** é um SaaS de trading quantitativo voltado para traders profissionais e institucionais. Ela oferece:

- **IA Preditiva** que analisa mercados e gera sinais de compra/venda
- **Auto-trading** integrado ao MetaTrader 5 via MetaAPI
- **Gráfico profissional** com 16+ indicadores técnicos e ferramentas de desenho
- **Backtest** com replay histórico e modo AI vs Trader
- **Simulador** de trading com conta virtual
- **Análise Quântica** com reconhecimento de voz e detecção de tilt emocional
- **Marketplace** de estratégias, bots e indicadores
- **Prop Challenge** simulando desafios de mesas proprietárias
- **Admin Dashboard** completo para gestão da plataforma
- **Assistente Neural** com voz sintética (TTS) e reconhecimento de voz (STT)

**Idioma principal:** Português Brasileiro  
**Tema:** Dark exclusivamente (preto/cinza escuro, detalhes em verde esmeralda e ciano)  
**Público-alvo:** Traders day-trade/scalping, Brasil e mercados internacionais

---

## 2. STACK TECNOLÓGICA

```
Frontend:
  - React 18 + TypeScript (TSX)
  - Vite (bundler)
  - Tailwind CSS v4
  - Motion (Framer Motion) — animações
  - Recharts — gráficos de performance e métricas
  - KlineCharts — gráfico de candlestick profissional
  - Lucide-react — ícones
  - Sonner — toasts/notificações

Estado Global:
  - React Context API (6 contextos principais)
  - localStorage (persistência de sessão e configurações)

Backend / BaaS:
  - Supabase (Auth, Database, Edge Functions, Realtime)
  - Supabase Edge Functions (Deno) para proxy de APIs externas

Integrações Externas:
  - MetaAPI (integração com MetaTrader 5)
  - Binance Public REST API (preços crypto)
  - Binance WebSocket (streaming de preços em tempo real)
  - Web Speech API (reconhecimento de voz nativo do browser)
  - SpeechSynthesis API (TTS nativo do browser)

Bibliotecas adicionais:
  - klinecharts (gráfico candlestick)
  - react-dnd (drag and drop no Strategy Builder)
  - motion/react (animações)
```

---

## 3. ARQUITETURA GERAL

```
/src
  /app
    App.tsx                    ← Entrypoint, providers aninhados
    /components                ← Todos os componentes React
      /admin                   ← Módulo admin (10 sub-módulos)
      /ai                      ← Monitor de atividade da IA
      /auth                    ← Login, overlay de autenticação
      /backtest                ← Módulo de backtest completo
      /chart                   ← Ferramentas de desenho do gráfico
      /config                  ← AssetUniverse, configurações globais
      /dashboard               ← Widgets do dashboard principal
      /debug                   ← Ferramentas de diagnóstico
      /innovation              ← IA Preditiva / Liquidity Prediction
      /landing                 ← Landing page pública
      /layout                  ← Header, Footer, Ticker, Notifications
      /market                  ← Widgets de mercado
      /modules                 ← AI Trader Voice, MT5 Validator
      /monitoring              ← Monitoramento de saúde do sistema
      /nexus                   ← Nexus Quantum Advisor
      /onboarding              ← (estrutura reservada)
      /performance             ← Latency Benchmark
      /quantum                 ← Análise Quântica completa
      /settings                ← Sub-painéis de configuração
      /simulator               ← Simulador de trading virtual
      /strategy                ← Strategy Builder, Box Builder
      /tools                   ← Calculadoras, VIX, Equity Chart
      /trading                 ← Pyramiding, US30 Preset, Recovery
      /ui                      ← Design system (50+ componentes)
      /wallet                  ← Depósito modal
    /contexts                  ← Estado global (6 contextos)
    /data                      ← Dados estáticos (market-assets)
    /hooks                     ← 20+ hooks customizados
    /services                  ← 30+ serviços de dados e lógica
    /config                    ← Spreads, contratos, admin config
    /logic                     ← liquiditySignals
    /utils                     ← Formatadores, indicadores técnicos
  /lib
    supabaseClient.ts          ← Cliente Supabase singleton
    /modules
      ApexLogicCore.ts         ← Motor lógico central de trading
      ApexScoreEngine.ts       ← Engine de score de mercado
      BinanceAdapter.ts        ← Adaptador Binance
      NeuralRiskGuardian.ts    ← Gerenciador de risco
      RiskManager.ts           ← Regras de risco
  /utils
    /api
      config.ts                ← URLs centralizadas das APIs
    /supabase
      info.ts                  ← projectId e publicAnonKey
```

### Fluxo de dados principal:

```
Binance WS/REST → DirectBinanceService → UnifiedMarketDataService
                                                 ↓
MetaAPI (MT5) → MetaAPIDirectClient → MT5PriceValidator
                                                 ↓
                                    MarketContext (preços globais)
                                                 ↓
                              TradingContext (lógica de trading)
                                                 ↓
                              ApexLogicCore (decisões da IA)
                                                 ↓
                              UI (Dashboard, ChartView, AITrader)
```

---

## 4. SISTEMA DE AUTENTICAÇÃO

### 4.1 Fluxo de autenticação

O sistema tem **dupla camada de autenticação**:

**Camada 1 — Supabase Auth (primária):**
- Email + senha via `supabase.auth.signInWithPassword()`
- Sessão persistida automaticamente pelo Supabase
- Hook `useAuth()` expõe: `user`, `signOut`, `loading`

**Camada 2 — LocalAuthService (fallback offline):**
- Quando Supabase não está disponível (erro 402 ou CORS)
- Usuários armazenados no localStorage com hash simples de senha
- Registra, autentica e mantém sessão local
- Função `mockLogin(email, name)` para entrada direta sem senha

### 4.2 AuthContext (`/src/app/contexts/AuthContext.tsx`)

```typescript
interface AuthContextType {
  user: User | null;        // Objeto do usuário autenticado
  loading: boolean;          // Estado de carregamento inicial
  signOut: () => Promise<void>;
  mockLogin: (email: string, name?: string) => void;  // Login direto (demo/fallback)
}
```

### 4.3 Telas de autenticação

**LandingPage** → botão "Entrar" → **AuthOverlay**

O `AuthOverlay` contém o componente `SmartLogin` que:
- Verifica se Supabase está disponível
- Se sim: usa autenticação Supabase
- Se não: usa LocalAuthService
- Após login bem-sucedido: chama `mockLogin()` com dados do usuário

### 4.4 Proteção de rotas

Não há React Router. O controle de tela é feito via estado `currentView` no `AppContent`.  
Se `user === null` → mostra LandingPage ou AuthOverlay  
Se `user !== null` → mostra a aplicação completa com Sidebar

### 4.5 Controle de Admin

```typescript
// /src/app/config/adminConfig.ts
function checkAdminPermissions(user): boolean
// Verifica email do usuário contra lista de admins hardcoded
// Admin vê menu extra no Sidebar (Admin Dashboard, etc.)
```

---

## 5. NAVEGAÇÃO E ROTAS

**NÃO usa React Router.** Toda navegação é via estado `currentView` (string) no `App.tsx`.

### Views disponíveis:

| View ID | Componente | Descrição |
|---------|-----------|-----------|
| `dashboard` | `<Dashboard>` | Dashboard principal com KPIs |
| `wallet` / `funds` | `<Funds>` | Carteira e transações |
| `assets` | `<Assets>` | Browser de ativos |
| `chart` | `<ChartView>` | Gráfico profissional KlineCharts |
| `ai-trader` | `<AITrader>` | Motor de auto-trading IA |
| `ai-engine` | `<AITradingEngine>` | Config avançada da IA |
| `ai-voice` | `<AITraderVoice>` | AI Trader com voz |
| `performance` | `<Performance>` | Métricas e gráficos de resultado |
| `innovation` | `<LiquidityPrediction>` | IA Preditiva de liquidez |
| `quantum-analysis` | `<QuantumAnalysis>` | Análise Quântica com voz |
| `strategy` | `<StrategyDashboard>` | Strategy Builder |
| `store` | `<Marketplace>` | Loja de estratégias/bots |
| `partners` | `<Partners>` | Programa de afiliados |
| `prop-challenge` | `<PropChallenge>` | Simulação de desafio prop firm |
| `settings` | `<Settings>` | Configurações gerais |
| `profile` | `<UserProfile>` | Perfil do usuário |
| `admin` | `<AdminDashboard>` | Painel administrativo (admin only) |
| `dev-lab` | `<DevLab>` | Laboratório de desenvolvimento (lazy load) |
| `pyramiding` | `<PyramidingExample>` | Demo de pyramiding |
| `competitive-analysis` | `<CompetitiveAnalysis>` | Análise competitiva |
| `compliance-analysis` | `<ComplianceAnalysis>` | Análise de compliance |
| `launch-strategy` | `<LaunchStrategy>` | Estratégia de lançamento |
| `trader-insights` | `<TraderInsights>` | Insights de traders |

### Sidebar

- Largura: `w-80` (320px)
- Fundo: `bg-black` com borda `border-white/5`
- Logo clicável no topo (navega para dashboard)
- Items ativos: fundo `bg-white/10`, texto `text-emerald-400`
- Items inativos: `text-slate-400`
- Seção Admin separada (visível apenas para admins)
- Botão de Logout no rodapé

---

## 6. LANDING PAGE

**Arquivo:** `/src/app/components/landing/LandingPage.tsx`

### Estrutura:

1. **Hero Section** com título animado rotativo (`MagneticCycleTitle`)
   - Frases: "Sinais Quantitativos.", "Trading Algorítmico.", "Inteligência de Mercado.", "Execução Quântica.", "Poder Institucional."
   - Animação: fade in/out a cada 4.5s com blur e scale
   - Background: `AmbientBackground` (partículas animadas)

2. **Features Section** — 3 cards de funcionalidades principais com ícones

3. **Pricing Section** — 4 planos:
   - **Free/Gratuito** — acesso básico
   - **Starter** — R$97/mês ou equivalente
   - **Pro** — R$197/mês (plano destacado/recomendado)
   - **Enterprise / Sob Medida** — preço custom

4. **CTA Final** — botão para login

### Internacionalização:
Arquivo `/src/app/components/landing/translations.ts`  
Suporta: `'en'` | `'pt'` | `'es'`  
Inclui todos os textos da landing e pricing traduzidos.

### Seletor de idioma:
Dropdown na landing que altera o estado `language` no App.tsx

---

## 7. DASHBOARD PRINCIPAL

**Arquivo:** `/src/app/components/Dashboard.tsx`  
**Layout:** Grid 12 colunas (xl), 1 coluna (mobile)

### Widgets presentes:

#### 7.1 MarketScoreBoard (col-span-12)
**Arquivo:** `/src/app/components/dashboard/MarketScoreBoard.tsx`

O componente mais complexo do dashboard. Exibe:
- **Score geral do mercado** (VU Meter Gauge + Modern Score Gauge)
- **Preços em tempo real** de BTC, ETH, EUR/USD, XAU/USD, US30, S&P500
- **Status da IA** (running/idle) com botão de toggle
- **Portfolio resumido**: balance, equity, drawdown, posições abertas
- **MT5 Status Badge** — indica se conectado ao MetaTrader
- **MT5 Quick Connect** — popup de conexão rápida ao MT5
- **Modal de Depósito** — abre `DepositModal`
- **InfinoxAssetsBrowser** — browser de ativos da corretora
- **MarketDataUpdatePanel** — painel de atualização manual de preços
- **QuickSettings** — modal de configurações rápidas (stop loss, take profit, alavancagem)
- **NexusQuantumAdvisor** — widget de recomendação quântica
- **MiniEquityChart** — mini gráfico de equity
- **Botão de Power** — inicia/para a IA

Fontes de dados do MarketScoreBoard:
1. `UnifiedMarketDataService` (WebSocket Binance streaming)
2. `MetaApiService` (MT5 via Supabase Edge Function)
3. `getBinancePureValues()` (valores diretos da Binance)
4. `fetchSPXData()` (S&P500 em tempo real)
5. `calculateCryptoDailyChange()` (variação 24h crypto)

#### 7.2 NewsAndAgenda (col-span-6, altura 490px)
**Arquivo:** `/src/app/components/dashboard/NewsAndAgenda.tsx`
- Feed de notícias financeiras
- Calendário econômico com eventos do dia
- Indicadores macroeconômicos

#### 7.3 VIXWidgetEnhanced (col-span-3, altura 490px)
**Arquivo:** `/src/app/components/tools/VIXWidgetEnhanced.tsx`
- Gauge do VIX (índice de volatilidade)
- Cores: verde (<15), amarelo (15-25), vermelho (>25)
- Interpretação textual do nível de medo/ganância

#### 7.4 RiskThermometer (col-span-3, altura 490px)
**Arquivo:** `/src/app/components/dashboard/RiskThermometer.tsx`
- Termômetro visual de risco do portfólio
- Escala: baixo, moderado, alto, crítico
- Baseado no drawdown atual

#### 7.5 CorrelationMatrix (col-span-8)
**Arquivo:** `/src/app/components/dashboard/CorrelationMatrix.tsx`
- Matriz de correlação entre ativos
- Heatmap colorido (vermelho = correlação negativa, verde = positiva)
- Ativos: BTC, ETH, EUR/USD, XAU/USD, US30, NAS100, SPX500

---

## 8. MÓDULO GRÁFICO

**Arquivo:** `/src/app/components/ChartView.tsx`  
**Biblioteca:** KlineCharts (não TradingView — completamente autocontido)

### 8.1 Seleção de ativo

- Barra de pesquisa com filtro por categoria
- **Categorias:** Crypto, Forex, Commodities, Índices, Stocks US, Stocks BR
- **300+ ativos** definidos em `/src/app/data/market-assets.ts`
- Seleção persistida no `localStorage` e `TradingContext`

### 8.2 Timeframes disponíveis

`1m` | `5m` | `15m` | `30m` | `1H` | `2H` | `4H` | `1D` | `1W` | `1M`

### 8.3 Tipos de gráfico

Candles | Barras | Linha | Área | Heikin Ashi

### 8.4 Fontes de dados do gráfico

**Para Crypto (USDT pairs):**
- Primário: Binance REST API (`/api/v3/klines`) — dados históricos
- Realtime: Binance WebSocket (`wss://stream.binance.com`) — tick a tick
- Fallback: `generateFallbackCandles()` — dados sintéticos baseados em seed

**Para Forex/Índices/Commodities:**
- Primário: `DataSourceRouter` → MetaAPI via Supabase Edge Function
- Fallback: dados sintéticos com preços base realistas + variação aleatória controlada

### 8.5 Indicadores técnicos (16)

Todos via KlineCharts nativo:

| ID | Nome | Tipo de Painel |
|----|------|----------------|
| MA | Média Móvel Simples | Sobreposto no gráfico |
| EMA | Média Móvel Exponencial | Sobreposto |
| WMA | Média Móvel Ponderada | Sobreposto |
| SAR | Parabolic SAR | Sobreposto |
| BOLL | Bollinger Bands | Sobreposto |
| DC | Donchian Channel | Sobreposto |
| RSI | Relative Strength Index | Painel separado |
| MACD | Moving Average Convergence | Painel separado |
| KDJ | Stochastic Oscillator | Painel separado |
| CCI | Commodity Channel Index | Painel separado |
| WR | Williams %R | Painel separado |
| DMI | Directional Movement Index | Painel separado |
| ATR | Average True Range | Painel separado |
| VOL | Volume | Painel separado |
| OBV | On Balance Volume | Painel separado |
| ROC | Rate of Change | Painel separado |

### 8.6 Ferramentas de desenho

Implementadas via KlineCharts Overlays:

- **Linhas:** Linha reta, Linha de tendência, Ray
- **Formas:** Retângulo, Círculo, Triângulo, Seta
- **Fibonacci:** Retração de Fibonacci, Extensão de Fibonacci
- **Texto:** Anotação de texto livre
- **Régua:** Medição de preço/tempo
- **Canais:** Canal paralelo
- **Padrões:** Head & Shoulders, Cunha (Wedge)
- **Ponto Marcador:** Overlay customizado (`pointMarker`)

Toolbar de desenho com:
- Ícones para cada ferramenta
- Botão de bloquear/desbloquear overlay
- Botão de ocultar/mostrar overlay
- Botão de deletar overlay selecionado

### 8.7 Funcionalidades avançadas do gráfico

- **Countdown de candle** — timer para fechar do candle atual
- **Zonas de liquidez** — detectadas via `detectZones()` (3+ toques no mesmo nível)
- **Sinais de trading** — BUY/SELL/NEUTRAL calculados localmente via RSI + MA
- **Preço em tempo real** no topo do gráfico (bid/ask)
- **Variação 24h** com cor (verde/vermelho)
- **Backtest integrado** — botão que abre `BacktestConfigModal`
- **Strategy Builder Pro** — abre construtor visual de estratégias
- **Modo AI vs Trader** — backtest comparativo
- **Trading Simulator** — aba de simulação dentro do ChartView
- **LiquidityDetector** — detecta zonas de liquidez (lazy loaded)

---

## 9. MÓDULO AI TRADER

**Arquivo:** `/src/app/components/AITrader.tsx`  
É o módulo mais complexo da plataforma.

### 9.1 Modos de visualização (tabs internas)

| Modo | Descrição |
|------|-----------|
| `MONITOR` | Dashboard de monitoramento da IA em execução |
| `ENGINEER` | Configuração detalhada dos parâmetros da IA |
| `VOICE` | Interface com AI Trader Voice |
| `SIMULATOR` | Simulador de trading integrado |

### 9.2 Configuração da IA (AIConfig)

```typescript
interface AIConfig {
  direction: 'AUTO' | 'LONG' | 'SHORT';        // Direção das operações
  marketMode: 'TREND' | 'RANGE' | 'SCALP' | 'COUNTER'; // Modo de mercado
  targetPoints: 'MÉDIO' | 'CURTO' | 'LONGO' | 'POUCOS' | 'MUITOS'; // Alvo de pontos
  stopLossMode: 'DINAMICO' | 'FIXO';           // Tipo de stop loss
  allocatedCapital: number;                     // Capital alocado em %
  maxContracts: number;                         // Máximo de contratos por trade
  maxPositions: number;                         // Máximo de posições simultâneas
  targetGainPct: number;                        // Target em % (Take Profit)
  stopLossPct: number;                          // Stop Loss em %
  riskPerTrade: number;                         // Risco por trade em %
  timeframe: string;                            // Timeframe para análise
  activeAssets: string[];                       // Ativos monitorados pela IA
  executionMode: 'DEMO' | 'LIVE';              // Modo de execução
}
```

### 9.3 Modos de execução

**DEMO:** Todas as operações são simuladas internamente. Sem conexão com broker.

**LIVE:** Operações enviadas ao MetaTrader 5 via MetaAPI. Requer:
- Token MetaAPI
- Account ID MetaAPI (UUID)
- Credenciais MT5 (login, senha, servidor)

Ao ativar LIVE: exibe `LiveModeConfirmation` (modal de confirmação com contagem regressiva)

### 9.4 Controles principais

- **Botão ON/OFF** — `toggleAI()` → inicia/para o loop de trading
- **PAUSA/RESUME** — pausa temporariamente sem fechar posições
- **FORCE CLOSE ALL** — fecha todas as posições abertas
- **PANIC CLOSE** — fecha tudo imediatamente (modo emergência)
- **RESET PORTFOLIO** — abre `ResetAccountModal`

### 9.5 Workspaces

Sistema de salvamento de configurações em localStorage:
- Salva preset completo do `AIConfig`
- Nome customizado + timestamp
- `WorkspaceSelector` para carregar presets salvos
- `saveWorkspace()` e `deleteWorkspace()`

### 9.6 Ferramentas integradas no AITrader

- **PositionSizeCalculator** — calcula tamanho de posição por risco
- **CurrencyConverter** — conversor de moedas em tempo real
- **EquityChart** — gráfico de evolução do equity
- **SessionTimer** — timer de sessão de trading
- **AIActivityMonitor** — monitora atividade da IA em tempo real

### 9.7 US30 Scalp Preset

Componente `US30ScalpPreset`: preset otimizado para scalping no índice Dow Jones (US30) com:
- Timeframe: 1m
- Target: 15-20 pontos
- Stop: 10 pontos
- Máximo 3 posições simultâneas

### 9.8 AI Recovery Challenge

Componente `AIRecoveryChallenge`: modo especial onde a IA tenta recuperar um valor-alvo antes de uma hora definida.  
`RecoveryProgressHUD` exibe progresso em tempo real com contagem regressiva.

### 9.9 Conexão MT5 no AITrader

Modal de configuração com campos:
- Login MT5
- Senha MT5
- Servidor MT5 (ex: "ICMarkets-Live")
- Token MetaAPI
- Account ID MetaAPI

Após conectar: `brokerManager` usa `MT5Adapter` para enviar ordens reais.

### 9.10 Logs em tempo real

`LiveLogTerminal`: terminal de logs tipo console com:
- Timestamp de cada operação
- Cor por tipo (verde=sucesso, vermelho=erro, amarelo=warning)
- Auto-scroll para o último log
- Máximo 100 logs mantidos em memória

---

## 10. MÓDULO AI TRADING ENGINE

**Arquivo:** `/src/app/components/AITradingEngine.tsx`  
**Serviço:** `/src/app/services/AITradingEngine.ts`

Este é um módulo SEPARADO do AI Trader. É a tela de configuração avançada da IA.

### 10.1 Análise produzida pelo AITradingEngine.ts

O serviço produz um objeto `AIAnalysis` completo:

```typescript
interface AIAnalysis {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;           // 0-100
  priceAction: {
    pattern: string;            // Ex: "Engolfo de Alta", "Doji"
    strength: number;
    description: string;
  };
  fibonacci: {
    levels: { level: number; price: number; type: 'support'|'resistance' }[];
    currentZone: string;        // Ex: "Zona de 61.8%"
    expansionTarget: number;    // Preço-alvo de expansão
    description: string;
  };
  riskManagement: {
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    riskRewardRatio: number;    // Ex: 1:3
    positionSize: number;
    maxRisk: number;
    description: string;
  };
  indicators: {
    rsi: { value: number; signal: 'bullish'|'bearish'|'neutral'; overbought: boolean; oversold: boolean };
    macd: { value: number; signal: number; histogram: number; trend: 'bullish'|'bearish' };
    ema: { ema20: number; ema50: number; ema200: number; alignment: 'bullish'|'bearish'|'mixed' };
    bollinger: { upper: number; middle: number; lower: number; position: 'upper'|'middle'|'lower' };
    atr: { value: number; volatility: 'low'|'medium'|'high' };
    adx: { value: number; trend: 'strong'|'weak' };
  };
  marketStructure: {
    trend: 'uptrend'|'downtrend'|'sideways';
    higherHighs: boolean;
    higherLows: boolean;
    lowerHighs: boolean;
    lowerLows: boolean;
    keyLevels: { price: number; type: 'support'|'resistance'; strength: number }[];
    description: string;
  };
  confluence: {
    score: number;             // 0-100 (quantos indicadores confirmam)
    factors: string[];         // Lista dos fatores de confluência
    description: string;
  };
}
```

### 10.2 Interface do AITradingEngine

- Seletor de ativos (`AssetUniverse`)
- Presets de estratégia: SCALP vs SWING
- Configuração de timeframe, target gain %, stop loss %, risk per trade, max positions
- VoiceAssistant integrado
- US30ScalpPreset integrado

---

## 11. MÓDULO IA PREDITIVA (LiquidityPrediction)

**Arquivo:** `/src/app/components/innovation/LiquidityPrediction.tsx`

### 11.1 Funcionalidades

- **Heatmap de Liquidez** — visualização de zonas de liquidez usando dados históricos
- **Previsão de Direção** — algoritmo que prevê movimento do preço nas próximas horas
- **Correlações Dinâmicas** — matrix de correlação entre ativo selecionado e correlatos
- **Análise de Volatilidade** — gráfico de volatilidade histórica com projeção
- **Scanner de Oportunidades** — varre 300+ ativos buscando setups de alta probabilidade
- **Radar de Mercado** — visualização tipo radar dos ativos mais voláteis

### 11.2 Integração com Supabase Realtime Turbo

Usa `useSupabaseRealtimeTurbo` para streaming de dados em tempo real:
```typescript
const { data, status } = useSupabaseRealtimeTurbo(TURBO_CONFIGS.FAST);
// TURBO_CONFIGS.FAST = intervalo de 2s
// TURBO_CONFIGS.MEDIUM = intervalo de 5s
// TURBO_CONFIGS.SLOW = intervalo de 10s
```

### 11.3 Análise de Voz Horária

`generateHourlyVoiceAnalysis()` e `generateQuickVoiceAnalysis()`:
- Geram análises textuais do mercado para síntese de voz
- Baseadas nos dados do ativo selecionado + estado da IA

### 11.4 Seleção de ativo

- Pesquisa entre todos os 300+ ativos do `ALL_ASSETS`
- Filtro por categoria
- Ao mudar ativo: recalcula correlações e recomeça streaming

---

## 12. MÓDULO ANÁLISE QUÂNTICA

**Arquivo:** `/src/app/components/quantum/QuantumAnalysis.tsx`

### 12.1 Sub-módulos

| Arquivo | Função |
|---------|--------|
| `QuantumChart.tsx` | Gráfico avançado com análise quântica sobreposta |
| `ButterflyMatrix.tsx` | Análise de padrões harmônicos (Butterfly, Gartley, Crab) |
| `OperationModeSelector.tsx` | Seletor de modo: MANUAL / HYBRID / AUTONOMOUS |
| `DisciplineScore.tsx` | Score de disciplina do trader (0-100) |
| `VoiceConfigPanel.tsx` | Painel de configuração da voz do assistente |

### 12.2 Modos de operação

- **MANUAL:** Trader toma todas as decisões
- **HYBRID:** IA sugere, trader confirma
- **AUTONOMOUS:** IA opera completamente sozinha (com proteção por detecção de tilt)

### 12.3 Sistema de detecção de Tilt

Integrado com `useVoiceSystem()`:
- Monitora nível de estresse na voz via Web Speech API
- Se `voiceAnalysis.isTilted === true`:
  - Dispara alerta via `NexusAlertSystem.alertTilt()`
  - Em modo AUTONOMOUS: pausa operações por segurança

### 12.4 NexusAlertSystem

`/src/app/services/NexusAlertSystem.ts`:
- Sistema centralizado de alertas
- `alertTilt(stressLevel, action)` — alerta de tilt emocional
- `alertSpoofing(price, type, confidence)` — alerta de spoofing no book
- `alertBreakout(signal)` — alerta de rompimento
- `registerVoiceSystem(speakFn)` — registra função de voz para alertas falados

---

## 13. MÓDULO CARTEIRA (Funds)

**Arquivo:** `/src/app/components/Funds.tsx`

### 13.1 Dados exibidos

- **Saldo disponível** (balance do portfolio)
- **Capital investido** (openPositionsValue)
- **Lucro/Prejuízo atual** (equity - balance)
- **Variação %** do equity

### 13.2 Operações disponíveis

**Depósito:**
- Métodos: PIX, Transferência bancária, Cartão de crédito, Crypto (BTC, USDT)
- PIX: exibe QR code + chave PIX + campo para comprovante
- Após envio: aguarda validação (mock em DEMO)

**Saque:**
- Campos: valor, dados bancários / endereço crypto
- Confirmação com PIN de segurança (6 dígitos)
- Modal de confirmação antes de processar

**Reset Demo:**
- Disponível apenas em modo DEMO
- Restaura saldo para $100

### 13.3 Histórico de transações

Lista de transações mockadas em DEMO.  
Em LIVE: buscaria do Supabase (tabela `transactions`).

---

## 14. MÓDULO ATIVOS (Assets)

**Arquivo:** `/src/app/components/Assets.tsx`

### 14.1 Funcionalidades

- Listagem de todos os ativos suportados com preços em tempo real
- **Filtros por categoria:** Todos | Forex | Crypto | Índices | Commodities
- **Busca por nome ou símbolo**
- **Ordenação:** por variação %, por preço, alfabética
- Clique em ativo → navega para `ChartView` com ativo pré-selecionado
- **VIXWidgetEnhanced** integrado na lateral

### 14.2 Dados dos ativos

Preços vêm do `MarketContext.marketState.prices`.  
Variações do `marketState.dailyChanges`.

---

## 15. MÓDULO PERFORMANCE

**Arquivo:** `/src/app/components/Performance.tsx`

### 15.1 Métricas exibidas

- **Win Rate** — % de trades vencedores
- **Profit Factor** — lucro bruto / prejuízo bruto
- **Total de Trades** — histórico completo
- **ROI Total** — retorno sobre o capital inicial
- **Maior sequência de ganhos/perdas**

### 15.2 Gráficos (via Recharts)

- **Gráfico de Equity** — `AreaChart` com área preenchida
- **Distribuição de Resultados** — `BarChart` com barras positivas/negativas
- **Distribuição de Portfólio** — `PieChart` por ativo
- **P&L por período** — seletor 7D | 30D | 90D | 1A | MAX

### 15.3 Sub-módulos

- **SlippageSimulator** — simula impacto do slippage nas operações
- **LatencyBenchmark** — mede latência de execução em ms

---

## 16. MÓDULO BACKTEST

**Pasta:** `/src/app/components/backtest/`

### 16.1 Componentes

| Componente | Função |
|-----------|--------|
| `BacktestConfigModal.tsx` | Modal de configuração do backtest |
| `BacktestConfigSummary.tsx` | Resumo das configurações antes de rodar |
| `BacktestLiveProgress.tsx` | Progresso em tempo real do backtest rodando |
| `BacktestReplayBar.tsx` | Barra de controle do replay (play/pause/speed) |
| `BacktestTradeMarker.tsx` | Marcadores de entrada/saída no gráfico |
| `BacktestDecisionsPanel.tsx` | Painel com todas as decisões da IA durante backtest |
| `PerformanceComparison.tsx` | Comparação de desempenho AI vs Trader |
| `AIvsTraderMode.tsx` | Modo de disputa AI vs Trader humano |
| `StrategyBuilder.tsx` | Builder básico de estratégias |
| `StrategyBuilderPro.tsx` | Builder visual avançado drag-and-drop |
| `BacktestErrorBoundary.tsx` | Error boundary específico para backtest |

### 16.2 Configurações do Backtest

```typescript
{
  symbol: string;          // Ativo para backtest
  timeframe: string;       // Timeframe dos candles
  startDate: Date;         // Data de início
  endDate: Date;           // Data de fim
  initialBalance: number;  // Capital inicial
  strategy: Strategy;      // Estratégia construída no StrategyBuilderPro
  commission: number;      // Comissão por trade (%)
  slippage: number;        // Slippage em pontos
  spread: number;          // Spread em pontos
}
```

### 16.3 Hooks de Backtest

- `useBacktestLiveProgress` — acompanha progresso em tempo real
- `useBacktestReplay` — controla replay frame a frame

---

## 17. MÓDULO SIMULADOR

**Pasta:** `/src/app/components/simulator/`  
**Contexto:** `SimulatorContext`

### 17.1 Componentes

| Componente | Função |
|-----------|--------|
| `TradingSimulator.tsx` | Componente principal integrador |
| `VirtualAccount.tsx` | Exibe saldo virtual + posições abertas |
| `OrderEntry.tsx` | Formulário de abertura de ordem |
| `OrdersPanel.tsx` | Lista de ordens abertas com P&L em tempo real |
| `TradeHistory.tsx` | Histórico de trades fechados |

### 17.2 SimulatorContext

```typescript
{
  balance: number;          // Saldo virtual
  equity: number;           // Equity atual
  openOrders: Order[];      // Ordens abertas
  closedOrders: Order[];    // Histórico de ordens
  openOrder: (order) => void;
  closeOrder: (orderId, currentPrice) => void;
  updateOrderPrices: (symbol, price) => void;
  resetAccount: () => void;
}
```

### 17.3 Funcionalidades

- Conta virtual com $10.000 iniciais
- Market orders e limit orders
- Stop Loss e Take Profit configuráveis
- Cálculo real de P&L com alavancagem e spread
- Histórico persistido no localStorage
- Botão de reset da conta

---

## 18. MÓDULO STRATEGY BUILDER PRO

**Arquivo:** `/src/app/components/backtest/StrategyBuilderPro.tsx`

### 18.1 Conceito

Editor visual de estratégias baseado em blocos (estilo Notion/Figma):
- Blocos de **ENTRADA** (Entry)
- Blocos de **SAÍDA** (Exit)
- Blocos de **FILTRO** (Filter)

### 18.2 Indicadores suportados nos blocos

`SMA | EMA | RSI | MACD | BB | STOCH | ADX | ATR | VWAP | ICHIMOKU | OBV | MFI | CCI | WILLIAMS | SAR`

### 18.3 Operadores disponíveis

`CROSS_ABOVE | CROSS_BELOW | ABOVE | BELOW | BETWEEN | RISING | FALLING`

### 18.4 Funcionalidades

- Drag-and-drop para reordenar blocos (via `motion` Reorder)
- AI Score automático (0-100) para a estratégia criada
- AI Suggestions — sugestões automáticas de melhoria
- Exportar estratégia como JSON
- Importar estratégia de JSON
- Compartilhar estratégia
- Preview da estratégia em linguagem natural
- Integração direta com BacktestConfigModal

### 18.5 BoxBuilder

`/src/app/components/strategy/BoxBuilder.tsx`  
Ferramenta para definir "caixas" de preço (zonas de entrada/saída):
- Define preço de entrada, stop e target visualmente
- Cálculo automático de R/R ratio
- Aplicação direta no gráfico

---

## 19. MÓDULO PYRAMIDING

**Pasta:** `/src/app/components/trading/`

### 19.1 Conceito

Pyramiding = técnica de adicionar posições conforme o trade vai a favor.

### 19.2 Estratégias de scaling

| Estratégia | Descrição |
|-----------|-----------|
| `fixed` | Mesmo tamanho em todas as entradas |
| `reduced` | Tamanho decrescente (1.0, 0.5, 0.25) |
| `fibonacci` | Baseado na sequência de Fibonacci |
| `exponential` | Crescimento exponencial dos contratos |
| `smart-ai` | IA decide o melhor tamanho |

### 19.3 Configurações do PyramidingConfig

```typescript
interface PyramidingConfig {
  enabled: boolean;
  maxLayers: number;           // Máximo de entradas (ex: 5)
  scalingStrategy: 'fixed' | 'reduced' | 'fibonacci' | 'exponential' | 'smart-ai';
  initialSize: number;         // Tamanho inicial em contratos
  sizeMultiplier: number;
  entryDistanceType: 'pips' | 'percent' | 'atr' | 'ai-dynamic';
  entryDistance: number;
  atrMultiplier: number;
  trailingStopEnabled: boolean;
  trailingStopType: 'pips' | 'percent' | 'atr';
  trailingStopDistance: number;
  trailingStopPerLayer: boolean;
  breakEvenEnabled: boolean;
  breakEvenTrigger: number;    // Após quantos pips ativa break-even
  partialTakeProfitEnabled: boolean;
  partialTakeProfitLevels: number[];
  emergencyStopEnabled: boolean;
  emergencyStopVolatilityMultiplier: number;
}
```

### 19.4 Componentes

- `PyramidingConfigPanel.tsx` — painel de configuração completo
- `PyramidingVisualizer.tsx` — visualização das layers no gráfico
- `PyramidingMonitor.tsx` — monitor em tempo real das posições em pyramiding
- `PyramidingExample.tsx` — página de demonstração
- `pyramidingManager.ts` — serviço que gerencia as layers

---

## 20. MÓDULO PROP CHALLENGE

**Arquivo:** `/src/app/components/PropChallenge.tsx`

### 20.1 Conceito

Simula desafios de mesas proprietárias (prop firms) como FTMO, My Forex Funds.

### 20.2 Configurações de Challenge disponíveis

| Challenge | Saldo | Meta | Max Daily Loss | Max Total Loss | Dias mínimos |
|-----------|-------|------|----------------|----------------|--------------|
| Standard (100k) | $100.000 | 10% | 5% | 10% | 5 |
| Aggressive (50k) | $50.000 | 20% | 10% | 20% | 3 |
| Swing (200k) | $200.000 | 8% | 3% | 8% | 10 |

### 20.3 Estado do Challenge

```typescript
interface ChallengeState {
  status: 'IDLE' | 'ACTIVE' | 'PASSED' | 'FAILED';
  startDate: number;
  startBalance: number;
  highestEquity: number;
  dailyStartEquity: number;
  tradingDays: number;
  history: { day: number; equity: number }[];
}
```

### 20.4 Monitoramento

- Gráfico de equity do desafio (Recharts AreaChart)
- Barra de progresso para a meta
- Alertas quando se aproxima dos limites de drawdown
- Verificação diária: reseta `dailyStartEquity` às 00:00

---

## 21. MÓDULO MARKETPLACE

**Arquivo:** `/src/app/components/Marketplace.tsx`

### 21.1 Categorias de produtos

| Categoria | Exemplos |
|-----------|---------|
| `strategy` | Neural Scalper Pro, Breakout Master |
| `indicator` | Liquidity Zones, Smart RSI |
| `bot` | AutoTrader Elite, Grid Bot Pro |
| `course` | Curso de Price Action, Fibonacci Mastery |
| `signal` | Sinais Premium Forex, Crypto Alerts |

### 21.2 Funcionalidades

- Filtro por categoria
- Busca por nome
- Cards com: rating (estrelas), número de reviews, vendas, preço, desconto
- Badge "MAIS VENDIDO" ou "NOVO" ou "PREMIUM"
- Botão de compra → toast de "Em breve disponível"

---

## 22. MÓDULO PARCEIROS / AFILIADOS

**Arquivo:** `/src/app/components/Partners.tsx`

### 22.1 Funcionalidades

- **Código de referral único** — gerado e persistido no localStorage
- **Botão de copiar** o link de referral
- **Métricas de afiliado:**
  - Total de indicações
  - Indicações ativas
  - Ganhos totais (R$)
  - Ganhos pendentes
  - Taxa de conversão (%)
- **Lista de indicados** com status (ACTIVE / PENDING / INACTIVE) e comissão gerada
- **Gráfico de ganhos mensais** (Recharts AreaChart)

---

## 23. MÓDULO CONFIGURAÇÕES

**Arquivo:** `/src/app/components/Settings.tsx`

### 23.1 Seções

**1. Notificações:**
- Toggle: Notificações de trading
- Toggle: Notificações por email
- Toggle: Alertas de performance
- Toggle: Alertas de risco

**2. Trading Automático:**
- Toggle: Auto Trade
- Toggle: Auto Stop Loss
- Toggle: Auto Take Profit
- Input: Max Daily Loss (%)
- Input: Max Position Size (%)
- Input: Alavancagem

**3. Chaves de API:**
- MetaAPI Token
- MetaAPI Account ID
- Trading Economics API Key
- S&P Global API Key

**4. Aparência:**
- Placeholder (apenas dark theme disponível)

**5. Segurança:**
- Exibe email do usuário
- Placeholder para 2FA

**6. Voz (VoiceSettings):**
- Gênero da voz (masculino/feminino)
- Velocidade de fala
- Volume
- Ativar/desativar respostas automáticas

**7. Conexões de Broker (BrokerConnections):**
- Lista de brokers suportados
- Status de conexão
- Botão para conectar/desconectar

**8. Sistema e Saúde dos Dados:**
- `AssetHealthMonitor` — saúde de cada fonte de dados
- `MassAssetDiagnostics` — diagnóstico em massa dos 300+ ativos
- `DataSourceHealthDashboard` — dashboard de saúde das fontes
- `AlertSystemPanel` — configuração do sistema de alertas

---

## 24. MÓDULO PERFIL DO USUÁRIO

**Arquivo:** `/src/app/components/UserProfile.tsx`

### 24.1 Dados editáveis

```typescript
interface UserProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: { street, city, state, zipCode, country };
  dateOfBirth: string;
  nationality: string;
  occupation: string;
  company: string;
  tradingExperience: string;        // 'beginner'|'intermediate'|'advanced'|'professional'
  riskProfile: 'conservative'|'moderate'|'aggressive';
  investmentGoals: string[];
  socialProfiles: { linkedin, twitter, telegram };
  verificationStatus: 'pending'|'verified'|'rejected';
}
```

### 24.2 Funcionalidades

- Modo de edição toggle (ícone de lápis)
- Salva no Supabase (tabela `profiles`) se disponível, senão localStorage
- Badge de status KYC (verificação)
- Avatar com iniciais do nome

---

## 25. MÓDULO ADMIN

**Arquivo:** `/src/app/components/admin/AdminDashboard.tsx`  
**Acesso:** Apenas usuários com email na lista de admins

### 25.1 Tabs do Admin Dashboard

| Tab | Componente | Função |
|-----|-----------|--------|
| `userdata` (default) | `UserDataDashboard` | Dados de todos os usuários |
| `overview` | `AdminOverview` | KPIs da plataforma |
| `finance` | `FinanceModule` | Módulo financeiro |
| `users` | `UserIntelligence` | Intelligence de usuários |
| `social` | `SocialMediaManager` | Gerenciador de redes sociais |
| `marketing` | `MarketingModule` | Módulo de marketing |
| `defensive` | `DefensiveArchitecture` | Arquitetura defensiva / segurança |
| `settings` | `AdminSettings` | Configurações do sistema |
| `devlab` | `LabIntelligence` | Laboratório de inteligência |
| `crawler` | `CrawlerMonitor` | Monitor do crawler de dados |

### 25.2 Funcionalidades por sub-módulo

**UserDataDashboard:** Lista todos os usuários registrados, dados de uso, última atividade

**FinanceModule:** MRR, ARR, churn, receita por plano, projeções

**UserIntelligence:** Análise de comportamento, segmentos, cohorts

**SocialMediaManager:** Agendamento de posts, métricas de engagement

**MarketingModule:** Campanhas, funil de conversão, CAC, LTV

**DefensiveArchitecture:** Status dos sistemas de segurança, rate limiting, IPs bloqueados

**LabIntelligence:** Ambiente de experimentação com modelos de IA

**CrawlerMonitor:** Status do crawler de notícias e dados de mercado

**SlippageSimulator:** `/src/app/components/admin/SlippageSimulator.tsx`  
Simula impacto real do slippage em diferentes condições de mercado.

---

## 26. NEURAL ASSISTANT

**Arquivo:** `/src/app/components/NeuralAssistant.tsx`  
Aberto via `FloatingAssistantButton` (botão flutuante no canto inferior direito)

### 26.1 Interface

- Painel lateral deslizante (slide-in da direita)
- Campo de texto para input escrito
- Botão de microfone para input por voz
- Botão de alto-falante para reprodução de resposta
- Toggle de gênero de voz (masculino/feminino)
- Toggle de auto-speak (reproduz resposta automaticamente)
- Histórico de mensagens scrollável
- Botão de limpar conversa

### 26.2 Hook useVoiceChat

```typescript
const {
  messages,         // Histórico de mensagens
  isListening,      // Microfone ativo
  isSpeaking,       // TTS reproduzindo
  isProcessing,     // Processando resposta
  startListening,   // Ativa microfone (Web Speech API)
  stopListening,    // Para microfone
  sendTextMessage,  // Envia mensagem de texto
  stopSpeaking,     // Para reprodução de voz
  clearMessages,    // Limpa histórico
} = useVoiceChat({ voiceGender, autoSpeak });
```

### 26.3 Capacidades do assistente

- Responde perguntas sobre o mercado atual (usa `MarketContext`)
- Analisa portfólio e sugere ações (usa `TradingContext`)
- Explica indicadores técnicos
- Gera análises de ativos
- Interpretação de nível de risco
- Comandos de voz para controlar a plataforma

### 26.4 Sistema de voz

**Reconhecimento (STT):** `Web Speech API` — `SpeechRecognition`  
**Síntese (TTS):** `Web Speech API` — `SpeechSynthesis`  
Gênero feminino: voz com `pitch` mais alto, `rate` 0.95  
Gênero masculino: voz com `pitch` padrão, `rate` 0.9

---

## 27. CAMADA DE SERVIÇOS

### 27.1 DirectBinanceService.ts

Busca dados da Binance em cascata:
1. `api.binance.com` direto
2. Proxy `allorigins.win` (CORS fallback)
3. Proxy `corsproxy.io` (CORS fallback)
4. Retorna `null` silenciosamente se tudo falhar

```typescript
fetchDirectBinance(symbol: string): Promise<BinanceTickerData | null>
fetchMultipleBinance(symbols: string[]): Promise<Map<string, BinanceTickerData>>
isBinanceSymbol(symbol: string): boolean
```

### 27.2 RealMarketDataService.ts

Roteamento inteligente de dados:
1. **Crypto** → `fetchDirectBinance()` → fallback simulado
2. **Forex/Índices** → `getFallbackData()` (dados simulados realistas)

Cache interno com TTL de 2 segundos.  
`subscribeToMarketData(symbols, callback, interval)` — polling periódico

### 27.3 UnifiedMarketDataService.ts

Ponto único de entrada para dados de mercado:
- Para crypto: usa `BinanceWebSocketService`
- Para outros: usa `RealMarketDataService`
- Expõe `getUnifiedMarketData()` e `subscribeToRealtimeData()`

### 27.4 BinanceWebSocketService.ts

Gerencia conexões WebSocket com a Binance:
- `wss://stream.binance.com:9443/ws/`
- Reconexão automática com backoff exponencial
- Suporta múltiplos símbolos em paralelo
- Normaliza ticks para formato interno

### 27.5 BinancePollingService.ts

Fallback quando WebSocket falha (CSP/CORS):
- Polling REST a cada 120 segundos
- Mesmo callback interface do WebSocket

### 27.6 MT5PriceValidator.ts

Valida preços locais contra preços reais do MT5:
- Conecta ao MetaAPI
- Busca preços para lista de símbolos
- Calcula diferença entre preço local e MT5
- `isAccurate` = diferença < 0.1%
- Cache de 5 segundos por símbolo

### 27.7 MetaAPIDirectClient.ts

Cliente direto para MetaAPI:
- Autenticação via token
- `getPrice(symbol)` — preço atual
- `getCandles(symbol, timeframe, count)` — velas históricas
- Reconexão automática via `reconnectInterval`

### 27.8 MetaApiService.ts

Camada de abstração sobre MetaAPI:
- Modo offline automático quando Supabase retorna 402
- Fallback para `RealMarketDataService`
- `getMarketData(symbol)` → `MarketData`
- `getCandles(symbol, timeframe)` → `MetaApiCandle[]`

### 27.9 LocalAuthService.ts

Autenticação offline sem backend:
- `register(email, password, name)` → salva no localStorage
- `login(email, password)` → verifica hash
- `logout()` → limpa sessão
- `getCurrentUser()` → usuário da sessão ativa
- Hash simples (não usar em produção real — usar bcrypt)

### 27.10 EmergencyOfflineMode.ts

Modo de emergência quando Supabase está indisponível:
- `activateEmergencyOfflineMode()` — desativa todas as chamadas Supabase
- `isEmergencyOfflineMode()` — verifica se está ativo
- `emergencyFetch()` — intercepta fetch e retorna mock
- Persiste estado no `localStorage` (key: `neural_emergency_offline`)
- Ativado automaticamente quando detecta erro 402 ou CORS

### 27.11 KeyLevelsEngine.ts

Motor de detecção de níveis chave:
- `analyzeMarketStructure(candles, currentPrice, symbol)` → `MarketStructure`
- `makeSmartTradingDecision(structure, direction, config)` → `TradingDecision`

Detecta:
- Round Numbers psicológicos (ex: 100.000, 50.000)
- Suportes e resistências dinâmicos (topos e fundos anteriores)
- Zonas de liquidez (confluência de velas)
- Níveis de Fibonacci automáticos

### 27.12 ApexScoreEngine.ts

Calcula score de mercado (0-100):
- Usa RSI, MACD, tendência, volume, volatilidade
- Score < 30: mercado fraco/baixo
- Score 30-70: mercado normal
- Score > 70: mercado forte/alto

### 27.13 BreakoutDetector.ts

Detecta rompimentos de preço:
```typescript
interface BreakoutSignal {
  type: 'BULLISH' | 'BEARISH';
  stage: 'FORMING' | 'IMMINENT' | 'CONFIRMED' | 'FAILED';
  keyLevel: number;
  volumeRatio: number;   // > 1.5 = volume institucional
  rsi: number;
  confidence: number;   // 0-100
}
```

### 27.14 DataSourceRouter.ts

Decide qual fonte de dados usar por símbolo:
- Crypto USDT → Binance
- Forex major → MetaAPI/Fallback
- Índices → MetaAPI/Fallback
- Commodities → MetaAPI/Fallback

### 27.15 AITradingPersistenceService.ts

Persiste estado da IA no localStorage:
- Histórico de trades
- Configurações da IA
- Estado do portfolio
- Logs recentes

### 27.16 SymbolMappingService.ts

Normaliza símbolos entre plataformas:
- `BTCUSD` ↔ `BTCUSDT` (Binance)
- `SPX` ↔ `US500` (MT5)
- `NQ` ↔ `NAS100` (MT5)
- `DJI` ↔ `US30` (MT5)

### 27.17 NexusAlertSystem.ts

Sistema unificado de alertas:
- Alertas de tilt emocional
- Alertas de spoofing no book
- Alertas de rompimento
- Integração com TTS para alertas falados

### 27.18 Brokers Service Layer

**Pasta:** `/src/app/services/brokers/`

`BrokerAdapter.ts` — interface padrão para todos os brokers:
```typescript
interface BrokerAdapter {
  connect(credentials): Promise<boolean>
  disconnect(): void
  getBalance(): Promise<number>
  openOrder(params): Promise<OrderResult>
  closeOrder(orderId): Promise<boolean>
  getOpenPositions(): Promise<Position[]>
}
```

`MT5Adapter.ts` — implementação para MT5 via MetaAPI

`brokerManager` — singleton que gerencia o adapter ativo

---

## 28. CONTEXTOS (ESTADO GLOBAL)

### 28.1 AuthContext

```typescript
{
  user: SupabaseUser | LocalUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  mockLogin: (email, name?) => void;
}
```

### 28.2 MarketContext

**O contexto mais crítico.** Armazena todos os preços em tempo real.

```typescript
{
  marketState: {
    prices: Record<string, number>;      // Todos os preços
    spreads: Record<string, number>;
    status: 'SYNCED' | 'DRIFTING' | 'DISCONNECTED';
    lastUpdate: Date;
    calibrationOffset: Record<string, number>; // Offset MT5 vs Web
    dailyChanges: Record<string, number>;
    dataSources: Record<string, string>;
  };
  updatePrice: (symbol, price, change?) => void;
  setCalibration: (symbol, mt5Price) => void;  // Calibra vs MT5
  calibrateAll: (mt5Data) => void;
}
```

**Preços iniciais hardcoded** (substituídos por dados reais quando disponíveis):
EUR/USD: 1.0845 | BTC/USD: 96.000 | ETH/USD: 3.500 | SP500: 6.800 | GOLD: 2.650

### 28.3 MarketDataContext

Contexto específico para dados do MT5 Price Validator:

```typescript
{
  prices: Record<string, ValidatedPrice>;
  isConnected: boolean;
  lastUpdate: Date;
  connect: (token, accountId) => Promise<boolean>;
  disconnect: () => void;
  getPriceForSymbol: (symbol) => ValidatedPrice | null;
}
```

### 28.4 TradingContext (ApexTradingProvider)

O contexto mais complexo. Expõe toda a lógica de trading:

```typescript
{
  // Estado
  isActive: boolean;
  isPaused: boolean;
  activeOrders: TradeVisual[];
  tradeHistory: TradeVisual[];
  portfolio: PortfolioState;
  recentLogs: string[];
  houseStats: HouseStats;
  performanceMetrics: any;
  aiConfig: AIConfig;
  executionMode: 'DEMO' | 'LIVE';
  isConnectedToMT5: boolean;
  selectedAsset: string;
  
  // Ações
  startLogic: () => void;
  stopLogic: () => void;
  pauseLogic: () => void;
  resumeLogic: () => void;
  resetLogic: () => void;
  forceCloseAll: () => void;
  toggleAI: () => void;         // alias para start/stop
  updateAIConfig: (config) => void;
  setConfig: Dispatch<SetStateAction<AIConfig>>;
  connectToMT5: (credentials) => Promise<void>;
  disconnectFromMT5: () => void;
  updateBalance: (balance) => void;
  syncPositionsFromMT5: (positions) => void;
  panicClose: () => Promise<void>;
  resetPortfolio: (balance) => void;
  closeHedgedPositions: () => void;
  applyCommission: (percentage) => void;
  setExecutionMode: Dispatch<SetStateAction<'DEMO'|'LIVE'>>;
  setSelectedAsset: (asset) => void;
}
```

### 28.5 SimulatorContext

Estado do simulador de trading virtual:
```typescript
{
  balance: number;
  equity: number;
  openOrders: Order[];
  closedOrders: Order[];
  openOrder: (params) => void;
  closeOrder: (id, price) => void;
  updateOrderPrices: (symbol, price) => void;
  resetAccount: () => void;
}
```

### 28.6 AssistantContext

Estado do Neural Assistant:
```typescript
{
  isAssistantOpen: boolean;
  toggleAssistant: () => void;
  closeAssistant: () => void;
}
```

### 28.7 DebugProvider

Controla o modo de debug da plataforma. Envolvido em `DebugController`.

---

## 29. HOOKS CUSTOMIZADOS

### useApexLogic.ts

O hook mais importante. Implementa todo o motor de trading:

- **Mutex pattern** — previne execuções concorrentes
- **Loop de trading** — avalia o mercado a cada candle (usando `setInterval`)
- **Anti-hedging** — detecta e evita posições opostas no mesmo ativo
- **Safe Mode** — modo seguro ativado após sequência de perdas
- Persistência no localStorage (key: `apex_logic_state_v15_FIXED`)

### useMT5Prices.ts

Busca preços do MT5 via MetaAPI:
- `useRef` para `symbols` (evita re-renders desnecessários — bug corrigido)
- Polling a cada 30 segundos quando conectado
- Fallback para preços do `MarketContext` quando desconectado

### useSupabaseRealtimeTurbo.ts

Streaming de dados via Supabase Realtime:
- `useMemo` para configuração (evita loop infinito — bug corrigido)
- Modes: FAST (2s), MEDIUM (5s), SLOW (10s)
- Reconexão automática

### useMarketData.ts

Hook simples para acessar `MarketDataContext`.

### useMarketPrice.ts

Hook centralizado para preço de um ativo específico:
- Tenta MT5 primeiro
- Fallback para MarketContext
- Retorna `{ price, change, source }`

### useMarketScanner.ts

Varre múltiplos ativos buscando oportunidades:
- Analisa RSI, tendência, volume
- Retorna lista de oportunidades classificadas por score

### useRealtimePrice.ts

Subscreve ao preço em tempo real de um ativo via WebSocket.

### useBinanceWebSocket.ts

Hook para conectar ao WebSocket da Binance:
- Gerencia conexão e reconexão
- Expõe `currentPrice`, `isConnected`

### useVoiceChat.tsx

Hook para o Neural Assistant (voz):
- Gerencia reconhecimento e síntese de voz
- Processa mensagens e gera respostas contextuais
- Usa `TradingContext` e `MarketContext` para respostas inteligentes

### useVoiceSystem.ts

Hook para o sistema de voz do QuantumAnalysis:
- Análise de sentimento da voz (detecção de tilt)
- Nível de estresse (0-100)
- `isTilted: boolean`

### useSpeechAlert.tsx

Hook simples para alertas falados:
- `speak(text)` — usa SpeechSynthesis
- `setEnabled(bool)` — ativa/desativa
- Fila de mensagens para não sobrepor

### useBreakoutMonitor.ts

Monitora rompimentos em tempo real:
- Usa `BreakoutDetector`
- Dispara callbacks quando `CONFIRMED`

### useBacktestLiveProgress.ts

Acompanha progresso do backtest em execução.

### useBacktestReplay.ts

Controla replay frame a frame do backtest.

### useSpreads.ts

Busca spreads atuais dos ativos (em pips).

### useAIPersistence.ts

Persiste e restaura estado completo da IA.

### useDevLabStore.ts

Estado do Dev Lab (laboratório).

### useSmartMarketData.ts

Seleção inteligente de fonte de dados por ativo.

### useSmartScroll.ts

Hook para scroll inteligente em containers.

### useUserProfile.ts

Busca perfil do usuário (fullName, avatar, etc).

### useFavicon.tsx

Define o favicon dinamicamente com logo da plataforma.

---

## 30. COMPONENTES DO LAYOUT

### Header (`/src/app/components/layout/Header.tsx`)

- Título da view atual
- Badge de admin (se aplicável)
- Botão de logout
- Avatar do usuário
- `NotificationCenter` — centro de notificações

### MarketTicker (`/src/app/components/MarketTicker.tsx`)

Ticker horizontal no rodapé com preços scrollando:
- BTC, ETH, EUR/USD, XAU/USD, US30, NAS100
- Animação CSS de scroll infinito (não usa JavaScript)
- Atualiza preços a cada 30 segundos

### TickerFooter (`/src/app/components/layout/TickerFooter.tsx`)

Ticker alternativo mais simples.

### DisclaimerBar (`/src/app/components/layout/DisclaimerBar.tsx`)

Barra de aviso legal no rodapé.

### PrivacyConsent (`/src/app/components/layout/PrivacyConsent.tsx`)

Modal de consentimento de cookies/privacidade.

### NotificationCenter (`/src/app/components/layout/NotificationCenter.tsx`)

- Dropdown de notificações
- Badge com contador de não lidas
- Tipos: trade, alerta de risco, sistema

### ErrorBoundary (`/src/app/components/ErrorBoundary.tsx`)

React Error Boundary global:
- Captura erros de renderização
- Exibe tela de erro amigável
- Botão de "Tentar novamente"

---

## 31. DESIGN SYSTEM

**Pasta:** `/src/app/components/ui/`

Baseado em **shadcn/ui** com tema dark customizado.

### Componentes disponíveis (50+):

`accordion` | `alert-dialog` | `alert` | `aspect-ratio` | `avatar` | `badge` |
`breadcrumb` | `button` | `calendar` | `card` | `carousel` | `chart` |
`checkbox` | `collapsible` | `command` | `context-menu` | `dialog` | `drawer` |
`dropdown-menu` | `form` | `hover-card` | `input-otp` | `input` | `label` |
`menubar` | `navigation-menu` | `pagination` | `popover` | `progress` |
`radio-group` | `resizable` | `scroll-area` | `select` | `separator` |
`sheet` | `skeleton` | `slider` | `sonner` | `switch` | `table` |
`tabs` | `textarea` | `toggle-group` | `toggle` | `tooltip`

### TacticalButton

Componente customizado com estilo "militar/tático":
- Variantes: `primary`, `danger`, `ghost`, `success`
- Animação de pulse quando ativo
- Feedback visual de loading

### Paleta de cores (dark theme):

```
Fundo: #000000 (preto puro) / #09090b (zinc-950)
Superfícies: #18181b (zinc-900) / #27272a (zinc-800)
Bordas: #3f3f46 (zinc-700) / rgba(255,255,255,0.05)
Texto primário: #f4f4f5 (zinc-100)
Texto secundário: #a1a1aa (zinc-400)
Acento principal: #10b981 (emerald-500)
Acento secundário: #06b6d4 (cyan-500)
Danger: #ef4444 (red-500)
Warning: #f59e0b (amber-500)
```

---

## 32. SUPABASE

### 32.1 Configuração

```typescript
// /src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(projectId, publicAnonKey);

// /utils/supabase/info.ts
export const projectId = 'bgarakvnuppzkugzptsr';
export const publicAnonKey = '...';
```

### 32.2 Tabelas utilizadas (presumidas)

| Tabela | Uso |
|--------|-----|
| `auth.users` | Gerenciado pelo Supabase Auth |
| `profiles` | Dados de perfil do usuário |
| `transactions` | Histórico de depósitos/saques |
| `trades` | Histórico de trades (quando LIVE) |
| `settings` | Configurações por usuário |

### 32.3 Edge Functions

As Edge Functions são chamadas pelo frontend para contornar CORS:

| Function | Rota | Uso |
|----------|------|-----|
| `mt5-prices` | `/functions/v1/mt5-prices` | Preços MT5 em tempo real |
| `mt5-candles` | `/functions/v1/mt5-candles` | Candles históricos MT5 |
| `metaapi/tick` | `/functions/v1/metaapi/tick` | Tick data MetaAPI |
| `make-server-1dbacac6` | `/functions/v1/make-server-1dbacac6` | Proxy geral de mercado |

### 32.4 Limitação de cota (problema atual)

O projeto está na tier gratuita do Supabase. Quando atinge o limite:
- Retorna erro **402 Payment Required**
- `EmergencyOfflineMode` é ativado automaticamente
- Todas as chamadas ao Supabase são bloqueadas
- Sistema usa apenas dados locais/Binance direta

---

## 33. INTEGRAÇÕES EXTERNAS

### 33.1 MetaAPI

- **Site:** https://metaapi.cloud
- **Uso:** Conectar ao MetaTrader 5 sem instalar EA
- **Autenticação:** Token de acesso + Account ID (UUID)
- **Endpoints usados:**
  - `GET /users/current/accounts/{accountId}/symbols/{symbol}/current-price`
  - `GET /users/current/accounts/{accountId}/history-deals/time/{startTime}/{endTime}`
  - `POST /users/current/accounts/{accountId}/trade` (para ordens LIVE)

### 33.2 Binance Public API

- **Base URL:** `https://api.binance.com/api/v3/`
- **Endpoints:**
  - `GET /ticker/24hr?symbol=BTCUSDT` — dados de 24h
  - `GET /klines?symbol=BTCUSDT&interval=1m&limit=200` — candles
- **WebSocket:** `wss://stream.binance.com:9443/ws/{symbol}@ticker`
- **Limitações:** CORS bloqueia em alguns ambientes (usar proxy)

### 33.3 Web Speech API

- Nativa do browser (Chrome, Edge, Safari)
- `SpeechRecognition` — voz para texto
- `SpeechSynthesis` — texto para voz
- Não requer chave de API

---

## 34. BUGS IDENTIFICADOS E COMO EVITÁ-LOS

### BUG 1: Loop Infinito de Refresh (CRÍTICO — CORRIGIDO)
**Causa:** `window.location.reload()` chamado dentro de um `useEffect` quando detectava cache antigo, criando loop infinito no iframe do Figma/browsers.  
**Solução:** Substituir por limpeza silenciosa do localStorage sem reload.  
**Regra:** NUNCA usar `window.location.reload()` dentro de hooks ou effects. Se precisar, use `setTimeout` com guard para evitar loops.

### BUG 2: Loop Infinito no useSupabaseRealtimeTurbo (CRÍTICO — CORRIGIDO)
**Causa:** Dependência de objeto criado inline no `useEffect`, que recriava novo objeto a cada render, re-disparando o effect infinitamente.  
**Solução:** `useMemo` para estabilizar o objeto de configuração.  
**Regra:** Nunca passar objetos/arrays criados inline como dependências de `useEffect`. Sempre usar `useMemo` ou `useRef`.

### BUG 3: Dependência Instável em useMT5Prices (CORRIGIDO)
**Causa:** Array `symbols` recriado a cada render como prop, causando re-subscription infinita.  
**Solução:** `useRef` para o array de símbolos, comparando por valor antes de re-subscrever.  
**Regra:** Arrays e objetos como dependência de hooks devem ser estabilizados com `useRef` ou `useMemo`.

### BUG 4: CORS na Binance API
**Causa:** `api.binance.com` rejeita requests diretos de ambientes sandbox/iframe.  
**Solução:** Cascade de fallbacks: direto → allorigins.win → corsproxy.io → dados simulados.  
**Regra:** Sempre ter fallback para APIs externas. Nunca assumir que a chamada vai funcionar.

### BUG 5: console.warn ruidoso no MarketContext (CORRIGIDO)
**Causa:** `useMarketContext()` logava warning sempre que era chamado durante hot reload ou inicialização do `TradingContext` (que monta antes do `MarketProvider` completar hidratação).  
**Solução:** Remover o `console.warn`. O fallback com valores padrão já é suficiente.  
**Regra:** Fallbacks silenciosos. Logs de warning devem ser reservados para situações realmente anômalas em produção.

### BUG 6: Quota Supabase 402 quebra toda a plataforma
**Causa:** Toda a autenticação e dados dependiam do Supabase. Ao estourar quota, nada funcionava.  
**Solução:** `LocalAuthService` como fallback de auth. `EmergencyOfflineMode` para dados. `DirectBinanceService` para preços.  
**Regra:** Nunca ter Single Point of Failure. Todo serviço crítico precisa de fallback.

### BUG 7: Variáveis mortas causando erros de TypeScript
**Causa:** Variáveis declaradas mas nunca usadas em `RealMarketDataService.ts` e `market-service.ts`.  
**Solução:** Remoção das variáveis.  
**Regra:** Ativar `noUnusedLocals: true` no `tsconfig.json`.

### BUG 8: MarketContext warn constante durante desenvolvimento
**Causa:** `TradingContext` usa `useMarketContext()` e monta antes do `MarketProvider` completar.  
**Solução:** Remover warn, manter fallback silencioso.  
**Regra:** Contextos usados em contextos aninhados devem ter fallback defensivo e silencioso.

---

## 35. GUIA DE RECONSTRUÇÃO LIMPA

### 35.1 Estrutura recomendada para novo projeto

```
Usar React Router v6+ (Data Mode) para navegação real entre rotas
— ao invés do sistema de `currentView` em string, que não tem URL, histórico ou deep-linking
```

### 35.2 Stack recomendada (sem os bugs)

```
React 18 + TypeScript (strict mode ativo)
Vite
Tailwind CSS v4
React Router v6 (Data Mode) — para navegação real
Zustand — ao invés de Context API aninhada (mais simples, sem problemas de ordem)
React Query (TanStack Query) — para fetching assíncrono com cache e retry
motion/react — animações
KlineCharts — gráfico candlestick
Recharts — gráficos de métricas
Supabase — auth + database
```

### 35.3 Regras de arquitetura (evitar bugs)

**1. Estado global: Use Zustand**
```typescript
// Ao invés de 6 Context aninhados, 1 store por domínio:
const useAuthStore = create(...)
const useMarketStore = create(...)
const useTradingStore = create(...)
```

**2. Fetching: Use React Query**
```typescript
// Ao invés de useEffect + useState manual:
const { data, isLoading, error } = useQuery({
  queryKey: ['binance', symbol],
  queryFn: () => fetchDirectBinance(symbol),
  retry: 2,
  staleTime: 5000,
});
```

**3. WebSocket: Isolar em serviço singleton**
```typescript
// Um único WebSocketManager que componentes subscrevem
// Nunca criar novas conexões WebSocket dentro de componentes React
class BinanceWSManager {
  private connections = new Map<string, WebSocket>();
  subscribe(symbol, callback) { ... }
  unsubscribe(symbol, callback) { ... }
}
export const binanceWS = new BinanceWSManager();
```

**4. Estabilidade de dependências em hooks**
```typescript
// ❌ ERRADO — recria array a cada render:
useEffect(() => { subscribe(symbols) }, [symbols]);

// ✅ CORRETO — estabiliza com useRef:
const symbolsRef = useRef(symbols);
useEffect(() => { subscribe(symbolsRef.current) }, []); // sem dependência no array
```

**5. Fallback em cascata para dados**
```typescript
async function getPrice(symbol) {
  return tryBinanceDirect(symbol)
    ?? tryBinanceProxy(symbol)
    ?? trySupabaseEdge(symbol)
    ?? getSimulatedPrice(symbol); // sempre retorna algo
}
```

**6. Nunca usar window.location.reload() em React**
```typescript
// ❌ ERRADO:
if (cacheVersion !== expectedVersion) window.location.reload();

// ✅ CORRETO:
if (cacheVersion !== expectedVersion) {
  localStorage.clear();
  // Usar navigate('/') do React Router ou resetar estado
}
```

**7. Error Boundaries em todos os módulos pesados**
```typescript
// Cada módulo independente deve ter seu ErrorBoundary:
<ErrorBoundary fallback={<ModuleError name="ChartView" />}>
  <ChartView />
</ErrorBoundary>
```

### 35.4 Prioridade de desenvolvimento (ordem recomendada)

**Fase 1 — Fundação**
1. Auth (Supabase + fallback local)
2. Layout (Sidebar, Header, Footer)
3. MarketContext/Store com preços reais (Binance)
4. Dashboard básico (MarketScoreBoard simplificado)

**Fase 2 — Core Trading**
5. ChartView com KlineCharts + indicadores
6. AI Trader (lógica básica sem MT5)
7. TradingContext/Store
8. Portfolio + Funds

**Fase 3 — Funcionalidades avançadas**
9. Integração MetaAPI (MT5)
10. Backtest
11. Simulador
12. Strategy Builder

**Fase 4 — Módulos complementares**
13. Quantum Analysis + Voice
14. IA Preditiva
15. Marketplace
16. Admin Dashboard
17. Neural Assistant

### 35.5 Banco de dados (tabelas recomendadas no Supabase)

```sql
-- Perfis de usuário
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  risk_profile TEXT DEFAULT 'moderate',
  trading_experience TEXT,
  verification_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Histórico de trades
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  symbol TEXT NOT NULL,
  side TEXT NOT NULL, -- 'BUY' | 'SELL'
  quantity DECIMAL NOT NULL,
  entry_price DECIMAL NOT NULL,
  exit_price DECIMAL,
  stop_loss DECIMAL,
  take_profit DECIMAL,
  pnl DECIMAL,
  status TEXT DEFAULT 'OPEN', -- 'OPEN' | 'CLOSED'
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- Configurações de trading da IA
CREATE TABLE ai_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  config JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transações financeiras
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL, -- 'deposit' | 'withdrawal'
  amount DECIMAL NOT NULL,
  method TEXT, -- 'pix' | 'card' | 'crypto'
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Estratégias salvas
CREATE TABLE strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  config JSONB NOT NULL,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## RESUMO EXECUTIVO (para passar para outra IA)

A **Neural Day Trader Platform** é um SaaS de trading quantitativo com:

**6 módulos principais:** Dashboard, ChartView, AI Trader, IA Preditiva, Análise Quântica, Admin  
**30+ serviços** de dados (Binance, MetaAPI, fallbacks offline)  
**6 contextos globais** de estado  
**20+ hooks customizados**  
**300+ ativos** suportados (Crypto, Forex, Índices, Commodities, Ações)  
**Integração MetaTrader 5** via MetaAPI para trading real  
**Voz bidirecional** (STT + TTS) em múltiplos módulos  
**Backtest completo** com replay e Strategy Builder visual  
**Simulador** com conta virtual  
**Pyramiding** com 5 estratégias de scaling  
**Prop Challenge** simulando regras de mesa proprietária  
**Marketplace** de estratégias e bots  
**Sistema de afiliados** com rastreamento de referrals  
**Admin Dashboard** com 10 sub-módulos de gestão  

**Maior problema de arquitetura atual:** Context API aninhada com 6 camadas causando problemas de ordem de montagem e dependências circulares. A reconstrução deve usar **Zustand** + **React Query** para eliminar 90% dos bugs de estado.

**Segunda maior problema:** Single Point of Failure no Supabase. Todo o sistema de fallback (LocalAuthService, EmergencyOfflineMode, DirectBinanceService) foi construído reativamente. A reconstrução deve ter fallback planejado desde o início.

---

*Documento gerado em 21/04/2026 — Neural Day Trader Platform Blueprint v1.0*
