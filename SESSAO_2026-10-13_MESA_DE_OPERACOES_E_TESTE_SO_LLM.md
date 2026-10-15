# Sessão 2026-10-12 → 13: diagnóstico das perdas, stop com feed congelado, Mesa de Operações e teste só-LLM

> Registro estruturado da conversa (não é transcrição literal): o que foi pedido, o que foi medido, o que
> foi decidido, o que está no código e o que ainda falta. Números são os medidos no dia; onde houve
> aproximação, está dito.
>
> **Estado ao encerrar (13/10, ~16:30 BRT):** parte do código está **só no disco** (sem commit e sem
> restart). Ver "Pendente" no fim. O monitoramento automático foi **desarmado** a pedido do Cleber.

## 1. O pedido que abriu a sessão
O Cleber relatou que a LLM só perdia há ~2 dias, que um stop não foi respeitado, e pediu mudança urgente
sem esperar as 100 entradas do congelamento de 07/10. Regra dele: **o produto precisa operar qualquer
ativo (petróleo inclusive); não se resolve a performance cortando ativos da cesta.** Ele opera há anos e
avaliou que a IA "não é uma trader sênior": não lê estocástico/MACD, entra em sobrecompra/sobrevenda, vende
na mínima do dia, monta alvos que não se alcançam.

## 2. Diagnóstico (dados reais, Supabase)
- Trades fechados 06→12/10 por dia (líquido): 06/10 -10,30; 07/10 -2,25; 08/10 -24,17; 11/10 +2,23; 12/10 +0,17.
  Os dois últimos dias não perderam; o prejuízo forte foi 08/10.
- UKOUSD foi o maior ralo (~-$34 em 5 dias). Cleber **rejeitou** tirá-lo da cesta.
- **Causa do "stop furado":** o feed MetaAPI do UKOUSD ficou **congelado ~3 h** em 109,029 (acima do stop
  108,92) enquanto o preço real foi a ~108,45. O watchdog comparava o stop contra o tick velho. Perda
  efetiva -$9,24 contra ~-$4 que o stop daria (custo da falha ≈ $5).
- Desde 07/10 os **25 stops (média -$2,93) contra 8 alvos (média +$2,81)**: o ganho médio por alvo já é ~$3;
  o problema é a taxa de stops (76%) e o R:R das propostas, não o tamanho do ganho quando acerta.
- 11 de 25 trades recentes nunca andaram a favor (MFE ≈ 0); em 156 entradas desde 23/09 o resultado
  era ~-0,4R por trade, todos os baldes perdendo em média.

## 3. Correções feitas no motor (`llm-active-brain/`)
1. **Stop com tick obsoleto:** se o tick está velho, o watchdog confere o stop contra a **vela de 1m real**
   (`getLatestOneMinuteCandle`, `neuralBridge.ts`); sem vela recente, loga `SEM PROTECAO` em vez de calar.
2. **Trava de estocástico em extremo contra o lado** passou a valer para **todo setup** (era só REVERSAO).
   Rollback: `MT5_STOCH_EXTREME_GATE_ALL_SETUPS=false`.
3. **Extremo do dia:** veto de SHORT colado na mínima/LONG colado na máxima de 24h existe, mas por pedido do
   Cleber ("quero julgamento, não regra dura") ficou em **modo sombra** (`[SHADOW-EXTREMO-DIA]`);
   grava `dayRangePosition` no snapshot. `MT5_DAY_EXTREME_VETO_ENABLED=true` liga o bloqueio.
4. **Scalp "poucos pontos":** alvo limitado a % do preço (`MT5_SCALP_TARGET_MAX_PCT`; 0,29 → **0,35** no
   `.env`), **só o alvo** (stop intacto), lote acompanha o alvo menor (Cleber aceitou), gate de R:R com piso
   próprio para o caso (`MT5_SCALP_MIN_RR`=0,6).
5. **Alvo da venda dispara no preço do gráfico (bid)**, não no ask: o Cleber viu o gráfico "passar" o alvo
   pelo tamanho do spread (XETUSD). A saída continua paga ao preço real (ask). Captura menos pontos
   (~spread) mas o fechamento bate com a linha. (`neuralBridge.ts`)
6. **Raciocínio ligado no modelo principal:** `LLM_ENABLE_THINKING=true`, `LLM_MAX_TOKENS=12288`
   (`MT5`/agent configurável via `LLM_MAX_TOKENS`). No teste de 27/09 com 4096 tokens, 3 de 9 ciclos
   estouravam sem chamar ferramenta; com 12288: 0 ocorrências.
7. Modelo em uso: `nvidia/nemotron-3-super-120b-a12b` (hospedado NVIDIA NIM; não se ajusta de fora).

### Teste noturno 12→13/10 (Asia, 22:49 → 09:40)
460 tentativas de entrada, 8 viraram trade, 6 fechadas **todas perdedoras (-$18,13)**; 2 abertas sem proteção
por mercado de HK/China fechado. 59 bloqueios do validador por a IA **descrever o indicador errado**
("tendência de baixa" com dado lateral; "estocástico sobrecomprado" com dado neutro). Conclusão: o erro é de
**interpretação**, não de dado.

## 4. A Mesa de Operações (pedido do Cleber, inspirada no TradingAgents)
Pedido: time de agentes (notícias, fundamentalista, sentimento, técnico por tempo gráfico, comprador,
vendedor, trader sênior, equipe de risco, gestor de portfólio), debate, e um **Agente Master**; teste com as
travas mecânicas desligadas ("se falhar, a gente acrescenta as travas de volta").

**Arquivos novos:** `src/desk.ts` (orquestração), `src/deskReadings.ts` (leituras e vetos **puros**, por
código), `src/deskScoring.ts` (posturas, desfecho contrafactual, placar), `src/deskStore.ts` (Supabase +
job de desfecho), `METODO_DA_CASA.md` (critério do Cleber; **relido a cada deliberação, sem restart**),
`scripts/test-desk.ts` (47 testes), `scripts/desk-dry-run.ts` (ensaio sem abrir posição),
`scripts/desk-report.ts` (relatório por agente), `supabase/migrations/20260930_desk_decisions.sql`.

**Fluxo** (só depois de todas as checagens do `open_position`; ~16 chamadas, ~30–40 s): analistas →
debate comprador × vendedor (+ réplica) → Trader Sênior → risco agressivo/conservador + gestor de portfólio →
Gestor de Risco → **Agente Master** (APROVAR/REJEITAR, tamanho INTEIRO/METADE; **só restringe**, nunca
cria entrada nem aumenta tamanho). Falha da mesa = REJEITA. Rejeição bloqueia o mesmo ativo+lado por 10 min.
Depois do debate o motor **reconfere a cotação** e aborta se o preço andou > 50% da distância do stop.

**Princípio que se repetiu 4 vezes:** quando deixamos a IA *interpretar* algo, ela errou (posição no range
lida ao contrário; "neutro" onde havia sobrecompra; veto duro inventado). Em todos os casos a correção foi o
**código calcular a conclusão e entregá-la pronta**: `readStochastic`, `readMacd`, `readAverages`,
`readDayRange`, `readTargetRoom`, `computeHardVetoes`.

**Teste só-LLM:** `MT5_DESK_MODE=enforce` + `MT5_LLM_ONLY_TEST=true` (`.env` linhas ~285-289). As 31 travas de
julgamento de `open_position` passam por `gateResult()`: no modo normal recusam como sempre; no teste só
registram `[TRAVA-DESLIGADA] <nome>` e gravam em `bypassedGates`. **Continuam ativos:** IA ligada, cesta,
direção/fluxo/cadência do Setup, mercado fechado, cotação/feed/spread, 1 lado por ativo, lote, tetos físicos
da conta (risco 6%) e **todas as saídas** (stop/alvo/breakeven/trailing). Nunca vale com execução real ligada.
Conta é DEMO (`MT5_LIVE_EXECUTION_ENABLED=false`).

**Agentes técnicos:** primeiro por indicador (estocástico/MACD/médias, cada um em todos os tempos). O Cleber
pediu **um por tempo gráfico (5m, 15m, 1H)** e isso foi trocado (4H segue no placar e no veto de tempo maior).

### Vetos duros (calculados por código; só estes existem)
1. estocástico em extremo contra o lado em 5m/15m/1H (nunca vender em sobrevenda, nunca comprar em sobrecompra);
2. 1H **e** 4H os dois contra o lado; 3. colado no extremo do dia contra o lado; 4. alvo que não cabe antes do
próximo nível. Mais o veto do Gestor de Risco. Um ponto contra fora disso é **peso**, vira METADE, não veto.
Gatilhos válidos (basta um): cruzamento do estocástico em extremo; cruzamento em zona neutra + MACD; MACD
cruzando/virando + médias; retomada na média 9/20; candle a favor em nível (ver `METODO_DA_CASA.md`).

### Aprendizado contínuo (fase 1 e 2 construídas; 3 e 4 propostas)
Tabela `desk_decisions` (debate completo, posturas, desfecho) + job a cada 5 min que mede, com velas de 1m,
se o **alvo ou o stop** da proposta teria vindo primeiro (vale para aprovadas **e rejeitadas**, contrafactual,
sem spread, mesma vela = STOP). Relatório: `npx tsx scripts/desk-report.ts 12` (acerto por agente com IC95,
calibração da convicção do Master, o que cada trava desligada teria feito). **Nenhuma lição entra no prompt
sem aprovação do Cleber** (mercado é aleatório; amostra pequena é ruído). Fase 3 (Coach que propõe regras) e
fase 4 (casos parecidos no prompt) só com dezenas de decisões medidas. Longo prazo: ajuste fino (Unsloth,
Apache-2.0 no núcleo + partes AGPL a conferir; Mac M2 Pro 16 GB só comporta modelos de 1–4B).
Pesquisa GitHub: TradingAgents (110.981★), qlib, FinGPT, FinRL; ferramentas de treino unsloth, LlamaFactory,
trl, verl, peft. Conclusão: nenhum resolve a leitura de estocástico/MACD; vale só a ideia do debate.

## 5. Resultados do teste (13/10, ainda parciais, amostra pequena)
- **Fase 1 (14:37–15:59, regras rígidas, alvo 0,29%):** 25 deliberações, 25 rejeições, 0 aprovações.
  Desfechos medidos (n=5): 3 STOP (rejeição certa), 2 ALVO (ganho que ficou de fora), 3 expiraram, 2 sem dado.
  37 de 40 motivos citavam "falta de cruzamento do estocástico em extremo" → **eu tinha tornado esse evento
  raro uma condição obrigatória** + veto absoluto do Trader + "na dúvida, rejeita". Corrigido (ver abaixo).
- **Fase 2 (a partir de 15:59, regras com gatilhos válidos/METADE, alvo 0,35%):** rejeitou XETUSD SHORT com
  gatilho A válido por um "veto duro" **inventado**; depois **aprovou NAS100 LONG (METADE)** às 16:10:39 com
  alvo 0,143%/stop 0,463% (R:R 0,31:1; ganho bruto esperado $0,87 para arriscar $2,83) → "centavos".
  Causa: o alvo foi **encurtado** (regra que eu criei para o teste, piso 0,12%) e a trava de R:R mínimo
  estava desligada. Além disso o **estocástico 5m estava SOBRECOMPRADO (%K 81,9 sem cruzamento)** nesse
  instante (15m 58, 1H 62,5, 4H 47: neutros; reconstituído das velas, bate com o motor), e o analista de
  estocástico escreveu "todos em zona neutra": **leu errado o que o código entregou**.
- O motor lê o estocástico corretamente em **todos** os tempos (comparado com cálculo independente);
  não é só o 1H.
- Zero agentes sem resposta, zero ciclos travados por tamanho, zero `SEM PROTECAO` (fora do mercado fechado).

## 6. Correções posteriores a esses achados (**no disco, ainda sem commit/restart**)
- `computeHardVetoes` (vetos calculados por código; Trader e Master não podem criar vetos novos).
- Analistas por tempo gráfico (5m, 15m, 1H) no lugar dos por indicador; Trader/Master recebem os níveis prontos.
- **Piso de valor mecânico** (vale com a mesa ligada): R:R < `MT5_MIN_RR_ABSOLUTE` (0,5) é recusado; ganho
  líquido esperado no alvo (após tamanho, teto de risco, METADE e custo) < `MT5_MIN_EXPECTED_NET_REWARD_USD`
  (**1,00**) é recusado, antes da mesa (economiza as 16 chamadas) e de novo depois do corte para METADE.
- Piso do alvo encurtado no teste: `MT5_LLM_ONLY_MIN_TARGET_PCT` 0,12 → **0,20**.
- Ensaios (sem abrir posição) com o código novo: NAS100 LONG → vetado (estocástico 5m sobrecomprado + alvo
  não cabe); BTCUSD SHORT aprovado com METADE no ensaio anterior (gatilho A); XETUSD SHORT e FRA40 LONG
  vetados por vetos **reais** calculados.

## 7. Ainda em aberto
- **Os $3 por entrada:** o Cleber quer capturar em média ~$3 por entrada. Hoje o alvo captura em média
  **+$2,81 líquido** (8 alvos), mas há 25 stops a -$2,93. Com risco máx. 6% ($6 numa conta de $100) e R:R < 1,
  o ganho bruto máximo por entrada cheia fica em ~$4–5; METADE corta para ~$2. Decisão pendente: elevar o
  piso líquido para ~$2–3 e/ou `MT5_TARGET_REWARD_USD` (hoje 4,0) — mexe em risco/tamanho, não foi alterado.
- **Rótulo em dinheiro do alvo no gráfico** (frontend) mostra o valor bruto (+$4,37 vs líquido $2,75 no
  XETUSD): ajuste de tela não feito.
- **Primeiro ensaio da mesa** veio sem nenhum indicador (todos "sem dado"); causa não identificada
  (provável candle/feed transitório); a mesa rejeita nesse caso.
- XPDUSD e XAUGBP estão no Setup mas **não cadastrados** em `assetBasket.ts` (ignorados em silêncio).
- A visão `desk_agent_scorecard` usa as posturas antigas das primeiras linhas; o relatório em arquivo
  recalcula do debate gravado (fonte confiável).
- `ai_brain_activity_log` tem ~183 MB / 125 mil linhas, +~7,3 mil/dia, **sem retenção** (banco total 553 MB).
- claude-mem: observer estava deslogado; foi feito logout/login e reinício do worker (não confirmado
  que voltou a gravar).
- MetaAPI: réplica `backup-new-york` segue UNDEPLOYED (decisão do Cleber sobre ~$6,84/mês).

## 8. Pendente para o Cleber executar (Claude nunca commita nem reinicia sozinho)
1. **Commit** de `llm-active-brain/` (arquivos modificados: `src/config.ts`, `src/desk.ts`,
   `src/deskReadings.ts`, `src/tools.ts`, `scripts/test-desk.ts`) + este `.md`.
2. **`./restart.sh`** dentro de `llm-active-brain/` (sem isso o motor segue sem vetos por código,
   sem analistas por tempo gráfico e sem o piso de valor).
3. Decidir os $3 por entrada e o alvo do XETUSD no frontend.
4. Comandos úteis: `npx tsx scripts/test-desk.ts` (47 testes), `npx tsx scripts/desk-report.ts 12`,
   `npx tsx scripts/desk-dry-run.ts NAS100 LONG --llm-only`.

## 9. Critério combinado para decidir o teste (fixado antes do resultado)
- **Bom:** a mesa aprova algumas entradas e a maioria das aprovadas anda a favor, sem repetir o padrão
  "bate stop sem andar a favor".
- **Ruim → as travas voltam:** aprovadas que perdem como as de 12–13/10; ou rejeitar tudo por várias horas
  (alerta ~3 h sem aprovação, citando a proporção STOP/ALVO das rejeições); ou agentes falhando em série.
- Rollback total: `MT5_LLM_ONLY_TEST=false` (religa as 31 travas) e/ou `MT5_DESK_MODE=off`, depois restart.
- Com poucas entradas é sinal, não veredito. Nada aqui promete lucro.

---

# Adendo (13/10, tarde/noite): alvo líquido de $3–4, rótulo líquido no gráfico e veto de MACD 5m

> Commit e `./restart.sh` feitos pelo Cleber depois deste adendo. Os itens 3 e 4 da seção 8 acima estão resolvidos aqui.

## A. Pedido: capturar $3–4 por entrada e ajustar o rótulo do alvo
- **Rótulo do alvo no gráfico** (`src/app/components/ChartView.tsx`): passou a mostrar o ganho **líquido** do custo de
  ida e volta (`+$X líq.`), via `calculateRoundTripCost` (mesma fonte do P&L do Dashboard). Antes mostrava o bruto
  (ex.: +$4,37 contra $2,75 líquido no XETUSD). Só frontend, sem restart. Não conferido no navegador.
- **Por que $3–4 líquidos esbarravam no risco:** o lote mira ganho **bruto** de `MT5_TARGET_REWARD_USD` (era 4,0) e o custo
  tira ~$1,3, deixando ~$2,75. Com alvo 0,35% e stop ~0,46%, ganho bruto $4 já exige arriscar ~$5,3, perto do teto de
  6% ($6 em $100). Subir o ganho sem subir o teto faria o motor reduzir o lote ou recusar. METADE corta o ganho para ~$2.
- **Decisão do Cleber:** subir o teto de risco e o alvo (opção 1 proposta; o assistente tinha recomendado a opção 2, manter 6%,
  pelo critério do congelamento, e avisou que a perda por stop sobe).
  - `MT5_MAX_RISK_PCT_PER_TRADE` 0,06 → **0,08** ($8 em $100)
  - `MT5_TARGET_REWARD_USD` 4,0 → **5,5** (≈ $4 líquido em entrada cheia, ≈ $2 em METADE)
  - Aplicado no `.env` (ignorado pelo git, fica só nesta máquina) **e** nos defaults de `src/config.ts`; o valor canônico do
    aviso de governança de boot (`GOVERNANCE_CRITICAL_ENV_PARAMS`) foi atualizado para 0,08, evitando alarme falso.
  - Perda por stop passa a ~$7–8 (76% das saídas recentes foram stop). **Sem validação**; é decisão de capital do Cleber.

## B. Caso XETUSD LONG (19:22 UTC, 2511,33): a mesa entrou com o MACD virando
- Observação do Cleber: a IA não percebeu que o MACD já estava "virando paraquedas" e a entrada tende a perder.
- Auditoria (`ledger/desk_decisions.jsonl`): decisão APROVAR em METADE, convicção 55, gatilho **C = MACD 15m cruzou para cima**.
  O próprio Analista de MACD escreveu que **5m e 1H estavam "perdendo força"**, mas nada no código transformava isso em
  veto. Estocástico neutro em todos os tempos, 1H/4H sem alinhamento. Posição: preço 2508–2509, ganho máximo (MFE) $0.
- **Causa:** gatilho de tempo maior (15m) aceito mesmo com o MACD do 5m (tempo da entrada) já cansando no lado da compra.
- **Correção** (`src/deskReadings.ts`, `computeHardVetoes`): novo veto duro **`MACD_5M_ESGOTANDO`**, calculado por código:
  5m com `perdendoForca` e `vies` do lado da entrada (LONG com histograma positivo encolhendo; SHORT com negativo subindo)
  → rejeita. Não veta o lado oposto (compra cansando favorece vender). Cruzamento recente no 5m não conta como "perdendo força".
  - Restrito ao 5m; incluir o 15m seria uma linha, mas rejeita mais.
  - Teste novo em `scripts/test-desk.ts`; `npx tsx scripts/test-desk.ts`: **48 testes passam**; `tsc --noEmit` limpo.
  - A posição XETUSD já aberta não é afetada (veto só vale para entradas novas).
- **Risco do lado oposto:** o veto reduz aprovações. Critério já combinado: ~3 h sem aprovação = relaxar.

## C. Estado e acompanhamento
- Commit + restart: feitos. A partir daqui a mesa roda com o veto de MACD 5m, risco 8% e alvo bruto 5,5.
- Ler depois de algumas dezenas de decisões medidas: `npx tsx scripts/desk-report.ts 12`. Olhar especialmente (1) se
  as aprovadas andam a favor, (2) quantas rejeições vêm de `MACD_5M_ESGOTANDO` e o que teriam feito (contrafactual),
  (3) se a perda média por stop ficou em ~$7–8 e o ganho líquido por alvo em ~$3–4.
- Observação do log: XETUSD devolveu o mesmo preço várias vezes seguidas (aviso de possível feed travado, `mt5Broker`);
  já havia proteção por vela de 1m quando o tick congela, mas vale reconferir se persistir.
- Nada aqui promete lucro; subir o risco aumenta a perda por stop.

---

# Adendo 2 (14/10, madrugada): alvo por vela, piso de $3 líquidos, alvo de scalp 0,25% e gráfico lento

> Commits já feitos pelo Cleber: `ed0796e86` (alvo por vela + piso de $3) e `934e4b400` (docs). Pendentes de commit
> no fim desta sessão: `config.ts` (alvo 0,25%) e os dois timeouts de frontend. Acompanhamento de 30 em 30 min foi
> armado e **suspenso a pedido do Cleber** antes de terminar.

## A. Saúde do motor (00:06) e trades da noite
Motor vivo, instância única, zero `SEM PROTECAO`/circuit breaker. Mesa: 49 deliberações desde o restart, 47
rejeições e 2 aprovações (BTCUSD LONG 20:45 UTC, NAS100 SHORT 23:06 UTC, ambas METADE). 2 timeouts da mesa em
XETUSD SHORT. ~4 h sem aprovação (passou do alerta de 3 h; rejeições vinham de vetos reais por código).
Trades desde 16:52 UTC: líquido ≈ -$0,52 (XETUSD SHORT TP +2,75; NAS100 LONG TP +0,76; XETUSD LONG manual -2,10;
BTCUSD LONG SL -1,38; NAS100 SHORT SL -0,55).

## B. "Bateu o alvo e não recolheu" + número do alvo não conferia (XETUSD LONG)
- Entrada 2512,56, alvo 2518,30, pavio no gráfico até 2520,51; fechou só às 03:33 UTC a 2518,54 (net $1,33: bruto
  $2,63 menos custo $1,30). Rótulo do gráfico mostrava +$2,53 (bruto), a boleta mostrava líquido (+$0,67).
- Causa 1: watchdog só comparava o alvo com o tick pontual; pavio entre dois ticks não era visto.
- Causa 2: a aba do Cleber estava com build antigo (rótulo sem "líq."); o código já mostrava líquido (`84915ab9e`).
- **Correção:** `neuralBridge.ts` (`enforceMt5StopsAndTargets`) agora olha as velas de 1m reais desde a entrada
  (`getOneMinuteCandlesSince`, `atr.ts`). Se a máxima (LONG) / mínima (SHORT) cruzou o alvo, fecha como TP **no
  preço do alvo**. Se a mesma janela cruzou o stop atual, não decide por vela (ordem desconhecida; fica com o tick,
  que trata o stop primeiro). A vela que contém o instante da entrada fica de fora.
- Princípio do Cleber: **a plataforma tem que ser cristalina; o valor que o usuário vê tem que ser o que cai no
  caixa.** Fechar no preço do alvo e rotular em líquido são as duas pontas disso. Ideia aberta: mostrar também
  "bruto − custo = líquido" no rótulo.

## C. Piso de ganho líquido proporcional ao caixa
- Pedido: **no mínimo US$3 líquidos (já descontada a comissão) por operação para cada US$100 em caixa,
  proporcional ao saldo.**
- `config.ts`: `mt5ReferenceCapitalUsd` (100) e `mt5MinNetRewardPerReferenceUsd` (3). `tools.ts`: piso =
  `max(mt5MinExpectedNetRewardUsd, 3 × saldo/100)` sobre `(bruto no alvo − estimateCommissionUsd)`; o alvo bruto de
  referência (`MT5_TARGET_REWARD_USD` 5,5) agora escala com `saldo/100`. O piso vale também com a mesa desligada
  (o piso de R:R continua só com a mesa).
- Consequências conhecidas: a aprovação em METADE na prática vira rejeição (a metade rende ~$2,1 líquidos e é
  recusada depois do corte); o teto de risco de 8% pode bloquear entradas com stop largo; o piso garante o
  **projetado**, o realizado só chega a $3 se o alvo for atingido (76% das saídas recentes foram stop).
- Incidente: o primeiro restart (00:43:32) ocorreu 6 s **antes** de eu salvar `tools.ts`/`config.ts` (00:43:38), então
  o processo carregou o código antigo (JPN225 SHORT e NAS100 SHORT abertos com líquido < $3). Novo restart às
  00:45:10 carregou o código novo.

## D. Alvo de scalp menor, mesmo stop (opção A)
Cleber achou os alvos grandes demais e preferiu alvo menor com mais contratos. Escolhida a opção A:
`MT5_SCALP_TARGET_MAX_PCT` 0,35 → **0,25** (`.env` e default de `config.ts`); stop e teto de risco (8%) intocados.
Lote sobe sozinho (lote = alvo bruto ÷ (alvo% × preço)). Trade-off dito ao Cleber: stop > ~0,4% vai esbarrar no
teto de risco e ser recusado pelo piso de $3; R:R com stop 0,5% fica em 0,5:1 (piso). **Falta restart** para valer.
Olhar depois: nº de recusas `[PISO-DE-VALOR]`, taxa de alvos atingidos (hoje 8 de 33) e perda média por stop (~$7–8).

## E. Gráfico do NAS100 não abria
Backend OK mas lento: `/mt5-candles-history` 5,7–14,4 s por chamada (janela não importa, piso ~5,7 s); SPX500 estourou
25 s; `/mt5-prices` 4,5 s com variação +0,33% correta. Relay mostra Londres com `timed out waiting for connection
status` (instabilidade MetaAPI na conta compartilhada). Na tela: spinner "Carregando candles" e variação +0,00%
(timeouts do cliente: candles 15 s, preço 8 s). **Correção só de frontend:** candles 15 → 30 s
(`market-service.ts`), preço único 8 → 20 s (`RealMarketDataService.ts`). Cleber confirmou: "demorou, mas carregou".
Causa de fundo (MetaAPI lenta / carga do motor na mesma conta) não resolvida; reduzir consultas do motor é opção
aberta, não feita.

## F. Pendente
1. Commit de `llm-active-brain/src/config.ts` (alvo 0,25%) e dos 2 arquivos de frontend (timeouts).
2. `./restart.sh` em `llm-active-brain/` para o alvo de 0,25% (o piso de $3 e o alvo por vela já estão rodando).
3. Conferir no navegador o rótulo líquido do alvo (hard refresh) e os timeouts novos depois do deploy da Vercel.
4. Ler `npx tsx scripts/desk-report.ts 12` quando houver dezenas de decisões medidas.
5. Ainda em aberto da seção 7: XPDUSD/XAUGBP fora de `assetBasket.ts`, retenção de `ai_brain_activity_log`,
   réplica MetaAPI `backup-new-york` UNDEPLOYED.
