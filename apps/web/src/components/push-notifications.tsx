'use client';

import { useEffect, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { apiFetch } from '../lib/api';

const DISMISS_KEY = 'push-banner-dismissed';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(b64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Registers this browser with the API for web push. No-op when push is
 *  disabled server-side (demo) — the public key comes back null. */
async function subscribeToPush(): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  const { key } = await apiFetch<{ key: string | null }>('/push/public-key');
  if (!key) return;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    }));
  const json = sub.toJSON();
  if (!json.keys) return;
  await apiFetch('/push/subscribe', {
    method: 'POST',
    body: JSON.stringify({ endpoint: sub.endpoint, keys: json.keys }),
  });
}

/**
 * Keeps this device registered for call/message push notifications.
 * Permission already granted → silently (re)subscribe on load. Not asked yet →
 * a small dismissible banner; the browser permission prompt must come from a
 * user tap (required on iOS, best practice everywhere).
 */
export function PushNotifications() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      return; // unsupported (e.g. iOS Safari tab that isn't installed)
    }
    if (Notification.permission === 'granted') {
      subscribeToPush().catch(() => {});
    } else if (
      Notification.permission === 'default' &&
      localStorage.getItem(DISMISS_KEY) !== '1'
    ) {
      setShowBanner(true);
    }
  }, []);

  if (!showBanner) return null;

  const enable = async () => {
    setShowBanner(false);
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') await subscribeToPush();
      else localStorage.setItem(DISMISS_KEY, '1');
    } catch {}
  };

  const dismiss = () => {
    setShowBanner(false);
    localStorage.setItem(DISMISS_KEY, '1');
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:w-[360px] z-[140] bg-white border border-surface-200 rounded-xl shadow-overlay p-3 flex items-center gap-3 animate-slide-down mb-[env(safe-area-inset-bottom)]">
      <span className="h-9 w-9 shrink-0 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
        <BellRing size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-content-primary">Never miss a call or message</p>
        <p className="text-xs text-content-tertiary">Get notified even when the app is closed.</p>
      </div>
      <button
        onClick={enable}
        className="shrink-0 h-8 px-3 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700"
      >
        Enable
      </button>
      <button
        onClick={dismiss}
        className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-content-tertiary hover:bg-surface-100"
      >
        <X size={16} />
      </button>
    </div>
  );
}
