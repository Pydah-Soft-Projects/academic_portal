"use client";

import { useEffect, useState, useRef, useMemo, useId } from "react";
import {
  FileText,
  Star,
  BookOpen,
  CheckCircle2,
  Users,
  Printer,
  RotateCcw,
  ShieldCheck,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
  Clock,
  Sparkles,
  Plus,
  Send,
  Calendar,
  Edit3,
  Trash2,
  X,
  Layers,
  GraduationCap,
  Building,
  Check,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Search,
  Target,
  BarChart2,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ContentCardSkeleton } from "@/components/ui/CardSkeleton";
import { apiFetch } from "@/lib/api";
import { printElement } from "@/lib/print-service";
import { cn } from "@/lib/cn";

export type MappedStaffSubject = {
  staffLinkId: number | null;
  facultyName: string;
  employeeCode: string | null;
  subjectId: number | null;
  subjectCode: string;
  subjectName: string;
  sectionName: string | null;
  semester: number | null;
  branchId: number | null;
  courseId: number | null;
  collegeId: number | null;
  academicYear: string | null;
  batch: string | null;
};

export type TargetAudienceScope = {
  batches?: string[];
  sections?: string[];
  yearsOfStudy?: number[];
};

export type FeedbackPublication = {
  id: number;
  formId: number;
  formName: string;
  title: string;
  collegeId: number | null;
  collegeName: string | null;
  targetColleges?: Array<{ id: number; name: string; code?: string | null }> | null;
  courseId?: number | null;
  courseName?: string | null;
  targetCourses?: Array<{ id: number; name: string; code?: string | null; collegeId?: number }> | null;
  branchId: number | null;
  branchName: string | null;
  targetBranches?: Array<{ id: number; name: string; code?: string | null; courseId?: number }> | null;
  targetAudience?: TargetAudienceScope | null;
  mappedStaffSubjects?: MappedStaffSubject[] | null;
  academicYear: string;
  semester: number | null;
  startDate: string;
  endDate: string;
  isActive: boolean;
  status: "active" | "scheduled" | "closed";
  responseCount: number;
  createdAt: string;
  updatedAt: string;
};

export type FeedbackReportData = {
  publication: FeedbackPublication | null;
  publications: Array<FeedbackPublication>;
  forms: Array<{ id: number; name: string; questionCount: number }>;
  availableColleges: Array<{ id: number; name: string; code: string }>;
  availableCourses: Array<{ id: number; name: string; code: string; collegeId: number }>;
  availableBranches: Array<{ id: number; name: string; code: string; courseId?: number }>;
  availableAcademicYears: Array<{ label: string; isActive: boolean }>;
  currentAcademicYear: string;
  availableBatches?: string[];
  availableSections?: string[];
  availableYearsOfStudy?: number[];
  availableStaffSubjects?: MappedStaffSubject[];
  filters: {
    selectedPublicationId: number | null;
    selectedBranch: string | null;
    selectedSemester: number | null;
    availableSemesters: number[];
  };
  stats: {
    totalSubmissions: number;
    averageRating: number | null;
    ratingSatisfactionPct: number | null;
    averageUnitsCovered: number | null;
    completionRate: number | null;
  };
  unitsCoveredDistribution: Array<{
    unit: string;
    label: string;
    count: number;
    percentage: number;
  }>;
  facultyRatingDistribution: Array<{
    stars: number;
    count: number;
    percentage: number;
  }>;
  unitStatusDistribution: Array<{
    status: string;
    count: number;
    percentage: number;
    color: string;
  }>;
  facultyBreakdown: Array<{
    facultyName: string;
    subjectName: string;
    branchName: string;
    responsesCount: number;
    avgRating: number;
    avgUnits: number;
    mostCommonStatus: string;
    statusBadge: "Excellent" | "Good" | "Satisfactory" | "Needs Attention";
  }>;
  recentSubmissions: Array<{
    id: number;
    submittedAt: string;
    branchName: string;
    semester: number;
    sectionName: string;
    subjectName: string;
    facultyName: string;
    unitsCovered: string;
    facultyRating: number;
    unitStatus: string;
    tokenHash: string;
  }>;
  /** Per faculty+subject submission progress (sections grouped into one row) */
  submissionProgress?: Array<{
    facultyName: string;
    employeeCode: string | null;
    subjectName: string;
    subjectCode: string;
    sections: Array<{
      sectionName: string | null;
      semester: number | null;
      batch: string | null;
      branchName: string | null;
      submittedCount: number;
      expectedCount: number | null;
      status: "pending" | "partial" | "submitted";
    }>;
    totalSubmittedCount: number;
    totalExpectedCount: number | null;
    overallStatus: "pending" | "partial" | "submitted";
    averageRating?: number | null;
    averageUnitsCovered?: number | null;
    completionRate?: number | null;
    unitsCoveredDistribution?: Array<{
      unit: string;
      label: string;
      count: number;
      percentage: number;
    }>;
    facultyRatingDistribution?: Array<{
      stars: number;
      count: number;
      percentage: number;
    }>;
    unitStatusDistribution?: Array<{
      status: string;
      count: number;
      percentage: number;
      color: string;
    }>;
  }>;
  submissionSummary?: {
    totalAllocations: number;
    pendingAllocations: number;
    partialAllocations: number;
    submittedAllocations: number;
    overallSubmittedCount: number;
  };
};

/** Format date string into "DD-MM-YYYY hh:mm A" */
function formatDisplayDateTime(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strHours = String(hours).padStart(2, "0");

  return `${day}-${month}-${year} ${strHours}:${minutes} ${ampm}`;
}

/** Convert ISO or any Date to "YYYY-MM-DDTHH:mm" for datetime-local input */
function toInputDateTime(dateStr?: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

type DropdownMultiSelectOption = {
  id: number;
  name: string;
  code?: string | null;
  extraInfo?: string | null;
};

type DropdownMultiSelectProps = {
  label: string;
  icon: React.ElementType;
  allLabel: string;
  options: DropdownMultiSelectOption[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
};

function DropdownMultiSelect({
  label,
  icon: Icon,
  allLabel,
  options,
  selectedIds,
  onChange,
  placeholder = "Search...",
}: DropdownMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKey);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const filteredOptions = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(
      (opt) =>
        opt.name.toLowerCase().includes(q) ||
        (opt.code && opt.code.toLowerCase().includes(q)),
    );
  }, [options, query]);

  const isAll = selectedIds.length === 0;

  const toggleOption = (id: number) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const handleSelectAll = () => {
    onChange([]); // Empty means ALL
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const selectedItems = useMemo(() => {
    return options.filter((o) => selectedIds.includes(o.id));
  }, [options, selectedIds]);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-navy-700" />
          <span>{label}</span>
        </label>
        <span className="text-[11px] font-semibold text-slate-500">
          {isAll
            ? `All (${options.length})`
            : `${selectedIds.length} of ${options.length} selected`}
        </span>
      </div>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex min-h-10 w-full items-center justify-between gap-2 rounded-xl border bg-white px-3 py-1.5 text-left text-xs transition-all cursor-pointer shadow-2xs",
          open
            ? "border-navy-500 ring-2 ring-navy-100"
            : "border-slate-300 hover:border-slate-400 hover:bg-slate-50/50",
        )}
      >
        <div className="flex flex-1 flex-wrap items-center gap-1.5 overflow-hidden py-0.5">
          {isAll ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
              <Check className="h-3 w-3 text-emerald-600" />
              {allLabel}
            </span>
          ) : (
            <>
              {selectedItems.slice(0, 2).map((item) => (
                <span
                  key={item.id}
                  className="inline-flex items-center gap-1 rounded-md bg-navy-50 px-2 py-0.5 text-[11px] font-semibold text-navy-800 border border-navy-200 max-w-[150px] truncate"
                >
                  <span className="truncate">{item.code || item.name}</span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleOption(item.id);
                    }}
                    className="hover:text-rose-600 ml-0.5 cursor-pointer font-bold"
                  >
                    ×
                  </span>
                </span>
              ))}
              {selectedItems.length > 2 && (
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-bold text-slate-700 border border-slate-200">
                  +{selectedItems.length - 2} more
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {!isAll && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                handleClearAll();
              }}
              title="Reset to All"
              className="rounded p-0.5 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
            </span>
          )}
          <ChevronDown
            className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")}
          />
        </div>
      </button>

      {/* Popover Dropdown */}
      {open && (
        <div
          id={listId}
          className="absolute left-0 right-0 top-full z-50 mt-1.5 rounded-xl border border-slate-200 bg-white p-2.5 shadow-xl animate-in fade-in zoom-in-95 duration-150 max-h-72 flex flex-col"
        >
          {/* Search & Actions Bar */}
          <div className="space-y-2 mb-2 pb-2 border-b border-slate-100 shrink-0">
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 pl-7 text-xs text-slate-900 outline-none focus:border-navy-500 focus:bg-white"
                autoFocus
              />
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={handleSelectAll}
                className={cn(
                  "font-semibold px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer",
                  isAll
                    ? "bg-emerald-50 text-emerald-700 font-bold"
                    : "text-slate-600 hover:bg-slate-100",
                )}
              >
                ✓ {allLabel}
              </button>
              {!isAll && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[11px] font-medium text-slate-500 hover:text-rose-600 cursor-pointer"
                >
                  Reset to All
                </button>
              )}
            </div>
          </div>

          {/* Options Checklist */}
          <div className="overflow-y-auto space-y-1 flex-1 pr-1">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">
                No matching options found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selectedIds.includes(opt.id);
                return (
                  <label
                    key={opt.id}
                    onClick={() => toggleOption(opt.id)}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors cursor-pointer select-none",
                      isSelected
                        ? "bg-navy-50 text-navy-950 font-medium"
                        : "hover:bg-slate-50 text-slate-700",
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded border-slate-300 text-navy-700 focus:ring-navy-500 h-3.5 w-3.5 cursor-pointer"
                      />
                      <span className="truncate">{opt.name}</span>
                    </div>
                    {opt.code && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 shrink-0 uppercase border border-slate-200">
                        {opt.code}
                      </span>
                    )}
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// SubmissionProgressCard — shows per faculty+subject row, sections grouped
// ──────────────────────────────────────────────────────────────────────────────
type SubmissionProgressItem = NonNullable<FeedbackReportData["submissionProgress"]>[number];

const sectionStatusCfg = {
  pending: { bg: "bg-red-100", text: "text-red-700", border: "border-red-200", dot: "bg-red-400" },
  partial: { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-400" },
  submitted: { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-400" },
};

const rowStatusCfg = {
  pending:   { label: "Pending",   bg: "bg-red-50",     text: "text-red-700",     border: "border-red-200",     dot: "bg-red-400",     icon: XCircle       },
  partial:   { label: "Partial",   bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   dot: "bg-amber-400",   icon: AlertTriangle  },
  submitted: { label: "Submitted", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-400", icon: CheckCircle2   },
};

/**
 * Renders the 3 Questions (Units Covered, Rate Subject Faculty, Unit Status)
 * for a specific individual faculty member.
 */
function StaffQuestionBreakdownCards({ item }: { item: SubmissionProgressItem }) {
  const unitsDist =
    item.unitsCoveredDistribution && item.unitsCoveredDistribution.length > 0
      ? item.unitsCoveredDistribution
      : ["1", "2", "3", "4", "5"].map((u) => ({ unit: u, label: `Unit ${u}`, count: 0, percentage: 0 }));

  const ratingDist =
    item.facultyRatingDistribution && item.facultyRatingDistribution.length > 0
      ? item.facultyRatingDistribution
      : [5, 4, 3, 2, 1].map((s) => ({ stars: s, count: 0, percentage: 0 }));

  const statusDist =
    item.unitStatusDistribution && item.unitStatusDistribution.length > 0
      ? item.unitStatusDistribution
      : [
          { status: "Completed", count: 0, percentage: 0, color: "emerald" },
          { status: "Ending", count: 0, percentage: 0, color: "blue" },
          { status: "Middle", count: 0, percentage: 0, color: "amber" },
          { status: "Starting", count: 0, percentage: 0, color: "slate" },
        ];

  const totalSubs = item.totalSubmittedCount || 0;
  const avgRating = item.averageRating;
  const compRate = item.completionRate;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Card 1: Question 1 - Units Covered */}
      <Card className="border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
              Question 1
            </span>
            <h3 className="text-base font-bold text-navy-900">Units Covered</h3>
          </div>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
            Multiple Choice
          </span>
        </div>

        <div className="space-y-3 pt-1">
          {unitsDist.map((u) => (
            <div key={u.unit} className="space-y-1">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-slate-700">{u.label}</span>
                <div className="flex items-center gap-1.5 text-slate-500">
                  <span className="font-semibold text-navy-900">{u.count}</span>
                  <span>({u.percentage}%)</span>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-500"
                  style={{ width: `${u.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 border border-slate-100">
          <span className="font-semibold text-slate-800">Insight: </span>
          {totalSubs > 0
            ? "Evaluation of units covered per academic curriculum pace."
            : "No student responses submitted yet for this instructor."}
        </div>
      </Card>

      {/* Card 2: Question 2 - Rate Subject Faculty */}
      <Card className="border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">
              Question 2
            </span>
            <h3 className="text-base font-bold text-navy-900">Rate Subject Faculty</h3>
          </div>
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
            Rating Scale (1-5)
          </span>
        </div>

        {/* Big Score Header */}
        <div className="flex items-center gap-4 rounded-xl bg-amber-50/60 p-3.5 border border-amber-200/60">
          <div className="text-center">
            <span className="text-3xl font-black text-amber-900">
              {avgRating != null ? avgRating.toFixed(1) : "null"}
            </span>
            <span className="block text-[10px] text-amber-700 uppercase font-bold">
              Average
            </span>
          </div>
          <div className="border-l border-amber-200 pl-4 space-y-0.5">
            <div className="flex items-center gap-1 text-amber-500">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-4 w-4 ${
                    avgRating != null && star <= Math.round(avgRating)
                      ? "fill-amber-400 text-amber-400"
                      : "text-amber-200"
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-amber-900 font-medium">
              {totalSubs > 0
                ? `Based on ${totalSubs} verified student review${totalSubs > 1 ? "s" : ""}`
                : "0 verified student reviews"}
            </span>
          </div>
        </div>

        {/* Rating Distribution Bars */}
        <div className="space-y-2 pt-1">
          {ratingDist.map((r) => (
            <div key={r.stars} className="flex items-center gap-2 text-xs">
              <span className="w-12 text-slate-700 font-medium">{r.stars} Stars</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all duration-500"
                  style={{ width: `${r.percentage}%` }}
                />
              </div>
              <span className="w-14 text-right text-slate-500 font-mono">
                {r.count} ({r.percentage}%)
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Card 3: Question 3 - Unit Status */}
      <Card className="border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
              Question 3
            </span>
            <h3 className="text-base font-bold text-navy-900">Unit Status</h3>
          </div>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
            Syllabus Phase
          </span>
        </div>

        {/* Multi-segment bar */}
        <div className="space-y-2 pt-1">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
            {totalSubs > 0 ? (
              statusDist.map((st) => (
                <div
                  key={st.status}
                  title={`${st.status}: ${st.percentage}%`}
                  className={`h-full transition-all ${
                    st.status === "Completed"
                      ? "bg-emerald-500"
                      : st.status === "Ending"
                      ? "bg-blue-500"
                      : st.status === "Middle"
                      ? "bg-amber-400"
                      : "bg-slate-400"
                  }`}
                  style={{ width: `${st.percentage}%` }}
                />
              ))
            ) : (
              <div className="h-full w-full bg-slate-200" title="No submissions yet" />
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            {statusDist.map((st) => (
              <div
                key={st.status}
                className="rounded-lg border border-slate-100 bg-slate-50/80 p-2 text-xs"
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      st.status === "Completed"
                        ? "bg-emerald-500"
                        : st.status === "Ending"
                        ? "bg-blue-500"
                        : st.status === "Middle"
                        ? "bg-amber-400"
                        : "bg-slate-400"
                    }`}
                  />
                  <span className="font-semibold text-slate-800">{st.status}</span>
                </div>
                <div className="mt-1 flex items-baseline justify-between text-slate-500">
                  <span className="text-sm font-bold text-navy-900">{st.count}</span>
                  <span>{st.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg bg-emerald-50/60 p-3 text-xs text-emerald-900 border border-emerald-100">
          <span className="font-semibold">Curriculum Progression: </span>
          {compRate != null
            ? `${compRate}% of topics are in ending or completed stages.`
            : "No student responses submitted yet for syllabus progression."}
        </div>
      </Card>
    </div>
  );
}

function SubmissionProgressCard({
  progress,
  summary,
  selectedStaffKey,
  onSelectStaffKey,
}: {
  progress: SubmissionProgressItem[];
  summary?: FeedbackReportData["submissionSummary"];
  selectedStaffKey?: string | null;
  onSelectStaffKey?: (key: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "partial" | "submitted">("all");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const filtered = useMemo(() => {
    // Only include sections that have enrolled students (or unknown headcount, but exclude 0 students)
    let list = progress
      .map((item) => ({
        ...item,
        sections: item.sections.filter((s) => s.expectedCount === null || s.expectedCount > 0),
      }))
      .filter((item) => item.sections.length > 0);

    if (filter !== "all") list = list.filter((x) => x.overallStatus === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (x) =>
          x.facultyName.toLowerCase().includes(q) ||
          x.subjectName.toLowerCase().includes(q) ||
          (x.subjectCode && x.subjectCode.toLowerCase().includes(q)) ||
          (x.employeeCode && x.employeeCode.toLowerCase().includes(q)) ||
          x.sections.some((s) => s.sectionName && s.sectionName.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [progress, filter, search]);

  const total     = summary?.totalAllocations    ?? progress.length;
  const pending   = summary?.pendingAllocations   ?? progress.filter((x) => x.overallStatus === "pending").length;
  const partial   = summary?.partialAllocations   ?? progress.filter((x) => x.overallStatus === "partial").length;
  const submitted = summary?.submittedAllocations ?? progress.filter((x) => x.overallStatus === "submitted").length;

  return (
    <Card className="border-slate-200 bg-white shadow-xs overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
            <BarChart2 className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-navy-900">Submission Progress</h3>
            <p className="text-xs text-slate-500">Feedback collection status per faculty-subject (sections combined)</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            <TrendingUp className="h-3 w-3" /> {total} Faculty-Subjects
          </span>
          {pending > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
              <XCircle className="h-3 w-3" /> {pending} Pending
            </span>
          )}
          {partial > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
              <AlertTriangle className="h-3 w-3" /> {partial} Partial
            </span>
          )}
          {submitted > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-3 w-3" /> {submitted} Completed
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="px-5 pt-3 pb-2">
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
            {submitted > 0 && <div className="h-full bg-emerald-400" style={{ width: `${(submitted / total) * 100}%` }} />}
            {partial   > 0 && <div className="h-full bg-amber-400"   style={{ width: `${(partial   / total) * 100}%` }} />}
            {pending   > 0 && <div className="h-full bg-red-400"     style={{ width: `${(pending   / total) * 100}%` }} />}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>{Math.round(((submitted + partial) / total) * 100)}% received at least one response</span>
            <span>{Math.round((submitted / total) * 100)}% fully completed</span>
          </div>
        </div>
      )}

      {/* Search + filter tabs */}
      <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search faculty, subject, section..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent outline-none w-52 text-xs text-slate-800 placeholder:text-slate-400"
          />
        </div>
        <div className="flex items-center gap-1">
          {(["all", "pending", "partial", "submitted"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors capitalize",
                filter === f ? "bg-navy-800 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100",
              )}
            >
              {f === "all" ? `All (${total})` : f === "pending" ? `Pending (${pending})` : f === "partial" ? `Partial (${partial})` : `Done (${submitted})`}
            </button>
          ))}
        </div>
      </div>

      {/* Rows — one per faculty+subject with expandable Question Breakdown */}
      <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-slate-400">
            <FileText className="h-8 w-8 mb-2 text-slate-300" />
            <span className="text-sm font-semibold text-slate-600">No allocations found</span>
            <span className="text-xs mt-1">Try adjusting your search or filter</span>
          </div>
        ) : (
          filtered.map((item, idx) => {
            const rowKey = `${item.facultyName}|${item.subjectName}`;
            const isExpanded = expandedKey === rowKey;
            const isSelected = selectedStaffKey === rowKey;
            const cfg = rowStatusCfg[item.overallStatus];
            const StatusIcon = cfg.icon;

            // Sort sections: pending → partial → submitted, then by section name (skip sections with 0 students)
            const sortedSections = [...item.sections]
              .filter((s) => s.expectedCount === null || s.expectedCount > 0)
              .sort(
                (a, b) =>
                  ["pending", "partial", "submitted"].indexOf(a.status) -
                  ["pending", "partial", "submitted"].indexOf(b.status) ||
                  (a.sectionName ?? "").localeCompare(b.sectionName ?? ""),
              );

            return (
              <div
                key={`${rowKey}|${idx}`}
                className={cn(
                  "flex flex-col transition-colors",
                  isSelected && "bg-indigo-50/30",
                )}
              >
                <div className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50/80 transition-colors">
                  {/* Status dot */}
                  <div className={cn("h-2.5 w-2.5 rounded-full flex-shrink-0 mt-1.5", cfg.dot)} />

                  {/* Faculty + Subject + sections */}
                  <div className="min-w-0 flex-1 space-y-2">
                    {/* Faculty name + employee code */}
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-sm font-bold text-navy-900">{item.facultyName}</span>
                      {item.employeeCode && (
                        <span className="text-[10px] text-slate-400 font-mono">{item.employeeCode}</span>
                      )}
                    </div>

                    {/* Subject name + code */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-700">{item.subjectName}</span>
                      {item.subjectCode && (
                        <span className="text-[10px] bg-slate-100 text-slate-500 rounded px-1.5 py-0.5 font-mono">
                          {item.subjectCode}
                        </span>
                      )}
                    </div>

                    {/* Sections as chips — each chip shows section + count + status color */}
                    <div className="flex flex-wrap gap-1.5">
                      {sortedSections.map((sec, si) => {
                        const sCfg = sectionStatusCfg[sec.status];
                        return (
                          <div
                            key={`${sec.sectionName ?? "all"}-${sec.semester ?? ""}-${sec.batch ?? ""}-${si}`}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                              sCfg.bg, sCfg.text, sCfg.border,
                            )}
                          >
                            <div className={cn("h-1.5 w-1.5 rounded-full", sCfg.dot)} />
                            {sec.sectionName ? `Sec ${sec.sectionName}` : "All Sections"}
                            {sec.semester != null && ` · Sem ${sec.semester}`}
                            {sec.batch && ` · ${sec.batch}`}
                            <span className="ml-0.5 opacity-70">
                              ({sec.submittedCount}{sec.expectedCount != null ? `/${sec.expectedCount}` : ""})
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Total count */}
                  <div className="text-right flex-shrink-0">
                    <span className="text-xl font-bold text-navy-900 leading-none">{item.totalSubmittedCount}</span>
                    {item.totalExpectedCount != null && item.totalExpectedCount > 0 && (
                      <span className="text-xs text-slate-400 ml-1">/ {item.totalExpectedCount}</span>
                    )}
                    <div className="text-[10px] text-slate-400 mt-0.5">total responses</div>
                  </div>

                  {/* Overall status badge + Breakdown toggle */}
                  <div className="flex-shrink-0 mt-0.5 flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                        cfg.bg, cfg.text, cfg.border,
                      )}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {cfg.label}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        setExpandedKey(isExpanded ? null : rowKey);
                        if (onSelectStaffKey) onSelectStaffKey(rowKey);
                      }}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all shadow-2xs",
                        isExpanded
                          ? "bg-navy-900 text-white border-navy-900 shadow-xs"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100",
                      )}
                      title="View Question Feedback Breakdown for this instructor"
                    >
                      <MessageSquare className="h-3 w-3" />
                      <span>Breakdown</span>
                      {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                  </div>
                </div>

                {/* Inline Expandable Question Breakdown for this staff member */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-2 bg-slate-50/80 border-t border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-indigo-600" />
                        <span className="text-xs font-bold text-navy-900">
                          Student Question Feedback Analysis: {item.facultyName} ({item.subjectName})
                        </span>
                      </div>
                      <span className="text-xs font-medium text-slate-500">
                        {item.totalSubmittedCount} verified response{item.totalSubmittedCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <StaffQuestionBreakdownCards item={item} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer warning */}
      {pending > 0 && (
        <div className="border-t border-amber-100 bg-amber-50/50 px-5 py-2.5 flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
          <span className="text-xs text-amber-700">
            <span className="font-semibold">{pending}</span> faculty-subject{pending !== 1 ? "s" : ""} still awaiting student submissions.
            Share the feedback form link with students to begin collecting responses.
          </span>
        </div>
      )}
    </Card>
  );
}

/**
 * Dedicated Section placed right UNDER the Submission Progress Card,
 * allowing selection of any individual instructor to view their Question 1, 2, 3 breakdown.
 */
function StaffQuestionBreakdownSection({
  progress,
  selectedKey,
  onSelectKey,
}: {
  progress: SubmissionProgressItem[];
  selectedKey: string | null;
  onSelectKey: (k: string) => void;
}) {
  const currentItem =
    progress.find((p) => `${p.facultyName}|${p.subjectName}` === selectedKey) ||
    progress.find((p) => p.totalSubmittedCount > 0) ||
    progress[0];

  if (!currentItem) return null;

  return (
    <Card className="border-slate-200 bg-white shadow-xs overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
              <MessageSquare className="h-4 w-4" />
            </div>
            <h3 className="text-base font-bold text-navy-900">
              Staff-Wise Question Feedback Breakdown
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Individual student evaluation breakdown for Question 1 (Units), Question 2 (Rating), and Question 3 (Unit Status)
          </p>
        </div>

        {/* Staff selector */}
        <div className="flex items-center gap-2">
          <label htmlFor="staff-breakdown-select" className="text-xs font-semibold text-slate-600">
            Instructor:
          </label>
          <select
            id="staff-breakdown-select"
            value={selectedKey || `${currentItem.facultyName}|${currentItem.subjectName}`}
            onChange={(e) => onSelectKey(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 shadow-2xs max-w-sm truncate"
          >
            {progress.map((p) => {
              const k = `${p.facultyName}|${p.subjectName}`;
              return (
                <option key={k} value={k}>
                  {p.facultyName} — {p.subjectName} ({p.totalSubmittedCount} response{p.totalSubmittedCount !== 1 ? "s" : ""})
                </option>
              );
            })}
          </select>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Selected Faculty header banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/70">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-100 text-navy-900 font-bold text-sm">
              {currentItem.facultyName.charAt(0)}
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold text-navy-900">{currentItem.facultyName}</span>
                {currentItem.employeeCode && (
                  <span className="text-[10px] text-slate-400 font-mono">{currentItem.employeeCode}</span>
                )}
              </div>
              <p className="text-xs font-medium text-slate-600">
                {currentItem.subjectName} {currentItem.subjectCode ? `(${currentItem.subjectCode})` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-sm font-bold text-navy-900">{currentItem.totalSubmittedCount}</span>
              {currentItem.totalExpectedCount != null && currentItem.totalExpectedCount > 0 && (
                <span className="text-xs text-slate-400 ml-1">/ {currentItem.totalExpectedCount}</span>
              )}
              <div className="text-[10px] text-slate-400">responses</div>
            </div>
            {currentItem.averageRating != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 border border-amber-200">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {currentItem.averageRating.toFixed(1)} / 5.0
              </span>
            )}
          </div>
        </div>

        {/* 3 Question breakdown cards */}
        <StaffQuestionBreakdownCards item={currentItem} />
      </div>
    </Card>
  );
}

export function FeedbackReportsView() {
  const [report, setReport] = useState<FeedbackReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [selectedStaffKey, setSelectedStaffKey] = useState<string | null>(null);

  // Filters state
  const [selectedPublicationId, setSelectedPublicationId] = useState<number | undefined>(undefined);
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [selectedSemester, setSelectedSemester] = useState<string>("all");
  const [searchFaculty, setSearchFaculty] = useState<string>("");

  // Publish Form Modal state (Supports Multi-College, Multi-Course & Actual Academic Year)
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [publishFormId, setPublishFormId] = useState<number | "">("");
  const [publishTitle, setPublishTitle] = useState("Academic Feedback Session");
  const [selectedCollegeIds, setSelectedCollegeIds] = useState<number[]>([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>([]);
  const [selectedBranchIds, setSelectedBranchIds] = useState<number[]>([]);
  const [publishAcademicYear, setPublishAcademicYear] = useState<string>("");
  const [publishSemester, setPublishSemester] = useState<number | "">("");
  const [publishStartDate, setPublishStartDate] = useState(() => {
    const now = new Date();
    return toInputDateTime(now.toISOString());
  });
  const [publishEndDate, setPublishEndDate] = useState(() => {
    const future = new Date();
    future.setDate(future.getDate() + 30);
    return toInputDateTime(future.toISOString());
  });
  const [publishIsActive, setPublishIsActive] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Targeted Student Audience state
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [selectedYearsOfStudy, setSelectedYearsOfStudy] = useState<number[]>([]);

  // Mapped Staff & Subjects evaluation state
  const [modalStaffSubjects, setModalStaffSubjects] = useState<MappedStaffSubject[]>([]);
  const [selectedStaffSubjectKeys, setSelectedStaffSubjectKeys] = useState<Set<string>>(new Set());
  const [searchStaffSubject, setSearchStaffSubject] = useState<string>("");
  const [isLoadingStaffSubjects, setIsLoadingStaffSubjects] = useState<boolean>(false);

  // View Mapped Staff in published banner modal
  const [isViewMappedModalOpen, setIsViewMappedModalOpen] = useState<boolean>(false);
  const [viewMappedSearch, setViewMappedSearch] = useState<string>("");

  // Edit Dates Modal state
  const [isEditDatesOpen, setIsEditDatesOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [updatingDates, setUpdatingDates] = useState(false);
  const [editDatesError, setEditDatesError] = useState<string | null>(null);

  const printAreaRef = useRef<HTMLDivElement>(null);

  // Filter courses based on selected colleges
  const relevantCourses = useMemo(() => {
    if (!report?.availableCourses) return [];
    if (selectedCollegeIds.length === 0) return report.availableCourses;
    return report.availableCourses.filter((c) => selectedCollegeIds.includes(c.collegeId));
  }, [report?.availableCourses, selectedCollegeIds]);

  // Filter branches based on selected courses and colleges
  const relevantBranches = useMemo(() => {
    if (!report?.availableBranches) return [];
    if (selectedCourseIds.length > 0) {
      return report.availableBranches.filter((b) => b.courseId && selectedCourseIds.includes(b.courseId));
    }
    if (selectedCollegeIds.length > 0) {
      const allowedCourseIds = new Set(relevantCourses.map((c) => c.id));
      return report.availableBranches.filter((b) => b.courseId && allowedCourseIds.has(b.courseId));
    }
    return report.availableBranches;
  }, [report?.availableBranches, selectedCourseIds, selectedCollegeIds, relevantCourses]);

  // Load report data
  const fetchReport = async (pubId?: number, branch?: string, semester?: string) => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (pubId && pubId > 0) queryParams.set("publicationId", String(pubId));
      if (branch && branch !== "all") queryParams.set("branch", branch);
      if (semester && semester !== "all") queryParams.set("semester", semester);

      const qs = queryParams.toString();
      const url = `/settings/feedback-forms/reports${qs ? `?${qs}` : ""}`;
      const res = await apiFetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to load feedback report data");
      }
      const data: FeedbackReportData = await res.json();
      setReport(data);

      if (data.publication) {
        setSelectedPublicationId(data.publication.id);
      }
      if (data.currentAcademicYear && !publishAcademicYear) {
        setPublishAcademicYear(data.currentAcademicYear);
      }
      const progress = data.submissionProgress;
      if (progress && progress.length > 0) {
        setSelectedStaffKey((prev) => {
          if (prev && progress.some((p) => `${p.facultyName}|${p.subjectName}` === prev)) {
            return prev;
          }
          const withSubs = progress.find((p) => p.totalSubmittedCount > 0);
          const chosen = withSubs || progress[0];
          return `${chosen.facultyName}|${chosen.subjectName}`;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchReport(selectedPublicationId, selectedBranch, selectedSemester);
  }, [selectedPublicationId, selectedBranch, selectedSemester]);

  // Check URL params for publishFormId if user was linked from Settings
  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const publishFormIdParam = searchParams.get("publishFormId");
      if (publishFormIdParam) {
        const formIdNum = Number(publishFormIdParam);
        if (formIdNum > 0) {
          setPublishFormId(formIdNum);
          setIsPublishModalOpen(true);
        }
      }
    }
  }, [report?.forms]);

  const handlePrint = () => {
    if (printAreaRef.current) {
      printElement(printAreaRef.current, {
        title: `${report?.publication?.title || "Academic Feedback"} Report`,
        subtitle: `Pydah Academic Portal - Published Feedback Session (${report?.publication?.startDate ? formatDisplayDateTime(report.publication.startDate) : ""} to ${report?.publication?.endDate ? formatDisplayDateTime(report.publication.endDate) : ""})`,
      });
    }
  };

  function getStaffSubjectKey(item: MappedStaffSubject): string {
    return `${item.staffLinkId ?? item.facultyName}__${item.subjectId ?? item.subjectCode ?? item.subjectName}__${item.sectionName ?? "all"}__${item.semester ?? "all"}__${item.batch ?? "all"}`;
  }

  const fetchStaffSubjectsForModal = async (overrides?: {
    collegeIds?: number[];
    courseIds?: number[];
    branchIds?: number[];
    academicYear?: string;
    semester?: number | "";
    batches?: string[];
    sections?: string[];
  }) => {
    setIsLoadingStaffSubjects(true);
    try {
      const colIds = overrides?.collegeIds ?? selectedCollegeIds;
      const cIds = overrides?.courseIds ?? selectedCourseIds;
      const bIds = overrides?.branchIds ?? selectedBranchIds;
      const yr = overrides?.academicYear ?? publishAcademicYear;
      const sem = overrides?.semester ?? publishSemester;
      const bts = overrides?.batches ?? selectedBatches;
      const secs = overrides?.sections ?? selectedSections;

      const q = new URLSearchParams();
      if (yr && yr !== "all") q.set("academicYear", yr);
      if (colIds.length > 0) q.set("collegeIds", colIds.join(","));
      if (cIds.length > 0) q.set("courseIds", cIds.join(","));
      if (bIds.length > 0) q.set("branchIds", bIds.join(","));
      if (sem) q.set("semester", String(sem));
      if (bts.length > 0) q.set("batches", bts.join(","));
      if (secs.length > 0) q.set("sections", secs.join(","));

      const res = await apiFetch(`/settings/feedback-forms/staff-subjects?${q.toString()}`);
      if (res.ok) {
        const raw: MappedStaffSubject[] = await res.json();
        // Deduplicate by key — same staff+subject+section+sem+batch can appear multiple times
        // because one teacher may have multiple timetable entry rows (different periods/slots)
        const seen = new Set<string>();
        const items: MappedStaffSubject[] = [];
        for (const item of raw) {
          const k = getStaffSubjectKey(item);
          if (!seen.has(k)) {
            seen.add(k);
            items.push(item);
          }
        }
        setModalStaffSubjects(items);
        setSelectedStaffSubjectKeys(new Set(items.map(getStaffSubjectKey)));
      }
    } catch (err) {
      console.error("Failed to load staff subjects", err);
    } finally {
      setIsLoadingStaffSubjects(false);
    }
  };

  useEffect(() => {
    if (!isPublishModalOpen) return;
    const timer = setTimeout(() => {
      void fetchStaffSubjectsForModal();
    }, 250);
    return () => clearTimeout(timer);
  }, [
    isPublishModalOpen,
    publishAcademicYear,
    selectedCollegeIds,
    selectedCourseIds,
    selectedBranchIds,
    publishSemester,
    selectedBatches,
    selectedSections,
  ]);

  const filteredModalStaffSubjects = useMemo(() => {
    if (!modalStaffSubjects) return [];
    if (!searchStaffSubject.trim()) return modalStaffSubjects;
    const q = searchStaffSubject.toLowerCase();
    return modalStaffSubjects.filter(
      (s) =>
        s.facultyName.toLowerCase().includes(q) ||
        s.subjectName.toLowerCase().includes(q) ||
        (s.subjectCode && s.subjectCode.toLowerCase().includes(q)) ||
        (s.sectionName && s.sectionName.toLowerCase().includes(q)) ||
        (s.employeeCode && s.employeeCode.toLowerCase().includes(q)),
    );
  }, [modalStaffSubjects, searchStaffSubject]);

  const openPublishModal = () => {
    setPublishError(null);
    if (report?.forms && report.forms.length > 0 && !publishFormId) {
      setPublishFormId(report.forms[0].id);
    }
    setSelectedCollegeIds([]);
    setSelectedCourseIds([]);
    setSelectedBranchIds([]);
    setSelectedBatches([]);
    setSelectedSections([]);
    setSelectedYearsOfStudy([]);
    setSearchStaffSubject("");
    const activeYear = report?.currentAcademicYear || "2026-2027";
    setPublishAcademicYear(activeYear);
    setPublishSemester("");
    const now = new Date();
    setPublishStartDate(toInputDateTime(now.toISOString()));
    const future = new Date();
    future.setDate(future.getDate() + 30);
    setPublishEndDate(toInputDateTime(future.toISOString()));
    setPublishTitle(`Academic Feedback Session - ${activeYear}`);

    if (report?.availableStaffSubjects && report.availableStaffSubjects.length > 0) {
      // Deduplicate in case same staff+subject+section combo has multiple timetable rows
      const seen = new Set<string>();
      const deduped: MappedStaffSubject[] = [];
      for (const item of report.availableStaffSubjects) {
        const k = getStaffSubjectKey(item);
        if (!seen.has(k)) { seen.add(k); deduped.push(item); }
      }
      setModalStaffSubjects(deduped);
      setSelectedStaffSubjectKeys(new Set(deduped.map(getStaffSubjectKey)));
    } else {
      void fetchStaffSubjectsForModal({
        academicYear: activeYear,
        collegeIds: [],
        courseIds: [],
        branchIds: [],
        semester: "",
        batches: [],
        sections: [],
      });
    }

    setIsPublishModalOpen(true);
  };

  const handlePublishSubmit = async () => {
    setPublishError(null);
    if (!publishFormId) {
      setPublishError("Please select a feedback form template to publish.");
      return;
    }
    if (!publishTitle.trim()) {
      setPublishError("Please provide a publication title for this feedback session.");
      return;
    }
    if (!publishStartDate || !publishEndDate) {
      setPublishError("Both Start Date and End Date are required for the activation period.");
      return;
    }

    setPublishing(true);
    try {
      const targetColleges = selectedCollegeIds.length > 0
        ? (report?.availableColleges || []).filter((c) => selectedCollegeIds.includes(c.id))
        : null;

      const targetCourses = selectedCourseIds.length > 0
        ? (relevantCourses || []).filter((c) => selectedCourseIds.includes(c.id))
        : null;

      const targetBranches = selectedBranchIds.length > 0
        ? (relevantBranches || []).filter((b) => selectedBranchIds.includes(b.id))
        : null;

      const targetAudience: TargetAudienceScope = {
        batches: selectedBatches.length > 0 ? selectedBatches : undefined,
        sections: selectedSections.length > 0 ? selectedSections : undefined,
        yearsOfStudy: selectedYearsOfStudy.length > 0 ? selectedYearsOfStudy : undefined,
      };

      const selectedMappedStaffSubjects = modalStaffSubjects.filter((s) =>
        selectedStaffSubjectKeys.has(getStaffSubjectKey(s)),
      );

      const payload = {
        formId: Number(publishFormId),
        title: publishTitle.trim(),
        targetColleges,
        collegeId: targetColleges && targetColleges.length === 1 ? targetColleges[0].id : null,
        collegeName: targetColleges ? targetColleges.map((c) => c.code || c.name).join(", ") : "All Colleges",
        targetCourses,
        courseId: targetCourses && targetCourses.length === 1 ? targetCourses[0].id : null,
        courseName: targetCourses ? targetCourses.map((c) => c.code || c.name).join(", ") : "All Courses",
        targetBranches,
        branchId: targetBranches && targetBranches.length === 1 ? targetBranches[0].id : null,
        branchName: targetBranches ? targetBranches.map((b) => b.code || b.name).join(", ") : "All Branches",
        targetAudience,
        mappedStaffSubjects: selectedMappedStaffSubjects,
        academicYear: publishAcademicYear.trim() || report?.currentAcademicYear || "2026-2027",
        semester: publishSemester ? Number(publishSemester) : null,
        startDate: publishStartDate,
        endDate: publishEndDate,
        isActive: publishIsActive,
      };

      const res = await apiFetch("/settings/feedback-publications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to publish feedback form");
      }

      const createdPub: FeedbackPublication = await res.json();
      setIsPublishModalOpen(false);
      setActionNotice(`Feedback form "${createdPub.title}" has been published successfully!`);
      setSelectedPublicationId(createdPub.id);
      await fetchReport(createdPub.id, "all", "all");
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : "Error publishing feedback form");
    } finally {
      setPublishing(false);
    }
  };

  const openEditDatesModal = () => {
    if (!report?.publication) return;
    setEditDatesError(null);
    setEditTitle(report.publication.title);
    setEditStartDate(toInputDateTime(report.publication.startDate));
    setEditEndDate(toInputDateTime(report.publication.endDate));
    setEditIsActive(report.publication.isActive);
    setIsEditDatesOpen(true);
  };

  const handleUpdateDatesSubmit = async () => {
    if (!report?.publication) return;
    setEditDatesError(null);
    if (!editTitle.trim()) {
      setEditDatesError("Title cannot be empty.");
      return;
    }
    if (!editStartDate || !editEndDate) {
      setEditDatesError("Start Date and End Date are required.");
      return;
    }

    setUpdatingDates(true);
    try {
      const payload = {
        title: editTitle.trim(),
        startDate: editStartDate,
        endDate: editEndDate,
        isActive: editIsActive,
      };

      const res = await apiFetch(`/settings/feedback-publications/${report.publication.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to update publication");
      }

      setIsEditDatesOpen(false);
      setActionNotice("Feedback session dates & status updated successfully!");
      await fetchReport(report.publication.id, selectedBranch, selectedSemester);
    } catch (err) {
      setEditDatesError(err instanceof Error ? err.message : "Error updating dates");
    } finally {
      setUpdatingDates(false);
    }
  };

  const handleDeletePublication = async (pubId: number, title: string) => {
    if (!confirm(`Are you sure you want to delete publication session "${title}"? Responses recorded for it will also be deleted.`)) {
      return;
    }
    try {
      const res = await apiFetch(`/settings/feedback-publications/${pubId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to delete publication");
      }
      setActionNotice(`Publication "${title}" deleted successfully.`);
      setSelectedPublicationId(undefined);
      await fetchReport(undefined, "all", "all");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete publication");
    }
  };

  const filteredFaculty = useMemo(() => {
    if (!report?.facultyBreakdown) return [];
    if (!searchFaculty.trim()) return report.facultyBreakdown;
    const term = searchFaculty.toLowerCase();
    return report.facultyBreakdown.filter(
      (f) =>
        f.facultyName.toLowerCase().includes(term) ||
        f.subjectName.toLowerCase().includes(term) ||
        f.branchName.toLowerCase().includes(term),
    );
  }, [report?.facultyBreakdown, searchFaculty]);

  const formatDateTime = (str: string) => {
    if (!str) return "—";
    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const activePublication = report?.publication;

  return (
    <div className="space-y-6">
      {/* Top Action & Publishing Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy-900 tracking-tight flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-navy-700" />
            Feedback Application Reports & Publishing
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Publish student evaluation forms, configure activation date ranges, and view live verified ratings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void fetchReport(selectedPublicationId, selectedBranch, selectedSemester)}
            className="flex items-center gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={openPublishModal}
            className="flex items-center gap-1.5 bg-navy-800 hover:bg-navy-900 text-white shadow-xs"
          >
            <Send className="h-3.5 w-3.5" />
            Publish Feedback Form
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handlePrint}
            disabled={loading || !report}
            className="flex items-center gap-1.5"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Report
          </Button>
        </div>
      </div>

      {/* Action / Success Notice */}
      {actionNotice ? (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span>{actionNotice}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="text-xs text-emerald-700 hover:underline"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {/* Error Notice */}
      {error ? (
        <div className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-rose-600" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-xs text-rose-700 hover:underline"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {/* ========================================================================= */}
      {/* ACTIVE PUBLICATION & ACTIVATION PERIOD BANNER                             */}
      {/* ========================================================================= */}
      {activePublication ? (
        <Card className="border-navy-200/90 bg-gradient-to-r from-navy-900 via-navy-800 to-slate-900 text-white p-5 shadow-md">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Published Session
                </span>
                {activePublication.status === "active" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    Active Now
                  </span>
                ) : activePublication.status === "scheduled" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-400/40 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
                    <Clock className="h-3 w-3 text-amber-400" />
                    Scheduled
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/30 border border-slate-400/40 px-2.5 py-0.5 text-xs font-semibold text-slate-300">
                    Closed
                  </span>
                )}
                <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-slate-300">
                  Form: {activePublication.formName}
                </span>
              </div>

              <h3 className="text-lg font-bold text-white tracking-tight">
                {activePublication.title}
              </h3>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
                <div>
                  <span className="text-slate-400">Target College: </span>
                  <span className="font-semibold text-white">
                    {activePublication.collegeName || "All Colleges"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Courses: </span>
                  <span className="font-semibold text-white">
                    {activePublication.courseName || "All Courses"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Branch: </span>
                  <span className="font-semibold text-white">
                    {activePublication.branchName || "All Branches"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Academic Year: </span>
                  <span className="font-semibold text-white">
                    {activePublication.academicYear}
                  </span>
                </div>
                {activePublication.semester ? (
                  <div>
                    <span className="text-slate-400">Semester: </span>
                    <span className="font-semibold text-white">
                      Sem {activePublication.semester}
                    </span>
                  </div>
                ) : null}

                {/* Target Audience details in banner */}
                {activePublication.targetAudience?.batches && activePublication.targetAudience.batches.length > 0 ? (
                  <div>
                    <span className="text-slate-400">Target Batches: </span>
                    <span className="font-semibold text-emerald-300">
                      {activePublication.targetAudience.batches.join(", ")}
                    </span>
                  </div>
                ) : null}

                {activePublication.targetAudience?.sections && activePublication.targetAudience.sections.length > 0 ? (
                  <div>
                    <span className="text-slate-400">Target Sections: </span>
                    <span className="font-semibold text-emerald-300">
                      {activePublication.targetAudience.sections.map((s) => `Sec ${s}`).join(", ")}
                    </span>
                  </div>
                ) : null}

                {activePublication.targetAudience?.yearsOfStudy && activePublication.targetAudience.yearsOfStudy.length > 0 ? (
                  <div>
                    <span className="text-slate-400">Target Years: </span>
                    <span className="font-semibold text-emerald-300">
                      {activePublication.targetAudience.yearsOfStudy
                        .map((y) => `${y}${y === 1 ? "st" : y === 2 ? "nd" : y === 3 ? "rd" : "th"} Year`)
                        .join(", ")}
                    </span>
                  </div>
                ) : null}
              </div>

              {/* Mapped Staff & Subjects evaluation link in banner */}
              {activePublication.mappedStaffSubjects && activePublication.mappedStaffSubjects.length > 0 ? (
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 px-3 py-1 text-xs font-semibold text-emerald-200">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span>{activePublication.mappedStaffSubjects.length} Faculty-Subject Allocations Mapped</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMappedSearch("");
                      setIsViewMappedModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-300 hover:text-white underline decoration-slate-500 hover:decoration-white transition-colors"
                  >
                    <span>View Mapped Faculty & Subjects</span>
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              ) : null}
            </div>

            {/* Activation Period Card Box */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="rounded-xl border border-white/15 bg-white/10 backdrop-blur-md p-3.5 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-300">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Activation Period (Live in System):</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-slate-200 pt-0.5">
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase">Start Date:</span>
                    <span className="font-semibold text-white">
                      {formatDisplayDateTime(activePublication.startDate)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase">End Date:</span>
                    <span className="font-semibold text-white">
                      {formatDisplayDateTime(activePublication.endDate)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex sm:flex-col gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={openEditDatesModal}
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs flex items-center justify-center gap-1.5"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Edit Dates
                </Button>
                <button
                  type="button"
                  onClick={() => void handleDeletePublication(activePublication.id, activePublication.title)}
                  className="rounded-md border border-rose-500/30 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 px-2.5 py-1.5 text-xs transition flex items-center justify-center"
                  title="Delete publication"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {/* ========================================================================= */}
      {/* FILTER CONTROLS BAR                                                       */}
      {/* ========================================================================= */}
      <Card className="border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Published Session Selector */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Published Feedback Session
              </label>
              <select
                value={selectedPublicationId || ""}
                onChange={(e) => setSelectedPublicationId(Number(e.target.value))}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-navy-900 outline-none transition focus:border-navy-500 focus:ring-1 focus:ring-navy-500 min-w-[240px]"
              >
                {report?.publications && report.publications.length > 0 ? (
                  report.publications.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.status.toUpperCase()})
                    </option>
                  ))
                ) : (
                  <option value="">No Published Sessions Found</option>
                )}
              </select>
            </div>

            {/* Department / Branch Filter */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Department / Branch
              </label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 outline-none transition focus:border-navy-500 min-w-[190px]"
              >
                <option value="all">All Departments</option>
                {report?.availableBranches?.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Semester Filter */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Semester
              </label>
              <select
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 outline-none transition focus:border-navy-500 min-w-[120px]"
              >
                <option value="all">All Semesters</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                  <option key={sem} value={sem}>
                    Semester {sem}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              Showing reports for: <strong className="text-navy-900">{activePublication ? activePublication.title : "All"}</strong>
            </span>
          </div>
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* REPORT CONTENT & ANALYTICS                                                 */}
      {/* ========================================================================= */}
      <div ref={printAreaRef} className="space-y-6">
        {loading && !report ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <ContentCardSkeleton contentHeight="h-28" />
              <ContentCardSkeleton contentHeight="h-28" />
              <ContentCardSkeleton contentHeight="h-28" />
              <ContentCardSkeleton contentHeight="h-28" />
            </div>
            <ContentCardSkeleton contentHeight="h-64" />
          </div>
        ) : report ? (
          <>
            {/* Top KPI Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Total Submissions */}
              <Card className="relative overflow-hidden border-slate-200/90 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Total Submissions
                  </span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-50 text-navy-800">
                    <Users className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-navy-900">
                    {report.stats.totalSubmissions > 0 ? report.stats.totalSubmissions : "null"}
                  </span>
                  <span className="text-xs font-medium text-emerald-600">
                    {report.stats.totalSubmissions > 0 ? "✓ Anonymous Verified" : "No submissions"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Evaluations submitted across evaluated subjects
                </p>
              </Card>

              {/* Overall Faculty Rating */}
              <Card className="relative overflow-hidden border-slate-200/90 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Faculty Rating Avg
                  </span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <Star className="h-5 w-5 fill-amber-500 text-amber-500" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-navy-900">
                    {report.stats.averageRating != null ? report.stats.averageRating.toFixed(1) : "null"}
                  </span>
                  {report.stats.averageRating != null ? (
                    <span className="text-sm font-semibold text-slate-400">/ 5.0</span>
                  ) : null}
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-600">
                  {report.stats.ratingSatisfactionPct != null ? (
                    <>
                      <span className="font-semibold text-emerald-700">
                        {report.stats.ratingSatisfactionPct}%
                      </span>
                      <span>rated 4 or 5 stars (Question 2)</span>
                    </>
                  ) : (
                    <span className="text-slate-400">No ratings submitted yet</span>
                  )}
                </div>
              </Card>

              {/* Units Coverage Pace */}
              <Card className="relative overflow-hidden border-slate-200/90 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Units Covered Avg
                  </span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                    <BookOpen className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-navy-900">
                    {report.stats.averageUnitsCovered != null ? report.stats.averageUnitsCovered.toFixed(1) : "null"}
                  </span>
                  {report.stats.averageUnitsCovered != null ? (
                    <span className="text-sm font-semibold text-slate-400">/ 5 Units</span>
                  ) : null}
                </div>
                <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full"
                    style={{
                      width: report.stats.averageUnitsCovered != null
                        ? `${Math.min(100, (report.stats.averageUnitsCovered / 5) * 100)}%`
                        : "0%",
                    }}
                  />
                </div>
              </Card>

              {/* Syllabus Completion Phase */}
              <Card className="relative overflow-hidden border-slate-200/90 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Syllabus Completion
                  </span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-emerald-700">
                    {report.stats.completionRate != null ? `${report.stats.completionRate}%` : "null"}
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    {report.stats.completionRate != null ? "Ending or Completed" : "No status reported"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Unit status reporting completion pace (Question 3)
                </p>
              </Card>
            </div>

            {/* ── Submission Progress Card (with per-staff Question Breakdown) ── */}
            {report.submissionProgress && report.submissionProgress.length > 0 && (
              <SubmissionProgressCard
                progress={report.submissionProgress}
                summary={report.submissionSummary}
                selectedStaffKey={selectedStaffKey}
                onSelectStaffKey={setSelectedStaffKey}
              />
            )}

            {/* ── Staff-Wise Question Feedback Breakdown (Moved under Submission Progress) ── */}
            {report.submissionProgress && report.submissionProgress.length > 0 && (
              <StaffQuestionBreakdownSection
                progress={report.submissionProgress}
                selectedKey={selectedStaffKey}
                onSelectKey={setSelectedStaffKey}
              />
            )}

            {/* Faculty & Subject Evaluation Ranking Table */}
            <Card className="border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-navy-900">
                    Faculty & Subject Evaluation Breakdown
                  </h3>
                  <p className="text-xs text-slate-500">
                    Comparative student feedback scores, units completed, and ratings by instructor
                  </p>
                </div>

                <input
                  type="text"
                  placeholder="Search faculty or subject..."
                  value={searchFaculty}
                  onChange={(e) => setSearchFaculty(e.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-navy-500 w-64"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600">
                      <th className="py-2.5 px-3 font-semibold">Faculty Name</th>
                      <th className="py-2.5 px-3 font-semibold">Subject</th>
                      <th className="py-2.5 px-3 font-semibold">Department</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Responses</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Avg Rating (1-5)</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Avg Units</th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredFaculty.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500">
                          <div className="flex flex-col items-center justify-center space-y-1">
                            <FileText className="h-8 w-8 text-slate-300" />
                            <span className="font-semibold text-slate-700">No student evaluations recorded yet</span>
                            <span className="text-xs text-slate-400 max-w-md">
                              Evaluations and ratings by faculty instructor will be calculated automatically when students submit their feedback.
                            </span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredFaculty.map((f, i) => (
                        <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3 font-semibold text-navy-900 flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-navy-100 text-navy-800 font-bold text-xs">
                              {f.facultyName.charAt(0)}
                            </span>
                            <span>{f.facultyName}</span>
                          </td>
                          <td className="py-3 px-3 text-slate-800 font-medium">{f.subjectName}</td>
                          <td className="py-3 px-3 text-slate-600">{f.branchName}</td>
                          <td className="py-3 px-3 text-center font-semibold text-slate-700">
                            {f.responsesCount}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 font-bold text-amber-900 border border-amber-200">
                              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                              {f.avgRating.toFixed(1)}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-medium text-slate-700">
                            {f.avgUnits.toFixed(1)} / 5
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                f.statusBadge === "Excellent"
                                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                  : f.statusBadge === "Good"
                                  ? "bg-blue-50 text-blue-800 border border-blue-200"
                                  : f.statusBadge === "Satisfactory"
                                  ? "bg-amber-50 text-amber-800 border border-amber-200"
                                  : "bg-rose-50 text-rose-800 border border-rose-200"
                              }`}
                            >
                              {f.statusBadge}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Recent Anonymous Submissions Stream */}
            <Card className="border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <h3 className="text-base font-bold text-navy-900">
                    Recent Anonymous Student Submissions Log
                  </h3>
                </div>
                <span className="text-xs text-slate-500">
                  Showing latest {report.recentSubmissions.length} verified submissions
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600">
                      <th className="py-2 px-3 font-semibold">Submitted</th>
                      <th className="py-2 px-3 font-semibold">Department & Sem</th>
                      <th className="py-2 px-3 font-semibold">Subject & Faculty</th>
                      <th className="py-2 px-3 font-semibold text-center">Units Covered</th>
                      <th className="py-2 px-3 font-semibold text-center">Faculty Rating</th>
                      <th className="py-2 px-3 font-semibold">Unit Status</th>
                      <th className="py-2 px-3 font-semibold text-right">Student Verification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.recentSubmissions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500">
                          <div className="flex flex-col items-center justify-center space-y-1">
                            <ShieldCheck className="h-8 w-8 text-slate-300" />
                            <span className="font-semibold text-slate-700">No submissions recorded yet</span>
                            <span className="text-xs text-slate-400 max-w-md">
                              Submissions will be verified and logged here anonymously as students submit feedback within the active period.
                            </span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      report.recentSubmissions.map((sub) => (
                        <tr key={sub.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 text-slate-500">
                            {formatDateTime(sub.submittedAt)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 font-medium">
                            {sub.branchName} · Sem {sub.semester} ({sub.sectionName})
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="block font-semibold text-slate-900">
                              {sub.subjectName}
                            </span>
                            <span className="block text-[11px] text-slate-500">
                              {sub.facultyName}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="rounded bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">
                              {sub.unitsCovered}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-flex items-center gap-1 font-bold text-amber-700">
                              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                              {sub.facultyRating}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-medium text-slate-800">{sub.unitStatus}</span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <span className="font-mono text-[11px] text-slate-400">
                              {sub.tokenHash}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        ) : null}
      </div>

      {/* ========================================================================= */}
      {/* PUBLISH FEEDBACK FORM MODAL (WITH ACTIVATION PERIOD DATES)                 */}
      {/* ========================================================================= */}
      {isPublishModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto backdrop-blur-xs">
          <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-navy-900 flex items-center gap-2">
                  <Send className="h-5 w-5 text-navy-700" />
                  Publish Feedback Form
                </h3>
                <p className="text-xs text-slate-500">
                  Select a template, map staff subjects, define targeted audience, and configure activation dates
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPublishModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-5">
              {publishError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                  {publishError}
                </div>
              ) : null}

              {/* Form Template Picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Feedback Form Template <span className="text-rose-500">*</span>
                </label>
                <select
                  value={publishFormId}
                  onChange={(e) => setPublishFormId(Number(e.target.value))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500 font-medium"
                >
                  <option value="">Select a form template...</option>
                  {report?.forms?.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.questionCount} evaluation questions)
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-500">
                  Form questions are designed in Settings → Feedback Forms.
                </p>
              </div>

              {/* Publication Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Publication Session Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={publishTitle}
                  onChange={(e) => setPublishTitle(e.target.value)}
                  placeholder="e.g. Academic Feedback - Spring 2026"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
                />
              </div>

              {/* Target Scope Grid */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-navy-900 block">
                      Target Scope & Student Audience
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Multi-select colleges and courses, set specific departments, and choose the actual academic session.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3.5 sm:grid-cols-2">
                  {/* 1. Target Colleges Multi-Select */}
                  <DropdownMultiSelect
                    label="Target Colleges"
                    icon={Building}
                    allLabel="All Colleges (Campus-wide)"
                    options={report?.availableColleges || []}
                    selectedIds={selectedCollegeIds}
                    onChange={(ids) => setSelectedCollegeIds(ids)}
                    placeholder="Search colleges..."
                  />

                  {/* 2. Target Courses Multi-Select */}
                  <DropdownMultiSelect
                    label="Target Courses / Degrees"
                    icon={GraduationCap}
                    allLabel="All Courses"
                    options={relevantCourses}
                    selectedIds={selectedCourseIds}
                    onChange={(ids) => setSelectedCourseIds(ids)}
                    placeholder="Search courses (B.Tech, MBA, etc.)..."
                  />

                  {/* 3. Target Branches / Departments Multi-Select */}
                  <DropdownMultiSelect
                    label="Target Branches / Departments"
                    icon={Layers}
                    allLabel="All Branches (College-wide)"
                    options={relevantBranches}
                    selectedIds={selectedBranchIds}
                    onChange={(ids) => setSelectedBranchIds(ids)}
                    placeholder="Search branches (CSE, ECE, etc.)..."
                  />

                  {/* 4. Academic Year & Semester Scope */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-navy-700" />
                          <span>Academic Year <span className="text-rose-500">*</span></span>
                        </label>
                      </div>
                      <select
                        value={publishAcademicYear}
                        onChange={(e) => setPublishAcademicYear(e.target.value)}
                        className="w-full min-h-10 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-900 outline-none focus:border-navy-500 shadow-2xs"
                      >
                        {report?.availableAcademicYears && report.availableAcademicYears.length > 0 ? (
                          report.availableAcademicYears.map((yr) => (
                            <option key={yr.label} value={yr.label}>
                              {yr.label} {yr.isActive || yr.label === report.currentAcademicYear ? "★ (Active)" : ""}
                            </option>
                          ))
                        ) : (
                          <option value="2026-2027">2026-2027 (Active)</option>
                        )}
                      </select>
                      <span className="block text-[10.5px] text-slate-500 mt-1">
                        Active: <strong className="text-navy-900">{report?.currentAcademicYear || "2026-2027"}</strong>
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <BookOpen className="h-3.5 w-3.5 text-navy-700" />
                          <span>Semester</span>
                        </label>
                      </div>
                      <select
                        value={publishSemester}
                        onChange={(e) => setPublishSemester(e.target.value ? Number(e.target.value) : "")}
                        className="w-full min-h-10 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 outline-none focus:border-navy-500 shadow-2xs"
                      >
                        <option value="">All Semesters</option>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                          <option key={s} value={s}>
                            Semester {s}
                          </option>
                        ))}
                      </select>
                      <span className="block text-[10.5px] text-slate-500 mt-1">
                        Target all or single sem
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* TARGETED STUDENT AUDIENCE (BATCHES, SECTIONS & YEAR OF STUDY) */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Target className="h-4 w-4 text-navy-700" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-navy-900">
                      Targeted Student Audience
                    </h4>
                  </div>
                  <span className="text-[11px] font-medium text-slate-500">
                    Filter by admission batch, section, and year
                  </span>
                </div>

                {/* Batches Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <span>Target Batches</span>
                      {selectedBatches.length > 0 ? (
                        <span className="rounded-full bg-navy-100 px-2 py-0.2 text-[10px] font-bold text-navy-800">
                          {selectedBatches.length} selected
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-normal">(All Batches)</span>
                      )}
                    </label>
                    {selectedBatches.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedBatches([])}
                        className="text-[10.5px] font-medium text-navy-700 hover:text-navy-900 underline"
                      >
                        Reset to All
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedBatches([])}
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all border",
                        selectedBatches.length === 0
                          ? "bg-navy-900 text-white border-navy-900 shadow-2xs"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100",
                      )}
                    >
                      All Batches
                    </button>
                    {(report?.availableBatches || ["2026", "2025", "2024", "2023", "2022"]).map((batch) => {
                      const isSelected = selectedBatches.includes(batch);
                      return (
                        <button
                          key={batch}
                          type="button"
                          onClick={() => {
                            setSelectedBatches((prev) =>
                              isSelected ? prev.filter((b) => b !== batch) : [...prev, batch],
                            );
                          }}
                          className={cn(
                            "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all border flex items-center gap-1",
                            isSelected
                              ? "bg-navy-800 text-white border-navy-800 shadow-2xs"
                              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100",
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                          Batch {batch}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sections Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <span>Target Sections</span>
                      {selectedSections.length > 0 ? (
                        <span className="rounded-full bg-navy-100 px-2 py-0.2 text-[10px] font-bold text-navy-800">
                          {selectedSections.length} selected
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-normal">(All Sections)</span>
                      )}
                    </label>
                    {selectedSections.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedSections([])}
                        className="text-[10.5px] font-medium text-navy-700 hover:text-navy-900 underline"
                      >
                        Reset to All
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedSections([])}
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all border",
                        selectedSections.length === 0
                          ? "bg-navy-900 text-white border-navy-900 shadow-2xs"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100",
                      )}
                    >
                      All Sections
                    </button>
                    {(report?.availableSections || ["A", "B", "C", "D"]).map((sec) => {
                      const isSelected = selectedSections.includes(sec);
                      return (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => {
                            setSelectedSections((prev) =>
                              isSelected ? prev.filter((s) => s !== sec) : [...prev, sec],
                            );
                          }}
                          className={cn(
                            "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all border flex items-center gap-1",
                            isSelected
                              ? "bg-navy-800 text-white border-navy-800 shadow-2xs"
                              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100",
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                          Section {sec}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Years of Study Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <span>Target Year of Study</span>
                      {selectedYearsOfStudy.length > 0 ? (
                        <span className="rounded-full bg-navy-100 px-2 py-0.2 text-[10px] font-bold text-navy-800">
                          {selectedYearsOfStudy.length} selected
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-normal">(All Years)</span>
                      )}
                    </label>
                    {selectedYearsOfStudy.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedYearsOfStudy([])}
                        className="text-[10.5px] font-medium text-navy-700 hover:text-navy-900 underline"
                      >
                        Reset to All
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedYearsOfStudy([])}
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all border",
                        selectedYearsOfStudy.length === 0
                          ? "bg-navy-900 text-white border-navy-900 shadow-2xs"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100",
                      )}
                    >
                      All Years
                    </button>
                    {[1, 2, 3, 4].map((year) => {
                      const isSelected = selectedYearsOfStudy.includes(year);
                      const suffix = year === 1 ? "1st" : year === 2 ? "2nd" : year === 3 ? "3rd" : "4th";
                      return (
                        <button
                          key={year}
                          type="button"
                          onClick={() => {
                            setSelectedYearsOfStudy((prev) =>
                              isSelected ? prev.filter((y) => y !== year) : [...prev, year],
                            );
                          }}
                          className={cn(
                            "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all border flex items-center gap-1",
                            isSelected
                              ? "bg-navy-800 text-white border-navy-800 shadow-2xs"
                              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100",
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                          {suffix} Year
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* MAPPED STAFF & SUBJECTS EVALUATION (TIMETABLE ALLOCATIONS) */}
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 pb-2.5">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-indigo-700" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-navy-900">
                        Mapped Staff & Subjects for Evaluation
                      </h4>
                      <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-bold text-indigo-900 border border-indigo-200">
                        {selectedStaffSubjectKeys.size} of {modalStaffSubjects.length} Selected
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Timetable allocations matched to your selected scope. Choose which faculty-subject pairs will be evaluated.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const allKeys = new Set(modalStaffSubjects.map(getStaffSubjectKey));
                        setSelectedStaffSubjectKeys(allKeys);
                      }}
                      className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors shadow-2xs"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedStaffSubjectKeys(new Set())}
                      className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors shadow-2xs"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                {/* Filter Search Input */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchStaffSubject}
                    onChange={(e) => setSearchStaffSubject(e.target.value)}
                    placeholder="Search by faculty name, subject code, or subject name..."
                    className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                  />
                  {searchStaffSubject && (
                    <button
                      type="button"
                      onClick={() => setSearchStaffSubject("")}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Staff Subject Allocations List */}
                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {isLoadingStaffSubjects ? (
                    <div className="py-8 text-center text-xs text-slate-500">
                      <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mb-2" />
                      <p>Scanning timetable database for staff & subjects allocations...</p>
                    </div>
                  ) : filteredModalStaffSubjects.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-white/80 p-6 text-center text-xs text-slate-500">
                      <Users className="mx-auto h-6 w-6 text-slate-400 mb-1.5" />
                      <p className="font-semibold text-slate-700">No staff-subject allocations found for this filter scope</p>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                        You can still publish this form for general branch feedback, or expand the college, branch, or academic year scope above to detect allocations.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {filteredModalStaffSubjects.map((item) => {
                        const key = getStaffSubjectKey(item);
                        const isChecked = selectedStaffSubjectKeys.has(key);
                        return (
                          <div
                            key={key}
                            onClick={() => {
                              setSelectedStaffSubjectKeys((prev) => {
                                const next = new Set(prev);
                                if (next.has(key)) next.delete(key);
                                else next.add(key);
                                return next;
                              });
                            }}
                            className={cn(
                              "flex items-start gap-2.5 rounded-lg border p-2.5 text-left transition-all cursor-pointer select-none",
                              isChecked
                                ? "border-indigo-300 bg-white shadow-xs ring-1 ring-indigo-200"
                                : "border-slate-200 bg-white/70 opacity-60 hover:opacity-100 hover:bg-white",
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="mt-1 h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                            />
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-indigo-800 font-bold text-xs shrink-0 mt-0.5">
                              {item.facultyName.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold text-xs text-navy-900 truncate">
                                  {item.facultyName}
                                </span>
                                {item.employeeCode && (
                                  <span className="rounded bg-slate-100 px-1 py-0.2 text-[9px] font-semibold text-slate-600 border border-slate-200 shrink-0">
                                    Code: {item.employeeCode}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] font-medium text-slate-800 truncate mt-0.5">
                                {item.subjectName}
                              </p>
                              <div className="flex flex-wrap items-center gap-1 mt-1 text-[10px]">
                                {item.subjectCode && (
                                  <span className="rounded bg-indigo-50 px-1.5 py-0.5 font-bold text-indigo-700 border border-indigo-200">
                                    {item.subjectCode}
                                  </span>
                                )}
                                {item.sectionName && (
                                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700 border border-emerald-200">
                                    Sec {item.sectionName}
                                  </span>
                                )}
                                {item.semester && (
                                  <span className="rounded bg-sky-50 px-1.5 py-0.5 font-semibold text-sky-700 border border-sky-200">
                                    Sem {item.semester}
                                  </span>
                                )}
                                {item.batch && (
                                  <span className="rounded bg-purple-50 px-1.5 py-0.5 font-semibold text-purple-700 border border-purple-200">
                                    Batch {item.batch}
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
              </div>

              {/* ACTIVATION PERIOD (MOVED FROM SETTINGS TO REPORTS) */}
              <div className="rounded-xl border border-navy-200 bg-navy-50/50 p-4 space-y-3">
                <div className="border-b border-navy-100 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-navy-700" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-navy-900">
                      Activation Period & Schedule
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Define the exact date and time window when students can submit responses.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Start Date & Time <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={publishStartDate}
                      onChange={(e) => setPublishStartDate(e.target.value)}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
                    />
                    <span className="mt-1 block text-[10px] text-slate-500">
                      Formatted: {formatDisplayDateTime(publishStartDate)}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      End Date & Time <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={publishEndDate}
                      onChange={(e) => setPublishEndDate(e.target.value)}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
                    />
                    <span className="mt-1 block text-[10px] text-slate-500">
                      Formatted: {formatDisplayDateTime(publishEndDate)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="publishImmediate"
                    checked={publishIsActive}
                    onChange={(e) => setPublishIsActive(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-navy-600 focus:ring-navy-500"
                  />
                  <label htmlFor="publishImmediate" className="text-xs font-medium text-slate-800 cursor-pointer">
                    Activate form immediately for student submissions
                  </label>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 bg-slate-50/80 px-6 py-4">
              <Button
                variant="ghost"
                onClick={() => setIsPublishModalOpen(false)}
                disabled={publishing}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => void handlePublishSubmit()}
                disabled={publishing}
                className="flex items-center gap-2 bg-navy-800 hover:bg-navy-900 text-white"
              >
                <Send className="h-4 w-4" />
                {publishing ? "Publishing Form..." : "Publish Feedback Form"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ========================================================================= */}
      {/* EDIT DATES & STATUS MODAL                                                  */}
      {/* ========================================================================= */}
      {isEditDatesOpen && activePublication ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto backdrop-blur-xs">
          <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-navy-900 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-navy-700" />
                  Edit Feedback Activation Dates
                </h3>
                <p className="text-xs text-slate-500">
                  Update active dates or extend deadline for {activePublication.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditDatesOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-4">
              {editDatesError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                  {editDatesError}
                </div>
              ) : null}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Session Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 outline-none focus:border-navy-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Start Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 outline-none focus:border-navy-500"
                />
                <span className="mt-1 block text-[10px] text-slate-500">
                  Formatted: {formatDisplayDateTime(editStartDate)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  End Date & Time (Deadline)
                </label>
                <input
                  type="datetime-local"
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 outline-none focus:border-navy-500"
                />
                <span className="mt-1 block text-[10px] text-slate-500">
                  Formatted: {formatDisplayDateTime(editEndDate)}
                </span>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="editIsActive"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-navy-600 focus:ring-navy-500"
                />
                <label htmlFor="editIsActive" className="text-xs font-medium text-slate-800 cursor-pointer">
                  Session is Active (Allow student submissions within period)
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 bg-slate-50/80 px-6 py-4">
              <Button
                variant="ghost"
                onClick={() => setIsEditDatesOpen(false)}
                disabled={updatingDates}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleUpdateDatesSubmit()}
                disabled={updatingDates}
                className="bg-navy-800 hover:bg-navy-900 text-white"
              >
                {updatingDates ? "Updating..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ========================================================================= */}
      {/* VIEW MAPPED FACULTY & SUBJECTS MODAL                                      */}
      {/* ========================================================================= */}
      {isViewMappedModalOpen && activePublication?.mappedStaffSubjects ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto backdrop-blur-xs">
          <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-700" />
                <div>
                  <h3 className="text-base font-bold text-navy-900">
                    Mapped Faculty & Subject Allocations ({activePublication.mappedStaffSubjects.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    {activePublication.title} • {activePublication.academicYear}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsViewMappedModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-100 bg-white">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={viewMappedSearch}
                  onChange={(e) => setViewMappedSearch(e.target.value)}
                  placeholder="Filter allocations by faculty or subject..."
                  className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-900 outline-none focus:border-indigo-500 shadow-2xs"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                {activePublication.mappedStaffSubjects
                  .filter((item) => {
                    if (!viewMappedSearch.trim()) return true;
                    const q = viewMappedSearch.toLowerCase();
                    return (
                      item.facultyName.toLowerCase().includes(q) ||
                      item.subjectName.toLowerCase().includes(q) ||
                      (item.subjectCode && item.subjectCode.toLowerCase().includes(q))
                    );
                  })
                  .map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 flex items-start gap-3 hover:bg-slate-50 transition-colors shadow-2xs"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-100 text-navy-900 font-bold text-sm shrink-0">
                        {item.facultyName.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-xs text-navy-900 truncate">
                            {item.facultyName}
                          </span>
                          {item.employeeCode && (
                            <span className="rounded bg-slate-200/80 px-1.5 py-0.5 text-[9px] font-semibold text-slate-700">
                              #{item.employeeCode}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-slate-800 mt-0.5 truncate">
                          {item.subjectName}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[10px]">
                          {item.subjectCode && (
                            <span className="rounded bg-indigo-100 px-2 py-0.5 font-bold text-indigo-800 border border-indigo-200">
                              {item.subjectCode}
                            </span>
                          )}
                          {item.sectionName && (
                            <span className="rounded bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800 border border-emerald-200">
                              Section {item.sectionName}
                            </span>
                          )}
                          {item.semester && (
                            <span className="rounded bg-sky-100 px-2 py-0.5 font-semibold text-sky-800 border border-sky-200">
                              Semester {item.semester}
                            </span>
                          )}
                          {item.batch && (
                            <span className="rounded bg-purple-100 px-2 py-0.5 font-semibold text-purple-800 border border-purple-200">
                              Batch {item.batch}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end border-t border-slate-200 bg-slate-50 px-6 py-3">
              <Button variant="secondary" size="sm" onClick={() => setIsViewMappedModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
