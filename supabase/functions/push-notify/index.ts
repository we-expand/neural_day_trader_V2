/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  PUSH-NOTIFY — avisa o celular quando uma posição REAL é aberta    ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 *
 * Chamada por um trigger de banco (Database Webhook / pg_net) toda vez que
 * uma linha INSERT chega em `ai_trades` com status='OPEN' e
 * is_live_execution=true — nunca em trades DEMO, nunca em fechamento.
 *
 * Body esperado (payload padrão de trigger do Supabase):
 *   { type: 'INSERT', table: 'ai_trades', record: {...} }
 *
 * Busca as inscrições push (`push_subscriptions`) do `user_id` do trade e
 * envia uma notificação real via Web Push (VAPID) pra cada uma. Nunca
 * fabrica dado: se não houver inscrição, só não envia nada, sem erro.
 */
import webpush from 'npm:web-push@3';

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails('mailto:suporte@neuraldaytrader.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

function formatMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error('[push-notify] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY não configuradas.');
    return new Response(JSON.stringify({ error: 'VAPID não configurada' }), { status: 500 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 400 });
  }

  const trade = payload?.record;
  if (!trade?.user_id || !trade?.symbol) {
    return new Response(JSON.stringify({ error: 'payload sem trade válido' }), { status: 400 });
  }

  const { createClient } = await import('npm:@supabase/supabase-js@2');
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: subscriptions, error: subError } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', trade.user_id);

  if (subError) {
    console.error('[push-notify] erro ao buscar inscrições:', subError.message);
    return new Response(JSON.stringify({ error: subError.message }), { status: 500 });
  }
  if (!subscriptions || subscriptions.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'sem inscrição' }), { status: 200 });
  }

  const side = trade.side === 'BUY' || trade.side === 'LONG' ? 'COMPRA' : 'VENDA';
  const notification = {
    title: `Posição aberta: ${trade.symbol}`,
    body: `${side} · Entrada ${formatMoney(trade.entry_price)} · Stop ${formatMoney(trade.stop_loss)} · Alvo ${formatMoney(trade.take_profit)}`,
    tag: `ndt-position-${trade.id}`,
    url: '/?view=ai-trader&pwa=1',
  };

  let sent = 0;
  const staleEndpoints: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub: { endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(notification)
        );
        sent += 1;
      } catch (err: any) {
        // 404/410 = inscrição morta (usuário desinstalou/desativou) — limpa,
        // nunca deixa lixo acumulando na tabela nem alarme falso no log.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          staleEndpoints.push(sub.endpoint);
        } else {
          console.error('[push-notify] falha ao enviar push:', err?.message || err);
        }
      }
    })
  );

  if (staleEndpoints.length > 0) {
    await supabase.from('push_subscriptions').delete().in('endpoint', staleEndpoints);
  }

  return new Response(JSON.stringify({ sent, stale_removed: staleEndpoints.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
