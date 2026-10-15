"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAcademicContext } from "@/components/layout/AcademicProvider";
import { TimetableSummary } from "./TimetableSummary";
import { TimetableTodayPanel } from "./TimetableTodayPanel";
import { DateSubstitutionsPanel } from "./DateSubstitutionsPanel";
import {
  formatNavigationWeekLabel,
  TimetableWeekNavigation,
} from "./TimetableWeekNavigation";
import { useMyTimetable } from "./useMyTimetable";
import { WorkloadTimetableGrid } from "@/features/workload/WorkloadTimetableGrid";
import {
  getTodayDayCode,
  getWeekDates,
  hasActiveAcademicFilters,
  linkedAccountMessage,
  startOfWeekMonday,
} from "./utils";

import { Skeleton } from "@/components/ui/Skeleton";
import { StatCardSkeleton } from "@/components/ui/CardSkeleton";

const PAGE_DESCRIPTION = "Your published teaching schedule for the selected week.";

function TimetableSkeleton() {
  return (
    <div className="space-y-4 portal-fade-in">
      <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card shadow-2xs">
        <Skeleton className="h-8 w-32 rounded-lg" />
        <Skeleton className="h-5 w-44 rounded" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <StatCardSkeleton key={index} compact />
        ))}
      </div>
      <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-36 rounded" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-20 w-full rounded-lg" variant="subtle" />
      </div>
      <Skeleton className="h-72 w-full rounded-xl" variant="subtle" />
    </div>
  );
}

export function MyTimetableView() {
  const { filters } = useAcademicContext();
  const { payload, loading, error, reload } = useMyTimetable();
  const [weekOffset, setWeekOffset] = useState(0);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const todayCode = getTodayDayCode();
  const isCurrentWeek = weekOffset === 0;
  const filtersActive = hasActiveAcademicFilters(filters);

  const todayDay = useMemo(
    () => payload?.weekDays.find((day) => day.dayOfWeek === todayCode),
    [payload?.weekDays, todayCode],
  );

  const classesToday = todayDay?.classCount ?? 0;

  if (loading) {
    return (
      <div>
        <PageHeader title="My Timetable" description={PAGE_DESCRIPTION} />
        <TimetableSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="My Timetable" description={PAGE_DESCRIPTION} />
        <EmptyState
          title="Unable to load timetable"
          description="We couldn't retrieve your published timetable. Please try again."
          action={
            <Button type="button" size="sm" onClick={() => void reload()}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  if (!payload?.linked) {
    return (
      <div>
        <PageHeader title="My Timetable" description={PAGE_DESCRIPTION} />
        <EmptyState
          title="Account not linked"
          description={linkedAccountMessage(payload)}
        />
      </div>
    );
  }

  if (!payload.published) {
    return (
      <div>
        <PageHeader title="My Timetable" description={PAGE_DESCRIPTION} />
        <EmptyState
          title="No published timetable available"
          description={
            filtersActive
              ? "No classes match the current academic filters. Try adjusting the filters above or contact your HOD if you believe this is incorrect."
              : "Your timetable has not been assigned or published yet. Contact your HOD or academic administrator if you believe this is incorrect."
          }
        />
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <PageHeader
        title="My Timetable"
        description={PAGE_DESCRIPTION}
      />

      <div className="mb-4">
        <TimetableWeekNavigation
          weekLabel={formatNavigationWeekLabel(weekDates.start, weekDates.end)}
          onPrevious={() => setWeekOffset((value) => value - 1)}
          onNext={() => setWeekOffset((value) => value + 1)}
          onToday={() => setWeekOffset(0)}
          onDateSelect={(selectedDate) => {
            const currentMonday = startOfWeekMonday(new Date(), 0);
            const targetMonday = startOfWeekMonday(selectedDate, 0);
            const diffDays = Math.round((targetMonday.getTime() - currentMonday.getTime()) / (1000 * 60 * 60 * 24));
            setWeekOffset(Math.round(diffDays / 7));
          }}
          isCurrentWeek={isCurrentWeek}
        />
      </div>

      {payload.summary ? (
        <div className="mb-4">
          <TimetableSummary
            classesToday={classesToday}
            periodsThisWeek={payload.summary.periodsThisWeek}
            theory={payload.summary.theory}
            lab={payload.summary.lab}
          />
        </div>
      ) : null}

      {isCurrentWeek ? (
        <>
          <TimetableTodayPanel
            todayDay={todayDay}
            classesToday={classesToday}
            todayCode={todayCode}
            now={now}
          />
          <DateSubstitutionsPanel sessionDate={now.toISOString().slice(0, 10)} />
        </>
      ) : null}

      {payload.timetable ? (
        <div className="mb-4">
          <WorkloadTimetableGrid timetable={payload.timetable} />
        </div>
      ) : (
        <EmptyState
          title="No classes scheduled for this week"
          description={
            filtersActive
              ? "No classes match the current academic filters for this weekly schedule."
              : "Your published timetable does not include any classes for the selected week."
          }
          className="mb-4"
        />
      )}

      <p className="mt-4 text-center text-xs text-slate-400">
        Read-only view of your published teaching schedule.
      </p>
    </div>
  );
}
