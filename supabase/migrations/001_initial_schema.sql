-- ============================================================================
-- NEURAL DAY TRADER PLATFORM - SUPABASE SCHEMA
-- Complete Database Structure for Real-Time Trading Platform
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy search
CREATE EXTENSION IF NOT EXISTS "vector"; -- For AI embeddings (optional)

-- ============================================================================
-- 1. USERS & AUTHENTICATION
-- ============================================================================

-- Users table (extends Supabase Auth)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  is_whitelisted BOOLEAN DEFAULT FALSE,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise', 'lifetime')),
  subscription_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  
  -- User preferences
  preferences JSONB DEFAULT '{
    "theme": "dark",
    "language": "pt-BR",
    "notifications_enabled": true,
    "voice_alerts_enabled": true,
    "default_asset": "BTC",
    "default_timeframe": "1h"
  }'::jsonb,
  
  -- Trading settings
  trading_config JSONB DEFAULT '{
    "max_risk_per_trade": 2.0,
    "max_daily_loss": 5.0,
    "default_leverage": 1,
    "auto_trading_enabled": false
  }'::jsonb
);

-- User activity log
CREATE TABLE IF NOT EXISTS public.user_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. MARKET DATA & PRICES
-- ============================================================================

-- Real-time asset prices (streaming data)
CREATE TABLE IF NOT EXISTS public.asset_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_symbol TEXT NOT NULL,
  price NUMERIC(20, 8) NOT NULL,
  bid NUMERIC(20, 8),
  ask NUMERIC(20, 8),
  volume NUMERIC(20, 4),
  change_24h NUMERIC(10, 4),
  change_percent_24h NUMERIC(10, 4),
  high_24h NUMERIC(20, 8),
  low_24h NUMERIC(20, 8),
  market_cap NUMERIC(20, 2),
  source TEXT NOT NULL CHECK (source IN ('binance', 'mt5', 'infinox', 'internal')),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  
  -- Index for fast queries
  CONSTRAINT unique_asset_price_timestamp UNIQUE (asset_symbol, timestamp)
);

-- Create hypertable for TimescaleDB (if using TimescaleDB extension)
-- SELECT create_hypertable('asset_prices', 'timestamp', if_not_exists => TRUE);

-- Index for blazing fast queries
CREATE INDEX IF NOT EXISTS idx_asset_prices_symbol_timestamp ON public.asset_prices(asset_symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_asset_prices_timestamp ON public.asset_prices(timestamp DESC);

-- Aggregated OHLCV data (for charts)
CREATE TABLE IF NOT EXISTS public.ohlcv_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL CHECK (timeframe IN ('1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M')),
  open NUMERIC(20, 8) NOT NULL,
  high NUMERIC(20, 8) NOT NULL,
  low NUMERIC(20, 8) NOT NULL,
  close NUMERIC(20, 8) NOT NULL,
  volume NUMERIC(20, 4) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  
  CONSTRAINT unique_ohlcv UNIQUE (asset_symbol, timeframe, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_ohlcv_symbol_timeframe ON public.ohlcv_data(asset_symbol, timeframe, timestamp DESC);

-- ============================================================================
-- 3. AI PREDICTIONS & SIGNALS
-- ============================================================================

-- Liquidity prediction events (whale alerts)
CREATE TABLE IF NOT EXISTS public.liquidity_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_symbol TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'whale_buy', 'whale_sell', 'accumulation', 'distribution',
    'spoofing', 'iceberg', 'front_running', 'market_maker',
    'stop_cascade', 'smart_money'
  )),
  amount NUMERIC(20, 8),
  price NUMERIC(20, 8),
  value_usd NUMERIC(20, 2),
  wallet_address TEXT,
  exchange TEXT,
  confidence NUMERIC(5, 2) CHECK (confidence >= 0 AND confidence <= 100),
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_liquidity_events_asset ON public.liquidity_events(asset_symbol, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_liquidity_events_type ON public.liquidity_events(event_type, created_at DESC);

-- AI trading signals
CREATE TABLE IF NOT EXISTS public.ai_signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_symbol TEXT NOT NULL,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('BUY', 'SELL', 'NEUTRAL')),
  confidence NUMERIC(5, 2) CHECK (confidence >= 0 AND confidence <= 100),
  entry_price NUMERIC(20, 8),
  take_profit NUMERIC(20, 8),
  stop_loss NUMERIC(20, 8),
  timeframe TEXT,
  strategy_name TEXT,
  reasoning TEXT,
  metadata JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  result TEXT CHECK (result IN ('win', 'loss', 'breakeven', 'pending'))
);

CREATE INDEX IF NOT EXISTS idx_ai_signals_asset ON public.ai_signals(asset_symbol, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_signals_active ON public.ai_signals(is_active, created_at DESC);

-- ============================================================================
-- 4. TRADING HISTORY & PERFORMANCE
-- ============================================================================

-- User trades
CREATE TABLE IF NOT EXISTS public.trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  asset_symbol TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('BUY', 'SELL')),
  position_type TEXT CHECK (position_type IN ('LONG', 'SHORT')),
  
  -- Entry
  entry_price NUMERIC(20, 8) NOT NULL,
  entry_timestamp TIMESTAMPTZ DEFAULT NOW(),
  quantity NUMERIC(20, 8) NOT NULL,
  
  -- Exit
  exit_price NUMERIC(20, 8),
  exit_timestamp TIMESTAMPTZ,
  
  -- P&L
  profit_loss NUMERIC(20, 4),
  profit_loss_percent NUMERIC(10, 4),
  fees NUMERIC(20, 4) DEFAULT 0,
  
  -- Risk Management
  stop_loss NUMERIC(20, 8),
  take_profit NUMERIC(20, 8),
  leverage NUMERIC(5, 2) DEFAULT 1.0,
  
  -- Strategy
  strategy_name TEXT,
  ai_signal_id UUID REFERENCES public.ai_signals(id),
  
  -- Status
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'cancelled')),
  notes TEXT,
  metadata JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trades_user ON public.trades(user_id, entry_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trades_asset ON public.trades(asset_symbol, entry_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trades_status ON public.trades(status, entry_timestamp DESC);

-- Trading performance metrics (aggregated)
CREATE TABLE IF NOT EXISTS public.performance_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  period TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly', 'yearly', 'all_time')),
  
  -- Performance stats
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  win_rate NUMERIC(5, 2),
  
  -- P&L
  total_pnl NUMERIC(20, 4) DEFAULT 0,
  total_pnl_percent NUMERIC(10, 4),
  best_trade NUMERIC(20, 4),
  worst_trade NUMERIC(20, 4),
  average_pnl NUMERIC(20, 4),
  
  -- Risk metrics
  sharpe_ratio NUMERIC(10, 4),
  max_drawdown NUMERIC(10, 4),
  profit_factor NUMERIC(10, 4),
  
  -- Time period
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_user_period UNIQUE (user_id, period, period_start)
);

-- ============================================================================
-- 5. STRATEGIES & BACKTESTS
-- ============================================================================

-- User custom strategies
CREATE TABLE IF NOT EXISTS public.strategies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  asset_class TEXT[], -- ['crypto', 'forex', 'stocks']
  timeframes TEXT[], -- ['1h', '4h', '1d']
  
  -- Strategy configuration
  config JSONB NOT NULL,
  
  -- Indicators used
  indicators TEXT[],
  
  -- Risk parameters
  max_risk_per_trade NUMERIC(5, 2) DEFAULT 2.0,
  max_daily_loss NUMERIC(5, 2) DEFAULT 5.0,
  
  -- Performance
  total_backtests INTEGER DEFAULT 0,
  best_backtest_pnl NUMERIC(10, 4),
  avg_win_rate NUMERIC(5, 2),
  
  is_active BOOLEAN DEFAULT TRUE,
  is_public BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backtest results
CREATE TABLE IF NOT EXISTS public.backtest_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  strategy_id UUID REFERENCES public.strategies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Test parameters
  asset_symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  initial_capital NUMERIC(20, 4) DEFAULT 10000,
  
  -- Results
  final_capital NUMERIC(20, 4),
  total_pnl NUMERIC(20, 4),
  total_pnl_percent NUMERIC(10, 4),
  total_trades INTEGER,
  winning_trades INTEGER,
  losing_trades INTEGER,
  win_rate NUMERIC(5, 2),
  max_drawdown NUMERIC(10, 4),
  sharpe_ratio NUMERIC(10, 4),
  
  -- Detailed trades
  trades JSONB, -- Array of trade objects
  equity_curve JSONB, -- Array of {timestamp, equity}
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backtest_strategy ON public.backtest_results(strategy_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backtest_user ON public.backtest_results(user_id, created_at DESC);

-- ============================================================================
-- 6. ALERTS & NOTIFICATIONS
-- ============================================================================

-- User alerts (price alerts, signal alerts, etc)
CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'price_above', 'price_below', 'volume_spike',
    'ai_signal', 'whale_alert', 'market_hours',
    'risk_limit', 'custom'
  )),
  
  -- Alert conditions
  asset_symbol TEXT,
  condition JSONB NOT NULL, -- Flexible alert conditions
  
  -- Delivery
  delivery_methods TEXT[] DEFAULT ARRAY['in_app'], -- ['in_app', 'email', 'voice', 'push']
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  triggered_at TIMESTAMPTZ,
  trigger_count INTEGER DEFAULT 0,
  max_triggers INTEGER DEFAULT 1,
  
  -- Cooldown (prevent spam)
  cooldown_minutes INTEGER DEFAULT 15,
  last_triggered_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alerts_user_active ON public.alerts(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_alerts_asset ON public.alerts(asset_symbol) WHERE is_active = TRUE;

-- Alert history (when alerts triggered)
CREATE TABLE IF NOT EXISTS public.alert_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_id UUID REFERENCES public.alerts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  metadata JSONB,
  delivered_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 7. SOCIAL INTELLIGENCE & NEWS
-- ============================================================================

-- News articles (from crawlers)
CREATE TABLE IF NOT EXISTS public.news_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT,
  summary TEXT,
  url TEXT UNIQUE,
  source TEXT NOT NULL,
  author TEXT,
  published_at TIMESTAMPTZ,
  
  -- Related assets
  related_assets TEXT[],
  
  -- Sentiment analysis
  sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral')),
  sentiment_score NUMERIC(5, 2),
  
  -- Tags
  tags TEXT[],
  category TEXT,
  
  -- Engagement
  views INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_published ON public.news_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_assets ON public.news_articles USING GIN(related_assets);
CREATE INDEX IF NOT EXISTS idx_news_tags ON public.news_articles USING GIN(tags);

-- Social media sentiment (Twitter, Reddit, Telegram)
CREATE TABLE IF NOT EXISTS public.social_sentiment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_symbol TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('twitter', 'reddit', 'telegram', 'discord')),
  
  -- Metrics
  mentions_count INTEGER DEFAULT 0,
  positive_count INTEGER DEFAULT 0,
  negative_count INTEGER DEFAULT 0,
  neutral_count INTEGER DEFAULT 0,
  sentiment_score NUMERIC(5, 2), -- -100 to +100
  
  -- Volume
  volume_change_24h NUMERIC(10, 4),
  
  -- Trending
  is_trending BOOLEAN DEFAULT FALSE,
  trending_rank INTEGER,
  
  -- Time period
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  period TEXT DEFAULT '1h' CHECK (period IN ('1h', '4h', '1d', '1w')),
  
  CONSTRAINT unique_sentiment_period UNIQUE (asset_symbol, platform, period, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_social_sentiment_asset ON public.social_sentiment(asset_symbol, timestamp DESC);

-- ============================================================================
-- 8. SYSTEM LOGS & MONITORING
-- ============================================================================

-- System logs (errors, warnings, info)
CREATE TABLE IF NOT EXISTS public.system_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warning', 'error', 'critical')),
  module TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  user_id UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_logs_level ON public.system_logs(level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_module ON public.system_logs(module, created_at DESC);

-- API performance metrics
CREATE TABLE IF NOT EXISTS public.api_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  response_time_ms INTEGER NOT NULL,
  status_code INTEGER NOT NULL,
  user_id UUID REFERENCES public.users(id),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_metrics_endpoint ON public.api_metrics(endpoint, created_at DESC);

-- ============================================================================
-- 9. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backtest_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_history ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own data" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Trades policies
CREATE POLICY "Users can view own trades" ON public.trades
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trades" ON public.trades
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trades" ON public.trades
  FOR UPDATE USING (auth.uid() = user_id);

-- Market data is public (read-only)
CREATE POLICY "Anyone can view asset prices" ON public.asset_prices
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anyone can view OHLCV data" ON public.ohlcv_data
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anyone can view liquidity events" ON public.liquidity_events
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anyone can view AI signals" ON public.ai_signals
  FOR SELECT TO authenticated USING (true);

-- Strategies policies
CREATE POLICY "Users can view own strategies" ON public.strategies
  FOR SELECT USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can insert own strategies" ON public.strategies
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own strategies" ON public.strategies
  FOR UPDATE USING (auth.uid() = user_id);

-- Alerts policies
CREATE POLICY "Users can view own alerts" ON public.alerts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own alerts" ON public.alerts
  FOR ALL USING (auth.uid() = user_id);

-- News is public
CREATE POLICY "Anyone can view news" ON public.news_articles
  FOR SELECT TO authenticated USING (true);

-- ============================================================================
-- 10. FUNCTIONS & TRIGGERS
-- ============================================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trades_updated_at BEFORE UPDATE ON public.trades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_strategies_updated_at BEFORE UPDATE ON public.strategies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Calculate trade P&L automatically when closed
CREATE OR REPLACE FUNCTION calculate_trade_pnl()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'closed' AND NEW.exit_price IS NOT NULL THEN
    -- Calculate P&L
    IF NEW.action = 'BUY' THEN
      NEW.profit_loss = (NEW.exit_price - NEW.entry_price) * NEW.quantity * NEW.leverage;
    ELSE
      NEW.profit_loss = (NEW.entry_price - NEW.exit_price) * NEW.quantity * NEW.leverage;
    END IF;
    
    -- Calculate P&L percentage
    NEW.profit_loss_percent = (NEW.profit_loss / (NEW.entry_price * NEW.quantity)) * 100;
    
    -- Subtract fees
    NEW.profit_loss = NEW.profit_loss - COALESCE(NEW.fees, 0);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_pnl_on_trade_close BEFORE UPDATE ON public.trades
  FOR EACH ROW EXECUTE FUNCTION calculate_trade_pnl();

-- Increment news views
CREATE OR REPLACE FUNCTION increment_news_views()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.news_articles
  SET views = views + 1
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 11. REALTIME PUBLICATION
-- ============================================================================

-- Enable realtime for critical tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.asset_prices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.liquidity_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_signals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trades;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_sentiment;

-- ============================================================================
-- 12. INITIAL DATA
-- ============================================================================

-- Insert admin user (if needed, replace with your email)
-- INSERT INTO public.users (id, email, is_admin, is_whitelisted, subscription_tier)
-- VALUES (
--   'your-uuid-here',
--   'admin@neuraldaytrader.com',
--   true,
--   true,
--   'enterprise'
-- ) ON CONFLICT (email) DO NOTHING;

-- ============================================================================
-- COMPLETE! Database ready for real-time trading platform
-- ============================================================================
