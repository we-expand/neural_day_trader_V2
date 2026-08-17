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

### Próximo passo obrigatório

**Nada dos 5 itens foi implementado ainda.** A sessão de 16/08 já deixou a
especificação técnica do item 1 pronta (seção "Especificação técnica do item
1" no arquivo acima) — começar direto por:

1. Adicionar `scoreFn` por tipo de bloco em
   [StrategyEvaluator.ts:187](src/app/services/strategy/StrategyEvaluator.ts:187)
   (hoje é gate binário — `entryHits === activeEntry.length` na linha 211),
   com `__validate__.ts` novo cobrindo casos determinísticos.
2. Medir score contínuo vs. gate atual nos dados reais já em cache
   (`research/experiments/2026-08-05-taxa-base/data/`, 15m/1h) — **não
   promover pra produção sem essa medição.**
3. Só depois, ligar em `runTradingCycle.ts` + runner Deno.

As 3 perguntas em aberto foram respondidas pelo Cleber em 2026-08-16 (detalhe
na seção "Perguntas em aberto — respondidas" do arquivo da sessão): piso de
score só depois do backtest do item 2 (não chutar), desempate multi-setup =
maior score vence, pesos por bloco = iguais no início. Pode começar direto no
passo 1 da spec técnica.

## Sessão de calibração do runner ainda ativa

Sessão `41378b46-2a7d-4155-bde0-b3b099df6c1a` (preset 5, 1m, cooldown 5min)
continua RUNNING — decisão do Cleber em 16/08 foi deixar como está por
enquanto. Com o achado desta sessão (scalp 1m inviável por custo), ela vai
continuar gerando poucos ou nenhum trade até a migração de timeframe (item 2
do plano) acontecer. Não é bug, é esperado — não investigar CANDLES_FETCH_FAILED
de novo sem necessidade (causa já documentada na sessão anterior).

## Runner em produção — estado herdado (2026-08-07, ainda válido)

`ai-runner` (Supabase Edge Function) deployado, `pg_cron` ativo (`jobid=3`,
`ai-runner-tick`, `* * * * *`). Rodando sozinho contra o banco real desde
07-08. Nada mudou nesse ponto nesta sessão.
