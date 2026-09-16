/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  FOMC-CAPTIONS — legenda ao vivo do discurso do Fed, traduzida     ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 *
 * Criado em 2026-09-16 a pedido do Cleber pro discurso do Fed do dia.
 * Escopo desta 1ª versão (decisão explícita, dado o prazo curto):
 * LEGENDA TRADUZIDA EM TEMPO REAL, sem dublagem de voz — ver
 * CLAUDE.md/handoff da sessão pro porquê.
 *
 * Fontes reais, nenhuma fabricada:
 * - Vídeo ao vivo: player oficial do Fed (federalreserve.gov/live-broadcast.htm)
 *   é Brightcove, account 66043936001, video id 6376885161112 — confirmado
 *   inspecionando o DOM real da página (não é suposição). Consumido no
 *   FRONTEND via iframe público do Brightcove, não por esta function.
 * - Legenda original (inglês): o mesmo player do Fed expõe
 *   `custom_fields.transcriptlinkurl` (via Brightcove Playback API) apontando
 *   pra `https://www.streamtext.net/player?event=CFI-FRB` — StreamText é um
 *   serviço de legenda ao vivo por ESTENÓGRAFO HUMANO (CART), não ASR — é a
 *   legenda oficial que o próprio Fed usa, mais confiável que transcrever o
 *   áudio por conta própria. O player usa polling em
 *   `text-data.ashx?event=<EVENT>&last=<cursor>` (confirmado via
 *   Network tab ao vivo, 2026-09-16 — endpoint sem documentação pública).
 *
 * ACHADO IMPORTANTE, NÃO FABRICAR CONFIANÇA: o formato exato do JSON de
 * resposta de `text-data.ashx` só pôde ser confirmado quando o evento
 * estiver REALMENTE ao vivo (antes disso o endpoint devolve 404) — o parser
 * abaixo foi escrito de forma DEFENSIVA (tenta várias formas conhecidas de
 * serviço de CART: {Data,Position}/{data,position}/texto cru), mas não foi
 * validado contra uma resposta real ainda. Testar assim que a transmissão
 * começar, ANTES de confiar cegamente no texto capturado.
 *
 * ID do evento StreamText ('CFI-FRB') é específico do Fed — não muda por
 * reunião (confirmado: é canal fixo da instituição, não vídeo-por-evento).
 */

const STREAMTEXT_EVENT_DEFAULT = 'CFI-FRB';
const STREAMTEXT_BASE = 'https://www.streamtext.net/text-data.ashx';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function stripHtml(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

interface ParsedDelta {
  newText: string;
  nextCursor: string;
}

/** Parser defensivo — ver nota grande no topo do arquivo sobre a incerteza real do formato. */
function parseStreamTextDelta(body: string, previousCursor: string): ParsedDelta {
  const trimmed = body.trim();
  if (!trimmed) return { newText: '', nextCursor: previousCursor };

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object') {
      const dataField = parsed.Data ?? parsed.data ?? parsed.Text ?? parsed.text ?? parsed.lines ?? parsed.Lines;
      const posField = parsed.Position ?? parsed.position ?? parsed.Last ?? parsed.last ?? parsed.cursor;
      const text = Array.isArray(dataField) ? dataField.join(' ') : (dataField ?? '');
      return {
        newText: stripHtml(String(text ?? '')),
        nextCursor: posField !== undefined && posField !== null ? String(posField) : previousCursor,
      };
    }
  } catch {
    // não é JSON — trata como HTML/texto cru abaixo
  }

  // Fallback: corpo é HTML/texto cru. Sem cursor estruturado disponível,
  // usa o tamanho do corpo como proxy de posição (heurística, não confirmada
  // ao vivo ainda — ver nota no topo do arquivo).
  return { newText: stripHtml(trimmed), nextCursor: String(trimmed.length) };
}

async function translateToPortuguese(text: string): Promise<string> {
  if (!text.trim()) return '';

  const provider = (Deno.env.get('LLM_PROVIDER') || 'nvidia').toLowerCase();
  const prompt = `Traduza a transcrição a seguir de um discurso oficial do Federal Reserve (Fed) do inglês para português do Brasil. Mantenha o tom formal/institucional, termos técnicos de política monetária corretos (ex: "juros", "meta de inflação", "balanço patrimonial"), e não adicione nem remova informação. Devolva SOMENTE a tradução, sem comentário:\n\n"""${text}"""`;

  const messages = [{ role: 'user' as const, content: prompt }];

  if (provider === 'groq') {
    const apiKey = Deno.env.get('GROQ_API_KEY');
    if (!apiKey) throw new Error('[fomc-captions] GROQ_API_KEY ausente.');
    return callOpenAICompat('https://api.groq.com/openai/v1/chat/completions', apiKey, Deno.env.get('GROQ_MODEL') || 'openai/gpt-oss-120b', messages);
  }
  if (provider === 'anthropic') {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error('[fomc-captions] ANTHROPIC_API_KEY ausente.');
    return callAnthropic(apiKey, messages);
  }
  const apiKey = Deno.env.get('NVIDIA_API_KEY');
  if (!apiKey) throw new Error('[fomc-captions] NVIDIA_API_KEY ausente.');
  return callOpenAICompat('https://integrate.api.nvidia.com/v1/chat/completions', apiKey, Deno.env.get('NVIDIA_MODEL') || 'nvidia/nemotron-3-nano-30b-a3b', messages, { chat_template_kwargs: { enable_thinking: false } });
}

async function callOpenAICompat(
  url: string,
  apiKey: string,
  model: string,
  messages: { role: 'user'; content: string }[],
  extraBody?: Record<string, unknown>,
): Promise<string> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, max_tokens: 400, temperature: 0, messages, ...extraBody }),
  });
  if (!res.ok) throw new Error(`[fomc-captions] LLM API ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('[fomc-captions] Resposta do LLM sem conteúdo.');
  return String(content).trim();
}

async function callAnthropic(apiKey: string, messages: { role: 'user'; content: string }[]): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-5-20250929', max_tokens: 400, messages }),
  });
  if (!res.ok) throw new Error(`[fomc-captions] Anthropic API ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
  const data = await res.json();
  const text = data?.content?.find((b: any) => b.type === 'text')?.text;
  if (!text) throw new Error('[fomc-captions] Resposta da Anthropic sem texto.');
  return String(text).trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

  try {
    const url = new URL(req.url);
    const event = url.searchParams.get('event') || STREAMTEXT_EVENT_DEFAULT;
    const cursor = url.searchParams.get('cursor') || '-1';

    const stRes = await fetch(`${STREAMTEXT_BASE}?event=${encodeURIComponent(event)}&last=${encodeURIComponent(cursor)}`);

    if (!stRes.ok) {
      // 404 aqui é o estado normal ANTES do evento começar (confirmado ao vivo, 2026-09-16).
      return new Response(
        JSON.stringify({ live: false, cursor, originalText: '', translatedText: '', note: `Transmissão ainda não iniciada (streamtext ${stRes.status}).` }),
        { headers: { ...CORS_HEADERS, 'content-type': 'application/json' } },
      );
    }

    const body = await stRes.text();
    const { newText, nextCursor } = parseStreamTextDelta(body, cursor);

    let translatedText = '';
    if (newText) {
      try {
        translatedText = await translateToPortuguese(newText);
      } catch (translateErr) {
        console.error('[fomc-captions] Falha ao traduzir:', translateErr);
        translatedText = ''; // nunca fabrica tradução — melhor vazio que inventado
      }
    }

    return new Response(
      JSON.stringify({ live: true, cursor: nextCursor, originalText: newText, translatedText }),
      { headers: { ...CORS_HEADERS, 'content-type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('[fomc-captions] Erro:', err);
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    });
  }
});
