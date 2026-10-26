# Sessão 2026-09-14 — Estocástico invertido, rate-limit da MetaAPI, semáforo distribuído

> Handoff completo desta sessão. Resumo de 1-2 linhas já adicionado ao topo do
> [CLAUDE.md](CLAUDE.md) — consulte este arquivo se precisar do detalhe
> técnico completo de qualquer achado abaixo.

## Contexto do dia

Segunda-feira 2026-09-14 — motor LLM Brain saiu do modo fim de semana pra
modo normal (confirmado via `isWeekendMode()`, janela sexta 21h UTC→domingo
22h UTC). A partir daí, Cleber reportou uma sequência de problemas reais que
foram investigados e corrigidos um a um nesta sessão.

## 1. Dia 14 em perda — achado estatístico real (não bug)

Cleber reportou o dia 14 inteiro em perda. Investigação via SQL direto em
`ai_trades` confirmou: real, não miscalculo — sessão fechou **-$28,26**
líquido sobre $100 alocados (drawdown ~28%), 64 trades, 43,7% de acerto.

**Achado estatístico forte** (14 dias, n=422 trades): entradas classificadas
como **REVERSÃO/contrarian** (Estocástico extremo contra a tendência) tinham
**39,5% de acerto e -$0,62/trade em média** (243 trades, -$151,12 líquido),
contra **80% de acerto e +$0,88/trade** em entradas de **CONTINUAÇÃO** (10
trades, +$8,75). A maior parte do prejuízo da sessão vinha de reversão mal
confirmada.

## 2. Estocástico interpretado ao contrário — causa raiz real

Achado central da sessão: a IA estava abrindo **SHORT quando o Estocástico
estava SOBREVENDIDO** (e o oposto) — interpretação **invertida** do
indicador. SOBREVENDIDO = exaustão da queda = favorece LONG, nunca SHORT.
A IA descrevia isso como "mean-reversion" pra justificar o lado errado.

**Fix 1 — trava mecânica** (`llm-active-brain/src/tools.ts`, `open_position`):
bloqueia sempre que o lado da entrada contradiz o Estocástico extremo
(SHORT+SOBREVENDIDO ou LONG+SOBRECOMPRADO), independente de regime/prompt.

**Fix 2 — reforço de prompt** (`llm-active-brain/src/agent.ts`, princípio 1l):
explica a direção correta do indicador, com o caso real como exemplo — não
substitui a trava, só tenta reduzir o desperdício de ciclo tentando entrada
que vai ser bloqueada.

**Decisão explícita do Cleber**: aceitar a trava mecânica como garantia
definitiva pra esta classe de erro — parar de "remendar" via prompt, porque
um LLM não retém entendimento entre ciclos (cada ciclo lê o prompt do zero).

### 2.1 — Achado adicional: entrar CONTRA o movimento imediato

Segundo padrão real encontrado: UKOUSD LONG aberto durante uma queda clara
de 5 velas seguidas (110,36→109,49 em 25min), porque `trend` (janela de
60min) e MACD (indicador atrasado) ainda mostravam saldo positivo da hora
inteira — cegos pra reversão recém-começada.

**Fix 3 — nova função + trava mecânica**: `getImmediateMomentum()` (novo em
`atr.ts`) olha só as últimas 3 velas fechadas (~15min); `open_position`
bloqueia entrada que vai contra essa sequência clara, a menos que
`setupType="REVERSAO"` (onde ir contra o movimento imediato é a própria
tese, com os gates de confluência já existentes).

### 2.2 — Bug real: TTL de cache igual à duração da vela

Recálculo manual do Estocástico de XETUSD (mesma fórmula do motor) deu
K=80,79 (SOBRECOMPRADO) na última vela fechada real, mas o motor registrou
NEUTRO. Causa: `CACHE_TTL_BY_TIMEFRAME["5m"]` era **5 minutos** — igual à
duração de 1 vela inteira — então o motor podia ler candle com até 5min de
atraso, perdendo a vela recém-fechada.

**Fix 4**: TTL reduzido pra fração pequena da vela (5m→45s, 15m→60s,
1H→90s, 4H→120s), em `llm-active-brain/src/atr.ts`.

### 2.3 — Achado GRAVE: trave de Estocástico fail-open sob falha de rede

Mesmo com a trave (fix 1) ativa, uma entrada **UKOUSD SHORT com Estocástico
SOBREVENDIDO passou** (confirmado no log: `get_mt5_quote` segundos antes
mostrou k=19,73/SOBREVENDIDO, e o próprio reasoning admitiu a contradição).
Causa raiz real: a trave chamava `getSlowStochastic()` de novo,
independente da chamada que `get_mt5_quote` já tinha feito — se essa
chamada nova falhasse (rate-limit da MetaAPI, problema ativo o dia
inteiro), a trave silenciosamente **não bloqueava** (fail-open no pior
momento possível).

**Fix 5**: trava agora usa DUAS fontes — a chamada fresca E o último
snapshot real que `get_mt5_quote` devolveu pra aquele símbolo nesta sessão
(`lastQuoteSnapshotBySymbol`, mesma fonte que grava `indicators_snapshot`
no banco) — bloqueia se qualquer uma das duas indicar contradição.

## 3. "Navegador de Ativos" com "Sem dados" — investigado, não é bug isolado

Testado o endpoint `/mt5-prices` ao vivo: primeira tentativa deu 100% de
erro (429/504), reteste segundos depois deu 100% de sucesso — rajada curta
de rate-limit, não falha permanente. Achado real no código
(`RealMarketDataService.ts`): o componente fazia só 1 tentativa por
categoria e nunca tentava de novo, além de contar erro como "sucesso" no
log por engano (array de preços vinha preenchido mesmo com todo item tendo
`price: null`).

**Fix 6**: retry único após 3s pros símbolos que ainda não tiverem preço
válido; contagem de sucesso corrigida pra exigir preço realmente válido.

## 4. Causa raiz do rate-limit — semáforo local não é global

Confirmado nos logs do backend: **16.731 chamadas** ao MetaAPI em 30min,
**2.401 falhas HTTP 504 + 199 falhas HTTP 429** — erro real da própria
MetaAPI: `"concurrentRequestCount: 6"` contra um máximo de 5 por conta.

**Achado importante, corrigindo o próprio Claude**: a conta é **dedicada**
(paga, com réplica em `backup-new-york`), não compartilhada com outros
clientes — mas o teto de 5 requisições concorrentes de dado histórico é
regra fixa da MetaAPI **por conta**, dedicada ou não.

Causa raiz real: o semáforo já existente no backend
(`MAX_CONCURRENT_HISTORICAL_DATA_REQUESTS = 2`, em
`supabase/functions/server/index.ts`) vivia numa variável **em memória de
uma única instância** da Edge Function — sob carga, o Supabase escala pra
várias instâncias em paralelo, cada uma com sua própria cópia da variável,
sem saber da concorrência real das outras. Resultado: o código "achava" que
limitava a 2, mas o pior caso real passava do teto de 5.

**Fix 7 — semáforo distribuído de verdade**: nova tabela
`metaapi_historical_fetch_slots` + funções `acquire_historical_fetch_slot`/
`release_historical_fetch_slot` usando `pg_advisory_xact_lock` no Postgres
(compartilhado de verdade entre todas as instâncias) — migration
`supabase/migrations/20260914_add_metaapi_historical_slot_semaphore.sql`.
Vagas mais velhas que 30s são limpas sozinhas (protege contra instância que
crashou sem liberar).

**Achado colateral real**: fechar uma 2ª aba duplicada do Dashboard derrubou
as falhas de ~120/min pra 0-5/min na hora — confirma que múltiplas abas
eram o maior contribuinte de carga desnecessária (cada aba dispara a busca
inicial de ~48 símbolos do rodapé de novo).

## 5. Cesta de ativos reduzida

A pedido do Cleber, cesta do LLM Brain reduzida pra 6 ativos (mudança feita
direto no Setup, gerou sessão nova `09ab5176-d026-4c6d-816d-f4ff57a1a886`
às 12:02 UTC) — não resolveu o rate-limit sozinha (a carga dominante vinha
do Dashboard/abas duplicadas, não da cesta do motor).

## Resumo de todas as operações fechadas/abertas desde o restart das 14:28 UTC

| Ativo | Lado | Horário | Resultado | Observação |
|---|---|---|---|---|
| UKOUSD | LONG | 15:08→15:23 | +$4,86 | Estocástico SOBREVENDIDO, direção correta |
| NAS100 | LONG | 15:26→15:36 | +$0,70 | Estocástico NEUTRO |
| UKOUSD | SHORT | 15:45→15:54 | **-$4,14** | Violou a trave (ver item 2.3) — motivou o fix 5 |
| BTCUSD | LONG | 16:30→17:17 | +$1,57 | Estocástico NEUTRO |

Líquido do período: +$2,99.

## Pendente — comandos prontos, nenhum rodado por mim (regra fixa do projeto)

```bash
# 1. Migration do semáforo distribuído (rodar no SQL Editor do Supabase)
#    arquivo: supabase/migrations/20260914_add_metaapi_historical_slot_semaphore.sql

# 2. Deploy da Edge Function
supabase functions deploy server

# 3. Commits (podem ser separados ou num só)
cd llm-active-brain && git add src/tools.ts src/agent.ts src/atr.ts && \
  git commit -m "fix(llm-brain): trava de Estocastico invertido + momentum imediato + TTL de cache + fail-open corrigido"

cd .. && git add supabase/migrations/20260914_add_metaapi_historical_slot_semaphore.sql \
  supabase/functions/server/index.ts \
  src/app/services/RealMarketDataService.ts && \
  git commit -m "fix(backend): semaforo distribuido real via Postgres + retry no Navegador de Ativos"
```

## Sem validação estatística ainda

Todos os fixes de mecânica desta sessão (traves de Estocástico, momentum
imediato, TTL de cache) são correção de bug real, comprovado caso a caso —
mas nenhum tem amostra suficiente ainda pra medir efeito líquido no
resultado. Segue a disciplina do projeto: aguardar dias/trades suficientes
rodando sob esta versão antes de qualquer nova alegação de melhora.
