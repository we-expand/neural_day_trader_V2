/**
 * Cesta usada pelo cérebro LLM ativo no trilho MT5 (2026-08-29+).
 *
 * 🔴 2026-08-29 (pedido do Cleber, mesmo dia): cesta trocada pra rodar HOJE
 * com estes 8 símbolos especificamente (confirmados pelo Cleber como
 * existentes na Infinox/MetaTrader com esta MESMA nomenclatura, e testados
 * ao vivo contra /mt5-prices por este agente antes de entrar aqui -- todos
 * devolveram bid/ask reais). Forex tirado por completo por enquanto -- só
 * cripto/cross hoje. Objetivo: o agente analisar esta cesta específica hoje
 * pra informar a operação de amanhã.
 *
 * 🔴 2026-08-30 (pedido do Cleber): XPTUSD (platina) removido da cesta.
 * Investigação da sessão anterior (SESSAO_2026-08-30_FEED_TRAVADO_E_SPREAD_
 * ANORMAL.md) já tinha neutralizado o dano (trava de tick obsoleto bloqueava
 * abertura e tirava o tick morto do histórico), mas o ativo seguia ocupando
 * um slot da cesta e gerando warning todo fim de semana sem nunca poder
 * operar de verdade (mercado de metal fechado, feed morto ~30h). Sem motivo
 * pra manter na cesta.
 */
export const MT5_ASSET_BASKET = [
  "BTCUSD", "XETUSD", "SOLUSD", "DOGUSD", "DOTUSD", "XRPUSD", "BTCXBN",
];

/**
 * `lotSize` de cada símbolo. Os 5 já validados em sessões anteriores mantêm
 * o valor confirmado; os novos (DOGUSD, DOTUSD, XRPUSD, BTCXBN) seguem o
 * MESMO padrão (lotSize=1) dos demais cripto/cross desta cesta -- não há
 * entrada equivalente no catálogo estático do app pra confirmar contra
 * (esses símbolos com esta nomenclatura exata não estão em
 * `assetDatabase.ts`), então usa o padrão já validado em vez de inventar um
 * valor. Se o tamanho de posição parecer estranho pra algum desses,
 * revisitar.
 */
export const LOT_SIZE: Record<string, number> = {
  BTCUSD: 1,
  XETUSD: 1,
  SOLUSD: 1,
  DOGUSD: 1,
  DOTUSD: 1,
  XRPUSD: 1,
  BTCXBN: 1,
};

export const MIN_LOTS = 0.01;

// Nenhum símbolo de forex na cesta de hoje -- todos operam 24/7, sem janela
// de fechamento de fim de semana.
const FOREX_SYMBOLS = new Set<string>([]);

/**
 * Forex (via CFD MetaAPI/Infinox) fecha no fim de semana -- mesmo horário
 * que `isCfdMarketOpen()` em `src/app/utils/marketHours.ts` (repo
 * principal). Mantido aqui mesmo com a cesta de hoje sem forex, pra não
 * precisar reintroduzir a lógica se a cesta voltar a incluir forex amanhã.
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
  if (!FOREX_SYMBOLS.has(symbol)) return true; // cripto/cross: sempre
  return isForexMarketOpen(now);
}

/**
 * Grupos de ativos correlacionados. Achado real (2026-08-29): stackear a
 * MESMA aposta direcional em vários cripto ao mesmo tempo (ex: SHORT em
 * BTCUSD+XETUSD+SOLUSD simultâneo) não é diversificação, é triplicar
 * (quintuplicar, aqui) o mesmo risco -- `getCorrelatedGroup` devolve o grupo
 * do símbolo (ou o próprio símbolo isolado se não tiver grupo), pra
 * `open_position` somar a exposição do GRUPO inteiro no mesmo lado antes de
 * liberar mais uma entrada.
 *
 * 🔴 2026-08-29 (cesta de hoje): BTCUSD/XETUSD/SOLUSD/DOGUSD/DOTUSD/XRPUSD/
 * BTCXBN são todos cripto (ou cross de cripto) -- mesmo grupo.
 */
const CORRELATED_GROUPS: string[][] = [
  ["BTCUSD", "XETUSD", "SOLUSD", "DOGUSD", "DOTUSD", "XRPUSD", "BTCXBN"],
];

export function getCorrelatedGroup(symbol: string): string[] {
  return CORRELATED_GROUPS.find((group) => group.includes(symbol)) ?? [symbol];
}
