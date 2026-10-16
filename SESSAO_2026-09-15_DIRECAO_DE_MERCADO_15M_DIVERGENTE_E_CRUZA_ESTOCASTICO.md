# Sessão 2026-09-15 — Direção de mercado (15m + DIVERGENTE + cruza do Estocástico), processo duplicado e kill-switch de execução real

## Contexto que motivou a sessão

Cleber reportou que o LLM Brain está perdendo dinheiro e suspeitou que a causa
raiz é a IA não estar lendo corretamente **pra que lado o mercado está indo**
— método dele: olhar o gráfico de 5 minutos (curto prazo), 15 minutos
(intermediário) e 1 hora (tendência do dia), igual um trader humano faria.

## 1. Diagnóstico do stop/alvo (não era isso)

Confirmado que o mecanismo de stop/alvo em si estava correto e não mudou:
- Stop = ATR × `mt5StopAtrMultiplier` (2,0x em dia útil, 1,5x fim de semana) —
  **mesmo valor de sempre**, independente do dropdown "Poucos/Médio/Muitos
  pontos" do Setup.
- Esse dropdown (`targetPoints`) só multiplica o **alvo** em cima do mesmo
  stop: POUCOS=1,5x, MÉDIO=3x (configuração atual do Cleber, desde
  2026-09-14 23:22 UTC), MUITOS=5x.
- Trailing pós-breakeven: 0,8x ATR até 1R de lucro, depois alarga pra 2,2x ATR.

## 2. Auditoria de trades reais (dado real via Supabase, sem inflar)

**Dia 09/09/2026 completo** (41 trades reais da IA, excluindo ordens
manuais/backfill): 36,6% de acerto, PnL líquido -$16,03, payoff 0,88:1.
SL puxou a maior parte do prejuízo; TP, quando bate, é 100% positivo mas só
acontece em ~13% dos trades.

**Últimos 14 dias (01/09→15/09, 430 trades)**: PnL líquido **-$167,56**,
acerto geral 43,7%. Por motivo de saída: TP 100% acerto (+$132,83, só 55
trades), SL 31,1% acerto (**-$236,29**, maior ralo — 68% do prejuízo total),
AI_SIGNAL (discricionário) 41,5% acerto (-$56,22). Conclusão honesta: o
gargalo real não é mecânica de stop/alvo, é **taxa de acerto direcional
baixa** — SL bate ~3,3x mais vezes que TP.

**7 trades de hoje (15/09)**, batendo com o print do Cleber (57,1% de
acerto, -$4,44 líquido): 2 dos 3 prejuízos (SPX500 -$1,29, BTCUSD -$2,20,
juntos -$3,49 dos -$4,44) entraram contra ou em divergência com a tendência
de 1H — confirmado no `indicators_snapshot` real, não suposição.

**Achado importante ao investigar esses 2 trades**: o `reasoning` gravado
mostrou que a IA **já via** o consenso de direção (`marketDirection`,
implementado no dia anterior) e tomou decisões *deliberadas*: o SPX500 foi
um setup de REVERSÃO declarado (Estocástico sobrevendido extremo + perto do
suporte), o BTCUSD foi um fechamento discricionário reconhecendo divergência
real entre 5m e 1H. Ou seja, o mecanismo de consenso já estava ativo e sendo
consultado — o problema não era "a IA está cega", era que (a) a exceção de
REVERSÃO estava solta demais e (b) quando o sinal é DIVERGENTE, o código só
avisava, nunca bloqueava.

## 3. Achado urgente e resolvido: processo duplicado + risco de execução real

Durante a investigação, achado que **dois processos do LLM Brain estavam
rodando em paralelo desde a noite anterior** (19:37 de 14/09 até 09:15 de
15/09): um antigo (`dist/index.js`, órfão de um build antigo, sem os fixes
de 14/09) e um novo (`tsx src/index.ts`, com os fixes). Mesmo padrão de bug
já catalogado várias vezes no histórico do projeto ("processo duplicado").
Confirmado `MT5_LIVE_EXECUTION_ENABLED=true` no `.env` — risco real, não
hipotético, se algum broker estivesse conectado.

**Ações tomadas, autorizadas pelo Cleber**:
1. Processo antigo (PID 75957) morto.
2. `MT5_LIVE_EXECUTION_ENABLED` mudado pra `false` no `.env` (kill-switch
   mestre desligado) — segunda camada de segurança além de
   `broker_credentials` já estar vazio (nenhuma corretora conectada).
3. Motor reiniciado (`./restart.sh`) pra aplicar os dois fixes.
4. Confirmado: **modo demo garantido**, nem o switch mestre está ligado,
   nem existe conexão real — a desconexão automática LIVE→DEMO já existe
   desde 2026-09-08 (lê `broker_credentials` a cada ciclo, cache 10s), sem
   precisar de mudança de código.

**Feedback registrado em memória**: Cleber pediu explicitamente pra eu NÃO
reiniciar o motor por conta própria daqui pra frente, mesmo com fix pronto e
testado — sempre perguntar antes. Memória salva:
`feedback_nao_reiniciar_llm_sem_pedir.md`.

## 4. As 4 mudanças de código implementadas (commit pendente, comando entregue ao Cleber)

Arquivos: `llm-active-brain/src/atr.ts`, `src/tools.ts`, `src/agent.ts`.
`tsc --noEmit` limpo, `npm run validate` 37/37.

1. **15 minutos como 3º voto no `marketDirection`** (`computeMarketDirection`
   ganha parâmetro `trend15m`) — agora o consenso combina 5m + 15m + 1H +
   momentum imediato + regime HMM, no espírito exato do método do Cleber.
2. **`DIVERGENTE` agora trava entrada** (antes só virava aviso em
   `get_mt5_quote`) — sinal dividido entre curto e longo prazo passa a
   exigir `setupType="REVERSAO"` com confirmação real, mesmo tratamento de
   um consenso claro contra o lado. Foi exatamente o buraco que deixou
   passar o BTCUSD que perdeu $2,20 no dia (marketDirection DIVERGENTE, sem
   trava nenhuma na hora).
3. **Estocástico extremo só confirma reversão depois da cruza real**
   (`crossing` das linhas %K/%D, campo que já existia em
   `SlowStochasticResult` mas nunca era exigido) — pedido direto do Cleber:
   "antes da cruza é loucura". Extremo prolongado sem nunca ter cruzado
   deixa de contar como confirmação, tanto no gate de contra-tendência
   quanto na lógica de `setupType="REVERSAO"`. Princípio 1m novo no prompt
   (`agent.ts`) ensina isso ao modelo, não só bloqueia.
4. **`marketDirection` e `setupType` agora são gravados em
   `ai_trades.indicators_snapshot`** — antes nenhum dos dois era
   persistido, impossível medir estatisticamente se seguir o consenso de
   direção correlaciona com resultado melhor. A partir de agora dá pra
   fazer essa query de verdade, com amostra acumulando.

**Sem validação estatística ainda** — mudanças aplicadas e motor reiniciado
às 09:26 de hoje, zero trades fechados sob o código novo até o fim desta
sessão (só 2 ciclos completos, 1 tentativa de `open_position`, 1 bloqueio —
nenhum dos dois pelas travas novas).

## 5. Investigação da queda de frequência de entradas

Cleber notou "está entrando menos" e pediu confirmação. Dado real (excluindo
manual/backfill): ritmo caiu de **2,02 entradas/hora** (14/09 tarde, antes
de qualquer trava nova) pra **0,93/hora** (14/09 noite → 15/09 manhã, depois
de várias travas de qualidade lançadas na mesma janela: contradição de
padrão de candle, exaustão extrema no %K bruto, `marketDirection` original).
**Confirmado que não é o `targetPoints=MÉDIO`** causando isso — esse campo
só multiplica o R:R, não trava nem restringe frequência no código.

Cleber pediu pra afrouxar uma trava, foi perguntado qual, e decidiu **não
mexer em nada por enquanto** — vamos só observar.

**Correção que precisei fazer durante a conversa**: cheguei a dizer "zero
entradas desde o restart, quase 4h atrás" — estava errado, eram só 14
minutos (2 ciclos). Corrigido na hora, registrado aqui por disciplina de
honestidade do projeto.

## 6. Explicação pedida: como a IA decide uma entrada, passo a passo

Documentado em detalhe na conversa (não repetido aqui por extenso) — resumo:
(1) `get_mt5_quote` traz todo o dado calculado em código; (2) o modelo
raciocina livre e propõe uma tese (`open_position` com `side`/`confidence`/
`setupType`); (3) a tese passa por ~12 travas mecânicas em sequência
(confiança mínima, elegibilidade do ativo, tetos de exposição, limite de
perda diária, coerência Estocástico↔lado, momentum imediato, consenso de
direção, confluência em contra-tendência, viés de candle, R:R mínimo,
duplicata, saldo/drawdown real se LIVE); (4) só passando por tudo isso abre,
com stop/alvo mecânicos e gerenciamento (breakeven/trailing) que também não
dependem mais do LLM depois disso.

## Pendências reais em aberto

- **Commit dos 3 arquivos** (`atr.ts`/`tools.ts`/`agent.ts`) — comando
  entregue ao Cleber, não commitado por mim (regra fixa do projeto).
- **Aguardar a primeira entrada real sob o código novo** — Cleber pediu
  explicitamente pra observar antes de mexer em qualquer coisa. Quando
  acontecer, trazer: ativo, lado, `marketDirection` no momento, `setupType`
  declarado, confiança, racional.
- **Sem validação estatística ainda** de nenhuma das 4 mudanças — precisa de
  amostra real rodando (mesma disciplina de sempre: dias/dezenas de trades
  antes de julgar efeito).
- Investigar, se a queda de frequência persistir depois de mais amostra, se
  vale afrouxar `DIVERGENTE` (aviso em vez de bloqueio) ou a exigência de
  cruza do Estocástico — Cleber decidiu não mexer por enquanto.
