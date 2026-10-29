"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAcademicContext } from "@/components/layout/AcademicProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  Users,
  AlertTriangle,
  FileText,
  IndianRupee,
  Calendar,
  ChevronRight,
  PhoneCall,
  Bell,
  X,
  TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export type ClassTeacherDashboardData = {
  meta: {
    sectionName: string;
    academicYear: string;
    semester: string;
    teacherName: string;
    departmentName: string;
    dateFormatted: string;
    totalStudents: number;
  };
  kpis: {
    classAttendance: {
      percentage: number | null;
      present: number | null;
      absent: number | null;
      late: number | null;
    };
    studentsBelow65Count: number | null;
    internal1FailedCount: number | null;
    internal2FailedCount: number | null;
    failedBothCount: number | null;
    feePendingCount: number | null;
  };
  attendanceTrend: Array<{ month: string; value: number }>;
  todaysPriorities: Array<{ id: number; text: string; severity: string }>;
  todaysTimetable: Array<{
    time: string;
    subject: string;
    faculty: string;
    status: "Conducted" | "Ongoing" | "Upcoming";
  }>;
  below65Students: Array<{
    id: number;
    rollNo: string;
    name: string;
    attendance: string;
    phone: string | null;
  }>;
  internalPerformance: {
    internal1: { passed: number; failed: number };
    internal2: { passed: number; failed: number };
    failedBothCount: number;
  } | null;
  academicRiskStudents: Array<{
    id: number;
    rollNo: string;
    name: string;
    attendance: string;
    int1: "P" | "F" | "—";
    int2: "P" | "F" | "—";
    risk: "Critical" | "High" | "Medium";
  }>;
  feeStatus: {
    paid: number;
    partial: number;
    pending: number;
    total: number;
  } | null;
  continuousAbsentees: Array<{
    id: number;
    rollNo: string;
    name: string;
    days: number;
    lastAttended: string;
  }>;
  upcomingNotices: Array<{
    date: string;
    month: string;
    title: string;
    scope: string;
  }>;
};

interface ClassTeacherDashboardProps {
  sectionName?: string;
  academicYear?: string;
  date?: string;
}

export function ClassTeacherDashboard({
  sectionName: propSection,
  academicYear: propAY,
  date: propDate,
}: ClassTeacherDashboardProps) {
  const { filters } = useAcademicContext();
  const { user, authorization, loading: authLoading } = useAuth();

  // 1. Role-based check: firstly verify class_teacher role
  const ctRole = useMemo(() => {
    return authorization?.roles?.find(
      (r) =>
        r.roleKey === "class_teacher" ||
        r.roleKey === "mentor" ||
        r.label.toLowerCase().includes("class teacher")
    );
  }, [authorization]);

  const isClassTeacher = Boolean(ctRole);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ClassTeacherDashboardData | null>(null);

  // Parent Contact Modal state
  const [callModalStudent, setCallModalStudent] = useState<{
    rollNo: string;
    name: string;
    attendance: string;
    phone: string | null;
  } | null>(null);

  const activeAY = propAY || filters.academicYear;
  const activeDate = propDate || filters.date;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const qParams = new URLSearchParams();
      if (propSection) qParams.set("section", propSection);
      if (activeAY) qParams.set("academicYear", activeAY);
      if (activeDate) qParams.set("date", activeDate);
      if (ctRole?.branchId) qParams.set("branchId", String(ctRole.branchId));
      if (ctRole?.collegeId) qParams.set("collegeId", String(ctRole.collegeId));

      const res = await apiFetch(`/class-teacher/dashboard?${qParams.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setData(json.data);
          return;
        }
      }
    } catch {
      // In case of error, no hardcoded data is injected
    } finally {
      setLoading(false);
    }
  }, [propSection, activeAY, activeDate, ctRole?.branchId, ctRole?.collegeId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Construct activeData with live data or role-derived defaults so the dashboard is properly represented
  const activeData: ClassTeacherDashboardData = useMemo(() => {
    const teacherName =
      data?.meta?.teacherName && data.meta.teacherName !== "—"
        ? data.meta.teacherName
        : user?.name || "Class Teacher";

    const sectionName =
      data?.meta?.sectionName && data.meta.sectionName !== "—"
        ? data.meta.sectionName
        : propSection || "—";

    const academicYear =
      data?.meta?.academicYear && data.meta.academicYear !== "—"
        ? data.meta.academicYear
        : activeAY || "—";

    const semester =
      data?.meta?.semester && data.meta.semester !== "—"
        ? data.meta.semester
        : "—";

    const departmentName =
      data?.meta?.departmentName && data.meta.departmentName !== "—"
        ? data.meta.departmentName
        : (user as { department?: string })?.department || "—";

    const dateFormatted =
      data?.meta?.dateFormatted ||
      (activeDate ? new Date(activeDate + "T00:00:00") : new Date()).toLocaleDateString("en-US", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });

    return {
      meta: {
        sectionName,
        academicYear,
        semester,
        teacherName,
        departmentName,
        dateFormatted,
        totalStudents: data?.meta?.totalStudents ?? 0,
      },
      kpis: data?.kpis || {
        classAttendance: {
          percentage: null,
          present: null,
          absent: null,
          late: null,
        },
        studentsBelow65Count: null,
        internal1FailedCount: null,
        internal2FailedCount: null,
        failedBothCount: null,
        feePendingCount: null,
      },
      attendanceTrend: data?.attendanceTrend || [],
      todaysPriorities: data?.todaysPriorities || [],
      todaysTimetable: data?.todaysTimetable || [],
      below65Students: data?.below65Students || [],
      internalPerformance: data?.internalPerformance || null,
      academicRiskStudents: data?.academicRiskStudents || [],
      feeStatus: data?.feeStatus || null,
      continuousAbsentees: data?.continuousAbsentees || [],
      upcomingNotices: data?.upcomingNotices || [],
    };
  }, [data, user, propSection, activeAY]);

  // Fee Status Donut Chart Data
  const feeDonutData = useMemo(() => {
    if (!activeData?.feeStatus) return [];
    return [
      { name: "Paid", value: activeData.feeStatus.paid, color: "#10b981" },
      { name: "Partial", value: activeData.feeStatus.partial, color: "#94a3b8" },
      { name: "Pending", value: activeData.feeStatus.pending, color: "#ef4444" },
    ];
  }, [activeData]);

  // Internal Performance Bar Chart Data
  const internalBarData = useMemo(() => {
    if (!activeData?.internalPerformance) return [];
    return [
      {
        name: "Internal I",
        Passed: activeData.internalPerformance.internal1.passed,
        Failed: activeData.internalPerformance.internal1.failed,
      },
      {
        name: "Internal II",
        Passed: activeData.internalPerformance.internal2.passed,
        Failed: activeData.internalPerformance.internal2.failed,
      },
    ];
  }, [activeData]);

  // Teacher initials for header avatar
  const teacherInitials = useMemo(() => {
    const parts = activeData.meta.teacherName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0]?.slice(0, 2).toUpperCase() || "CT";
  }, [activeData.meta.teacherName]);

  if ((loading || authLoading) && !data) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3">
        <div className="h-8 w-8 rounded-full border-3 border-blue-600 border-t-transparent animate-spin" />
        <p className="text-xs font-semibold text-slate-500">Loading Class Teacher Dashboard...</p>
      </div>
    );
  }

  // If role check fails (user does not have class teacher role)
  if (!authLoading && !isClassTeacher && !authorization?.scope?.isGlobal) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
        <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
        <h2 className="text-sm font-bold text-slate-800">Class Teacher Role Required</h2>
        <p className="text-xs text-slate-500 mt-1">
          This dashboard requires an assigned Class Teacher role.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-12 font-sans bg-slate-50/50 min-h-screen">
      {/* 1. HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Class Teacher Dashboard
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            <span className="font-semibold text-slate-700">{activeData.meta.sectionName}</span>
            <span className="mx-2 text-slate-300">|</span>
            <span>{activeData.meta.academicYear}</span>
            <span className="mx-2 text-slate-300">|</span>
            <span>{activeData.meta.semester}</span>
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Date pill */}
          <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50/80 text-xs text-slate-700 font-medium shadow-2xs">
            <Calendar className="h-3.5 w-3.5 text-slate-500" />
            <span>{activeData.meta.dateFormatted}</span>
          </div>

          {/* Notification icon */}
          <div className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer">
            <Bell className="h-4 w-4" />
          </div>

          {/* User profile */}
          <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
            <div className="h-8.5 w-8.5 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shadow-xs">
              {teacherInitials}
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-slate-900 leading-tight">
                {activeData.meta.teacherName}
              </p>
              <p className="text-[10px] text-slate-500 font-medium leading-tight">
                Class Teacher ({activeData.meta.sectionName})
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. TOP KPI CARDS (6 Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* KPI 1: Class Attendance */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-2xs">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <Users className="h-4 w-4" />
            </div>
            <span className="text-xs font-medium text-slate-600">Class Attendance ({activeData.meta.dateFormatted})</span>
            </div>
            <span className="text-[10px] font-semibold text-slate-400">{activeData.meta.dateFormatted}</span>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-600 tracking-tight">
            {activeData.kpis.classAttendance.percentage != null
              ? `${activeData.kpis.classAttendance.percentage}%`
              : "—"}
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-medium">
            {activeData.kpis.classAttendance.present != null
              ? `${activeData.kpis.classAttendance.present} Present | ${activeData.kpis.classAttendance.absent ?? 0} Absent | ${activeData.kpis.classAttendance.late ?? 0} Late`
              : `No records for ${activeData.meta.dateFormatted}`}
          </div>
        </div>

        {/* KPI 2: Students < 65% */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-2xs">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <Users className="h-4 w-4" />
            </div>
            <span className="text-xs font-medium text-slate-600">Students &lt; 65%</span>
          </div>
          <div className="mt-2 text-2xl font-black text-rose-600 tracking-tight">
            {activeData.kpis.studentsBelow65Count != null ? activeData.kpis.studentsBelow65Count : "—"}
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-medium">
            (Attendance Risk)
          </div>
        </div>

        {/* KPI 3: Internal I Failed */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-2xs">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <FileText className="h-4 w-4" />
            </div>
            <span className="text-xs font-medium text-slate-600">Internal I Failed</span>
          </div>
          <div className="mt-2 text-2xl font-black text-blue-600 tracking-tight">
            {activeData.kpis.internal1FailedCount != null ? activeData.kpis.internal1FailedCount : "—"}
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-medium">
            (Students)
          </div>
        </div>

        {/* KPI 4: Internal II Failed */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-2xs">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <FileText className="h-4 w-4" />
            </div>
            <span className="text-xs font-medium text-slate-600">Internal II Failed</span>
          </div>
          <div className="mt-2 text-2xl font-black text-purple-600 tracking-tight">
            {activeData.kpis.internal2FailedCount != null ? activeData.kpis.internal2FailedCount : "—"}
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-medium">
            (Students)
          </div>
        </div>

        {/* KPI 5: Failed Both Internals */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-2xs">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <span className="text-xs font-medium text-slate-600 truncate">Failed Both Internals</span>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-600 tracking-tight">
            {activeData.kpis.failedBothCount != null ? activeData.kpis.failedBothCount : "—"}
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-medium">
            (Critical Risk)
          </div>
        </div>

        {/* KPI 6: Fee Pending */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <IndianRupee className="h-4 w-4" />
            </div>
            <span className="text-xs font-medium text-slate-600">Fee Pending</span>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-600 tracking-tight">
            {activeData.kpis.feePendingCount != null ? activeData.kpis.feePendingCount : "—"}
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-medium">
            (Students)
          </div>
        </div>
      </div>

      {/* 3. ROW 2: 3 CARDS (Attendance Trend | Today's Priorities | Today's Timetable) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Attendance Trend */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">

            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <h2 className="text-xs font-bold text-slate-800">
                Attendance Trend ({activeData.meta.sectionName})
              </h2>
            </div>
            <Link
              href="/attendance-analytics"
              className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-0.5"
            >
              View Details &gt;
            </Link>
          </div>

          <div className="h-48 w-full mt-3">
            {activeData.attendanceTrend && activeData.attendanceTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activeData.attendanceTrend} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="attTrendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[20, 40, 60, 80, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(val: any) => [`${val}%`, "Attendance"]}
                    contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "8px", fontSize: "11px", color: "#fff" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#attTrendGrad)"
                    dot={{ r: 4, fill: "#2563eb", stroke: "#fff", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 font-medium">
                No attendance trend data available
              </div>
            )}
          </div>
        </div>

        {/* Today's Priorities */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">

            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-rose-500" />
              <div>
                <h2 className="text-xs font-bold text-slate-800">Today&apos;s Priorities</h2>
                <p className="text-[10px] text-slate-400 font-medium">{activeData.meta.dateFormatted}</p>
              </div>
            </div>
            <Link
              href="/mentoring-risks"
              className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-0.5"
            >
              View All &gt;
            </Link>
          </div>

          <div className="space-y-2 mt-3 min-h-48 flex flex-col justify-center">
            {activeData.todaysPriorities && activeData.todaysPriorities.length > 0 ? (
              activeData.todaysPriorities.map((item) => {
                const badgeColor =
                  item.severity === "critical"
                    ? "bg-rose-500 text-white"
                    : item.severity === "warning"
                      ? "bg-amber-500 text-white"
                      : "bg-blue-600 text-white";

                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${badgeColor}`}
                      >
                        {item.id}
                      </span>
                      <span className="text-xs text-slate-700 font-medium group-hover:text-blue-600 transition-colors">
                        {item.text}
                      </span>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-600" />
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-xs text-slate-400 font-medium">
                No active priorities or interventions required
              </div>
            )}
          </div>
        </div>

        {/* Today's Timetable */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">

            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              <div>
                <h2 className="text-xs font-bold text-slate-800">Today&apos;s Timetable</h2>
                <p className="text-[10px] text-slate-400 font-medium">{activeData.meta.dateFormatted}</p>
              </div>
            </div>
            <Link
              href="/today-timetable"
              className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-0.5"
            >
              View Full &gt;
            </Link>
          </div>

          <div className="mt-2 divide-y divide-slate-100 min-h-48">
            {activeData.todaysTimetable && activeData.todaysTimetable.length > 0 ? (
              <>
                <div className="grid grid-cols-12 text-[10px] font-bold text-slate-400 uppercase tracking-wider py-1">
                  <span className="col-span-3">Time</span>
                  <span className="col-span-4">Subject</span>
                  <span className="col-span-3">Faculty</span>
                  <span className="col-span-2 text-right">Status</span>
                </div>
                {activeData.todaysTimetable.map((slot, idx) => {
                  const statusPill =
                    slot.status === "Conducted"
                      ? "bg-emerald-50 text-emerald-700"
                      : slot.status === "Ongoing"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-slate-100 text-slate-600";

                  return (
                    <div key={idx} className="grid grid-cols-12 items-center text-xs py-2">
                      <span className="col-span-3 text-[11px] text-slate-500 font-medium truncate">
                        {slot.time}
                      </span>
                      <span className="col-span-4 font-semibold text-slate-800 truncate" title={slot.subject}>
                        {slot.subject}
                      </span>
                      <span className="col-span-3 text-[11px] text-slate-600 truncate" title={slot.faculty}>
                        {slot.faculty}
                      </span>
                      <span className="col-span-2 text-right">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusPill}`}>
                          {slot.status}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="py-16 text-center text-xs text-slate-400 font-medium">
                No class sessions scheduled for today
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. ROW 3: 3 CARDS (Students Below 65% | Internal Exam Performance | Students at Academic Risk) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Students Below 65% Attendance */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">

            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <div>
                <h2 className="text-xs font-bold text-slate-800">Students Below 65% Attendance</h2>
                <p className="text-[10px] text-slate-400 font-medium">As of {activeData.meta.dateFormatted}</p>
              </div>
            </div>
            <Link
              href="/mentoring-risks?risk=High"
              className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-0.5"
            >
              View All &gt;
            </Link>
          </div>

          <div className="mt-2 divide-y divide-slate-100 min-h-48">
            {activeData.below65Students && activeData.below65Students.length > 0 ? (
              <>
                <div className="grid grid-cols-12 text-[10px] font-bold text-slate-400 uppercase tracking-wider py-1">
                  <span className="col-span-1">#</span>
                  <span className="col-span-3">Roll No</span>
                  <span className="col-span-3">Name</span>
                  <span className="col-span-2 text-center">Attendance</span>
                  <span className="col-span-3 text-right">Action</span>
                </div>

                {activeData.below65Students.map((st, idx) => (
                  <div key={st.id || idx} className="grid grid-cols-12 items-center text-xs py-2">
                    <span className="col-span-1 text-[11px] text-slate-400">{idx + 1}</span>
                    <span className="col-span-3 font-semibold text-slate-800 text-[11px] truncate">{st.rollNo}</span>
                    <span className="col-span-3 text-[11px] text-slate-700 truncate" title={st.name}>
                      {st.name}
                    </span>
                    <span className="col-span-2 text-center font-bold text-rose-600 text-[11px]">
                      {st.attendance}
                    </span>
                    <span className="col-span-3 text-right">
                      <button
                        type="button"
                        onClick={() => setCallModalStudent(st)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-blue-500 text-blue-600 hover:bg-blue-50 text-[10px] font-semibold transition-all shadow-2xs"
                      >
                        <PhoneCall className="h-2.5 w-2.5" />
                        Call Parent
                      </button>
                    </span>
                  </div>
                ))}
              </>
            ) : (
              <div className="py-16 text-center text-xs text-slate-400 font-medium">
                No students below 65% attendance in this section
              </div>
            )}
          </div>
        </div>

        {/* Internal Exam Performance */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
  
            <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <h2 className="text-xs font-bold text-slate-800">Internal Exam Performance</h2>
              </div>
              <Link
                href="/internal-marks"
                className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-0.5"
              >
                View Details &gt;
              </Link>
            </div>

            {activeData.internalPerformance ? (
              <>
                {/* Legend */}
                <div className="flex items-center justify-center gap-6 mt-2 text-xs font-medium text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span>Passed</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                    <span>Failed</span>
                  </div>
                </div>

                {/* Bar chart */}
                <div className="h-36 w-full mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={internalBarData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "8px", fontSize: "11px", color: "#fff" }}
                      />
                      <Bar dataKey="Passed" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
                      <Bar dataKey="Failed" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={30} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <div className="h-44 flex items-center justify-center text-xs text-slate-400 font-medium">
                No internal marks entries recorded for this section
              </div>
            )}
          </div>

          {/* Bottom Card for Failed in Both Internals */}
          {activeData.internalPerformance && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between bg-rose-50/50 p-2.5 rounded-lg border border-rose-100">
  
            <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-rose-600" />
                <div className="text-xs">
                  <span className="text-slate-600 font-medium">Failed in Both Internals: </span>
                  <span className="font-bold text-rose-600">
                    {activeData.internalPerformance.failedBothCount} students
                  </span>
                </div>
              </div>
              <Link
                href="/mentoring-risks?risk=Critical"
                className="text-[11px] font-semibold text-blue-600 hover:underline"
              >
                View Students &gt;
              </Link>
            </div>
          )}
        </div>

        {/* Students at Academic Risk */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">

            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600" />
              <div>
                <h2 className="text-xs font-bold text-slate-800">Students at Academic Risk</h2>
                <p className="text-[10px] text-slate-400 font-medium">As of {activeData.meta.dateFormatted}</p>
              </div>
            </div>
            <Link
              href="/mentoring-risks"
              className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-0.5"
            >
              View All &gt;
            </Link>
          </div>

          <div className="mt-2 divide-y divide-slate-100 min-h-48">
            {activeData.academicRiskStudents && activeData.academicRiskStudents.length > 0 ? (
              <>
                <div className="grid grid-cols-12 text-[10px] font-bold text-slate-400 uppercase tracking-wider py-1">
                  <span className="col-span-1">#</span>
                  <span className="col-span-3">Roll No</span>
                  <span className="col-span-3">Name</span>
                  <span className="col-span-2 text-center">Attd</span>
                  <span className="col-span-1 text-center">I</span>
                  <span className="col-span-1 text-center">II</span>
                  <span className="col-span-1 text-right">Risk</span>
                </div>

                {activeData.academicRiskStudents.map((st, idx) => {
                  const riskBadge =
                    st.risk === "Critical"
                      ? "bg-rose-100 text-rose-700"
                      : st.risk === "High"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-yellow-100 text-yellow-800";

                  return (
                    <div key={st.id || idx} className="grid grid-cols-12 items-center text-xs py-2">
                      <span className="col-span-1 text-[11px] text-slate-400">{idx + 1}</span>
                      <span className="col-span-3 font-semibold text-slate-800 text-[11px] truncate">{st.rollNo}</span>
                      <span className="col-span-3 text-[11px] text-slate-700 truncate" title={st.name}>
                        {st.name}
                      </span>
                      <span className="col-span-2 text-center font-bold text-slate-700 text-[11px]">
                        {st.attendance}
                      </span>
                      <span
                        className={`col-span-1 text-center font-bold text-[11px] ${
                          st.int1 === "F" ? "text-rose-600" : "text-emerald-600"
                        }`}
                      >
                        {st.int1}
                      </span>
                      <span
                        className={`col-span-1 text-center font-bold text-[11px] ${
                          st.int2 === "F" ? "text-rose-600" : "text-emerald-600"
                        }`}
                      >
                        {st.int2}
                      </span>
                      <span className="col-span-1 text-right">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${riskBadge}`}>
                          {st.risk}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="py-16 text-center text-xs text-slate-400 font-medium">
                No students identified at academic risk
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. ROW 4: 3 CARDS (Fee Status | Continuous Absentees | Upcoming Events / Notices) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Fee Status */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">

            <div className="flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-emerald-600" />
              <div>
                <h2 className="text-xs font-bold text-slate-800">
                  Fee Status ({activeData.meta.sectionName})
                </h2>
                <p className="text-[10px] text-slate-400 font-medium">As of {activeData.meta.dateFormatted}</p>
              </div>
            </div>
            <Link
              href="/students"
              className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-0.5"
            >
              View All &gt;
            </Link>
          </div>

          <div className="min-h-36 flex items-center justify-center">
            {activeData.feeStatus ? (
              <div className="flex items-center justify-between w-full mt-3 gap-4">
                {/* Donut chart */}
                <div className="h-36 w-36 relative shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={feeDonutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={42}
                        outerRadius={58}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {feeDonutData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Centered label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xl font-black text-slate-900 leading-none">
                      {activeData.feeStatus.pending}
                    </span>
                    <span className="text-[9px] text-slate-500 font-medium mt-0.5 text-center leading-tight">
                      Students<br />Pending
                    </span>
                  </div>
                </div>

                {/* Legend with counts */}
                <div className="space-y-2 text-xs flex-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      <span className="text-slate-600 font-medium">Paid</span>
                    </div>
                    <span className="font-bold text-slate-900">{activeData.feeStatus.paid}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                      <span className="text-slate-600 font-medium">Partial</span>
                    </div>
                    <span className="font-bold text-slate-900">{activeData.feeStatus.partial}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                      <span className="text-slate-600 font-medium">Pending</span>
                    </div>
                    <span className="font-bold text-rose-600">{activeData.feeStatus.pending}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Total Students</span>
                    <span className="font-bold text-slate-800">{activeData.feeStatus.total}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-400 font-medium">
                No fee records found for this section
              </div>
            )}
          </div>
        </div>

        {/* Continuous Absentees (3+ days) */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">

            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <div>
                <h2 className="text-xs font-bold text-slate-800">Continuous Absentees (3+ days)</h2>
                <p className="text-[10px] text-slate-400 font-medium">Tracking up to {activeData.meta.dateFormatted}</p>
              </div>
            </div>
            <Link
              href="/attendance-analytics"
              className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-0.5"
            >
              View All &gt;
            </Link>
          </div>

          <div className="mt-2 divide-y divide-slate-100 min-h-36">
            {activeData.continuousAbsentees && activeData.continuousAbsentees.length > 0 ? (
              <>
                <div className="grid grid-cols-12 text-[10px] font-bold text-slate-400 uppercase tracking-wider py-1">
                  <span className="col-span-1">#</span>
                  <span className="col-span-3">Roll No</span>
                  <span className="col-span-4">Name</span>
                  <span className="col-span-2 text-center">Days</span>
                  <span className="col-span-2 text-right">Last Attended</span>
                </div>

                {activeData.continuousAbsentees.map((st, idx) => (
                  <div key={st.id || idx} className="grid grid-cols-12 items-center text-xs py-2">
                    <span className="col-span-1 text-[11px] text-slate-400">{idx + 1}</span>
                    <span className="col-span-3 font-semibold text-slate-800 text-[11px] truncate">{st.rollNo}</span>
                    <span className="col-span-4 text-[11px] text-slate-700 truncate" title={st.name}>
                      {st.name}
                    </span>
                    <span
                      className={`col-span-2 text-center font-bold text-[11px] ${
                        st.days >= 4 ? "text-rose-600" : "text-amber-600"
                      }`}
                    >
                      {st.days}
                    </span>
                    <span className="col-span-2 text-right text-[11px] text-slate-600">
                      {st.lastAttended}
                    </span>
                  </div>
                ))}
              </>
            ) : (
              <div className="py-16 text-center text-xs text-slate-400 font-medium">
                No continuous absentees (3+ days) recorded
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Events / Notices */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">

            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-purple-600" />
              <h2 className="text-xs font-bold text-slate-800">Upcoming Events / Notices</h2>
            </div>
            <Link
              href="/calendar"
              className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-0.5"
            >
              View All &gt;
            </Link>
          </div>

          <div className="space-y-2.5 mt-2 min-h-36 flex flex-col justify-center">
            {activeData.upcomingNotices && activeData.upcomingNotices.length > 0 ? (
              activeData.upcomingNotices.map((notice, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-700 flex flex-col items-center justify-center shrink-0 border border-blue-100">
                      <span className="text-xs font-black leading-none">{notice.date}</span>
                      <span className="text-[9px] font-semibold uppercase leading-none mt-0.5">
                        {notice.month}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-slate-800 group-hover:text-blue-600 transition-colors leading-tight">
                        {notice.title}
                      </h3>
                      <p className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">
                        {notice.scope}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600" />
                </div>
              ))
            ) : (
              <div className="py-16 text-center text-xs text-slate-400 font-medium">
                No upcoming notices or events posted
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CALL PARENT MODAL */}
      {callModalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
  
            <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                  <PhoneCall className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Parent Communication</h3>
                  <p className="text-[11px] text-slate-500">{callModalStudent.rollNo} • {callModalStudent.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCallModalStudent(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-medium text-rose-800">Current Attendance</span>
                  <div className="text-lg font-bold text-rose-600">{callModalStudent.attendance}</div>
                </div>
                <div className="text-right text-[11px] text-rose-700 font-medium">
                  Trigger: Critical Cutoff &lt; 65%
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Primary Parent Phone
                </label>
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 font-mono text-sm font-bold text-slate-800">
                  <span>{callModalStudent.phone ? `+91 ${callModalStudent.phone}` : "No phone number registered"}</span>
                  {callModalStudent.phone ? (
                    <a
                      href={`tel:${callModalStudent.phone}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs"
                    >
                      <PhoneCall className="h-3 w-3" />
                      Call Now
                    </a>
                  ) : null}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Log Intervention / Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Summarize discussion with parent regarding student absences..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCallModalStudent(null)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    alert("Intervention logged successfully.");
                    setCallModalStudent(null);
                  }}
                  className="px-3.5 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 shadow-xs"
                >
                  Save Intervention
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
