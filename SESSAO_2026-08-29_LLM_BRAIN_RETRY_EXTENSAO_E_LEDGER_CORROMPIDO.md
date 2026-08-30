# Sessão 2026-08-29 — LLM Brain: ledger corrompido, retry de cotação, proxy de exaustão ("extension")

## Contexto

Cleber reportou que o `llm-active-brain` "não estava abrindo posições".
Sessão longa (múltiplos ciclos de investigação e monitoramento ao vivo),
com 3 achados reais distintos e correções aplicadas em produção local.

## Achado 1 — Ledger corrompido por processos duplicados (raiz do "não abre posição")

`ledger/actions.json` tinha **dois arrays JSON colados** (6871363 bytes do
primeiro array + sobra de outro processo escrevendo em paralelo) — todo
`appendLedger()` (que faz `readLedger()` primeiro) quebrava com
`Unexpected non-whitespace character after JSON`, e esse erro abortava o
ciclo inteiro **antes** de qualquer lógica de decisão/abertura de posição.
Causa: `ledger.ts` faz read-modify-write não atômico; com múltiplos
processos vivos (mesmo padrão de duplicidade já visto em sessões
anteriores) escrevendo o mesmo arquivo, um sobrescreve o outro no meio.

**Correções aplicadas** ([src/ledger.ts](llm-active-brain/src/ledger.ts) não
mudou a lógica de escrita, mas):
- Ledger reparado (extraído o primeiro array JSON válido, 6709 entradas,
  backup do arquivo corrompido salvo).
- **Trava de instância única** adicionada em
  [src/index.ts](llm-active-brain/src/index.ts) (`llm-brain.pid`) — um
  segundo processo que tente subir com o primeiro ainda vivo morre
  imediatamente em vez de competir pelo ledger. `llm-brain.pid` adicionado
  ao `.gitignore`.

Commit: `b5c78cbdd`.

## Achado 2 — `open_position` falhava em soluço transitório de rede, sem retry

Com o ledger corrigido, confirmado por leitura direta do log: o agente
tentou abrir LONG em DOGUSD e recebeu `"Sem cotacao real disponivel agora
para DOGUSD -- posicao nao aberta."` **mesmo tendo acabado de receber uma
cotação válida do mesmo símbolo segundos antes**. Causa:
`getQuote()` ([src/mt5Broker.ts](llm-active-brain/src/mt5Broker.ts)) fazia
**uma única tentativa** de fetch contra o endpoint MetaAPI compartilhado
(risco crônico já documentado no `CLAUDE.md` — rate-limit/504 sob carga);
`open_position`/`close_position` chamam essa função de novo internamente,
não reaproveitam a cotação que o LLM já tinha visto.

De carona: o próprio modelo se confundiu com esse erro isolado (achou, por
um instante, que talvez precisasse de volume "elevated" mesmo pra entrada A
FAVOR da tendência — falso, a regra 2 do prompt só exige isso pra entrada
CONTRA a tendência) e ficou paralisado por vários ciclos em vez de só tentar
de novo. Isso é comportamento do modelo, não bug de código — não foi
"corrigido", só ficou registrado como padrão a observar.

**Correção aplicada**: `getQuote()` agora tenta até 3x com backoff
(500ms/1s) antes de desistir.

Commit: `437454e1f`.

**Resultado observado ao vivo após o fix**: 5 tentativas de `open_position`
consecutivas, 5 sucessos (BTCUSD, DOGUSD, XETUSD, XRPUSD, DOTUSD) — zero
erros de cotação desde então. Confirma que o retry resolveu o gatilho real.

## Achado 3 — Entrada ruim em XETUSD (comprou "esticado") + limite real de indicadores

Cleber apontou, com razão, uma entrada LONG em XETUSD com preço já longe
das médias, Estocástico quase cruzando pra venda, MACD com exaustão clara
na compra — sinais que o sistema **não tinha como enxergar**.

Investigado e confirmado ao vivo: `/mt5-candles` (endpoint de candle OHLC
oficial) devolve **`source: "SIMULATED"`** (dado fabricado — preço em
~100 em vez do XETUSD real ~2453) em produção pra esta cesta. MACD e
Estocástico de verdade **exigem** OHLC real de candle — construí-los em
cima de candle fake seria inventar precisão que não existe, contra a
convenção fixa do projeto de nunca fabricar dado. Esse mesmo achado já
estava documentado em comentários de `atr.ts`/`tickHistory.ts` de sessões
anteriores (trend/volume também dependiam desse endpoint e caíam pro
fallback de tick real por causa dele) — hoje confirmei que o problema
persiste ao vivo.

**O que foi possível entregar com integridade** (dado 100% real, sem
depender do candle quebrado): novo campo `extension` em `get_mt5_quote` —
distância % do preço em relação à média do **próprio histórico real de
tick** do processo (`getPriceExtension` em
[src/tickHistory.ts](llm-active-brain/src/tickHistory.ts)), rotulado
`ESTICADO_ALTA`/`ESTICADO_BAIXA`/`NORMAL`. É mais fraco que uma média móvel
de candle de verdade (janela mais curta, sem OHLC), mas nunca fabricado.
Prompt do agente ([src/agent.ts](llm-active-brain/src/agent.ts), novo
princípio 1b) instruído a usar isso como fator de cautela antes de comprar
a favor de uma alta já esticada — julgamento do agente, não bloqueio
mecânico (mesmo motivo histórico do projeto pra não hard-codar reversão por
RSI/Estocástico: já testado e rejeitado com dado real no motor mecânico
principal, ver seção "Cérebro de decisão" do `CLAUDE.md`).

**Pendência real, fora do escopo desta sessão**: por que `/mt5-candles`
cai em SIMULATED enquanto `/mt5-prices` funciona com dado real (mesmo
token) — provável falha na descoberta de conta MT5 que só a rota de
candles faz. Mexe na Edge Function principal compartilhada
(`supabase/functions/server/index.ts`), não no `llm-active-brain` — não
alterado nesta sessão, fica registrado pra investigação futura. Enquanto
não for corrigido, MACD/Estocástico reais continuam impossíveis de
implementar honestamente nesta cesta.

Commit: pendente (`src/agent.ts`, `src/tickHistory.ts`, `src/tools.ts`).

## Achado 4 (discussão, sem mudança de código) — risco por trade ($3+ de stop, esperava $1)

Cleber questionou por que um stop estava deixando a perda chegar a ~$3
quando esperava ~$1. Matemática confirmada com o trade real de XETUSD:
`stop_pct` dinâmico (ATR) estava em 0,400% sobre $1.200 de exposição
("normal" de hoje) = risco máximo ~$4,80 — coerente com o observado, não é
bug.

Explicado que **não dá pra isolar o "apertar o stop" sem mexer no
tamanho**: o spread sozinho no trade de XETUSD já custava ~0,105% do preço
(~$1,27 em $1.200) — maior que o próprio orçamento de $1 que se queria como
teto. Um stop de 0,083% (necessário pra caber $1 em $1.200) ficaria **mais
apertado que o spread**, o que faria a posição nascer "atrás" do stop e
tomar stop por ruído normal de bid/ask quase sempre. O piso de segurança já
existente no código (`mt5StopMinPct = 0,2%`) evita isso — mas mesmo nesse
piso mínimo, o risco em $1.200 de exposição é ~$2,40, não $1.

**Decisão do Cleber**: manter o número de contratos/exposição como está
($1.200 "normal"). Nenhuma mudança de código feita nesse ponto — ele
decidiu deixar a operação em curso acontecer e observar se a entrada
melhorou com o fix de `extension` antes de mexer em sizing.

## Estado ao final da sessão

Processo único rodando (reiniciado por último às ~21:14 UTC, depois do fix
de `extension`), ledger válido, sem posições travadas. `extension` ainda
`null` nos primeiros ciclos pós-restart (precisa acumular histórico de tick
real, mesmo padrão documentado pro `trend`/`volume`).

## Pendências reais em aberto

1. Investigar por que `/mt5-candles` cai em SIMULATED (Edge Function
   principal, fora do `llm-active-brain`) — bloqueia MACD/Estocástico reais.
2. `XPTUSD` com feed travado no mesmo preço por 24+ ciclos numa checagem
   desta sessão — nunca abriu posição, candidato a tirar da cesta se
   persistir (sinal de falta de liquidez/feed morto nesse símbolo
   específico, não investigado a fundo ainda).
3. Commit pendente dos arquivos do Achado 3
   (`src/agent.ts`/`src/tickHistory.ts`/`src/tools.ts`).
4. Avaliar depois de mais amostra se `extension` de fato reduziu entradas
   tipo "comprar topo esticado" (sem validação estatística ainda — só
   implementado e observado por poucos ciclos).
