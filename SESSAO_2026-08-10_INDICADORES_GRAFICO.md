# Sessão 2026-08-10 — Countdown de vela + indicador Contador de Candles

## Pedido do Cleber

1. Contador regressivo de quanto falta pra fechar a vela atual, visível na
   tela do gráfico.
2. Um indicador novo dentro de "Indicadores" que numera as velas do gráfico.

## O que já existia vs. o que foi feito

O countdown (`candleCountdown`) já existia implementado desde antes desta
sessão, mas **nunca aparecia na tela** — bug pré-existente, não percebido
até agora porque não há teste visual automatizado do gráfico. O indicador de
contagem de candles não existia.

## Bug 1 — countdown nunca renderizava (nó DOM órfão)

Causa raiz: o badge do countdown era filho da mesma `<div>` que recebe
`chartContainerRef.current.innerHTML = ''` toda vez que o gráfico
reinicializa (troca de timeframe/símbolo — ver
[ChartView.tsx:4649](src/app/components/ChartView.tsx:4649), comentário
histórico explica que isso existe pra evitar painéis presos em 0x0 depois de
remount). Esse `innerHTML=''` arranca do DOM qualquer filho renderizado pelo
React ali dentro **sem o React saber** — o nó fica "órfão": React segue
atualizando o texto internamente a cada segundo (o `setInterval` do
countdown rodava normalmente), mas o nó nunca mais está de fato na árvore
visível da página.

**Fix**: mover o badge pra fora dessa div (ainda dentro do wrapper
`flex-1 relative`, que não é tocado pelo `innerHTML=''`).

## Iteração de posicionamento

1ª tentativa: grudar o badge na linha pontilhada de preço via
`chart.convertToPixel({ value: currentPrice }, { paneId: 'candle_pane',
absolute: true })`, recalculando a cada tick de preço + `onScroll`/`onZoom`.
Funcionou tecnicamente, mas o Cleber reportou instabilidade — o badge ficava
pulando a cada variação de preço, ruim de ler. **Decisão**: abandonar o
tracking dinâmico, badge fixo logo abaixo da boleta (`OrderTicket`, que fica
em `top-[17px] right-[99px]`) — `top-[142px] right-[99px]`. Estado
`lastPriceLineY` e o `useEffect` de sincronização foram removidos (código
morto depois da mudança de abordagem).

## Bug 2 — indicador "Contador de Candles" registrado mas invisível

Duas tentativas erradas antes de achar a causa raiz real (não foi erro de
digitação nas duas vezes — cada uma revelou uma limitação genuína da
klinecharts):

1. Figure `type: 'bar'`/`'line'` sem `attrs()` customizado → nunca
   desenhava nada (indicador ativo, sem erro no console, mas invisível).
2. Figure `type: 'text'` COM `attrs()` customizado, série `'price'` →
   ainda invisível, e pior: o valor bruto do contador (1..N) entrando no
   cálculo de range do eixo Y do preço (`YAxisImp.calcRange`,
   `index.esm.js:10288` inclui o valor de todo `figure.key` de indicadores
   `'price'` no min/max do eixo) **destruiu a escala de preço** — eixo Y
   virou "40760, 34043, 27327... 231" em vez de valores reais de BTC.
   Corrigido isolando o valor real do contador num campo à parte
   (`label`, fora do sistema de figures) — mas o texto continuou sem
   aparecer.

Causa raiz real do "continuou sem aparecer": o motor de desenho automático
de figura de indicador (`eachFigures`, `index.esm.js:962`) só sabe
posicionar `'circle'`/`'bar'`/`'line'` — o `switch` não tem `case` pra
`'text'`, então `defaultFigureStyles` fica `undefined` e o callback
inteiro (`attrs()`/`styles()`) **nunca é chamado**. Confirmado via log que
nunca disparava mesmo com o indicador ativo. `'text'` não é um tipo de
figura suportado nesse caminho — só em overlays (ferramentas de desenho).

**Fix**: abandonar o sistema de `figures` pra esse indicador e usar o
callback `draw` customizado do indicador (`IndicatorImp.draw`, invocado em
`IndicatorView.drawImp`, `index.esm.js:7894`), que dá acesso direto ao
`ctx` do canvas e ao `xAxis`/`yAxis` já resolvidos. O número de cada vela é
desenhado manualmente com `ctx.fillText`, só nas velas do `visibleRange`
(evita desenhar fora da tela), retornando `true` pra sinalizar "já cobri o
desenho, não precisa do caminho padrão de figures".

## Direção da contagem — 2ª correção depois do primeiro commit

1ª versão contava a partir da vela mais recente pra trás (1 = agora, 2 =
anterior...). Cleber pediu o oposto: **1 = vela mais antiga do histórico
carregado (abertura), crescendo até a vela atual**. Fix trivial —
`label = i + 1` em vez de `total - i`, onde `i` é o índice cronológico
(ascendente) dentro do `kLineDataList`.

## Verificação

Testado no browser (dev local, `localhost:5173`) em ambas as correções:
- Countdown aparece fixo abaixo da boleta, não pula mais com variação de
  preço.
- Números laranja aparecem acima de cada candle, confirmados via
  `getImageData`/contagem de pixel laranja no canvas principal (0 → ~20mil
  pixels depois da correção do `draw`), e visualmente crescendo da esquerda
  pra direita (ex: "8021" → "9040").

`npx tsc --noEmit` sem erros novos nas duas rodadas (todos os erros restantes
são pré-existentes: categorias de ativos tipo `"Stocks US"`/`"Stocks EU"`,
`binanceData` não definida, tipos de estilo do klinecharts — nenhum
relacionado a esta mudança).

## Reset diário da contagem — 3ª correção depois do primeiro commit

Reportado pelo Cleber: BTCUSD virou o dia (novo "% do dia" no dashboard) e o
Contador de Candles **continuou contando a partir do total acumulado do
histórico carregado**, sem voltar pra 1 — comportamento errado pra
**qualquer ativo**, não só BTCUSD. Causa: a contagem usava índice global
(`i + 1` sobre o `kLineDataList` inteiro), sem noção nenhuma de dia de
calendário.

**Fix**: contagem agora reseta a cada mudança de dia (`new Date(bar.timestamp
).toDateString()` comparado entre velas consecutivas). Calculado uma vez
dentro de `calc()` (só roda quando os dados mudam, não a cada frame) e
guardado em `indicator.result[i].label`; o `draw()` (que roda todo frame)
só lê o valor já pronto, sem recalcular. Verificado visualmente arrastando o
gráfico (timeframe 1H) até cruzar a virada 08-09 → 08-10: números que
estavam em ~40-50 (acumulado) voltam pra 1-2-3... logo depois da virada.

## Commits desta sessão (prontos, não aplicados — regra do projeto)

```bash
git add src/app/components/ChartView.tsx
git commit -m "fix: corrige countdown de vela (nó DOM órfão) e indicador Contador de Candles (draw customizado)"
git commit -m "fix: fixa countdown de vela abaixo da boleta em vez de acompanhar linha de preço instável"
git commit -m "fix: inverte direção da contagem do Contador de Candles (1 = abertura, crescente até agora)"
git commit -m "fix: reseta contagem do Contador de Candles a cada novo dia (não acumular entre dias, nenhum ativo)"
git push origin dev
```

(Os 4 commits foram feitos separadamente ao longo da sessão à medida que
cada ajuste foi pedido — mensagens reais já aplicadas localmente, listadas
aqui só como referência do que aconteceu.)
