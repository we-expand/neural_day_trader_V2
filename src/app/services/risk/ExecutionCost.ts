/**
 * ExecutionCost — custo de execução REALIZADO, em dólares, de uma posição.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE ESTE MÓDULO EXISTE (achado de 2026-08-23, medido em produção)
 * ─────────────────────────────────────────────────────────────────────────────
 * O motor já sabia o custo o suficiente pra RECUSAR trade por causa dele: o
 * COST_GATE (`runTradingCycle.ts`, via `CostViabilityGate.ts`) rejeitou 7.618
 * candidatos entre 21 e 23/08/2026 — o segundo maior motivo de rejeição do
 * funil inteiro. Mas os 87 trades que passaram pelo gate e foram executados
 * fecharam com `commission: 0` gravado no banco e PnL calculado como
 *
 *     pnl = (precoSaida − precoEntrada) × (notional / precoEntrada)
 *
 * ou seja: preço médio na entrada E na saída, sem spread, sem slippage, sem
 * comissão. Os 135 trades de 17→23/08 têm `commission = 0` em 135 de 135.
 *
 * Consequência medida na amostra real (`research/experiments/
 * 2026-08-23-custo-nao-cobrado-e-poder/`): PnL bruto reportado −US$14,12,
 * custo de execução não cobrado US$14,83, resultado real ≈ −US$28,95. **O
 * custo não cobrado equivale a 105% do |PnL bruto| da amostra.** Qualquer
 * conclusão sobre "a IA está evoluindo" tirada do número exibido estava sendo
 * tirada de um número otimista por construção — e a diferença não é de segunda
 * ordem, é maior que o próprio resultado.
 *
 * Isso viola a convenção nº 1 do projeto ("nunca fabricar dado — sempre erro
 * explícito quando não há fonte real"): um PnL de DEMO sem custo não é uma
 * simulação conservadora do real, é uma simulação de um mercado que não existe.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE É UM MÓDULO COMPARTILHADO E NÃO CÓDIGO INLINE
 * ─────────────────────────────────────────────────────────────────────────────
 * Este projeto já foi mordido DUAS vezes pela mesma classe de bug — a mesma
 * fórmula financeira existindo em duas cópias que divergiram: a tabela de
 * `pointValue` duplicada inline em `useApexLogic` (2026-08-05) e a fórmula de
 * PnL divergente entre Dashboard e AI Trader (2026-08-17). O fechamento de
 * posição HOJE é código duplicado de propósito entre o browser
 * (`useApexLogic.ts`) e o servidor (`ai-runner/lib/positionManager.ts`), com
 * ressalva explícita no cabeçalho de lá. Custo é exatamente o tipo de coisa que
 * NÃO pode divergir entre os dois: ambos devem chamar esta função.
 *
 * Fonte única do percentual: `research/CostModel.ts` — o mesmo módulo calibrado
 * que o COST_GATE já usa pra recusar trades. Não há número novo aqui; este
 * módulo só converte "percentual do notional" em "dólares desta posição".
 */
import { estimateCostPercent } from '../../../../research/CostModel.ts';
import { resolveCostAssetClass } from './CostAssetClass.ts';
import { getPointValue } from '../strategy/TradeSizing.ts';

export interface ExecutionCostBreakdown {
  /** Custo round-trip (ida + volta) em % do notional, ex.: 0.000291 = 0,0291%. */
  roundTripPercent: number;
  /** Custo round-trip em dólares para o notional informado. */
  costUsd: number;
  /** Classe de custo resolvida pelo catálogo (auditoria — não adivinhada por substring). */
  assetClass: string;
}

/**
 * Custo round-trip de execução de uma posição, em dólares.
 *
 * @param symbol      Símbolo unificado (ex.: 'XAUUSD'). A classe de custo vem do
 *                    catálogo via `resolveCostAssetClass`, nunca de heurística
 *                    de substring (bug histórico: 'XPTUSD' virava cripto por
 *                    conter 'TUSD').
 * @param notionalUsd Notional da posição em dólares — é o que `ai_trades.quantity`
 *                    guarda de fato (o rótulo "quantity" é enganoso; ver
 *                    CLAUDE.md, achado incidental de 2026-08-21).
 * @param priceLevel  Preço de entrada. Necessário porque em classes cotadas em
 *                    pontos (forex/índice/commodity) o custo é
 *                    `pontos × pointValue ÷ preço`; em cripto CFD é percentual
 *                    direto do notional.
 *
 * Retorna custo 0 (sem lançar) quando as entradas não são finitas ou positivas —
 * cobrar custo nunca pode ser o motivo de uma posição não fechar. A ausência de
 * custo fica visível no `commission` gravado, que é auditável.
 */
export function calculateRoundTripCost(
  symbol: string,
  notionalUsd: number,
  priceLevel: number,
): ExecutionCostBreakdown {
  const resolution = resolveCostAssetClass(symbol);
  const assetClass = resolution.assetClass;

  if (!Number.isFinite(notionalUsd) || notionalUsd <= 0 || !Number.isFinite(priceLevel) || priceLevel <= 0) {
    return { roundTripPercent: 0, costUsd: 0, assetClass };
  }

  const pointValue = getPointValue(symbol);
  // `* 2` = ida e volta. Mesma convenção de BacktestEngine.ts e do COST_GATE
  // em runTradingCycle.ts — `estimateCostPercent` devolve custo POR PERNA.
  const roundTripPercent = estimateCostPercent(assetClass, priceLevel, pointValue) * 2;

  if (!Number.isFinite(roundTripPercent) || roundTripPercent < 0) {
    return { roundTripPercent: 0, costUsd: 0, assetClass };
  }

  return {
    roundTripPercent,
    costUsd: notionalUsd * roundTripPercent,
    assetClass,
  };
}
