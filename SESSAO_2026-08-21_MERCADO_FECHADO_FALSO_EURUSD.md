# Sessão 2026-08-21 — "MERCADO FECHADO" falso (EURUSD)

## Sintoma

Cleber reportou: card de preço do EURUSD mostrando "🔒 MERCADO FECHADO —
último negócio 21/08, 10:31" às 08:26, com o mercado genuinamente aberto
(sexta-feira, ~13:38 UTC — dentro do horário forex normal, confirmado com
`date -u`).

## Causa raiz

Desalinhamento de limiar entre dois arquivos, introduzido pela guarda de TTL
adicionada na sessão anterior (ver
[SESSAO_2026-08-21_GUARDA_DESVIO_PRECO.md](SESSAO_2026-08-21_GUARDA_DESVIO_PRECO.md)):

- `RealMarketDataService.ts` (`getFallbackOrLastKnown`, `LAST_KNOWN_STALE_AFTER_MS`)
  passou a marcar um tick como `isRealData: false` depois de **5 minutos**
  parado, mas preserva o `timestamp` antigo do último preço real.
- `MarketScoreBoard.tsx` (`fetchData`) ainda usava `STALE_TICK_MS = 10 * 60 * 1000`
  (**10 minutos**) pra decidir quando ignorar `isRealData` e confiar no
  calendário de mercado (`isMarketOpen`) em vez disso.

Resultado: qualquer tick com idade entre 5 e 10 minutos caía no ramo
`!isTickStale` da lógica `shouldShowClosed`, que usa `!isRealData` puro sem
checar o calendário — declarando "MERCADO FECHADO" só porque o feed atrasou
um pouco, mesmo com o mercado de verdade aberto.

## Fix

`src/app/components/dashboard/MarketScoreBoard.tsx` (~linha 544): alinhado
`STALE_TICK_MS` para 5 minutos, igual ao TTL do `RealMarketDataService.ts`.
Assim qualquer tick que o serviço já marcou como não-real também é tratado
como "tick velho" no componente e cai no ramo que confia no calendário real,
em vez de declarar fechado às cegas.

`npm run validate` não cobre este caminho (é lógica de UI, não do motor de
decisão) — mudança não verificada em browser real nesta sessão (depende de
tick real do feed ficar stale por 5-10min pra reproduzir, não simulável
rapidamente). Regra geral pra manter: **os dois limiares (TTL do serviço e
`STALE_TICK_MS` da UI) precisam ficar sincronizados manualmente** se um dos
dois mudar de novo — não há import compartilhado entre eles hoje.

## Commit pendente

```bash
git add src/app/components/dashboard/MarketScoreBoard.tsx
git commit -m "fix: alinha limiar de tick velho (5min) com TTL do RealMarketDataService, evita MERCADO FECHADO falso com calendário aberto"
git push origin dev
```

## Em paralelo

Investigação aberta (agente em background) sobre reclamação separada do
Cleber: gráfico demorando mais de 1 minuto pra carregar. Ainda sem
diagnóstico — atualizar este arquivo ou abrir sessão nova quando o achado
chegar.
