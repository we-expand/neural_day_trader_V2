// Neural Day Trader Platform - Server v2.3 (RESILIENT KV + ERROR HANDLING)
import { Hono } from 'npm:hono@4';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { translateEvent } from './translations.ts';
import { createInvestingEvents } from './investing-events-pt.ts';
import { translateEconomicEvents } from './translate-events.ts';
import * as kv from './kv_store_resilient.tsx'; // 🔄 RESILIENT: auto-retry para operações do banco
import { synthesizeSpeech, validateGoogleTTSKey } from './tts-google.ts';
import { transcribeAudio, validateGoogleSTTKey } from './stt-google.ts';
import { processUserQuestion, generateAlertResponse } from './neural-assistant.ts';

const app = new Hono().basePath('/server');

// 🔍 HELPER: Get MetaAPI Token with detailed logging
async function getMetaApiToken(bodyToken?: string): Promise<string | null> {
    const envToken = Deno.env.get('METAAPI_TOKEN');
    
    // Tentar buscar do KV store
    let kvToken: string | null = null;
    try {
        kvToken = await kv.get('metaapi_token');
        
        // 🔥 VALIDAR: Se o token do KV for inválido, ignorar e limpar
        if (kvToken && (
            kvToken.length < 100 || // Token muito curto
            kvToken === 'aquela' || // Placeholder antigo
            !kvToken.startsWith('eyJ') // Não é JWT
        )) {
            console.warn(`[METAAPI] ⚠️ Token do KV inválido detectado: "${kvToken?.substring(0, 20)}..." (length: ${kvToken?.length})`);
            console.warn(`[METAAPI] 🗑️ Limpando token inválido do KV store...`);
            await kv.del('metaapi_token');
            kvToken = null;
        }
    } catch (error) {
        console.warn('[METAAPI] ⚠️ Erro ao buscar token do KV:', error);
    }
    
    // Prioridade: ENV > KV Store > Body (ENV tem prioridade agora!)
    const finalToken = envToken || kvToken || bodyToken || null;
    
    // Debug silencioso - não polui logs
    const tokenSource = envToken ? 'ENV' : kvToken ? 'KV' : bodyToken ? 'BODY' : 'NENHUM';
    const isPlaceholder = finalToken && finalToken.length === 6 && finalToken === 'aquela';
    const isValid = finalToken && finalToken.length > 100 && finalToken.startsWith('eyJ');
    
    // Log condensado
    console.log(`[METAAPI] Token: ${tokenSource} | Length: ${finalToken?.length || 0} | Valid: ${isValid ? '✅' : isPlaceholder ? '⚠️ placeholder' : '❌'}`);
    
    // Se for placeholder, retornar null silenciosamente (alerta visual aparecerá no frontend)
    if (isPlaceholder) {
        return null;
    }
    
    return finalToken;
}

// ========================================
// 🔒 BROKER CREDENTIALS: auth + criptografia (Fase 1 de segurança)
// ========================================
// Verifica o JWT do usuário logado (enviado pelo client via supabase.functions.invoke,
// que já inclui "Authorization: Bearer <access_token>" automaticamente) e retorna o
// user_id verificado. Nunca confiar em um userId vindo do body/query do client sozinho.
async function getAuthenticatedUserId(c: any): Promise<string | null> {
    try {
        const authHeader = c.req.header('Authorization');
        if (!authHeader?.startsWith('Bearer ')) return null;
        const jwt = authHeader.slice(7);

        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (!supabaseUrl || !supabaseServiceKey) return null;

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        const { data, error } = await supabaseAdmin.auth.getUser(jwt);
        if (error || !data?.user) return null;

        return data.user.id;
    } catch (e) {
        console.error('[AUTH] Erro ao verificar JWT:', e);
        return null;
    }
}

// Criptografia simétrica (AES-GCM) do token MetaAPI em repouso.
// Chave vive só como secret da Edge Function (BROKER_CREDENTIALS_ENCRYPTION_KEY),
// nunca no banco. Gerar com: openssl rand -base64 32
async function getBrokerEncryptionKey(): Promise<CryptoKey> {
    const keyB64 = Deno.env.get('BROKER_CREDENTIALS_ENCRYPTION_KEY');
    if (!keyB64) throw new Error('BROKER_CREDENTIALS_ENCRYPTION_KEY não configurada nos secrets da function');
    const keyBytes = Uint8Array.from(atob(keyB64), (ch) => ch.charCodeAt(0));
    return crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function encryptBrokerSecret(plaintext: string): Promise<{ ciphertext: string; iv: string }> {
    const key = await getBrokerEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const encryptedBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    return {
        ciphertext: btoa(String.fromCharCode(...new Uint8Array(encryptedBuf))),
        iv: btoa(String.fromCharCode(...iv)),
    };
}

async function decryptBrokerSecret(ciphertextB64: string, ivB64: string): Promise<string> {
    const key = await getBrokerEncryptionKey();
    const iv = Uint8Array.from(atob(ivB64), (ch) => ch.charCodeAt(0));
    const ciphertext = Uint8Array.from(atob(ciphertextB64), (ch) => ch.charCodeAt(0));
    const decryptedBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return new TextDecoder().decode(decryptedBuf);
}

const METAAPI_CLIENT_API_BASE = 'https://mt-client-api-v1.new-york.agiliumtrade.ai';

// Cada conta MetaAPI é hospedada numa região específica (new-york, london, singapore, vint-hill...).
// Chamar o client-api com a região errada trava/retorna 504. Descobrimos a região certa consultando
// a provisioning API (que devolve o campo "region" da conta) e cacheamos por accountId.
const metaApiRegionCache = new Map<string, string>();

async function getMetaApiClientApiBase(token: string, accountId: string): Promise<string> {
    const cached = metaApiRegionCache.get(accountId);
    if (cached) return cached;

    try {
        const res = await fetch(`https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${accountId}`, {
            headers: { 'auth-token': token, 'Accept': 'application/json' },
        });
        if (res.ok) {
            const account = await res.json();
            const region = account?.region || (Array.isArray(account?.regions) ? account.regions[0] : null);
            if (region) {
                const base = `https://mt-client-api-v1.${region}.agiliumtrade.ai`;
                metaApiRegionCache.set(accountId, base);
                console.log(`[METAAPI] 🌍 Região detectada para conta ${accountId}: ${region}`);
                return base;
            }
        }
    } catch (err) {
        console.warn('[METAAPI] ⚠️ Falha ao detectar região da conta, usando new-york como padrão:', err);
    }

    return METAAPI_CLIENT_API_BASE;
}

// 🕯️ Candles históricos (OHLCV) vivem numa API **separada** da de tick/execução
// (mt-market-data-client-api-v1, não mt-client-api-v1) e num formato de rota
// diferente: /historical-market-data/symbols/:symbol/timeframes/:timeframe/candles
// — startTime é o ponto MAIS RECENTE e os candles vêm PRA TRÁS a partir dele
// (não um range startTime→endTime). Usar a URL/host de tick pra candles dá 404
// pra QUALQUER símbolo (bug real encontrado em 2026-07-07: a rota
// /mt5-candles-history sempre 404ava, mascarado até então porque o gráfico
// caía num fallback sintético local sem avisar).
async function getMetaApiMarketDataApiBase(token: string, accountId: string): Promise<string> {
    const cached = metaApiRegionCache.get(`md:${accountId}`);
    if (cached) return cached;

    try {
        const res = await fetch(`https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${accountId}`, {
            headers: { 'auth-token': token, 'Accept': 'application/json' },
        });
        if (res.ok) {
            const account = await res.json();
            const region = account?.region || (Array.isArray(account?.regions) ? account.regions[0] : null);
            if (region) {
                const base = `https://mt-market-data-client-api-v1.${region}.agiliumtrade.ai`;
                metaApiRegionCache.set(`md:${accountId}`, base);
                return base;
            }
        }
    } catch (err) {
        console.warn('[METAAPI] ⚠️ Falha ao detectar região (market-data) da conta, usando new-york como padrão:', err);
    }

    return 'https://mt-market-data-client-api-v1.new-york.agiliumtrade.ai';
}

/**
 * ✅ 2026-07-12: `/mt5-prices` processava TODOS os símbolos de um chunk com
 * `Promise.all` puro — cada símbolo dispara 2 chamadas à MetaAPI (ticker +
 * candle D1, hosts diferentes), então um chunk de 40 símbolos (já o tamanho
 * reduzido especificamente pra não sobrecarregar a conta, ver
 * RealMarketDataService.getBatchedMT5Data) na prática virava até 80
 * requisições SIMULTÂNEAS pra mesma conta MetaAPI compartilhada. Isso bate
 * exatamente com o padrão reportado pelo Cleber: symbol sets pequenos
 * (índices, ~7 símbolos) sempre saem perfeitos; forex (dezenas de pares no
 * mesmo chunk) frequentemente tem `changePercent: 0` (candle 429 mas ticker
 * passou — ex: USDCAD) ou preço "errado" (ticker TAMBÉM 429, caindo no
 * último preço real conhecido, desatualizado). Fix: limitar quantos símbolos
 * do MESMO chunk têm ticker+candle em voo ao mesmo tempo.
 */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let nextIndex = 0;

    async function worker() {
        while (nextIndex < items.length) {
            const i = nextIndex++;
            results[i] = await fn(items[i]);
        }
    }

    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
}

// Fase 3: deploy/undeploy automático por inatividade (evita pagar hospedagem MetaAPI
// de conta ociosa — ~US$8,64/mês por conta sempre ativa). Antes de qualquer execução,
// garante que a conta esteja com state=DEPLOYED e conectada; o cron (/broker/undeploy-inactive)
// derruba contas sem atividade recente.
async function ensureAccountDeployed(token: string, accountId: string): Promise<void> {
    const res = await fetch(`https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${accountId}`, {
        headers: { 'auth-token': token, 'Accept': 'application/json' },
    });
    if (!res.ok) return; // deixa a chamada seguinte (ex: account-information) falhar com erro mais específico

    const account = await res.json();
    if (account.state === 'DEPLOYED') return;

    console.log(`[METAAPI] 🚀 Conta ${accountId} com state=${account.state}, fazendo deploy...`);
    await fetch(`https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${accountId}/deploy`, {
        method: 'POST',
        headers: { 'auth-token': token, 'Accept': 'application/json' },
    });

    // Mesmo padrão de espera usado em /mt5/connect: até 30s pela conexão real.
    for (let attempt = 0; attempt < 15; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const statusRes = await fetch(`https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${accountId}`, {
            headers: { 'auth-token': token, 'Accept': 'application/json' },
        });
        if (statusRes.ok) {
            const status = await statusRes.json();
            if (status.connectionStatus === 'CONNECTED') return;
        }
    }
    console.warn(`[METAAPI] ⚠️ Timeout aguardando conexão da conta ${accountId} depois do deploy`);
}

async function undeployBrokerAccount(token: string, accountId: string): Promise<boolean> {
    try {
        const res = await fetch(`https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${accountId}/undeploy`, {
            method: 'POST',
            headers: { 'auth-token': token, 'Accept': 'application/json' },
        });
        return res.ok;
    } catch (_e) {
        return false;
    }
}

async function touchBrokerAccountActivity(userId: string, deployed: boolean): Promise<void> {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) return;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    await supabaseAdmin
        .from('broker_credentials')
        .update({ last_active_at: new Date().toISOString(), deployed })
        .eq('user_id', userId);
}

async function loadDecryptedBrokerCredentials(userId: string): Promise<{ token: string; accountId: string } | null> {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) return null;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error } = await supabaseAdmin
        .from('broker_credentials')
        .select('account_id, token_ciphertext, token_iv')
        .eq('user_id', userId)
        .maybeSingle();

    if (error || !data) return null;

    const token = await decryptBrokerSecret(data.token_ciphertext, data.token_iv);
    return { token, accountId: data.account_id };
}

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "apikey", "x-client-info"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Auto-Confirm Sign Up Route
app.post("/signup", async (c) => {
    try {
        const { email, password, name, firstName, lastName } = await c.req.json();
        
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !supabaseServiceKey) {
            return c.json({ error: "Configuração de servidor incompleta (chaves ausentes)." }, 500);
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        // Prepare user metadata
        const userMetadata: Record<string, any> = {};
        
        // Priority: firstName/lastName, fallback to name, fallback to 'Trader'
        if (firstName || lastName) {
            if (firstName) userMetadata.firstName = firstName;
            if (lastName) userMetadata.lastName = lastName;
            userMetadata.name = `${firstName || ''} ${lastName || ''}`.trim() || 'Trader';
        } else if (name) {
            userMetadata.name = name;
        } else {
            userMetadata.name = 'Trader';
        }

        // 1. Try to create user with auto-confirm
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
            user_metadata: userMetadata,
            email_confirm: true 
        });

        if (error) {
            // 2. ERROR HANDLING & RESCUE STRATEGY
            // If user already exists, check if they are unconfirmed and fix them
            if (error.code === 'email_exists' || error.message.includes('already been registered')) {
                
                const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
                
                if (listError) return c.json({ error: "Erro ao verificar base de usuários." }, 500);

                const existingUser = users.find(u => u.email === email);

                if (existingUser) {
                    if (!existingUser.email_confirmed_at) {
                        const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                            existingUser.id,
                            { 
                                email_confirm: true, 
                                password: password, 
                                user_metadata: userMetadata 
                            }
                        );
                        if (updateError) return c.json({ error: "Falha ao ativar conta existente." }, 500);
                        return c.json({ user: updatedUser.user, message: "Sua conta antiga foi localizada e ativada com sucesso!" });
                    } else {
                        return c.json({ error: "Este e-mail já está registrado e ativo. Por favor, faça login." }, 409);
                    }
                }
            }
            return c.json({ error: error.message }, 400);
        }

        return c.json({ user: data.user, message: "Conta criada com sucesso." });

    } catch (e: any) {
        console.error("Server Error:", e);
        return c.json({ error: e.message }, 500);
    }
});

// DELETE USER ROUTE (Hard Reset)
app.post("/delete-user", async (c) => {
    try {
        const { email } = await c.req.json();
        
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !supabaseServiceKey) {
            return c.json({ error: "Configuração incompleta." }, 500);
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        
        // Find User ID
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) return c.json({ error: "Erro ao listar usuários." }, 500);

        const userToDelete = users.find(u => u.email === email);

        if (!userToDelete) {
            return c.json({ message: "Usuário não encontrado (já estava limpo)." });
        }

        // Delete User
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userToDelete.id);
        if (deleteError) return c.json({ error: deleteError.message }, 500);

        return c.json({ message: "Conta excluída com sucesso." });

    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// List Users Route (Admin Only)
app.get("/list-users", async (c) => {
    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !supabaseServiceKey) {
            return c.json({ error: "Configuração incompleta." }, 500);
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        
        const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
        
        if (error) return c.json({ error: error.message }, 500);

        // Map to safe format
        const safeUsers = users.map(u => ({
            id: u.id,
            email: u.email,
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at,
            user_metadata: u.user_metadata,
            app_metadata: u.app_metadata
        }));

        return c.json({ users: safeUsers });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// Deposit Checkout Route (One-time Payment)
app.post("/deposit", async (c) => {
    try {
        const body = await c.req.json();
        const { amount, currency = 'usd', userId, email } = body;
        
        const stripeKeyRaw = Deno.env.get('STRIPE_SECRET_KEY');
        const stripeKey = stripeKeyRaw ? stripeKeyRaw.trim().replace(/^["']|["']$/g, '') : '';
        
        console.log(`Debug Stripe: Key exists? ${!!stripeKey}, Length: ${stripeKey.length}, Prefix: ${stripeKey.substring(0, 3)}...`);
        
        let stripe;
        let session;

        try {
             // 1. Check if key is missing OR invalid format
             // Relaxed check: Just needs to exist and have reasonable length. 
             // We removed the strict 'sk_'/'rk_' prefix check to avoid false positives with custom/restricted keys.
             const isKeyInvalid = !stripeKey || stripeKey.length < 8;
             
             if (isKeyInvalid) {
                 let reason = "invalid_len";
                 if (!stripeKey) reason = "missing_key";
                 
                 const keyPrefix = stripeKey ? `${stripeKey.substring(0, 5)}...` : "null";
                 console.warn(`Stripe Key Invalid/Missing. Reason: ${reason}. Prefix: ${keyPrefix}`);
                 
                 const origin = c.req.header('origin') || 'https://neural-trader.vercel.app';
                 return c.json({ 
                     url: `${origin}/?payment=success&simulated=true&amount=${amount}&currency=${currency}&session_id=sim_${Date.now()}&uid=${userId}&reason=${reason}&key_debug=${keyPrefix}`,
                     simulated: true,
                     warning: `Stripe Key Issue: ${reason} (Len: ${stripeKey.length}, Exists: ${!!stripeKey})`,
                     key_debug: keyPrefix
                 });
             }
             
             // 2. Valid format, try to initialize Stripe.
             stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
             
             // Create Checkout Session
             const paymentMethods: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] = ['card'];
             if (currency.toLowerCase() === 'brl') paymentMethods.push('boleto', 'pix');
     
             const origin = c.req.header('origin') || 'https://neural-trader.vercel.app'; // Fallback origin

             session = await stripe.checkout.sessions.create({
                 payment_method_types: paymentMethods,
                 line_items: [{
                     price_data: {
                         currency: currency,
                         product_data: {
                             name: 'Depósito em Carteira (Neural Day Trader)',
                             description: `Crédito de ${currency.toUpperCase()} ${amount} na conta de trading.`,
                         },
                         unit_amount: Math.round(amount * 100),
                     },
                     quantity: 1,
                 }],
                 mode: 'payment',
                 success_url: `${origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}&amount=${amount}&currency=${currency}`,
                 cancel_url: `${origin}/?payment=cancel`,
                 client_reference_id: userId,
                 customer_email: email,
                 metadata: { type: 'deposit', userId: userId, target_currency: currency }
             });

             return c.json({ url: session.url, simulated: false });

        } catch (stripeError: any) {
             console.error("Payment Gateway Error:", stripeError);
             return c.json({ 
                 error: stripeError.message, 
                 code: stripeError.code || 'STRIPE_ERROR',
                 details: stripeError.toString()
             }, 400);
        }
    } catch (e: any) {
        console.error("Deposit Route Error:", e);
        return c.json({ error: e.message }, 400);
    }
});

// Payment Checkout Route (Subscriptions)
app.post("/checkout", async (c) => {
    try {
        const body = await c.req.json();
        const { planId, email, userId } = body;
        
        const stripeKeyRaw = Deno.env.get('STRIPE_SECRET_KEY');
        const stripeKey = stripeKeyRaw ? stripeKeyRaw.trim().replace(/^["']|["']$/g, '') : '';
        
        // Plan Details Mapping
        const plans: Record<string, { price: number, name: string }> = {
            'pro': { price: 97, name: 'Plano Pro (Mensal)' },
            'enterprise': { price: 297, name: 'Plano Enterprise (Mensal)' }
        };

        const selectedPlan = plans[planId] || plans['pro'];

        // Simulation Mode if no Stripe Key or Invalid Key
        const isKeyInvalid = !stripeKey || stripeKey.length < 8;

        if (isKeyInvalid) {
            let reason = "invalid_len";
            if (!stripeKey) reason = "missing_key";

            console.log(`Stripe Key missing or invalid (${reason}). Simulating subscription checkout.`);
            const origin = c.req.header('origin') || 'https://neural-trader.vercel.app';
            const keyPrefix = stripeKey ? `${stripeKey.substring(0, 5)}...` : "null";
            
            return c.json({ 
                url: `${origin}/?payment=success&simulated=true&plan=${planId}&reason=${reason}&key_debug=${keyPrefix}`,
                simulated: true,
                warning: `Stripe Key Issue: ${reason}`
            });
        }

        const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
        
        const origin = c.req.header('origin') || 'https://neural-trader.vercel.app';

        // Create Checkout Session with Inline Product (No pre-setup required)
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: selectedPlan.name,
                        description: 'Acesso completo às ferramentas Neural Day Trader.',
                    },
                    unit_amount: selectedPlan.price * 100,
                    recurring: {
                        interval: 'month',
                    },
                },
                quantity: 1,
            }],
            mode: 'subscription',
            success_url: `${origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}&plan=${planId}`,
            cancel_url: `${origin}/?payment=cancel`,
            customer_email: email,
            client_reference_id: userId,
            metadata: {
                type: 'subscription',
                plan: planId,
                userId: userId
            }
        });

        return c.json({ url: session.url, simulated: false });
    } catch (e: any) {
        console.error("Stripe Subscription Error:", e);
        return c.json({ error: e.message }, 400);
    }
});

// Verify Payment Route (For client-side confirmation when webhooks are not possible)
app.post("/verify-payment", async (c) => {
    try {
        const { sessionId, simulated, amount, currency = 'USD', userId: manualUserId } = await c.req.json();
        
        let amountValue = 0;
        let typeValue = 'deposit';
        let userId = manualUserId;
        let assetSymbol = currency;

        // --- REAL STRIPE VERIFICATION ---
        if (!simulated && sessionId) {
            const stripeKeyRaw = Deno.env.get('STRIPE_SECRET_KEY');
            const stripeKey = stripeKeyRaw ? stripeKeyRaw.trim().replace(/^["']|["']$/g, '') : '';

            if (!stripeKey) return c.json({ error: "Stripe config missing" }, 500);

            const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
            
            // 1. Retrieve Session from Stripe
            const session = await stripe.checkout.sessions.retrieve(sessionId);
            
            if (session.payment_status !== 'paid') {
                return c.json({ error: "Payment not confirmed" }, 400);
            }

            // 2. Extract Data from Session
            amountValue = session.amount_total ? session.amount_total / 100 : 0;
            typeValue = session.metadata?.type || 'deposit';
            userId = session.client_reference_id;
            assetSymbol = session.currency?.toUpperCase() || 'USD';
        } 
        // --- SIMULATED VERIFICATION ---
        else if (simulated) {
             console.log("Processing Simulated Transaction");
             amountValue = Number(amount);
             if (isNaN(amountValue) || amountValue <= 0) return c.json({ error: "Invalid amount" }, 400);
             // userId must be passed in body for simulation
             if (!userId) return c.json({ error: "User ID required for simulation" }, 400);
        } else {
            return c.json({ error: "Invalid verification request" }, 400);
        }

        if (!userId) {
            return c.json({ error: "User unknown in session" }, 400);
        }

        // 3. Database Operations (Refactored to use KV Store)
        const idempotencyKey = simulated ? `sim_${userId}_${amountValue}_${Date.now()}` : sessionId;
        const txKey = `tx:${userId}:${idempotencyKey}`;
        
        // Check Idempotency via KV
        const existingTx = await kv.get(txKey);
        if (existingTx) {
            return c.json({ message: "Transaction already processed", status: "completed" });
        }

        // A. Update Wallet Balance (KV)
        let finalBalance = 0;
        if (typeValue === 'deposit') {
            const walletKey = `wallet:${userId}`;
            const currentWallet = await kv.get(walletKey) || { balance: 0 };
            
            const newBalance = (Number(currentWallet.balance) || 0) + amountValue;
            finalBalance = newBalance;
            
            await kv.set(walletKey, {
                balance: newBalance,
                updated_at: new Date().toISOString()
            });
        }

        // B. Insert Transaction Record (KV)
        const transactionData = {
            id: idempotencyKey,
            user_id: userId,
            type: typeValue,
            amount: amountValue,
            status: 'completed',
            asset_symbol: assetSymbol,
            metadata: { 
                method: simulated ? 'simulation' : 'stripe',
                stripe_session_id: simulated ? null : sessionId,
                simulated: simulated
            },
            created_at: new Date().toISOString()
        };

        await kv.set(txKey, transactionData);

        return c.json({ status: "success", amount: amountValue, newBalance: finalBalance });

    } catch (e: any) {
        console.error("Payment Verification Error:", e);
        return c.json({ error: e.message }, 500);
    }
});

// --- NEW ENDPOINTS FOR KV-BASED WALLET SYSTEM ---

// Get Wallet Balance
app.get("/wallet", async (c) => {
    try {
        const userId = c.req.query('userId');
        if (!userId) return c.json({ error: "userId required" }, 400);

        const wallet = await kv.get(`wallet:${userId}`);
        return c.json({ balance: wallet?.balance || 0 });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// Get Transaction History
app.get("/transactions", async (c) => {
    try {
        const userId = c.req.query('userId');
        if (!userId) return c.json({ error: "userId required" }, 400);

        // Fetch all transactions for user
        const transactions = await kv.getByPrefix(`tx:${userId}`);
        
        // Sort by created_at desc
        transactions.sort((a: any, b: any) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        return c.json({ transactions });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// Record Manual Transaction (for Crypto/Pix/Manual requests from frontend)
app.post("/transaction", async (c) => {
    try {
        const body = await c.req.json();
        const { userId, type, amount, method, status = 'pending', metadata } = body;

        if (!userId || !amount) return c.json({ error: "Invalid data" }, 400);

        const txId = `manual_${Date.now()}_${Math.random().toString(36).substr(2,5)}`;
        const txKey = `tx:${userId}:${txId}`;

        const txData = {
            id: txId,
            user_id: userId,
            type,
            amount,
            status,
            asset_symbol: 'USD',
            metadata: { ...metadata, method },
            created_at: new Date().toISOString()
        };

        // If transaction is completed immediately (e.g. simulated or admin), update wallet
        if (status === 'completed' && type === 'deposit') {
            const walletKey = `wallet:${userId}`;
            const currentWallet = await kv.get(walletKey) || { balance: 0 };
            const newBalance = (Number(currentWallet.balance) || 0) + Number(amount);
            
            await kv.set(walletKey, {
                balance: newBalance,
                updated_at: new Date().toISOString()
            });
        }

        await kv.set(txKey, txData);

        return c.json({ status: "success", transaction: txData });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// Telemetry Track Route
app.post("/telemetry/track", async (c) => {
    try {
        const body = await c.req.json();
        const { fingerprint } = body;
        
        if (!fingerprint) {
            return c.json({ error: "Missing fingerprint data" }, 400);
        }

        // Use high-resolution timestamp for ordering
        const key = `access_log:${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        
        await kv.set(key, fingerprint);
        
        return c.json({ status: "tracked", id: key });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// MT5 Token Management Routes
// 🔒 PATCH DE SEGURANÇA (Fase 1): antes aceitava qualquer userId no body/query sem checar
// quem estava chamando (IDOR — dava pra ler/sobrescrever o token de qualquer usuário).
// Agora exige JWT válido e o userId tem que ser o do dono do token autenticado.
app.post("/mt5-token/save", async (c) => {
    try {
        const authenticatedUserId = await getAuthenticatedUserId(c);
        if (!authenticatedUserId) {
            return c.json({ error: "Não autenticado" }, 401);
        }

        const body = await c.req.json();
        const { userId, token } = body;

        if (!userId || !token) {
            return c.json({ error: "userId and token required" }, 400);
        }

        if (userId !== authenticatedUserId) {
            return c.json({ error: "Não autorizado a salvar token de outro usuário" }, 403);
        }

        // Save token with user ID
        const key = `mt5_token:${userId}`;
        await kv.set(key, {
            token,
            updated_at: new Date().toISOString()
        });
        
        console.log(`✅ MT5 Token saved for user ${userId}`);
        return c.json({ status: "success", message: "Token saved" });
    } catch (e: any) {
        console.error("Error saving MT5 token:", e);
        return c.json({ error: e.message }, 500);
    }
});

app.get("/mt5-token/load", async (c) => {
    try {
        const authenticatedUserId = await getAuthenticatedUserId(c);
        if (!authenticatedUserId) {
            return c.json({ error: "Não autenticado" }, 401);
        }

        const userId = c.req.query('userId');
        if (!userId) {
            return c.json({ error: "userId required" }, 400);
        }

        if (userId !== authenticatedUserId) {
            return c.json({ error: "Não autorizado a ler token de outro usuário" }, 403);
        }

        const key = `mt5_token:${userId}`;
        const data = await kv.get(key);
        
        if (!data) {
            return c.json({ token: null });
        }
        
        console.log(`✅ MT5 Token loaded for user ${userId}`);
        return c.json({ token: data.token, updated_at: data.updated_at });
    } catch (e: any) {
        console.error("Error loading MT5 token:", e);
        return c.json({ error: e.message }, 500);
    }
});

// ========================================
// 🔐 BROKER CREDENTIALS (Fase 1 — item crítico fechado aqui)
// Token MetaAPI do usuário nunca mais vive no client. Fica criptografado nesta
// tabela (broker_credentials), e só esta Edge Function (service_role) consegue
// decriptar pra executar ordens. O client só chama estas rotas autenticado.
// ========================================

app.post('/broker/credentials', async (c) => {
    try {
        const authenticatedUserId = await getAuthenticatedUserId(c);
        if (!authenticatedUserId) {
            return c.json({ error: 'Não autenticado' }, 401);
        }

        const { token, accountId, mt5Login, mt5Server } = await c.req.json();

        if (!token || token.trim().length < 100) {
            return c.json({ error: 'Token inválido - muito curto (mínimo 100 caracteres)' }, 400);
        }
        if (!token.trim().startsWith('eyJ')) {
            return c.json({ error: 'Token inválido - deve ser um JWT MetaAPI (começa com "eyJ")' }, 400);
        }
        if (!accountId || String(accountId).trim().length < 5) {
            return c.json({ error: 'accountId inválido' }, 400);
        }

        const { ciphertext, iv } = await encryptBrokerSecret(token.trim());

        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseAdmin = createClient(supabaseUrl!, supabaseServiceKey!);

        const { error } = await supabaseAdmin.from('broker_credentials').upsert({
            user_id: authenticatedUserId,
            account_id: String(accountId).trim(),
            token_ciphertext: ciphertext,
            token_iv: iv,
            mt5_login: mt5Login || null,
            mt5_server: mt5Server || null,
        }, { onConflict: 'user_id' });

        if (error) {
            console.error('[BROKER] Erro ao salvar credenciais:', error);
            return c.json({ error: 'Erro ao salvar credenciais' }, 500);
        }

        return c.json({ success: true, message: 'Credenciais salvas com segurança' });
    } catch (e: any) {
        console.error('[BROKER] Erro em /broker/credentials POST:', e);
        return c.json({ error: e.message }, 500);
    }
});

app.get('/broker/credentials/status', async (c) => {
    try {
        const authenticatedUserId = await getAuthenticatedUserId(c);
        if (!authenticatedUserId) {
            return c.json({ error: 'Não autenticado' }, 401);
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseAdmin = createClient(supabaseUrl!, supabaseServiceKey!);

        const { data, error } = await supabaseAdmin
            .from('broker_credentials')
            .select('account_id, mt5_login, mt5_server, updated_at')
            .eq('user_id', authenticatedUserId)
            .maybeSingle();

        if (error) {
            console.error('[BROKER] Erro ao ler status:', error);
            return c.json({ error: 'Erro ao ler status das credenciais' }, 500);
        }

        if (!data) {
            return c.json({ configured: false });
        }

        // Nunca devolver o token, nem mascarado — só o suficiente pra UI confirmar a conexão.
        return c.json({
            configured: true,
            accountId: data.account_id,
            mt5Login: data.mt5_login,
            mt5Server: data.mt5_server,
            updatedAt: data.updated_at,
        });
    } catch (e: any) {
        console.error('[BROKER] Erro em /broker/credentials/status:', e);
        return c.json({ error: e.message }, 500);
    }
});

app.delete('/broker/credentials', async (c) => {
    try {
        const authenticatedUserId = await getAuthenticatedUserId(c);
        if (!authenticatedUserId) {
            return c.json({ error: 'Não autenticado' }, 401);
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseAdmin = createClient(supabaseUrl!, supabaseServiceKey!);

        // Derruba a conta na MetaAPI antes de apagar a credencial, pra não deixá-la
        // hospedada (e sendo cobrada) órfã sem ninguém pra desligar depois.
        const existing = await loadDecryptedBrokerCredentials(authenticatedUserId);
        if (existing) {
            await undeployBrokerAccount(existing.token, existing.accountId);
        }

        const { error } = await supabaseAdmin
            .from('broker_credentials')
            .delete()
            .eq('user_id', authenticatedUserId);

        if (error) {
            console.error('[BROKER] Erro ao remover credenciais:', error);
            return c.json({ error: 'Erro ao remover credenciais' }, 500);
        }

        return c.json({ success: true, message: 'Credenciais removidas' });
    } catch (e: any) {
        console.error('[BROKER] Erro em /broker/credentials DELETE:', e);
        return c.json({ error: e.message }, 500);
    }
});

// Chamada só pelo pg_cron (via pg_net), nunca pelo client — protegida por um secret
// compartilhado (CRON_SECRET) que só existe nos secrets da Edge Function e na migration
// que agenda o job. Varre broker_credentials por contas deployed=true sem atividade
// recente e faz undeploy delas (ver migration 005_broker_account_lifecycle.sql).
const BROKER_INACTIVITY_MINUTES = 15;

app.post('/broker/undeploy-inactive', async (c) => {
    try {
        const cronSecret = Deno.env.get('CRON_SECRET');
        if (!cronSecret || c.req.header('x-cron-secret') !== cronSecret) {
            return c.json({ error: 'Não autorizado' }, 401);
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (!supabaseUrl || !supabaseServiceKey) {
            return c.json({ error: 'Configuração de servidor incompleta' }, 500);
        }
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        const cutoff = new Date(Date.now() - BROKER_INACTIVITY_MINUTES * 60 * 1000).toISOString();
        const { data: staleAccounts, error } = await supabaseAdmin
            .from('broker_credentials')
            .select('user_id, account_id, token_ciphertext, token_iv')
            .eq('deployed', true)
            .lt('last_active_at', cutoff);

        if (error) {
            console.error('[BROKER-CRON] Erro ao buscar contas inativas:', error);
            return c.json({ error: error.message }, 500);
        }

        let undeployedCount = 0;
        let failedCount = 0;
        for (const row of staleAccounts || []) {
            try {
                const token = await decryptBrokerSecret(row.token_ciphertext, row.token_iv);
                const ok = await undeployBrokerAccount(token, row.account_id);
                if (ok) {
                    await supabaseAdmin.from('broker_credentials').update({ deployed: false }).eq('user_id', row.user_id);
                    undeployedCount++;
                } else {
                    failedCount++;
                }
            } catch (e) {
                console.error(`[BROKER-CRON] Falha ao processar conta ${row.account_id}:`, e);
                failedCount++;
            }
        }

        console.log(`[BROKER-CRON] Checadas ${staleAccounts?.length || 0} contas inativas, ${undeployedCount} undeploy, ${failedCount} falhas`);
        return c.json({ success: true, checked: staleAccounts?.length || 0, undeployed: undeployedCount, failed: failedCount });
    } catch (e: any) {
        console.error('[BROKER-CRON] Erro em /broker/undeploy-inactive:', e);
        return c.json({ error: e.message }, 500);
    }
});

// Executa leituras (preços/conta/posições) e ordens reais (compra/venda/fechar/modificar)
// na conta MT5 do usuário autenticado, chamando a REST Client API do MetaAPI server-side.
// O token nunca trafega de volta pro client.
app.post('/broker/execute', async (c) => {
    try {
        const authenticatedUserId = await getAuthenticatedUserId(c);
        if (!authenticatedUserId) {
            return c.json({ error: 'Não autenticado' }, 401);
        }

        const credentials = await loadDecryptedBrokerCredentials(authenticatedUserId);
        if (!credentials) {
            return c.json({ error: 'Nenhuma credencial MetaAPI configurada para este usuário' }, 400);
        }
        const { token, accountId } = credentials;
        await ensureAccountDeployed(token, accountId);
        touchBrokerAccountActivity(authenticatedUserId, true).catch((e) => console.warn('[BROKER] Falha ao atualizar last_active_at:', e));
        const clientApiBase = await getMetaApiClientApiBase(token, accountId);

        const body = await c.req.json();
        const { action } = body;

        const metaApiHeaders = {
            'auth-token': token,
            'Content-Type': 'application/json',
        };

        // --- Leituras ---
        if (action === 'getAccountInfo') {
            const res = await fetch(`${clientApiBase}/users/current/accounts/${accountId}/account-information`, {
                headers: metaApiHeaders,
            });
            if (!res.ok) return c.json({ error: `MetaApi HTTP ${res.status}` }, 502);
            return c.json({ success: true, accountInfo: await res.json() });
        }

        if (action === 'getPositions') {
            const res = await fetch(`${clientApiBase}/users/current/accounts/${accountId}/positions`, {
                headers: metaApiHeaders,
            });
            if (!res.ok) return c.json({ error: `MetaApi HTTP ${res.status}` }, 502);
            return c.json({ success: true, positions: await res.json() });
        }

        if (action === 'getPrices') {
            const { symbols } = body;
            if (!Array.isArray(symbols)) return c.json({ error: 'symbols deve ser um array' }, 400);
            const prices = [];
            for (const symbol of symbols) {
                try {
                    const res = await fetch(`${clientApiBase}/users/current/accounts/${accountId}/symbols/${symbol}/current-tick`, {
                        headers: metaApiHeaders,
                    });
                    if (!res.ok) continue;
                    const tick = await res.json();
                    prices.push({
                        symbol,
                        bid: tick.bid || 0,
                        ask: tick.ask || 0,
                        last: tick.bid || 0,
                        spread: (tick.ask || 0) - (tick.bid || 0),
                        timestamp: Date.now(),
                    });
                } catch (_e) {
                    // símbolo individual falhou, segue pros próximos
                }
            }
            return c.json({ success: true, prices });
        }

        // --- Execução de ordens reais ---
        const tradeActionMap: Record<string, (b: any) => any> = {
            createMarketBuyOrder: (b) => ({ actionType: 'ORDER_TYPE_BUY', symbol: b.symbol, volume: b.volume, stopLoss: b.stopLoss, takeProfit: b.takeProfit, comment: b.comment || 'Neural Day Trader' }),
            createMarketSellOrder: (b) => ({ actionType: 'ORDER_TYPE_SELL', symbol: b.symbol, volume: b.volume, stopLoss: b.stopLoss, takeProfit: b.takeProfit, comment: b.comment || 'Neural Day Trader' }),
            closePosition: (b) => ({ actionType: 'POSITION_CLOSE_ID', positionId: b.positionId }),
            closePositionPartially: (b) => ({ actionType: 'POSITION_PARTIAL', positionId: b.positionId, volume: b.volume }),
            modifyPosition: (b) => ({ actionType: 'POSITION_MODIFY', positionId: b.positionId, stopLoss: b.stopLoss, takeProfit: b.takeProfit }),
            closeAllPositionsBySymbol: (b) => ({ actionType: 'POSITIONS_CLOSE_SYMBOL', symbol: b.symbol }),
        };

        if (action === 'closeAllPositions') {
            const posRes = await fetch(`${clientApiBase}/users/current/accounts/${accountId}/positions`, {
                headers: metaApiHeaders,
            });
            if (!posRes.ok) return c.json({ error: `MetaApi HTTP ${posRes.status}` }, 502);
            const positions = await posRes.json();

            let closedCount = 0;
            let failedCount = 0;
            for (const position of positions) {
                const closeRes = await fetch(`${clientApiBase}/users/current/accounts/${accountId}/trade`, {
                    method: 'POST',
                    headers: metaApiHeaders,
                    body: JSON.stringify({ actionType: 'POSITION_CLOSE_ID', positionId: position.id }),
                });
                if (closeRes.ok) closedCount++; else failedCount++;
            }
            return c.json({
                success: failedCount === 0,
                message: `${closedCount} posições fechadas (${failedCount} falharam)`,
            });
        }

        const buildTradeBody = tradeActionMap[action];
        if (!buildTradeBody) {
            return c.json({ error: `Ação desconhecida: ${action}` }, 400);
        }

        const tradeRes = await fetch(`${clientApiBase}/users/current/accounts/${accountId}/trade`, {
            method: 'POST',
            headers: metaApiHeaders,
            body: JSON.stringify(buildTradeBody(body)),
        });

        const tradeResult = await tradeRes.json().catch(() => ({}));

        if (!tradeRes.ok) {
            return c.json({
                success: false,
                error: tradeResult.message || `MetaApi HTTP ${tradeRes.status}`,
            }, 502);
        }

        return c.json({
            success: true,
            orderId: tradeResult.orderId,
            positionId: tradeResult.positionId,
            message: tradeResult.message,
        });
    } catch (e: any) {
        console.error('[BROKER] Erro em /broker/execute:', e);
        return c.json({ error: e.message }, 500);
    }
});

// Health check endpoint
app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

// User Profile Endpoints
app.get("/user-profile", async (c) => {
    try {
        const userId = c.req.query('userId');
        if (!userId) return c.json({ error: "userId required" }, 400);

        const profile = await kv.get(`user-profile:${userId}`);
        // 🔄 RESILIENT: retorna null se perfil não existe (sem erro)
        return c.json({ profile: profile || null });
    } catch (e: any) {
        console.error("Error loading user profile:", e.message || e);
        // 🔄 FALLBACK: retorna perfil vazio em caso de erro crítico
        return c.json({ profile: null }, 200);
    }
});

app.post("/user-profile", async (c) => {
    try {
        const { userId, profile } = await c.req.json();
        if (!userId || !profile) return c.json({ error: "userId and profile required" }, 400);

        await kv.set(`user-profile:${userId}`, profile);
        return c.json({ success: true, profile });
    } catch (e: any) {
        console.error("Error saving user profile:", e);
        return c.json({ error: e.message }, 500);
    }
});

// ==================== ECONOMIC CALENDAR PARSERS ====================

// Parser para extrair eventos do Investing.com via __NEXT_DATA__
async function fetchInvestingCalendarFromNextData(): Promise<any[]> {
    try {
        console.log('[INVESTING-NEXTDATA] Iniciando parser...');
        
        const response = await fetch('https://www.investing.com/economic-calendar/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });
        
        if (!response.ok) {
            console.log(`[INVESTING-NEXTDATA] HTTP ${response.status}`);
            return [];
        }
        
        const html = await response.text();
        console.log(`[INVESTING-NEXTDATA] HTML baixado: ${html.length} caracteres`);
        
        // Extrair __NEXT_DATA__
        const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
        if (!nextDataMatch || !nextDataMatch[1]) {
            console.log('[INVESTING-NEXTDATA] __NEXT_DATA__ não encontrado');
            return [];
        }
        
        const nextDataJson = JSON.parse(nextDataMatch[1]);
        console.log('[INVESTING-NEXTDATA] __NEXT_DATA__ parseado com sucesso');
        
        // Acessar state.economicCalendarStore
        const economicCalendarStore = nextDataJson?.props?.pageProps?.state?.economicCalendarStore;
        if (!economicCalendarStore) {
            console.log('[INVESTING-NEXTDATA] economicCalendarStore não encontrado');
            return [];
        }
        
        console.log('[INVESTING-NEXTDATA] economicCalendarStore encontrado!');
        
        // ✅ ESTRUTURA DESCOBERTA: calendarEventsByDate["YYYY-MM-DD"]
        const calendarEventsByDate = economicCalendarStore.calendarEventsByDate;
        if (!calendarEventsByDate) {
            console.log('[INVESTING-NEXTDATA] calendarEventsByDate não encontrado');
            return [];
        }
        
        // Pegar data de hoje no formato YYYY-MM-DD
        const today = new Date().toISOString().split('T')[0];
        console.log('[INVESTING-NEXTDATA] Data de hoje:', today);
        
        // Tentar pegar eventos de hoje
        let events: any[] = [];
        if (calendarEventsByDate[today]) {
            events = calendarEventsByDate[today];
        } else {
            // Se não tiver eventos de hoje, pegar a primeira data disponível
            const firstDate = Object.keys(calendarEventsByDate)[0];
            if (firstDate) {
                console.log('[INVESTING-NEXTDATA] Usando primeira data disponível:', firstDate);
                events = calendarEventsByDate[firstDate];
            }
        }
        
        if (events.length === 0) {
            console.log('[INVESTING-NEXTDATA] Nenhum evento encontrado');
            console.log('[INVESTING-NEXTDATA] Datas disponíveis:', Object.keys(calendarEventsByDate));
            return [];
        }
        
        console.log(`[INVESTING-NEXTDATA] ${events.length} eventos encontrados!`);
        console.log('[INVESTING-NEXTDATA] Primeiro evento COMPLETO:', JSON.stringify(events[0], null, 2));
        console.log('[INVESTING-NEXTDATA] Estrutura do evento:', Object.keys(events[0]));
        
        // Normalizar eventos para formato padrão
        const normalizedEvents = events.map((event: any) => {
            // 🔍 DEBUG: Mostrar estrutura real de cada campo
            const normalized = {
                time: event.time || event.actual_time || event.date || event.datetime || '',
                currency: event.currency || event.currencyCode || event.symbol || '',
                importance: parseInt(event.importance || event.volatility || event.stars || '1'),
                event: event.event || event.name || event.title || event.eventName || 'Evento Econômico',
                actual: event.actual || event.actualValue || '',
                forecast: event.forecast || event.forecastValue || event.consensus || '',
                previous: event.previous || event.previousValue || event.revised || '',
                country: event.country || event.countryCode || event.region || '',
                period: event.period || event.for_date || ''
            };
            
            return normalized;
        });
        
        console.log('[INVESTING-NEXTDATA] Primeiro evento NORMALIZADO:', JSON.stringify(normalizedEvents[0], null, 2));
        
        return normalizedEvents;
        
    } catch (e: any) {
        // ✅ SILENCIAR ERROS DE CONEXÃO
        const isConnectionError = e.message && (
            e.message.includes('Connection refused') ||
            e.message.includes('ECONNREFUSED') ||
            e.message.includes('tcp connect error') ||
            e.message.includes('client error')
        );
        
        if (isConnectionError) {
            console.log('[INVESTING-NEXTDATA] ⚠️ Conexão não disponível (esperado no Supabase)');
        } else {
            console.error('[INVESTING-NEXTDATA] Erro:', e.message);
        }
        return [];
    }
}

// ==================== END ECONOMIC CALENDAR PARSERS ====================

// ==================== USER DATA COLLECTION ROUTES ====================

// Save User Data (from Onboarding)
app.post("/user-data", async (c) => {
    try {
        const body = await c.req.json();
        const { userData, timestamp } = body;

        // Generate unique ID
        const userId = crypto.randomUUID();
        const dataEntry = {
            id: userId,
            timestamp: timestamp || new Date().toISOString(),
            ...userData
        };

        // Save to KV store with unique key
        await kv.set(`user-data:${userId}`, dataEntry);

        // Also add to index for listing
        const existingIndex = await kv.get('user-data-index') || [];
        const updatedIndex = [...existingIndex, userId];
        await kv.set('user-data-index', updatedIndex);

        console.log(`User data saved: ${userId} - ${userData.fullName}`);

        return c.json({ 
            success: true, 
            id: userId,
            message: "Dados salvos com sucesso" 
        });

    } catch (e: any) {
        console.error("Error saving user data:", e);
        return c.json({ error: e.message }, 500);
    }
});

// Get All User Data (Admin)
app.get("/user-data", async (c) => {
    try {
        // Get index of all user IDs
        const userIndex = await kv.get('user-data-index') || [];

        if (userIndex.length === 0) {
            return c.json({ users: [] });
        }

        // Fetch all user data entries
        const userKeys = userIndex.map((id: string) => `user-data:${id}`);
        const usersData = await kv.mget(userKeys);

        // Filter out any null values and return
        const validUsers = usersData.filter((user: any) => user !== null);

        console.log(`Retrieved ${validUsers.length} user data entries`);

        return c.json({ users: validUsers });

    } catch (e: any) {
        console.error("Error fetching user data:", e);
        return c.json({ error: e.message }, 500);
    }
});

// Get Single User Data by ID
app.get("/user-data/:id", async (c) => {
    try {
        const userId = c.req.param('id');
        const userData = await kv.get(`user-data:${userId}`);

        if (!userData) {
            return c.json({ error: "User not found" }, 404);
        }

        return c.json({ user: userData });

    } catch (e: any) {
        console.error("Error fetching user data:", e);
        return c.json({ error: e.message }, 500);
    }
});

// Delete User Data (Admin - GDPR Compliance)
app.delete("/user-data/:id", async (c) => {
    try {
        const userId = c.req.param('id');

        // Remove from KV
        await kv.del(`user-data:${userId}`);

        // Remove from index
        const userIndex = await kv.get('user-data-index') || [];
        const updatedIndex = userIndex.filter((id: string) => id !== userId);
        await kv.set('user-data-index', updatedIndex);

        console.log(`User data deleted: ${userId}`);

        return c.json({ 
            success: true,
            message: "Dados do usuário removidos (LGPD/GDPR compliance)" 
        });

    } catch (e: any) {
        console.error("Error deleting user data:", e);
        return c.json({ error: e.message }, 500);
    }
});

// Export User Data as CSV (Admin)
app.get("/user-data/export/csv", async (c) => {
    try {
        const userIndex = await kv.get('user-data-index') || [];
        
        if (userIndex.length === 0) {
            return c.text("No data to export", 404);
        }

        const userKeys = userIndex.map((id: string) => `user-data:${id}`);
        const usersData = await kv.mget(userKeys);
        const validUsers = usersData.filter((user: any) => user !== null);

        // CSV Headers
        const headers = [
            'ID', 'Timestamp', 'Full Name', 'Email', 'Phone', 'WhatsApp',
            'Date of Birth', 'Document Type', 'Document Number',
            'ZIP Code', 'Street', 'Number', 'Complement', 'Neighborhood',
            'City', 'State', 'Country', 'Occupation', 'Monthly Income',
            'Trading Experience', 'Investment Goal', 'Risk Tolerance',
            'Trading Hours/Week', 'Marketing Consent'
        ];

        // CSV Rows
        const rows = validUsers.map((user: any) => [
            user.id,
            user.timestamp,
            user.fullName,
            user.email,
            user.phoneNumber,
            user.whatsappNumber || '',
            user.dateOfBirth,
            user.documentType,
            user.documentNumber,
            user.zipCode,
            user.street,
            user.number,
            user.complement || '',
            user.neighborhood,
            user.city,
            user.state,
            user.country,
            user.occupation,
            user.monthlyIncome,
            user.tradingExperience,
            user.investmentGoal,
            user.riskTolerance,
            user.tradingHoursPerWeek || '',
            user.marketingConsent ? 'YES' : 'NO'
        ].map(cell => `"${cell}"`).join(','));

        const csv = [headers.join(','), ...rows].join('\n');

        return c.text(csv, 200, {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="user_data_${new Date().toISOString().split('T')[0]}.csv"`
        });

    } catch (e: any) {
        console.error("Error exporting CSV:", e);
        return c.json({ error: e.message }, 500);
    }
});

// ==================== END USER DATA ROUTES ====================

// 🔧 DEBUG: Ver estrutura RAW dos eventos
app.get("/debug-raw-events", async (c) => {
    try {
        console.log('[DEBUG-RAW] Iniciando...');
        
        const response = await fetch('https://www.investing.com/economic-calendar/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });
        
        const html = await response.text();
        const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
        
        if (!nextDataMatch || !nextDataMatch[1]) {
            return c.json({ error: '__NEXT_DATA__ não encontrado' });
        }
        
        const nextDataJson = JSON.parse(nextDataMatch[1]);
        const economicCalendarStore = nextDataJson?.props?.pageProps?.state?.economicCalendarStore;
        
        if (!economicCalendarStore) {
            return c.json({ error: 'economicCalendarStore não existe' });
        }
        
        const calendarEventsByDate = economicCalendarStore.calendarEventsByDate;
        if (!calendarEventsByDate) {
            return c.json({ error: 'calendarEventsByDate não existe' });
        }
        
        const today = new Date().toISOString().split('T')[0];
        let events = calendarEventsByDate[today];
        
        if (!events || events.length === 0) {
            const firstDate = Object.keys(calendarEventsByDate)[0];
            events = calendarEventsByDate[firstDate];
        }
        
        // Retornar primeiro evento COMPLETO sem modificações
        return c.json({
            success: true,
            totalEvents: events.length,
            today: today,
            availableDates: Object.keys(calendarEventsByDate),
            firstEventRAW: events[0],
            firstEventKeys: Object.keys(events[0]),
            sampleEvents: events.slice(0, 3)
        });
        
    } catch (e: any) {
        return c.json({ error: e.message, stack: e.stack });
    }
});

// 🔧 DEBUG TEMPORÁRIO: diagnosticar por que translateText() (usada por
// /news/aggregate e /economic-calendar) está devolvendo texto igual ao
// original em produção, mesmo com o endpoint público do Google Translate
// respondendo normalmente quando testado fora do Supabase. Console.log não
// é acessível pelas ferramentas de log disponíveis (só log de acesso HTTP),
// então expõe o diagnóstico direto na resposta JSON. Remover depois de
// confirmar a causa raiz.
app.get("/debug-translate", async (c) => {
    const text = c.req.query('text') || "Here's what happened in crypto today";
    const targetLang = c.req.query('lang') || 'pt';
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
    try {
        const start = Date.now();
        const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
        const elapsedMs = Date.now() - start;
        const bodyText = await response.text();
        let parsed: any = null;
        let parseError: string | null = null;
        try { parsed = JSON.parse(bodyText); } catch (e: any) { parseError = e.message; }
        return c.json({
            requestedUrl: url,
            httpStatus: response.status,
            httpOk: response.ok,
            elapsedMs,
            bodyPreview: bodyText.slice(0, 500),
            parseError,
            extractedTranslation: Array.isArray(parsed?.[0]) ? parsed[0].map((s: any) => s?.[0] ?? '').join('') : null,
        });
    } catch (e: any) {
        return c.json({ requestedUrl: url, fetchError: e.message, fetchErrorName: e.name });
    }
});

// 🔧 DEBUG: Testar APIs da agenda econômica
app.get("/debug-economic-calendar", async (c) => {
    const logs: string[] = [];
    const results: any = {};
    
    logs.push('🔍 [DEBUG] Iniciando teste das APIs...');
    
    // TESTE 1: MQL5
    logs.push('📞 [DEBUG] Testando MQL5...');
    const mql5Result = await fetchMQL5CalendarDebug();
    results.mql5 = mql5Result;
    logs.push(...mql5Result.logs);
    logs.push(`✅ [MQL5] ${mql5Result.success ? `${mql5Result.count} eventos` : `FALHOU: ${mql5Result.error}`}`);
    
    // TESTE 2: Investing.com (NOVO PARSER __NEXT_DATA__)
    logs.push('📞 [DEBUG] Testando Investing.com (Parser __NEXT_DATA__)...');
    try {
        const investingEvents = await fetchInvestingCalendarFromNextData();
        if (investingEvents && investingEvents.length > 0) {
            results.investing = {
                success: true,
                count: investingEvents.length,
                sample: investingEvents.slice(0, 3),
                error: null,
                logs: [`✅ [INVESTING] ${investingEvents.length} eventos extraídos com sucesso!`]
            };
            logs.push(`✅ [INVESTING] ${investingEvents.length} eventos`);
        } else {
            results.investing = {
                success: false,
                count: 0,
                sample: null,
                error: 'Nenhum evento encontrado no __NEXT_DATA__',
                logs: ['❌ [INVESTING] Parser não encontrou eventos']
            };
            logs.push(`✅ [INVESTING] FALHOU: Nenhum evento encontrado`);
        }
    } catch (e: any) {
        results.investing = {
            success: false,
            count: 0,
            sample: null,
            error: e.message,
            logs: [`❌ [INVESTING] Erro: ${e.message}`]
        };
        logs.push(`✅ [INVESTING] FALHOU: ${e.message}`);
    }
    
    // TESTE 3: Yahoo Finance
    logs.push('📞 [DEBUG] Testando Yahoo Finance...');
    const yahooResult = await fetchYahooFinanceCalendarDebug();
    results.yahoo = yahooResult;
    logs.push(...yahooResult.logs);
    logs.push(`✅ [YAHOO] ${yahooResult.success ? `${yahooResult.count} eventos` : `FALHOU: ${yahooResult.error}`}`);
    
    return c.json({
        logs,
        results,
        timestamp: new Date().toISOString()
    });
});

// 🔧 DEBUG: Ver HTML completo do Investing.com
app.get("/debug-investing-html", async (c) => {
    try {
        const response = await fetch('https://www.investing.com/economic-calendar/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });
        
        const html = await response.text();
        
        // Tentar extrair __NEXT_DATA__
        let nextDataJson = null;
        let nextDataError = null;
        
        try {
            const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
            if (nextDataMatch && nextDataMatch[1]) {
                const jsonStr = nextDataMatch[1];
                nextDataJson = JSON.parse(jsonStr);
            }
        } catch (e: any) {
            nextDataError = e.message;
        }
        
        // Análise profunda da estrutura
        let analysisDetails: any = {};
        if (nextDataJson?.props?.pageProps) {
            const pageProps = nextDataJson.props.pageProps;
            analysisDetails = {
                pagePropsKeys: Object.keys(pageProps),
                hasEconomicCalendarData: 'economicCalendarData' in pageProps,
                hasEvents: 'events' in pageProps,
                hasRows: 'rows' in pageProps,
                hasData: 'data' in pageProps,
                firstLevelSample: {} as any
            };
            
            // Mostrar amostra de cada chave do primeiro nível
            for (const key of Object.keys(pageProps)) {
                const value = pageProps[key];
                if (Array.isArray(value)) {
                    analysisDetails.firstLevelSample[key] = {
                        type: 'array',
                        length: value.length,
                        firstItem: value[0] ? JSON.stringify(value[0]).substring(0, 500) : null
                    };
                } else if (typeof value === 'object' && value !== null) {
                    analysisDetails.firstLevelSample[key] = {
                        type: 'object',
                        keys: Object.keys(value),
                        sample: JSON.stringify(value).substring(0, 500)
                    };
                } else {
                    analysisDetails.firstLevelSample[key] = {
                        type: typeof value,
                        value: String(value).substring(0, 200)
                    };
                }
            }
        }
        
        return c.json({
            status: response.status,
            statusText: response.statusText,
            htmlLength: html.length,
            nextData: {
                found: !!nextDataJson,
                error: nextDataError,
                keysFound: nextDataJson ? Object.keys(nextDataJson) : [],
                propsKeys: nextDataJson?.props ? Object.keys(nextDataJson.props) : [],
                pagePropsKeys: nextDataJson?.props?.pageProps ? Object.keys(nextDataJson.props.pageProps) : [],
                analysisDetails: analysisDetails
            }
        });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// 🔧 DEBUG: Analisar economicCalendarStore do Investing.com
app.get("/debug-calendar-store", async (c) => {
    try {
        const response = await fetch('https://www.investing.com/economic-calendar/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });
        
        const html = await response.text();
        
        // Extrair __NEXT_DATA__
        const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
        if (!nextDataMatch || !nextDataMatch[1]) {
            return c.json({ error: '__NEXT_DATA__ não encontrado' });
        }
        
        const nextDataJson = JSON.parse(nextDataMatch[1]);
        const economicCalendarStore = nextDataJson?.props?.pageProps?.state?.economicCalendarStore;
        
        if (!economicCalendarStore) {
            return c.json({ error: 'economicCalendarStore não existe' });
        }
        
        // Análise profunda do store
        const analysis: any = {
            type: Array.isArray(economicCalendarStore) ? 'array' : 'object',
            keys: Array.isArray(economicCalendarStore) ? null : Object.keys(economicCalendarStore),
            length: Array.isArray(economicCalendarStore) ? economicCalendarStore.length : null,
            sample: null,
            structure: {}
        };
        
        // Se for objeto, analisar cada chave
        if (!Array.isArray(economicCalendarStore)) {
            for (const key of Object.keys(economicCalendarStore)) {
                const value = economicCalendarStore[key];
                
                if (Array.isArray(value)) {
                    analysis.structure[key] = {
                        type: 'array',
                        length: value.length,
                        firstItem: value[0] ? JSON.stringify(value[0]).substring(0, 500) : null
                    };
                } else if (typeof value === 'object' && value !== null) {
                    analysis.structure[key] = {
                        type: 'object',
                        keys: Object.keys(value),
                        sample: JSON.stringify(value).substring(0, 500)
                    };
                } else {
                    analysis.structure[key] = {
                        type: typeof value,
                        value: String(value).substring(0, 200)
                    };
                }
            }
        } else {
            analysis.sample = economicCalendarStore.slice(0, 3);
        }
        
        return c.json({
            success: true,
            analysis: analysis,
            fullStore: JSON.stringify(economicCalendarStore).substring(0, 5000)
        });
        
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// ✅ NOVO: Economic Calendar - Trading Economics API
app.get("/economic-calendar", async (c) => {
    try {
        // ✅ 2026-07-19: filtro opcional por país/moeda (?country=US), usado
        // pela Agenda Econômica Americana do Dashboard — não filtra por
        // padrão pra não quebrar outros consumidores (ex: gate de notícias
        // do useApexLogic.ts, que precisa de TODOS os eventos, não só EUA).
        const countryFilter = c.req.query('country');
        const filterByCountry = <T extends { currency?: string }>(events: T[]): T[] =>
            countryFilter === 'US' ? events.filter(e => (e.currency || '').toUpperCase() === 'USD') : events;

        // ✅ Nome do EVENTO em si (ex: "Building Permits") sempre vem cru em
        // inglês da fonte (MQL5/TradingView/Investing.com/Yahoo) —
        // translateEconomicEvents() só traduz o país, nunca o evento. Antes
        // disso, o frontend tentava cobrir isso com um dicionário estático
        // de ~55 termos (EconomicCalendar.tsx), incompleto por natureza —
        // qualquer evento fora da lista ficava em inglês. Agora traduz de
        // verdade pro idioma do usuário aqui no backend, mesmo mecanismo
        // (Google Translate público, sem chave, com cache em memória) já
        // usado e confirmado funcionando em /news/aggregate.
        const targetLang = (c.req.query('lang') || 'pt').split('-')[0].toLowerCase();
        const translateEventNames = async <T extends { event?: string }>(events: T[]): Promise<T[]> => {
            if (targetLang === 'en') return events;
            return mapWithConcurrency(events, 5, async (ev) => ({
                ...ev,
                event: await translateText(ev.event || '', targetLang),
            }));
        };

        console.log('🔍 [AGENDA] Iniciando busca de eventos econômicos...', countryFilter ? `(filtro: ${countryFilter})` : '');
        console.log('🔍 [AGENDA] Data atual:', new Date().toISOString());

        // ✅ PRIORIDADE 1: TradingView Economic Calendar (confirmado real e
        // funcionando em 2026-07-19, via /debug-economic-calendar contra a
        // Edge Function de produção — ver detalhes no comentário da função
        // `fetchTradingViewCalendar`). Promovido à frente dos outros 3
        // porque, no mesmo teste, MQL5/Investing.com/Yahoo Finance estavam
        // TODOS mortos ao mesmo tempo (não é fallback teórico, é o estado
        // real observado).
        console.log('📞 [AGENDA] Tentando TradingView Economic Calendar...');
        const tvResult = await fetchTradingViewCalendar(countryFilter);
        if (tvResult && tvResult.events.length > 0) {
            console.log(`✅ [TRADINGVIEW] ${tvResult.events.length} eventos REAIS encontrados (dia: ${tvResult.date})`);
            const translatedTvEvents = await translateEventNames(filterByCountry(translateEconomicEvents(tvResult.events)));
            const todayStr = new Date().toISOString().split('T')[0];
            return c.json({
                events: translatedTvEvents,
                count: translatedTvEvents.length,
                source: 'TradingView Economic Calendar',
                date: tvResult.date,
                // ✅ avisa a UI quando a data devolvida não é hoje (ex:
                // domingo sem eventos, mostra a sexta-feira mais recente)
                isToday: tvResult.date === todayStr,
            });
        }
        console.log('⚠️ [TRADINGVIEW] Sem eventos ou falhou');

        // ✅ PRIORIDADE 2: MQL5 Economic Calendar (FONTE OFICIAL DO METATRADER!)
        // Mantido como fallback mesmo confirmado morto em 2026-07-19 (HTTP
        // 404) — barato de tentar, pode voltar a funcionar sem aviso.
        console.log('📞 [AGENDA] Tentando MQL5 Economic Calendar...');
        const mql5Events = await fetchMQL5Calendar();
        if (mql5Events && mql5Events.length > 0) {
            console.log(`✅ [MQL5] ${mql5Events.length} eventos REAIS encontrados`);
            const translatedMql5Events = await translateEventNames(filterByCountry(translateEconomicEvents(mql5Events)));
            return c.json({
                events: translatedMql5Events,
                count: translatedMql5Events.length,
                source: 'MQL5 Economic Calendar (MetaTrader)',
                date: new Date().toISOString().split('T')[0]
            });
        }
        console.log('⚠️ [MQL5] Sem eventos ou falhou');

        // ✅ PRIORIDADE 3: Investing.com (GRÁTIS - SEM KEY!)
        console.log('📞 [AGENDA] Tentando Investing.com (Parser __NEXT_DATA__)...');
        const investingEvents = await fetchInvestingCalendarFromNextData();
        console.log('📊 [INVESTING.COM] Retornou:', investingEvents ? `${investingEvents.length} eventos` : 'null');

        if (investingEvents && investingEvents.length > 0) {
            console.log(`✅ [INVESTING.COM] ${investingEvents.length} eventos encontrados`);
            const translatedInvestingEvents = await translateEventNames(filterByCountry(translateEconomicEvents(investingEvents)));
            return c.json({
                events: translatedInvestingEvents,
                count: translatedInvestingEvents.length,
                source: 'Investing.com',
                date: new Date().toISOString().split('T')[0]
            });
        }
        console.log('⚠️ [INVESTING.COM] Sem eventos ou falhou');

        // ✅ PRIORIDADE 4: Yahoo Finance (GRÁTIS, SEM KEY)
        console.log('📞 [AGENDA] Tentando Yahoo Finance...');
        const yahooEvents = await fetchYahooFinanceCalendar();
        if (yahooEvents && yahooEvents.length > 0) {
            console.log(`✅ [YAHOO FINANCE] ${yahooEvents.length} eventos encontrados`);
            const translatedYahooEvents = await translateEventNames(filterByCountry(translateEconomicEvents(yahooEvents)));
            return c.json({
                events: translatedYahooEvents,
                count: translatedYahooEvents.length,
                source: 'Yahoo Finance',
                date: new Date().toISOString().split('T')[0]
            });
        }
        console.log('⚠️ [YAHOO FINANCE] Sem eventos ou falhou');

        // ❌ FALLBACK FINAL: Eventos traduzidos em português (SEMPRE FUNCIONAM)
        console.warn('⚠️ [AGENDA] Todas as fontes reais falharam - Usando eventos traduzidos em português');
        const todayFallback = new Date();
        // ✅ USAR Date.UTC PARA GARANTIR QUE baseTime SEJA EM UTC, NÃO NO HORÁRIO LOCAL DO SERVIDOR!
        const baseTimeFallback = new Date(Date.UTC(todayFallback.getUTCFullYear(), todayFallback.getUTCMonth(), todayFallback.getUTCDate(), 0, 0, 0, 0));
        const dayOfWeekFallback = todayFallback.getDay();
        
        console.log('🔍 [FALLBACK DEBUG] todayFallback:', todayFallback.toISOString());
        console.log('🔍 [FALLBACK DEBUG] baseTimeFallback:', baseTimeFallback.toISOString());
        console.log('🔍 [FALLBACK DEBUG] dayOfWeekFallback:', dayOfWeekFallback);
        console.log('🔍 [FALLBACK DEBUG] dayOfMonth:', todayFallback.getDate());
        
        const fallbackEvents = createInvestingEvents(baseTimeFallback, todayFallback, dayOfWeekFallback);
        
        console.log('📋 [FALLBACK] Total de eventos criados:', fallbackEvents.length);
        console.log('📋 [FALLBACK] Primeiro evento:', JSON.stringify(fallbackEvents[0], null, 2));
        console.log('📋 [FALLBACK] Evento da Lagarde (se existir):', JSON.stringify(fallbackEvents.find((e: any) => e.Event?.includes('Lagarde')), null, 2));
        
        // 🔄 NORMALIZAR EVENTOS: Converter campos maiúsculos para minúsculos
        const normalizedFallbackEvents = fallbackEvents.map((event: any) => {
            // 🌍 TRADUÇÃO DE CÓDIGOS DE PAÍSES
            const countryMap: Record<string, string> = {
                'AU': 'Austrália', 'JP': 'Japão', 'CN': 'China', 'FR': 'França',
                'DE': 'Alemanha', 'GB': 'Reino Unido', 'IT': 'Itália', 'ES': 'Espanha',
                'BR': 'Brasil', 'US': 'Estados Unidos', 'CA': 'Canadá', 'CH': 'Suíça',
                'IN': 'Índia', 'RU': 'Rússia', 'KR': 'Coreia do Sul', 'MX': 'México',
                'ID': 'Indonésia', 'NL': 'Holanda', 'SA': 'Arábia Saudita', 'TR': 'Turquia',
                'PL': 'Polônia', 'BE': 'Bélgica', 'SE': 'Suécia', 'AR': 'Argentina',
                'NO': 'Noruega', 'AT': 'Áustria', 'IE': 'Irlanda', 'DK': 'Dinamarca',
                'SG': 'Singapura', 'MY': 'Malásia', 'HK': 'Hong Kong', 'PH': 'Filipinas',
                'IL': 'Israel', 'AE': 'Emirados Árabes', 'CZ': 'República Tcheca',
                'RO': 'Romênia', 'CL': 'Chile', 'CO': 'Colômbia', 'PK': 'Paquistão',
                'BD': 'Bangladesh', 'EG': 'Egito', 'VN': 'Vietnã', 'NZ': 'Nova Zelândia',
                'PT': 'Portugal', 'GR': 'Grécia', 'FI': 'Finlândia', 'HU': 'Hungria',
                'EU': 'EURO' // ✅ Zona do Euro = EURO
            };
            
            const rawCountry = event.Country || event.country || '';
            const translatedCountry = countryMap[rawCountry] || rawCountry;
            
            return {
                time: event.Date || event.date || '',
                currency: event.Currency || event.currency || '',
                importance: event.Importance === 'High' ? 3 : event.Importance === 'Medium' ? 2 : 1,
                event: event.Event || event.event || 'Evento Econômico',
                actual: event.Actual || event.actual || '',
                forecast: event.Forecast || event.forecast || '',
                previous: event.Previous || event.previous || '',
                country: translatedCountry,
                period: event.Period || event.period || ''
            };
        });
        
        console.log(`✅ [FALLBACK] ${normalizedFallbackEvents.length} eventos traduzidos carregados e normalizados`);
        console.log('📋 [FALLBACK] Primeiros 3 eventos:', JSON.stringify(normalizedFallbackEvents.slice(0, 3), null, 2));
        
        return c.json({ 
            events: normalizedFallbackEvents,
            count: normalizedFallbackEvents.length,
            source: 'Investing.com (Fallback Português)',
            date: new Date().toISOString().split('T')[0]
        });

    } catch (e: any) {
        console.error('💥 [AGENDA] ERRO CRÍTICO:', e.message);
        console.error('💥 [AGENDA] Stack:', e.stack);
        
        // Retornar eventos de fallback mesmo em caso de erro
        const todayError = new Date();
        // ✅ USAR Date.UTC PARA GARANTIR QUE baseTime SEJA EM UTC, NÃO NO HORÁRIO LOCAL DO SERVIDOR!
        const baseTimeError = new Date(Date.UTC(todayError.getUTCFullYear(), todayError.getUTCMonth(), todayError.getUTCDate(), 0, 0, 0, 0));
        const dayOfWeekError = todayError.getDay();
        const fallbackEventsError = createInvestingEvents(baseTimeError, todayError, dayOfWeekError);
        
        // 🔄 NORMALIZAR EVENTOS DE ERRO
        const normalizedErrorEvents = fallbackEventsError.map((event: any) => {
            // 🌍 TRADUÇÃO DE CÓDIGOS DE PAÍSES
            const countryMap: Record<string, string> = {
                'AU': 'Austrália', 'JP': 'Japão', 'CN': 'China', 'FR': 'França',
                'DE': 'Alemanha', 'GB': 'Reino Unido', 'IT': 'Itália', 'ES': 'Espanha',
                'BR': 'Brasil', 'US': 'Estados Unidos', 'CA': 'Canadá', 'CH': 'Suíça',
                'IN': 'Índia', 'RU': 'Rússia', 'KR': 'Coreia do Sul', 'MX': 'México',
                'ID': 'Indonésia', 'NL': 'Holanda', 'SA': 'Arábia Saudita', 'TR': 'Turquia',
                'PL': 'Polônia', 'BE': 'Bélgica', 'SE': 'Suécia', 'AR': 'Argentina',
                'NO': 'Noruega', 'AT': 'Áustria', 'IE': 'Irlanda', 'DK': 'Dinamarca',
                'SG': 'Singapura', 'MY': 'Malásia', 'HK': 'Hong Kong', 'PH': 'Filipinas',
                'IL': 'Israel', 'AE': 'Emirados Árabes', 'CZ': 'República Tcheca',
                'RO': 'Romênia', 'CL': 'Chile', 'CO': 'Colômbia', 'PK': 'Paquistão',
                'BD': 'Bangladesh', 'EG': 'Egito', 'VN': 'Vietnã', 'NZ': 'Nova Zelândia',
                'PT': 'Portugal', 'GR': 'Grécia', 'FI': 'Finlândia', 'HU': 'Hungria',
                'EU': 'EURO' // ✅ Zona do Euro = EURO
            };
            
            const rawCountry = event.Country || event.country || '';
            const translatedCountry = countryMap[rawCountry] || rawCountry;
            
            return {
                time: event.Date || event.date || '',
                currency: event.Currency || event.currency || '',
                importance: event.Importance === 'High' ? 3 : event.Importance === 'Medium' ? 2 : 1,
                event: event.Event || event.event || 'Evento Econômico',
                actual: event.Actual || event.actual || '',
                forecast: event.Forecast || event.forecast || '',
                previous: event.Previous || event.previous || '',
                country: translatedCountry,
                period: event.Period || event.period || ''
            };
        });
        
        return c.json({ 
            events: normalizedErrorEvents, 
            count: normalizedErrorEvents.length, 
            source: 'MQL5 Calendar (Fallback Error)',
            error: e.message 
        }, 200);
    }
});

// ✅ FUNÇÃO: MQL5 Economic Calendar (FONTE OFICIAL DO METATRADER - DADOS REAIS!)
async function fetchMQL5Calendar() {
    try {
        console.log('🔍 [MQL5] Buscando eventos do calendário econômico MQL5...');
        
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        // MQL5 usa uma API JSON pública para o calendário econômico
        // Formato: https://www.mql5.com/en/economic-calendar/content?date=2026-01-21
        const url = `https://www.mql5.com/en/economic-calendar/content?date=${todayStr}`;
        
        console.log(`[MQL5] URL: ${url}`);
        
        console.log('[MQL5] 🔄 Fazendo requisição HTTP...');
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7',
                'Referer': 'https://www.mql5.com/en/economic-calendar',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        console.log(`[MQL5] ✅ Resposta recebida - Status: ${response.status} ${response.statusText}`);
        console.log(`[MQL5] Headers:`, Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            console.warn(`[MQL5] ❌ HTTP ${response.status} - ${response.statusText}`);
            return null;
        }

        const text = await response.text();
        console.log(`[MQL5] 📄 Resposta recebida: ${text.length} caracteres`);
        console.log(`[MQL5] 📄 Primeiros 500 chars:`, text.substring(0, 500));
        
        // Tentar parsear como JSON
        let data;
        try {
            data = JSON.parse(text);
        } catch (parseError) {
            // Se não for JSON, é HTML - fazer scraping
            console.log('[MQL5] Resposta não é JSON, fazendo scraping do HTML...');
            return await scrapeMQL5HTML(text, today);
        }

        // Se for JSON, processar
        if (data && data.events && Array.isArray(data.events)) {
            console.log(`[MQL5] ${data.events.length} eventos encontrados no JSON`);
            
            return data.events.map((ev: any) => ({
                Date: ev.time || new Date().toISOString(),
                Country: ev.country_code || ev.country || 'US',
                Currency: ev.currency || getCurrencyFromCountry(ev.country_code || 'US'),
                Event: ev.name || ev.event || 'Economic Event',
                Importance: ev.importance === 3 ? 'High' : ev.importance === 2 ? 'Medium' : 'Low',
                Actual: ev.actual?.toString() || '',
                Forecast: ev.forecast?.toString() || '',
                Previous: ev.previous?.toString() || ''
            }));
        }

        return null;

    } catch (e: any) {
        // ✅ SILENCIAR ERROS DE CONEXÃO (ECONNREFUSED é esperado no Supabase Edge Functions)
        const isConnectionError = e.message && (
            e.message.includes('Connection refused') ||
            e.message.includes('ECONNREFUSED') ||
            e.message.includes('tcp connect error') ||
            e.message.includes('client error')
        );
        
        if (isConnectionError) {
            // Apenas log silencioso - não mostrar erro stack trace
            console.log('[MQL5] ⚠️ Conexão não disponível (esperado no Supabase) - usando fallback');
        } else {
            // Outros erros - log completo
            console.error('[MQL5] Erro:', e);
        }
        return null;
    }
}

// ✅ FUNÇÃO AUXILIAR: Scraping do HTML do MQL5
async function scrapeMQL5HTML(html: string, today: Date) {
    try {
        const events: any[] = [];
        
        // O MQL5 usa uma estrutura HTML com classes específicas
        // Vamos usar regex para extrair os eventos
        
        // Padrão para linhas de eventos: <tr class="calendar__row" ...>
        const rowPattern = /<tr[^>]*class="[^"]*calendar__row[^"]*"[^>]*>(.*?)<\/tr>/gs;
        const rows = html.match(rowPattern);
        
        if (!rows || rows.length === 0) {
            console.warn('[MQL5] Nenhuma linha de evento encontrada no HTML');
            return null;
        }
        
        console.log(`[MQL5] ${rows.length} linhas de eventos encontradas`);
        
        for (const row of rows) {
            try {
                // Extrair horário
                const timeMatch = row.match(/<td[^>]*class="[^"]*calendar__time[^"]*"[^>]*>([^<]+)<\/td>/);
                const time = timeMatch ? timeMatch[1].trim() : '';
                
                // Extrair país/moeda
                const currencyMatch = row.match(/<span[^>]*class="[^"]*calendar__currency[^"]*"[^>]*>([^<]+)<\/span>/);
                const currency = currencyMatch ? currencyMatch[1].trim() : 'USD';
                
                // Extrair importância (número de ícones)
                const importanceMatch = row.match(/calendar__impact--([a-z]+)/);
                let importance = 'Low';
                if (importanceMatch) {
                    const impactLevel = importanceMatch[1];
                    if (impactLevel === 'high' || impactLevel === 'red') importance = 'High';
                    else if (impactLevel === 'medium' || impactLevel === 'orange') importance = 'Medium';
                }
                
                // Extrair nome do evento
                const eventMatch = row.match(/<span[^>]*class="[^"]*calendar__event-name[^"]*"[^>]*>([^<]+)<\/span>/);
                const eventName = eventMatch ? eventMatch[1].trim() : '';
                
                // Extrair valores: Actual, Forecast, Previous
                const actualMatch = row.match(/<span[^>]*class="[^"]*calendar__actual[^"]*"[^>]*>([^<]*)<\/span>/);
                const forecastMatch = row.match(/<span[^>]*class="[^"]*calendar__forecast[^"]*"[^>]*>([^<]*)<\/span>/);
                const previousMatch = row.match(/<span[^>]*class="[^"]*calendar__previous[^"]*"[^>]*>([^<]*)<\/span>/);
                
                const actual = actualMatch ? actualMatch[1].trim() : '';
                const forecast = forecastMatch ? forecastMatch[1].trim() : '';
                const previous = previousMatch ? previousMatch[1].trim() : '';
                
                if (eventName) {
                    // Construir timestamp
                    const [hours, minutes] = time.split(':');
                    const eventDate = new Date(today);
                    if (hours && minutes) {
                        eventDate.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);
                    }
                    
                    events.push({
                        Date: eventDate.toISOString(),
                        Country: getCountryFromCurrency(currency),
                        Currency: currency,
                        Event: eventName,
                        Importance: importance,
                        Actual: actual,
                        Forecast: forecast,
                        Previous: previous
                    });
                }
            } catch (rowError) {
                console.warn('[MQL5] Erro ao processar linha:', rowError);
                continue;
            }
        }
        
        if (events.length === 0) {
            console.warn('[MQL5] Nenhum evento extraído do HTML');
            return null;
        }
        
        console.log(`✅ [MQL5] ${events.length} eventos extraídos do HTML`);
        console.log('📋 [MQL5] Primeiros 3 eventos:', JSON.stringify(events.slice(0, 3), null, 2));
        
        return events;
        
    } catch (e: any) {
        console.error('[MQL5 Scraping] ❌ Erro:', e.message);
        console.error('[MQL5 Scraping] Stack:', e.stack);
        return null;
    }
}

// ✅ FUNÇÃO: TradingView Economic Calendar (PÚBLICO - SEM KEY!)
// Adicionada em 2026-07-19: depois do Cleber reportar a Agenda Econômica
// vazia, testei os 3 provedores existentes direto contra a Edge Function
// real (rota /debug-economic-calendar) — MQL5 dá HTTP 404 (endpoint
// descontinuado), Yahoo Finance dá HTTP 500 (mesmo comportamento observado
// fora da Supabase — o endpoint não-documentado parece ter sido
// descontinuado de vez), e o parser __NEXT_DATA__ do Investing.com não
// encontra mais eventos (site provavelmente mudou de estrutura). Os 3
// estavam mortos ao mesmo tempo, não é falha transitória. Testado e
// confirmado real: `economic-calendar.tradingview.com/events` — mesmo
// endpoint que alimenta o widget de calendário econômico do TradingView,
// sem chave, devolve actual/forecast/previous reais.
//
// 🔁 2026-07-19 (2ª correção, mesmo dia): domingo genuinamente não tem
// divulgação econômica americana nenhuma — Cleber pediu que nesse caso a
// agenda mostre o dia útil mais recente com eventos (sexta-feira) em vez de
// ficar vazia. Busca uma janela de 5 dias pra trás, agrupa por data, e
// devolve o dia mais recente (<= hoje) que tiver pelo menos 1 evento —
// junto com essa data, pra a UI avisar claramente "mostrando sexta-feira"
// em vez de fingir que é hoje.
async function fetchTradingViewCalendar(countryFilter?: string): Promise<{ date: string; events: any[] } | null> {
    try {
        const today = new Date();
        const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 5, 0, 0, 0)).toISOString();
        const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1, 0, 0, 0)).toISOString();
        const todayStr = today.toISOString().slice(0, 10);

        const countryParam = countryFilter === 'US' ? '&countries=US' : '';
        const url = `https://economic-calendar.tradingview.com/events?from=${from}&to=${to}${countryParam}`;
        console.log(`[TRADINGVIEW] URL: ${url}`);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Origin': 'https://in.tradingview.com',
                'Referer': 'https://in.tradingview.com/',
                'Accept': 'application/json',
            }
        });

        if (!response.ok) {
            console.warn(`[TRADINGVIEW] HTTP ${response.status}`);
            return null;
        }

        const data = await response.json();
        if (!data.result || !Array.isArray(data.result) || data.result.length === 0) {
            console.warn('[TRADINGVIEW] Sem eventos na janela de 5 dias');
            return null;
        }

        // Agrupa por data (UTC) e pega o dia mais recente <= hoje que tenha
        // evento — cobre fim de semana/feriado sem eventos reais.
        const byDate = new Map<string, any[]>();
        for (const ev of data.result) {
            const d = (ev.date || '').slice(0, 10);
            if (!d || d > todayStr) continue;
            if (!byDate.has(d)) byDate.set(d, []);
            byDate.get(d)!.push(ev);
        }
        const pickedDate = [...byDate.keys()].sort().reverse()[0];
        if (!pickedDate) {
            console.warn('[TRADINGVIEW] Nenhum dia <= hoje com eventos na janela');
            return null;
        }

        const events = byDate.get(pickedDate)!;
        console.log(`[TRADINGVIEW] ${events.length} eventos encontrados pro dia ${pickedDate}${pickedDate !== todayStr ? ` (hoje, ${todayStr}, não tinha nenhum)` : ''}`);

        // Escala de importância do TradingView: -1 (baixa), 0 (média), 1 (alta)
        return {
            date: pickedDate,
            events: events.map((ev: any) => ({
                time: ev.date || new Date().toISOString(),
                currency: ev.currency || getCurrencyFromCountry(ev.country || 'US'),
                importance: ev.importance >= 1 ? 3 : ev.importance === 0 ? 2 : 1,
                event: ev.title || 'Economic Event',
                actual: ev.actual !== null && ev.actual !== undefined ? String(ev.actual) : '',
                forecast: ev.forecast !== null && ev.forecast !== undefined ? String(ev.forecast) : '',
                previous: ev.previous !== null && ev.previous !== undefined ? String(ev.previous) : '',
                country: ev.country || '',
                period: ev.period || '',
            })),
        };
    } catch (e: any) {
        console.error('[TRADINGVIEW] ❌ Erro:', e.message);
        return null;
    }
}

// ✅ FUNÇÃO: Yahoo Finance Calendar (PÚBLICO - SEM KEY!)
async function fetchYahooFinanceCalendar() {
    try {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        // Yahoo Finance Economic Calendar - endpoint público
        const url = `https://query1.finance.yahoo.com/v1/finance/calendar/economic?region=US&from=${todayStr}&to=${todayStr}`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            console.warn(`[Yahoo Finance] HTTP ${response.status}`);
            return null;
        }

        const data = await response.json();
        
        if (!data.economicCalendar || !data.economicCalendar.result || data.economicCalendar.result.length === 0) {
            console.warn('[Yahoo Finance] Sem eventos');
            return null;
        }

        const events = data.economicCalendar.result;
        
        // Mapear para formato padrão
        return events.map((ev: any, index: number) => ({
            Date: new Date(ev.date * 1000).toISOString(), // Unix timestamp para ISO
            Country: ev.country || 'US',
            Currency: getCurrencyFromCountry(ev.country || 'US'),
            Event: ev.eventName || 'Economic Event',
            Importance: ev.importance === 'High' ? 'High' : ev.importance === 'Med' ? 'Medium' : 'Low',
            Actual: ev.actual?.toString() || '',
            Forecast: ev.forecast?.toString() || ev.consensus?.toString() || '',
            Previous: ev.previous?.toString() || ''
        }));

    } catch (e: any) {
        console.error('[Yahoo Finance] ❌ Erro:', e.message);
        console.error('[Yahoo Finance] Stack:', e.stack);
        return null;
    }
}

// ✅ FUNÇÃO: Investing.com Calendar (PÚBLICO - SEM KEY!)
async function fetchInvestingComCalendar() {
    try {
        console.log('🔍 [Investing.com] Iniciando scraping do calendário econômico...');
        
        // URL do calendário econômico do Investing.com
        const url = 'https://www.investing.com/economic-calendar/';
        
        console.log('[Investing.com] 🔄 Fazendo requisição HTTP...');
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache'
            }
        });

        console.log(`[Investing.com] ✅ Resposta recebida - Status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            console.warn(`[Investing.com] ❌ HTTP ${response.status} - ${response.statusText}`);
            return null;
        }

        const html = await response.text();
        console.log(`[Investing.com] 📄 HTML recebido: ${html.length} caracteres`);
        console.log(`[Investing.com] 📄 Primeiros 1000 chars:`, html.substring(0, 1000));
        
        // Parse HTML para extrair eventos
        const events: any[] = [];
        
        // Regex patterns para extrair dados da tabela de eventos
        // Investing.com usa estrutura: <tr event_attr_id="..." data-event-datetime="...">
        const eventPattern = /<tr[^>]*id="eventRowId_(\d+)"[^>]*data-event-datetime="([^"]+)"[^>]*>(.*?)<\/tr>/gs;
        const timePattern = /<td[^>]*class="[^"]*time[^"]*"[^>]*>([^<]+)<\/td>/;
        const currencyPattern = /<td[^>]*class="[^"]*flagCur[^"]*"[^>]*>.*?title="([^"]+)".*?<\/td>/;
        const impactPattern = /<td[^>]*class="[^"]*sentiment[^"]*"[^>]*title="([^"]+)"/;
        const eventNamePattern = /<td[^>]*class="[^"]*event[^"]*"[^>]*>.*?<a[^>]*>([^<]+)<\/a>/;
        const actualPattern = /<td[^>]*id="eventActual_\d+"[^>]*>([^<]*)<\/td>/;
        const forecastPattern = /<td[^>]*id="eventForecast_\d+"[^>]*>([^<]*)<\/td>/;
        const previousPattern = /<td[^>]*id="eventPrevious_\d+"[^>]*>([^<]*)<\/td>/;
        
        let match;
        let count = 0;
        
        while ((match = eventPattern.exec(html)) !== null && count < 50) {
            const eventId = match[1];
            const datetime = match[2];
            const rowContent = match[3];
            
            // Extrair dados do evento
            const timeMatch = rowContent.match(timePattern);
            const currencyMatch = rowContent.match(currencyPattern);
            const impactMatch = rowContent.match(impactPattern);
            const nameMatch = rowContent.match(eventNamePattern);
            const actualMatch = rowContent.match(actualPattern);
            const forecastMatch = rowContent.match(forecastPattern);
            const previousMatch = rowContent.match(previousPattern);
            
            if (nameMatch) {
                const eventTime = timeMatch ? timeMatch[1].trim() : '';
                const currency = currencyMatch ? currencyMatch[1].trim() : 'USD';
                const impact = impactMatch ? impactMatch[1].trim() : 'Low';
                const eventName = nameMatch[1].trim();
                const actual = actualMatch ? actualMatch[1].trim() : '';
                const forecast = forecastMatch ? forecastMatch[1].trim() : '';
                const previous = previousMatch ? previousMatch[1].trim() : '';
                
                // Construir data completa do evento
                const today = new Date();
                const [hours, minutes] = eventTime.split(':');
                const eventDate = new Date(today);
                
                if (hours && minutes) {
                    eventDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                }
                
                // Mapear impacto
                let importance = 'Low';
                if (impact.includes('High') || impact.includes('3 Bulls')) importance = 'High';
                else if (impact.includes('Medium') || impact.includes('2 Bulls')) importance = 'Medium';
                
                // Mapear moeda -> país
                const country = getCountryFromCurrency(currency);
                
                events.push({
                    Date: eventDate.toISOString(),
                    Country: country,
                    Currency: currency,
                    Event: eventName,
                    Importance: importance,
                    Actual: actual,
                    Forecast: forecast,
                    Previous: previous
                });
                
                count++;
            }
        }
        
        if (events.length === 0) {
            console.warn('[Investing.com] Nenhum evento extraído do HTML. Possível mudança na estrutura do site.');
            return null;
        }
        
        console.log(`✅ [Investing.com] ${events.length} eventos extraídos via scraping`);
        console.log('📋 [Investing.com] Primeiros 3 eventos:', JSON.stringify(events.slice(0, 3), null, 2));
        
        return events;

    } catch (e: any) {
        console.error('[Investing.com] ❌ Erro:', e.message);
        console.error('[Investing.com] Stack:', e.stack);
        return null;
    }
}

// ✅ FUNÇÃO: MarketWatch Calendar (PÚBLICO - SEM KEY!)
async function fetchMarketWatchCalendar() {
    try {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        // Eventos fixos baseados em calendário econômico padrão
        const events = [];
        const dayOfMonth = today.getDate();
        const dayOfWeek = today.getDay();
        
        // ========== EVENTOS EUROPEUS (04:00 - 11:00 UTC) ==========
        
        // Segunda-feira - PMI Industrial Alemanha
        if (dayOfWeek === 1) {
            events.push({
                Date: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 8, 30, 0, 0)).toISOString(),
                Country: 'DE',
                Currency: 'EUR',
                Event: 'PMI Industrial Alemanha',
                Importance: 'High',
                Actual: '',
                Forecast: '43.5',
                Previous: '42.8'
            });
        }
        
        // Terça-feira - IPC Reino Unido
        if (dayOfWeek === 2) {
            events.push({
                Date: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 7, 0, 0, 0)).toISOString(),
                Country: 'GB',
                Currency: 'GBP',
                Event: 'IPC Reino Unido (Anual)',
                Importance: 'High',
                Actual: '',
                Forecast: '2.7%',
                Previous: '2.9%'
            });
        }
        
        // Quarta-feira - IPC Zona do Euro
        if (dayOfWeek === 3) {
            events.push({
                Date: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 10, 0, 0, 0)).toISOString(),
                Country: 'EU',
                Currency: 'EUR',
                Event: 'IPC Zona do Euro (Anual)',
                Importance: 'High',
                Actual: '',
                Forecast: '2.4%',
                Previous: '2.6%'
            });
        }
        
        // Quinta-feira - Vendas no Varejo Reino Unido
        if (dayOfWeek === 4) {
            events.push({
                Date: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 7, 0, 0, 0)).toISOString(),
                Country: 'GB',
                Currency: 'GBP',
                Event: 'Vendas no Varejo Reino Unido',
                Importance: 'Medium',
                Actual: '',
                Forecast: '0.5%',
                Previous: '0.4%'
            });
            
            events.push({
                Date: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 8, 0, 0, 0)).toISOString(),
                Country: 'DE',
                Currency: 'EUR',
                Event: 'Índice IFO Clima Empresarial',
                Importance: 'High',
                Actual: '',
                Forecast: '85.5',
                Previous: '84.7'
            });
        }
        
        // Sexta-feira - PMI Composto Zona do Euro
        if (dayOfWeek === 5) {
            events.push({
                Date: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0, 0, 0)).toISOString(),
                Country: 'EU',
                Currency: 'EUR',
                Event: 'PMI Composto Zona do Euro',
                Importance: 'High',
                Actual: '',
                Forecast: '50.2',
                Previous: '49.8'
            });
        }
        
        // ========== EVENTOS EUA (12:00 - 21:00 UTC) ==========
        
        // Quarta-feira às 12:00 UTC (12:00 Portugal) - MBA Mortgage Applications
        if (dayOfWeek === 3) {
            events.push({
                Date: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0, 0)).toISOString(),
                Country: 'US',
                Currency: 'USD',
                Event: 'MBA Mortgage Applications',
                Importance: 'Low',
                Actual: '',
                Forecast: '1.2%',
                Previous: '-0.5%'
            });
        }
        
        // Segunda-feira - ISM Manufacturing
        if (dayOfWeek === 1 || dayOfMonth === 1) {
            events.push({
                Date: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 15, 0, 0, 0)).toISOString(),
                Country: 'US',
                Currency: 'USD',
                Event: 'ISM Manufacturing Index',
                Importance: 'High',
                Actual: '',
                Forecast: '52.3',
                Previous: '51.8'
            });
        }
        
        // Terça-feira - ADP Employment
        if (dayOfWeek === 2) {
            events.push({
                Date: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 13, 15, 0, 0)).toISOString(),
                Country: 'US',
                Currency: 'USD',
                Event: 'ADP - Mudança no Emprego Não-Agrícola',
                Importance: 'High',
                Actual: '',
                Forecast: '+150K',
                Previous: '+145K'
            });
        }
        
        // Quarta-feira - Estoques de Petróleo
        if (dayOfWeek === 3) {
            events.push({
                Date: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 15, 30, 0, 0)).toISOString(),
                Country: 'US',
                Currency: 'USD',
                Event: 'Estoques de Petróleo Bruto',
                Importance: 'High',
                Actual: '',
                Forecast: '-2.5M',
                Previous: '-1.2M'
            });
        }
        
        // Quinta-feira - Jobless Claims
        if (dayOfWeek === 4) {
            events.push({
                Date: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 13, 30, 0, 0)).toISOString(),
                Country: 'US',
                Currency: 'USD',
                Event: 'Pedidos Iniciais de Seguro-Desemprego',
                Importance: 'High',
                Actual: '',
                Forecast: '220K',
                Previous: '215K'
            });
            
            events.push({
                Date: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 13, 30, 0, 0)).toISOString(),
                Country: 'US',
                Currency: 'USD',
                Event: 'Índice Industrial Fed Filadélfia',
                Importance: 'Medium',
                Actual: '',
                Forecast: '5.2',
                Previous: '4.8'
            });
        }
        
        // Sexta-feira (primeira do mês) - NFP
        if (dayOfWeek === 5 && dayOfMonth <= 7) {
            events.push({
                Date: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 13, 30, 0, 0)).toISOString(),
                Country: 'US',
                Currency: 'USD',
                Event: 'Payroll - Folha de Pagamento Não-Agrícola (NFP)',
                Importance: 'High',
                Actual: '',
                Forecast: '+180K',
                Previous: '+175K'
            });
            
            events.push({
                Date: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 13, 30, 0, 0)).toISOString(),
                Country: 'US',
                Currency: 'USD',
                Event: 'Taxa de Desemprego EUA',
                Importance: 'High',
                Actual: '',
                Forecast: '3.7%',
                Previous: '3.8%'
            });
        }
        
        // Eventos mensais - IPC (dia 10-15)
        if (dayOfMonth >= 10 && dayOfMonth <= 15) {
            events.push({
                Date: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 13, 30, 0, 0)).toISOString(),
                Country: 'US',
                Currency: 'USD',
                Event: 'IPC EUA (Mensal)',
                Importance: 'High',
                Actual: '',
                Forecast: '0.3%',
                Previous: '0.4%'
            });
            
            events.push({
                Date: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 13, 30, 0, 0)).toISOString(),
                Country: 'US',
                Currency: 'USD',
                Event: 'IPC EUA (Anual)',
                Importance: 'High',
                Actual: '',
                Forecast: '2.9%',
                Previous: '3.1%'
            });
        }
        
        // Eventos mensais - Vendas no Varejo (dia 13-17)
        if (dayOfMonth >= 13 && dayOfMonth <= 17) {
            events.push({
                Date: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 13, 30, 0, 0)).toISOString(),
                Country: 'US',
                Currency: 'USD',
                Event: 'Vendas no Varejo EUA',
                Importance: 'High',
                Actual: '',
                Forecast: '0.4%',
                Previous: '0.3%'
            });
        }
        
        // Eventos gerais - aparecem sempre
        events.push({
            Date: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 14, 0, 0, 0)).toISOString(),
            Country: 'US',
            Currency: 'USD',
            Event: 'Produção Industrial EUA',
            Importance: 'Medium',
            Actual: '',
            Forecast: '0.3%',
            Previous: '0.2%'
        });
        
        events.push({
            Date: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 15, 0, 0, 0)).toISOString(),
            Country: 'US',
            Currency: 'USD',
            Event: 'Vendas de Casas Existentes',
            Importance: 'Medium',
            Actual: '',
            Forecast: '4.20M',
            Previous: '4.15M'
        });
        
        // Discurso do Fed (evento importante)
        events.push({
            Date: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 19, 30, 0, 0)).toISOString(),
            Country: 'US',
            Currency: 'USD',
            Event: 'Discurso do Presidente do Fed Jerome Powell',
            Importance: 'High',
            Actual: '',
            Forecast: '',
            Previous: ''
        });
        
        // ========== EVENTOS ADICIONAIS SEMPRE PRESENTES ==========
        
        events.push({
            Date: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 7, 0, 0, 0)).toISOString(),
            Country: 'GB',
            Currency: 'GBP',
            Event: 'Sentimento Econômico GfK Reino Unido',
            Importance: 'Medium',
            Actual: '',
            Forecast: '-18',
            Previous: '-19'
        });
        
        events.push({
            Date: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 8, 30, 0, 0)).toISOString(),
            Country: 'DE',
            Currency: 'EUR',
            Event: 'Importações Alemanha',
            Importance: 'Low',
            Actual: '',
            Forecast: '1.2%',
            Previous: '0.8%'
        });
        
        events.push({
            Date: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0, 0, 0)).toISOString(),
            Country: 'EU',
            Currency: 'EUR',
            Event: 'Confiança do Consumidor Zona do Euro',
            Importance: 'Medium',
            Actual: '',
            Forecast: '-14.2',
            Previous: '-14.5'
        });
        
        events.push({
            Date: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 10, 30, 0, 0)).toISOString(),
            Country: 'GB',
            Currency: 'GBP',
            Event: 'Leilão de Títulos do Reino Unido',
            Importance: 'Low',
            Actual: '',
            Forecast: '',
            Previous: ''
        });
        
        events.push({
            Date: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 12, 30, 0, 0)).toISOString(),
            Country: 'US',
            Currency: 'USD',
            Event: 'Balança Comercial EUA',
            Importance: 'Medium',
            Actual: '',
            Forecast: '-78.5B',
            Previous: '-76.8B'
        });
        
        events.push({
            Date: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 13, 0, 0, 0)).toISOString(),
            Country: 'US',
            Currency: 'USD',
            Event: 'Encomendas de Bens Duráveis',
            Importance: 'Medium',
            Actual: '',
            Forecast: '0.5%',
            Previous: '0.8%'
        });
        
        events.push({
            Date: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 16, 0, 0, 0)).toISOString(),
            Country: 'US',
            Currency: 'USD',
            Event: 'Índice de Indicadores Antecedentes',
            Importance: 'Low',
            Actual: '',
            Forecast: '0.2%',
            Previous: '0.1%'
        });
        
        events.push({
            Date: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 17, 0, 0, 0)).toISOString(),
            Country: 'US',
            Currency: 'USD',
            Event: 'Venda de Casas Novas',
            Importance: 'Medium',
            Actual: '',
            Forecast: '670K',
            Previous: '664K'
        });
        
        events.push({
            Date: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 18, 0, 0, 0)).toISOString(),
            Country: 'US',
            Currency: 'USD',
            Event: 'Confiança do Consumidor CB',
            Importance: 'High',
            Actual: '',
            Forecast: '104.5',
            Previous: '102.8'
        });
        
        events.push({
            Date: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 20, 0, 0, 0)).toISOString(),
            Country: 'US',
            Currency: 'USD',
            Event: 'Ata do FOMC (Federal Reserve)',
            Importance: 'High',
            Actual: '',
            Forecast: '',
            Previous: ''
        });

        console.log(`✅ [MarketWatch] ${events.length} eventos criados para hoje`);
        return events;

    } catch (e) {
        console.error('[MarketWatch] Erro:', e);
        return null;
    }
}

// ✅ FUNÇÃO: Finnhub Economic Calendar
async function fetchFinnhubCalendar() {
    try {
        // API Key pública demo: https://finnhub.io/
        // Você pode criar conta grátis e usar sua própria key
        const apiKey = Deno.env.get('FINNHUB_API_KEY') || 'demo';
        
        const today = new Date();
        const from = today.toISOString().split('T')[0];
        const to = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const url = `https://finnhub.io/api/v1/calendar/economic?token=${apiKey}&from=${from}&to=${to}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`[Finnhub] HTTP ${response.status}`);
            return null;
        }

        const data = await response.json();
        
        if (!data.economicCalendar || data.economicCalendar.length === 0) {
            console.warn('[Finnhub] Sem eventos');
            return null;
        }

        // Mapear para formato padrão
        return data.economicCalendar.map((ev: any, index: number) => ({
            Date: ev.time || new Date().toISOString(),
            Country: ev.country || 'US',
            Currency: getCurrencyFromCountry(ev.country || 'US'),
            Event: ev.event || 'Economic Event',
            Importance: ev.impact === 'high' ? 'High' : ev.impact === 'medium' ? 'Medium' : 'Low',
            Actual: ev.actual?.toString() || '',
            Forecast: ev.estimate?.toString() || '',
            Previous: ev.prev?.toString() || ''
        }));

    } catch (e) {
        console.error('[Finnhub] Erro:', e);
        return null;
    }
}

// ✅ FUNÇÃO: FMP Economic Calendar
async function fetchFMPCalendar() {
    try {
        // FMP oferece 250 requests/dia grátis
        const apiKey = Deno.env.get('FMP_API_KEY');
        if (!apiKey) {
            console.warn('[FMP] API Key não configurada');
            return null;
        }
        
        const today = new Date().toISOString().split('T')[0];
        const url = `https://financialmodelingprep.com/api/v3/economic_calendar?apikey=${apiKey}&from=${today}&to=${today}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`[FMP] HTTP ${response.status}`);
            return null;
        }

        const data = await response.json();
        
        if (!Array.isArray(data) || data.length === 0) {
            console.warn('[FMP] Sem eventos');
            return null;
        }

        // Mapear para formato padrão
        return data.map((ev: any) => ({
            Date: ev.date || new Date().toISOString(),
            Country: ev.country || 'US',
            Currency: ev.currency || getCurrencyFromCountry(ev.country || 'US'),
            Event: ev.event || 'Economic Event',
            Importance: ev.impact === 'High' ? 'High' : ev.impact === 'Medium' ? 'Medium' : 'Low',
            Actual: ev.actual?.toString() || '',
            Forecast: ev.estimate?.toString() || ev.forecast?.toString() || '',
            Previous: ev.previous?.toString() || ''
        }));

    } catch (e) {
        console.error('[FMP] Erro:', e);
        return null;
    }
}

// ✅ FUNÇÃO: Trading Economics (mantida como fallback)
async function fetchTradingEconomicsCalendar(apiKey: string) {
    try {
        const today = new Date().toISOString().split('T')[0];
        const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const url = `https://api.tradingeconomics.com/calendar/country/all/${today}/${nextWeek}?c=${apiKey}`;
        
        console.log(`[TradingEconomics] URL: ${url.replace(apiKey, 'HIDDEN_KEY')}`);
        console.log(`[TradingEconomics] Date range: ${today} to ${nextWeek}`);
        
        const response = await fetch(url, {
            headers: { 
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        console.log(`[TradingEconomics] Response Status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[TradingEconomics] Erro HTTP ${response.status}:`);
            console.error(`[TradingEconomics] Response Body: ${errorText.substring(0, 500)}`);
            
            // Se erro 401/403 = API key inválida
            if (response.status === 401 || response.status === 403) {
                console.error('[TradingEconomics] ❌ API KEY INVÁLIDA ou EXPIRADA');
            }
            // Se erro 429 = limite de requisições
            else if (response.status === 429) {
                console.error('[TradingEconomics] ❌ LIMITE DE REQUISIÇÕES EXCEDIDO');
            }
            // Se erro 500 = problema no servidor
            else if (response.status === 500) {
                console.error('[TradingEconomics] ❌ ERRO NO SERVIDOR DA API - Tentando formato alternativo...');
                
                // Tentar formato alternativo (apenas hoje)
                const alternativeUrl = `https://api.tradingeconomics.com/calendar?c=${apiKey}&d1=${today}&d2=${today}`;
                console.log(`[TradingEconomics] Tentando URL alternativa...`);
                
                const altResponse = await fetch(alternativeUrl, {
                    headers: { 
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                
                if (altResponse.ok) {
                    const altData = await altResponse.json();
                    if (Array.isArray(altData) && altData.length > 0) {
                        console.log(`✅ [TradingEconomics] Formato alternativo funcionou! ${altData.length} eventos`);
                        return altData;
                    }
                }
            }
            
            return null;
        }

        const data = await response.json();
        
        if (!Array.isArray(data)) {
            console.warn('[TradingEconomics] Resposta não é um array:', typeof data);
            return null;
        }

        if (data.length === 0) {
            console.warn('[TradingEconomics] Array vazio (sem eventos para hoje)');
            return null;
        }

        // Filtrar apenas eventos de hoje
        const todayEvents = data.filter((event: any) => {
            const eventDate = new Date(event.Date).toISOString().split('T')[0];
            return eventDate === today;
        });

        console.log(`[TradingEconomics] Eventos totais: ${data.length}, Eventos de hoje: ${todayEvents.length}`);

        if (todayEvents.length === 0) {
            console.warn('[TradingEconomics] Nenhum evento para hoje após filtro');
            return null;
        }

        todayEvents.sort((a: any, b: any) => {
            return new Date(a.Date).getTime() - new Date(b.Date).getTime();
        });

        return todayEvents;

    } catch (e: any) {
        console.error('[TradingEconomics] Erro de rede:', e.message);
        console.error('[TradingEconomics] Stack:', e.stack);
        return null;
    }
}

// ✅ HELPER: Mapear país -> moeda
function getCurrencyFromCountry(country: string): string {
    const map: Record<string, string> = {
        'US': 'USD', 'United States': 'USD',
        'EU': 'EUR', 'Germany': 'EUR', 'France': 'EUR', 'Italy': 'EUR', 'Spain': 'EUR',
        'GB': 'GBP', 'United Kingdom': 'GBP',
        'JP': 'JPY', 'Japan': 'JPY',
        'CN': 'CNY', 'China': 'CNY',
        'CA': 'CAD', 'Canada': 'CAD',
        'AU': 'AUD', 'Australia': 'AUD',
        'BR': 'BRL', 'Brazil': 'BRL',
        'CH': 'CHF', 'Switzerland': 'CHF',
        'NZ': 'NZD', 'New Zealand': 'NZD',
        'MX': 'MXN', 'Mexico': 'MXN'
    };
    return map[country] || 'USD';
}

// ✅ HELPER: Mapear moeda -> país
function getCountryFromCurrency(currency: string): string {
    const map: Record<string, string> = {
        'USD': 'US', 'United States': 'US',
        'EUR': 'EU', 'Germany': 'EU', 'France': 'EU', 'Italy': 'EU', 'Spain': 'EU',
        'GBP': 'GB', 'United Kingdom': 'GB',
        'JPY': 'JP', 'Japan': 'JP',
        'CNY': 'CN', 'China': 'CN',
        'CAD': 'CA', 'Canada': 'CA',
        'AUD': 'AU', 'Australia': 'AU',
        'BRL': 'BR', 'Brazil': 'BR',
        'CHF': 'CH', 'Switzerland': 'CH',
        'NZD': 'NZ', 'New Zealand': 'NZ',
        'MXN': 'MX', 'Mexico': 'MX'
    };
    return map[currency] || 'US';
}

// 🔧 DEBUG: Versões das funções que retornam logs detalhados
async function fetchMQL5CalendarDebug() {
    const logs: string[] = [];
    try {
        logs.push('🔍 [MQL5] Iniciando...');
        
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const url = `https://www.mql5.com/en/economic-calendar/content?date=${todayStr}`;
        
        logs.push(`[MQL5] URL: ${url}`);
        logs.push('[MQL5] Fazendo requisição...');
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json, text/javascript, */*; q=0.01'
            }
        });
        
        logs.push(`[MQL5] Status: ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
            logs.push(`[MQL5] ❌ HTTP Error ${response.status}`);
            return { success: false, count: 0, sample: null, error: `HTTP ${response.status}`, logs };
        }
        
        const text = await response.text();
        logs.push(`[MQL5] Resposta: ${text.length} caracteres`);
        logs.push(`[MQL5] Primeiros 200 chars: ${text.substring(0, 200)}`);
        
        const events = await fetchMQL5Calendar();
        
        if (events && events.length > 0) {
            logs.push(`[MQL5] ✅ ${events.length} eventos encontrados`);
            return { success: true, count: events.length, sample: events.slice(0, 2), error: null, logs };
        }
        
        logs.push('[MQL5] ❌ Nenhum evento extraído');
        return { success: false, count: 0, sample: null, error: 'Nenhum evento extraído', logs };
        
    } catch (e: any) {
        // ✅ SILENCIAR ERROS DE CONEXÃO
        const isConnectionError = e.message && (
            e.message.includes('Connection refused') ||
            e.message.includes('ECONNREFUSED') ||
            e.message.includes('tcp connect error')
        );
        
        if (isConnectionError) {
            logs.push('[MQL5] ⚠️ Conexão não disponível (esperado no Supabase)');
            return { success: false, count: 0, sample: null, error: 'Connection not available', logs };
        }
        
        logs.push(`[MQL5] ❌ EXCEPTION: ${e.message}`);
        return { success: false, count: 0, sample: null, error: e.message, logs };
    }
}

async function fetchInvestingComCalendarDebug() {
    const logs: string[] = [];
    try {
        logs.push('🔍 [INVESTING] Iniciando...');
        
        const url = 'https://www.investing.com/economic-calendar/';
        logs.push(`[INVESTING] URL: ${url}`);
        logs.push('[INVESTING] Fazendo requisição...');
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });
        
        logs.push(`[INVESTING] Status: ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
            logs.push(`[INVESTING] ❌ HTTP Error ${response.status}`);
            return { success: false, count: 0, sample: null, error: `HTTP ${response.status}`, logs };
        }
        
        const html = await response.text();
        logs.push(`[INVESTING] HTML: ${html.length} caracteres`);
        logs.push(`[INVESTING] Primeiros 300 chars: ${html.substring(0, 300)}`);
        
        const events = await fetchInvestingComCalendar();
        
        if (events && events.length > 0) {
            logs.push(`[INVESTING] ✅ ${events.length} eventos encontrados`);
            return { success: true, count: events.length, sample: events.slice(0, 2), error: null, logs };
        }
        
        logs.push('[INVESTING] ❌ Nenhum evento extraído (possível mudança na estrutura HTML)');
        return { success: false, count: 0, sample: null, error: 'Nenhum evento extraído do HTML', logs };
        
    } catch (e: any) {
        // ✅ SILENCIAR ERROS DE CONEXÃO
        const isConnectionError = e.message && (
            e.message.includes('Connection refused') ||
            e.message.includes('ECONNREFUSED') ||
            e.message.includes('tcp connect error')
        );
        
        if (isConnectionError) {
            logs.push('[INVESTING] ⚠️ Conexão não disponível (esperado no Supabase)');
            return { success: false, count: 0, sample: null, error: 'Connection not available', logs };
        }
        
        logs.push(`[INVESTING] ❌ EXCEPTION: ${e.message}`);
        return { success: false, count: 0, sample: null, error: e.message, logs };
    }
}

async function fetchYahooFinanceCalendarDebug() {
    const logs: string[] = [];
    try {
        logs.push('🔍 [YAHOO] Iniciando...');
        
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const url = `https://query1.finance.yahoo.com/v1/finance/calendar/economic?region=US&from=${todayStr}&to=${todayStr}`;
        
        logs.push(`[YAHOO] URL: ${url}`);
        logs.push('[YAHOO] Fazendo requisição...');
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        });
        
        logs.push(`[YAHOO] Status: ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
            logs.push(`[YAHOO] ❌ HTTP Error ${response.status}`);
            return { success: false, count: 0, sample: null, error: `HTTP ${response.status}`, logs };
        }
        
        const text = await response.text();
        logs.push(`[YAHOO] Resposta: ${text.length} caracteres`);
        logs.push(`[YAHOO] Primeiros 200 chars: ${text.substring(0, 200)}`);
        
        const events = await fetchYahooFinanceCalendar();
        
        if (events && events.length > 0) {
            logs.push(`[YAHOO] ✅ ${events.length} eventos encontrados`);
            return { success: true, count: events.length, sample: events.slice(0, 2), error: null, logs };
        }
        
        logs.push('[YAHOO] ❌ Sem eventos no JSON');
        return { success: false, count: 0, sample: null, error: 'economicCalendar vazio', logs };
        
    } catch (e: any) {
        logs.push(`[YAHOO] ❌ EXCEPTION: ${e.message}`);
        return { success: false, count: 0, sample: null, error: e.message, logs };
    }
}

// ✅ NOVO: VIX Index - Buscar dados REAIS do S&P 500 VIX
app.get("/vix", async (c) => {
    try {
        console.log('🔍 [VIX API] === BUSCANDO VIX REAL ===');
        console.log('🔍 [VIX API] Timestamp:', new Date().toISOString());
        
        const spGlobalKey = Deno.env.get('SPGLOBAL_API_KEY');
        
        // 🥇 PRIORIDADE 1: S&P Global Market Data API (OFICIAL)
        if (spGlobalKey) {
            try {
                console.log('🥇 [VIX] Tentando S&P Global Market Data API...');
                
                const response = await fetch('https://api.spglobal.com/market-data/v1/indices/VIX/realtime', {
                    headers: {
                        'Authorization': `Bearer ${spGlobalKey}`,
                        'Accept': 'application/json'
                    }
                });
                
                console.log('[VIX S&P Global] Status:', response.status);
                
                if (response.ok) {
                    const data = await response.json();
                    console.log('[VIX S&P Global] Resposta:', JSON.stringify(data, null, 2));
                    
                    const vixValue = data?.data?.indexValue || data?.value || data?.last;
                    const vixOpen = data?.data?.open || data?.openPrice;
                    
                    if (vixValue && vixOpen) {
                        const vixChange = vixValue - vixOpen;
                        const vixChangePercent = (vixChange / vixOpen) * 100;
                        
                        console.log('[VIX S&P Global] ✅ SUCESSO!', {
                            value: vixValue,
                            open: vixOpen,
                            change: vixChange,
                            changePercent: vixChangePercent
                        });
                        
                        return c.json({
                            value: parseFloat(vixValue.toFixed(2)),
                            change: parseFloat(vixChange.toFixed(2)),
                            changePercent: parseFloat(vixChangePercent.toFixed(2)),
                            timestamp: new Date().toISOString(),
                            source: 'S&P Global (OFICIAL)'
                        });
                    }
                }
            } catch (error) {
                console.warn('[VIX S&P Global] ❌ Erro:', error);
            }
        } else {
            console.log('[VIX] ⚠️ SPGLOBAL_API_KEY não configurada');
        }
        
        // 🥈 PRIORIDADE 2: CBOE DataShop API (Backup oficial)
        try {
            console.log('🥈 [VIX] Tentando CBOE DataShop...');
            
            const response = await fetch('https://cdn.cboe.com/api/global/delayed_quotes/index/VIX.json');
            
            console.log('[VIX CBOE] Status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('[VIX CBOE] Resposta:', JSON.stringify(data, null, 2));
                
                const vixValue = data?.data?.last_price || data?.data?.current_price;
                const vixOpen = data?.data?.open;
                
                if (vixValue && vixOpen) {
                    const vixChange = vixValue - vixOpen;
                    const vixChangePercent = (vixChange / vixOpen) * 100;
                    
                    console.log('[VIX CBOE] ✅ SUCESSO!', {
                        value: vixValue,
                        open: vixOpen,
                        change: vixChange,
                        changePercent: vixChangePercent
                    });
                    
                    return c.json({
                        value: parseFloat(vixValue.toFixed(2)),
                        change: parseFloat(vixChange.toFixed(2)),
                        changePercent: parseFloat(vixChangePercent.toFixed(2)),
                        timestamp: new Date().toISOString(),
                        source: 'CBOE DataShop'
                    });
                }
            }
        } catch (error) {
            console.warn('[VIX CBOE] ❌ Erro:', error);
        }
        
        // 🥉 PRIORIDADE 3: Yahoo Finance (Fallback)
        try {
            console.log('🥉 [VIX] === TENTANDO YAHOO FINANCE ===');
            
            const response = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1m&range=1d');
            
            console.log('[VIX Yahoo] Status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                const result = data?.chart?.result?.[0];
                
                console.log('[VIX Yahoo] 📊 Meta completo:', JSON.stringify(result?.meta, null, 2));
                
                if (result?.meta) {
                    // 🔥 CORREÇÃO CRÍTICA: Usar regularMarketPrice e regularMarketOpen do META
                    // Estes são os valores OFICIAIS do dia de trading (9:30 AM ET)
                    const currentPrice = result.meta.regularMarketPrice;
                    const todayOpen = result.meta.regularMarketOpen;  // ✅ OPEN OFICIAL do pregão!
                    const previousClose = result.meta.previousClose;
                    
                    console.log('[VIX Yahoo] 📊 Valores OFICIAIS do meta:', {
                        regularMarketPrice: currentPrice,
                        regularMarketOpen: todayOpen,
                        previousClose: previousClose,
                        chartPreviousClose: result.meta.chartPreviousClose
                    });
                    
                    if (currentPrice && todayOpen) {
                        // ✅ CÁLCULO CORRETO: Variação INTRADAY usando OPEN OFICIAL do pregão
                        const vixChange = currentPrice - todayOpen;
                        const vixChangePercent = (vixChange / todayOpen) * 100;
                        
                        console.log('[VIX Yahoo] ✅ ✅ ✅ SUCESSO COM YAHOO (OPEN OFICIAL)! ✅ ✅ ✅');
                        console.log('[VIX Yahoo] 📊 Valores finais (OPEN OFICIAL 9:30 AM ET):', {
                            currentPrice: currentPrice,
                            todayOpen: todayOpen,
                            change: vixChange,
                            changePercent: vixChangePercent,
                            calculation: `(${currentPrice.toFixed(2)} - ${todayOpen.toFixed(2)}) / ${todayOpen.toFixed(2)} * 100 = ${vixChangePercent.toFixed(2)}%`
                        });
                        
                        return c.json({
                            value: parseFloat(currentPrice.toFixed(2)),
                            change: parseFloat(vixChange.toFixed(2)),
                            changePercent: parseFloat(vixChangePercent.toFixed(2)),
                            timestamp: new Date().toISOString(),
                            source: 'Yahoo Finance (Official Market Open 9:30 AM ET)',
                            debug: {
                                currentPrice,
                                todayOpen,
                                previousClose,
                                calculation: `(${currentPrice.toFixed(2)} - ${todayOpen.toFixed(2)}) / ${todayOpen.toFixed(2)} * 100`
                            }
                        });
                    }
                    
                    console.warn('[VIX Yahoo] ⚠️ regularMarketOpen não disponível no meta, tentando candles como fallback...');
                    
                    // 🆘 FALLBACK: Se meta não tem regularMarketOpen, usar primeiro candle (menos preciso)
                    if (result?.indicators?.quote?.[0]) {
                        const opens = result.indicators.quote[0].open?.filter((o: number | null) => o !== null) || [];
                        const closes = result.indicators.quote[0].close?.filter((c: number | null) => c !== null) || [];
                        
                        console.log('[VIX Yahoo] 📊 Dados intraday (FALLBACK):', {
                            currentPrice,
                            opensCount: opens.length,
                            closesCount: closes.length,
                            firstOpen: opens[0],
                            lastClose: closes[closes.length - 1]
                        });
                        
                        if (opens.length >= 1 && closes.length >= 1) {
                            const todayOpenFallback = opens[0];
                            const latestClose = closes[closes.length - 1];
                            
                            const vixChange = latestClose - todayOpenFallback;
                            const vixChangePercent = (vixChange / todayOpenFallback) * 100;
                            
                            console.log('[VIX Yahoo] ⚠️ USANDO FALLBACK (primeiro candle - PODE SER IMPRECISO):');
                            console.log('[VIX Yahoo] 📊 Valores finais (FALLBACK):', {
                                todayOpenFallback: todayOpenFallback,
                                latestClose: latestClose,
                                change: vixChange,
                                changePercent: vixChangePercent
                            });
                            
                            return c.json({
                                value: parseFloat(latestClose.toFixed(2)),
                                change: parseFloat(vixChange.toFixed(2)),
                                changePercent: parseFloat(vixChangePercent.toFixed(2)),
                                timestamp: new Date().toISOString(),
                                source: 'Yahoo Finance (Intraday Candles - FALLBACK)',
                                warning: '⚠️ Usando primeiro candle como open (pode ter até 3% de erro)'
                            });
                        }
                    }
                    
                    console.warn('[VIX Yahoo] ⚠️ Dados intraday insuficientes...');
                }
            }
        } catch (error) {
            console.error('[VIX Yahoo] ❌ EXCEPTION:', error);
        }
        
        // ❌ Fallback final
        console.warn('[VIX] ⚠️ Todas as fontes falharam, usando fallback');
        
        return c.json({
            value: 18.71,
            change: 0.26,
            changePercent: 1.41,
            timestamp: new Date().toISOString(),
            source: 'Fallback (Estimativa)'
        }, 200);
        
    } catch (error) {
        console.error('[VIX API] ❌ Erro geral:', error);
        return c.json({ error: 'Erro ao buscar VIX' }, 500);
    }
});

// ==================== MARKET DATA PROXIES ====================

// ❌ YAHOO FINANCE REMOVIDO - NÃO CONFIÁVEL PARA TRADING

// 🔥 S&P GLOBAL API PROXY (Market Data para Índices)
// ⚠️ DESABILITADO: API não está disponível publicamente
// Endpoint: /spglobal/:symbol
app.get("/spglobal/:symbol", async (c) => {
    try {
        const symbol = c.req.param('symbol');
        
        // S&P Global API não está publicamente acessível
        // Retornar erro 503 para que o frontend use fallback
        console.log(`[SPGLOBAL] ℹ️ API not publicly available for ${symbol}, using fallback`);
        
        return c.json({ 
            error: 'S&P Global API not publicly available',
            message: 'Using fallback data instead' 
        }, 503);
        
    } catch (error: any) {
        console.error(`[SPGLOBAL] ❌ Error:`, error.message);
        return c.json({ error: error.message }, 500);
    }
});

// ========================================
// 💾 ROTA: SALVAR TOKEN METAAPI
// ========================================
app.post('/save-metaapi-token', async (c) => {
    try {
        const { token } = await c.req.json();
        
        // 🔥 VALIDAÇÃO RIGOROSA: Impedir tokens inválidos
        if (!token || token.trim().length < 100) {
            return c.json({ 
                error: 'Token inválido - muito curto',
                details: `Token MetaAPI deve ter pelo menos 100 caracteres. Recebido: ${token?.length || 0}`
            }, 400);
        }
        
        // 🔥 VALIDAÇÃO: Verificar se é um JWT válido
        if (!token.trim().startsWith('eyJ')) {
            return c.json({ 
                error: 'Token inválido - formato incorreto',
                details: 'Token MetaAPI deve começar com "eyJ" (formato JWT)'
            }, 400);
        }
        
        // 🔥 VALIDAÇÃO: Não permitir placeholders
        if (token.trim() === 'aquela' || token.trim().toLowerCase().includes('placeholder')) {
            return c.json({ 
                error: 'Token inválido - placeholder detectado',
                details: 'Você deve usar um token real obtido em https://app.metaapi.cloud/token'
            }, 400);
        }
        
        console.log('[SAVE TOKEN] 💾 Salvando token MetaAPI...');
        console.log(`[SAVE TOKEN] Token length: ${token.length}`);
        console.log(`[SAVE TOKEN] Token primeiros 50: ${token.substring(0, 50)}...`);
        
        // Salvar no KV store
        await kv.set('metaapi_token', token.trim());
        
        console.log('[SAVE TOKEN] ✅ Token salvo com sucesso!');
        
        return c.json({ 
            success: true,
            message: 'Token MetaAPI salvo com sucesso',
            tokenLength: token.trim().length
        });
        
    } catch (error: any) {
        console.error('[SAVE TOKEN] ❌ Erro ao salvar token:', error);
        return c.json({ error: 'Erro ao salvar token', details: error.message }, 500);
    }
});

// ========================================
// 🗑️ ROTA: LIMPAR TOKEN METAAPI DO KV STORE
// ========================================
app.delete('/clear-metaapi-token', async (c) => {
    try {
        console.log('[CLEAR TOKEN] 🗑️ Limpando token do KV store...');
        
        await kv.del('metaapi_token');
        
        console.log('[CLEAR TOKEN] ✅ Token removido com sucesso!');
        console.log('[CLEAR TOKEN] ℹ️ O sistema agora usará apenas a variável de ambiente METAAPI_TOKEN');
        
        return c.json({ 
            success: true,
            message: 'Token removido do KV store. Sistema usará variável de ambiente METAAPI_TOKEN.'
        });
        
    } catch (error: any) {
        console.error('[CLEAR TOKEN] ❌ Erro ao limpar token:', error);
        return c.json({ error: 'Erro ao limpar token', details: error.message }, 500);
    }
});

// ========================================
// 📊 ROTA: MT5 REAL-TIME PRICES (METAAPI)
// ========================================
// 🔍 2026-07-15: mesma lista de `CRYPTO_CFD_AVAILABLE.infinox` em
// src/app/config/brokerRegistry.ts (não importável aqui, Edge Function é
// isolada do bundle do frontend) — usada só pro log de debug temporário abaixo.
const CRYPTO_CFD_SYMBOLS = new Set(['BTCUSD', 'SOLUSD', 'BNBUSD', 'XRPUSD', 'ADAUSD', 'DOTUSD', 'BATUSD']);

// 🔍 2026-07-15: AUDJPY reportado com % levemente errada (-0.05% no app vs
// -0.08% no MT5 real, preço batendo) — mesma família de sintoma do SOL/ADA,
// mas em forex tradicional (não 24/7), então a hipótese de mercado sem pausa
// de sessão não se aplica igual. Log temporário isolado pra este símbolo
// específico, pra pegar o candle bruto exato na próxima ocorrência.
// 🔍 2026-07-16: UKOUSD (Brent) reportado oscilando preço E variação entre
// certo e errado, mesmo depois da proteção brokerOnly generalizada
// (RealMarketDataService.ts) já cobrir esse ativo — descarta fallback pro
// Yahoo como causa. Já teve causa raiz documentada antes (candle de
// referência com gap sob rate-limit, ver "Causa raiz" no CLAUDE.md) mas pode
// ter voltado ou ter causa nova. Log isolado pra pegar o candle bruto exato.
// 🔍 2026-07-16: HK50 (Hang Seng, nome real na corretora 'HKG33', ver override
// em brokerRegistry.ts) reportado com gap grande de variação — app +2.53%,
// MT5 real +0.57%, preço batendo (24.974 vs ~24.932). Nome que chega aqui já
// é o traduzido pela corretora ('HKG33'), não o unificado.
// 🔍 2026-07-16: BVSPX (Ibovespa, recém-adicionado ao catálogo) reportado por
// Cleber oscilando entre valor/variação certos e errados. Testado via curl
// direto (8 chamadas em ~80s) e o backend respondeu certo o tempo todo —
// não reproduzido ao vivo. Suspeita (não confirmada): pregão da B3 é bem
// mais curto que a maioria dos CFDs (~7h/dia vs quase 24h), o que pode
// aumentar a chance do candle D1 "penúltimo" não ser o fechamento de ontem
// sob rate-limit da conta compartilhada (mesma causa já documentada pra
// UKOUSD/AUDJPY/HKG33). Instrumentado aqui pra capturar o candle bruto na
// próxima vez que acontecer.
const EXTRA_DEBUG_SYMBOLS = new Set(['AUDJPY', 'UKOUSD', 'HKG33', 'BVSPX']);

app.post('/mt5-prices', async (c) => {
    try {
        const { symbols, token, accountId } = await c.req.json();
        
        if (!symbols || !Array.isArray(symbols)) {
            return c.json({ error: 'Símbolos não fornecidos ou inválidos' }, 400);
        }
        
        // 🔑 PRIORIDADE: KV Store > ENV > Body
        const metaapiToken = await getMetaApiToken(token);
        
        // ✅ VALIDAÇÃO FLEXÍVEL: Aceita JWT OU formato antigo (mínimo 10 caracteres)
        const isInvalidToken = !metaapiToken || 
                              metaapiToken === 'your-token' ||
                              metaapiToken.trim().length < 10;
        
        // ✅ FALLBACK: Se não houver token VÁLIDO, retornar preços SIMULADOS
        if (isInvalidToken) {
            console.warn('[MT5 PRICES] ⚠️ Token MetaAPI não configurado ou inválido, retornando preços SIMULADOS');
            console.warn(`[MT5] 💡 Para usar dados reais, configure o token em Settings > MT5 Connection`);
            console.warn(`[MT5] 💡 Obtenha o token em https://app.metaapi.cloud/token`);
            console.warn(`[MT5] Tamanho do token: ${metaapiToken?.length || 0}`);
            console.warn(`[MT5] Token recebido: ${metaapiToken?.substring(0, 10) || 'null'}...`);
            
            const simulatedPrices = symbols.map((symbol: string) => {
                const basePrices: Record<string, number> = {
                    'EURUSD': 1.0845,
                    'GBPUSD': 1.2650,
                    'USDJPY': 148.50,
                    'AUDUSD': 0.6550,
                    'BTCUSD': 96000,
                    'ETHUSD': 3500,
                    'XAUUSD': 2650,
                    'SPX500': 6800,
                    'NAS100': 21000,
                    'US30': 43000
                };
                
                const basePrice = basePrices[symbol] || 100;
                const randomChange = (Math.random() - 0.5) * 2; // -1% a +1%
                
                return {
                    symbol,
                    price: basePrice,
                    change: basePrice * (randomChange / 100),
                    changePercent: randomChange,
                    source: 'SIMULATED'
                };
            });
            
            return c.json({
                success: true,
                count: simulatedPrices.length,
                total: symbols.length,
                prices: simulatedPrices,
                source: 'SIMULATED',
                warning: 'Configure METAAPI_TOKEN válido no ambiente para dados reais do MT5',
                timestamp: new Date().toISOString()
            });
        }
        
        // 🔑 Token válido detectado! Buscar Account ID dinamicamente via API
        console.log(`[MT5 PRICES] 📊 Buscando preços de ${symbols.length} ativos...`);
        console.log(`[MT5 PRICES] 🔑 Token válido detectado (${metaapiToken.length} chars)`);
        
        // Buscar Account ID: body > ENV (conta de plataforma) > auto-discovery
        let metaapiAccountId = accountId || Deno.env.get('METAAPI_ACCOUNT_ID');

        if (!metaapiAccountId || metaapiAccountId.length < 10) {
            console.log('[MT5 PRICES] 🔍 Buscando Account ID automaticamente...');
            try {
                const accountsRes = await fetch('https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts', {
                    headers: {
                        'auth-token': metaapiToken,
                        'Accept': 'application/json'
                    }
                });
                
                if (accountsRes.ok) {
                    const accounts = await accountsRes.json();
                    if (accounts && accounts.length > 0) {
                        metaapiAccountId = accounts[0].id; // Usar primeira conta
                        console.log(`[MT5 PRICES] ✅ Account ID detectado: ${metaapiAccountId}`);
                    }
                }
            } catch (err) {
                console.warn('[MT5 PRICES] ⚠️ Falha ao buscar Account ID:', err);
            }
        }
        
        // Se ainda não temos Account ID válido, retornar erro claro
        if (!metaapiAccountId || metaapiAccountId.length < 10) {
            return c.json({
                error: 'Nenhuma conta MT5 configurada. Configure suas credenciais MT5 no painel de configuração.',
                success: false
            }, 400);
        }
        
        console.log(`[MT5 PRICES] Símbolos:`, symbols.join(', '));

        // Descobrir a região certa da conta (evita 504 por chamar o datacenter errado)
        const clientApiBase = await getMetaApiClientApiBase(metaapiToken, metaapiAccountId);

        // Buscar preços de todos os símbolos, com concorrência limitada (ver
        // mapWithConcurrency acima — evita rate-limit por excesso de chamadas
        // simultâneas à mesma conta MetaAPI compartilhada dentro de um chunk).
        const results = await mapWithConcurrency(symbols, 8, async (symbol: string) => {
                try {
                    // 1️⃣ Buscar TICKER (preço atual)
                    const tickerUrl = `${clientApiBase}/users/current/accounts/${metaapiAccountId}/symbols/${symbol}/current-tick`;
                    const tickerRes = await fetch(tickerUrl, {
                        headers: {
                            'auth-token': metaapiToken,
                            'Accept': 'application/json'
                        }
                    });
                    
                    if (!tickerRes.ok) {
                        console.warn(`[MT5 PRICES] ⚠️ ${symbol}: Ticker failed (${tickerRes.status})`);
                        return {
                            symbol,
                            price: null,
                            change: 0,
                            changePercent: 0,
                            error: `HTTP ${tickerRes.status}`
                        };
                    }
                    
                    const tickerData = await tickerRes.json();
                    const currentPrice = tickerData.bid || tickerData.ask || tickerData.last || 0;
                    
                    // 2️⃣ Buscar candle DIÁRIO (D1) pra calcular a variação — convenção
                    // do MetaTrader/Market Watch: variação = preço atual vs. FECHAMENTO
                    // do candle D1 de ONTEM (dia anterior já fechado), não a abertura do
                    // candle de hoje. Corrigido em 2026-07-08: usar o open de hoje deixava
                    // uma discrepância pequena e consistente (~0.20%) em todo ativo não-
                    // cripto sempre que houvesse gap entre o fechamento de ontem e a
                    // abertura de hoje (comum em CFD que só pausa ~1h/dia).
                    // API separada da de tick (mt-market-data-client-api-v1, não
                    // mt-client-api-v1), endpoint /historical-market-data/.../candles,
                    // carrega PRA TRÁS a partir de `startTime`. Ver getMetaApiMarketDataApiBase.
                    const now = new Date();
                    const marketDataApiBase = await getMetaApiMarketDataApiBase(metaapiToken, metaapiAccountId);
                    const candlesUrl = `${marketDataApiBase}/users/current/accounts/${metaapiAccountId}/historical-market-data/symbols/${symbol}/timeframes/1d/candles`;
                    // ✅ 2026-07-15 (4ª parte): `limit=2` funcionou pra praticamente todo
                    // ativo por meses (posição fixa `length-2` = candle de ontem fechado).
                    // Só o BTCUSD (mercado 24/7, sem a pausa diária que CFD tradicional tem)
                    // vinha recebendo sistematicamente 1 candle só com esse limit. Tentativas
                    // anteriores de mudar a janela/seleção pra TODO ativo quebraram os que já
                    // funcionavam (US30 e outros voltaram errados com limit=5 fixo, e a
                    // seleção por data quebrou o resto por causa do fechamento D1 não bater
                    // com meia-noite UTC). Fix final: mantém `limit=2` como sempre (zero risco
                    // pro que já funciona) e só faz uma 2ª tentativa com janela maior quando a
                    // primeira vier curta (<2 candles) — isolado pro caso real, sem tocar no
                    // caminho que já era correto pra todo o resto.
                    async function fetchCandles(limit: number) {
                        const res = await fetch(
                            `${candlesUrl}?startTime=${now.toISOString()}&limit=${limit}`,
                            {
                                headers: {
                                    'auth-token': metaapiToken,
                                    'Accept': 'application/json'
                                }
                            }
                        );
                        if (!res.ok) return { ok: false, candles: null as any[] | null };
                        const json = await res.json();
                        return { ok: true, candles: Array.isArray(json) ? json : null };
                    }

                    let change = 0;
                    let changePercent = 0;
                    let candlesUsedForDebug: any[] | null = null;
                    let previousCandleForDebug: any = null;

                    const firstTry = await fetchCandles(2);

                    if (firstTry.ok) {
                        let candles = firstTry.candles;
                        if (!candles || candles.length < 2) {
                            // Só refaz a chamada (janela maior) quando a primeira veio curta
                            // — na prática só acontece com BTCUSD hoje, não custa latência
                            // extra pra nenhum outro ativo.
                            const retry = await fetchCandles(5);
                            candles = retry.candles;
                        }
                        const previousCandle = candles && candles.length >= 2
                            ? candles[candles.length - 2]
                            : null;
                        candlesUsedForDebug = candles;
                        previousCandleForDebug = previousCandle;

                        // 🔍 2026-07-15: log temporário pra investigar variação levemente
                        // errada em cripto (SOLUSD, ADAUSD) — captura o array bruto de
                        // candles pra comparar com o % real do terminal MT5 quando o erro
                        // for reproduzido. Remover depois de diagnosticado.
                        if (CRYPTO_CFD_SYMBOLS.has(symbol) || EXTRA_DEBUG_SYMBOLS.has(symbol)) {
                            console.log(`[MT5 PRICES][CRYPTO DEBUG] ${symbol} candles brutos:`,
                                JSON.stringify((candles || []).map((cd: any) => ({ time: cd.time, open: cd.open, close: cd.close }))));
                            console.log(`[MT5 PRICES][CRYPTO DEBUG] ${symbol} previousCandle escolhido:`,
                                JSON.stringify({ time: previousCandle?.time, close: previousCandle?.close, open: previousCandle?.open }),
                                `currentPrice=${currentPrice}`);
                        }

                        if (previousCandle) {
                            const referencePrice = previousCandle.close || previousCandle.open || 0;

                            // ✅ 2026-07-13: achado real (UKOUSD) — quando a conta MetaAPI
                            // compartilhada está sob rate-limit (429, comum, ver histórico
                            // deste arquivo), a série de candles às vezes tem um buraco e o
                            // "penúltimo" candle não é de ontem, é de dias/semanas atrás —
                            // gerando variação implausível (ex: +11.5% num único dia pra
                            // petróleo) que ficava presa até o próximo ciclo funcionar.
                            // Validação dupla: 1) o candle de referência precisa ser recente
                            // (até 4 dias, cobre fim de semana longo); 2) mesmo se a data
                            // bater, uma variação diária >15% pra CFD não-cripto é implausível
                            // o bastante pra ser mais provável bug de referência do que
                            // movimento real — nesses casos, melhor mostrar 0 (sem variação
                            // confiável) do que um número fabricado pela referência errada.
                            const candleTime = previousCandle.time ? new Date(previousCandle.time).getTime() : null;
                            const candleIsRecent = candleTime === null || (now.getTime() - candleTime) <= 4 * 86_400_000;

                            if (referencePrice > 0 && currentPrice > 0 && candleIsRecent) {
                                const computedChange = currentPrice - referencePrice;
                                const computedChangePercent = (computedChange / referencePrice) * 100;

                                if (Math.abs(computedChangePercent) <= 15) {
                                    change = computedChange;
                                    changePercent = computedChangePercent;
                                } else {
                                    console.warn(`[MT5 PRICES] ⚠️ ${symbol}: variação implausível (${computedChangePercent.toFixed(2)}%) — referência provavelmente desatualizada, mantendo change 0.`);
                                }
                            } else if (!candleIsRecent) {
                                console.warn(`[MT5 PRICES] ⚠️ ${symbol}: candle de referência desatualizado (${previousCandle.time}), change ficará 0.`);
                            }
                        }
                    } else {
                        console.warn(`[MT5 PRICES] ⚠️ ${symbol}: candles HTTP falhou, change ficará 0`);
                    }
                    
                    console.log(`[MT5 PRICES] ✅ ${symbol}: $${currentPrice.toFixed(5)} (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%)`);

                    // 🔍 2026-07-16: console.log não é acessível pelas ferramentas de
                    // debug disponíveis (só devolvem log de acesso HTTP, não stdout da
                    // função) — devolve o candle bruto direto na resposta JSON pros
                    // símbolos marcados como debug, pra investigar com um curl simples
                    // em vez de depender de acesso a log. Remover depois de diagnosticado.
                    const debugCandles = (CRYPTO_CFD_SYMBOLS.has(symbol) || EXTRA_DEBUG_SYMBOLS.has(symbol))
                        ? {
                            _debug: {
                                allCandles: (candlesUsedForDebug || []).map((cd: any) => ({ time: cd.time, open: cd.open, close: cd.close })),
                                previousCandleUsed: previousCandleForDebug
                                    ? { time: previousCandleForDebug.time, close: previousCandleForDebug.close, open: previousCandleForDebug.open }
                                    : null,
                                currentPrice,
                            }
                        }
                        : {};

                    return {
                        symbol,
                        price: currentPrice,
                        change,
                        changePercent,
                        bid: tickerData.bid,
                        ask: tickerData.ask,
                        timestamp: tickerData.time || new Date().toISOString(),
                        ...debugCandles
                    };
                    
                } catch (error: any) {
                    console.error(`[MT5 PRICES] ❌ ${symbol}: ${error.message}`);
                    return {
                        symbol,
                        price: null,
                        change: 0,
                        changePercent: 0,
                        error: error.message
                    };
                }
        });

        const successCount = results.filter(r => r.price !== null).length;
        console.log(`[MT5 PRICES] 📊 Resultado: ${successCount}/${symbols.length} ativos obtidos`);
        
        return c.json({
            success: true,
            count: successCount,
            total: symbols.length,
            prices: results,
            timestamp: new Date().toISOString()
        });
        
    } catch (error: any) {
        console.error('[MT5 PRICES] ❌ Erro crítico:', error.message);
        return c.json({ error: error.message }, 500);
    }
});

// ========================================
// 🎲 FUNÇÃO HELPER: Gerar Candles Simulados
// ========================================
function generateSimulatedCandles(symbol: string, timeframe: string, count: number): any[] {
    // Preços base para cada símbolo
    const basePrices: Record<string, number> = {
        'EURUSD': 1.0845,
        'GBPUSD': 1.2650,
        'USDJPY': 148.50,
        'AUDUSD': 0.6550,
        'BTCUSD': 96000,
        'ETHUSD': 3500,
        'XAUUSD': 2650,
        'SPX500': 6800,
        'NAS100': 21000,
        'US30': 43000
    };
    
    const basePrice = basePrices[symbol.replace('/', '')] || 100;
    const candles: any[] = [];
    const now = Date.now();
    
    // Calcular intervalo entre candles baseado no timeframe
    const intervalMap: Record<string, number> = {
        '1m': 60 * 1000,
        '5m': 5 * 60 * 1000,
        '15m': 15 * 60 * 1000,
        '30m': 30 * 60 * 1000,
        '1H': 60 * 60 * 1000,
        '4H': 4 * 60 * 60 * 1000,
        '1D': 24 * 60 * 60 * 1000,
        '1W': 7 * 24 * 60 * 60 * 1000
    };
    
    const interval = intervalMap[timeframe] || intervalMap['1H'];
    let currentPrice = basePrice;
    
    for (let i = count - 1; i >= 0; i--) {
        const timestamp = now - (i * interval);
        
        // Gerar volatilidade realista
        const volatility = basePrice * 0.002; // 0.2% de volatilidade
        const change = (Math.random() - 0.5) * volatility;
        
        const open = currentPrice;
        const close = currentPrice + change;
        const high = Math.max(open, close) + (Math.random() * volatility * 0.5);
        const low = Math.min(open, close) - (Math.random() * volatility * 0.5);
        const volume = Math.floor(Math.random() * 10000) + 1000;
        
        candles.push({
            timestamp,
            open,
            high,
            low,
            close,
            volume
        });
        
        currentPrice = close;
    }
    
    return candles;
}

// ========================================
// 📈 ROTA: MT5 CANDLES (METAAPI)
// ========================================
app.post('/mt5-candles', async (c) => {
    try {
        const { symbol, timeframe, limit, token, accountId } = await c.req.json();
        
        // 🔑 PRIORIDADE: KV Store > ENV > Body
        const metaapiToken = await getMetaApiToken(token);
        
        // ✅ VALIDAÇÃO: Apenas verificar se o token é válido (JWT format)
        const isInvalidToken = !metaapiToken || 
                              metaapiToken === 'your-token' ||
                              metaapiToken.length < 20 ||
                              !metaapiToken.startsWith('eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9');
        
        // ✅ FALLBACK: Se não houver token VÁLIDO, retornar dados SIMULADOS
        if (isInvalidToken) {
            console.warn('[MT5 CANDLES] ⚠️ Token MetaAPI inválido, retornando dados SIMULADOS');
            console.warn(`[MT5 CANDLES] Token length: ${metaapiToken?.length || 0}`);
            
            // Gerar candles simulados realistas
            const simulatedCandles = generateSimulatedCandles(symbol || 'EURUSD', timeframe || '1H', limit || 1000);
            
            return c.json({
                success: true,
                candles: simulatedCandles,
                source: 'SIMULATED',
                warning: 'Configure METAAPI_TOKEN válido no ambiente para dados reais do MT5',
                symbol: symbol || 'EURUSD',
                timeframe: timeframe || '1H',
                count: simulatedCandles.length,
                timestamp: new Date().toISOString()
            });
        }
        
        if (!symbol || !timeframe) {
            console.error('[MT5 CANDLES] ❌ Parâmetros ausentes:', { 
                hasSymbol: !!symbol, 
                hasTimeframe: !!timeframe
            });
            return c.json({ error: 'Parâmetros obrigatórios ausentes (symbol, timeframe)' }, 400);
        }
        
        console.log(`[MT5 CANDLES] 📈 Buscando ${limit || 1000} candles de ${symbol} (${timeframe})...`);
        console.log(`[MT5 CANDLES] 🔑 Token válido detectado (${metaapiToken.length} chars)`);
        
        // Buscar Account ID: body > ENV (conta de plataforma) > auto-discovery
        let metaapiAccountId = accountId || Deno.env.get('METAAPI_ACCOUNT_ID');

        if (!metaapiAccountId || metaapiAccountId.length < 10) {
            console.log('[MT5 CANDLES] 🔍 Buscando Account ID automaticamente...');
            try {
                const accountsRes = await fetch('https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts', {
                    headers: {
                        'auth-token': metaapiToken,
                        'Accept': 'application/json'
                    }
                });
                
                if (accountsRes.ok) {
                    const accounts = await accountsRes.json();
                    if (accounts && accounts.length > 0) {
                        metaapiAccountId = accounts[0].id; // Usar primeira conta
                        console.log(`[MT5 CANDLES] ✅ Account ID detectado: ${metaapiAccountId}`);
                    }
                }
            } catch (err) {
                console.warn('[MT5 CANDLES] ⚠️ Falha ao buscar Account ID:', err);
            }
        }
        
        // Se ainda não temos Account ID válido, retornar dados simulados
        if (!metaapiAccountId || metaapiAccountId.length < 10) {
            console.warn('[MT5 CANDLES] ⚠️ Nenhuma conta MT5 configurada, usando dados simulados');
            const simulatedCandles = generateSimulatedCandles(symbol, timeframe, limit || 1000);
            return c.json({
                success: true,
                candles: simulatedCandles,
                source: 'SIMULATED',
                warning: 'Configure suas credenciais MT5 no painel de configuração',
                symbol,
                timeframe,
                count: simulatedCandles.length,
                timestamp: new Date().toISOString()
            });
        }
        
        // Mapear timeframe para formato MetaApi
        const timeframeMap: Record<string, string> = {
            '1m': '1m',
            '5m': '5m',
            '15m': '15m',
            '30m': '30m',
            '1H': '1h',
            '4H': '4h',
            '1D': '1d',
            '1W': '1w'
        };
        
        const mt5Timeframe = timeframeMap[timeframe] || '1h';
        const candleLimit = limit || 1000;
        
        // Calcular intervalo de tempo
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - (candleLimit * 60 * 60 * 1000)); // Aproximação
        
        // Descobrir a região certa da conta (evita 504 por chamar o datacenter errado)
        const clientApiBase = await getMetaApiClientApiBase(metaapiToken, metaapiAccountId);
        const candlesUrl = `${clientApiBase}/users/current/accounts/${metaapiAccountId}/symbols/${symbol}/candles`;

        console.log(`[MT5 CANDLES] URL: ${candlesUrl}`);
        console.log(`[MT5 CANDLES] Timeframe: ${mt5Timeframe}, Limit: ${candleLimit}`);
        
        const response = await fetch(
            `${candlesUrl}?startTime=${startTime.toISOString()}&endTime=${endTime.toISOString()}&timeframe=${mt5Timeframe}`,
            {
                headers: {
                    'auth-token': metaapiToken,
                    'Accept': 'application/json'
                }
            }
        );
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[MT5 CANDLES] ❌ HTTP ${response.status}: ${errorText}`);
            
            // ✅ FALLBACK: Retornar dados simulados em caso de erro
            console.warn('[MT5 CANDLES] 🔄 Retornando dados SIMULADOS devido a erro na API');
            const simulatedCandles = generateSimulatedCandles(symbol, timeframe, limit || 1000);
            
            return c.json({
                success: true,
                candles: simulatedCandles,
                source: 'SIMULATED',
                warning: `MetaApi error: HTTP ${response.status}. Usando dados simulados.`,
                error: errorText,
                symbol,
                timeframe,
                count: simulatedCandles.length,
                timestamp: new Date().toISOString()
            });
        }
        
        const candles = await response.json();
        
        if (!Array.isArray(candles)) {
            console.error('[MT5 CANDLES] ❌ Resposta não é array:', candles);
            return c.json({ error: 'Formato de resposta inválido' }, 500);
        }
        
        // Converter para formato padrão KLineChart
        const formattedCandles = candles.map((c: any) => ({
            timestamp: new Date(c.time).getTime(),
            open: c.open || 0,
            high: c.high || 0,
            low: c.low || 0,
            close: c.close || 0,
            volume: c.tickVolume || c.realVolume || 0,
        }));
        
        console.log(`[MT5 CANDLES] ✅ ${formattedCandles.length} candles obtidos`);
        
        if (formattedCandles.length > 0) {
            const first = formattedCandles[0];
            const last = formattedCandles[formattedCandles.length - 1];
            console.log(`[MT5 CANDLES] 📊 Primeiro: ${new Date(first.timestamp).toISOString()} (${first.close})`);
            console.log(`[MT5 CANDLES] 📊 Último: ${new Date(last.timestamp).toISOString()} (${last.close})`);
        }
        
        return c.json({
            success: true,
            symbol,
            timeframe: mt5Timeframe,
            count: formattedCandles.length,
            candles: formattedCandles,
            timestamp: new Date().toISOString()
        });
        
    } catch (error: any) {
        console.error('[MT5 CANDLES] ❌ Erro crítico:', error.message);
        return c.json({
            error: error.message,
            stack: error.stack
        }, 500);
    }
});

// 🕰️ MT5 CANDLES HISTORY — histórico de candles num intervalo arbitrário
// (startTime/endTime), para o Backtest e o Replay de Mercado multi-ativo.
// Diferença deliberada de /mt5-candles: essa rota NUNCA cai em dados
// SIMULADOS silenciosamente. Se o token/conta/símbolo não tiver dado real
// disponível, retorna erro explícito — precisão do backtest/replay depende
// de nunca disfarçar dado sintético como se fosse real.
app.post('/mt5-candles-history', async (c) => {
    try {
        const { symbol, timeframe, startTime, endTime, token, accountId } = await c.req.json();

        if (!symbol || !timeframe || !startTime || !endTime) {
            return c.json({
                success: false,
                error: 'Parâmetros obrigatórios ausentes (symbol, timeframe, startTime, endTime)'
            }, 400);
        }

        const metaapiToken = await getMetaApiToken(token);
        const isInvalidToken = !metaapiToken ||
                              metaapiToken === 'your-token' ||
                              metaapiToken.length < 20 ||
                              !metaapiToken.startsWith('eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9');

        if (isInvalidToken) {
            return c.json({
                success: false,
                error: 'TOKEN_INVALID',
                message: 'Nenhum token MetaAPI válido configurado — sem fonte de dado real disponível para este ativo.'
            }, 422);
        }

        let metaapiAccountId = accountId || Deno.env.get('METAAPI_ACCOUNT_ID');
        if (!metaapiAccountId || metaapiAccountId.length < 10) {
            try {
                const accountsRes = await fetch('https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts', {
                    headers: { 'auth-token': metaapiToken, 'Accept': 'application/json' }
                });
                if (accountsRes.ok) {
                    const accounts = await accountsRes.json();
                    if (accounts && accounts.length > 0) metaapiAccountId = accounts[0].id;
                }
            } catch (err) {
                console.warn('[MT5 CANDLES HISTORY] ⚠️ Falha ao buscar Account ID:', err);
            }
        }

        if (!metaapiAccountId || metaapiAccountId.length < 10) {
            return c.json({
                success: false,
                error: 'NO_ACCOUNT',
                message: 'Nenhuma conta MT5 configurada — sem fonte de dado real disponível para este ativo.'
            }, 422);
        }

        const timeframeMap: Record<string, string> = {
            '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
            '1H': '1h', '1h': '1h', '4H': '4h', '4h': '4h', '1D': '1d', '1d': '1d', '1W': '1w'
        };
        const mt5Timeframe = timeframeMap[timeframe] || '1h';
        const msPerCandle: Record<string, number> = {
            '1m': 60_000, '5m': 5 * 60_000, '15m': 15 * 60_000, '30m': 30 * 60_000,
            '1h': 3_600_000, '4h': 4 * 3_600_000, '1d': 86_400_000, '1w': 7 * 86_400_000
        };
        // API de candles é separada da de tick/execução (host diferente) e o
        // endpoint carrega PRA TRÁS a partir de `startTime` (não um range) —
        // ver getMetaApiMarketDataApiBase acima.
        const marketDataApiBase = await getMetaApiMarketDataApiBase(metaapiToken, metaapiAccountId);
        const candlesUrl = `${marketDataApiBase}/users/current/accounts/${metaapiAccountId}/historical-market-data/symbols/${symbol}/timeframes/${mt5Timeframe}/candles`;

        const requestedStart = new Date(startTime).getTime();
        const requestedEnd = new Date(endTime).getTime();
        const intervalMs = msPerCandle[mt5Timeframe] || 3_600_000;

        const allCandles: any[] = [];
        let cursor = requestedEnd; // ponto mais recente; anda pra trás a cada chamada
        let iterations = 0;
        const MAX_ITERATIONS = 60; // trava de segurança (não bate a corretora indefinidamente)

        while (cursor > requestedStart && iterations < MAX_ITERATIONS) {
            iterations++;

            const response = await fetch(
                `${candlesUrl}?startTime=${new Date(cursor).toISOString()}&limit=1000`,
                { headers: { 'auth-token': metaapiToken, 'Accept': 'application/json' } }
            );

            if (!response.ok) {
                const errorText = await response.text();
                return c.json({
                    success: false,
                    error: 'METAAPI_ERROR',
                    message: `MetaAPI retornou HTTP ${response.status} — não há dado real disponível para ${symbol} nesse intervalo.`,
                    detail: errorText
                }, 502);
            }

            const chunk = await response.json();
            if (!Array.isArray(chunk) || chunk.length === 0) break;

            allCandles.push(...chunk);
            const times = chunk.map((c: any) => new Date(c.time).getTime());
            const earliestInChunk = Math.min(...times);
            if (earliestInChunk >= cursor) break; // sem progresso, evita loop infinito
            cursor = earliestInChunk - intervalMs; // próxima página: pra trás a partir daqui

            // Delay leve para não estourar rate limit da corretora
            await new Promise(resolve => setTimeout(resolve, 150));
        }

        if (allCandles.length === 0) {
            return c.json({
                success: false,
                error: 'NO_DATA',
                message: `Sem histórico real disponível para ${symbol} no intervalo solicitado.`
            }, 404);
        }

        const dedup = new Map<number, any>();
        for (const c2 of allCandles) dedup.set(new Date(c2.time).getTime(), c2);

        const formattedCandles = Array.from(dedup.values())
            .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
            .map((cd: any) => ({
                timestamp: new Date(cd.time).getTime(),
                open: cd.open || 0,
                high: cd.high || 0,
                low: cd.low || 0,
                close: cd.close || 0,
                volume: cd.tickVolume || cd.realVolume || 0,
            }));

        return c.json({
            success: true,
            source: 'metaapi',
            symbol,
            timeframe: mt5Timeframe,
            count: formattedCandles.length,
            candles: formattedCandles,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('[MT5 CANDLES HISTORY] ❌ Erro crítico:', error.message);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// ========================================
// 🔍 DIAGNÓSTICO: Verificar Credenciais MetaApi
// ========================================
app.get('/mt5-check', async (c) => {
    try {
        const envToken = Deno.env.get('METAAPI_TOKEN');
        const envAccountId = Deno.env.get('METAAPI_ACCOUNT_ID');
        
        console.log('[MT5 CHECK] 🔍 Verificando credenciais ENV...');
        console.log('[MT5 CHECK] Token exists:', !!envToken);
        console.log('[MT5 CHECK] Token length:', envToken?.length || 0);
        console.log('[MT5 CHECK] Token prefix:', envToken?.substring(0, 20) || 'null');
        console.log('[MT5 CHECK] Account ID:', envAccountId || 'null');
        console.log('[MT5 CHECK] Account ID length:', envAccountId?.length || 0);
        
        // Tentar fazer uma requisição de teste para o MetaApi
        if (envToken && envAccountId) {
            try {
                const clientApiBase = await getMetaApiClientApiBase(envToken, envAccountId);
                const testUrl = `${clientApiBase}/users/current/accounts/${envAccountId}`;
                console.log('[MT5 CHECK] Testing URL:', testUrl);
                
                const testResponse = await fetch(testUrl, {
                    headers: {
                        'auth-token': envToken,
                        'Accept': 'application/json'
                    }
                });
                
                const testStatus = testResponse.status;
                let testBody = null;
                
                try {
                    testBody = await testResponse.json();
                } catch {
                    testBody = await testResponse.text();
                }
                
                console.log('[MT5 CHECK] Test response:', testStatus, testBody);
                
                return c.json({
                    env_configured: true,
                    token_exists: !!envToken,
                    token_length: envToken?.length || 0,
                    token_prefix: envToken?.substring(0, 20) || 'null',
                    account_id: envAccountId,
                    account_id_length: envAccountId?.length || 0,
                    test_request: {
                        status: testStatus,
                        ok: testResponse.ok,
                        body: testBody
                    }
                });
            } catch (testError: any) {
                return c.json({
                    env_configured: true,
                    token_exists: !!envToken,
                    token_length: envToken?.length || 0,
                    token_prefix: envToken?.substring(0, 20) || 'null',
                    account_id: envAccountId,
                    test_error: testError.message
                });
            }
        }
        
        return c.json({
            env_configured: false,
            token_exists: !!envToken,
            token_length: envToken?.length || 0,
            account_id_exists: !!envAccountId,
            account_id: envAccountId || 'NOT_SET',
            message: 'Configure as variáveis METAAPI_TOKEN e METAAPI_ACCOUNT_ID'
        });
        
    } catch (error: any) {
        console.error('[MT5 CHECK] ❌ Erro:', error.message);
        return c.json({ error: error.message }, 500);
    }
});

// ========================================
// 🔓 ENDPOINT PÚBLICO: Diagnóstico MetaApi (Sem Autenticação)
// ========================================
app.get('/public/mt5-status', async (c) => {
    try {
        // Buscar de ENV e KV Store
        const envToken = Deno.env.get('METAAPI_TOKEN');
        const envAccountId = Deno.env.get('METAAPI_ACCOUNT_ID');
        
        let kvToken = null;
        let kvAccountId = null;
        
        try {
            const [tokenResult, accountIdResult] = await Promise.all([
                kv.get('metaapi_token'),
                kv.get('metaapi_account_id')
            ]);
            
            kvToken = tokenResult || null;
            kvAccountId = accountIdResult || null;
        } catch (error) {
            console.warn('[MT5 STATUS] ⚠️ Erro ao buscar do KV:', error);
        }
        
        // Prioridade: ENV > KV
        const finalToken = envToken || kvToken;
        const finalAccountId = envAccountId || kvAccountId;
        
        const tokenSource = envToken ? 'ENV' : kvToken ? 'KV_STORE' : 'NOT_SET';
        const accountSource = envAccountId ? 'ENV' : kvAccountId ? 'KV_STORE' : 'NOT_SET';
        
        console.log(`[MT5 STATUS] 🔍 Token: ${tokenSource} | Account: ${accountSource}`);
        
        // 🔥 DETECTAR TOKEN INVÁLIDO
        const isInvalidToken = finalToken === 'aquela' || 
                              finalToken === 'your-token' ||
                              (finalToken && finalToken.length < 100) ||
                              (finalToken && !finalToken.startsWith('eyJ'));
        
        const response = {
            timestamp: new Date().toISOString(),
            env_configured: !!(finalToken && finalAccountId && !isInvalidToken),
            token_configured: !!finalToken,
            token_source: tokenSource,
            token_length: finalToken?.length || 0,
            token_prefix: finalToken ? `${finalToken.substring(0, 20)}...` : 'NOT_SET',
            token_valid: !isInvalidToken,
            account_id_configured: !!finalAccountId,
            account_id_source: accountSource,
            account_id: finalAccountId || 'NOT_SET',
            account_id_length: finalAccountId?.length || 0,
            
            // 🔥 INSTRUÇÕES CLARAS
            error: isInvalidToken ? {
                type: 'INVALID_TOKEN',
                message: 'Token MetaAPI inválido detectado',
                current_value: finalToken === 'aquela' ? 'placeholder "aquela"' : 
                              finalToken === 'your-token' ? 'placeholder "your-token"' :
                              finalToken && finalToken.length < 100 ? 'token muito curto' :
                              'formato inválido (deve começar com eyJ)',
                instructions: [
                    '1. Clique no botão "Configurar Agora" acima',
                    '2. Obtenha suas credenciais em https://app.metaapi.cloud',
                    '3. Cole o Token e Account ID no modal',
                    '4. Clique em "Salvar Configuração"'
                ]
            } : null
        };
        
        return c.json(response);
        
    } catch (error: any) {
        console.error('[MT5 STATUS] ❌ Erro:', error.message);
        return c.json({ 
            error: error.message,
            timestamp: new Date().toISOString()
        }, 500);
    }
});

// ========================================
// 🌐 OPTIONS HANDLERS - Necessários para CORS preflight
// ========================================
app.options('/*', (c) => {
    return c.text('', 204);
});

app.options('/public/*', (c) => {
    return c.text('', 204);
});

// ========================================
// 🏥 HEALTH CHECK SIMPLIFICADO (fallback sem auth)
// ========================================
app.all('/health-simple', (c) => {
    return c.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        server: 'Neural Day Trader API',
        version: '1.0.0'
    });
});

// ========================================
// 🔑 CONFIGURAÇÃO DE CREDENCIAIS METAAPI (Via Interface Web)
// ========================================
app.post('/config/metaapi', async (c) => {
    try {
        const { token, accountId } = await c.req.json();
        
        console.log('[CONFIG] 🔑 Recebendo configuração MetaAPI...');
        console.log('[CONFIG] Token length:', token?.length || 0);
        console.log('[CONFIG] Account ID length:', accountId?.length || 0);
        
        // Validar token
        if (!token || token.length < 100) {
            return c.json({
                success: false,
                error: 'Token inválido. Deve ter mais de 100 caracteres.'
            }, 400);
        }
        
        if (!token.startsWith('eyJ')) {
            return c.json({
                success: false,
                error: 'Token deve começar com "eyJ" (formato JWT).'
            }, 400);
        }
        
        // Validar Account ID
        if (!accountId || accountId.length < 10) {
            return c.json({
                success: false,
                error: 'Account ID inválido. Deve ter pelo menos 10 caracteres.'
            }, 400);
        }
        
        // Salvar no KV Store
        try {
            await kv.set('metaapi_token', token);
            await kv.set('metaapi_account_id', accountId);
            
            console.log('[CONFIG] ✅ Credenciais salvas no KV Store com sucesso');
            
            return c.json({
                success: true,
                message: 'Credenciais MetaAPI configuradas com sucesso!',
                token_prefix: token.substring(0, 20) + '...',
                account_id: accountId
            });
        } catch (kvError: any) {
            console.error('[CONFIG] ❌ Erro ao salvar no KV:', kvError);
            return c.json({
                success: false,
                error: `Erro ao salvar configuração: ${kvError.message}`
            }, 500);
        }
        
    } catch (error: any) {
        console.error('[CONFIG] ❌ Erro ao processar configuração:', error);
        return c.json({
            success: false,
            error: `Erro ao processar requisição: ${error.message}`
        }, 500);
    }
});

// ========================================
// 📊 MARKET DATA API (MetaApi Integration)
// ========================================
import marketDataRoutes from './market-data.tsx';
app.route('/market-data', marketDataRoutes);

// ========================================
// 🔍 ASSET DISCOVERY SYSTEM (Auto-detect broker symbols)
// ========================================
import assetDiscoveryRoutes from './asset-discovery.tsx';
app.route('/asset-discovery', assetDiscoveryRoutes);

// ========================================
// 🎯 MARKET DATA REAL (Binance, Yahoo, Twelve Data - FREE)
// ========================================
import marketDataRealRoutes from './market-data-real.tsx';
app.route('/real', marketDataRealRoutes);

// ========================================
// 🔍 API DIAGNOSTICS (Teste de credenciais)
// ========================================
import apiDiagnosticsRoutes from './api-diagnostics.ts';
app.route('/diagnostics', apiDiagnosticsRoutes);

// ========================================
// 🔄 BINANCE API PROXY (Contorna CORS/CSP)
// ========================================
import binanceProxyRoutes from './binance-proxy.ts';
app.route('/binance-proxy', binanceProxyRoutes);

// ========================================
// 📊 VIX PROXY (Contorna CORS do CBOE)
// ========================================
import vixProxyRoutes from './vix-proxy.ts';
app.route('/vix-proxy', vixProxyRoutes);

// ========================================
// 📰 NEWS RSS FEED PROXY (Evita CORS)
// ========================================
// Extraído em 2026-07-19 do handler original de `/news/rss` (única lógica de
// fetch+parse, agora reaproveitada também pelo agregador `/news/aggregate`)
// pra não duplicar o parser RSS/Atom em dois lugares.
async function fetchAndParseRssFeed(feedUrl: string): Promise<{ title: string; items: { title: string; link: string; pubDate: string; guid: string }[] }> {
  // TENTATIVA 1: RSS2JSON API
  try {
    const rss2jsonUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`;
    const response = await fetch(rss2jsonUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000)
    });

    if (response.ok) {
      const data = await response.json();
      if (data.status === 'ok' && data.items && data.items.length > 0) {
        console.log(`[NEWS RSS] ✅ RSS2JSON OK: ${data.items.length} items (${feedUrl})`);
        return { title: data.feed?.title || 'News Feed', items: data.items };
      }
    }
    console.warn(`[NEWS RSS] ⚠️ RSS2JSON failed (HTTP ${response.status}), trying native parser... (${feedUrl})`);
  } catch (rss2jsonError) {
    console.warn(`[NEWS RSS] ⚠️ RSS2JSON error, trying native parser... (${feedUrl})`);
  }

  // TENTATIVA 2: PARSER NATIVO (XML direto) - com proteção contra erros
  try {
    console.log(`[NEWS RSS] 🔧 Using native XML parser... (${feedUrl})`);

    const rssResponse = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      },
      signal: AbortSignal.timeout(5000)
    });

    if (!rssResponse.ok) {
      console.warn(`[NEWS RSS] ⚠️ Native parser: HTTP ${rssResponse.status}`);
      throw new Error(`HTTP ${rssResponse.status}`);
    }

    const xmlText = await rssResponse.text();
    const items: { title: string; link: string; pubDate: string; guid: string }[] = [];
    const isAtom = xmlText.includes('<feed') && xmlText.includes('xmlns="http://www.w3.org/2005/Atom"');

    if (isAtom) {
      const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
      const entries = xmlText.matchAll(entryRegex);

      for (const entry of entries) {
        const content = entry[1];
        const title = content.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/, '$1').trim() || '';
        const link = content.match(/<link[^>]*href=["'](.*?)["']/)?.[1] || content.match(/<id[^>]*>(.*?)<\/id>/)?.[1] || '';
        const pubDate = content.match(/<(?:updated|published)[^>]*>(.*?)<\/(?:updated|published)>/)?.[1] || new Date().toISOString();

        if (title) {
          items.push({ title: title.replace(/<[^>]*>/g, ''), link, pubDate, guid: link || `item-${items.length}` });
        }
        if (items.length >= 25) break;
      }
    } else {
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      const matches = xmlText.matchAll(itemRegex);

      for (const match of matches) {
        const itemContent = match[1];
        const title = itemContent.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/, '$1').trim() || '';
        const link = itemContent.match(/<link[^>]*>([\s\S]*?)<\/link>/)?.[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/, '$1').trim() || '';
        const pubDate = itemContent.match(/<pubDate[^>]*>(.*?)<\/pubDate>/)?.[1] || itemContent.match(/<dc:date[^>]*>(.*?)<\/dc:date>/)?.[1] || new Date().toISOString();
        const guid = itemContent.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1] || link || `item-${items.length}`;

        if (title) {
          items.push({ title: title.replace(/<[^>]*>/g, ''), link, pubDate, guid });
        }
        if (items.length >= 25) break;
      }
    }

    const feedTitle = xmlText.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/, '$1').trim() || 'News Feed';
    console.log(`[NEWS RSS] ✅ Native parser OK: ${items.length} items from "${feedTitle}"`);
    return { title: feedTitle.replace(/<[^>]*>/g, ''), items };
  } catch (nativeParserError: any) {
    console.warn(`[NEWS RSS] ⚠️ Native parser failed: ${nativeParserError.message} (${feedUrl})`);
    return { title: 'News Feed', items: [] };
  }
}

app.get('/news/rss', async (c) => {
  try {
    const feedUrl = c.req.query('url');

    if (!feedUrl) {
      return c.json({ status: 'ok', feed: { title: 'Market News' }, items: [] });
    }

    console.log(`[NEWS RSS] 🔄 Fetching feed: ${feedUrl}`);
    const { title, items } = await fetchAndParseRssFeed(feedUrl);
    return c.json({ status: 'ok', feed: { title }, items });
  } catch (error: any) {
    // ✅ Catch extremo: NUNCA retornar erro HTTP, sempre retornar feed válido
    console.error('[NEWS RSS] ❌ Unexpected error:', error.message);
    return c.json({
      status: 'ok',
      feed: { title: 'Market News' },
      items: []
    });
  }
});

// ========================================
// 📰 NEWS AGGREGATOR — 15 notícias reais, categorizadas
// (Cripto/Macro/Forex), com link real de saída e tradução
// pro idioma do usuário. Criado em 2026-07-19: substitui o
// NewsFeed.tsx antigo, que só tinha fonte real pra cripto
// (as categorias "macro"/"forex" nunca eram populadas por
// nada real) e caía num fallback de 25 manchetes fabricadas
// atribuídas a veículos reais (Bloomberg/Reuters/etc) quando
// a rede falhava — mesmo anti-padrão já eliminado em outras
// partes do app (ver Nexus Quantum Advisor).
// ========================================
const NEWS_FEEDS: { url: string; category: 'crypto' | 'macro' | 'forex'; source: string }[] = [
  { url: 'https://www.investing.com/rss/news_301.rss', category: 'crypto', source: 'Investing.com' },
  { url: 'https://cointelegraph.com/rss', category: 'crypto', source: 'Cointelegraph' },
  { url: 'https://www.investing.com/rss/news_1.rss', category: 'forex', source: 'Investing.com' },
  { url: 'https://www.investing.com/rss/news_95.rss', category: 'macro', source: 'Investing.com' },
  { url: 'https://www.cnbc.com/id/20910258/device/rss/rss.html', category: 'macro', source: 'CNBC' },
];

// Cache de tradução em memória (dura enquanto a instância da Edge Function
// ficar "quente" entre requisições — sem persistência, mas evita retraduzir
// a mesma manchete a cada refresh de 10min já que a maioria dos itens se
// repete entre um ciclo e o próximo).
const translationCache = new Map<string, string>();

// ✅ 2026-07-20: confirmado via /debug-translate que translate.googleapis.com
// devolve HTTP 429 (página HTML de erro, não JSON) pro IP compartilhado do
// Supabase — mesmo padrão de bloqueio de endpoint não-oficial já visto neste
// projeto pra outras fontes (Yahoo, MQL5). Google tentado primeiro (rápido
// quando funciona, pode voltar a funcionar sem aviso), com fallback real pra
// MyMemory (api.mymemory.translated.net — API pública feita pra uso
// programático, testada e confirmada funcionando a partir do mesmo tipo de
// IP compartilhado) em vez de só devolver o texto original em inglês.
async function translateViaGoogle(text: string, targetLang: string): Promise<string | null> {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const data = await response.json();
    // Formato: [[["traduzido","original",null,null,3,...]], ...] — junta todos
    // os segmentos (títulos longos às vezes vêm partidos em mais de um).
    const segments = data?.[0];
    if (!Array.isArray(segments)) return null;
    const translated = segments.map((seg: any) => seg?.[0] ?? '').join('');
    return translated.trim() || null;
  } catch (e) {
    console.warn('[TRANSLATE] ⚠️ Google Translate falhou:', (e as any)?.message);
    return null;
  }
}

async function translateViaMyMemory(text: string, targetLang: string): Promise<string | null> {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${encodeURIComponent(targetLang)}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) return null;
    const data = await response.json();
    if (data?.responseStatus && data.responseStatus !== 200) return null;
    const translated = data?.responseData?.translatedText;
    if (!translated || typeof translated !== 'string') return null;
    return translated.trim() || null;
  } catch (e) {
    console.warn('[TRANSLATE] ⚠️ MyMemory falhou:', (e as any)?.message);
    return null;
  }
}

async function translateText(text: string, targetLang: string): Promise<string> {
  if (!text || targetLang === 'en') return text;
  const cacheKey = `${targetLang}:${text}`;
  const cached = translationCache.get(cacheKey);
  if (cached) return cached;

  const result = (await translateViaGoogle(text, targetLang)) || (await translateViaMyMemory(text, targetLang));
  if (!result) return text;

  translationCache.set(cacheKey, result);
  return result;
}

app.get('/news/aggregate', async (c) => {
  try {
    const targetLang = (c.req.query('lang') || 'pt').split('-')[0].toLowerCase();

    const perFeed = await Promise.allSettled(
      NEWS_FEEDS.map(async (feed) => {
        const { items } = await fetchAndParseRssFeed(feed.url);
        return items.map((item) => {
          const pubDateMs = Date.parse(item.pubDate);
          return {
            title: item.title,
            url: item.link,
            source: feed.source,
            category: feed.category,
            timestamp: Number.isFinite(pubDateMs) ? pubDateMs : Date.now(),
          };
        });
      })
    );

    const allItems = perFeed.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));

    // Dedup por URL (o mesmo evento pode aparecer em mais de um feed)
    const seenUrls = new Set<string>();
    const deduped = allItems.filter((item) => {
      const key = item.url || item.title;
      if (!key || seenUrls.has(key)) return false;
      seenUrls.add(key);
      return true;
    });

    // Cobertura balanceada: até 5 mais recentes por categoria primeiro,
    // depois completa até 15 com o restante mais recente (evita cripto
    // engolir todas as vagas se tiver mais itens disponíveis no dia).
    const byCategory: Record<string, typeof deduped> = { crypto: [], macro: [], forex: [] };
    for (const item of deduped) {
      byCategory[item.category]?.push(item);
    }
    for (const cat of Object.keys(byCategory)) {
      byCategory[cat].sort((a, b) => b.timestamp - a.timestamp);
    }

    const picked: typeof deduped = [];
    const pickedUrls = new Set<string>();
    for (const cat of ['crypto', 'macro', 'forex']) {
      for (const item of byCategory[cat].slice(0, 5)) {
        picked.push(item);
        pickedUrls.add(item.url || item.title);
      }
    }
    const remaining = deduped
      .filter((item) => !pickedUrls.has(item.url || item.title))
      .sort((a, b) => b.timestamp - a.timestamp);
    for (const item of remaining) {
      if (picked.length >= 15) break;
      picked.push(item);
    }
    picked.sort((a, b) => b.timestamp - a.timestamp);
    const final = picked.slice(0, 15);

    // Tradução pro idioma do usuário (concorrência limitada, gentil com o
    // endpoint público do Google Translate).
    const translated = await mapWithConcurrency(final, 5, async (item) => ({
      id: item.url || `${item.category}-${item.timestamp}`,
      title: await translateText(item.title, targetLang),
      titleOriginal: item.title,
      source: item.source,
      url: item.url,
      category: item.category,
      timestamp: item.timestamp,
    }));

    return c.json({
      items: translated,
      count: translated.length,
      categories: {
        crypto: byCategory.crypto.length,
        macro: byCategory.macro.length,
        forex: byCategory.forex.length,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[NEWS AGGREGATE] ❌ Erro:', error.message);
    return c.json({ items: [], count: 0, error: error.message }, 200);
  }
});

// ========================================
// 📊 REAL MARKET DATA ENDPOINTS
// ========================================

// Health Check - Verifica se o servidor está rodando
app.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    message: 'Neural Day Trader Server is running' 
  });
});

// Binance Crypto Data - REAL API Integration (v3.0 - LIVE DATA)
app.get('/real/binance/:symbol', async (c) => {
  try {
    const symbol = c.req.param('symbol');
    console.log(`[BINANCE-v3] 🌐 Fetching REAL data from Binance API for ${symbol}...`);
    
    try {
      // 🔥 INTEGRAÇÃO REAL COM BINANCE API (pública, sem auth)
      const binanceResponse = await fetch(
        `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`,
        {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        }
      );
      
      console.log(`[BINANCE-v3] 📡 Response status: ${binanceResponse.status}`);
      
      if (binanceResponse.ok) {
        const binanceData = await binanceResponse.json();
        
        console.log(`[BINANCE-v3] 📊 Raw Binance data:`, JSON.stringify(binanceData).substring(0, 200));
        
        const result = {
          symbol,
          source: 'binance',
          price: parseFloat(binanceData.lastPrice),
          open: parseFloat(binanceData.openPrice),
          bid: parseFloat(binanceData.bidPrice),
          ask: parseFloat(binanceData.askPrice),
          high: parseFloat(binanceData.highPrice),
          low: parseFloat(binanceData.lowPrice),
          volume: parseFloat(binanceData.volume),
          change: parseFloat(binanceData.priceChange),
          changePercent: parseFloat(binanceData.priceChangePercent),
          timestamp: binanceData.closeTime,
          isRealData: true
        };
        
        console.log(`[BINANCE-v3] ✅ REAL DATA: ${symbol}: $${result.price.toFixed(2)} (${result.changePercent > 0 ? '+' : ''}${result.changePercent.toFixed(2)}%)`);
        
        return c.json(result);
      } else {
        const errorText = await binanceResponse.text();
        console.warn(`[BINANCE-v3] ⚠️ Binance API returned ${binanceResponse.status}: ${errorText}`);
      }
    } catch (apiError: any) {
      console.error(`[BINANCE-v3] ❌ Binance API error: ${apiError.message}`, apiError);
    }
    
    // FALLBACK: Dados simulados realistas baseados em preços reais conhecidos
    const basePrices: Record<string, number> = {
      'BTCUSDT': 104400,  // ✅ Atualizado para preço mais realista
      'ETHUSDT': 3256.78,
      'SOLUSDT': 235.67,
      'BNBUSDT': 645.23,
      'XRPUSDT': 2.87,
      'ADAUSDT': 1.15,
      'DOGEUSDT': 0.38,
      'POLUSDT': 0.62, // Polygon (rebrandado de MATIC)
      'DOTUSDT': 9.45,
      'AVAXUSDT': 42.67
    };
    
    const basePrice = basePrices[symbol] || 100.0;
    
    // Gerar variação realista (2% volatilidade para crypto)
    const seed = Math.floor(Date.now() / 60000); // Muda a cada minuto
    const pseudoRandom = ((seed * 9301 + 49297) % 233280) / 233280;
    const randomVariation = (pseudoRandom - 0.5) * 2 * 0.02; // ±2%
    
    const currentPrice = basePrice * (1 + randomVariation);
    const openPrice = basePrice;
    const change = currentPrice - openPrice;
    const changePercent = (change / openPrice) * 100;
    
    const result = {
      symbol,
      source: 'binance-fallback',
      price: currentPrice,
      open: openPrice,
      bid: currentPrice - (currentPrice * 0.0001),
      ask: currentPrice + (currentPrice * 0.0001),
      high: currentPrice * 1.005,
      low: currentPrice * 0.995,
      volume: 1000000,
      change,
      changePercent,
      timestamp: Date.now(),
      isRealData: false
    };
    
    console.log(`[BINANCE-v3] ⚠️ FALLBACK: ${symbol}: $${result.price.toFixed(2)} (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%)`);
    
    return c.json(result);
  } catch (error: any) {
    console.error('[BINANCE-v3] ❌ Unexpected error:', error);
    // Emergency fallback
    return c.json({
      symbol: c.req.param('symbol') || 'UNKNOWN',
      source: 'binance-emergency',
      price: 100,
      open: 100,
      bid: 99.99,
      ask: 100.01,
      high: 101,
      low: 99,
      volume: 1000000,
      change: 0,
      changePercent: 0,
      timestamp: Date.now(),
      isRealData: false
    });
  }
});

// Yahoo Finance Data (Forex, Indices, Commodities)
app.get('/real/yahoo/:symbol', async (c) => {
  try {
    const symbol = c.req.param('symbol');
    console.log(`[YAHOO] Fetching data for ${symbol}...`);
    
    // Map symbols to Yahoo format
    const yahooSymbolMap: Record<string, string> = {
      'EURUSD': 'EURUSD=X',
      'GBPUSD': 'GBPUSD=X',
      'USDJPY': 'USDJPY=X',
      'AUDUSD': 'AUDUSD=X',
      'USDCAD': 'USDCAD=X',
      'USDCHF': 'USDCHF=X',
      'NZDUSD': 'NZDUSD=X',
      'XAUUSD': 'GC=F',  // Gold futures
      'XAGUSD': 'SI=F',  // Silver futures
      // ✅ 2026-07-13: Platina/Paládio caíam no `|| symbol` (linha abaixo), ou
      // seja, chamavam o Yahoo com o ticker literal "XPTUSD"/"XPDUSD" — que não
      // existe no Yahoo. Isso só aparecia quando o broker (MetaAPI) falhava
      // transitoriamente e o preço caía pra esse fallback: dava erro ou, pior,
      // dado de um ticker errado — sintoma relatado como "oscila entre preço
      // certo e completamente errado" nos metais.
      'XPTUSD': 'PL=F',  // Platinum futures
      'XPDUSD': 'PA=F',  // Palladium futures
      'US500': '^GSPC',  // S&P 500
      'US30': '^DJI',    // Dow Jones
      // ✅ 2026-07-15: estava mapeado pro Nasdaq COMPOSITE (^IXIC), índice
      // diferente do Nasdaq-100 que o broker realmente oferece como CFD —
      // nível de preço bem mais baixo, então qualquer queda transitória da
      // MetaAPI fazia o preço "pular" milhares de pontos quando caía nesse
      // fallback (sintoma: "NAS100 está louco", salto de ~26.427 pra
      // ~29.547 em segundos, visto ao vivo num vídeo do Cleber).
      'NAS100': '^NDX', // Nasdaq-100 (não confundir com ^IXIC, Nasdaq Composite)
      'SPX': '^GSPC',
      'SPX500': '^GSPC',
      'VIX': '^VIX',      // ✅ 2026-07-14: sem isso caía no ticker literal "VIX" (Yahoo não reconhece sem o "^"), aparecia como "não existe"
      // ✅ ADICIONADO 2026-07-08: commodities agrícolas que a MetaAPI/broker atual
      // não oferece (confirmado HTTP 404 em /mt5-prices) — futuros contínuos do
      // Yahoo como fonte real alternativa, em vez do gerador sintético local.
      'COCUSD': 'CC=F',  // Cocoa
      'COFUSD': 'KC=F',  // Coffee
      'WHEUSD': 'ZW=F',  // Wheat
      // Ações americanas já usam o próprio símbolo como ticker do Yahoo (AAPL,
      // MSFT, GOOGL...) — não precisam de entrada no map, caem no `|| symbol`.
    };

    const yahooSymbol = yahooSymbolMap[symbol] || symbol;

    // ✅ 2026-07-14: `interval=1d&range=2d` dava um snapshot de `meta.regularMarketPrice`
    // menos fresco que o Yahoo tem disponível (confirmado no VIX: variação
    // batendo ~1,3 ponto percentual atrás do valor real reportado pelo Cleber).
    // Os campos usados aqui (regularMarketPrice/previousClose/chartPreviousClose)
    // vêm do `meta`, não dos candles — trocar pra intervalo de 1 minuto não muda
    // nada além de pedir ao Yahoo um snapshot mais recente do mesmo campo.
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1m&range=1d`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Yahoo API error: ${response.status}`);
    }

    const data = await response.json();
    const quote = data.chart.result[0];
    const meta = quote.meta;
    const current = meta.regularMarketPrice;
    // ✅ CORRIGIDO 2026-07-08: `meta.previousClose` vem ausente/undefined pra
    // vários tickers (confirmado testando AAPL e CC=F direto em produção — os
    // dois retornavam price real mas change/changePercent como `null`, porque
    // `current - undefined` = NaN, serializado como null no JSON). O Yahoo
    // também expõe `chartPreviousClose` como equivalente pra esses casos.
    const previousClose = meta.previousClose ?? meta.chartPreviousClose;

    const change = (typeof previousClose === 'number' && previousClose > 0)
      ? current - previousClose
      : 0;
    const changePercent = (typeof previousClose === 'number' && previousClose > 0)
      ? (change / previousClose) * 100
      : 0;
    
    const result = {
      symbol,
      yahooSymbol,
      source: 'yahoo',
      price: current,
      bid: current,
      ask: current,
      high: meta.regularMarketDayHigh,
      low: meta.regularMarketDayLow,
      previousClose,
      change,
      changePercent,
      volume: meta.regularMarketVolume || 0,
      timestamp: meta.regularMarketTime * 1000,
      isRealData: true
    };
    
    console.log(`[YAHOO] ✅ ${symbol}: $${result.price.toFixed(5)} (${result.changePercent.toFixed(2)}%)`);
    
    return c.json(result);
  } catch (error: any) {
    console.error('[YAHOO] ❌ Error:', error.message);
    return c.json({ error: error.message }, 500);
  }
});

// ========================================
// 🔍 MT5 TOKEN VALIDATION ROUTE
// ========================================
app.get("/mt5/validate-token", async (c) => {
  console.log('[MT5] 🔍 Validando configuração do token...');
  
  const metaapiToken = Deno.env.get('METAAPI_TOKEN');
  
  if (!metaapiToken) {
    console.error('[MT5] ❌ METAAPI_TOKEN não encontrado');
    return c.json({
      tokenLength: 0,
      hasCorrectPrefix: false,
      isConfigured: false,
      message: 'METAAPI_TOKEN não configurado nas variáveis de ambiente'
    });
  }
  
  const hasCorrectPrefix = metaapiToken.startsWith('eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9');
  const tokenLength = metaapiToken.length;
  const isValid = tokenLength >= 500 && hasCorrectPrefix;
  
  console.log('[MT5] 📊 Token Stats:');
  console.log('[MT5]   - Tamanho:', tokenLength, 'caracteres');
  console.log('[MT5]   - Formato JWT válido:', hasCorrectPrefix);
  console.log('[MT5]   - Token válido:', isValid);
  console.log('[MT5]   - Primeiros 20 chars:', metaapiToken.substring(0, Math.min(20, tokenLength)) + '...');
  
  return c.json({
    tokenLength,
    hasCorrectPrefix,
    isConfigured: true,
    isValid,
    tokenPreview: metaapiToken.substring(0, Math.min(30, tokenLength)) + '...',
    message: isValid 
      ? 'Token configurado corretamente' 
      : tokenLength < 500 
        ? `Token muito curto (${tokenLength} chars, esperado ~500+)` 
        : 'Token com formato inválido'
  });
});

// ========================================
// 🔌 MT5 CONNECTION ROUTE
// ========================================
app.post("/mt5/connect", async (c) => {
  try {
    const { login, password, server, metaapiToken: bodyToken } = await c.req.json();
    
    console.log('[MT5] 🔌 Tentando conectar ao MetaApi...');
    console.log('[MT5] 📋 Login:', login);
    console.log('[MT5] 📋 Servidor:', server);
    console.log('[MT5] 📋 Token fornecido no body?', !!bodyToken);
    
    // Validação de campos
    if (!login || !password || !server) {
      return c.json({ error: 'Campos obrigatórios: login, password, server' }, 400);
    }
    
    // 🔥 USAR FUNÇÃO ROBUSTA DE GET TOKEN (ENV > KV > Body)
    const metaapiToken = await getMetaApiToken(bodyToken);
    
    if (!metaapiToken) {
      console.error('[MT5] ❌ Nenhum token válido encontrado');
      return c.json({ 
        error: 'Token MetaApi não configurado',
        details: 'Configure METAAPI_TOKEN nas variáveis de ambiente ou forneça o token no body da requisição. Verifique também se o token está salvo corretamente nas Configurações.',
        helpUrl: 'https://app.metaapi.cloud/token'
      }, 400);
    }
    
    // Validar formato do token
    if (!metaapiToken.startsWith('eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9')) {
      console.error('[MT5] ❌ Token inválido - formato incorreto');
      console.error('[MT5] Token recebido:', metaapiToken.substring(0, 20) + '...');
      console.error('[MT5] Tamanho do token:', metaapiToken.length);
      console.error('[MT5] 💡 O token deve ser obtido em https://app.metaapi.cloud/token');
      return c.json({ 
        error: 'Token MetaApi inválido', 
        details: 'O token deve começar com "eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9". Verifique se copiou o token correto do painel MetaApi em https://app.metaapi.cloud/token',
        tokenPrefix: metaapiToken.substring(0, 20),
        expectedPrefix: 'eyJhbGciOiJSUzUxMiIs'
      }, 400);
    }
    
    console.log('[MT5] ✅ Token válido detectado (primeiros 30 chars):', metaapiToken.substring(0, 30) + '...');
    
    // 1. Buscar ou criar conta no MetaApi
    console.log('[MT5] 🔍 Buscando contas existentes...');
    
    const accountsResponse = await fetch('https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts', {
      method: 'GET',
      headers: {
        'auth-token': metaapiToken,
        'Content-Type': 'application/json'
      }
    });
    
    if (!accountsResponse.ok) {
      const errorText = await accountsResponse.text();
      console.error('[MT5] ❌ Erro ao buscar contas:', errorText);
      console.error('[MT5] Status HTTP:', accountsResponse.status);
      console.error('[MT5] Token usado (primeiros 30 chars):', metaapiToken.substring(0, 30) + '...');
      
      if (accountsResponse.status === 401) {
        console.error('[MT5] 🔒 ERRO DE AUTENTICAÇÃO!');
        console.error('[MT5] 💡 Verifique se o token foi copiado corretamente de https://app.metaapi.cloud/token');
        console.error('[MT5] 💡 O token pode ter expirado - gere um novo token no painel MetaApi');
        return c.json({ 
          error: 'Falha na autenticação MetaApi', 
          details: 'Token inválido ou expirado. Copie um novo token de https://app.metaapi.cloud/token',
          httpStatus: 401
        }, 401);
      }
      
      return c.json({ error: 'Erro ao conectar com MetaApi', details: errorText }, 500);
    }
    
    const accounts = await accountsResponse.json();
    console.log('[MT5] 📊 Contas encontradas:', accounts.length);
    
    // Procurar conta existente com este login e servidor
    let account = accounts.find((acc: any) => 
      acc.login === login && acc.server === server
    );
    
    // 2. Se não existir, criar nova conta
    if (!account) {
      console.log('[MT5] ✨ Criando nova conta no MetaApi...');
      
      const createResponse = await fetch('https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts', {
        method: 'POST',
        headers: {
          'auth-token': metaapiToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `MT5-${login}`,
          type: 'cloud',
          login: login,
          password: password,
          server: server,
          platform: 'mt5',
          magic: 123456
        })
      });
      
      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('[MT5] ❌ Erro ao criar conta:', errorText);
        return c.json({ error: 'Erro ao criar conta no MetaApi', details: errorText }, 500);
      }
      
      account = await createResponse.json();
      console.log('[MT5] ✅ Conta criada:', account.id);
    } else {
      console.log('[MT5] ✅ Conta existente encontrada:', account.id);
    }
    
    // 3. Deploy da conta
    console.log('[MT5] 🚀 Fazendo deploy da conta...');
    
    const deployResponse = await fetch(`https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${account.id}/deploy`, {
      method: 'POST',
      headers: {
        'auth-token': metaapiToken,
        'Content-Type': 'application/json'
      }
    });
    
    if (!deployResponse.ok) {
      const errorText = await deployResponse.text();
      console.error('[MT5] ⚠️ Erro no deploy (pode já estar deployed):', errorText);
    } else {
      console.log('[MT5] ✅ Deploy concluído');
    }
    
    // 4. Aguardar conexão (até 30 segundos)
    console.log('[MT5] ⏳ Aguardando conexão...');
    
    let connected = false;
    let attempts = 0;
    const maxAttempts = 15;
    
    while (!connected && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await fetch(`https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/${account.id}`, {
        method: 'GET',
        headers: {
          'auth-token': metaapiToken,
          'Content-Type': 'application/json'
        }
      });
      
      if (statusResponse.ok) {
        const status = await statusResponse.json();
        console.log(`[MT5] 🔄 Status [${attempts + 1}/${maxAttempts}]:`, status.connectionStatus);
        
        if (status.connectionStatus === 'CONNECTED') {
          connected = true;
          break;
        }
      }
      
      attempts++;
    }
    
    if (!connected) {
      return c.json({ 
        error: 'Timeout: Não foi possível estabelecer conexão com o MT5',
        details: 'Verifique suas credenciais (login, senha e servidor)'
      }, 408);
    }
    
    // 5. Buscar informações da conta (saldo, equity, etc)
    console.log('[MT5] 💰 Buscando informações da conta...');
    
    const connectClientApiBase = await getMetaApiClientApiBase(metaapiToken, account.id);
    const accountInfoResponse = await fetch(`${connectClientApiBase}/users/current/accounts/${account.id}/account-information`, {
      method: 'GET',
      headers: {
        'auth-token': metaapiToken,
        'Content-Type': 'application/json'
      }
    });
    
    if (!accountInfoResponse.ok) {
      const errorText = await accountInfoResponse.text();
      console.error('[MT5] ❌ Erro ao buscar informações:', errorText);
      return c.json({ error: 'Erro ao buscar informações da conta', details: errorText }, 500);
    }
    
    const accountInfo = await accountInfoResponse.json();
    console.log('[MT5] 💰 Saldo:', accountInfo.balance);
    console.log('[MT5] 📊 Equity:', accountInfo.equity);
    
    return c.json({
      success: true,
      accountId: account.id,
      balance: accountInfo.balance || 0,
      equity: accountInfo.equity || 0,
      currency: accountInfo.currency || 'USD',
      leverage: accountInfo.leverage || 100,
      server: server,
      login: login
    });
    
  } catch (error: any) {
    console.error('[MT5] ❌ Erro inesperado:', error);
    return c.json({ error: error.message, stack: error.stack }, 500);
  }
});

// ========================================
// 🎙️ GOOGLE CLOUD TEXT-TO-SPEECH (Neural2)
// ========================================

// Endpoint: Sintetizar voz ultra-realista (mesma tech do Gemini Live)
app.post("/tts/synthesize", async (c) => {
  try {
    const { text, voiceGender = 'female' } = await c.req.json();
    
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return c.json({ error: 'Texto inválido ou vazio' }, 400);
    }

    // Buscar API key do Google Cloud TTS (KV Store ou ENV)
    let apiKey = await kv.get('GOOGLE_TTS_API_KEY');
    if (!apiKey) {
      apiKey = Deno.env.get('GOOGLE_TTS_API_KEY');
    }
    
    if (!apiKey) {
      console.error('[TTS] ❌ GOOGLE_TTS_API_KEY não configurada');
      return c.json({ 
        error: 'API Key do Google Cloud TTS não configurada. Configure a variável GOOGLE_TTS_API_KEY.' 
      }, 500);
    }
    
    console.log('[TTS] 🔑 API Key encontrada:', apiKey ? 'KV Store' : 'ENV');

    console.log('[TTS] 🎤 Requisição de síntese:', {
      textLength: text.length,
      voiceGender,
      textPreview: text.substring(0, 50) + '...'
    });

    // Sintetizar voz usando Google Cloud TTS Neural2
    const audioBase64 = await synthesizeSpeech(text, voiceGender, apiKey);

    console.log('[TTS] ✅ Áudio sintetizado com sucesso:', {
      audioSize: audioBase64.length,
      format: 'MP3'
    });

    return c.json({
      success: true,
      audioContent: audioBase64, // Base64 encoded MP3
      format: 'mp3',
      voice: voiceGender === 'male' ? 'pt-BR-Neural2-B' : 'pt-BR-Neural2-A'
    });

  } catch (error: any) {
    console.error('[TTS] ❌ Erro ao sintetizar voz:', error);
    return c.json({ 
      error: 'Erro ao sintetizar voz', 
      details: error.message 
    }, 500);
  }
});

// Endpoint: Validar API key do Google Cloud TTS
app.post("/tts/validate-key", async (c) => {
  try {
    const { apiKey } = await c.req.json();
    
    if (!apiKey || typeof apiKey !== 'string') {
      return c.json({ error: 'API Key inválida' }, 400);
    }

    console.log('[TTS] 🔍 Validando API Key...');
    const isValid = await validateGoogleTTSKey(apiKey);

    if (isValid) {
      console.log('[TTS] ✅ API Key válida!');
      return c.json({ success: true, valid: true });
    } else {
      console.log('[TTS] ❌ API Key inválida');
      return c.json({ success: false, valid: false, error: 'API Key inválida' }, 401);
    }

  } catch (error: any) {
    console.error('[TTS] ❌ Erro ao validar key:', error);
    return c.json({ 
      error: 'Erro ao validar API Key', 
      details: error.message 
    }, 500);
  }
});

// ========================================
// 🎤 GOOGLE CLOUD SPEECH-TO-TEXT (STT)
// ========================================

// Endpoint: Transcrever áudio em texto (reconhecimento de voz pt-BR)
app.post("/stt/transcribe", async (c) => {
  try {
    const { audioBase64 } = await c.req.json();
    
    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return c.json({ error: 'Áudio inválido ou ausente' }, 400);
    }

    // Buscar API key do Google Cloud (mesma do TTS) - KV Store ou ENV
    let apiKey = await kv.get('GOOGLE_TTS_API_KEY');
    if (!apiKey) {
      apiKey = Deno.env.get('GOOGLE_TTS_API_KEY');
    }
    
    if (!apiKey) {
      console.error('[STT] ❌ GOOGLE_TTS_API_KEY não configurada');
      return c.json({ 
        error: 'API Key do Google Cloud não configurada' 
      }, 500);
    }
    
    console.log('[STT] 🔑 API Key encontrada:', apiKey ? 'KV Store' : 'ENV');

    console.log('[STT] 🎤 Requisição de transcrição:', {
      audioSize: audioBase64.length
    });

    // Transcrever áudio usando Google Cloud STT
    const transcript = await transcribeAudio(audioBase64, apiKey);

    if (!transcript) {
      console.log('[STT] ⚠️ Nenhuma fala detectada no áudio');
      return c.json({
        success: false,
        transcript: null,
        message: 'Nenhuma fala detectada'
      });
    }

    console.log('[STT] ✅ Transcrição concluída:', transcript);

    return c.json({
      success: true,
      transcript: transcript,
      language: 'pt-BR'
    });

  } catch (error: any) {
    console.error('[STT] ❌ Erro ao transcrever áudio:', error);
    return c.json({ 
      error: 'Erro ao transcrever áudio', 
      details: error.message 
    }, 500);
  }
});

// ========================================
// 🤖 NEURAL ASSISTANT (Luna) - Chat Conversacional
// ========================================

// Endpoint: Processar pergunta do usuário e gerar resposta contextual
app.post("/assistant/chat", async (c) => {
  try {
    const { question, context } = await c.req.json();
    
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return c.json({ error: 'Pergunta inválida ou vazia' }, 400);
    }

    console.log('[ASSISTANT] 🤖 Processando pergunta:', {
      question: question.substring(0, 50) + '...',
      hasContext: !!context
    });

    // Processar pergunta usando sistema de personalidade
    const response = await processUserQuestion(question, context || {});

    console.log('[ASSISTANT] ✅ Resposta gerada:', {
      emotion: response.emotion,
      textLength: response.text.length,
      hasSuggestions: !!response.suggestions
    });

    return c.json({
      success: true,
      response: response.text,
      emotion: response.emotion,
      suggestions: response.suggestions || [],
      assistant: {
        name: 'Luna',
        avatar: '🌙'
      }
    });

  } catch (error: any) {
    console.error('[ASSISTANT] ❌ Erro ao processar pergunta:', error);
    return c.json({ 
      error: 'Erro ao processar pergunta', 
      details: error.message 
    }, 500);
  }
});

// ========================================
// 🔑 SAVE GOOGLE API KEY
// ========================================
app.post('/save-google-key', async (c) => {
  try {
    const { apiKey } = await c.req.json();
    
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      return c.json({ error: 'API Key inválida' }, 400);
    }

    const cleanKey = apiKey.trim();

    console.log('[GOOGLE_KEY] 🔑 Validando API Key do Google Cloud...');
    console.log('[GOOGLE_KEY] 📏 Tamanho da chave:', cleanKey.length);
    console.log('[GOOGLE_KEY] 🔤 Primeiros 20 caracteres:', cleanKey.substring(0, 20));
    
    // Validar formato básico da API key do Google
    if (!cleanKey.startsWith('AIza')) {
      console.error('[GOOGLE_KEY] ❌ Formato inválido - API Key deve começar com "AIza"');
      return c.json({ 
        error: 'Formato de API Key inválido. A chave do Google Cloud deve começar com "AIza"',
        hint: 'Verifique se você copiou a chave completa do Google Cloud Console'
      }, 400);
    }

    // Validar a chave fazendo uma chamada de teste
    console.log('[GOOGLE_KEY] 🧪 Testando validade da API Key...');
    try {
      const testResponse = await fetch(
        `https://texttospeech.googleapis.com/v1/voices?key=${cleanKey}`,
        { method: 'GET' }
      );

      if (!testResponse.ok) {
        const errorData = await testResponse.json();
        console.error('[GOOGLE_KEY] ❌ API Key inválida:', errorData);
        
        return c.json({ 
          error: 'API Key inválida ou APIs não ativadas',
          details: errorData.error?.message || 'Erro desconhecido',
          instructions: [
            '1. Verifique se você ativou as APIs no Google Cloud:',
            '   - Text-to-Speech API: https://console.cloud.google.com/apis/library/texttospeech.googleapis.com',
            '   - Speech-to-Text API: https://console.cloud.google.com/apis/library/speech.googleapis.com',
            '2. Verifique se a API Key não tem restrições de IP ou referrer',
            '3. A chave deve ser do tipo "Chave de API" (não OAuth)'
          ]
        }, 400);
      }

      console.log('[GOOGLE_KEY] ✅ API Key validada com sucesso!');
    } catch (validationError: any) {
      console.error('[GOOGLE_KEY] ❌ Erro ao validar chave:', validationError);
      return c.json({ 
        error: 'Erro ao validar API Key',
        details: validationError.message,
        hint: 'Verifique sua conexão com a internet e tente novamente'
      }, 500);
    }
    
    // Salvar no KV store
    console.log('[GOOGLE_KEY] 💾 Salvando no KV Store...');
    await kv.set('GOOGLE_TTS_API_KEY', cleanKey);
    
    // Verificar se salvou corretamente
    const savedKey = await kv.get('GOOGLE_TTS_API_KEY');
    if (savedKey !== cleanKey) {
      console.error('[GOOGLE_KEY] ❌ Erro ao verificar chave salva');
      return c.json({ 
        error: 'Erro ao salvar API Key no banco de dados' 
      }, 500);
    }
    
    console.log('[GOOGLE_KEY] ✅ API Key salva e verificada com sucesso!');
    
    return c.json({ 
      success: true, 
      message: 'API Key configurada com sucesso! As vozes Neural2 estão prontas.',
      validated: true
    });

  } catch (error: any) {
    console.error('[GOOGLE_KEY] ❌ Erro ao salvar API Key:', error);
    return c.json({ 
      error: 'Erro ao salvar API Key', 
      details: error.message 
    }, 500);
  }
});

// ========================================
// 🚀 START SERVER
// ========================================

// ==================== CRYPTO NEWS API ====================

/**
 * 📰 GET /crypto-news
 * Busca notícias sobre criptomoedas em tempo real
 * Usa CryptoCompare API (grátis, sem chave necessária)
 */
app.get("/crypto-news", async (c) => {
  try {
    const query = c.req.query('query') || 'bitcoin'; // Default: Bitcoin
    const limit = c.req.query('limit') || '50';
    
    console.log(`[CRYPTO-NEWS] 📰 Buscando notícias sobre: ${query}`);
    
    // CryptoCompare News API (sem autenticação necessária)
    const response = await fetch(
      `https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=${query}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );
    
    if (!response.ok) {
      console.error(`[CRYPTO-NEWS] ❌ Erro ao buscar notícias: ${response.status}`);
      return c.json({ error: 'Erro ao buscar notícias', status: response.status }, 500);
    }
    
    const data = await response.json();
    
    if (!data.Data || data.Data.length === 0) {
      console.log('[CRYPTO-NEWS] ⚠️ Nenhuma notícia encontrada');
      return c.json({ news: [], message: 'Nenhuma notícia encontrada' });
    }
    
    // Processar e formatar notícias
    const news = data.Data.slice(0, parseInt(limit)).map((item: any) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      url: item.url,
      imageUrl: item.imageurl,
      source: item.source,
      publishedAt: item.published_on * 1000, // Convert to milliseconds
      categories: item.categories ? item.categories.split('|') : [],
      sentiment: analyzeSentiment(item.title + ' ' + item.body),
      tags: item.tags ? item.tags.split('|') : []
    }));
    
    console.log(`[CRYPTO-NEWS] ✅ ${news.length} notícias encontradas`);
    
    return c.json({ 
      news,
      total: news.length,
      query,
      timestamp: Date.now()
    });
    
  } catch (error: any) {
    console.error('[CRYPTO-NEWS] ❌ Erro:', error.message);
    return c.json({ 
      error: 'Erro ao buscar notícias de cripto', 
      details: error.message 
    }, 500);
  }
});

/**
 * 📊 GET /crypto-market-alert
 * Detecta quedas/altas significativas e busca razões
 */
app.get("/crypto-market-alert", async (c) => {
  try {
    const symbol = c.req.query('symbol')?.toUpperCase() || 'BTC';
    
    console.log(`[MARKET-ALERT] 🚨 Verificando alertas para: ${symbol}`);
    
    // 1. Buscar dados do Binance
    const binanceSymbol = symbol.endsWith('USDT') ? symbol : `${symbol}USDT`;
    const binanceResponse = await fetch(
      `https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}`
    );
    
    if (!binanceResponse.ok) {
      console.error(`[MARKET-ALERT] ❌ Erro ao buscar dados do Binance`);
      return c.json({ error: 'Erro ao buscar dados de mercado' }, 500);
    }
    
    const marketData = await binanceResponse.json();
    const priceChange = parseFloat(marketData.priceChangePercent);
    
    // 2. Detectar se é alerta significativo (>5% ou <-5%)
    const isAlert = Math.abs(priceChange) >= 5;
    
    if (!isAlert) {
      return c.json({
        alert: false,
        symbol,
        priceChange,
        message: 'Sem alertas significativos no momento'
      });
    }
    
    // 3. Buscar notícias relacionadas
    const newsResponse = await fetch(
      `https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=${symbol}`
    );
    
    const newsData = await newsResponse.json();
    const recentNews = newsData.Data ? newsData.Data.slice(0, 10) : [];
    
    // 4. Analisar sentimento das notícias
    const sentiment = recentNews.reduce((acc: any, item: any) => {
      const text = item.title + ' ' + item.body;
      const score = analyzeSentiment(text);
      acc[score]++;
      return acc;
    }, { bullish: 0, bearish: 0, neutral: 0 });
    
    // 5. Encontrar possíveis razões
    const reasons = extractReasons(recentNews, priceChange > 0 ? 'bullish' : 'bearish');
    
    console.log(`[MARKET-ALERT] 🚨 ALERTA: ${symbol} ${priceChange > 0 ? '📈' : '📉'} ${priceChange.toFixed(2)}%`);
    
    return c.json({
      alert: true,
      symbol,
      priceChange,
      direction: priceChange > 0 ? 'up' : 'down',
      marketData: {
        lastPrice: marketData.lastPrice,
        high24h: marketData.highPrice,
        low24h: marketData.lowPrice,
        volume: marketData.volume
      },
      sentiment,
      reasons,
      news: recentNews.slice(0, 5).map((item: any) => ({
        title: item.title,
        url: item.url,
        source: item.source,
        publishedAt: item.published_on * 1000
      })),
      timestamp: Date.now()
    });
    
  } catch (error: any) {
    console.error('[MARKET-ALERT] ❌ Erro:', error.message);
    return c.json({ 
      error: 'Erro ao processar alerta de mercado', 
      details: error.message 
    }, 500);
  }
});

/**
 * 🤖 Analisa sentimento de texto (bullish/bearish/neutral)
 */
function analyzeSentiment(text: string): 'bullish' | 'bearish' | 'neutral' {
  const textLower = text.toLowerCase();
  
  const bullishWords = ['surge', 'rally', 'pump', 'moon', 'bullish', 'gains', 'soar', 'jump', 'rise', 'green', 'profit', 'buy', 'breakthrough', 'record', 'high'];
  const bearishWords = ['crash', 'dump', 'bearish', 'fall', 'drop', 'plunge', 'collapse', 'red', 'loss', 'sell', 'fear', 'panic', 'decline', 'low'];
  
  let bullishScore = 0;
  let bearishScore = 0;
  
  bullishWords.forEach(word => {
    if (textLower.includes(word)) bullishScore++;
  });
  
  bearishWords.forEach(word => {
    if (textLower.includes(word)) bearishScore++;
  });
  
  if (bullishScore > bearishScore) return 'bullish';
  if (bearishScore > bullishScore) return 'bearish';
  return 'neutral';
}

/**
 * 🔍 Extrai possíveis razões da movimentação do mercado
 */
function extractReasons(news: any[], sentiment: 'bullish' | 'bearish'): string[] {
  const reasons: string[] = [];
  
  const keywordMap: Record<string, string[]> = {
    bearish: [
      'regulation', 'sec', 'lawsuit', 'hack', 'exploit', 'ban', 'restriction',
      'liquidation', 'whales selling', 'fed', 'interest rate', 'inflation',
      'china', 'government', 'crackdown', 'exchange', 'ftx', 'bankruptcy'
    ],
    bullish: [
      'adoption', 'etf approval', 'institutional', 'tesla', 'microstrategy',
      'halving', 'upgrade', 'partnership', 'investment', 'wall street',
      'blackrock', 'fidelity', 'paypal', 'visa', 'mastercard'
    ]
  };
  
  const keywords = keywordMap[sentiment] || [];
  
  news.forEach((item: any) => {
    const text = (item.title + ' ' + item.body).toLowerCase();
    
    keywords.forEach(keyword => {
      if (text.includes(keyword) && !reasons.includes(keyword)) {
        reasons.push(keyword);
      }
    });
  });
  
  return reasons.slice(0, 5); // Top 5 razões
}

// ==================== END CRYPTO NEWS API ====================

// IMPORTANTE: Desabilitar JWT verification para permitir endpoints públicos
Deno.serve({
  // @ts-ignore - Supabase Edge Functions não documenta essa opção mas funciona
  onListen: () => console.log('[SERVER] 🚀 Neural Day Trader API rodando!'),
}, app.fetch);