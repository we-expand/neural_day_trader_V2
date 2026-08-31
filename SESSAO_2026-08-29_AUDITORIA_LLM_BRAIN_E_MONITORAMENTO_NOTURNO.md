# Sessão 2026-08-29 (madrugada): Auditoria do Cérebro LLM Ativo + Monitoramento Noturno

## Estado exato de onde continuar

- **Branch**: `dev`. Todos os commits desta sessão **já commitados E pushados**
  (feito pelo Cleber direto, não por mim — ver "Commits desta sessão"
  abaixo).
- **Processo do agente**: rodando desde `2026-08-29 00:40` local, PID `75632`
  (`llm-active-brain/`, `npm run start`), log completo em
  `llm-active-brain/logs/restart_20260829_0040.log` (192 ciclos até
  07:22, ~7100 linhas). **Ainda rodando** quando a sessão fechou — não foi
  parado.
- **Sessão ativa no Supabase** (`ai_sessions`, `strategy_name='LLM_ACTIVE_BRAIN_MT5'`):
  id `6220f3b4-d700-4052-bfea-348cea1accf4`. Estado às 07:22: **113
  fechadas, 8 abertas (BTCUSD 2, SOLUSD 3, XETUSD 3), PnL realizado
  -$8,40**.
- **Monitoramento cron (20/20min) foi desarmado** a pedido do Cleber ao
  final da sessão (`CronDelete`) — não tem mais checagem automática
  rodando. Se quiser retomar, é só pedir de novo (mesmo texto de prompt
  funciona, adaptando o horário-limite).
- **Próximo passo real**: nenhuma ação pendente. O processo está rodando
  sozinho, código já commitado. Na próxima sessão, só continuar
  observando a performance (PnL ainda negativo, -$8,40) e decidir se vale
  reiniciar/resetar a sessão ou deixar acumular mais amostra.

## O que foi feito (em ordem cronológica)

### 1. Leitura do handoff da sessão anterior

Lido `SESSAO_2026-08-29_LLM_BRAIN_PROVEDOR_NVIDIA_E_COMPORTAMENTO_DE_SAIDA.md`
— apontava um commit pendente do modelo NVIDIA (`config.ts`) e pedia
observação dos primeiros ciclos pós-fix de comportamento de saída.

### 2. Auditoria profunda do Cérebro LLM Ativo (terminal + Dashboard + banco)

Pedido do Cleber: comparar terminal, Dashboard e Supabase, e confirmar se
tudo estava funcionando corretamente. Achados:

- **✅ Fix de saída (sessão anterior) confirmado funcionando de verdade**:
  15 fechamentos reais via `close_position` já na sessão, PnL positivo
  no início (+$3,10) — antes disso o agente nunca fechava nada.
- **✅ `config.ts` (modelo NVIDIA)**: na hora da auditoria, ainda **não
  estava commitado** (só em disco) — confirmei que o handoff anterior
  estava certo, eu tinha me enganado ao afirmar o contrário no meio da
  auditoria.
- **🔴 Achado novo 1 — processo zumbi**: um processo antigo do agente
  (PID `70096`, iniciado `22:13` do dia anterior) continuava rodando com
  o modelo velho (`openai/gpt-oss-120b`, que trava o endpoint da NVIDIA),
  preso num loop de `Erro no ciclo: Connection error` havia +5h. Inerte
  (nunca chamou `open_position`), mas foi morto a pedido do Cleber
  (`kill 70096 70097 70098`).
- **🔴 Achado novo 2 — furo no teto de posição por símbolo**: confirmado
  ao vivo **6 posições SHORT simultâneas em SOLUSD** (teto era 3). Causa
  raiz: `listMt5OpenPositions()` (`neuralBridge.ts`) engolia qualquer erro
  de rede/Supabase e devolvia `[]` — indistinguível de "sem posição
  aberta". `open_position` (`tools.ts`) confiava nisso pra contar posições
  existentes; uma falha transitória fazia o teto contar "0" e deixava
  abrir mais uma. Mesmo padrão de bug já corrigido no `reconcile()` do
  motor mecânico em 2026-08-28.
- **✅ Confirmado que o preço é real, não simulado**: rastreado
  `getMt5Quote()` (`mt5Broker.ts`) → mesma rota `/mt5-prices` do Supabase
  que o motor mecânico usa (`METAAPI_TOKEN` real) → trava explícita que
  descarta `source: "SIMULATED"` e devolve `null`, bloqueando
  `open_position`/`close_position` nesse caso. Confirmado ao vivo no log:
  o agente foi de fato bloqueado ("Sem cotacao real disponivel") em vários
  momentos, provando que a trava funciona.
- **✅ Dashboard verificado ao vivo via browser preview** (subi uma
  instância própria em `localhost:5183`, separada da sessão que já
  ocupava a 5173): painel "Cérebro LLM Ativo" atualizando em tempo real
  (10s de observação, patrimônio $56,99→$58,20 acompanhando preço real),
  6 posições exibidas batendo com o Supabase.

### 3. Fix aplicado: furo do teto de posição

`neuralBridge.ts`: `listMt5OpenPositions()` agora **propaga o erro** em
vez de devolver `[]` silencioso. `tools.ts`: os 3 pontos que chamam essa
função (`list_open_positions`, `open_position`, `close_position`) agora
**falham fechado** — bloqueiam a ação e avisam o agente em vez de assumir
"zero posições". Type-check limpo (`llm-active-brain` e gate principal
`npm run validate`, 37/37 OK).

### 4. Restart do processo

Processo antigo (o que já tinha os 4 fixes da sessão anterior, mas não o
fix do teto) foi reiniciado às `00:40` local com `npm run start`, log
salvo em arquivo (`logs/restart_20260829_0040.log`) pra permitir
diagnóstico. Confirmado no ciclo 1: modelo NVIDIA correto, teto de
posição respeitando 3 por símbolo, regra de saída com alvo concreto no
`reasoning`.

### 5. Monitoramento contínuo (20/20min, até 09:30 de 2026-08-30)

A pedido do Cleber, agendado via `CronCreate` (recorrente, `*/20 * * * *`,
com lógica de auto-encerramento embutida no prompt após o horário-limite)
checando a cada rodada: processo vivo, log sem erro/crash, `open_position`/
`close_position` disparando de verdade, contagem de posição por símbolo
(teto), PnL realizado, e comparação com o que o Dashboard mostraria.
**11 checagens rodadas** entre `01:02` e `07:22` (desarmado manualmente
antes do previsto, a pedido do Cleber).

**Achados ao longo do monitoramento** (nenhum foi bug de sistema):

- Processo nunca caiu, nunca travou em erro repetido de verdade.
- Um "processo zumbi" novo NÃO apareceu — só o único PID `75632`.
- Teto de 3 posições por símbolo **segurou o tempo todo** (única exceção
  observada foi antes do fix, na fase de auditoria).
- Pelo menos 2 quedas reais e temporárias do feed de preço MetaAPI
  (`~02:00` e `~04:20`, todos os 6 símbolos sem cotação por alguns
  ciclos) — o agente reagiu **corretamente**: recusou operar, chamou
  `stop` em vez de fabricar preço ou usar dado velho. Consistente com a
  disciplina do projeto ("nunca fabricar dado") e com o aviso já
  documentado no `CLAUDE.md` sobre a conta MetaAPI compartilhada sujeita
  a rate-limit.
- Achado de qualidade do modelo (Nemotron Nano, não é bug de código):
  em pelo menos uma ocasião confirmada (posição BTCUSD `f21d1690...`),
  o agente confundiu direção de lucro/prejuízo numa SHORT (achou que
  preço subindo era lucro) e fechou uma posição achando que tinha batido
  alvo, quando na verdade era prejuízo (-$2,49, registrado corretamente
  no banco — o motor calcula certo, só a decisão do agente foi baseada em
  raciocínio errado). Também houve resíduos de "alucinação" inofensivos
  em `log_thought` (menção a "job de conteúdo"/"saldo fictício" de um
  trilho antigo que não existe mais no código — nunca virou ação real).
- **Trajetória do PnL realizado ao longo da noite** (pra referência
  rápida, não é conclusão de edge — amostra pequena, sem holdout):
  `+$3,10` (auditoria) → `+$5,47` → `+$9,83` → `+$12,26` (pico, `03:02`)
  → `+$9,27` → `+$4,82` → `+$2,52` → `+$2,34` → `-$3,80` (primeira
  negativa, `05:02`) → `-$1,47` → `-$2,72` → `-$3,96` → `-$6,28` →
  `-$6,37` → `-$5,99` → `-$8,40` (última leitura, `07:22`). Tendência
  final: negativo e piorando, mas sem nenhum evento de sistema por trás
  — é resultado real de trade, incluindo pelo menos um erro de raciocínio
  do modelo confirmado.

## Commits desta sessão

Ambos já commitados e pushados (pelo Cleber, direto no terminal — eu só
entreguei o código pronto e os comandos, como sempre):

```
1e0591124 fix(llm-brain): teto de posicao por simbolo furado por erro de rede silencioso
70ca87f00 fix(llm-brain): usar nvidia/nemotron-3-nano-30b-a3b, nao gpt-oss-120b
```

## Pendências reais pra próxima sessão

1. **Nenhuma ação de código pendente.** Os dois fixes desta sessão estão
   commitados e rodando em produção local (processo PID `75632`).
2. **PnL da sessão atual está negativo (-$8,40 na última leitura,
   07:22)** — decidir se deixa o processo continuar acumulando amostra
   (ele segue rodando sozinho) ou se reseta a sessão pra $50 zerada de
   novo (mesmo processo SQL já documentado em sessões anteriores).
3. **Sem dado estatístico ainda** — a trajetória de PnL acima é só
   observação bruta de uma noite, não validação (sem holdout, amostra
   pequena, sem correção por múltiplos testes). Não tratar como "a
   estratégia funciona" nem "não funciona" ainda.
4. Se quiser reativar o monitoramento periódico, é só pedir de novo — o
   padrão de checagem (processo vivo, log sem erro, Supabase batendo com
   Dashboard, teto de posição, PnL) já está validado e funcionou bem a
   noite toda.
