# Sessão 2026-08-07 — Cache de candles MetaAPI + diagnóstico de conta + fix do seletor de ativo do backtest

> Sessão iniciada a partir de uma dúvida de consultoria (QuantConnect vs
> MetaAPI) que evoluiu pra investigação real de um bug de produção: rate
> limit da conta MetaAPI de plataforma mesmo com 1 usuário ativo. Não é
> continuação do trabalho de "redesenho do cérebro de decisão" que
> `NEXT_SESSION.md`/`CLAUDE.md` apontam como ativo — é uma frente paralela de
> infra. Este arquivo é o handoff desta frente específica.

## ▶ COMECE AQUI (se retomar esta frente)

**Bloqueador real, fora do meu alcance por código**: a conta MetaAPI de
plataforma (`bb99f865-96fb-4573-98a7-1f32895f84f7`) está retornando
`TimeoutError` ("account not connected to broker yet") no subsistema de
**market-data** (histórico de candles) — reproduzido diretamente via curl
contra `/mt5-candles-history` pra EURUSD **e** SPX500 (este último já tinha
3211 candles em cache, prova de que funcionava antes). Não é rate-limit
(429), é desconexão. **Ação pendente do Cleber**: checar o status da conta em
`app.metaapi.cloud` → conta `bb99f865-96fb-4573-98a7-1f32895f84f7` → ver se
`connectionStatus` está `CONNECTED`; se não, redeployar/reconectar
manualmente por lá. Se persistir, abrir chamado com o suporte do MetaApi
citando esse account ID e a mensagem de erro exata (ver seção "Achados"
abaixo pro payload completo).

Enquanto isso não for resolvido, gráficos e backtests de qualquer ativo que
dependa de candle histórico via MetaAPI (forex, índices, commodities — não
ações, que vão por Yahoo) vão continuar falhando com 502, **independente**
das duas correções desta sessão (que já estão commitadas e com push feito).

## O que foi feito

### 1. Diagnóstico da causa raiz do rate-limit crônico (`CLAUDE.md`)
Achado (não é rate-limit de servidor MetaApi compartilhado com terceiros,
como a hipótese inicial supunha): a conta MetaAPI de plataforma tem **dois
consumidores concorrentes** competindo pelo mesmo teto de créditos —
`streaming-relay` (1 conexão fixa, 219 símbolos, não escala com usuário — já
correto) e a rota `/mt5-candles-history`, que fazia RPC direto no MetaApi a
cada chamada de gráfico/backtest/diagnóstico, **sem cache**, escalando
linearmente com uso.

### 2. Cache-aside implementado em `/mt5-candles-history`
[supabase/functions/server/index.ts](supabase/functions/server/index.ts)
(rota em ~linha 4611) agora consulta a tabela `public.ohlcv_data` (já
existia provisionada, nunca usada) antes de bater no MetaApi. Barra fechada
é imutável → cacheia pra sempre, só busca ao vivo o que falta (tipicamente
0-1 barra). Fail-open: qualquer erro no cache cai pro comportamento 100% ao
vivo de antes. **Verificado funcionando em produção**: `ohlcv_data` tem 3211
linhas de SPX500/1h persistidas depois do deploy.
Commit: `bf0c82a1f`.

### 3. Bug achado durante a verificação: `/mt5-candles-history` retornando 502
Reproduzido diretamente via curl contra a Edge Function em produção — ver
seção "COMECE AQUI" acima. **Não foi causado pela mudança do item 2** (é o
branch de erro do fetch ao vivo, que já existia antes; o cache é fail-open e
não interfere). Causa real: conta desconectada do broker no subsistema de
market-data. Sem fix de código possível — é estado de infra do lado
MetaApi/corretora.

### 4. Bug achado em paralelo: seletor de ativo do backtest sempre BTCUSD
[BacktestConfigModal.tsx](src/app/components/backtest/BacktestConfigModal.tsx)
tinha o campo "Ativo" como `<div>` estática (nunca foi um seletor de
verdade) — todo backtest disparado por ali rodava sempre em BTCUSD, não
importa o ativo aberto no gráfico. Corrigido reaproveitando o componente
[AssetSelector.tsx](src/app/components/dashboard/AssetSelector.tsx) que já
existe e já é usado no seletor do próprio gráfico (nenhuma UI nova criada
do zero). Modal agora inicializa com `defaultAsset={selectedSymbol}` (o
ativo atual do gráfico, passado de
[ChartView.tsx:7355](src/app/components/ChartView.tsx:7355)) e resincroniza
toda vez que reabre. Verificado: `npx tsc --noEmit` limpo nos dois arquivos
tocados; **não verificado visualmente clicando na UI** (app exige login,
sem credenciais disponíveis nesta sessão) — pedir pro Cleber confirmar
clicando de verdade.
Commit: `1ad3c7a49`.

## Estado do git

Branch `dev`, os dois commits acima já com **push feito** para
`origin/dev` (dispara preview deploy automático na Vercel). Working tree
segue com outras mudanças não commitadas de sessões anteriores
(`package.json`, `AIToolsControl.tsx`, `ATRTrailingStopManager.tsx`,
`PyramidingConfigPanel.tsx`) — não tocadas nesta sessão, não fazem parte
deste handoff.

## Achados técnicos pra referência rápida

- **Payload de erro completo da conta desconectada**:
  ```json
  {"id":..., "error":"TimeoutError", "message":"It seems like the account
  bb99f865-96fb-4573-98a7-1f32895f84f7 is not connected to broker yet or
  request URL you use does not match the account region. Please make sure
  account is connected to broker before retrying the request. You can find
  valid URL at https://app.metaapi.cloud/api-access/api-urls", "metadata":{}}
  ```
- **CHECK constraint de `ohlcv_data.timeframe`** permite
  `1m,5m,15m,1h,4h,1d,1w,1M` — **não inclui `30m`**, que o código mapeia como
  timeframe válido. Upsert de candle 30m falha silenciosamente (fail-open,
  não quebra nada) e nunca é cacheado. Não bloqueante hoje; se o produto
  passar a usar 30m com frequência, abrir o CHECK depois.
- **`/mt5-candles` (linha ~4419, a rota irmã sem "-history")** está
  confirmada morta — só chamada por `getMetaApiCandles()` em
  `MetaApiService.ts`, sem nenhum call site ativo no repo. Não mexida, fora
  de escopo.
- **Erro pré-existente, não relacionado, visto nos logs**: `GET
  /real/yahoo/SUGUSD` retornando 500 repetidamente. Não investigado.

## Próximos passos (em ordem)

1. Cleber verificar/reconectar a conta MetaAPI de plataforma no painel
   (bloqueador de tudo que depende de candle real via MT5).
2. Depois de reconectada, confirmar que `/mt5-candles-history` volta a
   funcionar (retestar EURUSD e SPX500) e que o cache continua populando
   `ohlcv_data` para novos símbolos/timeframes.
3. Cleber confirmar visualmente (clicando na UI logada) que o seletor de
   ativo do backtest abre e reflete o ativo do gráfico.
4. Opcional/não bloqueante: decidir se abre o CHECK de `timeframe` pra
   incluir `30m`.
