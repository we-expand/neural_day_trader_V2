# Sessão 2026-09-02 (noite) — Gráfico "dando refresh sozinho" na cara do usuário

## Queixa do Cleber

"O gráfico está dando refresh sozinho. Isso não pode acontecer. Ele tem que
ficar parado em tela, sem ficar dando na cara do usuário."

## Causa raiz encontrada

`ChartView.tsx` já tinha um `setInterval` de 30s pra manter os candles
atualizados (auto-refresh, comportamento esperado e necessário). O problema
não era a frequência, era o MÉTODO de aplicar o dado novo: toda chamada de
`fetchData()` — inclusive as automáticas de 30s, não só a primeira carga —
terminava chamando `chart.applyNewData(candles)`.

`applyNewData` é a API da klinecharts pra **substituir o dataset inteiro do
zero**: ela limpa o `ChartStore` internamente (`clear()` +
`resetOffsetRightDistance()`) e reconstrói tudo. Uma sessão anterior
(2026-09-01/02, ver `CLAUDE.md`) já tinha corrigido o sintoma de "perde a
posição de scroll" salvando e restaurando `anchorTimestamp`/`anchorX`/
`barSpace` DEPOIS do `applyNewData` — mas isso não elimina o reset em si, só
o disfarça: o reset acontece, o gráfico redesenha do zero, e só DEPOIS a
posição é restaurada. Esses dois passos não são atômicos, então o reset é
visível — exatamente o "pisca"/"refresh na cara do usuário" que o Cleber
reportou, acontecendo de fato a cada 30 segundos, pra sempre, mesmo sem
nenhuma mudança real de dado relevante (o histórico inteiro é sempre
igual, só a última vela muda).

## Fix aplicado

Em vez de sempre chamar `applyNewData` (reset completo), agora:

- **Primeira carga** desta troca de símbolo/timeframe (dispose+init do
  chart): continua usando `chart.applyNewData(candles)` normalmente — é uma
  criação de dataset de verdade, esperado e sem problema nenhum.
- **Refreshes de 30s seguintes** (mesmo chart, mesmo símbolo/timeframe já
  carregado): usam `chart.updateData(candle)` — a API própria da
  klinecharts feita pra atualização em tempo real de tick/vela em formação.
  `updateData` atualiza a vela em formação (mesmo timestamp) ou anexa uma
  vela nova (timestamp maior), SEM tocar em `ChartStore.clear()`/offset/
  scroll. Resultado: nenhum reset visível, e nem precisa mais do
  save/restore de scroll (que só existia pra disfarçar o reset).

Implementação: 2 variáveis de controle no closure do `useEffect` do chart
(`hasAppliedFullDatasetRef`/`lastAppliedCandleTimestampRef`, resetadas a
cada recriação do chart) decidem qual caminho usar; no caminho incremental,
só as velas com `timestamp >= última aplicada` são reenviadas via
`updateData` (cobre tanto a vela em formação quanto eventuais velas novas
fechadas desde o último fetch).

Arquivo: `src/app/components/ChartView.tsx`, dentro do `fetchData()` do
`useEffect` principal do chart (~linha 5896-5920 depois do fix).

## Verificação

`npx tsc --noEmit`: comparada a lista completa de erros antes/depois —
nenhum erro novo introduzido pelo fix; todo o ruído é o mesmo pré-existente
já documentado no `CLAUDE.md` (`"Stocks US/BR/EU/UK"`, tipos de
`DrawingTool`, `binanceData` não definida em bloco de log morto, etc.),
nada nas linhas tocadas por este fix.

**Não testado ao vivo no browser** — outra sessão do Claude Code já tinha um
dev server rodando nesta mesma pasta durante esta sessão, inacessível pelo
painel de preview deste chat. Pendente: Cleber confirmar visualmente que o
gráfico para de "piscar"/resetar a cada 30s depois de aplicar o commit.

## Pendências (fechadas na 2ª parte desta sessão, ver abaixo)

- Commit pronto, não aplicado (regra do projeto: Claude nunca faz commit
  sozinho aqui) — comando de commit já entregue ao Cleber na mesma
  conversa.
- Validar ao vivo (não feito nesta sessão, ver acima).
- ~~Achado colateral catalogado, não investigado nesta sessão: marcador de
  Trading Signal pode estar se acumulando.~~ Corrigido na 2ª parte abaixo.

## 2ª parte (mesma madrugada) — Cleber reportou que o problema continuava

Depois do fix acima ser aplicado (commit `a34f24a17`), Cleber reportou que
o gráfico continuava "dando refresh sozinho, na cara do usuário". O fix de
`updateData` incremental resolvia o reset do DATASET de candles, mas não
era a única fonte de redesenho a cada 30s — havia uma 2ª causa real,
independente da primeira.

### 2ª causa raiz

Dentro do mesmo `fetchData()` (que roda a cada 30s, não só na 1ª carga),
dois blocos redesenhavam overlays sem necessidade a cada ciclo:

1. **`renderSrOverlays`** (zonas de Suporte/Resistência — as caixas azuis/
   verdes e linhas tracejadas de Order Block): a função sempre fazia
   `srOverlayIdsRef.current.forEach(id => chart.removeOverlay(id))` seguido
   de recriar tudo do zero, mesmo quando as zonas detectadas eram
   exatamente as mesmas do ciclo anterior (o caso comum — Order Blocks só
   mudam quando um nível novo é formado/rompido). Esse clear+recreate
   constante é visível como um pisca das caixas/linhas de S/R a cada 30s —
   a causa real que sobrevivia ao fix de `updateData` incremental (que
   resolve só o reset do dataset de candles, não este overlay separado).
2. **Marcador de "Trading Signal"** (▲ COMPRA / ▼ VENDA): confirmado o
   achado colateral catalogado na 1ª parte — criava um overlay novo com
   `id: signal-${Date.now()}` a cada ciclo sem nunca remover o anterior,
   acumulando indefinidamente (não causa "pisca" mas é lixo visual/memória
   crescente, real e não intencional).

### Fix aplicado (2ª parte)

- `renderSrOverlays` (`ChartView.tsx` ~linha 4750): novo ref
  `srOverlaySignatureRef` guarda a assinatura (ids concatenados, em ordem)
  das zonas atualmente desenhadas. A função agora só remove+recria os
  overlays quando essa assinatura muda de fato — pula o redesenho no caso
  comum (zonas iguais ao ciclo anterior). A assinatura é resetada pra um
  valor sentinela (`'__new_chart__'`) logo após `chartInstanceRef.current =
  chart` (nova instância de chart, troca de símbolo/timeframe), garantindo
  que a 1ª carga sempre desenha de verdade mesmo se por acaso os ids de
  zona colidirem entre símbolos diferentes.
- Marcador de sinal: novo ref `signalOverlayIdRef` guarda o id do overlay
  atual; antes de criar um novo, remove o anterior via
  `chart.removeOverlay(signalOverlayIdRef.current)`. Resetado a `null` no
  mesmo ponto do S/R (nova instância de chart).

Arquivo: `src/app/components/ChartView.tsx`.

### Verificação (2ª parte)

`npx tsc --noEmit`: 417 erros, exatamente a mesma contagem pré-existente
documentada no `CLAUDE.md` ("Stocks US/BR/EU/UK") — nenhum erro novo nas
linhas tocadas por este fix (confirmado via grep pelos nomes dos 2 refs
novos, zero ocorrência na lista de erros).

**Não testado ao vivo** — dev server desta pasta seguia ocupado por outra
sessão do Claude Code durante esta parte também.

### Pendências reais (após a 2ª parte)

- Commit pronto (comando entregue ao Cleber na conversa), não aplicado.
- Validar ao vivo: abrir o gráfico e observar ~1-2 minutos se as caixas de
  S/R e o marcador de sinal param de piscar/acumular depois do commit.
- ~~Nenhum achado colateral novo identificado nesta 2ª parte.~~ Havia uma
  3ª causa, ver abaixo.

## 3ª parte (mesma madrugada) — Cleber reportou de novo, mesmo com os 2 fixes já commitados

Depois dos commits `a34f24a17` e `a2f7f8b70` (dataset incremental + S/R e
sinal sem redesenho), Cleber reportou de novo "o gráfico continua emitindo
de forma automática" / "de forma automatizada". Investigação achou uma
**3ª causa real, independente das duas primeiras**.

### 3ª causa raiz

Dentro do mesmo `fetchData()`, a linha `if (retryAttempt === 0) {
setCandlesLoading(true); setCandlesLoadFailed(false); }` rodava em TODA
chamada com `retryAttempt=0` — e o auto-refresh de 30s sempre chama
`fetchData()` sem argumento (ou seja, `retryAttempt=0` de novo, não é só a
1ª carga). Resultado: o spinner "Carregando candles de {símbolo}..." (a UI
de loading introduzida na sessão de mais cedo do mesmo dia, ver item do
topo do `CLAUDE.md` sobre "gráfico ficava completamente mudo") acendia por
cima do gráfico A CADA 30 SEGUNDOS, mesmo em operação 100% normal, sem
nenhuma falha de verdade — esse é o "refresh na cara do usuário" que
sobrevivia aos 2 fixes anteriores, porque nenhum dos dois tocava neste
spinner (um mexia no dataset de candles, o outro nos overlays de S/R e
sinal).

### Fix aplicado (3ª parte)

`ChartView.tsx` ~linha 5736: o spinner só acende quando
`retryAttempt === 0 && isInitialLoadRef.current` — ou seja, só na primeira
carga de verdade (troca de símbolo/timeframe, chart ainda sem candle
nenhum) ou durante um ciclo de retry depois de falha real (que também zera
`isInitialLoadRef` só depois do 1º sucesso). O auto-refresh de rotina, que
já é 100% silencioso/incremental depois dos 2 fixes anteriores, não aciona
mais o spinner.

### Verificação (3ª parte)

`npx tsc --noEmit`: 37 erros em `ChartView.tsx` fora do ruído de "Stocks
US/BR/EU/UK" — mesma contagem de antes do fix, nenhum nas linhas tocadas
(confirmado via grep pela faixa de linhas 5700-5799, zero ocorrência).

**Não testado ao vivo** — mesmo bloqueio das partes anteriores (dev server
da pasta ocupado por outra sessão).

### Pendências reais (após a 3ª parte)

- Commit pronto, não aplicado — comando entregue ao Cleber na conversa.
- Validar ao vivo: com os 3 fixes juntos, deixar o gráfico aberto por
  alguns minutos e confirmar que não há mais nenhum "pisca"/reset visível
  (nem dataset, nem overlays de S/R/sinal, nem spinner de loading).
- Se o Cleber ainda reportar o problema depois deste 3º fix, há a
  possibilidade real de existir uma 4ª fonte não encontrada ainda — não
  descartar essa hipótese sem checar de novo com o dado real (log do
  console/vídeo do Cleber), em vez de assumir que "já deve estar
  resolvido".
