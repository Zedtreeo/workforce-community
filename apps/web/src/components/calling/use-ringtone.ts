'use client';

import { useEffect } from 'react';

/**
 * Plays a soft two-tone ring on a repeating interval while `active` is true,
 * using the Web Audio API (no asset needed). Cleans up fully on stop/unmount.
 * Autoplay may be blocked until the user has interacted with the page — in that
 * case it fails silently, which is acceptable for a ringtone.
 */
export function useRingtone(active: boolean) {
  useEffect(() => {
    if (!active) return;

    let ctx: AudioContext | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;
    let stopped = false;

    try {
      const AudioCtx =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      ctx = new AudioCtx();

      const beep = () => {
        if (!ctx || stopped) return;
        const now = ctx.currentTime;
        [880, 660].forEach((freq, i) => {
          const osc = ctx!.createOscillator();
          const gain = ctx!.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          const start = now + i * 0.25;
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(0.15, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
          osc.connect(gain).connect(ctx!.destination);
          osc.start(start);
          osc.stop(start + 0.24);
        });
      };

      void ctx.resume().catch(() => {});
      beep();
      interval = setInterval(beep, 2500);
    } catch {
      // ignore — ringtone is best-effort
    }

    return () => {
      stopped = true;
      if (interval) clearInterval(interval);
      void ctx?.close().catch(() => {});
    };
  }, [active]);
}
