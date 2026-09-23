# Pipeline Fail-Fast (teste novo, isolado)

Implementação do plano colado pelo Cleber em 2026-09-22: Chain of
Responsibility com 4 fases (State → Risk → Technical Scoring → LLM) +
sizing dinâmico por ATR, substituindo os hard-blocks booleanos do motor
atual.

**Ponto de referência do motor congelado**: tag git `freeze-llm-brain-2026-09-22`
(Ollama Qwen3.5, hard-blocks booleanos em `tools.ts`). Este diretório é
código novo, **não plugado em `index.ts`/`agent.ts`/`tools.ts` ainda** —
não afeta o processo em produção.

## O que está pronto

- `types.ts` — `TradeContext`, `PipelineStage`, `ValidationRejectException`.
- `stage1_state.ts` — calendário (`isSymbolTradable`), tick obsoleto (120s),
  spread (5%), janela de notícia de alto impacto (`getActiveHighImpactNewsWindow`).
- `stage2_risk.ts` — cesta permitida, direção travada, teto de entradas/24h
  (`getEntriesCountLast24h`), teto de posições por símbolo (5, valor real
  hardcoded hoje em `tools.ts`), exposição de grupo correlacionado
  (`getCorrelatedGroup`, teto `$2.700`).
- `stage3_technicalScoring.ts` — score 0-100 com os pesos do plano
  (consenso de direção 30, MACD 20, momentum/volume 15, estocástico 15,
  padrão de candle 20), usando os indicadores reais de `atr.ts`/`hmmRegime.ts`.
  Corte default 70 (`DEFAULT_SCORE_CUTOFF`).
- `llmJudge.ts` — novo papel do Ollama como "Juiz Final" (2026-09-23):
  system prompt novo, payload estruturado (symbol/direction/setupType/
  technicalScore/marketContext/proposedReasoning), schema JSON estrito
  (approved/confidence/rejection_reason/execution_recommendation/remarks),
  fallback seguro (`approved:false, "LLM Parse Error"`) se o JSON vier
  malformado -- nunca adivinha intenção nem trava o processo.
- `stage4_llmValidator.ts` — chama `judgeTradeWithLlm`; gate de confiança
  mínima (70% útil / piso de fim de semana + bônus de VIX) aplicado sobre
  a confiança que o próprio Juiz Final devolveu.
- `riskManager.ts` — `RiskManager.calculatePosition`/`updateTrailingStop`,
  matemática exata do plano (Risk$ = Capital×Risk%, SLdistance =
  ATR14×Multiplier, PositionSize = Risk$/(SLdistance×PointValue),
  Chandelier Exit pro trailing). ATR real vem de `getAtrAbsolute` (novo
  export em `atr.ts`, mesma fórmula Wilder/14 já usada em produção --
  antes só existia em `getAtrPercent`, sem versão em pontos).
- `pipeline.ts` — orquestrador fail-fast com logs granulares
  (`[REJECTED] Phase1-StateValidator - stale_tick - ...`).

## O que está PENDENTE antes de considerar isto pronto pra rodar com dinheiro real

1. **Não portado ainda** (estado vive em `Map`s privados não exportados de
   `tools.ts`): limite de perda diária (`dailyLossLimit`) e cooldown de
   perda em sequência (`mt5LossStreakThreshold`/`mt5LossStreakCooldownMinutes`).
   Precisa expor esse estado de `tools.ts` (ou migrar de vez) antes do
   pipeline poder rodar sozinho em paralelo ao motor antigo sem duplicar/
   perder proteção.
2. `stage3_technicalScoring.ts` usa pesos e combinações (ex: "consenso
   parcial vale metade do peso") que **não vieram testados estatisticamente**
   — são a tradução direta do que o plano pediu, sem validação com dado
   real. Mesma disciplina do resto do projeto: não declarar edge sem
   amostra (ver CLAUDE.md, seção "Cérebro de decisão da IA").
3. `stage4_llmValidator.ts`/`llmJudge.ts` fazem sua PRÓPRIA chamada de
   LLM (Ollama) -- ainda não está conectado ao loop principal de
   `agent.ts` (que hoje é quem decide abrir posição e gera o reasoning
   original). Rodar isto em paralelo ao motor congelado significaria HOJE
   uma 2ª chamada de LLM por trade candidato (custo de inferência
   dobrado) -- decidir com o Cleber se o pipeline novo substitui o loop de
   decisão inteiro de `agent.ts` ou só valida depois, antes de ligar.
4. `riskManager.ts` não está integrado a `mt5Broker.ts`/`liveExecution.ts`
   (execução real) nem ao `LOT_SIZE`/especificação de contrato real por
   símbolo (`assetBasket.ts`/`infinoxContractSpecs.ts`) — hoje só calcula
   lotes a partir de `pointValue`/`lotStep`/`minLotSize` passados como
   parâmetro. `updateTrailingStop` (Chandelier Exit) também não está
   plugado em nenhum watchdog de posição aberta ainda (o motor congelado
   tem o próprio mecanismo de breakeven/trailing em `neuralBridge.ts`,
   não afetado por este módulo).
5. Nenhum teste automatizado ainda (`npm run validate` do projeto cobre o
   motor antigo, não este diretório).
6. Ninguém decidiu ainda COMO este pipeline vai substituir o loop atual em
   `index.ts`/`agent.ts` — via feature flag, sessão separada, ou troca
   direta. Decisão do Cleber antes de qualquer wiring em produção.

## Próximo passo sugerido

Não ligar isto no motor rodando ainda. Escrever testes unitários pra cada
fase com casos reais extraídos do `llm-brain.log` (mesmo padrão de
`npm run validate`), portar os 2 itens pendentes do item 1, e só depois
decidir o mecanismo de wiring com o Cleber.
