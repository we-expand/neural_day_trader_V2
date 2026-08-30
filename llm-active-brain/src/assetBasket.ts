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
 *
 * 🔴 2026-08-30 (redesenho pós "1,7% de acerto, -$124/-$135 líquido, sessão
 * e7eef768"): SOLUSD removido -- diagnóstico via SQL direto em `ai_trades`
 * (não suposição) mostrou SOLUSD sozinho respondendo por 13/66 trades da
 * sessão, 0 VITÓRIAS, -$77,67 (57% de TODO o prejuízo líquido da noite).
 * Padrão observado em 10 dos 13 trades: fechamento por stop em MENOS DE 1
 * MINUTO após a abertura (17-50s), perda quase idêntica a cada vez (~0,50%-
 * 0,55%, ~$6), em AMBAS as direções (5 LONG perdedores, 8 SHORT perdedores --
 * não é viés de lado, é o símbolo). Nenhum outro símbolo da cesta mostrou
 * esse padrão (BTCUSD e BTCXBN tiveram pelo menos 1 vitória cada, XRPUSD/
 * DOGUSD tiveram perdas pequenas, não $6 batendo quase toda vez). Isso é
 * consistente com o stop dinâmico (calculado por ATR de candle de 5m) sendo
 * SISTEMATICAMENTE apertado demais pro ruído de tick-a-tick real de SOLUSD
 * nesta corretora/feed especificamente -- o candle de 5m não captura a
 * volatilidade de curtíssimo prazo que bate o stop antes de qualquer tese
 * direcional ter chance real de se confirmar. Removido pendente de
 * investigação dedicada (comparar ATR-do-candle vs volatilidade real de tick
 * a tick pra este símbolo especificamente antes de reintroduzir) -- ver
 * SESSAO_2026-08-30_MONITORAMENTO_NOTURNO_LLM_BRAIN_E_ACHADOS_CRITICOS.md.
 */
/**
 * 🔴 2026-08-30 (pedido do Cleber, mesma sessao de monitoramento): 4 simbolos
 * adicionados -- SOLUSD, ADAUSD, LNKUSD, UNIUSD. Todos testados AO VIVO
 * contra /mt5-prices antes de entrar aqui, todos devolveram bid/ask reais
 * (LNKUSD confirmado como nomenclatura certa da corretora -- "LINKUSD" da
 * 404). SOLUSD MERECE ATENCAO: foi removido desta cesta mais cedo hoje por
 * ter respondido por 57% de todo o prejuizo da sessao anterior (13 trades,
 * 0 vitorias, stop batendo em <1min sistematicamente em ambas direcoes --
 * ver comentario historico abaixo). Causa nunca foi investigada a fundo,
 * so removido por precaucao. Reintroduzido agora a pedido explicito do
 * Cleber -- MACD/Estocastico reais e o validador semantico contra dado real
 * (ambos adicionados nesta mesma sessao) podem mudar o comportamento, mas
 * isso NAO foi validado especificamente pra SOLUSD ainda. Monitorar de perto.
 */
export const MT5_ASSET_BASKET = [
  "BTCUSD", "XETUSD", "DOGUSD", "DOTUSD", "XRPUSD", "BTCXBN",
  "SOLUSD", "ADAUSD", "LNKUSD", "UNIUSD",
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
  DOGUSD: 1,
  DOTUSD: 1,
  XRPUSD: 1,
  BTCXBN: 1,
  SOLUSD: 1,
  ADAUSD: 1,
  LNKUSD: 1,
  UNIUSD: 1,
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
 * 🔴 2026-08-29 (cesta de hoje): BTCUSD/XETUSD/DOGUSD/DOTUSD/XRPUSD/BTCXBN
 * são todos cripto (ou cross de cripto) -- mesmo grupo. 2026-08-30: SOLUSD/
 * ADAUSD/LNKUSD/UNIUSD adicionados ao mesmo grupo (mesma lógica -- todos
 * cripto, mesmo risco correlacionado de mercado).
 */
const CORRELATED_GROUPS: string[][] = [
  ["BTCUSD", "XETUSD", "DOGUSD", "DOTUSD", "XRPUSD", "BTCXBN", "SOLUSD", "ADAUSD", "LNKUSD", "UNIUSD"],
];

export function getCorrelatedGroup(symbol: string): string[] {
  return CORRELATED_GROUPS.find((group) => group.includes(symbol)) ?? [symbol];
}
