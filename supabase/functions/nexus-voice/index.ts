/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  NEXUS-VOICE — TTS neural (ElevenLabs) para a fala do NEXUS         ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 *
 * Recebe texto já gerado pelo `nexus-brain` e devolve áudio (mp3) via
 * ElevenLabs. Existe como function separada (não dentro do nexus-brain)
 * porque a resposta é binária, não JSON — mais simples manter os dois
 * contratos isolados.
 *
 * Se `ELEVENLABS_API_KEY` não estiver configurada, ou a chamada falhar
 * (ex: cota do plano free estourada), responde 424 com um motivo claro —
 * o client (useNexusVoice.ts) trata isso como sinal para cair no TTS
 * nativo do navegador, nunca trava a conversa por falta de voz neural.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Voz padrão ElevenLabs "Sarah" (pt-BR-capable via modelo multilingual) —
// trocável futuramente por secret ELEVENLABS_VOICE_ID sem novo deploy.
const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL';
const ELEVENLABS_MODEL = 'eleven_multilingual_v2';

interface RequestBody {
  text: string;
}

async function resolveUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) return null;
  return data.user.id;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS_HEADERS });
  }

  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: CORS_HEADERS });
    }

    const body = (await req.json()) as RequestBody;
    const text = body.text?.trim();
    if (!text) {
      return new Response(JSON.stringify({ error: 'text é obrigatório' }), { status: 400, headers: CORS_HEADERS });
    }

    const apiKey = Deno.env.get('ELEVENLABS_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'ELEVENLABS_API_KEY ausente no ambiente — usar fallback de TTS do navegador.' }),
        { status: 424, headers: CORS_HEADERS }
      );
    }

    const voiceId = Deno.env.get('ELEVENLABS_VOICE_ID') || DEFAULT_VOICE_ID;
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'xi-api-key': apiKey,
        accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: ELEVENLABS_MODEL,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
          style: 0.35,
          use_speaker_boost: true,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(`[nexus-voice] ElevenLabs API ${res.status}: ${errText.slice(0, 300)}`);
      return new Response(
        JSON.stringify({ error: `ElevenLabs ${res.status} — usar fallback de TTS do navegador.` }),
        { status: 424, headers: CORS_HEADERS }
      );
    }

    const audioBuffer = await res.arrayBuffer();
    return new Response(audioBuffer, {
      headers: { ...CORS_HEADERS, 'content-type': 'audio/mpeg' },
    });
  } catch (err: any) {
    console.error('[nexus-voice] Erro:', err);
    return new Response(JSON.stringify({ error: err?.message ?? 'Erro interno' }), { status: 500, headers: CORS_HEADERS });
  }
});
