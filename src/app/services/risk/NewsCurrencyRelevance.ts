/**
 * Moedas cujo calendário econômico importa pra decidir se é arriscado operar
 * um ativo agora. Extraído de `RiskThermometer.tsx` (2026-08-21) pra ser a
 * MESMA função usada pelo motor real (`runTradingCycle.ts`) — duas cópias da
 * mesma lógica de mapeamento símbolo→moeda divergindo já foi um bug real
 * neste projeto (`pointValue`, corrigido 2026-08-05), não repetir aqui.
 *
 * Cripto fica de fora de propósito — não existe hoje uma fonte de calendário
 * confiável ligada a cripto no projeto (mesmo padrão já usado pro order
 * book: só real quando existe, nunca aproximado).
 */
import { getAssetBySymbol } from '@/app/config/assetDatabase.ts';

const INDEX_CURRENCY: Record<string, string> = {
  US30: 'USD', SPX500: 'USD', NAS100: 'USD', US2000: 'USD',
  GER40: 'EUR', FRA40: 'EUR', ESP35: 'EUR', EUSTX50: 'EUR',
  UK100: 'GBP', JP225: 'JPY', AUS200: 'AUD',
  HK50: 'HKD', HKG33: 'HKD', CHINA50: 'CNY',
};

export function getRelevantCurrencies(symbol: string): string[] {
  const asset = getAssetBySymbol(symbol);
  const category = asset?.category;
  if (category === 'CRYPTO') return [];
  if (INDEX_CURRENCY[symbol]) return [INDEX_CURRENCY[symbol]];
  if (category === 'FOREX' && symbol.length === 6) {
    return [symbol.slice(0, 3).toUpperCase(), symbol.slice(3, 6).toUpperCase()];
  }
  // Metais/energia/ações: aproximação deliberada — a maioria do catálogo é
  // cotada/dirigida por dado macro americano (USD). Não é exato pra cada ação
  // europeia individual, mas é o sinal real disponível hoje, não um "chute".
  return ['USD'];
}
