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
 * ✅ 2026-07-11 (2ª parte): Cleber pediu pra verificar TODA cripto contra a
 * Binance e reportou variação diária "totalmente errada" (ex: BNBUSD). Causa
 * raiz confirmada: o candle diário (D1) da MetaAPI fecha às 21:00 UTC (fuso
 * do broker), não numa janela rolante de 24h como a Binance — pra forex isso
 * já dava uma diferença pequena (~0,2%) aceita antes, mas cripto é volátil
 * o bastante pra essa diferença de METODOLOGIA inverter até o sinal da
 * variação (confirmado: SOL/BNB/XRP/ADA com sinal ou magnitude bem diferente
 * da Binance). Não é bug de preço errado, é referência de mercado diferente
 * — mas Cleber decidiu que bater com a Binance importa mais que a
 * disponibilidade extra do CFD pra essas 5. Revertidas pra Binance direta
 * (o fix de validação `isFinite` em `DirectBinanceService.ts`, mesma sessão,
 * reduz o risco do incidente de dado inválido se algum proxy CORS responder
 * mal). BTCUSD é a EXCEÇÃO deliberada: continua na MetaAPI (decisão explícita
 * do Cleber) — é o ativo padrão do Dashboard, prioriza disponibilidade sobre
 * bater exatamente com a Binance.
 */
const CRYPTO_CFD_AVAILABLE: Record<BrokerId, Set<string>> = {
  infinox: new Set(['BTCUSD']),
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
