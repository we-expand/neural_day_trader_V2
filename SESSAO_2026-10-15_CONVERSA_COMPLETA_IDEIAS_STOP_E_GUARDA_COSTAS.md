# Sessão 2026-10-15 — Registro da conversa (ideias fora da caixa, stop por pavio, guarda-costas)

Registro de toda a conversa de 14→15/10/2026 entre o Cleber e o Claude. Continua a
[SESSAO_2026-10-14_AFROUXAMENTO_DA_MESA_E_METODO_DA_CASA.md](SESSAO_2026-10-14_AFROUXAMENTO_DA_MESA_E_METODO_DA_CASA.md)
(Partes 1 a 6 lá). Este arquivo é a cronologia; os detalhes técnicos estão na Parte 5 e 6 daquele.

## 1. Leitura da sessão anterior (Partes 1-3)
Resumo pedido pelo Cleber: afrouxamento da mesa (piso proporcional ao corte METADE, `ALVO_NAO_CABE` e `TEMPO_MAIOR_CONTRA`
deixam de ser veto duro), regras novas do método (estocástico com estado, rompimento = modo expansão, notícias, médias,
Fibonacci), corredor de Fibonacci, modo expansão ao vivo, notícias a cada 2 min, bug do método lido só até 4.000
caracteres. Pendências: commit, restart, decisões sobre alerta de choque, aviso na tela e reentrada/reforço.

## 2. Média de 9 com custo e em índices — o "achado forte" caiu
- O teste de 14/10 (toque na média de 9 em expansão = 69-73%) usava a EMA9/ATR da PRÓPRIA vela do toque (olhava o futuro).
- Refeito sem vazamento, com custo, em BTC/ETH/SOL e Nikkei/S&P/Nasdaq/DAX: 47-53% (cripto) e 30-45% (índices) de alvo antes do
  stop, resultado líquido NEGATIVO em tudo. `METODO_DA_CASA.md`, `CLAUDE.md` e a sessão corrigidos (só o número, nenhuma regra).
- Script: `llm-active-brain/scripts/ma-touch-cost-backtest.ts`. O `ma-touch-backtest.ts` antigo tem o vazamento: não usar.

## 3. As 5 ideias "fora da caixa" (todas executadas, nenhuma trouxe vantagem nova)
1. **Guarda-costas da boleta manual** (`src/app/services/risk/manualOrderGuard.ts` + `OrderTicket.tsx`): bloqueia por perda diária;
   pede confirmação ("Enviar mesmo assim") para: sem stop, risco acima do limite, lado oposto no mesmo ativo, estocástico 5m/1H
   contra a regra 5, custo ≥ 20% do alvo, horário de spread caro. Grava em `manual_order_guard_log`
   (migration `20261015_manual_order_guard_log.sql`, **pendente de aplicar**).
2. **Momento intradiário** (Gao, Han, Li, Zhou 2018): sem efeito em S&P/Nasdaq/DAX/Nikkei (2024-2026, com custo). Reversão do Nikkei
   (hipótese D, registrada antes) **reprovada no cofre** (líquido 0, t = -0,03).
3. **Custo por hora** (Infinox, `market_spread_samples`): NAS100 0,003%, ouro 0,004%, SPX500 0,006%, EURUSD 0,009%, JPN225 0,010%;
   BTC 0,067%, XETUSD 0,103%, UKOUSD 0,106%; alts de cripto 0,3% a 11%; janela 17h-21h BRT: DAX 8x, UK100 10x, AUS200 6x.
4. **Motor de backtest sem futuro + cofre** (`llm-active-brain/scripts/lib/harness.ts`): a "canária" recusa estratégia que muda de
   decisão quando o futuro some; últimos 6 meses trancados (`ABRIR_COFRE=1`, cada abertura registrada).
5. **Entradas manuais com vantagem?** 29 entradas manuais desde 01/09 (-$433, dominado pela semana de 21/09: -$458; sem ela
   19 entradas, +$25). IA: 572 entradas, ~37% de ganhos, -$374, média entre -0,08R e -0,50R em TODAS as semanas.
- Cartão de tarefa proposto (não iniciado): controle aleatório (IA vs sorteio com as mesmas saídas e custos).

## 4. Meta do projeto e medidas na LLM (resposta do Claude)
- Meta do Cleber: ganhar muito e perder pouco, US$10/dia, lançar só com ~75% de acerto ganhando muito.
- Claude: acerto alto e ganho grande brigam entre si; US$10/dia é questão de capital (~$12-18 mil a 20-30%/ano), não de IA;
  critério de lançamento proposto: E[R] líquido positivo (t > 2) em 150-300 entradas fora da amostra + teto de queda + chance de
  quebra < 1%.
- Medidas sugeridas para a LLM: escolher de um cardápio de setups calculados por código; ignorar a confiança declarada (85,3% nas
  vencedoras vs 84,3% nas perdedoras); esconder o nome do ativo no prompt; cesta pelo custo; linha de base de sorteio.
- Fontes: Glasserman & Lin (arXiv 2309.17322), StockBench (2510.02209), FINSABER (2505.07078), Xiong et al. (2306.13063).

## 5. A entrada do Cleber no SPX500 ("falta malícia na IA")
- SHORT manual a 7.697,55 (01:20 BRT): dia de queda -1,53% (CPI), 2H/4H em modo de venda; repique do 5m às médias/suporte rompido
  (7.699-7.701); vendeu antes do estocástico do 5m virar, com o 1H em sobrevenda. Registrada no `diario-do-cleber.jsonl` como
  leitura INFERIDA (a confirmar).
- A IA não olhou: motor preso no ciclo 1 por 7 erros de conexão com a NVIDIA (recuperou sozinho depois). Mesmo olhando, as regras
  escritas dela (regra 5 + veto de 1H em sobrevenda) vetariam.
- Regra candidata (pendente de confirmação do Cleber e de medição): em dia de queda com 2H/4H em modo de venda, repique do 5m até as
  médias/suporte rompido é lugar de VENDA.

## 6. Reforço sistemático no corredor ("vai bater no degrau, é hora de carregar")
- `llm-active-brain/src/expansionAuto.ts`, ligado em `agent.ts`: a cada ciclo, para posição a favor de corredor em expansão que
  andou `MT5_EXPANSION_SPACING_PCT` (0,15%) a favor, chama o próprio `increase_position` (todas as travas valem; máx. 2 reforços;
  stop em breakeven a cada reforço). Desliga com `MT5_EXPANSION_AUTO_REINFORCE=false`. Já commitado pelo Cleber.
- Aviso mantido: o Fibonacci não mostrou vantagem sobre o acaso (72-84% contra 74-77%).

## 7. O episódio do "stop furado" (e os erros do Claude no caminho)
- O Claude concordou duas vezes sem conferir os números (disse que o stop de 7.735,98 foi furado; a máxima era 7.704,09) e tratou um
  print de ontem como se fosse de agora. Correções registradas ao Cleber.
- O que o Cleber via: a linha azul desenhada em 7.699,58 e o pavio de uma vela passando da linha do stop; ele fechou à mão (01:42 BRT).
- Dados: stop da posição da IA (`4874baab`, SHORT 7.700,82) ficou em 7.735,98 do começo ao fim; o pavio acima dessa linha no print é
  da vela das 14:00 BRT de 14/10 (máxima 7.738,71), 7 horas ANTES da entrada; depois da entrada a máxima foi 7.713,27. A venda manual
  tinha `stop_loss = 0` (nada para executar).
- Requisito firme do Cleber: **o que o gráfico mostra tem que ser idêntico ao banco; encostou na linha, aciona o stop.**

## 8. Causa real e correção (Parte 6 da sessão de 14/10)
- Causa: em `enforceMt5StopsAndTargets` o stop era conferido só contra o tick pontual (~5 s) e, com tick congelado, contra a última
  vela; pavio entre ticks nunca era visto (o alvo já tinha a checagem por vela desde 14/10).
- Medido com velas 5m arquivadas: 206 posições com stop original intacto, 69 com vela cruzando o stop, 57 fecharam por SL e **12 não**
  (ex.: NAS100 SHORT 01/10; UKOUSD LONG 12/10; setembro com UKOUSD -$66).
- Correção (`neuralBridge.ts`): se o tick não disparou, confere velas de 1m reais; stop original intacto = janela desde a entrada;
  stop já movido = últimos 90 s; fecha NO PREÇO DO STOP; stop e alvo na mesma janela = vale o stop.
- Também: `setOpenPositionStop` (`useApexLogic.ts`, `TradingContext.tsx`) + botão "Sem stop"/"Stop ✓" na linha da posição na boleta
  (`OrderTicket.tsx`), para definir stop numa posição manual já aberta (grava em `ai_trades`, auditado).
- `tsc --noEmit`: motor limpo; app sem erro novo (mesma contagem de 572, pré-existente). Botão não testado na tela (dev local pede login).

## 9. Operação
- O classificador de segurança negou um `./restart.sh` espontâneo; o Cleber autorizou depois e o motor foi reiniciado: 1 instância,
  ciclo 1 sem erro de conexão. `XPDUSD` está no Setup mas fora de `assetBasket.ts` (ignorado em silêncio, pendência antiga).
- Sub-sessão proposta e não iniciada: "Linha de base aleatória para medir a IA" (`task_fed686a0`).

## 10. Pendências
1. Aplicar a migration `20261015_manual_order_guard_log.sql` no SQL Editor.
2. Commit + push (`dev`) da correção do stop, do botão de stop, do guarda-costas e do motor de backtest (comandos entregues ao Cleber).
3. Confirmar o stop por pavio ao vivo: o log mostra `vela de 1m real cruzou o stop`; se divergir do gráfico, o Cleber informa o horário.
4. Confirmar com o Cleber a leitura do SPX500 (diário) e decidir a regra candidata; testar o botão de stop e o guarda-costas na tela.
5. Decidir: alerta de choque bloqueia entradas? aviso na tela? redução perto do degrau sai da sombra? Cesta: XPDUSD.
6. Nenhuma das mudanças do dia tem base estatística; sem promessa de lucro.
