# Sessão 2026-09-22 — Continuação do upgrade da LLM trader (Kimi K3), fixes de retry, e Dev Lab

> Continuação direta de `CONSELHO_2026-09-22_UPGRADE_LLM_TRADER.md` e
> `NEXT_SESSION.md` (Passo 0/Passo 1 do plano do conselho). Esta sessão
> executou o Passo 0, testou e aplicou o Passo 1, começou o Passo 2, e
> resolveu 2 bugs reais de produção encontrados no caminho (Dev Lab
> travado, validador 404). Handoff completo abaixo — **ler a seção
> "Pendente real" antes de continuar**.

## ▶ COMECE AQUI

**Motor rodando agora com Kimi K3** (troca do Qwen3.5 4B/Ollama), sob
gestão do `watchdog.sh` — confirmado saudável na última checagem desta
sessão: processo único, zero erro de validador, 1 erro de conexão isolado
recuperado pelo retry, avaliando toda a cesta com dado real e fresco.

**Pendente real mais importante**: `supabase functions deploy
dev-lab-ai-suggestions` (comando pronto na seção "Dev Lab" abaixo) — sem
isso, o fix do Dev Lab não pega em produção.

---

## PASSO 0 — Instrumentação (CONSELHO_2026-09-22) — ✅ feito, commitado, no ar

Commit `3947ad253`. `llm-active-brain/src/neuralBridge.ts`:

- `duration_seconds` agora é gravado no fechamento de todo trade
  (`closeMt5Position`, funil único dos 3 caminhos de fechamento —
  watchdog/discricionário/enforce). Antes ficava NULL em 100% dos trades.
- `mfe_usd` inicializado em `0` na abertura (antes só era escrito em nova
  máxima — trade que nunca respirou a favor ficava NULL, indistinguível
  de "não medido").

**Não verificado ainda nesta sessão**: se os trades fechados HOJE já têm
`duration_seconds` preenchido de verdade (o commit foi feito e o motor
reiniciado depois, mas nenhum trade real fechou durante a sessão pra
confirmar via SQL). Query de confirmação, mesma da spec original:

```sql
select count(*) fechados, count(duration_seconds) com_duracao, count(mfe_usd) com_mfe
from ai_trades
where status='CLOSED' and exit_time >= now() - interval '2 hours';
```

## PASSO 1 — Modelo de raciocínio (CONSELHO_2026-09-22) — ✅ feito, commitado, no ar

### O que estava no `.env` antes desta sessão

`LLM_PROVIDER=ollama` (sem `LLM_MODEL` → default `qwen35-trading`, Qwen3.5
**4B**, thinking sempre ligado no Ollama, gargalo é tamanho do modelo, não
o flag `enable_thinking`). Confirmado no início da sessão — resolve a
pergunta em aberto do `NEXT_SESSION.md`.

### Benchmark real (ao vivo, com a própria chave NVIDIA NIM do Cleber — free tier)

Testado `tool_choice:"required"` contra os mesmos rótulos que o conselho
mediu como causa de 75% dos bloqueios (Estocástico/candle lidos ao
contrário), 2 casos (um exige LONG, outro exige SHORT, pra pegar viés de
responder sempre igual):

| Modelo (gratuito, NVIDIA NIM) | Caso A | Caso B | Latência |
|---|---|---|---|
| **`moonshotai/kimi-k3`** | ✅ OK | ✅ OK | 43-48s (prompt pequeno) / **45,2s (prompt real, 17.418 tokens)** |
| `z-ai/glm-5.3` | ✅ OK | ✅ OK | 110s ⚠️ inviável pro ciclo |
| `nvidia/nemotron-3.5-lightning-30b-a3b` | ❌ sem tool_call | ✅ OK | 27s |
| `nvidia/nemotron-3-super-120b-a12b` | ❌ sem tool_call | ❌ sem tool_call | 14s |
| `deepseek-ai/deepseek-v4.1-flash` | ❌ sem tool_call | — | 26s |
| `moonshotai/kimi-k2.6` | HTTP 404 (não servido) | — | — |

**Kimi K3 venceu**: único que emitiu tool_call corretamente nos 2 lados
com `tool_choice:"required"`, latência aceitável mesmo sob o prompt real
completo (42.704 chars extraídos do `GENESIS_PROMPT_MT5`, testado com as 7
`scopedToolDefinitions` reais).

### Instabilidade real encontrada e corrigida (não era bug do Kimi K3)

Primeira tentativa de religar em produção: **2 de 2 ciclos morreram com
"Connection error."** (motor ficou ~10min sem nenhuma decisão) — causa era
`createChatCompletionWithRetry` (`agent.ts`) só cobrir retry de HTTP 429
(rate limit), qualquer outro erro de conexão (
`APIConnectionError`/`APIConnectionTimeoutError` do SDK OpenAI, sem
`status` HTTP) matava o ciclo na 1ª tentativa.

**Diagnóstico isolado** (mesmo cliente/SDK, mesmo prompt real, 4 chamadas
seguidas): **4 de 4 sucesso**, ~24-27s cada, zero erro — descartou bug
estrutural no cliente Node. Conclusão: instabilidade **transitória real da
NVIDIA NIM** (confirmada de forma independente horas depois nos logs do
Dev Lab, mesma janela 04:58-05:40 UTC, ver seção Dev Lab abaixo).

**Fix**: commit `ca433b15e` (`llm-active-brain/src/agent.ts`) — retry
também pra `APIConnectionError`, backoff curto (5s/10s/.../30s, distinto
do backoff de rate-limit que pode esperar minutos por motivo diferente).
Ainda propaga no último attempt (não mascara falha persistente).

Religado depois do fix — confirmado ao vivo que o retry se recupera
(chegou a acontecer 4-6 erros seguidos numa das tentativas, sempre
recuperou sozinho) e o motor segue avaliando a cesta normalmente.

### Bug colateral encontrado e corrigido: validador de raciocínio 404-ando

Ao configurar `MT5_REASONING_VALIDATOR_MODEL=qwen35-trading` (pensando em
manter o validador no Ollama local pra não dobrar custo/latência na NVIDIA)
— achado real: **não existe provider próprio pro validador**, ele sempre
usa o `baseURL` do `LLM_PROVIDER` ativo, só troca o nome do modelo. Com
`LLM_PROVIDER=nvidia`, mandava "qwen35-trading" (nome de modelo Ollama)
pro endpoint da NVIDIA → 404 em todo ciclo, mascarado por fail-open (seguro,
mas gastando uma chamada de rede morta por ciclo).

**Fix**: `MT5_REASONING_VALIDATOR_ENABLED=false` no `.env` (não commitado —
é config local, mesmo padrão do resto do `.env`) — mesmo precedente já
documentado no projeto em 2026-09-02 ("validador == mesmo modelo/provider
do cérebro principal → desligar, trava por palavra-chave determinística
continua ativa"). Confirmado depois do restart: zero ocorrência de
`reasoningValidator` no log.

### Achado de infraestrutura: `watchdog.sh` rodando independente

Descoberto no meio da sessão: existe um `watchdog.sh` (criado em sessão
anterior, 2026-09-01) rodando como processo próprio desde 4/09, que mata
e reinicia o motor sozinho sempre que ele sai — **inclusive toda vez que
esta sessão rodava `./restart.sh` manualmente**, criando risco real de
corrida (2 processos tentando subir ao mesmo tempo, mesma classe de bug
"processo duplicado" já catalogada várias vezes no CLAUDE.md).

Ação tomada: matei o watchdog no meio da sessão pra evitar a corrida
enquanto eu mexia ativamente. Ele **voltou a rodar sozinho depois**
(nenhum `launchd`/cron encontrado pra ele — só o de `streaming-relay`
tem `launchd`) — presume-se que o Cleber (ou outra sessão/terminal dele)
reiniciou manualmente em paralelo. Confirmado ao final: só 1 processo
real rodando (sem duplicata), config correta herdada.

**Pendente real**: nenhuma ação de código — é só um lembrete operacional:
**se for reiniciar o motor manualmente de novo, checar antes se
`watchdog.sh` está rodando** (`ps aux | grep watchdog.sh`) pra não repetir
a corrida. Se estiver, ou mata ele antes do `restart.sh`, ou deixa ele
mesmo religar depois de editar o `.env` (mata o processo do motor com
`pkill -9 -f "tsx/dist/loader.mjs src/index.ts"` e espera o watchdog subir
de novo sozinho em ~5s).

## PASSO 2 — Feedback loop (CONSELHO_2026-09-22) — ✅ primeiro degrau, commitado, no ar

Commit `4c64e5cc7`. `llm-active-brain/src/tradeMemory.ts`.

Achado do conselho confirmado no código: `ai_reasoning` de cada trade
fechado já era buscado do banco (`getClosedTradesForMemory`) e
**descartado** — `aggregate()` só somava PnL, nunca lia o campo.

`formatReasoningBlock()` novo: para os até 5 trades mais relevantes (maior
`|pnl|` absoluto, não só os mais recentes — evita gastar orçamento de
caracteres com trades perto de zero), injeta a **tese real** que a IA
escreveu ao lado do resultado ("você disse X, deu $Y"), em vez de só um
agregado numérico por símbolo+lado. Teto de 1200 chars pra essa seção,
220 chars por trade.

**Isto é só o primeiro degrau** do Passo 2, não o Passo 2 inteiro — ainda
faltam (não feitos nesta sessão):
- Revisão pós-trade estruturada (comparar tese vs. o que o preço fez de
  fato, gerar 1-2 linhas de "o que falhou" ao fechar)
- Few-shot escolhido por dado (8-10 trades reais mais informativos)
- Memória atravessando sessão (hoje reinício = amnésia total, mesmo com
  500+ trades de histórico real)

Sem validação estatística de efeito ainda — mesma disciplina do bloco de
agregado que já existia.

## Meta de frequência (10-15 entradas/12h) — pedido do Cleber, mantido apesar do achado

Cleber pediu subir a frequência de ~1-5/dia pra 10-15/12h (20-30/dia).
Concern levantado com dado real (histórico do projeto: teto medido de
edge líquido positivo é ~2-6/dia, teto de frequência já foi removido de
propósito em 07/09 por ser o próprio gargalo, 75% dos bloqueios hoje são
leitura errada de indicador, não trava de frequência) — Cleber reafirmou a
meta, decisão dele registrada.

**Achado real, nenhum parâmetro foi mexido**: não existe hoje nenhum teto
de frequência abaixo da meta pra soltar — `mt5MaxEntriesPer24h=60` (bem
acima de 20-30/dia) e `cadence="AGRESSIVA"` (avalia toda entrada, sem
pular ciclo) já estão configurados. O gargalo real pra chegar em 10-15/12h
é 100% qualidade de leitura do modelo (exatamente o que o Passo 1 (Kimi
K3) e o Passo 2 (feedback loop) atacam) — não há ajuste honesto de
"frequência" a fazer sem desligar uma trava de qualidade de verdade.
**Nenhuma ação de código tomada neste item** — comunicado ao Cleber.

## Dev Lab — Sugestões da IA: categorias vazias — ✅ fix commitado, pendente deploy

Cleber reportou: aba "Sugestões da IA" (Dev Lab), categoria Tecnologia com
20 sugestões geradas, as outras (Growth & Marketing, Monetização/Pricing,
Cérebro de IA/P&D Quant, Segurança) vazias mesmo clicando "atualizar".

**Causa real, confirmada via `query_logs` do Supabase**: **não é bug de
categoria nenhum** — é a MESMA instabilidade transitória da NVIDIA NIM
encontrada no motor de trading a mesma noite (janela 04:58-05:40 UTC,
confirmação cruzada independente). A Edge Function
`supabase/functions/dev-lab-ai-suggestions` **nunca teve retry nenhum** —
qualquer erro (mesmo transitório) abortava a chamada na 1ª tentativa. Logs
reais achados:

```
NVIDIA API 503: "Service temporarily overloaded"
Groq API 429: rate limit (8000 TPM do tier gratuito estourado)
```

TECH só "funcionou" por ter sido preenchida ANTES dessa janela de
instabilidade começar (confirmado via SQL: `TECH` tem 20 linhas
`AI_SUGGESTION`; `GROWTH_MARKETING`/`MONETIZATION`/`AI_BRAIN` só têm linhas
`AI_RESEARCH`, feature diferente; `SECURITY` não tinha nenhuma linha).

**Fix**: commit `582cb3da5`
(`supabase/functions/dev-lab-ai-suggestions/lib/llmClient.ts`) — retry
curto (3 tentativas, backoff 2s/4s) pra status transitórios
(429/500/502/503/504) em `completeOpenAICompat`, mesmo espírito do fix do
motor de trading. `completeAnthropic` não mudou (sem histórico de
instabilidade observado nela). `deno check` limpo.

**Pendente real — Cleber precisa rodar** (Claude não faz deploy de Edge
Function sozinho, mesma regra do `git commit`):

```bash
cd /Users/clebercouto/Projects/we-expand/Neural-Day-Trader
supabase functions deploy dev-lab-ai-suggestions
```

Depois disso, clicar de novo em "Preencher 20 por categoria" nas 4
categorias vazias.

## Duas sugestões de IA do Dev Lab avaliadas com o Cleber

1. **"Feature de Detecção de Regime de Mercado via Clustering"** — achado
   real: **já implementado**. `llm-active-brain/src/hmmRegime.ts` (HMM
   Gaussiano de 3 estados — TENDENCIA_CLARA/CONSOLIDACAO_BAIXA_VOL/
   CHOQUE_DE_VOLATILIDADE — método mais rigoroso pra série temporal que
   K-means puro), construído em 2026-09-09 **a pedido direto do próprio
   Cleber** ("principal trava de segurança contra aplicar lógica de
   tendência num mercado consolidado"). Já ao vivo, confirmado rodando nos
   logs desta sessão. A sugestão do Dev Lab (opinião do modelo sem
   contexto do código) não tinha como saber disso. Cleber decidiu: fechar
   sem retrabalho (já estava marcado `completed` no banco por sessão
   anterior). Ofereci um K-means literal como sinal cruzado adicional —
   Cleber optou por não fazer.

2. **"Implementação de Reinforcement Learning para Ajuste de Parâmetros de
   Risco"** — achado: contradiz o Passo 5 do conselho de 22/09 (não
   treinar/destilar política nova sem uma política medidamente positiva
   primeiro — hoje a expectância do motor é negativa) e o precedente de
   04/09 (parâmetro de risco mexido sem validação derrubou o acerto de
   80%→33% no mesmo dia). Um agente RL ajustando stop-loss/sizing/
   alavancagem ao vivo é a versão automatizada exatamente desse risco.
   Cleber decidiu: **pausar por agora** (não rejeitado). Anotado no
   `full_analysis` da sugestão (id `1c7519be-dd12-4c00-bc7e-2206e3543c79`)
   o critério real pra retomar: mesmo padrão já usado pro item "ML de
   magnitude de alvo" no CLAUDE.md — só depois de existir amostra limpa
   suficiente (`mfe_usd`/`duration_seconds`, que só começou a acumular de
   verdade hoje, ver Passo 0 acima) SOB A MESMA versão de motor, e mesmo
   assim como protótipo OFFLINE em `research/` (walk-forward, out-of-
   sample, sem look-ahead), nunca ligado ao motor real sem essa validação.

## Investigação aberta, não finalizada: lentidão por ativo (MetaAPI, não o modelo)

Cleber pediu pra "regular o motor pra pensar mais rápido por ativo".
Medido ao vivo, sem o LLM no meio (chamada direta a `getQuote`):
**BTCUSD (cripto, roteado direto pra Binance) = 1,5s; NAS100 (via MetaAPI)
= 25,5s**. A lentidão por ativo não é o modelo pensando devagar — é a
MetaAPI compartilhada, mesmo gargalo crônico já catalogado dezenas de
vezes no CLAUDE.md.

**Achado real, não corrigido ainda**: dentro de `get_mt5_quote`
(`tools.ts`), há **10 chamadas sequenciais** (`await` uma de cada vez —
`getMt5Quote`, `getTrendInfo`, `getLongTermTrendInfo`,
`getVolumeConfirmation`, `getSupportResistance`, `getMacd`,
`getSlowStochastic`, `getLongTermSlowStochastic`, `getCandlePatterns`, e
mais adiante `getMarketRegime`/`getSmcZonesSummary`/`getHmmMarketRegime`/
mais 2 `getTrendInfo` pra direção/`getImmediateMomentum`/
`getMovingAverageDistance`) quando poderiam rodar em paralelo — a infra
de cache (`fetchRecentCandles`, TTL 5min) e dedup de requisição em voo
(`inFlightCandleRequests`) já existe e é segura pra concorrência, então
paralelizar com `Promise.all` é uma otimização real e de baixo risco (não
muda nenhum valor computado, só a ordem de execução) — **não implementado
ainda, sessão foi interrompida por outro pedido do Cleber (Dev Lab) antes
de terminar isso.**

**Pendente real**: continuar essa investigação — mapear com precisão quais
das ~14 chamadas dentro de `get_mt5_quote` são realmente independentes
(não usam resultado de uma anterior) e paralelizá-las com `Promise.all`,
depois medir o tempo real por ativo de novo pra confirmar o ganho.

---

## Commits desta sessão (todos já em `origin/dev`)

1. `3947ad253` — Passo 0: `duration_seconds` + `mfe_usd` + escopo do
   `enable_thinking` restrito a Nemotron (`neuralBridge.ts`, `agent.ts`)
2. `ca433b15e` — retry em erro de conexão (não só 429) no motor
   (`agent.ts`)
3. `4c64e5cc7` — Passo 2 (primeiro degrau): `ai_reasoning` real na memória
   de trades (`tradeMemory.ts`)
4. `582cb3da5` — retry em erro transitório (429/5xx) na Edge Function do
   Dev Lab (`dev-lab-ai-suggestions/lib/llmClient.ts`)

## Pendente real, resumo final

1. **`supabase functions deploy dev-lab-ai-suggestions`** — Cleber rodar
   (fix do Dev Lab não pega sem isso).
2. Confirmar via SQL (query acima) que `duration_seconds` está gravando de
   verdade nos próximos trades fechados.
3. Continuar a paralelização de `get_mt5_quote` (lentidão por ativo é
   MetaAPI, não o modelo — achado real, correção ainda não implementada).
4. Observar estabilidade do Kimi K3 por mais tempo (algumas horas/dias) —
   a amostra desta sessão é pequena, a NVIDIA teve uma janela real de
   sobrecarga hoje que pode ou não se repetir.
5. `.env` local tem `MT5_REASONING_VALIDATOR_ENABLED=false` — não é
   commitável (config local), só um lembrete pra não reintroduzir o mesmo
   valor de modelo quebrado (`qwen35-trading`) se trocar o provider de
   novo sem ajustar isso junto.
6. Lembrete operacional: `watchdog.sh` está rodando de novo (fora do meu
   controle) — checar antes de qualquer `./restart.sh` manual futuro pra
   não repetir a corrida de processo duplicado.
