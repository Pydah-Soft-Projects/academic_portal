"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  CalendarOff,
  CheckCircle2,
  RefreshCw,
  Search,
  X,
  Layers,
  Save,
  RotateCcw,
  Check,
  Ban,
  Calendar,
  AlertTriangle,
  GraduationCap,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/cn";

type CourseBranch = {
  id: number;
  name: string;
  code: string | null;
};

type CourseExclusionItem = {
  id: number;
  name: string;
  code: string | null;
  collegeId: number;
  collegeName: string;
  collegeCode: string | null;
  totalYears: number | null;
  branchCount: number;
  branches: CourseBranch[];
  isExcluded: boolean;
  reason: string | null;
  updatedAt: string | null;
  hasActiveTimetable?: boolean;
  publishedTimetableCount?: number;
  draftTimetableCount?: number;
};

type CourseExclusionsSettingsResponse = {
  courses: CourseExclusionItem[];
  excludedCourseIds: number[];
  totalCourses: number;
  excludedCount: number;
  activeCount: number;
  totalLiveTimetables?: number;
  totalDraftTimetables?: number;
};

export function CourseExclusionsSettingsView() {
  const { hasPermission } = useAuth();
  const canEdit =
    hasPermission("settings.edit") ||
    hasPermission("timetables.manage") ||
    hasPermission("timetables.edit");

  const [data, setData] = useState<CourseExclusionsSettingsResponse | null>(null);
  const [excludedIds, setExcludedIds] = useState<Set<number>>(new Set());
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedCollegeId, setSelectedCollegeId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "excluded">("all");

  const applyData = useCallback((res: CourseExclusionsSettingsResponse) => {
    setData(res);
    setExcludedIds(new Set(res.excludedCourseIds.map(Number)));
    const reasonMap: Record<number, string> = {};
    for (const c of res.courses) {
      if (c.reason) {
        reasonMap[c.id] = c.reason;
      }
    }
    setReasons(reasonMap);
  }, []);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/settings/course-exclusions", {
        cache: "no-store",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof body?.message === "string" ? body.message : "Failed to load course exclusions",
        );
      }
      applyData(body as CourseExclusionsSettingsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load course exclusions");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [applyData]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Compute colleges list for filter dropdown
  const colleges = useMemo(() => {
    if (!data) return [];
    const map = new Map<number, { id: number; name: string; code: string | null }>();
    for (const c of data.courses) {
      if (!map.has(c.collegeId)) {
        map.set(c.collegeId, { id: c.collegeId, name: c.collegeName, code: c.collegeCode });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  // Dirty state tracking
  const initialExcludedKey = useMemo(() => {
    if (!data) return "";
    return data.excludedCourseIds.slice().sort((a, b) => a - b).join(",");
  }, [data]);

  const currentExcludedKey = useMemo(() => {
    return Array.from(excludedIds).sort((a, b) => a - b).join(",");
  }, [excludedIds]);

  const initialReasonsKey = useMemo(() => {
    if (!data) return "";
    return data.courses
      .map((c) => `${c.id}:${c.reason || ""}`)
      .sort()
      .join("|");
  }, [data]);

  const currentReasonsKey = useMemo(() => {
    return Object.entries(reasons)
      .map(([k, v]) => `${k}:${v}`)
      .sort()
      .join("|");
  }, [reasons]);

  const dirty = Boolean(
    data && (initialExcludedKey !== currentExcludedKey || initialReasonsKey !== currentReasonsKey),
  );

  function toggleExclusion(courseId: number) {
    if (!canEdit) return;
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) {
        next.delete(courseId);
      } else {
        next.add(courseId);
      }
      return next;
    });
  }

  function handleReasonChange(courseId: number, val: string) {
    if (!canEdit) return;
    setReasons((prev) => ({
      ...prev,
      [courseId]: val,
    }));
  }

  function clearAllExclusions() {
    if (!canEdit) return;
    setExcludedIds(new Set());
  }

  function discardChanges() {
    if (!data) return;
    applyData(data);
    setMessage(null);
    setError(null);
  }

  async function saveChanges() {
    if (!canEdit || !dirty) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await apiFetch("/settings/course-exclusions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          excludedCourseIds: Array.from(excludedIds),
          reasons,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof body?.message === "string" ? body.message : "Failed to save course exclusions",
        );
      }
      applyData(body as CourseExclusionsSettingsResponse);
      setMessage("Course exclusions saved successfully. Timetable planners and filters have been updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save course exclusions");
    } finally {
      setSaving(false);
    }
  }

  // Filtered course items
  const filteredCourses = useMemo(() => {
    if (!data) return [];
    let list = data.courses;

    if (selectedCollegeId !== "all") {
      const cid = Number(selectedCollegeId);
      list = list.filter((c) => c.collegeId === cid);
    }

    if (statusFilter === "active") {
      list = list.filter((c) => !excludedIds.has(c.id));
    } else if (statusFilter === "excluded") {
      list = list.filter((c) => excludedIds.has(c.id));
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.code && c.code.toLowerCase().includes(q)) ||
          c.collegeName.toLowerCase().includes(q) ||
          (c.collegeCode && c.collegeCode.toLowerCase().includes(q)) ||
          c.branches.some(
            (b) =>
              b.name.toLowerCase().includes(q) ||
              (b.code && b.code.toLowerCase().includes(q)),
          ),
      );
    }

    return list;
  }, [data, selectedCollegeId, statusFilter, search, excludedIds]);

  const liveExcludedCount = excludedIds.size;
  const liveActiveCount = (data?.totalCourses ?? 0) - liveExcludedCount;

  return (
    <div className="space-y-3">
      {/* Page Title & Action Controls Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-navy-900 tracking-tight leading-tight">
            Timetable Course Exclusions
          </h2>
          <p className="text-xs text-slate-500 font-normal mt-0.5">
            Exclude degree courses across colleges from timetable configuration and scheduling.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void loadData(true)}
            disabled={refreshing || loading}
            className="text-xs h-7.5 px-2.5"
            title="Refresh course data"
          >
            <RefreshCw className={cn("mr-1.5 h-3 w-3", refreshing && "animate-spin")} />
            Refresh
          </Button>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {liveActiveCount} Active / {data?.totalCourses ?? 0} Total
          </span>

          {canEdit && dirty ? (
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                disabled={saving}
                onClick={discardChanges}
                className="text-xs h-7.5 px-2.5"
              >
                <RotateCcw className="mr-1.5 h-3 w-3" />
                Discard
              </Button>
              <Button
                size="sm"
                disabled={saving}
                onClick={saveChanges}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-7.5 px-3 shadow-xs"
              >
                <Save className="mr-1.5 h-3 w-3" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Notifications */}
      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800 shadow-sm flex items-start justify-between gap-2.5">
          <div className="flex items-start gap-2">
            <span className="font-semibold text-rose-900">Error:</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-500 hover:text-rose-700 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800 shadow-sm flex items-start justify-between gap-2.5">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{message}</span>
          </div>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="text-emerald-500 hover:text-emerald-700 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {/* Unsaved Changes Notification Banner */}
      {dirty && canEdit ? (
        <div className="rounded-lg border border-amber-300/80 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span>
              You have unsaved exclusion changes. Click <strong>Save Changes</strong> above to apply timetable restrictions.
            </span>
          </div>
        </div>
      ) : null}

      {/* Compact Metrics Bar (Single Line) */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors shadow-2xs cursor-pointer",
            statusFilter === "all"
              ? "border-navy-900 bg-navy-50 text-navy-950 font-bold ring-1 ring-navy-800/30"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-medium",
          )}
        >
          <Layers className="h-3.5 w-3.5 text-slate-500" />
          <span>All Courses:</span>
          <span className="font-bold text-navy-950">{loading ? "..." : (data?.totalCourses ?? 0)}</span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("active")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors shadow-2xs cursor-pointer",
            statusFilter === "active"
              ? "border-emerald-500 bg-emerald-50 text-emerald-950 font-bold ring-1 ring-emerald-500/30"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-medium",
          )}
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          <span>Configured:</span>
          <span className="font-bold text-emerald-700">{loading ? "..." : liveActiveCount}</span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("excluded")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors shadow-2xs cursor-pointer",
            statusFilter === "excluded"
              ? "border-amber-500 bg-amber-50 text-amber-950 font-bold ring-1 ring-amber-500/30"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-medium",
          )}
        >
          <CalendarOff className="h-3.5 w-3.5 text-amber-600" />
          <span>Excluded:</span>
          <span className="font-bold text-amber-700">{loading ? "..." : liveExcludedCount}</span>
        </button>

        <div className="ml-auto hidden sm:flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-xs text-slate-600">
          <Calendar className="h-3.5 w-3.5 text-blue-600" />
          <span>Live Timetables across Portal:</span>
          <span className="font-bold text-navy-950">{data?.totalLiveTimetables ?? 0}</span>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <Card className="p-2 shadow-2xs">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search course name, code, college or branch..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-7 text-xs text-slate-800 placeholder-slate-400 focus:border-brand-blue-500 focus:outline-none focus:ring-1 focus:ring-brand-blue-500"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </div>

            {/* College select */}
            <div className="relative">
              <select
                value={selectedCollegeId}
                onChange={(e) => setSelectedCollegeId(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-2xs focus:border-brand-blue-500 focus:outline-none focus:ring-1 focus:ring-brand-blue-500"
              >
                <option value="all">All Colleges ({colleges.length})</option>
                {colleges.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name} {col.code ? `(${col.code})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {canEdit && liveExcludedCount > 0 ? (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={clearAllExclusions}
                className="text-[11px] h-6.5 px-2"
              >
                Reset All to Configured
              </Button>
            </div>
          ) : null}
        </div>
      </Card>

      {/* Courses Single-Line Table Layout */}
      {loading ? (
        <TableSkeleton columns={5} rows={8} showPagination={false} />
      ) : filteredCourses.length === 0 ? (
        <Card className="p-8 text-center text-slate-500">
          <CalendarOff className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-xs font-semibold text-slate-700">No courses match your filters</p>
          <p className="text-[11px] text-slate-500">Try adjusting your search query or college selection.</p>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-2xs">
          <table className="w-full min-w-[900px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                <th className="px-3.5 py-2.5">Course / Program</th>
                <th className="px-3.5 py-2.5">College</th>
                <th className="px-3.5 py-2.5 text-center">Duration & Branches</th>
                <th className="px-3.5 py-2.5 text-center">Timetable Status</th>
                <th className="px-3.5 py-2.5 text-center">Exclusion Status</th>
                <th className="px-3.5 py-2.5 text-right">Action & Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCourses.map((c) => {
                const isExcluded = excludedIds.has(c.id);
                const currentReason = reasons[c.id] ?? "";
                const publishedCount = c.publishedTimetableCount ?? 0;
                const draftCount = c.draftTimetableCount ?? 0;

                return (
                  <tr
                    key={c.id}
                    className={cn(
                      "transition-colors",
                      isExcluded
                        ? "bg-amber-50/30 hover:bg-amber-50/50"
                        : "hover:bg-slate-50/80",
                    )}
                  >
                    {/* 1. Course / Program */}
                    <td className="px-3.5 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-navy-950 text-xs">
                          {c.name}
                        </span>
                        {c.code ? (
                          <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.2 font-mono text-[10px] font-bold text-slate-700">
                            {c.code}
                          </span>
                        ) : null}
                      </div>
                    </td>

                    {/* 2. College */}
                    <td className="px-3.5 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-700 text-xs truncate max-w-[240px]">
                          {c.collegeName}
                        </span>
                        {c.collegeCode ? (
                          <span className="rounded bg-slate-100 px-1 py-0.2 text-[9.5px] font-semibold text-slate-500">
                            {c.collegeCode}
                          </span>
                        ) : null}
                      </div>
                    </td>

                    {/* 3. Duration & Branches */}
                    <td className="px-3.5 py-2.5 text-center">
                      <span className="inline-flex items-center gap-1 rounded bg-slate-50 border border-slate-200 px-2 py-0.5 text-[10.5px] font-medium text-slate-600" title={c.branches.map(b => b.name).join(", ")}>
                        {c.totalYears ? `${c.totalYears}Y` : "—"} • {c.branchCount} {c.branchCount === 1 ? "branch" : "branches"}
                      </span>
                    </td>

                    {/* 4. Active Timetables Status */}
                    <td className="px-3.5 py-2.5 text-center">
                      {publishedCount > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10.5px] font-bold text-blue-700 shadow-2xs">
                          <Calendar className="h-3 w-3 text-blue-600" />
                          {publishedCount} Live
                        </span>
                      ) : draftCount > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded bg-purple-50 border border-purple-200 px-2 py-0.5 text-[10.5px] font-semibold text-purple-700">
                          {draftCount} Draft
                        </span>
                      ) : (
                        <span className="text-[10.5px] font-medium text-slate-400">
                          None
                        </span>
                      )}
                    </td>

                    {/* 5. Exclusion Status */}
                    <td className="px-3.5 py-2.5 text-center">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold shadow-2xs",
                          isExcluded
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : "bg-emerald-50 text-emerald-800 border border-emerald-200",
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            isExcluded ? "bg-amber-500 animate-pulse" : "bg-emerald-500",
                          )}
                        />
                        {isExcluded ? "Excluded" : "Configured"}
                      </span>
                    </td>

                    {/* 6. Single-Line Action & Reason */}
                    <td className="px-3.5 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Inline reason field when excluded */}
                        {isExcluded ? (
                          <input
                            type="text"
                            disabled={!canEdit}
                            value={currentReason}
                            placeholder="Exclusion reason..."
                            onChange={(e) => handleReasonChange(c.id, e.target.value)}
                            className="h-6.5 w-40 sm:w-48 rounded border border-amber-300 bg-white px-2 text-[11px] text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:bg-slate-50 shadow-2xs"
                          />
                        ) : null}

                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => toggleExclusion(c.id)}
                            className={cn(
                              "inline-flex shrink-0 items-center justify-center rounded-lg px-2.5 py-1 text-xs font-bold transition-all shadow-2xs cursor-pointer",
                              isExcluded
                                ? "border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                                : "border border-slate-300 bg-white text-slate-700 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-900",
                            )}
                          >
                            {isExcluded ? (
                              <>
                                <Check className="mr-1 h-3 w-3 text-emerald-600" />
                                Include
                              </>
                            ) : (
                              <>
                                <Ban className="mr-1 h-3 w-3 text-amber-600" />
                                Exclude {publishedCount > 0 ? `(${publishedCount} Live)` : ""}
                              </>
                            )}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
