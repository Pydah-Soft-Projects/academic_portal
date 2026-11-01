"use client";

import { useMemo, useState } from "react";
import {
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Filter,
  GraduationCap,
  Layers,
  Printer,
  Search,
  Sparkles,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FacultyAvatar } from "@/components/ui/FacultyAvatar";
import { cn } from "@/lib/cn";

export type FacultyWeeklySlotItem = {
  dayOfWeek: string;
  dayLabel: string;
  timingSlotId: number;
  slotLabel: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  subjectName: string;
  subjectCode: string;
  customLabel: string;
  entryType: "theory" | "lab" | "other";
  roomLabel: string;
  batchLabel: string;
};

export type FacultyWorkloadSummary = {
  facultyId: string;
  facultyName: string;
  facultyEmpCode?: string;
  departmentName?: string;
  designation?: string;
  isClassTeacher?: boolean;
  totalSlots: number;
  totalHours: number;
  theorySlots: number;
  labSlots: number;
  otherSlots: number;
  subjects: Array<{
    id?: number | null;
    code: string;
    name: string;
    type: string;
    slotsCount: number;
  }>;
  slotsByDay: Record<string, FacultyWeeklySlotItem[]>;
};

export type FacultyWeeklySlotsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  assignments: Array<{
    dayOfWeek: string;
    timingSlotId: number;
    subjectId: number | null;
    subjectCode?: string;
    subjectName?: string;
    entryType?: "theory" | "lab" | "other";
    hrmsEmployeeId?: string;
    facultyName?: string;
    roomLabel?: string;
    batchLabel?: string;
    customLabel?: string;
  }>;
  slotsByDay?: Record<
    string,
    Array<{
      id: number;
      label: string;
      startTime: string;
      endTime: string;
      slotType: string;
      isAssignable: boolean;
    }>
  >;
  days?: string[];
  allFaculty?: Array<{
    hrmsEmployeeId: string;
    name: string;
    department?: string;
    designation?: string;
  }>;
  classTeacher?: {
    facultyName: string;
    hrmsEmployeeId: string;
    departmentName?: string | null;
  } | null;
  context?: {
    collegeName?: string | null;
    courseName?: string | null;
    branchName?: string | null;
    year?: number | string | null;
    semester?: number | string | null;
    section?: string | null;
    batch?: string | null;
    academicYear?: string | null;
    planId?: number | null;
    versionNo?: number | null;
    status?: string | null;
  };
};

const DAY_ORDER: Record<string, number> = {
  Monday: 1,
  MON: 1,
  Tuesday: 2,
  TUE: 2,
  Wednesday: 3,
  WED: 3,
  Thursday: 4,
  THU: 4,
  Friday: 5,
  FRI: 5,
  Saturday: 6,
  SAT: 6,
  Sunday: 7,
  SUN: 7,
};

const DAY_NORMALIZED: Record<string, string> = {
  MON: "Monday",
  Monday: "Monday",
  TUE: "Tuesday",
  Tuesday: "Tuesday",
  WED: "Wednesday",
  Wednesday: "Wednesday",
  THU: "Thursday",
  Thursday: "Thursday",
  FRI: "Friday",
  Friday: "Friday",
  SAT: "Saturday",
  Saturday: "Saturday",
};

function parseMinutes(timeStr?: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function FacultyWeeklySlotsModal({
  isOpen,
  onClose,
  assignments,
  slotsByDay = {},
  days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  allFaculty = [],
  classTeacher,
  context,
}: FacultyWeeklySlotsModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [dayFilter, setDayFilter] = useState<string>("all");
  const [showUnassignedFaculty, setShowUnassignedFaculty] = useState(false);
  const [sortBy, setSortBy] = useState<"slots-desc" | "slots-asc" | "name">("slots-desc");
  const [expandedFacultyId, setExpandedFacultyId] = useState<string | null>(null);

  // 1. Build Timing Slot lookup map
  const slotMap = useMemo(() => {
    const map = new Map<
      number,
      { label: string; startTime: string; endTime: string; durationMinutes: number }
    >();
    for (const day of Object.keys(slotsByDay)) {
      for (const slot of slotsByDay[day] || []) {
        const startMin = parseMinutes(slot.startTime);
        const endMin = parseMinutes(slot.endTime);
        const diff = Math.max(0, endMin - startMin);
        map.set(slot.id, {
          label: slot.label || `Slot #${slot.id}`,
          startTime: String(slot.startTime || "").slice(0, 5),
          endTime: String(slot.endTime || "").slice(0, 5),
          durationMinutes: diff > 0 ? diff : 50,
        });
      }
    }
    return map;
  }, [slotsByDay]);

  // 2. Aggregate weekly slots per faculty member
  const facultySummaries: FacultyWorkloadSummary[] = useMemo(() => {
    const map = new Map<string, FacultyWorkloadSummary>();

    // Map all known faculty from props first if requested
    for (const fac of allFaculty) {
      if (!fac.hrmsEmployeeId && !fac.name) continue;
      const key = fac.hrmsEmployeeId || fac.name;
      map.set(key, {
        facultyId: key,
        facultyName: fac.name,
        facultyEmpCode: fac.hrmsEmployeeId,
        departmentName: fac.department,
        designation: fac.designation,
        isClassTeacher:
          classTeacher?.hrmsEmployeeId === fac.hrmsEmployeeId ||
          (Boolean(fac.name) && classTeacher?.facultyName === fac.name),
        totalSlots: 0,
        totalHours: 0,
        theorySlots: 0,
        labSlots: 0,
        otherSlots: 0,
        subjects: [],
        slotsByDay: {},
      });
    }

    // Populate assignments
    for (const a of assignments) {
      const facKey = a.hrmsEmployeeId || a.facultyName;
      if (!facKey) continue;

      let summary = map.get(facKey);
      if (!summary) {
        summary = {
          facultyId: facKey,
          facultyName: a.facultyName || `Faculty (${facKey})`,
          facultyEmpCode: a.hrmsEmployeeId || "",
          departmentName: undefined,
          designation: undefined,
          isClassTeacher:
            classTeacher?.hrmsEmployeeId === a.hrmsEmployeeId ||
            (Boolean(a.facultyName) && classTeacher?.facultyName === a.facultyName),
          totalSlots: 0,
          totalHours: 0,
          theorySlots: 0,
          labSlots: 0,
          otherSlots: 0,
          subjects: [],
          slotsByDay: {},
        };
        map.set(facKey, summary);
      }

      const normDay = DAY_NORMALIZED[a.dayOfWeek] || a.dayOfWeek;
      const slotMeta = slotMap.get(a.timingSlotId);
      const duration = slotMeta?.durationMinutes ?? 50;

      summary.totalSlots += 1;
      summary.totalHours += duration / 60;

      if (a.entryType === "lab") {
        summary.labSlots += 1;
      } else if (a.entryType === "theory") {
        summary.theorySlots += 1;
      } else {
        summary.otherSlots += 1;
      }

      // Track subjects
      const subName = a.subjectName || a.customLabel || "Special Period";
      const subCode = a.subjectCode || "";
      const existingSub = summary.subjects.find(
        (s) => s.name === subName && (!subCode || s.code === subCode),
      );
      if (existingSub) {
        existingSub.slotsCount += 1;
      } else {
        summary.subjects.push({
          id: a.subjectId,
          name: subName,
          code: subCode,
          type: a.entryType || "theory",
          slotsCount: 1,
        });
      }

      // Track slots by day
      if (!summary.slotsByDay[normDay]) {
        summary.slotsByDay[normDay] = [];
      }
      summary.slotsByDay[normDay].push({
        dayOfWeek: a.dayOfWeek,
        dayLabel: normDay,
        timingSlotId: a.timingSlotId,
        slotLabel: slotMeta?.label || `Slot #${a.timingSlotId}`,
        startTime: slotMeta?.startTime || "",
        endTime: slotMeta?.endTime || "",
        durationMinutes: duration,
        subjectName: subName,
        subjectCode: subCode,
        customLabel: a.customLabel || "",
        entryType: a.entryType || "theory",
        roomLabel: a.roomLabel || "",
        batchLabel: a.batchLabel || "",
      });
    }

    // Sort slots within each day by start time
    for (const s of map.values()) {
      s.totalHours = Math.round(s.totalHours * 10) / 10;
      for (const day of Object.keys(s.slotsByDay)) {
        s.slotsByDay[day].sort((p1, p2) => p1.startTime.localeCompare(p2.startTime));
      }
    }

    return Array.from(map.values());
  }, [assignments, allFaculty, classTeacher, slotMap]);

  // 3. Filtered & Sorted faculty list
  const filteredFaculty = useMemo(() => {
    let list = facultySummaries;

    if (!showUnassignedFaculty) {
      list = list.filter((f) => f.totalSlots > 0);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (f) =>
          f.facultyName.toLowerCase().includes(q) ||
          f.facultyEmpCode?.toLowerCase().includes(q) ||
          f.departmentName?.toLowerCase().includes(q) ||
          f.subjects.some(
            (s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q),
          ),
      );
    }

    if (dayFilter !== "all") {
      list = list.filter((f) => (f.slotsByDay[dayFilter]?.length ?? 0) > 0);
    }

    return [...list].sort((a, b) => {
      if (sortBy === "slots-desc") {
        return b.totalSlots - a.totalSlots || a.facultyName.localeCompare(b.facultyName);
      }
      if (sortBy === "slots-asc") {
        return a.totalSlots - b.totalSlots || a.facultyName.localeCompare(b.facultyName);
      }
      return a.facultyName.localeCompare(b.facultyName);
    });
  }, [facultySummaries, showUnassignedFaculty, searchQuery, dayFilter, sortBy]);

  // 4. Global statistics
  const stats = useMemo(() => {
    const assignedFacList = facultySummaries.filter((f) => f.totalSlots > 0);
    const totalSlotsAssigned = assignedFacList.reduce((acc, f) => acc + f.totalSlots, 0);
    const totalHoursAssigned = Math.round(
      assignedFacList.reduce((acc, f) => acc + f.totalHours, 0) * 10,
    ) / 10;
    const totalTheorySlots = assignedFacList.reduce((acc, f) => acc + f.theorySlots, 0);
    const totalLabSlots = assignedFacList.reduce((acc, f) => acc + f.labSlots, 0);

    return {
      facultyCount: assignedFacList.length,
      totalSlots: totalSlotsAssigned,
      totalHours: totalHoursAssigned,
      theorySlots: totalTheorySlots,
      labSlots: totalLabSlots,
    };
  }, [facultySummaries]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 print:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="faculty-slots-title"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10 overflow-hidden">
        {/* Modal Header */}
        <div className="border-b border-border bg-gradient-to-r from-sky-50/70 via-indigo-50/40 to-slate-50 p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-md shadow-sky-600/20">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 id="faculty-slots-title" className="text-xl font-bold text-navy-900">
                    Faculty List & Weekly Slots Breakdown
                  </h3>
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-bold text-sky-800">
                    <Sparkles className="h-3.5 w-3.5 text-sky-600" />
                    {stats.facultyCount} Active Teachers
                  </span>
                </div>
                <p className="mt-1 text-xs sm:text-sm text-slate-600">
                  Comprehensive summary of weekly slot counts, teaching hours, and period schedules for this timetable.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-700 transition-colors shadow-2xs cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Context pill banner */}
          {context ? (
            <div className="mt-3.5 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200/80 bg-white/90 px-3.5 py-2 text-xs font-medium text-slate-700 shadow-2xs">
              {context.collegeName ? (
                <span className="flex items-center gap-1 font-semibold text-navy-900">
                  <Building2 className="h-3.5 w-3.5 text-slate-500" />
                  {context.collegeName}
                </span>
              ) : null}
              {context.branchName ? (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-800 font-semibold">{context.branchName}</span>
                </>
              ) : null}
              {context.year ? (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="rounded bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700 border border-sky-200/60">
                    Year {context.year}
                  </span>
                </>
              ) : null}
              {context.section && context.section !== "all" ? (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700 border border-indigo-200/60">
                    Section {context.section}
                  </span>
                </>
              ) : null}
              {context.semester ? (
                <>
                  <span className="text-slate-300">•</span>
                  <span>Semester {context.semester}</span>
                </>
              ) : null}
              {context.batch && context.batch !== "—" ? (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-600">Batch {context.batch}</span>
                </>
              ) : null}
              {context.academicYear ? (
                <>
                  <span className="text-slate-300">•</span>
                  <span>AY {context.academicYear}</span>
                </>
              ) : null}
              {context.planId ? (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-500">Plan #{context.planId} (v{context.versionNo ?? 1})</span>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Metrics KPI Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-border bg-slate-50/80 p-3 sm:px-6">
          <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Assigned Faculty
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-navy-900">{stats.facultyCount}</span>
              <span className="text-xs font-semibold text-slate-500">teachers</span>
            </div>
          </div>

          <div className="rounded-xl border border-sky-200/80 bg-sky-50/40 p-3 shadow-2xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-800">
              Weekly Teaching Slots
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-sky-900">{stats.totalSlots}</span>
              <span className="text-xs font-bold text-sky-700">periods / wk</span>
            </div>
          </div>

          <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/40 p-3 shadow-2xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-800">
              Weekly Teaching Hours
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-indigo-900">{stats.totalHours}</span>
              <span className="text-xs font-bold text-indigo-700">hrs / wk</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Theory vs Lab
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                {stats.theorySlots} Theory
              </span>
              <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                {stats.labSlots} Lab
              </span>
            </div>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-white px-4 py-3 sm:px-6">
          <div className="flex flex-1 items-center gap-2 min-w-[240px] max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search faculty name, ID, or subject..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-1.5 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Day Filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={dayFilter}
                onChange={(e) => setDayFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300 focus:outline-none cursor-pointer"
              >
                <option value="all">All Days</option>
                {days.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Selector */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="slots-desc">Sort: Most Weekly Slots</option>
              <option value="slots-asc">Sort: Least Weekly Slots</option>
              <option value="name">Sort: Faculty Name (A-Z)</option>
            </select>

            {/* Toggle show unassigned */}
            {allFaculty.length > 0 && (
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 ml-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showUnassignedFaculty}
                  onChange={(e) => setShowUnassignedFaculty(e.target.checked)}
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                Show 0-slot staff
              </label>
            )}
          </div>
        </div>

        {/* Scrollable Faculty Cards List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 max-h-[58vh]">
          {filteredFaculty.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-12 px-4 text-center">
              <Users className="h-10 w-10 text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700">No faculty members found</p>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                {searchQuery
                  ? "Try searching with a different faculty name or subject."
                  : "No faculty have been assigned to any periods in this timetable yet."}
              </p>
            </div>
          ) : (
            filteredFaculty.map((item) => {
              const isExpanded =
                expandedFacultyId === item.facultyId || filteredFaculty.length <= 4;
              return (
                <div
                  key={item.facultyId}
                  className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all"
                >
                  {/* Faculty Header Row */}
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <FacultyAvatar
                        name={item.facultyName}
                        hrmsEmployeeId={item.facultyEmpCode}
                        size="md"
                        className="ring-2 ring-sky-100"
                      />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-bold text-navy-900">
                            {item.facultyName}
                          </span>
                          {item.facultyEmpCode ? (
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                              ID: #{item.facultyEmpCode}
                            </span>
                          ) : null}
                          {item.departmentName ? (
                            <span className="rounded-md bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200/60">
                              {item.departmentName}
                            </span>
                          ) : null}
                          {item.designation ? (
                            <span className="text-[11px] text-slate-500 font-medium">
                              • {item.designation}
                            </span>
                          ) : null}
                          {item.isClassTeacher ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[10px] font-bold border border-emerald-200">
                              <UserCheck className="h-3 w-3" /> Class Teacher
                            </span>
                          ) : null}
                        </div>

                        {/* Subjects taught pills */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-slate-500">Subjects:</span>
                          {item.subjects.length > 0 ? (
                            item.subjects.map((sub, sIdx) => (
                              <span
                                key={`${sub.name}-${sIdx}`}
                                className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 border border-slate-200/60"
                              >
                                <BookOpen className="h-3 w-3 text-slate-400" />
                                <span className="font-semibold">{sub.name}</span>
                                {sub.code ? (
                                  <span className="text-slate-400 font-mono text-[10px]">
                                    ({sub.code})
                                  </span>
                                ) : null}
                                <span className="rounded bg-white px-1 py-0.2 text-[10px] font-bold text-indigo-700 border border-slate-200">
                                  {sub.slotsCount} slot{sub.slotsCount > 1 ? "s" : ""}
                                </span>
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              No periods assigned
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Weekly Slots & Hours Badge */}
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-1.5 text-right shadow-2xs">
                          <Clock className="h-4 w-4 text-sky-600" />
                          <div>
                            <span className="text-base font-black text-sky-950">
                              {item.totalSlots} Slots
                            </span>
                            <span className="text-xs font-bold text-sky-700 ml-1">/ week</span>
                          </div>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-500 mt-1">
                          {item.totalHours} hrs/week in this class
                        </span>
                      </div>

                      {/* Expand / Collapse toggle */}
                      {filteredFaculty.length > 4 && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedFacultyId(isExpanded ? null : item.facultyId)
                          }
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                          title={isExpanded ? "Collapse weekly schedule" : "Expand weekly schedule"}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5" />
                          ) : (
                            <ChevronDown className="h-5 w-5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Day-by-Day Slot Breakdown Grid (Monday to Saturday) */}
                  {isExpanded && item.totalSlots > 0 && (
                    <div className="mt-3 pt-1">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          Weekly Schedule by Day
                        </span>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <span className="flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            Theory: {item.theorySlots}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-amber-500" />
                            Lab: {item.labSlots}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                        {days.map((day) => {
                          const normDay = DAY_NORMALIZED[day] || day;
                          const daySlots = item.slotsByDay[normDay] || [];
                          const hasSlots = daySlots.length > 0;

                          return (
                            <div
                              key={day}
                              className={cn(
                                "flex flex-col rounded-xl border p-2.5 transition-all text-xs",
                                hasSlots
                                  ? "border-sky-200 bg-sky-50/30"
                                  : "border-slate-100 bg-slate-50/50 opacity-60",
                              )}
                            >
                              <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5 mb-1.5">
                                <span className="font-bold text-navy-900">{day.slice(0, 3)}</span>
                                <span
                                  className={cn(
                                    "rounded px-1.5 py-0.2 text-[10px] font-bold",
                                    hasSlots
                                      ? "bg-sky-600 text-white"
                                      : "bg-slate-200 text-slate-600",
                                  )}
                                >
                                  {daySlots.length}
                                </span>
                              </div>

                              {hasSlots ? (
                                <div className="space-y-1.5 flex-1">
                                  {daySlots.map((slot, pIdx) => (
                                    <div
                                      key={`${slot.dayOfWeek}-${slot.timingSlotId}-${pIdx}`}
                                      className={cn(
                                        "rounded-lg border p-1.5 text-[11px] shadow-2xs",
                                        slot.entryType === "lab"
                                          ? "border-amber-200 bg-amber-50 text-amber-950"
                                          : "border-slate-200 bg-white text-slate-900",
                                      )}
                                    >
                                      <div className="flex items-center justify-between font-bold">
                                        <span className="text-navy-900">{slot.slotLabel}</span>
                                        <span className="text-[10px] text-slate-500 font-normal">
                                          {slot.startTime}
                                        </span>
                                      </div>
                                      <p className="font-semibold text-slate-800 line-clamp-1 mt-0.5">
                                        {slot.subjectName}
                                      </p>
                                      {slot.batchLabel || slot.roomLabel ? (
                                        <div className="flex items-center gap-1 text-[9px] text-slate-500 mt-0.5">
                                          {slot.batchLabel ? (
                                            <span className="font-medium bg-slate-100 px-1 rounded">
                                              {slot.batchLabel}
                                            </span>
                                          ) : null}
                                          {slot.roomLabel ? <span>{slot.roomLabel}</span> : null}
                                        </div>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex flex-1 items-center justify-center py-3 text-[10px] text-slate-400 italic">
                                  Free
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-slate-50/90 px-6 py-4">
          <div className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-800">{filteredFaculty.length}</strong> faculty
            members • <strong className="text-slate-800">{stats.totalSlots}</strong> total periods/week
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => window.print()}
              className="text-slate-700 hover:text-navy-900"
            >
              <Printer className="mr-1.5 h-4 w-4 text-slate-500" /> Print Summary
            </Button>
            <Button onClick={onClose} className="bg-navy-900 hover:bg-navy-800 text-white">
              Done / Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

