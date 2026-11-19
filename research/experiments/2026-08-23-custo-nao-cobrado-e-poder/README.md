# Achado e Fix: Custo de Execução Não Cobrado (2026-08-23)

## Problema Descoberto

Entre **17 e 23 de agosto de 2026**, o motor executou **135 trades em produção (DEMO)** com a seguinte anomalia:

- ✅ **COST_GATE** rejeitou **7.618 candidatos** usando custo real do `CostModel.ts`
- ❌ **Mas o fechamento gravou** `commission: 0` em **135 de 135 trades**
- ❌ **PnL calculado** como `(preçoSaída − preçoEntrada) × notional/preçoEntrada`
  - Isto é: **preço médio nas duas pontas, sem spread, sem slippage**

### Impacto Medido

| Métrica | Valor |
|---------|-------|
| PnL bruto (sem custo) | −US$14,12 |
| Custo não cobrado | US$14,83 |
| **Resultado real** | **−US$28,95** |
| Custo como % do \|PnL\| | **105%** |

**O custo invisível equivalia a mais que o |PnL bruto| da amostra inteira.**

### Por Que Isto Viola Convenção do Projeto

> "Nunca fabricar dado — sempre erro explícito quando não há fonte real."

Um PnL de DEMO sem custo **não é uma simulação conservadora**, é uma **simulação de um mercado que não existe**. O gate cobrava o custo na DECISÃO e não cobrava na EXECUÇÃO — assimetria estrutural.

## Root Cause

**No servidor (`ai-runner/lib/positionManager.ts`):**
```typescript
// Antes (ERRADO):
const pnl = (exitPrice - entryPrice) * (notional / entryPrice);
commission: 0,
net_pnl: pnl
```

**No cliente (`src/app/hooks/useApexLogic.ts`):**
```typescript
// Antes (ERRADO):
const tradePnL = calculatePnLWithLeverage(...); // bruto
persistenceRef.current.onTradeClose(id, price, tradePnL, 0, 'MANUAL');
```

**Ambos os lados gravavam `commission: 0`.**

## Fix Aplicado (2026-08-23)

### 1. Módulo Compartilhado: `src/app/services/risk/ExecutionCost.ts`

Fonte única do cálculo, usada por **cliente e servidor**:

```typescript
export function calculateRoundTripCost(
  symbol: string,
  notionalUsd: number,
  priceLevel: number,
): ExecutionCostBreakdown
```

- **Fonte de custo**: `research/CostModel.ts` (mesma do `COST_GATE`)
- **Classe de custo**: resolvida via `CostAssetClass.ts` (auditada, não por heurística)
- **Fallback seguro**: entrada inválida (preço 0, notional 0, NaN) → custo 0, sem lançar
  - (Crítico: não pode impedir fechamento de posição)

### 2. Servidor: `supabase/functions/ai-runner/lib/positionManager.ts`

```typescript
const grossPnl = (exitPrice - entryPrice) * (notional / entryPrice);
const { costUsd } = calculateRoundTripCost(symbol, notional, entryPrice);
const pnl = grossPnl - costUsd; // LÍQUIDO

await sb.from('ai_trades').update({
  pnl: grossPnl,        // BRUTO (auditoria)
  commission: costUsd,  // O QUE FOI COBRADO
  net_pnl: pnl          // LÍQUIDO (move balance)
});
```

Log atualizado: `GANHO de +$3,96 (bruto +$4,00 − custo $0,04)`

### 3. Cliente: `src/app/hooks/useApexLogic.ts`

Mesma lógica:
```typescript
const grossPnL = calculatePnLWithLeverage(...);
const { costUsd } = calculateRoundTripCost(symbol, amount, price);
const pnlNet = grossPnL - costUsd;

persistenceRef.current.onTradeClose(id, price, grossPnL, costUsd, reason);
```

### 4. Validação: `src/app/services/risk/__validate__execcost__.ts`

15 asserções determinísticas:
- ✅ Custo existe e é > 0
- ✅ Bate com constante calibrada do `CostModel`
- ✅ Linear no notional (2x notional → 2x custo)
- ✅ Entradas inválidas → custo 0 (nunca lança)
- ✅ Classes diferentes → custos diferentes (p. ex.: Brent vs Ouro)
- ✅ Aritmética do fechamento: líquido = bruto − custo

**Status**: Todas 15 asserções passam. Registrado no `npm run validate`.

## Padrão Histórico de Divergência

Este é o **3º bug desta classe** no projeto:

1. **2026-08-05**: tabela de `pointValue` duplicada inline em `useApexLogic` vs centralizada
2. **2026-08-17**: fórmula de PnL divergente entre Dashboard e AI Trader
3. **2026-08-23**: cálculo de custo no fechamento divergente entre servidor e cliente

**Resolução estrutural**: nenhuma fórmula financeira pode viver em dois lugares. Extraída pra módulo puro compartilhado.

## Dados Brutos da Análise

Ver `analise.ts` (script que roda contra o Supabase real):

```
Símbolo   n   Custo RT %   Notional $   Custo $   PnL bruto $   PnL líquido $
XAUUSD    23   0.0075%     66976.48     5.03      14.32         9.28
ETHUSD    33   0.0291%     4830.00      1.40      -3.08         -4.49
UKOUSD    12   0.0366%     10307.68     3.77      -15.07        -18.85
BTCUSD    11   0.0291%     1665.47      0.48      0.23          -0.26
(...)
TOTAL     134               111.177.99  14.83     -14.12        -28.95
```

Comando pra rodar:
```bash
npx esbuild research/experiments/2026-08-23-custo-nao-cobrado-e-poder/analise.ts \
  --bundle --platform=node --format=esm --outfile=/tmp/analise.mjs && node /tmp/analise.mjs
```

## Poder Estatístico da Amostra

A amostra **não tem poder pra detectar a própria média observada**:

- n = 88 (sexta-feira em diante)
- média = +$0.1875/trade
- dp = $2.9899
- t = 0.588 (< 1.96 → indistinguível de zero, p ≈ 0,56)

**Para detectar +$0.1875 com α=5% poder 80%:** precisa ~1.996 trades independentes
- A ~35 trades/dia: 1.9 meses
- Mas a cesta tem N_eff/N ≈ 0,26 (cripto correlacionada)
- Real: ~7-8 meses contínuos

**Conclusão**: o ritmo de 2-6 trades/dia medido no funil não dá amostra significativa em timeframe operacional. Ver seção 14.7 de `AI_BRAIN_SPEC.md`.

## Experimento R:R 1:3 — O Que o Teorema Previu

Payoff realizado 4,53x (vs 3,01x desenhado), **mas**:
- Win rate: 15,6% (IC95%: 9,1%–22,0%)
- Breakeven: 18,1% (cai DENTRO do IC)
- Conclusão: amostra não distingue "funciona" de "empata"

Exatamente a previsão do **Teorema da Parada Opcional** (AI_BRAIN_SPEC §14.2): mexer em stop/alvo troca win rate por payoff, deixa a MÉDIA onde estava — zero bruto, negativa após custo.

## Próximos Passos (Cleber decidir)

1. **Deploy em produção**: migração de `ai-runner` + redeploy (sem reaplicar migration, a tabela já tem `commission` e `net_pnl`)
2. **Monitoramento**: com custo real visível, operador enxerga o impacto de spread na equity em tempo real
3. **Recalibração do motor**: dados de agosto serão corrigidos retrospectivamente? (recomendação: deixar como está, usar só pra auditoria; futuros trades com custo novo a partir do deploy)
4. **Pesquisa de calendário/macro**: agentes bloqueados por limite de sessão, relançados quando limite resetar

## Convenções Mantidas

✅ **Nenhuma fabricação**: custo vem de fonte calibrada (`CostModel.ts`) que o próprio motor usa pra recusar trade  
✅ **Auditoria**: `pnl` gravado é BRUTO, `commission` é transparente, `net_pnl` é o que move balance  
✅ **Sem lançar em entrada inválida**: se preço vir zerado (bug de feed), fechamento segue  
✅ **Fonte única**: `ExecutionCost.ts` → ambos os lados usam  
✅ **Gate de validação**: 15 asserções determinísticas sempre passando  

---

**Documentação completa**: `CLAUDE.md` (seção de pendências e erros registrados)
