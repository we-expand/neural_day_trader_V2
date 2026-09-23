# Sessão 2026-09-22 — Teste de modelos de LLM, ajuste de gate de volume, monitoramento contínuo e achado no gate de Estocástico

> Handoff completo desta sessão. Resumo de 1-2 linhas já adicionado (ou a
> adicionar) ao topo do `CLAUDE.md` — consultar este arquivo só se precisar
> do detalhe completo.

## Contexto de entrada

Sessão começou com o Cleber pedindo pra entender qual LLM estava rodando o
LLM Brain e se estava estável — na entrada, o motor rodava Ollama local
(`qwen3-1.7b-trading`), trocado nessa mesma manhã (fora desta sessão, ver
commit `8f3cd9bc4`) por falta de RAM pra rodar o modelo maior
(`qwen35-trading`, 4B). Log ao vivo mostrou o 1.7B repetindo a mesma
`log_thought` 14x seguidas no mesmo ciclo — sintoma de raciocínio fraco
pro tamanho do modelo.

## Parte 1 — Busca por alternativa gratuita mais estável

Pedido do Cleber: solução **gratuita** e **funcional o mais rápido
possível**.

### Testado e descartado (tudo ao vivo, via `curl` direto nas APIs)

| Provedor | Resultado real |
|---|---|
| SambaNova (`Meta-Llama-3.3-70B`, `gpt-oss-120b`) | `PAYMENT_METHOD_REQUIRED` — free tier fechado (mesmo destino da Cerebras em 2026-08-29) |
| Groq (`gpt-oss-120b`) | Funciona (137ms, tool-call correto), mas teto de **8.000 tokens/minuto** não cabe nem 1 chamada do ciclo real (~19-21k tokens de prompt) |
| NVIDIA `nemotron-3-nano-30b-a3b` (modelo original do projeto) | Confirmado `HTTP 410 Gone` — NVIDIA aposentou em 2026-09-01, sem volta possível |
| NVIDIA `nemotron-nano-3-30b-a3b` / `llama-3.1-nemotron-70b-instruct` | `HTTP 404` — não habilitados pra esta conta |
| NVIDIA `nemotron-3-super-120b-a12b` | Responde, mas **não emite `tool_calls` estruturado** — devolve JSON como texto solto em `content`, mesmo defeito que já matou o `gpt-oss-120b` original |
| **NVIDIA `openai/gpt-oss-20b`** | Tool-calling correto, aguenta prompt de 19k tokens (3,5s) — mas **instável de forma imprevisível** em produção real: 3 execuções diferentes deram 2, 4 e 0 erros de conexão respectivamente (`APIConnectionError`, sem padrão), sem nunca estabilizar de vez |

### Decisão

Cleber: **"não podemos ter um modelo funcionando que falha toda hora"** —
critério correto, rejeitado o `gpt-oss-20b` apesar de tecnicamente
funcional às vezes. Voltamos pro **Ollama local**, com `qwen35-trading`
(4B) em vez do `qwen3-1.7b-trading` — RAM da máquina medida em ~597MB-1GB
de swap livre no momento (instável, mas melhor que o pico de 98% de uso
que causou o crash-loop de mais cedo). `.env` documentado com o histórico
completo de tentativas antes da linha ativa
(`llm-active-brain/.env`, comentários datados 2026-09-22).

**Nenhum crash de RAM aconteceu** com o `qwen35-trading` durante toda a
sessão de monitoramento que seguiu — RAM oscilou entre ~300MB e ~1,5GB de
swap livre o tempo todo, sem nunca faltar de verdade.

## Parte 2 — Ajuste do gate de volume elevado (pedido do Cleber)

Cleber notou volume mais baixo num horário do meio do dia e pediu pra
poder regular o threshold sem editar código toda vez — mesmo padrão que já
existia só pra janela noturna (`MT5_VOLUME_ELEVATED_RATIO_EVENING`,
17h-00h Brasília).

Implementado: `config.mt5VolumeElevatedRatio`, lido de
`MT5_VOLUME_ELEVATED_RATIO` (`llm-active-brain/src/config.ts`), aplicado
em `atr.ts` (`getVolumeConfirmation`) no lugar da constante fixa
`VOLUME_ELEVATED_RATIO = 1.05`. `tsc --noEmit` limpo nos 2 arquivos.

Valor ajustado 2x nesta sessão, ambos a pedido explícito do Cleber:
- 1,05 → 1,02 ("um pouco acima da média")
- 1,02 → **1,0** (Dashboard mostrando volume 1,2 "agora", pedido pra
  considerar volume elevado a partir da própria média, sem exigir nada
  acima dela)

`MT5_VOLUME_ELEVATED_RATIO=1.0` está ativo no `.env`. **Sem validação
estatística ainda** — é só o valor pedido, igual o gate noturno também não
teve validação quando foi criado.

## Parte 3 — Monitoramento contínuo (cron 5 em 5min, ~1h de observação)

Armado via `/loop 5m` (job `153a7b05`, desarmado no fim da sessão a
pedido do Cleber). Cobriu 10 ciclos completos do motor sob
`qwen35-trading`.

### Achados de estabilidade

- **Processo nunca crashou** — PID único o tempo todo (16234), sem
  SIGKILL, sem restart necessário além do inicial pra aplicar as configs
  novas.
- **Zero erros de conexão** — esperado, motor 100% local agora.
- **1 lentidão real notada**: ciclo 1 demorou 15+ minutos pra fechar (não
  travamento — `llama-server` com CPU ativa o tempo todo, só lento sob a
  RAM apertada da máquina). Ciclos seguintes voltaram a um ritmo normal.
- **RAM/swap oscilou entre ~300MB e ~1,5GB livres** o tempo todo, sem
  padrão fixo de subida/descida, nunca esgotou de vez.

### Investigação do "feed travado" (XETUSD, depois UKOUSD)

Log acumulou 168+ avisos de `[mt5Broker] ... devolveu o MESMO preco Nx
seguidas -- possivel feed travado`, streak chegando a 9x seguidas em
UKOUSD — **investigado ao vivo, não é bug real**: testei o mesmo endpoint
(`/mt5-prices`) direto via `curl`, 3 chamadas com 2s de intervalo, e
confirmei que a MetaAPI simplesmente não atualiza o tick de CFDs (UKOUSD,
XETUSD) tão rápido quanto o motor consulta — normal pra ativos não-cripto,
principalmente em volume mais baixo. Prova concreta: `stale:true` (o sinal
que de fato indicaria problema) só apareceu **1 vez** em toda a sessão, e
mesmo essa vez não impediu o watchdog de proteger a posição depois.

Achado colateral, real mas transitório: `[neuralBridge/mt5] SEM PROTECAO
MECANICA neste tick` apareceu **15 vezes** (watchdog não conseguiu checar
stop/alvo por feed momentaneamente indisponível) — em todos os casos
observados, recuperou no tick seguinte e fechou as posições corretamente
quando precisou (ver XETUSD abaixo).

### Nota de config fora desta sessão

Log mostrou aviso: `Setup configurou 7 ativo(s), mas 1 não existe em
MT5_ASSET_BASKET: US2000` — cesta efetiva ficou com 6 ativos. Se alguém
adicionou US2000 esperando que operasse, não vai funcionar sem mapear pro
símbolo real da corretora ou adicionar ao array — não investigado a fundo
nesta sessão, só reportado ao Cleber.

### Trades reais da sessão (DEMO, `live_execution:false`)

1. **XETUSD SHORT** (entrada 2733,43, tamanho "forte", confiança 82%) —
   fechou por **stop-loss mecânico** (`entrada=2733.43 saida=2750.22`,
   overshoot pequeno ~$1,96 além do stop nominal, dentro do aceitável).
   Uma tentativa de fechamento discricionário foi **corretamente
   bloqueada** pela trava do llm-council de 2026-09-11 (fechamento
   discricionário suspenso).
2. **UKOUSD SHORT** (entrada 100,074, confiança 82%) — realizou **parcial
   de lucro em 117% de 1R** (+$2,78) e depois fechou por **take-profit
   mecânico completo** (`entrada=100.074 saida=99.129`). Ciclo de vida
   completo e positivo: abriu → protegeu parcial → bateu alvo.

Vários gates de qualidade bloquearam corretamente tentativas mais fracas
ao longo da sessão: falta de padrão de candle real confirmando reversão
(CHINA50, SPX500, HKG33), confiança declarada abaixo do mínimo (JPN225),
candle de rompimento ainda não fechado (NAS100), Estocástico bruto em
extremo (`EURUSD`, `k=1.92`).

## Parte 4 — Achado real de lógica: gate de Estocástico tem brecha de auto-classificação

**Origem**: Cleber notou "a IA acabou de decidir uma venda com estocástico
sobrevendido" e perguntou qual era a dificuldade de entender isso.

Investigação no log e no código (`tools.ts`) achou a causa raiz real: o
motor **sabe** que Estocástico sobrevendido favorece compra (o próprio
reasoning da IA cita isso explicitamente: *"STOCHASTICOS sobrevendidos
favorecem compra mas a confluência dominante aponta continuação da
baixa"*), mas abriu SHORT mesmo assim.

Existe uma trava mecânica pra exatamente esse padrão (princípio 1l em
`agent.ts`, código em `tools.ts:1906`) — **mas ela só age quando
`setupType === "REVERSAO"`**. Isso não é acidente: foi deliberadamente
afrouxado em 2026-09-21 (decisão do llm-council, Ajuste 1) porque uma
medição real em produção (170 bloqueios em 9 dias) mostrou que **93%
desses bloqueios eram falsos positivos** — travavam continuações
saudáveis só porque o Estocástico estava "na zona" sem cruzar de verdade
(`crossing=null`), com tendência/MACD/direção real alinhados.

**A brecha**: o modelo pode se auto-classificar como "não é reversão, é
continuação" (não marcar `setupType: "REVERSAO"` na chamada) e escapar da
trava — mesmo indo tecnicamente contra o próprio indicador que ele cita
como fator. Só resta como rede de segurança o gate de Estocástico *bruto*
em extremo literal (≥95 ou ≤5), que é mais frouxo.

**Não corrigido nesta sessão** — Cleber ainda não decidiu se quer apertar
(ex: bloquear também continuação, ou exigir confirmação extra quando o
modelo tenta contornar) ou deixar rodar mais sob a regra atual (calibrada
com dado real, mexer sem medir de novo repetiria erro já catalogado no
projeto).

## Pendências reais em aberto

1. **Gate de Estocástico contrário em entradas de continuação** — decisão
   pendente do Cleber (apertar de novo vs. deixar como está).
2. **`US2000` no Setup não existe no catálogo real** — cesta rodando com 1
   ativo a menos do que o configurado; ninguém corrigiu ainda.
3. **`MT5_VOLUME_ELEVATED_RATIO=1.0` e `MT5_VOLUME_ELEVATED_RATIO=1.02`
   (histórico)** — sem validação estatística, precisa de amostra rodando
   antes de julgar efeito.
4. Nenhum `git commit` rodado nesta sessão (regra fixa do projeto — Claude
   nunca commita sozinho). Arquivos tocados: `llm-active-brain/.env`
   (não versionado, nunca precisa de commit), `llm-active-brain/src/config.ts`,
   `llm-active-brain/src/atr.ts`. Comando de commit entregue seguindo o
   padrão do projeto, aguardando Cleber rodar:

```bash
cd llm-active-brain && git add src/config.ts src/atr.ts && git commit -m "feat(llm-brain): expõe threshold de volume elevado diurno via MT5_VOLUME_ELEVATED_RATIO"
```

5. Motor segue rodando com `qwen35-trading` (Ollama local) no momento em
   que esta sessão terminou — sem posição aberta, ciclo 10 concluído.
