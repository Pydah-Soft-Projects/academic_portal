"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ChevronDown, Download, Printer } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  isNonClassTimingSlot,
  timingSlotCellClass,
  timingSlotDisplayLabel,
} from "@/features/timetables/timing-slot-utils";

type TimingSlot = {
  id: number;
  label: string;
  startTime: string;
  endTime: string;
  slotType: string;
  isAssignable: boolean;
};

type GridCell =
  | {
      kind: "class";
      branchName: string | null;
      year: number | null;
      semester: number | null;
      subjectName: string | null;
      entryType: string;
    }
  | { kind: "break"; label: string }
  | null;

export type FacultyTimetable = {
  timingTemplateId: number;
  timingTemplateName: string | null;
  periodsPerWeek: number;
  days: string[];
  headerSlots: TimingSlot[];
  slotsByDay: Record<string, TimingSlot[]>;
  grid: Record<string, Record<number, GridCell>>;
};

function formatClassCell(cell: Extract<GridCell, { kind: "class" }>) {
  const branch = cell.branchName?.trim() || "Branch";
  const year = cell.year != null ? `Year ${cell.year}` : null;
  const semester = cell.semester != null ? `Sem ${cell.semester}` : null;
  return {
    title: branch,
    subtitle: [year, semester].filter(Boolean).join(" · "),
  };
}

function slotMinutes(startTime: string, endTime: string) {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  if (![sh, sm, eh, em].every(Number.isFinite)) return 0;
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  return end > start ? end - start : 0;
}

function roundHours(minutes: number) {
  return Math.round((minutes / 60) * 10) / 10;
}

function formatPeriodHours(periods: number, minutes: number) {
  const hours = roundHours(minutes);
  const periodLabel = `${periods} period${periods === 1 ? "" : "s"}`;
  return (
    <div className="flex flex-col items-center justify-center text-center leading-tight">
      <span className="font-semibold text-navy-900 print:text-[10px]">{periodLabel}</span>
      {hours > 0 ? (
        <span className="text-[11px] font-normal text-slate-500 print:text-[9px] print:text-slate-600 mt-0.5">
          {hours} hrs
        </span>
      ) : null}
    </div>
  );
}

function findMatchingSlot(daySlots: TimingSlot[], headerSlot: TimingSlot) {
  return (
    daySlots.find(
      (item) =>
        item.label === headerSlot.label && item.startTime === headerSlot.startTime,
    ) ?? null
  );
}

export function WorkloadTimetableGrid({ timetable }: { timetable: FacultyTimetable }) {
  const currentDayLabel = useMemo(() => {
    const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
    return (
      timetable.days.find((d) => d.toLowerCase() === todayName.toLowerCase()) ??
      timetable.days[0] ??
      "Monday"
    );
  }, [timetable.days]);

  const [selectedDay, setSelectedDay] = useState(currentDayLabel);
  const [mobileViewMode, setMobileViewMode] = useState<"day" | "table">("day");

  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const day of timetable.days) {
      initial[day] = day.toLowerCase() === currentDayLabel.toLowerCase();
    }
    return initial;
  });

  useEffect(() => {
    setExpandedDays(() => {
      const initial: Record<string, boolean> = {};
      for (const day of timetable.days) {
        initial[day] = day.toLowerCase() === currentDayLabel.toLowerCase();
      }
      return initial;
    });
  }, [timetable.days, currentDayLabel]);

  const toggleDay = (day: string) => {
    setExpandedDays((prev) => ({ ...prev, [day]: !prev[day] }));
  };

  const { dayTotals, columnTotals, weekTotal } = useMemo(() => {
    const dayTotals = timetable.days.map((day) => {
      const daySlots = timetable.slotsByDay[day] ?? [];
      let periods = 0;
      let minutes = 0;
      for (const slot of daySlots) {
        const cell = timetable.grid[day]?.[slot.id];
        if (cell?.kind !== "class") continue;
        periods += 1;
        minutes += slotMinutes(slot.startTime, slot.endTime);
      }
      return { day, periods, minutes };
    });

    const columnTotals = timetable.headerSlots.map((headerSlot) => {
      let periods = 0;
      let minutes = 0;
      for (const day of timetable.days) {
        const slot = findMatchingSlot(timetable.slotsByDay[day] ?? [], headerSlot);
        if (!slot) continue;
        const cell = timetable.grid[day]?.[slot.id];
        if (cell?.kind !== "class") continue;
        periods += 1;
        minutes += slotMinutes(slot.startTime, slot.endTime);
      }
      return { slotId: headerSlot.id, periods, minutes };
    });

    const weekTotal = dayTotals.reduce(
      (acc, day) => ({
        periods: acc.periods + day.periods,
        minutes: acc.minutes + day.minutes,
      }),
      { periods: 0, minutes: 0 },
    );

    return { dayTotals, columnTotals, weekTotal };
  }, [timetable]);

  const dayTotalByDay = useMemo(
    () => new Map(dayTotals.map((item) => [item.day, item])),
    [dayTotals],
  );
  const columnTotalBySlot = useMemo(
    () => new Map(columnTotals.map((item) => [item.slotId, item])),
    [columnTotals],
  );

  const selectedDaySlots = useMemo(
    () => timetable.slotsByDay[selectedDay] ?? timetable.headerSlots,
    [timetable.slotsByDay, timetable.headerSlots, selectedDay],
  );

  const selectedDayTotal = dayTotalByDay.get(selectedDay);

  return (
    <Card className="mb-4 print:p-2 print:border-0 print:shadow-none print:mb-0">
      <div className="mb-3 sm:mb-4 flex items-center justify-between gap-2 print:hidden">
        <div>
          <h3 className="text-sm sm:text-base font-bold sm:font-semibold text-navy-900">
            <span className="sm:hidden">TimeTable</span>
            <span className="hidden sm:inline">Weekly teaching schedule</span>
          </h3>
          <p className="hidden sm:block text-sm text-slate-500 mt-0.5">
            {timetable.timingTemplateName
              ? `Timing: ${timetable.timingTemplateName}`
              : "Published college timing slots"}
            {" · "}
            {timetable.periodsPerWeek} period
            {timetable.periodsPerWeek === 1 ? "" : "s"} / week across all branches
          </p>
        </div>

        {/* Desktop Download PDF button */}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => window.print()}
          className="hidden sm:inline-flex print:hidden shrink-0"
        >
          <Printer className="mr-2 h-4 w-4" /> Download PDF
        </Button>

        {/* Mobile controls: Day view / Full grid switcher on left side of Download button */}
        <div className="flex sm:hidden items-center gap-1.5 shrink-0">
          <div className="flex items-center rounded-lg border border-border bg-slate-100 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setMobileViewMode("day")}
              className={cn(
                "px-2 py-1 rounded-md font-medium transition-all text-xs",
                mobileViewMode === "day"
                  ? "bg-white text-navy-900 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-navy-900"
              )}
            >
              Day view
            </button>
            <button
              type="button"
              onClick={() => setMobileViewMode("table")}
              className={cn(
                "px-2 py-1 rounded-md font-medium transition-all text-xs",
                mobileViewMode === "table"
                  ? "bg-white text-navy-900 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-navy-900"
              )}
            >
              Full grid
            </button>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.print()}
            className="shrink-0 h-8 w-8 p-0 inline-flex items-center justify-center rounded-lg"
            title="Download PDF"
            aria-label="Download PDF"
          >
            <Download className="h-4 w-4 text-slate-700" />
          </Button>
        </div>
      </div>

      {/* 1. Mobile View (Screens < 640px) */}
      <div className="block sm:hidden space-y-3 print:hidden">

        {mobileViewMode === "day" ? (
          <div className="space-y-3">
            {/* Day Selector Pills */}
            <div className="grid grid-cols-6 gap-1">
              {timetable.days.map((day) => {
                const isSelected = day === selectedDay;
                const total = dayTotalByDay.get(day);
                const count = total?.periods ?? 0;
                const isToday = day.toLowerCase() === currentDayLabel.toLowerCase();

                return (
                  <button
                    key={`mob-pill-${day}`}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={cn(
                      "flex flex-col items-center justify-center py-2 px-1 rounded-lg text-center transition-all border",
                      isSelected
                        ? "bg-brand-600 border-brand-700 text-white shadow-xs font-bold"
                        : isToday
                        ? "bg-brand-50 border-brand-200 text-brand-900 font-semibold"
                        : "bg-slate-50 border-border text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    <span className="text-xs">{day.slice(0, 3)}</span>
                    <span
                      className={cn(
                        "text-[10px] mt-0.5 font-normal",
                        isSelected ? "text-white/90" : "text-slate-500"
                      )}
                    >
                      {count} {count === 1 ? "cls" : "cls"}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selected Day Header summary */}
            <div className="flex items-center justify-between px-0.5 py-1 border-b border-border text-xs">
              <span className="font-bold text-navy-900">
                {selectedDay}
              </span>
              <span className="text-slate-600 text-xs font-medium">
                {selectedDayTotal && selectedDayTotal.periods > 0
                  ? `${selectedDayTotal.periods} ${selectedDayTotal.periods === 1 ? "period" : "periods"} · ${roundHours(selectedDayTotal.minutes)} hrs`
                  : "No classes scheduled"}
              </span>
            </div>

            {/* Slots for Selected Day */}
            <div className="space-y-2">
              {selectedDaySlots.map((slot) => {
                const cell = timetable.grid[selectedDay]?.[slot.id] ?? null;

                if (cell?.kind === "break") {
                  return (
                    <div
                      key={`mob-${selectedDay}-${slot.id}`}
                      className="flex items-center justify-between rounded-lg border border-amber-300/90 border-l-[3.5px] border-l-amber-500 bg-amber-50/80 text-amber-950 p-2.5 text-xs font-semibold"
                    >
                      <span>{cell.label}</span>
                      <span className="text-[11px] font-normal opacity-85">
                        {slot.startTime}–{slot.endTime}
                      </span>
                    </div>
                  );
                }

                if (cell?.kind === "class") {
                  const classCell = formatClassCell(cell);
                  const isLab = (cell.entryType || "").toLowerCase().includes("lab");

                  return (
                    <div
                      key={`mob-${selectedDay}-${slot.id}`}
                      className={cn(
                        "rounded-lg p-3 space-y-1.5 shadow-2xs border-l-[3.5px]",
                        isLab
                          ? "border border-purple-300/90 border-l-purple-600 bg-purple-50/70"
                          : "border border-blue-300/90 border-l-blue-600 bg-blue-50/70"
                      )}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">
                          {slot.label} · {slot.startTime}–{slot.endTime}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                            isLab
                              ? "bg-purple-100 text-purple-700 border border-purple-200"
                              : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                          )}
                        >
                          {cell.entryType || "Theory"}
                        </span>
                      </div>

                      <div>
                        <p className="font-bold text-sm text-navy-900 leading-tight">
                          {cell.subjectName || classCell.title}
                        </p>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {classCell.title} · {classCell.subtitle}
                        </p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={`mob-${selectedDay}-${slot.id}`}
                    className="flex items-center justify-between rounded-lg border border-dashed border-slate-300 border-l-[3.5px] border-l-slate-400 bg-slate-50/70 p-2.5 text-xs text-slate-500"
                  >
                    <span>{slot.label} · {slot.startTime}–{slot.endTime}</span>
                    <span className="text-[11px] italic">Free Period</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Mobile Full Grid: 100% full-width vertical schedule with ZERO horizontal scrolling */
          <div className="space-y-3">

            <div className="space-y-2.5">
              {timetable.days.map((day) => {
                const daySlots = timetable.slotsByDay[day] ?? [];
                const dayTotal = dayTotalByDay.get(day);
                const count = dayTotal?.periods ?? 0;
                const isToday = day.toLowerCase() === currentDayLabel.toLowerCase();
                const isOpen = expandedDays[day] ?? true;

                return (
                  <div
                    key={`all-days-${day}`}
                    className={cn(
                      "rounded-xl border transition-all overflow-hidden",
                      isToday ? "border-brand-300 bg-brand-50/20" : "border-border bg-card"
                    )}
                  >
                    {/* Day Header Button (Click to toggle) */}
                    <button
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={cn(
                        "w-full flex items-center justify-between p-3 text-left transition-colors",
                        isToday ? "bg-brand-50/50" : "bg-slate-50/80 hover:bg-slate-100/70"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-navy-900">{day}</span>
                        {isToday ? (
                          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-700">
                            Today
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-medium">
                          {count > 0 ? `${count} ${count === 1 ? "class" : "classes"}` : "No classes"}
                        </span>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 text-slate-400 transition-transform duration-200",
                            isOpen && "rotate-180"
                          )}
                        />
                      </div>
                    </button>

                    {/* Day Periods (When open) */}
                    {isOpen ? (
                      <div className="p-2.5 space-y-2 border-t border-border/80">
                        {daySlots.map((slot) => {
                          const cell = timetable.grid[day]?.[slot.id] ?? null;

                          if (cell?.kind === "break") {
                            return (
                              <div
                                key={`all-${day}-${slot.id}`}
                                className="flex items-center justify-between rounded-lg border border-amber-300/90 border-l-[3.5px] border-l-amber-500 bg-amber-50/80 text-amber-950 p-2 text-xs font-semibold"
                              >
                                <span>{cell.label}</span>
                                <span className="text-[11px] font-normal opacity-85">
                                  {slot.startTime}–{slot.endTime}
                                </span>
                              </div>
                            );
                          }

                          if (cell?.kind === "class") {
                            const classCell = formatClassCell(cell);
                            const isLab = (cell.entryType || "").toLowerCase().includes("lab");

                            return (
                              <div
                                key={`all-${day}-${slot.id}`}
                                className={cn(
                                  "rounded-lg p-2.5 space-y-1 shadow-2xs border-l-[3.5px]",
                                  isLab
                                    ? "border border-purple-300/90 border-l-purple-600 bg-purple-50/70"
                                    : "border border-blue-300/90 border-l-blue-600 bg-blue-50/70"
                                )}
                              >
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-semibold text-slate-700">
                                    {slot.label} · {slot.startTime}–{slot.endTime}
                                  </span>
                                  <span
                                    className={cn(
                                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                                      isLab
                                        ? "bg-purple-100 text-purple-700 border border-purple-200"
                                        : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                    )}
                                  >
                                    {cell.entryType || "Theory"}
                                  </span>
                                </div>

                                <div>
                                  <p className="font-bold text-xs text-navy-900 leading-tight">
                                    {cell.subjectName || classCell.title}
                                  </p>
                                  <p className="text-[11px] text-slate-600 mt-0.5">
                                    {classCell.title} · {classCell.subtitle}
                                  </p>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={`all-${day}-${slot.id}`}
                              className="flex items-center justify-between rounded-lg border border-dashed border-slate-300 border-l-[3.5px] border-l-slate-400 bg-slate-50/70 p-2 text-xs text-slate-500"
                            >
                              <span>{slot.label} · {slot.startTime}–{slot.endTime}</span>
                              <span className="text-[11px] italic">Free Period</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 2. Desktop View (Screens >= 640px) */}
      <div className="hidden sm:block overflow-x-auto print:overflow-visible rounded-lg border border-border print:border-slate-400 bg-card">
        <table className="w-full min-w-full table-fixed border-collapse text-xs sm:text-sm">
          <colgroup>
            <col style={{ width: "5rem" }} />
            {timetable.headerSlots.map((slot) => (
              <col key={slot.id} />
            ))}
            <col style={{ width: "5.5rem" }} />
          </colgroup>
          <thead>
            <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <th className="border-b border-r border-border px-2 py-2 text-left print:text-center print:py-1">Day</th>
              {timetable.headerSlots.map((slot) => {
                const nonClass = isNonClassTimingSlot(slot);
                return (
                  <th key={slot.id} className="border-b border-r border-border px-2 py-2 text-center print:py-1">
                    <div className="truncate">
                      {nonClass ? timingSlotDisplayLabel(slot) : slot.label}
                    </div>
                    <div className="truncate font-normal normal-case text-[10px] text-slate-400">
                      {nonClass ? slot.label : null}
                      {nonClass ? " · " : null}
                      {slot.startTime}–{slot.endTime}
                    </div>
                  </th>
                );
              })}
              <th className="border-b border-r-0 border-border bg-slate-100 px-2 py-2 text-center print:py-1">
                Day total
              </th>
            </tr>
          </thead>
          <tbody>
            {timetable.days.map((day) => {
              const daySlots = timetable.slotsByDay[day] ?? [];
              const dayTotal = dayTotalByDay.get(day);
              return (
                <tr key={day}>
                  <td className="border-b border-r border-border px-2 py-2 font-medium text-navy-900 print:text-center">
                    {day}
                  </td>
                  {timetable.headerSlots.map((headerSlot) => {
                    const slot = findMatchingSlot(daySlots, headerSlot);

                    if (!slot) {
                      return (
                        <td
                          key={`${day}-${headerSlot.id}`}
                          className="border-b border-r border-border bg-slate-50/60 p-1 print:p-0.5"
                        />
                      );
                    }

                    const cell = timetable.grid[day]?.[slot.id] ?? null;

                    if (cell?.kind === "break") {
                      return (
                        <td key={`${day}-${slot.id}`} className="border-b border-r border-border p-1 print:p-0.5 text-center">
                          <div
                            className={cn(
                              "flex min-h-[88px] print:min-h-0 print:h-[72px] flex-col items-center justify-center rounded-md text-xs font-semibold px-1 text-center",
                              timingSlotCellClass(slot),
                            )}
                          >
                            <span>{cell.label}</span>
                            <span className="mt-0.5 text-[10px] font-normal opacity-80 print:hidden">
                              {slot.startTime}–{slot.endTime}
                            </span>
                          </div>
                        </td>
                      );
                    }

                    const classCell =
                      cell?.kind === "class" ? formatClassCell(cell) : null;

                    return (
                      <td key={`${day}-${slot.id}`} className="border-b border-r border-border p-1 print:p-0.5 text-center">
                        <div
                          className={cn(
                            "min-h-[88px] print:min-h-0 print:h-[72px] w-full rounded-md border px-1.5 py-1.5 print:py-1 text-left print:text-center flex flex-col justify-between print:justify-center print:items-center overflow-hidden",
                            classCell
                              ? "border-border bg-blue-50/70"
                              : "border-border bg-slate-50",
                          )}
                        >
                          {classCell ? (
                            <div className="flex flex-col justify-between print:justify-center items-stretch print:items-center h-full w-full space-y-0.5 text-left print:text-center">
                              <div className="w-full text-left print:text-center">
                                <p className="line-clamp-2 font-bold text-xs leading-tight text-navy-900 print:text-[10.5px] print:leading-snug print:text-center">
                                  {classCell.title}
                                </p>
                                {classCell.subtitle ? (
                                  <p className="text-[10px] text-slate-600 print:text-[9.5px] print:text-slate-500 mt-0.5 print:text-center">
                                    {classCell.subtitle}
                                  </p>
                                ) : null}
                              </div>
                              {cell?.kind === "class" && cell.subjectName ? (
                                <div className="mt-auto print:mt-1 pt-0.5 print:pt-0.5 w-full text-left print:text-center">
                                  <p className="line-clamp-2 text-[10px] font-medium text-slate-500 print:text-[9px] print:text-slate-600 print:text-center print:leading-tight">
                                    {cell.subjectName}
                                    {cell.entryType ? ` · ${cell.entryType}` : ""}
                                  </p>
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center h-full w-full min-h-[60px] print:min-h-0 text-center">
                              <p className="text-xs text-slate-400 print:hidden">—</p>
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="border-b border-r-0 border-border bg-slate-50 px-1 sm:px-2 py-2 text-xs sm:text-sm font-medium text-navy-900 print:text-center print:text-xs">
                    {dayTotal && dayTotal.periods > 0
                      ? formatPeriodHours(dayTotal.periods, dayTotal.minutes)
                      : "—"}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-slate-50">
              <td className="border-b border-r border-border px-2 py-2 text-xs sm:text-sm font-semibold text-navy-900 print:text-center print:text-xs">
                Total
              </td>
              {timetable.headerSlots.map((headerSlot) => {
                const total = columnTotalBySlot.get(headerSlot.id);
                return (
                  <td
                    key={`total-${headerSlot.id}`}
                    className="border-b border-r border-border px-1.5 sm:px-2 py-2 text-xs font-medium text-slate-600 print:text-center print:text-[10px]"
                  >
                    {total && total.periods > 0
                      ? formatPeriodHours(total.periods, total.minutes)
                      : "—"}
                  </td>
                );
              })}
              <td className="border-b border-r-0 border-border bg-navy-50 px-1 sm:px-2 py-2 text-xs sm:text-sm font-semibold text-navy-900 print:text-center print:text-xs">
                {formatPeriodHours(weekTotal.periods, weekTotal.minutes)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}
