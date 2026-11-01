"use client";

import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  GraduationCap,
  Layers,
  Printer,
  Radio,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export type PublishSuccessInfo = {
  planId: number;
  versionNo: number;
  collegeName?: string | null;
  courseName?: string | null;
  branchName?: string | null;
  year?: number | string | null;
  semester?: number | string | null;
  section?: string | null;
  batch?: string | null;
  academicYear?: string | null;
  slotsCount?: number;
  facultyCount?: number;
  publishedAt?: string;
};

export type TimetablePublishSuccessModalProps = {
  isOpen: boolean;
  onClose: () => void;
  info: PublishSuccessInfo | null;
  onPrint?: () => void;
};

export function TimetablePublishSuccessModal({
  isOpen,
  onClose,
  info,
  onPrint,
}: TimetablePublishSuccessModalProps) {
  if (!isOpen || !info) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 print:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="publish-success-title"
    >
      <div className="relative flex w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Top Celebratory Header */}
        <div className="relative border-b border-emerald-100 bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-transparent p-6 text-center sm:p-8">
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700 transition-colors shadow-2xs cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Success Icon Badge with Pulse Ring */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 ring-4 ring-emerald-100">
            <CheckCircle2 className="h-9 w-9 stroke-[2.2]" />
          </div>

          <div className="mt-4">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/90 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
              <Radio className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
              <span>LIVE & HOSTED</span>
            </div>
            <h3 id="publish-success-title" className="mt-2 text-2xl font-black text-navy-900">
              Timetable Published Successfully!
            </h3>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
              The master timetable has been published and hosted live. All daily attendance sessions, faculty schedules, and student portals have been updated.
            </p>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Cohort Identification Card */}
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-200/70 pb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Published Class Cohort
              </span>
              <span className="rounded bg-sky-100 text-sky-800 px-2 py-0.5 text-xs font-bold font-mono">
                Plan #{info.planId} • Version {info.versionNo}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">College</span>
                <span className="font-bold text-navy-900 flex items-center gap-1 mt-0.5">
                  <Building2 className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">{info.collegeName || "Engineering"}</span>
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Program & Branch</span>
                <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                  <GraduationCap className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">
                    {[info.courseName, info.branchName].filter(Boolean).join(" · ") || "CSE(AI)"}
                  </span>
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Year & Semester</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {info.year ? (
                    <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-bold text-sky-700 border border-sky-200">
                      Year {info.year}
                    </span>
                  ) : null}
                  {info.semester ? (
                    <span className="font-semibold text-slate-700">Sem {info.semester}</span>
                  ) : null}
                  {info.section && info.section !== "all" ? (
                    <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-bold text-indigo-700 border border-indigo-200">
                      Sec {info.section}
                    </span>
                  ) : null}
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Academic Year & Batch</span>
                <span className="font-medium text-slate-700 block mt-0.5">
                  AY {info.academicYear || "2026-2027"}
                  {info.batch && info.batch !== "—" ? ` • Batch ${info.batch}` : ""}
                </span>
              </div>
            </div>
          </div>

          {/* Synchronized Metrics Quick Pills */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3 text-center">
              <Clock className="h-4 w-4 text-emerald-600 mx-auto" />
              <div className="mt-1 text-base font-black text-emerald-950">
                {info.slotsCount ?? "—"}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                Weekly Slots
              </span>
            </div>

            <div className="rounded-xl border border-sky-200/80 bg-sky-50/50 p-3 text-center">
              <Users className="h-4 w-4 text-sky-600 mx-auto" />
              <div className="mt-1 text-base font-black text-sky-950">
                {info.facultyCount ?? "—"}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800">
                Faculty Assigned
              </span>
            </div>

            <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/50 p-3 text-center">
              <Radio className="h-4 w-4 text-indigo-600 mx-auto" />
              <div className="mt-1 text-base font-black text-indigo-950">Hosted</div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800">
                Portal Sync
              </span>
            </div>
          </div>

          {/* Quick Notice */}
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-950">
            <Sparkles className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Synchronized Everywhere:</strong> Today&apos;s Timetable, Attendance Posting, and Faculty Workload are now reflecting these published periods immediately.
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-slate-50/90 px-6 py-4">
          {onPrint ? (
            <Button
              variant="secondary"
              onClick={onPrint}
              className="text-slate-700 hover:text-navy-900 text-xs"
            >
              <Printer className="mr-1.5 h-3.5 w-3.5 text-slate-500" /> Print Timetable
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <Link
              href="/today-timetable"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-navy-900 transition-colors shadow-2xs"
            >
              <span>View Today&apos;s Timetable</span>
              <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
            </Link>

            <Button onClick={onClose} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
              Awesome, Done!
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

