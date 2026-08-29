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
