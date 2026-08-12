import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { emailOTP } from 'better-auth/plugins';
import { PrismaClient } from '@prisma/client';
import { sendLoginOtpEmail } from './otp-mailer';

const prisma = new PrismaClient();

const isDemo = process.env.DEMO_MODE === 'true';
const OTP_EXPIRES_MINUTES = 5;

/**
 * Resolve the tenant to attach to an OTP-created user. Only used on the public
 * demo (where open OTP sign-up is allowed). Prefers DEMO_TENANT_ID, else the
 * sole tenant in the demo DB.
 */
async function resolveDemoTenantId(): Promise<string | null> {
  if (process.env.DEMO_TENANT_ID) return process.env.DEMO_TENANT_ID;
  const t = await prisma.tenant.findFirst({ select: { id: true }, orderBy: { createdAt: 'asc' } });
  return t?.id ?? null;
}

const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{}|;':",.<>?/`~])/;

export const auth = betterAuth({
  basePath: '/api/v1/auth',
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  // Password sign-in stays enabled at the API level as a recovery hatch
  // (no UI surfaces it on the hrms portal — login is OTP-only there).
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // SECURITY: sign-IN stays enabled as an admin recovery hatch, but
    // self-registration is OFF. Accounts are only ever provisioned by an admin
    // (onboarding invite / grant-portal-access). Without this, /sign-up/email
    // let any stranger create a logged-in MEMBER on the live tenant.
    disableSignUp: true,
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: OTP_EXPIRES_MINUTES * 60,
      // hrms portal: only existing users may sign in (no open registration).
      // demo: allow anyone to enter their email and get a code (auto-creates a user).
      disableSignUp: !isDemo,
      async sendVerificationOTP({ email, otp }) {
        await sendLoginOtpEmail(email, otp, OTP_EXPIRES_MINUTES);
      },
    }),
  ],
  session: {
    expiresIn: isDemo ? 60 * 10 : 60 * 60 * 24 * 7,
    updateAge: isDemo ? 60 * 4 : 60 * 60 * 24,
  },
  trustedOrigins: [
    'http://localhost:3000',
    ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()) : []),
    ...(process.env.CORS_ORIGIN ? [process.env.CORS_ORIGIN] : []),
  ],
  advanced: {
    defaultCookieAttributes: {
      sameSite: 'none',
      secure: true,
      partitioned: true,
      // Share cookie across subdomains (your web + api hosts)
      // so <img src="/uploads/..."> requests on the web domain include the session.
      domain: process.env.AUTH_COOKIE_DOMAIN || undefined,
    },
  },
  databaseHooks: {
    user: {
      create: {
        // OTP sign-in on the demo can create a brand-new user with no tenantId
        // (the required field isn't supplied by the email-otp flow). Attach the
        // demo tenant so creation succeeds. On hrms, OTP sign-up is disabled, so
        // this only fires for demo self-service logins.
        before: async (user: any) => {
          const data: any = { ...user };
          if (!data.tenantId) {
            const tenantId = await resolveDemoTenantId();
            if (tenantId) data.tenantId = tenantId;
          }
          // Demo self-signups land as ADMIN so they see the full populated tenant
          // (sample employees/clients/invoices). The demo is read-only at the DB
          // layer (demo_readonly), so an admin demo user can VIEW everything but
          // cannot mutate anything. A fresh MEMBER would hit the employee portal
          // with no linked profile → empty. hrms is unaffected (isDemo=false there).
          if (isDemo) data.role = 'ADMIN';
          return { data };
        },
      },
    },
    session: {
      create: {
        before: async (session: any) => {
          // (1) DEMO MODE — clear other sessions for this user
          if (isDemo) {
            try {
              await prisma.$executeRawUnsafe(
                'DELETE FROM sessions WHERE user_id = $1',
                session.userId
              );
            } catch (e) {
              console.warn('Demo: failed to clear old sessions', e);
            }
          }
          // (2) APPROVAL GATE — block session creation if matching employee
          //     is not APPROVED. Admin users (no employee row) pass through.
          try {
            const user: any = await prisma.user.findUnique({
              where: { id: session.userId },
              select: { email: true, tenantId: true },
            });
            if (user?.email && user?.tenantId) {
              const emp: any = await prisma.employee.findFirst({
                where: {
                  tenantId: user.tenantId,
                  email: user.email,
                  deletedAt: null,
                },
                select: { approvalStatus: true } as any,
              });
              if (emp && (emp as any).approvalStatus !== 'APPROVED') {
                throw new Error(
                  `Your account is pending HR approval (status: ${(emp as any).approvalStatus}). You will receive an email once approved.`,
                );
              }
            }
          } catch (e: any) {
            if (e?.message?.includes('pending HR approval')) throw e;
            console.warn('Approval gate check failed:', e?.message);
          }
          return { data: session };
        },
      },
    },
  },
  user: {
    additionalFields: {
      tenantId: {
        type: 'string',
        // Not required at the input layer: emailOTP self-signup (demo) creates a
        // user with no tenantId, and Better Auth would reject a required field
        // BEFORE the user.create.before hook can attach it. The hook below fills
        // tenantId when missing, and the DB column stays non-null.
        required: false,
        input: true,
      },
      role: {
        type: 'string',
        required: false,
        defaultValue: 'MEMBER',
        input: false,
      },
    },
  },
});

export type Auth = typeof auth;

export function validatePasswordStrength(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters' };
  }
  if (password.length > 128) {
    return { valid: false, message: 'Password must not exceed 128 characters' };
  }
  if (!STRONG_PASSWORD.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character',
    };
  }
  const lower = password.toLowerCase();
  const commonPasswords = ['password', '12345678', 'qwerty123', 'admin123', 'letmein'];
  if (commonPasswords.some((p) => lower.includes(p))) {
    return { valid: false, message: 'Password is too common. Choose a stronger password.' };
  }
  return { valid: true };
}
