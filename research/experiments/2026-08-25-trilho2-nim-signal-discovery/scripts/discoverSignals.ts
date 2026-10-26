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
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nimChatCompletion } from '../../../NvidiaNimClient';

const RESULTS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'results');

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
Deflated Sharpe, bootstrap, walk-forward). Três fontes de dado NOVAS estão
disponíveis para esta rodada, ainda não testadas:

1. Correlação cross-asset e regime de volatilidade (ex: BTC→altcoins,
   DXY→forex majors) — já temos série de preço de todos os ativos, dá pra
   computar correlação rolante localmente.
2. Calendário econômico como filtro de regime (não como sinal standalone)
   — já consumido hoje só como gate binário de veto no motor de produção,
   nunca como insumo de sinal direcional.
3. NLP/sentimento sobre o TEXTO dos eventos do calendário econômico (não
   um newsfeed pago novo — reaproveita a mesma fonte do item 2, mas extrai
   sentimento/surpresa do texto do evento em vez de só usar como veto
   binário). Item reaberto em 2026-08-25 (estava excluído desde
   2026-07-26 por custo de NLP — a destilação via Nemotron reduz esse
   custo). Newsfeed pago mais amplo (Bloomberg/Reuters) fica fora desta
   etapa, é decisão de orçamento separada.

Gere até 5 hipóteses de sinal TESTÁVEIS usando essas três fontes (pode
combinar). Para cada uma: nome curto, regra de entrada mecânica, regra de
saída, ativos/timeframes aplicáveis, e por que a fonte deveria ter poder
preditivo (mecanismo, não só "correlação histórica"). Responda em JSON:
{"hypotheses": [{"name": "...", "entryRule": "...", "exitRule": "...",
"applicableAssets": [...], "mechanism": "..."}]}`;

async function main() {
  const raw = await nimChatCompletion({
    model: 'nvidia/nemotron-3-nano-30b-a3b',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: USER_PROMPT },
    ],
    temperature: 0.3,
    maxTokens: 6000,
  });

  // Nemotron às vezes envolve o JSON em fence de markdown (```json ... ```)
  // mesmo com prompt pedindo JSON puro — remove antes de parsear.
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    mkdirSync(RESULTS_DIR, { recursive: true });
    writeFileSync(join(RESULTS_DIR, 'hypotheses_raw_error.txt'), raw);
    throw new Error(
      `Nemotron não retornou JSON válido — resposta bruta completa salva em results/hypotheses_raw_error.txt. Início: ${raw.slice(0, 300)}`,
    );
  }

  mkdirSync(RESULTS_DIR, { recursive: true });
  writeFileSync(
    join(RESULTS_DIR, 'hypotheses.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), model: 'nvidia/nemotron-3-nano-30b-a3b', ...(parsed as object) }, null, 2),
  );

  console.log('Hipóteses geradas e salvas em results/hypotheses.json. Próximo passo: cada uma precisa de script de backtest próprio (DataSplit + DeflatedSharpe + CostModel) antes de qualquer verdict.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
