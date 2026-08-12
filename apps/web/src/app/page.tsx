'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '../lib/auth-client';

export default function Home() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (!isPending) {
      if (session) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    }
  }, [session, isPending, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-50">
      <p className="text-content-tertiary">Loading...</p>
    </main>
  );
}
