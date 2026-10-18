"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useAcademicContext } from "@/components/layout/AcademicProvider";
import { AcademicFilterBar } from "@/components/layout/AcademicFilterBar";
import { apiFetch } from "@/lib/api";
import { StudentAvatar } from "@/features/students/StudentAvatar";
import { cn } from "@/lib/cn";
import {
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  GraduationCap,
  PieChart,
  Search,
  Users,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Building2,
  Layers,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  BarChart3,
  Filter,
  XCircle,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatCardSkeleton } from "@/components/ui/CardSkeleton";
import { TableSkeleton } from "@/components/ui/TableSkeleton";

export type AttendanceMark = "present" | "absent" | "od" | "leave";

export type SlotItem = {
  sessionId: number;
  slotLabel: string;
  startTime: string;
  endTime: string;
  section: string | null;
  subjectName: string | null;
  subjectCode: string | null;
  facultyName: string | null;
  status: string;
  posted: boolean;
  presentCount: number;
  absentCount: number;
  odCount: number;
  leaveCount: number;
  attendancePct: number;
};

export type SectionSlotStats = {
  sectionName: string;
  totalStudents: number;
  totalSessions: number;
  postedSessions: number;
  pendingSessions: number;
  totalPresent: number;
  totalAbsent: number;
  slotPresentMarks?: number;
  slotAbsentMarks?: number;
  totalOd: number;
  totalLeave: number;
  attendancePct: number;
  slots: SlotItem[];
};

export type CollegeCourseBranchYearSlotStats = {
  collegeId: number;
  collegeName: string;
  collegeCode: string;
  courseId: number;
  courseName: string;
  courseCode: string;
  branchId: number;
  branchName: string;
  branchCode: string;
  yearOfStudy: number;
  yearLabel: string;
  semesterNumber: number | null;
  totalStudents: number;
  totalSessions: number;
  postedSessions: number;
  pendingSessions: number;
  totalPresent: number;
  totalAbsent: number;
  slotPresentMarks?: number;
  slotAbsentMarks?: number;
  totalOd: number;
  totalLeave: number;
  attendancePct: number;
  sections?: SectionSlotStats[];
  slots: SlotItem[];
};

export type SlotsAttendanceSummaryResult = {
  date: string;
  summary: {
    totalColleges: number;
    totalCourses: number;
    totalBranches: number;
    totalStudents: number;
    totalSessions: number;
    postedSessions: number;
    pendingSessions: number;
    overallPresent: number;
    overallAbsent: number;
    overallAttendancePct: number;
  };
  groups: CollegeCourseBranchYearSlotStats[];
};

export type DailySlot = {
  sessionId: number;
  slotLabel: string;
  startTime: string;
  endTime: string;
  time: string;
  subjectId: number | null;
  subjectCode: string | null;
  subjectName: string | null;
  facultyName: string | null;
  roomLabel: string | null;
  status: string;
  posted: boolean;
  postId: number | null;
  presentCount: number;
  absentCount: number;
  odCount: number;
  leaveCount: number;
};

export type DailyStudent = {
  id: string;
  studentDbId: number;
  name: string;
  pinNo: string | null;
  admissionNo: string;
  course: string | null;
  branch: string | null;
  year: number | null;
  semester: number | null;
  studentStatus?: string | null;
  studentType?: string | null;
  hasPhoto: boolean;
  slots: Record<
    number,
    {
      sessionId: number;
      status: AttendanceMark | "pending" | "unposted";
      remarks: string | null;
    }
  >;
  totalPresent: number;
  totalAbsent: number;
  totalOd: number;
  totalLeave: number;
  totalConducted: number;
  totalSlots: number;
  percentage: number | null;
};

export type DailyAttendanceData = {
  date: string;
  section: string | null;
  availableSections: string[];
  slots: DailySlot[];
  students: DailyStudent[];
  summary: {
    totalStudents: number;
    totalSlots: number;
    postedSlots: number;
    pendingSlots: number;
    totalPresentMarks: number;
    totalAbsentMarks: number;
    avgAttendancePct: number;
  };
};

export type WeeklySlot = {
  sessionId: number;
  slotLabel: string;
  startTime: string;
  endTime: string;
  time: string;
  subjectId: number | null;
  subjectCode: string | null;
  subjectName: string | null;
  facultyName: string | null;
  roomLabel: string | null;
  status: string;
  posted: boolean;
  postId: number | null;
  presentCount: number;
  absentCount: number;
  odCount: number;
  leaveCount: number;
};

export type WeeklyDay = {
  date: string;
  dayOfWeek: string;
  dayLabel: string;
  totalSlots: number;
  postedSlots: number;
  slots: WeeklySlot[];
};

export type WeeklyStudent = {
  id: string;
  studentDbId: number;
  name: string;
  pinNo: string | null;
  admissionNo: string;
  course: string | null;
  branch: string | null;
  year: number | null;
  semester: number | null;
  studentStatus?: string | null;
  studentType?: string | null;
  hasPhoto: boolean;
  days: Record<
    string,
    {
      date: string;
      dayOfWeek: string;
      totalSlots: number;
      presentCount: number;
      absentCount: number;
      odCount: number;
      leaveCount: number;
      percentage: number | null;
      slots: Record<
        number,
        {
          sessionId: number;
          slotLabel: string;
          subjectCode: string | null;
          status: AttendanceMark | "pending" | "unposted";
          remarks: string | null;
        }
      >;
    }
  >;
  totalPresent: number;
  totalAbsent: number;
  totalOd: number;
  totalLeave: number;
  totalConducted: number;
  totalSlots: number;
  percentage: number | null;
};

export type WeeklyAttendanceData = {
  startDate: string;
  endDate: string;
  weekLabel: string;
  section: string | null;
  availableSections: string[];
  days: WeeklyDay[];
  students: WeeklyStudent[];
  summary: {
    totalStudents: number;
    totalSlotsInWeek: number;
    postedSlotsInWeek: number;
    totalPresentMarks: number;
    totalAbsentMarks: number;
    avgAttendancePct: number;
  };
};

export type MonthlyStudent = {
  id: string;
  studentDbId: number;
  name: string;
  pinNo: string | null;
  admissionNo: string;
  course: string | null;
  branch: string | null;
  year: number | null;
  semester: number | null;
  studentStatus?: string | null;
  studentType?: string | null;
  hasPhoto: boolean;
  totalSlots: number;
  presentCount: number;
  absentCount: number;
  odCount: number;
  leaveCount: number;
  percentage: number;
  status: "good" | "warning" | "critical";
};

export type MonthlyAttendanceData = {
  month: number;
  year: number;
  monthName: string;
  students: MonthlyStudent[];
  daySummaries: Array<{
    date: string;
    dayOfWeek: string;
    totalSessions: number;
    postedSessions: number;
    presentCount: number;
    absentCount: number;
    avgPct: number;
  }>;
  summary: {
    totalStudents: number;
    totalSessionsConducted: number;
    avgAttendancePct: number;
    safeCount: number;
    warningCount: number;
    criticalCount: number;
  };
};

export type SemesterStudent = {
  id: string;
  studentDbId: number;
  name: string;
  pinNo: string | null;
  admissionNo: string;
  course: string | null;
  branch: string | null;
  year: number | null;
  semester: number | null;
  studentStatus?: string | null;
  studentType?: string | null;
  hasPhoto: boolean;
  totalClasses: number;
  presentCount: number;
  absentCount: number;
  odCount: number;
  leaveCount: number;
  percentage: number;
  eligibility: "Eligible" | "Condonation Required" | "Detained";
  subjectBreakdown: Array<{
    subjectCode: string;
    subjectName: string;
    total: number;
    present: number;
    percentage: number;
  }>;
};

export type SemesterAttendanceData = {
  semester: number | null;
  academicYear: string | null;
  students: SemesterStudent[];
  summary: {
    totalStudents: number;
    eligibleCount: number;
    condonationCount: number;
    detainedCount: number;
    avgAttendancePct: number;
    totalClassesConducted: number;
  };
  bands: Array<{ label: string; count: number; percentage: number }>;
};

export type OverviewAnalytics = {
  overallAttendance: number;
  studentsBelowThreshold: number;
  bands: { label: string; total: number }[];
  sections: { section: string; attendance: number }[];
  today?: { scheduled: number; posted: number; pending: number };
  source?: string;
};

type TabType = "today" | "week" | "month" | "semester" | "overview";

function getTodayString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const dayStr = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${dayStr}`;
}

export function AttendanceAnalyticsView({ embedded = false }: { embedded?: boolean }) {
  const { filters, setFilters } = useAcademicContext();
  const [activeTab, setActiveTab] = useState<TabType>("today");

  // Date & Section Controls
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(() => getMonday(new Date()));
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedStudentType, setSelectedStudentType] = useState<string>("Regular");

  // Month & Semester Controls
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedSemester, setSelectedSemester] = useState<number>(1);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  // Derived Year & Semester Options
  const currentYearNum =
    filters.year !== "all" && typeof filters.year === "number" ? filters.year : null;

  const semesterOptions = useMemo(() => {
    if (currentYearNum) {
      return [
        { value: 1, label: `${currentYearNum}-1 (Sem 1)` },
        { value: 2, label: `${currentYearNum}-2 (Sem 2)` },
      ];
    }
    return [
      { value: 1, label: "Semester 1" },
      { value: 2, label: "Semester 2" },
      { value: 3, label: "Semester 3" },
      { value: 4, label: "Semester 4" },
      { value: 5, label: "Semester 5" },
      { value: 6, label: "Semester 6" },
      { value: 7, label: "Semester 7" },
      { value: 8, label: "Semester 8" },
    ];
  }, [currentYearNum]);

  const handleSemesterChange = (newSem: number) => {
    setSelectedSemester(newSem);
    setFilters({ semester: newSem });
  };

  // Tab Data States
  const [dailyData, setDailyData] = useState<DailyAttendanceData | null>(null);
  const [weeklyData, setWeeklyData] = useState<WeeklyAttendanceData | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyAttendanceData | null>(null);
  const [semesterData, setSemesterData] = useState<SemesterAttendanceData | null>(null);
  const [overviewData, setOverviewData] = useState<OverviewAnalytics | null>(null);

  // Slots Summary Data States (All Colleges Stats Format)
  const [slotsSummaryData, setSlotsSummaryData] = useState<SlotsAttendanceSummaryResult | null>(null);
  const [viewMode, setViewMode] = useState<"stats" | "sheet">(
    filters.collegeId === "all" ? "stats" : "sheet",
  );
  const [slotsSearchQuery, setSlotsSearchQuery] = useState("");
  const [slotsStatusFilter, setSlotsStatusFilter] = useState<"all" | "posted" | "pending" | "below65" | "above75">("all");
  const [slotsTableViewMode, setSlotsTableViewMode] = useState<"bySection" | "byCohort">("bySection");
  const [expandedCohortKeys, setExpandedCohortKeys] = useState<Set<string>>(new Set());
  const [previewingSlotsSection, setPreviewingSlotsSection] = useState<{
    cohortLabel: string;
    sectionName: string;
    slots: SlotItem[];
  } | null>(null);
  const [selectedCohortDetail, setSelectedCohortDetail] = useState<CollegeCourseBranchYearSlotStats | null>(null);

  const toggleCohortExpand = (key: string) => {
    setExpandedCohortKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAllCohorts = () => {
    setExpandedCohortKeys(
      new Set(
        filteredSlotsGroups.map(
          (g) => `${g.collegeId}-${g.courseId}-${g.branchId}-${g.yearOfStudy}`,
        ),
      ),
    );
  };

  const collapseAllCohorts = () => {
    setExpandedCohortKeys(new Set());
  };

  // Sync viewMode when filters.collegeId changes to 'all'
  useEffect(() => {
    if (filters.collegeId === "all" && !selectedCohortDetail) {
      setViewMode("stats");
    }
  }, [filters.collegeId, selectedCohortDetail]);

  const handleLoadCohortDetails = (
    group: CollegeCourseBranchYearSlotStats,
    sectionName?: string,
  ) => {
    setSelectedCohortDetail(group);
    const targetSection =
      sectionName ||
      (group.sections && group.sections.length > 0 ? group.sections[0].sectionName : "") ||
      (group.slots.length > 0 && group.slots[0].section ? group.slots[0].section : "");

    setFilters({
      collegeId: group.collegeId,
      courseId: group.courseId,
      branchId: group.branchId,
      year: group.yearOfStudy,
      ...(group.semesterNumber ? { semester: group.semesterNumber } : {}),
      ...(targetSection ? { section: targetSection } : {}),
    });
    if (targetSection) {
      setSelectedSection(targetSection);
    }
    setViewMode("sheet");
  };

  const handleBackToStats = () => {
    setViewMode("stats");
    setSelectedCohortDetail(null);
    setFilters({ collegeId: "all", courseId: "all", branchId: "all", year: "all" });
  };

  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync selectedSection when global filters.section changes
  useEffect(() => {
    if (filters.section && filters.section !== "all") {
      setSelectedSection(filters.section);
    }
  }, [filters.section]);

  // Sync selectedSemester when global filters.semester changes
  useEffect(() => {
    if (filters.semester && filters.semester !== "all" && typeof filters.semester === "number") {
      setSelectedSemester(filters.semester);
    }
  }, [filters.semester]);

  // Query String for global context filters - FULLY RESPECTING ALL PAGE FILTERS!
  const baseQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.collegeId !== "all") params.set("collegeId", String(filters.collegeId));
    if (filters.courseId !== "all") params.set("courseId", String(filters.courseId));
    if (filters.branchId !== "all") params.set("branchId", String(filters.branchId));
    if (filters.batch && filters.batch !== "all") params.set("batch", String(filters.batch));
    if (filters.year && filters.year !== "all") params.set("year", String(filters.year));
    if (filters.semester && filters.semester !== "all") params.set("semester", String(filters.semester));
    if (filters.academicYear && filters.academicYear !== "all") {
      params.set("academicYear", String(filters.academicYear));
    }
    const sec = selectedSection || (filters.section !== "all" ? filters.section : "");
    if (sec && sec !== "all") params.set("section", sec);
    if (selectedStudentType) {
      params.set("studentStatus", selectedStudentType);
    }
    return params;
  }, [
    filters.collegeId,
    filters.courseId,
    filters.branchId,
    filters.batch,
    filters.year,
    filters.semester,
    filters.academicYear,
    filters.section,
    selectedSection,
    selectedStudentType,
  ]);

  // Load Data based on activeTab
  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        if (activeTab === "today") {
          const params = new URLSearchParams(baseQuery);
          params.set("date", selectedDate);
          if (selectedSemester) {
            params.set("semester", String(selectedSemester));
          }

          // 1. If in stats mode or on all colleges, load slots summary
          if (viewMode === "stats" || filters.collegeId === "all") {
            try {
              const sumRes = await apiFetch(`/attendance/analytics/slots-summary?${params.toString()}`, {
                cache: "no-store",
              });
              const sumBody = await sumRes.json().catch(() => ({}));
              if (sumRes.ok && !cancelled) {
                setSlotsSummaryData(sumBody as SlotsAttendanceSummaryResult);
              }
            } catch {
              // Ignore non-fatal
            }
          }

          // 2. If in sheet mode or a specific college/cohort is selected, load the daily sheet
          if (viewMode === "sheet" || filters.collegeId !== "all" || selectedCohortDetail) {
            const res = await apiFetch(`/attendance/analytics/daily?${params.toString()}`, {
              cache: "no-store",
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.message || "Failed to load day attendance sheet");
            if (!cancelled) {
              const data = body as DailyAttendanceData;
              setDailyData(data);
              if (!selectedSection && data.section) {
                setSelectedSection(data.section);
              }
            }
          }
        } else if (activeTab === "week") {
          const params = new URLSearchParams(baseQuery);
          if (selectedWeekStart) {
            params.set("startDate", selectedWeekStart);
          }
          if (selectedSemester) {
            params.set("semester", String(selectedSemester));
          }
          const res = await apiFetch(`/attendance/analytics/week?${params.toString()}`, {
            cache: "no-store",
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body.message || "Failed to load weekly attendance sheet");
          if (!cancelled) {
            const data = body as WeeklyAttendanceData;
            setWeeklyData(data);
            if (!selectedSection && data.section) {
              setSelectedSection(data.section);
            }
          }
        } else if (activeTab === "month") {
          const params = new URLSearchParams(baseQuery);
          params.set("month", String(selectedMonth));
          params.set("year", String(selectedYear));
          if (selectedSemester) {
            params.set("semester", String(selectedSemester));
          }
          const res = await apiFetch(`/attendance/analytics/monthly?${params.toString()}`, {
            cache: "no-store",
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body.message || "Failed to load monthly attendance sheet");
          if (!cancelled) setMonthlyData(body as MonthlyAttendanceData);
        } else if (activeTab === "semester") {
          const params = new URLSearchParams(baseQuery);
          params.set("semester", String(selectedSemester));
          const res = await apiFetch(`/attendance/analytics/semester?${params.toString()}`, {
            cache: "no-store",
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body.message || "Failed to load semester attendance sheet");
          if (!cancelled) setSemesterData(body as SemesterAttendanceData);
        } else if (activeTab === "overview") {
          const params = new URLSearchParams(baseQuery);
          if (selectedSemester) {
            params.set("semester", String(selectedSemester));
          }
          const res = await apiFetch(`/attendance/analytics?${params.toString()}`, {
            cache: "no-store",
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body.message || "Failed to load attendance overview");
          if (!cancelled) setOverviewData(body as OverviewAnalytics);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    baseQuery,
    selectedDate,
    selectedWeekStart,
    selectedMonth,
    selectedYear,
    selectedSemester,
    selectedSection,
    viewMode,
    filters.collegeId,
    selectedCohortDetail,
  ]);

  // Quick Date Jump Handlers
  const handleJumpDate = (offsetDays: number) => {
    const d = new Date(selectedDate);
    if (isNaN(d.getTime())) return;
    d.setDate(d.getDate() + offsetDays);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    setSelectedDate(`${y}-${m}-${day}`);
  };

  const handleSetToday = () => {
    setSelectedDate(getTodayString());
  };

  const handleSetYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    setSelectedDate(`${y}-${m}-${day}`);
  };

  // Quick Week Jump Handlers
  const handleJumpWeek = (offsetWeeks: number) => {
    const d = new Date(selectedWeekStart);
    if (isNaN(d.getTime())) return;
    d.setDate(d.getDate() + offsetWeeks * 7);
    setSelectedWeekStart(getMonday(d));
  };

  const handleSetThisWeek = () => {
    setSelectedWeekStart(getMonday(new Date()));
  };

  // Filtered Students for Today Tab
  const filteredDailyStudents = useMemo(() => {
    if (!dailyData?.students) return [];
    let list = dailyData.students;

    if (selectedStudentType && selectedStudentType !== "all") {
      list = list.filter(
        (s) =>
          (s.studentStatus || "Regular").toLowerCase() ===
          selectedStudentType.toLowerCase(),
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.admissionNo.toLowerCase().includes(q) ||
          (s.pinNo && s.pinNo.toLowerCase().includes(q)),
      );
    }

    if (statusFilter === "below75") {
      list = list.filter((s) => s.percentage !== null && s.percentage < 75);
    } else if (statusFilter === "present") {
      list = list.filter((s) => s.totalPresent > 0);
    } else if (statusFilter === "absent") {
      list = list.filter((s) => s.totalAbsent > 0);
    } else if (statusFilter === "perfect") {
      list = list.filter((s) => s.percentage === 100);
    }

    return list;
  }, [dailyData?.students, searchQuery, statusFilter, selectedStudentType]);

  // Filtered Students for Week Tab
  const filteredWeeklyStudents = useMemo(() => {
    if (!weeklyData?.students) return [];
    let list = weeklyData.students;

    if (selectedStudentType && selectedStudentType !== "all") {
      list = list.filter(
        (s) =>
          (s.studentStatus || "Regular").toLowerCase() ===
          selectedStudentType.toLowerCase(),
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.admissionNo.toLowerCase().includes(q) ||
          (s.pinNo && s.pinNo.toLowerCase().includes(q)),
      );
    }

    if (statusFilter === "below75") {
      list = list.filter((s) => s.percentage !== null && s.percentage < 75);
    } else if (statusFilter === "present") {
      list = list.filter((s) => s.totalPresent > 0);
    } else if (statusFilter === "absent") {
      list = list.filter((s) => s.totalAbsent > 0);
    } else if (statusFilter === "perfect") {
      list = list.filter((s) => s.percentage === 100);
    }

    return list;
  }, [weeklyData?.students, searchQuery, statusFilter, selectedStudentType]);

  // Filtered Students for Month Tab
  const filteredMonthlyStudents = useMemo(() => {
    if (!monthlyData?.students) return [];
    let list = monthlyData.students;

    if (selectedStudentType && selectedStudentType !== "all") {
      list = list.filter(
        (s) =>
          (s.studentStatus || "Regular").toLowerCase() ===
          selectedStudentType.toLowerCase(),
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.admissionNo.toLowerCase().includes(q) ||
          (s.pinNo && s.pinNo.toLowerCase().includes(q)),
      );
    }

    if (statusFilter === "safe") {
      list = list.filter((s) => s.percentage >= 75);
    } else if (statusFilter === "warning") {
      list = list.filter((s) => s.percentage >= 65 && s.percentage < 75);
    } else if (statusFilter === "critical") {
      list = list.filter((s) => s.percentage < 65);
    }

    return list;
  }, [monthlyData?.students, searchQuery, statusFilter, selectedStudentType]);

  // Filtered Students for Semester Tab
  const filteredSemesterStudents = useMemo(() => {
    if (!semesterData?.students) return [];
    let list = semesterData.students;

    if (selectedStudentType && selectedStudentType !== "all") {
      list = list.filter(
        (s) =>
          (s.studentStatus || "Regular").toLowerCase() ===
          selectedStudentType.toLowerCase(),
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.admissionNo.toLowerCase().includes(q) ||
          (s.pinNo && s.pinNo.toLowerCase().includes(q)),
      );
    }

    if (statusFilter === "eligible") {
      list = list.filter((s) => s.eligibility === "Eligible");
    } else if (statusFilter === "condonation") {
      list = list.filter((s) => s.eligibility === "Condonation Required");
    } else if (statusFilter === "detained") {
      list = list.filter((s) => s.eligibility === "Detained");
    }

    return list;
  }, [semesterData?.students, searchQuery, statusFilter, selectedStudentType]);

  // Filtered Slots Groups for All Colleges Stats Format
  const filteredSlotsGroups = useMemo(() => {
    if (!slotsSummaryData?.groups) return [];
    let list = slotsSummaryData.groups;

    if (slotsSearchQuery.trim()) {
      const q = slotsSearchQuery.trim().toLowerCase();
      list = list.filter((g) => {
        const matchBasic =
          g.collegeName.toLowerCase().includes(q) ||
          g.collegeCode.toLowerCase().includes(q) ||
          g.courseName.toLowerCase().includes(q) ||
          g.courseCode.toLowerCase().includes(q) ||
          g.branchName.toLowerCase().includes(q) ||
          g.branchCode.toLowerCase().includes(q) ||
          g.yearLabel.toLowerCase().includes(q);

        if (matchBasic) return true;

        return g.slots.some(
          (s) =>
            (s.subjectName && s.subjectName.toLowerCase().includes(q)) ||
            (s.subjectCode && s.subjectCode.toLowerCase().includes(q)) ||
            (s.facultyName && s.facultyName.toLowerCase().includes(q)) ||
            s.slotLabel.toLowerCase().includes(q) ||
            (s.section && s.section.toLowerCase().includes(q)) ||
            (g.sections && g.sections.some((sec) => sec.sectionName.toLowerCase().includes(q))),
        );
      });
    }

    if (slotsStatusFilter === "posted") {
      list = list.filter((g) => g.postedSessions > 0);
    } else if (slotsStatusFilter === "pending") {
      list = list.filter((g) => g.pendingSessions > 0);
    } else if (slotsStatusFilter === "below65") {
      list = list.filter((g) => g.attendancePct < 65 && g.postedSessions > 0);
    } else if (slotsStatusFilter === "above75") {
      list = list.filter((g) => g.attendancePct >= 75 && g.postedSessions > 0);
    }

    return list;
  }, [slotsSummaryData?.groups, slotsSearchQuery, slotsStatusFilter]);

  // Flattened Section Rows for Section-Wise Dynamic Table
  type SectionTableRow = {
    group: CollegeCourseBranchYearSlotStats;
    section: SectionSlotStats;
    rowKey: string;
  };

  const flattenedSectionRows = useMemo<SectionTableRow[]>(() => {
    const rows: SectionTableRow[] = [];
    const q = slotsSearchQuery.trim().toLowerCase();

    filteredSlotsGroups.forEach((group) => {
      const cohortKey = `${group.collegeId}-${group.courseId}-${group.branchId}-${group.yearOfStudy}`;
      const groupSections: SectionSlotStats[] =
        group.sections && group.sections.length > 0
          ? group.sections
          : [
              {
                sectionName: "A",
                totalStudents: group.totalStudents,
                totalSessions: group.totalSessions,
                postedSessions: group.postedSessions,
                pendingSessions: group.pendingSessions,
                totalPresent: group.totalPresent,
                totalAbsent: group.totalAbsent,
                totalOd: group.totalOd,
                totalLeave: group.totalLeave,
                attendancePct: group.attendancePct,
                slots: group.slots,
              },
            ];

      groupSections.forEach((sec) => {
        // Apply status filter to section if specified
        if (slotsStatusFilter === "posted" && sec.postedSessions === 0) return;
        if (slotsStatusFilter === "pending" && sec.pendingSessions === 0) return;
        if (slotsStatusFilter === "below65" && (sec.attendancePct >= 65 || sec.postedSessions === 0)) return;
        if (slotsStatusFilter === "above75" && (sec.attendancePct < 75 || sec.postedSessions === 0)) return;

        // Apply search query to section if specific
        if (q) {
          const matchCohort =
            group.collegeName.toLowerCase().includes(q) ||
            group.collegeCode.toLowerCase().includes(q) ||
            group.courseName.toLowerCase().includes(q) ||
            group.courseCode.toLowerCase().includes(q) ||
            group.branchName.toLowerCase().includes(q) ||
            group.branchCode.toLowerCase().includes(q) ||
            group.yearLabel.toLowerCase().includes(q);

          const matchSection =
            sec.sectionName.toLowerCase().includes(q) ||
            `sec ${sec.sectionName.toLowerCase()}`.includes(q) ||
            `section ${sec.sectionName.toLowerCase()}`.includes(q);

          const matchSlots = sec.slots.some(
            (s) =>
              (s.subjectName && s.subjectName.toLowerCase().includes(q)) ||
              (s.subjectCode && s.subjectCode.toLowerCase().includes(q)) ||
              (s.facultyName && s.facultyName.toLowerCase().includes(q)) ||
              s.slotLabel.toLowerCase().includes(q),
          );

          if (!matchCohort && !matchSection && !matchSlots) return;
        }

        rows.push({
          group,
          section: sec,
          rowKey: `${cohortKey}-${sec.sectionName}`,
        });
      });
    });

    return rows;
  }, [filteredSlotsGroups, slotsSearchQuery, slotsStatusFilter]);

  const tableSummary = useMemo(() => {
    let totalSections = flattenedSectionRows.length;
    let totalStudents = 0;
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalSlots = 0;
    let conductedSlots = 0;

    flattenedSectionRows.forEach((r) => {
      totalStudents += r.section.totalStudents;
      totalPresent += r.section.totalPresent;
      totalAbsent += r.section.totalAbsent;
      totalSlots += r.section.totalSessions;
      conductedSlots += r.section.postedSessions;
    });

    const totalMarks = totalPresent + totalAbsent;
    const avgAttendancePct = totalMarks > 0 ? Math.round((totalPresent / totalMarks) * 100) : 0;

    return {
      totalSections,
      totalStudents,
      totalPresent,
      totalAbsent,
      totalSlots,
      conductedSlots,
      avgAttendancePct,
    };
  }, [flattenedSectionRows]);

  // Export Table to CSV
  const handleExportCSV = () => {
    let csvContent = "";
    let fileName = `attendance_analytics_${activeTab}.csv`;

    if (activeTab === "today" && viewMode === "stats" && slotsSummaryData) {
      fileName = `attendance_reports_sections_${selectedDate}.csv`;
      csvContent = `S.No,College,Course,Branch,Year,Semester,Section,Strength,Total Slots,Conducted Slots,Pending Slots,Present,Absent,OD,Leave,Attendance Pct\n`;
      let sNo = 1;
      filteredSlotsGroups.forEach((g) => {
        const sem = g.semesterNumber ? `Sem ${g.semesterNumber}` : "—";
        const sectionsToExport =
          g.sections && g.sections.length > 0
            ? g.sections
            : [
                {
                  sectionName: "A",
                  totalStudents: g.totalStudents,
                  totalSessions: g.totalSessions,
                  postedSessions: g.postedSessions,
                  pendingSessions: g.pendingSessions,
                  totalPresent: g.totalPresent,
                  totalAbsent: g.totalAbsent,
                  totalOd: g.totalOd,
                  totalLeave: g.totalLeave,
                  attendancePct: g.attendancePct,
                  slots: g.slots,
                },
              ];

        sectionsToExport.forEach((sec) => {
          csvContent += `${sNo++},"${g.collegeName.replace(/"/g, '""')}","${g.courseName.replace(/"/g, '""')}","${g.branchName.replace(/"/g, '""')}","${g.yearLabel}","${sem}","Sec ${sec.sectionName}",${sec.totalStudents},${sec.totalSessions},${sec.postedSessions},${sec.pendingSessions},${sec.totalPresent},${sec.totalAbsent},${sec.totalOd},${sec.totalLeave},"${sec.attendancePct}%"\n`;
        });
      });
    } else if (activeTab === "today" && dailyData) {
      fileName = `daily_attendance_${selectedDate}_${dailyData.section || "section"}.csv`;
      const slotHeaders = dailyData.slots
        .map((s) => `"${s.slotLabel} (${s.time}) - ${s.subjectCode || "Class"}"`)
        .join(",");
      csvContent = `S.No,PIN Number,Admission No,Student Name,${slotHeaders},Total Present,Total Absent,Total Conducted,Percentage\n`;

      filteredDailyStudents.forEach((student, index) => {
        const slotMarks = dailyData.slots
          .map((slot) => {
            const st = student.slots[slot.sessionId]?.status || "pending";
            return st === "present"
              ? "P"
              : st === "absent"
                ? "A"
                : st === "od"
                  ? "OD"
                  : st === "leave"
                    ? "L"
                    : "-";
          })
          .join(",");

        const pin = (student.pinNo || student.admissionNo).replace(/"/g, '""');
        const name = student.name.replace(/"/g, '""');
        const pct = student.percentage !== null ? `${student.percentage}%` : "—";
        csvContent += `${index + 1},"${pin}","${student.admissionNo}","${name}",${slotMarks},${student.totalPresent},${student.totalAbsent},${student.totalConducted},"${pct}"\n`;
      });
    } else if (activeTab === "week" && weeklyData) {
      fileName = `weekly_attendance_${weeklyData.startDate}_to_${weeklyData.endDate}.csv`;
      const slotHeaders: string[] = [];
      weeklyData.days.forEach((day) => {
        if (day.slots.length === 0) {
          slotHeaders.push(`"${day.dayOfWeek} (${day.date})"`);
        } else {
          day.slots.forEach((s) => {
            slotHeaders.push(`"${day.dayOfWeek} ${s.slotLabel} - ${s.subjectCode || "Class"}"`);
          });
        }
      });
      csvContent = `S.No,PIN Number,Admission No,Student Name,${slotHeaders.join(",")},Total Present,Total Absent,Total Conducted,Percentage\n`;

      filteredWeeklyStudents.forEach((student, index) => {
        const slotValues: string[] = [];
        weeklyData.days.forEach((day) => {
          const studentDay = student.days[day.date];
          if (day.slots.length === 0) {
            slotValues.push(`"-"`);
          } else {
            day.slots.forEach((s) => {
              const mark = studentDay?.slots[s.sessionId]?.status || "pending";
              slotValues.push(
                mark === "present"
                  ? "P"
                  : mark === "absent"
                    ? "A"
                    : mark === "od"
                      ? "OD"
                      : mark === "leave"
                        ? "L"
                        : "-",
              );
            });
          }
        });
        const pin = (student.pinNo || student.admissionNo).replace(/"/g, '""');
        const name = student.name.replace(/"/g, '""');
        const pct = student.percentage !== null ? `${student.percentage}%` : "—";
        csvContent += `${index + 1},"${pin}","${student.admissionNo}","${name}",${slotValues.join(",")},${student.totalPresent},${student.totalAbsent},${student.totalConducted},"${pct}"\n`;
      });
    } else if (activeTab === "month" && monthlyData) {
      fileName = `monthly_attendance_${monthlyData.month}_${monthlyData.year}.csv`;
      csvContent = `S.No,PIN Number,Admission No,Student Name,Total Working Sessions,Total Present,Total Absent,OD,Leave,Percentage,Status\n`;

      filteredMonthlyStudents.forEach((s, idx) => {
        const pin = (s.pinNo || s.admissionNo).replace(/"/g, '""');
        const name = s.name.replace(/"/g, '""');
        csvContent += `${idx + 1},"${pin}","${s.admissionNo}","${name}",${s.totalSlots},${s.presentCount},${s.absentCount},${s.odCount},${s.leaveCount},"${s.percentage}%","${s.status}"\n`;
      });
    } else if (activeTab === "semester" && semesterData) {
      fileName = `semester_attendance_sem${selectedSemester}.csv`;
      csvContent = `S.No,PIN Number,Admission No,Student Name,Total Classes,Total Present,Total Absent,Percentage,Eligibility Status\n`;

      filteredSemesterStudents.forEach((s, idx) => {
        const pin = (s.pinNo || s.admissionNo).replace(/"/g, '""');
        const name = s.name.replace(/"/g, '""');
        csvContent += `${idx + 1},"${pin}","${s.admissionNo}","${name}",${s.totalClasses},${s.presentCount},${s.absentCount},"${s.percentage}%","${s.eligibility}"\n`;
      });
    }

    if (!csvContent) return;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const sectionsList = dailyData?.availableSections || weeklyData?.availableSections || [];

  return (
    <div className="space-y-3 pb-8">
      {!embedded ? (
        <div className="print:hidden">
          <AcademicFilterBar title="Attendance Analytics Filters" />
        </div>
      ) : null}
      {/* Compact Top Header Bar: Title + Tabs + Export */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
        <div className="flex flex-wrap items-center gap-3">
          {!embedded ? (
            <h1 className="hidden print:flex text-base font-bold text-navy-900 tracking-tight items-center gap-2">
              <span>Attendance Analytics</span>
            </h1>
          ) : null}

          {/* Compact Pill Tabs */}
          <nav className="inline-flex items-center rounded-lg bg-slate-100 p-0.5" aria-label="Tabs">
            <button
              type="button"
              onClick={() => {
                setActiveTab("today");
                setStatusFilter("all");
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all",
                activeTab === "today"
                  ? "bg-white text-navy-900 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Today (Slots)</span>
              {viewMode === "stats" && slotsSummaryData?.summary?.totalSessions ? (
                <span className="rounded bg-navy-100 px-1.5 py-0.2 text-[10px] text-navy-800 font-bold">
                  {slotsSummaryData.summary.totalSessions}
                </span>
              ) : dailyData?.slots && dailyData.slots.length > 0 ? (
                <span className="rounded bg-navy-100 px-1.5 py-0.2 text-[10px] text-navy-800 font-bold">
                  {dailyData.slots.length}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("week");
                setStatusFilter("all");
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all",
                activeTab === "week"
                  ? "bg-white text-navy-900 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Week (Slots)</span>
              {weeklyData?.summary?.totalSlotsInWeek ? (
                <span className="rounded bg-navy-100 px-1.5 py-0.2 text-[10px] text-navy-800 font-bold">
                  {weeklyData.summary.totalSlotsInWeek}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("month");
                setStatusFilter("all");
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all",
                activeTab === "month"
                  ? "bg-white text-navy-900 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span>Month</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("semester");
                setStatusFilter("all");
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all",
                activeTab === "semester"
                  ? "bg-white text-navy-900 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              <GraduationCap className="h-3.5 w-3.5" />
              <span>Semester Wise</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("overview");
                setStatusFilter("all");
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all",
                activeTab === "overview"
                  ? "bg-white text-navy-900 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              <PieChart className="h-3.5 w-3.5" />
              <span>Overview</span>
            </button>
          </nav>
        </div>

        {/* Action button */}
        <button
          type="button"
          onClick={handleExportCSV}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
        >
          <Download className="h-3.5 w-3.5 text-slate-500" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Unified Compact Action Toolbar (Zero wasted vertical space) */}
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-2xs flex flex-wrap items-center justify-between gap-2.5 text-xs">
        {/* Left Side: Date / Month / Semester Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === "today" && (
            <>
              <div className="flex items-center rounded-md border border-slate-200 bg-slate-50 p-0.5">
                <button
                  type="button"
                  onClick={() => handleJumpDate(-1)}
                  className="rounded p-1 text-slate-600 hover:bg-white hover:text-slate-900"
                  title="Previous Day"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent px-1.5 py-0.5 text-xs font-semibold text-slate-800 outline-none cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => handleJumpDate(1)}
                  className="rounded p-1 text-slate-600 hover:bg-white hover:text-slate-900"
                  title="Next Day"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleSetToday}
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-semibold transition-colors border",
                  selectedDate === getTodayString()
                    ? "border-navy-900 bg-navy-900 text-white"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100",
                )}
              >
                Today
              </button>
              <button
                type="button"
                onClick={handleSetYesterday}
                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Yesterday
              </button>

              {/* View Mode Toggle: All Colleges Stats Format vs Section Attendance Sheet */}
              <div className="flex items-center rounded-md border border-slate-200 bg-slate-100 p-0.5 ml-1">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("stats");
                    setSelectedCohortDetail(null);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-semibold transition-all",
                    viewMode === "stats"
                      ? "bg-white text-navy-900 shadow-2xs font-bold"
                      : "text-slate-600 hover:text-slate-900",
                  )}
                  title="Aggregated College, Course, Branch, Year slots statistics"
                >
                  <BarChart3 className="h-3.5 w-3.5 text-navy-700" />
                  <span>Stats Format</span>
                  {slotsSummaryData?.groups && (
                    <span className="rounded-full bg-navy-100 px-1.5 py-0.2 text-[10px] font-bold text-navy-800">
                      {slotsSummaryData.groups.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("sheet")}
                  className={cn(
                    "flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-semibold transition-all",
                    viewMode === "sheet"
                      ? "bg-white text-navy-900 shadow-2xs font-bold"
                      : "text-slate-600 hover:text-slate-900",
                  )}
                  title="Section student-by-student daily attendance roster"
                >
                  <Layers className="h-3.5 w-3.5 text-slate-700" />
                  <span>Section Sheet</span>
                  {selectedCohortDetail && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  )}
                </button>
              </div>

              {viewMode === "sheet" && sectionsList.length > 0 && (
                <div className="flex items-center gap-1 ml-1 pl-2 border-l border-slate-200">
                  <span className="text-slate-500 font-medium">Sec:</span>
                  <select
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                    className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-semibold text-slate-800 outline-none hover:bg-white focus:bg-white cursor-pointer"
                  >
                    {sectionsList.map((sec) => (
                      <option key={sec} value={sec}>
                        {sec}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Quick Semester Shift on Today's attendance */}
              <div className="flex items-center gap-1 ml-1 pl-2 border-l border-slate-200">
                <span className="text-slate-500 font-medium">Sem:</span>
                <select
                  value={selectedSemester}
                  onChange={(e) => handleSemesterChange(Number(e.target.value))}
                  className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-semibold text-slate-800 outline-none hover:bg-white focus:bg-white cursor-pointer"
                >
                  {semesterOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {activeTab === "week" && (
            <>
              <div className="flex items-center rounded-md border border-slate-200 bg-slate-50 p-0.5">
                <button
                  type="button"
                  onClick={() => handleJumpWeek(-1)}
                  className="rounded p-1 text-slate-600 hover:bg-white hover:text-slate-900"
                  title="Previous Week"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="px-2 py-0.5 text-xs font-semibold text-slate-800">
                  {weeklyData?.weekLabel || selectedWeekStart}
                </span>
                <button
                  type="button"
                  onClick={() => handleJumpWeek(1)}
                  className="rounded p-1 text-slate-600 hover:bg-white hover:text-slate-900"
                  title="Next Week"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleSetThisWeek}
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-semibold transition-colors border",
                  selectedWeekStart === getMonday(new Date())
                    ? "border-navy-900 bg-navy-900 text-white"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100",
                )}
              >
                This Week
              </button>

              {sectionsList.length > 0 && (
                <div className="flex items-center gap-1 ml-1 pl-2 border-l border-slate-200">
                  <span className="text-slate-500 font-medium">Sec:</span>
                  <select
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                    className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-semibold text-slate-800 outline-none hover:bg-white focus:bg-white cursor-pointer"
                  >
                    {sectionsList.map((sec) => (
                      <option key={sec} value={sec}>
                        {sec}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Quick Semester Shift on Week view */}
              <div className="flex items-center gap-1 ml-1 pl-2 border-l border-slate-200">
                <span className="text-slate-500 font-medium">Sem:</span>
                <select
                  value={selectedSemester}
                  onChange={(e) => handleSemesterChange(Number(e.target.value))}
                  className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-semibold text-slate-800 outline-none hover:bg-white focus:bg-white cursor-pointer"
                >
                  {semesterOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {activeTab === "month" && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Month:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-800 outline-none hover:bg-white focus:bg-white cursor-pointer"
                >
                  {[
                    "January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December",
                  ].map((name, idx) => (
                    <option key={name} value={idx + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Year:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-800 outline-none hover:bg-white focus:bg-white cursor-pointer"
                >
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Semester Shift on Monthly view */}
              <div className="flex items-center gap-1 ml-1 pl-2 border-l border-slate-200">
                <span className="text-slate-500 font-medium">Sem:</span>
                <select
                  value={selectedSemester}
                  onChange={(e) => handleSemesterChange(Number(e.target.value))}
                  className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-semibold text-slate-800 outline-none hover:bg-white focus:bg-white cursor-pointer"
                >
                  {semesterOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {activeTab === "semester" && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Semester:</span>
              <select
                value={selectedSemester}
                onChange={(e) => handleSemesterChange(Number(e.target.value))}
                className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-800 outline-none hover:bg-white focus:bg-white cursor-pointer"
              >
                {semesterOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {/* Student Type Selection (Defaults to Regular students only) */}
          <div className="flex items-center gap-1.5 ml-1 pl-2 border-l border-slate-200">
            <span className="text-slate-500 font-medium">Type:</span>
            <select
              value={selectedStudentType}
              onChange={(e) => setSelectedStudentType(e.target.value)}
              className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-800 outline-none hover:bg-white focus:bg-white cursor-pointer"
              title="Student Type selection (defaults to Regular students only)"
            >
              <option value="Regular">Regular Only</option>
              <option value="all">All Students</option>
            </select>
          </div>
        </div>

        {/* Center: Sleek Inline Summary Chips (Replacing the huge stat boxes!) */}
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === "today" && viewMode === "stats" && slotsSummaryData && (
            <>
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                <Building2 className="h-3 w-3 text-slate-500" />
                <span>{slotsSummaryData.summary.totalColleges} Colleges</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                <Users className="h-3 w-3 text-slate-500" />
                <span>
                  {slotsSummaryData.summary.totalStudents.toLocaleString()}{" "}
                  {selectedStudentType === "Regular" ? "Regular Students" : "Students"}
                </span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-navy-50 px-2 py-0.5 text-xs font-semibold text-navy-800">
                <Clock className="h-3 w-3 text-navy-600" />
                <span>{slotsSummaryData.summary.postedSessions}/{slotsSummaryData.summary.totalSessions} Slots</span>
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold",
                  slotsSummaryData.summary.overallAttendancePct >= 75
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-amber-50 text-amber-800",
                )}
              >
                <TrendingUp className="h-3 w-3" />
                <span>{slotsSummaryData.summary.overallAttendancePct}% Avg</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200">
                <span className="text-emerald-700 font-bold">{slotsSummaryData.summary.overallPresent}P</span>
                <span>/</span>
                <span className="text-rose-700 font-bold">{slotsSummaryData.summary.overallAbsent}A</span>
              </span>
            </>
          )}

          {activeTab === "today" && viewMode === "sheet" && dailyData && (
            <>
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                <Users className="h-3 w-3 text-slate-500" />
                <span>
                  {dailyData.summary.totalStudents}{" "}
                  {selectedStudentType === "Regular" ? "Regular Students" : "Students"}
                </span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-navy-50 px-2 py-0.5 text-xs font-semibold text-navy-800">
                <Clock className="h-3 w-3 text-navy-600" />
                <span>{dailyData.summary.postedSlots}/{dailyData.summary.totalSlots} Slots</span>
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold",
                  dailyData.summary.avgAttendancePct >= 75
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-amber-50 text-amber-800",
                )}
              >
                <TrendingUp className="h-3 w-3" />
                <span>{dailyData.summary.avgAttendancePct}% Avg</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200">
                <span className="text-emerald-700 font-bold">{dailyData.summary.totalPresentMarks}P</span>
                <span>/</span>
                <span className="text-rose-700 font-bold">{dailyData.summary.totalAbsentMarks}A</span>
              </span>
            </>
          )}

          {activeTab === "week" && weeklyData && (
            <>
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                <Users className="h-3 w-3 text-slate-500" />
                <span>
                  {weeklyData.summary.totalStudents}{" "}
                  {selectedStudentType === "Regular" ? "Regular Students" : "Students"}
                </span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-navy-50 px-2 py-0.5 text-xs font-semibold text-navy-800">
                <Clock className="h-3 w-3 text-navy-600" />
                <span>{weeklyData.summary.postedSlotsInWeek}/{weeklyData.summary.totalSlotsInWeek} Slots</span>
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold",
                  weeklyData.summary.avgAttendancePct >= 75
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-amber-50 text-amber-800",
                )}
              >
                <TrendingUp className="h-3 w-3" />
                <span>{weeklyData.summary.avgAttendancePct}% Avg</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200">
                <span className="text-emerald-700 font-bold">{weeklyData.summary.totalPresentMarks}P</span>
                <span>/</span>
                <span className="text-rose-700 font-bold">{weeklyData.summary.totalAbsentMarks}A</span>
              </span>
            </>
          )}

          {activeTab === "month" && monthlyData && (
            <>
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                <Users className="h-3 w-3 text-slate-500" />
                <span>
                  {monthlyData.summary.totalStudents}{" "}
                  {selectedStudentType === "Regular" ? "Regular Students" : "Students"}
                </span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-navy-50 px-2 py-0.5 text-xs font-semibold text-navy-800">
                <span>{monthlyData.summary.totalSessionsConducted} Sessions</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-800">
                <span>{monthlyData.summary.avgAttendancePct}% Avg</span>
              </span>
            </>
          )}

          {activeTab === "semester" && semesterData && (
            <>
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                <Users className="h-3 w-3 text-slate-500" />
                <span>
                  {semesterData.summary.totalStudents}{" "}
                  {selectedStudentType === "Regular" ? "Regular Students" : "Students"}
                </span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-800">
                <span>{semesterData.summary.eligibleCount} Eligible</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800">
                <span>{semesterData.summary.condonationCount} Condonation</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-800">
                <span>{semesterData.summary.detainedCount} Detained</span>
              </span>
            </>
          )}
        </div>

        {/* Right Side: Search & Quick Status Filters */}
        {activeTab !== "overview" && (
          <div className="flex items-center gap-2 ml-auto">
            {activeTab === "today" && viewMode === "stats" ? (
              <>
                <div className="relative w-44 sm:w-56">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search College, Branch..."
                    value={slotsSearchQuery}
                    onChange={(e) => setSlotsSearchQuery(e.target.value)}
                    className="w-full rounded-md border border-slate-200 bg-slate-50 pl-7 pr-2 py-1 text-xs text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-navy-700"
                  />
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSlotsStatusFilter("all")}
                    className={cn(
                      "rounded px-2 py-0.5 text-[11px] font-semibold transition-colors",
                      slotsStatusFilter === "all"
                        ? "bg-slate-800 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                    )}
                  >
                    All ({slotsSummaryData?.groups?.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlotsStatusFilter("posted")}
                    className={cn(
                      "rounded px-2 py-0.5 text-[11px] font-semibold transition-colors",
                      slotsStatusFilter === "posted"
                        ? "bg-emerald-700 text-white"
                        : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                    )}
                  >
                    Posted
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlotsStatusFilter("pending")}
                    className={cn(
                      "rounded px-2 py-0.5 text-[11px] font-semibold transition-colors",
                      slotsStatusFilter === "pending"
                        ? "bg-amber-700 text-white"
                        : "bg-amber-50 text-amber-700 hover:bg-amber-100",
                    )}
                  >
                    Pending
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlotsStatusFilter("below65")}
                    className={cn(
                      "rounded px-2 py-0.5 text-[11px] font-semibold transition-colors",
                      slotsStatusFilter === "below65"
                        ? "bg-rose-700 text-white"
                        : "bg-rose-50 text-rose-700 hover:bg-rose-100",
                    )}
                  >
                    &lt;65%
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlotsStatusFilter("above75")}
                    className={cn(
                      "rounded px-2 py-0.5 text-[11px] font-semibold transition-colors",
                      slotsStatusFilter === "above75"
                        ? "bg-emerald-700 text-white"
                        : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                    )}
                  >
                    &ge;75%
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="relative w-40 sm:w-48">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search PIN / Name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-md border border-slate-200 bg-slate-50 pl-7 pr-2 py-1 text-xs text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-navy-700"
                  />
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setStatusFilter("all")}
                    className={cn(
                      "rounded px-2 py-0.5 text-[11px] font-semibold transition-colors",
                      statusFilter === "all"
                        ? "bg-slate-800 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                    )}
                  >
                    All
                  </button>

                  {(activeTab === "today" || activeTab === "week") && (
                    <>
                      <button
                        type="button"
                        onClick={() => setStatusFilter("present")}
                        className={cn(
                          "rounded px-2 py-0.5 text-[11px] font-semibold transition-colors",
                          statusFilter === "present"
                            ? "bg-emerald-700 text-white"
                            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                        )}
                      >
                        Present
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter("absent")}
                        className={cn(
                          "rounded px-2 py-0.5 text-[11px] font-semibold transition-colors",
                          statusFilter === "absent"
                            ? "bg-rose-700 text-white"
                            : "bg-rose-50 text-rose-700 hover:bg-rose-100",
                        )}
                      >
                        Absent
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter("below75")}
                        className={cn(
                          "rounded px-2 py-0.5 text-[11px] font-semibold transition-colors",
                          statusFilter === "below75"
                            ? "bg-amber-700 text-white"
                            : "bg-amber-50 text-amber-700 hover:bg-amber-100",
                        )}
                      >
                        &lt;75%
                      </button>
                    </>
                  )}

                  {activeTab === "month" && (
                    <>
                      <button
                        type="button"
                        onClick={() => setStatusFilter("safe")}
                        className={cn(
                          "rounded px-2 py-0.5 text-[11px] font-semibold transition-colors",
                          statusFilter === "safe"
                            ? "bg-emerald-700 text-white"
                            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                        )}
                      >
                        Safe
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter("critical")}
                        className={cn(
                          "rounded px-2 py-0.5 text-[11px] font-semibold transition-colors",
                          statusFilter === "critical"
                            ? "bg-rose-700 text-white"
                            : "bg-rose-50 text-rose-700 hover:bg-rose-100",
                        )}
                      >
                        Critical
                      </button>
                    </>
                  )}

                  {activeTab === "semester" && (
                    <>
                      <button
                        type="button"
                        onClick={() => setStatusFilter("eligible")}
                        className={cn(
                          "rounded px-2 py-0.5 text-[11px] font-semibold transition-colors",
                          statusFilter === "eligible"
                            ? "bg-emerald-700 text-white"
                            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                        )}
                      >
                        Eligible
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter("detained")}
                        className={cn(
                          "rounded px-2 py-0.5 text-[11px] font-semibold transition-colors",
                          statusFilter === "detained"
                            ? "bg-rose-700 text-white"
                            : "bg-rose-50 text-rose-700 hover:bg-rose-100",
                        )}
                      >
                        Detained
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-4 portal-fade-in">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {[1, 2, 3, 4].map((i) => (
              <StatCardSkeleton key={i} compact />
            ))}
          </div>
          <TableSkeleton columns={6} rows={6} showHeader />
        </div>
      ) : (
        <>
          {/* ======================================================== */}
          {/* TAB 1: TODAY (DAY TIMETABLE SLOTS)                        */}
          {/* ======================================================== */}
          {activeTab === "today" && (
            viewMode === "stats" || (filters.collegeId === "all" && !selectedCohortDetail) ? (
              <div className="space-y-4 portal-fade-in">
                {/* Executive KPI Cards (5 Cards) */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 sm:gap-3">
                  {/* Card 1: Colleges Covered */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs hover:shadow-xs transition-shadow">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider">Colleges Covered</span>
                      <div className="rounded-lg bg-indigo-50 p-1.5 text-indigo-600">
                        <Building2 className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="text-xl font-bold text-navy-950">
                      {slotsSummaryData?.summary.totalColleges || 0}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Institutions reporting today
                    </div>
                  </div>

                  {/* Card 2: Programs & Branches */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs hover:shadow-xs transition-shadow">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider">Academic Streams</span>
                      <div className="rounded-lg bg-sky-50 p-1.5 text-sky-600">
                        <Layers className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="text-xl font-bold text-navy-950">
                      {slotsSummaryData?.summary.totalCourses || 0} Courses &bull; {slotsSummaryData?.summary.totalBranches || 0} Branches
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {slotsSummaryData?.groups.length || 0} active cohort streams
                    </div>
                  </div>

                  {/* Card 3: Total Enrolled Students */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs hover:shadow-xs transition-shadow">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider">Enrolled Students</span>
                      <div className="rounded-lg bg-emerald-50 p-1.5 text-emerald-600">
                        <Users className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="text-xl font-bold text-emerald-900">
                      {(slotsSummaryData?.summary.totalStudents || 0).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Across all batches &amp; sections
                    </div>
                  </div>

                  {/* Card 4: Slots Conducted Today */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs hover:shadow-xs transition-shadow">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider">Timetable Slots</span>
                      <div className="rounded-lg bg-amber-50 p-1.5 text-amber-600">
                        <Clock className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="text-xl font-bold text-navy-950">
                      {slotsSummaryData?.summary.postedSessions || 0} / {slotsSummaryData?.summary.totalSessions || 0}
                    </div>
                    <div className="text-[10px] text-amber-700 font-medium mt-0.5">
                      {slotsSummaryData?.summary.pendingSessions || 0} sessions pending posting
                    </div>
                  </div>

                  {/* Card 5: Overall Attendance Rate */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs hover:shadow-xs transition-shadow col-span-2 sm:col-span-1">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider">Campus Attendance</span>
                      <div className="rounded-lg bg-purple-50 p-1.5 text-purple-600">
                        <TrendingUp className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="text-xl font-bold text-purple-900">
                      {slotsSummaryData?.summary.overallAttendancePct || 0}%
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {slotsSummaryData?.summary.overallPresent || 0} Present &bull; {slotsSummaryData?.summary.overallAbsent || 0} Absent
                    </div>
                  </div>
                </div>

                {/* Dynamic Tabular Attendance Reports Section */}
                <div className="space-y-3">
                  {/* Modern Header / Toolbar Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-navy-900 uppercase tracking-wider">
                          Attendance Reports Overview
                        </span>
                        <span className="rounded-full bg-navy-100 px-2 py-0.5 text-[11px] font-bold text-navy-800">
                          {slotsTableViewMode === "bySection"
                            ? `${flattenedSectionRows.length} Sections`
                            : `${filteredSlotsGroups.length} Cohorts`}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          ({selectedDate})
                        </span>
                      </div>

                      {/* View Mode Toggle: Section-Wise vs Grouped Cohort */}
                      <div className="inline-flex items-center rounded-lg bg-slate-100 p-0.5 border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setSlotsTableViewMode("bySection")}
                          className={cn(
                            "px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
                            slotsTableViewMode === "bySection"
                              ? "bg-white text-navy-950 font-bold shadow-2xs"
                              : "text-slate-600 hover:text-navy-900",
                          )}
                        >
                          Section-wise Table
                        </button>
                        <button
                          type="button"
                          onClick={() => setSlotsTableViewMode("byCohort")}
                          className={cn(
                            "px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer",
                            slotsTableViewMode === "byCohort"
                              ? "bg-white text-navy-950 font-bold shadow-2xs"
                              : "text-slate-600 hover:text-navy-900",
                          )}
                        >
                          Grouped by Cohort
                        </button>
                      </div>

                      {slotsTableViewMode === "byCohort" && (
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <button
                            type="button"
                            onClick={expandAllCohorts}
                            className="text-navy-700 hover:text-navy-950 hover:underline font-semibold cursor-pointer"
                          >
                            Expand All
                          </button>
                          <span className="text-slate-300">&bull;</span>
                          <button
                            type="button"
                            onClick={collapseAllCohorts}
                            className="text-slate-500 hover:text-slate-800 hover:underline font-medium cursor-pointer"
                          >
                            Collapse All
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5 text-xs text-slate-500">
                      <span className="hidden lg:inline text-slate-500">
                        Click any row to open the student-by-student attendance matrix.
                      </span>
                      <button
                        type="button"
                        onClick={handleExportCSV}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-navy-900 transition-colors cursor-pointer"
                        title="Export Tabular Attendance Report as CSV"
                      >
                        <Download className="h-3.5 w-3.5 text-slate-600" />
                        <span>Export CSV</span>
                      </button>
                    </div>
                  </div>

                  {slotsTableViewMode === "bySection" ? (
                    /* ================= SECTION-WISE DYNAMIC TABLE ================= */
                    <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-100/95 text-slate-700 font-bold text-[11px] uppercase tracking-wider select-none">
                              <th className="px-3 py-2.5 text-center w-12">#</th>
                              <th className="px-3 py-2.5 min-w-[130px]">Course Name</th>
                              <th className="px-3 py-2.5 min-w-[170px]">Branch</th>
                              <th className="px-3 py-2.5 min-w-[110px]">Year &amp; Sem</th>
                              <th className="px-3 py-2.5 text-center min-w-[90px]">Section</th>
                              <th className="px-3 py-2.5 text-center min-w-[85px]">Strength</th>
                              <th className="px-3 py-2.5 text-center min-w-[85px]">Present</th>
                              <th className="px-3 py-2.5 text-center min-w-[85px]">Absent</th>
                              <th className="px-3 py-2.5 min-w-[180px]">Slots (Conducted / Total)</th>
                              <th className="px-3 py-2.5 text-center min-w-[110px]">Attendance %</th>
                              <th className="px-3 py-2.5 text-right min-w-[120px]">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {flattenedSectionRows.length === 0 ? (
                              <tr>
                                <td colSpan={11} className="p-8 text-center text-slate-500">
                                  <Filter className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                                  <p className="font-semibold text-slate-700">No sections found matching your filters for this date.</p>
                                  <p className="text-xs text-slate-500 mt-1">Try resetting search filters or selecting another date.</p>
                                </td>
                              </tr>
                            ) : (
                              flattenedSectionRows.map(({ group, section, rowKey }, idx) => {
                                const isGood = section.attendancePct >= 75 && section.postedSessions > 0;
                                const isCritical = section.attendancePct < 65 && section.postedSessions > 0;
                                const slotsPct =
                                  section.totalSessions > 0
                                    ? Math.round((section.postedSessions / section.totalSessions) * 100)
                                    : 0;

                                return (
                                  <tr
                                    key={rowKey}
                                    onClick={() => handleLoadCohortDetails(group, section.sectionName)}
                                    className="hover:bg-sky-50/50 transition-colors cursor-pointer group"
                                  >
                                    {/* # S.No */}
                                    <td className="px-3 py-2.5 text-center font-semibold text-slate-400 group-hover:text-navy-900">
                                      {idx + 1}
                                    </td>

                                    {/* Course Name */}
                                    <td className="px-3 py-2.5">
                                      <div className="flex items-center gap-1.5">
                                        <span className="rounded bg-navy-900 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider shrink-0">
                                          {group.collegeCode}
                                        </span>
                                        <span className="font-bold text-navy-950 text-xs">
                                          {group.courseName}
                                        </span>
                                      </div>
                                    </td>

                                    {/* Branch */}
                                    <td className="px-3 py-2.5">
                                      <div
                                        className="font-semibold text-slate-800 text-xs line-clamp-1"
                                        title={`${group.branchName} (${group.branchCode})`}
                                      >
                                        {group.branchName}
                                      </div>
                                      <div className="text-[10px] text-slate-500 font-medium">
                                        Code: {group.branchCode}
                                      </div>
                                    </td>

                                    {/* Year & Sem */}
                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                        {group.yearLabel} {group.semesterNumber ? `(Sem ${group.semesterNumber})` : ""}
                                      </span>
                                    </td>

                                    {/* Section */}
                                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                      <span className="inline-flex items-center rounded-md bg-navy-100 px-2 py-0.5 text-xs font-bold text-navy-900 border border-navy-200">
                                        Sec {section.sectionName}
                                      </span>
                                    </td>

                                    {/* Strength */}
                                    <td className="px-3 py-2.5 text-center">
                                      <span className="font-bold text-slate-900 text-xs tabular-nums">
                                        {section.totalStudents}
                                      </span>
                                    </td>

                                    {/* Present */}
                                    <td className="px-3 py-2.5 text-center">
                                      <span
                                        className={cn(
                                          "inline-flex items-center justify-center min-w-[36px] rounded px-1.5 py-0.5 text-xs font-bold tabular-nums",
                                          section.totalPresent > 0
                                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                            : "text-slate-400 bg-slate-50",
                                        )}
                                      >
                                        {section.totalPresent}
                                      </span>
                                    </td>

                                    {/* Absent */}
                                    <td className="px-3 py-2.5 text-center">
                                      <span
                                        className={cn(
                                          "inline-flex items-center justify-center min-w-[36px] rounded px-1.5 py-0.5 text-xs font-bold tabular-nums",
                                          section.totalAbsent > 0
                                            ? "bg-rose-50 text-rose-800 border border-rose-200"
                                            : "text-slate-400 bg-slate-50",
                                        )}
                                      >
                                        {section.totalAbsent}
                                      </span>
                                    </td>

                                    {/* Slots (Conducted / Total) */}
                                    <td
                                      className="px-3 py-2.5"
                                      onClick={(e) => {
                                        if (section.slots && section.slots.length > 0) {
                                          e.stopPropagation();
                                          setPreviewingSlotsSection({
                                            cohortLabel: `${group.courseName} - ${group.branchName} (${group.yearLabel})`,
                                            sectionName: section.sectionName,
                                            slots: section.slots,
                                          });
                                        }
                                      }}
                                    >
                                      <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between text-xs">
                                          <span className="font-bold text-slate-900 tabular-nums">
                                            {section.postedSessions} / {section.totalSessions} Slots
                                          </span>
                                          <span className="text-[10px] font-medium text-slate-500">
                                            {slotsPct}%
                                          </span>
                                        </div>
                                        {/* Mini progress bar */}
                                        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                                          <div
                                            className={cn(
                                              "h-full rounded-full transition-all",
                                              section.postedSessions === 0
                                                ? "bg-slate-200"
                                                : slotsPct === 100
                                                  ? "bg-emerald-500"
                                                  : "bg-indigo-500",
                                            )}
                                            style={{ width: `${Math.min(100, slotsPct)}%` }}
                                          />
                                        </div>
                                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                                          <span>{section.postedSessions} posted</span>
                                          {section.pendingSessions > 0 ? (
                                            <span className="text-amber-700 font-medium">
                                              {section.pendingSessions} pending
                                            </span>
                                          ) : (
                                            <span className="text-emerald-700 font-medium">Completed</span>
                                          )}
                                        </div>
                                      </div>
                                    </td>

                                    {/* Attendance % */}
                                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                      {section.postedSessions === 0 ? (
                                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">
                                          Pending
                                        </span>
                                      ) : (
                                        <span
                                          className={cn(
                                            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold border",
                                            isGood
                                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                              : isCritical
                                                ? "bg-rose-50 text-rose-800 border-rose-200"
                                                : "bg-amber-50 text-amber-800 border-amber-200",
                                          )}
                                        >
                                          <TrendingUp className="h-3 w-3" />
                                          <span>{section.attendancePct}%</span>
                                        </span>
                                      )}
                                    </td>

                                    {/* Action */}
                                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleLoadCohortDetails(group, section.sectionName);
                                        }}
                                        className="inline-flex items-center gap-1 rounded-lg border border-navy-800 bg-navy-900 px-2.5 py-1 text-xs font-bold text-white shadow-2xs hover:bg-navy-800 hover:shadow-xs transition-all cursor-pointer group-hover:bg-navy-800"
                                      >
                                        <span>View Details</span>
                                        <ArrowRight className="h-3 w-3" />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                          {/* Pinned Table Summary Footer */}
                          {flattenedSectionRows.length > 0 && (
                            <tfoot className="border-t-2 border-slate-200 bg-slate-50/95 font-bold text-xs text-slate-800">
                              <tr>
                                <td
                                  colSpan={4}
                                  className="px-3 py-2.5 text-left font-bold text-slate-700 uppercase tracking-wider text-[11px]"
                                >
                                  Total Across {tableSummary.totalSections} Sections
                                </td>
                                <td className="px-3 py-2.5 text-center font-bold text-navy-950">
                                  {tableSummary.totalSections} Secs
                                </td>
                                <td className="px-3 py-2.5 text-center font-bold text-slate-900 tabular-nums">
                                  {tableSummary.totalStudents.toLocaleString()}
                                </td>
                                <td className="px-3 py-2.5 text-center font-bold text-emerald-700 tabular-nums">
                                  {tableSummary.totalPresent.toLocaleString()}
                                </td>
                                <td className="px-3 py-2.5 text-center font-bold text-rose-700 tabular-nums">
                                  {tableSummary.totalAbsent.toLocaleString()}
                                </td>
                                <td className="px-3 py-2.5">
                                  <span className="font-bold text-indigo-900 tabular-nums">
                                    {tableSummary.conductedSlots} / {tableSummary.totalSlots} Slots
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <span className="inline-flex items-center rounded-full bg-navy-100 px-2.5 py-0.5 text-xs font-bold text-navy-900">
                                    {tableSummary.avgAttendancePct}%
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 text-right text-slate-400 text-[11px] font-normal">
                                  Click row to view
                                </td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    </div>
                  ) : (
                    /* ================= GROUPED BY COHORT DYNAMIC TABLE ================= */
                    <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-100/95 text-slate-700 font-bold text-[11px] uppercase tracking-wider select-none">
                              <th className="px-3 py-2.5 text-center w-12">#</th>
                              <th className="px-3 py-2.5 min-w-[130px]">Course Name</th>
                              <th className="px-3 py-2.5 min-w-[170px]">Branch</th>
                              <th className="px-3 py-2.5 min-w-[110px]">Year &amp; Sem</th>
                              <th className="px-3 py-2.5 min-w-[180px]">Sections List</th>
                              <th className="px-3 py-2.5 text-center min-w-[85px]">Strength</th>
                              <th className="px-3 py-2.5 text-center min-w-[85px]">Present</th>
                              <th className="px-3 py-2.5 text-center min-w-[85px]">Absent</th>
                              <th className="px-3 py-2.5 min-w-[170px]">Slots Counts</th>
                              <th className="px-3 py-2.5 text-center min-w-[110px]">Attendance %</th>
                              <th className="px-3 py-2.5 text-right min-w-[130px]">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredSlotsGroups.length === 0 ? (
                              <tr>
                                <td colSpan={11} className="p-8 text-center text-slate-500">
                                  <Filter className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                                  <p className="font-semibold text-slate-700">No cohorts found matching your filters for this date.</p>
                                  <p className="text-xs text-slate-500 mt-1">Try resetting your search query or selecting a different academic date.</p>
                                </td>
                              </tr>
                            ) : (
                              filteredSlotsGroups.map((group, idx) => {
                                const cohortKey = `${group.collegeId}-${group.courseId}-${group.branchId}-${group.yearOfStudy}`;
                                const isExpanded = expandedCohortKeys.has(cohortKey);
                                const isBelowTarget = group.attendancePct < 65 && group.postedSessions > 0;
                                const isGood = group.attendancePct >= 75 && group.postedSessions > 0;
                                const sections = group.sections || [];

                                return (
                                  <Fragment key={cohortKey}>
                                    {/* Primary Cohort Row */}
                                    <tr
                                      onClick={() => handleLoadCohortDetails(group)}
                                      className={cn(
                                        "transition-colors cursor-pointer group",
                                        isExpanded ? "bg-slate-50/80" : "hover:bg-sky-50/50",
                                      )}
                                    >
                                      {/* # S.No */}
                                      <td className="px-3 py-2.5 text-center font-semibold text-slate-400 group-hover:text-navy-900">
                                        {idx + 1}
                                      </td>

                                      {/* Course Name */}
                                      <td className="px-3 py-2.5">
                                        <div className="flex items-center gap-1.5">
                                          <span className="rounded bg-navy-900 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider shrink-0">
                                            {group.collegeCode}
                                          </span>
                                          <span className="font-bold text-navy-950 text-xs">
                                            {group.courseName}
                                          </span>
                                        </div>
                                      </td>

                                      {/* Branch */}
                                      <td className="px-3 py-2.5">
                                        <div className="font-semibold text-slate-800 text-xs line-clamp-1" title={`${group.branchName} (${group.branchCode})`}>
                                          {group.branchName}
                                        </div>
                                        <div className="text-[10px] text-slate-500 font-medium">
                                          Code: {group.branchCode}
                                        </div>
                                      </td>

                                      {/* Year & Sem */}
                                      <td className="px-3 py-2.5 whitespace-nowrap">
                                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                          {group.yearLabel} {group.semesterNumber ? `(Sem ${group.semesterNumber})` : ""}
                                        </span>
                                      </td>

                                      {/* Sections List */}
                                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex flex-wrap items-center gap-1">
                                          {sections.length > 0 ? (
                                            sections.map((sec) => (
                                              <button
                                                key={sec.sectionName}
                                                type="button"
                                                onClick={() => handleLoadCohortDetails(group, sec.sectionName)}
                                                className="inline-flex items-center gap-1 rounded bg-navy-50 hover:bg-navy-900 hover:text-white text-navy-900 border border-navy-200 px-1.5 py-0.5 text-[10px] font-bold transition-all cursor-pointer"
                                                title={`Open Section ${sec.sectionName} Sheet (${sec.totalStudents} students, ${sec.postedSessions}/${sec.totalSessions} slots)`}
                                              >
                                                <span>Sec {sec.sectionName}</span>
                                                <span className="text-[9px] opacity-70">({sec.totalStudents})</span>
                                              </button>
                                            ))
                                          ) : (
                                            <span className="text-slate-400 text-xs italic">Sec A</span>
                                          )}
                                        </div>
                                      </td>

                                      {/* Strength */}
                                      <td className="px-3 py-2.5 text-center">
                                        <span className="font-bold text-slate-900 text-xs tabular-nums">
                                          {group.totalStudents}
                                        </span>
                                      </td>

                                      {/* Present */}
                                      <td className="px-3 py-2.5 text-center">
                                        <span
                                          className={cn(
                                            "inline-flex items-center justify-center min-w-[36px] rounded px-1.5 py-0.5 text-xs font-bold tabular-nums",
                                            group.totalPresent > 0
                                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                              : "text-slate-400 bg-slate-50",
                                          )}
                                        >
                                          {group.totalPresent}
                                        </span>
                                      </td>

                                      {/* Absent */}
                                      <td className="px-3 py-2.5 text-center">
                                        <span
                                          className={cn(
                                            "inline-flex items-center justify-center min-w-[36px] rounded px-1.5 py-0.5 text-xs font-bold tabular-nums",
                                            group.totalAbsent > 0
                                              ? "bg-rose-50 text-rose-800 border border-rose-200"
                                              : "text-slate-400 bg-slate-50",
                                          )}
                                        >
                                          {group.totalAbsent}
                                        </span>
                                      </td>

                                      {/* Slots Counts */}
                                      <td className="px-3 py-2.5">
                                        <div className="font-bold text-slate-900 text-xs tabular-nums">
                                          {group.postedSessions} / {group.totalSessions} Slots
                                        </div>
                                        <div className="text-[10px] text-slate-500">
                                          {group.pendingSessions > 0
                                            ? `${group.pendingSessions} slots pending`
                                            : "All slots submitted"}
                                        </div>
                                      </td>

                                      {/* Attendance % */}
                                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                        {group.postedSessions === 0 ? (
                                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">
                                            Pending
                                          </span>
                                        ) : (
                                          <span
                                            className={cn(
                                              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold border",
                                              isGood
                                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                                : isBelowTarget
                                                  ? "bg-rose-50 text-rose-800 border-rose-200"
                                                  : "bg-amber-50 text-amber-800 border-amber-200",
                                            )}
                                          >
                                            <TrendingUp className="h-3 w-3" />
                                            <span>{group.attendancePct}%</span>
                                          </span>
                                        )}
                                      </td>

                                      {/* Actions */}
                                      <td className="px-3 py-2.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-end gap-1.5">
                                          {sections.length > 0 && (
                                            <button
                                              type="button"
                                              onClick={() => toggleCohortExpand(cohortKey)}
                                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                                              title="Toggle sections breakdown"
                                            >
                                              <span>{sections.length} Secs</span>
                                              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => handleLoadCohortDetails(group)}
                                            className="inline-flex items-center gap-1 rounded-lg border border-navy-800 bg-navy-900 px-2.5 py-1 text-xs font-bold text-white shadow-2xs hover:bg-navy-800 hover:shadow-xs transition-all cursor-pointer"
                                          >
                                            <span>Details</span>
                                            <ArrowRight className="h-3 w-3" />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>

                                    {/* Expanded Sections Sub-Table Row */}
                                    {isExpanded && sections.length > 0 && (
                                      <tr className="bg-slate-50/70 border-b border-slate-200">
                                        <td colSpan={11} className="p-3 pl-8">
                                          <div className="rounded-lg border border-slate-200 bg-white shadow-2xs overflow-hidden">
                                            <div className="px-3 py-1.5 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between text-xs">
                                              <span className="font-bold text-navy-900 uppercase text-[10px] tracking-wider">
                                                Section Breakdown for {group.courseName} - {group.branchName} ({group.yearLabel})
                                              </span>
                                              <span className="text-[11px] text-slate-500">
                                                Click any section row to open its attendance sheet
                                              </span>
                                            </div>
                                            <table className="w-full text-left text-xs">
                                              <thead>
                                                <tr className="border-b border-slate-100 bg-slate-50 text-slate-600 font-bold text-[10px] uppercase tracking-wider">
                                                  <th className="px-3 py-2">Section</th>
                                                  <th className="px-3 py-2 text-center">Enrolled Strength</th>
                                                  <th className="px-3 py-2 text-center">Present</th>
                                                  <th className="px-3 py-2 text-center">Absent</th>
                                                  <th className="px-3 py-2">Slots Conducted</th>
                                                  <th className="px-3 py-2 text-center">Attendance %</th>
                                                  <th className="px-3 py-2 text-right">Action</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-slate-100">
                                                {sections.map((sec) => (
                                                  <tr
                                                    key={sec.sectionName}
                                                    onClick={() => handleLoadCohortDetails(group, sec.sectionName)}
                                                    className="hover:bg-sky-50/50 cursor-pointer transition-colors"
                                                  >
                                                    <td className="px-3 py-2">
                                                      <span className="inline-flex items-center rounded bg-navy-100 px-2 py-0.5 text-xs font-bold text-navy-900">
                                                        Section {sec.sectionName}
                                                      </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-center font-bold text-slate-800">
                                                      {sec.totalStudents}
                                                    </td>
                                                    <td className="px-3 py-2 text-center font-bold text-emerald-700">
                                                      {sec.totalPresent}
                                                    </td>
                                                    <td className="px-3 py-2 text-center font-bold text-rose-700">
                                                      {sec.totalAbsent}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                      <span className="font-bold text-slate-900">
                                                        {sec.postedSessions} / {sec.totalSessions} Slots
                                                      </span>
                                                      {sec.pendingSessions > 0 && (
                                                        <span className="text-amber-700 text-[10px] ml-1.5">
                                                          ({sec.pendingSessions} pending)
                                                        </span>
                                                      )}
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                      {sec.postedSessions > 0 ? (
                                                        <span
                                                          className={cn(
                                                            "rounded-full px-2 py-0.5 text-[11px] font-bold border",
                                                            sec.attendancePct >= 75
                                                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                                              : sec.attendancePct < 65
                                                                ? "bg-rose-50 text-rose-800 border-rose-200"
                                                                : "bg-amber-50 text-amber-800 border-amber-200",
                                                          )}
                                                        >
                                                          {sec.attendancePct}%
                                                        </span>
                                                      ) : (
                                                        <span className="text-slate-400 text-[11px]">Pending</span>
                                                      )}
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                      <button
                                                        type="button"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          handleLoadCohortDetails(group, sec.sectionName);
                                                        }}
                                                        className="inline-flex items-center gap-1 rounded bg-navy-900 px-2 py-1 text-[11px] font-bold text-white hover:bg-navy-800 transition-colors cursor-pointer"
                                                      >
                                                        <span>Open Sec {sec.sectionName}</span>
                                                        <ArrowRight className="h-3 w-3" />
                                                      </button>
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </Fragment>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Period Slot Breakdown Modal (Opened when clicking Slots cell) */}
                  {previewingSlotsSection && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
                      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="rounded bg-navy-900 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                                Slot Breakdown
                              </span>
                              <h3 className="text-sm font-bold text-navy-950">
                                Section {previewingSlotsSection.sectionName} &bull; {previewingSlotsSection.slots.length} Periods Today
                              </h3>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {previewingSlotsSection.cohortLabel} ({selectedDate})
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPreviewingSlotsSection(null)}
                            className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer"
                          >
                            <XCircle className="h-5 w-5" />
                          </button>
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-2">
                          {previewingSlotsSection.slots.map((slot) => (
                            <div
                              key={slot.sessionId}
                              className={cn(
                                "rounded-xl border p-3 text-xs flex items-center justify-between gap-3",
                                slot.posted
                                  ? "border-emerald-200 bg-emerald-50/40"
                                  : "border-slate-200 bg-slate-50/60",
                              )}
                            >
                              <div>
                                <div className="flex items-center gap-2 font-bold text-navy-950">
                                  <span>{slot.slotLabel}</span>
                                  <span className="text-slate-500 font-normal">
                                    ({slot.startTime} - {slot.endTime})
                                  </span>
                                </div>
                                <div className="font-semibold text-slate-800 mt-0.5">
                                  {slot.subjectCode ? `${slot.subjectCode} - ` : ""}
                                  {slot.subjectName || "Class"}
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  Faculty: {slot.facultyName || "Unassigned"}
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                {slot.posted ? (
                                  <>
                                    <div className="text-xs font-bold text-emerald-800">
                                      {slot.presentCount} Present &bull; {slot.absentCount} Absent
                                    </div>
                                    <div className="inline-flex rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-900 mt-1">
                                      {slot.attendancePct}% Attendance
                                    </div>
                                  </>
                                ) : (
                                  <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                    Pending Posting
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="border-t border-slate-200 bg-slate-50 px-4 py-2.5 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setPreviewingSlotsSection(null)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* viewMode === 'sheet' */
              <div className="space-y-3">
                {/* Cohort Context Banner (When loaded via View Details) */}
                {selectedCohortDetail && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-navy-200 bg-linear-to-r from-navy-50 via-sky-50/40 to-white p-3.5 shadow-2xs">
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={handleBackToStats}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-navy-900 transition-colors cursor-pointer"
                      >
                        <ArrowLeft className="h-4 w-4 text-navy-700" />
                        <span>Back to Attendance Reports</span>
                      </button>
                      <div className="h-6 w-px bg-slate-300 hidden sm:block" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-navy-800 px-2 py-0.5 text-[10px] font-bold uppercase text-white tracking-wider">
                            {selectedCohortDetail.collegeCode}
                          </span>
                          <h3 className="text-sm font-bold text-navy-950">
                            {selectedCohortDetail.collegeName} &bull; {selectedCohortDetail.courseName} ({selectedCohortDetail.branchCode})
                          </h3>
                          {selectedSection && (
                            <span className="rounded-md bg-navy-100 border border-navy-200 px-2 py-0.5 text-xs font-bold text-navy-900">
                              Section {selectedSection}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {selectedCohortDetail.yearLabel} &bull; {selectedCohortDetail.totalStudents} enrolled students &bull; {selectedCohortDetail.postedSessions} of {selectedCohortDetail.totalSessions} periods marked ({selectedCohortDetail.attendancePct}% attendance today)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded-md bg-emerald-100 px-2.5 py-1 font-bold text-emerald-800">
                        Present: {selectedCohortDetail.totalPresent}
                      </span>
                      <span className="rounded-md bg-rose-100 px-2.5 py-1 font-bold text-rose-800">
                        Absent: {selectedCohortDetail.totalAbsent}
                      </span>
                    </div>
                  </div>
                )}

                {dailyData ? (
                  dailyData.slots.length === 0 ? (
                    <Card className="p-8 text-center text-slate-500">
                      <Clock className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                      <p className="font-semibold text-slate-700">No timetable slots scheduled for this date.</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Select a working class day or ensure timetable plans are published for this cohort.
                      </p>
                    </Card>
                  ) : (
                    <div className="rounded-lg border border-slate-200 bg-white shadow-2xs overflow-hidden">
                  {/* Table Header Strip with integrated Legend */}
                  <div className="border-b border-slate-200 bg-slate-50/90 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-navy-900 text-xs">
                        Day Timetable Slots & Student Attendance
                      </span>
                      {dailyData.section && (
                        <span className="inline-flex items-center rounded bg-navy-100 px-2 py-0.2 text-[11px] font-semibold text-navy-800">
                          Sec {dailyData.section}
                        </span>
                      )}
                      <span className="text-[11px] text-slate-500">({selectedDate})</span>
                    </div>

                    {/* Integrated Legend */}
                    <div className="flex items-center gap-2 text-[11px] font-medium text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-block w-3 h-3 rounded bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold text-[8px] leading-none text-center pt-0.5">
                          P
                        </span>
                        <span>Present</span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-block w-3 h-3 rounded bg-rose-100 border border-rose-300 text-rose-800 font-bold text-[8px] leading-none text-center pt-0.5">
                          A
                        </span>
                        <span>Absent</span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-block w-3 h-3 rounded bg-purple-100 border border-purple-300 text-purple-800 font-bold text-[8px] leading-none text-center pt-0.5">
                          OD
                        </span>
                        <span>On Duty</span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-block w-3 h-3 rounded bg-slate-100 border border-slate-300 text-slate-400 font-bold text-[8px] leading-none text-center pt-0.5">
                          –
                        </span>
                        <span>Pending</span>
                      </span>
                    </div>
                  </div>

                  {/* Day Timetable Slots Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-100/95 text-slate-700 font-semibold text-[11px] uppercase tracking-wider">
                          <th className="sticky left-0 z-20 bg-slate-100 px-2.5 py-2.5 w-10 text-center">#</th>
                          <th className="sticky left-10 z-20 bg-slate-100 px-2.5 py-2.5 w-48 min-w-[180px]">
                            Student (Photo & PIN)
                          </th>
                          <th className="px-2.5 py-2.5 min-w-[170px]">Student Name</th>

                          {/* Dynamic Slot Columns of the Day */}
                          {dailyData.slots.map((slot) => (
                            <th
                              key={slot.sessionId}
                              className="px-2 py-2 text-center min-w-[100px] border-l border-slate-200"
                            >
                              <div className="flex flex-col items-center">
                                <span className="font-bold text-navy-900 text-[11px]">{slot.slotLabel}</span>
                                <span className="text-[10px] text-slate-500 font-normal">{slot.time}</span>
                                <span
                                  className="text-[10px] font-semibold text-slate-700 truncate max-w-[90px] mt-0.5"
                                  title={`${slot.subjectCode || "Class"} - ${slot.subjectName || ""}`}
                                >
                                  {slot.subjectCode || "Class"}
                                </span>
                                {slot.posted ? (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 mt-0.5">
                                    <CheckCircle2 className="h-2.5 w-2.5" />
                                    <span>{slot.presentCount}P / {slot.absentCount}A</span>
                                  </span>
                                ) : (
                                  <span className="text-[9px] text-slate-400 font-normal mt-0.5">
                                    Pending
                                  </span>
                                )}
                              </div>
                            </th>
                          ))}

                          {/* Summary Columns */}
                          <th className="px-2.5 py-2 text-center min-w-[70px] bg-emerald-50/50 text-emerald-900 border-l border-slate-200">
                            Present
                          </th>
                          <th className="px-2.5 py-2 text-center min-w-[70px] bg-rose-50/50 text-rose-900 border-l border-slate-200">
                            Absent
                          </th>
                          <th className="px-2.5 py-2 text-center min-w-[75px] bg-slate-100 border-l border-slate-200">
                            Day %
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-200 bg-white">
                        {filteredDailyStudents.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6 + dailyData.slots.length}
                              className="px-4 py-8 text-center text-slate-400 font-medium"
                            >
                              No students found matching current filters.
                            </td>
                          </tr>
                        ) : (
                          filteredDailyStudents.map((student, index) => {
                            const displayPin =
                              student.pinNo && student.pinNo.trim()
                                ? student.pinNo.trim()
                                : student.admissionNo;

                            return (
                              <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                                {/* S.No */}
                                <td className="sticky left-0 z-10 bg-white hover:bg-slate-50 px-2.5 py-1.5 text-center text-slate-400 font-bold">
                                  {index + 1}
                                </td>

                                {/* Photo + PIN Number */}
                                <td className="sticky left-10 z-10 bg-white hover:bg-slate-50 px-2.5 py-1.5">
                                  <div className="flex items-center gap-2">
                                    <StudentAvatar
                                      name={student.name}
                                      photo={null}
                                      studentId={student.id}
                                      hasPhoto={student.hasPhoto}
                                      size="sm"
                                    />
                                    <span className="font-bold text-navy-900 tracking-wide text-xs">
                                      {displayPin}
                                    </span>
                                  </div>
                                </td>

                                {/* Student Name */}
                                <td className="px-2.5 py-1.5 font-medium text-slate-800">
                                  <div className="truncate max-w-[190px]" title={student.name}>
                                    {student.name}
                                  </div>
                                  <div className="text-[10px] text-slate-400 truncate flex items-center gap-1.5">
                                    <span>{student.course} {student.branch ? `• ${student.branch}` : ""}</span>
                                    {student.year && student.semester && (
                                      <span className="inline-flex items-center rounded bg-slate-100 border border-slate-200 px-1 py-0.2 text-[9px] font-bold text-slate-600">
                                        {student.year}-{student.semester}
                                      </span>
                                    )}
                                    <span className="inline-flex items-center rounded bg-emerald-50 border border-emerald-200 px-1 py-0.2 text-[9px] font-semibold text-emerald-700">
                                      {student.studentStatus || "Regular"}
                                    </span>
                                  </div>
                                </td>

                                {/* Day Timetable Slots */}
                                {dailyData.slots.map((slot) => {
                                  const slotStatus =
                                    student.slots[slot.sessionId]?.status || "pending";

                                  return (
                                    <td
                                      key={slot.sessionId}
                                      className="px-2 py-1.5 text-center border-l border-slate-100"
                                    >
                                      {slotStatus === "present" ? (
                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded font-bold text-xs bg-emerald-100 text-emerald-800 border border-emerald-300">
                                          P
                                        </span>
                                      ) : slotStatus === "absent" ? (
                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded font-bold text-xs bg-rose-100 text-rose-800 border border-rose-300">
                                          A
                                        </span>
                                      ) : slotStatus === "od" ? (
                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded font-bold text-[10px] bg-purple-100 text-purple-800 border border-purple-300">
                                          OD
                                        </span>
                                      ) : slotStatus === "leave" ? (
                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded font-bold text-xs bg-sky-100 text-sky-800 border border-sky-300">
                                          L
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded text-xs text-slate-300 font-bold bg-slate-50 border border-slate-200">
                                          –
                                        </span>
                                      )}
                                    </td>
                                  );
                                })}

                                {/* Total Present */}
                                <td className="px-2.5 py-1.5 text-center font-bold text-emerald-700 bg-emerald-50/20 border-l border-slate-100 text-xs">
                                  {student.totalPresent}
                                </td>

                                {/* Total Absent */}
                                <td className="px-2.5 py-1.5 text-center font-bold text-rose-700 bg-rose-50/20 border-l border-slate-100 text-xs">
                                  {student.totalAbsent}
                                </td>

                                {/* Day % */}
                                <td className="px-2.5 py-1.5 text-center border-l border-slate-100">
                                  {student.percentage !== null ? (
                                    <span
                                      className={cn(
                                        "inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold",
                                        student.percentage >= 75
                                          ? "bg-emerald-100 text-emerald-800"
                                          : student.percentage >= 65
                                            ? "bg-amber-100 text-amber-800"
                                            : "bg-rose-100 text-rose-800",
                                      )}
                                    >
                                      {student.percentage}%
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 font-medium text-xs">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            ) : (
              <Card className="p-8 text-center text-slate-500">
                <Layers className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                <p className="font-semibold text-slate-700">No Section Attendance Sheet Loaded</p>
                <p className="text-xs text-slate-500 mt-1 mb-4">
                  Select a specific college, course, branch, and section to view student attendance, or switch back to the All Colleges Stats format.
                </p>
                <button
                  type="button"
                  onClick={handleBackToStats}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-navy-800 bg-navy-900 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-navy-800 transition-colors cursor-pointer"
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  <span>Switch to All Colleges Stats Format</span>
                </button>
              </Card>
            )}
          </div>
        )
      )}

          {/* ======================================================== */}
          {/* TAB 2: WEEK (DAY SLOTS MATRIX)                           */}
          {/* ======================================================== */}
          {activeTab === "week" && weeklyData && (
            <div>
              {weeklyData.days.every((d) => d.slots.length === 0) ? (
                <Card className="p-8 text-center text-slate-500">
                  <Calendar className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-700">No timetable slots scheduled for this week.</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Select an active teaching week or ensure timetable plans are published for this cohort.
                  </p>
                </Card>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-white shadow-2xs overflow-hidden">
                  {/* Table Header Strip with integrated Legend */}
                  <div className="border-b border-slate-200 bg-slate-50/90 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-navy-900 text-xs">
                        Weekly Timetable Slots & Student Attendance
                      </span>
                      {weeklyData.section && (
                        <span className="inline-flex items-center rounded bg-navy-100 px-2 py-0.2 text-[11px] font-semibold text-navy-800">
                          Sec {weeklyData.section}
                        </span>
                      )}
                      <span className="text-[11px] text-slate-500">
                        ({weeklyData.weekLabel || `${weeklyData.startDate} to ${weeklyData.endDate}`})
                      </span>
                    </div>

                    {/* Integrated Legend */}
                    <div className="flex items-center gap-2 text-[11px] font-medium text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-block w-3 h-3 rounded bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold text-[8px] leading-none text-center pt-0.5">
                          P
                        </span>
                        <span>Present</span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-block w-3 h-3 rounded bg-rose-100 border border-rose-300 text-rose-800 font-bold text-[8px] leading-none text-center pt-0.5">
                          A
                        </span>
                        <span>Absent</span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-block w-3 h-3 rounded bg-purple-100 border border-purple-300 text-purple-800 font-bold text-[8px] leading-none text-center pt-0.5">
                          OD
                        </span>
                        <span>On Duty</span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-block w-3 h-3 rounded bg-sky-100 border border-sky-300 text-sky-800 font-bold text-[8px] leading-none text-center pt-0.5">
                          L
                        </span>
                        <span>Leave</span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-block w-3 h-3 rounded bg-slate-100 border border-slate-300 text-slate-400 font-bold text-[8px] leading-none text-center pt-0.5">
                          –
                        </span>
                        <span>Pending</span>
                      </span>
                    </div>
                  </div>

                  {/* Weekly Slots Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-100/95 text-slate-700 font-semibold text-[11px] uppercase tracking-wider">
                          <th className="sticky left-0 z-20 bg-slate-100 px-2.5 py-2.5 w-10 text-center">#</th>
                          <th className="sticky left-10 z-20 bg-slate-100 px-2.5 py-2.5 w-48 min-w-[180px]">
                            Student (Photo & PIN)
                          </th>
                          <th className="px-2.5 py-2.5 min-w-[170px]">Student Name</th>

                          {/* Day Columns (Mon - Sat) */}
                          {weeklyData.days.map((day) => (
                            <th
                              key={day.date}
                              className="px-2 py-2 text-center min-w-[130px] border-l border-slate-200"
                            >
                              <div className="flex flex-col items-center">
                                <span className="font-bold text-navy-900 text-[11px]">
                                  {day.dayOfWeek}
                                </span>
                                <span className="text-[10px] text-slate-500 font-normal">
                                  {day.date.slice(5)} {day.slots.length > 0 ? `(${day.slots.length} slots)` : ""}
                                </span>
                              </div>
                            </th>
                          ))}

                          {/* Summary Columns */}
                          <th className="px-2.5 py-2 text-center min-w-[70px] bg-emerald-50/50 text-emerald-900 border-l border-slate-200">
                            Present
                          </th>
                          <th className="px-2.5 py-2 text-center min-w-[70px] bg-rose-50/50 text-rose-900 border-l border-slate-200">
                            Absent
                          </th>
                          <th className="px-2.5 py-2 text-center min-w-[80px] bg-slate-200/60 text-slate-900 border-l border-slate-200">
                            Week %
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-200">
                        {filteredWeeklyStudents.length === 0 ? (
                          <tr>
                            <td
                              colSpan={weeklyData.days.length + 6}
                              className="px-4 py-8 text-center text-slate-400 font-medium"
                            >
                              No students found matching current filters.
                            </td>
                          </tr>
                        ) : (
                          filteredWeeklyStudents.map((student, idx) => (
                            <tr
                              key={student.id}
                              className="hover:bg-slate-50/80 transition-colors group"
                            >
                              {/* S.No */}
                              <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 px-2.5 py-1.5 text-center text-slate-400 font-medium text-[11px]">
                                {idx + 1}
                              </td>

                              {/* Student Photo & PIN */}
                              <td className="sticky left-10 z-10 bg-white group-hover:bg-slate-50 px-2.5 py-1.5 font-medium text-slate-900">
                                <div className="flex items-center gap-2">
                                  <StudentAvatar
                                    name={student.name}
                                    photo={null}
                                    studentId={student.id}
                                    hasPhoto={student.hasPhoto}
                                    size="sm"
                                  />
                                  <div className="min-w-0">
                                    <div className="font-bold text-navy-900 text-xs truncate">
                                      {student.pinNo || student.admissionNo}
                                    </div>
                                    <div className="text-[10px] text-slate-400 truncate">
                                      {student.admissionNo}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Student Name */}
                              <td className="px-2.5 py-1.5 font-medium text-slate-800">
                                <div className="truncate max-w-[190px]" title={student.name}>
                                  {student.name}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate flex items-center gap-1.5">
                                  <span>{student.course} {student.branch ? `• ${student.branch}` : ""}</span>
                                  {student.year && student.semester && (
                                    <span className="inline-flex items-center rounded bg-slate-100 border border-slate-200 px-1 py-0.2 text-[9px] font-bold text-slate-600">
                                      {student.year}-{student.semester}
                                    </span>
                                  )}
                                  <span className="inline-flex items-center rounded bg-emerald-50 border border-emerald-200 px-1 py-0.2 text-[9px] font-semibold text-emerald-700">
                                    {student.studentStatus || "Regular"}
                                  </span>
                                </div>
                              </td>

                              {/* Day Slots Matrix */}
                              {weeklyData.days.map((day) => {
                                const studentDay = student.days[day.date];
                                return (
                                  <td
                                    key={day.date}
                                    className="px-1.5 py-1.5 text-center border-l border-slate-100 align-middle"
                                  >
                                    {day.slots.length === 0 ? (
                                      <span className="text-[11px] text-slate-300 font-medium">—</span>
                                    ) : (
                                      <div className="flex flex-wrap items-center justify-center gap-1 max-w-[170px] mx-auto">
                                        {day.slots.map((slot) => {
                                          const mark = studentDay?.slots[slot.sessionId]?.status || "pending";
                                          return (
                                            <span
                                              key={slot.sessionId}
                                              title={`${day.dayOfWeek} ${slot.slotLabel} (${slot.time}): ${slot.subjectCode || slot.facultyName || "Class"} — ${mark.toUpperCase()}`}
                                              className={cn(
                                                "inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold border transition-transform hover:scale-110 cursor-help",
                                                mark === "present"
                                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                                  : mark === "absent"
                                                    ? "bg-rose-100 text-rose-800 border-rose-300"
                                                    : mark === "od"
                                                      ? "bg-purple-100 text-purple-800 border-purple-300"
                                                      : mark === "leave"
                                                        ? "bg-sky-100 text-sky-800 border-sky-300"
                                                        : "bg-slate-50 text-slate-300 border-slate-200",
                                              )}
                                            >
                                              {mark === "present"
                                                ? "P"
                                                : mark === "absent"
                                                  ? "A"
                                                  : mark === "od"
                                                    ? "OD"
                                                    : mark === "leave"
                                                      ? "L"
                                                      : "–"}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </td>
                                );
                              })}

                              {/* Total Present */}
                              <td className="px-2.5 py-1.5 text-center font-bold text-emerald-700 bg-emerald-50/20 border-l border-slate-100 text-xs">
                                {student.totalPresent}
                              </td>

                              {/* Total Absent */}
                              <td className="px-2.5 py-1.5 text-center font-bold text-rose-700 bg-rose-50/20 border-l border-slate-100 text-xs">
                                {student.totalAbsent}
                              </td>

                              {/* Week % */}
                              <td className="px-2.5 py-1.5 text-center border-l border-slate-100">
                                {student.percentage !== null ? (
                                  <span
                                    className={cn(
                                      "inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold",
                                      student.percentage >= 75
                                        ? "bg-emerald-100 text-emerald-800"
                                        : student.percentage >= 65
                                          ? "bg-amber-100 text-amber-800"
                                          : "bg-rose-100 text-rose-800",
                                    )}
                                  >
                                    {student.percentage}%
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-medium text-xs">—</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: MONTHLY ATTENDANCE SHEET                           */}
          {/* ======================================================== */}
          {activeTab === "month" && monthlyData && (
            <div className="space-y-3">
              {/* Day Summaries Mini Strip */}
              {monthlyData.daySummaries.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-2xs">
                  <div className="text-[11px] font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="h-3 w-3 text-navy-800" />
                    <span>Daily Attendance Trend ({monthlyData.monthName})</span>
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                    {monthlyData.daySummaries.map((day) => (
                      <div
                        key={day.date}
                        className={cn(
                          "flex flex-col items-center justify-center py-1 px-1.5 rounded border text-center shrink-0 min-w-[55px]",
                          day.postedSessions > 0
                            ? day.avgPct >= 75
                              ? "border-emerald-200 bg-emerald-50/50 text-emerald-900"
                              : "border-amber-200 bg-amber-50/50 text-amber-900"
                            : "border-slate-100 bg-slate-50 text-slate-400",
                        )}
                      >
                        <span className="text-[9px] font-semibold text-slate-500 uppercase">
                          {day.date.slice(8)} {day.dayOfWeek.slice(0, 3)}
                        </span>
                        <span className="text-[11px] font-bold mt-0.5">
                          {day.postedSessions > 0 ? `${day.avgPct}%` : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Monthly Table */}
              <div className="rounded-lg border border-slate-200 bg-white shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100/90 text-slate-700 font-semibold text-[11px] uppercase tracking-wider">
                        <th className="px-2.5 py-2.5 w-10 text-center">#</th>
                        <th className="px-2.5 py-2.5 w-48">Photo & PIN Number</th>
                        <th className="px-2.5 py-2.5 min-w-[170px]">Student Name</th>
                        <th className="px-2.5 py-2.5 text-center">Conducted Slots</th>
                        <th className="px-2.5 py-2.5 text-center text-emerald-800">Total Present</th>
                        <th className="px-2.5 py-2.5 text-center text-rose-800">Total Absent</th>
                        <th className="px-2.5 py-2.5 text-center">OD / Leave</th>
                        <th className="px-2.5 py-2.5 text-center min-w-[130px]">Monthly %</th>
                        <th className="px-2.5 py-2.5 text-center min-w-[90px]">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {filteredMonthlyStudents.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-8 text-center text-slate-400 font-medium">
                            No students found matching current filters.
                          </td>
                        </tr>
                      ) : (
                        filteredMonthlyStudents.map((student, index) => {
                          const displayPin =
                            student.pinNo && student.pinNo.trim()
                              ? student.pinNo.trim()
                              : student.admissionNo;

                          return (
                            <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-2.5 py-1.5 text-center text-slate-400 font-bold">
                                {index + 1}
                              </td>

                              <td className="px-2.5 py-1.5">
                                <div className="flex items-center gap-2">
                                  <StudentAvatar
                                    name={student.name}
                                    photo={null}
                                    studentId={student.id}
                                    hasPhoto={student.hasPhoto}
                                    size="sm"
                                  />
                                  <span className="font-bold text-navy-900 tracking-wide text-xs">
                                    {displayPin}
                                  </span>
                                </div>
                              </td>

                              <td className="px-2.5 py-1.5 font-medium text-slate-800">
                                <div className="truncate max-w-[200px]" title={student.name}>
                                  {student.name}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate flex items-center gap-1.5">
                                  <span>{student.course} {student.branch ? `• ${student.branch}` : ""}</span>
                                  {student.year && student.semester && (
                                    <span className="inline-flex items-center rounded bg-slate-100 border border-slate-200 px-1 py-0.2 text-[9px] font-bold text-slate-600">
                                      {student.year}-{student.semester}
                                    </span>
                                  )}
                                  <span className="inline-flex items-center rounded bg-emerald-50 border border-emerald-200 px-1 py-0.2 text-[9px] font-semibold text-emerald-700">
                                    {student.studentStatus || "Regular"}
                                  </span>
                                </div>
                              </td>

                              <td className="px-2.5 py-1.5 text-center font-semibold text-slate-600">
                                {student.totalSlots}
                              </td>

                              <td className="px-2.5 py-1.5 text-center font-bold text-emerald-700">
                                {student.presentCount}
                              </td>

                              <td className="px-2.5 py-1.5 text-center font-bold text-rose-700">
                                {student.absentCount}
                              </td>

                              <td className="px-2.5 py-1.5 text-center text-slate-500 font-medium">
                                {student.odCount} OD • {student.leaveCount} L
                              </td>

                              <td className="px-2.5 py-1.5 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <div className="w-14 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                    <div
                                      className={cn(
                                        "h-full rounded-full transition-all",
                                        student.percentage >= 75
                                          ? "bg-emerald-600"
                                          : student.percentage >= 65
                                            ? "bg-amber-500"
                                            : "bg-rose-600",
                                      )}
                                      style={{ width: `${Math.min(100, student.percentage)}%` }}
                                    />
                                  </div>
                                  <span className="font-bold text-xs min-w-[32px] text-right">
                                    {student.percentage}%
                                  </span>
                                </div>
                              </td>

                              <td className="px-2.5 py-1.5 text-center">
                                {student.percentage >= 75 ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    Safe
                                  </span>
                                ) : student.percentage >= 65 ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                    Warning
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                    Critical
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: SEMESTER WISE ATTENDANCE                           */}
          {/* ======================================================== */}
          {activeTab === "semester" && semesterData && (
            <div className="space-y-3">
              {/* Semester Table */}
              <div className="rounded-lg border border-slate-200 bg-white shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100/90 text-slate-700 font-semibold text-[11px] uppercase tracking-wider">
                        <th className="px-2.5 py-2.5 w-10 text-center">#</th>
                        <th className="px-2.5 py-2.5 w-48">Photo & PIN Number</th>
                        <th className="px-2.5 py-2.5 min-w-[170px]">Student Name</th>
                        <th className="px-2.5 py-2.5 text-center">Classes Conducted</th>
                        <th className="px-2.5 py-2.5 text-center text-emerald-800">Total Present</th>
                        <th className="px-2.5 py-2.5 text-center text-rose-800">Total Absent</th>
                        <th className="px-2.5 py-2.5 text-center min-w-[130px]">Semester %</th>
                        <th className="px-2.5 py-2.5 text-center min-w-[120px]">Eligibility Status</th>
                        <th className="px-2.5 py-2.5 text-center w-16">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {filteredSemesterStudents.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-8 text-center text-slate-400 font-medium">
                            No students found matching current filters.
                          </td>
                        </tr>
                      ) : (
                        filteredSemesterStudents.map((student, index) => {
                          const displayPin =
                            student.pinNo && student.pinNo.trim()
                              ? student.pinNo.trim()
                              : student.admissionNo;
                          const isExpanded = expandedStudentId === student.id;

                          return (
                            <Fragment key={student.id}>
                              <tr className="hover:bg-slate-50/80 transition-colors">
                                <td className="px-2.5 py-1.5 text-center text-slate-400 font-bold">
                                  {index + 1}
                                </td>

                                <td className="px-2.5 py-1.5">
                                  <div className="flex items-center gap-2">
                                    <StudentAvatar
                                      name={student.name}
                                      photo={null}
                                      studentId={student.id}
                                      hasPhoto={student.hasPhoto}
                                      size="sm"
                                    />
                                    <span className="font-bold text-navy-900 tracking-wide text-xs">
                                      {displayPin}
                                    </span>
                                  </div>
                                </td>

                                <td className="px-2.5 py-1.5 font-medium text-slate-800">
                                  <div className="truncate max-w-[200px]" title={student.name}>
                                    {student.name}
                                  </div>
                                  <div className="text-[10px] text-slate-400 truncate flex items-center gap-1.5">
                                    <span>{student.course} {student.branch ? `• ${student.branch}` : ""}</span>
                                    {student.year && student.semester && (
                                      <span className="inline-flex items-center rounded bg-slate-100 border border-slate-200 px-1 py-0.2 text-[9px] font-bold text-slate-600">
                                        {student.year}-{student.semester}
                                      </span>
                                    )}
                                    <span className="inline-flex items-center rounded bg-emerald-50 border border-emerald-200 px-1 py-0.2 text-[9px] font-semibold text-emerald-700">
                                      {student.studentStatus || "Regular"}
                                    </span>
                                  </div>
                                </td>

                                <td className="px-2.5 py-1.5 text-center font-semibold text-slate-600">
                                  {student.totalClasses}
                                </td>

                                <td className="px-2.5 py-1.5 text-center font-bold text-emerald-700">
                                  {student.presentCount}
                                </td>

                                <td className="px-2.5 py-1.5 text-center font-bold text-rose-700">
                                  {student.absentCount}
                                </td>

                                <td className="px-2.5 py-1.5 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <div className="w-14 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                      <div
                                        className={cn(
                                          "h-full rounded-full transition-all",
                                          student.percentage >= 75
                                            ? "bg-emerald-600"
                                            : student.percentage >= 65
                                              ? "bg-amber-500"
                                              : "bg-rose-600",
                                        )}
                                        style={{ width: `${Math.min(100, student.percentage)}%` }}
                                      />
                                    </div>
                                    <span className="font-bold text-xs min-w-[32px] text-right">
                                      {student.percentage}%
                                    </span>
                                  </div>
                                </td>

                                <td className="px-2.5 py-1.5 text-center">
                                  {student.eligibility === "Eligible" ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      Eligible (≥75%)
                                    </span>
                                  ) : student.eligibility === "Condonation Required" ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                      Condonation
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                      Detained (&lt;65%)
                                    </span>
                                  )}
                                </td>

                                <td className="px-2.5 py-1.5 text-center">
                                  {student.subjectBreakdown.length > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedStudentId(isExpanded ? null : student.id)
                                      }
                                      className="rounded p-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                      title="View Subject Breakdown"
                                    >
                                      {isExpanded ? (
                                        <ChevronUp className="h-3.5 w-3.5" />
                                      ) : (
                                        <ChevronDown className="h-3.5 w-3.5" />
                                      )}
                                    </button>
                                  ) : (
                                    <span className="text-slate-300 text-xs">—</span>
                                  )}
                                </td>
                              </tr>

                              {/* Expandable Subject Breakdown Row */}
                              {isExpanded && (
                                <tr className="bg-slate-50/70 border-y border-slate-200">
                                  <td colSpan={9} className="px-6 py-2.5">
                                    <div className="text-xs font-semibold text-navy-900 mb-1.5">
                                      Subject Breakdown:
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                                      {student.subjectBreakdown.map((sub) => (
                                        <div
                                          key={sub.subjectCode}
                                          className="rounded border border-slate-200 bg-white p-2 flex items-center justify-between"
                                        >
                                          <div>
                                            <div className="font-bold text-slate-800 text-xs">
                                              {sub.subjectCode}
                                            </div>
                                            <div
                                              className="text-[10px] text-slate-500 truncate max-w-[130px]"
                                              title={sub.subjectName}
                                            >
                                              {sub.subjectName}
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <span
                                              className={cn(
                                                "font-bold text-xs",
                                                sub.percentage >= 75
                                                  ? "text-emerald-700"
                                                  : sub.percentage >= 65
                                                    ? "text-amber-700"
                                                    : "text-rose-700",
                                              )}
                                            >
                                              {sub.percentage}%
                                            </span>
                                            <div className="text-[10px] text-slate-400">
                                              {sub.present}/{sub.total}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 4: OVERVIEW / INSIGHTS                                */}
          {/* ======================================================== */}
          {activeTab === "overview" && overviewData && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
                  <div className="text-slate-500 text-[11px] font-medium">Overall Attendance</div>
                  <div className="text-xl font-bold text-navy-900 mt-1">{overviewData.overallAttendance}%</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
                  <div className="text-slate-500 text-[11px] font-medium">Below Threshold</div>
                  <div className="text-xl font-bold text-rose-700 mt-1">{overviewData.studentsBelowThreshold}</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
                  <div className="text-slate-500 text-[11px] font-medium">Pending Posts Today</div>
                  <div className="text-xl font-bold text-amber-700 mt-1">{overviewData.today?.pending ?? 0}</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
                  <div className="text-slate-500 text-[11px] font-medium">Completed Posts Today</div>
                  <div className="text-xl font-bold text-emerald-700 mt-1">{overviewData.today?.posted ?? 0}</div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Card className="p-3.5">
                  <h3 className="mb-2 text-xs font-semibold text-navy-900 uppercase tracking-wider">
                    Attendance Distribution Bands
                  </h3>
                  {overviewData.bands.length === 0 ? (
                    <p className="text-xs text-slate-400">No posted class-session attendance yet.</p>
                  ) : (
                    <div className="space-y-2 text-xs">
                      {overviewData.bands.map((band) => (
                        <div key={band.label}>
                          <div className="mb-1 flex justify-between text-[11px]">
                            <span className="font-medium text-slate-700">{band.label}</span>
                            <span className="font-bold text-slate-900">{band.total.toLocaleString()}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-navy-800 transition-all"
                              style={{
                                width: `${Math.min(
                                  100,
                                  (band.total /
                                    Math.max(
                                      1,
                                      overviewData.bands.reduce((s, b) => s + b.total, 0),
                                    )) *
                                    100,
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card className="p-3.5">
                  <h3 className="mb-2 text-xs font-semibold text-navy-900 uppercase tracking-wider">
                    Section Snapshot
                  </h3>
                  {overviewData.sections.length === 0 ? (
                    <p className="text-xs text-slate-400">No section posts in the last 90 days.</p>
                  ) : (
                    <ul className="space-y-1.5 text-xs text-slate-700">
                      {overviewData.sections.map((row) => (
                        <li
                          key={row.section}
                          className="flex justify-between items-center py-1 border-b border-slate-100 last:border-b-0"
                        >
                          <span className="font-medium text-slate-800">Section {row.section}</span>
                          <span
                            className={cn(
                              "font-bold text-[11px] px-2 py-0.2 rounded",
                              row.attendance >= 75
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800",
                            )}
                          >
                            {row.attendance}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
