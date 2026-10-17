"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { StatCardSkeleton } from "@/components/ui/CardSkeleton";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { AcademicFilterBar } from "@/components/layout/AcademicFilterBar";
import { useAcademicContext } from "@/components/layout/AcademicProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { apiFetch } from "@/lib/api";
import {
  AssignClassTeacherModal,
  type TargetSectionScope,
} from "./AssignClassTeacherModal";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  Search,
  UserCheck,
  UserX,
  Users,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Sparkles,
  LayoutGrid,
  List,
} from "lucide-react";

export type SectionOverviewRow = {
  collegeId: number;
  collegeName: string;
  collegeCode: string;
  courseId: number;
  courseName: string;
  branchId: number;
  branchName: string;
  batch: string;
  year: number;
  semester: number;
  sectionName: string;
  studentCount: number;
  timetable: {
    status: "published" | "draft" | "pending";
    planId: number | null;
    versionNo: number | null;
    updatedAt: string | null;
  };
  classTeacher: {
    facultyStaffLinkId: number;
    facultyName: string;
    hrmsEmployeeId: string;
    departmentName: string | null;
    designation: string | null;
    assignedStudentsCount: number;
  } | null;
};

export type OverviewSummary = {
  totalColleges: number;
  totalSections: number;
  timetablesPublished: number;
  timetablesDraft: number;
  timetablesConfigured: number;
  timetablesPending: number;
  teachersAssigned: number;
  teachersPending: number;
};

export type CollegeBreakdown = {
  collegeId: number;
  collegeName: string;
  collegeCode: string;
  totalSections: number;
  publishedCount: number;
  draftCount: number;
  pendingCount: number;
  teachersAssignedCount: number;
};

type FilterStatusTab =
  | "all"
  | "assigned"
  | "unassigned"
  | "timetable_configured"
  | "timetable_pending";

export function ClassTeacherAssignmentView() {
  const router = useRouter();
  const { filters, setFilters } = useAcademicContext();
  const { hasAnyPermission } = useAuth();
  const canView = hasAnyPermission(
    "timetable.view",
    "mentoring.view",
    "dashboard.view",
    "students.view"
  );
  const canEdit = hasAnyPermission(
    "timetable.edit",
    "mentoring.assign",
    "mentoring.manage"
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [summary, setSummary] = useState<OverviewSummary | null>(null);
  const [sections, setSections] = useState<SectionOverviewRow[]>([]);
  const [colleges, setColleges] = useState<CollegeBreakdown[]>([]);

  const [statusTab, setStatusTab] = useState<FilterStatusTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "colleges">("table");

  // Assign modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<TargetSectionScope | null>(null);

  const loadData = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.academicYear && filters.academicYear !== "all") {
        params.set("academicYear", filters.academicYear);
      }
      if (filters.collegeId && filters.collegeId !== "all") {
        params.set("collegeId", String(filters.collegeId));
      }
      if (filters.courseId && filters.courseId !== "all") {
        params.set("courseId", String(filters.courseId));
      }
      if (filters.branchId && filters.branchId !== "all") {
        params.set("branchId", String(filters.branchId));
      }
      if (filters.batch && filters.batch !== "all") {
        params.set("batch", String(filters.batch));
      }
      if (filters.year && filters.year !== "all") {
        params.set("year", String(filters.year));
      }
      if (filters.semester && filters.semester !== "all") {
        params.set("semester", String(filters.semester));
      }
      if (filters.section && filters.section !== "all") {
        params.set("section", String(filters.section));
      }

      const res = await apiFetch(`/class-teacher/assignments?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load class teacher overview (${res.status})`);
      }
      const json = await res.json();
      const payload = json.data;

      setSummary(payload.summary ?? null);
      setSections(payload.sections ?? []);
      setColleges(payload.colleges ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load class teacher overview");
    } finally {
      setLoading(false);
    }
  }, [canView, filters]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Filter sections by search and statusTab
  const filteredSections = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return sections.filter((s) => {
      // 1. Status tab filter
      if (statusTab === "assigned" && !s.classTeacher) return false;
      if (statusTab === "unassigned" && s.classTeacher) return false;
      if (
        statusTab === "timetable_configured" &&
        s.timetable.status === "pending"
      ) {
        return false;
      }
      if (
        statusTab === "timetable_pending" &&
        s.timetable.status !== "pending"
      ) {
        return false;
      }

      // 2. Search query filter
      if (q) {
        const matchesCollege =
          s.collegeName.toLowerCase().includes(q) ||
          s.collegeCode.toLowerCase().includes(q);
        const matchesBranch =
          s.branchName.toLowerCase().includes(q) ||
          s.courseName.toLowerCase().includes(q);
        const matchesBatch = s.batch.toLowerCase().includes(q);
        const matchesSection = s.sectionName.toLowerCase().includes(q);
        const matchesTeacher =
          s.classTeacher &&
          (s.classTeacher.facultyName.toLowerCase().includes(q) ||
            s.classTeacher.hrmsEmployeeId.toLowerCase().includes(q) ||
            (s.classTeacher.departmentName &&
              s.classTeacher.departmentName.toLowerCase().includes(q)));

        if (
          !matchesCollege &&
          !matchesBranch &&
          !matchesBatch &&
          !matchesSection &&
          !matchesTeacher
        ) {
          return false;
        }
      }

      return true;
    });
  }, [sections, searchQuery, statusTab]);

  const handleOpenAssignModal = (section: SectionOverviewRow) => {
    setActiveSection({
      collegeId: section.collegeId,
      collegeName: section.collegeName,
      courseId: section.courseId,
      courseName: section.courseName,
      branchId: section.branchId,
      branchName: section.branchName,
      batch: section.batch,
      year: section.year,
      semester: section.semester,
      sectionName: section.sectionName,
      studentCount: section.studentCount,
      academicYearLabel: filters.academicYear,
      currentTeacher: section.classTeacher,
    });
    setAssignModalOpen(true);
  };

  const handleUnassign = async (section: SectionOverviewRow) => {
    if (!confirm(`Are you sure you want to remove the class teacher for Section ${section.sectionName}?`)) {
      return;
    }

    try {
      const res = await apiFetch("/class-teacher/unassign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collegeId: section.collegeId,
          branchId: section.branchId,
          batch: section.batch,
          year: section.year,
          semester: section.semester,
          sectionName: section.sectionName,
          academicYearLabel: filters.academicYear,
        }),
      });

      if (!res.ok) throw new Error("Failed to unassign class teacher");

      setSuccessMsg(`Unassigned class teacher for ${section.branchName} Section ${section.sectionName}.`);
      void loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unassign class teacher");
    }
  };

  const navigateToTimetable = (section: SectionOverviewRow) => {
    setFilters({
      collegeId: section.collegeId,
      courseId: section.courseId,
      branchId: section.branchId,
      batch: section.batch,
      year: section.year,
      semester: section.semester,
      section: section.sectionName,
    });
    router.push("/timetables");
  };

  if (!canView) {
    return (
      <EmptyState
        title="Class Teacher Assignment Unavailable"
        description="You do not have permission to view class teacher assignments and timetable rosters."
      />
    );
  }

  const assignedPct = summary?.totalSections
    ? Math.round((summary.teachersAssigned / summary.totalSections) * 100)
    : 0;

  const timetablePct = summary?.totalSections
    ? Math.round((summary.timetablesConfigured / summary.totalSections) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <PageHeader
            title="Class Teacher Assignment"
            description="Manage section-level class teacher assignments and monitor configured master timetables across colleges."
          />
        </div>
        <div className="flex items-center gap-2">
          <Link href="/timetables">
            <Button variant="secondary" size="sm">
              <CalendarDays className="mr-1.5 h-4 w-4" />
              Master Timetables
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void loadData()}
            disabled={loading}
          >
            <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
        <AcademicFilterBar title="Academic Scope Filters" />
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
          <Button size="sm" variant="secondary" onClick={() => void loadData()}>
            Try Again
          </Button>
        </div>
      ) : null}

      {successMsg ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold"
          >
            ✕
          </button>
        </div>
      ) : null}

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {loading && !summary ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setStatusTab("all")}
              className="text-left cursor-pointer transition-transform hover:-translate-y-0.5"
            >
              <StatCard
                label="Total Classes / Sections"
                value={summary?.totalSections ?? 0}
                tone="default"
              />
            </button>
            <button
              type="button"
              onClick={() => setStatusTab("timetable_configured")}
              className="text-left cursor-pointer transition-transform hover:-translate-y-0.5"
            >
              <StatCard
                label="Timetables Configured"
                value={`${summary?.timetablesConfigured ?? 0} (${timetablePct}%)`}
                tone={timetablePct >= 80 ? "success" : "warning"}
              />
            </button>
            <button
              type="button"
              onClick={() => setStatusTab("assigned")}
              className="text-left cursor-pointer transition-transform hover:-translate-y-0.5"
            >
              <StatCard
                label="Class Teachers Assigned"
                value={`${summary?.teachersAssigned ?? 0} (${assignedPct}%)`}
                tone={assignedPct >= 80 ? "success" : "warning"}
              />
            </button>
            <button
              type="button"
              onClick={() => setStatusTab("unassigned")}
              className="text-left cursor-pointer transition-transform hover:-translate-y-0.5"
            >
              <StatCard
                label="Teachers Pending"
                value={summary?.teachersPending ?? 0}
                tone={summary?.teachersPending === 0 ? "success" : "critical"}
              />
            </button>
          </>
        )}
      </div>

      {/* Interactive Tabs and Controls */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs font-medium">
            <button
              type="button"
              onClick={() => setStatusTab("all")}
              className={`px-3 py-1.5 rounded-md transition-all ${
                statusTab === "all"
                  ? "bg-white text-navy-900 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-navy-900"
              }`}
            >
              All Sections ({sections.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusTab("assigned")}
              className={`px-3 py-1.5 rounded-md transition-all ${
                statusTab === "assigned"
                  ? "bg-white text-emerald-800 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-navy-900"
              }`}
            >
              Teacher Assigned ({summary?.teachersAssigned ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setStatusTab("unassigned")}
              className={`px-3 py-1.5 rounded-md transition-all ${
                statusTab === "unassigned"
                  ? "bg-white text-amber-800 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-navy-900"
              }`}
            >
              Teacher Missing ({summary?.teachersPending ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setStatusTab("timetable_configured")}
              className={`px-3 py-1.5 rounded-md transition-all ${
                statusTab === "timetable_configured"
                  ? "bg-white text-navy-900 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-navy-900"
              }`}
            >
              Timetable Ready ({summary?.timetablesConfigured ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setStatusTab("timetable_pending")}
              className={`px-3 py-1.5 rounded-md transition-all ${
                statusTab === "timetable_pending"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-navy-900"
              }`}
            >
              Timetable Pending ({summary?.timetablesPending ?? 0})
            </button>
          </div>

          {/* Right Tools: View Mode Toggle & Search */}
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-border rounded-lg p-0.5 bg-slate-50">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1 ${
                  viewMode === "table"
                    ? "bg-white text-navy-900 shadow-xs"
                    : "text-slate-500 hover:text-navy-900"
                }`}
                title="Sections Table"
              >
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">Table</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("colleges")}
                className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1 ${
                  viewMode === "colleges"
                    ? "bg-white text-navy-900 shadow-xs"
                    : "text-slate-500 hover:text-navy-900"
                }`}
                title="College Breakdown"
              >
                <Building2 className="h-4 w-4" />
                <span className="hidden sm:inline">Colleges</span>
              </button>
            </div>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by college, branch, section, teacher name, emp code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-border bg-white focus:border-brand-600 focus:ring-1 focus:ring-brand-600 outline-none"
          />
        </div>
      </div>

      {/* College Breakdown Cards (if viewMode === 'colleges') */}
      {viewMode === "colleges" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {colleges.map((col) => {
            const teacherPct = col.totalSections
              ? Math.round((col.teachersAssignedCount / col.totalSections) * 100)
              : 0;
            const ttPct = col.totalSections
              ? Math.round(((col.publishedCount + col.draftCount) / col.totalSections) * 100)
              : 0;

            return (
              <Card key={col.collegeId} className="p-5 space-y-4 hover:shadow-md transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-50 text-navy-800 font-bold text-sm border border-navy-100">
                      {col.collegeCode || "COL"}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-navy-900 leading-tight">
                        {col.collegeName}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {col.totalSections} sections in roster
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-100 text-xs">
                  {/* Progress: Class Teachers */}
                  <div>
                    <div className="flex justify-between text-slate-600 mb-1">
                      <span className="font-medium">Class Teachers Assigned</span>
                      <span className="font-bold text-navy-900">
                        {col.teachersAssignedCount} / {col.totalSections} ({teacherPct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${teacherPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Progress: Timetables */}
                  <div>
                    <div className="flex justify-between text-slate-600 mb-1">
                      <span className="font-medium">Configured Timetables</span>
                      <span className="font-bold text-navy-900">
                        {col.publishedCount + col.draftCount} / {col.totalSections} ({ttPct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full transition-all"
                        style={{ width: `${ttPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-[11px] text-slate-400">
                    {col.publishedCount} Published • {col.draftCount} Draft
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setFilters({ collegeId: col.collegeId });
                      setViewMode("table");
                    }}
                  >
                    View Sections <ChevronRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : null}

      {/* Sections Table View */}
      {viewMode === "table" ? (
        loading ? (
          <TableSkeleton columns={6} rows={8} showHeader />
        ) : filteredSections.length === 0 ? (
          <EmptyState
            title="No sections match current filters"
            description="Adjust your academic scope filters or search query to view sections."
          />
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/80 border-b border-border text-slate-600 uppercase tracking-wider font-semibold text-[11px]">
                  <tr>
                    <th className="py-3 px-4">College & Campus</th>
                    <th className="py-3 px-4">Class & Section</th>
                    <th className="py-3 px-3 text-center">Enrolled</th>
                    <th className="py-3 px-4">Master Timetable</th>
                    <th className="py-3 px-4">Class Teacher</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredSections.map((row) => {
                    const isPublished = row.timetable.status === "published";
                    const isDraft = row.timetable.status === "draft";
                    const hasTeacher = row.classTeacher !== null;

                    return (
                      <tr
                        key={`${row.collegeId}-${row.branchId}-${row.batch}-${row.semester}-${row.sectionName}`}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        {/* College */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-navy-900">
                            {row.collegeCode || "COL"}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                            {row.collegeName}
                          </div>
                        </td>

                        {/* Class & Section */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 font-bold text-navy-900 text-sm">
                            <span>{row.branchName}</span>
                            <span className="px-1.5 py-0.5 rounded bg-navy-100 text-navy-800 font-extrabold text-xs">
                              Sec {row.sectionName}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {row.courseName} • Year {row.year} • Sem {row.semester} • {row.batch}
                          </div>
                        </td>

                        {/* Students count */}
                        <td className="py-3 px-3 text-center">
                          <div className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full">
                            <Users className="h-3 w-3 text-slate-500" />
                            <span>{row.studentCount}</span>
                          </div>
                        </td>

                        {/* Master Timetable status */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {isPublished ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                Published {row.timetable.versionNo ? `v${row.timetable.versionNo}` : ""}
                              </span>
                            ) : isDraft ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                                Draft #{row.timetable.planId}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                Not Configured
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => navigateToTimetable(row)}
                              className="text-brand-600 hover:text-brand-800 p-1 rounded hover:bg-brand-50 transition-colors"
                              title="Open in Master Timetable Planner"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>

                        {/* Class Teacher */}
                        <td className="py-3 px-4">
                          {hasTeacher ? (
                            <div className="flex items-center gap-2.5">
                              <div className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                                {row.classTeacher?.facultyName.slice(0, 2)}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-navy-900 truncate">
                                  {row.classTeacher?.facultyName}
                                </div>
                                <div className="text-[11px] text-slate-500 truncate">
                                  Emp #{row.classTeacher?.hrmsEmployeeId}
                                  {row.classTeacher?.departmentName
                                    ? ` • ${row.classTeacher.departmentName}`
                                    : ""}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                              <UserX className="h-3.5 w-3.5 text-amber-600" />
                              <span>Not Assigned</span>
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {hasTeacher ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleOpenAssignModal(row)}
                                >
                                  Change
                                </Button>
                                {canEdit ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleUnassign(row)}
                                    className="text-rose-600 hover:text-rose-800 hover:bg-rose-50"
                                  >
                                    Remove
                                  </Button>
                                ) : null}
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => handleOpenAssignModal(row)}
                              >
                                Assign Teacher
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => navigateToTimetable(row)}
                              title="Open Master Timetable Planner"
                            >
                              Timetable
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-50/70 border-t border-border flex items-center justify-between text-xs text-slate-500">
              <span>
                Showing <strong>{filteredSections.length}</strong> of{" "}
                <strong>{sections.length}</strong> total sections
              </span>
              <span>
                {summary?.teachersAssigned ?? 0} assigned •{" "}
                {summary?.teachersPending ?? 0} pending
              </span>
            </div>
          </div>
        )
      ) : null}

      {/* Reusable Assign Modal */}
      <AssignClassTeacherModal
        open={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        sectionInfo={activeSection}
        onAssigned={(teacher) => {
          setSuccessMsg(
            `Assigned ${teacher.facultyName} as Class Teacher for ${activeSection?.branchName} Sec ${activeSection?.sectionName}.`
          );
          void loadData();
        }}
      />
    </div>
  );
}
