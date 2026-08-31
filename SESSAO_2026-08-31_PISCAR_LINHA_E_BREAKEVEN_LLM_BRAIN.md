# Sessão 2026-08-31 — Linha de posição piscando + breakeven do LLM Brain nunca disparava

## Queixa do Cleber

1. No gráfico, as linhas de entrada/stop/alvo de uma posição aberta ficam
   "piscando" — aparecem e somem de forma intermitente.
2. O ATR não está dinâmico nas operações: o stop não anda em direção ao
   preço conforme o mercado evolui a favor, não protegendo lucro.

Confirmado por ele que as posições em questão são do **Cérebro LLM Ativo em
modo DEMO** (não o AI Trader / motor mecânico antigo, que está desligado
desde ontem).

## Achado 1 — bug real, corrigido: linha de ordem pendente piscando

`renderPositionOverlays` em `ChartView.tsx` já tinha sido corrigido em
2026-08-28/29 pra não recriar as linhas de entrada/SL/TP de posição aberta
a cada tick de P&L (usa `overrideOverlay` em vez de remove+recria). Mas a
lógica que decide "quais overlays sumiram de verdade" usava uma regex
(`^position_(entry|sl|tp)_`) que só reconhece esse prefixo — **ids de ordem
pendente usam o prefixo `pending_`**, que a regex não bate. Resultado: toda
linha de ordem pendente era marcada como "não existe mais" e
removida+recriada a cada render (a cada tick de P&L, ~1s) — o piscar
intermitente relatado.

Fix em `ChartView.tsx` (~linha 4611): ids `pending_*` agora são ignorados
nessa checagem (têm ciclo de vida próprio). Também tornei o bloco de
criação de ordens pendentes (~linha 4788) idempotente — antes recriava
todas incondicionalmente a cada render; agora só cria a que ainda não
existe e atualiza (`overrideOverlay`) a que já existe, removendo só as que
saíram de verdade (cancelada/disparada).

`tsc --noEmit`: mesmos 417 erros pré-existentes em `ChartView.tsx` (todos
de tipagem de `AssetCategory`, nada relacionado a esta mudança) antes e
depois — nenhum erro novo.

## Achado 2 — não é bug, é threshold que quase nunca é atingido

Investigado `llm-active-brain/src/neuralBridge.ts`
(`enforceMt5StopsAndTargets`): o mecanismo de breakeven+trailing **existe e
roda de verdade** a cada ciclo do processo Node (`MT5_TRADING_ENABLED=true`,
processo vivo desde 14:12 no momento da investigação). Mas:

- Breakeven só move o stop pro preço de entrada quando o preço andou
  `mt5BreakevenTriggerR` (0.5) vezes a distância original do stop **a
  favor**.
- Trailing contínuo só começa a rodar depois que o breakeven já disparou.

Busquei no log inteiro do processo (`llm-active-brain/llm-brain.log`) pelas
strings "Stops trilhados" e "movidos para breakeven" — **zero ocorrências**.
O mecanismo nunca disparou em nenhum trade registrado no log. Bate com o
achado já documentado no `CLAUDE.md` de 2026-08-28: a excursão favorável
mediana antes de reverter é ~$0,55, e o alvo (take-profit) é curto
(~1,5×ATR) — a maioria das posições bate stop ou alvo antes de acumular
lucro suficiente pra sequer tentar mover o stop. `getAtrPercent` (fonte do
ATR de trailing) tem fallback pra volatilidade de tick real, então não é a
causa — o gargalo é mesmo o threshold de 0,5R.

**Ação, a pedido do Cleber**: baixado `MT5_BREAKEVEN_TRIGGER_R` de 0.5 para
**0.25** via `llm-active-brain/.env` (default no código, `config.ts`,
continua 0.5 — só o `.env` de produção muda). Processo reiniciado via
`restart.sh` (fora do escopo de ação automática do Claude — comando
entregue pronto, Cleber rodou). Sem validação estatística de que isso
melhora o líquido — é correção de mecânica de proteção (fazer o mecanismo
disparar de fato), não alegação de edge.

## Pendência

Observar os próximos ciclos/trades no log ou Supabase pra confirmar que
"Stops trilhados"/"movidos para breakeven" agora aparecem de verdade com o
threshold mais baixo. Se `0.25R` ainda for alto demais pra excursão
favorável mediana atual (~$0,55), pode precisar baixar mais — decisão do
Cleber quando houver amostra nova.

Commit: `3a0d9efd9`.
