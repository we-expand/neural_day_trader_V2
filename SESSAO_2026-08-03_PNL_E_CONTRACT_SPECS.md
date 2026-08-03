# Handoff — P&L, contract specs em lote e visibilidade de posição (sessão 2026-08-03, continuação)

> **Ponto de entrada pra retomar.** Esta sessão começou testando a boleta já
> corrigida em [SESSAO_2026-08-03_BOLETA_ORDEM_MANUAL.md](SESSAO_2026-08-03_BOLETA_ORDEM_MANUAL.md)
> (bug do clique resolvido) e escalou pra uma cadeia de bugs reais de
> cálculo/visibilidade encontrados testando ordens DEMO de verdade. Estado no
> fim: **vários fixes reais aplicados e com `npm run validate` + `npm run
> build` passando, mas parte deles ainda não commitada/pushada** — ver seção
> "Status do git" antes de assumir que algo já está em produção.

## Ordem cronológica do que foi encontrado e corrigido

### 1. TP/SL zerado fechava posição manual sozinha em segundos
Guard de `hitTP`/`hitSL` em `useApexLogic.ts` (~linha 2179) não checava se
`tp`/`sl` eram realmente `> 0` — uma ordem manual sem alvo definido (`tp: 0`)
fazia `nextPrice >= 0` ser sempre verdadeiro, fechando a posição no primeiro
tick de preço seguinte. Corrigido com guard `tp > 0 &&` / `effectiveSl > 0 &&`.
**Commit `ba443389d`, já pushado.**

### 2. P&L calculado com alavancagem em dobro
`calculatePnLWithLeverage` (`src/config/contractSpecs.ts`) multiplicava
`marginAmount * leverage`, mas `TradeVisual.amount` já é o capital/exposição
total da posição (documentado em `lotSizeConversion.ts`: "leverage do asset é
informativo de UI, não entra nesta conta"). Removida a multiplicação por
`leverage` no cálculo de `effectiveSize`. **Commit `f4ea84e3c`, já pushado.**

### 3. Card "Posições Abertas" do Dashboard mostrava valor em dólar como "lotes"
`MarketScoreBoard.tsx` fazia `order.amount.toFixed(2)` rotulado como "lotes" e
`order.amount * order.price` como "Volume" — `order.amount` já é o valor em
dólar, então isso multiplicava o preço duas vezes (gerava números tipo
$29.413.647,20 pra uma posição de 0,01 lote). Corrigido pra mostrar lotes
estimados de verdade (`amount / (lotSize * price)`) e o valor em dólar direto
como "Exposição". **Commit `f4ea84e3c`, já pushado.**

### 4. Descoberta grande: 336 de 475 ativos com contract spec ausente ou errada
Investigando por que SPX500 dava P&L absurdo (-$87 pra um movimento que devia
gerar ~-$4,35), descobri que `getContractSpec()` (`src/config/contractSpecs.ts`)
cai num fallback genérico de forex (tickSize 0,00001) quando não acha o
símbolo em `INFINOX_CONTRACT_SPECS`, e que o fuzzy-match por substring é
perigoso pra tickers curtos — `GE` (General Electric) batia na spec do índice
`GER40`, `F` (Ford) e `C` (Citigroup) batiam em `USDCHF`, `LIN` (Linde) batia
em `LINKUSD` (cripto), `GS` (Goldman Sachs) batia em `GSK`.

Escrevi dois scripts novos (permanentes, seguem o padrão de
`scripts/audit-broker-symbols.mjs` já existente):
- `scripts/audit-contract-specs.mjs` — varre `assetDatabase.ts` inteiro e
  reporta todo símbolo sem match exato em `CONTRACT_SPECS`.
- `scripts/generate-missing-contract-specs.mjs` — gera as entradas faltantes:
  alias 1:1 pra spec real já existente sob outro nome quando existia (ex.
  `WHEUSD`→`WHEATUSD`, `JP225`→`JPN225`), senão aplica o padrão de categoria
  já usado no arquivo (`STOCK_STANDARD`/`INDICES_US`/`BOND_US`/etc.), sempre
  sinalizado como aproximação, não tick calibrado por símbolo.

Resultado: **240 sem spec nenhuma + 96 fuzzy perigoso = 336 corrigidos**.
Reauditado depois: 0 sem spec, só 2 fuzzy restantes (`DOGEUSD`/`BTCUSDCRP`,
confirmados corretos — mesmo instrumento, nome ligeiramente diferente).
**Alteração em `src/config/infinoxContractSpecs.ts` — AINDA NÃO COMMITADA.**

### 5. Lote mínimo de índices — pesquisa de mercado
Pesquisei (WebSearch) convenção de lote mínimo por categoria de ativo em
corretoras CFD de varejo. Achado: 0,01 (micro lote) é o padrão mais comum pra
índices hoje (0,1 existe, ex. OANDA, mas é minoria). Auditei o catálogo:
**todos os 19 índices** usavam `minLot: 0.1` — decisão de categoria
consistente, não erro isolado do SPX500. Commodities/títulos/ações já
seguiam convenções sensatas, não precisaram de correção. Baixado
`minLot` de índices de 0,1 pra 0,01, documentado no código como aproximação
de mercado (não confirmei o número exato publicado pela Infinox).
**Alteração em `src/app/config/assetDatabase.ts` — AINDA NÃO COMMITADA.**

### 6. Posição não aparecia no gráfico/boleta em outro símbolo
Não é bug — posição/overlay só pode ser desenhada no gráfico do próprio
símbolo, e o símbolo selecionado é persistido separadamente. Adicionado um
alerta fixo na boleta (`⚠ posição aberta em X — ver`, clicável) que aparece
independente do símbolo atual, cobrindo esse caso pra sempre.
**Alteração em `OrderTicket.tsx` — AINDA NÃO COMMITADA** (fixes #6, #7 e #9
abaixo estão todos no mesmo arquivo modificado, não commitados juntos).

### 7. Preço de entrada faltando na boleta recolhida + botão de fechar
Botão "Fechar posição" (chama `closeManualPosition`, já existia no motor mas
nunca tinha UI) adicionado nos dois modos da boleta. Preço de entrada
(`@ {price}`) adicionado na linha de posição do modo recolhido (só o
expandido tinha). **Commit do botão de fechar: `1103215e9`, já pushado.**
**Preço de entrada no modo recolhido: AINDA NÃO COMMITADO** (fix posterior,
mesmo arquivo `OrderTicket.tsx`).

### 8. P&L ao vivo (dólar + pontos) na linha do gráfico
`renderPositionOverlays` (`ChartView.tsx`) agora mostra
`▲ COMPRA 54234.35 · +$0.31 (+31.41 pts)` na própria linha de entrada,
atualizando a cada tick. **Commit `1103215e9`, já pushado.**

### 9. Linha de posição sumia do gráfico ao trocar timeframe
Trocar timeframe dispara `dispose()`+`init()` do gráfico inteiro — um gráfico
novo não tem overlay nenhum, e o efeito que desenha posição só reage a
`activeOrders`/`pendingOrders`/`selectedSymbol`, nunca a `timeframe`. Corrigido
chamando `renderPositionOverlays` também dentro do efeito que recria o
gráfico (mesmo ponto onde S/R já fazia isso corretamente).
**Alteração em `ChartView.tsx` — AINDA NÃO COMMITADA** (mesmo arquivo do
alerta de posição em outro ativo).

### 10. Suporte/Resistência em laranja pontilhado
Antes verde/vermelho sólido-ou-pontilhado, confundia com linhas de
posição/SL/TP (mesmas cores). Trocado pra laranja pontilhado uniforme, texto
S/R mantido. **Commit `844ef7820`, já pushado.**

### 11. Diagnóstico: SPX500 "sumindo"/não carregando — NÃO é bug
Testado direto contra `/mt5-prices` com `curl` (não via app): `BTCUSD`,
`SPX500` e `SOLUSD` devolveram `HTTP 504` igualmente, inclusive `BTCUSD` que
sabidamente funciona. É o risco crônico já documentado no `CLAUDE.md`
principal (conta MetaAPI compartilhada, rate-limit/timeout sob carga) — não
uma regressão desta sessão nem um problema de nome de símbolo. Sem ação de
código; esperar e tentar de novo é o caminho.

### 12. Botões de ordem desabilitados nunca disparavam clique sem preço carregado
Os 4 botões COMPRAR/VENDER tinham `disabled={!canTrade}` — um `<button
disabled>` **nunca dispara `onClick`** no DOM, nem chega no log 🟢 de
diagnóstico. Sempre que `currentPrice` ainda não tinha carregado no instante
do clique (comum logo após login), o clique era ignorado em silêncio total —
essa é a causa raiz de TODOS os "clico e nada acontece" desta sessão inteira,
não um bug pontual. Corrigido: `disabled` agora só depende de `submitting`
(evita duplo envio); o guard dentro de `executeOrder` (que já existia) agora
mostra `toast.error` com o motivo real em vez de só `console.warn`.
**Commit `6f166170f`, já pushado.**

### 13. BTCUSDT era o símbolo padrão mas nunca existiu no catálogo de trading
Investigando o toast novo do fix #12 (apareceu "Motivo desconhecido"), achei
que `blockedReason` (`OrderTicket.tsx`) nunca cobria o caso `!asset` — só
`console.warn` mostrava isso, o toast caía no fallback genérico. E a causa
raiz real: **`BTCUSDT` (com T) nunca existiu em `assetDatabase.ts`** — só
`BTCUSD` (sem T, nome unificado usado em todo o motor). O gráfico mostra
preço de BTCUSDT porque isso vem de uma fonte só-de-exibição (Binance), mas
`getAssetBySymbol('BTCUSDT')` sempre retorna `undefined`. Pior: **BTCUSDT
era o valor PADRÃO** em `TradingContext.tsx` pra usuário sem preferência
salva — todo usuário novo caía nesse ativo fantasma e nunca conseguia abrir
ordem, em silêncio (antes do fix #12/#13 do blockedReason). Corrigido:
`blockedReason` agora cobre `!asset` (`Ativo desconhecido: X`); default
trocado de `BTCUSDT` para `BTCUSD` em `TradingContext.tsx` e também no
comando de voz "bitcoin"/"btc" (`VoiceAssistant.tsx`, tinha o mesmo bug).
**Commit `c41a2639d`, já pushado.**

### 14. Estocástico Lento (Slow Stochastic) adicionado à janela de indicadores
Pedido direto do Cleber. O klinecharts não tem Slow Stochastic nativo — só
KDJ (variante chinesa: RSV suavizado por recursão exponencial tipo Wilder +
3ª linha J), que já existia na lista rotulado "KDJ - Stochastic Oscillator".
Registrado indicador customizado novo (`STOCH_SLOW`, mesmo padrão já usado
pra ATR/Donchian/Pivot Points nesse arquivo — `registerIndicator` do
klinecharts): %K = RSV bruto suavizado por SMA de `smoothK` períodos, %D =
SMA de `smoothD` períodos sobre esse %K. Padrão 14/3/3 (igual MT5/
TradingView). Aparece na lista como "Estocástico Lento (Slow Stochastic)",
categoria Momentum, logo abaixo do KDJ.
**Alteração em `ChartView.tsx` — AINDA NÃO COMMITADA.**

### 15. Posição manual fechava sozinha em ~20min mesmo sem SL definido e sem reversão real de preço — bug NOVO, diferente do #1
Cleber reportou: abriu ordem manual de BTCUSD, foi almoçar, voltou e a posição
tinha sumido sozinha. Suspeita inicial era o mesmo bug do item #1 (TP/SL=0
fechando no primeiro tick), mas aquele fix (`ba443389d`) está correto e não
cobria este caso. Diagnóstico via query direta no Supabase (`ai_trades`, projeto
`wyvdsxtcmizettljxtbg`) achou o registro exato: `stop_loss: 0, take_profit: 0`,
`entry_time` 15:27:06 UTC, `exit_time` 15:47:22 UTC (20min depois), `exit_reason:
'SL'`, preço subiu só 0,14% (63688,91 → 63778,21, LONG, lucro +$0,89) — ou seja,
fechou marcado como "stop atingido" sem nenhum stop definido e sem o preço ter
revertido.

**Causa raiz**: `stopLossMode: 'DINAMICO'` (trailing stop, **padrão do
sistema** — não é opt-in) recalculava a distância original do stop a cada tick
como `Math.abs(order.price - order.sl)` — mas `order.sl` é reescrito com o
próprio stop já "andado" a cada tick do loop de P&L (`useApexLogic.ts`, roda a
cada **1s**, não 5s como um comentário antigo no arquivo sugeria). Isso faz a
"distância original" encolher a cada segundo em vez de ficar fixa, e o stop
efetivo passa a acumular o ganho não-realizado **inteiro** a cada tick (não só
o incremento desde o tick anterior) — uma progressão descontrolada que alcança
o preço atual em minutos. Pra SL não definido (0), o ponto de partida da
"distância" já nasce quebrado (vira o próprio preço de entrada), acelerando
ainda mais. **Bug sistêmico, não só do caso SL=0**: a mesma matemática quebrada
afeta qualquer posição em modo DINAMICO com SL real definido, só que a
progressão é mais lenta a partir de uma distância inicial não-trivial —
qualquer posição vencedora em DINAMICO está sujeita a fechar prematuramente
por "stop fantasma", não só as sem SL.

**Fix**: novo campo imutável `originalSl` em `TradeVisual` — gravado uma única
vez na abertura da ordem (todos os pontos de criação: `openManualPosition`,
entrada da IA, hidratação do Supabase, import de posições MT5), nunca
reescrito pelo loop. A distância de trailing agora ancora nele em vez de
`order.sl`. Guard adicional: trailing é pulado inteiro quando `originalSl` não
é > 0 (SL nunca definido não deve gerar stop fantasma nenhum, por menor que
seja). `npm run validate` (33+9+16+12 asserções) e `npm run build` passaram.
**Alteração em `src/app/hooks/useApexLogic.ts` — AINDA NÃO COMMITADA.**

**Não verificado visualmente** (mesma limitação de Browser pane bloqueado desta
sessão inteira) — o fix corrige a matemática de forma demonstrável (distância
agora fixa, não recalculada do valor mutado), mas não foi observado ao vivo
uma posição sobrevivendo 20+min em modo DINAMICO depois do fix. Recomendo ao
Cleber reabrir uma posição manual de teste (com e sem SL) e deixar aberta por
30+ minutos pra confirmar na prática.

### 16. "Histórico de Trades" (tela Performance) só mostrava as últimas ordens da sessão atual — nunca lia o histórico real do Supabase
Cleber reportou: a tela só mostra as 3 últimas ordens, nada mais. Investigando
`Performance.tsx` → `TradingContext.tsx` → `useApexLogic.ts`: o estado
`orderHistory` (fonte da tabela) era populado só de duas formas — trades
fechados **durante a aba/sessão de navegador atual** (loop de P&L,
`stopLogic`, `closeManualPosition` etc.) e um cache de `localStorage`. A
hidratação do Supabase ao montar o app (`useEffect` perto da linha 718 de
`useApexLogic.ts`) só restaurava posições **abertas** (`getOpenTrades`) — o
histórico de trades **fechados** nunca era buscado do banco em lugar nenhum
do fluxo normal do usuário, mesmo já existindo `getUserTrades(userId,
options)` pronta em `AITradingPersistenceService.ts` (usada hoje só pelo log
de auditoria admin, `OperationLogs.tsx`). Resultado: qualquer trade fechado
antes do reload atual (ou em outro dispositivo/navegador, ou depois de
localStorage limpo) ficava invisível na tela, apesar de intacto no banco —
exatamente os 10+ trades de BTCUSD/BTCEUR que a query direta ao Supabase (item
#15 acima) trouxe, dos quais a tela só mostrava uma fração.

**Fix**: nova função `getUserTradeHistory(limit=200)` em `useAIPersistence.ts`
(wrapper do `aiPersistence.getUserTrades` já existente) + chamada na
hidratação de `useApexLogic.ts`, agora **fora** do bloco que só roda se
houver sessão ativa (histórico deve aparecer mesmo sem sessão em andamento) —
busca os trades `status: 'CLOSED'` do usuário inteiro (todas as sessões,
DEMO) e popula `orderHistory` a partir do banco, sobrepondo o cache de
localStorage (mesmo padrão já usado pra `activeOrders`/posições abertas:
Supabase é fonte de verdade). **Efeito colateral positivo, não buscado
deliberadamente**: os gates de risco que dependem de `orderHistory` (limite
de perda diária, taxa de acerto mínima, no Health Check Guardian) também
estavam subcontando trades fechados fora da sessão atual — agora contam
certo. **Alteração em `src/app/hooks/useApexLogic.ts` e
`src/app/hooks/useAIPersistence.ts` — AINDA NÃO COMMITADA.** `npm run
validate` + `npm run build` passaram. Não verificado visualmente (mesma
limitação de Browser pane bloqueado).

## Status do git — IMPORTANTE

```
git log (últimos commits, todos já pushados):
  c41a2639d fix: BTCUSDT era padrão mas não existe no catálogo; blockedReason cobre ativo desconhecido
  6f166170f fix: botões desabilitados nunca disparavam clique sem preço carregado
  bf8ea5442 fix: overlay some ao trocar timeframe; alerta outro ativo; preço entrada recolhido; 336 contract specs; minLot índices
  844ef7820 fix: S/R laranja pontilhado
  1103215e9 feat: botão de fechar posição + P&L ao vivo no gráfico
  f4ea84e3c fix: P&L alavancagem em dobro + specs ausentes ~29 criptos + card posições
  ba443389d fix: TP/SL zerado fechava ordem sozinha

git status (NÃO commitado ainda):
  M CLAUDE.md                                (ponteiro pra este handoff)
  M src/app/components/ChartView.tsx         (fix #14: Estocástico Lento novo)
  M src/app/hooks/useApexLogic.ts            (fix #15: SL Dinâmico fantasma; fix #16: histórico do Supabase)
  M src/app/hooks/useAIPersistence.ts        (fix #16: getUserTradeHistory novo)
  M dist/**                                  (rebuild do npm run build desta sessão — dist/ está versionado no repo, ver nota lateral abaixo)
  M SESSAO_2026-08-03_PNL_E_CONTRACT_SPECS.md  (este arquivo, itens #15 e #16 adicionados)
```

**Comando pendente pro Cleber rodar:**

```bash
# fixes #15 (SL Dinâmico) e #16 (histórico) ficaram no mesmo arquivo
# (useApexLogic.ts), por isso vão num commit só — não dá pra separar em dois
# via `git add` sem staging interativo por hunk.
git add src/app/hooks/useApexLogic.ts src/app/hooks/useAIPersistence.ts
git commit -m "fix: SL Dinâmico fechava posição sozinha em minutos; histórico de trades nunca lia o Supabase (só a sessão de navegador atual)"

git add CLAUDE.md src/app/components/ChartView.tsx SESSAO_2026-08-03_PNL_E_CONTRACT_SPECS.md dist
git commit -m "feat: Estocástico Lento na janela de indicadores; docs: handoff da sessão de P&L/contract specs + SL Dinâmico + histórico"
git push
```

⚠️ Nota lateral: durante verificação de build (`npm run build`), `rm -rf
dist/` foi rodado várias vezes por engano — `dist/` está (indevidamente)
versionado no git deste repo, não está no `.gitignore`. As deleções foram
restauradas com `git checkout -- dist/` a cada vez, mas vale considerar
adicionar `dist` ao `.gitignore` e remover do controle de versão num momento
oportuno (fora do escopo desta sessão, não mexido).

## Limitações desta sessão

- **Nada foi verificado visualmente por mim** — Browser pane bloqueado o
  tempo todo (mesmo problema já registrado na sessão da boleta), e a URL de
  preview exige login que não tenho. Todo diagnóstico veio de: prints e
  console colados manualmente pelo Cleber, matemática conferida à mão, e
  testes diretos via `curl`/scripts Node contra os endpoints reais (não a
  UI).
- **Specs de contrato geradas em lote (336 ativos) são aproximação de
  categoria, não tick calibrado por símbolo real da Infinox.** Se o Cleber
  for operar algum ativo específico desses de verdade, vale pedir calibração
  fina daquele símbolo antes.
- **`minLot` de índices (0,01) é convenção de mercado pesquisada, não valor
  publicado confirmado da Infinox especificamente.**
