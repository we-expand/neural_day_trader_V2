# Sessão 2026-09-11 — Tesouraria Global: comissão própria (LIVE) + caixa contábil

## Gatilho

Cleber viu a tela "Tesouraria Global" (print anexado) com "Comissões da Casa
(LIVE)" em US$ 0,00 e o aviso "Failed to fetch"/dados mock, e reclamou que a
tesouraria "não está administrando como devia" — precisa acertar o
recebimento das taxas pagas nas operações abertas.

## Investigação (antes de qualquer código)

- Card DEMO já era real (fix de sessão anterior, mesmo dia). Card LIVE
  ficava sempre US$0 de propósito — nota no código dizia "cobrança de
  comissão em execução real ainda não implementada".
- Cleber esclareceu em seguida que o pedido era sobre **spread**: "quanto
  arrecadamos de spread, onde está esse dinheiro".
- Achado crítico verificado no código: **não existe nenhum mecanismo de
  markup de spread na plataforma** — o preço mostrado/executado é o preço
  cru da Infinox (`/mt5-prices`, `/broker/execute`), sem alteração.
- Achado arquitetural mais importante, explicado ao Cleber antes de escrever
  qualquer linha: como cada usuário conecta a **própria conta MT5 na
  Infinox** via MetaAPI, a execução acontece direto no book real da
  corretora — a plataforma não é a contraparte. Isso significa que **cobrar
  "spread" de verdade (alargar o preço mostrado) exigiria a empresa ser a
  própria corretora/mesa própria (B-book), com licença regulatória** — não é
  algo que se resolve em código, e fazer isso sem licença seria operar como
  corretora não regulamentada. Risco jurídico real, não hipotético — trazido
  à mesa antes de implementar, não depois.
- Cleber confirmou o caminho legítimo: **comissão por lote/volume,
  transparente** (não spread alargado). Pediu pesquisa profunda de mercado
  por ativo antes de aplicar.

## O que foi implementado

1. **Pesquisa de mercado real** (WebSearch, não inventado): comissão ECN da
   própria Infinox confirmada em múltiplas fontes — Forex & Ouro US$7/lote
   round-turn, Petróleo (UKOUSD) US$0,70, Índices US$2. Cripto CFD: a
   Infinox não cobra comissão separada (spread-only) — usada referência de
   mercado mais amplo (~US$10 round-turn) como teto conservador, documentada
   como tal, não como fato da Infinox.
2. **`supabase/functions/server/platformCommission.ts`** (novo) — tabela de
   comissão própria por classe de ativo, convertida pra % round-trip do
   notional (cálculo explícito comentado símbolo a símbolo).
3. **`llm-active-brain/src/platformCommissionLedger.ts`** (novo) — mesma
   tabela duplicada pro runtime Node do motor (mesmo padrão de duplicação
   cross-runtime já usado no projeto pra `commissionModel.ts`).
4. **Caixa contábil real**: migration
   `supabase/migrations/20260911_platform_commission_ledger.sql` cria
   `platform_commission_ledger` — 1 lançamento por trade LIVE fechado, taxa
   travada no momento (nunca recalculada depois, mesma disciplina de
   `ai_trades_audit_log`). `neuralBridge.ts` (`closeMt5Position`) grava o
   lançamento automaticamente ao fechar qualquer trade real
   (`broker_position_id` presente), fire-and-forget (falha de log nunca
   derruba o fechamento real).
5. **`/admin/commission-summary`** (`supabase/functions/server/index.ts`)
   passou a ler do ledger real (soma/agrupa por ativo) em vez de recalcular
   na hora; mantém um fallback on-the-fly só para trades LIVE fechados
   ANTES desta migration (não reconstruídos retroativamente no ledger, pra
   não fabricar `closed_at`/taxa histórica). Devolve também série temporal
   diária (`platformCommissionCashFlow`, saldo acumulado) a partir do
   ledger de verdade.
6. **Tesouraria Global** (`FinanceModule.tsx`): card "Comissões da Casa
   (LIVE)" com número real; nova seção com gráfico de linha (saldo
   acumulado do caixa), gráfico de barras (comissão por ativo) e tabela de
   detalhe (trades, notional, comissão acumulada por símbolo).

`tsc --noEmit` sem erro novo (frontend e `llm-active-brain`), `npm run
validate` 37/37, `deno check` limpo no módulo novo.

## Limites, ditos com todas as letras (inclusive na própria tela)

- É **ACCRUED** (o que deveria ter sido cobrado sobre volume real
  confirmado), **não dinheiro já recebido** — não existe mecanismo de
  cobrança efetiva do usuário (fatura, débito em conta, gateway de
  pagamento). Combina com a pendência já catalogada em CLAUDE.md ("falta
  sistema de pagamento").
- Trades LIVE fechados antes desta migration não entram no gráfico de fluxo
  de caixa (só existe a partir de agora) — aparecem só no total agregado via
  fallback.
- Taxa de cripto é referência de mercado mais amplo, não da Infinox
  (Infinox não publica comissão separada pra cripto CFD) — marcado como tal
  no código, não apresentado como fato da corretora.
- Resto da Tesouraria (Receita YTD, Despesas, Cash Runway, Provisão Fiscal,
  contas bancárias, obrigações fiscais, fluxo de caixa geral) continua mock,
  explicitamente marcado na tela — fora do escopo desta rodada.

## Pendente

- Rodar a migration `20260911_platform_commission_ledger.sql` no SQL Editor
  do Supabase (projeto `wyvdsxtcmizettljxtbg`).
- `git commit` (2 repos: raiz e `llm-active-brain/`) + `supabase functions
  deploy server` + `./restart.sh` (dentro de `llm-active-brain/`) — comandos
  entregues ao Cleber, nenhum rodado por mim (regra fixa do projeto).
- Decisão de produto ainda em aberto: **como cobrar de fato** o valor
  acumulado (fatura mensal? débito direto? integração de gateway de
  pagamento?) — não decidido nesta sessão, é o próximo passo real depois
  que o caixa estiver rodando e acumulando dado.
