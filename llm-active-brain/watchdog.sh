#!/bin/bash
# 2026-09-01: o processo do LLM Brain (src/index.ts) tem um teto duro de
# ciclos (MAX_CYCLES, trava intencional em config.ts) e pode morrer por
# crash/erro fatal nao capturado. Sem isto, quando ele sai por qualquer
# motivo, ninguem religa -- foi exatamente o que aconteceu em 2026-08-31/
# 09-01: bateu MAX_CYCLES sozinho e ficou parado ~horas sem ninguem notar.
# Este watchdog roda em loop pra sempre: espera o processo terminar (seja
# qual for o motivo) e sobe de novo, sem apagar nenhuma posicao/sessao (o
# estado real vive no Supabase, nunca neste processo).
set -u
cd "$(dirname "$0")"

echo "[$(date)] Watchdog do LLM Brain iniciado (PID $$)."

while true; do
  echo "[$(date)] Matando qualquer instancia antiga antes de subir..."
  # 🔴 2026-09-01 (achado grave, ao vivo): o padrao "tsx src/index.ts" NUNCA
  # deu match de verdade -- o processo real roda como
  # `node --require .../tsx/dist/preflight.cjs --import .../tsx/dist/loader.mjs src/index.ts`,
  # sem a substring literal "tsx src/index.ts" em lugar nenhum da linha de
  # comando. Resultado: toda vez que este script (ou um restart manual) foi
  # invocado, o "kill" nunca matava o processo anterior -- 13 instancias
  # zumbis ficaram rodando em paralelo desde as 08:06, todas competindo pela
  # mesma conta MT5 compartilhada e, mais tarde, pelo mesmo Ollama local,
  # causando lentidao seria e comportamento erratico. Padrao corrigido pra
  # bater no processo real.
  pkill -9 -f "tsx/dist/loader.mjs src/index.ts" 2>/dev/null || true
  rm -f llm-brain.pid
  sleep 1

  echo "[$(date)] Subindo processo do LLM Brain..."
  npm run start >> llm-brain.log 2>&1
  EXIT_CODE=$?

  echo "[$(date)] Processo do LLM Brain saiu (codigo $EXIT_CODE). Religando em 5s..."
  sleep 5
done
