# Handoff — próxima sessão

> Reescrito em **2026-08-16** (fim do dia, 4ª parte). **Regra: este arquivo é
> handoff da sessão CORRENTE. Reescreva, não empilhe.**

## ▶ COMECE AQUI — 3 de 5 frentes do redesenho medidas, nenhuma promovível ainda, decisão de direção pendente

Plano completo (5 frentes) em
**[SESSAO_2026-08-16_REDESENHO_CEREBRO_E_SETUP.md](SESSAO_2026-08-16_REDESENHO_CEREBRO_E_SETUP.md)**.
Execução e medição dos itens 1, 2 e 4 (incluindo pesquisa sobre como
Renaissance/Two Sigma/market makers operam, e o que disso é aplicável aqui)
em **[SESSAO_2026-08-16_EXECUCAO_SCORE_TIMEFRAME_ARBITRAGEM.md](SESSAO_2026-08-16_EXECUCAO_SCORE_TIMEFRAME_ARBITRAGEM.md)**
— leia os dois antes de continuar esta frente.

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

- **(a) Aprofundar arbitragem estatística** (item 4) — é a mais promissora,
  por não ter fechado a porta como as outras. Precisaria de: sensibilidade
  de parâmetros com correção estatística (DSR), pares de instrumento mais
  próximos (mesmo mercado — hoje MetaAPI não oferece isso), e avaliar se o
  custo de CFD de varejo permite esse tipo de estratégia independente da
  calibração.
- **(b) Retestar item 1 com abordagem diferente** — pesos não-uniformes por
  bloco, ou score contínuo só como critério de DESEMPATE multi-setup
  (mantendo o gate binário como piso de qualidade, não substituindo-o).
- **(c) Reconsiderar a meta de ~10 trades/dia** — pode ser incompatível com
  a disciplina anti-fabricação de edge que o projeto sempre seguiu (ver
  `CLAUDE.md`, "Convenções do projeto"). Vale nomear isso explicitamente se
  as frentes (a)/(b) também não renderem.

Não iniciar nenhuma das 3 sem essa conversa — cada uma é escopo grande o
bastante pra merecer alinhamento antes de codar.

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
