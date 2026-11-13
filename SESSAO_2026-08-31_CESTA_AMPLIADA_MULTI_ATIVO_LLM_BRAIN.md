# Sessão 2026-08-31 (noite) — Cesta multi-ativo do Cérebro LLM Ativo

## Contexto

Cleber reportou que a cesta do Cérebro LLM Ativo estava presa em **1 ativo
só (BTCUSD)**, apesar de ter configurado ~12 ativos no Setup do AI Trader.
Pediu explicitamente: "a IA tem que respeitar as configurações feitas pelo
usuário, seja lá quantos ativos o usuário colocar" — e, perguntado se isso
significava restringir o seletor à cripto real ou implementar de verdade as
outras classes de ativo, escolheu **implementar multi-classe (forex/metal/
energia/índices) no motor**, ciente de que era trabalho maior.

## Causa raiz

`ai_user_config.activeAssets` (config real do Cleber) tinha 12 símbolos:
`EURUSD, XAUUSD, UKOUSD, BTCUSD, SOLUSD, ETHUSD, GER40, SPX500, NAS100,
COFUSD, COCUSD, UK100`. O Cérebro LLM Ativo (`llm-active-brain/`) só tinha
ferramentas/sizing implementados pra 9 criptos MT5 fixas
(`assetBasket.ts`). `getUserTradingConfig` (`neuralBridge.ts`) intersecta a
config do usuário com essa cesta fixa antes de usar — a interseção real
dava só `BTCUSD`. Não era bug de intersecção (essa lógica está certa e
continua existindo, é uma trava de segurança pra nunca operar símbolo sem
spec real) — era a cesta fixa em si estar desatualizada/pequena demais pro
que o usuário queria.

## O que foi implementado

1. **Cesta ampliada de 9 → 16 símbolos** (`assetBasket.ts`): 9 criptos
   (inalteradas) + `EURUSD, XAUUSD, UKOUSD, GER40, SPX500, NAS100, UK100`.
   Cada um **testado ao vivo contra `/mt5-prices`** antes de entrar —
   `COFUSD` e `COCUSD` devolveram HTTP 404 nesta corretora/conta e ficaram
   de fora (não dá pra operar símbolo que a corretora não reconhece).
2. **`lotSize` real por ativo**, sourced de `assetDatabase.ts` (repo
   principal) — a MESMA fonte que corrigiu o bug de PnL 20x do NAS100 em
   2026-08-27 ($1/ponto CFD retail, não o contrato E-mini $20/ponto de
   `infinoxContractSpecs.ts`, que ainda tem o valor errado pra referência
   futura). A fórmula de sizing/PnL já existente (`amountUsd = lots *
   LOT_SIZE * preço`) generaliza corretamente pra qualquer classe de ativo
   desde que `LOT_SIZE` seja o contractSize real — não precisou reescrever
   a fórmula, só alimentar valores corretos.
3. **Alias `ETHUSD→XETUSD`** adicionado em `INVERSE_ALIAS`
   (`neuralBridge.ts`) — mesmo padrão dos 3 aliases já existentes
   (BTCBNB/DOGEUSD/LINKUSD).
4. **Guard de fim de semana estendido** aos 7 novos símbolos não-cripto
   (`WEEKEND_CLOSED_SYMBOLS`, era só forex vazio antes). Horário exato de
   pregão por bolsa (ex: SPX500 09:30-16:00 ET) **não foi modelado** de
   propósito — a trava de tick obsoleto (`STALE_TICK_MS=120s` em
   `mt5Broker.ts`, já validada ao vivo pro caso do XPTUSD em 08-30) cobre
   isso de forma orientada a dado real, sem fabricar uma tabela de horários
   por bolsa que arriscaria ficar errada.
5. **Grupo correlacionado novo**: `GER40/SPX500/NAS100/UK100` (índices
   globais andam juntos em risk-on/risk-off). `EURUSD`/`XAUUSD`/`UKOUSD`
   ficaram isolados (só 1 símbolo por classe nova, sem par real pra
   correlacionar ainda).
6. **Prompt do agente (`agent.ts`, seção "CESTA ATUAL") tornado dinâmico** —
   antes era uma lista de 9 símbolos escrita à mão que REJEITAVA
   explicitamente qualquer coisa fora dela (uma segunda barreira, além do
   código, que teria voltado a dessincronizar da próxima vez que a cesta
   mudasse). Agora é gerado de `MT5_ASSET_BASKET` no import do módulo.
7. Textos de tool description que diziam "todos os símbolos são cripto
   correlacionada" (`tools.ts`) corrigidos pra refletir a mistura real de
   classes.

`npx tsc --noEmit` limpo em `llm-active-brain/` durante toda a sessão,
inclusive depois de mesclar com o trabalho de outra sessão paralela (ver
abaixo). Commit: `e825b2c2e`.

## Achado de processo: sessão paralela na mesma pasta

Durante a implementação, outra sessão do Claude Code estava rodando **ao
vivo, na mesma pasta**, mexendo em `agent.ts`/`atr.ts`/`tools.ts`/
`neuralBridge.ts` (feature de Timeframe Operacional + Estratégia do Setup,
commit `8476146ed`). As duas sessões editaram arquivos em comum mas em
trechos diferentes — mesclou sem conflito, `tsc` ficou limpo depois. Sem
dano, mas é o MESMO risco já documentado antes (sessão de 08-31 anterior,
ver item "Achado de processo" no `CLAUDE.md") — evitar sessões paralelas
na mesma pasta continua valendo.

## Resultado ao vivo (confirmado, não suposição)

Processo reiniciado (`restart.sh`) depois que a outra sessão terminou e
commitou. `activeAssets` da sessão confirmado no log:
`EURUSD, XAUUSD, UKOUSD, BTCUSD, XETUSD, GER40, SPX500, NAS100, UK100` — 9
dos 12 ativos do Cleber (SOLUSD/COFUSD/COCUSD de fora por motivo real
documentado, não a cesta fixa antiga).

**Monitoramento ao vivo (~1h) não achou nenhum bug novo**, só
comportamento esperado:
- Guard de tendência ("A Favor") bloqueou 1 tentativa de SHORT contra
  ALTA em XETUSD — correto.
- Guard de risco mínimo bloqueou 1 tentativa de LONG em BTCUSD: lote
  mínimo nesse preço (~$79.000) já força ~$3,95 de risco, acima do teto de
  3% de uma conta de $100 (~$3,00) — **achado real, não bug**: com o preço
  atual do BTC, a conta de $100 é pequena demais pra operar esse ativo
  dentro do risco configurado. Vale decisão do Cleber (aumentar capital
  alocado, relaxar risco por trade, ou aceitar que BTCUSD fica de fora
  nessa faixa de conta).
- `XAUUSD`, `UKOUSD`, `GER40`, `UK100` estavam com tick obsoleto (mercado
  fechado/feed parado) em vários pontos da sessão — guard bloqueou entrada
  corretamente. **Confirmado ao vivo que o guard destrava sozinho**: XAUUSD
  reabriu (tick de 3,4s de idade) e o próximo ciclo já leu fresco, sem
  intervenção manual.
- Zero trades na sessão até o fim do monitoramento (`ai_trades` count=0)
  — amostra pequena (poucos ciclos), IA sendo cautelosa, mercados
  parcialmente fechados no horário. Não é sinal de travamento.

## Achado menor, não corrigido (baixa prioridade)

O agente ainda tenta consultar `DOTUSD, XRPUSD, BTCXBN, ADAUSD, LNKUSD,
UNIUSD` (fora da cesta atual do Cleber) todo ciclo, toma erro "fora da
cesta" em todos — desperdiça ~6 chamadas de ferramenta por ciclo sem
travar nada. Cosmético/eficiência, não corrigido nesta sessão.

## Pendências reais

1. Symbols 404 (`COFUSD`, `COCUSD`) — se quiser esses dois de volta,
   precisa investigar o nome certo do contrato nesta corretora (não é
   `COFUSD`/`COCUSD`, ver `infinoxContractSpecs.ts` pra pistas de nomes
   alternativos como "COFFEEUSD"/"COCOAUSD").
2. `SOLUSD` continua fora por decisão de sessões anteriores (causou 57% e
   depois 86% do prejuízo líquido de duas sessões distintas) — não
   reintroduzido sem decisão explícita do Cleber.
3. Achado do BTCUSD/risco mínimo acima — decisão de produto pendente do
   Cleber.
4. Limpeza cosmética das 6 chamadas desperdiçadas por ciclo (não
   bloqueante).
5. `SESSAO_2026-08-31_SETUP_IA_CAPITAL_ATIVOS_CADENCIA.md` foi tocado
   nesta sessão (provavelmente pela sessão paralela, não verificado a
   fundo o que mudou nele) — conferir se precisa de atualização.
