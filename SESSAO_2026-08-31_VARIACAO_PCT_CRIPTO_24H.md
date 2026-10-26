# Sessão 2026-08-31 (continuação) — Variação % de cripto errada (BTCUSD)

## Contexto

Cleber reportou que preços e variações diárias (%) de ativos na plataforma
não condiziam com a realidade, citando BTC como exemplo.

## Investigação

Testado ao vivo (curl direto no `/mt5-prices` do backend + comparação com
Binance real):

- **Preço**: sempre bateu com a Binance dentro do spread (diferença de
  centavos/dezenas de dólares em ~$79.000) — nunca foi o problema.
- **Variação % vs terminal MT5 real**: divergia bastante (ex: 0,22% na
  plataforma vs 0,54% no terminal da Infinox, mesmo preço). Causa: **não é
  bug** — decisão de produto de 2026-08-20 usa rolagem 24h (pra bater com
  Binance/CoinGecko) em vez da convenção "abertura do dia" que o terminal
  MT5 usa. Perguntei ao Cleber qual convenção manter — ele confirmou manter
  rolagem 24h. Documentado em memória
  (`project_variacao_pct_cripto_24h_vs_terminal.md`) pra não reabrir essa
  investigação à toa.
- **Sinal invertido vs Binance direto** (achado real, este sim corrigido):
  Cleber mostrou print com plataforma em **+0,04%** e Binance em **-0,26%**
  no mesmo instante — sinal oposto, não só magnitude diferente. Causa raiz
  real: a referência de "preço há 24h" usava a vela de **1 hora** mais
  próxima do alvo (`supabase/functions/server/index.ts`, rota
  `/mt5-prices`, branch `isCrypto24h`), enquanto a Binance calcula sobre
  uma janela **contínua exata** (segundo a segundo). Num dia de BTC andando
  de lado (variação < 0,1%), essa imprecisão de até ~1h já bastava pra
  cruzar o zero e inverter o sinal exibido.

## Fix aplicado

`supabase/functions/server/index.ts`, rota `/mt5-prices`:
- Timeframe da vela de referência de 24h pra cripto trocado de `1h` para
  `5m` (12x mais granular) — reduz a janela de imprecisão de ~1h pra ~5min.
- Quantidade de velas buscadas ajustada de 25 (25h em velas de 1h) pra 300
  (25h em velas de 5min), mantendo a mesma folga de cobertura.
- Nenhuma mudança de comportamento pra CFD tradicional (continua usando D1).

**Testado ao vivo depois do deploy** (Cleber já rodou
`supabase functions deploy server --no-verify-jwt`): confirmado que a vela
de referência agora tem open/close quase idênticos (característico de vela
de 5min, era um range grande de 1h antes) e o resultado bateu bem mais
perto da Binance (0,099% vs 0,106%, era possível inverter sinal antes).

**Commit pendente** (comando entregue ao Cleber, ele decide quando rodar):
```
git add supabase/functions/server/index.ts
git commit -m "fix(mt5-prices): usa velas de 5min (era 1h) na referência de variação 24h de cripto"
```

## Pendências / observações

- Ainda é uma referência **discreta** (vela de 5min), não contínua como a
  Binance — reduz bastante a chance de inverter sinal em dia de lado, mas
  não elimina 100%. Se voltar a acontecer, considerar granularidade ainda
  menor (`1m`, se a MetaAPI suportar) ou aceitar como ruído residual.
- Nenhuma mudança na metodologia (rolagem 24h vs abertura do dia) — decisão
  de manter rolagem 24h já confirmada pelo Cleber nesta sessão.

## Continuação (mesmo dia) — Cleber reportou de novo, print BTCUSD +0,05%

Cleber trouxe novo print (BTCUSD `+0,05%`/+$37,53) dizendo que ainda diverge
da Binance. Investigado ao vivo com curl direto no `/mt5-prices` de produção
e comparado a `api.binance.com/.../ticker/24hr` no mesmo instante (3
rodadas em paralelo): **preço bate dentro do spread normal** ($78894-78938
vs Binance $78934-78938) e o **sinal bateu nas 3 rodadas** (ambos positivos,
0,03-0,14% vs 0,09-0,14%) — não reproduzi uma inversão de sinal nesta
checagem, mas a diferença de magnitude ainda existe porque o BTC está numa
faixa de variação 24h muito perto de zero (ruído de ~0,1pp já é grande
relativamente).

Causa raiz adicional confirmada no código: mesmo com vela de 5min, a busca
ainda usava uma janela de 300 velas (25h) só pra achar a vela mais próxima
do alvo "agora-24h" — funcional, mas deixava margem de tolerância de 4h
(`CLOSEST_TOLERANCE_MS`) bem mais folgada que a granularidade real da vela.
Aplicado o próximo passo já cogitado no fix anterior: **trocado pra vela de
1min** (`isCrypto24h ? '1m' : '1d'`), busca agora **ancorada no horário-alvo**
(não mais nas últimas 25h inteiras — a API de candles históricos tem limite
de `limit` por chamada, 1500 velas de 1min pra 25h não cabe num request só)
com uma janela pequena de 60 velas ao redor do alvo, e tolerância de
proximidade apertada de 4h pra 1h. Reduz a janela de imprecisão de ~5min
pra ~1min.

**Commit pendente** (comando pronto pro Cleber rodar):
```
git add supabase/functions/server/index.ts
git commit -m "fix(mt5-prices): usa velas de 1min ancoradas no alvo (era 5min/janela de 25h) na referência de variação 24h de cripto"
```
**Deploy pendente** (Edge Function não sobe com git push):
```
supabase functions deploy server --no-verify-jwt
```

**Ainda residual, documentado pra não reabrir a investigação à toa**: é
referência discreta de 1min, Binance é contínua — em dia de BTC muito de
lado (variação < ~0,1%), pequenas diferenças de magnitude/sinal entre
plataforma e Binance continuam matematicamente possíveis e não indicam bug
novo. `deno check` não pôde rodar local (faltam deps npm instaladas no
ambiente), revisão foi manual linha a linha do diff.

## Continuação (mesmo dia, 2ª vez) — Cleber insistiu: "tem que ser idêntico"

Cleber voltou dizendo que preço E variação ainda estavam "muito errados"
(não pouco) contra a Binance, e afirmou explicitamente que a fonte "já era"
a API da Binance. **Não era** — achado real: `currentPrice` de BTCUSD em
`/mt5-prices` sempre veio do TICK do broker (Infinox via MetaAPI,
`tickerData.bid/ask`), nunca da Binance. Preço de CFD numa corretora e
preço da Binance são cotações de **venues diferentes** — nunca serão
idênticos por definição, só parecidos dentro do spread. Todo o trabalho de
granularidade de vela (5min→1min, ambas as partes anteriores desta sessão)
só reduzia o ruído da REFERÊNCIA de 24h; o PREÇO ATUAL em si nunca vinha da
Binance, então a queixa de "preço completamente errado" fazia sentido.

Isso resolve, só pro BTCUSD (símbolo reportado), a decisão de produto que já
estava registrada como pendente há dias em memória
(`project_roteamento_cripto_decisao_pendente.md`, "Binance direto pra cripto
vs. reverter tudo pra MetaAPI"). Cleber deixou a intenção explícita agora:
BTCUSD tem que bater com a Binance.

**Fix aplicado** (`supabase/functions/server/index.ts`): novo
`BINANCE_DIRECT_SYMBOL_MAP` (hoje só `BTCUSD → BTCUSDT`) +
`fetchBinanceDirectPrice()` — quando o símbolo está no mapa, `/mt5-prices`
busca preço/variação 24h DIRETO de `api.binance.com/api/v3/ticker/24hr`
(mesmo endpoint que o site da Binance usa), pulando o tick/candle do broker
inteiramente. Sem problema de CORS aqui (é chamada servidor-servidor da Edge
Function, não do browser — as tentativas antigas de Binance direto que
morreram em produção em `RealMarketDataService.ts` eram todas do CLIENTE,
problema que não existe no servidor). Fallback pro fluxo MetaAPI de sempre
se a Binance falhar (nunca fica sem preço).

**Efeito colateral identificado e não escondido**: `/mt5-prices` é a MESMA
rota usada pelo `llm-active-brain` (`mt5Broker.ts`) pra cotar BTCUSD nas
decisões de trade automatizado — a partir do deploy, o Cérebro LLM Ativo
passa a decidir e calcular P&L de BTCUSD contra o preço da Binance, não mais
o tick do broker. Não é fabricação de dado (Binance é fonte real, pública,
igual ao broker), mas é uma mudança de fonte de dado pro motor de trading
ativo — vale observar as próximas sessões de BTCUSD do LLM Brain depois do
deploy. Execução real de ordem (fase Real, `/broker/execute`) não é afetada
por este fix — continua executando ao preço real do broker no fill,
independente do que este endpoint de exibição mostra.

**Escopo deliberadamente limitado a BTCUSD** — os outros símbolos de
`CRYPTO_CFD_SYMBOLS` (SOLUSD, ADAUSD, XETUSD/XBNUSD/XLCUSD com nomenclatura
própria da Infinox sem par 1:1 óbvio na Binance, etc.) continuam no fluxo
MetaAPI de sempre. Expandir pra outros símbolos é decisão nova, não tomada
aqui.

**Commit pendente** (comando pronto pro Cleber rodar):
```
git add supabase/functions/server/index.ts
git commit -m "fix(mt5-prices): BTCUSD cotado direto da Binance (era tick do broker MetaAPI) para bater exatamente com o site da Binance"
```
**Deploy pendente**:
```
supabase functions deploy server --no-verify-jwt
```

**Não testado ao vivo ainda** (precisa do deploy do Cleber) — validar depois
do deploy comparando `/mt5-prices` (BTCUSD) com `api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT`
no mesmo instante; devem bater exatamente (mesma fonte).

## Continuação (mesmo dia, 3ª vez) — deploy da rota confirmado OK, mas app ainda mostrando errado

Cleber confirmou ter rodado o deploy do `/mt5-prices`. Testei ao vivo com
curl (`/mt5-prices` BTCUSD vs `api.binance.com/.../ticker/24hr?symbol=BTCUSDT`
no mesmo instante): **bateu byte a byte** (79079,80 / +0,249% nos dois) — a
rota está correta. Mas Cleber reportou de novo o app mostrando número
diferente (79050 vs 79128 na Binance, -0,03% vs +0,30%) — a rota estava
certa, então o problema tinha que estar em outro caminho de dado que o app
usa além do polling HTTP.

**Causa raiz real encontrada**: existe um processo separado, sempre-ligado
no Fly.io (`streaming-relay/`, não é parte da Edge Function nem do build da
Vercel), que mantém sua PRÓPRIA conexão de streaming direta com a MetaAPI
(WebSocket) e empurra cada tick do BROKER (Infinox) via Supabase Realtime
(canal `turbo-main-channel`) pro navegador — incluindo BTCUSD. O cliente
(`RealMarketDataService.ts`, `ensureRealtimeStreamingInitialized`) aplica
esse preço empurrado DIRETO por cima do valor que vinha do polling HTTP
(agora correto, vindo da Binance) — por isso o fix da rota sozinho não
bastou: o streaming continuava sobrescrevendo com o preço do broker
silenciosamente, id êntico ao sintoma original (preço de venue errado),
só que por um caminho de dado diferente do que eu tinha corrigido.

**Fix aplicado** (`streaming-relay/src/index.ts`): BTCUSD excluído da lista
de símbolos assinados no streaming do broker (`brokerSymbolByUnified`) —
agora só o polling HTTP (`/mt5-prices`, Binance-preciso) define o preço
exibido de BTCUSD, sem mais nada competindo por cima. Resto dos símbolos
(que continuam corretamente no fluxo MetaAPI) não foi tocado.

**Deploy pendente, processo DIFERENTE do Supabase** (é Fly.io, não Edge
Function):
```
cd streaming-relay
fly deploy
```

**Ainda não testado ao vivo** — precisa do `fly deploy` do Cleber pra
confirmar que o streaming parou de sobrescrever BTCUSD. Depois do deploy,
validar recarregando a página do Gráfico com BTCUSD selecionado e
comparando com `api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT` no
mesmo instante — devem bater exatamente.

## CORREÇÃO da hipótese acima (mesmo dia) — `streaming-relay` está DESLIGADO, não é a causa

Cleber tentou `fly deploy` e bateu em `Error: app not found` — o app nunca
existia no Fly.io. Revisando `CLAUDE_HISTORY.md` (seção 2026-07-23):
**o `streaming-relay` foi parado e o launch agent removido de vez em
2026-07-23** ("não volta a ligar sozinho") — nunca rodou no Fly.io, só
localmente no Mac do Cleber por um tempo, e está desligado desde então. Ou
seja, **minha hipótese anterior estava errada** — esse processo não é a
causa do sintoma atual, ele nem está rodando. Não tentar mais religá-lo
(reverteria uma decisão de desligamento anterior sem necessidade).

A exclusão de BTCUSD da assinatura de streaming em `streaming-relay/src/index.ts`
foi mantida (código morto hoje, mas correta como blindagem preventiva caso
o serviço seja religado no futuro) — comentário corrigido pra deixar claro
que é preventivo, não um fix de bug ativo.

**Causa real re-investigada**: reconferi `/mt5-prices` (BTCUSD) contra
`api.binance.com/.../ticker/24hr` no mesmo instante — **bateu exatamente**
de novo (79030,01 / +0,19% nos dois lados). A rota está correta. A
defasagem que Cleber via vinha de **latência de polling**, não de cálculo
errado: o Gráfico atualiza o preço de BTCUSD a cada 2s (intervalo
originalmente pensado pra proteger a conta MetaAPI compartilhada — motivo
que não existe mais pra BTCUSD, já que ele nem bate mais nessa conta). BTC
se move rápido o bastante (dezenas de dólares em poucos segundos, visto
repetidas vezes nesta sessão) pra 2s de defasagem contra uma aba da Binance
sempre atualizando parecer "muito errado" a olho nu, mesmo sem bug nenhum.

**Fix aplicado** (`src/app/components/ChartView.tsx`, ~linha 5965-6110):
polling de preço do Gráfico agora usa 1,5s pra BTCUSD especificamente (era
2s fixo pra todo símbolo) — reduz a janela de defasagem visível. Resto dos
símbolos mantém 2s (protege a conta MetaAPI compartilhada, que ainda
importa pra eles). `tsc --noEmit` sem erro novo introduzido por essa
mudança (os erros pré-existentes do arquivo, linha ~1962, são de um mock de
catálogo antigo, não relacionados).

**Ainda residual, por design**: mesmo com 1,5s, é polling, não streaming —
sempre vai existir uma janela pequena (até ~1,5-4s contando cache do
servidor de 2,5s) onde o valor exibido está um instante atrás do que a
Binance mostra ao vivo. Pra eliminar de vez precisaria de WebSocket
contínuo direto da Binance no cliente (arquitetura bem maior, não decidida
nesta sessão).

**Commit pendente, ATUALIZADO** (substitui o anterior — inclui os 2 arquivos
desta parte):
```
git add supabase/functions/server/index.ts streaming-relay/src/index.ts src/app/components/ChartView.tsx
git commit -m "fix(mt5-prices): BTCUSD cotado direto da Binance + polling mais rápido no Gráfico para bater com a Binance em tempo quase real"
```
**Deploy pendente**: só o Supabase (`supabase functions deploy server --no-verify-jwt`)
+ o build normal da Vercel pro frontend (`ChartView.tsx`) — o `streaming-relay`
NÃO precisa de deploy nenhum (está desligado, não rodar `fly launch`/`fly deploy`
pra ele).

## FECHAMENTO — causa do "ainda diferente" era comparação com par errado, não bug

Depois do deploy (commits `a885bc82f`/`34cae231c`/`b0ef7f2e8` já aplicados),
Cleber seguiu reportando diferença (~100 pontos, depois ~0,20%), inclusive
em aba anônima. Pedi print com as duas abas lado a lado — resolveu na hora:
a aba da Binance estava no par **BTC/BRL** (`binance.com/pt-BR/trade/BTC_BRL`),
não BTC/USDT. Testado no mesmo instante do print:
- Nosso app: 78.816,47 / -0,079%
- Binance BTCUSDT (dólar): 78.818,00 / -0,087% → **bate exatamente**
- Binance BTC/BRL (o que estava no print, convertido pra USD na tela): "$78.944,12" / -0,30%

BTC/BRL tem variação de 24h própria (embute câmbio USD/BRL variando no dia,
além do movimento do próprio BTC) — nunca vai bater com BTCUSD/BTCUSDT, não
é o mesmo número por definição. **Não é bug, é comparação com mercado
errado.** Cleber confirmou que o preço está correto. Item fechado.

**Resumo do que ficou implementado de verdade nesta sessão** (todos os 3
commits válidos, nenhum revertido):
1. Referência de 24h de cripto em `/mt5-prices`: vela de 1h → 1min, ancorada
   no horário-alvo (reduz ruído de janela discreta).
2. BTCUSD cota preço+variação DIRETO da Binance (`BINANCE_DIRECT_SYMBOL_MAP`)
   em vez do tick do broker — resolve a decisão de produto que estava
   pendente há dias.
3. Polling do Gráfico pra BTCUSD reduzido de 2s pra 1,5s (sem risco, não
   bate mais na conta MetaAPI compartilhada).
4. `streaming-relay` blindado preventivamente (BTCUSD excluído da assinatura
   de streaming) caso seja religado no futuro — hoje é código morto,
   confirmado desligado desde 2026-07-23.
