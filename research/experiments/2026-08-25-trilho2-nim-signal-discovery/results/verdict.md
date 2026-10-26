# Trilho 2 — NIM Signal Discovery — veredito (2026-08-25)

## Resumo

Das 5 hipóteses geradas pelo NIM Signal Discovery Agent na Etapa 0
(`hypotheses.json`), **2 foram backtestadas com dado real** e **3 ficaram
bloqueadas** por falta de dado histórico — não por decisão de escopo, e não
fabricadas para contornar a falta.

## As 2 hipóteses testadas (correlação cross-asset, `backtest_correlation.ts`)

| Hipótese | Trades holdout | Win% holdout | %líq total holdout | Sharpe holdout | DSR |
|---|---:|---:|---:|---:|---:|
| `CorrCrossRegime_5m_BTC` | 190 | 52.1% | -3.94% | -0.136 | 0.5% |
| `CorrCrossRegime_1h_XAGUSD` | 50 | 62.0% | +4.33% | 0.065 | 53.5% |

**Nenhuma das duas passa no critério de aprovação da seção 13.4/8**
(Deflated Sortino/Sharpe acima do piso definido **e** robustez ≥ 70%):

- `CorrCrossRegime_5m_BTC`: **achado inválido por construção**, não só
  negativo. BTCUSD e XBNUSD são buscados da mesma fonte (Binance BTCUSDT)
  no `fetch_candles.mjs` deste projeto — a "correlação cross-asset" testada
  é entre uma série e ela mesma (corr ≈ 1.0 sempre). O resultado líquido
  negativo (-3.94%, DSR 0.5%) reflete só o filtro de volatilidade
  disparando em ruído, não falta ou presença de edge cross-asset real. O
  LLM gerou a hipótese sem saber que os dois símbolos mapeiam pra mesma
  fonte no nosso pipeline — achado de processo, não de mercado.
- `CorrCrossRegime_1h_XAGUSD` (prata vs. ouro, correlação real):
  resultado líquido positivo (+4.33% em 50 trades holdout, win rate 62%),
  mas **Sharpe baixo (0.065) e DSR (53.5%) abaixo do piso de robustez**
  exigido pela metodologia do projeto. Amostra pequena (50 trades) e
  resultado não separável de ruído com confiança suficiente. **Não
  validado** — mesmo padrão de toda busca de edge anterior do projeto
  (AI_BRAIN_SPEC.md seção 8): positivo bruto não é a mesma coisa que edge
  comprovado.

## As 3 hipóteses BLOQUEADAS (dependem de NLP sobre texto de calendário econômico)

`EconCal_Veto_1h_Spread`, `SentimentoNLP_RegimeFilter_15m_SPX`,
`EconCal_Veto_Sent_NLP_5m_US30` — todas exigem sentimento/surpresa sobre o
**texto** de um evento econômico específico num instante histórico
passado.

**Motivo do bloqueio, confirmado por leitura de código**: o endpoint real
do projeto (`/economic-calendar`, usado pelo gate de notícias/VIX do
`ai-runner` — ver `supabase/functions/ai-runner/lib/marketContext.ts`) só
devolve a agenda do **dia corrente** (raspagem ao vivo de
TradingView/MQL5/Investing.com). Não existe tabela nem arquivo no projeto
que arquive calendário econômico histórico (texto do evento, actual,
forecast, previous) — cada consulta é "hoje", sem retenção. Confirmado com
`grep` em `supabase/migrations/`: nenhuma tabela `economic_calendar` /
`calendar_events` / `news_events`.

Sem histórico real, testar essas 3 hipóteses exigiria uma de duas coisas,
ambas proibidas pela convenção do projeto de nunca fabricar dado:
1. Fabricar retroativamente texto/sentimento de eventos passados (inventado,
   não real).
2. Aproximar "sentimento" por um proxy numérico (ex: heurística sobre
   impacto/moeda) que não é o que a hipótese pede — mudaria o teste pra
   outra coisa, não seria honesto reportar como teste da hipótese original.

**Status**: bloqueado, não "não validado". Decisão da sessão anterior
(2026-08-25) já registrada: sem orçamento pra newsfeed pago por ora. Para
desbloquear no futuro sem gastar dinheiro, seria preciso primeiro **passar
a arquivar** o retorno do `/economic-calendar` (que já é gratuito) numa
tabela própria, dia a dia, e só então, depois de meses acumulando histórico
real, backtestar essas 3 hipóteses contra dado de verdade. Não implementado
nesta sessão — é decisão de escopo nova, não parte do pedido original.

## Conclusão desta rodada da Etapa 0

**0 de 5 hipóteses validadas.** Mesmo padrão de honestidade das buscas
anteriores (Order Block Fade 2026-08-24, TA clássico 2026-07-30): o NIM
Signal Discovery Agent acelera a geração de hipóteses testáveis, mas não
substitui a validação estatística real — e nenhuma das hipóteses desta
rodada sobreviveu a ela. Consistente com a decisão de produto já registrada
(CLAUDE.md, "Cérebro de decisão da IA"): sem edge comprovado, EV por trade
continua ≈ −custo.

## Próximo passo, se o Cleber quiser continuar o Trilho 2

Sem mais dado grátis novo pra explorar nesta linha (correlação cross-asset
real só existe para pares genuinamente distintos, ex: XAGUSD/XAUUSD, já
testado). Opções, nenhuma decidida ainda:
1. Arquivar `/economic-calendar` diariamente pra construir histórico
   próprio (grátis, mas leva meses pra virar amostra útil) — desbloqueia as
   3 hipóteses de NLP no futuro.
2. Aceitar orçamento de newsfeed pago (decisão já tomada como NÃO por
   enquanto).
3. Encerrar esta rodada do Trilho 2 e focar no item 0 do CLAUDE.md
   (redesenho do cérebro de decisão) ou no cuOpt Fase A (item 4/5 do
   handoff), que não depende de mais dado de mercado novo.
