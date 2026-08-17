# Handoff — próxima sessão

> Reescrito em **2026-08-17** (16ª parte — reescrita completa, não empilhada).
> **Regra: este arquivo é handoff da sessão CORRENTE. Reescreva, não empilhe.**

## ▶ COMECE AQUI — o que precisa acontecer, em ordem

**Contexto**: Cleber ligou a IA por 3 sessões seguidas hoje (14h-20h31 UTC,
incluindo 2 sessões inteiras DEPOIS do deploy dos fixes de sizing/motor duplo)
e teve **zero entradas nas três**, mesmo com os fixes da rodada anterior no
ar. Investigação desta sessão (com dado real de produção, não teoria) achou
2 bugs estruturais novos, mais graves que tudo corrigido antes — ambos no
**valor padrão de sessão nova**, o que explica por que "refazer do zero" 3x
nunca resolveu: todo usuário novo nasce configurado pra nunca operar.

1. **Bug 1 (achado e corrigido nesta sessão): fórmula do modo "Ajustado por
   ATR" (padrão de toda sessão nova) era matematicamente inválida** —
   reescalava o risco em $ por uma razão adimensional entre duas distâncias
   ATR, nunca dividia pelo preço do ativo. Resultado: nocional sempre ~igual
   ao risco em $ bruto (poucos dólares numa conta de $100), sempre abaixo do
   piso de $10, **para qualquer multiplicador ATR, qualquer ativo**. O fix de
   ontem (baixar multiplicador 4,0x→1,5x) só reduziu a magnitude do erro, não
   corrigiu a fórmula — por isso `MIN_TRADE_SIZE` continuou dominante hoje
   (577 vetos numa sessão só, depois do fix de ontem no ar). Corrigido em
   `runTradingCycle.ts` pra usar o mesmo fixed-fractional (Van Tharp) que o
   modo FIXED já usava certo. `positionSizingPreview.ts` reescrito em
   consequência (não dá mais número exato sem preço/ATR real — vira
   qualitativa nos dois modos, como o FIXED já era).
2. **Bug 2 (achado e corrigido nesta sessão): `MARKET_MODE_REGIME_MISMATCH`
   era veto duro**, inclusive quando o Market Score mede regime `INDEFINIDO`
   (o caso mais comum — o Score não tem opinião forte). Com `marketMode:
   'TREND'` sendo o padrão de sessão nova, isso bloqueava quase toda avaliação
   fora de tendência limpa — maior bloqueio do dia nas 2 sessões pós-deploy
   (2.526 vetos combinados). Convertido pro mesmo padrão que a checagem de
   LATERAL já usava: regime `INDEFINIDO` não bloqueia mais (Score sem opinião
   não é motivo pra descartar sinal validado); regime que CONTRADIZ agora
   exige confiança extra (+15 pontos) em vez de vetar sempre.
3. ~~Commitar os 2 fixes acima e fazer o deploy do `ai-runner`~~ — **feito**
   pelo Cleber ainda na mesma sessão (commits `e370b0b3b` e `400c40557`,
   deploy versão 24). Ao ligar a IA de verdade (modo scalp) depois do deploy,
   apareceram **2 execuções reais** (JP225 SHORT, SOLUSD LONG) — primeira vez
   do dia com `ENTRY_EXECUTED` > 0. Confirma que os bugs 1 e 2 eram mesmo a
   causa raiz.
3b. **Bugs NOVOS achados observando essas 2 execuções ao vivo** (mesma
   sessão, corrigidos e já deployados — versão 25 do `ai-runner`):
   - **Bug 3 — `aiConfig.maxContracts` ("Lotes Máximos por Trade") nunca era
     lido no motor ao vivo.** Confirmado com número exato: SOLUSD abriu com
     20,27 lotes calculados, config travada em 0,8 — 25x acima, sem gate
     nenhum barrando. JP225 saiu pequeno (0,05 lotes) só por coincidência de
     preço alto, mascarando o bug até aparecer num ativo barato/volátil.
     Corrigido: teto duro aplicado depois do cálculo de sizing (risco% ou
     ATR), mesmo padrão do piso de $10 já existente — reduz o nocional, nunca
     aumenta. **As 2 posições já abertas antes do fix NÃO foram corrigidas
     retroativamente** (SOLUSD continua com 20,27 lotes até fechar/expirar).
   - **Bug 4 (cosmético, mas na tela principal do Dashboard) —
     `MarketScoreBoard.tsx` somava `order.amount` (exposição em dólar) e
     rotulava como "lotes total"** no card "Posições Abertas" — mostrava
     "4.893,00 lotes total" quando o real era ~20,3. Corrigido pra somar a
     mesma conversão usada por posição individual.
   - **Tela congelada / gráfico "só mostra 1 ativo" — investigado e não é
     bug (na maior parte)**: o congelamento era o polling que já tinha sido
     corrigido antes destes 2 bugs (commit `400c40557`) — confirmado
     resolvido por print do Cleber (P&L se movendo nas 2 posições). O
     gráfico mostrando só o ativo selecionado é comportamento esperado (há
     um banner "posição aberta em X — ver" pra trocar).
   Commits: `git add src/app/services/strategy/runTradingCycle.ts
   src/app/components/dashboard/MarketScoreBoard.tsx && git commit -m "fix:
   teto de lotes maximos nao era aplicado no motor + cabecalho somava dolar
   como se fosse lote"` — **já commitado e deployado pelo Cleber (versão 25)**.
4. **Continuar observando o funil com o dado fresco pós-versão-25** — löop de
   10 em 10 minutos rodando nesta sessão (CronCreate `c997a820`, expira em 7
   dias). Foco: confirmar que a PRÓXIMA entrada em ativo barato/volátil já
   sai com lote correto (≤ 0,8 configurado). Query:
   ```sql
   select coalesce(veto_stage,'(EXECUTADO)') as stage, count(*) n
   from ai_decisions
   where session_id = '<sessão ativa>'
   group by 1 order by n desc;
   ```
   Expectativa: `MIN_TRADE_SIZE` e `MARKET_MODE_REGIME_MISMATCH` devem cair
   muito do topo. Se `ENTRY_EXECUTED` continuar em zero, o próximo suspeito
   pelo volume de hoje é `COST_GATE` (887+750+1235 vetos nas 3 sessões de
   hoje — pode ter componente real do miscalibre de índice já registrado
   abaixo, mas ainda não isolado desta vez).

## Verificação desta sessão (bugs 1 e 2 acima)

- `npm run validate`: verde (265 asserções, mesma suíte).
- `tsc --noEmit` full: 578 erros — igual à baseline pré-existente, zero novo.
- `deno check` do runner: limpo.
- **Verificação visual/funcional em produção NÃO feita** — sem servidor de
  preview disponível nesta sessão. Ligar a IA de verdade e observar
  `ai_decisions` (passo 4 acima) é a única verificação real que falta, e é
  obrigatória antes de considerar isso resolvido — os dois bugs foram
  corrigidos por leitura de código + matemática, não por teste ao vivo ainda.

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

Os 3 commits da rodada anterior (motor duplo, prévia de sizing v1, banner de
IA travada) **já foram commitados pelo Cleber** antes desta sessão começar —
nada pendente deles. O que falta agora é só o commit dos 2 bugs novos (acima)
e o deploy.

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
# Fix da fórmula de sizing ATR + suavização do gate de regime (bugs 1 e 2 acima)
git add src/app/services/strategy/runTradingCycle.ts src/app/services/strategy/positionSizingPreview.ts src/app/components/AITrader.tsx
git commit -m "fix: formula de sizing ATR era invalida (independia do preco) + regime INDEFINIDO nao veta mais entrada"

git push

npx supabase functions deploy ai-runner --project-ref wyvdsxtcmizettljxtbg --no-verify-jwt
```

Depois: **merge `dev` → `main`** pra tudo isso valer no site de produção
(Vercel só builda a partir de `main`) — ainda não feito, decisão do Cleber
sobre quando.

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
