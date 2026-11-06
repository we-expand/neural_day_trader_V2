/**
 * Mede a faixa de RUÍDO real de cada símbolo da cesta do LLM Brain, pra
 * comparar com as distâncias de stop que o motor efetivamente usa.
 *
 * MOTIVAÇÃO (2026-09-04): auditoria dos 403 trades fechados do LLM Brain
 * mostrou que 59% deles usaram o stop de FALLBACK cego de 0,500% -- o mesmo
 * valor pra EURUSD e pra BTCUSD, apesar de volatilidades ~10x diferentes --
 * e que esses trades concentram 73% de todo o prejuízo. A hipótese a testar
 * é que essa distância cai DENTRO da oscilação normal de curto prazo do
 * ativo, fazendo a posição ser encerrada por ruído antes de qualquer tese
 * direcional ter chance, independente de a direção estar certa.
 *
 * O QUE MEDE: pra uma entrada hipotética no open de cada vela, quanto o
 * preço anda CONTRA em 5 e 15 minutos (excursão adversa), em % do preço.
 * Calcula os dois lados (LONG sofre com a mínima, SHORT com a máxima), então
 * não depende de supor direção. A mediana e o p75 dessa distribuição são o
 * piso honesto pra um stop: abaixo disso, ser estopado é ruído, não sinal.
 *
 * COMO RODAR:
 *   node research/experiments/2026-09-04-ruido-vs-stop/medir_ruido.mjs
 * (lê NEURAL_SUPABASE_URL / NEURAL_SUPABASE_ANON_KEY de llm-active-brain/.env)
 *
 * ⚠️ PRÉ-REQUISITO: `/mt5-candles` precisa estar devolvendo `source: "REAL"`.
 * Na data em que este script foi escrito o endpoint estava em `SIMULATED`
 * pra toda a cesta (conta MetaAPI em HTTP 504, ver
 * SESSAO_2026-09-04_MONITORAMENTO_AO_VIVO_PRE_MERCADO_NYSE.md item 12), então
 * a medição NUNCA CHEGOU A RODAR de verdade. Reexecutar quando o feed voltar.
 * O script aborta explicitamente em SIMULATED em vez de medir dado fabricado.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const ENV_PATH = path.join(REPO_ROOT, "llm-active-brain/.env");

const env = Object.fromEntries(
  fs.readFileSync(ENV_PATH, "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const SUPABASE_URL = env.NEURAL_SUPABASE_URL;
const ANON_KEY = env.NEURAL_SUPABASE_ANON_KEY;

// Mesma cesta de llm-active-brain/src/assetBasket.ts (MT5_ASSET_BASKET).
const BASKET = ["BTCUSD", "XETUSD", "BTCXBN", "EURUSD", "XAUUSD", "UKOUSD", "GER40", "SPX500", "NAS100", "UK100"];

// Distância de stop usada quando o ATR real não está disponível
// (config.mt5StopFallbackPct em llm-active-brain/src/config.ts).
const STOP_FALLBACK_PCT = 0.5;

async function fetchCandles(symbol, timeframe, limit) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/server/mt5-candles`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ symbol, timeframe, limit }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return { error: `HTTP ${res.status}` };
  const json = await res.json();
  if (json.source === "SIMULATED") return { error: `SIMULATED (${json.warning ?? "sem detalhe"})` };
  if (!Array.isArray(json.candles)) return { error: "resposta sem candles" };
  return { candles: json.candles };
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

/** Excursão adversa em `windowMin` velas de 1m, em % do preço de entrada. */
function adverseExcursions(candles, windowMin) {
  const excursions = [];
  for (let i = 0; i + windowMin <= candles.length; i++) {
    const entry = Number(candles[i].open);
    if (!entry) continue;
    let low = Infinity;
    let high = -Infinity;
    for (let k = i; k < i + windowMin; k++) {
      low = Math.min(low, Number(candles[k].low));
      high = Math.max(high, Number(candles[k].high));
    }
    excursions.push(((entry - low) / entry) * 100);  // adverso pra LONG
    excursions.push(((high - entry) / entry) * 100); // adverso pra SHORT
  }
  return excursions;
}

console.log(`Stop de fallback atual: ${STOP_FALLBACK_PCT}% (igual pra todos os símbolos)\n`);
console.log("simbolo     n     adv5m_med  adv5m_p75  adv15m_med  veredito p/ stop de 0,5%");
console.log("-".repeat(88));

const results = {};
for (const symbol of BASKET) {
  const { candles, error } = await fetchCandles(symbol, "1m", 300);
  if (error) {
    console.log(`${symbol.padEnd(11)} --    ${error}`);
    continue;
  }
  const adv5 = adverseExcursions(candles, 5);
  const adv15 = adverseExcursions(candles, 15);
  const record = {
    n: candles.length,
    adv5_mediana: percentile(adv5, 0.5),
    adv5_p75: percentile(adv5, 0.75),
    adv15_mediana: percentile(adv15, 0.5),
  };
  results[symbol] = record;

  // Se a excursão adversa MEDIANA de 5min já alcança o stop, metade das
  // entradas é estopada por ruído puro antes de qualquer tese se resolver.
  const veredito = record.adv5_mediana >= STOP_FALLBACK_PCT
    ? "DENTRO DO RUÍDO (>=50% das entradas estopadas por oscilação)"
    : record.adv5_p75 >= STOP_FALLBACK_PCT
      ? "limítrofe (>=25% das entradas estopadas por oscilação)"
      : "fora do ruído de 5min";

  console.log(
    `${symbol.padEnd(11)} ${String(record.n).padEnd(5)} ` +
    `${record.adv5_mediana.toFixed(4)}%    ${record.adv5_p75.toFixed(4)}%   ` +
    `${record.adv15_mediana.toFixed(4)}%     ${veredito}`
  );
  await new Promise((resolve) => setTimeout(resolve, 1500)); // serial: teto de 5 concorrentes da MetaAPI
}

const outPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "resultados.json");
fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
console.log(`\nSalvo em ${outPath}`);
