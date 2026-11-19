# Sessão 2026-09-08 — Cronômetro de timeframe travado em 00:00 (CHINA50)

## Relato do Cleber

Gráfico do CHINA50 (15m) com o cronômetro de virada de candle ("Timeframe")
ficando **zerado**/travado em `00:00`, sem contar.

## Investigação

Achado real via log ao vivo do Supabase (Edge Function, projeto
`wyvdsxtcmizettljxtbg`), não suposição:

```
[MT5 CANDLES HISTORY] ⚠️ Falha persistente (3 tentativas) na página 1
(CHINA50/1h): HTTP 429 — devolvendo parcial/cache com stale:true.
```

O backend (`/mt5-candles-history`, `supabase/functions/server/index.ts`)
já tinha, desde 2026-09-02, uma flag `stale: true` explícita na resposta
pra sinalizar quando a busca ao vivo do candle falha persistentemente
(HTTP 429 na paginação da MetaAPI) e ele cai pro cache — mas com
`success: true`, pra não quebrar o cliente.

**Causa raiz real**: o frontend (`src/app/services/market-service.ts`,
função `fetchCandlesFromMetaAPI`) **nunca lia esse campo `result.stale`**.
Só existia uma heurística própria de idade do último candle (3x o
intervalo do timeframe) pra decidir se o dado era velho demais. Sob
rate-limit persistente, o candle em cache devolvido pelo backend ainda
caía dentro dessa janela "recente o suficiente" — então o cliente aceitava
como se fosse dado ao vivo e reexibia **o mesmo candle congelado** a cada
auto-refresh de 30s. Como o candle nunca mudava, a âncora do cronômetro
(`lastRealCandleTimestampRef` em `ChartView.tsx`) nunca avançava — o
`elapsedSinceOpen` crescia até estourar o intervalo do timeframe, e o
código (por desenho: "nunca fabricar o próximo boundary por adivinhação")
trava o contador em `00:00` até uma âncora real confirmar a virada. Nesse
caso a âncora real nunca vinha, porque o backend estava preso servindo
cache.

## Correção do meio do caminho

Durante a investigação eu tinha atribuído o 429 à "conta MetaAPI
compartilhada" (risco crônico documentado no `CLAUDE.md`) — **Cleber
corrigiu ao vivo: a conta agora é dedicada, não compartilhada**. O 429 em
si é real (confirmado no log), só a causa alegada estava desatualizada.
O fix não depende da causa do 429 — só de o cliente respeitar o
`stale: true` que o backend já calcula, seja qual for o motivo do
rate-limit.

## Fix aplicado

`src/app/services/market-service.ts` (`fetchCandlesFromMetaAPI`): logo
após o parse da resposta, antes da heurística de idade já existente,
checa `result.stale === true` e trata como "sem candle real" (retorna
`[]`, mesmo caminho que já dispara o retry com backoff existente) — em
vez de aceitar o cache velho como se fosse dado atual. Mesma disciplina
de "nunca fabricar/aceitar dado velho como atual" já usada no resto do
projeto.

`tsc --noEmit`: 634 erros antes e depois (mesmo ruído pré-existente
documentado no `CLAUDE.md`), nenhum novo.

## Status

**Commit pronto, não aplicado ainda** — regra fixa do projeto, Claude
nunca commita sozinho. Comando entregue ao Cleber:

```bash
git commit -m "fix: cronômetro do timeframe respeita stale:true do backend em /mt5-candles-history

Backend já sinaliza stale:true quando a busca de candle falha
persistentemente (429 confirmado ao vivo pro CHINA50), mas o frontend
ignorava esse campo e reaceitava o mesmo candle em cache como se fosse
ao vivo — travando a âncora do cronômetro em 00:00 pra sempre.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

Só `src/app/services/market-service.ts` está staged. Não precisa de
restart de nenhum motor — é mudança de frontend puro.

## Pendente

- Cleber rodar o commit acima.
- Confirmação visual: reabrir o gráfico do CHINA50 (ou qualquer ativo que
  bata rate-limit) depois do deploy e ver se o cronômetro volta a contar
  normalmente assim que um candle real (não-stale) chegar — o fix evita
  aceitar dado congelado, mas não elimina o 429 em si; enquanto o
  rate-limit persistir, o gráfico deve mostrar o badge de
  "Reconectando..."/dados desatualizados em vez de um cronômetro
  silenciosamente parado.
- Não investigado nesta sessão: por que a conta dedicada nova ainda está
  batendo 429 na paginação de histórico — se o rate-limit for recorrente
  mesmo com conta dedicada, vale investigar à parte (fora do escopo deste
  fix, que só corrige a exibição do cronômetro).
