# Sessão 2026-08-17/18 — primeira execução real 24/7 e 3 bugs críticos

> Sessão que começou como "a IA parou de abrir posições" e terminou achando
> três bugs que **só aparecem com posição real aberta e runner rodando 24/7**.
> Nenhum deles seria encontrado por backtest ou por leitura de código — todos
> foram achados com dado de produção no Supabase.

## Contexto

O runner no servidor (`supabase/functions/ai-runner`, agendado via `pg_cron`,
`* * * * *`) passou a operar de verdade, sem depender da aba do navegador.
Isso expôs uma classe de bug que o modo antigo (motor só no cliente, com a aba
aberta) escondia.

---

## Bug 1 — `RISK_GATE` com perda diária falsa

**Sintoma**: IA avaliando 30-80 candidatos por minuto, sem parar, mas vetando
quase tudo com `RISK_GATE`: *"Limite diário de perda atingido: -23.03%
(limite 5%)"* — com a conta em lucro.

**Causa**: `dailyStartBalance` era alimentado por `portfolio.dayAnchorEquity`
(equity, que **inclui P&L não-realizado**) e comparado dentro do `RiskManager`
contra `account.balance` (**só realizado**). Bases diferentes.

Com posição aberta lucrativa, a diferença entre as duas grandezas vira uma
"perda diária" fantasma:

```
balance = 82,96   (realizado)
equity  = 107,77  (realizado + P&L flutuante da posição aberta)
→ lido como perda de 23%  →  bloqueia toda entrada nova
```

**Fix** (commit `ba17fcd56`): campo novo `dayAnchorBalance` (só realizado),
usado pelo Daily Loss Limit / Kill-Switch, separado de `dayAnchorEquity` (que
continua servindo só ao cálculo de drawdown). Tocou
`tradingState.ts`, `useApexLogic.ts`, `runTradingCycle.ts`,
`ai-runner/index.ts`.

**Limitação assumida**: o `dayAnchorBalance` do runner ainda é lido do balance
do último snapshot a cada tick, não de uma âncora de início-de-dia-UTC
persistida. Resolve a mistura equity×balance, mas não é ainda uma proteção de
perda diária acumulada 100% robusta pra 24/7. Não bloqueado por isso.

---

## Bug 2 — preço 0 do feed fechava posição a preço zero (o mais grave)

**Sintoma**: `PATRIMÔNIO TOTAL: -$2.381,77` numa conta de $82. Aparecia até em
aba anônima. Em seguida, `SAFE MODE ATIVADO: Limite de perda diária excedido:
-2464.72% (limite 5%)`.

**Causa raiz**: em `useApexLogic.ts`, o loop de PNL fazia

```ts
const nextPrice = priceMap.get(order.symbol) ?? currentPrice;
```

O `??` só protege contra `undefined`/`null` — **um `0` passa como cotação
válida**. Combinado com o gatilho de stop:

```ts
const hitSL = effectiveSl > 0 && (side === 'LONG' ? nextPrice <= effectiveSl : ...)
```

`0 <= 68885` é sempre verdadeiro → dispara SL → **fecha a posição a preço
zero**. O "0000.00" que aparecia no card de preço da tela era o mesmo zero.

**Evidência em produção** (trade `1b3cf0fd-8b7a-4c90-84b4-fdd990aa50f2`):

| campo | valor gravado |
|---|---|
| `entry_price` | 69026.31 |
| `exit_price` | **0** |
| `net_pnl` | **-2464.724452322814** |
| `exit_reason` | SL |

E a conta fechava exatamente: `82,956 (balance) + (-2464,72) = -2381,77`,
o Patrimônio exibido. O `balance` no banco **nunca foi debitado** — só o
registro do trade ficou corrompido, o que explica os números oscilando entre
telas conforme qual campo cada uma lia.

**Fix** (commit `641fe9ff3`), em duas barreiras:
1. Descarte na origem — preço não-finito ou `<= 0` nunca entra no `priceMap`,
   com `console.warn`.
2. Barreira no consumo — mesmo que escape, não vira preço de avaliação nem de
   fechamento.

**O runner do servidor já estava protegido** (`positionManager.ts:103` já
rejeitava `!(tick.price > 0)`). O bug era exclusivo do cliente — ver
"Risco estrutural" abaixo.

**Correção do dado** (autorizada pelo Cleber, rodada por ele no SQL Editor):

```sql
UPDATE ai_trades
SET exit_price = 68977.17,
    pnl        = -0.90838681753520,
    net_pnl    = -0.90838681753520
WHERE id = '1b3cf0fd-8b7a-4c90-84b4-fdd990aa50f2'
  AND exit_price = 0;
```

Valores ancorados em dado real registrado, não estimados: `68977.17` foi o
último preço real observado, e `-0,9084` é o P&L não-realizado que o próprio
motor calculou nos três últimos snapshots válidos antes do fechamento fantasma
(equity `82,04776601673574` − balance `82,95615283427094`, idêntico às
00:52:53, 00:53:54 e 00:54:13 UTC).

Depois do UPDATE, a perda do dia caiu de -2464,72% para **0,91%** — abaixo do
limite de 5%, liberando o Safe Mode.

---

## Bug 3 — PnL divergente entre telas

**Sintoma**: o MESMO trade JP225, no mesmo instante, mostrando **-$1,75** no
Dashboard e **-$0,54** no AI Trader.

**Causa**: não era timing nem fonte de dado — as duas telas leem o mesmo
`activeOrders` do mesmo `TradingContext`. O `AITrader.tsx` **reimplementava a
fórmula de PnL inline no JSX**, com variação percentual × leverage, ignorando
o `pointValue` por ativo:

```ts
const priceDiffPct = (currentPrice - order.price) / order.price;
const rawPnL = (side === 'LONG' ? priceDiffPct : -priceDiffPct) * order.leverage;
const pnlValue = (order.amount || 0) * rawPnL;   // ❌ ignora contractSpecs
```

Enquanto o Dashboard lia `order.currentProfit`, valor oficial calculado por
`calculateRealisticPnL`/`contractSpecs.ts` dentro do loop do motor.

**Fix** (mesmo commit `641fe9ff3`): `AITrader.tsx` passa a ler
`order.currentProfit`. Fonte única. Junto, dois achados no mesmo bloco:
- **"Equity Projetado" contava em dobro** — somava o P&L não-realizado sobre
  `portfolio.equity`, que já o inclui (`newEquity = newBalance +
  totalUnrealizedPnL`). "Se fechar agora" já É o próprio `portfolio.equity`.
- `console.log('[P&L DEBUG] ...')` rodando em produção a cada render — removido.

**Regra que fica**: nunca recalcular PnL em componente de apresentação. A
lógica por classe de ativo vive só em `calculateRealisticPnL`/`getContractSpec`.

---

## Safe Mode e Reinicialização Total

O Safe Mode disparou corretamente — a entrada é que era lixo. Verificado que
`resetLogic()` **já** limpava `isSafeMode`/`safeModeReason` e reiniciava
`sessionStartedAtRef` (o relógio do gate de perda diária). Os comentários em
`useApexLogic.ts:445-454` documentam um incidente quase idêntico anterior
(SPX500 com -$950 corrompido por bug de contract spec envenenando o mesmo
gate) — hoje o padrão se repetiu.

Ou seja: a Reinicialização Total já era a saída; faltava **descoberta**.

- Commit `ea87a0d9f`: o modal de Reinicialização Total listava 3 consequências
  e omitia justamente a que resolve o problema. Adicionada a linha "Saída do
  Safe Mode e reinício do limite de perda diária".
- Reset passa a ser **exclusivo de DEMO** (pedido do Cleber): botão escondido
  em LIVE (`AITrader.tsx`) **e** guarda real em `resetPortfolio`
  (`TradingContext.tsx`) — esconder botão sozinho não protege. Segue o
  precedente que já existia em `Funds.tsx:33`.

**Detalhe de implementação que evita um bug sutil**: a guarda ficou em
`resetPortfolio`, **não** em `resetLogic`. `switchToDemoMode` chama
`logic.resetLogic()` direto, logo após `setExecutionMode('DEMO')` — como
setter de estado do React não propaga no mesmo tick, uma guarda dentro de
`resetLogic` leria `'LIVE'` e bloquearia a volta legítima LIVE→DEMO.

---

## Risco estrutural em aberto (NÃO corrigido)

1. **Cliente e servidor monitoram e fecham posições em paralelo**, com lógicas
   independentes. Foi exatamente por isso que o Bug 2 existiu num lado e não no
   outro. Decidir se a aba do navegador deve perder autoridade de fechar trade
   quando o runner é a fonte de verdade.
2. **Safe Mode é estado só do cliente** (`localStorage`). Não existe no runner
   — se disparar, para a aba enquanto o servidor continua operando. Foi o que
   aconteceu: a tela dizia "NEGOCIAÇÃO BLOQUEADA PELO GESTOR DE RISCO" e o
   runner seguia abrindo posição normalmente.

---

## Experimento em produção

Preset 5 (scalp) com R:R de **1:1,5 → 1:3** (`atrTakeProfitMultiplier` 1.5 → 3,
stop mantido em 1×ATR). Commit `852ba361a`.

Contraria o design original do preset, que é explicitamente documentado como
"R:R modesto de propósito (scalp precisa de taxa de acerto alta, não de retorno
grande por trade)". **Não validado por backtest** — TP mais largo tende a
reduzir taxa de acerto. Reverter `atrTakeProfitMultiplier` para `1.5` se a taxa
de acerto cair.

---

## Lições de deploy (custaram tempo — registrar)

1. **`ai-runner` exige `--no-verify-jwt`.** Sem a flag, o gateway do Supabase
   passa a exigir JWT e todo tick do cron toma
   `401 UNAUTHORIZED_NO_AUTH_HEADER` — a IA para por completo (a function tem
   auth própria via `x-runner-secret`). Comando correto:
   ```bash
   supabase functions deploy ai-runner --project-ref wyvdsxtcmizettljxtbg --no-verify-jwt
   ```
2. **URLs de deployment da Vercel com hash são imutáveis.** Testar em
   `...-bwip109bq-....vercel.app` gerou um falso "o push não foi pra Vercel"
   quando o push tinha funcionado e o deploy existia — aquela URL fica
   congelada no build daquele momento, para sempre. Usar sempre o alias de
   branch: `neural-day-trader-v2-git-dev-cleber-coutos-projects.vercel.app`.
3. **Produção (`main`) está em manutenção de propósito.** O `index.html` do
   `main` é a página "Em construção" e não carrega `/src/main.tsx`. Mergear
   `dev`→`main` **não** tira o produto do ar — o `index.html` de manutenção é
   do `main` e sobrevive ao merge.
4. **Edge Function não sobe com `git push`** — precisa de deploy próprio.

---

## Erro meu registrado nesta sessão

Ao ser perguntado "estamos com safe mode ativado?", respondi **"Não"** com
base em (a) print anterior mostrando "SEGURO" e (b) estado do banco. Estava
errado: Safe Mode é estado do cliente em `localStorage`, que eu **não consigo
consultar** — eu mesmo tinha escrito isso na resposta e ainda assim afirmei
categoricamente. O certo seria declarar que não dava pra verificar por ali.
O Cleber mandou o print provando o contrário.

---

## Estado ao final da sessão

- Trade corrompido corrigido no banco, perda do dia em -$0,91 (0,91%).
- IA religada, sessão `66faee09-fe87-4bc6-a9a6-1ee8d7edb504` RUNNING desde
  01:27 UTC, runner respondendo 200.
- Todos os fixes na branch `dev` + `ai-runner` redeployado com
  `--no-verify-jwt`.
- `npm run validate` e `tsc` do caminho crítico em zero erros. `tsc` do app
  completo segue com 578 erros **pré-existentes** (medido antes/depois — zero
  regressão introduzida).
