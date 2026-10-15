import { Clock3 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { MyTimetableDay } from "./types";
import {
  buildCourseSectionLine,
  findCurrentClass,
  findNextClass,
  formatLongDate,
  formatTime12h,
  getTodayTeachingStatus,
  todayStatusMessage,
  type TodayTeachingStatus,
} from "./utils";

type Props = {
  todayDay: MyTimetableDay | undefined;
  classesToday: number;
  todayCode: string;
  now: Date;
};

function StatusDetail({
  status,
  todayDay,
  now,
}: {
  status: TodayTeachingStatus;
  todayDay: MyTimetableDay | undefined;
  now: Date;
}) {
  const currentClass = findCurrentClass(todayDay, now);
  const nextClass = findNextClass(todayDay, now);

  if (status === "in-class" && currentClass) {
    return (
      <div className="min-w-0 flex-1 rounded-lg border border-brand-200 bg-white p-3 shadow-sm sm:max-w-sm">
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-700">
          Current class
        </p>
        <p className="mt-1 break-words text-sm font-semibold text-navy-900">
          {currentClass.subjectName ?? currentClass.subjectCode}
        </p>
        <p className="text-xs text-slate-500">
          Until {formatTime12h(currentClass.endTime)}
          {currentClass.roomLabel ? ` • Room ${currentClass.roomLabel}` : ""}
        </p>
      </div>
    );
  }

  if ((status === "before-first" || status === "between-classes") && nextClass) {
    return (
      <div className="min-w-0 flex-1 rounded-lg border border-border bg-white p-3 shadow-sm sm:max-w-sm">
        {/* Mobile: Next class on left, time (e.g. 1:45 PM) on right side */}
        <div className="flex sm:hidden items-center justify-between">
          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Next class
          </p>
          <span className="text-xs font-bold text-navy-900">
            {formatTime12h(nextClass.startTime)}
          </span>
        </div>

        {/* Desktop: unchanged */}
        <div className="hidden sm:block">
          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Next class
          </p>
          <p className="mt-1 text-sm font-semibold text-navy-900">
            {formatTime12h(nextClass.startTime)}
          </p>
        </div>

        <p className="mt-1 sm:mt-0 break-words text-sm text-navy-900">
          {nextClass.subjectName ?? nextClass.subjectCode}
        </p>
        <p className="break-words text-xs text-slate-500">
          {buildCourseSectionLine(nextClass)}
          {nextClass.roomLabel ? ` • Room ${nextClass.roomLabel}` : ""}
        </p>
      </div>
    );
  }

  return null;
}

export function TimetableTodayPanel({ todayDay, classesToday, todayCode, now }: Props) {
  const status = getTodayTeachingStatus(
    todayDay,
    todayCode as "SUN" | "MON" | "TUE" | "WED" | "THUR" | "FRI" | "SAT",
    now,
  );

  return (
    <Card className="mb-3 sm:mb-4 border-brand-200/70 bg-brand-50/25 p-3 sm:p-4 rounded-xl shadow-2xs">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {/* Mobile view: "Today" on left, "Thursday, 15 October" on right side */}
          <div className="sm:hidden">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-700">Today</p>
              <span className="text-xs font-semibold text-slate-700">
                {now.toLocaleDateString("en-IN", { weekday: "long" })}, {now.toLocaleDateString("en-IN", { day: "numeric", month: "long" })}
              </span>
            </div>
          </div>

          {/* Desktop view: unchanged */}
          <div className="hidden sm:block">
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-700">Today</p>
            <h2 className="text-base font-bold text-navy-900">{formatLongDate(now)}</h2>
          </div>

          <p className="hidden sm:block mt-0.5 text-xs sm:text-sm text-slate-600">{todayStatusMessage(status)}</p>
          {classesToday > 0 ? (
            <p className="hidden sm:block mt-0.5 text-[11px] sm:text-xs text-slate-500">
              {classesToday} scheduled {classesToday === 1 ? "class" : "classes"}
            </p>
          ) : null}
        </div>

        <StatusDetail status={status} todayDay={todayDay} now={now} />
      </div>
    </Card>
  );
}
