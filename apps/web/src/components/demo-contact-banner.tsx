// apps/web/src/components/demo-contact-banner.tsx
'use client';

import { useEffect, useState } from 'react';
import { Mail, LifeBuoy } from 'lucide-react';

// Shown only when NEXT_PUBLIC_DEMO=true (e.g. a public demo instance).
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'hello@example.com';

interface Props {
  /** "login" for the auth screen, "footer" for inside DashboardLayout. */
  variant?: 'login' | 'footer';
}

export function DemoContactBanner({ variant = 'footer' }: Props) {
  const [isDemo, setIsDemo] = useState(false);
  useEffect(() => {
    setIsDemo(process.env.NEXT_PUBLIC_DEMO === 'true');
  }, []);
  if (!isDemo) return null;

  if (variant === 'login') {
    return (
      <div className="w-full max-w-md mx-auto mt-4">
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-brand-200 bg-brand-50 text-sm shadow-sm">
          <LifeBuoy size={18} className="text-brand-600 mt-0.5 shrink-0" />
          <div className="text-content-secondary leading-snug">
            <p className="font-medium text-content-primary">Need help with the demo?</p>
            <p>
              Email us at{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-700 font-medium hover:underline">
                {SUPPORT_EMAIL}
              </a>{' '}
              and we will get back within one business day.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // footer variant: thin bottom bar inside DashboardLayout
  return (
    <div className="border-t border-surface-200 bg-surface-50 px-4 py-2 text-xs text-content-tertiary flex items-center justify-center gap-2">
      <Mail size={12} />
      <span>Demo environment</span>
      <span className="opacity-60">·</span>
      <span>
        Questions or issues? Contact{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-600 font-medium hover:underline">
          {SUPPORT_EMAIL}
        </a>
      </span>
    </div>
  );
}
