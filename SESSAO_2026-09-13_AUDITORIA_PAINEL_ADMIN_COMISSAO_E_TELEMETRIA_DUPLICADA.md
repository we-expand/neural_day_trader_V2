# Sessão 2026-09-13 — Auditoria do Painel Admin (mock vs real) + comissionamento + bug de rota duplicada

## Gatilho

Cleber abriu a tela "Gestão Institucional" (Tesouraria Global) do painel
admin e viu o card "Comissões da Casa (DEMO)" com **"Failed to fetch"**,
com posições reais abertas em produção no momento. Pediu correção rápida e,
em seguida, uma auditoria profunda do painel admin inteiro atrás de dado
mockado.

## Causa raiz #1 (resolvida): Edge Function `server` não deployada

O card de comissão (`/admin/commission-summary`, implementado em sessão
anterior no mesmo dia, commit `477cd37e3`) já estava commitado e pushado,
mas a Edge Function `server` nunca tinha sido deployada em produção —
confirmado lendo o bundle deployado via MCP do Supabase, a rota não
existia lá. **Eu não pude rodar o deploy sozinho** (classificador de
segurança do Claude Code bloqueia ação em infraestrutura compartilhada,
mesma trava já catalogada no projeto) — entreguei o comando, Cleber rodou:
```bash
supabase functions deploy server --project-ref wyvdsxtcmizettljxtbg
```
Confirmado depois via SQL direto no Supabase que a arquitetura está
correta: 65 trades DEMO fechados nas últimas 48h já tinham comissão real
calculada (US$2,10 total, não mais zero); as 3 posições LIVE abertas no
momento apareciam corretamente com `commission=0` — comissão só é
calculada no FECHAMENTO da posição (`closeMt5Position`/`neuralBridge.ts`),
não é bug ela estar zerada enquanto a posição segue aberta.

## Auditoria completa do painel admin (12 componentes)

Rodei um agente de investigação (leu cada arquivo inteiro, grep no
`index.ts` pra confirmar se cada rota chamada existe de verdade) sobre os
componentes que eu ainda não tinha auditado, e verifiquei manualmente o
achado mais crítico que ele levantou. Veredito por arquivo:

**REAL, confirmado:**
- `UserIntelligence.tsx` — lista de usuários (`/list-users`) e telemetria
  (`/telemetry/users`), ambas rotas existem e são chamadas de verdade.
- `UserDataDashboard.tsx` — `/user-data`, `/telemetry/users`, `DELETE
  /telemetry/:userId` (botão "Excluir dados" funcional de verdade), export
  CSV gera do dado já carregado.
- `OperationLogs.tsx` — usa `AITradingPersistenceService` (Supabase direto,
  `ai_trades`/`ai_decisions`/`ai_sessions`), todas as métricas calculadas
  via `useMemo` sobre dado real.
- `DefensiveArchitecture.tsx` — lista estática mas descreve corretamente o
  estado real do código (RLS, criptografia, etc) — já tinha nota própria
  removendo contadores fabricados de uma sessão anterior.

**PARCIALMENTE REAL:**
- `CrawlerMonitor.tsx` — busca RSS real (CoinTelegraph/CoinDesk/Bitcoin
  Magazine via proxy CORS), mas a "análise de IA" é regex/keyword matching
  local, não LLM nenhum — rótulo "🤖 Analisando..." é enganoso, não é bug
  funcional.
- `SlippageSimulator.tsx` — calculadora Monte Carlo local legítima (produto
  é "simulador", comportamento esperado), mas o texto final chama o
  resultado de "Análise de IA" quando é só o resultado formatado da própria
  simulação — rótulo impreciso, não fabricação de dado de negócio.

**MOCK TOTAL — precisam de decisão de produto, não são fix rápido:**
- `SocialMediaManager.tsx` (Social Matrix) — seguidores/engajamento/posts
  100% hardcoded, "geração de IA" é um `setTimeout` com texto fixo, botão
  "Postar" só dá toast, nunca publica em rede nenhuma.
- `MarketingModule.tsx` (Marketing AI) — mesma classe: contas sociais e
  posts agendados hardcoded, geração de conteúdo fake, múltiplos botões
  sem `onClick` nenhum ("+ Conectar Nova Conta", "Agendar", "Resposta IA
  Automática").
- `AdminSettings.tsx` (Configurações Master) — nenhum campo persiste
  (nome da plataforma, moeda, MFA, chaves de API são tudo `defaultValue`/
  string mascarada fixa); `handleSave` só dá `toast.success`, sem
  `fetch`/`supabase.update` nenhum.
- Aba "Visão Geral" do `AdminDashboard.tsx` (`AdminOverview`) e o header
  (CPU Load/Memory/Active Nodes/Latency) — tudo hardcoded (Total Users
  12.845, System Revenue $482.900 etc).

**ÓRFÃO/MORTO:**
- `AdminGodMode.tsx` — não referenciado em lugar nenhum do app (fora do
  menu, inacessível), chama `GET /telemetry/logs`, rota que nunca existiu
  no `index.ts`, sem header de Authorization. 404 garantido, sempre mostra
  estado vazio "aguardando alvos". Como a telemetria real já é feita
  corretamente por `UserIntelligence.tsx`/`UserDataDashboard.tsx`, este
  componente é puramente duplicado e morto — candidato a remoção, ainda
  não removido (aguardando decisão do Cleber).

## Causa raiz #2 (resolvida): rota `/telemetry/track` duplicada — telemetria real potencialmente sombreada desde 09/09

Achado mais grave da auditoria, confirmado por leitura direta do código
(não só pelo agente): `supabase/functions/server/index.ts` tinha **duas**
definições de `app.post("/telemetry/track", ...)`:
- Linha ~1035 (removida): stub legado de 2026-07/08, esperava `{
  fingerprint }` no body, gravava num KV (`access_log:*`) que **nada mais
  lê** (confirmado via grep — nem o `AdminGodMode.tsx` órfão bate nessa
  chave, ele chama uma rota diferente e inexistente).
- Linha ~2082 (mantida, agora única): implementação real de 2026-09-09
  (telemetria/LGPD), exige JWT, resolve IP/geo no servidor, grava heartbeat
  em `user_activity`.

Hono (o framework usado) executa só o **primeiro** handler registrado para
uma rota exata — o segundo nunca era alcançado. Como `UserTracker.tsx`
manda `{ device }` no body (não `{ fingerprint }`), toda chamada de
heartbeat caía no `if (!fingerprint) return 400` do stub morto, e o erro
era só um `console.warn` silencioso no cliente — sem sintoma visível pro
usuário. Efeito provável: `user_activity` pode não estar recebendo
heartbeat nenhum desde 09/09, mesmo a UI de "Inteligência de
Usuários"/"Dados de Usuários (LGPD)" funcionando sem erro aparente
(ela lê `/telemetry/users`, uma rota GET diferente e correta — só o
heartbeat de escrita estava quebrado).

**Fix aplicado**: removido o stub morto (linhas 1034-1053 originais).
Rota real de telemetria agora é a única, sem duplicidade.

## Pendências reais

1. **Deploy necessário pra este fix pegar** (ainda não rodado nesta
   sessão, comando entregue):
   ```bash
   supabase functions deploy server --project-ref wyvdsxtcmizettljxtbg
   ```
2. Depois do deploy, seria bom confirmar via SQL se `user_activity` passa
   a receber linhas novas com IP/geo/device preenchidos (não só
   `success:true` no console) — não confirmado ainda nesta sessão.
3. Decisão do Cleber pendente: apagar `AdminGodMode.tsx` (órfão, duplicado,
   sempre quebrado) ou reconectar num endpoint que já não existe mais por
   bom motivo.
4. Mocks grandes sem fix rápido possível, aguardando prioridade do Cleber:
   Social Matrix, Marketing AI, Configurações Master, "Visão Geral"/header
   do admin — todos exigem integração real nova (redes sociais, LLM de
   verdade, persistência de config, métricas de sistema reais), não são
   bug pontual.
5. Rótulos "Análise de IA" enganosos em `CrawlerMonitor.tsx` (é regex
   local) e `SlippageSimulator.tsx` (é resultado da própria simulação) —
   cosmético, ainda não corrigido.

## Nota sobre o item de topo do CLAUDE.md (comissão própria/caixa contábil)

Durante esta sessão, o `CLAUDE.md` foi reescrito por outra atividade em
paralelo (nova arquitetura de comissão própria da casa em LIVE via
`platform_commission_ledger`, ver item "[EM ANDAMENTO 2026-09-11]" no topo
do arquivo) — não é trabalho desta sessão de auditoria, é contexto que
chegou no meio. O `git status` mostra `supabase/functions/server/index.ts`
e `src/app/components/admin/FinanceModule.tsx` com diff bem maior que só o
fix do `/telemetry/track` — o resto desse diff pertence a essa outra
frente (comissão própria/ledger), não foi tocado por mim além da remoção
do stub morto.
