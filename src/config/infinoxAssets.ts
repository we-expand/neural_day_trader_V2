/**
 * 🏦 INFINOX BROKER - CATÁLOGO DE ATIVOS REALMENTE OFERTADOS
 *
 * ✅ REESCRITO 2026-07-08: este arquivo antes tinha listas de símbolo
 * DIGITADAS À MÃO, nunca validadas contra a API real da corretora —
 * continha nomes inventados/errados (`GOLDft`, `SILVERft` como se fossem
 * sinônimo de Gold/Silver — na real são contratos futuros À PARTE, nunca
 * expostos em lugar nenhum do app; `Coffee`/`Cocoa`/`Wheat` sem o sufixo
 * USD que o resto do app usa; `XPTUSD` duplicado em duas categorias ao
 * mesmo tempo) e nunca conferia se o ativo listado batia com o símbolo
 * unificado (`assetDatabase.ts`) usado pelo resto do app pra buscar preço.
 * Resultado: escolher um ativo aqui no seletor mandava um nome de símbolo
 * pro backend que não existia — e o app mostrava dado sintético/fake sem
 * avisar (bug reportado pelo Cleber pra Prata/Ouro-futuro/Cacau/Café/Trigo).
 *
 * Agora esse arquivo NÃO tem mais nenhuma lista de símbolo própria — ele
 * deriva 100% do catálogo canônico (`assetDatabase.ts`) filtrado pelo
 * registro real de disponibilidade por corretora (`brokerRegistry.ts`,
 * auditado contra a API em produção via `scripts/audit-broker-symbols.mjs`).
 * As funções exportadas mantêm a MESMA assinatura de antes — os componentes
 * que já usavam este arquivo (InfinoxAssetsBrowser, AssetSelector,
 * AssetSpecsSelector, InfinoxStatsWidget, InfinoxExamples) não precisam
 * mudar nada.
 */

import { ALL_ASSETS, type Asset } from '@/app/config/assetDatabase';
import { isAvailableOnBroker } from '@/app/config/brokerRegistry';

/**
 * Agrupamento de exibição — mantém as mesmas chaves que o app já usava,
 * pra não quebrar rótulos/ícones nos componentes existentes.
 */
type DisplayCategory =
  | 'FOREX' | 'METALS' | 'ENERGY' | 'COMMODITIES' | 'CRYPTO' | 'INDICES'
  | 'STOCKS_UK' | 'STOCKS_EU' | 'BONDS';

function getDisplayCategory(asset: Asset): DisplayCategory | null {
  switch (asset.category) {
    case 'FOREX': return 'FOREX';
    case 'CRYPTO': return 'CRYPTO';
    case 'INDICES': return 'INDICES';
    case 'BONDS': return 'BONDS';
    case 'COMMODITIES':
      if (asset.subCategory === 'Precious Metals') return 'METALS';
      if (asset.subCategory === 'Energy') return 'ENERGY';
      return 'COMMODITIES';
    case 'STOCKS':
      if (asset.subCategory === 'US Stocks') return null; // não ofertado pela Infinox, ver brokerRegistry
      if (asset.subCategory === 'UK Stocks') return 'STOCKS_UK';
      return 'STOCKS_EU'; // French/German/Spanish/... Stocks
    default:
      return null;
  }
}

/**
 * 📋 Catálogo real: só ativos confirmados disponíveis na Infinox, agrupados
 * pra exibição. Símbolos são sempre o unificado (`assetDatabase.ts`) — nunca
 * o nome interno da corretora, que é só um detalhe de implementação de
 * `brokerRegistry.getBrokerSymbol()` usado na hora de buscar o preço.
 */
// ✅ 2026-07-14: ativos sem CFD na Infinox mas com preço real confirmado
// por fonte alternativa (fallback Yahoo, ver yahooSymbolMap no backend) —
// não devem ficar de fora do seletor só por não terem CFD na corretora.
const NO_BROKER_BUT_REAL_DATA = new Set<string>(['VIX']);

function buildRealInfinoxCatalog(): Record<DisplayCategory, string[]> {
  const catalog: Record<DisplayCategory, string[]> = {
    FOREX: [], METALS: [], ENERGY: [], COMMODITIES: [], CRYPTO: [],
    INDICES: [], STOCKS_UK: [], STOCKS_EU: [], BONDS: [],
  };

  for (const asset of ALL_ASSETS) {
    if (!isAvailableOnBroker(asset.symbol, 'infinox') && !NO_BROKER_BUT_REAL_DATA.has(asset.symbol)) continue;
    const category = getDisplayCategory(asset);
    if (category) catalog[category].push(asset.symbol);
  }

  return catalog;
}

const REAL_CATALOG = buildRealInfinoxCatalog();

/**
 * 🔍 VERIFICAR SE ATIVO ESTÁ DISPONÍVEL NA INFINOX
 */
export function isInfinoxAsset(symbol: string): boolean {
  const normalized = symbol.toUpperCase();
  return Object.values(REAL_CATALOG).some(list => list.includes(normalized));
}

/**
 * 📋 OBTER CATEGORIA DO ATIVO INFINOX
 */
export function getInfinoxCategory(symbol: string): string | null {
  const normalized = symbol.toUpperCase();
  for (const [categoryName, symbols] of Object.entries(REAL_CATALOG)) {
    if (symbols.includes(normalized)) return categoryName;
  }
  return null;
}

/**
 * 📊 OBTER TODOS OS ATIVOS POR CATEGORIA
 */
export function getInfinoxAssetsByCategory(): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const [categoryName, symbols] of Object.entries(REAL_CATALOG)) {
    result[categoryName] = [...symbols].sort();
  }
  return result;
}

/**
 * 🔢 ESTATÍSTICAS DOS ATIVOS INFINOX
 */
export function getInfinoxStats() {
  let totalAssets = 0;
  const categoryStats: Record<string, number> = {};

  for (const [categoryName, symbols] of Object.entries(REAL_CATALOG)) {
    categoryStats[categoryName] = symbols.length;
    totalAssets += symbols.length;
  }

  return {
    total: totalAssets,
    byCategory: categoryStats,
  };
}

/**
 * 🎯 MAPEAR NOMES AMIGÁVEIS DAS CATEGORIAS
 */
export const INFINOX_CATEGORY_NAMES: Record<string, string> = {
  FOREX: '💱 Forex',
  METALS: '🥇 Metais',
  ENERGY: '🛢️ Energia',
  COMMODITIES: '🌾 Commodities',
  CRYPTO: '₿ Criptomoedas',
  INDICES: '📈 Índices',
  STOCKS_UK: '🇬🇧 Ações UK',
  STOCKS_EU: '🇪🇺 Ações Europa',
  BONDS: '📊 Bonds',
};
