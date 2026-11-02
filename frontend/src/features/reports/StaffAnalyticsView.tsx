"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAcademicContext } from "@/components/layout/AcademicProvider";
import { apiFetch } from "@/lib/api";
import { escapeHtml, printHtml } from "@/lib/print-service";
import {
  downloadExcelWorkbook,
  type ExcelWorksheet,
  type ExcelRow,
} from "@/lib/excel-service";
import { cn } from "@/lib/cn";
import {
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  Clock,
  Search,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Filter,
  Check,
  X,
  Building2,
  GraduationCap,
  BookOpen,
  Eye,
  Loader2,
  Layers,
  ArrowUpDown,
  Sparkles,
  ArrowRight,
  CheckCheck,
  CalendarDays,
} from "lucide-react";

// --- Types ---

export type SlotDefinition = {
  order: number;
  label: string;
  time: string;
  startTime?: string;
  endTime?: string;
};

export type SlotSessionDetail = {
  id: number;
  date: string;
  dayOfWeek: string;
  slotLabel: string;
  time: string;
  isConducted: boolean;
  subjectCode: string;
  subjectName: string;
  courseName?: string;
  branchName?: string;
  branchCode?: string;
  sectionName?: string;
  batch?: string;
  semester?: number;
  presentCount: number;
  absentCount: number;
  enrolledCount: number;
  attendancePct: number | null;
  isSubstitute: boolean;
  masterFacultyName?: string;
  masterFacultyHrmsId?: string;
  todayFacultyName?: string;
  todayFacultyHrmsId?: string;
  varianceType?: string;
};

export type FacultySlotSummary = {
  assignedCount: number;
  postedCount: number;
  pendingCount: number;
  status: "YES" | "NO" | "PARTIAL" | "FREE";
  sessions: SlotSessionDetail[];
};

export type FacultyRowData = {
  hrmsId: string;
  facultyName: string;
  department: string;
  subjects: string[];
  totalMasterSlots: number;
  totalPostedSlots: number;
  totalPendingSlots: number;
  postingRatePct: number;
  // Current active slot summary (for active day or entire range)
  slots: Record<string, FacultySlotSummary>;
  // Day-by-day slot breakdown: date -> slotLabel -> FacultySlotSummary
  dayBreakdown: Record<string, Record<string, FacultySlotSummary>>;
  // All raw sessions for this faculty
  allSessions: SlotSessionDetail[];
};

export type MergedPeriodSlotAudit = {
  key: string;
  date: string;
  slotLabel: string;
  time: string;
  slotOrder: number;
  subjectCodes: string[];
  subjectNames: string[];
  branches: string[];
  sections: string[];
  batches: string[];
  isConducted: boolean;
  isSubstitute: boolean;
  presentCount: number;
  absentCount: number;
  totalTurnout: number;
  attendancePct: number | null;
  rawSessionCount: number;
  sessions: SlotSessionDetail[];
};

type SortField = "name" | "slots" | "posted" | "pending" | "rate";

// --- Date Helpers ---

function getTodayIso(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getYesterdayIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getThisWeekStartIso(): string {
  const d = new Date();
  const day = d.getDay();
  // Monday as start of week
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  const year = mon.getFullYear();
  const month = String(mon.getMonth() + 1).padStart(2, "0");
  const dd = String(mon.getDate()).padStart(2, "0");
  return `${year}-${month}-${dd}`;
}

function getLastNDaysRange(days: number): { start: string; end: string } {
  const endD = new Date();
  const startD = new Date();
  startD.setDate(startD.getDate() - (days - 1));

  const end = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, "0")}-${String(endD.getDate()).padStart(2, "0")}`;
  const start = `${startD.getFullYear()}-${String(startD.getMonth() + 1).padStart(2, "0")}-${String(startD.getDate()).padStart(2, "0")}`;
  return { start, end };
}

function formatDateDisplay(isoDate: string): string {
  if (!isoDate) return "";
  try {
    const [y, m, d] = isoDate.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      weekday: "short",
    });
  } catch {
    return isoDate;
  }
}

// Fallback default periods if none detected from schedule
const DEFAULT_FALLBACK_SLOTS: SlotDefinition[] = [
  { order: 1, label: "P1", time: "09:00 - 09:50" },
  { order: 2, label: "P2", time: "09:50 - 10:40" },
  { order: 3, label: "P3", time: "10:50 - 11:40" },
  { order: 4, label: "P4", time: "11:40 - 12:30" },
  { order: 5, label: "P5", time: "13:20 - 14:10" },
  { order: 6, label: "P6", time: "14:10 - 15:00" },
  { order: 7, label: "P7", time: "15:00 - 15:50" },
];

export function StaffAnalyticsView({
  onNavigateSection,
}: {
  onNavigateSection?: (section: "variation" | "subjects" | "staff" | "audit") => void;
}) {
  const { masters, filters: academicFilters } = useAcademicContext();

  // --- Top Filter States ---
  const [selectedCollegeId, setSelectedCollegeId] = useState<number | "all">(() => {
    if (academicFilters?.collegeId && academicFilters.collegeId !== "all") {
      return Number(academicFilters.collegeId);
    }
    return masters?.defaults?.collegeId ?? (masters?.colleges?.[0]?.id ?? "all");
  });

  const [selectedCourseId, setSelectedCourseId] = useState<number | "all">("all");
  const [selectedBranchId, setSelectedBranchId] = useState<number | "all">("all");
  const [selectedSection, setSelectedSection] = useState<string | "all">("all");

  // Single Date Selection (defaults to today)
  const [selectedDate, setSelectedDate] = useState<string>(() => academicFilters?.startDate || getTodayIso());

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [postingFilter, setPostingFilter] = useState<"all" | "posted" | "pending" | "none">("all");

  // Sorting
  const [sortField, setSortField] = useState<SortField>("pending");
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Modal for individual faculty audit
  const [activeFacultyModal, setActiveFacultyModal] = useState<FacultyRowData | null>(null);

  // Fetch status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawData, setRawData] = useState<any>(null);

  // Excel / PDF generating flags
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const printAreaRef = useRef<HTMLDivElement>(null);

  // Filter available courses based on selectedCollegeId
  const availableCourses = useMemo(() => {
    if (!masters?.courses) return [];
    if (selectedCollegeId === "all") return masters.courses;
    return masters.courses.filter((c) => c.collegeId === selectedCollegeId);
  }, [masters?.courses, selectedCollegeId]);

  // Filter available branches based on selectedCourseId
  const availableBranches = useMemo(() => {
    if (!masters?.branches) return [];
    if (selectedCourseId === "all") {
      if (selectedCollegeId === "all") return masters.branches;
      const courseIds = new Set(availableCourses.map((c) => c.id));
      return masters.branches.filter((b) => courseIds.has(b.courseId));
    }
    return masters.branches.filter((b) => b.courseId === selectedCourseId);
  }, [masters?.branches, selectedCourseId, selectedCollegeId, availableCourses]);

  // Filter available sections based on selectedBranchId, selectedCourseId, and rawData
  const availableSections = useMemo(() => {
    const secSet = new Set<string>();

    if (masters?.sections) {
      for (const s of masters.sections) {
        if (selectedBranchId !== "all" && s.branchId !== selectedBranchId) {
          continue;
        }
        if (selectedBranchId === "all" && selectedCourseId !== "all") {
          const validBranchIds = new Set(availableBranches.map((b) => b.id));
          if (!validBranchIds.has(s.branchId)) continue;
        }
        if (s.name) {
          secSet.add(s.name.trim());
        }
      }
    }

    // Also collect distinct section names from rawData if present
    if (rawData) {
      const comparisons = rawData.comparisons || [];
      const masterScheduled = rawData.masterScheduledPeriods || [];
      for (const item of [...comparisons, ...masterScheduled]) {
        if (selectedBranchId !== "all" && item.branchId && item.branchId !== selectedBranchId) {
          continue;
        }
        const sec = (item.sectionName || item.section || "").trim();
        if (sec) {
          secSet.add(sec);
        }
      }
    }

    const list = Array.from(secSet);
    list.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
    return list;
  }, [masters?.sections, selectedBranchId, selectedCourseId, availableBranches, rawData]);

  // Reset course, branch & section if college changes
  const handleCollegeChange = (cid: number | "all") => {
    setSelectedCollegeId(cid);
    setSelectedCourseId("all");
    setSelectedBranchId("all");
    setSelectedSection("all");
  };

  // Reset branch & section if course changes
  const handleCourseChange = (courseId: number | "all") => {
    setSelectedCourseId(courseId);
    setSelectedBranchId("all");
    setSelectedSection("all");
  };

  // Reset section if branch changes
  const handleBranchChange = (branchId: number | "all") => {
    setSelectedBranchId(branchId);
    setSelectedSection("all");
  };

  // Quick Date Stepper (+1 day, -1 day)
  const handleShiftDay = (deltaDays: number) => {
    const cur = new Date(selectedDate + "T00:00:00");
    cur.setDate(cur.getDate() + deltaDays);
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    setSelectedDate(`${y}-${m}-${d}`);
  };

  // Fetch Report Data from Backend for Single Date
  const fetchReportData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (academicFilters?.academicYear && academicFilters.academicYear !== "all") {
        params.set("academicYear", academicFilters.academicYear);
      }
      if (selectedCollegeId !== "all") {
        params.set("collegeId", String(selectedCollegeId));
      }
      if (selectedCourseId !== "all") {
        params.set("courseId", String(selectedCourseId));
      }
      if (selectedBranchId !== "all") {
        params.set("branchId", String(selectedBranchId));
      }
      if (selectedSection !== "all") {
        params.set("sectionName", selectedSection);
        params.set("section", selectedSection);
      }
      if (selectedDate) {
        params.set("startDate", selectedDate);
        params.set("endDate", selectedDate);
      }
      params.set("limit", "10000");

      const res = await apiFetch(`/today-timetable/master-vs-changed-report?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load staff analytics (Status ${res.status})`);
      }
      const json = await res.json();
      setRawData(json);
    } catch (err: any) {
      console.error("StaffAnalytics fetch error:", err);
      setError(err.message || "Failed to load staff analytics data");
    } finally {
      setLoading(false);
    }
  }, [
    academicFilters?.academicYear,
    selectedCollegeId,
    selectedCourseId,
    selectedBranchId,
    selectedSection,
    selectedDate,
  ]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // --- Process & Aggregate Data ---

  // 1. Identify distinct timetable slots from comparisons & masterScheduledPeriods
  const detectedSlots = useMemo<SlotDefinition[]>(() => {
    const map = new Map<string, { order: number; times: Set<string> }>();

    const comparisons = rawData?.comparisons || [];
    const masterScheduled = rawData?.masterScheduledPeriods || [];

    for (const c of comparisons) {
      const label = (c.slotLabel || "").trim();
      if (label) {
        const orderMatch = label.match(/\d+/);
        const order = orderMatch ? Number(orderMatch[0]) : 99;
        if (!map.has(label)) {
          map.set(label, { order, times: new Set() });
        }
        if (c.time) map.get(label)!.times.add(c.time);
      }
    }

    for (const m of masterScheduled) {
      const label = (m.slotLabel || "").trim();
      if (label) {
        const orderMatch = label.match(/\d+/);
        const order = orderMatch ? Number(orderMatch[0]) : 99;
        if (!map.has(label)) {
          map.set(label, { order, times: new Set() });
        }
        if (m.slotTime) map.get(label)!.times.add(m.slotTime);
      }
    }

    if (map.size === 0) {
      return DEFAULT_FALLBACK_SLOTS;
    }

    const result: SlotDefinition[] = [];
    for (const [label, info] of map.entries()) {
      const timeList = Array.from(info.times);
      const displayTime =
        timeList.length === 1
          ? timeList[0]
          : selectedCollegeId !== "all" && timeList[0]
          ? timeList[0]
          : "Class Slot";

      result.push({
        label,
        order: info.order,
        time: displayTime,
      });
    }

    // Sort by slot order, then label
    result.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
    return result;
  }, [rawData, selectedCollegeId]);

  // 2. Identify dates (single selected date)
  const allDatesInRange = useMemo<string[]>(() => {
    return selectedDate ? [selectedDate] : [];
  }, [selectedDate]);

  // 3. Build faculty rows matrix
  const facultyRows = useMemo<FacultyRowData[]>(() => {
    if (!rawData) return [];

    const comparisons: any[] = rawData.comparisons || [];
    const masterScheduled: any[] = rawData.masterScheduledPeriods || [];
    const catalogFaculties: Array<{ hrmsId: string; facultyName: string }> =
      rawData.catalogFaculties || [];

    // Map of faculty by HRMS ID or Name
    const facultyMap = new Map<string, {
      hrmsId: string;
      facultyName: string;
      departments: Set<string>;
      subjects: Set<string>;
      sessions: SlotSessionDetail[];
    }>();

    // Helper to identify special class placeholders, unassigned activity labels, or subjects
    // that are timetable slots rather than actual teaching staff members.
    function isNonStaffPlaceholder(name: string | null | undefined, hrmsId: string | null | undefined): boolean {
      if (!name && !hrmsId) return true;
      const cleanName = (name || "").trim();
      const cleanHrms = (hrmsId || "").trim();
      const hasRealHrms = Boolean(cleanHrms && cleanHrms !== "N/A" && cleanHrms !== "null");

      if (!cleanName && !hasRealHrms) return true;

      const lower = cleanName.toLowerCase();

      // Check placeholder phrases
      if (
        lower.endsWith(" session") ||
        lower.endsWith(" activity") ||
        lower.includes("special activity") ||
        lower.includes("special period") ||
        lower.includes("faculty assigned") ||
        lower.includes("unassigned") ||
        lower === "special" ||
        lower === "period" ||
        lower === "session"
      ) {
        return true;
      }

      // If no valid HRMS ID, check known special class / activity names
      if (!hasRealHrms) {
        const specialKeywords = [
          "crt",
          "soft skills",
          "library",
          "sports",
          "games",
          "seminar",
          "counseling",
          "mentoring",
          "placement",
          "training",
          "project work",
          "self study",
          "break",
          "lunch",
          "assembly",
          "yoga",
          "club",
        ];
        if (specialKeywords.some((kw) => lower.includes(kw))) {
          return true;
        }
      }

      return false;
    }

    function getOrCreateFaculty(hrmsId: string | null | undefined, name: string | null | undefined) {
      if (isNonStaffPlaceholder(name, hrmsId)) return null;

      const cleanHrms = (hrmsId || "").trim();
      const normName = (name || "").trim().replace(/\s+/g, " ");
      const cleanName = normName || (cleanHrms ? `Staff #${cleanHrms}` : "Faculty Assigned");
      // Use clean HRMS as primary key if valid, else normalized uppercase name
      const key = cleanHrms && cleanHrms !== "N/A" ? cleanHrms : normName.toUpperCase() || "UNKNOWN";

      let fac = facultyMap.get(key);
      if (!fac) {
        fac = {
          hrmsId: cleanHrms || "N/A",
          facultyName: cleanName,
          departments: new Set<string>(),
          subjects: new Set<string>(),
          sessions: [],
        };
        facultyMap.set(key, fac);
      }
      return fac;
    }

    // Seed from catalog faculties only when broad scope (all branches and all sections) is selected
    if (selectedBranchId === "all" && selectedSection === "all") {
      for (const cf of catalogFaculties) {
        if (cf.hrmsId || cf.facultyName) {
          getOrCreateFaculty(cf.hrmsId, cf.facultyName);
        }
      }
    }

    // Process all comparisons (sessions and scheduled master periods)
    for (const c of comparisons) {
      const sessionDate = (c.date || "").slice(0, 10);
      const isSub = Boolean(
        c.varianceType === "FACULTY_SUBSTITUTE" ||
        (c.todayFacultyHrmsId && c.masterFacultyHrmsId && c.todayFacultyHrmsId !== c.masterFacultyHrmsId)
      );
      const isConducted = Boolean(c.isConducted);

      const sessionItemBase: SlotSessionDetail = {
        id: c.id,
        date: sessionDate,
        dayOfWeek: c.dayOfWeek || "",
        slotLabel: c.slotLabel || "Period",
        time: c.time || "",
        isConducted,
        subjectCode: c.todaySubjectCode || c.masterSubjectCode || "",
        subjectName: c.todaySubjectName || c.masterSubjectName || "Academic Class",
        branchName: c.branchName,
        branchCode: c.branchCode,
        sectionName: c.sectionName,
        batch: c.batch,
        semester: c.semester,
        presentCount: Number(c.presentCount) || 0,
        absentCount: Number(c.absentCount) || 0,
        enrolledCount: Number(c.enrolledCount) || 0,
        attendancePct: c.attendancePct,
        isSubstitute: isSub,
        masterFacultyName: c.masterFacultyName,
        masterFacultyHrmsId: c.masterFacultyHrmsId,
        todayFacultyName: c.todayFacultyName,
        todayFacultyHrmsId: c.todayFacultyHrmsId,
        varianceType: c.varianceType,
      };

      if (isSub) {
        // 1. todayFaculty is the active teaching faculty for today
        if (c.todayFacultyHrmsId || c.todayFacultyName) {
          const fac = getOrCreateFaculty(c.todayFacultyHrmsId, c.todayFacultyName);
          if (fac) {
            if (c.branchCode || c.branchName) fac.departments.add(c.branchCode || c.branchName);
            if (c.todaySubjectName || c.masterSubjectName) {
              fac.subjects.add(c.todaySubjectName || c.masterSubjectName);
            }
            fac.sessions.push({
              ...sessionItemBase,
              subjectCode: c.todaySubjectCode || c.masterSubjectCode || "",
              subjectName: c.todaySubjectName || c.masterSubjectName || "Academic Class",
            });
          }
        }

        // 2. masterFaculty was the scheduled timetable owner
        // If attendance was posted, the scheduled slot was fulfilled -> Yes!
        // If NOT posted, the slot was shifted/relieved away from them, so DO NOT penalize them as Pending!
        if (c.masterFacultyHrmsId && isConducted) {
          const fac = getOrCreateFaculty(c.masterFacultyHrmsId, c.masterFacultyName);
          if (fac) {
            if (c.branchCode || c.branchName) fac.departments.add(c.branchCode || c.branchName);
            if (c.masterSubjectName || c.todaySubjectName) {
              fac.subjects.add(c.masterSubjectName || c.todaySubjectName);
            }
            fac.sessions.push({
              ...sessionItemBase,
              subjectCode: c.masterSubjectCode || c.todaySubjectCode || "",
              subjectName: c.masterSubjectName || c.todaySubjectName || "Academic Class",
            });
          }
        }
      } else {
        // Regular unchanged class
        const effectiveHrms = c.todayFacultyHrmsId || c.masterFacultyHrmsId;
        const effectiveName = c.todayFacultyName || c.masterFacultyName;
        if (effectiveHrms || effectiveName) {
          const fac = getOrCreateFaculty(effectiveHrms, effectiveName);
          if (fac) {
            if (c.branchCode || c.branchName) fac.departments.add(c.branchCode || c.branchName);
            if (c.todaySubjectName || c.masterSubjectName) {
              fac.subjects.add(c.todaySubjectName || c.masterSubjectName);
            }
            fac.sessions.push(sessionItemBase);
          }
        }
      }
    }

    // Process raw masterScheduledPeriods if any are missing from comparisons
    for (const m of masterScheduled) {
      if (m.facultyHrmsId || m.facultyName) {
        const fac = getOrCreateFaculty(m.facultyHrmsId, m.facultyName);
        if (fac) {
          if (m.branchCode || m.branchName) fac.departments.add(m.branchCode || m.branchName);
          if (m.subjectName) fac.subjects.add(m.subjectName);
        }
      }
    }

    // Now convert each faculty into FacultyRowData with slot-wise deduplication
    const rows: FacultyRowData[] = [];

    for (const fac of facultyMap.values()) {
      if (isNonStaffPlaceholder(fac.facultyName, fac.hrmsId)) continue;
      const allSessions = fac.sessions;

      // Group sessions by date and slot
      // date -> slotLabel -> SlotSessionDetail[]
      const byDateAndSlot = new Map<string, Map<string, SlotSessionDetail[]>>();
      for (const s of allSessions) {
        if (!byDateAndSlot.has(s.date)) byDateAndSlot.set(s.date, new Map());
        const dateMap = byDateAndSlot.get(s.date)!;
        if (!dateMap.has(s.slotLabel)) dateMap.set(s.slotLabel, []);
        dateMap.get(s.slotLabel)!.push(s);
      }

      // Build dayBreakdown for selectedDate
      // In each slot, a faculty teaches 1 slot period.
      // If attendance was posted for ANY session in that slot -> YES (postedCount = 1).
      // If attendance was not posted -> NO (pendingCount = 1).
      // If no session scheduled -> FREE (assignedCount = 0).
      const dayBreakdown: Record<string, Record<string, FacultySlotSummary>> = {};
      dayBreakdown[selectedDate] = {};
      const dateMap = byDateAndSlot.get(selectedDate);

      for (const slot of detectedSlots) {
        const sessList = dateMap?.get(slot.label) || [];
        const isScheduled = sessList.length > 0;
        const isPosted = isScheduled && sessList.some((s) => s.isConducted);

        const assignedCount = isScheduled ? 1 : 0;
        const postedCount = isPosted ? 1 : 0;
        const pendingCount = isScheduled && !isPosted ? 1 : 0;

        let status: "YES" | "NO" | "PARTIAL" | "FREE" = "FREE";
        if (isScheduled) {
          status = isPosted ? "YES" : "NO";
        }

        dayBreakdown[selectedDate][slot.label] = {
          assignedCount,
          postedCount,
          pendingCount,
          status,
          sessions: sessList,
        };
      }

      // Compute active slots view for selectedDate
      const slots: Record<string, FacultySlotSummary> = {};
      let totalMasterSlots = 0;
      let totalPostedSlots = 0;
      let totalPendingSlots = 0;

      for (const slot of detectedSlots) {
        const daySummary = dayBreakdown[selectedDate]?.[slot.label];
        const assignedCount = daySummary?.assignedCount || 0;
        const postedCount = daySummary?.postedCount || 0;
        const pendingCount = daySummary?.pendingCount || 0;
        const relevantSessions = daySummary?.sessions || [];

        let status: "YES" | "NO" | "PARTIAL" | "FREE" = "FREE";
        if (assignedCount > 0) {
          if (pendingCount === 0) status = "YES";
          else if (postedCount === 0) status = "NO";
          else status = "PARTIAL";
        }

        slots[slot.label] = {
          assignedCount,
          postedCount,
          pendingCount,
          status,
          sessions: relevantSessions,
        };

        totalMasterSlots += assignedCount;
        totalPostedSlots += postedCount;
        totalPendingSlots += pendingCount;
      }

      const postingRatePct =
        totalMasterSlots > 0
          ? Math.round((totalPostedSlots / totalMasterSlots) * 100)
          : 0;

      rows.push({
        hrmsId: fac.hrmsId,
        facultyName: fac.facultyName,
        department: Array.from(fac.departments).join(", ") || "General Academic",
        subjects: Array.from(fac.subjects),
        totalMasterSlots,
        totalPostedSlots,
        totalPendingSlots,
        postingRatePct,
        slots,
        dayBreakdown,
        allSessions,
      });
    }

    return rows;
  }, [rawData, detectedSlots, selectedDate, selectedBranchId, selectedSection]);

  // Filter & Search rows
  const filteredRows = useMemo(() => {
    return facultyRows.filter((r) => {
      // 1. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = r.facultyName.toLowerCase().includes(q);
        const matchHrms = r.hrmsId.toLowerCase().includes(q);
        const matchDept = r.department.toLowerCase().includes(q);
        const matchSub = r.subjects.some((s) => s.toLowerCase().includes(q));
        if (!matchName && !matchHrms && !matchDept && !matchSub) return false;
      }

      // 2. Status filter
      if (postingFilter === "posted") {
        return r.totalMasterSlots > 0 && r.totalPendingSlots === 0;
      }
      if (postingFilter === "pending") {
        return r.totalPendingSlots > 0;
      }
      if (postingFilter === "none") {
        return r.totalMasterSlots > 0 && r.totalPostedSlots === 0;
      }

      return true;
    });
  }, [facultyRows, searchQuery, postingFilter]);

  // Sort rows
  const sortedRows = useMemo(() => {
    const list = [...filteredRows];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") {
        cmp = a.facultyName.localeCompare(b.facultyName);
      } else if (sortField === "slots") {
        cmp = a.totalMasterSlots - b.totalMasterSlots;
      } else if (sortField === "posted") {
        cmp = a.totalPostedSlots - b.totalPostedSlots;
      } else if (sortField === "pending") {
        cmp = a.totalPendingSlots - b.totalPendingSlots;
      } else if (sortField === "rate") {
        cmp = a.postingRatePct - b.postingRatePct;
      }

      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [filteredRows, sortField, sortAsc]);

  // --- Aggregate Stats for Top Cards ---
  const stats = useMemo(() => {
    let totalFaculty = facultyRows.length;
    let totalSlots = 0;
    let totalPosted = 0;
    let totalPending = 0;
    let fullyPostedCount = 0;
    let defaulterCount = 0;

    for (const r of facultyRows) {
      totalSlots += r.totalMasterSlots;
      totalPosted += r.totalPostedSlots;
      totalPending += r.totalPendingSlots;
      if (r.totalMasterSlots > 0 && r.totalPendingSlots === 0) {
        fullyPostedCount++;
      }
      if (r.totalMasterSlots > 0 && r.totalPostedSlots === 0) {
        defaulterCount++;
      }
    }

    const overallRate = totalSlots > 0 ? Math.round((totalPosted / totalSlots) * 100) : 0;

    return {
      totalFaculty,
      totalSlots,
      totalPosted,
      totalPending,
      overallRate,
      fullyPostedCount,
      defaulterCount,
    };
  }, [facultyRows]);

  // Merged Period Slots for Audit Modal (merging parallel sections and lab splits into unified period slots)
  const mergedAuditSlots = useMemo<MergedPeriodSlotAudit[]>(() => {
    if (!activeFacultyModal) return [];

    const map = new Map<string, MergedPeriodSlotAudit>();

    for (const s of activeFacultyModal.allSessions) {
      const key = `${s.date}__${s.slotLabel}`;
      let item = map.get(key);
      if (!item) {
        const orderMatch = (s.slotLabel || "").match(/\d+/);
        const slotOrder = orderMatch ? Number(orderMatch[0]) : 99;
        item = {
          key,
          date: s.date,
          slotLabel: s.slotLabel,
          time: s.time,
          slotOrder,
          subjectCodes: [],
          subjectNames: [],
          branches: [],
          sections: [],
          batches: [],
          isConducted: false,
          isSubstitute: false,
          presentCount: 0,
          absentCount: 0,
          totalTurnout: 0,
          attendancePct: null,
          rawSessionCount: 0,
          sessions: [],
        };
        map.set(key, item);
      }

      item.rawSessionCount++;
      item.sessions.push(s);

      if (s.isConducted) {
        item.isConducted = true;
      }
      if (s.isSubstitute) {
        item.isSubstitute = true;
      }

      if (s.subjectCode && !item.subjectCodes.includes(s.subjectCode)) {
        item.subjectCodes.push(s.subjectCode);
      }
      if (s.subjectName && !item.subjectNames.includes(s.subjectName)) {
        item.subjectNames.push(s.subjectName);
      }

      const br = s.branchCode || s.branchName;
      if (br && !item.branches.includes(br)) {
        item.branches.push(br);
      }

      const rawSec = s.sectionName ? String(s.sectionName).trim() : "A";
      const cleanSec = rawSec.replace(/^(?:(?:SECTION|SEC)[\s.:_-]*)+/i, "") || "A";
      const secLabel = `Sec ${cleanSec}`;
      if (!item.sections.includes(secLabel)) {
        item.sections.push(secLabel);
      }

      if (s.batch && !item.batches.includes(s.batch)) {
        item.batches.push(s.batch);
      }

      // Add turnout counts
      item.presentCount += s.presentCount || 0;
      item.absentCount += s.absentCount || 0;
    }

    const list = Array.from(map.values());
    for (const item of list) {
      item.totalTurnout = item.presentCount + item.absentCount;
      item.attendancePct =
        item.totalTurnout > 0
          ? Math.round((item.presentCount / item.totalTurnout) * 100)
          : null;
    }

    // Sort by date DESC, then slotOrder ASC
    list.sort((a, b) => b.date.localeCompare(a.date) || a.slotOrder - b.slotOrder);
    return list;
  }, [activeFacultyModal]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // --- Export to Excel ---
  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const collegeName =
        selectedCollegeId === "all"
          ? "All Colleges"
          : masters?.colleges?.find((c) => c.id === selectedCollegeId)?.name || "College";

      const courseName =
        selectedCourseId === "all"
          ? "All Courses"
          : masters?.courses?.find((c) => c.id === selectedCourseId)?.name || "Course";

      const branchName =
        selectedBranchId === "all"
          ? "All Branches"
          : masters?.branches?.find((b) => b.id === selectedBranchId)?.name || "Branch";

      const sectionLabel =
        selectedSection === "all"
          ? "All Sections"
          : selectedSection.startsWith("Section")
            ? selectedSection
            : `Section ${selectedSection}`;

      const dateLabel = selectedDate;

      // Build header rows
      const headerRows: ExcelRow[] = [
        {
          cells: [
            {
              value: "STAFF TIMETABLE SLOTS & ATTENDANCE POSTING AUDIT REPORT",
              styleId: "reportTitle",
              mergeAcross: 4 + detectedSlots.length,
            },
          ],
        },
        {
          cells: [
            {
              value: `College: ${collegeName} | Course: ${courseName} | Branch: ${branchName} | Section: ${sectionLabel} | Date: ${selectedDate} (${formatDateDisplay(selectedDate)})`,
              styleId: "sectionHeader",
              mergeAcross: 4 + detectedSlots.length,
            },
          ],
        },
        { cells: [] },
      ];

      // Table Header Row
      const tableHeaders: string[] = [
        "S.No",
        "Faculty Name",
        "HRMS ID",
        "Department",
        "Master Slots Count",
        ...detectedSlots.map((s) => `${s.label} (${s.time})`),
        "Posted (Yes)",
        "Pending (No)",
        "Posting Rate %",
      ];

      const dataRows: ExcelRow[] = sortedRows.map((r, idx) => {
        const slotValues = detectedSlots.map((s) => {
          const slotData = r.slots[s.label];
          if (!slotData || slotData.assignedCount === 0) return "—";
          if (slotData.status === "YES") {
            const sub = slotData.sessions[0]?.subjectCode || "";
            const sec = slotData.sessions[0]?.sectionName || "";
            return `YES${sub ? ` (${sub}${sec ? `-${sec}` : ""})` : ""}`;
          }
          if (slotData.status === "NO") {
            const sub = slotData.sessions[0]?.subjectCode || "";
            const sec = slotData.sessions[0]?.sectionName || "";
            return `NO (Pending)${sub ? ` [${sub}${sec ? `-${sec}` : ""}]` : ""}`;
          }
          return `PARTIAL (${slotData.postedCount} Yes / ${slotData.pendingCount} No)`;
        });

        return {
          cells: [
            idx + 1,
            r.facultyName,
            r.hrmsId,
            r.department,
            r.totalMasterSlots,
            ...slotValues,
            r.totalPostedSlots,
            r.totalPendingSlots,
            `${r.postingRatePct}%`,
          ],
        };
      });

      const worksheet: ExcelWorksheet = {
        name: "Staff Slot Analytics",
        rows: [
          ...headerRows,
          {
            cells: tableHeaders.map((h) => ({
              value: h,
              styleId: "tableHeader",
            })),
          },
          ...dataRows,
        ],
      };

      downloadExcelWorkbook(
        {
          author: "Pydah Academic Portal",
          sheets: [worksheet],
        },
        `Staff_Attendance_Slot_Report_${dateLabel}.xls`,
      );
    } catch (err) {
      console.error("Excel export error:", err);
      alert("Failed to export Excel report.");
    } finally {
      setExportingExcel(false);
    }
  };

  // --- Print / PDF Report ---
  const handlePrintPdf = () => {
    setExportingPdf(true);
    try {
      const collegeName =
        selectedCollegeId === "all"
          ? "All Colleges"
          : masters?.colleges?.find((c) => c.id === selectedCollegeId)?.name || "College";

      const courseName =
        selectedCourseId === "all"
          ? "All Courses"
          : masters?.courses?.find((c) => c.id === selectedCourseId)?.name || "Course";

      const branchName =
        selectedBranchId === "all"
          ? "All Branches"
          : masters?.branches?.find((b) => b.id === selectedBranchId)?.name || "Branch";

      const sectionLabel =
        selectedSection === "all"
          ? "All Sections"
          : selectedSection.startsWith("Section")
            ? selectedSection
            : `Section ${selectedSection}`;

      const slotHeaderThs = detectedSlots
        .map(
          (s) =>
            `<th style="padding: 6px 8px; border: 1px solid #cbd5e1; background: #f1f5f9; text-align: center; font-size: 11px;">
              ${escapeHtml(s.label)}<br/>
              <span style="font-size: 9px; font-weight: normal; color: #64748b;">${escapeHtml(s.time)}</span>
            </th>`,
        )
        .join("");

      const bodyRows = sortedRows
        .map((r, idx) => {
          const slotTds = detectedSlots
            .map((s) => {
              const slotData = r.slots[s.label];
              if (!slotData || slotData.assignedCount === 0) {
                return `<td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; color: #94a3b8; font-size: 11px;">—</td>`;
              }
              if (slotData.status === "YES") {
                const sub = slotData.sessions[0]?.subjectCode || "";
                return `<td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; background: #ecfdf5; color: #047857; font-weight: bold; font-size: 11px;">
                  YES${sub ? `<br/><span style="font-size: 9px; font-weight: normal; color: #065f46;">${escapeHtml(sub)}</span>` : ""}
                </td>`;
              }
              if (slotData.status === "NO") {
                const sub = slotData.sessions[0]?.subjectCode || "";
                return `<td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; background: #fff1f2; color: #b91c1c; font-weight: bold; font-size: 11px;">
                  NO${sub ? `<br/><span style="font-size: 9px; font-weight: normal; color: #991b1b;">${escapeHtml(sub)}</span>` : ""}
                </td>`;
              }
              return `<td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; background: #fffbeb; color: #b45309; font-weight: bold; font-size: 10px;">
                ${slotData.postedCount}Y / ${slotData.pendingCount}N
              </td>`;
            })
            .join("");

          return `
            <tr>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px;">${idx + 1}</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 600; font-size: 12px;">
                ${escapeHtml(r.facultyName)}<br/>
                <span style="font-size: 10px; color: #64748b; font-family: monospace;">#${escapeHtml(r.hrmsId)} &bull; ${escapeHtml(r.department)}</span>
              </td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: 600; font-size: 12px;">${r.totalMasterSlots}</td>
              ${slotTds}
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #047857; font-size: 12px;">${r.totalPostedSlots}</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: ${r.totalPendingSlots > 0 ? "#b91c1c" : "#64748b"}; font-size: 12px;">${r.totalPendingSlots}</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700; font-size: 12px;">${r.postingRatePct}%</td>
            </tr>
          `;
        })
        .join("");

      const html = `
        <div style="font-family: Arial, sans-serif; color: #0f172a; padding: 20px;">
          <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px;">
            <div style="font-size: 18px; font-weight: 900; text-transform: uppercase; color: #0f172a;">
              Pydah Educational Academy &bull; Staff Timetable & Attendance Posting Audit
            </div>
            <div style="font-size: 12px; color: #475569; margin-top: 4px;">
              <strong>College:</strong> ${escapeHtml(collegeName)} &nbsp;|&nbsp; 
              <strong>Course:</strong> ${escapeHtml(courseName)} &nbsp;|&nbsp; 
              <strong>Branch:</strong> ${escapeHtml(branchName)} &nbsp;|&nbsp; 
              <strong>Section:</strong> ${escapeHtml(sectionLabel)} &nbsp;|&nbsp; 
              <strong>Date:</strong> ${escapeHtml(selectedDate)} (${escapeHtml(formatDateDisplay(selectedDate))})
            </div>
          </div>

          <div style="display: flex; gap: 16px; margin-bottom: 16px; font-size: 12px;">
            <div style="padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; background: #f8fafc;">
              <strong>Total Faculty:</strong> ${stats.totalFaculty}
            </div>
            <div style="padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; background: #f8fafc;">
              <strong>Master Slots:</strong> ${stats.totalSlots}
            </div>
            <div style="padding: 8px 12px; border: 1px solid #bbf7d0; border-radius: 6px; background: #f0fdf4; color: #166534;">
              <strong>Attendance Posted (Yes):</strong> ${stats.totalPosted}
            </div>
            <div style="padding: 8px 12px; border: 1px solid #fecdd3; border-radius: 6px; background: #fff1f2; color: #991b1b;">
              <strong>Pending (No):</strong> ${stats.totalPending}
            </div>
            <div style="padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; background: #f8fafc;">
              <strong>Overall Compliance:</strong> ${stats.overallRate}%
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <thead>
              <tr style="background: #e2e8f0; font-size: 11px; text-transform: uppercase;">
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1;">#</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: left;">Faculty Name &amp; Dept</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">Master Slots</th>
                ${slotHeaderThs}
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; color: #047857;">Posted (Yes)</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; color: #b91c1c;">Pending (No)</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">Posting %</th>
              </tr>
            </thead>
            <tbody>
              ${bodyRows}
            </tbody>
          </table>

          <div style="margin-top: 24px; font-size: 10px; color: #94a3b8; text-align: right;">
            Report generated on ${new Date().toLocaleString()} &bull; Pydah Academic Portal
          </div>
        </div>
      `;

      printHtml(html, {
        title: "Staff Timetable Slots & Attendance Audit Report",
        hideHeader: true,
      });
    } catch (err) {
      console.error("PDF Print error:", err);
      alert("Failed to print PDF report.");
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. TOP HEADER & FILTER BAR */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-navy-900 to-indigo-900 text-white shadow-md">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight text-navy-950">
                  Staff Analytics &amp; Master Slot Attendance Audit
                </h1>
                <p className="text-xs text-slate-500">
                  Faculty master timetable slots tracking &bull; Slot-by-slot attendance posting verification (Yes / No)
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons: Excel, PDF, Refresh */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exportingExcel || loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 px-3.5 py-2 text-xs font-bold text-emerald-800 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
              title="Download Staff Slot Matrix report to Excel (.xls)"
            >
              {exportingExcel ? (
                <Loader2 className="h-4 w-4 animate-spin text-emerald-700" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
              )}
              <span>Export Staff Excel</span>
            </button>

            <button
              type="button"
              onClick={handlePrintPdf}
              disabled={exportingPdf || loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 px-3.5 py-2 text-xs font-bold text-rose-800 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
              title="Download or Print Verified Staff Workload & Attendance PDF"
            >
              {exportingPdf ? (
                <Loader2 className="h-4 w-4 animate-spin text-rose-700" />
              ) : (
                <FileText className="h-4 w-4 text-rose-700" />
              )}
              <span>Print Staff PDF</span>
            </button>

            <button
              type="button"
              onClick={fetchReportData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCw className={cn("h-4 w-4 text-slate-600", loading && "animate-spin text-indigo-600")} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Top Dropdowns & Date Selector Bar */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {/* 1. College Dropdown */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-indigo-600" />
              <span>Select College</span>
            </label>
            <select
              value={selectedCollegeId}
              onChange={(e) =>
                handleCollegeChange(
                  e.target.value === "all" ? "all" : Number(e.target.value),
                )
              }
              className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-navy-950 focus:border-indigo-500 focus:bg-white focus:outline-hidden transition-all shadow-2xs cursor-pointer"
            >
              <option value="all">All Colleges</option>
              {masters?.colleges?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.code ? `(${c.code})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Course / Degree Dropdown */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <GraduationCap className="h-3.5 w-3.5 text-indigo-600" />
              <span>Select Course / Degree</span>
            </label>
            <select
              value={selectedCourseId}
              onChange={(e) =>
                handleCourseChange(
                  e.target.value === "all" ? "all" : Number(e.target.value),
                )
              }
              className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-navy-950 focus:border-indigo-500 focus:bg-white focus:outline-hidden transition-all shadow-2xs cursor-pointer"
            >
              <option value="all">All Courses</option>
              {availableCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.code ? `(${c.code})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Branch Dropdown */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-indigo-600" />
              <span>Select Branch</span>
            </label>
            <select
              value={selectedBranchId}
              onChange={(e) =>
                handleBranchChange(
                  e.target.value === "all" ? "all" : Number(e.target.value),
                )
              }
              className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-navy-950 focus:border-indigo-500 focus:bg-white focus:outline-hidden transition-all shadow-2xs cursor-pointer"
            >
              <option value="all">All Branches</option>
              {availableBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.code ? `(${b.code})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Section Dropdown */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-indigo-600" />
              <span>Select Section</span>
            </label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-navy-950 focus:border-indigo-500 focus:bg-white focus:outline-hidden transition-all shadow-2xs cursor-pointer"
            >
              <option value="all">All Sections</option>
              {availableSections.map((sec) => (
                <option key={sec} value={sec}>
                  {sec.startsWith("Section") ? sec : `Section ${sec}`}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Single Date Selection */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-indigo-600" />
              <span>Select Date</span>
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) setSelectedDate(e.target.value);
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-navy-950 focus:border-indigo-500 focus:outline-hidden transition-all shadow-2xs cursor-pointer"
            />
          </div>

          {/* 6. Quick Date Navigation */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-indigo-600" />
              <span>Date Navigation</span>
            </label>
            <div className="flex items-center gap-1 flex-wrap pt-0.5">
              <button
                type="button"
                onClick={() => handleShiftDay(-1)}
                className="inline-flex items-center gap-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 px-2 py-1.5 text-[11px] font-bold text-slate-700 transition-all shadow-2xs cursor-pointer"
                title="Previous Day"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Prev</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(getTodayIso())}
                className={cn(
                  "rounded-lg px-2 py-1.5 text-[11px] font-bold transition-all shadow-2xs cursor-pointer",
                  selectedDate === getTodayIso()
                    ? "bg-navy-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                )}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(getYesterdayIso())}
                className={cn(
                  "rounded-lg px-2 py-1.5 text-[11px] font-bold transition-all shadow-2xs cursor-pointer",
                  selectedDate === getYesterdayIso()
                    ? "bg-navy-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                )}
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => handleShiftDay(1)}
                className="inline-flex items-center gap-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 px-2 py-1.5 text-[11px] font-bold text-slate-700 transition-all shadow-2xs cursor-pointer"
                title="Next Day"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SUMMARY KPI OVERVIEW CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Active Faculty */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Faculty Staff
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-navy-950">{stats.totalFaculty}</span>
            <span className="text-[11px] font-semibold text-slate-500">Members</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Across selected academic scope
          </div>
        </div>

        {/* Card 2: Master Timetable Slots */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Master Slots
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <CalendarDays className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-navy-950">{stats.totalSlots}</span>
            <span className="text-[11px] font-semibold text-blue-700">Scheduled</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Assigned from master timetable
          </div>
        </div>

        {/* Card 3: Attendance Posted (YES) */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
              Posted (Yes)
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-900">{stats.totalPosted}</span>
            <span className="text-[11px] font-bold text-emerald-700">Slots Verified</span>
          </div>
          <div className="mt-1 text-[11px] text-emerald-700">
            Attendance submitted &amp; held
          </div>
        </div>

        {/* Card 4: Attendance Pending (NO) */}
        <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">
              Pending (No)
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 text-rose-800">
              <XCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-900">{stats.totalPending}</span>
            <span className="text-[11px] font-bold text-rose-700">Unposted Slots</span>
          </div>
          <div className="mt-1 text-[11px] text-rose-700">
            {stats.defaulterCount} staff with 0 postings
          </div>
        </div>

        {/* Card 5: Overall Posting Rate % */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Posting Compliance
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <CheckCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={cn(
                "text-2xl font-black",
                stats.overallRate >= 80
                  ? "text-emerald-700"
                  : stats.overallRate >= 50
                    ? "text-amber-700"
                    : "text-rose-700",
              )}
            >
              {stats.overallRate}%
            </span>
            <span className="text-[11px] font-bold text-slate-500">Compliance</span>
          </div>
          {/* Visual progress bar */}
          <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                stats.overallRate >= 80
                  ? "bg-emerald-500"
                  : stats.overallRate >= 50
                    ? "bg-amber-500"
                    : "bg-rose-500",
              )}
              style={{ width: `${Math.min(100, Math.max(0, stats.overallRate))}%` }}
            />
          </div>
        </div>
      </div>

      {/* 3. SECONDARY CONTROLS & STATUS FILTER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search Faculty */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search faculty name or HRMS ID..."
            className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs font-medium text-navy-950 placeholder-slate-400 focus:border-indigo-500 focus:outline-hidden transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Quick Filter Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1">
          <button
            type="button"
            onClick={() => setPostingFilter("all")}
            className={cn(
              "rounded-lg px-3 py-1.5 font-bold transition-all shadow-2xs cursor-pointer",
              postingFilter === "all"
                ? "bg-navy-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200",
            )}
          >
            All Staff ({facultyRows.length})
          </button>
          <button
            type="button"
            onClick={() => setPostingFilter("posted")}
            className={cn(
              "rounded-lg px-3 py-1.5 font-bold transition-all shadow-2xs cursor-pointer inline-flex items-center gap-1",
              postingFilter === "posted"
                ? "bg-emerald-700 text-white shadow-xs"
                : "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100",
            )}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>100% Posted ({stats.fullyPostedCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setPostingFilter("pending")}
            className={cn(
              "rounded-lg px-3 py-1.5 font-bold transition-all shadow-2xs cursor-pointer inline-flex items-center gap-1",
              postingFilter === "pending"
                ? "bg-rose-700 text-white shadow-xs"
                : "bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100",
            )}
          >
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Pending Attendance ({facultyRows.filter((r) => r.totalPendingSlots > 0).length})</span>
          </button>
          <button
            type="button"
            onClick={() => setPostingFilter("none")}
            className={cn(
              "rounded-lg px-3 py-1.5 font-bold transition-all shadow-2xs cursor-pointer inline-flex items-center gap-1",
              postingFilter === "none"
                ? "bg-red-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200",
            )}
          >
            <span>0% Posted ({stats.defaulterCount})</span>
          </button>
        </div>
      </div>

      {/* 5. TABULAR FORMAT TABLE - MASTER TIME TABLE SLOTS WISE */}
      <div
        id="staff-slot-analytics-container"
        ref={printAreaRef}
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        {/* Table Banner Header */}
        <div className="border-b border-slate-200 bg-linear-to-r from-slate-50 via-indigo-50/20 to-slate-50 px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-900 text-white font-black text-xs shadow-2xs">
              TT
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-extrabold text-navy-950">
                  Faculty Time Table Slots Attendance Matrix
                </h2>
                <span className="rounded-md bg-indigo-100 text-indigo-900 px-2 py-0.5 text-[10px] font-extrabold border border-indigo-200">
                  {formatDateDisplay(selectedDate)}
                </span>
                {selectedBranchId !== "all" && (
                  <span className="rounded-md bg-blue-100 text-blue-900 px-2 py-0.5 text-[10px] font-extrabold border border-blue-200">
                    {masters?.branches?.find((b) => b.id === selectedBranchId)?.code || "Branch"}
                  </span>
                )}
                {selectedSection !== "all" && (
                  <span className="rounded-md bg-purple-100 text-purple-900 px-2 py-0.5 text-[10px] font-extrabold border border-purple-200">
                    {selectedSection.startsWith("Section") ? selectedSection : `Sec ${selectedSection}`}
                  </span>
                )}
                <span className="rounded-md bg-slate-200/80 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                  {sortedRows.length} Faculty
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Master time table slot counts &bull; Attendance posting verification (Yes = Posted, No = Pending)
              </p>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-2.5 text-[11px] font-semibold flex-wrap">
            <div className="flex items-center gap-1 text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              <Check className="h-3 w-3 text-emerald-600 stroke-[3]" />
              <span>Yes (Attendance Posted)</span>
            </div>
            <div className="flex items-center gap-1 text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
              <X className="h-3 w-3 text-rose-600 stroke-[3]" />
              <span>No (Pending Attendance)</span>
            </div>
            <div className="flex items-center gap-1 text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              <span>— Free Slot</span>
            </div>
          </div>
        </div>

        {/* The Matrix Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-200/80 text-[10px] font-black uppercase tracking-wider text-slate-700">
                <th colSpan={3} className="py-2 px-3 text-left">
                  FACULTY INFORMATION
                </th>
                <th
                  colSpan={detectedSlots.length}
                  className="py-2 px-3 text-center border-l border-r border-slate-300 bg-indigo-50/70 text-indigo-950 font-black"
                >
                  MASTER TIMETABLE PERIOD SLOTS &bull; ATTENDANCE POSTING VERIFICATION
                </th>
                <th colSpan={3} className="py-2 px-2 text-center border-r border-slate-300">
                  SUMMARY &amp; COMPLIANCE
                </th>
                <th className="py-2 px-3 text-right">ACTION</th>
              </tr>
              <tr className="border-b border-slate-200 bg-slate-100/90 text-[10px] font-extrabold uppercase tracking-wider text-slate-800">
                <th className="py-3 px-3 w-12 text-center">#</th>
                <th
                  onClick={() => handleSort("name")}
                  className="py-3 px-3 min-w-[220px] cursor-pointer hover:bg-slate-200/70 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Faculty Name &amp; Dept</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("slots")}
                  className="py-3 px-2 text-center min-w-[90px] cursor-pointer hover:bg-slate-200/70 transition-colors"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Master Slots</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </div>
                </th>

                {/* Master Time Table Slot Columns (P1, P2, P3, ... P7) */}
                {detectedSlots.map((slot) => (
                  <th
                    key={slot.label}
                    className="py-2.5 px-2 text-center min-w-[110px] border-l border-slate-200/80 bg-slate-100/60"
                  >
                    <div className="font-extrabold text-navy-950 text-xs">{slot.label}</div>
                    <div className="text-[9px] font-semibold text-slate-500 tracking-tight">
                      {slot.time || "Period"}
                    </div>
                  </th>
                ))}

                <th
                  onClick={() => handleSort("posted")}
                  className="py-3 px-2 text-center min-w-[85px] border-l border-slate-200 text-emerald-800 cursor-pointer hover:bg-emerald-50 transition-colors"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Posted (Yes)</span>
                    <ArrowUpDown className="h-3 w-3 text-emerald-600" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("pending")}
                  className="py-3 px-2 text-center min-w-[85px] text-rose-800 cursor-pointer hover:bg-rose-50 transition-colors"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Pending (No)</span>
                    <ArrowUpDown className="h-3 w-3 text-rose-600" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("rate")}
                  className="py-3 px-2 text-center min-w-[95px] cursor-pointer hover:bg-slate-200/70 transition-colors"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Posting %</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-3 text-right w-20">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={detectedSlots.length + 6}
                    className="py-16 text-center text-slate-500"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
                      <span className="text-xs font-bold text-slate-600">
                        Loading faculty master timetable slots and attendance records...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : sortedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={detectedSlots.length + 6}
                    className="py-16 text-center text-slate-500"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="h-8 w-8 text-slate-300" />
                      <p className="font-bold text-slate-700 text-sm">
                        No faculty records found for the selected scope.
                      </p>
                      <p className="text-xs text-slate-400">
                        Try adjusting the college, course, date range, or clear the search filter.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedRows.map((row, idx) => {
                  return (
                    <Fragment key={row.hrmsId || idx}>
                      <tr className="hover:bg-indigo-50/30 transition-colors group">
                        {/* S.No */}
                        <td className="py-3 px-3 text-center text-[11px] font-bold text-slate-500">
                          {idx + 1}
                        </td>

                        {/* Faculty Name & Department */}
                        <td className="py-3 px-3">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-navy-950 text-xs group-hover:text-indigo-900 transition-colors">
                                {row.facultyName}
                              </span>
                              {row.hrmsId && row.hrmsId !== "N/A" && (
                                <span className="font-mono text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                  #{row.hrmsId}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                              {row.department}
                            </div>
                            {row.subjects.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {row.subjects.slice(0, 2).map((sub, sIdx) => (
                                  <span
                                    key={sIdx}
                                    className="inline-block rounded bg-slate-100 px-1.5 py-0.2 text-[9px] font-semibold text-slate-600 border border-slate-200/60"
                                  >
                                    {sub}
                                  </span>
                                ))}
                                {row.subjects.length > 2 && (
                                  <span className="text-[9px] font-bold text-slate-400">
                                    +{row.subjects.length - 2} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Master Slots Count */}
                        <td className="py-3 px-2 text-center">
                          <span className="inline-block rounded-lg bg-slate-100 border border-slate-200 px-2 py-1 text-xs font-black text-navy-950">
                            {row.totalMasterSlots}
                          </span>
                        </td>

                        {/* Time Table Slots (P1, P2, P3, ... P7) */}
                        {detectedSlots.map((slot) => {
                          const slotSummary = row.slots[slot.label];
                          const hasAssignment = slotSummary && slotSummary.assignedCount > 0;

                          if (!hasAssignment) {
                            return (
                              <td
                                key={slot.label}
                                className="py-3 px-2 text-center border-l border-slate-100 text-slate-300 font-bold"
                              >
                                —
                              </td>
                            );
                          }

                          // Slot period attendance status on selectedDate
                          const isPosted = slotSummary.postedCount > 0;
                          const conductedSess = slotSummary.sessions.find((s) => s.isConducted);
                          const displaySess = conductedSess || slotSummary.sessions[0];

                          return (
                            <td
                              key={slot.label}
                              onClick={() => setActiveFacultyModal(row)}
                              className={cn(
                                "py-2.5 px-2 text-center border-l border-slate-100 cursor-pointer transition-all hover:scale-102",
                                isPosted
                                  ? "bg-emerald-50/70 hover:bg-emerald-100/80"
                                  : "bg-rose-50/70 hover:bg-rose-100/80",
                              )}
                              title={
                                isPosted
                                  ? `YES: Attendance Posted for ${displaySess?.subjectName || "Subject"} (${displaySess?.sectionName || ""})`
                                  : `NO: Pending Attendance for ${displaySess?.subjectName || "Subject"} (${displaySess?.sectionName || ""})`
                              }
                            >
                              <div className="flex flex-col items-center justify-center gap-0.5">
                                {isPosted ? (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-600 text-white px-2 py-0.5 text-[10px] font-black shadow-2xs">
                                    <Check className="h-3 w-3 stroke-[3]" />
                                    <span>Yes</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-rose-600 text-white px-2 py-0.5 text-[10px] font-black shadow-2xs">
                                    <X className="h-3 w-3 stroke-[3]" />
                                    <span>No</span>
                                  </span>
                                )}

                                {displaySess && (
                                  <div className="text-[9px] font-bold text-slate-700 truncate max-w-[95px] mt-0.5">
                                    {displaySess.subjectCode || displaySess.subjectName}
                                    {displaySess.sectionName && ` (${displaySess.sectionName})`}
                                  </div>
                                )}

                                {isPosted && displaySess?.attendancePct != null && (
                                  <div className="text-[8.5px] font-semibold text-emerald-800">
                                    {displaySess.presentCount}/{displaySess.presentCount + displaySess.absentCount} ({displaySess.attendancePct}%)
                                  </div>
                                )}
                                {!isPosted && (
                                  <div className="text-[8.5px] font-bold text-rose-700">
                                    Pending
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}

                        {/* Posted Count (Yes) */}
                        <td className="py-3 px-2 text-center border-l border-slate-200">
                          <span className="inline-block rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 text-xs font-black">
                            {row.totalPostedSlots}
                          </span>
                        </td>

                        {/* Pending Count (No) */}
                        <td className="py-3 px-2 text-center">
                          <span
                            className={cn(
                              "inline-block rounded-md px-2 py-0.5 text-xs font-black",
                              row.totalPendingSlots > 0
                                ? "bg-rose-100 text-rose-900 border border-rose-300"
                                : "bg-slate-100 text-slate-500 border border-slate-200",
                            )}
                          >
                            {row.totalPendingSlots}
                          </span>
                        </td>

                        {/* Posting % */}
                        <td className="py-3 px-2 text-center">
                          <div className="flex flex-col items-center">
                            <span
                              className={cn(
                                "font-extrabold text-xs",
                                row.postingRatePct >= 80
                                  ? "text-emerald-700"
                                  : row.postingRatePct >= 50
                                    ? "text-amber-700"
                                    : "text-rose-700",
                              )}
                            >
                              {row.postingRatePct}%
                            </span>
                            <div className="mt-1 h-1 w-12 rounded-full bg-slate-200 overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full",
                                  row.postingRatePct >= 80
                                    ? "bg-emerald-500"
                                    : row.postingRatePct >= 50
                                      ? "bg-amber-500"
                                      : "bg-rose-500",
                                )}
                                style={{ width: `${Math.min(100, Math.max(0, row.postingRatePct))}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setActiveFacultyModal(row)}
                            className="inline-flex items-center gap-1 rounded-lg bg-navy-900 hover:bg-navy-800 text-white font-bold text-[10px] px-2.5 py-1.5 shadow-2xs transition-colors cursor-pointer"
                            title={`View ${row.facultyName}'s complete session audit breakdown`}
                          >
                            <Eye className="h-3 w-3" />
                            <span>Audit</span>
                          </button>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. COMPREHENSIVE FACULTY AUDIT MODAL */}
      {activeFacultyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-linear-to-r from-navy-950 to-indigo-950 p-4 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 font-bold text-base">
                  <Users className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-white">
                      {activeFacultyModal.facultyName}
                    </h3>
                    <span className="rounded bg-white/20 px-2 py-0.5 text-xs font-mono font-bold text-white">
                      #{activeFacultyModal.hrmsId}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {activeFacultyModal.department} &bull; Attendance Posting Audit Log
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveFacultyModal(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Metrics Bar */}
            <div className="grid grid-cols-4 gap-3 border-b border-slate-200 bg-slate-50 p-4 text-center">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Master Slots</span>
                <span className="block text-lg font-black text-navy-950">
                  {activeFacultyModal.totalMasterSlots}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-emerald-700 uppercase">Attendance Posted (Yes)</span>
                <span className="block text-lg font-black text-emerald-700">
                  {activeFacultyModal.totalPostedSlots}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-rose-700 uppercase">Pending (No)</span>
                <span className="block text-lg font-black text-rose-700">
                  {activeFacultyModal.totalPendingSlots}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Posting Rate</span>
                <span
                  className={cn(
                    "block text-lg font-black",
                    activeFacultyModal.postingRatePct >= 80
                      ? "text-emerald-700"
                      : "text-amber-700",
                  )}
                >
                  {activeFacultyModal.postingRatePct}%
                </span>
              </div>
            </div>

            {/* Modal Sessions Table */}
            <div className="p-4 overflow-y-auto flex-1">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Session Audit Roster ({mergedAuditSlots.length} Master Slots)
                  </h4>
                  <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                    Period sections and lab splits merged &bull; Period slot centered in table
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                  <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    <Check className="h-3 w-3" />
                    <span>{activeFacultyModal.totalPostedSlots} Posted</span>
                  </span>
                  <span className="flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    <X className="h-3 w-3" />
                    <span>{activeFacultyModal.totalPendingSlots} Pending</span>
                  </span>
                </div>
              </div>

              {mergedAuditSlots.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No session assignments recorded for this period.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200 shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-700">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Subject</th>
                        {/* Period Slot in the MIDDLE of the columns */}
                        <th className="py-2.5 px-3 text-center bg-indigo-50/70 text-indigo-950 font-black border-x border-slate-200">
                          Period Slot
                        </th>
                        <th className="py-2.5 px-3">Section / Branch</th>
                        <th className="py-2.5 px-3 text-center">Attendance Status</th>
                        <th className="py-2.5 px-3 text-center">Turnout</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {mergedAuditSlots.map((s, sIdx) => (
                        <tr key={s.key || sIdx} className="hover:bg-slate-50 transition-colors">
                          {/* 1. Date */}
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            <div>{formatDateDisplay(s.date)}</div>
                            <div className="text-[10px] text-slate-400 font-normal">
                              {new Date(s.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" })}
                            </div>
                          </td>

                          {/* 2. Subject */}
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-navy-950">
                              {s.subjectNames.join(" & ") || "Academic Class"}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {s.subjectCodes.map((code) => (
                                <span
                                  key={code}
                                  className="text-[9px] text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded font-mono font-bold border border-slate-200"
                                >
                                  {code}
                                </span>
                              ))}
                            </div>
                          </td>

                          {/* 3. PERIOD SLOT (IN THE MIDDLE!) */}
                          <td className="py-2.5 px-3 text-center border-x border-slate-100 bg-indigo-50/20">
                            <span className="inline-flex items-center justify-center font-black text-xs px-2.5 py-1 rounded-lg bg-navy-950 text-white shadow-xs">
                              {s.slotLabel}
                            </span>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5 font-semibold">
                              {s.time || "Scheduled"}
                            </div>
                          </td>

                          {/* 4. Section / Branch (Merged Sections) */}
                          <td className="py-2.5 px-3 text-slate-700">
                            <div className="font-bold text-slate-900">
                              {s.branches.join(", ") || "General"}
                            </div>
                            <div className="text-[10px] text-slate-600 font-semibold mt-0.5 flex items-center gap-1.5 flex-wrap">
                              <span>
                                {s.sections.join(", ")}
                                {s.batches.length > 0 && ` (${s.batches.join(", ")})`}
                              </span>
                              {s.sections.length > 1 && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                                  Merged {s.sections.length} Secs
                                </span>
                              )}
                              {s.rawSessionCount > 1 && s.sections.length <= 1 && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-100 text-slate-600 font-bold border border-slate-200">
                                  Parallel Batch
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 5. Attendance Status */}
                          <td className="py-2.5 px-3 text-center">
                            {s.isConducted ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1 text-[10px] font-bold shadow-xs">
                                <Check className="h-3 w-3" />
                                <span>Yes (Posted)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 text-rose-800 border border-rose-200 px-2.5 py-1 text-[10px] font-bold shadow-xs">
                                <X className="h-3 w-3" />
                                <span>No (Pending)</span>
                              </span>
                            )}
                            {s.isSubstitute && (
                              <div className="text-[9px] font-bold text-indigo-700 mt-1">
                                Substituted Class
                              </div>
                            )}
                          </td>

                          {/* 6. Turnout */}
                          <td className="py-2.5 px-3 text-center">
                            {s.isConducted && s.totalTurnout > 0 ? (
                              <div>
                                <span className="font-extrabold text-slate-900 text-xs">
                                  {s.presentCount} / {s.totalTurnout}
                                </span>
                                <span className="block text-[10px] font-semibold text-emerald-700">
                                  ({s.attendancePct}%)
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 font-semibold">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-200 bg-slate-50 p-3 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveFacultyModal(null)}
                className="rounded-xl bg-slate-200 hover:bg-slate-300 px-4 py-2 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
