/**
 * CostModel — estimativa de custo real de execução (spread + comissão + slippage),
 * usada pelo research/CRITERIA.md para converter retorno BRUTO em retorno LÍQUIDO
 * antes de qualquer decisão de promoção pra produto.
 *
 * Consumido por scripts de pesquisa em research/experiments/*, junto do
 * MarketScoreValidator.ts, pra medir edge líquido — e, desde 2026-07-30, também
 * pelo caminho de produto: `useApexLogic.ts` chama `estimateCostPercent()` no
 * gate de viabilidade por custo (`src/app/services/risk/CostViabilityGate.ts`,
 * Componente 1 do cérebro de execução, decisão (B) da seção 14.5 do
 * AI_BRAIN_SPEC.md) antes de abrir qualquer posição.
 *
 * CALIBRADO EM 2026-07-24 contra pesquisa real de corretoras concorrentes da
 * Infinox (IC Markets, Pepperstone, FXTM, Exness — contas Raw/ECN, que são o
 * modelo relevante para um sistema automatizado via MT5/MetaAPI, não conta
 * Standard de varejo iniciante). Ver research/AI_BRAIN_SPEC.md para o relatório
 * completo com fontes. Números "iguais ou um pouco abaixo" da concorrência —
 * nem o mais caro do mercado, nem uma promessa de spread irrealista.
 *
 * Onde a pesquisa não achou dado publicado direto (EURGBP minor, USDZAR, ação
 * CFD), o número abaixo é uma extrapolação explícita marcada como tal — nunca
 * apresentada como fato confirmado. Recalibrar quando houver dado real de
 * execução (comparar preço solicitado vs. preço reportado por /broker/execute).
 *
 * ⚠️ CORREÇÃO 2026-08-02 — classe CRYPTO recalibrada (era ~18x alta).
 * A calibração de 2026-07-24 pôs `commissionPercent: 0.08` em CRYPTO, número
 * compatível com taxa de EXCHANGE SPOT (Binance/Coinbase), não com CFD — onde
 * não existe comissão separada, só o spread. Round-trip resultante: 0,26%.
 * A medição real (Pepperstone, BTCUSD, janela 01–30/04/2026) dá 0,0145% de
 * spread round-trip. Ver `research/experiments/2026-07-30-sma-pullback-crossasset/HANDOFF.md`
 * (achado #1) e `research/experiments/2026-08-02-viability-gates/verdict.md` (seção 1),
 * que quantificou o impacto: com 0,26% o gate de viabilidade exige sinal 4,4x mais
 * forte que o melhor `k` já medido no projeto — reprova qualquer coisa por construção.
 * Detalhe da nova decomposição nas constantes abaixo.
 */

export type AssetClass = 'FOREX_MAJOR' | 'FOREX_MINOR' | 'FOREX_EXOTIC' | 'INDEX' | 'COMMODITY' | 'CRYPTO' | 'STOCK';

export interface CostEstimate {
  spreadPoints: number;
  commissionPercent: number;
  slippagePoints: number;
}

// Round-trip total recomendado por classe (research/AI_BRAIN_SPEC.md, 2026-07-24):
//   FOREX_MAJOR  0,8-1,0 pip  -> spread 0,1 (Raw) + comissão embutida como pontos equivalentes
//   FOREX_MINOR  1,2-1,5 pips -> SEM dado publicado direto; extrapolado como +50% sobre major
//   FOREX_EXOTIC 15-20 pips   -> ancorado em USDTRY real (~16 pips, Pepperstone)
//   INDEX        spread pequeno relativo ao nível de preço (Pepperstone US30 ~30 pts em ~44000)
//   COMMODITY    XAUUSD 1,0-1,5 pip (Infinox/Pepperstone Raw)
//   CRYPTO       spread modelado em % do notional, não pips fixos (cripto tem spread proporcional ao preço)
//   STOCK        NÃO pesquisado nesta rodada — mantido o valor anterior, marcado como pendente

/**
 * Spread round-trip MEDIDO de cripto CFD, em % do notional.
 *
 * Fonte: Pepperstone, BTCUSD, spread médio 15,82 USD sobre preço 108.829,77,
 * janela 01–30/04/2026, sem comissão separada (cripto CFD não cobra comissão).
 * Registrado em `research/experiments/2026-07-30-sma-pullback-crossasset/HANDOFF.md`,
 * achado #1, e usado como custo real em `scripts/trailing.py` do mesmo experimento.
 *
 * É round-trip, não por perna: num instrumento com spread, entra-se no ask e
 * sai-se no bid — o spread inteiro é pago UMA vez ao longo do ciclo completo.
 * Por isso o custo por perna da COST_TABLE é metade deste número.
 *
 * A Infinox (corretora de referência) não publica custo de cripto em nenhuma
 * fonte verificável — nem Trading Conditions, nem Product Information listam
 * BTCUSD. Este número é de terceiro, declarado como tal, não da corretora
 * própria. Recalibrar quando houver execução real medida.
 */
export const CRYPTO_CFD_SPREAD_ROUND_TRIP_PERCENT = (15.82 / 108_829.77) * 100; // 0,01454%

/**
 * Provisão de slippage por perna para cripto CFD — ⚠️ NÃO MEDIDA.
 *
 * Não existe medição de slippage de cripto CFD neste projeto (a única medição é
 * de spread). Escolha deliberada e conservadora: reservar um spread inteiro
 * ADICIONAL ao longo do round-trip, o que leva o custo total a 0,0291% —
 * exatamente a leitura `cryptoCfdConservative` do experimento
 * `2026-08-02-viability-gates` (`scripts/gates.mjs`, COST_SOURCES).
 *
 * Por que a leitura conservadora e não os 0,0145% otimistas: este número alimenta
 * um gate que decide entrada com dinheiro real. Errar para o lado caro recusa
 * trades viáveis (custo mensurável); errar para o lado barato aprova trades
 * inviáveis (perda direta). Trocar por `0` reproduz a leitura otimista — mudança
 * de uma linha, se algum dia houver medição de execução real que a justifique.
 */
const CRYPTO_CFD_SLIPPAGE_PER_LEG_PERCENT = CRYPTO_CFD_SPREAD_ROUND_TRIP_PERCENT / 2; // 0,00727%

/** Custo round-trip total de cripto CFD em % do notional — 0,0291% (spread medido + provisão de slippage). */
export const CRYPTO_CFD_ROUND_TRIP_COST_PERCENT =
  (CRYPTO_CFD_SPREAD_ROUND_TRIP_PERCENT / 2 + CRYPTO_CFD_SLIPPAGE_PER_LEG_PERCENT) * 2;

const COST_TABLE: Record<AssetClass, CostEstimate> = {
  FOREX_MAJOR: { spreadPoints: 0.5, commissionPercent: 0, slippagePoints: 0.2 },   // spread Raw ~0,1 + comissão (~$7/lote ≈ 0,5-0,7pt em EURUSD) + slippage residual
  FOREX_MINOR: { spreadPoints: 1.0, commissionPercent: 0, slippagePoints: 0.3 },   // ⚠️ extrapolado (sem dado direto): ~+50% sobre major
  FOREX_EXOTIC: { spreadPoints: 12.0, commissionPercent: 0, slippagePoints: 3.0 }, // ancorado em USDTRY real (~16pt spread), com folga p/ slippage de baixa liquidez
  INDEX: { spreadPoints: 3.0, commissionPercent: 0, slippagePoints: 1.5 },        // Pepperstone US30 Raw; gaps de abertura de sessão contam no slippage
  COMMODITY: { spreadPoints: 1.2, commissionPercent: 0, slippagePoints: 0.5 },     // XAUUSD Raw (Infinox/Pepperstone)
  // ⚠️ CORRIGIDO 2026-08-02 (era `{ spreadPoints: 0, commissionPercent: 0.08, slippagePoints: 0.05 }`
  // = 0,26% round-trip, ~18x o medido). spreadPoints/slippagePoints de CRYPTO são
  // percentuais diretos do notional POR PERNA (0,05 = 0,05%), não pontos em dólar.
  // commissionPercent volta a 0: cripto CFD não tem comissão separada — os 0,08%
  // antigos eram taxa de exchange spot, instrumento diferente.
  CRYPTO: {
    spreadPoints: CRYPTO_CFD_SPREAD_ROUND_TRIP_PERCENT / 2, // 0,00727% por perna (spread round-trip medido ÷ 2)
    commissionPercent: 0,
    slippagePoints: CRYPTO_CFD_SLIPPAGE_PER_LEG_PERCENT,    // 0,00727% por perna — ⚠️ provisão, não medição
  },
  STOCK: { spreadPoints: 0, commissionPercent: 0.05, slippagePoints: 0.1 },        // ⚠️ NÃO pesquisado nesta rodada (2026-07-24) — valor anterior mantido, pendente calibração real
};

/**
 * Custo estimado por trade, em % do valor nocional. Usar pra descontar de
 * qualquer retorno bruto medido pelo MarketScoreValidator antes de comparar
 * contra o piso de amostra/degradação do CRITERIA.md.
 */
export function estimateCostPercent(assetClass: AssetClass, priceLevel: number, pointValue: number): number {
  const cost = COST_TABLE[assetClass];
  // CRYPTO: bug encontrado na seção 11.13 do AI_BRAIN_SPEC.md — a fórmula
  // pontos÷preço abaixo é calibrada pra classes com "ponto" fixo em preço
  // (pip forex, tick de índice), onde pointValue converte corretamente.
  // O comentário da COST_TABLE já dizia "cripto tem spread proporcional ao
  // preço, não pips fixos" mas a implementação nunca tratou esse caso — pra
  // ativos de escala BTC/ETH (milhares de dólares) o erro é desprezível, mas
  // pra moedas sub-US$1 (DOGE, XRP, ADA) a mesma fórmula gera custo de
  // dezenas/centenas de % por trade (ex.: DOGEUSDT ~US$0,073, o slippagePoints
  // 0,05 de então ÷ preço = 68% só de slippage numa perna). spreadPoints/
  // slippagePoints de CRYPTO são percentuais diretos do notional por perna
  // (0,00727 = 0,00727%), não pontos em dólar.
  if (assetClass === 'CRYPTO') {
    const spreadCost = cost.spreadPoints / 100;
    const slippageCost = cost.slippagePoints / 100;
    return spreadCost + slippageCost + cost.commissionPercent / 100;
  }
  const spreadCost = (cost.spreadPoints * pointValue) / priceLevel;
  const slippageCost = (cost.slippagePoints * pointValue) / priceLevel;
  return spreadCost + slippageCost + cost.commissionPercent / 100;
}

/**
 * Converte retorno bruto (%) num trade em retorno líquido, descontando o custo
 * estimado de entrada + saída (o round-trip completo, não só uma perna).
 */
export function toNetReturn(grossReturnPercent: number, assetClass: AssetClass, priceLevel: number, pointValue: number): number {
  const roundTripCost = estimateCostPercent(assetClass, priceLevel, pointValue) * 2;
  return grossReturnPercent - roundTripCost * 100;
}

/**
 * Gate de viabilidade (research/AI_BRAIN_SPEC.md seção 4): converte custo real
 * na taxa de acerto mínima que uma estratégia precisa atingir só pra empatar
 * com o custo de operar — abaixo disso, o setup tem expectativa negativa
 * garantida, não importa quão bom pareça o sinal.
 *
 *   p_min = (L + C) / (R + L)
 *
 * onde R = alvo em pontos, L = stop em pontos, C = custo round-trip em pontos
 * (spread+comissão+slippage, ida e volta — já é o dobro do custo por perna).
 *
 * Uso pretendido: antes de qualquer entrada em modo Scalper (alvo pequeno,
 * custo pesa proporcionalmente mais), comparar `pMin` contra a taxa de acerto
 * REAL medida da estratégia nesse ativo/timeframe (via MarketScoreValidator ou
 * histórico de trades fechados) — se a taxa medida não superar `pMin` com
 * margem de segurança, recusar a entrada e registrar o motivo. Ainda não
 * ligado a nenhum caminho de produto (mesma situação do resto deste arquivo)
 * — é o próximo passo depois desta calibração.
 */
export function breakEvenWinRate(targetPoints: number, stopPoints: number, roundTripCostPoints: number): number {
  if (targetPoints <= 0 || stopPoints <= 0) return 1; // configuração inválida — trata como inviável
  return (stopPoints + roundTripCostPoints) / (targetPoints + stopPoints);
}

/**
 * Custo round-trip total em PONTOS (não %) para uma classe de ativo — forma
 * mais direta de comparar contra targetPoints/stopPoints de uma estratégia,
 * que já são expressos em pontos no motor (ver Strategy.stopLoss/takeProfit).
 */
export function roundTripCostPoints(assetClass: AssetClass): number {
  const cost = COST_TABLE[assetClass];
  // Cripto é modelada em % do notional (spread proporcional ao preço), não
  // pips fixos — não tem conversão direta pra "pontos" sem o preço do ativo;
  // retorna 0 aqui de propósito, o chamador deve usar estimateCostPercent
  // pra essa classe em vez deste helper.
  if (assetClass === 'CRYPTO') return 0;
  return (cost.spreadPoints + cost.slippagePoints) * 2;
}
