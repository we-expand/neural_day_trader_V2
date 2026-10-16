# Sessão 2026-08-25 — NEXUS: troca de provedor de LLM (Groq → NVIDIA Nemotron)

## Contexto

Cleber pediu pra testar/usar a **NVIDIA Nemotron 3 Ultra** no lugar da
**Groq** (não confundir com "Grok" da xAI — são coisas diferentes,
confusão esclarecida no início da sessão) como provedor de LLM do NEXUS
(`supabase/functions/nexus-brain/lib/llmClient.ts`).

## O que foi feito

1. **Adicionado provedor `nvidia`** no `llmClient.ts`, reaproveitando o
   mesmo loop de tool-calling OpenAI-compatible que já existia pro Groq
   (refatorado pra `runOpenAICompatAgent` genérico). Endpoint
   `https://integrate.api.nvidia.com/v1/chat/completions`, autenticação via
   secret `NVIDIA_API_KEY`.
2. **Default de `LLM_PROVIDER` trocado pra `nvidia`** no código — mas
   **isso não bastou**: uma secret `LLM_PROVIDER=groq` já existia no
   Supabase de uma sessão anterior (troubleshooting de chave/modelo da
   Groq) e sobrepunha o default do código. Só passou a usar NVIDIA de fato
   depois de `supabase secrets set LLM_PROVIDER=nvidia` explícito.
3. **Primeira tentativa: Nemotron 3 Ultra** (`nvidia/nemotron-3-ultra-550b-a55b`,
   550B total / 55B ativos). Medido ao vivo em produção: **~28 segundos**
   de ponta a ponta por resposta — inviável pra chat em tempo real. Causa:
   é modelo de raciocínio (gera "thinking" interno por padrão) rodando na
   API padrão da NVIDIA (GPU compartilhada, sem infra dedicada de baixa
   latência tipo a LPU da Groq).
4. **Desligado `enable_thinking`** via `chat_template_kwargs` no corpo da
   requisição (reduz mas não elimina a lentidão da Ultra — o tamanho do
   modelo em si já é o gargalo numa API compartilhada).
5. **Pesquisa comparativa da família Nemotron 3** (Nano/Super/Ultra) —
   resultado: a Ultra é desenhada pra raciocínio profundo/longo, não chat
   interativo. A **Nano** (`nvidia/nemotron-3-nano-30b-a3b`, 30B total / 3B
   ativos) é o membro da família feito especificamente pra
   chat/tool-calling em tempo real: ~94 tokens/s, TTFT ~0,45s, contexto 1M,
   18x menor que a Ultra. A Super (120B/12B ativos) fica como meio-termo
   documentado, trocável por secret se a Nano decepcionar em qualidade.
6. **Trocado `NVIDIA_MODEL_DEFAULT` pra Nano** no código.

## Estado atual (fim da sessão)

- Código com Nano como default **commitado e pronto**, mas **redeploy da
  function ainda pendente** (`supabase functions deploy nexus-brain
  --no-verify-jwt`) — Cleber precisa rodar.
- **Não testado ao vivo com a Nano ainda** — o teste de ~28s foi com a
  Ultra. Precisa repetir o teste (pergunta real no NEXUS) depois do
  redeploy pra confirmar que a latência caiu de verdade.
- Secrets no Supabase, confirmadas setadas nesta sessão:
  `NVIDIA_API_KEY`, `LLM_PROVIDER=nvidia`. `NVIDIA_MODEL` **não foi setada
  como secret** — está usando o default do código (Nano agora). Se quiser
  trocar de modelo sem novo deploy no futuro, usar
  `supabase secrets set NVIDIA_MODEL=<model-id>`.
- Groq e Anthropic seguem disponíveis no código como opção via
  `LLM_PROVIDER`, não removidos.

## Achado colateral (não é bug do produto)

Voz do NEXUS não respondendo era **permissão de microfone bloqueada no
navegador do Cleber**, não relacionado à troca de provedor — resolvido
ao confirmar que nenhum indicador visual de "ouvindo" aparecia (sintoma
característico de mic bloqueado, não de falha de pipeline).

## Próximo passo real

1. Cleber roda o redeploy.
2. Testar pergunta real no NEXUS (texto ou voz) e confirmar latência.
3. Se a Nano ficar rápida mas a qualidade da resposta decepcionar,
   próxima tentativa é a Super via secret `NVIDIA_MODEL`, sem código novo.
