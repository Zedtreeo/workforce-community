'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, emailOtp } from '../../lib/auth-client';
import { Button } from '../../components/ui';
import { DemoContactBanner } from '../../components/demo-contact-banner';
import { LoginFooter } from '../../components/login-footer';
import { Shield, User, Building2, ArrowLeft } from 'lucide-react';

function useIsDemo() {
  const [isDemo, setIsDemo] = useState(false);
  useEffect(() => {
    setIsDemo(process.env.NEXT_PUBLIC_DEMO === 'true');
  }, []);
  return isDemo;
}

const DEMO_ROLES = [
  {
    key: 'admin',
    label: 'Admin',
    desc: 'Full platform access',
    email: 'demo@demo.com',
    icon: Shield,
    color: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    activeColor: 'bg-indigo-100 border-indigo-500 ring-2 ring-indigo-300',
  },
  {
    key: 'employee',
    label: 'Employee',
    desc: 'Self-service portal',
    email: 'arjun.mehta@demo.com',
    icon: User,
    color: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    activeColor: 'bg-emerald-100 border-emerald-500 ring-2 ring-emerald-300',
  },
  {
    key: 'client',
    label: 'Client',
    desc: 'Client portal view',
    email: 'sarah@acmecorp.com',
    icon: Building2,
    color: 'bg-amber-50 border-amber-200 text-amber-700',
    activeColor: 'bg-amber-100 border-amber-500 ring-2 ring-amber-300',
  },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const isDemo = useIsDemo();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('admin');

  // Demo: selecting a role pre-fills a sample account email (still editable —
  // a visitor can type their own email instead). hrms: nothing pre-filled.
  useEffect(() => {
    if (isDemo && step === 'email') {
      const role = DEMO_ROLES.find((r) => r.key === selectedRole) || DEMO_ROLES[0];
      setEmail(role.email);
    }
  }, [isDemo, selectedRole, step]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');

    // Client portal has its own login page (no OTP here).
    if (isDemo && selectedRole === 'client') {
      router.push('/client-portal');
      return;
    }

    setLoading(true);
    try {
      const res = await emailOtp.sendVerificationOtp({ email, type: 'sign-in' });
      if (res.error) {
        setError(res.error.message || 'Could not send the code. Check the email and try again.');
      } else {
        setStep('otp');
        setOtp('');
        setInfo(`We sent a 6-digit code to ${email}. It expires in 5 minutes.`);
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await signIn.emailOtp({ email, otp });
      if (res.error) {
        setError(res.error.message || 'Invalid or expired code.');
      } else {
        // MEMBER role auto-redirects to /portal via auth-provider
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const resetToEmail = () => {
    setStep('email');
    setOtp('');
    setError('');
    setInfo('');
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-surface-50 via-white to-brand-50/40 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 text-lg font-bold text-white shadow-md">
              Z
            </div>
            <div className="leading-tight">
              <div className="text-lg font-bold text-content-primary">
                Zedtreeo <span className="text-brand-600">Workforce Management</span>
              </div>
            </div>
          </div>
        </div>
        {isDemo && step === 'email' && (
          <div className="mb-4 space-y-3">
            <div className="text-center">
              <p className="text-sm font-semibold text-blue-800 mb-1">Demo Access</p>
              <p className="text-xs text-blue-500">
                Pick a sample account or use your own email &bull; a sign-in code is emailed to you
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {DEMO_ROLES.map((role) => {
                const Icon = role.icon;
                const isActive = selectedRole === role.key;
                return (
                  <button
                    key={role.key}
                    type="button"
                    onClick={() => setSelectedRole(role.key)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all cursor-pointer ${isActive ? role.activeColor : role.color} hover:shadow-sm`}
                  >
                    <Icon size={20} />
                    <span className="text-xs font-semibold">{role.label}</span>
                    <span className="text-[10px] opacity-75">{role.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-content-primary">Sign in</h1>
            <p className="text-sm text-content-tertiary mt-1">
              {isDemo && selectedRole === 'client'
                ? 'Opens the client portal'
                : step === 'email'
                  ? 'Sign in with a one-time email code'
                  : 'Enter the code we emailed you'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-danger-light border border-danger rounded-lg text-danger-dark text-sm">
              {error}
            </div>
          )}
          {info && !error && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
              {info}
            </div>
          )}

          {step === 'email' ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-content-secondary mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full px-4 py-2.5 border border-surface-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition text-content-primary"
                  placeholder="you@company.com"
                />
              </div>

              <Button className="w-full" loading={loading} type="submit">
                {isDemo && selectedRole === 'client' ? 'Open Client Portal' : 'Send sign-in code'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-content-secondary mb-1">
                  6-digit code
                </label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  required
                  autoFocus
                  className="w-full px-4 py-2.5 border border-surface-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition text-content-primary text-center text-2xl tracking-[0.4em] font-mono"
                  placeholder="••••••"
                />
              </div>

              <Button className="w-full" loading={loading} type="submit" disabled={otp.length < 6}>
                Verify &amp; sign in
              </Button>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={resetToEmail}
                  className="inline-flex items-center gap-1 text-content-tertiary hover:text-content-secondary"
                >
                  <ArrowLeft size={12} /> Change email
                </button>
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={loading}
                  className="text-brand-600 hover:text-brand-700 font-medium disabled:opacity-50"
                >
                  Resend code
                </button>
              </div>
            </form>
          )}
        </div>
        <DemoContactBanner variant="login" />
        <LoginFooter />
      </div>
    </main>
  );
}
