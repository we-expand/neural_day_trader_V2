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
  ?? SESSAO_2026-08-03_PNL_E_CONTRACT_SPECS.md  (este arquivo)
```

**Comando pendente pro Cleber rodar:**

```bash
git add CLAUDE.md src/app/components/ChartView.tsx SESSAO_2026-08-03_PNL_E_CONTRACT_SPECS.md
git commit -m "feat: Estocástico Lento na janela de indicadores; docs: handoff da sessão de P&L/contract specs"
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
