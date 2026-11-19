/**
 * Moedas cujo calendário econômico importa pra decidir se é arriscado operar
 * um ativo agora. Extraído de `RiskThermometer.tsx` (2026-08-21) pra ser a
 * MESMA função usada pelo motor real (`runTradingCycle.ts`) — duas cópias da
 * mesma lógica de mapeamento símbolo→moeda divergindo já foi um bug real
 * neste projeto (`pointValue`, corrigido 2026-08-05), não repetir aqui.
 *
 * CORRIGIDO 2026-08-24 (item 6 do Super Prompt, ver
 * SESSAO_2026-08-23_CUSTO_INVISIVEL_PESQUISA_EDGE_E_JARVIS.md seção 4 e
 * seção 13): cripto ERA excluída de propósito daqui, com o raciocínio de
 * "não existe fonte de calendário confiável ligada a cripto". Isso confundia
 * dois problemas diferentes: (a) calendário de eventos ESPECÍFICOS de
 * cripto (halving, upgrade de protocolo — de fato não existe fonte
 * confiável, continua fora) vs. (b) reação de cripto a evento MACRO USD
 * (FOMC/CPI/NFP/PCE/ISM) — que já tem fonte real (o mesmo calendário buscado
 * pra qualquer outro ativo) e tem efeito medido e citado na pesquisa de
 * 2026-08-23: |retorno| médio na 1ª hora pós-FOMC sobe de 0,66%→1,25% (BTC)
 * e 0,85%→1,50% (ETH), volume 2,5-2,8x (Yang & Wang 2026, 41 comunicados,
 * p<0,001). Antes desta correção, esse achado nunca virava proteção real —
 * o gate de notícias nunca disparava pra nenhum símbolo de cripto, mesmo
 * durante FOMC. Agora cripto usa USD (mesmos eventos, mesma fonte real, sem
 * dado novo fabricado) — halving/protocolo continuam sem cobertura, que é
 * honesto, já que não existe fonte real pra isso hoje.
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
  if (category === 'CRYPTO') return ['USD']; // reação a FOMC/CPI/NFP medida e citada — ver comentário acima
  if (INDEX_CURRENCY[symbol]) return [INDEX_CURRENCY[symbol]];
  if (category === 'FOREX' && symbol.length === 6) {
    return [symbol.slice(0, 3).toUpperCase(), symbol.slice(3, 6).toUpperCase()];
  }
  // Metais/energia/ações: aproximação deliberada — a maioria do catálogo é
  // cotada/dirigida por dado macro americano (USD). Não é exato pra cada ação
  // europeia individual, mas é o sinal real disponível hoje, não um "chute".
  return ['USD'];
}
