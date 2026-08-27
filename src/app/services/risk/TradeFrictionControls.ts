/**
 * Controles de fricção — reduzem o CUSTO TOTAL do motor, não melhoram o sinal.
 *
 * POR QUE ISSO EXISTE (medição de produção, 2026-08-25, n=217 trades / 14 dias):
 *
 *   EV bruto por trade  = −US$0,123  (t = −0,78 → indistinguível de zero)
 *   EV líquido por trade = −US$0,294  (t = −1,81)
 *   Notional girado      = US$127.603 sobre uma conta de ~US$100 (1.276×)
 *
 * Ou seja: o sinal não perde dinheiro, ele apenas não ganha — exatamente o que
 * `AI_BRAIN_SPEC.md` já concluía (sem edge comprovado ⇒ EV ≈ −custo). 58% da
 * perda esperada vem de custo de execução e 42% de deriva de sinal que não é
 * estatisticamente significativa.
 *
 * A consequência prática é dura e vale registrar: com EV bruto ≈ 0, NENHUM
 * ajuste de sinal (R:R, limiar de confiança, indicador novo) muda o resultado
 * esperado — só muda a variância. A única alavanca com efeito garantido é
 * `custo = notional girado × taxa`. Este módulo ataca os dois fatores:
 *
 *   - `clampToLeverageCap`   → reduz o notional de cada trade
 *   - `isSymbolInCooldown`   → reduz o NÚMERO de trades (churn de reentrada)
 *
 * Ambas as funções são puras e só REDUZEM exposição, nunca aumentam — mesma
 * filosofia dos gates de sizing já existentes em `runTradingCycle.ts`
 * (teto de lotes 2026-08-17, gate de margem 2026-08-19, lote mínimo 2026-08-20).
 */

/**
 * Teto de alavancagem sobre o notional de um único trade, em múltiplos do
 * saldo da conta.
 *
 * CALIBRAÇÃO (dado real de produção, 14 dias, custo estimado à taxa medida de
 * 0,029% do notional por round-trip):
 *
 *   | Símbolo | n  | Notional méd. | Alavancagem | Bruto   | Custo  | Líquido |
 *   |---------|----|---------------|-------------|---------|--------|---------|
 *   | XAUUSD  | 24 | US$2.791      | 28,1×       | +14,33  | 19,43  | −5,10   |
 *   | JP225   |  5 | US$2.028      | 20,4×       |  −1,78  |  2,94  | −4,72   |
 *   | EURUSD  |  2 | US$1.168      | 11,8×       |  +0,12  |  0,68  | −0,56   |
 *   | XAUAUD  |  9 | US$962        |  9,7×       |  −3,84  |  2,51  | −6,35   |
 *   | UKOUSD  | 17 | US$879        |  8,9×       | −18,67  |  4,34  | −23,01  |
 *   | ETHUSD  | 71 | US$141        |  1,4×       |  −3,46  |  2,90  | −6,36   |
 *
 * XAUUSD sozinho consumiu 52,5% de TODO o custo de execução em 11% dos trades,
 * e o bruto de +US$14,33 vira LÍQUIDO −US$5,10 depois do custo. Isso corrige a
 * leitura de 2026-08-21, que atribuía o lucro da sessão overnight ao ouro: com
 * o custo real descontado, o ouro também é negativo. Ele parecia o melhor ativo
 * da cesta apenas porque o custo estava invisível (bug corrigido em 2026-08-23).
 *
 * ⚠️ EFEITO DE PRODUTO ESPERADO, NÃO É BUG: numa conta de ~US$100, um teto de
 * 3× significa notional máximo de ~US$300. O lote mínimo real de XAUUSD (0,01 =
 * 1 onça, ~US$4.590) e o de índices ficam MUITO acima disso, então esses ativos
 * passam a ser recusados adiante por `MIN_TRADE_SIZE` — ou seja, o teto remove
 * de fato ouro/índices da cesta operável enquanto a conta for pequena. Isso é
 * intencional: são exatamente os ativos que o dado acima mostra como
 * destruidores de capital líquido nessa faixa de conta. Conta maior volta a
 * alcançá-los sozinha, sem mudança de código.
 */
export const MAX_NOTIONAL_LEVERAGE = 3;

export interface LeverageCapResult {
  /** Notional aprovado, em US$. Igual à entrada quando não houve corte. */
  notionalUsd: number;
  /** `true` quando o teto mordeu. */
  clamped: boolean;
  /** Notional máximo permitido pelo teto, em US$. */
  capUsd: number;
  /** Alavancagem implícita ANTES do corte (notional / saldo). */
  leverageBefore: number;
}

/**
 * Corta o notional para no máximo `maxLeverage` × saldo da conta.
 *
 * Nunca aumenta o notional: uma conta grande o bastante para o trade original
 * passa sem alteração. Saldo não-positivo devolve o notional intacto e sem
 * corte — sizing sem saldo conhecido é problema de outra camada, e inventar um
 * corte aqui esconderia esse defeito em vez de expô-lo.
 */
export function clampToLeverageCap(
  notionalUsd: number,
  accountBalanceUsd: number,
  maxLeverage: number = MAX_NOTIONAL_LEVERAGE,
): LeverageCapResult {
  if (!(accountBalanceUsd > 0) || !(maxLeverage > 0) || !(notionalUsd > 0)) {
    return { notionalUsd, clamped: false, capUsd: Infinity, leverageBefore: 0 };
  }

  const capUsd = accountBalanceUsd * maxLeverage;
  const leverageBefore = notionalUsd / accountBalanceUsd;

  if (notionalUsd <= capUsd) {
    return { notionalUsd, clamped: false, capUsd, leverageBefore };
  }

  return { notionalUsd: capUsd, clamped: true, capUsd, leverageBefore };
}

/**
 * Cooldown por símbolo depois de FECHAR uma posição nele.
 *
 * POR QUE 20 MINUTOS: medição de produção (14 dias, n=217) mostrou que 72
 * trades (33%) reabriram o MESMO símbolo em menos de 5 minutos do fechamento
 * anterior, e 112 (52%) em menos de 30 minutos. Exemplo literal de 2026-08-25:
 * ETHUSD fechou às 02:49 e reabriu às 02:49, praticamente no mesmo preço —
 * duas comissões pela mesma tese. 23 dessas reentradas rápidas vieram logo
 * após uma saída em breakeven, isto é, o motor pagou round-trip integral para
 * capturar zero e imediatamente pagou de novo.
 *
 * 20 min é o ponto onde o corte pega a maior parte do churn medido (os 72
 * trades de <5min e boa parte da faixa 5-30min) sem cegar o motor por uma
 * janela longa demais — em 5m/15m de timeframe operado, 20 minutos são 4 e ~1,3
 * barras respectivamente, tempo suficiente para o setup que acabou de falhar
 * deixar de ser o mesmo setup.
 *
 * O que isto NÃO é: uma tentativa de melhorar a taxa de acerto. Em EV bruto ≈
 * zero, evitar um trade não muda o resultado esperado do sinal — só economiza o
 * custo daquele round-trip, que é exatamente o ponto.
 *
 * Relação com o `ASSET_ANTI_REPEAT` que já existia (`runTradingCycle.ts`):
 * aquele gate só bloqueia quando o ÚLTIMO trade do ciclo foi no mesmo símbolo,
 * então alternar SOL → ETH → SOL passa direto por ele. Ele registrou apenas 42
 * bloqueios no mesmo período em que 72 reentradas rápidas aconteceram. Este
 * cooldown é por símbolo e por tempo, então cobre o caso real.
 */
export const SYMBOL_COOLDOWN_MS = 20 * 60 * 1000;

/**
 * Gatilho do breakeven automático, em múltiplos do risco original (R).
 *
 * ERA +1R desde 2026-08-17, agora +1,5R. Motivo, com dado real:
 *
 * O breakeven em +1R fecha 27% dos "SL" com |PnL| < US$0,10 (47 de 176 em 14
 * dias) — não são stops sendo acionados, é o stop tendo sido puxado até a
 * entrada e o preço voltando para lá. Sob passeio aleatório, mover o stop para
 * o breakeven é NEUTRO em EV (optional stopping theorem: a esperança de um
 * martingale parado num tempo de parada limitado é o valor inicial). O que ele
 * de fato faz é aumentar o número de round-trips COMPLETOS pagos: o trade fecha
 * em zero, o setup continua válido, o motor reabre e paga custo outra vez —
 * 23 das 72 reentradas em menos de 5 minutos vieram exatamente daí.
 *
 * Quando o EV bruto é ≈ 0 (medido: t = −0,78), um round-trip extra não é
 * neutro: é perda pura do tamanho do custo. Subir o gatilho para +1,5R deixa o
 * trade respirar além do primeiro impulso antes de travar o stop, reduzindo a
 * frequência de saídas em zero.
 *
 * O que este número NÃO faz: melhorar a taxa de acerto ou o EV do sinal. Com
 * edge ≈ 0 nada aqui cria retorno — o ganho é só a economia de custo dos
 * round-trips evitados, e é por isso que 1,5 é um ajuste conservador em vez de
 * um valor "otimizado" contra o histórico (otimizar isso contra 217 trades
 * seria overfitting declarado, ver `AI_BRAIN_SPEC.md` seção 8).
 *
 * Efeito colateral esperado e desejável: mais trades chegam ao TP ou ao SL
 * cheio, o que deve AUMENTAR `TARGET_REALIZATION_FACTOR` (`CostViabilityGate.ts`)
 * — remedir aquele fator depois de ~200 trades novos.
 *
 * 2026-08-26: remedido depois de 2 dias reais em 1,5R — achado contrário ao
 * esperado. 61,8% dos trades reais (76/123) chegaram a ficar no lucro
 * flutuante e fecharam no zero/prejuízo (-US$57,88 de impacto); variando o
 * gatilho sobre o mesmo histórico real (candle real, réplica fiel desta
 * lógica), 1,5R ficou do lado PIOR da curva (-US$2,68 bruto) contra 1R
 * (+US$2,36) e valores mais apertados ainda melhores. Testei o próprio
 * motivo que levou a subir pra 1,5R (custo de reentrada) medindo de novo em
 * produção: reabrir depois de um fechamento perto de zero custa só 9,4pp a
 * mais de chance de reentrada que um fechamento normal (~US$0,70 de custo
 * extra no total da amostra) — não anula a diferença de ~US$12 entre 1,5R e
 * 0,5R. Detalhe completo, reprodutível:
 * `research/experiments/2026-08-26-dynamic-exit-tp-ceiling/verdict.md`
 * (Adendos 1, 2 e 6).
 *
 * MAS: a mesma ressalva de overfitting do parágrafo acima se aplica ao MEU
 * teste também — 123 trades em ~9 dias é pouco pra cravar um valor
 * "ótimo", e otimizar direto contra essa amostra correria o mesmo risco que
 * o comentário original já advertia. Por isso o valor escolhido agora NÃO É
 * o melhor da varredura (0,5R, +US$9,05 ajustado) — é uma reversão
 * conservadora para o valor ANTERIOR já testado em produção de verdade
 * (+1R), que segue solidamente positivo (+US$1,64 ajustado) sem ser a ponta
 * mais extrapolada do teste. Reavaliar de novo depois de mais ~150-200
 * trades reais em 1R antes de cogitar apertar mais.
 */
export const BREAKEVEN_TRIGGER_R = 1.0;

/**
 * Constrói o mapa símbolo → timestamp do último fechamento a partir do
 * histórico de ordens que o motor já carrega.
 *
 * Existe para que o cooldown NÃO precise de um campo novo em
 * `TradingCycleState`: tanto o driver de browser quanto o `ai-runner` já
 * populam `orderHistory` com `closedAt` (ver `ai-runner/index.ts`, "trades
 * fechados hoje"), então derivar daí mantém os dois drivers em sincronia de
 * graça — sem uma segunda fonte de verdade para dessincronizar, que é o
 * defeito estrutural que este projeto já pagou caro (cliente e servidor com
 * lógicas de fechamento independentes, 2026-08-18).
 */
export function buildLastCloseBySymbol(
  orderHistory: ReadonlyArray<{ symbol: string; closedAt?: number }>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const order of orderHistory) {
    if (!order.closedAt || !(order.closedAt > 0)) continue;
    const current = map.get(order.symbol);
    if (current === undefined || order.closedAt > current) {
      map.set(order.symbol, order.closedAt);
    }
  }
  return map;
}

export interface SymbolCooldownResult {
  blocked: boolean;
  /** Milissegundos restantes de cooldown. Zero quando não está bloqueado. */
  remainingMs: number;
  /** Texto pronto para log/telemetria. Vazio quando não está bloqueado. */
  reason: string;
}

/**
 * Diz se um símbolo ainda está no cooldown pós-fechamento.
 *
 * `lastCloseBySymbol` mapeia símbolo → timestamp (ms) do último fechamento
 * naquele símbolo. Símbolo ausente do mapa nunca está em cooldown.
 */
export function isSymbolInCooldown(
  symbol: string,
  lastCloseBySymbol: Record<string, number> | Map<string, number>,
  now: number = Date.now(),
  cooldownMs: number = SYMBOL_COOLDOWN_MS,
): SymbolCooldownResult {
  const lastClose = lastCloseBySymbol instanceof Map
    ? lastCloseBySymbol.get(symbol)
    : lastCloseBySymbol[symbol];

  if (!lastClose || !(cooldownMs > 0)) {
    return { blocked: false, remainingMs: 0, reason: '' };
  }

  const elapsed = now - lastClose;
  // Timestamp no futuro (relógio dessincronizado entre client e servidor) não
  // pode virar cooldown eterno — trata como já vencido.
  if (elapsed < 0 || elapsed >= cooldownMs) {
    return { blocked: false, remainingMs: 0, reason: '' };
  }

  const remainingMs = cooldownMs - elapsed;
  return {
    blocked: true,
    remainingMs,
    reason: `${symbol} fechou posição há ${Math.round(elapsed / 60_000)}min — cooldown de ${Math.round(cooldownMs / 60_000)}min ativo (faltam ${Math.ceil(remainingMs / 60_000)}min) para evitar churn de reentrada`,
  };
}
