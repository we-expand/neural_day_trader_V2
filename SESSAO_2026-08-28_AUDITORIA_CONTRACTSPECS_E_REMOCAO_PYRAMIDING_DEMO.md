# Sessão 2026-08-28 — Auditoria pós-deploy do cérebro analítico + remoção de página demo com specs erradas

## Contexto

Sessão de acompanhamento após o Cleber confirmar 2 deploys já feitos
(`ai-runner` com Passo 2 da memória do cérebro sombra, e `nexus-brain` com
Nemotron 3). Objetivo: confirmar status geral, auditar se o bug de PnL 20x
em índices (corrigido em 2026-08-27 só pra NAS100 via
`calculateEngineConsistentPnL`) se repete em outros símbolos ÍNDICES.

## 1. Status do cérebro analítico (Fase 0 + memória de decisões)

Confirmado (sem mudança de código nesta sessão, só checagem):

- **Passo 1** (resultado hipotético por decisão): rodando ao vivo desde
  2026-08-28, job `decision-brain-outcome-30min` confirmado.
- **Passo 2** (recuperação de histórico + injeção no prompt): código pronto
  desde a sessão anterior, **deploy confirmado feito pelo Cleber nesta
  sessão** (`supabase functions deploy ai-runner --no-verify-jwt`).
- **NEXUS** (Nemotron 3 Nano): **redeploy confirmado feito pelo Cleber**
  (`supabase functions deploy nexus-brain --no-verify-jwt`).
- **Pendente**: acumular ~20 decisões avaliadas pra sair do fallback
  "amostra insuficiente" — depende só de o motor rodar, nenhuma ação de
  código necessária.

## 2. Auditoria do bug de PnL 20x em índices — resultado: NÃO se repete

Hipótese a testar: será que o bug de NAS100 (spec E-mini CME usada em vez
do modelo CFD $1/ponto) também afeta US30, US2000, GER40, UK100etc no
caminho real de execução?

**Investigação por leitura de código** (não foi preciso rodar nada contra
o Supabase):

- `supabase/functions/ai-runner/lib/positionManager.ts` — o servidor
  **nunca importou** `contractSpecs.ts`/`infinoxContractSpecs.ts`. Sempre
  usou o modelo `(entryPrice - exitPrice) * (amount / entryPrice)`,
  idêntico pra todos os símbolos, índices inclusive.
- `src/app/hooks/useApexLogic.ts` — `calculateEngineConsistentPnL()` (o
  fix de 08-27) usa a mesma fórmula acima, também sem depender de spec por
  símbolo. Ou seja, o fix não foi "um patch pro NAS100": ele **eliminou a
  dependência da tabela de specs pra PnL de exibição em qualquer símbolo**.

**Conclusão**: o bug de 20x era estrutural (spec errada usada como fonte
de verdade de PnL), não um erro isolado de valor pro NAS100 — e o fix já
aplicado resolve pra toda a cesta de ativos, não só índices. Nenhuma ação
adicional necessária no caminho de execução real.

## 3. Achado secundário — código morto ainda usando a spec errada

Durante a auditoria, apareceram componentes que **ainda liam
`pointValue`/`tickValue` de `infinoxContractSpecs.ts`** com a fórmula
antiga (inclusive multiplicando por `leverage` em cima do nocional cheio,
o mesmo padrão documentado como "bug crítico" no comentário de
`contractSpecs.ts`):

- `PnLCalculator`, `ContractSpecsBadge`, `ContractSpecsInfo`
  (`ContractSpecsInfo.tsx`) — confirmado por grep que **nenhum dos três é
  importado em lugar nenhum do app**. Código morto verdadeiro, sem risco
  real. Não removido nesta sessão (fora do escopo do que foi pedido).
- `AssetSpecsSelector.tsx` (via `Example3_AssetSpecs`) — **este sim estava
  alcançável**: item "Pyramiding" no menu lateral (`Sidebar.tsx`) abria
  `InfinoxCompleteExample`
  (`src/app/components/examples/InfinoxExamples.tsx`), uma página de
  demonstração de componentes que **exibia `pointValue` errado pro
  usuário** (ex: NAS100 $20/pt em vez do $1/pt real usado pelo motor).

Risco real: baixo (não é o caminho de trading, é uma página de
"exemplos"), mas está no menu principal com nome enganoso — usuário podia
ver um número de $/ponto que não bate com o que o produto realmente
cobra/paga.

## 4. Correção aplicada — remoção da página demo

**Decisão do Cleber**: apagar definitivamente. Removido:

1. Botão "Pyramiding" e o valor `'pyramiding'` do tipo `View` em
   [`Sidebar.tsx`](src/app/components/Sidebar.tsx).
2. `case 'pyramiding'` e o import de `PyramidingExample` em
   [`App.tsx`](src/app/App.tsx).
3. Arquivo inteiro
   [`src/app/components/examples/InfinoxExamples.tsx`](src/app/components/examples/InfinoxExamples.tsx)
   (deletado — confirmado sem outro importador ativo; só um comentário e
   um arquivo de backup morto (`App_BACKUP_COMPLETE.tsx`, não usado pelo
   build) ainda o referenciavam).

**Validação**: `npm run validate` → 37/37 OK, sem regressão no caminho
crítico. `tsc --noEmit` amplo (não é o gate oficial) já tinha 632 linhas
de erro pré-existentes antes da mudança (confirmado via `git stash`); o
único erro novo é esperado (`App_BACKUP_COMPLETE.tsx` referenciando o
arquivo deletado — arquivo morto, fora do build).

**Painel real de Pyramiding** (o funcional — trailing stop, breakeven,
TP parcial, em Configurações) **não foi tocado**, só a página de
demonstração confusa.

Commit já feito pelo Cleber.

## Pendências que seguem de pé (sem mudança nesta sessão)

- Acumular amostra (~20 decisões) pra validar Passo 2 do cérebro em
  produção.
- Item registrado no `CLAUDE.md` sobre auditoria de `contractSpecs.ts` em
  outros ÍNDICES — **fechado por esta sessão** (achado: não é necessário,
  ver seção 2 acima). Atualizar `CLAUDE.md` na próxima sessão pra refletir
  isso.
