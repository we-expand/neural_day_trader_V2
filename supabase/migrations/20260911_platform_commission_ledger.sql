-- ============================================================================
-- CAIXA CONTÁBIL DA COMISSÃO PRÓPRIA (LIVE) — platform_commission_ledger
-- 2026-09-11
-- ============================================================================
--
-- Pedido do Cleber: "esse dinheiro tem que ser gerenciado, tem que ter um
-- caixa que direciona o dinheiro ganho pelo spread [comissão], faz a
-- contabilidade disso e me apresenta."
--
-- Antes desta migration, a comissão da casa (LIVE) era recalculada NA HORA
-- em toda chamada de `/admin/commission-summary`, direto de `ai_trades` —
-- não existia "caixa" nenhum, só um número derivado, que mudaria
-- retroativamente se a tabela de taxas (platformCommission.ts) fosse
-- recalibrada no futuro. Isso não é contabilidade de verdade: um lançamento
-- contábil tem que travar o valor apurado NAQUELE momento, com a taxa que
-- valia naquele momento — mesma disciplina já usada em `ai_trades_audit_log`
-- (nunca reescrever, sempre novo registro).
--
-- Esta tabela é o ponto único de gravação: 1 linha por trade LIVE fechado,
-- inserida pelo motor (`llm-active-brain`, service_role) no momento exato do
-- fechamento — nunca recalculada depois. `/admin/commission-summary` passa a
-- LER daqui (soma/agrupa), não a recalcular.
--
-- COMO APLICAR: SQL Editor do Supabase (projeto wyvdsxtcmizettljxtbg).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.platform_commission_ledger (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  trade_id          uuid NOT NULL REFERENCES public.ai_trades(id) ON DELETE CASCADE,
  user_id           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id        uuid,

  symbol            text NOT NULL,
  asset_class       text NOT NULL,          -- FOREX_MAJOR | GOLD | OIL | INDEX | CRYPTO (ver platformCommission.ts)
  notional_usd      numeric NOT NULL CHECK (notional_usd >= 0),
  rate_percent      numeric NOT NULL,        -- taxa round-trip aplicada NESTE lançamento (trava o valor histórico)
  accrued_usd       numeric NOT NULL CHECK (accrued_usd >= 0),

  -- Estado de cobrança real. 'ACCRUED' = apurado, ainda não cobrado do
  -- usuário (todo lançamento nasce assim hoje, não existe mecanismo de
  -- cobrança implementado). Colunas aqui só para quando esse mecanismo
  -- existir — não fabricar 'COLLECTED' sem cobrança real acontecendo.
  status            text NOT NULL DEFAULT 'ACCRUED' CHECK (status IN ('ACCRUED', 'COLLECTED', 'WAIVED')),
  collected_at      timestamptz,

  closed_at         timestamptz NOT NULL,    -- exit_time do trade de origem
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_commission_ledger_closed_at
  ON public.platform_commission_ledger(closed_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_commission_ledger_symbol
  ON public.platform_commission_ledger(symbol);
CREATE INDEX IF NOT EXISTS idx_platform_commission_ledger_trade
  ON public.platform_commission_ledger(trade_id);

COMMENT ON TABLE public.platform_commission_ledger IS
  'Caixa contábil da comissão própria da plataforma sobre trades LIVE fechados. Append-only, 1 linha por trade, taxa travada no momento do fechamento. Inserida só pelo motor (service_role) — nunca pelo cliente.';

ALTER TABLE public.platform_commission_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_commission_ledger_select_own ON public.platform_commission_ledger;
CREATE POLICY platform_commission_ledger_select_own ON public.platform_commission_ledger
  FOR SELECT USING (auth.uid() = user_id);

-- Sem policy de INSERT/UPDATE/DELETE para authenticated/anon — só service_role
-- escreve (RLS bloqueia por padrão quem não tem policy explícita).

-- ============================================================================
-- FIM. O que esta tabela NÃO resolve (fora de escopo desta migration):
--   • Cobrança efetiva do usuário (fatura, débito em conta, gateway de
--     pagamento) — todo lançamento nasce 'ACCRUED', nunca 'COLLECTED', até
--     esse mecanismo existir de verdade.
--   • Reconciliação contra extrato oficial da corretora.
--   • Backfill de trades LIVE fechados ANTES desta migration — ficam de fora
--     do caixa (não há como reconstruir com integridade sem gravar de novo,
--     e regravar retroativamente violaria a disciplina de nunca fabricar
--     "closed_at"/dado histórico que não foi realmente apurado na hora).
-- ============================================================================
