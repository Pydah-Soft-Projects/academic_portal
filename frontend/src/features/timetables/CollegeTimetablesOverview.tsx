"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiFetch } from "@/lib/api";
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Search,
  RefreshCw,
  PlusCircle,
  Layers,
  ArrowRight,
  BookOpen,
  Users,
  UserCheck,
  UserPlus,
} from "lucide-react";
import {
  AssignClassTeacherModal,
  type TargetSectionScope,
} from "@/features/class-teacher/AssignClassTeacherModal";

export type TimetableOverviewClass = {
  courseId: number;
  courseName: string;
  branchId: number;
  branchName: string;
  batch: string;
  year: number;
  semester: number;
  section: string;
  studentCount: number;
  status: "published" | "drafted" | "pending";
  planId: number | null;
  versionNo: number | null;
  updatedAt: string | null;
  classTeacher?: {
    facultyStaffLinkId: number;
    facultyName: string;
    hrmsEmployeeId: string;
    departmentName: string | null;
  } | null;
};

export type TimetableOverviewYearSem = {
  year: number;
  semester: number;
  label: string;
  total: number;
  published: number;
  drafted: number;
  pending: number;
  classes: TimetableOverviewClass[];
};

export type TimetableOverviewCollege = {
  collegeId: number;
  collegeName: string;
  collegeCode: string;
  totalClasses: number;
  publishedCount: number;
  draftedCount: number;
  pendingCount: number;
  yearSemBreakdown: TimetableOverviewYearSem[];
};

export type TimetableOverviewData = {
  academicYear: string;
  colleges: TimetableOverviewCollege[];
  summary: {
    totalColleges: number;
    totalClasses: number;
    totalPublished: number;
    totalDrafted: number;
    totalPending: number;
  };
};

type Props = {
  academicYear?: string;
  selectedCollegeId?: number | "all";
  courseId?: number | "all";
  branchId?: number | "all";
  batch?: string | "all";
  year?: number | "all";
  semester?: number | "all";
  section?: string | "all";
  onSelectClass?: (classInfo: {
    collegeId: number;
    courseId: number;
    branchId: number;
    batch: string;
    year: number;
    semester: number;
    section: string;
  }) => void;
  onSelectCollege?: (collegeId: number) => void;
};

export function CollegeTimetablesOverview({
  academicYear,
  selectedCollegeId,
  courseId,
  branchId,
  batch,
  year,
  semester,
  section,
  onSelectClass,
  onSelectCollege,
}: Props) {
  const [data, setData] = useState<TimetableOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "drafted" | "pending">("all");
  const [expandedYearSems, setExpandedYearSems] = useState<Set<string>>(new Set());
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignSection, setAssignSection] = useState<TargetSectionScope | null>(null);

  const loadOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (academicYear && academicYear !== "all") {
        params.set("academicYear", academicYear);
      }
      if (selectedCollegeId && selectedCollegeId !== "all") {
        params.set("collegeId", String(selectedCollegeId));
      }
      if (courseId && courseId !== "all") {
        params.set("courseId", String(courseId));
      }
      if (branchId && branchId !== "all") {
        params.set("branchId", String(branchId));
      }
      if (batch && batch !== "all") {
        params.set("batch", String(batch));
      }
      if (year && year !== "all") {
        params.set("year", String(year));
      }
      if (semester && semester !== "all") {
        params.set("semester", String(semester));
      }
      if (section && section !== "all") {
        params.set("section", String(section));
      }
      const res = await apiFetch(`/timetables/overview?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load timetable overview (${res.status})`);
      }
      const json = await res.json();
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load timetable overview");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOverview();
  }, [academicYear, selectedCollegeId, courseId, branchId, batch, year, semester, section]);

  const toggleYearSemExpand = (collegeId: number, year: number, sem: number) => {
    const key = `${collegeId}-${year}-${sem}`;
    setExpandedYearSems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAllYearSemsForCollege = (
    collegeId: number,
    yearSems: Array<{ year: number; semester: number }>
  ) => {
    setExpandedYearSems((prev) => {
      const next = new Set(prev);
      const allExpanded = yearSems.every((ys) =>
        next.has(`${collegeId}-${ys.year}-${ys.semester}`)
      );
      if (allExpanded) {
        yearSems.forEach((ys) =>
          next.delete(`${collegeId}-${ys.year}-${ys.semester}`)
        );
      } else {
        yearSems.forEach((ys) =>
          next.add(`${collegeId}-${ys.year}-${ys.semester}`)
        );
      }
      return next;
    });
  };

  const sanitizedColleges = useMemo(() => {
    if (!data?.colleges) return [];
    return data.colleges
      .map((col) => {
        const validYearSems = col.yearSemBreakdown
          .filter((ys) => {
            if (year && year !== "all" && ys.year !== Number(year)) {
              return false;
            }
            if (semester && semester !== "all" && ys.semester !== Number(semester)) {
              return false;
            }
            return true;
          })
          .map((ys) => {
            const validClasses = ys.classes.filter((c) => {
              if ((c.studentCount ?? 0) <= 0) return false;
              if (courseId && courseId !== "all" && c.courseId !== Number(courseId)) {
                return false;
              }
              if (branchId && branchId !== "all" && c.branchId !== Number(branchId)) {
                return false;
              }
              if (batch && batch !== "all" && c.batch?.trim().toLowerCase() !== String(batch).trim().toLowerCase()) {
                return false;
              }
              if (year && year !== "all" && c.year !== Number(year)) {
                return false;
              }
              if (semester && semester !== "all" && c.semester !== Number(semester)) {
                return false;
              }
              if (section && section !== "all" && c.section?.trim().toUpperCase() !== String(section).trim().toUpperCase()) {
                return false;
              }
              return true;
            });
            const pub = validClasses.filter((c) => c.status === "published").length;
            const draft = validClasses.filter((c) => c.status === "drafted").length;
            const pend = validClasses.filter((c) => c.status === "pending").length;
            return {
              ...ys,
              total: validClasses.length,
              published: pub,
              drafted: draft,
              pending: pend,
              classes: validClasses,
            };
          })
          .filter((ys) => ys.total > 0);

        const totalClasses = validYearSems.reduce((acc, ys) => acc + ys.total, 0);
        const pubCount = validYearSems.reduce((acc, ys) => acc + ys.published, 0);
        const draftCount = validYearSems.reduce((acc, ys) => acc + ys.drafted, 0);
        const pendCount = validYearSems.reduce((acc, ys) => acc + ys.pending, 0);

        return {
          ...col,
          totalClasses,
          publishedCount: pubCount,
          draftedCount: draftCount,
          pendingCount: pendCount,
          yearSemBreakdown: validYearSems,
        };
      })
      .filter((col) => col.totalClasses > 0);
  }, [data, year, semester, courseId, branchId, batch, section]);

  // Auto-expand if single configuration is displayed when filtered
  useEffect(() => {
    if (sanitizedColleges.length === 1 && sanitizedColleges[0].yearSemBreakdown.length === 1) {
      const ys = sanitizedColleges[0].yearSemBreakdown[0];
      const key = `${sanitizedColleges[0].collegeId}-${ys.year}-${ys.semester}`;
      setExpandedYearSems((prev) => {
        if (prev.has(key)) return prev;
        const next = new Set(prev);
        next.add(key);
        return next;
      });
    }
  }, [sanitizedColleges]);

  const summary = useMemo(() => {
    const totalColleges = sanitizedColleges.length;
    const totalClasses = sanitizedColleges.reduce((acc, c) => acc + c.totalClasses, 0);
    const totalPublished = sanitizedColleges.reduce((acc, c) => acc + c.publishedCount, 0);
    const totalDrafted = sanitizedColleges.reduce((acc, c) => acc + c.draftedCount, 0);
    const totalPending = sanitizedColleges.reduce((acc, c) => acc + c.pendingCount, 0);
    return {
      totalColleges,
      totalClasses,
      totalPublished,
      totalDrafted,
      totalPending,
    };
  }, [sanitizedColleges]);

  const filteredColleges = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return sanitizedColleges
      .map((col) => {
        const colMatchesSearch =
          !q ||
          col.collegeName.toLowerCase().includes(q) ||
          col.collegeCode.toLowerCase().includes(q);

        const displayYearSems = col.yearSemBreakdown
          .map((ys) => {
            const matchingClasses = ys.classes.filter((c) => {
              if (statusFilter !== "all" && c.status !== statusFilter) {
                return false;
              }
              if (q && !colMatchesSearch) {
                const classMatch =
                  c.courseName.toLowerCase().includes(q) ||
                  c.branchName.toLowerCase().includes(q) ||
                  c.batch.toLowerCase().includes(q) ||
                  (c.section && c.section.toLowerCase().includes(q));
                if (!classMatch) return false;
              }
              return true;
            });

            return {
              ...ys,
              matchingClasses,
            };
          })
          .filter((ys) => {
            if (statusFilter !== "all" || q) {
              return ys.matchingClasses.length > 0;
            }
            return true;
          });

        const displayClassesCount = displayYearSems.reduce(
          (acc, ys) => acc + ys.matchingClasses.length,
          0
        );

        return {
          ...col,
          displayYearSems,
          displayClassesCount,
        };
      })
      .filter((col) => {
        if (statusFilter !== "all" || q) {
          return col.displayYearSems.length > 0;
        }
        return true;
      });
  }, [sanitizedColleges, searchQuery, statusFilter]);

  const totalMatchingClasses = useMemo(() => {
    return filteredColleges.reduce((acc, c) => acc + c.displayClassesCount, 0);
  }, [filteredColleges]);

  if (loading && !data) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-slate-100 border border-border" />
          ))}
        </div>
        <div className="h-64 rounded-xl bg-slate-100 border border-border" />
        <div className="h-64 rounded-xl bg-slate-100 border border-border" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <Card className="p-6 border-rose-200 bg-rose-50/50">
        <div className="flex items-center gap-3 text-rose-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void loadOverview()}
          className="mt-3 text-xs"
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Try Again
        </Button>
      </Card>
    );
  }

  if (!data) return null;

  const publishedPct = summary.totalClasses
    ? Math.round((summary.totalPublished / summary.totalClasses) * 100)
    : 0;
  const draftedPct = summary.totalClasses
    ? Math.round((summary.totalDrafted / summary.totalClasses) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* KPI Stat Cards & Overall Progress */}
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white via-slate-50/50 to-indigo-50/20 p-4 shadow-sm">
        {/* 4 Interactive Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Total Colleges & Classes */}
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            aria-pressed={statusFilter === "all"}
            className={`group relative text-left rounded-lg border p-3.5 shadow-xs transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 ${
              statusFilter === "all"
                ? "border-navy-600 bg-white ring-2 ring-navy-600/30 shadow-md -translate-y-0.5"
                : "border-slate-200 bg-white/90 hover:border-navy-300 hover:shadow-md hover:-translate-y-0.5"
            }`}
          >
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 group-hover:text-navy-900 transition-colors">
                Total Timetables
              </span>
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                  statusFilter === "all"
                    ? "bg-navy-100 text-navy-800"
                    : "bg-slate-100 text-navy-600 group-hover:bg-navy-50"
                }`}
              >
                <Layers className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-navy-900">{summary.totalClasses}</span>
              <span className="text-xs text-slate-500">classes across {summary.totalColleges} colleges</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
              <div className="flex items-center gap-1.5">
                <Building2 className="h-3 w-3 text-slate-400" />
                <span>{summary.totalColleges} active colleges</span>
              </div>
              {statusFilter === "all" ? (
                <span className="font-bold text-navy-700 bg-navy-50 px-1.5 py-0.5 rounded text-[10px]">
                  All Shown
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 group-hover:text-navy-700 transition-colors font-medium">
                  Click to show all
                </span>
              )}
            </div>
          </button>

          {/* Card 2: Published */}
          <button
            type="button"
            onClick={() => setStatusFilter((prev) => (prev === "published" ? "all" : "published"))}
            aria-pressed={statusFilter === "published"}
            className={`group relative text-left rounded-lg border p-3.5 shadow-xs transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
              statusFilter === "published"
                ? "border-emerald-600 bg-emerald-50/90 ring-2 ring-emerald-500/40 shadow-md -translate-y-0.5"
                : "border-emerald-200/80 bg-emerald-50/40 hover:bg-emerald-50/80 hover:border-emerald-400 hover:shadow-md hover:-translate-y-0.5"
            }`}
          >
            <div className="flex items-center justify-between text-emerald-700">
              <span className="text-xs font-semibold uppercase tracking-wider group-hover:text-emerald-900 transition-colors">
                Published
              </span>
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                  statusFilter === "published"
                    ? "bg-emerald-200 text-emerald-900"
                    : "bg-emerald-100/70 text-emerald-600 group-hover:bg-emerald-200/70"
                }`}
              >
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-emerald-900">{summary.totalPublished}</span>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded">
                {publishedPct}%
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-emerald-800">
              <span>Active live timetables in system</span>
              {statusFilter === "published" ? (
                <span className="inline-flex items-center gap-1 font-bold text-emerald-900 bg-emerald-200/90 px-1.5 py-0.5 rounded text-[10px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" /> Active Filter
                </span>
              ) : (
                <span className="text-[10px] text-emerald-600/80 group-hover:text-emerald-800 transition-colors font-medium">
                  Click to filter
                </span>
              )}
            </div>
          </button>

          {/* Card 3: Drafted */}
          <button
            type="button"
            onClick={() => setStatusFilter((prev) => (prev === "drafted" ? "all" : "drafted"))}
            aria-pressed={statusFilter === "drafted"}
            className={`group relative text-left rounded-lg border p-3.5 shadow-xs transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 ${
              statusFilter === "drafted"
                ? "border-amber-600 bg-amber-50/90 ring-2 ring-amber-500/40 shadow-md -translate-y-0.5"
                : "border-amber-200/80 bg-amber-50/40 hover:bg-amber-50/80 hover:border-amber-400 hover:shadow-md hover:-translate-y-0.5"
            }`}
          >
            <div className="flex items-center justify-between text-amber-700">
              <span className="text-xs font-semibold uppercase tracking-wider group-hover:text-amber-900 transition-colors">
                Drafted / Review
              </span>
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                  statusFilter === "drafted"
                    ? "bg-amber-200 text-amber-900"
                    : "bg-amber-100/70 text-amber-600 group-hover:bg-amber-200/70"
                }`}
              >
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-amber-900">{summary.totalDrafted}</span>
              <span className="text-xs font-semibold text-amber-700 bg-amber-100/90 px-1.5 py-0.5 rounded">
                {draftedPct}%
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-amber-800">
              <span>In progress / waiting to publish</span>
              {statusFilter === "drafted" ? (
                <span className="inline-flex items-center gap-1 font-bold text-amber-900 bg-amber-200/90 px-1.5 py-0.5 rounded text-[10px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-600 animate-pulse" /> Active Filter
                </span>
              ) : (
                <span className="text-[10px] text-amber-600/80 group-hover:text-amber-800 transition-colors font-medium">
                  Click to filter
                </span>
              )}
            </div>
          </button>

          {/* Card 4: Needs Configuration */}
          <button
            type="button"
            onClick={() => setStatusFilter((prev) => (prev === "pending" ? "all" : "pending"))}
            aria-pressed={statusFilter === "pending"}
            className={`group relative text-left rounded-lg border p-3.5 shadow-xs transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 ${
              statusFilter === "pending"
                ? "border-rose-600 bg-rose-50/90 ring-2 ring-rose-500/40 shadow-md -translate-y-0.5"
                : "border-rose-200/80 bg-rose-50/30 hover:bg-rose-50/70 hover:border-rose-400 hover:shadow-md hover:-translate-y-0.5"
            }`}
          >
            <div className="flex items-center justify-between text-rose-700">
              <span className="text-xs font-semibold uppercase tracking-wider group-hover:text-rose-900 transition-colors">
                Needed to Configure
              </span>
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                  statusFilter === "pending"
                    ? "bg-rose-200 text-rose-900"
                    : "bg-rose-100/70 text-rose-600 group-hover:bg-rose-200/70"
                }`}
              >
                <AlertCircle className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-rose-900">{summary.totalPending}</span>
              <span className="text-xs font-medium text-rose-700">pending</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-rose-800">
              <span>Timetable not yet created</span>
              {statusFilter === "pending" ? (
                <span className="inline-flex items-center gap-1 font-bold text-rose-900 bg-rose-200/90 px-1.5 py-0.5 rounded text-[10px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse" /> Active Filter
                </span>
              ) : (
                <span className="text-[10px] text-rose-600/80 group-hover:text-rose-800 transition-colors font-medium">
                  Click to filter
                </span>
              )}
            </div>
          </button>
        </div>

        {/* Global Progress Strip */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5 font-medium">
            <span>Overall Timetable Completion</span>
            <span>
              {summary.totalPublished} / {summary.totalClasses} Published ({publishedPct}%)
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 flex">
            <div
              className="bg-emerald-500 transition-all duration-500"
              style={{ width: `${publishedPct}%` }}
              title={`Published: ${summary.totalPublished}`}
            />
            <div
              className="bg-amber-400 transition-all duration-500"
              style={{ width: `${draftedPct}%` }}
              title={`Drafted: ${summary.totalDrafted}`}
            />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by college name, code, or course..."
            className="h-9.5 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-navy-900 placeholder:text-slate-400 focus:border-navy-700 focus:ring-2 focus:ring-navy-900/10 outline-none transition"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 p-1 text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`rounded-md px-2.5 py-1 font-medium transition cursor-pointer ${
              statusFilter === "all"
                ? "bg-white text-navy-900 shadow-xs font-bold"
                : "text-slate-600 hover:text-navy-900"
            }`}
          >
            All Timetables ({summary.totalClasses})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter((prev) => (prev === "published" ? "all" : "published"))}
            className={`rounded-md px-2.5 py-1 font-medium transition cursor-pointer ${
              statusFilter === "published"
                ? "bg-white text-emerald-800 shadow-xs font-bold"
                : "text-slate-600 hover:text-emerald-700"
            }`}
          >
            Published ({summary.totalPublished})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter((prev) => (prev === "drafted" ? "all" : "drafted"))}
            className={`rounded-md px-2.5 py-1 font-medium transition cursor-pointer ${
              statusFilter === "drafted"
                ? "bg-white text-amber-800 shadow-xs font-bold"
                : "text-slate-600 hover:text-amber-700"
            }`}
          >
            Drafted ({summary.totalDrafted})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter((prev) => (prev === "pending" ? "all" : "pending"))}
            className={`rounded-md px-2.5 py-1 font-medium transition cursor-pointer ${
              statusFilter === "pending"
                ? "bg-white text-rose-800 shadow-xs font-bold"
                : "text-slate-600 hover:text-rose-700"
            }`}
          >
            Needs Config ({summary.totalPending})
          </button>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => void loadOverview()}
          disabled={loading}
          className="h-9 px-2.5 text-xs bg-white text-slate-700 shadow-xs border-slate-200 shrink-0"
          title="Refresh statistics"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Active Filter Pill / Banner */}
      {(statusFilter !== "all" || searchQuery.trim()) && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-indigo-50/70 border border-indigo-200/80 px-3.5 py-2 text-xs text-navy-900">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-600">Table Filter:</span>
            {statusFilter !== "all" && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-bold ${
                  statusFilter === "published"
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : statusFilter === "drafted"
                    ? "bg-amber-100 text-amber-800 border border-amber-300"
                    : "bg-rose-100 text-rose-800 border border-rose-300"
                }`}
              >
                {statusFilter === "published" ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                ) : statusFilter === "drafted" ? (
                  <Clock className="h-3 w-3 text-amber-600" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-rose-600" />
                )}
                <span>
                  {statusFilter === "published"
                    ? "Published Timetables"
                    : statusFilter === "drafted"
                    ? "Drafted / Review"
                    : "Needed to Configure"}
                </span>
              </span>
            )}
            {searchQuery.trim() && (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-medium bg-white border border-slate-300 text-slate-800">
                Search: "{searchQuery.trim()}"
              </span>
            )}
            <span className="text-slate-500 font-medium">
              Showing {totalMatchingClasses} matching {totalMatchingClasses === 1 ? "class" : "classes"} across {filteredColleges.length} {filteredColleges.length === 1 ? "college" : "colleges"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setStatusFilter("all");
              setSearchQuery("");
            }}
            className="text-xs font-semibold text-navy-700 hover:text-navy-950 underline underline-offset-2 cursor-pointer"
          >
            Reset to show all
          </button>
        </div>
      )}

      {/* Colleges List */}
      {filteredColleges.length === 0 ? (
        <Card className="p-8 text-center text-slate-500">
          <div className="flex flex-col items-center justify-center gap-2">
            <p className="text-sm font-medium">No colleges or classes match the current filter.</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setStatusFilter("all");
                setSearchQuery("");
              }}
              className="text-xs mt-1"
            >
              Clear filter and show all
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredColleges.map((col) => {
            const colPubPct = col.totalClasses
              ? Math.round((col.publishedCount / col.totalClasses) * 100)
              : 0;
            const colDraftPct = col.totalClasses
              ? Math.round((col.draftedCount / col.totalClasses) * 100)
              : 0;

            return (
              <Card
                key={col.collegeId}
                className="overflow-hidden border border-slate-200/90 shadow-xs transition hover:shadow-sm"
              >
                {/* College Card Header */}
                <div className="border-b border-slate-100 bg-slate-50/70 p-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy-900 text-white shadow-xs font-bold text-sm">
                        {col.collegeCode ? col.collegeCode.substring(0, 3) : "COL"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-navy-900">
                            {col.collegeName}
                          </h3>
                          {col.collegeCode ? (
                            <span className="rounded bg-slate-200/80 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">
                              {col.collegeCode}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {statusFilter === "all" ? (
                            <span>
                              {col.totalClasses} total target classes across {col.yearSemBreakdown.length} year & semester streams
                            </span>
                          ) : (
                            <span>
                              Showing <strong className="text-navy-900 font-bold">{col.displayClassesCount}</strong>{" "}
                              {statusFilter === "pending" ? "unconfigured" : statusFilter} classes across{" "}
                              <strong className="text-navy-900 font-bold">{col.displayYearSems.length}</strong> streams ({col.totalClasses} total in college)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Stats Badges & College Action */}
                    <div className="flex flex-wrap items-center gap-2 md:gap-3">
                      <div
                        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                          statusFilter === "published"
                            ? "bg-emerald-100 border border-emerald-400 text-emerald-900 ring-2 ring-emerald-500/30"
                            : "bg-emerald-50 border border-emerald-200 text-emerald-800"
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        <span>Published: {col.publishedCount}</span>
                      </div>
                      <div
                        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                          statusFilter === "drafted"
                            ? "bg-amber-100 border border-amber-400 text-amber-900 ring-2 ring-amber-500/30"
                            : "bg-amber-50 border border-amber-200 text-amber-800"
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        <span>Drafted: {col.draftedCount}</span>
                      </div>
                      <div
                        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                          statusFilter === "pending"
                            ? "bg-rose-100 border border-rose-400 text-rose-900 ring-2 ring-rose-500/30"
                            : "bg-rose-50 border border-rose-200 text-rose-800"
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                        <span>Needs Config: {col.pendingCount}</span>
                      </div>

                      {onSelectCollege ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onSelectCollege(col.collegeId)}
                          className="text-xs bg-white text-navy-800 hover:text-navy-950 font-medium ml-1"
                        >
                          Select College <ChevronRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {/* College-level Mini Progress Bar */}
                  <div className="mt-3 flex items-center gap-2">
                    <div className="h-1.5 w-full flex-1 overflow-hidden rounded-full bg-slate-200 flex">
                      <div
                        className="bg-emerald-500 transition-all"
                        style={{ width: `${colPubPct}%` }}
                      />
                      <div
                        className="bg-amber-400 transition-all"
                        style={{ width: `${colDraftPct}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 shrink-0">
                      {colPubPct}% Published
                    </span>
                  </div>
                </div>

                {/* Year & Semester Breakdown Section */}
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-navy-700" />
                      <span>
                        Year & Semester Breakdown ({col.displayYearSems.length}{" "}
                        {statusFilter !== "all"
                          ? `of ${col.yearSemBreakdown.length} Configurations`
                          : "Configurations"}
                        )
                      </span>
                    </div>

                    {col.displayYearSems.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          toggleAllYearSemsForCollege(col.collegeId, col.displayYearSems)
                        }
                        className="text-[11px] h-6 px-2 text-slate-600 hover:text-navy-900 font-medium cursor-pointer"
                      >
                        {col.displayYearSems.every((ys) =>
                          expandedYearSems.has(`${col.collegeId}-${ys.year}-${ys.semester}`)
                        )
                          ? "Collapse All"
                          : "Expand All"}
                      </Button>
                    )}
                  </div>

                  {col.displayYearSems.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">
                      No classes or semesters match the current filter for this college.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full min-w-[700px] table-fixed border-collapse text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-100/70 font-semibold text-slate-700">
                            <th className="py-2.5 px-3 w-[26%]">Year &amp; Semester</th>
                            <th className="py-2.5 px-3 w-[11%] text-center">Total Classes</th>
                            <th
                              className={`py-2.5 px-3 w-[12%] text-center transition-colors ${
                                statusFilter === "published"
                                  ? "bg-emerald-100/80 text-emerald-900 font-bold border-x border-emerald-300"
                                  : ""
                              }`}
                            >
                              Published {statusFilter === "published" ? "●" : ""}
                            </th>
                            <th
                              className={`py-2.5 px-3 w-[12%] text-center transition-colors ${
                                statusFilter === "drafted"
                                  ? "bg-amber-100/80 text-amber-900 font-bold border-x border-amber-300"
                                  : ""
                              }`}
                            >
                              Drafted {statusFilter === "drafted" ? "●" : ""}
                            </th>
                            <th
                              className={`py-2.5 px-3 w-[15%] text-center transition-colors ${
                                statusFilter === "pending"
                                  ? "bg-rose-100/80 text-rose-900 font-bold border-x border-rose-300"
                                  : ""
                              }`}
                            >
                              Needed to Configure {statusFilter === "pending" ? "●" : ""}
                            </th>
                            <th className="py-2.5 px-3 w-[14%]">Status Progress</th>
                            <th className="py-2.5 px-3 w-[10%] text-right">Classes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-800">
                          {col.displayYearSems.map((ys) => {
                            const isExpanded = expandedYearSems.has(
                              `${col.collegeId}-${ys.year}-${ys.semester}`
                            );
                            const ysPubPct = ys.total
                              ? Math.round((ys.published / ys.total) * 100)
                              : 0;
                            const ysDraftPct = ys.total
                              ? Math.round((ys.drafted / ys.total) * 100)
                              : 0;

                            return (
                              <React.Fragment key={`${ys.year}-${ys.semester}`}>
                                <tr
                                  onClick={() =>
                                    toggleYearSemExpand(col.collegeId, ys.year, ys.semester)
                                  }
                                  className={`cursor-pointer transition-colors duration-150 select-none ${
                                    isExpanded ? "bg-slate-100/75" : "hover:bg-slate-50/80"
                                  }`}
                                  title="Click to view classes"
                                >
                                  <td className="py-2.5 px-3 font-bold text-navy-900 flex items-center gap-2">
                                    <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-navy-50 text-[11px] font-bold text-navy-800 border border-navy-200/50">
                                      {ys.year}-{ys.semester}
                                    </span>
                                    <span>{ys.label}</span>
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-semibold">
                                    {ys.total}
                                  </td>
                                  <td
                                    className={`py-2.5 px-3 text-center ${
                                      statusFilter === "published"
                                        ? "bg-emerald-50/50 border-x border-emerald-200/60"
                                        : ""
                                    }`}
                                  >
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                        ys.published > 0
                                          ? statusFilter === "published"
                                            ? "bg-emerald-600 text-white shadow-xs"
                                            : "bg-emerald-100 text-emerald-800"
                                          : "bg-slate-100 text-slate-400"
                                      }`}
                                    >
                                      {ys.published}
                                    </span>
                                  </td>
                                  <td
                                    className={`py-2.5 px-3 text-center ${
                                      statusFilter === "drafted"
                                        ? "bg-amber-50/50 border-x border-amber-200/60"
                                        : ""
                                    }`}
                                  >
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                        ys.drafted > 0
                                          ? statusFilter === "drafted"
                                            ? "bg-amber-600 text-white shadow-xs"
                                            : "bg-amber-100 text-amber-800"
                                          : "bg-slate-100 text-slate-400"
                                      }`}
                                    >
                                      {ys.drafted}
                                    </span>
                                  </td>
                                  <td
                                    className={`py-2.5 px-3 text-center ${
                                      statusFilter === "pending"
                                        ? "bg-rose-50/50 border-x border-rose-200/60"
                                        : ""
                                    }`}
                                  >
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                        ys.pending > 0
                                          ? statusFilter === "pending"
                                            ? "bg-rose-600 text-white shadow-xs"
                                            : "bg-rose-100 text-rose-800"
                                          : "bg-slate-100 text-slate-400"
                                      }`}
                                    >
                                      {ys.pending}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 min-w-[130px]">
                                    <div className="flex items-center gap-2">
                                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 flex">
                                        <div
                                          className="bg-emerald-500"
                                          style={{ width: `${ysPubPct}%` }}
                                        />
                                        <div
                                          className="bg-amber-400"
                                          style={{ width: `${ysDraftPct}%` }}
                                        />
                                      </div>
                                      <span className="text-[10px] font-bold text-slate-500 shrink-0">
                                        {ysPubPct}%
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-right">
                                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                                      <span className="text-[11px] font-medium text-slate-500">
                                        {ys.matchingClasses.length} {ys.matchingClasses.length === 1 ? "class" : "classes"}
                                      </span>
                                      <span
                                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full transition-transform duration-200 ${
                                          isExpanded ? "rotate-180 bg-navy-100 text-navy-900" : "bg-slate-100 text-slate-500"
                                        }`}
                                      >
                                        <ChevronDown className="h-3.5 w-3.5" />
                                      </span>
                                    </div>
                                  </td>
                                </tr>

                                {/* Expanded Class Rows */}
                                {isExpanded && (
                                  <tr>
                                    <td colSpan={7} className="bg-slate-50/90 p-3.5 border-b border-slate-200">
                                      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-xs">
                                        <div className="bg-slate-100/80 px-3 py-2 text-xs font-bold text-slate-700 flex flex-wrap items-center justify-between gap-2">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span>
                                              Classes for {col.collegeCode || col.collegeName} • {ys.label}
                                            </span>
                                            {statusFilter !== "all" && (
                                              <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full text-[10px] bg-white border border-slate-300 text-slate-700">
                                                Filtered by{" "}
                                                <strong className="capitalize text-navy-900">
                                                  {statusFilter === "pending" ? "Needed to Configure" : statusFilter}
                                                </strong>{" "}
                                                ({ys.matchingClasses.length} of {ys.total})
                                              </span>
                                            )}
                                          </div>
                                          <span className="text-slate-500 font-normal">
                                            Click any class below to configure or open its timetable
                                          </span>
                                        </div>
                                        <div className="overflow-x-auto">
                                          <table className="w-full min-w-[860px] table-fixed border-collapse text-xs">
                                            <thead>
                                              <tr className="border-b border-slate-200 bg-slate-100/80 font-semibold text-slate-700">
                                                <th className="py-2.5 px-3 w-[26%] text-left">Course &amp; Branch</th>
                                                <th className="py-2.5 px-3 w-[11%] text-center">Section</th>
                                                <th className="py-2.5 px-3 w-[11%] text-center">Batch</th>
                                                <th className="py-2.5 px-3 w-[14%] text-center">Enrolled Students</th>
                                                <th className="py-2.5 px-3 w-[20%] text-left">Class Teacher</th>
                                                <th className="py-2.5 px-3 w-[12%] text-center">Timetable Status</th>
                                                <th className="py-2.5 px-3 w-[16%] text-right">Action</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 bg-white">
                                              {ys.matchingClasses.length === 0 ? (
                                                <tr>
                                                  <td
                                                    colSpan={7}
                                                    className="py-4 text-center text-slate-400 italic"
                                                  >
                                                    No classes match the current filter.
                                                  </td>
                                                </tr>
                                              ) : (
                                                ys.matchingClasses.map((cls, idx) => (
                                                  <tr key={idx} className="hover:bg-slate-50/80 transition">
                                                    <td className="py-2.5 px-3">
                                                      <div className="flex items-center gap-2 min-w-0">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200/80 shrink-0">
                                                          {cls.courseName}
                                                        </span>
                                                        <span className="font-bold text-navy-900 text-xs truncate" title={cls.branchName}>
                                                          {cls.branchName}
                                                        </span>
                                                      </div>
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center">
                                                      <div className="inline-flex flex-col items-center gap-0.5">
                                                        <span className="inline-flex h-6 px-2.5 items-center justify-center rounded bg-indigo-50 border border-indigo-200/80 text-[11px] font-bold text-indigo-900 shadow-2xs">
                                                          Sec {cls.section || "A"}
                                                        </span>
                                                        {cls.studentCount <= 0 ? (
                                                          <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-rose-600">
                                                            <AlertCircle className="h-2.5 w-2.5" /> No students
                                                          </span>
                                                        ) : cls.classTeacher && cls.status === "published" ? (
                                                          <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-emerald-600">
                                                            <CheckCircle2 className="h-2.5 w-2.5" /> Ready
                                                          </span>
                                                        ) : !cls.classTeacher && cls.status === "pending" ? (
                                                          <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600">
                                                            <AlertCircle className="h-2.5 w-2.5" /> Incomplete
                                                          </span>
                                                        ) : null}
                                                      </div>
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center">
                                                      <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700 font-medium">
                                                        Batch {cls.batch}
                                                      </span>
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center">
                                                      <span
                                                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                                                          cls.studentCount > 0
                                                            ? "bg-slate-100 text-slate-700"
                                                            : "bg-rose-50 text-rose-700 border border-rose-200"
                                                        }`}
                                                      >
                                                        <Users className="h-3 w-3 text-slate-500" />
                                                        {cls.studentCount} {cls.studentCount === 1 ? "student" : "students"}
                                                      </span>
                                                    </td>
                                                    <td className="py-2.5 px-3">
                                                      {cls.classTeacher ? (
                                                        <div className="flex items-center justify-between gap-1.5 min-w-0">
                                                          <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-1 font-semibold text-slate-900 truncate">
                                                              <UserCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                                              <span className="truncate" title={cls.classTeacher.facultyName}>
                                                                {cls.classTeacher.facultyName}
                                                              </span>
                                                            </div>
                                                            <div className="text-[10px] text-slate-500 font-normal truncate">
                                                              {cls.classTeacher.hrmsEmployeeId}
                                                              {cls.classTeacher.departmentName ? ` • ${cls.classTeacher.departmentName}` : ""}
                                                            </div>
                                                          </div>
                                                          <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              setAssignSection({
                                                                collegeId: col.collegeId,
                                                                collegeName: col.collegeName,
                                                                courseId: cls.courseId,
                                                                courseName: cls.courseName,
                                                                branchId: cls.branchId,
                                                                branchName: cls.branchName,
                                                                batch: cls.batch,
                                                                year: cls.year,
                                                                semester: cls.semester,
                                                                sectionName: cls.section || "A",
                                                                studentCount: cls.studentCount,
                                                                academicYearLabel: data?.academicYear,
                                                                currentTeacher: cls.classTeacher,
                                                              });
                                                              setAssignModalOpen(true);
                                                            }}
                                                            className="h-6 px-1.5 text-[11px] font-semibold text-navy-700 hover:text-navy-900 hover:bg-slate-100 shrink-0 cursor-pointer"
                                                            title="Change class teacher"
                                                          >
                                                            Change
                                                          </Button>
                                                        </div>
                                                      ) : (
                                                        <div className="flex items-center gap-2">
                                                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200/80 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 shrink-0">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                                            Not Assigned
                                                          </span>
                                                          <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="secondary"
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              setAssignSection({
                                                                collegeId: col.collegeId,
                                                                collegeName: col.collegeName,
                                                                courseId: cls.courseId,
                                                                courseName: cls.courseName,
                                                                branchId: cls.branchId,
                                                                branchName: cls.branchName,
                                                                batch: cls.batch,
                                                                year: cls.year,
                                                                semester: cls.semester,
                                                                sectionName: cls.section || "A",
                                                                studentCount: cls.studentCount,
                                                                academicYearLabel: data?.academicYear,
                                                                currentTeacher: null,
                                                              });
                                                              setAssignModalOpen(true);
                                                            }}
                                                            className="h-6 px-2 text-[11px] font-semibold text-navy-800 hover:bg-navy-50 border-slate-300 shadow-2xs shrink-0 cursor-pointer"
                                                            title="Assign class teacher"
                                                          >
                                                            <UserPlus className="h-3 w-3 mr-1 text-navy-600" />
                                                            Assign
                                                          </Button>
                                                        </div>
                                                      )}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center">
                                                      {cls.status === "published" ? (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                                                          <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Published
                                                        </span>
                                                      ) : cls.status === "drafted" ? (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                                                          <Clock className="h-3 w-3 text-amber-600" /> Drafted
                                                        </span>
                                                      ) : (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-800">
                                                          <AlertCircle className="h-3 w-3 text-rose-600" /> Needs Config
                                                        </span>
                                                      )}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right">
                                                      {onSelectClass ? (
                                                        <Button
                                                          size="sm"
                                                          variant="secondary"
                                                          onClick={() =>
                                                            onSelectClass({
                                                              collegeId: col.collegeId,
                                                              courseId: cls.courseId,
                                                              branchId: cls.branchId,
                                                              batch: cls.batch,
                                                              year: cls.year,
                                                              semester: cls.semester,
                                                              section: cls.section,
                                                            })
                                                          }
                                                          className={`text-xs h-7.5 px-3 font-semibold cursor-pointer shadow-2xs transition-all ${
                                                            cls.status === "published"
                                                              ? "bg-emerald-50/70 border-emerald-300 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-400"
                                                              : cls.status === "drafted"
                                                              ? "bg-amber-50/70 border-amber-300 text-amber-900 hover:bg-amber-100 hover:border-amber-400"
                                                              : "bg-indigo-50/70 border-indigo-300 text-indigo-900 hover:bg-indigo-100 hover:border-indigo-400"
                                                          }`}
                                                        >
                                                          {cls.status === "published" ? (
                                                            <>
                                                              Open Timetable <ArrowRight className="ml-1 h-3.5 w-3.5 text-emerald-600" />
                                                            </>
                                                          ) : cls.status === "drafted" ? (
                                                            <>
                                                              Edit Draft <ArrowRight className="ml-1 h-3.5 w-3.5 text-amber-600" />
                                                            </>
                                                          ) : (
                                                            <>
                                                              <PlusCircle className="mr-1 h-3.5 w-3.5 text-indigo-600" /> Configure Timetable
                                                            </>
                                                          )}
                                                        </Button>
                                                      ) : null}
                                                    </td>
                                                  </tr>
                                                ))
                                              )}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {assignModalOpen && (
        <AssignClassTeacherModal
          open={assignModalOpen}
          onClose={() => {
            setAssignModalOpen(false);
            setAssignSection(null);
          }}
          sectionInfo={assignSection}
          onAssigned={() => {
            void loadOverview();
          }}
        />
      )}
    </div>
  );
}
