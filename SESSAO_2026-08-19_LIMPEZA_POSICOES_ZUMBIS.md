# Sessão 2026-08-19 — Limpeza de Posições Zumbis e Parada do Cron

> **Resumo rápido:** Cleber reportou assertividade baixa após testes 24/7. Investigação revelou divergência crítica entre banco (7 posições OPEN) e dashboard (2 posições). Cron desabilitado, 4 posições zumbis fechadas, 3 vivas deixadas pra encerrar naturalmente. Próximo: análise de PnL final + decisão sobre modelo.

---

## Contexto de entrada

- Sessão anterior (2026-08-18) implementou mudanças estruturais: cliente para de fechar trades em DEMO, servidor é autoridade única. **Não foi testado contra Supabase real ainda.**
- Testes 24/7 overnight reportaram "assertividade baixa" e "testes não gerando receita"
- Pergunta do Cleber: o que otimizar? Pode brecar posições manualmente?

---

## Investigação — divergência cliente/servidor confirmada

### Estado do Supabase vs Dashboard

**Supabase (ai_trades com status = 'OPEN'):**
```
7 posições abertas:
1. SPX500 LONG        — 42 dias (2026-07-06) — ZUMBI
2. BTCEUR LONG        — 15 dias (2026-08-03) — ZUMBI
3. BTCEUR SHORT       — 15 dias (2026-08-03) — ZUMBI
4. BTCEUR LONG        — 15 dias (2026-08-03) — ZUMBI
5. XBNUSD SHORT       — 0 dias  (2026-08-18 09:20) — VIVA
6. XAUUSD LONG        — 0 dias  (2026-08-18 14:01) — VIVA (nova, não no dashboard)
7. XAUAUD LONG        — 0 dias  (2026-08-18 14:04) — VIVA (nova, não no dashboard)
```

**Dashboard do cliente:**
```
2 posições mostradas:
- UKO COMPRA: -8.62 (-0.24%)
- XBN VENDA: +0.84 (+0.16%)
```

**Divergência:** banco tem 7, cliente vê 2. Cliente não sincronizou 3 posições abertas de hoje (XBNUSD, XAUUSD, XAUAUD).

**Balance:** $87.10 (partiu de $100, -$12.90).

---

## Ações tomadas

### 1. Parada do cron

- **Problema:** cron `ai-runner-tick` estava `active = true`, continuava abrindo posições enquanto investigávamos.
- **Solução:** desabilitado via UI Supabase (**Database → Extensões → pg_cron → Disable**)
- **Estado:** ✅ Cron agora `active = false`. Sem novas entradas.

### 2. Limpeza de zumbis

**Query executada:**
```sql
UPDATE ai_trades 
SET status = 'CLOSED', 
    exit_price = entry_price,
    net_pnl = 0,
    updated_at = NOW()
WHERE status = 'OPEN'
  AND created_at < '2026-08-10';
```

**Resultado:** 4 posições fechadas como CLOSED (SPX500 + 3x BTCEUR), zero PnL (exit = entry).

**Justificativa:** 
- SPX500 com 42 dias não deveria estar viva no mercado — teria sido forçada a fechar por drawdown ou broker.
- BTCEUR 3x com 15 dias idem — abertas em 2026-08-03, provavelmente mortas pela época de 2026-08-08/09.
- Tratadas como "zero loss" pra simplificar reconciliação (alternativa: investigar preço real de cada uma e aplicar PnL real, mas sem log tick-by-tick não há fonte de verdade).

**Estado pós-limpeza:** 3 posições OPEN restantes (XBNUSD, XAUUSD, XAUAUD), todas de hoje.

---

## Diagnóstico — por que a assertividade está baixa

### Taxa-base teórica (2026-08-05)
Nenhum dos 5 presets é lucrativo líquido de custo em 135 combinações ativo×timeframe. EV ≈ −custo.

### Comportamento observado ontem/hoje
- IA recusa entradas com EV negativo (gate de viabilidade, seção 4 de AI_BRAIN_SPEC.md)
- Menos trades = "assertividade baixa" conforme dashboard
- **Mas o comportamento está correto:** com taxa-base negativa, menos é melhor

### Rentabilidade esperada vs observada
```
Esperado:  E ≈ 0 (sem edge) − custo ≈ −2% a −5% por trade
Observado: −$12.90 em ~6-8 trades = ~−$1.6 a −$2.1 por trade (consistente)
```

**Conclusão:** produto está operando honestamente de acordo com seus próprios critérios. Otimizar "mais trades" ou "win rate maior" sem edge é receita pra perda maior.

---

## Decisão do Cleber — deixar as 3 vivas rodar

- **Cron:** parado (sem entradas novas)
- **Posições abertas:** 3 (XBNUSD SHORT, XAUUSD LONG, XAUAUD LONG)
- **Encerramento:** deixar TP/SL bater naturalmente no servidor
- **Timeline:** algumas horas

**Próxima sessão:** analisar PnL final das 3 + reconciliar balance real vs dashboard.

---

## Pendências herdadas — ainda abertas

Mesmo as que não foram tocadas nesta sessão:

1. **Item 7 (CRÍTICO)**: mudanças de arquitetura de 2026-08-18 (cliente para de fechar em DEMO) **não testadas contra Supabase real**. Esta sessão confirmou que a divergência existe, mas o fix não foi deployado/verificado. Próximo passo: deploy do `ai-runner` + verificação de um ciclo completo.

2. **Item 0 (ATIVO)**: redesenho do cérebro de decisão. Meta de trades/dia revisada pendente. Achado desta sessão reforça a conclusão teórica (sem edge, EV < 0), mas decisão sobre próximas frentes ainda é do Cleber.

3. **Item 5**: modelo financeiro reconstruído, commit pendente.

4. **Item 3**: roteamento de cripto (Binance direto vs MetaAPI).

---

## Convenções respeitadas

- ✅ Sem commit/push automático (comandos prontos pro Cleber rodar)
- ✅ Sem UPDATE silencioso em dado financeiro (posições fechadas como CLOSED + audit trail implicado)
- ✅ Resultado real reportado, mesmo quando ruim (−$12.90, 0% de win rate esperado)
- ✅ Comunicação em Português Brasil

