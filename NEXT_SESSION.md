# Handoff — próxima sessão (escrito em 2026-07-28)

> Arquivo temporário de retomada rápida. Não é memória permanente do projeto —
> isso é o `CLAUDE.md` (carrega automático) e o `AI_BRAIN_SPEC.md` (fonte de
> verdade do motor de decisão). Este arquivo existe só pra você abrir uma
> janela nova e retomar sem reconstruir o raciocínio do zero. Pode apagar
> depois de ler/absorver.

## Onde a conversa chegou

Sessão de hoje começou investigando o painel "Configurações Operacionais da
IA" (AI Trader → Configuração) e terminou destravando um **bug de produção
que derrubava o site inteiro** (tela preta) mais um **bug de UI que quebrava
todo popover Radix do app**. Tudo já commitado (ver log abaixo) — nada
pendente de commit desta sessão.

### 1. Limpeza de UI no AI Trader (início da sessão)

A pedido do Cleber, removidos do painel de configuração do AI Trader:

- Bloco "Configuração por Voz (Neural Speech)" (`VoiceAssistant` embutido).
- Título "Configurações Operacionais da IA" + presets Scalping/Swing + card
  "US30 Scalping" (`applyPreset`, `US30ScalpPreset`).

Código morto removido junto (imports/função órfãos).

### 2. Universo de Ativos — auditoria encontrou catálogo fantasma

Investigando se o seletor "Universo de Ativos - Infinox" do AI Trader batia
com o mesmo catálogo do Dashboard, achamos que **não batia**:
[`AssetUniverse.tsx`](src/app/components/config/AssetUniverse.tsx) tinha uma
lista de 341 ativos digitada à mão, nunca auditada contra a API real —
continha símbolos fantasma (`TOTUSD`/"Tottenham" como cripto, `JSON`/"JSON
Token", `USDIGN`/"Ignition", variantes `dft`/`R` inventadas). O Dashboard já
usava um catálogo **real**, auditado contra a API da Infinox
(`src/config/infinoxAssets.ts` + `src/app/config/brokerRegistry.ts`, via
`scripts/audit-broker-symbols.mjs`).

Reescrito `AssetUniverse.tsx` pra consumir o catálogo real
(`getInfinoxAssetsByCategory()`) — mesma fonte do Dashboard, catálogo
duplicado eliminado. Efeito colateral corrigido: `BacktestReplayBar.tsx`
importava a lista antiga, redirecionado pro catálogo canônico
(`assetDatabase.ts`).

### 3. Universo de Ativos — redesign compacto (pedido explícito do Cleber)

O grid de cards grandes (1 card ~90px por ativo, ~350 ativos reais) ocupava
área de tela enorme. Redesenhado como **combobox de busca compacto**
(padrão "command palette", usando `cmdk`/`ui/command.tsx`, já usado em
`MarketScore.tsx`): 1 botão-gatilho "N selecionados" abre popover com busca +
lista agrupada por categoria + seleção múltipla sem fechar; ativos escolhidos
viram chips removíveis; atalhos "Populares" (BTCUSD, XAUUSD, EURUSD, US30,
NAS100, SPX500, GER40, XAGUSD) com 1 clique.

### 4. BUG CRÍTICO achado e corrigido: tela preta em produção

Cleber reportou tela preta ao abrir `neuraldaytrader.com`. Reproduzido e
isolado: `vite.config.ts` tinha o chunk `radix` (Radix UI) separado do chunk
`vendor` (onde vive o React), criando uma **dependência circular real** entre
os dois (`Circular chunk: radix -> vendor -> radix`, aviso que o próprio
build já dava). Em produção, o Rollup às vezes inicializa `radix` antes de
`vendor` — como os componentes Radix chamam `React.useLayoutEffect` no topo
do módulo, o app quebrava com `Cannot read properties of undefined (reading
'useLayoutEffect')`, sem log nenhum (os "escudos anti-erro do Figma" no
`main.tsx` mascaravam ainda mais). **Fix**: Radix caiu no mesmo chunk
`vendor` que o React, eliminando o ciclo — mesma classe de bug que já tinha
sido corrigida antes entre `vendor`/`react-vendor` (comentário no próprio
arquivo já documentava o precedente, só nunca tinha sido aplicado ao Radix).

### 5. BUG achado e corrigido: popovers Radix invisíveis em todo o app

Ao testar o combobox novo do Universo de Ativos, o popover abria no React
(DOM presente, `opacity:1`) mas **não aparecia na tela**. Causa: a regra CSS
"PROTEÇÃO NÍVEL 3" em `index.html` (criada pra esconder overlays de erro que
o iframe do Figma injeta direto no `<body>`) also esconde **qualquer**
overlay Radix legítimo — todo componente Radix (Popover, Select,
DropdownMenu, Tooltip, Dialog...) renderiza via Portal como filho direto de
`<body>` com `position:fixed`/`z-index` inline, o mesmo padrão que a regra
tenta bloquear. Isso não é específico do Universo de Ativos — **qualquer
Popover/Select/DropdownMenu Radix do site inteiro estava sujeito ao mesmo
bug**, inclusive código que já existia antes desta sessão. **Fix**: regra
agora exclui qualquer overlay que tenha um descendente com
`data-slot="*-content"` — convenção usada por todos os componentes Radix
deste projeto (`src/app/components/ui/*.tsx`).

## Verificação feita

- `npm run validate` (28/28) rodado depois de cada mudança que tocou o motor
  ou o app.
- `npx tsc --noEmit` no app inteiro — sem erros novos introduzidos.
- Bug da tela preta: reproduzido no site publicado (`import()` direto do
  bundle de produção), corrigido, e reverificado servindo o build de
  produção local (`npm run preview`) — login carrega normal.
- Bug do popover: reproduzido no DOM (popover com `data-state=open` mas
  `display:none`), corrigido, e reverificado no browser — combobox do
  Universo de Ativos abre e mostra a lista completa buscável.
- **Não testado**: nenhuma ação irreversível/financeira (login real com
  credencial, ativação de MT5 real) — meramente exploração + fix de UI/build.

## Próximo trabalho concreto sugerido

1. Confirmar visualmente em produção (depois do deploy) que a tela preta e os
   popovers Radix (Universo de Ativos e outros) estão realmente resolvidos —
   eu só verifiquei local/preview, não o deploy real na Vercel.
2. Considerar auditar se existem outros lugares no app usando Radix
   Popover/Select/DropdownMenu que podem ter sido afetados silenciosamente
   pelo bug #5 antes do fix (provavelmente poucos — só achei uso em
   `MarketScore.tsx` e no novo `AssetUniverse.tsx`, mas vale checar).
3. Pendência antiga, ainda não retomada: decisão sobre estágio 3 da ponte
   decisão→execução real (ver `CLAUDE.md`, seção "Pendências reais em
   aberto", item 2) — Cleber ainda não decidiu se vale avançar além do
   estágio 2 dado que não há edge estatístico comprovado.
4. `npm run validate` obrigatório antes de qualquer commit que toque o motor.

## Arquivos-chave pra retomar

- [`vite.config.ts`](vite.config.ts) — fix do chunk circular radix/vendor
  (bug #4).
- [`index.html`](index.html) — fix da regra CSS anti-overlay do Figma que
  escondia popovers Radix (bug #5).
- [`src/app/components/config/AssetUniverse.tsx`](src/app/components/config/AssetUniverse.tsx)
  — combobox compacto novo, catálogo real auditado.
- [`src/config/infinoxAssets.ts`](src/config/infinoxAssets.ts) +
  [`src/app/config/brokerRegistry.ts`](src/app/config/brokerRegistry.ts) —
  fonte única de verdade de "que ativo existe de verdade na Infinox".

## Regras fixas do projeto (não esquecer ao retomar)

- Claude nunca faz `git commit`/`git push` sozinho — sempre entregar comando
  pronto pro Cleber rodar.
- `npm run validate` obrigatório antes de qualquer commit que toque o motor.
- Nunca fabricar dado — sempre erro explícito quando não há fonte real.
- Comunicação sempre em português, rigor de especialista sênior — nunca
  inflar resultado, sempre reportar achado negativo por completo.
- Ações irreversíveis/financeiras (login real, ativar MT5 real) nunca são
  executadas por Claude sozinho, mesmo em teste.

## Estado do git

Working tree deveria estar limpo em relação ao código (só este arquivo
`.md` e artefatos não relacionados — `dist/`, `Neural Day Trader.zip`,
`RISK_MANAGEMENT_STRATEGY.md`, screenshots avulsos em `src/imports/`,
`supabase/.temp/` — não fazem parte deste handoff, não mexidos). Últimos
commits, mais recente primeiro:

```
20a8f0d1d fix: regra anti-overlay do Figma escondia popovers legitimos do Radix (Popover/Select/DropdownMenu) em todo o site
70a824f3c fix: elimina chunk circular radix<->vendor que quebrava o boot em producao (tela preta)
0e7ca6507 refactor: Universo de Ativos vira combobox compacto (cmdk) em vez de grid de cards
edceea1a2 fix: Universo de Ativos passa a usar catalogo auditado da Infinox (mesma fonte do Dashboard), remove lista duplicada com simbolos fantasma
8d183e1df chore: remove Configuração por Voz e Configurações Operacionais da IA (Neural Speech, presets Scalping/Swing, US30 Scalping preset)
```
