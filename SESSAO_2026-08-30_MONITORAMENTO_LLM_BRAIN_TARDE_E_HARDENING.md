# Sessão 2026-08-30 (manhã/tarde) — Monitoramento ao vivo do Cérebro LLM Ativo + 6 fixes estruturais + 2 indicadores novos

> Continuação direta do redesenho da manhã (ver
> [SESSAO_2026-08-30_REDESENHO_CEREBRO_LLM_ATIVO.md](SESSAO_2026-08-30_REDESENHO_CEREBRO_LLM_ATIVO.md)).
> Cleber pediu monitoramento contínuo com autonomia pra corrigir qualquer
> malfunção encontrada — esta sessão rastreou o log ciclo a ciclo, achou 6
> bugs estruturais reais (todos confirmados com dado ao vivo, não suposição),
> corrigiu todos, e delegou a implementação de MACD + Estocástico Lento reais
> a 2 subagentes em paralelo (revisados linha a linha antes de aplicar).
> **Todos os commits abaixo estão prontos mas não aplicados** — Cleber roda
> manualmente (regra fixa do projeto).

## Achados e fixes, em ordem cronológica

1. **Stop-loss podia ficar menor que o spread bid/ask** (`config.ts`/`tools.ts`,
   commit `b94239f75`, já aplicado por Cleber). XRPUSD/DOGUSD/DOTUSD têm
   spread (1,3%-10%) maior que o stop calculado (0,3%-0,5% fallback) —
   posição nascia derrotada, sem nenhum movimento real de preço, só pelo
   custo de operar. Confirmado ao vivo (2 de 3 primeiros trades da sessão) e
   no histórico (41% dos 70 trades da sessão anterior `e7eef768`, ~40% do
   prejuízo de -$138). Fix: stop nunca fica menor que `spread × 1,5`
   (`mt5SpreadStopSafetyMultiplier`); bloqueia a entrada se nem o teto máximo
   cobrir essa margem.

2. **Guarda de contradição reforçada + validador semântico novo** (commit
   pendente). A trava por palavra-chave existente só pegava negação direta
   ("não abrir"). Confirmado ao vivo 3x na mesma sessão: "como teste",
   "ainda não ocorreu", "não há razão para entrar" — cada frase nova exigiu
   entrada manual na lista (whack-a-mole, limite reconhecido). Delegado a um
   subagente: `reasoningValidator.ts`, segunda chamada de LLM
   barata/rápida perguntando se o reasoning contradiz a ação, fail-open
   sempre (timeout 8s, JSON malformado, API fora do ar — nunca trava o
   ciclo principal). Reforçado depois com `response_format: json_object`
   após confirmar ao vivo (5+ vezes) que só pedir JSON no prompt não bastava
   (modelo respondia em texto corrido, caindo em fail-open por falta de
   match no regex).

3. **`close_position` sem checar dado fresco do símbolo certo** (commit
   pendente). Rastreado ao vivo: um BTCUSD LONG lucrativo (+$1,39
   flutuante) foi fechado a -$2,49 citando "resistência de 2471,26" — número
   real, mas do XETUSD (consultado 2 chamadas antes). Nunca tinha chamado
   `get_mt5_quote(BTCUSD)` naquele ciclo. Fix: `close_position` exige
   `get_mt5_quote` do MESMO símbolo no MESMO ciclo antes de aceitar o
   fechamento — pego ao vivo depois, bloqueando uma tentativa que citava
   "12h de posição aberta" quando na real eram minutos.

4. **`open_position` com o mesmo problema, só que na entrada** (commit
   pendente). Confirmado ao vivo: `open_position(BTCXBN, SHORT)` foi a
   PRIMEIRA ação do ciclo, antes de qualquer `get_mt5_quote` — decisão pura
   de memória de trades passados, zero dado ao vivo do ativo. MESMA trava
   agora protege `open_position` também.

5. **Fechamento manual prematuro — inicialmente só pós-flip, depois
   generalizado** (commit pendente). 3 casos reais na mesma sessão de
   fechamento com PnL perto de zero (nem perto do stop, nem do alvo) — 2
   claramente pra abrir o lado oposto (bloqueado, então "migrava" pro
   fechamento), 1 fechamento nervoso solto (XETUSD/BTCXBN SHORT, sinal
   ambíguo). Nos 2 últimos casos, **confirmado com cotação real minutos
   depois que o preço voltou a favor da posição original** — fechou perto do
   zero a zero, teria virado lucro. Fix: fechamento manual só é aceito se a
   posição já percorreu ≥50% da distância até o stop ou até o alvo.
   Generalizado pra QUALQUER close manual (não só pós-flip) a pedido
   explícito do Cleber, ciente do trade-off (atrasa também cortes rápidos em
   teses genuinamente inválidas).

6. **MACD e Estocástico Lento reais** (commit pendente, implementados por 2
   subagentes em paralelo, revisados linha a linha antes de aplicar).
   Motivado por uma entrada SHORT em XETUSD com tese fraca (tendência
   LATERAL, sem volume, "vibe contrarian") que perdeu num mercado que virou
   claramente comprador — Cleber apontou "ela não observou o MACD". Ambos
   calculados de verdade em cima do MESMO candle oficial de 5min que
   trend/volume/S&R já usam (viável desde correção anterior do endpoint
   `/mt5-candles`, nunca implementado até agora). `fetchRecentCandles`:
   limit 30→60, mínimo 15→35 velas (warm-up real das EMAs) — benefício
   colateral: ATR real ficou mais disponível (`stop_dinamico:true` mais
   frequente). Ambos `null` quando não há candle real suficiente, nunca
   fabricam indicador. Nenhuma trava mecânica nova — só dado pro julgamento
   do LLM, como pedido.

## Achado de qualidade que NÃO tem fix de código (limite reconhecido, discutido com o Cleber)

Mesmo com dado real, fresco, do símbolo certo, e reasoning internamente
consistente, a IA repetidamente **leu o dado real de forma errada** — ex:
MACD com histograma positivo e crescente (momentum aumentando) interpretado
como "sinal de esgotamento" (deveria ser o oposto). Isso é diferente de todos
os 6 fixes acima (que corrigiam decisão tomada com dado ausente/errado/
inconsistente) — aqui o dado estava certo, a CONCLUSÃO que saiu dele que
estava errada. Não existe trava de código pra isso: seria equivalente a
validar se uma previsão de mercado está certa antes do mercado confirmar.
Consistente com a pesquisa já documentada em `AI_BRAIN_SPEC.md` (busca
sistemática por edge de sinal técnico clássico, sem resultado comprovado) —
os fixes desta sessão levantam o PISO (evitam perda por erro estrutural
provável), não prometem levantar o TETO (acerto direcional acima do acaso).

## Resultado — primeiro sinal concreto de que o fix #5 funciona

Depois do fix #5 (generalização da trava "posição precisa consumir ≥50% do
caminho até stop/alvo antes de fechamento manual") no ar, uma posição XETUSD
LONG (`a88594c9`) sobreviveu a pelo menos 5-6 tentativas de fechamento manual
prematuro (todas bloqueadas pela trava nova, motivos variados: "sem
confirmação de rompimento", "distância grande até o TP", "melhor esperar
pullback") — e **bateu take-profit de verdade, +$13,41, `exit_reason: TP`**.
É o primeiro TP hit real confirmado desta sessão (e um dos poucos em toda a
história recente do projeto — sessões anteriores documentaram 0 de 66 TPs
batidos). Amostra de 1, não é validação estatística, mas é a primeira
evidência concreta e ao vivo de que segurar a posição até o alvo real (em vez
de deixar a IA sair no primeiro nervosismo) é possível e vinha sendo
sistematicamente impedido pelo próprio comportamento que o fix corrigiu.

## Estado da sessão no momento em que o monitoramento foi desarmado

Sessão `aa279c75-1acd-49aa-9fef-a76e8ddf0b2e` (a mesma desde o redesenho da
manhã, preservada por todos os restarts): **17 trades fechados, 2 vitórias,
-$9,62 líquido** (melhorou de -$17,99 depois do TP de +$13,41), 1 posição
aberta (BTCUSD SHORT) no momento em que o Cleber pediu pra desarmar o
acompanhamento ao vivo — o processo `llm-active-brain` continua rodando
normalmente, só parou a narração automática de cada evento. Amostra **não é
comparável entre si** — os fixes foram aplicados progressivamente ao longo da
própria sessão, boa parte dos trades aconteceu ANTES de um ou mais dos fixes
acima estarem no ar. Se for julgar o estado atual do sistema, a amostra
válida começa depois do último restart (fix #5, generalização do fechamento
prematuro).

## Pendências reais

- **6 commits prontos, nenhum aplicado** — Cleber precisa rodar manualmente
  (comandos completos já foram dados no chat desta sessão, não reproduzidos
  aqui). Arquivos tocados: `llm-active-brain/src/config.ts`,
  `llm-active-brain/src/tools.ts`, `llm-active-brain/src/agent.ts`,
  `llm-active-brain/src/reasoningValidator.ts` (novo), `llm-active-brain/src/atr.ts`.
- Nenhuma amostra pós-fix-completo estatisticamente válida ainda existe
  (todos os fixes foram aplicados na mesma sessão de monitoramento) — precisa
  de mais tempo rodando pra julgar o efeito líquido real. O TP de +$13,41 é
  sinal, não prova.
- Achado de qualidade (leitura errada de indicador real) fica registrado
  aqui como limite conhecido, não como pendência de código — não tem fix
  determinístico proposto.
- Monitoramento ao vivo (Monitor no log) foi desarmado a pedido do Cleber
  nesta sessão — religar manualmente na próxima se quiser retomar o
  acompanhamento em tempo real.
