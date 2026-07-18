# Spec Técnica — Módulo de Gerenciamento de Risco

**Status**: proposto, não implementado. Escrito em 2026-07-18 a partir de [`RISK_MANAGEMENT_STRATEGY.md`](../RISK_MANAGEMENT_STRATEGY.md) (seção 3, pesquisa de risk management) cruzado com o estado real do código (`useApexLogic.ts`, `TradeSizing.ts`, `RiskThermometer.tsx`, `NeuralRiskGuardian.ts`).

## 0. O que já existe hoje (não recriar)

| Peça | Onde | Estado real |
|---|---|---|
| Daily loss limit | `useApexLogic.ts`, Health Check Guardian (`setInterval` 5s) | **Implementado, reativo**: calcula P&L desde 00:00 UTC via `orderHistoryRef`, ativa Safe Mode (`isActive=false`) se ultrapassado |
| Min win rate | idem | **Implementado, reativo**: amostra mínima de 10 trades fechados, ativa Safe Mode se abaixo do configurado |
| Max drawdown | idem | **Implementado, reativo**, mesmo mecanismo |
| Safe Mode (bloqueio) | `useApexLogic.ts:1477` (`startAI`), `useApexLogic.ts:716-720` | Ativa via `setIsActive(false)` — bloqueia o loop inteiro, não é um bloqueio granular por trade |
| Trailing stop | `TradeSizing.ts` (`trailStopLoss`), `stopLossMode==='DINAMICO'` | Implementado, só melhora a favor do trade |
| Position sizing | `TradeSizing.ts` (`calculatePositionSize`) | Implementado, mas **linear/fixo** — sem ATR, sem volatilidade do ativo |
| TP/SL | `TradeSizing.ts` (`calculateTpSl`) | Implementado por preset de pontos fixos (não ATR-adaptativo) |
| `RiskThermometer.tsx` | Dashboard | **Casca visual pura** — só lê `portfolio.currentDrawdown`/`maxDrawdownLimit`, nenhum cálculo, nenhum enforcement |
| `NeuralRiskGuardian.ts` | `src/lib/modules/` | **Stub vazio** — só exporta o tipo `RiskProfileType`, classe sem lógica |

**Gap real que esta spec endereça**: (1) o enforcement existente é *reativo a cada 5s*, não *pré-trade instantâneo*; (2) não há bloqueio granular (pausa tudo, não "recusa só esta ordem"); (3) sizing/TP/SL não usam ATR; (4) não existe cooldown pós-perdas consecutivas, limite de trades/dia, nem checagem de correlação entre posições abertas — os 4 itens de "alta prioridade" da pesquisa (seção 3 de `RISK_MANAGEMENT_STRATEGY.md`) inexistem hoje.

## 1. Princípio de arquitetura (da pesquisa, seção 3)

> "Mesmo Renaissance e Citadel/Millennium separam estritamente quem gera o sinal de quem impõe o limite de risco — o enforcement nunca é discricionário no momento do trade."

Consequência de design: o módulo de risco não é mais uma checagem dentro do Health Check Guardian (que audita o estado geral a cada 5s) — vira um **gate síncrono, chamado sempre antes de qualquer `openPosition()`**, que só o motor de risco pode aprovar ou vetar. O sinal da estratégia (`evaluateStrategyAt`) nunca abre posição sozinho.

## 2. Schema de regras (`RiskRules`)

Novo arquivo: `src/app/services/risk/RiskRules.ts` (schema, sem lógica — mesmo padrão de `strategy.ts`).

```typescript
export interface RiskRules {
  // Máxima prioridade
  dailyLossLimitPercent: number;        // já existe em AIConfig.dailyLossLimit — reaproveitar campo
  maxDrawdownPercent: number;           // já existe — reaproveitar
  drawdownAnchor: 'INTRADAY_PEAK' | 'DAILY_CLOSE'; // NOVO: FTMO/Topstep ancoram no fechamento diário, não no pico intradiário — decidir aqui, hoje implícito e não documentado no código

  // Alta prioridade — NENHUM destes existe hoje
  positionSizing: {
    mode: 'FIXED_FRACTIONAL' | 'ATR_ADJUSTED';
    riskPerTradePercent: number;        // ex: 0.5-1% (FTMO-like), hoje é um valor livre em AIConfig
    atrMultiplier?: number;             // só se mode === 'ATR_ADJUSTED'
  };
  cooldown: {
    consecutiveLossesTrigger: number;   // ex: 3
    cooldownMinutes: number;            // ex: 60
  };
  maxTradesPerDay: number;
  correlationGuard: {
    thresholdAbs: number;               // ex: 0.7
    action: 'WARN' | 'REDUCE_SIZE' | 'BLOCK';
  };

  // Baixa prioridade / informativo apenas — nunca usado para enforcement automático
  kellyFraction?: number;               // 0.25-0.5, só como sugestão exibida ao usuário
}
```

**Reaproveitamento deliberado**: `dailyLossLimitPercent`/`maxDrawdownPercent` continuam sendo os campos já existentes em `AIConfig` (`dailyLossLimit`, e o `maxDrawdown` já lido pelo Health Check Guardian) — não duplicar o dado, só formalizar o schema em torno deles.

## 3. Hook de enforcement (`useRiskGuardian`)

Novo arquivo: `src/app/hooks/useRiskGuardian.ts`. Substitui a parte de risco do Health Check Guardian dentro de `useApexLogic.ts` (mantém lá só a leitura de `healthStatus`/`isSafeMode` para a UI).

```typescript
interface RiskGuardianResult {
  approved: boolean;
  reason?: string;
  adjustedSize?: number; // quando correlationGuard.action === 'REDUCE_SIZE'
}

function evaluateRiskGate(
  proposedTrade: { symbol: string; direction: 'LONG'|'SHORT'; proposedSize: number },
  rules: RiskRules,
  state: { orderHistory: Trade[]; activeOrders: Trade[]; equityCurve: number[] },
): RiskGuardianResult
```

Ponto de integração real, em `useApexLogic.ts`: chamado de forma síncrona logo antes do bloco que hoje monta a posição (o mesmo ponto onde o sinal filtrado por `direction`/`activeAssets` já decidiu operar) — se `approved === false`, loga o motivo e pula o ciclo, sem tocar em `isActive`/Safe Mode (bloqueio granular por trade, distinto do bloqueio total já existente).

### 3.1 Daily loss limit + max drawdown com bloqueio real (máxima prioridade)

- Já tem o cálculo (`orderHistoryRef`, P&L desde 00:00 UTC). **Mudança de comportamento**: hoje só ativa Safe Mode depois do fato consumado (checagem a cada 5s pode deixar 1-2 trades passarem entre o estouro do limite e a pausa). Gate novo checa o limite *antes* de cada trade proposto, usando o mesmo cálculo — bloqueia a próxima ordem instantaneamente, sem esperar o próximo tick do Health Check.
- `drawdownAnchor`: adotar `DAILY_CLOSE` como default (modelo Topstep — "ancorado no fechamento diário do saldo, não no pico intradiário", evita punir lucro intradiário não realizado). Precisa de um novo campo persistido: saldo de fechamento do dia anterior (calculável a partir de `ai_portfolio_snapshots`, já existente no Supabase via Fase 2).

### 3.2 Position sizing por % de risco + ATR (alta prioridade)

- `TradeSizing.calculatePositionSize()` ganha um segundo modo (`ATR_ADJUSTED`): `size = (riskPerTradePercent/100 × capital) / (ATR(symbol) × atrMultiplier × pointValue)`.
- ATR já é calculado em `TechnicalIndicators.ts` (usado por `StrategyEvaluator`) — reaproveitar, não recalcular.
- `getPointValue()` em `TradeSizing.ts` hoje não distingue índice/cripto (caem no default `1.0`) — precisa de entradas explícitas antes do ATR sizing fazer sentido para essas classes (bug latente, não um requisito novo desta spec, mas bloqueia a Fase 2 de implementação se não for corrigido antes).

### 3.3 Cooldown automático após N perdas consecutivas (alta prioridade)

- Novo: contagem de perdas consecutivas a partir do fim de `orderHistoryRef` (para no primeiro trade vencedor). Se `>= consecutiveLossesTrigger`, gate recusa novas entradas por `cooldownMinutes`, com timestamp do cooldown persistido em `ai_sessions` (para sobreviver a reload — mesma tabela já usada pela Fase 2).

### 3.4 Limite rígido de trades/dia (alta prioridade)

- Contagem simples de `orderHistoryRef.filter(t => t.closedAt >= today) .length + activeOrders.length` vs `maxTradesPerDay`.

### 3.5 Correlação entre posições abertas (alta prioridade)

- Correlação de preço (retornos das últimas N barras) entre o símbolo proposto e cada posição já aberta. Sem histórico de correlação pré-calculado no projeto — calcular sob demanda a partir do mesmo buffer de candles que `useApexLogic.ts` já mantém por ativo (60s de refresh). `action: 'REDUCE_SIZE'` como default (menos abrupto que `BLOCK`, mais seguro que só `WARN`).

## 4. Dashboard informativo (média prioridade — não é enforcement)

Sharpe/Sortino/Calmar/VaR/CVaR exibidos em `RiskThermometer.tsx` (que hoje só desenha um gauge de drawdown) — cálculo em novo `src/app/services/risk/RiskMetrics.ts`, puramente informativo, nunca bloqueia trade. Exibir com aviso de tamanho de amostra pequeno quando `orderHistory.length < 30` (mesmo princípio de amostra mínima já usado no win-rate check).

## 5. Nunca automático

Kelly fracionário: campo `kellyFraction` no schema existe só para cálculo de sugestão exibida na UI (ex: "seu histórico sugere 1/4 Kelly = X% por trade") — **nunca** entra em `calculatePositionSize()` como valor aplicado automaticamente. Mesma decisão já registrada em `RISK_MANAGEMENT_STRATEGY.md` seção 3.

## 6. Ordem de implementação sugerida

1. `RiskRules.ts` (schema) + `useRiskGuardian.ts` (gate síncrono) com **só** daily loss limit + max drawdown (migra o que já existe do Health Check pro gate pré-trade — menor risco, testa a integração sem funcionalidade nova).
2. Cooldown + limite de trades/dia (lógica nova, mas simples, sem dependência de ATR).
3. Position sizing ATR-adjusted (depende de corrigir `getPointValue` para índice/cripto primeiro).
4. Correlação entre posições.
5. Dashboard informativo (`RiskMetrics.ts`, liga em `RiskThermometer.tsx`).

## 7. Fora de escopo desta spec

Position sizing/enforcement por execução real de ordem (Fase 3, `/broker/execute`) — esta spec cobre o motor de decisão de risco, que roda igual em modo demo e real; a diferença de fase é só se a ordem realmente chega à corretora.
