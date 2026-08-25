# Sessão 2026-08-25 — Controles de fricção (por que o patrimônio não evolui)

## Gatilho

Cleber reportou o motor ligado há ~13h sem evoluir: iniciou com US$100, estava
em US$99,33. Pergunta: que alterações/upgrades fazem o patrimônio crescer?

## 1. Correção de premissa — 13h não dizem nada

Foram **14 trades**, −US$0,67 (−0,67%), desvio ~US$0,80/trade. Isso é ruído.
Concluir qualquer coisa de 14 trades seria violar a seção 8 da
`AI_BRAIN_SPEC.md`.

Além disso, o saldo de US$99,33 **esconde o resultado real**: houve vários
resets para US$100 no período. A sessão anterior (21/08 19:54 → 24/08 19:07)
fechou em **US$88,22** e foi zerada para US$100 às 19:16 de 24/08.

Ampliando para amostra de verdade — **217 trades / 14 dias**:

| Métrica | Valor | Leitura |
|---|---|---|
| EV bruto por trade | −US$0,123 | **t = −0,78 → indistinguível de zero** |
| EV líquido por trade | −US$0,294 | t = −1,81 |
| PnL bruto | −US$26,74 | |
| Custo estimado | −US$37,00 | |
| **Notional girado** | **US$127.603** | **1.276× a conta em 14 dias** |

**O sinal não perde dinheiro — ele não ganha.** 58% da perda esperada vem de
custo de execução; 42% de deriva de sinal que não é estatisticamente
significativa. Consistente com a conclusão já fechada (sem edge ⇒ EV ≈ −custo);
a novidade é estar **medido em produção**, não em backtest.

## 2. Os três sangradouros

### 2.1 Ouro consome metade do custo e é negativo

Custo estimado à taxa medida (0,029% do notional, round-trip):

| Símbolo | n | Notional méd. | Alavanc. | Bruto | Custo | **Líquido** | % do custo total |
|---|---|---|---|---|---|---|---|
| UKOUSD | 17 | $879 | 8,9× | −18,67 | 4,34 | **−23,01** | 11,7% |
| SOLUSD | 74 | $155 | 1,6× | −14,02 | 3,34 | **−17,35** | 9,0% |
| ETHUSD | 71 | $141 | 1,4× | −3,46 | 2,90 | **−6,36** | 7,8% |
| XAUAUD | 9 | $962 | 9,7× | −3,84 | 2,51 | **−6,35** | 6,8% |
| **XAUUSD** | 24 | **$2.791** | **28,1×** | **+14,33** | **19,43** | **−5,10** | **52,5%** |
| JP225 | 5 | $2.028 | 20,4× | −1,78 | 2,94 | −4,72 | 7,9% |

**Corrige a leitura de 2026-08-21** ("sessão overnight só é lucrativa por causa
do XAUUSD"): com custo real descontado, o ouro também é negativo. Parecia o
melhor ativo apenas porque o custo estava invisível (bug corrigido em 08-23).

### 2.2 Churn de reentrada — 33% dos trades

72 de 217 reabrem o **mesmo símbolo em <5min** do fechamento anterior; 112
(52%) em <30min. Caso literal de 25/08: ETHUSD fechou 02:49 e reabriu 02:49,
mesmo preço. `ASSET_ANTI_REPEAT` não pegava isso — ele só olha o ÚLTIMO trade,
então SOL → ETH → SOL passa direto (42 bloqueios contra 72 reentradas reais).

### 2.3 Breakeven em +1R fecha 27% dos "SL" em ~zero

47 de 176 "SL" com |PnL| < US$0,10 — não são stops, é o breakeven puxando o
stop até a entrada. Sob passeio aleatório isso é **neutro em EV** (optional
stopping theorem), mas multiplica os round-trips pagos: 23 das reentradas
rápidas vieram logo após uma saída em zero.

## 3. O que foi implementado

Todos os 4 itens do "Nível 1" aprovados pelo Cleber. Novo módulo
`src/app/services/risk/TradeFrictionControls.ts` (zero dependências, funções
puras que só REDUZEM exposição — mesma filosofia dos gates de sizing
existentes).

| # | Mudança | Onde | Constante |
|---|---|---|---|
| 1 | Teto de alavancagem 3× por trade | `runTradingCycle.ts` (cadeia de clamps) | `MAX_NOTIONAL_LEVERAGE = 3` |
| 2 | Cooldown 20min por símbolo pós-fechamento | `runTradingCycle.ts` (loop de candidatos) | `SYMBOL_COOLDOWN_MS` |
| 3 | Breakeven +1R → +1,5R | `positionManager.ts` + `useApexLogic.ts` | `BREAKEVEN_TRIGGER_R = 1.5` |
| 4 | COST_GATE contra movimento **capturado** | `CostViabilityGate.ts` | `TARGET_REALIZATION_FACTOR = 0.40` |

### 3.1 O fator de realização é MEDIDO, não estimado

`ai_trades`, 30 dias, n=220:
`fator = |saída − entrada| / |take_profit − entrada|`

- média **0,4003**, mediana **0,4006** (média ≈ mediana → distribuição
  comportada, número robusto)
- alvo médio 1,055% do preço, realizado médio 0,401%
- estável entre ativos: SOL 0,378 (n=74), ETH 0,410 (n=71), XAU 0,416 (n=24),
  UKO 0,370 (n=19) → usa-se valor **global**; símbolos com n<20 não sustentam
  fator próprio

O gate media custo contra o alvo cheio (3,75×ATR), que só 13,4% dos trades
atingem. Agora mede contra 40% do alvo. **Limiares 7%/12% intocados** — mudou
a pergunta que a razão responde, não a régua.

### 3.2 Efeito de produto esperado (não é bug)

Com teto de 3× numa conta de ~US$100, o notional máximo é ~US$300. O lote
mínimo de XAUUSD (0,01 = 1 onça ≈ US$4.590) e o de índices ficam muito acima
disso, então esses ativos passam a ser recusados adiante por `MIN_TRADE_SIZE`.
**O teto remove ouro/índices da cesta operável enquanto a conta for pequena** —
intencional, são exatamente os destruidores de capital líquido nessa faixa.
Conta maior volta a alcançá-los sozinha, sem mudança de código.

## 4. Contrafactual sobre o histórico

Simulação das 3 mudanças simuláveis (o breakeven 1,5R exige candle intra-trade
e não é simulável aqui):

| Métrica | Hoje | Depois | Δ |
|---|---|---|---|
| Trades | 218 | 78 | −64% |
| Notional girado | US$127.703 | US$14.926 | **−88%** |
| Custo | US$37,03 | US$13,69 | −63% |
| Líquido | −US$62,09 | **−US$13,66** | +US$48,43 |
| EV/trade | −0,285 | −0,175 | melhora, **segue negativo** |

**Ressalvas declaradas:**
1. É contrafactual sobre o histórico, **não backtest** — os slots liberados
   teriam sido preenchidos por outros candidatos do ranking.
2. Não simula o breakeven em 1,5R.
3. A regra de filtro é **ex-ante** (razão custo/movimento, conhecida antes da
   entrada) — sem look-ahead.
4. **A maior parte do ganho vem de operar MENOS, não de operar melhor.**

Verificação de que o aperto não fecha o motor: por trade, 148 de 218 (67,9%)
continuam VIÁVEIS. A média por ativo sugeria ETH/BTC/UKO em FRONTEIRA, mas a
distribuição de ATR é assimétrica e a maioria dos trades individuais passa.

## 5. O que isto NÃO faz

**Não gera lucro.** O resíduo de −US$13,66 é a deriva de sinal não-significativa
que sobra depois de cortar o custo. Com EV bruto ≈ 0, nenhuma alavanca de
engenharia cria retorno — reduzir fricção leva o resultado para perto de zero,
não para positivo.

Crescimento sustentado continua dependendo de **edge**, e as opções honestas
seguem as mesmas:
- **Meta-labeling do `confidence_score`** — bloqueado por amostra (n=278,
  precisa ~450-500). Maior probabilidade de sucesso porque filtra quais sinais
  valem o custo em vez de tentar prever direção.
- **Trilho 2** (dado estruturalmente diferente) — pausado, sem justificativa
  nova.
- **Vol targeting** — ML em volatilidade, nunca em direção.

## 6. Validação

- `npm run validate`: **72 asserções OK, 0 falharam** (37 pré-existentes + 35
  novas em `__validate__friction__.ts`), type-check do motor limpo.
- `deno check` do `ai-runner` com o import map: **passou**. (Nota: o `deno`
  está disponível nesta máquina, ao contrário do que o CLAUDE.md registrava.)
- `TradeFrictionControls.ts` adicionado ao import map do runner
  (`supabase/functions/ai-runner/deno.json`) — o passo cuja ausência quebrou o
  deploy em 2026-08-21.
- Novo estágio de funil `SYMBOL_COOLDOWN` registrado em `FunnelTelemetry.ts`
  (tipo + rótulo PT-BR).

## 7. Registrado no Jarvis

4 entradas em `jarvis_knowledge` (`3a4729ec`, `a1a223c0`, `a966793e`,
`6171b6d2`): custo domina o resultado, ouro negativo líquido, churn de
reentrada, e o contrafactual dos controles.

## 8. Pendências

- **Commit + push** (Cleber) e **redeploy do `ai-runner --no-verify-jwt`** — sem
  o redeploy, nada disso está em produção, só no cliente.
- **Remedir `TARGET_REALIZATION_FACTOR`** depois de ~200 trades novos: o
  breakeven em 1,5R tende a aumentá-lo (menos saídas em zero), e o fator é
  propriedade da mecânica de saída atual, não constante de mercado.
- Decisão aberta: se o motor ficar restritivo demais na prática, a alavanca é
  aprovar `FRONTEIRA` no COST_GATE (hoje reprovado por escolha de projeto). O
  argumento a favor ficou mais forte: a margem de segurança que justificava
  reprovar FRONTEIRA compensava um denominador otimista, que agora não é mais
  otimista — manter as duas coisas é dupla contagem. Medido: aprovar FRONTEIRA
  levaria de 67,9% para 95,4% dos trades, e o líquido de −US$51,11 para
  −US$62,28 (pior). **Por isso ficou como está.**
