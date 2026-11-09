"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  Search,
  X,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Fingerprint,
  CalendarDays,
} from "lucide-react";
import { FacultyAvatar } from "@/components/ui/FacultyAvatar";
import { StaffProfileModal } from "./StaffProfileModal";
import type {
  StaffOverviewItem,
  StaffOverviewResponse,
  StaffSlotDetail,
} from "./staff-types";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";

function getTodayIST(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function shiftDateByDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function StaffRegisterView() {
  const todayIST = useMemo(() => getTodayIST(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayIST);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [divisionFilter, setDivisionFilter] = useState("all");
  const [designationFilter, setDesignationFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [slotsFilter, setSlotsFilter] = useState<"all" | "yes" | "no">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataResponse, setDataResponse] = useState<StaffOverviewResponse | null>(null);
  const router = useRouter();
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchDraft.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchDraft]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("date", selectedDate);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (search) params.set("search", search);
      if (deptFilter !== "all") params.set("department", deptFilter);
      if (divisionFilter !== "all") params.set("division", divisionFilter);
      if (designationFilter !== "all") params.set("designation", designationFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (slotsFilter !== "all") params.set("hasSlots", slotsFilter);

      const res = await apiFetch(`/staff?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || `Failed to load staff list (${res.status})`);
      }
      const json: StaffOverviewResponse = await res.json();
      setDataResponse(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load staff data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedDate,
    search,
    deptFilter,
    divisionFilter,
    designationFilter,
    statusFilter,
    slotsFilter,
    page,
    pageSize,
  ]);

  const isToday = selectedDate === todayIST;

  const hasActiveFilters =
    searchDraft.trim() !== "" ||
    deptFilter !== "all" ||
    divisionFilter !== "all" ||
    designationFilter !== "all" ||
    statusFilter !== "all" ||
    slotsFilter !== "all";

  const clearFilters = () => {
    setSearchDraft("");
    setSearch("");
    setDeptFilter("all");
    setDivisionFilter("all");
    setDesignationFilter("all");
    setStatusFilter("all");
    setSlotsFilter("all");
    setPage(1);
  };

  const kpis = dataResponse?.kpis || {
    totalStaff: 0,
    presentCount: 0,
    lateCount: 0,
    absentCount: 0,
    leaveCount: 0,
    odCount: 0,
    permissionCount: 0,
    withSlotsCount: 0,
    totalSlotsToday: 0,
  };

  const globalKpis = dataResponse?.globalKpis;

  const filterOptions = dataResponse?.filterOptions || {
    divisions: [],
    departments: [],
    designations: [],
  };

  const attendancePercent =
    kpis.totalStaff > 0 ? Math.round((kpis.presentCount / kpis.totalStaff) * 100) : 0;

  return (
    <div className="flex flex-col h-[calc(100dvh-6.25rem)] min-h-0 gap-2 w-full max-w-full">
      {/* ─── ROW 1: Sleek Header Bar with Inline KPI Badges & Date Selector ─── */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-2xs">
        {/* Title */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="p-1 rounded-md bg-brand-50 text-brand-600">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-none">Staff</h1>
            <p className="text-[10px] text-slate-400 font-medium hidden sm:block mt-0.5">
              Live attendance, designations & schedule
            </p>
          </div>
        </div>

        {/* Inline KPI Badges (Clickable Filters) */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {loading && !dataResponse ? (
            <>
              <div className="h-6 w-16 bg-slate-200/80 rounded-md animate-pulse" />
              <div className="h-6 w-24 bg-slate-200/80 rounded-md animate-pulse" />
              <div className="h-6 w-20 bg-slate-200/80 rounded-md animate-pulse" />
              <div className="h-6 w-22 bg-slate-200/80 rounded-md animate-pulse" />
              <div className="h-6 w-24 bg-slate-200/80 rounded-md animate-pulse" />
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("all");
                  setSlotsFilter("all");
                  setPage(1);
                }}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold transition border",
                  statusFilter === "all" && slotsFilter === "all"
                    ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100",
                )}
                title={
                  globalKpis && globalKpis.totalStaff !== kpis.totalStaff
                    ? `${kpis.totalStaff} staff in current filter (${globalKpis.totalStaff} total registered faculty)`
                    : `${kpis.totalStaff} total registered faculty`
                }
              >
                <span>Total:</span>
                <span className="font-bold">{kpis.totalStaff}</span>
                {globalKpis && globalKpis.totalStaff !== kpis.totalStaff && (
                  <span className="text-[10px] opacity-75 font-normal">/{globalKpis.totalStaff}</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatusFilter(statusFilter === "present" ? "all" : "present");
                  if (slotsFilter !== "all") setSlotsFilter("all");
                  setPage(1);
                }}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold transition border",
                  statusFilter === "present"
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                    : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/80",
                )}
                title={
                  globalKpis && globalKpis.presentCount !== kpis.presentCount
                    ? `${kpis.presentCount} present in filter (${globalKpis.presentCount} present college-wide)`
                    : "Present today"
                }
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>Present:</span>
                <span className="font-bold">{kpis.presentCount}</span>
                {globalKpis && globalKpis.presentCount !== kpis.presentCount && (
                  <span className="text-[10px] opacity-75 font-normal">/{globalKpis.presentCount}</span>
                )}
                <span className="text-[10px] opacity-80 font-normal">({attendancePercent}%)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatusFilter(statusFilter === "absent" ? "all" : "absent");
                  if (slotsFilter !== "all") setSlotsFilter("all");
                  setPage(1);
                }}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold transition border",
                  statusFilter === "absent"
                    ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                    : "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100/80",
                )}
                title={
                  globalKpis && globalKpis.absentCount !== kpis.absentCount
                    ? `${kpis.absentCount} absent in filter (${globalKpis.absentCount} absent college-wide)`
                    : "Absent (no biometric punch)"
                }
              >
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                <span>Absent:</span>
                <span className="font-bold">{kpis.absentCount}</span>
                {globalKpis && globalKpis.absentCount !== kpis.absentCount && (
                  <span className="text-[10px] opacity-75 font-normal">/{globalKpis.absentCount}</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatusFilter(statusFilter === "leave" ? "all" : "leave");
                  if (slotsFilter !== "all") setSlotsFilter("all");
                  setPage(1);
                }}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold transition border",
                  statusFilter === "leave" || statusFilter === "od"
                    ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                    : "bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100/80",
                )}
                title={
                  globalKpis && (globalKpis.leaveCount + globalKpis.odCount) !== (kpis.leaveCount + kpis.odCount)
                    ? `${kpis.leaveCount + kpis.odCount} on leave/OD in filter (${globalKpis.leaveCount + globalKpis.odCount} college-wide)`
                    : "On Leave or OD"
                }
              >
                <span>Leave/OD:</span>
                <span className="font-bold">{kpis.leaveCount + kpis.odCount}</span>
                {globalKpis && (globalKpis.leaveCount + globalKpis.odCount) !== (kpis.leaveCount + kpis.odCount) && (
                  <span className="text-[10px] opacity-75 font-normal">/{globalKpis.leaveCount + globalKpis.odCount}</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSlotsFilter(slotsFilter === "yes" ? "all" : "yes");
                  if (statusFilter !== "all") setStatusFilter("all");
                  setPage(1);
                }}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold transition border",
                  slotsFilter === "yes"
                    ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                    : "bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100/80",
                )}
                title="Teaching slots today"
              >
                <Clock className="h-3 w-3 shrink-0" />
                <span>Slots Today:</span>
                <span className="font-bold">{kpis.totalSlotsToday}</span>
                {globalKpis && globalKpis.totalSlotsToday !== kpis.totalSlotsToday && (
                  <span className="text-[10px] opacity-75 font-normal">/{globalKpis.totalSlotsToday}</span>
                )}
              </button>
            </>
          )}
        </div>

        {/* Date Selector Toolbar */}
        <div className="flex items-center gap-1 bg-slate-50 p-0.5 rounded-md border border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => setSelectedDate((prev) => shiftDateByDays(prev, -1))}
            className="p-1 rounded text-slate-500 hover:bg-white hover:text-slate-900 transition"
            title="Previous Day"
            aria-label="Previous Day"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          <div className="flex items-center gap-1 px-1.5">
            <Calendar className="h-3.5 w-3.5 text-brand-600" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) setSelectedDate(e.target.value);
              }}
              className="text-xs font-semibold text-slate-800 bg-transparent border-none outline-none cursor-pointer"
            />
            <span className="text-[11px] text-slate-400 font-medium hidden md:inline">
              ({formatDateDisplay(selectedDate)})
            </span>
          </div>

          <button
            type="button"
            onClick={() => setSelectedDate((prev) => shiftDateByDays(prev, 1))}
            className="p-1 rounded text-slate-500 hover:bg-white hover:text-slate-900 transition"
            title="Next Day"
            aria-label="Next Day"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setSelectedDate(todayIST)}
            className={cn(
              "px-2 py-0.5 text-xs font-semibold rounded transition",
              isToday
                ? "bg-brand-600 text-white shadow-2xs"
                : "text-slate-600 hover:bg-white",
            )}
          >
            Today
          </button>

          <button
            type="button"
            onClick={() => void loadData()}
            className="p-1 rounded text-slate-400 hover:bg-white hover:text-slate-700 transition"
            title="Refresh"
            aria-label="Refresh"
          >
            <RotateCcw className={cn("h-3.5 w-3.5", loading && "animate-spin text-brand-600")} />
          </button>
        </div>
      </div>

      {/* ─── ROW 2: Compact Single-Line Filter Strip ─── */}
      <div className="shrink-0 flex flex-wrap items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
        {/* Search Input */}
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search name, ID, subject..."
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            className="w-full pl-8 pr-7 py-1 text-xs border border-slate-200 rounded-md bg-slate-50/50 text-slate-900 outline-none focus:border-brand-500 focus:bg-white transition"
          />
          {searchDraft && (
            <button
              type="button"
              onClick={() => setSearchDraft("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Department Filter */}
        <select
          value={deptFilter}
          onChange={(e) => {
            setDeptFilter(e.target.value);
            setPage(1);
          }}
          className="py-1 px-2 text-xs border border-slate-200 rounded-md bg-slate-50/50 text-slate-800 outline-none focus:border-brand-500 focus:bg-white transition"
        >
          <option value="all">All Departments</option>
          {filterOptions.departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        {/* Designation Filter */}
        <select
          value={designationFilter}
          onChange={(e) => {
            setDesignationFilter(e.target.value);
            setPage(1);
          }}
          className="py-1 px-2 text-xs border border-slate-200 rounded-md bg-slate-50/50 text-slate-800 outline-none focus:border-brand-500 focus:bg-white transition"
        >
          <option value="all">All Designations</option>
          {filterOptions.designations.map((des) => (
            <option key={des} value={des}>
              {des}
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="py-1 px-2 text-xs border border-slate-200 rounded-md bg-slate-50/50 text-slate-800 outline-none focus:border-brand-500 focus:bg-white transition"
        >
          <option value="all">All Statuses</option>
          <option value="present">Present (Inc. Late)</option>
          <option value="late">Late Only</option>
          <option value="absent">Absent</option>
          <option value="leave">On Leave</option>
          <option value="od">On Duty (OD)</option>
          <option value="permission">Permission</option>
        </select>

        {/* Slots Filter */}
        <select
          value={slotsFilter}
          onChange={(e) => {
            setSlotsFilter(e.target.value as "all" | "yes" | "no");
            setPage(1);
          }}
          className="py-1 px-2 text-xs border border-slate-200 rounded-md bg-slate-50/50 text-slate-800 outline-none focus:border-brand-500 focus:bg-white transition"
        >
          <option value="all">All Slots</option>
          <option value="yes">Has Classes Today</option>
          <option value="no">Free (No Slots)</option>
        </select>

        {/* Contextual filter indicator when compound status + slots filters are active */}
        {slotsFilter === "yes" && statusFilter !== "all" && globalKpis && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
            <span>
              Showing <strong>{dataResponse?.pagination.total ?? 0}</strong> {statusFilter} staff with classes today ({statusFilter === "absent" ? globalKpis.absentCount : globalKpis.presentCount} {statusFilter} total)
            </span>
            <button
              type="button"
              onClick={() => {
                setSlotsFilter("all");
                setPage(1);
              }}
              className="text-amber-900 underline font-semibold hover:text-amber-950 cursor-pointer"
            >
              Show all {statusFilter === "absent" ? globalKpis.absentCount : ""} {statusFilter}
            </button>
          </span>
        )}

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-800 transition ml-auto"
          >
            <X className="h-3 w-3" />
            <span>Reset filters</span>
          </button>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-2.5 rounded-lg border border-rose-200 bg-rose-50/80 text-rose-900 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void loadData()}
            className="font-semibold underline hover:text-rose-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* ─── ROW 3: Single-Eye-View Table (100% width, no horizontal scroll, complete height) ─── */}
      <div className="flex-1 min-h-0 flex flex-col rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <div className="flex-1 min-h-0 overflow-y-auto">
          <table className="w-full table-fixed text-left text-xs">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 backdrop-blur-xs text-[11px] font-bold uppercase tracking-wider text-slate-500 shadow-2xs">
              <tr>
                <th className="w-[19%] px-3 py-2.5">Staff Member</th>
                <th className="w-[14%] px-3 py-2.5">Designation</th>
                <th className="w-[10%] px-3 py-2.5">Department</th>
                <th className="w-[23%] px-3 py-2.5">Teaching Subjects</th>
                <th className="w-[14%] px-3 py-2.5">Today&apos;s Slots</th>
                <th className="w-[8%] px-3 py-2.5">Status</th>
                <th className="w-[6%] px-2 py-2.5 text-center">In</th>
                <th className="w-[6%] px-2 py-2.5 text-center">Out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && !dataResponse ? (
                Array.from({ length: pageSize }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    {/* 1. Staff Member Skeleton */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-slate-200 shrink-0" />
                        <div className="h-3.5 bg-slate-200 rounded w-28 shrink-0" />
                        <div className="h-3 bg-slate-100 rounded w-8 shrink-0" />
                      </div>
                    </td>
                    {/* 2. Designation Skeleton */}
                    <td className="px-3 py-2.5">
                      <div className="h-4.5 bg-slate-200 rounded-md w-24" />
                    </td>
                    {/* 3. Department Skeleton */}
                    <td className="px-3 py-2.5">
                      <div className="h-3.5 bg-slate-200 rounded w-14" />
                    </td>
                    {/* 4. Teaching Subjects Skeleton */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <div className="h-4.5 bg-slate-200 rounded w-28" />
                        <div className="h-4.5 bg-slate-100 rounded w-16" />
                      </div>
                    </td>
                    {/* 5. Today's Slots Skeleton */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <div className="h-4.5 bg-slate-200 rounded-full w-14" />
                        <div className="h-3.5 bg-slate-100 rounded w-10" />
                      </div>
                    </td>
                    {/* 6. Status Skeleton */}
                    <td className="px-3 py-2.5">
                      <div className="h-4.5 bg-slate-200 rounded-full w-16" />
                    </td>
                    {/* 7. In Time Skeleton */}
                    <td className="px-2 py-2.5 text-center">
                      <div className="h-3.5 bg-slate-200 rounded w-11 mx-auto" />
                    </td>
                    {/* 8. Out Time Skeleton */}
                    <td className="px-2 py-2.5 text-center">
                      <div className="h-3.5 bg-slate-200 rounded w-11 mx-auto" />
                    </td>
                  </tr>
                ))
              ) : dataResponse?.data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-slate-400">
                    {hasActiveFilters
                      ? "No staff members matched your filter criteria."
                      : "No staff records found."}
                  </td>
                </tr>
              ) : (
                dataResponse?.data.map((row) => {
                  const att = row.todayAttendance;
                  const subs = row.teachingSubjects || [];
                  const slotCount = row.todaySlotsCount;

                  const statusBg = {
                    present: "bg-emerald-50 text-emerald-700 border-emerald-200",
                    late: "bg-amber-50 text-amber-700 border-amber-200",
                    absent: "bg-rose-50 text-rose-700 border-rose-200",
                    leave: "bg-purple-50 text-purple-700 border-purple-200",
                    od: "bg-blue-50 text-blue-700 border-blue-200",
                    permission: "bg-cyan-50 text-cyan-700 border-cyan-200",
                  }[att.status] || "bg-slate-50 text-slate-700 border-slate-200";

                  const profileUrl = `/staff/${encodeURIComponent(row.code || row.hrmsEmployeeId)}?date=${selectedDate}`;

                  return (
                    <tr
                      key={row.hrmsEmployeeId}
                      onClick={() => setSelectedStaffId(row.code || row.hrmsEmployeeId)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      {/* 1. Staff Member (19%) */}
                      <td className="px-3 py-2.5 overflow-hidden">
                        <div className="flex items-center gap-2 min-w-0">
                          <FacultyAvatar
                            name={row.name}
                            photo={row.profilePhoto}
                            hrmsEmployeeId={row.hrmsEmployeeId}
                            size="xs"
                          />
                          <Link
                            href={profileUrl}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSelectedStaffId(row.code || row.hrmsEmployeeId);
                            }}
                            className="font-semibold text-slate-900 group-hover:text-brand-600 hover:underline transition truncate"
                            title={row.name}
                          >
                            {row.name}
                          </Link>
                          <span className="font-mono text-[10px] text-slate-400 shrink-0">
                            {row.code}
                          </span>
                        </div>
                      </td>

                      {/* 2. Designation (14%) */}
                      <td className="px-3 py-2.5 overflow-hidden">
                        <span
                          className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-brand-50 text-brand-700 border border-brand-200/60 truncate max-w-full"
                          title={row.designation}
                        >
                          {row.designation || "Faculty"}
                        </span>
                      </td>

                      {/* 3. Department (10%) */}
                      <td className="px-3 py-2.5 overflow-hidden">
                        <span
                          className="font-medium text-slate-700 truncate text-[11px] block"
                          title={row.department}
                        >
                          {row.department || "—"}
                        </span>
                      </td>

                      {/* 4. Teaching Subjects (23%) */}
                      <td className="px-3 py-2.5 overflow-hidden">
                        {subs.length === 0 ? (
                          <span className="text-[11px] text-slate-400 italic">No assigned subjects</span>
                        ) : (
                          <div className="flex items-center gap-1 min-w-0">
                            {subs.slice(0, 2).map((s, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-800 border border-slate-200 truncate max-w-[130px]"
                                title={s}
                              >
                                {s}
                              </span>
                            ))}
                            {subs.length > 2 && (
                              <span
                                className="px-1 py-0.5 rounded text-[9px] font-semibold text-brand-700 bg-brand-50 border border-brand-200/50 shrink-0"
                                title={subs.join(", ")}
                              >
                                +{subs.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 5. Today's Slots (14%) */}
                      <td className="px-3 py-2.5 overflow-hidden">
                        {slotCount === 0 ? (
                          <span className="text-[11px] text-slate-400">0 Slots (Free)</span>
                        ) : (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border shrink-0",
                                row.todayPostedSlotsCount === slotCount
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : row.todayPostedSlotsCount > 0
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : "bg-amber-50 text-amber-800 border-amber-200",
                              )}
                            >
                              <Clock className="h-2.5 w-2.5" />
                              {slotCount} ({row.todayPostedSlotsCount}p)
                            </span>
                            <div className="flex items-center gap-1 overflow-hidden">
                              {row.todaySlots.slice(0, 2).map((s: StaffSlotDetail, idx: number) => (
                                <span
                                  key={idx}
                                  className={cn(
                                    "px-1 py-0.5 rounded text-[9px] font-mono shrink-0",
                                    s.isPosted ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600",
                                  )}
                                  title={`${s.slotLabel}: ${s.subjectName} (${s.startTime || ""} - ${s.endTime || ""})`}
                                >
                                  {s.startTime ? s.startTime.slice(0, 5) : s.slotLabel}
                                </span>
                              ))}
                              {row.todaySlots.length > 2 && (
                                <span className="text-[9px] text-slate-400 shrink-0">
                                  +{row.todaySlots.length - 2}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* 6. Status (8%) */}
                      <td className="px-3 py-2.5 overflow-hidden">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0",
                            statusBg,
                          )}
                          title={att.leaveReason || att.displayStatus}
                        >
                          <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-current" />
                          <span>{att.displayStatus}</span>
                        </span>
                      </td>

                      {/* 7. In Time (6%) */}
                      <td className="px-2 py-2.5 text-center overflow-hidden">
                        {att.checkInTime ? (
                          <span className="font-mono text-[10px] text-slate-700 font-medium whitespace-nowrap">
                            {att.checkInTime}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs font-mono">—</span>
                        )}
                      </td>

                      {/* 8. Out Time (6%) */}
                      <td className="px-2 py-2.5 text-center overflow-hidden">
                        {att.checkOutTime ? (
                          <span className="font-mono text-[10px] text-slate-700 font-medium whitespace-nowrap">
                            {att.checkOutTime}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs font-mono">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ─── Compact Pagination Bar (Docked at Bottom) ─── */}
        {dataResponse ? (
          <div className="shrink-0 flex items-center justify-between border-t border-slate-200 px-3 py-2 bg-slate-50/80 text-xs text-slate-500">
            <div>
              Showing{" "}
              <span className="font-semibold text-slate-800">
                {dataResponse.pagination.total === 0
                  ? 0
                  : (dataResponse.pagination.page - 1) * dataResponse.pagination.pageSize + 1}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-slate-800">
                {Math.min(
                  dataResponse.pagination.page * dataResponse.pagination.pageSize,
                  dataResponse.pagination.total,
                )}
              </span>{" "}
              of <span className="font-semibold text-slate-800">{dataResponse.pagination.total}</span> staff
            </div>

            {/* Page Size Selector */}
            <div className="flex items-center gap-1 text-[11px]">
              <span className="text-slate-400">Rows:</span>
              {[15, 25, 50].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => {
                    setPageSize(size);
                    setPage(1);
                  }}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-semibold transition",
                    pageSize === size
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-200",
                  )}
                >
                  {size}
                </button>
              ))}
            </div>

            {/* Previous / Next buttons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={!dataResponse.pagination.hasPrev || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2 py-0.5 rounded border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition"
              >
                Prev
              </button>
              <span className="text-slate-600 font-medium px-1">
                {dataResponse.pagination.page} / {dataResponse.pagination.totalPages || 1}
              </span>
              <button
                type="button"
                disabled={!dataResponse.pagination.hasNext || loading}
                onClick={() => setPage((p) => p + 1)}
                className="px-2 py-0.5 rounded border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition"
              >
                Next
              </button>
            </div>
          </div>
        ) : (
          <div className="shrink-0 flex items-center justify-between border-t border-slate-200 px-3 py-2 bg-slate-50/80 text-xs text-slate-500 animate-pulse">
            <div className="h-3.5 bg-slate-200 rounded w-28" />
            <div className="flex items-center gap-3">
              <div className="h-4 bg-slate-200 rounded w-20" />
              <div className="h-4 bg-slate-200 rounded w-24" />
            </div>
          </div>
        )}
      </div>

      {/* ─── SDMS-Style Staff Profile Detailed Popup Modal ─── */}
      {selectedStaffId && (
        <StaffProfileModal
          identifier={selectedStaffId}
          isOpen={Boolean(selectedStaffId)}
          onClose={() => setSelectedStaffId(null)}
          selectedDate={selectedDate}
        />
      )}
    </div>
  );
}
