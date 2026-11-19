# Sessão 2026-08-31 (noite) — Monitoramento 5min do LLM Brain, ajuste de volume/risco, bug de z-index

## Contexto

Cleber pediu monitoramento contínuo (5 em 5 min) do Cérebro LLM Ativo pra
confirmar que a integração da cesta multi-ativo (ver
[SESSAO_2026-08-31_CESTA_AMPLIADA_MULTI_ATIVO_LLM_BRAIN.md](SESSAO_2026-08-31_CESTA_AMPLIADA_MULTI_ATIVO_LLM_BRAIN.md))
estava abrindo posições de verdade. ~40min sem nenhuma entrada, Cleber achou
restritivo demais ("BTC caiu 0,26% e não entrou").

## Achado 1: exigência de confluência, não trava de código

Confirmado no log ciclo a ciclo: BTCUSD estava em tendência BAIXA real
(-0,45%/60min) mas com **volume abaixo do normal** (ratio 0,57, não
"elevado") e sem confluência dos outros indicadores — o agente
corretamente não abriu por falta de convicção, não por bug. 1 ciclo (nº
24) teve reasoning confuso (narrou "entrei SHORT" no texto sem de fato
chamar `open_position` com sucesso) — padrão já catalogado antes
("decisão narrada sem executar"), sem trade real gerado.

## Mudança 1: limiar de volume elevado baixado (1,15x → 1,05x)

A pedido do Cleber, depois de eu explicar que o critério de "volume
elevado" (`VOLUME_ELEVATED_RATIO` em `llm-active-brain/src/atr.ts`) exigia
15% acima da média — ele pediu baixar pra 1,05x (5% acima). Aplicado,
processo reiniciado (`./restart.sh`), `tsc --noEmit` limpo. **Já
commitado** — mas não por mim: outra sessão paralela rodando na mesma
pasta commitou automaticamente (`0fa60d7ec`, autor `we-expand`, 1min
depois do meu restart). Confirmado funcionando: ciclos seguintes já
mostravam BTCUSD/XETUSD com `elevated:true` e setups sendo identificados
de verdade.

## Achado 2: setups passando a existir, mas bloqueados por risco mínimo de lote

Com o volume mais permissivo, o agente encontrou setups reais (BTCUSD
SHORT, XETUSD SHORT) mas ambos foram bloqueados pelo mesmo padrão já
documentado em sessões anteriores: **lote mínimo do ativo nesse preço
excede o teto de risco por trade** de uma conta de $100 (3% = $3,00,
enquanto BTCUSD exigia $3,92 e XETUSD $5,06 de risco mínimo).

## Mudança 2: risco por trade 5% → 8% (via banco, NÃO ESTÁVEL)

A pedido do Cleber, subi `ai_user_config.config.riskPerTrade` de 5 pra 8
via `UPDATE` direto no Supabase (não é código, é config de usuário — a
MESMA tabela que o Setup do AI Trader lê/grava). **Problema real e não
resolvido até o fim da sessão**: o valor voltava sozinho pra 5 repetidas
vezes (23:21, 23:25, 23:37, 23:39, e de novo até o fim, última leitura
23:46:27 UTC ainda em 5).

### Investigação da causa

Descobri que há **duas outras sessões do Claude Code rodando na mesma
pasta** (`neural-day-trader-0a`, `neural-day-trader-6b`) — risco de
processo já documentado várias vezes neste projeto. Contatei as duas via
`SendMessage`:

- `neural-day-trader-0a` confirmou que tinha uma aba do Browser tool em
  `localhost:5173` logada como Cleber, testando a toolbar de desenho do
  gráfico — já fechou a aba E parou o preview server inteiro. Descartou
  ter mexido em `ai_user_config`. Levantou hipótese de `localStorage`
  stale resincronizando (não confirmada, o efeito de hidratação em
  `useApexLogic.ts` lê do Supabase primeiro, não empurra valor antigo
  cego).
- `neural-day-trader-6b` **nunca respondeu** até o fim da sessão (mensagem
  enviada, sem retorno).

Mesmo com `neural-day-trader-0a` confirmando tudo fechado, o valor
continuou revertendo — ou seja, a causa raiz real **não foi identificada
com certeza**. Hipóteses não descartadas: (1) `neural-day-trader-6b` tinha
alguma aba/estado que nunca foi confirmado; (2) algum caminho de código
ainda não localizado que resincroniza `localStorage` antigo pro Supabase;
(3) uma quarta fonte não identificada.

## Achado 3 (colateral, grave em potencial): trade manual acidental por bug de UI

Durante a investigação acima, apareceu 1 trade na sessão do motor com
`ai_reasoning: "Ordem manual do usuário"` e `exit_reason: MANUAL`:
`BTCUSD SHORT`, aberto e fechado em **18 segundos**, `-$0,24`. Cleber
confirmou que não foi ele. `neural-day-trader-0a` identificou a causa
real: **colisão de z-index** — o painel de compra/venda (`OrderTicket`,
`z-[220]` em `ChartView.tsx` linha ~7723) sobrepunha o dropdown de
sub-ferramentas de desenho do gráfico (`DrawingToolDropdown.tsx`,
`z-[200]`) em telas estreitas — um clique de teste na barra de desenho
caiu por cima do botão SELL/BUY sem intenção.

**Corrigido nesta sessão**: `DrawingToolDropdown.tsx` (2 ocorrências) —
z-index subido de `z-[200]` pra `z-[230]` (acima do painel de trade),
comentário explicando o motivo. `tsc --noEmit`: zero erros novos no
arquivo (erros pré-existentes em outros arquivos, não relacionados).
**Não commitado** — comando pronto pro Cleber:

```bash
git add src/app/components/chart/DrawingToolDropdown.tsx
git commit -m "fix(chart): dropdown de sub-ferramentas de desenho fica acima do painel de trade (evita clique acidental em SELL/BUY)"
```

Achado importante: esse mesmo tipo de colisão (na direção oposta — painel
de trade sobrepondo o menu de desenho) já tinha sido catalogado como
"achado colateral não corrigido" na sessão anterior
([SESSAO_2026-08-31_MENU_DESENHO_PRESO_NO_GRAFICO.md](SESSAO_2026-08-31_MENU_DESENHO_PRESO_NO_GRAFICO.md))
— ficou pendente até essa sessão, quando finalmente gerou dano real
(mesmo que pequeno, -$0,24 em DEMO) e foi corrigido.

## Estado no fim da sessão (23:46 UTC, monitoramento desarmado a pedido do Cleber)

- Processo do `llm-active-brain` único, saudável, ciclo 43/8000.
- Sessão ativa do motor: `15d6d602-019b-41bf-85c4-cf8a4f491f28`, 1 trade
  na tabela (o manual acidental, -$0,24) — **zero trades reais do motor**
  até o fim da sessão.
- `riskPerTrade` ainda em **5%** (não 8% como pedido) — problema de
  reversão automática **não resolvido**.
- Limiar de volume elevado em **1,05x** — confirmado funcionando e já
  commitado.
- Bug de z-index corrigido no código, **não commitado**.

## Pendências reais

1. **Investigar por que `ai_user_config.riskPerTrade` reverte sozinho**
   mesmo com as sessões de browser conhecidas fechadas — não resolvido.
   Prioridade alta: enquanto isso persistir, qualquer ajuste de risco via
   banco é temporário (minutos). Caminho mais robusto pra próxima sessão:
   mudar o valor direto pela tela do Setup (fonte "oficial" de verdade,
   evita a briga com o efeito de resync do frontend) e/ou auditar todos os
   componentes que chamam `saveUserAIConfig`/leem `localStorage` com chave
   relacionada a config da IA.
2. Commit do fix de z-index (comando acima).
3. Depois de resolver o item 1, confirmar que o teto de risco maior de
   fato destrava BTCUSD/XETUSD (setups já identificados, só faltando o
   risco não reverter).
4. Observar se os fixes de volume (1,05x) e o de risco (quando estável)
   produzem trades reais do motor nas próximas horas/dias — sem promessa
   de edge, é ajuste de mecânica de captura, não de acerto direcional.
