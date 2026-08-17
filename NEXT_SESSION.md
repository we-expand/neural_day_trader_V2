# Handoff — próxima sessão

> Reescrito em **2026-08-16** (fim do dia, 8ª parte). **Regra: este arquivo é
> handoff da sessão CORRENTE. Reescreva, não empilhe.**

## ▶ COMECE AQUI — item 5 (redesenho do painel) implementado em v1; achado importante pendente de investigação separada

**Painel redesenhado** (`AITrader.tsx`, modo ENGINEER): toggle
Simples/Avançado. Modo Simples (novo padrão) mostra 3 cards de "Perfil de
Risco" (Conservador/Moderado/Agressivo, `src/app/data/riskProfiles.ts`) que
mapeiam pra preset+cesta+timeframe+risco JÁ VALIDADOS como positivos em 1h
(dado real, `taxa_base.json`), com "atividade esperada" em trades/dia e %
líquido/trade — faixas medidas, não promessa. Modo Avançado preserva 100%
do controle manual anterior (preset/timeframe/cesta livres). Verificado no
browser (preview local): os 2 modos renderizam, seleção de perfil propaga
config corretamente pro modo avançado, sem erros de console além de
CORS/403 pré-existentes do ambiente de preview sem sessão Supabase.
`npm run validate` e `tsc` (mesmos 3 erros pré-existentes, não relacionados)
passaram. Screenshot não anexado ao repo — conferir ao vivo se necessário.

**Deliberadamente SEM valor em $ no painel** — só %. Motivo: achado durante
esta sessão, `TradeSizing.ts:203` tem `minTradeCapital = 10` (piso de US$10
por trade), que numa conta de US$50 (aporte mínimo do produto) pode forçar
posição bem maior que o risco% configurado pretendia. **Task espelhada
pendente** (`task_adca57ed`, "Investigar piso de US$10/trade em contas de
US$50") — mede com dado real se o desvio é sistemático antes de decidir
correção. Resolver isso é pré-requisito pra o painel poder mostrar $ com
confiança (hoje mostraria precisão falsa).

## Contexto anterior (resumo — meta de 10/dia fechada, teto real é 2-6/dia)

**(c) medida nesta parte, resultado claro**: mesmo somando toda a cesta de 9
ativos × todos os 5 presets (multi-setup hipotético, não implementado hoje),
sem afrouxar nenhum critério, o teto real fica em **2-6 trades/dia**, nunca
perto de 10 — e todo cenário com frequência mais alta (5m/15m) tem líquido
fortemente negativo (custo consome o volume). Detalhe completo, com tabela:
`research/experiments/2026-08-16-portfolio-amplitude/results/README.md`,
script `aggregate.ts` (reusa dado já medido em `2026-08-05-taxa-base`, não é
busca de edge nova). **Próximo passo real: Cleber escolher o número final da
meta revisada** (recomendação: 2-5/dia dependendo do perfil de risco) — só
depois disso faz sentido seguir pro item 5 do plano (redesenho do painel,
"atividade esperada" honesta).

## Seção anterior (contexto — (a) e (b) fechadas nesta sessão, ambas negativas)

Plano completo (5 frentes) em
**[SESSAO_2026-08-16_REDESENHO_CEREBRO_E_SETUP.md](SESSAO_2026-08-16_REDESENHO_CEREBRO_E_SETUP.md)**.
Execução e medição dos itens 1, 2 e 4 (incluindo pesquisa sobre como
Renaissance/Two Sigma/market makers operam, e o que disso é aplicável aqui)
em **[SESSAO_2026-08-16_EXECUCAO_SCORE_TIMEFRAME_ARBITRAGEM.md](SESSAO_2026-08-16_EXECUCAO_SCORE_TIMEFRAME_ARBITRAGEM.md)**.

**(a) Arbitragem estatística — FECHADA, negativa.** Sensibilidade de
parâmetros com DSR (18 configs × 6 pares × 2 tf = 216 backtests): nenhum par
passa perto do piso de DSR 95%, melhor caso 54,6%. Não é mais "inconclusivo
por calibração" — é negativo mesmo com 18 chances de calibração por par.
Detalhe: addendum em
`research/experiments/2026-08-16-statistical-arbitrage/results/README.md`.

**(b) Score contínuo com pesos não-uniformes — FECHADA, negativa.** Grade de
pesos (90/10 a 10/90) escolhida só em treino (60% inicial de cada série),
validada congelada em teste (40% final, dado nunca visto na escolha) — mesma
disciplina de walk-forward do resto do projeto. Em nenhum dos 4 presets com
2 blocos de entrada o peso escolhido bate o gate binário na maioria dos
combos de teste (vitórias vs. gate: 3/16 a 7/16, sempre minoria). O problema
não é o peso relativo entre blocos — é a ideia de piso médio permitir passar
setup que o gate binário rejeitaria. Detalhe: addendum em
`research/experiments/2026-08-16-score-vs-gate/results/README.md`.

### Próximo passo real: só restam opções de escopo grande — decisão do Cleber

Das 3 alternativas do item 2 (score), só sobra a alternativa 3 (score como
DESEMPATE entre setups concorrendo pelo mesmo capital) — e essa mecânica de
"múltiplos setups concorrendo" **não existe ainda no motor**, então testar
exigiria construir essa peça primeiro (escopo grande, não é mais uma medição
rápida em dado já em cache). Arbitragem estatística (a) só reabriria com dado
genuinamente novo (instrumentos do mesmo mercado, hoje fora do MetaAPI).

Com TA clássico (julho), score contínuo (pesos iguais E não-uniformes) e
arbitragem estatística (config única E sensibilidade) todos negativos, a
pergunta de fundo que ficou adiada duas sessões seguidas volta à mesa —
próxima sessão deve abrir com ela, não assumir mais nenhum código:

- **(c) Reconsiderar a meta de ~10 trades/dia.** Toda frente de "achar mais
  edge pra sustentar mais frequência" testada até agora deu negativo. Vale
  nomear explicitamente se a meta de frequência é incompatível com a
  disciplina anti-fabricação de edge do projeto (ver `CLAUDE.md`,
  "Convenções do projeto") — e se sim, qual é a meta de frequência realista
  dado o cérebro é de execução/disciplina, não de alfa (decisão já registrada
  em `CLAUDE.md`, seção "Cérebro de decisão da IA").
- **Construir a mecânica de multi-setup concorrente** (pré-requisito da
  alternativa 3 do item 2) — só vale se o Cleber achar que score-como-
  desempate ainda tem chance real de ajudar, dado que o resto do redesenho
  não rendeu.

### Estado dos 5 itens

1. **Score contínuo multi-bloco** — implementado e testado
   (`StrategyEvaluator.ts`, `__validate__score__.ts`), mas **medição deu
   resultado NEGATIVO** (piora o resultado líquido em todo piso testado vs.
   gate binário atual). Não ligado em produção. Detalhe:
   `research/experiments/2026-08-16-score-vs-gate/results/README.md`.
2. **Migração de timeframe padrão pra 15m/1h** — **feito**, sem
   controvérsia (só 2 fallbacks defensivos ainda caíam em `'1m'`, corrigidos
   em `useApexLogic.ts:1477` e `:1656`).
3. **Ligar Bloco C (Kelly) como teto de risco** — **bloqueado**: só 3 trades
   fechados reais no sistema, `MIN_SAMPLE_EXPECTANCY = 30`. Sem mudança
   possível até acumular amostra.
4. **Reabrir Trilho 2 (arbitragem estatística)** — medido, **resultado
   NEGATIVO mas inconclusivo** (9 de 12 combinações perdem, mas não dá pra
   distinguir "ideia errada" de "calibração errada" — falta sensibilidade de
   parâmetros e pares de instrumento mais próximos). Detalhe:
   `research/experiments/2026-08-16-statistical-arbitrage/results/README.md`.
5. **Redesenho do painel de configuração de IA** — **bloqueado**, depende do
   item 1 madurecer (não vingou).

### Próximo passo real: decisão de direção com o Cleber, não código

Com 3 de 5 frentes medidas e nenhuma com resultado positivo promovível,
próxima sessão deve abrir perguntando ao Cleber qual caminho seguir, não
assumindo:

- ~~(a) Aprofundar arbitragem estatística~~ — **feito nesta sessão, resultado
  NEGATIVO e agora conclusivo** (sensibilidade de parâmetros com DSR, ver
  seção "COMECE AQUI" acima). Frente fechada.
- **(b) Retestar item 1 com abordagem diferente** — pesos não-uniformes por
  bloco, ou score contínuo só como critério de DESEMPATE multi-setup
  (mantendo o gate binário como piso de qualidade, não substituindo-o).
- **(c) Reconsiderar a meta de ~10 trades/dia** — pode ser incompatível com
  a disciplina anti-fabricação de edge que o projeto sempre seguiu (ver
  `CLAUDE.md`, "Convenções do projeto"). Cada frente testada até agora (TA
  clássico em julho, score contínuo, arbitragem estatística) deu negativo —
  vale nomear isso explicitamente na próxima conversa com o Cleber.

Não iniciar (b) sem essa conversa — é escopo grande o bastante pra merecer
alinhamento antes de codar.

## Sessão de calibração do runner ainda ativa

Sessão `41378b46-2a7d-4155-bde0-b3b099df6c1a` (preset 5, 1m, cooldown 5min)
continua RUNNING — decisão do Cleber em 16/08 foi deixar como está. A
migração de default (item 2) NÃO afeta sessões já em andamento, só novas sem
`config.timeframe` definido — essa sessão específica continua em 1m até o
Cleber decidir parar/reconfigurar. Não é bug — não investigar
`CANDLES_FETCH_FAILED` de novo sem necessidade (causa já documentada em
sessão anterior).

## Runner em produção — estado herdado (2026-08-07, ainda válido)

`ai-runner` (Supabase Edge Function) deployado, `pg_cron` ativo (`jobid=3`,
`ai-runner-tick`, `* * * * *`). Rodando sozinho contra o banco real desde
07-08. Nada mudou nesse ponto nesta sessão.
