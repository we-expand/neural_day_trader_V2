# Sessão 2026-09-04 (tarde/noite) — Monitoramento contínuo, fix de R:R, investigação de rate-limit, cesta de fim de semana, abas do Navegador de Ativos

## Como retomar

Esta sessão terminou com o monitoramento do LLM Brain **encerrado a pedido
do Cleber** (não está mais rodando checagem automática) e com pendências
reais de deploy/commit listadas abaixo. Próxima sessão: ler este arquivo +
seção "▶ COMECE AQUI" do `CLAUDE.md`, checar se os commits pendentes já
foram aplicados (`git log`), e perguntar ao Cleber se quer retomar
monitoramento contínuo ou só investigar algo pontual.

## O que foi feito, em ordem

### 1. Monitoramento contínuo de 5/10/15min do LLM Brain (pedido explícito do Cleber: "se vestir de operador + programador + estatístico")

Ciclo de checagens (`ps aux`, `watchdog.log`, tail do `llm-brain.log`)
intercalado com investigação sob demanda. Achados reais:

- **Bug de código real, confirmado ao vivo**: trade NAS100 SHORT abriu com
  stop 0,300% e alvo 0,274% (R:R 0,91:1, pior que 1:1) mesmo com
  `targetPoints=MÉDIO` pedindo 3:1. Causa raiz: quando o stop cai pro
  fallback seguro (`usedFallbackStop=true`, seja por ATR nulo OU por ATR
  real dar um `dynamicStopPct` fora do range mín/máx), o cálculo do alvo
  continuava usando o ATR real minúsculo isolado em vez do fallback.
  Corrigido em `tools.ts` (checar `!usedFallbackStop` em vez de só
  `atrPctForStop != null`). Commit `ef93ab898` **já aplicado**.
- **Achado colateral**: `.env` tinha `MT5_MIN_RR_AFTER_SR_CAP=0.6`, um
  paliativo de 02/09 nunca revertido — a trava final incondicional (criada
  mais cedo no mesmo dia) usava esse valor como piso mínimo de R:R, deixando
  passar R:R até 0,6:1. Revertido pra 1.0 (`.env`, não versionado, já
  aplicado localmente).
- **Confirmado ao vivo, pós-fix**: XETUSD SHORT abriu com R:R 2,35:1;
  SPX500 foi corretamente recusado por R:R < 1,0:1. Fix validado com dado
  real, não só teoria.
- **Composição do prejuízo do dia** (consulta direta em `ai_trades` via
  Supabase): limite de perda diária (25%, prejuízo real 27,29%) veio quase
  todo de 3 trades ruins ANTES do fix, numa janela de 18min (14:02-14:20
  UTC): BTCUSD -$3,62, XETUSD -$5,06, UKOUSD -$8,00. Pós-fix, só 1 trade
  fechado até o momento, comportamento correto (perda pequena e
  proporcional ao R:R desenhado).
- Guardrails confirmados funcionando corretamente (não são achados de bug):
  fechamento manual prematuro bloqueado 2x pelo guard de "≥50% do caminho
  ou 2 fatores técnicos"; limite de perda diária disparou e bloqueou
  entradas até 00:00 Brasília; timeouts transitórios do Ollama local
  (blip de DNS + carga momentânea) se autorresolveram sem intervenção.

### 2. Investigação profunda do rate-limit da MetaAPI (pedido explícito: "pesquisa profunda... solução, mesmo pagando mais")

Relatório completo em
[RELATORIO_2026-09-04_INVESTIGACAO_RATE_LIMIT_METAAPI.md](RELATORIO_2026-09-04_INVESTIGACAO_RATE_LIMIT_METAAPI.md).
Resumo:

- Confirmado contra a **documentação oficial da MetaAPI**: teto de "5
  requisições concorrentes de dado histórico por conta" é fixo, não muda
  com plano pago — pagar mais/conta dedicada NÃO resolve isso
  especificamente.
- Causa raiz real encontrada: 3 rotas do backend (`/mt5-prices`,
  `/mt5-candles`, `/mt5-candles-history`) batiam no mesmo endpoint sem
  nenhum limite de concorrência alinhado ao teto de 5 — `/mt5-prices`
  sozinha já disparava até 8 concorrentes.
- **Corrigido e já commitado/deployado** (commit `8cc89f4e6`, Cleber
  confirmou "comit e deploy feito"): semáforo compartilhado (limite 2) nas
  3 rotas do backend + semáforo do `llm-active-brain` reduzido de 3→2.
- Limite honesto documentado: não é limitador distribuído de verdade (cada
  lado só controla a si mesmo) — se persistir, próximo passo é contador via
  Postgres compartilhado, ou Cleber abrir chamado com a MetaAPI pedindo
  aumento de cota (não garantido).

### 3. Cesta de ativos — tentativa de automação revertida (pedido explícito do Cleber: "não é algo que deva ser mexido, deve ser setado automaticamente pela LLM" → depois corrigido: "cesta é decisão do usuário, não mexer")

- Cesta trocada mais cedo pra 16 criptos (fim de semana) — 6 símbolos novos
  testados ao vivo (TRXUSD, ATMUSD, XLMUSD, FILUSD, BNBUSD, AVAUSD, todos
  reais). `activeAssets` no Supabase atualizado manualmente por mim pra
  refletir isso.
- Tentei automatizar troca WEEKDAY/WEEKEND baseada em horário — **Cleber
  corrigiu em tempo real**: seleção de ativos é decisão do usuário via Setup
  (ele mesmo configura, como fez agora pensando no fim de semana), não algo
  que o código deve trocar sozinho. **Revertido**: `MT5_ASSET_BASKET` voltou
  a ser array único fixo (universo de dia útil, pré-sessão). `tsc --noEmit`
  limpo.
- **Mantido, ajustado**: `isWeekendMode()`/`isForexMarketOpen()`
  (`assetBasket.ts`) e `isWeekendNow()` (`atr.ts`, duplicada de propósito) —
  janela corrigida pra **sexta 18h → domingo 19h, horário de Brasília**
  (antes era sex 19h/dom 20h Brasília — 1h depois do pedido em ambas as
  pontas). Fica como infraestrutura pura (exposta em `regime.isWeekend` no
  `get_mt5_quote`, contexto informativo pro LLM) — **não decide mais nada
  sozinho sobre cesta**. Pronta pra um "modo fim de semana" comportamental
  a ser desenhado numa sessão futura (Cleber: "vamos desenhar" — ainda não
  especificado o que esse modo muda de fato).
- **PENDENTE de commit** (não commitado ainda,
  `llm-active-brain/src/{agent,assetBasket,atr}.ts` modificados): a
  reversão + o ajuste de horário. Comando pronto na seção de pendências.
- **Atenção pra próxima sessão**: `activeAssets` no Supabase ainda está
  configurado pros 16 criptos (decisão do Cleber, dele configurar quando
  quiser trocar de volta pro dia útil — não fazer isso automaticamente).
  `maxAssets`/`maxPositions` também foram subidos de 5→10 (Supabase) a
  pedido do Cleber pra "facilitar entradas" no fim de semana — não reverter
  sem ele pedir.

### 4. Log de Operações — taxa de acerto por dia

[OperationLogs.tsx](src/app/components/admin/OperationLogs.tsx:281) agora
mostra `XX.X% acerto` ao lado do PnL líquido em cada linha de dia agrupado
(mesma fórmula do card "Taxa de Acerto" do topo). `tsc --noEmit` limpo.
Commit `7695e279f` **já aplicado**.

### 5. Navegador de Ativos (InfinoxAssetsBrowser.tsx) — abas + carregamento rápido

- Adicionadas abas de categoria reais (`selectedCategory` já existia no
  código, nunca tinha UI pra trocar — agora tem barra de abas com contagem
  por categoria).
- Achado real de performance: o modal buscava preço/variação do catálogo
  INTEIRO (~220 ativos) de uma vez toda vez que abria, batendo na mesma
  rota `/mt5-prices` sujeita ao rate-limit investigado no item 2 — podia
  levar 15-30s. Corrigido: busca a categoria ATIVA primeiro (rápido), resto
  do catálogo em segundo plano sem travar a tela, cache local de 20s por
  símbolo.
- `tsc --noEmit` limpo. Não testado visualmente (tela atrás de login,
  sem credenciais nesta sessão). Commit `ce9dc3e75` **já aplicado**.

## Pendências reais em aberto

1. **Commit pendente da reversão de cesta automática + ajuste de horário**
   (`llm-active-brain/src/agent.ts`, `assetBasket.ts`, `atr.ts`):
   ```bash
   cd llm-active-brain && git add src/agent.ts src/assetBasket.ts src/atr.ts && git commit -m "$(cat <<'EOF'
   revert(llm-brain): cesta de ativos volta a ser so do usuario, nao automatica

   Tentativa de trocar a cesta automaticamente entre dia util/fim de semana
   por horario foi revertida a pedido do Cleber -- selecao de ativos e
   decisao do usuario via Setup (activeAssets), nao algo que o codigo deve
   decidir sozinho. MT5_ASSET_BASKET volta a ser array unico fixo.

   Mantida a janela de deteccao de "modo fim de semana" (isWeekendMode em
   assetBasket.ts, isWeekendNow em atr.ts) ajustada pro horario pedido
   (sexta 18h -> domingo 19h Brasilia, era sex 19h/dom 20h antes) -- fica
   como infraestrutura pura, exposta como contexto informativo pro LLM
   (regime.isWeekend), sem decidir cesta. Pronta pra um "modo fim de
   semana" comportamental a ser desenhado numa sessao futura.

   Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
   EOF
   )"
   ```
   Depois do commit, reiniciar o processo local (`pkill -9 -f "tsx/dist/loader.mjs src/index.ts"`, watchdog religa sozinho) — ou já está rodando com o código novo desde o restart feito nesta sessão (não precisa repetir se ninguém mexeu depois).

2. **"Modo fim de semana" comportamental ainda não desenhado** — só a
   detecção de horário existe. Cleber disse explicitamente "vamos desenhar"
   — próxima sessão, perguntar o que ele tem em mente antes de implementar
   qualquer coisa (não assumir).

3. **Amostra pós-fix de R:R ainda pequena** (poucos trades desde o fix das
   14:50) — precisa de mais dias rodando antes de qualquer conclusão
   estatística sobre melhora no líquido.

4. `increase_position` (pyramiding) segue sem disparar em ~5 dias — item já
   catalogado no `CLAUDE.md`, não investigado nesta sessão.

## Estado do processo ao final da sessão

- `llm-active-brain` rodando (watchdog ativo, 1 instância confirmada,
  reiniciado por último às 19:27 com a reversão de cesta + ajuste de
  horário, ANTES do commit acima — commit ainda não feito).
- Monitoramento automático (ScheduleWakeup) **desarmado** a pedido do
  Cleber — não está mais rodando checagem de 5/10/15min.
