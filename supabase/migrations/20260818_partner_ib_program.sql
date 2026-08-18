-- ============================================================================
-- PROGRAMA DE PARCEIROS IB (Introducing Broker) — 2026-08-18
-- ============================================================================
--
-- Contexto: a seção "Parceiros" do app existia como tela 100% mock (indicados
-- inventados, R$1.250 de comissão fabricada, gráfico com dados fixos no
-- código). Nenhuma tabela existia por trás. Esta migration cria a estrutura
-- real.
--
-- REGRA DE NEGÓCIO IMPLEMENTADA (ver src/app/services/partners/CommissionModel.ts):
--
--     comissão do parceiro = alíquota_do_nível × margem_de_contribuição_do_indicado
--     margem = receita bruta − imposto sobre faturamento − custo de servir
--
-- A base é MARGEM, não receita bruta, para tornar impossível por construção
-- pagar ao parceiro mais do que o indicado gerou. Ver o doc da sessão para a
-- calibração completa nos 3 cenários da planilha financeira.
--
-- DECISÕES ESTRUTURAIS (não reverter sem ler o motivo):
--
--  1. `partner_commission_entries` é APPEND-ONLY. Correção nunca é UPDATE — é
--     um lançamento novo de estorno (`reversal_of`). Isso vem direto do
--     incidente de 2026-08-18 registrado em CLAUDE.md: um trade corrompido foi
--     corrigido com UPDATE silencioso em `ai_trades`, sem rastro, deixando o
--     registro indistinguível de manipulação para quem audita. Comissão a
--     pagar é dado financeiro de terceiro — o padrão aqui é ainda mais rígido:
--     a tabela tem trigger que BLOQUEIA update dos campos de valor.
--
--  2. Cada lançamento congela a alíquota, a base e as premissas usadas na
--     apuração. Mudar a escada de níveis no futuro não pode reescrever o
--     passado.
--
--  3. Apuração e liberação são SÓ do service_role. O cliente lê, nunca escreve
--     — um parceiro não pode criar a própria comissão.
--
-- COMO APLICAR: SQL Editor do Supabase (projeto wyvdsxtcmizettljxtbg).
-- Nunca aplicada por automação — convenção do projeto.
-- ============================================================================

-- ── 1. Conta de parceiro ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.partner_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Código público de indicação (aparece no link). Curto, sem ambiguidade
  -- visual (sem O/0, I/1) porque é digitado à mão com frequência.
  referral_code   text NOT NULL UNIQUE CHECK (referral_code ~ '^[A-HJ-NP-Z2-9]{6,10}$'),

  status          text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CLOSED')),

  -- Nível vigente. Recalculado pela apuração mensal, nunca pelo cliente.
  tier            text NOT NULL DEFAULT 'NODE' CHECK (tier IN ('NODE', 'SIGNAL', 'CORE', 'PRIME')),

  -- Documento do titular: base do bloqueio de autoindicação. Guardado como
  -- hash — o programa precisa comparar, não precisa ler.
  document_hash   text,

  payout_method   text CHECK (payout_method IN ('PIX', 'BANK_TRANSFER', 'USDT')),
  payout_details  jsonb,

  terms_accepted_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.partner_accounts IS 'Conta no Programa de Parceiros IB. Um por usuário.';
COMMENT ON COLUMN public.partner_accounts.tier IS 'Nível vigente — derivado de indicados ATIVOS na última apuração. Nunca definido pelo cliente.';

-- ── 2. Indicados ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.partner_referrals (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id        uuid NOT NULL REFERENCES public.partner_accounts(id) ON DELETE CASCADE,

  -- O usuário indicado. UNIQUE: um usuário pertence a no máximo um parceiro,
  -- para sempre — atribuição é first-touch e não muda depois.
  referred_user_id  uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Marcos do funil. Cada um com data para o painel mostrar em que estágio o
  -- indicado parou — é a informação acionável que o painel da corretora não dá.
  signed_up_at      timestamptz NOT NULL DEFAULT now(),
  broker_linked_at  timestamptz,   -- conectou conta real (MetaAPI)
  first_trade_at    timestamptz,   -- primeiro lote executado
  subscribed_at     timestamptz,   -- virou assinante pagante
  churned_at        timestamptz,

  -- Como chegou: útil para medir CAC por canal contra a mídia paga.
  source_channel    text,
  landing_path      text,

  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_referrals_partner ON public.partner_referrals(partner_id, signed_up_at DESC);

COMMENT ON COLUMN public.partner_referrals.referred_user_id IS 'UNIQUE de propósito: atribuição first-touch, um indicado nunca troca de parceiro.';

-- ── 3. Lançamentos de comissão (APPEND-ONLY) ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.partner_commission_entries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id        uuid NOT NULL REFERENCES public.partner_accounts(id) ON DELETE RESTRICT,
  referral_id       uuid NOT NULL REFERENCES public.partner_referrals(id) ON DELETE RESTRICT,

  -- Período de apuração (sempre o 1º dia do mês apurado).
  period_start      date NOT NULL,

  -- Demonstração completa da conta, congelada no momento da apuração. É o que
  -- a tela abre para o parceiro linha a linha — comissão auditável pelo próprio
  -- parceiro, não um número que ele tem que acreditar.
  lots_traded       numeric NOT NULL DEFAULT 0 CHECK (lots_traded >= 0),
  execution_revenue numeric NOT NULL DEFAULT 0 CHECK (execution_revenue >= 0),
  subscription_revenue numeric NOT NULL DEFAULT 0 CHECK (subscription_revenue >= 0),
  marketplace_revenue  numeric NOT NULL DEFAULT 0 CHECK (marketplace_revenue >= 0),
  gross_revenue     numeric NOT NULL CHECK (gross_revenue >= 0),
  tax_amount        numeric NOT NULL CHECK (tax_amount >= 0),
  infra_cost        numeric NOT NULL CHECK (infra_cost >= 0),
  margin_base       numeric NOT NULL CHECK (margin_base >= 0),

  -- Alíquota e premissas congeladas: mudar a escada no futuro não reescreve
  -- o passado.
  tier_at_accrual   text NOT NULL CHECK (tier_at_accrual IN ('NODE', 'SIGNAL', 'CORE', 'PRIME')),
  margin_share      numeric NOT NULL CHECK (margin_share > 0 AND margin_share <= 0.30),
  assumptions       jsonb NOT NULL,

  amount            numeric NOT NULL,

  status            text NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'AVAILABLE', 'PAID', 'REVERSED')),

  -- Janela de maturação: o rebate IB é pago pela corretora com defasagem e
  -- pode ser glosado. Sem isso, a plataforma pagaria antes de receber.
  matures_at        timestamptz NOT NULL,
  payout_id         uuid,

  -- Correção é lançamento novo, nunca edição do original.
  reversal_of       uuid REFERENCES public.partner_commission_entries(id),
  reversal_reason   text,

  created_at        timestamptz NOT NULL DEFAULT now(),

  -- A invariante do programa, gravada como CHECK no banco: a comissão nunca
  -- pode exceder a margem que o indicado gerou. Se algum bug de apuração
  -- tentar, o INSERT falha em vez de virar dinheiro a pagar.
  CONSTRAINT commission_never_exceeds_margin
    CHECK (amount <= margin_base + 0.01),

  -- Valor negativo só existe em linha de estorno — nunca numa apuração normal.
  CONSTRAINT negative_amount_only_on_reversal
    CHECK (amount >= 0 OR reversal_of IS NOT NULL)
);

-- Uma apuração por indicado por mês. Índice PARCIAL de propósito: um UNIQUE
-- comum incluindo `reversal_of` não serviria, porque no Postgres NULLs são
-- distintos entre si — dois lançamentos normais (ambos com reversal_of NULL)
-- passariam pela restrição. Estornos ficam de fora do índice e podem repetir.
CREATE UNIQUE INDEX IF NOT EXISTS unique_accrual_per_referral_period
  ON public.partner_commission_entries (referral_id, period_start)
  WHERE reversal_of IS NULL;

CREATE INDEX IF NOT EXISTS idx_commission_partner_period ON public.partner_commission_entries(partner_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_commission_status ON public.partner_commission_entries(status, matures_at);

COMMENT ON TABLE public.partner_commission_entries IS
  'Lançamentos de comissão. APPEND-ONLY: correção é estorno (reversal_of), nunca UPDATE. Ver trigger partner_commission_block_update.';

-- ── 3.1 Bloqueio de UPDATE em valor (a regra do projeto, no banco) ──────────
--
-- CLAUDE.md, convenção de 2026-08-18: "corrigir registro financeiro corrompido
-- nunca é um UPDATE silencioso". Em `ai_trades` isso virou auditoria depois do
-- incidente. Aqui a tabela nasce com o bloqueio: os campos de valor são
-- imutáveis, e só o fluxo de pagamento pode mexer em status/payout_id.

CREATE OR REPLACE FUNCTION public.partner_commission_block_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.amount            IS DISTINCT FROM OLD.amount
  OR NEW.margin_base       IS DISTINCT FROM OLD.margin_base
  OR NEW.margin_share      IS DISTINCT FROM OLD.margin_share
  OR NEW.gross_revenue     IS DISTINCT FROM OLD.gross_revenue
  OR NEW.lots_traded       IS DISTINCT FROM OLD.lots_traded
  OR NEW.period_start      IS DISTINCT FROM OLD.period_start
  OR NEW.referral_id       IS DISTINCT FROM OLD.referral_id
  OR NEW.partner_id        IS DISTINCT FROM OLD.partner_id THEN
    RAISE EXCEPTION
      'partner_commission_entries é append-only: para corrigir o lançamento %, insira um estorno com reversal_of = % e um lançamento novo. Editar valor apagaria o histórico de um pagamento a terceiro.',
      OLD.id, OLD.id;
  END IF;

  -- Transição de status permitida: PENDING → AVAILABLE → PAID, e qualquer
  -- estado → REVERSED. Nunca voltar de PAID.
  IF OLD.status = 'PAID' AND NEW.status <> 'PAID' THEN
    RAISE EXCEPTION 'lançamento já pago (%) não volta de status — use estorno', OLD.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS partner_commission_block_update ON public.partner_commission_entries;
CREATE TRIGGER partner_commission_block_update
  BEFORE UPDATE ON public.partner_commission_entries
  FOR EACH ROW EXECUTE FUNCTION public.partner_commission_block_update();

-- ── 4. Saques ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.partner_payouts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id     uuid NOT NULL REFERENCES public.partner_accounts(id) ON DELETE RESTRICT,
  amount         numeric NOT NULL CHECK (amount > 0),
  method         text NOT NULL CHECK (method IN ('PIX', 'BANK_TRANSFER', 'USDT')),
  status         text NOT NULL DEFAULT 'REQUESTED'
                 CHECK (status IN ('REQUESTED', 'APPROVED', 'PAID', 'REJECTED')),
  requested_at   timestamptz NOT NULL DEFAULT now(),
  processed_at   timestamptz,
  external_ref   text,
  rejection_reason text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_payouts_partner ON public.partner_payouts(partner_id, requested_at DESC);

-- ── 5. RLS — parceiro lê só o dele, escrita só pelo servidor ────────────────

ALTER TABLE public.partner_accounts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_referrals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_commission_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_payouts             ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS partner_accounts_select_own ON public.partner_accounts;
CREATE POLICY partner_accounts_select_own ON public.partner_accounts
  FOR SELECT USING (auth.uid() = user_id);

-- O parceiro pode criar a PRÓPRIA conta (aceite dos termos) e atualizar só
-- dados de pagamento. `tier` e `status` ficam fora do alcance dele: a política
-- de UPDATE é acompanhada do trigger abaixo, porque RLS sozinha não impede
-- alterar coluna específica.
DROP POLICY IF EXISTS partner_accounts_insert_own ON public.partner_accounts;
CREATE POLICY partner_accounts_insert_own ON public.partner_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id AND tier = 'NODE' AND status = 'ACTIVE');
-- (o `referral_code` não entra na policy: quem o define é o trigger
--  partner_accounts_assign_code, no fim deste arquivo)

DROP POLICY IF EXISTS partner_accounts_update_own ON public.partner_accounts;
CREATE POLICY partner_accounts_update_own ON public.partner_accounts
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.partner_accounts_protect_privileged_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- service_role apura nível e status; o dono da conta não. A checagem é por
  -- `current_user` (a role efetiva do request no Supabase: anon / authenticated
  -- / service_role) e a função é SECURITY INVOKER de propósito — com SECURITY
  -- DEFINER, `current_user` viraria o dono da função e a comparação sempre
  -- falharia, deixando o campo desprotegido.
  IF current_user IS DISTINCT FROM 'service_role' THEN
    NEW.tier          := OLD.tier;
    NEW.status        := OLD.status;
    NEW.referral_code := OLD.referral_code;
    NEW.document_hash := OLD.document_hash;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS partner_accounts_protect_privileged_fields ON public.partner_accounts;
CREATE TRIGGER partner_accounts_protect_privileged_fields
  BEFORE UPDATE ON public.partner_accounts
  FOR EACH ROW EXECUTE FUNCTION public.partner_accounts_protect_privileged_fields();

DROP POLICY IF EXISTS partner_referrals_select_own ON public.partner_referrals;
CREATE POLICY partner_referrals_select_own ON public.partner_referrals
  FOR SELECT USING (
    partner_id IN (SELECT id FROM public.partner_accounts WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS partner_commissions_select_own ON public.partner_commission_entries;
CREATE POLICY partner_commissions_select_own ON public.partner_commission_entries
  FOR SELECT USING (
    partner_id IN (SELECT id FROM public.partner_accounts WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS partner_payouts_select_own ON public.partner_payouts;
CREATE POLICY partner_payouts_select_own ON public.partner_payouts
  FOR SELECT USING (
    partner_id IN (SELECT id FROM public.partner_accounts WHERE user_id = auth.uid())
  );

-- Pedido de saque: o parceiro cria, mas só até o saldo disponível e acima do
-- mínimo. O valor é conferido de novo no servidor antes de aprovar.
DROP POLICY IF EXISTS partner_payouts_insert_own ON public.partner_payouts;
CREATE POLICY partner_payouts_insert_own ON public.partner_payouts
  FOR INSERT WITH CHECK (
    partner_id IN (SELECT id FROM public.partner_accounts WHERE user_id = auth.uid())
    AND status = 'REQUESTED'
    AND amount >= 100
    AND amount <= COALESCE((
      SELECT sum(e.amount)
      FROM public.partner_commission_entries e
      JOIN public.partner_accounts owner ON owner.id = e.partner_id
      WHERE owner.user_id = auth.uid() AND e.status = 'AVAILABLE'
    ), 0)
  );

-- ── 6. Visão agregada do painel (uma consulta em vez de seis) ───────────────

CREATE OR REPLACE VIEW public.partner_dashboard_summary
WITH (security_invoker = true) AS
SELECT
  pa.id           AS partner_id,
  pa.user_id,
  pa.referral_code,
  pa.tier,
  pa.status,
  r.total_referrals,
  r.linked_referrals,
  r.trading_referrals,
  r.paying_referrals,
  c.lifetime_lots,
  c.lifetime_earned,
  c.available_balance,
  c.pending_balance,
  c.paid_total
FROM public.partner_accounts pa
-- Subconsultas separadas de propósito: juntar `partner_referrals` e
-- `partner_commission_entries` no mesmo FROM produz produto cartesiano (N
-- indicados × M lançamentos), e os SUM() de dinheiro sairiam multiplicados
-- pelo número de indicados. COUNT(DISTINCT) mascararia o erro nas contagens e
-- deixaria só os valores errados — silencioso e caro.
LEFT JOIN LATERAL (
  SELECT
    count(*)                                                          AS total_referrals,
    count(*) FILTER (WHERE pr.broker_linked_at IS NOT NULL)           AS linked_referrals,
    count(*) FILTER (WHERE pr.first_trade_at IS NOT NULL)             AS trading_referrals,
    count(*) FILTER (WHERE pr.subscribed_at IS NOT NULL
                       AND pr.churned_at IS NULL)                     AS paying_referrals
  FROM public.partner_referrals pr
  WHERE pr.partner_id = pa.id
) r ON true
LEFT JOIN LATERAL (
  SELECT
    COALESCE(sum(ce.lots_traded), 0)                                        AS lifetime_lots,
    COALESCE(sum(ce.amount) FILTER (WHERE ce.status IN ('AVAILABLE','PAID')), 0) AS lifetime_earned,
    COALESCE(sum(ce.amount) FILTER (WHERE ce.status = 'AVAILABLE'), 0)      AS available_balance,
    COALESCE(sum(ce.amount) FILTER (WHERE ce.status = 'PENDING'), 0)        AS pending_balance,
    COALESCE(sum(ce.amount) FILTER (WHERE ce.status = 'PAID'), 0)           AS paid_total
  FROM public.partner_commission_entries ce
  WHERE ce.partner_id = pa.id
) c ON true;

COMMENT ON VIEW public.partner_dashboard_summary IS
  'Resumo do painel de parceiros. security_invoker: respeita a RLS de quem consulta.';

-- ── 7. Geração de código de indicação sem colisão ───────────────────────────

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
-- SECURITY DEFINER: a checagem de colisão precisa enxergar TODOS os códigos.
-- Sob a RLS do invoker ela só veria a própria linha e devolveria códigos já
-- usados por outros parceiros. Não expõe dado — devolve só uma string nova.
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Alfabeto sem O/0 e I/1: o código é ditado por telefone e digitado à mão.
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  i int;
BEGIN
  LOOP
    candidate := '';
    FOR i IN 1..8 LOOP
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.partner_accounts WHERE referral_code = candidate);
  END LOOP;
  RETURN candidate;
END;
$$;

-- O cliente nunca escolhe o próprio código: o INSERT vai sem `referral_code` e
-- este trigger preenche. Fecha a porta para um parceiro reivindicar um código
-- de marca ("NEURAL", "OFICIAL") e para colisão por corrida entre dois cadastros
-- simultâneos.
CREATE OR REPLACE FUNCTION public.partner_accounts_assign_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.referral_code IS NULL OR current_user IS DISTINCT FROM 'service_role' THEN
    NEW.referral_code := public.generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS partner_accounts_assign_code ON public.partner_accounts;
CREATE TRIGGER partner_accounts_assign_code
  BEFORE INSERT ON public.partner_accounts
  FOR EACH ROW EXECUTE FUNCTION public.partner_accounts_assign_code();

-- FK do lançamento para o saque que o liquidou (declarada aqui porque
-- partner_payouts é criada depois de partner_commission_entries).
ALTER TABLE public.partner_commission_entries
  DROP CONSTRAINT IF EXISTS partner_commission_entries_payout_fk;
ALTER TABLE public.partner_commission_entries
  ADD CONSTRAINT partner_commission_entries_payout_fk
  FOREIGN KEY (payout_id) REFERENCES public.partner_payouts(id) ON DELETE SET NULL;

-- ============================================================================
-- FIM. Pendências deliberadamente NÃO resolvidas aqui (ver doc da sessão):
--   • O job de apuração mensal (Edge Function + pg_cron) — precisa da fonte de
--     volume real por usuário, que hoje só existe para a conta de plataforma.
--   • Exportação write-once do log de comissão para fora do Supabase (mesmo
--     limite já registrado para ai_trades_audit_log em CLAUDE.md).
-- ============================================================================
