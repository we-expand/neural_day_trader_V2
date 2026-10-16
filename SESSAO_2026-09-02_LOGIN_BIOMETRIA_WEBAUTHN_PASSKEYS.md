# Sessão 2026-09-02 (noite) — Login por Biometria Real (WebAuthn/Passkeys)

## Pedido do Cleber

"Precisamos criar um modelo de segurança avançada que permite que o usuário
possa entrar com a sua digital. Esse sistema tem que funcionar de forma
real. A nossa segurança tem que ser impecável." Perguntado sobre escopo
(login web vs app nativo vs confirmação de ação sensível) e sobre
tecnologia — respondeu "o que existir de forma mais avançada", confirmando
WebAuthn/Passkeys (FIDO2) como abordagem.

## Por que WebAuthn/Passkeys, não "captura de digital"

Não existe (e não pode existir com segurança) forma de um servidor web
capturar/verificar impressão digital diretamente — isso violaria a garantia
de segurança que sensores biométricos de dispositivo oferecem. O padrão
real usado por bancos e Big Tech (Apple/Google/Microsoft) é **WebAuthn/
Passkeys (FIDO2)**: o sensor biométrico do próprio dispositivo do usuário
(Face ID/Touch ID/Windows Hello) gera um par de chaves **local** — a chave
privada nunca sai do dispositivo, nunca trafega pra este servidor, nunca é
armazenada aqui. O servidor só guarda a chave **pública** e verifica
assinaturas criptográficas. Rejeitada de propósito qualquer alternativa que
prometesse "capturar a digital de verdade" — seria menos seguro, não mais,
e teria sido dado fabricado disfarçado de real (disciplina do projeto).

## O que foi implementado

**Migration** (`supabase/migrations/20260902_add_webauthn_passkeys.sql`):
- `webauthn_credentials` — uma linha por passkey registrada (usuário pode
  ter várias: notebook + celular), guarda `credential_id`, `public_key`
  (base64), `counter` (anti-replay), `device_type`, `backed_up`,
  `transports`, `device_name`. RLS: usuário só lê/apaga a própria; INSERT/
  UPDATE só via service role (Edge Function), nunca direto do client.
- `webauthn_challenges` — desafio de uso único por registro/autenticação,
  TTL 5min, `used_at` marcado no consumo (bloqueia replay). Sem policy
  nenhuma pro client — só a Edge Function toca.

**Edge Function** (`supabase/functions/webauthn/index.ts`, service client em
`lib/serviceClient.ts`, mesmo padrão de `nexus-brain`/`ai-runner`/`jarvis`):
usa `@simplewebauthn/server@10` via `npm:` specifier direto no Deno (sem
`deno.json`/import map — função autocontida, não importa nada de `src/app/`).
4 rotas:
- `POST /register-options` (autenticado, JWT do usuário) — gera desafio de
  cadastro, `userVerification: 'required'` (exige biometria/PIN real, não
  só "presença" do token).
- `POST /register-verify` (autenticado) — verifica assinatura, grava
  credencial nova.
- `POST /authenticate-options` (público, body `{email}`) — resposta
  **idêntica** exista ou não o email/credencial (anti-enumeração, mesma
  disciplina de qualquer login real).
- `POST /authenticate-verify` (público) — verifica assinatura contra a
  chave pública salva, incrementa `counter`, e gera uma sessão Supabase
  real via `supabaseAdmin.auth.admin.generateLink({type:'magiclink'})` →
  devolve só o `token_hash` (nunca a service-role key nem senha ao
  browser) — client troca por sessão via `supabase.auth.verifyOtp()`.
- `GET /credentials` / `DELETE /credentials/:id` (autenticado) — listar e
  remover passkeys próprias.

**Frontend**:
- [PasskeySettings.tsx](src/app/components/settings/PasskeySettings.tsx) —
  novo, montado em `Settings.tsx` (aba Geral) — lista passkeys cadastradas,
  botão "Cadastrar biometria neste dispositivo" (`startRegistration` do
  `@simplewebauthn/browser`), remover passkey.
- [AuthOverlay.tsx](src/app/components/auth/AuthOverlay.tsx) — botão
  "Entrar com biometria" no Step 1 (email), visível só em modo login (não
  signup) e com email preenchido — `startAuthentication` → `verifyOtp` →
  `onAuthenticated()`, mesmo callback do login por senha.
- `@simplewebauthn/browser@^10.0.0` adicionado ao `package.json` e
  instalado.

## Achado técnico durante a implementação (corrigido antes de entregar)

`@simplewebauthn/browser`/`server` **v10** tem uma API diferente de
versões mais novas (v11+) que é o que normalmente aparece em exemplos
online: `startRegistration`/`startAuthentication` recebem o objeto de
opções **direto**, não `{ optionsJSON: options }`; e
`verifyRegistrationResponse`/`verifyAuthenticationResponse` devolvem/
recebem campos **soltos** (`credentialID`, `credentialPublicKey`,
`counter`) em vez de agrupados sob `credential: {...}` — e o parâmetro de
entrada da verificação de autenticação chama-se `authenticator`, não
`credential`. Confirmado instalando o pacote real (`npm install
@simplewebauthn/server@10` num diretório scratch) e lendo os `.d.ts`
gerados, não por suposição — `tsc --noEmit` pegou os dois primeiros erros
(`optionsJSON` não existe no tipo), a checagem manual dos `.d.ts` achou o
terceiro (shape de `registrationInfo`/`authenticator`) antes que desse erro
em runtime no Deno (tsc não cobre `supabase/functions/`).

## Estado no fim da sessão

**Todos os comandos rodados pelo Cleber com sucesso** (confirmado por ele:
"Tudo rodado com sucesso"): migration aplicada, secrets
`WEBAUTHN_RP_ID`/`WEBAUTHN_RP_ORIGIN` setadas, function `webauthn`
deployada, commit feito. `tsc --noEmit`: zero erros novos introduzidos
(só o mesmo ruído pré-existente de resolução de `/utils/supabase/info`,
já presente em 5+ outros arquivos do projeto, não é regressão desta
sessão).

**Não testado ao vivo nesta sessão** (dev server da pasta estava ocupado
por outra sessão do Claude Code rodando em paralelo — mesmo risco de
processo duplicado já documentado em sessões anteriores, evitado aqui só
não tentando abrir outro). Fluxo esperado pro Cleber confirmar
visualmente: Configurações → aba Geral → "Cadastrar biometria neste
dispositivo" → confirmar Face ID/Touch ID/Windows Hello → deslogar → tela
de login → digitar o mesmo email → botão "Entrar com biometria" →
confirmar biometria de novo → sessão real criada.

## Pendências / próximos passos reais

1. **Confirmação visual em produção do fluxo completo** (cadastro +
   login) — ainda não observado ao vivo por ninguém nesta sessão.
2. **RP_ID/RP_ORIGIN presos ao domínio atual de preview da branch `dev`**
   (`neural-day-trader-v2-git-dev-cleber-coutos-projects.vercel.app`).
   Se esse alias mudar, ou quando produção (`www.neuraldaytrader.com`)
   sair de manutenção, as secrets `WEBAUTHN_RP_ID`/`WEBAUTHN_RP_ORIGIN`
   precisam ser atualizadas — passkeys cadastradas contra um domínio não
   funcionam em outro (regra do próprio WebAuthn, não é bug).
3. **Escopo não implementado** (fora do que foi pedido nesta sessão, mas
   ficou registrado na pergunta inicial): biometria como segunda
   confirmação antes de ações sensíveis (ex: abrir posição real). Hoje o
   login biométrico só substitui a etapa de senha — nenhuma ação de trading
   pede biometria de novo.
4. Nenhuma validação de UX em dispositivo sem suporte a WebAuthn foi feita
   além do fallback de código (`window.PublicKeyCredential` ausente
   esconde o botão) — não testado em navegador antigo de verdade.
