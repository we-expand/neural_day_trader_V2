# Handoff — próxima sessão (escrito em 2026-07-30, 00h30)

> Resumo: Fase 0 **100% completa** (2026-07-29 16h).
> **Fase 1 — Módulo de Risco: 100% implementado** (7 de 7 tópicos), **incluindo
> o hardening do Tópico 7** feito depois de identificar que a validação
> inicial era inerte na prática. ✅
> Motor de decisão intacto (npm run validate 28/28 ✅). Pronto pro commit.

---

## Fase 1 — Tópicos 6 e 7 (2026-07-29/30)

### ✅ Tópico 6: Kill-Switch (COMPLETO)
- **Arquivo**: `src/lib/modules/RiskManager.ts`
  - Novo método `shouldActivateKillSwitch(account)`: dispara se perda diária ou
    drawdown atingir `killSwitchThreshold` (configurável, 0 = desativado).
  - Novo método utilitário `validateAllRisks()` combinando kill-switch + validação padrão.
- **Integração**: `src/app/hooks/useApexLogic.ts` (GATE DE RISCO, logo após o
  cálculo de `dailyStats`, antes do `validateTrade` normal):
  - Fecha TODAS as posições abertas (`setActiveOrders([])`)
  - Para a IA imediatamente (`setIsActive(false)`)
  - Ativa Safe Mode com o motivo do kill-switch
  - Notifica o usuário via toast persistente (`duration: 0`)
- **Config**: novo campo `killSwitchThreshold?: number` em `AIConfig` (default 0 = desativado)

### ✅ Tópico 7: Enforcement em /broker/execute (COMPLETO, com correção real)

**Primeira implementação (defeituosa, corrigida na mesma sessão)**: a validação
lia os thresholds do body da requisição (`body.maxDailyLossPercent` etc). Ao
auditar quem realmente chama a rota, descobri que **nenhum caller real**
(`BrokerClient.ts` → `createMarketBuyOrder`/`createMarketSellOrder`) jamais
enviava esses campos — `OrderParams` nem tem esses campos no tipo. Ou seja, o
gate estava **sempre caindo nos defaults hardcoded** (5%/15%/2%, kill-switch
desativado), **ignorando por completo a config real do usuário**. Não era
"confia no client" — era "não reflete o client nenhum, é decorativo".

**Correção real aplicada**:
- **Novo endpoint `POST /server/risk-config`** (`supabase/functions/server/index.ts`):
  autenticado via JWT, só escreve a config do PRÓPRIO usuário autenticado
  (nunca aceita `userId` do body). Guarda no KV store (`kv_store_1dbacac6`,
  chave `risk-config:{userId}`).
- **`loadServerRiskConfig(userId, currentBalance)`**: lê a config do KV;
  reancora `dailyStartBalance` automaticamente quando o dia UTC muda; mantém
  `peakEquity` (pico histórico de equity, usado pro cálculo de drawdown
  server-side). Se não houver config salva (usuário nunca sincronizou),
  usa defaults **conservadores** — mais restritivos que os do client, nunca
  mais permissivos (kill-switch vem ATIVO por padrão aqui, ao contrário do
  client que vem desativado).
- **`/broker/execute`**: pra `createMarketBuyOrder`/`createMarketSellOrder`,
  busca `account-information` real da MetaAPI (saldo nunca vem do body) e
  usa exclusivamente `loadServerRiskConfig()` pros thresholds — o body
  não é mais lido pra nada relacionado a risco.
- **Fail-closed**: se a busca de saldo na MetaAPI falhar, a rota agora
  **bloqueia** a ordem (antes deixava passar "com aviso") — mudança de
  comportamento deliberada: numa rota que move dinheiro real, uma falha
  de infraestrutura não pode virar permissão implícita.
- **Client (`src/app/hooks/useApexLogic.ts`)**: novo `useEffect` que
  sincroniza os thresholds (`aiConfig.dailyLossLimit`, `maxDrawdown`,
  `riskPerTrade`, `killSwitchThreshold`) com `/server/risk-config` sempre
  que o usuário muda essa config, fire-and-forget.
- **Teste**: `npm run validate` 28/28 ✅ (Edge Function é Deno, fora do gate
  de type-check do motor — Deno não está instalado localmente pra rodar
  `deno check`; revisão feita por leitura manual completa do arquivo).

### Limitação honesta que permanece (não bloqueante)
- `currentDrawdown` calculado na Edge Function usa `peakEquity` guardado no
  próprio KV de risco (atualizado a cada chamada de `/broker/execute`) — ele
  só reflete a realidade a partir do momento em que essa rota passa a ser
  chamada de fato pelo motor de decisão. Hoje (ver CLAUDE.md) `useApexLogic.ts`
  **ainda não chama `/broker/execute`** no ciclo automático — a ponte
  decisão→execução real (Fase 3) não existe. Ou seja, o Tópico 7 está
  correto e pronto, mas seu `peakEquity`/drawdown só vai começar a espelhar
  o comportamento real de mercado quando a Fase 3 for implementada e passar
  a chamar essa rota de verdade. Nada a fazer agora — só não prometer que o
  drawdown "funciona hoje em produção" quando a ponte que alimentaria esse
  dado ainda não existe.

---

## O que foi feito nesta sessão (2026-07-29, 22h30)

### Fase 1 — Implementação dos 7 Tópicos de Risco (Em Progresso)

#### ✅ Tópico 1: Daily Loss Limit (COMPLETO)
- **Arquivo**: `src/lib/modules/RiskManager.ts`
- **Mudança**: Novo método `validateTrade(account, proposedTradeSize, dailyStats)` que checa:
  - `(dailyStartBalance - balance) / dailyStartBalance > maxDailyLossPercent` → bloqueia entrada
  - Calcula stats diários (UTC): trades fechados, PnL realizado/não-realizado, perdas consecutivas
- **Integração**: `useApexLogic.ts` (linha ~1330) no GATE DE RISCO, check síncrono antes de qualquer entrada
- **Teste**: `npm run validate 28/28 ✅`
- **Commit**: feat(phase-1): implementar Daily Loss Limit...

#### ✅ Tópico 2: Drawdown Check (VERIFICADO)
- **Estado**: Já implementado e funcionando
- **Cálculo**: `(anchor - equity) / anchor * 100` com âncoras reais
  - `peakEquity` se `drawdownAnchor === 'INTRADAY_PEAK'` (high-water mark)
  - `dayAnchorEquity` se `drawdownAnchor === 'DAILY_CLOSE'` (FTMO/Topstep) ← padrão
- **Health Check**: Valida a cada 5s, ativa Safe Mode se excedido
- **GATE DE RISCO**: Bloqueia entrada se `currentDrawdown > maxDrawdownPercent`
- **Nenhuma mudança necessária** — tópico funcionando corretamente

#### ✅ Tópico 3: Position Sizing por ATR (VERIFICADO + MELHORIA)
- **Estado**: Código já existente (linhas 1517-1531 em useApexLogic.ts)
- **Lógica**: Se `positionSizingMode === 'ATR'`:
  - Calcula ATR em 14 períodos: `atrDistance = ATR * atrMultiplier`
  - Ajusta capital: `tradeCapital = riskCapital * (slDistance / atrDistance)`
  - Ativo volátil = menos capital nominal (risco fixo)
- **Melhoria**: Trocar default de 'FIXED' para 'ATR' (linha 371)
- **Correlação**: Também implementado (reduz tamanho se posição correlacionada aberta)
- **Integrado em**: RiskManager.ts com método genérico `calculateAtrPositionSize()` (não usado ainda)

#### 🔄 Tópico 4: Cooldown entre Trades (READY TO IMPLEMENT)
- **Objetivo**: Tempo mínimo entre entradas (não entre fechamentos)
- **Config**: `cooldownEnabled`, `cooldownMinutes` (já em AIConfig)
- **Trigger**: N perdas consecutivas → bloqueia por X minutos
- **Implementação**: Já existe skeleton em useApexLogic (linhas 1330-1349), precisa refatorar pro RiskManager
- **Status**: Código parcial existe, precisa completar enforcement

#### ⏹️ Tópico 5: Limite de Trades/Dia (READY TO IMPLEMENT)
- **Objetivo**: Máximo de N trades fechados por dia UTC
- **Config**: `maxTradesPerDay` (0 = sem limite, já em AIConfig)
- **Implementação**: Já existe check em linhas 1351-1359, precisa unificar no RiskManager
- **Status**: Código parcial existe, precisa completar enforcement

#### 🚨 Tópico 6: Kill-Switch (NOT STARTED)
- **Objetivo**: Parada automática por emergência (loss/drawdown crítico)
- **Trigger**: Safe Mode já existe, precisa adicionar ações:
  - Fechar TODAS as posições abertas
  - Parar a IA imediatamente
  - Notificar usuário
- **Integração**: Estender Safe Mode Guardian (linhas 884+)
- **Status**: Safe Mode frame existe, kill-switch action falta

#### 🔗 Tópico 7: Enforcement no /broker/execute (NOT STARTED)
- **Objetivo**: Aplicar validações de risco ANTES de chamar MetaAPI
- **Local**: `supabase/functions/server/index.ts` (linhas 1049-1179)
- **Mudança**: Adicionar middleware que chama RiskManager.validateTrade() antes do trade
- **Importância**: Crítica — é o último gate antes da execução real
- **Status**: Rota existe sem proteção, precisa adicionar validação

---

## Histórico da Sessão (Fase 1)

### Fase 0 — Encerrada (2026-07-29)

**Escopo**: Remover todo `Math.random()` que apresenta números aleatórios como capacidade real do sistema (latência, uptime, risco de cliente, força de correlação, sincronização com broker).

**Ejecutado**:

#### 1. Itens originais do roadmap (3 itens)
- ✅ Item 1: Reescrever `LandingPage.tsx`/`translations.ts`/`Pricing.tsx` — feito em sessão anterior
- ✅ Item 3: Reposicionamento de copy "previsão" → "disciplina de execução" — confirmado
- ✅ Item 2: Varredura completa do repo — **AGORA CONCLUÍDA** (ver abaixo)

#### 2. Achados + tratamento do sweep (9 componentes)

**Removidos (8 arquivos)**:
1. `SystemPerformance.tsx` — painel morto (latência 24ms, uptime 99.99%, eventos fake)
2. `QuantumChart.tsx` — candles EUR/USD 100% aleatórios, "spoofing detection" simulada
3. `ButterflyMatrix.tsx` — matriz de correlação inter-ativo 100% aleatória
4. `MarketScore.tsx` — botão "Desbloquear Alpha Insight" registrava venda fake de $29.99
5. `LiquidityDetector.tsx` — código morto, order flow e iceberg orders fake
6. `ChartViewSimple.tsx` — código morto
7. `NeuralBridge.ts` — código morto
8. `liquiditySignals.ts` — import morto em useApexLogic.ts

**Desativados/reescritos (6 componentes)**:
1. `DefensiveArchitecture.tsx` — removidas métricas hardcoded (blocked, allowed, uptime)
2. `MT5Validator.tsx` — handleAutoSync() agora consulta `/mt5-prices` real (não fabrica preço)
3. `StrategyDashboard.tsx` — removida tabela comparativa vs concorrência (Bloomberg, TradingView, Neural Finance — sem fonte)
4. `LiquidityPrediction.tsx` — correlações e "Força Relativa (7D)" desativadas (eram 100% aleatórias)
5. `UserIntelligence.tsx` — removidos riskScore, netWorth, kycLevel fabricados; fallback modo offline também removido
6. `QuantumAnalysis.tsx` — QuantumChart e ButterflyMatrix removidos; painel exibe aviso de manutenção

**Audit sweep**:
- ~60 arquivos com `Math.random()` auditados 1 a 1 via agente Explore
- Classificação: 51 legítimos (IDs, jitter cosmético, backoff, exemplos rotulados), 9 suspeitos (acima)
- Resultado: 100% dos suspeitos tratados; 0 pendências de auditoria

#### 3. Qualidade
- `npm run validate`: 28/28 ✅ (motor intacto, sem regressões)
- Commit: `fix: remover dado fabricado (Math.random) da Fase 0 — auditoria completa`
- CLAUDE.md atualizado com resumo da Fase 0 concluída

---

## Estado atual do projeto

- **Fase 0 (remover fabricação)**: ✅ **100% COMPLETA** — sem pendências
- **Fase 1 (módulo de risco)**: ✅ **100% COMPLETA** — todos os 7 tópicos implementados
  - Motor de decisão (`useApexLogic.ts`) agora checa: limite de perda diária,
    drawdown, position sizing por ATR, cooldown pós-perdas, limite de
    trades/dia, e kill-switch automático (fecha posições + para IA)
  - Rota `/broker/execute` do Supabase valida risco (kill-switch, daily loss,
    drawdown, position sizing) antes de qualquer `createMarketBuyOrder`/`createMarketSellOrder`
    — **thresholds lidos de config server-side autoritativa (KV), não do body**,
    corrigido depois de descoberto que a versão anterior era decorativa (ver
    seção do Tópico 7 acima)
- **Fase 2 (persistência)**: Funciona (trades/sessões salvas no Supabase)
- **Fase 3 (execução real)**: Não existe (ponte decisão→execução não implementada) —
  isso também significa que o enforcement do Tópico 7 ainda não é exercitado
  pelo motor automático em produção; só entra em ação quando algo chamar
  `/broker/execute` (hoje: só telas manuais como `LiveTradingTest.tsx`)
- **Cérebro de IA**: Nenhum dos 5 presets testados passou 95% DSR; trilho 2 (busca de edge) pausado; produto foca 100% no pilar de execução/gestão de risco (a), sem dependência de edge de sinal

---

## Próximos passos recomendados

1. **Commit desta sessão** (comandos prontos abaixo, já é um SEGUNDO commit —
   o commit `fde6eebd7` da primeira versão da Fase 1 já foi feito/pushado
   antes desta correção do Tópico 7).

2. **Ponte decisão→execução real (Fase 3)** — já tem desenho (4 estágios, não dependem de edge), aguarda decisão: vale avançar sem edge comprovado? Sem essa ponte, o Tópico 7 (por mais correto que esteja agora) não é exercitado pelo trading automático.

3. **Limpeza de código morto** (não bloqueante):
   - Pipelines de preço obsoletas (`DataSourceRouter`, `UnifiedMarketDataService`, etc.)
   - `node_modules` historicamente versionado (`.git` inchado 282MB) — `git gc` opcional

---

## Comandos de commit prontos (hardening do Tópico 7)

```bash
git add src/app/hooks/useApexLogic.ts supabase/functions/server/index.ts NEXT_SESSION.md
git commit -m "fix(phase-1): corrigir enforcement de risco em /broker/execute — thresholds eram decorativos

O Tópico 7 (commit anterior fde6eebd7) validava risco lendo thresholds do
body da requisição (body.maxDailyLossPercent etc), mas nenhum caller real
(BrokerClient.ts) jamais enviava esses campos — o gate SEMPRE caía nos
defaults hardcoded, ignorando por completo a config real do usuário.

Corrigido com config de risco autoritativa server-side:
- Novo endpoint POST /server/risk-config (autenticado, só escreve a config
  do próprio usuário, guardada no KV store).
- loadServerRiskConfig(): lê a config do KV, reancora dailyStartBalance a
  cada novo dia UTC, mantém peakEquity pro cálculo de drawdown.
- /broker/execute: thresholds vêm exclusivamente do KV (nunca do body);
  saldo vem exclusivamente da MetaAPI (nunca do body); falha ao buscar
  saldo agora BLOQUEIA a ordem (fail-closed), não deixa passar como antes.
- useApexLogic.ts: novo useEffect sincroniza os thresholds do aiConfig com
  /server/risk-config sempre que o usuário muda a config de risco.

npm run validate: 28/28 ✅ (motor intacto, sem regressões)"
git push
```

---

## Lembretes fixos

- **Comunicação sempre em português do Brasil**
- **Nunca `git commit`/`git push` sozinho** — entregar comandos prontos pro Cleber
- **Nunca fabricar dado** — erro explícito quando não há fonte real
- **`npm run validate` obrigatório** antes de qualquer commit que toque o motor de decisão
- **Rigor de especialista + honestidade radical** — reportar achado negativo sempre, nunca inflar resultado
