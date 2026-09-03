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
 *
 * 🔴 2026-08-31 (monitoramento 5min, sessão `aa279c75...`): SOLUSD removido
 * DE NOVO -- 2ª ocorrência do MESMO padrão. Diagnóstico via SQL direto em
 * `ai_trades` (não suposição): SOLUSD sozinho respondeu por -$48,77 de
 * -$56,46 do PnL total da sessão (86%), em só 4 trades, 0 vitórias -- todas
 * SHORT, todas batendo stop. MACD/Estocástico reais e validador semântico
 * (adicionados na sessão anterior, motivo pelo qual foi reintroduzido) NÃO
 * mudaram o padrão -- confirma que o problema não é qualidade de sinal, é
 * estrutural pro símbolo (mesma hipótese já registrada acima: ATR de candle
 * 5m não captura a volatilidade de tick real desta corretora pra SOLUSD).
 * Não reintroduzir sem investigação dedicada comparando ATR-candle vs
 * volatilidade tick-a-tick real do símbolo.
 */
/**
 * 🔴 2026-08-31 (à noite, pedido explícito do Cleber): cesta ampliada além de
 * cripto -- ele configurou ~10 ativos no Setup do AI Trader (EURUSD, XAUUSD,
 * UKOUSD, GER40, SPX500, NAS100, COFUSD, COCUSD, UK100, além das criptos) e
 * a interseção com a cesta fixa (só 9 criptos) reduzia a cesta REAL a um
 * único símbolo (BTCUSD), travando o motor numa cesta muito menor do que o
 * usuário pediu -- mesma classe de problema já documentada no CLAUDE.md
 * ("cesta poluída"). 7 dos 9 símbolos não-cripto testados AO VIVO contra
 * `/mt5-prices` (mesmo pipeline do motor mecânico antigo) devolveram bid/ask
 * reais e frescos: EURUSD, XAUUSD, UKOUSD, GER40, SPX500, NAS100, UK100.
 * COFUSD e COCUSD devolveram HTTP 404 nesta corretora/conta -- NÃO
 * adicionados (não dá pra operar um símbolo que a corretora não reconhece;
 * ver `research`/histórico se o Cleber quiser investigar o nome certo).
 * `lotSize` de cada um vem de `assetDatabase.ts` (fonte JÁ CORRIGIDA do bug
 * de PnL 20x do NAS100 em 2026-08-27 -- $1/ponto, não o E-mini $20/ponto de
 * `infinoxContractSpecs.ts`), não de suposição.
 */
/**
 * 🔴 2026-09-01 (revertido -- achado real, apontado pelo Cleber): a cesta
 * reduzida a 4 símbolos (registrada aqui mais cedo hoje pra caber no teto
 * de tokens da Groq) ficou obsoleta assim que o motor passou a rodar em
 * Ollama local (sem esse teto) -- e criou um problema novo: com só 4
 * ativos, e 2 deles (BTCUSD, UKOUSD) estruturalmente bloqueados pelo piso
 * de risco mínimo nesta conta pequena (ver erro "Risco minimo possivel..."
 * em tools.ts -- lote mínimo de BTCUSD/UKOUSD já excede o teto de 3% de
 * risco por trade no preço/stop de hoje, matemática confirmada correta,
 * não é bug), sobrava pouquíssima chance de qualquer entrada abrir --
 * zero posições em ~16h de motor ligado. Restaurado pra 9 símbolos
 * (interseção com `activeAssets` do Setup no Supabase) -- mais ativos
 * avaliados por ciclo = mais chance de algum passar no piso de risco E
 * ter sinal real, exatamente como funcionava antes da redução de hoje.
 */
/**
 * 🔴 2026-09-02 (pedido do Cleber): reduzida de 16 pra 10 símbolos --
 * suspeita de que o motor (ciclo de 10s, `get_mt5_quote` sem cache pra
 * tick/preço) está disputando rate-limit da conta MetaAPI compartilhada
 * contra o próprio Gráfico do Cleber (achado ao vivo: gráfico intermitente,
 * preço "oscilando pra zerado", boleta recusando ordem por falta de preço
 * confiável -- mesmo com ele sozinho numa aba, o motor headless é o
 * segundo consumidor pesado e contínuo da mesma conta). Cortados os 6 mais
 * recentes/menos testados: DOTUSD, ADAUSD, LNKUSD, UNIUSD (adicionados
 * 2026-08-30) e UKOUSD/UK100 (UKOUSD já documentado como estruturalmente
 * bloqueado pelo piso de risco mínimo nesta conta pequena, ver comentário
 * de 2026-09-01 acima -- avaliar esse símbolo todo ciclo sem nunca poder
 * operar era carga desperdiçada). Mantidos os 10 com maior amostra/melhor
 * histórico: os 5 cripto validados (BTCUSD, XETUSD, DOGUSD, XRPUSD,
 * BTCXBN) + EURUSD, XAUUSD, GER40, SPX500, NAS100. Sem validação
 * estatística de melhora no líquido -- é mitigação de carga na API, não
 * mudança de estratégia. Reverter se não resolver a intermitência do
 * gráfico (não é o motivo mais provável nesse caso).
 */
/**
 * 🔴 2026-09-03 (pedido explícito do Cleber): troca DOGUSD/XRPUSD por
 * UKOUSD/UK100. ATENÇÃO -- UKOUSD já foi documentado em 2026-09-01 (ver
 * comentário acima) como estruturalmente bloqueado pelo piso de risco
 * mínimo desta conta pequena: o lote mínimo do símbolo já excede o teto de
 * 3% de risco por trade (`mt5MaxRiskPctPerTrade`) no preço/stop de hoje --
 * não é bug, é matemática de conta pequena. Reintroduzido mesmo assim por
 * pedido explícito; provavelmente continua recusando entrada em
 * `open_position` até o capital alocado aumentar ou o teto de risco subir.
 */
export const MT5_ASSET_BASKET = [
  "BTCUSD", "XETUSD", "BTCXBN",
  "EURUSD", "XAUUSD", "UKOUSD", "GER40", "SPX500", "NAS100", "UK100",
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
  // Valores REAIS de `assetDatabase.ts` (repo principal) -- mesma fonte que
  // corrigiu o bug de PnL 20x do NAS100 (2026-08-27): CFD retail $1/ponto
  // pra índices, não o contrato E-mini da CME. amountUsd = lots * LOT_SIZE *
  // preço, mesma fórmula já usada pra cripto -- generaliza corretamente pra
  // qualquer classe desde que LOT_SIZE seja o contractSize real.
  EURUSD: 100000,
  XAUUSD: 100,
  UKOUSD: 1000,
  GER40: 1,
  SPX500: 1,
  NAS100: 1,
  UK100: 1,
};

export const MIN_LOTS = 0.01;

/**
 * 🔴 2026-08-31: cripto opera 24/7, mas os 7 CFDs não-cripto adicionados
 * hoje (forex/metal/energia/índices) fecham no fim de semana como qualquer
 * CFD via MetaAPI/Infinox -- mesmo horário que `isCfdMarketOpen()` em
 * `src/app/utils/marketHours.ts` (repo principal). Aplicado a TODOS os
 * não-cripto (não só forex) porque índices/metal/energia seguem
 * aproximadamente a mesma janela de fim de semana nesta corretora -- horário
 * exato de pregão de cada bolsa (ex: SPX500 09:30-16:00 ET) não é modelado
 * aqui de propósito: a trava de tick obsoleto (`STALE_TICK_MS` em
 * `mt5Broker.ts`, já validada ao vivo pro caso do XPTUSD) cobre isso de
 * forma orientada a dado real, sem precisar fabricar uma tabela de horários
 * por bolsa que arriscaria ficar errada/desatualizada.
 */
const WEEKEND_CLOSED_SYMBOLS = new Set<string>([
  "EURUSD", "XAUUSD", "UKOUSD", "GER40", "SPX500", "NAS100", "UK100",
]);

/** Fecha: Sexta 22:00 UTC. Abre: Domingo 23:00 UTC. */
export function isForexMarketOpen(now: Date = new Date()): boolean {
  const utcDay = now.getUTCDay(); // 0 = Domingo, 6 = Sábado
  const totalMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  if (utcDay === 6) return false; // Sábado inteiro: fechado
  if (utcDay === 0 && totalMinutes < 23 * 60) return false; // Domingo antes das 23:00 UTC
  if (utcDay === 5 && totalMinutes >= 22 * 60) return false; // Sexta após 22:00 UTC
  return true;
}

export function isSymbolTradable(symbol: string, now: Date = new Date()): boolean {
  if (!WEEKEND_CLOSED_SYMBOLS.has(symbol)) return true; // cripto: sempre
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
// 🔴 2026-08-31: GER40/SPX500/NAS100/UK100 são índices de ações de bolsas
// diferentes, mas andam juntos em risk-on/risk-off macro global -- mesmo
// grupo. EURUSD, XAUUSD e UKOUSD ficam isolados (só 1 símbolo cada nova
// classe, sem outro par pra correlacionar de verdade ainda).
const CORRELATED_GROUPS: string[][] = [
  ["BTCUSD", "XETUSD", "DOGUSD", "DOTUSD", "XRPUSD", "BTCXBN", "SOLUSD", "ADAUSD", "LNKUSD", "UNIUSD"],
  ["GER40", "SPX500", "NAS100", "UK100"],
];

export function getCorrelatedGroup(symbol: string): string[] {
  return CORRELATED_GROUPS.find((group) => group.includes(symbol)) ?? [symbol];
}
