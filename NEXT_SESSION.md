# Handoff — próxima sessão (escrito em 2026-07-29)

> Arquivo temporário de retomada rápida. Não é memória permanente do projeto —
> isso é o `CLAUDE.md` (carrega automático) e o `AI_BRAIN_SPEC.md` (fonte de
> verdade do motor de decisão). Este arquivo existe só pra abrir uma janela
> nova e retomar sem reconstruir o raciocínio do zero. Pode apagar depois de
> ler/absorver. Substitui o handoff anterior (auditoria de dado fabricado +
> avaliação de prontidão para investimento, mesmo dia 2026-07-29), que já foi
> commitado e absorvido — este cobre o que aconteceu depois dele, na mesma
> data.

## Onde a conversa chegou

Depois do handoff anterior (que gerou o `ROADMAP-INVESTIDORES-NEURAL-DAY-TRADER.md`
e o `RISK_MANAGEMENT_STRATEGY.md`, ambos já na raiz do projeto), esta sessão
fez três coisas: **(1)** corrigiu um bug real de autenticação achado por
pedido direto do Cleber, **(2)** avaliou se a Fase 0 e a Fase 1 do roadmap
estão 100% completas (não estão — nenhuma das duas), **(3)** levantou o que
falta pra fechar a Fase 0 a 100%, sem ainda implementar.

---

## 1. Bug corrigido: `mockLogin` sobrescrevendo `user.id` real após login em produção

**Já commitado** (`fix: parar de sobrescrever user.id real por mock-user-123
apos login`). `CLAUDE.md` também já atualizado com o detalhe (seção
"Segurança (Fase 1)").

**O bug**: `AuthOverlay.performLogin()` fazia login real via
`supabase.auth.signInWithPassword` — sessão real criada, `AuthContext`
já captava o `user.id` UUID correto via `onAuthStateChange`. Mas 500ms
depois, `App.tsx` chamava `mockLogin(email, name)` no callback
`onAuthenticated`, que **sobrescrevia** esse `user.id` real por um valor fixo
`'mock-user-123'` — e persistia isso em `sessionStorage`, então voltava a
carregar o mock em todo reload, indefinidamente, até logout.

**Impacto real** (não é o que parecia à primeira vista): como `user_id` nas
tabelas `ai_sessions`/`ai_trades`/`ai_portfolio_snapshots` é `uuid NOT NULL`
com RLS `auth.uid() = user_id`, e `'mock-user-123'` não é um UUID válido, o
efeito **não era vazamento de dado entre contas** — era **falha total de
persistência** (erro de cast) pra todo usuário logado em produção. Ainda
assim era um bug sério: qualquer usuário real que fizesse login não
conseguia gravar sessão/trade nenhum no Supabase.

**Correção**: removida a chamada a `mockLogin` do callback `onAuthenticated`
em `App.tsx` — a sessão real já é setada pelo listener `onAuthStateChange`
do próprio `AuthContext`, não precisa de nada explícito ali. `mockLogin`
continua existindo no `AuthContext` só pra um eventual modo demo explícito
sem sessão real, não é mais acionado no fluxo de login de produção.

**`npm run validate` rodado e verde (28/28)** antes de considerar a correção
pronta — mudança fora do motor de decisão, mas o gate do projeto foi
respeitado mesmo assim.

---

## 2. Avaliação: Fase 0 e Fase 1 do roadmap estão 100%?

**Pergunta do Cleber**: conferir se as duas primeiras fases do
`ROADMAP-INVESTIDORES-NEURAL-DAY-TRADER.md` (criado no handoff anterior)
estão realmente fechadas.

### Fase 1 (módulo de risco) — **0% feito, confirmado no código**

- `RiskManager.ts` (67 linhas): zero referências em qualquer outro arquivo.
- `NeuralRiskGuardian.ts`: usado só como tipo (`RiskProfileType`) em
  `TradingContext.tsx` e `useApexLogic.ts` — nenhum enforcement real.
- `/broker/execute` (`supabase/functions/server/index.ts:1049`) — a rota que
  de fato manda ordem pra MetaAPI — **não tem nenhuma checagem de risco**:
  sem daily loss limit, sem drawdown, sem position sizing por ATR, sem
  cooldown, sem limite de trades/dia, sem kill-switch. Só encaminha a ordem
  direto pro broker.
- Nenhum dos 7 itens do entregável da Fase 1 foi implementado.

### Fase 0 (fechar o que ficou pela metade) — **parcial, não 100%**

- Item 1 (reescrever `LandingPage.tsx`/`translations.ts`/`Pricing.tsx`):
  **feito** — os números fabricados citados no roadmap ("24.000+ nós",
  "$1.2B", "99.99% uptime", "Zero Latency Co-location" etc.) não aparecem
  mais nesses 3 arquivos.
- Item 3 (reposicionamento de copy "previsão" → "disciplina de execução"):
  **parece feito** — não achei resíduo de "IA que prevê o mercado" em
  `src/app/components`/`src/app/modules`. Não auditado texto completo, fora
  do escopo desta checagem.
- Item 2 (varredura completa do repo por dado fabricado): **incompleta** —
  achados novos que a varredura original não pegou (ver seção 3 abaixo).

---

## 3. O que falta pra fechar a Fase 0 a 100% (levantado, NÃO implementado ainda)

Cleber pediu pra eu **não implementar agora** — só salvar isso pra retomar
numa sessão nova.

1. **`src/app/components/dashboard/SystemPerformance.tsx`** — painel inteiro
   de "latência 24ms", "uptime 99.99%", "MTTR 45ms", "benchmark TOP 1%" e log
   de eventos ao vivo (`[SEC] Handshake TLSv1.3 validado`, `[CACHE] Hit
   ratio: 98.4%`), tudo gerado por `Math.random()` a cada segundo.
   **Confirmado: não é importado em lugar nenhum do app — código morto.**
   Não quebra o critério literal da Fase 0 (não é "superfície voltada pro
   usuário" hoje), mas é exatamente o padrão que a Fase 0 quer eliminar e
   fica como risco de reativação. **Ação recomendada**: apagar o arquivo.

2. **`src/app/components/admin/DefensiveArchitecture.tsx`** — 5 "camadas de
   proteção" (Firewall, WAF, Rate Limiting, Input Validation, Encryption)
   com métricas hardcoded (`blocked: 1847, allowed: 98234, uptime: 99.9`
   etc.) sem telemetria real por trás, array estático. Renderizado em
   `AdminDashboard` e `SystemView`, **ambos atrás do gate `isAdmin`**
   (`Sidebar.tsx:73`) — não é visível pra cliente pagante, só pro Cleber.
   Menor prioridade, mas mesmo padrão de dado fabricado. **Ação
   recomendada**: reescrever pra estado real (on/off por camada, sem
   contagem fake) ou rotular explicitamente como "ilustrativo".

3. **`src/app/components/strategy/StrategyDashboard.tsx:191-196`** — tabela
   comparativa "Neural Finance vs. concorrência" com números sem fonte
   citada (`Bloomberg 450ms`, `TradingView 120ms`, `Neural Finance 45ms`
   etc.). Também atrás do gate admin (`strategy` view). **Decisão pendente
   do Cleber**: rotular como estimativa não verificada, ou remover as
   colunas de número específico que não têm fonte.

4. **Sweep final não terminado**: ~55 arquivos no repo ainda usam
   `Math.random` que não foram todos abertos individualmente. Os que *foram*
   checados (`AmbientBackground.tsx`, `InteractiveBackground.tsx`, jitter de
   preço no `MarketScoreBoard.tsx`, nível de áudio no `NeuralEventCenter.tsx`)
   são cosmético/simulação de mercado legítima, não claim de capacidade — mas
   os restantes não foram auditados um a um ainda.

5. Depois de resolver 1-4: `npm run validate` antes do commit final (regra
   do projeto).

**Próxima ação sugerida ao reabrir**: perguntar ao Cleber se quer que eu
implemente os itens 1 e 2 (diretos: apagar arquivo morto + reescrever
componente admin-only) e faça o sweep do item 4, deixando o item 3 pra
decisão dele — foi a proposta feita nesta sessão, ainda sem resposta.

---

## Lembretes de regra fixa (não esquecer na sessão nova)

- **Nunca `git commit`/`git push` sozinho** — sempre entregar comando pronto
  pro Cleber rodar.
- **Nunca salvar `.md` acima da raiz do projeto** (`Neural-Day-Trader/`) —
  sempre na raiz. Checado nesta sessão: não há nada relevante fora da raiz
  hoje (verificado `we-expand/`, `Projects/`, `Desktop`, `Downloads`).
- `npm run validate` obrigatório antes de qualquer commit que toque o motor
  de decisão (não é o caso da maioria dos itens acima, mas rodar mesmo assim
  como disciplina).
- Comunicação sempre em português do Brasil, rigor de especialista, sempre
  reportar achado negativo/incompleto por inteiro (padrão já registrado na
  memória do Cleber).
