# Sessão 2026-08-21 — Guarda de desvio máximo de preço (achado incidental do scorecard)

> Não confundir com o outro arquivo de hoje sobre gates de custo/contexto —
> este é um achado **incidental**, feito ao investigar dado contaminado
> (SPX500) durante a medição do scorecard de performance por ativo (ver
> [SESSAO_2026-08-21_PLANO_SCORECARD_PERFORMANCE_ATIVO.md](SESSAO_2026-08-21_PLANO_SCORECARD_PERFORMANCE_ATIVO.md)).

## O que motivou

Ao medir `ai_trades` pro scorecard, achamos um trade fechado de SPX500 com
`entry_price=6010,13` / `exit_price=7536,86` (+25,4% num único trade,
PnL -$3.810, posição parada ~15h40, julho/2026). Duas investigações em
paralelo:

1. **Técnica** (histórico + código): o gap foi confirmado como **caso
   isolado no histórico** (testado threshold de até 1% em toda `ai_trades`
   CLOSED — nenhum outro caso de forex/índice/ação/commodity chegou perto;
   cripto teve alguns saltos de 1-1,5%, normais pra classe). Mas o código
   **não tinha nenhuma proteção estrutural**: nem client (`useApexLogic.ts`)
   nem servidor (`ai-runner/positionManager.ts`, que importa o mesmo
   `RealMarketDataService.ts`) checavam variação percentual antes de aceitar
   um preço como real — só rejeitavam `<=0`/`NaN`. O clamp "±50%" que o
   `CLAUDE.md` documentava pra cripto **nunca protegeu o caminho de
   fechamento de trade** — vivia só em `DataQualityMonitor.ts`, código morto
   usado só por um badge de UI (`DataQualityBadge.tsx`), nunca chamado pelo
   loop que fecha posição. `lastRealPriceCache` (RealMarketDataService.ts)
   não tinha TTL — serve o último preço real conhecido indefinidamente como
   fallback silencioso em falha, sem checar idade.

2. **Mercado** (concorrentes/prática de setor): confirmado que gap de 25% não
   é "anomalia aceitável do setor" — requote, "maximum deviation" nativo do
   MT4/MT5 e rejeição de stale price são mecanismos padrão exatamente pra
   este risco. O setor trata como risco operacional conhecido com mitigação
   conhecida, não como imprevisível.

Causa raiz mais provável (confiança moderada-alta, não 100% confirmada):
feed MT5 parado por horas sob rate-limit 429/504 da conta MetaAPI
compartilhada (risco crônico já documentado, item 8 do `CLAUDE.md`) — preço
servido do cache sem TTL até o próximo tick real "corrigir" de uma vez,
gerando o salto artificial.

**Achado incidental à parte, não corrigido nesta sessão**: `ai_trades.quantity`
não guarda lote/contrato — guarda `trade.amount` (capital em $ alocado à
posição), gravado assim em `useAIPersistence.ts:245`. Inofensivo pro cálculo
(PnL é passado já calculado, não deriva de `quantity`), mas é rótulo de
coluna enganoso pra quem audita a tabela direto — mesma categoria de risco
que o `CLAUDE.md` já registra pra "correção de dado financeiro sem rastro",
só que aqui não corrompe valor, só induz erro de leitura. Fica registrado,
não é urgente.

## Fix implementado

Em [`RealMarketDataService.ts`](src/app/services/RealMarketDataService.ts)
— módulo compartilhado entre client e servidor (o `ai-runner` importa o
mesmo arquivo direto via import map, ver comentário em
`ai-runner/shims/supabaseClient.ts:131`), então o fix protege os dois de
uma vez sem duplicar lógica:

1. **Guarda de desvio máximo** (`isSuspiciousDeviation`, aplicado dentro de
   `rememberIfReal` — ponto central por onde todo tick "real" passa, de
   qualquer fonte): compara o preço novo contra a última referência real
   **recente** (< 10 min) do mesmo símbolo. Se desviar mais que o limiar da
   classe do ativo (8% padrão forex/índice/commodity/ação/bond, 20% cripto —
   folgado o bastante pra não confundir dia de notícia real com tick ruim),
   descarta o tick suspeito e mantém a última referência boa — nunca deixa
   o valor suspeito contaminar o cache (senão o PRÓXIMO tick bom dispararia
   o guard ao contrário). Só compara contra referência recente de propósito:
   preço parado há dias não é referência válida (mercado pode ter se movido
   muito de verdade nesse intervalo).
2. **TTL no `lastRealPriceCache`** (`LAST_KNOWN_STALE_AFTER_MS = 5min`): acima
   desse limite, `getFallbackOrLastKnown` ainda retorna o preço (UI continua
   mostrando algo em vez de zerar), mas marcado `isRealData: false` —
   `positionManager.ts` do servidor já trata isso como "sem preço válido,
   tenta de novo no próximo tick" (nunca fecha posição em cima de preço não
   confiável), sem precisar de nenhuma mudança no position manager em si.

Nenhuma mudança em `positionManager.ts`/`useApexLogic.ts` foi necessária —
os dois já tratam `isRealData: false` corretamente (não fecham posição), o
fix inteiro ficou centralizado na fonte compartilhada.

`npm run validate` (37/37) e `tsc --noEmit` sem erro novo no arquivo.
**Não testado contra feed real** (exigiria simular um gap de verdade ou
esperar um acontecer) — validação estática só, mesma ressalva que outros
módulos do runner já carregam até rodar em produção.

## Telemetria de calibração (adicionada 2026-08-21, mesma sessão)

Limiares (8%/20% de desvio, 10min de referência, 5min de TTL) continuam
sendo estimativa de prática de mercado, não calibração — só havia 1 caso no
histórico pra calibrar estatisticamente. Em vez de esperar passivamente por
mais casos, adicionada telemetria pra acumular amostra real de produção:

- **Tabela nova** `price_guard_events`
  ([`supabase/migrations/20260821_price_guard_events.sql`](supabase/migrations/20260821_price_guard_events.sql),
  RLS restrito a `service_role`) — uma linha por evento, com símbolo,
  categoria, preço candidato/referência, desvio %, limiar % e fonte.
- **Dois pontos de gravação** em `RealMarketDataService.ts`
  (`logPriceGuardEvent`, fire-and-forget — nunca atrasa/quebra o caminho de
  preço real):
  - `suspicious_deviation`: toda vez que `isSuspiciousDeviation` rejeita um
    tick.
  - `stale_fallback`: toda vez que `getFallbackOrLastKnown` degrada
    `isRealData: false` por TTL — com throttle de 5min por símbolo pra não
    inundar a tabela enquanto um feed fica travado por horas (senão seria
    uma linha por símbolo a cada poll de 1min).
- **Shim do servidor** ([`supabase/functions/ai-runner/shims/supabaseClient.ts`](supabase/functions/ai-runner/shims/supabaseClient.ts))
  atualizado pra permitir esse `insert` também no `ai-runner` (mesmo arquivo
  compartilhado client+servidor) — sem isso o runner estouraria em runtime
  na primeira chamada.

Com dado acumulado, revisar depois: taxa de falso-positivo (rejeitou
movimento real de notícia — olhar `deviation_pct` perto do limiar em
`suspicious_deviation`) e duração/frequência de `stale_fallback` (indica
quanto tempo o feed fica travado sob rate-limit da conta MetaAPI
compartilhada, risco crônico já documentado no `CLAUDE.md`).

`npm run validate` (37/37) e `tsc --noEmit` sem erro novo. **Não testado
contra feed real** — mesma ressalva do fix original.

## Pendências

- Limiares em si ainda não calibrados — agora há telemetria (acima) pra
  fazer isso com dado real depois de rodar em produção por um tempo.
- Rótulo enganoso de `ai_trades.quantity` (ver acima) não corrigido.
- Migration `20260821_price_guard_events.sql` precisa ser aplicada pelo
  Cleber no SQL Editor do Supabase antes do deploy (senão os inserts falham
  silenciosamente — `logPriceGuardEvent` só loga warning, não quebra nada,
  mas a tabela não existirá até a migration rodar).
- Push pendente do Cleber rodar.

```bash
git add src/app/services/RealMarketDataService.ts supabase/functions/ai-runner/shims/supabaseClient.ts supabase/migrations/20260821_price_guard_events.sql SESSAO_2026-08-21_GUARDA_DESVIO_PRECO.md research/experiments/2026-08-21-asset-scorecard SESSAO_2026-08-21_PLANO_SCORECARD_PERFORMANCE_ATIVO.md
git commit -m "fix: guarda de desvio máximo + TTL no cache de último preço real, com telemetria pra calibrar limiares depois"
git push origin dev
```

Depois do push, aplicar a migration no SQL Editor do Supabase (projeto
"Neural DayTrader", `wyvdsxtcmizettljxtbg`) rodando o conteúdo de
`supabase/migrations/20260821_price_guard_events.sql`.
