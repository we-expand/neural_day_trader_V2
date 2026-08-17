/**
 * Perfis de risco — item 5 do redesenho do cérebro (2026-08-16). Substitui
 * "escolher 1 preset + timeframe manualmente" como caminho PADRÃO do painel
 * (`AITrader.tsx`, modo Simples). Modo Avançado (seleção manual de preset e
 * timeframe) continua existindo pra quem quiser.
 *
 * Cada perfil mapeia pra: 1 preset de produção (`PRESET_STRATEGIES`), 1
 * timeframe, e a cesta de ativos ONDE ESSE PRESET NESSE TIMEFRAME teve
 * resultado líquido de custo POSITIVO na medição real mais recente
 * (`research/experiments/2026-08-05-taxa-base/results/taxa_base.json`,
 * 2026-08-05, mesmo motor de produção `runBacktest`, custo real).
 *
 * POR QUE SÓ 1H: é o único timeframe onde presets de produção têm resultado
 * líquido positivo de forma consistente — 5m e 15m têm frequência mais alta
 * mas resultado líquido fortemente negativo (custo consome o volume mais
 * rápido do que ele gera resultado). Ver
 * `research/experiments/2026-08-16-portfolio-amplitude/results/README.md`.
 *
 * POR QUE SÓ 1 PRESET POR PERFIL: o motor hoje só roda 1 estratégia por vez
 * (`activeStrategyId` é singular em `AIConfig`) — "multi-setup simultâneo"
 * é uma frente do redesenho ainda não implementada. Perfis diferentes usam
 * o mesmo mecanismo, variando preset/cesta/risco por trade, não "mais
 * estratégias ao mesmo tempo".
 *
 * `expectedTradesPerDay` e `expectedNetPercentPerTrade` são MEDIDOS (mesma
 * fonte acima), não estimativas de marketing — e são reportados como FAIXA
 * histórica, nunca como promessa. Deliberadamente NÃO expõe valor em dólar:
 * o piso de capital mínimo por trade (`TradeSizing.ts` `minTradeCapital`)
 * pode distorcer o risco efetivo em contas próximas do aporte mínimo de
 * US$50 — reportar $ aqui seria precisão falsa até essa questão ser resolvida
 * (ver task espelhada em 2026-08-16, "Investigar piso de US$10/trade").
 */

export type RiskProfileId = 'CONSERVADOR' | 'MODERADO' | 'AGRESSIVO';

export interface RiskProfileDefinition {
  id: RiskProfileId;
  label: string;
  description: string;
  activeStrategyId: string; // id de PRESET_STRATEGIES
  timeframe: string;
  activeAssets: string[];
  riskPerTrade: number; // % do capital por trade
  cooldownMinutes: number;
  maxTradesPerDay: number;
  /** Faixa medida (não promessa) — soma de trades/dia dos ativos da cesta, dado real 2026-08-05. */
  expectedTradesPerDayRange: [number, number];
  /** Faixa medida de retorno líquido por trade, % do capital alocado nesse trade — não % da conta inteira. */
  expectedNetPercentPerTradeRange: [number, number];
}

export const RISK_PROFILES: RiskProfileDefinition[] = [
  {
    id: 'CONSERVADOR',
    label: 'Conservador',
    description: 'Menor frequência, maior margem de segurança por trade. Rompimento de Canal (Donchian) em 1h — o preset com melhor resultado líquido medido.',
    activeStrategyId: '1', // Rompimento de Canal (Donchian)
    timeframe: '1H',
    activeAssets: ['XAUUSD', 'XAGUSD', 'NAS100', 'US30'],
    riskPerTrade: 0.5,
    cooldownMinutes: 30,
    maxTradesPerDay: 3,
    expectedTradesPerDayRange: [0.2, 0.4],
    expectedNetPercentPerTradeRange: [0.3, 1.0],
  },
  {
    id: 'MODERADO',
    label: 'Moderado',
    description: 'Frequência intermediária. Rompimento Confirmado (Volume) em 1h, cesta de metais + índice com resultado líquido positivo medido.',
    activeStrategyId: '4', // Rompimento Confirmado (Volume)
    timeframe: '1H',
    activeAssets: ['XAUUSD', 'XAGUSD', 'US30'],
    riskPerTrade: 1.0,
    cooldownMinutes: 15,
    maxTradesPerDay: 5,
    expectedTradesPerDayRange: [0.4, 0.7],
    expectedNetPercentPerTradeRange: [0.05, 0.3],
  },
  {
    id: 'AGRESSIVO',
    label: 'Agressivo',
    description: 'Mesma estratégia do perfil Moderado, com risco por trade maior. NÃO é mais frequência com mais edge — é mais risco sobre o mesmo sinal medido. Ver aviso de capital mínimo.',
    activeStrategyId: '4', // Rompimento Confirmado (Volume) — mesmo preset, sem preset mais frequente com resultado líquido positivo medido em 1h
    timeframe: '1H',
    activeAssets: ['XAUUSD', 'XAGUSD', 'US30'],
    riskPerTrade: 1.5,
    cooldownMinutes: 10,
    maxTradesPerDay: 8,
    expectedTradesPerDayRange: [0.4, 0.7],
    expectedNetPercentPerTradeRange: [0.05, 0.3],
  },
];

export function getRiskProfile(id: RiskProfileId): RiskProfileDefinition {
  const found = RISK_PROFILES.find(p => p.id === id);
  if (!found) throw new Error(`Perfil de risco desconhecido: ${id}`);
  return found;
}
