/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  WEBAUTHN — login por biometria real (Passkeys/FIDO2)              ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 *
 * Padrão real usado por bancos e Big Tech (Apple/Google/Microsoft): o
 * sensor biométrico do próprio dispositivo do usuário (Face ID/Touch ID/
 * Windows Hello) gera um par de chaves LOCAL — a chave privada nunca sai
 * do dispositivo, nunca trafega pra este servidor, nunca é armazenada
 * aqui. O servidor só guarda a chave PÚBLICA e verifica assinaturas.
 * Não existe (e não pode existir) captura de digital neste código.
 *
 * 4 rotas, todas POST, roteadas pelo path depois de `/webauthn`:
 *  - /register-options     (autenticado)  → desafio pra CADASTRAR uma passkey nova
 *  - /register-verify      (autenticado)  → verifica a assinatura e grava a credencial
 *  - /authenticate-options (público)      → desafio pra LOGAR com passkey existente
 *  - /authenticate-verify  (público)      → verifica a assinatura e devolve um
 *                                            token_hash de magiclink pro client
 *                                            trocar por uma sessão real via
 *                                            supabase.auth.verifyOtp (nunca
 *                                            expomos senha nem service-role key
 *                                            ao browser)
 *  - /credentials           GET, autenticado → lista passkeys do usuário
 *  - /credentials/:id       DELETE, autenticado → remove uma passkey
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from 'npm:@simplewebauthn/server@10';
import { getServiceClient } from './lib/serviceClient.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  });
}

function getRpConfig() {
  // RP_ID = domínio "pelado" (sem protocolo/porta) — precisa bater
  // exatamente com o domínio que o browser está carregando, senão o
  // navegador recusa a chamada silenciosamente (regra do próprio WebAuthn,
  // não é bug nosso). RP_ORIGIN = origin completa (com protocolo).
  // Nenhum default hardcoded de propósito: produção está em manutenção
  // (ver CLAUDE.md) e o alias de preview de branch muda — sempre setar
  // explícito via `supabase secrets set` no ambiente que for testar.
  const rpID = Deno.env.get('WEBAUTHN_RP_ID');
  const rpOrigin = Deno.env.get('WEBAUTHN_RP_ORIGIN');
  if (!rpID || !rpOrigin) {
    throw new Error('WEBAUTHN_RP_ID / WEBAUTHN_RP_ORIGIN não configurados nas secrets do Supabase.');
  }
  return { rpID, rpOrigin, rpName: 'Neural Day Trader' };
}

async function resolveUserFromJwt(req: Request): Promise<{ id: string; email: string } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;
  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user?.email) return null;
  return { id: data.user.id, email: data.user.email };
}

async function cleanupExpiredChallenges(svc: ReturnType<typeof getServiceClient>) {
  // Best-effort, nunca bloqueia a resposta principal.
  try {
    await svc.from('webauthn_challenges').delete().lt('expires_at', new Date().toISOString());
  } catch (err) {
    console.error('[webauthn] Falha ao limpar challenges expirados (não bloqueante):', err);
  }
}

// ── /register-options ────────────────────────────────────────────────
async function handleRegisterOptions(req: Request) {
  const user = await resolveUserFromJwt(req);
  if (!user) return json({ error: 'Não autenticado' }, 401);

  const svc = getServiceClient();
  const { rpID, rpName } = getRpConfig();

  const { data: existing } = await svc
    .from('webauthn_credentials')
    .select('credential_id, transports')
    .eq('user_id', user.id);

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new TextEncoder().encode(user.id),
    userName: user.email,
    attestationType: 'none',
    excludeCredentials: (existing ?? []).map((c) => ({
      id: c.credential_id,
      transports: (c.transports ?? undefined) as any,
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required', // exige biometria/PIN de verdade, não só "presença"
    },
  });

  await cleanupExpiredChallenges(svc);
  await svc.from('webauthn_challenges').insert({
    user_id: user.id,
    email: user.email,
    challenge: options.challenge,
    purpose: 'register',
  });

  return json({ options });
}

// ── /register-verify ─────────────────────────────────────────────────
async function handleRegisterVerify(req: Request) {
  const user = await resolveUserFromJwt(req);
  if (!user) return json({ error: 'Não autenticado' }, 401);

  const body = await req.json();
  const { response, deviceName } = body as { response: unknown; deviceName?: string };
  if (!response) return json({ error: 'response ausente' }, 400);

  const svc = getServiceClient();
  const { rpID, rpOrigin } = getRpConfig();

  const { data: challengeRow } = await svc
    .from('webauthn_challenges')
    .select('id, challenge')
    .eq('user_id', user.id)
    .eq('purpose', 'register')
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!challengeRow) {
    return json({ error: 'Desafio expirado ou inexistente — inicie o cadastro novamente' }, 400);
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: response as any,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: rpOrigin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
  } catch (err: any) {
    console.error('[webauthn] register-verify falhou:', err);
    return json({ error: `Verificação falhou: ${err?.message ?? 'erro desconhecido'}` }, 400);
  }

  if (!verification.verified || !verification.registrationInfo) {
    return json({ error: 'Assinatura da passkey não verificada' }, 400);
  }

  const { credentialID, credentialPublicKey, counter, credentialDeviceType, credentialBackedUp } =
    verification.registrationInfo;

  await svc.from('webauthn_challenges').update({ used_at: new Date().toISOString() }).eq('id', challengeRow.id);

  const { error: insertErr } = await svc.from('webauthn_credentials').insert({
    user_id: user.id,
    credential_id: credentialID,
    public_key: btoa(String.fromCharCode(...credentialPublicKey)),
    counter,
    device_type: credentialDeviceType,
    backed_up: credentialBackedUp,
    transports: (response as any)?.response?.transports ?? null,
    device_name: deviceName?.slice(0, 80) ?? null,
  });

  if (insertErr) {
    console.error('[webauthn] Falha ao gravar credencial:', insertErr);
    return json({ error: 'Falha ao salvar a passkey' }, 500);
  }

  return json({ verified: true });
}

// ── /authenticate-options ────────────────────────────────────────────
async function handleAuthenticateOptions(req: Request) {
  const body = await req.json();
  const email = (body?.email as string | undefined)?.trim().toLowerCase();
  if (!email) return json({ error: 'email é obrigatório' }, 400);

  const svc = getServiceClient();
  const { rpID } = getRpConfig();

  const { data: authUser } = await svc.auth.admin.listUsers({ page: 1, perPage: 1, email } as any);
  const targetUser = authUser?.users?.find((u) => u.email?.toLowerCase() === email);

  // Resposta idêntica exista ou não o usuário/credencial — não vazar quais
  // emails têm passkey cadastrada (mesma disciplina anti-enumeração de
  // qualquer fluxo de login real).
  const genericOptions = await generateAuthenticationOptions({ rpID, userVerification: 'required' });

  if (!targetUser) {
    return json({ options: genericOptions });
  }

  const { data: creds } = await svc
    .from('webauthn_credentials')
    .select('credential_id, transports')
    .eq('user_id', targetUser.id);

  if (!creds || creds.length === 0) {
    return json({ options: genericOptions });
  }

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'required',
    allowCredentials: creds.map((c) => ({
      id: c.credential_id,
      transports: (c.transports ?? undefined) as any,
    })),
  });

  await cleanupExpiredChallenges(svc);
  await svc.from('webauthn_challenges').insert({
    user_id: targetUser.id,
    email,
    challenge: options.challenge,
    purpose: 'authenticate',
  });

  return json({ options });
}

// ── /authenticate-verify ─────────────────────────────────────────────
async function handleAuthenticateVerify(req: Request) {
  const body = await req.json();
  const email = (body?.email as string | undefined)?.trim().toLowerCase();
  const response = body?.response;
  if (!email || !response) return json({ error: 'email e response são obrigatórios' }, 400);

  const svc = getServiceClient();
  const { rpID, rpOrigin } = getRpConfig();

  const credentialId = response?.id as string | undefined;
  if (!credentialId) return json({ error: 'response inválida' }, 400);

  const { data: credRow } = await svc
    .from('webauthn_credentials')
    .select('id, user_id, credential_id, public_key, counter')
    .eq('credential_id', credentialId)
    .maybeSingle();

  if (!credRow) return json({ error: 'Passkey não reconhecida' }, 400);

  const { data: challengeRow } = await svc
    .from('webauthn_challenges')
    .select('id, challenge')
    .eq('email', email)
    .eq('purpose', 'authenticate')
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!challengeRow) {
    return json({ error: 'Desafio expirado ou inexistente — tente novamente' }, 400);
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: response as any,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: rpOrigin,
      expectedRPID: rpID,
      requireUserVerification: true,
      authenticator: {
        credentialID: credRow.credential_id,
        credentialPublicKey: Uint8Array.from(atob(credRow.public_key), (c) => c.charCodeAt(0)),
        counter: Number(credRow.counter),
      },
    });
  } catch (err: any) {
    console.error('[webauthn] authenticate-verify falhou:', err);
    return json({ error: `Verificação falhou: ${err?.message ?? 'erro desconhecido'}` }, 400);
  }

  if (!verification.verified) {
    return json({ error: 'Assinatura da passkey não verificada' }, 400);
  }

  await svc.from('webauthn_challenges').update({ used_at: new Date().toISOString() }).eq('id', challengeRow.id);
  await svc
    .from('webauthn_credentials')
    .update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
    .eq('id', credRow.id);

  // Biometria confirmada de verdade (assinatura criptográfica válida) —
  // agora precisamos de uma sessão Supabase real pro browser. generateLink
  // NÃO envia email nenhum, só emite um token válido que o client troca
  // via supabase.auth.verifyOtp — nunca expomos senha nem a service-role
  // key ao browser.
  const { data: linkData, error: linkErr } = await svc.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  if (linkErr || !linkData?.properties?.hashed_token) {
    console.error('[webauthn] Falha ao gerar token de sessão:', linkErr);
    return json({ error: 'Login biométrico verificado, mas falha ao criar sessão — tente de novo' }, 500);
  }

  return json({ verified: true, token_hash: linkData.properties.hashed_token });
}

// ── /credentials (list/delete) ───────────────────────────────────────
async function handleListCredentials(req: Request) {
  const user = await resolveUserFromJwt(req);
  if (!user) return json({ error: 'Não autenticado' }, 401);

  const svc = getServiceClient();
  const { data, error } = await svc
    .from('webauthn_credentials')
    .select('id, device_name, device_type, created_at, last_used_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return json({ error: 'Falha ao listar passkeys' }, 500);
  return json({ credentials: data ?? [] });
}

async function handleDeleteCredential(req: Request, credentialRowId: string) {
  const user = await resolveUserFromJwt(req);
  if (!user) return json({ error: 'Não autenticado' }, 401);

  const svc = getServiceClient();
  const { error } = await svc
    .from('webauthn_credentials')
    .delete()
    .eq('id', credentialRowId)
    .eq('user_id', user.id); // nunca deixa apagar credencial de outro usuário

  if (error) return json({ error: 'Falha ao remover passkey' }, 500);
  return json({ deleted: true });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  // Path chega como /webauthn/<rota> (ou /functions/v1/webauthn/<rota>) —
  // pega só o último segmento útil.
  const segments = url.pathname.split('/').filter(Boolean);
  const route = segments[segments.length - 1];
  const maybeCredentialId = segments.length >= 2 ? segments[segments.length - 1] : null;
  const isCredentialsDelete = req.method === 'DELETE' && segments[segments.length - 2] === 'credentials';

  try {
    if (isCredentialsDelete && maybeCredentialId) {
      return await handleDeleteCredential(req, maybeCredentialId);
    }
    if (req.method === 'GET' && route === 'credentials') {
      return await handleListCredentials(req);
    }
    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    switch (route) {
      case 'register-options':
        return await handleRegisterOptions(req);
      case 'register-verify':
        return await handleRegisterVerify(req);
      case 'authenticate-options':
        return await handleAuthenticateOptions(req);
      case 'authenticate-verify':
        return await handleAuthenticateVerify(req);
      default:
        return json({ error: `Rota desconhecida: ${route}` }, 404);
    }
  } catch (err: any) {
    console.error('[webauthn] Erro:', err);
    return json({ error: err?.message ?? 'Erro interno' }, 500);
  }
});
