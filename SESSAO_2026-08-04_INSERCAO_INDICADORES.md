# Sessão 2026-08-04 — Inserção de indicadores/médias móveis no gráfico

> Continuação da linha aberta em `SESSAO_2026-08-03_GRAFICO_TEMPLATES_SEGURANCA.md`
> (templates de gráfico, médias com múltiplas linhas). Sessão inteira girou em torno de
> um único fluxo: como o usuário insere mais de uma média/indicador no gráfico pelo modal
> "Indicadores". `npm run validate` passou em 100% das mudanças que tocaram TypeScript.
> Testado ao vivo no navegador local (`npm run dev`, usuário demo) em cada etapa — não
> só `npm run validate`, desta vez com verificação visual real.

## O que está commitado vs. pendente

Tudo desta sessão foi commitado no branch `dev` (o Cleber roda commit/push, regra fixa
do projeto — Claude nunca faz `git commit`/`push` sozinho). Sequência de commits, do mais
antigo pro mais novo:

1. `fcd94e203` — fix: editor de médias móveis/indicadores escondido atrás do modal
   Indicadores (z-index)
2. `7c2585cc1` — fix: clicar no card/banner do indicador ativo abre editor de linhas em
   vez de desligar
3. `52baa8b99` — fix: setup favorito com média móvel salva em formato antigo
   mostrava/salvava período errado no editor
4. `2f4c029ff` — fix: clicar no banner de média já ativa insere outra linha em vez de
   abrir editor vazio (evita substituir a média existente)
5. `742f28498` — feat: clique no card de indicador insere instância nova direto no
   gráfico (sem modal), vale pra qualquer indicador **← estado final, supera os 2
   anteriores**

Migrations pendentes de rodar: nenhuma nova nesta sessão (as duas do dia anterior,
`011_chart_favorite_setup.sql` e `012_chart_templates.sql`, já foram confirmadas
aplicadas pelo Cleber).

## Linha do tempo do problema (por que 5 commits pro mesmo assunto)

Pedido original do Cleber: "não consigo inserir outra média móvel". Investigação e fix
foram evoluindo porque cada correção revelava a camada seguinte do problema — registro
honesto de cada volta, sem esconder que levou várias tentativas:

1. **Causa raiz #1 (z-index)**: o popover "MA — Parâmetros" (aberto pela engrenagem do
   chip) renderizava com `z-[56]`, atrás do modal "Indicadores Técnicos" (`z-[90]`). O
   clique funcionava de verdade (estado React atualizava), só ficava invisível atrás do
   overlay escuro — por isso "clico e não acontece nada". Fix: `z-[95]` nos dois
   popovers de edição (`indicatorEditor` genérico e `maEditor`).
2. **Causa raiz #2 (descoberta)**: mesmo com o popover visível, clicar na engrenagem
   minúscula não era intuitivo. Pedido do Cleber: clicar no próprio card/banner do
   indicador já ativo deveria fazer algo óbvio. 1ª tentativa: clique no card abre o
   editor (built on top of #1).
3. **Causa raiz #3 (bug real, achado auditando o código)**: `applyChartTemplateConfig`
   (usado por Setup Favorito e Templates) desenhava o gráfico com o valor MIGRADO
   (`.lines` array), mas gravava no estado React (`indicatorMASettings`) o valor BRUTO
   do template salvo, sem migrar. Pra um setup salvo em formato antigo (antes de existir
   "várias linhas por média"), editor e gráfico ficavam com valores diferentes — abrir o
   editor mostrava um período desatualizado, e "Salvar" sobrescrevia a média correta do
   gráfico pela errada do editor (sintoma relatado: MA(20) some, aparece MA(200)). Fix:
   `applyChartTemplateConfig` agora guarda o MESMO objeto migrado que foi de fato
   desenhado, também no estado do editor — elimina a divergência estrutural.
4. **Ainda não resolvia o pedido de verdade**: mesmo com o editor mostrando o valor
   certo, o fluxo "abrir editor → editar o período do campo existente → Salvar" SUBSTITUI
   a linha, nunca duplica. O Cleber queria ADICIONAR, não editar. Fix intermediário:
   clique no card/banner já ativo passa a inserir automaticamente uma nova linha
   (período = última + 10) e abre o editor já com ela — ainda exigia um passo (Salvar).
5. **Pedido final, mais simples e definitivo**: "Se eu clicar 4 vezes sobre o banner de
   uma média móvel simples, ele tem que inserir 4 médias distintas no gráfico. Simples
   assim. Isso vale para qualquer indicador!!!" — clique tem que inserir DIRETO, sem
   modal nenhum, pra qualquer um dos 22 indicadores, não só médias móveis.

## Solução final implementada (commit `742f28498`)

Clique no card/banner de QUALQUER indicador no modal "Indicadores" agora insere uma
instância nova direto no gráfico, sem abrir nenhum popover/modal. Dois caminhos
diferentes por trás, por causa de uma limitação real da biblioteca de gráfico
(`klinecharts`), não escolha de design:

- **`addMALineDirect(indicator)`** — pra MA/EMA/SMA/WMA. Cada clique adiciona uma LINHA
  nova na MESMA instância (`calcParams` como lista de períodos, truque já existente desde
  a sessão de 08-03). É o único jeito de ficar sobreposta no preço como uma média de
  verdade — `klinecharts` recusa 2 instâncias do mesmo nome no mesmo painel
  ("Duplicate indicators"), então não dá pra ter 2 instâncias separadas de "MA"
  simultaneamente, só mais linhas na mesma.
- **`addGenericIndicatorInstance(indicator)`** — pra todos os outros (RSI, MACD, ADX,
  DMI, KDJ, CCI, SAR, etc.). Cada clique extra cria uma instância nova num PAINEL
  PRÓPRIO (`pane_<id>_extra_<n>`), contornando o mesmo limite de "Duplicate indicators"
  (o bloqueio é por painel, não global — 2 painéis diferentes podem ter cada um sua
  própria instância do mesmo indicador). Efeito colateral aceito: mesmo indicador que
  normalmente seria overlay (ex. SAR) vira "painel abaixo" a partir da 2ª instância, já
  que overlay de verdade só existe via o truque de várias linhas, que só está
  implementado pras médias móveis.

Lixeira (tanto no banner "ATIVOS" quanto no card) continua removendo TUDO daquele
indicador de uma vez — todas as linhas/instâncias, não uma por vez.

**Limitação real, registrada e comunicada ao Cleber, não escondida**: instâncias extras
de indicadores não-MA (a partir da 2ª) não são salvas em Setup Favorito/Template ainda —
só a 1ª instância (`indicatorPaneIdRef`) entra em `captureCurrentChartConfig`. As extras
(`genericIndicatorExtraPaneIdsRef`) ficam só na sessão atual do navegador. Persistir isso
também é trabalho futuro, se o Cleber precisar.

## Arquivos alterados

Só `src/app/components/ChartView.tsx`, nos 5 commits acima. Principais pontos:
- `applyChartTemplateConfig` (~linha 2622) — fix da migração de estado.
- `openMAEditor` (~linha 2450) — parâmetro `addLine`.
- `addMALineDirect` / `addGenericIndicatorInstance` (novas, perto de
  `createIndicatorInstance`) — inserção direta sem modal.
- `removeIndicatorInstance` — agora limpa também `genericIndicatorExtraPaneIdsRef`.
- Dois pontos de clique no modal "Indicadores" (card da grade + banner "ATIVOS").

## Testado ao vivo (navegador local, usuário demo)

- MA: 4 cliques seguidos no card → MA(20,30,40,50) simultâneas no gráfico, confirmado
  via legenda e visualmente (4 linhas de cor diferente).
- RSI: 2 cliques seguidos → 2 painéis de RSI separados abaixo do gráfico, confirmado
  visualmente.
- Fluxo normal pós-fix #3 (editar período de uma média existente, sem usar o clique
  direto): continua funcionando sem regressão.

**Não testado**: os outros 20 indicadores individualmente (só RSI como amostra do
caminho genérico) — comportamento é o mesmo código pra todos, mas nenhum teste
automatizado cobre isso (`npm run validate` não toca UI/gráfico, só o motor de
decisão). Recomendo uma passada rápida clicando em 2-3 indicadores de painel diferentes
(ex. MACD, ADX) antes de considerar 100% fechado.
