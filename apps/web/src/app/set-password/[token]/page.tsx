'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../../lib/api';

interface ResetInfo { email: string; firstName: string; lastName: string; companyName: string; }

export default function SetPasswordPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [info, setInfo] = useState<ResetInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    apiFetch<ResetInfo>(`/onboarding/reset/${token}`)
      .then(setInfo)
      .catch((e) => setLoadError(e.message || 'Invalid or expired reset link'))
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setSubmitting(true);
    try {
      await apiFetch(`/onboarding/reset/${token}`, { method: 'POST', body: JSON.stringify({ password }) });
      setDone(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch (e: any) {
      setError(e.message || 'Could not set password. The link may have expired.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-surface-200 p-8">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="h-9 w-9 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold">H</div>
          <div>
            <p className="text-sm font-bold text-content-primary leading-none">Zedtreeo Workforce</p>
            <p className="text-[11px] text-content-tertiary leading-none mt-0.5">Set your password</p>
          </div>
        </div>

        {loading && <p className="text-sm text-content-tertiary">Validating your link…</p>}

        {!loading && loadError && (
          <div className="space-y-4">
            <div className="rounded-lg bg-danger/10 border border-danger/30 px-4 py-3 text-sm text-danger">{loadError}</div>
            <p className="text-sm text-content-secondary">This password reset link is invalid or has expired. Please ask your administrator to send a new one.</p>
            <Link href="/login" className="text-sm font-medium text-brand-600 hover:text-brand-700">← Back to login</Link>
          </div>
        )}

        {!loading && info && !done && (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm text-content-secondary">
              Hi <strong>{info.firstName} {info.lastName}</strong>, set a new password for <strong>{info.email}</strong>.
            </p>
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-1">New password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password"
                className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                placeholder="At least 8 characters" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-1">Confirm password</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password"
                className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                placeholder="Re-enter password" required />
            </div>
            {error && <div className="rounded-lg bg-danger/10 border border-danger/30 px-4 py-2 text-sm text-danger">{error}</div>}
            <button type="submit" disabled={submitting}
              className="w-full py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-60 transition-colors">
              {submitting ? 'Setting password…' : 'Set password'}
            </button>
          </form>
        )}

        {done && (
          <div className="space-y-3">
            <div className="rounded-lg bg-success/10 border border-success/30 px-4 py-3 text-sm text-success-dark">
              Password set successfully. Redirecting you to login…
            </div>
            <Link href="/login" className="text-sm font-medium text-brand-600 hover:text-brand-700">Go to login now →</Link>
          </div>
        )}
      </div>
    </div>
  );
}
