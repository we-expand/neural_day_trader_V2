# Sessão 2026-08-22 — Template nomeado do gráfico sumia ao trocar timeframe

## Relato do Cleber

Ao carregar um perfil/template salvo no gráfico, se o usuário trocar de
timeframe depois (pelo seletor de timeframe, não pelo menu "Templates"), o
template aplicado desaparece — o gráfico volta a ficar sem os indicadores
carregados.

## Causa

`ChartView.tsx` já tinha um mecanismo pra template "pendente" quando o
próprio "Carregar" do template exigia trocar de timeframe primeiro
(`pendingTemplateApplyRef`) — necessário porque trocar timeframe faz
`dispose()`+`init()` do chart, e só dá pra reaplicar indicadores depois que
o `fetchData` do timeframe novo terminar.

O problema: nada guardava **qual** template estava ativo. Então quando o
usuário trocava de timeframe manualmente pelo seletor (sem passar pelo
"Carregar"), o chart era recriado do zero e nenhum código sabia que devia
reaplicar o template — ele simplesmente sumia.

## Fix

`src/app/components/ChartView.tsx`:

1. Novo ref `activeTemplateConfigRef` (~linha 1503) — guarda o `config` do
   último template carregado via menu "Templates".
2. O clique em "Carregar" (~linha 7480) agora também grava
   `activeTemplateConfigRef.current = template.config`.
3. O clique manual no seletor de timeframe (~linha 6559) agora checa se há
   um template ativo e, se houver, popula `pendingTemplateApplyRef` com
   esse template (timeframe atualizado para o novo) **antes** de chamar
   `setTimeframe` — reaproveitando o mecanismo de reaplicação que já
   existia, sem duplicar lógica.

Escopo do fix: só cobre o caso relatado (template nomeado sobrevivendo a
troca manual de timeframe). Não mexe em Setup Favorito nem em estado de
sessão (`sessionState`), que já tinham lógica própria e não guardavam
o mesmo bug (são aplicados uma vez por montagem, não por template
nomeado).

## Verificação

`npx tsc --noEmit` rodado após a mudança — nenhum erro novo introduzido
(os erros existentes em `ChartView.tsx` são de um problema pré-existente
não relacionado, tipo `"Stocks US"` não fazendo parte do union de
categoria, linhas ~1898-1927).

Não testado na UI ao vivo nesta sessão (mudança só de código, ainda sem
push/deploy).

## Pendente

Commit e push (`git push origin dev`) a cargo do Cleber, conforme regra
fixa do projeto.
