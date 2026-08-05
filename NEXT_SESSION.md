# Handoff — próxima sessão

> Reescrito em **2026-08-05 (manhã)**. Versão anterior (2026-08-04, 2ª janela)
> está no git. **Regra: este arquivo é handoff da sessão CORRENTE. Reescreva,
> não empilhe.**

## Estado em uma frase

A IA ficou "ligada" 14h20 e avaliou o mercado ~6 vezes durante a noite inteira —
**a aba foi suspensa pelo navegador, não é veto de gate**. Cleber decidiu que
runner 24/7 no servidor é requisito de produto. Próximo passo concreto: **medir
a taxa base** — não iniciado.

## Leitura obrigatória

1. **`SESSAO_2026-08-05_RUNNER_24_7_E_TAXA_BASE.md`** — documento principal
   desta linha de trabalho: o dado, o achado de arquitetura, as duas decisões.
2. `SESSAO_2026-08-04_FASE1_LEITURA_FUNIL.md` — a primeira leitura do funil.

Só se precisar do detalhe: `SESSAO_2026-08-04_FASE1_COSTURA_RUNNER.md`,
`SESSAO_2026-08-04_FASE0_TELEMETRIA_FUNIL.md`, `research/AI_BRAIN_SPEC.md`
(seções 14.5 e **14.7** — não citar número da seção 14 sem ler 14.7).

## Comece por aqui

**Medir a taxa base dos presets sobre histórico real.** Não depende de deploy,
de aba aberta nem da IA ligada (ela está desligada de propósito).

Saída pretendida: tabela **entradas/dia × pontos médios por trade × resultado
líquido** por configuração — 5 presets × 9 ativos × timeframes, custo real
descontado (`research/CostModel.ts`).

É a resposta ao critério do Cleber: `frequência × pontos − custo`. Nenhum dos
três está medido hoje.

**Ressalva não negociável:** isto mede viabilidade operacional, **não prova
edge**. A investigação de julho fechou que edge de sinal técnico não foi
encontrado, e nada aqui reverte isso.

## Depois disso, em ordem

2. **Extrair o ciclo de trading** de dentro do `useEffect`
   ([useApexLogic.ts:1260-2370](src/app/hooks/useApexLogic.ts:1260), ~1.100
   linhas) pra um módulo puro `runTradingCycle(estado, deps) → { decisões,
   efeitos }`. Sem React, sem `setState`, devolve efeitos em vez de aplicá-los.
   Hoje lê do fecho: `activeOrders`, `aiConfig`, `lastTradeTimestampRef`,
   `cachedNewsEventsRef`, `cachedVIXRef`.
   Rede de proteção: `npm run validate` **+** equivalência de `stage_counts`
   antes/depois (a telemetria de funil é o teste de não-regressão).
3. **Runner Deno** sobre o ciclo extraído: lê `ai_sessions` RUNNING, monta
   estado do banco, chama a mesma função, grava `ai_trades` e
   `ai_funnel_snapshots`. Opera de verdade em DEMO (abre, gere stop/take/
   trailing, fecha). Cron **sem trava de dia útil** (cripto opera fim de
   semana), gate de mercado aberto **por símbolo**, lock por sessão.
4. **Fase 2 — o `k(t)`**, inalterada. Dataset M1 e motor numba já existem em
   `research/experiments/2026-07-30-sma-pullback-crossasset/scripts/`.

## O que ficou decidido (não reabrir sem motivo novo)

- **Runner 24/7 operando de verdade em DEMO é requisito de produto**, não
  otimização. Usuário liga e vai dormir; a IA não pode se desligar sozinha.
  Execução em conta REAL fica fora desta entrega.
- **Um motor, dois drivers.** O runner importa o motor do browser, nunca copia.
  Cópia garantiria divergência entre o que se testa e o que opera.
- **Nenhum gate/limiar foi afrouxado, e não será antes da taxa base.**
- **Calibração ajusta a QUANTIDADE de trades, nunca o SINAL da expectativa.**
- **Fase 2 = medir a curva `k(t)`**, com orçamento e critério de corte já
  fixados (tabela no doc da Fase 0).
- **A IA está desligada de propósito.** Deixar ligada não responde a pergunta de
  taxa base — histórico responde melhor, com muito mais amostra e sem babá.

## Armadilhas conhecidas, ainda não corrigidas

**Candles simulados com HTTP 200.** `/mt5-candles` devolve dado sintético quando
o token MetaAPI é inválido
([server/index.ts:4438](supabase/functions/server/index.ts:4438)). No browser o
`isRealData` barra. **O runner do servidor precisa rejeitar `source:
'SIMULATED'` explicitamente** — senão decide trade sobre dado fabricado,
violando a convenção nº1 do projeto. Requisito não negociável do passo 3.

**Faixa morta do `detectRegime`** (`MarketScoreEngine.ts:437`): ADX 18–25 vira
`INDEFINIDO`, que não satisfaz nem TREND nem RANGE. Com o default
`marketMode: 'TREND'`, é veto permanente. Introduzida em `6e319e485`.
**Não é o veto observado no funil** (esse é o filtro ADX>20 da própria
estratégia, num estágio anterior) — não confundir os dois.

**Desperdício de amostragem:** ativo sem dado real continua consumindo um dos 3
slots de avaliação por tick (`ASSETS_PER_TICK`,
[useApexLogic.ts:1383](src/app/hooks/useApexLogic.ts:1383)).

## Correções de estado pendentes (aplicar, não só ler)

- `CLAUDE.md` (pendência 0) **ainda diz que a Fatia 1 está "não commitada" — é
  falso.** Commitada na branch `dev`: `81c1237da`, `52f0f6ea0`. Corrigir.
- `CLAUDE.md` ainda aponta `SESSAO_2026-08-04_FASE1_COSTURA_RUNNER.md` como
  leitura mais recente. Passou a ser
  `SESSAO_2026-08-05_RUNNER_24_7_E_TAXA_BASE.md`.

## Anotado, não priorizado

- `CANDLES_FETCH_FAILED` apareceu no funil (2,8% das avaliações) — estágio novo,
  não existia no funil de ontem. Volume baixo, não investigado.

## Pendência lateral, sem relação com o cérebro

Sobraram na árvore mudanças não commitadas de OUTRA sessão:
`AIToolsControl.tsx`, `ATRTrailingStopManager.tsx`, `PyramidingConfigPanel.tsx`
e `SESSAO_2026-08-04_ATR_PYRAMIDING_E_AUDITORIA_CONFIG.md`. Cleber decide.

## Workflow (regra fixa do projeto)

Claude **nunca** roda `git commit`/`push` nem aplica migration. Sempre entrega
código pronto + comandos prontos pro Cleber rodar.
