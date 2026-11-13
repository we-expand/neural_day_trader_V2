# Sessão 2026-09-04 — Assimetria ganho/perda no LLM Brain + cap de alvo travando rompimentos de topo

## Contexto

No dia 02/09 o LLM Brain (`llm-active-brain`) chegou a 80% de acerto e fechou
o dia positivo — mas Cleber notou que o padrão era "ganha pouco, quando perde,
perde muito" (o oposto do desejado). Pedido: investigar com dado real e
corrigir a mecânica de saída, sem prometer edge novo.

## Parte 1 — Diagnóstico via SQL direto (não suposição)

Consulta na sessão `1d73c50a-cc28-4ab2-a939-a59361a22fda` (18 trades
fechados, 02/09, tabela `ai_trades` no Supabase):

- **14 vitórias, 4 perdas (77,8%, bate com o "80%" reportado)**
- **Ganho médio: $1,70/trade | Perda média: $3,97/trade** — proporção ~1:2,3
- **Trailing capturava só 0,6-1,0R nos vencedores** (`r_multiple_realized` =
  distância percorrida ÷ distância do stop original) — quase nenhum
  vencedor passou de 1R antes do trailing fechar a posição
- O `take_profit` configurado implicava R:R teórico de até 5:1-12:1 em
  vários trades, mas o trailing (`MT5_TRAIL_ATR_MULTIPLIER=1,6x`, breakeven
  em `0,5R`) fechava o lucro muito antes de chegar perto — o alvo virava
  decorativo
- As 4 perdas eram os trades de maior risco em $ (XETUSD, BTCUSD) — o stop
  em si foi respeitado corretamente (perdas em ~0,6-1,1R, não "estouraram")

**Correção importante que fiz durante a análise**: o "R:R de 12:1" que medi
inicialmente era um artefato — usei o `stop_loss` do banco, que já tinha
sido movido pelo breakeven/trailing quando o trade fechou, então a
distância de risco usada no cálculo era artificialmente pequena. O R:R
*original* configurado na abertura é limitado (1,5:1 a 5:1 conforme
"Poucos/Médio/Muitos") e ainda capado pela distância real até
suporte/resistência — não é desenhado pra ser um alvo impossível.

## Parte 2 — Fixes de mecânica de saída (commit `13c204462`)

Pedidos diretos do Cleber durante a sessão: *"o stop tem que ser sempre
menor que o alvo, estava muito largo"* e *"quando ganhar, ganhar muito,
quando perder, perder pouco"*.

1. **Stop mais justo**: `MT5_STOP_ATR_MULTIPLIER` default 2,0x → 1,3x ATR.
   Com o alvo (4,0x ATR) inalterado, R:R teórico sobe de 1:2 pra ~1:3.
2. **Trailing em estágio**: depois que o lucro flutuante passa de 1R (medido
   contra a distância **original** do stop — precisa ser fixa, porque
   `stop_loss` muda com breakeven/trailing), o trailing passa a usar uma
   distância mais larga (`MT5_TRAIL_ATR_MULTIPLIER_WIDE=2,2x` em vez de
   0,8-1,6x) — deixa o vencedor correr mais em vez de travar perto de 1R.
3. **Realização parcial mecânica**: ao atingir 1R (`MT5_PARTIAL_TP_TRIGGER_R`),
   realiza 40% da posição (`MT5_PARTIAL_TP_FRACTION`) como um trade `CLOSED`
   novo (`exit_reason='TP'`) — nunca `UPDATE` silencioso no trade original,
   mesma convenção de `mirrorSell`/regra de auditoria financeira do projeto
   (ver CLAUDE.md). Reduz a `quantity` do trade `OPEN` original e marca
   `partial_tp_taken=true` (só dispara 1x por posição).
4. **Migration nova, já aplicada pelo Cleber**: coluna
   `original_stop_distance` em `ai_trades` (`20260904_add_original_stop_
   distance_to_ai_trades.sql`) — necessária porque `stop_loss` muda de
   valor com breakeven/trailing, então sem essa referência estável não dá
   pra saber quantos "R" o preço já percorreu depois do primeiro ciclo de
   breakeven. Gravada uma única vez na abertura (`openMt5Position`).

Arquivos: `config.ts`, `neuralBridge.ts` (nova função `realizePartialProfit`,
interface `PartialTpResult`, campo `partials` no retorno de
`enforceMt5StopsAndTargets`), `agent.ts`/`index.ts` (log/resumo da parcial
pro LLM e pro watchdog).

**Limitação conhecida**: posições abertas ANTES do deploy não têm
`original_stop_distance` gravado — o trailing largo/parcial só vale pra
trades novos a partir daqui.

`npx tsc --noEmit` limpo. **Processo reiniciado ao vivo (autorizado pelo
Cleber), confirmado 1 único processo rodando.**

## Parte 3 — Cap de S/R bloqueando rompimentos de topo (commit `94dc0ade2`)

Pedido do Cleber, no meio da mesma sessão: *"todo rompimento de topo pode
ser o início de uma grande movimentação... a IA tem que estar atenta com
todos os rompimentos, sobretudo quando existe pouco volume — pouco volume
não quer dizer que não vai existir uma grande movimentação."*

**Achado real, confirmado no código**: `getSupportResistance` (`atr.ts`)
calculava resistência/suporte como `Math.max`/`Math.min` da janela de
candle **incluindo a vela mais recente**. Isso significa que, na hora exata
de um rompimento real (preço fazendo a nova máxima da própria janela), a
distância até a "resistência" dava ~0% por construção matemática — e o cap
de alvo por S/R em `open_position` (`tools.ts`, achado/implementado em
02/09) achatava o alvo pra quase zero, **bloqueando ou encolhendo
drasticamente a entrada justo no momento do rompimento** — o oposto do que
deveria acontecer.

Corrigido:

1. `getSupportResistance` agora calcula o nível de resistência/suporte só
   da janela **estabelecida** (exclui as 2 velas mais recentes,
   `SR_BREAKOUT_EXCLUDE_CANDLES`) — um rompimento real aparece como
   distância **negativa** (preço já além do nível antigo) em vez de
   travado em 0.
2. Novos campos `brokeAboveResistance`/`brokeBelowSupport` no retorno.
   Quando o rompimento é a favor do lado sendo aberto, o cap de alvo por
   S/R é **desligado** (o nível antigo não é mais um teto real) —
   `tools.ts open_position`.
3. Prompt do LLM (`GENESIS_PROMPT_MT5`, princípio 1c) e schema da tool
   `get_mt5_quote` atualizados com instrução explícita: rompimento
   confirmado merece atenção redobrada mesmo com pouco volume, não
   descartar só por falta de confirmação de volume.

**Verificado, não é bug**: o guard de volume existente (`tools.ts`, linha
~1237) só bloqueia entradas **contra** a tendência sem volume/Estocástico
extremo — uma continuação de rompimento A FAVOR da tendência nunca foi
barrada por volume baixo. Esse lado já estava correto, não precisou mexer.

`npx tsc --noEmit` limpo, sem migration nova (só lógica/prompt). Processo
reiniciado ao vivo de novo, confirmado 1 único processo.

## Pendências reais

- **Nenhuma validação estatística ainda** para nenhum dos 3 fixes desta
  sessão — são correção de mecânica (capturar mais do R:R já configurado,
  não capar alvo indevidamente no rompimento), não alegação de edge. A
  amostra válida começa agora, pós-restart das 08:04 de 04/09.
- Observar nos próximos dias: (1) se a proporção ganho médio/perda média
  melhora de fato; (2) se `partials`/trailing largo estão realmente
  disparando (log do processo, `ai_trades` com `exit_reason='TP'` e
  `pyramid_group_id` null mas `original_stop_distance` preenchido); (3) se
  entradas em rompimento confirmado (`brokeAboveResistance`/
  `brokeBelowSupport=true`) aparecem no log e se o resultado delas é
  diferente das entradas sem rompimento.
