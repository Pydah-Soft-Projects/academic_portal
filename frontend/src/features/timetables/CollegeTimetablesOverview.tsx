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
} from "lucide-react";

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
  onSelectClass,
  onSelectCollege,
}: Props) {
  const [data, setData] = useState<TimetableOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "drafted" | "pending">("all");
  const [expandedYearSems, setExpandedYearSems] = useState<Set<string>>(new Set());

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
  }, [academicYear, selectedCollegeId]);

  const toggleYearSemExpand = (collegeId: number, year: number, sem: number) => {
    const key = `${collegeId}-${year}-${sem}`;
    setExpandedYearSems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const sanitizedColleges = useMemo(() => {
    if (!data?.colleges) return [];
    return data.colleges
      .map((col) => {
        const validYearSems = col.yearSemBreakdown
          .map((ys) => {
            const validClasses = ys.classes.filter(
              (c) => (c.studentCount ?? 0) > 0
            );
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
  }, [data]);

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
    let list = sanitizedColleges;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (col) =>
          col.collegeName.toLowerCase().includes(q) ||
          col.collegeCode.toLowerCase().includes(q) ||
          col.yearSemBreakdown.some((ys) =>
            ys.classes.some(
              (c) =>
                c.courseName.toLowerCase().includes(q) ||
                c.branchName.toLowerCase().includes(q) ||
                c.batch.toLowerCase().includes(q)
            )
          )
      );
    }

    if (statusFilter === "published") {
      list = list.filter((col) => col.publishedCount > 0);
    } else if (statusFilter === "drafted") {
      list = list.filter((col) => col.draftedCount > 0);
    } else if (statusFilter === "pending") {
      list = list.filter((col) => col.pendingCount > 0);
    }

    return list;
  }, [sanitizedColleges, searchQuery, statusFilter]);

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
        {/* 4 Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Total Colleges & Classes */}
          <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium uppercase tracking-wider">Total Timetables</span>
              <Layers className="h-4 w-4 text-navy-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-navy-900">{summary.totalClasses}</span>
              <span className="text-xs text-slate-500">classes across {summary.totalColleges} colleges</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
              <Building2 className="h-3 w-3 text-slate-400" />
              <span>{summary.totalColleges} active colleges</span>
            </div>
          </div>

          {/* Card 2: Published */}
          <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/40 p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-emerald-700">
              <span className="text-xs font-medium uppercase tracking-wider">Published</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-emerald-900">{summary.totalPublished}</span>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded">
                {publishedPct}%
              </span>
            </div>
            <div className="mt-2 text-[11px] text-emerald-800">
              Active live timetables in system
            </div>
          </div>

          {/* Card 3: Drafted */}
          <div className="rounded-lg border border-amber-200/80 bg-amber-50/40 p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-amber-700">
              <span className="text-xs font-medium uppercase tracking-wider">Drafted / Review</span>
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-amber-900">{summary.totalDrafted}</span>
              <span className="text-xs font-semibold text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded">
                {draftedPct}%
              </span>
            </div>
            <div className="mt-2 text-[11px] text-amber-800">
              In progress / waiting to publish
            </div>
          </div>

          {/* Card 4: Needs Configuration */}
          <div className="rounded-lg border border-rose-200/80 bg-rose-50/30 p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-rose-700">
              <span className="text-xs font-medium uppercase tracking-wider">Needed to Configure</span>
              <AlertCircle className="h-4 w-4 text-rose-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-rose-900">{summary.totalPending}</span>
              <span className="text-xs font-medium text-rose-700">pending</span>
            </div>
            <div className="mt-2 text-[11px] text-rose-800">
              Timetable not yet created
            </div>
          </div>
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
            onClick={() => setStatusFilter("all")}
            className={`rounded-md px-2.5 py-1 font-medium transition ${
              statusFilter === "all"
                ? "bg-white text-navy-900 shadow-xs"
                : "text-slate-600 hover:text-navy-900"
            }`}
          >
            All Colleges ({data.colleges.length})
          </button>
          <button
            onClick={() => setStatusFilter("published")}
            className={`rounded-md px-2.5 py-1 font-medium transition ${
              statusFilter === "published"
                ? "bg-white text-emerald-800 shadow-xs"
                : "text-slate-600 hover:text-emerald-700"
            }`}
          >
            With Published
          </button>
          <button
            onClick={() => setStatusFilter("drafted")}
            className={`rounded-md px-2.5 py-1 font-medium transition ${
              statusFilter === "drafted"
                ? "bg-white text-amber-800 shadow-xs"
                : "text-slate-600 hover:text-amber-700"
            }`}
          >
            With Drafts
          </button>
          <button
            onClick={() => setStatusFilter("pending")}
            className={`rounded-md px-2.5 py-1 font-medium transition ${
              statusFilter === "pending"
                ? "bg-white text-rose-800 shadow-xs"
                : "text-slate-600 hover:text-rose-700"
            }`}
          >
            Needs Config
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

      {/* Colleges List */}
      {filteredColleges.length === 0 ? (
        <Card className="p-8 text-center text-slate-500">
          <p className="text-sm font-medium">No colleges match the current search or filter.</p>
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
                          {col.totalClasses} total target classes across {col.yearSemBreakdown.length} year & semester streams
                        </p>
                      </div>
                    </div>

                    {/* Stats Badges & College Action */}
                    <div className="flex flex-wrap items-center gap-2 md:gap-3">
                      <div className="flex items-center gap-1.5 rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        <span>Published: {col.publishedCount}</span>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-800">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        <span>Drafted: {col.draftedCount}</span>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-md bg-rose-50 border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-800">
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
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-navy-700" />
                    <span>Year & Semester Breakdown ({col.yearSemBreakdown.length} Configurations)</span>
                  </div>

                  {col.yearSemBreakdown.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No classes or semesters found for this college.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full min-w-[700px] border-collapse text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-100/70 font-semibold text-slate-700">
                            <th className="py-2.5 px-3">Year & Semester</th>
                            <th className="py-2.5 px-3 text-center">Total Classes</th>
                            <th className="py-2.5 px-3 text-center">Published</th>
                            <th className="py-2.5 px-3 text-center">Drafted</th>
                            <th className="py-2.5 px-3 text-center">Needed to Configure</th>
                            <th className="py-2.5 px-3">Status Progress</th>
                            <th className="py-2.5 px-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-800">
                          {col.yearSemBreakdown.map((ys) => {
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
                                <tr className="hover:bg-slate-50/80 transition">
                                  <td className="py-2.5 px-3 font-bold text-navy-900 flex items-center gap-2">
                                    <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-navy-50 text-[11px] font-bold text-navy-800 border border-navy-200/50">
                                      {ys.year}-{ys.semester}
                                    </span>
                                    <span>{ys.label}</span>
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-semibold">
                                    {ys.total}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                        ys.published > 0
                                          ? "bg-emerald-100 text-emerald-800"
                                          : "bg-slate-100 text-slate-400"
                                      }`}
                                    >
                                      {ys.published}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                        ys.drafted > 0
                                          ? "bg-amber-100 text-amber-800"
                                          : "bg-slate-100 text-slate-400"
                                      }`}
                                    >
                                      {ys.drafted}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                        ys.pending > 0
                                          ? "bg-rose-100 text-rose-800"
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
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() =>
                                        toggleYearSemExpand(col.collegeId, ys.year, ys.semester)
                                      }
                                      className="text-xs h-7 px-2.5 font-medium"
                                    >
                                      {isExpanded ? (
                                        <>
                                          Hide ({ys.classes.length}){" "}
                                          <ChevronUp className="ml-1 h-3.5 w-3.5" />
                                        </>
                                      ) : (
                                        <>
                                          View Classes ({ys.classes.length}){" "}
                                          <ChevronDown className="ml-1 h-3.5 w-3.5" />
                                        </>
                                      )}
                                    </Button>
                                  </td>
                                </tr>

                                {/* Expanded Class Rows */}
                                {isExpanded && (
                                  <tr>
                                    <td colSpan={7} className="bg-slate-50/90 p-3.5 border-b border-slate-200">
                                      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-xs">
                                        <div className="bg-slate-100/80 px-3 py-2 text-xs font-bold text-slate-700 flex items-center justify-between">
                                          <span>
                                            Classes for {col.collegeCode || col.collegeName} • {ys.label}
                                          </span>
                                          <span className="text-slate-500 font-normal">
                                            Click any class below to configure or open its timetable
                                          </span>
                                        </div>
                                        <div className="overflow-x-auto">
                                          <table className="w-full min-w-[760px] border-collapse text-xs">
                                            <thead>
                                              <tr className="border-b border-slate-200 bg-slate-50/90 font-semibold text-slate-700">
                                                <th className="py-2.5 px-3 w-20 text-center">Section</th>
                                                <th className="py-2.5 px-3">Course &amp; Branch</th>
                                                <th className="py-2.5 px-3 w-28">Batch</th>
                                                <th className="py-2.5 px-3 w-36 text-center">Enrolled Students</th>
                                                <th className="py-2.5 px-3 w-36">Timetable Plan</th>
                                                <th className="py-2.5 px-3 w-32 text-center">Status</th>
                                                <th className="py-2.5 px-3 w-40 text-right">Action</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 bg-white">
                                              {ys.classes.map((cls, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/80 transition">
                                                  <td className="py-2.5 px-3 text-center">
                                                    <span className="inline-flex h-6.5 w-6.5 items-center justify-center rounded bg-indigo-50 border border-indigo-200/70 text-[11px] font-bold text-indigo-900 shadow-2xs">
                                                      {cls.section || "A"}
                                                    </span>
                                                  </td>
                                                  <td className="py-2.5 px-3">
                                                    <span className="font-bold text-navy-900">
                                                      {cls.courseName} - {cls.branchName}
                                                    </span>
                                                  </td>
                                                  <td className="py-2.5 px-3 text-slate-600 font-medium">
                                                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700 font-medium">
                                                      Batch {cls.batch}
                                                    </span>
                                                  </td>
                                                  <td className="py-2.5 px-3 text-center">
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700">
                                                      <Users className="h-3 w-3 text-slate-500" />
                                                      {cls.studentCount} students
                                                    </span>
                                                  </td>
                                                  <td className="py-2.5 px-3 text-slate-600">
                                                    {cls.planId ? (
                                                      <span className="font-mono text-[11px] text-slate-700 font-medium">
                                                        Plan #{cls.planId} {cls.versionNo ? `(v${cls.versionNo})` : ""}
                                                      </span>
                                                    ) : (
                                                      <span className="text-slate-400 italic text-[11px]">Not created</span>
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
                                                        variant={cls.status === "pending" ? "primary" : "secondary"}
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
                                                        className={`text-xs h-7.5 px-3 font-semibold ${
                                                          cls.status === "pending"
                                                            ? "bg-navy-900 text-white hover:bg-navy-800"
                                                            : ""
                                                        }`}
                                                      >
                                                        {cls.status === "published" ? (
                                                          <>
                                                            Open Timetable <ArrowRight className="ml-1 h-3.5 w-3.5" />
                                                          </>
                                                        ) : cls.status === "drafted" ? (
                                                          <>
                                                            Edit Draft <ArrowRight className="ml-1 h-3.5 w-3.5" />
                                                          </>
                                                        ) : (
                                                          <>
                                                            <PlusCircle className="mr-1 h-3.5 w-3.5" /> Configure Timetable
                                                          </>
                                                        )}
                                                      </Button>
                                                    ) : null}
                                                  </td>
                                                </tr>
                                              ))}
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
    </div>
  );
}
