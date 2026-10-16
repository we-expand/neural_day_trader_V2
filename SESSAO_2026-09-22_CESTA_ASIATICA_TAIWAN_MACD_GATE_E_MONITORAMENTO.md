# Sessão 2026-09-22 (noite/madrugada) — Trava de MACD 5m, ampliação da cesta
# asiática (incl. Taiwan), busca de ativos corrigida e monitoramento de
# rate-limit da cesta nova

> Handoff completo desta sessão. Resumo de 1-2 linhas já promovido pro
> `CLAUDE.md` principal quando aplicável — este arquivo fica só como
> detalhe de consulta.

## Contexto

Cleber ligou o LLM Brain numa configuração dedicada pra operar a **madrugada
asiática** (JPN225/HKG33/CHINA50/AUS200 + suporte), e ao longo da sessão:
1. Reportou que a IA ignorou uma virada real do MACD de 5 minutos numa
   entrada perdedora (XETUSD SHORT).
2. Pediu mais índices asiáticos na cesta, especificamente perguntando por
   Taiwan.
3. Não achou os ativos novos na busca do AI Trader (bug real, corrigido).
4. Pediu monitoramento contínuo de 5 em 5 min por rate-limit da MetaAPI,
   com 9 ativos configurados.
5. Perguntou sobre volume baixo aparecendo como "elevado" no log (achado
   de config, não bug — decisão dele manter como está).

## 1. Trava de MACD 5m contra entrada na contramão da virada

**Achado real, com dado**: XETUSD SHORT aberto 2026-09-22 22:32 UTC, stopado
em -$3,55. Recalculando o MACD 5m com o candle oficial real da corretora:

| Vela (UTC) | Histograma |
|---|---|
| 22:10 | -1,042 |
| 22:15 | -0,615 |
| 22:20 | -0,272 |
| 22:25 | -0,079 |
| **22:30 (entrada)** | **+0,312 (cruzou pra cima)** |

O histograma vinha encolhendo 3 velas seguidas e cruzou pra cima na própria
vela da entrada. O `reasoning` da IA dizia "MACD negativo indicando momentum
vendedor ativo" — o sistema só expunha o **sinal** (label ALTA/BAIXA) do
histograma, nunca a **inclinação**.

**Fix aplicado** (commit `061bc9e01`):
- `llm-active-brain/src/atr.ts`: `MacdResult` ganhou `turning`
  (`VIRANDO_PARA_CIMA`/`VIRANDO_PARA_BAIXO`, calculado nas últimas 3 velas)
  e `histogramRecent` (os 3 valores brutos, pra auditoria).
- `llm-active-brain/src/tools.ts`: trava dura em `open_position`, MACD
  **fixo em 5m** (independente do timeframe operacional escolhido no
  Setup) — bloqueia SHORT se o MACD 5m cruzou pra cima, está virando pra
  cima, ou está ALTA sem já estar virando pra baixo (e o espelho pro LONG).
  Reversão legítima continua permitida (ex.: SHORT com MACD ainda positivo
  mas já virando pra baixo passa).
- `llm-active-brain/src/agent.ts`: prompt reforçado (princípio 1d) pra ler
  `turning`/`histogramRecent`, não só o label.
- `llm-active-brain/src/config.ts`: `macd5mTurnGateEnabled`
  (`MACD_5M_TURN_GATE`, default true).

**Teste retroativo** (candle real, 4 trades do dia): a trava teria
bloqueado exatamente a entrada problemática (XETUSD 22:32) e deixaria
passar os outros 3 (incluindo o vencedor UKOUSD +$5,47/+$2,64). Amostra
pequena — não é prova de melhora no líquido, só confirma que a lógica pega
o caso identificado.

`tsc --noEmit` limpo. **Commitado e já em produção** (restart confirmado
rodando com o código novo, ver seção 4).

## 2. Cesta ampliada: 11 pares da sessão asiática, incluindo Taiwan

Cleber perguntou por mais índices asiáticos, especificamente Taiwan.
**Investigação real, não suposição**: puxei a lista oficial de símbolos da
conta MetaAPI (`/users/current/accounts/{id}/symbols`, 364 símbolos) e
testei nomes alternativos de Singapura/Índia/Taiwan/Coreia/China-H — todos
HTTP 404. **Não existe nenhum outro índice asiático na Infinox** além dos 4
já na cesta (AUS200/JPN225/HKG33/CHINA50); `HK50ft` é o mesmo Hang Seng
como futuro, redundante.

**Alternativa aprovada**: pares de moeda que operam na sessão asiática,
todos confirmados via especificação real da MetaAPI + cotação ao vivo antes
de adicionar:

| Par | Spread real (2026-09-22 23:36 UTC) |
|---|---|
| USDJPY | 0,0064% |
| AUDUSD | 0,0112% |
| NZDUSD | 0,0122% |
| AUDJPY | 0,0125% |
| NZDJPY | 0,0189% |
| EURJPY | 0,0055% |
| GBPJPY | 0,0081% |
| USDCNH | 0,0242% |
| USDSGD | 0,0110% |
| **USDTWD (Taiwan)** | 0,1041% (~10x um par principal) |
| XAUJPY (ouro em iene) | 0,0108% |

`USDHKD` ficou de fora (tradeMode DISABLED na corretora).

**Cuidados aplicados** (commit `bc99bd85b`, `llm-active-brain/src/
assetBasket.ts` + `commissionModel.ts` + `platformCommissionLedger.ts` +
`supabase/functions/server/platformCommission.ts`):
- `LOT_SIZE` convertido pra notional real em USD por par (ex. USDJPY =
  100000/USDJPY ≈ 635,1), mesmo cuidado do fix de PnL 20x do NAS100
  (2026-08-27) — evita repetir o mesmo bug por moeda de cotação em vez de
  contrato errado.
- **Bug de custo achado e corrigido no caminho**: `getPointValue`
  (`TradeSizing.ts`, compartilhado com o app) devolve pip 0,0001 pra
  qualquer símbolo com "JPY" no nome — pip real de par de iene é 0,01,
  então o custo desses pares saía ~100x subestimado. Override local em
  `commissionModel.ts` (`PAIR_COST_OVERRIDE`) com pip e classe corretos
  por par, calibrado no spread real medido.
- Grupos correlacionados novos por lado real da exposição de moeda (LONG
  em qualquer par-JPY = vendido em iene; USDCNH/USDSGD/USDTWD juntos;
  AUDUSD/NZDUSD juntos).
- **Achado colateral, corrigido**: `platformCommissionLedger.ts` e
  `supabase/functions/server/platformCommission.ts` já eram importados
  pelo código commitado (`neuralBridge.ts`/`server/index.ts`) mas **nunca
  tinham sido versionados** — um `git clone` limpo quebraria o motor e a
  Edge Function. Versionados neste mesmo commit.

`tsc --noEmit` limpo, `deno check` limpo na function. Commitado.
**Deploy do `server` já rodado pelo Cleber.**

## 3. Busca de ativos no AI Trader não achava os pares novos

Cleber reportou "não vejo os ativos" procurando dentro do AI Trader.
**Causa raiz real**: os 11 pares SEMPRE estiveram no catálogo (confirmado
rodando a função real `getInfinoxAssetsByCategory()`) — o problema era que
a busca (`InfinoxAssetsBrowser.tsx`) só casava pelo **código** do símbolo
(USDJPY, USDTWD...). Digitar "Taiwan", "iene", "Japão" ou "yuan" não achava
nada.

**Fix** (commit `a30603534`): busca agora também casa por nome/descrição do
catálogo (`assetDatabase.ts`) e por termos em português por moeda/ativo
(`PT_SEARCH_TERMS_BY_CODE`), com normalização de acento. Testado com o
catálogo real:

| Busca | Resultado |
|---|---|
| Taiwan | USDTWD |
| iene | USDJPY, AUDJPY, NZDJPY, EURJPY, GBPJPY, XAUJPY (+CADJPY/CHFJPY, não operáveis) |
| yuan | USDCNH |
| singapura | USDSGD |
| ouro | XAUJPY, XAUUSD + demais pares de ouro |

**Atenção deixada registrada pro Cleber**: a busca também mostra pares que
o motor NÃO opera (ex. CADJPY, CHFJPY, EURSGD) — só os 11 liberados no
item 2 são reconhecidos pelo `llm-active-brain`.

`tsc --noEmit` limpo. Commitado. **Não testado ao vivo no navegador** (dev
local exige login).

## 4. Monitoramento de 5 em 5 min da cesta asiática (9 ativos)

Cleber ligou o motor com config própria pra madrugada: 9 ativos —
`BTCUSD, SPX500, HKG33, CHINA50, JPN225, AUS200, USDTWD, USDSGD, XAUJPY`
(confirmado em `ai_user_config`, `updated_at` 23:48:31 UTC). Pediu
monitoramento contínuo de rate-limit da MetaAPI.

**Checagem inicial (antes de armar o monitor)**:
- Só 1 processo do `llm-active-brain` rodando (falso alarme inicial: um 2º
  processo Node achado era o `streaming-relay`, projeto separado, não
  duplicata).
- Processo rodando desde 20:45:57 -03 (após o crash anterior, código 137 =
  SIGKILL/OOM, watchdog religou sozinho) — já usando o código novo (trava
  MACD + cesta ampliada), confirmado por timestamp de arquivo vs. start do
  processo.
- Zero rate-limit real no log até então (o único "429" que apareceu era
  parte do número `25101.429531`, uma EMA — falso positivo de grep).

**Monitor armado**: `CronCreate`, `*/5 * * * *` (job `c4b29132`), checando
a cada disparo: rate-limit (429/TooManyRequests/504/502/Failed to
subscribe/not connected to broker), processo único, cesta correta via
log, staleness por ativo, e trades novos via SQL (`ai_trades`).

**Resultado do monitoramento (23:52 UTC → 00:59 UTC, ~9 checagens)**:
- **Zero rate-limit da MetaAPI em toda a janela observada.**
- Processo sempre único, sem crash novo depois do religamento das 20:45.
- Cesta confirmada correta nos 9 ativos (o cache de 60s levou ~1 ciclo pra
  refletir a config nova, sem problema).
- HKG33 e CHINA50 ficaram `stale` o tempo todo (esperado — fora do horário
  de pregão de Hong Kong/Xangai, motor bloqueia entrada sozinho).
- USDTWD também apareceu `stale` por um período (só negocia no horário de
  Taipei, ~01h-08h UTC — esperado, não é anomalia).
- **Nenhum trade aberto/fechado registrado em `ai_trades` durante toda a
  janela monitorada.**
- **Pendência real, não verificada**: no ciclo 6 (~00:55 UTC), o modelo
  registrou em `log_thought` a intenção explícita de abrir BTCUSD LONG (e
  cogitou XAUJPY SHORT), mas a chamada `open_position` correspondente não
  apareceu no trecho de log visto antes do monitor ser desarmado, e a
  consulta a `ai_trades` (00:59 UTC) segue sem nenhuma linha nova.
  **Confirmar na próxima sessão se essa entrada saiu ou foi bloqueada por
  algum gate (a trava de MACD 5m nova é candidata óbvia a checar
  primeiro).**

Monitor desarmado a pedido do Cleber às ~01h Brasília (00:59 UTC).

## 5. Achado de config: "volume elevado" mostrando ratio baixo (0,4-0,8x)

Cleber notou volumes tipo 0,54/0,73 marcados como `"elevated": true` e
perguntou se estamos operando com volume baixo.

**Achado real, não bug**: dois fatores empilhados fazem o rótulo
`elevated` ficar enganoso durante a madrugada:
1. `.env` do motor tem `MT5_VOLUME_ELEVATED_RATIO=1.0` (não é o default do
   código, 1,05 — alguém já tinha baixado antes).
2. Às 21h57 Brasília (horário da checagem) já estava dentro da **janela
   noturna** (17h-00h Brasília, decisão de sessão anterior, 2026-09-15/21)
   que usa um limiar ainda mais permissivo: `MT5_VOLUME_ELEVATED_RATIO_EVENING`
   (comentado no `.env`, cai no default do código, **0,42**).

Resultado: volume real ficando **abaixo** da média (0,52 a 0,76x, coerente
com sessão asiática de madrugada, liquidez mais fraca) estava sendo
classificado `elevated:true` só porque passa do limiar de 0,42 — não
porque o volume subiu. O próprio modelo chegou a escrever "Volume elevado
0,54" no `log_thought`, lendo o rótulo ao pé da letra.

**Decisão do Cleber**: manter como está, não mexer no `.env` agora.
Nenhuma mudança de código feita nesta seção — só diagnóstico.

## Pendências reais

1. **Confirmar se a entrada BTCUSD LONG (e XAUJPY SHORT) sinalizada no
   ciclo 6 (~00:55 UTC) foi executada, bloqueada por gate, ou abandonada**
   — não verificado antes do fim da sessão.
2. Testar visualmente no navegador a busca de ativos corrigida (item 3) —
   dev local exige login, não testado ao vivo nesta sessão.
3. Observar se a trava de MACD 5m (item 1) reduz a frequência de entradas
   de forma relevante (meta de 10-15 entradas/12h já registrada no
   `CLAUDE.md` principal) — sem amostra suficiente ainda.
4. Sem validação estatística de nenhum dos itens desta sessão — tudo aqui
   é correção de mecânica/expansão de cesta, não alegação de edge.
5. Rótulo "volume elevado" (item 5) continua enganoso por design em
   qualquer sessão futura dentro da janela 17h-00h Brasília — decisão
   consciente do Cleber de manter, registrada aqui pra não ser reaberta
   sem contexto.

## Commits desta sessão

- `061bc9e01` — trava de MACD 5m contra virada
- `bc99bd85b` — 11 pares da sessão asiática (Taiwan/USDTWD incluso) +
  correção de custo em pares JPY/CNH/TWD + versiona 2 arquivos que já
  eram importados sem nunca terem sido commitados
- `a30603534` — busca de ativos por nome/termos em português

Todos já commitados e (pelo relato do Cleber) deployados/reiniciados.
