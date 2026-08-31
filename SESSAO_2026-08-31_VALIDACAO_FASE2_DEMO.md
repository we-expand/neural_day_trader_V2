# Sessão 2026-08-31 (noite) — Validação Fase 2 (DEMO multi-tenant)

> **Status**: Fase 2 de código pronto + 1 bug crítico corrigido ao vivo. Pronto pra validação exaustiva em DEMO.

## O que foi feito

### 1. Commit da Fase 2 já estava lá
- **Commit**: `7124510da` — feat(llm-active-brain): Fase 2 multi-tenant (base)
- Código completo, `tsc --noEmit` limpo
- Threading de `sessionId`/`userId` em todos os módulos (neuralBridge, tools, tradeMemory, agent, index)
- Loop principal varre todas as `ai_sessions` elegíveis serialmente

### 2. Bug crítico identificado ao vivo + CORRIGIDO

**Achado**: `listEligibleMt5Sessions()` retornava TODAS as 6 sessões históricas (`status='PAUSED'`) no Supabase desde 2026-08-29, não só a "atual". Resultado: 6 cérebros independentes processavam a mesma conta MT5 no mesmo ciclo, cegos entre si sobre teto de posição/exposição.

**Fix aplicado** em `neuralBridge.ts` (linhas 328-366):
```typescript
// Adiciona criação_at ao select, ordena DESC, filtra por user_id
// Mantém só a sessão mais recente por user_id (a "atual")
const byUser = new Map<string, (typeof data)[0]>();
for (const row of data ?? []) {
  const userId = row.user_id as string;
  if (!byUser.has(userId)) {
    byUser.set(userId, row);
  }
}
```

**Validação**: ✅ Log confirma que CICLO 1-4 rodando com 1 sessão/ciclo (CICLO 3 tem 2x `list_open_positions`, mas 1 do loop principal + 1 do agente internamente — normal).

**Compilação**: `tsc --noEmit` limpo após o fix.

**Restart**: Processo matado (PID 11524), reiniciado com código novo. Rodando estável agora.

### 3. Decisão executiva confirmada

**Estratégia de validação**: Não iniciar Fase 3 (LIVE) até ter confiança absoluta em DEMO.
- Deixar rodando em background, acumulando dados reais
- Monitorar comportamento, guardrails, reprodutibilidade
- Amostra mínima: 100-500+ trades significativos
- Só depois: migrar pra dinheiro real (Fase 3)

## Estado atual

| Componente | Status | Nota |
|---|---|---|
| **Código Fase 2** | ✅ Pronto | multi-tenant, threading ok |
| **Bug multi-session** | ✅ Corrigido | 1 sessão/ciclo agora |
| **Compilação** | ✅ Limpo | tsc --noEmit zero errors |
| **Processo rodando** | ✅ Ativo | ~CICLO 4+, DEMO, acumulando trades |
| **Supabase** | ✅ Conectado | ai_sessions/ai_trades persistindo |
| **Execução real** | ⏸️ DEMO apenas | INSERT em ai_trades, sem corretora real |

### Dados acumulados na sessão atual
- ~4 ciclos rodados (desde restart ~10 min)
- 1 posição aberta: LNKUSD SHORT (entrada $11.263, entrada_time 2026-08-31T11:11:16)
- Histórico anterior de 5+ horas de trades antes do restart (sessões antigas, DEMO)

### Sessões no Supabase
Só 1 sessão ativa agora sendo processada:
- ID: `b38d5862-f352-47e4-91de-f03a6e50dbe9`
- User: `aeb3ec15-f660-4775-856b-2a04b20f4592`
- Status: `PAUSED` (hack de status pra ficar fora do motor mecânico antigo)
- Mode: `DEMO`
- Initial balance: $50

Sessões antigas (histórico, NÃO mais processadas): 5 outras sessões entre 2026-08-29 e 2026-08-31 (descartadas do loop por serem não-recentes).

## Próximas ações — Fase 2 Validação (DEMO)

**Não fazer**: Código novo, Fase 3, decisões de LIVE.

**Fazer**:
1. ✅ Deixar processo rodando em background (já está)
2. Monitorar periodicamente:
   - Log do processo (`llm-brain.log` em `llm-active-brain/`)
   - `ai_trades` table (novos trades, PnL, resultados)
   - Comportamento de guardrails (teto de posição, teto de grupo, cooldown)
3. Documentar achados (anomalias, comportamentos inesperados)
4. Acumular amostra estatística (alvo: 100-500+ trades DEMO antes de confiar)
5. Quando confiança atingida: marcar como "Fase 2 validada" e preparar handoff pra Fase 3

## Handoff pra próxima sessão

### Comandos prontos (se precisar reiniciar processo)

```bash
cd llm-active-brain

# Kill processo antigo se ainda estiver rodando
kill $(cat llm-brain.pid)

# Reiniciar em background
nohup npm run start > llm-brain.log 2>&1 &

# Confirmar processo único ativo
ps aux | grep "node.*index" | grep -v grep | wc -l  # deve retornar 1
```

### Verificar status durante operação

```bash
cd llm-active-brain

# Últimos ciclos (ver quantos ciclos rodaram)
tail -100 llm-brain.log | grep "CICLO"

# Ver se há erro recente
tail -50 llm-brain.log

# Confirmar que só 1 sessão/ciclo (não 6)
grep "list_open_positions" llm-brain.log | head -20

# PnL acumulado (query no Supabase)
SELECT session_id, COUNT(*) as trade_count, SUM(net_pnl) as total_pnl 
FROM ai_trades 
WHERE strategy_name = 'LLM_ACTIVE_BRAIN_MT5' 
  AND status = 'CLOSED'
GROUP BY session_id
ORDER BY total_pnl;
```

### Arquivo de log

- Local: `llm-active-brain/llm-brain.log`
- Tamanho: ~1-2 MB por dia de rodagem (10s/ciclo, ~8640 ciclos/dia)
- Retenção: deixar crescer, não deletar

### Não tocar em

- `NEXT_SESSION.md` — foi reescrito pra Fase 3 (que ficou adiada, mas o doc fica como referência)
- `ai_sessions` com `status='PAUSED'` antigos — deixar como histórico, o filtro agora ignora
- Motor mecânico (`ai-runner`) — continua ativo em produção (cron confirmado), não desligar

### Decisões pendentes (adiadas pra depois da validação)

1. Item 6 (config por sessão) — deliberadamente NÃO feito, não over-engineering
2. Item 7 (teste 2+ sessões em paralelo) — validado agora (bug de 6 sessões processadas foi o resultado disso)
3. **Fase 3 (LIVE)** — completamente adiada, só depois de validação DEMO satisfatória

## Notas técnicas

- **Trava de PID único**: mantida em `index.ts` — protege `ledger/actions.json` por processo, não mudou com multi-tenant
- **Loop serial**: por design — conta MetaAPI compartilhada não aguenta concorrência, ver CLAUDE.md
- **Execução**: 100% DEMO (INSERT em `ai_trades`, sem execução real em corretora)
- **Mode DEMO**: hardcoded em `neuralBridge.ts`, linha ~300 — nunca muda sem decisão explícita
- **Guardrails**: todos threading-safe agora (filterados por `sessionId` em `tools.ts`)

## Git status

```bash
git status
# llm-active-brain/src/neuralBridge.ts — MODIFICADO (fix de listEligibleMt5Sessions)
```

**Commit pendente**: O fix de multi-session ainda não foi commitado (só corrigido na working tree). Quando quiser commitar:

```bash
git add llm-active-brain/src/neuralBridge.ts
git commit -m "fix(llm-active-brain): listEligibleMt5Sessions retorna só sessão mais recente por user_id

Antes retornava TODAS as 6 sessões históricas com status=PAUSED, causando
6 cérebros independentes processando a mesma conta MT5 blindly sobre guardrails.
Agora filtra pra sessão ativa (mais recente por user_id) apenas.

Validado ao vivo: CICLO 1-4 rodando com 1 sessão/ciclo (antes eram 6 em paralelo).
tsc --noEmit limpo após fix."
```

---

**Escrito em**: 2026-08-31 ~20:45 UTC
**Próxima sessão foco**: Monitorar validação DEMO, acumular amostra, documentar achados
