-- ============================================================================
-- LEDGER DE EXECUÇÃO REAL — broker_order_executions — 2026-08-18
-- ============================================================================
--
-- ACHADO desta sessão, ao investigar de onde viria o lote para o Programa de
-- Parceiros IB (SESSAO_2026-08-18_PROGRAMA_PARCEIROS_IB.md): hoje NÃO EXISTE
-- nenhum registro durável de lote executado de verdade em nenhum lugar do
-- sistema.
--
--  • `ai_trades.quantity` não é lote — é capital em dólar alocado no trade
--    (vem de `finalTradeCapital` em runTradingCycle.ts:1215). É sempre DEMO,
--    execução virtual.
--  • A execução automática real (Estágio 3, `useAutoExecutionStage.ts`) chama
--    a corretora de verdade e grava o resultado só em `useState` — some ao
--    fechar a aba.
--  • A boleta manual real (`OrderTicket.tsx`, branch fora de DEMO) chama a
--    corretora e mostra um toast. Não persiste em lugar nenhum.
--
-- Esta tabela é o ponto único de verdade: toda ordem de MERCADO bem-sucedida
-- passa por UM handler no servidor (`POST /broker/execute` em
-- supabase/functions/server/index.ts) — é lá, não no cliente, que a linha é
-- inserida, com `service_role`. Isso fecha por construção o vetor óbvio de
-- fraude do programa de parceiros: se a inserção fosse feita pelo cliente, um
-- indicado mal-intencionado poderia se autodeclarar volume que nunca operou
-- para inflar a comissão paga ao "parceiro" (possivelmente ele mesmo, com
-- conta falsa). Com a inserção no servidor, a linha só existe se a MetaAPI
-- (a corretora de verdade) confirmou a ordem.
--
-- Esta tabela é o INSUMO de volume que falta pro job de apuração mensal do
-- Programa de Parceiros IB (pendência B4, ainda não implementada). Ela não
-- calcula comissão nenhuma sozinha — só registra fato: "este usuário operou
-- X lotes deste símbolo, neste horário, nesta corretora".
--
-- COMO APLICAR: SQL Editor do Supabase (projeto wyvdsxtcmizettljxtbg).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.broker_order_executions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  broker_account_id text NOT NULL,   -- accountId da MetaAPI (permite futuro multi-corretora)

  symbol          text NOT NULL,
  side            text NOT NULL CHECK (side IN ('BUY', 'SELL')),
  volume          numeric NOT NULL CHECK (volume > 0),   -- lote MT5 real

  -- IDs devolvidos pela corretora — a prova de que a ordem existiu de verdade.
  order_id        text,
  position_id     text,

  -- De onde veio o pedido. 'MANUAL' é a boleta (OrderTicket.tsx); os outros
  -- valores mapeiam as chamadas já existentes de /broker/execute.
  source_action   text NOT NULL CHECK (source_action IN (
                    'createMarketBuyOrder', 'createMarketSellOrder'
                  )),

  comment         text,   -- o `comment` da ordem já diz a origem: contém
                           -- 'NeuralDayTrader-Stage3-AutoExec' pra execução
                           -- automática, ou o texto livre da boleta manual.

  executed_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broker_order_executions_user
  ON public.broker_order_executions(user_id, executed_at DESC);

COMMENT ON TABLE public.broker_order_executions IS
  'Ledger append-only de ordens de MERCADO reais confirmadas pela MetaAPI. Inserida só pelo servidor (service_role) — nunca pelo cliente. Insumo de volume do Programa de Parceiros IB.';

ALTER TABLE public.broker_order_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS broker_order_executions_select_own ON public.broker_order_executions;
CREATE POLICY broker_order_executions_select_own ON public.broker_order_executions
  FOR SELECT USING (auth.uid() = user_id);

-- Sem policy de INSERT/UPDATE/DELETE para authenticated/anon: só service_role
-- escreve (o RLS por padrão já bloqueia todo mundo que não tem policy
-- explícita, e service_role ignora RLS por definição do Supabase).

-- ============================================================================
-- FIM. O que esta tabela NÃO resolve (fora de escopo desta migration):
--   • Ordens PENDENTES (Limit/Stop) só entram no ledger quando disparam de
--     verdade — hoje não sabemos disso de forma síncrona no /broker/execute,
--     porque quem detecta o disparo é a própria MetaAPI, depois. Registrar
--     essas exigiria um webhook ou polling — não implementado.
--   • Fechamento de posição (o lado "saída" do trade) não é registrado aqui —
--     esta tabela é só o volume de ENTRADA, que já é o suficiente pra apurar
--     comissão de execução (comissão + rebate incidem sobre volume negociado,
--     não sobre P&L).
--   • Nenhuma reconciliação contra o extrato oficial da corretora ainda
--     existe. Para "à prova de investidor" de verdade, o job de apuração
--     mensal (pendência B4) deveria cruzar este ledger com o relatório da
--     MetaAPI antes de pagar comissão sobre ele.
-- ============================================================================
