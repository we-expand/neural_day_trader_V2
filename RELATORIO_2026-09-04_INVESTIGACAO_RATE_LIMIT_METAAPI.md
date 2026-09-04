# Investigação profunda: rate-limit/feed travado da MetaAPI — causa raiz e solução

> Pedido do Cleber: "vamos ajustar essa história da API da MetaTrader. Tem
> algo errado. Quero pesquisa profunda do que ocorre e solução. Não podemos
> ficar tomando rate-limit a todo momento, mesmo pagando mais e sendo
> dedicado."

## Resposta direta primeiro

**O teto que está causando o problema não muda com plano pago.** Confirmado
contra a documentação oficial da MetaAPI
([metaapi.cloud/docs/client/rateLimiting](https://metaapi.cloud/docs/client/rateLimiting/)):

> "You can execute a maximum of **5 concurrent historical market data
> requests per account**"

Esse limite é **fixo, por conta, sem tier diferenciado documentado** — não é
algo que se resolve comprando um plano mais caro ou uma conta "dedicada"
(a doc não menciona nenhuma estratificação de preço pra esse limite
específico). O upgrade de confiabilidade/IPv4 dedicado que você já fez
antes (2026-09-04, manhã) resolve OUTRO tipo de problema (latência/queda de
conexão) — não este.

**O que É possível**: a MetaAPI permite pedir aumento de cota por suporte,
mediante justificativa ("contact support to request your rate limit quotas
increase, however a justification might be required"). Isso pode ou não
envolver custo adicional — a doc não deixa claro, só que precisa justificar
o pedido. Vale a pena tentar, mas não é garantido, e não depende de mim
conseguir fazer (precisa da sua conta/relação comercial com a MetaAPI).

**A causa raiz real e corrigível hoje era o código, não a conta.**

## O que a investigação encontrou (causa raiz confirmada, não suposição)

O projeto já tinha, em código, o *sintoma* documentado desde hoje de manhã
(`llm-active-brain/src/assetBasket.ts`, comentário de 2026-09-04): a
MetaAPI recusando (`TooManyRequestsError`) quando 8 requisições concorrentes
de candle eram medidas contra uma cesta de 14 símbolos. Isso já tinha levado
a um semáforo local no `llm-active-brain` (`atr.ts`,
`MAX_CONCURRENT_CANDLE_REQUESTS = 3`) — mas essa mitigação só cobria **um
dos dois lados** do problema.

Investigando o outro lado (o backend compartilhado,
`supabase/functions/server/index.ts`), achei que **3 rotas diferentes**
batem no mesmo endpoint de `historical-market-data` da MetaAPI, e **nenhuma
delas tinha limite de concorrência alinhado ao teto real de 5**:

| Rota | Quem chama | Concorrência ANTES do fix |
|---|---|---|
| `/mt5-prices` | Dashboard, Gráfico, boleta, `llm-active-brain` (preço) | até **8** símbolos em paralelo, cada um disparando seu próprio fetch de candle (`mapWithConcurrency(symbols, 8, fetchOnePrice)`) |
| `/mt5-candles` | `llm-active-brain` (ATR/indicadores) | sem limite próprio (o limite de 3 do `atr.ts` é do lado cliente, não da rota) |
| `/mt5-candles-history` | Gráfico (histórico/backtest) | paginação sequencial dentro de si mesma, mas sem coordenação com as outras 2 rotas |

**O achado central**: mesmo com o `llm-active-brain` respeitando seu próprio
limite de 3, a rota `/mt5-prices` sozinha (usada por qualquer aba de
Dashboard/Gráfico aberta, MAIS o próprio `llm-active-brain` quando busca
preço) já conseguia disparar até 8 chamadas de candle concorrentes —
**3 acima do teto real da conta inteira**, antes de somar mais nada. Some
o `llm-active-brain` rodando ao mesmo tempo, e o pico combinado passava
facilmente de 10+ concorrentes contra um teto de 5. Isso explica os
"429/feed travado/SIMULATED" documentados no `CLAUDE_HISTORY.md` há meses,
nunca com uma causa raiz unificada antes — cada sessão investigava um
sintoma isolado (um símbolo, um horário) sem nunca juntar os dois lados do
sistema batendo na mesma conta ao mesmo tempo.

## O que foi corrigido agora

1. **Semáforo compartilhado, no nível do módulo, nas 3 rotas do backend**
   (`supabase/functions/server/index.ts`): `acquireHistoricalDataSlot()` /
   `releaseHistoricalDataSlot()`, limite de **2 concorrentes**, envolvendo
   literalmente o único ponto de cada rota que faz `fetch()` contra
   `historical-market-data`. As 3 rotas agora competem pelo MESMO orçamento
   de 2, em vez de cada uma ter (ou não ter) o próprio limite isolado.
2. **Semáforo do `llm-active-brain` reduzido de 3 para 2**
   (`llm-active-brain/src/atr.ts`) — 3+2 ficava exatamente em cima do teto
   real (5), sem nenhuma margem; 2+2 deixa 1 unidade de folga real pra
   qualquer pico simultâneo dos dois lados.
3. `tsc --noEmit` limpo no `llm-active-brain`. Backend (Deno/Hono) não tem
   `deno check` funcional neste ambiente local (falta configuração de
   `node_modules`/`deno.json` pro `npm:hono`, problema preexistente, não
   introduzido agora) — validado manualmente lendo as 3 regiões editadas
   linha a linha + checagem de sintaxe via `tsc` ignorando só os erros de
   ambiente Deno (nenhum erro novo nas linhas tocadas).

## Limite honesto desta mitigação

Isto **não é um limitador distribuído de verdade**. Cada semáforo (backend
e `llm-active-brain`) só enxerga a si mesmo:

- O do backend é **por isolate** da Edge Function — se o Supabase escalar
  a função pra mais de 1 isolate simultâneo sob carga alta (comum em
  serverless), cada isolate teria seu próprio contador de "2", e o total
  real entre isolates poderia ultrapassar 2 (embora ainda muito melhor que
  os 8 de antes).
- Não há coordenação real entre o processo Node do `llm-active-brain` (sua
  máquina) e a Edge Function (servidor da Supabase) além de cada um
  respeitar seu próprio teto local.

**Fix definitivo, se o rate-limit persistir mesmo com esta mitigação**: um
semáforo distribuído de verdade (contador atômico em Postgres, ou
`pg_advisory_lock`), compartilhado entre TODOS os consumidores reais
(Edge Function + `llm-active-brain`), respeitando o teto de 5 da conta
inteira. Não implementado nesta sessão — é mais invasivo (precisa de uma
tabela nova + lógica de expiração pra não travar se um consumidor cair no
meio de uma chamada) e vale medir primeiro se a mitigação de hoje já resolve
na prática antes de justificar esse investimento.

## Ação que só você pode tomar

Se, mesmo com o fix de hoje, o rate-limit continuar acontecendo com
frequência incômoda: abrir um ticket de suporte com a MetaAPI pedindo
aumento de cota de "concurrent historical market data requests", com
justificativa (cesta de N símbolos, motor headless 24/7 + dashboard/gráfico
de usuários simultâneos). Não corre por minha conta — precisa da sua
credencial/relação comercial com eles.

## Fontes

- [Rate limiting — MetaApi docs oficiais](https://metaapi.cloud/docs/client/rateLimiting/)
