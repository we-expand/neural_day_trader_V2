-- Migration: fix_rls_security_gaps
-- Aplicada manualmente via SQL Editor do Supabase em 2026-07-04 (Fase 1 de segurança).
-- Corrige: 9 tabelas expostas com RLS desabilitado + 4 tabelas por-usuário com RLS
-- ligado mas sem nenhuma política (bloqueadas até pro dono) + search_path mutável
-- em 3 funções (achados do Supabase security advisor).

-- 1) Dados de mercado compartilhados: já têm política de leitura pública, só faltava ligar RLS
ALTER TABLE public.asset_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ohlcv_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liquidity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;

-- 2) social_sentiment: mesmo padrão de dado público, mas sem política ainda
ALTER TABLE public.social_sentiment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view social sentiment" ON public.social_sentiment
  FOR SELECT USING (true);

-- 3) Tabelas internas/sensíveis: só admin lê, resto só via backend (service_role)
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view system logs" ON public.system_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
  );

ALTER TABLE public.api_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view api metrics" ON public.api_metrics
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
  );

ALTER TABLE public.kv_store_1dbacac6 ENABLE ROW LEVEL SECURITY;
-- sem política pública: só o backend (service_role) acessa

-- 4) Tabelas por-usuário com RLS ligado mas sem NENHUMA política (hoje bloqueadas até pro dono)
CREATE POLICY "Users manage own alert_history" ON public.alert_history
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own backtest_results" ON public.backtest_results
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own performance_metrics" ON public.performance_metrics
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own user_activity" ON public.user_activity
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5) Corrige search_path mutável nas funções (achado do advisor de segurança)
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;
ALTER FUNCTION public.calculate_trade_pnl() SET search_path = public, pg_temp;
ALTER FUNCTION public.increment_news_views() SET search_path = public, pg_temp;
