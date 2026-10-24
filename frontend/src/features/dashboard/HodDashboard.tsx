"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users,
  Calendar,
  ChevronDown,
  Star,
  ChevronRight,
  Info,
  BookOpen,
  IndianRupee,
  Clock,
  Plane,
  UserX,
  AlertTriangle,
  ClipboardList,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Target,
  X,
  RefreshCw,
  LayoutDashboard,
  Building2,
  UserCheck,
  GraduationCap,
  CalendarCheck,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAcademicContext } from "@/components/layout/AcademicProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import { HodDashboardSkeleton } from "./HodDashboardSkeleton";

export type HodDepartmentItem = {
  id: number;
  name: string;
  code: string | null;
  label: string;
};

export type HodDashboardData = {
  meta: {
    departmentName: string;
    branchId: number | null;
    collegeName: string;
    userName: string;
    roleLabel: string;
    dateFormatted: string;
    departments: HodDepartmentItem[];
  };
  attendance: {
    isPostedToday?: boolean;
    percentage: number;
    present: number;
    total: number;
    trend: string;
    scheduledPeriodsToday?: number;
    postedPeriodsToday?: number;
    sections: Array<{
      section: string;
      percentage: number;
      students?: number;
      postedPeriods?: number;
      totalPeriods?: number;
      periodProgress?: number;
      periods?: Array<{
        periodNumber: number;
        isPosted: boolean;
      }>;
    }>;
  };
  priorityItems: Array<{
    id: number;
    title: string;
    severity: "critical" | "high" | "medium" | "low";
    isWarning?: boolean;
    type: string;
    count?: number;
    amount?: string;
    badge?: string;
    detail?: string;
    link?: string;
  }>;
  sectionsAtRisk: Array<{
    section: string;
    headerBg: string;
    lowAttendance: number;
    internal1Failed: number;
    internal2Failed: number;
  }>;
  subjectsBehind: Array<{
    subject: string;
    faculty: string;
    planned: number;
    completed: number;
    delay: string;
    coverage: string;
    status: "Behind" | "On Track";
  }>;
  feeDue: {
    totalAmount: string | null;
    totalStudents: number | null;
    statusText?: string | null;
    buckets: {
      fifteenDays: { students: number | null; amount: string | null };
      thirtyDays: { students: number | null; amount: string | null };
      sixtyDays: { students: number | null; amount: string | null };
    };
  };
  facultyStatus: {
    attendancePct: number;
    present: number;
    total: number;
    trend: string;
    lateToday: number;
    onLeaveToday: number;
    absentToday: number;
  };
  examStatus: Array<{
    label: string;
    count: number;
    key: string;
  }>;
  placements: {
    placedPct: number;
    placedCount: number;
    eligibleCount: number;
    unplacedCount: number;
    trainingOngoing: number;
    offersReceived: number;
    upcomingDrives: number;
  };
};

interface HodDashboardProps {
  userName?: string;
  departmentName?: string;
  roleLabel?: string;
  academicYear?: string;
  date?: string;
}

export function HodDashboard({
  userName: propUserName,
  departmentName: propDept,
  roleLabel: propRole,
  academicYear: propAY,
  date: propDate,
}: HodDashboardProps) {
  const { filters } = useAcademicContext();

  const [data, setData] = useState<HodDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [selectedDeptName, setSelectedDeptName] = useState<string>(propDept || "CSE");
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<{
    id: number;
    title: string;
    severity?: "critical" | "high" | "medium" | "low";
    isWarning?: boolean;
    type: string;
    count?: number;
    amount?: string;
    badge?: string;
    detail?: string;
    link?: string;
  } | null>(null);

  const activeAY = propAY || filters.academicYear;
  const activeDate = propDate || filters.date;

  const loadData = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (selectedBranchId != null) {
          params.set("branchId", String(selectedBranchId));
        } else if (selectedDeptName && selectedDeptName !== "all") {
          params.set("departmentName", selectedDeptName);
        }
        if (activeAY) params.set("academicYear", activeAY);
        if (activeDate) params.set("date", activeDate);

        const res = await apiFetch(`/hod/dashboard?${params.toString()}`);
        if (!res.ok) {
          throw new Error("Failed to load HOD dashboard data");
        }

        const json = await res.json();
        if (json.data) {
          setData(json.data);
          if (json.data.meta?.branchId && selectedBranchId == null) {
            setSelectedBranchId(json.data.meta.branchId);
          }
          if (json.data.meta?.departmentName) {
            setSelectedDeptName(json.data.meta.departmentName);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading dashboard");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedBranchId, selectedDeptName, activeAY, activeDate],
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const departments = useMemo(() => {
    return data?.meta?.departments || [];
  }, [data]);

  const displayName = propUserName || data?.meta?.userName || "Head of Department";
  const displayRole = propRole || data?.meta?.roleLabel || "Head of Department";
  const displayDept = data?.meta?.departmentName || selectedDeptName;
  const displayDate = data?.meta?.dateFormatted || activeDate || "Today";

  // Initials for avatar
  const initials = useMemo(() => {
    const parts = displayName.replace(/^Dr\.\s*/i, "").trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return displayName.slice(0, 2).toUpperCase();
  }, [displayName]);

  if (loading && !data) {
    return <HodDashboardSkeleton />;
  }

  const isStatsLoading = (loading || refreshing) && Boolean(data);

  const attendance = data?.attendance || {
    isPostedToday: false,
    percentage: 0,
    present: 0,
    total: 0,
    trend: "Not posted yet",
    sections: [],
  };

  const isAttendancePending = attendance.isPostedToday === false || (attendance.present === 0 && attendance.trend.includes("Not posted"));

  const priorityItems = data?.priorityItems || [];
  const sectionsAtRisk = data?.sectionsAtRisk || [];
  const subjectsBehind = data?.subjectsBehind || [];
  const feeDue = data?.feeDue || {
    totalAmount: null,
    totalStudents: null,
    buckets: {
      fifteenDays: { students: null, amount: null },
      thirtyDays: { students: null, amount: null },
      sixtyDays: { students: null, amount: null },
    },
  };
  const facultyStatus = data?.facultyStatus || {
    attendancePct: 0,
    present: 0,
    total: 0,
    trend: "0%",
    lateToday: 0,
    onLeaveToday: 0,
    absentToday: 0,
  };
  const examStatusItems = data?.examStatus || [];
  const placements = data?.placements || {
    placedPct: 0,
    placedCount: 0,
    eligibleCount: 0,
    unplacedCount: 0,
    trainingOngoing: 0,
    offersReceived: 0,
    upcomingDrives: 0,
  };

  return (
    <div className="space-y-4 pb-12 font-sans text-slate-800">
      {/* ─────────────────────────────────────────────────────────────
          TOP BAR: Title (Left) | Branch Filter, Refresh, Date, Profile (Right)
      ────────────────────────────────────────────────────────────── */}
      <div className="hidden sm:flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-3.5 bg-white p-3 sm:p-4 rounded-2xl border border-blue-100 shadow-xs">
        {/* Left: Clean Heading & Subtitle */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 shadow-2xs">
            <LayoutDashboard className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-black text-blue-700 tracking-tight leading-tight truncate">
              HOD Dashboard
            </h1>
            <p className="text-[11px] sm:text-xs font-medium text-slate-500 truncate">
              Department Academic & Operational Intelligence
            </p>
          </div>
        </div>

        {/* Right: Branch Filter Dropdown, Refresh, Date, Profile */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full lg:w-auto justify-between sm:justify-start">
          {/* Branch Filter Dropdown */}
          <div className="relative flex-1 sm:flex-initial min-w-[170px] sm:min-w-0">
            <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 z-10" />
            <select
              value={selectedBranchId != null ? String(selectedBranchId) : selectedDeptName}
              onChange={(e) => {
                const val = e.target.value;
                const asNum = Number(val);
                setLoading(true);
                if (!isNaN(asNum) && asNum > 0) {
                  setSelectedBranchId(asNum);
                  const matched = departments.find((d) => d.id === asNum);
                  if (matched) setSelectedDeptName(matched.name);
                } else {
                  setSelectedDeptName(val);
                }
              }}
              className="w-full sm:w-auto appearance-none bg-slate-50 hover:bg-slate-100/80 border border-slate-200/90 text-slate-800 text-xs sm:text-sm font-semibold rounded-xl pl-8 sm:pl-9 pr-7 sm:pr-8 py-1.5 sm:py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition cursor-pointer max-w-full sm:max-w-xs truncate shadow-2xs"
            >
              {departments.length > 0 ? (
                departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.label}
                  </option>
                ))
              ) : (
                <option value={selectedDeptName}>{displayDept}</option>
              )}
            </select>
            <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => loadData(true)}
            disabled={refreshing || isStatsLoading}
            title="Refresh live data"
            className="p-1.5 sm:p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition cursor-pointer shadow-2xs shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${refreshing || isStatsLoading ? "animate-spin text-blue-600" : ""}`} />
          </button>

          {/* Calendar Date Indicator */}
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-50 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border border-slate-200/80 shadow-2xs shrink-0">
            <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
            <span className="whitespace-nowrap text-[11px] sm:text-xs md:text-sm">{displayDate}</span>
          </div>

          {/* User Profile */}
          <div className="flex items-center gap-2 pl-1.5 sm:pl-2 border-l border-slate-200 shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-linear-to-tr from-blue-700 to-indigo-600 text-white flex items-center justify-center font-bold text-xs ring-2 ring-blue-100 shadow-2xs shrink-0">
              {initials}
            </div>
            <div className="leading-tight hidden md:block">
              <p className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-[140px]">{displayName}</p>
              <p className="text-[11px] font-medium text-slate-500">{displayRole}</p>
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* ─────────────────────────────────────────────────────────────
          ROW 1: Student Attendance (Left) + Today's Priorities (Right)
      ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Student Attendance (Span 8) */}
        <div className="lg:col-span-8 bg-transparent sm:bg-white rounded-none sm:rounded-2xl border-0 sm:border border-slate-200/90 p-0 sm:p-5 shadow-none sm:shadow-xs flex flex-col justify-between gap-3 sm:gap-4">
          {/* Top Header - Visible directly on the page */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-0 sm:pb-3 sm:border-b sm:border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-linear-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white shadow-xs shrink-0">
                <Users className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                  Student Attendance Overview
                </h2>
                <p className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5">
                  <span>{displayDept} • Today&apos;s Attendance ({displayDate})</span>
                  {isStatsLoading && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 font-bold animate-pulse">
                      <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Updating...
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              {isStatsLoading ? (
                <Skeleton className="h-6 w-28 rounded-full" variant="pill" />
              ) : isAttendancePending ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  <Clock className="w-3 h-3 text-slate-500" />
                  Attendance Pending Today
                </span>
              ) : attendance.percentage >= 75 ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Above 75% Target
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                  Below 75% Target
                </span>
              )}
            </div>
          </div>

          {/* Middle 4-Column Primary Metrics - Premium, Clean Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {/* 1. Overall Attendance */}
            <div className="relative overflow-hidden bg-white hover:bg-blue-50/20 border border-slate-200/90 hover:border-blue-300 rounded-2xl p-2.5 sm:p-3 transition-all shadow-xs flex flex-col justify-between group">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Today&apos;s Attendance
                </span>
                <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <CalendarCheck className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="my-0.5">
                {isStatsLoading ? (
                  <Skeleton className="h-6 sm:h-7 w-16 my-0.5 rounded" />
                ) : isAttendancePending ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl sm:text-2xl font-black text-slate-400 tracking-tight">—</span>
                    <span className="text-[10px] font-semibold text-slate-400">pending</span>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      {attendance.percentage}
                    </span>
                    <span className="text-xs font-bold text-blue-600">%</span>
                  </div>
                )}
              </div>
              <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                {isStatsLoading ? (
                  <Skeleton className="h-3.5 w-18 rounded" variant="subtle" />
                ) : isAttendancePending ? (
                  <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/70 text-[9px] sm:text-[10px]">
                    <Clock className="w-2.5 h-2.5 text-amber-500" />
                    Not posted yet
                  </span>
                ) : attendance.trend.includes("-") ? (
                  <span className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200/70 text-[9px] sm:text-[10px]">
                    <TrendingDown className="w-2.5 h-2.5" />
                    {attendance.trend}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/70 text-[9px] sm:text-[10px]">
                    <TrendingUp className="w-2.5 h-2.5" />
                    {attendance.trend}
                  </span>
                )}
                <span className="text-slate-400 font-medium text-[9px] sm:text-[10px]">Daily avg</span>
              </div>
            </div>

            {/* 2. Present Students */}
            <div className="relative overflow-hidden bg-white hover:bg-emerald-50/20 border border-slate-200/90 hover:border-emerald-300 rounded-2xl p-2.5 sm:p-3 transition-all shadow-xs flex flex-col justify-between group">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Attending
                </span>
                <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <UserCheck className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="my-0.5">
                {isStatsLoading ? (
                  <Skeleton className="h-6 sm:h-7 w-12 my-0.5 rounded" />
                ) : isAttendancePending ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl sm:text-2xl font-black text-slate-400 tracking-tight">—</span>
                    <span className="text-[10px] font-semibold text-slate-400">awaiting</span>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl sm:text-2xl font-black text-emerald-700 tracking-tight">
                      {attendance.present.toLocaleString()}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500">present</span>
                  </div>
                )}
              </div>
              <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                {isStatsLoading ? (
                  <Skeleton className="h-3 w-14 rounded" variant="subtle" />
                ) : isAttendancePending ? (
                  <span className="text-slate-400 font-medium text-[9px] sm:text-[10px]">Awaiting period entry</span>
                ) : (
                  <span className="text-emerald-700 font-bold text-[9px] sm:text-[10px]">
                    {attendance.total > 0 ? Math.round((attendance.present / attendance.total) * 100) : 0}% of roster
                  </span>
                )}
                <span className="text-slate-400 font-medium text-[9px] sm:text-[10px]">In class</span>
              </div>
            </div>

            {/* 3. Absent Students */}
            <div className="relative overflow-hidden bg-white hover:bg-rose-50/20 border border-slate-200/90 hover:border-rose-300 rounded-2xl p-2.5 sm:p-3 transition-all shadow-xs flex flex-col justify-between group">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Absent / Leave
                </span>
                <div className="w-6 h-6 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <UserX className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="my-0.5">
                {isStatsLoading ? (
                  <Skeleton className="h-6 sm:h-7 w-12 my-0.5 rounded" />
                ) : isAttendancePending ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl sm:text-2xl font-black text-slate-400 tracking-tight">—</span>
                    <span className="text-[10px] font-semibold text-slate-400">awaiting</span>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl sm:text-2xl font-black text-rose-700 tracking-tight">
                      {Math.max(0, attendance.total - attendance.present).toLocaleString()}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500">absent</span>
                  </div>
                )}
              </div>
              <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                {isStatsLoading ? (
                  <Skeleton className="h-3 w-14 rounded" variant="subtle" />
                ) : isAttendancePending ? (
                  <span className="text-slate-400 font-medium text-[9px] sm:text-[10px]">Awaiting period entry</span>
                ) : (
                  <span className="text-rose-600 font-bold text-[9px] sm:text-[10px]">
                    {attendance.total > 0 ? Math.round((Math.max(0, attendance.total - attendance.present) / attendance.total) * 100) : 0}% shortfall
                  </span>
                )}
                <span className="text-slate-400 font-medium text-[9px] sm:text-[10px]">Today</span>
              </div>
            </div>

            {/* 4. Enrolled Total */}
            <div className="relative overflow-hidden bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 rounded-2xl p-2.5 sm:p-3 transition-all shadow-xs flex flex-col justify-between group">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Total Enrolled
                </span>
                <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                  <GraduationCap className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="my-0.5">
                {isStatsLoading ? (
                  <Skeleton className="h-6 sm:h-7 w-12 my-0.5 rounded" />
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      {attendance.total.toLocaleString()}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500">students</span>
                  </div>
                )}
              </div>
              <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                {isStatsLoading ? (
                  <Skeleton className="h-3 w-16 rounded" variant="subtle" />
                ) : (
                  <span className="text-slate-700 font-bold text-[9px] sm:text-[10px]">
                    {attendance.sections.length} active sections
                  </span>
                )}
                <span className="text-slate-400 font-medium text-[9px] sm:text-[10px]">Dept</span>
              </div>
            </div>
          </div>

          {/* Visual Benchmark Gauge Line - Modern, Sleek */}
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-2.5 sm:p-3 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Target className="w-3 h-3" />
                </div>
                <span className="text-xs font-bold text-slate-800">
                  Department Attendance Benchmark
                </span>
              </div>
              {isStatsLoading ? (
                <Skeleton className="h-4 w-24 rounded-full" variant="pill" />
              ) : isAttendancePending ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Pending Submission • 75% Target
                </span>
              ) : (
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  attendance.percentage >= 75
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-amber-50 text-amber-800 border-amber-200"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${attendance.percentage >= 75 ? "bg-emerald-500" : "bg-amber-500"}`} />
                  {attendance.percentage}% Recorded • 75% Target
                </span>
              )}
            </div>
            <div className="relative w-full h-2 bg-slate-200/80 rounded-full overflow-hidden">
              {isStatsLoading ? (
                <div className="h-full rounded-full bg-slate-300 portal-shimmer w-3/4" />
              ) : (
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    isAttendancePending
                      ? "bg-slate-300"
                      : attendance.percentage >= 75
                        ? "bg-linear-to-r from-blue-600 via-indigo-600 to-emerald-500"
                        : attendance.percentage >= 65
                          ? "bg-linear-to-r from-blue-500 to-indigo-500"
                          : "bg-linear-to-r from-rose-500 to-amber-500"
                  }`}
                  style={{ width: isAttendancePending ? "0%" : `${Math.min(100, Math.max(5, attendance.percentage))}%` }}
                />
              )}
              {/* 75% Target Tick Pin */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-slate-400/80 z-10"
                style={{ left: "75%" }}
                title="Department Target: 75%"
              />
            </div>
          </div>

          {/* Bottom Section-wise Breakdown with P1-P7 Indicators */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span>Section-wise Period Attendance Roster</span>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                  7 Periods
                </span>
              </p>
              {isStatsLoading ? (
                <Skeleton className="h-3 w-36 rounded" variant="subtle" />
              ) : isAttendancePending || (attendance.postedPeriodsToday || 0) === 0 ? (
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400 inline" />
                  Attendance not yet posted for today (0 of 7 periods conducted)
                </span>
              ) : (
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-600">
                  {attendance.sections.filter((s) => (s.postedPeriods || 0) >= (s.totalPeriods || 7) && (s.totalPeriods || 7) > 0).length} of {attendance.sections.length} sections completed
                  {attendance.postedPeriodsToday !== undefined && attendance.scheduledPeriodsToday ? (
                    <span className="ml-1 text-slate-400 font-normal">({attendance.postedPeriodsToday}/{attendance.scheduledPeriodsToday} periods posted)</span>
                  ) : null}
                </span>
              )}
            </div>

            {isStatsLoading ? (
              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[300px] overflow-y-auto pr-1">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="bg-white border border-slate-200/90 rounded-xl p-2.5 flex flex-col justify-between h-[78px]"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Skeleton className="h-3.5 w-12 rounded" />
                      <Skeleton className="h-3.5 w-12 rounded-md" variant="subtle" />
                    </div>
                    <div className="grid grid-cols-7 gap-1 my-1">
                      {Array.from({ length: 7 }).map((_, pIdx) => (
                        <div key={pIdx} className="h-4.5 rounded bg-slate-100 portal-shimmer" />
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <Skeleton className="h-2 w-14 rounded" variant="subtle" />
                      <Skeleton className="h-2 w-10 rounded" variant="subtle" />
                    </div>
                  </div>
                ))}
              </div>
            ) : attendance.sections.length > 0 ? (
              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[310px] overflow-y-auto pr-1.5">
                {attendance.sections.map((sec, idx) => {
                  const posted = sec.postedPeriods || 0;
                  const total = sec.totalPeriods || 7;
                  const isComplete = posted >= total && total > 0;
                  const isInProgress = posted > 0 && !isComplete;

                  return (
                    <div
                      key={idx}
                      className="bg-white hover:bg-blue-50/15 border border-slate-200/90 hover:border-blue-400 hover:shadow-xs rounded-xl p-2.5 transition-all flex flex-col justify-between group"
                    >
                      {/* Top: Section Name + Period Count Badge */}
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black text-slate-800 tracking-tight truncate">
                          {sec.section}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md leading-none ${
                            posted === 0
                              ? "bg-slate-100 text-slate-500 border border-slate-200"
                              : isComplete
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}
                        >
                          {posted}/{total} Periods
                        </span>
                      </div>

                      {/* Visual Segmented 7-Period Indicators with P1-P7 Labels */}
                      <div className="my-1">
                        <div className="grid grid-cols-7 gap-1">
                          {Array.from({ length: total }).map((_, pIdx) => {
                            const isPPosted = sec.periods && sec.periods[pIdx]
                              ? sec.periods[pIdx].isPosted
                              : pIdx < posted;

                            return (
                              <div
                                key={pIdx}
                                title={`Period ${pIdx + 1}: ${isPPosted ? "Attendance Posted" : "Awaiting Posting"}`}
                                className={`h-4.5 rounded text-[8.5px] font-bold flex items-center justify-center transition-all ${
                                  isPPosted
                                    ? "bg-emerald-500 text-white shadow-2xs font-black"
                                    : "bg-slate-100 text-slate-400 border border-slate-200/60 font-semibold"
                                }`}
                              >
                                P{pIdx + 1}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Bottom Footer: Progress & Status */}
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium mt-1 pt-1 border-t border-slate-100/80">
                        <span className="font-semibold text-slate-600 text-[9px] sm:text-[10px]">
                          {posted > 0 ? `${sec.periodProgress || Math.round((posted / total) * 100)}% conducted` : "0% conducted"}
                        </span>
                        <span className={`text-[9px] sm:text-[10px] font-bold ${
                          isComplete
                            ? "text-emerald-600"
                            : isInProgress
                              ? "text-blue-600"
                              : "text-slate-400"
                        }`}>
                          {isComplete ? "Complete" : isInProgress ? `${posted} of ${total} Posted` : "Pending"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-6">No active section data recorded for this department.</p>
            )}
          </div>
        </div>

        {/* Today's Priorities (Span 4) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-rose-100/90 p-4 sm:p-5 shadow-xs flex flex-col h-full min-h-[380px]">
          {/* Header */}
          <div className="flex items-center justify-between mb-3 shrink-0">
            <div className="flex items-center gap-1.5 text-rose-600">
              <Star className="w-5 h-5 fill-rose-500 text-rose-500" />
              <h2 className="text-base font-black text-rose-600 tracking-tight">
                Today&apos;s Priorities
              </h2>
            </div>
            {isStatsLoading ? (
              <Skeleton className="h-5 w-6 rounded-full" variant="pill" />
            ) : (
              <span className="bg-rose-500 text-white font-extrabold text-xs px-2 py-0.5 rounded-full shadow-2xs">
                {priorityItems.length}
              </span>
            )}
          </div>

          {/* List of Priorities - uses full card height */}
          <div className="space-y-2 overflow-y-auto flex-1 min-h-0 pr-1 max-h-[550px] lg:max-h-none">
            {isStatsLoading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <div key={idx} className="w-full flex items-center justify-between p-2.5 rounded-xl border border-transparent">
                  <div className="flex items-center gap-2.5 min-w-0 pr-1 flex-1">
                    <Skeleton className="w-5 h-5 rounded-full shrink-0" variant="circular" />
                    <Skeleton className="h-3.5 rounded flex-1" style={{ maxWidth: `${120 + (idx % 3) * 40}px` }} />
                  </div>
                  <Skeleton className="w-4 h-4 rounded shrink-0" variant="subtle" />
                </div>
              ))
            ) : priorityItems.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500">
                <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-1.5" />
                <p className="font-bold text-slate-800">All Clear Today</p>
                <p className="text-[11px] text-slate-400 mt-0.5">No disruptions, missing timetables, or pending leaves.</p>
              </div>
            ) : (
              priorityItems.map((item) => {
                const badgeColor =
                  item.severity === "critical"
                    ? "bg-rose-100 text-rose-800 border-rose-200"
                    : item.severity === "high"
                    ? "bg-amber-100 text-amber-900 border-amber-200"
                    : item.severity === "medium"
                    ? "bg-blue-50 text-blue-800 border-blue-200"
                    : "bg-emerald-50 text-emerald-800 border-emerald-200";

                const circleColor =
                  item.severity === "critical"
                    ? "bg-rose-600"
                    : item.severity === "high"
                    ? "bg-amber-500"
                    : item.severity === "medium"
                    ? "bg-blue-600"
                    : "bg-emerald-600";

                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedPriority(item)}
                    className="w-full text-left flex items-start justify-between p-2.5 rounded-xl hover:bg-rose-50/60 border border-slate-100 hover:border-rose-200 transition group cursor-pointer gap-2"
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <span className={`w-5 h-5 rounded-full ${circleColor} text-white text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5 shadow-2xs`}>
                        {item.id}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          {item.badge && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${badgeColor} leading-none`}>
                              {item.badge}
                            </span>
                          )}
                          {item.isWarning && (
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 inline" />
                          )}
                        </div>
                        <p className="text-xs font-semibold text-slate-800 group-hover:text-rose-950 line-clamp-2 leading-snug">
                          {item.title}
                        </p>
                        {item.detail && (
                          <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 font-normal">
                            {item.detail}
                          </p>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-rose-600 shrink-0 group-hover:translate-x-0.5 transition-transform mt-1" />
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          ROW 2: Students at Risk (Section Breakdown)
      ────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs">
        {/* Header */}
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-1.5">
            <h2 className="text-base font-black text-blue-950 tracking-tight">
              Students at Risk ({displayDept})
            </h2>
            <Info className="w-4 h-4 text-blue-500 cursor-pointer" />
          </div>
          <button
            onClick={() => setActiveModal("students-risk")}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline transition cursor-pointer"
          >
            View Details
          </button>
        </div>

        {/* Section Cards Grid */}
        {isStatsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-slate-200/80 overflow-hidden bg-slate-50/30"
              >
                <div className="px-3 py-1.5 border-b bg-slate-100/70 border-slate-200 flex justify-center">
                  <Skeleton className="h-3.5 w-16 rounded" />
                </div>
                <div className="grid grid-cols-3 divide-x divide-slate-100 p-2.5 text-center bg-white">
                  <div className="flex flex-col items-center">
                    <Skeleton className="h-6 w-8 rounded" />
                    <Skeleton className="h-2 w-12 rounded mt-1.5" variant="subtle" />
                    <Skeleton className="h-2 w-10 rounded mt-0.5" variant="subtle" />
                  </div>
                  <div className="flex flex-col items-center">
                    <Skeleton className="h-6 w-8 rounded" />
                    <Skeleton className="h-2 w-12 rounded mt-1.5" variant="subtle" />
                    <Skeleton className="h-2 w-10 rounded mt-0.5" variant="subtle" />
                  </div>
                  <div className="flex flex-col items-center">
                    <Skeleton className="h-6 w-8 rounded" />
                    <Skeleton className="h-2 w-12 rounded mt-1.5" variant="subtle" />
                    <Skeleton className="h-2 w-10 rounded mt-0.5" variant="subtle" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : sectionsAtRisk.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {sectionsAtRisk.map((sec) => (
              <div
                key={sec.section}
                className="rounded-xl border border-slate-200/80 overflow-hidden bg-slate-50/30 hover:shadow-xs transition"
              >
                {/* Card Header Strip */}
                <div
                  className={`px-3 py-1.5 font-bold text-xs text-center border-b ${sec.headerBg}`}
                >
                  {sec.section}
                </div>

                {/* 3 Metric Columns */}
                <div className="grid grid-cols-3 divide-x divide-slate-100 p-2.5 text-center bg-white">
                  <div>
                    <p className="text-lg font-black text-rose-600">{sec.lowAttendance}</p>
                    <p className="text-[10px] font-medium text-slate-500 leading-tight mt-0.5">
                      Attendance
                      <br />
                      &lt; 65%
                    </p>
                  </div>
                  <div>
                    <p className="text-lg font-black text-amber-600">{sec.internal1Failed}</p>
                    <p className="text-[10px] font-medium text-slate-500 leading-tight mt-0.5">
                      Internal 1<br />
                      Failed
                    </p>
                  </div>
                  <div>
                    <p className="text-lg font-black text-orange-600">{sec.internal2Failed}</p>
                    <p className="text-[10px] font-medium text-slate-500 leading-tight mt-0.5">
                      Internal 2<br />
                      Failed
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 py-4 text-center">No sections currently identified at risk</p>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          ROW 3: Subjects Behind Schedule (Left) + Fee Due Age Wise (Right)
      ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Subjects Behind Schedule (Span 7) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                  <BookOpen className="w-4 h-4" />
                </div>
                <h2 className="text-base font-black text-blue-950 tracking-tight">
                  Subjects Behind Schedule
                </h2>
              </div>
              <button
                onClick={() => setActiveModal("subjects-behind")}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline transition cursor-pointer"
              >
                View All
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto -mx-1 sm:mx-0">
              <table className="w-full min-w-[520px] text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold">
                    <th className="pb-2 text-slate-600">Subject</th>
                    <th className="pb-2 text-center text-slate-600">Planned</th>
                    <th className="pb-2 text-center text-slate-600">Completed</th>
                    <th className="pb-2 text-center text-slate-600">Delay</th>
                    <th className="pb-2 text-center text-slate-600">Current Coverage</th>
                    <th className="pb-2 text-center text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isStatsLoading ? (
                    Array.from({ length: 4 }).map((_, idx) => (
                      <tr key={idx}>
                        <td className="py-2.5 pr-2">
                          <Skeleton className="h-3.5 w-36 rounded mb-1" />
                          <Skeleton className="h-2.5 w-24 rounded" variant="subtle" />
                        </td>
                        <td className="py-2.5 text-center"><Skeleton className="h-3.5 w-6 rounded mx-auto" /></td>
                        <td className="py-2.5 text-center"><Skeleton className="h-3.5 w-6 rounded mx-auto" /></td>
                        <td className="py-2.5 text-center"><Skeleton className="h-3.5 w-10 rounded mx-auto" /></td>
                        <td className="py-2.5 text-center"><Skeleton className="h-3.5 w-8 rounded mx-auto" /></td>
                        <td className="py-2.5 text-center">
                          <Skeleton className="h-5 w-14 rounded-full mx-auto" variant="pill" />
                        </td>
                      </tr>
                    ))
                  ) : subjectsBehind.length > 0 ? (
                    subjectsBehind.map((sub, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition">
                        <td className="py-2.5 pr-2">
                          <p className="font-bold text-slate-900 leading-tight">{sub.subject}</p>
                          <p className="text-[11px] font-medium text-slate-500">{sub.faculty}</p>
                        </td>
                        <td className="py-2.5 text-center font-semibold text-slate-700">
                          {sub.planned}
                        </td>
                        <td className="py-2.5 text-center font-semibold text-slate-700">
                          {sub.completed}
                        </td>
                        <td className="py-2.5 text-center font-bold text-rose-600">{sub.delay}</td>
                        <td className="py-2.5 text-center font-semibold text-slate-800">
                          {sub.coverage}
                        </td>
                        <td className="py-2.5 text-center">
                          <span
                            className={`inline-block border font-bold text-[10px] px-2.5 py-0.5 rounded-full ${
                              sub.status === "Behind"
                                ? "bg-rose-50 text-rose-600 border-rose-200"
                                : "bg-emerald-50 text-emerald-600 border-emerald-200"
                            }`}
                          >
                            {sub.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        All subjects in this department are currently on schedule.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Fee Due Age Wise (Span 5) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                  <IndianRupee className="w-4 h-4" />
                </div>
                <h2 className="text-base font-black text-blue-950 tracking-tight">
                  Fee Due Age Wise
                </h2>
              </div>
              <button
                onClick={() => setActiveModal("fee-due")}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline transition cursor-pointer"
              >
                View Details
              </button>
            </div>

            {/* Total Pending Fee Banner */}
            <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-3 flex items-center gap-3.5 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold shrink-0 shadow-2xs">
                <IndianRupee className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-600">Total Pending Fees</p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  {isStatsLoading ? (
                    <>
                      <Skeleton className="h-6 w-24 rounded inline-block" />
                      <Skeleton className="h-3 w-16 rounded inline-block ml-2" variant="subtle" />
                    </>
                  ) : (
                    <>
                      <span className="text-xl sm:text-2xl font-black text-slate-800">
                        {feeDue.totalAmount != null ? feeDue.totalAmount : "null"}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        {feeDue.totalStudents != null ? `(${feeDue.totalStudents} Students)` : "(null)"}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 3 Age Wise Buckets */}
            <div className="grid grid-cols-3 gap-2">
              {/* > 15 Days */}
              <div className="bg-amber-50/60 border border-amber-200/70 rounded-xl p-2.5 text-center">
                <p className="text-[11px] font-bold text-slate-700 flex items-center justify-center gap-1">
                  <Users className="w-3 h-3 text-amber-600" />
                  <span>&gt; 15 Days</span>
                </p>
                {isStatsLoading ? (
                  <>
                    <Skeleton className="h-4 w-8 rounded mx-auto mt-1" />
                    <Skeleton className="h-2 w-10 rounded mx-auto mt-0.5" variant="subtle" />
                    <Skeleton className="h-3.5 w-14 rounded mx-auto mt-1" />
                  </>
                ) : (
                  <>
                    <p className="text-sm font-black text-amber-700 mt-1">
                      {feeDue.buckets.fifteenDays.students != null ? feeDue.buckets.fifteenDays.students : "null"}
                    </p>
                    <p className="text-[10px] font-medium text-slate-600">Students</p>
                    <p className="text-xs font-black text-amber-800 mt-1">
                      {feeDue.buckets.fifteenDays.amount != null ? feeDue.buckets.fifteenDays.amount : "null"}
                    </p>
                  </>
                )}
              </div>

              {/* > 30 Days */}
              <div className="bg-orange-50/60 border border-orange-200/70 rounded-xl p-2.5 text-center">
                <p className="text-[11px] font-bold text-slate-700 flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3 text-orange-600" />
                  <span>&gt; 30 Days</span>
                </p>
                {isStatsLoading ? (
                  <>
                    <Skeleton className="h-4 w-8 rounded mx-auto mt-1" />
                    <Skeleton className="h-2 w-10 rounded mx-auto mt-0.5" variant="subtle" />
                    <Skeleton className="h-3.5 w-14 rounded mx-auto mt-1" />
                  </>
                ) : (
                  <>
                    <p className="text-sm font-black text-orange-700 mt-1">
                      {feeDue.buckets.thirtyDays.students != null ? feeDue.buckets.thirtyDays.students : "null"}
                    </p>
                    <p className="text-[10px] font-medium text-slate-600">Students</p>
                    <p className="text-xs font-black text-orange-800 mt-1">
                      {feeDue.buckets.thirtyDays.amount != null ? feeDue.buckets.thirtyDays.amount : "null"}
                    </p>
                  </>
                )}
              </div>

              {/* > 60 Days */}
              <div className="bg-rose-50/60 border border-rose-200/70 rounded-xl p-2.5 text-center">
                <p className="text-[11px] font-bold text-slate-700 flex items-center justify-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                  <span>&gt; 60 Days</span>
                </p>
                {isStatsLoading ? (
                  <>
                    <Skeleton className="h-4 w-8 rounded mx-auto mt-1" />
                    <Skeleton className="h-2 w-10 rounded mx-auto mt-0.5" variant="subtle" />
                    <Skeleton className="h-3.5 w-14 rounded mx-auto mt-1" />
                  </>
                ) : (
                  <>
                    <p className="text-sm font-black text-rose-700 mt-1">
                      {feeDue.buckets.sixtyDays.students != null ? feeDue.buckets.sixtyDays.students : "null"}
                    </p>
                    <p className="text-[10px] font-medium text-slate-600">Students</p>
                    <p className="text-xs font-black text-rose-800 mt-1">
                      {feeDue.buckets.sixtyDays.amount != null ? feeDue.buckets.sixtyDays.amount : "null"}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          ROW 4: 3 Cards (Faculty Attendance | Examination Status | Placements)
      ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* CARD 1: Faculty Attendance & Leave Status */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm sm:text-base font-black text-blue-950 tracking-tight">
                Faculty Attendance &amp; Leave Status
              </h2>
              <button
                onClick={() => setActiveModal("faculty-status")}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline transition cursor-pointer"
              >
                View Details
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Main Attendance Percentage */}
              <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3 text-center shrink-0 w-full sm:w-32 flex flex-row sm:flex-col items-center justify-around sm:justify-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0 sm:mx-auto sm:mb-1">
                  <Users className="w-4 h-4" />
                </div>
                {isStatsLoading ? (
                  <div className="flex sm:flex-col items-center gap-2 sm:gap-0">
                    <Skeleton className="h-6 w-14 rounded my-0.5" />
                    <Skeleton className="h-2.5 w-20 rounded mt-0.5" variant="subtle" />
                    <Skeleton className="h-2 w-16 rounded mt-0.5 hidden sm:block" variant="subtle" />
                    <Skeleton className="h-2 w-12 rounded mt-0.5 hidden sm:block" variant="subtle" />
                  </div>
                ) : (
                  <>
                    <div className="text-left sm:text-center">
                      <p className="text-2xl font-black text-emerald-700 leading-none sm:leading-normal">
                        {facultyStatus.attendancePct}%
                      </p>
                      <p className="text-[11px] font-bold text-slate-700 leading-tight mt-0.5">
                        Faculty Attendance
                      </p>
                    </div>
                    <div className="text-right sm:text-center">
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Present: {facultyStatus.present} / {facultyStatus.total}
                      </p>
                      <p className="text-[10px] font-bold text-emerald-600 mt-0.5">
                        ↗ {facultyStatus.trend}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* 3 Mini Status Cards */}
              <div className="flex-1 space-y-1.5">
                {/* Late Arrivals */}
                <div className="bg-amber-50/70 border border-amber-200/70 rounded-xl px-2.5 py-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-amber-500 text-white flex items-center justify-center">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      {isStatsLoading ? (
                        <Skeleton className="h-4 w-5 rounded mr-1.5 inline-block" />
                      ) : (
                        <span className="text-sm font-black text-amber-700 mr-1.5">
                          {facultyStatus.lateToday}
                        </span>
                      )}
                      <span className="text-[11px] font-bold text-slate-700">
                        Late Arrivals Today
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-amber-600" />
                </div>

                {/* On Leave */}
                <div className="bg-sky-50/70 border border-sky-200/70 rounded-xl px-2.5 py-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-sky-500 text-white flex items-center justify-center">
                      <Plane className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      {isStatsLoading ? (
                        <Skeleton className="h-4 w-5 rounded mr-1.5 inline-block" />
                      ) : (
                        <span className="text-sm font-black text-sky-700 mr-1.5">
                          {facultyStatus.onLeaveToday}
                        </span>
                      )}
                      <span className="text-[11px] font-bold text-slate-700">
                        On Leave Today
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-sky-600" />
                </div>

                {/* Absent */}
                <div className="bg-rose-50/70 border border-rose-200/70 rounded-xl px-2.5 py-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-rose-500 text-white flex items-center justify-center">
                      <UserX className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      {isStatsLoading ? (
                        <Skeleton className="h-4 w-5 rounded mr-1.5 inline-block" />
                      ) : (
                        <span className="text-sm font-black text-rose-700 mr-1.5">
                          {facultyStatus.absentToday}
                        </span>
                      )}
                      <span className="text-[11px] font-bold text-slate-700">Absent Today</span>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-rose-600" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 2: Examination Status */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm sm:text-base font-black text-blue-950 tracking-tight">
                Examination Status
              </h2>
              <button
                onClick={() => setActiveModal("exam-status")}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline transition cursor-pointer"
              >
                View All
              </button>
            </div>

            <div className="space-y-2">
              {examStatusItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs py-1 px-1.5 rounded-lg hover:bg-slate-50 transition"
                >
                  <div className="flex items-center gap-2 text-slate-800 font-semibold truncate pr-2">
                    <ClipboardList className="w-4 h-4 shrink-0 text-blue-600" />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {isStatsLoading ? (
                    <Skeleton className="h-5 w-7 rounded-md" variant="subtle" />
                  ) : (
                    <span
                      className={`font-black text-xs px-2 py-0.5 rounded-md ${
                        item.count > 0
                          ? "bg-blue-50 text-blue-700 font-bold"
                          : "text-slate-400 font-semibold"
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CARD 3: Placements & Training */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm sm:text-base font-black text-blue-950 tracking-tight">
                Placements &amp; Training
              </h2>
              <button
                onClick={() => setActiveModal("placements")}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline transition cursor-pointer"
              >
                View Details
              </button>
            </div>

            {/* Top Donut & Legend */}
            <div className="flex items-center justify-around gap-2 mb-3">
              {/* Circular Gauge Ring */}
              <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-slate-100"
                    strokeWidth="3.8"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={`transition-all duration-700 ${isStatsLoading ? "text-slate-300 portal-shimmer" : "text-emerald-500"}`}
                    strokeDasharray={isStatsLoading ? "40, 100" : `${placements.placedPct}, 100`}
                    strokeWidth="3.8"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute text-center">
                  {isStatsLoading ? (
                    <>
                      <Skeleton className="h-3.5 w-8 rounded mx-auto" />
                      <Skeleton className="h-2 w-10 rounded mx-auto mt-0.5" variant="subtle" />
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-black text-emerald-600 block">
                        {placements.placedPct}%
                      </span>
                      <span className="text-[9px] font-bold text-slate-500 block leading-tight">
                        ({placements.placedCount}/{placements.eligibleCount})
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Legend */}
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between gap-4 font-semibold">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <span className="text-slate-600">Placed</span>
                  </div>
                  {isStatsLoading ? (
                    <Skeleton className="h-3 w-6 rounded" />
                  ) : (
                    <span className="font-bold text-slate-900">{placements.placedCount}</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-4 font-semibold">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                    <span className="text-slate-600">Eligible</span>
                  </div>
                  {isStatsLoading ? (
                    <Skeleton className="h-3 w-6 rounded" />
                  ) : (
                    <span className="font-bold text-slate-900">{placements.eligibleCount}</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-4 font-semibold">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                    <span className="text-slate-600">Unplaced</span>
                  </div>
                  {isStatsLoading ? (
                    <Skeleton className="h-3 w-6 rounded" />
                  ) : (
                    <span className="font-bold text-slate-900">{placements.unplacedCount}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom 3 KPI Tiles */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              <div className="bg-sky-50/70 border border-sky-100 rounded-xl p-1.5 sm:p-2 text-center">
                {isStatsLoading ? (
                  <Skeleton className="h-5 w-8 rounded mx-auto" />
                ) : (
                  <p className="text-sm sm:text-base font-black text-sky-700">
                    {placements.trainingOngoing}
                  </p>
                )}
                <p className="text-[9px] sm:text-[10px] font-bold text-slate-600 leading-tight mt-0.5">
                  Training Ongoing
                </p>
              </div>
              <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-1.5 sm:p-2 text-center">
                {isStatsLoading ? (
                  <Skeleton className="h-5 w-8 rounded mx-auto" />
                ) : (
                  <p className="text-sm sm:text-base font-black text-emerald-700">
                    {placements.offersReceived}
                  </p>
                )}
                <p className="text-[9px] sm:text-[10px] font-bold text-slate-600 leading-tight mt-0.5">
                  Offers Received
                </p>
              </div>
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-1.5 sm:p-2 text-center">
                {isStatsLoading ? (
                  <Skeleton className="h-5 w-8 rounded mx-auto" />
                ) : (
                  <p className="text-sm sm:text-base font-black text-indigo-700">
                    {placements.upcomingDrives}
                  </p>
                )}
                <p className="text-[9px] sm:text-[10px] font-bold text-slate-600 leading-tight mt-0.5">
                  Upcoming Drives
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          INTERACTIVE MODAL / DETAIL DRAWER FOR CLICKS
      ────────────────────────────────────────────────────────────── */}
      {selectedPriority && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-5 border border-slate-200 shadow-xl space-y-3.5 sm:space-y-4 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-900 text-base">Priority Action Item</h3>
                {selectedPriority.badge && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    selectedPriority.severity === "critical"
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : selectedPriority.severity === "high"
                      ? "bg-amber-50 text-amber-800 border-amber-200"
                      : selectedPriority.severity === "medium"
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  }`}>
                    {selectedPriority.badge}
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedPriority(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className={`p-3 rounded-xl border text-xs font-semibold flex items-start gap-2 ${
              selectedPriority.severity === "critical"
                ? "bg-rose-50 border-rose-100 text-rose-900"
                : selectedPriority.severity === "high"
                ? "bg-amber-50 border-amber-100 text-amber-950"
                : selectedPriority.severity === "medium"
                ? "bg-blue-50 border-blue-100 text-blue-950"
                : "bg-emerald-50 border-emerald-100 text-emerald-950"
            }`}>
              {selectedPriority.isWarning && (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span className="leading-snug">{selectedPriority.title}</span>
            </div>

            <div className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Context & Details</h4>
              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                {selectedPriority.detail || `This action item is queued from live department data for ${displayDept}. You can initiate staff substitutions, contact parent guardians, or follow up with assigned subject faculty.`}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedPriority(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Close
              </button>
              {selectedPriority.link ? (
                <a
                  href={selectedPriority.link}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Resolve in Module</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </a>
              ) : (
                <button
                  onClick={() => setSelectedPriority(null)}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs cursor-pointer"
                >
                  Mark Handled
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-5 border border-slate-200 shadow-xl space-y-3.5 sm:space-y-4 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-900 text-base capitalize">
                {activeModal.replace("-", " ")} Details
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {activeModal === "students-risk" && (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">
                  Section breakdown of students with attendance under 65% or failed internals in <strong>{displayDept}</strong>:
                </p>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {sectionsAtRisk.map((s, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">{s.section}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-rose-600 font-semibold">{s.lowAttendance} low att.</span>
                        <span className="text-amber-600 font-semibold">{s.internal1Failed + s.internal2Failed} exam fails</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeModal === "subjects-behind" && (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">
                  Subjects requiring teaching pacing review in <strong>{displayDept}</strong>:
                </p>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {subjectsBehind.map((sub, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-900">{sub.subject}</p>
                        <p className="text-[11px] text-slate-500">{sub.faculty}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-rose-600 font-bold">{sub.coverage} covered</span>
                        <p className="text-[10px] text-slate-400">{sub.completed}/{sub.planned} sessions</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeModal === "fee-due" && (
              <div className="space-y-3">
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800">
                  The student fee management portal is currently under active development. Fee dues are shown as <strong>null</strong> until the fee portal is fully connected.
                </div>
                <p className="text-xs text-slate-600">
                  Total pending fee breakdown for <strong>{displayDept}</strong>:
                </p>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="font-bold text-slate-700">&gt; 15 Days</p>
                    <p className="text-sm font-black text-amber-800 mt-1">{feeDue.buckets.fifteenDays.amount ?? "null"}</p>
                    <p className="text-[10px] text-slate-500">{feeDue.buckets.fifteenDays.students != null ? `${feeDue.buckets.fifteenDays.students} students` : "null"}</p>
                  </div>
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl">
                    <p className="font-bold text-slate-700">&gt; 30 Days</p>
                    <p className="text-sm font-black text-orange-800 mt-1">{feeDue.buckets.thirtyDays.amount ?? "null"}</p>
                    <p className="text-[10px] text-slate-500">{feeDue.buckets.thirtyDays.students != null ? `${feeDue.buckets.thirtyDays.students} students` : "null"}</p>
                  </div>
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                    <p className="font-bold text-slate-700">&gt; 60 Days</p>
                    <p className="text-sm font-black text-rose-800 mt-1">{feeDue.buckets.sixtyDays.amount ?? "null"}</p>
                    <p className="text-[10px] text-slate-500">{feeDue.buckets.sixtyDays.students != null ? `${feeDue.buckets.sixtyDays.students} students` : "null"}</p>
                  </div>
                </div>
              </div>
            )}

            {activeModal !== "students-risk" && activeModal !== "subjects-behind" && activeModal !== "fee-due" && (
              <p className="text-xs text-slate-600 leading-relaxed">
                Detailed live department roster metrics for <strong>{displayDept}</strong> are loaded and synchronized with the latest attendance posts and exam submissions.
              </p>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
