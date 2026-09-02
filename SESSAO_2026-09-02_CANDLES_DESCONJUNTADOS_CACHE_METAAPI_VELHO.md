# Sessão 2026-09-02 — Candles "desconjuntados" do preço (cache MetaAPI velho servido como atual)

## Relato do Cleber

Print + 2 vídeos (WhatsApp) mostrando, no Gráfico (EURUSD), uma linha
horizontal pontilhada branca (marca nativa de "último preço" do
klinecharts) flutuando bem longe de onde os candles reais estavam sendo
desenhados — como se preço e candles fossem de duas fontes diferentes,
sem relação entre si. Reproduzido em aba anônima também (descartando
cache/sessionStorage do navegador como causa).

## Investigação

1ª hipótese (desenho manual/régua presa na tela) e 2ª hipótese
(dessincronismo de resize/`chart.resize()`) foram descartadas por teste
direto com o Cleber: **Cmd+R não mudou nada** (descarta resize
transitório) e **aba anônima reproduziu igual** (descarta
`sessionStorage`/estado salvo no navegador).

Causa real encontrada ao vivo: no vídeo da aba anônima, o cabeçalho de
crosshair do candle mostrou **"2026-08-10 07:00"** — o gráfico estava
desenhando histórico de **quase 3 semanas atrás**, enquanto o preço no
topo (`PREÇO ATUAL`) e o painel BUY/SELL mostravam corretamente o preço
de HOJE (2026-09-02). A linha "flutuante" era a marca nativa de último
preço do klinecharts tentando se ancorar no último candle do array — que
não era o candle de hoje, e sim o último candle do cache antigo.

### Causa raiz (backend)

`/mt5-candles-history` (`supabase/functions/server/index.ts`, handler em
`app.post('/mt5-candles-history', ...)`, ~linha 4972) tem um cache
"cache-aside" em `ohlcv_data` (correto: barra fechada é imutável, evita
bater direto na conta MetaAPI compartilhada a cada refresh). O problema é
o fallback fail-open na paginação ao vivo (~linhas 5119-5171): se a busca
ao vivo no MetaAPI falha (timeout/HTTP não-ok) e já existe QUALQUER cache
para aquele símbolo/timeframe, o código quebra o loop e devolve **só o
cache antigo, com `success: true`**, sem nenhum sinal de que aquele dado
está desatualizado. O cliente não tinha nenhuma checagem de idade do
último candle — desenhava o cache de 3 semanas como se fosse o histórico
atual.

Não foi investigado NESTA sessão *por que* a busca ao vivo está falhando
para EURUSD/1H especificamente (rate-limit da conta MetaAPI compartilhada,
token, símbolo mal mapeado) — só o sintoma no cliente foi corrigido.
**Tarefa spawnada separadamente pro Cleber rodar** (`task_cd19e0ac`):
investigar a causa raiz no backend via logs do Supabase.

## Fix aplicado (client-side, NÃO commitado ainda)

Em `src/app/services/market-service.ts`, dentro de
`fetchCandlesFromMetaAPI`: depois de receber os candles do backend, checa
a idade do ÚLTIMO candle contra o timeframe — se estiver mais velho que
3x o intervalo esperado, trata como "sem dado real" (retorna `[]`, mesmo
caminho que já existia pra "MetaAPI indisponível") em vez de desenhar o
gráfico desconjuntado. Mesma disciplina do projeto ("nunca fabricar dado,
sempre erro explícito quando não há fonte real" — aqui o "fabricado" é
dado velho disfarçado de atual).

`tsc --noEmit` limpo (único erro que aparece,
`Cannot find module '/utils/supabase/info'`, é pré-existente e sem
relação com esta mudança).

## Pendências reais

1. **Commit pendente** (comando pronto entregue ao Cleber, não rodado por
   mim — regra fixa do projeto).
2. **Causa raiz da falha ao vivo no MetaAPI** para EURUSD/1H não
   investigada — task separada spawnada (`task_cd19e0ac`), rodando em
   sessão própria do Cleber no momento em que este arquivo foi salvo.
3. Fix client-side é um curativo: evita mostrar o gráfico errado, mas não
   resolve a causa (a busca ao vivo continuando a falhar). Vale, no
   backend, sinalizar `stale: true` explicitamente na resposta do
   `/mt5-candles-history` em vez de mascarar como sucesso — não
   implementado ainda.
4. Não confirmado se o mesmo problema afeta outros símbolos/timeframes
   além de EURUSD/1H, nem se é recorrente ou foi um episódio isolado de
   rate-limit.
