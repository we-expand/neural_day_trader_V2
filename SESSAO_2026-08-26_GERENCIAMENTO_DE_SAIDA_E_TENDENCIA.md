# Sessão 2026-08-26/27: por que a IA perdeu, gerenciamento de saída, tendência

> **Status 2026-08-27**: os 3 fixes abaixo já foram commitados/pushados e
> deployados por Cleber (`supabase functions deploy ai-runner
> --no-verify-jwt`), confirmado rodando em produção (texto novo do gate já
> aparece em `ai_decisions`):
> 1. `BREAKEVEN_TRIGGER_R` 1,5R → 1R (`TradeFrictionControls.ts`).
> 2. Gate `MACD_MOMENTUM_FADING` corrigido — só veta em reversão real de
>    tendência (histograma cruzou pro lado errado do zero), não mais em
>    desaceleração de 1 tick (`runTradingCycle.ts`).
> 3. Janela cega do cron reduzida de ~15s pra ~5s por minuto
>    (`MAX_RUNTIME_MS` 45s→55s em `ai-runner/index.ts`).
>
> Auditoria do lote de teste em `ai_trades` também aplicada (migration
> `20260827_label_test_data_ai_trades.sql`). **Próximo passo agora é só
> observação**: deixar o motor rodar com os 3 fixes + acumular ~50 trades
> novos antes de reavaliar (ver "Sessão 2026-08-27" abaixo pro detalhe
> completo de cada achado). Scripts reprodutíveis em
> `research/experiments/2026-08-26-dynamic-exit-tp-ceiling/` (hipótese,
> veredito, dado real, 6 scripts).

## Gatilho da sessão

Cleber reportou a IA ligada algumas horas, 0% de acerto, ~$5 de prejuízo, e
propôs "vestir" o motor de trader sênior (Renaissance/JP Morgan) pra
resolver. Investigação real substituiu a proposta de persona por uma série
de backtests sobre dado de produção.

## O que foi REJEITADO (não repetir sem dado novo)

1. **"Persona de trader sênior"** — não é alavanca real. Edge de fundos
   grandes vem de dado/infraestrutura proprietária, não de "sabedoria" —
   um LLM com prompt de persona não ganha acesso a nada que já não tivesse.
   Mesma conclusão da busca de edge técnico já fechada em 2026-07-30
   (`AI_BRAIN_SPEC.md`).
2. **Remover o teto de TP incondicionalmente** ("deixar correr sempre") —
   testado em 110 trades reais DINAMICO: 0 melhoraram, 3 pioraram, delta
   -$6,19. O trade manual do Cleber (+$35,54 em 3 trades) funcionou porque
   aquela hora de BTC tendia — não generaliza pra todos os regimes.
3. **TP condicional a MACD ainda acelerando no toque do alvo** — versão
   "mais esperta" da hipótese acima, também testada e rejeitada (delta
   -$1,01, 0 melhoraram).
4. **Stop-and-reverse (entrar do lado oposto quando o stop bate)** — 118
   reversões reais testadas: reversão sozinha -$9,65, ajudou em 15 casos,
   piorou em 84. Combinado com o trade original, resultado pior que o
   original sozinho (-$24,23 vs -$14,58). Rejeitado com folga — stop
   batido não é evidência de que o lado oposto tem valor esperado
   positivo.
5. **Trailing muito apertado (≤0,5×ATR)** — o resultado parecia excelente
   (+$49) mas era **artefato do método de teste** (candle de 15min não
   resolve trailing mais apertado que o próprio range do candle — medido:
   92% dos candles são maiores que essa distância). Descartado
   explicitamente, não é achado de mercado.

## O que ficou VALIDADO ou com sinal real (vale agir)

1. **Achado de processo, o mais importante**: o gate `MACD_MOMENTUM_FADING`
   (deployado nesta mesma manhã) nasceu de UM trade perdedor, sem backtest
   retroativo antes do deploy — quebra a própria disciplina do projeto
   (`AI_BRAIN_SPEC.md` §8, nunca prometer edge sem validação estatística).
   **Regra daqui pra frente**: todo gate/parâmetro de saída novo precisa
   rodar contra o histórico real (scripts já existem e são reaproveitáveis)
   antes de ir pra produção — não outra mudança "no escuro".
2. **Dado de teste contaminando `ai_trades`**: SPX500 (-$571/30d) e BTCUSD
   (-$104/30d) pareciam desastrosos, mas são majoritariamente trades
   antigos de teste (`stop_loss=0`, `exit_reason=MANUAL`, `commission=0`,
   início de agosto) misturados com trade real. Isolando só o automatizado
   real: BTCUSD ~flat (-$0,57/9 trades), XAUUSD é o melhor resultado real
   do book (+$14,27/21 trades). **Ação**: marcar/separar esse lote antes de
   confiar em qualquer comparação por ativo (script de auditoria, não
   fabricar dado — só rotular o que já existe).
3. **Breakeven dispara tarde demais — achado mais forte da sessão, e agora
   validado por completo.** 61,8% dos trades reais (76/123) chegaram a
   ficar no lucro e fecharam no zero/prejuízo (-$57,88 de impacto).
   Variando o gatilho (hoje 1,5R): 0,5R → +$9,79 bruto, 1,5R atual →
   -$2,68, sinal monotônico limpo. Testei a ressalva pendente (custo de
   reentrada, motivo do 1R→1,5R em 2026-08-25) **medindo de verdade** em
   produção: reabertura em 30min custa 9,4pp mais chance depois de um
   fechamento perto de zero (57,8% vs. 48,4%), ~$0,0114 por reentrada —
   custo extra de só ~$0,70 em qualquer nível testado, não anula a
   melhora de ~$12 entre 1,5R e 0,5R. **Recomendação mais validada de toda
   a sessão: 1,5R está do lado pior da curva, mesmo contabilizando o
   motivo que levou a subir pra lá.**
4. **Trailing um pouco mais apertado (1,5×ATR em vez de 2×) + TP como alvo
   mínimo** — na única faixa do teste 2D livre do artefato de método, deu
   melhora real modesta (+$4,94 vs. +$3,24 baseline, ~+$1,70 em 110
   trades/9 dias). Pequeno, mas é o único resultado "deixar correr" que
   sobreviveu ao teste.
5. **O motor já tem detector de tendência real** (`MarketScoreEngine.ts`,
   ADX>25=TENDENCIA/<18=LATERAL) e a sessão de produção já está configurada
   com `marketMode: TREND` — não precisa construir do zero. Só é gravado
   por trade desde 2026-08-24 (2 dias de dado): leitura inicial favorável
   (TENDENCIA -$0,36/17 trades vs. INDEFINIDO -$1,25/14 trades) mas amostra
   pequena demais pra validar. Teste de "só deixa correr se entrou em
   TENDENCIA" ainda inconclusivo (só 6 trades qualificam).

## Pendente de investigação (não feito ainda)

- **4-5 trades reais** que bateram ≥1,5R de lucro flutuante e mesmo assim
  fecharam com perda maior que custo residual (ex: SOLUSD `4cee8a28`
  -$2,03, `3efe52b7` -$2,64, `fe0adc2e` -$1,65) — o breakeven documentado
  deveria ter protegido perto de zero e não protegeu. Merece olhar
  código/logs desses IDs específicos.

## Próximos passos, em ordem de valor

1. ~~Backtest conjunto breakeven × custo de reentrada~~ **FEITO (Adendo
   6) — validado, 1,5R está do lado pior da curva.** Pronto pra virar um
   teste controlado em produção (não deploy direto — ver proposta abaixo).
2. ~~Auditoria/rotulagem do lote de teste em `ai_trades`~~ **FEITO
   2026-08-27** — migration `20260827_label_test_data_ai_trades.sql`
   aplicada (colunas `is_test_data`/`test_data_reason`, nenhum valor
   financeiro alterado). Achado: SPX500 nunca teve trade automatizado
   real (100% do book era teste/dado quebrado, -$571 "fantasma"); dado
   real limpo por ativo — BTCUSD +$36,67/15 (inclui 1 trade manual do
   Cleber), XAUUSD +$14,33/24, SOLUSD -$13,75/90, UKOUSD -$18,68/19.
   Consultas de performance por ativo daqui pra frente devem filtrar
   `where is_test_data = false`.
3. **Investigar os 4-5 casos de breakeven que falhou** (item pendente
   acima) — pode ser bug real de execução em reversão rápida.
4. **Refazer o teste de trailing apertado em candle de 1 minuto** (resolve
   o artefato do item 4 de rejeitados, testa a parte mais agressiva da
   intuição do Cleber com método limpo).
5. **Esperar mais 1-2 semanas de dado de regime** antes de repetir o teste
   condicionado a tendência (item 5 dos validados).
6. Mudança de parâmetro em produção só depois de teste controlado (não
   troca cega), sempre com backtest retroativo antes do deploy (aplicar a
   lição do achado de processo #1 daqui pra frente, inclusive pra essas
   mudanças).

## Proposta de cadência de otimização contínua (pedido do Cleber 2026-08-26)

Cleber pediu "otimização constante" depois de um dia ruim. Resposta: a
forma certa de fazer isso é reaproveitar os 8 scripts já construídos nesta
pasta (`research/experiments/2026-08-26-dynamic-exit-tp-ceiling/scripts/`)
como uma suíte reexecutável, não inventar ajuste novo a cada sessão ruim
(foi exatamente isso — reação a 1 trade — que criou o gate de MACD sem
validação, achado de processo #1). Rodar de novo semanalmente ou a cada
~50 trades novos: reversal_diagnostic, breakeven sweep+reentry,
regime_conditional. Decisão pendente do Cleber: quer isso automatizado
(agente agendado) ou revisado manualmente a cada sessão?

## Sessão 2026-08-27: IA parada 16h, MACD virou bloqueador, slippage de execução

### Gatilho

Cleber reportou dois problemas ao vivo: (1) IA ligada várias horas sem
fazer nenhuma entrada; (2) as otimizações combinadas na sessão anterior
ainda não tinham ido pro ar. Também esclareceu a intenção original do gate
de MACD: **é pra ser suporte de tendência (não entrar contra uma reversão
real), não um bloqueador geral de entrada** — ponto que motivou o fix
abaixo.

### Achado 1: causa raiz de 16h sem trade — gate MACD bloqueando por ruído

Confirmado no banco: último trade real tinha sido `2026-08-26 21:06`, e
79% de todas as decisões nas 24h seguintes (9.216/11.711) foram vetadas
pelo `MACD_MOMENTUM_FADING` — o mesmo gate identificado no achado de
processo #1 desta sessão (deployado sem backtest). Causa exata no código
(`runTradingCycle.ts`): a condição de veto disparava com
`histograma <= 0 OU histograma < histograma_anterior` — ou seja, qualquer
desaceleração de 1 tick, mesmo com o histograma ainda fortemente a favor
do trade, contava como "momentum fraco" e exigia 70% de confiança (quase
nunca atingido). Medido: **75% dos vetos (6.963/9.253 em 24h) eram desse
tipo — ruído, não reversão real.**

**Fix aplicado**: gate agora só dispara quando o histograma já cruzou pro
lado **oposto** do zero (reversão real de tendência), removendo o
componente de desaceleração de 1 tick. Mantém a intenção original (não
operar contra uma reversão real) sem travar o motor em ruído normal de
candle a candle. `npm run validate` passou limpo. Deployado e confirmado
em produção (texto novo aparecendo em `ai_decisions.reasoning`).

### Achado 2: os 4-5 trades de "breakeven que falhou" — não é lógica, é execução

Investigação dos casos pendentes da sessão anterior (SOLUSD `fe0adc2e`,
`3efe52b7`) via `ai_trades_audit_log` (histórico real de ajuste de stop):
o breakeven/trailing **funcionou corretamente** — o stop foi puxado a
favor várias vezes seguidas — mas o trade fechou 1,3+ pontos além do
último stop registrado (`fe0adc2e`: stop em 95,01, fechou a 96,37).

Causa raiz: o stop-loss **não é uma ordem nativa na corretora** — hoje
100% do trading de IA é virtual/DEMO, o `ai-runner` nunca chama
`/broker/execute`. O SL é um cálculo síncrono (`positionManager.ts:162`)
checado a cada 1s enquanto a função está viva, mas cada invocação dura no
máximo `MAX_RUNTIME_MS` e o cron mínimo do Supabase é 1×/min — havia uma
**janela cega de ~15s por minuto** sem nenhuma checagem de preço, período
em que o mercado pode passar direto pelo nível de stop.

**Escopo levantado, duas frentes** (não confundir):
- **Fase Demo (hoje)**: único alavanque é reduzir a janela cega. Fix
  aplicado: `MAX_RUNTIME_MS` 45s→55s (`ai-runner/index.ts`), reduz o gap
  pra ~5s. Não subimos pra 60s cheio de propósito — não existe lock contra
  o cron disparar duas invocações em paralelo, e um empate no minuto
  arriscaria posição duplicada (risco pior que o gap que estamos
  fechando). Limite físico que continua existindo: gap real de mercado
  dentro do próprio 1s de tick não tem como fechar por polling.
- **Fase Real (futuro, quando o usuário conecta a própria MetaAPI)**: o
  bridge de execução (`server/index.ts`) já suporta `stopLoss`/
  `takeProfit` nativos em `createMarketBuyOrder`/`SellOrder` e
  `modifyPosition` — a correção de raiz de verdade é usar isso (a
  corretora executa o stop mesmo se o `ai-runner` atrasar), mas isso é
  parte da decisão maior já registrada como pendência #7 do `CLAUDE.md`
  (autoridade cliente vs. servidor pra fechar posição) — não implementar
  isolado.

### Achado 3: auditoria do lote de teste confirmada — SPX500 nunca operou de verdade

Migration `20260827_label_test_data_ai_trades.sql` aplicada (colunas
aditivas `is_test_data`/`test_data_reason`, nenhum valor financeiro
tocado). Resultado: 16 trades do lote de início de agosto (BTCUSD+SPX500,
-$682,21) + 3 registros quebrados de 2026-07-06 (-$3.808,78, achado extra
desta auditoria — um deles fechou "SL" a um preço 1.400+ pontos além do
stop registrado) rotulados como teste/dado quebrado.

**Achado real**: SPX500 nunca teve nenhum trade automatizado de
verdade — 100% do book era teste. Dado real limpo por ativo
(`is_test_data=false`): BTCUSD +$36,67/15 (inclui 1 trade manual do
Cleber), XAUUSD +$14,33/24, ETHUSD -$6,16/77, SOLUSD -$13,75/90, UKOUSD
-$18,68/19. **Toda consulta de performance por ativo daqui pra frente
deve filtrar `where is_test_data = false`.**

### Reentrada — pergunta respondida com o que já existe no dado

Cleber perguntou sobre reentrada autônoma. Não existe implementação disso
hoje. O único teste real com dado de produção foi o "stop-and-reverse"
(Adendo 7 acima) — **rejeitado com folga** (118 reversões: -$9,65 líquido,
ajudou em 15 casos, piorou em 84). Não há achado a favor de reentrada
automática hoje; retomar a ideia exigiria projeto de pesquisa novo,
condicionado a algo (ex.: regime de tendência), não uma reativação do que
já foi testado.

### Próximo passo real desta sessão

Nenhuma mudança de código pendente. É só observação: deixar os 3 fixes
rodarem, acumular ~50 trades novos ou 1-2 dias, e então repetir a suíte de
scripts contra o dado novo pra confirmar (ou não) que os ajustes seguraram
— mesma disciplina do achado de processo #1, não decidir "no escuro" de
novo.
