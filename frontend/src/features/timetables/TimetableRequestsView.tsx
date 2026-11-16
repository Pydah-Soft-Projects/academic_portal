"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock3,
  Columns,
  ExternalLink,
  Filter,
  Layers,
  LayoutGrid,
  List,
  Maximize2,
  MessageSquare,
  Search,
  ShieldAlert,
  ShieldCheck,
  Split,
  User,
  X,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/cn";

export type TimetableSlotChange = {
  dayOfWeek: string;
  dayLabel: string;
  slotLabel: string;
  timeRange?: string;
  changeType: "modified" | "added" | "removed";
  fromSubject: string;
  toSubject: string;
  fromFaculty: string;
  toFaculty: string;
  fromRoom?: string;
  toRoom?: string;
  subjectChanged: boolean;
  facultyChanged: boolean;
};

export type TimetableRequestGridSlot = {
  id: number;
  label: string;
  startTime: string;
  endTime: string;
  timeRange: string;
  slotType: string;
  isBreak: boolean;
};

export type TimetableRequestGridEntry = {
  subjectCode: string | null;
  subjectName: string | null;
  customLabel: string | null;
  facultyName: string | null;
  batchLabel: string | null;
  roomLabel: string | null;
};

export type TimetableRequestGridCell = {
  dayOfWeek: string;
  dayLabel: string;
  slotId: number;
  slotLabel: string;
  timeRange: string;
  isBreak: boolean;
  isChanged: boolean;
  changeType?: "modified" | "added" | "removed" | "none";
  fromSubject?: string;
  toSubject?: string;
  fromFaculty?: string;
  toFaculty?: string;
  currentEntries: TimetableRequestGridEntry[];
  prevEntries: TimetableRequestGridEntry[];
};

export type TimetableRequestGrid = {
  days: { code: string; label: string }[];
  slots: TimetableRequestGridSlot[];
  cellsByDay: Record<string, Record<number, TimetableRequestGridCell>>;
  totalChangedSlots: number;
};

export type TimetableRequestItem = {
  id: number;
  requestId: number | null;
  planId: number;
  collegeId: number;
  collegeName: string;
  courseId: number;
  courseName: string;
  branchId: number;
  branchName: string;
  branchCode?: string | null;
  batch: string | null;
  yearOfStudy: number | null;
  semesterNumber: number;
  sectionName: string | null;
  academicYearLabel: string;
  versionNo: number | null;
  requesterUserId: number;
  requesterName: string;
  requesterRoleKey: string;
  reasonCategory?: string | null;
  reason: string;
  changeRemarks?: string | null;
  proposedChangesSummary: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reviewedByUserId: number | null;
  reviewerName: string | null;
  reviewComment: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  canApprove: boolean;
  changes?: TimetableSlotChange[];
  grid?: TimetableRequestGrid;
};

const REASON_CATEGORY_CONFIG: Record<
  string,
  { label: string; icon: string; badgeClass: string }
> = {
  syllabus_completed: {
    label: "Syllabus Completed",
    icon: "📚",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  timetable_mistake: {
    label: "Timetable Mistake / Entry Error",
    icon: "⚠️",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
  },
  faculty_change: {
    label: "Wantedly Changing Faculty / Reassignment",
    icon: "🔄",
    badgeClass: "bg-blue-50 text-blue-800 border-blue-200",
  },
  faculty_relieved: {
    label: "Faculty Relieved / Long Leave",
    icon: "🚪",
    badgeClass: "bg-purple-50 text-purple-800 border-purple-200",
  },
  workload_rebalance: {
    label: "Workload Rebalance",
    icon: "⚖️",
    badgeClass: "bg-sky-50 text-sky-800 border-sky-200",
  },
  other: {
    label: "Other Reason",
    icon: "📝",
    badgeClass: "bg-slate-100 text-slate-800 border-slate-300",
  },
};

function getScheduleStructure(req: TimetableRequestItem) {
  const grid = req.grid;
  const changes = req.changes || [];

  const days =
    grid?.days && grid.days.length > 0
      ? grid.days
      : [
          { code: "MON", label: "Monday" },
          { code: "TUE", label: "Tuesday" },
          { code: "WED", label: "Wednesday" },
          { code: "THU", label: "Thursday" },
          { code: "FRI", label: "Friday" },
          { code: "SAT", label: "Saturday" },
        ];

  const slots: TimetableRequestGridSlot[] =
    grid?.slots && grid.slots.length > 0
      ? grid.slots
      : (() => {
          const seen = new Set<string>();
          const list: TimetableRequestGridSlot[] = [];
          for (const c of changes) {
            if (!seen.has(c.slotLabel)) {
              seen.add(c.slotLabel);
              list.push({
                id: list.length + 1,
                label: c.slotLabel,
                startTime: c.timeRange?.split("-")[0]?.trim() || "",
                endTime: c.timeRange?.split("-")[1]?.trim() || "",
                timeRange: c.timeRange || "",
                slotType: "PERIOD",
                isBreak: false,
              });
            }
          }
          return list;
        })();

  const changesMap = new Map<string, TimetableSlotChange>();
  for (const c of changes) {
    mapSlotChange(changesMap, c);
  }

  return { days, slots, changesMap, grid, changes };
}

function mapSlotChange(map: Map<string, TimetableSlotChange>, c: TimetableSlotChange) {
  map.set(`${c.dayOfWeek}_${c.slotLabel.trim().toUpperCase()}`, c);
  map.set(`${c.dayOfWeek}_${c.slotLabel}`, c);
}

// -------------------------------------------------------------
// 1. MASTER TIMETABLE SCHEDULE GRID (Original Baseline Schedule)
// -------------------------------------------------------------
export function MasterTimetableScheduleGrid({
  req,
  compact = false,
}: {
  req: TimetableRequestItem;
  compact?: boolean;
}) {
  const { days, slots, changesMap, grid, changes } = useMemo(
    () => getScheduleStructure(req),
    [req],
  );

  if (slots.length === 0 && changes.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-slate-500 italic bg-slate-50 rounded-xl border border-slate-200">
        No schedule slots available for baseline timetable.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
      <table className="w-full min-w-[760px] border-collapse text-xs">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
            <th className="py-2 px-2.5 text-left font-bold text-xs uppercase tracking-wider text-slate-700 w-24 border-r border-slate-200 shrink-0 sticky left-0 bg-slate-50 z-10 shadow-2xs">
              Day
            </th>
            {slots.map((slot) => (
              <th
                key={slot.id}
                className={cn(
                  "py-2 px-1.5 text-center border-r border-slate-200 last:border-r-0",
                  slot.isBreak ? "bg-slate-100/70 text-slate-500 w-14" : "min-w-[125px]",
                )}
              >
                <div className="font-bold text-navy-900 text-xs">{slot.label}</div>
                {slot.timeRange ? (
                  <div className="text-[9.5px] font-mono text-slate-400 font-normal mt-0.5">
                    {slot.timeRange}
                  </div>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {days.map((day) => (
            <tr key={day.code} className="hover:bg-slate-50/40 transition-colors">
              <td className="py-2.5 px-2.5 font-bold text-navy-950 border-r border-slate-200 bg-slate-50/70 sticky left-0 z-10 shadow-2xs text-xs">
                {day.label}
              </td>
              {slots.map((slot) => {
                if (slot.isBreak) {
                  return (
                    <td
                      key={slot.id}
                      className="py-1 px-1 text-center border-r border-slate-200 last:border-r-0 bg-slate-100/50 text-slate-400 font-bold text-[9px] select-none"
                    >
                      <div className="uppercase tracking-widest">{slot.label}</div>
                    </td>
                  );
                }

                const cell = grid?.cellsByDay?.[day.code]?.[slot.id];
                const changeItem =
                  changesMap.get(`${day.code}_${slot.label.trim().toUpperCase()}`) ||
                  changesMap.get(`${day.code}_${slot.label}`) ||
                  (slot.startTime
                    ? changes.find(
                        (c) =>
                          c.dayOfWeek === day.code &&
                          c.timeRange &&
                          c.timeRange.includes(slot.startTime),
                      )
                    : undefined);
                const isChanged = Boolean(cell?.isChanged || changeItem);

                // Baseline subject & faculty for this slot
                const baseSubject =
                  changeItem?.fromSubject && changeItem.fromSubject !== "Free / Unassigned"
                    ? changeItem.fromSubject
                    : cell?.fromSubject && cell.fromSubject !== "Free / Unassigned"
                    ? cell.fromSubject
                    : cell?.prevEntries?.[0]?.subjectName ||
                      cell?.prevEntries?.[0]?.customLabel ||
                      cell?.prevEntries?.[0]?.subjectCode ||
                      (!isChanged
                        ? cell?.currentEntries?.[0]?.subjectName ||
                          cell?.currentEntries?.[0]?.customLabel ||
                          cell?.currentEntries?.[0]?.subjectCode ||
                          (cell?.toSubject && cell.toSubject !== "Free / Unassigned" ? cell.toSubject : null)
                        : null);

                const baseFaculty =
                  changeItem?.fromFaculty && changeItem.fromFaculty !== "Unassigned"
                    ? changeItem.fromFaculty
                    : cell?.fromFaculty && cell.fromFaculty !== "Unassigned"
                    ? cell.fromFaculty
                    : cell?.prevEntries?.[0]?.facultyName ||
                      (!isChanged
                        ? cell?.currentEntries?.[0]?.facultyName ||
                          (cell?.toFaculty && cell.toFaculty !== "Unassigned" ? cell.toFaculty : null)
                        : null);

                const isAssigned = Boolean(baseSubject && baseSubject !== "Free / Unassigned" && baseSubject !== "Free");

                return (
                  <td
                    key={slot.id}
                    className={cn(
                      "p-1.5 border-r border-slate-200 last:border-r-0",
                      isChanged ? "bg-amber-50/40" : "bg-white",
                    )}
                  >
                    <div
                      className={cn(
                        "rounded-xl border p-2 flex flex-col justify-between transition-colors",
                        compact ? "min-h-[75px]" : "min-h-[86px]",
                        isChanged
                          ? "border-amber-300 bg-amber-50/50 shadow-2xs"
                          : "border-slate-200/90 bg-slate-50/50",
                      )}
                    >
                      {isAssigned ? (
                        <>
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              {isChanged ? (
                                <span className="inline-flex items-center rounded bg-amber-100 text-amber-900 font-bold px-1.5 py-0.2 text-[8px] uppercase tracking-wider border border-amber-300">
                                  Baseline
                                </span>
                              ) : null}
                              <span className="text-[9.5px] font-mono text-slate-400 font-semibold ml-auto">
                                {slot.label}
                              </span>
                            </div>
                            <div
                              className="font-bold text-slate-900 text-xs truncate leading-snug"
                              title={baseSubject || "Subject"}
                            >
                              {baseSubject}
                            </div>
                          </div>
                          {baseFaculty ? (
                            <div
                              className="text-[10px] text-slate-600 truncate flex items-center gap-1 mt-1 font-medium"
                              title={baseFaculty}
                            >
                              <User className="h-3 w-3 text-slate-400 shrink-0" />
                              <span className="truncate">{baseFaculty}</span>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <div className="flex items-center justify-center h-full text-slate-400 text-xs italic min-h-[60px]">
                          Free
                        </div>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// -------------------------------------------------------------
// 2. PROPOSED TIMETABLE SCHEDULE GRID (Changes with Red Indications)
// -------------------------------------------------------------
export function ProposedTimetableScheduleGrid({
  req,
  compact = false,
}: {
  req: TimetableRequestItem;
  compact?: boolean;
}) {
  const { days, slots, changesMap, grid, changes } = useMemo(
    () => getScheduleStructure(req),
    [req],
  );

  if (slots.length === 0 && changes.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-slate-500 italic bg-slate-50 rounded-xl border border-slate-200">
        No schedule slots available for this request.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
      <table className="w-full min-w-[760px] border-collapse text-xs">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
            <th className="py-2 px-2.5 text-left font-bold text-xs uppercase tracking-wider text-slate-700 w-24 border-r border-slate-200 shrink-0 sticky left-0 bg-slate-50 z-10 shadow-2xs">
              Day
            </th>
            {slots.map((slot) => (
              <th
                key={slot.id}
                className={cn(
                  "py-2 px-1.5 text-center border-r border-slate-200 last:border-r-0",
                  slot.isBreak ? "bg-slate-100/70 text-slate-500 w-14" : "min-w-[125px]",
                )}
              >
                <div className="font-bold text-navy-900 text-xs">{slot.label}</div>
                {slot.timeRange ? (
                  <div className="text-[9.5px] font-mono text-slate-400 font-normal mt-0.5">
                    {slot.timeRange}
                  </div>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {days.map((day) => (
            <tr key={day.code} className="hover:bg-slate-50/40 transition-colors">
              <td className="py-2.5 px-2.5 font-bold text-navy-950 border-r border-slate-200 bg-slate-50/70 sticky left-0 z-10 shadow-2xs text-xs">
                {day.label}
              </td>
              {slots.map((slot) => {
                if (slot.isBreak) {
                  return (
                    <td
                      key={slot.id}
                      className="py-1 px-1 text-center border-r border-slate-200 last:border-r-0 bg-slate-100/50 text-slate-400 font-bold text-[9px] select-none"
                    >
                      <div className="uppercase tracking-widest">{slot.label}</div>
                    </td>
                  );
                }

                const cell = grid?.cellsByDay?.[day.code]?.[slot.id];
                const changeItem =
                  changesMap.get(`${day.code}_${slot.label.trim().toUpperCase()}`) ||
                  changesMap.get(`${day.code}_${slot.label}`) ||
                  (slot.startTime
                    ? changes.find(
                        (c) =>
                          c.dayOfWeek === day.code &&
                          c.timeRange &&
                          c.timeRange.includes(slot.startTime),
                      )
                    : undefined);
                const isChanged = Boolean(cell?.isChanged || changeItem);

                if (isChanged) {
                  const fromSub =
                    changeItem?.fromSubject && changeItem.fromSubject !== "Free / Unassigned"
                      ? changeItem.fromSubject
                      : cell?.fromSubject && cell.fromSubject !== "Free / Unassigned"
                      ? cell.fromSubject
                      : "Free / Unassigned";

                  const toSub =
                    changeItem?.toSubject && changeItem.toSubject !== "Free / Unassigned"
                      ? changeItem.toSubject
                      : cell?.toSubject && cell.toSubject !== "Free / Unassigned"
                      ? cell.toSubject
                      : cell?.currentEntries?.[0]?.customLabel ||
                        cell?.currentEntries?.[0]?.subjectName ||
                        cell?.currentEntries?.[0]?.subjectCode ||
                        "Free";

                  const fromFac =
                    changeItem?.fromFaculty && changeItem.fromFaculty !== "Unassigned"
                      ? changeItem.fromFaculty
                      : cell?.fromFaculty && cell.fromFaculty !== "Unassigned"
                      ? cell.fromFaculty
                      : null;

                  const toFac =
                    changeItem?.toFaculty && changeItem.toFaculty !== "Unassigned"
                      ? changeItem.toFaculty
                      : cell?.toFaculty && cell.toFaculty !== "Unassigned"
                      ? cell.toFaculty
                      : cell?.currentEntries?.[0]?.facultyName || null;

                  // RED INDICATION FOR CHANGED PERIOD
                  return (
                    <td
                      key={slot.id}
                      className="p-1.5 border-r border-slate-200 last:border-r-0 bg-rose-50/60"
                    >
                      <div
                        className={cn(
                          "rounded-xl border-2 border-rose-500 bg-white p-2 shadow-2xs ring-1 ring-rose-200 flex flex-col justify-between",
                          compact ? "min-h-[75px]" : "min-h-[86px]",
                        )}
                      >
                        <div>
                          {/* Changed Top Badge */}
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="inline-flex items-center gap-1 rounded bg-rose-600 text-white font-black px-1.5 py-0.2 text-[8px] uppercase tracking-wider shadow-2xs">
                              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                              Changed
                            </span>
                            <span className="text-[9.5px] font-mono font-bold text-rose-700">
                              {slot.label}
                            </span>
                          </div>

                          {/* Previous Strikethrough */}
                          <div
                            className="line-through text-slate-400 text-[10px] truncate font-medium leading-tight"
                            title={`Previous: ${fromSub}`}
                          >
                            {fromSub}
                          </div>
                          {fromFac && (
                            <div
                              className="line-through text-slate-400 text-[9.5px] truncate leading-tight"
                              title={`Previous Faculty: ${fromFac}`}
                            >
                              {fromFac}
                            </div>
                          )}
                        </div>

                        {/* Proposed Subject & Faculty in Rose / Bold Red */}
                        <div className="mt-1 pt-1 border-t border-rose-200">
                          <div
                            className="font-bold text-xs text-rose-950 truncate leading-snug"
                            title={`Proposed: ${toSub}`}
                          >
                            {toSub}
                          </div>
                          {toFac ? (
                            <div
                              className="text-[10px] font-bold text-rose-800 truncate flex items-center gap-1 mt-0.5"
                              title={`Proposed Faculty: ${toFac}`}
                            >
                              <User className="h-3 w-3 text-rose-600 shrink-0" />
                              <span className="truncate">{toFac}</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                  );
                }

                // UNCHANGED PERIOD
                const ent = cell?.currentEntries?.[0];
                const subTitle =
                  ent?.customLabel ||
                  ent?.subjectName ||
                  ent?.subjectCode ||
                  (cell?.toSubject && cell.toSubject !== "Free / Unassigned" ? cell.toSubject : null);
                const facTitle =
                  ent?.facultyName ||
                  (cell?.toFaculty && cell.toFaculty !== "Unassigned" ? cell.toFaculty : null);
                const isAssigned = Boolean(subTitle);

                return (
                  <td
                    key={slot.id}
                    className="p-1.5 border-r border-slate-200 last:border-r-0 bg-white"
                  >
                    <div
                      className={cn(
                        "rounded-xl border border-slate-200/90 bg-slate-50/50 p-2 flex flex-col justify-between transition-colors",
                        compact ? "min-h-[75px]" : "min-h-[86px]",
                      )}
                    >
                      {isAssigned ? (
                        <>
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              {ent?.batchLabel ? (
                                <span className="rounded bg-navy-100 text-navy-800 font-bold px-1.5 py-0.2 text-[8px] uppercase inline-block">
                                  {ent.batchLabel}
                                </span>
                              ) : null}
                              <span className="text-[9.5px] font-mono text-slate-400 font-semibold ml-auto">
                                {slot.label}
                              </span>
                            </div>
                            <div
                              className="font-bold text-slate-800 text-xs truncate leading-snug"
                              title={subTitle || "Subject"}
                            >
                              {subTitle}
                            </div>
                          </div>
                          {facTitle ? (
                            <div className="text-[10px] text-slate-500 truncate flex items-center gap-1 mt-1">
                              <User className="h-3 w-3 text-slate-400 shrink-0" />
                              <span className="truncate">{facTitle}</span>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <div className="flex items-center justify-center h-full text-slate-400 text-xs italic min-h-[60px]">
                          Free
                        </div>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// -------------------------------------------------------------
// 3. DAY-BY-DAY SPLIT COMPARISON (Master Row vs Proposed Row)
// -------------------------------------------------------------
export function DayByDaySplitComparisonGrid({
  req,
}: {
  req: TimetableRequestItem;
}) {
  const { days, slots, changesMap, grid, changes } = useMemo(
    () => getScheduleStructure(req),
    [req],
  );

  return (
    <div className="space-y-4">
      {days.map((day) => {
        const dayChanges = changes.filter((c) => c.dayOfWeek === day.code);

        return (
          <div
            key={day.code}
            className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs"
          >
            {/* Day Header Banner */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="font-bold text-navy-950 text-sm">{day.label}</span>
                {dayChanges.length > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 border border-rose-300 px-2 py-0.5 text-[11px] font-bold text-rose-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse" />
                    {dayChanges.length} Changed {dayChanges.length === 1 ? "Slot" : "Slots"}
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                    No Changes
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                Master Baseline vs Proposed Schedule
              </span>
            </div>

            {/* Split Day Table: Row 1 = Master Baseline, Row 2 = Proposed Changes */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 text-[10.5px]">
                    <th className="py-2 px-3 text-left font-bold uppercase tracking-wider w-32 border-r border-slate-200 sticky left-0 bg-slate-50/90 z-10">
                      Version
                    </th>
                    {slots.map((slot) => (
                      <th
                        key={slot.id}
                        className={cn(
                          "py-1.5 px-2 text-center border-r border-slate-200 last:border-r-0",
                          slot.isBreak ? "w-14 bg-slate-100/70" : "min-w-[120px]",
                        )}
                      >
                        <div className="font-bold text-slate-800">{slot.label}</div>
                        {slot.timeRange ? (
                          <div className="text-[9.5px] font-mono text-slate-400 font-normal">
                            {slot.timeRange}
                          </div>
                        ) : null}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {/* Row 1: Master Timetable Baseline */}
                  <tr className="bg-slate-50/40">
                    <td className="py-2.5 px-3 border-r border-slate-200 font-bold text-slate-700 sticky left-0 bg-slate-100/80 z-10 text-[11px]">
                      <div className="flex items-center gap-1.5 text-slate-800">
                        <BookOpen className="h-3.5 w-3.5 text-slate-500" />
                        <span>Master Baseline</span>
                      </div>
                    </td>
                    {slots.map((slot) => {
                      if (slot.isBreak) {
                        return (
                          <td
                            key={slot.id}
                            className="py-1 px-1 text-center border-r border-slate-200 last:border-r-0 bg-slate-100/50 text-slate-400 text-[9px] uppercase tracking-wider"
                          >
                            {slot.label}
                          </td>
                        );
                      }

                      const cell = grid?.cellsByDay?.[day.code]?.[slot.id];
                      const changeItem =
                        changesMap.get(`${day.code}_${slot.label.trim().toUpperCase()}`) ||
                        changesMap.get(`${day.code}_${slot.label}`);
                      const isChanged = Boolean(cell?.isChanged || changeItem);

                      const baseSubject =
                        changeItem?.fromSubject && changeItem.fromSubject !== "Free / Unassigned"
                          ? changeItem.fromSubject
                          : cell?.fromSubject && cell.fromSubject !== "Free / Unassigned"
                          ? cell.fromSubject
                          : cell?.prevEntries?.[0]?.subjectName ||
                            (!isChanged ? cell?.currentEntries?.[0]?.subjectName || cell?.toSubject : null);

                      const baseFaculty =
                        changeItem?.fromFaculty && changeItem.fromFaculty !== "Unassigned"
                          ? changeItem.fromFaculty
                          : cell?.fromFaculty && cell.fromFaculty !== "Unassigned"
                          ? cell.fromFaculty
                          : cell?.prevEntries?.[0]?.facultyName ||
                            (!isChanged ? cell?.currentEntries?.[0]?.facultyName || cell?.toFaculty : null);

                      return (
                        <td
                          key={slot.id}
                          className="p-1.5 border-r border-slate-200 last:border-r-0"
                        >
                          <div
                            className={cn(
                              "rounded-lg p-2 border min-h-[64px] flex flex-col justify-between",
                              isChanged
                                ? "bg-amber-50/60 border-amber-200"
                                : "bg-white border-slate-200/80",
                            )}
                          >
                            <div className="font-semibold text-slate-800 text-[11px] truncate">
                              {baseSubject || <span className="text-slate-400 italic font-normal">Free</span>}
                            </div>
                            {baseFaculty ? (
                              <div className="text-[10px] text-slate-500 truncate flex items-center gap-1 mt-1">
                                <User className="h-3 w-3 text-slate-400 shrink-0" />
                                <span className="truncate">{baseFaculty}</span>
                              </div>
                            ) : null}
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Row 2: Proposed Changed Schedule */}
                  <tr className="bg-white">
                    <td className="py-2.5 px-3 border-r border-slate-200 font-bold text-rose-900 sticky left-0 bg-rose-50/80 z-10 text-[11px]">
                      <div className="flex items-center gap-1.5 text-rose-900">
                        <Calendar className="h-3.5 w-3.5 text-rose-600" />
                        <span>Proposed</span>
                      </div>
                    </td>
                    {slots.map((slot) => {
                      if (slot.isBreak) {
                        return (
                          <td
                            key={slot.id}
                            className="py-1 px-1 text-center border-r border-slate-200 last:border-r-0 bg-slate-100/50 text-slate-400 text-[9px] uppercase tracking-wider"
                          >
                            {slot.label}
                          </td>
                        );
                      }

                      const cell = grid?.cellsByDay?.[day.code]?.[slot.id];
                      const changeItem =
                        changesMap.get(`${day.code}_${slot.label.trim().toUpperCase()}`) ||
                        changesMap.get(`${day.code}_${slot.label}`);
                      const isChanged = Boolean(cell?.isChanged || changeItem);

                      if (isChanged) {
                        const toSub =
                          changeItem?.toSubject && changeItem.toSubject !== "Free / Unassigned"
                            ? changeItem.toSubject
                            : cell?.toSubject || cell?.currentEntries?.[0]?.subjectName || "Free";
                        const toFac =
                          changeItem?.toFaculty && changeItem.toFaculty !== "Unassigned"
                            ? changeItem.toFaculty
                            : cell?.toFaculty || cell?.currentEntries?.[0]?.facultyName || null;

                        return (
                          <td
                            key={slot.id}
                            className="p-1.5 border-r border-slate-200 last:border-r-0 bg-rose-50/40"
                          >
                            <div className="rounded-lg p-2 border-2 border-rose-500 bg-white shadow-2xs ring-1 ring-rose-200 min-h-[64px] flex flex-col justify-between">
                              <div className="flex items-center justify-between gap-1 mb-0.5">
                                <span className="rounded bg-rose-600 text-white font-black px-1.5 py-0.2 text-[7.5px] uppercase tracking-wider">
                                  Changed
                                </span>
                              </div>
                              <div className="font-bold text-rose-950 text-[11.5px] truncate">
                                {toSub}
                              </div>
                              {toFac ? (
                                <div className="text-[10px] font-bold text-rose-800 truncate flex items-center gap-1 mt-0.5">
                                  <User className="h-3 w-3 text-rose-600 shrink-0" />
                                  <span className="truncate">{toFac}</span>
                                </div>
                              ) : null}
                            </div>
                          </td>
                        );
                      }

                      const sub = cell?.currentEntries?.[0]?.subjectName || cell?.toSubject;
                      const fac = cell?.currentEntries?.[0]?.facultyName || cell?.toFaculty;

                      return (
                        <td
                          key={slot.id}
                          className="p-1.5 border-r border-slate-200 last:border-r-0"
                        >
                          <div className="rounded-lg p-2 border border-slate-200/80 bg-slate-50/50 min-h-[64px] flex flex-col justify-between">
                            <div className="font-semibold text-slate-800 text-[11px] truncate">
                              {sub || <span className="text-slate-400 italic font-normal">Free</span>}
                            </div>
                            {fac ? (
                              <div className="text-[10px] text-slate-500 truncate flex items-center gap-1 mt-1">
                                <User className="h-3 w-3 text-slate-400 shrink-0" />
                                <span className="truncate">{fac}</span>
                              </div>
                            ) : null}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// -------------------------------------------------------------
// 4. MAIN TIMETABLE REQUESTS VIEW
// -------------------------------------------------------------
export function TimetableRequestsView() {
  const router = useRouter();
  const { hasPermission, authorization } = useAuth();

  const isPrincipal = authorization?.roles?.some((r) => r.roleKey === "principal");
  const isSuperAdmin = authorization?.roles?.some((r) => r.roleKey === "super_admin");
  const isVicePrincipal = authorization?.roles?.some((r) => r.roleKey === "vice_principal");

  const canApprove =
    isSuperAdmin ||
    isPrincipal ||
    isVicePrincipal ||
    hasPermission("timetable_requests.approve") ||
    hasPermission("request.approve");

  const [requests, setRequests] = useState<TimetableRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  // Detailed Pop-up Modal State
  const [previewModalRequest, setPreviewModalRequest] = useState<TimetableRequestItem | null>(null);
  const [modalTab, setModalTab] = useState<"side-by-side" | "day-by-day" | "proposed-only" | "list">("side-by-side");

  // Approval / Rejection modal state
  const [actionModal, setActionModal] = useState<{
    type: "approve" | "reject";
    request: TimetableRequestItem;
  } | null>(null);
  const [actionComment, setActionComment] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const loadRequests = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/timetable-requests");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load timetable requests");
      setRequests(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load requests");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const counts = useMemo(() => {
    return {
      all: requests.length,
      pending: requests.filter((r) => r.status === "pending").length,
      approved: requests.filter((r) => r.status === "approved").length,
      rejected: requests.filter((r) => r.status === "rejected").length,
    };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    return requests.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (
        item.collegeName.toLowerCase().includes(s) ||
        item.courseName.toLowerCase().includes(s) ||
        item.branchName.toLowerCase().includes(s) ||
        (item.sectionName && item.sectionName.toLowerCase().includes(s)) ||
        item.requesterName.toLowerCase().includes(s) ||
        item.reason.toLowerCase().includes(s) ||
        (item.reviewerName && item.reviewerName.toLowerCase().includes(s))
      );
    });
  }, [requests, statusFilter, search]);

  const handleConfirmAction = async () => {
    if (!actionModal) return;
    setSubmittingAction(true);
    setActionError(null);
    try {
      const endpoint = `/timetable-requests/${actionModal.request.id}/${actionModal.type}`;
      const res = await apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: actionComment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Action failed`);

      setSuccessToast(
        actionModal.type === "approve"
          ? `Request REQ-${String(actionModal.request.id).padStart(4, "0")} approved and published live successfully!`
          : `Request REQ-${String(actionModal.request.id).padStart(4, "0")} rejected.`,
      );
      setTimeout(() => setSuccessToast(null), 6000);

      setActionModal(null);
      setActionComment("");
      await loadRequests(true);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setSubmittingAction(false);
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Time Table Requests"
        description="Review, approve, and track master timetable change requests submitted by department HODs."
      />

      {successToast ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm font-medium text-emerald-800 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            <span>{successToast}</span>
          </div>
          <button
            onClick={() => setSuccessToast(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold"
          >
            ×
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <Button size="sm" variant="secondary" onClick={() => void loadRequests(true)}>
            Retry
          </Button>
        </div>
      ) : null}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <button
          onClick={() => setStatusFilter("pending")}
          className={cn(
            "rounded-xl border p-4 text-left transition shadow-sm",
            statusFilter === "pending"
              ? "border-amber-400 bg-amber-50/70 ring-2 ring-amber-300 ring-offset-1"
              : "border-slate-200 bg-white hover:border-slate-300",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">Pending Approval</span>
            <Clock3 className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-950">{counts.pending}</div>
          <div className="mt-1 text-xs text-amber-800">Requires Principal / Admin review</div>
        </button>

        <button
          onClick={() => setStatusFilter("approved")}
          className={cn(
            "rounded-xl border p-4 text-left transition shadow-sm",
            statusFilter === "approved"
              ? "border-emerald-400 bg-emerald-50/70 ring-2 ring-emerald-300 ring-offset-1"
              : "border-slate-200 bg-white hover:border-slate-300",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Approved</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-950">{counts.approved}</div>
          <div className="mt-1 text-xs text-emerald-800">Published to live schedule</div>
        </button>

        <button
          onClick={() => setStatusFilter("rejected")}
          className={cn(
            "rounded-xl border p-4 text-left transition shadow-sm",
            statusFilter === "rejected"
              ? "border-rose-400 bg-rose-50/70 ring-2 ring-rose-300 ring-offset-1"
              : "border-slate-200 bg-white hover:border-slate-300",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-700">Rejected</span>
            <XCircle className="h-4 w-4 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-950">{counts.rejected}</div>
          <div className="mt-1 text-xs text-rose-800">Returned or declined</div>
        </button>

        <button
          onClick={() => setStatusFilter("all")}
          className={cn(
            "rounded-xl border p-4 text-left transition shadow-sm",
            statusFilter === "all"
              ? "border-indigo-400 bg-indigo-50/70 ring-2 ring-indigo-300 ring-offset-1"
              : "border-slate-200 bg-white hover:border-slate-300",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Total Requests</span>
            <Layers className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-indigo-950">{counts.all}</div>
          <div className="mt-1 text-xs text-indigo-800">All submissions</div>
        </button>
      </div>

      {/* Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by branch, course, college, requester name or reason..."
              className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-4 text-sm placeholder:text-slate-400 focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-medium text-slate-600">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 focus:border-navy-600 focus:outline-none"
            >
              <option value="pending">Pending Approval ({counts.pending})</option>
              <option value="approved">Approved ({counts.approved})</option>
              <option value="rejected">Rejected ({counts.rejected})</option>
              <option value="all">All Statuses ({counts.all})</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <EmptyState
          title={
            statusFilter === "pending"
              ? "No pending timetable requests"
              : "No timetable requests found"
          }
          description={
            statusFilter === "pending"
              ? "All master timetable requests have been reviewed or none have been submitted yet."
              : "Try adjusting your filters or search keywords."
          }
          action={
            <Button size="sm" variant="secondary" onClick={() => { setStatusFilter("all"); setSearch(""); }}>
              Reset Filters
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((req) => {
            const isPending = req.status === "pending";
            const isApproved = req.status === "approved";
            const isRejected = req.status === "rejected";
            const cleanSection = req.sectionName
              ? req.sectionName.replace(/^Section\s+/i, "").trim()
              : null;
            const changesCount = req.changes?.length ?? 0;

            return (
              <Card
                key={req.id}
                className={cn(
                  "p-5 transition hover:shadow-md",
                  isPending && "border-amber-200 bg-amber-50/20",
                  isApproved && "border-slate-200 bg-white",
                  isRejected && "border-rose-100 bg-white",
                )}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  {/* Left Column: Details */}
                  <div className="space-y-2.5 flex-1 min-w-0">
                    {/* Primary Line: Course, Branch, Section, Semester, AY & Status */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">
                        REQ-{String(req.id).padStart(4, "0")}
                      </span>

                      <h3 className="text-base font-bold text-navy-900 tracking-tight">
                        {req.courseName} — {req.branchName}
                        {cleanSection ? ` — Section ${cleanSection}` : ""}
                      </h3>

                      <span className="text-slate-300 font-light select-none">|</span>

                      <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                        Semester {req.semesterNumber}
                      </span>

                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {req.academicYearLabel}
                        {req.batch ? ` (${req.batch})` : ""}
                      </span>

                      {req.versionNo != null ? (
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 font-medium">
                          v{req.versionNo}
                        </span>
                      ) : null}

                      {isPending ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ml-auto sm:ml-0">
                          <Clock3 className="h-3 w-3" /> Pending Principal Approval
                        </span>
                      ) : isApproved ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ml-auto sm:ml-0">
                          <CheckCircle2 className="h-3 w-3" /> Approved & Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800 ml-auto sm:ml-0">
                          <XCircle className="h-3 w-3" /> Rejected
                        </span>
                      )}
                    </div>

                    {/* Subline: College, Plan, Requester metadata */}
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">{req.collegeName}</span>
                      <span>•</span>
                      <span>Plan #{req.planId}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3 text-slate-400" />
                        Submitted by <strong className="text-slate-700">{req.requesterName}</strong> ({req.requesterRoleKey.toUpperCase()})
                      </span>
                      <span>•</span>
                      <span>{new Date(req.createdAt).toLocaleString()}</span>

                      {req.reviewerName ? (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-emerald-700 font-medium">
                            <ShieldCheck className="h-3 w-3 text-emerald-600" />
                            Reviewed by <strong>{req.reviewerName}</strong>
                            {req.reviewedAt ? ` (${new Date(req.reviewedAt).toLocaleDateString()})` : null}
                          </span>
                        </>
                      ) : null}
                    </div>

                    {/* Reason block: category badge & remarks */}
                    <div className="rounded-xl border border-slate-200/90 bg-slate-50/90 p-3 text-xs space-y-1.5 shadow-2xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold uppercase tracking-wider text-slate-500 text-[10.5px]">
                          Change Category:
                        </span>
                        {req.reasonCategory && REASON_CATEGORY_CONFIG[req.reasonCategory] ? (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border shadow-2xs",
                              REASON_CATEGORY_CONFIG[req.reasonCategory].badgeClass,
                            )}
                          >
                            <span>{REASON_CATEGORY_CONFIG[req.reasonCategory].icon}</span>
                            {REASON_CATEGORY_CONFIG[req.reasonCategory].label}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200/80 text-slate-700 border border-slate-300">
                            Master Timetable Modification
                          </span>
                        )}
                      </div>

                      <div className="flex items-start gap-2 pt-0.5">
                        <span className="font-bold text-slate-600 text-xs shrink-0">Remarks:</span>
                        <span className="text-slate-900 font-medium whitespace-pre-line leading-relaxed">
                          {req.changeRemarks || req.reason}
                        </span>
                      </div>
                    </div>

                    {/* COMPACT INLINE UI FOR PROPOSED MODIFICATIONS (Small UI inline instead of large table) */}
                    {changesCount > 0 ? (
                      <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs hover:border-indigo-300 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 text-rose-700 shrink-0">
                              <Calendar className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-xs sm:text-sm">
                                  Proposed Timetable Modifications
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 border border-rose-300 px-2 py-0.5 text-[11px] font-bold text-rose-800">
                                  <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse" />
                                  {changesCount} Changed Slots
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                Faculty & subject schedule adjustments requested for this section.
                              </p>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setPreviewModalRequest(req);
                              setModalTab("side-by-side");
                            }}
                            className="border-indigo-200 bg-indigo-50/80 text-indigo-900 hover:bg-indigo-100 font-bold text-xs shrink-0 self-start sm:self-center cursor-pointer shadow-2xs"
                          >
                            <Columns className="mr-1.5 h-3.5 w-3.5 text-indigo-600" />
                            Compare Master vs Changed (Side-by-Side)
                          </Button>
                        </div>

                        {/* Inline Compact Preview Chips (First 4 changes) */}
                        <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                          {req.changes?.slice(0, 4).map((ch, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/90 px-2 py-1 text-[11px] text-slate-700 shadow-2xs"
                            >
                              <span className="font-bold text-navy-900">{ch.dayOfWeek} {ch.slotLabel}:</span>
                              <span className="text-slate-400 line-through text-[10px] truncate max-w-[85px]" title={ch.fromSubject}>
                                {ch.fromSubject}
                              </span>
                              <ArrowRight className="h-2.5 w-2.5 text-slate-400 shrink-0" />
                              <span className="font-bold text-rose-700 truncate max-w-[110px]" title={ch.toSubject}>
                                {ch.toSubject}
                              </span>
                            </span>
                          ))}
                          {changesCount > 4 ? (
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewModalRequest(req);
                                setModalTab("side-by-side");
                              }}
                              className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 rounded-lg px-2.5 py-1 border border-indigo-200 transition-colors cursor-pointer"
                            >
                              +{changesCount - 4} more · Click for Side-by-Side View
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    {req.reviewComment ? (
                      <div className="rounded-md border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-xs flex items-baseline gap-2">
                        <span className="font-bold uppercase tracking-wider text-indigo-700 text-[11px] shrink-0">
                          Reviewer Remarks:
                        </span>
                        <span className="text-indigo-900 font-medium">{req.reviewComment}</span>
                      </div>
                    ) : null}
                  </div>

                  {/* Right Column: Actions */}
                  <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0 pt-2 lg:pt-0">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setPreviewModalRequest(req);
                        setModalTab("side-by-side");
                      }}
                      title="Inspect Master vs Changed schedule side-by-side"
                      className="cursor-pointer"
                    >
                      <Columns className="mr-1.5 h-3.5 w-3.5 text-indigo-600" />
                      View Timetable (Side-by-Side)
                    </Button>

                    {isPending && canApprove ? (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm cursor-pointer"
                          onClick={() => {
                            setActionModal({ type: "approve", request: req });
                            setActionComment("");
                            setActionError(null);
                          }}
                        >
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                          Approve & Publish
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-900 font-semibold cursor-pointer"
                          onClick={() => {
                            setActionModal({ type: "reject", request: req });
                            setActionComment("");
                            setActionError(null);
                          }}
                        >
                          <XCircle className="mr-1.5 h-3.5 w-3.5 text-rose-600" />
                          Reject
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Approve / Reject Dialog */}
      {actionModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-navy-950">
                  {actionModal.type === "approve"
                    ? "Approve & Publish Master Timetable"
                    : "Reject Timetable Change Request"}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Request REQ-{String(actionModal.request.id).padStart(4, "0")} for{" "}
                  <span className="font-semibold text-slate-700">
                    {actionModal.request.courseName} — {actionModal.request.branchName}
                    {actionModal.request.sectionName ? ` — Section ${actionModal.request.sectionName.replace(/^Section\s+/i, "")}` : ""}
                    {" "}(Sem {actionModal.request.semesterNumber})
                  </span>
                </p>
              </div>
              <button
                onClick={() => setActionModal(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
              >
                ×
              </button>
            </div>

            {actionError ? (
              <div className="mt-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
                {actionError}
              </div>
            ) : null}

            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1.5">
                <div>
                  <span className="font-bold text-slate-700">Requester:</span>{" "}
                  {actionModal.request.requesterName} ({actionModal.request.requesterRoleKey.toUpperCase()})
                </div>
                {actionModal.request.reasonCategory && REASON_CATEGORY_CONFIG[actionModal.request.reasonCategory] ? (
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-700">Change Category:</span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-2xs",
                        REASON_CATEGORY_CONFIG[actionModal.request.reasonCategory].badgeClass,
                      )}
                    >
                      <span>{REASON_CATEGORY_CONFIG[actionModal.request.reasonCategory].icon}</span>
                      {REASON_CATEGORY_CONFIG[actionModal.request.reasonCategory].label}
                    </span>
                  </div>
                ) : null}
                <div>
                  <span className="font-bold text-slate-700">Remarks:</span>{" "}
                  <span className="text-slate-800 font-medium whitespace-pre-line">
                    {actionModal.request.changeRemarks || actionModal.request.reason}
                  </span>
                </div>
              </div>

              {/* Proposed Timetable Modifications Breakdown */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                <div className="border-b border-slate-100 bg-slate-50/80 px-3.5 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-navy-950">
                    <Calendar className="h-4 w-4 text-indigo-600" />
                    <span>Proposed Timetable Modifications</span>
                    <span className="ml-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-800">
                      {actionModal.request.changes?.length ?? 0} {actionModal.request.changes?.length === 1 ? "change" : "changes"}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">Period & Faculty Diff</span>
                </div>

                {actionModal.request.changes && actionModal.request.changes.length > 0 ? (
                  <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                    {actionModal.request.changes.map((ch, idx) => (
                      <div key={idx} className="p-3 text-xs hover:bg-slate-50/60 transition flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="inline-flex items-center rounded-md bg-navy-50 px-2.5 py-1 font-bold text-navy-900 border border-navy-100 text-[11.5px]">
                            {ch.dayLabel} • {ch.slotLabel}
                          </span>
                          {ch.timeRange ? (
                            <span className="text-[11px] font-mono text-slate-500">
                              {ch.timeRange}
                            </span>
                          ) : null}
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="text-slate-400 font-medium">Faculty:</span>
                            <span className="line-through text-slate-400 font-medium">{ch.fromFaculty}</span>
                            <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
                            <span className="font-bold text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              {ch.toFaculty}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className="text-slate-400 font-medium">Subject:</span>
                            {ch.subjectChanged ? (
                              <>
                                <span className="line-through text-slate-400 font-medium">{ch.fromSubject}</span>
                                <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
                                <span className="font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                  {ch.toSubject}
                                </span>
                              </>
                            ) : (
                              <span className="font-medium text-slate-700">{ch.toSubject}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 text-xs text-slate-500 text-center italic">
                    {actionModal.request.proposedChangesSummary || "No slot-level period diffs detected."}
                  </div>
                )}
              </div>

              {actionModal.type === "approve" ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900">
                  Approving this request will immediately publish the modified draft timetable as the next live
                  version for faculty and student attendance.
                </div>
              ) : (
                <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-900">
                  Please provide remarks explaining why this request cannot be approved so the HOD can adjust the
                  schedule accordingly.
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {actionModal.type === "approve" ? "Approval Remarks (Optional)" : "Rejection Reason / Comments *"}
                </label>
                <textarea
                  rows={3}
                  value={actionComment}
                  onChange={(e) => setActionComment(e.target.value)}
                  placeholder={
                    actionModal.type === "approve"
                      ? "Add any notes or instructions for the HOD..."
                      : "State the reason for rejection (e.g., period clashes, teacher workload imbalance)..."
                  }
                  className="w-full rounded-md border border-slate-300 p-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setActionModal(null)}
                disabled={submittingAction}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className={cn(
                  actionModal.type === "approve"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                    : "bg-rose-600 hover:bg-rose-700 text-white font-semibold",
                )}
                onClick={() => void handleConfirmAction()}
                disabled={submittingAction || (actionModal.type === "reject" && !actionComment.trim())}
              >
                {submittingAction
                  ? "Processing..."
                  : actionModal.type === "approve"
                    ? "Confirm Approval & Publish"
                    : "Confirm Rejection"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ============================================================== */}
      {/* DETAILED POP-UP MODAL: MASTER VS CHANGED SIDE-TO-SIDE          */}
      {/* ============================================================== */}
      {previewModalRequest ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-[96vw] xl:max-w-[1600px] max-h-[94vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200/90 bg-white px-5 sm:px-6 py-4 shrink-0 gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">
                    REQ-{String(previewModalRequest.id).padStart(4, "0")}
                  </span>
                  <h3 className="font-bold text-navy-950 text-base sm:text-lg">
                    {previewModalRequest.courseName} — {previewModalRequest.branchName}
                    {previewModalRequest.sectionName
                      ? ` — Section ${previewModalRequest.sectionName.replace(/^Section\s+/i, "")}`
                      : ""}
                  </h3>
                  <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                    Sem {previewModalRequest.semesterNumber}
                  </span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                    {previewModalRequest.academicYearLabel}
                    {previewModalRequest.batch ? ` (${previewModalRequest.batch})` : ""}
                  </span>
                  {previewModalRequest.versionNo != null ? (
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 font-medium">
                      v{previewModalRequest.versionNo}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Submitted by <strong className="text-slate-700">{previewModalRequest.requesterName}</strong> ({previewModalRequest.requesterRoleKey.toUpperCase()}) ·{" "}
                  {previewModalRequest.collegeName} · Plan #{previewModalRequest.planId}
                </p>
              </div>

              {/* View Mode Switcher in Modal */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-0.5 text-xs shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setModalTab("side-by-side")}
                    className={cn(
                      "px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5",
                      modalTab === "side-by-side"
                        ? "bg-white text-navy-950 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900",
                    )}
                  >
                    <Columns className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Side-by-Side</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalTab("day-by-day")}
                    className={cn(
                      "px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5",
                      modalTab === "day-by-day"
                        ? "bg-white text-navy-950 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900",
                    )}
                  >
                    <Split className="h-3.5 w-3.5 text-amber-600" />
                    <span>Day-by-Day</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalTab("proposed-only")}
                    className={cn(
                      "px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5",
                      modalTab === "proposed-only"
                        ? "bg-white text-navy-950 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900",
                    )}
                  >
                    <LayoutGrid className="h-3.5 w-3.5 text-rose-600" />
                    <span>Proposed Grid</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalTab("list")}
                    className={cn(
                      "px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5",
                      modalTab === "list"
                        ? "bg-white text-navy-950 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900",
                    )}
                  >
                    <List className="h-3.5 w-3.5 text-slate-600" />
                    <span>Diff List ({previewModalRequest.changes?.length ?? 0})</span>
                  </button>
                </div>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    router.push(
                      `/timetables?collegeId=${previewModalRequest.collegeId}&courseId=${previewModalRequest.courseId}&branchId=${previewModalRequest.branchId}&semester=${previewModalRequest.semesterNumber}&section=${previewModalRequest.sectionName || "all"}&academicYear=${encodeURIComponent(previewModalRequest.academicYearLabel)}`,
                    )
                  }
                  title="Open in Timetable Planner"
                  className="cursor-pointer"
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
                  Planner
                </Button>

                <button
                  type="button"
                  onClick={() => setPreviewModalRequest(null)}
                  className="rounded-xl p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Close popup"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {/* Remarks Banner */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3.5 text-xs space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-600 uppercase tracking-wider text-[10.5px]">
                      Change Request Remarks:
                    </span>
                    {previewModalRequest.reasonCategory && REASON_CATEGORY_CONFIG[previewModalRequest.reasonCategory] ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border",
                          REASON_CATEGORY_CONFIG[previewModalRequest.reasonCategory].badgeClass,
                        )}
                      >
                        <span>{REASON_CATEGORY_CONFIG[previewModalRequest.reasonCategory].icon}</span>
                        {REASON_CATEGORY_CONFIG[previewModalRequest.reasonCategory].label}
                      </span>
                    ) : null}
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 border border-rose-300 px-2.5 py-0.5 text-[11px] font-bold text-rose-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse" />
                    {previewModalRequest.changes?.length ?? 0} Changed Periods
                  </span>
                </div>
                <p className="text-slate-900 font-medium whitespace-pre-line text-xs leading-relaxed">
                  {previewModalRequest.changeRemarks || previewModalRequest.reason}
                </p>
              </div>

              {/* TAB 1: SIDE-BY-SIDE VIEW (MASTER BASELINE VS PROPOSED CHANGES) */}
              {modalTab === "side-by-side" && (
                <div className="space-y-4">
                  {/* Legend Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
                    <div className="flex items-center gap-4 text-slate-600">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded border border-slate-300 bg-white inline-block" />
                        <span className="font-medium text-slate-700">Unchanged Slot</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded border border-amber-300 bg-amber-100 inline-block" />
                        <span className="font-medium text-amber-900">Original Baseline (Master)</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded border-2 border-rose-500 bg-rose-100 inline-block" />
                        <span className="font-bold text-rose-700">Changed Slot (Proposed)</span>
                      </span>
                    </div>

                    <span className="text-[11px] text-slate-400 italic">
                      Comparing published master baseline against proposed changes side-to-side
                    </span>
                  </div>

                  {/* Dual Grids Side-by-Side */}
                  <div className="grid grid-cols-1 2xl:grid-cols-2 gap-5">
                    {/* LEFT PANEL: MASTER TIMETABLE (PUBLISHED BASELINE) */}
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3.5 sm:p-4 space-y-2.5">
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy-100 text-navy-800">
                            <BookOpen className="h-4 w-4" />
                          </span>
                          <div>
                            <h4 className="font-bold text-navy-950 text-sm">
                              Master Timetable (Published Baseline)
                            </h4>
                            <p className="text-[11px] text-slate-500">
                              Currently published live schedule before requested changes
                            </p>
                          </div>
                        </div>
                        <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                          Original Baseline
                        </span>
                      </div>

                      <MasterTimetableScheduleGrid req={previewModalRequest} compact />
                    </div>

                    {/* RIGHT PANEL: PROPOSED TIMETABLE (REQUESTED CHANGES) */}
                    <div className="rounded-2xl border-2 border-rose-300 bg-rose-50/20 p-3.5 sm:p-4 space-y-2.5">
                      <div className="flex items-center justify-between border-b border-rose-200/80 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-600 text-white">
                            <Calendar className="h-4 w-4" />
                          </span>
                          <div>
                            <h4 className="font-bold text-rose-950 text-sm">
                              Proposed Timetable (Requested Changes)
                            </h4>
                            <p className="text-[11px] text-rose-700 font-medium">
                              Modified slots highlighted with red indications
                            </p>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 border border-rose-300 px-2.5 py-0.5 text-[11px] font-bold text-rose-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse" />
                          {previewModalRequest.changes?.length ?? 0} Changed Slots
                        </span>
                      </div>

                      <ProposedTimetableScheduleGrid req={previewModalRequest} compact />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: DAY-BY-DAY SPLIT COMPARISON */}
              {modalTab === "day-by-day" && (
                <div className="space-y-3">
                  <div className="text-xs text-slate-600 px-1">
                    Direct period-by-period comparison for each day: Master Baseline row immediately followed by the Proposed Changed row.
                  </div>
                  <DayByDaySplitComparisonGrid req={previewModalRequest} />
                </div>
              )}

              {/* TAB 3: PROPOSED GRID ONLY (FULL WIDTH) */}
              {modalTab === "proposed-only" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1 text-xs">
                    <span className="font-bold text-slate-700">Full Proposed Timetable Grid</span>
                    <span className="text-rose-700 font-bold">Red cells indicate requested modifications</span>
                  </div>
                  <ProposedTimetableScheduleGrid req={previewModalRequest} />
                </div>
              )}

              {/* TAB 4: DIFF LIST */}
              {modalTab === "list" && (
                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between">
                    <span className="font-bold text-navy-950 text-xs uppercase tracking-wider">
                      Slot-by-Slot Modifications ({previewModalRequest.changes?.length ?? 0})
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">From published baseline to proposed</span>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
                    {previewModalRequest.changes?.map((ch, idx) => (
                      <div
                        key={idx}
                        className="p-3 text-xs hover:bg-slate-50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                      >
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="inline-flex items-center rounded-md bg-navy-50 px-2.5 py-1 font-bold text-navy-900 border border-navy-100 text-[11.5px]">
                            {ch.dayLabel} • {ch.slotLabel}
                          </span>
                          {ch.timeRange ? (
                            <span className="text-[11px] font-mono text-slate-500">
                              ({ch.timeRange})
                            </span>
                          ) : null}
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="text-slate-400 font-medium">Faculty:</span>
                            <span className="line-through text-slate-400 font-medium">{ch.fromFaculty}</span>
                            <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
                            <span className="font-bold text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              {ch.toFaculty}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className="text-slate-400 font-medium">Subject:</span>
                            {ch.subjectChanged ? (
                              <>
                                <span className="line-through text-slate-400 font-medium">{ch.fromSubject}</span>
                                <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
                                <span className="font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                  {ch.toSubject}
                                </span>
                              </>
                            ) : (
                              <span className="font-medium text-slate-700">{ch.toSubject}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-slate-200/90 bg-slate-50/90 px-5 sm:px-6 py-3.5 shrink-0 gap-3">
              <span className="text-xs text-slate-500">
                Left: Published master baseline. Right: Proposed timetable with changes highlighted in red.
              </span>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setPreviewModalRequest(null)}
                >
                  Close
                </Button>

                {previewModalRequest.status === "pending" && canApprove ? (
                  <>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm cursor-pointer"
                      onClick={() => {
                        const target = previewModalRequest;
                        setPreviewModalRequest(null);
                        setActionModal({ type: "approve", request: target });
                        setActionComment("");
                        setActionError(null);
                      }}
                    >
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                      Approve & Publish
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-900 font-semibold cursor-pointer"
                      onClick={() => {
                        const target = previewModalRequest;
                        setPreviewModalRequest(null);
                        setActionModal({ type: "reject", request: target });
                        setActionComment("");
                        setActionError(null);
                      }}
                    >
                      <XCircle className="mr-1.5 h-3.5 w-3.5 text-rose-600" />
                      Reject
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
