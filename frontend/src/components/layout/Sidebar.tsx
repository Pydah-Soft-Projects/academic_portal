"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  ChevronRight,
  LogOut,
  PanelLeftClose,
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
} from "lucide-react";
import { NAV_GROUPS, filterNavGroups, navLabelForItem, type NavGroup } from "@/lib/navigation";
import { cn } from "@/lib/cn";
import { useAuth } from "@/components/auth/AuthProvider";
import { isTeachingStaffOnly, isSuperAdminUser } from "@/lib/teaching-scope";
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
  const { user, authorization, logout, refresh, hasAnyPermission, hasPermission } =
    useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [mounted, setMounted] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<{
    title: string;
    top: number;
    left: number;
  } | null>(null);
  const [flyoutMenu, setFlyoutMenu] = useState<{
    group: NavGroup;
    top: number;
    left: number;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setFlyoutMenu(null);
    setHoveredItem(null);
  }, [pathname, searchParams, collapsed]);

  useEffect(() => {
    if (!flyoutMenu) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node | null;
      const flyoutEl = document.getElementById("sidebar-flyout-menu");
      if (flyoutEl && flyoutEl.contains(target)) {
        return;
      }
      const clickedToggleButton = (target as Element | null)?.closest?.("[data-group-toggle]");
      if (clickedToggleButton) {
        return;
      }
      setFlyoutMenu(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setFlyoutMenu(null);
      }
    }

    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [flyoutMenu]);

  const showTooltip = (title: string, e: React.MouseEvent<HTMLElement>) => {
    if (flyoutMenu) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredItem({
      title,
      top: rect.top + rect.height / 2 - 13,
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

  // Auto-expand group containing the active page on load & navigation
  useEffect(() => {
    const parentGroup = groups.find((g) =>
      g.items.some((item) => isItemActive(item.href)),
    );
    if (parentGroup) {
      setExpandedGroups({
        [parentGroup.title]: true,
      });
    }
  }, [pathname, searchParams, groups]);

  const toggleGroup = (title: string) => {
    setExpandedGroups((prev) => {
      const isOpen = Boolean(prev[title]);
      if (isOpen) {
        return {};
      }
      return { [title]: true };
    });
  };

  const roleLabel = useMemo(() => {
    const roles = authorization?.roles ?? [];
    if (!roles.length) return null;
    return roles.map((r) => r.label).join(" · ");
  }, [authorization?.roles]);

  const canOpenProfile =
    Boolean(user) &&
    (hasPermission("user_management.view") ||
      hasPermission("user_management.manage_users"));

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-900/30 transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden={!open}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-dvh max-h-dvh flex-col overflow-x-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width,transform] duration-200 lg:static lg:h-full lg:max-h-none lg:translate-x-0",
          collapsed ? "w-[72px]" : "w-[240px]",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-center border-b border-sidebar-border px-3 py-3",
            collapsed ? "justify-center px-2" : "gap-2",
          )}
        >
          {collapsed ? (
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="group flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-sidebar-hover focus:outline-hidden"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/branding/icon-mark.png"
                alt="Pydah Academic Portal"
                className="h-7 w-7 rounded-md object-contain transition-transform group-hover:scale-105"
              />
            </button>
          ) : (
            <>
              <Link href="/dashboard" className="flex min-w-0 flex-1 items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/branding/icon-mark.png"
                  alt="Pydah Academic Portal"
                  className="h-8 w-8 shrink-0 rounded-md object-contain"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium uppercase tracking-[0.12em] text-brand-500">
                    Pydah Group
                  </p>
                  <h1 className="truncate text-sm font-semibold text-white">
                    Academic Portal
                  </h1>
                </div>
              </Link>
              <button
                type="button"
                className="rounded-md p-1.5 text-slate-300 hover:bg-sidebar-hover lg:hidden"
                onClick={onClose}
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="hidden rounded-md p-1.5 text-slate-300 hover:bg-sidebar-hover lg:inline-flex"
                onClick={onToggleCollapsed}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        <nav className="sidebar-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-2 py-3">
          {groups.map((group) => {
            const GroupIcon = group.icon;
            const isGroupActive = group.items.some((item) => isItemActive(item.href));
            const isGroupExpanded = expandedGroups[group.title] ?? isGroupActive;
            const hasMultiple = group.items.length > 1;

            if (collapsed) {
              if (hasMultiple) {
                const isFlyoutOpen = flyoutMenu?.group.title === group.title;
                return (
                  <div key={group.title} className="mb-2">
                    <button
                      type="button"
                      data-group-toggle={group.title}
                      onClick={(e) => {
                        hideTooltip();
                        if (isFlyoutOpen) {
                          setFlyoutMenu(null);
                        } else {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const estimatedHeight = Math.min(
                            window.innerHeight - 32,
                            50 + group.items.length * 36,
                          );
                          const maxTop = window.innerHeight - estimatedHeight - 16;
                          const top = Math.max(16, Math.min(rect.top, maxTop));
                          setFlyoutMenu({
                            group,
                            top,
                            left: rect.right + 8,
                          });
                        }
                      }}
                      onMouseEnter={(e) => showTooltip(group.title, e)}
                      onMouseLeave={hideTooltip}
                      className={cn(
                        "mx-auto flex h-10 w-10 items-center justify-center rounded-lg transition-all",
                        isGroupActive || isFlyoutOpen
                          ? "bg-sidebar-active text-white shadow-sm"
                          : "text-slate-300 hover:bg-sidebar-hover hover:text-white",
                      )}
                      title={group.title}
                      aria-label={group.title}
                    >
                      <GroupIcon className="h-5 w-5" />
                    </button>
                  </div>
                );
              }

              // Single item in collapsed mode
              const singleItem = group.items[0];
              if (!singleItem) return null;
              const active = isItemActive(singleItem.href);
              const ItemIcon = singleItem.icon || GroupIcon;
              const label = navLabelForItem(singleItem, { superAdminUser });

              return (
                <div key={group.title} className="mb-2">
                  <Link
                    href={singleItem.href}
                    onClick={() => {
                      setFlyoutMenu(null);
                      hideTooltip();
                      onClose();
                    }}
                    onMouseEnter={(e) => showTooltip(label, e)}
                    onMouseLeave={hideTooltip}
                    className={cn(
                      "mx-auto flex h-10 w-10 items-center justify-center rounded-lg transition-all",
                      active
                        ? "bg-sidebar-active text-white shadow-sm"
                        : "text-slate-300 hover:bg-sidebar-hover hover:text-white",
                    )}
                    title={label}
                    aria-label={label}
                  >
                    <ItemIcon className="h-5 w-5" />
                  </Link>
                </div>
              );
            }

            return (
              <div key={group.title} className="mb-2">
                {hasMultiple ? (
                  <>
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.title)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all",
                        isGroupActive
                          ? "bg-sidebar-hover/80 text-white"
                          : "text-slate-300 hover:bg-sidebar-hover hover:text-white",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <GroupIcon
                          className={cn(
                            "h-3.5 w-3.5 shrink-0",
                            isGroupActive ? "text-brand-400" : "text-slate-400",
                          )}
                        />
                        <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-200">
                          {group.title}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center">
                        {isGroupExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-slate-300" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
                        )}
                      </div>
                    </button>

                    {isGroupExpanded ? (
                      <ul className="ml-3.5 mt-1 space-y-0.5 border-l border-sidebar-border/80 pl-2.5">
                        {group.items.map((item) => {
                          const active = isItemActive(item.href);
                          const ItemIcon = item.icon;
                          const label = navLabelForItem(item, { superAdminUser });
                          return (
                            <li key={item.href}>
                              <Link
                                href={item.href}
                                onClick={onClose}
                                className={cn(
                                  "group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                                  active
                                    ? "bg-sidebar-active text-white font-semibold shadow-2xs"
                                    : "text-slate-300 hover:bg-sidebar-hover hover:text-white",
                                )}
                              >
                                {active ? (
                                  <span className="absolute -left-2.5 top-1/2 -mt-2 h-4 w-1 rounded-r-md bg-brand-400" />
                                ) : null}
                                <ItemIcon
                                  className={cn(
                                    "h-3.5 w-3.5 shrink-0",
                                    active
                                      ? "text-brand-400"
                                      : "text-slate-400 group-hover:text-white",
                                  )}
                                />
                                <span className="truncate">{label}</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </>
                ) : (
                  // Single-item group rendered as top-level link
                  <ul className="space-y-0.5">
                    {group.items.map((item) => {
                      const active = isItemActive(item.href);
                      const ItemIcon = item.icon;
                      const label = navLabelForItem(item, { superAdminUser });
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={onClose}
                            className={cn(
                              "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                              active
                                ? "bg-sidebar-active text-white font-semibold shadow-2xs"
                                : "text-slate-300 hover:bg-sidebar-hover hover:text-white",
                            )}
                          >
                            {active ? (
                              <span className="absolute -left-2 top-1/2 -mt-2 h-4 w-1 rounded-r-md bg-brand-400" />
                            ) : null}
                            <ItemIcon
                              className={cn(
                                "h-4 w-4 shrink-0",
                                active
                                  ? "text-brand-400"
                                  : "text-slate-400 group-hover:text-white",
                              )}
                            />
                            <span className="truncate font-medium">{label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        <div
          className={cn(
            "shrink-0 border-t border-sidebar-border px-2 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
            collapsed && "px-1.5",
          )}
        >
          {collapsed ? (
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                disabled={!canOpenProfile}
                onClick={() => {
                  if (!canOpenProfile) return;
                  setProfileOpen(true);
                  onClose();
                }}
                onMouseEnter={(e) => showTooltip(user?.name || "Profile", e)}
                onMouseLeave={hideTooltip}
                className="flex h-9 w-9 items-center justify-center rounded-md text-slate-300 transition hover:bg-sidebar-hover hover:text-white disabled:cursor-default disabled:hover:bg-transparent"
                title={user?.name || "Profile"}
                aria-label="Profile"
              >
                {user?.profilePhoto ? (
                  <img
                    src={user.profilePhoto}
                    alt={user?.name || "Profile"}
                    className="h-7 w-7 rounded-full object-cover border border-white/20"
                  />
                ) : (
                  <UserRound className="h-4 w-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setLogoutModalOpen(true)}
                onMouseEnter={(e) => showTooltip("Sign out", e)}
                onMouseLeave={hideTooltip}
                className="flex h-9 w-9 items-center justify-center rounded-md text-slate-300 transition hover:bg-sidebar-hover hover:text-white cursor-pointer"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={!canOpenProfile}
                onClick={() => {
                  if (!canOpenProfile) return;
                  setProfileOpen(true);
                  onClose();
                }}
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition hover:bg-sidebar-hover disabled:cursor-default disabled:hover:bg-transparent"
                title={canOpenProfile ? "View / edit your profile" : undefined}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-active text-white overflow-hidden border border-white/10">
                  {user?.profilePhoto ? (
                    <img
                      src={user.profilePhoto}
                      alt={user?.name || "Profile"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UserRound className="h-4 w-4" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-white">
                    {user?.name || "Signed in"}
                  </span>
                  <span className="block truncate text-[11px] text-slate-300">
                    {roleLabel || user?.email || user?.username || "HRMS account"}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setLogoutModalOpen(true)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-300 transition hover:bg-sidebar-hover hover:text-white cursor-pointer"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4 shrink-0" />
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
              {/* Tooltip on hover */}
              {hoveredItem && !flyoutMenu ? (
                <div
                  className="pointer-events-none fixed z-[9999] rounded-md border border-slate-700/80 bg-slate-900/95 px-2.5 py-1 text-xs font-medium text-white shadow-xl backdrop-blur-xs whitespace-nowrap animate-in fade-in zoom-in-95 duration-100"
                  style={{ top: hoveredItem.top, left: hoveredItem.left }}
                >
                  {hoveredItem.title}
                </div>
              ) : null}

              {/* Side subsection flyout on click */}
              {flyoutMenu ? (
                <div
                  id="sidebar-flyout-menu"
                  className="fixed z-[9999] w-60 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl border border-sidebar-border bg-sidebar p-2 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
                  style={{ top: flyoutMenu.top, left: flyoutMenu.left }}
                >
                  <div className="mb-1.5 flex items-center justify-between border-b border-sidebar-border/60 px-2.5 py-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-400">
                      {flyoutMenu.group.title}
                    </p>
                    <button
                      type="button"
                      onClick={() => setFlyoutMenu(null)}
                      className="rounded p-0.5 text-slate-400 hover:text-white hover:bg-sidebar-hover transition"
                      aria-label="Close menu"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <ul className="space-y-0.5">
                    {flyoutMenu.group.items.map((item) => {
                      const active = isItemActive(item.href);
                      const ItemIcon = item.icon;
                      const label = navLabelForItem(item, { superAdminUser });
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => {
                              setFlyoutMenu(null);
                              onClose();
                            }}
                            className={cn(
                              "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                              active
                                ? "bg-sidebar-active font-semibold text-white shadow-2xs"
                                : "text-white hover:bg-sidebar-hover",
                            )}
                          >
                            <ItemIcon
                              className={cn(
                                "h-3.5 w-3.5 shrink-0",
                                active ? "text-brand-400" : "text-white/90",
                              )}
                            />
                            <span className="truncate text-white font-medium">{label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
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
                        {primaryRole?.collegeName || "Pydah College of Engineering"}
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
