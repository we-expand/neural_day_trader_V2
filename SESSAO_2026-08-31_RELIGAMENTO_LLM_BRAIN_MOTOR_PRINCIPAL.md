# 2026-08-31 — Religamento do Cérebro LLM Ativo como motor principal (Fase 1: só Dashboard)

## Decisão do Cleber

O Cérebro LLM Ativo (`llm-active-brain/`) deixa de ser um experimento isolado
e passa a ser **o motor de IA principal e único do produto** — o motor
mecânico anterior (`ai-runner`) fica descontinuado. Autonomia total dada pro
Claude conduzir a migração.

## O que foi feito nesta sessão (Fase 1 — só Dashboard, sem mudança de arquitetura)

Dado o tamanho real da migração completa (ver seção abaixo), foi combinado
com o Cleber fatiar em fases. Fase 1 = só o visual do Dashboard:

- `src/app/components/dashboard/LlmActiveBrainPanel.tsx`: removido o texto
  "(teste, cesta do motor) — isolado do motor mecânico" do título visível
  (linha ~220) e reescrito o JSDoc do topo do arquivo pra refletir que este
  é agora o painel do motor principal, mantendo as notas técnicas
  históricas (poll próprio, causa do bug de "JPEG parado", etc.) que ainda
  são verdade e úteis pra quem mexer no arquivo depois.
- Nenhuma mudança estrutural no `Dashboard.tsx` — o painel já estava
  posicionado como a segunda seção da página (logo após `MarketScoreBoard`,
  antes dos widgets pesados), então já tinha destaque; não havia uma
  "seção do motor mecânico" para remover desta página (os controles do
  motor mecânico vivem numa página separada, `AITrader.tsx`).
- `npx tsc --noEmit` limpo no arquivo tocado.

**Isto é só rótulo/UX.** Nenhum comportamento de execução mudou — o
`llm-active-brain` continua tecnicamente do jeito que estava (ver abaixo).

## O que NÃO foi feito (arquitetura real — pendência da migração completa)

Levantamento feito via 3 agentes de exploração em paralelo (motor mecânico,
llm-active-brain, Dashboard) antes de tocar em qualquer código. Achados que
definem o tamanho real do trabalho que falta:

### Motor mecânico (`ai-runner`, Supabase Edge Function) — estado real
- É **DEMO-only no servidor**: só processa `ai_sessions` com
  `status='RUNNING' AND mode='DEMO'`. LIVE hoje só roda **no navegador do
  usuário** (`useApexLogic.ts`) — sem servidor, fechar a aba para o LIVE.
- **Não encontrei `cron.schedule` de fato aplicado** nas migrations do
  repo — só um exemplo comentado (`ai-runner/index.ts:895-913`). CLAUDE.md
  assume que existe cron rodando 1x/min; **confirmar direto no Supabase**
  antes de decidir como desligar isso.
- Contrato reaproveitável: gestão de posição (TP/SL/trailing/pyramiding,
  `positionManagerTick`) e persistência (`ai_trades`/`ai_portfolio_snapshots`)
  já são desacopladas da decisão de entrada — só a peça de decisão
  (`runTradingCycle`) precisaria ser trocada, se algum dia quiséssemos
  reaproveitar esse esqueleto em vez de portar tudo pro llm-active-brain.

### `llm-active-brain/` — o que falta pra virar motor de produção
- É um **processo Node único**, iniciado manualmente (`npm start`/`nohup`)
  na máquina do Cleber — **não é um serviço do backend**, não tem deploy,
  não tem cron.
- **Trava de instância única por PID** (`llm-brain.pid`) — impede rodar
  mais de um processo ao mesmo tempo. Bloqueador direto pra multi-tenant
  (1 processo por usuário) ou precisa virar 1 processo multiplexando N
  sessões.
- **Single-tenant hardcoded**: 1 `NEURAL_USER_ID` fixo em env, 1 sessão
  memorizada por execução do processo (`neuralBridge.ts`). Sessão é criada
  de propósito com `status: "PAUSED"` só pra não colidir com a busca de
  sessão ativa do motor mecânico — workaround, não roteamento de verdade.
- **LIVE não existe**: `ai_sessions.mode` é hardcoded `"DEMO"` em todo
  lugar. Zero lógica de credencial de corretora por usuário, zero conexão
  MetaAPI real por conta — hoje ele fala com o MESMO endpoint
  `/mt5-prices` que o app usa (bom: já é a fonte de preço compartilhada;
  ruim: não tem noção de "conta do usuário X").
- **Guardrails que faltam vs. o motor mecânico**: gate de notícias/VIX,
  Safe Mode, Jarvis (segundo cérebro de auditoria), scorecard de ativos.
  Os que já existem no llm-active-brain (teto de 1 posição/símbolo, teto
  de exposição por grupo correlacionado, cooldown de perda em sequência,
  validador de contradição semântica, stop/trailing mecânico) são
  reaproveitáveis, mas hoje operam sobre o singleton de sessão — pra
  multi-tenant, cada guardrail precisa receber `sessionId`/`userId` em vez
  de depender da promise memorizada em módulo.

### Ordem real de trabalho pra migração completa (não iniciada)
1. Confirmar se o cron do `ai-runner` de fato existe em produção (ou se é
   suposição desatualizada do CLAUDE.md) — decide como "desligar" o motor
   antigo com segurança.
2. Tirar a trava de instância única do `llm-active-brain` e fazer o loop
   varrer todas as `ai_sessions` `RUNNING` (padrão que o `ai-runner` já usa),
   threadando `session_id`/`user_id` por todos os guardrails.
3. Implementar LIVE do zero: credencial de corretora por usuário
   (MetaAPI), sem isso nenhuma conta real pode migrar.
4. Portar ou aceitar a ausência dos gates que faltam (notícias/VIX, Safe
   Mode, Jarvis) — decisão de risco, não só engenharia.
5. Decidir deploy: continuar processo Node manual não é sustentável pra
   "motor principal" — precisa virar serviço de verdade (Edge Function ou
   worker hospedado com cron).
6. Migração segura de posições abertas do motor antigo (mesmo padrão já
   usado antes: fechamento manual a preço real, `exit_reason` registrado,
   nunca `UPDATE` silencioso — ver convenção em CLAUDE.md).
7. Dashboard: remover/arquivar os controles do motor mecânico em
   `AITrader.tsx` só depois do novo motor estar validado ponta a ponta.

**Pendência real pro Cleber**: decidir quando puxar a próxima fase (2 ou 3
da pergunta feita nesta sessão) — cada uma delas é, sozinha, trabalho de
múltiplas sessões, não algo pra aprovar às pressas dado que envolve LIVE
(dinheiro real) eventualmente.
