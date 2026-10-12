"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  ChevronDown,
  ChevronUp,
  Save,
  RotateCcw,
  Edit3,
  Trash2,
  Plus,
  Shield,
  Lock,
  Users,
  Layers,
  Eye,
  EyeOff,
  Check,
  X,
  AlertCircle,
  LayoutDashboard,
  GraduationCap,
  CalendarCheck,
  CalendarRange,
  CalendarDays,
  Briefcase,
  ClipboardCheck,
  LineChart,
  Inbox,
  Clock3,
  Layers3,
  FileBarChart2,
  Gauge,
  ShieldAlert,
  AlertTriangle,
  Bell,
  BookOpen,
  UserCog,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";
import { getRoleStyle } from "@/features/user-management/RoleBadge";
import type { ManagedRole, PermissionCatalogItem } from "@/features/user-management/types";

const SIDEBAR_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  GraduationCap,
  CalendarCheck,
  CalendarRange,
  CalendarDays,
  Briefcase,
  ClipboardCheck,
  LineChart,
  Inbox,
  Clock3,
  Layers3,
  FileBarChart2,
  Gauge,
  ShieldAlert,
  AlertTriangle,
  Bell,
  Users,
  BookOpen,
  UserCog,
  Settings,
};

const GROUP_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Overview: LayoutDashboard,
  Academics: GraduationCap,
  Requests: Inbox,
  Examinations: Layers3,
  Reports: FileBarChart2,
  "Student Support": ShieldAlert,
  Operations: AlertTriangle,
  System: Settings,
};
import {
  PERMISSION_MATRIX_MODULES,
  PERMISSION_PRESENTATION,
  allMatrixPermissionKeys,
  moduleAccessState,
  summarizeRoleAccess,
  type MatrixModuleDef,
} from "@/features/user-management/permission-matrix";

const inputClass =
  "h-9 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-navy-800";

const HIERARCHY_LEVELS: Record<string, string> = {
  super_admin: "L1",
  principal: "L2",
  vice_principal: "L3",
  hod: "L4",
  class_teacher: "L5",
  staff: "L6",
};

type Props = {
  canManage: boolean;
};

function groupModules(modules: MatrixModuleDef[]) {
  const groups: { title: string; items: MatrixModuleDef[] }[] = [];
  for (const mod of modules) {
    const existing = groups.find((g) => g.title === mod.group);
    if (existing) existing.items.push(mod);
    else groups.push({ title: mod.group, items: [mod] });
  }
  return groups;
}

function sortedKeys(keys: string[]) {
  return [...keys].sort().join("\0");
}

export function RolesPermissionsPanel({ canManage }: Props) {
  const [roles, setRoles] = useState<ManagedRole[]>([]);
  const [catalog, setCatalog] = useState<PermissionCatalogItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draftKeys, setDraftKeys] = useState<string[]>([]);
  const [editLabel, setEditLabel] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editGlobal, setEditGlobal] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newGlobal, setNewGlobal] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{
    role: ManagedRole;
    mode: "blocked" | "confirm" | "protected";
  } | null>(null);

  // Search & Filtering States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [accessFilter, setAccessFilter] = useState<"all" | "has_access" | "no_access">("all");
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  const selected = roles.find((r) => r.id === selectedId) ?? null;
  const enabled = useMemo(() => new Set(draftKeys), [draftKeys]);
  const summary = useMemo(() => summarizeRoleAccess(enabled), [enabled]);
  const navGroups = useMemo(() => groupModules(PERMISSION_MATRIX_MODULES), []);

  const catalogKeys = useMemo(
    () => new Set(catalog.map((p) => p.permissionKey)),
    [catalog],
  );

  const unmappedCatalog = useMemo(() => {
    const matrixKeys = new Set(allMatrixPermissionKeys());
    return catalog.filter((p) => !matrixKeys.has(p.permissionKey));
  }, [catalog]);

  const missingFromApi = useMemo(() => {
    return allMatrixPermissionKeys().filter((k) => catalog.length > 0 && !catalogKeys.has(k));
  }, [catalog.length, catalogKeys]);

  const savedPermKey = selected ? sortedKeys(selected.permissions) : "";
  const draftPermKey = sortedKeys(draftKeys);
  const permissionsDirty = Boolean(selected) && draftPermKey !== savedPermKey;
  const detailsDirty = selected
    ? editLabel.trim() !== selected.label ||
      (editDescription.trim() || "") !== (selected.description ?? "") ||
      editGlobal !== selected.isGlobalCapable
    : false;
  const dirty = permissionsDirty || detailsDirty;

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    if (!opts?.soft) setLoading(true);
    setError(null);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        apiFetch("/roles?includeInactive=true", { cache: "no-store" }),
        apiFetch("/permissions", { cache: "no-store" }),
      ]);
      const rolesBody = await rolesRes.json().catch(() => ({}));
      const permsBody = await permsRes.json().catch(() => ({}));
      if (!rolesRes.ok) throw new Error(rolesBody?.message || "Failed to load roles");
      if (!permsRes.ok) throw new Error(permsBody?.message || "Failed to load permissions");
      const roleRows = (rolesBody.data ?? []) as ManagedRole[];
      setRoles(roleRows);
      setCatalog(permsBody.data ?? []);
      setSelectedId((prev) => prev ?? roleRows[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load roles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    setDraftKeys([...selected.permissions]);
    setEditLabel(selected.label);
    setEditDescription(selected.description ?? "");
    setEditGlobal(selected.isGlobalCapable);
    setEditingDetails(false);
  }, [selected?.id, savedPermKey, selected?.label, selected?.description, selected?.isGlobalCapable]);

  function discardChanges() {
    if (!selected) return;
    setDraftKeys([...selected.permissions]);
    setEditLabel(selected.label);
    setEditDescription(selected.description ?? "");
    setEditGlobal(selected.isGlobalCapable);
    setEditingDetails(false);
    setError(null);
    setSuccess(null);
  }

  function selectRole(id: number) {
    if (id === selectedId) return;
    if (dirty && !window.confirm("You have unsaved changes. Discard them and switch roles?")) {
      return;
    }
    setSuccess(null);
    setError(null);
    setSelectedId(id);
  }

  function toggleKey(key: string, on: boolean) {
    setDraftKeys((prev) => {
      if (on) return prev.includes(key) ? prev : [...prev, key];
      return prev.filter((k) => k !== key);
    });
    setSuccess(null);
  }

  function applyModuleLevel(mod: MatrixModuleDef, level: "none" | "view" | "manage") {
    const reads = mod.permissions.filter((p) => p.kind === "read").map((p) => p.key);
    const writes = mod.permissions.filter((p) => p.kind === "write").map((p) => p.key);
    setDraftKeys((prev) => {
      const next = new Set(prev);
      if (level === "none") {
        for (const k of [...reads, ...writes]) next.delete(k);
      } else if (level === "view") {
        for (const k of writes) next.delete(k);
        for (const k of reads) next.add(k);
      } else {
        for (const k of [...reads, ...writes]) next.add(k);
      }
      return [...next];
    });
    setSuccess(null);
  }

  function toggleModuleExpanded(href: string) {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  }

  function expandAll() {
    const allHrefs = new Set(PERMISSION_MATRIX_MODULES.map((m) => m.href));
    setExpandedModules(allHrefs);
  }

  function collapseAll() {
    setExpandedModules(new Set());
  }

  async function saveRoleDetails(confirmImpact = false) {
    if (!selected || !canManage || !detailsDirty) return true;
    const response = await apiFetch(`/roles/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: editLabel.trim(),
        description: editDescription.trim() || null,
        isGlobalCapable: editGlobal,
        confirmImpact,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (/confirmImpact/i.test(String(body?.message ?? ""))) {
        const ok = window.confirm(
          `${body.message}\n\nThis will revoke sessions for users with this role. Continue?`,
        );
        if (ok) return saveRoleDetails(true);
        return false;
      }
      throw new Error(body?.message || "Failed to update role");
    }
    return true;
  }

  async function savePermissionsOnly(confirmImpact = false) {
    if (!selected || !canManage || !permissionsDirty) return true;
    const response = await apiFetch(`/roles/${selected.id}/permissions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissionKeys: draftKeys, confirmImpact }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (/confirmImpact/i.test(String(body?.message ?? ""))) {
        const ok = window.confirm(
          `${body.message}\n\nThis will revoke sessions for users with this role. Continue?`,
        );
        if (ok) return savePermissionsOnly(true);
        return false;
      }
      throw new Error(body?.message || "Failed to save permissions");
    }
    return true;
  }

  async function saveAll() {
    if (!selected || !canManage || !dirty) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      if (detailsDirty) {
        const ok = await saveRoleDetails();
        if (!ok) {
          setBusy(false);
          return;
        }
      }
      if (permissionsDirty) {
        const ok = await savePermissionsOnly();
        if (!ok) {
          setBusy(false);
          return;
        }
      }
      await load({ soft: true });
      setSuccess(`Changes to role “${editLabel.trim() || selected.label}” saved successfully.`);
      setEditingDetails(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save role");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive() {
    if (!selected || !canManage) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await apiFetch(`/roles/${selected.id}/active`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !selected.isActive }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.message || "Failed to toggle active status");
      await load({ soft: true });
      setSuccess(`Role is now ${!selected.isActive ? "active" : "inactive"}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle active status");
    } finally {
      setBusy(false);
    }
  }

  async function createRole() {
    if (!newLabel.trim() || !canManage) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await apiFetch("/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: newLabel.trim(),
          description: newDescription.trim() || undefined,
          isGlobalCapable: newGlobal,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.message || "Failed to create role");
      setCreateOpen(false);
      setNewLabel("");
      setNewDescription("");
      setNewGlobal(false);
      await load({ soft: true });
      if (body.data?.id) setSelectedId(Number(body.data.id));
      setSuccess("New role created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create role");
    } finally {
      setBusy(false);
    }
  }

  function openDeleteDialog() {
    if (!selected || !canManage) return;

    if (selected.roleKey === "super_admin") {
      setDeleteDialog({ role: selected, mode: "protected" });
      return;
    }

    if (Number(selected.assignmentCount ?? 0) > 0) {
      setDeleteDialog({ role: selected, mode: "blocked" });
      setError(null);
      setSuccess(null);
      return;
    }

    setDeleteDialog({ role: selected, mode: "confirm" });
  }

  async function executeDeleteRole(role: ManagedRole) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const qs = role.isSystemRole ? "?confirmImpact=true" : "";
      const response = await apiFetch(`/roles/${role.id}${qs}`, { method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (body?.code === "ROLE_HAS_ASSIGNMENTS" || response.status === 409) {
          const refreshed = {
            ...role,
            assignmentCount: Number(body?.assignmentCount ?? role.assignmentCount ?? 0),
            activeUserCount: Number(body?.activeUserCount ?? role.activeUserCount ?? 0),
          };
          setDeleteDialog({ role: refreshed, mode: "blocked" });
          throw new Error(body?.message || "Cannot delete: users still assigned to this role.");
        }
        throw new Error(body?.message || "Failed to delete role");
      }
      setDeleteDialog(null);
      setSelectedId(null);
      await load({ soft: true });
      setSuccess(`Role “${role.label}” deleted.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete role");
    } finally {
      setBusy(false);
    }
  }

  // Filter groups and modules based on Search & Category Filter
  const filteredNavGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return navGroups
      .map((g) => {
        if (selectedCategory !== "All" && g.title !== selectedCategory) {
          return null;
        }

        const items = g.items.filter((mod) => {
          // Access filter
          const level = moduleAccessState(mod, enabled);
          if (accessFilter === "has_access" && level === "none") return false;
          if (accessFilter === "no_access" && level !== "none") return false;

          if (!q) return true;

          // Search match
          const matchLabel = mod.label.toLowerCase().includes(q);
          const matchGroup = mod.group.toLowerCase().includes(q);
          const matchPerms = mod.permissions.some(
            (p) =>
              p.label.toLowerCase().includes(q) ||
              p.key.toLowerCase().includes(q) ||
              p.description.toLowerCase().includes(q),
          );

          return matchLabel || matchGroup || matchPerms;
        });

        if (items.length === 0) return null;
        return { ...g, items };
      })
      .filter((g): g is { title: string; items: MatrixModuleDef[] } => g !== null);
  }, [navGroups, searchQuery, selectedCategory, accessFilter, enabled]);

  // Categories list with counts
  const categoryOptions = useMemo(() => {
    const cats: { label: string; count: number }[] = [
      { label: "All", count: PERMISSION_MATRIX_MODULES.length },
    ];
    for (const g of navGroups) {
      cats.push({ label: g.title, count: g.items.length });
    }
    return cats;
  }, [navGroups]);

  const totalFilteredModulesCount = useMemo(() => {
    return filteredNavGroups.reduce((acc, g) => acc + g.items.length, 0);
  }, [filteredNavGroups]);

  if (loading) {
    return <PageSkeleton showFilterBar={false} showStats statCardsCount={3} columns={5} rows={6} />;
  }

  return (
    <div className="space-y-4">
      {/* 1. ROLES CONFIGURED SELECTOR BAR */}
      <Card className="p-4 sm:p-5">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-navy-900">
                Institutional Roles
              </h3>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                {roles.length} roles
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Select a role to configure its institutional permission scope and access matrix.
            </p>
          </div>
          {canManage ? (
            <Button
              size="sm"
              variant={createOpen ? "secondary" : "primary"}
              onClick={() => setCreateOpen((v) => !v)}
              className="text-xs"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {createOpen ? "Cancel" : "Create New Role"}
            </Button>
          ) : null}
        </div>

        {createOpen ? (
          <div className="mb-4 rounded-xl border border-navy-100 bg-slate-50/90 p-3.5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-navy-900">Define Custom Role</p>
              <span className="text-[11px] text-slate-500">Custom roles can have tailor-made permissions.</span>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <input
                className={inputClass}
                placeholder="Role Name (e.g. Exam Coordinator, Lab Assistant)"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />
              <input
                className={inputClass}
                placeholder="Role Description (optional)"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-navy-800"
                  checked={newGlobal}
                  onChange={(e) => setNewGlobal(e.target.checked)}
                />
                Global Institution Scope (applies across colleges without branch restrictions)
              </label>
              <Button
                size="sm"
                disabled={busy || !newLabel.trim()}
                onClick={() => void createRole()}
                className="text-xs"
              >
                {busy ? "Saving…" : "Save Role"}
              </Button>
            </div>
          </div>
        ) : null}

        {/* Role Selector Grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
          {roles.map((role) => {
            const style = getRoleStyle(role.roleKey);
            const isSelected = selectedId === role.id;
            const level = HIERARCHY_LEVELS[role.roleKey] ?? "R";

            return (
              <button
                key={role.id}
                type="button"
                className={cn(
                  "group relative flex flex-col justify-between rounded-xl border p-2.5 text-left transition-all cursor-pointer shadow-2xs",
                  isSelected
                    ? "border-navy-900 bg-navy-900 text-white shadow-xs ring-2 ring-navy-800/25"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                )}
                onClick={() => selectRole(role.id)}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.2 text-[9px] font-bold uppercase",
                      isSelected ? "bg-white/20 text-white" : style.pill
                    )}
                  >
                    {level}
                  </span>
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full shrink-0",
                      role.isActive ? (isSelected ? "bg-emerald-300" : "bg-emerald-500") : "bg-slate-300"
                    )}
                    title={role.isActive ? "Active Role" : "Inactive"}
                  />
                </div>
                <p className={cn("mt-1.5 truncate text-xs font-bold leading-tight", isSelected ? "text-white" : "text-navy-900")}>
                  {role.label}
                </p>
                <div className="mt-1 flex items-center justify-between text-[10px]">
                  <span className={isSelected ? "text-slate-300" : "text-slate-500"}>
                    {role.assignmentCount ?? 0} user{role.assignmentCount === 1 ? "" : "s"}
                  </span>
                  {role.isSystemRole ? (
                    <span className={isSelected ? "text-slate-300" : "text-slate-400"}>System</span>
                  ) : (
                    <span className={isSelected ? "text-amber-200" : "text-amber-700"}>Custom</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* FEEDBACK BANNERS */}
      {error ? (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-900 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span className="font-semibold">{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-rose-600 hover:underline">
            Dismiss
          </button>
        </div>
      ) : null}

      {success ? (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900 shadow-2xs">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0 text-emerald-600" />
            <span className="font-semibold">{success}</span>
          </div>
          <button type="button" onClick={() => setSuccess(null)} className="text-emerald-600 hover:underline">
            Dismiss
          </button>
        </div>
      ) : null}

      {!selected ? (
        <Card className="py-12 text-center text-slate-500">
          <p className="text-sm font-medium">Select a role above to configure its permissions.</p>
        </Card>
      ) : (
        <>
          {/* 2. ACTIVE ROLE CONFIGURATION HEADER */}
          <Card className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                {/* Role Title & Badges */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-navy-100 px-2 py-0.5 text-xs font-bold text-navy-800">
                    {HIERARCHY_LEVELS[selected.roleKey] ?? "ROLE"}
                  </span>
                  <h3 className="text-lg font-black text-navy-900 tracking-tight">
                    {selected.label}
                  </h3>
                  <span className="font-mono text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                    {selected.roleKey}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                      selected.isSystemRole
                        ? "bg-purple-100 text-purple-800"
                        : "bg-blue-100 text-blue-800"
                    )}
                  >
                    {selected.isSystemRole ? "System Role" : "Custom Role"}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                      selected.isGlobalCapable
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-700"
                    )}
                  >
                    {selected.isGlobalCapable ? "Global Scope" : "College / Branch Scoped"}
                  </span>
                  <StatusBadge status={selected.isActive ? "active" : "inactive"} />
                  {dirty ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-amber-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-600 animate-pulse" />
                      Unsaved Changes
                    </span>
                  ) : null}
                </div>

                {/* Role Description */}
                <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                  {selected.description || "No description provided for this role."}
                </p>

                {/* Informational callouts */}
                {selected.assignmentCount > 0 && selected.roleKey !== "super_admin" ? (
                  <div className="mt-2.5 inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-1.5 text-xs text-amber-900">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                    <span>
                      {selected.activeUserCount} active user{selected.activeUserCount === 1 ? "" : "s"} currently assigned. Deletion is safely locked until users are reassigned in All Users.
                    </span>
                  </div>
                ) : null}

                {selected.roleKey === "super_admin" ? (
                  <p className="mt-2 text-xs text-slate-500">
                    System Administrator is institutional tier L1; deletion is permanently locked to guarantee admin recovery.
                  </p>
                ) : null}

                {/* Metrics Chips */}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-slate-700 font-semibold shadow-2xs">
                    <Users className="h-3.5 w-3.5 text-slate-500" />
                    <span>
                      {selected.assignmentCount} user{selected.assignmentCount === 1 ? "" : "s"} assigned ({selected.activeUserCount} active)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-slate-700 font-semibold shadow-2xs">
                    <Layers className="h-3.5 w-3.5 text-brand-600" />
                    <span>
                      {summary.modulesWithAccess} of {PERMISSION_MATRIX_MODULES.length} Modules Accessible
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-slate-700 font-semibold shadow-2xs">
                    <Eye className="h-3.5 w-3.5 text-sky-600" />
                    <span>{summary.read} Read Permissions</span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-slate-700 font-semibold shadow-2xs">
                    <Shield className="h-3.5 w-3.5 text-amber-600" />
                    <span>{summary.write} Action / Write Permissions</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {canManage ? (
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      setEditingDetails((v) => !v);
                      setSuccess(null);
                    }}
                    className="text-xs"
                  >
                    <Edit3 className="mr-1.5 h-3.5 w-3.5" />
                    {editingDetails ? "Done Editing" : "Edit Role Details"}
                  </Button>

                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void toggleActive()}
                    className="text-xs"
                  >
                    {selected.isActive ? "Deactivate" : "Activate"}
                  </Button>

                  {selected.roleKey !== "super_admin" ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => openDeleteDialog()}
                      title={
                        selected.assignmentCount > 0
                          ? "Blocked while users still have this role"
                          : "Delete role"
                      }
                      className={cn(
                        "text-xs",
                        selected.assignmentCount > 0
                          ? "opacity-60 cursor-not-allowed"
                          : "text-rose-700 hover:bg-rose-50"
                      )}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      Delete
                    </Button>
                  ) : null}

                  {dirty ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={discardChanges}
                      className="text-xs"
                    >
                      <RotateCcw className="mr-1 h-3.5 w-3.5" />
                      Discard
                    </Button>
                  ) : null}

                  <Button
                    size="sm"
                    variant="primary"
                    disabled={busy || !dirty}
                    onClick={() => void saveAll()}
                    className={cn(
                      "text-xs shadow-xs",
                      dirty && "bg-navy-900 hover:bg-navy-800 text-white ring-2 ring-navy-800/20"
                    )}
                  >
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                    {busy ? "Saving…" : "Save Changes"}
                  </Button>
                </div>
              ) : null}
            </div>

            {/* Inline Details Editor (Collapsible) */}
            {canManage && editingDetails ? (
              <div className="mt-4 rounded-xl border border-navy-100 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-navy-900 uppercase tracking-wide">
                    Edit Role Properties
                  </p>
                  <span className="text-[11px] text-slate-500">
                    {selected.isSystemRole
                      ? "System roles can have their display label and description updated."
                      : "Custom roles can modify label, description, and scope capability."}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Role Display Name
                    </label>
                    <input
                      className={inputClass}
                      value={editLabel}
                      disabled={busy}
                      onChange={(e) => {
                        setEditLabel(e.target.value);
                        setSuccess(null);
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Role Key Identifier
                    </label>
                    <input
                      className={cn(inputClass, "bg-slate-100 text-slate-500 cursor-not-allowed")}
                      value={selected.roleKey}
                      disabled
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Role Description
                  </label>
                  <textarea
                    className="h-16 w-full rounded-md border border-border bg-white px-3 py-2 text-xs outline-none focus:border-navy-800"
                    value={editDescription}
                    disabled={busy}
                    onChange={(e) => {
                      setEditDescription(e.target.value);
                      setSuccess(null);
                    }}
                    placeholder="Enter what responsibilities this role handles..."
                  />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editGlobal}
                      disabled={busy || (selected.isSystemRole && selected.isGlobalCapable)}
                      onChange={(e) => {
                        setEditGlobal(e.target.checked);
                        setSuccess(null);
                      }}
                      className="rounded border-slate-300 text-navy-800"
                    />
                    Global Scope Capability (User does not require college/branch scoping)
                  </label>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setEditingDetails(false)}
                    className="text-xs"
                  >
                    Close Editor
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>

          {/* 3. PERMISSION MATRIX CONTROLS: SEARCH, TABS, QUICK ACTIONS */}
          <div className="space-y-3">
            {/* Search & Category Filter Bar */}
            <div className="rounded-xl border border-border bg-white p-3 shadow-2xs space-y-2.5">
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="search"
                    placeholder="Search modules or permissions (e.g. attendance, marks, mentoring, timetables)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-xs text-navy-900 outline-none focus:border-navy-800 focus:bg-white transition-all"
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

                {/* Filter and Expand Controls */}
                <div className="flex items-center gap-2">
                  <select
                    value={accessFilter}
                    onChange={(e) => setAccessFilter(e.target.value as any)}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-navy-800"
                  >
                    <option value="all">All Access States</option>
                    <option value="has_access">Accessible Only</option>
                    <option value="no_access">No Access Only</option>
                  </select>

                  <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={expandAll}
                      className="rounded-md px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-white transition-all"
                    >
                      Expand All
                    </button>
                    <button
                      type="button"
                      onClick={collapseAll}
                      className="rounded-md px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-white transition-all"
                    >
                      Collapse All
                    </button>
                  </div>
                </div>
              </div>

              {/* Category Filter Pills (Mirrors Sidebar Groups) */}
              <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2.5">
                {categoryOptions.map((cat) => {
                  const isSelected = selectedCategory === cat.label;
                  const Icon = GROUP_ICON_MAP[cat.label];
                  return (
                    <button
                      key={cat.label}
                      type="button"
                      onClick={() => setSelectedCategory(cat.label)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
                        isSelected
                          ? "bg-navy-900 text-white shadow-2xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      )}
                    >
                      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
                      <span>{cat.label}</span>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.2 text-[10px]",
                          isSelected ? "bg-white/20 text-white" : "bg-white text-slate-600"
                        )}
                      >
                        {cat.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. PERMISSION MATRIX MODULE CARDS */}
            {totalFilteredModulesCount === 0 ? (
              <Card className="py-10 text-center text-slate-500">
                <p className="text-sm font-medium">No modules found matching your search or filters.</p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("All");
                    setAccessFilter("all");
                  }}
                  className="mt-3 text-xs"
                >
                  Clear Filters
                </Button>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredNavGroups.map((group) => {
                  const GroupHeaderIcon = GROUP_ICON_MAP[group.title] ?? Layers;

                  return (
                    <div key={group.title} className="space-y-2">
                      <div className="flex items-center justify-between px-1 border-b border-slate-100 pb-1.5">
                        <div className="flex items-center gap-1.5">
                          <GroupHeaderIcon className="h-4 w-4 text-brand-600" />
                          <span className="text-xs font-bold uppercase tracking-wider text-navy-900">
                            {group.title}
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-400">
                          {group.items.length} sidebar item{group.items.length === 1 ? "" : "s"}
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        {group.items.map((mod) => {
                          const level = moduleAccessState(mod, enabled);
                          const reads = mod.permissions.filter((p) => p.kind === "read");
                          const writes = mod.permissions.filter((p) => p.kind === "write");
                          const hasWrites = writes.length > 0;
                          const isExpanded = expandedModules.has(mod.href) || Boolean(searchQuery);

                          const activeCount = mod.permissions.filter((p) => enabled.has(p.key)).length;
                          const totalPerms = mod.permissions.length;

                          const ModuleIcon = (mod.iconName && SIDEBAR_ICON_MAP[mod.iconName])
                            ? SIDEBAR_ICON_MAP[mod.iconName]
                            : Layers;

                          const isVisibleInSidebar = !mod.sidebarUnlockPermissions || mod.sidebarUnlockPermissions.length === 0
                            ? level !== "none"
                            : mod.sidebarUnlockPermissions.some((k) => enabled.has(k));

                          return (
                            <div
                              key={mod.href}
                              className={cn(
                                "rounded-xl border transition-all",
                                level === "manage"
                                  ? "border-emerald-200 bg-white shadow-2xs"
                                  : level === "view"
                                  ? "border-blue-200 bg-white shadow-2xs"
                                  : level === "partial"
                                  ? "border-amber-200 bg-white shadow-2xs"
                                  : "border-slate-200 bg-white/95"
                              )}
                            >
                              {/* Module Header Bar */}
                              <div className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  {/* Sidebar Nav Icon */}
                                  <div
                                    className={cn(
                                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-2xs transition-all",
                                      isVisibleInSidebar
                                        ? "border-brand-200 bg-brand-50 text-brand-700"
                                        : "border-slate-200 bg-slate-100 text-slate-400"
                                    )}
                                    title={isVisibleInSidebar ? "Active in sidebar" : "Hidden from sidebar"}
                                  >
                                    <ModuleIcon className="h-4 w-4" />
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <h4 className="text-sm font-bold text-navy-900 leading-tight">
                                        {mod.label}
                                      </h4>
                                      <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200/60">
                                        {mod.href}
                                      </span>

                                      {/* Sidebar Visibility Badge */}
                                      {isVisibleInSidebar ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                                          <Eye className="h-3 w-3 text-emerald-600" />
                                          Visible in Sidebar
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 border border-slate-200/60">
                                          <EyeOff className="h-3 w-3 text-slate-400" />
                                          Hidden from Sidebar
                                        </span>
                                      )}

                                      {/* Access Level Badge */}
                                      {level === "manage" ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                          Full Access
                                        </span>
                                      ) : level === "view" ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-800 border border-blue-200">
                                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                          View Only
                                        </span>
                                      ) : level === "partial" ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                          Custom ({activeCount}/{totalPerms})
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                                          No Access
                                        </span>
                                      )}
                                    </div>
                                    {mod.accessNote ? (
                                      <p className="mt-1 text-[11px] text-slate-500">{mod.accessNote}</p>
                                    ) : null}
                                  </div>
                                </div>

                              {/* Level Quick Actions & Expand Trigger */}
                              <div className="flex items-center gap-2 shrink-0">
                                {canManage ? (
                                  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100/80 p-0.5 text-xs shadow-2xs">
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => applyModuleLevel(mod, "none")}
                                      className={cn(
                                        "rounded-md px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
                                        level === "none"
                                          ? "bg-white text-navy-900 shadow-2xs"
                                          : "text-slate-600 hover:text-navy-900"
                                      )}
                                    >
                                      No Access
                                    </button>
                                    <button
                                      type="button"
                                      disabled={busy || reads.length === 0}
                                      onClick={() => applyModuleLevel(mod, "view")}
                                      className={cn(
                                        "rounded-md px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
                                        level === "view"
                                          ? "bg-blue-600 text-white shadow-2xs"
                                          : "text-slate-600 hover:text-navy-900"
                                      )}
                                    >
                                      View
                                    </button>
                                    {hasWrites ? (
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => applyModuleLevel(mod, "manage")}
                                        className={cn(
                                          "rounded-md px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
                                          level === "manage"
                                            ? "bg-emerald-600 text-white shadow-2xs"
                                            : "text-slate-600 hover:text-navy-900"
                                        )}
                                      >
                                        Manage
                                      </button>
                                    ) : null}
                                  </div>
                                ) : null}

                                <button
                                  type="button"
                                  onClick={() => toggleModuleExpanded(mod.href)}
                                  className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-white transition-all"
                                  title="Expand detailed permission toggles"
                                >
                                  <span>{mod.permissions.length} perms</span>
                                  {isExpanded ? (
                                    <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
                                  ) : (
                                    <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Expanded Permission List (Clean, Compact Toggles) */}
                            {isExpanded ? (
                              <div className="border-t border-slate-100 bg-slate-50/50 p-3">
                                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                  {[...reads, ...writes].map((perm) => {
                                    const isChecked = enabled.has(perm.key);
                                    return (
                                      <label
                                        key={perm.key}
                                        className={cn(
                                          "flex items-start gap-2.5 rounded-lg border p-2.5 text-xs transition-all cursor-pointer select-none",
                                          isChecked
                                            ? perm.sensitive
                                              ? "border-amber-300 bg-amber-50/70"
                                              : "border-navy-200 bg-white shadow-2xs ring-1 ring-navy-800/10"
                                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                                        )}
                                      >
                                        <input
                                          type="checkbox"
                                          disabled={!canManage || busy}
                                          checked={isChecked}
                                          onChange={(e) => toggleKey(perm.key, e.target.checked)}
                                          className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-navy-800 focus:ring-navy-700/20"
                                        />
                                        <div className="min-w-0 flex-1">
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            <span className={cn("font-bold text-navy-900 leading-tight")}>
                                              {perm.label}
                                            </span>
                                            <span
                                              className={cn(
                                                "rounded px-1.5 py-0.2 text-[9px] font-bold uppercase",
                                                perm.kind === "read"
                                                  ? "bg-slate-100 text-slate-600"
                                                  : "bg-blue-100 text-blue-700"
                                              )}
                                            >
                                              {perm.kind}
                                            </span>
                                            {perm.sensitive ? (
                                              <span className="flex items-center gap-0.5 rounded bg-amber-100 px-1 py-0.2 text-[9px] font-bold uppercase text-amber-800">
                                                <Lock className="h-2.5 w-2.5" />
                                                Sensitive
                                              </span>
                                            ) : null}
                                          </div>
                                          <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                                            {perm.description}
                                          </p>
                                        </div>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                      </div>
                    </div>
                  );
                })}

                {/* Additional Catalog Permissions if any */}
                {unmappedCatalog.length > 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        Additional Catalog Permissions
                      </h4>
                      <span className="text-[11px] text-slate-500">
                        {unmappedCatalog.length} custom system keys
                      </span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {unmappedCatalog.map((p) => {
                        const isChecked = enabled.has(p.permissionKey);
                        return (
                          <label
                            key={p.permissionKey}
                            className={cn(
                              "flex items-start gap-2.5 rounded-lg border p-2.5 text-xs transition-all cursor-pointer",
                              isChecked
                                ? "border-navy-200 bg-white shadow-2xs"
                                : "border-slate-200 bg-slate-50/50"
                            )}
                          >
                            <input
                              type="checkbox"
                              disabled={!canManage || busy}
                              checked={isChecked}
                              onChange={(e) => toggleKey(p.permissionKey, e.target.checked)}
                              className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-navy-800"
                            />
                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-navy-900 block leading-tight">
                                {p.displayName || p.permissionKey}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                                {p.permissionKey}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {missingFromApi.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <span className="font-semibold">Notice:</span> Matrix references keys missing from the live database: {missingFromApi.join(", ")}
            </div>
          ) : null}
        </>
      )}

      {/* 5. FLOATING DOCKED SAVE BAR WHEN DIRTY */}
      {dirty && selected ? (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-2xl border border-navy-800 bg-navy-950/95 px-5 py-3 text-white shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs font-semibold">
              Unsaved changes for <strong className="text-white">{selected.label}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 pl-2 border-l border-white/20">
            <button
              type="button"
              disabled={busy}
              onClick={discardChanges}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white transition-colors"
            >
              Discard
            </button>
            <Button
              size="sm"
              variant="primary"
              disabled={busy}
              onClick={() => void saveAll()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs border-none shadow-xs"
            >
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {busy ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      ) : null}

      {/* 6. DELETE ROLE MODAL */}
      {deleteDialog ? (
        <DeleteRoleModal
          role={deleteDialog.role}
          mode={deleteDialog.mode}
          busy={busy}
          onClose={() => {
            if (!busy) setDeleteDialog(null);
          }}
          onConfirm={() => void executeDeleteRole(deleteDialog.role)}
        />
      ) : null}
    </div>
  );
}

function DeleteRoleModal(props: {
  role: ManagedRole;
  mode: "blocked" | "confirm" | "protected";
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const activeUsers = Number(props.role.activeUserCount ?? 0);
  const assignedUsers = Number(props.role.assignmentCount ?? 0);
  const inactiveUsers = Math.max(0, assignedUsers - activeUsers);

  const title =
    props.mode === "confirm"
      ? "Delete Role?"
      : props.mode === "blocked"
        ? "Cannot Delete Role"
        : "System Role Protected";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close dialog"
        disabled={props.busy}
        onClick={props.onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-role-title"
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-white shadow-2xl"
      >
        <div className="border-b border-border px-5 py-3.5">
          <h3 id="delete-role-title" className="text-base font-bold text-navy-900">
            {title}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">{props.role.label}</p>
        </div>

        <div className="space-y-3 px-5 py-4 text-xs">
          {props.mode === "protected" ? (
            <>
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700">
                <span className="font-bold text-navy-900">System Administrator</span> cannot be
                deleted because it protects institute super admin recovery.
              </p>
              <p className="text-slate-600">
                You can edit its individual permissions or deactivate other roles instead.
              </p>
            </>
          ) : null}

          {props.mode === "blocked" ? (
            <>
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-950 font-medium">
                This role still has active accounts assigned, so delete is locked.
              </p>
              <ul className="space-y-1.5 text-slate-700 pl-1">
                {activeUsers > 0 ? (
                  <li>
                    • <span className="font-bold text-navy-900">{activeUsers}</span> active user
                    {activeUsers === 1 ? "" : "s"} currently have this role.
                  </li>
                ) : null}
                {inactiveUsers > 0 ? (
                  <li>
                    • <span className="font-bold text-navy-900">{inactiveUsers}</span> inactive user
                    {inactiveUsers === 1 ? "" : "s"} still assigned.
                  </li>
                ) : null}
              </ul>
              <p className="text-slate-600">
                Open <span className="font-bold text-navy-900">All Users</span>, change or reassign
                this role for those accounts, then return here to delete.
              </p>
            </>
          ) : null}

          {props.mode === "confirm" ? (
            <>
              {props.role.isSystemRole ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-950 font-medium">
                  This is a seeded institutional role. Deleting it removes it permanently.
                </p>
              ) : (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-700">
                  No users are currently assigned to this role.
                </p>
              )}
              <p className="text-slate-700">
                Are you sure you want to permanently remove <span className="font-bold text-navy-900">{props.role.label}</span>? This cannot be undone.
              </p>
              <p className="text-slate-400 font-mono">
                Role key: {props.role.roleKey}
              </p>
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-border bg-slate-50 px-5 py-3">
          <Button size="sm" variant="secondary" disabled={props.busy} onClick={props.onClose} className="text-xs">
            {props.mode === "confirm" ? "Cancel" : "Close"}
          </Button>
          {props.mode === "confirm" ? (
            <Button size="sm" variant="danger" disabled={props.busy} onClick={props.onConfirm} className="text-xs">
              {props.busy ? "Deleting…" : "Confirm Delete"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
