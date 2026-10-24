# Sessão 2026-09-22 — Crash-loop do LLM Brain, troca de modelo, .env duplicado e rate-limit da NVIDIA

## Contexto inicial

Cleber reportou, às 2h52 da manhã, que a LLM não tinha aberto nenhuma
posição e suspeitava que estava "restritiva demais", possivelmente por
estar direcionada ao mercado asiático.

## Achado 1 — não era seletividade, era crash-loop (RESOLVIDO)

O motor estava sendo morto com `SIGKILL` (código de saída 137) repetidas
vezes ao longo da madrugada (confirmado no `watchdog.log`: pelo menos 6
mortes entre 01:31 e 02:51), religado pelo `watchdog.sh` a cada vez, mas
nunca sobrevivendo tempo suficiente pra completar um ciclo de decisão —
o log sempre reiniciava em `CICLO 1`.

Causa provável identificada: a máquina estava com RAM praticamente
esgotada (swap em ~95% de 12GB, ~68MB de RAM livre) — assinatura clássica
do OOM killer do macOS (`jetsam`) matando o processo pra liberar memória.
Suspeita inicial (posteriormente descartada como causa direta) era o
modelo Ollama local competindo por RAM.

**Achado colateral**: o `watchdog.sh` (que deveria religar o processo
sozinho em caso de nova queda) tinha parado de rodar como loop
supervisor — o processo `npm run start` estava órfão (PPID=1). Religado
manualmente via `nohup ./watchdog.sh >> watchdog.log 2>&1 &`.

## Achado 2 — troca de modelo local Qwen3.5 4B → Qwen3 1.7B (aplicado, mas hoje sem efeito prático)

A pedido do Cleber ("vamos de Qwen3"), pra reduzir a pegada de memória do
modelo local:
- `ollama pull qwen3:1.7b` (1,4GB, menos da metade do `qwen35-trading`
  de 3,4GB)
- `Modelfile.qwen3-1.7b-trading` criado (`num_ctx 32768`, `num_keep
  12000`, mesmo padrão do `Modelfile.qwen35-trading`)
- `ollama create qwen3-1.7b-trading -f Modelfile.qwen3-1.7b-trading`
- `llm-active-brain/src/config.ts` (~linha 109-121): `model` do bloco
  `ollama` trocado de `"qwen35-trading"` pra `"qwen3-1.7b-trading"`,
  achado documentado no comentário do código.
- `tsc --noEmit` limpo.

**Achado importante que tornou esta troca sem efeito imediato**: o
processo real não estava (e não está) rodando com `LLM_PROVIDER=ollama`
— ver Achado 3 abaixo. `ollama ps` confirmou zero modelos carregados em
memória durante todo o período investigado. A troca fica pronta pra
quando/se o projeto voltar a usar Ollama local, mas não mudou o
comportamento do motor hoje.

Commit entregue (comando pronto, não rodado por mim):
```bash
cd llm-active-brain && git add src/config.ts Modelfile.qwen3-1.7b-trading && git commit -m "fix(llm-brain): troca modelo local pra qwen3-1.7b-trading (RAM/swap esgotados causando SIGKILL)"
```
Não sei se o Cleber já rodou este commit.

## Achado 3 — `.env` com `LLM_PROVIDER` duplicado (CORRIGIDO)

`llm-active-brain/.env` tinha `LLM_PROVIDER` definido 2x:
- linha ~180: `LLM_PROVIDER=ollama` (resíduo de 2026-09-01, quando a
  NVIDIA tinha aposentado o modelo em uso)
- linha ~224: `LLM_PROVIDER=nvidia` (mudança feita hoje, 2026-09-22, por
  outra sessão/decisão anterior a esta conversa)

`dotenv` usa a **última ocorrência** do arquivo ao parsear — logo, na
prática, o motor sempre esteve rodando com `nvidia`/`moonshotai/kimi-k3`,
nunca com Ollama local, apesar da linha antiga sugerir o contrário.
Confirmado via `ollama ps` (vazio) durante todo o período.

Corrigido: linha ~180 comentada, só a linha ~224 (`nvidia`) fica ativa,
eliminando a ambiguidade pra leitura futura. `.env` está no `.gitignore`
— não precisa de commit, a mudança já é efetiva localmente.

## Achado 4 — medição de latência real, nenhum modelo mais rápido disponível

A pedido do Cleber, testei a latência real do `moonshotai/kimi-k3`
(modelo NVIDIA ativo) contra um prompt de tamanho real (~7.200 tokens,
mesma ordem de grandeza do prompt de produção) e comparei com
alternativas:

| Modelo | Resultado |
|---|---|
| **kimi-k3 (ativo)** | **~25s**, tool-call correto |
| nvidia/nemotron-nano-3-30b-a3b | HTTP 404 — não habilitado pra esta conta (apesar de listado em `/v1/models`) |
| nvidia/mistral-nemo-minitron-8b | HTTP 404 — idem |
| nvidia/llama-3.1-nemotron-51b | HTTP 404 — idem |
| deepseek-ai/deepseek-v4.1-flash | 259s — inviável |
| z-ai/glm-5.3-flash | 176s — inviável |

Conclusão: `kimi-k3` já é o mais rápido genuinamente disponível pra esta
chave NVIDIA hoje. "Flash" no nome não indica latência baixa nesses
provedores via NIM (provavelmente cold-start de hospedagem sob demanda).
Alavancas de velocidade reais, não testadas ainda: reduzir tamanho do
prompt/cesta, ou pedir habilitação de mais modelos no console da NVIDIA
(`build.nvidia.com`) — os 404 podem ser só falta de ativação por conta,
não indisponibilidade real do modelo.

## Achado 5 — rate-limit ativo na NVIDIA, IA travada às 11h36 (EM ABERTO)

Cleber reportou de manhã (11h36) que só 2 operações tinham saído
(confirmado via SQL: na verdade **1 entrada real** — BTCUSD LONG às
05:39 Brasília — que gerou 2 registros porque teve realização parcial em
1R + fechamento total, ambos em TP, lucro líquido +$3,47). Desde então,
zero decisões novas.

Investigação no `llm-brain.log` (processo rodando desde 03:04, PID
86672): de 39 ciclos completados até 11h36, **19 falharam por completo**
com "Connection error"/"429 status code" contra a NVIDIA, esgotando as 8
tentativas de retry por ciclo sem conseguir decidir nada.

Confirmado ao vivo (`curl` direto, 3 tentativas seguidas): **a chave
NVIDIA está sob rate-limit agora** (HTTP 429 consistente). Conectividade
geral da máquina está OK (testado contra google.com, 200 em 0,24s) — o
problema é específico da cota da API NVIDIA, não da rede.

**Autocrítica registrada, honesta**: as 5 chamadas de teste de latência
do Achado 4 (rodadas mais cedo na mesma sessão, incluindo 2 que
processaram por 259s e 176s) usaram a MESMA chave `NVIDIA_API_KEY` que o
motor de produção usa — é bem provável que tenham contribuído pra
estourar a cota gratuita compartilhada. Não há como descartar essa
contribuição minha pro problema.

Testei o `GROQ_API_KEY` (já configurado no `.env`, não usado hoje) como
alternativa: respondeu HTTP 200 em 0,34s, bem mais rápido que a NVIDIA
inclusive. Risco conhecido já catalogado no histórico do projeto: a cota
diária do Groq é curta pra modo contínuo 24/7 (já esgotou no meio do dia
em sessões anteriores, ver `CLAUDE_HISTORY.md`).

**Decisão do Cleber**: "cancele tudo" — não trocar de provedor, não
mexer nos retries, não fazer nada agora. Ficou em aberto sem ação.

## Estado real ao fim da sessão

- Processo do LLM Brain rodando (PID 86672, desde 03:04), sob rate-limit
  ativo da NVIDIA — maioria dos ciclos falhando, não decidindo nada.
- `watchdog.sh` religado e supervisionando (PID 86576).
- `.env`: `LLM_PROVIDER` duplicado corrigido (só `nvidia` ativo agora).
- `config.ts`: modelo Ollama local trocado pra `qwen3-1.7b-trading`, mas
  sem efeito prático hoje (provider ativo é NVIDIA, não Ollama).
- Nenhum restart feito pós-correção do `.env` (a correção do duplicado
  não muda o comportamento em runtime, já que a última linha do arquivo
  já era a que valia).
- Causa raiz do "opera pouco" agora é **rate-limit da NVIDIA**, não
  seletividade nem bug de código — sem ação tomada, aguardando decisão
  do Cleber numa sessão futura.

## Pendências reais

1. Decidir o que fazer com o rate-limit da NVIDIA (esperar resetar,
   trocar pra Groq temporariamente, reduzir retries por ciclo, ou pedir
   habilitação de mais modelos no console da NVIDIA) — 3 opções foram
   apresentadas ao Cleber, nenhuma escolhida ainda.
2. `git commit` da troca de modelo Qwen (`config.ts` +
   `Modelfile.qwen3-1.7b-trading`) — comando entregue, não confirmado se
   rodado.
3. Investigar separadamente a causa raiz da pressão de memória da
   máquina (Chrome com muitas abas, múltiplas sessões do Claude Code em
   paralelo, MetaTrader5 consumindo 72% de CPU) — não foi resolvida, só
   descartada como causa direta do rate-limit de hoje.
4. Considerar registrar no `MT5_REASONING_VALIDATOR_MODEL` do `.env`
   (ainda aponta pra `qwen35-trading`) se o validador algum dia for
   reativado (`MT5_REASONING_VALIDATOR_ENABLED=false` hoje, então sem
   efeito prático agora).
