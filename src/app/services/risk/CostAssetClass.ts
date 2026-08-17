// Resolução da classe de custo de um símbolo — 2026-08-17.
//
// POR QUE existe: o motor derivava a classe de custo de
// `symbolMappingService.findMapping(symbol)?.type`, que carrega 81
// mapeamentos, contra um catálogo (`assetDatabase.ts`) de 480 ativos. Todo
// símbolo fora dos 81 caía no fallback `FOREX_MAJOR` — e a fórmula de custo de
// FOREX (pontos × pointValue ÷ preço) aplicada a outra classe erra por ordens
// de grandeza, nos DOIS sentidos.
//
// Medido em produção (ai_decisions.risk_assessment, 11 dias, 2026-08-17):
//   XBNUSD (BNB, cripto): sem mapeamento -> FOREX_MAJOR -> custo 0,2258%,
//     contra 0,0291% da classe correta (CRYPTO). 7,8x inflado — e sozinho
//     responde por 312 dos 562 vetos de COST_GATE do período, mais da metade.
//   COCUSD (cacau, commodity): sem mapeamento -> FOREX_MAJOR -> custo 0,0002%.
//     Erro no sentido PERIGOSO: subestima o custo e aprovaria trade que a
//     classe correta reprovaria.
//
// A correção usa o catálogo como fonte primária (é ele que tem cobertura real)
// e mantém `symbolMappingService` como desempate — mesma direção da correção
// de `pointValue` de 2026-08-05, que já passou a derivar escala da categoria
// do catálogo.

import { getAssetBySymbol } from '@/app/config/assetDatabase.ts';
import { symbolMappingService } from '@/app/services/SymbolMappingService.ts';
import type { AssetClass as CostAssetClass } from '../../../../research/CostModel.ts';

export interface CostClassResolution {
  assetClass: CostAssetClass;
  /** De onde veio a classificação — usado no log/telemetria pra distinguir classe real de fallback. */
  source: 'CATALOG' | 'SYMBOL_MAPPING' | 'FALLBACK';
}

/**
 * Classe de custo de um símbolo, preferindo o catálogo (480 ativos) ao mapa de
 * símbolos da corretora (81). O fallback continua sendo `FOREX_MAJOR`, mas
 * agora é raro e explicitamente sinalizado por `source`.
 */
export function resolveCostAssetClass(symbol: string): CostClassResolution {
  const asset = getAssetBySymbol(symbol);
  if (asset) {
    switch (asset.category) {
      case 'CRYPTO':
        return { assetClass: 'CRYPTO', source: 'CATALOG' };
      case 'INDICES':
        return { assetClass: 'INDEX', source: 'CATALOG' };
      case 'COMMODITIES':
        return { assetClass: 'COMMODITY', source: 'CATALOG' };
      case 'STOCKS':
        return { assetClass: 'STOCK', source: 'CATALOG' };
      // 'BONDS' cai de propósito pro desempate abaixo: o CostModel não tem
      // classe de renda fixa, e inventar uma equivalência (BONDS≈FOREX) seria
      // fabricar custo. Enquanto não houver spread medido pra essa classe,
      // títulos seguem no caminho de fallback, sinalizado como tal.
      case 'FOREX':
        // Exóticos têm spread muito acima de major — tratar tudo como major
        // subestima o custo justamente onde ele mais morde.
        return {
          assetClass: asset.subCategory === 'Major Pairs' ? 'FOREX_MAJOR' : 'FOREX_MINOR',
          source: 'CATALOG',
        };
    }
  }

  const mapped = symbolMappingService.findMapping(symbol)?.type;
  if (mapped) {
    const byMapping: CostAssetClass =
      mapped === 'crypto' ? 'CRYPTO' :
      mapped === 'commodity' ? 'COMMODITY' :
      mapped === 'index' ? 'INDEX' :
      mapped === 'stock' ? 'STOCK' :
      'FOREX_MAJOR';
    return { assetClass: byMapping, source: 'SYMBOL_MAPPING' };
  }

  return { assetClass: 'FOREX_MAJOR', source: 'FALLBACK' };
}
