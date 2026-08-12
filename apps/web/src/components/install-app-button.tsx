'use client';

import { useEffect, useState } from 'react';
import { X, MonitorDown, Share, SquarePlus } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Header "Install app" entry point. Chrome/Edge/Android fire
 * `beforeinstallprompt`, so the button triggers the native install dialog.
 * iOS Safari has no install API — there the button opens a short
 * Share → Add to Home Screen walkthrough. Hidden once running installed
 * (standalone) or when the browser offers neither path.
 */
export function InstallAppButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => { setDeferred(null); setIos(false); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!deferred && !ios) return null;

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'accepted') setDeferred(null);
    } else {
      setShowIosHelp(true);
    }
  };

  return (
    <>
      <button
        onClick={install}
        title="Install app"
        className="h-8 rounded-lg flex items-center gap-1.5 px-2 text-content-tertiary hover:bg-surface-100 hover:text-content-secondary transition-colors"
      >
        <MonitorDown size={18} />
        <span className="text-xs font-medium hidden sm:inline">Install app</span>
      </button>

      {showIosHelp && (
        <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowIosHelp(false)} />
          <div className="relative w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-overlay p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] animate-slide-down">
            <button onClick={() => setShowIosHelp(false)} className="absolute top-3 right-3 h-8 w-8 rounded-lg flex items-center justify-center text-content-tertiary hover:bg-surface-100">
              <X size={18} />
            </button>
            <h3 className="text-sm font-semibold text-content-primary mb-3">Install Zedtreeo on your iPhone</h3>
            <ol className="space-y-3 text-sm text-content-secondary">
              <li className="flex items-center gap-3">
                <span className="h-8 w-8 shrink-0 rounded-lg bg-surface-100 flex items-center justify-center"><Share size={16} /></span>
                Tap the <b>Share</b> button in Safari&apos;s toolbar
              </li>
              <li className="flex items-center gap-3">
                <span className="h-8 w-8 shrink-0 rounded-lg bg-surface-100 flex items-center justify-center"><SquarePlus size={16} /></span>
                Choose <b>Add to Home Screen</b>
              </li>
            </ol>
            <p className="text-xs text-content-tertiary mt-4">
              The app opens full-screen from its own icon — chat and calls included.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
