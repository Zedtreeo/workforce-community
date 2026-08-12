'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from '../lib/auth-client';

const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

export function IdleTimeout() {
  const router = useRouter();
  const { data: session } = useSession();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loggedOutRef = useRef(false);

  const doLogout = useCallback(async () => {
    if (loggedOutRef.current) return;
    loggedOutRef.current = true;
    try {
      await signOut();
    } catch {}
    router.push('/login');
  }, [router]);

  const resetTimer = useCallback(() => {
    if (loggedOutRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(doLogout, IDLE_TIMEOUT_MS);
  }, [doLogout]);

  useEffect(() => {
    if (!session) return;
    resetTimer();
    EVENTS.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      EVENTS.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [session, resetTimer]);

  return null;
}
