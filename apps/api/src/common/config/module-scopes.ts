import { PrismaClient } from '@prisma/client';

/**
 * Per-user module restriction, stored in users.module_scopes (JSONB).
 *   null                                       → full access for the user's role (default)
 *   { mode: 'allow', modules: ['invoices'] }   → ONLY the listed modules
 *   { mode: 'deny',  modules: ['troubleshoot']}→ everything EXCEPT the listed modules
 *
 * A module key is the first API path segment after /api/v1 (e.g. 'invoices'),
 * or a two-segment key for finer grain (e.g. 'reports/billing').
 */
export interface ModuleScopes {
  mode: 'allow' | 'deny';
  modules: string[];
}

// Core surface every authenticated user keeps regardless of scopes:
// own profile/permissions, notifications, help, comms, push, self-service portal.
const ALWAYS_ALLOWED = new Set([
  'me', 'health', 'notifications', 'push', 'kb', 'calls', 'chat', 'portal',
]);

// API prefixes that belong to a differently-named module.
const PREFIX_ALIASES: Record<string, string> = {
  'pay-structure': 'payroll',
  'admin/mailbox-grants': 'mailbox',
};

export function parseModuleScopes(raw: unknown): ModuleScopes | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as any;
  if ((s.mode !== 'allow' && s.mode !== 'deny') || !Array.isArray(s.modules)) return null;
  const modules = s.modules.filter((m: unknown) => typeof m === 'string' && m.length > 0);
  return modules.length > 0 ? { mode: s.mode, modules } : null;
}

/** Check a single module key (e.g. 'invoices' or 'reports/billing') against a user's scopes. */
export function scopeAllowsModule(scopes: ModuleScopes | null, moduleKey: string): boolean {
  if (!scopes) return true;
  if (ALWAYS_ALLOWED.has(moduleKey)) return true;
  const matched = scopes.modules.some(
    (m) => m === moduleKey || m.startsWith(`${moduleKey}/`),
  );
  return scopes.mode === 'allow' ? matched : !matched;
}

/** Check an API request path (e.g. /api/v1/invoices/123) against a user's scopes. */
export function isApiPathAllowed(scopes: ModuleScopes | null, path: string): boolean {
  if (!scopes) return true;
  const rel = path.replace(/^\/api\/v1/, '');
  const segs = rel.split('/').filter(Boolean).map((s) => s.toLowerCase());
  if (segs.length === 0) return true;

  const two = segs.length > 1 ? `${segs[0]}/${segs[1]}` : null;
  const m1 = PREFIX_ALIASES[two ?? ''] ?? PREFIX_ALIASES[segs[0]] ?? segs[0];
  if (ALWAYS_ALLOWED.has(m1)) return true;

  const m2 = segs.length > 1 ? `${m1}/${segs[1]}` : null;
  const matched = scopes.modules.some((m) => m === m1 || (m2 !== null && m === m2));
  return scopes.mode === 'allow' ? matched : !matched;
}

// ── Grant comparison: "you can give others at most what you have" ──

/** Every restrictable module key (keep in sync with the web MODULE_OPTIONS list). */
export const KNOWN_MODULES: string[] = [
  'dashboard', 'users', 'employees', 'departments', 'attendance', 'shifts',
  'leaves', 'holidays', 'profile-changes', 'onboarding', 'payroll', 'appraisals',
  'it-declarations', 'tax-config', 'tax-forms', 'clients', 'assignments',
  'invoices', 'client-portal', 'reports', 'letters', 'documents', 'mailbox',
  'monitoring', 'audit', 'settings', 'troubleshoot', 'agent', 'exit',
];

const ROLE_LEVEL: Record<string, number> = {
  OWNER: 50, ADMIN: 40, MANAGER: 30, MEMBER: 20, VIEWER: 10,
};

// Approximate minimum role that can reach each module (mirrors the @Roles
// gates on the controllers) — used only for grant comparisons.
const MODULE_MIN_ROLE: Record<string, number> = {
  users: 40, settings: 40, audit: 40, troubleshoot: 40, payroll: 40,
  mailbox: 40, 'tax-config': 40, onboarding: 40, 'profile-changes': 40,
  exit: 40,
  employees: 30, departments: 30, clients: 30, assignments: 30, invoices: 30,
  reports: 30, attendance: 30, documents: 30, monitoring: 30, shifts: 30,
  letters: 30, 'it-declarations': 30, 'tax-forms': 30, 'client-portal': 30,
  appraisals: 30, agent: 30,
  dashboard: 20, leaves: 20, holidays: 20,
};

/** Modules a (role, scopes) combination can actually reach. */
export function grantedModules(role: string, scopes: ModuleScopes | null): Set<string> {
  const level = ROLE_LEVEL[role] ?? 0;
  const out = new Set<string>();
  for (const m of KNOWN_MODULES) {
    if (level < (MODULE_MIN_ROLE[m] ?? 20)) continue;
    if (scopeAllowsModule(scopes, m)) out.add(m);
  }
  return out;
}

/**
 * Modules the target grant includes that the acting user lacks. Empty array
 * means the acting user may hand out this access.
 */
export function excessModules(
  acting: { role: string; scopes: ModuleScopes | null },
  target: { role: string; scopes: ModuleScopes | null },
): string[] {
  const mine = grantedModules(acting.role, acting.scopes);
  return [...grantedModules(target.role, target.scopes)].filter((m) => !mine.has(m));
}

// ── Cached per-user scope lookup (30s TTL so DB edits apply quickly) ──

const prisma = new PrismaClient();
const cache = new Map<string, { scopes: ModuleScopes | null; exp: number }>();
const TTL_MS = 30_000;

/** Drop a user's cached scopes so an edit applies immediately. */
export function invalidateModuleScopes(userId: string): void {
  cache.delete(userId);
}

/** Drop everyone's cached scopes (after editing an access profile). */
export function invalidateAllModuleScopes(): void {
  cache.clear();
}

/**
 * Effective scopes: per-user override (users.module_scopes) wins; otherwise
 * the assigned access profile's scopes; otherwise null (role-only gating).
 */
export async function getModuleScopes(userId: string): Promise<ModuleScopes | null> {
  const hit = cache.get(userId);
  if (hit && hit.exp > Date.now()) return hit.scopes;
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      moduleScopes: true,
      accessProfile: { select: { scopes: true } },
    },
  });
  const scopes =
    parseModuleScopes(row?.moduleScopes) ??
    parseModuleScopes(row?.accessProfile?.scopes);
  cache.set(userId, { scopes, exp: Date.now() + TTL_MS });
  return scopes;
}
