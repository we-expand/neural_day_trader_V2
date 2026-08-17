# Handoff — próxima sessão

> Reescrito em **2026-08-16** (fim do dia, 11ª parte — reescrita completa,
> não empilhada). **Regra: este arquivo é handoff da sessão CORRENTE.
> Reescreva, não empilhe.**

## ▶ COMECE AQUI — o que precisa acontecer, em ordem

1. **Esperar `task_55c7c76b` terminar** (rodando em sessão separada agora).
   Investiga se o modo de sizing `FIXED` no motor ao vivo
   (`runTradingCycle.ts`) ignora a distância do stop — mesma classe de bug
   já corrigida no Backtest em 07-30, nunca confirmada/corrigida no motor
   ao vivo. Ver seção "Task em andamento" abaixo antes de mexer nisso de
   novo.
2. **Recalcular `expectedTradesPerDayRange`/`expectedNetPercentPerTradeRange`
   em `src/app/data/riskProfiles.ts`.** A correção do piso de $10 (commit
   `d0d28406a`) mudou o comportamento: trades pequenos agora são PULADOS em
   vez de inflados. Os números atuais no painel vêm de `taxa_base.json`
   (2026-08-05), medido ANTES dessa correção — a frequência real numa conta
   pequena pode ficar mais baixa que o mostrado. Não é urgente (painel não
   promete nada, mostra faixa histórica com aviso), mas fica desatualizado
   até recalcular.
3. **Decisão do Cleber ainda pendente**: nenhuma. As decisões desta sessão
   (teto de 2-6 trades/dia, perfis de risco do painel, correção do piso)
   já foram tomadas e implementadas. O que resta é technical debt (itens 1
   e 2 acima), não decisão de produto.

## O que foi decidido e fechado nesta sessão (não reabrir sem dado novo)

- **Meta de ~10 trades/dia REJEITADA.** Testada por 4 ângulos — TA clássico
  (julho), score contínuo (pesos iguais e não-uniformes), arbitragem
  estatística (config única e sensibilidade+DSR), amplitude pura
  (multi-setup hipotético) — todos negativos ou insuficientes. Teto real
  medido: **2-6 trades/dia**, dependendo do perfil de risco. Detalhe:
  `research/experiments/2026-08-16-portfolio-amplitude/results/README.md`.
- **Score contínuo (substituindo o gate binário) não vai pra produção.**
  Piora resultado líquido em todo piso testado, com pesos iguais OU
  não-uniformes (validado treino/teste, sem generalizar). Só resta a
  alternativa "score como desempate entre setups concorrentes" — não
  implementável hoje porque o motor não roda múltiplos setups
  simultâneos (escopo grande, não é medição rápida).
- **Arbitragem estatística fechada.** DSR com 18 configs × 6 pares × 2 tf:
  nenhum par passa perto do piso de 95%. Só reabriria com dado
  genuinamente novo (instrumentos do mesmo mercado, hoje fora do MetaAPI).

## O que foi construído/corrigido nesta sessão

- **Painel redesenhado** (`AITrader.tsx`, modo ENGINEER): toggle
  Simples/Avançado. Modo Simples (novo padrão) — 3 "Perfis de Risco"
  (`src/app/data/riskProfiles.ts`: Conservador/Moderado/Agressivo)
  mapeados pra combos preset+cesta+timeframe já validados como positivos
  em 1h, com atividade esperada em trades/dia e %/trade (faixa medida, não
  promessa, sem valor em $). Modo Avançado preserva 100% do controle
  manual anterior. Verificado no browser, sem erros de render.
- **Bug de risco corrigido em 2 motores** (commit `d0d28406a`): o piso de
  $10 de capital mínimo por trade (`TradeSizing.ts`, e cópia duplicada em
  `runTradingCycle.ts`) **inflava silenciosamente o risco efetivo** quando
  o nocional calculado ficava abaixo de $10 — medido em 24% dos sinais no
  perfil Conservador (conta de $50, risco 0,5%/trade). Corrigido pra
  **pular o trade** em vez de inflar. Motor ao vivo ganhou veto novo
  (`vetoStage: 'MIN_TRADE_SIZE'`), logado e persistido como os outros
  gates. 3 testes de regressão novos no gate (`__validate__.ts`).
  Contraponto documentado a um commit anterior (`40484f6fa`, sessão
  separada) que tinha fechado essa investigação como "não é problema
  real" sem script/dado verificável — ver
  `research/experiments/2026-08-16-portfolio-amplitude/results/floor_check_by_profile.md`.

## Task em andamento (não iniciada por esta sessão, rodando em paralelo)

`task_55c7c76b` — "Investigar sizing FIXED não considerar distância do
stop no motor ao vivo". Pergunta: `runTradingCycle.ts` linha ~882, modo
`positionSizingMode === 'FIXED'` (o default), calcula
`tradeCapital = allocatedCapital × risco% × multiplicador` sem dividir
pela distância do stop — só o modo `ATR` faz isso corretamente. Pode ser a
mesma lacuna do bug corrigido em `TradeSizing.ts` em 07-30 (só aplicado ao
Backtest), ou pode ser intencional. **Quando a notificação chegar, ler o
resultado antes de assumir que precisa de correção** — a sessão anterior
(`40484f6fa`) já mostrou que uma conclusão de task espelhada nem sempre
vem com evidência sólida; conferir o commit/diff produzido antes de
confiar cegamente.

## Estado herdado, sem mudança nesta sessão

- Sessão de calibração do runner `41378b46-2a7d-4155-bde0-b3b099df6c1a`
  (preset 5, 1m, cooldown 5min) continua RUNNING — decisão do Cleber foi
  deixar como está.
- `ai-runner` (Supabase Edge Function) deployado, `pg_cron` ativo
  (`jobid=3`, `ai-runner-tick`, `* * * * *`). Rodando sozinho contra o
  banco real desde 07-08.
