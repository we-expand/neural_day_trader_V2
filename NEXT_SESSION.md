# Handoff — próxima sessão

> Reescrito em **2026-08-17** (17ª parte — reescrita completa, não empilhada).
> **Regra: este arquivo é handoff da sessão CORRENTE. Reescreva, não empilhe.**

## ▶ COMECE AQUI

**Resumo de uma linha**: a IA ligou pela primeira vez com entrada real hoje
(modo scalp, JP225 + SOLUSD), e cada bug real do produto só apareceu depois
disso — 6 bugs achados e corrigidos na mesma sessão, todos com evidência ao
vivo (não teoria). Merge `dev → main` feito (commit `0de9cbb74`) — falta só
`git push` pra valer em produção (Vercel builda a partir de `main`).

## O que precisa acontecer agora, em ordem

1. **`git push`** (branch `main`, merge já commitado localmente). Depois
   disso a Vercel builda sozinha (~1-2min) e os 6 fixes abaixo valem no site.
2. **Recarregar a página depois do build** e conferir: gráfico de JP225 abre,
   "Logs do Sistema" mostra atividade, "Capital em Aberto" mudou de nome pra
   "Exposição Total".
3. **Continuar observando o funil** — loop de 10 em 10 minutos rodando nesta
   sessão (CronCreate `c997a820`, expira em 7 dias, morre se a sessão do
   Claude fechar). Foco: confirmar que a PRÓXIMA entrada em ativo barato/
   volátil já sai com lote correto (≤ teto configurado — hoje 0,8 lote).
4. **As 2 posições já abertas (SOLUSD 20,27 lotes, JP225 0,05 lotes) não
   foram corrigidas retroativamente** — o teto de lote só vale pra entradas
   novas. Decidir se fecha manualmente a Solana (exposição fora do
   configurado) ou deixa rodar até fechar sozinha.

## Os 6 bugs desta sessão (todos corrigidos, nesta ordem de descoberta)

Contexto: Cleber ligou a IA (modo scalp) depois dos fixes da rodada anterior
(motor duplo, sizing v1). Pela primeira vez em dias, saíram 2 execuções reais
— JP225 SHORT e SOLUSD LONG. Observar essas 2 operações ao vivo, na tela,
revelou uma bugs atrás do outro, cada um só visível com trade real rodando.

1. **Fórmula do modo "Ajustado por ATR" (sizing) era matematicamente
   inválida** — `runTradingCycle.ts`. Reescalava o risco em $ por uma razão
   que não dependia do preço do ativo (impossível pra um nocional válido).
   Resultado: nocional sempre ~igual ao risco em $ bruto, sempre abaixo do
   piso de $10, pra qualquer multiplicador/ativo numa conta de $100. Era a
   causa raiz de dias inteiros sem nenhuma entrada. Corrigido pra
   fixed-fractional de verdade (Van Tharp), igual ao modo FIXED já fazia.
   `positionSizingPreview.ts` reescrito em consequência (não dá mais número
   exato sem preço/ATR real — vira qualitativo nos dois modos).

2. **`MARKET_MODE_REGIME_MISMATCH` era veto duro**, inclusive quando o
   Market Score mede regime `INDEFINIDO` (o caso mais comum). Com
   `marketMode: 'TREND'` como padrão de sessão nova, bloqueava quase toda
   avaliação fora de tendência limpa — maior bloqueio do dia antes do fix
   (2.526 vetos em 2 sessões). Convertido pro mesmo padrão que já existia
   pra regime LATERAL: `INDEFINIDO` não bloqueia mais; regime que CONTRADIZ
   exige confiança extra (+15 pontos) em vez de vetar sempre.

   → Depois destes 2 fixes + deploy, saíram as 2 primeiras execuções reais
   do dia (JP225 SHORT, SOLUSD LONG). A partir daqui, os bugs abaixo foram
   achados observando essas 2 operações na tela.

3. **`aiConfig.maxContracts` ("Lotes Máximos por Trade") nunca era lido no
   motor ao vivo.** Confirmado com número exato: SOLUSD abriu com 20,27
   lotes calculados, config travada em 0,8 — 25x acima, sem gate nenhum
   barrando. JP225 saiu pequeno (0,05 lotes) só por coincidência de preço
   alto, mascarando o bug até aparecer num ativo barato/volátil. Corrigido:
   teto duro aplicado depois do cálculo de sizing — reduz o nocional, nunca
   aumenta. **Não retroativo** (item 4 da lista acima).

4. **Tela não atualizava com trade aberto pelo servidor.** Desde o fix do
   "motor duplo" da rodada anterior (navegador parou de decidir sozinho em
   DEMO), a hidratação do Supabase só rodava 1x por montagem da página, sem
   realtime nem polling — a tela congelava no estado do primeiro carregamento
   e nunca mais sabia que o runner tinha aberto/fechado posição. Corrigido:
   polling de 15s (`useApexLogic.ts`) enquanto a IA está ativa em DEMO,
   resincroniza posições abertas do Supabase.

5. **Dois lugares na tela somavam exposição em dólar e rotulavam como
   "lotes"/"margem"**:
   - `MarketScoreBoard.tsx` (Dashboard): cabeçalho "Posições Abertas"
     mostrava "4.893,00 lotes total" (soma de `order.amount` em $) quando o
     real era ~20,3 lotes. Corrigido pra somar a mesma conversão usada por
     posição individual (nocional / (lotSize × preço)).
   - `AITrader.tsx`: card "Capital em Aberto" / "Margem investida" mostrava
     $4.893 numa conta de $92 (53x o patrimônio) — não é margem, é exposição
     nocional somada. Renomeado pra "Exposição Total" / "Nocional das
     posições abertas".

6. **Gráfico de JP225 nunca abria.** `SymbolMappingService.ts` tinha
   `unified: 'JPN225'` pra esse ativo — desatualizado desde a renomeação de
   2026-07-16 pro nome unificado `'JP225'` (usado em `assetDatabase.ts` e
   `brokerRegistry.ts`). `findMapping('JP225')` sempre voltava `undefined`
   (nem a chave direta nem o fallback por `infinox`/`yahoo` batiam, porque o
   campo `infinox` desse registro também estava em `'JPN225'`, não
   `'JP225'`). Sem mapping, `fetchCandles` caía no branch "stock ou
   desconhecido: sem fonte de candles" e retornava `[]` sempre — nunca nem
   tentava a MetaAPI. Corrigido: `unified` agora é `'JP225'`.
   Auditoria cruzada rodada nos dois catálogos: mais 4 símbolos com
   `unified` desatualizado (DAX/FTSE/WTI/BRENT) mas **esses não quebram
   nada** — o campo `infinox` de cada um já bate com o nome canônico usado
   no resto do app, então o fallback de busca encontra por ali mesmo. JP225
   era o único caso onde o campo `infinox` também divergia do canônico.

7. **Painel "Logs do Sistema" (AITrader.tsx) ficava vazio pra sempre em
   DEMO**, mesma causa raiz do item 4: só recebia linha via `addLog()`,
   chamado de dentro do efeito `LOG` do `runTradingCycle` — que só roda
   quando o ciclo executa NO NAVEGADOR (desligado em DEMO desde o fix do
   motor duplo). O painel "Terminal" (`LiveLogTerminal.tsx`) não tinha esse
   problema porque deriva log de `activeOrders` mudando. Corrigido:
   reaproveitado o mesmo polling do item 4 pra também chamar `addLog()`
   quando detecta posição nova.

## Verificação desta sessão

- `npm run validate`: verde em cada mudança (265 asserções, mesma suíte).
- `tsc --noEmit` full: 578 erros — igual à baseline pré-existente em toda
  mudança, zero erro novo introduzido.
- `deno check` do runner: limpo depois de cada mudança que tocou o motor
  compartilhado (`runTradingCycle.ts`).
- **Verificação em produção real**: sim, pela primeira vez nesta rodada — 2
  execuções reais observadas ao vivo (`ai_decisions`/`ai_trades`), e os bugs
  3-7 acima só foram encontrados PORQUE havia trade real na tela pra olhar.
  Confirmado por print do Cleber em 3 momentos diferentes (Dashboard, AI
  Trader, Gráfico).

## Estado do git nesta sessão

- Deploys do `ai-runner` (Supabase Edge Function) feitos direto do disco,
  sem depender de commit: versão 22 → 24 (bugs 1-2) → 25 (bug 3). **Sempre
  commitar depois de deployar** — o deploy sobe o que está no disco local,
  não o que está no git; um fix pode estar rodando em produção sem estar
  salvo no histórico até o commit acontecer (já aconteceu nesta sessão com
  o bug 3, resolvido a tempo).
- `git merge dev → main` feito nesta sessão (commit `0de9cbb74` em `main`) —
  **falta `git push`** pra valer no site (Vercel builda só a partir de
  `main`). Frontend (bugs 4-7) só vale depois desse push + build; bug 3
  (motor) já está ativo em produção desde o deploy de função, independente
  do push do frontend.
- Arquivos não rastreados vistos nesta sessão, não mexidos (não são desta
  sessão, ignorar por enquanto): `research/experiments/cron-logs/*.log`,
  `supabase/.temp/linked-project.json`,
  `supabase/migrations/20260817_add_missing_veto_stages.sql`.

## Estado herdado, sem mudança nesta sessão

- `COST_TABLE.INDEX` usa spread calibrado no US30, gerando custo ~7x maior
  que o real pra SPX500 só por diferença de escala do índice — precisa de
  spread medido por índice pra corrigir, não é assunção segura de fazer sem
  dado. Registrado, não corrigido.
- Feed de dados dedicado (Twelve Data, ~US$29/mês) — decisão do Cleber ainda
  pendente.
- Roteamento de cripto (Binance direto vs MetaAPI) — decisão do Cleber ainda
  pendente, ver CLAUDE.md item 3.
- Marketplace.tsx com rating/reviews/vendas fabricados (exceto `strat-001`).
- Leverage de trade hardcoded em `1.5` no motor (`runTradingCycle.ts`,
  `newTrade.leverage: 1.5`) pra TODOS os ativos, ignorando o `leverage` real
  de cada um no catálogo (`assetDatabase.ts` — ex: JP225 tem 100, SOLUSD tem
  5). Não corrigido nesta sessão, não confirmado se causa problema prático
  hoje (o campo é usado no cálculo de % de P&L exibido, não no sizing em si)
  — mas é uma divergência real entre o que o catálogo diz e o que o motor
  usa. Vale investigar na próxima sessão se sobrar tempo.
