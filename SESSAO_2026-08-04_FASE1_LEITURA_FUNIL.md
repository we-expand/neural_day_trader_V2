# Sessão 2026-08-04 (noite, 3ª janela) — Fase 1: a primeira leitura do funil

> Continuação direta de `SESSAO_2026-08-04_FASE1_COSTURA_RUNNER.md` e
> `SESSAO_2026-08-04_FASE0_TELEMETRIA_FUNIL.md`. Este documento registra o
> **primeiro dado de funil real** já coletado pelo projeto — o passo 1 da lista
> "Próximos passos" do `NEXT_SESSION.md` anterior.

## Contexto

Cleber reportou: "A AI Trader está rodando e até agora não fez nenhuma entrada."

Diferente de todas as vezes anteriores em que essa pergunta foi feita, agora
existe telemetria: o hard reload pedido no handoff foi feito, o bundle novo está
em execução e `ai_funnel_snapshots` está gravando.

## Sessão observada

| Campo | Valor |
|---|---|
| `session_id` | `f6785c05-eac4-49d6-990a-1a5de9ec8d30` |
| Status | `RUNNING` |
| Início | 2026-08-04 **19:33:22 BRT** |
| Modo | DEMO |
| Timeframe operacional | **15m** |
| `activeStrategyId` | **`"2"`** — *Cruzamento de Médias com Filtro de Regime* |
| Ativos (9) | EURUSD, XBNUSD, BTCUSD, US30, NAS100, XAUUSD, GER40, SPX500, XAGUSD |
| `maxAssets` / `maxPositions` | 6 / 5 |
| `minWinRate` | 55 |
| `newsFilter` | true |
| `cooldownMinutes` | 60 |

A sessão anterior (`2cff1634`, iniciada 13:20 BRT, 12 ativos, TF 5m,
`minWinRate` 30) está `COMPLETED`. O trade em SPX500 das 19:24 BRT pertence a
ela, **não** a esta — desde 19:33 não houve nenhuma entrada.

## Dado bruto do funil — 35 minutos (19:33 → 20:08 BRT)

| Métrica | Valor | Esperado |
|---|---|---|
| Janelas gravadas | 35 | — |
| **Ticks** | **80** | ~420 (12/min × 35min) |
| Avaliações | 240 | — |
| Avaliações por tick | 3,0 | 3 (`ASSETS_PER_TICK`) |

### `stage_counts` agregado

| Estágio | N | % |
|---|---|---|
| `NO_SIGNAL` | **230** | **97,0%** |
| `DATA_NOT_REAL` | 7 | 3,0% |

Nenhuma avaliação chegou a `STRATEGY_CONFIDENCE_LOW`, `CONFIG_DIRECTION`,
gates de risco, filtro de notícia ou `ENTRY_EXECUTED`. **Tudo morre no primeiro
estágio.**

### `symbol_stage_counts`

| Símbolo | `NO_SIGNAL` | `DATA_NOT_REAL` |
|---|---|---|
| GER40 | 39 | 3 |
| US30 | 35 | — |
| SPX500 | 33 | — |
| XBNUSD | 29 | 4 |
| NAS100 | 27 | — |
| BTCUSD | 26 | — |
| EURUSD | 21 | — |
| XAGUSD | 20 | — |
| XAUUSD | 15 | — |

### Distribuição de `ticks` por janela — o achado que ninguém tinha medido

| ticks | janelas |
|---|---|
| **1** | **30** |
| 2 | 1 |
| 5 | 1 |
| 11 | 1 |
| 12 | 2 |
| 13 | 1 |

## Conclusão 1 — a fome de dado foi resolvida, e a mitigação do Cleber funcionou

`DATA_NOT_REAL` caiu de praticamente 100% das avaliações (diagnóstico das ~40min
da tarde, `SESSAO_2026-08-04_DIAGNOSTICO_ZERO_ENTRADAS_AI_TRADER.md`) para
**3,0%**, concentrado em 2 ativos (GER40 e XBNUSD). A redução manual do universo
de ~50 para ~12 ativos aliviou o rate-limit da conta MetaAPI compartilhada. **A
pendência aberta naquele documento está fechada: o dado real está fluindo.**

Não é mais preciso instrumentar contagem de 429/min — a hipótese de que o
gargalo era a carga agregada de todos os usuários da plataforma **não se
sustentou** para este volume de ativos.

## Conclusão 2 — o funil morre por ausência de setup, não por gate apertado

97% em `NO_SIGNAL` significa que `evaluateStrategyAt`
([useApexLogic.ts:1601](src/app/hooks/useApexLogic.ts:1601)) devolveu
`signal: null`. Os motivos amostrados (campo `samples`, máx. 2 strings por
janela) se dividem em dois:

| Motivo amostrado | Janelas |
|---|---|
| `Filtro "ADX > 20 (regime de tendência…)" não satisfeito` | 35 |
| `Cruzamento de Médias com Filtro de Regime` (fallback: `reasons` vazio) | 37 |

O segundo é o nome da estratégia, usado como fallback quando o evaluator não
registra razão — na prática, **o cruzamento não ocorreu**.

**Ressalva de método:** `samples` guarda no máximo 2 strings por janela, não a
razão de cada uma das 240 avaliações. A proporção acima indica que os dois
motivos são comparáveis em frequência, mas **não é uma contagem exata** e não
deve ser citada como tal.

### Por que isso é comportamento esperado do preset 2

O preset ([presetStrategies.ts:139-148](src/app/data/presetStrategies.ts:139))
exige, simultaneamente:

- `EMA20 CROSS_ABOVE EMA50` — **evento pontual**, não estado;
- `EMA50 RISING`;
- filtro `ADX(14) > 20`;
- e é **LONG-ONLY** (`entrySignal: 'BUY'`, sem perna short simétrica).

Um cruzamento de médias é, por construção, raro. A janela de detecção é o candle
atual de 15m (`candles.length - 1`, candle em formação; buffer renovado a cada
60s — [useApexLogic.ts:1580](src/app/hooks/useApexLogic.ts:1580)), então o sinal
persiste enquanto o candle não fecha. Ainda assim, com 9 ativos e 35 minutos de
observação, **zero entradas é o resultado esperado dessa configuração, não uma
anomalia.**

**O número que falta:** a taxa base do preset 2 — quantos sinais ele produziria
por dia nesses 9 ativos em 15m, medido em histórico real. Sem esse número,
qualquer mexida em limiar é chute, exatamente o que o handoff anterior proibiu.

## Conclusão 3 — 81% da amostragem é perdida por throttle de aba em segundo plano

Esta era a hipótese registrada no handoff anterior como "causa que nunca pôde
ser testada antes". **Foi testada e está confirmada.**

30 das 35 janelas registraram `ticks = 1`. As 5 restantes registraram 2, 5, 11,
12, 12 e 13 — ou seja, o loop de 5s roda corretamente (~12 ticks/janela)
**quando a aba está em foco**, e é estrangulado para 1 execução por minuto pelo
Chrome quando a aba está oculta.

Efeito prático: **80 ticks em vez de ~420 — 81% da capacidade de amostragem
perdida.** Como a seleção de ativos é aleatória ponderada por tier, 3 por tick
([useApexLogic.ts:1383](src/app/hooks/useApexLogic.ts:1383)), cada ativo passa a
ser avaliado uma vez a cada ~3 minutos em vez de a cada ~15 segundos.

**Nenhum gate tem culpa.** É o navegador — e é exatamente o argumento
independente mais forte a favor da Fatia 2 do runner no servidor: no browser, a
taxa de amostragem depende de a aba estar visível.

## O que NÃO foi feito, e por quê

- **Nenhum limiar foi afrouxado.** Ler o funil responde *onde* os setups morrem,
  não *se* o limiar está errado. Falta a taxa base (acima).
- **A faixa morta do `detectRegime`** (ADX 18–25 → `INDEFINIDO`,
  `MarketScoreEngine.ts:437`) **não foi tocada e não é o veto observado** — o
  veto medido é o filtro `ADX > 20` da própria estratégia, num estágio anterior.
  Não confundir os dois.
- **Nenhuma mudança de código nesta janela.** Sessão de leitura de dado.

## Correção de estado — a Fatia 1 JÁ está commitada

`NEXT_SESSION.md` e o `CLAUDE.md` afirmam que a Fatia 1 do runner está "não
commitada". **Está desatualizado.** Verificado na branch `dev`:

```
81c1237da feat(cerebro): Fase 0 fatia 1 — costura verificada que torna o motor importavel no servidor (Deno)
52f0f6ea0 feat(cerebro): Fase 0 fatia 1 — costura que torna o motor de decisao importavel no servidor
```

`git ls-files supabase/functions/ai-runner/` devolve os 4 arquivos como
rastreados e sem modificação pendente. As 8 correções de extensão de import nos
módulos do motor também já entraram.

O que **continua** não commitado na árvore:

| Arquivo | Origem |
|---|---|
| `CLAUDE.md`, `NEXT_SESSION.md` (M) | linha de trabalho do cérebro |
| `AIToolsControl.tsx`, `ATRTrailingStopManager.tsx`, `PyramidingConfigPanel.tsx` (M) | outra sessão — decisão do Cleber |
| `SESSAO_2026-08-04_ATR_PYRAMIDING_E_AUDITORIA_CONFIG.md` (??) | idem |
| `SESSAO_2026-08-04_FASE1_COSTURA_RUNNER.md` (??) | doc da 2ª janela, nunca commitado |
| `SESSAO_2026-08-04_FASE1_LEITURA_FUNIL.md` (??) | este documento |

## Próximos passos, em ordem

1. **Medir a taxa base do preset 2** — sinais/dia nos 9 ativos em 15m, histórico
   real. É o número que decide se "zero entradas" é o motor correto ou uma
   config travada num regime que quase não ocorre. Prioridade máxima: tudo mais
   sobre o cérebro depende dele.
2. **Manter a aba em primeiro plano** durante observação ao vivo, até a Fatia 2
   existir — recupera 5× de amostragem sem tocar em código. Alternativa
   estrutural é a própria Fatia 2.
3. **Fatia 2 do runner** — rota agendada que lê sessões `RUNNING`, roda o motor e
   grava `ai_funnel_snapshots`, sem abrir ordem. Agora com uma segunda
   justificativa medida (o throttle), além da original.
4. **Fase 2 — o `k(t)`**, inalterada.

## Consultas usadas (reprodutíveis)

Projeto Supabase `wyvdsxtcmizettljxtbg`:

```sql
-- agregado do funil
select min(window_start at time zone 'America/Sao_Paulo') as inicio_brt,
       max(window_end   at time zone 'America/Sao_Paulo') as fim_brt,
       count(*) as janelas, sum(ticks) as ticks_total,
       round(avg(ticks),1) as ticks_medio, sum(evaluations) as avaliacoes
from ai_funnel_snapshots;

-- onde os setups morrem
select key as estagio, sum(value::int) as total
from ai_funnel_snapshots, jsonb_each(stage_counts)
group by key order by total desc;

-- por símbolo
select sym.key as simbolo, st.key as estagio, sum(st.value::int) as n
from ai_funnel_snapshots f,
     jsonb_each(f.symbol_stage_counts) sym,
     jsonb_each(sym.value) st
group by 1,2 order by 1,3 desc;

-- distribuição de ticks (throttle de aba)
select ticks, count(*) as janelas, sum(evaluations) as avaliacoes
from ai_funnel_snapshots group by 1 order by 1;

-- motivos amostrados de NO_SIGNAL
select s.motivo, count(*) as janelas
from ai_funnel_snapshots f,
     lateral jsonb_array_elements_text(f.samples->'NO_SIGNAL') as s(motivo)
group by 1 order by 2 desc;
```
