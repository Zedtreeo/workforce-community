import {
  isApiPathAllowed, scopeAllowsModule, parseModuleScopes, ModuleScopes,
  grantedModules, excessModules,
} from './module-scopes';

describe('module-scopes', () => {
  const billing: ModuleScopes = {
    mode: 'allow',
    modules: ['dashboard', 'invoices', 'clients', 'assignments', 'client-portal', 'reports/billing'],
  };
  const hr: ModuleScopes = { mode: 'deny', modules: ['troubleshoot'] };

  describe('isApiPathAllowed', () => {
    it('allows everything when no scopes are set', () => {
      expect(isApiPathAllowed(null, '/api/v1/troubleshoot/query')).toBe(true);
      expect(isApiPathAllowed(null, '/api/v1/employees')).toBe(true);
    });

    it('allow-mode permits only listed modules', () => {
      expect(isApiPathAllowed(billing, '/api/v1/invoices/abc/pdf')).toBe(true);
      expect(isApiPathAllowed(billing, '/api/v1/clients?page=1'.split('?')[0])).toBe(true);
      expect(isApiPathAllowed(billing, '/api/v1/client-portal/access/xyz')).toBe(true);
      expect(isApiPathAllowed(billing, '/api/v1/employees')).toBe(false);
      expect(isApiPathAllowed(billing, '/api/v1/payroll/workflow')).toBe(false);
      expect(isApiPathAllowed(billing, '/api/v1/troubleshoot/debug')).toBe(false);
      expect(isApiPathAllowed(billing, '/api/v1/settings')).toBe(false);
    });

    it('supports two-segment keys like reports/billing', () => {
      expect(isApiPathAllowed(billing, '/api/v1/reports/billing')).toBe(true);
      expect(isApiPathAllowed(billing, '/api/v1/reports/attendance')).toBe(false);
      expect(isApiPathAllowed(billing, '/api/v1/reports')).toBe(false);
    });

    it('keeps the core surface available in allow-mode', () => {
      for (const p of ['me', 'notifications', 'push/public-key', 'kb/search', 'calls/directory', 'chat', 'portal/attendance']) {
        expect(isApiPathAllowed(billing, `/api/v1/${p}`)).toBe(true);
      }
    });

    it('deny-mode blocks only listed modules', () => {
      expect(isApiPathAllowed(hr, '/api/v1/troubleshoot/debug')).toBe(false);
      expect(isApiPathAllowed(hr, '/api/v1/troubleshoot/system-map')).toBe(false);
      expect(isApiPathAllowed(hr, '/api/v1/employees')).toBe(true);
      expect(isApiPathAllowed(hr, '/api/v1/payroll/workflow')).toBe(true);
      expect(isApiPathAllowed(hr, '/api/v1/settings')).toBe(true);
    });

    it('maps aliased prefixes to their module', () => {
      const noPayroll: ModuleScopes = { mode: 'deny', modules: ['payroll'] };
      expect(isApiPathAllowed(noPayroll, '/api/v1/pay-structure/preview')).toBe(false);
      const noMailbox: ModuleScopes = { mode: 'deny', modules: ['mailbox'] };
      expect(isApiPathAllowed(noMailbox, '/api/v1/admin/mailbox-grants')).toBe(false);
    });
  });

  describe('scopeAllowsModule', () => {
    it('reflects allow-lists including two-segment children', () => {
      expect(scopeAllowsModule(billing, 'invoices')).toBe(true);
      expect(scopeAllowsModule(billing, 'reports')).toBe(true); // reports/billing grants the reports entry
      expect(scopeAllowsModule(billing, 'employees')).toBe(false);
      expect(scopeAllowsModule(billing, 'troubleshoot')).toBe(false);
      expect(scopeAllowsModule(billing, 'kb')).toBe(true); // always-allowed core
    });

    it('reflects deny-lists', () => {
      expect(scopeAllowsModule(hr, 'troubleshoot')).toBe(false);
      expect(scopeAllowsModule(hr, 'employees')).toBe(true);
    });
  });

  describe('grant comparison (you can give at most what you have)', () => {
    const hrAdmin = { role: 'ADMIN', scopes: hr }; // deny troubleshoot
    const fullAdmin = { role: 'ADMIN', scopes: null };

    it('role gates limit granted modules', () => {
      const manager = grantedModules('MANAGER', null);
      expect(manager.has('employees')).toBe(true);
      expect(manager.has('troubleshoot')).toBe(false); // ADMIN-gated
      expect(manager.has('users')).toBe(false);
      const member = grantedModules('MEMBER', null);
      expect(member.has('employees')).toBe(false);
      expect(member.has('leaves')).toBe(true);
    });

    it('an hr-style admin can hand out Manager/Billing but not full Admin', () => {
      expect(excessModules(hrAdmin, { role: 'MANAGER', scopes: null })).toEqual([]);
      expect(excessModules(hrAdmin, { role: 'ADMIN', scopes: billing })).toEqual([]);
      expect(excessModules(hrAdmin, { role: 'ADMIN', scopes: hr })).toEqual([]);
      expect(excessModules(hrAdmin, { role: 'ADMIN', scopes: null })).toEqual(['troubleshoot']);
    });

    it('an unrestricted admin can hand out anything', () => {
      expect(excessModules(fullAdmin, { role: 'ADMIN', scopes: null })).toEqual([]);
    });

    it('a billing-scoped admin cannot hand out employee access', () => {
      const billingAdmin = { role: 'ADMIN', scopes: billing };
      expect(excessModules(billingAdmin, { role: 'MANAGER', scopes: null })).toContain('employees');
    });
  });

  describe('parseModuleScopes', () => {
    it('accepts valid shapes and rejects junk', () => {
      expect(parseModuleScopes({ mode: 'allow', modules: ['invoices'] })).toEqual({ mode: 'allow', modules: ['invoices'] });
      expect(parseModuleScopes(null)).toBeNull();
      expect(parseModuleScopes({ mode: 'nope', modules: ['x'] })).toBeNull();
      expect(parseModuleScopes({ mode: 'allow', modules: [] })).toBeNull();
      expect(parseModuleScopes({ mode: 'allow', modules: [1, ''] })).toBeNull();
      expect(parseModuleScopes('str')).toBeNull();
    });
  });
});
