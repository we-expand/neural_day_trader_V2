# Sessão 2026-09-23 (noite) — IA "sem inteligência de mercado": conselho, veto de SHORT, teste do método do Cleber

## Gatilho
2 SHORTs seguidos da IA tomaram stop (BTC 17:33 BRT -$3,01; ETH 18:00 BRT -$6,28), com dia -2,3%/-2,8%. Cleber (trader) leu
que depois das 17h, com o dia já caído, o mercado costuma respirar e subir — e o preço confirmou (BTC/ETH subiram forte após 18:15/19:00).

## Achados
- A regra das 16:34 (`maioria-3-leituras-v1`) fazia a variação do dia VOTAR a favor de seguir a queda — oposto do dado.
- Snapshot entregava 2 medidas de volume contraditórias (`volumeElevated=true` × `volumeLabel=BAIXO`); o LLM 4B citou a que combinava com a narrativa (também citou estocástico "cruzou" com NEUTRO). Não corrigido ainda.
- As perdas grandes do dia (USDTWD -$65/-$65/-$27, BTC -$52...) foram ORDENS MANUAIS da boleta (~-$209), não da IA (~-$9). O teto de perda diária (-$144) foi consumido por elas e travou a IA às 17:23. Separar P&L manual × IA no relatório: pendente.
- Últimos 14 dias, só IA: ~5,9/5,1/7,2 trades por dia (dia/noite/madrugada), acerto 40%/35%/42%, líquido -$37/-$99/-$77. A IA já opera ~18/dia; o problema é qualidade, não quantidade. Cleber propôs teto 6/3/7 por período — NÃO implementado (escolheu só o veto).

## Conselho (llm-council: 5 conselheiros + 3 revisores + chairman)
Unânime: tirar dia% do voto, veto de SHORT no código (não no prompt), unificar volume, congelar depois. Revisores derrubaram o t inflado
do 1º teste; refeito. Sobre "70% de acerto → subir contratos": não — decidir por expectativa líquida (R após custo) em 150-300 trades só da IA,
aumentar lote em degraus (≤¼ Kelly). Acerto alto sem payoff não prova nada (02/09: 80% e perdeu; scalp testado: 65% e perde).

## Código (working tree, NÃO commitado por mim)
- `llm-active-brain/src/atr.ts`: dia% sai do voto de `computeMarketDirection` (veredito = 5m + 1H concordando, 1H veta).
- `llm-active-brain/src/tools.ts`: veto SHORT em BTCUSD/BTCXBN/ETHUSD/XETUSD, 17h-20h BRT, dia ≤ -2%, log `[VETO-EXAUSTAO]`;
  `directionRule: "5m-1h-sem-dia-v2"`.
- `llm-active-brain/.env` (fora do git): `MT5_VOLUME_ELEVATED_RATIO` 1.0 → 0.6 (pedido do Cleber, sem validação; janela 17h-00h usa 0.42, inalterada).
- `npm run validate`: 37 asserções ok, "3 etapas falharam" — as MESMAS 3 falham sem as minhas mudanças (pré-existentes, não investigadas).
- Motor NÃO reiniciado. Nada vale até `./restart.sh`.

## Testes do método do Cleber
Ver [research/experiments/2026-09-23-metodo-do-cleber/verdict.md](research/experiments/2026-09-23-metodo-do-cleber/verdict.md).
Resumo: só o veto de SHORT passou. Cruzamento estocástico, MACD+1H, scalp de alvo curto e rompimento de Fibonacci (1H, com 4 tipos de
confirmação) ficam em ~zero ou negativo líquido em 2-3 anos de BTC/ETH.

## Pendências
1. `git commit` de atr.ts/tools.ts + pasta de pesquisa + este arquivo (comando entregue), depois `./restart.sh` — só o Cleber decide.
2. Congelamento reinicia no commit: 5 dias úteis / 40 trades da IA sem mudar mecânica. Critério do veto: com ≥20 `[VETO-EXAUSTAO]`,
   se o SHORT bloqueado teria acertado >50% (stop/alvo 1×ATR 1H, 4h), o veto sai.
3. Unificar `volumeElevated`/`volumeLabel` (fonte única) — não feito.
4. Separar P&L manual × IA (e tirar manuais do teto de perda diária da IA?) — decisão do Cleber.
5. Testar BNB/altcoins e as médias 9/20/200 antes de estender o veto ou criar regra nova.
6. Cleber vai enviar relatos de entradas em que ganhou (horário + motivo) — agrupar e testar antes de virar fato pra IA.
