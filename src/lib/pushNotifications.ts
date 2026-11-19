import { supabase } from './supabaseClient';

// Chave pública VAPID — só identifica o servidor pro navegador, não é segredo
// (a privada fica só na secret do Supabase, nunca aqui). Gerada nesta sessão.
const VAPID_PUBLIC_KEY = 'BDhxXtR4dXzCC_bAZIH2r54g2ARcOKEeuPgIaMYanO7cmaaHVlls3S06d46hI0wZM9kW6MEm05SMs3jJVFSGwvs';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

// No iPhone, push só funciona depois que o usuário "Adiciona à Tela de
// Início" pelo Safari (exigência da Apple, iOS 16.4+) — abrir pelo Safari
// normal nunca habilita push, por desenho da Apple, não é bug daqui.
export function isRunningAsInstalledApp(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (window.navigator as any).standalone === true;
  const displayModeStandalone = window.matchMedia('(display-mode: standalone)').matches;
  return iosStandalone || displayModeStandalone;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (e) {
    console.warn('[push] Falha ao registrar service worker', e);
    return null;
  }
}

export async function getPushSubscriptionStatus(): Promise<'unsupported' | 'not-installed' | 'denied' | 'subscribed' | 'not-subscribed'> {
  if (!isPushSupported()) return 'unsupported';
  const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (isIos && !isRunningAsInstalledApp()) return 'not-installed';
  if (Notification.permission === 'denied') return 'denied';

  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'subscribed' : 'not-subscribed';
}

export async function subscribeToPush(userId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isPushSupported()) return { ok: false, error: 'Navegador sem suporte a notificação push.' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, error: 'Permissão de notificação negada.' };
  }

  const reg = (await navigator.serviceWorker.getRegistration()) || (await registerServiceWorker());
  if (!reg) return { ok: false, error: 'Não foi possível registrar o service worker.' };

  const existing = await reg.pushManager.getSubscription();
  const subscription =
    existing ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
    }));

  const raw = subscription.toJSON();
  if (!raw.endpoint || !raw.keys?.p256dh || !raw.keys?.auth) {
    return { ok: false, error: 'Inscrição push incompleta.' };
  }

  if (!supabase) return { ok: false, error: 'Supabase indisponível.' };

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: raw.endpoint,
      p256dh: raw.keys.p256dh,
      auth: raw.keys.auth,
      user_agent: navigator.userAgent,
    },
    { onConflict: 'endpoint' }
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function unsubscribeFromPush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;

  const endpoint = sub.endpoint;
  await sub.unsubscribe();

  if (supabase) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  }
}
