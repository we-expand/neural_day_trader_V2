# Sessão 2026-10-15 (tarde) — madrugada perdedora, silêncio da IA, custo × direção, varredura stop × alvo e teste de stop 1,5×

> Handoff desta sessão. PT-BR. Commits feitos pelo Cleber (`fa4a22546` código, `9c1ca4c5b` docs); motor reiniciado por mim
> a pedido dele às **12:26:20 BRT (PID 31431)**. Nada mais pendente de versionar além do `teste-stop-1-5x.md` não rastreado.
> Teste em andamento: ver [SESSAO_2026-10-15_TESTE_STOP_1-5X_ALVO_1-5X.md](SESSAO_2026-10-15_TESTE_STOP_1-5X_ALVO_1-5X.md).

## 1. Estudo da madrugada de 15/10 (00:00–11:39)
- 11 linhas / 10 entradas: **−$13,3** (LLM −$5,34 em 7 entradas; manual do Cleber −$6,90 em 3 SPX500 SHORT; 1 SPX500 herdado −$1,10).
- LLM: bruto −$0,94, custo $4,40. O CHINA50 SHORT sozinho foi −$6,96 (rompeu suporte, estocástico sobrevendido, stopou em 5 min).
  Sem ele as outras 6 somam +$1,62. A manual perdeu só em custo: bruto −$0,37, comissão $6,51 (uma delas $5,43 por $0,39 de ganho).
- Padrões: 1 só TP em 7 (JPN225, alvo curto); UKOUSD devolveu metade do pico (MFE $5,07 → +$2,52); 2 NAS100 morreram no
  breakeven pagando custo; XETUSD com 2 reforços automáticos, stop colado na entrada e saída −$1,93; shorts de "rompeu o
  suporte" falharam **3 de 3** em duas noites (UKOUSD −5,69, SOLUSD −0,84, CHINA50 −6,96).
- Mesa: 50 deliberações, 7 aprovadas, 43 rejeitadas; das rejeitadas medidas 8 teriam dado alvo e 5 stop (veto ainda sem poder).
- Escalonador de risco: a madrugada rodou a 1,0× (o `.env` do escalonador foi gravado só às 11:35); 0,25× vale a partir do restart das 11:35.
- Achado de código (não alterado): em `increase_position` o stop de SHORT vai para preço médio **+** spread, ou seja, do lado
  da perda, apesar do aviso "breakeven-ou-melhor". Matou o XETUSD que ainda estava vivo. 1 caso, sem amostra; regra nasceu de incidente de 10/09.

## 2. Por que a IA ficou "sem entrar" depois das 10h
1. 10:58 NAS100 SHORT vetado pelo Gestor de Risco (LLM; é o dono do risco no teste só-LLM).
2. 11:05–11:27 cinco tentativas morreram em `open_position`: R:R < 0,5 (alvo de scalp 0,25% × stop 0,5–0,66%) e piso de valor
   $3,41 (CHINA50 deu $3,36).
3. 11:35 restart: ciclo 1 inteiro perdido (~20 min) por "Connection error" da NVIDIA (8 tentativas); depois recuperou.
4. Setup do Cleber mudou de 11 para 8–10 ativos e a sessão trocou (`f553d39f…` → `11f7dfd0…`) por volta das 11:3x.

## 3. Custo × direção (conclusão do Cleber vence)
- Medido: spread por hora só encarece GER40/AUS200/UK100 (6–8× às 17h–20h BRT), que a IA quase não opera; custo médio por
  entrada às 17h–19h = $0,40, igual às outras horas. **Janela fixa de horário não se sustenta.** Gate de spread relativo foi
  proposto e **dispensado**.
- Desde 22/09: bruto ≈ −$80, custo ≈ −$76. Cortar o custo a zero não resolve; o lado é o problema.
- Decisão de produto do Cleber: o produto aceita **qualquer ativo** na cesta; não se tira ativo do Setup. A regulagem é que tem
  de se adaptar a cada ativo. Motor é o produto. Julga com ~10 entradas, não 100.

## 4. Defeito achado e varredura
- O stop já escala pelo ATR do ativo (2,0× ATR), mas o teto de alvo de scalp era **fixo em 0,25%** para todos → R:R de ~0,25
  (SOLUSD) a ~0,67 (JPN225), barrando justo os ativos que mais correm.
- Opção A (alvo = 0,6× stop) foi implementada a pedido, mas a varredura mostrou **−0,22R**, igual ao motor (−0,29R). Desligada.
- `scripts/stop-target-sweep.ts` (novo, só leitura): reexecuta as 153 entradas reais (147 com velas) sobre velas de **5m** do
  `ohlcv_data` (o endpoint de 1m da MetaAPI não respondeu em 100 s), 40 combinações, treino 70% / teste 30% por data.
  Relatório: `llm-active-brain/reports/stop-target-sweep.md`.
- Resultado (E[R] líquido em unidades do stop atual): stop 0,5×–0,75× e alvo 0,3–0,6× stop sempre piores (−0,2 a −0,26);
  única região positiva = stop 1,5×–2× com alvo ≥ 1,5× o stop (+0,07 a +0,10; teste +0,12, IC95 −0,43 a +0,66, **não
  significativo**). Por ativo: XETUSD/LNKUSD/SOLUSD/CHINA50/AUS200/SPX500 negativos em qualquer par (lado errado); BTCUSD e BNBUSD melhoram com stop 1,5×.
- Limites: 40 combinações em 147 entradas (melhor par pode ser sorte), 5m, stop/alvo fixos sem breakeven/trailing/parcial/reforço.

## 5. O que está ligado agora (`llm-active-brain/.env`, não versionado)
`MT5_SCALP_STOP_FACTOR=1.5` · `MT5_SCALP_TARGET_MAX_PCT=0` (era 0,25) · `MT5_SCALP_TARGET_STOP_FRACTION=0` · escalonador em 0,25×.
Rollback: `MT5_SCALP_STOP_FACTOR=1` e `MT5_SCALP_TARGET_MAX_PCT=0.25` + `./restart.sh`.

## 6. Critério de 10 entradas (a partir de 12:26 BRT; consolidadas)
Abortar se E[R] líquido < −0,3R/entrada **ou** acerto < 30%; manter se ≥ −0,15R; entre os dois, estender para 15.
`npx tsx scripts/error-report.ts --since=2026-10-15T15:26:00Z --out=reports/teste-stop-1-5x.md`

## 7. Pendências reais
- Confirmar na 1ª entrada nova: alvo ≈ 1,5× a distância do stop e stop ≈ 3× ATR (`ai_trades.original_stop_distance`, `take_profit`).
- Decidir sobre o stop de reforço (`increase_position`, lado da perda) quando houver amostra.
- Guarda-costas da boleta manual (migration `20261015_manual_order_guard_log.sql` pendente): as 3 manuais custaram $6,51 de comissão.
- NVIDIA "Connection error" intermitente em pedidos grandes (ciclo 1 perdeu ~20 min); `XPDUSD` no Setup não existe em `assetBasket.ts`.
- PR #1 (`dev` → `main`): conflitos resolvidos mantendo a versão do `dev` (`a5b1898a3`); a `main` segue sendo a página de manutenção.
- Correção minha de hoje: a hipótese "alvo do modo expansão longe demais" não vale; o lote encolhe com o alvo (risco pequeno). E a
  sugestão "stop acompanha o alvo" contrariava o pedido do Cleber de 13/10 ("não mexa no stop") e o precedente de 04/09.
