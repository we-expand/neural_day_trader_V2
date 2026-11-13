# Sessão 2026-08-30 — Monitoramento noturno do Cérebro LLM Ativo, achados críticos, 2 fixes aplicados, reinício feito

> **Handoff completo pra próxima sessão.** Objetivo do Cleber: o resultado desta
> noite (1,7% de acerto) é considerado inaceitável ("desesperador") e ele quer
> **retrabalhar boa parte do motor** na próxima sessão. Este arquivo existe pra
> a próxima sessão começar exatamente de onde esta parou, sem precisar
> reconstruir contexto.

## Contexto: o que é o Cérebro LLM Ativo

`llm-active-brain/` é um agente **separado e isolado do motor mecânico
principal** do produto — um processo Node/tsx rodando localmente (fora da
Supabase Edge Function `ai-runner`), full tool-calling, operando uma cesta de
7 criptos (BTCUSD, XETUSD, SOLUSD, DOGUSD, DOTUSD, XRPUSD, BTCXBN) via MT5/
Infinox, em modo DEMO (dinheiro simulado, gravado em `ai_trades` no Supabase
com `strategy_name = 'LLM_ACTIVE_BRAIN_MT5'`). LLM usado: NVIDIA Nemotron
(mesmo provider do NEXUS). É um teste/pesquisa, não é o motor de produção do
Cleber — mas o resultado dele importa pra decidir se esse caminho (decisão
por LLM em vez de regra mecânica) tem futuro no produto.

## O que foi pedido nesta sessão

Cleber pediu monitoramento **contínuo e autônomo** desta sessão do LLM Brain,
de poucos em poucos minutos, com autoridade pra investigar e corrigir bugs de
código encontrados (nunca `git commit`/`git push` sozinho, nunca reiniciar o
processo sem avisar antes). Rodou via `CronCreate` (job recorrente a cada
5min, arredondado dos 7min pedidos por limitação do cron) por dezenas de
ciclos, do início da madrugada até ~10:21 UTC, quando o Cleber pediu pra
desarmar o acompanhamento (job cancelado, `CronDelete`).

## Resultado financeiro real da sessão monitorada

**Sessão**: `ai_sessions.id = e7eef768-389b-4459-8831-40c57a32fb51`, iniciada
2026-08-30 ~02:02 UTC.

**Fonte de verdade usada**: tabela `ai_trades` no Supabase, filtrada por
`session_id` — **nunca** `llm-active-brain/ledger/actions.json` (esse arquivo
local nunca reseta entre sessões/restarts, mistura dados de dias diferentes;
erro de metodologia já documentado no `CLAUDE.md` principal do projeto).

Query usada a cada checagem (Supabase MCP, `execute_sql`):
```sql
select
  count(*) filter (where status='CLOSED') as closed,
  sum(coalesce(net_pnl,pnl)) filter (where status='CLOSED') as net_pnl,
  count(*) filter (where status='CLOSED' and coalesce(net_pnl,pnl)>0) as wins,
  count(*) filter (where status='OPEN') as open_now
from ai_trades
where session_id = 'e7eef768-389b-4459-8831-40c57a32fb51';
```

**Resultado no momento em que o monitoramento foi desarmado**:

| Métrica | Valor |
|---|---|
| Trades fechados | **60** |
| Vitórias | **1** |
| Taxa de acerto | **1,7%** |
| PnL líquido | **-$124,37** |
| Posições abertas ao final | 0 |

Amostra de 60 trades é estatisticamente grande o suficiente (dentro do padrão
de rigor do projeto, ver seção "Cérebro de decisão da IA" do `CLAUDE.md`) pra
afirmar com confiança razoável que **não há edge positivo** na configuração
atual do LLM Brain — não é ruído de amostra pequena, é um padrão consistente
de resultado negativo ao longo de ~257 ciclos.

## Bugs reais encontrados e CORRIGIDOS nesta sessão (código já commitado? NÃO — ver "Pendências")

### Bug 1 — Cooldown de perdas consecutivas só contava stop mecânico, não fechamento manual negativo

**Sintoma observado ao vivo**: SOLUSD SHORT perdeu 2x seguidas por decisão
manual da própria IA (`exit_reason = 'AI_SIGNAL'`, ~-$6 e ~-$3), o cooldown
nunca disparou porque nenhum dos dois fechamentos foi `SL`, e a 3ª reentrada
no MESMO símbolo+lado bateu stop de verdade por **-$7,12** — a maior perda
individual da sessão até aquele ponto.

**Causa raiz**: `getRecentClosedTrades()` (`neuralBridge.ts`) só trazia
`side, exit_time, exit_reason` — sem PnL. O circuito de cooldown em
`open_position` (`tools.ts`) checava estritamente
`t.exit_reason === "SL"` pra contar uma perda na streak.

**Fix aplicado**:
- `llm-active-brain/src/neuralBridge.ts` — `Mt5RecentClosedTrade` ganhou
  `net_pnl`/`pnl`; `getRecentClosedTrades()` agora seleciona essas colunas.
- `llm-active-brain/src/tools.ts` (~linha 636) — nova função `isLoss(t)` que
  considera perda se `exit_reason === "SL"` **OU** `net_pnl`/`pnl` negativo,
  não só stop mecânico.

**Validado**: `npx tsc --noEmit` limpo no pacote `llm-active-brain`.

### Bug 2 — `open_position` aceitava `reasoning` vazio apesar do schema dizer que é obrigatório

**Sintoma observado ao vivo**: log bruto mostrou a chamada literal
`open_position({"side":"SHORT","symbol":"SOLUSD"})` — sem `reasoning` nem
`size`. A posição abriu mesmo assim (SOLUSD SHORT, -$6,10, sem nenhuma
justificativa gravada em `ai_reasoning`).

**Causa raiz**: o schema JSON da ferramenta (`tools.ts` ~linha 297-327) já
declarava `required: ["symbol", "side", "size", "reasoning"]`, mas o handler
(`case "open_position":`, ~linha 578) nunca validava isso — só fazia
`String(input.reasoning || "")`, aceitando string vazia sem erro. Isso quebra
a exigência central do projeto (`CLAUDE.md`: "nunca fabricar dado... sempre
justificar decisão") de que toda decisão da IA seja auditável.

**Fix aplicado**: `llm-active-brain/src/tools.ts` (~linha 591) — após validar
`side`/`size`, novo check: `if (reasoning.trim().length === 0) return {
error: "reasoning e obrigatorio..." }`.

**Validado**: `npx tsc --noEmit` limpo.

### Status de commit — JÁ RESOLVIDO, nenhuma ação pendente

**Os 2 fixes acima (e também o fix do painel BTCXBN travado, ver seção
seguinte) já foram commitados pelo Cleber** durante esta mesma sessão:
- `75fffa6c4` — fix do preço travado em "..." no painel (BTCXBN/DOGUSD).
- `8a3bcde6a` — `open_position` exige `reasoning` de verdade.
- `768720d5a` — cooldown conta fechamento manual negativo, não só stop
  mecânico.

Nada pendente de commit. O reinício do processo (ver seção abaixo) já rodou
com esse código.

## Bugs/gaps encontrados e AINDA NÃO corrigidos (decisões de política de risco, aguardando o Cleber)

Estes não foram tratados como "bug óbvio" porque envolvem trade-off de design,
não um erro determinístico — por isso ficaram pendentes de decisão do Cleber
em vez de eu mudar sozinho:

1. **`MAX_POSITIONS_PER_SYMBOL = 3`** (`tools.ts` ~linha 598) permite
   empilhar até 3 posições no MESMO símbolo e MESMA direção — observado ao
   vivo várias vezes (ex: 2x BTCXBN LONG simultâneas, 2x depois outra vez).
   Cleber precisa decidir se reduz pra 1 (elimina "dobrar na perda", mas
   também elimina piramidação legítima em tendência forte).
2. **Nenhum guard contra posições OPOSTAS simultâneas no mesmo símbolo.**
   Observado ao vivo: SOLUSD LONG e SOLUSD SHORT abertas ao mesmo tempo por
   ~1min11s — paga spread 2x sem chance de lucro líquido em nenhuma direção.
   O teto por símbolo conta o total independente do lado, então isso passa
   despercebido. Não implementado ainda, é escolha de política de risco.
3. **Degradação de coerência do modelo ao longo da sessão longa** (ver seção
   seguinte) — não tem fix de código, mas o padrão sugere que sessões muito
   longas na mesma conversa/contexto pioram a qualidade das decisões. Pode
   valer considerar reinício periódico automático (ex: a cada N ciclos ou
   X horas) como mitigação estrutural, não só reativa.

## Achados de qualidade/degradação do modelo (SEM fix de código possível — comportamento estocástico do LLM, não bug determinístico)

Catalogados em ordem de aparição, todos confirmados no log bruto:

- **Erro sistemático de leitura de percentual** (≥3 ocorrências confirmadas):
  a IA leu `changePct: 0.282` como "28,2%", `0.191` como "19,1%", `0.171`
  como "17,1%" — erro de escala de 100x, sempre inflando a força percebida da
  tendência.
- **Alucinação de contagem de estado**: "todas as 9 posições abertas estão
  perdendo" quando havia de fato 1 posição aberta; "analisei os 12 ativos da
  cesta" quando a cesta tem 7.
- **Falhas de formato de tool-call, 3 variantes distintas, todas sem
  executar a ação pretendida**:
  1. Narração em texto puro ("I'll close the older position...", "Calling
     close_position on that trade_id.") sem invocar a function-call real.
  2. JSON estilo AutoGPT (`plan`/`criticism`/`commands`/`commands_str`) em
     vez do formato de tool-call esperado pelo harness.
  3. Sintaxe XML pseudo-function-call (`<tool_call><function=stop>
     <parameter=reason>...`) vazando dentro de um `log_thought`.
  Em pelo menos um caso, isso levou a IA a **acreditar que tinha fechado 2
  posições que na verdade continuavam abertas** (só foram fechadas de
  verdade ~7 ciclos depois, sem prejuízo adicional por sorte — ambas
  protegidas por stop/take-profit mecânico o tempo todo).
  Uma tentativa de fechamento chegou a usar um `trade_id` **inventado**
  ("176-001", que não existe no banco), que falhou com "posição não
  encontrada" — sem dano, mas confirma a alucinação.
- **Corrupção de texto**: mojibake UTF-8 (`Ã£`, `Ã©`), codificação URL
  vazando (`%C3%AA`, `_` no lugar de espaço), palavra em árabe solta
  ("اذهب") e uma em coreano ("알람") no meio de texto português, termo
  inventado e depois referenciado como se fosse familiar ("SWAYAYA").
- **Padrão recorrente "raciocínio diz uma coisa, ação executada é outra"**:
  pelo menos 5-6 ocorrências onde o texto de `reasoning` termina explicando
  por que NÃO deveria abrir a posição ("Fora por enquanto", "operação
  bloqueada", "preciso analisar mais antes de abrir", "devo evitar repetir
  padrão... sem nova evidência") e a chamada de `open_position` executa
  mesmo assim, com o `side`/`symbol` que a análise tinha acabado de
  descartar.
- Em pelo menos 1 ocasião a IA se autocorrigiu rápido e bem: abriu XRPUSD
  SHORT, escreveu um `log_thought` de "arrependimento imediato" detalhado
  explicando por que a entrada violava os próprios princípios, e fechou a
  posição sozinha ~1 minuto depois (-$0,41, prejuízo pequeno).

**Interpretação pro Cleber**: a frequência e diversidade desses sintomas
(pelo menos 4 categorias distintas de degradação, se intensificando ao longo
da sessão — ciclo 200+ mostrou mais degradação que os primeiros 50) é
consistente com **degradação de coerência por acúmulo de contexto** numa
única sessão/conversa muito longa com o modelo, não com um bug pontual.

## Controles de risco que FUNCIONARAM corretamente (confirmados ao vivo, não mexer)

- **Teto de exposição por grupo correlacionado** (`mt5MaxCorrelatedNotionalUsd`,
  `getCorrelatedGroup`) — bloqueou múltiplas tentativas de triplicar
  exposição LONG/SHORT em BTC/SOL/BTCXBN (correlacionados), forçando a IA a
  fechar posição existente antes de abrir nova. Funcionou em pelo menos 3
  ocasiões distintas.
- **Cooldown de 2 perdas seguidas via stop mecânico** — bloqueou de fato uma
  3ª tentativa de reentrada em XRPUSD SHORT depois de 2 SLs seguidos.
- **Guard de símbolo fora da cesta permitida** — bloqueou corretamente uma
  tentativa confusa de operar `XPTUSD` (removido da cesta em sessão
  anterior) que vazou pra dentro de um `open_position`.
- **Guard de spread >2%** — bloqueou DOTUSD o tempo todo (spread ~10,4%
  persistente, característico de fim de semana).
- **Feed obsoleto/SIMULATED** — nunca disparou incorretamente; avisos de
  "mesmo preço Nx seguidas" apareceram em vários ativos ao longo da noite
  (não só um), investigado e concluído como comportamento normal de baixa
  liquidez de cripto em fim de semana, não bug de cache (tick sempre com
  poucos segundos de idade, nunca marcado `SIMULATED`).

## Fix de sessão anterior, também nesta conversa: BTCXBN travado em "..." no Dashboard

Não relacionado ao LLM Brain em si, mas na mesma conversa: corrigido
`src/app/components/dashboard/LlmActiveBrainPanel.tsx` — o painel do
Dashboard usava o nome literal de símbolo do LLM Brain (`BTCXBN`, `DOGUSD`)
direto contra `getBatchedMT5Data`, que espera o símbolo unificado do catálogo
do app (`BTCBNB`, `DOGEUSD`). Sem tradução, o preço nunca resolvia e a linha
ficava travada em "...". Adicionado alias local `LLM_SYMBOL_TO_UNIFIED` só
nesse painel. **Commitado**: `75fffa6c4`.

## Reinício do processo — EXECUTADO nesta sessão

A pedido explícito do Cleber ("Você precisa reiniciar a LLM"), o processo foi
reiniciado:
- PID antigo `3603` (rodando desde antes do início do monitoramento) — morto
  com `kill`, confirmado morto.
- PID novo `12793` — subido com `npm run start` (`tsx src/index.ts`) dentro
  de `llm-active-brain/`, confirmado como único processo rodando.
- Log confirmou `Ciclo 1/8000`, `list_open_positions` vazio (sem posições
  herdadas — a sessão anterior já estava zerada quando o monitoramento foi
  desarmado).
- Os 2 fixes de código (cooldown + reasoning obrigatório) estão ativos nessa
  nova execução, já que o restart recarrega o código do disco.

**Uma nova sessão (`ai_sessions.id` diferente) começou a partir desse
reinício** — a próxima checagem de PnL deve usar o `session_id` NOVO, não
mais `e7eef768-389b-4459-8831-40c57a32fb51`. Rodar esta query pra descobrir o
id atual antes de qualquer outra coisa:
```sql
select id, created_at, initial_balance
from ai_sessions
where strategy_name = 'LLM_ACTIVE_BRAIN_MT5'
order by created_at desc
limit 1;
```
(ajustar o nome da coluna/filtro se `strategy_name` não bater — checar
`LlmActiveBrainPanel.tsx` pra confirmar o filtro exato usado no Dashboard,
`STRATEGY_NAME = 'LLM_ACTIVE_BRAIN_MT5'`).

## Decisão do Cleber (fim desta sessão) e o que a próxima sessão precisa fazer

Palavras do Cleber: **"Um 1,7% de acerto líquido é uma taxa muito, muito
aquém do projeto. É desesperador."** Ele quer **"tomar providências severas"**
e **"refazer boa parte do motor"** — isto é, isso não é mais "monitorar e
reportar", é hora de **redesenhar**, não só ajustar parâmetro.

**Antes de qualquer redesenho de motor, a próxima sessão deveria**:

1. **Reler este arquivo inteiro** e decidir com o Cleber, explicitamente,
   qual das pendências de política de risco resolver primeiro (teto de
   posições por símbolo, guard de posições opostas).
3. **Não assumir que o problema é só o motor mecânico de risco.** A
   evidência desta sessão aponta pra 2 problemas concorrentes e distintos,
   que provavelmente precisam de tratamento separado:
   - **(a) Qualidade de decisão/estratégia**: a taxa de acerto de 1,7% é tão
     baixa que mesmo com gestão de risco perfeita o resultado seria negativo
     — isso é sinal de que o **modelo não está encontrando edge nenhum**
     nesta cesta/timeframe/prompt, possivelmente reforçando a conclusão já
     documentada no `CLAUDE.md` principal ("busca sistemática por edge de
     sinal técnico... não encontrou edge comprovado... EV por trade é
     ≈ −custo"). Talvez o "Cérebro LLM Ativo" esteja redescobrindo a mesma
     conclusão que a pesquisa de julho/agosto já tinha achado com TA
     clássico, só que por um caminho mais caro (LLM em vez de indicador).
   - **(b) Confiabilidade de execução do LLM**: os sintomas de degradação
     (formato de tool-call quebrado, alucinação, corrupção de texto) são um
     problema de ENGENHARIA — contexto longo demais, ou modelo (Nemotron)
     não é robusto o suficiente pro volume de tool-calling que esse loop
     exige. Isso é resolvível trocando modelo, reduzindo o contexto por
     ciclo, ou reiniciando a sessão periodicamente — **mas resolver (b) não
     resolve (a)**. Mesmo com execução perfeita, se não há edge, o resultado
     esperado continua negativo.
4. **Antes de "refazer o motor", vale perguntar ao Cleber**: ele quer (i)
   ajustar o LLM Brain atual (prompt, modelo, cooldowns, tetos), (ii)
   abandonar a abordagem de decisão-por-LLM e voltar pro paradigma já
   validado do motor mecânico (que o `CLAUDE.md` principal já documenta como
   "cérebro de execução e disciplina, não de alfa"), ou (iii) redesenhar do
   zero com hipótese diferente. Este arquivo não define isso — é decisão de
   produto do Cleber, a ser discutida na próxima sessão.

## Onde ler mais, se precisar de detalhe que não está aqui

Esta conversa (que gerou este arquivo) tem o log completo de cada ciclo
verificado, cada trade individual com racional citado literalmente, e a
sequência exata de raciocínio por trás de cada achado — se precisar do texto
exato de algum `ai_reasoning` específico não resumido aqui, ele está na
tabela `ai_trades` (Supabase, projeto `wyvdsxtcmizettljxtbg`), campo
`ai_reasoning`, pesquisável por `session_id`/`entry_time`.
