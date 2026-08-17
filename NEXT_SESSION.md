# Handoff — próxima sessão

> Reescrito em **2026-08-16** (fim do dia, 10ª parte — reescrita completa,
> não empilhada). **Regra: este arquivo é handoff da sessão CORRENTE.
> Reescreva, não empilhe.**

## ▶ COMECE AQUI — piso de $10/trade CORRIGIDO em ambos os motores (backtest e ao vivo)

Achado: o commit `40484f6fa` (sessão separada, spawned) alegou "piso de
$10 não é problema real (0,2% dos trades)" mas não trouxe script/dado
verificável. Verificação própria
(`research/experiments/2026-08-16-portfolio-amplitude/results/floor_check_by_profile.md`)
mostrou que a alegação só valia pro preset Volume — pro Donchian
(perfil Conservador, risco 0,5%), **24,15% dos candles** teriam stop largo
o bastante pra acionar o piso, inflando risco muito além do configurado.

**Corrigido nesta sessão** (2 lugares, mesma lógica): `Math.max(tradeCapital,
minTradeCapital)` (empurrava nocional PRA CIMA, inflando risco
silenciosamente) virou "se nocional < $10, PULA o trade" (nunca infla):
- `TradeSizing.calculatePositionSize()` — usado pelo `BacktestEngine`.
  Assinatura mudou de `number` pra `number | null`; `BacktestEngine.ts`
  trata `null` com `continue` (pula o trade). 2 scripts de research desta
  sessão (`runScoredBacktest.ts`, `weightedScoreSensitivity.ts`) ajustados
  pro novo contrato.
- `runTradingCycle.ts` (motor AO VIVO) tinha cópia duplicada da mesma
  lógica de piso — corrigida igual, com log de veto novo
  (`vetoStage: 'MIN_TRADE_SIZE'`) seguindo o mesmo padrão dos outros gates
  (`CORRELATION_GUARD`, `COOLDOWN`, etc.) — decisão persistida, trade
  pulado, nada inflado.

3 testes de regressão novos em `__validate__.ts` (CASO 3b). `npm run
validate` e `tsc` (engine + app completo) passam, zero erro novo.
**Ainda não verificado no browser/preview ao vivo** — é lógica de sizing
sem UI diretamente visível, não bloqueante, mas considerar rodar um ciclo
de trading real/simulado se quiser confirmar visualmente antes do próximo
deploy do runner.

**Achado relacionado, NÃO corrigido, task espelhada separada**
(`task_55c7c76b`): modo de sizing `FIXED` (padrão) em `runTradingCycle.ts`
não divide pela distância do stop como `calculatePositionSize` já faz —
pode ser bug real (mesma classe do que já foi corrigido em 07-30 só no
Backtest) ou comportamento intencional, precisa investigação própria.

**Painel ainda sem valor em $** (`riskProfiles.ts`) — a correção do piso
resolve a distorção de RISCO, mas mostrar $ por trade ainda depende de
mais contexto (ex.: como o piso agora *pula* trades pequenos, a
"atividade esperada" em trades/dia dos perfis de risco/conta pequena pode
ficar mais BAIXA na prática do que a faixa medida em `taxa_base.json`,
que não tinha esse comportamento de skip). Não recalculado ainda — considerar
se vale a pena antes de reabrir a questão do valor em $.

## Estado do redesenho do cérebro — todas as frentes testadas, painel v1 no ar

Sequência completa desta sessão, todas as frentes de "mais edge pra
sustentar mais frequência" testadas e fechadas negativas: TA clássico
(julho, ver `CLAUDE.md`), score contínuo com pesos iguais e não-uniformes
(`research/experiments/2026-08-16-score-vs-gate/`), arbitragem estatística
com sensibilidade de parâmetros + DSR
(`research/experiments/2026-08-16-statistical-arbitrage/`). Amplitude pura
(somar toda a cesta sem afrouxar critério) também não sustenta 10/dia —
teto real medido é **2-6 trades/dia**
(`research/experiments/2026-08-16-portfolio-amplitude/`).

**Painel redesenhado** (`AITrader.tsx`, modo ENGINEER) em resposta a isso:
toggle Simples/Avançado. Modo Simples (novo padrão) mostra 3 "Perfis de
Risco" (`src/app/data/riskProfiles.ts`) mapeados pra combos preset+cesta+
timeframe já validados como positivos em 1h, com atividade esperada em
trades/dia e %/trade — faixas medidas, não promessa, sem valor em $ (ver
achado do piso acima, motivo de não mostrar $ ainda). Modo Avançado
preserva 100% do controle manual anterior. Verificado no browser
(preview local, sem erros de render; erros de console são só CORS/403
esperados do Supabase sem sessão). `npm run validate` e `tsc` OK (3 erros
pré-existentes não relacionados).

## Sessão de calibração do runner ainda ativa (herdado, sem mudança)

Sessão `41378b46-2a7d-4155-bde0-b3b099df6c1a` (preset 5, 1m, cooldown 5min)
continua RUNNING — decisão do Cleber foi deixar como está. Migração de
timeframe padrão não afeta sessões já em andamento.

## Runner em produção — estado herdado (2026-08-07, ainda válido)

`ai-runner` (Supabase Edge Function) deployado, `pg_cron` ativo (`jobid=3`,
`ai-runner-tick`, `* * * * *`). Rodando sozinho contra o banco real desde
07-08.
