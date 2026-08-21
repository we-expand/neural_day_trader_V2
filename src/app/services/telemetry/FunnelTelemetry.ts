/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  FUNNEL TELEMETRY — instrumentação do funil de decisão da IA      ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 *
 * Fase 0 do redesenho do cérebro (2026-08-04). Existe pra tornar
 * ESTRUTURALMENTE IMPOSSÍVEL o que aconteceu em 2026-08-04: a sessão
 * 2cff1634 rodou 4h40 em RUNNING e produziu ZERO telemetria — nem uma linha
 * em ai_decisions, nem heartbeat na sessão. Não havia como distinguir
 * "loop parado pelo navegador" de "loop rodando e sendo vetado" de "sem dado
 * de mercado". Qualquer ajuste de calibragem em cima disso seria chute, e
 * chute contraria a convenção do projeto (nunca alegar sem o dado que
 * sustenta — CLAUDE.md).
 *
 * DESENHO — três decisões que valem explicação:
 *
 * 1. CONTAGEM, NÃO EVENTO. A 3 ativos por tick de 5s, uma linha por avaliação
 *    seria ~51 mil linhas/dia por usuário. Aqui o caminho quente só incrementa
 *    inteiros em memória; a rede é tocada uma vez por janela (padrão 60s).
 *
 * 2. O FLUSH É O HEARTBEAT. A mesma escrita que persiste o funil atualiza
 *    `ai_sessions.updated_at`. Um mecanismo resolve os dois buracos, e o
 *    heartbeat não pode "esquecer" de bater sem que o funil também suma —
 *    os dois sinais ou existem juntos ou faltam juntos, o que é bem mais
 *    fácil de diagnosticar do que dois mecanismos independentes.
 *
 * 3. `ticks` É O INSTRUMENTO PRINCIPAL. O loop é um setInterval de 5s no
 *    NAVEGADOR. O Chrome estrangula timer de aba em segundo plano pra 1/min
 *    depois de 5min parada. Numa janela de 60s o esperado são 12 ticks —
 *    se vier 1, a IA estava praticamente desligada e nenhum gate tem culpa.
 *    Essa causa nunca pôde ser confirmada nem descartada até aqui.
 *
 * NUNCA LANÇA. Telemetria que derruba o motor é pior que telemetria nenhuma:
 * todo caminho público é try/catch, e falha de rede no flush descarta a
 * janela e segue (registrado no console), nunca propaga pro loop de trading.
 */

import { supabase } from '@/lib/supabaseClient';

// ============================================================================
// ESTÁGIOS DO FUNIL
// ============================================================================

/**
 * Estágio terminal de uma avaliação. Lista fechada e EXAUSTIVA: toda saída do
 * ciclo de decisão precisa cair em exatamente um destes valores.
 *
 * Invariante de auditoria: soma(stageCounts) === evaluations. `assertClosed()`
 * verifica isso a cada flush e grita no console quando não fecha — é o que
 * impede um caminho de saída novo de voltar a ser silencioso no futuro (foi
 * exatamente assim que 12 dos 27 `return` do ciclo ficaram invisíveis).
 */
export type FunnelStage =
  // ── Saídas do tick, antes de escolher qualquer ativo ──────────────────────
  | 'TICK_MAX_POSITIONS'          // já está no teto de posições abertas
  | 'TICK_COOLDOWN'               // cooldown entre trades ainda correndo
  | 'TICK_NO_ASSETS_CONFIGURED'   // "Universo de Ativos" vazio na config
  | 'TICK_NO_ASSET_IN_CATALOG'    // nenhum ativo configurado existe no assetDatabase

  // ── Saídas por ativo, antes da estratégia ────────────────────────────────
  | 'ASSET_ANTI_REPEAT'           // é o mesmo ativo do último trade
  | 'ASSET_ALREADY_OPEN'          // já existe posição neste ativo (anti-hedging)
  | 'ASSET_MAX_DISTINCT'          // teto de ativos diferentes simultâneos
  // 🆕 2026-08-21: era `TICK_NEWS_BLACKOUT` (blackout cego pro ciclo inteiro,
  // qualquer moeda). Motor agora veta só o candidato cuja moeda bate com a
  // do evento (`getRelevantCurrencies`) — por isso migrou pra saída POR
  // ATIVO, não mais de tick.
  | 'ASSET_NEWS_BLACKOUT'         // evento macro de alto impacto (moeda do ativo) na janela de ±15min
  | 'DATA_NOT_REAL'               // sem preço real da corretora neste ciclo
  | 'NO_ACTIVE_STRATEGY'          // nenhuma estratégia selecionada na config
  | 'CANDLES_FETCH_FAILED'        // falha ao buscar histórico do ativo/timeframe
  | 'CANDLES_INSUFFICIENT'        // menos de 30 candles disponíveis

  // ── Saídas da estratégia ─────────────────────────────────────────────────
  | 'NO_SIGNAL'                   // blocos de entrada não dispararam neste candle
  | 'STRATEGY_CONFIDENCE_LOW'     // confiança da estratégia abaixo do mínimo

  // ── Saídas dos gates (estas TAMBÉM gravam em ai_decisions) ───────────────
  | 'SCORE_OPPOSITE'
  | 'SCORE_LATERAL'
  | 'COMBINED_CONFIDENCE_LOW'
  | 'CONFIG_DIRECTION'
  | 'MARKET_MODE_MISMATCH'
  | 'COST_GATE'
  | 'COST_GATE_NO_DATA'
  | 'CONTEXT_GATE'
  | 'TAIL_RISK'
  | 'KILL_SWITCH'
  | 'RISK_GATE'
  | 'COOLDOWN_GATE'
  | 'REVENGE_PATTERN'
  | 'MAX_TRADES_PER_DAY'
  | 'CORRELATION_GUARD'
  | 'MIN_TRADE_SIZE'              // nocional calculado abaixo do mínimo executável

  // ── Terminais finais ─────────────────────────────────────────────────────
  | 'ENTRY_EXECUTED'              // o único estágio que representa sucesso
  | 'ANALYSIS_ERROR';             // exceção inesperada na análise

/** Rótulos em PT-BR pra leitura direta do funil sem consultar este arquivo. */
export const FUNNEL_STAGE_LABELS: Record<FunnelStage, string> = {
  TICK_MAX_POSITIONS: 'Teto de posições abertas atingido',
  TICK_COOLDOWN: 'Cooldown entre trades ativo',
  TICK_NO_ASSETS_CONFIGURED: 'Nenhum ativo no Universo de Ativos',
  TICK_NO_ASSET_IN_CATALOG: 'Ativos configurados não existem no catálogo',
  ASSET_ANTI_REPEAT: 'Mesmo ativo do último trade (anti-repetição)',
  ASSET_ALREADY_OPEN: 'Já existe posição neste ativo (anti-hedging)',
  ASSET_MAX_DISTINCT: 'Teto de ativos diferentes simultâneos',
  ASSET_NEWS_BLACKOUT: 'Notícia macro de alto impacto na moeda do ativo',
  DATA_NOT_REAL: 'Sem preço real da corretora neste ciclo',
  NO_ACTIVE_STRATEGY: 'Nenhuma estratégia ativa selecionada',
  CANDLES_FETCH_FAILED: 'Falha ao buscar candles do ativo',
  CANDLES_INSUFFICIENT: 'Histórico de candles insuficiente',
  NO_SIGNAL: 'Estratégia sem sinal neste candle',
  STRATEGY_CONFIDENCE_LOW: 'Confiança da estratégia abaixo do mínimo',
  SCORE_OPPOSITE: 'Market Score aponta direção contrária',
  SCORE_LATERAL: 'Market Score LATERAL e confiança insuficiente',
  COMBINED_CONFIDENCE_LOW: 'Confiança combinada (estratégia+Score) baixa',
  CONFIG_DIRECTION: 'Direção travada pelo usuário',
  MARKET_MODE_MISMATCH: 'Regime não bate com o modo de mercado escolhido',
  COST_GATE: 'Custo devora o movimento típico do ativo',
  COST_GATE_NO_DATA: 'ATR indisponível para avaliar custo',
  CONTEXT_GATE: 'Context Gate (regime/estrutura) recusou',
  TAIL_RISK: 'Proteção de cauda bloqueou novas entradas',
  KILL_SWITCH: 'Kill switch acionado',
  RISK_GATE: 'Gate de risco recusou',
  COOLDOWN_GATE: 'Cooldown pós-perdas ativo',
  REVENGE_PATTERN: 'Padrão de revenge trading detectado',
  MAX_TRADES_PER_DAY: 'Limite diário de trades atingido',
  CORRELATION_GUARD: 'Guard de correlação recusou',
  MIN_TRADE_SIZE: 'Nocional abaixo do mínimo executável',
  ENTRY_EXECUTED: 'ENTRADA EXECUTADA',
  ANALYSIS_ERROR: 'Erro inesperado na análise',
};

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

/** Janela de agregação. 60s dá 12 ticks esperados por janela a 5s de loop. */
const WINDOW_MS = 60_000;
/** Máximo de amostras textuais guardadas por estágio (ilustração, não contagem). */
const MAX_SAMPLES_PER_STAGE = 2;
/** Período nominal do loop de trading, usado só pra calcular ticks esperados. */
const EXPECTED_TICK_INTERVAL_MS = 5_000;

interface FunnelWindow {
  windowStart: number;
  ticks: number;
  evaluations: number;
  stageCounts: Partial<Record<FunnelStage, number>>;
  symbolStageCounts: Record<string, Partial<Record<FunnelStage, number>>>;
  samples: Partial<Record<FunnelStage, string[]>>;
}

function emptyWindow(): FunnelWindow {
  return {
    windowStart: Date.now(),
    ticks: 0,
    evaluations: 0,
    stageCounts: {},
    symbolStageCounts: {},
    samples: {},
  };
}

// ============================================================================
// SERVIÇO
// ============================================================================

class FunnelTelemetryService {
  private readonly LOG_PREFIX = '[Funil]';

  private window: FunnelWindow = emptyWindow();
  private sessionId: string | null = null;
  private userId: string | null = null;
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Liga a telemetria pra uma sessão. Idempotente: chamar de novo com a mesma
   * sessão não duplica o timer (o loop de trading remonta em toda mudança de
   * dependência do useEffect, então isso acontece de verdade).
   */
  start(sessionId: string, userId: string): void {
    try {
      if (this.sessionId === sessionId && this.flushTimer !== null) return;

      // Sessão diferente: descarrega o que sobrou da anterior antes de trocar.
      if (this.sessionId && this.sessionId !== sessionId) {
        void this.flush();
      }

      this.sessionId = sessionId;
      this.userId = userId;
      this.window = emptyWindow();

      if (this.flushTimer !== null) clearInterval(this.flushTimer);
      this.flushTimer = setInterval(() => { void this.flush(); }, WINDOW_MS);

      console.log(`${this.LOG_PREFIX} 📊 Telemetria de funil ligada (janela ${WINDOW_MS / 1000}s, sessão ${sessionId})`);
    } catch (error) {
      console.warn(`${this.LOG_PREFIX} ⚠️ Falha ao ligar telemetria (motor segue normal):`, error);
    }
  }

  /** Desliga e descarrega a janela pendente. Seguro chamar sem start(). */
  stop(): void {
    try {
      if (this.flushTimer !== null) {
        clearInterval(this.flushTimer);
        this.flushTimer = null;
      }
      void this.flush();
      this.sessionId = null;
      this.userId = null;
    } catch (error) {
      console.warn(`${this.LOG_PREFIX} ⚠️ Falha ao desligar telemetria:`, error);
    }
  }

  /** Um tick do loop de trading disparou. Chamar UMA vez por tick, no topo. */
  recordTick(): void {
    try { this.window.ticks++; } catch { /* telemetria nunca derruba o motor */ }
  }

  /** Uma análise de ativo foi iniciada. Denominador do funil. */
  recordEvaluation(): void {
    try { this.window.evaluations++; } catch { /* idem */ }
  }

  /**
   * Uma avaliação terminou no estágio `stage`. Chamar em TODO ponto de saída,
   * inclusive nos que já gravam em ai_decisions — o funil só fecha se todos os
   * terminais forem contados.
   *
   * `symbol` é opcional porque as saídas de tick (TICK_*) acontecem antes de
   * qualquer ativo ser sorteado.
   */
  recordStage(stage: FunnelStage, symbol?: string, sample?: string): void {
    try {
      this.window.stageCounts[stage] = (this.window.stageCounts[stage] ?? 0) + 1;

      if (symbol) {
        const bySymbol = this.window.symbolStageCounts[symbol] ?? {};
        bySymbol[stage] = (bySymbol[stage] ?? 0) + 1;
        this.window.symbolStageCounts[symbol] = bySymbol;
      }

      if (sample) {
        const list = this.window.samples[stage] ?? [];
        if (list.length < MAX_SAMPLES_PER_STAGE) {
          list.push(sample);
          this.window.samples[stage] = list;
        }
      }
    } catch { /* telemetria nunca derruba o motor */ }
  }

  /**
   * Verifica a invariante soma(stageCounts) === evaluations.
   *
   * Divergência significa caminho de saída não instrumentado — o bug exato que
   * este módulo existe pra impedir. Só avisa (nunca lança): a integridade da
   * contagem não vale interromper o trading, mas precisa ser barulhenta no
   * console pra ser notada em desenvolvimento.
   *
   * As saídas TICK_* são excluídas da soma porque acontecem antes de qualquer
   * avaliação de ativo existir — elas não têm denominador em `evaluations`.
   */
  private assertClosed(w: FunnelWindow): void {
    const perAssetTotal = (Object.entries(w.stageCounts) as [FunnelStage, number][])
      .filter(([stage]) => !stage.startsWith('TICK_'))
      .reduce((sum, [, count]) => sum + count, 0);

    if (perAssetTotal !== w.evaluations) {
      console.warn(
        `${this.LOG_PREFIX} ⚠️ FUNIL NÃO FECHA: ${w.evaluations} avaliações iniciadas mas ` +
        `${perAssetTotal} terminais contados (diferença ${w.evaluations - perAssetTotal}). ` +
        `Existe caminho de saída sem recordStage() — instrumente-o.`
      );
    }
  }

  /**
   * Persiste a janela e reinicia os contadores. O mesmo INSERT serve de
   * heartbeat da sessão (ver cabeçalho). Fire-and-forget do ponto de vista do
   * motor: nunca é aguardado pelo loop de trading.
   */
  async flush(): Promise<void> {
    const w = this.window;
    const sessionId = this.sessionId;
    const userId = this.userId;

    // Janela vazia (IA ligada mas loop nunca disparou) ainda é informação —
    // mas sem sessão não há onde gravar.
    if (!sessionId || !userId) return;
    if (w.ticks === 0 && w.evaluations === 0) return;

    // Troca a janela ANTES do await: qualquer incremento que chegue durante a
    // rede entra na janela nova, não é perdido nem contado duas vezes.
    this.window = emptyWindow();

    const windowEnd = Date.now();
    this.assertClosed(w);

    const expectedTicks = Math.max(1, Math.round((windowEnd - w.windowStart) / EXPECTED_TICK_INTERVAL_MS));
    if (w.ticks < expectedTicks * 0.5) {
      console.warn(
        `${this.LOG_PREFIX} 🐌 Só ${w.ticks} ticks numa janela que esperava ~${expectedTicks}. ` +
        `Aba provavelmente em segundo plano (Chrome estrangula timer pra 1/min) — ` +
        `a IA ficou praticamente parada, e isso NÃO é veto de gate.`
      );
    }

    try {
      const { error } = await supabase.from('ai_funnel_snapshots').insert({
        session_id: sessionId,
        user_id: userId,
        window_start: new Date(w.windowStart).toISOString(),
        window_end: new Date(windowEnd).toISOString(),
        ticks: w.ticks,
        evaluations: w.evaluations,
        stage_counts: w.stageCounts,
        symbol_stage_counts: w.symbolStageCounts,
        samples: w.samples,
      });
      if (error) throw error;

      // Heartbeat: prova que o loop estava vivo nesta janela. Sem isto,
      // ai_sessions.updated_at fica congelado no started_at e uma sessão morta
      // é indistinguível de uma sessão rodando (aconteceu em 2026-08-04).
      const { error: hbError } = await supabase
        .from('ai_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId);
      if (hbError) throw hbError;
    } catch (error) {
      // Janela perdida é aceitável; interromper o motor por telemetria não é.
      console.warn(`${this.LOG_PREFIX} ⚠️ Falha ao gravar janela de funil (descartada):`, error);
    }
  }

  /**
   * Leitura do funil da janela corrente, sem tocar a rede. Usada pela UI/console
   * pra inspecionar o estado ao vivo sem esperar o flush.
   */
  snapshot(): { ticks: number; evaluations: number; stages: Array<{ stage: FunnelStage; label: string; count: number }> } {
    const stages = (Object.entries(this.window.stageCounts) as [FunnelStage, number][])
      .map(([stage, count]) => ({ stage, label: FUNNEL_STAGE_LABELS[stage] ?? stage, count }))
      .sort((a, b) => b.count - a.count);
    return { ticks: this.window.ticks, evaluations: this.window.evaluations, stages };
  }
}

export const funnelTelemetry = new FunnelTelemetryService();
