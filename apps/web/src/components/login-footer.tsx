import { ShieldCheck } from 'lucide-react';

const SUPPORT_EMAIL = 'hr@example.com';

/**
 * Footer for the sign-in screen: a security trust line, a support email,
 * legal links, and copyright. Shown on both the hrms portal and the demo.
 */
export function LoginFooter() {
  const dot = <span className="mx-1.5 text-surface-300">·</span>;
  return (
    <footer className="mt-6 space-y-2.5 text-center">
      <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-content-secondary">
        <ShieldCheck size={14} className="text-emerald-600" />
        Secure, passwordless sign-in
      </p>

      <p className="text-xs text-content-tertiary">
        Need help signing in?{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-brand-600 hover:underline">
          {SUPPORT_EMAIL}
        </a>
      </p>

      <p className="text-xs text-content-tertiary">
        <a href="https://zedtreeo.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="hover:text-content-secondary hover:underline">
          Privacy
        </a>
        {dot}
        <a href="https://zedtreeo.com/terms" target="_blank" rel="noopener noreferrer" className="hover:text-content-secondary hover:underline">
          Terms
        </a>
      </p>

      <p className="text-[11px] text-content-tertiary/70">
        © {new Date().getFullYear()} Zedtreeo. All rights reserved.
      </p>
    </footer>
  );
}
