# Sessão 2026-08-04 — Múltiplas instâncias do mesmo indicador (médias móveis)

## Bug reportado

Clicar N vezes no banner de um indicador (ex: "MA - Média Móvel Simples") no
modal "Indicadores" deveria inserir N instâncias distintas no gráfico, cada
uma configurável depois pela própria engrenagem do indicador direto no
gráfico. Não estava funcionando — clicar 4 vezes não resultava em 4 médias.

## Causa raiz #1 — race condition de estado assíncrono

`activeIndicators` (state React, `Set<string>`) era usado pra decidir "essa
instância já existe?" tanto em `addMALineDirect` quanto em
`addGenericIndicatorInstance`. Em uma rajada de cliques no mesmo tick (antes
do React re-renderizar), cada clique enxergava o state de ANTES do clique
anterior ser aplicado — todos tentavam `chart.createIndicator` pro MESMO
nome no MESMO painel, e a klinecharts recusa isso (`Duplicate indicators`,
ver `IndicatorStore.addInstance` em
`node_modules/klinecharts/dist/index.esm.js:4181`), erro engolido por um
`catch` silencioso. Resultado: só a 1ª linha realmente entrava.

**Fix**: trocar a fonte de verdade de "já ativo?" pelos `ref`s que já
existiam no código (`indicatorPaneIdRef`, `genericIndicatorExtraPaneIdsRef`)
— atualizados de forma síncrona, sem essa corrida. Também criada
`indicatorMASettingsRef` espelhando `indicatorMASettings` (state) pro mesmo
motivo, usada para calcular período/cor da próxima linha.

## Causa raiz #2 — uma instância só, uma engrenagem só

Depois do fix #1, os cliques passaram a inserir as médias no gráfico, mas
todas apareciam bundladas numa ÚNICA instância da klinecharts (`calcParams`
como lista de períodos, `figures` dinâmicos via `regenerateFigures`) — uma
única linha na legenda nativa do gráfico ("MA(20): ... MA(30): ...") com
UMA engrenagem/✕ só pra todas juntas. O Cleber esperava uma engrenagem por
média, pra configurar cada uma individualmente direto no gráfico.

**Fix — instâncias reais via variantes de nome**: a klinecharts recusa 2
instâncias com o mesmo `name` no mesmo painel, mas não se importa com
QUANTAS instâncias de nomes DIFERENTES existem no mesmo painel. Registradas
até `MA_MAX_INSTANCES = 6` variantes por família de média (`MA`, `MA__2`,
`MA__3`... até `MA__6`; mesmo padrão pra `SMA`/`EMA`/`WMA`), todas
compartilhando o mesmo motor de cálculo (`registerMovingAverageIndicator`)
mas com `name` registrado próprio — cada clique agora cria uma instância de
verdade, com sua própria linha/⚙/✕ na legenda.

### Peças novas/alteradas em `src/app/components/ChartView.tsx`

- `MA_VARIANT_KLINECHARTS_NAME(baseName, variantIndex)` — resolve o nome
  registrado da variante (`MA` pra índice 0, `MA__2` pra índice 1...).
- `maInstancesRef: Record<baseId, Array<{instanceId, klinechartsName, paneId}>>`
  — rastreia todas as instâncias reais de cada indicador base.
- `getMASettings`/`applyMASettingsToChart`/`openMAEditor`/`saveMAEditor`
  ganharam parâmetro opcional `instanceId` (default = `indicator.id`, mantém
  compatibilidade com todo código antigo que só conhecia a 1ª instância).
- `addMALineDirect` reescrita: sempre cria uma instância NOVA (nunca mais
  edita/anexa linha numa existente).
- `removeMAInstance` (nova): remove uma instância específica sem afetar as
  outras; se for a última, desliga o indicador por completo.
- `onTooltipIconClick` (clique no ⚙/✕ desenhado pela própria klinecharts):
  agora resolve primeiro se o clique foi numa VARIANTE de média móvel antes
  de cair no fallback antigo (que só resolve a 1ª instância).

### Limitação conhecida (documentada no código, não tratada nesta sessão)

Se o indicador já tem múltiplas instâncias e o usuário troca "No gráfico" ↔
"Painel abaixo" pela pílula de posição (`changeIndicatorPlacement`), só a 1ª
instância sobrevive à reposição — as extras são removidas e não recriadas.
Mesmo padrão de limitação já aceito pras instâncias extras de indicador
genérico (`genericIndicatorExtraPaneIdsRef`, não salvas em template/favorito
também). Caso raro, não tratado por ora.

## Verificação

- `npm run validate`: 100% (gate do motor, não relacionado ao gráfico).
- `npx tsc --noEmit`: nenhum erro novo introduzido nas linhas alteradas.
- Testado ao vivo no navegador (dev server local): 4 cliques no card "MA"
  → `MA(20)`/`MA(30)`/`MA(40)`/`MA(50)` simultâneas no gráfico, cada uma com
  seu próprio ⚙/✕. Removida `MA(30)` isoladamente (as outras 3 continuaram
  intactas). Aberta a engrenagem de `MA(40)` — editor mostrou só essa
  instância (1 linha, período 40), não o bundle de todas.

## Status

Código pronto, **não commitado nem pushado** (regra do projeto: Claude nunca
faz `git commit`/`git push` sozinho aqui). Comandos entregues ao Cleber no
chat da sessão.
