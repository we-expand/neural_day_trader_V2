# Neural Day Trader — Estado do Projeto (atualizado 2026-07-04)

## O que é
SaaS de trading quantitativo (React 18 + TS + Vite + Supabase + MetaAPI/MT5). Baixado do Figma Make, já publicado em produção: `https://www.neuraldaytrader.com` (Vercel, projeto `neural-day-trader-v2`) + Supabase próprio (projeto "Neural DayTrader", id `wyvdsxtcmizettljxtbg`, org "We Expand" plano Pro).

**Banco vazio hoje** (todas as 17 tabelas com 0 linhas) — nunca usado de verdade em produção.

## Auditoria de código (2026-07-04) — real vs mock

### Real e funcional
- Preços cripto via Binance (`api/binance.ts`, proxy grátis, sem chave)
- Execução real de ordens MT5 via MetaAPI (`src/app/services/MetaAPIDirectClient.ts`) — `createMarketBuyOrder/Sell/closePosition/closeAllPositions` são chamadas reais
- Luna (voz): Web Speech API nativa do navegador (TTS grátis, sem STT, sem ElevenLabs/Gemini apesar do marketing)
- Supabase Auth via `api/signup.ts` (server-side, service_role bem posicionada, mas pula verificação de e-mail)

### Mock/simulado
- "IA preditiva com análise neural" = `Math.random()` + indicadores técnicos determinísticos em `useApexLogic.ts` — SEM chamada a nenhum LLM (nem OpenAI/Anthropic/Groq/Gemini)
- Social Intelligence (Twitter/Reddit/Telegram) = 100% mock/hardcoded (`MarketTendencyEngine.ts`, `SocialMediaManager.tsx`)
- Portfólio/saldo/performance não persistem (resetam ao recarregar) — `generateMockTrades()` alimenta o dashboard
- Fallback de auth local (`LocalAuthService.ts`) com hash de senha caseiro em localStorage, auto-promove a admin se o email contém "admin" — mascara falhas do Supabase Auth
- Fallback de preço `Math.random()` em `marketDataService.ts`/`UnifiedMarketDataService.ts` quando provedores externos falham (forex/índices/ações via Frankfurter/exchangerate-api/Finnhub/Twelve Data reais, mas sem trava clara pro usuário saber que virou dado sintético)

### Riscos críticos ainda não corrigidos
1. **Token MetaAPI (poder de mover dinheiro real) em texto puro no `localStorage`** — exposto a XSS/devtools/extensões. `MetaAPIDirectClient.ts` não tem trava técnica contra conta live, só existe modal de confirmação de UI (`LiveTradingTest.tsx`/`AITrader.tsx`).
2. **9 tabelas Supabase com RLS desabilitado**: `asset_prices, ohlcv_data, liquidity_events, ai_signals, news_articles, social_sentiment, system_logs, api_metrics, kv_store_1dbacac6` — expostas à chave anon.
3. Credencial de teste hardcoded em `LocalAuthTest.tsx` (`teste@local.com`/`123456`).

## Modelo de negócio decidido

- **Fase Demo** (primeiro foco, só o Cleber testa): dados de mercado reais, execução 100% virtual e persistida (hoje não persiste — é o trabalho principal).
- **Fase Real** (depois): abrir para 50-100 usuários grátis (sem taxa de entrada), monetizar via comissão por lote operado.

### Tabela de comissão (definida 2026-07-04, aguardando implementação — fica pra Fase Real)
| Classe de ativo | Taxa por 0,01 lote |
|---|---|
| Cripto (BTC, ETH...) | US$0,30 |
| Forex majors | US$0,04 |
| Forex exóticos | US$0,06 |
| Índices/Commodities | US$0,05 |
| Ações | 0,02% do valor negociado |

Desconto de 20% acima de 500 lotes/mês por usuário.

### Custo MetaAPI confirmado (site oficial, oferta g2 alta confiabilidade, 2026-07-04)
- Conta ativa hospedada 24/7: ~US$8,64/mês
- Conta inativa (registrada, não implantada): ~US$0,76/mês
- Taxa única de adicionar conta: US$2,10
- API MetaApi básica (execução): grátis, só se paga hospedagem

Break-even ≈ 29 contratos/mês por usuário (~1,5 trade/dia) se conta ficar sempre ativa. **Decisão técnica pendente**: implementar deploy/undeploy automático (deploy só quando usuário ativo na tela, undeploy após inatividade) pra não pagar US$8,64/mês por conta ociosa — isso é parte da Fase Real (execução).

**Constraint técnico importante**: MetaAPI só executa trades, não tem função de saque/transferência — não dá pra descontar a comissão direto da conta MT5 do usuário. Precisa de carteira pré-paga separada (Stripe ou similar). **Cleber ainda não tem conta em gateway de pagamento** — isso bloqueia a implementação da cobrança até ser criada.

## Prioridades (ordem definida com o Cleber)

1. **Fase 1 — Segurança** (em andamento): habilitar RLS com políticas corretas nas 9 tabelas expostas, remover `LocalAuthService`/credencial de teste hardcoded, mover token MetaAPI pra um backend (nunca no client).
2. **Fase 2 — Motor de Demo persistido**: saldo/posições virtuais reais no Supabase (não mock), preços reais alimentando o "paper trading", sem depender de `generateMockTrades()`.
3. **Fase 3 — Execução real seguro**: proxy de backend pro MetaAPI (Edge Function) + deploy/undeploy automático de conta por inatividade (economia de custo).
4. **Fase 4 — Cobrança**: carteira pré-paga + tabela de comissão acima (aguardando Cleber criar conta Stripe).
5. **Fase 5 — Testes com usuários reais**.

Meta do Cleber: **gerar receita o quanto antes**, com usuários ilimitados operando em Demo e Real assim que a tecnologia permitir com segurança.

## Workflow de deploy (regra fixa)
Claude **nunca** faz commit/push sozinho neste projeto. Sempre entregar o código pronto + os comandos exatos de `git add/commit/push` pro Cleber rodar no terminal dele. O deploy na Vercel dispara sozinho a partir do push (já configurado).

## Log de sessões

### 2026-07-04
- Confundimos inicialmente com o projeto ImobHunter (pasta separada, `ImobHunter/ImobHunter/`) — corrigido, projeto certo é este (Neural-Day-Trader/).
- Auditoria completa feita (ver seções acima).
- Definido modelo de negócio (Demo primeiro, Real depois com comissão por lote) e tabela de taxas.
- Confirmado preço real do MetaAPI via screenshot do usuário (metaapi.cloud/#pricing).
- Cleber esqueceu de criar conta Stripe — fase de cobrança fica pra depois.
- Regra confirmada: Claude nunca aplica migration/commit/push sozinho neste projeto — sempre entrega o SQL/código pronto pro Cleber rodar (harness bloqueou automaticamente uma tentativa de aplicar migration direto no Supabase de produção).
- **Fase 1 em andamento**:
  - RLS: migration escrita, corrigida (assinatura de `increment_news_views()` sem argumento) e **rodada com sucesso pelo Cleber** no SQL Editor do Supabase (projeto `wyvdsxtcmizettljxtbg`) em 2026-07-04 — habilita RLS nas 9 tabelas expostas (5 já tinham política de leitura pública pronta, só faltava ligar; `social_sentiment` ganhou política pública nova; `system_logs`/`api_metrics` viraram admin-only via `is_admin`; `kv_store_1dbacac6` ficou 100% travado pro client), mais políticas "dono vê só o próprio dado" em `alert_history`/`backtest_results`/`performance_metrics`/`user_activity` (estavam com RLS ligado mas SEM NENHUMA política — bloqueadas até pro dono), e fix de `search_path` mutável em 3 funções. Confirmado via advisor: os 9 erros críticos sumiram. Migration salva em `supabase/migrations/002_fix_rls_security_gaps.sql` (ainda não commitada — falta o push). Sobrou só cosmético (extensões no schema public) e 2 toggles de Auth no painel (leaked password protection, MFA) que o Cleber pode ligar quando quiser.
  - Auth mock removido do bundle: deletados `LocalAuthService.ts` (fallback com hash de senha caseiro, localStorage, auto-admin por email conter "admin"), `LocalAuthTest.tsx` (credencial hardcoded `teste@local.com`/`123456`) e `SmartLogin.tsx` (código morto, não usado em lugar nenhum, tinha um bypass de "biometria" fake que logava qualquer um sem checar nada). `AuthOverlay.tsx` (o componente realmente usado em `App.tsx`) foi limpo — removidos todos os fallbacks de "criar conta local silenciosamente quando Supabase falha"; agora erros do Supabase Auth aparecem como erro real pro usuário, sem bypass. Build de produção (`npm run build`) passou limpo depois da mudança.
  - **Falta ainda**: mover o token MetaAPI para um backend (item mais crítico, ainda não iniciado).
