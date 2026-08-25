/**
 * Gate de viabilidade por custo — Componente 1 do cérebro de execução
 * (decisão (B), `research/AI_BRAIN_SPEC.md` seção 14.5, `CLAUDE.md` pendência
 * #5). Aritmética pura, zero previsão: recusa operar onde o custo estimado
 * de round-trip devora fração grande demais do movimento típico esperado.
 *
 * Números-fonte da CALIBRAÇÃO dos limiares (seção 14.3 da spec, BTCUSDT, com o
 * custo round-trip de 0,26% que se acreditava real à época):
 *   15m: movimento típico 1,05% (MEDIDO, n=4.058) -> custo = 25% do movimento -> INVIÁVEL
 *   1h:  movimento típico 2,52% (MEDIDO, n=973)   -> custo = 10% do movimento -> FRONTEIRA
 *   4h:  movimento típico ~5%  (EXTRAPOLADO √t)   -> custo = ~5%  do movimento -> VIÁVEL
 *   1d:  movimento típico ~12% (EXTRAPOLADO √t)   -> custo = ~2%  do movimento -> VIÁVEL
 *
 * Os limiares de classificação (7% / 12%) são uma leitura dessas 4 medições,
 * não um número novo pesquisado: escolhidos para que 15m (25%) caia em
 * INVIAVEL, 1h (10%) em FRONTEIRA, e 4h/1d (5%/2%) em VIAVEL — reproduzindo a
 * coluna "Viável?" da tabela 14.3. **Os limiares continuam válidos** — eles
 * mapeiam RAZÃO custo/movimento para viabilidade e não dependem do valor
 * absoluto do custo.
 *
 * ⚠️ ATUALIZAÇÃO 2026-08-02 — o custo de entrada mudou, a tabela acima não.
 * O `0,26%` era ~18x o custo real de cripto CFD (`research/CostModel.ts`, classe
 * CRYPTO, corrigida para 0,0291% — ver comentário lá). Consequências, ambas reais:
 *
 *   1. Com o custo corrigido, os 4 timeframes de BTCUSDT acima passam a VIAVEL
 *      (razões 2,8% / 1,2% / 0,6% / 0,2%). Para cripto, este gate deixa de ser
 *      restritivo em timeframe intradiário e só morde em regime muito parado
 *      (ATR < ~0,42% do preço). Para forex/índice, cujos custos NÃO mudaram,
 *      ele continua mordendo normalmente (EURUSD 15m ainda reprova).
 *   2. A confirmação executável que a seção 14.3 usava — 15m pooled -US$1.447,73
 *      (DSR 0%), 1h pooled -US$73,55 (DSR 35,9%) — RODOU COM O CUSTO INFLADO.
 *      Aqueles prejuízos são em parte artefato do parâmetro errado e **não
 *      confirmam mais nada** sobre viabilidade de 15m/1h. Precisam ser remedidos
 *      antes de voltarem a ser citados como evidência.
 *
 * O gate segue NÃO aprovando FRONTEIRA por padrão — isso é escolha de projeto
 * (margem de segurança), não mais uma conclusão herdada daqueles backtests.
 *
 * ⚠️ ATUALIZAÇÃO 2026-08-17 — MUDOU O DENOMINADOR, não os limiares.
 * O motor ao vivo (`runTradingCycle.ts`) passou a informar como
 * `typicalMovementPercent` a DISTÂNCIA ATÉ O ALVO do trade (hoje 3,75×ATR:
 * stop 1,5×ATR × R:R 2,5 — ver `resolveAtrTargets`), em vez do ATR de UMA
 * barra. Motivo: a pergunta que este gate responde é "o custo devora fração
 * grande demais do movimento que preciso capturar?", e o movimento que o trade
 * precisa capturar é o alvo dele. A tabela 14.3 acima usava movimento de barra
 * porque naquele desenho não existia alvo explícito em ATR; desde que o
 * stop/alvo passou a ser dimensionado por ATR, o denominador certo é o alvo.
 * Medir contra 1 barra inflava a razão custo/movimento por 3,75x e reprovava
 * setups cujo alvo comporta o custo com folga — medido com dado real de
 * produção: XAUUSD com custo 0,0077% e ATR de barra 0,0422% era reprovado
 * (18,2%), e contra o alvo real fica em 4,9%, VIÁVEL.
 * Os limiares 7%/12% NÃO foram tocados: eles mapeiam uma razão, e a razão
 * agora responde à pergunta certa. Asserções em `__validate__costclass__.ts`.
 */

import { CRYPTO_CFD_ROUND_TRIP_COST_PERCENT } from '../../../../research/CostModel.ts';

export type CostViabilityClassification = 'VIAVEL' | 'FRONTEIRA' | 'INVIAVEL';

export interface CostViabilityResult {
  costPercent: number;
  typicalMovementPercent: number;
  costAsPercentOfMovement: number;
  classification: CostViabilityClassification;
  approved: boolean;
  reason: string;
}

const FRONTEIRA_THRESHOLD = 0.07; // acima disso, custo já compromete demais o movimento
const INVIAVEL_THRESHOLD = 0.12;  // acima disso, custo domina o resultado esperado

/**
 * Fração do alvo que o motor de fato CAPTURA — MEDIDO em produção, não estimado.
 *
 * A atualização de 2026-08-17 (acima) trocou o denominador do gate para a
 * distância até o alvo (3,75×ATR), argumentando que "o movimento que o trade
 * precisa capturar é o alvo dele". O argumento está certo sobre a intenção do
 * trade e errado sobre o resultado dele: o alvo só é atingido quando o trade dá
 * TP, o que aconteceu em 13,4% dos casos. Medir o custo contra um movimento que
 * 86,6% dos trades nunca alcançam superestima sistematicamente o quanto há para
 * capturar, e aprova setups cujo custo não cabe no movimento REAL.
 *
 * MEDIÇÃO (Supabase, `ai_trades`, 30 dias, n=220 trades fechados):
 *   fator = |preço_saída − preço_entrada| / |take_profit − preço_entrada|
 *
 *   média   = 0,4003
 *   mediana = 0,4006      ← média ≈ mediana: distribuição comportada, número robusto
 *   alvo médio     = 1,055% do preço
 *   realizado médio = 0,401% do preço
 *
 * Estabilidade por ativo (só os com n ≥ 15): SOLUSD 0,378 (n=74), ETHUSD 0,410
 * (n=71), XAUUSD 0,416 (n=24), UKOUSD 0,370 (n=19). O fator é consistente entre
 * ativos, então usa-se um valor GLOBAL — os símbolos com n < 20 não sustentam
 * fator próprio, e inventar um por ativo seria fabricar precisão inexistente.
 *
 * Efeito: o gate passa a medir o custo contra 40% do alvo, ficando ~2,5× mais
 * rigoroso do que estava desde 2026-08-17. Os limiares 7%/12% NÃO mudam — eles
 * mapeiam uma razão, e a razão agora responde à pergunta certa pela segunda vez:
 * de "o custo cabe no movimento de uma barra?" (pré-08-17, pessimista 3,75×)
 * para "cabe no alvo?" (08-17, otimista 2,5×) para "cabe no que realmente se
 * captura?" (agora, medido).
 *
 * ⚠️ RECALIBRAR quando a mecânica de saída mudar. O fator é uma propriedade do
 * conjunto {stop, alvo, breakeven, trailing} atual, não uma constante de
 * mercado. A mudança de breakeven de +1R para +1,5R feita nesta mesma sessão
 * tende a AUMENTAR este fator (menos saídas em zero) — remedir depois de ~200
 * trades novos e atualizar aqui, com o n declarado.
 */
export const TARGET_REALIZATION_FACTOR = 0.40;

/** n da medição de `TARGET_REALIZATION_FACTOR`, para rastreabilidade. */
export const TARGET_REALIZATION_SAMPLE_SIZE = 220;

/**
 * Converte a distância até o alvo no movimento que se espera de fato capturar,
 * aplicando o fator medido. Existe como função (e não multiplicação inline nos
 * chamadores) porque o motor ao vivo, a UI de viabilidade e o ranking de ativos
 * precisam do MESMO número — replicar essa aritmética por fora já foi a causa
 * de um bug real neste projeto (pointValue divergente, 2026-08-05).
 */
export function expectedRealizedMovementPercent(
  targetDistancePercent: number,
  realizationFactor: number = TARGET_REALIZATION_FACTOR,
): number {
  return targetDistancePercent * realizationFactor;
}

/**
 * Avalia se um custo estimado (round-trip, em % do notional) é viável frente
 * ao movimento típico esperado no horizonte (também em % do preço). Não
 * assume nenhuma fonte de movimento — quem chama precisa fornecer um número
 * medido ou uma extrapolação explicitamente marcada (nunca fabricar dado).
 */
export function evaluateCostViability(costPercent: number, typicalMovementPercent: number): CostViabilityResult {
  if (costPercent < 0 || typicalMovementPercent < 0) {
    throw new Error('CostViabilityGate: costPercent e typicalMovementPercent não podem ser negativos');
  }
  if (typicalMovementPercent === 0) {
    return {
      costPercent,
      typicalMovementPercent,
      costAsPercentOfMovement: Infinity,
      classification: 'INVIAVEL',
      approved: false,
      reason: 'movimento típico é zero — custo é infinitamente maior que o movimento esperado',
    };
  }

  const ratio = costPercent / typicalMovementPercent;

  let classification: CostViabilityClassification;
  let reason: string;
  if (ratio <= FRONTEIRA_THRESHOLD) {
    classification = 'VIAVEL';
    reason = `custo consome ${(ratio * 100).toFixed(1)}% do movimento típico (≤ ${FRONTEIRA_THRESHOLD * 100}%)`;
  } else if (ratio <= INVIAVEL_THRESHOLD) {
    classification = 'FRONTEIRA';
    reason = `custo consome ${(ratio * 100).toFixed(1)}% do movimento típico — fronteira (seção 14.3: 1h pooled real perdeu dinheiro nesta faixa)`;
  } else {
    classification = 'INVIAVEL';
    reason = `custo consome ${(ratio * 100).toFixed(1)}% do movimento típico (> ${INVIAVEL_THRESHOLD * 100}%) — custo domina o resultado esperado`;
  }

  return {
    costPercent,
    typicalMovementPercent,
    costAsPercentOfMovement: ratio,
    classification,
    approved: classification === 'VIAVEL',
    reason,
  };
}

/**
 * Movimento típico medido/extrapolado para BTCUSDT (seção 14.3 da spec) —
 * único instrumento com medição real neste projeto até agora. Não usar para
 * outro ativo sem medição própria (violaria a regra de nunca fabricar dado).
 */
export const BTCUSDT_TYPICAL_MOVEMENT_PERCENT: Record<'15m' | '1h' | '4h' | '1d', { value: number; source: 'MEDIDO' | 'EXTRAPOLADO' }> = {
  '15m': { value: 1.05, source: 'MEDIDO' },
  '1h': { value: 2.52, source: 'MEDIDO' },
  '4h': { value: 5, source: 'EXTRAPOLADO' },
  '1d': { value: 12, source: 'EXTRAPOLADO' },
};

/**
 * Custo round-trip herdado da calibração de 2026-07-24 — ⚠️ medido depois como
 * ~18x alto. Exportado só para os testes conseguirem travar a calibração dos
 * limiares 7%/12% contra a tabela 14.3 original. **Não usar como custo.**
 */
export const LEGACY_CRYPTO_ROUND_TRIP_COST_PERCENT = 0.26;

/**
 * Conveniência para o caso já medido nesta pesquisa: BTCUSDT, custo round-trip
 * de cripto CFD vindo de `research/CostModel.ts` (fonte única — 0,0291% desde a
 * correção de 2026-08-02). O parâmetro segue aberto para comparar cenários.
 */
export function evaluateCostViabilityForBTCUSDT(
  timeframe: '15m' | '1h' | '4h' | '1d',
  costPercent = CRYPTO_CFD_ROUND_TRIP_COST_PERCENT,
): CostViabilityResult & { movementSource: 'MEDIDO' | 'EXTRAPOLADO' } {
  const movement = BTCUSDT_TYPICAL_MOVEMENT_PERCENT[timeframe];
  return { ...evaluateCostViability(costPercent, movement.value), movementSource: movement.source };
}
