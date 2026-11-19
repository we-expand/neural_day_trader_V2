# Sessão 2026-09-13 — Consultoria: como testar o LLM Brain com dinheiro real sem perder muito

**Status**: Cleber decidindo com calma. Nenhum código alterado nesta sessão —
só investigação/consultoria.

## Pedido do Cleber

Consultoria sobre qual o melhor modo de testar o motor (LLM Brain) com
dinheiro real, minimizando o risco de perder muito dinheiro. Preocupação
concreta declarada: "colocar $300 nessa história e perder os $300".

## Contexto que embasou a resposta (fatos já catalogados no projeto)

- O motor já foi testado com dinheiro real 2x, ambas terminaram mal:
  - 2026-09-09: $22 → Stop Out ($0), agravado por erro de operação (4
    posições opostas na mesma conta pequena).
  - 2026-09-11: saldo real caiu a $9,11, drawdown real de ~49-50% contra o
    capital alocado ($54).
- Causa dominante nos dois casos não foi "a IA errou a direção" — foi conta
  pequena demais pra absorver qualquer erro (mecânico ou humano). Ex.: 1
  lote mínimo de BTCUSD já consome vários % de risco numa conta de $20-100.
- O projeto **nunca validou edge direcional comprovado** — seção "Cérebro de
  decisão da IA" do `CLAUDE.md`: busca sistemática não achou edge, EV por
  trade ≈ `−custo`. Isso muda a pergunta de "como não perder" pra "quanto
  estou disposto a pagar pra descobrir se há alguma chance real".

## Recomendação dada (resumo)

1. **Não repetir o padrão de capital pequeno demais pra sobreviver a um
   imprevisto.** As duas quebras anteriores testaram sobrevivência ao acaso
   de curtíssimo prazo, não a estratégia.
2. **Separar "testar a mecânica" de "testar o edge".** Mecânica (ordem real
   chega, SL/TP reais funcionam, circuit breaker trava de verdade,
   reconciliação não perde posição) pode ser validada com o mínimo absoluto
   aceito pela corretora — tratado como 100% perdível de propósito, não como
   "o teste real".
3. **Só depois da mecânica provada, decidir sobre capital maior** ($300 ou
   o que for) — e tratar como orçamento de pesquisa: valor que se decide de
   antemão que pode não voltar, não "investimento com risco controlado".
4. **Travar um stop de CONTA duro e automático** (não só por trade) antes de
   ligar de novo — perdeu X% do capital de teste, motor para e não religa
   sozinho.

## Achado técnico real desta sessão (código verificado, não suposição)

Checado em `llm-active-brain/src/`:

- `mt5MaxRiskPctPerTrade` está em **6%** por trade por padrão de fábrica
  hoje (`config.ts:262`) — alto demais pra um teste de mecânica com capital
  pequeno.
- **O único circuit breaker automático que existe (`liveExecution.ts`) trava
  por falha TÉCNICA de execução** (timeout, erro da corretora, posição sem
  confirmação de `positionId`) — nunca por perda acumulada da conta.
- `dailyLossLimitPct` (`neuralBridge.ts:410`/`tools.ts:1141`) é a única
  trava relacionada a perda que existe hoje, e ela:
  - só **bloqueia abrir posição nova** (não fecha nada, não para o
    processo);
  - **reseta a cada dia** (não é acumulado de todo o teste);
  - não existe, hoje, nenhuma trava de "drawdown acumulado do capital de
    teste → parar o motor de vez, sem religar sozinho".

**Gap real, não implementado ainda**: uma trava de drawdown de CONTA (não
por trade, não diária) que pare o processo automaticamente e não religue
sozinho. É pré-requisito, na minha visão, pra qualquer novo teste com
dinheiro real — ainda não construído, aguardando decisão do Cleber sobre
valores antes de eu codar.

## Plano de teste mínimo de mecânica (proposto, não implementado)

1. Capital: ~$30, tratado como 100% perdível — teste separado do de $300,
   objetivo é só provar a engrenagem, não lucro.
2. Construir a trava de drawdown de conta (gap acima) antes de ligar.
3. Reduzir `mt5MaxRiskPctPerTrade` só para esse teste via `.env` (não mexer
   no default do resto do sistema).
4. Checklist pré-ligar: confirmar que os fixes de 2026-09-11/13 (fechamento
   fantasma, stop de fim de semana, circuit breaker que ficou preso)
   realmente estão ativos no PROCESSO RODANDO, não só commitados no
   histórico.
5. Critério de parar e não religar sozinho, decidido por escrito agora, não
   no calor da hora.

## Pendente

**Cleber vai decidir os números (capital do teste de mecânica, % de
drawdown que dispara a trava, `mt5MaxRiskPctPerTrade` reduzido) com calma,
antes de qualquer código ser escrito.** Nenhuma ação de código foi tomada
nesta sessão — nem a trava de drawdown de conta, nem redução de risco por
trade. Retomar quando ele trouxer os valores.
