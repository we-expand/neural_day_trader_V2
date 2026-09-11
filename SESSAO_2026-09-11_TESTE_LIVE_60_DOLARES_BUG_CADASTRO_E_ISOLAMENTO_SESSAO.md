# Sessão 2026-09-11 — Preparação para teste real (LIVE) com ~US$60: bug de cadastro corrigido, isolamento de sessão esclarecido, conexão MT5 explicada

## Contexto

Cleber quer fazer um teste com dinheiro de verdade (~US$60) na conta real, com a
IA operando do mesmo jeito que já opera em DEMO. Antes de conectar a corretora
real, ele tentou criar um usuário novo pra separar o teste da conta principal —
e bateu em 3 problemas distintos nesta sessão, cada um investigado e resolvido/
esclarecido separadamente.

## 1. [RESOLVIDO] Cadastro travava em tela branca — bug real de double-submit

**Sintoma**: ao criar conta pela tela de cadastro (landing page, URL de dev),
depois de digitar e-mail e clicar pra avançar, a tela ficava **completamente
em branco** — impossível completar o cadastro.

**Causa raiz real** (`src/app/components/auth/AuthOverlay.tsx`): os botões de
avançar/voltar do fluxo de login/cadastro estão dentro de um `<form>`, mas
não tinham `type="button"` — o `<button>` sem `type` explícito dentro de um
form vira `type="submit"` por padrão. Cada clique disparava **dois** caminhos
ao mesmo tempo: o `onClick={handleNext}` explícito **e** o `onSubmit` nativo
do form (que também chama `handleNext`). Como os dois disparos usam a mesma
closure de `step` (React não re-renderiza entre eles), o `setStep(s => s+1)`
era aplicado duas vezes — saltando do passo 1 (e-mail) direto pro passo 3, que
foi removido há tempos (era o passo de biometria, "STEP 3: BIOMETRICS —
REMOVIDO PERMANENTEMENTE", sem nenhum JSX). Passo 3 inexistente = `<main>`
vazio = tela em branco.

O mesmo padrão também afetava o passo de senha (`submitAuth` chamado 2x) e os
botões "Deletar Conta e Recriar"/"Resolver Conta Travada".

**Fix**: adicionado `type="button"` nos 8 botões do `AuthOverlay.tsx` que não
devem submeter o form (avançar/voltar dos passos 1, 1.5 e 2, botão Cancelar,
toggle "Primeiro Acesso/Já possuo conta", e os 2 botões de recuperação de
conta). `tsc --noEmit`: mesma contagem de erros pré-existentes (570), nenhum
novo introduzido pelo fix.

**Validação**: reproduzido o bug ao vivo (Browser tool), aplicado o fix,
testado de novo local (`npm run dev`, porta 5173) e depois na URL de dev já
deployada — cadastro completo, ponta a ponta, confirmado 2x ("Autenticado!
Entrando na plataforma...", Dashboard virgem com $100 demo, IA desligada,
sem posições).

**Commit**: `30c7d83cb` (`fix(auth): cadastro travava em tela branca — botões
sem type="button" disparavam handleNext 2x`), já commitado e pushado pro
`origin/dev` pelo Cleber — confirmado pegando no deploy.

**Achado de processo, não de código**: no meio do caminho, Cleber testou numa
URL de deployment **com hash** (`neural-day-trader-v2-77i285bjm-...vercel.app`)
depois do fix já commitado — essas URLs ficam congeladas pra sempre (regra já
documentada no `CLAUDE.md`), nunca refletem push novo. Confusão resolvida
apontando pro alias certo:
`https://neural-day-trader-v2-git-dev-cleber-coutos-projects.vercel.app`.

## 2. [ESCLARECIDO — não é bug] Sessão "vazando" entre abas/janelas

**Sintoma relatado**: ao logar com o usuário novo, aparecia o Dashboard do
Cleber (outro usuário); deslogar uma conta deslogava a outra também; e, mais
tarde, o menu "Sistema" (admin-only) aparecia pro usuário novo.

**Investigação**: `supabaseClient.ts` usa `storage: window.localStorage` sem
uma `storageKey` dedicada — comportamento padrão do Supabase Auth.
`localStorage` é compartilhado entre **todas as abas/janelas do mesmo
navegador pro mesmo site**, isso é comportamento do próprio navegador, não
uma escolha do código. Login numa aba sobrescreve a sessão salva; as outras
abas do mesmo contexto escutam `onAuthStateChange` e assumem a sessão nova —
por isso o Dashboard "errado" aparecia, e por isso o `isAdmin` (calculado só
por `user.email` estar em `ADMIN_EMAILS`, `src/app/config/adminConfig.ts:9`,
hoje só `clbrcouto@gmail.com`) "vazava" pro usuário novo junto: a aba do
usuário novo, na prática, ainda estava autenticada como o Cleber.

**Confirmado que o gate de admin está correto no código**
(`Sidebar.tsx:91`, `App.tsx:209`, `adminConfig.ts`) — não precisou de nenhum
fix, o "menu Sistema aparecendo" era sintoma do mesmo vazamento de sessão,
não um bug novo.

**Armadilha adicional descoberta**: múltiplas **janelas anônimas** abertas ao
mesmo tempo no Chrome também compartilham sessão entre si (fazem parte da
mesma "sessão anônima" enquanto pelo menos uma estiver aberta) — não é bug
nosso, é o próprio Chrome. Cleber tentou 2 janelas anônimas primeiro e ainda
viu o problema; a combinação que finalmente isolou as sessões foi **1 janela
normal (conta do Cleber) + 1 janela anônima (conta de teste)** — confirmado
funcionando por ele ("funcionou em 1 e 1 janela").

**Sem pendência de código.** Só documentação/explicação pro Cleber sobre como
testar múltiplas contas no mesmo navegador.

## 3. [ESCLARECIDO] Como conectar conta real do MetaTrader

Cleber perguntou se pode conectar o MT5 real pelo login criado (qualquer
usuário, não só o admin) — sim, sem restrição. Caminho real, documentado pra
referência futura:

1. Precisa de conta na MetaAPI (`metaapi.cloud`) conectando o MT5 real da
   corretora (login/senha/servidor).
2. MetaAPI devolve **Account ID** (formato `bb99f865-96fb-4573-98a7-...`) e
   **Token** — não confundir com login/senha da corretora (o formulário já
   valida e avisa quando o usuário cola o número da conta MT5 no campo
   errado).
3. Tela **AI Trader** (`src/app/components/AITrader.tsx`, handler
   `handleConnectMT5`) tem o formulário de conexão — Token nunca fica no
   navegador, vai direto criptografado pro backend via
   `saveBrokerCredentials()` (`src/app/services/BrokerClient.ts`); só
   login/servidor/accountId (não-segredo) ficam em `localStorage` só pra
   pré-preencher o formulário.

**Achado à parte, não investigado a fundo nesta sessão**: existe um
componente legado (`src/app/components/settings/BrokerConnections.tsx`,
renderizado em `Settings.tsx:1035`) que salva credenciais de broker
(incluindo o campo "Token") **direto em `localStorage`**, sem passar pelo
backend seguro — parece código morto/desatualizado (não segue a mesma
disciplina do `BrokerClient.ts` real, que criptografa server-side). Não foi
tocado nem removido nesta sessão; vale investigar se ainda é alcançável pela
UI e, se for, decidir remover ou substituir pelo fluxo real do AI Trader.

## Pendente real

- **Sizing seguro pra ~US$60**: ainda não decidido qual cesta de ativos e
  risco por trade é compatível com esse capital antes de conectar a corretora
  real (achado de sessão anterior, 2026-09-09: BTCUSD sozinho já força ~$3,95
  de risco numa conta de $100 — precisa reavaliar pra $60).
- Decidir se/quando investigar o `BrokerConnections.tsx` legado (achado
  colateral acima).
- Depois do sizing decidido: conectar a corretora real de fato e ligar o
  Cérebro LLM Ativo apontando pra essa conta — ainda não feito.
