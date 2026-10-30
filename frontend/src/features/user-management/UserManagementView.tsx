"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, GraduationCap, RefreshCw, UserRound, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { FilterBar, FilterField } from "@/components/ui/FilterBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StatCard } from "@/components/ui/StatCard";
import {
  MobileDataCardHeader,
  MobileDataCardGrid,
  MobileDataCardField,
} from "@/components/ui/MobileDataCard";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAcademicContext } from "@/components/layout/AcademicProvider";
import {
  formatLastLogin,
  formatScope,
  isBootstrapSuperAdmin,
  type ApRoleOption,
  type ManagedRole,
  type ManagedUser,
  type RoleAssignment,
  type UserManagementStats,
  type UserRoleStat,
} from "@/features/user-management/types";
import { RolesPermissionsPanel } from "@/features/user-management/RolesPermissionsPanel";
import { CreateUserPanel } from "@/features/user-management/CreateUserPanel";
import { YearAccessControl, getUserYearAccess, setUserYearAccess } from "@/features/user-management/YearAccessControl";
import { UserPermissionsModal } from "@/features/user-management/UserPermissionsModal";
import {
  PERMISSION_MATRIX_MODULES,
  PERMISSION_PRESENTATION,
  allMatrixPermissionKeys,
  summarizeRoleAccess,
} from "@/features/user-management/permission-matrix";
import { RoleBadge, getRoleStyle } from "@/features/user-management/RoleBadge";
import { cn } from "@/lib/cn";

const HIERARCHY_ORDER: Record<string, number> = {
  super_admin: 1,
  principal: 2,
  vice_principal: 3,
  director: 3,
  dean: 3,
  hod: 4,
  class_teacher: 5,
  mentor: 5,
  staff: 6,
  faculty: 6,
};

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; rows: ManagedUser[]; total: number };

type TabKey = "create" | "users" | "roles";

const selectClass =
  "h-9 rounded-md border border-border bg-white px-2 text-sm text-foreground outline-none focus:border-navy-800";
const inputClass =
  "h-9 w-full min-w-[200px] rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-navy-800";
const fieldClass =
  "mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-navy-900 outline-none focus:border-navy-800 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-600";

function uniqueRoleSummaries(roles: RoleAssignment[]) {
  const byKey = new Map<string, { roleKey: string; label: string; assignmentCount: number }>();
  for (const role of roles) {
    const existing = byKey.get(role.roleKey);
    if (existing) {
      existing.assignmentCount += 1;
    } else {
      byKey.set(role.roleKey, {
        roleKey: role.roleKey,
        label: role.label,
        assignmentCount: 1,
      });
    }
  }
  return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function formatScopeListCompact(roles: RoleAssignment[], maxVisible = 2) {
  if (!roles.length) return "—";
  const visible = roles.slice(0, maxVisible).map((role) => formatScope(role));
  const remaining = roles.length - maxVisible;
  if (remaining <= 0) return visible.join(", ");
  return `${visible.join(", ")} (+${remaining} more)`;
}

export function UserManagementView() {
  const { hasPermission, hasAnyPermission, user: authUser, refresh } = useAuth();
  const canManage = hasPermission("user_management.manage_users");
  const canConfigureRoles = hasAnyPermission("roles.view", "roles.manage");
  const canManageRoles = hasPermission("roles.manage");
  const { masters } = useAcademicContext();
  const [tab, setTab] = useState<TabKey>(canManage ? "create" : "users");

  const [q, setQ] = useState("");
  const [roleKey, setRoleKey] = useState("all");
  const [status, setStatus] = useState("all");
  const [collegeId, setCollegeId] = useState("all");
  const [branchId, setBranchId] = useState("all");
  const [roles, setRoles] = useState<ApRoleOption[]>([]);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ManagedUser | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [scopeTarget, setScopeTarget] = useState<RoleAssignment | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [stats, setStats] = useState<UserManagementStats>({
    total: 0,
    active: 0,
    inactive: 0,
    unassigned: 0,
    roles: [],
  });
  const [syncingTimetables, setSyncingTimetables] = useState(false);
  const [syncingHrmsStaff, setSyncingHrmsStaff] = useState(false);
  const [syncResult, setSyncResult] = useState<{ ok: boolean; message: string } | null>(null);

  const colleges = masters?.colleges ?? [];
  const courses = masters?.courses ?? [];
  const branches = useMemo(() => {
    if (!masters?.branches) return [];
    if (collegeId === "all") return masters.branches;
    const cid = Number(collegeId);
    const courseIds = new Set(courses.filter((c) => c.collegeId === cid).map((c) => c.id));
    return masters.branches.filter((b) => courseIds.has(b.courseId));
  }, [masters, collegeId, courses]);

  const loadUsers = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (roleKey !== "all") params.set("roleKey", roleKey);
      if (status !== "all") params.set("status", status);
      if (collegeId !== "all") params.set("collegeId", collegeId);
      if (branchId !== "all") params.set("branchId", branchId);
      params.set("limit", "100");
      const response = await apiFetch(`/users?${params}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.message || "Failed to load users");
      }
      setState({
        status: "ready",
        rows: body.data ?? [],
        total: Number(body.total ?? 0),
      });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to load users",
      });
    }
  }, [q, roleKey, status, collegeId, branchId]);

  const loadStats = useCallback(async () => {
    try {
      const res = await apiFetch("/users/stats", { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body && typeof body === "object") {
        setStats({
          total: Number(body.total ?? 0),
          active: Number(body.active ?? 0),
          inactive: Number(body.inactive ?? 0),
          unassigned: Number(body.unassigned ?? 0),
          roles: Array.isArray(body.roles) ? body.roles : [],
        });
      }
    } catch {
      /* keep previous stats */
    }
  }, []);

  const displayedRoleStats = useMemo(() => {
    const map = new Map<string, UserRoleStat>();

    // Canonical hierarchy seed so all institutional tiers are always represented
    const canonicalSeeds: Array<{ roleKey: string; label: string }> = [
      { roleKey: "super_admin", label: "Super Admin" },
      { roleKey: "principal", label: "Principal" },
      { roleKey: "vice_principal", label: "Vice Principal" },
      { roleKey: "hod", label: "HOD" },
      { roleKey: "class_teacher", label: "Class Teacher" },
      { roleKey: "staff", label: "Subject Faculty" },
    ];
    for (const seed of canonicalSeeds) {
      map.set(seed.roleKey, { ...seed, totalCount: 0, activeCount: 0 });
    }

    for (const r of stats.roles) {
      const existing = map.get(r.roleKey);
      if (existing) {
        existing.totalCount = r.totalCount;
        existing.activeCount = r.activeCount;
        if (r.label) existing.label = r.label;
      } else {
        map.set(r.roleKey, {
          roleKey: r.roleKey,
          label: r.label,
          totalCount: r.totalCount,
          activeCount: r.activeCount,
        });
      }
    }

    return Array.from(map.values())
      .filter((r) => r.roleKey !== "mentor")
      .sort((a, b) => (HIERARCHY_ORDER[a.roleKey] ?? 99) - (HIERARCHY_ORDER[b.roleKey] ?? 99));
  }, [stats.roles]);

  const loadRoles = useCallback(async () => {
    const response = await apiFetch("/roles?includeInactive=false", { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      setRoles(
        (body.data ?? []).map((role: ManagedRole) => ({
          id: role.id,
          roleKey: role.roleKey,
          label: role.label,
          description: role.description,
          isGlobalCapable: role.isGlobalCapable,
          isSystemRole: role.isSystemRole,
          isActive: role.isActive,
          permissions: role.permissions,
        })),
      );
    }
  }, []);

  const loadDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    setActionError(null);
    try {
      const response = await apiFetch(`/users/${id}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.message || "Failed to load user");
      setDetail(body as ManagedUser);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to load user");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (selectedId == null) {
      setDetail(null);
      return;
    }
    void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const handleSyncTimetables = async () => {
    if (!canManage) return;
    setSyncingTimetables(true);
    setSyncResult(null);
    try {
      const response = await apiFetch("/users/sync-timetables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "Failed to sync timetable users");
      }
      setSyncResult({
        ok: true,
        message: `Timetable sync complete: ${data.activeTeachingAssignments ?? 0} active assignments checked, ${data.ensuredUsersCount ?? 0} staff accounts verified/created, ${data.cleanedScopesCount ?? 0} stale scopes cleaned, ${data.deactivatedUsersCount ?? 0} users deactivated.`,
      });
      await Promise.all([loadUsers(), loadStats()]);
    } catch (err) {
      setSyncResult({
        ok: false,
        message: err instanceof Error ? err.message : "Sync failed",
      });
    } finally {
      setSyncingTimetables(false);
    }
  };

  const handleSyncHrmsStaff = async () => {
    if (!canManage) return;
    setSyncingHrmsStaff(true);
    setSyncResult(null);
    try {
      const response = await apiFetch("/users/sync-hrms-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "Failed to sync HRMS staff");
      }
      setSyncResult({
        ok: true,
        message: `HRMS Staff sync complete: ${data.totalHrmsTeachingStaff ?? 0} teaching staff scanned, ${data.syncedStaffCount ?? 0} staff accounts synchronized with Staff role.`,
      });
      await Promise.all([loadUsers(), loadStats()]);
    } catch (err) {
      setSyncResult({
        ok: false,
        message: err instanceof Error ? err.message : "Sync failed",
      });
    } finally {
      setSyncingHrmsStaff(false);
    }
  };

  async function setStatusForUser(user: ManagedUser, isActive: boolean) {
    if (!canManage) return;
    const label = isActive ? "activate" : "deactivate";
    if (!window.confirm(`${label[0].toUpperCase()}${label.slice(1)} ${user.name}?`)) return;
    setBusy(true);
    setActionError(null);
    try {
      const response = await apiFetch(`/users/${user.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.message || `Failed to ${label}`);
      setDetail(body as ManagedUser);
      await Promise.all([loadUsers(), loadStats()]);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : `Failed to ${label}`);
    } finally {
      setBusy(false);
    }
  }

  async function deleteUser(user: ManagedUser) {
    if (!canManage || user.isLocalBootstrap) return;
    if (
      !window.confirm(
        `Permanently remove “${user.name}” from Academic Portal?\n\nThis unlinks the portal account only. HRMS is not changed.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const response = await apiFetch(`/users/${user.id}`, { method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.message || "Failed to remove user");
      setSelectedId(null);
      setDetail(null);
      await Promise.all([loadUsers(), loadStats()]);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to remove user");
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(
    user: ManagedUser,
    payload: {
      name: string;
      email?: string;
      username?: string;
      currentPassword?: string;
      newPassword?: string;
    },
  ) {
    setBusy(true);
    setActionError(null);
    try {
      const response = await apiFetch(`/users/${user.id}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.message || "Failed to update profile");
      setDetail(body as ManagedUser);
      await loadUsers();
      if (authUser?.id === user.id) await refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to update profile");
      throw error;
    } finally {
      setBusy(false);
    }
  }

  const columns: DataTableColumn<ManagedUser>[] = [
    {
      key: "name",
      header: "Name",
      render: (row) => (
        <div>
          <p className="font-medium text-navy-900">{row.name}</p>
          <p className="text-xs text-slate-500">{row.email || row.username}</p>
        </div>
      ),
    },
    {
      key: "employee",
      header: "Employee ID",
      render: (row) => row.hrmsEmployeeId || (row.isLocalBootstrap ? "—" : "—"),
    },
    {
      key: "hrms",
      header: "HRMS identity",
      render: (row) =>
        row.isLocalBootstrap ? (
          <span className="text-xs text-slate-500">Local bootstrap</span>
        ) : (
          row.username
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <StatusBadge status={row.isActive ? "Active" : "Inactive"} />
      ),
    },
    {
      key: "roles",
      header: "Role",
      render: (row) => {
        const primary = row.roles[0];
        return primary ? (
          <RoleBadge
            roleKey={primary.roleKey}
            label={primary.label}
          />
        ) : (
          <span className="text-xs text-slate-400">None</span>
        );
      },
    },
    {
      key: "scope",
      header: "Courses / Branches Access",
      render: (row) =>
        row.roles.length ? (
          <span className="text-xs text-slate-600 font-medium">
            {formatScopeListCompact(row.roles)}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "lastLogin",
      header: "Last login",
      render: (row) => <span className="text-xs text-slate-600">{formatLastLogin(row.lastLoginAt)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="User Management"
        description="Create and manage users with role-based access. Import staff from the HRMS employees directory, then assign Academic Portal roles and scope here."
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void loadStats()}
              className="text-xs"
              title="Refresh User & Role Statistics"
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Refresh
            </Button>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 shadow-2xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {stats.active} Active / {stats.total} Total
            </span>
          </div>
        }
      />

      {/* INSTITUTIONAL ROLE HEADCOUNT / STATS CARDS */}
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8 sm:gap-3">
        {/* Total Users Card */}
        <StatCard
          compact
          label="Total Users"
          value={stats.total}
          hint={roleKey === "all" ? "● All Roles" : "Click to view all"}
          tone="info"
          selected={roleKey === "all"}
          onClick={() => {
            setTab("users");
            setRoleKey("all");
          }}
          className="transition-all hover:-translate-y-0.5"
        />

        {/* Roles in Hierarchical Order */}
        {displayedRoleStats.map((r) => {
          const isSelected = roleKey === r.roleKey;
          const hLevel = HIERARCHY_ORDER[r.roleKey];
          const levelTag = hLevel ? `L${hLevel}` : "R";
          const style = getRoleStyle(r.roleKey);

          return (
            <StatCard
              key={r.roleKey}
              compact
              badge={
                <span className={cn("rounded px-1 py-0.2 text-[9px] font-bold uppercase", style.pill)}>
                  {levelTag}
                </span>
              }
              label={r.label}
              value={r.totalCount}
              hint={isSelected ? "● Filter active" : `${r.activeCount} active`}
              tone={
                r.roleKey === "super_admin"
                  ? "default"
                  : r.roleKey === "principal" || r.roleKey === "vice_principal"
                  ? "warning"
                  : r.roleKey === "hod"
                  ? "success"
                  : "info"
              }
              selected={isSelected}
              onClick={() => {
                setTab("users");
                setRoleKey(isSelected ? "all" : r.roleKey);
              }}
              className="transition-all hover:-translate-y-0.5"
            />
          );
        })}

        {/* Active Accounts Card */}
        <StatCard
          compact
          label="Active Users"
          value={stats.active}
          hint={stats.inactive > 0 ? `${stats.inactive} inactive` : "100% active"}
          tone="success"
          selected={status === "active"}
          onClick={() => {
            setTab("users");
            setStatus((prev) => (prev === "active" ? "all" : "active"));
          }}
          className="transition-all hover:-translate-y-0.5"
        />
      </div>

      {syncResult && (
        <div
          className={cn(
            "mb-4 flex items-center justify-between rounded-lg border px-4 py-2.5 text-xs",
            syncResult.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900",
          )}
        >
          <div className="flex items-center gap-2">
            <span className="font-medium">{syncResult.message}</span>
          </div>
          <button
            type="button"
            className="ml-3 font-semibold hover:underline"
            onClick={() => setSyncResult(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="mb-4 flex gap-2 border-b border-border">
        {canManage ? (
          <button
            type="button"
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              tab === "create"
                ? "border-navy-800 text-navy-900"
                : "border-transparent text-slate-500 hover:text-navy-800"
            }`}
            onClick={() => setTab("create")}
          >
            Create User
          </button>
        ) : null}
        <button
          type="button"
          className={`border-b-2 px-3 py-2 text-sm font-medium ${
            tab === "users"
              ? "border-navy-800 text-navy-900"
              : "border-transparent text-slate-500 hover:text-navy-800"
          }`}
          onClick={() => setTab("users")}
        >
          All Users ({stats.total})
        </button>
        {canConfigureRoles ? (
          <button
            type="button"
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              tab === "roles"
                ? "border-navy-800 text-navy-900"
                : "border-transparent text-slate-500 hover:text-navy-800"
            }`}
            onClick={() => setTab("roles")}
          >
            Role Configuration
          </button>
        ) : null}
      </div>

      {tab === "create" && canManage ? (
        <CreateUserPanel
          roles={roles}
          colleges={colleges}
          courses={courses}
          branches={masters?.branches ?? []}
          canManage={canManage}
          onCreated={async (user) => {
            await Promise.all([loadUsers(), loadStats()]);
            setTab("users");
            setSelectedId(user.id);
          }}
        />
      ) : null}

      {tab === "roles" && canConfigureRoles ? (
        <RolesPermissionsPanel canManage={canManageRoles} />
      ) : null}

      {tab === "users" ? (
        <>
          <FilterBar>
            <FilterField label="Search">
              <input
                className={inputClass}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Name, email, employee id…"
              />
            </FilterField>
            <FilterField label="Role">
              <select className={selectClass} value={roleKey} onChange={(e) => setRoleKey(e.target.value)}>
                <option value="all">All roles ({stats.total})</option>
                {displayedRoleStats.map((role) => (
                  <option key={role.roleKey} value={role.roleKey}>
                    {role.label} ({role.totalCount})
                  </option>
                ))}
              </select>
            </FilterField>
        <FilterField label="Status">
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </FilterField>
        <FilterField label="College">
          <select
            className={selectClass}
            value={collegeId}
            onChange={(e) => {
              setCollegeId(e.target.value);
              setBranchId("all");
            }}
          >
            <option value="all">All colleges</option>
            {colleges.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Branch">
          <select className={selectClass} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="all">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={String(b.id)}>
                {b.name}
              </option>
            ))}
          </select>
        </FilterField>
        <Button variant="secondary" onClick={() => void loadUsers()}>
          Refresh
        </Button>
      </FilterBar>

      {state.status === "loading" ? (
        <TableSkeleton columns={6} rows={7} showHeader showPagination />
      ) : null}
      {state.status === "error" ? (
        <Card>
          <p className="text-sm text-critical">{state.message}</p>
          <Button className="mt-3" variant="secondary" onClick={() => void loadUsers()}>
            Retry
          </Button>
        </Card>
      ) : null}
      {state.status === "ready" ? (
        <>
          <p className="mb-2 text-xs text-slate-500">{state.total} users</p>
          <DataTable
            columns={columns}
            rows={state.rows}
            rowKey={(row) => String(row.id)}
            emptyMessage={
              canManage
                ? "No portal users yet. Open Create User and import an HRMS login account."
                : "No Academic Portal users match these filters."
            }
            mobileRender={(row) => (
              <div className="flex flex-col gap-1">
                <MobileDataCardHeader
                  title={row.name}
                  status={<StatusBadge status={row.isActive ? "active" : "inactive"} />}
                  secondary={
                    <div className="flex flex-col gap-0.5">
                      <span>{row.email || "—"}</span>
                      {row.isLocalBootstrap && <span className="text-xs text-brand-600">Local Bootstrap Account</span>}
                    </div>
                  }
                />
                <MobileDataCardGrid>
                  <MobileDataCardField
                    label="Role"
                    value={
                      row.roles[0] ? (
                        <div className="mt-0.5">
                          <RoleBadge
                            roleKey={row.roles[0].roleKey}
                            label={row.roles[0].label}
                          />
                        </div>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <MobileDataCardField
                    label="Courses / Branches Access"
                    value={formatScopeListCompact(row.roles)}
                  />
                  <MobileDataCardField label="Last login" value={formatLastLogin(row.lastLoginAt)} />
                </MobileDataCardGrid>
              </div>
            )}
            onRowClick={(row) => setSelectedId(row.id)}
          />
        </>
      ) : null}
        </>
      ) : null}

      {tab === "users" && selectedId != null ? (
        <UserDetailModal
          loading={detailLoading}
          user={detail}
          error={actionError}
          canManage={canManage}
          isSelf={authUser?.id === selectedId}
          busy={busy}
          availableRoles={roles}
          colleges={colleges}
          courses={courses}
          branches={masters?.branches ?? []}
          onClose={() => {
            setSelectedId(null);
            setActionError(null);
          }}
          onEditRoles={() => {
            if (detail && isBootstrapSuperAdmin(detail)) return;
            setRolesOpen(true);
          }}
          onEditPermissions={() => {
            if (detail && isBootstrapSuperAdmin(detail)) return;
            setPermissionsOpen(true);
          }}
          onEditScope={(assignment) => {
            if (detail && isBootstrapSuperAdmin(detail)) return;
            setScopeTarget(assignment);
            setScopeOpen(true);
          }}
          onActivate={() => detail && void setStatusForUser(detail, true)}
          onDeactivate={() => detail && void setStatusForUser(detail, false)}
          onDelete={() => detail && void deleteUser(detail)}
          onSaveProfile={(payload) => {
            if (!detail) return Promise.reject(new Error("No user"));
            return saveProfile(detail, payload);
          }}
        />
      ) : null}

      {rolesOpen && detail && canManage ? (
        <RolesDialog
          user={detail}
          roles={roles}
          colleges={colleges}
          courses={courses}
          branches={masters?.branches ?? []}
          onClose={() => setRolesOpen(false)}
          onSaved={async (user) => {
            setRolesOpen(false);
            setDetail(user);
            await Promise.all([loadUsers(), loadStats()]);
          }}
        />
      ) : null}

      {scopeOpen && detail && scopeTarget && canManage ? (
        <ScopeDialog
          user={detail}
          assignment={scopeTarget}
          roles={roles}
          colleges={colleges}
          courses={courses}
          branches={masters?.branches ?? []}
          onClose={() => {
            setScopeOpen(false);
            setScopeTarget(null);
          }}
          onSaved={async (user) => {
            setScopeOpen(false);
            setScopeTarget(null);
            setDetail(user);
            await Promise.all([loadUsers(), loadStats()]);
          }}
        />
      ) : null}

      {permissionsOpen && detail && canManage ? (
        <UserPermissionsModal
          user={detail}
          onClose={() => setPermissionsOpen(false)}
          onSaved={async (user) => {
            setPermissionsOpen(false);
            setDetail(user);
            await Promise.all([loadUsers(), loadStats()]);
          }}
        />
      ) : null}
    </div>
  );
}

type UserPermissionItem = {
  key: string;
  label: string;
  kind: "read" | "write";
  source: "role" | "direct" | "both";
  revoked: boolean;
};

function buildUserPermissionGroups(user: ManagedUser) {
  const enabled = new Set(user.permissions ?? []);
  const revoked = new Set(user.revokedPermissions ?? []);
  const rolePerms = new Set(user.rolePermissions ?? []);
  const directPerms = new Set(user.directPermissions ?? []);
  const matrixKeys = new Set(allMatrixPermissionKeys());
  const byGroup = new Map<string, UserPermissionItem[]>();

  const addItem = (group: string, item: UserPermissionItem) => {
    const list = byGroup.get(group) ?? [];
    if (!list.some((row) => row.key === item.key)) list.push(item);
    byGroup.set(group, list);
  };

  for (const mod of PERMISSION_MATRIX_MODULES) {
    for (const perm of mod.permissions) {
      if (!enabled.has(perm.key) && !revoked.has(perm.key)) continue;
      const fromRole = rolePerms.has(perm.key);
      const fromDirect = directPerms.has(perm.key);
      addItem(mod.group, {
        key: perm.key,
        label: perm.label,
        kind: perm.kind,
        source: fromRole && fromDirect ? "both" : fromDirect ? "direct" : "role",
        revoked: revoked.has(perm.key),
      });
    }
  }

  for (const key of new Set([...enabled, ...revoked])) {
    if (matrixKeys.has(key)) continue;
    const meta = PERMISSION_PRESENTATION[key];
    const fromRole = rolePerms.has(key);
    const fromDirect = directPerms.has(key);
    addItem("Other", {
      key,
      label: meta?.label ?? key,
      kind: meta?.kind ?? (key.endsWith(".view") ? "read" : "write"),
      source: fromRole && fromDirect ? "both" : fromDirect ? "direct" : "role",
      revoked: revoked.has(key),
    });
  }

  return [...byGroup.entries()].map(([title, items]) => ({
    title,
    items: items.sort((a, b) => a.label.localeCompare(b.label)),
  }));
}

type CollegeScopeView = {
  collegeId: number;
  collegeName: string;
  allCollege: boolean;
  branches: Array<{ branchId: number; branchName: string; courseName?: string }>;
  global?: boolean;
};

function buildAssignedScopes(
  roles: RoleAssignment[],
  colleges: Array<{ id: number; name: string }>,
  courses: Array<{ id: number; name: string; collegeId: number }>,
  branches: Array<{ id: number; name: string; courseId: number }>,
): CollegeScopeView[] {
  if (roles.some((role) => role.collegeId == null && role.branchId == null)) {
    return [{ collegeId: 0, collegeName: "Global", allCollege: true, branches: [], global: true }];
  }

  const byCollege = new Map<number, { allCollege: boolean; branchIds: Set<number> }>();
  for (const role of roles) {
    if (role.collegeId == null) continue;
    const entry = byCollege.get(role.collegeId) ?? {
      allCollege: false,
      branchIds: new Set<number>(),
    };
    if (role.branchId == null) entry.allCollege = true;
    else entry.branchIds.add(role.branchId);
    byCollege.set(role.collegeId, entry);
  }

  return [...byCollege.entries()].map(([collegeId, entry]) => {
    const collegeName =
      colleges.find((college) => college.id === collegeId)?.name ??
      roles.find((role) => role.collegeId === collegeId)?.collegeName ??
      `College #${collegeId}`;
    const branchList = [...entry.branchIds].map((branchId) => {
      const branch = branches.find((row) => row.id === branchId);
      const course = branch ? courses.find((row) => row.id === branch.courseId) : null;
      return {
        branchId,
        branchName:
          roles.find((role) => role.branchId === branchId)?.branchName ??
          branch?.name ??
          `#${branchId}`,
        courseName: course?.name,
      };
    });
    return {
      collegeId,
      collegeName,
      allCollege: entry.allCollege,
      branches: branchList.sort((a, b) => a.branchName.localeCompare(b.branchName)),
    };
  });
}

function UserDetailModal(props: {
  loading: boolean;
  user: ManagedUser | null;
  error: string | null;
  canManage: boolean;
  isSelf: boolean;
  busy: boolean;
  availableRoles: ApRoleOption[];
  colleges: Array<{ id: number; name: string }>;
  courses: Array<{ id: number; name: string; collegeId: number }>;
  branches: Array<{ id: number; name: string; courseId: number }>;
  onClose: () => void;
  onEditRoles: () => void;
  onEditPermissions: () => void;
  onEditScope: (assignment: RoleAssignment) => void;
  onActivate: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
  onSaveProfile: (payload: {
    name: string;
    email?: string;
    username?: string;
    currentPassword?: string;
    newPassword?: string;
  }) => Promise<void>;
}) {
  const user = props.user;
  const bootstrapSuperAdmin = user ? isBootstrapSuperAdmin(user) : false;
  const canManageRolesAndScope = props.canManage && !bootstrapSuperAdmin;
  const canEditProfile =
    Boolean(user) && (props.isSelf || props.canManage) && (user?.isLocalBootstrap || props.canManage);
  const canEditIdentity = Boolean(user?.isLocalBootstrap) && (props.isSelf || props.canManage);
  const canChangePassword = Boolean(user?.isLocalBootstrap && props.isSelf);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [editing, setEditing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const permissionGroups = useMemo(
    () => (user ? buildUserPermissionGroups(user) : []),
    [user],
  );
  const permissionSummary = useMemo(
    () => summarizeRoleAccess(new Set(user?.permissions ?? [])),
    [user?.permissions],
  );
  const assignedRoleKeys = useMemo(
    () => new Set(user?.roles.map((role) => role.roleKey) ?? []),
    [user?.roles],
  );
  const assignedScopes = useMemo(
    () =>
      user
        ? buildAssignedScopes(user.roles, props.colleges, props.courses, props.branches)
        : [],
    [user, props.colleges, props.courses, props.branches],
  );
  const displayRoles = useMemo(
    () =>
      props.availableRoles.filter(
        (role) => role.roleKey !== "super_admin" || assignedRoleKeys.has("super_admin"),
      ),
    [props.availableRoles, assignedRoleKeys],
  );

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setEmail(user.email ?? "");
    setUsername(user.username);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setEditing(false);
    setLocalError(null);
  }, [user?.id, user?.name, user?.email, user?.username]);

  async function save() {
    if (!user) return;
    setLocalError(null);
    if (!name.trim()) {
      setLocalError("Name is required");
      return;
    }
    if (canEditIdentity && !username.trim()) {
      setLocalError("Username is required");
      return;
    }
    if (newPassword || confirmPassword || currentPassword) {
      if (!canChangePassword) {
        setLocalError("Only you can change the Super Admin password");
        return;
      }
      if (!currentPassword) {
        setLocalError("Enter your current password to set a new one");
        return;
      }
      if (newPassword.length < 8) {
        setLocalError("New password must be at least 8 characters");
        return;
      }
      if (newPassword !== confirmPassword) {
        setLocalError("New password and confirmation do not match");
        return;
      }
    }

    try {
      await props.onSaveProfile({
        name: name.trim(),
        ...(canEditIdentity
          ? { email: email.trim(), username: username.trim() }
          : {}),
        ...(canChangePassword && newPassword
          ? { currentPassword, newPassword }
          : {}),
      });
      setEditing(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      /* parent sets actionError */
    }
  }

  return (
    <Modal
      title={user ? `User · ${user.name}` : "User details"}
      onClose={props.onClose}
      wide
      headerActions={
        user && props.canManage && !bootstrapSuperAdmin ? (
          <>
            {user.isActive ? (
              <Button
                size="sm"
                variant="danger"
                disabled={props.busy || props.isSelf}
                onClick={props.onDeactivate}
              >
                Deactivate
              </Button>
            ) : (
              <Button size="sm" disabled={props.busy} onClick={props.onActivate}>
                Activate
              </Button>
            )}
            {!user.isLocalBootstrap ? (
              <Button size="sm" variant="danger" disabled={props.busy} onClick={props.onDelete}>
                Remove from portal
              </Button>
            ) : null}
          </>
        ) : null
      }
    >
      {props.loading ? (
        <div className="space-y-4 py-2 portal-fade-in" aria-busy="true" aria-label="Loading user details…">
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="rounded-xl border border-border bg-slate-50/50 p-4 space-y-3">
              <Skeleton className="h-5 w-32 rounded" />
              <Skeleton className="h-4 w-48 rounded" />
              <Skeleton className="h-4 w-36 rounded" />
            </div>
            <div className="rounded-xl border border-border bg-slate-50/50 p-4 space-y-3">
              <Skeleton className="h-5 w-32 rounded" />
              <Skeleton className="h-4 w-48 rounded" />
              <Skeleton className="h-4 w-36 rounded" />
            </div>
            <div className="rounded-xl border border-border bg-slate-50/50 p-4 space-y-3">
              <Skeleton className="h-5 w-32 rounded" />
              <Skeleton className="h-4 w-48 rounded" />
              <Skeleton className="h-4 w-36 rounded" />
            </div>
          </div>
        </div>
      ) : null}
      {props.error ? <p className="mb-3 text-sm text-critical">{props.error}</p> : null}
      {localError ? <p className="mb-3 text-sm text-critical">{localError}</p> : null}

      {user ? (
        <div className="space-y-5">
          <div className="grid gap-4 xl:grid-cols-3">
            {/* 1 · User Information */}
            <section className="rounded-xl border border-sky-200 bg-sky-50/40 p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white">
                    1
                  </span>
                  <h3 className="text-sm font-semibold text-navy-900">User Information</h3>
                </div>
                {canEditProfile && !editing ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={props.busy}
                    onClick={() => {
                      setEditing(true);
                      setLocalError(null);
                    }}
                  >
                    Edit details
                  </Button>
                ) : null}
              </div>

              {!editing ? (
                <>
                  <label className="mb-3 block text-xs font-medium text-slate-600">
                    Full Name
                    <input className={fieldClass} value={user.name} disabled />
                  </label>
                  <label className="mb-3 block text-xs font-medium text-slate-600">
                    Email Address
                    <input className={fieldClass} value={user.email || "—"} disabled />
                  </label>
                  <label className="mb-3 block text-xs font-medium text-slate-600">
                    Username
                    <input className={fieldClass} value={user.username} disabled />
                  </label>
                  <label className="mb-3 block text-xs font-medium text-slate-600">
                    Employee ID
                    <input className={fieldClass} value={user.hrmsEmployeeId || "—"} disabled />
                  </label>
                  <div className="mb-3 flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                    <span className="text-slate-600">Status</span>
                    <StatusBadge status={user.isActive ? "Active" : "Inactive"} />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Last login: {formatLastLogin(user.lastLoginAt)} ·{" "}
                    {user.isLocalBootstrap ? "Local Super Admin" : "HRMS-linked"}
                  </p>
                </>
              ) : (
                <div className="space-y-3">
                  <label className="block text-xs font-medium text-slate-600">
                    Display name
                    <input
                      className={fieldClass}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  {canEditIdentity ? (
                    <div className="space-y-3">
                      <label className="block text-xs font-medium text-slate-600">
                        Username
                        <input
                          className={fieldClass}
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          autoComplete="username"
                        />
                      </label>
                      <label className="block text-xs font-medium text-slate-600">
                        Email
                        <input
                          className={fieldClass}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          autoComplete="email"
                        />
                      </label>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Username and email for HRMS-linked users are managed in HRMS.
                    </p>
                  )}
                  {canChangePassword ? (
                    <div className="space-y-2 border-t border-slate-200 pt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Change password
                      </p>
                      <input
                        type="password"
                        className={fieldClass}
                        placeholder="Current password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        autoComplete="current-password"
                      />
                      <input
                        type="password"
                        className={fieldClass}
                        placeholder="New password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                      <input
                        type="password"
                        className={fieldClass}
                        placeholder="Confirm password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                    </div>
                  ) : null}
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="secondary"
                      disabled={props.busy}
                      onClick={() => {
                        setEditing(false);
                        setLocalError(null);
                        setName(user.name);
                        setEmail(user.email ?? "");
                        setUsername(user.username);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button disabled={props.busy} onClick={() => void save()}>
                      {props.busy ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </div>
              )}
            </section>

            {/* 2 · Role Selection */}
            <section className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-700 text-xs font-bold text-white">
                    2
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-navy-900">User Role</h3>
                    <p className="text-[11px] text-slate-500">Single assigned role</p>
                  </div>
                </div>
                {canManageRolesAndScope ? (
                  <Button size="sm" variant="secondary" onClick={props.onEditRoles}>
                    Edit role &amp; scope
                  </Button>
                ) : null}
              </div>

              {bootstrapSuperAdmin ? (
                <div className="rounded-lg border border-purple-300 bg-white px-3 py-2.5 text-sm text-slate-600">
                  System Administrator — global scope (fixed for bootstrap account).
                </div>
              ) : user.roles.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
                  <p className="text-xs text-slate-500">No role assigned to this user yet.</p>
                </div>
              ) : (
                (() => {
                  const primary = user.roles[0];
                  const style = getRoleStyle(primary.roleKey);
                  const roleMeta = displayRoles.find((r) => r.roleKey === primary.roleKey);
                  return (
                    <div
                      className={cn(
                        "flex w-full items-start gap-3 rounded-lg border px-3.5 py-3 text-left transition-all",
                        style.cardActive,
                        style.border,
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                          style.iconBg,
                          style.iconText,
                        )}
                      >
                        <UserRound className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-navy-900">{primary.label}</span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                              style.pill,
                            )}
                          >
                            Single Role
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">
                          {roleMeta?.description ||
                            (roleMeta?.isGlobalCapable
                              ? "Global role — institute-wide access."
                              : "Multi-course and branch scoped access.")}
                        </p>
                        <div className="mt-2 flex items-center gap-2 text-[11px] font-medium text-slate-600">
                          <span>Scope:</span>
                          <span className="font-semibold text-navy-900">
                            {user.roles.length} course/branch access point{user.roles.length === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}
            </section>

            {/* 3 · Access Scope */}
            <section className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold text-white">
                    3
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-navy-900">Courses &amp; Branches Access</h3>
                    <p className="text-[11px] text-slate-500">Multi-course &amp; branch scope</p>
                  </div>
                </div>
                {canManageRolesAndScope && user.roles.length > 0 ? (
                  <Button size="sm" variant="secondary" onClick={props.onEditRoles}>
                    Edit scope
                  </Button>
                ) : null}
              </div>

              {/* Year Access representation */}
              <YearAccessControl
                selectedYears={getUserYearAccess(user.id, ["all"])}
                roleTitle={user.roles.some((r) => r.roleKey === "hod") ? "HOD" : user.roles[0]?.label || "user"}
                readOnly
              />

              {bootstrapSuperAdmin ? (
                <div className="rounded-lg border border-emerald-200 bg-white px-3 py-4 text-sm text-slate-600">
                  Global access — no college / course / branch selection.
                </div>
              ) : assignedScopes.length === 0 ? (
                <p className="text-sm text-slate-500">No access scope assigned yet.</p>
              ) : (
                <div className="max-h-[22rem] space-y-2 overflow-y-auto pr-1">
                  {assignedScopes.map((collegeScope) => (
                    <div
                      key={collegeScope.collegeId}
                      className="rounded-lg border border-emerald-300 bg-white px-3 py-2.5 ring-1 ring-emerald-100"
                    >
                      <label className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700"
                          checked
                          disabled
                          readOnly
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-navy-900">
                            {collegeScope.collegeName}
                          </span>
                          {collegeScope.global ? (
                            <span className="text-[11px] text-slate-500">Global role scope</span>
                          ) : collegeScope.allCollege ? (
                            <span className="text-[11px] text-slate-500">Whole college access</span>
                          ) : (
                            <span className="text-[11px] text-slate-500">
                              {collegeScope.branches.length} branch
                              {collegeScope.branches.length === 1 ? "" : "es"}
                            </span>
                          )}
                        </span>
                      </label>

                      {!collegeScope.global && !collegeScope.allCollege && collegeScope.branches.length > 0 ? (
                        <div className="mt-2 space-y-1 border-t border-slate-100 pt-2 pl-6">
                          {collegeScope.branches.map((branch) => {
                            const assignment = user.roles.find((row) => row.branchId === branch.branchId);
                            return (
                              <label
                                key={branch.branchId}
                                className="flex items-center gap-2 text-xs text-slate-700"
                              >
                                <input
                                  type="checkbox"
                                  className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-700"
                                  checked
                                  disabled
                                  readOnly
                                />
                                <span className="min-w-0 flex-1">
                                  {branch.branchName}
                                  {branch.courseName ? (
                                    <span className="text-slate-500"> · {branch.courseName}</span>
                                  ) : null}
                                </span>
                                {canManageRolesAndScope && assignment ? (
                                  <button
                                    type="button"
                                    className="text-[11px] font-medium text-emerald-800 hover:underline"
                                    onClick={() => props.onEditScope(assignment)}
                                  >
                                    Edit
                                  </button>
                                ) : null}
                              </label>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* TEACHING SCOPE & STUDENT ACCESS ARCHITECTURE */}
          <section className="rounded-xl border border-blue-200 bg-linear-to-b from-blue-50/50 to-white p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-blue-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-700 text-xs font-bold text-white shadow-2xs">
                  <BookOpen className="w-3.5 h-3.5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-blue-950">
                    Teaching Scope &amp; Student Access Architecture
                  </h3>
                  <p className="text-xs text-slate-500">
                    Difference between Subject Teaching Students vs Role-Based Assigned Students
                  </p>
                </div>
              </div>
              {user.teachingScope && (
                <div className="flex items-center gap-2">
                  <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-1 rounded-lg">
                    {user.teachingScope.totalTeachingStudents} Teaching Students
                  </span>
                  <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-2 py-1 rounded-lg">
                    {user.teachingScope.subjectsCount} Subjects
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Box A: Assigned Timetable Subjects (Teaching Students) */}
              <div className="rounded-xl border border-blue-200/80 bg-white p-3.5 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    <span>Teaching Subjects &amp; Classroom Access</span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500">
                    From Timetable Assignments
                  </span>
                </div>

                {user.teachingScope?.subjects && user.teachingScope.subjects.length > 0 ? (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {user.teachingScope.subjects.map((sub, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 flex items-center justify-between gap-2 hover:bg-blue-50/40 transition"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">
                            {sub.subjectName}
                          </p>
                          <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span className="font-semibold text-blue-700">{sub.subjectCode}</span>
                            {sub.sectionName && (
                              <span className="bg-white border border-slate-200 px-1 rounded text-[10px]">
                                Sec {sub.sectionName}
                              </span>
                            )}
                            <span className="truncate">{sub.branchName}</span>
                          </p>
                        </div>
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs px-2 py-0.5 rounded-full shrink-0">
                          {sub.studentCount} students
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200 text-xs text-slate-500">
                    No active published timetable subjects assigned. Subject assignments in timetables
                    automatically grant teaching student access, attendance posting, and subject marks.
                  </div>
                )}
              </div>

              {/* Box B: Role-Based Assigned Students & Organizational Hierarchy */}
              <div className="rounded-xl border border-teal-200/80 bg-white p-3.5 shadow-2xs space-y-2.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-teal-900">
                      <GraduationCap className="w-4 h-4 text-teal-600" />
                      <span>Role-Based Assigned Student Scope</span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500">
                      Organizational Hierarchy
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    {/* Role description card */}
                    <div className="p-2.5 rounded-lg border border-teal-100 bg-teal-50/50 text-slate-700 leading-relaxed">
                      {user.roles[0]?.roleKey === "super_admin" && (
                        <p>
                          <strong className="text-purple-900">Super Admin (Level 1):</strong> Full
                          institute-wide authority over all colleges, staff, and students.
                        </p>
                      )}
                      {(user.roles[0]?.roleKey === "principal" ||
                        user.roles[0]?.roleKey === "vice_principal") && (
                        <p>
                          <strong className="text-amber-900">
                            {user.roles[0]?.label} (Level 2):
                          </strong>{" "}
                          College-wide oversight across all departments, faculties, and students.
                        </p>
                      )}
                      {user.roles[0]?.roleKey === "hod" && (
                        <p>
                          <strong className="text-emerald-900">HOD (Level 3):</strong> Department
                          head overseeing all sections, combined branches, and faculty within the
                          department.
                        </p>
                      )}
                      {user.roles[0]?.roleKey === "class_teacher" && (
                        <p>
                          <strong className="text-teal-900">Class Teacher (Level 4):</strong> Section
                          In-Charge with assigned class students for mentoring, section attendance,
                          progress tracking, and interventions.
                        </p>
                      )}
                      {(!user.roles[0] ||
                        user.roles[0]?.roleKey === "staff" ||
                        user.roles[0]?.roleKey === "faculty") && (
                        <p>
                          <strong className="text-cyan-900">Subject Faculty (Level 5):</strong> Staff
                          login scoped strictly to assigned teaching subjects, subject timetables, and
                          teaching students reports.
                        </p>
                      )}
                    </div>

                    {/* Hierarchy order trail */}
                    <div className="pt-1.5">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                        Management Hierarchy Order:
                      </p>
                      <div className="flex flex-wrap items-center gap-1 text-[11px] font-semibold text-slate-600">
                        <span className="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded">
                          Super Admin
                        </span>
                        <span>→</span>
                        <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                          Principal / VP
                        </span>
                        <span>→</span>
                        <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                          HOD
                        </span>
                        <span>→</span>
                        <span className="bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded">
                          Class Teacher
                        </span>
                        <span>→</span>
                        <span className="bg-cyan-100 text-cyan-800 px-1.5 py-0.5 rounded">
                          Subject Faculty
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 italic pt-1">
                  Subject Faculty teach their course students, whereas Class Teachers, HODs, and
                  Principals hold administrative student mentorship &amp; oversight.
                </p>
              </div>
            </div>
          </section>

          {/* 4 · Effective permissions (3-column grid) */}
          <section className="rounded-xl border border-border bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
              <div>
                <h3 className="text-sm font-semibold text-navy-900">Effective permissions</h3>
                <p className="text-xs text-slate-500">
                  {permissionSummary.modulesWithAccess} modules · {permissionSummary.read} read ·{" "}
                  {permissionSummary.write} write
                </p>
              </div>
              {canManageRolesAndScope ? (
                <Button size="sm" variant="secondary" onClick={props.onEditPermissions}>
                  Edit direct permissions
                </Button>
              ) : null}
            </div>
            <div className="px-5 py-4">
              {permissionGroups.length === 0 ? (
                <p className="text-sm text-slate-500">No permissions from roles or direct grants.</p>
              ) : (
                <div className="space-y-6">
                  {permissionGroups.map((group) => (
                    <div key={group.title}>
                      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {group.title}
                      </h4>
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {group.items.map((item) => (
                          <div
                            key={item.key}
                            className={`rounded-lg border px-3 py-2.5 ${
                              item.revoked
                                ? "border-red-200 bg-red-50/50"
                                : "border-border bg-slate-50/60"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p
                                  className={`text-sm font-medium leading-snug ${
                                    item.revoked
                                      ? "text-red-700 line-through"
                                      : "text-navy-900"
                                  }`}
                                >
                                  {item.label}
                                </p>
                                <p className="mt-0.5 text-[11px] text-slate-500">{item.key}</p>
                              </div>
                              <input
                                type="checkbox"
                                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-navy-800"
                                checked={!item.revoked}
                                disabled
                                readOnly
                                aria-label={item.label}
                              />
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 ring-1 ring-border">
                                {item.kind}
                              </span>
                              {item.source === "direct" || item.source === "both" ? (
                                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-700 ring-1 ring-blue-200">
                                  Direct
                                </span>
                              ) : (
                                <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 ring-1 ring-border">
                                  Role
                                </span>
                              )}
                              {item.revoked ? (
                                <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red-700">
                                  Revoked
                                </span>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </Modal>
  );
}

function branchesForCollege(
  branches: Array<{ id: number; name: string; courseId: number }>,
  courses: Array<{ id: number; name?: string; collegeId: number }>,
  collegeId: string,
) {
  if (!collegeId) return branches;
  const cid = Number(collegeId);
  const courseIds = new Set(courses.filter((c) => c.collegeId === cid).map((c) => c.id));
  return branches.filter((b) => courseIds.has(b.courseId));
}

function coursesForCollegeId(
  courses: Array<{ id: number; name: string; collegeId: number }>,
  collegeId: string,
) {
  if (!collegeId) return [];
  const cid = Number(collegeId);
  return courses.filter((c) => c.collegeId === cid);
}

function branchesForCourseId(
  branches: Array<{ id: number; name: string; courseId: number }>,
  courseId: string,
) {
  if (!courseId) return [];
  const id = Number(courseId);
  return branches.filter((b) => b.courseId === id);
}

function inferCourseIdForBranch(
  branches: Array<{ id: number; name: string; courseId: number }>,
  branchId: number | null,
): string {
  if (branchId == null) return "";
  const branch = branches.find((b) => b.id === branchId);
  return branch ? String(branch.courseId) : "";
}

type CourseScopeDraft = {
  allBranches: boolean;
  branchIds: number[];
};

type CollegeScopeDraft = {
  allCollege: boolean;
  courses: Record<number, CourseScopeDraft>;
};

function buildInitialCollegeScopes(
  roles: RoleAssignment[],
  branches: Array<{ id: number; name: string; courseId: number }>,
): Record<number, CollegeScopeDraft> {
  const result: Record<number, CollegeScopeDraft> = {};
  for (const r of roles) {
    if (r.collegeId == null) continue;
    const collegeId = Number(r.collegeId);
    if (!result[collegeId]) {
      result[collegeId] = {
        allCollege: false,
        courses: {},
      };
    }
    const collegeDraft = result[collegeId];
    if (r.branchId == null) {
      collegeDraft.allCollege = true;
    } else {
      const branchId = Number(r.branchId);
      const bObj = branches.find((b) => b.id === branchId);
      if (bObj) {
        const courseId = bObj.courseId;
        if (!collegeDraft.courses[courseId]) {
          collegeDraft.courses[courseId] = {
            allBranches: false,
            branchIds: [],
          };
        }
        if (!collegeDraft.courses[courseId].branchIds.includes(branchId)) {
          collegeDraft.courses[courseId].branchIds.push(branchId);
        }
      }
    }
  }
  return result;
}

function RolesDialog(props: {
  user: ManagedUser;
  roles: ApRoleOption[];
  colleges: Array<{ id: number; name: string }>;
  courses: Array<{ id: number; name: string; collegeId: number }>;
  branches: Array<{ id: number; name: string; courseId: number }>;
  onClose: () => void;
  onSaved: (user: ManagedUser) => Promise<void>;
}) {
  const creatableRoles = useMemo(() => {
    const list = [...props.roles];
    if (!list.some((r) => r.roleKey === "class_teacher")) {
      list.push({
        id: 9999,
        roleKey: "class_teacher",
        label: "Class Teacher",
        description: "Class Teacher / Section In-Charge — section students roster & mentoring",
        isGlobalCapable: false,
        permissions: [],
      });
    }
    const filtered = list.filter(
      (r) =>
        r.roleKey !== "super_admin" ||
        props.user.roles.some((x) => x.roleKey === "super_admin"),
    );
    return filtered.sort(
      (a, b) => (HIERARCHY_ORDER[a.roleKey] ?? 99) - (HIERARCHY_ORDER[b.roleKey] ?? 99),
    );
  }, [props.roles, props.user.roles]);

  const initialRoleKey =
    props.user.roles[0]?.roleKey ?? creatableRoles[0]?.roleKey ?? "staff";
  const [selectedRoleKey, setSelectedRoleKey] = useState<string>(initialRoleKey);
  const [selectedYears, setSelectedYears] = useState<string[]>(() =>
    getUserYearAccess(props.user.id, ["all"]),
  );
  const [collegeScopes, setCollegeScopes] = useState<Record<number, CollegeScopeDraft>>(() =>
    buildInitialCollegeScopes(props.user.roles, props.branches),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedRoleMeta = props.roles.find((r) => r.roleKey === selectedRoleKey);
  const isGlobal = Boolean(selectedRoleMeta?.isGlobalCapable);

  function toggleCollege(collegeId: number) {
    setCollegeScopes((prev) => {
      if (prev[collegeId]) {
        const next = { ...prev };
        delete next[collegeId];
        return next;
      }
      return {
        ...prev,
        [collegeId]: { allCollege: true, courses: {} },
      };
    });
    setError(null);
  }

  function setCollegeMode(collegeId: number, allCollege: boolean) {
    setCollegeScopes((prev) => {
      const current = prev[collegeId];
      if (!current) return prev;
      return {
        ...prev,
        [collegeId]: allCollege
          ? { allCollege: true, courses: {} }
          : { allCollege: false, courses: current.courses },
      };
    });
    setError(null);
  }

  function toggleCourse(collegeId: number, courseId: number) {
    setCollegeScopes((prev) => {
      const current = prev[collegeId];
      if (!current) return prev;
      const courses = { ...current.courses };
      if (courses[courseId]) {
        delete courses[courseId];
      } else {
        courses[courseId] = { allBranches: true, branchIds: [] };
      }
      return {
        ...prev,
        [collegeId]: { allCollege: false, courses },
      };
    });
    setError(null);
  }

  function setCourseBranchMode(collegeId: number, courseId: number, allBranches: boolean) {
    setCollegeScopes((prev) => {
      const current = prev[collegeId];
      const course = current?.courses[courseId];
      if (!current || !course) return prev;
      return {
        ...prev,
        [collegeId]: {
          allCollege: false,
          courses: {
            ...current.courses,
            [courseId]: allBranches
              ? { allBranches: true, branchIds: [] }
              : { allBranches: false, branchIds: course.branchIds },
          },
        },
      };
    });
    setError(null);
  }

  function toggleBranch(collegeId: number, courseId: number, branchId: number) {
    setCollegeScopes((prev) => {
      const current = prev[collegeId];
      const course = current?.courses[courseId];
      if (!current || !course) return prev;
      const has = course.branchIds.includes(branchId);
      const branchIds = has
        ? course.branchIds.filter((id) => id !== branchId)
        : [...course.branchIds, branchId];
      return {
        ...prev,
        [collegeId]: {
          allCollege: false,
          courses: {
            ...current.courses,
            [courseId]: { allBranches: false, branchIds },
          },
        },
      };
    });
    setError(null);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (!selectedRoleKey) {
        throw new Error("Please select a role for the user.");
      }

      const assignments: Array<{
        roleKey: string;
        collegeId: number | null;
        branchId: number | null;
      }> = [];

      if (isGlobal) {
        assignments.push({ roleKey: selectedRoleKey, collegeId: null, branchId: null });
      } else {
        const selectedCollegeIds = Object.keys(collegeScopes).map(Number);
        if (!selectedCollegeIds.length) {
          throw new Error("Please select at least one college for this role's scope.");
        }

        for (const collegeId of selectedCollegeIds) {
          const draft = collegeScopes[collegeId];
          if (!draft) continue;

          if (draft.allCollege) {
            assignments.push({ roleKey: selectedRoleKey, collegeId, branchId: null });
            continue;
          }

          const courseIds = Object.keys(draft.courses).map(Number);
          if (!courseIds.length) {
            throw new Error(
              "Please select at least one course for the selected college, or select 'Entire college'."
            );
          }

          for (const courseId of courseIds) {
            const courseDraft = draft.courses[courseId];
            const courseBranches = props.branches.filter((b) => b.courseId === courseId);

            if (courseDraft.allBranches) {
              if (!courseBranches.length) {
                throw new Error("Selected course has no branches configured.");
              }
              for (const branch of courseBranches) {
                assignments.push({
                  roleKey: selectedRoleKey,
                  collegeId,
                  branchId: branch.id,
                });
              }
            } else {
              if (!courseDraft.branchIds.length) {
                throw new Error(
                  "Please select at least one branch or choose 'All branches in this course'."
                );
              }
              for (const branchId of courseDraft.branchIds) {
                assignments.push({
                  roleKey: selectedRoleKey,
                  collegeId,
                  branchId,
                });
              }
            }
          }
        }
      }

      // Deduplicate
      const seen = new Set<string>();
      const uniqueAssignments = assignments.filter((s) => {
        const key = `${s.roleKey}:${s.collegeId ?? "null"}:${s.branchId ?? "null"}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const response = await apiFetch(`/users/${props.user.id}/roles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments: uniqueAssignments }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.message || "Failed to update role & scope");
      setUserYearAccess(props.user.id, selectedYears);
      await props.onSaved(body as ManagedUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role & scope");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Edit Role & Scope — ${props.user.name}`} onClose={props.onClose}>
      <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50/70 p-3">
        <label className="text-xs font-bold text-blue-950">
          User Role (Single Role)
          <select
            className={`${selectClass} mt-1 w-full bg-white font-semibold text-slate-900 border-blue-300`}
            value={selectedRoleKey}
            onChange={(e) => {
              setSelectedRoleKey(e.target.value);
              const meta = props.roles.find((r) => r.roleKey === e.target.value);
              if (meta?.isGlobalCapable) {
                setCollegeScopes({});
              }
              setError(null);
            }}
          >
            {creatableRoles.map((r) => {
              const hierarchyIndex = HIERARCHY_ORDER[r.roleKey];
              const prefix = hierarchyIndex ? `[L${hierarchyIndex}] ` : "";
              return (
                <option key={r.roleKey} value={r.roleKey}>
                  {prefix}
                  {r.label} —{" "}
                  {r.roleKey === "super_admin"
                    ? "Institute-wide Authority"
                    : r.roleKey === "principal"
                    ? "College-wide Leadership"
                    : r.roleKey === "vice_principal"
                    ? "Academic & Timetable Oversight"
                    : r.roleKey === "hod"
                    ? "Department & Combined Branches"
                    : r.roleKey === "class_teacher"
                    ? "Section / Class In-Charge & Mentoring"
                    : "Subject Faculty & Teaching Access"}
                </option>
              );
            })}
          </select>
        </label>
        <p className="mt-1 text-[11px] text-blue-800">
          <strong>Hierarchy Order:</strong> Super Admin (L1) → Principal/VP (L2) → HOD (L3) → Class Teacher (L4) → Subject Faculty (L5). Pure subject faculty have teaching student access; Class Teachers, HODs, and Principals have role-assigned student oversight.
        </p>
      </div>

      {isGlobal ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
          This role has institute-wide global access (no specific college/branch restriction required).
        </div>
      ) : (
        <div className="space-y-3">
          {/* Year Access */}
          <YearAccessControl
            selectedYears={selectedYears}
            onChange={setSelectedYears}
            roleTitle={selectedRoleKey === "hod" ? "HOD" : selectedRoleMeta?.label || "user"}
          />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-800">
                Courses &amp; Branches Multi-Selection Scope
              </p>
              <p className="text-[11px] text-slate-500">
                Select colleges, multiple courses, and branches below. Select entire colleges, combined courses, or specific branches.
              </p>
            </div>
            <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-800 border border-blue-200">
              Multi-Select
            </span>
          </div>

          <div className="max-h-[22rem] space-y-2.5 overflow-y-auto pr-1">
            {props.colleges.map((college) => {
              const checked = Boolean(collegeScopes[college.id]);
              const draft = collegeScopes[college.id];
              const collegeCourses = props.courses.filter((c) => c.collegeId === college.id);

              return (
                <div
                  key={college.id}
                  className={cn(
                    "rounded-xl border bg-white p-3 transition-all",
                    checked ? "border-navy-700 ring-1 ring-navy-800/10 shadow-xs" : "border-slate-200"
                  )}
                >
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-navy-800 focus:ring-navy-700/20"
                      checked={checked}
                      onChange={() => toggleCollege(college.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-navy-900">{college.name}</span>
                        <span className="text-[11px] text-slate-500">
                          {collegeCourses.length} course{collegeCourses.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                  </label>

                  {checked && draft ? (
                    <div className="mt-2.5 space-y-2.5 border-t border-slate-100 pt-2.5 pl-6">
                      <div className="flex flex-wrap gap-4 text-xs">
                        <label className="flex cursor-pointer items-center gap-1.5 font-medium text-slate-700">
                          <input
                            type="radio"
                            name={`dialog-college-mode-${college.id}`}
                            checked={draft.allCollege}
                            onChange={() => setCollegeMode(college.id, true)}
                            className="h-3.5 w-3.5 border-slate-300 text-navy-800 focus:ring-navy-700/20"
                          />
                          Entire College (All Courses &amp; Branches)
                        </label>
                        <label className="flex cursor-pointer items-center gap-1.5 font-medium text-slate-700">
                          <input
                            type="radio"
                            name={`dialog-college-mode-${college.id}`}
                            checked={!draft.allCollege}
                            onChange={() => setCollegeMode(college.id, false)}
                            className="h-3.5 w-3.5 border-slate-300 text-navy-800 focus:ring-navy-700/20"
                          />
                          Specific Courses &amp; Branches
                        </label>
                      </div>

                      {!draft.allCollege ? (
                        collegeCourses.length === 0 ? (
                          <p className="text-[11px] text-amber-800">
                            No courses available for this college.
                          </p>
                        ) : (
                          <div className="space-y-2 mt-2">
                            <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                              Select Courses:
                            </p>
                            {collegeCourses.map((course) => {
                              const courseChecked = Boolean(draft.courses[course.id]);
                              const courseDraft = draft.courses[course.id];
                              const courseBranches = props.branches.filter(
                                (b) => b.courseId === course.id,
                              );

                              return (
                                <div
                                  key={course.id}
                                  className={cn(
                                    "rounded-lg border p-2.5 transition-all",
                                    courseChecked
                                      ? "border-blue-300 bg-blue-50/40"
                                      : "border-slate-200 bg-slate-50/60"
                                  )}
                                >
                                  <label className="flex cursor-pointer items-center gap-2">
                                    <input
                                      type="checkbox"
                                      className="h-3.5 w-3.5 rounded border-slate-300 text-navy-800 focus:ring-navy-700/20"
                                      checked={courseChecked}
                                      onChange={() => toggleCourse(college.id, course.id)}
                                    />
                                    <span className="text-xs font-bold text-navy-900">
                                      {course.name}
                                    </span>
                                    <span className="text-[10px] text-slate-500">
                                      ({courseBranches.length} branch{courseBranches.length === 1 ? "" : "es"})
                                    </span>
                                  </label>

                                  {courseChecked && courseDraft ? (
                                    <div className="mt-2 space-y-2 border-t border-blue-100 pt-2 pl-5">
                                      <div className="flex flex-wrap gap-3 text-xs">
                                        <label className="flex cursor-pointer items-center gap-1.5 text-slate-700">
                                          <input
                                            type="radio"
                                            name={`dialog-course-mode-${college.id}-${course.id}`}
                                            checked={courseDraft.allBranches}
                                            onChange={() =>
                                              setCourseBranchMode(college.id, course.id, true)
                                            }
                                            className="h-3 w-3 border-slate-300 text-navy-800 focus:ring-navy-700/20"
                                          />
                                          All branches in {course.name}
                                        </label>
                                        <label className="flex cursor-pointer items-center gap-1.5 text-slate-700">
                                          <input
                                            type="radio"
                                            name={`dialog-course-mode-${college.id}-${course.id}`}
                                            checked={!courseDraft.allBranches}
                                            onChange={() =>
                                              setCourseBranchMode(college.id, course.id, false)
                                            }
                                            className="h-3 w-3 border-slate-300 text-navy-800 focus:ring-navy-700/20"
                                          />
                                          Specific branches
                                        </label>
                                      </div>

                                      {!courseDraft.allBranches ? (
                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                          {courseBranches.map((branch) => {
                                            const bChecked = courseDraft.branchIds.includes(
                                              branch.id,
                                            );
                                            return (
                                              <button
                                                key={branch.id}
                                                type="button"
                                                onClick={() =>
                                                  toggleBranch(college.id, course.id, branch.id)
                                                }
                                                className={cn(
                                                  "rounded-md px-2 py-1 text-xs font-medium transition-all flex items-center gap-1.5",
                                                  bChecked
                                                    ? "bg-navy-900 text-white shadow-2xs"
                                                    : "bg-white text-slate-700 border border-slate-200 hover:border-slate-300"
                                                )}
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={bChecked}
                                                  readOnly
                                                  className="h-3 w-3 rounded pointer-events-none"
                                                />
                                                <span>{branch.name}</span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        )
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error ? <p className="mt-3 text-sm text-critical">{error}</p> : null}
      <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
        <Button variant="secondary" onClick={props.onClose}>
          Cancel
        </Button>
        <Button disabled={busy} onClick={() => void save()}>
          {busy ? "Saving…" : "Save Role & Scope"}
        </Button>
      </div>
    </Modal>
  );
}

function ScopeDialog(props: {
  user: ManagedUser;
  assignment: RoleAssignment;
  roles: ApRoleOption[];
  colleges: Array<{ id: number; name: string }>;
  courses: Array<{ id: number; name: string; collegeId: number }>;
  branches: Array<{ id: number; name: string; courseId: number }>;
  onClose: () => void;
  onSaved: (user: ManagedUser) => Promise<void>;
}) {
  const meta = props.roles.find((r) => r.roleKey === props.assignment.roleKey);
  const global = Boolean(meta?.isGlobalCapable);
  const [collegeId, setCollegeId] = useState(
    props.assignment.collegeId == null ? "" : String(props.assignment.collegeId),
  );
  const [courseId, setCourseId] = useState(
    inferCourseIdForBranch(props.branches, props.assignment.branchId),
  );
  const [branchId, setBranchId] = useState(
    props.assignment.branchId == null ? "" : String(props.assignment.branchId),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const courseOptions = coursesForCollegeId(props.courses, collegeId);
  const branchOptions = courseId
    ? branchesForCourseId(props.branches, courseId)
    : branchesForCollege(props.branches, props.courses, collegeId);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (global) {
        throw new Error("This role must remain globally scoped");
      }
      if (!collegeId) throw new Error("College is required");
      const nextCollegeId = Number(collegeId);
      const roleKey = props.assignment.roleKey;

      // Course with no specific branch → expand to all branches in that course
      // via full roles replace (single assignment row can't hold multi-branch).
      if (courseId && !branchId) {
        const courseBranches = branchesForCourseId(props.branches, courseId);
        if (!courseBranches.length) {
          throw new Error("Selected course has no branches");
        }
        const other = props.user.roles
          .filter((r) => r.id !== props.assignment.id)
          .map((r) => ({
            roleKey: r.roleKey,
            collegeId: r.collegeId,
            branchId: r.branchId,
          }));
        const expanded = courseBranches.map((b) => ({
          roleKey,
          collegeId: nextCollegeId,
          branchId: b.id,
        }));
        const response = await apiFetch(`/users/${props.user.id}/roles`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignments: [...other, ...expanded] }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.message || "Failed to update scope");
        await props.onSaved(body as ManagedUser);
        return;
      }

      const response = await apiFetch(`/users/${props.user.id}/scope`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: props.assignment.id,
          collegeId: nextCollegeId,
          branchId: branchId ? Number(branchId) : null,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.message || "Failed to update scope");
      await props.onSaved(body as ManagedUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update scope");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Edit access scope — ${props.assignment.label}`} onClose={props.onClose}>
      {global ? (
        <p className="text-sm text-slate-600">This role must remain globally scoped.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-medium text-slate-500">
            College
            <select
              className={`${selectClass} mt-1 w-full`}
              value={collegeId}
              onChange={(e) => {
                setCollegeId(e.target.value);
                setCourseId("");
                setBranchId("");
              }}
            >
              <option value="">Select</option>
              {props.colleges.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-500">
            Course
            <select
              className={`${selectClass} mt-1 w-full`}
              value={courseId}
              disabled={!collegeId}
              onChange={(e) => {
                setCourseId(e.target.value);
                setBranchId("");
              }}
            >
              <option value="">All courses (whole college)</option>
              {courseOptions.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-500">
            Branch
            <select
              className={`${selectClass} mt-1 w-full`}
              value={branchId}
              disabled={!collegeId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              <option value="">
                {courseId ? "All branches in this course" : "All branches in college"}
              </option>
              {branchOptions.map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {error ? <p className="mt-3 text-sm text-critical">{error}</p> : null}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={props.onClose}>
          Cancel
        </Button>
        <Button disabled={busy || global} onClick={() => void save()}>
          {busy ? "Saving…" : "Save scope"}
        </Button>
      </div>
    </Modal>
  );
}

function Modal({
  title,
  children,
  onClose,
  wide,
  headerActions,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  headerActions?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        className={`relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-xl border border-border bg-white shadow-xl ${
          wide ? "max-w-6xl" : "max-w-2xl"
        }`}
      >
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-white px-5 py-3">
          <h3 className="font-semibold text-navy-900">{title}</h3>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {headerActions}
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
