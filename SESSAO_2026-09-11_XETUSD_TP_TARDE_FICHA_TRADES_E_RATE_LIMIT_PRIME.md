# Sessão 2026-09-11 (tarde) — XETUSD "passou do alvo", ficha de trades pós-restart, e rate-limit da MetaAPI

## Contexto

Continuação do dia (ver `CLAUDE.md`, itens de madrugada: fix de cache de
sessão do fallback bootstrap + suspensão do fechamento discricionário
AI_SIGNAL + trava de indicador stale). Sessão ativa: `ai_sessions.id =
649295b1-3e08-4168-b4d2-437948d7a708` (`LLM_ACTIVE_BRAIN_MT5`, RUNNING,
iniciada 2026-09-11 08:17:31 UTC — mesmo restart da madrugada).

## 1) "XETUSD passou do alvo e continuou subindo" — investigado, resolvido sozinho

Cleber reportou pelo Gráfico: candle com pavio até 2.514,36 muito acima do
alvo (2.464,02) de uma posição LONG aberta (entrada 2.452,98), posição
ainda mostrando só +$1,05 de lucro.

**Investigação em duas etapas**:

- **1ª leitura (no momento do relato)**: confirmado via `ai_brain_activity_log`
  que toda cotação REAL recebida pelo motor até aquele instante ficou entre
  ~$2.452 e ~$2.475 — nunca perto de $2.514. `mfe_usd` do trade era só
  $1,24. As duas últimas consultas ao símbolo vieram com aviso
  `"Cotação de XETUSD temporariamente indisponível (endpoint
  lento/rate-limited/off)"`, caindo no fallback do último preço conhecido
  ($2.455,90) — o mesmo número "desatualizado" no cabeçalho do Gráfico.
  Conclusão da 1ª leitura: o pavio de 2.514 parecia dado ruim do endpoint
  de histórico de velas (glitch já catalogado antes no projeto), não preço
  real — watchdog de alvo/stop não teria "perdido" nada porque o preço real
  nunca chegou lá.
- **Correção depois, com dado novo**: minutos depois, consultado de novo o
  banco — a posição **já tinha fechado por TP de verdade**, saída
  mecânica em **$2.510,45**, `net_pnl +$20,67`, `mfe_usd` também $20,67.
  O preço real ACABOU chegando lá — não era só ruído, era o feed
  temporariamente atrasado (rate-limited) que se recuperou e o watchdog
  agiu corretamente assim que voltou a ver cotação fresca.

**Conclusão final**: não houve falha do mecanismo de saída. O watchdog
(`enforceMt5StopsAndTargets`, roda a cada 3s) fechou certo assim que teve
cotação real — o atraso era só o feed da MetaAPI compartilhada, que já é
risco crônico conhecido do projeto (ver seção 3 abaixo, ação tomada nesta
mesma sessão).

## 2) Ficha completa dos trades desde o restart da madrugada

Pedido do Cleber: percentual de acerto e ficha de todos os trades desde
que a sessão foi reiniciada. Ele achava que eram só 3 — na verdade já
eram 9 fechados + 1 aberto no momento da consulta.

| # | Ativo | Lado | Entrada | Saída | Motivo | PnL líquido | Resultado |
|---|---|---|---|---|---|---|---|
| 1 | UK100 | LONG | 10.655,91 | 10.661,61 | AI_SIGNAL | +$0,57 | ✅ |
| 2 | XETUSD | SHORT | 2.465,11 | 2.458,12 | SL | +$0,77 | ✅ (stop já protegia lucro) |
| 3 | UKOUSD | SHORT | 104,92 | 104,631 | AI_SIGNAL | +$2,89 | ✅ |
| 4 | UK100 | LONG | 10.674,40 | 10.680,10 | AI_SIGNAL | +$0,28 | ✅ |
| 5 | LNKUSD | SHORT | 11,282 | 11,379 | AI_SIGNAL | −$0,10 | ❌ |
| 6 | BTCUSD | SHORT | 76.784,00 | 77.011,61 | AI_SIGNAL | −$2,28 | ❌ |
| 7 | UKOUSD | LONG (parcial 40%) | 104,761 | 105,216 | TP parcial | +$1,82 | ✅ |
| 8 | UKOUSD | LONG (resto) | 104,761 | 104,850 | SL | +$0,53 | ✅ (protegido por breakeven pós-parcial) |
| 9 | XETUSD | LONG | 2.452,98 | 2.510,45 | TP | +$20,67 | ✅ |
| — | BTCUSD | LONG | 78.035,13 | aberto | — | (flutuante) | em andamento |

**Percentual de acerto (9 fechados)**: 7 vitórias / 2 derrotas = **77,8%**.
**PnL líquido acumulado (fechados)**: **+$25,15**.

**Leitura honesta (sem inflar)**: o resultado está puxado por 1 trade só
(XETUSD, +$20,67 = 82% de todo o lucro). Tirando ele, os outros 8 somam
+$4,48, com payoff médio (ganho médio $1,14 vs perda média $1,19) quase
1:1 — amostra pequena demais (9 trades) pra qualquer conclusão de edge.
Continua valendo o protocolo já registrado no `CLAUDE.md`: **5 dias
úteis OU 40 trades fechados** sob os 2 fixes de madrugada, sem mexer em
mais nada de mecânica no período, critério de sucesso payoff >1,0:1 E
acerto ≥45% sustentados.

## 3) Rate-limit da MetaAPI — achado real e corrigido (infra, não mecânica)

Cleber reportou rate-limit "no apelido do MetaTrader" e pediu mitigação.
Confirmado no log (`llm-active-brain/llm-brain.log`): 48 ocorrências
recentes de `"endpoint lento/rate-limited/off"`, espalhadas por GER40,
UK100, XAUUSD, SOLUSD, EURUSD, UKOUSD, NAS100, XETUSD, SPX500, LNKUSD —
não é 1 símbolo específico, é rate-limit da conta inteira.

**Causa real encontrada**: `index.ts` (`runContinuous`) chamava
`primeQuotes(MT5_ASSET_BASKET)` — o array FIXO de **28 símbolos**
(universo possível), todo ciclo (~a cada 10s) — mesmo a cesta REAL do
usuário (`ai_user_config.activeAssets`) tendo só **11 ativos**. Isso
fazia o endpoint compartilhado da MetaAPI buscar quase 3x mais símbolos
por ciclo do que qualquer sessão de fato usava.

**Fix aplicado** (`llm-active-brain/src/index.ts`): `primeQuotes` agora
recebe a UNIÃO das cestas efetivas de cada sessão elegível
(`session.userConfig.activeAssets`) + símbolos com posição aberta fora da
cesta (mesma exceção já existente em `get_mt5_quote`/`tools.ts`, pra não
deixar de cotar uma posição herdada de uma cesta antiga) — em vez do
array fixo de 28. Reduz a carga por ciclo pro que realmente importa (hoje
11-12 símbolos, não 28). `tsc --noEmit` limpo, sem erro novo.

**Isto é infraestrutura pura, não mexe em nenhum parâmetro de risco/
mecânica de trading** — não interfere no protocolo de validação de 5
dias/40 trades em andamento (item 2 acima).

**Pendente**: `git commit` (comando entregue ao Cleber, eu não commito
sozinho — regra fixa do projeto) + `./restart.sh` (dentro de
`llm-active-brain/`) pra aplicar. Não precisa parar/resetar o teste de
validação — é troca de infra, não de mecânica. Sem medição ainda de
quanto isso reduz a taxa de rate-limit de fato — avaliar observando o
log após o restart.
