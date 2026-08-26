/**
 * Etapa 0 do Trilho 2 reaberto: usa o Nemotron via NIM API pra gerar/triar
 * hipóteses de sinal testáveis sobre as fontes de dado já aprovadas na
 * seção 13.1 da spec (correlação cross-asset, calendário econômico como
 * filtro de regime). Não valida nada — só gera a lista priorizada. Cada
 * hipótese gerada aqui ainda precisa passar pelo pipeline determinístico
 * (DataSplit.ts + DeflatedSharpe.ts + CostModel.ts) antes de qualquer
 * promoção. Ver hypothesis.md desta pasta.
 *
 * Rodar: npx esbuild scripts/discoverSignals.ts --bundle --platform=node \
 *   --format=esm --outfile=/tmp/discoverSignals.mjs && node /tmp/discoverSignals.mjs
 *
 * Requer NVIDIA_API_KEY no ambiente.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { nimChatCompletion } from '../../../NvidiaNimClient';

const ASSETS = [
  'BTCUSD', 'XBNUSD', 'EURUSD', 'XAUUSD', 'XAGUSD',
  'US30', 'NAS100', 'SPX500', 'GER40',
];
const TIMEFRAMES = ['5m', '15m', '1h'];

const SYSTEM_PROMPT = `Você é um analista quantitativo sênior revisando hipóteses de sinal de
trading para validação estatística formal. Seu papel é APENAS propor
hipóteses testáveis e específicas — nunca afirmar que uma hipótese tem
edge, nunca inventar número de backtest. Cada hipótese deve ser mecânica
o bastante para virar código de backtest determinístico (regra de entrada,
regra de saída, em quais ativos/timeframes se aplica, e por que a fonte de
dado deveria conter informação preditiva, não só correlação espúria).`;

const USER_PROMPT = `Contexto: SaaS de trading intraday, cesta de ${ASSETS.length} ativos
(${ASSETS.join(', ')}) em timeframes ${TIMEFRAMES.join('/')}. Busca
sistemática anterior em técnico clássico (Donchian, EMA, ADX, Reversão,
Scalp) sobre preço público não encontrou edge líquido de custo (rigor:
Deflated Sharpe, bootstrap, walk-forward). Duas fontes de dado NOVAS estão
disponíveis para esta rodada, ainda não testadas:

1. Correlação cross-asset e regime de volatilidade (ex: BTC→altcoins,
   DXY→forex majors) — já temos série de preço de todos os ativos, dá pra
   computar correlação rolante localmente.
2. Calendário econômico como filtro de regime (não como sinal standalone)
   — já consumido hoje só como gate binário de veto no motor de produção,
   nunca como insumo de sinal direcional.

Gere até 5 hipóteses de sinal TESTÁVEIS usando essas duas fontes (pode
combinar as duas). Para cada uma: nome curto, regra de entrada mecânica,
regra de saída, ativos/timeframes aplicáveis, e por que a fonte deveria
ter poder preditivo (mecanismo, não só "correlação histórica"). Responda em
JSON: {"hypotheses": [{"name": "...", "entryRule": "...", "exitRule": "...",
"applicableAssets": [...], "mechanism": "..."}]}`;

async function main() {
  const raw = await nimChatCompletion({
    model: 'nvidia/nemotron-nano-9b-v2',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: USER_PROMPT },
    ],
    temperature: 0.3,
    maxTokens: 3000,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      `Nemotron não retornou JSON válido — resposta bruta salva em resultado de erro. Início: ${raw.slice(0, 200)}`,
    );
  }

  mkdirSync(`${__dirname}/../results`, { recursive: true });
  writeFileSync(
    `${__dirname}/../results/hypotheses.json`,
    JSON.stringify({ generatedAt: new Date().toISOString(), model: 'nvidia/nemotron-nano-9b-v2', ...(parsed as object) }, null, 2),
  );

  console.log('Hipóteses geradas e salvas em results/hypotheses.json. Próximo passo: cada uma precisa de script de backtest próprio (DataSplit + DeflatedSharpe + CostModel) antes de qualquer verdict.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
