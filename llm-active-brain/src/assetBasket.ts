/**
 * Cesta usada pelo cérebro LLM ativo no trilho MT5 (2026-08-29+) -- apenas
 * MOEDAS (forex + cripto). Nenhum commodity (ouro) ou índice.
 *
 * 🔴 2026-08-29 (pedido urgente do Cleber): apenas forex (24/5 durante dia útil)
 * e cripto (24/5 fim de semana). Teste performance ao máximo em moedas puras.
 *
 * 🔴 2026-08-29 (achado do Cleber): Ethereum na Infinox/MT5 NÃO se chama
 * "ETHUSD" -- esse símbolo existe no catálogo unificado do app mas roteia
 * pra Binance (fora de escopo aqui). O contrato real cotado no MT5 é
 * "XETUSD" (confirmado em `assetDatabase.ts:151` e `brokerRegistry.ts` do
 * repo principal). Era a causa do "Sem cotacao real disponivel" pra
 * Ethereum nesta cesta.
 */
export const MT5_ASSET_BASKET = [
  // Forex (24/5 durante dia útil)
  "EURUSD", "GBPUSD", "USDJPY",
  // Cripto (24/5 — preferencial fim de semana quando forex fica parado)
  "BTCUSD", "XETUSD", "SOLUSD"
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
  XETUSD: 1,
  SOLUSD: 1,
};

export const MIN_LOTS = 0.01;

const FOREX_SYMBOLS = new Set(["EURUSD", "GBPUSD", "USDJPY"]);

/**
 * Forex (via CFD MetaAPI/Infinox) fecha no fim de semana -- mesmo horário
 * que `isCfdMarketOpen()` em `src/app/utils/marketHours.ts` (repo
 * principal), copiado aqui deliberadamente (mesmo motivo do `LOT_SIZE`
 * acima: este projeto Node/tsx não importa a árvore client-side).
 *
 * 🔴 2026-08-29 (achado do Cleber): sem essa checagem, o agente abria
 * LONG/SHORT em EURUSD/GBPUSD/USDJPY com mercado fechado -- a rota
 * `/mt5-prices` não erra nesse caso, só devolve o último tick conhecido
 * (changePercent trava em 0%), e o agente confundia isso com "mercado
 * parado, sem sinal" em vez de perceber que não dava pra operar ali.
 * Cripto (BTCUSD/XETUSD/SOLUSD) não tem essa restrição -- 24/5 real.
 *
 * Fecha: Sexta 22:00 UTC. Abre: Domingo 23:00 UTC.
 */
export function isForexMarketOpen(now: Date = new Date()): boolean {
  const utcDay = now.getUTCDay(); // 0 = Domingo, 6 = Sábado
  const totalMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  if (utcDay === 6) return false; // Sábado inteiro: fechado
  if (utcDay === 0 && totalMinutes < 23 * 60) return false; // Domingo antes das 23:00 UTC
  if (utcDay === 5 && totalMinutes >= 22 * 60) return false; // Sexta após 22:00 UTC
  return true;
}

export function isSymbolTradable(symbol: string, now: Date = new Date()): boolean {
  if (!FOREX_SYMBOLS.has(symbol)) return true; // cripto: sempre
  return isForexMarketOpen(now);
}

/**
 * Grupos de ativos correlacionados (2026-08-29, otimização urgente pós-perda
 * do dia). Achado real: o teto de "3 posições por símbolo" não impedia o
 * agente de abrir 2-3 SHORT em BTCUSD **e** 2-3 SHORT em SOLUSD **e** 2-3
 * SHORT em XETUSD ao mesmo tempo -- os três são cripto e andam fortemente
 * correlacionados (mesmo regime de mercado, mesmo apetite a risco). Isso não
 * é diversificação: é a MESMA aposta direcional triplicada, com exposição em
 * dólar 3x maior do que o "teto por símbolo" sozinho sugere. `getCorrelatedGroup`
 * devolve o grupo do símbolo (ou o próprio símbolo isolado se não tiver
 * grupo), pra `open_position` somar a exposição do GRUPO inteiro no mesmo
 * lado antes de liberar mais uma entrada.
 */
const CORRELATED_GROUPS: string[][] = [["BTCUSD", "XETUSD", "SOLUSD"]];

export function getCorrelatedGroup(symbol: string): string[] {
  return CORRELATED_GROUPS.find((group) => group.includes(symbol)) ?? [symbol];
}
