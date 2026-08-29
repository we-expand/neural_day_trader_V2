/**
 * Cesta usada pelo cérebro LLM ativo no trilho MT5 (2026-08-29) -- subconjunto
 * líquido e de nome já confirmado idêntico entre o catálogo unificado do
 * Neural Day Trader e a corretora Infinox (ver `brokerRegistry.ts` no repo
 * principal: nenhum destes símbolos tem override de nome), pra evitar
 * duplicar aqui a tabela inteira de tradução de símbolo. Cobre forex maior,
 * ouro e os dois índices/cripto com CFD confirmado que também aparecem no
 * motor mecânico.
 */
export const MT5_ASSET_BASKET = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "NAS100", "US30", "BTCUSD"];

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
  XAUUSD: 100,
  NAS100: 1,
  US30: 1,
  BTCUSD: 1,
};

export const MIN_LOTS = 0.01;
