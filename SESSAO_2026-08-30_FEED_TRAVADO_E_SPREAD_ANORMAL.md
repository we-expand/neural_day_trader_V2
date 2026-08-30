# Sessão 2026-08-30 — "Feed travado" e spread anormal no LLM Active Brain: o que era bug, o que era mercado

**Escopo**: só pipeline de dado/feed do `llm-active-brain` (`mt5Broker.ts`,
`tickHistory.ts`, guardas de `tools.ts`). Nada de prompt/decisão/ML.
**Nada foi deployado, nada foi pushado, nenhuma migration aplicada.**
`supabase/functions/server/index.ts` foi **lido e auditado, mas NÃO alterado**
— a causa não estava lá.

---

## 1. Pergunta que abriu a investigação

Durante monitoramento ao vivo apareceram três sintomas juntos:

1. avisos repetidos de `[mt5Broker] ⚠️ <SÍMBOLO> devolveu o MESMO preco Nx
   seguidas -- possivel feed travado`, em DOTUSD, XPTUSD, BTCXBN e às vezes
   até BTCUSD;
2. spread bid/ask de ~10% em DOTUSD (bid ~0,794 / ask ~0,877), com um LONG
   nascendo -9,46% flutuante e sendo stopado quase instantaneamente;
3. pendência antiga no `CLAUDE.md`: "XPTUSD com feed travado (24+ ciclos no
   mesmo preço)".

A hipótese a descartar era bug de cache/staleness no `/mt5-prices` (mesmo
padrão do fix de `/mt5-candles` feito horas antes: path errado da MetaAPI →
404 silencioso → dado fabricado).

---

## 2. Auditoria do `/mt5-prices` (Edge Function compartilhada)

Lido `supabase/functions/server/index.ts` (rota a partir da linha 3946).
Caminho real do dado:

- **tick**: `GET {clientApiBase}/users/current/accounts/{id}/symbols/{SYM}/current-tick`
  (MetaAPI). `bid`, `ask` e `timestamp` da resposta saem **do mesmo objeto de
  tick**, na mesma chamada — não há mistura de fontes nem de momentos.
  `price = tickerData.bid || tickerData.ask || tickerData.last`.
- **candle** (`1h` pra cripto, `1d` pro resto) é usado **só** pra calcular
  `change`/`changePercent`. Não toca em bid/ask.
- **cache**: L1 em memória do isolate + L2 no KV (Postgres), TTL de
  **2.500 ms**, dedupe de chamada concorrente. Só cacheia resultado com preço
  real (erro/`null` nunca entra no cache).
- `source: 'SIMULATED'` só aparece quando o token MetaAPI é inválido/ausente
  — não é o caso aqui.

**Conclusão da auditoria de código: nenhum caminho onde bid e ask venham de
tempos/fontes diferentes.** TTL de 2,5s é curto demais pra explicar preço
repetido por minutos, e caberia igualmente a todos os símbolos.

---

## 3. Teste direto contra a API (o que decidiu a questão)

6 chamadas a `/mt5-prices` com os 8 símbolos da cesta, espaçadas ~5-10s
(acima do TTL de cache), em **2026-08-30 02:45-02:46 UTC (sábado)**.
Resultado real (spread = `(ask-bid)/bid`, idade = agora − `timestamp` do tick
da corretora):

| símbolo | bid | ask | spread | idade do tick |
|---|---|---|---|---|
| BTCUSD | 78044,07 | 78055,60 | **0,015%** | 0-9s |
| XETUSD | 2452,35 | 2454,94 | **0,106%** | 0-9s |
| BTCXBN | 317,47 | 318,03 | **0,177%** | 0-3s |
| XPTUSD | 1819,93 | 1828,36 | **0,463%** | **107.150s (≈29,8 h)** |
| SOLUSD | 104,92 | 105,45 | **0,505%** | 0-9s |
| DOGUSD | 0,0843 | 0,0855 | **1,30-1,42%** | 0-25s |
| XRPUSD | 1,3821 | 1,4024 | **1,469%** | 0-4s |
| DOTUSD | 0,795 | 0,878 | **10,44%** | 0-25s |

Dois achados independentes saem daí:

### 3.1 O spread de 10% do DOTUSD é REAL — não é bug

O `timestamp` do tick de DOTUSD **avança normalmente** ao longo das chamadas
(02:45:00 → 02:45:51 → 02:46:00 → 02:46:10), com bid/ask sempre do mesmo
objeto `current-tick`. Numa segunda rodada, o bid até andou (0,795 → 0,796).
Ou seja: a corretora está publicando ticks frescos com esse spread. É a
cotação genuína da Infinox pra esse CFD (fim de semana, liquidez mínima),
não cache velho nem símbolo mapeado errado.

Pela regra do projeto (dado real ⇒ a resposta é trava de risco, não "fix de
dado"), isso vira **guarda de spread**, não correção de pipeline.

O aviso de "MESMO preço Nx seguidas" também se explica sem bug: são ativos
que ticam devagar (e BTCUSD parado num fim de semana calmo). O aviso é um
proxy ruim — o sinal honesto é a **idade do tick**, que existia na resposta e
estava sendo ignorada (ver 3.2).

### 3.2 Achado real de integridade de dado: tick MORTO tratado como vivo

**XPTUSD (platina) devolvia um tick de ~29,8 horas atrás** —
`2026-08-28T20:59:58Z`, mercado fechado desde sexta — e o
`llm-active-brain` consumia isso como cotação viva. Dois furos somados:

1. **`mt5Broker.ts` ignorava o campo `timestamp`** que `/mt5-prices` já
   devolvia. Nenhuma checagem de idade em lugar nenhum do processo. O dado é
   REAL (não é `SIMULATED`), só está MORTO — exatamente o tipo de coisa que a
   convenção do projeto manda sinalizar em vez de mascarar.
2. **`isSymbolTradable` (`assetBasket.ts`) só tem calendário de FOREX**
   (`if (!FOREX_SYMBOLS.has(symbol)) return true`). XPTUSD é metal precioso,
   não está nessa lista — logo passava como "mercado aberto" no sábado.

Efeito colateral pior, e o mais grave da sessão: **`recordTick` era chamado a
cada retorno**, então o mesmo preço morto de XPTUSD entrava no histórico de
tick a cada 10 segundos. `tickHistory.ts` então produzia, a partir de um único
preço de 30h atrás repetido centenas de vezes, uma "tendência LATERAL", uma
"volatilidade" e uma "extensão" com `sampleCount` alto e span de 60min — todas
métricas **fabricadas por construção**, entregues ao agente como se fossem
observação real de mercado.

---

## 4. O que foi corrigido / implementado

Nenhuma linha da Edge Function compartilhada foi tocada.

### `llm-active-brain/src/mt5Broker.ts`
- passa a ler o `timestamp` do tick e expor, no tipo novo `Mt5Quote`:
  `spreadPct`, `tickAgeSeconds` e `stale` (idade > `STALE_TICK_MS = 120s`);
  clamp em 0 pra skew de relógio da MetaAPI (medido: até ~3s à frente).
- `console.warn` explícito quando o tick vem obsoleto (com idade e horário
  real do tick).
- **`recordTick` só grava tick VIVO e NOVO**: nada é gravado quando `stale`,
  e há dedupe pelo `timestamp` do tick da corretora — dois retornos do MESMO
  tick são a mesma observação, não duas. Isso fecha a fabricação de série
  temporal descrita em 3.2. O timestamp gravado passa a ser o da corretora,
  não `Date.now()`.
- 120s de tolerância: a maior lacuna legítima medida entre ticks nesta cesta
  foi ~25s; 120s dá folga larga sem deixar passar mercado fechado.

### `llm-active-brain/src/tools.ts`
- `open_position` ganha **duas travas** (mesmo espírito de teto por símbolo /
  cooldown / bloqueio contra-tendência já existentes):
  - **cotação obsoleta** (`quote.stale`) → não abre. Genérico por idade de
    tick, cobre qualquer símbolo/feriado/parada de feed sem precisar manter
    calendário por instrumento (é o que faltava pro XPTUSD).
  - **spread acima de `SPREAD_BLOCK_PCT = 2,0%`** → não abre, com a mensagem
    explicando o custo real da entrada.
- `get_mt5_quote` passa a devolver `spreadPct`/`tickAgeSeconds`/`stale` e um
  campo `aviso` quando o tick está obsoleto ou o spread passa de
  `SPREAD_WARN_PCT = 0,8%` (avisa sem bloquear).
- descrição da ferramenta `open_position` atualizada pra declarar as travas
  novas.

**Por que 2,0% e 0,8%**: a medição da seção 3 é a justificativa inteira. 2,0%
bloqueia **só o DOTUSD** (10,44%); o segundo pior da cesta (XRPUSD, 1,47%) e o
DOGUSD (1,42%) continuam liberados, mas caem no aviso a partir de 0,8% —
faixa onde o custo de entrada já é material e o alvo precisa ser bem maior
que ele. Nenhum dos outros 5 símbolos (0,015%-0,51%) é afetado.

### Auditoria de `atr.ts` (pedida no escopo)
Sem achado. `getAtrFromCandles`/`getTrendInfo`/`getVolumeConfirmation`/
`getSupportResistance` já descartam explicitamente `source === "SIMULATED"` e
devolvem `null` por amostra insuficiente em vez de improvisar. A falha de
disciplina estava só na entrada do pipeline (`mt5Broker` → `recordTick`), que
alimentava esses módulos com dado morto.

---

## 5. Verificação (antes / depois, números reais)

Type-check: `npx tsc --noEmit` em `llm-active-brain/` — **limpo, 0 erros**.

`getQuote` real, batendo na API de produção depois do fix
(2026-08-30 02:5x UTC):

```
BTCUSD   bid=78079.53   ask=78090.97   spreadPct=  0.015 age=     2.5s stale=false
XETUSD   bid=2453.67    ask=2456.41    spreadPct=  0.112 age=     9.4s stale=false
SOLUSD   bid=104.97     ask=105.5      spreadPct=  0.505 age=     2.9s stale=false
DOGUSD   bid=0.0844     ask=0.0856     spreadPct=  1.422 age=     5.2s stale=false
DOTUSD   bid=0.796      ask=0.879      spreadPct= 10.427 age=    25.5s stale=false
XRPUSD   bid=1.3839     ask=1.4042     spreadPct=  1.467 age=    12.3s stale=false
[mt5Broker] ⚠️ XPTUSD: tick REAL porem OBSOLETO (107462s de idade, horario do
tick 2026-08-28T20:59:58.000Z) -- mercado provavelmente fechado ou feed parado.
XPTUSD   bid=1819.93    ask=1828.36    spreadPct=  0.463 age=107462.4s stale=true
BTCXBN   bid=317.517    ask=318.084    spreadPct=  0.179 age=     2.8s stale=false
```

- **Antes**: XPTUSD entrava no histórico e era elegível pra `open_position`
  como qualquer outro; DOTUSD abria posição com 10,4% de spread.
- **Depois**: XPTUSD sinalizado `stale=true`, fora do histórico de tick e
  bloqueado em `open_position`; DOTUSD bloqueado por spread; os outros 6
  símbolos passam sem nenhuma mudança de comportamento.

---

## 6. Pendências / decisões pro Cleber

1. **XPTUSD na cesta**: com a trava nova ele deixa de causar dano (não entra
   no histórico, não abre posição), mas segue ocupando um slot da cesta e
   gerando warning de fim de semana. Decidir se sai da cesta ou fica.
2. **`isSymbolTradable` só cobre FOREX** — a trava de tick obsoleto resolve o
   sintoma de forma genérica e é o mecanismo mais honesto (dado real decide,
   não calendário hard-coded), mas se quiser um calendário explícito pra
   metais/índices, é trabalho separado.
3. **Limiar de spread**: 2,0% foi calibrado com uma amostra de **fim de
   semana**, quando o spread é estruturalmente mais largo. Vale remedir a
   cesta em dia útil — é possível que 2,0% fique folgado demais no pregão
   normal (o próprio DOTUSD pode voltar a spread aceitável, e aí a trava só
   atua no fim de semana, que já é o comportamento desejado).

---

## 7. Comandos de commit (NÃO executados)

⚠️ **Passo obrigatório antes**: os arquivos foram editados na cópia do
worktree isolado (`.claude/worktrees/agent-a264ff59aa7fde8c0/llm-active-brain/`)
porque `llm-active-brain/` é **inteiramente untracked** no git e por isso não
existia no worktree. Copiar de volta pro diretório vivo antes de commitar:

```bash
cd /Users/clebercouto/Projects/we-expand/Neural-Day-Trader
cp .claude/worktrees/agent-a264ff59aa7fde8c0/llm-active-brain/src/mt5Broker.ts llm-active-brain/src/mt5Broker.ts
cp .claude/worktrees/agent-a264ff59aa7fde8c0/llm-active-brain/src/tools.ts     llm-active-brain/src/tools.ts
cp .claude/worktrees/agent-a264ff59aa7fde8c0/SESSAO_2026-08-30_FEED_TRAVADO_E_SPREAD_ANORMAL.md .
```

(o processo do `llm-active-brain` precisa ser reiniciado pra pegar o fix —
lembrar do padrão já documentado: **matar o processo antigo antes**, senão
ficam dois rodando contra a mesma conta.)

Commit:

```bash
cd /Users/clebercouto/Projects/we-expand/Neural-Day-Trader
git add llm-active-brain/src/mt5Broker.ts llm-active-brain/src/tools.ts \
        SESSAO_2026-08-30_FEED_TRAVADO_E_SPREAD_ANORMAL.md
git commit -m "fix(llm-brain): tick obsoleto era tratado como cotacao viva (XPTUSD, 30h) e poluia o historico de tick + trava de spread (DOTUSD real em 10,4%)

- mt5Broker: passa a ler o timestamp do tick da MetaAPI (ja vinha na resposta
  de /mt5-prices e era ignorado); expoe spreadPct/tickAgeSeconds/stale.
- mt5Broker: recordTick so grava tick VIVO e NOVO (dedupe pelo timestamp da
  corretora) -- antes, o mesmo preco morto de XPTUSD entrava no historico a
  cada 10s e fabricava tendencia/volatilidade/extensao a partir de um unico
  tick de 30h atras.
- tools/open_position: bloqueia entrada com cotacao obsoleta (>120s) e com
  spread bid/ask acima de 2,0%; get_mt5_quote avisa a partir de 0,8%.
- Confirmado por medicao direta que o spread de 10,4% do DOTUSD e dado REAL
  da corretora (timestamp do tick avanca), nao bug de cache -- por isso trava
  de risco, nao fix de pipeline. Edge Function /mt5-prices auditada e NAO
  alterada.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

**Não dar push** — seguir a regra fixa do projeto (o push é do Cleber).
