import { createAuthClient } from 'better-auth/react';
import { emailOTPClient } from 'better-auth/client/plugins';

function getAuthBaseURL(): string {
  // Self-host: derived from NEXT_PUBLIC_API_URL (strip the /api/v1 suffix).
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
