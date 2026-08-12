'use client';

import { useEffect, useState, useRef } from 'react';
import { useSession } from './auth-client';
import { apiFetch } from './api';

interface Permissions {
  canManageEmployees: boolean;
  canManageClients: boolean;
  canManageInvoices: boolean;
  canManageSettings: boolean;
  canReviewLeaves: boolean;
  canViewReports: boolean;
  canViewMonitoring: boolean;
}

interface ModuleScopes {
  mode: 'allow' | 'deny';
  modules: string[];
}

interface MeData {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  moduleScopes?: ModuleScopes | null;
  permissions: Permissions;
  sidebarAccess: Record<string, boolean>;
}

const ROLE_HIERARCHY: Record<string, number> = {
  OWNER: 50,
  ADMIN: 40,
  MANAGER: 30,
  MEMBER: 20,
  VIEWER: 10,
};

let cachedMe: MeData | null = null;
let cachedUserId: string | null = null;

export function usePermissions() {
  const { data: session } = useSession();
  const sessionUserId = session?.user?.id || null;

  // Invalidate cache if user changed (e.g. logout + login as different user)
  if (sessionUserId && cachedUserId && sessionUserId !== cachedUserId) {
    cachedMe = null;
    cachedUserId = null;
  }

  const [me, setMe] = useState<MeData | null>(
    cachedUserId === sessionUserId ? cachedMe : null
  );
  const [loading, setLoading] = useState(!me);

  useEffect(() => {
    if (!session?.session?.id) return;
    if (cachedMe && cachedUserId === sessionUserId) return;

    setLoading(true);
    apiFetch<MeData>('/me')
      .then((data) => {
        cachedMe = data;
        cachedUserId = sessionUserId;
        setMe(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [session, sessionUserId]);

  const hasMinRole = (minRole: string): boolean => {
    if (!me) return false;
    return (ROLE_HIERARCHY[me.role] || 0) >= (ROLE_HIERARCHY[minRole] || 0);
  };

  const canAccessPath = (path: string): boolean => {
    if (!me) return true; // Allow while loading to avoid flash
    return me.sidebarAccess[path] !== false;
  };

  return {
    me,
    loading,
    role: me?.role || 'MEMBER',
    permissions: me?.permissions || {
      canManageEmployees: false,
      canManageClients: false,
      canManageInvoices: false,
      canManageSettings: false,
      canReviewLeaves: false,
      canViewReports: false,
      canViewMonitoring: false,
    },
    hasMinRole,
    canAccessPath,
  };
}

