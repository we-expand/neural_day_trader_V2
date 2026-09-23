# Sessão 2026-08-17 — Carregamento do gráfico: de ~20s para instantâneo (cache-first)

> Motivo da sessão: Cleber reportou que o gráfico de qualquer ativo demorava
> ~20 segundos pra aparecer em tela, e pediu que fosse instantâneo.

## Diagnóstico — busca de 5 anos de histórico bloqueando o primeiro paint

`ChartView.tsx` já buscava candles e cotação em paralelo (fix de sessão
anterior) — a lentidão não estava aí. O gargalo real: sempre que o cache
(`ohlcv_data`) não cobria o período pedido (símbolo/timeframe novo ou
primeira visita do dia), [market-service.ts](src/app/services/market-service.ts)
pedia **5 anos de histórico de uma vez só** (`FIVE_YEARS_MS`, capado em
10.000 candles) — decisão de produto de sessão anterior, pra permitir
zoom-out sem área vazia no gráfico.

Isso obrigava a edge function `/mt5-candles-history`
([index.ts:4757](supabase/functions/server/index.ts)) a paginar contra a
MetaAPI em até **10 chamadas sequenciais** (cada uma com 3-8s de latência
normal documentada, +150ms de espera entre elas) antes de responder — e
nada aparecia na tela até essa cadeia inteira terminar. Bate com os ~20s
reportados (e explica por que alguns ativos/timeframes "pareciam"
instantâneos: cache quente vs. cache frio).

## Fix estágio 1 — busca em 2 fases (`quick` + `deep`)

Decisão explícita do Cleber entre duas opções (reduzir o lookback padrão
vs. manter os 5 anos mas dividir a busca): escolheu **manter os 5 anos**,
dividindo em duas fases pra não regredir o comportamento de zoom-out.

- [market-service.ts](src/app/services/market-service.ts) — nova função
  `fetchCandlesQuick`: mesma rota, mas pede só até 900 candles (cabe numa
  única página de 1000 da MetaAPI) em vez de 5 anos. `fetchCandles`
  original não foi tocado — zero risco pros outros chamadores.
- [ChartView.tsx:5397](src/app/components/ChartView.tsx:5397) — `fetchData`
  passou a aceitar um modo (`'quick' | 'deep'`). No mount: `fetchData('quick')`
  primeiro (pinta a tela rápido), depois `fetchData('deep')` em background
  pra completar os 5 anos sem travar a tela. Reaproveita o mesmo pipeline já
  usado pelo auto-refresh de 30s (chamar duas vezes em sequência já era
  comprovadamente seguro).

Resultado medido pelo Cleber: **~20s → ~7s**. Esse piso de ~7s bate com a
latência normal documentada de **uma única chamada** à MetaAPI — ainda
sujeito ao cache estar frio (a barra mais recente sempre precisa de dado
ao vivo, nunca é cacheada por poder mudar até fechar).

## Fix estágio 2 — cache instantâneo antes da busca ao vivo (stale-while-revalidate)

Pra ir além do piso de latência de uma chamada MetaAPI, adicionado um
terceiro modo que nunca toca a corretora:

- [index.ts:4635](supabase/functions/server/index.ts) — `/mt5-candles-history`
  ganhou o parâmetro `cacheOnly`. Quando `true`, responde só com o que já
  está em `ohlcv_data`, sem resolver token, sem resolver conta MetaAPI, sem
  candle ao vivo — puramente uma leitura no Supabase.
- [market-service.ts](src/app/services/market-service.ts) — nova função
  `fetchCandlesCacheOnly`.
- [ChartView.tsx:5397](src/app/components/ChartView.tsx:5397) — sequência
  final de carregamento: **`'cache' → 'quick' → 'deep'`**. Mostra o cache na
  hora (se o símbolo/timeframe já foi visitado antes — pode faltar a barra
  mais recente), corrige com a versão ao vivo completa logo em seguida, e só
  depois preenche os 5 anos em background.

Efeito esperado: símbolo/timeframe já visitado antes pinta quase
instantâneo e se corrige sozinho segundos depois. Na primeira vez que
alguém abre um símbolo/timeframe (cache genuinamente vazio) o piso de
~3-8s de uma chamada real à MetaAPI continua existindo — inerente à regra
do projeto de nunca fabricar dado (`AI_BRAIN_SPEC.md`/CLAUDE.md).

## Verificação desta sessão

- `tsc --noEmit` full: 578 erros — igual à baseline pré-existente antes de
  cada rodada de mudança, zero erro novo introduzido.
- `npm run validate`: 100% verde nas duas rodadas (não toca o motor de
  decisão, só o pipeline de dados do gráfico).
- `deno check` da edge function não roda neste ambiente (dependência `npm:hono`
  não instalada localmente — pré-existente, não é desta sessão). Handler
  novo revisado manualmente linha a linha (fail-open: qualquer erro de
  leitura do cache em modo `cacheOnly` retorna array vazio, nunca quebra o
  fluxo).
- **Sem verificação em produção/browser real** nesta sessão — decisão
  deliberada: a conta MetaAPI de plataforma é compartilhada entre todos os
  usuários e sujeita a rate-limit sob carga (CLAUDE.md, "Risco crônico
  conhecido"), então evitei gerar tráfego extra de teste contra ela. Cleber
  testou o estágio 1 direto em produção/dev (~7s confirmado) e vai testar o
  estágio 2 depois do deploy da edge function.

## Estado do git nesta sessão

- Estágio 1 commitado e pushado por Cleber: `bf479dc52`.
- Estágio 2: código pronto, aguardando `git commit` + `git push` do Cleber,
  **e** `supabase functions deploy server` (a Vercel builda só o frontend;
  a edge function precisa de deploy separado no Supabase).
- Arquivos não rastreados vistos nesta sessão, não mexidos (herdados de
  sessão anterior, não relacionados a este trabalho):
  `research/experiments/cron-logs/2026-08-17_080001.log`,
  `supabase/.temp/linked-project.json`,
  `supabase/migrations/20260817_add_missing_veto_stages.sql`.

## Pendente pra próxima sessão

- Confirmar em produção, depois do deploy da edge function, que o estágio 2
  (`cacheOnly`) de fato reduz o tempo de carregamento em símbolos já
  visitados antes — nenhuma medição real ainda, só a lógica implementada e
  verificada estaticamente.
