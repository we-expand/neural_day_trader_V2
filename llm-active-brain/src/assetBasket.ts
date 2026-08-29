/**
 * Cesta usada pelo cérebro LLM ativo no trilho MT5 (2026-08-29+) -- apenas
 * MOEDAS (forex + cripto). Nenhum commodity (ouro) ou índice.
 *
 * 🔴 2026-08-29 (pedido urgente do Cleber): apenas forex (24/5 durante dia útil)
 * e cripto (24/5 fim de semana). Teste performance ao máximo em moedas puras.
 */
export const MT5_ASSET_BASKET = [
  // Forex (24/5 durante dia útil)
  "EURUSD", "GBPUSD", "USDJPY",
  // Cripto (24/5 — preferencial fim de semana quando forex fica parado)
  "BTCUSD", "ETHUSD", "SOLUSD"
];

/**
 * `lotSize` de cada símbolo — cópia deliberada de `assetDatabase.ts` (repo
 * principal, só pros 7 símbolos desta cesta) pra este projeto Node/tsx não
 * precisar importar a árvore inteira de módulos client-side. Manter em
 * sincronia com aquele arquivo se o catálogo mudar.
 *
 * 🔴 2026-08-29 (achado do Cleber): a ponte abria posição de $10 fixos,
 * independente do símbolo -- pra BTCUSD isso é ~0,0001 lote, ~1% do menor
 * contrato real permitido na plataforma (0,01 lote, confirmado pelo
 * Cleber). O motor mecânico nunca abriria uma posição desse tamanho (gate
 * `MIN_TRADE_SIZE`). Corrigido: o agente agora especifica LOTES (mínimo
 * 0,01), e o notional em dólar é calculado daqui (`lots * lotSize * preço`),
 * igual à conversão que o Dashboard já usa (`lotSizeConversion.ts`).
 */
export const LOT_SIZE: Record<string, number> = {
  EURUSD: 100000,
  GBPUSD: 100000,
  USDJPY: 100000,
  BTCUSD: 1,
  ETHUSD: 1,
  SOLUSD: 1,
};

export const MIN_LOTS = 0.01;
