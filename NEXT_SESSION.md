# Handoff — próxima sessão

> Reescrito em **2026-08-16** (fim do dia, 5ª parte). **Regra: este arquivo é
> handoff da sessão CORRENTE. Reescreva, não empilhe.**

## ▶ COMECE AQUI — Cleber escolheu aprofundar arbitragem estatística (a); resultado agora é NEGATIVO E CONCLUSIVO, frente fechada

Plano completo (5 frentes) em
**[SESSAO_2026-08-16_REDESENHO_CEREBRO_E_SETUP.md](SESSAO_2026-08-16_REDESENHO_CEREBRO_E_SETUP.md)**.
Execução e medição dos itens 1, 2 e 4 (incluindo pesquisa sobre como
Renaissance/Two Sigma/market makers operam, e o que disso é aplicável aqui)
em **[SESSAO_2026-08-16_EXECUCAO_SCORE_TIMEFRAME_ARBITRAGEM.md](SESSAO_2026-08-16_EXECUCAO_SCORE_TIMEFRAME_ARBITRAGEM.md)**.

**Novidade desta parte**: rodada de sensibilidade de parâmetros com DSR
(item (a) escolhido pelo Cleber, respondendo a pergunta que ficou em aberto
no item 4). 18 configurações (janela de OLS, z de entrada, z de saída) ×
6 pares × 2 timeframes = 216 backtests, DSR aplicado por par sobre a melhor
config usando as 18 tentativas como correção de seleção. **Nenhum par passa
perto do piso de DSR 95%** — melhor caso é 54,6% (US30/NAS100 1h). Resultado
mais forte que o anterior: não é mais "inconclusivo por falta de sensibilidade
de parâmetro", é negativo mesmo dando 18 chances de calibração por par.
Detalhe: addendum no fim de
`research/experiments/2026-08-16-statistical-arbitrage/results/README.md`,
script `pairsSensitivity.ts`, tabela `pairs_sensitivity_summary.md`.

**Decisão**: não prosseguir com arbitragem estatística nestes
pares/timeframes/método sem dado genuinamente novo (instrumentos do mesmo
mercado — hoje indisponível via MetaAPI). Frente (a) está fechada.

### Próximo passo real: voltar pro Cleber com (b) e (c)

Com (a) agora também fechado, restam as outras duas opções levantadas no
fim da parte anterior — abrir a próxima sessão perguntando qual seguir, não
assumindo:

- **(b) Retestar score contínuo (item 1) com abordagem diferente** — pesos
  não-uniformes por bloco, ou score só como critério de DESEMPATE
  multi-setup (mantendo o gate binário como piso de qualidade, não
  substituindo-o).
- **(c) Reconsiderar a meta de ~10 trades/dia** — com TA clássico (julho),
  score contínuo (item 1) E arbitragem estatística (item 4, agora com
  sensibilidade testada) todos sem edge promovível, vale nomear
  explicitamente que a meta de frequência pode ser incompatível com a
  disciplina anti-fabricação de edge do projeto (ver `CLAUDE.md`,
  "Convenções do projeto").

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
