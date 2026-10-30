"use client";

import { useEffect, useMemo, useState, Fragment } from "react";
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
  ChevronDown,
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
  Search,
  Fingerprint,
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
import { PrincipalDashboardSkeleton } from "./PrincipalDashboardSkeleton";

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
      value: string | null;
      subtext: string;
    };
    placement: {
      value: string;
      subtext: string;
    };
  };
  departmentOverview: Array<{
    department: string;
    departmentName?: string;
    branchId?: number;
    years?: string[];
    batches?: string;
    studentAttendance: string;
    facultyAttendance: string;
    internalPassPct: string;
    subjectsBehind: number;
    riskStudents: number;
    totalStudents?: number;
    isStudentAttGood?: boolean;
    isFacultyAttGood?: boolean;
    hasBehindRisk?: boolean;
    yearBreakdown?: Array<{
      year: number;
      yearLabel: string;
      batches: string;
      students: number;
      studentAttendance: string;
      facultyAttendance: string;
      internalPassPct: string;
      subjectsBehind: number;
      riskStudents: number;
    }>;
  }>;
  priorities: Array<{
    id: number;
    text: string;
    badgeColor: string;
    href: string;
    category: string;
    urgency?: "Urgent" | "Action" | "Review" | "Warning" | "Notice" | "Optimal" | string;
  }>;
  sectionAttendance: Array<{
    department: string;
    sections: number;
    attendance: number;
    fill: string;
    label: string;
    slot?: string;
    slotLabel?: string;
    totalClasses?: number;
    postedClasses?: number;
  }>;
  slotAttendance?: Array<{
    slot: string;
    slotLabel?: string;
    slotOrder?: number;
    timing?: string;
    department?: string;
    sections?: number;
    totalClasses?: number;
    postedClasses?: number;
    pendingClasses?: number;
    totalPresent?: number;
    totalMarked?: number;
    totalAbsent?: number;
    attendance: number;
    fill: string;
    label: string;
    departments?: Array<{
      branchId: number;
      branchCode: string;
      branchName: string;
      totalClasses: number;
      postedClasses: number;
      presentCount: number;
      markedCount: number;
      attendancePct: number;
    }>;
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
      permission?: number;
      absent: number;
      totalTeachingFaculty?: number;
      totalEmployees?: number;
    };
    classesAffected: {
      total: number;
      adjusted: number;
      substitute: number;
      cancelled: number;
      pending: number;
    };
    employeeWiseDetails?: Array<{
      staffLinkId?: number;
      empNo: string;
      name: string;
      department: string;
      designation: string;
      employeeGroup: string;
      isTeaching?: boolean;
      division: string;
      status: "present" | "late" | "leave" | "od" | "permission" | "absent";
      displayStatus: string;
      thumbStatus: "active" | "partial" | "full" | "none";
      checkInTime: string | null;
      checkOutTime: string | null;
      lateMinutes: number;
      slotsCount?: number;
      slotsPosted?: number;
      slotsPending?: number;
      slots?: Array<{
        id: number;
        subjectName: string;
        subjectCode: string | null;
        startTime: string | null;
        endTime: string | null;
        status: string;
        isPosted: boolean;
      }>;
      subjects?: string[];
      details: string | null;
    }>;
    hrmsLeaves?: Array<{
      id: string;
      empNo: string;
      employeeName: string;
      department: string;
      leaveType: string;
      fromDate: string;
      toDate: string;
      numberOfDays: number;
      purpose: string;
      status: string;
    }>;
    hrmsOds?: Array<{
      id: string;
      empNo: string;
      employeeName: string;
      department: string;
      odType: string;
      fromDate: string;
      toDate: string;
      purpose: string;
      placeVisited?: string;
      status: string;
    }>;
    hrmsPermissions?: Array<{
      id: string;
      empNo: string;
      employeeName: string;
      department: string;
      date: string;
      hours: number;
      reason?: string;
      status: string;
    }>;
  };
  feeCollectionAndDues: {
    percentage: number | null;
    collectedAmount: string | null;
    totalAmount: string | null;
    statusText?: string | null;
    pendingDues: Array<{
      label: string;
      studentsCount: number | null;
      amount: string | null;
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
    pendingApprovalDetails?: Array<{
      id: string;
      category: "leave" | "od" | "ccl" | "general";
      categoryLabel: string;
      subType: string;
      empNo: string;
      employeeName: string;
      department: string;
      designation: string;
      fromDate: string;
      toDate: string;
      numberOfDays: number;
      purpose: string;
      placeVisited?: string;
      status: string;
      statusLabel: string;
      appliedAt: string;
      slotsImpacted?: number;
    }>;
    upcomingDeadlines: Array<{
      day: string;
      month: string;
      title: string;
      subtitle: string;
      startDate?: string;
      endDate?: string;
    }>;
    allTimePendingCount?: number;
    dateRangeLabel?: string;
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
  const [selectedSlotData, setSelectedSlotData] = useState<any | null>(null);
  const [approvalTab, setApprovalTab] = useState<"approvals" | "deadlines" | "leaves_ods">("deadlines");
  const [facultyModalTab, setFacultyModalTab] = useState<"employees" | "leaves" | "ods" | "permissions" | "adjustments">("employees");
  const [empStatusFilter, setEmpStatusFilter] = useState<"all" | "present" | "late" | "leave" | "od" | "permission" | "absent">("all");
  const [empGroupFilter, setEmpGroupFilter] = useState<"all" | "teaching" | "non_teaching">("all");
  const [empSlotFilter, setEmpSlotFilter] = useState<"all" | "has_slots" | "no_slots">("all");
  const [empSearchQuery, setEmpSearchQuery] = useState("");
  const [pendingCategoryFilter, setPendingCategoryFilter] = useState<"all" | "leave" | "od" | "ccl" | "general">("all");
  const [pendingSearchQuery, setPendingSearchQuery] = useState("");
  const [overviewYearFilter, setOverviewYearFilter] = useState<number | "all">("all");
  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>({});
  const [deptPage, setDeptPage] = useState(1);
  const DEPT_PAGE_SIZE = 5;

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
    if (filters.startDate) params.set("startDate", filters.startDate);
    if (filters.endDate) params.set("endDate", filters.endDate);
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

  // Filtered employees for HRMS employee-wise attendance view (Classes/Slots assigned)
  const filteredEmployees = useMemo(() => {
    const list = current?.facultyAttendanceAndAdjustment?.employeeWiseDetails || [];
    return list.filter((emp) => {
      if (empStatusFilter !== "all") {
        if (empStatusFilter === "present" && emp.status !== "present" && emp.status !== "late") return false;
        if (empStatusFilter !== "present" && emp.status !== empStatusFilter) return false;
      }
      if (empGroupFilter === "teaching" && !emp.isTeaching) return false;
      if (empGroupFilter === "non_teaching" && emp.isTeaching) return false;
      if (empSlotFilter === "has_slots" && (!emp.slotsCount || emp.slotsCount === 0)) return false;
      if (empSlotFilter === "no_slots" && (emp.slotsCount && emp.slotsCount > 0)) return false;
      if (empSearchQuery.trim()) {
        const q = empSearchQuery.toLowerCase().trim();
        const matchesName = emp.name.toLowerCase().includes(q);
        const matchesNo = emp.empNo.toLowerCase().includes(q);
        const matchesDept = emp.department.toLowerCase().includes(q);
        const matchesDesig = emp.designation.toLowerCase().includes(q);
        const matchesSubj = emp.subjects?.some((s) => s.toLowerCase().includes(q));
        if (!matchesName && !matchesNo && !matchesDept && !matchesDesig && !matchesSubj) return false;
      }
      return true;
    });
  }, [current?.facultyAttendanceAndAdjustment?.employeeWiseDetails, empStatusFilter, empGroupFilter, empSlotFilter, empSearchQuery]);

  // Filtered pending approvals from HRMS
  const filteredPendingApprovals = useMemo(() => {
    const list = current?.approvalsAndDeadlines?.pendingApprovalDetails || [];
    return list.filter((item) => {
      if (pendingCategoryFilter !== "all" && item.category !== pendingCategoryFilter) return false;
      if (pendingSearchQuery.trim()) {
        const q = pendingSearchQuery.toLowerCase().trim();
        const matchesName = item.employeeName.toLowerCase().includes(q);
        const matchesNo = item.empNo.toLowerCase().includes(q);
        const matchesDept = item.department.toLowerCase().includes(q);
        const matchesPurpose = item.purpose.toLowerCase().includes(q);
        const matchesType = item.subType.toLowerCase().includes(q);
        const matchesPlace = item.placeVisited ? item.placeVisited.toLowerCase().includes(q) : false;
        if (!matchesName && !matchesNo && !matchesDept && !matchesPurpose && !matchesType && !matchesPlace) return false;
      }
      return true;
    });
  }, [current?.approvalsAndDeadlines?.pendingApprovalDetails, pendingCategoryFilter, pendingSearchQuery]);

  // Reset department overview page when year filter changes
  useEffect(() => {
    setDeptPage(1);
  }, [overviewYearFilter]);

  const totalDeptPages = useMemo(() => {
    const total = current?.departmentOverview?.length || 0;
    return Math.max(1, Math.ceil(total / DEPT_PAGE_SIZE));
  }, [current?.departmentOverview?.length]);

  const paginatedDepartments = useMemo(() => {
    const list = current?.departmentOverview || [];
    const start = (deptPage - 1) * DEPT_PAGE_SIZE;
    return list.slice(start, start + DEPT_PAGE_SIZE);
  }, [current?.departmentOverview, deptPage]);

  if (loading) {
    return <PrincipalDashboardSkeleton />;
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
            {(current.kpis.feeCollection.value === null || current.kpis.feeCollection.value === "null") && (
              <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                Pending
              </span>
            )}
          </div>
          <span className="text-xs font-medium text-slate-500 block">Fee Collection</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {current.kpis.feeCollection.value != null ? current.kpis.feeCollection.value : "null"}
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
            {(current.kpis.placement.value === null || current.kpis.placement.value === "null") && (
              <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                Pending
              </span>
            )}
          </div>
          <span className="text-xs font-medium text-slate-500 block">Placement (Eligible)</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {current.kpis.placement.value != null ? current.kpis.placement.value : "null"}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {current.kpis.placement.subtext}
          </span>
        </div>

      </div>

      {/* 3. MIDDLE SECTION: DEPARTMENT ACADEMIC OVERVIEW & TODAY'S PRIORITIES */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left: Department Academic Overview (7 cols, compact space matching Priorities) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                    Department Academic Overview
                  </h2>
                  <span className="text-[11px] text-slate-400 block">
                    Semester metrics across academic years &amp; batches
                  </span>
                </div>
              </div>

              {/* Year Filter Pills, Expand All, & View All */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    const allExpanded = current.departmentOverview.every(
                      (d) => expandedDepts[d.department]
                    );
                    const next: Record<string, boolean> = {};
                    current.departmentOverview.forEach((d) => {
                      next[d.department] = !allExpanded;
                    });
                    setExpandedDepts(next);
                  }}
                  className="text-[11px] font-semibold text-slate-500 hover:text-blue-600 px-2 py-0.5 rounded-md border border-slate-200/80 hover:border-blue-200 bg-white hover:bg-slate-50 transition cursor-pointer shadow-2xs"
                  title="Toggle all department year breakdowns"
                >
                  {current.departmentOverview.every((d) => expandedDepts[d.department])
                    ? "Collapse All"
                    : "Expand All"}
                </button>

                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
                  {[
                    { label: "All Years", value: "all" },
                    { label: "I Yr", value: 1 },
                    { label: "II Yr", value: 2 },
                    { label: "III Yr", value: 3 },
                    { label: "IV Yr", value: 4 },
                  ].map((tab) => (
                    <button
                      key={tab.label}
                      type="button"
                      onClick={() => setOverviewYearFilter(tab.value as any)}
                      className={`px-2 py-0.5 rounded-md transition-all cursor-pointer text-[11px] ${
                        overviewYearFilter === tab.value
                          ? "bg-white text-blue-700 shadow-xs font-bold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setActiveModal("dept_overview")}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer ml-1"
                >
                  View All &gt;
                </button>
              </div>
            </div>

            {/* Compact Table Container (Zero internal vertical scroll) */}
            <div className="overflow-x-auto mt-2.5 rounded-lg border border-slate-100">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-500 font-semibold border-b border-slate-200/80 bg-slate-50/60">
                    <th className="py-2.5 font-medium">Department / Years</th>
                    <th className="py-2.5 font-medium">Student Attendance</th>
                    <th className="py-2.5 font-medium">Faculty Attendance</th>
                    <th className="py-2.5 font-medium">Internal Pass % (I / II)</th>
                    <th className="py-2.5 text-center font-medium">Subjects Behind</th>
                    <th className="py-2.5 text-center font-medium">Risk Students</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/70">
                  {paginatedDepartments.map((row) => {
                    const isExpanded = Boolean(expandedDepts[row.department]);
                    const hasYears = Boolean(row.yearBreakdown && row.yearBreakdown.length > 0);

                    // When filtered by specific year (e.g. Year 2)
                    const yearData =
                      overviewYearFilter !== "all"
                        ? row.yearBreakdown?.find((y) => y.year === overviewYearFilter)
                        : null;

                    const displayStuAtt = yearData ? yearData.studentAttendance : row.studentAttendance;
                    const displayFacAtt = yearData ? yearData.facultyAttendance : row.facultyAttendance;
                    const displayPassPct = yearData ? yearData.internalPassPct : row.internalPassPct;
                    const displayBehind = yearData ? yearData.subjectsBehind : row.subjectsBehind;
                    const displayRisk = yearData ? yearData.riskStudents : row.riskStudents;

                    const toggleExpand = () => {
                      if (hasYears) {
                        setExpandedDepts((prev) => ({
                          ...prev,
                          [row.department]: !prev[row.department],
                        }));
                      }
                    };

                    return (
                      <Fragment key={row.department}>
                        <tr
                          onClick={toggleExpand}
                          className={`transition-colors group cursor-pointer ${
                            isExpanded ? "bg-blue-50/30 hover:bg-blue-50/50" : "hover:bg-slate-50/70"
                          }`}
                          title={
                            hasYears
                              ? isExpanded
                                ? "Click to collapse year breakdown"
                                : "Click to drop down year breakdown"
                              : undefined
                          }
                        >
                          <td className="py-2.5 pr-2">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpand();
                                }}
                                className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-md transition-all text-left cursor-pointer group/dept ${
                                  isExpanded
                                    ? "bg-blue-100/80 text-blue-800 font-bold ring-1 ring-blue-300/60"
                                    : "hover:bg-slate-100 text-slate-800 font-bold"
                                }`}
                              >
                                <span className="text-xs sm:text-sm group-hover/dept:text-blue-600 transition-colors">
                                  {row.department}
                                </span>
                                {hasYears && (
                                  <ChevronDown
                                    className={`h-3.5 w-3.5 transition-transform duration-200 ${
                                      isExpanded
                                        ? "rotate-180 text-blue-600"
                                        : "text-slate-400 group-hover/dept:text-blue-600"
                                    }`}
                                  />
                                )}
                              </button>
                            </div>
                            {row.years && row.years.length > 0 ? (
                              <div className="flex items-center gap-1 mt-0.5 flex-wrap pl-1.5">
                                <span className="text-[10px] text-slate-500 font-medium">
                                  {overviewYearFilter === "all"
                                    ? `Yrs: ${row.years.join(", ")}`
                                    : `Yr ${overviewYearFilter}`}
                                </span>
                                {row.batches && (
                                  <span className="text-[10px] text-slate-400">
                                    · Batches: {row.batches}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="pl-1.5 mt-0.5">
                                <span className="text-[10px] text-slate-400 italic">
                                  No active regular batches
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Student Attendance */}
                          <td className="py-2.5">
                            <span
                              className={`font-bold ${
                                displayStuAtt === "null" || isNaN(parseInt(displayStuAtt))
                                  ? "text-slate-400 font-normal"
                                  : parseInt(displayStuAtt) < 65
                                  ? "text-rose-600"
                                  : parseInt(displayStuAtt) < 75
                                  ? "text-amber-600"
                                  : "text-emerald-600"
                              }`}
                            >
                              {displayStuAtt === "null" ? "—" : displayStuAtt}
                            </span>
                          </td>

                          {/* Faculty Attendance */}
                          <td className="py-2.5 font-semibold text-slate-700">
                            <span
                              className={
                                displayFacAtt === "null" || isNaN(parseInt(displayFacAtt))
                                  ? "text-slate-400 font-normal"
                                  : parseInt(displayFacAtt) >= 80
                                  ? "text-emerald-600 font-bold"
                                  : ""
                              }
                            >
                              {displayFacAtt === "null" ? "—" : displayFacAtt}
                            </span>
                          </td>

                          {/* Internal Pass % */}
                          <td className="py-2.5 font-medium text-slate-600">
                            {displayPassPct === "null" ? (
                              <span className="text-slate-400 font-normal italic text-[11px]">
                                —
                              </span>
                            ) : (
                              <span className="font-bold text-slate-800">{displayPassPct}</span>
                            )}
                          </td>

                          {/* Subjects Behind */}
                          <td className="py-2.5 text-center">
                            <span
                              className={`font-bold ${
                                displayBehind >= 3 ? "text-rose-600" : "text-slate-700"
                              }`}
                            >
                              {displayBehind}
                            </span>
                          </td>

                          {/* Risk Students */}
                          <td className="py-2.5 text-center font-bold text-rose-600">
                            {displayRisk}
                          </td>
                        </tr>

                        {/* Expandable Year-wise Breakdown Sub-Rows */}
                        {isExpanded && row.yearBreakdown && (
                          row.yearBreakdown.map((yr) => (
                            <tr
                              key={`${row.department}-yr-${yr.year}`}
                              className={`text-[11px] border-l-2 border-l-blue-500 transition-colors ${
                                overviewYearFilter === yr.year
                                  ? "bg-blue-50/80 font-medium"
                                  : "bg-slate-50/70 hover:bg-slate-100/60"
                              }`}
                            >
                              <td className="py-2 pl-7 pr-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-800">
                                    {yr.yearLabel}
                                  </span>
                                  {yr.batches && (
                                    <span className="text-[10px] text-slate-400">
                                      ({yr.batches})
                                    </span>
                                  )}
                                  <span className="text-[10px] bg-slate-200/70 text-slate-600 px-1.5 py-0.2 rounded font-medium">
                                    {yr.students} students
                                  </span>
                                </div>
                              </td>

                              <td className="py-2">
                                <span
                                  className={`font-semibold ${
                                    yr.studentAttendance === "null" || isNaN(parseInt(yr.studentAttendance))
                                      ? "text-slate-400 font-normal"
                                      : parseInt(yr.studentAttendance) < 65
                                      ? "text-rose-600"
                                      : parseInt(yr.studentAttendance) < 75
                                      ? "text-amber-600"
                                      : "text-emerald-600"
                                  }`}
                                >
                                  {yr.studentAttendance === "null" ? "—" : yr.studentAttendance}
                                </span>
                              </td>

                              <td className="py-2 font-medium text-slate-600">
                                {yr.facultyAttendance === "null" ? "—" : yr.facultyAttendance}
                              </td>

                              <td className="py-2 text-slate-400 italic text-[10px]">
                                {yr.internalPassPct === "null" ? "—" : yr.internalPassPct}
                              </td>

                              <td className="py-2 text-center font-medium text-slate-700">
                                {yr.subjectsBehind}
                              </td>

                              <td className="py-2 text-center font-bold text-rose-600">
                                {yr.riskStudents}
                              </td>
                            </tr>
                          ))
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Department Footer / Status with Pagination */}
            <div className="pt-3 mt-auto border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="text-[11px] text-slate-400 font-medium">
                Showing {(deptPage - 1) * DEPT_PAGE_SIZE + 1}–{Math.min(deptPage * DEPT_PAGE_SIZE, current.departmentOverview.length)} of {current.departmentOverview.length} Departments
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={deptPage <= 1}
                  onClick={() => setDeptPage((p) => Math.max(1, p - 1))}
                  className="px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
                  title="Previous page"
                >
                  &larr; Prev
                </button>
                <span className="text-[11px] font-bold text-slate-700 px-1">
                  {deptPage} / {totalDeptPages}
                </span>
                <button
                  type="button"
                  disabled={deptPage >= totalDeptPages}
                  onClick={() => setDeptPage((p) => Math.min(totalDeptPages, p + 1))}
                  className="px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
                  title="Next page"
                >
                  Next &rarr;
                </button>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal("dept_overview")}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
              >
                Full Overview ({current.departmentOverview.length}) &gt;
              </button>
            </div>
          </div>
        </div>

        {/* Right: Today's Priorities (5 cols, matching height) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex flex-col h-full justify-between">
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

            {/* List of priority action items (Clean without internal vertical scrolling) */}
            <div className="mt-2.5 space-y-2">
              {current.priorities.slice(0, 5).map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-start justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors group cursor-pointer border border-transparent hover:border-slate-200/80"
                >
                  <div className="flex items-start gap-2.5 min-w-0 pr-1">
                    <span
                      className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5 shadow-2xs ${item.badgeColor}`}
                    >
                      {item.id}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        {item.urgency && (
                          <span
                            className={`text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.2 rounded shrink-0 ${
                              item.urgency === "Urgent"
                                ? "bg-red-100 text-red-700"
                                : item.urgency === "Action"
                                ? "bg-rose-100 text-rose-700"
                                : item.urgency === "Warning"
                                ? "bg-amber-100 text-amber-700"
                                : item.urgency === "Review"
                                ? "bg-orange-100 text-orange-700"
                                : item.urgency === "Optimal"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {item.urgency}
                          </span>
                        )}
                        <span className="text-xs text-slate-800 font-semibold group-hover:text-blue-600 transition-colors leading-snug">
                          {item.text}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5 ml-1" />
                </Link>
              ))}
            </div>

            {/* Priorities Footer / Status */}
            <div className="pt-3 mt-auto border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span>{current.priorities.length} Action Items Pending</span>
              <button
                type="button"
                onClick={() => setActiveModal("priorities")}
                className="font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
              >
                View All &gt;
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* 4. LOWER ROW 1: 3 CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* Card 1: Student Attendance (Slot Wise) */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-4 sm:p-4.5 flex flex-col justify-between h-[285px]">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                  Student Attendance
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
            <div className="h-44 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={(current.slotAttendance || current.sectionAttendance) as any[]}
                  margin={{ top: 20, right: 10, left: -20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey={(current.slotAttendance && current.slotAttendance.length > 0) ? "slot" : "department"}
                    tickLine={false}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    tickFormatter={(val) => `${val}`}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 10 }}
                    ticks={[0, 25, 50, 75, 100]}
                  />
                  <Tooltip
                    formatter={(value: any, _name: any, item: any) => {
                      const payload = item?.payload;
                      const sub = payload?.totalClasses != null
                        ? ` (${payload.postedClasses || 0}/${payload.totalClasses} posted)`
                        : payload?.sections != null
                        ? ` (${payload.sections} sections)`
                        : "";
                      return [`${value}%${sub}`, "Attendance"];
                    }}
                    contentStyle={{ borderRadius: "8px", fontSize: "12px", border: "1px solid #e2e8f0" }}
                  />
                  <Bar
                    dataKey="attendance"
                    radius={[4, 4, 0, 0]}
                    barSize={34}
                    cursor="pointer"
                    onClick={(entry: any) => {
                      if (entry) setSelectedSlotData(entry.payload || entry);
                    }}
                  >
                    <LabelList
                      dataKey="label"
                      position="top"
                      style={{ fill: "#1e293b", fontSize: 12, fontWeight: 700 }}
                    />
                    {(current.slotAttendance || current.sectionAttendance).map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.fill}
                        cursor="pointer"
                        className="hover:opacity-80 transition-opacity"
                        onClick={() => setSelectedSlotData(entry)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-slate-400 text-center mt-1 font-medium">
              Click any bar to view detailed slot metrics
            </p>
          </div>
        </div>

        {/* Card 2: Students at Risk (Department Wise) */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-4 sm:p-4.5 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
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

          <div className="overflow-x-auto mt-2 flex-1">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white z-10 shadow-2xs">
                <tr className="text-slate-400 border-b border-slate-100 font-medium">
                  <th className="py-2 bg-white">Department</th>
                  <th className="py-2 text-center bg-white">&lt; 65% Att.</th>
                  <th className="py-2 text-center bg-white">Failed Int-I</th>
                  <th className="py-2 text-center bg-white">Failed Int-II</th>
                  <th className="py-2 text-center bg-white">Failed Both</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/60">
                {current.studentsAtRiskDeptWise.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400 font-medium">
                      No departments currently have students flagged at risk
                    </td>
                  </tr>
                ) : (
                  current.studentsAtRiskDeptWise.slice(0, 5).map((r) => (
                    <tr key={r.department} className="hover:bg-slate-50/50">
                      <td className="py-2 font-bold text-slate-800">{r.department}</td>
                      <td className="py-2 text-center font-bold text-rose-600">{r.below65Attendance}</td>
                      <td className="py-2 text-center text-slate-600">{r.failedInternal1}</td>
                      <td className="py-2 text-center text-slate-600">{r.failedInternal2}</td>
                      <td className="py-2 text-center font-bold text-rose-600">{r.failedBoth}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Card 3: Subjects Behind Schedule */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-4 sm:p-4.5 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
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

          <div className="overflow-x-auto mt-2 flex-1">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white z-10 shadow-2xs">
                <tr className="text-slate-400 border-b border-slate-100 font-medium">
                  <th className="py-2 bg-white">Subject</th>
                  <th className="py-2 bg-white">Faculty</th>
                  <th className="py-2 bg-white">Dept</th>
                  <th className="py-2 text-center bg-white">Delay</th>
                  <th className="py-2 text-center bg-white">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/60">
                {current.subjectsBehindSchedule.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400 font-medium">
                      All subjects on track with scheduled syllabus delivery
                    </td>
                  </tr>
                ) : (
                  current.subjectsBehindSchedule.slice(0, 5).map((s, idx) => (
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
                  ))
                )}
              </tbody>
            </table>
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
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-center mt-3">
              <div className="bg-emerald-50/70 border border-emerald-100/80 p-2 rounded-lg">
                <span className="text-[10px] text-slate-500 block font-medium">Present</span>
                <span className="text-sm sm:text-base font-extrabold text-emerald-600">
                  {current.facultyAttendanceAndAdjustment.facultyStatus.present}
                </span>
              </div>
              <div className="bg-amber-50/70 border border-amber-100/80 p-2 rounded-lg">
                <span className="text-[10px] text-slate-500 block font-medium">Late</span>
                <span className="text-sm sm:text-base font-extrabold text-amber-500">
                  {current.facultyAttendanceAndAdjustment.facultyStatus.late}
                </span>
              </div>
              <div className="bg-rose-50/70 border border-rose-100/80 p-2 rounded-lg">
                <span className="text-[10px] text-slate-500 block font-medium">Leave</span>
                <span className="text-sm sm:text-base font-extrabold text-rose-500">
                  {current.facultyAttendanceAndAdjustment.facultyStatus.leave}
                </span>
              </div>
              <div className="bg-purple-50/70 border border-purple-100/80 p-2 rounded-lg">
                <span className="text-[10px] text-slate-500 block font-medium">OD</span>
                <span className="text-sm sm:text-base font-extrabold text-purple-600">
                  {current.facultyAttendanceAndAdjustment.facultyStatus.od}
                </span>
              </div>
              <div className="bg-blue-50/70 border border-blue-100/80 p-2 rounded-lg">
                <span className="text-[10px] text-slate-500 block font-medium">Permission</span>
                <span className="text-sm sm:text-base font-extrabold text-blue-600">
                  {current.facultyAttendanceAndAdjustment.facultyStatus.permission ?? 0}
                </span>
              </div>
              <div className="bg-slate-50/80 border border-slate-200/80 p-2 rounded-lg">
                <span className="text-[10px] text-slate-500 block font-medium">Absent</span>
                <span className="text-sm sm:text-base font-extrabold text-rose-600">
                  {current.facultyAttendanceAndAdjustment.facultyStatus.absent}
                </span>
              </div>
            </div>

            {/* Quick Button: Employee-Wise Details */}
            {current.facultyAttendanceAndAdjustment.employeeWiseDetails && current.facultyAttendanceAndAdjustment.employeeWiseDetails.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setFacultyModalTab("employees");
                  setActiveModal("faculty_adjustment");
                }}
                className="mt-3 w-full py-1.5 px-2.5 bg-blue-50/80 hover:bg-blue-100/80 border border-blue-200/70 rounded-lg flex items-center justify-between text-xs font-semibold text-blue-700 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Employee-Wise Attendance ({current.facultyAttendanceAndAdjustment.employeeWiseDetails.length})</span>
                </div>
                <span className="text-[10px] text-blue-600 font-bold flex items-center gap-0.5">
                  View Live Thumbs &rarr;
                </span>
              </button>
            )}

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
                    className={current.feeCollectionAndDues.percentage != null ? "text-emerald-500" : "text-slate-200"}
                    strokeDasharray={
                      current.feeCollectionAndDues.percentage != null
                        ? `${current.feeCollectionAndDues.percentage}, 100`
                        : "0, 100"
                    }
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span className="absolute font-black text-xs sm:text-sm text-slate-700">
                  {current.feeCollectionAndDues.percentage != null ? `${current.feeCollectionAndDues.percentage}%` : "null"}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-medium text-slate-500 block">Collected</span>
                <span className="text-xl font-extrabold text-slate-900 tracking-tight block">
                  {current.feeCollectionAndDues.collectedAmount != null
                    ? current.feeCollectionAndDues.collectedAmount
                    : "null"}
                </span>
                <span className="text-xs text-slate-400 block">
                  {current.feeCollectionAndDues.totalAmount != null
                    ? `of ${current.feeCollectionAndDues.totalAmount}`
                    : "of null"}
                </span>
              </div>
            </div>

            {/* Pending Dues Section */}
            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-slate-600 block">
                  Pending Dues (No. of Students)
                </span>
                <span className="text-[10px] font-medium text-slate-400">
                  Fee portal pending
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {current.feeCollectionAndDues.pendingDues.map((due) => (
                  <div key={due.label} className={`${due.bg} p-2 rounded-lg border border-slate-100`}>
                    <span className="text-[10px] text-slate-500 block">{due.label}</span>
                    <span className={`text-sm font-extrabold block ${due.color}`}>
                      {due.studentsCount != null ? due.studentsCount : "null"}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium block">
                      {due.amount != null ? due.amount : "null"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <span className="text-[11px] text-slate-400 italic">
                Fee portal module integration pending
              </span>
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
            <div className="flex items-center gap-3 border-b border-slate-100 mt-2 text-xs font-semibold">
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
                onClick={() => setApprovalTab("leaves_ods")}
                className={`pb-2 transition-colors cursor-pointer ${
                  approvalTab === "leaves_ods"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                HRMS Leaves &amp; ODs
              </button>
            </div>

            {/* Tab 1: Upcoming Deadlines Content */}
            {approvalTab === "deadlines" && (
              <div className="mt-3 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium pb-0.5">
                  <span className="flex items-center gap-1 text-slate-600">
                    <Calendar className="h-3 w-3 text-purple-600" />
                    Within: <strong className="text-slate-800">{current.approvalsAndDeadlines.dateRangeLabel || current.meta.dateFormatted}</strong>
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {current.approvalsAndDeadlines.upcomingDeadlines.length} deadline{current.approvalsAndDeadlines.upcomingDeadlines.length === 1 ? "" : "s"}
                  </span>
                </div>
                {current.approvalsAndDeadlines.upcomingDeadlines.length === 0 ? (
                  <div className="text-xs text-slate-400 text-center py-4 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                    No examination deadlines within {current.approvalsAndDeadlines.dateRangeLabel || current.meta.dateFormatted}
                  </div>
                ) : (
                  current.approvalsAndDeadlines.upcomingDeadlines.slice(0, 4).map((dl, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 py-1 text-xs">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 font-bold flex flex-col items-center justify-center shrink-0 border border-blue-100">
                        <span className="text-xs leading-none">{dl.day}</span>
                        <span className="text-[9px] uppercase leading-none mt-0.5">{dl.month}</span>
                      </div>
                      <div className="min-w-0 pr-1">
                        <span className="font-bold text-slate-800 block truncate">{dl.title}</span>
                        <span className="text-[11px] text-slate-400 block truncate">
                          {dl.subtitle} {dl.startDate && dl.endDate ? "• " + dl.startDate + " to " + dl.endDate : ""}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab 2: Pending Approvals Content */}
            {approvalTab === "approvals" && (
              <div className="mt-3 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium pb-0.5">
                  <span className="flex items-center gap-1 text-slate-600">
                    <Calendar className="h-3 w-3 text-blue-600" />
                    Dates in: <strong className="text-slate-800">{current.approvalsAndDeadlines.dateRangeLabel || current.meta.dateFormatted}</strong>
                  </span>
                  {current.approvalsAndDeadlines.allTimePendingCount != null && (
                    <span className="text-[10px] text-slate-400 font-medium">
                      ({current.approvalsAndDeadlines.allTimePendingCount} total all-time)
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                  {current.approvalsAndDeadlines.pendingApprovals.slice(0, 3).map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        const parts = item.href.split(":");
                        if (parts[1] === "approvals_deadlines" && parts[2]) {
                          setPendingCategoryFilter(parts[2] as any);
                        }
                        setActiveModal("approvals_deadlines");
                      }}
                      className="p-2 rounded-lg bg-slate-50 hover:bg-blue-50/60 border border-slate-100 hover:border-blue-200 transition-all text-left cursor-pointer group"
                    >
                      <span className="text-[10px] text-slate-500 block truncate font-medium group-hover:text-blue-700">
                        {item.label}
                      </span>
                      <span className="text-sm font-extrabold text-slate-900 block group-hover:text-blue-600">
                        {item.count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Preview of top HRMS pending requests */}
                {current.approvalsAndDeadlines.pendingApprovalDetails && current.approvalsAndDeadlines.pendingApprovalDetails.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                      <span>Live HRMS Requests</span>
                      <button
                        type="button"
                        onClick={() => {
                          setPendingCategoryFilter("all");
                          setActiveModal("approvals_deadlines");
                        }}
                        className="text-blue-600 hover:text-blue-700 font-bold text-[10px] cursor-pointer"
                      >
                        View All ({current.approvalsAndDeadlines.pendingApprovalDetails.length}) &rarr;
                      </button>
                    </div>
                    {current.approvalsAndDeadlines.pendingApprovalDetails.slice(0, 3).map((req) => (
                      <div
                        key={req.id}
                        onClick={() => {
                          setPendingCategoryFilter(req.category);
                          setActiveModal("approvals_deadlines");
                        }}
                        className="p-2 rounded-lg bg-slate-50/70 hover:bg-slate-100/70 border border-slate-100 text-xs flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 truncate">{req.employeeName}</span>
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                              req.category === "leave" ? "bg-rose-100 text-rose-700" : req.category === "od" ? "bg-purple-100 text-purple-700" : "bg-sky-100 text-sky-700"
                            }`}>
                              {req.subType}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 block truncate">
                            {req.department} &bull; {req.purpose} &bull; {req.fromDate === req.toDate ? req.fromDate : `${req.fromDate} - ${req.toDate}`}
                          </span>
                        </div>
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          {req.statusLabel}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: HRMS Leaves & ODs Content */}
            {approvalTab === "leaves_ods" && (
              <div className="mt-3 space-y-2">
                {(!current.facultyAttendanceAndAdjustment.hrmsLeaves || current.facultyAttendanceAndAdjustment.hrmsLeaves.length === 0) &&
                 (!current.facultyAttendanceAndAdjustment.hrmsOds || current.facultyAttendanceAndAdjustment.hrmsOds.length === 0) ? (
                  <div className="text-xs text-slate-400 text-center py-4">No leaves or ODs recorded for today</div>
                ) : (
                  <>
                    {current.facultyAttendanceAndAdjustment.hrmsLeaves?.slice(0, 3).map((l) => (
                      <div
                        key={l.id}
                        onClick={() => {
                          setFacultyModalTab("leaves");
                          setActiveModal("faculty_adjustment");
                        }}
                        className="p-2 rounded-lg bg-rose-50/40 border border-rose-100 flex items-center justify-between text-xs cursor-pointer hover:bg-rose-50"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="font-semibold text-slate-800 block truncate">{l.employeeName}</span>
                          <span className="text-[11px] text-slate-500 block truncate">{l.department} &bull; {l.purpose}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 shrink-0">
                          {l.leaveType} ({l.numberOfDays}d)
                        </span>
                      </div>
                    ))}
                    {current.facultyAttendanceAndAdjustment.hrmsOds?.slice(0, 2).map((o) => (
                      <div
                        key={o.id}
                        onClick={() => {
                          setFacultyModalTab("ods");
                          setActiveModal("faculty_adjustment");
                        }}
                        className="p-2 rounded-lg bg-purple-50/40 border border-purple-100 flex items-center justify-between text-xs cursor-pointer hover:bg-purple-50"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="font-semibold text-slate-800 block truncate">{o.employeeName}</span>
                          <span className="text-[11px] text-slate-500 block truncate">{o.department} &bull; {o.placeVisited || o.purpose}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 shrink-0">
                          OD ({o.odType})
                        </span>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setFacultyModalTab("leaves");
                        setActiveModal("faculty_adjustment");
                      }}
                      className="w-full text-center text-xs font-semibold text-blue-600 hover:text-blue-700 py-1 cursor-pointer"
                    >
                      View All Leaves &amp; ODs &gt;
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* MODAL: VIEW ALL DETAILS */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in">
          <div className={`bg-white rounded-2xl ${
            activeModal === "faculty_adjustment" || activeModal === "approvals_deadlines" || activeModal === "dept_overview"
              ? "max-w-7xl w-[96vw] h-[92vh] max-h-[92vh]"
              : "max-w-2xl max-h-[88vh] overflow-y-auto"
          } w-full p-4 sm:p-6 shadow-2xl border border-slate-200 flex flex-col overflow-hidden`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <h3 className="text-base font-bold text-slate-900">
                {activeModal === "dept_overview" && "Department Academic Overview (Full)"}
                {activeModal === "priorities" && "All Priorities & Action Items"}
                {activeModal === "section_att" && "Student Attendance (Slot-wise Breakdown)"}
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

            <div className={`py-4 ${
              activeModal === "faculty_adjustment" || activeModal === "approvals_deadlines" || activeModal === "dept_overview"
                ? "flex-1 min-h-0 flex flex-col overflow-hidden"
                : ""
            }`}>
              {activeModal === "priorities" && (
                <div className="space-y-2.5">
                  <div className="text-xs text-slate-500 mb-2">
                    Action items requiring principal or vice-principal attention, ordered by operational urgency:
                  </div>
                  {current.priorities.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => setActiveModal(null)}
                      className="flex items-start justify-between p-3.5 rounded-xl border border-slate-200/90 hover:border-blue-500 hover:bg-blue-50/20 transition-all group cursor-pointer"
                    >
                      <div className="flex items-start gap-3 min-w-0 pr-2">
                        <span
                          className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-black shrink-0 mt-0.5 shadow-2xs ${item.badgeColor}`}
                        >
                          {item.id}
                        </span>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            {item.urgency && (
                              <span
                                className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded ${
                                  item.urgency === "Urgent"
                                    ? "bg-red-100 text-red-700"
                                    : item.urgency === "Action"
                                    ? "bg-rose-100 text-rose-700"
                                    : item.urgency === "Warning"
                                    ? "bg-amber-100 text-amber-700"
                                    : item.urgency === "Review"
                                    ? "bg-orange-100 text-orange-700"
                                    : item.urgency === "Optimal"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {item.urgency}
                              </span>
                            )}
                            <span className="text-[11px] text-slate-400 capitalize">
                              Category: {item.category.replace(/_/g, " ")}
                            </span>
                          </div>
                          <span className="text-xs sm:text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors leading-relaxed block">
                            {item.text}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs font-semibold text-blue-600 shrink-0 mt-1 group-hover:translate-x-0.5 transition-transform">
                        <span>Open</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {activeModal === "dept_overview" && (
                <div className="flex-1 min-h-0 flex flex-col space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0">
                    <span className="text-xs text-slate-500 font-medium">
                      Click any department to drop down year-wise metrics
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const allExpanded = current.departmentOverview.every(
                          (d) => expandedDepts[d.department]
                        );
                        const next: Record<string, boolean> = {};
                        current.departmentOverview.forEach((d) => {
                          next[d.department] = !allExpanded;
                        });
                        setExpandedDepts(next);
                      }}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 px-2 py-0.5 rounded border border-blue-200 bg-blue-50/50 hover:bg-blue-50 transition cursor-pointer"
                    >
                      {current.departmentOverview.every((d) => expandedDepts[d.department])
                        ? "Collapse All"
                        : "Expand All"}
                    </button>
                  </div>

                  <div className="flex-1 min-h-0 border border-slate-200 rounded-xl overflow-y-auto overflow-x-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="sticky top-0 bg-slate-50 text-slate-600 font-semibold z-10 border-b border-slate-200 shadow-2xs">
                        <tr>
                          <th className="py-2.5 px-3">Department / Years</th>
                          <th className="py-2.5 px-3">Student Attendance</th>
                          <th className="py-2.5 px-3">Faculty Attendance</th>
                          <th className="py-2.5 px-3">Internal Pass %</th>
                          <th className="py-2.5 px-3 text-center">Behind</th>
                          <th className="py-2.5 px-3 text-center">Risk Students</th>
                        </tr>
                      </thead>
                    <tbody className="divide-y divide-slate-100">
                      {current.departmentOverview.map((row) => {
                        const isExpanded = Boolean(expandedDepts[row.department]);
                        const hasYears = Boolean(row.yearBreakdown && row.yearBreakdown.length > 0);
                        const toggleExpand = () => {
                          if (hasYears) {
                            setExpandedDepts((prev) => ({
                              ...prev,
                              [row.department]: !prev[row.department],
                            }));
                          }
                        };

                        return (
                          <Fragment key={row.department}>
                            <tr
                              onClick={toggleExpand}
                              className={`transition-colors group cursor-pointer ${
                                isExpanded ? "bg-blue-50/30 hover:bg-blue-50/50" : "hover:bg-slate-50/70"
                              }`}
                              title={
                                hasYears
                                  ? isExpanded
                                    ? "Click to collapse year breakdown"
                                    : "Click to drop down year breakdown"
                                  : undefined
                              }
                            >
                              <td className="py-2.5 font-bold text-slate-800">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleExpand();
                                    }}
                                    className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-md transition-all text-left cursor-pointer group/dept ${
                                      isExpanded
                                        ? "bg-blue-100/80 text-blue-800 font-bold ring-1 ring-blue-300/60"
                                        : "hover:bg-slate-100 text-slate-800 font-bold"
                                    }`}
                                  >
                                    <span className="text-xs sm:text-sm group-hover/dept:text-blue-600 transition-colors">
                                      {row.department}
                                    </span>
                                    {hasYears && (
                                      <ChevronDown
                                        className={`h-3.5 w-3.5 transition-transform duration-200 ${
                                          isExpanded
                                            ? "rotate-180 text-blue-600"
                                            : "text-slate-400 group-hover/dept:text-blue-600"
                                        }`}
                                      />
                                    )}
                                  </button>
                                </div>
                                {row.years && row.years.length > 0 ? (
                                  <div className="flex items-center gap-1 mt-0.5 flex-wrap pl-1.5">
                                    <span className="text-[10px] text-slate-500 font-medium">
                                      Yrs: {row.years.join(", ")}
                                    </span>
                                    {row.batches && (
                                      <span className="text-[10px] text-slate-400">
                                        · Batches: {row.batches}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="pl-1.5 mt-0.5">
                                    <span className="text-[10px] text-slate-400 italic">
                                      No active regular batches
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 font-bold text-emerald-600">
                                {row.studentAttendance === "null" ? "—" : row.studentAttendance}
                              </td>
                              <td className="py-2.5 font-semibold text-slate-700">
                                {row.facultyAttendance === "null" ? "—" : row.facultyAttendance}
                              </td>
                              <td className="py-2.5 text-slate-600">
                                {row.internalPassPct === "null" ? "—" : row.internalPassPct}
                              </td>
                              <td className="py-2.5 text-center font-bold text-rose-600">{row.subjectsBehind}</td>
                              <td className="py-2.5 text-center font-bold text-rose-600">{row.riskStudents}</td>
                            </tr>

                            {/* Modal Child Breakdown Rows */}
                            {isExpanded && row.yearBreakdown && (
                              row.yearBreakdown.map((yr) => (
                                <tr
                                  key={`${row.department}-modal-yr-${yr.year}`}
                                  className="bg-slate-50/70 text-[11px] border-l-2 border-l-blue-500 hover:bg-slate-100/60 transition-colors"
                                >
                                  <td className="py-2 pl-7 pr-2">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-800">
                                        {yr.yearLabel}
                                      </span>
                                      {yr.batches && (
                                        <span className="text-[10px] text-slate-400">
                                          ({yr.batches})
                                        </span>
                                      )}
                                      <span className="text-[10px] bg-slate-200/70 text-slate-600 px-1.5 py-0.2 rounded font-medium">
                                        {yr.students} students
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-2 font-semibold text-emerald-600">
                                    {yr.studentAttendance === "null" ? "—" : yr.studentAttendance}
                                  </td>
                                  <td className="py-2 font-medium text-slate-600">
                                    {yr.facultyAttendance === "null" ? "—" : yr.facultyAttendance}
                                  </td>
                                  <td className="py-2 text-slate-400 italic text-[10px]">
                                    {yr.internalPassPct === "null" ? "—" : yr.internalPassPct}
                                  </td>
                                  <td className="py-2 text-center font-medium text-slate-700">
                                    {yr.subjectsBehind}
                                  </td>
                                  <td className="py-2 text-center font-bold text-rose-600">
                                    {yr.riskStudents}
                                  </td>
                                </tr>
                              ))
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeModal === "subjects_behind" && (
                <div className="space-y-3">
                  {current.subjectsBehindSchedule.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 font-medium bg-slate-50 rounded-xl">
                      All subjects on track with scheduled syllabus delivery
                    </div>
                  ) : (
                    current.subjectsBehindSchedule.map((s, i) => (
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
                    ))
                  )}
                </div>
              )}

              {activeModal === "fee_dues" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>
                      The student fee management portal is currently under active development. Fee metrics are shown as <strong>null</strong> until the fee portal is fully connected.
                    </span>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-600 block">Total Fee Target</span>
                      <span className="text-xl font-black text-slate-900">
                        {current.feeCollectionAndDues.totalAmount != null ? current.feeCollectionAndDues.totalAmount : "null"}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-600 block">Total Collected</span>
                      <span className="text-xl font-black text-emerald-600">
                        {current.feeCollectionAndDues.collectedAmount != null ? current.feeCollectionAndDues.collectedAmount : "null"}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-600 block">Collection Rate</span>
                      <span className="text-xl font-black text-slate-900">
                        {current.feeCollectionAndDues.percentage != null ? `${current.feeCollectionAndDues.percentage}%` : "null"}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {current.feeCollectionAndDues.pendingDues.map((d) => (
                      <div key={d.label} className={`${d.bg} p-3 rounded-xl border border-slate-200 text-center`}>
                        <span className="text-xs text-slate-600 block font-medium">{d.label}</span>
                        <span className={`text-lg font-black block ${d.color}`}>
                          {d.studentsCount != null ? `${d.studentsCount} Students` : "null"}
                        </span>
                        <span className="text-xs font-bold text-slate-700">
                          {d.amount != null ? d.amount : "null"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeModal === "approvals_deadlines" && (
                <div className="space-y-4">
                  {/* Selected Date Range Scope Banner */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-xs">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-blue-600 shrink-0" />
                      <div>
                        <span className="text-slate-500 text-[10px] block font-semibold uppercase">Dashboard Date Range Scope</span>
                        <span className="font-bold text-slate-900">{current.approvalsAndDeadlines.dateRangeLabel || current.meta.dateFormatted}</span>
                      </div>
                    </div>
                    {current.approvalsAndDeadlines.allTimePendingCount != null && (
                      <span className="text-[11px] text-blue-800 bg-white border border-blue-200 px-3 py-1 rounded-full font-medium shadow-2xs">
                        Showing <strong>{current.approvalsAndDeadlines.pendingApprovalDetails?.length || 0}</strong> requests with dates/durations within range ({current.approvalsAndDeadlines.allTimePendingCount} total all-time)
                      </span>
                    )}
                  </div>

                  {/* Category Summary KPIs */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl">
                      <span className="text-[10px] text-slate-500 font-semibold block">Total Pending</span>
                      <span className="text-lg font-black text-slate-900">
                        {current.approvalsAndDeadlines.pendingApprovalDetails?.length || 0}
                      </span>
                    </div>
                    <div className="p-2.5 bg-rose-50/70 border border-rose-100 rounded-xl">
                      <span className="text-[10px] text-rose-600 font-semibold block">Faculty Leaves</span>
                      <span className="text-lg font-black text-rose-700">
                        {current.approvalsAndDeadlines.pendingApprovalDetails?.filter((p) => p.category === "leave").length || 0}
                      </span>
                    </div>
                    <div className="p-2.5 bg-purple-50/70 border border-purple-100 rounded-xl">
                      <span className="text-[10px] text-purple-600 font-semibold block">On-Duty (OD)</span>
                      <span className="text-lg font-black text-purple-700">
                        {current.approvalsAndDeadlines.pendingApprovalDetails?.filter((p) => p.category === "od").length || 0}
                      </span>
                    </div>
                    <div className="p-2.5 bg-sky-50/70 border border-sky-100 rounded-xl">
                      <span className="text-[10px] text-sky-600 font-semibold block">Compensatory Off</span>
                      <span className="text-lg font-black text-sky-700">
                        {current.approvalsAndDeadlines.pendingApprovalDetails?.filter((p) => p.category === "ccl").length || 0}
                      </span>
                    </div>
                  </div>

                  {/* Filter and Search Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                    <div className="flex items-center gap-1 text-xs overflow-x-auto pb-1">
                      <button
                        type="button"
                        onClick={() => setPendingCategoryFilter("all")}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                          pendingCategoryFilter === "all"
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        All ({current.approvalsAndDeadlines.pendingApprovalDetails?.length || 0})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingCategoryFilter("leave")}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                          pendingCategoryFilter === "leave"
                            ? "bg-rose-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        Leaves ({current.approvalsAndDeadlines.pendingApprovalDetails?.filter((p) => p.category === "leave").length || 0})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingCategoryFilter("od")}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                          pendingCategoryFilter === "od"
                            ? "bg-purple-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        On-Duty ({current.approvalsAndDeadlines.pendingApprovalDetails?.filter((p) => p.category === "od").length || 0})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingCategoryFilter("ccl")}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                          pendingCategoryFilter === "ccl"
                            ? "bg-sky-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        CCL ({current.approvalsAndDeadlines.pendingApprovalDetails?.filter((p) => p.category === "ccl").length || 0})
                      </button>
                    </div>

                    <div className="relative w-full sm:w-64">
                      <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={pendingSearchQuery}
                        onChange={(e) => setPendingSearchQuery(e.target.value)}
                        placeholder="Search employee, dept, purpose..."
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Pending Approvals Table */}
                  <div className="flex-1 min-h-0 border border-slate-200 rounded-xl overflow-y-auto overflow-x-hidden">
                    <table className="w-full text-left text-xs table-fixed">
                      <colgroup>
                        <col className="w-[20%]" />
                        <col className="w-[14%]" />
                        <col className="w-[14%]" />
                        <col className="w-[15%]" />
                        <col className="w-[23%]" />
                        <col className="w-[14%]" />
                      </colgroup>
                      <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0 z-10 border-b border-slate-200 shadow-2xs">
                        <tr>
                          <th className="py-2.5 px-3">Faculty / Employee</th>
                          <th className="py-2.5 px-3">Department</th>
                          <th className="py-2.5 px-3">Request Type</th>
                          <th className="py-2.5 px-3">Dates &amp; Duration</th>
                          <th className="py-2.5 px-3">Reason / Purpose</th>
                          <th className="py-2.5 px-3">Current Status</th>
                          <th className="py-2.5 px-3">Applied On</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPendingApprovals.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-slate-400">
                              No matching pending approvals found
                            </td>
                          </tr>
                        ) : (
                          filteredPendingApprovals.map((req) => (
                            <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-slate-900">{req.employeeName}</div>
                                <div className="font-mono text-[10px] text-slate-500">ID: {req.empNo}</div>
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-slate-700">{req.department}</div>
                                <div className="text-[10px] text-slate-400">{req.designation}</div>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                                  req.category === "leave"
                                    ? "bg-rose-100 text-rose-800"
                                    : req.category === "od"
                                    ? "bg-purple-100 text-purple-800"
                                    : "bg-sky-100 text-sky-800"
                                }`}>
                                  {req.categoryLabel} • {req.subType}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-[11px] text-slate-700">
                                <div className="font-medium">
                                  {req.fromDate === req.toDate ? req.fromDate : `${req.fromDate} - ${req.toDate}`}
                                </div>
                                <span className="text-[10px] text-slate-400">
                                  ({req.numberOfDays} day{req.numberOfDays > 1 ? "s" : ""})
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-[11px] text-slate-600 max-w-[200px]">
                                {req.placeVisited && req.placeVisited !== "—" && (
                                  <div className="font-semibold text-slate-800 truncate">
                                    Place: {req.placeVisited}
                                  </div>
                                )}
                                <div className="truncate">{req.purpose || "—"}</div>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  req.status.includes("approved")
                                    ? "bg-blue-100 text-blue-800"
                                    : req.status === "draft"
                                    ? "bg-slate-100 text-slate-600"
                                    : "bg-amber-100 text-amber-800"
                                }`}>
                                  <Clock className="h-2.5 w-2.5" />
                                  {req.statusLabel}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-[10px] text-slate-500 font-mono">
                                {req.appliedAt}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Upcoming Deadlines & Milestones Collapsible / Section */}
                  {current.approvalsAndDeadlines.upcomingDeadlines.length > 0 && (
                    <div className="pt-2 border-t border-slate-100">
                      <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                        Upcoming Academic Milestones &amp; Examination Deadlines
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {current.approvalsAndDeadlines.upcomingDeadlines.map((dl, i) => (
                          <div key={i} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex flex-col items-center justify-center shrink-0">
                              <span className="text-[11px] leading-none">{dl.day}</span>
                              <span className="text-[8px] uppercase">{dl.month}</span>
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-slate-800 block truncate">{dl.title}</span>
                              <span className="text-[11px] text-slate-500 block truncate">{dl.subtitle}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeModal === "section_att" && (
                <div className="space-y-2">
                  {(current.slotAttendance || current.sectionAttendance).map((s, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900">
                        {s.slot || s.department}
                        {s.totalClasses != null
                          ? ` (${s.postedClasses || 0} of ${s.totalClasses} classes posted)`
                          : s.sections != null
                          ? ` (${s.sections} sections)`
                          : ""}
                      </span>
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
                <div className="flex-1 min-h-0 flex flex-col space-y-3">
                  {/* Top Counters Summary */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center shrink-0">
                    <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
                      <span className="text-[10px] text-slate-500 block font-medium">Present</span>
                      <span className="text-lg font-black text-emerald-600">
                        {current.facultyAttendanceAndAdjustment.facultyStatus.present}
                      </span>
                    </div>
                    <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-100">
                      <span className="text-[10px] text-slate-500 block font-medium">Late</span>
                      <span className="text-lg font-black text-amber-600">
                        {current.facultyAttendanceAndAdjustment.facultyStatus.late}
                      </span>
                    </div>
                    <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-100">
                      <span className="text-[10px] text-slate-500 block font-medium">Leave</span>
                      <span className="text-lg font-black text-rose-600">
                        {current.facultyAttendanceAndAdjustment.facultyStatus.leave}
                      </span>
                    </div>
                    <div className="bg-purple-50 p-2.5 rounded-xl border border-purple-100">
                      <span className="text-[10px] text-slate-500 block font-medium">On Duty (OD)</span>
                      <span className="text-lg font-black text-purple-600">
                        {current.facultyAttendanceAndAdjustment.facultyStatus.od}
                      </span>
                    </div>
                    <div className="bg-blue-50 p-2.5 rounded-xl border border-blue-100">
                      <span className="text-[10px] text-slate-500 block font-medium">Permission</span>
                      <span className="text-lg font-black text-blue-600">
                        {current.facultyAttendanceAndAdjustment.facultyStatus.permission ?? 0}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-500 block font-medium">Absent</span>
                      <span className="text-lg font-black text-rose-600">
                        {current.facultyAttendanceAndAdjustment.facultyStatus.absent}
                      </span>
                    </div>
                  </div>

                  {/* Sub-tabs inside modal */}
                  <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-2 text-xs font-semibold shrink-0">
                    <button
                      type="button"
                      onClick={() => setFacultyModalTab("employees")}
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                        facultyModalTab === "employees"
                          ? "bg-blue-600 text-white shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      Employee Attendance ({current.facultyAttendanceAndAdjustment.employeeWiseDetails?.length || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFacultyModalTab("leaves")}
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                        facultyModalTab === "leaves"
                          ? "bg-blue-600 text-white shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      HRMS Leaves ({current.facultyAttendanceAndAdjustment.hrmsLeaves?.length || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFacultyModalTab("ods")}
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                        facultyModalTab === "ods"
                          ? "bg-blue-600 text-white shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      HRMS On-Duty / OD ({current.facultyAttendanceAndAdjustment.hrmsOds?.length || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFacultyModalTab("permissions")}
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                        facultyModalTab === "permissions"
                          ? "bg-blue-600 text-white shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      Permissions ({current.facultyAttendanceAndAdjustment.hrmsPermissions?.length || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFacultyModalTab("adjustments")}
                      className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                        facultyModalTab === "adjustments"
                          ? "bg-blue-600 text-white shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      Class Adjustments ({current.facultyAttendanceAndAdjustment.classesAffected.total})
                    </button>
                  </div>

                  {/* TAB 1: Employee-Wise Details */}
                  {facultyModalTab === "employees" && (
                    <div className="flex-1 min-h-0 flex flex-col space-y-2.5">
                      {/* Search & Filters */}
                      <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                        <div className="relative flex-1">
                          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Search by employee name, ID or department..."
                            value={empSearchQuery}
                            onChange={(e) => setEmpSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50/50"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 text-xs overflow-x-auto pb-1 sm:pb-0">
                          {(["all", "teaching", "non_teaching"] as const).map((grp) => (
                            <button
                              key={grp}
                              type="button"
                              onClick={() => setEmpGroupFilter(grp)}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer shrink-0 ${
                                empGroupFilter === grp
                                  ? "bg-slate-900 text-white"
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              }`}
                            >
                              {grp === "all" ? "All Staff" : grp === "teaching" ? "Teaching Faculty" : "Non-Teaching"}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Status Chips */}
                      <div className="shrink-0 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                        {(["all", "present", "late", "leave", "od", "permission", "absent"] as const).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setEmpStatusFilter(st)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize transition-colors cursor-pointer shrink-0 ${
                              empStatusFilter === st
                                ? "bg-blue-600 text-white ring-2 ring-blue-300"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>

                      {/* Slot Filter Bar */}
                      <div className="shrink-0 flex items-center gap-1.5 text-xs overflow-x-auto pb-1">
                        <span className="text-slate-400 font-semibold text-[10px] uppercase">Slots:</span>
                        <button
                          type="button"
                          onClick={() => setEmpSlotFilter("all")}
                          className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                            empSlotFilter === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          All Assigned ({current.facultyAttendanceAndAdjustment.employeeWiseDetails?.length || 0})
                        </button>
                        <button
                          type="button"
                          onClick={() => setEmpSlotFilter("has_slots")}
                          className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                            empSlotFilter === "has_slots" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          With Slots Today ({current.facultyAttendanceAndAdjustment.employeeWiseDetails?.filter((e) => (e.slotsCount || 0) > 0).length || 0})
                        </button>
                        <button
                          type="button"
                          onClick={() => setEmpSlotFilter("no_slots")}
                          className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                            empSlotFilter === "no_slots" ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          No Slots ({current.facultyAttendanceAndAdjustment.employeeWiseDetails?.filter((e) => !e.slotsCount || e.slotsCount === 0).length || 0})
                        </button>
                      </div>

                      {/* Employee Table Container (No side scrollings, single vertical scroll, fully visible details) */}
                      <div className="flex-1 min-h-0 border border-slate-200 rounded-xl overflow-y-auto overflow-x-hidden">
                        <table className="w-full text-left text-xs table-fixed">
                          <colgroup>
                            <col className="w-[75px]" />
                            <col className="w-[20%]" />
                            <col className="w-[12%]" />
                            <col className="w-[20%]" />
                            <col className="w-[13%]" />
                            <col className="w-[11%]" />
                            <col className="w-[24%]" />
                          </colgroup>
                          <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0 z-10 border-b border-slate-200 shadow-2xs">
                            <tr>
                              <th className="py-2.5 px-3">Emp ID</th>
                              <th className="py-2.5 px-3">Employee Name</th>
                              <th className="py-2.5 px-3">Department &amp; Group</th>
                              <th className="py-2.5 px-3">Scheduled Slots</th>
                              <th className="py-2.5 px-3">Attendance Status</th>
                              <th className="py-2.5 px-3">Biometric Timing</th>
                              <th className="py-2.5 px-3">Details / Reason</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredEmployees.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="py-6 text-center text-slate-400">
                                  No matching employee attendance records found
                                </td>
                              </tr>
                            ) : (
                              filteredEmployees.map((emp) => (
                                <tr key={emp.empNo} className="hover:bg-slate-50/70 transition-colors">
                                  <td className="py-2.5 px-3 font-mono text-[11px] font-bold text-slate-700 whitespace-nowrap">
                                    {emp.empNo}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="font-bold text-slate-900 leading-tight">{emp.name}</div>
                                    <div className="text-[10px] text-slate-500 mt-0.5">{emp.designation || "Staff"}</div>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="font-semibold text-slate-700">{emp.department}</div>
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold mt-0.5 ${
                                      emp.isTeaching ? "bg-indigo-50 text-indigo-700 border border-indigo-100" : "bg-slate-100 text-slate-600"
                                    }`}>
                                      {emp.employeeGroup || (emp.isTeaching ? "TEACHING" : "NON-TEACHING")}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    {emp.slotsCount && emp.slotsCount > 0 ? (
                                      <div className="space-y-1">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                          <BookOpen className="h-2.5 w-2.5 text-blue-600 shrink-0" />
                                          {emp.slotsCount} Slots ({emp.slotsPosted || 0} Posted)
                                        </span>
                                        {emp.subjects && emp.subjects.length > 0 && (
                                          <span className="text-[10.5px] text-slate-500 block leading-snug whitespace-normal" title={emp.subjects.join(", ")}>
                                            {emp.subjects.slice(0, 3).join(", ")}{emp.subjects.length > 3 ? ` +${emp.subjects.length - 3} more` : ""}
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-[10.5px] text-slate-400 italic">No slots today</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 whitespace-nowrap">
                                    {emp.status === "present" && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                        <Fingerprint className="h-3 w-3 text-emerald-600 shrink-0" />
                                        {emp.thumbStatus === "partial" ? "Present (Partial)" : "Present"}
                                      </span>
                                    )}
                                    {emp.status === "late" && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                        <Clock className="h-3 w-3 text-amber-600 shrink-0" />
                                        Late ({emp.lateMinutes}m)
                                      </span>
                                    )}
                                    {emp.status === "leave" && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                        {emp.displayStatus}
                                      </span>
                                    )}
                                    {emp.status === "od" && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                                        {emp.displayStatus}
                                      </span>
                                    )}
                                    {emp.status === "permission" && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                                        Permission
                                      </span>
                                    )}
                                    {emp.status === "absent" && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                                        Absent
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 font-mono text-[11px] whitespace-nowrap">
                                    {emp.checkInTime ? (
                                      <div className="space-y-0.5">
                                        <span className="text-emerald-700 font-semibold block">In: {emp.checkInTime}</span>
                                        {emp.checkOutTime && (
                                          <span className="text-slate-500 block text-[10px]">Out: {emp.checkOutTime}</span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 italic text-[11px]">No punch</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-[11px] text-slate-600 leading-relaxed whitespace-normal break-words">
                                    {emp.details || "—"}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: HRMS Leaves */}
                  {facultyModalTab === "leaves" && (
                    <div className="flex-1 min-h-0 border border-slate-200 rounded-xl overflow-y-auto overflow-x-hidden">
                      <table className="w-full text-left text-xs table-fixed">
                        <colgroup>
                          <col className="w-[80px]" />
                          <col className="w-[20%]" />
                          <col className="w-[14%]" />
                          <col className="w-[14%]" />
                          <col className="w-[16%]" />
                          <col className="w-[24%]" />
                          <col className="w-[12%]" />
                        </colgroup>
                        <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0 z-10 border-b border-slate-200 shadow-2xs">
                          <tr>
                            <th className="py-2.5 px-3">Emp ID</th>
                            <th className="py-2.5 px-3">Employee Name</th>
                            <th className="py-2.5 px-3">Department</th>
                            <th className="py-2.5 px-3">Leave Type</th>
                            <th className="py-2.5 px-3">Dates &amp; Days</th>
                            <th className="py-2.5 px-3">Reason / Purpose</th>
                            <th className="py-2.5 px-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(!current.facultyAttendanceAndAdjustment.hrmsLeaves || current.facultyAttendanceAndAdjustment.hrmsLeaves.length === 0) ? (
                            <tr>
                              <td colSpan={7} className="py-6 text-center text-slate-400">
                                No leave applications found for this date
                              </td>
                            </tr>
                          ) : (
                            current.facultyAttendanceAndAdjustment.hrmsLeaves.map((l) => (
                              <tr key={l.id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="py-2 px-3 font-mono font-bold text-slate-700">{l.empNo}</td>
                                <td className="py-2 px-3 font-bold text-slate-900">{l.employeeName}</td>
                                <td className="py-2 px-3 text-slate-600 font-medium">{l.department}</td>
                                <td className="py-2 px-3">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                                    {l.leaveType}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-[11px] text-slate-700 font-medium">
                                  <div>{l.fromDate === l.toDate ? l.fromDate : `${l.fromDate} - ${l.toDate}`}</div>
                                  <span className="text-[10px] text-slate-400">({l.numberOfDays} day{l.numberOfDays > 1 ? "s" : ""})</span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-600 text-[11px] leading-relaxed whitespace-normal break-words">{l.purpose || "—"}</td>
                                <td className="py-2 px-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                                    l.status.includes("approved")
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-amber-100 text-amber-800"
                                  }`}>
                                    {l.status.replace("_", " ")}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* TAB 3: HRMS ODs */}
                  {facultyModalTab === "ods" && (
                    <div className="flex-1 min-h-0 border border-slate-200 rounded-xl overflow-y-auto overflow-x-hidden">
                      <table className="w-full text-left text-xs table-fixed">
                        <colgroup>
                          <col className="w-[80px]" />
                          <col className="w-[18%]" />
                          <col className="w-[12%]" />
                          <col className="w-[12%]" />
                          <col className="w-[15%]" />
                          <col className="w-[18%]" />
                          <col className="w-[15%]" />
                          <col className="w-[10%]" />
                        </colgroup>
                        <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0 z-10 border-b border-slate-200 shadow-2xs">
                          <tr>
                            <th className="py-2.5 px-3">Emp ID</th>
                            <th className="py-2.5 px-3">Employee Name</th>
                            <th className="py-2.5 px-3">Department</th>
                            <th className="py-2.5 px-3">OD Type</th>
                            <th className="py-2.5 px-3">Dates</th>
                            <th className="py-2.5 px-3">Location / Place</th>
                            <th className="py-2.5 px-3">Purpose</th>
                            <th className="py-2.5 px-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(!current.facultyAttendanceAndAdjustment.hrmsOds || current.facultyAttendanceAndAdjustment.hrmsOds.length === 0) ? (
                            <tr>
                              <td colSpan={8} className="py-6 text-center text-slate-400">
                                No on-duty (OD) records found for this date
                              </td>
                            </tr>
                          ) : (
                            current.facultyAttendanceAndAdjustment.hrmsOds.map((o) => (
                              <tr key={o.id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="py-2 px-3 font-mono font-bold text-slate-700">{o.empNo}</td>
                                <td className="py-2 px-3 font-bold text-slate-900">{o.employeeName}</td>
                                <td className="py-2 px-3 text-slate-600 font-medium">{o.department}</td>
                                <td className="py-2 px-3">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                                    {o.odType}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-[11px] text-slate-700">
                                  {o.fromDate === o.toDate ? o.fromDate : `${o.fromDate} - ${o.toDate}`}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600 text-[11px] leading-relaxed whitespace-normal break-words">{o.placeVisited || "—"}</td>
                                <td className="py-2.5 px-3 text-slate-600 text-[11px] leading-relaxed whitespace-normal break-words">{o.purpose || "—"}</td>
                                <td className="py-2 px-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                                    o.status.includes("approved")
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-amber-100 text-amber-800"
                                  }`}>
                                    {o.status.replace("_", " ")}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* TAB 4: HRMS Permissions */}
                  {facultyModalTab === "permissions" && (
                    <div className="flex-1 min-h-0 border border-slate-200 rounded-xl overflow-y-auto overflow-x-hidden">
                      <table className="w-full text-left text-xs table-fixed">
                        <colgroup>
                          <col className="w-[80px]" />
                          <col className="w-[20%]" />
                          <col className="w-[14%]" />
                          <col className="w-[14%]" />
                          <col className="w-[12%]" />
                          <col className="w-[28%]" />
                          <col className="w-[12%]" />
                        </colgroup>
                        <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0 z-10 border-b border-slate-200 shadow-2xs">
                          <tr>
                            <th className="py-2.5 px-3">Emp ID</th>
                            <th className="py-2.5 px-3">Employee Name</th>
                            <th className="py-2.5 px-3">Department</th>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Duration</th>
                            <th className="py-2.5 px-3">Reason / Remarks</th>
                            <th className="py-2.5 px-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(!current.facultyAttendanceAndAdjustment.hrmsPermissions || current.facultyAttendanceAndAdjustment.hrmsPermissions.length === 0) ? (
                            <tr>
                              <td colSpan={7} className="py-6 text-center text-slate-400">
                                No permissions recorded for this date
                              </td>
                            </tr>
                          ) : (
                            current.facultyAttendanceAndAdjustment.hrmsPermissions.map((p) => (
                              <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="py-2 px-3 font-mono font-bold text-slate-700">{p.empNo}</td>
                                <td className="py-2 px-3 font-bold text-slate-900">{p.employeeName}</td>
                                <td className="py-2 px-3 text-slate-600 font-medium">{p.department}</td>
                                <td className="py-2 px-3 text-[11px] text-slate-700">{p.date}</td>
                                <td className="py-2 px-3 font-semibold text-blue-700">{p.hours} hr{p.hours > 1 ? "s" : ""}</td>
                                <td className="py-2.5 px-3 text-slate-600 text-[11px] leading-relaxed whitespace-normal break-words">{p.reason || "—"}</td>
                                <td className="py-2 px-3">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 capitalize">
                                    {p.status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* TAB 5: Class Adjustments */}
                  {facultyModalTab === "adjustments" && (
                    <div className="space-y-3">
                      <div className="p-4 bg-slate-50 rounded-xl text-xs space-y-2 border border-slate-200">
                        <span className="font-bold text-slate-800 text-sm block">
                          Classes Affected Today: {current.facultyAttendanceAndAdjustment.classesAffected.total}
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center pt-2">
                          <div className="p-2 bg-emerald-50 rounded-lg">
                            <span className="text-[10px] text-slate-500 block">Adjusted</span>
                            <span className="text-base font-bold text-emerald-600">
                              {current.facultyAttendanceAndAdjustment.classesAffected.adjusted}
                            </span>
                          </div>
                          <div className="p-2 bg-blue-50 rounded-lg">
                            <span className="text-[10px] text-slate-500 block">Substitute</span>
                            <span className="text-base font-bold text-blue-600">
                              {current.facultyAttendanceAndAdjustment.classesAffected.substitute}
                            </span>
                          </div>
                          <div className="p-2 bg-rose-50 rounded-lg">
                            <span className="text-[10px] text-slate-500 block">Cancelled</span>
                            <span className="text-base font-bold text-rose-600">
                              {current.facultyAttendanceAndAdjustment.classesAffected.cancelled}
                            </span>
                          </div>
                          <div className="p-2 bg-amber-50 rounded-lg">
                            <span className="text-[10px] text-slate-500 block">Pending</span>
                            <span className="text-base font-bold text-amber-600">
                              {current.facultyAttendanceAndAdjustment.classesAffected.pending}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
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

      {/* Slot Attendance Detail Modal */}
      {selectedSlotData && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedSlotData(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-xs"
                  style={{ backgroundColor: selectedSlotData.fill || "#3b82f6" }}
                >
                  {selectedSlotData.slot || selectedSlotData.slotLabel || "P"}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Slot {selectedSlotData.slot || selectedSlotData.slotLabel || selectedSlotData.department} Attendance
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-0.5">
                    {selectedSlotData.timing && (
                      <span className="flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md font-semibold">
                        <Clock className="h-3 w-3 text-slate-500" />
                        {selectedSlotData.timing}
                      </span>
                    )}
                    <span>{current.meta?.dateFormatted || "Selected Date"}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSlotData(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Overall Attendance & KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl flex flex-col justify-between">
                <span className="text-[10.5px] font-semibold text-blue-700">Attendance Rate</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-black text-blue-900">
                    {selectedSlotData.attendance}%
                  </span>
                </div>
                <div className="w-full bg-blue-200 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, selectedSlotData.attendance))}%` }}
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex flex-col justify-between">
                <span className="text-[10.5px] font-semibold text-slate-600">Total Classes</span>
                <span className="text-2xl font-black text-slate-800 mt-1">
                  {selectedSlotData.totalClasses || selectedSlotData.sections || 0}
                </span>
                <span className="text-[10px] text-slate-400">Scheduled in this slot</span>
              </div>

              <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl flex flex-col justify-between">
                <span className="text-[10.5px] font-semibold text-emerald-700">Posted Classes</span>
                <span className="text-2xl font-black text-emerald-700 mt-1">
                  {selectedSlotData.postedClasses || 0}
                </span>
                <span className="text-[10px] text-emerald-600 font-medium">
                  {selectedSlotData.totalClasses
                    ? `${Math.round(((selectedSlotData.postedClasses || 0) / selectedSlotData.totalClasses) * 100)}% completed`
                    : "0%"}
                </span>
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-xl flex flex-col justify-between">
                <span className="text-[10.5px] font-semibold text-amber-700">Pending Posting</span>
                <span className="text-2xl font-black text-amber-700 mt-1">
                  {selectedSlotData.pendingClasses != null
                    ? selectedSlotData.pendingClasses
                    : Math.max(0, (selectedSlotData.totalClasses || 0) - (selectedSlotData.postedClasses || 0))}
                </span>
                <span className="text-[10px] text-amber-600 font-medium">Awaiting attendance</span>
              </div>
            </div>

            {/* Students Present / Marked Summary */}
            {(selectedSlotData.totalMarked != null && selectedSlotData.totalMarked > 0) && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-500" />
                  <span className="font-semibold text-slate-700">Students Marked:</span>
                  <span className="font-bold text-slate-900">{selectedSlotData.totalMarked} students</span>
                </div>
                <div className="flex items-center gap-3 font-semibold">
                  <span className="text-emerald-600">Present: {selectedSlotData.totalPresent || 0}</span>
                  <span className="text-slate-300">|</span>
                  <span className="text-rose-600">Absent: {selectedSlotData.totalAbsent || 0}</span>
                </div>
              </div>
            )}

            {/* Department Breakdown */}
            {selectedSlotData.departments && selectedSlotData.departments.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Department Breakdown ({selectedSlotData.departments.length})
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <th className="py-2.5 px-3">Department</th>
                        <th className="py-2.5 px-3 text-center">Classes</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-right">Attendance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedSlotData.departments.map((d: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-800">{d.branchCode}</div>
                            <div className="text-[10px] text-slate-500 truncate max-w-[180px]">{d.branchName}</div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-semibold text-slate-700">
                            {d.totalClasses} {d.totalClasses === 1 ? "class" : "classes"}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {d.postedClasses >= d.totalClasses ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                Posted
                              </span>
                            ) : d.postedClasses > 0 ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                {d.postedClasses}/{d.totalClasses} Posted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black">
                            <span className={d.attendancePct >= 75 ? "text-emerald-600" : d.attendancePct >= 65 ? "text-amber-600" : "text-rose-600"}>
                              {d.markedCount > 0 ? `${d.attendancePct}%` : "—"}
                            </span>
                            {d.markedCount > 0 && (
                              <span className="block text-[10px] font-normal text-slate-400">
                                {d.presentCount}/{d.markedCount}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {/* Footer */}
            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedSlotData(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
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
