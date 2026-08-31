# Sessão 2026-08-29 (noite) — Candle real destravado + price action honesto no LLM Brain

## Gatilho

Cleber reportou que a LLM do `llm-active-brain` está tomando decisões
equivocadas, "não sabe a hora de comprar ou vender", e pediu reforço de
fundamentos e princípios de day trade / price action no cérebro.

## Achado principal: `/mt5-candles` sempre devolvia dado FABRICADO (`SIMULATED`)

Investigação (não só reforçar o prompt, primeiro entender por que o dado de
base era fraco) achou a causa raiz: o endpoint `/mt5-candles`
(`supabase/functions/server/index.ts`) chamava
`/users/current/accounts/{id}/symbols/{symbol}/candles` no host de
**trading** da MetaAPI (`mt-client-api-v1`). Esse path não existe ali — a
MetaAPI sempre devolvia `404 NotFoundError` (confirmado ao vivo, batendo
direto no endpoint em produção), e o código caía silenciosamente no
fallback de candle sintético (`generateSimulatedCandles`).

O path correto é o de **historical market data**
(`/historical-market-data/symbols/{symbol}/timeframes/{tf}/candles`) no
host `mt-market-data-client-api-v1` — que `/mt5-candles-history` (usado no
backtest) já usava certo. Corrigido `/mt5-candles` pra usar o mesmo
host/path. Testado ao vivo pra os 8 ativos da cesta (BTCUSD, XETUSD,
SOLUSD, DOGUSD, DOTUSD, XRPUSD, XPTUSD, BTCXBN): todos passaram a trazer
candle real, nenhum mais cai em `SIMULATED`. Deploy feito pelo Cleber
(`supabase functions deploy server --no-verify-jwt`).

**Efeito além do LLM Brain**: qualquer parte do produto que dependa de
`/mt5-candles` (MACD, Estocástico, gráfico de candle real) deixa de estar
bloqueada por dado fabricado — impacto maior que só este agente.

## Reforço no `llm-active-brain`

- **`getSupportResistance` novo** (`llm-active-brain/src/atr.ts`): máxima e
  mínima reais das últimas ~2,5h de candle de 5min (mesma janela já
  buscada pra ATR/tendência/volume, sem fetch extra), distância % do preço
  até cada nível, e `nearLevel` (RESISTENCIA/SUPORTE/null) quando o preço
  está a menos de 0,15% de um deles. `null` quando candle real não
  disponível — nunca fabrica nível.
- Exposto em `get_mt5_quote` (`tools.ts`) como campo `supportResistance`.
- **Prompt** (`agent.ts`, princípio 1c novo): como combinar
  suporte/resistência + tendência + volume + extensão pra ler rompimento
  vs. rejeição de nível. **Deixado explícito, a pedido do Cleber, que isso
  é apoio ao julgamento, não lei nem bloqueio de código** — nenhum gatilho
  mecânico, é mais um fator de leitura junto dos outros.
- Comentários desatualizados em `tools.ts` que diziam "MACD/Estocástico
  impossível, `/mt5-candles` sempre SIMULATED" corrigidos — agora é
  possível implementar de verdade (não feito nesta sessão, fica como
  próximo passo se quiser indicador de exaustão mais forte que
  "extension").
- `npx tsc --noEmit` limpo.

## Reset de sessão de teste + limpeza de posições soltas

A pedido do Cleber ("Zero novamente pros cinquenta dólares iniciais" =
pedido pra reiniciar o teste, não um bug observado):

- Sessão `LLM_ACTIVE_BRAIN_MT5` anterior (`38669eeb...`) fechada e
  preservada como histórico (`final_balance`/`final_equity` ≈ $29,50 antes
  do fechamento manual das 2 posições ainda abertas).
- Sessão nova criada (`e7eef768...`) com `initial_balance`/`initial_equity`
  = $50, referenciando a anterior em `config.previous_session_id` (mesmo
  padrão dos resets anteriores do mesmo dia).
- As 2 posições que ficaram `OPEN` quando o processo foi encerrado
  (XPTUSD LONG, XETUSD LONG) foram fechadas manualmente ao preço real de
  mercado do momento (mesma fórmula de PnL do motor mecânico), com motivo
  registrado em `ai_reasoning` — capturado automaticamente pelo trigger de
  auditoria `ai_trades_audit_log` (antes/depois de qualquer `UPDATE`),
  então há rastro completo e verificável, sem indício de manipulação
  (preocupação levantada pelo Cleber e levada a sério: nenhum ajuste
  silencioso de resultado, preço real, fórmula real, motivo explícito).
- Importante: confirmado neste processo que o trilho MT5 do LLM Brain **não
  executa ordem real em corretora** — é 100% virtual (`ai_trades`), com
  preço real de mercado só pra marcação. Não havia risco de posição solta
  numa conta de verdade.

## Confirmado ao vivo após reiniciar o processo

Ciclo 1 da sessão nova mostrou exatamente o que devia:
- `list_open_positions` veio vazio (sessão limpa).
- `get_mt5_quote("BTCUSD")` e `get_mt5_quote("XETUSD")` vieram com
  `trend.source: "candle"` e `volume.source: "candle_volume"` (não mais
  `"tick"`/`"tick_momentum"`) e `supportResistance` preenchido com
  níveis reais e `nearLevel` calculado.
- Modelo já citou "suporte/resistência" no plano do ciclo antes mesmo de
  chamar a ferramenta — sinal de que o prompt novo está sendo lido.

## Pendências

- Commit dos 4 arquivos (`server/index.ts`, `atr.ts`, `tools.ts`,
  `agent.ts`) pronto, comando entregue ao Cleber, não aplicado ainda por
  Claude (regra fixa do projeto).
- MACD/Estocástico reais agora são viáveis (candle real disponível) mas
  não implementados nesta sessão.
- Acompanhar amostra de decisões dos próximos dias pra ver se
  suporte/resistência real muda a qualidade de entrada/saída de forma
  mensurável (sem essa validação, é só uma hipótese razoável, não um edge
  comprovado).

## Comando de acompanhamento

```bash
tail -f llm-active-brain/llm-brain.log
```

## Continuação — monitoramento ao vivo + 2 novos workstreams delegados

Depois do reinício, monitoramento manual de 7 em 7 minutos (pedido do Cleber)
confirmou, ciclo a ciclo:

- **Stop-loss mecânico funcionando corretamente**: DOTUSD LONG aberta e
  fechada por `SL` em menos de 1 minuto, `exit_reason` e preço reais
  confirmados direto no banco (`ai_trades`). Alarme inicial de "stop não
  disparou" foi falso-positivo meu (grep sem escopo de linha pegou entradas
  antigas de sessão já resetada) — corrigido no próprio monitoramento.
- **Achado real e não resolvido**: DOTUSD (e, com menor frequência, XPTUSD/
  BTCXBN) mostra spread bid/ask de **~10%**, com o `mt5Broker.ts` logando
  repetidamente `"devolveu o MESMO preco Nx seguidas -- possivel feed
  travado"`. Uma entrada LONG em DOTUSD nasceu com -9,46% só de spread e
  foi stopada quase instantaneamente — não é erro de tese do modelo, é
  input de preço ruim. Mesma pendência já registrada no `CLAUDE.md`
  ("XPTUSD com feed travado"), agora confirmada também em DOTUSD.
  **Decisão de tirar DOTUSD da cesta ainda pendente do Cleber** — perguntei
  2x, ele optou por seguir monitorando antes de decidir.
- **Sinal de qualidade positivo**: em pelo menos 2 ocasiões o próprio modelo
  reconheceu o spread quebrado do DOTUSD e decidiu ficar de fora sozinho
  (sem intervenção de código), e o bloqueio de código contra entrada
  contra-tendência sem volume elevado funcionou corretamente numa tentativa
  de SHORT em XRPUSD (modelo corrigiu sozinho para LONG a favor da
  tendência).
- **Bug real corrigido durante o monitoramento**: `toolDefinitions` em modo
  MT5 incluía TODAS as ferramentas do experimento legado (carteira ETH de
  testnet, "economia fictícia" simulada) — confirmado o modelo chamando
  `check_fictional_balance` e RACIOCINANDO sobre o saldo fictício ($3,51)
  como se fosse capital real de posição. Corrigido separando
  `commonToolDefinitions` (log_thought/stop) de `legacyToolDefinitions`
  (só no modo antigo). Commitado, processo reiniciado, confirmado que não
  voltou a aparecer nos ciclos seguintes.
- **Discussão de fundo com o Cleber**: esclarecido que a LLM **não aprende
  com os próprios erros** no sentido literal — cada ciclo começa com
  histórico de conversa zerado, `log_thought` grava no ledger mas nada é
  lido de volta no próximo ciclo. A melhora observada (evitar DOTUSD) veio
  de reforço de prompt nosso + o modelo reconhecendo o padrão no dado ao
  vivo daquele ciclo, não de memória de erro passado. Também alinhado que
  ML pra **decidir direção** já foi tentado e rejeitado por este projeto
  (busca sistemática sem edge comprovado, `AI_BRAIN_SPEC.md`) — ML só
  entra em previsão de volatilidade/tamanho de movimento, nunca direção.

### Pedido do Cleber (2026-08-29, fim da sessão): 2 agentes + 1 mecanismo de aprendizado

1. **Agente 1** — pesquisar a fundo e implementar previsão de
   **volatilidade/tamanho de movimento esperado** com ML, ligada à LLM do
   `llm-active-brain` (não decide direção, só ajuda a dimensionar
   stop/alvo/tamanho). Inclui também pesquisar e implementar um mecanismo
   de **memória de decisões passadas** (a LLM revisar resultado real de
   decisões recentes antes de decidir de novo, mesmo espírito do
   `decision-brain` que já existe pro Cérebro Analítico Sombra do motor
   mecânico, mas adaptado pro `llm-active-brain`) — é a resposta concreta
   pra "achar uma forma da AI aprender com seus erros e não repetir".
2. **Agente 2** — investigar e corrigir a causa raiz do feed
   quebrado/travado (DOTUSD confirmado, XPTUSD/BTCXBN suspeitos) que gera
   spread de ~10% e distorce qualquer decisão nesses símbolos.

Ambos rodando em background, em worktree isolado (não mexem no processo ao
vivo nem no meu monitoramento). Resultado chega como notificação separada
quando terminarem — nenhum código deles foi commitado/deployado
automaticamente (regra fixa do projeto).

## HANDOFF PRA PRÓXIMA SESSÃO — implementar o que o Agente 1 já desenhou

**Status**: Agente 1 (ML de volatilidade + memória de decisão) terminou, mas
rodou em modo só-leitura (sem Bash/Write) — entregou um relatório de
arquitetura completo e validado logicamente, **nada foi escrito em disco**.
Cleber decidiu implementar isso na próxima sessão. Tudo abaixo é o
suficiente pra implementar sem precisar re-pesquisar nada.

Agente 2 (correção do feed DOTUSD/XPTUSD/BTCXBN) ainda estava rodando em
background quando esta sessão terminou — checar se já notificou resultado
ao retomar; se sim, tratar aquele achado primeiro/junto (pode até já ter
corrigido o mesmo `mt5Broker.ts` que a Tarefa 2 abaixo toca de raspão).

### Parte A — ML de volatilidade: SEM veredito, não implementar ainda

Conclusão do Agente 1: histórico de candle real insuficiente pra validar
qualquer modelo hoje (cesta atual foi montada ontem, 2026-08-29; precisa
de ~7 dias mínimo pra EWMA, ~35 dias pra HAR-RV). Abordagem certa quando
houver dado: **EWMA → GARCH(1,1) → HAR-RV**, nesta ordem, cada degrau só
se justifica batendo o anterior com Diebold-Mariano — **nunca ML pesado
(LSTM/GBM) direto**, a literatura mostra ganho marginal/nulo sobre HAR-RV
pra este porte de dado, e seria repetir o erro que a busca de edge de
direção já pagou caro.

**Próximo passo real, antes de qualquer modelo**: rodar um script de
auditoria (`research/experiments/2026-08-30-volatility-forecast/scripts/
auditData.ts`, ainda não criado) que chama `/mt5-candles-history` (NUNCA
cai em SIMULATED, tem cache-aside em `ohlcv_data`) pra cada um dos 8
símbolos, janelas de 30/60/90 dias, **serial, nunca paralelo, ≥2s entre
chamadas** (conta MetaAPI compartilhada, risco de rate-limit documentado
no CLAUDE.md). Reporta cobertura real por símbolo. Efeito colateral bom:
isso já popula `ohlcv_data`, tornando a validação possível daqui a
algumas semanas. **Não pular direto pro modelo sem rodar isso primeiro.**

Contrato já fixado pra quando houver dado suficiente (não mudar sem
motivo):
```ts
// atr.ts -- reusa fetchRecentCandles, zero fetch novo
export interface VolatilityForecast {
  expectedRangePct: number;   // vol esperada na próxima 1h, fração do preço
  vsAtrRatio: number;         // vs ATR(14) atual: >1 expansão, <1 contração
  regime: "EXPANSAO" | "CONTRACAO" | "NORMAL";
  horizonMinutes: 60;
  source: string;             // "ewma" | "har" -- nunca "fallback"/"estimado"
}
```
Regras: `null` sempre que faltar candle real suficiente (nunca valor
aproximado); exposto em `get_mt5_quote` (tools.ts) ao lado de trend/
volume/extension/supportResistance; **`open_position` não muda uma
linha** -- stop/TP continuam vindo do ATR real, isso é só apoio ao
julgamento do LLM, mesmo espírito do princípio 1c.

### Parte B — Memória de trades: PODE implementar já (não depende de validação estatística)

Esta parte não afirma edge, só expõe fato real registrado — pode ser
feita sem esperar dado histórico.

**Passo 0 (fazer primeiro, é o que torna a memória útil a partir de
agora)**: hoje `closeMt5Position` (`neuralBridge.ts`, por volta da linha
464-477) SOBRESCREVE `ai_reasoning` com o motivo da saída, apagando o
motivo da entrada -- achado real do Agente 1, confirmado no código. Fix
sem migration:
```ts
// no SELECT que já existe antes do update (~linha 446), incluir ai_reasoning
const entryReasoning = String(trade.ai_reasoning ?? "").split(" || SAIDA: ")[0];
// no UPDATE:
ai_reasoning: `${entryReasoning} || SAIDA: ${params.reasoning}`,
```
`.split` idempotente evita crescer sem limite se reprocessado.

**Passo 1**: novo arquivo `llm-active-brain/src/tradeMemory.ts` (checar
com `ls` que não existe antes de criar, regra do CLAUDE.md). Query única
em `ai_trades` (`status='CLOSED'`, `order exit_time desc`, `limit 30`,
campos symbol/side/pnl/pnl_percentage/exit_reason/exit_time/
ai_reasoning), cache de 60s em módulo (mesmo padrão de `candlesCache` em
atr.ts -- ciclo é de 10s, sem cache seria 6x mais query que necessário).
Agrega por símbolo+lado (n, wins/losses, soma PnL, sequência de perdas
consecutivas mais recente). Formato compacto, teto DURO de ~350
tokens/1600 caracteres (ciclo tem até 25 iterações, cada uma reenvia o
histórico inteiro -- sem teto isso vira 5M+ tokens/hora). Exemplo de saída
pronto no relatório do agente (ver notificação da sessão anterior se
precisar do texto exato). Precisa expor de `neuralBridge.ts` um jeito de
pegar o client/session sem aumentar muito a superfície -- agente
recomendou um `getClosedTradesForMemory(limit)` dedicado em vez de
exportar o client cru.

**Passo 2**: em `agent.ts`, função `runAgent`, o `userMessage` do modo MT5
já é montado com `stopSummary` -- o bloco de memória entra na MESMA
mensagem de usuário (não no `GENESIS_PROMPT`, que é constante avaliada
uma vez):
```ts
let memoryBlock = "";
try {
  memoryBlock = (await getTradeMemoryBlock()) ?? "";
} catch { /* fire-and-forget: sem memoria e melhor que ciclo abortado */ }
userMessage = `Ciclo #${cycle}. Comece checando suas posicoes abertas.${stopSummary}` +
              (memoryBlock ? `\n\n${memoryBlock}` : "");
```
**Importante**: o `try/catch` não é decorativo -- uma exceção não
capturada aqui aborta o ciclo inteiro antes de qualquer decisão (mesma
causa raiz do bug de ledger corrompido de uma sessão anterior).

**Passo 3**: emendar o princípio 4 do `GENESIS_PROMPT_MT5` (agent.ts,
"Perder 2x seguidas é um sinal, não azar") com uma frase explicando o
bloco novo -- deixando claro que não é estatística validada, é registro
factual pra não repetir erro, e que "o preço está diferente agora" não é
razão nova o suficiente sozinha.

**Passo 4**: `npx tsc --noEmit` dentro de `llm-active-brain/`; confirmar
`npm run validate` na raiz não é afetado (llm-active-brain é projeto Node
isolado, fora do `tsconfig.engine.json`); observar 1-2h de log real
confirmando que o bloco aparece, medir crescimento real de token, e
confirmar que `ai_reasoning` composto está chegando no banco.

**Honestidade explícita pro Cleber ler de novo se precisar**: isso não é
aprendizado de máquina nem fine-tuning -- nenhum peso muda. É injeção de
contexto (o modelo passa a ler um resumo de fato que já estava no banco).
O efeito depende de o modelo prestar atenção ao bloco, e isso **não está
validado** -- validar seria possível (comparar taxa de reentrada em
símbolo+lado perdedor com/sem o bloco ao longo de dias), mas exige
amostra que ainda não existe. Registrar como pendência quando implementar,
não afirmar ganho sem medir.
