"use client";

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
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/cn";

type SettingNavItem = {
  title: string;
  href: string;
  icon: typeof Settings;
  permissions?: string[];
};

type SettingNavGroup = {
  groupName: string;
  items: SettingNavItem[];
};

const SETTING_GROUPS: SettingNavGroup[] = [
  {
    groupName: "Academic & Schedules",
    items: [
      {
        title: "Course Exclusions",
        href: "/settings/course-exclusions",
        icon: CalendarOff,
        permissions: ["settings.view", "settings.edit", "timetables.manage"],
      },
      {
        title: "Semester Dates",
        href: "/settings/semester-dates",
        icon: Calendar,
        permissions: ["settings.view", "semester_dates.view"],
      },
      {
        title: "Attendance Calendar",
        href: "/attendance-calendar",
        icon: CalendarDays,
        permissions: ["settings.view", "attendance_calendar.view"],
      },
      {
        title: "Workload Thresholds",
        href: "/settings/workload-thresholds",
        icon: Clock,
        permissions: ["settings.view", "settings.edit"],
      },
    ],
  },
  {
    groupName: "Roles & Access",
    items: [
      {
        title: "Roles & Permissions",
        href: "/settings/roles",
        icon: Shield,
        permissions: ["roles.view", "roles.manage"],
      },
      {
        title: "User Management",
        href: "/user-management",
        icon: Users,
        permissions: ["user_management.view"],
      },
    ],
  },
  {
    groupName: "Workflows & Operations",
    items: [
      {
        title: "Faculty Display",
        href: "/settings/faculty-display",
        icon: Briefcase,
        permissions: ["settings.view", "settings.edit"],
      },
      {
        title: "Request Workflows",
        href: "/settings/request-workflows",
        icon: GitBranch,
        permissions: ["request.workflow.manage"],
      },
      {
        title: "Complaint Types",
        href: "/settings/complaint-types",
        icon: AlertTriangle,
        permissions: ["settings.view", "settings.edit"],
      },
      {
        title: "Feedback Forms",
        href: "/settings/feedback-forms",
        icon: FileQuestion,
        permissions: ["settings.view", "settings.edit"],
      },
    ],
  },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { hasAnyPermission } = useAuth();

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      {/* Mobile / Tablet Horizontal Category Pill Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none lg:hidden border-b border-border">
        {SETTING_GROUPS.flatMap((g) => g.items)
          .filter((item) => !item.permissions?.length || hasAnyPermission(...item.permissions))
          .map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                  isActive
                    ? "bg-navy-900 text-white shadow-xs font-bold"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-navy-900",
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", isActive ? "!text-white" : "text-slate-500")} />
                <span className={cn(isActive ? "!text-white font-bold" : "text-slate-700")}>{item.title}</span>
              </Link>
            );
          })}
      </div>

      {/* Main Container with Inner Sidebar */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {/* Inner Sidebar on Desktop */}
        <aside className="hidden lg:block w-64 shrink-0 rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs sticky top-4">
          <div className="mb-2.5 flex items-center gap-2.5 px-2 py-1.5 border-b border-slate-100">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-50 text-navy-900">
              <Settings className="h-4 w-4 text-navy-800" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-navy-950 leading-tight">Settings & Setup</h2>
              <p className="text-[11px] text-slate-500 font-medium leading-tight mt-0.5">Configuration</p>
            </div>
          </div>

          <nav className="space-y-3" aria-label="Settings Navigation">
            {SETTING_GROUPS.map((group) => {
              const visibleItems = group.items.filter(
                (item) => !item.permissions?.length || hasAnyPermission(...item.permissions),
              );
              if (visibleItems.length === 0) return null;

              return (
                <div key={group.groupName} className="space-y-1">
                  <div className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {group.groupName}
                  </div>
                  <div className="space-y-0.5">
                    {visibleItems.map((item) => {
                      const isActive =
                        pathname === item.href || pathname.startsWith(`${item.href}/`);
                      const Icon = item.icon;

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "group flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                            isActive
                              ? "bg-navy-900 text-white font-bold shadow-2xs"
                              : "text-slate-700 hover:bg-slate-100 hover:text-navy-950 font-medium",
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon
                              className={cn(
                                "h-4 w-4 shrink-0 transition-colors",
                                isActive
                                  ? "!text-white"
                                  : "text-slate-500 group-hover:text-navy-900",
                              )}
                            />
                            <span
                              className={cn(
                                "truncate text-xs",
                                isActive ? "!text-white font-bold" : "text-slate-700 group-hover:text-navy-950 font-medium",
                              )}
                            >
                              {item.title}
                            </span>
                          </div>
                          <ChevronRight
                            className={cn(
                              "h-3.5 w-3.5 shrink-0 transition-opacity",
                              isActive
                                ? "!text-white opacity-100"
                                : "text-slate-400 opacity-0 group-hover:opacity-100",
                            )}
                          />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Right direct content container */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
