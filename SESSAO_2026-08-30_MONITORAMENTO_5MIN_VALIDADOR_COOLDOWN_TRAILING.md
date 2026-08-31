# Sessão 2026-08-30 (tarde/noite) — Monitoramento contínuo do Cérebro LLM Ativo a cada 5min + 3 bugs reais corrigidos, commitados e aplicados ao vivo

> Continuação do dia (ver itens anteriores de 2026-08-30 no `CLAUDE.md` e
> histórico). Sessão pedida pelo Cleber como monitoramento recorrente
> (`/loop` de 5 em 5 minutos, cron job de sessão) sobre a sessão ativa do
> Cérebro LLM Ativo (`ai_sessions.id = aa279c75-1acd-49aa-9fef-a76e8ddf0b2e`,
> a mesma criada no redesenho da manhã), com carta branca pra corrigir código
> do `llm-active-brain/` sem pedir confirmação a cada achado pequeno —
> commit/push e restart do processo continuando sob aprovação do Cleber a
> cada vez.

## O que foi feito

Rodados ~18 ciclos de monitoramento (5 em 5 min) checando: processo único
(`ps aux`), log mais recente (`llm-brain.log`), e estado real da sessão
ativa direto no Supabase (`ai_trades`/`ai_sessions` filtrados por
`session_id`, nunca `ledger/actions.json` agregado — erro de metodologia já
documentado antes). Maior parte dos ciclos foi "sem novidade" (posição
mantida, sem trade novo, sem erro) — só resumidos aqui os ciclos com achado
real.

### 1. Explicação pontual: por que perdeu ~$7 num BTCUSD LONG (pedido do Cleber)

Cleber notou um stop de -$6,93 num BTCUSD LONG e achou alto pro saldo de
~$50. Investigado com dado real do trade: entrada $79.107,44, stop
$78.843,61 (0,33% de distância), `quantity`=1.581,92 → exposição nocional
alavancada de ~$1.582 (mesmo esquema de sizing `$800→$1200` já documentado
em 2026-08-29). 0,44% de queda (com um pouco de slippage no fechamento
mecânico) × ~$1.582 = -$6,93. **Não é bug** — é o desenho de sizing
já discutido e mantido de propósito antes. Olhando os 4 stops da sessão até
ali: perda média -$3,32, pior caso -$6,93 (esse mesmo trade), R:R 1:2
confirmado (TPs reais de +$13,41 e +$13,87). Cleber decidiu **manter o
sizing como está** por enquanto — nenhuma mudança de código nesse ponto.

### 2. BUG REAL #1 — validador de contradição (`reasoningValidator.ts`) em fail-open sistemático

**Achado**: investigando por que a IA abriu um BTCUSD SHORT cujo próprio
`ai_reasoning` gravado no banco dizia literalmente *"Confluência
insuficiente para abrir SHORT aqui"*, confirmei no log que **100% das
chamadas** do validador semântico de contradição caíam em
`[reasoningValidator] resposta sem JSON reconhecivel -- deixando passar
(fail-open)`, sem exceção, a sessão inteira.

**Causa raiz**: o validador usa o mesmo modelo de raciocínio (Nemotron) do
cérebro principal, que gasta tokens "pensando" em texto livre (`"We need to
determine if..."`) antes de emitir o JSON final. Com `max_tokens: 150`, a
resposta era cortada no meio do raciocínio e nunca chegava no JSON — a
trava estava, na prática, **sempre desligada**, mesmo implementada e
parecendo funcionar no código.

**Fix**: `max_tokens` 150→600 em
[reasoningValidator.ts](llm-active-brain/src/reasoningValidator.ts), dando
espaço pro modelo terminar de pensar e emitir o JSON. Type-check
(`npx tsc --noEmit`) limpo. Commit: `8d4ad62f8`.

### 3. BUG REAL #2 — cooldown de perda em sequência travando a cesta inteira

**Achado** (a partir da pergunta do Cleber "por que não abre mais
posições?"): com `mt5LossStreakThreshold=2` e `mt5LossStreakCooldownMinutes=30`,
vários dos 10 ativos da cesta acumulavam 2 perdas recentes no mesmo lado ao
mesmo tempo — a cesta inteira ficava travada por 30min mesmo com sinal novo
aparecendo em algum ativo, deixando só 1 posição aberta por 1h+.

**Fix**: `mt5LossStreakThreshold` 2→3, `mt5LossStreakCooldownMinutes` 30→20
em [config.ts](llm-active-brain/src/config.ts). Ainda é trava real (3
perdas seguidas no mesmo símbolo+lado continua bloqueando), só menos
agressiva. **Sem promessa de edge** — é afrouxamento de frequência, não
alegação de melhora no líquido. Type-check limpo. Commit: `ef55e3516`.

Decidido **não mexer** no teto de spread (`SPREAD_BLOCK_PCT=2.0%`) — está
calibrado deliberadamente com medição real (bloqueia só o DOTUSD de fim de
semana, mantém o resto liberado), sem dado novo que justificasse alterar.

### 4. BUG REAL #3 — trailing stop congelado no breakeven (o mais importante da sessão)

**Achado** (pedido explícito do Cleber, "chegou a ganhar $3, saiu a -$0,10,
isso não pode acontecer"): rastreado o trade BTCUSD SHORT que chegou a
+$3,00 flutuante e fechou em -$0,19. O trailing contínuo pós-breakeven
(`enforceMt5StopsAndTargets` em `neuralBridge.ts`) usava a **mesma
distância do stop de abertura** (`mt5StopAtrMultiplier=2,0x ATR`). Como o
breakeven dispara com só `mt5BreakevenTriggerR=0,5x` dessa distância (1x
ATR de lucro), existia uma **faixa morta** entre 1x e 2x ATR de lucro em
que o stop calculado pro trailing nunca ficava mais protetor que o
breakeven — ou seja, o stop simplesmente não subia, apesar do preço
continuar correndo a favor. O trade em questão passou por essa faixa morta
inteira, reverteu, e fechou no breakeven + custo de spread.

**Fix**: novo `mt5TrailAtrMultiplier` (default 0,8x ATR, mais apertado que
os 2,0x do stop inicial) em
[config.ts](llm-active-brain/src/config.ts), usado no lugar de
`mt5StopAtrMultiplier` especificamente no trailing em
[neuralBridge.ts:704](llm-active-brain/src/neuralBridge.ts). Agora, assim
que o preço sair do breakeven, o stop começa a subir de verdade
acompanhando o preço, em vez de esperar dobrar a distância original do
stop. **Sem promessa de edge** — é correção de mecânica de proteção de
lucro (exatamente o pedido do Cleber: "sobe o stop conforme o mercado for
andando"), não alegação de que o líquido vai melhorar. Type-check limpo.
Commit: `fd258d63b`.

### 5. Restart aplicado ao vivo (autorizado explicitamente pelo Cleber)

Os 3 commits acima ficaram ~1h37min no disco sem entrar em vigor porque o
processo (`PID 80135/80136/80137`, rodando desde 14:09 UTC) não tinha sido
reiniciado. A pedido explícito do Cleber ("Reinicie você mesmo a LLM"),
matei o processo antigo (`kill -TERM`) e subi um novo (`npm run start`,
PID 94785/94786/94787) — confirmado único, sem duplicata, log limpo,
retomou corretamente a posição que já estava aberta no Supabase (XETUSD
LONG) no primeiro ciclo. **Nenhuma posição foi perdida** no restart —
posições vivem no Supabase, não no processo.

## Estado da sessão ativa no momento em que o restart aconteceu

`ai_sessions.id = aa279c75-1acd-49aa-9fef-a76e8ddf0b2e`: 21 trades
fechados, 3 vitórias (14,3%), PnL líquido **-$8,46**. 1 posição aberta
(XETUSD LONG, $2.514,42, levemente negativa no momento do restart). Amostra
pequena, sem validade estatística — retrato do momento, não conclusão.

## Pendências reais pra próxima sessão

1. **Avaliar efeito real dos 3 fixes** — precisa de amostra nova (mínimo
   dias, não horas) rodando com o código atualizado antes de dizer se
   ajudou ou não. Nenhum dos 3 promete edge, só corrigem mecânica
   (contradição bloqueada de verdade, cesta menos travada, lucro
   protegido progressivamente).
2. Se o afrouxamento do cooldown (#2) aumentar demais a frequência de
   reentrada em ativo ruim, pode precisar recalibrar de novo (threshold/
   janela) com dado novo.
3. Critérios de confluência (soft, dentro do prompt do LLM, não trava
   numérica) seguem sem alteração — Cleber perguntou se queria afrouxar
   também isso além do cooldown, decisão foi deixar como está por ora,
   sem dado que justifique.
4. Monitoramento de 5 em 5 min foi desarmado a pedido do Cleber ao fim da
   sessão — religar com `/loop 5m <mesmo prompt>` se quiser retomar (prompt
   completo fica no histórico da conversa).
