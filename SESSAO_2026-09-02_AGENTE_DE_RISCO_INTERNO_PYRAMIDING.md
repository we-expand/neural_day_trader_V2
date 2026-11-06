# Sessão 2026-09-02 (noite) — Agente de risco interno do LLM Brain:
# pyramiding em posição vencedora (increase_position) + monitoramento contínuo

## Contexto

Continuação do monitoramento de 5 em 5 min pedido pelo Cleber (mandato:
não só observar, ser responsável por abrir/rentabilizar/cortar perda —
[[feedback_llm_brain_ownership_otimizacao]]), depois do handoff de
[SESSAO_2026-09-02_VALIDADOR_FAIL_OPEN_RECHECK_STOP_E_DAILYLOSSLIMIT.md](SESSAO_2026-09-02_VALIDADOR_FAIL_OPEN_RECHECK_STOP_E_DAILYLOSSLIMIT.md).

## Pedido do Cleber: "agente de risco interno"

Cleber pediu um agente separado, dentro da própria IA de trading, dedicado
só a gerenciamento de risco: perder pouco quando perde, ganhar muito quando
ganha, dentro da mesma taxa de acerto (~70%, aceitando oscilar pra cima
livremente, nunca caindo mais que ~10 pontos). Autonomia explícita pedida:
cortar tese errada antes do stop mecânico, e aumentar posição quando o
mercado corre a favor, com o stop correndo atrás pra garantir o ganho
(pyramiding).

**Decisão de infraestrutura**: perguntado se seria um segundo LLM (Groq/
NVIDIA gratuito) ou o mesmo modelo local fazendo as duas funções — Cleber
confirmou que a máquina não aguenta rodar um segundo modelo Ollama local.
Optado por **não usar segundo LLM** (reproduziria a mesma trava de slot
único do Ollama que causou o fail-open do validador semântico na sessão
anterior) — o "agente de risco" foi implementado como uma nova capacidade
mecânica + um novo princípio no prompt da MESMA IA, não uma segunda
chamada de modelo.

## Implementado: `increase_position` (pyramiding controlado)

Nova ferramenta que amplia (pyramida) uma posição já vencedora, travando o
stop em breakeven-ou-melhor a cada reforço:

- Recheca stop/alvo mecânico primeiro (mesmo padrão de `close_position`,
  evita reforçar posição já fechada).
- Só executa com **lucro real** acima do custo do spread (nunca reforça
  posição perdedora, nunca "dobra a aposta").
- Exige **≥1 fator técnico real** (tendência/MACD/padrão de candle) ainda
  alinhado com o lado da posição.
- **Bloqueia se o Estocástico estiver em extremo NO SENTIDO do próprio
  movimento** (SOBRECOMPRADO num LONG, SOBREVENDIDO num SHORT) — isso é
  sinal de exaustão, não de continuidade; reforçar aí seria perseguir o
  topo/fundo, o oposto do mandato.
- Sizing pela MESMA fórmula de risco de `open_position` (% do saldo real),
  capado para nunca reforçar com mais notional que o lote original.
- Checa teto de exposição do grupo correlacionado (mesmo teto já
  existente).
- **Máximo de 2 reforços por posição** (`MAX_PYRAMID_ADDS`).
- Ao reforçar, o preço de entrada vira uma MÉDIA PONDERADA real (nunca
  fabricada) e o stop é movido para breakeven-ou-melhor no mesmo
  movimento — o lote original nunca volta a ficar exposto por causa do
  reforço.

Corte antecipado de perda (a outra metade do mandato, "perder pouco") já
existia desde 02/09 via `close_position` (exige ≥2 fatores técnicos reais
confirmando inversão, ou ≥50% do caminho percorrido) — só foi documentado
melhor no prompt como parte do mesmo princípio de risco.

### Arquivos alterados

- `supabase/migrations/20260902_add_pyramid_adds_to_ai_trades.sql` — nova
  coluna `pyramid_adds_count` em `ai_trades`.
- `llm-active-brain/src/neuralBridge.ts` — nova função
  `increaseMt5Position()` (blend de preço médio + trava de stop), campo
  `pyramid_adds_count` adicionado a `Mt5OpenPosition`/`listMt5OpenPositions`.
- `llm-active-brain/src/tools.ts` — nova constante `MAX_PYRAMID_ADDS = 2`,
  novo schema de ferramenta `increase_position`, novo `case` com todos os
  gates acima.
- `llm-active-brain/src/agent.ts` — novo princípio 8 no prompt
  ("GESTÃO DE RISCO INTERNA"), ferramenta `increase_position` listada.

`tsc --noEmit` limpo, `npm run validate` 37/37 (nenhum teste novo
específico pra `increase_position` — validado só por leitura de código e
compilação, mesma disciplina do resto do projeto: sem chamada de rede
real disponível nesta sessão pra testar o tool call ao vivo).

**Pendente**: commit + migration ainda não rodados pelo Cleber até o fim
desta sessão — nenhuma posição real chegou a usar `increase_position` no
período monitorado. Comandos prontos entregues no chat (não reproduzidos
aqui pra não duplicar) — resumo: `git add` dos 4 arquivos + migration SQL
+ restart do processo do LLM Brain depois de aplicar.

## Monitoramento contínuo (várias dezenas de checagens de 5 em 5 min)

Nenhum bug novo encontrado durante o período — log limpo, sem fail-open,
sem contradição de reasoning, sem fechamento pior que o stop. As travas
mecânicas existentes (confluência ≥2 fatores em regime LATERAL, R:R
mínimo pós-cap de S/R, fluxo "a favor da tendência" do Setup, teto de
posição oposta simultânea, recusa de fechamento nervoso) bloquearam
corretamente dezenas de tentativas de entrada/saída fraca da IA ao longo
da sessão — sinal de que a camada de guardrails está funcionando como
desenhado.

**Evolução do PnL da sessão `1d73c50a-cc28-4ab2-a939-a59361a22fda`**
durante o período observado: começou em 20 trades/+$6,00, terminou em 22
trades/16 vitórias (72,7%)/+$8,83 líquido — 2 trades novos fechados,
ambos positivos. Amostra pequena, sem validação estatística — só o
retrato do período.

Monitoramento **desarmado a pedido do Cleber** ao fim da sessão.

## Pendências reais pra próxima sessão

- Rodar commit + migration + restart do `increase_position` (comandos já
  entregues, não reproduzidos aqui).
- **Depois do restart, observar de perto o primeiro uso real da
  ferramenta** — confirmar que os gates bloqueiam/liberam como esperado
  com dado ao vivo (nenhum teste automatizado cobre isso ainda, só
  `tsc --noEmit`/leitura de código).
- Sem validação estatística de que o pyramiding melhora o líquido —
  precisa de amostra de dias rodando antes de julgar efeito.
- Seguir a pendência já catalogada da sessão anterior: `dailyLossLimit`
  revertendo sozinho por causa do autosave de `aiConfig` em
  `useApexLogic.ts` — não mexido nesta sessão.
