"use client";

import React from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";

export interface HodDashboardSkeletonProps {
  className?: string;
}

/**
 * Pixel-accurate Skeleton matching the HOD Dashboard page layout:
 * - Top Bar: Title + Department Dropdown + Refresh button | Date Badge + HOD Profile avatar
 * - Row 1: Student Attendance Overview (Span 8: 4 KPI Cards + Benchmark Bar + 8 Section Breakdown Cards)
 *          + Today's Priorities (Span 4: 7 Alert Items)
 * - Row 2: Students at Risk (Span 12: 4 Section Cards with 3-column metric grid)
 * - Row 3: Subjects Behind Schedule (Span 7: Table with 4 rows)
 *          + Fee Due Age Wise (Span 5: Total Pending Banner + 3 Age Buckets)
 * - Row 4: 3 Operational Cards (Faculty Attendance & Leave + Examination Status + Placements & Training)
 */
export function HodDashboardSkeleton({ className }: HodDashboardSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading HOD dashboard…"
      className={cn("space-y-4 pb-12 font-sans antialiased portal-fade-in select-none text-slate-800", className)}
    >


      {/* ─────────────────────────────────────────────────────────────
          ROW 1: Student Attendance (Left) + Today's Priorities (Right)
      ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Student Attendance (Span 8) */}
        <div className="lg:col-span-8 bg-transparent sm:bg-white rounded-none sm:rounded-2xl border-0 sm:border border-slate-200/90 p-0 sm:p-5 shadow-none sm:shadow-xs flex flex-col justify-between gap-3 sm:gap-4">
          {/* Top Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-0 sm:pb-3 sm:border-b sm:border-slate-100">
            <div className="flex items-center gap-2.5">
              <Skeleton className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl shrink-0" />
              <div className="space-y-1">
                <Skeleton className="h-4 sm:h-5 w-44 sm:w-56 rounded" />
                <Skeleton className="h-3 w-32 sm:w-44 rounded" variant="subtle" />
              </div>
            </div>
            <Skeleton className="h-6 w-28 rounded-full" variant="pill" />
          </div>

          {/* Middle 4-Column Primary Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2.5">
            {/* 1. Overall Attendance */}
            <div className="bg-linear-to-b from-blue-50/70 to-indigo-50/30 border border-blue-100/90 rounded-xl p-2 sm:p-2.5 flex flex-col justify-between h-[82px] sm:h-[92px]">
              <Skeleton className="h-2.5 w-20 rounded" variant="subtle" />
              <Skeleton className="h-6 sm:h-7 w-12 sm:w-16 my-0.5 rounded" />
              <Skeleton className="h-3.5 w-16 rounded-md" variant="subtle" />
            </div>

            {/* 2. Present Students */}
            <div className="bg-emerald-50/50 border border-emerald-100/80 rounded-xl p-2 sm:p-2.5 flex flex-col justify-between h-[82px] sm:h-[92px]">
              <Skeleton className="h-2.5 w-14 rounded" variant="subtle" />
              <Skeleton className="h-6 sm:h-7 w-12 my-0.5 rounded" />
              <Skeleton className="h-3 w-14 rounded" variant="subtle" />
            </div>

            {/* 3. Absent Students */}
            <div className="bg-rose-50/50 border border-rose-100/80 rounded-xl p-2 sm:p-2.5 flex flex-col justify-between h-[82px] sm:h-[92px]">
              <Skeleton className="h-2.5 w-20 rounded" variant="subtle" />
              <Skeleton className="h-6 sm:h-7 w-12 my-0.5 rounded" />
              <Skeleton className="h-3 w-14 rounded" variant="subtle" />
            </div>

            {/* 4. Enrolled Total */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2 sm:p-2.5 flex flex-col justify-between h-[82px] sm:h-[92px]">
              <Skeleton className="h-2.5 w-16 rounded" variant="subtle" />
              <Skeleton className="h-6 sm:h-7 w-12 my-0.5 rounded" />
              <Skeleton className="h-3 w-18 rounded" variant="subtle" />
            </div>
          </div>

          {/* Visual Benchmark Gauge Line */}
          <div className="space-y-1 bg-slate-50/80 border border-slate-200/70 rounded-xl p-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-40 rounded" variant="subtle" />
              <Skeleton className="h-3 w-20 rounded" variant="subtle" />
            </div>
            <div className="relative w-full h-2 bg-slate-200/80 rounded-full overflow-hidden">
              <div className="h-full w-2/3 bg-slate-300 rounded-full portal-shimmer" />
            </div>
          </div>

          {/* Bottom Section-wise Breakdown */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-40 rounded" />
              <Skeleton className="h-3 w-28 rounded" variant="subtle" />
            </div>

            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 sm:gap-2">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-slate-200/90 rounded-xl p-2 flex flex-col justify-between h-[66px] sm:h-[72px]"
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <Skeleton className="h-3 w-12 rounded" />
                    <Skeleton className="h-3.5 w-10 rounded-md" variant="subtle" />
                  </div>
                  {/* 7 Period Blocks Skeleton */}
                  <div className="grid grid-cols-7 gap-1 my-1">
                    {Array.from({ length: 7 }).map((_, pIdx) => (
                      <div key={pIdx} className="h-1.5 rounded-xs bg-slate-100 portal-shimmer" />
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <Skeleton className="h-2 w-14 rounded" variant="subtle" />
                    <Skeleton className="h-2 w-8 rounded" variant="subtle" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Today's Priorities (Span 4) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-rose-100/90 p-4 sm:p-5 shadow-xs flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Skeleton className="w-5 h-5 rounded-full" variant="circular" />
              <Skeleton className="h-5 w-36 rounded" />
            </div>
            <Skeleton className="h-5 w-6 rounded-full" variant="pill" />
          </div>

          {/* List of 7 Priorities */}
          <div className="space-y-1.5">
            {Array.from({ length: 7 }).map((_, idx) => (
              <div
                key={idx}
                className="w-full flex items-center justify-between p-2 rounded-xl border border-transparent"
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-1 flex-1">
                  <Skeleton className="w-5 h-5 rounded-full shrink-0" variant="circular" />
                  <Skeleton
                    className="h-3.5 rounded flex-1"
                    style={{ maxWidth: `${80 + (idx % 3) * 30}px` }}
                  />
                </div>
                <Skeleton className="w-4 h-4 rounded shrink-0" variant="subtle" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          ROW 2: Students at Risk (Section Breakdown)
      ────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs">
        {/* Header */}
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-5 w-48 rounded" />
            <Skeleton className="w-4 h-4 rounded-full" variant="circular" />
          </div>
          <Skeleton className="h-3.5 w-20 rounded" variant="subtle" />
        </div>

        {/* 4 Section Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-slate-200/80 overflow-hidden bg-slate-50/30"
            >
              {/* Card Header Strip */}
              <div className="px-3 py-1.5 border-b bg-slate-100/70 border-slate-200 flex justify-center">
                <Skeleton className="h-3.5 w-16 rounded" />
              </div>

              {/* 3 Metric Columns */}
              <div className="grid grid-cols-3 divide-x divide-slate-100 p-2.5 text-center bg-white">
                <div className="flex flex-col items-center">
                  <Skeleton className="h-6 w-8 rounded" />
                  <Skeleton className="h-2 w-12 rounded mt-1.5" variant="subtle" />
                  <Skeleton className="h-2 w-10 rounded mt-0.5" variant="subtle" />
                </div>
                <div className="flex flex-col items-center">
                  <Skeleton className="h-6 w-8 rounded" />
                  <Skeleton className="h-2 w-12 rounded mt-1.5" variant="subtle" />
                  <Skeleton className="h-2 w-10 rounded mt-0.5" variant="subtle" />
                </div>
                <div className="flex flex-col items-center">
                  <Skeleton className="h-6 w-8 rounded" />
                  <Skeleton className="h-2 w-12 rounded mt-1.5" variant="subtle" />
                  <Skeleton className="h-2 w-10 rounded mt-0.5" variant="subtle" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          ROW 3: Subjects Behind Schedule (Left) + Fee Due Age Wise (Right)
      ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Subjects Behind Schedule (Span 7) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Skeleton className="w-8 h-8 rounded-lg" />
                <Skeleton className="h-5 w-44 rounded" />
              </div>
              <Skeleton className="h-3.5 w-16 rounded" variant="subtle" />
            </div>

            {/* Table */}
            <div className="overflow-x-auto -mx-1 sm:mx-0">
              <table className="w-full min-w-[520px] text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 pb-2">
                    <th className="pb-2 w-2/5"><Skeleton className="h-3 w-16 rounded" variant="subtle" /></th>
                    <th className="pb-2 text-center"><Skeleton className="h-3 w-12 rounded mx-auto" variant="subtle" /></th>
                    <th className="pb-2 text-center"><Skeleton className="h-3 w-14 rounded mx-auto" variant="subtle" /></th>
                    <th className="pb-2 text-center"><Skeleton className="h-3 w-10 rounded mx-auto" variant="subtle" /></th>
                    <th className="pb-2 text-center"><Skeleton className="h-3 w-16 rounded mx-auto" variant="subtle" /></th>
                    <th className="pb-2 text-center"><Skeleton className="h-3 w-12 rounded mx-auto" variant="subtle" /></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 pr-2">
                        <Skeleton className="h-3.5 w-36 rounded mb-1" />
                        <Skeleton className="h-2.5 w-24 rounded" variant="subtle" />
                      </td>
                      <td className="py-2.5 text-center"><Skeleton className="h-3.5 w-6 rounded mx-auto" /></td>
                      <td className="py-2.5 text-center"><Skeleton className="h-3.5 w-6 rounded mx-auto" /></td>
                      <td className="py-2.5 text-center"><Skeleton className="h-3.5 w-10 rounded mx-auto" /></td>
                      <td className="py-2.5 text-center"><Skeleton className="h-3.5 w-8 rounded mx-auto" /></td>
                      <td className="py-2.5 text-center">
                        <Skeleton className="h-5 w-14 rounded-full mx-auto" variant="pill" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Fee Due Age Wise (Span 5) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Skeleton className="w-8 h-8 rounded-lg" />
                <Skeleton className="h-5 w-36 rounded" />
              </div>
              <Skeleton className="h-3.5 w-20 rounded" variant="subtle" />
            </div>

            {/* Total Pending Fee Banner */}
            <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-3 flex items-center gap-3.5 mb-3">
              <Skeleton className="w-10 h-10 rounded-full shrink-0" variant="circular" />
              <div className="space-y-1">
                <Skeleton className="h-2.5 w-24 rounded" variant="subtle" />
                <div className="flex items-baseline gap-2 mt-0.5">
                  <Skeleton className="h-6 w-24 rounded" />
                  <Skeleton className="h-3 w-16 rounded" variant="subtle" />
                </div>
              </div>
            </div>

            {/* 3 Age Wise Buckets */}
            <div className="grid grid-cols-3 gap-2">
              {/* > 15 Days */}
              <div className="bg-amber-50/60 border border-amber-200/70 rounded-xl p-2.5 text-center flex flex-col items-center justify-between h-[98px]">
                <Skeleton className="h-2.5 w-14 rounded" variant="subtle" />
                <Skeleton className="h-4 w-8 rounded mt-1" />
                <Skeleton className="h-2 w-10 rounded mt-0.5" variant="subtle" />
                <Skeleton className="h-3.5 w-14 rounded mt-1" />
              </div>

              {/* > 30 Days */}
              <div className="bg-orange-50/60 border border-orange-200/70 rounded-xl p-2.5 text-center flex flex-col items-center justify-between h-[98px]">
                <Skeleton className="h-2.5 w-14 rounded" variant="subtle" />
                <Skeleton className="h-4 w-8 rounded mt-1" />
                <Skeleton className="h-2 w-10 rounded mt-0.5" variant="subtle" />
                <Skeleton className="h-3.5 w-14 rounded mt-1" />
              </div>

              {/* > 60 Days */}
              <div className="bg-rose-50/60 border border-rose-200/70 rounded-xl p-2.5 text-center flex flex-col items-center justify-between h-[98px]">
                <Skeleton className="h-2.5 w-14 rounded" variant="subtle" />
                <Skeleton className="h-4 w-8 rounded mt-1" />
                <Skeleton className="h-2 w-10 rounded mt-0.5" variant="subtle" />
                <Skeleton className="h-3.5 w-14 rounded mt-1" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          ROW 4: 3 Cards (Faculty Attendance | Examination Status | Placements)
      ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* CARD 1: Faculty Attendance & Leave Status */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <Skeleton className="h-5 w-48 rounded" />
              <Skeleton className="h-3.5 w-18 rounded" variant="subtle" />
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Main Attendance Percentage */}
              <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3 text-center shrink-0 w-full sm:w-32 flex flex-row sm:flex-col items-center justify-around sm:justify-center gap-2">
                <Skeleton className="w-8 h-8 rounded-lg shrink-0 sm:mx-auto sm:mb-1" />
                <div className="flex sm:flex-col items-center gap-2 sm:gap-0">
                  <Skeleton className="h-6 w-14 rounded my-0.5" />
                  <Skeleton className="h-2.5 w-20 rounded mt-0.5" variant="subtle" />
                  <Skeleton className="h-2 w-16 rounded mt-0.5 hidden sm:block" variant="subtle" />
                  <Skeleton className="h-2 w-12 rounded mt-0.5 hidden sm:block" variant="subtle" />
                </div>
              </div>

              {/* 3 Mini Status Cards */}
              <div className="flex-1 space-y-1.5">
                {/* Late Arrivals */}
                <div className="bg-amber-50/70 border border-amber-200/70 rounded-xl px-2.5 py-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-6 h-6 rounded-md" />
                    <Skeleton className="h-3.5 w-5 rounded" />
                    <Skeleton className="h-3 w-24 rounded" variant="subtle" />
                  </div>
                  <Skeleton className="w-3.5 h-3.5 rounded" variant="subtle" />
                </div>

                {/* On Leave */}
                <div className="bg-sky-50/70 border border-sky-200/70 rounded-xl px-2.5 py-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-6 h-6 rounded-md" />
                    <Skeleton className="h-3.5 w-5 rounded" />
                    <Skeleton className="h-3 w-20 rounded" variant="subtle" />
                  </div>
                  <Skeleton className="w-3.5 h-3.5 rounded" variant="subtle" />
                </div>

                {/* Absent */}
                <div className="bg-rose-50/70 border border-rose-200/70 rounded-xl px-2.5 py-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-6 h-6 rounded-md" />
                    <Skeleton className="h-3.5 w-5 rounded" />
                    <Skeleton className="h-3 w-18 rounded" variant="subtle" />
                  </div>
                  <Skeleton className="w-3.5 h-3.5 rounded" variant="subtle" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 2: Examination Status */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <Skeleton className="h-5 w-36 rounded" />
              <Skeleton className="h-3.5 w-16 rounded" variant="subtle" />
            </div>

            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs py-1 px-1.5"
                >
                  <div className="flex items-center gap-2 flex-1 pr-2">
                    <Skeleton className="w-4 h-4 rounded shrink-0" />
                    <Skeleton
                      className="h-3.5 rounded"
                      style={{ width: `${110 + (idx % 3) * 35}px` }}
                      variant="subtle"
                    />
                  </div>
                  <Skeleton className="h-5 w-7 rounded-md shrink-0" variant="subtle" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CARD 3: Placements & Training */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <Skeleton className="h-5 w-40 rounded" />
              <Skeleton className="h-3.5 w-20 rounded" variant="subtle" />
            </div>

            {/* Top Donut & Legend */}
            <div className="flex items-center justify-around gap-2 mb-3">
              {/* Circular Gauge Ring */}
              <div className="relative w-20 h-20 rounded-full border-4 border-slate-200 flex flex-col items-center justify-center shrink-0 portal-shimmer">
                <Skeleton className="h-3.5 w-8 rounded" />
                <Skeleton className="h-2 w-10 rounded mt-0.5" variant="subtle" />
              </div>

              {/* Legend */}
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-1.5">
                    <Skeleton className="w-2.5 h-2.5 rounded-full" variant="circular" />
                    <Skeleton className="h-3 w-12 rounded" variant="subtle" />
                  </div>
                  <Skeleton className="h-3 w-6 rounded" />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-1.5">
                    <Skeleton className="w-2.5 h-2.5 rounded-full" variant="circular" />
                    <Skeleton className="h-3 w-12 rounded" variant="subtle" />
                  </div>
                  <Skeleton className="h-3 w-6 rounded" />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-1.5">
                    <Skeleton className="w-2.5 h-2.5 rounded-full" variant="circular" />
                    <Skeleton className="h-3 w-12 rounded" variant="subtle" />
                  </div>
                  <Skeleton className="h-3 w-6 rounded" />
                </div>
              </div>
            </div>

            {/* Bottom 3 KPI Tiles */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              <div className="bg-sky-50/70 border border-sky-100 rounded-xl p-1.5 sm:p-2 text-center flex flex-col items-center">
                <Skeleton className="h-5 w-8 rounded mx-auto" />
                <Skeleton className="h-2 w-16 rounded mx-auto mt-1" variant="subtle" />
              </div>
              <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-1.5 sm:p-2 text-center flex flex-col items-center">
                <Skeleton className="h-5 w-8 rounded mx-auto" />
                <Skeleton className="h-2 w-16 rounded mx-auto mt-1" variant="subtle" />
              </div>
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-1.5 sm:p-2 text-center flex flex-col items-center">
                <Skeleton className="h-5 w-8 rounded mx-auto" />
                <Skeleton className="h-2 w-16 rounded mx-auto mt-1" variant="subtle" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
