# Sessão 2026-09-11 (noite) — Checagem: IA bloqueada por saldo? + "Risco Alto" persistindo

## Pedido do Cleber
"Certifique-se que a inteligência artificial continua operando e que ela não
está bloqueada, por causa de saldo, nada disso." Em seguida reportou que o
Dashboard ainda mostrava "RISCO ALTO" mesmo após o fix de exibição de sessão
anterior no mesmo dia. Depois: "Só se certifica que não tem nenhum bloqueio
de Drawdown." Decisão final: "deixe a AI operar" — nenhuma mudança de código
ou config foi feita nesta sessão, só investigação/checagem.

## Achado 1 — Motor rodando, sem bloqueio
Confirmado ao vivo:
- Processo do `llm-active-brain` ativo (PID 47261 no momento da checagem).
- `MT5_LIVE_EXECUTION_ENABLED=true`.
- Circuit breaker (`circuitBreakerTripped`, estado em memória do processo)
  **não estava acionado** — prova real: o log mostrou o motor abrindo
  posições reais nos minutos anteriores (BTCUSD e BNBUSD LONG, ~01:15-01:28
  UTC do dia seguinte).

## Achado 2 — "Risco Alto" não é bug, é drawdown real (e piorou)
Checado direto na corretora via `getLiveAccountInfo`/`getLivePositions`
(`llm-active-brain/src/liveExecution.ts`), userId
`aeb3ec15-f660-4775-856b-2a04b20f4592`:
- Saldo real: **$17,73**. Equity real: **$14,21**.
- `allocatedCapital` configurado (Setup, `ai_user_config.config->>'allocatedCapital'`): **$54,03**.
- Drawdown real contra o capital alocado: **~74%** — muito acima do teto de
  35% que classifica "RISCO ALTO" no card `MarketScoreBoard.tsx`. O card
  está calculando certo (fix da sessão anterior, mesmo dia, já rodando);
  o problema é a perda real em si, que piorou desde a checagem anterior do
  mesmo dia (que era ~$27-28 recuperando).

## Achado 3 — Bug real, não corrigido: 2 posições REAIS opostas em BTCUSD simultâneas
Via `getLivePositions` + `ai_trades`: a IA abriu LONG 0,03 lote (entry
77.342,2, `broker_position_id=1214147684`, 01:16 UTC) e SHORT 0,03 lote
(entry 77.254,36, `broker_position_id=1214147777`, 01:28 UTC) no MESMO
símbolo, ambas reais na corretora (confirmadas ao vivo, não fabricado).
Exposição líquida trava perto de zero, mas paga spread/comissão em dobro à
toa. É a mesma classe de bug de "posição oposta simultânea" já catalogada
e supostamente bloqueada em sessões anteriores — o guard não pegou este
caso em modo LIVE. **Não investigado a fundo nem corrigido nesta sessão**
(Cleber não pediu, só registrado).

## Achado 4 — Gate de drawdown flutuante (diferente do card do Dashboard) perto de disparar
`open_position` (`llm-active-brain/src/tools.ts:2034-2044`) tem um circuit
breaker próprio: a cada tentativa de abrir posição nova, compara saldo atual
vs equity atual da conta real — teto de `MT5_LIVE_ABSOLUTE_LOSS_LIMIT_PCT`
(`.env`, valor 10%) do saldo. Com saldo $17,73, o teto é **$1,77** de perda
flutuante permitida; a perda flutuante real no momento da checagem era
**$3,52** (saldo − equity) — já acima do teto.
- **Breaker ainda não tinha disparado** (só é checado dentro de
  `open_position`, não roda em background) — mas a PRÓXIMA tentativa de
  abrir qualquer posição nova tinha chance real de acionar
  `tripLiveCircuitBreaker` e bloquear toda entrada nova até restart (mesmo
  padrão do incidente já documentado no `CLAUDE.md` de mais cedo no mesmo
  dia — circuit breaker travado por posição/saldo).
- Posições já abertas não seriam afetadas, só abertura de posição nova.
- **Decisão do Cleber**: não mexer no parâmetro, deixar a IA operar como
  está. Nenhuma mudança de `.env`/código feita.

## Estado ao fim da sessão
Nenhum código/config alterado. IA seguiu operando. Pendências reais, sem
ação tomada (aguardando decisão futura do Cleber se quiser mexer):
- Se o circuit breaker de 10% disparar sozinho numa próxima tentativa de
  entrada, vai bloquear toda abertura nova até `./restart.sh` — Cleber está
  ciente e decidiu não mudar o teto por enquanto.
- Bug das 2 posições opostas reais em BTCUSD (Achado 3) segue sem
  investigação/fix — guard de posição oposta simultânea não cobriu o
  caminho de execução real (LIVE).
- Drawdown real da conta (~74% do capital alocado) é perda de fato, não
  bug de exibição — mesmo achado grave já registrado no `CLAUDE.md` mais
  cedo no mesmo dia, confirmado de novo aqui com número pior.
