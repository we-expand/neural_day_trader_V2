#!/bin/bash
# Disparado pelo cron local. Roda a pesquisa de concorrentes real via Claude
# headless e loga o resultado. Nunca fabrica dado — se a Service Role Key
# não estiver disponível, falha alto e visível em vez de rodar sem gravar.
set -euo pipefail

PROJECT_DIR="/Users/clebercouto/Projects/we-expand/Neural-Day-Trader"
LOG_DIR="$PROJECT_DIR/research/experiments/cron-logs"
LOG_FILE="$LOG_DIR/$(date +%Y-%m-%d_%H%M%S).log"
mkdir -p "$LOG_DIR"

cd "$PROJECT_DIR"

if [ -f .env.local ]; then
  set -a
  source .env.local
  set +a
fi

if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ] || [ -z "${SUPABASE_URL:-}" ]; then
  echo "$(date -Iseconds) ERRO: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes em .env.local — abortando." >> "$LOG_FILE"
  exit 1
fi

PROMPT="$(cat research/scripts/competitor-research-prompt.md)"

claude -p "$PROMPT" \
  --allowed-tools "WebSearch,WebFetch,Bash(node research/scripts/insert-research-run.mjs*),Bash(node research/scripts/list-existing-evidence.mjs*)" \
  >> "$LOG_FILE" 2>&1

echo "$(date -Iseconds) OK: rodada concluída, ver $LOG_FILE" >> "$LOG_DIR/history.log"
