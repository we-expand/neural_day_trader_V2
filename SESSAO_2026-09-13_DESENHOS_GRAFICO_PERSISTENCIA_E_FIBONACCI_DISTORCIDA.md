# Sessão 2026-09-13 — Desenhos do Gráfico: persistência entre abas e Fibonacci distorcida ao trocar timeframe

## Pedido do Cleber

Expansão de Fibonacci (e desenhos manuais em geral) não persistia:
1. Ao navegar entre abas da plataforma (Gráfico → Dashboard → Gráfico).
2. Ao trocar de timeframe no próprio Gráfico.
3. Quando persistia, às vezes aparecia "invertida, indo pro lado completamente errado".
4. Clicar num desenho restaurado não abria o menu de configuração (Mover/Estilo/Travar/Apagar).

Todos os 4 pontos são bugs reais distintos, corrigidos nesta sessão. Nenhum testado ao vivo (dev local exige login) — comandos de commit entregues ao Cleber, nenhum rodado ainda.

## Causa raiz #1 — sumia ao navegar entre abas

`userDrawingsSnapshotRef` (snapshot dos desenhos do usuário, usado pra sobreviver a troca de timeframe/símbolo desde 2026-08-31) é um `useRef` — só sobrevive **dentro da mesma montagem** do `ChartView`. Ao navegar pra outra seção da plataforma, o componente desmonta de verdade (é uma SPA com `switch/case`, ver `App.tsx`) e o ref morre junto, mesmo com o mecanismo de snapshot/restauração já existindo.

Fix: reaproveitado o mesmo `sessionStorage` que já protege indicadores/timeframe (`useChartSessionState.ts`) — campo novo `userDrawings` em `ChartTemplateConfig`. Ao desmontar, o snapshot (já capturado antes do `dispose()`) também é gravado no `sessionStorage`; ao montar de novo, se o ref nascer vazio (montagem nova de verdade), semeia com o que veio do `sessionStorage` antes do bloco de restauração rodar.

Arquivos: `src/app/hooks/useChartTemplates.ts`, `src/app/components/ChartView.tsx`.

## Causa raiz #2 — sumia ao trocar de TIMEFRAME (dataIndex inválido)

O mecanismo de restauração (desde 08-31) recriava o overlay reaproveitando o `dataIndex` (posição do candle no array) capturado do dataset ANTIGO. `dataIndex` só corresponde ao mesmo instante de tempo quando o dataset não muda de granularidade (troca de símbolo mantendo o timeframe — único caso já testado antes). Ao trocar de timeframe, o número total de candles muda inteiramente; um `dataIndex` de milhares (comum em timeframe mais granular) não existe no array novo, menor, e a klinecharts não desenha a figura — silencioso, sem erro. Uma extensão de Fibonacci (3 pontos espalhados por um movimento inteiro) estoura esse limite quase sempre; um trendline entre 2 candles recentes às vezes escapa por coincidência.

Fix: ao recriar, descarta o `dataIndex` velho e manda só `timestamp`+`value` — a klinecharts recalcula o `dataIndex` certo contra o dataset novo (confirmado lendo `node_modules/klinecharts/dist/index.esm.js`: `Point` nativo já carrega `{dataIndex, timestamp, value}`, e o desenho em tela prioriza recalcular via timestamp quando presente).

## Causa raiz #3 — `chart.removeOverlay()` sem argumento apagava o que acabou de ser restaurado

Existia uma limpeza de "bolinha preta misteriosa" (`chart.removeOverlay()` **sem argumento**, apaga TODOS os overlays) rodando **depois** do bloco que recria os desenhos do usuário, no mesmo ciclo de `fetchData`. A Fibonacci era restaurada e imediatamente apagada de novo antes do usuário sequer ver.

Fix: mesma limpeza movida pra **antes** do bloco de restauração (limpa o resíduo do chart antigo antes de recriar os desenhos no chart novo, não depois). De carona: `userDrawingsSnapshotRef` agora é limpo depois de usado — sem isso, `fetchData` (chamado de novo a cada refresh de 30s) recriava os MESMOS desenhos por cima a cada ciclo (duplicata acumulando).

## Causa raiz #4 — "invertida"/distorcida por janela de candles diferente entre timeframes

`fetchCandles(symbol, timeframe)` sempre busca uma quantidade FIXA de candles (default 200), independente do timeframe. 200 candles de 1 minuto cobrem ~3h de histórico real; 200 candles de 1 dia cobrem ~200 dias. Um desenho feito num timeframe de janela larga, ao trocar pra um timeframe mais estreito, tem pontos com timestamp **anterior ao candle mais antigo carregado** no dataset novo — a klinecharts clampa esse ponto pro candle mais antigo disponível (`binarySearchNearest`), uma posição arbitrária. Com 3 pontos (A/B/C), 1 ou 2 ficarem presos nessa borda distorce a forma inteira, podendo parecer "espelhada"/do lado errado mesmo a matemática da extensão (direção dos níveis) estando correta.

Fix: antes de restaurar, verifica se algum ponto salvo é mais antigo que o candle mais antigo já carregado — se for, busca candles extras (mesmo símbolo/timeframe, limite calculado a partir do gap real em ms via `timeframeToMs`) só o suficiente pra cobrir esse ponto. Teto de segurança: 5000 candles, nunca dispara busca desproporcional.

## Causa raiz #5 — clique no desenho restaurado não fazia nada

O `onClick` (que trata seleção + abre o menu de Mover/Estilo/Travar/Apagar, ver fix de 2026-08-31 "Menu de desenho preso no gráfico") só era anexado na criação ORIGINAL via toolbar — a recriação no bloco de restauração nunca passava esse handler. Depois de trocar de timeframe, clicar num desenho restaurado (Fibonacci incluída) não selecionava nem abria menu nenhum.

Fix: handler extraído pra função reutilizável `buildDrawingOnClickHandler(overlayName)`, usada nos dois lugares que criam overlay (criação via toolbar e recriação no restore).

## Estado

Todos os 5 fixes no mesmo arquivo (`ChartView.tsx`) + `useChartTemplates.ts`, prontos, `tsc --noEmit` limpo (631 erros antes e depois, mesmo ruído pré-existente documentado no CLAUDE.md — "Stocks US/BR/EU/UK" e afins — nenhum erro novo introduzido). **Pendente real**: `git commit` (comandos entregues em 3 partes ao longo da sessão, nenhum rodado ainda pelo Cleber) + confirmação visual ao vivo (desenhar Fibonacci, trocar de timeframe, navegar entre abas, clicar no desenho restaurado).
