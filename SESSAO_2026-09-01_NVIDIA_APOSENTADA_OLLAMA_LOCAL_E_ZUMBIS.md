# Sessão 2026-09-01 — Motor parado por modelo aposentado, migração pra Ollama local, achado grave de processos zumbis

## Resumo em 1 parágrafo

O Cérebro LLM Ativo (`llm-active-brain`) estava parado desde 2026-08-31 porque
a NVIDIA aposentou o modelo em uso (`nemotron-3-nano-30b-a3b`, EOL confirmado
2026-09-01T09:00Z) — todo ciclo falhava e o processo bateu o teto de
`MAX_CYCLES` e se desligou sozinho, sem ninguém perceber por ~16h. Depois de
testar Groq (cota diária curta demais) e NVIDIA/outros provedores gratuitos
(nenhum viável), migrado pra **Ollama local** (roda na mesma máquina do
Cleber, sem cota/rate-limit). No meio do caminho, achado um bug operacional
grave: 13 processos zumbis do motor acumulados ao longo do dia (meu próprio
padrão de `pkill` nunca batia no processo real), todos competindo pela mesma
conta MT5 e pelo Ollama — corrigido. Ao final da sessão: motor rodando limpo
(1 processo confirmado), Qwen3.5 4B local, cesta de 9 ativos, teto de risco
por trade subido de 3%→6% (pedido do Cleber), **zero posições abertas ainda**
(mercado com bastante ativo sobrecomprado/lateral — parece seletividade
correta do prompt, não bug, mas precisa de mais amostra pra confirmar).

## Estado exato ao final da sessão (pra retomar sem re-investigar)

- **Processo**: rodando via `watchdog.sh` (novo, religa sozinho em qualquer
  saída). Único processo confirmado (checagem repetida com `ps aux`).
- **Provedor**: `LLM_PROVIDER=ollama` no `.env`, modelo `qwen35-trading`
  (Qwen3.5 4B + Modelfile customizado com `num_ctx=16384` — **crítico**: um
  modelo Ollama "cru" trunca contexto em ~2048 tokens silenciosamente, ver
  achado abaixo).
- **Cesta efetiva**: 9 ativos — EURUSD, XAUUSD, UKOUSD, BTCUSD, XETUSD, GER40,
  SPX500, NAS100, UK100 (interseção entre `MT5_ASSET_BASKET` em
  `assetBasket.ts`, 16 símbolos, e `activeAssets` do Setup do usuário no
  Supabase, que tem outros 3 não usados: SOLUSD, COFUSD, COCUSD).
- **Risco por trade**: `MT5_RISK_PCT_PER_TRADE=0.02` no `.env` (irrelevante,
  sobreposto pelo Setup do usuário no Supabase, que está em 5%).
  `MT5_MAX_RISK_PCT_PER_TRADE=0.06` (subido de 3% padrão, pedido explícito do
  Cleber pra destravar BTCUSD/UKOUSD nesta conta pequena — ver achado
  "trava de risco" abaixo).
- **7 ciclos completos ao encerrar a sessão, ZERO `open_position` tentados**
  desde a troca pro Qwen3.5 4B — cada ciclo avalia os 9 ativos com dados reais
  (trend/volume/MACD/estocástico/S&R/candles) mas não encontra confluência
  suficiente. Estocástico SOBRECOMPRADO em vários ativos (BTCUSD, XETUSD,
  UKOUSD, NAS100) no momento — pode ser seletividade correta (evitar comprar
  topo esticado, princípio 1b do prompt) coincidindo com um momento real de
  mercado esticado, ou pode ser o modelo mais fraco (4B) sendo excessivamente
  conservador. **Próxima sessão: olhar se isso persiste por muitas horas —
  se sim, considerar voltar pro 8B (`qwen3-trading`, já criado e testado no
  Ollama local, só mais lento) ou revisar o prompt de novo.**

## Achados reais, em ordem cronológica

### 1. Causa raiz do motor parado: NVIDIA aposentou o modelo

Confirmado direto via curl contra `https://integrate.api.nvidia.com/v1/chat/completions`:
```json
{"title":"Gone","status":410,"detail":"The model 'nvidia/nemotron-3-nano-30b-a3b' has reached its end of life on 2026-09-01T09:00:00Z and is no longer available."}
```
O log mostrava 404 desde o ciclo ~330 (ontem), virando 410 definitivo depois —
todo ciclo desde então falhava, o agente nunca decidia nada. Testado o
catálogo inteiro de modelos NVIDIA disponíveis pra esta conta: nenhum
combina rápido + formato de tool-call correto (`tool_calls`, não texto solto)
+ aguenta o tamanho do prompt real (~8-9K tokens). NVIDIA não é mais viável
pra este projeto com a conta atual, a menos que surja um modelo novo — testar
de novo antes de tentar voltar.

### 2. Bug real corrigido: pausa entre ciclos pulada em erro persistente

Em `index.ts`, o branch multi-sessão (usado hoje, `MT5_TRADING_ENABLED=true`)
não tinha `sleep` no `catch` de erro por sessão — só o branch legado (sem
sessão) tinha. Resultado: uma falha persistente (413/410/o que for) fazia o
loop martelar o próximo ciclo sem pausa nenhuma (confirmado: 1700+ ciclos em
15s numa medição). Corrigido adicionando o mesmo `sleep(cycleDelaySeconds)`
no catch que faltava.

### 3. Groq: teto de 8.000 tokens/min (conta inteira) + cota diária curta

Testado e confirmado real: Groq (`openai/gpt-oss-120b`) tem um teto FIXO de
8.000 tokens/minuto **pra conta inteira**, igual em todos os modelos —
confirmado via headers `x-ratelimit-limit-tokens`. O prompt real do motor
(cesta de 9 ativos) fica em ~8.800-9.800 tokens, sempre estourando esse
teto. Além disso, mesmo depois de reduzir a cesta pra 4 ativos pra caber no
teto por minuto, a conta bateu uma **cota diária** separada (esperas de
133s-493s reportadas pela própria API) — inutilizável pra modo contínuo,
mesmo cortando a cesta. Já era um padrão documentado antes (ver
CLAUDE.md/histórico: "Groq -> NVIDIA por cota diária curta demais").

### 4. Compactação do prompt do sistema (~30%, sem perder regra nenhuma)

`GENESIS_PROMPT_MT5` em `agent.ts`: 38.803 → 27.148 caracteres. Cortado só
narrativa histórica repetida (datas, "achado do Cleber em tal sessão",
justificativas motivacionais tipo Kotegawa/Rotter) — toda regra numérica,
threshold e guardrail real foi preservada, só reescrita mais direta. Vale
como otimização permanente independente do provedor (menos tokens = mais
rápido em qualquer modelo).

### 5. Outras nuvens gratuitas testadas e descartadas nesta sessão

- **Cerebras**: chave salva no `.env` está inválida (expirada/rotacionada) —
  precisa logar em cloud.cerebras.ai e gerar uma nova, se quiser retomar.
- **SambaNova**: chave válida, mas a conta agora exige cartão de crédito
  (`PAYMENT_METHOD_REQUIRED`) — mudou desde a última vez testada (29/08).
- **Gemini**: sem chave preenchida (conta bloqueada, decisão de sessão
  anterior).
- **OpenRouter (sugestão do Cleber, "IAs chinesas")**: nunca testado de
  fato — tier grátis é 50 chamadas/dia sem crédito comprado (1000/dia com
  US$10 de crédito uma vez), incompatível com um loop de ~10s/ciclo sem
  desacelerar MUITO o `CYCLE_DELAY_SECONDS`. Não descartado por teste
  direto, só por análise de limite documentado — vale reconsiderar se
  Ollama local não funcionar bem.

### 6. Ollama local — solução adotada, com 2 achados críticos

**Instalado via Homebrew** (`brew install ollama`, `brew services start
ollama`), roda como serviço em background, endpoint compatível com OpenAI em
`http://localhost:11434/v1`.

**Achado crítico #1 (silencioso, quase passou despercebido)**: Ollama trunca
o contexto em ~2048 tokens por padrão (`num_ctx`), SEM avisar nem dar erro —
confirmado mandando o prompt real (27K chars, ~8400 tokens) e recebendo de
volta `"prompt_tokens":2050` (cortado), com o modelo "raciocinando" sobre
fragmentos soltos do prompt (chegou a citar comentários de código-fonte como
se fossem parte da própria identidade). **Nunca usar um nome de modelo
Ollama "cru" neste projeto** — sempre criar uma versão customizada via
Modelfile com `PARAMETER num_ctx 16384`:
```
ollama create qwen3-trading -f Modelfile.qwen3-trading    # 8B, mais lento, melhor raciocínio
ollama create qwen35-trading -f Modelfile.qwen35-trading  # 4B, ~2x mais rápido, em uso agora
```
Ambos os Modelfiles estão commitados no repo (`llm-active-brain/`).

**Achado crítico #2 (o mais grave da sessão, causa raiz de boa parte da
"lentidão" que pareceu ser do modelo)**: 13 processos zumbis do motor
acumulados desde as 08:06 até as 09:53, todos ainda vivos e conectados ao
Ollama simultaneamente. Causa raiz: todo `pkill -9 -f "tsx src/index.ts"`
usado nos restarts (manuais E dentro do `watchdog.sh` original) **nunca deu
match de verdade** — o processo real roda como `node --require
.../tsx/dist/preflight.cjs --import .../tsx/dist/loader.mjs src/index.ts`,
sem a substring literal "tsx src/index.ts" na linha de comando. Toda vez que
"matei e religuei" o motor ao longo do dia, o antigo continuava vivo por
baixo — 6-13 instâncias concorrentes brigando pela mesma conta MT5
compartilhada e, mais tarde, pelo mesmo Ollama (GPU/memória), causando
lentidão extrema e comportamento errático (timeouts, filas de 90s+ pra
trocar de modelo). **Corrigido em `watchdog.sh`**: padrão agora é
`pkill -9 -f "tsx/dist/loader.mjs src/index.ts"`, confirmado batendo no
processo certo. **Antes de qualquer restart manual futuro, sempre confirmar
com `ps aux | grep -E "node.*index.ts"` que sobra exatamente 1 processo
(2 linhas — o par normal do wrapper `tsx` — é normal, mais que isso é bug).**

### 7. Trava de risco mínimo — matemática confirmada correta, não bug

BTCUSD/UKOUSD, no lote mínimo (0,01) e preço/stop de hoje, exigiam
$3,49-$3,76 de risco — acima do teto duro de 3% (`mt5MaxRiskPctPerTrade`,
$2,99 numa conta de $99,76). Matemática auditada e confirmada correta em
`tools.ts` (linha ~1300, gate de risco mínimo) — não é bug, é a trava
funcionando como projetada. A pedido explícito do Cleber ("impossível não
conseguir operar 0,01 bitcoin com $100"), o teto foi subido de 3%→6%
(`MT5_MAX_RISK_PCT_PER_TRADE=0.06` no `.env`) — destrava BTCUSD/UKOUSD nesse
tamanho de conta, com folga. **Efeito real avisado ao Cleber**: perda máxima
possível por trade perdedor sobe de ~$3 pra ~$6 numa conta de $100 — risco
maior aceito deliberadamente, não efeito colateral. Também consistente agora
com o `riskPerTradePct=5%` já configurado no Setup do AI Trader (antes o
teto duro de 3% era MENOR que o alvo do próprio Setup, o que nunca fazia
sentido).

### 8. Cesta reduzida e restaurada 2x (aprendizado de processo)

Reduzida pra 4 ativos duas vezes ao longo do dia (uma vez pensando na Groq,
outra por urgência de velocidade) e restaurada pra 9 as duas vezes depois de
descobrir que a redução criava um problema pior (menos ativos = menos chance
de algum passar no piso de risco). **Lição**: a decisão de cesta reduzida
só fazia sentido enquanto o gargalo era teto de tokens (Groq) — assim que
migrou pra Ollama local (sem esse teto), reduzir a cesta só piora a
frequência de entrada, nunca ajuda. Não reduzir a cesta de novo sem esse
raciocínio explícito.

### 9. Confirmado: operação manual do Cleber não é bug

Uma entrada SHORT BTCUSD (+$28,01, 19:27-19:31 UTC) que o Cleber viu no
histórico e desconfiou ser da IA — confirmado via `ai_trades.ai_reasoning =
"Ordem manual do usuário"`. Foi ele mesmo, pelo painel, não o motor.

### 10. Ordens pendentes manuais — tabela nem existe em produção

Cleber colocou 2 ordens pendentes manualmente no gráfico e pediu pra
cancelar. Achado: a tabela `ai_pending_orders` (onde o código
`AITradingPersistenceService.ts` tenta persistir ordens pendentes) **não
existe no banco de produção** — nunca foi migrada. Ou seja, ordens
pendentes manuais hoje só vivem no estado React do navegador (nunca
persistidas), então não há nada que eu possa cancelar via SQL/script. Se
sumiram do gráfico (ex: depois de um refresh), já sumiram de verdade — não
sobra registro fantasma. **Gap de produto real, não corrigido nesta
sessão**: se o Cleber quiser que ordens pendentes sobrevivam a
reload/troca de aba, falta criar essa tabela e migration.

## Pendências reais pra próxima sessão

1. **Observar se o motor abre alguma posição com o Qwen3.5 4B** — 7 ciclos,
   zero tentativas até agora. Se continuar assim por muitas horas mais,
   considerar: (a) voltar pro Qwen3-trading 8B (melhor raciocínio, só mais
   lento — já criado no Ollama local, é só trocar `model` em `config.ts`
   de volta pra `"qwen3-trading"`); (b) revisar se o prompt ficou conservador
   demais depois da compactação; (c) checar se é só um momento real de
   mercado esticado (Estocástico sobrecomprado generalizado).
2. **Commit já feito e pushado** (`bc632a985` — provedor NVIDIA→Groq→Ollama,
   watchdog, prompt compactado, `.gitignore`). Mudanças MAIS RECENTES desta
   sessão (troca final pro Qwen3.5 4B em `config.ts`, `MT5_MAX_RISK_PCT_PER_TRADE`
   no `.env` — não versionado, `.env` é gitignored, então não precisa commit
   pra essa parte — e o `Modelfile.qwen35-trading` novo) **ainda não
   commitadas** — comando pronto abaixo.
3. **Decisão pendente do Cleber**: teto de risco em 6% é permanente ou só
   pra hoje? Se quiser reverter, `MT5_MAX_RISK_PCT_PER_TRADE=0.03` de volta
   no `.env` (ou remover a linha, já que o default em `config.ts` é 0.03).
4. **Tabela `ai_pending_orders` não existe** — se o Cleber quiser persistir
   ordens pendentes manuais de verdade, precisa de migration nova (fora do
   escopo desta sessão, não investigado a fundo).
5. **Watch geral**: com o motor rodando 24/7 via `watchdog.sh`, sempre
   confirmar com `ps aux | grep -E "node.*index.ts"` antes de qualquer
   restart manual que sobra exatamente 1 processo antes E depois — o bug de
   zumbis já foi corrigido no padrão do `pkill`, mas vale o hábito de
   verificação dado o histórico de hoje.

## Comandos prontos

Commit do que falta (`Modelfile.qwen35-trading` novo + `config.ts`/`.env.example`
se aplicável):
```bash
cd /Users/clebercouto/Projects/we-expand/Neural-Day-Trader
git add llm-active-brain/src/config.ts llm-active-brain/Modelfile.qwen35-trading
git commit -m "$(cat <<'MSG'
fix(llm-brain): troca Ollama local pra Qwen3.5 4B (2x mais rapido que o 8B)

Testado lado a lado com o mesmo prompt real (8400 tokens): qwen3-trading
(8B) levou 58s na 1a chamada fria, qwen35-trading (Qwen3.5 4B) levou 30s,
raciocinio e tool_call igualmente corretos no teste -- trocado pro mais
rapido a pedido do Cleber (prioridade era velocidade/frequencia de ciclo).
qwen3-trading (8B) continua criado no Ollama local como fallback de
qualidade se a velocidade deixar de ser a prioridade.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
MSG
)"
```

Verificar processo único antes de qualquer restart:
```bash
ps aux | grep -E "node.*index.ts" | grep -v grep
# deve mostrar exatamente 2 linhas (par normal do wrapper tsx) -- mais que isso e' bug
```

Restart limpo (sempre nesta ordem):
```bash
cd /Users/clebercouto/Projects/we-expand/Neural-Day-Trader/llm-active-brain
pkill -9 -f "tsx/dist/loader.mjs src/index.ts" 2>/dev/null
pkill -9 -f "watchdog.sh" 2>/dev/null
sleep 2
ps aux | grep -E "node.*index.ts|watchdog.sh" | grep -v grep   # confirmar vazio
rm -f llm-brain.pid
nohup ./watchdog.sh >> watchdog.log 2>&1 &
disown
```
