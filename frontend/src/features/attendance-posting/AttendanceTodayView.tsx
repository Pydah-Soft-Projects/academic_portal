"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  BookOpen,
  AlertCircle,
  Search,
  ShieldCheck,
  Lock,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { isTeachingStaffOnly, isSuperAdminUser } from "@/lib/teaching-scope";
import { useAcademicContext } from "@/components/layout/AcademicProvider";
import { AcademicFilterBar } from "@/components/layout/AcademicFilterBar";
import { cn } from "@/lib/cn";

export type AttendanceSessionCard = {
  id: number;
  date: string;
  startTime: string | null;
  endTime: string | null;
  slotLabel: string | null;
  subjectCode: string | null;
  subjectName: string | null;
  subjectTypeSnapshot?: string | null;
  section: string | null;
  sections?: string[];
  sessionIds?: number[];
  collegeId?: number;
  collegeName?: string;
  courseId?: number;
  courseName?: string;
  branchId?: number;
  branchName?: string;
  facultyStaffLinkId?: number | null;
  facultyName: string | null;
  roomLabel: string | null;
  batchLabel?: string | null;
  year?: number | null;
  semester?: number | null;
  studentCount?: number | null;
  sessionStatus: string;
  posted: boolean;
  isMySession?: boolean;
  presentCount: number;
  absentCount: number;
};

export function formatSectionDisplay(section: string | null | undefined, sections?: string[] | null) {
  if (sections && sections.length > 1) {
    const cleaned = sections.map((s) => s.replace(/^section\s+/i, "").trim());
    return `Sections ${cleaned.join(", ")}`;
  }
  if (!section) return "";
  const trimmed = section.trim();
  if (/^sections?\s+/i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.includes(",")) {
    const parts = trimmed.split(",").map((s) => s.replace(/^section\s+/i, "").trim());
    return `Sections ${parts.join(", ")}`;
  }
  return `Section ${trimmed}`;
}

type ListResponse = {
  date: string;
  scheduled: number;
  posted: number;
  mySessionsCount?: number;
  currentStaffLinkId?: number | null;
  data: AttendanceSessionCard[];
  generated?: { planCount: number; created: number } | null;
  source?: { sessions: string; holidays: string };
};

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function todayIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toYMD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromYMD(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function AttendanceTodayView() {
  const { filters, masters, setFilters } = useAcademicContext();
  const { authorization, hasPermission } = useAuth();
  const isSuperAdmin = isSuperAdminUser(authorization);
  const teachingStaffOnly = isTeachingStaffOnly(authorization);

  const [date, setDate] = useState<string>(todayIso);
  const [viewScope, setViewScope] = useState<"mine" | "all">("all");
  const [hasInitializedScope, setHasInitializedScope] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "posted">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [payload, setPayload] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // All Batches mode data: running cohorts in current academic year
  const [allBatchesData, setAllBatchesData] = useState<any[]>([]);

  // Selected semester tab (e.g. 'all', '1-1', '1-2', etc.)
  const [selectedSemesterTab, setSelectedSemesterTab] = useState<string>("all");

  // Synchronize AcademicFilterBar (Year & Semester dropdowns) with selectedSemesterTab
  useEffect(() => {
    if (filters.year !== "all" && filters.semester !== "all") {
      const target = `${filters.year}-${filters.semester}`;
      if (selectedSemesterTab !== target) {
        setSelectedSemesterTab(target);
      }
    } else if (filters.year !== "all" && filters.semester === "all") {
      // If currently on a tab from a different year, reset to 'all'
      if (selectedSemesterTab !== "all") {
        const [y] = selectedSemesterTab.split("-");
        if (Number(y) !== Number(filters.year)) {
          setSelectedSemesterTab("all");
        }
      }
    } else if (filters.year === "all" && filters.semester === "all") {
      if (selectedSemesterTab !== "all") {
        setSelectedSemesterTab("all");
      }
    } else if (filters.year === "all" && filters.semester !== "all") {
      if (selectedSemesterTab !== "all" && !selectedSemesterTab.endsWith(`-${filters.semester}`)) {
        setSelectedSemesterTab("all");
      }
    }
  }, [filters.year, filters.semester, selectedSemesterTab]);

  const userRoles = useMemo(() => {
    const list: string[] = [];
    if (authorization?.roles) {
      for (const r of authorization.roles) {
        if (r.roleKey) {
          list.push(r.roleKey.toLowerCase().replace(/[\s-]/g, "_"));
        }
      }
    }
    return list;
  }, [authorization]);

  const canPostAttendance = useMemo(() => {
    if (isSuperAdmin) return true;
    if (hasPermission("attendance.post")) return true;
    const allowedRoles = [
      "principal",
      "vice_principal",
      "viceprincipal",
      "hod",
      "hods",
      "faculty",
      "staff",
      "teacher",
    ];
    return allowedRoles.some((role) => userRoles.includes(role));
  }, [isSuperAdmin, hasPermission, userRoles]);

  // Load running cohorts from /today-timetable/all-batches to match Timetable cohorts
  useEffect(() => {
    let cancelled = false;
    async function loadBatches() {
      if (!filters.academicYear) return;
      try {
        const params = new URLSearchParams();
        if (filters.collegeId !== "all") params.set("collegeId", String(filters.collegeId));
        if (filters.courseId !== "all") params.set("courseId", String(filters.courseId));
        if (filters.branchId !== "all") params.set("branchId", String(filters.branchId));
        params.set("academicYear", filters.academicYear);
        params.set("date", date);

        const res = await apiFetch(`/today-timetable/all-batches?${params.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && Array.isArray(json?.data)) {
          setAllBatchesData(json.data);
        }
      } catch {
        // Fallback gracefully if endpoint isn't accessible
      }
    }
    void loadBatches();
    return () => {
      cancelled = true;
    };
  }, [filters.academicYear, filters.collegeId, filters.courseId, filters.branchId, date]);

  // Load attendance sessions
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams();
        queryParams.set("date", date);
        if (teachingStaffOnly || viewScope === "mine") {
          queryParams.set("scope", "mine");
        } else {
          if (filters.academicYear) queryParams.set("academicYear", filters.academicYear);
          if (filters.collegeId !== "all") queryParams.set("collegeId", String(filters.collegeId));
          if (filters.courseId !== "all") queryParams.set("courseId", String(filters.courseId));
          if (filters.branchId !== "all") queryParams.set("branchId", String(filters.branchId));
          if (filters.batch !== "all") queryParams.set("batch", filters.batch);
          if (filters.year !== "all") queryParams.set("year", String(filters.year));
          if (filters.semester !== "all") queryParams.set("semester", String(filters.semester));
          if (filters.section !== "all") queryParams.set("section", filters.section);
        }

        const response = await apiFetch(`/attendance/sessions?${queryParams.toString()}`, {
          cache: "no-store",
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            typeof body === "object" && body && "message" in body
              ? String((body as { message: string }).message)
              : `Failed to load class sessions (${response.status})`,
          );
        }
        if (!cancelled) setPayload(body as ListResponse);
      } catch (err) {
        if (!cancelled) {
          setPayload(null);
          setError(err instanceof Error ? err.message : "Failed to load class sessions");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [
    date,
    viewScope,
    teachingStaffOnly,
    filters.academicYear,
    filters.collegeId,
    filters.courseId,
    filters.branchId,
    filters.batch,
    filters.year,
    filters.semester,
    filters.section,
  ]);

  // Automatically default scope
  useEffect(() => {
    if (payload && !hasInitializedScope) {
      if (isSuperAdmin) {
        setViewScope("all");
      } else if (!teachingStaffOnly && (payload.mySessionsCount ?? 0) === 0) {
        setViewScope("all");
      } else if (teachingStaffOnly || (payload.mySessionsCount ?? 0) > 0) {
        setViewScope("mine");
      } else {
        setViewScope("all");
      }
      setHasInitializedScope(true);
    }
  }, [payload, hasInitializedScope, teachingStaffOnly, isSuperAdmin]);

  const prevDay = () => {
    const d = fromYMD(date);
    d.setDate(d.getDate() - 1);
    setDate(toYMD(d));
  };

  const nextDay = () => {
    const todayStr = todayIso();
    if (date >= todayStr) return;
    const d = fromYMD(date);
    d.setDate(d.getDate() + 1);
    const nextStr = toYMD(d);
    setDate(nextStr > todayStr ? todayStr : nextStr);
  };

  const selectedDayName = useMemo(() => {
    return DAY_NAMES[fromYMD(date).getDay()];
  }, [date]);

  const selectedCollege = useMemo(() => {
    if (!masters || filters.collegeId === "all") return null;
    return masters.colleges.find((c) => c.id === filters.collegeId) ?? null;
  }, [masters, filters.collegeId]);

  const selectedCourse = useMemo(() => {
    if (!masters || filters.courseId === "all") return null;
    return masters.courses.find((c) => c.id === filters.courseId) ?? null;
  }, [masters, filters.courseId]);

  const selectedBranch = useMemo(() => {
    if (!masters || filters.branchId === "all") return null;
    return masters.branches.find((b) => b.id === filters.branchId) ?? null;
  }, [masters, filters.branchId]);

  const allSessions = payload?.data ?? [];
  const isMyOnlyScope = teachingStaffOnly || viewScope === "mine";
  const mySessions = useMemo(() => allSessions.filter((s) => s.isMySession), [allSessions]);
  const mySessionsCount = payload?.mySessionsCount ?? mySessions.length;

  // Semester pills mapped to Course and selected Year
  const semesterPills = useMemo(() => {
    let pills: Array<{ label: string; year: number; semester: number }> = [];

    if (selectedCourse) {
      const totalYears = selectedCourse?.totalYears ?? 4;
      const semsPerYear = selectedCourse?.semestersPerYear ?? 2;
      for (let y = 1; y <= totalYears; y++) {
        for (let s = 1; s <= semsPerYear; s++) {
          pills.push({
            label: `${y}-${s}`,
            year: y,
            semester: s,
          });
        }
      }
    } else {
      const seen = new Set<string>();
      for (const b of allBatchesData) {
        if (b.year != null && b.semester != null) {
          const key = `${b.year}-${b.semester}`;
          if (!seen.has(key)) {
            seen.add(key);
            pills.push({ label: key, year: Number(b.year), semester: Number(b.semester) });
          }
        }
      }
      for (const s of allSessions) {
        if (s.year != null && s.semester != null) {
          const key = `${s.year}-${s.semester}`;
          if (!seen.has(key)) {
            seen.add(key);
            pills.push({ label: key, year: Number(s.year), semester: Number(s.semester) });
          }
        }
      }
    }

    // MAP TO SELECTED YEAR: If a specific year is selected in the above filter, show only the semesters of that year!
    if (filters.year !== "all") {
      const selectedYearNum = Number(filters.year);
      pills = pills.filter((p) => p.year === selectedYearNum);

      // If no pills found for that year from batches, generate default semesters 1 and 2 for that year
      if (pills.length === 0) {
        pills = [
          { label: `${selectedYearNum}-1`, year: selectedYearNum, semester: 1 },
          { label: `${selectedYearNum}-2`, year: selectedYearNum, semester: 2 },
        ];
      }
    }

    return pills.sort((a, b) => (a.year !== b.year ? a.year - b.year : a.semester - b.semester));
  }, [selectedCourse, allBatchesData, allSessions, filters.year]);

  const totalCohortsCount = useMemo(() => {
    if (allBatchesData.length > 0) return allBatchesData.length;
    const unique = new Set(allSessions.map((s) => `${s.branchId}-${s.year}-${s.semester}-${s.section}`));
    return unique.size > 0 ? unique.size : allSessions.length;
  }, [allBatchesData, allSessions]);

  const allSemestersCount = useMemo(() => {
    if (filters.year !== "all") {
      const yNum = Number(filters.year);
      if (allBatchesData.length > 0) {
        return allBatchesData.filter((b) => Number(b.year) === yNum).length;
      }
      return allSessions.filter((s) => Number(s.year) === yNum).length;
    }
    return totalCohortsCount;
  }, [filters.year, allBatchesData, allSessions, totalCohortsCount]);

  // Available branch filter options if sessions span multiple branches
  const branchOptions = useMemo(() => {
    const map = new Map<number, string>();
    const pool = isMyOnlyScope ? mySessions : allSessions;
    pool.forEach((s) => {
      if (s.branchId != null) {
        map.set(s.branchId, s.branchName || `Branch ${s.branchId}`);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [allSessions, mySessions, isMyOnlyScope]);

  // Filter sessions by scope, college, course, branch, semester tab, status, and search query
  const filteredSessions = useMemo(() => {
    return allSessions.filter((item) => {
      if (isMyOnlyScope && !item.isMySession) {
        return false;
      }
      if (filters.collegeId !== "all" && item.collegeId != null && item.collegeId !== Number(filters.collegeId)) {
        return false;
      }
      if (filters.courseId !== "all" && item.courseId != null && item.courseId !== Number(filters.courseId)) {
        return false;
      }
      if (filters.branchId !== "all" && item.branchId != null && item.branchId !== Number(filters.branchId)) {
        return false;
      }
      if (selectedBranchId !== "all" && String(item.branchId) !== selectedBranchId) {
        return false;
      }
      if (selectedSemesterTab !== "all") {
        const [yStr, sStr] = selectedSemesterTab.split("-");
        if (item.year != null && item.year !== Number(yStr)) return false;
        if (item.semester != null && item.semester !== Number(sStr)) return false;
      } else {
        if (filters.year !== "all" && item.year != null && item.year !== Number(filters.year)) {
          return false;
        }
        if (filters.semester !== "all" && item.semester != null && item.semester !== Number(filters.semester)) {
          return false;
        }
      }
      if (statusFilter === "pending" && item.posted) {
        return false;
      }
      if (statusFilter === "posted" && !item.posted) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const sub = (item.subjectName || "").toLowerCase();
        const code = (item.subjectCode || "").toLowerCase();
        const sec = (item.section || "").toLowerCase();
        const fac = (item.facultyName || "").toLowerCase();
        const room = (item.roomLabel || "").toLowerCase();
        if (!sub.includes(q) && !code.includes(q) && !sec.includes(q) && !fac.includes(q) && !room.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [
    allSessions,
    isMyOnlyScope,
    filters.collegeId,
    filters.courseId,
    filters.branchId,
    selectedBranchId,
    selectedSemesterTab,
    filters.year,
    filters.semester,
    statusFilter,
    searchQuery,
  ]);

  const displayedScopeSessions = useMemo(() => {
    if (isMyOnlyScope) return mySessions;
    return allSessions;
  }, [allSessions, mySessions, isMyOnlyScope]);

  const totalPending = useMemo(() => displayedScopeSessions.filter((s) => !s.posted).length, [displayedScopeSessions]);
  const totalPosted = useMemo(() => displayedScopeSessions.filter((s) => s.posted).length, [displayedScopeSessions]);

  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader
        title="Attendance Posting"
        description="Mark and submit class period attendance, or monitor department sessions across active cohorts."
      />

      {/* 1. Page Filters Bar */}
      <div className="mb-4 print:hidden">
        <AcademicFilterBar title="Page filters" />
      </div>

      {/* 2. Role Access Policy Notice */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs shadow-xs">
        <div className="flex items-center gap-2">
          {canPostAttendance ? (
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Authorized: Edit Access Enabled (Super Admin / Assigned Roles)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
              <Lock className="h-3.5 w-3.5" />
              <span>View Only: Attendance posting requires &apos;Post Attendance&apos; permission</span>
            </span>
          )}
        </div>
      </div>

      {/* 3. Semester Switcher Tabs (All Semesters, 1-1, 1-2, 2-1, 3-1, 4-1, etc.) */}
      {semesterPills.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2">Semester:</span>
            <button
              type="button"
              onClick={() => {
                setSelectedSemesterTab("all");
                if (filters.year !== "all") {
                  setFilters({ semester: "all" });
                } else {
                  setFilters({ year: "all", semester: "all" });
                }
              }}
              className={cn(
                "px-3.5 py-1 text-xs font-bold rounded-lg transition-all border",
                selectedSemesterTab === "all"
                  ? "bg-navy-900 text-white border-navy-900 shadow-xs ring-2 ring-navy-200"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100",
              )}
            >
              All Semesters ({allSemestersCount})
            </button>
            {semesterPills.map((pill) => {
              const isSelected = selectedSemesterTab === pill.label;
              const cohortCount =
                allBatchesData.length > 0
                  ? allBatchesData.filter(
                      (b) => Number(b.year) === pill.year && Number(b.semester) === pill.semester,
                    ).length
                  : allSessions.filter(
                      (s) => Number(s.year) === pill.year && Number(s.semester) === pill.semester,
                    ).length;
              return (
                <button
                  key={pill.label}
                  type="button"
                  onClick={() => {
                    setSelectedSemesterTab(pill.label);
                    setFilters({ year: pill.year, semester: pill.semester });
                  }}
                  className={cn(
                    "px-3.5 py-1 text-xs font-bold rounded-lg transition-all border",
                    isSelected
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-200"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300",
                  )}
                >
                  {pill.label} {cohortCount > 0 ? `(${cohortCount})` : ""}
                </button>
              );
            })}
          </div>
          <div className="text-xs text-slate-500 pr-2">
            {selectedSemesterTab === "all" ? (
              filters.year !== "all" ? (
                <span>Showing <strong>all running cohorts for Year {filters.year}</strong></span>
              ) : (
                <span>Showing <strong>all running cohorts</strong></span>
              )
            ) : (
              <span>Showing <strong>Semester {selectedSemesterTab}</strong></span>
            )}
          </div>
        </div>
      )}

      {/* 4. Unified Date & Context Navigation Banner */}
      <Card className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-navy-900">
              {filters.collegeId === "all"
                ? "All Colleges"
                : selectedCollege?.name || "Selected College"}
              {filters.branchId !== "all" && selectedBranch ? ` · ${selectedBranch.name}` : ""}
              {filters.academicYear ? ` · ${filters.academicYear}` : ""}
            </h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-bold text-indigo-800 border border-indigo-200">
              <BookOpen className="h-3 w-3" />
              <span>
                {filters.collegeId === "all"
                  ? "All Colleges · All Classes"
                  : filters.branchId === "all"
                  ? "All Branches · All Classes"
                  : "All Active Semesters"}
              </span>
            </span>
          </div>
          <p className="mt-0.5 text-sm font-semibold text-navy-900">
            {filters.year !== "all" ? (
              <span>
                Showing active cohorts for Year {filters.year} ({allSemestersCount} running timetable{allSemestersCount === 1 ? "" : "s"}) for this academic year
              </span>
            ) : (
              <span>
                Showing all active cohorts ({totalCohortsCount} running timetable{totalCohortsCount === 1 ? "" : "s"}) for this academic year
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prevDay}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 transition-colors"
            title="Previous Day"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="relative inline-flex items-center">
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-center hover:bg-slate-100 transition-colors min-w-[170px]"
              title="Click to open calendar"
            >
              <p className="text-sm font-bold text-navy-900">{selectedDayName}</p>
              <p className="text-xs text-slate-500">{formatDate(fromYMD(date))}</p>
            </button>
            <input
              type="date"
              value={date}
              max={todayIso()}
              onChange={(e) => {
                const val = e.target.value;
                if (val && val <= todayIso()) {
                  setDate(val);
                }
              }}
              className="absolute inset-0 opacity-0 cursor-pointer"
              aria-label="Pick date"
            />
          </div>

          <button
            type="button"
            onClick={nextDay}
            disabled={date >= todayIso()}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Next Day"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </Card>

      {/* Row: Search on Left & Status Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-0.5">
        {/* Quick Search on Left side */}
        <div className="relative flex-1 min-w-0 max-w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Filter subject, section, faculty…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-full rounded-lg border border-border bg-white pl-8 pr-2 text-xs text-navy-900 outline-none focus:border-navy-800 shadow-2xs"
          />
        </div>

        {/* 3 Quick Status Filter Cards */}
        <div className="grid grid-cols-3 gap-1.5 text-[10px] sm:text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`rounded-lg border px-2.5 py-1 text-center transition-all ${
              statusFilter === "all"
                ? "border-navy-800 bg-navy-50/90 text-navy-900 shadow-2xs ring-1 ring-navy-800/20"
                : "border-border/80 bg-slate-50/80 text-slate-700 hover:bg-slate-100"
            }`}
          >
            <span className="text-slate-500 block leading-tight text-[10px]">
              {teachingStaffOnly ? "My Periods:" : "Scheduled:"}
            </span>
            <span className="font-extrabold text-navy-900 text-xs sm:text-sm">{displayedScopeSessions.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("pending")}
            className={`rounded-lg border px-2.5 py-1 text-center transition-all ${
              statusFilter === "pending"
                ? "border-amber-500 bg-amber-50 text-amber-900 shadow-2xs ring-1 ring-amber-500/30"
                : "border-amber-200/80 bg-amber-50/40 text-amber-800 hover:bg-amber-100/60"
            }`}
          >
            <span className="text-amber-700 block leading-tight text-[10px]">Pending:</span>
            <span className="font-extrabold text-amber-700 text-xs sm:text-sm">{totalPending}</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("posted")}
            className={`rounded-lg border px-2.5 py-1 text-center transition-all ${
              statusFilter === "posted"
                ? "border-emerald-600 bg-emerald-50 text-emerald-900 shadow-2xs ring-1 ring-emerald-600/30"
                : "border-emerald-200/80 bg-emerald-50/40 text-emerald-800 hover:bg-emerald-100/60"
            }`}
          >
            <span className="text-emerald-700 block leading-tight text-[10px]">Posted:</span>
            <span className="font-extrabold text-emerald-700 text-xs sm:text-sm">{totalPosted}</span>
          </button>
        </div>
      </div>

      {/* Secondary Scope / Branch filter for Leadership */}
      {!teachingStaffOnly && (allSessions.length > 0 || branchOptions.length > 1) ? (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-500 font-semibold">Scope:</span>
            <button
              type="button"
              onClick={() => setViewScope("mine")}
              className={`rounded px-2 py-0.5 text-[11px] font-bold transition-all ${
                viewScope === "mine"
                  ? "bg-navy-800 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              My Attendance ({mySessionsCount})
            </button>
            <button
              type="button"
              onClick={() => setViewScope("all")}
              className={`rounded px-2 py-0.5 text-[11px] font-bold transition-all ${
                viewScope === "all"
                  ? "bg-navy-800 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All Department Slots ({allSessions.length})
            </button>
          </div>
          {branchOptions.length > 1 ? (
            <div className="flex items-center gap-1 ml-auto">
              <span className="text-[11px] text-slate-500 font-semibold">Branch:</span>
              <button
                type="button"
                onClick={() => setSelectedBranchId("all")}
                className={`rounded px-2 py-0.5 text-[11px] font-semibold transition-all ${
                  selectedBranchId === "all"
                    ? "bg-navy-800 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All ({displayedScopeSessions.length})
              </button>
              {branchOptions.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedBranchId(String(b.id))}
                  className={`rounded px-2 py-0.5 text-[11px] font-semibold transition-all ${
                    selectedBranchId === String(b.id)
                      ? "bg-navy-800 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {b.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Error Banner */}
      {error ? (
        <Card className="border-critical/30 bg-critical/5 p-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-critical shrink-0" />
            <p className="text-xs font-medium text-navy-900">Unable to load class sessions</p>
          </div>
          <p className="mt-1 text-xs text-critical">{error}</p>
        </Card>
      ) : null}

      {/* Loading State: Skeleton Cards */}
      {loading ? (
        <div className="grid gap-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading class periods">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Card
              key={idx}
              className="flex flex-col justify-between border-l-4 border-l-slate-200 p-2.5 sm:p-3.5 shadow-2xs"
            >
              <div>
                <div className="mb-2 flex items-center justify-between gap-2 border-b border-border/50 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Skeleton className="h-4.5 w-16 rounded" />
                    <Skeleton className="h-4 w-24 rounded" />
                  </div>
                  <Skeleton className="h-4 w-14 rounded-full" />
                </div>
                <Skeleton className="h-5 w-4/5 mb-1.5 rounded" />
                <Skeleton className="h-4 w-1/2 mb-2.5 rounded" />
                <div className="space-y-1.5 pt-1">
                  <Skeleton className="h-3.5 w-48 rounded" />
                  <Skeleton className="h-3.5 w-36 rounded" />
                </div>
              </div>
              <div className="mt-3.5 pt-1.5 border-t border-border/40">
                <Skeleton className="h-7.5 sm:h-8 w-full rounded-lg" />
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {/* Empty State when no sessions exist */}
      {!loading && filteredSessions.length === 0 && !error ? (
        <Card className="py-8 px-4 text-center">
          <Calendar className="mx-auto h-7 w-7 text-slate-400" />
          <p className="mt-2 text-sm font-bold text-navy-900">
            {isMyOnlyScope
              ? "No assigned teaching slots scheduled for this date."
              : `No class sessions scheduled for ${selectedDayName}.`}
          </p>
          <div className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
            {isMyOnlyScope ? (
              <>
                <p>You have no classes or periods assigned to teach on {selectedDayName}.</p>
                {!teachingStaffOnly && allSessions.length > 0 ? (
                  <div className="mt-2.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setViewScope("all")}
                      className="text-xs h-7.5 px-3"
                    >
                      <span>Switch to All Department Slots ({allSessions.length})</span>
                    </Button>
                  </div>
                ) : null}
              </>
            ) : allSessions.length > 0 ? (
              "No sessions matched your active branch, semester, or search filters. Clear filters to view all sessions."
            ) : (
              "There are no active timetable periods for this date matching the selected filters. Please verify academic year, college, or published timetables."
            )}
          </div>
        </Card>
      ) : null}

      {/* Sessions Grid */}
      {!loading && filteredSessions.length > 0 ? (
        <div className="grid gap-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredSessions.map((item) => (
            <Card
              key={item.id}
              className={`flex flex-col justify-between border-l-4 p-2.5 sm:p-3.5 shadow-2xs hover:shadow-xs transition-all ${
                item.posted
                  ? "border-l-emerald-500 bg-white"
                  : item.isMySession
                    ? "border-l-indigo-600 bg-white"
                    : "border-l-amber-500 bg-white"
              }`}
            >
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-1.5 border-b border-border/50 pb-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {item.slotLabel ? (
                      <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-navy-900 bg-navy-100/90 border border-navy-200 px-1.5 py-0.2 rounded shadow-2xs">
                        {item.slotLabel}
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-medium text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded">
                      <Clock className="h-3 w-3 text-slate-500" />
                      {item.startTime ?? "—"}{item.endTime ? ` – ${item.endTime}` : ""}
                    </span>
                    {item.isMySession && !teachingStaffOnly ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">
                        ★ My Slot
                      </span>
                    ) : null}
                    {item.year != null && item.semester != null ? (
                      <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {item.year}-{item.semester}
                      </span>
                    ) : null}
                    {item.batchLabel ? (
                      <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-300">
                        {item.batchLabel}
                      </span>
                    ) : null}
                    {item.sections && item.sections.length > 1 ? (
                      <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Combined ({item.sections.length} Sec)
                      </span>
                    ) : null}
                    {item.subjectTypeSnapshot ? (
                      <span
                        className={`inline-flex items-center text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded ${
                          item.subjectTypeSnapshot.toLowerCase() === "lab"
                            ? "bg-purple-50 text-purple-700 border border-purple-200"
                            : "bg-sky-50 text-sky-700 border border-sky-200"
                        }`}
                      >
                        {item.subjectTypeSnapshot}
                      </span>
                    ) : null}
                  </div>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[9.5px] sm:text-[10px] font-extrabold uppercase tracking-wide shrink-0 ${
                      item.posted
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {item.posted ? "Posted" : "Pending"}
                  </span>
                </div>

                <h3 className="text-xs sm:text-sm font-bold text-navy-900 leading-snug line-clamp-1">
                  {item.subjectName ?? "Untitled subject"}
                </h3>
                <p className="text-[10.5px] sm:text-xs font-medium text-slate-600 mt-0.5 truncate">
                  {item.subjectCode ?? "—"}
                  {item.section ? ` • ${formatSectionDisplay(item.section, item.sections)}` : ""}
                  {item.batchLabel ? ` • ${item.batchLabel}` : ""}
                  {item.branchName ? ` • ${item.branchName}` : ""}
                </p>
                <p className="mt-1 text-[10px] sm:text-xs text-slate-500 truncate">
                  <span className="font-semibold text-slate-700">Faculty:</span>{" "}
                  {item.facultyName ? (
                    item.isMySession ? (
                      <span className="font-semibold text-navy-900">
                        {item.facultyName} <span className="text-indigo-600 font-bold">(You)</span>
                      </span>
                    ) : (
                      item.facultyName
                    )
                  ) : (
                    "Faculty unassigned"
                  )}
                  {item.roomLabel ? ` • Room: ${item.roomLabel}` : ""}
                </p>

                {item.posted ? (
                  <div className="mt-2 rounded-lg bg-emerald-50/80 p-1.5 text-[10px] sm:text-xs text-emerald-900 font-medium flex items-center justify-between border border-emerald-100">
                    <span>Present: <strong className="text-emerald-700">{item.presentCount}</strong></span>
                    <span>Absent: <strong className="text-rose-700">{item.absentCount}</strong></span>
                  </div>
                ) : null}
              </div>

              <div className="mt-2.5 pt-0.5">
                <Link href={`/attendance-posting/${item.id}`} className="block w-full">
                  <Button
                    className="w-full h-7.5 sm:h-8 text-xs font-semibold active:scale-[0.99] transition-transform"
                    variant={item.posted ? "secondary" : "primary"}
                  >
                    {item.posted
                      ? "Review / Edit Attendance"
                      : item.isMySession
                        ? item.sections && item.sections.length > 1
                          ? "Post Attendance (Combined)"
                          : "Post Attendance"
                        : "Post Attendance (Dept / Substitute)"}
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
