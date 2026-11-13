# Sessão 2026-09-16 — Trade ruim de "Super Quarta", gate de entrada contrarian corrigido, janela do Fed automática, aviso de evento no Dashboard

## Contexto do dia

Hoje é dia de decisão de juros do Fed (FOMC, "Super Quarta"): decisão às
14h ET/18h UTC, coletiva do novo chair às 14h30 ET/18h30 UTC (15h/15h30
Brasília). Esses horários já tinham sido pesquisados ao vivo numa sessão
anterior no mesmo dia (ver `llm-active-brain/src/config.ts` ~linha 701) e
usados pra calibrar o gate de notícias de alto impacto.

## 1. Investigação: "a IA só acertou 1 de 9 entradas hoje, é o Fed?"

Cleber reportou desempenho péssimo (9 entradas, 1 acerto) e suspeitou do
"discurso do Fed" como causa. Checado direto no Supabase (`ai_trades`,
`entry_time >= hoje`): **não tinha relação com o Fed** — nenhum
`ai_reasoning` dos 9 trades menciona Fed/FOMC/Powell/notícia. 7 fechados:
6 pararam no stop (-$1,12 a -$7,94), 1 fechou quase zero a zero (+$0,15).
2 abertos no momento da checagem.

**Achado real**: quase todos os trades ruins eram setups **REVERSAO/
contrarian** que o próprio `ai_reasoning` justificava ignorando o
indicador técnico contra — "volume alto justifica entrada contrarian",
"volume real override stochastic sobrecomprado", "MACD ALTA contradiz
mas...". Apareceu em pelo menos 5 dos 7 trades fechados.

Também confirmado: o commit da manhã (`80e3e95fe`, trava de FOMC/VIX) já
estava rodando ao vivo (processo reiniciado às 10:32 local, junto do
commit) — mas os 9 trades ruins foram todos ANTES desse restart, e o
comitê ainda não tinha anunciado nada (decisão só às 18h UTC). Achado
colateral, sem relação com o pedido original: no momento da checagem os
feeds da MetaAPI para quase toda a cesta (XAUUSD/UKOUSD/SPX500/JPN225/
CHINA50/HKG33) estavam caindo em fallback `stale=true, price=$1` — só
BTCUSD (roteado direto pra Binance) com dado real. A própria IA percebeu
isso sozinha e chamou `stop()` no ciclo, recusando abrir posição sem dado
real — comportamento correto, não bug.

## 2. Bug real corrigido: gate de contra-tendência tinha 2 buracos

Cleber, ao ver o padrão de "volume alto justifica" repetido: **"Isso não
pode acontecer!! Tome providências e corrija!"**

Causa raiz real em `llm-active-brain/src/tools.ts` (~linha 1944), no gate
que deveria travar entrada contrária à tendência de curto prazo sem
confirmação real suficiente:

```
if (counterTrend && stochasticExtremeConfirmsReversal && !volume.elevated && reversalConfirmationFactors.length < 2) { bloqueia }
```

Dois buracos reais:
- **(a)** Só entrava em ação quando o Estocástico JÁ estava em extremo —
  contra-tendência SEM Estocástico extremo passava 100% livre, sem
  nenhuma checagem de fator mínimo.
- **(b)** Quando o Estocástico estava em extremo MAS o volume também
  estava elevado, a checagem inteira era pulada — volume sozinho virava
  "suficiente", exatamente o padrão citado pelo Cleber.

**Fix aplicado**: `if (counterTrend && reversalConfirmationFactors.length < 2)`
— agora qualquer entrada contra-tendência exige **sempre** ≥2 fatores reais
alinhados (volume elevado, Estocástico extremo+crossing, MACD, padrão de
candle), sem pré-condição e sem bypass por volume. `tsc --noEmit` limpo.

Commitado e processo reiniciado ao vivo (PID 53541) a pedido explícito do
Cleber ("faça o restart"). **Pendente real**: falta só o Cleber rodar o
`git commit` (comando entregue) — o restart já pegou o código novo direto
do working tree (`tsx`, sem build).

## 3. Vídeo do discurso do Fed não tocava

Cleber reportou que o botão "Fed ao vivo" do Header (`NeuralEventCenter.tsx`,
feature de outra sessão em paralelo no mesmo dia, não criada por mim)
abria a janela mas o vídeo não dava play.

Testado o embed do Brightcove (`players.brightcove.net/66043936001/...`)
isolado, fora do app: responde ao clique, mostra controles reais (play/
pause/LIVE/fullscreen), mas fica com tela preta — mais provável só falta
de sinal (transmissão começa só às 18h30 UTC, testado horas antes). Não
foi possível confirmar 100% dentro do app (dev local exige login). Como
mitigação, sem certeza da causa exata: adicionados 2 links de fallback
visíveis dentro do player (site oficial do Fed + YouTube do canal oficial,
a própria página do Fed já anuncia YouTube como "alternate player").

## 4. Correção de escopo: vídeo não deve depender de clique

Cleber corrigiu o entendimento: **"O vídeo não é para rodar dentro de um
botão... tem que abrir uma janela no próprio dashboard e executar o
discurso [automaticamente], 30 minutos antes... o usuário que não queira,
fecha a janela."**

Implementado em `App.tsx`: `useEffect` que abre `NeuralEventCenter`
sozinho quando faltam ≤30min pro horário real da coletiva (confirmado
`2026-09-16T18:30:00Z`), checando a cada 30s. Se o usuário fechar
manualmente, a decisão é lembrada via `localStorage`
(`neural_fed_event_dismissed_<data>`) e não reabre sozinha pelo resto do
dia. Botão do Header continua existindo pra abertura manual.

`tsc --noEmit`: os únicos 3 erros nos arquivos tocados já existiam antes
da sessão (confirmado comparando com `git stash`/tsc antes-depois) — 2 em
`App.tsx` (tipos legados de `View`/`User`), 1 em `NeuralEventCenter.tsx`
(import `/utils/supabase/info`, mesmo padrão usado em vários outros
componentes do projeto). Nenhum erro novo.

## 5. Aviso do horário da decisão + IA "atenta a oportunidades"

Cleber pediu: **"O usuário precisa ser avisado que às 3 da tarde terá
divulgação da taxa de juros... a LLM tem que estar atenta a
oportunidades nesse horário."**

Como isso parecia contradizer o gate de FOMC que BLOQUEIA entrada nova
20min antes/60min depois do evento (implementado horas antes, no mesmo
dia, pra proteger contra whipsaw — mesmo motivo do corte que derrubou
acerto 80%→33% em 2026-09-04), perguntei ao Cleber antes de mexer. Ele
escolheu explicitamente: **manter o gate, só reforçar o contexto** (não
afrouxar a trava de segurança).

Implementado:
- **Banner novo no Dashboard** (`HighImpactEventBanner.tsx`) — avisa o
  usuário sobre qualquer evento de alto impacto (USD, importance≥3) do
  dia, usando o mesmo endpoint real `/economic-calendar` já usado no
  resto do app (nunca hardcoded, vale pra hoje e pra qualquer dia
  futuro). Aparece de 3h antes até 30min depois do horário, dispensável
  por evento (`sessionStorage`/estado local, não volta pro mesmo evento
  na mesma aba).
- **Reforço no prompt do LLM Brain** (`agent.ts`, bloco
  `economicCalendarBlock`) — deixa explícito que a trava mecânica cobre
  só a janela do anúncio em si; fora dela (antes/depois), a IA deve
  seguir avaliando ativamente, com confluência reforçada (nunca menos),
  sem deixar passar um movimento real por cautela excessiva.

`tsc --noEmit` limpo nos dois lados (motor + frontend), mesmo ruído
pré-existente de sempre, nenhum erro novo.

## Pendências reais

1. **`git commit` de tudo isto** — nenhum commit foi feito por mim (regra
   fixa do projeto). Comandos entregues ao Cleber em 2 blocos separados
   (fix do gate de contra-tendência já reiniciado ao vivo; banner +
   ajuste de prompt do Fed ainda não commitados nem reiniciados).
2. **`./restart.sh` do banner/prompt do Fed** — só o fix do gate de
   contra-tendência foi reiniciado até agora (pedido explícito do
   Cleber). O reforço de `agent.ts` sobre "atenta a oportunidades" ainda
   não está rodando ao vivo, precisa de restart novo.
3. **Confirmar visualmente perto de 15h/15h30 Brasília**: (a) se a janela
   do Fed abre sozinha 30min antes e o vídeo realmente toca (não
   confirmado dentro do app, só testado standalone); (b) se o banner de
   aviso aparece no Dashboard; (c) observar se a trava de contra-tendência
   nova está barrando de verdade o padrão "1 fator sozinho" nas próximas
   entradas do LLM Brain, e se o reforço de contexto evita paralisia
   excessiva fora da janela travada.
4. Sem validação estatística ainda pro fix do gate de contra-tendência —
   é correção de buraco mecânico real (não alegação de edge novo),
   precisa de amostra rodando pra confirmar que o padrão "volume alto
   sozinho" parou de passar.
