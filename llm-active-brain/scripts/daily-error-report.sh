#!/bin/bash
# Relatorio diario de erros do LLM Brain (somente leitura). Agendado pelo launchd todo dia as 20h
# (~/Library/LaunchAgents/com.neuralday.error-report.plist). Grava em reports/ e nao toca no motor.
set -u
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
cd "$(dirname "$0")/.." || exit 1
D=$(date +%Y-%m-%d)
mkdir -p reports
{
  echo "=== $(date '+%Y-%m-%d %H:%M:%S') ==="
  ./node_modules/.bin/tsx scripts/error-report.ts --out="reports/erros-$D.md" > /dev/null && echo "ok: reports/erros-$D.md (tudo desde 22/09)"
  ./node_modules/.bin/tsx scripts/error-report.ts --package --out="reports/pacote-$D.md" > /dev/null && echo "ok: reports/pacote-$D.md (so o pacote de 07/10)"
} >> reports/daily.log 2>&1
