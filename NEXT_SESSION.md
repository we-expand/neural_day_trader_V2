# Handoff — próxima sessão

> Reescrito em **2026-08-17** (15ª parte — reescrita completa, não empilhada).
> **Regra: este arquivo é handoff da sessão CORRENTE. Reescreva, não empilhe.**

## ▶ COMECE AQUI — o que precisa acontecer, em ordem

1. **Commitar os 3 lotes de mudança pendentes** (comandos no fim). Nada foi
   commitado por mim — regra fixa do projeto.
2. **Fazer os 2 deploys de função** (`ai-runner`), na ordem em que os fixes
   foram descobertos (ver seção "Deploys pendentes" abaixo) — sem Docker
   instalado nesta máquina, então é `npx supabase functions deploy` puro.
3. **Confirmar que o motor duplo (navegador + servidor) parou.** Depois do
   deploy do fix em `useApexLogic.ts` (item 3 do "O que foi feito"), reabrir a
   aba com a IA ligada e checar `ai_decisions` — não deve mais aparecer o
   mesmo símbolo reavaliado 3-5x em poucos segundos (era o sintoma do
   navegador rodando loop próprio em paralelo com o `pg_cron`).
4. **Medir o funil de novo, depois de TODOS os fixes de hoje no ar** — a
   medição feita durante a sessão ficou obsoleta a cada novo bug achado
   (import dinâmico faltando → rate-limit → motor duplo → sizing matemático).
   Query:
   ```sql
   select coalesce(veto_stage,'(EXECUTADO)') as stage, count(*) n
   from ai_decisions
   where session_id = '<sessão ativa>'
   group by 1 order by n desc;
   ```
   Com o fix de sizing (item 4 abaixo) resolvido, `MIN_TRADE_SIZE` deve sumir
   do topo. Se `ENTRY_EXECUTED` continuar em zero mesmo assim, o próximo
   suspeito é `MARKET_MODE_MISMATCH` (regime `INDEFINIDO` vs modo "Trend"
   travado) — decisão de produto do Cleber, não bug.

## O que foi feito nesta sessão (ordem cronológica real)

**Contexto inicial**: Cleber reportou a IA ligada em dia de mercado forte
(BTC, cacau +3%, ZEC +4%) sem nenhuma entrada, com o painel mostrando
"TENDÊNCIA DE ALTA / COMPRA 61 / ADX 34" ao mesmo tempo. Pediu redesenho:
mais liberdade pra entrar, cesta maior, opções de API sem rate-limit.

### 1. Onda 1 — motor de decisão (commitada e no ar, `7f8f3717a`/`a60680833`)

Causa raiz original: **o painel mede ESTADO, o motor exigia EVENTO** — AND
binário de cruzamento no candle exato, nunca dispara em tendência já
estabelecida. Corrigido:
- Score contínuo (`evaluateStrategyScoreBothSides`) substitui o AND binário —
  piso configurável `aiConfig.signalScoreFloor` (100 = comportamento antigo).
- Perna short nos 5 presets (motor ao vivo só — backtest segue long-only de
  propósito, ver comentário em `types/strategy.ts`).
- Ranking substitui sorteio (`Math.random()` por tier saiu).
- Cesta padrão 2 → 39 ativos (`config/defaultBasket.ts`).
- Dois bugs de custo: classe vinha de mapeamento de 81 símbolos sobre
  catálogo de 480 (XBNUSD 7,8x inflado, sozinho 312/562 vetos de
  `COST_GATE`); denominador do gate usava ATR de 1 barra em vez do alvo real
  de 3,75×ATR.
- Gate: 227 → 265 asserções.

**Resultado medido em produção depois do deploy**: `NO_SIGNAL` caiu de 100%
das avaliações pra ~0% — a causa raiz original está confirmadamente corrigida.
Mas isso só revelou a fila de bugs abaixo, um atrás do outro.

### 2. Import dinâmico faltando no import map do runner (commitado, `aa23dd035`)

Ao trocar o alias curinga `"@/": "../../../src/"` do `deno.json` por entradas
exatas (fix anterior, do erro 413 de deploy), a extração da lista usou uma
regex que só pegava `import ... from '@/...'` — perdeu
`@/app/services/RealMarketDataService.ts`, importado via `await import(...)`
(dinâmico, sem `from`). `deno check` passou mesmo assim (checagem de tipo não
resolve import dinâmico com o mesmo rigor). Resultado em produção: busca de
preço via REST falhava pra quase todo ativo (só WebSocket de cripto
escapava) — 141 `ANALYSIS_ERROR` em 12 minutos de sessão real. Corrigido:
regex nova cobre `from` E `import(`, mais uma verificação cruzada que compara
todo import `@/` do grafo contra o `deno.json` (roda em ~1s, deveria virar
hábito antes de qualquer deploy do runner).

### 3. Motor duplo — navegador + servidor rodando a mesma sessão (commitado)

Achado com evidência direta: mesmo símbolo (XAUUSD, GER40, SPX500)
reavaliado 3-5x em 18 segundos — não é o `pg_cron` (roda 1x/min). O
navegador (`useApexLogic.ts`) tinha seu próprio `setInterval` de decisão,
sem NENHUMA trava contra o runner de servidor — sobra de antes do runner
existir, não desenho proposital (confirmado no código, sem flag de exclusão
mútua em lugar nenhum). Consequência: dobrava a carga na MetaAPI
compartilhada, e risco real de entrada duplicada (cada processo só via o
`activeOrders` da própria memória). Corrigido: em modo DEMO, o navegador não
abre mais posição por conta própria — só o runner decide. LIVE não foi
tocado (ponte de execução real tem estágios opt-in próprios, fora de
escopo).

Bug lateral achado no processo: `MIN_TRADE_SIZE` também não estava mapeado
em nenhuma das DUAS tabelas de tradução veto→funil (navegador e runner), e o
navegador não tinha a proteção contra entrada faltando que o runner já
tinha — gerava uma chave literal `"undefined"` em `stage_counts`,
mascarando o motivo real. Corrigido nos dois lados + migration pra
`ai_decisions_veto_stage_check` (rodada pelo Cleber com sucesso).

### 4. Bug de sizing — causa real dos "10 dias sem entrada" (commitado)

Log do BTCUSD (sinal BUY, 80% de confiança, mercado subindo 1,6% no dia):
`Nocional calculado ($0.56) abaixo do mínimo executável ($10)`. Matemática
exata: capital $100 × risco 1,5% = $1,50 de risco em dinheiro; modo "Ajustado
por ATR" com multiplicador 4,0x reescala isso por `1,5÷4,0 = 0,375`
(1,5 = `STOP_ATR_MULTIPLIER` fixo no motor) → **$0,56, sempre abaixo de $10,
pra qualquer ativo** — não depende de sinal, mercado, ou nada que essa sessão
mexeu. Essa razão é asset-independent (o ATR se cancela na conta), o que
tornou possível construir uma prévia client-side exata sem dado de mercado.

**Correção do Cleber, na tela**: baixou o Multiplicador ATR de 4,0x pra
1,5x. **Correção de produto (código, esta sessão)**:
- `previewPositionSizing()` (`services/strategy/positionSizingPreview.ts`) —
  card no modo Avançado mostrando o tamanho estimado em tempo real, com
  aviso vermelho quando a config nunca vai operar.
- Modo "Simples" tinha o MESMO bug latente: `applyRiskProfile()` não
  resetava `positionSizingMode`/`atrMultiplier` ao trocar de perfil — se o
  usuário tivesse passado pelo Avançado antes, a config perigosa
  sobrevivia por baixo mesmo num perfil "seguro". Corrigido: todo perfil
  Simples agora força `atrMultiplier: 1.5` (razão neutra).
- Banner de aviso fixo no topo do modo Avançado.
- `STOP_ATR_MULTIPLIER`/`RISK_REWARD_MULTIPLE`/`MIN_EXECUTABLE_NOTIONAL_USD`
  exportados do motor (`runTradingCycle.ts`) em vez de duplicados na UI —
  mesma disciplina que já existe pro `pointValue` (bug de 2026-08-05).

### 5. Mitigação de rate-limit (commitada)

Medido: `mt5-candles-history` (motor) fez 5.942 chamadas em 35min contra
3.838 de `mt5-prices` (rodapé) no mesmo período — buckets de rate-limit
diferentes na MetaAPI, o motor bate no teto pesado. Corrigido:
`ASSETS_REFRESHED_PER_TICK` 6→3, e falha de fetch agora entra em backoff
real (respeita `retryAfterMs` da MetaAPI quando disponível, 30s de piso
senão) — antes, uma falha era retentada no tick seguinte sem espera nenhuma.
**Mitigação, não solução**: a conta continua compartilhada com outros
usuários da plataforma.

### 6. Banner "IA travada" — item 1 do plano de proteção de produto (commitado)

Motivação: qualquer combinação futura de configs pode travar 100% das
entradas silenciosamente (como o item 4 acima) — sem alerta, um usuário raiz
não-técnico pode ficar dias "ligado" sem saber, e simplesmente sumir da
plataforma sem reclamar. `useAIStuckDetector.ts` lê `ai_funnel_snapshots` da
sessão `RUNNING` do usuário (busca no banco, não em estado do React — evita
repetir a confusão do item 3) e detecta quando um único `vetoStage` domina
≥70% das avaliações (piso de 30 avaliações, janela de 20min, sem
`ENTRY_EXECUTED`). `AIStuckBanner.tsx` mostra o motivo em português + uma
sugestão de ação (8 motivos mapeados). Renderizado no topo do Dashboard.

Itens 2/3 do plano original de 3 pontos (validação instantânea no slider,
modo Simples pré-validado) **já foram feitos como parte do item 4** acima —
o plano de 3 itens colapsou pra 2 entregas reais.

## Deploys pendentes (Cleber precisa rodar, nesta ordem)

Sem Docker nesta máquina — `supabase functions deploy` usa o bundler
sem-Docker, que precisa do `deno.json` com entradas exatas (não curinga) ou
sobe a pasta `src/` inteira (já mordeu 2x: erro 413 de tamanho, depois
import dinâmico faltando na lista). Antes de qualquer deploy do runner,
rodar a verificação cruzada:
```bash
cd supabase/functions/ai-runner && deno info --json index.ts > /tmp/di.json
# comparar contra deno.json — ver runTradingCycle.ts/deno.json pro script exato usado hoje
```

```bash
# 1. Fixes do motor duplo + telemetria (item 3)
git add src/app/hooks/useAIPersistence.ts src/app/hooks/useApexLogic.ts src/app/services/AITradingPersistenceService.ts src/app/services/telemetry/FunnelTelemetry.ts supabase/functions/ai-runner/lib/persistence.ts
git commit -m "fix: desliga loop de decisao do navegador em DEMO (so o runner de servidor decide) + completa mapeamento MIN_TRADE_SIZE na telemetria"

# 2. Prévia de sizing + fix do modo Simples (item 4)
git add src/app/services/strategy/runTradingCycle.ts src/app/services/strategy/positionSizingPreview.ts src/app/components/AITrader.tsx
git commit -m "feat: previa de tamanho de posicao no modo avancado + modo Simples reseta atrMultiplier ao trocar perfil"

# 3. Banner de IA travada (item 6)
git add src/app/hooks/useAIStuckDetector.ts src/app/components/dashboard/AIStuckBanner.tsx src/app/components/Dashboard.tsx
git commit -m "feat: banner de alerta quando a IA esta ligada mas travada por um motivo dominante de veto"

git push

# Deploy da função (só o commit 1 toca o runner; 2 e 3 são frontend puro,
# não precisam de supabase functions deploy — só do push + merge pra main)
npx supabase functions deploy ai-runner --project-ref wyvdsxtcmizettljxtbg --no-verify-jwt
```

Depois: **merge `dev` → `main`** pra tudo isso valer no site de produção
(Vercel só builda a partir de `main`) — ainda não feito, decisão do Cleber
sobre quando.

## Verificação desta sessão

- `npm run validate`: verde em cada mudança (265 asserções, suítes
  inalteradas desde a Onda 1 — os fixes de hoje depois da Onda 1 foram todos
  em camada de driver/UI/telemetria, não no núcleo do motor coberto pelo
  gate).
- `tsc --noEmit` full: comparado passo a passo a cada mudança via diff
  contra a baseline anterior — **zero erro novo em nenhum dos 4 commits**
  pendentes (578 erros pré-existentes, constantes).
- `deno check` do runner: limpo depois de cada mudança que tocou o motor
  compartilhado.
- **Verificação visual no navegador NÃO feita** (porta 5173 ocupada por
  outra sessão o dia inteiro) — os 3 componentes novos (`AIStuckBanner`,
  o card de prévia em `AITrader.tsx`, o aviso do modo Avançado) merecem uma
  conferência visual rápida do Cleber depois do deploy.

## Estado herdado, sem mudança nesta sessão

- `COST_TABLE.INDEX` usa spread calibrado no US30, gerando custo ~7x maior
  que o real pra SPX500 só por diferença de escala do índice — precisa de
  spread medido por índice pra corrigir, não é assunção segura de fazer sem
  dado. Registrado, não corrigido.
- Feed de dados dedicado (Twelve Data, ~US$29/mês, cobre o orçamento de
  chamadas com folga) — números já levantados em handoff anterior, decisão
  do Cleber ainda pendente. A mitigação do item 5 reduz a urgência mas não
  substitui a decisão.
- `MARKET_MODE_MISMATCH` (regime `INDEFINIDO` vs modo "Trend" travado) pode
  virar o próximo gargalo dominante depois que `MIN_TRADE_SIZE` sair do
  caminho — decisão de produto (manter travado vs Automático), não bug.
- Roteamento de cripto (Binance direto vs MetaAPI) — decisão do Cleber ainda
  pendente, ver CLAUDE.md item 3.
- Marketplace.tsx com rating/reviews/vendas fabricados (exceto `strat-001`).
