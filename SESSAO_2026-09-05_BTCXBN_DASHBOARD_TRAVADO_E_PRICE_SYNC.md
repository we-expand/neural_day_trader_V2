# Sessão 2026-09-05 — Dashboard travado (BTCXBN), fechamento manual suspeito e fix no Price Sync

## Contexto

Cleber pediu monitoramento contínuo do LLM Brain de 5 em 5 min, com meta de
"quando perder, perder pouco; quando ganhar, ganhar muito". Antes de mexer em
qualquer parâmetro, os dados (`ai_trades`, Supabase) mostraram que **hoje
(04/09) foi o pior dia da semana**: 29 trades, 34,5% de acerto, -$50,63
líquido, payoff invertido (ganho médio $1,39 vs perda média -$3,40).

**Achado de processo importante**: o CLAUDE.md já registrava que esse mesmo
padrão (~10 commits mudando stop/trailing/alvo no mesmo dia) foi identificado
hoje como causa da queda de acerto, e um llm-council já tinha decidido
**congelar mecânica de stop/trailing/alvo/R:R por 5 dias úteis / mínimo 40
trades fechados** antes de qualquer novo ajuste. Como o pedido de "otimizar
performance" batia de frente com essa trava, perguntei ao Cleber antes de
agir — ele confirmou: **respeitar o congelamento**, monitorar sem tocar em
mecânica, só corrigir bugs reais de código.

## Achado 1 (resolvido): Dashboard/Gráfico travados em preço zero — causa BTCXBN

Cleber reportou Dashboard preso em `0000.00`, "desatualizado", gráfico do
BTCXBN nunca carregando candle.

**Causa raiz confirmada nos logs ao vivo do Supabase**: `BTCXBN` foi
cadastrado no catálogo (`assetDatabase.ts`) como `category: 'CRYPTO'`, mas
**nunca foi adicionado ao whitelist de roteamento pro broker**
(`CRYPTO_CFD_AVAILABLE.infinox` em `brokerRegistry.ts`) — mesmo padrão de bug
já visto antes nesse mesmo Set (XETXBN/XETXLC faltando em sessões
anteriores). Sem essa entrada, `RealMarketDataService.ts` roteava BTCXBN pra
Binance direta, que monta `BTCXBNUSDT` — par que não existe — gerando HTTP
502 repetido pra sempre (confirmado nos logs do Supabase, dezenas de
tentativas em minutos).

**Tentativa de fix descartada**: cheguei a editar `brokerRegistry.ts` pra
adicionar `BTCXBN` ao Set (roteando pro broker/MetaAPI), mas Cleber
interrompeu: *"Não usamos o API do Metatrader pra moeda. Só usamos
Binance."* — revertido antes de aplicar.

**Conflito real identificado e resolvido com o Cleber**: `BTCXBN` não é um
alias de exibição do Bitcoin normal — é um contrato próprio da Infinox, com
escala de preço totalmente diferente (~321, não ~$79k). A posição real
aberta na hora (`ai_trades` id `3c6111ea-fad8-4547-9690-6e4822cc754d`,
entry 321.579, stop 320.68, alvo 322.99) foi executada de verdade via
MetaAPI/MT5 — mapear o símbolo pra Binance (BTCUSDT, ~$79k) deixaria as
linhas de entrada/stop/alvo numa escala sem relação nenhuma com os candles
reais exibidos. Perguntei explicitamente o que fazer; Cleber escolheu:
**fechar a posição e tirar BTCXBN da cesta**, em vez de consertar o
roteamento.

**Ações tomadas**:
1. `BTCXBN` removido de `ai_user_config.activeAssets` via SQL direto
   (Supabase) — sem mexer em código, efeito em até 60s (cache de config).
   Confirmado no log do motor: tentativas seguintes de `open_position` em
   BTCXBN passaram a ser rejeitadas com "Simbolo fora da cesta permitida".
2. Cleber fechou a posição manualmente pelo botão do Dashboard.
3. Motor (`llm-active-brain`) detectou a posição já fechada no ciclo
   seguinte (tentou fechar ele mesmo, recebeu "não encontrada" — corrida
   inofensiva, sem duplicidade) e confirmou `list_open_positions: []`.

## Achado 2 (delegado, não resolvido nesta sessão): fechamento manual gravou exit_price = entry_price

Ao conferir o registro do fechamento manual do BTCXBN, o `exit_price`
gravado ficou **exatamente igual** ao `entry_price` (321.579 = 321.579, até
a 3ª casa decimal) — `net_pnl` = apenas o custo de spread (-$0,093). Isso é
suspeito: o preço real de mercado no momento (23:58:22 UTC) era ~320,8-320,9,
confirmado no log do motor minutos antes (`get_mt5_quote` retornando
`price: 320.809`).

Hipótese mais provável: o preço do BTCXBN estava indisponível no frontend
(mesmo bug do Achado 1) e o botão de fechar manual caiu num fallback usando
`entry_price` como "preço atual" em vez de falhar explicitamente — o que
seria uma violação direta da convenção do projeto ("nunca fabricar dado" /
"corrigir registro financeiro nunca é update silencioso").

**Não investiguei o handler exato nesta sessão** (não achei rapidamente o
componente que disparou esse fechamento específico). Delegado como task
separada (`task_9aaed442`), que Cleber rodou numa sessão própria.

**[RESOLVIDO 2026-09-04, noite, sessão paralela] Causa raiz confirmada e
corrigida — commit `755d69960`.** `closeManualPosition` caía em
`order.currentPrice || order.price` quando o feed nunca respondia pro
símbolo (exatamente o cenário do BTCXBN com preço travado) — gravava
`exit_price === entry_price` (PnL fabricado em ~zero) sem nenhum sinal do
problema. Fix: campo novo `lastPriceUpdateAt` (`src/app/types/tradingState.ts`)
marca quando `currentPrice` veio de um tick real; sem ele, o fechamento
manual agora é **recusado e reportado ao usuário** em vez de fabricar o
registro financeiro. Já commitado.

## Achado 3 (resolvido): Price Sync do frontend martelando pares inexistentes na Binance

Depois do fix do Achado 1, o Dashboard voltou a travar (preço zero, sem
variação diária) mesmo com BTCXBN fora da cesta do motor. Log do Supabase
mostrou `binance-ticker/BTCXBNUSDT` continuando a dar 502 minutos depois —
a aba do navegador ainda tinha esse símbolo em algum estado de exibição,
independente da configuração do motor.

**Causa raiz de fundo, mais ampla que o BTCXBN especificamente**:
`SupabasePriceSyncService.ts` (`syncAllPrices`) pega **todo** ativo
`category === 'CRYPTO'` do catálogo inteiro e monta `${symbol}USDT` sem
checar se aquele símbolo tem par real na Binance. Isso inclui todos os
contratos exclusivos da Infinox: `BTCXBN`, `XETUSD`, `XBNUSD`, `XLCUSD`,
`BTCEUR`, `BTCBNB`, `BTCETH`, `BTCLTC`, `XETXBN`, `XETXLC` e as variantes
`.crp`. Cada ciclo de sync (a cada 5s) disparava chamada fadada ao fracasso
pra cada um desses, silenciosamente engolida por `.catch(() => null)` — não
trava sozinho, mas soma ruído de rede constante e contribuiu pro sintoma
observado duas vezes na sessão.

**Fix aplicado** (`src/app/services/SupabasePriceSyncService.ts`): lista de
exclusão explícita (`CRYPTO_SYMBOLS_WITHOUT_BINANCE_PAIR`) filtrando esses
símbolos antes de montar a lista de pares pra Binance. Símbolos com par real
(BTCUSD, ETHUSD, SOLUSD, BNBUSD, XRPUSD, ADAUSD, DOTUSD, DOGEUSD, LINKUSD,
etc.) continuam normalmente.

`tsc --noEmit`: 634 erros, mesma contagem já documentada como ruído
pré-existente no projeto — nenhum erro novo.

**Pendente**: commit abaixo, ainda não rodado pelo Cleber.

```bash
git add src/app/services/SupabasePriceSyncService.ts
git commit -m "$(cat <<'EOF'
fix(price-sync): filtra contratos cripto sem par real na Binance antes de montar symbol+USDT

SupabasePriceSyncService montava BTCXBN/XETUSD/XBNUSD/XLCUSD/BTCEUR/BTCBNB/
BTCETH/BTCLTC/variantes .crp como pares USDT inexistentes na Binance, a
cada ciclo de sync (5s), pra sempre -- confirmado gerando dezenas de 502
em minutos e coincidindo com o Dashboard travando em preço zerado.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

Não precisa de deploy de Edge Function nem migration — é código puro do
frontend, sobe automático pela Vercel a partir do push (branch `dev`).

## Achado 4 (verificado, sem bug): nomenclatura do Ethereum entre Binance e MetaTrader

Cleber alertou sobre a mesma classe de risco do BTCXBN, mas pro Ethereum.
Verificado: já está tratado corretamente — `ETHUSD` (nome unificado/exibição)
mapeia pra `ETHUSDT` na Binance (par real); `XETUSD` (nome real do contrato
na Infinox) tem entrada própria no catálogo **e** já está no whitelist de
roteamento pro broker (`CRYPTO_CFD_AVAILABLE.infinox`). O motor já opera com
`XETUSD`, não com `ETHUSD` — preço, stop e alvo na mesma escala real do
broker. Diferente do BTCXBN, aqui o cadastro foi feito certo desde o início.
Nenhuma ação necessária.

## Estado ao fim da sessão

- BTCXBN: posição fechada, removido da cesta ativa. Monitoramento de 5 em
  5 min desligado a pedido do Cleber.
- Stop/trailing/alvo/R:R seguem congelados (decisão do llm-council,
  CLAUDE.md) — nenhum parâmetro de mecânica foi tocado nesta sessão.
- `task_9aaed442` (investigar exit_price = entry_price no fechamento
  manual) concluída — commit `755d69960` já aplicado, fechamento manual sem
  cotação real agora é bloqueado e reportado em vez de fabricar preço.
- Commit do fix do Price Sync (`SupabasePriceSyncService.ts`) pronto,
  aguardando Cleber rodar.
