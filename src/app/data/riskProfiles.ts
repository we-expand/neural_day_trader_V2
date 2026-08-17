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
 * `expectedTradesPerDay` e `expectedNetPercentPerTrade` são MEDIDOS, não
 * estimativas de marketing — reportados como FAIXA histórica, nunca como
 * promessa. Deliberadamente NÃO expõe valor em dólar: o piso de capital
 * mínimo por trade (`TradeSizing.ts` `minTradeCapital`) pode distorcer o
 * risco efetivo em contas próximas do aporte mínimo de US$50.
 *
 * 2026-08-16 (recálculo, mesmo dia da correção do piso — commit `d0d28406a`
 * + fix do sizing FIXED no motor ao vivo): os ranges abaixo foram
 * RECALCULADOS em `research/experiments/2026-08-16-recalculo-perfis/`, com o
 * MESMO motor/preset/timeframe/cesta da fonte original
 * (`2026-08-05-taxa-base/results/taxa_base.json`), mas com capital real de
 * $50 e o `riskPerTrade%` de cada perfil — a medição de 08-05 usava $10.000
 * e 1% fixo, condição em que o piso de $10 nunca era acionado, então não
 * capturava o efeito real numa conta no aporte mínimo.
 *
 * **Achado do recálculo, não escondido**: com capital real, o piso corrigido
 * (pula em vez de inflar) filtra desproporcionalmente os trades de stop mais
 * largo — e em XAGUSD 1h isso muda o sinal do resultado líquido médio de
 * positivo (medição original) para NEGATIVO (Conservador: -0,03%; Moderado/
 * Agressivo: -0,47%). Ver `results/recalculo_perfis.md` pro detalhe por ativo.
 *
 * **2026-08-16 (auditoria de setup)**: XAGUSD removido de `activeAssets` nos
 * 3 perfis por decisão do Cleber — media negativo em capital real e não deve
 * ficar na cesta padrão só porque era positivo sob condição de teste
 * ($10.000/1% fixo) que não reflete o aporte mínimo real do produto ($50).
 * Os ranges de `expectedNetPercentPerTradeRange` ainda incluem o efeito do
 * XAGUSD nesta revisão (não foram remedidos sem ele) — remedir é trabalho
 * futuro, não incluído nesta mudança.
 *
 * **2026-08-16 (perfil EXPERIMENTAL)**: o Cleber perguntou por que a cesta
 * não inclui mais ativos, já que a tabela original (`taxa_base.md`) testou 9
 * ativos × 5 presets × 3 timeframes — os 3 perfis de produção só usam 2
 * desses presets (Donchian, Volume). Reler a tabela completa achou
 * combinações líquido-positivas nos outros 3 presets pra ativos hoje de
 * fora — ver `activeAssets` do perfil EXPERIMENTAL abaixo. **Ressalva
 * importante, não escondida**: esses números vêm de UM único backtest
 * histórico (`taxa_base.json`, medição de viabilidade operacional, não de
 * edge) — não passaram pela correção estatística (DSR, walk-forward,
 * múltiplos testes) que a busca por edge original (`AI_BRAIN_SPEC.md`
 * §11-14) usou pra REPROVAR os mesmos 5 presets como fonte de alfa
 * comprovado. Nenhuma garantia de que esse resultado se sustenta fora da
 * amostra. Por isso existe como perfil separado, com aviso explícito, e não
 * misturado aos 3 perfis medidos com mais rigor.
 */

export type RiskProfileId = 'CONSERVADOR' | 'MODERADO' | 'AGRESSIVO' | 'EXPERIMENTAL';

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
  /** true = resultado de UM backtest sem correção estatística (DSR/walk-forward) — não é "edge comprovado", é candidato. UI deve avisar. */
  experimental?: boolean;
}

export const RISK_PROFILES: RiskProfileDefinition[] = [
  {
    id: 'CONSERVADOR',
    label: 'Conservador',
    description: 'Menor frequência, maior margem de segurança por trade. Rompimento de Canal (Donchian) em 1h — o preset com melhor resultado líquido medido.',
    activeStrategyId: '1', // Rompimento de Canal (Donchian)
    timeframe: '1H',
    activeAssets: ['XAUUSD', 'NAS100', 'US30'],
    riskPerTrade: 0.5,
    cooldownMinutes: 30,
    maxTradesPerDay: 3,
    expectedTradesPerDayRange: [0.15, 0.35],
    expectedNetPercentPerTradeRange: [-0.03, 0.75],
  },
  {
    id: 'MODERADO',
    label: 'Moderado',
    description: 'Frequência intermediária. Rompimento Confirmado (Volume) em 1h, cesta de metais + índice.',
    activeStrategyId: '4', // Rompimento Confirmado (Volume)
    timeframe: '1H',
    activeAssets: ['XAUUSD', 'US30'],
    riskPerTrade: 1.0,
    cooldownMinutes: 15,
    maxTradesPerDay: 5,
    expectedTradesPerDayRange: [0.4, 0.6],
    expectedNetPercentPerTradeRange: [-0.47, 0.2],
  },
  {
    id: 'AGRESSIVO',
    label: 'Agressivo',
    description: 'Mesma estratégia do perfil Moderado, com risco por trade maior. NÃO é mais frequência com mais edge — é mais risco sobre o mesmo sinal medido. Ver aviso de capital mínimo.',
    activeStrategyId: '4', // Rompimento Confirmado (Volume) — mesmo preset, sem preset mais frequente com resultado líquido positivo medido em 1h
    timeframe: '1H',
    activeAssets: ['XAUUSD', 'US30'],
    riskPerTrade: 1.5,
    cooldownMinutes: 10,
    maxTradesPerDay: 8,
    expectedTradesPerDayRange: [0.4, 0.6],
    expectedNetPercentPerTradeRange: [-0.47, 0.2],
  },
  {
    id: 'EXPERIMENTAL',
    label: 'Experimental',
    description: 'Cruzamento de Médias com Filtro de Regime (EMA+ADX) em 1h — inclui BTCUSD, hoje fora dos outros 3 perfis. Resultado de um único backtest, SEM correção estatística (DSR/walk-forward). Não é edge comprovado, é candidato.',
    activeStrategyId: '2', // Cruzamento de Médias com Filtro de Regime
    timeframe: '1H',
    activeAssets: ['BTCUSD', 'XAUUSD', 'US30', 'NAS100'],
    riskPerTrade: 0.5,
    cooldownMinutes: 30,
    maxTradesPerDay: 3,
    expectedTradesPerDayRange: [0.15, 0.30],
    expectedNetPercentPerTradeRange: [0.11, 0.37],
    experimental: true,
  },
];

export function getRiskProfile(id: RiskProfileId): RiskProfileDefinition {
  const found = RISK_PROFILES.find(p => p.id === id);
  if (!found) throw new Error(`Perfil de risco desconhecido: ${id}`);
  return found;
}
