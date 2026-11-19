# Sessão 2026-09-02 (tarde/noite) — Motor mudo por estouro de tokens,
# migration pendente bloqueando gravação, e ajuste de alavancagem/proteção

## Contexto / motivação

Continuação do monitoramento contínuo do Cérebro LLM Ativo pedido pelo
Cleber, com mandato explícito: não só observar, ser responsável por fazer
o motor abrir posição, ser rentável, e cortar perda pequena quando errar
([[feedback_llm_brain_ownership_otimizacao]] — memória salva). Sessão
começou continuando o handoff de
[SESSAO_2026-09-02_MOTOR_NAO_ABRIA_POSICAO_GATE_SR_E_REGIME_DE_MERCADO.md](SESSAO_2026-09-02_MOTOR_NAO_ABRIA_POSICAO_GATE_SR_E_REGIME_DE_MERCADO.md).

## Achado 1 (causa raiz real, confirmado fora de produção): motor mudo há horas

Cleber reportou "a LLM não está abrindo posições" depois de mudanças
aplicadas mais cedo (regime de mercado, Estocástico como confirmação —
ambas já commitadas e ao vivo). Log mostrava **100% dos ciclos** terminando
em `"Nenhuma ferramenta chamada. Encerrando o ciclo."`, mesmo com
`tool_choice: "required"`.

**Diagnóstico feito reproduzindo o request exato fora de produção** (mesmo
prompt de sistema real, mesmas 10 cotações reais do log, direto contra
`localhost:11434`, não suposição): `finish_reason: "length"`,
`completion_tokens: 1024` (o teto configurado), `content: ""`,
`tool_calls: undefined` — reproduzido 1:1. Causa: o Qwen3.5 local (Ollama)
usa "thinking" nativo (gasta texto de raciocínio antes da function-call);
o código só desliga isso (`enable_thinking:false`) pro provedor NVIDIA,
nunca pro Ollama (testado — o parâmetro não tem efeito real no template do
Ollama, é ruído). Com `get_mt5_quote` tendo engordado ao longo de várias
sessões (regime, candlePatterns, MACD, Estocástico, extension), o
raciocínio ficou grande o bastante pra estourar o teto de 1024 tokens de
resposta antes de emitir a tool-call de verdade.

**Fix aplicado, testado e commitado** (`288e9d347`):
- `agent.ts`: `max_tokens` 1024→2048 (testado no request real: reasoning
  completo + `open_position`/`log_thought` de verdade emitidos, usando
  867-954 tokens).
- `Modelfile.qwen35-trading`: `num_ctx` 16384→24576 (prompt real mede
  ~13,8k tokens; margem antiga tava curta demais — modelo recriado no
  Ollama local).
- `tsc --noEmit` limpo, processo reiniciado, confirmado ao vivo: motor
  voltou a decidir (log_thought com análise real) já no ciclo 1 pós-fix.

## Achado 2 (crítico, achado ao vivo LOGO DEPOIS do fix 1): migration pendente bloqueava toda gravação

Com o fix 1 aplicado, o motor voltou a avaliar e tentar abrir posições —
mas a primeira tentativa que passou por TODOS os gates de risco (XETUSD
LONG) ainda falhou: `"Falha ao gravar a posicao (ver log do processo)."`.
Log do processo revelou a causa real:

```
[neuralBridge/mt5] falha ao abrir posição: Could not find the
'session_at_entry' column of 'ai_trades' in the schema cache
```

A migration `20260902_add_regime_at_entry_to_ai_trades.sql` da sessão
anterior (regime de mercado) nunca tinha sido aplicada, mas o código que
grava essas 3 colunas já estava ao vivo desde ontem (`17c52e008`) — ou
seja, **desde ontem, NENHUMA entrada conseguia ser gravada**, mesmo
passando por todos os gates, independente de qualquer fix de motor.
**Cleber rodou a migration no SQL Editor** — colunas confirmadas existentes
via `information_schema.columns` logo em seguida.

## Confirmação: pipeline completo funcionando

Com os dois fixes aplicados, a próxima tentativa (NAS100 SHORT) abriu de
verdade e foi confirmada gravada no Supabase com as 3 colunas novas
preenchidas (`session_at_entry: "NY"`, `volume_label_at_entry: "BAIXO"`,
`volatility_label_at_entry: "NORMAL"`). Ao longo da sessão, mais duas
entradas reais abriram: **BTCUSD SHORT** e **XETUSD LONG**. As demais
tentativas (XAUUSD, BTCUSD-1ª tentativa, EURUSD, SPX500, GER40, NAS100-1ª
tentativa) foram recusadas legitimamente pelos gates mecânicos — lote
mínimo incompatível com o teto de risco (XAUUSD) ou R:R pós-SR-cap
desfavorável (a maioria, mercado lateral/apertado na cesta inteira nessa
janela) — não bugs, o mecanismo funcionando como desenhado.

**3 posições abertas ao fim da sessão** (sessão `1d73c50a-...`):
| Símbolo | Lado | Entry | Aberta em (UTC) |
|---|---|---|---|
| NAS100 | SHORT | 29126.52 | 18:49:33 |
| BTCUSD | SHORT | 77336.51 | 18:56:28 |
| XETUSD | LONG | 2393.71 | 19:02:15 |

## Achado 3: gate de fechamento manual bloqueou corretamente (validado ao vivo)

O motor tentou fechar NAS100 manualmente com +$0,37 de lucro (perto do
alvo, mas só ~3% do caminho até lá) — a trava de "≥50% do caminho até
stop/alvo" (existente desde 30/08, ver histórico) recusou corretamente,
citando o mesmo padrão de fechamento nervoso já documentado. Confirma que
essa proteção está viva e funcionando pós-restart.

## Achado 4 / decisão de produto: alavancagem "com meio-termo"

Cleber pediu "captar mais por trade" (as duas primeiras entradas tinham
lucro pequeno em $), depois refinou pra "meio-termo: alavancar mas ainda
se proteger". Investigação encontrou uma tensão real já existente no Setup
do Cleber (`ai_user_config`, não é bug de código): `riskPerTrade: 5%` e
`dailyLossLimit: 5%` — ou seja, **uma única entrada "normal" perdedora já
consumia quase todo o limite de perda diário**, e uma "forte" (7,5% via
`mt5HeavyMultiplier=1.5`) sozinha já estourava.

**Decisão do Cleber** (via pergunta direta com opções): subir o teto
diário, não o risco por trade. **Aplicado diretamente no Supabase**
(`ai_user_config.config`, não é migration de schema, é dado operacional —
mesma tabela que a tela de Setup edita): `dailyLossLimit` 5→**15**
($5→$15). `riskPerTrade` continua em 5% (normal) / 7,5% (forte) — sem
mudança de ruína por trade individual, só mais espaço pra série de trades
jogar sem travar o dia inteiro na primeira perda. Sem validação
estatística ainda (mudança de política de risco, não sinal — precisa de
amostra de dias pra avaliar se o novo teto é adequado).

**Achado 4b (não resolvido): o valor voltou sozinho pra 5% duas vezes.**
Monitorando depois da mudança, `ai_user_config.config->>'dailyLossLimit'`
apareceu de volta em `5` em pelo menos duas checagens seguidas (`updated_at`
avançando a cada vez — 19:08 e depois 19:35 UTC), sem eu ter tocado nele de
novo. Hipótese mais provável (não confirmada): alguma ação no Setup do AI
Trader (abrir a tela, ligar/desligar a IA) resalva a config inteira do
formulário, sobrescrevendo silenciosamente uma edição feita por fora da UI
(mesma classe de risco já documentada pra outras colunas dessa tabela).
**Perguntei ao Cleber se quer que eu reaplique os 15% ou prefere mudar
direto na tela — sem resposta até o fim da sessão.** Enquanto isso não for
resolvido, qualquer ajuste de risco feito via SQL direto nessa tabela deve
ser tratado como temporário/frágil, não confiável entre reaberturas do
Setup.

## Achado 5: fechamento manual liberado quando já cobre o custo do spread

Cleber pediu explicitamente: se a IA quiser fechar antes do alvo E o lucro
já cobrir o spread pago (não é mais ruído/tick dentro do próprio spread),
deve poder fechar — a trava de "≥50% do caminho" ficava rígida demais pra
esse caso (lucro real capturado, mas trade ainda longe do alvo). **Aplicado
e commitado** (`cf20f1f5b`): em `close_position` (`tools.ts` ~linha 1531),
nova condição `clearsSpread` compara `favorableMove` (lucro em preço) contra
o spread REAL do ciclo (`quote.ask - quote.bid`, cotação fresca já exigida
pelo gate acima) — se o lucro já superar o spread, o fechamento manual é
aceito mesmo com <50% do caminho percorrido. O caso original que gerou a
trava (fechamento nervoso perto do zero a zero, SEM lucro real) continua
bloqueado — só muda quando já existe ganho de verdade acima do custo de
transação. `tsc --noEmit` limpo, processo reiniciado.

## Estado dos commits/aplicações ao final da sessão

1. Fix `max_tokens`/`num_ctx` (Achado 1) — **commitado** (`288e9d347`).
2. Migration de regime de mercado (Achado 2) — **aplicada pelo Cleber**.
3. `dailyLossLimit` 5→15 (Achado 4) — **aplicado direto no Supabase**
   (dado operacional, não precisa commit).
4. Fix de fechamento manual por spread (Achado 5) — **commitado**
   (`cf20f1f5b`).
5. `Modelfile.deepseek-r1-trading` (arquivo não rastreado, `ollama create`
   de um experimento anterior à sessão) — não tocado, não faz parte de
   nenhum fix desta sessão, segue não commitado.

## Monitoramento pós-fix (mesma tarde/noite) — 2 saídas reais, 1 achado novo

Com o motor destravado, acompanhamento contínuo (checagens a cada ~25min)
registrou:

- **BTCUSD SHORT fechou +$1,69** (`AI_SIGNAL`, decisão da IA citando
  Estocástico em sobrevendido extremo como exaustão perto do alvo) —
  fechamento razoável.
- **XETUSD LONG fechou -$5,52** (`AI_SIGNAL`) — **achado a investigar,
  NÃO corrigido**: o `exit_price` (2383,84) já estava ABAIXO do próprio
  `stop_loss` registrado (2384,74) no momento em que a IA fechou
  manualmente citando reversão confirmada. Ou seja, o preço já tinha
  furado o nível de stop antes do fechamento discricionário executar — não
  é efeito do fix do Achado 5 (esse só libera fechamento com LUCRO acima do
  spread; aqui foi prejuízo). Duas explicações possíveis, nenhuma
  confirmada: (a) slippage normal de mercado no intervalo entre ciclos
  (~10s) — o preço pode ter gapeado através do stop antes do próximo
  ciclo rodar; (b) o monitor mecânico de stop (`enforceMt5StopsAndTargets`)
  não disparou a tempo por algum motivo a investigar. Perda ficou ~10%
  pior que o risco pretendido pelo stop, não catastrófica, mas merece
  acompanhar se repete.
- Sessão fechou o dia (até o monitoramento ser encerrado a pedido do
  Cleber) em **19 trades fechados, 14 vitórias (73,7%), líquido +$8,55**,
  1 posição aberta (NAS100 SHORT, ainda rodando quando a sessão terminou).

## Pendências reais pra próxima sessão

- **Resolver o `dailyLossLimit` voltando sozinho pra 5%** (Achado 4b) —
  decidir com o Cleber se reaplica 15% e por onde (SQL de novo vai
  provavelmente ser revertido de novo; possivelmente precisa mudar na
  própria tela de Setup, ou investigar QUEM/O QUE resalva essa config).
- **Investigar o caso do XETUSD** (saída além do stop) — puxar mais
  amostras de fechamento por `AI_SIGNAL` que coincidam com preço já
  passado do stop, decidir se é só slippage aceitável ou se
  `enforceMt5StopsAndTargets` tem uma janela de atraso real que vale
  apertar.
- **Observar amostra nova** (dias, não horas) com a cadeia toda
  funcionando de ponta a ponta pela primeira vez hoje: motor decide → gates
  filtram → grava → gerencia stop/breakeven/trailing → fecha. Nenhuma
  validação estatística ainda de que os fixes de hoje melhoram o líquido —
  são correção de mecânica bloqueante, não alegação de edge.
- Avaliar se `dailyLossLimit=15%` (quando de fato ficar estável) é
  adequado ou generoso demais depois de alguns dias de amostra — decisão
  de risco, não settada em pedra.
- Avaliar se o novo escape de "fechamento por spread coberto" está sendo
  usado com disciplina (lucro real pequeno mas genuíno) ou virando desculpa
  pra sair cedo demais de teses ainda válidas — mesma vigilância que gerou
  a trava original de 50%.
- Achado sem fix (não investigado a fundo, mesmo de sempre): modelo
  continua consultando DOGUSD/XRPUSD/BTCXBN todo ciclo mesmo fora da cesta
  configurada — sem impacto real, só ruído de log/iterações.
- NAS100 SHORT segue aberta — acompanhar como fecha (SL/TP mecânico) na
  próxima checagem. Monitoramento contínuo foi encerrado a pedido do
  Cleber nesta sessão; retomar com `/loop` ou pedido direto se quiser.
