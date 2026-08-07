/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  TESTE DE FUMAÇA DA COSTURA (Fase 0 — runner no servidor)         ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 *
 * Prova, sob Deno, que o motor de decisão do browser é importável e executável
 * no servidor SEM cópia da lógica. É o critério de aceite da "fatia 1": se este
 * arquivo roda verde, a costura existe; se não roda, ela não existe — e nenhuma
 * linha do runner de verdade deve ser escrita antes disso.
 *
 * O que ele NÃO faz de propósito: nada de rede, nada de banco, nada de ordem.
 * Candles são sintéticos e determinísticos, gerados aqui mesmo. O objetivo é
 * exercitar RESOLUÇÃO DE MÓDULO e EXECUÇÃO DE CÓDIGO PURO, não medir mercado —
 * candle sintético jamais entra em decisão real (convenção nº1 do projeto).
 *
 * A estratégia abaixo é tipada de verdade (sem `as any`/`as unknown as`), então
 * o teste também é uma checagem de compilação: se o contrato de Strategy ou de
 * StrategyBlock mudar, isto quebra no type-check do Deno antes de rodar.
 *
 * Como rodar (da pasta supabase/functions/ai-runner):
 *
 *     deno test --allow-env seam_smoke_test.ts
 *
 * `--allow-env` é exigido pelo shim (lê SUPABASE_SERVICE_ROLE_KEY). Nenhuma
 * permissão de REDE é concedida de propósito — se algum módulo do fecho tentar
 * I/O no momento da importação, o teste falha, que é exatamente o que se quer
 * descobrir antes de agendar isso pra rodar sozinho.
 */

import { assert, assertEquals } from 'jsr:@std/assert@1';

import {
  evaluateStrategyAt,
  evaluateStrategySeries,
  IndicatorCache,
} from '@/app/services/strategy/StrategyEvaluator.ts';
import {
  calculateATR,
  calculateRSI,
  type Candle,
} from '@/app/services/indicators/TechnicalIndicators.ts';
import type { Strategy } from '@/app/types/strategy.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Candles sintéticos determinísticos. Sem Math.random de propósito: um teste de
// costura que falha de forma intermitente não serve como gate.
// ─────────────────────────────────────────────────────────────────────────────
function syntheticCandles(n: number): Candle[] {
  const out: Candle[] = [];
  let price = 100;
  for (let i = 0; i < n; i++) {
    // Onda suave + deriva: gera variação suficiente pros indicadores saírem do
    // período de aquecimento, sem ser ruído puro.
    price += Math.sin(i / 7) * 0.8 + 0.05;
    const open = price;
    const close = price + Math.cos(i / 5) * 0.4;
    out.push({
      time: Date.UTC(2026, 0, 1) + i * 60_000,
      open,
      high: Math.max(open, close) + 0.3,
      low: Math.min(open, close) - 0.3,
      close,
      volume: 1000 + (i % 50) * 10,
    });
  }
  return out;
}

/** Último valor não-nulo de uma série de indicador (que é `(number | null)[]`). */
function lastDefined(series: (number | null)[]): number | null {
  for (let i = series.length - 1; i >= 0; i--) {
    const v = series[i];
    if (v !== null && Number.isFinite(v)) return v;
  }
  return null;
}

/** Estratégia mínima porém VÁLIDA segundo o contrato real de `Strategy`. */
function smokeStrategy(): Strategy {
  return {
    id: 'seam-smoke',
    name: 'Costura (fumaça)',
    description: 'Estratégia sintética usada só pelo teste de costura do runner.',
    isPreset: false,
    entryBlocks: [
      {
        id: 'entry-rsi',
        type: 'ENTRY',
        category: 'momentum',
        indicator: 'RSI',
        period: 14,
        operator: 'BELOW',
        value: 70,
        label: 'RSI abaixo de 70',
        enabled: true,
      },
    ],
    exitBlocks: [],
    filterBlocks: [],
    entrySignal: 'BUY',
    direction: 'AUTO',
    stopLoss: 50,
    takeProfit: 100,
    trailingStop: false,
    riskProfile: 'MODERATE',
    positionSizePercent: 1,
    timeframe: '5m',
    maxConcurrentTrades: 1,
  };
}

Deno.test('costura: indicadores técnicos executam sob Deno', () => {
  const candles = syntheticCandles(120);

  const rsi = calculateRSI(candles, 14);
  assertEquals(rsi.length, candles.length, 'RSI deve acompanhar o comprimento da série');
  const lastRsi = lastDefined(rsi);
  assert(lastRsi !== null, 'RSI deveria ter ao menos um valor após o aquecimento');
  assert(lastRsi >= 0 && lastRsi <= 100, `RSI fora de [0,100]: ${lastRsi}`);

  const atr = calculateATR(candles, 14);
  const lastAtr = lastDefined(atr);
  assert(lastAtr !== null && lastAtr > 0, `ATR final inválido: ${lastAtr}`);
});

Deno.test('costura: StrategyEvaluator avalia uma estratégia sob Deno', () => {
  const candles = syntheticCandles(120);
  const strategy = smokeStrategy();

  const cache = new IndicatorCache(candles);
  const signal = evaluateStrategyAt(strategy, candles, candles.length - 1, cache);

  // Não importa se dispara BUY ou null — importa que execute e honre o contrato.
  assert(signal !== null && typeof signal === 'object', 'avaliador deve devolver um objeto');
  assert(Number.isFinite(signal.confidence), `confiança não numérica: ${signal.confidence}`);
  assert(Array.isArray(signal.reasons), 'reasons deve ser array');
  assert(
    signal.signal === 'BUY' || signal.signal === 'SELL' || signal.signal === null,
    `sinal fora do contrato: ${String(signal.signal)}`,
  );

  const series = evaluateStrategySeries(strategy, candles);
  assertEquals(series.length, candles.length, 'série de sinais deve acompanhar a de candles');
});

Deno.test('costura: shim do supabaseClient responde no lugar do client de browser', async () => {
  const { supabase } = await import('./shims/supabaseClient.ts');

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? null;
  if (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
    assertEquals(typeof token, 'string', 'com service-role no ambiente, deve devolver token');
  } else {
    assertEquals(token, null, 'sem service-role, o shim NÃO pode inventar token');
  }

  // Atualizado no passo 3 (2026-08-07): `.from(...)` agora é legítimo pras
  // duas tabelas que FunnelTelemetry.ts usa de verdade — não pode mais
  // estourar só por ser acessado. O que continua tendo que estourar é
  // QUALQUER OUTRO uso: tabela fora da lista, ou método fora de auth/from.
  assert(typeof supabase.from === 'function', 'from(...) deveria estar implementado (FunnelTelemetry.ts usa)');

  let threwOnUnknownTable = false;
  try {
    supabase.from('some_other_table' as never);
  } catch {
    threwOnUnknownTable = true;
  }
  assert(threwOnUnknownTable, 'shim deveria recusar tabela fora de ai_funnel_snapshots/ai_sessions');

  let threwOnUnknownMethod = false;
  try {
    (supabase as unknown as { channel: unknown }).channel;
  } catch {
    threwOnUnknownMethod = true;
  }
  assert(threwOnUnknownMethod, 'shim deveria recusar acesso não implementado (ex: .channel) em vez de devolver undefined');
});

Deno.test('costura: MarketScoreEngine importa sem executar I/O na carga', async () => {
  // Este é o módulo que puxa BacktestDataService (que faz HTTP) e o alias
  // @/lib/supabaseClient. O teste roda SEM --allow-net: se algo tentasse rede no
  // topo do módulo, a importação falharia aqui em vez de em produção.
  const mod = await import('@/app/services/MarketScoreEngine.ts');
  assert('MarketScoreEngine' in mod, 'MarketScoreEngine deveria ser exportado');
});
