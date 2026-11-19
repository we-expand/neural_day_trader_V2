# Sessão 2026-09-02 — Rate-limit MetaAPI: cotação em lote (1 requisição/ciclo)

## Diagnóstico (dado real, não suposição)

Log do `llm-active-brain` (processo único, PID 80109, rodando desde
11:40 — mesmo horário da redução de cesta 16→10→7 feita mais cedo hoje):
desde então, **35 de 221 tentativas de cotação (~16%) esgotaram as 3
retentativas** e caíram no fallback de "último preço conhecido"
(`mt5Broker.ts`), distribuído por quase todos os ativos da cesta — não é
um símbolo com problema, é a conta MetaAPI compartilhada sob carga. Nas
últimas linhas do log (momento da investigação, ~14h) o padrão piorou:
praticamente todos os 7 ativos falhando em sequência no mesmo ciclo,
incluindo posições reais abertas (EURUSD, BTCUSD) sem PnL flutuante
calculável.

Causa raiz encontrada no código, não só no log: `get_mt5_quote`,
`open_position`, `close_position` e `enforceMt5StopsAndTargets` cada um
disparava sua PRÓPRIA requisição HTTP a `/mt5-prices` com **1 símbolo por
vez** — um ciclo de 10s com 7 ativos virava até 7+ requisições sequenciais
separadas, cada uma competindo pela mesma conta MetaAPI que o polling do
Gráfico no navegador também usa (disputa já documentada no CLAUDE.md). O
cache compartilhado do servidor (`priceCache`, `PRICE_CACHE_TTL_MS=2500`)
é por símbolo — símbolos diferentes nunca reaproveitavam cache entre si,
então cada chamada nova era quase sempre um MISS.

Achado extra, confirmado lendo `supabase/functions/server/index.ts`
(`/mt5-prices`, linha ~4160): o endpoint **já aceita `symbols: [...]` em
lote** e já tem `mapWithConcurrency` (concorrência 8) + um retry de 700ms
embutido pros símbolos que falharem na 1ª tentativa — infraestrutura que
o `llm-active-brain` nunca usava, porque sempre mandava arrays de 1
elemento só.

## Fix aplicado

`llm-active-brain/src/mt5Broker.ts`: refatorado pra separar busca de rede
(`fetchTicks`, agora aceita array de símbolos) do processamento de tick
(`processTick`, puro, sem I/O — mesma lógica de sempre, intocada: stale,
dedupe de feed travado, alimentação do tickHistory). Novo
`primeQuotes(symbols[])` busca a cesta INTEIRA numa única requisição e
popula um cache local (`QUOTE_CACHE_TTL_MS=8000`, um pouco menor que o
ciclo de 10s). `getQuote(symbol)` passa a ler esse cache primeiro, só cai
pro fetch individual de sempre (com as 3 retentativas já existentes) se o
símbolo não foi priming ou o cache expirou — nenhuma proteção existente
foi removida, só evita repetir a mesma cotação 5-7x por ciclo.

`llm-active-brain/src/index.ts`: `primeQuotes(MT5_ASSET_BASKET)` chamado
1x por ciclo, antes do loop de sessões (a cesta é global, não por
usuário, então todas as sessões do ciclo reaproveitam o mesmo priming).

Efeito esperado: de até 7+ requisições HTTP separadas por ciclo pra
**1 requisição** cobrindo a cesta inteira, usando o retry/concorrência que
o servidor já tem pronto — sem tirar nenhum ativo da cesta.

`tsc --noEmit` (`llm-active-brain`): limpo. `npm run validate`: 37/37.

## Pendente

- Nenhuma ação de código pendente — fix pronto, aguardando Cleber
  commitar e reiniciar o processo.
- Sem validação estatística ainda de quanto isso reduz a taxa de falha —
  medir contra o log depois do restart (comparar % de "depois de retry"
  antes/depois).
- Migração do Gráfico (`ChartView.tsx`) pro mesmo tipo de otimização (hoje
  faz polling por símbolo aberto individualmente) fica fora de escopo
  desta sessão — mitigaria a MESMA disputa do lado do navegador, mas não
  foi tocada aqui.

## Comandos prontos

```bash
git add llm-active-brain/src/mt5Broker.ts llm-active-brain/src/index.ts SESSAO_2026-09-02_RATE_LIMIT_METAAPI_BATCH_QUOTES.md
git commit -m "$(cat <<'EOF'
perf(llm-brain): busca a cesta inteira numa unica requisicao por ciclo (mitiga rate-limit MetaAPI)

Cada get_mt5_quote/open_position/close_position/enforceMt5StopsAndTargets
disparava sua propria requisicao a /mt5-prices com 1 simbolo -- ate 7+
chamadas HTTP sequenciais por ciclo de 10s, disputando a mesma conta
MetaAPI compartilhada com o polling do Grafico. primeQuotes() agora busca
a cesta inteira em 1 requisicao (o endpoint ja suporta symbols:[...] com
concorrencia+retry propria) e popula um cache local de 8s; getQuote() le
dele primeiro, so cai pro fetch individual de sempre se nao tiver cache.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

Depois de aplicar, restart do motor (procedimento padrão, mata o antigo e
confirma 1 só rodando):

```bash
cd llm-active-brain && ./restart.sh
```
