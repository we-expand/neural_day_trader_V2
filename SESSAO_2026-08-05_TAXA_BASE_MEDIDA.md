# Sessão 2026-08-05 (tarde) — Taxa base medida: nenhum preset é viável líquido de custo

> Continuação direta de `SESSAO_2026-08-05_RUNNER_24_7_E_TAXA_BASE.md`. Esta
> sessão executa o "Comece por aqui" do handoff anterior — a medição de taxa
> base que lá estava só planejada.

## O que foi feito

1. **ETL de candles reais** (`research/experiments/2026-08-05-taxa-base/scripts/fetch_candles.mjs`)
   rodado até completar: **27/27 séries com dado real** (9 ativos × 3
   timeframes). Cripto via Binance pública, os outros 7 via `/mt5-candles-history`
   (MetaAPI, conta de plataforma). Primeira rodada teve 6 falhas 504 em
   EURUSD/XAUUSD/XAGUSD (contenção transiente da conta compartilhada); reexecutar
   o script (idempotente, reaproveita cache) resolveu todas.
2. **Medição** (`research/experiments/2026-08-05-taxa-base/scripts/measure.ts`)
   rodada sobre as 135 combinações (5 presets × 9 ativos × 3 timeframes),
   usando o **motor de produção** (`runBacktest`), **presets de produção**
   (`PRESET_STRATEGIES`), **custo real** (`CostModel.ts`), direção `both`
   (= `AUTO` de produção, igual ao que a IA roda). Saída completa:
   `research/experiments/2026-08-05-taxa-base/results/taxa_base.md` (135 linhas).

## Resultado — resposta ao critério do Cleber (frequência × pontos − custo)

**Nenhum dos 5 presets é lucrativo líquido de custo no agregado.** Somando o
resultado líquido de todas as 27 combinações ativo×timeframe de cada preset:

| Preset | Combos com líquido positivo | Soma líquida (27 combos) | Trades totais medidos |
|---|---:|---:|---:|
| Cruzamento de Médias c/ Filtro de Regime (preset ativo hoje) | 11/27 | **-22,5%** | 965 |
| Reversão à Média (RSI+Bollinger) | 11/27 | -17,3% | 196 |
| Momentum Curto Prazo (Scalp) | 10/27 | -44,8% | 2.497 |
| Rompimento de Canal (Donchian) | 6/27 | -115,8% | 2.119 |
| Rompimento Confirmado (Volume) | 4/27 | -138,4% | 4.809 |

**Padrão por timeframe**: em 5m/15m o custo domina — muita entrada, pouco
movimento por trade, quase tudo negativo. Em 1h os resultados melhoram (menos
trades, mais pontos por trade), e é onde ficam as poucas combinações
positivas — ex. Donchian XAGUSD 1h (+44%, mas 0,09 trade/dia, ~1 entrada a
cada 11 dias) e XAUUSD 1h (+21%, 1 a cada 14 dias).

**Leitura**: os timeframes/combinações "positivos" são os que operam raro o
bastante pra que o custo pese pouco — não os que acertam mais. Não existe
combinação com frequência decente (várias entradas/dia) e resultado líquido
positivo em nenhuma das 135 medidas. Confirma, sob ângulo de viabilidade
operacional, o mesmo diagnóstico que a investigação de julho já tinha fechado
sob ângulo estatístico: sem edge de sinal técnico, EV por trade ≈ −custo, e
"não existe ponto de equilíbrio" não é uma frase — é o dado.

**Ressalva de método (repetida do handoff anterior, continua valendo)**: isto
mede viabilidade operacional, **não prova nem reabre a questão de edge**. Ver
`CLAUDE.md`, seção "Cérebro de decisão da IA".

## Dois bugs encontrados no processo (fora do escopo original)

> ## ⚠️ ERRATA (2026-08-05, noite) — o achado nº 1 abaixo está ERRADO
>
> `XBNUSD` **não** é duplicata de `BTCUSD`. `XBN` é o contrato de **Binance
> Coin** da Infinox (`assetDatabase.ts:158`, `brokerRegistry.ts:192`, ambos
> confirmados via `/mt5-prices` em 2026-07-16, preço ~US$576 — três ordens de
> grandeza abaixo do BTC). O que estava errado era o **mapa de backtest**:
> `CRYPTO_CATALOG_TO_BINANCE_BASE` tinha `XBNUSD: 'BTC'`, mandando o ETL baixar
> candles de `BTCUSDT` para XBNUSD. Foi por isso que as duas séries saíram
> idênticas — não porque são o mesmo ativo.
>
> **Consequência sobre o resultado desta sessão**: as **15 combinações de
> XBNUSD** (3 timeframes × 5 presets) da tabela `taxa_base.md` mediram Bitcoin
> rotulado como XBN, com escala de ponto errada por cima. São inválidas. As
> outras 120 combinações não são afetadas (nenhum outro símbolo tinha mapa
> errado), e a conclusão agregada — **nenhum preset lucrativo líquido de
> custo** — se mantém: XBNUSD é negativo em 4 dos 5 presets, então descartar
> suas linhas não torna preset nenhum positivo. Os "8 ativos independentes"
> declarados abaixo são, de fato, **9**.
>
> Corrigido em código na mesma data (mapa + escala + asserção de regressão) —
> ver `NEXT_SESSION.md`.

### 1. ~~`XBNUSD` e `BTCUSD` são o mesmo ativo (já sabido, agora confirmado por dado)~~ — ver errata acima

`CRYPTO_CATALOG_TO_BINANCE_BASE` em `BacktestDataService.ts:50` mapeia os dois
pro mesmo par Binance (`BTCUSDT`). Candles baixados são 100% idênticos
(open/high/low/close idênticos em 99,99%+ das 33 mil barras comparadas — a
fração residual é arredondamento de ponto flutuante). **Os "9 ativos" do
catálogo/sessão são 8 ativos independentes.** Não corrigido — só reportado,
como já estava no comentário do script de ETL.

### 2. NOVO — `getPointValue('XBNUSD')` usa escala de forex, não de cripto

[`TradeSizing.ts:51-61`](src/app/services/strategy/TradeSizing.ts:51):

```ts
const CRYPTO_BASES = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOT', 'LTC', 'DOGE', 'AVAX', 'MATIC', 'POL', 'BAT', 'LINK', 'UNI', 'XLM'];
// isCryptoSymbolForSizing(s) = CRYPTO_BASES.some(base => s.startsWith(base))
```

`'XBNUSD'.startsWith(...)` não bate com nenhuma base da lista (a lista tem
`BTC`, não `XBN`) e não termina em `USDT` — então `isCryptoSymbolForSizing`
devolve `false` para `XBNUSD`. `getPointValue` cai no branch seguinte, que
testa `symbol.includes('USD')` — verdadeiro para `XBNUSD` — e devolve
`pointValue = 0.0001` (escala de par forex), em vez de `1.0` (escala de
cripto, preço em dólares cheios).

**Impacto real**: `getPointValue` é usado por `calculateTpSl` (mesmo arquivo,
linha ~92) pra converter "pontos" do preset em distância de preço:
`tpDistance = targetPointsValue * pointValue`. Com `pointValue` 10.000× menor
que o correto, TP/SL calculados para XBNUSD (preço ~US$64.000) ficam a
centavos do preço de entrada — na prática o stop dispara quase imediatamente
ou a posição não é dimensionada de forma coerente com o resto do produto.
**Isto afeta qualquer trade real do produto em XBNUSD hoje**, não é artefato
desta medição — foi descoberto porque a coluna "pontos líquidos/trade" da
tabela de XBNUSD saiu com valores absurdos (ex. -356.888 pontos) enquanto
BTCUSD, mesmo preço, mesmos candles, saiu normal.

**Não corrigido nesta sessão** — só diagnosticado. Correção de uma linha
(adicionar `XBN` a `CRYPTO_BASES`, ou tratar `XBNUSD` como alias de `BTCUSD`
antes do sizing), mas decidir qual abordagem cabe ao Cleber dado que o achado
nº1 (mesmo ativo duplicado) também está em aberto — mudar os dois juntos pode
ser mais barato que corrigir e depois deduplicar.

## O que NÃO foi feito nesta sessão

- ❌ Nenhum dos dois bugs foi corrigido — só diagnosticado e reportado.
- ❌ Passo 2 do handoff (extrair `runTradingCycle` do `useEffect`) não
  iniciado.
- ❌ `CANDLES_FETCH_FAILED` (achado 2 da sessão anterior, 2,8% do funil)
  segue não investigado.

## Próximos passos, em ordem

1. **Decisão do Cleber**: com todo preset negativo no agregado, não há
   candidato bom pra "preset padrão" da IA ainda. Isso não bloqueia o passo 2
   (extrair o ciclo pro runner é infraestrutura, independente de qual preset
   se acaba usando) — mas vale registrar que o problema de fundo (ausência de
   edge) segue sem solução à vista.
2. Corrigir os dois bugs de XBNUSD (ou decidir descontinuar o símbolo em vez
   de corrigir — mais simples, já que é duplicata de BTCUSD).
3. Passo 2 do handoff anterior, inalterado: extrair
   `runTradingCycle(estado, deps) → { decisões, efeitos }` de dentro do
   `useEffect` em `useApexLogic.ts:1260-2370`.
4. Passo 3 (runner Deno) e Fase 2 (`k(t)`), inalterados.

## Reprodutibilidade

```bash
node research/experiments/2026-08-05-taxa-base/scripts/fetch_candles.mjs
npx tsx research/experiments/2026-08-05-taxa-base/scripts/measure.ts
```

Ambos idempotentes — dado já baixado/medido não é refeito, só o que falta.
Resultado em `research/experiments/2026-08-05-taxa-base/results/taxa_base.{json,md}`.
