// Cliente da LLM para o replay offline: mesmo provedor/modelo do motor (llm-active-brain/.env),
// concorrencia baixa pra NAO disputar a cota da chave com o motor ao vivo, cache em disco por chamada.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENV_FILE = path.resolve(HERE, "../../../llm-active-brain/.env");
const CACHE_DIR = path.resolve(HERE, "../cache/llm");

function readEnv() {
  const out = {};
  for (const line of fs.readFileSync(ENV_FILE, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}
const env = readEnv();
export const LLM_MODEL = process.env.REPLAY_LLM_MODEL || env.LLM_MODEL || "nvidia/nemotron-3-super-120b-a12b";
const BASE = "https://integrate.api.nvidia.com/v1";
const KEY = env.NVIDIA_API_KEY;

const MAX_CONCURRENT = Number(process.env.REPLAY_LLM_CONCURRENCY ?? 2);
const MIN_GAP_MS = Number(process.env.REPLAY_LLM_MIN_GAP_MS ?? 2500); // ~24 chamadas/min no total
let active = 0, lastStart = 0;
const queue = [];
async function slot() {
  while (active >= MAX_CONCURRENT || Date.now() - lastStart < MIN_GAP_MS) {
    await new Promise((r) => setTimeout(r, 200));
  }
  active++; lastStart = Date.now();
}

export async function chat({ system, user, thinking = false, maxTokens = 600, temperature = 0.2 }) {
  if (!KEY) throw new Error("NVIDIA_API_KEY ausente em llm-active-brain/.env");
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const h = crypto.createHash("sha256").update(JSON.stringify({ LLM_MODEL, system, user, thinking, maxTokens, temperature })).digest("hex").slice(0, 32);
  const file = path.join(CACHE_DIR, `${h}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  for (let attempt = 0; attempt < 6; attempt++) {
    await slot();
    try {
      const t0 = Date.now();
      const res = await fetch(`${BASE}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: LLM_MODEL,
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
          temperature, max_tokens: maxTokens, stream: false,
          chat_template_kwargs: { enable_thinking: thinking },
        }),
        signal: AbortSignal.timeout(180_000),
      });
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 5000 * 2 ** attempt));
        continue;
      }
      if (!res.ok) throw new Error(`NIM ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const j = await res.json();
      const msg = j.choices?.[0]?.message ?? {};
      const out = { content: msg.content ?? "", reasoning: msg.reasoning_content ?? null, ms: Date.now() - t0, usage: j.usage ?? null };
      fs.writeFileSync(file, JSON.stringify(out));
      return out;
    } catch (e) {
      if (attempt === 5) throw e;
      await new Promise((r) => setTimeout(r, 3000 * 2 ** attempt));
    } finally {
      active--;
    }
  }
  throw new Error("NIM: esgotou tentativas");
}

/** Extrai {decisao, confianca, motivo} da resposta (ultimo objeto JSON do texto). */
export function parseDecision(text) {
  const m = [...String(text).matchAll(/\{[^{}]*"decisao"[^{}]*\}/g)];
  if (!m.length) return null;
  try {
    const o = JSON.parse(m[m.length - 1][0]);
    const d = String(o.decisao ?? "").toUpperCase();
    if (!["LONG", "SHORT", "NONE"].includes(d)) return null;
    return { decisao: d, confianca: Number(o.confianca ?? 0), motivo: String(o.motivo ?? "") };
  } catch { return null; }
}
