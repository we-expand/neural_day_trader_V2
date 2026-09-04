# Sessão 2026-09-03 — Motor mudo (dailyLossLimit em UTC) + teto subido pra 15%

## Contexto

Cleber pediu levantamento completo das operações do LLM Brain de 02/09
(taxa de acerto, lucro, loss) e, ao ver que o motor não tinha aberto
nenhuma posição em 03/09 num dia de alta forte (BTCUSD +3%+, cesta toda
subindo), pediu auditoria urgente — hipótese inicial dele era que o novo
"agente de risco interno" (`increase_position`/pyramiding, resolvido em
2026-09-02) estivesse vetando entradas sem querer.

## Levantamento de 02/09 (SQL direto em `ai_trades`)

15 trades fechados, 12 vitórias / 3 derrotas — **80% de acerto**, PnL
líquido **+$7,01** (lucro bruto +$20,70, loss bruto -$13,70). Padrão
notável: quase todo fechamento por "SL" saiu no lucro (breakeven/trailing
protegendo ganho cedo, como já catalogado em sessões anteriores) — só 1
bateu take-profit de verdade (XETUSD SHORT, +$8,20). As 3 derrotas foram
desproporcionalmente grandes (-$5,52, -$2,56, -$5,62) e sozinhas
consumiram quase todo o lucro bruto do dia — razão ganho/perda ~0,38:1
mesmo com 80% de acerto.

## Causa raiz real do motor mudo — NÃO era o agente de risco

Confirmado por código, não suposição: `increase_position` (pyramiding)
não tem poder de vetar/bloquear `open_position` nenhum — só amplia
posição já ganhando de verdade. Não era ele.

**Bug real, em `getTodayRealizedPnl` (`neuralBridge.ts:733`)**: o "Limite
de Perda Diária" resetava à meia-noite **UTC**, não à meia-noite de
Brasília (UTC-3). O trade XETUSD que fechou -$5,62 às 21:02 (horário de
Brasília) de 02/09 corresponde a **00:02 UTC de 03/09** — esse prejuízo
"de ontem" pro usuário contou como perda de "hoje" em UTC, estourando o
teto de 5% ($5,00 numa conta de $100) três horas antes do dia local nem
ter começado. Confirmado ao vivo no log (`llm-brain.log`, ciclos 2-9 de
hoje): todo ciclo terminava em
`"Limite de perda diaria do Setup (5.0%) ja atingido hoje (prejuizo real:
5.44%)... Nenhuma nova posicao ate 00:00 UTC"`, mesmo com `list_open_positions`
vazio e a cesta inteira em tendência clara (BTCUSD/XETUSD sobrecomprados,
SPX500 com volume elevado + MACD alinhado — setups reais sendo recusados
pelo gate, não por falta de oportunidade).

## Fixes aplicados (commitados e já ao vivo, processo reiniciado)

1. **`getTodayRealizedPnl`** (`neuralBridge.ts`) — janela de "hoje" agora
   calculada em `America/Sao_Paulo`, não UTC. Mensagem de erro em
   `tools.ts` atualizada de "00:00 UTC" pra "00:00 no fuso de Brasilia".
2. **`dailyLossLimit` 5%→15%** (Supabase, `ai_user_config`, sem código) —
   a pedido do Cleber, dentro da faixa 10-15% que ele sugeriu. Com
   `riskPerTrade=5%`, o teto de 5% deixava 1 único stop matar o dia
   inteiro; 15% dá margem pra ~3 stops ruins antes de travar.

`npm run validate`: 37/37 limpo. `./restart.sh` rodado às 11:55 —
processo confirmado vivo, sem posições órfãs perdidas (nenhuma estava
aberta no momento do restart). Commit entregue pro Cleber rodar
(`llm-active-brain/src/neuralBridge.ts` + `tools.ts`).

## Achado colateral, sem ação (campo morto)

`aiRiskAnalysisEnabled` no config JSON do Supabase está `false` e não é
lido em nenhum lugar do código — campo da UI sem efeito real no motor,
não relacionado ao bug de hoje.

## Pendências reais

- **Confirmar ao vivo** que o motor voltou a abrir posição no resto do
  dia 03/09 com o fuso corrigido (não observado até o fim desta sessão).
- **Objetivo declarado pelo Cleber pra próxima fase**: manter a taxa de
  acerto em ≥75% (alcançada em 02/09, 80%) e reduzir DRASTICAMENTE o
  tamanho do prejuízo nos trades perdedores — hoje a perda média
  (-$4,57) é quase do tamanho do `riskPerTrade` (5% = $5) e sozinha anula
  o ganho de várias vitórias pequenas (+$1,73 de média). Não mexido ainda
  nesta sessão — recomendação registrada de medir alguns dias com o fuso
  corrigido antes de mexer no tamanho do stop, pra não misturar duas
  mudanças na mesma amostra. Fica pra próxima sessão.
