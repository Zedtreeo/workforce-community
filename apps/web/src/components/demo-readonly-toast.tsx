'use client';

import { useEffect, useRef } from 'react';
import { useToast } from './ui/toast';

/**
 * Listens for the `demo-readonly` window event (dispatched by apiFetch when the
 * read-only demo blocks a write) and shows a friendly toast instead of leaving
 * the user with a raw error. Throttled so a burst of blocked requests shows once.
 */
export function DemoReadOnlyToast() {
  const { toast } = useToast();
  const lastShownAt = useRef(0);

  useEffect(() => {
    const handler = (e: Event) => {
      const now = Date.now();
      if (now - lastShownAt.current < 3000) return; // throttle duplicate bursts
      lastShownAt.current = now;
      const detail = (e as CustomEvent).detail as string;
      toast('info', detail || 'This is a read-only demo — your changes were not saved.');
    };
    window.addEventListener('demo-readonly', handler);
    return () => window.removeEventListener('demo-readonly', handler);
  }, [toast]);

  return null;
}
