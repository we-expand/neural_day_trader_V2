# Sessão 2026-08-27: persistência de config da IA + diagnósticos do dia

## Gatilho

Sequência de observações do Cleber no mesmo dia: ativos zerados no painel,
motor recusando quase tudo por falta de preço real, motor só operando
SOL/ETH, dúvida sobre TP vs. tamanho de posição, cobrança sobre o problema
de "ganha e vira loss" investigado ontem, um trade de SOLUSD com o stop
travado no breakeven, e por fim um pedido antigo (nunca implementado) de
persistência de configuração da IA por usuário.

## Achados (mais curto → mais longo)

1. **[FIX aplicado] Ativos zerados no painel** — bug de exibição em
   `InfinoxAssetsBrowser.tsx:394`: `hasPrice = !!priceData` não checava
   `price > 0`, então preço de fallback (`price: 0`, documentado como
   intencional em `RealMarketDataService.ts`) aparecia como "$0,00" em vez
   de "Sem dados". Corrigido pra `!!priceData && priceData.price > 0`,
   igual ao padrão já usado em `MarketTicker.tsx`.

2. **[Confirmado, infra externa] "82% descartado por sem preço real"** —
   BTCUSD com preço travado desde 09:43 UTC do dia (`price_guard_events`,
   `stale_ms` crescendo linearmente até ~3h23min). É o risco crônico já
   documentado (conta MetaAPI compartilhada, rate-limit/504). O guard de
   TTL de 5min está funcionando como projetado. Não é bug de código.

3. **[Confirmado, não é bug] Motor só entregando SOLUSD/ETHUSD** — todo
   ativo (BTCUSD, EURUSD, XAUUSD, UKOUSD, NAS100) está recebendo preço
   real em 88-99,9% dos ciclos; o gargalo é downstream, nos gates de
   momentum/confiança (`MACD_MOMENTUM_FADING`, `RSI_NEUTRAL_LOW_CONFIDENCE`).
   Nas últimas 48h, `ENTRY_EXECUTED`: SOLUSD 8, ETHUSD 1, todo o resto
   zero. É dinâmica de preço do período, não falha de sistema — consistente
   com "sem edge técnico comprovado, motor deve operar raramente"
   (`AI_BRAIN_SPEC.md`).

4. **[Sem conclusão ainda] TP maior vs. mais contratos** — sizing é
   fixed-fractional (`TradeSizing.ts:216-241`):
   `nocional = (capital × risco%) / distância_do_stop%`. Não dá pra
   aumentar contratos sem aumentar `riskPerTradePercent` ou capital — e
   isso escala perda esperada na mesma proporção que ganho esperado.
   O commit `57c81f478` (26/08) já fez as duas coisas juntas (risco 2%→4%,
   TP 2.5×→3.0×ATR). Medido nesta sessão: **7 trades automáticos fechados
   desde 26/08 somam -$1,88 líquido (pior que a média histórica de
   -$0,12/trade)** — os +$33,67 que pareciam "melhora" vêm inteiramente de
   3 fechamentos MANUAIS de BTCUSD (+$35,55), não do motor automático.
   Amostra de 7 é insuficiente pra qualquer conclusão; não mexer de novo
   sem mais dado.

5. **[Já resolvido ontem, aguardando dado] "Ganha e vira loss"** —
   detalhe completo em
   [SESSAO_2026-08-26_GERENCIAMENTO_DE_SAIDA_E_TENDENCIA.md](SESSAO_2026-08-26_GERENCIAMENTO_DE_SAIDA_E_TENDENCIA.md).
   3 fixes já deployados (breakeven 1,5R→1R, gate MACD só veta reversão
   real, janela cega do cron 15s→5s). **Zero trades fecharam desde o
   deploy** (checado nesta sessão) — ainda não dá pra medir efeito.

6. **[Causa raiz achada, não é bug] Stop travado no breakeven, sem
   trailing** — trade SOLUSD (`b983be37-6257-47af-9384-3066a5cc1b2b`)
   tinha `stopLossMode: "FIXO"` na config da sessão. O motor **já tem**
   trailing ATR contínuo implementado
   (`supabase/functions/ai-runner/lib/positionManager.ts:147-157`), mas só
   roda em modo `DINAMICO`. Em `FIXO` só existe o salto único de breakeven
   e nada mais — exatamente o sintoma relatado.

## Implementado nesta sessão: persistência de configuração da IA por usuário

**Pedido antigo do Cleber, nunca implementado de verdade** — só existia
`localStorage` por navegador (`useApexLogic.ts`), sem nenhuma tabela
amarrando a config ao `user_id`. Em outro dispositivo/navegador, ou depois
de limpar dados do site, a IA sempre voltava pro default hardcoded do
código.

**Feito**:
- Migration `supabase/migrations/20260827_add_ai_user_config.sql` — tabela
  `ai_user_config` (`user_id` PK, `config` jsonb, RLS restrita ao próprio
  usuário). **Aplicada pelo Cleber.**
- `AITradingPersistenceService.ts`: `getUserAIConfig(userId)` /
  `saveUserAIConfig(userId, config)`.
- `useAIPersistence.ts`: expõe os dois métodos no wrapper, mesmo padrão dos
  existentes.
- `useApexLogic.ts:767-802`: dois efeitos novos —
  1. Ao logar, busca a config salva no Supabase e sobrepõe
     `localStorage`/default (fonte de verdade real, por usuário).
  2. A cada mudança de `aiConfig` na UI, salva (upsert) no Supabase — não
     só ao criar sessão (aquilo era escrita de mão única, nunca lida de
     volta).
  Cuidado de corrida: o efeito de salvar só é liberado depois que o fetch
  de hidratação RESOLVER (não no início do efeito), senão salvaria o valor
  velho do cache local por cima do valor real antes da leitura terminar.
- `npm run validate` passou limpo. **Commit e migration já aplicados pelo
  Cleber.**

**Validado em produção, ponta a ponta**: sessão real (`183fc067...`) do
trade SOLUSD acima foi atualizada pra `stopLossMode: DINAMICO` via SQL
direto (`ai_sessions.config`) + gravado em `ai_user_config` do usuário pra
persistir daqui pra frente. Confirmado no `ai_trades_audit_log`: o stop
avançou de $104,98 pra $105,02 às 15:00:52 UTC, ~23min depois da troca —
trailing funcionando de verdade, protegendo lucro incremental além do
breakeven.

## Pendente / decisão do Cleber

1. **Considerar `stopLossMode: DINAMICO` como default pra sessões novas**
   (hoje é opção configurável que pode ficar em `FIXO` sem o usuário notar
   — foi exatamente o que aconteceu). Recomendado, mas idealmente com
   backtest rápido antes de virar padrão, mesma disciplina das outras
   mudanças de motor desta semana.
2. Rodar de novo a comparação de PnL/trade automático antes vs. depois de
   26/08 quando houver mais amostra (hoje só 7 trades automáticos no
   período "depois", insuficiente).
3. Confirmar em mais alguns trades fechados se os 3 fixes de ontem
   (breakeven 1R, gate MACD, janela cega) seguraram o problema de
   "ganha e vira loss" — zero trades fechados até o momento desta sessão.
