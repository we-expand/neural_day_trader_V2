# Sessão 2026-08-16 — Calibração do runner em 1m + fix de janela de candles

> Motivo da sessão: Cleber deixou a IA rodando sozinha (~4h40, sessão
> `41378b46-2a7d-4155-bde0-b3b099df6c1a`, preset "2" 1h) e ela não fez
> nenhum trade. Pediu pra investigar e "deixar ela operar" pra medir volume
> e consistência de execução, mesmo sem edge validado.

## Diagnóstico inicial — zero trades era esperado, não bug

Preset ativo era `"2"` ("Cruzamento de Médias com Filtro de Regime",
[presetStrategies.ts:115-149](src/app/data/presetStrategies.ts)):
candle de **1h**, exige EMA20 cruzar EMA50 pra cima **no mesmo candle**, E
EMA50 em alta, E ADX(14)>20, long-only. Evento raro por desenho (~24
candles/dia por ativo) + `cooldownMinutes: 60` no config da sessão. Zero
trade em 4h40 é estatisticamente esperado com esse preset, não indica
motor travado — bate com a conclusão de 2026-08-05 (nenhum preset é
lucrativo líquido de custo, edge ≈ 0).

## Mudança de config aplicada (Cleber, via SQL Editor)

Pra gerar volume observável de calibração (não pra buscar lucro):

```sql
update ai_sessions
set config = config || '{"activeStrategyId": "5", "cooldownMinutes": 5}'::jsonb
where id = '41378b46-2a7d-4155-bde0-b3b099df6c1a';

update ai_sessions
set config = jsonb_set(config, '{timeframe}', '"1m"')
where id = '41378b46-2a7d-4155-bde0-b3b099df6c1a';
```

Preset `"5"` (Momentum Scalp, 1m) já existia no código com aviso explícito
de "não habilitar como padrão de produção" (latência MetaAPI) — usado aqui
de propósito só pra teste de execução/volume, não como mudança de tese.

## Bug achado e corrigido: janela de candles curta demais em 1m

`runTradingCycle.ts` pedia candles numa janela de calendário de
`100 barras × 4 × duração do timeframe`. Em 15m/1h isso sobra; em **1m**
vira só ~6h40 — curto demais pra cobrir o horário fechado de GER40/XAUUSD
(fecham fora do pregão, ao contrário de FX/cripto), que passaram a cair em
`CANDLES_FETCH_FAILED` com "0 candles" (não erro de rede, resposta vazia).

**Fix aplicado** ([runTradingCycle.ts:449-452](src/app/services/strategy/runTradingCycle.ts:449)):
piso mínimo de 48h na janela, independente do timeframe:

```ts
const MIN_WINDOW_MS = 48 * 60 * 60 * 1000;
const windowMs = Math.max(REQUIRED_BARS * 4 * barMs[opTimeframe], MIN_WINDOW_MS);
const start = new Date(end.getTime() - windowMs);
```

`npm run validate` passou 100% (0 falhas) antes do commit. Commitado e
deployado na Edge Function `ai-runner` (versão 13, 2026-08-16 23:24:11).

## Resultado pós-fix — resolveu só parte do problema

`CANDLES_FETCH_FAILED` **reduziu mas não sumiu** em GER40/XAUUSD. Causa
residual, confirmada nos logs (`ai_funnel_snapshots.samples`):
- ~metade das falhas: MetaAPI responde HTTP 200 com `candles: []` (sem
  erro, resposta vazia) mesmo com 48h de janela.
- ~metade: HTTP 429 real (rate-limit da conta MetaAPI compartilhada da
  plataforma — risco crônico já documentado no `CLAUDE.md`).

Ou seja: o fix corrigiu o bug de janela curta (causa real, resolvida), mas
existe um segundo problema — separado, de infraestrutura externa — que só
afeta GER40/XAUUSD em timeframe 1m: a conta MetaAPI compartilhada não
entrega histórico de 1m de forma confiável pra esses dois símbolos.
`EURUSD`, `XBNUSD`, `SPX500`, `BTCUSD` avaliam normalmente, sem esse erro.

**Efeito colateral positivo observado**: depois do fix, os estágios
`COMBINED_CONFIDENCE_LOW` e `DATA_NOT_REAL` (gate legítimo contra dado
sintético, `fonte=generated`) apareceram pela primeira vez na telemetria —
sinal de que mais ciclos estão passando do primeiro gate de sinal do que
antes, mesmo sem trade fechado ainda até o fim desta sessão.

## Decisão do Cleber (fim desta sessão)

Deixar como está — não remover GER40/XAUUSD da lista de ativos, não
investigar mais a fundo a causa MetaAPI agora. Ativos ficam mudos em 1m,
resto da lista (4 de 6) segue avaliando normal.

## Pendências reais em aberto

1. **Causa raiz de GER40/XAUUSD em 1m não investigada a fundo** — é
   limitação de dado real da MetaAPI compartilhada (histórico 1m
   intermitente/vazio + rate-limit), não bug de código conhecido. Não
   mexer de novo na janela de candles sem antes puxar mais log/entender
   se é padrão de horário específico ou aleatório.
2. **Ainda não fechou nenhum trade** na sessão de calibração até o fim
   desta sessão (preset 5, 1m, 4 ativos funcionais). Continuar observando
   `ai_trades` e `ai_funnel_snapshots` da sessão
   `41378b46-2a7d-4155-bde0-b3b099df6c1a` nas próximas horas pra saber se
   o preset scalp realmente gera volume de sinal usável, ou se cooldown de
   5min + gate de confiança ainda deixam passar pouco.
3. Ver se `cooldownMinutes: 5` é adequado pra meta de ~10 trades/dia do
   Cleber, ou se precisa de novo ajuste — só decidir depois de ver dado
   real de alguns trades fechados.

## Comandos de monitoramento (reutilizar em sessão futura)

```sql
select session_id, stage_counts, created_at from ai_funnel_snapshots
where session_id = '41378b46-2a7d-4155-bde0-b3b099df6c1a'
order by created_at desc limit 20;

select symbol, side, status, entry_price, exit_price, pnl, net_pnl,
       ai_confidence, exit_reason, entry_time, exit_time
from ai_trades
where session_id = '41378b46-2a7d-4155-bde0-b3b099df6c1a'
order by entry_time desc limit 30;
```
