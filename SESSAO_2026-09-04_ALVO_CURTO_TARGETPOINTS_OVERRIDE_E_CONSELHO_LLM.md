# Sessão 2026-09-04 — Alvo curto (targetPoints override), balanço de 8 dias, conselho sobre frequência e bug real de R:R invertido

## Contexto do pedido

Cleber pediu monitoramento contínuo do LLM Brain (5 em 5min), com foco em fazer o
motor "perder pouco quando perde, ganhar muito quando ganha" de forma exponencial.
No meio da sessão, 3 mensagens em sequência: "a IA não está abrindo posições",
"chame o conselho pra resolver essa equação", "a LLM tem que operar mais do que
está operando" — e depois uma instrução direta e concreta: "o alvo tem que ser
maior que o stop, o stop continua do jeito que está (com 5 pontos), o alvo tem
que ser de 13-15".

**Importante**: nenhum monitoramento recorrente automático (`/loop`, cron,
wakeup agendado) foi armado nesta sessão — toda a investigação e os fixes
abaixo foram ações pontuais dentro desta mesma conversa, não um processo em
background. Não havia nada pra desarmar ao final.

## 1. "IA não abre posição" — falso alarme, não era bug

Rastreado no `llm-brain.log` (processo reiniciado hoje às 13:52 -03, PID 89344):
ciclo 1 teve cotação completa (trend/MACD/estocástico/S&R/candlePatterns/regime)
pros 4 ativos da cesta (XETUSD, GER40, SPX500, NAS100). Ciclos 2 e 3, TODAS as
cotações vieram `stale:true` com tudo nulo — mensagem "Cotação indisponível
depois de retry".

Testado direto contra os endpoints reais (curl, POST igual ao código):
- **Lote com os 4 símbolos juntos** (`/mt5-prices`, igual `fetchTicks` faz):
  HTTP 504 pros 4, ~15,7s até desistir.
- **Cada símbolo individual**: todos os 4 (+ EURUSD, XAUUSD, BTCUSD, UKOUSD)
  responderam normal, 3,5-8,4s, preço real.
- **Ciclo 4** (log real, sem nenhuma intervenção) já veio com dado completo e
  fresco pros 4 símbolos — confirma que foi rate-limit transitório da conta
  MetaAPI compartilhada (~90s), não bug estrutural. Depois disso o motor ficou
  seletivo (sem confluência forte o suficiente pra abrir), comportamento
  correto, não travamento.

Nenhuma mudança de código feita por causa disso.

## 2. Balanço quantitativo de 8 dias (pedido do Cleber)

Query direta no Supabase (`ai_trades`, sessões `strategy_name='LLM_ACTIVE_BRAIN_MT5'`,
agrupado por dia em `America/Sao_Paulo`):

| Dia | Trades | Win% | PnL líq | Avg Win | Avg Loss | Payoff (win/loss) |
|---|---|---|---|---|---|---|
| 09-04 | 17 | 35.3% | -29.43 | 1.99 | -3.76 | 0.53 |
| 09-03 | 11 | 36.4% | -21.50 | 1.68 | -4.03 | 0.42 |
| 09-02 | 15 | 80.0% | +7.01 | 1.73 | -4.57 | 0.38 |
| 09-01 | 9 | 55.6% | +24.22 | 6.79 | -2.44 | 2.78 |
| 08-31 | 18 | 38.9% | +1.55 | 1.20 | -0.62 | 1.94 |
| 08-30 | 95 | 8.4% | -183.95 | 5.56 | -2.63 | 2.11 |
| 08-29 | 232 | 37.9% | -163.70 | 0.47 | -1.52 | 0.31 |
| 08-28 | 23 | 13.0% | +1.99 | 1.08 | -0.09 | 12.0 |

Total: 420 trades, -$363,81 líquido, win rate global ~31,7%.

**Achado 1** (payoff invertido): na maioria dos dias o payoff está abaixo de 1
(perde mais do que ganha por trade), o oposto do objetivo declarado.

**Achado 2** (frequência × resultado): os 2 piores dias em PnL absoluto (08-29:
232 trades/-163,70; 08-30: 95 trades/-183,95) foram os de MAIOR frequência —
correlação negativa nesta amostra, contrária ao pedido de "operar mais". Ressalva
honesta: dias diferentes rodaram infra/modelo diferentes (pré-migração Ollama em
alguns), não é comparação perfeitamente controlada.

**Achado 3** (exit_reason, últimos 4 dias): hoje, saídas "SL" (n=7, win_rate
14,3%, PnL médio -4,44) dominam o prejuízo do dia; só 2 trades bateram TP puro
(médio +4,40) — quase 1:1 apesar do R:R nominal teoricamente maior.

## 3. Causa raiz real do "alvo curto": `targetPoints="POUCOS"` sobrepondo o R:R do código

`tools.ts` (`open_position`) calcula o multiplicador de R:R assim:
```
rrMultiplier = session.userConfig?.targetPoints != null
  ? RR_BY_TARGET_POINTS[targetPoints]   // POUCOS:1.5, MÉDIO:3, MUITOS:5
  : config.mt5TakeProfitAtrMultiplier / config.mt5TargetReferenceStopAtrMultiplier  // ~3.7 hoje
```
A sessão ativa do Cleber tinha `userConfig.targetPoints = "POUCOS"` (visto no log,
`ai_user_config` no Supabase) — isso SEMPRE vencia e colapsava o R:R real pra
**1,5:1**, não importa quanto os commits do próprio dia (`7931a502c`, desacoplar
alvo do stop) tentassem configurar um R:R maior. Achado de padrão já catalogado
neste projeto: config no Supabase sobrepõe silenciosamente ajuste feito no código.

**Corrigido**: `UPDATE ai_user_config SET config = jsonb_set(config, '{targetPoints}',
'"MÉDIO"')` pro usuário `aeb3ec15-...` — R:R sobe pra 3:1 (dentro da faixa
13-15/5≈2,6-3:1 pedida pelo Cleber). Stop **não foi tocado**, conforme pedido
explícito ("o stop continua do jeito que está"). Mudança de config via SQL, sem
commit/deploy/restart — efeito imediato (config lida a cada ciclo). **Risco
conhecido**: se alguma aba do app estiver aberta, o `useApexLogic.ts` resalva
`aiConfig` inteiro a cada mudança de estado e pode sobrescrever essa correção com
o valor antigo em memória (mesmo bug catalogado na sessão 2026-09-02) — orientar
Cleber a fechar/recarregar abas.

## 4. Conselho (llm-council) sobre "operar mais" vs disciplina estatística

Pergunta levada ao conselho: como equilibrar "a LLM tem que operar mais" com a
pesquisa histórica deste projeto que não achou edge de sinal técnico comprovado,
dado que nesta amostra mais frequência correlacionou com pior resultado?

**Veredito resumido** (5 advisors + peer review + síntese):
- **Consenso**: não mexer em mais nenhum parâmetro agora — R:R 3:1 acabou de
  mudar hoje, zero amostra rodando com ele; empilhar outra mudança (trailing)
  em cima tornaria impossível atribuir causa depois. "Operar mais" não tem
  base nos dados atuais — os 2 piores dias foram os de mais trades.
- **Divergência**: Expansionist defendeu subir pra R:R 4:1-5:1 usando os
  melhores dias (08-28, 09-01) como prova — peer review pegou isso como viés
  de seleção clássico em amostra de 8 dias (cherry-picking).
- **Achado mais valioso da revisão cruzada**: `increase_position` (pyramiding,
  implementado 2026-09-02 especificamente pra "ganhar muito quando ganha")
  **nunca disparou em nenhum dos últimos 5 dias** — confirmado via SQL
  (`pyramid_adds_count` sempre 0) e grep no log (zero chamadas da ferramenta).
  A ferramenta está registrada corretamente em `tools.ts`/`agent.ts` (não é bug
  de registro) — hipótese mais provável é que as condições de disparo (lucro
  real acima do spread + confluência técnica ainda válida, sem exaustão) raramente
  se alinham, dado que a maioria dos trades reverte antes de acumular lucro
  suficiente. **Não investigado a fundo nesta sessão — próximo passo real.**
- Outros achados do peer review, não aplicados ainda: custo/spread pode
  escalar desproporcionalmente em dias de alta frequência numa conta de $100;
  os 8 dias da amostra coincidem com vários bugs de infra sendo corrigidos ao
  vivo (rate-limit, fuso do dailyLossLimit, cesta oscilando) — não é um
  experimento limpo; hipótese de bug de reentrada nos dias de 95-232 trades
  não foi descartada (pode ser modo de falha específico, não "frequência é
  sempre ruim" como lei geral).

**Decisão tomada**: não mexer em mais nada além do `targetPoints`. Trailing real
em uso é `MT5_TRAIL_ATR_MULTIPLIER=1.6` (`.env`) — os comentários do código
documentam intenção de 0.8x, mas isso nunca foi ambíguo em runtime (`.env`
sempre vence); decidido **não alinhar agora** pra não introduzir uma segunda
variável de mudança na mesma janela de leitura do efeito do R:R 3:1.

## 5. Bug real de código encontrado e corrigido (depois do balanço/conselho acima)

Cleber mandou print de uma posição real (SPX500 LONG, entrada 7725,18) mostrando
exatamente o oposto do pedido: **stop de 23,18 pts, alvo de só 7,33 pts — R:R
0,32:1** (perde 3x mais do que ganha). Isso abriu **depois** da correção do
`targetPoints` (16:35 UTC), então não era o bug do Setup — era um bug de
código diferente.

**Causa raiz real**: em `tools.ts` (`open_position`), existe um gate de R:R
mínimo (`mt5MinRrAfterSrCap`) que rejeita a entrada se o alvo capado por
suporte/resistência ficar pequeno demais — **mas esse gate só roda DENTRO do
bloco condicional do cap de S/R**. Neste trade real, o alvo pequeno não veio
do cap de S/R (confirmado matematicamente: o alvo bruto por ATR já nascia
pequeno, provavelmente porque o STOP foi alargado pela margem de segurança de
spread — `minStopForSpread`/`mt5SpreadStopSafetyMultiplier` — sem que o
cálculo do alvo (que usa uma referência de ATR fixa, `mt5TargetReferenceStopAtrMultiplier`)
acompanhasse esse alargamento). Como o cap de S/R nunca chegou a disparar
(o alvo já estava pequeno antes dele), o gate de R:R mínimo nunca via o
problema — a entrada abria com risco/retorno pior que aleatório, sem
nenhuma trava pegando.

**Fix aplicado** (`llm-active-brain/src/tools.ts`, logo após o bloco do cap
de S/R): checagem final e INCONDICIONAL — `takeProfitPct < stopPct *
mt5MinRrAfterSrCap` — que cobre qualquer causa (S/R, spread alargando o
stop, ATR minúsculo, fallback), não só o caminho do cap de S/R. `tsc
--noEmit` limpo (0 erros) no `llm-active-brain`, `npm run validate` do motor
mecânico principal 37/37 (não relacionado, gate geral do repo).

**Aplicado ao vivo**: processo reiniciado (matei o `tsx src/index.ts`, o
`watchdog.sh` — já rodando como supervisor — religou sozinho em ~5s, 1 único
processo confirmado depois). De carona: o próprio motor já tinha fechado a
posição SPX500 ruim manualmente por invalidação técnica (trend BAIXA, MACD
negativo) ANTES do restart — saiu a `-$0,53`, bem menor que o stop cheio
(`-$1,62` teórico) — exemplo real do gerenciamento de perda funcionando,
mesmo com o R:R de entrada ruim daquele trade específico.

## Pendências reais em aberto

1. **Commit do diff em `tools.ts`** (fix do gate de R:R incondicional) —
   comando pronto entregue ao Cleber, não commitado (regra do projeto: Claude
   nunca commita sozinho).
2. **Deixar rodar 3-5 dias só com R:R 3:1** (+ o fix de gate novo) antes de
   qualquer novo ajuste de parâmetro — nenhuma mudança adicional pendente
   desta sessão além do commit acima.
3. **Investigar por que `increase_position` nunca dispara** — auditar as
   condições de gate (lucro > spread, fator técnico alinhado, sem exaustão no
   Estocástico) contra o padrão real de excursão favorável dos trades recentes.
4. Decidir depois se `MT5_TRAIL_ATR_MULTIPLIER` deve ir pra 0.8x (intenção do
   código) ou ficar em 1.6x (valor real testado) — só depois de ter leitura
   limpa do efeito do R:R 3:1 sozinho.
5. Confirmar se os dias de 232/95 trades (08-29/08-30) foram escolha real do
   motor ou reentrada em loop — não descartado nesta sessão.
6. Observar os próximos trades pra confirmar que o gate de R:R incondicional
   (item 5 acima) está de fato rejeitando entradas ruins ao vivo, não só
   teoricamente.

## Fechamento da sessão

Nenhum monitoramento automático recorrente foi deixado rodando (nada a
desarmar). Estado final: processo do motor rodando (1 único, PID confirmado),
com o fix do gate de R:R já carregado; config `targetPoints="MÉDIO"` ativa no
Supabase; commit do código pendente do Cleber. Handoff completo é este
arquivo; resumo de 1 parágrafo linkando aqui está no topo do
[CLAUDE.md](CLAUDE.md).
