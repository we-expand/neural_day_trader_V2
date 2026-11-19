# Sessão 2026-09-01 (continuação) — Monitoramento ao vivo do Cérebro LLM Ativo, 2 travamentos reais corrigidos, primeiras entradas do dia

## Resumo em 1 parágrafo

Continuação da sessão de migração pra Ollama local (ver
[SESSAO_2026-09-01_NVIDIA_APOSENTADA_OLLAMA_LOCAL_E_ZUMBIS.md](SESSAO_2026-09-01_NVIDIA_APOSENTADA_OLLAMA_LOCAL_E_ZUMBIS.md)).
Cleber pediu monitoramento contínuo de 5 em 5 min pra ver se o motor
(Qwen3.5 4B local) chegava a abrir alguma posição. Depois de ~2h e 37
ciclos sem nenhuma entrada, 2 travamentos reais do processo foram
encontrados e corrigidos ao vivo — um na camada de retry de cotação
(`tools.ts`), outro na ausência de timeout na chamada ao Ollama
(`agent.ts`), esta última bem mais grave (podia travar o motor até 10min
por chamada, sem aviso). Depois das correções, o motor abriu as primeiras
3 posições do dia (XETUSD, EURUSD, SPX500, todas LONG) — XETUSD já foi
fechada com pequena perda, EURUSD e SPX500 seguiam abertas ao fim da
sessão. Nenhum commit foi feito (regra fixa do projeto) — 2 diffs prontos
esperando o Cleber rodar.

## Estado exato ao final da sessão (pra retomar sem re-investigar)

- **Processo**: rodando via `watchdog.sh`, reiniciado pela última vez às
  20:08 (horário local) já com as 2 correções desta sessão aplicadas.
- **Posições abertas**: EURUSD LONG (`f3180eb7-...`, entrada $1,15957) e
  SPX500 LONG (`3a99fa5f-...`, entrada $7.641,11) — ambas com R:R 1:2,
  stop/alvo mecânicos ativos.
- **Posição já fechada**: XETUSD LONG (`b9ebb0f5-...`), fechada
  discricionariamente perto do stop, ~-0,4% de perda pequena.
- **2 correções aplicadas no código, rodando ao vivo, NÃO commitadas** —
  comandos prontos na seção "Comandos prontos" abaixo.

## Achados reais, em ordem cronológica

### 1. Confirmado: zero entradas por ~2h não era bug de decisão

Auditoria de código (`tool_choice: "required"` em `agent.ts:558`) confirmou
que o motor não estava travado nem ignorando a regra — ele genuinamente
parava de chamar ferramentas depois de avaliar a cesta inteira, o que o
código interpreta corretamente como "decidiu não operar". O mercado estava
majoritariamente LATERAL/NEUTRO nos 9 ativos durante esse período. Não foi
necessário nenhum fix pra esse comportamento em si.

### 2. Bug real #1: retry duplicado em `get_mt5_quote` (tools.ts)

`mt5Broker.getQuote` já retry 3x internamente (8s de timeout cada). Por
cima disso, `tools.ts` tinha MAIS 2 tentativas (5 no total). Confirmado ao
vivo: um ciclo travou ~10min numa única chamada de `XAUUSD` enquanto o
endpoint `/mt5-prices` (MetaAPI compartilhada) respondia devagar (testado
direto: 20s de resposta, `"error":"HTTP 504"` real da corretora — risco
crônico já documentado no CLAUDE.md, não bug de código). **Fix**: removida
a camada de retry duplicada — pior caso cai de ~5 tentativas pra 3.

### 3. Bug real #2 (o mais grave): sem timeout na chamada ao Ollama (agent.ts)

O client OpenAI (`new OpenAI({...})` em `agent.ts:334`) não tinha `timeout`
configurado — o SDK usa o default de **10 minutos por chamada**. Confirmado
ao vivo pela segunda vez: processo ficou 15min+ sem produzir nenhuma linha
de log; investigando, o próprio Ollama (`localhost:11434/api/tags`) não
respondia nem a um teste trivial, com o `llama-server` preso processando
havia 36min de CPU acumulado. Ou seja, quando o Ollama local trava/satura,
o motor inteiro fica mudo por até 10min sem tentar de novo e sem ninguém
perceber. **Fix**: `timeout: 90_000` (90s) adicionado ao client — generoso
sobre o pior caso real já medido (~30-58s numa chamada fria), mas falha
rápido o bastante pro catch de ciclo já existente (`index.ts:149`) logar e
seguir pro próximo ciclo em vez de travar silenciosamente.

### 4. Primeiras 3 entradas do dia, depois das correções

**Ciclo 5**: XETUSD LONG — entrada $2.414,92, SL $2.402,85, TP $2.433,03.
Confluência: tendência LATERAL + padrões de reversão de alta (HARAMI_ALTA
+ DOJI) + MACD neutro com histograma positivo.

**Ciclo 10**: EURUSD LONG (entrada $1,15957) e SPX500 LONG (entrada
$7.641,11) — ambas com volume real elevado (>1.8x) como confirmação.
Nestas duas entradas apareceu `[reasoningValidator] erro na validação
semântica -- deixando passar (fail-open): Request was aborted` — o
validador de contradição reasoning↔ação está falhando (timeout/abort
contra o Ollama) e, por design, deixa passar sem bloquear. Não impediu
nada, mas essa camada de proteção não está checando de verdade agora —
**observar se persiste, investigar se virar padrão**.

**Ciclo 15**: XETUSD fechada discricionariamente (perto do stop, MACD
virou baixista) — pequena perda (~-0,4%). Logo depois, tentativa de
fechar EURUSD também foi **bloqueada pela trava de fechamento prematuro**
(posição só tinha percorrido 4% do caminho até o stop) — confirma que essa
proteção (documentada em sessões de 2026-08-30) continua funcionando.

### 5. Achado de infraestrutura (não é bug): degradação ampla da MetaAPI

Em pelo menos 2 momentos da sessão, múltiplos símbolos simultâneos (GER40,
SPX500, NAS100, e depois quase toda a cesta num restart) caíram em
fallback (`stale: true`, preço `$1.0` ou último conhecido) por lentidão do
lado da corretora, não do código. Isso é o mesmo risco crônico já
documentado no CLAUDE.md ("conta MetaAPI compartilhada sujeita a
rate-limit/504") — a otimização do item 3 acima reduz o dano (motor não
trava mais minutos), mas não resolve a causa (fora do controle deste
projeto).

## Pendências reais pra próxima sessão

1. **Commit pendente** (2 fixes desta sessão, comando pronto abaixo) —
   `tools.ts` (retry duplicado) e `agent.ts` (timeout de 90s).
2. **Observar EURUSD e SPX500** até fecharem (stop/alvo mecânico ou nova
   decisão discricionária) — nenhuma ação pendente, só acompanhar.
3. **`reasoningValidator` em fail-open recorrente** (`Request was
   aborted`) — não bloqueou nada ainda, mas a camada de proteção contra
   contradição reasoning↔ação não está validando de verdade. Se isso virar
   padrão constante (não só ocasional), vale investigar se o timeout do
   próprio validador (chamada separada ao Ollama) também precisa de ajuste,
   ou se está competindo por recurso com a chamada principal do ciclo.
4. **Cleber perguntou "meu computador tem que ficar aberto pra IA
   funcionar?"** — resposta dada ao vivo: SIM, desde a migração pra Ollama
   local (diferente de antes, quando o LLM rodava na nuvem via
   NVIDIA/Groq). Se fechar/dormir o Mac, o Ollama para e o motor para
   junto. Decisão de manter assim ou reconsiderar cloud fica em aberto.
5. **Watch geral**: o timeout de 90s é uma escolha de compromisso — se
   aparecerem timeouts falsos-positivos frequentes (chamadas legítimas que
   just demoram mais que 90s com prompt grande), pode precisar de ajuste
   pra cima; se o Ollama continuar saturando com frequência, o problema de
   fundo é capacidade de hardware local pro modelo escolhido, não o
   timeout em si.

## Comandos prontos

Commit dos 2 fixes desta sessão:
```bash
cd /Users/clebercouto/Projects/we-expand/Neural-Day-Trader
git add llm-active-brain/src/tools.ts llm-active-brain/src/agent.ts
git commit -m "$(cat <<'EOF'
fix(llm-brain): remove retry duplicado em get_mt5_quote + timeout de 90s no client Ollama

Dois travamentos reais confirmados ao vivo durante monitoramento continuo:

1. get_mt5_quote (tools.ts) tinha 2 retries por cima dos 3 que
   mt5Broker.getQuote ja faz internamente (8s timeout cada) -- 5 tentativas
   empilhadas. Confirmado: ciclo travou ~10min numa unica chamada de
   XAUUSD com a MetaAPI compartilhada lenta (HTTP 504, risco cronico ja
   documentado). Removido o retry duplicado -- pior caso cai pra 3
   tentativas.

2. O client OpenAI (agent.ts) nao tinha timeout configurado -- SDK usa
   default de 10 MINUTOS por chamada. Confirmado ao vivo pela 2a vez:
   processo ficou 15min+ mudo, Ollama local saturado (localhost:11434 nao
   respondia, llama-server preso ha 36min de CPU). Adicionado timeout de
   90s -- generoso sobre o pior caso real medido (~30-58s), falha rapido
   o suficiente pro catch de ciclo existente (index.ts:149) seguir em
   frente em vez de travar silenciosamente.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

Verificar processo único antes de qualquer restart futuro:
```bash
ps aux | grep -E "node.*index.ts" | grep -v grep
# deve mostrar exatamente 2 linhas (par normal do wrapper tsx) -- mais que isso e' bug
```

Restart limpo (mesma receita das sessões anteriores):
```bash
cd /Users/clebercouto/Projects/we-expand/Neural-Day-Trader/llm-active-brain
pkill -9 -f "tsx/dist/loader.mjs src/index.ts" 2>/dev/null
pkill -9 -f "watchdog.sh" 2>/dev/null
sleep 2
ps aux | grep -E "node.*index.ts|watchdog.sh" | grep -v grep   # confirmar vazio
rm -f llm-brain.pid
nohup ./watchdog.sh >> watchdog.log 2>&1 &
disown
```

---

## Continuação (mesmo dia, madrugada) — 2 bugs de frontend achados durante o monitoramento: linhas de posição sumindo e alarme falso de lote mínimo

Com o motor já operando de verdade (4 posições reais abertas: EURUSD,
SPX500, NAS100, UKOUSD — ver seção acima), o Cleber reportou dois problemas
na tela enquanto acompanhava os trades ao vivo. Ambos investigados a fundo
(código + banco), corrigidos, `tsc --noEmit` limpo, **nenhum commitado**
(regra fixa do projeto).

### 1. Linhas de entrada/SL/TP sumindo de forma intermitente

Reportado como "às vezes aparece, às vezes não" — confirmado com print
mostrando UKOUSD (posição real aberta e correta no banco) sem nenhuma linha
nem alerta "posição aberta" na tela, enquanto NAS100/SPX500/EURUSD
apareciam normalmente. Achado real em `ChartView.tsx`: o `fetchData()`
que roda dentro de um `setInterval` (efeito com dependências
`[timeframe, selectedSymbol]`, nunca recriado quando `activeOrders`/
`pendingOrders` mudam) fechava sobre esses dois valores **CONGELADOS** do
momento em que o efeito foi criado. A cada tick desse interval, ele
chamava `renderPositionOverlays(activeOrders /* velho */, ...)`,
apagando as linhas que o OUTRO efeito (esse sim reativo, com
`activeOrders` nas dependências) tinha acabado de desenhar certo —
dependia de qual dos dois rodava por último. Corrigido com
`activeOrdersRef`/`pendingOrdersRef` (sempre atualizadas via `useEffect`),
lidas no lugar do valor fechado no closure. Commit:
`6a5dfd3c9` (já aplicado, mesmo commit do fix nº 2 abaixo).

### 2. Gráfico abrindo travado no passado (mesma sessão de investigação)

Descoberto de carona enquanto investigava o item 1 — print do Cleber
mostrava o eixo de data em 27/08 com o preço real em 02/09 (quase 6 dias
de atraso). Causa: toda montagem do `ChartView` (entrar na página, trocar
de seção e voltar, carregar template/setup favorito/estado de sessão)
restaurava a posição de scroll EXATA (`anchorTimestamp`/`anchorX`) salva da
última vez — se o usuário tivesse rolado pro passado em algum momento
(pra olhar um padrão) sem voltar pro tempo real antes de trocar de seção,
essa posição ficava presa pra sempre. Decisão do Cleber, confirmada via
`AskUserQuestion`: o gráfico deve **sempre abrir no preço atual** por
padrão — indicadores/timeframe/zoom (barSpace) continuam sendo lembrados,
só a âncora de scroll não. 4 pontos de restauração corrigidos (estado de
sessão, setup favorito, template pendente pós-troca de timeframe, clique
explícito em "Carregar Template"). Commit: `6a5dfd3c9`.

### 3. Alarme falso "Abaixo do mín." no card de Posições Abertas

O Cleber viu UKOUSD marcado como "Abaixo do mín." no Dashboard e reagiu
com razão — regra fixa do projeto: a IA nunca pode operar abaixo do lote
mínimo da plataforma. Investigado a fundo antes de tocar em qualquer
código: confirmado no motor real
(`llm-active-brain/src/tools.ts:1289-1290`) que todo lote é forçado pro
mínimo (`MIN_LOTS`) antes de qualquer ordem sair pra corretora — a regra
**nunca foi quebrada de verdade**. O aviso era um falso positivo só da
tela: `MarketScoreBoard.tsx` reconstrói uma ESTIMATIVA de quantos lotes
uma posição representa a partir do valor em dólar guardado
(`order.amount / (lotSize × preço)`), com arredondamento pra baixo
(`floorToLotStep`) — pequena variação de preço entre a abertura e agora
fazia essa reconstrução cair uma fração abaixo do mínimo real (ex: UKOUSD
com 0,15 lote real mas estimativa dando ~0,0999), mesmo a posição estando
exatamente no lote mínimo. Corrigido: quando a estimativa de exibição cai
abaixo do mínimo, mostra o mínimo real do ativo (chão garantido pelo
motor) em vez do aviso de violação que nunca aconteceu — tanto no card
individual quanto na soma "lotes total" do cabeçalho (antes somava ZERO
pra essas posições, subcontando o total exibido). `floorToLotStep()` em si
(usado no caminho real de execução de ordem, `openManualPosition` etc.)
não foi tocado — só a reconstrução de exibição. Commit pendente, comando
pronto abaixo.

### Comandos pendentes desta parte

```bash
cd /Users/clebercouto/Projects/we-expand/Neural-Day-Trader
git add src/app/components/dashboard/MarketScoreBoard.tsx
git commit -m "$(cat <<'EOF'
fix(dashboard): remove alarme falso "Abaixo do mín." em posições da IA

Achado do Cleber: card de Posições Abertas mostrava "Abaixo do mín." para
UKOUSD, implicando que a IA tinha operado um lote menor que o minimo da
plataforma -- regra da plataforma nunca permite isso.

Investigado e confirmado: o motor real (llm-active-brain/src/tools.ts:
1289-1290) ja forca "lots = MIN_LOTS" antes de qualquer ordem sair pra
corretora -- a regra nunca foi quebrada. O aviso era um falso positivo da
tela: ela reconstroi uma ESTIMATIVA de lotes a partir do valor em dolar
guardado (order.amount / lotSize / preco), com arredondamento pra baixo
(floorToLotStep) -- pequena variacao de preco entre a abertura e agora
fazia essa reconstrucao cair uma fracao abaixo do minimo real, mesmo a
posicao estando de fato no lote minimo exato.

Corrigido: quando a estimativa de exibicao cai abaixo do minimo, mostra o
minimo real do ativo (chao garantido pelo motor) em vez do aviso de
violacao que nunca aconteceu -- tanto no card individual quanto na soma
"lotes total" do cabecalho (antes somava zero pra essas posicoes,
subcontando o total). floorToLotStep() em si (usado no caminho real de
execucao de ordem) continua intocado.

tsc --noEmit sem erro novo (569 pre-existentes, mesma contagem).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

### Pendências reais pra próxima sessão (atualização)

6. **Commit do fix de "Abaixo do mín."** — comando pronto acima, não
   aplicado ainda.
7. **Verificação visual real do fix de gráfico/linhas** — só validado por
   `tsc --noEmit` limpo (sem erro novo) e leitura de código; não testado
   ao vivo numa sessão logada (precisaria das credenciais do Cleber). Vale
   confirmar visualmente na próxima sessão que: (a) as 4 linhas de posição
   aparecem de forma estável (sem piscar/sumir) nos ativos certos; (b) o
   gráfico abre sempre no preço atual, mesmo depois de ter sido deixado
   rolado pro passado antes.
