# Sessão 2026-09-23 — Congelamento do motor atual, pipeline Fail-Fast (teste isolado) e modo diagnóstico

## Contexto e pedido do Cleber

Cleber quis congelar a configuração atual do LLM Brain (Ollama Qwen3.5,
hard-blocks booleanos) pra testar uma proposta arquitetural diferente,
colada de uma conversa com o Gemini: migrar `open_position` pra um
**pipeline Fail-Fast** (padrão Chain of Responsibility, 4 fases) com
**Position Sizing dinâmico via ATR** e um **Sistema de Scoring** no lugar
de parte dos hard-blocks técnicos.

## 1. Congelamento do estado atual

Tag `freeze-llm-brain-2026-09-22` criada apontando pro estado do motor
ANTES de qualquer mudança desta sessão (Ollama Qwen3.5, hard-blocks
booleanos intactos). Pra voltar: `git checkout freeze-llm-brain-2026-09-22`.

**Incidente no caminho**: o primeiro `git add -A` incluiu
`llm-active-brain/.env.bak-20260922`, que tinha uma **API key da Groq em
texto puro** — o GitHub bloqueou o push (push protection). Cleber
rotacionou a chave; o commit foi desfeito (`git reset --soft`), o `.bak`
removido do stage, `*.env.bak*` adicionado ao `.gitignore`, e o commit
refeito limpo. Tag recriada no commit limpo, push ok.

## 2. Pipeline Fail-Fast — implementado como módulo NOVO e ISOLADO

Diretório novo `llm-active-brain/src/pipeline/`, **não plugado no motor
em produção** (o `agent.ts`/loop principal continua decidindo como
sempre) — só código novo, testável e revisável antes de qualquer troca
real de comportamento:

- `types.ts` — `TradeContext`, `PipelineStage`, `ValidationRejectException`.
- `stage1_state.ts` — calendário, tick obsoleto (120s), spread (5%),
  janela de notícia de alto impacto.
- `stage2_risk.ts` — cesta, direção travada, teto de posições (5,
  hardcoded hoje em `tools.ts`), exposição de grupo correlacionado
  ($2.700), **e as 2 proteções portadas depois** (limite de perda diária,
  cooldown de perda em sequência) — usando as MESMAS funções já
  exportadas de `neuralBridge.ts` (backed em DB), sem estado privado.
- `stage3_technicalScoring.ts` — score 0-100 (consenso 30/MACD 20/momentum
  15/estocástico 15/candle 20), corte 70 — **implementado mas NUNCA
  ligado como gate real**, ver seção 4 abaixo (decisão consciente).
- `llmJudge.ts` + `stage4_llmValidator.ts` — Ollama como "Juiz Final",
  novo prompt/schema JSON estrito do plano do Cleber, reutiliza o mesmo
  client/config do validador semântico já em produção.
- `riskManager.ts` — `RiskManager.calculatePosition`/`updateTrailingStop`,
  matemática exata (ATR Wilder já existente no motor via novo export
  `getAtrAbsolute` em `atr.ts`, Position Sizing, Chandelier Exit).
- `pipeline.ts` — orquestrador fail-fast, logs granulares
  `[REJECTED]`/`[OK]`.
- `telemetry.ts` — helper de log `[OK]`/`[REJECTED]`/`[SHADOW-REJECTED]`.
- `README.md` do módulo — lista honesta do que está pronto vs pendente.

`tsc --noEmit` limpo, `npm run validate` sem regressão em toda a sessão
(as 3 falhas que aparecem são pré-existentes, `Dynamic require of "stream"`
em scripts de validação não relacionados, confirmado antes de qualquer
mudança).

**Commit já rodado pelo Cleber**: `6efcee6d6` — pipeline completo, isolado.

## 3. Decisão de risco: NÃO substituir os hard-blocks técnicos ainda

Ao tentar plugar a Fase 3 (score substituindo os 4 gates técnicos:
MACD/momentum/consenso/estocástico) de verdade em `tools.ts`, achado
real: essas regras não são genéricas — cada uma nasceu de um **incidente
real documentado** (datas e prejuízo específicos, ex: XETUSD -$3,55 em
22/09 por ignorar virada do MACD). O CLAUDE.md do projeto já registra que
um corte parecido de mecânica em 2026-09-04 derrubou o acerto de 80% pra
33% no mesmo dia.

**Decisão do Cleber, depois de eu expor esse risco**: manter as 4 travas
técnicas como estão, plugar só telemetria (instrumentação, sem mudar
decisão) nos gates de Fase 1/2/4 em `tools.ts` primeiro, testar em modo
observacional antes de considerar substituir qualquer trava por scoring.

## 4. Instrumentação real em `tools.ts` (produção) — só logging, zero mudança de decisão

Adicionado `logPipelineReject`/`logPipelineOk` (formato `[OK]`/`[REJECTED]
PhaseN-... - regra - símbolo - detalhe`) em **8 pontos de rejeição já
existentes** em `open_position` (`tools.ts`), confirmado por diff que é
puramente aditivo (nenhuma linha de lógica removida/alterada):
notícia de alto impacto, gate de confiança mínima, cesta, direção
travada, limite de perda diária, cooldown de perda em sequência, e os 4
gates técnicos (MACD 5m, padrão REVERSAO obrigatório, momentum imediato,
consenso de direção, contradição estocástico-REVERSAO, estocástico bruto
extremo). Log de `[OK] Phase4-LLMValidator` no ponto real de aprovação
final (logo antes da checagem de execução real).

Commit rodado pelo Cleber cobrindo essa instrumentação + o port de
daily-loss/cooldown pro `stage2_risk.ts`.

**Restart #1** (00:23:29, PID 93795) — motor volta com telemetria ativa,
comportamento de decisão 100% intocado.

## 5. Monitoramento de 5 em 5 minutos (loop ativo durante a sessão)

Ciclo 1 (00:23-00:34): 9 ativos avaliados (cesta 100% Ásia: BTCUSD,
SPX500, HKG33, CHINA50, JPN225, AUS200, USDTWD, USDSGD, XAUJPY), regime
HMM `CONSOLIDACAO_BAIXA_VOL` dominante. IA decidiu **zero entradas**,
raciocínio identificou contradições reais entre indicadores (ex: BTCUSD
com marketDirection ALTA 4/4 mas Estocástico sobrecomprado 91,19% —
"cenário de alta com exaustão iminente", corretamente não operado).

Ciclo 2 (00:34-...): **primeiro evento de open_position real** — IA
tentou abrir **USDTWD LONG** 2x seguidas, citando rompimento confirmado +
volume elevado + MACD virando + candle MARUBOZU_ALTA. Ambas rejeitadas
pelo gate "mercado LATERAL exige ≥2 fatores reais" (só havia 1: volume).
Na 2ª tentativa, a IA tentou reformular pra justificar um 2º fator
(candle pattern) — o código recalculou e viu de novo só 1 fator técnico
válido, **não deixou passar por insistência/reformulação de texto**.

**Achado de cobertura**: esse gate específico (LATERAL ≥2-fatores) e o
gate irmão (contra-tendência ≥2-fatores) **não tinham telemetria** — só
os 4 gates originalmente identificados no plano do Cleber tinham log.
Corrigido na Fase 6 abaixo.

Nenhum estouro de teto de tokens detectado em nenhum ciclo (`finish_reason`/
`completion_tokens` já instrumentado nativamente em `agent.ts` desde
2026-09-04 -- zero ocorrências no log desta sessão). Processo único
confirmado em toda checagem, sem duplicata.

## 6. Modo diagnóstico — desliga os 8 gates de julgamento técnico (shadow-log)

Pedido do Cleber: "eliminar as travas pra ver como ela se comporta, saber
se ela é boa mesmo ou se é besta". Escopo acordado explicitamente com
ele (2 perguntas feitas antes de mexer): só os gates de **julgamento**
técnico, gates de **proteção de capital/integridade de dado** continuam
intocados; e manter shadow-log (loga o que teria bloqueado, nunca
silencioso).

Confirmado antes de tocar em qualquer trava: `MT5_LIVE_EXECUTION_ENABLED=false`
no `.env` — sessão é 100% DEMO, dinheiro nenhum em risco real.

**Flag novo**: `MT5_DIAGNOSTIC_TECHNICAL_GATES_DISABLED` (`config.ts`,
default `false`). Quando `true`, os 8 gates (MACD 5m, padrão REVERSAO
obrigatório, momentum imediato, consenso de direção, contradição
estocástico-REVERSAO, estocástico bruto extremo, LATERAL ≥2-fatores,
contra-tendência ≥2-fatores) logam `[SHADOW-REJECTED (bypassed)]` em vez
de bloquear. Um dos 8 (`reversao_pattern_required`) precisou de
reestruturação cuidadosa -- o código downstream fazia non-null assertion
(`!.patternCandleTimestamp`) assumindo que o padrão de candle existia;
separado em 2 blocos (`if (... && flag)` sem `!`, `if (... && !flag)` com
a lógica original intacta) pra não quebrar em runtime quando não há
padrão detectado.

`tsc --noEmit` limpo, `npm run validate` sem regressão. Diff revisado
(131 inserções/51 remoções em `tools.ts`, todas estruturais pra acomodar
o branch do flag, lógica original preservada byte a byte no branch
`else`).

**Ligado no `.env`** (`MT5_DIAGNOSTIC_TECHNICAL_GATES_DISABLED=true`,
comentário explicando o motivo e quando desligar) e **restart #2**
(00:51:23, PID 1778) — motor rodando agora com os 8 gates técnicos
desligados, sessão DEMO, tudo shadow-logged.

## Pendente real

- **Commit desta última rodada** (modo diagnóstico: `config.ts`,
  `pipeline/telemetry.ts`, `tools.ts`) — comando entregue ao Cleber,
  ainda não rodado até o momento em que este arquivo foi escrito.
- **Decidir quando desligar o modo diagnóstico** — não tem critério de
  parada definido ainda (nem tempo, nem nº de trades). Recomendação dada
  ao Cleber: não deixar rodando indefinidamente sem critério, mesmo em
  DEMO.
- Pipeline Fail-Fast (`llm-active-brain/src/pipeline/`) continua **não
  plugado em produção** — é código isolado, testável, aguardando decisão
  de como (e se) substitui o loop de decisão atual. Ver `README.md` do
  módulo pra lista completa de pendências técnicas (daily-loss/cooldown
  já portados; falta integrar sizing por ATR à execução real, decidir
  mecanismo de wiring com `agent.ts`).
- Gap de telemetria dos 2 gates de confluência (LATERAL/contra-tendência)
  ficou coberto nesta mesma sessão (seção 6), não é mais pendência.
- Resultado real do teste (win rate, payoff, drop-off por fase) ainda sem
  amostra suficiente — só 1 evento de rejeição observado até o momento
  deste handoff. Monitoramento de 5 em 5min segue ativo.

## Arquivos tocados

`llm-active-brain/src/pipeline/*` (novo), `llm-active-brain/src/atr.ts`
(export `getAtrAbsolute`), `llm-active-brain/src/tools.ts` (telemetria +
modo diagnóstico), `llm-active-brain/src/config.ts` (2 flags novos),
`llm-active-brain/.env` (flag de diagnóstico ligado).
