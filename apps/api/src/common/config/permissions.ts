import { UserRole } from '@prisma/client';

/**
 * Centralized permission map — defines minimum role for each action.
 * Used by both backend guards and referenced by frontend for UI visibility.
 */
export const PERMISSIONS = {
  // Settings & Tenant
  'settings:manage': [UserRole.OWNER, UserRole.ADMIN],
  'tenant:manage': [UserRole.OWNER],

  // Employees
  'employees:read': [UserRole.MANAGER],
  'employees:write': [UserRole.ADMIN],

  // Departments
  'departments:read': [UserRole.MANAGER],
  'departments:write': [UserRole.ADMIN],

  // Clients
  'clients:read': [UserRole.MANAGER],
  'clients:write': [UserRole.ADMIN],

  // Assignments
  'assignments:read': [UserRole.MANAGER],
  'assignments:write': [UserRole.ADMIN],

  // Invoices
  'invoices:read': [UserRole.MANAGER],
  'invoices:write': [UserRole.ADMIN],

  // Monitoring
  'monitoring:read': [UserRole.MANAGER],
  'monitoring:write': [UserRole.ADMIN],

  // Attendance
  'attendance:read': [UserRole.MANAGER],
  'attendance:write': [UserRole.MANAGER],

  // Leaves
  'leaves:read': [UserRole.MEMBER],
  'leaves:apply': [UserRole.MEMBER],
  'leaves:review': [UserRole.MANAGER],
  'leaves:types': [UserRole.ADMIN],

  // Reports
  'reports:read': [UserRole.MANAGER],

  // Dashboard
  'dashboard:read': [UserRole.MEMBER],

  // Payroll
  'payroll:read': [UserRole.ADMIN],
  'payroll:write': [UserRole.ADMIN],

  // Documents
  'documents:read': [UserRole.MANAGER],
  'documents:write': [UserRole.ADMIN],

  // Holidays & Shifts
  'holidays:read': [UserRole.MEMBER],
  'holidays:write': [UserRole.ADMIN],
  'shifts:read': [UserRole.MANAGER],
  'shifts:write': [UserRole.ADMIN],

  // Audit
  'audit:read': [UserRole.ADMIN],

  // Portal (self-service)
  'portal:read': [UserRole.MEMBER],
} as const;

/**
 * Web sidebar path → module-scope key (see common/config/module-scopes.ts).
 * Every href rendered in the admin sidebar must appear here so per-user
 * module scopes can hide it.
 */
export const SIDEBAR_PATH_MODULES: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/users': 'users',
  '/employees': 'employees',
  '/departments': 'departments',
  '/attendance/summary': 'attendance',
  '/attendance/monthly': 'attendance',
  '/attendance/screenshots': 'attendance',
  '/leaves': 'leaves',
  '/profile-changes': 'profile-changes',
  '/onboarding': 'onboarding',
  '/shifts': 'shifts',
  '/payroll/pay-structures': 'payroll',
  '/payroll/pay-heads': 'payroll',
  '/payroll/workflow': 'payroll',
  '/payroll/tax': 'payroll',
  '/appraisals': 'appraisals',
  '/clients': 'clients',
  '/invoices': 'invoices',
  '/it-declarations': 'it-declarations',
  '/tax-config': 'tax-config',
  '/tax-forms': 'tax-forms',
  '/reports': 'reports',
  '/mailbox-access': 'mailbox',
  '/documents': 'documents',
  '/holidays': 'holidays',
  '/audit': 'audit',
  '/knowledge-base': 'kb',
  '/troubleshoot': 'troubleshoot',
  '/settings': 'settings',
  '/monitoring': 'monitoring',
  '/portal': 'portal',
  '/assistant': 'agent',
  '/exit': 'exit',
};

/**
 * Sidebar visibility — maps nav items to minimum role level.
 */
export const SIDEBAR_PERMISSIONS: Record<string, UserRole> = {
  '/dashboard': UserRole.MEMBER,
  '/employees': UserRole.MANAGER,
  '/departments': UserRole.MANAGER,
  '/clients': UserRole.MANAGER,
  '/monitoring': UserRole.MANAGER,
  '/attendance': UserRole.MANAGER,
  '/leaves': UserRole.MEMBER,
  '/invoices': UserRole.MANAGER,
  '/reports': UserRole.MANAGER,
  '/payroll': UserRole.ADMIN,
  '/appraisals': UserRole.MANAGER,
  '/documents': UserRole.MANAGER,
  '/holidays': UserRole.MEMBER,
  '/audit': UserRole.ADMIN,
  '/troubleshoot': UserRole.ADMIN,
  '/users': UserRole.ADMIN,
  '/profile-changes': UserRole.ADMIN,
  '/settings': UserRole.ADMIN,
  '/portal': UserRole.MEMBER,
  '/assistant': UserRole.MANAGER,
  '/exit': UserRole.ADMIN,
};

