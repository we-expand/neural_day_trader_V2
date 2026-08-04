# Handoff — próxima sessão

> Reescrito em **2026-08-04 (noite)**. A versão anterior (31/07, handoff dos
> Blocos A–E do cérebro cognitivo) estava obsoleta e virou acúmulo — está
> preservada no git (`git show 05a034161:NEXT_SESSION.md`) e o conteúdo
> relevante já vive em `SESSAO_2026-07-31_*.md` e `CLAUDE_HISTORY.md`.
> **Regra: este arquivo é handoff da sessão CORRENTE. Reescreva, não empilhe.**

## Onde paramos

Cleber deixou a AI Trader ligada 4h40 com o mercado aberto e teve **zero
entradas**. Expectativa dele: ~15 trades/dia. Isso abriu um redesenho do
cérebro de decisão, com ele no papel de dono do produto e Claude dirigindo a
empreitada técnica.

**Leitura obrigatória antes de continuar**, nesta ordem:
1. `SESSAO_2026-08-04_FASE0_TELEMETRIA_FUNIL.md` — diagnóstico completo com
   evidência, os 6 defeitos estruturais, a decisão de produto e o que foi
   implementado. **É o documento principal desta linha de trabalho.**
2. `research/AI_BRAIN_SPEC.md` seções 14.5 e **14.7** — a decisão (B) e a
   revisão que converteu os veredictos de "medido como negativo" para "nunca
   foi medido com poder suficiente". Não citar número da seção 14 sem ler 14.7.
3. `SESSAO_2026-08-04_DIAGNOSTICO_ZERO_ENTRADAS_AI_TRADER.md` — o diagnóstico
   anterior (13:23), de rate-limit da MetaAPI. Continua válido como causa da
   fome de dado, mas era só parte da história.

## O que ficou decidido (não reabrir sem motivo novo)

- **Calibração ajusta a QUANTIDADE de trades, nunca o SINAL da expectativa.**
  Enquanto o edge for indeterminado, forçar 15 trades/dia é escolher pagar
  spread 15×/dia contra retorno não estabelecido. Isso foi dito ao Cleber de
  forma explícita e ele seguiu adiante ciente disso.
- **Rota escolhida por ele para a Fase 2: medir a curva `k(t)`** — como o edge
  bruto por trade varia com o holding period. Hoje só há 2 pontos medidos
  (~42min positivo, ~39h negativo); a região de ~2,9h que a aritmética de custo
  aponta nunca foi tocada. Orçamento e critério de corte já fixados **antes de
  começar** (tabela no doc da sessão) — se `k(t)` não for significativamente
  positivo em nenhum ponto, alfa direcional está encerrado **com prova** e o
  produto vai pra rota de execução/disciplina sem reabertura.
- **Fase 0 não afrouxou nenhum gate.** Só tornou o motor observável. Qualquer
  ajuste de limiar antes de ler o funil real é chute e contraria a convenção
  do projeto.

## Estado do código

Implementado, type-check estrito zerado, `npm run validate` passando,
auditoria estática confirmando **30 de 30 saídas do ciclo instrumentadas**
(antes: 15 de 30):

- `supabase/migrations/014_ai_funnel_snapshots.sql` (novo)
- `src/app/services/telemetry/FunnelTelemetry.ts` (novo)
- `src/app/hooks/useAIPersistence.ts` — mapa veto→funil no ponto único por onde
  todo veto passa + `getSessionId()` (leitura ao vivo do ref)
- `src/app/hooks/useApexLogic.ts` — instrumentação das saídas silenciosas
- `tsconfig.engine.json` — telemetria entra no gate estrito

**Não testado ao vivo de propósito**: rodar a IA de verdade martelaria a conta
MetaAPI compartilhada em produção, contra a regra do projeto.

## ✅ Bloqueios limpos em 04/08 à noite — verificado, não presumido

- **Migration 014 rodada.** Confirmado por
  `select to_regclass('public.ai_funnel_snapshots') is not null` → `true`.
- **Commit + push feitos.** Commit `cddb66cf3` com os 6 arquivos da Fase 0;
  `dev` em sincronia com `origin/dev` (Vercel builda a partir daí).

**Portanto o próximo passo é só um: rodar uma sessão de mercado com a IA
ligada, e então ler o funil.** Nada mais bloqueia.

Pendência lateral, sem relação com o cérebro: sobraram mudanças não commitadas
de OUTRA sessão na árvore (`AIToolsControl.tsx`, `ATRTrailingStopManager.tsx`,
`PyramidingConfigPanel.tsx`, `SESSAO_2026-08-04_ATR_PYRAMIDING...md`) —
o Cleber decide o que fazer com elas.

## Próximos passos, em ordem

1. **Fase 1 — ler o funil.** Consultar `ai_funnel_snapshots` via MCP Supabase.
   As duas perguntas que importam:
   - `ticks` por janela: esperado ~12 (janela de 60s, loop de 5s). Se vier 1–2,
     a aba estava em segundo plano e **nenhum gate tem culpa** — o Chrome
     estrangula timer de aba oculta. Essa causa nunca pôde ser testada antes.
   - `stage_counts` agregado: onde os setups morrem, com número.
2. **Fase 0 restante**, recomendada nesta ordem (Cleber foi perguntado e a
   sessão terminou antes da resposta):
   - **Circuit breaker por ativo** — hoje um GBPUSD sem tick pausa entradas de
     forma global; deveria isolar só o ativo afetado. É o que gera os banners
     "Dados de mercado indisponíveis".
   - **Mover o runner pro servidor** — hoje o motor é `setInterval` no
     navegador, sem runner em `supabase/functions/`. Aba fechada = IA
     desligada. Para um produto que promete operar pelo usuário, é
     desqualificante.
3. **Fase 2 — o `k(t)`**, com o orçamento já fixado. Dataset M1 e motor numba
   já existem em `research/experiments/2026-07-30-sma-pullback-crossasset/scripts/`.

## Armadilha conhecida, ainda não corrigida

`detectRegime` (`MarketScoreEngine.ts:437`) só classifica `TENDENCIA` com
ADX>25 e `LATERAL` com ADX<18 — a faixa **18–25 vira `INDEFINIDO`, que não
satisfaz nem TREND nem RANGE**. Com o default `marketMode: 'TREND'`, essa faixa
é veto permanente. Não causou o silêncio de 04/08 (esse gate grava veto, e nada
foi gravado), mas está armada pra quando o dado voltar a fluir. Introduzida no
commit `6e319e485` às 10:14 de 04/08. **Decidir depois de ler o funil**, não
antes.
