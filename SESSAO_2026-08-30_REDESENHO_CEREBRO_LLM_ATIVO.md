# Sessão 2026-08-30 — Redesenho do Cérebro LLM Ativo após -$135/1,7% de acerto

> Handoff completo pra próxima sessão que for acompanhar o resultado deste
> redesenho ou continuar mexendo no `llm-active-brain`.

## Pedido do Cleber

Depois da sessão de monitoramento noturno (ver
[SESSAO_2026-08-30_MONITORAMENTO_NOTURNO_LLM_BRAIN_E_ACHADOS_CRITICOS.md](SESSAO_2026-08-30_MONITORAMENTO_NOTURNO_LLM_BRAIN_E_ACHADOS_CRITICOS.md))
ter fechado com 1,7% de acerto e -$124 líquido, Cleber classificou o
resultado como "desesperador" e pediu autonomia total pra reconstruir o
motor do Cérebro LLM Ativo — inclusive reconstruir características/
habilidades do LLM se necessário — pra chegar numa operação eficiente.

## Diagnóstico (feito com dado real, não suposição)

Antes de mudar qualquer coisa, consultei `ai_trades` direto no Supabase
(`session_id = e7eef768-389b-4459-8831-40c57a32fb51`, a mesma sessão que
seguiu rodando sem interrupção desde 02:02 UTC — ver nota de metodologia
abaixo) pra entender ONDE o prejuízo estava concentrado, em vez de mudar
parâmetros no escuro.

**Situação no momento do diagnóstico**: 66 trades fechados, 2 vitórias
(3%), -$135,22 líquido.

Dois achados concretos, que motivaram todo o resto da sessão:

1. **SOLUSD sozinho respondeu por 57% de todo o prejuízo** (13 trades, 0
   vitórias, -$77,67). Padrão em 10 dos 13 trades: fechamento por stop em
   MENOS DE 1 MINUTO após a abertura (17-50s), perda quase idêntica sempre
   (~0,50%-0,55%, ~$6), em AMBAS as direções (5 LONG perdedores, 8 SHORT
   perdedores — não é viés de lado). Nenhum outro símbolo da cesta mostrou
   esse padrão. Consistente com o stop dinâmico (calculado por ATR de
   candle de 5min) ficando sistematicamente apertado demais pro ruído de
   tick-a-tick REAL desse símbolo especificamente nessa corretora/feed —
   batendo por ruído antes de qualquer tese direcional ter chance de se
   confirmar. Também confirmei ao vivo, nos dados, uma ocorrência de LONG e
   SHORT simultâneos no mesmo símbolo (SOLUSD, ~1min11s de sobreposição,
   07:11:26-07:16:59 e 07:12:02-07:13:19 UTC) — pagando spread 2x sem
   chance de lucro líquido em nenhuma direção.
2. **ZERO das 66 posições fechadas bateram take-profit.** Só `SL` (31,
   -$62,53) ou fechamento manual `AI_SIGNAL` (35, -$72,69) — e a magnitude
   média dos dois é quase igual (-$2,02 vs -$2,08), ou seja, fechar
   manualmente não estava "cortando perda pequena", estava perdendo quase o
   mesmo que o stop mecânico cheio. O alvo do desenho anterior ("giro
   rápido", R:R ~1:1,13, implementado em 2026-08-29) nunca era alcançável
   na prática.

## O que foi mudado (tudo já commitável, `npm run validate`/`tsc --noEmit` limpo)

Arquivos: `llm-active-brain/src/{agent.ts,assetBasket.ts,config.ts,tools.ts}`.

1. **SOLUSD removido da cesta** (`assetBasket.ts`) — pendente de
   investigação dedicada antes de reintroduzir (achado #1 acima). Cesta
   agora: BTCUSD, XETUSD, DOGUSD, DOTUSD, XRPUSD, BTCXBN (6 ativos).
2. **R:R 1:2** (era ~1:1,13) — `mt5StopAtrMultiplier` 1.5→2.0,
   `mt5TakeProfitAtrMultiplier` 1.7→4.0, `mt5StopMinPct` 0.2%→0.3%
   (`config.ts`). Mesmo R:R que o motor mecânico principal do produto já
   usa (referência já estabelecida no `CLAUDE.md`, não é número novo
   inventado).
3. **Bug real encontrado e corrigido AO VIVO, no primeiro trade real depois
   do item 2 acima** (`tools.ts`): quando o ATR real não vem disponível
   (cai no stop fixo de segurança), o código antigo jogava
   `take_profit = stop_fixo` DIRETO, ignorando o multiplicador de R:R —
   colapsava pra R:R 1:1 mesmo sozinho. Confirmado num BTCUSD LONG real
   (ciclo 2 da sessão reiniciada): `stop_pct: 0.500%`, `take_profit_pct:
   0.300%` — R:R invertido (0,6:1, PIOR que aleatório), por causa desse bug
   SOMADO ao item 4 abaixo. Corrigido: o fallback agora aplica o MESMO
   multiplicador R:R, nunca colapsa pra 1:1 por acidente. Sem dano real (a
   própria IA fechou essa posição manualmente com -$0,24 antes da correção
   chegar a rodar de novo).
4. **Encolhimento de alvo em dia de baixo volume, REMOVIDO** (`tools.ts`)
   — existia especificamente pra servir a filosofia "giro rápido" que os
   achados acima mostraram não funcionar; mantê-lo ativo junto com o R:R
   1:2 novo teria comprometido a maioria dos trades (a condição "volume não
   elevado" é o caso comum, não a exceção).
5. **Teto de posições por símbolo: 3 → 1** (`tools.ts`) — resolve a
   pendência #1 do handoff anterior. Empilhar na mesma aposta sem fechar a
   anterior não agregava informação, só multiplicava o mesmo risco.
6. **Guard novo: bloqueia posição OPOSTA simultânea no mesmo símbolo**
   (`tools.ts`) — resolve a pendência #2 do handoff anterior. Confirmado no
   dado real que isso aconteceu (achado #1 acima).
7. **Guard novo: contradição reasoning↔ação em `open_position`**
   (`tools.ts`) — checagem por palavra-chave (conservadora, prefere falso
   negativo a falso positivo) que bloqueia a chamada quando o próprio
   `reasoning` contém uma negação explícita de abrir/entrar sem nenhuma
   reversão depois no mesmo texto. Resolve o padrão "raciocínio diz uma
   coisa, ação executada é outra" catalogado na sessão de monitoramento
   (5-6 ocorrências reais).
8. **`tool_choice: "auto" → "required"`** (`agent.ts`) — a causa mais
   provável das 3 variantes de falha de formato de tool-call catalogadas na
   sessão de monitoramento (narração em texto puro, JSON estilo AutoGPT,
   XML solto). Testado direto contra a API da NVIDIA com o modelo real
   (`nvidia/nemotron-3-nano-30b-a3b`) antes de aplicar — `tool_choice:
   "required"` é suportado e devolve `tool_calls` limpo, sem narração.
   Confirmado ao vivo depois do restart: dezenas de chamadas de ferramenta
   seguidas, nenhuma narração/JSON solto/XML na amostra observada.
9. **Prompt (`GENESIS_PROMPT_MT5` em `agent.ts`) atualizado** pra refletir
   os números novos (R:R 1:2, 1 posição/símbolo, sem lado oposto, cesta de
   6 ativos) e removida a seção obsoleta "missão de hoje: reconhecer ativos
   novos" (já cumprida, virou ruído pro modelo pequeno).

## Achado de metodologia (importante, corrige um erro do handoff anterior)

O handoff da sessão de monitoramento assumiu que reiniciar o processo
criaria uma sessão nova no Supabase. **Isso está errado**:
`getOrCreateMt5Session` (`neuralBridge.ts`) reusa a sessão mais recente com
`strategy_name = 'LLM_ACTIVE_BRAIN_MT5'`, sem nenhum filtro de tempo/status
— então a MESMA sessão (`e7eef768-389b-4459-8831-40c57a32fb51`) sobreviveu
a pelo menos 2 restarts (o de ~10:21 UTC do handoff anterior e o desta
sessão) e segue acumulando os mesmos 66+ trades. Pra próxima sessão: **não
assumir sessão nova depois de restart** — confirmar com a query de
`ai_sessions` mesmo assim, mas esperar que normalmente seja a mesma. Se
quiser de fato começar uma amostra limpa pro redesenho (recomendado — os
66 trades antigos foram sob R:R 1:1,13, não é comparável ao 1:2 novo),
seria preciso ou truncar a análise pelo timestamp do restart (ver
`entry_time` a partir de ~08:19 UTC de hoje) ou avaliar forçar sessão nova
no código — não fiz isso porque é uma decisão de produto (perder a
continuidade do histórico usado por `tradeMemory.ts`), não uma correção
óbvia.

## Reset pra $50 limpos — pedido explícito do Cleber, feito depois do redesenho

Depois do redesenho acima já estar rodando (e já ter validado ao vivo um
trade real com R:R 1:2 correto), Cleber pediu pra zerar o dashboard em $50
pra testar o modelo novo sem a bagagem dos -$135 da sessão antiga.

**O que foi feito**:
1. Criada sessão nova em `ai_sessions` (`id = aa279c75-1acd-49aa-9fef-a76e8ddf0b2e`,
   `created_at = 2026-08-30 11:36:50 UTC`, `initial_balance/initial_equity = 50`,
   `status = 'PAUSED'` — mesma convenção que o código usa, nunca `RUNNING`).
   Isso é a session mais recente por `strategy_name = 'LLM_ACTIVE_BRAIN_MT5'`,
   então tanto o Dashboard (`LlmActiveBrainPanel.tsx`, que consulta a sessão
   mais recente a cada poll) quanto o processo (depois de reiniciado, ver
   abaixo) passam a usar ela.
2. Processo reiniciado (3ª vez nesta sessão) — necessário porque
   `getOrCreateMt5Session` (`neuralBridge.ts`) cacheia o `session_id` em
   memória (`mt5SessionIdPromise`) pela vida do processo; só re-consulta
   "sessão mais recente" na inicialização. Sem restart, o processo teria
   continuado gravando na sessão antiga mesmo com a nova já existindo no
   banco.
3. **Achado no meio do processo**: a sessão antiga (`e7eef768...`) tinha NÃO
   1 mas **2 posições abertas** no momento do reset — `list_open_positions`
   já tinha mostrado a XETUSD SHORT antes, mas o processo antigo, no seu
   ÚLTIMO ciclo antes de eu matar o PID, ainda abriu uma segunda
   (BTCXBN SHORT, `entry_time` 11:36:00 UTC — minutos antes da sessão nova
   ser criada). As duas ficariam órfãs (sem monitoramento mecânico de
   stop/alvo) depois do processo migrar de sessão, então fechei as duas
   manualmente, a preço real (não fabricado — mesma rota `/mt5-prices` que
   o app usa, cotação `SIMULATED=false` confirmada em ambas as chamadas):
   - **XETUSD SHORT** (`e7e37551...`): entrada 2457,38, fechada no ASK real
     2458,22 (fechar SHORT = comprar de volta, mesma convenção de
     `closeMt5Position`), PnL -$0,41.
   - **BTCXBN SHORT** (`35bf5106...`): entrada 316,893, fechada no ASK real
     317,508, PnL -$2,33.
   Ambas com `exit_reason = 'MANUAL'` (valor válido pela constraint do
   banco) e o motivo do fechamento administrativo registrado em
   `ai_reasoning` (concatenado ao reasoning original de entrada, mesmo
   padrão de `closeMt5Position` — nunca um `UPDATE` silencioso, ver
   convenção do `CLAUDE.md` principal sobre correção de registro
   financeiro). Confirmado por SQL: nenhuma das duas sessões tem posição
   `OPEN` depois disso.

**Estado final**: sessão `aa279c75-1acd-49aa-9fef-a76e8ddf0b2e` é a ativa,
$50 limpos, zero trades ainda no momento do reset, processo rodando só
nela. A sessão antiga (`e7eef768...`, -$135/1,7% de acerto, dado do
diagnóstico deste arquivo) fica congelada como histórico, sem mais
atividade.

## Processo — reiniciado 3x nesta sessão, confirmado rodando

PID final confirmado rodando sozinho (instância única, trava de lock
funcionando): processo `tsx src/index.ts` iniciado ~08:23 UTC de hoje, já
em vários ciclos sem erro, tool-calling limpo, guards de risco bloqueando
corretamente tentativas de entrada contra-tendência sem volume (observado
ao vivo pelo menos 5x nos primeiros ciclos após o restart) e cooldown de
perda consecutiva disparando corretamente pra BTCUSD.

## O que NÃO foi prometido (disciplina do projeto — nunca prometer edge sem validação)

Este redesenho corrige bugs reais e reequilibra o R:R pra uma proporção já
validada como convenção do produto — mas **não é uma promessa de que o
Cérebro LLM Ativo vai ficar lucrativo**. A conclusão de pesquisa já
registrada no `CLAUDE.md` principal ("busca sistemática por edge de sinal
técnico... não encontrou edge comprovado... EV por trade é ≈ −custo")
continua de pé; é perfeitamente possível que este redesenho apenas reduza
o RITMO da perda (menos trades ruins por bug, custo melhor amortizado) sem
criar edge positivo de verdade, porque o LLM está tomando decisão
discricionária sobre o MESMO tipo de dado (preço/tendência/volume técnico)
que a pesquisa de julho/agosto já testou exaustivamente sem achar edge com
regra mecânica. **Não dá pra saber ainda** — precisa de uma amostra nova
sob o R:R 1:2 (idealmente separada da amostra antiga de R:R 1:1,13, ver
nota de metodologia acima) antes de qualquer conclusão.

## Pendências reais pra próxima sessão

1. **Acompanhar o resultado sob o R:R novo** — esperar acumular uma amostra
   real (dúzias de trades, não só alguns) antes de julgar. Sessão é a nova,
   limpa desde o reset pra $50 (ver seção "Reset pra $50 limpos" acima) —
   `session_id = 'aa279c75-1acd-49aa-9fef-a76e8ddf0b2e'`, não mais a
   `e7eef768...` (essa fica congelada como histórico da amostra antiga, R:R
   1:1,13). Query de referência:
   ```sql
   select count(*) filter (where status='CLOSED') as closed,
          sum(coalesce(net_pnl,pnl)) filter (where status='CLOSED') as net_pnl,
          count(*) filter (where status='CLOSED' and coalesce(net_pnl,pnl)>0) as wins,
          count(*) filter (where status='CLOSED' and exit_reason='TP') as tp_hits
   from ai_trades
   where session_id = 'aa279c75-1acd-49aa-9fef-a76e8ddf0b2e';
   ```
2. **Investigar a causa raiz do SOLUSD** (task já registrada como sugestão
   pro Cleber nesta sessão) antes de cogitar reintroduzir o símbolo —
   comparar ruído de tick real vs ATR de candle de 5min especificamente
   pra esse ativo.
3. Considerar se vale trocar o modelo (Nemotron Nano, 3B ativos) por algo
   mais robusto — não feito nesta sessão porque `tool_choice: "required"`
   já deveria eliminar a maior parte das falhas de formato observadas, e
   trocar de provedor tem histórico de instabilidade neste projeto (ver
   `config.ts`, comentário de `LlmProvider`). Se os sintomas de degradação
   (alucinação de contagem, erro de leitura de percentual) persistirem
   mesmo com o `required`, é o próximo lever a considerar.
