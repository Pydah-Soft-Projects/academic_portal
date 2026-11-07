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
  Eye,
  Copy,
  ExternalLink,
  Link as LinkIcon,
  Download,
} from "lucide-react";
import {
  downloadExcelWorkbook,
  type ExcelWorkbookOptions,
  type ExcelWorksheet,
  type ExcelRow,
  type ExcelCell,
} from "@/lib/excel-service";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ContentCardSkeleton } from "@/components/ui/CardSkeleton";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
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
  branchName?: string | null;
  branchCode?: string | null;
  courseId: number | null;
  courseName?: string | null;
  courseCode?: string | null;
  collegeId: number | null;
  collegeName?: string | null;
  collegeCode?: string | null;
  academicYear: string | null;
  batch: string | null;
  yearOfStudy?: number | null;
};

export type TargetAudienceScope = {
  batches?: string[];
  sections?: string[];
  yearsOfStudy?: number[];
};

export type FeedbackQuestion = {
  id?: number;
  formId?: number;
  questionText: string;
  questionType: "short_text" | "long_text" | "rating_scale" | "yes_no" | "multiple_choice";
  isRequired: boolean;
  orderIndex: number;
  minValue?: number | null;
  maxValue?: number | null;
  options: string[];
};

export type QuestionSummary = {
  questionId: number;
  questionText: string;
  questionType: string;
  shortLabel: string;
  abstract: string;
  avgScore?: number | null;
  ratingTier?: "excellent" | "good" | "average" | "poor" | "none";
  distribution?: Record<string, number>;
};

export type StudentResponseDetail = {
  id: number;
  studentName: string;
  tokenHash: string;
  submittedAt: string;
  branchName: string;
  semester: number;
  sectionName: string;
  subjectName: string;
  facultyName: string;
  answers: Record<string, unknown>;
  unitsCovered?: string | null;
  facultyRating?: number | null;
  unitStatus?: string | null;
};

export type SubjectSectionReportItem = {
  id: string;
  subjectId: number | null;
  subjectCode: string;
  subjectName: string;
  staffLinkId: number | null;
  facultyName: string;
  employeeCode: string | null;
  branchId: number | null;
  branchName: string;
  courseId: number | null;
  courseName: string;
  semester: number;
  romanSemester: string;
  yearOfStudy?: number;
  sectionName: string | null;
  count: number;
  questions: QuestionSummary[];
  studentDetails: StudentResponseDetail[];
};

export type SectionGroup = {
  groupKey: string;
  branchId: number | null;
  branchName: string;
  courseId: number | null;
  courseName: string;
  semester: number;
  romanSemester: string;
  yearOfStudy?: number;
  sectionName: string | null;
  sectionLabel: string;
  subjectCount: number;
  totalSubmissions: number;
  subjects: SubjectSectionReportItem[];
};

export type FacultyGroup = {
  facultyKey: string;
  facultyName: string;
  employeeCode: string | null;
  staffLinkId: number | null;
  totalSubjects: number;
  totalSubmissions: number;
  overallRating: number | null;
  subjects: Array<SubjectSectionReportItem & { classLabel: string }>;
};

export type StudentSubjectEvaluation = {
  subjectName: string;
  subjectCode?: string;
  facultyName: string;
  unitsCovered?: string | null;
  facultyRating?: number | null;
  unitStatus?: string | null;
  answers: Record<string, unknown>;
  submittedAt: string;
};

export type StudentReportItem = {
  id: string;
  studentPin: string;
  studentName: string;
  tokenHash?: string;
  collegeId?: number | null;
  courseId?: number | null;
  courseName: string;
  branchId?: number | null;
  branchName: string;
  yearOfStudy: number;
  semester: number;
  romanSemester: string;
  sectionName: string;
  status: "submitted" | "partial" | "pending";
  totalEvaluated: number;
  totalExpected?: number;
  lastSubmittedAt?: string | null;
  evaluations: StudentSubjectEvaluation[];
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
  publicationQuestions?: FeedbackQuestion[];
  sectionGroups?: SectionGroup[];
  facultyGroups?: FacultyGroup[];
  studentReports?: StudentReportItem[];
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
    studentName?: string;
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
  const str = String(dateStr).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    const [, year, month, day, strH, strM] = match;
    let hours = parseInt(strH, 10);
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${day}-${month}-${year} ${String(hours).padStart(2, "0")}:${strM} ${ampm}`;
  }
  const d = new Date(str);
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
  const str = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str)) {
    return str.slice(0, 16);
  }
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(str)) {
    return str.slice(0, 16).replace(" ", "T");
  }
  const d = new Date(str);
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


function shortenQuestionText(text: string): string {
  if (!text) return "Question";
  const trimmed = text.trim();
  if (trimmed.length <= 25) return trimmed;
  if (/smart\s*board/i.test(trimmed)) return "Smart Board";
  if (/rate\s*subject\s*faculty/i.test(trimmed)) return "Rate Faculty";
  if (/educational\s*applications.*useful/i.test(trimmed)) return "Digital Resources";
  if (/which.*feature.*frequently/i.test(trimmed)) return "Frequent Feature";
  if (/quality.*applications/i.test(trimmed)) return "Quality Rating";
  return trimmed.slice(0, 22) + "...";
}

function toSentenceCase(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  const normalized = trimmed.toLocaleLowerCase();
  return normalized.charAt(0).toLocaleUpperCase() + normalized.slice(1);
}

function renderAbstractBadge(qSum: QuestionSummary | undefined, count: number) {
  if (!qSum || count === 0 || qSum.abstract === "—") {
    return <span className="text-slate-400 font-medium text-xs">—</span>;
  }

  if (qSum.ratingTier === "excellent" || qSum.ratingTier === "good") {
    return (
      <span className="inline-flex items-center justify-center rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-1 text-xs font-semibold shadow-2xs">
        {qSum.abstract}
      </span>
    );
  }
  if (qSum.ratingTier === "average") {
    return (
      <span className="inline-flex items-center justify-center rounded-md bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 text-xs font-semibold shadow-2xs">
        {qSum.abstract}
      </span>
    );
  }
  if (qSum.ratingTier === "poor") {
    return (
      <span className="inline-flex items-center justify-center rounded-md bg-rose-100 text-rose-900 border border-rose-300 px-2.5 py-1 text-xs font-semibold shadow-2xs">
        {qSum.abstract}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center justify-center rounded-md bg-slate-100 text-slate-800 border border-slate-200 px-2.5 py-1 text-xs font-medium">
      {qSum.abstract}
    </span>
  );
}

export function FeedbackReportsView() {
  const { authorization } = useAuth();
  const [report, setReport] = useState<FeedbackReportData | null>(null);

  // Filter available branches and courses based on RBAC user scope
  const scopedAvailableBranches = useMemo(() => {
    if (!report?.availableBranches) return [];
    if (!authorization?.scope || authorization.scope.isGlobal) return report.availableBranches;
    const branchIds = authorization.scope.branchIds;
    if (branchIds && branchIds.length > 0) {
      return report.availableBranches.filter((b) => branchIds.includes(b.id));
    }
    return report.availableBranches;
  }, [report?.availableBranches, authorization]);

  const scopedAvailableCourses = useMemo(() => {
    if (!report?.availableCourses) return [];
    if (!authorization?.scope || authorization.scope.isGlobal) return report.availableCourses;
    const branchIds = authorization.scope.branchIds;
    if (branchIds && branchIds.length > 0) {
      const allowedCourseIds = new Set(scopedAvailableBranches.map((b) => b.courseId).filter(Boolean));
      return report.availableCourses.filter((c) => allowedCourseIds.has(c.id));
    }
    return report.availableCourses;
  }, [report?.availableCourses, authorization, scopedAvailableBranches]);


  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [selectedStaffKey, setSelectedStaffKey] = useState<string | null>(null);

  // Filters state
  const [selectedPublicationId, setSelectedPublicationId] = useState<number | undefined>(undefined);
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedSemester, setSelectedSemester] = useState<string>("all");
  const [selectedSection, setSelectedSection] = useState<string>("all");

  // Branches filtered by selected course
  const branchesForSelectedCourse = useMemo(() => {
    if (!scopedAvailableBranches.length) return [];
    if (selectedCourse === "all") return scopedAvailableBranches;
    const matchingCourse = scopedAvailableCourses.find(
      (c) => c.name.toLowerCase() === selectedCourse.toLowerCase() || String(c.id) === selectedCourse,
    );
    if (!matchingCourse) return scopedAvailableBranches;
    return scopedAvailableBranches.filter((b) => b.courseId === matchingCourse.id);
  }, [scopedAvailableBranches, scopedAvailableCourses, selectedCourse]);

  const availableSectionsForFilter = useMemo(() => {
    const set = new Set<string>();

    const groups = report?.sectionGroups || [];
    for (const g of groups) {
      if (selectedCourse !== "all") {
        const matchC = selectedCourse.toLowerCase();
        if (g.courseName?.toLowerCase() !== matchC && String(g.courseId) !== selectedCourse) continue;
      }
      if (selectedBranch !== "all") {
        const matchB = selectedBranch.toLowerCase();
        if (g.branchName?.toLowerCase() !== matchB && String(g.branchId) !== selectedBranch) continue;
      }
      if (selectedYear !== "all") {
        const yr = Number(selectedYear);
        if ((g.yearOfStudy || Math.ceil((g.semester || 1) / 2)) !== yr) continue;
      }
      if (selectedSemester !== "all") {
        const semNum = Number(selectedSemester);
        if (g.semester !== semNum) continue;
      }
      if (g.sectionName && g.sectionName.trim()) {
        set.add(g.sectionName.trim().toUpperCase());
      }
    }

    if (set.size === 0) {
      for (const g of groups) {
        if (g.sectionName && g.sectionName.trim()) set.add(g.sectionName.trim().toUpperCase());
      }
      if (report?.availableSections) {
        for (const s of report.availableSections) {
          if (s && s.trim()) set.add(s.trim().toUpperCase());
        }
      }
      if (report?.studentReports) {
        for (const s of report.studentReports) {
          if (s.sectionName && s.sectionName.trim()) set.add(s.sectionName.trim().toUpperCase());
        }
      }
    }

    if (set.size === 0) {
      return ["A", "B", "C"];
    }
    return Array.from(set).sort();
  }, [report?.sectionGroups, report?.availableSections, report?.studentReports, selectedCourse, selectedBranch, selectedYear, selectedSemester]);
  const [searchFaculty, setSearchFaculty] = useState<string>("");
  const [activeReportTab, setActiveReportTab] = useState<"section_wise" | "faculty_wise" | "student_wise">("section_wise");
  const [reportSearchQuery, setReportSearchQuery] = useState("");
  const [selectedStudentDetailsItem, setSelectedStudentDetailsItem] = useState<SubjectSectionReportItem | null>(null);
  const [selectedStudentReport, setSelectedStudentReport] = useState<StudentReportItem | null>(null);
  const [studentStatusFilter, setStudentStatusFilter] = useState<"all" | "submitted" | "partial" | "pending">("all");

  const filteredSectionGroups = useMemo(() => {
    if (!report?.sectionGroups) return [];
    let list = report.sectionGroups;

    if (selectedCourse !== "all") {
      const matchC = selectedCourse.toLowerCase();
      list = list.filter((g) => g.courseName?.toLowerCase() === matchC || String(g.courseId) === selectedCourse);
    }
    if (selectedBranch !== "all") {
      const matchB = selectedBranch.toLowerCase();
      list = list.filter((g) => g.branchName?.toLowerCase() === matchB || String(g.branchId) === selectedBranch);
    }
    if (selectedYear !== "all") {
      const yr = Number(selectedYear);
      list = list.filter((g) => (g.yearOfStudy || Math.ceil((g.semester || 1) / 2)) === yr);
    }
    if (selectedSemester !== "all") {
      const semNum = Number(selectedSemester);
      list = list.filter((g) => g.semester === semNum);
    }
    if (selectedSection !== "all") {
      const secNorm = selectedSection.trim().toUpperCase();
      list = list.filter((g) => (g.sectionName || "").trim().toUpperCase() === secNorm);
    }

    if (!reportSearchQuery.trim()) return list;
    const term = reportSearchQuery.toLowerCase();
    return list
      .map((g) => {
        const groupMatches = g.sectionLabel.toLowerCase().includes(term);
        const matchingSubjects = g.subjects.filter(
          (s) =>
            s.subjectCode.toLowerCase().includes(term) ||
            s.subjectName.toLowerCase().includes(term) ||
            s.facultyName.toLowerCase().includes(term) ||
            (s.employeeCode && s.employeeCode.toLowerCase().includes(term)),
        );
        if (groupMatches) return g;
        if (matchingSubjects.length > 0) {
          return {
            ...g,
            subjectCount: matchingSubjects.length,
            subjects: matchingSubjects,
          };
        }
        return null;
      })
      .filter((g): g is SectionGroup => g !== null);
  }, [report?.sectionGroups, selectedCourse, selectedBranch, selectedYear, selectedSemester, selectedSection, reportSearchQuery]);

  const filteredFacultyGroups = useMemo(() => {
    if (!report?.facultyGroups) return [];
    let list = report.facultyGroups;

    if (selectedCourse !== "all") {
      const matchC = selectedCourse.toLowerCase();
      list = list.map((f) => {
        const matchingSubs = f.subjects.filter(
          (s) => s.courseName?.toLowerCase() === matchC || String(s.courseId) === selectedCourse
        );
        if (matchingSubs.length === 0) return null;
        return {
          ...f,
          totalSubjects: matchingSubs.length,
          subjects: matchingSubs,
        };
      }).filter((f): f is FacultyGroup => f !== null);
    }
    if (selectedBranch !== "all") {
      const matchB = selectedBranch.toLowerCase();
      list = list.map((f) => {
        const matchingSubs = f.subjects.filter(
          (s) => s.branchName?.toLowerCase() === matchB || String(s.branchId) === selectedBranch
        );
        if (matchingSubs.length === 0) return null;
        return {
          ...f,
          totalSubjects: matchingSubs.length,
          subjects: matchingSubs,
        };
      }).filter((f): f is FacultyGroup => f !== null);
    }
    if (selectedYear !== "all") {
      const yr = Number(selectedYear);
      list = list.map((f) => {
        const matchingSubs = f.subjects.filter((s) => (s.yearOfStudy || Math.ceil((s.semester || 1) / 2)) === yr);
        if (matchingSubs.length === 0) return null;
        return {
          ...f,
          totalSubjects: matchingSubs.length,
          subjects: matchingSubs,
        };
      }).filter((f): f is FacultyGroup => f !== null);
    }
    if (selectedSemester !== "all") {
      const semNum = Number(selectedSemester);
      list = list.map((f) => {
        const matchingSubs = f.subjects.filter((s) => s.semester === semNum);
        if (matchingSubs.length === 0) return null;
        return {
          ...f,
          totalSubjects: matchingSubs.length,
          subjects: matchingSubs,
        };
      }).filter((f): f is FacultyGroup => f !== null);
    }
    if (selectedSection !== "all") {
      const secNorm = selectedSection.trim().toUpperCase();
      list = list.map((f) => {
        const matchingSubs = f.subjects.filter(
          (s) => (s.sectionName || "").trim().toUpperCase() === secNorm
        );
        if (matchingSubs.length === 0) return null;
        return {
          ...f,
          totalSubjects: matchingSubs.length,
          subjects: matchingSubs,
        };
      }).filter((f): f is FacultyGroup => f !== null);
    }

    if (!reportSearchQuery.trim()) return list;
    const term = reportSearchQuery.toLowerCase();
    return list
      .map((f) => {
        const facMatches =
          f.facultyName.toLowerCase().includes(term) ||
          (f.employeeCode && f.employeeCode.toLowerCase().includes(term));
        const matchingSubjects = f.subjects.filter(
          (s) =>
            s.subjectCode.toLowerCase().includes(term) ||
            s.subjectName.toLowerCase().includes(term) ||
            (s.classLabel && s.classLabel.toLowerCase().includes(term)),
        );
        if (facMatches) return f;
        if (matchingSubjects.length > 0) {
          return {
            ...f,
            totalSubjects: matchingSubjects.length,
            subjects: matchingSubjects,
          };
        }
        return null;
      })
      .filter((f): f is FacultyGroup => f !== null);
  }, [report?.facultyGroups, selectedCourse, selectedBranch, selectedYear, selectedSemester, selectedSection, reportSearchQuery]);

  const filteredStudentReports = useMemo(() => {
    if (!report?.studentReports) return [];
    let list = report.studentReports;

    if (selectedCourse !== "all") {
      const matchC = selectedCourse.toLowerCase();
      list = list.filter((s) => s.courseName?.toLowerCase() === matchC || String(s.courseId) === selectedCourse);
    }
    if (selectedBranch !== "all") {
      const matchB = selectedBranch.toLowerCase();
      list = list.filter((s) => s.branchName?.toLowerCase() === matchB || String(s.branchId) === selectedBranch);
    }
    if (selectedYear !== "all") {
      const yr = Number(selectedYear);
      list = list.filter((s) => (s.yearOfStudy || Math.ceil((s.semester || 1) / 2)) === yr);
    }
    if (selectedSemester !== "all") {
      const semNum = Number(selectedSemester);
      list = list.filter((s) => s.semester === semNum);
    }
    if (selectedSection !== "all") {
      const secNorm = selectedSection.trim().toUpperCase();
      list = list.filter((s) => (s.sectionName || "").trim().toUpperCase() === secNorm);
    }

    if (studentStatusFilter !== "all") {
      list = list.filter((s) => s.status === studentStatusFilter);
    }

    if (!reportSearchQuery.trim()) return list;
    const term = reportSearchQuery.toLowerCase();
    return list.filter((s) =>
      s.studentName.toLowerCase().includes(term) ||
      s.studentPin.toLowerCase().includes(term) ||
      s.branchName.toLowerCase().includes(term) ||
      s.sectionName.toLowerCase().includes(term) ||
      s.evaluations.some(
        (ev) =>
          ev.subjectName.toLowerCase().includes(term) ||
          ev.facultyName.toLowerCase().includes(term),
      ),
    );
  }, [report?.studentReports, selectedCourse, selectedBranch, selectedYear, selectedSemester, selectedSection, studentStatusFilter, reportSearchQuery]);

  const studentStats = useMemo(() => {
    const list = report?.studentReports || [];
    let scoped = list;
    if (selectedCourse !== "all") {
      const matchC = selectedCourse.toLowerCase();
      scoped = scoped.filter((s) => s.courseName?.toLowerCase() === matchC || String(s.courseId) === selectedCourse);
    }
    if (selectedBranch !== "all") {
      const matchB = selectedBranch.toLowerCase();
      scoped = scoped.filter((s) => s.branchName?.toLowerCase() === matchB || String(s.branchId) === selectedBranch);
    }
    if (selectedYear !== "all") {
      const yr = Number(selectedYear);
      scoped = scoped.filter((s) => (s.yearOfStudy || Math.ceil((s.semester || 1) / 2)) === yr);
    }
    if (selectedSemester !== "all") {
      const semNum = Number(selectedSemester);
      scoped = scoped.filter((s) => s.semester === semNum);
    }
    if (selectedSection !== "all") {
      const secNorm = selectedSection.trim().toUpperCase();
      scoped = scoped.filter((s) => (s.sectionName || "").trim().toUpperCase() === secNorm);
    }

    const total = scoped.length;
    const submitted = scoped.filter((s) => s.status === "submitted").length;
    const partial = scoped.filter((s) => s.status === "partial").length;
    const pending = scoped.filter((s) => s.status === "pending").length;
    const rate = total > 0 ? Math.round(((submitted + partial) / total) * 100) : 0;
    return { total, submitted, partial, pending, rate };
  }, [report?.studentReports, selectedCourse, selectedBranch, selectedYear, selectedSemester, selectedSection]);

  const questionsToDisplay = useMemo(() => {
    if (report?.publicationQuestions && report.publicationQuestions.length > 0) {
      return report.publicationQuestions.map((q) => ({
        id: q.id ?? 0,
        questionText: q.questionText,
        shortLabel: q.questionText,
      }));
    }
    // Fallback if no questions configured
    return [
      { id: 1, questionText: "Units Covered", shortLabel: "Units Covered" },
      { id: 2, questionText: "Rate Subject Faculty", shortLabel: "Rate Faculty" },
      { id: 3, questionText: "Unit Status", shortLabel: "Unit Status" },
    ];
  }, [report?.publicationQuestions]);

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
  const [editingPublication, setEditingPublication] = useState<FeedbackPublication | null>(null);
  const [isManageSessionsModalOpen, setIsManageSessionsModalOpen] = useState(false);

  // Download Reports Modal state
  const [isDownloadReportsModalOpen, setIsDownloadReportsModalOpen] = useState(false);
  const [downloadScope, setDownloadScope] = useState<"master" | "college" | "course" | "branch" | "all_faculty" | "individual_faculty">("master");
  const [downloadFormat, setDownloadFormat] = useState<"excel" | "csv">("excel");
  const [selectedDownloadCollegeId, setSelectedDownloadCollegeId] = useState<number | "all">("all");
  const [selectedDownloadCourseId, setSelectedDownloadCourseId] = useState<number | "all">("all");
  const [selectedDownloadBranch, setSelectedDownloadBranch] = useState<string>("all");
  const [selectedDownloadYear, setSelectedDownloadYear] = useState<string>("all");
  const [selectedDownloadSemester, setSelectedDownloadSemester] = useState<string>("all");
  const [selectedDownloadSection, setSelectedDownloadSection] = useState<string>("all");
  const [selectedDownloadFaculty, setSelectedDownloadFaculty] = useState<string>("all");
  const [selectedDownloadFacultyName, setSelectedDownloadFacultyName] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [updatingDates, setUpdatingDates] = useState(false);
  const [editDatesError, setEditDatesError] = useState<string | null>(null);

  // Post-Publish Success Popup Modal State (with direct SDMS student redirection link)
  const [publishedSuccessPub, setPublishedSuccessPub] = useState<FeedbackPublication | null>(null);
  const [isPublishSuccessOpen, setIsPublishSuccessOpen] = useState(false);
  const [hasCopiedSdmsLink, setHasCopiedSdmsLink] = useState(false);

  // Helper to generate direct SDMS Student Feedback portal link
  const getSdmsFeedbackUrl = (pubId?: number) => {
    const rawUrl = process.env.NEXT_PUBLIC_SDMS_URL?.trim();
    const base = rawUrl || (typeof window !== "undefined" && window.location.hostname === "localhost" ? "http://localhost:3000" : "https://sdms.pydah.edu.in");
    return `${base.replace(/\/$/, "")}/student/feedback${pubId ? `?notificationId=${pubId}` : ""}`;
  };

  // Detect currently active publications
  const activeExistingPubs = useMemo(() => {
    if (!report?.publications) return [];
    return report.publications.filter((p) => p.status === "active" || p.isActive);
  }, [report?.publications]);

  // Currently selected publication object from publications list
  const selectedPubObject = useMemo(() => {
    if (!report?.publications) return report?.publication || null;
    return report.publications.find((p) => p.id === selectedPublicationId) || report.publication || (report.publications.length > 0 ? report.publications[0] : null);
  }, [report?.publications, report?.publication, selectedPublicationId]);

  const printAreaRef = useRef<HTMLDivElement>(null);

  // Filter courses based on selected colleges
  const relevantCourses = useMemo(() => {
    if (!scopedAvailableCourses.length) return [];
    if (selectedCollegeIds.length === 0) return scopedAvailableCourses;
    return scopedAvailableCourses.filter((c) => selectedCollegeIds.includes(c.collegeId));
  }, [scopedAvailableCourses, selectedCollegeIds]);

  // Filter branches based on selected courses and colleges
  const relevantBranches = useMemo(() => {
    if (!scopedAvailableBranches.length) return [];
    if (selectedCourseIds.length > 0) {
      return scopedAvailableBranches.filter((b) => b.courseId && selectedCourseIds.includes(b.courseId));
    }
    if (selectedCollegeIds.length > 0) {
      const allowedCourseIds = new Set(relevantCourses.map((c) => c.id));
      return scopedAvailableBranches.filter((b) => b.courseId && allowedCourseIds.has(b.courseId));
    }
    return scopedAvailableBranches;
  }, [scopedAvailableBranches, selectedCourseIds, selectedCollegeIds, relevantCourses]);

  // Courses available for download filter (scoped by selected college if any)
  const coursesForDownload = useMemo(() => {
    if (!scopedAvailableCourses.length) return [];
    if (selectedDownloadCollegeId === "all") return scopedAvailableCourses;
    return scopedAvailableCourses.filter((c) => c.collegeId === selectedDownloadCollegeId);
  }, [scopedAvailableCourses, selectedDownloadCollegeId]);

  // Branches available for download filter (scoped by selected course if any)
  const branchesForDownload = useMemo(() => {
    if (!scopedAvailableBranches.length) return [];
    if (selectedDownloadCourseId !== "all") {
      return scopedAvailableBranches.filter((b) => b.courseId === selectedDownloadCourseId);
    }
    if (selectedDownloadCollegeId !== "all") {
      const allowedCourseIds = new Set(coursesForDownload.map((c) => c.id));
      return scopedAvailableBranches.filter((b) => b.courseId && allowedCourseIds.has(b.courseId));
    }
    return scopedAvailableBranches;
  }, [scopedAvailableBranches, selectedDownloadCourseId, selectedDownloadCollegeId, coursesForDownload]);

  // Load report data
  const fetchReport = async (pubId?: number, course?: string, branch?: string, semester?: string) => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (pubId && pubId > 0) queryParams.set("publicationId", String(pubId));
      if (course && course !== "all") queryParams.set("course", course);
      if (branch && branch !== "all") queryParams.set("branch", branch);
      if (semester && semester !== "all") queryParams.set("semester", semester);
      queryParams.set("_t", String(Date.now()));

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
    void fetchReport(selectedPublicationId, selectedCourse, selectedBranch, selectedSemester);
  }, [selectedPublicationId, selectedCourse, selectedBranch, selectedSemester]);

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
    return `${item.staffLinkId ?? item.facultyName}__${item.subjectId ?? item.subjectCode ?? item.subjectName}__${item.branchId ?? item.branchName ?? "all"}__${item.sectionName ?? "all"}__${item.semester ?? "all"}__${item.batch ?? "all"}`;
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
        (s.branchName && s.branchName.toLowerCase().includes(q)) ||
        (s.branchCode && s.branchCode.toLowerCase().includes(q)) ||
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
      setPublishedSuccessPub(createdPub);
      setIsPublishSuccessOpen(true);
      setHasCopiedSdmsLink(false);
      setActionNotice(`Feedback form "${createdPub.title}" has been published successfully!`);
      setSelectedPublicationId(createdPub.id);
      await fetchReport(createdPub.id, "all", "all", "all");
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : "Error publishing feedback form");
    } finally {
      setPublishing(false);
    }
  };

  const openEditDatesModal = (pub?: FeedbackPublication) => {
    const target = pub || selectedPubObject || activePublication || report?.publication || null;
    if (!target) return;
    setEditingPublication(target);
    setEditDatesError(null);
    setEditTitle(target.title);
    setEditStartDate(toInputDateTime(target.startDate));
    setEditEndDate(toInputDateTime(target.endDate));
    setEditIsActive(target.isActive);
    setIsEditDatesOpen(true);
  };

  const handleUpdateDatesSubmit = async () => {
    const target = editingPublication || selectedPubObject || activePublication || report?.publication;
    if (!target) {
      setEditDatesError("No publication selected to update.");
      return;
    }
    setEditDatesError(null);
    if (!editTitle.trim()) {
      setEditDatesError("Session title cannot be empty.");
      return;
    }
    if (!editStartDate || !editEndDate) {
      setEditDatesError("Both Start Date & Time and End Date & Time are required.");
      return;
    }

    const startMs = new Date(editStartDate).getTime();
    const endMs = new Date(editEndDate).getTime();
    if (isNaN(startMs) || isNaN(endMs)) {
      setEditDatesError("Please provide valid dates.");
      return;
    }
    if (endMs <= startMs) {
      setEditDatesError("End Date & Time (Deadline) must be strictly after Start Date & Time.");
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

      const res = await apiFetch(`/settings/feedback-publications/${target.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to update publication");
      }

      setIsEditDatesOpen(false);
      setActionNotice(`Feedback session "${payload.title}" schedule updated successfully!`);
      setSelectedPublicationId(target.id);
      await fetchReport(target.id, selectedCourse, selectedBranch, selectedSemester);
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
      await fetchReport(undefined, "all", "all", "all");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete publication");
    }
  };

  /* ───────────────────────────────────────────────────────────────────────── */
  /* REPORTS DOWNLOAD ENGINE (COLLEGE, COURSE, BRANCH, INDIVIDUAL FACULTY)     */
  /* ───────────────────────────────────────────────────────────────────────── */

  const downloadCsvFile = (filename: string, headers: string[], rows: (string | number | null | undefined)[][]) => {
    const csvRows = [
      headers.map((h) => `"${String(h ?? "").replace(/"/g, '""')}"`).join(","),
      ...rows.map((row) =>
        row.map((val) => `"${String(val ?? "").replace(/"/g, '""')}"`).join(",")
      ),
    ];
    const csvContent = "\uFEFF" + csvRows.join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const buildCollegeWiseData = (filterCollegeId?: number | "all") => {
    if (!report) return { headers: [], rows: [], excelRows: [] };
    const colleges = (report.availableColleges || []).filter(
      (c) => filterCollegeId === "all" || !filterCollegeId || c.id === filterCollegeId
    );

    const headers = [
      "S.No",
      "College Name",
      "College Code",
      "Courses Evaluated",
      "Branches Evaluated",
      "Allocated Faculty-Subjects",
      "Total Student Responses",
      "Average Rating (★ / 5.00)",
      "Rating Satisfaction %",
      "Average Units Covered",
      "Evaluation Status",
    ];

    const rows: (string | number)[][] = [];
    const excelRows: ExcelRow[] = [
      {
        cells: headers.map((h) => ({ value: h, styleId: "ColHeaderNavy" })),
      },
    ];

    colleges.forEach((col, idx) => {
      const colCourses = (report.availableCourses || []).filter((cr) => cr.collegeId === col.id);
      const colCourseIds = new Set(colCourses.map((cr) => cr.id));
      const colBranches = (report.availableBranches || []).filter((b) => b.courseId && colCourseIds.has(b.courseId));
      const colBranchNames = new Set(colBranches.map((b) => b.name.toUpperCase()));

      const matchedSections = (report.sectionGroups || []).filter(
        (sg) =>
          colBranchNames.has(sg.branchName.toUpperCase()) ||
          colCourses.some((cr) => cr.name.toUpperCase() === sg.courseName.toUpperCase())
      );

      const matchedFacultySubs = (report.submissionProgress || []).filter((sp) =>
        sp.sections.some((sec) => sec.branchName && colBranchNames.has(sec.branchName.toUpperCase()))
      );

      const totalSubmissions = matchedSections.reduce((acc, sg) => acc + (sg.totalSubmissions || 0), 0);
      const totalAllocations =
        matchedFacultySubs.length || matchedSections.reduce((acc, sg) => acc + (sg.subjectCount || 0), 0);

      const ratings = matchedFacultySubs
        .map((sp) => sp.averageRating)
        .filter((r): r is number => r != null && r > 0);
      const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

      const units = matchedFacultySubs
        .map((sp) => sp.averageUnitsCovered)
        .filter((u): u is number => u != null && u > 0);
      const avgUnits = units.length > 0 ? units.reduce((a, b) => a + b, 0) / units.length : null;

      const satPct = avgRating ? Math.round((avgRating / 5) * 100) : null;
      const status =
        totalSubmissions > 0 ? (avgRating && avgRating >= 4 ? "Excellent" : "Active") : "No Responses";

      const rowData = [
        idx + 1,
        col.name,
        col.code || "—",
        colCourses.length,
        colBranches.length,
        totalAllocations,
        totalSubmissions,
        avgRating != null ? avgRating.toFixed(2) : "—",
        satPct != null ? `${satPct}%` : "—",
        avgUnits != null ? avgUnits.toFixed(2) : "—",
        status,
      ];
      rows.push(rowData);

      excelRows.push({
        cells: [
          { value: idx + 1, styleId: "CellCenter" },
          { value: col.name, styleId: "CellNormal" },
          { value: col.code || "—", styleId: "CellCenter" },
          { value: colCourses.length, styleId: "CellCenter" },
          { value: colBranches.length, styleId: "CellCenter" },
          { value: totalAllocations, styleId: "CellCenter" },
          { value: totalSubmissions, styleId: "CellBoldCenter" },
          { value: avgRating != null ? Number(avgRating.toFixed(2)) : "—", styleId: "CellCenter" },
          { value: satPct != null ? `${satPct}%` : "—", styleId: "CellCenter" },
          { value: avgUnits != null ? Number(avgUnits.toFixed(2)) : "—", styleId: "CellCenter" },
          { value: status, styleId: status === "Excellent" ? "CellPresent" : "CellNormal" },
        ],
      });
    });

    return { headers, rows, excelRows };
  };

  const buildCourseWiseData = (filterCourseId?: number | "all") => {
    if (!report) return { headers: [], rows: [], excelRows: [] };
    const courses = (report.availableCourses || []).filter(
      (c) => filterCourseId === "all" || !filterCourseId || c.id === filterCourseId
    );
    const collegeMap = new Map((report.availableColleges || []).map((col) => [col.id, col.name]));

    const headers = [
      "S.No",
      "Course Name",
      "Course Code",
      "College Name",
      "Branches in Course",
      "Allocated Subjects",
      "Total Student Responses",
      "Average Rating (★ / 5.00)",
      "Rating Satisfaction %",
      "Average Units Covered",
      "Status",
    ];

    const rows: (string | number)[][] = [];
    const excelRows: ExcelRow[] = [
      {
        cells: headers.map((h) => ({ value: h, styleId: "ColHeaderNavy" })),
      },
    ];

    courses.forEach((cr, idx) => {
      const colName = collegeMap.get(cr.collegeId) || "—";
      const crBranches = (report.availableBranches || []).filter((b) => b.courseId === cr.id);
      const crBranchNames = new Set(crBranches.map((b) => b.name.toUpperCase()));

      const matchedSections = (report.sectionGroups || []).filter(
        (sg) =>
          sg.courseName.toUpperCase() === cr.name.toUpperCase() ||
          crBranchNames.has(sg.branchName.toUpperCase())
      );

      const matchedProgress = (report.submissionProgress || []).filter((sp) =>
        sp.sections.some((sec) => sec.branchName && crBranchNames.has(sec.branchName.toUpperCase()))
      );

      const totalSubmissions = matchedSections.reduce((acc, sg) => acc + (sg.totalSubmissions || 0), 0);
      const totalAllocations =
        matchedProgress.length || matchedSections.reduce((acc, sg) => acc + (sg.subjectCount || 0), 0);

      const ratings = matchedProgress
        .map((sp) => sp.averageRating)
        .filter((r): r is number => r != null && r > 0);
      const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

      const units = matchedProgress
        .map((sp) => sp.averageUnitsCovered)
        .filter((u): u is number => u != null && u > 0);
      const avgUnits = units.length > 0 ? units.reduce((a, b) => a + b, 0) / units.length : null;

      const satPct = avgRating ? Math.round((avgRating / 5) * 100) : null;
      const status =
        totalSubmissions > 0 ? (avgRating && avgRating >= 4 ? "Excellent" : "Active") : "No Responses";

      const rowData = [
        idx + 1,
        cr.name,
        cr.code || "—",
        colName,
        crBranches.length,
        totalAllocations,
        totalSubmissions,
        avgRating != null ? avgRating.toFixed(2) : "—",
        satPct != null ? `${satPct}%` : "—",
        avgUnits != null ? avgUnits.toFixed(2) : "—",
        status,
      ];
      rows.push(rowData);

      excelRows.push({
        cells: [
          { value: idx + 1, styleId: "CellCenter" },
          { value: cr.name, styleId: "CellNormal" },
          { value: cr.code || "—", styleId: "CellCenter" },
          { value: colName, styleId: "CellNormal" },
          { value: crBranches.length, styleId: "CellCenter" },
          { value: totalAllocations, styleId: "CellCenter" },
          { value: totalSubmissions, styleId: "CellBoldCenter" },
          { value: avgRating != null ? Number(avgRating.toFixed(2)) : "—", styleId: "CellCenter" },
          { value: satPct != null ? `${satPct}%` : "—", styleId: "CellCenter" },
          { value: avgUnits != null ? Number(avgUnits.toFixed(2)) : "—", styleId: "CellCenter" },
          { value: status, styleId: status === "Excellent" ? "CellPresent" : "CellNormal" },
        ],
      });
    });

    return { headers, rows, excelRows };
  };

  const buildBranchWiseData = (filterBranch?: string) => {
    if (!report) return { headers: [], rows: [], excelRows: [] };
    const groups = (report.sectionGroups || []).filter(
      (sg) => !filterBranch || filterBranch === "all" || sg.branchName.toLowerCase() === filterBranch.toLowerCase()
    );

    const headers = [
      "S.No",
      "Branch / Department",
      "Course",
      "Semester / Year",
      "Section",
      "Subject",
      "Subject Code",
      "Faculty Instructor",
      "Evaluations Count",
      "Faculty Rating (★ / 5.00)",
      "Units Covered",
      "Unit Status",
    ];

    const rows: (string | number)[][] = [];
    const excelRows: ExcelRow[] = [
      {
        cells: headers.map((h) => ({ value: h, styleId: "ColHeaderEmerald" })),
      },
    ];

    let sNo = 1;
    groups.forEach((group) => {
      group.subjects.forEach((sub) => {
        const qRating = sub.questions?.find(
          (q) => q.questionType === "rating_scale" || q.questionText.toLowerCase().includes("rate")
        );
        const qUnits = sub.questions?.find(
          (q) => q.questionText.toLowerCase().includes("unit")
        );
        const qStatus = sub.questions?.find(
          (q) => q.questionText.toLowerCase().includes("status")
        );

        const ratingVal = qRating?.avgScore != null ? Number(qRating.avgScore).toFixed(2) : "—";
        const unitsVal = qUnits?.abstract || (qUnits?.avgScore != null ? String(qUnits.avgScore) : "—");
        const statusVal = qStatus?.abstract || "—";

        const rowData = [
          sNo++,
          group.branchName,
          group.courseName,
          group.romanSemester,
          group.sectionName ? `Sec ${group.sectionName}` : "All",
          sub.subjectName,
          sub.subjectCode || "—",
          sub.facultyName,
          sub.count,
          ratingVal,
          unitsVal,
          statusVal,
        ];
        rows.push(rowData);

        excelRows.push({
          cells: [
            { value: sNo - 1, styleId: "CellCenter" },
            { value: group.branchName, styleId: "CellNormal" },
            { value: group.courseName, styleId: "CellNormal" },
            { value: group.romanSemester, styleId: "CellCenter" },
            { value: group.sectionName ? `Sec ${group.sectionName}` : "All", styleId: "CellCenter" },
            { value: sub.subjectName, styleId: "CellNormal" },
            { value: sub.subjectCode || "—", styleId: "CellCenter" },
            { value: sub.facultyName, styleId: "CellNormal" },
            { value: sub.count, styleId: "CellBoldCenter" },
            { value: ratingVal !== "—" ? Number(ratingVal) : "—", styleId: "CellCenter" },
            { value: unitsVal, styleId: "CellCenter" },
            { value: statusVal, styleId: "CellCenter" },
          ],
        });
      });
    });

    return { headers, rows, excelRows };
  };

  const buildFacultyData = (targetFacultyName?: string) => {
    if (!report) return { headers: [], rows: [], excelRows: [], targetGroup: null };
    const facGroups = (report.facultyGroups || []).filter(
      (fg) =>
        !targetFacultyName ||
        targetFacultyName === "all" ||
        fg.facultyName.toLowerCase() === targetFacultyName.toLowerCase()
    );

    const headers = [
      "S.No",
      "Faculty Name",
      "Employee Code",
      "Subject Name",
      "Subject Code",
      "Course",
      "Branch",
      "Semester",
      "Section",
      "Evaluations Count",
      "Average Rating (★ / 5.00)",
      "Satisfaction %",
      "Units Covered",
      "Unit Status",
      "Status Badge",
    ];

    const rows: (string | number)[][] = [];
    const excelRows: ExcelRow[] = [
      {
        cells: headers.map((h) => ({ value: h, styleId: "ColHeaderNavy" })),
      },
    ];

    let sNo = 1;
    facGroups.forEach((fac) => {
      fac.subjects.forEach((sub) => {
        const qRating = sub.questions?.find(
          (q) => q.questionType === "rating_scale" || q.questionText.toLowerCase().includes("rate")
        );
        const qUnits = sub.questions?.find(
          (q) => q.questionText.toLowerCase().includes("unit")
        );
        const qStatus = sub.questions?.find(
          (q) => q.questionText.toLowerCase().includes("status")
        );

        const ratingNum = qRating?.avgScore != null ? Number(qRating.avgScore) : null;
        const ratingStr = ratingNum != null ? ratingNum.toFixed(2) : "—";
        const satPct = ratingNum != null ? `${Math.round((ratingNum / 5) * 100)}%` : "—";
        const unitsVal = qUnits?.abstract || (qUnits?.avgScore != null ? String(qUnits.avgScore) : "—");
        const statusVal = qStatus?.abstract || "—";
        const badge =
          ratingNum != null
            ? ratingNum >= 4.2
              ? "Excellent"
              : ratingNum >= 3.5
              ? "Good"
              : ratingNum >= 2.8
              ? "Satisfactory"
              : "Needs Attention"
            : "Pending";

        const rowData = [
          sNo++,
          fac.facultyName,
          fac.employeeCode || "—",
          sub.subjectName,
          sub.subjectCode || "—",
          sub.courseName,
          sub.branchName,
          sub.romanSemester,
          sub.sectionName ? `Sec ${sub.sectionName}` : "All",
          sub.count,
          ratingStr,
          satPct,
          unitsVal,
          statusVal,
          badge,
        ];
        rows.push(rowData);

        excelRows.push({
          cells: [
            { value: sNo - 1, styleId: "CellCenter" },
            { value: fac.facultyName, styleId: "CellNormal" },
            { value: fac.employeeCode || "—", styleId: "CellCenter" },
            { value: sub.subjectName, styleId: "CellNormal" },
            { value: sub.subjectCode || "—", styleId: "CellCenter" },
            { value: sub.courseName, styleId: "CellNormal" },
            { value: sub.branchName, styleId: "CellNormal" },
            { value: sub.romanSemester, styleId: "CellCenter" },
            { value: sub.sectionName ? `Sec ${sub.sectionName}` : "All", styleId: "CellCenter" },
            { value: sub.count, styleId: "CellBoldCenter" },
            { value: ratingNum != null ? Number(ratingNum.toFixed(2)) : "—", styleId: "CellCenter" },
            { value: satPct, styleId: "CellCenter" },
            { value: unitsVal, styleId: "CellCenter" },
            { value: statusVal, styleId: "CellCenter" },
            {
              value: badge,
              styleId:
                badge === "Excellent" || badge === "Good"
                  ? "CellPresent"
                  : badge === "Needs Attention"
                  ? "CellAbsent"
                  : "CellNormal",
            },
          ],
        });
      });
    });

    return { headers, rows, excelRows, targetGroup: facGroups[0] || null };
  };

  const scopedExportPreview = useMemo(() => {
    if (!report?.sectionGroups) return { matchedSubjects: 0, matchedSubmissions: 0, avgRating: null };
    let totalSubs = 0;
    let totalSubmissions = 0;
    let ratingSum = 0;
    let ratingCount = 0;

    const allowedCourseIdsForCollege = selectedDownloadCollegeId !== "all"
      ? new Set((report.availableCourses || []).filter((c) => c.collegeId === selectedDownloadCollegeId).map((c) => c.id))
      : null;

    const filteredGroups = report.sectionGroups.filter((g) => {
      if (allowedCourseIdsForCollege && g.courseId && !allowedCourseIdsForCollege.has(g.courseId)) return false;
      if (selectedDownloadCourseId !== "all" && g.courseId && g.courseId !== selectedDownloadCourseId) return false;
      if (selectedDownloadBranch !== "all" && g.branchName.toLowerCase() !== selectedDownloadBranch.toLowerCase()) return false;
      if (selectedDownloadYear !== "all") {
        const yr = Number(selectedDownloadYear);
        if ((g.yearOfStudy || Math.ceil((g.semester || 1) / 2)) !== yr) return false;
      }
      if (selectedDownloadSemester !== "all" && g.semester !== Number(selectedDownloadSemester)) return false;
      if (selectedDownloadSection !== "all" && (g.sectionName || "").toUpperCase() !== selectedDownloadSection.toUpperCase()) return false;
      return true;
    });

    filteredGroups.forEach((g) => {
      g.subjects.forEach((sub) => {
        if (selectedDownloadFaculty !== "all" && sub.facultyName.toLowerCase() !== selectedDownloadFaculty.toLowerCase()) return false;
        totalSubs++;
        totalSubmissions += sub.count || 0;
        const qRating = sub.questions?.find((q) => q.questionType === "rating_scale" || q.questionText.toLowerCase().includes("rate"));
        if (qRating?.avgScore != null) {
          ratingSum += Number(qRating.avgScore) * (sub.count || 1);
          ratingCount += sub.count || 1;
        }
      });
    });

    const avgRating = ratingCount > 0 ? (ratingSum / ratingCount).toFixed(2) : null;
    return { matchedSubjects: totalSubs, matchedSubmissions: totalSubmissions, avgRating };
  }, [
    report?.sectionGroups,
    selectedDownloadCollegeId,
    selectedDownloadCourseId,
    selectedDownloadBranch,
    selectedDownloadYear,
    selectedDownloadSemester,
    selectedDownloadSection,
    selectedDownloadFaculty,
  ]);

  const buildGlobalScopedReportData = () => {
    if (!report?.sectionGroups) return { headers: [], rows: [], excelRows: [], summary: { totalAllocations: 0, totalSubmissions: 0, weightedAvg: "—", collegeLabel: "", courseLabel: "", branchLabel: "", yearLabel: "", semLabel: "", secLabel: "", facultyLabel: "" } };

    const selectedCollegeObj = selectedDownloadCollegeId !== "all"
      ? (report.availableColleges || []).find((c) => c.id === selectedDownloadCollegeId)
      : null;
    const selectedCourseObj = selectedDownloadCourseId !== "all"
      ? (scopedAvailableCourses || report.availableCourses || []).find((c) => c.id === selectedDownloadCourseId)
      : null;

    const headers = [
      "S.No",
      "College",
      "Course",
      "Branch / Department",
      "Year of Study",
      "Semester",
      "Section",
      "Subject Code",
      "Subject Name",
      "Faculty Instructor",
      "Employee Code",
      "Evaluations Count",
      "Faculty Rating (★ / 5.00)",
      "Satisfaction %",
      "Units Covered",
      "Unit Status",
      "Performance",
    ];

    const rows: (string | number)[][] = [];
    const excelRows: ExcelRow[] = [
      {
        cells: headers.map((h) => ({ value: h, styleId: "ColHeaderEmerald" })),
      },
    ];

    let sNo = 1;
    let totalSubmissions = 0;
    let ratingSum = 0;
    let ratingCount = 0;

    const allowedCourseIdsForCollege = selectedDownloadCollegeId !== "all"
      ? new Set((report.availableCourses || []).filter((c) => c.collegeId === selectedDownloadCollegeId).map((c) => c.id))
      : null;

    const filteredGroups = report.sectionGroups.filter((g) => {
      if (allowedCourseIdsForCollege && g.courseId && !allowedCourseIdsForCollege.has(g.courseId)) return false;
      if (selectedDownloadCourseId !== "all" && g.courseId && g.courseId !== selectedDownloadCourseId) return false;
      if (selectedDownloadBranch !== "all" && g.branchName.toLowerCase() !== selectedDownloadBranch.toLowerCase()) return false;
      if (selectedDownloadYear !== "all") {
        const yr = Number(selectedDownloadYear);
        if ((g.yearOfStudy || Math.ceil((g.semester || 1) / 2)) !== yr) return false;
      }
      if (selectedDownloadSemester !== "all" && g.semester !== Number(selectedDownloadSemester)) return false;
      if (selectedDownloadSection !== "all" && (g.sectionName || "").toUpperCase() !== selectedDownloadSection.toUpperCase()) return false;
      return true;
    });

    filteredGroups.forEach((g) => {
      g.subjects.forEach((sub) => {
        if (selectedDownloadFaculty !== "all" && sub.facultyName.toLowerCase() !== selectedDownloadFaculty.toLowerCase()) return false;

        const qRating = sub.questions?.find(
          (q) => q.questionType === "rating_scale" || q.questionText.toLowerCase().includes("rate")
        );
        const qUnits = sub.questions?.find(
          (q) => q.questionText.toLowerCase().includes("unit")
        );
        const qStatus = sub.questions?.find(
          (q) => q.questionText.toLowerCase().includes("status")
        );

        const ratingNum = qRating?.avgScore != null ? Number(qRating.avgScore) : null;
        const ratingStr = ratingNum != null ? ratingNum.toFixed(2) : "—";
        const satPct = ratingNum != null ? `${Math.round((ratingNum / 5) * 100)}%` : "—";
        const unitsVal = qUnits?.abstract || (qUnits?.avgScore != null ? String(qUnits.avgScore) : "—");
        const statusVal = qStatus?.abstract || "—";

        const badge =
          ratingNum != null
            ? ratingNum >= 4.2
              ? "Excellent"
              : ratingNum >= 3.5
              ? "Good"
              : ratingNum >= 2.8
              ? "Satisfactory"
              : "Needs Attention"
            : "Pending";

        totalSubmissions += sub.count || 0;
        if (ratingNum != null) {
          ratingSum += ratingNum * (sub.count || 1);
          ratingCount += sub.count || 1;
        }

        const collegeName = selectedCollegeObj?.name || report.publication?.collegeName || "Pydah College";
        const courseName = g.courseName || sub.courseName || selectedCourseObj?.name || "Academic";
        const yrLabel = g.yearOfStudy ? `Year ${g.yearOfStudy}` : `Year ${Math.ceil((g.semester || 1) / 2)}`;
        const semLabel = g.romanSemester || `Sem ${g.semester}`;
        const secLabel = g.sectionName ? `Sec ${g.sectionName}` : "All";

        const rowData = [
          sNo++,
          collegeName,
          courseName,
          g.branchName,
          yrLabel,
          semLabel,
          secLabel,
          sub.subjectCode || "—",
          sub.subjectName,
          sub.facultyName,
          sub.employeeCode || "—",
          sub.count,
          ratingStr,
          satPct,
          unitsVal,
          statusVal,
          badge,
        ];
        rows.push(rowData);

        excelRows.push({
          cells: [
            { value: sNo - 1, styleId: "CellCenter" },
            { value: collegeName, styleId: "CellNormal" },
            { value: courseName, styleId: "CellNormal" },
            { value: g.branchName, styleId: "CellNormal" },
            { value: yrLabel, styleId: "CellCenter" },
            { value: semLabel, styleId: "CellCenter" },
            { value: secLabel, styleId: "CellCenter" },
            { value: sub.subjectCode || "—", styleId: "CellCenter" },
            { value: sub.subjectName, styleId: "CellNormal" },
            { value: sub.facultyName, styleId: "CellNormal" },
            { value: sub.employeeCode || "—", styleId: "CellCenter" },
            { value: sub.count, styleId: "CellBoldCenter" },
            { value: ratingNum != null ? Number(ratingNum.toFixed(2)) : "—", styleId: "CellCenter" },
            { value: satPct, styleId: "CellCenter" },
            { value: unitsVal, styleId: "CellCenter" },
            { value: statusVal, styleId: "CellCenter" },
            {
              value: badge,
              styleId:
                badge === "Excellent" || badge === "Good"
                  ? "CellPresent"
                  : badge === "Needs Attention"
                  ? "CellAbsent"
                  : "CellNormal",
            },
          ],
        });
      });
    });

    const weightedAvg = ratingCount > 0 ? (ratingSum / ratingCount).toFixed(2) : "—";
    return {
      headers,
      rows,
      excelRows,
      summary: {
        totalAllocations: rows.length,
        totalSubmissions,
        weightedAvg,
        collegeLabel: selectedCollegeObj ? `${selectedCollegeObj.name} (${selectedCollegeObj.code})` : "All Colleges",
        courseLabel: selectedCourseObj ? `${selectedCourseObj.name} (${selectedCourseObj.code})` : "All Courses",
        branchLabel: selectedDownloadBranch === "all" ? "All Branches" : selectedDownloadBranch,
        yearLabel: selectedDownloadYear === "all" ? "All Years" : `Year ${selectedDownloadYear}`,
        semLabel: selectedDownloadSemester === "all" ? "All Semesters" : `Semester ${selectedDownloadSemester}`,
        secLabel: selectedDownloadSection === "all" ? "All Sections" : `Section ${selectedDownloadSection}`,
        facultyLabel: selectedDownloadFaculty === "all" ? "All Faculty Members" : selectedDownloadFaculty,
      },
    };
  };

  const handleDownloadGlobalScopedReport = () => {
    setIsExporting(true);
    try {
      const data = buildGlobalScopedReportData();
      const dateStr = new Date().toISOString().slice(0, 10);
      const safeFac = selectedDownloadFaculty === "all" ? "" : `_${selectedDownloadFaculty.replace(/[^a-zA-Z0-9_\- ]/g, "").replace(/\s+/g, "_")}`;
      const safeBranch = selectedDownloadBranch === "all" ? "" : `_${selectedDownloadBranch.replace(/[^a-zA-Z0-9_\-]/g, "_")}`;
      const filename = `Academic_Feedback_Report${safeBranch}${safeFac}_${dateStr}`;

      if (downloadFormat === "csv") {
        downloadCsvFile(filename, data.headers, data.rows);
      } else {
        const sum = data.summary;
        const sheets: ExcelWorksheet[] = [
          {
            name: "Feedback Evaluation Report",
            columns: [
              { width: 8 },
              { width: 22 },
              { width: 20 },
              { width: 22 },
              { width: 14 },
              { width: 12 },
              { width: 10 },
              { width: 14 },
              { width: 28 },
              { width: 24 },
              { width: 14 },
              { width: 16 },
              { width: 16 },
              { width: 14 },
              { width: 14 },
              { width: 14 },
              { width: 16 },
            ],
            rows: [
              { cells: [{ value: "PYDAH EDUCATIONAL ACADEMY - ACADEMIC FEEDBACK REPORT", styleId: "Title", mergeAcross: 7 }] },
              { cells: [{ value: `Session: ${report?.publication?.title || "Academic Feedback"} • Academic Year: ${report?.publication?.academicYear || "—"}`, styleId: "Subtitle", mergeAcross: 7 }] },
              { cells: [{ value: `Generated on: ${new Date().toLocaleString()}`, styleId: "Subtitle", mergeAcross: 7 }] },
              { cells: [] },
              { cells: [{ value: "APPLIED FILTER PARAMETERS & SCOPE SUMMARY", styleId: "SectionHeader", mergeAcross: 7 }] },
              { cells: [{ value: "College Filter:", styleId: "CellBoldCenter" }, { value: sum.collegeLabel, styleId: "CellNormal" }, { value: "Course Filter:", styleId: "CellBoldCenter" }, { value: sum.courseLabel, styleId: "CellNormal" }] },
              { cells: [{ value: "Branch Filter:", styleId: "CellBoldCenter" }, { value: sum.branchLabel, styleId: "CellNormal" }, { value: "Year of Study:", styleId: "CellBoldCenter" }, { value: sum.yearLabel, styleId: "CellNormal" }] },
              { cells: [{ value: "Semester Filter:", styleId: "CellBoldCenter" }, { value: sum.semLabel, styleId: "CellNormal" }, { value: "Section Filter:", styleId: "CellBoldCenter" }, { value: sum.secLabel, styleId: "CellNormal" }] },
              { cells: [{ value: "Faculty Filter:", styleId: "CellBoldCenter" }, { value: sum.facultyLabel, styleId: "CellNormal" }, { value: "Allocations Matched:", styleId: "CellBoldCenter" }, { value: sum.totalAllocations, styleId: "CellNormal" }] },
              { cells: [{ value: "Total Student Evaluations:", styleId: "CellBoldCenter" }, { value: sum.totalSubmissions, styleId: "CellNormal" }, { value: "Overall Rating (★):", styleId: "CellBoldCenter" }, { value: `${sum.weightedAvg} / 5.00`, styleId: "CellNormal" }] },
              { cells: [] },
              ...data.excelRows,
            ],
          },
        ];

        downloadExcelWorkbook({ author: "Pydah Academic Portal", sheets }, `${filename}.xls`);
      }

      setIsDownloadReportsModalOpen(false);
      setActionNotice("Feedback report generated and downloaded successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error exporting report");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadMasterWorkbook = () => {
    if (!report) return;
    const pubTitle = report.publication?.title || "Academic_Feedback";
    const safeTitle = pubTitle.replace(/[^a-zA-Z0-9_\- ]/g, "").replace(/\s+/g, "_");
    const dateStr = new Date().toISOString().slice(0, 10);

    const colData = buildCollegeWiseData("all");
    const crData = buildCourseWiseData("all");
    const brData = buildBranchWiseData("all");
    const facData = buildFacultyData("all");

    const sheets: ExcelWorksheet[] = [
      {
        name: "Executive Summary",
        columns: [{ width: 25 }, { width: 45 }],
        rows: [
          { cells: [{ value: "PYDAH EDUCATIONAL ACADEMY - FEEDBACK SUMMARY", styleId: "Title", mergeAcross: 1 }] },
          { cells: [{ value: `Generated: ${new Date().toLocaleString()}`, styleId: "Subtitle", mergeAcross: 1 }] },
          { cells: [] },
          { cells: [{ value: "FEEDBACK SESSION DETAILS", styleId: "SectionHeader", mergeAcross: 1 }] },
          {
            cells: [
              { value: "Session Title:", styleId: "CellBoldCenter" },
              { value: report.publication?.title || "Academic Feedback", styleId: "CellNormal" },
            ],
          },
          {
            cells: [
              { value: "Form Template:", styleId: "CellBoldCenter" },
              { value: report.publication?.formName || "—", styleId: "CellNormal" },
            ],
          },
          {
            cells: [
              { value: "Academic Year:", styleId: "CellBoldCenter" },
              { value: report.publication?.academicYear || "—", styleId: "CellNormal" },
            ],
          },
          {
            cells: [
              { value: "Semester Scope:", styleId: "CellBoldCenter" },
              {
                value: report.publication?.semester ? `Sem ${report.publication.semester}` : "All Semesters",
                styleId: "CellNormal",
              },
            ],
          },
          {
            cells: [
              { value: "Activation Period:", styleId: "CellBoldCenter" },
              {
                value: `${formatDisplayDateTime(report.publication?.startDate || "")} to ${formatDisplayDateTime(
                  report.publication?.endDate || ""
                )}`,
                styleId: "CellNormal",
              },
            ],
          },
          {
            cells: [
              { value: "Session Status:", styleId: "CellBoldCenter" },
              { value: report.publication?.status?.toUpperCase() || "ACTIVE", styleId: "CellNormal" },
            ],
          },
          { cells: [] },
          { cells: [{ value: "CORE METRICS & PARTICIPATION", styleId: "SectionHeader", mergeAcross: 1 }] },
          {
            cells: [
              { value: "Total Student Evaluations:", styleId: "CellBoldCenter" },
              { value: report.stats.totalSubmissions, styleId: "CellNormal" },
            ],
          },
          {
            cells: [
              { value: "Overall Average Rating:", styleId: "CellBoldCenter" },
              {
                value: report.stats.averageRating ? `${report.stats.averageRating.toFixed(2)} / 5.00` : "—",
                styleId: "CellNormal",
              },
            ],
          },
          {
            cells: [
              { value: "Satisfaction Score:", styleId: "CellBoldCenter" },
              { value: report.stats.ratingSatisfactionPct ? `${report.stats.ratingSatisfactionPct}%` : "—", styleId: "CellNormal" },
            ],
          },
          {
            cells: [
              { value: "Average Units Completed:", styleId: "CellBoldCenter" },
              {
                value: report.stats.averageUnitsCovered ? `${report.stats.averageUnitsCovered.toFixed(2)} Units` : "—",
                styleId: "CellNormal",
              },
            ],
          },
        ],
      },
      {
        name: "College Summary",
        columns: [
          { width: 8 },
          { width: 30 },
          { width: 15 },
          { width: 14 },
          { width: 14 },
          { width: 16 },
          { width: 16 },
          { width: 16 },
          { width: 16 },
          { width: 16 },
          { width: 16 },
        ],
        rows: colData.excelRows,
      },
      {
        name: "Course Summary",
        columns: [
          { width: 8 },
          { width: 25 },
          { width: 14 },
          { width: 25 },
          { width: 14 },
          { width: 16 },
          { width: 16 },
          { width: 16 },
          { width: 16 },
          { width: 16 },
          { width: 16 },
        ],
        rows: crData.excelRows,
      },
      {
        name: "Branch Breakdown",
        columns: [
          { width: 8 },
          { width: 25 },
          { width: 18 },
          { width: 14 },
          { width: 10 },
          { width: 25 },
          { width: 14 },
          { width: 22 },
          { width: 12 },
          { width: 15 },
          { width: 14 },
          { width: 16 },
        ],
        rows: brData.excelRows,
      },
      {
        name: "Faculty Evaluations",
        columns: [
          { width: 8 },
          { width: 22 },
          { width: 14 },
          { width: 25 },
          { width: 14 },
          { width: 18 },
          { width: 22 },
          { width: 12 },
          { width: 10 },
          { width: 12 },
          { width: 14 },
          { width: 14 },
          { width: 14 },
          { width: 14 },
          { width: 16 },
        ],
        rows: facData.excelRows,
      },
    ];

    downloadExcelWorkbook(
      { author: "Pydah Academic Portal", sheets },
      `Feedback_Master_Workbook_${safeTitle}_${dateStr}.xls`
    );
  };

  const handleDownloadCollegeWiseReport = (format: "excel" | "csv" = "excel", collegeId: number | "all" = "all") => {
    const data = buildCollegeWiseData(collegeId);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `College_Wise_Feedback_Report_${dateStr}`;
    if (format === "csv") {
      downloadCsvFile(filename, data.headers, data.rows);
    } else {
      downloadExcelWorkbook(
        {
          author: "Pydah Academic Portal",
          sheets: [
            {
              name: "College Report",
              columns: [
                { width: 8 },
                { width: 30 },
                { width: 15 },
                { width: 15 },
                { width: 15 },
                { width: 18 },
                { width: 18 },
                { width: 18 },
                { width: 18 },
                { width: 18 },
                { width: 18 },
              ],
              rows: [
                { cells: [{ value: "COLLEGE-WISE FEEDBACK EVALUATION REPORT", styleId: "Title", mergeAcross: 5 }] },
                { cells: [{ value: `Generated: ${new Date().toLocaleString()}`, styleId: "Subtitle", mergeAcross: 5 }] },
                { cells: [] },
                ...data.excelRows,
              ],
            },
          ],
        },
        `${filename}.xls`
      );
    }
  };

  const handleDownloadCourseWiseReport = (format: "excel" | "csv" = "excel", courseId: number | "all" = "all") => {
    const data = buildCourseWiseData(courseId);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `Course_Wise_Feedback_Report_${dateStr}`;
    if (format === "csv") {
      downloadCsvFile(filename, data.headers, data.rows);
    } else {
      downloadExcelWorkbook(
        {
          author: "Pydah Academic Portal",
          sheets: [
            {
              name: "Course Report",
              columns: [
                { width: 8 },
                { width: 25 },
                { width: 14 },
                { width: 25 },
                { width: 15 },
                { width: 18 },
                { width: 18 },
                { width: 18 },
                { width: 18 },
                { width: 18 },
                { width: 18 },
              ],
              rows: [
                { cells: [{ value: "COURSE-WISE FEEDBACK EVALUATION REPORT", styleId: "Title", mergeAcross: 5 }] },
                { cells: [{ value: `Generated: ${new Date().toLocaleString()}`, styleId: "Subtitle", mergeAcross: 5 }] },
                { cells: [] },
                ...data.excelRows,
              ],
            },
          ],
        },
        `${filename}.xls`
      );
    }
  };

  const handleDownloadBranchWiseReport = (format: "excel" | "csv" = "excel", branchName: string = "all") => {
    const data = buildBranchWiseData(branchName);
    const dateStr = new Date().toISOString().slice(0, 10);
    const safeBranch = branchName === "all" ? "All_Branches" : branchName.replace(/[^a-zA-Z0-9_\-]/g, "_");
    const filename = `Branch_Wise_Feedback_Report_${safeBranch}_${dateStr}`;
    if (format === "csv") {
      downloadCsvFile(filename, data.headers, data.rows);
    } else {
      downloadExcelWorkbook(
        {
          author: "Pydah Academic Portal",
          sheets: [
            {
              name: "Branch Report",
              columns: [
                { width: 8 },
                { width: 25 },
                { width: 18 },
                { width: 15 },
                { width: 10 },
                { width: 25 },
                { width: 14 },
                { width: 22 },
                { width: 12 },
                { width: 15 },
                { width: 14 },
                { width: 16 },
              ],
              rows: [
                { cells: [{ value: `BRANCH FEEDBACK REPORT (${safeBranch.replace(/_/g, " ")})`, styleId: "Title", mergeAcross: 6 }] },
                { cells: [{ value: `Generated: ${new Date().toLocaleString()}`, styleId: "Subtitle", mergeAcross: 6 }] },
                { cells: [] },
                ...data.excelRows,
              ],
            },
          ],
        },
        `${filename}.xls`
      );
    }
  };

  const handleDownloadFacultyReport = (fac: FacultyGroup, format: "excel" | "csv" = "excel") => {
    const facData = buildFacultyData(fac.facultyName);
    const safeName = fac.facultyName.replace(/[^a-zA-Z0-9_\- ]/g, "").replace(/\s+/g, "_");
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `Faculty_Evaluation_${safeName}_${dateStr}`;

    if (format === "csv") {
      downloadCsvFile(filename, facData.headers, facData.rows);
      return;
    }

    const sheets: ExcelWorksheet[] = [
      {
        name: "Faculty Overview",
        columns: [{ width: 25 }, { width: 35 }],
        rows: [
          { cells: [{ value: `FACULTY FEEDBACK EVALUATION - ${fac.facultyName.toUpperCase()}`, styleId: "Title", mergeAcross: 1 }] },
          { cells: [{ value: `Session: ${report?.publication?.title || "Academic Feedback"} · ${report?.publication?.academicYear || ""}`, styleId: "Subtitle", mergeAcross: 1 }] },
          { cells: [] },
          { cells: [{ value: "FACULTY PROFILE & METRICS", styleId: "SectionHeader", mergeAcross: 1 }] },
          { cells: [{ value: "Faculty Name:", styleId: "CellBoldCenter" }, { value: fac.facultyName, styleId: "CellNormal" }] },
          { cells: [{ value: "Employee Code:", styleId: "CellBoldCenter" }, { value: fac.employeeCode || "—", styleId: "CellNormal" }] },
          { cells: [{ value: "Assigned Subjects Count:", styleId: "CellBoldCenter" }, { value: fac.totalSubjects, styleId: "CellNormal" }] },
          { cells: [{ value: "Total Student Evaluations:", styleId: "CellBoldCenter" }, { value: fac.totalSubmissions, styleId: "CellNormal" }] },
          {
            cells: [
              { value: "Overall Rating (★):", styleId: "CellBoldCenter" },
              { value: fac.overallRating != null ? `${fac.overallRating.toFixed(2)} / 5.00` : "No ratings", styleId: "CellNormal" },
            ],
          },
        ],
      },
      {
        name: "Subject Allocations",
        columns: [
          { width: 8 },
          { width: 22 },
          { width: 14 },
          { width: 25 },
          { width: 14 },
          { width: 18 },
          { width: 22 },
          { width: 12 },
          { width: 10 },
          { width: 12 },
          { width: 14 },
          { width: 14 },
          { width: 14 },
          { width: 14 },
          { width: 16 },
        ],
        rows: facData.excelRows,
      },
    ];

    downloadExcelWorkbook({ author: "Pydah Academic Portal", sheets }, `${filename}.xls`);
  };

  const handleDownloadSectionReport = (group: SectionGroup, format: "excel" | "csv" = "excel") => {
    const data = buildBranchWiseData(group.branchName);
    const safeBranch = group.branchName.replace(/[^a-zA-Z0-9_\-]/g, "_");
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `Section_Feedback_${safeBranch}_${group.romanSemester}_Sec${group.sectionName || "All"}_${dateStr}`;

    if (format === "csv") {
      downloadCsvFile(filename, data.headers, data.rows);
    } else {
      downloadExcelWorkbook(
        {
          author: "Pydah Academic Portal",
          sheets: [
            {
              name: "Section Feedback",
              columns: [
                { width: 8 },
                { width: 25 },
                { width: 18 },
                { width: 15 },
                { width: 10 },
                { width: 25 },
                { width: 14 },
                { width: 22 },
                { width: 12 },
                { width: 15 },
                { width: 14 },
                { width: 16 },
              ],
              rows: [
                { cells: [{ value: `FEEDBACK REPORT: ${group.branchName} (${group.romanSemester} - Sec ${group.sectionName || "All"})`, styleId: "Title", mergeAcross: 6 }] },
                { cells: [{ value: `Generated: ${new Date().toLocaleString()}`, styleId: "Subtitle", mergeAcross: 6 }] },
                { cells: [] },
                ...data.excelRows,
              ],
            },
          ],
        },
        `${filename}.xls`
      );
    }
  };

  const handleExecuteDownloadModal = () => {
    setIsExporting(true);
    try {
      if (downloadScope === "master") {
        handleDownloadMasterWorkbook();
      } else if (downloadScope === "college") {
        handleDownloadCollegeWiseReport(downloadFormat, selectedDownloadCollegeId);
      } else if (downloadScope === "course") {
        handleDownloadCourseWiseReport(downloadFormat, selectedDownloadCourseId);
      } else if (downloadScope === "branch") {
        handleDownloadBranchWiseReport(downloadFormat, selectedDownloadBranch);
      } else if (downloadScope === "all_faculty") {
        const facData = buildFacultyData("all");
        const dateStr = new Date().toISOString().slice(0, 10);
        const filename = `Faculty_Comprehensive_Feedback_${dateStr}`;
        if (downloadFormat === "csv") {
          downloadCsvFile(filename, facData.headers, facData.rows);
        } else {
          downloadExcelWorkbook(
            {
              author: "Pydah Academic Portal",
              sheets: [
                {
                  name: "Faculty Evaluations",
                  columns: [
                    { width: 8 },
                    { width: 22 },
                    { width: 14 },
                    { width: 25 },
                    { width: 14 },
                    { width: 18 },
                    { width: 22 },
                    { width: 12 },
                    { width: 10 },
                    { width: 12 },
                    { width: 14 },
                    { width: 14 },
                    { width: 14 },
                    { width: 14 },
                    { width: 16 },
                  ],
                  rows: facData.excelRows,
                },
              ],
            },
            `${filename}.xls`
          );
        }
      } else if (downloadScope === "individual_faculty") {
        const targetFac = (report?.facultyGroups || []).find(
          (f) => f.facultyName.toLowerCase() === selectedDownloadFacultyName.toLowerCase()
        );
        if (targetFac) {
          handleDownloadFacultyReport(targetFac, downloadFormat);
        } else {
          const facData = buildFacultyData(selectedDownloadFacultyName);
          const safeName = (selectedDownloadFacultyName || "Faculty").replace(/[^a-zA-Z0-9_\- ]/g, "").replace(/\s+/g, "_");
          const dateStr = new Date().toISOString().slice(0, 10);
          const filename = `Faculty_Evaluation_${safeName}_${dateStr}`;
          if (downloadFormat === "csv") {
            downloadCsvFile(filename, facData.headers, facData.rows);
          } else {
            downloadExcelWorkbook(
              {
                author: "Pydah Academic Portal",
                sheets: [
                  {
                    name: "Faculty Evaluation",
                    columns: [
                      { width: 8 },
                      { width: 22 },
                      { width: 14 },
                      { width: 25 },
                      { width: 14 },
                      { width: 18 },
                      { width: 22 },
                      { width: 12 },
                      { width: 10 },
                      { width: 12 },
                      { width: 14 },
                      { width: 14 },
                      { width: 14 },
                      { width: 14 },
                      { width: 16 },
                    ],
                    rows: facData.excelRows,
                  },
                ],
              },
              `${filename}.xls`
            );
          }
        }
      }
      setIsDownloadReportsModalOpen(false);
      setActionNotice("Report downloaded successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error exporting report");
    } finally {
      setIsExporting(false);
    }
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
            onClick={() => void fetchReport(selectedPublicationId, selectedCourse, selectedBranch, selectedSemester)}
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

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsDownloadReportsModalOpen(true)}
            disabled={loading || !report}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs border-emerald-600"
            title="Open global download dialog with filters for college, course, branch, year, semester, section, and faculty"
          >
            <Download className="h-3.5 w-3.5" />
            Global Download Reports
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
        <Card className="overflow-hidden border-navy-800 bg-navy-900 p-4 text-white shadow-md sm:p-4">
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-300">
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

              <h3 className="text-lg font-bold tracking-tight text-white">
                {activePublication.title}
              </h3>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[11px] text-slate-300">
                <div className="rounded-md bg-white/5 px-2 py-1">
                  <span className="text-slate-400">Target College: </span>
                  <span className="font-semibold text-white">
                    {activePublication.collegeName || "All Colleges"}
                  </span>
                </div>
                <div className="rounded-md bg-white/5 px-2 py-1">
                  <span className="text-slate-400">Courses: </span>
                  <span className="font-semibold text-white">
                    {activePublication.courseName || "All Courses"}
                  </span>
                </div>
                <div className="rounded-md bg-white/5 px-2 py-1">
                  <span className="text-slate-400">Branch: </span>
                  <span className="font-semibold text-white">
                    {activePublication.branchName || "All Branches"}
                  </span>
                </div>
                <div className="rounded-md bg-white/5 px-2 py-1">
                  <span className="text-slate-400">Academic Year: </span>
                  <span className="font-semibold text-white">
                    {activePublication.academicYear}
                  </span>
                </div>
                {activePublication.semester ? (
                  <div className="rounded-md bg-white/5 px-2 py-1">
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
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-stretch xl:items-center">
              <div className="min-w-[270px] rounded-xl border border-white/15 bg-white/5 p-3 text-xs">
                <div className="mb-2 flex items-center gap-2 font-semibold text-emerald-300">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Activation period</span>
                  <span className="ml-auto rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
                    Live in system
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-200">
                  <div>
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Starts</span>
                    <span className="font-semibold leading-tight text-white">
                      {formatDisplayDateTime(activePublication.startDate)}
                    </span>
                  </div>
                  <div>
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Ends</span>
                    <span className="font-semibold leading-tight text-white">
                      {formatDisplayDateTime(activePublication.endDate)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 sm:flex-col">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openEditDatesModal()}
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs flex items-center justify-center gap-1.5"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Edit Dates
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(getSdmsFeedbackUrl(activePublication.id));
                      setActionNotice(`Student link for "${activePublication.title}" copied!`);
                    } catch {
                      setError("Could not copy the student feedback link. Check clipboard permissions and try again.");
                    }
                  }}
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs flex items-center justify-center gap-1.5"
                  title="Copy student feedback link"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy Link
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
        <div className="overflow-x-auto pb-1">
          <div className="grid min-w-[1220px] grid-cols-[minmax(450px,2.1fr)_minmax(170px,1fr)_minmax(175px,1.05fr)_minmax(110px,.65fr)_minmax(130px,.8fr)_minmax(120px,.75fr)] items-end gap-3">
            {/* Published Session Selector */}
            <div className="min-w-0">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Published Feedback Session
              </label>
              <div className="flex items-center gap-1.5">
                <select
                  value={selectedPublicationId || ""}
                  onChange={(e) => setSelectedPublicationId(Number(e.target.value))}
                  className="h-9 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2.5 text-sm font-semibold text-navy-900 outline-none transition focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
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

                {selectedPubObject ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => openEditDatesModal(selectedPubObject)}
                    className="h-9 shrink-0 bg-slate-50 px-2 text-xs font-semibold text-navy-900 hover:bg-slate-100"
                    title={`Edit schedule & dates for "${selectedPubObject.title}"`}
                  >
                    <Calendar className="h-3.5 w-3.5 text-navy-600" />
                    <span>Edit Schedule</span>
                  </Button>
                ) : null}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsManageSessionsModalOpen(true)}
                  className="h-9 shrink-0 px-2 text-xs text-slate-600 hover:text-navy-900"
                  title="View and manage all feedback sessions"
                >
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span>All Sessions ({report?.publications?.length || 0})</span>
                </Button>
              </div>
            </div>

            {/* Course Filter */}
            <div className="min-w-0">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Course
              </label>
              <select
                value={selectedCourse}
                onChange={(e) => {
                  const nextCourse = e.target.value;
                  setSelectedCourse(nextCourse);
                  setSelectedBranch("all");
                }}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-800 outline-none transition focus:border-navy-500"
              >
                <option value="all">All Courses</option>
                {scopedAvailableCourses.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name} {c.code ? `(${c.code})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Branch Filter */}
            <div className="min-w-0">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Branch
              </label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-800 outline-none transition focus:border-navy-500"
              >
                <option value="all">All Branches</option>
                {branchesForSelectedCourse.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name} {b.code ? `(${b.code})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Year of Study Filter */}
            <div className="min-w-0">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Year
              </label>
              <select
                value={selectedYear}
                onChange={(e) => {
                  const yr = e.target.value;
                  setSelectedYear(yr);
                  if (yr !== "all" && selectedSemester !== "all") {
                    const yrNum = Number(yr);
                    const semNum = Number(selectedSemester);
                    if (Math.ceil(semNum / 2) !== yrNum) {
                      setSelectedSemester("all");
                    }
                  }
                }}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-800 outline-none transition focus:border-navy-500"
              >
                <option value="all">All Years</option>
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
              </select>
            </div>

            {/* Semester Filter */}
            <div className="min-w-0">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Semester
              </label>
              <select
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-800 outline-none transition focus:border-navy-500"
              >
                <option value="all">All Semesters</option>
                {(selectedYear === "all"
                  ? [1, 2, 3, 4, 5, 6, 7, 8]
                  : [(Number(selectedYear) - 1) * 2 + 1, (Number(selectedYear) - 1) * 2 + 2]
                ).map((sem) => (
                  <option key={sem} value={sem}>
                    Semester {sem}
                  </option>
                ))}
              </select>
            </div>

            {/* Section Filter */}
            <div className="min-w-0">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Section
              </label>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-800 outline-none transition focus:border-navy-500"
              >
                <option value="all">All Sections</option>
                {availableSectionsForFilter.map((sec) => (
                  <option key={sec} value={sec}>
                    Section {sec}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
          Showing reports for: <strong className="text-navy-900">{activePublication ? activePublication.title : "All"}</strong>
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
            {/* View Mode Switcher & Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white p-4 rounded-xl shadow-2xs">
              <div className="flex items-center gap-1.5 bg-slate-100/90 p-1.5 rounded-xl border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setActiveReportTab("section_wise")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    activeReportTab === "section_wise"
                      ? "bg-white text-navy-900 shadow-xs border border-slate-200/60"
                      : "text-slate-600 hover:text-navy-900"
                  )}
                >
                  <BookOpen className="h-4 w-4 text-blue-600" />
                  <span>Subject / Section Wise</span>
                  <span className="ml-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-extrabold text-blue-800">
                    {filteredSectionGroups.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveReportTab("faculty_wise")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    activeReportTab === "faculty_wise"
                      ? "bg-white text-navy-900 shadow-xs border border-slate-200/60"
                      : "text-slate-600 hover:text-navy-900"
                  )}
                >
                  <Users className="h-4 w-4 text-indigo-600" />
                  <span>Faculty Wise</span>
                  <span className="ml-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-extrabold text-indigo-800">
                    {filteredFacultyGroups.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveReportTab("student_wise")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    activeReportTab === "student_wise"
                      ? "bg-white text-navy-900 shadow-xs border border-slate-200/60"
                      : "text-slate-600 hover:text-navy-900"
                  )}
                >
                  <GraduationCap className="h-4 w-4 text-emerald-600" />
                  <span>Student Wise</span>
                  <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">
                    {filteredStudentReports.length}
                  </span>
                </button>
              </div>

              {/* Search Box */}
              <div className="relative flex-1 min-w-[240px] max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={
                    activeReportTab === "student_wise"
                      ? "Search student name, PIN, branch, section..."
                      : "Search subject, faculty, code, or section..."
                  }
                  value={reportSearchQuery}
                  onChange={(e) => setReportSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-8 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500 shadow-2xs"
                />
                {reportSearchQuery ? (
                  <button
                    type="button"
                    onClick={() => setReportSearchQuery("")}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            </div>

            {/* ═════════════════════════════════════════════════════════════════ */}
            {/* TAB 1: SUBJECT / SECTION WISE (IMAGE 2 STYLE)                    */}
            {/* ═════════════════════════════════════════════════════════════════ */}
            {activeReportTab === "section_wise" ? (
              <div className="space-y-6">
                {filteredSectionGroups.length === 0 ? (
                  <Card className="p-12 text-center text-slate-500 bg-white border-slate-200 shadow-xs">
                    <BookOpen className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-700">No class sections found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Try adjusting the department, semester, or search filter.
                    </p>
                  </Card>
                ) : (
                  filteredSectionGroups.map((group) => (
                    <div
                      key={group.groupKey}
                      className="overflow-hidden rounded-xl border border-slate-300 shadow-sm bg-white"
                    >
                      {/* Section Banner matching Image 2 */}
                      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 px-5 py-3 text-white flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white border border-white/25">
                              Course: {group.courseName}
                            </span>
                            <span className="rounded-full bg-blue-300/25 px-2.5 py-0.5 text-[10px] font-semibold text-blue-100 border border-blue-200/30">
                              Branch: {group.branchName}
                            </span>
                            <span className="rounded-full bg-amber-300/25 px-2.5 py-0.5 text-[10px] font-semibold text-amber-200 border border-amber-200/30">
                              Year {group.yearOfStudy || Math.ceil((group.semester || 1) / 2)}
                            </span>
                          </div>
                          <h3 className="text-sm sm:text-base font-bold tracking-wide">
                            {group.branchName} — {group.romanSemester} {group.sectionName ? `· Section ${group.sectionName}` : ""}
                          </h3>
                          <p className="text-xs text-blue-100 font-medium mt-0.5">
                            {group.subjectCount} subjects {group.totalSubmissions > 0 ? `· ${group.totalSubmissions} evaluations recorded` : "· 0 evaluations"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur-xs border border-white/20">
                            {group.courseName}
                          </span>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleDownloadSectionReport(group, "excel")}
                            className="h-7 text-xs bg-white/15 hover:bg-white/25 text-white border-white/25 flex items-center gap-1 font-semibold"
                            title={`Download evaluation report for ${group.branchName} ${group.romanSemester}`}
                          >
                            <Download className="h-3.5 w-3.5 text-blue-100" />
                            <span>Download Section</span>
                          </Button>
                        </div>
                      </div>

                      {/* Section Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-blue-600 text-white font-bold tracking-wide text-[11px] border-b border-blue-700">
                              <th className="py-2.5 px-4 min-w-[170px]">SUBJECT</th>
                              <th className="py-2.5 px-4 min-w-[150px]">STAFF</th>
                              <th className="py-2.5 px-3 text-center min-w-[70px]">COUNT</th>
                              {questionsToDisplay.map((q, idx) => (
                                <th
                                  key={q.id ?? idx}
                                  className="py-2.5 px-3 text-center min-w-[140px]"
                                  title={q.questionText}
                                >
                                  {toSentenceCase(q.shortLabel || shortenQuestionText(q.questionText))} (Q${idx + 1})
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {group.subjects.map((sub, sIdx) => (
                              <tr
                                key={sub.id || sIdx}
                                className="hover:bg-blue-50/40 transition-colors"
                              >
                                <td className="py-3 px-4">
                                  <span className="block font-bold text-navy-900 text-xs leading-snug">
                                    {sub.subjectName}
                                  </span>
                                  {sub.subjectCode ? (
                                    <span className="block text-[11px] text-slate-500 font-medium font-mono mt-0.5">
                                      {sub.subjectCode}
                                    </span>
                                  ) : null}
                                </td>
                                <td className="py-3 px-4 font-semibold text-slate-800">
                                  <span className="block">{sub.facultyName}</span>
                                  {sub.employeeCode ? (
                                    <span className="block text-[10px] text-slate-400 font-normal">
                                      Emp #{sub.employeeCode}
                                    </span>
                                  ) : null}
                                </td>
                                <td className="py-3 px-3 text-center font-bold text-slate-800">
                                  {sub.count}
                                </td>
                                {sub.questions.map((qSum, qIdx) => (
                                  <td key={qIdx} className="py-3 px-3 text-center">
                                    {renderAbstractBadge(qSum, sub.count)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : activeReportTab === "faculty_wise" ? (
              /* ═════════════════════════════════════════════════════════════════ */
              /* TAB 2: FACULTY WISE                                              */
              /* ═════════════════════════════════════════════════════════════════ */
              <div className="space-y-6">
                {filteredFacultyGroups.length === 0 ? (
                  <Card className="p-12 text-center text-slate-500 bg-white border-slate-200 shadow-xs">
                    <Users className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-700">No faculty members found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Try adjusting the department or search filter.
                    </p>
                  </Card>
                ) : (
                  filteredFacultyGroups.map((fac) => (
                    <div
                      key={fac.facultyKey}
                      className="overflow-hidden rounded-xl border border-slate-300 shadow-sm bg-white"
                    >
                      {/* Faculty Header Bar */}
                      <div className="bg-gradient-to-r from-slate-900 via-navy-900 to-indigo-950 px-5 py-3.5 text-white flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600/30 text-white font-extrabold text-sm border border-blue-400/40">
                            {fac.facultyName.charAt(0)}
                          </div>
                          <div>
                            <h3 className="text-base font-bold tracking-wide flex items-center gap-2">
                              <span>{fac.facultyName}</span>
                              {fac.employeeCode && (
                                <span className="rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-medium text-blue-200">
                                  Emp #{fac.employeeCode}
                                </span>
                              )}
                            </h3>
                            <p className="text-xs text-slate-300 font-medium mt-0.5">
                              {fac.totalSubjects} assigned subjects · {fac.totalSubmissions} evaluations received
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5">
                          {fac.overallRating != null ? (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400/20 border border-amber-300/40 px-3 py-1 text-xs font-bold text-amber-200">
                              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                              {fac.overallRating.toFixed(2)} Overall Rating
                            </span>
                          ) : (
                            <span className="rounded-lg bg-white/10 px-3 py-1 text-xs text-slate-300">
                              No ratings yet
                            </span>
                          )}
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleDownloadFacultyReport(fac, "excel")}
                            className="h-7 text-xs bg-white/15 hover:bg-white/25 text-white border-white/25 flex items-center gap-1 font-semibold"
                            title={`Download feedback evaluation report for ${fac.facultyName}`}
                          >
                            <Download className="h-3.5 w-3.5 text-blue-200" />
                            <span>Download Report</span>
                          </Button>
                        </div>
                      </div>

                      {/* Faculty Subjects Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-blue-600 text-white font-bold tracking-wide text-[11px] border-b border-blue-700">
                              <th className="py-2.5 px-4 min-w-[160px]">SUBJECT</th>
                              <th className="py-2.5 px-3 min-w-[100px]">COURSE</th>
                              <th className="py-2.5 px-4 min-w-[160px]">BRANCH & SECTION</th>
                              <th className="py-2.5 px-3 text-center min-w-[70px]">COUNT</th>
                              {questionsToDisplay.map((q, idx) => (
                                <th
                                  key={q.id ?? idx}
                                  className="py-2.5 px-3 text-center min-w-[140px]"
                                  title={q.questionText}
                                >
                                  {toSentenceCase(q.shortLabel || shortenQuestionText(q.questionText))} (Q${idx + 1})
                                </th>
                              ))}
                              <th className="py-2.5 px-3 text-center min-w-[130px]">STUDENT DETAILS</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {fac.subjects.map((sub, sIdx) => (
                              <tr
                                key={sub.id || sIdx}
                                className="hover:bg-blue-50/40 transition-colors"
                              >
                                <td className="py-3 px-4">
                                  <span className="block font-bold text-navy-900 text-xs leading-snug">
                                    {sub.subjectName}
                                  </span>
                                  {sub.subjectCode ? (
                                    <span className="block text-[11px] text-slate-500 font-medium font-mono mt-0.5">
                                      {sub.subjectCode}
                                    </span>
                                  ) : null}
                                </td>
                                <td className="py-3 px-3">
                                  <span className="inline-flex rounded-md bg-blue-50 text-blue-800 px-2.5 py-1 border border-blue-200 text-xs font-semibold">
                                    {sub.courseName || "Course"}
                                  </span>
                                </td>
                                <td className="py-3 px-4 font-semibold text-slate-800">
                                  <span className="block font-bold text-navy-900 text-xs">{sub.branchName}</span>
                                  <span className="block text-[11px] text-slate-500 font-normal">
                                    {sub.romanSemester} {sub.sectionName ? `· Section ${sub.sectionName}` : ""}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-center font-bold text-slate-800">
                                  {sub.count}
                                </td>
                                {sub.questions.map((qSum, qIdx) => (
                                  <td key={qIdx} className="py-3 px-3 text-center">
                                    {renderAbstractBadge(qSum, sub.count)}
                                  </td>
                                ))}
                                <td className="py-3 px-3 text-center">
                                  {sub.count > 0 ? (
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => setSelectedStudentDetailsItem(sub)}
                                      className="h-7 text-[11px] font-semibold text-navy-700 border-navy-300 hover:bg-navy-50 cursor-pointer"
                                    >
                                      View Details ({sub.count})
                                    </Button>
                                  ) : (
                                    <span className="text-slate-400 text-[11px] italic">No evaluations</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              /* ═════════════════════════════════════════════════════════════════ */
              /* TAB 3: STUDENT WISE                                              */
              /* ═════════════════════════════════════════════════════════════════ */
              <div className="space-y-6">
                {/* 1. Student Submission Summary KPIs */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider">Total Enrolled</span>
                      <GraduationCap className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="text-xl font-extrabold text-navy-900">{studentStats.total}</div>
                    <p className="text-[10px] text-slate-400 mt-0.5">Students in selected scope</p>
                  </div>

                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between text-emerald-700 mb-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider">Fully Submitted</span>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="text-xl font-extrabold text-emerald-800">{studentStats.submitted}</div>
                    <p className="text-[10px] text-emerald-600 mt-0.5">All subjects evaluated</p>
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between text-amber-700 mb-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider">Partial</span>
                      <Clock className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="text-xl font-extrabold text-amber-800">{studentStats.partial}</div>
                    <p className="text-[10px] text-amber-600 mt-0.5">Some subjects submitted</p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between text-slate-600 mb-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider">Pending</span>
                      <AlertCircle className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="text-xl font-extrabold text-slate-700">{studentStats.pending}</div>
                    <p className="text-[10px] text-slate-400 mt-0.5">No responses yet</p>
                  </div>

                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3.5 shadow-2xs col-span-2 sm:col-span-4 lg:col-span-1">
                    <div className="flex items-center justify-between text-indigo-700 mb-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider">Response Rate</span>
                      <TrendingUp className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div className="text-xl font-extrabold text-indigo-900">{studentStats.rate}%</div>
                    <p className="text-[10px] text-indigo-600 mt-0.5">{studentStats.submitted + studentStats.partial} of {studentStats.total} active</p>
                  </div>
                </div>

                {/* 2. Quick Filter Pills by Submission Status */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-600 mr-1">Filter Status:</span>
                    {(
                      [
                        { key: "all", label: "All Students", count: studentStats.total },
                        { key: "submitted", label: "Submitted", count: studentStats.submitted },
                        { key: "partial", label: "Partial", count: studentStats.partial },
                        { key: "pending", label: "Pending", count: studentStats.pending },
                      ] as const
                    ).map((filter) => (
                      <button
                        key={filter.key}
                        type="button"
                        onClick={() => setStudentStatusFilter(filter.key)}
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-semibold transition-all cursor-pointer",
                          studentStatusFilter === filter.key
                            ? "bg-navy-900 text-white shadow-xs"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-navy-900",
                        )}
                      >
                        {filter.label} ({filter.count})
                      </button>
                    ))}
                  </div>

                  <div className="text-xs text-slate-500">
                    Showing <strong className="text-slate-800">{filteredStudentReports.length}</strong> students
                  </div>
                </div>

                {/* 3. Students Table */}
                {filteredStudentReports.length === 0 ? (
                  <Card className="p-12 text-center text-slate-500 bg-white border-slate-200 shadow-xs">
                    <GraduationCap className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-700">No students found matching your filters</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Try adjusting the course, branch, year, semester, status, or search query.
                    </p>
                  </Card>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-300 shadow-sm bg-white">
                    <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 px-5 py-3 text-white flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm sm:text-base font-bold tracking-wide">
                          Student Submissions & Response Records
                        </h3>
                        <p className="text-xs text-emerald-100 font-medium mt-0.5">
                          Showing {filteredStudentReports.length} students · Click &ldquo;View Responses&rdquo; to inspect exact questions answered, ratings, and student remarks
                        </p>
                      </div>
                      <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white border border-white/20">
                        {filteredStudentReports.filter(s => s.totalEvaluated > 0).length} Active Responders
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                            <th className="py-2.5 px-3 w-10 text-center">#</th>
                            <th className="py-2.5 px-4 min-w-[180px]">STUDENT NAME & PIN</th>
                            <th className="py-2.5 px-3 min-w-[130px]">COURSE & BRANCH</th>
                            <th className="py-2.5 px-3 min-w-[110px] text-center">YEAR & SEM</th>
                            <th className="py-2.5 px-3 min-w-[90px] text-center">SECTION</th>
                            <th className="py-2.5 px-3 min-w-[120px] text-center">STATUS</th>
                            <th className="py-2.5 px-3 min-w-[130px] text-center">PROGRESS</th>
                            <th className="py-2.5 px-3 min-w-[130px]">LAST SUBMITTED</th>
                            <th className="py-2.5 px-4 min-w-[140px] text-center">ACTION</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {filteredStudentReports.map((st, idx) => (
                            <tr
                              key={st.id || idx}
                              className={cn(
                                "hover:bg-emerald-50/30 transition-colors",
                                st.status === "submitted" ? "bg-white" : st.status === "partial" ? "bg-amber-50/20" : "bg-white"
                              )}
                            >
                              <td className="py-3 px-3 text-center text-slate-400 font-semibold">
                                {idx + 1}
                              </td>
                              <td className="py-3 px-4">
                                <span className="block font-bold text-navy-900 text-xs">
                                  {st.studentName}
                                </span>
                                <span className="block font-mono text-[11px] text-slate-500">
                                  {st.studentPin}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <span className="inline-flex rounded-md bg-blue-50 text-blue-800 px-2 py-0.5 border border-blue-200 text-[11px] font-bold">
                                  {st.courseName}
                                </span>
                                <span className="block text-[11px] text-slate-700 font-semibold mt-0.5">
                                  {st.branchName}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-800 border border-slate-200">
                                  {st.romanSemester || `Sem ${st.semester}`}
                                </span>
                                <span className="block text-[10px] text-slate-400 mt-0.5">
                                  Year {st.yearOfStudy}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span className="inline-flex rounded-md bg-indigo-50 text-indigo-700 px-2 py-0.5 text-xs font-bold border border-indigo-200">
                                  Sec {st.sectionName}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center">
                                {st.status === "submitted" ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                    Submitted
                                  </span>
                                ) : st.status === "partial" ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
                                    <Clock className="h-3 w-3 text-amber-600" />
                                    Partial
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 border border-slate-200">
                                    Pending
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span className="font-bold text-slate-800 text-xs">
                                  {st.totalEvaluated}
                                  {st.totalExpected ? ` / ${st.totalExpected}` : ""}
                                </span>
                                <span className="text-[10px] text-slate-400 block">subjects evaluated</span>
                              </td>
                              <td className="py-3 px-3 text-slate-600 text-xs">
                                {st.lastSubmittedAt ? formatDisplayDateTime(st.lastSubmittedAt) : "—"}
                              </td>
                              <td className="py-3 px-4 text-center">
                                {st.totalEvaluated > 0 ? (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => setSelectedStudentReport(st)}
                                    className="h-7 text-[11px] font-semibold text-emerald-800 border-emerald-300 hover:bg-emerald-50 cursor-pointer flex items-center gap-1.5 mx-auto"
                                  >
                                    <Eye className="h-3.5 w-3.5 text-emerald-600" />
                                    <span>View Responses ({st.totalEvaluated})</span>
                                  </Button>
                                ) : (
                                  <span className="text-slate-400 text-[11px] italic">No submissions</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : null}
      </div>

            {/* ========================================================================= */}
      {/* STUDENT EVALUATION DETAILS MODAL (WITH INDIVIDUAL QUESTION RESPONSES)     */}
      {/* ========================================================================= */}
      {selectedStudentDetailsItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto backdrop-blur-xs">
          <div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50/90 px-6 py-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-navy-900 flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-600" />
                  Student Feedback Evaluations
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  <strong className="text-slate-800 font-semibold">{selectedStudentDetailsItem.subjectName} ({selectedStudentDetailsItem.subjectCode})</strong>
                  {" · "}
                  <span>Faculty: <strong>{selectedStudentDetailsItem.facultyName}</strong></span>
                  {" · "}
                  <span>Class: <strong>{selectedStudentDetailsItem.branchName} ({selectedStudentDetailsItem.romanSemester} - {selectedStudentDetailsItem.sectionName ? 'Section ' + selectedStudentDetailsItem.sectionName : 'Section'})</strong></span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentDetailsItem(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body: Table of student evaluations */}
            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              {selectedStudentDetailsItem.studentDetails.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <ShieldCheck className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-700">No student responses recorded yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                        <th className="py-2.5 px-3 min-w-[140px]">STUDENT NAME / ID</th>
                        <th className="py-2.5 px-3 min-w-[130px]">SUBMITTED AT</th>
                        {questionsToDisplay.map((q, qIdx) => (
                          <th key={q.id ?? qIdx} className="py-2.5 px-3 text-center min-w-[130px]">
                            {toSentenceCase(q.shortLabel || shortenQuestionText(q.questionText))} (Q${qIdx + 1})
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedStudentDetailsItem.studentDetails.map((st, idx) => (
                        <tr key={st.id || idx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-semibold">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-navy-900">
                            {st.studentName}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">
                            {formatDisplayDateTime(st.submittedAt)}
                          </td>
                          {questionsToDisplay.map((q, qIdx) => {
                            const qId = String(q.id);
                            const ans = st.answers[qId] ?? st.answers[`q_${q.id}`] ?? st.answers[q.questionText] ?? (
                              q.shortLabel.toLowerCase().includes("rate") ? st.facultyRating :
                              q.shortLabel.toLowerCase().includes("unit") && q.shortLabel.toLowerCase().includes("covered") ? st.unitsCovered :
                              q.shortLabel.toLowerCase().includes("unit") && q.shortLabel.toLowerCase().includes("status") ? st.unitStatus :
                              null
                            );
                            return (
                              <td key={qIdx} className="py-2.5 px-3 text-center">
                                {ans != null && String(ans).trim() !== "" ? (
                                  q.shortLabel.toLowerCase().includes("rate") ? (
                                    <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                      <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                                      {Number(ans).toFixed(1)}
                                    </span>
                                  ) : (
                                    <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                                      {String(ans)}
                                    </span>
                                  )
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50/60 px-6 py-3">
              <span className="text-xs text-slate-500">
                Total {selectedStudentDetailsItem.studentDetails.length} evaluations recorded
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedStudentDetailsItem(null)}
                className="text-xs font-semibold cursor-pointer"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ========================================================================= */}
      {/* STUDENT SUBMISSION REPORT DETAILS MODAL (WHAT THE STUDENT SENT)           */}
      {/* ========================================================================= */}
      {selectedStudentReport ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto backdrop-blur-xs">
          <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-gradient-to-r from-emerald-800 via-teal-800 to-navy-900 px-6 py-4 text-white">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white border border-white/25">
                    {selectedStudentReport.courseName}
                  </span>
                  <span className="rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-200 border border-emerald-300/30">
                    {selectedStudentReport.branchName}
                  </span>
                  <span className="rounded-full bg-teal-400/20 px-2.5 py-0.5 text-[10px] font-semibold text-teal-200 border border-teal-300/30">
                    {selectedStudentReport.romanSemester} · Sec {selectedStudentReport.sectionName}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold tracking-wide flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-emerald-300" />
                  <span>{selectedStudentReport.studentName}</span>
                  <span className="text-xs font-mono font-normal text-emerald-200">
                    (PIN: {selectedStudentReport.studentPin})
                  </span>
                </h3>
                <p className="text-xs text-emerald-100 font-medium mt-0.5">
                  Submission Report · {selectedStudentReport.totalEvaluated} Subject Evaluations Submitted
                  {selectedStudentReport.lastSubmittedAt ? ` · Last: ${formatDisplayDateTime(selectedStudentReport.lastSubmittedAt)}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentReport(null)}
                className="rounded-lg p-1.5 text-white/80 hover:bg-white/20 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body: Evaluated Subjects by Student */}
            <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Status</span>
                    <span className="font-bold text-slate-800 capitalize">{selectedStudentReport.status}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Evaluated Subjects</span>
                    <span className="font-bold text-navy-900">{selectedStudentReport.totalEvaluated} / {selectedStudentReport.totalExpected || selectedStudentReport.totalEvaluated}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Student PIN / Roll</span>
                    <span className="font-bold font-mono text-slate-800">{selectedStudentReport.studentPin}</span>
                  </div>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">
                  Responses verified from academic feedback publication
                </span>
              </div>

              {selectedStudentReport.evaluations.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-700">No submissions recorded for this student</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedStudentReport.evaluations.map((ev, evIdx) => (
                    <div
                      key={evIdx}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-slate-300 transition-colors"
                    >
                      {/* Evaluation Header */}
                      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3 mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-navy-100 text-navy-800 font-bold px-2 py-0.5 text-[11px]">
                              Subject {evIdx + 1}
                            </span>
                            <h4 className="text-sm font-bold text-navy-900">
                              {ev.subjectName}
                              {ev.subjectCode ? <span className="ml-1.5 font-normal text-slate-500 font-mono text-xs">({ev.subjectCode})</span> : null}
                            </h4>
                          </div>
                          <p className="text-xs text-slate-600 mt-1 flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-indigo-600" />
                            <span>Faculty: <strong className="text-slate-900 font-semibold">{ev.facultyName}</strong></span>
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {ev.facultyRating != null ? (
                            <span className="inline-flex items-center gap-1 font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 text-xs">
                              <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                              Rating: {Number(ev.facultyRating).toFixed(1)} / 5
                            </span>
                          ) : null}

                          {ev.unitsCovered ? (
                            <span className="inline-flex items-center rounded-lg bg-blue-50 text-blue-800 px-2.5 py-1 text-xs font-bold border border-blue-200">
                              Units: {ev.unitsCovered}
                            </span>
                          ) : null}

                          {ev.unitStatus ? (
                            <span className="inline-flex items-center rounded-lg bg-emerald-50 text-emerald-800 px-2.5 py-1 text-xs font-bold border border-emerald-200">
                              Status: {ev.unitStatus}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* Question by Question Detailed Responses */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 text-slate-600 font-bold text-[10px] uppercase border-b border-slate-200">
                              <th className="py-2 px-3 w-8">#</th>
                              <th className="py-2 px-3">EVALUATION QUESTION</th>
                              <th className="py-2 px-3 min-w-[180px] text-right">STUDENT RESPONSE</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {questionsToDisplay.map((q, qIdx) => {
                              const qId = String(q.id);
                              const ans =
                                ev.answers[qId] ??
                                ev.answers[`q_${q.id}`] ??
                                ev.answers[q.questionText] ??
                                (q.shortLabel.toLowerCase().includes("rate")
                                  ? ev.facultyRating
                                  : q.shortLabel.toLowerCase().includes("unit") && q.shortLabel.toLowerCase().includes("covered")
                                  ? ev.unitsCovered
                                  : q.shortLabel.toLowerCase().includes("unit") && q.shortLabel.toLowerCase().includes("status")
                                  ? ev.unitStatus
                                  : null);

                              return (
                                <tr key={q.id ?? qIdx} className="hover:bg-slate-50/50">
                                  <td className="py-2 px-3 text-slate-400 font-semibold">{qIdx + 1}</td>
                                  <td className="py-2 px-3 font-medium text-slate-800">
                                    {q.questionText}
                                  </td>
                                  <td className="py-2 px-3 text-right">
                                    {ans != null && String(ans).trim() !== "" ? (
                                      q.shortLabel.toLowerCase().includes("rate") ? (
                                        <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-xs">
                                          <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                                          {Number(ans).toFixed(1)} / 5
                                        </span>
                                      ) : (
                                        <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-xs">
                                          {String(ans)}
                                        </span>
                                      )
                                    ) : (
                                      <span className="text-slate-400 italic">Not answered</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Additional Remarks from Answers if present */}
                      {(() => {
                        const remarksKeys = ["remarks", "feedback", "comments", "q_6", "6", "suggestions"];
                        let remarksVal = null;
                        for (const k of remarksKeys) {
                          if (ev.answers[k] && typeof ev.answers[k] === "string" && ev.answers[k].trim()) {
                            remarksVal = ev.answers[k].trim();
                            break;
                          }
                        }
                        if (!remarksVal) return null;
                        return (
                          <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900">
                            <span className="font-bold block text-[10px] uppercase text-blue-800 mb-0.5">
                              Student Remarks & Suggestions:
                            </span>
                            <p className="italic">&ldquo;{remarksVal}&rdquo;</p>
                          </div>
                        );
                      })()}

                      <div className="mt-2 text-right text-[10px] text-slate-400">
                        Submitted at: {formatDisplayDateTime(ev.submittedAt)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50/80 px-6 py-3">
              <span className="text-xs text-slate-500">
                Total {selectedStudentReport.evaluations.length} subject evaluations
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedStudentReport(null)}
                className="text-xs font-semibold cursor-pointer"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}

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

              {/* Active Session Notice when existing publications are found */}
              {activeExistingPubs.length > 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-amber-950">
                        {activeExistingPubs.length} Active Feedback Session(s) Currently Published
                      </p>
                      <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                        An active feedback session is already running: &ldquo;{activeExistingPubs[0].title}&rdquo; (active until {formatDisplayDateTime(activeExistingPubs[0].endDate)}).
                        Publishing a new session will create a separate notification session in SDMS with its own evaluation dates and progress tracking, ensuring students see each drive notification-wise without duplicate submissions or date overriding.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1.5 border-t border-amber-200/60">
                    <span className="text-[10.5px] text-amber-800 font-medium">
                      Just need to change dates or extend the deadline for the active session?
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPublishModalOpen(false);
                        openEditDatesModal();
                      }}
                      className="rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 px-2.5 py-1 text-[11px] font-bold border border-amber-300 transition"
                    >
                      Edit Active Dates Instead
                    </button>
                  </div>
                </div>
              ) : null}

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
                                {(item.branchCode || item.branchName) && (
                                  <span className="rounded bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-700 border border-amber-200">
                                    {item.branchCode || item.branchName}
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
      {/* PUBLISHED SUCCESS & SDMS STUDENT REDIRECTION LINK POPUP                   */}
      {/* ========================================================================= */}
      {isPublishSuccessOpen && publishedSuccessPub ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto backdrop-blur-xs">
          <div className="relative flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            {/* Header */}
            <div className="flex shrink-0 items-start justify-between border-b border-slate-100 bg-gradient-to-r from-emerald-50 via-teal-50 to-white px-6 py-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-200">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-extrabold text-navy-900">
                      Feedback Published Successfully!
                    </h3>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Notification session is live. Direct your students to SDMS to submit their evaluations.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPublishSuccessOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-5">
              {/* Session Overview Card */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2.5 text-xs text-slate-700">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <span className="font-bold text-slate-900 text-sm">{publishedSuccessPub.title}</span>
                  <span className="font-mono text-[10px] bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded font-semibold">
                    Session ID: #{publishedSuccessPub.id}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                  <div>
                    <span className="text-slate-400 font-medium block">Form Template:</span>
                    <strong className="text-slate-800">{publishedSuccessPub.formName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium block">Academic Scope:</span>
                    <strong className="text-slate-800">
                      {publishedSuccessPub.academicYear} {publishedSuccessPub.semester ? `• Sem ${publishedSuccessPub.semester}` : "• All Semesters"}
                    </strong>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 font-medium block">Target Departments:</span>
                    <strong className="text-slate-800">
                      {publishedSuccessPub.branchName || "All Branches"} ({publishedSuccessPub.courseName || "All Courses"})
                    </strong>
                  </div>
                  <div className="col-span-2 flex items-center gap-1.5 text-navy-800 font-semibold bg-white p-2 rounded-lg border border-slate-200/70">
                    <Clock className="h-3.5 w-3.5 text-navy-600 shrink-0" />
                    <span>
                      Active: {formatDisplayDateTime(publishedSuccessPub.startDate)} → {formatDisplayDateTime(publishedSuccessPub.endDate)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Student Redirection Link Box */}
              <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <LinkIcon className="h-4 w-4 text-indigo-700" />
                    <span className="text-xs font-bold uppercase tracking-wider text-navy-900">
                      Student Feedback Submission Link
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                    SDMS Direct URL
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Students can open this link to land directly on their feedback form in the SDMS Student Portal:
                </p>

                {/* Link input & Copy button */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={getSdmsFeedbackUrl(publishedSuccessPub.id)}
                    className="flex-1 rounded-xl border border-indigo-300 bg-white px-3 py-2 text-xs font-mono text-slate-800 select-all shadow-2xs outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={async () => {
                      const url = getSdmsFeedbackUrl(publishedSuccessPub.id);
                      try {
                        await navigator.clipboard.writeText(url);
                        setHasCopiedSdmsLink(true);
                        setTimeout(() => setHasCopiedSdmsLink(false), 2500);
                      } catch {
                        // fallback
                      }
                    }}
                    className={cn(
                      "shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-2 transition-all",
                      hasCopiedSdmsLink
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-white hover:bg-slate-50 border-indigo-300 text-indigo-900",
                    )}
                  >
                    {hasCopiedSdmsLink ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </Button>
                </div>

                {/* Open in SDMS Button */}
                <div className="pt-1 flex items-center justify-between gap-3">
                  <a
                    href={getSdmsFeedbackUrl(publishedSuccessPub.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 transition shadow-xs"
                  >
                    <span>Open SDMS Student Feedback</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>

                  <span className="text-[11px] text-slate-400 text-right">
                    Opens in new tab
                  </span>
                </div>
              </div>

              {/* Informative Explanation Note */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600 space-y-1">
                <p className="font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  SDMS Notification-Wise Display & Anonymous Submissions
                </p>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  In SDMS, each feedback session is organized notification-wise with its own distinct deadline and course evaluations. Students will see evaluations for this notification separately, preventing duplicate course cards or conflicting dates. All evaluations remain 100% confidential.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50/80 px-6 py-4">
              <span className="text-xs text-slate-500">
                You can view real-time student submission progress in this report anytime.
              </span>
              <Button
                variant="primary"
                onClick={() => setIsPublishSuccessOpen(false)}
                className="bg-navy-800 hover:bg-navy-900 text-white text-xs px-5 py-2 font-bold"
              >
                Done / View Report
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ========================================================================= */}
      {/* EDIT DATES & STATUS MODAL                                                  */}
      {/* ========================================================================= */}
      {isEditDatesOpen && (editingPublication || selectedPubObject || activePublication || report?.publication) ? (() => {
        const targetPubForEdit = editingPublication || selectedPubObject || activePublication || report?.publication;
        return (
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
                    Update active dates or extend deadline for {targetPubForEdit?.title}
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
        );
      })() : null}

      {/* ========================================================================= */}
      {/* MANAGE ALL SESSIONS MODAL                                                  */}
      {/* ========================================================================= */}
      {isManageSessionsModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto backdrop-blur-xs">
          <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-100 text-navy-800">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-navy-900">
                    Published Feedback Sessions ({report?.publications?.length || 0})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Manage activation schedules, deadlines, active status, and direct student submission links
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsManageSessionsModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              {!report?.publications || report.publications.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Calendar className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                  <p className="font-semibold text-slate-700">No Published Feedback Sessions Found</p>
                  <p className="text-xs text-slate-500 mt-1">Publish a feedback session to begin collecting student responses.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                        <th className="py-3 px-4">Session Title & Form</th>
                        <th className="py-3 px-3">Scope / Target</th>
                        <th className="py-3 px-3">Active Period</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3 text-center">Submissions</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.publications.map((pub) => {
                        const isCurrentlyActive = pub.isActive && pub.status === "active";
                        const isScheduled = pub.status === "scheduled";
                        const isSelected = selectedPublicationId === pub.id;

                        return (
                          <tr
                            key={pub.id}
                            className={cn(
                              "hover:bg-slate-50/80 transition-colors",
                              isSelected && "bg-sky-50/50"
                            )}
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">{pub.title}</span>
                                {isSelected && (
                                  <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-800">
                                    Viewing
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                Template: {pub.formName || "Feedback Form"} • #{pub.id}
                              </p>
                            </td>

                            <td className="py-3 px-3">
                              <div className="font-medium text-slate-800">
                                {pub.courseName || pub.collegeName || "All Academic"}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {pub.academicYear} {pub.semester ? `• Sem ${pub.semester}` : ""}
                              </div>
                            </td>

                            <td className="py-3 px-3 whitespace-nowrap">
                              <div className="text-[11px] text-slate-800 font-medium">
                                {pub.startDate ? formatDisplayDateTime(pub.startDate) : "Immediate"}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                to {pub.endDate ? formatDisplayDateTime(pub.endDate) : "Indefinite"}
                              </div>
                            </td>

                            <td className="py-3 px-3">
                              {isCurrentlyActive ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  Active
                                </span>
                              ) : isScheduled ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200">
                                  <Clock className="h-3 w-3" />
                                  Scheduled
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 border border-slate-200">
                                  Closed
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-3 text-center">
                              <span className="font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-full text-xs">
                                {pub.responseCount ?? "—"}
                              </span>
                            </td>

                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    openEditDatesModal(pub);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 shadow-2xs"
                                  title="Edit schedule and active dates"
                                >
                                  <Edit3 className="h-3.5 w-3.5 text-navy-700" />
                                  Edit Schedule
                                </button>

                                <button
                                  type="button"
                                  onClick={async () => {
                                    const url = getSdmsFeedbackUrl(pub.id);
                                    try {
                                      await navigator.clipboard.writeText(url);
                                      setActionNotice(`Student link for "${pub.title}" copied!`);
                                    } catch {
                                      // fallback
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 shadow-2xs"
                                  title="Copy direct SDMS student submission link"
                                >
                                  <Copy className="h-3.5 w-3.5 text-slate-600" />
                                  Copy Link
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedPublicationId(pub.id);
                                    setIsManageSessionsModalOpen(false);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-md bg-navy-800 px-2 py-1 text-[11px] font-semibold text-white hover:bg-navy-900 shadow-2xs"
                                  title="View reports for this session"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  View Report
                                </button>

                                <button
                                  type="button"
                                  onClick={() => void handleDeletePublication(pub.id, pub.title)}
                                  className="inline-flex items-center justify-center rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                                  title="Delete publication session"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50/80 px-6 py-4">
              <span className="text-xs text-slate-500">
                Total Sessions: {report?.publications?.length || 0}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsManageSessionsModalOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ========================================================================= */}
      {/* GLOBAL DOWNLOAD REPORTS MODAL (COLLEGE, COURSE, BRANCH, YEAR, SEM, SEC, FACULTY) */}
      {/* ========================================================================= */}
      {isDownloadReportsModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto backdrop-blur-xs">
          <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                  <Download className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-navy-900 flex items-center gap-2">
                    Global Feedback Reports Download
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      Scoped Export
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Filter by College, Course, Branch, Year, Semester, Section, or Faculty to export tailored reports
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDownloadReportsModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-5">
              {/* Top Filter Header & Reset Button */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <Target className="h-4 w-4 text-emerald-600" />
                  1. Configure Report Scope Dropdowns
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDownloadCollegeId("all");
                    setSelectedDownloadCourseId("all");
                    setSelectedDownloadBranch("all");
                    setSelectedDownloadYear("all");
                    setSelectedDownloadSemester("all");
                    setSelectedDownloadSection("all");
                    setSelectedDownloadFaculty("all");
                  }}
                  className="text-xs font-semibold text-navy-700 hover:text-navy-900 flex items-center gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset All Dropdowns
                </button>
              </div>

              {/* 7-Dropdown Selection Grid */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3.5 shadow-2xs">
                {/* Row 1: Academic Scope (College, Course, Branch) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* College Dropdown */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      College
                    </label>
                    <select
                      value={selectedDownloadCollegeId}
                      onChange={(e) => {
                        const val = e.target.value === "all" ? "all" : Number(e.target.value);
                        setSelectedDownloadCollegeId(val);
                        setSelectedDownloadCourseId("all");
                        setSelectedDownloadBranch("all");
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-navy-500 shadow-2xs"
                    >
                      <option value="all">All Colleges (Combined)</option>
                      {(report?.availableColleges || []).map((col) => (
                        <option key={col.id} value={col.id}>
                          {col.name} ({col.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Course Dropdown */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Course / Degree
                    </label>
                    <select
                      value={selectedDownloadCourseId}
                      onChange={(e) => {
                        const val = e.target.value === "all" ? "all" : Number(e.target.value);
                        setSelectedDownloadCourseId(val);
                        setSelectedDownloadBranch("all");
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-navy-500 shadow-2xs"
                    >
                      <option value="all">All Courses</option>
                      {coursesForDownload.map((cr) => (
                        <option key={cr.id} value={cr.id}>
                          {cr.name} ({cr.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Branch Dropdown */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Branch / Department
                    </label>
                    <select
                      value={selectedDownloadBranch}
                      onChange={(e) => setSelectedDownloadBranch(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-navy-500 shadow-2xs"
                    >
                      <option value="all">All Branches</option>
                      {branchesForDownload.map((br) => (
                        <option key={br.id} value={br.name}>
                          {br.name} ({br.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 2: Cohort Scope (Year of Study, Semester, Section) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Year of Study Dropdown */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Year of Study
                    </label>
                    <select
                      value={selectedDownloadYear}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedDownloadYear(val);
                        if (val !== "all" && selectedDownloadSemester !== "all") {
                          const yrNum = Number(val);
                          const semNum = Number(selectedDownloadSemester);
                          if (Math.ceil(semNum / 2) !== yrNum) {
                            setSelectedDownloadSemester("all");
                          }
                        }
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-navy-500 shadow-2xs"
                    >
                      <option value="all">All Years</option>
                      <option value="1">1st Year (Sem I - II)</option>
                      <option value="2">2nd Year (Sem III - IV)</option>
                      <option value="3">3rd Year (Sem V - VI)</option>
                      <option value="4">4th Year (Sem VII - VIII)</option>
                    </select>
                  </div>

                  {/* Semester Dropdown */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Semester
                    </label>
                    <select
                      value={selectedDownloadSemester}
                      onChange={(e) => setSelectedDownloadSemester(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-navy-500 shadow-2xs"
                    >
                      <option value="all">All Semesters</option>
                      {selectedDownloadYear === "1" ? (
                        <>
                          <option value="1">Semester 1 (I)</option>
                          <option value="2">Semester 2 (II)</option>
                        </>
                      ) : selectedDownloadYear === "2" ? (
                        <>
                          <option value="3">Semester 3 (III)</option>
                          <option value="4">Semester 4 (IV)</option>
                        </>
                      ) : selectedDownloadYear === "3" ? (
                        <>
                          <option value="5">Semester 5 (V)</option>
                          <option value="6">Semester 6 (VI)</option>
                        </>
                      ) : selectedDownloadYear === "4" ? (
                        <>
                          <option value="7">Semester 7 (VII)</option>
                          <option value="8">Semester 8 (VIII)</option>
                        </>
                      ) : (
                        <>
                          <option value="1">Semester 1 (I)</option>
                          <option value="2">Semester 2 (II)</option>
                          <option value="3">Semester 3 (III)</option>
                          <option value="4">Semester 4 (IV)</option>
                          <option value="5">Semester 5 (V)</option>
                          <option value="6">Semester 6 (VI)</option>
                          <option value="7">Semester 7 (VII)</option>
                          <option value="8">Semester 8 (VIII)</option>
                        </>
                      )}
                    </select>
                  </div>

                  {/* Section Dropdown */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Section
                    </label>
                    <select
                      value={selectedDownloadSection}
                      onChange={(e) => setSelectedDownloadSection(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-navy-500 shadow-2xs"
                    >
                      <option value="all">All Sections</option>
                      {availableSectionsForFilter.map((sec) => (
                        <option key={sec} value={sec}>
                          Section {sec}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 3: Individual Faculty Dropdown */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Faculty Member</span>
                    <span className="text-[10px] font-normal text-slate-500">
                      Select specific teacher or leave as "All Faculty"
                    </span>
                  </label>
                  <select
                    value={selectedDownloadFaculty}
                    onChange={(e) => setSelectedDownloadFaculty(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-navy-500 shadow-2xs font-medium"
                  >
                    <option value="all">All Faculty (Comprehensive Report)</option>
                    {(report?.facultyGroups || []).map((f) => (
                      <option key={f.facultyName} value={f.facultyName}>
                        {f.facultyName} {f.employeeCode ? `(#${f.employeeCode})` : ""} — {f.totalSubmissions} evaluations, {f.overallRating ? `★ ${f.overallRating.toFixed(2)}` : "No rating"} ({f.totalSubjects} subjects)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Live Scope Match Preview */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-emerald-900 font-bold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>
                    Matched: {scopedExportPreview.matchedSubjects} Subject Allocations
                  </span>
                </div>
                <div className="flex items-center gap-3 text-emerald-800 font-medium">
                  <span>
                    Evaluations: <strong className="font-bold text-emerald-900">{scopedExportPreview.matchedSubmissions}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Average Rating: <strong className="font-bold text-emerald-900">{scopedExportPreview.avgRating ? `★ ${scopedExportPreview.avgRating}` : "—"}</strong>
                  </span>
                </div>
              </div>

              {/* File Format Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-2 uppercase tracking-wide">
                  2. Select File Format
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all",
                      downloadFormat === "excel"
                        ? "border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-500"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    )}
                  >
                    <input
                      type="radio"
                      name="downloadFormat"
                      checked={downloadFormat === "excel"}
                      onChange={() => setDownloadFormat("excel")}
                      className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="font-bold text-xs text-slate-900">Excel Spreadsheet (.xls)</div>
                      <p className="text-[10px] text-slate-500">Formatted workbook with summary cards and color badges</p>
                    </div>
                  </label>

                  <label
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all",
                      downloadFormat === "csv"
                        ? "border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-500"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    )}
                  >
                    <input
                      type="radio"
                      name="downloadFormat"
                      checked={downloadFormat === "csv"}
                      onChange={() => setDownloadFormat("csv")}
                      className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="font-bold text-xs text-slate-900">CSV Delimited (.csv)</div>
                      <p className="text-[10px] text-slate-500">Raw tabular data suitable for external analysis</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50/80 px-6 py-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDownloadMasterWorkbook}
                className="text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border-slate-300 flex items-center gap-1.5"
                title="Download full multi-sheet Excel workbook with all tabs"
              >
                <Layers className="h-3.5 w-3.5 text-navy-700" />
                <span>Full Master Workbook (.xls)</span>
              </Button>

              <div className="flex items-center gap-2.5">
                <Button
                  variant="ghost"
                  onClick={() => setIsDownloadReportsModalOpen(false)}
                  disabled={isExporting}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleDownloadGlobalScopedReport}
                  disabled={isExporting || scopedExportPreview.matchedSubjects === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 font-bold shadow-xs"
                >
                  <Download className="h-4 w-4" />
                  {isExporting ? "Generating..." : "Download Scoped Report"}
                </Button>
              </div>
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
