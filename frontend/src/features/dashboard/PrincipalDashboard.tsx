"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAcademicContext } from "@/components/layout/AcademicProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { apiFetch } from "@/lib/api";
import {
  Users,
  UserCheck,
  GraduationCap,
  BookOpen,
  IndianRupee,
  Briefcase,
  BarChart3,
  AlertCircle,
  Clock,
  Calendar,
  ChevronRight,
  ArrowUpRight,
  TrendingUp,
  FileText,
  AlertTriangle,
  X,
  ExternalLink,
  ClipboardList,
  CheckCircle2,
  CalendarDays,
  User,
  Filter,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";

export interface PrincipalDashboardProps {
  roleType?: "principal" | "vice_principal" | "admin";
  customUserName?: string;
}

export type PrincipalDashboardData = {
  meta: {
    roleTitle: string;
    subtitle: string;
    dateFormatted: string;
    academicYear: string;
    semester: string;
    userInitials: string;
    roleLabel: string;
    userName: string;
  };
  kpis: {
    studentAttendance: {
      value: string;
      trend: string;
      trendPositive: boolean;
      subtext: string;
    };
    facultyAttendance: {
      value: string;
      trend: string;
      trendPositive: boolean;
      subtext: string;
    };
    studentsAtRisk: {
      value: string;
      subtext1: string;
      subtext2: string;
    };
    subjectsBehindSchedule: {
      value: string;
      subtext: string;
    };
    feeCollection: {
      value: string;
      subtext: string;
    };
    placement: {
      value: string;
      subtext: string;
    };
  };
  departmentOverview: Array<{
    department: string;
    studentAttendance: string;
    facultyAttendance: string;
    internalPassPct: string;
    subjectsBehind: number;
    riskStudents: number;
    isStudentAttGood?: boolean;
    isFacultyAttGood?: boolean;
    hasBehindRisk?: boolean;
  }>;
  priorities: Array<{
    id: number;
    text: string;
    badgeColor: string;
    href: string;
    category: string;
  }>;
  sectionAttendance: Array<{
    department: string;
    sections: number;
    attendance: number;
    fill: string;
    label: string;
  }>;
  studentsAtRiskDeptWise: Array<{
    department: string;
    below65Attendance: number;
    failedInternal1: number;
    failedInternal2: number;
    failedBoth: number;
  }>;
  subjectsBehindSchedule: Array<{
    subject: string;
    faculty: string;
    dept: string;
    delay: string;
    status: string;
  }>;
  facultyAttendanceAndAdjustment: {
    facultyStatus: {
      present: number;
      late: number;
      leave: number;
      od: number;
      absent: number;
      totalTeachingFaculty?: number;
    };
    classesAffected: {
      total: number;
      adjusted: number;
      substitute: number;
      cancelled: number;
      pending: number;
    };
  };
  feeCollectionAndDues: {
    percentage: number;
    collectedAmount: string;
    totalAmount: string;
    pendingDues: Array<{
      label: string;
      studentsCount: number;
      amount: string;
      color: string;
      bg: string;
    }>;
  };
  approvalsAndDeadlines: {
    pendingApprovals: Array<{
      label: string;
      count: number;
      href: string;
    }>;
    upcomingDeadlines: Array<{
      day: string;
      month: string;
      title: string;
      subtitle: string;
    }>;
  };
};

export function PrincipalDashboard({
  roleType = "principal",
  customUserName,
}: PrincipalDashboardProps) {
  const { user, authorization } = useAuth();
  const { filters, setFilters, masters } = useAcademicContext();

  const [data, setData] = useState<PrincipalDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<any | null>(null);
  const [approvalTab, setApprovalTab] = useState<"approvals" | "deadlines">("approvals");

  // Determine effective role title
  const isVp =
    roleType === "vice_principal" ||
    authorization?.roles?.some((r) => r.roleKey === "vice_principal");
  const dashboardTitle = isVp ? "Vice Principal Dashboard" : "Principal Dashboard";
  const userInitials = isVp ? "VP" : "P";
  const userRoleLabel = isVp ? "Vice Principal" : "Principal";

  // Build query parameters based on academic filter bar
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.date) params.set("date", filters.date);
    if (filters.collegeId && filters.collegeId !== "all") params.set("collegeId", String(filters.collegeId));
    if (filters.branchId && filters.branchId !== "all") params.set("branchId", String(filters.branchId));
    if (filters.academicYear) params.set("academicYear", filters.academicYear);
    if (filters.semester && filters.semester !== "all") params.set("semester", String(filters.semester));
    return params.toString();
  }, [filters]);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      try {
        const res = await apiFetch(`/principal-dashboard/summary${queryParams ? `?${queryParams}` : ""}`);
        if (!cancelled) {
          if (res.ok) {
            const json = await res.json();
            setData(json);
          } else {
            const errJson = await res.json().catch(() => ({}));
            setError(errJson.message || "Failed to load dashboard metrics.");
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to load dashboard data. Please check network connection.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [queryParams]);

  const current = data;

  if (loading && !current) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] space-y-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <p className="text-sm font-medium text-slate-500">Loading {dashboardTitle}...</p>
      </div>
    );
  }

  if (error && !current) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6 bg-white rounded-2xl border border-red-100 shadow-xs max-w-lg mx-auto text-center my-12">
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Failed to load dashboard</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4">{error}</p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setLoading(true);
            apiFetch(`/principal-dashboard/summary${queryParams ? `?${queryParams}` : ''}`)
              .then(async (res) => {
                if (res.ok) setData(await res.json());
                else setError("Failed to load dashboard data.");
              })
              .catch((e) => setError(e?.message || "Network error"))
              .finally(() => setLoading(false));
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="space-y-4 sm:space-y-5 pb-12 font-sans bg-[#f8fafc] -mx-4 sm:-mx-6 -mt-6 p-4 sm:p-6 min-h-screen">
      {/* 2. TOP METRIC CARDS ROW (6 CARDS) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        
        {/* Card 1: Student Attendance */}
        <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/80 shadow-2xs hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <span className="text-xs font-medium text-slate-500 block">Student Attendance</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {current.kpis.studentAttendance.value}
            </span>
            <span className="text-xs font-bold text-emerald-600">
              {current.kpis.studentAttendance.trend}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {current.kpis.studentAttendance.subtext}
          </span>
        </div>

        {/* Card 2: Faculty Attendance */}
        <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/80 shadow-2xs hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <UserCheck className="h-5 w-5" />
            </div>
          </div>
          <span className="text-xs font-medium text-slate-500 block">Faculty Attendance</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {current.kpis.facultyAttendance.value}
            </span>
            <span className="text-xs font-bold text-emerald-600">
              {current.kpis.facultyAttendance.trend}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block truncate" title={current.kpis.facultyAttendance.subtext}>
            {current.kpis.facultyAttendance.subtext}
          </span>
        </div>

        {/* Card 3: Students at Risk */}
        <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/80 shadow-2xs hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center">
              <GraduationCap className="h-5 w-5" />
            </div>
          </div>
          <span className="text-xs font-medium text-slate-500 block">Students at Risk</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-rose-600 tracking-tight">
              {current.kpis.studentsAtRisk.value}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">
            {current.kpis.studentsAtRisk.subtext1}
          </span>
          <span className="text-[10px] text-slate-400 block truncate">
            {current.kpis.studentsAtRisk.subtext2}
          </span>
        </div>

        {/* Card 4: Subjects Behind Schedule */}
        <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/80 shadow-2xs hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center">
              <BookOpen className="h-5 w-5" />
            </div>
          </div>
          <span className="text-xs font-medium text-slate-500 block">Subjects Behind Schedule</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-amber-500 tracking-tight">
              {current.kpis.subjectsBehindSchedule.value}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {current.kpis.subjectsBehindSchedule.subtext}
          </span>
        </div>

        {/* Card 5: Fee Collection */}
        <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/80 shadow-2xs hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <IndianRupee className="h-5 w-5" />
            </div>
          </div>
          <span className="text-xs font-medium text-slate-500 block">Fee Collection</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {current.kpis.feeCollection.value}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {current.kpis.feeCollection.subtext}
          </span>
        </div>

        {/* Card 6: Placement (Eligible) */}
        <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/80 shadow-2xs hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <Briefcase className="h-5 w-5" />
            </div>
          </div>
          <span className="text-xs font-medium text-slate-500 block">Placement (Eligible)</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {current.kpis.placement.value}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {current.kpis.placement.subtext}
          </span>
        </div>

      </div>

      {/* 3. MIDDLE SECTION: DEPARTMENT ACADEMIC OVERVIEW & TODAY'S PRIORITIES */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left: Department Academic Overview (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                  Department Academic Overview
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal("dept_overview")}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
              >
                View All &gt;
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100 font-medium">
                    <th className="py-2.5 font-medium">Department</th>
                    <th className="py-2.5 font-medium">Student Attendance</th>
                    <th className="py-2.5 font-medium">Faculty Attendance</th>
                    <th className="py-2.5 font-medium">Internal Pass % (I / II)</th>
                    <th className="py-2.5 text-center font-medium">Subjects Behind</th>
                    <th className="py-2.5 text-center font-medium">Risk Students</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/70">
                  {current.departmentOverview.map((row) => (
                    <tr key={row.department} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 font-bold text-slate-800">{row.department}</td>
                      <td className="py-2.5">
                        <span
                          className={`font-bold ${
                            parseInt(row.studentAttendance) < 80
                              ? "text-amber-600"
                              : "text-emerald-600"
                          }`}
                        >
                          {row.studentAttendance}
                        </span>
                      </td>
                      <td className="py-2.5 font-semibold text-slate-700">
                        <span className={parseInt(row.facultyAttendance) >= 94 ? "text-emerald-600 font-bold" : ""}>
                          {row.facultyAttendance}
                        </span>
                      </td>
                      <td className="py-2.5 font-medium text-slate-600">{row.internalPassPct}</td>
                      <td className="py-2.5 text-center">
                        <span
                          className={`font-bold ${
                            row.subjectsBehind >= 3 ? "text-rose-600" : "text-slate-700"
                          }`}
                        >
                          {row.subjectsBehind}
                        </span>
                      </td>
                      <td className="py-2.5 text-center font-bold text-rose-600">
                        {row.riskStudents}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Today's Priorities (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center font-black text-[11px]">
                  !
                </div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                  Today's Priorities
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal("priorities")}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
              >
                View All &gt;
              </button>
            </div>

            {/* List of 8 items */}
            <div className="mt-2.5 space-y-1.5">
              {current.priorities.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${item.badgeColor}`}
                    >
                      {item.id}
                    </span>
                    <span className="text-xs text-slate-800 font-medium group-hover:text-blue-600 transition-colors line-clamp-1">
                      {item.text}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
                </Link>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* 4. LOWER ROW 1: 3 CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* Card 1: Student Attendance (Section Wise) */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                  Student Attendance (Section Wise)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal("section_att")}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
              >
                View All &gt;
              </button>
            </div>

            {/* Bar Chart */}
            <div className="h-56 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={current.sectionAttendance}
                  margin={{ top: 20, right: 10, left: -20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="department"
                    tickLine={false}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    tickFormatter={(val, i) => `${val}\n(${current.sectionAttendance[i]?.sections || 0})`}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 10 }}
                    ticks={[0, 25, 50, 75, 100]}
                  />
                  <Tooltip
                    formatter={(value: any) => [`${value}%`, "Attendance"]}
                    contentStyle={{ borderRadius: "8px", fontSize: "12px", border: "1px solid #e2e8f0" }}
                  />
                  <Bar dataKey="attendance" radius={[4, 4, 0, 0]} barSize={34}>
                    <LabelList
                      dataKey="label"
                      position="top"
                      style={{ fill: "#1e293b", fontSize: 12, fontWeight: 700 }}
                    />
                    {current.sectionAttendance.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Card 2: Students at Risk (Department Wise) */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                  Students at Risk (Department Wise)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal("risk_students")}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
              >
                View All &gt;
              </button>
            </div>

            <div className="overflow-x-auto mt-2">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100 font-medium">
                    <th className="py-2">Department</th>
                    <th className="py-2 text-center">&lt; 65% Att.</th>
                    <th className="py-2 text-center">Failed Int-I</th>
                    <th className="py-2 text-center">Failed Int-II</th>
                    <th className="py-2 text-center">Failed Both</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/60">
                  {current.studentsAtRiskDeptWise.map((r) => (
                    <tr key={r.department} className="hover:bg-slate-50/50">
                      <td className="py-2 font-bold text-slate-800">{r.department}</td>
                      <td className="py-2 text-center font-bold text-rose-600">{r.below65Attendance}</td>
                      <td className="py-2 text-center text-slate-600">{r.failedInternal1}</td>
                      <td className="py-2 text-center text-slate-600">{r.failedInternal2}</td>
                      <td className="py-2 text-center font-bold text-rose-600">{r.failedBoth}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Card 3: Subjects Behind Schedule */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-amber-500" />
                <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                  Subjects Behind Schedule
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal("subjects_behind")}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
              >
                View All &gt;
              </button>
            </div>

            <div className="overflow-x-auto mt-2">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100 font-medium">
                    <th className="py-2">Subject</th>
                    <th className="py-2">Faculty</th>
                    <th className="py-2">Dept</th>
                    <th className="py-2 text-center">Delay</th>
                    <th className="py-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/60">
                  {current.subjectsBehindSchedule.map((s, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2 font-semibold text-slate-800">{s.subject}</td>
                      <td className="py-2 text-slate-600">{s.faculty}</td>
                      <td className="py-2 font-medium text-slate-700">{s.dept}</td>
                      <td className="py-2 text-center font-bold text-rose-600">{s.delay}</td>
                      <td className="py-2 text-center">
                        <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

      {/* 5. LOWER ROW 2: 3 CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* Card 4: Faculty Attendance & Class Adjustment */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-blue-600" />
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                    Faculty Attendance &amp; Class Adjustment
                  </h3>
                  {current.facultyAttendanceAndAdjustment.facultyStatus.totalTeachingFaculty ? (
                    <span className="text-[10px] text-slate-500 font-medium block">
                      {current.facultyAttendanceAndAdjustment.facultyStatus.totalTeachingFaculty} Assigned Teaching Faculty
                    </span>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal("faculty_adjustment")}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
              >
                View All &gt;
              </button>
            </div>

            {/* Top row status counters */}
            <div className="grid grid-cols-5 gap-2 text-center mt-3">
              <div className="bg-slate-50/80 p-2 rounded-lg">
                <span className="text-[10px] text-slate-500 block">Present</span>
                <span className="text-base sm:text-lg font-extrabold text-emerald-600">
                  {current.facultyAttendanceAndAdjustment.facultyStatus.present}
                </span>
              </div>
              <div className="bg-slate-50/80 p-2 rounded-lg">
                <span className="text-[10px] text-slate-500 block">Late</span>
                <span className="text-base sm:text-lg font-extrabold text-amber-500">
                  {current.facultyAttendanceAndAdjustment.facultyStatus.late}
                </span>
              </div>
              <div className="bg-slate-50/80 p-2 rounded-lg">
                <span className="text-[10px] text-slate-500 block">Leave</span>
                <span className="text-base sm:text-lg font-extrabold text-rose-500">
                  {current.facultyAttendanceAndAdjustment.facultyStatus.leave}
                </span>
              </div>
              <div className="bg-slate-50/80 p-2 rounded-lg">
                <span className="text-[10px] text-slate-500 block">OD</span>
                <span className="text-base sm:text-lg font-extrabold text-purple-600">
                  {current.facultyAttendanceAndAdjustment.facultyStatus.od}
                </span>
              </div>
              <div className="bg-slate-50/80 p-2 rounded-lg">
                <span className="text-[10px] text-slate-500 block">Absent</span>
                <span className="text-base sm:text-lg font-extrabold text-rose-600">
                  {current.facultyAttendanceAndAdjustment.facultyStatus.absent}
                </span>
              </div>
            </div>

            {/* Banner: Classes Affected Today */}
            <div className="mt-4 p-3 bg-rose-50/50 border border-rose-100 rounded-xl">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-rose-100/60">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <CalendarDays className="h-3.5 w-3.5 text-rose-500" />
                  <span>Classes Affected Today</span>
                </div>
                <span className="text-sm font-black text-rose-600">
                  {current.facultyAttendanceAndAdjustment.classesAffected.total}
                </span>
              </div>

              {/* Sub status */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block">Adjusted</span>
                  <span className="text-sm font-bold text-emerald-600">
                    {current.facultyAttendanceAndAdjustment.classesAffected.adjusted}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Substitute</span>
                  <span className="text-sm font-bold text-blue-600">
                    {current.facultyAttendanceAndAdjustment.classesAffected.substitute}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Cancelled</span>
                  <span className="text-sm font-bold text-rose-600">
                    {current.facultyAttendanceAndAdjustment.classesAffected.cancelled}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Pending</span>
                  <span className="text-sm font-bold text-amber-500">
                    {current.facultyAttendanceAndAdjustment.classesAffected.pending}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 5: Fee Collection & Dues */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-emerald-600" />
                <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                  Fee Collection &amp; Dues
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal("fee_dues")}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
              >
                View All &gt;
              </button>
            </div>

            {/* Donut Chart & Collection amount */}
            <div className="flex items-center gap-4 mt-3">
              {/* Circular Ring Gauge */}
              <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-slate-100"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-emerald-500"
                    strokeDasharray={`${current.feeCollectionAndDues.percentage}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span className="absolute font-black text-sm text-slate-800">
                  {current.feeCollectionAndDues.percentage}%
                </span>
              </div>

              <div>
                <span className="text-[11px] font-medium text-slate-500 block">Collected</span>
                <span className="text-xl font-extrabold text-slate-900 tracking-tight block">
                  {current.feeCollectionAndDues.collectedAmount}
                </span>
                <span className="text-xs text-slate-400 block">
                  of {current.feeCollectionAndDues.totalAmount}
                </span>
              </div>
            </div>

            {/* Pending Dues Section */}
            <div className="mt-4 pt-3 border-t border-slate-100">
              <span className="text-[11px] font-semibold text-slate-600 block mb-2">
                Pending Dues (No. of Students)
              </span>
              <div className="grid grid-cols-3 gap-2 text-center">
                {current.feeCollectionAndDues.pendingDues.map((due) => (
                  <div key={due.label} className={`${due.bg} p-2 rounded-lg border border-slate-100`}>
                    <span className="text-[10px] text-slate-500 block">{due.label}</span>
                    <span className={`text-sm font-extrabold block ${due.color}`}>
                      {due.studentsCount}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium block">{due.amount}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Link
                href="/reports"
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                View Fee Due Report &rarr;
              </Link>
            </div>
          </div>
        </div>

        {/* Card 6: Approvals & Upcoming Deadlines */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-purple-600" />
                <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                  Approvals &amp; Upcoming Deadlines
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal("approvals_deadlines")}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
              >
                View All &gt;
              </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-4 border-b border-slate-100 mt-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setApprovalTab("approvals")}
                className={`pb-2 transition-colors cursor-pointer ${
                  approvalTab === "approvals"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                Pending Approvals
              </button>
              <button
                type="button"
                onClick={() => setApprovalTab("deadlines")}
                className={`pb-2 transition-colors cursor-pointer ${
                  approvalTab === "deadlines"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                Upcoming Deadlines
              </button>
            </div>

            {/* Tab 1: Pending Approvals Content */}
            {approvalTab === "approvals" ? (
              <div className="mt-3 space-y-2">
                {current.approvalsAndDeadlines.pendingApprovals.map((item, idx) => (
                  <Link
                    key={idx}
                    href={item.href}
                    className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-50 transition-colors text-xs"
                  >
                    <span className="text-slate-700 font-medium">{item.label}</span>
                    <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
                      {item.count}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              /* Tab 2: Upcoming Deadlines Content */
              <div className="mt-3 space-y-2.5">
                {current.approvalsAndDeadlines.upcomingDeadlines.map((dl, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 py-1 text-xs">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 font-bold flex flex-col items-center justify-center shrink-0 border border-blue-100">
                      <span className="text-xs leading-none">{dl.day}</span>
                      <span className="text-[9px] uppercase leading-none mt-0.5">{dl.month}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 block">{dl.title}</span>
                      <span className="text-[11px] text-slate-400 block">{dl.subtitle}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* MODAL: VIEW ALL DETAILS */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {activeModal === "dept_overview" && "Department Academic Overview (Full)"}
                {activeModal === "priorities" && "All Priorities & Action Items"}
                {activeModal === "section_att" && "Section-wise Student Attendance Breakdown"}
                {activeModal === "risk_students" && "Students at Risk Analysis"}
                {activeModal === "subjects_behind" && "Subjects Behind Schedule - Detailed Report"}
                {activeModal === "faculty_adjustment" && "Faculty Attendance & Class Adjustments Today"}
                {activeModal === "fee_dues" && "Fee Collection & Pending Dues Overview"}
                {activeModal === "approvals_deadlines" && "All Approvals & Upcoming Deadlines"}
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="py-4">
              {activeModal === "priorities" && (
                <div className="space-y-2">
                  {current.priorities.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => setActiveModal(null)}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 hover:border-blue-500 hover:bg-blue-50/20 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${item.badgeColor}`}
                        >
                          {item.id}
                        </span>
                        <span className="text-xs sm:text-sm font-semibold text-slate-800 group-hover:text-blue-600">
                          {item.text}
                        </span>
                      </div>
                      <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-blue-600 shrink-0" />
                    </Link>
                  ))}
                </div>
              )}

              {activeModal === "dept_overview" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-2">Department</th>
                        <th className="py-2">Student Attendance</th>
                        <th className="py-2">Faculty Attendance</th>
                        <th className="py-2">Internal Pass %</th>
                        <th className="py-2 text-center">Behind</th>
                        <th className="py-2 text-center">Risk Students</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {current.departmentOverview.map((row) => (
                        <tr key={row.department}>
                          <td className="py-2.5 font-bold text-slate-800">{row.department}</td>
                          <td className="py-2.5 font-bold text-emerald-600">{row.studentAttendance}</td>
                          <td className="py-2.5 font-semibold text-slate-700">{row.facultyAttendance}</td>
                          <td className="py-2.5 text-slate-600">{row.internalPassPct}</td>
                          <td className="py-2.5 text-center font-bold text-rose-600">{row.subjectsBehind}</td>
                          <td className="py-2.5 text-center font-bold text-rose-600">{row.riskStudents}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeModal === "subjects_behind" && (
                <div className="space-y-3">
                  {current.subjectsBehindSchedule.map((s, i) => (
                    <div key={i} className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="font-bold text-xs text-slate-900 block">{s.subject}</span>
                        <span className="text-[11px] text-slate-500 block">
                          Faculty: {s.faculty} | Dept: {s.dept}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-rose-600 block">Delay: {s.delay}</span>
                        <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                          {s.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeModal === "fee_dues" && (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-600 block">Total Fee Target</span>
                      <span className="text-xl font-black text-slate-900">{current.feeCollectionAndDues.totalAmount}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-600 block">Total Collected</span>
                      <span className="text-xl font-black text-emerald-600">{current.feeCollectionAndDues.collectedAmount}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-600 block">Collection Rate</span>
                      <span className="text-xl font-black text-slate-900">{current.feeCollectionAndDues.percentage}%</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {current.feeCollectionAndDues.pendingDues.map((d) => (
                      <div key={d.label} className={`${d.bg} p-3 rounded-xl border border-slate-200 text-center`}>
                        <span className="text-xs text-slate-600 block font-medium">{d.label}</span>
                        <span className={`text-lg font-black block ${d.color}`}>{d.studentsCount} Students</span>
                        <span className="text-xs font-bold text-slate-700">{d.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeModal === "approvals_deadlines" && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Pending Approvals</h4>
                    <div className="space-y-1.5">
                      {current.approvalsAndDeadlines.pendingApprovals.map((a, i) => (
                        <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-xs">
                          <span className="font-medium text-slate-800">{a.label}</span>
                          <span className="font-bold bg-white border border-slate-200 px-2 py-0.5 rounded">{a.count} requests</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Upcoming Milestones &amp; Deadlines</h4>
                    <div className="space-y-2">
                      {current.approvalsAndDeadlines.upcomingDeadlines.map((dl, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg text-xs">
                          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex flex-col items-center justify-center shrink-0">
                            <span className="text-[11px] leading-none">{dl.day}</span>
                            <span className="text-[8px] uppercase">{dl.month}</span>
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 block">{dl.title}</span>
                            <span className="text-[11px] text-slate-500">{dl.subtitle}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeModal === "section_att" && (
                <div className="space-y-2">
                  {current.sectionAttendance.map((s) => (
                    <div key={s.department} className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900">{s.department} ({s.sections} sections)</span>
                      <span className="font-black text-emerald-600 text-sm">{s.attendance}%</span>
                    </div>
                  ))}
                </div>
              )}

              {activeModal === "risk_students" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-2">Department</th>
                        <th className="py-2 text-center">&lt; 65% Att.</th>
                        <th className="py-2 text-center">Failed Int-I</th>
                        <th className="py-2 text-center">Failed Int-II</th>
                        <th className="py-2 text-center">Failed Both</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {current.studentsAtRiskDeptWise.map((r) => (
                        <tr key={r.department}>
                          <td className="py-2 font-bold text-slate-800">{r.department}</td>
                          <td className="py-2 text-center font-bold text-rose-600">{r.below65Attendance}</td>
                          <td className="py-2 text-center text-slate-600">{r.failedInternal1}</td>
                          <td className="py-2 text-center text-slate-600">{r.failedInternal2}</td>
                          <td className="py-2 text-center font-bold text-rose-600">{r.failedBoth}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeModal === "faculty_adjustment" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-5 gap-2 text-center">
                    <div className="bg-emerald-50 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-500 block">Present</span>
                      <span className="text-base font-bold text-emerald-600">{current.facultyAttendanceAndAdjustment.facultyStatus.present}</span>
                    </div>
                    <div className="bg-amber-50 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-500 block">Late</span>
                      <span className="text-base font-bold text-amber-600">{current.facultyAttendanceAndAdjustment.facultyStatus.late}</span>
                    </div>
                    <div className="bg-rose-50 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-500 block">Leave</span>
                      <span className="text-base font-bold text-rose-600">{current.facultyAttendanceAndAdjustment.facultyStatus.leave}</span>
                    </div>
                    <div className="bg-purple-50 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-500 block">OD</span>
                      <span className="text-base font-bold text-purple-600">{current.facultyAttendanceAndAdjustment.facultyStatus.od}</span>
                    </div>
                    <div className="bg-rose-50 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-500 block">Absent</span>
                      <span className="text-base font-bold text-rose-600">{current.facultyAttendanceAndAdjustment.facultyStatus.absent}</span>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
                    <span className="font-bold text-slate-800 block">Classes Affected Today: {current.facultyAttendanceAndAdjustment.classesAffected.total}</span>
                    <p className="text-slate-500">
                      Adjusted: {current.facultyAttendanceAndAdjustment.classesAffected.adjusted} | 
                      Substitute: {current.facultyAttendanceAndAdjustment.classesAffected.substitute} | 
                      Cancelled: {current.facultyAttendanceAndAdjustment.classesAffected.cancelled} | 
                      Pending: {current.facultyAttendanceAndAdjustment.classesAffected.pending}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
