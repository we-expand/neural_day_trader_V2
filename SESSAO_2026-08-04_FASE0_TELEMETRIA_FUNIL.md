# Sessão 2026-08-04 (noite) — Redesenho do cérebro, Fase 0: telemetria de funil

## Contexto

Cleber deixou a AI Trader ligada das 13:20 às 17:54 BRT (~4h40), mercado
aberto, 12 ativos selecionados (redução manual feita na sessão das 13:23 pra
mitigar o rate-limit da MetaAPI). **Zero entradas.** Expectativa declarada:
~15 trades/dia. Pedido: identificar a causa e propor o cérebro eficaz.

## Diagnóstico — evidência, não hipótese

Consulta ao Supabase (`wyvdsxtcmizettljxtbg`):

| Métrica (sessão `2cff1634`, 16:20 UTC → 21:00 UTC) | Valor |
|---|---|
| Decisões em `ai_decisions` | **0** |
| Trades em `ai_trades` | **0** (último 13:56 UTC, sessão anterior) |
| `updated_at` da sessão | congelado no `started_at` (4h40 sem heartbeat) |
| Total histórico de `ai_decisions` | **9 linhas**, todas 14:34–14:39 UTC, todas ETHUSD |

Contra 88 trades no histórico de `ai_trades` — o diário de decisão
praticamente não registra nada desde que foi criado.

### O achado estrutural

O ciclo de `useApexLogic.ts` tinha **30 pontos de saída, dos quais só 15
gravavam veto**. O primeiro veto que persiste (`CONTEXT_SCORE_OPPOSITE`) só
acontece DEPOIS da avaliação da estratégia. Como nenhuma linha foi gravada em
4h40, ficou provado que o funil **nunca passou do estágio "a estratégia gerou
sinal"** — nem uma vez em ~10.000 avaliações (se o loop rodou na cadência
nominal de 5s × 3 ativos).

Qual das 15 saídas silenciosas matou o ciclo era **impossível de determinar**
com o banco existente. Esse é o problema nº 1: o sistema era cego exatamente
onde falhava.

### Seis defeitos estruturais mapeados

1. **Motor no navegador.** Não existe runner no servidor (`supabase/functions/`
   não tem ciclo de IA). É `setInterval` de 5s no React — aba em segundo plano
   no Chrome cai pra 1 tick/min após 5min; aba fechada = IA desligada. Não era
   possível nem confirmar nem descartar essa causa, por falta de heartbeat.
2. **Fonte de preço única e saturada.** O WebSocket Binance cobre 6 criptos
   hardcoded; todo o resto (GBPUSD, XAUUSD, SPX500) depende da conta MetaAPI
   **compartilhada entre todos os usuários**. Explica o padrão observado: as 9
   decisões que existiram foram todas ETHUSD, e os banners de dado
   indisponível eram GBPUSD/XAUUSD.
3. **Amostragem, não varredura.** O motor sorteia 3 ativos por tick e pergunta
   "tem sinal no último candle?". Sinal que dispara no candle N só é capturado
   se o sorteio cair naquela janela com o buffer (60s de validade) fresco.
4. **Cadeia AND serial de ~29 condições**, cada uma adicionada em sessão
   diferente, probabilidade conjunta nunca medida.
5. **Confiança fabricada.** Em `StrategyEvaluator.ts`, como todos os blocos de
   entrada precisam passar, `entryHits/activeEntry` é sempre 1 e a fórmula
   colapsa em `confiança = 80 + filtros×4` — mede quantos blocos foram
   configurados, não probabilidade de acerto. Depois o motor faz
   `min(estratégia, MarketScore)`, e o Score foi **42 nas 9 decisões, valor
   idêntico** (veto `CONTEXT_CONFIDENCE`). Inconsistência interna: o comentário
   do Context Gate declara que o Market Score foi *"medido e testado em
   holdout, sem poder preditivo"* — e ele é usado como veto duro três gates
   acima.
6. **Zona morta introduzida às 10:14 de hoje** (commit `6e319e485`).
   `detectRegime` só classifica TENDENCIA com ADX>25 e LATERAL com ADX<18 — a
   faixa 18–25 vira `INDEFINIDO`, que **não satisfaz nem TREND nem RANGE**. Com
   o default `marketMode: 'TREND'`, essa faixa é veto permanente. Não causou o
   silêncio de hoje (esse gate grava veto e nada foi gravado), mas está armada
   pra quando o dado voltar.

## Decisão de produto (Cleber, nesta sessão)

Apresentadas 4 rotas para a Fase 2. **Escolhida: medir a curva `k(t)`** — a
única pergunta científica ainda aberta na spec (14.7): como o edge bruto por
trade varia com o holding period. Hoje só existem 2 pontos (~42min positivo,
~39h negativo); a região de ~2,9h que a aritmética de custo aponta nunca foi
medida.

Orçamento e critério de corte, fixados ANTES de começar (exigência da própria
spec, seção 13.4):

| Item | Definição |
|---|---|
| Hipótese | Única (`k(t)`), sem varredura de parâmetros, sem penalidade de busca ampla |
| Região | 30min a ~6h |
| Amostra | `n` para 80% de poder, com desconto de independência medido (`N_eff/N = 0,259`) |
| Promoção | `CRITERIA.md`: DSR ≥ 95%, ≥100 sinais, holdout com embargo, custo real |
| Corte | Sem `k(t)` positivo significativo em nenhum ponto → alfa direcional encerrado **com prova**, produto vai pra rota de execução/disciplina sem reabertura |

Registro honesto da conversa: calibração ajusta a QUANTIDADE de trades, nunca o
SINAL da expectativa. Enquanto o sinal for indeterminado, "calibrar pra 15
trades/dia" é escolher pagar spread 15x/dia contra retorno não estabelecido.

## O que foi implementado (Fase 0)

Telemetria de funil + heartbeat. **Nenhum gate foi afrouxado nem removido** —
esta fase só torna o motor observável, condição pra qualquer calibragem
posterior deixar de ser chute.

- `supabase/migrations/014_ai_funnel_snapshots.sql` — tabela nova, com RLS.
  **Pendente de execução manual no SQL Editor.**
- `src/app/services/telemetry/FunnelTelemetry.ts` — contadores em memória com
  flush agregado a cada 60s.
- `src/app/hooks/useAIPersistence.ts` — mapa `veto → estágio de funil` no ponto
  único por onde todo veto passa; `getSessionId()` (leitura ao vivo do ref, já
  que `currentSessionId` congela no snapshot de render e devolveria `null`
  dentro do `setInterval`).
- `src/app/hooks/useApexLogic.ts` — instrumentação das saídas silenciosas,
  terminal de sucesso e efeito dedicado de desligamento.
- `tsconfig.engine.json` — telemetria entra no gate estrito.

### Três decisões de desenho que valem registro

1. **Contagem, não evento.** Uma linha por avaliação seriam ~51 mil linhas/dia
   por usuário. O caminho quente só incrementa inteiros; a rede é tocada 1×/min.
2. **O flush É o heartbeat.** A mesma escrita persiste o funil e atualiza
   `ai_sessions.updated_at`. Os dois sinais ou existem juntos ou faltam juntos.
3. **`ticks` é o instrumento principal.** Numa janela de 60s o esperado são 12
   ticks. Se vier 1, a aba estava em segundo plano e nenhum gate tem culpa —
   causa que até hoje não podia ser confirmada nem descartada.

Invariante `soma(stage_counts) = evaluations` é verificada a cada flush
(`assertClosed`) e grita no console quando não fecha — é o que impede um
caminho de saída novo de voltar a ser silencioso.

## Verificação feita

- `npx tsc -p tsconfig.engine.json --noEmit` → 0 erros.
- `npm run validate` → todas as asserções determinísticas passaram.
- Auditoria estática das saídas do ciclo: **30 de 30 instrumentadas, 0
  silenciosas** (antes: 15 de 30).
- **Não testado ao vivo.** Rodar a IA de verdade exigiria martelar a conta
  MetaAPI compartilhada em produção, contra a regra do projeto. A validação
  real da telemetria é a primeira sessão de mercado do Cleber com o código no ar.

## Pendências para a próxima sessão

1. Rodar a migration 014 no SQL Editor (SQL pronto, nunca aplicado por Claude).
2. Uma sessão de mercado com a IA ligada, depois ler `ai_funnel_snapshots` e
   determinar — **com número, não com hipótese** — onde os setups morrem.
3. Só então decidir o que ajustar. Fase 1 = ler o funil; a calibragem vem depois.
4. Fase 0 restante, ainda não implementada: circuit breaker por ativo (hoje um
   GBPUSD sem tick pode pausar tudo) e migração do runner pro servidor.
