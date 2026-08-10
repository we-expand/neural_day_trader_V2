# Sessão 2026-08-07 — Cache de candles MetaAPI + diagnóstico de conta + fix do seletor de ativo do backtest

> **STATUS: FECHADO em 2026-08-07.** Todos os 4 itens desta frente foram
> resolvidos e confirmados no mesmo dia (ver "Próximos passos" no fim do
> arquivo — os 4 estão riscados). Nada pendente aqui. Se você está abrindo
> este arquivo numa sessão nova só pra dar continuidade geral do projeto (não
> especificamente desta frente de infra), o trabalho ativo real é outro: leia
> **[NEXT_SESSION.md](NEXT_SESSION.md)** e a seção "▶ COMECE AQUI" do
> **[CLAUDE.md](CLAUDE.md)**, que apontam o redesenho do cérebro de decisão
> como frente corrente do projeto.

> Sessão iniciada a partir de uma dúvida de consultoria (QuantConnect vs
> MetaAPI) que evoluiu pra investigação real de um bug de produção: rate
> limit da conta MetaAPI de plataforma mesmo com 1 usuário ativo. Não foi
> continuação do trabalho de "redesenho do cérebro de decisão" que
> `NEXT_SESSION.md`/`CLAUDE.md` apontam como ativo — foi uma frente paralela
> de infra, já concluída. Este arquivo é o handoff (fechado) desta frente
> específica.

## ▶ COMECE AQUI (se retomar esta frente)

**RESOLVIDO em 2026-08-07 (mesmo dia).** Cleber reconectou a conta MetaAPI de
plataforma (`bb99f865-96fb-4573-98a7-1f32895f84f7`) no painel. Verificado
depois via Supabase MCP (dado real, não relato):
- `ohlcv_data`: `EURUSD/1h` com 4245 candles, última barra
  `2026-08-07 17:00:00+00`; `SPX500/1h` com 3211, última barra `16:00:00+00`
  — cache seguindo populando normalmente para os dois.
- Logs da edge function: `/mt5-candles-history` voltando `200` (sem
  `TimeoutError`/502 na janela mais recente); `/mt5-prices` seguindo `200`
  de forma consistente.
- Único erro remanescente nos logs: `GET /real/yahoo/SUGUSD` (500,
  repetido) — já registrado abaixo como pré-existente e fora de escopo, não
  investigado.

Nada pendente nesta frente além do item 4 abaixo (visual do seletor de
ativo, também já confirmado pelo Cleber) e do opcional do CHECK de `30m`.

<details>
<summary>Contexto original do bloqueador (histórico, já resolvido)</summary>

A conta MetaAPI de plataforma estava retornando `TimeoutError` ("account not
connected to broker yet") no subsistema de **market-data** (histórico de
candles) — reproduzido diretamente via curl contra `/mt5-candles-history`
pra EURUSD **e** SPX500 (este último já tinha 3211 candles em cache, prova
de que funcionava antes). Não era rate-limit (429), era desconexão. Ver
seção "Achados" abaixo pro payload completo do erro original.

</details>

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

1. ~~Cleber verificar/reconectar a conta MetaAPI de plataforma no painel~~ —
   **feito**, reconectada em 2026-08-07.
2. ~~Confirmar que `/mt5-candles-history` volta a funcionar e que o cache
   continua populando `ohlcv_data`~~ — **confirmado** via Supabase MCP (ver
   seção "COMECE AQUI").
3. ~~Cleber confirmar visualmente que o seletor de ativo do backtest abre e
   reflete o ativo do gráfico~~ — **confirmado** pelo Cleber.
4. ~~Abrir o CHECK de `timeframe` pra incluir `30m`~~ — **feito e
   confirmado** em 2026-08-07 (Cleber rodou o SQL, constraint verificado via
   Supabase MCP agora inclui `30m`). Candles de 30m passam a ser cacheados
   normalmente em `ohlcv_data` daqui pra frente.

Nada pendente nesta frente.
