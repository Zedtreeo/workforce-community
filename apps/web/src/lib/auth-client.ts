import { createAuthClient } from 'better-auth/react';
import { emailOTPClient } from 'better-auth/client/plugins';

function getAuthBaseURL(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'demo.zedtreeo.io') return 'https://api-demo.zedtreeo.io';
    if (hostname === 'hrms.zedtreeo.io') return 'https://api-hrms.zedtreeo.io';
  }
  return process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:4000';
}

export const authClient = createAuthClient({
  baseURL: getAuthBaseURL(),
  basePath: '/api/v1/auth',
  plugins: [emailOTPClient()],
});

export const {
  useSession,
  signIn,
  signUp,
  signOut,
  emailOtp,
} = authClient;
