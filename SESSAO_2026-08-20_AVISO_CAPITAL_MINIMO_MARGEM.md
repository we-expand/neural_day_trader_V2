# Sessão 2026-08-20 — Aviso de "capital insuficiente" comparava nocional com caixa

## Origem

Cleber reportou: com $100 de capital alocado, o app avisava que EURUSD
exigia um mínimo de ~$1,1168 pra operar — número que batia exatamente com o
preço do par, e que ele considerou implausível ("com $100 dá pra operar
qualquer ativo, o custo de Forex é baixo"). Pediu pesquisa ampla de como
concorrentes/corretoras praticam mínimo de capital por ativo.

## Diagnóstico

Não era prática de mercado divergente — era bug de fórmula no próprio
código. Dois lugares calculavam "quanto capital falta pra fechar 1 lote
mínimo" de formas diferentes:

- **Motor real** (`runTradingCycle.ts` + `TradeSizing.ts`, corrigido em
  2026-08-19 via `clampToMarginAffordability`): margem = nocional ÷
  leverage do ativo — fórmula padrão de mercado, confirmada contra
  Alpari/Pepperstone/BlackBull/XTB.
- **Avisos de UI** (`AssetUniverse.tsx`, `InfinoxAssetsBrowser.tsx`), via
  `getMinLotNotionalUsd()` em `lotSizeConversion.ts`: retornava o
  **nocional puro** (`minLot × lotSize × price`) e comparava direto contra
  `allocatedCapital` (dinheiro em caixa), sem dividir pelo leverage do
  catálogo (500x pra EURUSD, já presente em `assetDatabase.ts`).

Nocional de 1 micro lote (0,01) de EURUSD a 1,1168 = **$1.116,80**. Margem
real com leverage 500x = **$2,23**. O aviso de UI mostrava o primeiro
número como se fosse o segundo — daí a confusão do Cleber bater
exatamente com "parece que só EURUSD puro (sem lote) já seria o mínimo".

Confirmado com pesquisa externa (Infinox docs + prática geral do setor):
conta de $100 com risco de 1% e stop de 50 pips calcula ~0,02 lote de
EURUSD sem problema — mecanismo padrão de qualquer corretora de varejo com
alavancagem, nada peculiar da Infinox.

## Fix aplicado

- [`lotSizeConversion.ts`](src/app/modules/tradeConfirmationStage/lotSizeConversion.ts:69)
  — `getMinLotNotionalUsd()` agora calcula o nocional e converte pra margem
  via `calculateRequiredMargin(notionalUsd, asset.leverage)` (já existia em
  `TradeSizing.ts`, mesma fórmula usada pelo motor real).
- Textos dos 3 avisos que citam esse valor
  ([`AssetUniverse.tsx:275`](src/app/components/config/AssetUniverse.tsx:275),
  [`InfinoxAssetsBrowser.tsx:297`](src/app/components/dashboard/InfinoxAssetsBrowser.tsx:297)
  e [`:415`](src/app/components/dashboard/InfinoxAssetsBrowser.tsx:415))
  ajustados pra dizer explicitamente "de margem", evitando a mesma
  confusão de novo.

**Não alterado de propósito**: o card de posição aberta em
`MarketScoreBoard.tsx:1230` — ali a comparação é nocional-contra-nocional
(exposição real da posição, já em unidade de nocional, vs. nocional do
lote mínimo), que já estava correta e não deve virar margem.

## Verificação

- `npm run validate` — 37/37 OK.
- `npx tsc --noEmit -p tsconfig.engine.json` — sem erro.
- Não verificado visualmente no browser (mudança é só de texto/fórmula em
  tela de configuração de ativos, não testada via preview nesta sessão).

## Commit

Pendente do Cleber rodar (regra fixa do projeto — Claude nunca
commit/push sozinho):

```bash
git add src/app/modules/tradeConfirmationStage/lotSizeConversion.ts src/app/components/config/AssetUniverse.tsx src/app/components/dashboard/InfinoxAssetsBrowser.tsx
git commit -m "fix: aviso de capital insuficiente comparava nocional com caixa, ignorando alavancagem (EURUSD mostrava ~\$1.116 em vez de ~\$2,23 de margem real)"
git push origin dev
```
