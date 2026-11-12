"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarOff,
  Calendar,
  CalendarDays,
  Clock,
  Shield,
  Users,
  Briefcase,
  GitBranch,
  AlertTriangle,
  FileQuestion,
  Settings,
  ChevronRight,
  ChevronLeft,
  SlidersHorizontal,
  Search,
  X,
  LayoutGrid,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/cn";

type SettingNavItem = {
  title: string;
  href: string;
  icon: typeof Settings;
  permissions?: string[];
  keywords?: string[];
};

type SettingNavGroup = {
  groupName: string;
  items: SettingNavItem[];
};

const SETTING_GROUPS: SettingNavGroup[] = [
  {
    groupName: "Application",
    items: [
      {
        title: "Attendance Percentages",
        href: "/settings/attendance-thresholds",
        icon: SlidersHorizontal,
        permissions: ["settings.view", "settings.edit", "attendance.view"],
        keywords: ["attendance", "percentage", "threshold", "eligible", "condonation", "detained", "exam"],
      },
      {
        title: "Attendance Calendar",
        href: "/attendance-calendar",
        icon: CalendarDays,
        permissions: ["settings.view", "attendance_calendar.view"],
        keywords: ["calendar", "working days", "holidays", "monthly"],
      },
      {
        title: "Semester Dates",
        href: "/settings/semester-dates",
        icon: Calendar,
        permissions: ["settings.view", "semester_dates.view"],
        keywords: ["semester", "dates", "academic year", "start", "end"],
      },
      {
        title: "Course Exclusions",
        href: "/settings/course-exclusions",
        icon: CalendarOff,
        permissions: ["settings.view", "settings.edit", "timetables.manage"],
        keywords: ["timetable", "course", "exclusions", "degree"],
      },
      {
        title: "Workload Thresholds",
        href: "/settings/workload-thresholds",
        icon: Clock,
        permissions: ["settings.view", "settings.edit"],
        keywords: ["workload", "teaching", "periods", "hours", "faculty"],
      },
    ],
  },
  {
    groupName: "Human Resources & Access",
    items: [
      {
        title: "Roles & Permissions",
        href: "/settings/roles",
        icon: Shield,
        permissions: ["roles.view", "roles.manage"],
        keywords: ["roles", "permissions", "rbac", "access", "security"],
      },
      {
        title: "User Management",
        href: "/user-management",
        icon: Users,
        permissions: ["user_management.view"],
        keywords: ["users", "staff", "accounts", "passwords", "login"],
      },
      {
        title: "Faculty Display",
        href: "/settings/faculty-display",
        icon: Briefcase,
        permissions: ["settings.view", "settings.edit"],
        keywords: ["faculty", "departments", "hrms", "staff display"],
      },
      {
        title: "Request Workflows",
        href: "/settings/request-workflows",
        icon: GitBranch,
        permissions: ["request.workflow.manage"],
        keywords: ["workflow", "approval", "hierarchy", "requests"],
      },
    ],
  },
  {
    groupName: "Student Services & Forms",
    items: [
      {
        title: "Feedback Forms",
        href: "/settings/feedback-forms",
        icon: FileQuestion,
        permissions: ["settings.view", "settings.edit"],
        keywords: ["feedback", "forms", "surveys", "evaluations", "ratings"],
      },
      {
        title: "Complaint Types",
        href: "/settings/complaint-types",
        icon: AlertTriangle,
        permissions: ["settings.view", "settings.edit"],
        keywords: ["complaints", "mentoring", "grievances", "risk types"],
      },
    ],
  },
  {
    groupName: "System Configuration",
    items: [
      {
        title: "All Settings Hub",
        href: "/settings",
        icon: LayoutGrid,
        permissions: ["settings.view"],
        keywords: ["hub", "overview", "all", "settings", "configuration"],
      },
    ],
  },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { hasAnyPermission } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Filter groups and items based on permissions and real-time search query
  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return SETTING_GROUPS.map((group) => {
      const visibleItems = group.items.filter((item) => {
        // Permission check
        if (item.permissions?.length && !hasAnyPermission(...item.permissions)) {
          return false;
        }

        // Search check
        if (!q) return true;

        const titleMatch = item.title.toLowerCase().includes(q);
        const groupMatch = group.groupName.toLowerCase().includes(q);
        const keywordMatch = item.keywords?.some((k) => k.toLowerCase().includes(q));

        return titleMatch || groupMatch || Boolean(keywordMatch);
      });

      return {
        ...group,
        items: visibleItems,
      };
    }).filter((group) => group.items.length > 0);
  }, [searchQuery, hasAnyPermission]);

  return (
    <div className="mx-auto max-w-[1600px]">
      {/* Mobile / Tablet Horizontal Category Pill Bar */}
      <div className="mb-3 flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none lg:hidden border-b border-slate-200">
        {SETTING_GROUPS.flatMap((g) => g.items)
          .filter((item) => !item.permissions?.length || hasAnyPermission(...item.permissions))
          .map((item) => {
            const isActive =
              pathname === item.href || (item.href !== "/settings" && pathname.startsWith(`${item.href}/`));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                  isActive
                    ? "border border-emerald-600/40 bg-emerald-50 text-emerald-900 shadow-xs font-bold"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900",
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", isActive ? "text-emerald-700" : "text-slate-500")} />
                <span>{item.title}</span>
              </Link>
            );
          })}
      </div>

      {/* Main Layout: Inner Settings Sidebar + Content Area */}
      <div className="flex gap-5 items-start">
        {/* Desktop Inner Settings Sidebar */}
        <aside
          className={cn(
            "hidden lg:flex flex-col shrink-0 rounded-2xl border border-slate-200/90 bg-white shadow-2xs transition-all duration-200 sticky top-4",
            isCollapsed ? "w-16 p-2.5 items-center" : "w-72 xl:w-80 p-4",
          )}
        >
          {isCollapsed ? (
            /* Collapsed View */
            <div className="flex flex-col items-center gap-4 py-2 w-full">
              <button
                type="button"
                onClick={() => setIsCollapsed(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50/50 shadow-2xs transition"
                title="Expand settings sidebar"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
                <Settings className="h-4 w-4 stroke-[2.2]" />
              </div>

              <div className="h-px w-8 bg-slate-200" />

              <nav className="flex flex-col gap-1 w-full items-center">
                {SETTING_GROUPS.flatMap((g) => g.items)
                  .filter((item) => !item.permissions?.length || hasAnyPermission(...item.permissions))
                  .map((item) => {
                    const isActive =
                      pathname === item.href || (item.href !== "/settings" && pathname.startsWith(`${item.href}/`));
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-lg transition-all",
                          isActive
                            ? "border border-emerald-600/40 bg-emerald-50 text-emerald-800 shadow-2xs"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                        )}
                        title={item.title}
                      >
                        <Icon className="h-4 w-4" />
                      </Link>
                    );
                  })}
              </nav>
            </div>
          ) : (
            /* Full Professional Settings Sidebar (Matching Design) */
            <>
              {/* TOP HEADER BLOCK */}
              <div className="space-y-3 pb-3 border-b border-slate-100">
                {/* Small Top Eyebrow + Collapse Toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-widest text-emerald-800 uppercase">
                    Configuration
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsCollapsed(true)}
                    className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 hover:text-emerald-700 hover:border-emerald-300 shadow-2xs transition"
                    title="Collapse settings sidebar"
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </button>
                </div>

                {/* Admin Settings Title Box */}
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-2xs shrink-0">
                    <Settings className="h-5 w-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 leading-tight">
                      Admin settings
                    </h2>
                    <p className="text-[10px] font-bold tracking-wider text-emerald-700 uppercase mt-0.5">
                      Global configuration
                    </p>
                  </div>
                </div>

                {/* Emerald Accent Bar */}
                <div className="h-0.5 w-12 bg-emerald-600 rounded-full" />
              </div>

              {/* SEARCH INPUT */}
              <div className="relative mt-3 mb-2">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search settings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-7 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* GROUPED NAVIGATION ITEMS */}
              <nav
                className="mt-2 space-y-4 max-h-[calc(100vh-320px)] overflow-y-auto pr-1 scrollbar-thin"
                aria-label="Settings Sub Navigation"
              >
                {filteredGroups.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    No settings match &ldquo;{searchQuery}&rdquo;
                  </div>
                ) : (
                  filteredGroups.map((group) => (
                    <div key={group.groupName} className="space-y-1">
                      <div className="px-3 text-[10px] font-bold tracking-widest text-emerald-800 uppercase">
                        {group.groupName}
                      </div>
                      <div className="space-y-0.5">
                        {group.items.map((item) => {
                          const isActive =
                            pathname === item.href ||
                            (item.href !== "/settings" && pathname.startsWith(`${item.href}/`));
                          const Icon = item.icon;

                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={cn(
                                "group flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-all",
                                isActive
                                  ? "border border-emerald-600/40 bg-emerald-50/80 text-emerald-900 font-semibold shadow-xs"
                                  : "border border-transparent text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-medium",
                              )}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Icon
                                  className={cn(
                                    "h-4 w-4 shrink-0 transition-colors",
                                    isActive
                                      ? "text-emerald-700 stroke-[2.2]"
                                      : "text-slate-500 group-hover:text-emerald-700",
                                  )}
                                />
                                <span className="truncate">{item.title}</span>
                              </div>
                              <ChevronRight
                                className={cn(
                                  "h-3.5 w-3.5 shrink-0 transition-all",
                                  isActive
                                    ? "text-emerald-700 opacity-100 translate-x-0.5"
                                    : "text-slate-400 opacity-0 group-hover:opacity-100",
                                )}
                              />
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </nav>

              {/* MODULAR CONFIGURATION FOOTER CARD */}
              <div className="mt-auto pt-3 border-t border-slate-100">
                <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-2.5">
                  <div className="text-[10px] font-bold tracking-wider text-emerald-800 uppercase">
                    Modular Configuration
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Academic portal global settings &amp; rules
                  </p>
                </div>
              </div>
            </>
          )}
        </aside>

        {/* Right Content Area */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
