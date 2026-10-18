"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, ExternalLink, Calendar, AlertCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { FacultyAvatar } from "@/components/ui/FacultyAvatar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import {
  WorkloadTimetableGrid,
  type FacultyTimetable,
} from "@/features/workload/WorkloadTimetableGrid";
import type { FacultyLoad } from "@/features/workload/types";

type FacultyDetail = {
  id: string;
  name: string;
  code: string;
  department: string;
  division?: string;
  designation?: string;
  status: string;
  periodsPerWeek: number;
  hoursPerWeek: number;
  subjects: number;
  sections: number;
  theory: number;
  lab: number;
  hoursByDay?: {
    MON: number;
    TUE: number;
    WED: number;
    THUR: number;
    FRI: number;
    SAT: number;
    SUN: number;
  };
  timetable: FacultyTimetable | null;
  source?: string;
};

type Props = {
  faculty: FacultyLoad | null;
  open: boolean;
  onClose: () => void;
};

export function FacultyTimetableModal({ faculty, open, onClose }: Props) {
  const [detail, setDetail] = useState<FacultyDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !faculty) {
      setDetail(null);
      setError(null);
      return;
    }

    let cancelled = false;
    async function loadTimetable() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`/workload/${encodeURIComponent(faculty!.id)}`, {
          cache: "no-store",
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            typeof body === "object" && body && "message" in body
              ? String((body as { message: string }).message)
              : "Failed to load faculty timetable",
          );
        }
        if (!cancelled) {
          setDetail(body as FacultyDetail);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load timetable");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadTimetable();
    return () => {
      cancelled = true;
    };
  }, [open, faculty]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open || !faculty) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Dialog container */}
      <div className="relative z-10 flex flex-col w-[96vw] max-w-[1540px] max-h-[95vh] overflow-hidden rounded-2xl border border-border bg-white shadow-2xl animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-slate-50/80 px-5 py-3 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <FacultyAvatar
              name={faculty.name}
              photo={faculty.profilePhoto}
              hrmsEmployeeId={faculty.hrmsEmployeeId}
              size="md"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-navy-900 text-sm sm:text-base truncate">
                  {faculty.name}
                </h3>
                <StatusBadge status={faculty.status} />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span className="font-mono font-semibold text-slate-700">
                  ID: {faculty.hrmsEmployeeId || faculty.code}
                </span>
                {faculty.designation && faculty.designation !== "—" ? (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="font-medium text-slate-600 truncate max-w-[200px]">
                      {faculty.designation}
                    </span>
                  </>
                ) : null}
                <span className="text-slate-300">•</span>
                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-200/80 text-slate-700">
                  {faculty.department}
                </span>
                <span className="text-slate-300">•</span>
                <span className="font-semibold text-indigo-900">
                  {faculty.periodsPerWeek} periods/wk ({faculty.hoursPerWeek} hrs/wk)
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/staff-workload/${faculty.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-navy-900 transition-colors shadow-2xs"
              title="Open full page in new tab"
            >
              <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
              <span className="hidden sm:inline">Full Page</span>
            </Link>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/80 hover:text-slate-700 transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 bg-slate-50/30">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent" />
              <p className="text-xs font-medium text-slate-500">Loading timetable grid…</p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          ) : detail?.timetable ? (
            <WorkloadTimetableGrid timetable={detail.timetable} embedded={true} />
          ) : (
            <div className="rounded-xl border border-border bg-white p-12 text-center space-y-2">
              <Calendar className="h-8 w-8 text-slate-300 mx-auto" />
              <h4 className="font-bold text-navy-900 text-sm">No Published Timetable</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No active timetable sessions have been published for {faculty.name} yet.
                Once timetable plans are published in the Timetable Planner, assignments will appear here.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-border bg-white px-5 py-2.5">
          <p className="text-[11px] text-slate-500">
            Click on periods in the grid to see subject, class branch, year, semester, and timing details.
          </p>
          <Button size="sm" variant="secondary" onClick={onClose} className="text-xs">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
