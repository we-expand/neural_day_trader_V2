-- Trilha de auditoria imutável pra qualquer UPDATE em ai_trades.
--
-- Motivação (2026-08-18): um trade fechado com exit_price=0 por bug de feed
-- (ver SESSAO_2026-08-17_BUGS_EXECUCAO_REAL_24_7.md) foi corrigido via UPDATE
-- direto no SQL Editor, sem nenhum rastro no banco. ai_trades não tinha
-- coluna de auditoria, trigger ou tabela de log — o registro corrigido ficou
-- indistinguível de um trade normal pra quem audita a tabela sem o contexto
-- desta conversa. Isso é inaceitável pra dado que pode ir pra due diligence
-- de investidor: correção de registro financeiro sem rastro no próprio banco
-- é, por definição, indistinguível de manipulação.
--
-- Esta migration NÃO impede correções futuras (bugs vão continuar
-- acontecendo) — torna toda correção automaticamente auditável, gravando
-- o valor anterior completo antes de qualquer UPDATE em ai_trades, sem
-- depender de alguém lembrar de anotar manualmente.

CREATE TABLE IF NOT EXISTS ai_trades_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES ai_trades(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by text NOT NULL DEFAULT current_user,
  old_row jsonb NOT NULL,
  new_row jsonb NOT NULL
);

ALTER TABLE ai_trades_audit_log ENABLE ROW LEVEL SECURITY;

-- Só leitura, e só via service role (mesma política de acesso que as tabelas
-- de trade já seguem) — o log de auditoria não deve ser editável por ninguém,
-- nem pelo próprio dono do trade.
CREATE POLICY "service_role_read_audit_log" ON ai_trades_audit_log
  FOR SELECT
  USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION log_ai_trades_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO ai_trades_audit_log (trade_id, old_row, new_row)
  VALUES (OLD.id, to_jsonb(OLD), to_jsonb(NEW));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_trades_audit_trigger ON ai_trades;
CREATE TRIGGER ai_trades_audit_trigger
  AFTER UPDATE ON ai_trades
  FOR EACH ROW
  EXECUTE FUNCTION log_ai_trades_update();

-- Colunas de correção — preenchidas manualmente quando um UPDATE é uma
-- correção de dado corrompido (não uma atualização normal de status/preço
-- pelo próprio motor, que roda por fora deste fluxo). O trigger acima já
-- grava o registro completo em ai_trades_audit_log de qualquer forma; estas
-- colunas são pra tornar a correção visível direto na linha, sem precisar
-- fazer join com o log.
ALTER TABLE ai_trades
  ADD COLUMN IF NOT EXISTS corrected_at timestamptz,
  ADD COLUMN IF NOT EXISTS correction_reason text,
  ADD COLUMN IF NOT EXISTS original_values jsonb;
