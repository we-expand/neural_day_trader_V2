# Sessão 2026-10-22 — Gráfico do EURUSD "não aparecia" (pintura pelo cache)

## Pedido
Cleber: "gráfico do euro-USD não está aparecendo". Contexto da manhã: o EURUSD já demorava demais pra abrir.

## Diagnóstico (medido, não suposto)
- Teste direto em `POST /functions/v1/server/mt5-candles-history` (exige `symbol, timeframe, startTime, endTime`):
  EURUSD 1H = HTTP 200 em **15,3 s** (72 candles), 5m = HTTP 200 em **5,4 s** (864 candles). Fonte `metaapi+cache`.
- Ou seja, o backend responde; o gráfico ficava vazio durante a espera da MetaAPI (que chega a 30 s+ ou 504).
- Cache `ohlcv_data` do EURUSD está fresco (última barra de 5m: 2026-10-22 14:45 UTC; 1m, 5m, 15m, 1h, 4h preenchidos).

## Conserto (no disco, SEM COMMIT)
Arquivos: `src/app/services/market-service.ts` e `src/app/components/ChartView.tsx`.
- Novo `fetchCandlesCacheOnly` lê candles fechados de `ohlcv_data` direto do Supabase (~0,3 s), só para forex/índice/commodity, devolve `[]` se não há sessão, cache esparso (<20 barras) ou falha. Nunca inventa dado.
- A 1ª pintura corre em corrida: cache x busca ao vivo; vence quem chegar primeiro. A busca ao vivo segue em paralelo e substitui o dataset preservando scroll/zoom; barra em formação vem dela.
- Se a busca ao vivo falhar depois de pintar pelo cache: toast "Sem dados ao vivo da corretora agora", mantém histórico salvo, não dispara busca pesada de 5 anos; o auto-refresh de 30 s segue tentando.
- Pintando pelo cache, não espera o preço ao vivo (aplicado quando chegar).
- `tsc --noEmit`: só o ruído antigo de "Stocks US", nenhum erro novo.

## Verificação no navegador local (`localhost:5173`, login feito pelo Cleber)
- Gráfico do EURUSD abriu em <5 s (1H), com linhas da venda aberta (entrada 1,12008, R:R 1:3,0).
- Ao trocar para 15m, console: `1ª pintura pelo CACHE ( 800 candles) — busca ao vivo segue em paralelo`.
- ~20 s depois a busca ao vivo ainda não tinha respondido (selo "desatualizado" no preço) = exatamente o cenário que o cache cobre.
- Não visto: o log "Cache substituído pelos candles ao vivo" (a busca ao vivo não terminou na janela observada).

## Pendente
1. **Commit + push** (Claude nunca commita sozinho):
   ```
   git add src/app/components/ChartView.tsx src/app/services/market-service.ts && git commit -m "fix(grafico): 1a pintura de forex/indice/commodity pelo cache ohlcv_data em paralelo com a busca ao vivo (EURUSD nao aparecia com a MetaAPI lenta)" && git push origin dev
   ```
2. Depois do deploy, testar no alias `dev` (nunca em URL de deploy com hash) e procurar no console "1ª pintura pelo CACHE".
3. Causa de fundo não resolvida: a MetaAPI/`/mt5-candles-history` segue lenta (15 s no 1H). Achado anterior da sessão: a versão publicada da função `server` ignora `cacheOnly` e vai à MetaAPI mesmo assim — por isso a leitura de cache é feita direto do navegador.
4. Servidor de dev local (porta 5173) ficou rodando.
