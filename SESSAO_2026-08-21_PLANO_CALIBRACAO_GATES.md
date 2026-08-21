# Plano — calibrar gates de custo/contexto e reduzir variância (não perseguir 70% de acerto)

> Handoff pra próxima sessão. Nada foi implementado ainda — este arquivo é só
> o plano de trabalho, com os números/arquivos já levantados pra não precisar
> reinvestigar do zero.

## Contexto da decisão

Cleber perguntou se dava pra chegar a **70% de taxa de acerto** otimizando a
tecnologia, pra usar como critério de lançamento. Resposta dada, com base no
histórico já documentado do projeto: **não** — a busca sistemática por edge
de sinal técnico (2026-07-24 a 08-02, ver `CLAUDE_HISTORY.md`) já concluiu
"mercado eficiente pra indicador técnico clássico", e 70% de acerto
implicaria promessa de edge que essa investigação não sustenta. Prometer isso
violaria a própria regra do projeto (nunca prometer edge sem validação
estatística, `CLAUDE.md`).

Decisão: em vez de mirar taxa de acerto, o trabalho **real e mensurável** é
**melhorar a consistência/robustez do que já existe** — calibrar melhor os
gates de custo e contexto, reduzir a variância dos resultados. Baseline
medido na sessão overnight de 2026-08-20/21 (sessão `e2a3a5a0-bf37-...`,
detalhe completo em `SESSAO_2026-08-20_MONITORAMENTO_SCALP_NOITE.md`):
**43 trades fechados, 15 vitórias (34,9%), saldo líquido +16,86**, payoff
médio ganho/perda ~2,6:1.

## Onde cada gate vive hoje (pra não reprocurar)

### COST_GATE — `src/app/services/risk/CostViabilityGate.ts`

- Limiares: `FRONTEIRA_THRESHOLD = 0.07` (7%), `INVIAVEL_THRESHOLD = 0.12`
  (12%) — [CostViabilityGate.ts:69-70](src/app/services/risk/CostViabilityGate.ts:69).
  Só aprova razão custo/movimento ≤ 7% (`VIAVEL`); recusa `FRONTEIRA` (7-12%)
  por padrão (margem de segurança de projeto) e `INVIAVEL` (>12%).
- **Origem da calibração 7%/12%**: seção 14.3 da spec, medida com BTCUSDT em
  4 timeframes (15m/1h/4h/1d), com um custo round-trip que depois se provou
  ~18x inflado (corrigido em 2026-08-02) — comentário no topo do arquivo
  documenta a ressalva completa. **Os limiares nunca foram recalibrados**
  depois da correção de custo, só reinterpretados ("continuam válidos porque
  mapeiam razão, não valor absoluto") — essa reinterpretação não foi
  validada com backtest novo.
- **Mudança de denominador em 2026-08-17**: passou a comparar custo contra a
  distância até o **alvo do trade** (3,75×ATR), não contra o ATR de 1 barra
  — mudança de metodologia também não revalidada com backtest, só com
  raciocínio + 1 exemplo real (XAUUSD).
- Integração ao vivo: `runTradingCycle.ts:758-816`, função
  `evaluateCostViability` chamada com `movementPercentForCostGate` (alvo) e
  `costPercentForCostGate` (round-trip estimado por classe de ativo).

### CONTEXT_GATE — `src/app/services/risk/ContextGate.ts`

- Recusa side proposto quando: regime `ILLIQUID_NO_DATA` (candles
  insuficientes); `HIGH_VOLATILITY` (ATR atual ≥ 2× mediana das últimas 20
  barras — [ContextGate.ts:75](src/app/services/risk/ContextGate.ts:75));
  estrutura BOS/CHoCH contradiz o lado proposto; ou regime `RANGING`
  (ADX < 20) sem viés de estrutura claro.
- **O próprio arquivo já documenta a lacuna que precisa ser preenchida**
  ([ContextGate.ts:34-37](src/app/services/risk/ContextGate.ts:34)): "a meta
  declarada não é prever direção — é reduzir trade que contradiz a leitura
  de estrutura corrente, uma métrica mais barata e mais honesta de medir
  depois (**contar quantos trades vetados teriam perdido**), que **ainda não
  foi medida aqui**." Ou seja: não existe hoje nenhuma medição de quantos
  vetos deste gate estavam certos.
- Integração ao vivo: `runTradingCycle.ts:818-830` (mais o Tail Risk Guard
  logo depois, linhas 832-847, que reage a expansão de ATR/VIX/exposição
  aberta — mesmo `vetoStage: 'CONTEXT_GATE'`, lógica separada).

## Passo 1 (o mais barato e mais honesto) — medir antes de calibrar

Antes de mexer em qualquer limiar, medir o que os dois gates já estão
fazendo, com dado real já disponível:

1. **Contrafactual do CONTEXT_GATE**: pra cada decisão salva com
   `vetoStage: 'CONTEXT_GATE'` em `ai_decisions` (tem `technicalSignals`
   com `regime`/`structureBias`/`adx` no momento do veto), simular se o
   trade recusado teria batido TP ou SL usando os candles reais
   subsequentes. Isso responde: o gate está vetando trade que perderia
   mesmo (bom) ou trade que teria ganho (gate calibrado errado, na direção
   de operar de menos)?
2. **Distribuição de custo/alvo do COST_GATE por classe de ativo**: puxar
   de `ai_decisions.riskAssessment` (campos `costPercent`/`movementPercent`)
   histórico de quantos setups caem em cada faixa (VIAVEL/FRONTEIRA/
   INVIAVEL) por classe (`assetClass`) — hoje sabemos qualitativamente que
   índices (GER40/SPX500/UK100) batem `INVIAVEL` com frequência alta (visto
   ao vivo no monitoramento de ontem, 22-59% de custo/alvo) e cripto/ouro
   raramente. Vale quantificar se isso é estrutural (esses ativos deveriam
   nem estar na cesta de scalp) ou só um regime passageiro de ATR baixo.
3. **Quebra de win rate por ativo/lado/horário** nos 43 trades da sessão
   overnight (dado já puxado, ver `ai_trades where session_id =
   'e2a3a5a0-bf37-455c-80aa-1029f0664214'`) — ver se a perda concentra em
   algum símbolo específico (ex: UKOUSD teve as 2 maiores perdas, -5,95 e
   -5,15) ou se está distribuída. Se concentrada, é sinal de "tirar esse
   ativo do scalp" antes de "recalibrar o gate geral".

Isso é aritmética sobre dado que já existe — não precisa de backtest, não
precisa de hipótese nova, só honestidade de olhar o que já rodou.

## Passo 2 — hipóteses de calibração a testar (com backtest, não em produção direto)

Só depois do Passo 1 informar quais destas valem a pena:

- **Recalibrar 7%/12% do COST_GATE** com custo real atual (pós-correção de
  2026-08-02) e denominador atual (alvo, pós-2026-08-17) — os limiares hoje
  carregam duas mudanças de premissa desde que foram fixados, nenhuma
  revalidada.
- **Considerar excluir ativos historicamente ruins da cesta de scalp** (se o
  Passo 1.3 mostrar concentração de perda) em vez de mexer no gate global.
- **Fator de inclinação do MACD** no `momentumFactor` (já registrado como
  pendência no item 6 do `CLAUDE.md` de 2026-08-20) — penalizar entrada
  quando o histograma está minguando mesmo do lado "certo". Candidato a
  reduzir falsos positivos de entrada, não a subir acerto pra 70%.
- **Medir se o Tail Risk Guard / expansão de ATR está gerando saída
  prematura de trades que teriam vencido** (mesma lógica do contrafactual
  do Passo 1.1, aplicada à saída em vez de à entrada).

## Regra de execução (lembrete, já fixado no `CLAUDE.md`)

Qualquer mudança nos limiares/lógica destes gates precisa do mesmo rigor do
resto do motor: split treino/holdout cronológico, custo real descontado,
correção por múltiplos testes se houver mais de uma hipótese testada, e
**gate obrigatório** `npm run validate` antes de qualquer commit que toque o
motor. Nenhuma calibração vai direto pra produção sem essa validação —
inclusive porque a calibração atual dos limiares (7%/12%) é exatamente um
caso onde isso não foi refeito depois de duas mudanças de premissa, e é
parte do que este plano quer corrigir.

## Métricas de sucesso deste trabalho (não é win rate)

- Redução de variância: desvio padrão do PnL por trade, ou drawdown
  intra-sessão, comparando antes/depois da calibração.
- Contrafactual do CONTEXT_GATE mostrando taxa de acerto dos vetos (ideal:
  alta — confirma que o gate está vetando os trades certos).
- Menos concentração de perda num único ativo/lado (se essa for a causa
  raiz achada no Passo 1.3).

Não é meta deste trabalho fazer o win rate global chegar a nenhum número
específico — é reduzir o "ruído" ao redor da expectância já positiva medida.
