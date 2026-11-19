// 🔴 2026-11-06 (pedido do Cleber): painel de regulagem da LLM no Admin, com 2 perfis salvos (DIA UTIL e FIM DE SEMANA).
//
// Como funciona:
//  - No boot, o motor tira um retrato (BASELINE) de todo parametro numerico/booleano/texto de `config` (valor vindo do .env/default)
//    e publica esse retrato na tabela `llm_tuning_profiles` (linha BASELINE) -- o painel monta a tela a partir dele.
//  - A cada ciclo, o motor le a linha do perfil ativo (isWeekendMode() ? WEEKEND : WEEKDAY) e aplica os ajustes SOBRE o baseline.
//    Chave sem ajuste volta ao valor do .env. Sem restart.
//  - Seguranca: so aceita chave que existe no baseline, com o MESMO tipo; segredos, URLs, chaves de execucao real e parametros
//    lidos uma unica vez no boot ficam FORA (nao aparecem no painel e sao ignorados se alguem gravar no banco).
//  - Falha ao ler o banco = mantem o ultimo perfil aplicado (nunca reverte sozinho no meio de uma operacao).
import { config } from "./config.js";
import { isWeekendMode } from "./assetBasket.js";
import { getSupabaseClient } from "./neuralBridge.js";

type TunableValue = number | boolean | string | string[];
export type TuningProfile = "WEEKDAY" | "WEEKEND";

const TABLE = "llm_tuning_profiles";
const REFRESH_MS = 15_000;

// Nunca expostos: segredos/URLs/ids e a chave mestra de execucao REAL (regra do projeto: so o Cleber liga, por .env, depois de revisar).
const DENY_PATTERN = /(key|secret|private|password|token|url|userid|rpc)/i;
const DENY_EXACT = new Set([
  "mt5LiveExecutionEnabled",
  "mt5LiveAbsoluteLossLimitPct",
  "neuralBridgeEnabled",
  "mt5TradingEnabled",
  "tradingEnabled",
  "continuousMode",
  "maxCycles",
  "binanceTestnet",
  // lidos UMA vez no carregamento do modulo (precisam de restart, entao nao adianta oferecer no painel):
  "llmProvider",
  "llmModel",
  "llmFallbackModels",
  "mt5DeskConcurrency",
]);

const baseline: Record<string, TunableValue> = {};
let initialized = false;
let lastRefreshAt = 0;
let lastAppliedSignature = "";

function isTunableValue(v: unknown): v is TunableValue {
  if (typeof v === "boolean" || typeof v === "string") return true;
  if (typeof v === "number") return Number.isFinite(v);
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function sameType(base: TunableValue, next: unknown): next is TunableValue {
  if (Array.isArray(base)) return Array.isArray(next) && next.every((x) => typeof x === "string");
  if (typeof base === "number") return typeof next === "number" && Number.isFinite(next);
  return typeof next === typeof base;
}

export function currentProfile(now: Date = new Date()): TuningProfile {
  return isWeekendMode(now) ? "WEEKEND" : "WEEKDAY";
}

export async function initTuning(): Promise<void> {
  if (initialized) return;
  for (const [k, v] of Object.entries(config as Record<string, unknown>)) {
    if (DENY_EXACT.has(k) || DENY_PATTERN.test(k)) continue;
    if (!isTunableValue(v)) continue;
    baseline[k] = Array.isArray(v) ? [...v] : v;
  }
  initialized = true;
  console.log(`[tuning] baseline com ${Object.keys(baseline).length} parametros regulaveis.`);
  try {
    const sb = getSupabaseClient();
    const { error } = await sb.from(TABLE).upsert(
      { profile: "BASELINE", values: baseline, meta: { bootAt: new Date().toISOString() }, updated_at: new Date().toISOString() },
      { onConflict: "profile" }
    );
    if (error) throw error;
  } catch (err) {
    console.warn("[tuning] nao consegui publicar o baseline (tabela llm_tuning_profiles aplicada?):", err instanceof Error ? err.message : err);
  }
}

function assign(key: string, value: TunableValue) {
  (config as Record<string, unknown>)[key] = Array.isArray(value) ? [...value] : value;
}

/** Chamar no inicio de cada ciclo. Barato: no maximo 1 leitura a cada 15s. */
export async function refreshTuning(): Promise<void> {
  if (!initialized) await initTuning();
  const now = Date.now();
  if (now - lastRefreshAt < REFRESH_MS) return;
  lastRefreshAt = now;

  const profile = currentProfile();
  try {
    const sb = getSupabaseClient();
    const { data, error } = await sb.from(TABLE).select("values").eq("profile", profile).maybeSingle();
    if (error) throw error;
    const raw = (data?.values ?? {}) as Record<string, unknown>;

    const overrides: Record<string, TunableValue> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (!(k in baseline)) continue; // chave desconhecida ou proibida
      if (!sameType(baseline[k], v)) {
        console.warn(`[tuning] ajuste ignorado: ${k} tem tipo invalido (esperado ${Array.isArray(baseline[k]) ? "lista" : typeof baseline[k]}).`);
        continue;
      }
      overrides[k] = v;
    }

    // baseline + ajustes: toda chave sem ajuste volta ao valor do .env.
    for (const k of Object.keys(baseline)) assign(k, k in overrides ? overrides[k] : baseline[k]);

    const signature = `${profile}:${JSON.stringify(overrides)}`;
    if (signature !== lastAppliedSignature) {
      lastAppliedSignature = signature;
      const keys = Object.keys(overrides);
      console.log(`[tuning] perfil ${profile} aplicado: ${keys.length} ajuste(s)${keys.length ? " -> " + keys.map((k) => `${k}=${JSON.stringify(overrides[k])}`).join(", ") : ""}`);
      await sb
        .from(TABLE)
        .update({ meta: { bootAt: undefined, activeProfile: profile, appliedAt: new Date().toISOString(), overrideCount: keys.length } })
        .eq("profile", "BASELINE");
    }
  } catch (err) {
    console.warn("[tuning] falha ao ler perfil; mantendo o ultimo aplicado:", err instanceof Error ? err.message : err);
  }
}
