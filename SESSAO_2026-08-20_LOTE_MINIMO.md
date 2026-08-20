# Sessão 2026-08-20 — Lote mínimo por ativo (BTC e todos os outros)

## Gatilho

Cleber reportou print de uma posição real aberta de BTC mostrando
`0.0021 lotes` — abaixo do lote mínimo real de Bitcoin (0.01 lote na
Infinox e na maioria das corretoras MT5). Pediu pesquisa profunda do mínimo
real por ativo entre corretoras e implementação do gate pra todos os ativos.

## Decisão de fonte do dado

Perguntado se o mínimo deveria vir de uma tabela hardcoded ou ser buscado
real da MetaAPI (`getSymbolSpecification`, que expõe `minVolume`/
`maxVolume`/`volumeStep` reais por símbolo e por conta) — Cleber escolheu
buscar da MetaAPI, consistente com a convenção do projeto de nunca fabricar
dado.

Na investigação, porém, ficou claro que **o catálogo estático já tinha o
mínimo real correto** (`assetDatabase.ts`: `BTCUSD minLot: 0.01`, igual pra
maioria dos ativos, `0.1` pra um subconjunto de 17). O que faltava não era o
dado — era o **gate**: nenhum caminho de execução realmente aplicava esse
mínimo antes de abrir posição. Por isso a implementação desta sessão ficou
no gate (código), não numa nova busca de dado — ver "Pendência não fechada"
no fim deste arquivo pra o que ficou de fora.

## Causa raiz (3 caminhos, cada um com seu próprio buraco)

1. **Motor autônomo (`runTradingCycle.ts`)** — todo o sizing (risco%/ATR,
   teto de "Lotes Máximos", gate de margem) opera só em nocional (`$`),
   nunca converte pra lote. O `TradeVisual` resultante ia direto pro
   `activeOrders` sem nunca passar por uma conversão $→lote com floor/
   rejeição. Nocional pequeno + preço alto (BTC) = fração de lote ínfima,
   aberta como se fosse uma posição real.
2. **Pyramiding e ordem manual (`useApexLogic.ts`, `openManualPosition`)** —
   calculavam `volume` em lotes diretamente (inclusive com multiplicador de
   camada no Pyramiding) e confiavam nesse número sem validar contra
   `asset.minLot`.
3. **Exibição no Dashboard (`MarketScoreBoard.tsx`)** — "Contratos" e "lotes
   total" eram `order.amount / (asset.lotSize × order.price)` cru, sem
   nenhum arredondamento — então mesmo uma posição real corretamente
   dimensionada por um dos Estágios 2/3/4 (que já flooravam certo, ver
   abaixo) podia aparecer com uma fração exibida errada.

Os únicos dois caminhos que já flooravam certo antes desta sessão: Estágio 2
(`useTradeConfirmationStage.ts`) e Estágio 4
(`useFullSizeExecutionStage.ts`), ambos via `amountToLotSize()`
(`lotSizeConversion.ts`) — só usados na ponte decisão→execução real (LIVE,
opt-in, desligada por padrão). O motor DEMO/autônomo, que é o que estava
realmente rodando e gerou o print do Cleber, não passava por nenhum dos
dois.

## Fix aplicado

Ponto único de arredondamento extraído em `lotSizeConversion.ts`:

```ts
floorToLotStep(symbol, rawLots) // floora pro step (=minLot), rejeita se < minLot, capa se > maxLot
```

Reaproveitado (não duplicado) em 3 lugares:

1. **`openManualPosition`** (`useApexLogic.ts`) — vira o choke point real de
   toda ordem manual e de todo layer de Pyramiding. Se o volume pedido
   arredondar abaixo do mínimo, a função retorna erro e a posição não abre
   (Pyramiding já tratava `result.success === false` graciosamente, nenhuma
   mudança extra precisou lá).
2. **Motor autônomo** (`runTradingCycle.ts`) — novo gate `MIN_TRADE_SIZE`
   inserido entre o gate de margem (2026-08-19) e o gate de nocional mínimo
   $10 (2026-08-16), mesma filosofia dos dois: nunca aumenta o nocional, só
   reduz, e pula o trade (não força tamanho maior) se nem 1 lote mínimo
   couber. Roda tanto no client quanto no `ai-runner` (mesmo módulo,
   `import` compartilhado).
3. **Exibição no Dashboard** (`MarketScoreBoard.tsx`) — "Contratos" por
   posição e "lotes total" do cabeçalho agora arredondam pelo mesmo
   `floorToLotStep` em vez de dividir cru. Uma posição cujo nocional não
   alcança o mínimo aparece como `—` em vez de uma fração fabricada.

## Verificação

- `npm run validate`: 37 asserções, 0 falhas.
- `tsc --noEmit`: mesmos 8 erros pré-existentes (não relacionados,
  confirmado via `git stash` comparando antes/depois) — nenhum erro novo
  introduzido.
- Não testado contra broker/Supabase real nesta sessão (mudança de lógica
  pura, sem acesso a rede necessário pra validar o cálculo).

## O que NÃO mudou (limitação conhecida)

Posições **já abertas** antes deste fix (como a de 0.0021 BTC do print) não
são corrigidas retroativamente — o gate só impede *novas* entradas abaixo do
mínimo. A posição antiga continua existindo até fechar normalmente; no
Dashboard agora aparece `—` em vez do número fabricado.

## Pendência não fechada

O catálogo estático (`assetDatabase.ts`) é a fonte usada em todo o fix desta
sessão — correto pro caso investigado (BTC), mas ainda é mantido à mão, não
buscado ao vivo da conta MetaAPI real. Já existe código pronto pra isso
(`InfinoxAdapter.getAvailableAssets()`, mapeia `minVolume`/`maxVolume`/
`volumeStep` reais), mas só é chamado no fluxo de conta LIVE conectada pelo
usuário — a conta DEMO compartilhada da plataforma não tem esse caminho.
Construir isso exigiria uma rota nova no servidor (chamando a API MetaAPI
com a credencial da conta compartilhada, com cache — CLAUDE.md já avisa que
essa conta é sujeita a rate-limit 429/504 sob carga) e não foi feito aqui.
Se algum ativo do catálogo estiver com `minLot` desatualizado em relação ao
que a Infinox realmente pratica hoje, o gate desta sessão vai floorar/
rejeitar com base no número errado — vale essa checagem ao vivo como
próximo passo, se o Cleber quiser fechar a lacuna de fonte-de-dado de vez.
