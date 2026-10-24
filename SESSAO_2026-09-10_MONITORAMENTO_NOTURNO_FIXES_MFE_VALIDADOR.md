# Sessão 2026-09-10 (madrugada) — Monitoramento noturno do LLM Brain, 5 bugs reais corrigidos, instrumentação de MFE e validador determinístico de contradição

> Handoff completo da sessão de monitoramento de ~00:20 às ~11:20 (horário de
> Brasília), pedida pelo Cleber ("monitore até 09:00, corrija qualquer falha,
> me envie commit pronto"). Resumo de 1-2 linhas já colocado no topo do
> [CLAUDE.md](CLAUDE.md) — este arquivo é o detalhe completo.

## Contexto inicial

Cleber reportou "a LLM está dando erro de ciclo, não abriu posição". Investigação
ao vivo (log + `ai_brain_activity_log` via Supabase) confirmou: **100% dos ciclos
desde ~22:37 da noite anterior travavam sem decisão** (`finish_reason=length`).

## Bugs reais encontrados e corrigidos nesta sessão

### 1. Motor mudo — estouro de contexto do modelo local (commits `b17aabd3d`, Modelfile)
**Causa real**: o commit do dia anterior (`3fc0ab2cc`, motor SMC + classificador HMM)
engordou muito cada cotação (`get_mt5_quote`) — cada símbolo passou a carregar
texto didático completo (explicação de regime HMM, divergência de tendência,
preço esticado) repetido por ativo. Com 13 ativos na cesta, o contexto acumulado
estourava o teto do modelo local (`qwen3.5:4b`, `num_ctx=24576`) antes da IA
conseguir decidir qualquer coisa.

**Fix**: cortado o texto didático repetido (a explicação já existe uma vez no
prompt, principios 1b/1j) — os avisos por símbolo agora só trazem o dado factual
("REGIME HMM: CONSOLIDACAO_BAIXA_VOL (confiança 100%) — ver principio 1j").
`hmmRegime` devolvido no quote também foi enxugado (só `regime`/`confidence`/
`direction`/`sampleSize`, sem `stateProbabilities`/`logLikelihood`/`converged`,
que eram diagnóstico interno do treino, não usado pelo prompt).

`num_ctx` do Ollama testado em 49152 (funcionou, mas deixou a geração lenta
demais nesse hardware — um ciclo chegou a levar 14+ minutos numa única resposta)
e revertido pra **32768** (equilíbrio real testado ao vivo).

**Confirmado ao vivo**: motor voltou a abrir posição real minutos depois do fix
(SOLUSD SHORT + UKOUSD LONG, primeiras posições da noite).

### 2. Pyramiding podia travar perda garantida em vez de proteger lucro (commit `c48cc0196`)
**Causa real**: `increase_position` (reforço numa posição já lucrativa) calculava
o novo stop usando o `entry_price` ORIGINAL (pré-blend) + spread — mas o preço
médio ponderado real da posição (calculado depois, em `increaseMt5Position`)
podia ficar ABAIXO desse stop quando o reforço preenchia a um preço pior que o
original. Um stop LONG acima do próprio custo médio da posição combinada trava
perda garantida, não breakeven.

**Caso real**: UKOUSD LONG, entrada original 101,839, reforço preencheu a
102,033, stop calculado (só com o entry original) ficou em 101,954 — ACIMA do
preço médio ponderado real (101,936). Fechou por stop segundos depois com
prejuízo líquido nas duas pernas somadas (-$3,45), apagando o lucro real que a
posição tinha antes do reforço.

**Fix**: replica em `tools.ts` a mesma média ponderada por notional que
`increaseMt5Position` vai gravar, e nunca deixa o novo stop passar do lado
errado dela (nunca afrouxa proteção já travada por reforço anterior).

### 3. Fechamento manual recusado mesmo com motivo de segurança válido (incluído no commit `c48cc0196`)
**Causa real**: HKG33 SHORT ficou com cotação obsoleta por 35+ minutos (feed
parado fora do horário do mercado de Hong Kong). A IA reconheceu isso e tentou
fechar por segurança — mas o gate de fechamento manual exigia 2+ fatores
técnicos frescos OU 50% do caminho até o stop, nenhum dos quais pode ser
provado com dado congelado. O stop mecânico (`enforceMt5StopsAndTargets`) usa
essa mesma cotação velha, então a posição ficava presa sem proteção real
contra risco de gap quando o feed voltasse.

**Fix**: cotação obsoleta (`quote.stale`) agora é aceita como motivo válido
pra bypassar o gate dos outros critérios.

### 4. Validador semântico de contradição desligado a noite inteira (commit pendente — `reasoningValidator.ts`)
**Achado mais grave da sessão.** Cleber notou, olhando o Dashboard: XETUSD
tinha aberto **COMPRA** (LONG) num momento em que o dia estava fortemente
negativo — pediu pra investigar se a IA realmente analisou o contexto antes de
entrar.

Investigação real via `ai_brain_activity_log` + `ai_trades.ai_reasoning`
confirmou algo pior que "não analisou":

- **07:48:50** — a própria IA escreveu, em `log_thought`: *"XETUSD SHORT:
  CONVERGÊNCIA FORTE... Confiança: 87%... Confiar acima de 85%"*
- **07:50:55** — 2 minutos depois, abriu **COMPRA** em XETUSD (lado oposto da
  própria conclusão), confiança declarada 82%
- O `ai_reasoning` gravado no trade se autocontradiz na primeira frase:
  *"Tendência **ALTA** (shortterm e longterm **ambos BAIXA**)"*
- Resultado: -$2,83, nunca chegou a ficar positivo (confirmado via log de PnL
  ciclo a ciclo — ver item de MFE abaixo)

**Causa raiz real**: `checkReasoningConsistency` (a camada que existe
especificamente pra pegar esse tipo de contradição, via uma segunda chamada de
LLM) fica **desligada por padrão quando o provedor é Ollama**
(`mt5ReasoningValidatorEnabled: llmProvider !== "ollama"`, `config.ts`) — foi
desligada de propósito em 2026-08-30 porque reusar o mesmo Ollama sobrecarregado
pra validar dobrava o tempo de cada ciclo. Como a sessão inteira roda em Ollama
local, essa trava nunca rodou uma vez sequer esta noite.

**Fix**: nova checagem **determinística** (regex + comparação de string, ZERO
chamada de LLM) em `reasoningValidator.ts` — compara a tendência que o
`reasoning` afirma (`"tendência ALTA"`/`"BAIXA"`/`"LATERAL"`) contra o
`trendLabel` real do `get_mt5_quote` do mesmo ciclo. Se divergir, bloqueia a
abertura/fechamento na hora, sem exceção. Roda **sempre**, independente de
provedor, sem custo de latência — testada contra o caso real (regex captura
"ALTA" na frase "Tendência ALTA (...ambos BAIXA)", compara com `trendLabel=BAIXA`
real, bloqueia). Não substitui a camada de LLM (mais sutil pra outras formas de
contradição) — é rede de segurança adicional.

**Pendente de decisão do Cleber**: estender a mesma checagem determinística pra
`macdLabel`/`stochasticLabel` (mesma estrutura de dado real disponível,
implementação rápida se decidir que vale a pena).

### 5. Instrumentação de MFE (Maximum Favorable Excursion) por trade — commit pendente
**Pedido do Cleber**: medir, pra qualquer trade fechado (ganhador ou perdedor),
se ele chegou a ficar positivo em algum momento antes de fechar — não só o
resultado final. Antes disso só dava pra responder vasculhando texto de log
manualmente (feito uma vez nesta sessão pra 7 trades da madrugada, impreciso e
não escalável — 3 confirmados nunca ficaram no azul, 2 confirmados ficaram
positivos e reverteram, 2 inconclusivos por falta de granularidade).

**Implementado**: nova coluna `ai_trades.mfe_usd` (migration
`supabase/migrations/20260910_add_mfe_usd_to_ai_trades.sql`, **pendente de
rodar no SQL Editor**), atualizada a cada 3s pelo stop-watchdog
(`enforceMt5StopsAndTargets`, roda independente do ciclo do LLM — amostragem
bem mais fina que os minutos que cada ciclo leva). Write fire-and-forget (não
bloqueia o watchdog), só escreve quando há nova máxima.

Com isso rodando por alguns dias, a pergunta "quantos trades nunca ficaram no
azul" vira uma query SQL direta e exata, não arqueologia de log.

## Resultado financeiro real da noite (SQL direto, sem enfeite)

Sessão `e6b0a120...`, trades fechados entre 00:20 e ~08:20:
- **12 trades fechados**, 1 aberta no momento da checagem
- **Taxa de acerto: 41,7%** (5 vitórias, 7 derrotas)
- **PnL líquido: -$4,58**
- Ganho médio por vitória: +$1,43 | Perda média por derrota: -$1,68

**Não bate a meta declarada pelo Cleber** (acerto >70%, "perde pouco, ganha
muito"). Amostra pequena (12 trades) não tem poder estatístico — os fixes desta
sessão corrigiram infraestrutura (motor rodando sem travar, sem executar
contradição óbvia), não edge direcional. Ver seção "Cérebro de decisão" do
CLAUDE.md — decisão de produto antiga do projeto, ainda válida: não existe edge
técnico clássico comprovado, o cérebro é de execução/disciplina, não de alfa.

## Auditoria de payoff por tipo de saída (janela de 14 dias, 634 trades — amostra grande e real)

| `exit_reason` | n | Acerto | PnL médio | PnL total |
|---|---|---|---|---|
| `AI_SIGNAL` (fechamento discricionário) | 374 | 36,9% | -$0,77 | **-$288,22** |
| `SL` (stop mecânico) | 185 | 20,5% | -$1,41 | -$259,88 |
| `TP` (alvo mecânico) | 46 | 89,1% | +$2,43 | +$111,69 |
| `MANUAL` | 29 | 17,2% | +$1,97 | +$27,57 |

**Achado real**: fechamento discricionário (`AI_SIGNAL`) foi historicamente o
maior ralo de dinheiro da conta — pior até que o próprio stop-loss mecânico.
Mas o gate de 3+ fatores técnicos (aplicado em 2026-09-07,
`SESSAO_2026-09-07`) já corrigiu a maior parte: antes do gate, 34,7% de
acerto / -$0,86 médio; depois do gate, **56,8% de acerto / +$0,05 médio**
(37 trades, amostra pequena — direção real, mas não apertar mais sem mais
dado).

Segmentação por sessão/volatilidade (`session_at_entry`/
`volatility_label_at_entry`) tentada — **inconclusiva**: 70% dos trades (444 de
634) não têm esse campo preenchido (histórico anterior à feature). Nos que têm,
todas as sessões (NY/Londres/Ásia/Rollover) ficaram negativas e parecidas entre
si (33-42% acerto) — sem segmento nitidamente pior que justifique bloqueio.

## Pendências reais (nada rodado automaticamente — regra fixa do projeto)

1. **Commits pendentes** (comandos já entregues ao Cleber em mensagens
   anteriores da sessão):
   - `llm-active-brain/src/tools.ts` (trim de contexto + fix pyramid stop + fix
     fechamento por cotação obsoleta) — **já commitado** pelo Cleber
     (`b17aabd3d`, `c48cc0196`)
   - `llm-active-brain/Modelfile.qwen35-trading` (ajuste local `num_ctx`)
   - `llm-active-brain/src/neuralBridge.ts` + migration (instrumentação MFE)
   - `llm-active-brain/src/reasoningValidator.ts` (checagem determinística de
     contradição de tendência)
2. **Migration pendente**: `20260910_add_mfe_usd_to_ai_trades.sql` — Cleber
   rodar no SQL Editor do Supabase (projeto `wyvdsxtcmizettljxtbg`).
3. **Decisão do Cleber**: estender a checagem determinística de contradição
   pra MACD/Estocástico (mesma estrutura de dado, implementação rápida).
4. **Aguardar amostra maior** (200-250 trades fechados pós-fixes de hoje,
   regra já registrada no CLAUDE.md) antes de qualquer nova conclusão sobre
   taxa de acerto real ou ajuste de mecânica de stop/trailing — **não repetir
   o padrão de cortar stop sem dado**, precedente já catalogado 2x no projeto
   (queda de acerto 80%→33% em ambas as ocasiões).
5. **Alavanca real discutida, não aplicada**: entrada com "vela de
   confirmação" (esperar o próximo candle fechar na direção esperada antes de
   abrir, em vez de entrar no instante em que o setup valida) — reduziria a
   taxa de entradas que nascem já revertendo, com custo real de pior preço de
   entrada e perda de movimentos rápidos. Só testar depois que o MFE der uma
   linha de base real.
