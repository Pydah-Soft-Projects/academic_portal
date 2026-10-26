"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Building2,
  Calendar,
  Clock,
  GraduationCap,
  Info,
  Layers,
  ShieldAlert,
  User,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FacultyAvatar } from "@/components/ui/FacultyAvatar";
import { cn } from "@/lib/cn";

export type FacultyClashDetail = {
  facultyLinkId: number;
  facultyName: string;
  facultyEmpCode?: string | null;
  departmentName?: string | null;
  dayOfWeek: string;
  dayLabel: string;
  startTime: string;
  endTime: string;
  slotLabel?: string | null;
  currentSubject?: string | null;
  currentSubjectCode?: string | null;
  currentCustomLabel?: string | null;
  conflictingPlanId?: number | null;
  conflictingPlanLabel?: string | null;
  conflictingBranch?: string | null;
  conflictingCourse?: string | null;
  conflictingSection?: string | null;
  conflictingSemester?: number | null;
  conflictingSubject?: string | null;
  conflictingSubjectCode?: string | null;
  conflictingTimeSlot?: string | null;
  existingHours?: number | null;
  existingSlotsCount?: number | null;
  isParallelWarning?: boolean;
  message: string;
};

export type ReviewPayload = {
  ok: boolean;
  assignedCount: number;
  unassignedSlots: string[];
  sectionClashes: string[];
  facultyClashes: string[];
  facultyClashDetails?: FacultyClashDetail[];
  roomClashes: string[];
  warnings: string[];
  unchanged?: boolean;
  unchangedFromPublishedPlanId?: number | null;
  unchangedFromPublishedVersion?: number | null;
  message?: string | null;
};

export type TimetableValidationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  review: ReviewPayload | null;
  title?: string;
  subtitle?: string;
  context?: {
    collegeName?: string | null;
    courseName?: string | null;
    branchName?: string | null;
    section?: string | null;
    batch?: string | null;
    year?: number | string | null;
    semester?: number | string | null;
    academicYear?: string | null;
    planId?: number | null;
  };
};

type TabKey = "all" | "faculty" | "unassigned" | "sections" | "warnings";

export function TimetableValidationModal({
  isOpen,
  onClose,
  review,
  title = "Cannot Publish Timetable",
  subtitle = "Validation conflicts must be resolved before this timetable can be published to faculty and students.",
  context,
}: TimetableValidationModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("all");

  if (!isOpen || !review) return null;

  const facultyClashes = review.facultyClashes ?? [];
  const facultyClashDetails = review.facultyClashDetails ?? [];
  const sectionClashes = review.sectionClashes ?? [];
  const unassignedSlots = review.unassignedSlots ?? [];
  const warnings = review.warnings ?? [];

  const totalErrors = facultyClashes.length + sectionClashes.length + unassignedSlots.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Click outside backdrop */}
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close dialog"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="validation-modal-title"
        className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-rose-200 bg-white shadow-2xl transition-all"
      >
        {/* Modal Header */}
        <div className="border-b border-rose-100 bg-gradient-to-r from-rose-50 via-red-50/60 to-white px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-md shadow-rose-600/25">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 id="validation-modal-title" className="text-lg font-bold text-navy-900">
                    {title}
                  </h3>
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {totalErrors > 0 ? `${totalErrors} Issue${totalErrors > 1 ? "s" : ""} Found` : "Warning"}
                  </span>
                </div>
                <p className="mt-1 text-xs sm:text-sm text-slate-600 max-w-2xl">
                  {subtitle}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700 transition-colors shadow-2xs"
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
              {context.section && context.section !== "all" ? (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-bold text-indigo-700">
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
              {context.academicYear ? (
                <>
                  <span className="text-slate-300">•</span>
                  <span>AY {context.academicYear}</span>
                </>
              ) : null}
              {context.planId ? (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-500">Draft Plan #{context.planId}</span>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-b border-border bg-slate-50/70 p-3 sm:px-6">
          <button
            type="button"
            onClick={() => setActiveTab("faculty")}
            className={cn(
              "flex flex-col rounded-xl border p-2.5 text-left transition-all cursor-pointer",
              activeTab === "faculty"
                ? "border-rose-400 bg-rose-50/70 ring-2 ring-rose-500/20 shadow-xs"
                : "border-slate-200 bg-white hover:border-slate-300",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Faculty Clashes
              </span>
              <User className={cn("h-3.5 w-3.5", facultyClashes.length > 0 ? "text-rose-600" : "text-slate-400")} />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className={cn("text-xl font-extrabold", facultyClashes.length > 0 ? "text-rose-700" : "text-slate-700")}>
                {facultyClashes.length}
              </span>
              {facultyClashes.length > 0 ? (
                <span className="text-[10px] font-bold text-rose-600 uppercase">Critical</span>
              ) : (
                <span className="text-[10px] font-semibold text-emerald-600">Clear</span>
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("unassigned")}
            className={cn(
              "flex flex-col rounded-xl border p-2.5 text-left transition-all cursor-pointer",
              activeTab === "unassigned"
                ? "border-amber-400 bg-amber-50/70 ring-2 ring-amber-500/20 shadow-xs"
                : "border-slate-200 bg-white hover:border-slate-300",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Unassigned Slots
              </span>
              <Clock className={cn("h-3.5 w-3.5", unassignedSlots.length > 0 ? "text-amber-600" : "text-slate-400")} />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className={cn("text-xl font-extrabold", unassignedSlots.length > 0 ? "text-amber-700" : "text-slate-700")}>
                {unassignedSlots.length}
              </span>
              {unassignedSlots.length > 0 ? (
                <span className="text-[10px] font-bold text-amber-600 uppercase">Empty</span>
              ) : (
                <span className="text-[10px] font-semibold text-emerald-600">Complete</span>
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("sections")}
            className={cn(
              "flex flex-col rounded-xl border p-2.5 text-left transition-all cursor-pointer",
              activeTab === "sections"
                ? "border-orange-400 bg-orange-50/70 ring-2 ring-orange-500/20 shadow-xs"
                : "border-slate-200 bg-white hover:border-slate-300",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Section Clashes
              </span>
              <Layers className={cn("h-3.5 w-3.5", sectionClashes.length > 0 ? "text-orange-600" : "text-slate-400")} />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className={cn("text-xl font-extrabold", sectionClashes.length > 0 ? "text-orange-700" : "text-slate-700")}>
                {sectionClashes.length}
              </span>
              {sectionClashes.length > 0 ? (
                <span className="text-[10px] font-bold text-orange-600 uppercase">Conflict</span>
              ) : (
                <span className="text-[10px] font-semibold text-emerald-600">Clear</span>
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("warnings")}
            className={cn(
              "flex flex-col rounded-xl border p-2.5 text-left transition-all cursor-pointer",
              activeTab === "warnings"
                ? "border-indigo-400 bg-indigo-50/70 ring-2 ring-indigo-500/20 shadow-xs"
                : "border-slate-200 bg-white hover:border-slate-300",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Warnings
              </span>
              <Info className={cn("h-3.5 w-3.5", warnings.length > 0 ? "text-indigo-600" : "text-slate-400")} />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className={cn("text-xl font-extrabold", warnings.length > 0 ? "text-indigo-700" : "text-slate-700")}>
                {warnings.length}
              </span>
              <span className="text-[10px] font-semibold text-slate-500">
                {warnings.length > 0 ? "Notices" : "None"}
              </span>
            </div>
          </button>
        </div>

        {/* Modal Body / Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Faculty Clashes Section */}
          {(activeTab === "all" || activeTab === "faculty") && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-100 text-rose-700 font-bold text-xs">
                    {facultyClashes.length}
                  </div>
                  <h4 className="text-sm font-bold text-navy-900">
                    Faculty Schedule Clashes
                  </h4>
                </div>
                <span className="text-xs text-rose-600 font-semibold">
                  Publish Blocked
                </span>
              </div>

              {facultyClashes.length === 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-center text-xs text-emerald-800 font-medium">
                  ✓ No faculty clashes detected. Faculty allocations are free from cross-timetable double bookings.
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Notice explanation */}
                  <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs text-rose-900 leading-relaxed">
                    <p className="font-semibold flex items-center gap-1.5 mb-1 text-rose-950">
                      <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                      Double-Booking Detected Across Timetables
                    </p>
                    A faculty member cannot teach in two classes or sections at the exact same hour. Review the conflicting published timetable and existing hours below, then reassign the periods in this planner.
                  </div>

                  {/* Render Rich Detailed Faculty Clash Cards */}
                  {facultyClashDetails && facultyClashDetails.length > 0 ? (
                    facultyClashDetails
                      .filter((item) => !item.isParallelWarning)
                      .map((item, idx) => (
                        <div
                          key={`fac-detail-${idx}-${item.facultyLinkId}-${item.dayOfWeek}-${item.startTime}`}
                          className="rounded-2xl border border-rose-200 bg-white p-4.5 shadow-sm hover:border-rose-300 transition-all space-y-3.5"
                        >
                          {/* Faculty Profile & Badges Header */}
                          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-3">
                              <FacultyAvatar
                                name={item.facultyName}
                                hrmsEmployeeId={item.facultyEmpCode}
                                size="md"
                                className="ring-2 ring-rose-200"
                              />
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-bold text-navy-900">
                                    {item.facultyName}
                                  </span>
                                  {item.facultyEmpCode ? (
                                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                      ID: {item.facultyEmpCode}
                                    </span>
                                  ) : null}
                                  {item.departmentName ? (
                                    <span className="rounded-md bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200/60">
                                      {item.departmentName}
                                    </span>
                                  ) : null}
                                </div>
                                <p className="text-xs text-rose-600 font-semibold mt-0.5 flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  Conflicting Period: {item.dayLabel} • {item.startTime} – {item.endTime}
                                  {item.slotLabel ? ` (${item.slotLabel})` : ""}
                                </p>
                              </div>
                            </div>

                            {/* Existing hours workload badge */}
                            <div className="flex flex-col items-end">
                              <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-right">
                                <Clock className="h-3.5 w-3.5 text-indigo-600" />
                                <div>
                                  <span className="text-[11px] font-bold text-navy-900">
                                    {item.existingHours ?? 0} hrs/wk
                                  </span>
                                  <span className="text-[10px] text-slate-500 ml-1">
                                    ({item.existingSlotsCount ?? 0} classes assigned)
                                  </span>
                                </div>
                              </div>
                              <span className="text-[10px] text-slate-400 mt-0.5">
                                Across published timetables
                              </span>
                            </div>
                          </div>

                          {/* Side by side comparison of This Draft vs Conflicting Plan */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                            {/* Current Draft Plan Assignment */}
                            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1.5">
                              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                <span className="flex items-center gap-1 text-slate-700">
                                  <BookOpen className="h-3.5 w-3.5 text-indigo-600" />
                                  This Timetable (Attempting)
                                </span>
                                <span className="rounded bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[10px] font-bold">
                                  Draft
                                </span>
                              </div>
                              <div className="pt-1">
                                <p className="text-sm font-bold text-navy-900">
                                  {item.currentSubject || item.currentCustomLabel || "Assigned Period"}
                                </p>
                                {item.currentSubjectCode ? (
                                  <p className="text-xs text-slate-500 font-mono">
                                    Code: {item.currentSubjectCode}
                                  </p>
                                ) : null}
                              </div>
                              <div className="text-xs text-slate-600 flex items-center gap-1 pt-1 font-medium">
                                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                <span>{item.dayLabel} at {item.startTime} – {item.endTime}</span>
                              </div>
                            </div>

                            {/* Conflicting Published Timetable */}
                            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3.5 space-y-1.5">
                              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-rose-800">
                                <span className="flex items-center gap-1 text-rose-900">
                                  <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
                                  Conflicting Published Plan
                                </span>
                                <span className="rounded bg-emerald-100 text-emerald-800 px-1.5 py-0.5 text-[10px] font-bold">
                                  Published
                                </span>
                              </div>
                              <div className="pt-1">
                                <p className="text-sm font-bold text-navy-900">
                                  {item.conflictingSubject || "Class Period"}
                                </p>
                                <p className="text-xs font-semibold text-rose-700">
                                  {item.conflictingPlanLabel || `Plan #${item.conflictingPlanId}`}
                                </p>
                              </div>
                              <div className="text-xs text-slate-600 flex items-center gap-1 pt-1 font-medium">
                                <Clock className="h-3.5 w-3.5 text-slate-400" />
                                <span>Occupied: {item.conflictingTimeSlot || `${item.startTime} – ${item.endTime}`}</span>
                              </div>
                            </div>
                          </div>

                          {/* Quick actionable guidance */}
                          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600 border border-slate-200/60">
                            <span className="flex items-center gap-1 font-medium">
                              <Info className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                              Action: Click on the <strong>{item.dayLabel} {item.startTime}</strong> slot in the timetable to select a different faculty member.
                            </span>
                          </div>
                        </div>
                      ))
                  ) : (
                    /* Fallback to string array if structured details are absent */
                    facultyClashes.map((clashStr, idx) => (
                      <div
                        key={`fac-clash-${idx}`}
                        className="rounded-xl border border-rose-200 bg-white p-3.5 text-xs text-slate-800 shadow-2xs flex items-start gap-2.5"
                      >
                        <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                        <div className="flex-1 font-medium leading-relaxed">
                          {clashStr}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Unassigned Slots Section */}
          {(activeTab === "all" || activeTab === "unassigned") && unassignedSlots.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-100 text-amber-800 font-bold text-xs">
                    {unassignedSlots.length}
                  </div>
                  <h4 className="text-sm font-bold text-navy-900">
                    Unassigned Class Periods
                  </h4>
                </div>
                <span className="text-xs text-amber-700 font-semibold">
                  Required For Publishing
                </span>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 leading-relaxed">
                All teaching periods must have an assigned Subject and Faculty (or an approved free activity like Library, Games, CRT, or Self Study) before the timetable can be published.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {unassignedSlots.map((slotItem, idx) => (
                  <div
                    key={`unassigned-${idx}`}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-700 shadow-2xs"
                  >
                    <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <span className="font-semibold text-slate-800 truncate">{slotItem}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section & Batch Clashes Section */}
          {(activeTab === "all" || activeTab === "sections") && sectionClashes.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-orange-100 text-orange-800 font-bold text-xs">
                    {sectionClashes.length}
                  </div>
                  <h4 className="text-sm font-bold text-navy-900">
                    Section & Batch Clashes
                  </h4>
                </div>
                <span className="text-xs text-orange-700 font-semibold">
                  Duplicate Classification
                </span>
              </div>

              <div className="space-y-2">
                {sectionClashes.map((clash, idx) => (
                  <div
                    key={`sec-clash-${idx}`}
                    className="flex items-start gap-2.5 rounded-xl border border-orange-200 bg-orange-50/60 p-3 text-xs text-orange-950 font-medium"
                  >
                    <Layers className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
                    <span>{clash}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings Section */}
          {(activeTab === "all" || activeTab === "warnings") && warnings.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-100 text-indigo-800 font-bold text-xs">
                    {warnings.length}
                  </div>
                  <h4 className="text-sm font-bold text-navy-900">
                    Notices & Parallel Section Warnings
                  </h4>
                </div>
                <span className="text-xs text-indigo-700 font-semibold">
                  Informational
                </span>
              </div>

              <div className="space-y-2">
                {warnings.map((warn, idx) => (
                  <div
                    key={`warn-${idx}`}
                    className="flex items-start gap-2.5 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 text-xs text-indigo-950 font-medium"
                  >
                    <Info className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                    <span>{warn}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-slate-50/90 px-6 py-4">
          <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
            <Info className="h-4 w-4 text-slate-400" />
            <span>Close this dialog to modify assignments in the timetable editor.</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>
              Dismiss
            </Button>
            <Button onClick={onClose} className="bg-navy-900 hover:bg-navy-800 text-white">
              Back to Planner & Fix Issues
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
