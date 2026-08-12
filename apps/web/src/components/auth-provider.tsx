'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from '../lib/auth-client';
import { usePermissions } from '../lib/use-permissions';
import { IdleTimeout } from './idle-timeout';

const publicPaths = ['/login', '/signup'];

const isPublicOnboarding = (path: string) => /^\/onboarding\/[a-f0-9]{64}/.test(path);

const adminRoutes = [
  '/dashboard', '/employees', '/departments', '/clients', '/monitoring',
  '/attendance', '/invoices', '/reports', '/documents',
  '/users', '/audit', '/payroll', '/knowledge-base', '/profile-changes', '/onboarding',
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending } = useSession();
  const { me, loading: meLoading } = usePermissions();
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    setIsDemo(window.location.hostname === 'demo.zedtreeo.io');
  }, []);

  useEffect(() => {
    if (isPending) return;
    if (!session && !publicPaths.includes(pathname) && !isPublicOnboarding(pathname)) {
      router.push('/login');
      return;
    }
  }, [session, isPending, pathname, router]);

  useEffect(() => {
    if (isPending || meLoading || !me || !session) return;
    const role = me.role;
    const isAdminRoute = adminRoutes.some(r => pathname === r || pathname.startsWith(r + '/'));
    const isMember = role === 'MEMBER' || role === 'VIEWER';
    if (isMember && isAdminRoute) {
      router.replace('/portal');
    }
  }, [me, meLoading, isPending, session, pathname, router]);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {isDemo && <IdleTimeout />}
      {children}
    </>
  );
}
