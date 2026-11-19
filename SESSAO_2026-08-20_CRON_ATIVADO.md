# Sessão 2026-08-20 — Cron do `ai-runner` ativado pela primeira vez contra o Supabase real

## Contexto

Cleber ligou a IA (sessão DEMO) pra testar. Investigação mostrou que o motor
servidor (`ai-runner`) nunca processava nada: a extensão `pg_cron` **não
estava instalada** nesse projeto Supabase (`wyvdsxtcmizettljxtbg`) — não
existia job nenhum agendado, apesar do runner (Fatia 3, commitado em
2026-08-07) estar deployado e pronto desde então. Ou seja: pela primeira vez
desde que o runner foi escrito, ele rodou de fato contra dado real.

## O que foi feito

1. **Habilitadas as extensões** `pg_cron` e `pg_net` (não existiam antes).
2. **Cron criado**: `ai-runner-tick`, `* * * * *` (1×/min), via
   `net.http_post` pro endpoint do `ai-runner`.
3. **Bug encontrado e corrigido**: a interface de Secrets do painel do
   Supabase (Edge Functions → ai-runner → Secrets) **não estava persistindo
   edições de verdade** — mesmo depois de editar, salvar, dar reload da
   página e redeployar a função várias vezes, o valor real lido por
   `Deno.env.get('AI_RUNNER_SHARED_SECRET')` nunca mudava (confirmado via log
   de diagnóstico temporário comparando tamanho/sufixo do secret, sem expor o
   valor completo). Resultado: `401 unauthorized` em todo tick, por ~30min.
   **Fix**: setar o secret direto via CLI —
   `supabase secrets set AI_RUNNER_SHARED_SECRET=<valor> --project-ref wyvdsxtcmizettljxtbg`
   — resolveu de imediato. **Lição pra próxima vez**: se secret de Edge
   Function precisar mudar, usar CLI, não confiar na UI do painel pra
   confirmar que persistiu.
4. **Log de diagnóstico temporário removido** depois de confirmado o fix —
   `index.ts` voltou ao estado original (só o check de secret, sem log).
5. **Confirmado com dado real**: sessão `ffdc8fdb-77ac-4c15-8bfa-f9e5f6d4dcdf`
   processada normalmente, `ai_funnel_snapshots` mostrando avaliação real
   (COST_GATE, CONTEXT_GATE, etc.) e **1 trade real aberto pelo servidor**:
   ETHUSD SHORT, entrada `2026-08-20 12:27:46 UTC` a `$2279.41`,
   `stop_loss=$2292.99`, `take_profit=$2245.45`.

## Achado paralelo, não corrigido (baixa prioridade)

`net.http_post` tem timeout default de 5000ms; o `ai-runner` roda até 45s por
invocação (`MAX_RUNTIME_MS`). Testado subir o timeout do cron pra 55000ms —
ainda assim o tick real está batendo perto/acima disso, então o
`net._http_response` nunca mostra `200` de verdade, sempre timeout. **Isso
não afeta o trading** (confirmado: a função termina o processamento
server-side mesmo depois do Postgres desistir de esperar — `index.ts` não
checa `req.signal`, e `ai_sessions.updated_at`/`ai_funnel_snapshots` seguem
avançando normalmente). É só uma lacuna de observabilidade: não dá pra
confiar em `net._http_response` pra saber se um tick teve erro real (500,
crash) — melhor monitorar por `ai_sessions.updated_at` parando de avançar.
Decisão do Cleber: deixar como está por ora, não perseguir esse timeout.

## Estado no fim da sessão

- Cron `ai-runner-tick` ativo, rodando 1×/min, secret correto.
- Sessão DEMO `ffdc8fdb-77ac-4c15-8bfa-f9e5f6d4dcdf` RUNNING, processando de
  verdade, com pelo menos 1 trade real aberto.
- **Isso destrava os itens pendentes do handoff de 2026-08-19** que
  dependiam de "deploy de teste contra o Supabase real" (watchdog de
  zumbis, breakeven/trailing no servidor, gate de margem, Pyramiding) — a
  infraestrutura pra testar esses cenários agora existe e está no ar. Nenhum
  desses cenários específicos foi observado ainda nesta sessão (o foco foi
  só destravar o cron) — próxima sessão que pegar isso deve verificar cada
  um contra esse cron já ativo, em vez de precisar destravar infra de novo.
