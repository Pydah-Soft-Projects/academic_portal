"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  X,
  Clock,
  BookOpen,
  Calendar,
  Briefcase,
  Building,
  CheckCircle2,
  AlertCircle,
  Fingerprint,
  ExternalLink,
  MapPin,
  FileText,
  User,
} from "lucide-react";
import { FacultyAvatar } from "@/components/ui/FacultyAvatar";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { StaffOverviewItem } from "./staff-types";

type Props = {
  staff: StaffOverviewItem | null;
  selectedDate: string;
  onClose: () => void;
};

export function StaffDetailDrawer({ staff, selectedDate, onClose }: Props) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!staff) return null;

  const att = staff.todayAttendance;

  const statusBadgeColor = {
    present: "bg-emerald-50 text-emerald-700 border-emerald-200",
    late: "bg-amber-50 text-amber-700 border-amber-200",
    absent: "bg-rose-50 text-rose-700 border-rose-200",
    leave: "bg-purple-50 text-purple-700 border-purple-200",
    od: "bg-blue-50 text-blue-700 border-blue-200",
    permission: "bg-cyan-50 text-cyan-700 border-cyan-200",
  }[att.status] || "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="fixed inset-y-0 right-0 flex max-w-full pl-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-screen max-w-md transform bg-white shadow-2xl transition-all duration-200 flex flex-col border-l border-slate-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/80">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-brand-600" />
              <h2 className="text-base font-semibold text-slate-900">Staff Profile & Schedule</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
              aria-label="Close drawer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Staff Bio Header */}
            <div className="flex items-start gap-4 p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
              <FacultyAvatar
                name={staff.name}
                photo={staff.profilePhoto}
                hrmsEmployeeId={staff.hrmsEmployeeId}
                size="lg"
                className="shrink-0"
              />
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-slate-900 leading-tight">
                  {staff.name}
                </h3>
                <p className="text-xs font-semibold text-brand-700 mt-0.5">
                  {staff.designation}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200">
                    ID: {staff.code}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-brand-50 text-brand-700">
                    {staff.employeeGroup || "Teaching"}
                  </span>
                  {staff.linkStatus === "linked" && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" /> Linked
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Department & Division */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                <span className="text-slate-500 flex items-center gap-1.5 font-medium mb-1">
                  <Building className="h-3.5 w-3.5 text-slate-400" /> Department
                </span>
                <p className="font-semibold text-slate-900 truncate" title={staff.department}>
                  {staff.department || "—"}
                </p>
              </div>
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                <span className="text-slate-500 flex items-center gap-1.5 font-medium mb-1">
                  <Briefcase className="h-3.5 w-3.5 text-slate-400" /> College / Division
                </span>
                <p className="font-semibold text-slate-900 truncate" title={staff.division}>
                  {staff.division || staff.college || "—"}
                </p>
              </div>
            </div>

            {/* Attendance Status Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Fingerprint className="h-4 w-4 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                    Today&apos;s Status ({selectedDate})
                  </span>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border",
                    statusBadgeColor,
                  )}
                >
                  {att.displayStatus}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                <div>
                  <span className="text-slate-500 block">Check-in Time</span>
                  <span className="font-semibold text-slate-800">
                    {att.checkInTime || "Not recorded"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Check-out Time</span>
                  <span className="font-semibold text-slate-800">
                    {att.checkOutTime || "—"}
                  </span>
                </div>
                {att.lateMinutes > 0 && (
                  <div>
                    <span className="text-slate-500 block">Late Duration</span>
                    <span className="font-semibold text-amber-700">
                      {att.lateMinutes} mins late
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-slate-500 block">Biometric Thumb</span>
                  <span className="font-semibold text-slate-800">
                    {att.punchCount > 0 ? `${att.punchCount} Punches` : "No Thumb Punch"}
                  </span>
                </div>
              </div>

              {att.leaveReason && (
                <div className="mt-2 p-2.5 rounded-lg bg-purple-50/70 border border-purple-200/80 text-xs text-purple-900">
                  <span className="font-semibold block mb-0.5">Leave Applied:</span>
                  <span>{att.leaveReason}</span>
                </div>
              )}

              {att.odPlace && (
                <div className="mt-2 p-2.5 rounded-lg bg-blue-50/70 border border-blue-200/80 text-xs text-blue-900 flex items-start gap-1.5">
                  <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block mb-0.5">OD Destination:</span>
                    <span>{att.odPlace}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Today's Schedule Slots */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-brand-600" />
                  <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                    Today&apos;s Slots ({staff.todaySlotsCount})
                  </span>
                </div>
                {staff.todaySlotsCount > 0 && (
                  <span className="text-xs text-slate-500 font-medium">
                    {staff.todayPostedSlotsCount} / {staff.todaySlotsCount} Posted
                  </span>
                )}
              </div>

              {staff.todaySlots.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                  No teaching slots scheduled on this date.
                </div>
              ) : (
                <div className="space-y-2 pt-1">
                  {staff.todaySlots.map((slot, idx) => {
                    const isPosted = slot.isPosted;
                    return (
                      <div
                        key={slot.id || idx}
                        className={cn(
                          "p-3 rounded-lg border text-xs transition-colors",
                          isPosted
                            ? "border-emerald-200 bg-emerald-50/30"
                            : "border-slate-200 bg-slate-50/50 hover:bg-slate-50",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900">
                                {slot.slotLabel}
                              </span>
                              {slot.startTime && slot.endTime && (
                                <span className="text-slate-500 font-mono text-[11px]">
                                  ({slot.startTime} - {slot.endTime})
                                </span>
                              )}
                            </div>
                            <p className="font-medium text-slate-800 mt-1">
                              {slot.subjectName}
                              {slot.subjectCode ? ` (${slot.subjectCode})` : ""}
                            </p>
                            {slot.sectionName && (
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                Section: {slot.sectionName}
                                {slot.roomLabel ? ` • Room: ${slot.roomLabel}` : ""}
                              </p>
                            )}
                          </div>
                          <div>
                            {isPosted ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                                <CheckCircle2 className="h-3 w-3" /> Posted
                              </span>
                            ) : slot.status === "cancelled" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800">
                                <AlertCircle className="h-3 w-3" /> Cancelled
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
                                Scheduled
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Teaching Subjects */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-brand-600" />
                <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                  Subjects Teaching ({staff.teachingSubjects.length})
                </span>
              </div>

              {staff.teachingSubjects.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No assigned subjects recorded.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {staff.teachingSubjects.map((sub, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200"
                    >
                      {sub}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Link to Staff Workload if staffLinkId exists */}
            {staff.staffLinkId && (
              <div className="pt-2">
                <Link
                  href={`/staff-workload/${staff.staffLinkId}`}
                  className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 transition shadow-2xs"
                >
                  <span>View Full Workload & Timetable</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

