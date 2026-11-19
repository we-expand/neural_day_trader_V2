# Sessão 2026-08-19 — Investigação: VIX do Dashboard fora do ar / sobrecarga MT5

## Pergunta inicial

VIX do Dashboard não funciona. Investigação levou a um problema maior:
degradação sustentada na Edge Function `mt5-prices`/`mt5-candles-history`.

## Diagnóstico (dado real, via `query_logs` do Supabase)

Latência da rota `mt5-prices` nas 24h anteriores a 19/08 15h — não é pico
passageiro, é degradação **constante e crescente ao longo do dia**:

| Hora (UTC, 18/08) | Latência média | Pico | Chamadas lentas (>5s) |
|---|---|---|---|
| 17-18h | ~3.3-5.3s | até 38-54s | centenas |
| 00-06h | ~2.7-5.6s | até 42s | centenas |
| 09-13h | ~2.9-6.9s | até 39-55s | milhares |
| 14-15h | ~5.7-6.3s | até 48s | 2.400+ na última hora |

Volume: **900 a 6.000 chamadas/hora** pra essa rota, o dia inteiro.

## Causa raiz (confirmada via `git log` + código)

Não é "MetaAPI ruim" — é usar uma **API de execução, em conta MT5
compartilhada**, como **feed de dados de mercado**. Documentado no próprio
código (`src/app/config/defaultBasket.ts:66-88`).

Linha do tempo real:
1. **18/08-17 10:20** (`7f8f3717a`) — cérebro passou a **ranquear a cesta
   inteira** (39 ativos) a cada ciclo, em vez de só o ativo selecionado.
2. **18/08-17 11:45** (`6b8e3e2e8`) — mitigação de emergência no mesmo dia:
   medido em produção **5.942 chamadas em 35min** pro
   `mt5-candles-history`, boa parte batendo 429/504. Reduzido de 6→3 ativos
   atualizados por tick (`ASSETS_REFRESHED_PER_TICK`), com TTL alinhado à
   barra do timeframe e backoff por símbolo. Paliativo, não solução — o
   próprio comentário no código já registra isso.

Orçamento de chamadas levantado nessa mesma sessão (removido do
`NEXT_SESSION.md` numa reescrita posterior, recuperado do histórico do
commit `7f8f3717a`):
- Com a mitigação atual (3/tick + TTL por barra): ~8 chamadas/min,
  **~11.500/dia**.
- Sem a mitigação, cesta de 39 seria ~78/min (**~112.000/dia**).

Opções de correção definitiva levantadas (nenhuma contratada):
- Twelve Data Grow (US$29/mês) — feed de dados dedicado, separado da
  execução.
- MetaAPI mantido só para execução, com conta dedicada por usuário em vez
  de compartilhada.
- Alternativas MT5 pay-as-you-go (Indexnano, API2Trade, MetaTraderAPI.dev).

## Reavaliação: o gasto pago não é necessário agora

Contexto do Cleber: descapitalizado, plataforma ainda em validação, **1
usuário real (ele mesmo)**. Os US$29/mês foram dimensionados pra cenário de
produção com múltiplos usuários simultâneos disputando a mesma conta — não
é o caso atual.

**Plano de mitigação sem custo, self-service, sem precisar de código novo:**
1. Reduzir a cesta de ativos operados de 39 para ~9, direto na tela do AI
   Trader (`AssetUniverse`, grava em `config.activeAssets`, lido pelo motor
   em `runTradingCycle.ts:258` no lugar do default de 39).
2. Evitar múltiplas abas do Dashboard abertas ao mesmo tempo (cada uma soma
   polling em paralelo).
3. Considerar conta MT5 demo pessoal separada (gratuita) em vez da conta
   demo "de plataforma", enquanto for só ele testando.
4. Gasto pago (Twelve Data ou conta MetaAPI dedicada por usuário) só faz
   sentido quando houver outros usuários reais operando ao mesmo tempo.

## Pegadinha encontrada e já corrigida: config só entra em vigor no restart

`activeAssets` mudado na tela **não afeta uma sessão já em andamento** — só
é gravado no Supabase (`config` da sessão, lido pelo `ai-runner`) no
momento em que a sessão é criada, em `startLogic()`
(`useApexLogic.ts:1690-1701`).

Isso já foi corrigido em 2026-08-17 (comentário no código,
`useApexLogic.ts:1760-1776`): antes, "Desligar AI" não encerrava a sessão
no Supabase, só zerava estado local — o `ai-runner` continuava rodando com
a config antiga indefinidamente, e só um reload de página (com intervenção
manual no banco) resolvia. Hoje `stopLogic()` chama `endSession()` de
verdade.

**Fluxo correto pra trocar os ativos:**
1. Desligar a IA (agora encerra a sessão de verdade no banco)
2. Escolher os ~9 ativos no `AssetUniverse`
3. Ligar a IA de novo → cria sessão nova, com a config atualizada, que o
   `ai-runner` já lê corretamente
4. Checar no card/log se aparecem os ativos certos antes de deixar rodando
   sem supervisão

## Checagem final: sem posição zumbi

Consultado direto no Supabase (19/08):
- `ai_trades` com `status = 'OPEN'`: **0 registros**.
- `ai_sessions` com `status = 'RUNNING'`: **0 registros**.
- Última sessão (`66faee09-fe87-4bc6-a9a6-1ee8d7edb504`) encerrada
  corretamente em `COMPLETED` às 19/08 07:10:43 UTC, saldo final $86,59.

Confirmado: IA desligada de verdade, sem sessão fantasma rodando no
servidor, sem posição pendurada. Seguro pra trocar a cesta de ativos sem
risco de mexer em algo com posição aberta no meio.

## Pendências em aberto após esta sessão

- Cleber ainda precisa reduzir a cesta pra ~9 ativos pela própria UI
  (nenhuma mudança de código feita nesta sessão).
- Correção arquitetural real (separar feed de dados da execução) segue sem
  decisão — só vale a pena quando houver múltiplos usuários reais.
- Vale registrar de volta no `NEXT_SESSION.md` a seção "Feed de dados"
  (números de orçamento de chamadas e opções) que sumiu numa reescrita
  anterior, pra não se perder de novo.
