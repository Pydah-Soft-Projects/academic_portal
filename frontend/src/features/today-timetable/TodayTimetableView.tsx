"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Edit2,
  X,
  AlertCircle,
  History,
  Clock,
  Check,
  RotateCcw,
  ArrowRight,
  Search,
  Info,
  ShieldCheck,
  Shield,
  Lock,
  Users,
  User,
  BookOpen,
  CheckCircle,
  CalendarOff,
  ArrowRightLeft,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useAcademicContext } from "@/components/layout/AcademicProvider";
import { AcademicFilterBar } from "@/components/layout/AcademicFilterBar";
import { useAuth } from "@/components/auth/AuthProvider";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingAnimation } from "@/components/ui/LoadingAnimation";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  isNonClassTimingSlot,
  timingSlotDisplayLabel,
  timingSlotCellClass,
} from "@/features/timetables/timing-slot-utils";
import { GiveHolidayModal } from "./GiveHolidayModal";

function TimetableScheduleSkeleton() {
  return (
    <div className="space-y-4 portal-fade-in mb-5">
      {[1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-20 rounded-lg" />
              <Skeleton className="h-6 w-24 rounded-lg" variant="subtle" />
              <Skeleton className="h-4 w-36 rounded" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" variant="subtle" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 pt-1">
            {Array.from({ length: 7 }).map((_, j) => (
              <div key={j} className="p-3 rounded-xl border border-border bg-slate-50/60 space-y-2">
                <Skeleton className="h-3 w-16 rounded" />
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-2.5 w-12 rounded" variant="subtle" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

type SlotCellEntry = {
  id: number;
  subjectId: number | null;
  subjectCode: string | null;
  subjectName: string | null;
  entryType: string;
  facultyStaffLinkId: number | null;
  facultyName: string | null;
  facultyHrmsId: string | null;
  roomLabel: string | null;
  batchLabel?: string | null;
  customLabel?: string | null;
};

type SlotCell = {
  slotId: number;
  slotType: string;
  assignable: boolean;
  label: string;
  startTime: string;
  endTime: string;
  entry: null | SlotCellEntry;
  entries?: SlotCellEntry[];
};

type PlannerResponse = {
  ready: boolean;
  missingTiming?: boolean;
  message?: string;
  context: {
    academicYear: string;
    college: string;
    collegeId?: number;
    course: string;
    courseId?: number;
    branch: string;
    branchId?: number;
    batch: string;
    year: number | null;
    semester: number | null;
    section: string;
    hasSections: boolean;
    studentCount: number;
    status: string | null;
    timingTemplateName: string | null;
    planId: number | null;
    versionNo: number | null;
  };
  days: string[];
  slotsByDay: Record<
    string,
    Array<{
      id: number;
      label: string;
      startTime: string;
      endTime: string;
      slotType: string;
      isAssignable: boolean;
      isActive?: boolean;
    }>
  >;
  grid: Record<string, Record<number, SlotCell>>;
  subjects: Array<{ id: number; code: string; name: string; type: string }>;
  faculty: Array<{
    hrmsEmployeeId: string;
    name: string;
    division: string;
    department: string;
    designation: string;
  }>;
};

type PeriodOverride = {
  slotId: number;
  slotLabel?: string;
  slotTime?: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  customLabel?: string;
  hrmsEmployeeId: string;
  facultyName: string;
  remarks?: string | null;
  changedByName?: string | null;
  changedAt?: string;
};

export type AllBatchesCohort = {
  collegeId?: number;
  branchId?: number;
  courseId?: number;
  batch: string;
  year: number;
  semester: number;
  section: string | null;
  yearSemLabel: string;
  batchLabel: string;
  planner: PlannerResponse;
  overrides: Record<number, PeriodOverride>;
  datesWithActivity: string[];
};

export type ActivityItem = {
  id: number | string;
  timetableDate: string;
  timingSlotId: number;
  slotLabel: string;
  slotTime: string;
  masterSubjectCode: string | null;
  masterSubjectName: string | null;
  masterFacultyName: string | null;
  newSubjectCode: string | null;
  newSubjectName: string | null;
  newFacultyName: string | null;
  changeType: "PERIOD_CHANGE" | "REVERTED_TO_MASTER";
  remarks: string | null;
  changedByName: string | null;
  createdAt: string;
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

function formatTimeOnly(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

/**
 * Calendar Widget:
 * - Past days: clickable (View Only)
 * - Today: clickable (Editable)
 * - Future days: clickable (Editable)
 */
function CalendarWidget({
  value,
  datesWithActivity,
  onSelect,
}: {
  value: string;
  datesWithActivity: string[];
  onSelect: (ymd: string) => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selected = fromYMD(value);
  const [viewYear, setViewYear] = useState(selected.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected.getMonth());

  const firstDay = new Date(viewYear, viewMonth, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Allow navigating up to 12 months ahead for future scheduling
  const maxFutureDate = new Date(today);
  maxFutureDate.setMonth(maxFutureDate.getMonth() + 12);
  const canGoNext = new Date(viewYear, viewMonth + 1, 1) <= maxFutureDate;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <button
          type="button"
          onClick={prevMonth}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition-colors"
          title="Previous Month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-bold text-slate-800">
          {new Date(viewYear, viewMonth, 1).toLocaleString("en-IN", {
            month: "long",
            year: "numeric",
          })}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          disabled={!canGoNext}
          className={cn(
            "rounded-lg p-1.5 transition-colors",
            canGoNext
              ? "text-slate-500 hover:bg-slate-100"
              : "text-slate-200 cursor-not-allowed",
          )}
          title="Next Month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 pt-3 text-center text-[11px] font-semibold uppercase text-slate-400">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 pt-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={"empty-" + idx} className="h-9 w-9" />;
          const cellDate = new Date(viewYear, viewMonth, day);
          cellDate.setHours(0, 0, 0, 0);
          const cellYmd = toYMD(cellDate);
          const isPast = cellDate < today;
          const isToday = cellYmd === toYMD(today);
          const isFuture = cellDate > today;
          const isSelected = cellYmd === value;
          const hasActivity = datesWithActivity.includes(cellYmd);

          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelect(cellYmd)}
              title={cellYmd}
              className={cn(
                "relative flex h-9 w-9 flex-col items-center justify-center rounded-lg text-xs font-semibold transition-all",
                !isSelected && isPast && "text-slate-500 hover:bg-slate-100",
                !isSelected && isFuture && "text-indigo-900 hover:bg-indigo-50 font-medium",
                isSelected && "bg-indigo-600 text-white shadow-md font-bold",
                isToday && !isSelected && "border-2 border-indigo-500 text-indigo-700 bg-indigo-50/70 font-bold",
              )}
            >
              <span>{day}</span>
              {hasActivity && (
                <span
                  className={cn(
                    "absolute bottom-1 h-1.5 w-1.5 rounded-full",
                    isSelected ? "bg-amber-300 ring-1 ring-white" : "bg-rose-500",
                  )}
                  title="Has recorded activity"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
        <button
          type="button"
          onClick={() => onSelect(toYMD(today))}
          className="font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          Jump to Today
        </button>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <span>Activity Logged</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Activity & History Modal: View-only log of previous activities and date navigator
 */
function ActivityDetailsModal({
  selectedDate,
  datesWithActivity,
  activities,
  onSelectDate,
  onClose,
}: {
  selectedDate: string;
  datesWithActivity: string[];
  activities: ActivityItem[];
  onSelectDate: (ymd: string) => void;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"calendar" | "activities">("calendar");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterByDate, setFilterByDate] = useState<boolean>(false);

  const filteredActivities = useMemo(() => {
    let list = activities;
    if (filterByDate) {
      list = list.filter((a) => a.timetableDate === selectedDate);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (a) =>
          (a.slotLabel || "").toLowerCase().includes(q) ||
          (a.newSubjectName || "").toLowerCase().includes(q) ||
          (a.newSubjectCode || "").toLowerCase().includes(q) ||
          (a.newFacultyName || "").toLowerCase().includes(q) ||
          (a.masterSubjectName || "").toLowerCase().includes(q) ||
          (a.masterFacultyName || "").toLowerCase().includes(q) ||
          (a.changedByName || "").toLowerCase().includes(q) ||
          (a.remarks || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [activities, filterByDate, selectedDate, searchQuery]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Today Timetable · Activity & Date Navigator
              </h2>
              <p className="text-xs text-slate-500">
                Select past days (view-only), today or future dates. Observe previous changes vs master.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab switchers */}
        <div className="flex border-b border-slate-200 bg-slate-100/60 px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab("calendar")}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-all",
              activeTab === "calendar"
                ? "border-indigo-600 text-indigo-700 bg-white rounded-t-lg"
                : "border-transparent text-slate-600 hover:text-slate-900",
            )}
          >
            <Calendar className="h-4 w-4" />
            <span>Calendar Navigator</span>
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
              {formatDate(fromYMD(selectedDate))}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("activities")}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-all",
              activeTab === "activities"
                ? "border-indigo-600 text-indigo-700 bg-white rounded-t-lg"
                : "border-transparent text-slate-600 hover:text-slate-900",
            )}
          >
            <Clock className="h-4 w-4" />
            <span>Activity History</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "calendar" ? (
            <div className="grid gap-6 md:grid-cols-2 items-start">
              <div>
                <h3 className="mb-2 text-sm font-bold text-slate-800">
                  Select Date
                </h3>
                <p className="mb-4 text-xs text-slate-500">
                  Select any previous date to view its timetable history (view-only), or pick today/future dates to adjust faculty assignments.
                </p>
                <CalendarWidget
                  value={selectedDate}
                  datesWithActivity={datesWithActivity}
                  onSelect={(ymd) => {
                    onSelectDate(ymd);
                    onClose();
                  }}
                />
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-indigo-900 space-y-1.5">
                      <p className="font-bold text-sm">Rules & Access Control:</p>
                      <p>
                        • <strong>Past Days</strong>: View-only. Modifications to past days are locked.
                      </p>
                      <p>
                        • <strong>Today & Future Days</strong>: Can be modified by authorized personnel (Principal, Vice Principal, HOD, and Super Admin).
                      </p>
                      <p>
                        • <strong>Master Timetable</strong>: Never modified. Used purely as a benchmark for comparison.
                      </p>
                      <p>
                        • <strong>Green</strong> = matches master schedule · <strong>Red</strong> = modified vs master schedule.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                    Active Date Status
                  </h4>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-base font-bold text-slate-800">
                        {DAY_NAMES[fromYMD(selectedDate).getDay()]},{" "}
                        {formatDate(fromYMD(selectedDate))}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setActiveTab("activities");
                        setFilterByDate(true);
                      }}
                      className="text-xs"
                    >
                      View Date Activity
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="search"
                    placeholder="Search by period, subject, faculty or remarks…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFilterByDate((p) => !p)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                      filterByDate
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-100",
                    )}
                  >
                    {filterByDate
                      ? `Showing for ${formatDate(fromYMD(selectedDate))}`
                      : "Filter by Selected Date"}
                  </button>
                </div>
              </div>

              {filteredActivities.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-12 text-center">
                  <History className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm font-semibold text-slate-600">
                    No activity logs recorded yet
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Any edits made to class periods for any date will be permanently logged here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredActivities.map((act) => {
                    const isRevert = act.changeType === "REVERTED_TO_MASTER";
                    return (
                      <div
                        key={act.id}
                        className={cn(
                          "relative rounded-xl border p-4 transition-all hover:shadow-sm",
                          isRevert
                            ? "border-emerald-200 bg-emerald-50/40"
                            : "border-rose-200 bg-rose-50/40",
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                                isRevert
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-rose-100 text-rose-800",
                              )}
                            >
                              {isRevert ? "Reverted to Master" : "Period Modified"}
                            </span>
                            <span className="text-xs font-bold text-slate-800">
                              {act.timetableDate} ({DAY_NAMES[fromYMD(act.timetableDate).getDay()]})
                            </span>
                            <span className="text-xs text-slate-500">· {act.slotLabel}</span>
                            {act.slotTime && (
                              <span className="text-[11px] text-slate-400">({act.slotTime})</span>
                            )}
                          </div>

                          <div className="text-right text-[11px] text-slate-500">
                            <span>{act.changedByName || "User"}</span> ·{" "}
                            <span>{formatDate(new Date(act.createdAt))}</span>{" "}
                            <span className="text-slate-400">
                              ({formatTimeOnly(act.createdAt)})
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2 text-xs">
                          {/* Master reference */}
                          <div className="rounded-lg border border-slate-200 bg-white/80 p-2.5">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-500 mb-1">
                              <span>Master Timetable (Baseline)</span>
                            </div>
                            <p className="font-semibold text-slate-800">
                              {act.masterSubjectName || act.masterSubjectCode || "Free Period"}
                            </p>
                            {act.masterFacultyName && (
                              <p className="text-slate-600 mt-0.5">Faculty: {act.masterFacultyName}</p>
                            )}
                          </div>

                          {/* Changed to */}
                          <div
                            className={cn(
                              "rounded-lg border p-2.5",
                              isRevert
                                ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                                : "border-rose-300 bg-rose-50 text-rose-950",
                            )}
                          >
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase mb-1">
                              {isRevert ? (
                                <span className="text-emerald-700">Restored Master Values</span>
                              ) : (
                                <span className="text-rose-700">New / Substitute Details</span>
                              )}
                            </div>
                            <p className="font-bold">
                              {isRevert
                                ? act.masterSubjectName || "Master Schedule"
                                : act.newSubjectName || act.newSubjectCode || "Free Period"}
                            </p>
                            <p className="mt-0.5 opacity-90">
                              Faculty:{" "}
                              {isRevert
                                ? act.masterFacultyName || "Master Faculty"
                                : act.newFacultyName || "Not assigned"}
                            </p>
                          </div>
                        </div>

                        {act.remarks && (
                          <div className="mt-2 text-xs text-slate-600 italic">
                            Reason: &ldquo;{act.remarks}&rdquo;
                          </div>
                        )}

                        <div className="mt-3 flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              onSelectDate(act.timetableDate);
                              onClose();
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                          >
                            <span>Open this Date Timetable</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-3">
          <p className="text-xs text-slate-500">
            Selected Date: <strong>{formatDate(fromYMD(selectedDate))}</strong> (
            {DAY_NAMES[fromYMD(selectedDate).getDay()]})
          </p>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Period Comparison & Edit Modal: Displays Actual Period (Master) and Changed Period (Today) side by side in 2 cards.
 * Master Timetable is untouched and used as baseline comparison.
 */
function PeriodEditModal({
  slot,
  date,
  dayLabel,
  masterCell,
  masterEntry,
  currentOverride,
  candidateSlots = [],
  subjects,
  faculty,
  canEdit = true,
  onSave,
  onClose,
}: {
  slot: { id: number; label: string; startTime: string; endTime: string };
  candidateSlots?: Array<{ id: number; label: string; startTime: string; endTime: string; slotType?: string; isAssignable?: boolean }>;
  date: string;
  dayLabel: string;
  masterCell?: SlotCell | null;
  masterEntry: SlotCellEntry | null;
  currentOverride: PeriodOverride | null;
  subjects: PlannerResponse["subjects"];
  faculty: PlannerResponse["faculty"];
  canEdit?: boolean;
  onSave: (payload: {
    override: PeriodOverride | null;
    isRevert: boolean;
    remarks: string;
    slotIds?: number[];
    isMoveSplitToSingle?: boolean;
    masterSubjectName?: string;
    masterFacultyName?: string;
  }) => void;
  onClose: () => void;
}) {
  const masterEntries = useMemo(() => {
    if (masterCell?.entries && masterCell.entries.length > 0) {
      return masterCell.entries;
    }
    return masterEntry ? [masterEntry] : [];
  }, [masterCell, masterEntry]);

  const isMasterSplit = masterEntries.length > 1;

  const currentSlotIndex = useMemo(() => {
    if (!candidateSlots || candidateSlots.length === 0) return -1;
    return candidateSlots.findIndex((s) => s.id === slot.id);
  }, [candidateSlots, slot.id]);

  const subsequentSlots = useMemo(() => {
    if (!candidateSlots || candidateSlots.length === 0 || currentSlotIndex < 0) return [slot];
    return candidateSlots
      .slice(currentSlotIndex)
      .filter((s) => !isNonClassTimingSlot({ label: s.label, slotType: s.slotType ?? "CLASS" }));
  }, [candidateSlots, currentSlotIndex, slot]);

  const [selectedSlotIds, setSelectedSlotIds] = useState<number[]>([slot.id]);

  const isCurrentHoliday = Boolean(
    currentOverride?.remarks?.toLowerCase().includes("holiday") ||
      currentOverride?.customLabel?.toLowerCase().includes("holiday") ||
      currentOverride?.subjectName?.toLowerCase().includes("holiday") ||
      (currentOverride as unknown as { changeType?: string })?.changeType === "HOLIDAY",
  );

  const [periodType, setPeriodType] = useState<"subject" | "special" | "holiday">(() => {
    if (isCurrentHoliday) return "holiday";
    if (currentOverride?.customLabel) return "special";
    if (!currentOverride?.subjectId && masterEntry?.customLabel) return "special";
    return "subject";
  });
  const [customLabel, setCustomLabel] = useState(
    currentOverride?.customLabel || (masterEntry?.customLabel ?? "CRT"),
  );
  const [holidayTitle, setHolidayTitle] = useState(
    isCurrentHoliday
      ? currentOverride?.customLabel || currentOverride?.subjectName || "Holiday"
      : "Declared Holiday",
  );

  const [subjectId, setSubjectId] = useState(
    currentOverride?.subjectId ?? (masterEntry?.subjectId != null ? String(masterEntry.subjectId) : ""),
  );
  const [hrmsEmployeeId, setHrmsEmployeeId] = useState(
    currentOverride?.hrmsEmployeeId ?? (masterEntry?.facultyHrmsId ?? ""),
  );
  const [remarks, setRemarks] = useState(currentOverride?.remarks ?? "");
  const [facultySearch, setFacultySearch] = useState("");
  const [facultyOpen, setFacultyOpen] = useState(false);

  const selectedFaculty = faculty.find((f) => f.hrmsEmployeeId === hrmsEmployeeId);
  const filteredFaculty = useMemo(() => {
    const q = facultySearch.trim().toLowerCase();
    if (q.length < 2) return [];
    return faculty
      .filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.hrmsEmployeeId.toLowerCase().includes(q) ||
          (f.department || "").toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [faculty, facultySearch]);

  const isPeriodModified = Boolean(
    currentOverride &&
      (isMasterSplit ||
        currentOverride.subjectId !== (masterEntry?.subjectId != null ? String(masterEntry.subjectId) : "") ||
        currentOverride.hrmsEmployeeId !== (masterEntry?.facultyHrmsId || "") ||
        (currentOverride.customLabel || "").trim().toLowerCase() !== (masterEntry?.customLabel || "").trim().toLowerCase()),
  );

  const handleSave = () => {
    if (!canEdit) return;
    const fac = faculty.find((f) => f.hrmsEmployeeId === hrmsEmployeeId);

    const masterSplitSubjectSummary = isMasterSplit
      ? `Split: ` +
        masterEntries
          .map(
            (e, idx) =>
              `${e.batchLabel || `Batch ${idx + 1}`}: ${e.customLabel || e.subjectName || e.subjectCode || "Free"}`,
          )
          .join(" | ")
      : undefined;

    const masterSplitFacultySummary = isMasterSplit
      ? masterEntries
          .map((e, idx) => `${e.batchLabel || `B${idx + 1}`}: ${e.facultyName || "None"}`)
          .join(" | ")
      : undefined;

    const autoRemarks =
      remarks.trim() ||
      (isMasterSplit ? "Moved split sections to single class" : "");

    if (periodType === "holiday") {
      const cleanHoliday = holidayTitle.trim() || "Declared Holiday";
      onSave({
        override: {
          slotId: slot.id,
          slotLabel: slot.label,
          slotTime: `${slot.startTime}–${slot.endTime}`,
          subjectId: "",
          subjectCode: "",
          subjectName: cleanHoliday,
          customLabel: cleanHoliday,
          hrmsEmployeeId: "",
          facultyName: "",
          remarks: autoRemarks || `Holiday: ${cleanHoliday}`,
        },
        isRevert: false,
        remarks: autoRemarks || `Holiday: ${cleanHoliday}`,
        slotIds: selectedSlotIds,
        isMoveSplitToSingle: isMasterSplit,
        masterSubjectName: masterSplitSubjectSummary,
        masterFacultyName: masterSplitFacultySummary,
      });
      return;
    }

    if (periodType === "special") {
      const cleanCustom = customLabel.trim();
      if (!cleanCustom && !hrmsEmployeeId && !isMasterSplit) {
        onSave({ override: null, isRevert: true, remarks: autoRemarks, slotIds: selectedSlotIds });
        return;
      }
      onSave({
        override: {
          slotId: slot.id,
          slotLabel: slot.label,
          slotTime: `${slot.startTime}–${slot.endTime}`,
          subjectId: "",
          subjectCode: "",
          subjectName: cleanCustom || "Special Class",
          customLabel: cleanCustom || "Special Class",
          hrmsEmployeeId,
          facultyName: fac?.name ?? "",
          remarks: autoRemarks,
        },
        isRevert: false,
        remarks: autoRemarks,
        slotIds: selectedSlotIds,
        isMoveSplitToSingle: isMasterSplit,
        masterSubjectName: masterSplitSubjectSummary,
        masterFacultyName: masterSplitFacultySummary,
      });
      return;
    }

    const sub = subjects.find((s) => String(s.id) === subjectId);

    // If completely cleared, revert to master
    if (!sub && !hrmsEmployeeId && !isMasterSplit) {
      onSave({ override: null, isRevert: true, remarks: autoRemarks, slotIds: selectedSlotIds });
      return;
    }

    onSave({
      override: {
        slotId: slot.id,
        slotLabel: slot.label,
        slotTime: `${slot.startTime}–${slot.endTime}`,
        subjectId,
        subjectCode: sub?.code ?? "",
        subjectName: sub?.name ?? "",
        hrmsEmployeeId,
        facultyName: fac?.name ?? "",
        remarks: autoRemarks,
      },
      isRevert: false,
      remarks: autoRemarks,
      slotIds: selectedSlotIds,
      isMoveSplitToSingle: isMasterSplit,
      masterSubjectName: masterSplitSubjectSummary,
      masterFacultyName: masterSplitFacultySummary,
    });
  };

  const handleRevert = () => {
    if (!canEdit) return;
    onSave({
      override: null,
      isRevert: true,
      remarks: isMasterSplit
        ? "Reverted to master timetable (restored split sections)"
        : "Reverted to master timetable",
      slotIds: selectedSlotIds,
    });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 md:p-6 backdrop-blur-xs animate-in fade-in duration-150">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Close" />
      <div className="relative z-10 w-full max-w-4xl lg:max-w-5xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200/80 bg-white px-5 sm:px-6 py-4 shrink-0">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-slate-900 text-base sm:text-lg">Period Details ({slot.label})</h3>
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                {slot.startTime}–{slot.endTime}
              </span>
              {isMasterSplit && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700">
                  <Users className="h-3.5 w-3.5 text-indigo-600" />
                  Split Period ({masterEntries.length} Batches)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {dayLabel}, {formatDate(fromYMD(date))}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* Status Banner */}
          {isCurrentHoliday ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-3 text-xs text-amber-950 flex items-start gap-2.5 shadow-2xs">
              <CalendarOff className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Declared Holiday for {formatDate(fromYMD(date))}</p>
                <p className="text-[11.5px] text-amber-800 mt-0.5">
                  This period has been marked as a holiday ({currentOverride?.customLabel || currentOverride?.subjectName || "Holiday"}). Master Timetable remains unchanged.
                </p>
              </div>
            </div>
          ) : isMasterSplit && currentOverride ? (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/80 p-3 text-xs text-indigo-950 flex items-start gap-2.5 shadow-2xs">
              <CheckCircle className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Split Moved to Single Class for {formatDate(fromYMD(date))}</p>
                <p className="text-[11.5px] text-indigo-800 mt-0.5">
                  Master timetable split sections are merged into one combined session for all students on this date. Master Timetable remains unchanged.
                </p>
              </div>
            </div>
          ) : isMasterSplit && !currentOverride ? (
            <div className="rounded-xl border border-indigo-200/80 bg-gradient-to-r from-indigo-50/80 via-blue-50/40 to-slate-50 p-3 text-xs text-indigo-950 flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 shrink-0">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-bold text-indigo-950">
                    Master Timetable runs parallel batches for this slot
                  </p>
                  <p className="text-[11px] text-indigo-800/90 mt-0.5">
                    To merge the batches into one common class today, choose a batch or custom subject in the Changed Period panel.
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-md bg-indigo-200/80 px-2 py-0.5 text-[10.5px] font-bold text-indigo-900">
                {masterEntries.length} Parallel Batches
              </span>
            </div>
          ) : isPeriodModified ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-900 flex items-start gap-2.5 shadow-2xs">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Period Modified for {formatDate(fromYMD(date))}</p>
                <p className="text-[11.5px] text-rose-700 mt-0.5">
                  This class has been altered from the Master Timetable schedule for today. Master Timetable remains unchanged.
                </p>
              </div>
            </div>
          ) : null}

          {/* Multi-Period Range Selector (allows editing P7, P8, P9 together) */}
          {subsequentSlots.length > 1 && canEdit && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-600" />
                  <span className="text-xs font-bold text-slate-800">
                    Apply change to multiple periods on {dayLabel}:
                  </span>
                  <span className="rounded bg-navy-100 text-navy-900 px-1.5 py-0.2 text-[10.5px] font-bold">
                    {selectedSlotIds.length} Period{selectedSlotIds.length > 1 ? "s" : ""}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {[1, 2, 3].map((count) => {
                    if (subsequentSlots.length < count) return null;
                    const isCurrent = selectedSlotIds.length === count;
                    return (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setSelectedSlotIds(subsequentSlots.slice(0, count).map((s) => s.id))}
                        className={cn(
                          "rounded-md px-2.5 py-0.5 text-[11px] font-bold transition-all border cursor-pointer",
                          isCurrent
                            ? "bg-navy-900 text-white border-navy-900 shadow-xs"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100",
                        )}
                      >
                        {count} Period{count > 1 ? "s" : ""}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {subsequentSlots.slice(0, 8).map((cSlot) => {
                  const isSelected = selectedSlotIds.includes(cSlot.id);
                  const isBase = cSlot.id === slot.id;
                  return (
                    <button
                      key={cSlot.id}
                      type="button"
                      onClick={() => {
                        if (isBase) return;
                        const clickedIdx = subsequentSlots.findIndex((s) => s.id === cSlot.id);
                        if (isSelected) {
                          setSelectedSlotIds(subsequentSlots.slice(0, clickedIdx).map((s) => s.id));
                        } else {
                          setSelectedSlotIds(subsequentSlots.slice(0, clickedIdx + 1).map((s) => s.id));
                        }
                      }}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all border cursor-pointer",
                        isSelected
                          ? "bg-navy-900 text-white border-navy-900 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                      )}
                    >
                      <span className="font-bold">{cSlot.label}</span>
                      <span className="text-[10px] opacity-75">({cSlot.startTime})</span>
                      {isSelected ? <Check className="h-3 w-3 ml-0.5" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* SIDE-BY-SIDE 2 CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {/* CARD 1: Actual Period (Master Timetable Baseline) */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/80">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Actual Period</h4>
                      <p className="text-[11px] text-slate-500">Master Timetable Baseline</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-200/80 text-slate-700 border border-slate-300">
                    {isMasterSplit ? `Split (${masterEntries.length} Batches)` : "Master Baseline"}
                  </span>
                </div>

                {isMasterSplit ? (
                  <div className="space-y-3">
                    {masterEntries.map((ent, eIdx) => {
                      const bLabel = ent.batchLabel || `Batch ${eIdx + 1}`;
                      return (
                        <div key={eIdx} className="rounded-xl border border-slate-200 bg-white p-3 space-y-1.5 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="rounded bg-navy-950 text-white font-bold px-2 py-0.5 text-[9.5px] uppercase tracking-wider">
                              {bLabel}
                            </span>
                            {ent.roomLabel && (
                              <span className="text-[10.5px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                                Room: {ent.roomLabel}
                              </span>
                            )}
                          </div>
                          <div>
                            <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">Subject</span>
                            <p className="text-xs font-bold text-slate-900 mt-0.5">
                              {ent.customLabel || ent.subjectName || ent.subjectCode || "Free / Unassigned"}
                            </p>
                            {ent.subjectCode && ent.subjectCode !== ent.subjectName && (
                              <p className="text-[11px] text-slate-500 font-medium">Code: {ent.subjectCode}</p>
                            )}
                          </div>
                          <div className="pt-1 border-t border-slate-100 flex items-center justify-between">
                            <div>
                              <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">Faculty</span>
                              <p className="text-xs font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                                <User className="h-3 w-3 text-slate-400 shrink-0" />
                                <span>{ent.facultyName || "No faculty assigned"}</span>
                              </p>
                            </div>
                            {ent.facultyHrmsId && (
                              <span className="text-[10px] text-slate-400 font-medium self-end">
                                ID: {ent.facultyHrmsId}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    <div className="pt-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Timing & Slot</span>
                      <p className="text-xs font-semibold text-slate-700 mt-0.5">
                        {slot.label} · {slot.startTime}–{slot.endTime}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Scheduled Subject</span>
                      <p className="text-sm font-bold text-slate-900 mt-0.5">
                        {masterEntry?.customLabel || masterEntry?.subjectName || masterEntry?.subjectCode || "Free / Unassigned Period"}
                      </p>
                      {masterEntry?.subjectCode && masterEntry.subjectCode !== masterEntry.subjectName && (
                        <p className="text-xs text-slate-500 mt-0.5 font-medium">Code: {masterEntry.subjectCode}</p>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned Faculty</span>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5 flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        <span>{masterEntry?.facultyName || "No faculty assigned"}</span>
                      </p>
                      {masterEntry?.facultyHrmsId && (
                        <p className="text-xs text-slate-500 mt-0.5 ml-5">ID: {masterEntry.facultyHrmsId}</p>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Timing & Slot</span>
                      <p className="text-xs font-semibold text-slate-700 mt-0.5">
                        {slot.label} · {slot.startTime}–{slot.endTime}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200/80 text-[11px] text-slate-500 flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>Master timetable baseline cannot be modified here.</span>
              </div>
            </div>

            {/* CARD 2: Changed Period (Today's Schedule) */}
            <div
              className={cn(
                "rounded-2xl border p-4 sm:p-5 flex flex-col justify-between space-y-4 shadow-xs",
                isPeriodModified
                  ? "border-rose-300 bg-rose-50/40"
                  : isMasterSplit
                  ? "border-indigo-200 bg-indigo-50/20"
                  : "border-slate-200 bg-white",
              )}
            >
              <div>
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/80">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        "p-1.5 rounded-lg",
                        isPeriodModified ? "bg-rose-100 text-rose-700" : "bg-indigo-100 text-indigo-700",
                      )}
                    >
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Changed Period</h4>
                      <p className="text-[11px] text-slate-500">{formatDate(fromYMD(date))} Schedule</p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border",
                      isMasterSplit
                        ? currentOverride
                          ? "bg-indigo-100 text-indigo-900 border-indigo-300"
                          : "bg-indigo-50 text-indigo-800 border-indigo-200"
                        : isPeriodModified
                        ? "bg-rose-100 text-rose-800 border-rose-200"
                        : "bg-slate-100 text-slate-700 border-slate-200",
                    )}
                  >
                    {isMasterSplit
                      ? currentOverride
                        ? "Single (Combined)"
                        : "Move Split to Single"
                      : isPeriodModified
                      ? "Changed"
                      : "Matches Master"}
                  </span>
                </div>

                {canEdit ? (
                  <div className="space-y-3.5">
                    {/* When master is split, render the Move Split to Single quick-actions panel */}
                    {isMasterSplit && (
                      <div className="rounded-xl border border-indigo-200/90 bg-gradient-to-b from-indigo-50/70 to-white p-3.5 space-y-2.5 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <div className="p-1 rounded-md bg-indigo-100 text-indigo-700">
                              <ArrowRightLeft className="h-3.5 w-3.5" />
                            </div>
                            <span className="text-xs font-bold text-indigo-950">
                              Move Split to Single Class
                            </span>
                          </div>
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[9.5px] font-bold text-indigo-900 uppercase tracking-wider">
                            Quick Pick
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-600 leading-snug">
                          Select a batch schedule to apply to all students today, or customize below:
                        </p>

                        <div className="grid grid-cols-1 gap-2 pt-0.5">
                          {masterEntries.map((ent, idx) => {
                            const bLabel = ent.batchLabel || `Batch ${idx + 1}`;
                            const subTitle = ent.customLabel || ent.subjectName || ent.subjectCode || `Batch ${idx + 1}`;
                            const isSelected =
                              (ent.customLabel
                                ? periodType === "special" && customLabel.trim().toUpperCase() === ent.customLabel.trim().toUpperCase()
                                : periodType === "subject" && ent.subjectId != null && String(ent.subjectId) === subjectId) &&
                              hrmsEmployeeId === (ent.facultyHrmsId || "");

                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  if (ent.customLabel) {
                                    setPeriodType("special");
                                    setCustomLabel(ent.customLabel);
                                    setSubjectId("");
                                  } else {
                                    setPeriodType("subject");
                                    setSubjectId(ent.subjectId ? String(ent.subjectId) : "");
                                    setCustomLabel("");
                                  }
                                  setHrmsEmployeeId(ent.facultyHrmsId || "");
                                  setFacultySearch("");
                                  setFacultyOpen(false);
                                  setRemarks(
                                    remarks.trim() && !remarks.includes("Moved split")
                                      ? remarks
                                      : `Moved split to single class (${bLabel} schedule applied to all students)`
                                  );
                                }}
                                className={cn(
                                  "w-full flex items-center justify-between rounded-xl border p-2.5 text-left transition-all cursor-pointer",
                                  isSelected
                                    ? "border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-200/70 shadow-xs"
                                    : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50/80 shadow-2xs",
                                )}
                              >
                                <div className="min-w-0 flex-1 pr-2">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span
                                      className={cn(
                                        "rounded px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider",
                                        isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700 border border-slate-200",
                                      )}
                                    >
                                      {bLabel}
                                    </span>
                                    <span className="text-xs font-bold text-slate-900 truncate">
                                      {subTitle}
                                    </span>
                                  </div>
                                  {ent.facultyName && (
                                    <p className="text-[11px] text-slate-600 truncate flex items-center gap-1">
                                      <User className="h-2.5 w-2.5 text-slate-400" />
                                      <span>{ent.facultyName}</span>
                                      {ent.facultyHrmsId && <span className="text-slate-400">({ent.facultyHrmsId})</span>}
                                    </p>
                                  )}
                                </div>
                                <div
                                  className={cn(
                                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all",
                                    isSelected
                                      ? "border-indigo-600 bg-indigo-600 text-white"
                                      : "border-slate-300 bg-white text-transparent",
                                  )}
                                >
                                  <Check className="h-3 w-3 stroke-[3]" />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Period Mode Selector: Subject vs Special Class vs Holiday */}
                    <div>
                      <div className="flex rounded-xl border border-slate-200 bg-slate-100/90 p-1 text-xs mb-3">
                        <button
                          type="button"
                          onClick={() => setPeriodType("subject")}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-center font-bold transition-all cursor-pointer",
                            periodType === "subject"
                              ? "bg-white text-navy-900 shadow-xs"
                              : "text-slate-600 hover:text-slate-900",
                          )}
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                          <span>Subject Class</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPeriodType("special")}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-center font-bold transition-all cursor-pointer",
                            periodType === "special"
                              ? "bg-white text-purple-900 shadow-xs ring-1 ring-purple-200"
                              : "text-slate-600 hover:text-slate-900",
                          )}
                        >
                          <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                          <span>Special Class</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPeriodType("holiday")}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-center font-bold transition-all cursor-pointer",
                            periodType === "holiday"
                              ? "bg-white text-amber-900 shadow-xs ring-1 ring-amber-300"
                              : "text-slate-600 hover:text-slate-900",
                          )}
                        >
                          <CalendarOff className="h-3.5 w-3.5 text-amber-600" />
                          <span>Holiday</span>
                        </button>
                      </div>

                      {periodType === "holiday" ? (
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-amber-900 mb-1">
                            Holiday Title / Occasion
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Festival Holiday, Sports Day, Special Leave…"
                            value={holidayTitle}
                            onChange={(e) => setHolidayTitle(e.target.value)}
                            className="h-10 w-full rounded-xl border border-amber-300 bg-white px-3 text-xs font-bold text-amber-950 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 mb-2"
                          />
                        </div>
                      ) : periodType === "subject" ? (
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                            Subject for {formatDate(fromYMD(date))}
                          </label>
                          <select
                            className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer"
                            value={subjectId}
                            onChange={(e) => setSubjectId(e.target.value)}
                          >
                            <option value="">— Free / Unassigned Period —</option>
                            {subjects.map((s) => (
                              <option key={s.id} value={String(s.id)}>
                                {s.code} — {s.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-purple-900 mb-1">
                            Special Class / Custom Label
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. CRT, LIBRARY, SPORTS…"
                            value={customLabel}
                            onChange={(e) => setCustomLabel(e.target.value.toUpperCase())}
                            className="h-10 w-full rounded-xl border border-purple-300 bg-white px-3 text-xs font-bold text-purple-950 uppercase outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 mb-2"
                          />
                          <div className="flex flex-wrap gap-1">
                            {["CRT", "LIBRARY", "SPORTS", "SEMINAR", "PLACEMENT", "PROJECT", "MENTORING", "FREE"].map((lbl) => (
                              <button
                                key={lbl}
                                type="button"
                                onClick={() => setCustomLabel(lbl)}
                                className={cn(
                                  "rounded-md px-2 py-0.5 text-[10.5px] font-bold transition-all border cursor-pointer",
                                  customLabel === lbl
                                    ? "bg-purple-700 text-white border-purple-700 shadow-xs"
                                    : "bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100",
                                )}
                              >
                                {lbl}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Faculty Selector */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Staff / Faculty for {formatDate(fromYMD(date))}
                      </label>
                      {selectedFaculty && !facultyOpen ? (
                        <div className="flex items-center justify-between rounded-xl border border-indigo-200 bg-white p-2.5 text-xs shadow-2xs">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 shrink-0">
                              <User className="h-3.5 w-3.5" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{selectedFaculty.name}</p>
                              <p className="text-[10px] text-slate-500">
                                {selectedFaculty.hrmsEmployeeId} {selectedFaculty.department ? `· ${selectedFaculty.department}` : ""}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline px-2 py-1 rounded cursor-pointer"
                            onClick={() => {
                              setHrmsEmployeeId("");
                              setFacultySearch("");
                              setFacultyOpen(true);
                            }}
                          >
                            Change
                          </button>
                        </div>
                      ) : (
                        <div className="relative">
                          <div className="relative rounded-xl border border-slate-300 bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                            <input
                              type="search"
                              className="h-10 w-full pl-9 pr-3 text-xs outline-none rounded-xl"
                              placeholder="Type to search faculty name or ID…"
                              value={facultySearch}
                              autoFocus={facultyOpen}
                              onChange={(e) => {
                                setFacultySearch(e.target.value);
                                setFacultyOpen(true);
                              }}
                            />
                          </div>
                          {filteredFaculty.length > 0 && (
                            <ul className="absolute top-full left-0 right-0 z-30 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl divide-y divide-slate-100">
                              {filteredFaculty.map((f) => (
                                <li key={f.hrmsEmployeeId}>
                                  <button
                                    type="button"
                                    className="w-full px-3 py-2 text-left text-xs hover:bg-indigo-50/70 transition-colors cursor-pointer flex items-center justify-between"
                                    onClick={() => {
                                      setHrmsEmployeeId(f.hrmsEmployeeId);
                                      setFacultySearch("");
                                      setFacultyOpen(false);
                                    }}
                                  >
                                    <div>
                                      <span className="font-bold text-slate-800">{f.name}</span>
                                      {f.department && <span className="ml-1.5 text-[10.5px] text-slate-500">· {f.department}</span>}
                                    </div>
                                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                      {f.hrmsEmployeeId}
                                    </span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Remarks */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Reason / Activity Remarks (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Moved split to single class, Special combined lab"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        className="h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Subject</span>
                      <p className="text-sm font-bold text-slate-900 mt-0.5">
                        {currentOverride?.subjectName || currentOverride?.subjectCode || masterEntry?.subjectName || "Free Period"}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Faculty</span>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5 flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        <span>{currentOverride?.facultyName || masterEntry?.facultyName || "No faculty assigned"}</span>
                      </p>
                    </div>
                    {currentOverride?.remarks && (
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Remarks</span>
                        <p className="text-xs text-slate-600 italic mt-0.5">{currentOverride.remarks}</p>
                      </div>
                    )}
                    {currentOverride?.changedByName && (
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Last Changed By</span>
                        <p className="text-xs text-slate-600 mt-0.5">{currentOverride.changedByName}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200/80 text-[11px] text-slate-500">
                {canEdit ? (
                  <span>Affects {formatDate(fromYMD(date))} only and will be logged in Activity.</span>
                ) : (
                  <span className="text-amber-700 font-medium">View only. Changes cannot be made.</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200/80 bg-slate-50/90 px-5 sm:px-6 py-3.5 shrink-0">
          {canEdit && currentOverride ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              onClick={handleRevert}
            >
              <RotateCcw className="h-3.5 w-3.5 text-rose-600" />
              <span>
                {isMasterSplit
                  ? "Revert to Master Timetable (Restore Split Batches)"
                  : "Revert to Master Timetable"}
              </span>
            </button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all cursor-pointer shadow-2xs"
            >
              {canEdit ? "Cancel" : "Close"}
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={handleSave}
                className="h-9 px-4.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                {isMasterSplit && !currentOverride ? (
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                <span>
                  {isMasterSplit && !currentOverride
                    ? selectedSlotIds.length > 1
                      ? `Move Split to Single (${selectedSlotIds.length} Periods)`
                      : "Move Split to Single Class"
                    : selectedSlotIds.length > 1
                    ? `Save Changed Periods (${selectedSlotIds.length})`
                    : "Save Change"}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

}

type PeriodSlotItem = {
  id: number;
  label: string;
  startTime: string;
  endTime: string;
  slotType: string;
  isAssignable: boolean;
  isActive?: boolean;
};

/**
 * Period Grid for Today Timetable:
 * - Desktop: Unified header row and period cards row spanning 100% width without horizontal scrolling!
 * - Mobile & Tablet: Responsive card grid that wraps cleanly into columns without horizontal scrolling!
 * - Beautiful aesthetic matching the Master Timetable period grid (Image 1).
 */
function TodayPeriodGrid({
  slots,
  getMasterCell,
  getOverride,
  isChanged,
  onSlotClick,
}: {
  slots: PeriodSlotItem[];
  getMasterCell: (slotId: number) => SlotCell | null;
  getOverride: (slotId: number) => PeriodOverride | null;
  isChanged: (slotId: number) => boolean;
  onSlotClick: (
    slot: { id: number; label: string; startTime: string; endTime: string },
    masterCell: SlotCell | null,
    masterEntry: SlotCellEntry | null,
  ) => void;
}) {
  if (slots.length === 0) return null;

  return (
    <div className="w-full">
      {/* 1. DESKTOP GRID VIEW (Visible on lg and above, hidden on smaller screens):
             Headers on top, cards aligned below. Columns fit 100% width with NO horizontal scroll! */}
      <div className="hidden lg:block w-full">
        {/* Column Headers Row */}
        <div
          className="grid gap-2.5 w-full text-center mb-2.5"
          style={{ gridTemplateColumns: `repeat(${slots.length}, minmax(0, 1fr))` }}
        >
          {slots.map((slot) => {
            const isBreak = isNonClassTimingSlot(slot);
            return (
              <div
                key={`hdr-${slot.id}`}
                className={cn(
                  "flex flex-col items-center justify-center rounded-xl px-2 py-2 border text-center transition-colors",
                  isBreak
                    ? "bg-slate-100/90 border-slate-200/90 text-slate-600"
                    : "bg-slate-50/90 border-slate-200/80 text-slate-700"
                )}
              >
                <span className="text-xs font-bold uppercase tracking-wide truncate w-full">
                  {isBreak ? timingSlotDisplayLabel(slot) : slot.label}
                </span>
                <span className="text-[10px] font-medium text-slate-400 mt-0.5 truncate w-full">
                  {isBreak && slot.label && !slot.label.toLowerCase().includes("break") ? `${slot.label} · ` : ""}
                  {slot.startTime}–{slot.endTime}
                </span>
              </div>
            );
          })}
        </div>

        {/* Period Cards Row */}
        <div
          className="grid gap-2.5 w-full items-stretch"
          style={{ gridTemplateColumns: `repeat(${slots.length}, minmax(0, 1fr))` }}
        >
          {slots.map((slot) => {
            const isBreak = isNonClassTimingSlot(slot);
            const masterCell = getMasterCell(slot.id);
            const masterEntries =
              masterCell?.entries && masterCell.entries.length > 0
                ? masterCell.entries
                : masterCell?.entry
                ? [masterCell.entry]
                : [];
            const masterEntry = masterEntries[0] ?? null;
            const isMultiBatch = masterEntries.length > 1;
            const override = getOverride(slot.id);
            const changed = isChanged(slot.id);

            const displaySubjectName =
              override?.customLabel ||
              override?.subjectName ||
              masterEntry?.customLabel ||
              masterEntry?.subjectName ||
              masterEntry?.subjectCode;
            const displaySubjectCode =
              override?.subjectCode ||
              (masterEntry?.subjectCode && masterEntry.subjectCode !== masterEntry.subjectName
                ? masterEntry.subjectCode
                : null);
            const displayFacultyName =
              override?.facultyName || masterEntry?.facultyName;
            const hasContent = Boolean(displaySubjectName || displayFacultyName);
            const isLunchBreak =
              isBreak &&
              (slot.slotType === "LUNCH" || timingSlotDisplayLabel(slot) === "Lunch Break");
            const isSpecial = Boolean(override?.customLabel || masterEntry?.customLabel);

            if (isBreak) {
              if (isLunchBreak) {
                return (
                  <div
                    key={slot.id}
                    className="flex flex-col items-center justify-center rounded-xl border border-amber-200 bg-amber-50/70 p-2.5 text-center min-h-[110px]"
                  >
                    <span className="text-xs font-bold text-amber-900 leading-tight">
                      Lunch Break
                    </span>
                    <span className="text-[10px] text-amber-700/80 mt-1 font-medium">
                      {slot.startTime}–{slot.endTime}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={slot.id}
                  className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 text-center min-h-[110px]"
                >
                  <span className="text-xs font-bold text-slate-700 leading-tight">
                    {timingSlotDisplayLabel(slot)}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1 font-medium">
                    {slot.startTime}–{slot.endTime}
                  </span>
                </div>
              );
            }

            if (isSpecial && !changed) {
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => onSlotClick(slot, masterCell, masterEntry)}
                  className="group relative flex flex-col justify-between rounded-xl border border-purple-200 bg-purple-50/50 p-2.5 text-left min-h-[110px] shadow-2xs hover:shadow-md hover:border-purple-300 transition-all cursor-pointer"
                  title={`Click to view details for ${slot.label}`}
                >
                  <div>
                    <span className="text-xs font-bold uppercase text-purple-900 block truncate" title={masterEntry?.customLabel || "Special"}>
                      {masterEntry?.customLabel}
                    </span>
                    <span className="text-[10.5px] font-medium text-purple-600 block mt-0.5">
                      Free / Special
                    </span>
                  </div>
                  {masterEntry?.facultyName && (
                    <span className="text-[10.5px] font-medium text-slate-600 truncate block mt-auto pt-1" title={masterEntry.facultyName}>
                      {masterEntry.facultyName}
                    </span>
                  )}
                  <div className="flex items-center justify-between mt-auto pt-1 border-t border-purple-100/60">
                    <span className="text-[9px] font-semibold text-purple-700">Special</span>
                    <Edit2 className="h-3 w-3 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              );
            }

            const isHoliday = Boolean(
              override?.remarks?.toLowerCase().includes("holiday") ||
                override?.customLabel?.toLowerCase().includes("holiday") ||
                override?.subjectName?.toLowerCase().includes("holiday") ||
                override?.subjectCode?.toLowerCase().includes("holiday") ||
                (override as unknown as { changeType?: string })?.changeType === "HOLIDAY",
            );

            if (isHoliday) {
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => onSlotClick(slot, masterCell, masterEntry)}
                  className="group relative flex flex-col justify-between rounded-xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50/70 p-2.5 text-left min-h-[110px] shadow-2xs hover:shadow-md hover:border-amber-400 ring-1 ring-amber-200 transition-all cursor-pointer"
                  title={`Holiday declared: ${displaySubjectName || "Holiday"}`}
                >
                  <div>
                    <div className="flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider text-amber-800 mb-1">
                      <CalendarOff className="h-3 w-3 text-amber-600" />
                      <span>Holiday Declared</span>
                    </div>
                    <p
                      className="text-xs font-bold uppercase leading-snug line-clamp-2 text-amber-950"
                      title={displaySubjectName || "Holiday"}
                    >
                      {displaySubjectName || "Holiday"}
                    </p>
                    {override?.remarks && override.remarks !== displaySubjectName && (
                      <p
                        className="text-[10px] text-amber-800/80 mt-1 line-clamp-2 font-medium"
                        title={override.remarks}
                      >
                        {override.remarks}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-auto pt-1.5 border-t border-amber-200">
                    <span className="inline-flex items-center gap-1 rounded bg-amber-200/80 px-1.5 py-0.2 text-[9px] font-extrabold text-amber-900 border border-amber-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-600 animate-pulse" />
                      <span>Holiday</span>
                    </span>
                    <Edit2 className="h-3 w-3 text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              );
            }

            return (
              <button
                key={slot.id}
                type="button"
                onClick={() => onSlotClick(slot, masterCell, masterEntry)}
                className={cn(
                  "group relative flex flex-col justify-between rounded-xl border p-2.5 text-left min-h-[110px] shadow-2xs transition-all cursor-pointer",
                  !hasContent
                    ? "border-slate-200 bg-slate-50/40 hover:border-slate-300 hover:bg-slate-100/60"
                    : changed
                    ? "border-rose-300 bg-rose-50/60 hover:border-rose-400 hover:shadow-md ring-1 ring-rose-200/80"
                    : "border-slate-200/90 bg-white hover:border-indigo-400 hover:shadow-md"
                )}
                title={`Click to view comparison and details for ${slot.label}`}
              >
                {!hasContent ? (
                  <div className="flex flex-col items-center justify-center h-full w-full my-auto text-center">
                    <span className="text-xs text-slate-400 italic">Free Period</span>
                  </div>
                ) : isMultiBatch && !override ? (
                  <div className="w-full space-y-1.5 divide-y divide-slate-100">
                    {masterEntries.map((ent, eIdx) => (
                      <div key={eIdx} className={cn("text-left", eIdx > 0 ? "pt-1" : "")}>
                        <div className="flex items-center gap-1">
                          <span className="rounded bg-navy-100 text-navy-800 font-bold px-1 py-0.2 text-[8.5px] uppercase">
                            {ent.batchLabel || `B${eIdx + 1}`}
                          </span>
                          <span className="text-xs font-bold text-navy-900 truncate" title={ent.subjectName || ent.subjectCode || ""}>
                            {ent.subjectName || ent.subjectCode}
                          </span>
                        </div>
                        {ent.facultyName && (
                          <span className="text-[10px] text-slate-600 truncate block mt-0.5" title={ent.facultyName}>
                            {ent.facultyName}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div>
                    {isMultiBatch && override && (
                      <span className="mb-1 inline-flex items-center gap-1 rounded bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 text-[8px] font-bold text-indigo-900 uppercase">
                        Single (Combined)
                      </span>
                    )}
                    <p
                      className={cn(
                        "text-xs font-bold uppercase leading-snug line-clamp-2",
                        changed ? "text-rose-950" : "text-navy-900"
                      )}
                      title={displaySubjectName || ""}
                    >
                      {displaySubjectName || "Unassigned"}
                    </p>
                    {displaySubjectCode && (
                      <p className="text-[10.5px] font-medium text-slate-500 mt-0.5 truncate" title={displaySubjectCode}>
                        {displaySubjectCode}
                      </p>
                    )}
                    {displayFacultyName && (
                      <p
                        className={cn(
                          "text-[10.5px] font-semibold mt-1 truncate",
                          changed ? "text-rose-800" : "text-slate-700"
                        )}
                        title={displayFacultyName}
                      >
                        {displayFacultyName}
                      </p>
                    )}
                  </div>
                )}

                {/* Bottom row: status indicator */}
                <div className="flex items-center justify-between mt-auto pt-1.5 border-t border-slate-100/80">
                  {changed ? (
                    <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.2 text-[9px] font-extrabold text-rose-700 border border-rose-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                      <span>{isMultiBatch ? "Single · Changed" : "Changed"}</span>
                    </span>
                  ) : isMultiBatch ? (
                    <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-indigo-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                      <span>Split ({masterEntries.length} Batches)</span>
                    </span>
                  ) : hasContent ? (
                    <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span>Actual</span>
                    </span>
                  ) : (
                    <span className="text-[9px] text-slate-400">Available</span>
                  )}
                  <Edit2
                    className={cn(
                      "h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity",
                      changed ? "text-rose-600" : "text-indigo-600"
                    )}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. RESPONSIVE MOBILE / TABLET VIEW (Visible on screens < 1024px, hidden on lg and above):
             Wraps cleanly into 2 or 3 responsive columns, so mobile users NEVER have to scroll horizontally! */}
      <div className="block lg:hidden w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 w-full">
          {slots.map((slot) => {
            const isBreak = isNonClassTimingSlot(slot);
            const masterCell = getMasterCell(slot.id);
            const masterEntries =
              masterCell?.entries && masterCell.entries.length > 0
                ? masterCell.entries
                : masterCell?.entry
                ? [masterCell.entry]
                : [];
            const masterEntry = masterEntries[0] ?? null;
            const isMultiBatch = masterEntries.length > 1;
            const override = getOverride(slot.id);
            const changed = isChanged(slot.id);

            const displaySubjectName =
              override?.customLabel ||
              override?.subjectName ||
              masterEntry?.customLabel ||
              masterEntry?.subjectName ||
              masterEntry?.subjectCode;
            const displaySubjectCode =
              override?.subjectCode ||
              (masterEntry?.subjectCode && masterEntry.subjectCode !== masterEntry.subjectName
                ? masterEntry.subjectCode
                : null);
            const displayFacultyName =
              override?.facultyName || masterEntry?.facultyName;
            const hasContent = Boolean(displaySubjectName || displayFacultyName);
            const isLunchBreak =
              isBreak &&
              (slot.slotType === "LUNCH" || timingSlotDisplayLabel(slot) === "Lunch Break");

            if (isBreak) {
              return (
                <div
                  key={slot.id}
                  className={cn(
                    "rounded-xl border p-3 flex flex-col justify-between text-center min-h-[90px]",
                    isLunchBreak
                      ? "bg-amber-50/70 border-amber-200"
                      : "bg-slate-50/80 border-slate-200"
                  )}
                >
                  <div className="flex items-center justify-between border-b border-black/5 pb-1 mb-1.5 text-xs text-slate-500">
                    <span className="font-bold">{timingSlotDisplayLabel(slot)}</span>
                    <span className="text-[10px]">{slot.startTime}–{slot.endTime}</span>
                  </div>
                  <span className={cn("text-xs font-bold", isLunchBreak ? "text-amber-900" : "text-slate-700")}>
                    {timingSlotDisplayLabel(slot)}
                  </span>
                </div>
              );
            }

            const isHolidayMobile = Boolean(
              override?.remarks?.toLowerCase().includes("holiday") ||
                override?.customLabel?.toLowerCase().includes("holiday") ||
                override?.subjectName?.toLowerCase().includes("holiday") ||
                override?.subjectCode?.toLowerCase().includes("holiday") ||
                (override as unknown as { changeType?: string })?.changeType === "HOLIDAY",
            );

            if (isHolidayMobile) {
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => onSlotClick(slot, masterCell, masterEntry)}
                  className="rounded-xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50/70 p-3 flex flex-col justify-between text-left min-h-[96px] shadow-2xs hover:shadow-md ring-1 ring-amber-200 transition-all cursor-pointer"
                >
                  <div>
                    <div className="flex items-center justify-between border-b border-amber-200/60 pb-1.5 mb-1.5">
                      <span className="text-xs font-bold uppercase tracking-wide text-amber-900 flex items-center gap-1">
                        <CalendarOff className="h-3.5 w-3.5 text-amber-600" />
                        <span>{slot.label}</span>
                      </span>
                      <span className="text-[10px] font-medium text-amber-800 bg-amber-200/60 px-1.5 py-0.5 rounded">
                        {slot.startTime}–{slot.endTime}
                      </span>
                    </div>
                    <p className="text-xs font-bold uppercase text-amber-950 line-clamp-2">
                      {displaySubjectName || "Holiday"}
                    </p>
                    {override?.remarks && (
                      <p className="text-[10px] text-amber-800 mt-0.5 line-clamp-1">{override.remarks}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-amber-200/60">
                    <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-amber-900">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-600 animate-pulse" />
                      Holiday Declared
                    </span>
                    <Edit2 className="h-3 w-3 text-amber-600" />
                  </div>
                </button>
              );
            }

            return (
              <button
                key={slot.id}
                type="button"
                onClick={() => onSlotClick(slot, masterCell, masterEntry)}
                className={cn(
                  "rounded-xl border p-3 flex flex-col justify-between text-left min-h-[96px] shadow-2xs hover:shadow-md transition-all cursor-pointer",
                  changed
                    ? "border-rose-300 bg-rose-50/60 ring-1 ring-rose-200"
                    : (masterEntry?.customLabel && !changed)
                    ? "border-purple-200 bg-purple-50/40"
                    : "border-slate-200 bg-white"
                )}
              >
                <div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-1.5">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-800">
                      {slot.label}
                    </span>
                    <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      {slot.startTime}–{slot.endTime}
                    </span>
                  </div>

                  {masterEntry?.customLabel && !changed ? (
                    <div>
                      <p className="text-xs font-bold uppercase text-purple-900">
                        {masterEntry.customLabel}
                      </p>
                      <p className="text-[10px] text-purple-600 mt-0.5">Free / Special</p>
                    </div>
                  ) : isMultiBatch && !override ? (
                    <div className="w-full space-y-1 divide-y divide-slate-100">
                      {masterEntries.map((ent, eIdx) => (
                        <div key={eIdx} className={cn("text-left", eIdx > 0 ? "pt-1" : "")}>
                          <div className="flex items-center gap-1">
                            <span className="rounded bg-navy-100 text-navy-800 font-bold px-1 py-0.2 text-[8px] uppercase">
                              {ent.batchLabel || `B${eIdx + 1}`}
                            </span>
                            <span className="text-xs font-bold text-navy-900 truncate" title={ent.subjectName || ent.subjectCode || ""}>
                              {ent.subjectName || ent.subjectCode}
                            </span>
                          </div>
                          {ent.facultyName && (
                            <span className="text-[10px] text-slate-600 truncate block mt-0.5">
                              {ent.facultyName}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : hasContent ? (
                    <div>
                      {isMultiBatch && override && (
                        <span className="mb-1 inline-flex items-center gap-1 rounded bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 text-[8px] font-bold text-indigo-900 uppercase">
                          Single (Combined)
                        </span>
                      )}
                      <p className="text-xs font-bold uppercase text-navy-900 line-clamp-2">
                        {displaySubjectName || "Unassigned"}
                      </p>
                      {displaySubjectCode && (
                        <p className="text-[10px] text-slate-500 mt-0.5">{displaySubjectCode}</p>
                      )}
                      {displayFacultyName && (
                        <p className="text-[10px] font-semibold text-slate-700 mt-1 truncate">
                          {displayFacultyName}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Free Period</p>
                  )}
                </div>

                <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100">
                  {changed ? (
                    <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-rose-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                      <span>{isMultiBatch ? "Single · Changed" : "Changed"}</span>
                    </span>
                  ) : isMultiBatch ? (
                    <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-indigo-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                      <span>Split ({masterEntries.length} Batches)</span>
                    </span>
                  ) : hasContent ? (
                    <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span>Actual</span>
                    </span>
                  ) : (
                    <span className="text-[9px] text-slate-400">Available</span>
                  )}
                  <Edit2 className="h-3 w-3 text-slate-400" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function TodayTimetableView() {
  const { filters, masters, setFilters } = useAcademicContext();
  const { authorization, hasPermission } = useAuth();

  // Role Access Control: Super Admin or users with 'today_timetable.edit' permission (or legacy roles)
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

  const isSuperAdmin = useMemo(() => {
    return (
      userRoles.includes("super_admin") ||
      userRoles.includes("superadmin") ||
      Boolean(authorization?.scope?.isGlobal)
    );
  }, [userRoles, authorization]);

  const canChangeTimetable = useMemo(() => {
    if (isSuperAdmin) return true;
    if (hasPermission("today_timetable.edit")) return true;
    const allowedRoles = [
      "principal",
      "vice_principal",
      "viceprincipal",
      "hod",
      "hods",
    ];
    return allowedRoles.some((role) => userRoles.includes(role));
  }, [isSuperAdmin, hasPermission, userRoles]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(toYMD(today));
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [giveHolidayModalOpen, setGiveHolidayModalOpen] = useState(false);

  const [planner, setPlanner] = useState<PlannerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Student list resolution info
  const [studentProgressInfo, setStudentProgressInfo] = useState<{
    year: number;
    semester: number;
    studentCount: number;
  } | null>(null);

  // Overrides for the currently selected date: slotId -> PeriodOverride
  const [overrides, setOverrides] = useState<Record<number, PeriodOverride>>({});
  // List of all dates that have activity
  const [datesWithActivity, setDatesWithActivity] = useState<string[]>([]);
  // Full activity list for observing previous details
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  // All Batches mode data: running cohorts in current academic year
  const [allBatchesData, setAllBatchesData] = useState<AllBatchesCohort[]>([]);
  const [allBatchesLoading, setAllBatchesLoading] = useState(false);
  const [allBatchesError, setAllBatchesError] = useState<string | null>(null);

  // Selected semester tab (e.g. 'all', '1-1', '1-2', etc.)
  const [selectedSemesterTab, setSelectedSemesterTab] = useState<string>("all");

  // Synchronize AcademicFilterBar (Year & Semester dropdowns) with selectedSemesterTab
  useEffect(() => {
    if (filters.year !== "all" && filters.semester !== "all") {
      const target = `${filters.year}-${filters.semester}`;
      if (selectedSemesterTab !== target) {
        setSelectedSemesterTab(target);
      }
    } else if (filters.year === "all" && filters.semester === "all") {
      if (selectedSemesterTab !== "all") {
        setSelectedSemesterTab("all");
      }
    }
  }, [filters.year, filters.semester]);

  const filteredBatchesData = useMemo(() => {
    return allBatchesData.filter((b) => {
      if (selectedSemesterTab !== "all") {
        const [yearStr, semStr] = selectedSemesterTab.split("-");
        const y = Number(yearStr);
        const s = Number(semStr);
        if (b.year !== y || b.semester !== s) return false;
      } else {
        if (filters.year !== "all" && b.year !== Number(filters.year)) return false;
        if (filters.semester !== "all" && b.semester !== Number(filters.semester)) return false;
      }
      return true;
    });
  }, [allBatchesData, selectedSemesterTab, filters.year, filters.semester]);

  const [editingSlot, setEditingSlot] = useState<{
    slot: { id: number; label: string; startTime: string; endTime: string };
    masterCell?: SlotCell | null;
    masterEntry: SlotCellEntry | null;
    cohort?: AllBatchesCohort;
  } | null>(null);

  const selectedDayName = useMemo(() => {
    return DAY_NAMES[fromYMD(selectedDate).getDay()];
  }, [selectedDate]);

  // Date rules:
  // - isPastDate: selected date is before today -> VIEW ONLY!
  // - isTodayDate or isFutureDate: present and future -> can change!
  const isPastDate = selectedDate < toYMD(today);
  const isTodayDate = selectedDate === toYMD(today);
  const isFutureDate = selectedDate > toYMD(today);

  // Only allowed to edit if user is authorized AND date is today or future!
  const canEditCurrentView = canChangeTimetable && !isPastDate;

  // Auto-resolve required filters so timetable displays by default on initial loading
  useEffect(() => {
    if (!masters) return;

    const updates: Partial<typeof filters> = {};

    // 1. Academic Year: default if not set
    if (!filters.academicYear) {
      const defYear =
        masters.defaults?.academicYear ||
        masters.academicYears.find((y) => y.isActive)?.label ||
        masters.academicYears[0]?.label ||
        "2026-2027";
      if (defYear) updates.academicYear = defYear;
    }

    // 2. Batch: For Today Timetable, Batch is removed from filters, so always 'all'
    if (filters.batch !== "all") {
      updates.batch = "all";
    }

    // 3. Section: Always 'all' since Section is removed from filters
    if (filters.section !== "all") {
      updates.section = "all";
    }

    // 4. Course: if branch is selected, sync course
    if (filters.branchId !== "all" && filters.courseId === "all") {
      const branch = masters.branches.find((b) => b.id === filters.branchId);
      if (branch?.courseId) {
        updates.courseId = branch.courseId;
      } else if (masters.courses.length > 0) {
        updates.courseId = masters.courses[0].id;
      }
    }

    if (Object.keys(updates).length > 0) {
      setFilters(updates);
    }
  }, [
    filters.collegeId,
    filters.branchId,
    filters.courseId,
    filters.batch,
    filters.section,
    filters.academicYear,
    masters,
    setFilters,
  ]);

  // Auto-filter Year and Semester by student list (only when year or semester is 'all')
  useEffect(() => {
    if (
      filters.collegeId === "all" ||
      filters.courseId === "all" ||
      filters.branchId === "all" ||
      filters.batch === "all"
    ) {
      setStudentProgressInfo(null);
      return;
    }

    let cancelled = false;
    async function autoFilterFromStudents() {
      try {
        const params = new URLSearchParams({
          collegeId: String(filters.collegeId),
          courseId: String(filters.courseId),
          branchId: String(filters.branchId),
          batch: String(filters.batch),
        });
        const res = await apiFetch(`/catalog/batch-progress?${params}`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const data = json.data as
          | { year: number | null; semester: number | null; studentCount: number }
          | undefined;

        if (data?.year != null && data?.semester != null) {
          setStudentProgressInfo({
            year: data.year,
            semester: data.semester,
            studentCount: data.studentCount || 0,
          });

          // Auto-update filter state only if currently 'all'
          if (filters.year === "all" || filters.semester === "all") {
            setFilters({ year: data.year, semester: data.semester });
          }
        }
      } catch {
        // Keep manual filters if request fails
      }
    }

    void autoFilterFromStudents();
    return () => {
      cancelled = true;
    };
  }, [
    filters.collegeId,
    filters.courseId,
    filters.branchId,
    filters.batch,
    setFilters,
  ]);

  const selectedCollege =
    filters.collegeId === "all" || !masters
      ? null
      : masters.colleges.find((c) => c.id === filters.collegeId) ?? null;
  const selectedBranch =
    filters.branchId === "all" || !masters
      ? null
      : masters.branches.find((b) => b.id === filters.branchId) ?? null;
  const needsSection = Boolean(selectedBranch?.hasSections);
  const isAllBatchesMode = filters.batch === "all";
  const filtersComplete =
    Boolean(filters.academicYear) &&
    (isAllBatchesMode ||
      (filters.collegeId !== "all" &&
        filters.branchId !== "all" &&
        filters.batch !== "all" &&
        filters.semester !== "all" &&
        (!needsSection || filters.section !== "all")));

  const selectedCourse = useMemo(() => {
    if (!masters || filters.courseId === "all") return null;
    return masters.courses.find((c) => c.id === filters.courseId) ?? null;
  }, [masters, filters.courseId]);

  // Semester pills: 1-1, 1-2, 2-1, 2-2, 3-1, 3-2, 4-1, 4-2
  const semesterPills = useMemo(() => {
    if (selectedCourse) {
      const totalYears = selectedCourse?.totalYears ?? 4;
      const semsPerYear = selectedCourse?.semestersPerYear ?? 2;
      const pills: Array<{ label: string; year: number; semester: number }> = [];
      for (let y = 1; y <= totalYears; y++) {
        for (let s = 1; s <= semsPerYear; s++) {
          pills.push({
            label: `${y}-${s}`,
            year: y,
            semester: s,
          });
        }
      }
      return pills;
    }
    // If all colleges / courses mode, derive pills from loaded batches:
    const seen = new Set<string>();
    const pills: Array<{ label: string; year: number; semester: number }> = [];
    for (const b of allBatchesData) {
      const key = `${b.year}-${b.semester}`;
      if (!seen.has(key)) {
        seen.add(key);
        pills.push({ label: key, year: b.year, semester: b.semester });
      }
    }
    return pills.sort((a, b) => (a.year !== b.year ? a.year - b.year : a.semester - b.semester));
  }, [selectedCourse, allBatchesData]);

  const query = useMemo(() => {
    if (!filtersComplete || isAllBatchesMode) return null;
    const p = new URLSearchParams();
    p.set("collegeId", String(filters.collegeId));
    p.set("courseId", String(filters.courseId));
    p.set("branchId", String(filters.branchId));
    p.set("batch", String(filters.batch));
    p.set("semester", String(filters.semester));
    p.set("academicYear", filters.academicYear);
    if (filters.year !== "all") p.set("year", String(filters.year));
    if (filters.section !== "all") p.set("section", filters.section);
    return "?" + p.toString();
  }, [filters, filtersComplete, isAllBatchesMode]);

  // Load master timetable planner (purely for comparison baseline!)
  const loadPlanner = useCallback(async () => {
    if (!query) {
      setPlanner(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/timetables/planner" + query, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load timetable planner (" + res.status + ")");
      const data = (await res.json()) as PlannerResponse;
      setPlanner(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load timetable");
    } finally {
      setLoading(false);
    }
  }, [query]);

  // Load daily overrides & activities from backend
  const loadDailyOverridesAndActivities = useCallback(async () => {
    if (!filtersComplete || !query) return;

    try {
      const todayQuery = new URLSearchParams();
      todayQuery.set("collegeId", String(filters.collegeId));
      todayQuery.set("courseId", String(filters.courseId));
      todayQuery.set("branchId", String(filters.branchId));
      todayQuery.set("batch", String(filters.batch));
      todayQuery.set("semester", String(filters.semester));
      todayQuery.set("academicYear", filters.academicYear);
      if (filters.section !== "all") todayQuery.set("section", filters.section);
      todayQuery.set("date", selectedDate);

      // 1. Fetch active overrides for this date
      const res = await apiFetch(`/today-timetable?${todayQuery.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setOverrides(json.overrides || {});
        if (Array.isArray(json.datesWithActivity)) {
          setDatesWithActivity(json.datesWithActivity);
        }
      }

      // 2. Fetch full activity logs for observing previous changes
      const actRes = await apiFetch(`/today-timetable/activities?${todayQuery.toString()}`);
      if (actRes.ok) {
        const actJson = await actRes.json();
        if (Array.isArray(actJson.activities)) {
          setActivities(actJson.activities);
        }
      }
    } catch (err) {
      console.warn("Unable to sync today-timetable activities with backend:", err);
    }
  }, [filtersComplete, query, filters, selectedDate]);

  // Load All Batches timetable for all running cohorts in the academic year
  const loadAllBatches = useCallback(async () => {
    if (!isAllBatchesMode || !filters.academicYear) {
      setAllBatchesData([]);
      return;
    }

    setAllBatchesLoading(true);
    setAllBatchesError(null);
    try {
      const params = new URLSearchParams();
      if (filters.collegeId !== "all") params.set("collegeId", String(filters.collegeId));
      if (filters.courseId !== "all") params.set("courseId", String(filters.courseId));
      if (filters.branchId !== "all") params.set("branchId", String(filters.branchId));
      params.set("academicYear", filters.academicYear);
      params.set("date", selectedDate);

      const res = await apiFetch(`/today-timetable/all-batches?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Failed to load all batches (${res.status})`);
      const json = await res.json();
      const batches = (json.batches || []) as AllBatchesCohort[];
      setAllBatchesData(batches);

      // Collect dates with activity across all cohorts
      const datesSet = new Set<string>();
      batches.forEach((b) => {
        (b.datesWithActivity || []).forEach((d) => datesSet.add(d));
      });
      if (datesSet.size > 0) {
        setDatesWithActivity((prev) => Array.from(new Set([...prev, ...Array.from(datesSet)])));
      }

      // Also load activity logs
      const actRes = await apiFetch(`/today-timetable/activities?${params.toString()}`);
      if (actRes.ok) {
        const actJson = await actRes.json();
        if (Array.isArray(actJson.activities)) {
          setActivities(actJson.activities);
        }
      }
    } catch (err) {
      setAllBatchesError(err instanceof Error ? err.message : "Failed to load all batches");
    } finally {
      setAllBatchesLoading(false);
    }
  }, [
    isAllBatchesMode,
    filters.collegeId,
    filters.courseId,
    filters.branchId,
    filters.academicYear,
    selectedDate,
  ]);

  useEffect(() => {
    if (isAllBatchesMode) {
      void loadAllBatches();
    } else {
      void loadPlanner();
      void loadDailyOverridesAndActivities();
    }
  }, [isAllBatchesMode, loadAllBatches, loadPlanner, loadDailyOverridesAndActivities]);

  const daySlots = useMemo(
    () => planner?.slotsByDay?.[selectedDayName] ?? [],
    [planner, selectedDayName],
  );
  const dayGrid = useMemo(
    () => (planner?.grid?.[selectedDayName] ?? {}) as Record<number, SlotCell>,
    [planner, selectedDayName],
  );

  function getSingleMasterCell(slotId: number): SlotCell | null {
    return dayGrid[slotId] ?? null;
  }

  function getCohortMasterCell(cohort: AllBatchesCohort, slotId: number): SlotCell | null {
    const dayCellMap = (cohort.planner?.grid?.[selectedDayName] ?? {}) as Record<number, SlotCell>;
    return dayCellMap[slotId] ?? null;
  }

  function isCohortPeriodChanged(cohort: AllBatchesCohort, slotId: number): boolean {
    const override = cohort.overrides?.[slotId];
    if (!override) return false;
    const cell = getCohortMasterCell(cohort, slotId);
    const masterEntries =
      cell?.entries && cell.entries.length > 0
        ? cell.entries
        : cell?.entry
        ? [cell.entry]
        : [];
    if (masterEntries.length > 1) {
      // Master has split sections; override turns it into a single combined period
      return true;
    }
    const master = masterEntries[0] ?? null;
    if (!master) {
      return Boolean(override.subjectId || override.hrmsEmployeeId || override.customLabel || override.subjectName);
    }
    const masterSubId = master.subjectId != null ? String(master.subjectId) : "";
    const masterSubName = (master.customLabel || master.subjectName || "").trim().toLowerCase();
    const masterFacHrms = (master.facultyHrmsId || "").trim();

    const overSubId = (override.subjectId || "").trim();
    const overSubName = (override.customLabel || override.subjectName || "").trim().toLowerCase();
    const overFacHrms = (override.hrmsEmployeeId || "").trim();

    const subjectMatches = (overSubId && masterSubId) ? overSubId === masterSubId : overSubName === masterSubName;
    const facultyMatches = overFacHrms === masterFacHrms;
    return !subjectMatches || !facultyMatches;
  }

  /**
   * Compare Today's timetable vs Master Timetable:
   * Returns TRUE if period is changed vs master timetable (red card)
   * Returns FALSE if period matches master timetable (green card)
   */
  function isPeriodChanged(slotId: number): boolean {
    const override = overrides[slotId];
    if (!override) return false;
    const cell = getSingleMasterCell(slotId);
    const masterEntries =
      cell?.entries && cell.entries.length > 0
        ? cell.entries
        : cell?.entry
        ? [cell.entry]
        : [];
    if (masterEntries.length > 1) {
      // Master has split sections; override turns it into a single combined period
      return true;
    }
    const master = masterEntries[0] ?? null;
    if (!master) {
      return Boolean(override.subjectId || override.hrmsEmployeeId || override.customLabel || override.subjectName);
    }
    const masterSubId = master.subjectId != null ? String(master.subjectId) : "";
    const masterSubName = (master.customLabel || master.subjectName || "").trim().toLowerCase();
    const masterFacHrms = (master.facultyHrmsId || "").trim();

    const overSubId = (override.subjectId || "").trim();
    const overSubName = (override.customLabel || override.subjectName || "").trim().toLowerCase();
    const overFacHrms = (override.hrmsEmployeeId || "").trim();

    const subjectMatches = (overSubId && masterSubId) ? overSubId === masterSubId : overSubName === masterSubName;
    const facultyMatches = overFacHrms === masterFacHrms;
    return !subjectMatches || !facultyMatches;
  }

  function prevDay() {
    const d = fromYMD(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(toYMD(d));
  }

  function nextDay() {
    const d = fromYMD(selectedDate);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    setSelectedDate(toYMD(next));
  }

  const isSunday = fromYMD(selectedDate).getDay() === 0;
  const isDayOff = planner?.ready && !isSunday && daySlots.length === 0;
  const missingLabel = !filtersComplete
    ? "Please select an Academic Year from the filter bar to view Today's timetable."
    : null;


  // Handle saving an edit for a period (Today or Future date only)
  const handleSavePeriod = async (payload: {
    override: PeriodOverride | null;
    isRevert: boolean;
    remarks: string;
    slotIds?: number[];
    isMoveSplitToSingle?: boolean;
    masterSubjectName?: string;
    masterFacultyName?: string;
  }) => {
    if (!editingSlot || isPastDate || !canChangeTimetable) return;
    const { slot, masterCell, masterEntry, cohort } = editingSlot;

    const newOverride = payload.override;
    const isRevert = payload.isRevert;
    const targetSlotIds =
      payload.slotIds && payload.slotIds.length > 0 ? payload.slotIds : [slot.id];

    const targetBatch = cohort ? cohort.batch : filters.batch;
    const targetSemester = cohort ? cohort.semester : filters.semester;
    const targetSection = cohort
      ? cohort.section
      : filters.section !== "all"
      ? filters.section
      : null;

    // Optimistically update local state for all target slot IDs
    if (cohort) {
      setAllBatchesData((prev) =>
        prev.map((b) => {
          if (
            b.batch === cohort.batch &&
            b.semester === cohort.semester &&
            b.section === cohort.section
          ) {
            const nextOverrides = { ...b.overrides };
            for (const tSlotId of targetSlotIds) {
              if (newOverride === null) {
                delete nextOverrides[tSlotId];
              } else {
                nextOverrides[tSlotId] = {
                  ...newOverride,
                  slotId: tSlotId,
                };
              }
            }
            return { ...b, overrides: nextOverrides };
          }
          return b;
        }),
      );
    } else {
      setOverrides((prev) => {
        const next = { ...prev };
        for (const tSlotId of targetSlotIds) {
          if (newOverride === null) {
            delete next[tSlotId];
          } else {
            next[tSlotId] = {
              ...newOverride,
              slotId: tSlotId,
            };
          }
        }
        return next;
      });
    }

    if (!datesWithActivity.includes(selectedDate)) {
      setDatesWithActivity((prev) => [...prev, selectedDate]);
    }

    setEditingSlot(null);

    // Call backend API to record activity and store override permanently
    try {
      const targetCollegeId =
        cohort?.collegeId ||
        (cohort?.planner?.context as { collegeId?: number } | undefined)?.collegeId ||
        (filters.collegeId !== "all" ? Number(filters.collegeId) : (masters?.colleges[0]?.id ?? 1));
      const targetBranchId =
        cohort?.branchId ||
        (cohort?.planner?.context as { branchId?: number } | undefined)?.branchId ||
        (filters.branchId !== "all" ? Number(filters.branchId) : (masters?.branches[0]?.id ?? 1));
      const targetCourseId =
        cohort?.courseId ||
        (cohort?.planner?.context as { courseId?: number } | undefined)?.courseId ||
        (filters.courseId !== "all" ? Number(filters.courseId) : (selectedBranch?.courseId || 1));

      const masterEntries =
        masterCell?.entries && masterCell.entries.length > 0
          ? masterCell.entries
          : masterEntry
          ? [masterEntry]
          : [];

      const masterSubName =
        payload.masterSubjectName ||
        (masterEntries.length > 1
          ? `Split: ` +
            masterEntries
              .map(
                (e, idx) =>
                  `${e.batchLabel || `Batch ${idx + 1}`}: ${e.customLabel || e.subjectName || e.subjectCode || "Free"}`,
              )
              .join(" | ")
          : masterEntry?.customLabel || masterEntry?.subjectName);

      const masterFacName =
        payload.masterFacultyName ||
        (masterEntries.length > 1
          ? masterEntries
              .map((e, idx) => `${e.batchLabel || `B${idx + 1}`}: ${e.facultyName || "None"}`)
              .join(" | ")
          : masterEntry?.facultyName);

      const body = {
        date: selectedDate,
        collegeId: targetCollegeId,
        courseId: targetCourseId,
        branchId: targetBranchId,
        batch: targetBatch,
        semester: targetSemester,
        section: targetSection,
        academicYear: filters.academicYear,
        slotId: slot.id,
        slotIds: targetSlotIds,
        slotLabel: slot.label,
        slotTime: `${slot.startTime}–${slot.endTime}`,

        masterSubjectId: masterEntry?.subjectId,
        masterSubjectCode: masterEntry?.subjectCode,
        masterSubjectName: masterSubName,
        masterFacultyHrmsId: masterEntry?.facultyHrmsId,
        masterFacultyName: masterFacName,

        newSubjectId: newOverride?.subjectId ? Number(newOverride.subjectId) : null,
        newSubjectCode: newOverride?.subjectCode ?? null,
        newSubjectName: newOverride?.customLabel || newOverride?.subjectName || null,
        newFacultyHrmsId: newOverride?.hrmsEmployeeId ?? null,
        newFacultyName: newOverride?.facultyName ?? null,

        remarks: payload.remarks || (payload.isMoveSplitToSingle ? "Moved split sections to single class" : null),
        changeType: isRevert ? "REVERTED_TO_MASTER" : "PERIOD_CHANGE",
      };

      const res = await apiFetch("/today-timetable/override", {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (res.ok) {
        if (isAllBatchesMode) {
          void loadAllBatches();
        } else {
          void loadDailyOverridesAndActivities();
        }
      }
    } catch (e) {
      console.error("Failed to save override to backend:", e);
    }
  };

  return (
    <div>
      {/* Top Header */}
      <div className="mb-2 sm:mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="hidden print:block">
          <h1 className="text-[28px] font-bold leading-tight text-navy-900">Today Timetable</h1>
          <p className="mt-1 text-sm text-slate-500 max-w-xl">
            Live schedule for any date compared against the Master Timetable.{" "}
            <span className="font-semibold text-emerald-700">Green</span> = unchanged,{" "}
            <span className="font-semibold text-rose-700">Red</span> = changed vs master. Master
            timetable remains untouched.
          </p>
        </div>

        {/* Top Right "Give Holiday" & "Activity" Buttons */}
        <div className="flex w-full sm:w-auto items-center justify-end gap-2">
          {canChangeTimetable && !isPastDate && (
            <Button
              id="today-timetable-give-holiday-button"
              onClick={() => setGiveHolidayModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2.5 text-sm font-bold text-white shadow-md hover:from-amber-600 hover:to-orange-700 transition-all cursor-pointer"
            >
              <CalendarOff className="h-4 w-4" />
              <span>Give Holiday</span>
            </Button>
          )}

          <Button
            id="today-timetable-activity-button"
            onClick={() => setActivityModalOpen(true)}
            className="inline-flex items-center gap-2.5 rounded-xl bg-navy-900 px-4 py-2.5 text-sm font-bold text-white shadow-md hover:bg-navy-800 transition-all"
          >
            <History className="h-4 w-4 text-amber-400" />
            <span>Activity</span>
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold text-white">
              {formatDate(fromYMD(selectedDate))}
            </span>
          </Button>
        </div>
      </div>

      {/* Filter Bar below the header */}
      <div className="mb-4 print:hidden">
        <AcademicFilterBar title="Page filters" />
      </div>

      {/* Role Access Policy Notice */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs shadow-xs">
        <div className="flex items-center gap-2">
          {canChangeTimetable ? (
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Authorized: Edit Access Enabled (Super Admin / Assigned Roles)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
              <Lock className="h-3.5 w-3.5" />
              <span>View Only: Editing requires &apos;Edit Today Timetable&apos; permission</span>
            </span>
          )}
        </div>
      </div>

      {/* Semester Switcher Tabs (All Semesters, 1-1, 1-2, 2-1, 2-2, etc.) */}
      {semesterPills.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2">Semester:</span>
            <button
              type="button"
              onClick={() => {
                setSelectedSemesterTab("all");
                setFilters({ year: "all", semester: "all" });
              }}
              className={cn(
                "px-3.5 py-1 text-xs font-bold rounded-lg transition-all border",
                selectedSemesterTab === "all"
                  ? "bg-navy-900 text-white border-navy-900 shadow-xs ring-2 ring-navy-200"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100",
              )}
            >
              All Semesters ({allBatchesData.length})
            </button>
            {semesterPills.map((pill) => {
              const isSelected = selectedSemesterTab === pill.label;
              const cohortCount = allBatchesData.filter(
                (b) => b.year === pill.year && b.semester === pill.semester,
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
              <span>Showing <strong>all running cohorts</strong></span>
            ) : (
              <span>Showing <strong>Semester {selectedSemesterTab}</strong></span>
            )}
          </div>
        </div>
      )}

      {missingLabel && (
        <Card className="mb-4">
          <p className="text-sm text-slate-600">{missingLabel}</p>
        </Card>
      )}

      {/* Unified Date & Context Navigation Banner */}
      {filtersComplete && (
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
              {isAllBatchesMode ? (
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
              ) : studentProgressInfo ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
                  <Users className="h-3 w-3" />
                  <span>Auto-filtered by Student List</span>
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-sm font-semibold text-navy-900">
              {isAllBatchesMode ? (
                <span>
                  Showing all active cohorts ({allBatchesData.length} running timetable{allBatchesData.length === 1 ? "" : "s"}) for this academic year
                </span>
              ) : planner ? (
                <span>
                  Year {filters.year !== "all" ? filters.year : planner.context.year || "—"} · Sem {planner.context.semester} · {planner.context.course} / {planner.context.branch}
                  {planner.context.hasSections ? " · Section " + planner.context.section : ""} · Batch {planner.context.batch}
                  {studentProgressInfo?.studentCount ? ` (${studentProgressInfo.studentCount} Regular Students)` : ""}
                </span>
              ) : (
                <span>Schedule for {selectedDayName}</span>
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

            <button
              type="button"
              onClick={() => setActivityModalOpen(true)}
              className="rounded-lg px-3 py-1.5 text-center hover:bg-slate-100 transition-colors min-w-[170px]"
              title="Click to open Activity & Calendar"
            >
              <p className="text-sm font-bold text-navy-900">{selectedDayName}</p>
              <p className="text-xs text-slate-500">{formatDate(fromYMD(selectedDate))}</p>
            </button>

            <button
              type="button"
              onClick={nextDay}
              className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 transition-colors"
              title="Next Day"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </Card>
      )}

      {/* Legend and instructions */}
      {filtersComplete && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs font-medium">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
              <span className="font-semibold text-emerald-800">
                Green: Unchanged (Matches Master Timetable)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-rose-500 ring-2 ring-rose-200" />
              <span className="font-semibold text-rose-800">
                Red: Changed from Master Timetable
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-slate-500">
            <Edit2 className="h-3 w-3 text-slate-400" />
            <span>Click any period to view actual vs changed comparison</span>
          </div>
        </div>
      )}

      {/* Sunday / Holiday banner */}
      {filtersComplete && isSunday && (
        <Card className="border-amber-200 bg-amber-50 mb-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <p className="text-sm font-semibold text-amber-800">
              Sunday — No classes scheduled in the master timetable.
            </p>
          </div>
        </Card>
      )}

      {/* ============================================================ */}
      {/* ALL BATCHES VIEW: Renders all cohorts running this year       */}
      {/* ============================================================ */}
      {isAllBatchesMode && filtersComplete && (
        <>
          {allBatchesLoading && <TimetableScheduleSkeleton />}
          {allBatchesError && (
            <Card className="mb-4 border-red-200 bg-red-50">
              <p className="text-sm text-red-700">{allBatchesError}</p>
            </Card>
          )}

          {!allBatchesLoading && !allBatchesError && allBatchesData.length === 0 && (
            <Card className="mb-4">
              <p className="text-sm text-slate-600">
                No active timetable plans found for {filters.collegeId === "all" ? "any college" : selectedCollege?.name || "this college"} in {filters.academicYear}.
              </p>
            </Card>
          )}

          {!allBatchesLoading &&
            !allBatchesError &&
            filteredBatchesData.map((cohort) => {
              const cohortSlots = (cohort.planner?.slotsByDay?.[selectedDayName] ?? []).filter(
                (slot) => slot.isActive !== false,
              );
              const isCohortDayOff = !isSunday && cohortSlots.length === 0;

              return (
                <div
                  key={`${cohort.collegeId || ""}-${cohort.branchId || ""}-${cohort.batch}-${cohort.year}-${cohort.semester}-${cohort.section || ""}`}
                  className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  {/* Cohort Header */}
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-black text-white shadow-xs">
                        {cohort.yearSemLabel}
                      </span>
                      <span className="text-sm font-bold text-slate-900">
                        Year {cohort.year}, Semester {cohort.semester}
                      </span>
                      {cohort.section && (
                        <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-800 border border-blue-200">
                          Section {cohort.section}
                        </span>
                      )}
                      {cohort.planner?.context?.branch && (
                        <span className="rounded-md bg-purple-50 px-2 py-0.5 text-xs font-bold text-purple-800 border border-purple-200">
                          {cohort.planner.context.branch}
                        </span>
                      )}
                      {cohort.planner?.context?.college && (
                        <span className="rounded-md bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600 border border-slate-200">
                          {cohort.planner.context.college}
                        </span>
                      )}
                      {cohort.batch && (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 border border-slate-200">
                          Batch {cohort.batch}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-medium">
                        {cohortSlots.length} Slots
                      </span>
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                        {cohort.planner.context.status === "published"
                          ? "Published Master"
                          : "Master Plan"}
                      </span>
                    </div>
                  </div>

                  {/* Day Off message if no slots on this weekday */}
                  {isCohortDayOff && (
                    <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
                      No classes scheduled for {selectedDayName} in this cohort&apos;s timetable.
                    </div>
                  )}

                  {/* PERIOD GRID without horizontal scroll */}
                  {!isCohortDayOff && !isSunday && cohortSlots.length > 0 && (
                    <TodayPeriodGrid
                      slots={cohortSlots}
                      getMasterCell={(slotId) => getCohortMasterCell(cohort, slotId)}
                      getOverride={(slotId) => cohort.overrides?.[slotId] ?? null}
                      isChanged={(slotId) => isCohortPeriodChanged(cohort, slotId)}
                      onSlotClick={(slot, masterCell, masterEntry) =>
                        setEditingSlot({ slot, masterCell, masterEntry, cohort })
                      }
                    />
                  )}
                </div>
              );
            })}
        </>
      )}

      {/* ============================================================ */}
      {/* SINGLE BATCH VIEW: Renders selected batch schedule in 1 line  */}
      {/* ============================================================ */}
      {!isAllBatchesMode && (
        <>
          {loading && <TimetableScheduleSkeleton />}
          {error && (
            <Card className="mb-4 border-red-200 bg-red-50">
              <p className="text-sm text-red-700">{error}</p>
            </Card>
          )}

          {planner?.ready && !loading && (
            <>
              {/* Day off banner */}
              {isDayOff && (
                <Card className="border-amber-200 bg-amber-50 mb-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <p className="text-sm font-semibold text-amber-800">
                      No classes scheduled for {selectedDayName} in the master timetable.
                    </p>
                  </div>
                </Card>
              )}

              {/* PERIOD GRID for single batch without horizontal scroll */}
              {!isDayOff && !isSunday && daySlots.length > 0 && (
                <TodayPeriodGrid
                  slots={daySlots}
                  getMasterCell={(slotId) => getSingleMasterCell(slotId)}
                  getOverride={(slotId) => overrides[slotId] ?? null}
                  isChanged={(slotId) => isPeriodChanged(slotId)}
                  onSlotClick={(slot, masterCell, masterEntry) => setEditingSlot({ slot, masterCell, masterEntry })}
                />
              )}
            </>
          )}

          {!loading && !error && !planner?.ready && filtersComplete && (
            <Card>
              <p className="text-sm text-slate-600">
                No published master timetable found for the selected filters.
              </p>
            </Card>
          )}
        </>
      )}

      {/* Activity & Date Navigation Modal */}
      {activityModalOpen && (
        <ActivityDetailsModal
          selectedDate={selectedDate}
          datesWithActivity={datesWithActivity}
          activities={activities}
          onSelectDate={(ymd) => setSelectedDate(ymd)}
          onClose={() => setActivityModalOpen(false)}
        />
      )}

      {/* Give Holiday Modal with Session/Slots and Multi-Audience Selection */}
      {giveHolidayModalOpen && (
        <GiveHolidayModal
          open={giveHolidayModalOpen}
          onClose={() => setGiveHolidayModalOpen(false)}
          currentDate={selectedDate}
          academicYear={filters.academicYear || masters?.defaults?.academicYear || "2024-2025"}
          availableSlots={
            daySlots.length > 0
              ? daySlots
              : (allBatchesData[0]?.planner?.slotsByDay?.[selectedDayName] ?? []).filter(
                  (s) => s.isActive !== false,
                )
          }
          masters={masters}
          initialScope={{
            collegeId: filters.collegeId,
            courseId: filters.courseId,
            branchId: filters.branchId,
          }}
          onHolidayDeclared={() => {
            if (isAllBatchesMode) {
              void loadAllBatches();
            } else {
              void loadPlanner();
              void loadDailyOverridesAndActivities();
            }
          }}
        />
      )}

      {/* Period Comparison & Edit Modal */}
      {editingSlot && (
        <PeriodEditModal
          slot={editingSlot.slot}
          candidateSlots={
            editingSlot.cohort
              ? (editingSlot.cohort.planner?.slotsByDay?.[selectedDayName] ?? []).filter(
                  (s) => s.isActive !== false,
                )
              : daySlots
          }
          date={selectedDate}
          dayLabel={selectedDayName}
          masterCell={editingSlot.masterCell}
          masterEntry={editingSlot.masterEntry}
          currentOverride={
            editingSlot.cohort
              ? editingSlot.cohort.overrides?.[editingSlot.slot.id] ?? null
              : overrides[editingSlot.slot.id] ?? null
          }
          subjects={
            editingSlot.cohort
              ? editingSlot.cohort.planner.subjects || []
              : planner?.subjects || []
          }
          faculty={
            editingSlot.cohort
              ? editingSlot.cohort.planner.faculty || []
              : planner?.faculty || []
          }
          canEdit={canEditCurrentView}
          onSave={handleSavePeriod}
          onClose={() => setEditingSlot(null)}
        />
      )}
    </div>
  );
}
