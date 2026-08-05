# Handoff — próxima sessão

> Reescrito em **2026-08-05 (noite)**. Versões anteriores estão no git.
> **Regra: este arquivo é handoff da sessão CORRENTE. Reescreva, não empilhe.**

## Estado em uma frase

Os dois bugs de `XBNUSD` do handoff anterior foram **corrigidos** — e no
processo se descobriu que o diagnóstico de um deles estava invertido: `XBNUSD`
nunca foi duplicata de `BTCUSD`, é **Binance Coin**, e quem estava errado era o
mapa de backtest. O gate está verde com asserção nova travando a regressão.
A conclusão da taxa base (**nenhum preset lucrativo líquido de custo**) segue
de pé.

## Leitura obrigatória

1. **`SESSAO_2026-08-05_TAXA_BASE_MEDIDA.md`** — o resultado da taxa base.
   **Leia a ERRATA no topo da seção de bugs** antes de citar qualquer número de
   `XBNUSD` daquela tabela.
2. `SESSAO_2026-08-05_RUNNER_24_7_E_TAXA_BASE.md` — decisões que motivaram a
   medição (runner 24/7 como requisito de produto, critério financeiro).

Só se precisar do detalhe: `SESSAO_2026-08-04_FASE1_LEITURA_FUNIL.md`,
`SESSAO_2026-08-04_FASE1_COSTURA_RUNNER.md`,
`SESSAO_2026-08-04_FASE0_TELEMETRIA_FUNIL.md`, `research/AI_BRAIN_SPEC.md`
(seções 14.5 e **14.7** — não citar número da seção 14 sem ler 14.7).

## O que foi corrigido nesta sessão

1. **Mapa de backtest** (`BacktestDataService.ts:49`): `XBNUSD: 'BTC'` →
   `'BNB'`. Adicionado `XLCUSD: 'LTC'` (faltava). Removida a chave `XETLC`, que
   não correspondia a símbolo nenhum do catálogo.
2. **Escala de ponto** (`TradeSizing.ts:60`): `getPointValue` agora usa a
   **categoria do catálogo** (`assetDatabase.getAssetBySymbol`) como fonte de
   verdade, com a lista de prefixos de base cripto rebaixada a fallback para
   símbolos fora do catálogo (`BTCUSDT`). Isso conserta de uma vez toda a
   família de contratos `X**` da Infinox — `XBNUSD`, `XETUSD`, `XLCUSD` —, que
   caía no branch de forex e recebia `pointValue` 0.0001 com preço em dólares
   cheios.
3. **Cópia divergente eliminada** (`useApexLogic.ts:2143`): o caminho ao vivo
   tinha a tabela de `pointValue` duplicada inline e as duas cópias já haviam
   divergido. Agora chama `getPointValue`. Uma só tabela no produto.
4. **Asserção de regressão** (`strategy/__validate__.ts`, CASO 5): 8 asserções
   novas travando a escala por símbolo e a distância de TP resultante. Este bug
   já tinha voltado uma vez (2026-07-24, BTCUSD); agora custa o gate pra voltar
   uma terceira.

`npm run validate` verde, 15/15 na suíte do motor.

## Comece por aqui

**Passo 2 do plano do runner**, sem dependência aberta: extrair o ciclo de
trading de dentro do `useEffect`
([useApexLogic.ts:1260-2370](src/app/hooks/useApexLogic.ts:1260), ~1.100
linhas) pra um módulo puro `runTradingCycle(estado, deps) → { decisões,
efeitos }`. Sem React, sem `setState`, devolve efeitos em vez de aplicá-los.
Hoje lê do fecho: `activeOrders`, `aiConfig`, `lastTradeTimestampRef`,
`cachedNewsEventsRef`, `cachedVIXRef`.
Rede de proteção: `npm run validate` **+** equivalência de `stage_counts`
antes/depois (a telemetria de funil é o teste de não-regressão).

## Depois disso, em ordem

1. **Runner Deno** sobre o ciclo extraído: lê `ai_sessions` RUNNING, monta
   estado do banco, chama a mesma função, grava `ai_trades` e
   `ai_funnel_snapshots`. Opera de verdade em DEMO (abre, gere stop/take/
   trailing, fecha). Cron **sem trava de dia útil** (cripto opera fim de
   semana), gate de mercado aberto **por símbolo**, lock por sessão.
2. **Fase 2 — o `k(t)`**, inalterada. Dataset M1 e motor numba já existem em
   `research/experiments/2026-07-30-sma-pullback-crossasset/scripts/`.

## Decisão do Cleber ainda em aberto

Com todo preset negativo no agregado, não existe hoje candidato bom pra "config
padrão" da IA. Isso **não bloqueia** o passo acima (extrair o ciclo é
infraestrutura, independente do preset), mas o problema de fundo — ausência de
edge — segue sem solução à vista, e vale saber disso antes de investir mais
tempo achando que falta só ligar o runner.

**Opcional, barato**: reexecutar a medição de taxa base agora que o mapa está
certo, pra ter as 15 linhas de XBNUSD medindo Binance Coin de verdade. Não
muda a conclusão (ver errata), só completa a tabela.

```bash
node research/experiments/2026-08-05-taxa-base/scripts/fetch_candles.mjs
npx tsx research/experiments/2026-08-05-taxa-base/scripts/measure.ts
```

Ambos idempotentes — **mas apague o cache de candles de XBNUSD antes**, senão
o ETL reaproveita as barras de BTC já baixadas com o mapa errado.

## O que ficou decidido (não reabrir sem motivo novo)

- **Runner 24/7 operando de verdade em DEMO é requisito de produto**, não
  otimização. Usuário liga e vai dormir; a IA não pode se desligar sozinha.
  Execução em conta REAL fica fora desta entrega.
- **Um motor, dois drivers.** O runner importa o motor do browser, nunca copia.
  Cópia garantiria divergência entre o que se testa e o que opera. (O bug nº 3
  desta sessão é exatamente o custo de ter ignorado isso dentro do browser.)
- **Nenhum gate/limiar foi afrouxado, e não será.** A taxa base medida mostrou
  que afrouxar limiar não teria pra onde ir: nenhum preset é lucrativo mesmo
  operando mais.
- **Calibração ajusta a QUANTIDADE de trades, nunca o SINAL da expectativa.**
- **Fase 2 = medir a curva `k(t)`**, com orçamento e critério de corte já
  fixados (tabela no doc da Fase 0).
- **A IA está desligada de propósito.**

## Armadilhas conhecidas, ainda não corrigidas

**Candles simulados com HTTP 200.** `/mt5-candles` devolve dado sintético quando
o token MetaAPI é inválido
([server/index.ts:4438](supabase/functions/server/index.ts:4438)). No browser o
`isRealData` barra. **O runner do servidor precisa rejeitar `source:
'SIMULATED'` explicitamente** — senão decide trade sobre dado fabricado,
violando a convenção nº1 do projeto. Requisito não negociável do runner.
(Nota: `/mt5-candles-history`, usada pela taxa base, já falha explícito em vez
de devolver sintético — verificado em 2026-08-05.)

**Faixa morta do `detectRegime`** (`MarketScoreEngine.ts:437`): ADX 18–25 vira
`INDEFINIDO`, que não satisfaz nem TREND nem RANGE. Com o default
`marketMode: 'TREND'`, é veto permanente. Introduzida em `6e319e485`.
**Não é o veto observado no funil** (esse é o filtro ADX>20 da própria
estratégia, num estágio anterior) — não confundir os dois.

**Pares JPY usam pip de 4 casas.** `getPointValue('USDJPY')` devolve 0.0001,
mas o pip de par com iene é 0.01 — alvo em pontos fica 100× curto. Mesma classe
dos bugs corrigidos hoje, achado ao revisar a função; **não corrigido** (nenhum
par JPY está no fluxo ativo hoje). Se entrar, corrigir antes.

**Desperdício de amostragem:** ativo sem dado real continua consumindo um dos 3
slots de avaliação por tick (`ASSETS_PER_TICK`,
[useApexLogic.ts:1383](src/app/hooks/useApexLogic.ts:1383)).

## Anotado, não priorizado

- `CANDLES_FETCH_FAILED` apareceu no funil de 2026-08-05 (2,8% das
  avaliações) — estágio novo, não existia no funil do dia anterior. Volume
  baixo, não investigado.
- Mudanças de OUTRA sessão continuam não commitadas na árvore:
  `AIToolsControl.tsx`, `ATRTrailingStopManager.tsx`, `PyramidingConfigPanel.tsx`
  e `SESSAO_2026-08-04_ATR_PYRAMIDING_E_AUDITORIA_CONFIG.md`. Cleber decide.

## Workflow (regra fixa do projeto)

Claude **nunca** roda `git commit`/`push` nem aplica migration. Sempre
entrega código pronto + comandos prontos pro Cleber rodar.
