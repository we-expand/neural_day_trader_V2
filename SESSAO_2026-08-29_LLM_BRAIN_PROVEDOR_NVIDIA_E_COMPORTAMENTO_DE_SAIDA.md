# Sessão 2026-08-29 (continuação): LLM Brain — Provedor NVIDIA Corrigido & Comportamento de Saída

## ⚠️ AÇÃO IMEDIATA PENDENTE — LER PRIMEIRO

**Existe um commit pendente que NUNCA foi feito.** `llm-active-brain/src/config.ts`
tem a correção do modelo NVIDIA (`nvidia/nemotron-3-nano-30b-a3b`) só
**local, não commitada** — uma tentativa anterior de commit falhou por rodar
`git add` de dentro da pasta `llm-active-brain/` (caminho relativo duplicado,
erro silencioso ignorado). Antes de qualquer outra coisa:

```bash
cd ~/Projects/we-expand/Neural-Day-Trader
git status --short llm-active-brain/
# deve mostrar: M llm-active-brain/src/config.ts
git add llm-active-brain/src/config.ts
git commit -m "fix(llm-brain): usar nvidia/nemotron-3-nano-30b-a3b, nao gpt-oss-120b

- NEXUS funciona normal com a NVIDIA -- o problema nao era a API deles
  fora do ar, era o modelo especifico (openai/gpt-oss-120b trava o
  endpoint deles, testado 2x, HTTP 000 apos 25-60s sem resposta)
- Trocado pro mesmo modelo do NEXUS (nvidia/nemotron-3-nano-30b-a3b),
  testado direto: HTTP 200, ~0.7s, tool-calling confirmado funcionando
- Type-check: ZERO erros

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
git push origin dev
```

**Todos os outros commits desta sessão já foram feitos e pushados** — ver
lista completa na seção "Commits desta sessão" abaixo. Só esse ficou pra
trás.

## Estado exato de onde continuar

- **Branch**: `dev`, tudo pushado exceto o `config.ts` acima.
- **`.env` local** (`llm-active-brain/.env`, não versionado):
  `LLM_PROVIDER=nvidia`, sem `LLM_MODEL` override (usa o default do
  `config.ts` — depois do commit pendente acima, isso já é
  `nvidia/nemotron-3-nano-30b-a3b`). `MAX_ITERATIONS=30`, `MAX_CYCLES=8000`.
- **Sessão ativa no Supabase** (`ai_sessions`, `strategy_name='LLM_ACTIVE_BRAIN_MT5'`):
  id `6220f3b4-d700-4052-bfea-348cea1accf4`, criada 2026-08-29 02:49:43 UTC,
  `initial_balance=50`. No momento em que este arquivo foi escrito: **23
  posições OPEN, 3 CLOSED, PnL realizado ≈ -$0.07** — mas isso é do processo
  ANTIGO ainda rodando com o código de ANTES do fix de comportamento de saída
  (ver abaixo). Depois de reiniciar com o código novo, o número de posições
  abertas deve parar de crescer sem controle.
- **Próximo passo real**: depois do commit pendente, matar o processo atual
  (Ctrl+C no terminal) e rodar `npm run start` de novo pra pegar TODOS os
  fixes desta sessão de uma vez (modelo NVIDIA + teto de posição + regra de
  saída + log limpo).

## O que foi feito nesta sessão (em ordem cronológica)

### 1. Saga de provedor de LLM — 5 tentativas até achar a causa raiz real

Contexto: sessão anterior já tinha corrigido contract sizing (lotes reais),
cesta só-moedas, vazamento de token Harmony do `gpt-oss`, e gate de horário
de mercado forex (ver `SESSAO_2026-08-29_LLM_BRAIN_CONTRATO_CORRIGIDO_E_MULTI_ATIVO.md`
pro detalhe desses 4 fixes). O problema desta sessão foi **manter o motor
rodando de verdade** sem bater cota:

1. **Groq com `gpt-oss-120b`**: cota diária esgotada rápido demais pro modo
   contínuo (8000 ciclos).
2. **Groq com `gpt-oss-20b`** (modelo menor, cota maior): funcionou por um
   tempo, mas também bateu cota diária de novo (esperas de 743s → 1556s).
3. **NVIDIA com `openai/gpt-oss-120b`**: **diagnóstico errado inicial** —
   testei `POST /v1/chat/completions` direto via `curl` e travou (HTTP 000,
   sem resposta, 25-60s de timeout) 2 vezes seguidas. Concluí (errado) que a
   API da NVIDIA estava fora do ar.
4. **Cerebras** (`cloud.sambanova.ai`... não, `cloud.cerebras.ai`): pede
   cartão de crédito mesmo no tier gratuito. Abandonado (Cleber não quis
   cadastrar cartão).
5. **Gemini** (Google AI Studio): conta Google do Cleber está bloqueada.
   Abandonado.
6. **SambaNova Cloud**: também retornou `PAYMENT_METHOD_REQUIRED` (HTTP
   402) na primeira chamada real, apesar de "historicamente sem cartão" —
   política deles mudou. Abandonado.
7. **Voltou pro Groq `gpt-oss-20b`** como fallback aceito (retry automático
   já tratava rate limit, só mais lento que o ideal).

**Achado real (Cleber apontou)**: *"o NEXUS funciona normal com a NVIDIA"*.
Investigado `supabase/functions/nexus-brain/lib/llmClient.ts` — o NEXUS usa
`nvidia/nemotron-3-nano-30b-a3b`, **não** `openai/gpt-oss-120b`. Testado
esse modelo específico direto via `curl`: `HTTP 200 em 0.67s`, e com
tool-calling: `HTTP 200 em 0.76s`, `tool_calls` retornado corretamente.
**O problema nunca foi a API da NVIDIA fora do ar — era o modelo
`gpt-oss-120b` especificamente que trava o endpoint deles.**

Fix (`config.ts`, `agent.ts` — `agent.ts` já commitado, `config.ts`
pendente, ver topo deste arquivo):
- Modelo trocado pra `nvidia/nemotron-3-nano-30b-a3b`
- `chat_template_kwargs: { enable_thinking: false }` adicionado quando
  `provider === "nvidia"` (mesmo ajuste que o NEXUS usa — família Nemotron 3
  gera "thinking" interno por padrão, adicionando latência desnecessária
  pra tool-calling em ciclo)
- Suporte a `cerebras`, `gemini`, `sambanova` como provedores alternativos
  ficou no código (`LlmProvider` type, `LLM_PROVIDER_DEFAULTS`) mesmo não
  tendo sido usado — trocável via `.env` se algum dia fizer sentido
  reabrir alguma dessas opções.

### 2. Dashboard "travado" — falso alarme, era a aba do navegador

Cleber reportou patrimônio/PnL "parados". Investigação:
- Código do painel (`LlmActiveBrainPanel.tsx`) revisado — lógica de polling
  (5s preço, 5s trades, sempre busca a sessão mais recente por
  `strategy_name`) está correta, sem bug.
- Testei ao vivo via browser tool: abri o Dashboard de verdade, patrimônio
  mudou de $47.36 → $48.59 em 10 segundos, com contagem de posições
  aumentando (agente abrindo de verdade). **Painel funcionando normal.**
- Causa real: aba antiga do Cleber estava numa **URL de deployment com
  hash** (`neural-day-trader-v2-zbipi04pn-...`), que fica **congelada pra
  sempre** no build daquele momento — mesmo problema já documentado no
  `CLAUDE.md` ("Ambientes e branches"). Resolvido reabrindo na URL de alias
  de branch (`neural-day-trader-v2-git-dev-cleber-coutos-projects.vercel.app`).
- **Nenhuma mudança de código foi necessária pra isso.**

### 3. Reset da sessão pra $50 zerada

A pedido do Cleber ("comece o painel de novo do zero, $50, feche o que tiver
aberto"): fechei 6 posições abertas na sessão antiga (`51452614-...`) com
preço real de mercado (cripto) ou preço congelado idêntico à entrada (forex
fechado, PnL zero) via SQL direto no Supabase (`exit_reason='MANUAL'`, sem
apagar nada, só `UPDATE` de fechamento — trigger de auditoria do banco
capturou automaticamente). Criei sessão nova `6220f3b4-...`, `$50`,
`PAUSED`, zero trades. Dashboard e agente pegam essa sessão sozinhos (buscam
sempre a mais recente por `strategy_name`).

### 4. Achado grave: o agente NUNCA fechava posição — só empilhava duplicadas

Analisando o log real do terminal (14 ciclos completos), Cleber notou:
*"a impressão que me causa é que tem alguma coisa errada"*. Confirmado:

- Até o ciclo 14, **26 posições abertas**, quase todas `SHORT` nos MESMOS 3
  símbolos cripto (BTCUSD, XETUSD, SOLUSD)
- Várias com **preço de entrada idêntico** (`77658.82` repetido 8 vezes só
  em BTCUSD)
- **Zero chamadas de `close_position`** em todo o log
- `log_thought` do agente, ciclo após ciclo, concluindo algo como *"não há
  alvo definido, então não fecho"* — e abrindo mais uma posição quase igual

Causa raiz: o prompt nunca dava um alvo de saída concreto, só dizia "feche
se bater alvo ou invalidar a tese" sem definir o que é alvo. Modelo pequeno
(Nemotron Nano, otimizado pra velocidade) girava em roda.

Fix:
- **`tools.ts`**: `MAX_POSITIONS_PER_SYMBOL = 3` em `open_position` — acima
  disso, recusa abrir e pede pra fechar antes
- **`agent.ts`**: seção nova no prompt, "REGRA DE SAÍDA OBRIGATÓRIA" — exige
  alvo concreto de ~0,3-0,5% a favor ou contra desde a entrada, proíbe
  explicitamente o padrão "sem alvo definido, não fecho"
- **`index.ts`**: removido o log `[resumo ciclo X] ETH testnet: ... | USD
  ficticio: $20.36` em modo MT5 — resíduo do trilho Binance/economia
  simulada antigo (não tocado desde que o MT5 assumiu), sempre com o MESMO
  valor porque nada mais escreve nele. Isso causava a impressão de "o robô
  está sempre com o mesmo valor" que o Cleber reportou (o valor real do
  patrimônio MT5 nunca esteve nesse log — está só no Supabase/Dashboard).

## Commits desta sessão

Todos em `dev`, todos já `push`ados, **exceto o primeiro item** (ver ação
imediata pendente no topo):

```
[PENDENTE] fix(llm-brain): usar nvidia/nemotron-3-nano-30b-a3b, nao gpt-oss-120b
f702f42a2 fix(llm-brain): agente nunca fechava posicao, so empilhava duplicadas
1ca134dcf feat(llm-brain): suporte a SambaNova (Gemini bloqueado por conta Google)
357f2db44 fix(llm-brain): bloquear abertura de posicao forex com mercado fechado
e3ad6d931 fix(llm-brain): sanitizar nome de tool vazado ANTES de guardar no historico
7b473eb0d fix(llm-brain): moedas apenas — forex + cripto (sem ouro/índices)
95a19eb35 fix(llm-brain): contract sizing em lotes reais, não USD fixo
```

(Há também um commit `feat(llm-brain): suporte a Gemini` e outro de
`assetBasket.ts`/`agent.ts` de multi-ativo entre esses — ver `git log
llm-active-brain/` completo se precisar da ordem exata.)

## Pendências reais pra próxima sessão

1. **[CRÍTICO] Commit pendente do `config.ts`** — ver topo deste arquivo.
2. **Reiniciar o agente** depois do commit, pra rodar com TODOS os fixes de
   uma vez (modelo NVIDIA correto + teto de posição + regra de saída).
3. **Observar os primeiros ciclos pós-restart**: confirmar que
   `close_position` está sendo chamado de verdade agora (o log deve mostrar
   isso, diferente do padrão anterior de só abrir).
4. **Decidir o que fazer com a sessão atual** (`6220f3b4-...`, 23 posições
   OPEN acumuladas pelo comportamento antigo) — resetar de novo pra $50
   zerada (mesmo processo de SQL documentado na seção 3 acima) ou deixar o
   agente novo ir fechando essas posições órfãs sozinho ao longo dos
   próximos ciclos (ele vai ver essas 23 em `list_open_positions` e, com a
   regra de saída nova, deve começar a fechar as que baterem o alvo).
5. **Sem dado ainda sobre performance real** — a sessão inteira foi
   troubleshooting de infraestrutura (provedor de LLM, bug de fechamento),
   não geração de amostra pra avaliar a estratégia em si. Isso só começa a
   fazer sentido depois que os fixes acima estiverem rodando establizados
   por um tempo.
