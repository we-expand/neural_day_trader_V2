# Handoff — próxima sessão

> Reescrito em **2026-08-16** (3ª parte do dia). **Regra: este arquivo é
> handoff da sessão CORRENTE. Reescreva, não empilhe.**

## ▶ COMECE AQUI — redesenho do cérebro pra frequência real, plano pronto, zero código ainda

Cleber pediu consultoria: o cérebro está parado (3 trades reais em ~1 semana,
meta é ~10/dia) e ele quer um redesenho completo — cérebro eficiente,
protegendo capital, mas operando com frequência real. Diagnóstico +
consultoria + plano de 5 frentes estão em
**[SESSAO_2026-08-16_REDESENHO_CEREBRO_E_SETUP.md](SESSAO_2026-08-16_REDESENHO_CEREBRO_E_SETUP.md)**
— leia ele antes de codar qualquer coisa nesta frente.

Resumo do que já foi medido/decidido nesta sessão:

1. **Causa raiz de "zero trade" já não é mistério**: medi com dado real de 1m
   (não mais ATR instantâneo) que o custo round-trip consome 165%-1900% do
   movimento típico de 1 minuto em 5 dos 6 ativos da sessão de calibração —
   scalp de 1m é inviável por matemática, não por gate mal calibrado. Detalhe
   em `research/experiments/2026-08-16-scalp-cost-gate-calibration/`.
2. **Achado importante pro plano**: `ExpectancyEngine.ts` (Kelly honesto,
   Bloco C do cérebro cognitivo) já existe e está validado desde 31/07, mas
   nunca foi ligado em `runTradingCycle.ts`. Blocos D/E (revenge, tail risk)
   estão ligados; C não. Não ligar às pressas: exige `n≥30` trades fechados
   reais pra ficar confiável, e o sistema inteiro tem 3 hoje — ligar agora
   não muda nada, só telemetria.
3. **Plano de 5 frentes** (ordem de dependência, detalhe no arquivo da
   sessão): (1) motor de score contínuo multi-setup/multi-ativo — é o que
   resolve frequência de verdade, sem afrouxar nenhum gate; (2) migrar
   timeframe operacional padrão pra 15m/1h (1m vira só modo teste); (3) ligar
   Bloco C como TETO de risco (nunca alavanca — só pode reduzir posição
   abaixo do configurado, nunca aumentar), bloqueado até (1)-(2) gerarem
   amostra; (4) reabrir Trilho 2 (busca de edge em dado estruturalmente
   diferente — sugestão: funding rate + order flow de cripto); (5) redesenho
   do painel de configuração de IA do usuário (trocar preset único por
   "perfil de risco", mostrar atividade esperada calculada do funil real em
   vez de silêncio, trocar timeframe único por "horizonte operacional").

### Item 1 e 2 do plano — feitos nesta sessão, com achado negativo importante

1. **Item 1 (infraestrutura de score) implementado e testado.** `scoreBlock`
   + `evaluateStrategyScoreAt` em
   [StrategyEvaluator.ts:132](src/app/services/strategy/StrategyEvaluator.ts:132)
   — score 0-100 por bloco (ABOVE/BELOW/BETWEEN/RISING/FALLING continuam
   booleanos 100/0; CROSS_ABOVE/CROSS_BELOW ganham gradação por recência).
   `evaluateStrategyAt` (gate binário) **não foi alterado** — continua sendo
   o único caminho em produção. 16 casos determinísticos em
   `src/app/services/strategy/__validate__score__.ts`, registrado em
   `npm run validate` (gate 100% verde).
2. **Item 2 (medição) feito — resultado NEGATIVO, não promover.** Comparei
   score contínuo (pesos iguais, pisos 40/50/60/70) vs. gate binário atual,
   mesmo dado real em cache (`2026-08-05-taxa-base/data/`, 15m/1h, 80
   combinações preset×ativo×TF), mesmo motor de saída, mesmo CostModel.ts —
   script em `research/experiments/2026-08-16-score-vs-gate/`. **Em todo
   piso testado, o score contínuo perde do gate binário na maioria das
   combinações** (47-53 de 80) e o resultado líquido médio piora (-3 a -19
   pontos percentuais), mesmo nos pisos que já se aproximam da frequência do
   gate. Detalhe completo, hipótese do porquê, e alternativas ainda não
   testadas em
   `research/experiments/2026-08-16-score-vs-gate/results/README.md`.

**Decisão**: NÃO ligar score contínuo em `runTradingCycle.ts`/runner Deno
nesta forma — a hipótese "pesos iguais + piso simples resolve frequência"
não se sustentou na medição. Isso não invalida a infraestrutura do item 1
(fica pronta pra reuso), mas o item 3 original do plano de 5 frentes (ligar
Bloco C) segue sem novo motivo pra avançar, e a frente de frequência
(item 1 do plano) precisa de uma nova hipótese antes de tentar de novo — ver
as 3 alternativas não testadas na seção "Decisão" do README acima (pesos
não-uniformes, piso >70, ou score só como desempate multi-setup mantendo o
gate binário como piso de qualidade).

As 3 perguntas em aberto foram respondidas pelo Cleber em 2026-08-16 (detalhe
na seção "Perguntas em aberto — respondidas" do arquivo da sessão): piso de
score só depois do backtest (medido acima, resultado negativo), desempate
multi-setup = maior score vence, pesos por bloco = iguais no início (medido
acima — é justamente essa escolha que não funcionou).

### Item 2 do plano — feito nesta sessão (migração de timeframe padrão)

Investigação prévia (agente Explore) mostrou que a maior parte do código já
estava em `'15m'`/`'1h'` como default — o `aiConfig.timeframe` global em
[useApexLogic.ts:276](src/app/hooks/useApexLogic.ts:276) já era `'15m'`, os
adapters de dado não tinham `'1m'` hardcoded como fallback próprio, e o
runner Deno (`ai-runner/index.ts`) já cai pra `'5m'` se `tf` vier vazio. Os
pontos reais que ainda regrediam pra `'1m'` eram 2 fallbacks defensivos em
[useApexLogic.ts:1477](src/app/hooks/useApexLogic.ts:1477) e
[:1656](src/app/hooks/useApexLogic.ts:1656) (`configRef.current.timeframe ||
'1m'`), usados só quando `config.timeframe` vem `undefined`/falsy ao iniciar
sessão — corrigidos pra `'15m'`. `'1m'` continua no tipo `Timeframe` e nos
seletores de UI ([AITrader.tsx:1023](src/app/components/AITrader.tsx:1023),
[AITradingEngine.tsx:119](src/app/components/AITradingEngine.tsx:119)) —
é modo de teste manual, não deve ser removido, só não é mais o default em
nenhum caminho. Adicionei tooltip no botão `1m` de ambos os seletores
avisando que o custo consome a maior parte do movimento e que é só pra teste.
Nenhuma migration de banco necessária (`ai_sessions.timeframe` é `text` livre,
sem CHECK constraint). `npm run validate` verde, dev server sobe sem erro de
build.

### Item 4 do plano — feito nesta sessão (reabertura do Trilho 2, arbitragem estatística)

Motivado pela consultoria/pesquisa desta sessão sobre Renaissance/Two
Sigma/market makers (achado real: o "segredo" deles não é 1 indicador, é
relação estatística entre MUITOS instrumentos — ver seção de pesquisa acima
no histórico do chat, não repetida aqui). Medi cointegração/pairs trading
(spread mean-reverting via OLS trailing + z-score) em 6 pares × 2 timeframes
(15m/1h), parâmetros fixos não otimizados, custo real nas 2 pernas. Script e
dado em `research/experiments/2026-08-16-statistical-arbitrage/`.

**Resultado: sem edge robusto.** 9 de 12 combinações perdem dinheiro líquido
de custo; as 3 positivas têm amostra pequena (35-84 trades) e edge por trade
quase zero (0,01%-0,03%) — consistente com ruído, sem correção por múltiplos
testes aplicada (12 combinações testadas). O par "clássico" de cointegração
em commodities (`XAUUSD/XAGUSD`) foi o PIOR resultado (-25,47% líquido,
win rate 28,9%) — não é confirmação de viés de manual de curso. Detalhe
completo, 3 hipóteses do porquê, e o que faltaria pra testar de verdade (não
fechar a porta como o Trilho 1) em
`research/experiments/2026-08-16-statistical-arbitrage/results/README.md`.

**Decisão**: não implementar em produção com esta configuração. Diferente do
item 2 (score contínuo, onde a causa parece ser a abordagem em si),
aqui não dá pra saber se é "a ideia não funciona" ou "esta calibração
específica não funciona" — falta sensibilidade de parâmetros com correção
estatística, pares de instrumento mais próximos (mesmo mercado, não
índices/commodities cross-região), e considerar que o custo de CFD de varejo
pode simplesmente não deixar margem pra esse tipo de estratégia,
independente da qualidade do sinal.

**Item 1, 2 e 4 do plano de 5 frentes estão concluídos (nenhum produziu
resultado promovível a produção).** Restam: item 3 (ligar Bloco C, ainda
bloqueado por falta de amostra — n=3 trades reais hoje), item 5 (redesenho
do painel, ainda bloqueado — depende do item 1 madurecer, que teve resultado
negativo). Com 3 de 5 frentes medidas e nenhuma com resultado positivo
promovível, a conversa necessária pra próxima sessão é com o Cleber: decidir
se aprofunda alguma das 3 (retestar arbitragem estatística com mais rigor é
a mais promissora, por não ter fechado a porta como as outras 2) ou se muda
de direção.

## Sessão de calibração do runner ainda ativa

Sessão `41378b46-2a7d-4155-bde0-b3b099df6c1a` (preset 5, 1m, cooldown 5min)
continua RUNNING — decisão do Cleber em 16/08 foi deixar como está por
enquanto. A migração de default nesta sessão NÃO afeta sessões já em
andamento (só novas sessões sem `config.timeframe` definido) — essa sessão
específica continua em 1m até o Cleber decidir parar/reconfigurar. Não é bug,
é esperado — não investigar CANDLES_FETCH_FAILED de novo sem necessidade
(causa já documentada na sessão anterior).

## Runner em produção — estado herdado (2026-08-07, ainda válido)

`ai-runner` (Supabase Edge Function) deployado, `pg_cron` ativo (`jobid=3`,
`ai-runner-tick`, `* * * * *`). Rodando sozinho contra o banco real desde
07-08. Nada mudou nesse ponto nesta sessão.
