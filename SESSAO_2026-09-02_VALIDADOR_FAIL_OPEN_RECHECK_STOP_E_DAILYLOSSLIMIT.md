# Sessão 2026-09-02 (noite) — Monitoramento contínuo do LLM Brain:
# validador semântico em fail-open por contenção real, recheck mecânico de
# stop antes de fechamento manual, e causa raiz do dailyLossLimit revertendo

## Contexto

Continuação do monitoramento de 5 em 5 min pedido pelo Cleber (mandato:
não só observar, ser responsável por abrir/rentabilizar/cortar perda —
[[feedback_llm_brain_ownership_otimizacao]]), depois do handoff de
[SESSAO_2026-09-02_MOTOR_MUDO_MAX_TOKENS_MIGRATION_PENDENTE_E_ALAVANCAGEM.md](SESSAO_2026-09-02_MOTOR_MUDO_MAX_TOKENS_MIGRATION_PENDENTE_E_ALAVANCAGEM.md).

## Achado 1: validador semântico em fail-open permanente (nova causa, mesma sessão do dia)

Log mostrava `[reasoningValidator] erro na validacao semantica -- deixando
passar (fail-open): Request was aborted` em praticamente toda chamada de
`open_position`/`close_position`. Medido DIRETO contra o servidor Ollama
local (`curl` com prompt real, fora de produção): **73 segundos** pra uma
resposta, bem mais que o timeout de 8s então configurado. Causa: o
`llama-server` do Ollama roda com `-np 1` (1 slot, sem paralelismo) e é o
MESMO processo/modelo do ciclo principal — uma segunda chamada (o
validador) sempre concorre pelo único slot disponível, então o tempo real
de resposta é imprevisível e frequentemente >> qualquer timeout razoável
pra não travar o ciclo.

Fix aplicado em duas etapas: (1) subir timeout 8s→25s + `max_tokens`
600→1500 (`reasoningValidator.ts`) — não resolveu, timeout continuou
estourando 100% das vezes mesmo com a folga maior; (2) fix real: desligar
esse validador LLM por default quando o modelo configurado é o mesmo do
cérebro principal (`config.ts`,
`mt5ReasoningValidatorEnabled` agora `false` por default quando
`LLM_PROVIDER=ollama`) — a trava por palavra-chave (`NEGATION_CUES`/
`REVERSAL_CUES` em `tools.ts`, síncrona, sem chamada de rede) continua
ativa normalmente. Só religa se um modelo de validação genuinamente
separado e mais rápido for configurado via `MT5_REASONING_VALIDATOR_MODEL`.
`tsc --noEmit` limpo, processo reiniciado.

## Achado 2: 2ª ocorrência confirmada — fechamento manual executando pior que o stop

Consulta ao Supabase (`ai_trades`, sessão `1d73c50a-...`) mostrou que
fechamentos `AI_SIGNAL` no lado LONG estavam -$14,14 líquido (contra
+$22,15 dos fechamentos mecânicos SL/TP) — maior drag da sessão. Um caso
específico (XETUSD) fechou em 2383,84 com o `stop_loss` registrado em
2384,74: **o preço já tinha furado o stop antes do fechamento
discricionário executar** — mesmo padrão já documentado no handoff anterior
(era achado "a investigar", agora confirmado uma 2ª vez).

Causa raiz: `enforceMt5StopsAndTargets` (a trava mecânica de stop/alvo) só
roda UMA VEZ no início de cada ciclo, mas o ciclo inteiro (várias chamadas
de LLM local via Ollama, cada uma podendo levar dezenas de segundos) pode
durar bem mais que isso até a decisão de fechar chegar. Nesse intervalo o
preço pode furar o stop sem ninguém checar.

Fix: `close_position` (`tools.ts`) agora rechama a mesma função
`enforceMt5StopsAndTargets` (idempotente — só fecha o que já bateu SL/TP
com cotação fresca) logo no início, ANTES de avaliar o fechamento
discricionário. Se a posição já bateu SL/TP nesse recheck, fecha pelo canal
mecânico correto ali mesmo (exit_reason certo, mesma cotação que seria
usada de qualquer jeito) em vez de deixar vazar pro fechamento manual numa
cotação potencialmente pior. Reduz a janela de slippage, não elimina
(ainda existe o tempo entre o recheck e a resposta final do LLM naquele
tool call específico, mas é bem menor que um ciclo inteiro). `tsc --noEmit`
limpo, processo reiniciado.

## Achado 3: causa raiz real do `dailyLossLimit` revertendo sozinho (achado 4b da sessão anterior, agora resolvido)

Pedido do Cleber pra subir `dailyLossLimit` de 5%→10% (`ai_user_config`,
SQL direto). Reverteu sozinho pra 5% em **71 segundos** — rápido demais pra
ser reabertura manual da tela de Setup (hipótese da sessão anterior).
Achado real no código: `useApexLogic.ts` (~linha 872) tem um `useEffect`
que salva `aiConfig` inteiro no Supabase a CADA mudança de estado
`aiConfig` em qualquer aba aberta do app, depois da hidratação inicial. Se
existe qualquer aba viva (do Cleber ou de outra sessão/dev server) com o
config antigo ainda em memória, um re-render qualquer que toque esse
objeto resalva o valor antigo por cima da edição feita via SQL — não
precisa nem reabrir a tela de Setup, só ter uma aba montada.

**Não corrigido nesta sessão** (fora do escopo do monitoramento do motor,
é comportamento do app principal) — reportado ao Cleber. Enquanto esse
autosave existir sem checar staleness contra o banco antes de escrever,
qualquer edição de `ai_user_config` via SQL enquanto uma aba estiver aberta
é instável. Mitigação prática: fechar/recarregar todas as abas do app
antes de editar via SQL, ou editar direto na tela de Setup.

## Estado ao final da sessão

- Sessão `1d73c50a-...`: +$8,57 líquido, 19 trades fechados, 14 vitórias
  (73,7%) — mesmo estado da sessão anterior, sem trades novos fechados no
  período monitorado desta sessão.
- 2 posições abertas: NAS100 SHORT, BTCUSD SHORT.
- `dailyLossLimit`: ficou em 5% (reversão do achado 3) — Cleber avisado,
  decidiu pausar o monitoramento antes de eu confirmar reaplicação.
- 2 commits prontos, entregues ao Cleber, ainda não rodados:
  1. `reasoningValidator.ts` + `config.ts` — desliga validador semântico
     quando é o mesmo modelo local sobrecarregado.
  2. `tools.ts` — recheck mecânico de stop antes de fechamento manual.
- Monitoramento contínuo desarmado a pedido do Cleber ao fim da sessão.

## Pendências reais pra próxima sessão

- Aplicar os 2 commits prontos acima (Cleber ainda não rodou).
- Decidir e aplicar `dailyLossLimit` (10% ou outro valor) SÓ depois de
  fechar/recarregar todas as abas abertas do app — senão reverte nos
  primeiros segundos de novo.
- Considerar (fora do escopo desta sessão, é o app principal, não o
  motor): endurecer `useApexLogic.ts` pra não resalvar `ai_user_config`
  às cegas — ex: comparar contra o valor mais recente do banco antes de
  escrever, ou só salvar em resposta a uma ação explícita do usuário na
  tela de Setup, não em qualquer mudança de estado de `aiConfig`.
- Observar se o recheck mecânico de stop (Achado 2) reduz de fato a
  frequência de fechamentos `AI_SIGNAL` executando pior que o stop
  registrado — precisa de amostra nova rodando com o fix aplicado.
- Seguir observando se `AI_SIGNAL` LONG continua sendo um drag líquido
  consistente (amostra ainda pequena, 4 trades) antes de considerar
  qualquer mudança de política sobre o fechamento discricionário em si.
