# Sessão 2026-09-16 — Failover de região MetaAPI (UKOUSD não abria o Gráfico)

## Relato do Cleber

"UKOUSD não abre o gráfico e a API não está dando rate-limit." Depois,
quando reportei que a região primária (`london`) estava `DISCONNECTED`:
"Eu quero que você veja se nós estamos conseguindo acessar a API de Nova
York. Porque a API de Nova York, ela está normal. Conectada."

## Diagnóstico

Testado ao vivo direto contra `/mt5-prices` (Edge Function `server`,
produção): **não era rate-limit (429)** — era **HTTP 504**, e não só pro
UKOUSD. Testado em lote (`EURUSD, XAUUSD, NAS100, UKOUSD`): os 4 com o
mesmo erro. Cripto (`BTCUSD`, roteado direto pra Binance) respondia normal
— confirma que o problema era específico da conta MetaAPI, não do símbolo
nem de código do UKOUSD.

Confirmado direto na **provisioning API da MetaAPI**
(`mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/{id}`),
com o token real de `streaming-relay/.env`:

```json
{
  "region": "london",
  "connectionStatus": "DISCONNECTED",
  "accountReplicas": [
    {
      "region": "backup-new-york",
      "connectionStatus": "CONNECTED",
      "createdAt": "2026-09-11T17:42:05.137Z"
    }
  ]
}
```

Cleber estava certo: Nova York (a réplica criada em 2026-09-11, ver
`CLAUDE.md` item de 2026-09-11 "Conta MetaAPI dedicada... desconectando")
estava conectada e saudável. O problema era **a conta primária (`london`)
estar `DISCONNECTED`**, e um **bug real de código impedindo o failover
pra réplica que já existia desde 09-11**.

## Causa raiz (bug real, não infra)

Em `supabase/functions/server/index.ts`, as funções
`getMetaApiClientApiBase`/`getMetaApiMarketDataApiBase` tentavam ler
`account.regions` (**array**) pra decidir qual região usar — esse campo
**nunca existiu** no payload real da provisioning API. O nome real da
região primária vem em `account.region` (string) e a réplica vem separada,
dentro de `account.accountReplicas[].region`. Como a leitura errada
sempre resultava em array vazio, a checagem
`regions.includes('new-york')` nunca era verdadeira — o código **sempre**
caía pra `account.region` (a primária, "london"), mesmo com ela
`DISCONNECTED` e a réplica `CONNECTED` ao lado. A réplica adicionada em
09-11 nunca foi, na prática, considerada por esse código desde que foi
criada.

## Fix aplicado (2 partes)

**Parte 1 — leitura correta do payload.** `resolveMetaApiRegion`
reescrito pra ler `account.region` + `account.accountReplicas[]` de
verdade, cada um com seu `connectionStatus`, escolhendo qualquer região
`CONNECTED`.

**Parte 2 — failover instantâneo (pedido explícito do Cleber: "tem que
funcionar como uma suíte — quando uma não funciona, a outra tem que
entrar no mesmo instante").** Reescrito de novo pra não escolher só 1
região e cachear pra sempre — agora:
- `resolveMetaApiRegionCandidates` guarda **todas** as regiões da conta
  (primária + réplicas) ordenadas (`CONNECTED` primeiro), cache com TTL
  de 60s (era: escolhia 1 região e cacheava pra sempre).
- `reportMetaApiRegionFailure(accountId, region)` derruba a região do
  topo **na hora** (sem esperar TTL), promovendo a próxima candidata —
  válido pra **todos os chamadores seguintes**, já que o cache é
  compartilhado entre rotas.
- `metaApiFetchWithFailover(token, accountId, kind, buildPath, init)`:
  novo envelope que tenta a região do topo e, se a resposta for erro de
  **infra** (504/502/503/522/524 ou timeout — nunca 4xx de negócio tipo
  símbolo inexistente), chama `reportMetaApiRegionFailure` e tenta a
  **próxima região candidata dentro da MESMA requisição** — sem esperar
  o usuário recarregar a página.

**Aplicado nos 3 pontos que causam o sintoma relatado** (preço + os 2
caminhos de candle que o Gráfico usa):
- `/mt5-prices` (ticker, `current-tick`)
- `/mt5-candles` (candle histórico usado pelo `/mt5-prices` pra calcular
  variação)
- `/mt5-candles-history` (rota que o `ChartView.tsx` chama de verdade pra
  desenhar candle — inclusive dentro do próprio loop de paginação de
  backtest, então uma falha de região no meio de uma paginação longa já
  troca de região na tentativa seguinte, não só na próxima chamada à
  rota)

**Não aplicado ainda** (fora do escopo do sintoma relatado, mas ainda se
beneficia do cache compartilhado atualizado pelos 3 pontos acima): rotas
de posições/conta/execução de ordem (`account-information`, `positions`,
`orders`, `trade`) e o teste de conexão de credencial — continuam usando
só `getMetaApiClientApiBase` (pega a região já promovida pelo cache, mas
sem o retry instantâneo dentro da própria chamada). Se a região cair
exatamente entre um refresh de preço e uma ordem, essas rotas ainda
tomariam 1 falha antes do cache se atualizar via alguma outra rota — não
confirmado que isso já aconteceu, registrado como gap conhecido.

## Verificação

`deno check --no-lock --node-modules-dir=auto supabase/functions/server/index.ts`:
14 erros, todos pré-existentes (mesmos de antes da mudança, não
relacionados — arquivo já tinha esse ruído documentado). Nenhum erro novo
introduzido pelas duas rodadas de edição.

Não testado ao vivo em produção ainda nesta sessão (mudança feita,
commit e deploy confirmados pelo Cleber logo em seguida — não
observei o resultado real pós-deploy nesta sessão).

## Commits

Cleber confirmou "commit deploy feito" — 2 commits entregues nesta
sessão (comandos prontos, rodados por ele):
1. Leitura correta do payload (`account.region`/`accountReplicas`).
2. Failover instantâneo (`metaApiFetchWithFailover` + aplicação nas 3
   rotas).

`supabase functions deploy server` rodado por ele em seguida.

## Pendente real

- **Confirmar ao vivo pós-deploy**: abrir o Gráfico de UKOUSD (ou
  qualquer símbolo não-cripto) e ver se abre normal mesmo com `london`
  ainda `DISCONNECTED` — não observado nesta sessão.
- **Gap conhecido**: rotas de execução/posição/conta não têm o retry
  instantâneo próprio (só herdam a região já corrigida pelo cache
  compartilhado). Se quiser fechar esse gap, é replicar o mesmo padrão
  `metaApiFetchWithFailover` nos ~6 call sites restantes (`account-information`,
  `positions`, `orders`, `trade` ×2, teste de conexão) — não feito por
  escopo/tempo desta sessão.
- **Causa raiz da região `london` cair** continua desconhecida (é a
  mesma classe de instabilidade recorrente da conta MetaAPI já
  catalogada no `CLAUDE.md` várias vezes) — este fix não resolve a
  instabilidade em si, só faz a plataforma não ficar refém dela quando
  a réplica saudável já existe.
