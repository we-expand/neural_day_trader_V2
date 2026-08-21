# Sessão 2026-08-21 — Sobrecarga da conta MetaAPI compartilhada (polling descoordenado)

## Contexto / como chegamos aqui

Sessão começou com Cleber reportando o gráfico de EURUSD "não aparecendo".
Investigação em duas rodadas achou e corrigiu dois problemas reais no
caminho do **gráfico** (candles):

1. `src/app/services/market-service.ts` pedia sempre no mínimo 5 anos de
   histórico (`MAX_CANDLES = 10_000`), forçando paginação pesada em
   timeframes intraday (até ~10 páginas sequenciais na Binance, com sleep de
   150ms entre elas, e paginação equivalente escondida no backend do
   MetaAPI). **Fix aplicado**: `MAX_CANDLES` reduzido pra `2_000` — timeframes
   intraday caem pra no máximo ~2 páginas; diário/semanal continuam
   recebendo os 5 anos completos (5 anos de candle diário são só ~1825
   barras, bem abaixo do novo teto), então não regride o motivo original do
   teto de 5 anos (zoom-out).
2. O fetch de `/mt5-candles-history` no cliente não tinha timeout —
   **fix aplicado**: `AbortSignal.timeout(15_000)` no fetch do
   `market-service.ts` (linha ~255), pra falhar rápido e explícito em vez de
   travar a UI indefinidamente se o backend estiver lento/rate-limited.

Depois desses dois fixes, Cleber continuou vendo demora (~1 min) ao trocar
de ativo/timeframe. Investigação nos logs do Supabase (`query_logs`, projeto
`wyvdsxtcmizettljxtbg`) confirmou: entre **13:36 e 13:42 UTC** de hoje houve
um surto real de **dezenas de erros 502 seguidos** em `/mt5-candles-history`
(~5,5-8s cada até falhar), voltando a `200 OK` em ~1,3-3,4s a partir de
13:43 — instabilidade momentânea da conta MetaAPI compartilhada, não bug do
código. Recomendei testar de novo fora dessa janela.

Só que aí Cleber perguntou a pergunta certa: **de onde vem esse excesso de
chamadas que sobrecarrega a API?** — o que levou a esta investigação mais
ampla, registrada abaixo.

## O que os logs mostram

Query no período de 1h (`function_edge_logs`, projeto `wyvdsxtcmizettljxtbg`):

| Rota | Chamadas/1h | Latência média | Latência máx |
|---|---|---|---|
| `mt5-prices` | **5.275** | 4,3s | 30,5s |
| `real` (proxy legado) | 3.840 | 0,8s | 10,1s |
| `binance-ticker` | 1.519 | 0,5s | 7,3s |
| `mt5-candles-history` | 676 | 3,9s | 112,4s |

`mt5-prices` (cotação/preço) domina de longe o volume — não é o gráfico
(`mt5-candles-history`) o principal consumidor da cota. O volume é
**sustentado**: entre 70 e 190 chamadas/minuto continuamente pela hora
inteira analisada, não um pico isolado.

## Mapeamento das fontes de polling (verificado manualmente linha a linha)

Uma primeira investigação delegada a um agente teve **dois erros** que só
foram pegos ao conferir o código na mão — registrado aqui pra não repetir:
achou que `MarketContext.tsx` disparava a cada 5s (na verdade é a cada
**2 minutos** — `subscribeToMarketData(MONITORED_ASSETS, callback, 120000)`,
`MarketContext.tsx:185`) e achou que dois mecanismos do `ChartView` eram
duplicados quando na verdade servem propósitos diferentes (painel demo do
modal de busca de ativos vs. streaming do candle selecionado).

Tabela final, com intervalos confirmados por leitura direta do código
(não por relatório de agente):

| Fonte | Intervalo real | Símbolos/tick | Chamadas/min | Quando roda |
|---|---|---|---|---|---|
| `contexts/MarketDataContext.tsx:358` (`refreshPrices` → `getBatchedMT5Data`) | 5s | ~9, batched (1 chamada) | ~12 | **Sempre** — provider na raiz (`App.tsx:408`) |
| `components/MarketTicker.tsx:144` (`fetchTickers` → `getBatchedMT5Data`) | 10s | ~50, batched (1 chamada) | ~6 | **Sempre** — fora do switch de view (`App.tsx:381`) |
| `contexts/MarketContext.tsx:157` (`subscribeToMarketData`, `RealMarketDataService.ts:786`) | **2 min** | 10, **individuais** (não batched) | ~5 | **Sempre** — provider na raiz (`App.tsx:407`) |
| `services/MarketDataHealthMonitor.ts:51` | 30s | 1 (health check) | ~2 | **Sempre** — auto-start ao importar módulo, importado estaticamente via `Settings.tsx`/`DataSourceRouter.ts` |
| `components/dashboard/MarketScoreBoard.tsx:610` (`fetchData`) | até 2s, mas com backpressure real (~3-8s de latência observada) | 1 (ativo selecionado) | ~10-20 | Só com **Dashboard** aberto |
| `components/ChartView.tsx:5614` (`subscribeToSymbol`) | 5s (comentário no código dizia "2s" — desatualizado, o valor real passado é o default `intervalMs=5000` de `subscribeToSymbol`) | 1 (ativo selecionado) | ~12 | Só com **Gráfico** aberto |
| `supabase/functions/ai-runner/lib/positionManager.ts:93` (`getBatchedMT5Data`) | 1 min (cron) | N (posições abertas de todos os usuários), batched | baixo | **Sempre**, servidor, independe de navegador |

Somando Dashboard + Gráfico abertos numa única aba: **~47-57 chamadas/min**
calculadas — abaixo dos 70-190/min observados nos logs. A diferença mais
provável: **múltiplas abas/sessões abertas ao mesmo tempo** (do próprio
Cleber testando, ou de outros usuários reais da plataforma), cada uma
somando linearmente ao mesmo total, já que não existe nenhum cache
central do lado do servidor — cada aba de cada usuário faz seu próprio
polling independente contra a mesma conta MetaAPI compartilhada.

Componentes de debug (`BtcPriceDebug`, `PriceValidationStatus`) e alguns
serviços (`SupabasePriceSyncService`, `useMT5Prices`/`useMT5Price`,
`useSmartMarketData`) são código morto confirmado — não montados em
nenhuma tela real, não contribuem pro volume.

## Conclusão

**Não é um bug pontual.** É uma limitação estrutural: ~6 pipelines de
polling client-side independentes, cada um razoável isoladamente e a
maioria já com proteção própria (batching, backpressure, comentários
citando incidentes de sobrecarga anteriores de 07-08, 07-10, 07-20), mas
**nenhum coordenado com os outros nem com outras sessões/usuários** — todos
batem direto na mesma conta MetaAPI compartilhada da plataforma. Bate com o
"Risco crônico conhecido" já registrado no CLAUDE.md, agora com número real
por trás (70-190 chamadas/min sustentadas, surtos de 502 documentados).

Não fiz nenhuma mudança de código pra "consolidar" os pipelines nesta
sessão — o ganho de qualquer corte pontual (ex: aumentar o intervalo do
`MarketScoreBoard`) seria pequeno (~10-15/min) perto do tamanho real do
problema, e mexeria em lógica com histórico de incidente documentado sem
poder testar visualmente (a URL de preview do Vercel pede login que não
tenho acesso nesta sessão).

## Plano de fix estrutural (não implementado — decisão de arquitetura, precisa de Cleber)

O fix de verdade é trocar "N clientes pollando a conta compartilhada cada
um por conta própria" por **um único ponto de coleta no servidor,
distribuindo pra todos os clientes**:

1. **Poller único no backend** (Edge Function agendada via `pg_cron`, nos
   moldes do `ai-runner`) busca os preços dos símbolos mais usados (a união
   do que `MarketDataContext`/`MarketTicker`/`MarketScoreBoard`/`ChartView`
   hoje buscam cada um por conta própria) numa cadência fixa (ex: a cada
   3-5s) e grava numa tabela/cache (`kv` ou tabela dedicada) no Supabase.
2. **Clientes passam a ler desse cache** em vez de bater direto no MetaAPI:
   - Opção simples: os hooks/contexts existentes trocam a chamada a
     `getBatchedMT5Data`/`getRealMarketData` por uma leitura no
     Supabase (`select` direto, ou uma Edge Function fina que só lê o
     cache — nunca chama MetaAPI diretamente).
   - Opção mais robusta: usar **Supabase Realtime** (subscription na
     tabela de preços) pra os clientes receberem push em vez de fazer
     polling eles mesmos — elimina de vez a necessidade de qualquer
     `setInterval` de rede no client para preço.
3. Isso reduz o tráfego contra a conta MetaAPI de "N clientes × M símbolos
   cada, por sessão" pra **1 poller × M símbolos, total, para toda a
   plataforma** — independe de quantos usuários/abas estão olhando ao mesmo
   tempo.
4. Escopo real: não é um patch pequeno — mexe em `MarketDataContext.tsx`,
   `MarketContext.tsx`, `MarketTicker.tsx`, `MarketScoreBoard.tsx`,
   `ChartView.tsx` (todos os pontos de streaming de preço listados acima) e
   precisa de uma migration nova (tabela de cache) + uma Edge Function nova
   (o poller) + `pg_cron` agendando ela. Também precisa decidir a cadência
   certa do poller único (mais rápido que os clientes individuais de hoje,
   já que agora é só uma fonte, mas ainda respeitando o limite real da conta
   compartilhada).

**Não iniciado.** Próximo passo, quando Cleber decidir entrar nisso: desenhar
o schema da tabela de cache e o contrato da Edge Function do poller antes de
tocar em qualquer componente cliente, pra não repetir o padrão de "fix
pontual que ajuda um pouco mas não resolve a causa estrutural".
