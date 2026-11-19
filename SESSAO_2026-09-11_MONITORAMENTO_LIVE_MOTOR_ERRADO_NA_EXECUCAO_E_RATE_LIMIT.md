# Sessão 2026-09-11 — Monitoramento do primeiro teste com dinheiro real, motor errado plugado na execução LIVE, cesta reduzida por rate-limit

## Contexto

Cleber conectou a conta real (Infinox `InfinoxLimited-MT5Live`, login
`87026945`, mesma conta MetaAPI dedicada `bb99f865-96fb-4573-98a7-1f32895f84f7`
que serve o streaming da plataforma, com réplica `backup-new-york`) e pediu
monitoramento contínuo de 5 em 5 minutos, com autonomia pra corrigir bugs
reais de código e entregar commit pronto (nunca commitar sozinho — regra
fixa do projeto). Ele mesmo cuidou da parte de ligar/desligar a conexão e a
execução real; meu papel foi só monitorar.

## Achado principal, grave: execução automática LIVE estava plugada no motor errado

Ao investigar o toggle "Execução automática LIVE (avançado) — Estágios 1-4"
que apareceu ligado no painel com saldo real ($57,49), descobri que:

- A LLM (`llm-active-brain`, processo Node) estava decidindo **só dentro da
  sessão DEMO** (`session_id 649295b1-3e08-4168-b4d2-437948d7a708`, saldo
  virtual). Nenhum trade dela tinha `broker_position_id` — nunca tocou a
  conta real.
- O toggle "Estágios 1-4" de execução automática real, por outro lado,
  estava alimentado pelo **motor mecânico antigo** (`runTradingCycle.ts`,
  rodando no navegador a cada 5s via `useApexLogic.ts`, usando
  `useStrategies()` — presets mecânicos de Setup, nada de IA/LLM). Esse é o
  motor que o projeto achava "desligado definitivamente" desde 2026-08-31 —
  só o cron do servidor (`ai-runner-tick`) foi desligado; essa cópia
  client-side continuou viva e era exatamente o que estava plugado na
  execução real.
- Ou seja: se uma ordem real saísse, seria decisão do motor mecânico velho,
  nunca da LLM — o oposto do que Cleber pediu ("a LLM tem que ler o modo
  live").

**Fix aplicado, commitado e pushado (`eaa3ad154`, já em `origin/dev`)**:
`forwardLiveDecision` (`TradingContext.tsx`) agora ignora qualquer decisão
do motor mecânico legado quando `executionMode === 'LIVE'` — nenhuma ordem
real pode mais sair dele. Efeito prático: o toggle Estágios 1-4 continua
visível no painel, mas não dispara nada hoje. Conectar a LLM de verdade à
execução real (Cleber escolheu essa opção) é trabalho à parte, ainda não
iniciado — a LLM nunca chamou `/broker/execute`; precisa de desenho
cuidadoso (idempotência, reconciliação, trava de risco) antes de tocar
dinheiro real.

## Achado secundário: log de saldo poluindo "Atividade da IA"

`updatePortfolioFromMT5` (`useApexLogic.ts`) logava
`💰 Portfolio MT5: Balance...` a cada poll de sincronização LIVE (5s),
mesmo sem mudança nenhuma — inundava o painel "Atividade da IA" e escondia
o raciocínio real da LLM. Corrigido no mesmo commit `eaa3ad154`: só loga
quando balance/equity mudam de verdade (threshold 1 centavo).

## Mitigação: cesta reduzida de 11 para 6 ativos por rate-limit da MetaAPI

Retomando o achado já registrado no topo do `CLAUDE.md` (conta MetaAPI
dedicada com `Failed to subscribe TimeoutError`/desconexões em ambas as
regiões), durante o monitoramento a maioria das cotações da cesta vinha
`stale:true` num mesmo ciclo (rate-limit/lentidão do lado da MetaAPI,
aguardando resposta do chamado de suporte aberto por Cleber). Investigado o
código (`tools.ts`/`mt5Broker.ts`): já existe batching (`primeQuotes`, 1
requisição pra cesta inteira por ciclo), cache de 12s (calibrado contra o
watchdog de stop de 5s, não pode subir sem enfraquecer proteção real) e
retry com backoff — a mitigação de código já está no teto do que dá pra
fazer sem mexer no lado da MetaAPI. Não é bug de código, é o teto de ~5
conexões concorrentes de dado histórico por conta (fixo, documentado antes)
sendo estourado por 11 símbolos por ciclo.

**Mitigação aplicada por Cleber, via Setup (não código)**: cesta reduzida
pra 6 ativos (`BTCUSD, SPX500, NAS100, ETHUSD, GER40, XAUUSD`), confirmada
no banco (`ai_user_config`, `updated_at` 2026-09-11 20:05:46 UTC). O motor
relê a config do banco a cada ciclo (sem cache travado, sem precisar de
restart) — confirmado que a arquitetura já suporta a mudança pegando
sozinha no próximo ciclo, sem intervenção manual. Verificação final desse
ponto ficou em andamento quando a sessão foi encerrada (Cleber pediu pra
parar o monitoramento antes da confirmação definitiva de que a taxa de
`stale:false` melhorou com a cesta menor) — **pendente**: reconfirmar numa
próxima sessão/checagem se os ciclos ficaram mais rápidos e com cotação
mais fresca depois do corte.

## Estado da conexão real ao longo da sessão

`streaming-relay` (PID ~35792) conectado normalmente nas duas regiões
durante toda a sessão — só 2 blips isolados e breves (15:13 e 15:47 locais,
cada um reconectando em segundos), nenhuma recorrência do padrão grave (as
duas regiões caindo juntas por tempo prolongado) documentado mais cedo no
mesmo dia no topo do `CLAUDE.md`. `llm-active-brain` (PID ~13921) nunca
caiu nem precisou de restart do watchdog durante o monitoramento. Achados
não-bloqueantes: 2 ocorrências de
`[neuralBridge] falha ao gravar ai_brain_activity_log: TypeError: fetch failed`
(escrita no Supabase falhou transitoriamente, ciclo seguiu normal — não
investigado a fundo, baixa recorrência).

## Pendente real pra próxima sessão

1. Confirmar se a cesta de 6 ativos realmente melhorou a taxa de cotação
   fresca / velocidade de ciclo (verificação estava em andamento quando a
   sessão foi encerrada a pedido do Cleber).
2. Desenhar com cuidado a ponte real LLM (`llm-active-brain`) → execução
   real na conta MT5 (Cleber escolheu essa direção) — hoje não existe:
   trades da LLM são só simulação (sessão DEMO), nunca chamam
   `/broker/execute`. Precisa de: sessão `mode=LIVE` real em `ai_sessions`
   pra essa estratégia, idempotência de ordem, reconciliação com a conta
   real, e as mesmas travas de risco já validadas em DEMO.
3. Continuar monitorando recorrência do "achado de rede local vs conta
   MetaAPI" registrado no topo do `CLAUDE.md` (13/09, madrugada) — se as
   duas regiões (Londres + backup-new-york) caírem juntas de novo, reforça
   a hipótese de que não é a região de Londres.
