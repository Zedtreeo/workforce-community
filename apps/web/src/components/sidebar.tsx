'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { usePermissions } from '../lib/use-permissions';
import {
  LayoutDashboard, Users, UserCog, Building2, Briefcase, Monitor, CalendarClock,
  TreePalm, Receipt, Landmark, FolderOpen, CalendarDays,
  BarChart3, ScrollText, UserCircle, Settings, ChevronLeft, ChevronDown, Mails,
  Globe, X, BookOpen, Download, FileText, ClipboardList, Home, UserPlus, ListChecks,
  Camera, Gauge, Percent, Wrench, ShieldCheck, TrendingUp, Sparkles, LogOut,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  group: string;
  children?: NavItem[];
  minRole?: string;
}

const adminNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={18} />, group: 'Overview' },
  {
    label: 'Users', href: '/users', icon: <UserCog size={18} />, group: 'Overview',
    children: [
      { label: 'All Users', href: '/users', icon: <UserCog size={16} />, group: 'Overview' },
      { label: 'Roles', href: '/users/roles', icon: <ShieldCheck size={16} />, group: 'Overview' },
    ],
  },

  { label: 'Employees', href: '/employees', icon: <Users size={18} />, group: 'People' },
  { label: 'Departments', href: '/departments', icon: <Building2 size={18} />, group: 'People' },
  {
    label: 'Attendance', href: '/attendance/summary', icon: <CalendarClock size={18} />, group: 'People',
    children: [
      { label: 'Summary', href: '/attendance/summary', icon: <Gauge size={16} />, group: 'People' },
      { label: 'Monthly', href: '/attendance/monthly', icon: <CalendarClock size={16} />, group: 'People' },
    ],
  },
  { label: 'Leaves', href: '/leaves', icon: <TreePalm size={18} />, group: 'People' },
  { label: 'Profile Changes', href: '/profile-changes', icon: <ClipboardList size={18} />, group: 'People' },
  { label: 'Onboarding', href: '/onboarding', icon: <UserPlus size={18} />, group: 'People' },
  { label: 'Exit / F&F', href: '/exit', icon: <LogOut size={18} />, group: 'People', minRole: 'ADMIN' },
  { label: 'Shifts', href: '/shifts', icon: <CalendarClock size={18} />, group: 'People' },
  { label: 'Pay Structure', href: '/payroll/pay-structures', icon: <FileText size={18} />, group: 'People' },
  { label: 'Pay Heads', href: '/payroll/pay-heads', icon: <ListChecks size={18} />, group: 'People' },

  { label: 'Clients', href: '/clients', icon: <Briefcase size={18} />, group: 'Business' },
  { label: 'Invoices', href: '/invoices', icon: <Receipt size={18} />, group: 'Business' },
  { label: 'Billing Entities', href: '/invoices/billing-entities', icon: <Building2 size={18} />, group: 'Business' },

  { label: 'Payroll', href: '/payroll/workflow', icon: <Landmark size={18} />, group: 'Finance' },
  { label: 'Reports', href: '/reports', icon: <BarChart3 size={18} />, group: 'Finance' },

  { label: 'Documents', href: '/documents', icon: <FolderOpen size={18} />, group: 'Admin' },
  { label: 'Holidays', href: '/holidays', icon: <CalendarDays size={18} />, group: 'Admin' },
  { label: 'Audit Log', href: '/audit', icon: <ScrollText size={18} />, group: 'Admin' },
  { label: 'Knowledge Base', href: '/knowledge-base', icon: <BookOpen size={18} />, group: 'Admin' },
];

const portalNavItems: NavItem[] = [
  { label: 'Overview', href: '/portal', icon: <Home size={18} />, group: 'Portal' },
  { label: 'Attendance', href: '/portal/attendance', icon: <CalendarClock size={18} />, group: 'Portal' },
  { label: 'Leaves', href: '/portal/leaves', icon: <TreePalm size={18} />, group: 'Portal' },
  { label: 'Payslips', href: '/portal/payslips', icon: <FileText size={18} />, group: 'Portal' },
  { label: 'Assignments', href: '/portal/assignments', icon: <ClipboardList size={18} />, group: 'Portal' },
  { label: 'My Shift', href: '/portal/shift', icon: <CalendarClock size={18} />, group: 'Portal' },
  { label: 'Pay Structure', href: '/portal/pay-structure', icon: <Landmark size={18} />, group: 'Portal' },
  { label: 'Holidays', href: '/portal/holidays', icon: <CalendarDays size={18} />, group: 'Portal' },
  { label: 'My Profile', href: '/portal/profile', icon: <UserCircle size={18} />, group: 'Portal' },
  { label: 'Knowledge Base', href: '/portal/knowledge-base', icon: <BookOpen size={18} />, group: 'Portal' },
];

const adminBottomItems: NavItem[] = [
  { label: 'My Portal', href: '/portal', icon: <UserCircle size={18} />, group: '' },
  { label: 'Settings', href: '/settings', icon: <Settings size={18} />, group: '' },
];

const adminGroups = ['Overview', 'People', 'Business', 'Finance', 'Admin'];
const portalGroups = ['Portal'];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { canAccessPath, me, hasMinRole } = usePermissions();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set([...adminGroups, ...portalGroups]));
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(['Attendance']));
  const [navStateLoaded, setNavStateLoaded] = useState(false);

  // Restore expand/collapse state after mount (localStorage isn't available during SSR)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('sidebar-nav-state') || 'null');
      if (saved) {
        if (typeof saved.collapsed === 'boolean') setCollapsed(saved.collapsed);
        if (Array.isArray(saved.expandedGroups)) setExpandedGroups(new Set(saved.expandedGroups));
        if (Array.isArray(saved.expandedItems)) setExpandedItems(new Set(saved.expandedItems));
      }
    } catch { /* ignore corrupt state */ }
    setNavStateLoaded(true);
  }, []);

  useEffect(() => {
    if (!navStateLoaded) return;
    localStorage.setItem('sidebar-nav-state', JSON.stringify({
      collapsed,
      expandedGroups: [...expandedGroups],
      expandedItems: [...expandedItems],
    }));
  }, [navStateLoaded, collapsed, expandedGroups, expandedItems]);

  const isPortalView = pathname.startsWith('/portal');
  const isManagerOrAbove = hasMinRole('MANAGER');

  const showPortalNav = isPortalView || (!isManagerOrAbove);
  const navItems = showPortalNav ? portalNavItems : adminNavItems;
  const groups = showPortalNav ? portalGroups : adminGroups;
  const bottomItems = showPortalNav && !isManagerOrAbove
    ? [] // employees have no admin settings — /settings is ADMIN-only and just bounced them
    : isManagerOrAbove && isPortalView
      ? [{ label: 'Back to Admin', href: '/dashboard', icon: <LayoutDashboard size={18} />, group: '' }, { label: 'Settings', href: '/settings', icon: <Settings size={18} />, group: '' }]
      : adminBottomItems;

  useEffect(() => {
    onMobileClose?.();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(group) ? next.delete(group) : next.add(group);
      return next;
    });
  };

  const toggleItem = (label: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  // Troubleshoot is a live-server maintenance console — never on the public demo.
  const isDemoHost = typeof window !== 'undefined' && window.location.hostname === 'demo.zedtreeo.io';

  const filteredItems = navItems.filter((item) => {
    if (item.href === '/troubleshoot' && isDemoHost) return false;
    if (item.minRole && !hasMinRole(item.minRole)) return false;
    if (showPortalNav) return true;
    return canAccessPath(item.href);
  });

  const pathActive = (href: string) =>
    href === '/portal' || href === '/users'
      ? pathname === href
      : (pathname === href || pathname.startsWith(href + '/'));

  const renderEntry = (item: NavItem) => {
    const hasChildren = !!item.children && item.children.length > 0 && !collapsed;
    const childActive = item.children?.some((c) => pathActive(c.href)) ?? false;
    const isActive = pathActive(item.href) || childActive;

    if (hasChildren) {
      const open = expandedItems.has(item.label) || childActive;
      return (
        <div key={item.href}>
          <button
            onClick={() => toggleItem(item.label)}
            className={`
              w-full flex items-center gap-2.5 rounded-lg text-sm font-medium transition-all duration-150 px-2.5 py-2 my-0.5
              ${isActive ? 'bg-brand-50 text-brand-700' : 'text-content-secondary hover:bg-surface-100 hover:text-content-primary'}
            `}
          >
            <span className={`shrink-0 ${isActive ? 'text-brand-600' : ''}`}>{item.icon}</span>
            <span className="flex-1 text-left">{item.label}</span>
            <ChevronDown size={12} className={`transition-transform duration-150 ${open ? '' : '-rotate-90'}`} />
          </button>
          {open && item.children!.map((child) => {
            const cActive = pathActive(child.href);
            return (
              <Link
                key={child.href}
                href={child.href}
                className={`
                  flex items-center gap-2.5 rounded-lg text-sm font-medium transition-all duration-150 pl-9 pr-2.5 py-1.5 my-0.5
                  ${cActive ? 'bg-brand-50 text-brand-700' : 'text-content-secondary hover:bg-surface-100 hover:text-content-primary'}
                `}
              >
                <span className={`shrink-0 ${cActive ? 'text-brand-600' : ''}`}>{child.icon}</span>
                {child.label}
              </Link>
            );
          })}
        </div>
      );
    }

    const href = (item.children && item.children.length && collapsed) ? item.children[0].href : item.href;
    return (
      <Link
        key={item.href}
        href={href}
        title={collapsed ? item.label : undefined}
        className={`
          flex items-center gap-2.5 rounded-lg text-sm font-medium transition-all duration-150
          ${collapsed ? 'justify-center h-9 w-full my-0.5' : 'px-2.5 py-2 my-0.5'}
          ${isActive ? 'bg-brand-50 text-brand-700' : 'text-content-secondary hover:bg-surface-100 hover:text-content-primary'}
        `}
      >
        <span className={`shrink-0 ${isActive ? 'text-brand-600' : ''}`}>{item.icon}</span>
        {!collapsed && item.label}
      </Link>
    );
  };

  const sidebarContent = (
    <aside className={`
      ${collapsed ? 'w-16' : 'w-60'}
      bg-white border-r border-surface-200 flex flex-col h-full transition-all duration-200 ease-out shrink-0
    `}>
      <div className="h-14 flex items-center justify-between px-4 border-b border-surface-200">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <Globe size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-content-primary leading-tight">Zedtreeo <span className="font-semibold text-content-secondary">Workforce</span></p>
              <p className="text-[10px] text-content-tertiary leading-none mt-0.5">
                {showPortalNav ? 'Employee Portal' : 'Workforce Management'}
              </p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="h-8 w-8 rounded-lg bg-brand-600 flex items-center justify-center mx-auto">
            <Globe size={16} className="text-white" />
          </div>
        )}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="h-6 w-6 rounded-md flex items-center justify-center text-content-tertiary hover:bg-surface-100 hover:text-content-secondary transition-colors hidden lg:flex"
          >
            <ChevronLeft size={14} />
          </button>
        )}
        {!collapsed && (
          <button
            onClick={onMobileClose}
            className="h-6 w-6 rounded-md flex items-center justify-center text-content-tertiary hover:bg-surface-100 hover:text-content-secondary transition-colors lg:hidden"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="h-8 w-8 mx-auto mt-2 rounded-md flex items-center justify-center text-content-tertiary hover:bg-surface-100 hover:text-content-secondary transition-colors"
        >
          <ChevronLeft size={14} className="rotate-180" />
        </button>
      )}

      <nav className="flex-1 py-3 px-2 overflow-y-auto custom-scrollbar">
        {groups.map((group) => {
          const groupItems = filteredItems.filter((item) => item.group === group);
          if (groupItems.length === 0) return null;
          const isExpanded = expandedGroups.has(group);

          return (
            <div key={group} className="mb-1">
              {!collapsed && (
                <button
                  onClick={() => toggleGroup(group)}
                  className="w-full flex items-center justify-between px-2 py-1.5 mt-2 text-[10px] font-semibold uppercase tracking-widest text-content-tertiary hover:text-content-secondary"
                >
                  {group}
                  <ChevronDown size={12} className={`transition-transform duration-150 ${isExpanded ? '' : '-rotate-90'}`} />
                </button>
              )}

              {(isExpanded || collapsed) && groupItems.map((item) => renderEntry(item))}
            </div>
          );
        })}
      </nav>

      <div className="py-2 px-2 border-t border-surface-200">
        {bottomItems.filter((item) => showPortalNav || canAccessPath(item.href)).map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`
                flex items-center gap-2.5 rounded-lg text-sm font-medium transition-all duration-150
                ${collapsed ? 'justify-center h-9 w-full my-0.5' : 'px-2.5 py-2 my-0.5'}
                ${isActive ? 'bg-brand-50 text-brand-700' : 'text-content-secondary hover:bg-surface-100 hover:text-content-primary'}
              `}
            >
              <span className={`shrink-0 ${isActive ? 'text-brand-600' : ''}`}>{item.icon}</span>
              {!collapsed && item.label}
            </Link>
          );
        })}

        {me && !collapsed && (
          <div className="mt-2 px-2.5 py-2 rounded-lg bg-surface-50">
            <p className="text-sm font-medium text-content-primary truncate">{me.name}</p>
            <p className="text-xs text-content-tertiary capitalize">{me.role?.toLowerCase()}</p>
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden lg:flex min-h-screen">
        {sidebarContent}
      </div>

      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden animate-fade-in"
            onClick={onMobileClose}
          />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden animate-slide-right">
            {sidebarContent}
          </div>
        </>
      )}
    </>
  );
}
