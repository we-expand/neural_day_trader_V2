# Sessão 2026-09-16 — Discurso do Fed: legenda traduzida ao vivo

## Pedido do Cleber

Hoje teria discurso do Fed após a decisão de juros. Pedido: transmitir na
plataforma de forma traduzida e dublada, toda vez que houver discurso do
Fed. Cleber lembrava que "talvez já exista" — pediu pra investigar a fundo
antes de qualquer coisa, e avaliar se dava tempo real de acionar meia hora
antes do início.

## O que existia antes desta sessão

Achado real via grep no repo: `src/app/components/dashboard/NeuralEventCenter.tsx`
("Macro Event Center") — parecia exatamente a feature pedida (dublagem
neural, tradução em tempo real PT-BR/EN-US/CN, seletor Fed/Casa Branca,
botão de "Simulcast" pro YouTube), mas era **100% maquete**:

- "Vídeo ao vivo" = iframe do YouTube com o ID `dQw4w9WgXcQ` — literalmente
  o Rick Roll, hardcoded, sem nenhuma ligação com o Fed.
- "Transcrição ao vivo" = array fixo de 5 frases (`TRANSCRIPTS`), tocado em
  loop a cada 4s via `setInterval` — zero reconhecimento de fala real.
- "Dublagem neural" = barras de áudio com `Math.random()` — não gerava
  áudio nenhum.
- Botão "Iniciar Simulcast" só trocava um `useState` local, sem conectar a
  nada.
- **O componente não era importado em nenhum lugar do app** — código morto,
  nem acessível pela UI.

Conclusão: nenhuma peça real da pipeline existia (captura de áudio,
speech-to-text, tradução, dublagem, distribuição).

## Decisão de escopo (pergunta feita ao Cleber)

Dado o prazo curto (discurso ainda hoje) e a inexistência de qualquer
pipeline real de dublagem por voz — que exigiria STT+tradução+TTS em tempo
real, latência controlada, e não dá pra construir/testar do zero em menos
de uma hora — perguntei como priorizar. **Cleber escolheu: legendas
traduzidas ao vivo (texto), sem dublagem por voz nesta rodada.**

## Investigação técnica (fontes reais, confirmadas ao vivo)

1. **Vídeo oficial do Fed**: `federalreserve.gov/live-broadcast.htm` usa
   player **Brightcove** — confirmado inspecionando o DOM real da página
   (`data-account="66043936001"`, `data-video-id="6376885161112"`).
2. **Legenda oficial em inglês**: a Brightcove Playback API
   (`edge.api.brightcove.com/playback/v1/accounts/66043936001/videos/6376885161112`,
   policy key pública extraída do player) devolve
   `custom_fields.transcriptlinkurl = "https://www.streamtext.net/player?event=CFI-FRB"`.
   **StreamText.net** é serviço de legenda ao vivo por **estenógrafo humano
   (CART)** — não é ASR/reconhecimento de fala — é a legenda oficial que o
   próprio Fed usa. Muito mais confiável que transcrever o áudio por conta
   própria.
3. **Endpoint de polling real**: inspecionando o Network tab do player do
   StreamText ao vivo, achei `text-data.ashx?event=CFI-FRB&last=<cursor>`
   — sem documentação pública, mas confirmado funcionando (devolvia 404
   porque o evento ainda não tinha começado no momento do teste, o que é o
   comportamento esperado antes do horário).
4. Tradução reaproveita o mesmo LLM já configurado pro NEXUS (`LLM_PROVIDER`,
   NVIDIA/Groq/Anthropic) — nenhuma secret nova necessária.

**Risco assumido e documentado no código**: o formato exato do JSON de
resposta de `text-data.ashx` só pôde ser confirmado com o evento
REALMENTE ao vivo (antes disso o endpoint só devolve 404). O parser foi
escrito de forma defensiva (tenta os formatos mais comuns: `{Data,Position}`/
`{data,position}`/texto cru), mas **não foi validado contra uma resposta
real ainda** — instrução deixada no próprio arquivo pra testar assim que a
transmissão começar, antes de confiar cegamente no texto capturado.

## Implementação

1. **`supabase/functions/fomc-captions/index.ts`** (novo) — Edge Function:
   - Consulta a legenda real do Fed (StreamText, evento `CFI-FRB`).
   - Traduz pro PT-BR reaproveitando o LLM do NEXUS.
   - Nunca fabrica tradução — se o LLM falhar, devolve vazio (mostra só o
     texto original em inglês no frontend).
   - CORS aberto (dado público, sem informação sensível).
2. **`NeuralEventCenter.tsx`** reescrito por completo:
   - Vídeo real via iframe público do Brightcove (mesmo vídeo do site do
     Fed).
   - Legenda real traduzida por polling a cada 3s na function nova.
   - Dublagem por voz **removida honestamente** da UI — vira um aviso
     "ainda não implementada nesta versão", em vez de fingir que funciona
     (o mock anterior fingia).
3. **Botão "Fed ao vivo"** adicionado no `Header.tsx` — o componente estava
   órfão (não importado em lugar nenhum), agora é acessível de qualquer
   tela via `App.tsx` (`showFedEventCenter` state).

`tsc --noEmit`: 632 linhas de erro vs 631 antes (1 linha nova, mesmo padrão
de ruído pré-existente do alias `/utils/supabase/info`, já presente em
`MarketDataDebug.tsx` — nenhum erro novo de verdade). `deno check` limpo na
function nova.

## Deploy

Comandos entregues ao Cleber (regra fixa do projeto: nunca faço commit/push/
deploy sozinho):

```bash
supabase functions deploy fomc-captions --no-verify-jwt
git add supabase/functions/fomc-captions src/app/App.tsx src/app/components/dashboard/NeuralEventCenter.tsx src/app/components/layout/Header.tsx
git commit -m "feat(fomc): legenda traduzida ao vivo do discurso do Fed (vídeo+CART reais, sem dublagem ainda)"
git push origin dev
```

Commit real: `07206d448`.

## "Commit não subiu pro Vercel" — investigado, falso alarme

Cleber reportou que o commit não tinha subido. Investigação:

- `git log origin/dev` confirmou o push chegou normal no GitHub.
- `vercel ls` (CLI, autenticado como `we-expand`) mostrou um deployment
  "Building" criado ~1min antes da checagem, que terminou em `Ready` pouco
  depois — alias `neural-day-trader-v2-git-dev-cleber-coutos-projects.vercel.app`
  (o alias de `dev`) já apontava pra ele.
- `curl` direto na URL do alias devolvia uma tela de **login da própria
  Vercel** (`vercel.com/sso-api`, HTTP 302→307) — o projeto tem
  **Deployment Protection (SSO)** ativado, então acesso sem sessão
  autenticada da Vercel é redirecionado pra login. Isso **não é falha de
  deploy**, é proteção normal do projeto — só afeta checagem por `curl`
  sem cookie de sessão, não afeta o Cleber logado no navegador.
- Confirmação definitiva via GitHub API
  (`gh api repos/we-expand/neural_day_trader_V2/commits/07206d448/status`):
  check "Vercel" = `success`, "Deployment has completed", apontando pro
  deployment `dpl_5kUfL8dyMgnn9ovmchos2VsJCkfc` — o mesmo que a CLI mostrou
  como `Ready`.

**Conclusão real**: o deploy funcionou normalmente. Hipótese mais provável
pro que o Cleber viu: checou bem no minuto em que o build ainda estava em
andamento (build levou pouco mais de 1 min), ou bateu na mesma tela de
SSO se testou fora de uma sessão autenticada da Vercel. Nenhuma ação de
código foi necessária — nenhum bug real encontrado nesta parte.

**Nota técnica separada, sem relação com o bug**: o MCP da Vercel usado
nesta sessão (`list_projects`/`get_deployment`) devolveu lista vazia e 404
pra esse mesmo projeto — parece autenticado numa conta/token diferente do
que a CLI local usa (CLI autentica como `we-expand` e funciona normal). Não
investigado a fundo, não bloqueou a verificação (resolvida via CLI + API do
GitHub), mas fica registrado caso apareça de novo.

## Pendente real

1. **Confirmar ao vivo, assim que o discurso do Fed começar de verdade**:
   se a legenda em `fomc-captions` está chegando (o parser do
   `text-data.ashx` não foi validado contra uma resposta real ainda — ver
   nota de risco acima). Se o formato não bater, ajustar o parser com uma
   resposta real em mãos.
2. Dublagem por voz continua **fora de escopo** — não implementada nesta
   sessão, por decisão explícita do Cleber dado o prazo. Se quiser retomar,
   o hook `useSpeechAlert.tsx` (já usado em outras partes da plataforma,
   `speechSynthesis` do navegador) é o caminho mais rápido pra uma primeira
   versão — leria a legenda traduzida em voz alta, não é dublagem
   profissional mas é real e reaproveita infraestrutura já existente.
3. `supabase functions deploy fomc-captions --no-verify-jwt` — confirmar que
   o Cleber rodou (comando entregue, deploy da function em si não foi
   verificado nesta sessão, só o deploy do frontend via Vercel).
