"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "../../lib/auth-client";
import { apiFetch } from "../../lib/api";
import { usePermissions } from "../../lib/use-permissions";
import { DashboardLayout } from "../../components/dashboard-layout";
import {
  Button, Badge, Select, Pagination, PageSkeleton,
  DataTable, TableToolbar, PageHeader, Modal,
} from "../../components/ui";
import type { Column } from "../../components/ui";
import { RoleEditorModal } from "../../components/role-editor-modal";
import {
  AccessProfile, ModuleScopes, MODULE_OPTIONS, ROLE_BADGE, scopeSummary,
} from "../../lib/access-roles";
import { UserCog, UserCheck, UserX, ShieldCheck } from "lucide-react";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  moduleScopes?: ModuleScopes | null;
  accessProfile?: { id: string; name: string; baseRole: string; scopes: ModuleScopes | null } | null;
  lastLoginAt: string | null;
  createdAt: string;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const ROLE_FILTER_OPTIONS = [
  { label: "All Roles", value: "" },
  { label: "Admin", value: "ADMIN" },
  { label: "Manager", value: "MANAGER" },
  { label: "Member", value: "MEMBER" },
  { label: "Viewer", value: "VIEWER" },
];

export default function UsersPage() {
  const { data: session } = useSession();
  const { me } = usePermissions();
  const [users, setUsers] = useState<User[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [updating, setUpdating] = useState<string | null>(null);
  const limit = 20;

  // Admins can manage roles; the server blocks granting anything beyond
  // the acting admin's own access.
  const canEditScopes = !!me && (me.role === "ADMIN" || me.role === "OWNER");

  // ── Roles (access profiles) ──
  const [profiles, setProfiles] = useState<AccessProfile[]>([]);
  const [assigningFor, setAssigningFor] = useState<string | null>(null);
  // '+ Create new role…' from a user's picker: create, then assign to them
  const [createRoleFor, setCreateRoleFor] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    try {
      setProfiles(await apiFetch<AccessProfile[]>("/users/access-profiles"));
    } catch { /* non-admin or restricted — list stays empty */ }
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const fetchUsers = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (search) params.set("search", search);
      if (roleFilter) params.set("role", roleFilter);
      const res = await apiFetch<{ data: User[]; meta: Meta }>("/users?" + params.toString());
      setUsers(res.data);
      setMeta(res.meta);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  }, [session, page, search, roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSearch = (value: string) => { setSearch(value); setPage(1); };
  const handleRoleFilter = (e: React.ChangeEvent<HTMLSelectElement>) => { setRoleFilter(e.target.value); setPage(1); };

  const assignProfile = async (userId: string, profileId: string | null) => {
    setUpdating(userId);
    try {
      await apiFetch(`/users/${userId}/access-profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      });
      setAssigningFor(null);
      await Promise.all([fetchUsers(), fetchProfiles()]);
    } catch (err: any) {
      alert(err.message || "Failed to change role");
    } finally {
      setUpdating(null);
    }
  };

  // ── Custom module-access editor (per-user override) ──
  const [scopeUser, setScopeUser] = useState<User | null>(null);
  const [scopeMode, setScopeMode] = useState<"full" | "allow" | "deny">("full");
  const [scopeModules, setScopeModules] = useState<Set<string>>(new Set());
  const [scopeSaving, setScopeSaving] = useState(false);
  const [scopeError, setScopeError] = useState("");

  const openScopeEditor = (user: User) => {
    setScopeUser(user);
    setScopeMode(user.moduleScopes?.mode ?? "full");
    setScopeModules(new Set(user.moduleScopes?.modules ?? []));
    setScopeError("");
  };

  const toggleScopeModule = (key: string) => {
    setScopeModules((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const saveScopes = async () => {
    if (!scopeUser) return;
    const scopes = scopeMode === "full"
      ? null
      : { mode: scopeMode, modules: [...scopeModules] };
    if (scopes && scopes.modules.length === 0) {
      setScopeError(scopeMode === "allow"
        ? "Pick at least one module to allow."
        : "Pick at least one module to block.");
      return;
    }
    setScopeSaving(true); setScopeError("");
    try {
      await apiFetch(`/users/${scopeUser.id}/module-scopes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scopes }),
      });
      setScopeUser(null);
      fetchUsers();
    } catch (err: any) {
      setScopeError(err.message || "Failed to update module access");
    } finally {
      setScopeSaving(false);
    }
  };

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    setUpdating(userId);
    try {
      await apiFetch("/users/" + userId + "/toggle-active", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      fetchUsers();
    } catch (err: any) {
      alert(err.message || "Failed to update user");
    } finally {
      setUpdating(null);
    }
  };

  const columns: Column<User>[] = [
    {
      key: "name",
      header: "User",
      render: (user: User) => (
        <div>
          <p className="font-medium text-content-primary">{user.name}</p>
          <p className="text-xs text-content-tertiary">{user.email}</p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      minWidth: "220px",
      render: (user: User) => {
        if (assigningFor === user.id) {
          return (
            <div className="flex items-center gap-2">
              <select
                defaultValue={user.moduleScopes ? "__custom" : user.accessProfile?.id ?? "__none"}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__new") { setCreateRoleFor(user.id); setAssigningFor(null); }
                  else if (v === "__custom") { setAssigningFor(null); openScopeEditor(user); }
                  else if (v === "__none") assignProfile(user.id, null);
                  else assignProfile(user.id, v);
                }}
                className="text-sm border border-surface-300 rounded-md px-2 py-1 bg-white max-w-[200px]"
                disabled={updating === user.id}
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.baseRole.charAt(0) + p.baseRole.slice(1).toLowerCase()})</option>
                ))}
                <option value="__new">＋ Create new role…</option>
                <option value="__custom">Custom modules…</option>
                <option value="__none">No role (base access)</option>
              </select>
              <button onClick={() => setAssigningFor(null)} className="text-xs text-content-tertiary hover:text-content-primary">Cancel</button>
            </div>
          );
        }
        const roleName = user.accessProfile?.name
          ?? user.role.charAt(0) + user.role.slice(1).toLowerCase();
        const detail = user.moduleScopes
          ? scopeSummary(user.moduleScopes)
          : user.accessProfile
            ? scopeSummary(user.accessProfile.scopes)
            : { text: "Role default", variant: "default" as const };
        return (
          <div>
            <div className="flex items-center gap-2">
              <Badge variant={ROLE_BADGE[user.role] || "default"}>{roleName}</Badge>
              {user.moduleScopes && <Badge variant="warning">Custom</Badge>}
              {canEditScopes && user.id !== me?.id && user.role !== "OWNER" && (
                <button
                  onClick={() => setAssigningFor(user.id)}
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                >
                  Change
                </button>
              )}
            </div>
            <p className="text-[11px] text-content-tertiary mt-0.5">{detail.text}</p>
          </div>
        );
      },
    },
    {
      key: "isActive",
      header: "Status",
      render: (user: User) => <Badge variant={user.isActive ? "success" : "danger"} dot>{user.isActive ? "Active" : "Inactive"}</Badge>,
    },
    {
      key: "lastLoginAt",
      header: "Last Login",
      render: (user: User) => (
        <span className="text-content-secondary text-sm">
          {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Never"}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      render: (user: User) => (
        <span className="text-content-secondary text-sm">
          {new Date(user.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      headerClassName: "text-right",
      className: "text-right",
      render: (user: User) => {
        if (user.role === "OWNER" || user.role === "ADMIN") return null;
        return (
          <Button
            variant="ghost"
            size="xs"
            icon={user.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
            onClick={() => handleToggleActive(user.id, !user.isActive)}
            disabled={updating === user.id}
          >
            {user.isActive ? "Deactivate" : "Activate"}
          </Button>
        );
      },
    },
  ];

  if (loading && !meta) {
    return <DashboardLayout><div className="p-4 md:p-6"><PageSkeleton /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <PageHeader
          title="Users"
          description={meta ? meta.total + " total users" : "Loading..."}
          breadcrumbs={[{ label: "Users" }]}
          actions={
            <Link href="/users/roles">
              <Button variant="secondary" icon={<ShieldCheck size={15} />}>Manage Roles</Button>
            </Link>
          }
        />

        <DataTable<User>
          columns={columns}
          data={users}
          rowKey={(u: User) => u.id}
          loading={loading}
          loadingRows={limit}
          emptyMessage={search || roleFilter ? "No users match your filters." : "No users found."}
          emptyIcon={<UserCog />}
          toolbar={
            <TableToolbar
              search={search}
              onSearchChange={handleSearch}
              searchPlaceholder="Search by name or email..."
            >
              <Select
                options={ROLE_FILTER_OPTIONS}
                value={roleFilter}
                onChange={handleRoleFilter}
              />
            </TableToolbar>
          }
          pagination={
            meta && meta.totalPages > 1 ? (
              <Pagination
                page={page}
                totalPages={meta.totalPages}
                total={meta.total}
                onPageChange={setPage}
              />
            ) : undefined
          }
        />

        {/* Create a role from a user's picker → assign it to them on save */}
        <RoleEditorModal
          target={createRoleFor ? "new" : null}
          onClose={() => setCreateRoleFor(null)}
          saveLabel="Create & Assign"
          onSaved={async (created) => {
            if (createRoleFor) {
              await apiFetch(`/users/${createRoleFor}/access-profile`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ profileId: created.id }),
              });
            }
            await Promise.all([fetchUsers(), fetchProfiles()]);
          }}
        />

        {/* Custom module-access editor (per-user override) */}
        <Modal
          open={!!scopeUser}
          onClose={() => setScopeUser(null)}
          title={scopeUser ? `Module access — ${scopeUser.name}` : ""}
          description={scopeUser?.email}
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setScopeUser(null)}>Cancel</Button>
              <Button size="sm" loading={scopeSaving} onClick={saveScopes}>Save</Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="space-y-2">
              {([
                ["full", "Full access", "Everything the user's role allows (default)"],
                ["allow", "Allow only selected", "The user can use ONLY the modules ticked below"],
                ["deny", "Block selected", "The user can use everything EXCEPT the modules ticked below"],
              ] as const).map(([value, label, hint]) => (
                <label key={value} className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="scope-mode"
                    checked={scopeMode === value}
                    onChange={() => setScopeMode(value)}
                    className="mt-0.5 h-3.5 w-3.5 text-brand-600 focus:ring-brand-500"
                  />
                  <span>
                    <span className="text-sm font-medium text-content-primary">{label}</span>
                    <span className="block text-xs text-content-tertiary">{hint}</span>
                  </span>
                </label>
              ))}
            </div>

            {scopeMode !== "full" && (
              <div className="border border-surface-200 rounded-lg p-3 max-h-64 overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                  {MODULE_OPTIONS.map((m) => (
                    <label key={m.key} className="flex items-center gap-2 cursor-pointer text-sm text-content-secondary">
                      <input
                        type="checkbox"
                        checked={scopeModules.has(m.key)}
                        onChange={() => toggleScopeModule(m.key)}
                        className="h-3.5 w-3.5 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                      />
                      {m.label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-content-tertiary">
              Profile, notifications, chat &amp; calls, help and the employee portal always stay available.
              Changes take effect within 30 seconds.
            </p>

            {scopeError && <p className="text-sm text-danger-dark">{scopeError}</p>}
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
