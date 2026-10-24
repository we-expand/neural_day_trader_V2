# Sessão 2026-08-25 — NEXUS: assistente de day trade com LLM real

## 0. Contexto e pedido original

O Cleber pediu um agente "totalmente inteligente" pra auxiliar o usuário no
day trade — um parceiro real, tipo J.A.R.V.I.S. (Homem de Ferro), focado em
um ativo escolhido pelo usuário, que aglutine tudo que a plataforma já sabe
(preço, indicadores, notícia, agenda econômica, gerenciamento de risco) numa
interação por voz humanizada e interativa, com visual 3D/futurista. A visão
completa (texto literal do Cleber):

> "A ideia é ter um agente totalmente inteligente, que auxilia o usuário no
> diário. O usuário escolhe um ativo pra poder fazer esse tipo de parceria,
> e a tecnologia auxilia não só com notícias pertinentes ao ativo, pressão
> de mercado, volatilidade, enfim, todas as informações que um trader
> precisa pra poder operar. A segurança e o gerenciamento de risco também é
> informado. [...] Um J.A.R.V.I.S do homem de ferro focado em Day Trade."

Escopo confirmado pelo Cleber via perguntas de esclarecimento:
- **LLM real** gerando fala/resposta (não template determinístico).
- **Notícia gratuita por enquanto** — API paga fica pra depois.
- **Alerta proativo rodando 24/7 no servidor** (`ai-runner`), não só quando
  a tela está aberta.
- **Layout 3D/futurista**, "tecnologia em 3D".

## 1. Auditoria prévia — o que já existia

Antes de desenhar o NEXUS, uma auditoria da tela "AI Trader Voice" existente
(`src/app/components/modules/AITraderVoice.tsx`) mostrou:
- Preço/candle real (Binance), RSI/MACD/ATR/Bollinger reais — sem fabricação.
- Stop/TP calculados por múltiplo de ATR — heurística nunca validada
  estatisticamente (mesma conclusão histórica do `AI_BRAIN_SPEC.md`: sem
  edge de sinal comprovado).
- A "voz" não usava LLM nenhum — era `window.speechSynthesis` (TTS nativo)
  lendo templates com `Math.random()` só pra variar frase/saudação.
- Símbolo **hardcoded em `'BTC'`** — nunca seguia o ativo real selecionado
  pelo usuário.
- Não existia nenhuma chamada de LLM (Anthropic/OpenAI/outro) em lugar
  nenhum do repositório.

## 2. Colisão de nomes — decisões tomadas com o Cleber

Duas colisões de nome apareceram durante o planejamento e foram resolvidas
em conversa direta com o Cleber (não assumidas por mim):

1. **"Jarvis" já existia** como motor interno de auto-tuning/guardrails
   (`supabase/functions/jarvis/`, cron 6h, tabelas `jarvis_*`) — mas
   **invisível ao usuário comum**, só o Cleber via (confirmado por ele:
   "está focado no motor e é escondido do usuário comum. Só eu tenho
   visualização"). Decisão: o assistente novo não se chama Jarvis, pra não
   colidir — nasceu o nome **NEXUS**.
2. **Achado no meio da implementação, não previsto no plano inicial**: já
   existia um "Jarvis" **visível** na Sidebar (admin-only), com
   `JarvisDashboard.tsx` + `JarvisOrb.tsx` (3D real via
   `react-three-fiber`/`@react-three/drei`, já instalado no projeto) +
   `useJarvisVoice.ts` — um painel pro Cleber aprovar/rejeitar decisões do
   motor de auto-tuning por voz, com um orbe 3D reagindo a
   idle/listening/thinking/speaking. Não colide com o NEXUS (público
   diferente — admin vs. todo usuário) e foi mantido como está.
3. **Nome "Nexus" já usado** em `NexusQuantumAdvisor.tsx` (card do Dashboard
   que hospedava as configurações da Luna). Decisão do Cleber: **deletar
   Luna e o Nexus antigo, recomeçar do zero** — sem manter os dois em
   paralelo.

## 3. O que foi deletado (Fase 0)

Luna (assistente de voz antigo) e o Nexus antigo, sem substituto paralelo:
- `src/app/components/NeuralAssistant.tsx`
- `src/app/components/FloatingAssistantButton.tsx`
- `src/app/components/nexus/LunaInteractionSettings.tsx`
- `src/app/components/nexus/NexusQuantumAdvisor.tsx`
- `src/app/hooks/useVoiceChat.tsx` (só usado pela Luna, chamava o endpoint
  `/assistant/chat`)
- `src/app/services/BreakoutAlertManager.ts` (métodos `enableLunaProactive`
  etc., nenhum outro consumidor)
- `supabase/functions/server/neural-assistant.ts` e o endpoint
  `POST /assistant/chat` em `supabase/functions/server/index.ts`
- Referências em `src/app/App.tsx`, `src/app/App_BACKUP_COMPLETE.tsx`,
  `src/app/components/dashboard/MarketScoreBoard.tsx`,
  `src/app/components/quantum/VoiceConfigPanel.tsx` (frase de teste de voz
  rebatizada de "Luna" pra "NEXUS")

Confirmado depois da limpeza: type-check reduziu de **581 para 570 erros
pré-existentes** (nenhum erro novo introduzido — a diferença é só os erros
que existiam nos arquivos deletados).

## 4. O que foi construído (Fase 1 — fundação)

### 4.1 `supabase/functions/nexus-brain/` — primeira chamada de LLM real do projeto

- `index.ts` — recebe um `contextPackage` (JSON estruturado, sempre montado
  a partir de dado real) e opcionalmente uma `question` do usuário. Dois
  modos de autenticação: JWT do próprio usuário (chamada do browser) ou
  header `x-nexus-secret` + `userId` explícito (chamada servidor-a-servidor,
  usada pelo `ai-runner`).
- `lib/systemPrompt.ts` — persona do NEXUS. A regra mais importante do
  prompt: **proibição explícita de inventar dado** — o modelo só pode falar
  sobre o que estiver no `contextPackage`, nunca estima número pra "parecer
  útil". Também deixa explícito que o produto não tem edge de sinal técnico
  comprovado (consistente com `AI_BRAIN_SPEC.md`) — o papel do NEXUS é
  contexto/risco/disciplina, nunca previsão de direção de preço.
- `lib/llmClient.ts` — abstrai o provedor de LLM atrás de uma função
  `callLLM()`. Suporta **Groq** (free tier, modelo `llama-3.3-70b-versatile`,
  API compatível com OpenAI) e **Anthropic** (`claude-sonnet-4-5`), escolhido
  pela secret `LLM_PROVIDER` (default `'groq'` se a secret não existir).
  Decisão do Cleber: começar de graça com Groq pra validar o produto de pé,
  trocar pra Anthropic depois só mudando a secret — **sem novo deploy de
  código** nessa troca futura.
- `lib/serviceClient.ts` — client Supabase service-role, mesmo padrão do
  `jarvis/lib/serviceClient.ts` e `ai-runner/lib/serviceClient.ts`.
- Toda interação (pergunta + resposta) é gravada em `nexus_interactions`
  pra auditoria — nunca editada, só inserida.

### 4.2 `src/app/components/nexus/NexusVoiceAssistant.tsx` — substitui o AITraderVoice.tsx

- Segue o ativo real: `TradingContext.dashboardActiveSymbol` (corrige o bug
  do `'BTC'` hardcoded).
- Monta o `contextPackage` 100% real antes de cada pergunta/narração:
  preço/candle (`BacktestDataService`), indicadores técnicos
  (`advancedTradeAnalysis.generateAdvancedAnalysis`), posição aberta real do
  usuário (`ai_trades` filtrado por `status='OPEN'`), agenda econômica
  relevante à moeda do ativo (`getRelevantCurrencies` +
  `/economic-calendar`), notícia real recente (`/news/aggregate`, RSS
  agregado já existente no servidor), e os alertas proativos recentes já
  gravados em `nexus_alerts`.
- Chat por texto ou voz (STT via Web Speech API nativa, mesmo padrão já
  usado em `VoiceAssistant.tsx`), resposta falada via `useSpeechAlert`
  (TTS nativo, mantido por ora — trocar por voz mais humana tipo ElevenLabs
  fica pra depois, ponto de troca isolado nesse hook).
- Visual: reaproveita o `JarvisOrb.tsx` já existente (3D real,
  react-three-fiber) — muda de cor/velocidade conforme
  idle/listening/thinking/speaking, e conforme severidade dos alertas.
- Mutex de voz (`VoiceCoordinatorContext`) atualizado: `'ai-trader-voice'`
  virou `'nexus'` no tipo `VoiceOwner`.
- Usado em dois lugares: rota standalone (`App.tsx`, view `'ai-voice'`) e
  embutido dentro do AI Trader (`AITrader.tsx`, `embedded={true}`).

### 4.3 `src/app/components/nexus/NexusAssistant.tsx`

Card compacto do Dashboard ("Análise por Fonte") que ocupava o lugar do
`NexusQuantumAdvisor.tsx` deletado — continua mostrando o
`MarketScoreResult` real (mesmo motor do Dashboard), sem as configurações de
voz da Luna.

## 5. O que foi construído (Fase 2 — alerta proativo 24/7)

- `nexusAlertTick()` em `supabase/functions/ai-runner/index.ts`, chamado uma
  vez por invocação do `runSession` (antes do loop de tick de
  posição/trading).
- Verifica, por ativo ativo da sessão: eventos de calendário econômico de
  alto impacto na próxima hora (reaproveitando `s.cachedNewsEvents`, mesmo
  dado já carregado pelo gate de notícia do motor — nunca busca por conta
  própria) e eventos recentes de `price_guard_events`
  (`suspicious_deviation`) pro símbolo.
- Só chama o LLM quando há algo real e relevante — sem gasto de chamada
  quando não há nada a avisar.
- **Throttle via banco, não memória**: cada invocação da function roda só
  ~45s (`MAX_RUNTIME_MS`), muito menor que o intervalo desejado de 15min
  entre alertas — um contador em memória seria reiniciado a cada chamada do
  cron (~1x/min) e nunca seguraria o throttle de verdade. A checagem real é
  "já existe alerta pra esse usuário/símbolo nos últimos 15min?" direto na
  tabela `nexus_alerts`.
- Entrega nesta fase é **só in-app** (grava em `nexus_alerts`, cliente
  mostra/fala quando a tela é aberta) — **não** notifica com o app fechado
  (isso exigiria Web Push/VAPID/service worker, infra que não existe hoje no
  projeto, documentado como fast-follow, não construído nesta sessão).

## 6. Migration pendente de aplicar

`supabase/migrations/20260824_nexus_schema.sql` — cria:
- `nexus_interactions` (auditoria de toda pergunta/resposta do LLM)
- `nexus_alerts` (alertas proativos do tick do servidor)

Ambas com RLS habilitado (usuário só lê o próprio dado; `service_role` tem
acesso total).

## 7. Deploy e configuração — o que já foi feito nesta sessão

- ✅ Secrets configurados pelo Cleber: `GROQ_API_KEY`, `NEXUS_SHARED_SECRET`.
- ✅ Deploy do `ai-runner --no-verify-jwt` confirmado (log completo visto,
  sucesso).
- ⚠️ Deploy do `nexus-brain --no-verify-jwt` — **não confirmado ainda**. O
  primeiro teste via `curl` retornou erro vindo da API da **Anthropic**
  ("API key is invalid"), o que indica que a versão em produção do
  `nexus-brain` ainda é a **primeira versão do código** (antes da troca pra
  Groq via `llmClient.ts`) — o Cleber nunca chegou a rodar o deploy depois
  da criação do arquivo, só o do `ai-runner`. Suspeita adicional: a
  `ANTHROPIC_API_KEY` pode ter sido setada com o texto placeholder de
  exemplo (`sk-ant-sua-chave-aqui`) passado num comando anterior, em vez de
  uma chave real — o que também explicaria "invalid" em vez de "ausente".
  **Ação pendente**: rodar `supabase functions deploy nexus-brain
  --no-verify-jwt` de novo e testar o `curl` mais uma vez.
- ⬜ Migration `20260824_nexus_schema.sql` — não confirmada como aplicada.
- ⬜ Teste na tela (ativar o NEXUS no app e confirmar narração/chat
  funcionando).

## 8. Comando de teste (curl direto contra o Supabase)

```bash
curl -X POST "https://wyvdsxtcmizettljxtbg.supabase.co/functions/v1/nexus-brain" \
  -H "content-type: application/json" \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN_AQUI" \
  -d '{"question":"como está o mercado agora?","contextPackage":{"symbol":"UKOUSD","priceReal":68000,"indicadoresTecnicos":{"rsi":55}}}'
```

Token pego em DevTools → Aplicativo → Armazenamento local → chave
`sb-wyvdsxtcmizettljxtbg-auth-token` → campo `access_token` dentro do JSON.

## 9. Comandos de deploy/configuração (referência completa)

```bash
# Secrets (Groq primeiro, gratuito)
supabase secrets set GROQ_API_KEY=sua_chave_groq
supabase secrets set NEXUS_SHARED_SECRET=$(openssl rand -hex 32)

# Trocar pra Anthropic no futuro (sem novo deploy de código):
supabase secrets set ANTHROPIC_API_KEY=sk-ant-sua-chave-real
supabase secrets set LLM_PROVIDER=anthropic

# Migration
supabase db push
# (ou colar supabase/migrations/20260824_nexus_schema.sql no SQL Editor)

# Deploy das functions
supabase functions deploy nexus-brain --no-verify-jwt
supabase functions deploy ai-runner --no-verify-jwt
```

## 10. Commit — pendente do Cleber rodar

Código pronto na branch `dev`, não commitado ainda nesta sessão. Comandos
completos (`git add` com lista explícita de arquivos do NEXUS, sem misturar
com outros arquivos não relacionados que apareceram no `git status` —
`research/experiments/...`, `research/jarvis-schema.sql`,
`supabase/.temp/*`) foram entregues ao Cleber no chat, não executados por
mim (regra fixa do projeto).

## 11. O que ainda falta pra considerar o NEXUS pronto

1. Confirmar deploy do `nexus-brain` com o código atual (Groq) e teste via
   `curl` retornando `{"text": "..."}` de verdade.
2. Aplicar a migration `20260824_nexus_schema.sql`.
3. Testar na tela: selecionar ativo no Dashboard, abrir o NEXUS, clicar em
   "Ativar NEXUS", confirmar narração falada + chat funcionando.
4. Commit + push (comandos já entregues, aguardando o Cleber rodar).
5. Deixar `nexusAlertTick` rodar por um tempo em produção e conferir se
   `nexus_alerts` está recebendo linhas de verdade (mesma disciplina de
   verificação usada pro Jarvis em 23-24/08 — nunca considerar pronto só por
   `deno check`/`npm run validate` passar, sempre confirmar com dado real).

## 12. Fast-follow — explicitamente fora desta entrega

- **Push real fora do app** (celular vibra com o app fechado): precisa de
  Web Push + VAPID keys + service worker novo, ou canal externo (email/
  WhatsApp/SMS). Nenhuma dessas infras existe hoje no projeto.
- **Notícia via API paga** (Finnhub/Alpha Vantage com sentimento pronto) —
  confirmado pelo Cleber como "mais pra frente".
- **TTS mais humano** (ElevenLabs) — troca isolada dentro de
  `useSpeechAlert.tsx`.
- **Cena 3D dedicada maior** (ex. tela cheia com orbe grande) — hoje o
  `JarvisOrb` é reaproveitado num espaço pequeno (header da tela); se o
  Cleber quiser um visual 3D mais imersivo, é iteração futura sobre o mesmo
  componente.
