# Sessão 2026-08-28 — Bug da linha de posição sumindo (gráfico + Dashboard) e verificação do Cérebro Sombra

## Contexto

Cleber reportou que a posição de Solana, aberta e ativa no momento, sumiu
do gráfico logo depois dos fixes de "piscar" das linhas de entrada/SL/TP
feitos mais cedo no mesmo dia (commits `156b751b6` e `d364221b1`). Também
relatou que a posição no Dashboard ficava aparecendo e desaparecendo a
cada ~30 segundos. Em paralelo, pediu verificação se o Cérebro Analítico
(Modo Sombra) estava de alguma forma abrindo/fechando ordem sozinho.

## Bug 1 — linha de posição some pra sempre após troca de símbolo/timeframe

**Causa raiz**: o fix de "elimina piscar" (`156b751b6`) mudou o desenho das
linhas de entrada/SL/TP de "sempre remove tudo e recria" pra "atualiza a
overlay existente no lugar" (`overrideOverlay`), rastreando quais ids já
existem via `positionOverlayIdsRef` (`ChartView.tsx`). Isso elimina o
piscar de verdade — mas troca de símbolo/timeframe faz a klinecharts rodar
`dispose()+init()` (recria o chart inteiro do zero), destruindo todos os
overlays. O `positionOverlayIdsRef` nunca era limpo nesse recreate, então
o próximo render achava que a linha "já existia" e só chamava
`overrideOverlay` — que não faz nada num overlay que não existe mais no
chart novo. Resultado: a linha soma e nunca mais volta, mesmo com a
posição real continuando aberta no servidor.

**Fix**: reset de `positionOverlayIdsRef.current = []` logo após o
`init(chartId)`, forçando o próximo render a recriar (`createOverlay`) em
vez de tentar atualizar um overlay fantasma.
[ChartView.tsx:5075](src/app/components/ChartView.tsx)

## Bug 2 — posição some e reaparece a cada ~30s no Dashboard e no gráfico

**Causa raiz**: `AITradingPersistenceService.getSessionTrades()` engole
qualquer erro do Supabase internamente (`catch` interno) e devolve `[]` —
indistinguível de "sessão sem nenhum trade real". O `reconcile()` de
`useApexLogic.ts` (roda a cada `POLL_MS` = 30s, e também é disparado pelo
Realtime a cada mudança em `ai_trades`) usava esse `[]` como se fosse "0
posições abertas" e chamava `setActiveOrders([])` — apagando a posição de
verdade da tela até o próximo poll ter sucesso e repopular. Isso bate
exatamente com o padrão relatado: some e volta a cada ~30s, tanto no
gráfico quanto no Dashboard (os dois leem do mesmo `activeOrders`).

**Fix**: dentro do `reconcile()`, a consulta agora é feita direto no
Supabase (sem passar pelo wrapper que engole erro), deixando qualquer
falha propagar pro `catch` que já existe nesse bloco — que corretamente
MANTÉM o estado anterior em vez de tratar erro de rede como "posição
fechada". [useApexLogic.ts:1128](src/app/hooks/useApexLogic.ts)

**Nota**: o wrapper `getSessionTrades` do serviço (que devolve `[]` em
erro) não foi alterado — outros consumidores (`ReportExporter.tsx`,
`AISessionHistory.tsx`, `PerformanceView.tsx`) usam esse fallback de forma
razoável (relatório/histórico, não estado ao vivo). O fix ficou isolado no
único ponto onde erro-vira-zero-trades é perigoso de verdade.

`npm run validate`: 37 asserções OK, 0 falharam. `tsc --noEmit`: limpo.

## Verificação — Cérebro Analítico (Modo Sombra) NÃO está operando sozinho

Pedido do Cleber: confirmar que o cérebro em modo sombra (Fase 0, ativo
desde ontem) não está abrindo/fechando posição por conta própria — seria
gravíssimo, já que o modo sombra é declarado como "nunca decide de
verdade".

Rastreado ponta a ponta:
- `runTradingCycle.ts:463-479` — `onDecisionPoint` só é chamado DEPOIS que
  `result` (decisão mecânica real, já com `tradeOpened` definido) foi
  calculado. Só reporta esse resultado pro logger; nada volta pro loop.
- `decisionBrain.ts:63-113` (`runShadowDecisionAndLog`) — só chama o LLM e
  grava a resposta em `ai_decision_brain_shadow`. Nunca chama
  `openPosition`/`closePosition` nem qualquer efeito de trading.
- `ai-runner/index.ts:526` — chamada é `void runShadowDecisionAndLog(...)`,
  fire-and-forget, o motor real nem espera a resposta.

**Confirmado: nenhum risco.** As ordens abrindo/fechando são só do motor
mecânico normal (que já operava antes da Fase 0); o cérebro sombra
observa e anota "o que teria feito" numa tabela separada, sem poder de
execução — consistente com o que o `CLAUDE.md` documenta.

## Nota lateral — o que é `exit_reason: 'AI_SIGNAL'`

Cleber estranhou ver `AI_SIGNAL` como motivo de saída na tabela de trades
(SOLUSD, 28/08) — não é o cérebro LLM, é o rótulo genérico que o motor
mecânico grava toda vez que `partialClosePosition` (`positionManager.ts`)
fecha uma fração de posição fora do fluxo normal de TP/SL fixo — no caso,
o TP parcial 50% implementado mais cedo no mesmo dia (ver gerenciamento de
saída reforçado, item do topo do `CLAUDE.md`). Antes desse fix só existiam
`TP`, `SL`, `MANUAL` como motivo de saída.

## Pendente

- Commits dos 2 fixes (`ChartView.tsx` + `useApexLogic.ts`) ainda não
  aplicados — comandos prontos entregues ao Cleber, aguardando ele rodar.
- Nenhum outro efeito colateral dos dois bugs foi procurado ativamente
  além do relatado (posição de Solana + Dashboard); se aparecer sintoma
  parecido em outro fluxo (ex: ordens pendentes piscando — ver comentário
  em `ChartView.tsx` sobre `pending_${order.id}` não bater no regex de
  remoção de overlay), vale investigar como possível bug 3 da mesma
  família.
