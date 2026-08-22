# Sessão 2026-08-21 — Log de PnL em $ mais explícito + fix de deploy do ai-runner

## Pedido original

Cleber pediu que os logs reportassem, em $, quanto foi ganho ou perdido em
cada operação fechada pela IA.

## O que já existia

O log de fechamento (TP/SL) já mostrava o valor em $, tanto no driver do
browser (`useApexLogic.ts:1778,1784`) quanto no motor real de servidor
(`supabase/functions/ai-runner/index.ts`) — mas em formato cru
(`pnl=12.40`), sem sinal explícito nem palavra indicando ganho/perda.

## Mudança feita

Reescrito o texto do log em dois pontos do `ai-runner/index.ts` (o motor
que efetivamente opera em produção via `pg_cron`, não o browser):

- Fechamento normal por TP/SL (linha ~302):
  ```
  [ai-runner] TP atingido: EURUSD @ 1.0921 — GANHO de +$12.40
  [ai-runner] SL atingido: XAUUSD @ 2310.50 — PERDA de -$8.15
  ```
- Fechamento parcial por Pyramiding (Take Profit Parcial / fechar em
  reversão, linha ~358): mesmo padrão, anexado à linha existente do log de
  pyramiding.

Os logs do driver de browser (`useApexLogic.ts`) já estavam no formato
desejado e não precisaram de mudança.

`npm run validate` (gate obrigatório do motor) passou limpo, 37/37, nas
duas rodadas desta sessão.

## Bug pré-existente encontrado no processo (não era o pedido original)

Ao tentar fazer `supabase functions deploy ai-runner --no-verify-jwt`, o
deploy falhou com:

```
unexpected deploy status 400: Failed to bundle the function (reason:
Relative import path "@/app/services/risk/NewsCurrencyRelevance.ts" not
prefixed with / or ./ or ../ and not in import map ...)
```

Causa raiz: `supabase/functions/ai-runner/deno.json` é um import map
manual que precisa listar EXPLICITAMENTE todo alias `@/...` usado pela
árvore de imports do runner (o Deno não conhece o alias `@/` do Vite — ver
comentário longo já existente no próprio `deno.json` sobre por que o
curinga `'@/': '../../../src/'` foi removido em 2026-08-17, causava upload
de 58MB de assets não usados e erro 413).

O import de `NewsCurrencyRelevance.ts` foi introduzido na sessão anterior
(2026-08-21, gate de notícias por moeda do ativo, commit `a26727ded`) mas
nunca foi adicionado ao import map — ou seja, **desde aquele commit o
deploy do `ai-runner` já estava quebrado**, só não tinha sido testado até
agora.

### Fix aplicado

1. `supabase/functions/ai-runner/deno.json` — adicionada a entrada:
   ```json
   "@/app/services/risk/NewsCurrencyRelevance.ts": "../../../src/app/services/risk/NewsCurrencyRelevance.ts",
   ```
2. `src/app/services/risk/NewsCurrencyRelevance.ts` importava
   `@/app/config/assetDatabase` **sem** extensão `.ts` — a chave do import
   map só existe com `.ts`, então não batia. Corrigido na fonte (seguindo a
   convenção já documentada no `deno.json`: extensão `.ts` explícita nos
   imports do motor, em vez de duplicar entradas no map):
   ```ts
   import { getAssetBySymbol } from '@/app/config/assetDatabase.ts';
   ```

Confirmado que `assetDatabase.ts` não tem nenhum import `@/` próprio, então
não haveria mais nenhum elo faltando na cadeia.

## Resultado

Commit, push e `supabase functions deploy ai-runner --no-verify-jwt`
rodados pelo Cleber com sucesso — fix e log novo confirmados em produção.

## Lição para a próxima vez que algo for adicionado ao motor de decisão

Sempre que um import novo `@/app/...` for adicionado em qualquer arquivo
da árvore de dependências de `runTradingCycle.ts` (direta ou transitiva),
ele PRECISA ser adicionado a `supabase/functions/ai-runner/deno.json` na
mesma sessão — senão o próximo deploy do `ai-runner` quebra silenciosamente
até alguém tentar rodar `supabase functions deploy` e notar o erro 400.
`npm run validate` e `tsc` NÃO pegam esse tipo de erro (é problema do
bundler do deploy sem Docker, não de tipo) — só o deploy real revela.
