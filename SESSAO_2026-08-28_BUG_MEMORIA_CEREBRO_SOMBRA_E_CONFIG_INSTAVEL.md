# Sessão 2026-08-28 — Bug de amostra duplicada no cérebro sombra + config instável (minWinRate/signalScoreFloor)

> Handoff completo pra continuar de onde parou. Sessão longa, com um bug real
> encontrado e corrigido em cada uma das duas frentes abaixo.

## 1. Painel de observação do cérebro sombra — implementado

Pedido do Cleber: poder observar o cérebro analítico (modo sombra,
`ai_decision_brain_shadow`) de forma interativa, sem dar autoridade real de
trade a ele (mantém Fase 0/1 do plano intactas — ver
`research/experiments/2026-08-28-decision-brain-shadow-mode/hypothesis.md`).

**Implementado**: [`DecisionBrainShadowPanel.tsx`](src/app/components/system/DecisionBrainShadowPanel.tsx),
integrado na aba **Sistema** de Configurações (`Settings.tsx`). Mostra
decisão do cérebro vs. mecânico, raciocínio, resultado hipotético
(WIN/LOSS/TIMEOUT/PENDENTE), atualiza a cada 20s. Banner fixo deixando claro
que é só observação.

**Achado lateral**: a barra de abas de Configurações usava `overflow-x-auto`
sem indicação visual de scroll — cortava "Corretoras"/"Sistema" fora da tela.
Ninguém achava a aba Sistema por causa disso (nem o Cleber, testando ele
mesmo). Corrigido pra `flex-wrap` — todas as 7 abas visíveis de cara.

## 2. Bug real: amostra do cérebro sombra inflada ~17x por duplicação

**Achado, confirmado com dado real**: `ai-runner-tick` roda 1×/min e grava
uma linha em `ai_decision_brain_shadow` a cada tick com candidato mecânico —
sem nenhum dedup. Como RSI/MACD/ADX não trocam de sinal a cada minuto, o
MESMO setup (mesmo símbolo, mesmo lado) ficava sendo "candidato #1" por
dezenas de minutos seguidos, virando dezenas de linhas correlacionadas pro
MESMO evento de mercado. Medido em produção: **350 linhas brutas → só 20
episódios distintos** (17,5x de inflação). Isso furava o gate de amostra
mínima (`MIN_SAMPLE_FOR_HISTORY = 20`) de `decisionBrainHistory.ts` — 20
linhas podiam ser, e frequentemente eram, o mesmo trade único repetido 20x.

**Fix**: `collapseIntoEpisodes()` em
[`decisionBrainHistory.ts`](supabase/functions/ai-runner/lib/decisionBrainHistory.ts) —
agrupa linhas consecutivas do mesmo símbolo+ação do cérebro, sem gap maior
que 5min entre uma e a próxima, em um único episódio antes de qualquer
estatística. Não muda a tabela nem o log bruto (auditoria linha a linha
continua). Commitado e deployado (`ai-runner` v87+).

## 3. Bug real: falha de leitura de config liberava gravação de valor obsoleto

**Contexto**: Cleber pediu pra tornar a IA "mais severa na escolha de
entrada". Confusão inicial: `minWinRate` (rótulo antigo "Taxa de Acerto
Mínima") **não filtra entrada** — é um freio de segurança retroativo
(desliga a IA depois de ≥10 trades fechados no dia se o acerto real cair
abaixo do valor). O controle real de seletividade de entrada é
`signalScoreFloor` (piso do ranking mecânico RSI/MACD/ADX/confiança), que
**nunca teve controle na UI** até esta sessão.

**Renomeado e implementado**:
- `AITrader.tsx`: label do `minWinRate` virou "Freio de Segurança — Acerto
  Mínimo Aceitável (%)", descrição reescrita deixando explícito que é
  retroativo, não filtro.
- Novo slider "Seletividade de Entrada (Piso de Score)" ligado a
  `config.signalScoreFloor` — controle que nunca existiu antes.

**Bug real encontrado durante o teste**: ao tentar setar `minWinRate=30` e
`signalScoreFloor=50`, o valor voltava sozinho pra 75%/45 (valores antigos)
repetidamente, em qualquer aba nova, até anônima. Investigação eliminou por
ordem: aba antiga sobrescrevendo (descartado — reproduzia até com browser
fechado por 3min e depois reaberto), URL de deployment congelada (era
real, mas não a causa principal — usuário estava usando hash URL numa
etapa, mas o bug persistiu no alias `dev` correto também), sessão restaurada
setando aiConfig (descartado por leitura de código — `restoreActiveSession`
nunca toca `aiConfig`).

**Causa raiz #1 (código, corrigida)**: `useApexLogic.ts`, efeito de
hidratação da config (linha ~809) — o `finally` armava
`hasHydratedConfigFromSupabaseRef.current = true` **mesmo quando a leitura
do Supabase falhava** (`catch`). Nesse caso o navegador mantinha o valor
obsoleto do `localStorage` (podia ter dias) E ainda liberava o efeito que
regrava esse valor no `ai_user_config`, apagando qualquer edição feita fora
do cliente. Ambiente com rede visivelmente instável (múltiplos 403/408/500
em CORS proxy, Yahoo fallback, etc.) tornava isso frequente. **Fix**: só
arma a gravação depois de leitura CONFIRMADA (sucesso, mesmo vazia); falha
agora só adia a sincronização pro próximo mount, nunca sobrescreve às
cegas. Commitado (`9ad727282`), deployado, `npm run validate` limpo.

**Causa raiz #2 (operacional, não-código)**: mesmo depois do fix de
código, o valor ainda revertia. Diagnosticado com um **trigger de auditoria
temporário** (`ai_user_config_audit_debug`, já removido ao final da sessão)
que logava IP/user-agent de cada escrita nos 2 campos. Teste decisivo: com
o navegador **genuinamente fechado** por >3min, o valor ficou 100% estável
e o log de auditoria só mostrou a escrita feita via banco direto (IP de
serviço, sem user-agent) — nenhuma escrita de navegador. Conclusão: existia
algum cliente do navegador ativo (aba esquecida, outra janela, ou
possivelmente extensão/iframe — o console mostrava 4x o evento
`onAuthStateChange: SIGNED_IN` num único carregamento, sinal de mais de uma
instância de sessão sincronizando) regravando o valor antigo. Depois de
fechar tudo de verdade e reabrir uma única janela, o valor 30%/50 finalmente
"pegou" e ficou estável — **confirmado pelo Cleber ao vivo**.

## Estado final confirmado

- `ai_user_config` (user `aeb3ec15-f660-4775-856b-2a04b20f4592`):
  `minWinRate: 30`, `signalScoreFloor: 50`. Estável, confirmado na tela.
- Trigger de auditoria temporário removido (tabela, função e trigger — banco
  limpo, nada de debug sobrando).
- `useApexLogic.ts` (fix de gravação às cegas) e `decisionBrainHistory.ts`
  (fix de episódios) — ambos commitados e deployados.
- Painel do cérebro sombra funcionando em Configurações → Sistema.

## Pendências reais em aberto (não resolvidas nesta sessão)

1. **Causa exata da(s) instância(s) fantasma do navegador** nunca foi
   identificada com certeza absoluta — só contornada (fechar tudo e reabrir
   resolveu). Se o problema voltar a acontecer, o trigger de auditoria (SQL
   fica registrado acima, fácil de recriar) é o jeito mais rápido de pegar
   IP/user-agent do culpado.
2. **`ai_pending_orders`**: erro 404 recorrente no console
   (`Could not find the table 'public.ai_pending_orders' in the schema
   cache`) — existe uma migration untracked
   (`supabase/migrations/20260826_add_ai_pending_orders.sql`) que
   aparentemente nunca foi aplicada. Não investigado a fundo nesta sessão.
3. **Diagnósticos de rede vistos em produção, não investigados**: 403
   recorrente em `corsproxy.io` (fallback de preço cripto), 500 recorrente
   em `/functions/v1/server/real/yahoo/SUGUSD`, 406 em query de
   `ai_sessions`, 403 em insert de `price_guard_events` (RLS). Nenhum
   parece estar bloqueando o motor real (ai-runner no servidor), mas são
   ruído real que vale limpar em algum momento.
4. Auditoria pendente de sessão anterior (bug de PnL 20x em índices, só
   corrigido pra NAS100) — não tocada aqui, ver
   `SESSAO_2026-08-27_BUG_PNL_INDICES_E_HISTORICO.md`.

## Comandos já rodados (não pendentes)

- `git commit` do fix de `decisionBrainHistory.ts` (episódios) — feito e
  deployado pelo Cleber durante a sessão.
- `git commit 9ad727282` do fix de `useApexLogic.ts` (gravação às cegas) —
  feito e deployado.
- `git commit` do painel `DecisionBrainShadowPanel.tsx` + fix do layout de
  abas — feito.
- SQL de `ai_user_config` (minWinRate/signalScoreFloor) — ajustado direto
  no banco pelo Claude durante a sessão (config de usuário, não dado
  financeiro, dentro do que é seguro editar diretamente).
