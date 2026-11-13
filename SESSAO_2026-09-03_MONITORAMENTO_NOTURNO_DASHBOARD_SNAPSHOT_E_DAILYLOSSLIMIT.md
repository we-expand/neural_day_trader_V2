# Sessão 2026-09-03 — Monitoramento noturno contínuo do LLM Brain,
# bug real do Dashboard (snapshot) e achado de dimensionamento do dailyLossLimit

## Contexto

Continuação do mandato de monitoramento/responsabilidade contínua sobre o
`llm-active-brain` ([[feedback_llm_brain_ownership_otimizacao]]), depois do
handoff de
[SESSAO_2026-09-02_AGENTE_DE_RISCO_INTERNO_PYRAMIDING.md](SESSAO_2026-09-02_AGENTE_DE_RISCO_INTERNO_PYRAMIDING.md).
Monitoramento rodou de ~09:44 UTC a ~10:55 UTC de 03/09 (dezenas de
checagens de 5 em 5 min), interrompido pelo Cleber ao acordar e encontrar
o Dashboard mostrando saldo resetado em $100 sem nenhuma operação visível.

## Achado 1 (real, corrigido nesta sessão): `increase_position` (pyramiding)
já estava pronto desde a sessão anterior — confirmado que já está
commitado, pushado E com a migration aplicada

Investigação pedida pelo Cleber ("me envie os commits e migration do
pyramiding") revelou que **não havia nada pendente de fato**:

- Commit `7654d8d06` (`feat(llm-brain): agente de risco interno —
  pyramiding em posição vencedora com stop travado`) já está no histórico
  local **e já está em `origin/dev`** (`git log origin/dev..HEAD` vazio —
  sem divergência).
- A migration `supabase/migrations/20260902_add_pyramid_adds_to_ai_trades.sql`
  **já está aplicada de verdade** no Supabase (`wyvdsxtcmizettljxtbg`) —
  confirmado via `information_schema.columns`: a coluna
  `ai_trades.pyramid_adds_count` (integer, default 0) existe no banco ao
  vivo.
- **O único passo que realmente falta é reiniciar o processo**
  (`llm-active-brain/restart.sh`) — o processo rodando agora (PID 68621)
  subiu às 16:55 (horário local) de 02/09, **antes** do commit do
  pyramiding (19:57 local, mesmo dia), então está rodando código antigo
  sem a ferramenta `increase_position` carregada. Nenhum uso real da
  ferramenta ainda ocorreu por esse motivo.

**Ação do Cleber**: rodar
```bash
cd /Users/clebercouto/Projects/we-expand/Neural-Day-Trader/llm-active-brain && ./restart.sh
```
Depois do restart, observar de perto o primeiro uso real do
`increase_position` (nenhum teste automatizado cobre isso ainda, só
`tsc --noEmit`/leitura de código da sessão anterior).

## Achado 2 (real, CORRIGIDO nesta sessão — 3 bugs em cadeia): Dashboard
mostrando saldo resetado em $100 e "sem operações" pela manhã, mesmo com a
aba aberta a noite toda

Cleber reportou alarmado: acordou, painel mostrando $100 (valor inicial)
como se nenhuma operação tivesse acontecido, e as operações de ontem
"apagadas". **Confirmado via SQL direto que nada foi perdido**: a mesma
sessão (`1d73c50a-cc28-4ab2-a939-a59361a22fda`, criada 01/09) segue
`RUNNING`, com os 23 trades intactos, o último fechado 00:02 UTC de 03/09
— nenhuma sessão nova foi criada, nenhum dado apagado. Saldo real: $103,21
(23 trades, +$3,21 líquido, 69,6% de acerto).

**Hipótese inicial (errada), refutada pelo próprio Cleber**: "a aba não
ficou aberta a noite toda, por isso não gravou snapshot". Cleber confirmou
que a aba **ficou aberta a noite inteira** — obrigou a investigar a causa
raiz de verdade em vez de aceitar a explicação superficial.

**Causa raiz real, 3 bugs em cadeia, todos em `src/app/hooks/useApexLogic.ts`**:

1. **`ai_portfolio_snapshots` não recebe nenhuma linha nova desde
   2026-08-31 20:59 UTC** (confirmado via SQL: `max(created_at)` da tabela
   inteira) — o único escritor histórico dessa tabela em DEMO era o cliente
   (`useApexLogic.ts`, removido deliberadamente em 2026-08-18 a favor do
   `ai-runner`) e o `ai-runner` foi desligado definitivamente em 08-31. O
   poll contínuo `reconcile()` (roda a cada 30s, com ou sem reload, `POLL_MS`)
   só lia essa tabela morta e silenciosamente nunca atualizava balance de
   novo — não importa quanto tempo a aba ficasse aberta. Fix: quando
   `getEquityCurve` devolve vazio, recalcula direto de `ai_trades`
   (`initial_balance` + soma de `net_pnl` fechado) a cada poll, mesma lógica
   já usada no recálculo de mount (commit anterior `cb7261ed3`).
2. **O fix acima tinha o mesmo bug clássico já catalogado no projeto**
   (mascarar erro de rede como "sem dado"): `getSessionRealizedPnl` engolia
   erro do Supabase internamente e devolvia `0` — uma falha transitória
   virava "PnL realizado é zero", sobrescrevendo o saldo real por
   "$100 + $0" até o próximo poll ter sucesso. Sintoma visível: saldo
   "alternando" entre $100 e $103 a cada ~30s. Fix: consulta direta ao
   Supabase (sem o wrapper que mascara erro), erro propaga pro `catch` que
   já existe e preserva o saldo anterior.
3. **O mais sutil, achado só depois de ler o console do navegador**: mesmo
   com os dois fixes acima corretos — o log confirmava
   `💰 Saldo real recalculado de ai_trades: $103.21` —, o Dashboard
   continuava mostrando $100. Causa: um bloco de fallback **legado** (`if
   (!lastSnapshot && session.initial_balance) { setPortfolio(...) }`,
   pré-existente, não relacionado a esta sessão) rodava logo ABAIXO do
   recálculo correto, dentro do mesmo efeito de mount, e sobrescrevia
   balance/equity de volta pro `initial_balance` cru sempre que
   `!lastSnapshot` — que é sempre verdade para esta sessão (zero snapshots
   desde 08-31). O recálculo certo escrevia $103,21 e, dois passos depois,
   o bloco antigo apagava isso silenciosamente, sem log nenhum. Fix:
   removido — o bloco novo já cobre esse caso e preserva o estado anterior
   em erro real.

**Metodologia que funcionou**: pedir o console do navegador (F12 → Console)
em vez de continuar deduzindo às cegas — o log `💰 Saldo real recalculado`
provou que os 2 primeiros fixes estavam corretos e isolou o 3º bug (só
visível lendo a ordem real de execução do código, não pelo comportamento
externo). Sem o console, a suspeita natural seria "meu fix está errado",
quando na verdade o fix estava certo e outra coisa o desfazia depois.

Commits: `dc2dae7eb` (recalcula de `ai_trades` quando snapshot está morto),
`69be89baf` (para de mascarar erro de rede como PnL zero), `274cded07`
(remove fallback legado que sobrescrevia o recálculo). Confirmado ao vivo
pelo Cleber: **funcionou**, saldo estável em $103,21.

## Achado 3 (real, medido — não é bug, é decisão de risco pra reavaliar):
um único trade perdedor pode esgotar o orçamento de risco do dia inteiro

Investigado por que a IA não abriu nenhuma posição durante toda a
madrugada apesar de identificar setups com boa confluência técnica
repetidas vezes. Achado exato: um trade **XETUSD SHORT fechou em stop-loss
de -$5,62** às **00:02 UTC** de 03/09 — ou seja, no primeiro minuto do dia
contábil novo (o `dailyLossLimit` reseta à meia-noite UTC,
`getTodayRealizedPnl` em `neuralBridge.ts`). Como `riskPerTradePct` e
`dailyLossLimitPct` estão configurados no **mesmo valor (5%)**, essa única
perda sozinha (5,44% real, ligeiramente acima do stop teórico por spread/
slippage) já **consumiu inteiramente o teto diário**, bloqueando toda nova
entrada pelo resto do dia inteiro (até 04/09 00:00 UTC).

O guardrail funcionou exatamente como projetado — não é bug. Mas é um
achado real de dimensionamento que vale decisão do Cleber: **com risco por
trade igual ao teto diário, um único trade ruim no início do dia zera a
operação do dia inteiro**, mesmo que setups bons apareçam depois. Duas
saídas possíveis (nenhuma aplicada, aguardando decisão):
(a) separar os dois parâmetros (ex: `riskPerTradePct` 2-3% vs
`dailyLossLimitPct` 5%, permitindo 2-3 tentativas por dia antes do
bloqueio), ou (b) manter como está, aceitando que a IA pode "gastar" o dia
inteiro num único trade ruim como proteção extrema.

## Achado 4 (contexto, não é bug): máquina lenta

Medido ao vivo: `llama-server` (Ollama local, processo único `-np 1`)
consumindo 80-110% de CPU **continuamente** por várias horas seguidas
(600+ minutos de CPU acumulado), processando ciclo atrás de ciclo sem
pausa real. Load average da máquina em ~8,6 numa máquina de 12 cores
(~72% de utilização média). Consistente com a sensação de lentidão
reportada — carga real e sustentada, não travamento.

## Monitoramento noturno (dezenas de checagens, ~09:44-10:55 UTC de 03/09)

- Processo único confirmado em todas as checagens (PID 68621, sem
  duplicata).
- `dailyLossLimit` bloqueou corretamente **todas** as tentativas de
  `open_position` da madrugada inteira (dezenas de tentativas, vários
  ativos, várias convicções) — zero exceções, guardrail robusto.
- Timeouts esporádicos ("Request timed out") continuaram no padrão
  histórico (~14-15% dos ciclos), incluindo um cluster de 5 seguidos que
  não indicou travamento real (CPU do `llama-server` confirmado ativo em
  cada checagem) — consistente com a carga geral da máquina (achado 4).
- Recorrência do padrão já catalogado de erro de leitura de percentual/
  decimal no reasoning do modelo (ex: GER40 `trend.changePct: -0.216`
  lido como "-21,6% na hora!", diferença de preço de ~0,08% lida como
  "8,1% abaixo") — múltiplas ocorrências, sem fix de código possível
  (limitação do modelo, não do pipeline de dados — valor real confirmado
  correto na cotação bruta), sempre sem impacto real porque o
  `dailyLossLimit` bloqueava a execução de qualquer forma.
- PnL da sessão **inalterado a noite inteira**: 23 trades, 16 vitórias
  (69,6%), +$3,21 líquido — consistente com zero trades novos fechados
  (só o já contabilizado de 02/09, ver achado 3).

## Pendências reais pra próxima sessão

1. **Rodar `./restart.sh` no `llm-active-brain`** pra ativar o
   `increase_position` (pyramiding) — código e migration já prontos, só
   falta isso. Depois do restart, observar de perto o primeiro uso real.
2. ~~Fix do bug de snapshot do Dashboard~~ — **corrigido e confirmado ao
   vivo nesta sessão** (achado 2, 3 commits, ver acima).
3. **Decisão do Cleber sobre `riskPerTradePct` vs `dailyLossLimitPct`**
   (achado 3) — hoje ambos em 5%, permitindo que 1 trade ruim zere o dia.
   Se decidir separar os valores, é mudança de config no Setup (Supabase),
   não de código.
4. Seguem as pendências já catalogadas de sessões anteriores não tocadas
   agora: `dailyLossLimit` revertendo sozinho por autosave de `aiConfig`
   em `useApexLogic.ts`; validação estatística de `increase_position`
   ainda pendente de amostra real.

Monitoramento **desarmado a pedido do Cleber** ao final desta sessão.
