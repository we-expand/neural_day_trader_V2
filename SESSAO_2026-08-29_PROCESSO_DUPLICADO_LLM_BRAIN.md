# Sessão 2026-08-29 — Processo duplicado do LLM Brain rodando em paralelo

## Contexto

Cleber reportou que o motor (`llm-active-brain`) "não estava iniciando" via
terminal. Investigação mostrou que o motor **estava rodando normalmente** —
o log avançava ciclo a ciclo, sem travamento real.

## Achado

Ao reiniciar o processo (`kill` seguido de novo `nohup npm run start`), o
`kill` das PIDs antigas não foi executado antes do novo processo subir —
resultado: **dois processos do motor rodando ao mesmo tempo** contra a
mesma conta (PID antigo `82119`/`82138` desde 08:39 + PID novo `82449`/
`82467` desde 08:46). Risco real: dois cérebros decidindo entrada/saída em
paralelo podem duplicar ordens na mesma conta MetaAPI compartilhada.

Confirmado que o processo antigo já tinha morrido sozinho no momento do
segundo `kill` (comando devolveu "no such process" — não é erro, é
confirmação). Ficou só um processo vivo (PID `82467`), log avançando
normalmente (ciclos, chamadas de ferramenta, `stop()` do agente entre
ciclos).

## Causa da falsa sensação de "congelado"

Nenhum bug de código encontrado nesta sessão. Duas fontes de confusão:
1. `tail -f` num log trava a saída do terminal de propósito (esperando
   novas linhas) — parece "travado" mas não é.
2. Erros recorrentes de `get_mt5_quote` ("Sem cotacao real disponivel
   agora") no log são o feed MetaAPI intermitente já documentado (ver
   `CLAUDE.md` — conta compartilhada sujeita a rate-limit), não falha do
   motor.

## Comandos de referência (matar processo antigo antes de subir novo)

```bash
ps aux | grep "tsx src/index" | grep -v grep   # ver PIDs vivos antes
kill <pid_antigo_npm> <pid_antigo_tsx>
cd /Users/clebercouto/Projects/we-expand/Neural-Day-Trader/llm-active-brain
nohup npm run start > "logs/restart_$(date +%Y%m%d_%H%M).log" 2>&1 &
disown
ps aux | grep "tsx src/index" | grep -v grep   # confirmar que só sobrou 1
```

## Pendência

Nenhuma. Sessão só de diagnóstico operacional, sem mudança de código.
