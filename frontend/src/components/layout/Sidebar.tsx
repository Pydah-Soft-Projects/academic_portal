"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  UserRound,
  X,
  Shield,
  Building,
  GraduationCap,
  Calendar,
  Mail,
  BadgeCheck,
  BookOpen,
  Layers,
  Users,
  CheckCircle2,
  Briefcase,
  Award,
} from "lucide-react";
import { NAV_GROUPS, filterNavGroups, navLabelForItem } from "@/lib/navigation";
import { cn } from "@/lib/cn";
import { useAuth } from "@/components/auth/AuthProvider";
import { isTeachingStaffOnly, isSuperAdminUser, getUniqueSingleRoleLabel } from "@/lib/teaching-scope";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { apiFetch } from "@/lib/api";
import { LogoutConfirmModal } from "@/components/auth/LogoutConfirmModal";
import { getUserYearAccess } from "@/features/user-management/YearAccessControl";

type Props = {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapsed: () => void;
};

export function Sidebar({ open, collapsed, onClose, onToggleCollapsed }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, authorization, refresh, hasAnyPermission, hasPermission } =
    useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<{
    title: string;
    top: number;
    left: number;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
    const fontId = "campo-plus-jakarta-font";
    let created = false;
    let link = document.getElementById(fontId) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = fontId;
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap";
      document.head.appendChild(link);
      created = true;
    }
    return () => {
      if (created && link?.parentNode) {
        link.parentNode.removeChild(link);
      }
    };
  }, []);

  useEffect(() => {
    setHoveredItem(null);
  }, [pathname, searchParams, collapsed]);

  const showTooltip = (title: string, e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredItem({
      title,
      top: rect.top + rect.height / 2 - 14,
      left: rect.right + 10,
    });
  };

  const hideTooltip = () => {
    setHoveredItem(null);
  };

  const teachingStaffOnly = isTeachingStaffOnly(authorization);
  const superAdminUser = isSuperAdminUser(authorization);

  const groups = useMemo(
    () =>
      filterNavGroups(NAV_GROUPS, hasAnyPermission, {
        teachingStaffOnly,
        superAdminUser,
      }),
    [hasAnyPermission, teachingStaffOnly, superAdminUser],
  );

  const isItemActive = (href: string) => {
    const [itemPath, itemQuery] = href.split("?");

    if (itemQuery) {
      if (pathname !== itemPath) return false;
      const itemParams = new URLSearchParams(itemQuery);
      let matched = true;
      itemParams.forEach((val, key) => {
        const currentVal = searchParams.get(key);
        if (currentVal !== val) {
          if (
            pathname === "/reports" &&
            key === "tab" &&
            (val === "master-vs-changed" || val === "department-timetables") &&
            !currentVal
          ) {
            return;
          }
          matched = false;
        }
      });
      return matched;
    }

    if (pathname === itemPath) return true;

    if (pathname.startsWith(`${itemPath}/`)) {
      const hasExactOtherMatch = groups.some((g) =>
        g.items.some((i) => i.href.split("?")[0] === pathname),
      );
      return !hasExactOtherMatch;
    }

    return false;
  };

  const roleLabel = useMemo(() => {
    return getUniqueSingleRoleLabel(authorization);
  }, [authorization]);

  const canOpenProfile =
    Boolean(user) &&
    (hasPermission("user_management.view") ||
      hasPermission("user_management.manage_users"));

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={cn(
          "fixed inset-0 z-[45] backdrop-blur-[1px] transition-opacity lg:hidden",
          open ? "opacity-60" : "pointer-events-none opacity-0",
        )}
        style={{ backgroundColor: "var(--sidebar, #1E3150)" }}
        onClick={onClose}
        aria-hidden={!open}
      />

      <aside
        className={cn(
          "fixed top-0 left-0 bottom-0 z-40 flex h-dvh flex-col border-r transition-all duration-200 ease-in-out select-none",
          collapsed ? "w-[80px]" : "w-[256px]",
          open ? "translate-x-0 max-lg:z-50" : "-translate-x-full lg:translate-x-0",
        )}
        style={{
          backgroundColor: "var(--sidebar, #1E3150)",
          color: "var(--sidebar-text, #FFFFFF)",
          borderColor: "var(--border, rgba(255, 255, 255, 0.1))",
          boxShadow: "4px 0 24px -2px rgba(10, 20, 35, 0.45)",
          fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Floating circular collapse control */}
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden lg:flex items-center justify-center absolute -right-[12px] top-[106px] z-50 w-[24px] h-[24px] rounded-full border shadow-md transition-transform hover:scale-105 cursor-pointer focus:outline-hidden"
          style={{
            backgroundColor: "var(--surface, #FFFFFF)",
            borderColor: "var(--border, rgba(255, 255, 255, 0.15))",
            color: "var(--text-primary, #123B63)",
          }}
        >
          {collapsed ? (
            <ChevronRight size={14} strokeWidth={2.5} />
          ) : (
            <ChevronLeft size={14} strokeWidth={2.5} />
          )}
        </button>

        {/* Brand Header */}
        <div
          className={cn(
            "relative flex shrink-0 flex-col items-center justify-center text-center border-b transition-all duration-200",
            collapsed
              ? "pt-[24px] pb-[16px] px-[8px]"
              : "pt-[24px] pb-[16px] px-[24px]",
          )}
          style={{ borderColor: "var(--border, rgba(255, 255, 255, 0.1))" }}
        >
          <Link
            href="/dashboard"
            onClick={onClose}
            className="flex flex-col items-center justify-center focus:outline-hidden"
          >
            {collapsed ? (
              <img
                src="/campo-logos/icon-192.png"
                alt="Campo Academic Portal"
                className="h-[36px] w-[36px] rounded-[10px] object-contain transition-all duration-200 shadow-xs"
              />
            ) : (
              <>
                <img
                  src="/campo-logos/campo_logo_transparent_hq.png"
                  alt="Campo Academic Portal"
                  className="h-[28px] max-w-[120px] object-contain transition-all duration-200"
                />
                <span
                  className="mt-[8px] text-[12px] font-medium tracking-wide"
                  style={{ color: "var(--sidebar-muted, #AABBD4)" }}
                >
                  Academic Portal
                </span>
              </>
            )}
          </Link>

          {/* Close button for mobile drawer */}
          <button
            type="button"
            className="absolute right-3 top-3 rounded-md p-1.5 text-sidebar-muted transition hover:bg-white/10 hover:text-white lg:hidden cursor-pointer"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Area */}
        <nav
          className={cn(
            "sidebar-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain transition-all duration-200 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
            collapsed
              ? "px-[12px] pt-[12px] pb-[16px]"
              : "px-[14px] pt-[12px] pb-[16px]",
          )}
        >
          <div className="space-y-[24px]">
            {groups.map((group) => {
              if (!group.items.length) return null;

              if (collapsed) {
                return (
                  <div key={group.title} className="space-y-[6px]">
                    {group.items.map((item) => {
                      const active = isItemActive(item.href);
                      const ItemIcon = item.icon || group.icon;
                      const label = navLabelForItem(item, { superAdminUser });

                      return (
                        <div key={item.href} className="flex justify-center">
                          <Link
                            href={item.href}
                            onClick={() => {
                              hideTooltip();
                              onClose();
                            }}
                            onMouseEnter={(e) => showTooltip(label, e)}
                            onMouseLeave={hideTooltip}
                            className={cn(
                              "flex h-[44px] w-[44px] items-center justify-center rounded-[12px] transition-all duration-150 focus:outline-hidden",
                              active
                                ? "shadow-sm"
                                : "hover:bg-white/10 hover:text-white",
                            )}
                            style={
                              active
                                ? {
                                    backgroundColor: "var(--primary, #123B63)",
                                    color: "var(--sidebar-text, #FFFFFF)",
                                  }
                                : {
                                    color: "var(--sidebar-muted, #AABBD4)",
                                  }
                            }
                            title={label}
                            aria-label={label}
                          >
                            <ItemIcon
                              size={20}
                              strokeWidth={2}
                              className="shrink-0"
                            />
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                );
              }

              return (
                <div key={group.title}>
                  {/* Section heading: 14px horizontal, 4px top, 8px bottom padding, 11px bold uppercase 0.06em tracking */}
                  <div
                    className="px-[14px] pt-[4px] pb-[8px] text-[11px] font-bold uppercase tracking-[0.06em]"
                    style={{ color: "var(--sidebar-muted, #AABBD4)" }}
                  >
                    {group.title}
                  </div>

                  {/* 4px between section heading and its items */}
                  <ul className="space-y-[4px]">
                    {group.items.map((item) => {
                      const active = isItemActive(item.href);
                      const ItemIcon = item.icon || group.icon;
                      const label = navLabelForItem(item, { superAdminUser });

                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={onClose}
                            className={cn(
                              "group flex w-full items-center px-[14px] py-[10px] rounded-[12px] gap-[14px] text-[13px] transition-all duration-150 focus:outline-hidden",
                              active
                                ? "font-semibold shadow-sm"
                                : "font-medium hover:bg-white/10 hover:text-white",
                            )}
                            style={
                              active
                                ? {
                                    backgroundColor: "var(--primary, #123B63)",
                                    color: "var(--sidebar-text, #FFFFFF)",
                                  }
                                : {
                                    color: "var(--sidebar-text, #FFFFFF)",
                                  }
                            }
                          >
                            <ItemIcon
                              size={18}
                              strokeWidth={2}
                              className={cn(
                                "shrink-0 transition-colors",
                                active
                                  ? "text-inherit"
                                  : "text-[var(--sidebar-muted,#AABBD4)] group-hover:text-white",
                              )}
                            />
                            <span className="truncate leading-snug">{label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </nav>

        {/* Bottom User Profile */}
        <div
          className={cn(
            "shrink-0 mt-auto transition-all duration-200",
            collapsed ? "p-[14px]" : "p-[14px]",
          )}
        >
          {collapsed ? (
            <div className="flex flex-col items-center">
              <button
                type="button"
                disabled={!canOpenProfile}
                onClick={() => {
                  if (!canOpenProfile) return;
                  setProfileOpen(true);
                  onClose();
                }}
                onMouseEnter={(e) =>
                  showTooltip(
                    `${user?.name || "User"} (${roleLabel || user?.email || user?.username || "Staff"})`,
                    e,
                  )
                }
                onMouseLeave={hideTooltip}
                className={cn(
                  "flex h-[40px] w-[40px] items-center justify-center rounded-full overflow-hidden text-[14px] font-bold shadow-xs transition hover:opacity-90",
                  canOpenProfile ? "cursor-pointer" : "cursor-default",
                )}
                style={
                  user?.profilePhoto
                    ? undefined
                    : {
                        backgroundColor: "var(--primary-light, #EAF4FB)",
                        color: "var(--primary, #123B63)",
                      }
                }
                title={`${user?.name || "User"} (${roleLabel || user?.email || user?.username || "Staff"})`}
                aria-label="Profile"
              >
                {user?.profilePhoto ? (
                  <img
                    src={user.profilePhoto}
                    alt={user?.name || "Profile"}
                    className="h-full w-full object-cover"
                  />
                ) : user?.name ? (
                  user.name.trim().charAt(0).toUpperCase()
                ) : (
                  <UserRound size={18} strokeWidth={2} />
                )}
              </button>
            </div>
          ) : (
            <div
              className="flex h-[64px] items-center justify-between rounded-[16px] px-[14px] border shadow-md transition-all duration-150"
              style={{
                backgroundColor: "rgba(0, 0, 0, 0.25)",
                borderColor: "rgba(255, 255, 255, 0.08)",
                boxShadow: "0 4px 16px -2px rgba(0, 0, 0, 0.3)",
              }}
            >
              <button
                type="button"
                disabled={!canOpenProfile}
                onClick={() => {
                  if (!canOpenProfile) return;
                  setProfileOpen(true);
                  onClose();
                }}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-[12px] text-left transition hover:opacity-95 focus:outline-hidden",
                  canOpenProfile ? "cursor-pointer" : "cursor-default",
                )}
                title={canOpenProfile ? "View / edit your profile" : undefined}
              >
                <span
                  className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full text-[14px] font-bold overflow-hidden"
                  style={
                    user?.profilePhoto
                      ? undefined
                      : {
                          backgroundColor: "var(--primary-light, #EAF4FB)",
                          color: "var(--primary, #123B63)",
                        }
                  }
                >
                  {user?.profilePhoto ? (
                    <img
                      src={user.profilePhoto}
                      alt={user?.name || "Profile"}
                      className="h-full w-full object-cover"
                    />
                  ) : user?.name ? (
                    user.name.trim().charAt(0).toUpperCase()
                  ) : (
                    <UserRound size={18} strokeWidth={2} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate text-[13px] font-bold leading-tight"
                    style={{ color: "var(--sidebar-text, #FFFFFF)" }}
                  >
                    {user?.name || "Signed in"}
                  </span>
                  <span
                    className="block truncate text-[11px] font-normal leading-tight mt-0.5"
                    style={{ color: "var(--sidebar-muted, #AABBD4)" }}
                  >
                    {roleLabel || user?.email || user?.username || "Staff"}
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => setLogoutModalOpen(true)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sidebar-muted transition hover:bg-white/10 hover:text-white cursor-pointer ml-1 focus:outline-hidden"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut size={16} strokeWidth={2} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {profileOpen && user && canOpenProfile ? (
        <SelfProfileModal
          userId={user.id}
          onClose={() => setProfileOpen(false)}
          onSaved={async () => {
            await refresh();
            setProfileOpen(false);
          }}
        />
      ) : null}

      <LogoutConfirmModal
        isOpen={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
      />

      {mounted && typeof document !== "undefined"
        ? createPortal(
            <>
              {/* Tooltip on hover in collapsed mode */}
              {hoveredItem ? (
                <div
                  className="pointer-events-none fixed z-[9999] rounded-md border px-2.5 py-1 text-xs font-medium shadow-xl whitespace-nowrap animate-in fade-in zoom-in-95 duration-100"
                  style={{
                    top: hoveredItem.top,
                    left: hoveredItem.left,
                    backgroundColor: "var(--sidebar, #1E3150)",
                    borderColor: "var(--border, rgba(255, 255, 255, 0.15))",
                    color: "var(--sidebar-text, #FFFFFF)",
                    fontFamily:
                      "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
                    boxShadow: "0 4px 14px rgba(0, 0, 0, 0.35)",
                  }}
                >
                  {hoveredItem.title}
                </div>
              ) : null}
            </>,
            document.body,
          )
        : null}
    </>
  );
}

function SelfProfileModal(props: {
  userId: number;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocalBootstrap, setIsLocalBootstrap] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [hrmsEmployeeId, setHrmsEmployeeId] = useState<string | null>(null);
  const [roles, setRoles] = useState<Array<{
    id: number;
    roleId?: number;
    roleKey: string;
    label: string;
    collegeId: number | null;
    collegeName: string | null;
    branchId: number | null;
    branchName: string | null;
  }>>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [teachingScope, setTeachingScope] = useState<{
    staffLinkId: number | null;
    subjectsCount: number;
    totalTeachingStudents: number;
    subjects: Array<{
      subjectId: number;
      subjectCode: string;
      subjectName: string;
      sectionName: string | null;
      batch: string | null;
      yearOfStudy: number | null;
      semesterNumber: number | null;
      branchId: number;
      branchName: string;
      collegeName: string;
      studentCount: number;
    }>;
  } | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const inputClass =
    "mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-500";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch(`/users/${props.userId}`, { cache: "no-store" });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.message || "Failed to load profile");
        if (cancelled) return;
        setName(String(body.name ?? ""));
        setEmail(String(body.email ?? ""));
        setUsername(String(body.username ?? ""));
        setHrmsEmployeeId(body.hrmsEmployeeId ? String(body.hrmsEmployeeId) : null);
        setIsLocalBootstrap(Boolean(body.isLocalBootstrap));
        setRoles(Array.isArray(body.roles) ? body.roles : []);
        setPermissions(Array.isArray(body.permissions) ? body.permissions : []);
        setTeachingScope(body.teachingScope ?? null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [props.userId]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (!name.trim()) throw new Error("Name is required");
      if (isLocalBootstrap && !username.trim()) throw new Error("Username is required");
      if (newPassword || confirmPassword || currentPassword) {
        if (!isLocalBootstrap) throw new Error("Password is managed in HRMS");
        if (!currentPassword) throw new Error("Enter your current password");
        if (newPassword.length < 8) throw new Error("New password must be at least 8 characters");
        if (newPassword !== confirmPassword) throw new Error("Password confirmation does not match");
      }

      const payload: Record<string, string> = { name: name.trim() };
      if (isLocalBootstrap) {
        payload.email = email.trim();
        payload.username = username.trim();
        if (newPassword) {
          payload.currentPassword = currentPassword;
          payload.newPassword = newPassword;
        }
      }

      const response = await apiFetch(`/users/${props.userId}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.message || "Failed to save profile");
      await props.onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setBusy(false);
    }
  }

  // Generate user initials for avatar
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("") || "AP";

  const primaryRole = roles[0];
  const isGlobalUser = roles.some((r) => r.roleKey === "super_admin" || (!r.collegeId && !r.branchId));

  const userYearAccess = useMemo(() => {
    return getUserYearAccess(props.userId, ["all"]);
  }, [props.userId]);

  const isAllYears = !userYearAccess || userYearAccess.length === 0 || userYearAccess.includes("all");
  const yearLabelsMap: Record<string, string> = {
    "1": "1st Year",
    "2": "2nd Year",
    "3": "3rd Year",
    "4": "4th Year (Final Year)",
  };
  const activeYearLabels = isAllYears
    ? ["1st Year", "2nd Year", "3rd Year", "4th Year (Final Year)"]
    : userYearAccess.map((y) => yearLabelsMap[y] || `${y} Year`);

  const yearBadge = isAllYears
    ? "All Years (Full Coverage)"
    : activeYearLabels.join(", ");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={props.onClose} />
      <div className="relative flex w-full max-w-xl flex-col max-h-[90vh] rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-navy-700 to-navy-900 text-white font-bold text-base shadow-sm">
              {initials}
            </div>
            <div>
              <h3 className="text-base font-bold text-navy-900 flex items-center gap-2">
                {name || "User Profile"}
                {hrmsEmployeeId && (
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 font-mono border border-slate-200">
                    ID: {hrmsEmployeeId}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {email || username || "Academic Portal Member"}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={props.onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto space-y-4 px-6 py-5">
          {loading ? (
            <div className="space-y-3 py-2 portal-fade-in" aria-busy="true" aria-label="Loading profile…">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-9 w-full rounded-md" />
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          ) : null}

          {error ? (
            <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
              {error}
            </div>
          ) : null}

          {!loading ? (
            <>
              {/* SECTION: Assigned Role & Access Authority */}
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-blue-700" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-blue-950">
                      Assigned Role &amp; Access Authority
                    </h4>
                  </div>
                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
                    {roles.length} Role{roles.length === 1 ? "" : "s"} Active
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {roles.length === 0 ? (
                    <span className="text-xs text-slate-500">No specific role assigned.</span>
                  ) : (
                    roles.map((r, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-bold text-navy-900 shadow-2xs"
                      >
                        <BadgeCheck className="h-3.5 w-3.5 text-blue-600" />
                        {r.label || r.roleKey}
                      </span>
                    ))
                  )}
                </div>

                <p className="text-[11px] text-blue-800 leading-relaxed">
                  {primaryRole?.roleKey === "hod"
                    ? "Head of Department — Authorized for complete academic management, attendance supervision, timetable allocation, and risk monitoring for the assigned department."
                    : primaryRole?.roleKey === "super_admin"
                    ? "Super Admin — Unrestricted institute-wide system access, user management, and portal configuration."
                    : primaryRole?.roleKey === "principal" || primaryRole?.roleKey === "vice_principal"
                    ? "College Leadership — Oversight across all academic streams, faculty rosters, and college operations."
                    : primaryRole?.roleKey === "class_teacher"
                    ? "Class Teacher — Designated mentor and section in-charge for student attendance, internal assessments, and student rosters."
                    : "Faculty Member — Teaching schedule, period attendance recording, and curriculum tracking."}
                </p>
              </div>

              {/* SECTION: Scope of Access (College, Branch, Year) */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-emerald-700" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-950">
                      Scope of Access (Institutional Coverage)
                    </h4>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                    Verified Scope
                  </span>
                </div>

                {isGlobalUser ? (
                  <div className="rounded-lg border border-emerald-200 bg-white p-3 text-xs text-slate-700 space-y-1">
                    <span className="font-bold text-emerald-800">🌐 Global Authority</span>
                    <p className="text-slate-600">Access applies across all colleges, departments, and academic branches.</p>
                  </div>
                ) : (
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {/* College Scope */}
                    <div className="rounded-lg border border-emerald-100 bg-white p-3 space-y-1 shadow-2xs">
                      <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-semibold">
                        <Building className="h-3.5 w-3.5 text-emerald-600" />
                        <span>College Scope</span>
                      </div>
                      <p className="text-xs font-bold text-navy-950">
                        {primaryRole?.collegeName || "Campo College of Engineering"}
                      </p>
                    </div>

                    {/* Department / Branch Scope */}
                    <div className="rounded-lg border border-emerald-100 bg-white p-3 space-y-1 shadow-2xs">
                      <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-semibold">
                        <GraduationCap className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Department &amp; Branch</span>
                      </div>
                      <p className="text-xs font-bold text-navy-950">
                        {primaryRole?.branchName
                          ? `${primaryRole.branchName} (B.Tech)`
                          : "All Academic Branches"}
                      </p>
                    </div>

                    {/* Year Access Scope */}
                    <div className="rounded-lg border border-emerald-100 bg-white p-3 space-y-1 shadow-2xs sm:col-span-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-semibold">
                          <Calendar className="h-3.5 w-3.5 text-[#f59e0b]" />
                          <span>Year Access Scope</span>
                        </div>
                        <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                          {yearBadge}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {activeYearLabels.map((yr) => (
                          <span
                            key={yr}
                            className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 border border-amber-200/60"
                          >
                            <CheckCircle2 className="h-3 w-3 text-amber-600" />
                            {yr}
                          </span>
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-500 pt-0.5">
                        {isAllYears
                          ? "Authorized to access and review student records across all academic years of the department."
                          : `Authorized to access and review student records for ${yearBadge} of the department.`}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION: Teaching Scope (if available) */}
              {teachingScope && teachingScope.subjects && teachingScope.subjects.length > 0 ? (
                <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-violet-700" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-violet-950">
                        Teaching Class Allocations
                      </h4>
                    </div>
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800">
                      {teachingScope.subjects.length} Class Session{teachingScope.subjects.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {teachingScope.subjects.slice(0, 3).map((sub, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg border border-violet-100 bg-white px-3 py-2 text-xs"
                      >
                        <div>
                          <span className="font-semibold text-slate-800">{sub.subjectName}</span>
                          <span className="block text-[11px] text-slate-500">
                            {sub.branchName} · Sem {sub.semesterNumber || 1} ({sub.sectionName || "A"})
                          </span>
                        </div>
                        <span className="text-[11px] font-medium text-slate-600">
                          {sub.studentCount} Students
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* SECTION: Faculty Achievements & Research */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-amber-700" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-950">
                      Research &amp; Scholarly Achievements
                    </h4>
                  </div>
                  <Link
                    href="/achievements"
                    onClick={props.onClose}
                    className="inline-flex items-center gap-1 rounded-md bg-amber-600 hover:bg-amber-700 px-2.5 py-1 text-xs font-semibold text-white shadow-2xs transition"
                  >
                    <span>Open Portfolio</span>
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Document your research papers, conference presentations, patents, FDPs, and professional certifications. Submitted achievements are reviewed by your HOD and verified on your institutional staff profile.
                </p>
              </div>

              {/* SECTION: Account Information & Settings */}
              <div className="space-y-3 pt-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Account Details
                </h4>

                <label className="block text-xs font-medium text-slate-600">
                  Display name
                  <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
                </label>

                {isLocalBootstrap ? (
                  <>
                    <label className="block text-xs font-medium text-slate-600">
                      Username
                      <input
                        className={inputClass}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                      />
                    </label>
                    <label className="block text-xs font-medium text-slate-600">
                      Email
                      <input
                        className={inputClass}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </label>
                    <div className="space-y-2 border-t border-slate-200 pt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Change password (optional)
                      </p>
                      <label className="block text-xs font-medium text-slate-600">
                        Current password
                        <input
                          type="password"
                          className={inputClass}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                        />
                      </label>
                      <label className="block text-xs font-medium text-slate-600">
                        New password
                        <input
                          type="password"
                          className={inputClass}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                      </label>
                      <label className="block text-xs font-medium text-slate-600">
                        Confirm new password
                        <input
                          type="password"
                          className={inputClass}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                      </label>
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Username / Login:</span>
                      <span className="font-semibold text-slate-800">{username || email}</span>
                    </div>
                    {email && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Registered Email:</span>
                        <span className="font-semibold text-slate-800">{email}</span>
                      </div>
                    )}
                    <p className="text-[11px] text-slate-400 pt-1">
                      Username, email, and sign-in credentials are synchronized with HRMS for linked accounts.
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
                <Button variant="secondary" onClick={props.onClose} className="text-xs">
                  Cancel
                </Button>
                <Button disabled={busy} onClick={() => void save()} className="text-xs">
                  {busy ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
