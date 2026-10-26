# SESSÃO 2026-10-20 (noite) → 2026-10-21 — Conselho, failover da NVIDIA, custo corrigido, netting/hedging, testes do método do Cleber

> **Handoff completo.** Decisões, números medidos, o que está no ar, o que está pendente e os erros que eu cometi (e já corrigi).
> Regra do projeto mantida: Claude **não** faz `git commit`/`git push`; o Cleber roda os comandos. `.env` não vai pro git.

---

## ▶ COMECE AQUI

**Estado em 21/10/2026, ~14h BRT.**

1. **Motor (`llm-active-brain`) reiniciado às 12:48 BRT, 1 processo.** Roda com: Mesa **OFF** (`MT5_DESK_MODE=off`, travas mecânicas ligadas = réplica do dia de 80% de 02/09), breakeven 0,5R, piso de stop 0,08%, R:R mínimo 1:1 inviolável, stop acompanha o alvo, **failover de modelo NVIDIA** (timeout 45s, reserva `nemotron-3.5-lightning-30b` → `gpt-oss-20b`), **aborto automático** a partir de `MT5_TRIAL_START_ISO=2026-10-21T14:58:00Z`, custo do motor = **só comissão** (spread já está no preço).
2. **Protocolo do Cleber (21/10): provar a IA em RODADAS DE 10 ENTRADAS**, não 100. Só escala volume (até 1000) quando rentável. "Ela não pode perder dinheiro todo santo dia." Ver "Protocolo" abaixo e a memória `project_protocolo_rodadas_de_10_entradas.md`.
3. **Operações manuais do Cleber só contam de 21/10 em diante** (20/10 foi descartado por pedido dele). Log em [research/experiments/2026-10-21-operacoes-do-cleber/entradas.md](research/experiments/2026-10-21-operacoes-do-cleber/entradas.md). Manual = `ai_trades.is_test_data = false`; motor = `true`.
4. **Nenhum teste mecânico achou vantagem.** Todos os backtests (BTC 5m curto e longo, 3 stops, estocástico 1h antes/na curva, 11 ativos) dão **zero a zero antes do custo**. Onde o custo é pequeno (Russell, NAS100, EURUSD) o resultado fica perto de zero; onde é alto (BTC, FRA40, ETH, Brent) fica negativo. **Não prometer lucro.**
5. **Pendente de verificação na TELA do Cleber** (não consegui testar: ambiente local exige login):
   - **Arrastar stop/alvo no gráfico não grava** (stop no banco parado em 84.440 desde 13:34). Correções já no ar (`abcef8cb5`, `fa0866dfa`, `199d1cd0e`); **suspeita nº 1: a aba dele roda um link de deploy congelado** (`neural-day-trader-v2-8dvoq4f2i-…vercel.app`, nunca atualiza). Usar o alias `neural-day-trader-v2-git-dev-cleber-coutos-projects.vercel.app` + Cmd+Shift+R. Marca de build no console: `[ChartView] build 21/10-arraste-v2` e logs `arraste do STOP: iniciou/soltou em …`.
   - **Fibonacci/reta some ao trocar de tempo gráfico** (persiste). Corrigi uma corrida na "foto" dos desenhos (`199d1cd0e`), mas **não confirmei que é a causa**. Pedi o console (`📸 Snapshot de N` e `🔄 N restaurado(s)`).
6. **Primeira coisa a fazer na próxima sessão:** rodar o relatório da rodada e ver as entradas da IA desde 12:48:
   ```bash
   cd llm-active-brain && npx tsx scripts/error-report.ts --since=2026-10-21T14:58:00Z
   ```
   e conferir `[TESTE-ABORTADO]` / `[LLM-FAILOVER]` no `llm-brain.log`.

---

## 1) Diagnóstico da madrugada 20→21/10 ("a IA não faz nada")

| Achado | Dado |
|---|---|
| Entradas | A IA fez **3 entradas** na noite (NAS100 LONG −2,64; AUS200 SHORT −4,39; JPN225 SHORT −5,80 = **−US$12,83**), todas no stop |
| Causa da parada | O **aborto de "3 perdas seguidas"** que eu instalei disparou às 02h30 e **travou o motor até o restart** (44 entradas recusadas, inclusive a abertura de NY). **Erro de projeto meu** (n=3). Corrigido: vira **pausa de 60 min** (`MT5_TRIAL_ABORT_PAUSE_MINUTES`) |
| Antes disso (20/10 manhã) | NVIDIA travando 1 em 3 chamadas (90s sem resposta); cliente esperava **240s × 8 tentativas**; 299 erros de conexão, 111 timeouts, 28×429; **0 mesas**. Rede local OK |
| UK100 LONG 20/10 04:07 | stop 0,46% × alvo 0,125% (**R:R 0,27**), −US$4,25. Causa: stop-acompanha-alvo desligado + `RR_MINIMO` estava entre as travas desligadas pelo teste só-LLM |
| Mesa | rejeitadas: 53 alvos × 61 stops (46%); aprovadas: 5 × 8 (38%) → **não seleciona melhor que o acaso**; ~36 chamadas de LLM por entrada |

## 2) Conselho (llm-council, 5 conselheiros + 3 revisões)

Veredito: (A) "exponencial" **não** é promessa que a plataforma pode fazer (unânime); (B) o problema da noite é **infra**, não estratégia; (C) Mesa fora, failover de modelo, aborto automático **pré-combinado**, R:R ≥ 1, meta honesta = E[R] líquido ≥ 0 medido cedo. Cegueiras pegas na revisão: Ollama 1,7B não decide entrada (só reserva); disjuntor de saúde; o Cleber operando à mão em paralelo contamina a medição; aborto tem que ser automático e combinado **antes**.

## 3) Pesquisa mundial ("o que já funciona lá fora")

5 frentes (acadêmico, código aberto EN/ZH, comunidades chinesas, outros países/reguladores, competições/históricos auditados). **Relatório:** [reports/Day trade com lucro comprovado.md](reports/Day%20trade%20com%20lucro%20comprovado.md); notas em `research_notes/Day trade com lucro comprovado/`.
Conclusão: **nenhum** day trade de varejo com lucro líquido provado por terceiros em CFD de índice/ouro/petróleo/cripto. ORB 5 min: ~+0,1R bruto, ≈0 líquido (replicação MQL5). Reguladores (Brasil/Índia/Taiwan/UE): 0,4–1% dos day traders lucram de forma persistente; os que persistem: poucos trades, custo pequeno vs ganho (Índia: vencedores gastam 19% do lucro em custo; perdedores, 57% da perda). Alpha Arena (17 dias ao vivo): Qwen +22%, Claude/GPT-5/Gemini −42% a −59%. Alpha decai ~58% após publicação (McLean & Pontiff).

## 4) Mudanças no motor (todas commitadas; `.env` só local)

| Mudança | Onde |
|---|---|
| `RR_MINIMO` **nunca** é desligado por modo (só-LLM/veto/expansão) | `llm-active-brain/src/tools.ts` (`gateResult`) |
| Timeout 45s (`LLM_CALL_TIMEOUT_MS`) + **failover** de modelo após 2 falhas de infra seguidas, retorno ao principal em 10 min; `[LLM-FAILOVER]` | `agent.ts`, `config.ts` |
| **Aborto automático** (`getTrialAbortReason`): E[R] < −0,3R em 10 entradas, ou −10% do capital → bloqueia entrada nova (`[TESTE-ABORTADO]`); 3 perdas seguidas = pausa de 60 min | `neuralBridge.ts`, `tools.ts`, `config.ts` |
| **Custo só comissão** para posição do motor (spread já está no preço bid/ask; antes era descontado **em dobro**: `net_pnl`, piso de valor, Mesa). Sem "provisão de derrapagem" | `research/CostModel.ts` (`estimateRoundTripFractionExcludingSpread`), `commissionModel.ts` |
| **Ordem MANUAL** fechada pelo motor inclui o spread (entra a preço médio) | `commissionModel.ts` (`estimateMidPriceRoundTripCostUsd`), `neuralBridge.ts` (`is_test_data===false`) |
| Piso de stop 0,3% → **0,08%** (`MT5_STOP_MIN_PCT`): o piso antigo **descartava o stop de 2× ATR** em ativo de baixa volatilidade e caía no reserva de 0,5% (ouro: US$20,80/onça > teto de risco US$10) | `.env`, `config.ts` (default + governança) |
| **BUG:** compra manual com stop e **sem alvo** (`take_profit=0`) fechava na hora como "TP" (`price >= 0`) | `neuralBridge.ts:1378/1391` — exige `take_profit > 0` |
| `.env` (não versionado): `MT5_DESK_MODE=off`, `MT5_LLM_ONLY_TEST=false`, `MT5_BREAKEVEN_TRIGGER_R=0.5`, `MT5_SCALP_STOP_FOLLOWS_TARGET=true`, `MT5_SCALP_MIN_RR=1.0`, `LLM_FALLBACK_MODELS=…lightning-30b…,openai/gpt-oss-20b`, `MT5_TRIAL_START_ISO=2026-10-21T14:58:00Z` | `llm-active-brain/.env` |

Teste dos modelos da chave NVIDIA (5 chamadas com tool-calling): `nemotron-3.5-lightning-30b` 5/5 em 1,8–3,1s; `gpt-oss-20b` 5/5 em 2,8–6,3s; `glm-5.3-flash` 5/5 em 3,6–7,6s; o principal `3.5-super-vl` deu 429 sob carga; outros 404 ou travaram.

## 5) Mudanças na plataforma (frontend) — todas commitadas

- **Netting vs Hedging** (o Cleber exige as DUAS): ordem contrária no mesmo ativo **fecha/reduz** a posição (netting, padrão) **ou** abre posição oposta (hedging = o "headzinho" dele). Chave em **Configurações → Geral**. `useApexLogic.ts` (`openManualPosition`), `lib/accountMode.ts`, `Settings.tsx`. Só DEMO.
  - Fechamento **parcial** persistido: `AITradingPersistenceService.partialCloseTrade` (insere linha FECHADA da parte + reduz `quantity`), `useAIPersistence.onTradePartialClose`.
  - **Bug que eu criei e corrigi:** o netting comparava nocional em **dólares** (preços de entrada diferentes) e deixava uma posição-poeira (compra de US$2,68 = 0,000032 BTC). Agora compara em **unidades**. A poeira foi fechada pelo próprio Cleber; **não editei registro**.
- **Alvo digitável** em posição aberta (boleta: "Sem alvo/Alvo ✓"), `setOpenPositionTarget`, `updateTradeTakeProfit`.
- **Arrastar stop/alvo grava** (antes a linha era só desenho; só ordem pendente tinha `onPressedMoveEnd`): `ChartView.tsx`. Redesenho por tick **pula a linha em arraste** (`draggingPositionLineRef`); descontado o nudge visual; logs de diagnóstico.
- **Shift deixa a reta 100% reta** (2º ponto assume o preço do 1º) ao terminar de traçar ou soltar ponto; **chave** em Configurações (`lib/drawingPrefs.ts`, padrão ligado).
- Card da posição do motor marcado no lado de fechamento (bid/ask) com custo só comissão; manual segue com spread.
- **Correção de registro com auditoria:** nenhuma (a poeira foi fechada pelo usuário). Cancelei 2 ordens pendentes por SQL (84,536 e 84.522) — **erro meu**: a tela tinha estado antigo e o app sobrescreveu o `CANCELLED`. Lição: **não escrever em ordem/posição viva enquanto a aba do usuário está aberta** (só o stop gravado por SQL funcionou).

## 6) Backtests e estimativas (scripts em `llm-active-brain/scripts/` e scratchpad)

BTC 5m, ~90 dias, 0,02 BTC, custo US$1,30/op, entrada = estocástico 5m cruzando de volta da zona extrema, stop no extremo:
- **Alvo curto US$2/3 líquidos:** 1.516–1.643 ops, acerto 39–45%, ganho ~US$2–2,8, perda ~US$3,9, **líquido −US$1,25/op** (≈ o custo); só 10h–12h BRT: −US$1,65/op. `rabo-btc-backtest.mts`.
- **Versão longa** (alvo = SMA9 do 1h) com 3 stops (fixo no extremo; zero a zero após 1R; zero a zero após +US$3): **−1,13 / −1,15 / −1,16 por op**. O stop não muda o resultado. `rabo-btc-longo.mts`.
- **Veto "entrada antecipada" não ajuda** (1h BTC, 1 ano): antes da curva −0,58/op; na curva −0,80/op. **Não implementado.**
- **Multiativo** (estocástico 1h, stop 2×ATR, custo real por ativo, em R): Russell +0,046/+0,053; NAS100 +0,019/+0,058; SPX500 +0,063/−0,059; GER40 −0,005/+0,022; EURUSD +0,017/+0,006; Brent +0,015/+0,002; ouro −0,095/−0,037; UK100 −0,111/−0,061; FRA40 −0,150/−0,123; ETH −0,038/−0,063; BTC −0,094/−0,102. **Nenhum t > 1** (~145–190 dias de dado nos índices). `rabo-multiativo.mts [--cesta]`. Recomendação aberta: tirar **FRA40** e **BTC/ETH de operação curta** da cesta da rodada.
- Segurar venda até o estocástico 1h esgotar, stop 499 pts (BTC, 1 ano): esgotou 32%, bateu stop 68%, líquido médio −US$0,21 a −0,92.
- Mercado positivo (preço > SMA20, SMA9 > SMA20, +1,5% em 24h; 15% do tempo): quedas até a SMA9 → voltou a subir 41% (vs 32% em qualquer mercado), continuou caindo 57%; SMA20: 20%/80%.
- Chega na SMA9 do 1h antes de subir o stop (preço 600–1100 pts acima): 47% (stop 499), 58% (700), 69% (900); líquido médio **negativo** (−0,86 a −1,52 US$).
- Fibonacci do "morro" desenhado pelo Cleber: topo 84.352 (12/10 03h BRT), fundo 79.800 (15/10 10h BRT). Extensões: 127,2% = 85.590; 161,8% = 87.165; 200% = 88.904. (O alvo dele: 87.031,70 e 88.654,86.)

## 7) O método do Cleber (como ele descreveu — **hipóteses, não provadas**)

- **"Entrar no rabo"**: entrar logo depois que o preço faz a curva do extremo, para pagar barato (risco pequeno vs alvo grande). Medida: razão alvo/risco (ex.: venda 12:15, 5,2:1; venda 11:41, 0,8:1). Alvo = **média de 9 do gráfico de 1h**.
- Várias entradas curtas que perdem pouco + uma longa até o **fim do ciclo do estocástico 1h**.
- **Técnica do "headzinho"**: abre posição contrária (hedge), solta a perdedora, deixa a ganhadora correr → por isso a plataforma precisa do modo **Hedging**.
- Declara a **probabilidade** de cada entrada (ex.: ~65%). Meta de acerto dele: ≥75%, "perde pouco, ganha muito". Pede entradas **mais pesadas** (decisão: só depois de E[R] positivo; `size:"forte"` 2× já existe).
- Observação medida: as perdas de 21/10 (venda antes da curva, 1h ainda subindo) não são explicadas só por "entrar cedo" — o teste histórico não confirma esse veto.

## 8) Protocolo de validação (decisão do Cleber, 21/10)

Rodadas de **10 entradas**. Aborta se E[R] líquido < −0,3R ou −10% do capital; segue se entre −0,3R e 0; **sobe um degrau** (tamanho 1,5×, com teto) só se E[R] ≥ +0,15R **e** ganho médio > perda média. Rodada 2 acumula com a 1. **10 entradas barram desastre, não provam vantagem** (erro ~0,3R) — dizer sempre. Rodada 1 começou 21/10 12:48 BRT. O Cleber **resetou o caixa** às 13:31 (sessão nova `0e7ae4f6…`, US$100): o contador de perda diária zerou; as perdas manuais do dia (−US$18,40, 11 operações) seguem no histórico.

## 9) Operações do Cleber em 21/10 (manual, BTC)

11 fechadas, **−US$18,40** líquido (vendas 11:41 −5,01, 11:57 −3,25; compras/virações 12:09–12:47 −0,53/−0,70/−0,12/−0,07 [fechadas por bug de TP e à mão]; venda 12:28 −1,78→(fechou) e 12:48 −3,32). Aberta às 13:31: **compra 0,02 BTC em 84.722,01, stop 84.440,00, sem alvo**. Alvos que ele quer: 87.031,70 (1º) e 88.654,86 (100%).

## 10) Erros meus nesta sessão (e o que ficou de lição)

1. **Spread descontado em dobro** no motor (preço bid/ask **e** custo "ida e volta" cheio) — semanas sem checar o básico. Corrigido; ver §4.
2. **Piso de stop 0,3%** escondia o stop de 2× ATR; **aborto de 3 perdas** travando o motor; **netting em dólar** deixando poeira; **cancelei ordens por SQL** com a tela aberta. Todos corrigidos/admitidos.
3. Vários scripts meus tinham armadilhas (zsh interpretando `$C:l`, janela de datas errada no Fibonacci, fuso do horário do topo). Conferir sempre com o dado.
4. **Link de deploy com hash é congelado** (regra do CLAUDE.md): custou horas de "não funciona".

## 11) Pendências abertas

1. **Verificar na tela** (alias + Cmd+Shift+R + console): arraste do stop/alvo e sumiço do Fibonacci. Se o console não mostrar `build 21/10-arraste-v2`, é build antigo.
2. **Faixa de preço do gráfico não inclui desenhos** (klinecharts 9.8.10 só tem `createTicks`, sem `createRange`): Fibonacci acima do topo visível some no 5m. Ideia (não feita): indicador invisível no painel de candles com min/max dos desenhos. Pedi teste no 15m/30m antes de mexer.
3. Cesta da rodada: sugerido tirar FRA40 e BTC/ETH de curto prazo; ouro precisa estar no Setup (saiu em 19/10 por causa do piso de stop, hoje corrigido).
4. Limite de 1 posição aberta por vez **não** foi aplicado (vale o do Setup).
5. Teto de perda diária: o reset do caixa zera o contador; considerar ajuste consciente do limite em vez de reset.
6. Meta ≥6 entradas/dia: **medir**, nunca afrouxar vetos para forçar.
7. Decisão em aberto: padrão **Netting** (hoje) vs Hedging.
8. Commits/deploy: tudo até `199d1cd0e` (+ marcas de console) foi pelo Cleber; `.env` só local.

## 12) Onde está cada coisa

- Memórias: `project_pacote_20-10_madrugada_failover_e_replica_02-09.md`, `project_protocolo_rodadas_de_10_entradas.md`, `feedback_julgar_cedo_nao_40_trades.md`, `feedback_operacoes_manuais_contam_a_partir_de_21-10.md`.
- Log das operações do Cleber: `research/experiments/2026-10-21-operacoes-do-cleber/entradas.md`.
- Relatório de pesquisa: `reports/Day trade com lucro comprovado.md`.
- Scripts: `llm-active-brain/scripts/{noise-area-momentum,rabo-btc-backtest,rabo-btc-longo,rabo-multiativo}.mts`.
