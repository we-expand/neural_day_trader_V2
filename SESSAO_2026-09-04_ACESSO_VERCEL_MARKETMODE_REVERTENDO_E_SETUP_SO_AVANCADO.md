# Sessão 2026-09-04 — Acesso Vercel (MCP), `marketMode`/`dailyLossLimit` revertendo sozinhos (2ª ocorrência), URL de deployment congelada, Setup só no Avançado

## 1. Push do commit `bf563001f` confirmado na Vercel

Cleber perguntou se o push mais recente (`revert(llm-brain): cesta de
ativos volta a ser so do usuario, nao automatica`) tinha chegado na
Vercel. Confirmado via `git diff HEAD origin/dev` (sem diferença) — `dev`
local e `origin/dev` idênticos em `bf563001f`, que é o que dispara o
build automático na Vercel pra branch `dev`.

## 2. Plugin MCP da Vercel — conectado, mas sem escopo pro projeto

Cleber perguntou como me dar acesso à Vercel — o plugin/conector já
estava ativo (mesmo que emitiu o aviso de CLI desatualizada no início da
sessão). `list_teams` funcionou (retornou "Cleber Couto's projects"), mas
`list_projects` voltou vazio e `list_deployments` no projeto
`neural-day-trader-v2` (`prj_KEIR3CYmwlC6pWZ5y4dejEnFwtbQ`, achado em
`.vercel/project.json`) devolveu **403 Forbidden**. Conclusão: a
integração está autorizada pra conta/time, mas sem escopo de acesso a
este projeto específico — precisa reautorizar (claude.ai → Conectores, ou
Vercel → Settings → Integrations) marcando "All projects" ou selecionando
`neural-day-trader-v2` explicitamente. **Não verificado de novo nesta
sessão** — Cleber ainda não reautorizou.

## 3. `dailyLossLimit`/`marketMode` revertendo sozinhos — causa raiz real corrigida

2ª ocorrência do mesmo bug já catalogado em 2026-09-02 e 2026-09-03: um
ajuste feito direto via SQL (`dailyLossLimit` 5%→15%, `marketMode`
`"TREND"`→`null`) voltava sozinho minutos depois. Log do
`llm-active-brain` confirmou o motor preso desde o ciclo #2 do dia com
"Limite de perda diária do Setup (5.0%) atingido... bloqueado por código"
— 15+ ciclos recusando toda entrada nova mesmo com setups técnicos
válidos identificados pela IA (SPX500, XAUUSD, EURUSD, NAS100, UK100).

**Causa raiz real, agora corrigida (não só reaplicado o SQL como nas
vezes anteriores)**: [useApexLogic.ts](src/app/hooks/useApexLogic.ts)
tinha um `useEffect` que salvava o objeto `aiConfig` **inteiro** no
Supabase a cada mudança de estado, via `saveUserAIConfig` — `upsert` cego
que sobrescreve a coluna `config` inteira. Qualquer aba já aberta antes
do ajuste via SQL mantinha o valor velho em memória; a próxima mudança de
config feita pelo usuário **naquela aba**, mesmo em campo não
relacionado, regravava tudo por cima.

Fix aplicado (commit `a46e70035`, já commitado e pushado — confirmado
ancestral de `origin/dev`):
- [AITradingPersistenceService.ts](src/app/services/AITradingPersistenceService.ts) —
  novo `patchUserAIConfig`: busca o `config` mais recente do banco e faz
  merge só dos campos alterados, nunca sobrescreve tudo.
- [useAIPersistence.ts](src/app/hooks/useAIPersistence.ts) — expõe
  `patchUserAIConfig`.
- [useApexLogic.ts](src/app/hooks/useApexLogic.ts) — `updateAIConfig`
  agora persiste o patch direto (campo a campo); removido o `useEffect`
  que regravava o objeto inteiro a cada mudança (mantido só como gravação
  única pra usuário novo sem config salva ainda).

`tsc --noEmit`: 572 erros, mesma contagem de ruído pré-existente, nenhum
novo nos 3 arquivos tocados.

SQL de reparo imediato aplicado no momento do achado (antes do fix de
código estar pronto): `dailyLossLimit` de volta a 15, `marketMode`
removido (`null`) via `UPDATE` direto em `ai_user_config`.

## 4. "Botão Automático não existe" — na real, era URL de deployment congelada

Cleber reportou repetidamente não achar o botão "Automático" no card
"Fluxo de Operação" do Setup (aba Avançado), inclusive testando em modo
anônimo. Investigação:
- Confirmado no código ([AITrader.tsx](src/app/components/AITrader.tsx))
  que o card sempre teve os 3 botões (A Favor/Contra/Automático) — testado
  ao vivo no dev server local, renderiza certinho.
- Cleber mandou print: a barra de endereço mostrava
  `neural-day-trader-v2-6tyy44dpx-cleber-coutos-projects.vercel.app` — uma
  **URL de deployment com hash**, o mesmo problema já catalogado no
  CLAUDE.md ("nunca testar em URL de deployment com hash — imutável, não
  atualiza com push nenhum"). Esse build específico é de antes do 3º botão
  existir. Modo anônimo não resolve porque o build congelado vive no
  servidor da Vercel, não no cache do navegador.
- **Fix real**: usar sempre o alias
  `neural-day-trader-v2-git-dev-cleber-coutos-projects.vercel.app`.

## 5. Setup do AI Trader — modo "Simples" removido a pedido do Cleber

Pedido explícito: "retire esse modo simples, vamos concentrar o setup só
no modo avançado". Perfis de risco prontos (Conservador/Moderado/
Agressivo/Experimental) escondiam os campos reais que o motor usa (Fluxo
de Operação, Direção Preferencial, Cadência de Entrada etc.) atrás de um
toggle Simples/Avançado — Setup agora abre direto no modo manual
completo, sem alternância.

Removido em [AITrader.tsx](src/app/components/AITrader.tsx): estado
`configMode` (+ persistência em `localStorage`), `selectedRiskProfileId`
(`useMemo`), função `applyRiskProfile`, import de
`RISK_PROFILES`/`getRiskProfile` (`@/app/data/riskProfiles`), o toggle de
botões Simples/Avançado e todo o card de "Perfil de Risco". O aviso
amarelo de "Modo manual" (antes condicional a `configMode==='AVANCADO'`)
agora é incondicional, sempre visível.

`AITradingEngine.tsx` (aparece modificado no `git status` desta sessão,
por trabalho anterior não relacionado) **não tem** esse toggle — não
precisou de mudança, fora de escopo.

`tsc --noEmit`: mesmos 2 erros pré-existentes em `AITrader.tsx` (alias de
módulo `/utils/supabase/info` e `MT5Adapter`/`IBrokerAdapter`), nenhum
novo. Testado ao vivo no dev server local — confirmado que o Setup abre
direto no manual, com "Fluxo de Operação" (A Favor/Contra/Automático)
visível de cara.

**Pendente**: commit não aplicado (regra do projeto — Claude nunca
commita sozinho), comando pronto entregue ao Cleber:

```bash
git add src/app/components/AITrader.tsx
git commit -m "feat(ai-trader-setup): remove modo Simples, Setup fica só no manual ..."
```

## Pendências reais desta sessão

1. Reautorizar o plugin MCP da Vercel pra este projeto específico
   (`neural-day-trader-v2`) — sem isso, não dá pra consultar deployments/
   logs de build via essa integração.
2. Commit de `AITrader.tsx` (comando acima) ainda não rodado pelo Cleber.
3. Confirmar ao vivo, na URL certa (alias `dev`), que o Cleber consegue
   agora ver e usar o botão "Automático" e o Setup só-Avançado.
