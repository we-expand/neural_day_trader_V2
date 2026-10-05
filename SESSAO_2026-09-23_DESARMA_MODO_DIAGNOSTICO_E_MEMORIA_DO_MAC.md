# Sessão 2026-09-23 (tarde) — Desarma modo diagnóstico + diagnóstico de memória do Mac

## Pedido 1 — voltar ao LLM congelado, com as travas
Cleber pediu pra desarmar o teste do modo diagnóstico e voltar à LLM testada
antes (congelada na tag `freeze-llm-brain-2026-09-22`), seguindo com as travas.

**Feito**
- `llm-active-brain/.env`: `MT5_DIAGNOSTIC_TECHNICAL_GATES_DISABLED=true` → `false`
  (linha 250). Os 8 gates técnicos (MACD, momentum, consenso, estocástico etc.)
  voltam a bloquear entrada.
- Modelo já era o certo: `LLM_PROVIDER=ollama`, `LLM_MODEL=qwen35-trading`
  (Qwen3.5 4B). Nada a trocar.
- Continuam como estavam: pipeline Fail-Fast isolado (não plugado), telemetria
  `[OK]`/`[REJECTED]` (só log, sem mudar decisão).

**Pendente**: a mudança só vale após `./restart.sh` (dentro de `llm-active-brain/`).
Ofereci reiniciar; Cleber **cancelou** a ação (motivo: pouca memória no Mac).
Motor segue rodando com o `.env` antigo em memória (modo diagnóstico ainda ATIVO
no processo vivo) até o restart. Um `restart.sh` antigo apareceu pendurado no
`ps` (de comando anterior).

## Pedido 2 — Mac com pouca memória
Diagnóstico (nada foi alterado):
- 16 GB de RAM; **swap 30,8 GB de 31,7 GB usados**, ~0 livre, 7,9M pageouts.
- Wired ~7,4 GB (grande parte modelo/cache do Ollama na GPU unificada).
- Ollama `qwen35-trading`: ~3,9 GB, `num_ctx 32768`, 100% GPU.
- `bun` (worker do claude-mem, up 20 dias): ~0,9 GB.
- Chrome: 35 processos. Também Claude.app, WhatsApp, vite, node.

**Opções propostas (aguardando escolha do Cleber)**
1. Reiniciar worker do claude-mem (~0,9 GB) — mais seguro.
2. Fechar abas do Chrome (1-3 GB) — só o Cleber.
3. Parar o `vite` se não estiver testando front.
4. Baixar `num_ctx` 32768→16384 (~1 GB) — NÃO recomendado: mexe no motor
   congelado, risco de truncar prompt em silêncio (já causou bug antes).
5. Pausar LLM Brain + Ollama (~4 GB) — só se o teste puder parar.

Regra respeitada: não reiniciar/parar LLM Brain sem pedido explícito.

## Pendências
- Cleber decidir quais otimizações de memória aplicar.
- Reiniciar o motor (quando houver memória) pra desarmar de fato o modo diagnóstico.
- Commit da rodada anterior (modo diagnóstico) e desta mudança de `.env`
  (`.env` normalmente não versionado) — nada commitado por mim.
