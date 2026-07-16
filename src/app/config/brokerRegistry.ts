/**
 * 🏦 BROKER REGISTRY — única fonte de verdade pra roteamento por corretora
 *
 * Problema que este arquivo resolve: antes desta reescrita (2026-07-08), existiam
 * 3 lugares diferentes decidindo "que corretora oferece esse ativo e com que nome":
 * `RealMarketDataService.isCryptoSymbol()` (heurística por substring, com bugs
 * reais — ex. XPTUSD virava "cripto" por conter "TUSD"), `DataSourceRouter.
 * getSourceConfig()` (outra heurística parecida) e um catálogo `infinoxAssets.ts`
 * com nomes de símbolo NUNCA validados contra a API real (GOLDft, SILVERft,
 * "Coffee"/"Cocoa"/"Wheat" sem sufixo — por coincidência esses batiam certo, mas
 * XAUEUR/XPDUSD e vários outros nunca foram testados de verdade).
 *
 * Esse arquivo é o único lugar que sabe "nome do ativo na corretora X" e
 * "essa corretora oferece esse ativo". Tudo aqui foi confirmado rodando
 * `scripts/audit-broker-symbols.mjs` contra a API real da MetaAPI/Infinox em
 * produção — não é achismo. Pra adicionar uma corretora nova no futuro: criar
 * um novo `BrokerId`, rodar o script de auditoria apontando pra ela, e preencher
 * as duas tabelas abaixo com o resultado real.
 */

import { ALL_ASSETS } from './assetDatabase';

export type BrokerId = 'infinox';

/**
 * unified (símbolo canônico do app, de `assetDatabase.ts`) -> nome real na
 * corretora, SÓ quando é diferente do símbolo unificado. Ausência de entrada
 * aqui significa "a corretora usa o mesmo nome do unificado".
 */
const SYMBOL_OVERRIDES: Record<BrokerId, Record<string, string>> = {
  infinox: {
    JP225: 'JPN225',   // Nikkei 225 — unified antigo não batia com o nome real
    HK50: 'HKG33',     // Hang Seng — idem
    XNGUSD: 'NG',      // Gás Natural — nome real é curto, sem sufixo USD
    WHEUSD: 'Wheat',   // Trigo — corretora usa o nome em inglês, sem sufixo
    COFUSD: 'Coffee',  // Café — idem
    COCUSD: 'Cocoa',   // Cacau — idem
    // ✅ 2026-07-16: variantes "liquidadas em cripto"/horário estendido que o
    // Cleber viu no terminal MT5 mas não existiam no catálogo — confirmadas
    // reais direto via /mt5-prices (nome literal com ponto/traço da
    // corretora), nomes unificados sem pontuação seguindo o padrão do resto
    // deste arquivo.
    XAUUSDCRP: 'XAUUSD.crp',
    BTCUSDCRP: 'BTCUSD.crp',
    XETUSDCRP: 'XETUSD.crp',
    XBNUSDCRP: 'XBNUSD.crp',
    XLCUSDCRP: 'XLCUSD.crp',
    USDCHFEXC: 'USDCHF-EXC',
    // ✅ 2026-07-16: BTCBNB não existe com esse nome literal na Infinox —
    // real com 'BTCXBN' (mesmo padrão do XBN visto nesta sessão pro
    // Binance Coin), confirmado via /mt5-prices.
    BTCBNB: 'BTCXBN',
    BTCETH: 'BTCXET',
    BTCLTC: 'BTCXLC',
    // ✅ 2026-07-16: Dogecoin/Chainlink já existiam no catálogo (roteando
    // pela Binance direta), mas a Infinox oferece os dois como CFD próprio
    // com nome curto — confirmado via /mt5-prices ('DOG'+'USD', 'LNK'+'USD').
    // Roteados pro broker agora (ver CRYPTO_CFD_AVAILABLE), pra bater com o
    // MT5 real em vez do spot da Binance.
    DOGEUSD: 'DOGUSD',
    LINKUSD: 'LNKUSD',
    // ✅ 2026-07-16: mesmo padrão — vários já existiam no catálogo (roteando
    // pela Binance direta) mas a Infinox oferece como CFD próprio com nome
    // curto (dropando vogal/letra pra caber num código fixo). Confirmados
    // via /mt5-prices, roteados pro broker agora (ver CRYPTO_CFD_AVAILABLE).
    ATOMUSD: 'ATMUSD',
    NEARUSD: 'NERUSD',
    SANDUSD: 'SANUSD',
    ALGOUSD: 'ALGUSD',
    SHIBUSD: 'SHBUSD',
    AVAXUSD: 'AVAUSD',
    // Mesmo padrão, pra ativos genuinamente novos adicionados nesta sessão.
    SUSHIUSD: 'SUSUSD',
    IOTAUSD: 'IOTUSD',
  },
};

/**
 * Símbolos unificados CONFIRMADOS indisponíveis nessa corretora (HTTP 404 real
 * em `/mt5-prices`, auditado em produção). Ativos aqui pulam a chamada à
 * corretora e vão direto pro fallback real (Yahoo Finance) — evita round-trip
 * desperdiçado e evita cair no gerador sintético por engano.
 */
const UNAVAILABLE: Record<BrokerId, Set<string>> = {
  infinox: new Set([
    // Índices europeus/asiáticos menores, não ofertados por essa corretora
    'ITA40', 'NETH25', 'SUI20',
    // Agrícolas sem contrato equivalente confirmado (Cocoa/Coffee/Wheat SÃO
    // ofertados, ver override acima — estes aqui são os que não têm nem isso)
    'CORNUSD', 'SOYUSD', 'COTUSD', 'SUGUSD',
    // Títulos — nomenclatura de bond da Infinox não confirmada além de
    // 'USNote10Y' (achado da auditoria, sem mapeamento unificado ainda)
    'BUND10Y', 'UK10Y', 'FR10Y', 'US10Y', 'US30Y', 'US2Y',
    // Forex exótico sem contrato na Infinox — confirmado HTTP 404 direto via
    // /mt5-prices em 2026-07-10 (reaudição completa do catálogo, 254/329
    // símbolos sem resposta — a grande maioria já coberta por outras regras
    // deste arquivo: US Stocks, sufixo de bolsa europeu, cripto via Binance
    // por design, títulos e agrícolas acima. Estes 3 pares eram a única
    // lacuna real ainda não classificada).
    'USDPLN', 'USDCZK', 'USDMYR',
  ]),
};

/**
 * Ações americanas (subCategory 'US Stocks') nunca são negociáveis nessa
 * corretora — confirmado 404 em AAPL/MSFT/GOOGL/TSLA (amostra de 4, mesmo
 * padrão esperado pro resto). A Infinox só oferece ações UK/Europa continental.
 */
function isUsStock(unified: string): boolean {
  const asset = ALL_ASSETS.find(a => a.symbol === unified);
  return asset?.subCategory === 'US Stocks';
}

/**
 * Ações europeias no catálogo usam sufixo de bolsa só pra organização/exibição
 * (AAL.L, BMW.DE, AIR.PA...) — a Infinox negocia pelo ticker raiz, sem sufixo.
 * Confirmado via auditoria (AAL, BMW, AIR, SAP resolvem certo sem o sufixo).
 * Exceção conhecida: BT Group é 'BT.A' na corretora, não 'BT-A' (o unified
 * 'BT-A.L' não bate com o "tirar depois do primeiro ponto" — tratado como
 * override explícito abaixo em vez de regra geral, pra não generalizar demais
 * a partir de uma amostra pequena).
 */
const STOCK_SUFFIX_OVERRIDES: Record<BrokerId, Record<string, string>> = {
  infinox: {
    'BT-A.L': 'BT.A',
    // ✅ 2026-07-16: achado auditando uma lista do MT5 do Cleber — estes 11
    // ativos já existiam no catálogo, mas o `stripExchangeSuffix` produzia
    // um código (ex: 'AV', 'ATO') que dá HTTP 404 na Infinox — a corretora
    // usa o nome completo/uma abreviação diferente da LSE/Euronext oficial.
    // Caíam SEMPRE no fallback Yahoo silenciosamente, sem ninguém notar.
    'AV.L': 'AVIVA',
    'BA.L': 'BAE',
    'DGE.L': 'DIAGEO',
    'RKT.L': 'RB',
    'SHEL.L': 'SHELL',
    'TSCO.L': 'TESCO',
    'JD.L': 'JDI',
    'ATO.PA': 'ATOS',
    'DSY.PA': 'DAST',
    'RMS.PA': 'HRMS',
    'MC.PA': 'LVMH',
  },
};

function stripExchangeSuffix(unified: string): string {
  const dotIndex = unified.indexOf('.');
  return dotIndex === -1 ? unified : unified.slice(0, dotIndex);
}

function isEuropeanStock(unified: string): boolean {
  const asset = ALL_ASSETS.find(a => a.symbol === unified);
  return asset?.category === 'STOCKS' && asset.subCategory !== 'US Stocks';
}

/**
 * Cripto confirmada como CFD próprio na Infinox (auditado via
 * `scripts/audit-broker-symbols.mjs` em 2026-07-11, direto contra
 * `/mt5-prices` em produção). Por design, cripto normalmente vai pela Binance
 * (spot, sem quota/rate-limit da conta MetaAPI compartilhada) — mas as 3
 * fontes de Binance direta estão mortas em produção desde o incidente de
 * 2026-07-10 (CORS/403 bloqueado no domínio de produção).
 *
 * ✅ 2026-07-11 (2ª parte, REVERTIDO em 2026-07-14): SOL/BNB/XRP/ADA/DOT
 * tinham sido movidas pra Binance direta porque a metodologia de fechamento
 * D1 do broker (21:00 UTC) diverge um pouco da janela rolante 24h da Binance
 * em cripto (mais volátil, a diferença de metodologia podia até inverter o
 * sinal da variação). Na época isso parecia um trade-off aceitável.
 *
 * ✅ 2026-07-14: Cleber reportou XRPUSD "completamente errado, parece
 * cotação de ontem" — confirmado ao vivo: Binance direta (as 3 fontes, ver
 * `DirectBinanceService.ts`) está MORTA em produção (CORS bloqueado no
 * domínio), então essas 5 cripto caíam sempre no último preço real conhecido
 * em cache — que podia ser de horas ou dias atrás. Comparado ao vivo: a
 * mesma consulta via corretora (`/mt5-prices`) devolve XRPUSD real e fresco
 * na hora (ver commit). Preço certo com metodologia de variação levemente
 * diferente da Binance é MUITO melhor que preço/variação travados em cache
 * velho — revertido de volta pra corretora, igual BTCUSD.
 */
const CRYPTO_CFD_AVAILABLE: Record<BrokerId, Set<string>> = {
  // ✅ 2026-07-14: BATUSD adicionado ao catálogo (assetDatabase.ts) e já
  // confirmado ao vivo com CFD real na Infinox — roteado direto pela
  // corretora, sem passar pela Binance direta (que está morta em produção,
  // ver comentário acima sobre SOL/BNB/XRP/ADA/DOT).
  // XBNUSD/XBNUSDCRP: contratos distintos do BNBUSD (confirmados reais via
  // /mt5-prices em 2026-07-16) — sem isso, isCryptoSymbol via categoria
  // CRYPTO os roteava pra Binance direta, que não tem esse ticker (só
  // BNBUSD existe lá), zerando preço/variação.
  // XETUSD/XETUSDCRP: mesmo caso, contratos distintos do ETHUSD (Binance
  // não tem "XETUSD"/"XETUSDCRP" como ticker).
  // XLCUSD/XLCUSDCRP: mesmo caso, contratos distintos do LTCUSD.
  // BTCEUR: confirmado real via /mt5-prices em 2026-07-16 — roteado pelo
  // broker em vez da Binance direta (as 3 fontes de Binance direta têm
  // histórico de ficarem mortas em produção, ver comentário logo abaixo).
  // BTCBNB/BTCETH/BTCLTC: mesmo caso — cruzamentos que a Binance não
  // oferece com esse nome (ou oferece invertido, ex: BNBBTC).
  // DOGEUSD/LINKUSD: CFD confirmado na Infinox com nome curto (DOG/LNK) —
  // roteado pro broker em vez da Binance pra bater com o MT5 real.
  // XETEUR: mesmo caso do BTCEUR — XET (Ethereum) cotado em Euro, confirmado
  // real via /mt5-prices em 2026-07-16.
  // XETXBN/XETXLC: Ethereum (contrato XET) cotado em XBN/XLC — confirmados
  // reais via /mt5-prices em 2026-07-16 (Cleber reportou "não está na
  // lista"), mesmo padrão do BTCBNB/BTCETH/BTCLTC.
  // UNIUSD/XLMUSD: CFD confirmado na Infinox com o mesmo nome unificado —
  // Cleber reportou preço/variação divergindo do MT5; causa era rotear pela
  // Binance direta (isCryptoSymbol sem CFD confirmado) em vez do broker.
  // ✅ 2026-07-16: lote grande auditado a partir de uma lista do MT5 do
  // Cleber — todos confirmados reais via /mt5-prices antes de adicionar.
  // ATOMUSD/NEARUSD/SANDUSD/ALGOUSD/SHIBUSD/AVAXUSD/SUSHIUSD/IOTAUSD têm
  // override de nome (ver SYMBOL_OVERRIDES). ETCUSD/GRTUSD/TRXUSD/FILUSD/
  // ZECUSD/XTZUSD/CRVUSD/NEOUSD/ONEUSD/INCUSD usam o próprio nome unificado
  // como nome real na corretora (sem override).
  infinox: new Set(['BTCUSD', 'SOLUSD', 'BNBUSD', 'XRPUSD', 'ADAUSD', 'DOTUSD', 'BATUSD', 'XBNUSD', 'XBNUSDCRP', 'XETUSD', 'XETUSDCRP', 'XLCUSD', 'XLCUSDCRP', 'BTCEUR', 'BTCBNB', 'BTCETH', 'BTCLTC', 'DOGEUSD', 'LINKUSD', 'XETEUR', 'XETXBN', 'XETXLC', 'UNIUSD', 'XLMUSD', 'ATOMUSD', 'NEARUSD', 'SANDUSD', 'ALGOUSD', 'SHIBUSD', 'AVAXUSD', 'ETCUSD', 'GRTUSD', 'TRXUSD', 'FILUSD', 'ZECUSD', 'XTZUSD', 'CRVUSD', 'NEOUSD', 'SUSHIUSD', 'IOTAUSD', 'ONEUSD', 'INCUSD']),
};

/**
 * Essa cripto tem CFD confirmado nessa corretora? Usado pra decidir se uma
 * cripto deve rotear pela MetaAPI (`/mt5-prices`) em vez da Binance direta.
 */
export function isCryptoCfdAvailable(unified: string, broker: BrokerId): boolean {
  return CRYPTO_CFD_AVAILABLE[broker].has(unified);
}

/**
 * Nome real do ativo na corretora. Sempre chamar isso antes de bater na API
 * da corretora — nunca usar o símbolo unificado direto pra ações europeias.
 */
export function getBrokerSymbol(unified: string, broker: BrokerId): string {
  const suffixOverride = STOCK_SUFFIX_OVERRIDES[broker][unified];
  if (suffixOverride) return suffixOverride;

  const override = SYMBOL_OVERRIDES[broker][unified];
  if (override) return override;

  if (isEuropeanStock(unified) && unified.includes('.')) {
    return stripExchangeSuffix(unified);
  }

  return unified;
}

/**
 * Essa corretora oferece esse ativo? Checar ANTES de chamar a API — evita
 * round-trip desperdiçado pra símbolos já confirmados indisponíveis.
 */
export function isAvailableOnBroker(unified: string, broker: BrokerId): boolean {
  if (isUsStock(unified)) return false;
  if (UNAVAILABLE[broker].has(unified)) return false;
  return true;
}
