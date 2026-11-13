# Sessão 2026-09-11 (noite) — "Boleta não bate com o MetaTrader" → ticket real não reconhecido pela plataforma

## Contexto

Cleber reportou que o resultado da boleta (Gráfico/Dashboard) não estava
batendo com o MetaTrader. Pedido inicial ambíguo ("preços são um, e no
[MT5] é outro") — investigação em 3 camadas até achar a causa real.

## Camada 1 — preço em si: OK, não era isso

Comparei ao vivo `/mt5-prices` (backend) contra as fontes reais:

- **BTCUSD**: bate exatamente com a Binance ($77.202,01 nos dois, mesmo
  timestamp) — símbolo roteado direto pra Binance desde 2026-08-31
  (decisão de produto já documentada), sem problema.
- **AVAUSD/BNBUSD/DOGUSD/LNKUSD/XETUSD** (cesta cripto atual, via
  Infinox/MetaAPI): tick fresco no momento da checagem — o travamento de
  ~1h20 do feed MetaAPI mais cedo na noite (catalogado no topo do
  CLAUDE.md) já tinha se recuperado sozinho.
- **NAS100**: tick congelado desde sexta ~21h UTC — mas é posição antiga
  fora da cesta atual e índice CFD fica sem tick real no fim de semana,
  comportamento esperado, não bug.

Conclusão desta camada: preço servido pela plataforma estava correto no
momento — não era isso que o Cleber via de errado.

## Camada 2 — a real: posição existe na Infinox mas não na plataforma

Cleber mandou print do MetaTrader (conta `87026945`,
`InfinoxLimited-MT5Live`, Hedge) mostrando 3 posições reais abertas
(BTCUSD buy 0.15, BTCUSD sell, NAS100 buy 0.04), enquanto o Dashboard só
mostrava 2 ("2/5 posições": BTCUSD e NAS100).

Investigação via SQL direto (`ai_trades`) + log do processo
(`llm-active-brain/llm-brain.log`) confirmou: existia um ticket real na
Infinox (BTCUSD SELL, aberto por volta de 23:33 UTC) que **não correspondia
a nenhuma linha em `ai_trades`** — nenhuma decisão da IA nos logs
(`ai_brain_activity_log`) abriu esse SHORT. Confirmado com o Cleber: foi
ele mesmo quem abriu essa venda direto no terminal MT5, fora da
plataforma.

**O mecanismo de segurança já existente funcionou como desenhado**: a
reconciliação ao vivo (`liveReconcileTick`, `llm-active-brain/src/index.ts`,
roda a cada 15s) detectou essa posição "estranha" e acionou o circuit
breaker sozinha — confirmado literalmente no log:

```
[liveExecution] 🔴 CIRCUIT BREAKER ACIONADO -- execucao real DESLIGADA (todos os usuarios) ate restart manual.
Motivo: Corretora tem posicoes reais [1214146969] que o motor nao reconhece (sessao 649295b1-...).
```

Isso explicava também os erros vistos na Atividade da IA
("Fechamento real falhou: Execucao real desligada...") — não era bug, era
a trava de segurança.

**Gap real, não bug de segurança**: antes desta sessão, esse cenário
(posição real que a plataforma não reconhece) só tinha uma saída — alguém
(até agora, sempre eu via SQL manual) reconhecer a posição na mão depois
do fato, com o circuit breaker travando **toda** execução real de todo
mundo nesse meio-tempo. Cleber foi explícito: "isso tem que ser
instantâneo".

## Fix aplicado — reconciliação adota a posição sozinha

`liveReconcileTick` (`index.ts`) agora, ao achar uma posição real não
reconhecida (`unexpectedOnBroker`), **grava ela na hora em `ai_trades`**
via `openMt5Position` (mesmo formato já usado nos reconhecimentos manuais
de hoje: `is_live_execution=true`, `stopLoss`/`takeProfit` **null** — nunca
inventa proteção que o Cleber não escolheu, já que não foi a plataforma
quem abriu essa ordem) — só aciona o circuit breaker se a própria adoção
falhar (nesse caso sim o estado real fica desconhecido de verdade).
`quantity` calculado com a mesma fórmula usada em `open_position`
(`lots × LOT_SIZE[symbol] × preço`), não o lote cru — mantém a convenção
de "quantity = exposição em USD" usada no resto do motor.

`OpenMt5PositionParams.stopLoss`/`takeProfit` (`neuralBridge.ts`) passaram
a aceitar `null` pra isso — `enforceMt5StopsAndTargets` já pulava
`stop_loss == null` antes desta mudança, nenhum efeito colateral.

`tsc --noEmit` limpo, `npm run validate` 37/37.

## Confirmado ao vivo

Reiniciei o motor (`./restart.sh`, autorizado pelo Cleber) e, no ciclo 1
seguinte, uma posição SHORT real apareceu **sozinha** em
`list_open_positions` com um `broker_position_id` novo
(`1214146986`) — sem nenhuma intervenção manual e sem o circuit breaker
disparar. Fix funcionando como esperado.

## Achado de processo (não resolvido, só registrado)

Existe outro arquivo de sessão de hoje,
[SESSAO_2026-09-11_CIRCUIT_BREAKER_TRAVADO_POSICAO_MANUAL_MT5.md](SESSAO_2026-09-11_CIRCUIT_BREAKER_TRAVADO_POSICAO_MANUAL_MT5.md),
descrevendo **o mesmo achado e o mesmo fix**, de uma sessão que rodou em
paralelo a esta (mesmo padrão de risco já catalogado várias vezes no
CLAUDE.md: duas sessões do Claude Code mexendo no mesmo working directory
ao mesmo tempo). Não causou dano desta vez (o diff final ficou correto,
confirmado por `tsc`/testes/log ao vivo), mas é sorte de timing, não
garantia — evitar rodar 2 sessões ao mesmo tempo na mesma pasta continua
valendo.

## Estado ao final da sessão

- Commit já aplicado pelo Cleber: `67e998c12` (`index.ts` +
  `neuralBridge.ts`), já no `dev`.
- Motor rodando com o fix, circuit breaker limpo, execução real
  funcionando (a posição SHORT manual do Cleber agora aparece no
  Dashboard/Gráfico como qualquer outra, sem SL/TP mecânico — ele decide
  se quer proteger essa posição manualmente).
- **Pendente**: nenhuma ação de código. Observar se o cenário "ordem
  manual no MT5" se repete e se a adoção automática continua funcionando
  sem precisar de restart.
