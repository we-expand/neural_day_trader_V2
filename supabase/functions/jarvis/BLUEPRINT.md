# JARVIS — Blueprint de Implementação

## O Que É

Um **segundo cérebro** que roda a cada 6h no servidor, analisa dados reais de produção, toma decisões estruturadas sobre a evolução do motor e registra tudo em auditoria.

Não é um agente descartável. É **persistência** — conhecimento acumulado sobre o que funciona e o que não, calibrado contra o dado real do seu portfolio.

## Peças Principais (4 arquivos + 1 cron)

### 1. Schema (migration SQL) ✅ 
**Arquivo**: `research/jarvis-schema.sql` (já criado acima — 208 linhas)

Tabelas:
- `jarvis_decisions` — cada decisão tomada + evidência + resultado
- `jarvis_experiments` — testes A/B estruturados (hipótese, n mínima, p-value, vencedor)
- `jarvis_knowledge` — padrões confirmados em produção (quais gates usar, quando ligar/desligar)
- `jarvis_alerts` — anomalias em tempo real (confidence caiu, price guard breach, etc)
- `jarvis_health_snapshots` — snapshots 6h (WR, PnL, saúde geral, recomendação)

**Aplicar com**:
```bash
# Copiar conteúdo de research/jarvis-schema.sql e rodar no SQL Editor do Supabase
```

### 2. Motor de Análise (Edge Function Deno)
**Arquivo**: `supabase/functions/jarvis/index.ts`

Roda a cada 6h via `pg_cron`. Faz:
- Calcula win rate + IC (intervalo de confiança) dos últimos 6h/24h/7d
- Detecta padrões de calendário (hora do dia, dia da semana) via SQL group-by
- Avalia contre 4 regras de decisão (exemplo: WR < 90% de breakeven → alerta)
- Registra cada decisão em `jarvis_decisions` com evidência + confiança

**Status**: Skeleton pronto (195 linhas acima). Falta:
- Integração com `jarvis_knowledge` (lookup: "se padrão X detectado, aplicar regra Y")
- MCP Server (se quiser Claude chamar Jarvis diretamente)

### 3. Dashboard (opcional, mas útil)
**Arquivo**: `src/app/components/jarvis/JarvisStatus.tsx`

Exibe:
- Gráfico de WR + IC (últimos 30 dias)
- Padrões detectados agora (hora do dia, calendário)
- Alertas abertos
- Recomendações do Jarvis
- Histórico de decisões (audit trail)

Comanda o motor manualmente se Cleber quiser testar fora do cron.

### 4. Cron Job (Scheduler)
**SQL** (rodar no SQL Editor do Supabase):
```sql
select cron.schedule(
  'jarvis-analysis-6h',
  '0 */6 * * *',
  'select net.http_post(''https://seu-project.supabase.co/functions/v1/jarvis''::text, null, null, jsonb_build_object(''key'', ''x-api-key: ' || current_setting('app.settings.supabase_service_key') || ''')) as http_post'
);
```

Ou via Edge Functions trigger (`supabase functions deploy jarvis --cron "0 */6 * * *"`).

---

## Fluxo Típico (Como Funciona)

**Decidido 2026-08-23: Jarvis autoaplica.** Diferente da regra de "nunca
commit/push sozinho" (que continua valendo pra código-fonte), aqui o motor
readapta parâmetro operacional sozinho — mas só dentro de guardrails
carregados de `jarvis_guardrails` (dado, não código — trocar um teto é um
UPDATE auditável, não um deploy).

```
[Cada 6h]
   ↓
[Edge Function: jarvis/index.ts]
   ├─ SELECT * FROM ai_trades (últimas 6h, status=CLOSED)
   ├─ Calcula: n, wins, win_rate, SE, avg_pnl, confidence_auc
   ├─ Detecta: padrões de hora/dia/calendário
   ├─ Avalia contra regras (ver "Regras de Decisão" abaixo)
   ├─ Para cada decisão candidata, roda evaluateGuardrails(target):
   │  ├─ SELECT * FROM jarvis_guardrails WHERE target = ?
   │  ├─ requires_approval = true?
   │  │    → sempre nasce status='PENDING' (Cleber aprova manualmente)
   │  ├─ requires_approval = false E dentro de magnitude_cap_pct E
   │  │  fora do cooldown (agora > cooldown_until do último ajuste)?
   │  │    → nasce status='ACTIVE', approved_by='system_auto',
   │  │      efetivamente aplicada NESTE ciclo
   │  └─ fora da magnitude ou dentro do cooldown?
   │       → clampa pro teto permitido, OU pula este ciclo (log motivo)
   ├─ Registra em jarvis_decisions (evidência sempre completa, aprovada ou não)
   └─ Publica snapshot em jarvis_health_snapshots
        ↓
[Ciclo SEGUINTE, 6h depois — reavaliação de toda decisão ACTIVE]
   ├─ Mede effect_on_pnl (PnL do período com a decisão ativa vs. baseline
   │  histórico de baseline_pnl_stddev)
   ├─ Se effect_on_pnl < -(rollback_stddev_threshold × baseline_pnl_stddev):
   │    → reverte sozinho: status='ROLLED_BACK',
   │      revert_reason='auto_rollback_pnl_degradation'
   │    → registra em jarvis_alerts (severity='WARNING') pro Cleber ver
   └─ Senão: status='COMPLETED', decisão mantida
        ↓
[Cleber vê no Dashboard, a qualquer momento]
   ├─ "Autoaplicado agora: -15% no tamanho em SOLUSD (WR 6h caiu p/ 22%)"
   ├─ "Revertido automaticamente ontem: +20% signalScoreFloor (PnL piorou 1.3σ)"
   ├─ "Pendente de aprovação: desligar CONFIDENCE_GATE (fora da lista de auto)"
   └─ Pode reverter manualmente QUALQUER decisão ACTIVE a qualquer momento,
      mesmo sem esperar o rollback automático — autoaplicar não remove o
      controle humano, só remove a espera pela aprovação inicial.
```

### Lista de exclusão (sempre `requires_approval=true`, nunca autoaplica)

Seed inicial em `jarvis_guardrails` (seção 6 do schema): `CONFIDENCE_GATE`,
`RISK_GATE`, `TAIL_RISK_GUARD`, `KILL_SWITCH`, `NEWS_GATE` (o gate inteiro
— uma janela de horário *dentro* dele pode ser AUTO), `capital_minimo`,
`leverage`, e qualquer recalibração direta do `confidence_score` (essa
passa por `jarvis_experiments`, nunca aplica direto). Motivo: são
mudanças que desligam proteção inteira ou mexem em parâmetro
regulatório/de capital — o custo de um falso positivo aqui é
desproporcional ao ciclo de 6h de autocorreção.

---

## Motor de Guardrails (chamado por TODA regra antes de gravar)

Toda função de regra abaixo devolve uma decisão *candidata*. Antes de
gravar em `jarvis_decisions`, o loop principal sempre passa pelo
guardrail — nenhuma regra decide por conta própria se autoaplica ou não.

```typescript
interface DecisionCandidate {
  type: string;
  target: string;
  action: string;
  magnitudePct?: number; // ex: -50 para "-50%"; omitido = ação binária (enable/disable)
  evidence: Record<string, unknown>;
  severity: "INFO" | "WARNING" | "CRITICAL";
}

async function evaluateGuardrails(c: DecisionCandidate) {
  const { data: rail } = await supabase
    .from("jarvis_guardrails")
    .select("*")
    .eq("target", c.target)
    .single();

  // Alvo sem config de guardrail = trata como REQUIRES_APPROVAL por padrão
  // seguro (nunca autoaplica um target desconhecido).
  if (!rail || rail.requires_approval) {
    return insertDecision(c, { status: "PENDING", requiresApproval: true });
  }

  // Cooldown: já mexeu neste alvo recentemente?
  const { data: lastActive } = await supabase
    .from("jarvis_decisions")
    .select("created_at")
    .eq("target", c.target)
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (lastActive) {
    const cooldownMs = rail.cooldown_cycles * 6 * 60 * 60 * 1000;
    if (Date.now() - new Date(lastActive.created_at).getTime() < cooldownMs) {
      console.log(`[JARVIS] ${c.target} em cooldown — pulando ciclo`);
      return null; // não grava nada, simplesmente espera o próximo ciclo
    }
  }

  // Clampa magnitude ao teto configurado
  let magnitude = c.magnitudePct;
  if (magnitude !== undefined && Math.abs(magnitude) > rail.magnitude_cap_pct) {
    magnitude = Math.sign(magnitude) * rail.magnitude_cap_pct;
    c.evidence.clamped_from = c.magnitudePct;
  }

  return insertDecision(
    { ...c, magnitudePct: magnitude },
    { status: "ACTIVE", requiresApproval: false, approvedBy: "system_auto" }
  );
}
```

## Regras de Decisão (Exemplos)

Customize as 4 funções abaixo. Cada regra **devolve uma candidata**, nunca
decide status diretamente — quem decide `PENDING` vs `ACTIVE` é sempre o
`evaluateGuardrails` acima, lendo `jarvis_guardrails`.

### Regra 1: Win Rate Below Breakeven
```typescript
async function checkWinRateGate(m24h: PeriodMetrics) {
  const breakeven = 0.35; // Exemplo: R:R 3:1 → WR_breakeven ≈ 35%
  const threshold_alert = breakeven * 0.90; // 31.5%
  const threshold_pause = breakeven * 0.80; // 28%

  if (m24h.winRate < threshold_pause) {
    // CONFIDENCE_GATE está na lista de exclusão (jarvis_guardrails) —
    // o guardrail vai forçar PENDING aqui de qualquer forma, mesmo que
    // esta regra não saiba disso. Defesa em profundidade.
    return evaluateGuardrails({
      type: "GATE_TOGGLE",
      target: "CONFIDENCE_GATE",
      action: "disable",
      evidence: { wr_24h: m24h.winRate, threshold: threshold_pause },
      severity: "CRITICAL",
    });
  }

  if (m24h.winRate < threshold_alert) {
    // position_size está em jarvis_guardrails com magnitude_cap_pct=25 —
    // mesmo pedindo -50%, o guardrail clampa pra -25% automaticamente.
    return evaluateGuardrails({
      type: "SIZE_ADJUST",
      target: "position_size",
      action: "-50%",
      magnitudePct: -50,
      evidence: { wr_24h: m24h.winRate, threshold: threshold_alert },
      severity: "WARNING",
    });
  }
}
```

### Regra 2: Confidence Score Not Discriminating
```typescript
async function checkConfidenceCalibration(m24h: PeriodMetrics) {
  if (m24h.confidenceAUC < 0.55) { // Pior que acaso
    // confidence_score está em jarvis_guardrails com requires_approval=true
    // — recalibrar o modelo de risco nunca autoaplica direto, só propõe
    // experimento formal (jarvis_experiments) pra Cleber aprovar rodar.
    return evaluateGuardrails({
      type: "TEST_SIGNAL",
      target: "confidence_score",
      action: "launch_meta_label_experiment",
      evidence: {
        metric: "auc",
        value: m24h.confidenceAUC,
        threshold: 0.60,
        recommendation: "Treinar modelo de risco com meta-labeling. Baseline atual descrimina pior que acaso — alto custo com baixa informação."
      },
      severity: "WARNING"
    });
  }
}
```

### Regra 3: Price Guard Anomalies
```typescript
async function checkPriceGuardEvents() {
  const { data } = await supabase
    .from("price_guard_events")
    .select("*")
    .gte("created_at", "now()-6 hours");
  
  if (data && data.length > 2) { // Mais de 2 desvios em 6h
    return {
      type: "ALERT",
      target: "price_feed",
      action: "investigate_and_alert",
      evidence: {
        breaches_6h: data.length,
        threshold: 2,
        symbols: [...new Set(data.map(d => d.symbol))],
        recommendation: "Feed apresenta desvios anormais. Verificar conexão de preço real e TTL de cache."
      },
      severity: "CRITICAL"
    };
  }
}
```

### Regra 4: Detectar Padrão Horário (Pesquisa de Sazonalidade Integrada)
```typescript
async function integrateSeasonalityFindings() {
  // Resultado da pesquisa de sazonalidade (agente ac970c7ab99fcfe00 completo):
  // "Zero efeitos direcionais. Valor está em volatilidade/liquidez por hora."
  
  // Aplicar: blackout duro em 21:00–22:00 UTC, e reduzir tamanho em 02:00–06:00 UTC (cripto)
  const hourNow = new Date().getUTCHours();
  
  if (hourNow >= 21 || hourNow < 2) { // Rollover + almoço Ásia
    return {
      type: "SIZE_ADJUST",
      target: "position_size",
      action: "-70%", // Rollover spread é 5–10× normal; não vale
      evidence: {
        hour: hourNow,
        reason: "Rollover 21–22 UTC: spread 5–10× do normal. Cripto almoço 02–06 UTC: vol baixa, liquidez fina."
      },
      severity: "INFO"
    };
  }
}
```

---

## Integração com Claude/MCP (Opcional)

Se quiser que Claude/agentes façam perguntas diretas ao Jarvis:

**Arquivo**: `supabase/functions/jarvis-mcp/index.ts`

```typescript
// MCP Server exposing Jarvis to Claude
// Expõe 3 funções:
// 1. get_health_status() → snapshot mais recente
// 2. get_recent_decisions(limit=10) → últimas decisões
// 3. test_hypothesis(description, sample_size, duration_days) → lança experimento

// Implementação: ~80 linhas, standard Anthropic MCP pattern
```

Comando pra usar em Claude depois:
```
@jarvis status
→ "Últimas 6h: 14 trades, WR 28% (abaixo de breakeven 35%). 
   Detectado: padrão horário 12–15 UTC com vol 3× maior.
   Recomendação: reduzir tamanho, testar meta-labeling."

@jarvis suggest experiment
→ "Proposta: A/B test volatility_targeting (GARCH vs HAR-RV).
   Duração: 14 dias, n mínima: 40 trades/variante.
   Hipótese: GARCH reduz drawdown sem prejudicar Sharpe."
```

---

## Checklist: O Que Falta Fazer

- [ ] Aplicar schema SQL (`jarvis-schema.sql`) no Supabase — inclui `jarvis_guardrails` com seed inicial
- [ ] Criar arquivo `supabase/functions/jarvis/index.ts` com `evaluateGuardrails()` + as 4 regras acima
- [ ] Criar o job de **reavaliação/rollback** (roda no mesmo ciclo de 6h, ANTES das regras novas — reavalia toda decisão `status='ACTIVE'` cujo ciclo de medição já fechou; ver seção "Fluxo Típico")
- [ ] Testar Edge Function localmente (`supabase functions serve jarvis`) — inclusive o caminho de rollback automático com um cenário sintético de PnL ruim
- [ ] Agendar cron: `supabase functions deploy jarvis --cron "0 */6 * * *"`
- [ ] (Opcional) Criar Dashboard em React (`src/app/components/jarvis/JarvisStatus.tsx`) — mostrar claramente o que foi autoaplicado vs. pendente vs. revertido
- [ ] (Opcional) Criar MCP Server (`supabase/functions/jarvis-mcp/index.ts`)

---

## Por Que Isso Funciona

1. **Memória**: `jarvis_decisions` + `jarvis_knowledge` = histórico completo de decisões + evidência. Não é "rodou teste ontem, esqueci". É auditável.
2. **Automação**: 6h é ciclo curto o bastante pra reagir a mudanças de regime, longo o bastante pra evitar noise. Sem precisar de Cleber monitorar 24/7.
3. **Calibração**: cada decisão registra confiança (power estatístico, n, tipo de teste). Cleber pode ver "confiança 75%" e descontar de acordo.
4. **Integração com pesquisa**: resultado da pesquisa (ex: sazonalidade) vira regra em `jarvis_knowledge` → Jarvis a aplica automaticamente.
5. **Sem overfitting**: A/B estruturado (`jarvis_experiments`) com holdout validação (30 dias pós-deploy) antes de chamar vencedor.

---

## Próximo Passo

Deploy do schema e da Edge Function. Depois de 1-2 semanas com Jarvis rodando, você tem:
- Padrão de decisões diárias vs. decisões "boas" (aprovadas pelo Cleber)
- Correlação entre padrão horário e WR
- Qual gate é mais efetivo (qual rejeição evita mais perda)
- Base de dados pra treinar modelo de risco ("meta-labeling")

Aí sim é hora de "evolução do motor", com feedback real.
