-- 2026-09-02 (pedido do Cleber): o Cérebro LLM Ativo agora recebe "regime"
-- (sessão global + rótulo de volume real + rótulo de volatilidade real,
-- ver getMarketRegime em llm-active-brain/src/atr.ts) junto de cada
-- cotação, pra julgar quando um mercado calmo/baixo volume é tendência
-- limpa (fácil de operar) em vez de "sem oportunidade". Estas colunas
-- gravam o regime no MOMENTO da entrada, só pra permitir validar depois
-- (amostra de dias, não horas) se dar esse contexto ao LLM mudou o
-- comportamento/resultado -- sem isso, nunca dá pra medir o efeito.
-- Nullable: regime pode não estar disponível (candle insuficiente) sem
-- bloquear a entrada, mesma disciplina de "nunca fabricar dado" do resto
-- do projeto.

alter table ai_trades
  add column if not exists session_at_entry text,
  add column if not exists volume_label_at_entry text,
  add column if not exists volatility_label_at_entry text;

comment on column ai_trades.session_at_entry is 'Sessão global (ASIA/LONDRES/NY/ROLLOVER) pelo horário UTC no momento da entrada -- só contexto, ver GENESIS_PROMPT_MT5 princípio 1g.';
comment on column ai_trades.volume_label_at_entry is 'BAIXO/NORMAL/ALTO -- volume real (tickVolume MetaAPI) relativo à baseline recente do próprio símbolo, no momento da entrada.';
comment on column ai_trades.volatility_label_at_entry is 'BAIXA/NORMAL/ALTA -- ATR atual do símbolo relativo à própria janela recente, no momento da entrada.';
