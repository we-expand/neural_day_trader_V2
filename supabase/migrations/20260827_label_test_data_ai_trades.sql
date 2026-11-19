-- 2026-08-27: rotulagem do lote de dado de teste em ai_trades (achado da
-- SESSAO_2026-08-26_GERENCIAMENTO_DE_SAIDA_E_TENDENCIA.md, item 3 de
-- pendencias). NUNCA um UPDATE silencioso em registro financeiro (regra do
-- CLAUDE.md) -- este migration so ADICIONA metadado de classificacao, nao
-- toca em nenhuma coluna de valor (entry_price, exit_price, pnl, commission
-- etc. permanecem intactos e auditaveis via ai_trades_audit_log).

alter table ai_trades
  add column if not exists is_test_data boolean not null default false,
  add column if not exists test_data_reason text;

comment on column ai_trades.is_test_data is
  'true = registro identificado como dado de teste/dev, nao trade real de producao. Ver test_data_reason para o motivo. Rotulado em 2026-08-27, nao apagar/alterar sem nova auditoria.';
comment on column ai_trades.test_data_reason is
  'Motivo da rotulagem como dado de teste (preenchido so quando is_test_data=true).';

-- Lote 1: trades de teste do inicio de agosto (SPX500 + BTCUSD), assinatura
-- exit_reason=MANUAL + stop_loss=0 + commission=0, 2026-08-03 a 2026-08-05.
-- Confirmado que essa assinatura NAO pega: (a) os 8 BTCUSD reais de
-- 2026-08-20/21 com commission=0 por causa do bug "custo nao cobrado" (ja
-- documentado e corrigido, exit_reason=SL/TP, nao MANUAL); (b) o trade
-- manual real do Cleber de 2026-08-26 (commission != 0).
update ai_trades
set is_test_data = true,
    test_data_reason = 'Lote de teste inicio de agosto: exit_reason=MANUAL, stop_loss=0 e commission=0 simultaneos (sem custo real, fechamento manual sem stop configurado) -- nao e trade automatizado real. Ver SESSAO_2026-08-26_GERENCIAMENTO_DE_SAIDA_E_TENDENCIA.md.'
where symbol in ('SPX500', 'BTCUSD')
  and exit_reason = 'MANUAL'
  and stop_loss = 0
  and commission = 0
  and entry_time >= '2026-08-03' and entry_time < '2026-08-06'
  and is_test_data = false;

-- Lote 2: 3 registros SPX500 de 2026-07-06 com dado inconsistente/quebrado
-- (achado nesta auditoria, fora do escopo original): um fechou "SL" a um
-- preco 1400+ pontos alem do stop registrado (pnl -$3810, implausivel pro
-- tamanho de posicao do sistema); outro ficou CLOSED com exit_time/pnl
-- nulos. Anteriores a persistencia real do motor ter estabilizado.
update ai_trades
set is_test_data = true,
    test_data_reason = 'Registro de 2026-07-06 com dado inconsistente (exit muito alem do stop registrado e/ou status CLOSED com exit_time/pnl nulos) -- anterior a persistencia do motor estabilizar. Auditoria 2026-08-27.'
where symbol = 'SPX500'
  and entry_time >= '2026-07-06' and entry_time < '2026-07-07'
  and is_test_data = false;
