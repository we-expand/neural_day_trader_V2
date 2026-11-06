# Sessão 2026-09-23 (tarde) — Reversão por Estocástico, veredito rápido e PnL líquido

## Contexto
Cleber reportou que o LLM Brain (restartado por volta de 13h21 Brasília) não fazia
entradas à tarde. Config de 22/09 (~70% de acerto declarado) agradou, mas "tem que
trabalhar o dia inteiro". Decisão explícita do Cleber: **quebrar o congelamento de
mecânica de 22/09** com mudanças "não radicais".

## Diagnóstico (dado real, não suposição)
- Motor saudável: processo único, 14 ciclos, cotações frescas, sem erro de infra.
- Entradas por hora (14 dias, Brasília): 10h-13h = 21/9/15/17; **14h-16h = 5/4/5**.
  Buraco concentrado na tarde (meio da sessão americana, Europa fechada, regime
  `CONSOLIDACAO_BAIXA_VOL`).
- Bloqueios de `open_position` (7 dias): volume = 1 (**não é volume**). Dominante:
  Estocástico e **padrão de candle em REVERSAO** (118 sem padrão + 25 "padrão no mesmo
  candle" = 143 reversões barradas só por essa regra).
- Causa do "DIVERGENTE" frequente: `computeMarketDirection` exigia **unanimidade** entre
  até 5 sinais (1 discordante = DIVERGENTE).
- Dia 22/09 tinha 7 trades fechados (4 TP/3 SL), operou de madrugada, 13h, 17h e 19h —
  amostra pequena, num dia de mercado direcional.

## Mudanças de código (llm-active-brain, commits `b8f038f94`…`225d9289c`)
1. **REVERSAO** (`tools.ts`): removido padrão de candle e espera de candle extra.
   Libera se o Estocástico (5m ou 1H) tem **cruzamento %K/%D a favor do lado OU zona
   extrema oposta ao lado** (LONG+SOBREVENDIDO / SHORT+SOBRECOMPRADO). Vale o dia todo
   (a "janela da tarde 13h-17h" do commit `b8f038f94` foi substituída por isto).
   Continuam valendo: MACD 5m contra, veredito, contra-tendência ≥2 fatores, R:R,
   confiança ≥80%, stop mecânico, spread, exposição.
2. **Veredito rápido** (`atr.ts`, `computeMarketDirection`): método do Cleber — 3
   leituras (% do dia com banda neutra ±0,10%, tendência 5m, tendência 1H). ALTA/BAIXA
   = 2 de 3 concordam E a 1H não é contrária (veto). 15m/momentum/HMM saíram do
   veredito (params mantidos na assinatura, ignorados). `dayChangePct` guardado no
   snapshot da cotação (`lastQuoteSnapshotBySymbol`).
3. **Prompt** (`agent.ts`): princípio 0 reescrito para o veredito rápido; regra do
   Estocástico reescrita (o texto antigo dizia que extremo sem cruzamento NÃO era
   confirmação — contradizia o código).
4. **Instrumentação** (sem migration): `ai_trades.indicators_snapshot` agora grava
   `directionRule: "maioria-3-leituras-v1"`, `reversalRule:
   "estocastico-cruzamento-ou-extremo-v1"`, `reversalConfirmation`, `dayChangePct`.
   `setupType`/`marketDirectionConsensus` já eram gravados desde 15/09 (erro meu ao dizer
   que não eram).

## Mudança de frontend (commit `1a03ec9d2`)
`useApexLogic.ts`: PnL aberto (`order.currentProfit`, fonte única da UI) e o não-realizado
do equity agora são **líquidos do custo round-trip estimado desde o 1º tick**, e o
fechamento manual DEMO grava líquido no histórico/equity. Motivo: operação manual de 1 BTC
mostrava +$4 na boleta e fechou em -$20,53 no banco (custo $24,5 só aparecia no fechamento).
Não coberto: modo LIVE (usa `profit` da corretora), `SimulatorContext`/`OrdersPanel`
(usam `o.pnl`). Não testado no navegador.

## Achado: custo do cripto pode estar inflado
`research/CostModel.ts` → CRYPTO round-trip = 0,0291% do notional ($24,5 em 1 BTC):
spread medido (0,0145%) **+ slippage assumido do mesmo tamanho**. Se o slippage real for
menor, o `net_pnl` (que alimenta a memória de trades da IA) pune demais. **Pendente:
recalibrar com dado real de execução da Infinox** — não mexer sem dado.

## Linha de base (14 dias, sessão LLM Brain, ANTES das regras novas)
| setupType | fechados | acerto | PnL líq. |
|---|---|---|---|
| REVERSAO | 13 | 31% | -$13,61 |
| OUTRO | 15 | 33% | -$27,78 |
| ROMPIMENTO | 5 | 20% | -$20,71 |
| veredito ALTA | 20 | 20% | -$46,54 |
| veredito BAIXA | 17 | 35% | -$26,97 |
Só 34 trades têm `setupType` (gravado a partir de 15/09) — amostra pequena.

## Critério de reversão (definido ANTES de olhar resultado)
Com **10 reversões fechadas** sob `reversalRule` v1: acerto < 45% OU payoff < 1:1 →
reverter a regra do Estocástico e reavaliar. Duas mudanças foram feitas juntas
(reversão + veredito) — registrar isso ao interpretar o resultado.

## Query de acompanhamento
```sql
select indicators_snapshot->>'reversalRule' regra, indicators_snapshot->>'setupType' setup,
  count(*) filter (where status='CLOSED') fechados,
  round(100.0*count(*) filter (where status='CLOSED' and net_pnl>0)/nullif(count(*) filter (where status='CLOSED'),0)) acerto_pct,
  round(sum(net_pnl) filter (where status='CLOSED')::numeric,2) pnl_liq
from ai_trades where indicators_snapshot ? 'directionRule' group by 1,2 order by 3 desc;
```

## Estado ao encerrar
- Commits feitos pelo Cleber; motor reiniciado (2 processos = `tsx`+`node`, esperado).
- `npm run validate`: 37/37 asserts OK; as "3 etapas falharam" (`Dynamic require of
  "stream"`) são pré-existentes (idênticas sem as mudanças), não relacionadas.
- `tsc --noEmit` do motor limpo.

## Pendente
1. Acumular 10 reversões fechadas sob a regra nova e aplicar o critério acima.
2. Recalibrar custo CRYPTO com dado real (item acima).
3. Latência do ciclo: `get_mt5_quote` faz ~10 chamadas sequenciais (achado de 22/09) — não
   paralelizado.
4. Gate de contra-tendência ainda exige ≥2 fatores (Estocástico extremo sozinho não basta
   ali) — próximo gate a olhar se reversões continuarem barradas.
5. Operações manuais de teste do Cleber hoje (BTCUSD LONG/SHORT, 16h) estão no ledger
   como trades normais (-$8,97 e -$20,53) — não editar via UPDATE; se for tratar como teste,
   usar `is_test_data` + justificativa.
6. Itens antigos: deploy `dev-lab-ai-suggestions`, confirmar `duration_seconds`/`mfe_usd`,
   GER40 com feed travado 3x seguidas visto no log.
