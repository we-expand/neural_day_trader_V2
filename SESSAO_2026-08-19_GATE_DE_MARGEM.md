# Sessão 2026-08-19 (parte 2) — Dimensionamento de Posição: Gate de Margem por Leverage

> **Resumo rápido:** Cleber levantou ponto correto sobre dimensionamento de
> posição (0,01 lote de BTCUSD ≠ 0,01 lote de UKOUSD em exposição
> financeira). Investigação em 3 etapas encontrou que o motor já faz sizing
> baseado em risco em dólar (não lote fixo), mas **nunca usava `leverage` do
> catálogo** — lacuna real, confirmada por pesquisa de mercado e implementada
> nesta sessão como gate de margem. Commitado (`fb696f8d4`) e pushado pelo
> Cleber — **push não apareceu na Vercel, ponto em aberto e preocupante,
> não investigado ainda**.

---

## Contexto de entrada

Continuação da mesma sessão de
[SESSAO_2026-08-19_LIMPEZA_POSICOES_ZUMBIS.md](SESSAO_2026-08-19_LIMPEZA_POSICOES_ZUMBIS.md)
(zumbis limpos, cron desabilitado, diagnóstico de baixa performance = sem
edge). A partir daí, dois assuntos novos:

1. Cleber escolheu **"reduzir custo por trade"** como direção pra performance
   (ver opções apresentadas em AskUserQuestion — as outras eram "retomar
   busca por edge" e "aceitar o modelo e redefinir meta").
2. No mesmo gancho, levantou observação própria: viu a IA operar UKOUSD e
   depois BTCUSD com o mesmo número de "contratos" — perguntou se
   0,01 de um não é uma exposição financeira diferente de 0,01 do outro, e
   se o motor deveria "aumentar a mão" em ativos que rendem pouco por ponto
   e diminuir em ativos que rendem muito.

**Nota**: a discussão de "redução de custo por trade" (opção escolhida) foi
**interrompida** pelo ponto de dimensionamento e não foi retomada nesta
sessão — fica pendente pra próxima.

---

## Investigação — 3 rodadas em sequência (3 agentes Explore/background)

### Rodada 1 — como o dimensionamento funciona hoje

Achado: **não é lote fixo**. O motor ao vivo
(`src/app/services/strategy/runTradingCycle.ts:1082-1201`) usa
fixed-fractional em dólar (regra de Van Tharp):

```
fixedRiskCapital = allocatedCapital × (riskPerTrade% / 100) × sizeMultiplier
tradeCapital = fixedRiskCapital / stopDistancePercent
```

Isso já iguala o **risco em dólar** entre instrumentos com o mesmo `risco%`
e `%` de stop — resolve parcialmente a preocupação do Cleber. `pointValue`
por instrumento vem do catálogo corrigido (`assetDatabase.ts`, fix de
2026-08-05/08-10). Teto (`maxContracts`, fix 2026-08-17 achado com Solana
~20 lotes) e piso (`MIN_EXECUTABLE_NOTIONAL_USD` ~$10, pula trade em vez de
inflar, fix 2026-08-16) já existiam.

Hipótese inicial ("0,01 fixo pros dois") não confirmada nessa rodada — mais
provável ser coincidência do `minLot` do catálogo (ambos os instrumentos têm
`minLot: 0.01`).

### Rodada 2 — arredondamento final antes do envio da ordem

Achado mais importante: a conversão nocional($) → lote só acontece em
`src/app/modules/tradeConfirmationStage/lotSizeConversion.ts`
(`amountToLotSize()`), **separada** do cálculo de risco. Arredonda pra
**baixo** (floor) usando `minLot` como proxy de step, e **rejeita o trade**
(`volume: 0`) se cair abaixo do mínimo — não colapsa silenciosamente pro
mínimo.

Reconstrução analítica (conta hipotética de $50, risco 1%, stop 2%): tanto
BTCUSD quanto UKOUSD dariam `tradeCapital = $25`, mas convertido pra lote
ambos ficam **abaixo do `minLot`** e seriam **rejeitados** — não "sempre
0,01". Esse gate de rejeição não tinha telemetria (`vetoStage`) equivalente
aos outros gates do funil.

### Rodada 3 — verificação com dado real (queries do Cleber no SQL Editor)

- `broker_order_executions` (ledger com `volume` = lote real enviado à
  corretora): **vazia**. Confirma que **nunca houve execução real
  registrada** — tudo sobre arredondamento de lote era, até este ponto,
  inteiramente teórico.
- `ai_trades.quantity` (capital em $, não lote) por símbolo, últimos 14 dias:
  variação real entre símbolos (de $20 a ~$2000) — confirma que o sizing não
  é um valor fixo. Mas **dois trades bateram exatamente no piso de
  `$10.00`** (`UKOUSD`, `XAUUSD`) — sinal de que o risco calculado pelo
  motor queria arriscar *menos* que $10 e foi **empurrado pra cima** até o
  piso, na direção oposta da convenção "nunca aumentar risco além do
  calculado" (contradição não resolvida nesta sessão, ver pendências).

---

## O que foi implementado — Gate de Margem

**Achado raiz**: `leverage` (já existe por instrumento em
`assetDatabase.ts`, ex. FOREX_MAJOR 500-1000x, CRYPTO 5x) **nunca entrava em
nenhum cálculo de sizing**. O comentário original em `lotSizeConversion.ts`
dizia explicitamente: *"leverage do asset é informativo de UI, não entra
nesta conta"*. Ou seja: dois ativos com o mesmo nocional em dólar podiam
exigir margens radicalmente diferentes, e nada verificava se a conta tinha
margem livre suficiente antes de abrir.

**Pesquisa de mercado** (Alpari, Pepperstone, BlackBull, XTB — 2026-08-19):
fórmula padrão é `margem = nocional / leverage`. Confirmado também via
Infinox (TradersUnion/BrokersView): margin call aos 50% do margin usado,
stop-out aos 20%.

**Código** (commit `fb696f8d4`, já pushado pelo Cleber):

- `src/app/services/strategy/TradeSizing.ts`:
  - `MAX_MARGIN_UTILIZATION_PERCENT = 0.3` (30% do balance por trade —
    escolha de segurança, não medida; deixa espaço pra múltiplas posições e
    drawdown antes de margin call).
  - `calculateRequiredMargin(notionalUsd, leverage)`.
  - `clampToMarginAffordability(notionalUsd, leverage, availableBalance)` —
    reduz o nocional (nunca aumenta) se a margem exigida ultrapassar o teto.
  - `calculatePositionSize()` (usado pelo Backtest) ganhou parâmetro opcional
    `leverage` — se omitido, comportamento antigo preservado (não quebra
    chamador nenhum). **Não foi ligado no `BacktestEngine.ts`** de propósito
    — o backtest mede `profitPercent`, não `$`, e misturar leverage ali
    poderia introduzir ruído não relacionado no que já foi medido pra edge.
- `src/app/services/strategy/runTradingCycle.ts` (motor ao vivo): gate
  plugado depois do teto de `maxContracts` e antes do piso de $10 — mesmo
  padrão dos outros clamps.
- `src/app/modules/tradeConfirmationStage/lotSizeConversion.ts`: comentário
  atualizado (leverage agora é considerado, só que rio acima, não nesta
  função).

**Exemplo concreto** (catálogo real, conta de $50):
- BTCUSD (leverage 5x): nocional de $500 exigiria $100 de margem (2× o
  balance). Antes: nada impedia a tentativa. Agora: clampado a no máximo $15
  de margem (30% de $50) → nocional máx. ~$75.
- UKOUSD (leverage 100x): mesmo nocional de $500 exige só $5 de margem — não
  é clampado.

`npm run validate` passou limpo (37/37 + suítes de risco) nas duas rodadas
de edição.

---

## ⚠️ Pendência nova e urgente — push não apareceu na Vercel

Cleber reportou, ao final da sessão: **"o push não subiu para Vercel e isso
é preocupante"**. Mensagem interrompida antes de qualquer detalhe (branch,
qual commit, se é a URL de alias `dev` ou outra). **Não investigado nesta
sessão** — é o primeiro item da próxima.

Pontos de partida pra investigar (ver seção "Ambientes e branches" do
[CLAUDE.md](CLAUDE.md)):
- Confirmar qual commit o Cleber esperava ver (`fb696f8d4`? outro?) e se o
  push de fato chegou no GitHub (`git log origin/dev` ou equivalente).
- Confirmar que ele está olhando o alias de branch
  (`neural-day-trader-v2-git-dev-cleber-coutos-projects.vercel.app`), não uma
  URL de deployment com hash (imutável, nunca atualiza — já causou confusão
  idêntica antes, ver CLAUDE.md).
- Checar painel da Vercel: build falhou? Build travado? Branch errada
  conectada?

---

## Pendências reais em aberto (herdadas + novas desta sessão)

1. **[NOVO, URGENTE] Push não aparece na Vercel** — ver seção acima. Primeiro
   item da próxima sessão.
2. **[Retomado de LIMPEZA_POSICOES_ZUMBIS] Zumbis — causa raiz diagnosticada,
   fix NÃO implementado.** Mecanismo duplo: (a) nada monitora TP/SL de
   posições `OPEN` quando a sessão sai de `RUNNING` — nem client nem
   `ai-runner`; (b) zero reconciliação contra estado real da corretora.
   Fix proposto (4 itens) descrito na resposta da sessão anterior, não
   escrito ainda:
   - Watchdog de posição órfã (novo passo no `ai-runner`, independente do
     estado da sessão).
   - Desacoplar `positionManagerTick` do filtro `status='RUNNING'`.
   - Timeout/alerta quando tick de preço falha repetidamente (hoje é
     `continue` silencioso indefinido).
   - Cliente passa a usar Supabase Realtime (`postgres_changes`) em vez de
     polling condicional a `isActive`.
3. **[NOVO] Piso de $10 (`MIN_EXECUTABLE_NOTIONAL_USD`) pode estar inflando
   risco em vez de pular trade** — achado na Rodada 3 (query real: UKOUSD e
   XAUUSD bateram exatamente `$10.00` de mínimo). Contradiz a convenção
   documentada ("nunca aumentar risco além do calculado", mesma frase usada
   pro fix de 2026-08-16 que essa nova observação parece contradizer). Não
   investigado a fundo — precisa reler o código do piso (`runTradingCycle.ts`
   linha ~1191) puxando o efeito real desses 2 trades específicos antes de
   decidir se é bug ou comportamento aceito conscientemente.
4. **[Retomado, não avançado] Redução de custo por trade** — Cleber escolheu
   essa direção antes de pivotar pro assunto de dimensionamento. Opções já
   levantadas (não implementadas): restringir universo de ativos às classes
   mais baratas (`CostModel.ts`), revisar o experimento R:R 1:1,5→1:3 do
   preset 5 (rodando desde 08-17, "reverter se taxa de acerto cair" —
   ninguém revisou ainda), auditar se `CostViabilityGate.ts` está de fato
   recusando os trades mais caros.
5. **[Herdado, sem mudança] Item 7 do CLAUDE.md** — arquitetura
   cliente/servidor de 2026-08-18 ainda não testada contra Supabase real.
6. Demais itens do CLAUDE.md (Item 0 meta de trades/dia, Item 3 roteamento
   cripto, Item 5 modelo financeiro, Item 6 probabilidade calibrada) — sem
   mudança nesta sessão.

---

## Convenções respeitadas

- ✅ Sem commit/push automático — comandos entregues prontos, Cleber rodou
  ele mesmo (confirmado: commit `fb696f8d4` existe no log).
- ✅ Pesquisa de mercado citada com fonte antes de codar (Alpari, Pepperstone,
  BlackBull, XTB).
- ✅ Nenhum dado fabricado — exemplos numéricos vêm de constantes reais do
  catálogo (`assetDatabase.ts`) ou de queries reais rodadas pelo Cleber.
- ✅ `npm run validate` rodado e limpo antes de considerar a mudança pronta.
- ✅ Comunicação em Português Brasil.
