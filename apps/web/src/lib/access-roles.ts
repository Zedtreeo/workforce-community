// Shared types + helpers for access roles (API: /users/access-profiles).

export interface ModuleScopes {
  mode: 'allow' | 'deny';
  modules: string[];
}

export interface AccessProfile {
  id: string;
  name: string;
  description: string | null;
  baseRole: string;
  scopes: ModuleScopes | null;
  isSystem: boolean;
  _count?: { users: number };
}

export const PROFILE_BASE_ROLES = ['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'];

export const ROLE_BADGE: Record<string, 'success' | 'warning' | 'info' | 'danger' | 'default'> = {
  OWNER: 'danger',
  ADMIN: 'info',
  MANAGER: 'warning',
  MEMBER: 'success',
  VIEWER: 'default',
};

// Restrictable modules (core surface — profile, notifications, chat/calls,
// help, portal — is always available and intentionally not listed).
export const MODULE_OPTIONS: { key: string; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'users', label: 'Users' },
  { key: 'employees', label: 'Employees' },
  { key: 'departments', label: 'Departments' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'shifts', label: 'Shifts' },
  { key: 'leaves', label: 'Leaves' },
  { key: 'holidays', label: 'Holidays' },
  { key: 'profile-changes', label: 'Profile Changes' },
  { key: 'onboarding', label: 'Onboarding' },
  { key: 'payroll', label: 'Payroll & Pay Structure' },
  { key: 'appraisals', label: 'Appraisals' },
  { key: 'it-declarations', label: 'IT Declarations' },
  { key: 'tax-config', label: 'Tax Config' },
  { key: 'tax-forms', label: 'Tax Forms' },
  { key: 'clients', label: 'Clients' },
  { key: 'assignments', label: 'Assignments' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'client-portal', label: 'Client Portal' },
  { key: 'reports', label: 'Reports (all)' },
  { key: 'reports/billing', label: 'Billing Report only' },
  { key: 'letters', label: 'Letters' },
  { key: 'documents', label: 'Documents' },
  { key: 'mailbox', label: 'Shared Mail' },
  { key: 'monitoring', label: 'Monitoring' },
  { key: 'audit', label: 'Audit Log' },
  { key: 'settings', label: 'Settings' },
  { key: 'troubleshoot', label: 'Troubleshoot' },
  { key: 'agent', label: 'AI Assistant' },
  { key: 'exit', label: 'Exit / Offboarding' },
];

export const moduleLabel = (key: string) =>
  MODULE_OPTIONS.find((m) => m.key === key)?.label ?? key;

export function scopeSummary(scopes: ModuleScopes | null | undefined): { text: string; variant: 'default' | 'info' | 'warning' } {
  if (!scopes) return { text: 'All role modules', variant: 'default' };
  const names = scopes.modules.map(moduleLabel);
  const shown = names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3}` : '');
  return scopes.mode === 'allow'
    ? { text: `Only: ${shown}`, variant: 'info' }
    : { text: `Except: ${shown}`, variant: 'warning' };
}
