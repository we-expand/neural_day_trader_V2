#!/bin/bash
set -e

echo "[$(date)] Matando processos antigos do LLM Brain..."
pkill -9 -f "llm-active-brain|tsx src/index.ts" 2>/dev/null || true
sleep 2

echo "[$(date)] Limpando PID lock..."
rm -f llm-brain.pid

echo "[$(date)] Reiniciando processo..."
# 🔴 2026-08-31 (achado ao vivo): NUNCA escrever llm-brain.pid aqui -- quem
# grava esse arquivo é o próprio processo (acquireSingleInstanceLock() em
# src/index.ts), usando o PID real do node/tsx. `$!` neste ponto é o PID do
# processo `npm` (o wrapper que o `&` bota em background), não o do node
# filho que o npm spawna -- escrever esse PID errado aqui sobrescrevia o
# lock certo que o processo real escreve milissegundos depois, fazendo-o
# encontrar "PID já em uso" (o do próprio npm, ainda vivo) e se recusar a
# subir. Só espera o processo real escrever o lock sozinho.
nohup npm run start > llm-brain.log 2>&1 &
disown
sleep 3

echo "[$(date)] ✓ Processo reiniciado (PID no lock: $(cat llm-brain.pid 2>/dev/null || echo '???'))"
echo "[$(date)] Últimas linhas do log:"
tail -30 llm-brain.log
