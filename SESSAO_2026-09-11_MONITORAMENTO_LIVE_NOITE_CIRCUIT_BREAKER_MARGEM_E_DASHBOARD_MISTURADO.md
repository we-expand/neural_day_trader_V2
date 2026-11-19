# Sessão 2026-09-11, noite — Monitoramento contínuo do LLM Brain em LIVE real

Pedido do Cleber: acabou de conectar a corretora real (Infinox) e pediu
monitoramento contínuo de 5 em 5 minutos, com autonomia pra corrigir bugs e
manter o motor funcional. Sessão longa, com dinheiro real em jogo o tempo
todo. Resumo cronológico dos achados reais, mais importante primeiro.

## 0. Achado crítico logo no início: execução real estava DESLIGADA

`MT5_LIVE_EXECUTION_ENABLED=false` no `.env` do `llm-active-brain` — mesmo
achado catalogado mais cedo no mesmo dia (ver item do topo do CLAUDE.md,
"ACHADO GRAVE"). Cleber acreditava estar operando com dinheiro real desde
mais cedo, mas nada tinha sido enviado à corretora. Confirmado
`broker_credentials` real e conectado (login `87026945`,
`InfinoxLimited-MT5Live`, `deployed=true`). Com autorização explícita do
Cleber, liguei `MT5_LIVE_EXECUTION_ENABLED=true` e reiniciei — confirmado
no log (`[live] ⚠️ MT5_LIVE_EXECUTION_ENABLED=true`) e no primeiro trade
real (BTCUSD LONG, `broker_position_id=1214143096`, entrada real
$77.391,76).

**Importante deixar claro pro Cleber, se ele perguntar de novo**: o botão
"Ligar IA"/"Parar IA" da tela NÃO precisa ser tocado pra isso — o motor
already roda 24/7 em background; esse flag só decide se a ordem que o motor
decide abrir é REAL ou só simulada.

## 1. Circuit breaker de LIVE disparou 4 vezes na sessão — causas reais, não bug de código na maioria

O circuit breaker (`llm-active-brain/src/liveExecution.ts`,
`tripLiveCircuitBreaker`) é uma trava de segurança GLOBAL, deliberada: uma
vez acionado, desliga execução real pra TODOS os usuários até restart
manual — nunca reabre sozinho, de propósito ("$22 de capital não sobrevive
a uma sequência automática de erros sem alguém olhar antes de religar").

Ocorrências desta noite:

1. **Timeout genérico** chamando `/broker/execute` (`AbortSignal.timeout`
   estourado). Reiniciado com autorização do Cleber.
2. **Erro HTTP2 na região de Londres da MetaAPI**
   (`mt-client-api-v1.london.agiliumtrade.ai`, "connection error received:
   not a result of an error") — reforça o achado já catalogado hoje de
   manhã sobre instabilidade da conta dedicada de Londres. Reiniciado com
   autorização.
3. **"Corretora tem posições reais que o motor não reconhece"** — Cleber
   abriu 2 posições BTCUSD **direto no terminal MetaTrader**, fora da
   plataforma (SHORT 0,1 lote @76937,10 `1214146183`; LONG 0,15 lote
   @77062,08 `1214146555`), **sem stop-loss/take-profit configurado**.
   Confirmado com Cleber que foi ele mesmo, de propósito. Como as
   posições não existiam em `ai_trades`, a reconciliação (`index.ts`,
   `liveReconcileTick`) corretamente travou a execução por segurança —
   **isto é o circuit breaker funcionando como desenhado, não um bug**.
   Resolvido registrando as 2 posições no banco com dado 100% real (nunca
   fabricado — busquei via chamada direta a `getLivePositions`/
   `/broker/execute getPositions`), `stop_loss`/`take_profit=null`
   (decisão consciente do Cleber de deixar sem proteção mecânica, mesmo
   avisado que a SHORT já estava em -$13 a -$14 flutuante, ~24-40% do
   capital da conta). Reiniciado.
4. **Mesma causa raiz de novo** — outra posição manual aberta e já
   fechada entre o disparo e a checagem (`1214146705`, nunca encontrada
   na lista de posições reais quando fui investigar — já tinha sido
   fechada). Reiniciado depois de confirmar que a lista de posições reais
   batia de novo com o banco.

**Padrão pro Cleber entender**: toda vez que ele abrir/fechar algo direto
no MetaTrader (fora da plataforma), o circuit breaker vai travar a próxima
tentativa de reconciliação até alguém (eu, checando o que mudou de verdade
via API real) registrar a mudança no banco e reiniciar. Não tem como evitar
isso sem ele parar de operar direto no terminal, ou sem construir uma
reconciliação automática mais tolerante (não fiz isso — mudaria o
comportamento de segurança sem pedido explícito).

## 2. Fix real aplicado: circuit breaker de perda absoluta agora escala por % do saldo, não $ fixo

Achado do Cleber: "cada usuário vai colocar um saldo diferente" — o teto de
perda absoluta em LIVE (`mt5LiveAbsoluteLossLimitUsd`, antes `$3` fixo pra
qualquer conta) não escalava. Trocado pra `mt5LiveAbsoluteLossLimitPct`
(default 10% do saldo real, `MT5_LIVE_ABSOLUTE_LOSS_LIMIT_PCT` no `.env`),
calculado contra `liveAccount.balance` a cada checagem em `open_position`
(`tools.ts`). Cleber confirmou manter 10% por enquanto (fase de teste).
**Nota de processo**: esta mudança (`config.ts`/`tools.ts`) acabou
absorvida por um commit de OUTRA sessão do Claude Code rodando em paralelo
na mesma pasta (`20b4e8751`, sobre stop de fim de semana) — risco de
sessões paralelas já catalogado várias vezes no histórico do projeto,
aconteceu de novo. Conteúdo correto, só a atribuição do commit é de outra
sessão.

## 3. Achado real e corrigido: banco não distinguia ordem real de simulada explicitamente

Pedido do Cleber. Antes, só dava pra inferir pelo `broker_position_id` ser
nulo ou não. Adicionada coluna `is_live_execution` (boolean, not null
default false) em `ai_trades` — migration
`20260911_add_is_live_execution_to_ai_trades.sql` (SQL entregue, **Cleber
confirmou que rodou com sucesso**, backfill aplicado certo: os 3 trades
reais de hoje viraram `true`, todo o histórico simulado ficou `false`).
`neuralBridge.ts`/`openMt5Position` grava esse campo explicitamente a
partir de agora. Commit `f6d48c326` já aplicado pelo Cleber.

## 4. Bug real achado e corrigido: Dashboard misturava posição SIMULADA com dinheiro REAL

Cleber reportou "todas as operações que a nossa está fazendo ela não está
computando com o dinheiro de verdade do MetaTrader" — no meio da
investigação ele mandou print do MetaTrader terminal mostrando só 3
posições reais (as 2 manuais + NAS100), enquanto o Dashboard mostrava 4,
incluindo uma **BNBUSD simulada** (aberta pela IA em modo DEMO, nunca
enviada à corretora) misturada com as reais no card "Posições Abertas",
"Patrimônio Total" e "Risco da Conta", sem nenhuma distinção visual ou
numérica.

Corrigido em `src/app/hooks/useApexLogic.ts` (2 pontos: hidratação de
mount e `reconcile()` recorrente) — quando o usuário está com broker
conectado (LIVE), só trades com `is_live_execution=true` entram em
`activeOrders` (o array que alimenta todos esses cards). Em DEMO nada
muda. Campo `is_live_execution` adicionado à interface `AITrade`
(`AITradingPersistenceService.ts`). `tsc --noEmit`: nenhum erro novo nos 2
arquivos tocados (570 erros totais no projeto, mesmo ruído pré-existente
de sessões anteriores). Commit entregue ao Cleber, **não confirmado ainda
se ele rodou**:

```bash
git add src/app/hooks/useApexLogic.ts src/app/services/AITradingPersistenceService.ts
git commit -m "fix(dashboard): não mistura posição simulada com dinheiro real quando LIVE conectado ..."
```

## 5. Risco real: 2 posições BTCUSD manuais sem stop, margem livre chegou a ficar NEGATIVA

Depois de registradas, a conta chegou a mostrar margem livre **-$1,82**
(saldo $33,27, equity $18,63) — risco real de stop-out forçado pela
corretora. Avisado explicitamente ao Cleber; ele decidiu **deixar como
está, risco assumido conscientemente**, tanto pra não fechar as posições
quanto pra não adicionar stop. Margem melhorou depois pra positiva (~$2,61
livre, confirmado no print do próprio terminal MetaTrader). BTCUSD SHORT
sem stop chegou a -$14,79 flutuante numa checagem. **Não fechei nada, por
decisão explícita do Cleber — só documentando o risco real pra quem ler
depois.**

## 6. "Saldo errado em 2%" — não é bug, é defasagem esperada de polling numa conta minúscula com posição gigante

Saldo/equity do Dashboard vêm direto de `getAccountInfo()` real (mesma
API MetaAPI que o terminal usa), atualizado a cada ~5s. Com equity de
~$20-33 contra ~$19 mil de exposição nocional nas 2 BTCUSD sem stop,
poucos segundos de movimento de preço já mudam vários dólares de
equity — a defasagem de até 5s do polling aparece como um "erro" de
alguns %, mas os dois números (nosso e o terminal) convergem exatamente
quando o preço para de mexer. Não é bug de cálculo. Expliquei isso ao
Cleber, ele não pediu mudança.

## 7. Estocástico "errado" vs MetaTrader — auditado a fundo, não é bug de cálculo

Cleber insistiu 2x que o Estocástico da plataforma diverge do MetaTrader
("está dando pra ir pra cima" enquanto o de lá já cruzou pra baixo) e que
"não é configuração". Auditei a implementação completa
(`getSlowStochastic`, `llm-active-brain/src/atr.ts`) linha a linha —
fórmula clássica correta (%K rápido com janela de 14, %K lento SMA3, %D
SMA3 do %K lento), fonte de candle (`fetchRecentCandles`) e ordem
cronológica coerentes com MACD/ATR já validados em produção há semanas
sem reclamação de sinal invertido (descarta bug de ordenação de série).
**Causa real, confirmada**: nosso período é **14** (padrão comum tipo
TradingView), o Estocástico de fábrica do MetaTrader é **período 5** —
mais rápido, reage antes. Matematicamente os dois estão certos, só
sensibilidades diferentes. Cleber viu um resultado real bater com a
leitura mais rápida (mercado caiu) e pediu pra eu confirmar de novo — dei
a mesma resposta, mais fundamentada. **Não mudei o código** — ele não
confirmou querer trocar pra período 5 nas duas vezes que perguntei
diretamente (dispensou as perguntas). Se ele pedir de novo com clareza,
trocar `STOCH_PERIOD` de 14 pra 5 em `atr.ts` é a mudança certa.

## 8. Cesta trocada pra cripto puro no fim de semana (não automático, decisão manual)

Modo fim de semana bateu (21:00 UTC = 18h Brasília, automático,
`isWeekendMode()`) — CFDs (SPX500/GER40/XAUUSD/NAS100) corretamente
bloqueados/stale. Cesta ativa foi trocada manualmente (provavelmente pelo
Cleber via Setup) pra cripto só: `BTCUSD, AVAUSD, BNBUSD, DOGUSD, LNKUSD,
XETUSD`. Confirma que "modo fim de semana" ainda não tem comportamento
automático de cesta — é decisão manual do usuário, como já documentado
antes no CLAUDE.md.

## 9. Achado colateral: XETUSD (classificado como cripto no motor) teve feed travado durante o fim de semana

Uma tentativa de SHORT real de alta convicção (92%) foi corretamente
bloqueada pelo gate de cotação obsoleta (tick de 475s+) — sem dano ao
capital. XETUSD não está em `WEEKEND_CLOSED_SYMBOLS` (é tratado como
cripto 24/7), mas teve o feed da MetaAPI travado mesmo assim — hiccup
pontual, mesma classe de instabilidade já catalogada, não bug de
classificação.

## Estado ao final desta sessão

- **Circuit breaker travado DE PROPÓSITO** — Cleber pediu pra deixar assim
  (relutância em competir por margem já apertada). IA cai pra simulado em
  qualquer entrada nova até religar. Posições já abertas continuam reais e
  vivas na corretora independente disso.
- **3 posições reais abertas**: NAS100 LONG (`f5b9bb33`/`1214143586`, com
  SL/TP reais), BTCUSD SHORT 0,1@76937,10 (`faad9da8`/`1214146183`, SEM
  stop), BTCUSD LONG 0,15@77062,08 (`1e957dce`/`1214146555`, SEM stop).
- **Pendente**: Cleber rodar o commit do fix do Dashboard (seção 4) —
  comando entregue, não confirmado.
- **Pendente de decisão do Cleber**: trocar `STOCH_PERIOD` 14→5 (seção 7);
  religar o circuit breaker quando achar que a margem está confortável de
  novo; decidir se quer stop nas 2 posições manuais.
- Nenhum código relacionado ao motor de decisão/mecânica de trading foi
  alterado além do circuit breaker por % (seção 2) e do campo de
  auditoria `is_live_execution` (seção 3) — nenhuma mudança de
  seletividade, R:R, stop/alvo padrão, ou gate de confiança nesta sessão.
