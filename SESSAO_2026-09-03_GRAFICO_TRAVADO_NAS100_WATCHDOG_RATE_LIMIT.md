# Sessão 2026-09-03 (fim de tarde) — Gráfico travado no NAS100 + tela preta bloqueante + watchdog do LLM Brain se auto-saturando

## Sintoma reportado pelo Cleber

Gráfico do NAS100 "congelando": cronômetro de candle preso em `00:00`,
candles não se formavam, mensagem "Não foi possível carregar os candles
reais de NAS100 agora" na tela. Só o NAS100 — outros ativos (cripto etc.)
normais. Confirmado por vídeo/screenshot ao vivo. Cleber insistiu que
"isso não pode ficar desse jeito, o usuário não pode passar por isso".

## Investigação — 3 causas reais, em camadas

**1ª hipótese (descartada pelo Cleber): múltiplas abas do navegador.**
Suspeita inicial: várias abas do app abertas, cada uma rodando seu próprio
polling de preço a cada 2s (`ChartView.tsx`), multiplicando requisições no
símbolo selecionado contra a mesma conta MetaAPI compartilhada. Cleber
confirmou que **não tinha nenhuma aba aberta** — hipótese errada. Mesmo
assim, deixado um fix defensivo genérico (pular polling com `document.hidden`,
ver `RealMarketDataService.ts:801`) para o cenário real de múltiplas abas,
que é um risco real mesmo não sendo a causa desta vez — **ainda não
commitado**, comando pendente:
```bash
git add src/app/services/RealMarketDataService.ts && git commit -m "fix: pausa polling de preço com a aba em background (evita 429 self-inflicted)"
```

**2ª causa real, confirmada no log do servidor (Supabase, função `server`):**
o **próprio motor `llm-active-brain` (headless, rodando no Mac do Cleber)**
estava se auto-saturando na cota MetaAPI compartilhada, concentrado no
NAS100 porque é o único símbolo com posição aberta na sessão ativa. Achado
via `query_logs` (Supabase MCP): dezenas de chamadas avulsas de
`[MT5 PRICES] Símbolos: NAS100` em segundos, terminando em 429/504.
Mecanismo: o "stop-watchdog" (`index.ts`, roda sozinho a cada 5s pra toda
posição aberta, independente do ciclo lento do LLM) tinha cache de cotação
de só 8s (mais curto que 2 ticks de 5s) e até 3 retries por chamada
(`QUOTE_RETRY_ATTEMPTS`) — sob rate-limit sustentado da conta, virava bola
de neve só no símbolo com posição aberta. Corrigido:
- `QUOTE_CACHE_TTL_MS` 8s → 12s (`mt5Broker.ts`).
- Watchdog trocado pra `getQuoteSingleAttempt` (nova função, sem retry) —
  ele já tenta de novo sozinho no próximo tick, não precisa insistir 3x na
  hora. `getQuote` original (com retry) mantido pro ciclo principal do LLM
  (`agent.ts`), que roda raro o bastante pra não precisar dessa proteção.

`tsc --noEmit` limpo em `llm-active-brain/`. Processo reiniciado
(`./restart.sh`), confirmado 1 única instância rodando (sem zumbi).

**3ª causa real, mais grave, achada DEPOIS do restart:** logo após reiniciar
o motor, uma rajada de chamadas (cesta inteira + LLM checando símbolo por
símbolo) saturou a conta **de verdade, momentaneamente, para vários
símbolos** (confirmado ao vivo via `curl` direto no endpoint:
`EURUSD: HTTP 429`, `XAUUSD: HTTP 504`, `NAS100: HTTP 504`). Isso se
dissipou para a maioria dos símbolos em ~2min, mas **o tick/preço "ao vivo"
do NAS100 continuou literalmente parado** (mesmo `timestamp` do tick,
`2026-09-03T20:22:17.998Z`, se repetindo por 12+ minutos em requisições
sucessivas) — feed real do broker (Infinox/MetaAPI) travado nesse símbolo
especificamente, fora do nosso controle. **Os candles do corpo do gráfico
continuaram funcionando normalmente** (`/mt5-candles-history` respondendo
200 OK o tempo todo) — só o preço/variação do topo (ticker ao vivo) ficou
desatualizado.

## Achado estrutural — a causa do "não pode ficar desse jeito"

Mesmo com os dados voltando, o Cleber continuou vendo "carregando
carregando carregando". Causa raiz de UX real, não só de dado: a tela de
loading/erro do `ChartView.tsx` (`candlesLoading`/`candlesLoadFailed`)
cobria o gráfico **inteiro** com overlay bloqueante em **qualquer** falha
de refresh — mesmo quando o gráfico JÁ estava carregado e funcionando na
tela. Uma única instabilidade transitória (que é crônica, documentada,
vai continuar acontecendo) apagava um gráfico bom e prendia o usuário
atrás de spinner/erro até o próximo retry funcionar.

**Corrigido** (`ChartView.tsx`, commit `0636353a2`, já aplicado pelo
Cleber): novo ref `hasEverRenderedCandlesRef` — marca quando o
símbolo/timeframe atual já renderizou candle real pelo menos uma vez.
- Overlay bloqueante (tela preta, spinner ou erro) só aparece agora na
  **primeira carga de verdade** (`!hasEverRenderedCandlesRef.current`).
- Se o gráfico já carregou e um refresh seguinte falha, vira um **badge
  pequeno, não-bloqueante**, no canto superior direito ("Reconectando..."
  ou "Dados de X desatualizados" + botão "Tentar de novo") — nunca mais
  esconde o gráfico já carregado.

`tsc --noEmit`: zero erro novo (só o ruído pré-existente documentado de
"Stocks US/BR/EU/UK").

## Pendências reais

- Fix defensivo de `document.hidden` em `RealMarketDataService.ts`
  (cenário de múltiplas abas) — **não commitado ainda**, comando acima.
- O travamento do feed de tick do NAS100 (broker real, fora do nosso
  controle) pode se repetir com qualquer símbolo, a qualquer momento — o
  fix desta sessão é de **degradação graciosa** (nunca mais trava a UI
  inteira por causa disso), não elimina a causa raiz externa (rate-limit
  crônico da conta MetaAPI compartilhada, já documentado no CLAUDE.md).
- Nenhuma validação estatística envolvida — são fixes de mecânica/UX, não
  de edge.
