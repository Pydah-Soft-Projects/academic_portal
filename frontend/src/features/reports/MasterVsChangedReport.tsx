"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAcademicContext } from "@/components/layout/AcademicProvider";
import { apiFetch } from "@/lib/api";
import { escapeHtml, printElement, printHtml } from "@/lib/print-service";
import {
  downloadExcelWorkbook,
  sanitizeSheetName,
  type ExcelWorksheet,
  type ExcelRow,
} from "@/lib/excel-service";
import { cn } from "@/lib/cn";
import {
  RotateCcw,
  Search,
  BookOpen,
  FileSpreadsheet,
  FileText,
  X,
  CalendarCheck,
  UserCheck,
  ArrowRight,
  ArrowLeftRight,
  UserX,
  User,
  Clock,
  Calendar,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Percent,
  Info,
  Users,
  Eye,
  Loader2,
  LayoutGrid,
  Table,
} from "lucide-react";

type KpiModalType = "master" | "conducted" | "changed" | "substituted" | "swapped" | "rate" | null;

type ReportSummary = {
  totalMasterPeriods: number;
  totalMasterPeriodsScheduled?: number;
  totalScheduledSessions: number;
  totalConductedSessions: number;
  totalChangesRecorded: number;
  facultySubstitutionsCount: number;
  subjectSwapsCount: number;
  revertedCount: number;
  overallChangeRatePct: number;
  attendanceAvgPct: number;
};

type SubjectStat = {
  subjectCode: string;
  subjectName: string;
  masterWeeklyPeriods: number;
  totalScheduled?: number;
  totalConducted: number;
  timesChanged: number;
  timesSwappedOut: number;
  timesSwappedIn: number;
  facultyNames: string[];
  assignedFacultyNames?: string[];
  changedFaculties?: Array<{ facultyName: string; originalFacultyName?: string; count: number }>;
  turnoutPct?: number | null;
  attendancePct: number;
  totalPresent?: number;
  totalAbsent?: number;
  totalMarked?: number;
};

type FacultyStat = {
  hrmsId: string;
  facultyName: string;
  masterAssignedPeriods: number;
  classesConducted: number;
  relievedCount: number;
  substituteTakenCount: number;
  netTeachingCount: number;
  subjects: string[];
  totalEnrolled?: number;
  totalPresent?: number;
  totalAbsent?: number;
  totalMarked?: number;
  attendancePct?: number | null;
};

type ComparisonItem = {
  id: number;
  date: string;
  dayOfWeek: string;
  time: string;
  slotLabel: string;
  branchId?: number | null;
  branchName?: string;
  branchCode?: string;
  batch: string;
  sectionName: string | null;
  semester: number;
  masterSubjectCode: string | null;
  masterSubjectName: string | null;
  masterFacultyName: string | null;
  masterFacultyHrmsId: string | null;
  todaySubjectCode: string | null;
  todaySubjectName: string | null;
  todayFacultyName: string | null;
  todayFacultyHrmsId: string | null;
  varianceType: "UNCHANGED" | "FACULTY_SUBSTITUTE" | "SUBJECT_SWAP" | "BOTH";
  isConducted: boolean;
  presentCount: number;
  absentCount: number;
  attendancePct: number | null;
  enrolledCount?: number;
  yearOfStudy?: number;
  students?: Array<{
    studentDbId?: number;
    rollNo: string;
    studentName: string;
    status: "present" | "absent" | "od" | "leave" | "pending";
    remarks?: string | null;
  }>;
};

type MasterPeriodItem = {
  id: number;
  dayOfWeek: string;
  slotLabel: string;
  slotTime: string;
  branchId?: number | null;
  branchName?: string;
  branchCode?: string;
  batch: string;
  semester: number;
  sectionName: string | null;
  subjectCode: string;
  subjectName: string;
  facultyName: string;
  facultyHrmsId: string | null;
  entryType: string;
  customLabel?: string | null;
};

type ChangeEvent = {
  id: number;
  timetableDate: string;
  collegeId: number;
  courseId: number;
  branchId: number;
  branchName?: string;
  branchCode?: string;
  batch: string;
  semester: number;
  sectionName: string | null;
  slotLabel: string;
  slotTime: string;
  masterSubjectCode: string | null;
  masterSubjectName: string | null;
  masterFacultyHrmsId: string | null;
  masterFacultyName: string | null;
  newSubjectCode: string | null;
  newSubjectName: string | null;
  newFacultyHrmsId: string | null;
  newFacultyName: string | null;
  changeType: string;
  remarks: string | null;
  changedByName: string | null;
  createdAt: string;
  varianceType: "FACULTY_SUBSTITUTE" | "SUBJECT_SWAP" | "BOTH" | "REVERTED" | "PERIOD_OVERRIDE";
};

type CatalogClass = {
  key: string;
  label: string;
  collegeId?: number;
  courseId?: number;
  branchId?: number;
  batch: string;
  year: number;
  semester: number;
  sections: string[];
};

type ReportResponse = {
  summary: ReportSummary;
  subjects: SubjectStat[];
  faculties: FacultyStat[];
  recentChanges: ChangeEvent[];
  comparisons?: ComparisonItem[];
  masterScheduledPeriods?: MasterPeriodItem[];
  catalogSubjects?: Array<{ subjectCode: string; subjectName: string }>;
  catalogFaculties?: Array<{ hrmsId: string; facultyName: string }>;
  catalogClasses?: CatalogClass[];
  sectionStrengths?: Record<string, number>;
};

function cleanSectionCode(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  const stripped = trimmed.replace(/^(?:(?:section|sec)[\s.:_-]*)+/i, "").trim();
  return (stripped || trimmed).toUpperCase();
}

function formatSessionClassInfo(
  s: {
    branchCode?: string | null;
    branchName?: string | null;
    sectionName?: string | null;
    batch?: string | null;
    semester?: number | null;
    yearOfStudy?: number | null;
    todaySubjectCode?: string | null;
    masterSubjectCode?: string | null;
  },
  html = true,
): string {
  let bCode = (s.branchCode || s.branchName || "").trim();
  if (!bCode) {
    const sub = (s.todaySubjectCode || s.masterSubjectCode || "").trim();
    const m = sub.match(/^[0-9]{2}([A-Za-z]{2,5})[0-9]/);
    if (m) bCode = m[1].toUpperCase();
  }
  const cleanSec = s.sectionName ? `Sec ${cleanSectionCode(s.sectionName)}` : "All";
  const batchStr = s.batch ? `Batch ${s.batch}` : "";
  const semStr = s.semester ? `(Sem ${s.semester})` : s.yearOfStudy ? `(Yr ${s.yearOfStudy})` : "";

  const bullet = html ? "&bull;" : "·";
  const parts: string[] = [];
  if (bCode) parts.push(bCode);
  parts.push(cleanSec);
  if (batchStr) parts.push(batchStr);
  if (semStr) parts.push(semStr);
  return parts.join(` ${bullet} `);
}

function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    }
  }
  return dateStr;
}

export type MasterReportSection = "variation" | "subjects" | "staff" | "audit";

export interface MasterVsChangedReportProps {
  activeSection?: MasterReportSection;
  onNavigateSection?: (section: MasterReportSection) => void;
}

export function MasterVsChangedReport({
  activeSection = "variation",
}: MasterVsChangedReportProps) {
  const { masters } = useAcademicContext();
  const [academicYear, setAcademicYear] = useState("");
  const [selectedCollege, setSelectedCollege] = useState<number | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [selectedClassKey, setSelectedClassKey] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);
  const [selectedStaffHrmsId, setSelectedStaffHrmsId] = useState<string | null>(null);
  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string | null>(null);

  // Subject Analysis display mode: "section-wise" (Class & Section wise) or "consolidated"
  const [subjectViewMode, setSubjectViewMode] = useState<"section-wise" | "consolidated">("section-wise");

  // Staff Analytics display mode: "table" (Vertical Roster Table - Default) or "cards" (Cards Grid)
  const [staffViewMode, setStaffViewMode] = useState<"cards" | "table">("table");
  // Staff Analytics quick filter tab: "all", "substitutes", "relieved", "variance"
  const [staffFilterTab, setStaffFilterTab] = useState<"all" | "substitutes" | "relieved" | "variance">("all");

  // Pop-up modal state for Staff Profile & Action Log
  const [activeStaffModal, setActiveStaffModal] = useState<FacultyStat | null>(null);
  const [staffModalSearch, setStaffModalSearch] = useState("");

  // Pop-up modal state for Subject Delivery & Alteration Action Log
  const [activeSubjectModal, setActiveSubjectModal] = useState<(SubjectStat & {
    cohortTitle?: string;
    branchCode?: string;
    batch?: string;
    sectionLetter?: string;
  }) | null>(null);
  const [subjectModalSearch, setSubjectModalSearch] = useState("");

  // Dedicated sessions loaded for active faculty/subject modal or on-demand export
  const [dedicatedStaffSessions, setDedicatedStaffSessions] = useState<ComparisonItem[] | null>(null);
  const [dedicatedSubjectSessions, setDedicatedSubjectSessions] = useState<ComparisonItem[] | null>(null);
  const [loadingDedicatedSessions, setLoadingDedicatedSessions] = useState(false);

  // Key tracking async PDF/Excel generation for specific items
  const [generatingPdfKey, setGeneratingPdfKey] = useState<string | null>(null);
  const [generatingExcelKey, setGeneratingExcelKey] = useState<string | null>(null);

  // Date mode: "today" or "range"
  const [dateMode, setDateMode] = useState<"today" | "range">("today");
  const [startDate, setStartDate] = useState(getTodayDateString());
  const [endDate, setEndDate] = useState(getTodayDateString());
  const [searchQuery, setSearchQuery] = useState("");

  // Interactive KPI Pop Card / Drawer State
  const [activeKpiDrawer, setActiveKpiDrawer] = useState<KpiModalType>(null);
  const [drawerSearch, setDrawerSearch] = useState("");

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReportResponse | null>(null);
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Close drawer & modals on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveKpiDrawer(null);
        setActiveStaffModal(null);
        setActiveSubjectModal(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Initialize active academic year
  useEffect(() => {
    if (masters && !academicYear) {
      const currentYear =
        masters.defaults.academicYear ||
        masters.academicYears.find((item) => item.isActive)?.label ||
        masters.academicYears[0]?.label;
      if (currentYear) setAcademicYear(currentYear);
    }
  }, [masters, academicYear]);

  // Load report data from server
  const loadReport = useCallback(async () => {
    if (!academicYear) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("academicYear", academicYear);
      if (selectedCollege != null) params.set("collegeId", String(selectedCollege));
      if (selectedCourse != null) params.set("courseId", String(selectedCourse));
      if (selectedBranch != null) params.set("branchId", String(selectedBranch));
      if (selectedBatch) params.set("batch", selectedBatch);
      if (selectedYear != null) params.set("year", String(selectedYear));
      if (selectedSemester != null) params.set("semester", String(selectedSemester));
      if (selectedSection) {
        params.set("sectionName", selectedSection);
        params.set("section", selectedSection);
      }
      if (selectedStaffHrmsId) params.set("staffHrmsId", selectedStaffHrmsId);
      if (selectedSubjectCode) params.set("subjectCode", selectedSubjectCode);

      if (dateMode === "today") {
        const todayStr = getTodayDateString();
        params.set("startDate", todayStr);
        params.set("endDate", todayStr);
      } else {
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
      }
      params.set("limit", "1000");

      const res = await apiFetch(`/today-timetable/master-vs-changed-report?${params.toString()}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const json = (await res.json()) as ReportResponse;
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load master vs changed report:", err);
    } finally {
      setLoading(false);
    }
  }, [
    academicYear,
    selectedCollege,
    selectedCourse,
    selectedBranch,
    selectedBatch,
    selectedYear,
    selectedSemester,
    selectedSection,
    selectedStaffHrmsId,
    selectedSubjectCode,
    dateMode,
    startDate,
    endDate,
  ]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  // Fetch dedicated complete dataset (up to 1000 sessions) for an individual faculty member
  const fetchDedicatedFacultyData = useCallback(
    async (f: { hrmsId?: string | null; facultyName: string }, includeStudents = false) => {
      if (!academicYear) return null;
      try {
        const params = new URLSearchParams();
        params.set("academicYear", academicYear);
        if (selectedCollege != null) params.set("collegeId", String(selectedCollege));
        if (selectedCourse != null) params.set("courseId", String(selectedCourse));
        if (selectedBranch != null) params.set("branchId", String(selectedBranch));
        if (selectedBatch) params.set("batch", selectedBatch);
        if (selectedYear != null) params.set("year", String(selectedYear));
        if (selectedSemester != null) params.set("semester", String(selectedSemester));
        if (dateMode === "today") {
          const todayStr = getTodayDateString();
          params.set("startDate", todayStr);
          params.set("endDate", todayStr);
        } else {
          if (startDate) params.set("startDate", startDate);
          if (endDate) params.set("endDate", endDate);
        }
        if (f.hrmsId && f.hrmsId !== "N/A") params.set("staffHrmsId", f.hrmsId);
        if (f.facultyName) params.set("facultyName", f.facultyName);
        if (includeStudents) params.set("includeStudents", "true");
        params.set("limit", "1000");

        const res = await apiFetch(`/today-timetable/master-vs-changed-report?${params.toString()}`, {
          cache: "no-store",
        });
        if (res.ok) {
          return (await res.json()) as ReportResponse;
        }
      } catch (err) {
        console.error("Failed to fetch dedicated faculty data:", err);
      }
      return null;
    },
    [
      academicYear,
      selectedCollege,
      selectedCourse,
      selectedBranch,
      selectedBatch,
      selectedYear,
      selectedSemester,
      dateMode,
      startDate,
      endDate,
    ],
  );

  // Fetch dedicated complete dataset (up to 1000 sessions) for an individual curriculum subject
  const fetchDedicatedSubjectData = useCallback(
    async (sub: { subjectCode: string; subjectName?: string }) => {
      if (!academicYear) return null;
      try {
        const params = new URLSearchParams();
        params.set("academicYear", academicYear);
        if (selectedCollege != null) params.set("collegeId", String(selectedCollege));
        if (selectedCourse != null) params.set("courseId", String(selectedCourse));
        if (selectedBranch != null) params.set("branchId", String(selectedBranch));
        if (selectedBatch) params.set("batch", selectedBatch);
        if (selectedYear != null) params.set("year", String(selectedYear));
        if (selectedSemester != null) params.set("semester", String(selectedSemester));
        if (dateMode === "today") {
          const todayStr = getTodayDateString();
          params.set("startDate", todayStr);
          params.set("endDate", todayStr);
        } else {
          if (startDate) params.set("startDate", startDate);
          if (endDate) params.set("endDate", endDate);
        }
        if (sub.subjectCode) params.set("subjectCode", sub.subjectCode);
        params.set("limit", "1000");

        const res = await apiFetch(`/today-timetable/master-vs-changed-report?${params.toString()}`, {
          cache: "no-store",
        });
        if (res.ok) {
          return (await res.json()) as ReportResponse;
        }
      } catch (err) {
        console.error("Failed to fetch dedicated subject data:", err);
      }
      return null;
    },
    [
      academicYear,
      selectedCollege,
      selectedCourse,
      selectedBranch,
      selectedBatch,
      selectedYear,
      selectedSemester,
      dateMode,
      startDate,
      endDate,
    ],
  );

  // Automatically fetch complete verified history when activeStaffModal is opened
  const activeStaffHrmsId = activeStaffModal?.hrmsId;
  const activeStaffName = activeStaffModal?.facultyName;

  useEffect(() => {
    if (!activeStaffHrmsId && !activeStaffName) {
      setDedicatedStaffSessions(null);
      setLoadingDedicatedSessions(false);
      return;
    }
    let cancelled = false;
    fetchDedicatedFacultyData({ hrmsId: activeStaffHrmsId || "", facultyName: activeStaffName || "" })
      .then((json) => {
        if (!cancelled && json?.comparisons) {
          setDedicatedStaffSessions(json.comparisons);
        }
      })
      .catch((err) => {
        console.warn("Background faculty session fetch:", err);
      })
      .finally(() => {
        if (!cancelled) setLoadingDedicatedSessions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeStaffHrmsId, activeStaffName, fetchDedicatedFacultyData]);

  // Automatically fetch complete verified history when activeSubjectModal is opened
  useEffect(() => {
    if (!activeSubjectModal) {
      setDedicatedSubjectSessions(null);
      return;
    }
    let cancelled = false;
    setLoadingDedicatedSessions(true);
    fetchDedicatedSubjectData(activeSubjectModal)
      .then((json) => {
        if (!cancelled && json?.comparisons) {
          setDedicatedSubjectSessions(json.comparisons);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDedicatedSessions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSubjectModal, fetchDedicatedSubjectData]);

  // Cascading Course Filter
  const filterCourses = useMemo(() => {
    if (!masters) return [];
    if (selectedCollege != null) {
      return masters.courses.filter((course) => course.collegeId === selectedCollege);
    }
    return masters.courses;
  }, [masters, selectedCollege]);

  // Cascading Branch Filter
  const filterBranches = useMemo(() => {
    if (!masters) return [];
    if (selectedCourse != null) {
      return masters.branches.filter((branch) => branch.courseId === selectedCourse);
    }
    if (selectedCollege != null) {
      const collegeCourseIds = new Set(
        masters.courses
          .filter((course) => course.collegeId === selectedCollege)
          .map((course) => course.id),
      );
      return masters.branches.filter((branch) => collegeCourseIds.has(branch.courseId));
    }
    return masters.branches;
  }, [masters, selectedCollege, selectedCourse]);

  // Available Classes: derived from live server catalog (filtered reactively) or fallback from masters
  const availableClasses = useMemo<CatalogClass[]>(() => {
    let list = data?.catalogClasses ?? [];
    if (selectedCollege != null) {
      list = list.filter((c) => !c.collegeId || c.collegeId === selectedCollege);
    }
    if (selectedCourse != null) {
      list = list.filter((c) => !c.courseId || c.courseId === selectedCourse);
    }
    if (selectedBranch != null) {
      list = list.filter((c) => !c.branchId || c.branchId === selectedBranch);
    }
    if (list.length > 0) {
      return list;
    }
    if (!masters || selectedBranch == null) return [];
    const branchSections = masters.sections.filter((s) => s.branchId === selectedBranch);
    const branchBatches = (masters.batches ?? []).filter((b) => b.branchId === selectedBranch);
    const batchSet = Array.from(
      new Set([...branchSections.map((s) => s.batch), ...branchBatches.map((b) => b.batch)]),
    )
      .filter(Boolean)
      .sort();

    const romanYears = ["I", "II", "III", "IV"];
    return batchSet.map((b, idx) => {
      const bSecs = Array.from(
        new Set(
          branchSections
            .filter((s) => s.batch === b)
            .map((s) => cleanSectionCode(s.name))
            .filter(Boolean),
        ),
      ).sort();
      const approxYear = Math.min(4, Math.max(1, idx + 1));
      return {
        key: `${b}_${approxYear}_1`,
        label: `${romanYears[approxYear - 1] || approxYear} Year (Batch ${b})`,
        collegeId: selectedCollege ?? undefined,
        courseId: selectedCourse ?? undefined,
        branchId: selectedBranch,
        batch: b,
        year: approxYear,
        semester: 1,
        sections: bSecs,
      };
    });
  }, [data?.catalogClasses, masters, selectedCollege, selectedCourse, selectedBranch]);

  // Active selected class object
  const activeClassObj = useMemo(() => {
    if (!selectedClassKey) return null;
    return availableClasses.find((c) => c.key === selectedClassKey) ?? null;
  }, [availableClasses, selectedClassKey]);

  // Year options for the course
  const yearOptions = useMemo(() => {
    if (selectedCourse != null && masters) {
      const course = masters.courses.find((c) => c.id === selectedCourse);
      if (course?.totalYears) {
        return Array.from({ length: course.totalYears }, (_, i) => i + 1);
      }
    }
    return masters?.yearOptions ?? [1, 2, 3, 4];
  }, [masters, selectedCourse]);

  // Dynamic sections: if class is selected, show exact sections for that class (e.g. 2 sections or 4 sections)
  const availableSections = useMemo<string[]>(() => {
    if (activeClassObj) {
      return activeClassObj.sections;
    }
    if (selectedYear != null) {
      const matchingClasses = availableClasses.filter((c) => c.year === selectedYear);
      const allSecs = new Set<string>();
      for (const c of matchingClasses) {
        for (const s of c.sections) allSecs.add(s);
      }
      return Array.from(allSecs).sort();
    }
    const allSecs = new Set<string>();
    for (const c of availableClasses) {
      for (const s of c.sections) allSecs.add(s);
    }
    return Array.from(allSecs).sort();
  }, [activeClassObj, selectedYear, availableClasses]);

  // Keep section valid when available sections change
  useEffect(() => {
    if (selectedSection != null && !availableSections.includes(selectedSection)) {
      setSelectedSection(null);
    }
  }, [availableSections, selectedSection]);

  // Handlers for class, year, semester
  const handleClassChange = (key: string | null) => {
    setSelectedClassKey(key);
    if (key) {
      const match = availableClasses.find((c) => c.key === key);
      if (match) {
        setSelectedBatch(match.batch);
        if (match.year) setSelectedYear(match.year);
        if (match.semester) setSelectedSemester(match.semester);
        if (selectedSection && !match.sections.includes(selectedSection)) {
          setSelectedSection(null);
        }
      }
    } else {
      setSelectedBatch(null);
      setSelectedSection(null);
      setSelectedYear(null);
      setSelectedSemester(null);
    }
  };

  const handleYearChange = (year: number | null) => {
    setSelectedYear(year);
    if (year == null) {
      if (activeClassObj) {
        setSelectedClassKey(null);
        setSelectedBatch(null);
        setSelectedSection(null);
      }
    } else if (activeClassObj && activeClassObj.year !== year) {
      const matchCls = availableClasses.find((c) => c.year === year);
      if (matchCls) {
        setSelectedClassKey(matchCls.key);
        setSelectedBatch(matchCls.batch);
      } else {
        setSelectedClassKey(null);
        setSelectedBatch(null);
        setSelectedSection(null);
      }
    }
  };

  const handleSemesterChange = (sem: number | null) => {
    setSelectedSemester(sem);
    if (activeClassObj && activeClassObj.semester !== sem) {
      setSelectedClassKey(null);
      setSelectedBatch(null);
      setSelectedSection(null);
    }
  };

  // Catalog faculties & subjects (for drilldown / reference)
  const availableFaculties = useMemo(() => {
    if (data?.catalogFaculties && data.catalogFaculties.length > 0) return data.catalogFaculties;
    if (data?.faculties && data.faculties.length > 0)
      return data.faculties.map((f) => ({ hrmsId: f.hrmsId, facultyName: f.facultyName }));
    return [];
  }, [data?.catalogFaculties, data?.faculties]);

  const availableSubjects = useMemo(() => {
    if (data?.catalogSubjects && data.catalogSubjects.length > 0) return data.catalogSubjects;
    if (data?.subjects && data.subjects.length > 0)
      return data.subjects.map((s) => ({ subjectCode: s.subjectCode, subjectName: s.subjectName }));
    return [];
  }, [data?.catalogSubjects, data?.subjects]);

  const selectedStaffObj = useMemo<FacultyStat | null>(() => {
    if (!selectedStaffHrmsId) return null;
    const fromStats = data?.faculties?.find((f) => f.hrmsId === selectedStaffHrmsId);
    if (fromStats) return fromStats;
    const fromCatalog = availableFaculties.find((f) => f.hrmsId === selectedStaffHrmsId);
    if (fromCatalog) {
      return {
        hrmsId: fromCatalog.hrmsId,
        facultyName: fromCatalog.facultyName,
        masterAssignedPeriods: 0,
        classesConducted: 0,
        relievedCount: 0,
        substituteTakenCount: 0,
        netTeachingCount: 0,
        subjects: [],
      };
    }
    return null;
  }, [selectedStaffHrmsId, data?.faculties, availableFaculties]);

  const selectedSubjectObj = useMemo<SubjectStat | null>(() => {
    if (!selectedSubjectCode) return null;
    const fromStats = data?.subjects?.find((s) => s.subjectCode === selectedSubjectCode);
    if (fromStats) return fromStats;
    const fromCatalog = availableSubjects.find((s) => s.subjectCode === selectedSubjectCode);
    if (fromCatalog) {
      return {
        subjectCode: fromCatalog.subjectCode,
        subjectName: fromCatalog.subjectName,
        masterWeeklyPeriods: 0,
        totalConducted: 0,
        timesChanged: 0,
        timesSwappedOut: 0,
        timesSwappedIn: 0,
        facultyNames: [],
        attendancePct: 0,
      };
    }
    return null;
  }, [selectedSubjectCode, data?.subjects, availableSubjects]);

  // Reset all filters
  const handleResetFilters = () => {
    setSelectedCollege(null);
    setSelectedCourse(null);
    setSelectedBranch(null);
    setSelectedClassKey(null);
    setSelectedBatch(null);
    setSelectedYear(null);
    setSelectedSemester(null);
    setSelectedSection(null);
    setSelectedStaffHrmsId(null);
    setSelectedSubjectCode(null);
    setDateMode("today");
    const t = getTodayDateString();
    setStartDate(t);
    setEndDate(t);
    setSearchQuery("");
  };

  const hasActiveFilters = Boolean(
    selectedCollege != null ||
      selectedCourse != null ||
      selectedBranch != null ||
      selectedClassKey != null ||
      selectedYear != null ||
      selectedSemester != null ||
      selectedSection != null ||
      selectedStaffHrmsId != null ||
      selectedSubjectCode != null ||
      dateMode === "range" ||
      searchQuery,
  );

  const summary = data?.summary ?? {
    totalMasterPeriods: 0,
    totalScheduledSessions: 0,
    totalConductedSessions: 0,
    totalChangesRecorded: 0,
    facultySubstitutionsCount: 0,
    subjectSwapsCount: 0,
    revertedCount: 0,
    overallChangeRatePct: 0,
    attendanceAvgPct: 0,
  };

  // Filtered comparison items (Master vs Today)
  const filteredComparisons = useMemo(() => {
    let list = data?.comparisons ?? [];
    if (selectedBranch != null) {
      list = list.filter((c) => c.branchId == null || c.branchId === selectedBranch);
    }
    if (selectedBatch) {
      const targetBatch = selectedBatch.trim().replace(/^batch\s*/i, "");
      list = list.filter((c) => (c.batch || "").trim().replace(/^batch\s*/i, "") === targetBatch);
    }
    if (selectedSection) {
      const targetSec = cleanSectionCode(selectedSection);
      list = list.filter((c) => cleanSectionCode(c.sectionName) === targetSec);
    }
    if (selectedSubjectCode) {
      const targetCode = selectedSubjectCode.trim().toUpperCase();
      list = list.filter((c) =>
        (c.masterSubjectCode && c.masterSubjectCode.trim().toUpperCase() === targetCode) ||
        (c.todaySubjectCode && c.todaySubjectCode.trim().toUpperCase() === targetCode)
      );
    }
    if (selectedStaffHrmsId) {
      const targetHrms = selectedStaffHrmsId.trim().toLowerCase();
      list = list.filter((c) =>
        (c.todayFacultyHrmsId && c.todayFacultyHrmsId.trim().toLowerCase() === targetHrms) ||
        (c.masterFacultyHrmsId && c.masterFacultyHrmsId.trim().toLowerCase() === targetHrms)
      );
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (c) =>
        (c.masterSubjectName || "").toLowerCase().includes(q) ||
        (c.masterSubjectCode || "").toLowerCase().includes(q) ||
        (c.masterFacultyName || "").toLowerCase().includes(q) ||
        (c.todaySubjectName || "").toLowerCase().includes(q) ||
        (c.todaySubjectCode || "").toLowerCase().includes(q) ||
        (c.todayFacultyName || "").toLowerCase().includes(q) ||
        (c.batch || "").toLowerCase().includes(q) ||
        (c.sectionName || "").toLowerCase().includes(q) ||
        c.slotLabel.toLowerCase().includes(q) ||
        c.date.includes(q),
    );
  }, [data?.comparisons, selectedBranch, selectedBatch, selectedSection, selectedSubjectCode, selectedStaffHrmsId, searchQuery]);

  // Memoized maps for Assigned Faculty (Master) and Changed Faculty (Substitutions) per Subject
  const { subjectAssignedFacultyMap, subjectChangedFacultyMap } = useMemo(() => {
    const assignedMap = new Map<string, Set<string>>();
    const changedMap = new Map<string, Map<string, { facultyName: string; originalFacultyName?: string; count: number }>>();

    // 1. Gather master assignments from masterScheduledPeriods if present
    if (data?.masterScheduledPeriods) {
      for (const p of data.masterScheduledPeriods) {
        if (p.subjectCode && p.facultyName && p.facultyName.trim() && p.facultyName !== "None" && p.facultyName !== "Faculty Assigned") {
          const code = p.subjectCode.trim();
          if (!assignedMap.has(code)) assignedMap.set(code, new Set());
          assignedMap.get(code)!.add(p.facultyName.trim());
        }
      }
    }

    // 2. Scan comparisons (Master Timetable vs Today Timetable for all scheduled sessions)
    const compList = data?.comparisons ?? [];
    for (const c of compList) {
      const masterCode = c.masterSubjectCode?.trim();
      const todayCode = c.todaySubjectCode?.trim();
      const masterFac = (c.masterFacultyName && c.masterFacultyName.trim() && c.masterFacultyName !== "None" && c.masterFacultyName !== "Faculty Assigned")
        ? c.masterFacultyName.trim()
        : "";
      const todayFac = (c.todayFacultyName && c.todayFacultyName.trim() && c.todayFacultyName !== "None" && c.todayFacultyName !== "Faculty Assigned")
        ? c.todayFacultyName.trim()
        : "";

      if (masterCode && masterFac) {
        if (!assignedMap.has(masterCode)) assignedMap.set(masterCode, new Set());
        assignedMap.get(masterCode)!.add(masterFac);
      }

      // Identify staff changed / substituted comparing Master Timetable vs Today Timetable
      const hasFacultyChanged =
        c.varianceType === "FACULTY_SUBSTITUTE" ||
        c.varianceType === "BOTH" ||
        Boolean(
          todayFac &&
          masterFac &&
          todayFac.toLowerCase() !== masterFac.toLowerCase()
        ) ||
        Boolean(
          c.todayFacultyHrmsId &&
          c.masterFacultyHrmsId &&
          c.todayFacultyHrmsId.trim() !== c.masterFacultyHrmsId.trim()
        );

      if (hasFacultyChanged && todayFac) {
        const codesToTrack = new Set<string>();
        if (masterCode) codesToTrack.add(masterCode);
        if (todayCode) codesToTrack.add(todayCode);

        for (const code of codesToTrack) {
          if (!changedMap.has(code)) changedMap.set(code, new Map());
          const subMap = changedMap.get(code)!;
          const key = `${todayFac}__${masterFac}`;
          if (!subMap.has(key)) {
            subMap.set(key, {
              facultyName: todayFac,
              originalFacultyName: masterFac || undefined,
              count: 1,
            });
          } else {
            subMap.get(key)!.count++;
          }
        }
      }
    }

    // Fallback to subjects catalog/stats facultyNames
    if (data?.subjects) {
      for (const s of data.subjects) {
        if (s.subjectCode && s.facultyNames) {
          const code = s.subjectCode.trim();
          if (!assignedMap.has(code) || assignedMap.get(code)!.size === 0) {
            assignedMap.set(code, new Set(s.facultyNames.map((n) => n.trim())));
          }
        }
      }
    }

    return {
      subjectAssignedFacultyMap: assignedMap,
      subjectChangedFacultyMap: changedMap,
    };
  }, [data?.comparisons, data?.masterScheduledPeriods, data?.subjects]);

  // Filtered subjects list
  const filteredSubjects = useMemo(() => {
    let list = data?.subjects ?? [];
    if (selectedBranch != null || selectedBatch || selectedSection) {
      const allowedSubjectCodes = new Set(
        filteredComparisons.flatMap((c) => [
          c.masterSubjectCode?.trim().toUpperCase(),
          c.todaySubjectCode?.trim().toUpperCase(),
        ]).filter(Boolean) as string[],
      );
      list = list.filter((s) => allowedSubjectCodes.has(s.subjectCode.trim().toUpperCase()));
    }
    if (selectedSubjectCode) {
      const targetCode = selectedSubjectCode.trim().toUpperCase();
      list = list.filter((s) => s.subjectCode.trim().toUpperCase() === targetCode);
    }
    if (selectedStaffHrmsId) {
      const targetHrms = selectedStaffHrmsId.trim().toLowerCase();
      const staffObj = (data?.faculties ?? []).find((f) => f.hrmsId.toLowerCase() === targetHrms);
      const facName = staffObj?.facultyName.toLowerCase();
      list = list.filter((s) => {
        const assignedFacs = subjectAssignedFacultyMap.get(s.subjectCode);
        return (
          (facName && s.facultyNames.some((f) => f.toLowerCase() === facName)) ||
          (assignedFacs && facName && Array.from(assignedFacs).some((f) => f.toLowerCase() === facName))
        );
      });
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (s) =>
        s.subjectName.toLowerCase().includes(q) ||
        s.subjectCode.toLowerCase().includes(q) ||
        s.facultyNames.some((f) => f.toLowerCase().includes(q)) ||
        Array.from(subjectAssignedFacultyMap.get(s.subjectCode) ?? []).some((f) => f.toLowerCase().includes(q)) ||
        Array.from(subjectChangedFacultyMap.get(s.subjectCode)?.values() ?? []).some((cf) => cf.facultyName.toLowerCase().includes(q)),
    );
  }, [data?.subjects, filteredComparisons, selectedBranch, selectedBatch, selectedSection, selectedSubjectCode, selectedStaffHrmsId, searchQuery, subjectAssignedFacultyMap, subjectChangedFacultyMap, data?.faculties]);

  // Filtered faculty list
  const filteredFaculties = useMemo(() => {
    let list = data?.faculties ?? [];
    if (selectedBranch != null || selectedBatch || selectedSection) {
      const allowedHrmsIds = new Set(
        filteredComparisons.flatMap((c) => [
          c.masterFacultyHrmsId?.trim().toLowerCase(),
          c.todayFacultyHrmsId?.trim().toLowerCase(),
        ]).filter(Boolean) as string[],
      );
      const allowedFacultyNames = new Set(
        filteredComparisons.flatMap((c) => [
          c.masterFacultyName?.trim().toLowerCase(),
          c.todayFacultyName?.trim().toLowerCase(),
        ]).filter(Boolean) as string[],
      );
      list = list.filter((f) => {
        const hrms = (f.hrmsId || "").trim().toLowerCase();
        const name = (f.facultyName || "").trim().toLowerCase();
        return (hrms && allowedHrmsIds.has(hrms)) || (name && allowedFacultyNames.has(name));
      });
    }
    if (selectedStaffHrmsId) {
      const targetHrms = selectedStaffHrmsId.trim().toLowerCase();
      list = list.filter((f) => f.hrmsId.trim().toLowerCase() === targetHrms);
    }
    if (selectedSubjectCode) {
      const targetCode = selectedSubjectCode.trim().toUpperCase();
      list = list.filter((f) =>
        f.subjects.some((sub) => sub.toUpperCase().includes(targetCode)),
      );
    }
    if (staffFilterTab === "substitutes") {
      list = list.filter((f) => f.substituteTakenCount > 0);
    } else if (staffFilterTab === "relieved") {
      list = list.filter((f) => f.relievedCount > 0);
    } else if (staffFilterTab === "variance") {
      list = list.filter(
        (f) =>
          Math.abs(f.substituteTakenCount - f.relievedCount) > 0 ||
          f.classesConducted !== f.masterAssignedPeriods,
      );
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (f) =>
        f.facultyName.toLowerCase().includes(q) ||
        f.hrmsId.toLowerCase().includes(q) ||
        f.subjects.some((s) => s.toLowerCase().includes(q)),
    );
  }, [data?.faculties, filteredComparisons, selectedBranch, selectedBatch, selectedSection, selectedStaffHrmsId, selectedSubjectCode, staffFilterTab, searchQuery]);

  // Subject Analytics derived metrics
  const subjectAnalytics = useMemo(() => {
    const list = filteredSubjects;
    const totalSubjects = list.length;
    const totalWeeklyQuota = list.reduce((acc, s) => acc + (Number(s.masterWeeklyPeriods) || 0), 0);
    const totalConducted = list.reduce((acc, s) => acc + (Number(s.totalConducted) || 0), 0);
    const alteredSubjectsCount = list.filter((s) => (Number(s.timesChanged) || 0) > 0).length;
    const totalChanges = list.reduce((acc, s) => acc + (Number(s.timesChanged) || 0), 0);
    const totalSwappedOut = list.reduce((acc, s) => acc + (Number(s.timesSwappedOut) || 0), 0);
    const totalSwappedIn = list.reduce((acc, s) => acc + (Number(s.timesSwappedIn) || 0), 0);
    const withAttendance = list.filter((s) => s.attendancePct > 0);
    const avgAttendance =
      withAttendance.length > 0
        ? Math.round(withAttendance.reduce((acc, s) => acc + s.attendancePct, 0) / withAttendance.length)
        : null;

    const totalPresent = list.reduce((acc, s) => acc + (s.totalPresent || 0), 0);
    const totalAbsent = list.reduce((acc, s) => acc + (s.totalAbsent || 0), 0);
    const totalMarked = list.reduce((acc, s) => acc + (s.totalMarked || 0), 0);
    const overallTurnoutPct = totalMarked > 0 ? Math.round((totalPresent / totalMarked) * 100) : null;

    return {
      totalSubjects,
      totalWeeklyQuota,
      totalConducted,
      alteredSubjectsCount,
      totalChanges,
      totalSwappedOut,
      totalSwappedIn,
      avgAttendance,
      totalPresent,
      totalAbsent,
      totalMarked,
      overallTurnoutPct,
    };
  }, [filteredSubjects]);

  // Staff Analytics derived metrics
  const staffAnalytics = useMemo(() => {
    const list = filteredFaculties;
    const totalStaff = list.length;
    const totalAssignedLoad = list.reduce((acc, f) => acc + (Number(f.masterAssignedPeriods) || 0), 0);
    const totalConducted = list.reduce((acc, f) => acc + (Number(f.classesConducted) || 0), 0);
    const totalRelieved = list.reduce((acc, f) => acc + (Number(f.relievedCount) || 0), 0);
    const totalSubstituteTaken = list.reduce((acc, f) => acc + (Number(f.substituteTakenCount) || 0), 0);
    const totalNetLoad = list.reduce((acc, f) => acc + (Number(f.netTeachingCount) || 0), 0);
    const activeFacultyCount = list.filter(
      (f) => f.classesConducted > 0 || f.masterAssignedPeriods > 0 || f.substituteTakenCount > 0,
    ).length;

    const totalPresent = list.reduce((acc, f) => acc + (f.totalPresent || 0), 0);
    const totalAbsent = list.reduce((acc, f) => acc + (f.totalAbsent || 0), 0);
    const totalMarked = list.reduce((acc, f) => acc + (f.totalMarked || 0), 0);
    const overallTurnoutPct = totalMarked > 0 ? Math.round((totalPresent / totalMarked) * 100) : null;

    return {
      totalStaff,
      totalAssignedLoad,
      totalConducted,
      totalRelieved,
      totalSubstituteTaken,
      totalNetLoad,
      activeFacultyCount,
      totalPresent,
      totalAbsent,
      totalMarked,
      overallTurnoutPct,
    };
  }, [filteredFaculties]);

  // Drill-down sessions for selected subject
  const subjectSessions = useMemo(() => {
    if (!selectedSubjectCode) return [];
    const code = selectedSubjectCode.trim().toUpperCase();
    return (data?.comparisons || []).filter(
      (c) =>
        (c.masterSubjectCode && c.masterSubjectCode.trim().toUpperCase() === code) ||
        (c.todaySubjectCode && c.todaySubjectCode.trim().toUpperCase() === code) ||
        (c.masterSubjectName && c.masterSubjectName.trim().toUpperCase() === code) ||
        (c.todaySubjectName && c.todaySubjectName.trim().toUpperCase() === code),
    );
  }, [selectedSubjectCode, data?.comparisons]);

  // Drill-down sessions for selected staff
  const staffSessions = useMemo(() => {
    if (!selectedStaffHrmsId) return [];
    const hrms = selectedStaffHrmsId.trim();
    return (data?.comparisons || []).filter(
      (c) =>
        (c.masterFacultyHrmsId && c.masterFacultyHrmsId.trim() === hrms) ||
        (c.todayFacultyHrmsId && c.todayFacultyHrmsId.trim() === hrms),
    );
  }, [selectedStaffHrmsId, data?.comparisons]);

  // Sessions for Active Staff Popup Modal with detailed action role calculation
  const modalStaffSessions = useMemo(() => {
    if (!activeStaffModal) return [];
    const hrms = (activeStaffModal.hrmsId || "").trim().toLowerCase();
    const facName = (activeStaffModal.facultyName || "").trim().toLowerCase();
    const sourceComparisons = (dedicatedStaffSessions && dedicatedStaffSessions.length > 0) ? dedicatedStaffSessions : (data?.comparisons || []);

    return sourceComparisons
      .filter((c) => {
        const todayHrms = (c.todayFacultyHrmsId || "").trim().toLowerCase();
        const masterHrms = (c.masterFacultyHrmsId || "").trim().toLowerCase();
        const todayName = (c.todayFacultyName || "").trim().toLowerCase();
        const masterName = (c.masterFacultyName || "").trim().toLowerCase();

        const matchHrms =
          Boolean(hrms) && (todayHrms === hrms || masterHrms === hrms);
        const matchName =
          Boolean(facName) && (todayName === facName || masterName === facName);
        return matchHrms || matchName;
      })
      .map((c) => {
        const todayHrms = (c.todayFacultyHrmsId || "").trim().toLowerCase();
        const masterHrms = (c.masterFacultyHrmsId || "").trim().toLowerCase();
        const todayName = (c.todayFacultyName || "").trim().toLowerCase();
        const masterName = (c.masterFacultyName || "").trim().toLowerCase();

        const isTodayTeacher = (Boolean(hrms) && todayHrms === hrms) || (Boolean(facName) && todayName === facName);
        const isMasterTeacher = (Boolean(hrms) && masterHrms === hrms) || (Boolean(facName) && masterName === facName);

        let actionRole: "substitute_taken" | "relieved_away" | "regular_conducted" | "scheduled_pending" = "regular_conducted";
        let actionTitle = "Regular Scheduled Class";
        let actionBadgeClass = "text-emerald-800 bg-emerald-50 border-emerald-300";

        if (isTodayTeacher && !isMasterTeacher && c.masterFacultyName) {
          actionRole = "substitute_taken";
          actionTitle = `Substitute Taken (+) for ${c.masterFacultyName}`;
          actionBadgeClass = "text-sky-800 bg-sky-50 border-sky-300 font-bold";
        } else if (!isTodayTeacher && isMasterTeacher && c.todayFacultyName) {
          actionRole = "relieved_away";
          actionTitle = `Relieved Away (-) by ${c.todayFacultyName}`;
          actionBadgeClass = "text-rose-800 bg-rose-50 border-rose-300 font-bold";
        } else if (c.isConducted) {
          actionRole = "regular_conducted";
          actionTitle = "Conducted As Master";
          actionBadgeClass = "text-emerald-800 bg-emerald-50 border-emerald-300";
        } else {
          actionRole = "scheduled_pending";
          actionTitle = "Scheduled Master Slot";
          actionBadgeClass = "text-slate-700 bg-slate-100 border-slate-200";
        }

        return {
          ...c,
          isTodayTeacher,
          isMasterTeacher,
          actionRole,
          actionTitle,
          actionBadgeClass,
        };
      });
  }, [activeStaffModal, dedicatedStaffSessions, data?.comparisons]);

  const filteredModalStaffSessions = useMemo(() => {
    if (!staffModalSearch.trim()) return modalStaffSessions;
    const q = staffModalSearch.toLowerCase();
    return modalStaffSessions.filter(
      (s) =>
        (s.date || "").includes(q) ||
        (s.slotLabel || "").toLowerCase().includes(q) ||
        (s.time || "").toLowerCase().includes(q) ||
        (s.masterSubjectName || "").toLowerCase().includes(q) ||
        (s.masterSubjectCode || "").toLowerCase().includes(q) ||
        (s.todaySubjectName || "").toLowerCase().includes(q) ||
        (s.todaySubjectCode || "").toLowerCase().includes(q) ||
        (s.sectionName || "").toLowerCase().includes(q) ||
        (s.batch || "").toLowerCase().includes(q) ||
        (s.masterFacultyName || "").toLowerCase().includes(q) ||
        (s.todayFacultyName || "").toLowerCase().includes(q) ||
        (s.actionTitle || "").toLowerCase().includes(q),
    );
  }, [modalStaffSessions, staffModalSearch]);

  // Sessions for Active Subject Popup Modal with delivery & alteration actions
  const modalSubjectSessions = useMemo(() => {
    if (!activeSubjectModal) return [];
    const code = (activeSubjectModal.subjectCode || "").trim().toUpperCase();
    const name = (activeSubjectModal.subjectName || "").trim().toLowerCase();
    const sourceComparisons = (dedicatedSubjectSessions && dedicatedSubjectSessions.length > 0) ? dedicatedSubjectSessions : (data?.comparisons || []);

    return sourceComparisons
      .filter((c) => {
        const matchCode =
          (c.masterSubjectCode && c.masterSubjectCode.trim().toUpperCase() === code) ||
          (c.todaySubjectCode && c.todaySubjectCode.trim().toUpperCase() === code);
        const matchName =
          (c.masterSubjectName && c.masterSubjectName.trim().toLowerCase() === name) ||
          (c.todaySubjectName && c.todaySubjectName.trim().toLowerCase() === name);

        if (!matchCode && !matchName) return false;

        if (activeSubjectModal.sectionLetter) {
          const sec = cleanSectionCode(c.sectionName);
          const targetSec = cleanSectionCode(activeSubjectModal.sectionLetter);
          if (sec && targetSec && sec !== targetSec) return false;
        }
        return true;
      })
      .map((c) => {
        const isSub =
          c.varianceType === "FACULTY_SUBSTITUTE" ||
          Boolean(
            c.todayFacultyName &&
            c.masterFacultyName &&
            c.todayFacultyName.trim().toLowerCase() !== c.masterFacultyName.trim().toLowerCase()
          );
        const isSwap =
          c.varianceType === "SUBJECT_SWAP" ||
          Boolean(
            c.todaySubjectCode &&
            c.masterSubjectCode &&
            c.todaySubjectCode.trim().toUpperCase() !== c.masterSubjectCode.trim().toUpperCase()
          );

        let actionRole: "as_master" | "substitute" | "swapped" | "both" = "as_master";
        let actionTitle = "Conducted As Master";
        let actionBadgeClass = "text-emerald-800 bg-emerald-50 border-emerald-300";

        if (isSub && isSwap) {
          actionRole = "both";
          actionTitle = `Swap & Sub (${c.todayFacultyName})`;
          actionBadgeClass = "text-purple-800 bg-purple-50 border-purple-300 font-bold";
        } else if (isSub) {
          actionRole = "substitute";
          actionTitle = `Faculty Substituted (${c.todayFacultyName})`;
          actionBadgeClass = "text-amber-800 bg-amber-50 border-amber-300 font-bold";
        } else if (isSwap) {
          actionRole = "swapped";
          actionTitle = `Subject Swapped (${c.todaySubjectName})`;
          actionBadgeClass = "text-sky-800 bg-sky-50 border-sky-300 font-bold";
        }

        return {
          ...c,
          isSub,
          isSwap,
          actionRole,
          actionTitle,
          actionBadgeClass,
        };
      });
  }, [activeSubjectModal, dedicatedSubjectSessions, data?.comparisons]);

  const filteredModalSubjectSessions = useMemo(() => {
    if (!subjectModalSearch.trim()) return modalSubjectSessions;
    const q = subjectModalSearch.toLowerCase();
    return modalSubjectSessions.filter(
      (s) =>
        (s.date || "").includes(q) ||
        (s.slotLabel || "").toLowerCase().includes(q) ||
        (s.time || "").toLowerCase().includes(q) ||
        (s.sectionName || "").toLowerCase().includes(q) ||
        (s.batch || "").toLowerCase().includes(q) ||
        (s.masterFacultyName || "").toLowerCase().includes(q) ||
        (s.todayFacultyName || "").toLowerCase().includes(q) ||
        (s.masterSubjectName || "").toLowerCase().includes(q) ||
        (s.todaySubjectName || "").toLowerCase().includes(q) ||
        (s.actionTitle || "").toLowerCase().includes(q),
    );
  }, [modalSubjectSessions, subjectModalSearch]);

  // Filtered recent changes (Audit Log)
  const filteredRecentChanges = useMemo(() => {
    const list = data?.recentChanges ?? [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (c) =>
        (c.masterSubjectName || "").toLowerCase().includes(q) ||
        (c.masterSubjectCode || "").toLowerCase().includes(q) ||
        (c.masterFacultyName || "").toLowerCase().includes(q) ||
        (c.newSubjectName || "").toLowerCase().includes(q) ||
        (c.newSubjectCode || "").toLowerCase().includes(q) ||
        (c.newFacultyName || "").toLowerCase().includes(q) ||
        (c.batch || "").toLowerCase().includes(q) ||
        (c.sectionName || "").toLowerCase().includes(q) ||
        (c.remarks || "").toLowerCase().includes(q) ||
        c.slotLabel.toLowerCase().includes(q) ||
        c.timetableDate.includes(q),
    );
  }, [data?.recentChanges, searchQuery]);

  // Branch lookup map for displaying branch codes (CSE, ECE, MEC...)
  const branchLookup = useMemo(() => {
    const map = new Map<number, { name: string; code: string }>();
    (masters?.branches || []).forEach((b) => {
      map.set(b.id, {
        name: b.name,
        code: b.code || b.name,
      });
    });
    return map;
  }, [masters?.branches]);

  const getBranchBadge = useCallback(
    (branchId?: number | null, fallbackCode?: string | null): string => {
      if (fallbackCode && fallbackCode.trim()) return fallbackCode.trim();
      if (branchId && branchLookup.has(branchId)) return branchLookup.get(branchId)!.code;
      if (selectedBranch && branchLookup.has(selectedBranch)) return branchLookup.get(selectedBranch)!.code;
      return "CSE";
    },
    [branchLookup, selectedBranch],
  );

  const selectedCohortTitle = useMemo(() => {
    const parts: string[] = [];
    if (selectedBranch && branchLookup.has(selectedBranch)) {
      parts.push(branchLookup.get(selectedBranch)!.code || branchLookup.get(selectedBranch)!.name);
    }
    if (selectedBatch) {
      parts.push(`Batch ${selectedBatch}`);
    }
    if (selectedSection) {
      parts.push(`Section ${cleanSectionCode(selectedSection)}`);
    }
    return parts.length > 0 ? parts.join(" · ") : "All Classes & Sections";
  }, [selectedBranch, branchLookup, selectedBatch, selectedSection]);

  // Group comparisons cleanly by academic cohort (Branch + Batch + Section)
  // Ensures distinct classes (e.g. BCSE Sec A vs DCSE Sec A vs DECE Sec A) are separated accurately into their own cohort cards
  const comparisonsBySection = useMemo(() => {
    type CohortMeta = {
      branchCode: string;
      branchId?: number | null;
      batch: string;
      sectionLetter: string;
    };

    const map = new Map<string, ComparisonItem[]>();
    const cohortMeta = new Map<string, CohortMeta>();

    for (const c of filteredComparisons) {
      const branchCode = (c.branchCode && c.branchCode.trim()) ? c.branchCode.trim() : getBranchBadge(c.branchId, c.branchCode);
      const batch = (c.batch && c.batch.trim() && c.batch !== "Regular") ? c.batch.trim() : (selectedBatch || "Regular");
      const secLetter = cleanSectionCode(c.sectionName) || "Unassigned";
      const key = `${branchCode}__${batch}__${secLetter}`;

      if (!map.has(key)) {
        map.set(key, []);
        cohortMeta.set(key, {
          branchCode,
          branchId: c.branchId,
          batch,
          sectionLetter: secLetter,
        });
      }
      map.get(key)!.push(c);
    }

    // Sort cohort keys: by branch code, then by batch (descending), then by section letter
    const sortedKeys = Array.from(map.keys())
      .filter((k) => {
        const meta = cohortMeta.get(k)!;
        if (selectedBranch != null && meta.branchId != null && meta.branchId !== selectedBranch) return false;
        if (selectedBatch) {
          const targetBatch = selectedBatch.trim().replace(/^batch\s*/i, "");
          if (meta.batch.trim().replace(/^batch\s*/i, "") !== targetBatch) return false;
        }
        if (selectedSection) {
          const targetSec = cleanSectionCode(selectedSection);
          if (meta.sectionLetter !== targetSec) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const metaA = cohortMeta.get(a)!;
        const metaB = cohortMeta.get(b)!;

        if (metaA.branchCode !== metaB.branchCode) {
          return metaA.branchCode.localeCompare(metaB.branchCode);
        }
        if (metaA.batch !== metaB.batch) {
          return metaB.batch.localeCompare(metaA.batch);
        }
        if (metaA.sectionLetter === "Unassigned") return 1;
        if (metaB.sectionLetter === "Unassigned") return -1;
        return metaA.sectionLetter.localeCompare(metaB.sectionLetter);
      });

    return sortedKeys.map((key) => {
      const rawItems = map.get(key)!;
      const meta = cohortMeta.get(key)!;

      // Sort items chronologically by date and start time / slot
      const items = [...rawItems].sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.time || "").localeCompare(b.time || "");
      });

      const conductedCount = items.filter((i) => i.isConducted).length;
      const substitutedCount = items.filter(
        (i) => i.varianceType === "FACULTY_SUBSTITUTE" || i.varianceType === "BOTH",
      ).length;
      const swappedCount = items.filter(
        (i) => i.varianceType === "SUBJECT_SWAP" || i.varianceType === "BOTH",
      ).length;
      const unchangedCount = items.filter((i) => i.varianceType === "UNCHANGED").length;

      const secTitle = meta.sectionLetter === "Unassigned"
        ? `${meta.branchCode} · All Sections`
        : `Section ${meta.sectionLetter}`;

      // Resolve official student enrollment / class strength from student database
      const bCode = (meta.branchCode || "").trim().toUpperCase();
      const batchStr = (meta.batch || "").trim().replace(/^batch\s*/i, "");
      const secL = (meta.sectionLetter || "").trim().toUpperCase();
      const itemYr = items.find((it) => it.yearOfStudy)?.yearOfStudy;

      let officialStrength = 0;
      if (data?.sectionStrengths) {
        officialStrength =
          data.sectionStrengths[`${bCode}__${batchStr}__${secL}`] ||
          (meta.branchId ? data.sectionStrengths[`${meta.branchId}__${batchStr}__${secL}`] : 0) ||
          (itemYr ? data.sectionStrengths[`${bCode}__YEAR${itemYr}__${secL}`] : 0) ||
          (meta.branchId && itemYr ? data.sectionStrengths[`${meta.branchId}__YEAR${itemYr}__${secL}`] : 0) ||
          0;
      }
      if (!officialStrength) {
        const fromItem = items.find((it) => (it.enrolledCount || 0) > 0)?.enrolledCount || 0;
        if (fromItem > 0) officialStrength = fromItem;
      }
      const maxMarkedInItems = items.reduce(
        (max, it) => Math.max(max, (it.presentCount || 0) + (it.absentCount || 0)),
        0,
      );
      const secEnrolled = officialStrength > 0 ? officialStrength : (maxMarkedInItems > 0 ? maxMarkedInItems : 0);

      // Derive distinct subjects taught in this specific class & section
      type CohortSubjectEntry = {
        subjectCode: string;
        subjectName: string;
        masterWeeklyPeriods: number;
        totalScheduled: number;
        totalConducted: number;
        timesChanged: number;
        timesSwappedOut: number;
        timesSwappedIn: number;
        assignedFaculty: Set<string>;
        changedFaculty: Map<string, { facultyName: string; originalFacultyName?: string; count: number }>;
        totalPresent: number;
        totalMarked: number;
      };

      const cSubMap = new Map<string, CohortSubjectEntry>();

      // 1. Master scheduled periods for this cohort
      const matchedMasterPeriods = (data?.masterScheduledPeriods || []).filter((m) => {
        const secL = cleanSectionCode(m.sectionName) || "Unassigned";
        const bCode = (m.branchCode && m.branchCode.trim()) ? m.branchCode.trim() : getBranchBadge(m.branchId, m.branchCode);
        const bBatch = (m.batch && m.batch.trim() && m.batch !== "Regular") ? m.batch.trim() : (selectedBatch || "Regular");
        const secMatch = meta.sectionLetter === "Unassigned" || secL === meta.sectionLetter;
        const branchMatch = !bCode || bCode === meta.branchCode;
        const batchMatch = !bBatch || bBatch.toLowerCase().replace(/^batch\s*/i, "") === meta.batch.toLowerCase().replace(/^batch\s*/i, "");
        if (!secMatch || !branchMatch || !batchMatch) return false;

        if (selectedSubjectCode) {
          const targetCode = selectedSubjectCode.trim().toUpperCase();
          const sCode = (m.subjectCode || m.customLabel || "").trim().toUpperCase();
          if (sCode !== targetCode) return false;
        }
        if (selectedStaffHrmsId) {
          const targetHrms = selectedStaffHrmsId.trim().toLowerCase();
          const mHrms = (m.facultyHrmsId || "").trim().toLowerCase();
          const staffObj = (data?.faculties ?? []).find((f) => f.hrmsId.toLowerCase() === targetHrms);
          const facName = staffObj?.facultyName.toLowerCase();
          const mFacName = (m.facultyName || "").trim().toLowerCase();
          if (mHrms !== targetHrms && (!facName || mFacName !== facName)) return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchCode = (m.subjectCode || "").toLowerCase().includes(q);
          const matchName = (m.subjectName || m.customLabel || "").toLowerCase().includes(q);
          const matchFac = (m.facultyName || "").toLowerCase().includes(q);
          if (!matchCode && !matchName && !matchFac) return false;
        }
        return true;
      });

      for (const m of matchedMasterPeriods) {
        const code = (m.subjectCode || m.customLabel || "SPECIAL").trim();
        if (!code) continue;
        if (!cSubMap.has(code)) {
          cSubMap.set(code, {
            subjectCode: code,
            subjectName: m.subjectName || m.customLabel || code,
            masterWeeklyPeriods: 0,
            totalScheduled: 0,
            totalConducted: 0,
            timesChanged: 0,
            timesSwappedOut: 0,
            timesSwappedIn: 0,
            assignedFaculty: new Set(),
            changedFaculty: new Map(),
            totalPresent: 0,
            totalMarked: 0,
          });
        }
        const sEntry = cSubMap.get(code)!;
        sEntry.masterWeeklyPeriods++;
        if (m.facultyName && m.facultyName.trim() && m.facultyName !== "None" && m.facultyName !== "Faculty Assigned") {
          sEntry.assignedFaculty.add(m.facultyName.trim());
        }
      }

      // 2. Timetable comparison sessions for this cohort
      for (const c of items) {
        const masterCode = c.masterSubjectCode?.trim() || "";
        const todayCode = c.todaySubjectCode?.trim() || masterCode;
        const isSwap = c.varianceType === "SUBJECT_SWAP" || c.varianceType === "BOTH";
        const isSub = c.varianceType === "FACULTY_SUBSTITUTE" || c.varianceType === "BOTH";

        const primaryCode = masterCode || todayCode;
        if (primaryCode) {
          if (!cSubMap.has(primaryCode)) {
            cSubMap.set(primaryCode, {
              subjectCode: primaryCode,
              subjectName: c.masterSubjectName || c.todaySubjectName || primaryCode,
              masterWeeklyPeriods: 0,
              totalScheduled: 0,
              totalConducted: 0,
              timesChanged: 0,
              timesSwappedOut: 0,
              timesSwappedIn: 0,
              assignedFaculty: new Set(),
              changedFaculty: new Map(),
              totalPresent: 0,
              totalMarked: 0,
            });
          }
          const pEntry = cSubMap.get(primaryCode)!;
          pEntry.totalScheduled++;
          if (c.masterFacultyName?.trim() && c.masterFacultyName !== "None" && c.masterFacultyName !== "Faculty Assigned") {
            pEntry.assignedFaculty.add(c.masterFacultyName.trim());
          }
        }

        const conductedCode = todayCode || masterCode;
        if (conductedCode) {
          if (!cSubMap.has(conductedCode)) {
            cSubMap.set(conductedCode, {
              subjectCode: conductedCode,
              subjectName: c.todaySubjectName || c.masterSubjectName || conductedCode,
              masterWeeklyPeriods: 0,
              totalScheduled: 0,
              totalConducted: 0,
              timesChanged: 0,
              timesSwappedOut: 0,
              timesSwappedIn: 0,
              assignedFaculty: new Set(),
              changedFaculty: new Map(),
              totalPresent: 0,
              totalMarked: 0,
            });
          }
          const cEntry = cSubMap.get(conductedCode)!;
          if (c.isConducted) {
            cEntry.totalConducted++;
            if (c.presentCount != null) cEntry.totalPresent += c.presentCount;
            if (c.presentCount != null || c.absentCount != null) {
              cEntry.totalMarked += (c.presentCount || 0) + (c.absentCount || 0);
            }
          }
        }

        // Swaps
        if (isSwap && masterCode && todayCode && masterCode !== todayCode) {
          if (cSubMap.has(masterCode)) {
            const mE = cSubMap.get(masterCode)!;
            mE.timesSwappedOut++;
            mE.timesChanged++;
          }
          if (cSubMap.has(todayCode)) {
            const tE = cSubMap.get(todayCode)!;
            tE.timesSwappedIn++;
            tE.timesChanged++;
          }
        }

        // Faculty Substitutions
        const facChanged =
          isSub ||
          Boolean(
            c.todayFacultyName &&
            c.masterFacultyName &&
            c.todayFacultyName.trim().toLowerCase() !== c.masterFacultyName.trim().toLowerCase()
          );

        if (facChanged && c.todayFacultyName) {
          const targetCodes = new Set<string>();
          if (masterCode) targetCodes.add(masterCode);
          if (todayCode) targetCodes.add(todayCode);

          for (const tc of targetCodes) {
            if (cSubMap.has(tc)) {
              const entry = cSubMap.get(tc)!;
              entry.timesChanged++;
              const tFac = c.todayFacultyName.trim();
              const mFac = c.masterFacultyName?.trim() || undefined;
              const k = `${tFac}__${mFac || ""}`;
              if (!entry.changedFaculty.has(k)) {
                entry.changedFaculty.set(k, { facultyName: tFac, originalFacultyName: mFac, count: 1 });
              } else {
                entry.changedFaculty.get(k)!.count++;
              }
            }
          }
        }
      }

      const allCohortSubjects = Array.from(cSubMap.values()).map((sub) => {
        const turnoutPct =
          sub.totalMarked > 0
            ? Math.round((sub.totalPresent / sub.totalMarked) * 100)
            : (sub.totalConducted > 0 ? 100 : null);

        const effectiveAttendancePct =
          sub.totalConducted > 0 && sub.totalScheduled > 0 && turnoutPct != null
            ? (dateMode === "range" && sub.totalScheduled > sub.totalConducted
                ? Math.round((sub.totalConducted / sub.totalScheduled) * turnoutPct)
                : turnoutPct)
            : (sub.totalConducted > 0 && turnoutPct != null ? turnoutPct : null);

        return {
          subjectCode: sub.subjectCode,
          subjectName: sub.subjectName,
          masterWeeklyPeriods: sub.masterWeeklyPeriods,
          totalScheduled: sub.totalScheduled,
          totalConducted: sub.totalConducted,
          timesChanged: sub.timesChanged,
          timesSwappedOut: sub.timesSwappedOut,
          timesSwappedIn: sub.timesSwappedIn,
          assignedFaculty: Array.from(sub.assignedFaculty),
          changedFaculty: Array.from(sub.changedFaculty.values()),
          turnoutPct,
          effectiveAttendancePct,
          totalPresent: sub.totalPresent,
          totalMarked: sub.totalMarked,
        };
      }).sort((a, b) => b.totalConducted - a.totalConducted || b.masterWeeklyPeriods - a.masterWeeklyPeriods);

      const cohortSubjects = allCohortSubjects.filter((sub) => {
        if (selectedSubjectCode) {
          const targetCode = selectedSubjectCode.trim().toUpperCase();
          if (sub.subjectCode.trim().toUpperCase() !== targetCode) return false;
        }
        if (selectedStaffHrmsId) {
          const targetHrms = selectedStaffHrmsId.trim().toLowerCase();
          const staffObj = (data?.faculties ?? []).find((f) => f.hrmsId.toLowerCase() === targetHrms);
          const facName = staffObj?.facultyName.toLowerCase();
          const matchesAssigned = facName && sub.assignedFaculty.some((f) => f.toLowerCase() === facName);
          const matchesChanged = facName && sub.changedFaculty.some((cf) => cf.facultyName.toLowerCase() === facName);
          if (!matchesAssigned && !matchesChanged) return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchCode = sub.subjectCode.toLowerCase().includes(q);
          const matchName = sub.subjectName.toLowerCase().includes(q);
          const matchAssigned = sub.assignedFaculty.some((f) => f.toLowerCase() === q);
          const matchChanged = sub.changedFaculty.some((cf) => cf.facultyName.toLowerCase() === q);
          if (!matchCode && !matchName && !matchAssigned && !matchChanged) return false;
        }
        return true;
      });

      if ((selectedSubjectCode || selectedStaffHrmsId || searchQuery.trim()) && cohortSubjects.length === 0) {
        return null;
      }

      return {
        sectionKey: key,
        cohortKey: key,
        branchCode: meta.branchCode,
        branchId: meta.branchId,
        batch: meta.batch,
        sectionLetter: meta.sectionLetter,
        sectionTitle: secTitle,
        secEnrolled,
        items,
        totalClasses: items.length,
        conductedCount,
        substitutedCount,
        swappedCount,
        unchangedCount,
        cohortSubjects,
      };
    }).filter((g): g is NonNullable<typeof g> => g !== null && (g.secEnrolled > 0 || g.conductedCount > 0 || g.items.some(i => i.isConducted)));
  }, [filteredComparisons, getBranchBadge, selectedBatch, selectedBranch, selectedSection, selectedSubjectCode, selectedStaffHrmsId, searchQuery, data?.masterScheduledPeriods, data?.sectionStrengths, data?.faculties, dateMode]);

  // Total enrolled students across all cohorts
  const totalCohortStudentsEnrolled = useMemo(() => {
    return comparisonsBySection.reduce((acc, g) => acc + (g.secEnrolled || 0), 0);
  }, [comparisonsBySection]);

  // Drill-down data sets for KPI Analytics Drawer
  const changedItems = useMemo(() => {
    const list: Array<{
      id: string;
      date: string;
      slotLabel: string;
      slotTime: string;
      branchCode?: string;
      branchName?: string;
      batch: string;
      sectionName: string | null;
      masterSubjectName: string;
      masterSubjectCode: string;
      masterFacultyName: string;
      masterFacultyHrmsId?: string | null;
      newSubjectName: string;
      newSubjectCode: string;
      newFacultyName: string;
      newFacultyHrmsId?: string | null;
      varianceType: string;
      remarks: string | null;
      changedByName?: string | null;
    }> = [];

    const seenKeys = new Set<string>();

    // 1. Authoritative change events from data.recentChanges
    (data?.recentChanges || []).forEach((c) => {
      const secCode = cleanSectionCode(c.sectionName);
      if (selectedSection && secCode && secCode !== cleanSectionCode(selectedSection)) {
        return;
      }
      const slotClean = (c.slotLabel || "").toUpperCase().replace(/\s+/g, "");
      const timeClean = (c.slotTime || "").trim();
      const bClean = (c.batch || "").trim().toLowerCase().replace(/^batch\s*/i, "");

      seenKeys.add(`${c.timetableDate}_${bClean}_${secCode}_${slotClean}`);
      if (timeClean) {
        seenKeys.add(`${c.timetableDate}_${bClean}_${secCode}_${timeClean}`);
      }

      list.push({
        id: `change-${c.id}`,
        date: c.timetableDate,
        slotLabel: c.slotLabel,
        slotTime: c.slotTime,
        branchCode: c.branchCode,
        branchName: c.branchName,
        batch: c.batch,
        sectionName: c.sectionName,
        masterSubjectName: c.masterSubjectName || "Scheduled Subject",
        masterSubjectCode: c.masterSubjectCode || "",
        masterFacultyName: c.masterFacultyName || "Scheduled Faculty",
        masterFacultyHrmsId: c.masterFacultyHrmsId,
        newSubjectName: c.newSubjectName || c.masterSubjectName || "Current Subject",
        newSubjectCode: c.newSubjectCode || c.masterSubjectCode || "",
        newFacultyName: c.newFacultyName || c.masterFacultyName || "Current Faculty",
        newFacultyHrmsId: c.newFacultyHrmsId,
        varianceType: c.varianceType,
        remarks: c.remarks,
        changedByName: c.changedByName,
      });
    });

    // 2. Only add from comparisons if this session was NOT already in recentChanges
    (data?.comparisons || []).forEach((c) => {
      if (c.varianceType !== "UNCHANGED") {
        const secCode = cleanSectionCode(c.sectionName);
        if (selectedSection && secCode && secCode !== cleanSectionCode(selectedSection)) {
          return;
        }
        const slotClean = (c.slotLabel || "").toUpperCase().replace(/\s+/g, "");
        const timeClean = (c.time || "").trim();
        const bClean = (c.batch || "").trim().toLowerCase().replace(/^batch\s*/i, "");

        const keyBySlot = `${c.date}_${bClean}_${secCode}_${slotClean}`;
        const keyByTime = `${c.date}_${bClean}_${secCode}_${timeClean}`;

        // Prevent duplicate if already captured from recentChanges
        const alreadyInList =
          seenKeys.has(keyBySlot) ||
          (timeClean ? seenKeys.has(keyByTime) : false) ||
          list.some(
            (item) =>
              item.date === c.date &&
              (item.batch || "").trim().toLowerCase().replace(/^batch\s*/i, "") === bClean &&
              cleanSectionCode(item.sectionName) === secCode &&
              ((slotClean && (item.slotLabel || "").toUpperCase().replace(/\s+/g, "") === slotClean) ||
                (timeClean && (item.slotTime || "").trim() === timeClean) ||
                (item.newSubjectCode && c.todaySubjectCode && item.newSubjectCode === c.todaySubjectCode)),
          );

        if (!alreadyInList) {
          seenKeys.add(keyBySlot);
          if (timeClean) seenKeys.add(keyByTime);
          list.push({
            id: `comp-${c.id}`,
            date: c.date,
            slotLabel: c.slotLabel,
            slotTime: c.time,
            branchCode: c.branchCode,
            branchName: c.branchName,
            batch: c.batch,
            sectionName: c.sectionName,
            masterSubjectName: c.masterSubjectName || "Scheduled Subject",
            masterSubjectCode: c.masterSubjectCode || "",
            masterFacultyName: c.masterFacultyName || "Scheduled Faculty",
            masterFacultyHrmsId: c.masterFacultyHrmsId,
            newSubjectName: c.todaySubjectName || c.masterSubjectName || "Current Subject",
            newSubjectCode: c.todaySubjectCode || c.masterSubjectCode || "",
            newFacultyName: c.todayFacultyName || c.masterFacultyName || "Current Faculty",
            newFacultyHrmsId: c.todayFacultyHrmsId,
            varianceType: c.varianceType,
            remarks: "Session altered from master schedule",
            changedByName: "Timetable Coordinator",
          });
        }
      }
    });

    return list;
  }, [data?.recentChanges, data?.comparisons, selectedSection]);

  // Specific Faculty Substitutions (Who was changed & Who took over)
  const substitutedItems = useMemo(() => {
    return changedItems.filter((c) => {
      return (
        c.varianceType === "FACULTY_SUBSTITUTE" ||
        c.varianceType === "BOTH" ||
        (c.masterFacultyName && c.newFacultyName && c.masterFacultyName.trim().toLowerCase() !== c.newFacultyName.trim().toLowerCase()) ||
        (c.masterFacultyHrmsId && c.newFacultyHrmsId && c.masterFacultyHrmsId !== c.newFacultyHrmsId)
      );
    });
  }, [changedItems]);

  // Specific Subject Swaps
  const swappedItems = useMemo(() => {
    return changedItems.filter((c) => {
      return (
        c.varianceType === "SUBJECT_SWAP" ||
        c.varianceType === "BOTH" ||
        (c.masterSubjectCode && c.newSubjectCode && c.masterSubjectCode.trim() !== c.newSubjectCode.trim()) ||
        (c.masterSubjectName && c.newSubjectName && c.masterSubjectName.trim().toLowerCase() !== c.newSubjectName.trim().toLowerCase())
      );
    });
  }, [changedItems]);

  // Conducted Classes (De-duplicated)
  const conductedItems = useMemo(() => {
    const list: NonNullable<typeof data>["comparisons"] = [];
    const seen = new Set<string>();
    (data?.comparisons || []).forEach((c) => {
      if (c.isConducted) {
        const secCode = cleanSectionCode(c.sectionName);
        if (selectedSection && secCode && secCode !== cleanSectionCode(selectedSection)) {
          return;
        }
        const key = `${c.date}_${c.slotLabel}_${c.batch}_${secCode}`;
        if (!seen.has(key)) {
          seen.add(key);
          list.push(c);
        }
      }
    });
    return list;
  }, [data?.comparisons, selectedSection]);

  // Master scheduled classes for today / date range (strictly excluding breaks)
  const masterScheduledList = useMemo(() => {
    let list = data?.masterScheduledPeriods ?? [];
    if (selectedSection) {
      const secCode = cleanSectionCode(selectedSection);
      list = list.filter((item) => cleanSectionCode(item.sectionName) === secCode);
    }
    return list;
  }, [data?.masterScheduledPeriods, selectedSection]);

  const filteredDrawerMasterScheduled = useMemo(() => {
    if (!drawerSearch.trim()) return masterScheduledList;
    const q = drawerSearch.toLowerCase();
    return masterScheduledList.filter(
      (m) =>
        m.subjectName.toLowerCase().includes(q) ||
        m.subjectCode.toLowerCase().includes(q) ||
        m.facultyName.toLowerCase().includes(q) ||
        m.slotLabel.toLowerCase().includes(q) ||
        (m.branchCode || "").toLowerCase().includes(q) ||
        (m.branchName || "").toLowerCase().includes(q) ||
        (m.sectionName || "").toLowerCase().includes(q),
    );
  }, [masterScheduledList, drawerSearch]);

  // Master subjects quota (De-duplicated)
  const masterSubjectItems = useMemo(() => {
    const map = new Map<string, NonNullable<typeof data>["subjects"][0]>();
    (data?.subjects || []).forEach((s) => {
      if (s.masterWeeklyPeriods > 0 && !map.has(s.subjectCode)) {
        map.set(s.subjectCode, s);
      }
    });
    return Array.from(map.values());
  }, [data?.subjects]);

  // Drawer Search Filtered Results
  const filteredDrawerSubstitutions = useMemo(() => {
    if (!drawerSearch.trim()) return substitutedItems;
    const q = drawerSearch.toLowerCase();
    return substitutedItems.filter(
      (s) =>
        s.masterFacultyName.toLowerCase().includes(q) ||
        s.newFacultyName.toLowerCase().includes(q) ||
        s.masterSubjectName.toLowerCase().includes(q) ||
        s.newSubjectName.toLowerCase().includes(q) ||
        s.slotLabel.toLowerCase().includes(q) ||
        s.date.includes(q) ||
        (s.sectionName || "").toLowerCase().includes(q) ||
        (s.remarks || "").toLowerCase().includes(q),
    );
  }, [substitutedItems, drawerSearch]);

  const filteredDrawerChanges = useMemo(() => {
    if (!drawerSearch.trim()) return changedItems;
    const q = drawerSearch.toLowerCase();
    return changedItems.filter(
      (c) =>
        c.masterSubjectName.toLowerCase().includes(q) ||
        c.newSubjectName.toLowerCase().includes(q) ||
        c.masterFacultyName.toLowerCase().includes(q) ||
        c.newFacultyName.toLowerCase().includes(q) ||
        c.slotLabel.toLowerCase().includes(q) ||
        c.date.includes(q) ||
        (c.sectionName || "").toLowerCase().includes(q) ||
        (c.remarks || "").toLowerCase().includes(q),
    );
  }, [changedItems, drawerSearch]);

  const filteredDrawerSwaps = useMemo(() => {
    if (!drawerSearch.trim()) return swappedItems;
    const q = drawerSearch.toLowerCase();
    return swappedItems.filter(
      (s) =>
        s.masterSubjectName.toLowerCase().includes(q) ||
        s.newSubjectName.toLowerCase().includes(q) ||
        s.newFacultyName.toLowerCase().includes(q) ||
        s.slotLabel.toLowerCase().includes(q) ||
        s.date.includes(q) ||
        (s.sectionName || "").toLowerCase().includes(q) ||
        (s.remarks || "").toLowerCase().includes(q),
    );
  }, [swappedItems, drawerSearch]);

  const filteredDrawerConducted = useMemo(() => {
    const list = conductedItems;
    if (!drawerSearch.trim()) return list;
    const q = drawerSearch.toLowerCase();
    return list.filter(
      (c) =>
        (c.todaySubjectName || "").toLowerCase().includes(q) ||
        (c.todayFacultyName || "").toLowerCase().includes(q) ||
        c.slotLabel.toLowerCase().includes(q) ||
        c.date.includes(q) ||
        (c.sectionName || "").toLowerCase().includes(q),
    );
  }, [conductedItems, drawerSearch]);

  const filteredDrawerMaster = useMemo(() => {
    const list = masterSubjectItems;
    if (!drawerSearch.trim()) return list;
    const q = drawerSearch.toLowerCase();
    return list.filter(
      (s) =>
        s.subjectName.toLowerCase().includes(q) ||
        s.subjectCode.toLowerCase().includes(q) ||
        s.facultyNames.some((f) => f.toLowerCase().includes(q)),
    );
  }, [masterSubjectItems, drawerSearch]);

  // Handler to open Staff Profile & Action Modal
  const openStaffModalByName = useCallback((facultyName: string, hrmsId?: string | null) => {
    if (!facultyName) return;
    const cleanName = facultyName.trim().toLowerCase();
    const cleanHrms = (hrmsId || "").trim();

    const existing = (data?.faculties || []).find((f) => {
      if (cleanHrms && f.hrmsId === cleanHrms) return true;
      return f.facultyName.trim().toLowerCase() === cleanName;
    });

    if (existing) {
      setActiveStaffModal(existing);
      setStaffModalSearch("");
      return;
    }

    const catalog = (data?.catalogFaculties || []).find((cf) => {
      if (cleanHrms && cf.hrmsId === cleanHrms) return true;
      return cf.facultyName.trim().toLowerCase() === cleanName;
    });

    let masterQuota = 0;
    let conducted = 0;
    let relieved = 0;
    let subTaken = 0;
    let totalPres = 0;
    let totalAbs = 0;
    const subjects = new Set<string>();

    (data?.comparisons || []).forEach((c) => {
      const isToday =
        (cleanHrms && c.todayFacultyHrmsId === cleanHrms) ||
        (c.todayFacultyName && c.todayFacultyName.trim().toLowerCase() === cleanName);
      const isMaster =
        (cleanHrms && c.masterFacultyHrmsId === cleanHrms) ||
        (c.masterFacultyName && c.masterFacultyName.trim().toLowerCase() === cleanName);

      if (isMaster) {
        masterQuota++;
        if (c.masterSubjectName) subjects.add(c.masterSubjectName);
      }
      if (isToday) {
        if (c.isConducted) conducted++;
        totalPres += (c.presentCount || 0);
        totalAbs += (c.absentCount || 0);
      }
      if (isMaster && !isToday && c.todayFacultyName) relieved++;
      if (isToday && !isMaster && c.masterFacultyName) subTaken++;
    });

    const marked = totalPres + totalAbs;
    const turnout = marked > 0 ? Math.round((totalPres / marked) * 100) : null;

    setActiveStaffModal({
      hrmsId: catalog?.hrmsId || cleanHrms || "N/A",
      facultyName: catalog?.facultyName || facultyName,
      masterAssignedPeriods: masterQuota,
      classesConducted: conducted,
      relievedCount: relieved,
      substituteTakenCount: subTaken,
      netTeachingCount: masterQuota > 0 ? Math.max(0, masterQuota - relieved + subTaken) : conducted,
      subjects: Array.from(subjects),
      totalPresent: totalPres,
      totalAbsent: totalAbs,
      totalMarked: marked,
      attendancePct: turnout,
    });
    setStaffModalSearch("");
  }, [data]);

  // Handler to open Subject Detail & Delivery Action Modal
  const openSubjectModal = useCallback((
    sub: {
      subjectCode: string;
      subjectName: string;
      masterWeeklyPeriods: number;
      totalScheduled?: number;
      totalConducted: number;
      timesChanged: number;
      timesSwappedOut: number;
      timesSwappedIn: number;
      facultyNames?: string[];
      assignedFaculty?: string[];
      changedFaculty?: Array<{ facultyName: string; originalFacultyName?: string; count: number }>;
      turnoutPct?: number | null;
      attendancePct?: number;
      effectiveAttendancePct?: number | null;
    },
    cohortMeta?: {
      cohortTitle?: string;
      branchCode?: string;
      batch?: string;
      sectionLetter?: string;
    }
  ) => {
    setActiveSubjectModal({
      subjectCode: sub.subjectCode,
      subjectName: sub.subjectName,
      masterWeeklyPeriods: sub.masterWeeklyPeriods,
      totalScheduled: sub.totalScheduled,
      totalConducted: sub.totalConducted,
      timesChanged: sub.timesChanged,
      timesSwappedOut: sub.timesSwappedOut,
      timesSwappedIn: sub.timesSwappedIn,
      facultyNames: sub.facultyNames ?? sub.assignedFaculty ?? [],
      attendancePct: sub.attendancePct ?? sub.turnoutPct ?? 0,
      assignedFacultyNames: sub.assignedFaculty,
      changedFaculties: sub.changedFaculty,
      turnoutPct: sub.turnoutPct,
      cohortTitle: cohortMeta?.cohortTitle,
      branchCode: cohortMeta?.branchCode,
      batch: cohortMeta?.batch,
      sectionLetter: cohortMeta?.sectionLetter,
    });
    setSubjectModalSearch("");
  }, []);



  // Print / Export individual Faculty Workload & Action Audit Report to PDF
  const printFacultyPdf = useCallback(
    async (f: FacultyStat, customSessions?: ComparisonItem[]) => {
      const key = f.hrmsId || f.facultyName;
      setGeneratingPdfKey(key);
      try {
        let sessionsToUse = customSessions;
        if (!sessionsToUse || !sessionsToUse.some((s) => s.students && s.students.length > 0)) {
          const fetched = await fetchDedicatedFacultyData(f, true);
          if (fetched?.comparisons && fetched.comparisons.length > 0) {
            sessionsToUse = fetched.comparisons;
          } else if (!sessionsToUse) {
            if (activeStaffModal?.hrmsId === f.hrmsId && dedicatedStaffSessions && dedicatedStaffSessions.length > 0) {
              sessionsToUse = dedicatedStaffSessions;
            }
          }
        }

        const dateRangeLabel =
          dateMode === "range"
            ? `${startDate ? formatDisplayDate(startDate) : "Start"} to ${endDate ? formatDisplayDate(endDate) : "End"}`
            : formatDisplayDate(getTodayDateString());

        const hrms = (f.hrmsId || "").trim().toLowerCase();
        const facName = (f.facultyName || "").trim().toLowerCase();

        // Filter and map sessions for this specific faculty member
        const rawList = sessionsToUse && sessionsToUse.length > 0 ? sessionsToUse : (data?.comparisons || []);
        const facultySessions = rawList
          .filter((c) => {
            const todayHrms = (c.todayFacultyHrmsId || "").trim().toLowerCase();
            const masterHrms = (c.masterFacultyHrmsId || "").trim().toLowerCase();
            const todayName = (c.todayFacultyName || "").trim().toLowerCase();
            const masterName = (c.masterFacultyName || "").trim().toLowerCase();

            const matchHrms = Boolean(hrms) && hrms !== "n/a" && (todayHrms === hrms || masterHrms === hrms);
            const matchName = Boolean(facName) && (todayName === facName || masterName === facName);
            return matchHrms || matchName;
          })
          .map((c) => {
            const todayHrms = (c.todayFacultyHrmsId || "").trim().toLowerCase();
            const masterHrms = (c.masterFacultyHrmsId || "").trim().toLowerCase();
            const todayName = (c.todayFacultyName || "").trim().toLowerCase();
            const masterName = (c.masterFacultyName || "").trim().toLowerCase();

            const isTodayTeacher = (Boolean(hrms) && todayHrms === hrms) || (Boolean(facName) && todayName === facName);
            const isMasterTeacher = (Boolean(hrms) && masterHrms === hrms) || (Boolean(facName) && masterName === facName);

            let actionRoleTitle = "Regular Scheduled Class";
            if (isTodayTeacher && !isMasterTeacher && c.masterFacultyName) {
              actionRoleTitle = `Substitute Taken (+) for ${c.masterFacultyName}`;
            } else if (!isTodayTeacher && isMasterTeacher && c.todayFacultyName) {
              actionRoleTitle = `Relieved Away (-) by ${c.todayFacultyName}`;
            } else if (c.isConducted) {
              actionRoleTitle = "Conducted As Master";
            }

            return {
              ...c,
              isTodayTeacher,
              isMasterTeacher,
              actionRoleTitle,
            };
          });

        const totalPresent = facultySessions.reduce((acc, s) => acc + (s.isTodayTeacher ? (s.presentCount || 0) : 0), 0);
        const totalAbsent = facultySessions.reduce((acc, s) => acc + (s.isTodayTeacher ? (s.absentCount || 0) : 0), 0);
        const totalEnrolled = totalPresent + totalAbsent;
        const turnoutPct = totalEnrolled > 0 ? Math.round((totalPresent / totalEnrolled) * 100) : (f.attendancePct != null ? f.attendancePct : null);

        // Group sessions by date
        const dateMap = new Map<string, typeof facultySessions>();
        facultySessions.forEach((s) => {
          const d = s.date || "Scheduled Plan";
          if (!dateMap.has(d)) dateMap.set(d, []);
          dateMap.get(d)!.push(s);
        });
        const sortedDates = Array.from(dateMap.keys()).sort();

        let dateTablesHtml = "";
        if (sortedDates.length === 0) {
          dateTablesHtml = `
            <div style="padding: 16px; text-align: center; color: #64748b; font-size: 11px; border: 1px dashed #cbd5e1; border-radius: 6px; margin: 12px 0;">
              No timetable sessions recorded for this faculty member in the selected range (${escapeHtml(dateRangeLabel)}).
            </div>
          `;
        } else {
          sortedDates.forEach((d) => {
            const sessions = dateMap.get(d)!;
            const dayName = sessions[0]?.dayOfWeek || "";
            const dayPresent = sessions.reduce((acc, s) => acc + (s.isTodayTeacher ? (s.presentCount || 0) : 0), 0);
            const dayAbsent = sessions.reduce((acc, s) => acc + (s.isTodayTeacher ? (s.absentCount || 0) : 0), 0);
            const dayEnrolled = dayPresent + dayAbsent;
            const dayTurnout = dayEnrolled > 0 ? Math.round((dayPresent / dayEnrolled) * 100) : null;
            const dayConducted = sessions.filter((s) => s.isConducted && s.isTodayTeacher).length;

            dateTablesHtml += `
              <div style="margin-top: 14px; break-inside: avoid;">
                <div style="background-color: #f1f5f9; padding: 5px 8px; font-weight: bold; font-size: 11px; border: 1px solid #cbd5e1; border-bottom: none; display: flex; justify-content: space-between;">
                  <span>📅 Date: ${d} ${dayName ? `(${dayName})` : ""}</span>
                  <span>${sessions.length} Session(s) &bull; ${dayEnrolled > 0 || dayConducted > 0 ? `<b style="color: #15803d;">${dayPresent} Present</b> / <b style="color: #be123c;">${dayAbsent} Absent</b> ${dayTurnout != null ? `(${dayTurnout}% Attendance)` : (dayConducted > 0 ? "(100% Attendance)" : "")}` : '<span style="color: #64748b; font-weight: 500;">Attendance Pending</span>'}</span>
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 8px;">
                  <thead>
                    <tr style="background-color: #f1f5f9; color: #0f172a; font-weight: 700; border-bottom: 2px solid #cbd5e1;">
                      <th style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: left; color: #0f172a;">Slot & Time</th>
                      <th style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: left; color: #0f172a;">Class & Section</th>
                      <th style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: left; color: #0f172a;">Subject Name & Code</th>
                      <th style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: left; color: #0f172a;">Action Role Taken</th>
                      <th style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; color: #0f172a;">Conducted</th>
                      <th style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; color: #0f172a;">Enrolled</th>
                      <th style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; color: #0f172a;">Present</th>
                      <th style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; color: #0f172a;">Absent</th>
                      <th style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; color: #0f172a;">Attendance %</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${sessions
                      .map((s) => {
                        const sEnrolled = (s.presentCount || 0) + (s.absentCount || 0);
                        const sPres = s.presentCount || 0;
                        const sAbs = s.absentCount || 0;
                        const sEnrolledTotal = (s.enrolledCount && s.enrolledCount > 0) ? s.enrolledCount : (sEnrolled > 0 ? sEnrolled : 0);
                        const sTurnout = s.isConducted ? (s.attendancePct != null ? `${s.attendancePct}%` : (sEnrolled > 0 ? `${Math.round((sPres / sEnrolled) * 100)}%` : "100%")) : "Pending";
                        return `
                      <tr>
                        <td style="padding: 5px 6px; border: 1px solid #cbd5e1;">${escapeHtml(s.slotLabel)} (${escapeHtml(s.time)})</td>
                        <td style="padding: 5px 6px; border: 1px solid #cbd5e1;">${formatSessionClassInfo(s, true)}</td>
                        <td style="padding: 5px 6px; border: 1px solid #cbd5e1;">
                          <b>${escapeHtml(s.todaySubjectName || s.masterSubjectName || "—")}</b> 
                          <span style="color: #64748b;">(${escapeHtml(s.todaySubjectCode || s.masterSubjectCode || "")})</span>
                        </td>
                        <td style="padding: 5px 6px; border: 1px solid #cbd5e1; font-weight: bold; color: ${s.isTodayTeacher && !s.isMasterTeacher ? "#0369a1" : !s.isTodayTeacher && s.isMasterTeacher ? "#be123c" : "#0f172a"};">
                          ${escapeHtml(s.actionRoleTitle)}
                        </td>
                        <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center;">
                          ${s.isConducted ? '<span style="color: #15803d; font-weight: bold;">Yes ✓</span>' : '<span style="color: #64748b;">Scheduled</span>'}
                        </td>
                        <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 500;">
                          ${sEnrolledTotal > 0 ? sEnrolledTotal : "—"}
                        </td>
                        <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #15803d;">
                          ${s.isConducted ? sPres : "—"}
                        </td>
                        <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: ${sAbs > 0 ? "#be123c" : "#64748b"};">
                          ${s.isConducted ? sAbs : "—"}
                        </td>
                        <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #0369a1;">
                          ${sTurnout}
                        </td>
                      </tr>
                    `;
                      })
                      .join("")}
                    <tr style="background-color: #f8fafc; font-weight: bold; border-top: 2px solid #cbd5e1;">
                      <td colspan="4" style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: right;">Day Total:</td>
                      <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; color: #15803d;">${dayConducted} Held</td>
                      <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center;">${dayEnrolled > 0 || dayConducted > 0 ? dayEnrolled : "—"}</td>
                      <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; color: #15803d;">${dayPresent > 0 || dayConducted > 0 ? dayPresent : "—"}</td>
                      <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; color: #be123c;">${dayAbsent > 0 || dayConducted > 0 ? dayAbsent : "—"}</td>
                      <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; color: #0369a1;">${dayTurnout != null ? `${dayTurnout}%` : (dayConducted > 0 ? "100%" : "Pending")}</td>
                    </tr>
                  </tbody>
                </table>

                <!-- Detailed Student Attendance Rosters for this Date -->
                <div style="margin-top: 8px; margin-bottom: 12px;">
                  <div style="font-size: 10px; font-weight: bold; color: #047857; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.5px; border-bottom: 1.5px solid #a7f3d0; padding-bottom: 2px;">
                    Detailed Student Attendance Records &bull; Date: ${d}
                  </div>
                  ${sessions.map((s) => {
                    const classLabel = formatSessionClassInfo(s, true);
                    const hasStudents = s.students && s.students.length > 0;
                    const presCount = hasStudents ? s.students!.filter((st) => st.status === 'present').length : s.presentCount || 0;
                    const absCount = hasStudents ? s.students!.filter((st) => st.status === 'absent').length : s.absentCount || 0;
                    const enrCount = hasStudents ? s.students!.length : (s.enrolledCount || presCount + absCount);

                    if (!hasStudents) {
                      return `
                        <div style="margin-top: 5px; margin-bottom: 6px; padding: 5px 8px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 9.5px; display: flex; justify-content: space-between; align-items: center;">
                          <span>
                            <strong>${escapeHtml(s.slotLabel)} (${escapeHtml(s.time)})</strong> &bull; 
                            ${classLabel} &bull; 
                            <b>${escapeHtml(s.todaySubjectName || s.masterSubjectName || "Subject")}</b> (${escapeHtml(s.todaySubjectCode || s.masterSubjectCode || "")})
                          </span>
                          <span style="color: #64748b; font-weight: 600;">
                            ${s.isConducted ? 'Attendance post recorded without individual student list' : `Attendance Pending (${enrCount > 0 ? `${enrCount} Enrolled` : "Scheduled"})`}
                          </span>
                        </div>
                      `;
                    }

                    return `
                      <div style="margin-top: 6px; margin-bottom: 10px; border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden; break-inside: avoid;">
                        <div style="background-color: #f8fafc; padding: 4px 8px; font-size: 10px; font-weight: bold; border-bottom: 1px solid #cbd5e1; display: flex; justify-content: space-between; align-items: center;">
                          <span>
                            📋 <strong>${escapeHtml(s.slotLabel)} (${escapeHtml(s.time)})</strong> &bull; 
                            ${classLabel} &bull; 
                            <b>${escapeHtml(s.todaySubjectName || s.masterSubjectName || "")}</b> 
                            <span style="color: #64748b;">(${escapeHtml(s.todaySubjectCode || s.masterSubjectCode || "")})</span>
                          </span>
                          <span>
                            <span style="color: #15803d; font-weight: bold;">${presCount} Present</span> / 
                            <span style="color: #be123c; font-weight: bold;">${absCount} Absent</span> 
                            <span style="color: #475569; font-weight: 600;">(Total Enrolled: ${enrCount})</span>
                          </span>
                        </div>
                        <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
                          <thead>
                            <tr style="background-color: #f1f5f9; color: #334155; font-weight: 700; border-bottom: 1px solid #cbd5e1;">
                              <th style="padding: 3px 6px; border: 1px solid #e2e8f0; width: 28px; text-align: center;">#</th>
                              <th style="padding: 3px 6px; border: 1px solid #e2e8f0; width: 120px; text-align: left;">Roll / PIN No</th>
                              <th style="padding: 3px 6px; border: 1px solid #e2e8f0; text-align: left;">Student Name</th>
                              <th style="padding: 3px 6px; border: 1px solid #e2e8f0; width: 85px; text-align: center;">Status</th>
                              <th style="padding: 3px 6px; border: 1px solid #e2e8f0; width: 110px; text-align: left;">Remarks</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${s.students!.map((st, sIdx) => `
                              <tr style="background-color: ${sIdx % 2 === 0 ? "#ffffff" : "#fbfcfe"};">
                                <td style="padding: 2.5px 6px; border: 1px solid #e2e8f0; text-align: center; color: #64748b;">${sIdx + 1}</td>
                                <td style="padding: 2.5px 6px; border: 1px solid #e2e8f0; font-family: monospace; font-weight: 600;">${escapeHtml(st.rollNo)}</td>
                                <td style="padding: 2.5px 6px; border: 1px solid #e2e8f0; font-weight: 500; color: #0f172a;">${escapeHtml(st.studentName)}</td>
                                <td style="padding: 2.5px 6px; border: 1px solid #e2e8f0; text-align: center;">
                                  <span style="font-size: 8.5px; font-weight: bold; padding: 1.5px 6px; border-radius: 3px; display: inline-block; ${
                                    st.status === 'present'
                                      ? "background-color: #dcfce7; color: #15803d; border: 1px solid #bbf7d0;"
                                      : st.status === 'absent'
                                      ? "background-color: #fee2e2; color: #b91c1c; border: 1px solid #fecaca;"
                                      : "background-color: #f1f5f9; color: #475569; border: 1px solid #e2e8f0;"
                                  }">
                                    ${st.status.toUpperCase()}
                                  </span>
                                </td>
                                <td style="padding: 2.5px 6px; border: 1px solid #e2e8f0; color: #64748b; font-size: 8.5px;">${escapeHtml(st.remarks || "—")}</td>
                              </tr>
                            `).join("")}
                          </tbody>
                        </table>
                      </div>
                    `;
                  }).join("")}
                </div>
              </div>
            `;
          });
        }

        const effectiveMasterQuota = facultySessions.filter((s) => s.isMasterTeacher).length || f.masterAssignedPeriods;
        const effectiveConducted = facultySessions.filter((s) => s.isTodayTeacher && s.isConducted).length || f.classesConducted;
        const effectiveRelieved = facultySessions.filter((s) => !s.isTodayTeacher && s.isMasterTeacher && s.todayFacultyName).length || f.relievedCount;
        const effectiveSubTaken = facultySessions.filter((s) => s.isTodayTeacher && !s.isMasterTeacher && s.masterFacultyName).length || f.substituteTakenCount;
        const effectiveNetLoad = effectiveMasterQuota > 0 ? Math.max(0, effectiveMasterQuota - effectiveRelieved + effectiveSubTaken) : effectiveConducted;
        const netShift = effectiveSubTaken - effectiveRelieved;

        const generatedDateTime = `${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} at ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;

        const htmlContent = `
          <div style="font-family: Arial, Helvetica, sans-serif; color: #0f172a; padding: 12px; line-height: 1.4;">
            <!-- Official Institution Masthead -->
            <div style="text-align: center; border-bottom: 3px double #0f172a; padding-bottom: 10px; margin-bottom: 14px;">
              <div style="text-align: center; margin-bottom: 4px;">
                <span style="font-size: 9px; font-weight: bold; color: #64748b; letter-spacing: 1px; text-transform: uppercase;">
                  ACADEMIC PORTAL &bull; TIMETABLE AUDIT SYSTEM
                </span>
              </div>
              <h1 style="margin: 0; font-size: 19px; font-weight: 800; color: #0f172a; letter-spacing: 0.5px; text-transform: uppercase;">
                FACULTY WORKLOAD & SUBSTITUTION AUDIT REPORT
              </h1>
              <p style="margin: 3px 0 0; font-size: 11px; font-weight: 600; color: #1e3a8a; letter-spacing: 0.5px;">
                Individual Teaching Record, Quota Conduction & Substitution Audit Log
              </p>
              <p style="margin: 3px 0 0; font-size: 10px; color: #64748b;">
                Academic Year: <strong>${escapeHtml(academicYear || "Current")}</strong> &bull; Period: <strong>${escapeHtml(dateRangeLabel)}</strong> &bull; Generated: ${generatedDateTime}
              </p>
            </div>

            <!-- Faculty Metadata Box -->
            <div style="margin-bottom: 12px; border: 1px solid #cbd5e1; border-radius: 6px; background-color: #f8fafc; padding: 8px 12px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                <tr>
                  <td style="width: 50%; padding: 3px 0;"><strong>Faculty Name:</strong> <span style="font-size: 12px; font-weight: bold; color: #0f172a;">${escapeHtml(f.facultyName)}</span></td>
                  <td style="width: 50%; padding: 3px 0;"><strong>HRMS Employee ID:</strong> <span style="font-family: monospace; font-weight: bold;">#${escapeHtml(f.hrmsId)}</span></td>
                </tr>
                <tr>
                  <td style="padding: 3px 0;"><strong>Department / Scope:</strong> ${escapeHtml(selectedCohortTitle || "All Sections")}</td>
                  <td style="padding: 3px 0;"><strong>Assigned Subjects:</strong> ${escapeHtml((f.subjects || []).join(", ") || "None")}</td>
                </tr>
              </table>
            </div>

            <!-- 1. Executive Workload Abstract -->
            <div style="margin-bottom: 14px; break-inside: avoid;">
              <h3 style="font-size: 11px; text-transform: uppercase; margin: 0 0 5px; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; font-weight: bold;">
                1. Executive Abstract & Workload Metrics
              </h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 8px;">
                <thead>
                  <tr style="background-color: #f1f5f9; color: #0f172a; font-weight: 700; border: 1px solid #cbd5e1;">
                    <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a;">Master Quota</th>
                    <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a;">Classes Conducted</th>
                    <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a;">Relieved Away (-)</th>
                    <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a;">Substitute Taken (+)</th>
                    <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a;">Net Teaching Load</th>
                    <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a;">Net Variance</th>
                    <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a;">Students Enrolled</th>
                    <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a;">Students Present</th>
                    <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a;">Students Absent</th>
                    <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a;">Attendance Rate</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style="text-align: center; font-weight: bold; background-color: #f8fafc;">
                    <td style="padding: 7px; border: 1px solid #cbd5e1; font-size: 12px; color: #334155;">${effectiveMasterQuota} p/wk</td>
                    <td style="padding: 7px; border: 1px solid #cbd5e1; font-size: 12px; color: #15803d;">${effectiveConducted} held</td>
                    <td style="padding: 7px; border: 1px solid #cbd5e1; font-size: 12px; color: #be123c;">${effectiveRelieved > 0 ? `-${effectiveRelieved}` : 0}</td>
                    <td style="padding: 7px; border: 1px solid #cbd5e1; font-size: 12px; color: #0284c7;">${effectiveSubTaken > 0 ? `+${effectiveSubTaken}` : 0}</td>
                    <td style="padding: 7px; border: 1px solid #cbd5e1; font-size: 12px; color: #0f172a;">${effectiveNetLoad} sessions</td>
                    <td style="padding: 7px; border: 1px solid #cbd5e1; font-size: 11px; color: ${netShift >= 0 ? "#15803d" : "#be123c"};">
                      ${netShift >= 0 ? "+" : ""}${netShift} shift
                    </td>
                    <td style="padding: 7px; border: 1px solid #cbd5e1; font-size: 12px; color: #334155;">${totalEnrolled > 0 ? totalEnrolled : "—"}</td>
                    <td style="padding: 7px; border: 1px solid #cbd5e1; font-size: 12px; color: #15803d;">${effectiveConducted > 0 && totalPresent > 0 ? totalPresent : (effectiveConducted > 0 ? 0 : "—")}</td>
                    <td style="padding: 7px; border: 1px solid #cbd5e1; font-size: 12px; color: #be123c;">${effectiveConducted > 0 && totalAbsent > 0 ? totalAbsent : (effectiveConducted > 0 ? 0 : "—")}</td>
                    <td style="padding: 7px; border: 1px solid #cbd5e1; font-size: 12px; color: #1e40af;">${effectiveConducted > 0 && turnoutPct != null ? `${turnoutPct}%` : (effectiveConducted > 0 ? "100%" : "Pending")}</td>
                  </tr>
                </tbody>
              </table>

              <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                <tr>
                  <td style="width: 30%; font-weight: bold; padding: 5px; border: 1px solid #cbd5e1; background-color: #f1f5f9;">Assigned Curriculum Subjects:</td>
                  <td style="padding: 5px; border: 1px solid #cbd5e1;">${escapeHtml((f.subjects || []).join(", ") || "None")}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold; padding: 5px; border: 1px solid #cbd5e1; background-color: #f1f5f9;">Substitutions Covered for Colleagues:</td>
                  <td style="padding: 5px; border: 1px solid #cbd5e1; font-weight: bold; color: #0284c7;">${effectiveSubTaken} session(s) taken (+)</td>
                </tr>
                <tr>
                  <td style="font-weight: bold; padding: 5px; border: 1px solid #cbd5e1; background-color: #f1f5f9;">Absence / Relief Covered by Colleagues:</td>
                  <td style="padding: 5px; border: 1px solid #cbd5e1; font-weight: bold; color: #be123c;">${effectiveRelieved} session(s) relieved (-)</td>
                </tr>
              </table>
            </div>

            <!-- 2. Date-wise Breakdown -->
            <div>
              <h3 style="font-size: 11px; text-transform: uppercase; margin: 12px 0 4px; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; font-weight: bold;">
                2. Date-wise Timetable Delivery & Substitution Actions (${dateRangeLabel})
              </h3>
              ${dateTablesHtml}
            </div>

            <!-- Official Sign-off Block -->
            <div style="margin-top: 36px; padding-top: 14px; border-top: 1px solid #cbd5e1; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; text-align: center; break-inside: avoid;">
              <div>
                <div style="height: 38px;"></div>
                <p style="margin: 0; font-size: 11px; font-weight: bold; color: #0f172a; border-top: 1px dashed #64748b; padding-top: 4px;">
                  Timetable Coordinator
                </p>
                <span style="font-size: 9px; color: #64748b;">Timetable & Conduction Cell</span>
              </div>
              <div>
                <div style="height: 38px;"></div>
                <p style="margin: 0; font-size: 11px; font-weight: bold; color: #0f172a; border-top: 1px dashed #64748b; padding-top: 4px;">
                  Head of the Department (HOD)
                </p>
                <span style="font-size: 9px; color: #64748b;">Academic Affairs</span>
              </div>
              <div>
                <div style="height: 38px;"></div>
                <p style="margin: 0; font-size: 11px; font-weight: bold; color: #0f172a; border-top: 1px dashed #64748b; padding-top: 4px;">
                  Principal / Dean of Academics
                </p>
                <span style="font-size: 9px; color: #64748b;">Institution Seal & Approval</span>
              </div>
            </div>
          </div>
        `;

        printHtml(htmlContent, {
          title: `Staff_Report_${(f.hrmsId || f.facultyName).replace(/\s+/g, "_")}_${dateMode === "range" ? `${startDate}_to_${endDate}` : getTodayDateString()}`,
          subtitle: `Faculty workload and action audit report for ${f.facultyName} (#${f.hrmsId})`,
          hideHeader: true,
        });
      } finally {
        setGeneratingPdfKey(null);
      }
    },
    [
      activeStaffModal,
      dedicatedStaffSessions,
      fetchDedicatedFacultyData,
      dateMode,
      startDate,
      endDate,
      data?.comparisons,
      academicYear,
      selectedCohortTitle,
    ],
  );

  // Export individual Faculty Workload & Action Audit Report to Excel (.xls)
  const exportFacultyExcel = useCallback(
    async (f: FacultyStat, customSessions?: ComparisonItem[]) => {
      const key = f.hrmsId || f.facultyName;
      setGeneratingExcelKey(key);
      try {
        let sessionsToUse = customSessions;
        if (!sessionsToUse || !sessionsToUse.some((s) => s.students && s.students.length > 0)) {
          const fetched = await fetchDedicatedFacultyData(f, true);
          if (fetched?.comparisons && fetched.comparisons.length > 0) {
            sessionsToUse = fetched.comparisons;
          } else if (!sessionsToUse) {
            if (activeStaffModal?.hrmsId === f.hrmsId && dedicatedStaffSessions && dedicatedStaffSessions.length > 0) {
              sessionsToUse = dedicatedStaffSessions;
            }
          }
        }

        const dateRangeLabel =
          dateMode === "range"
            ? `${startDate || "Start"} to ${endDate || "End"}`
            : getTodayDateString();

        const hrms = (f.hrmsId || "").trim().toLowerCase();
        const facName = (f.facultyName || "").trim().toLowerCase();

        const rawList = sessionsToUse && sessionsToUse.length > 0 ? sessionsToUse : (data?.comparisons || []);
        const facultySessions = rawList
          .filter((c) => {
            const todayHrms = (c.todayFacultyHrmsId || "").trim().toLowerCase();
            const masterHrms = (c.masterFacultyHrmsId || "").trim().toLowerCase();
            const todayName = (c.todayFacultyName || "").trim().toLowerCase();
            const masterName = (c.masterFacultyName || "").trim().toLowerCase();

            const matchHrms = Boolean(hrms) && hrms !== "n/a" && (todayHrms === hrms || masterHrms === hrms);
            const matchName = Boolean(facName) && (todayName === facName || masterName === facName);
            return matchHrms || matchName;
          })
          .map((c) => {
            const todayHrms = (c.todayFacultyHrmsId || "").trim().toLowerCase();
            const masterHrms = (c.masterFacultyHrmsId || "").trim().toLowerCase();
            const todayName = (c.todayFacultyName || "").trim().toLowerCase();
            const masterName = (c.masterFacultyName || "").trim().toLowerCase();

            const isTodayTeacher = (Boolean(hrms) && todayHrms === hrms) || (Boolean(facName) && todayName === facName);
            const isMasterTeacher = (Boolean(hrms) && masterHrms === hrms) || (Boolean(facName) && masterName === facName);

            let actionRoleTitle = "Regular Scheduled Class";
            if (isTodayTeacher && !isMasterTeacher && c.masterFacultyName) {
              actionRoleTitle = `Substitute Taken (+) for ${c.masterFacultyName}`;
            } else if (!isTodayTeacher && isMasterTeacher && c.todayFacultyName) {
              actionRoleTitle = `Relieved Away (-) by ${c.todayFacultyName}`;
            } else if (c.isConducted) {
              actionRoleTitle = "Conducted As Master";
            }

            return {
              ...c,
              isTodayTeacher,
              isMasterTeacher,
              actionRoleTitle,
            };
          });

        const dateMap = new Map<string, typeof facultySessions>();
        facultySessions.forEach((s) => {
          const d = s.date || "Scheduled";
          if (!dateMap.has(d)) dateMap.set(d, []);
          dateMap.get(d)!.push(s);
        });
        const sortedDates = Array.from(dateMap.keys()).sort();

        const effectiveMasterQuota = facultySessions.filter((s) => s.isMasterTeacher).length || f.masterAssignedPeriods;
        const effectiveConducted = facultySessions.filter((s) => s.isTodayTeacher && s.isConducted).length || f.classesConducted;
        const effectiveRelieved = facultySessions.filter((s) => !s.isTodayTeacher && s.isMasterTeacher && s.todayFacultyName).length || f.relievedCount;
        const effectiveSubTaken = facultySessions.filter((s) => s.isTodayTeacher && !s.isMasterTeacher && s.masterFacultyName).length || f.substituteTakenCount;
        const effectiveNetLoad = effectiveMasterQuota > 0 ? Math.max(0, effectiveMasterQuota - effectiveRelieved + effectiveSubTaken) : effectiveConducted;

        const totalPresent = facultySessions.reduce((acc, s) => acc + (s.isTodayTeacher ? (s.presentCount || 0) : 0), 0);
        const totalAbsent = facultySessions.reduce((acc, s) => acc + (s.isTodayTeacher ? (s.absentCount || 0) : 0), 0);
        const totalEnrolled = totalPresent + totalAbsent;
        const turnoutPct = totalEnrolled > 0 ? Math.round((totalPresent / totalEnrolled) * 100) : (f.attendancePct != null ? f.attendancePct : null);

        const sheets: ExcelWorksheet[] = [];

        // --- Sheet 1: Overview ---
        const overviewRows: ExcelRow[] = [
          { cells: [{ value: "ACADEMIC PORTAL • FACULTY WORKLOAD & ATTENDANCE AUDIT", styleId: "Title", mergeAcross: 9 }] },
          { cells: [{ value: `Faculty: ${f.facultyName} | HRMS ID: #${f.hrmsId} | Scope: ${selectedCohortTitle || "All Sections"} | Period: ${dateRangeLabel} | Academic Year: ${academicYear || "Current"}`, styleId: "Subtitle", mergeAcross: 9 }] },
          { cells: [] },
          { cells: [{ value: "1. EXECUTIVE ABSTRACT & WORKLOAD METRICS", styleId: "SectionHeader", mergeAcross: 9 }] },
          {
            cells: [
              { value: "Master Quota (p/wk)", styleId: "KpiLabel" },
              { value: "Classes Conducted", styleId: "KpiLabel" },
              { value: "Relieved Away (-)", styleId: "KpiLabel" },
              { value: "Substitute Taken (+)", styleId: "KpiLabel" },
              { value: "Net Teaching Load", styleId: "KpiLabel" },
              { value: "Enrolled", styleId: "KpiLabel" },
              { value: "Students Present", styleId: "KpiLabel" },
              { value: "Students Absent", styleId: "KpiLabel" },
              { value: "Attendance %", styleId: "KpiLabel" },
            ],
          },
          {
            cells: [
              { value: effectiveMasterQuota, styleId: "CellCenter" },
              { value: effectiveConducted, styleId: "KpiEmerald" },
              { value: effectiveRelieved > 0 ? `-${effectiveRelieved}` : 0, styleId: "KpiRose" },
              { value: effectiveSubTaken > 0 ? `+${effectiveSubTaken}` : 0, styleId: "KpiSky" },
              { value: effectiveNetLoad, styleId: "KpiVal" },
              { value: f.totalEnrolled || totalEnrolled > 0 ? (f.totalEnrolled || totalEnrolled) : "—", styleId: "CellCenter" },
              { value: effectiveConducted > 0 && totalPresent > 0 ? totalPresent : (effectiveConducted > 0 ? 0 : "—"), styleId: "CellPresent" },
              { value: effectiveConducted > 0 && totalAbsent > 0 ? totalAbsent : (effectiveConducted > 0 ? 0 : "—"), styleId: "CellAbsent" },
              { value: effectiveConducted > 0 && turnoutPct != null ? `${turnoutPct}%` : (effectiveConducted > 0 ? "100%" : "Pending"), styleId: "CellTurnout" },
            ],
          },
          { cells: [] },
          { cells: [{ value: "2. REGISTERED CURRICULUM SUBJECTS & ACTIONS", styleId: "SectionHeader", mergeAcross: 9 }] },
          { cells: [{ value: "Assigned Subjects:", styleId: "CellBoldCenter" }, { value: (f.subjects || []).join(", ") || "None", styleId: "CellNormal", mergeAcross: 8 }] },
          { cells: [{ value: "Substitutions Covered for Colleagues:", styleId: "CellBoldCenter" }, { value: `${effectiveSubTaken} session(s) taken (+)`, styleId: "CellNormal", mergeAcross: 8 }] },
          { cells: [{ value: "Relief Covered by Colleagues:", styleId: "CellBoldCenter" }, { value: `${effectiveRelieved} session(s) relieved (-)`, styleId: "CellNormal", mergeAcross: 8 }] },
          { cells: [] },
          { cells: [{ value: `3. SUMMARY BY DATE (${sortedDates.length} Days Recorded)`, styleId: "SectionHeader", mergeAcross: 7 }] },
          {
            cells: [
              { value: "Date", styleId: "ColHeaderEmerald" },
              { value: "Day", styleId: "ColHeaderEmerald" },
              { value: "Total Sessions", styleId: "ColHeaderEmerald" },
              { value: "Conducted", styleId: "ColHeaderEmerald" },
              { value: "Students Enrolled", styleId: "ColHeaderEmerald" },
              { value: "Students Present", styleId: "ColHeaderEmerald" },
              { value: "Students Absent", styleId: "ColHeaderEmerald" },
              { value: "Attendance %", styleId: "ColHeaderEmerald" },
            ],
          },
        ];

        sortedDates.forEach((d) => {
          const sessions = dateMap.get(d)!;
          const dayName = sessions[0]?.dayOfWeek || "";
          const dayPres = sessions.reduce((acc, s) => acc + (s.presentCount || 0), 0);
          const dayAbs = sessions.reduce((acc, s) => acc + (s.absentCount || 0), 0);
          const dayEnr = dayPres + dayAbs;
          const dayTurnout = dayEnr > 0 ? Math.round((dayPres / dayEnr) * 100) : null;
          const dayHeld = sessions.filter((s) => s.isConducted).length;

          overviewRows.push({
            cells: [
              { value: d, styleId: "CellNormal" },
              { value: dayName, styleId: "CellNormal" },
              { value: sessions.length, styleId: "CellCenter" },
              { value: dayHeld, styleId: "CellPresent" },
              { value: dayEnr > 0 || dayHeld > 0 ? dayEnr : "—", styleId: "CellCenter" },
              { value: dayPres > 0 || dayHeld > 0 ? dayPres : "—", styleId: "CellPresent" },
              { value: dayAbs > 0 || dayHeld > 0 ? dayAbs : "—", styleId: "CellAbsent" },
              { value: dayTurnout != null ? `${dayTurnout}%` : (dayHeld > 0 ? "100%" : "Pending"), styleId: "CellTurnout" },
            ],
          });
        });

        sheets.push({
          name: "Overview",
          columns: [
            { width: 14 }, { width: 12 }, { width: 16 }, { width: 14 },
            { width: 16 }, { width: 14 }, { width: 14 }, { width: 16 },
            { width: 14 }, { width: 14 }
          ],
          rows: overviewRows,
        });

        // --- Subsequent Sheets: One Sheet Per Date ---
        sortedDates.forEach((d) => {
          const sessions = dateMap.get(d)!;
          const dayName = sessions[0]?.dayOfWeek || "";
          const dayPres = sessions.reduce((acc, s) => acc + (s.presentCount || 0), 0);
          const dayAbs = sessions.reduce((acc, s) => acc + (s.absentCount || 0), 0);
          const dayEnr = dayPres + dayAbs;
          const dayTurnout = dayEnr > 0 ? Math.round((dayPres / dayEnr) * 100) : null;
          const dayHeld = sessions.filter((s) => s.isConducted).length;

          const dateRows: ExcelRow[] = [
            { cells: [{ value: `DATE-WISE TIMETABLE & STUDENT ATTENDANCE LOG — ${d} (${dayName})`, styleId: "Title", mergeAcross: 10 }] },
            { cells: [{ value: `Faculty: ${f.facultyName} (#${f.hrmsId}) | Day Sessions: ${sessions.length} | Conducted: ${dayHeld} | Enrolled: ${dayEnr > 0 ? dayEnr : "—"} | Present: ${dayPres > 0 ? dayPres : (dayEnr > 0 ? 0 : "—")} | Absent: ${dayAbs > 0 ? dayAbs : (dayEnr > 0 ? 0 : "—")} | Attendance: ${dayTurnout != null ? `${dayTurnout}%` : (dayHeld > 0 ? "100%" : "Pending")}`, styleId: "Subtitle", mergeAcross: 10 }] },
            { cells: [] },
            {
              cells: [
                { value: "Date", styleId: "ColHeaderEmerald" },
                { value: "Day", styleId: "ColHeaderEmerald" },
                { value: "Slot & Time", styleId: "ColHeaderEmerald" },
                { value: "Class & Section", styleId: "ColHeaderEmerald" },
                { value: "Subject", styleId: "ColHeaderEmerald" },
                { value: "Action Role / Status", styleId: "ColHeaderEmerald" },
                { value: "Conducted", styleId: "ColHeaderEmerald" },
                { value: "Enrolled", styleId: "ColHeaderEmerald" },
                { value: "Present", styleId: "ColHeaderEmerald" },
                { value: "Absent", styleId: "ColHeaderEmerald" },
                { value: "Attendance %", styleId: "ColHeaderEmerald" },
              ],
            },
          ];

          sessions.forEach((s) => {
            const sEnr = (s.presentCount || 0) + (s.absentCount || 0);
            const sPres = s.presentCount || 0;
            const sAbs = s.absentCount || 0;
            const sEnrolledTotal = (s.enrolledCount && s.enrolledCount > 0) ? s.enrolledCount : (sEnr > 0 ? sEnr : 0);
            const sTurnout = s.isConducted ? (s.attendancePct != null ? `${s.attendancePct}%` : (sEnr > 0 ? `${Math.round((sPres / sEnr) * 100)}%` : "100%")) : "Pending";

            dateRows.push({
              cells: [
                { value: s.date, styleId: "CellNormal" },
                { value: s.dayOfWeek || "", styleId: "CellNormal" },
                { value: `${s.slotLabel} (${s.time})`, styleId: "CellNormal" },
                { value: formatSessionClassInfo(s, false), styleId: "CellNormal" },
                { value: `${s.todaySubjectName || s.masterSubjectName || "—"} (${s.todaySubjectCode || s.masterSubjectCode || ""})`, styleId: "CellNormal" },
                { value: s.actionRoleTitle, styleId: "CellNormal" },
                { value: s.isConducted ? "Conducted ✓" : "Scheduled", styleId: s.isConducted ? "CellPresent" : "CellNormal" },
                { value: sEnrolledTotal > 0 ? sEnrolledTotal : "—", styleId: "CellCenter" },
                { value: s.isConducted ? sPres : "—", styleId: "CellPresent" },
                { value: s.isConducted ? sAbs : "—", styleId: "CellAbsent" },
                { value: sTurnout, styleId: "CellTurnout" },
              ],
            });
          });

          // Day Total Row
          dateRows.push({
            cells: [
              { value: "Day Total", styleId: "SubTotalRow" },
              { value: "", styleId: "SubTotalRow" },
              { value: "", styleId: "SubTotalRow" },
              { value: "", styleId: "SubTotalRow" },
              { value: "", styleId: "SubTotalRow" },
              { value: "", styleId: "SubTotalRow" },
              { value: `${dayHeld} Held`, styleId: "SubTotalRow" },
              { value: dayEnr > 0 ? dayEnr : "—", styleId: "SubTotalRow" },
              { value: dayPres > 0 ? dayPres : (dayEnr > 0 ? 0 : "—"), styleId: "CellPresent" },
              { value: dayAbs > 0 ? dayAbs : (dayEnr > 0 ? 0 : "—"), styleId: "CellAbsent" },
              { value: dayTurnout != null ? `${dayTurnout}%` : (dayHeld > 0 ? "100%" : "Pending"), styleId: "CellTurnout" },
            ],
          });

          sheets.push({
            name: sanitizeSheetName(d),
            columns: [
              { width: 12 }, { width: 10 }, { width: 16 }, { width: 22 },
              { width: 24 }, { width: 22 }, { width: 13 },
              { width: 10 }, { width: 10 }, { width: 10 }, { width: 12 }
            ],
            rows: dateRows,
          });
        });

        // --- Sheet: Full Student Attendance Details ---
        const studentDetailRows: ExcelRow[] = [
          { cells: [{ value: `STUDENT-LEVEL ATTENDANCE ROSTER & MARKS AUDIT — ${f.facultyName} (#${f.hrmsId})`, styleId: "Title", mergeAcross: 10 }] },
          { cells: [{ value: `Faculty: ${f.facultyName} | Scope: ${selectedCohortTitle || "All Sections"} | Period: ${dateRangeLabel}`, styleId: "Subtitle", mergeAcross: 10 }] },
          { cells: [] },
          {
            cells: [
              { value: "Date", styleId: "ColHeaderEmerald" },
              { value: "Slot & Time", styleId: "ColHeaderEmerald" },
              { value: "Class & Section", styleId: "ColHeaderEmerald" },
              { value: "Subject Code", styleId: "ColHeaderEmerald" },
              { value: "Subject Name", styleId: "ColHeaderEmerald" },
              { value: "Role / Delivery", styleId: "ColHeaderEmerald" },
              { value: "S.No", styleId: "ColHeaderEmerald" },
              { value: "Roll / PIN No", styleId: "ColHeaderEmerald" },
              { value: "Student Name", styleId: "ColHeaderEmerald" },
              { value: "Attendance Status", styleId: "ColHeaderEmerald" },
              { value: "Remarks", styleId: "ColHeaderEmerald" },
            ],
          },
        ];

        facultySessions.forEach((s) => {
          const classStr = formatSessionClassInfo(s, false);
          const subCode = s.todaySubjectCode || s.masterSubjectCode || "—";
          const subName = s.todaySubjectName || s.masterSubjectName || "—";
          const role = s.actionRoleTitle || "Regular Class";

          if (s.students && s.students.length > 0) {
            s.students.forEach((st, sIdx) => {
              const isPres = st.status === "present";
              const isAbs = st.status === "absent";
              studentDetailRows.push({
                cells: [
                  { value: s.date, styleId: "CellNormal" },
                  { value: `${s.slotLabel} (${s.time})`, styleId: "CellNormal" },
                  { value: classStr, styleId: "CellNormal" },
                  { value: subCode, styleId: "CellCenter" },
                  { value: subName, styleId: "CellNormal" },
                  { value: role, styleId: "CellNormal" },
                  { value: sIdx + 1, styleId: "CellCenter" },
                  { value: st.rollNo, styleId: "CellNormal" },
                  { value: st.studentName, styleId: "CellNormal" },
                  { value: st.status.toUpperCase(), styleId: isPres ? "CellPresent" : isAbs ? "CellAbsent" : "CellNormal" },
                  { value: st.remarks || "—", styleId: "CellNormal" },
                ],
              });
            });
          } else {
            studentDetailRows.push({
              cells: [
                { value: s.date, styleId: "CellNormal" },
                { value: `${s.slotLabel} (${s.time})`, styleId: "CellNormal" },
                { value: classStr, styleId: "CellNormal" },
                { value: subCode, styleId: "CellCenter" },
                { value: subName, styleId: "CellNormal" },
                { value: role, styleId: "CellNormal" },
                { value: "—", styleId: "CellCenter" },
                { value: "—", styleId: "CellCenter" },
                { value: s.isConducted ? "Attendance post recorded without individual student list" : "Attendance Pending (Session Scheduled)", styleId: "CellNormal" },
                { value: s.isConducted ? "CONDUCTED" : "PENDING", styleId: "CellCenter" },
                { value: "—", styleId: "CellNormal" },
              ],
            });
          }
        });

        sheets.push({
          name: "Student Attendance Details",
          columns: [
            { width: 12 }, { width: 16 }, { width: 26 }, { width: 14 },
            { width: 26 }, { width: 22 }, { width: 6 }, { width: 16 },
            { width: 26 }, { width: 18 }, { width: 16 }
          ],
          rows: studentDetailRows,
        });

        downloadExcelWorkbook(
          { author: "Academic Portal", sheets },
          `Faculty_${(f.hrmsId || f.facultyName).replace(/\s+/g, "_")}_${dateMode === "range" ? `${startDate}_to_${endDate}` : getTodayDateString()}.xls`,
        );
      } finally {
        setGeneratingExcelKey(null);
      }
    },
    [
      activeStaffModal,
      dedicatedStaffSessions,
      fetchDedicatedFacultyData,
      dateMode,
      startDate,
      endDate,
      data?.comparisons,
      academicYear,
      selectedCohortTitle,
    ],
  );

  // Print / Export individual Subject Curriculum Delivery Report to PDF
  const printSubjectPdf = useCallback(
    async (
      sub: {
        subjectCode: string;
        subjectName: string;
        masterWeeklyPeriods?: number;
        totalScheduled?: number;
        totalConducted?: number;
        timesChanged?: number;
        timesSwappedOut?: number;
        timesSwappedIn?: number;
        facultyNames?: string[];
        assignedFaculty?: string[];
        assignedFacultyNames?: string[];
        attendancePct?: number | null;
        effectiveAttendancePct?: number | null;
        turnoutPct?: number | null;
        cohortTitle?: string;
        sectionLetter?: string;
        branchCode?: string;
        batch?: string;
        changedFaculty?: { facultyName: string; originalFacultyName?: string | null; count: number }[];
        changedFaculties?: { facultyName: string; originalFacultyName?: string | null; count: number }[];
      },
      customSessions?: ComparisonItem[],
    ) => {
      setGeneratingPdfKey(sub.subjectCode);
      try {
        let sessionsToUse = customSessions;
        if (!sessionsToUse) {
          if (activeSubjectModal?.subjectCode === sub.subjectCode && dedicatedSubjectSessions && dedicatedSubjectSessions.length > 0) {
            sessionsToUse = dedicatedSubjectSessions;
          } else {
            const fetched = await fetchDedicatedSubjectData(sub);
            sessionsToUse = fetched?.comparisons;
          }
        }

        const dateRangeLabel =
          dateMode === "range"
            ? `${startDate ? formatDisplayDate(startDate) : "Start"} to ${endDate ? formatDisplayDate(endDate) : "End"}`
            : formatDisplayDate(getTodayDateString());

        const code = (sub.subjectCode || "").trim().toUpperCase();
        const name = (sub.subjectName || "").trim().toLowerCase();

        const rawList = sessionsToUse && sessionsToUse.length > 0 ? sessionsToUse : (data?.comparisons || []);
        const subjectSessions = rawList
          .filter((c) => {
            const matchCode =
              (c.masterSubjectCode && c.masterSubjectCode.trim().toUpperCase() === code) ||
              (c.todaySubjectCode && c.todaySubjectCode.trim().toUpperCase() === code);
            const matchName =
              (c.masterSubjectName && c.masterSubjectName.trim().toLowerCase() === name) ||
              (c.todaySubjectName && c.todaySubjectName.trim().toLowerCase() === name);

            if (!matchCode && !matchName) return false;

            if (sub.sectionLetter) {
              const sec = cleanSectionCode(c.sectionName);
              const targetSec = cleanSectionCode(sub.sectionLetter);
              if (sec && targetSec && sec !== targetSec) return false;
            }
            return true;
          })
          .map((c) => {
            const isSub =
              c.varianceType === "FACULTY_SUBSTITUTE" ||
              Boolean(
                c.todayFacultyName &&
                  c.masterFacultyName &&
                  c.todayFacultyName.trim().toLowerCase() !== c.masterFacultyName.trim().toLowerCase(),
              );
            const isSwap =
              c.varianceType === "SUBJECT_SWAP" ||
              Boolean(
                c.todaySubjectCode &&
                  c.masterSubjectCode &&
                  c.todaySubjectCode.trim().toUpperCase() !== c.masterSubjectCode.trim().toUpperCase(),
              );

            let actionRoleTitle = "Conducted As Master";
            if (isSub && isSwap) {
              actionRoleTitle = `Swap & Sub (${c.todayFacultyName})`;
            } else if (isSub) {
              actionRoleTitle = `Faculty Substituted (${c.todayFacultyName})`;
            } else if (isSwap) {
              actionRoleTitle = `Subject Swapped (${c.todaySubjectName})`;
            }

            return {
              ...c,
              isSub,
              isSwap,
              actionRoleTitle,
            };
          });

        const totalPresent = subjectSessions.reduce((acc, s) => acc + (s.presentCount || 0), 0);
        const totalAbsent = subjectSessions.reduce((acc, s) => acc + (s.absentCount || 0), 0);
        const totalMarked = totalPresent + totalAbsent;
        const cohortStrength = subjectSessions.find((s) => (s.enrolledCount || 0) > 0)?.enrolledCount || 0;
        const totalEnrolled = totalMarked > 0 ? totalMarked : cohortStrength;
        const turnoutPct = totalMarked > 0 ? Math.round((totalPresent / totalMarked) * 100) : (sub.attendancePct != null ? sub.attendancePct : null);

        const dateMap = new Map<string, typeof subjectSessions>();
        subjectSessions.forEach((s) => {
          const d = s.date || "Scheduled Plan";
          if (!dateMap.has(d)) dateMap.set(d, []);
          dateMap.get(d)!.push(s);
        });
        const sortedDates = Array.from(dateMap.keys()).sort();

        let dateTablesHtml = "";
        if (sortedDates.length === 0) {
          dateTablesHtml = `
            <div style="padding: 16px; text-align: center; color: #64748b; font-size: 11px; border: 1px dashed #cbd5e1; border-radius: 6px; margin: 12px 0;">
              No timetable sessions recorded for this subject in the selected range (${escapeHtml(dateRangeLabel)}).
            </div>
          `;
        } else {
          sortedDates.forEach((d) => {
            const sessions = dateMap.get(d)!;
            const dayName = sessions[0]?.dayOfWeek || "";
            const dayPres = sessions.reduce((acc, s) => acc + (s.presentCount || 0), 0);
            const dayAbs = sessions.reduce((acc, s) => acc + (s.absentCount || 0), 0);
            const dayEnr = dayPres + dayAbs;
            const dayTurnout = dayEnr > 0 ? Math.round((dayPres / dayEnr) * 100) : null;
            const dayConducted = sessions.filter((s) => s.isConducted).length;

            dateTablesHtml += `
              <div style="margin-top: 14px; break-inside: avoid;">
                <div style="background-color: #f1f5f9; padding: 5px 8px; font-weight: bold; font-size: 11px; border: 1px solid #cbd5e1; border-bottom: none; display: flex; justify-content: space-between;">
                  <span>📅 Date: ${d} ${dayName ? `(${dayName})` : ""}</span>
                  <span>${sessions.length} Session(s) &bull; ${dayEnr > 0 || dayConducted > 0 ? `<b style="color: #15803d;">${dayPres} Present</b> / <b style="color: #be123c;">${dayAbs} Absent</b> ${dayTurnout != null ? `(${dayTurnout}% Attendance)` : (dayConducted > 0 ? "(100% Attendance)" : "")}` : '<span style="color: #64748b; font-weight: 500;">Attendance Pending</span>'}</span>
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 8px;">
                  <thead>
                    <tr style="background-color: #f1f5f9; color: #0f172a; font-weight: 700;">
                      <th style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: left; color: #0f172a;">Slot & Time</th>
                      <th style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: left; color: #0f172a;">Class & Section</th>
                      <th style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: left; color: #0f172a;">Master Assigned Faculty</th>
                      <th style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: left; color: #0f172a;">Actual Conducted Faculty</th>
                      <th style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: left; color: #0f172a;">Action Role / Status</th>
                      <th style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; color: #0f172a;">Conducted</th>
                      <th style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; color: #0f172a;">Enrolled</th>
                      <th style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; color: #0f172a;">Present</th>
                      <th style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; color: #0f172a;">Absent</th>
                      <th style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; color: #0f172a;">Attendance %</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${sessions
                      .map((s) => {
                        const sEnr = (s.presentCount || 0) + (s.absentCount || 0);
                        const sPres = s.presentCount || 0;
                        const sAbs = s.absentCount || 0;
                        const sEnrolledTotal = (s.enrolledCount && s.enrolledCount > 0) ? s.enrolledCount : (cohortStrength || (sEnr > 0 ? sEnr : 0));
                        const sTurnout = s.isConducted ? (s.attendancePct != null ? `${s.attendancePct}%` : (sEnr > 0 ? `${Math.round((sPres / sEnr) * 100)}%` : "100%")) : "Pending";
                        return `
                      <tr>
                        <td style="padding: 5px 6px; border: 1px solid #cbd5e1;">${escapeHtml(s.slotLabel)} (${escapeHtml(s.time)})</td>
                        <td style="padding: 5px 6px; border: 1px solid #cbd5e1;">${formatSessionClassInfo(s, true)}</td>
                        <td style="padding: 5px 6px; border: 1px solid #cbd5e1;">${escapeHtml(s.masterFacultyName || "—")}</td>
                        <td style="padding: 5px 6px; border: 1px solid #cbd5e1; font-weight: ${s.isSub ? "bold" : "normal"}; color: ${s.isSub ? "#b45309" : "#0f172a"};">
                          ${escapeHtml(s.todayFacultyName || "—")}
                        </td>
                        <td style="padding: 5px 6px; border: 1px solid #cbd5e1;">${escapeHtml(s.actionRoleTitle)}</td>
                        <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center;">
                          ${s.isConducted ? '<span style="color: #15803d; font-weight: bold;">Yes ✓</span>' : '<span style="color: #64748b;">Scheduled</span>'}
                        </td>
                        <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 500;">
                          ${sEnrolledTotal > 0 ? sEnrolledTotal : "—"}
                        </td>
                        <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #15803d;">
                          ${s.isConducted ? sPres : "—"}
                        </td>
                        <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: ${sAbs > 0 ? "#be123c" : "#64748b"};">
                          ${s.isConducted ? sAbs : "—"}
                        </td>
                        <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #0369a1;">
                          ${sTurnout}
                        </td>
                      </tr>
                    `;
                      })
                      .join("")}
                    <tr style="background-color: #f8fafc; font-weight: bold; border-top: 2px solid #94a3b8;">
                      <td colspan="5" style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: right;">Day Total:</td>
                      <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; color: #15803d;">${dayConducted} Held</td>
                      <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center;">${dayEnr > 0 ? dayEnr : "—"}</td>
                      <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; color: #15803d;">${dayPres > 0 ? dayPres : (dayEnr > 0 ? 0 : "—")}</td>
                      <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; color: #be123c;">${dayAbs > 0 ? dayAbs : (dayEnr > 0 ? 0 : "—")}</td>
                      <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; color: #0369a1;">${dayTurnout != null ? `${dayTurnout}%` : (dayConducted > 0 ? "100%" : "Pending")}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            `;
          });
        }

        const assignedStr =
          (sub.assignedFacultyNames ?? sub.facultyNames ?? []).join(", ") || "Not Assigned";
        const changedStr =
          ((sub.changedFaculties ?? sub.changedFaculty ?? []) as { facultyName: string; originalFacultyName?: string | null; count: number }[])
            .map((cf) => `${cf.facultyName}${cf.originalFacultyName ? ` (sub for ${cf.originalFacultyName})` : ""} (${cf.count}x)`)
            .join("; ") || (assignedStr !== "Not Assigned" ? `${assignedStr} (As Assigned)` : "As Assigned");

        const effectiveTurnout =
          sub.attendancePct != null && sub.attendancePct > 0
            ? `${sub.attendancePct}%`
            : sub.turnoutPct != null
              ? `${sub.turnoutPct}%`
              : "—";

        const generatedDateTime = `${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} at ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;

        const htmlContent = `
          <div style="font-family: Arial, Helvetica, sans-serif; color: #0f172a; padding: 12px; line-height: 1.4;">
            <!-- Official Institution Masthead -->
            <div style="text-align: center; border-bottom: 3px double #0f172a; padding-bottom: 10px; margin-bottom: 14px;">
              <div style="text-align: center; margin-bottom: 4px;">
                <span style="font-size: 9px; font-weight: bold; color: #64748b; letter-spacing: 1px; text-transform: uppercase;">
                  ACADEMIC PORTAL &bull; CURRICULUM DELIVERY AUDIT
                </span>
              </div>
              <h1 style="margin: 0; font-size: 19px; font-weight: 800; color: #0f172a; letter-spacing: 0.5px; text-transform: uppercase;">
                SUBJECT DELIVERY & ALTERATION REPORT
              </h1>
              <p style="margin: 3px 0 0; font-size: 11px; font-weight: 600; color: #1e3a8a; letter-spacing: 0.5px;">
                Subject Quota Fulfillment, Conduction Audit & Substitution Record
              </p>
              <p style="margin: 3px 0 0; font-size: 10px; color: #64748b;">
                Academic Year: <strong>${escapeHtml(academicYear || "Current")}</strong> &bull; Period: <strong>${escapeHtml(dateRangeLabel)}</strong> &bull; Generated: ${generatedDateTime}
              </p>
            </div>

            <!-- Subject Metadata Box -->
            <div style="margin-bottom: 12px; border: 1px solid #cbd5e1; border-radius: 6px; background-color: #f8fafc; padding: 8px 12px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                <tr>
                  <td style="width: 50%; padding: 3px 0;"><strong>Subject Name:</strong> <span style="font-size: 12px; font-weight: bold; color: #0f172a;">${escapeHtml(sub.subjectName)}</span></td>
                  <td style="width: 50%; padding: 3px 0;"><strong>Subject Code:</strong> <span style="font-family: monospace; font-weight: bold; color: #1e40af;">${escapeHtml(sub.subjectCode)}</span></td>
                </tr>
                <tr>
                  <td style="padding: 3px 0;"><strong>Cohort / Scope:</strong> ${escapeHtml(sub.cohortTitle || selectedCohortTitle || "All Sections")}</td>
                  <td style="padding: 3px 0;"><strong>Master Quota:</strong> ${sub.masterWeeklyPeriods} periods/week</td>
                </tr>
              </table>
            </div>

            <!-- 1. Executive Abstract -->
            <div style="margin-bottom: 14px; break-inside: avoid;">
              <h3 style="font-size: 11px; text-transform: uppercase; margin: 0 0 5px; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; font-weight: bold;">
                1. Executive Abstract & Conduction Metrics
              </h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 8px;">
                <thead>
                  <tr style="background-color: #f1f5f9; color: #0f172a; font-weight: 700; border: 1px solid #cbd5e1;">
                    <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a;">Master Quota</th>
                    <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a;">Conducted</th>
                    <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a;">Total Students Enrolled</th>
                    <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a;">Students Present</th>
                    <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a;">Students Absent</th>
                    <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a;">Attendance Rate</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style="text-align: center; font-weight: bold; background-color: #f8fafc;">
                    <td style="padding: 7px; border: 1px solid #cbd5e1; font-size: 12px; color: #334155;">${sub.masterWeeklyPeriods} p/wk</td>
                    <td style="padding: 7px; border: 1px solid #cbd5e1; font-size: 12px; color: #15803d;">${sub.totalConducted} held</td>
                    <td style="padding: 7px; border: 1px solid #cbd5e1; font-size: 12px; color: #334155;">${totalEnrolled > 0 ? totalEnrolled : cohortStrength}</td>
                    <td style="padding: 7px; border: 1px solid #cbd5e1; font-size: 12px; color: #15803d;">${(sub.totalConducted ?? 0) > 0 ? (totalPresent || 0) : 0}</td>
                    <td style="padding: 7px; border: 1px solid #cbd5e1; font-size: 12px; color: #be123c;">${(sub.totalConducted ?? 0) > 0 ? (totalAbsent || 0) : 0}</td>
                    <td style="padding: 7px; border: 1px solid #cbd5e1; font-size: 12px; color: #1e40af;">${turnoutPct != null ? `${turnoutPct}%` : (effectiveTurnout !== "—" ? effectiveTurnout : ((sub.totalConducted ?? 0) > 0 ? "100%" : "Pending"))}</td>
                  </tr>
                </tbody>
              </table>

              <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                <tr>
                  <td style="width: 30%; font-weight: bold; padding: 5px; border: 1px solid #cbd5e1; background-color: #f1f5f9;">Assigned Master Faculty:</td>
                  <td style="padding: 5px; border: 1px solid #cbd5e1;">${escapeHtml(assignedStr)}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold; padding: 5px; border: 1px solid #cbd5e1; background-color: #f1f5f9;">Substitute & Reliever Faculty:</td>
                  <td style="padding: 5px; border: 1px solid #cbd5e1;">${escapeHtml(changedStr)}</td>
                </tr>
              </table>
            </div>

            <!-- 2. Date-wise Breakdown -->
            <div>
              <h3 style="font-size: 11px; text-transform: uppercase; margin: 12px 0 4px; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; font-weight: bold;">
                2. Date-wise Timetable Delivery & Alteration Sessions (${dateRangeLabel})
              </h3>
              ${dateTablesHtml}
            </div>

            <!-- Official Sign-off Block -->
            <div style="margin-top: 36px; padding-top: 14px; border-top: 1px solid #cbd5e1; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; text-align: center; break-inside: avoid;">
              <div>
                <div style="height: 38px;"></div>
                <p style="margin: 0; font-size: 11px; font-weight: bold; color: #0f172a; border-top: 1px dashed #64748b; padding-top: 4px;">
                  Timetable Coordinator
                </p>
                <span style="font-size: 9px; color: #64748b;">Timetable & Conduction Cell</span>
              </div>
              <div>
                <div style="height: 38px;"></div>
                <p style="margin: 0; font-size: 11px; font-weight: bold; color: #0f172a; border-top: 1px dashed #64748b; padding-top: 4px;">
                  Head of the Department (HOD)
                </p>
                <span style="font-size: 9px; color: #64748b;">Academic Affairs</span>
              </div>
              <div>
                <div style="height: 38px;"></div>
                <p style="margin: 0; font-size: 11px; font-weight: bold; color: #0f172a; border-top: 1px dashed #64748b; padding-top: 4px;">
                  Principal / Dean of Academics
                </p>
                <span style="font-size: 9px; color: #64748b;">Institution Seal & Approval</span>
              </div>
            </div>
          </div>
        `;

        printHtml(htmlContent, {
          title: `Subject_Report_${sub.subjectCode}_${dateMode === "range" ? `${startDate}_to_${endDate}` : getTodayDateString()}`,
          subtitle: `Curriculum delivery report for ${sub.subjectName} (${sub.subjectCode})`,
          hideHeader: true,
        });
      } finally {
        setGeneratingPdfKey(null);
      }
    },
    [
      activeSubjectModal,
      dedicatedSubjectSessions,
      fetchDedicatedSubjectData,
      dateMode,
      startDate,
      endDate,
      data?.comparisons,
      academicYear,
      selectedCohortTitle,
    ],
  );

  // Export individual Subject Curriculum Delivery Report to Multi-Sheet Excel (.xls)
  const exportSubjectExcel = useCallback(
    async (
      sub: {
        subjectCode: string;
        subjectName: string;
        masterWeeklyPeriods?: number;
        totalScheduled?: number;
        totalConducted?: number;
        timesChanged?: number;
        timesSwappedOut?: number;
        timesSwappedIn?: number;
        facultyNames?: string[];
        assignedFaculty?: string[];
        assignedFacultyNames?: string[];
        attendancePct?: number | null;
        effectiveAttendancePct?: number | null;
        turnoutPct?: number | null;
        cohortTitle?: string;
        sectionLetter?: string;
        branchCode?: string;
        batch?: string;
        changedFaculty?: { facultyName: string; originalFacultyName?: string | null; count: number }[];
        changedFaculties?: { facultyName: string; originalFacultyName?: string | null; count: number }[];
      },
      customSessions?: ComparisonItem[],
    ) => {
      setGeneratingExcelKey(sub.subjectCode);
      try {
        let sessionsToUse = customSessions;
        if (!sessionsToUse) {
          if (activeSubjectModal?.subjectCode === sub.subjectCode && dedicatedSubjectSessions && dedicatedSubjectSessions.length > 0) {
            sessionsToUse = dedicatedSubjectSessions;
          } else {
            const fetched = await fetchDedicatedSubjectData(sub);
            sessionsToUse = fetched?.comparisons;
          }
        }

        const dateRangeLabel =
          dateMode === "range"
            ? `${startDate || "Start"} to ${endDate || "End"}`
            : getTodayDateString();

        const code = (sub.subjectCode || "").trim().toUpperCase();
        const name = (sub.subjectName || "").trim().toLowerCase();

        const rawList = sessionsToUse && sessionsToUse.length > 0 ? sessionsToUse : (data?.comparisons || []);
        const subjectSessions = rawList.filter((c) => {
          const matchCode =
            (c.masterSubjectCode && c.masterSubjectCode.trim().toUpperCase() === code) ||
            (c.todaySubjectCode && c.todaySubjectCode.trim().toUpperCase() === code);
          const matchName =
            (c.masterSubjectName && c.masterSubjectName.trim().toLowerCase() === name) ||
            (c.todaySubjectName && c.todaySubjectName.trim().toLowerCase() === name);

          if (!matchCode && !matchName) return false;

          if (sub.sectionLetter) {
            const sec = cleanSectionCode(c.sectionName);
            const targetSec = cleanSectionCode(sub.sectionLetter);
            if (sec && targetSec && sec !== targetSec) return false;
          }
          return true;
        });

        const totalPresent = subjectSessions.reduce((acc, s) => acc + (s.presentCount || 0), 0);
        const totalAbsent = subjectSessions.reduce((acc, s) => acc + (s.absentCount || 0), 0);
        const totalMarked = totalPresent + totalAbsent;
        const cohortStrength = subjectSessions.find((s) => (s.enrolledCount || 0) > 0)?.enrolledCount || 0;
        const totalEnrolled = totalMarked > 0 ? totalMarked : cohortStrength;
        const turnoutPct = totalMarked > 0 ? Math.round((totalPresent / totalMarked) * 100) : (sub.attendancePct != null ? sub.attendancePct : null);

        const dateMap = new Map<string, typeof subjectSessions>();
        subjectSessions.forEach((s) => {
          const d = s.date || "Scheduled";
          if (!dateMap.has(d)) dateMap.set(d, []);
          dateMap.get(d)!.push(s);
        });
        const sortedDates = Array.from(dateMap.keys()).sort();

        const assignedStr =
          (sub.assignedFacultyNames ?? sub.facultyNames ?? []).join("; ") || "Not Assigned";
        const changedStr =
          ((sub.changedFaculties ?? sub.changedFaculty ?? []) as { facultyName: string; originalFacultyName?: string | null; count: number }[])
            .map((cf) => `${cf.facultyName}${cf.originalFacultyName ? ` (sub for ${cf.originalFacultyName})` : ""} (${cf.count}x)`)
            .join("; ") || (assignedStr !== "Not Assigned" ? `${assignedStr} (As Assigned)` : "As Assigned");

        const sheets: ExcelWorksheet[] = [];

        // --- Sheet 1: Overview ---
        const overviewRows: ExcelRow[] = [
          { cells: [{ value: "ACADEMIC PORTAL • SUBJECT CURRICULUM DELIVERY & ATTENDANCE AUDIT", styleId: "Title", mergeAcross: 6 }] },
          { cells: [{ value: `Subject: ${sub.subjectName} (${sub.subjectCode}) | Cohort: ${sub.cohortTitle || selectedCohortTitle || "All Sections"} | Period: ${dateRangeLabel} | Academic Year: ${academicYear || "Current"}`, styleId: "Subtitle", mergeAcross: 6 }] },
          { cells: [] },
          { cells: [{ value: "1. EXECUTIVE ABSTRACT & CURRICULUM METRICS", styleId: "SectionHeader", mergeAcross: 6 }] },
          {
            cells: [
              { value: "Master Quota (p/wk)", styleId: "KpiLabel" },
              { value: "Conducted Sessions", styleId: "KpiLabel" },
              { value: "Students Enrolled", styleId: "KpiLabel" },
              { value: "Students Present", styleId: "KpiLabel" },
              { value: "Students Absent", styleId: "KpiLabel" },
              { value: "Attendance %", styleId: "KpiLabel" },
              { value: "Delivery Status", styleId: "KpiLabel" },
            ],
          },
          {
            cells: [
              { value: sub.masterWeeklyPeriods, styleId: "CellCenter" },
              { value: sub.totalConducted, styleId: "KpiEmerald" },
              { value: totalEnrolled, styleId: "CellCenter" },
              { value: (sub.totalConducted ?? 0) > 0 ? totalPresent : 0, styleId: "CellPresent" },
              { value: (sub.totalConducted ?? 0) > 0 ? totalAbsent : 0, styleId: "CellAbsent" },
              { value: turnoutPct != null ? `${turnoutPct}%` : (((sub.totalConducted ?? 0) > 0) ? "100%" : "Pending"), styleId: "CellTurnout" },
              { value: (sub.totalConducted ?? 0) > 0 ? "Conducted ✓" : "Pending", styleId: "CellCenter" },
            ],
          },
          { cells: [] },
          { cells: [{ value: "2. FACULTY ALLOCATIONS & ALTERATIONS", styleId: "SectionHeader", mergeAcross: 6 }] },
          { cells: [{ value: "Assigned Master Faculty:", styleId: "CellBoldCenter" }, { value: assignedStr, styleId: "CellNormal", mergeAcross: 5 }] },
          { cells: [{ value: "Substitute / Reliever Faculty:", styleId: "CellBoldCenter" }, { value: changedStr, styleId: "CellNormal", mergeAcross: 5 }] },
          { cells: [] },
          { cells: [{ value: `3. SUMMARY BY DATE (${sortedDates.length} Days Recorded)`, styleId: "SectionHeader", mergeAcross: 7 }] },
          {
            cells: [
              { value: "Date", styleId: "ColHeaderEmerald" },
              { value: "Day", styleId: "ColHeaderEmerald" },
              { value: "Total Sessions", styleId: "ColHeaderEmerald" },
              { value: "Conducted", styleId: "ColHeaderEmerald" },
              { value: "Students Enrolled", styleId: "ColHeaderEmerald" },
              { value: "Students Present", styleId: "ColHeaderEmerald" },
              { value: "Students Absent", styleId: "ColHeaderEmerald" },
              { value: "Attendance %", styleId: "ColHeaderEmerald" },
            ],
          },
        ];

        sortedDates.forEach((d) => {
          const sessions = dateMap.get(d)!;
          const dayPres = sessions.reduce((acc, s) => acc + (s.presentCount || 0), 0);
          const dayAbs = sessions.reduce((acc, s) => acc + (s.absentCount || 0), 0);
          const dayEnr = dayPres + dayAbs;
          const dayTurnout = dayEnr > 0 ? Math.round((dayPres / dayEnr) * 100) : null;
          const dayHeld = sessions.filter((s) => s.isConducted).length;

          overviewRows.push({
            cells: [
              { value: d, styleId: "CellNormal" },
              { value: sessions[0]?.dayOfWeek || "", styleId: "CellNormal" },
              { value: sessions.length, styleId: "CellCenter" },
              { value: dayHeld, styleId: "CellPresent" },
              { value: dayEnr > 0 || dayHeld > 0 ? dayEnr : "—", styleId: "CellCenter" },
              { value: dayPres > 0 || dayHeld > 0 ? dayPres : "—", styleId: "CellPresent" },
              { value: dayAbs > 0 || dayHeld > 0 ? dayAbs : "—", styleId: "CellAbsent" },
              { value: dayTurnout != null ? `${dayTurnout}%` : (dayHeld > 0 ? "100%" : "Pending"), styleId: "CellTurnout" },
            ],
          });
        });

        sheets.push({
          name: "Overview",
          columns: [{ width: 14 }, { width: 12 }, { width: 14 }, { width: 12 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 14 }, { width: 14 }],
          rows: overviewRows,
        });

        // --- Subsequent Sheets: One Sheet Per Date ---
        sortedDates.forEach((d) => {
          const sessions = dateMap.get(d)!;
          const dayName = sessions[0]?.dayOfWeek || "";
          const dayPres = sessions.reduce((acc, s) => acc + (s.presentCount || 0), 0);
          const dayAbs = sessions.reduce((acc, s) => acc + (s.absentCount || 0), 0);
          const dayEnr = dayPres + dayAbs;
          const dayTurnout = dayEnr > 0 ? Math.round((dayPres / dayEnr) * 100) : null;
          const dayHeld = sessions.filter((s) => s.isConducted).length;

          const dateRows: ExcelRow[] = [
            { cells: [{ value: `CURRICULUM SESSIONS & STUDENT ATTENDANCE — ${d} (${dayName})`, styleId: "Title", mergeAcross: 12 }] },
            { cells: [{ value: `Subject: ${sub.subjectName} (${sub.subjectCode}) | Day Sessions: ${sessions.length} | Conducted: ${dayHeld} | Enrolled: ${dayEnr > 0 ? dayEnr : "—"} | Present: ${dayPres > 0 ? dayPres : (dayEnr > 0 ? 0 : "—")} | Absent: ${dayAbs > 0 ? dayAbs : (dayEnr > 0 ? 0 : "—")} | Attendance: ${dayTurnout != null ? `${dayTurnout}%` : (dayHeld > 0 ? "100%" : "Pending")}`, styleId: "Subtitle", mergeAcross: 12 }] },
            { cells: [] },
            {
              cells: [
                { value: "Date", styleId: "ColHeaderEmerald" },
                { value: "Day", styleId: "ColHeaderEmerald" },
                { value: "Slot & Time", styleId: "ColHeaderEmerald" },
                { value: "Class & Section", styleId: "ColHeaderEmerald" },
                { value: "Batch", styleId: "ColHeaderEmerald" },
                { value: "Master Faculty", styleId: "ColHeaderEmerald" },
                { value: "Conducted Faculty", styleId: "ColHeaderEmerald" },
                { value: "Action Status", styleId: "ColHeaderEmerald" },
                { value: "Conducted", styleId: "ColHeaderEmerald" },
                { value: "Enrolled", styleId: "ColHeaderEmerald" },
                { value: "Present", styleId: "ColHeaderEmerald" },
                { value: "Absent", styleId: "ColHeaderEmerald" },
                { value: "Attendance %", styleId: "ColHeaderEmerald" },
              ],
            },
          ];

          sessions.forEach((s) => {
            const sEnr = (s.presentCount || 0) + (s.absentCount || 0);
            const sPres = s.presentCount || 0;
            const sAbs = s.absentCount || 0;
            const sEnrolledTotal = (s.enrolledCount && s.enrolledCount > 0) ? s.enrolledCount : (sEnr > 0 ? sEnr : 0);
            const sTurnout = s.isConducted ? (s.attendancePct != null ? `${s.attendancePct}%` : (sEnr > 0 ? `${Math.round((sPres / sEnr) * 100)}%` : "100%")) : "Pending";
            const varianceTitle = s.varianceType === "UNCHANGED" ? "As Master" : s.varianceType === "FACULTY_SUBSTITUTE" ? "Faculty Substitute" : s.varianceType === "SUBJECT_SWAP" ? "Subject Swap" : "Both Sub & Swap";

            dateRows.push({
              cells: [
                { value: s.date, styleId: "CellNormal" },
                { value: s.dayOfWeek || "", styleId: "CellNormal" },
                { value: `${s.slotLabel} (${s.time})`, styleId: "CellNormal" },
                { value: formatSessionClassInfo(s, false), styleId: "CellNormal" },
                { value: `Batch ${s.batch}`, styleId: "CellCenter" },
                { value: s.masterFacultyName || "—", styleId: "CellNormal" },
                { value: s.todayFacultyName || "—", styleId: "CellNormal" },
                { value: varianceTitle, styleId: "CellNormal" },
                { value: s.isConducted ? "Conducted ✓" : "Scheduled", styleId: s.isConducted ? "CellPresent" : "CellNormal" },
                { value: sEnrolledTotal > 0 ? sEnrolledTotal : "—", styleId: "CellCenter" },
                { value: s.isConducted ? sPres : "—", styleId: "CellPresent" },
                { value: s.isConducted ? sAbs : "—", styleId: "CellAbsent" },
                { value: sTurnout, styleId: "CellTurnout" },
              ],
            });
          });

          // Day Total Row
          dateRows.push({
            cells: [
              { value: "Day Total", styleId: "SubTotalRow" },
              { value: "", styleId: "SubTotalRow" },
              { value: "", styleId: "SubTotalRow" },
              { value: "", styleId: "SubTotalRow" },
              { value: "", styleId: "SubTotalRow" },
              { value: "", styleId: "SubTotalRow" },
              { value: "", styleId: "SubTotalRow" },
              { value: "", styleId: "SubTotalRow" },
              { value: `${dayHeld} Held`, styleId: "SubTotalRow" },
              { value: dayEnr > 0 ? dayEnr : "—", styleId: "SubTotalRow" },
              { value: dayPres > 0 ? dayPres : (dayEnr > 0 ? 0 : "—"), styleId: "CellPresent" },
              { value: dayAbs > 0 ? dayAbs : (dayEnr > 0 ? 0 : "—"), styleId: "CellAbsent" },
              { value: dayTurnout != null ? `${dayTurnout}%` : (dayHeld > 0 ? "100%" : "Pending"), styleId: "CellTurnout" },
            ],
          });

          sheets.push({
            name: sanitizeSheetName(d),
            columns: [
              { width: 12 }, { width: 10 }, { width: 16 }, { width: 14 }, { width: 10 },
              { width: 22 }, { width: 22 }, { width: 20 }, { width: 13 }, { width: 10 },
              { width: 10 }, { width: 10 }, { width: 12 }
            ],
            rows: dateRows,
          });
        });

        downloadExcelWorkbook(
          { author: "Academic Portal", sheets },
          `Subject_${sub.subjectCode}_${dateMode === "range" ? `${startDate}_to_${endDate}` : getTodayDateString()}.xls`,
        );
      } finally {
        setGeneratingExcelKey(null);
      }
    },
    [
      activeSubjectModal,
      dedicatedSubjectSessions,
      fetchDedicatedSubjectData,
      dateMode,
      startDate,
      endDate,
      data?.comparisons,
      academicYear,
      selectedCohortTitle,
    ],
  );

  // Modal export wrappers
  const exportStaffModalPdf = useCallback(() => {
    if (activeStaffModal) void printFacultyPdf(activeStaffModal, modalStaffSessions);
  }, [activeStaffModal, printFacultyPdf, modalStaffSessions]);

  const exportStaffModalExcel = useCallback(() => {
    if (activeStaffModal) void exportFacultyExcel(activeStaffModal, modalStaffSessions);
  }, [activeStaffModal, exportFacultyExcel, modalStaffSessions]);

  const exportSubjectModalPdf = useCallback(() => {
    if (activeSubjectModal) void printSubjectPdf(activeSubjectModal, modalSubjectSessions);
  }, [activeSubjectModal, printSubjectPdf, modalSubjectSessions]);

  const exportSubjectModalExcel = useCallback(() => {
    if (activeSubjectModal) void exportSubjectExcel(activeSubjectModal, modalSubjectSessions);
  }, [activeSubjectModal, exportSubjectExcel, modalSubjectSessions]);

  // Export to Excel / CSV with Executive Abstract + Date-wise breakdown
  const handleExportCsv = () => {
    const dateRangeLabel =
      dateMode === "range"
        ? `${startDate || "Start"} to ${endDate || "End"}`
        : getTodayDateString();

    if (activeSection === "subjects") {
      if (selectedSubjectObj) {
        void exportSubjectExcel(selectedSubjectObj);
        return;
      }

      const subjectsList = filteredSubjects.length ? filteredSubjects : (data?.subjects ?? []);
      if (!subjectsList.length && comparisonsBySection.length === 0) {
        alert("No subject data available to export.");
        return;
      }

      // Group comparisons by date for Date-wise breakdown
      const dateMap = new Map<string, typeof filteredComparisons>();
      filteredComparisons.forEach((c) => {
        const d = c.date || "Scheduled";
        if (!dateMap.has(d)) dateMap.set(d, []);
        dateMap.get(d)!.push(c);
      });
      const sortedDates = Array.from(dateMap.keys()).sort();

      const sheets: ExcelWorksheet[] = [];

      // --- Sheet 1: Class & Section Curriculum Roster ---
      const rosterRows: ExcelRow[] = [
        { cells: [{ value: "ACADEMIC PORTAL • CLASS & SUBJECT CURRICULUM DELIVERY REPORT", styleId: "Title", mergeAcross: 12 }] },
        { cells: [{ value: `Scope: ${selectedCohortTitle || "All Sections"} | Period: ${dateRangeLabel} | Academic Year: ${academicYear || "Current"}`, styleId: "Subtitle", mergeAcross: 12 }] },
        { cells: [] },
        { cells: [{ value: "1. EXECUTIVE ABSTRACT & CURRICULUM METRICS", styleId: "SectionHeader", mergeAcross: 12 }] },
        {
          cells: [
            { value: "Total Subjects", styleId: "KpiLabel" },
            { value: "Master Quota (p/wk)", styleId: "KpiLabel" },
            { value: "Conducted Sessions", styleId: "KpiLabel" },
            { value: "Students Enrolled", styleId: "KpiLabel" },
            { value: "Students Present", styleId: "KpiLabel" },
            { value: "Students Absent", styleId: "KpiLabel" },
            { value: "Attendance %", styleId: "KpiLabel" },
          ],
        },
        {
          cells: [
            { value: subjectAnalytics.totalSubjects, styleId: "KpiEmerald" },
            { value: subjectAnalytics.totalWeeklyQuota, styleId: "CellCenter" },
            { value: subjectAnalytics.totalConducted, styleId: "KpiEmerald" },
            { value: totalCohortStudentsEnrolled > 0 ? totalCohortStudentsEnrolled : ((subjectAnalytics.totalMarked || 0) > 0 ? subjectAnalytics.totalMarked : "—"), styleId: "CellCenter" },
            { value: subjectAnalytics.totalConducted > 0 ? (subjectAnalytics.totalPresent || 0) : 0, styleId: "CellPresent" },
            { value: subjectAnalytics.totalConducted > 0 ? (subjectAnalytics.totalAbsent || 0) : 0, styleId: "CellAbsent" },
            { value: subjectAnalytics.totalConducted > 0 && subjectAnalytics.overallTurnoutPct != null ? `${subjectAnalytics.overallTurnoutPct}%` : (subjectAnalytics.totalConducted > 0 && subjectAnalytics.avgAttendance != null ? `${subjectAnalytics.avgAttendance}%` : "Pending"), styleId: "CellTurnout" },
          ],
        },
        { cells: [] },
        { cells: [{ value: "2. CLASS & SECTION-WISE SUBJECT ALLOCATION ROSTER", styleId: "SectionHeader", mergeAcross: 12 }] },
        {
          cells: [
            { value: "Class & Section", styleId: "ColHeaderEmerald" },
            { value: "Batch", styleId: "ColHeaderEmerald" },
            { value: "Branch", styleId: "ColHeaderEmerald" },
            { value: "Subject Code", styleId: "ColHeaderEmerald" },
            { value: "Subject Name", styleId: "ColHeaderEmerald" },
            { value: "Master Quota", styleId: "ColHeaderEmerald" },
            { value: "Conducted", styleId: "ColHeaderEmerald" },
            { value: "Assigned Faculty", styleId: "ColHeaderEmerald" },
            { value: "Conducted Faculty", styleId: "ColHeaderEmerald" },
            { value: "Enrolled", styleId: "ColHeaderEmerald" },
            { value: "Present", styleId: "ColHeaderEmerald" },
            { value: "Absent", styleId: "ColHeaderEmerald" },
            { value: "Attendance %", styleId: "ColHeaderEmerald" },
          ],
        },
      ];

      if (comparisonsBySection.length > 0) {
        comparisonsBySection.forEach((secGroup) => {
          const secEnrolled = secGroup.secEnrolled || 0;
          const secTotalConducted = secGroup.cohortSubjects.reduce((acc, s) => acc + s.totalConducted, 0);
          const secTotalChanges = secGroup.cohortSubjects.reduce((acc, s) => acc + s.timesChanged, 0);
          const withAtt = secGroup.cohortSubjects.filter((s) => s.totalConducted > 0 && s.effectiveAttendancePct != null && s.effectiveAttendancePct > 0);
          const secAvgAtt = withAtt.length > 0 ? Math.round(withAtt.reduce((acc, s) => acc + (s.effectiveAttendancePct ?? 0), 0) / withAtt.length) : null;

          rosterRows.push({
            cells: [
              {
                value: `🎓 Class: ${secGroup.branchCode} - Section ${secGroup.sectionLetter !== "Unassigned" ? secGroup.sectionLetter : "All"} (Batch ${secGroup.batch}) — ${secGroup.cohortSubjects.length} Subjects | ${secTotalConducted} Conducted | ${secEnrolled > 0 ? `${secEnrolled} Enrolled` : "Enrolled Pending"} | ${secTotalChanges > 0 ? `${secTotalChanges} Alterations` : "As Assigned"} | Attendance: ${secAvgAtt != null ? `${secAvgAtt}%` : "Pending"}`,
                styleId: "SubTotalRow",
                mergeAcross: 12,
              },
            ],
          });

          secGroup.cohortSubjects.forEach((sub) => {
            const assigned = sub.assignedFaculty.join("; ");
            const changed = sub.changedFaculty
              .map((cf) => cf.originalFacultyName ? `${cf.facultyName} (sub for ${cf.originalFacultyName})` : cf.facultyName)
              .join("; ");
            const conductedFac = changed || (assigned ? `${assigned} (As Assigned)` : "As Assigned");
            const subEnrolled = secEnrolled;
            const isConducted = sub.totalConducted > 0;
            const subPres = isConducted ? (sub.totalPresent || 0) : 0;
            const subAbs = isConducted
              ? ((sub.totalMarked || 0) > 0 ? Math.max(0, (sub.totalMarked || 0) - (sub.totalPresent || 0)) : Math.max(0, subEnrolled - (sub.totalPresent || 0)))
              : 0;
            const attPct = isConducted
              ? (sub.effectiveAttendancePct != null || sub.turnoutPct != null
                  ? `${sub.effectiveAttendancePct ?? sub.turnoutPct}%`
                  : (subEnrolled > 0 ? `${Math.round(((sub.totalPresent || 0) / subEnrolled) * 100)}%` : "100%"))
              : "Pending";

            rosterRows.push({
              cells: [
                { value: `${secGroup.branchCode} - Sec ${secGroup.sectionLetter !== "Unassigned" ? secGroup.sectionLetter : "All"}`, styleId: "CellNormal" },
                { value: `Batch ${secGroup.batch}`, styleId: "CellCenter" },
                { value: secGroup.branchCode, styleId: "CellCenter" },
                { value: sub.subjectCode, styleId: "CellCenter" },
                { value: sub.subjectName || "", styleId: "CellNormal" },
                { value: sub.masterWeeklyPeriods, styleId: "CellCenter" },
                { value: sub.totalConducted, styleId: "CellPresent" },
                { value: assigned || "—", styleId: "CellNormal" },
                { value: conductedFac, styleId: "CellNormal" },
                { value: subEnrolled > 0 ? subEnrolled : "—", styleId: "CellCenter" },
                { value: isConducted ? subPres : "—", styleId: "CellPresent" },
                { value: isConducted ? subAbs : "—", styleId: "CellAbsent" },
                { value: attPct, styleId: "CellTurnout" },
              ],
            });
          });
        });
      } else {
        subjectsList.forEach((s) => {
          const assigned = Array.from(subjectAssignedFacultyMap.get(s.subjectCode) ?? (s.facultyNames ?? [])).join("; ");
          const changed = Array.from(subjectChangedFacultyMap.get(s.subjectCode)?.values() ?? [])
            .map((cf) => cf.originalFacultyName ? `${cf.facultyName} (sub for ${cf.originalFacultyName})` : cf.facultyName)
            .join("; ");
          const conductedFac = changed || (assigned ? `${assigned} (As Assigned)` : "As Assigned");
          const sEnr = (s.totalMarked || 0) > 0 ? s.totalMarked : "—";
          const sPres = s.totalConducted > 0 && (s.totalPresent || 0) > 0 ? s.totalPresent : (s.totalConducted > 0 && (s.totalMarked || 0) > 0 ? 0 : "—");
          const sAbs = s.totalConducted > 0 && (s.totalMarked || 0) > 0 ? Math.max(0, (s.totalMarked || 0) - (s.totalPresent || 0)) : "—";
          const attPct = s.totalConducted > 0 && (s.turnoutPct != null || s.attendancePct > 0) ? `${s.turnoutPct ?? s.attendancePct}%` : "Pending";

          rosterRows.push({
            cells: [
              { value: selectedCohortTitle || "All Sections", styleId: "CellNormal" },
              { value: selectedBatch ? `Batch ${selectedBatch}` : "All", styleId: "CellCenter" },
              { value: "CSE", styleId: "CellCenter" },
              { value: s.subjectCode, styleId: "CellCenter" },
              { value: s.subjectName || "", styleId: "CellNormal" },
              { value: s.masterWeeklyPeriods, styleId: "CellCenter" },
              { value: s.totalConducted, styleId: "CellPresent" },
              { value: assigned || "—", styleId: "CellNormal" },
              { value: conductedFac, styleId: "CellNormal" },
              { value: sEnr, styleId: "CellCenter" },
              { value: sPres, styleId: "CellPresent" },
              { value: sAbs, styleId: "CellAbsent" },
              { value: attPct, styleId: "CellTurnout" },
            ],
          });
        });
      }

      sheets.push({
        name: "Curriculum Roster",
        columns: [
          { width: 18 }, { width: 12 }, { width: 10 }, { width: 14 }, { width: 26 },
          { width: 12 }, { width: 12 }, { width: 24 }, { width: 24 },
          { width: 12 }, { width: 12 }, { width: 12 }, { width: 14 }
        ],
        rows: rosterRows,
      });

      // --- Subsequent Sheets: One Sheet Per Date ---
      sortedDates.forEach((d) => {
        const sessions = dateMap.get(d)!;
        const dayName = sessions[0]?.dayOfWeek || "";
        const dayPres = sessions.reduce((acc, s) => acc + (s.presentCount || 0), 0);
        const dayAbs = sessions.reduce((acc, s) => acc + (s.absentCount || 0), 0);
        const dayEnr = dayPres + dayAbs;
        const dayTurnout = dayEnr > 0 ? Math.round((dayPres / dayEnr) * 100) : null;
        const dayHeld = sessions.filter((s) => s.isConducted).length;

        const dateRows: ExcelRow[] = [
          { cells: [{ value: `DATE-WISE CURRICULUM DELIVERY & STUDENT ATTENDANCE — ${d} (${dayName})`, styleId: "Title", mergeAcross: 13 }] },
          { cells: [{ value: `Scope: ${selectedCohortTitle || "All Sections"} | Total Sessions: ${sessions.length} | Conducted: ${dayHeld} | Enrolled: ${dayEnr > 0 ? dayEnr : "—"} | Present: ${dayPres > 0 ? dayPres : (dayEnr > 0 ? 0 : "—")} | Absent: ${dayAbs > 0 ? dayAbs : (dayEnr > 0 ? 0 : "—")} | Attendance: ${dayTurnout != null ? `${dayTurnout}%` : (dayHeld > 0 ? "100%" : "Pending")}`, styleId: "Subtitle", mergeAcross: 13 }] },
          { cells: [] },
          {
            cells: [
              { value: "Date", styleId: "ColHeaderEmerald" },
              { value: "Day", styleId: "ColHeaderEmerald" },
              { value: "Slot & Time", styleId: "ColHeaderEmerald" },
              { value: "Class & Section", styleId: "ColHeaderEmerald" },
              { value: "Batch", styleId: "ColHeaderEmerald" },
              { value: "Subject", styleId: "ColHeaderEmerald" },
              { value: "Master Faculty", styleId: "ColHeaderEmerald" },
              { value: "Conducted Faculty", styleId: "ColHeaderEmerald" },
              { value: "Action Status", styleId: "ColHeaderEmerald" },
              { value: "Conducted", styleId: "ColHeaderEmerald" },
              { value: "Enrolled", styleId: "ColHeaderEmerald" },
              { value: "Present", styleId: "ColHeaderEmerald" },
              { value: "Absent", styleId: "ColHeaderEmerald" },
              { value: "Attendance %", styleId: "ColHeaderEmerald" },
            ],
          },
        ];

        sessions.forEach((s) => {
          const sEnr = (s.presentCount || 0) + (s.absentCount || 0);
          const sPres = s.presentCount || 0;
          const sAbs = s.absentCount || 0;
          const sEnrolledTotal = (s.enrolledCount && s.enrolledCount > 0) ? s.enrolledCount : (sEnr > 0 ? sEnr : 0);
          const sTurnout = s.isConducted && s.attendancePct != null ? `${s.attendancePct}%` : (s.isConducted && sEnr > 0 ? `${Math.round((sPres / sEnr) * 100)}%` : (s.isConducted ? "100%" : "Pending"));
          const varianceTitle = s.varianceType === "UNCHANGED" ? "As Master" : s.varianceType === "FACULTY_SUBSTITUTE" ? "Faculty Substitute" : s.varianceType === "SUBJECT_SWAP" ? "Subject Swap" : "Sub & Swap";

          dateRows.push({
            cells: [
              { value: s.date, styleId: "CellNormal" },
              { value: s.dayOfWeek || "", styleId: "CellNormal" },
              { value: `${s.slotLabel} (${s.time})`, styleId: "CellNormal" },
              { value: `${s.branchCode || "CSE"} - Sec ${cleanSectionCode(s.sectionName) || "A"}`, styleId: "CellNormal" },
              { value: `Batch ${s.batch}`, styleId: "CellCenter" },
              { value: `${s.todaySubjectName || s.masterSubjectName || "—"} (${s.todaySubjectCode || s.masterSubjectCode || ""})`, styleId: "CellNormal" },
              { value: s.masterFacultyName || "—", styleId: "CellNormal" },
              { value: s.todayFacultyName || "—", styleId: "CellNormal" },
              { value: varianceTitle, styleId: "CellNormal" },
              { value: s.isConducted ? "Conducted ✓" : "Scheduled", styleId: s.isConducted ? "CellPresent" : "CellNormal" },
              { value: sEnrolledTotal > 0 ? sEnrolledTotal : "—", styleId: "CellCenter" },
              { value: s.isConducted ? sPres : "—", styleId: "CellPresent" },
              { value: s.isConducted ? sAbs : "—", styleId: "CellAbsent" },
              { value: s.isConducted ? sTurnout : "Pending", styleId: "CellTurnout" },
            ],
          });
        });

        // Day Total
        dateRows.push({
          cells: [
            { value: "Day Total", styleId: "SubTotalRow" },
            { value: "", styleId: "SubTotalRow" },
            { value: "", styleId: "SubTotalRow" },
            { value: "", styleId: "SubTotalRow" },
            { value: "", styleId: "SubTotalRow" },
            { value: "", styleId: "SubTotalRow" },
            { value: "", styleId: "SubTotalRow" },
            { value: "", styleId: "SubTotalRow" },
            { value: "", styleId: "SubTotalRow" },
            { value: `${dayHeld} Held`, styleId: "SubTotalRow" },
            { value: dayEnr > 0 ? dayEnr : "—", styleId: "SubTotalRow" },
            { value: dayPres > 0 ? dayPres : (dayEnr > 0 ? 0 : "—"), styleId: "CellPresent" },
            { value: dayAbs > 0 ? dayAbs : (dayEnr > 0 ? 0 : "—"), styleId: "CellAbsent" },
            { value: dayTurnout != null ? `${dayTurnout}%` : (dayHeld > 0 ? "100%" : "Pending"), styleId: "CellTurnout" },
          ],
        });

        sheets.push({
          name: sanitizeSheetName(d),
          columns: [
            { width: 12 }, { width: 10 }, { width: 16 }, { width: 16 }, { width: 10 },
            { width: 24 }, { width: 20 }, { width: 20 }, { width: 18 }, { width: 13 },
            { width: 10 }, { width: 10 }, { width: 10 }, { width: 12 }
          ],
          rows: dateRows,
        });
      });

      downloadExcelWorkbook(
        { author: "Academic Portal", sheets },
        `Subject_Analytics_${dateMode === "range" ? `${startDate}_to_${endDate}` : getTodayDateString()}.xls`,
      );
      return;
    }

    if (activeSection === "staff") {
      if (selectedStaffObj) {
        void exportFacultyExcel(selectedStaffObj);
        return;
      }

      const facultiesList = filteredFaculties.length ? filteredFaculties : (data?.faculties ?? []);
      if (!facultiesList.length) {
        alert("No faculty data available to export.");
        return;
      }

      // Group comparisons by date for Date-wise breakdown
      const dateMap = new Map<string, typeof filteredComparisons>();
      filteredComparisons.forEach((c) => {
        const d = c.date || "Scheduled";
        if (!dateMap.has(d)) dateMap.set(d, []);
        dateMap.get(d)!.push(c);
      });
      const sortedDates = Array.from(dateMap.keys()).sort();

      const sheets: ExcelWorksheet[] = [];

      // --- Sheet 1: Staff Workload Roster ---
      const staffRows: ExcelRow[] = [
        { cells: [{ value: "ACADEMIC PORTAL • FACULTY WORKLOAD & ATTENDANCE AUDIT", styleId: "Title", mergeAcross: 11 }] },
        { cells: [{ value: `Scope: ${selectedCohortTitle || "All Sections"} | Period: ${dateRangeLabel} | Academic Year: ${academicYear || "Current"}`, styleId: "Subtitle", mergeAcross: 11 }] },
        { cells: [] },
        { cells: [{ value: "1. EXECUTIVE ABSTRACT & WORKLOAD METRICS", styleId: "SectionHeader", mergeAcross: 11 }] },
        {
          cells: [
            { value: "Total Staff", styleId: "KpiLabel" },
            { value: "Master Quota (p/wk)", styleId: "KpiLabel" },
            { value: "Classes Conducted", styleId: "KpiLabel" },
            { value: "Relieved Out (-)", styleId: "KpiLabel" },
            { value: "Substitute In (+)", styleId: "KpiLabel" },
            { value: "Net Teaching Load", styleId: "KpiLabel" },
            { value: "Students Enrolled", styleId: "KpiLabel" },
            { value: "Students Present", styleId: "KpiLabel" },
            { value: "Students Absent", styleId: "KpiLabel" },
            { value: "Attendance %", styleId: "KpiLabel" },
          ],
        },
        {
          cells: [
            { value: staffAnalytics.totalStaff, styleId: "KpiAmber" },
            { value: staffAnalytics.totalAssignedLoad, styleId: "CellCenter" },
            { value: staffAnalytics.totalConducted, styleId: "KpiEmerald" },
            { value: staffAnalytics.totalRelieved, styleId: "KpiRose" },
            { value: staffAnalytics.totalSubstituteTaken, styleId: "KpiSky" },
            { value: staffAnalytics.totalNetLoad, styleId: "KpiVal" },
            { value: (staffAnalytics.totalMarked || 0) > 0 ? staffAnalytics.totalMarked : "—", styleId: "CellCenter" },
            { value: (staffAnalytics.totalPresent || 0) > 0 ? staffAnalytics.totalPresent : ((staffAnalytics.totalMarked || 0) > 0 ? 0 : "—"), styleId: "CellPresent" },
            { value: (staffAnalytics.totalAbsent || 0) > 0 ? staffAnalytics.totalAbsent : ((staffAnalytics.totalMarked || 0) > 0 ? 0 : "—"), styleId: "CellAbsent" },
            { value: staffAnalytics.overallTurnoutPct != null ? `${staffAnalytics.overallTurnoutPct}%` : "Pending", styleId: "CellTurnout" },
          ],
        },
        { cells: [] },
        { cells: [{ value: "2. FACULTY WORKLOAD & ALLOCATION ROSTER", styleId: "SectionHeader", mergeAcross: 11 }] },
        {
          cells: [
            { value: "Faculty Name", styleId: "ColHeaderEmerald" },
            { value: "HRMS ID", styleId: "ColHeaderEmerald" },
            { value: "Assigned Subjects", styleId: "ColHeaderEmerald" },
            { value: "Master Quota", styleId: "ColHeaderEmerald" },
            { value: "Conducted", styleId: "ColHeaderEmerald" },
            { value: "Relieved Out", styleId: "ColHeaderEmerald" },
            { value: "Substitute In", styleId: "ColHeaderEmerald" },
            { value: "Net Load", styleId: "ColHeaderEmerald" },
            { value: "Enrolled", styleId: "ColHeaderEmerald" },
            { value: "Students Present", styleId: "ColHeaderEmerald" },
            { value: "Students Absent", styleId: "ColHeaderEmerald" },
            { value: "Attendance %", styleId: "ColHeaderEmerald" },
          ],
        },
      ];

      facultiesList.forEach((f) => {
        staffRows.push({
          cells: [
            { value: f.facultyName || "", styleId: "CellNormal" },
            { value: `#${f.hrmsId}`, styleId: "CellCenter" },
            { value: (f.subjects || []).join(", ") || "—", styleId: "CellNormal" },
            { value: f.masterAssignedPeriods, styleId: "CellCenter" },
            { value: f.classesConducted, styleId: "CellPresent" },
            { value: f.relievedCount > 0 ? `-${f.relievedCount}` : 0, styleId: "CellAbsent" },
            { value: f.substituteTakenCount > 0 ? `+${f.substituteTakenCount}` : 0, styleId: "CellPresent" },
            { value: f.netTeachingCount, styleId: "KpiVal" },
            { value: f.totalEnrolled || f.totalMarked || "—", styleId: "CellCenter" },
            { value: f.totalPresent ?? 0, styleId: "CellPresent" },
            { value: f.totalAbsent ?? 0, styleId: "CellAbsent" },
            { value: f.attendancePct != null ? `${f.attendancePct}%` : "—", styleId: "CellTurnout" },
          ],
        });
      });

      sheets.push({
        name: "Staff Workload Roster",
        columns: [
          { width: 22 }, { width: 14 }, { width: 24 }, { width: 12 },
          { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 },
          { width: 12 }, { width: 14 }, { width: 14 }, { width: 14 }
        ],
        rows: staffRows,
      });

      // --- Subsequent Sheets: One Sheet Per Date ---
      sortedDates.forEach((d) => {
        const sessions = dateMap.get(d)!;
        const dayName = sessions[0]?.dayOfWeek || "";
        const dayPres = sessions.reduce((acc, s) => acc + (s.presentCount || 0), 0);
        const dayAbs = sessions.reduce((acc, s) => acc + (s.absentCount || 0), 0);
        const dayEnr = dayPres + dayAbs;
        const dayTurnout = dayEnr > 0 ? Math.round((dayPres / dayEnr) * 100) : null;
        const dayHeld = sessions.filter((s) => s.isConducted).length;

        const dateRows: ExcelRow[] = [
          { cells: [{ value: `DATE-WISE TIMETABLE & STUDENT ATTENDANCE LOG — ${d} (${dayName})`, styleId: "Title", mergeAcross: 12 }] },
          { cells: [{ value: `Scope: ${selectedCohortTitle || "All Sections"} | Total Sessions: ${sessions.length} | Conducted: ${dayHeld} | Enrolled: ${dayEnr > 0 ? dayEnr : "—"} | Present: ${dayPres > 0 ? dayPres : (dayEnr > 0 ? 0 : "—")} | Absent: ${dayAbs > 0 ? dayAbs : (dayEnr > 0 ? 0 : "—")} | Attendance: ${dayTurnout != null ? `${dayTurnout}%` : (dayHeld > 0 ? "100%" : "Pending")}`, styleId: "Subtitle", mergeAcross: 12 }] },
          { cells: [] },
          {
            cells: [
              { value: "Date", styleId: "ColHeaderEmerald" },
              { value: "Day", styleId: "ColHeaderEmerald" },
              { value: "Slot & Time", styleId: "ColHeaderEmerald" },
              { value: "Class & Section", styleId: "ColHeaderEmerald" },
              { value: "Subject", styleId: "ColHeaderEmerald" },
              { value: "Master Faculty", styleId: "ColHeaderEmerald" },
              { value: "Faculty In Charge", styleId: "ColHeaderEmerald" },
              { value: "Action Role Taken", styleId: "ColHeaderEmerald" },
              { value: "Conducted", styleId: "ColHeaderEmerald" },
              { value: "Enrolled", styleId: "ColHeaderEmerald" },
              { value: "Present", styleId: "ColHeaderEmerald" },
              { value: "Absent", styleId: "ColHeaderEmerald" },
              { value: "Attendance %", styleId: "ColHeaderEmerald" },
            ],
          },
        ];

        sessions.forEach((s) => {
          const sEnr = (s.presentCount || 0) + (s.absentCount || 0);
          const sPres = s.presentCount || 0;
          const sAbs = s.absentCount || 0;
          const sEnrolledTotal = (s.enrolledCount && s.enrolledCount > 0) ? s.enrolledCount : (sEnr > 0 ? sEnr : 0);
          const sTurnout = s.isConducted && s.attendancePct != null ? `${s.attendancePct}%` : (s.isConducted && sEnr > 0 ? `${Math.round((sPres / sEnr) * 100)}%` : (s.isConducted ? "100%" : "Pending"));
          const varianceTitle = s.varianceType === "UNCHANGED" ? "As Master" : s.varianceType === "FACULTY_SUBSTITUTE" ? "Faculty Substitute" : s.varianceType === "SUBJECT_SWAP" ? "Subject Swap" : "Sub & Swap";

          dateRows.push({
            cells: [
              { value: s.date, styleId: "CellNormal" },
              { value: s.dayOfWeek || "", styleId: "CellNormal" },
              { value: `${s.slotLabel} (${s.time})`, styleId: "CellNormal" },
              { value: formatSessionClassInfo(s, false), styleId: "CellNormal" },
              { value: `${s.todaySubjectName || s.masterSubjectName || "—"} (${s.todaySubjectCode || s.masterSubjectCode || ""})`, styleId: "CellNormal" },
              { value: s.masterFacultyName || "—", styleId: "CellNormal" },
              { value: s.todayFacultyName || s.masterFacultyName || "—", styleId: "CellNormal" },
              { value: varianceTitle, styleId: "CellNormal" },
              { value: s.isConducted ? "Conducted ✓" : "Scheduled", styleId: s.isConducted ? "CellPresent" : "CellNormal" },
              { value: sEnrolledTotal > 0 ? sEnrolledTotal : "—", styleId: "CellCenter" },
              { value: s.isConducted ? sPres : "—", styleId: "CellPresent" },
              { value: s.isConducted ? sAbs : "—", styleId: "CellAbsent" },
              { value: sTurnout, styleId: "CellTurnout" },
            ],
          });
        });

        // Day Total
        dateRows.push({
          cells: [
            { value: "Day Total", styleId: "SubTotalRow" },
            { value: "", styleId: "SubTotalRow" },
            { value: "", styleId: "SubTotalRow" },
            { value: "", styleId: "SubTotalRow" },
            { value: "", styleId: "SubTotalRow" },
            { value: "", styleId: "SubTotalRow" },
            { value: "", styleId: "SubTotalRow" },
            { value: "", styleId: "SubTotalRow" },
            { value: "", styleId: "SubTotalRow" },
            { value: `${dayHeld} Held`, styleId: "SubTotalRow" },
            { value: dayEnr > 0 ? dayEnr : "—", styleId: "SubTotalRow" },
            { value: dayPres > 0 ? dayPres : (dayEnr > 0 ? 0 : "—"), styleId: "CellPresent" },
            { value: dayAbs > 0 ? dayAbs : (dayEnr > 0 ? 0 : "—"), styleId: "CellAbsent" },
            { value: dayTurnout != null ? `${dayTurnout}%` : (dayHeld > 0 ? "100%" : "Pending"), styleId: "CellTurnout" },
          ],
        });

        sheets.push({
          name: sanitizeSheetName(d),
          columns: [
            { width: 12 }, { width: 10 }, { width: 16 }, { width: 14 }, { width: 10 },
            { width: 22 }, { width: 20 }, { width: 20 }, { width: 18 }, { width: 13 },
            { width: 10 }, { width: 10 }, { width: 10 }, { width: 12 }
          ],
          rows: dateRows,
        });
      });

      downloadExcelWorkbook(
        { author: "Academic Portal", sheets },
        `Staff_Analytics_${dateMode === "range" ? `${startDate}_to_${endDate}` : getTodayDateString()}.xls`,
      );
      return;
    }

    if (activeSection === "audit") {
      const changesList = filteredRecentChanges.length ? filteredRecentChanges : (data?.recentChanges ?? []);
      if (!changesList.length) {
        alert("No change audit data available to export.");
        return;
      }
      const headers = [
        "Date",
        "Slot",
        "Batch",
        "Section",
        "Master Subject",
        "Master Faculty",
        "Actual Subject",
        "Actual Faculty",
        "Type",
        "Reason",
      ];
      const rows = changesList.map((c) => [
        c.timetableDate,
        `"${c.slotLabel} (${c.slotTime})"`,
        c.batch,
        c.sectionName || "N/A",
        `"${(c.masterSubjectName || c.masterSubjectCode || "").replace(/"/g, '""')}"`,
        `"${(c.masterFacultyName || "").replace(/"/g, '""')}"`,
        `"${(c.newSubjectName || c.newSubjectCode || "").replace(/"/g, '""')}"`,
        `"${(c.newFacultyName || "").replace(/"/g, '""')}"`,
        c.varianceType,
        `"${(c.remarks || "").replace(/"/g, '""')}"`,
      ]);
      const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `change_audit_log_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // Default: activeSection === "variation"
    if (!filteredComparisons.length) {
      alert("No data available to export.");
      return;
    }
    const headers = [
      "Slot/Time",
      "Date",
      "Day",
      "Batch",
      "Section",
      "Master Subject Code",
      "Master Subject Name",
      "Master Faculty",
      "Today Subject Code",
      "Today Subject Name",
      "Today Faculty",
      "Variation Status",
      "Conducted Status",
      "Students Enrolled",
      "Students Present",
      "Students Absent",
      "Attendance %",
    ];
    const rows = filteredComparisons.map((c) => {
      const sEnr = (c.presentCount || 0) + (c.absentCount || 0);
      const sPres = c.presentCount || 0;
      const sAbs = c.absentCount || 0;
      const sEnrolledTotal = (c.enrolledCount && c.enrolledCount > 0) ? c.enrolledCount : (sEnr > 0 ? sEnr : 0);

      return [
        `"${c.slotLabel} (${c.time})"`,
        c.date,
        c.dayOfWeek,
        c.batch,
        c.sectionName || "N/A",
        c.masterSubjectCode || "",
        `"${(c.masterSubjectName || "").replace(/"/g, '""')}"`,
        `"${(c.masterFacultyName || "").replace(/"/g, '""')}"`,
        c.todaySubjectCode || "",
        `"${(c.todaySubjectName || "").replace(/"/g, '""')}"`,
        `"${(c.todayFacultyName || "").replace(/"/g, '""')}"`,
        c.varianceType === "UNCHANGED"
          ? "As Master"
          : c.varianceType === "FACULTY_SUBSTITUTE"
            ? "Faculty Substitute"
            : c.varianceType === "SUBJECT_SWAP"
              ? "Subject Swap"
              : "Both Sub & Swap",
        c.isConducted ? "Conducted" : "Scheduled",
        sEnrolledTotal > 0 ? sEnrolledTotal : "—",
        c.isConducted ? sPres : "—",
        c.isConducted ? sAbs : "—",
        c.isConducted && c.attendancePct != null ? `${c.attendancePct}%` : "Pending",
      ];
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `master_vs_today_timetable_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to PDF / Print (Comprehensive formatted report with Abstract first, then Date-wise breakdown)
  const handlePrintPdf = () => {
    const dateRangeLabel =
      dateMode === "range"
        ? `${startDate ? formatDisplayDate(startDate) : "Start"} to ${endDate ? formatDisplayDate(endDate) : "End"}`
        : formatDisplayDate(getTodayDateString());

    if (activeSection === "subjects") {
      if (selectedSubjectObj) {
        void printSubjectPdf(selectedSubjectObj);
        return;
      }

      const subjectsList = filteredSubjects.length ? filteredSubjects : (data?.subjects ?? []);
      if (!subjectsList.length && comparisonsBySection.length === 0) {
        alert("No subject data available to print.");
        return;
      }

      // Class & Section Wise Subject Allocation HTML (Website Section Cards UI)
      let sectionCardsHtml = "";
      if (comparisonsBySection.length > 0) {
        sectionCardsHtml = comparisonsBySection
          .map((secGroup) => {
            const secEnrolled = secGroup.secEnrolled || 0;
            const secTotalConducted = secGroup.cohortSubjects.reduce((acc, s) => acc + s.totalConducted, 0);
            const withAtt = secGroup.cohortSubjects.filter((s) => s.totalConducted > 0 && s.effectiveAttendancePct != null && s.effectiveAttendancePct > 0);
            const secAvgAtt = withAtt.length > 0 ? Math.round(withAtt.reduce((acc, s) => acc + (s.effectiveAttendancePct ?? 0), 0) / withAtt.length) : null;

            const rowsHtml = secGroup.cohortSubjects
              .map((sub) => {
                const assigned = sub.assignedFaculty.join("; ");
                const changed = sub.changedFaculty
                  .map((cf) => cf.originalFacultyName ? `${cf.facultyName} (sub for ${cf.originalFacultyName})` : cf.facultyName)
                  .join("; ");
                const conductedFacHtml = changed
                  ? `<span style="color: #b45309; font-weight: bold;">${escapeHtml(changed)}</span>`
                  : `<span style="color: #0f172a;">${escapeHtml(assigned ? `${assigned} (As Assigned)` : "As Assigned")}</span>`;

                const subEnrolled = secEnrolled;
                const isConducted = sub.totalConducted > 0;
                const subPres = isConducted ? (sub.totalPresent || 0) : 0;
                const subAbs = isConducted
                  ? ((sub.totalMarked || 0) > 0 ? Math.max(0, (sub.totalMarked || 0) - (sub.totalPresent || 0)) : Math.max(0, subEnrolled - (sub.totalPresent || 0)))
                  : 0;

                const attStr = isConducted
                  ? (sub.effectiveAttendancePct != null && sub.effectiveAttendancePct > 0
                      ? `${sub.effectiveAttendancePct}%`
                      : (sub.turnoutPct != null
                          ? `${sub.turnoutPct}%`
                          : (subEnrolled > 0 ? `${Math.round(((sub.totalPresent || 0) / subEnrolled) * 100)}%` : "100%")))
                  : '<span style="color: #64748b;">Pending</span>';

                return `
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold; color: #0f172a;">${escapeHtml(sub.subjectCode)}</td>
                    <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 600; color: #0f172a;">${escapeHtml(sub.subjectName || "")}</td>
                    <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; color: #334155;">${sub.masterWeeklyPeriods > 0 ? sub.masterWeeklyPeriods : (sub.totalScheduled || "—")}</td>
                    <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #15803d;">${sub.totalConducted}</td>
                    <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 9.5px; color: #334155;">${escapeHtml(assigned || "—")}</td>
                    <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 9.5px;">${conductedFacHtml}</td>
                    <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: 600; color: #334155;">${subEnrolled > 0 ? subEnrolled : "—"}</td>
                    <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #15803d;">${isConducted ? subPres : "—"}</td>
                    <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: ${subAbs > 0 ? "#be123c" : "#64748b"};">${isConducted ? subAbs : "—"}</td>
                    <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #1e40af;">${attStr}</td>
                  </tr>
                `;
              })
              .join("");

            return `
              <div style="margin-bottom: 18px; break-inside: avoid; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
                <!-- Website-matching Section Header Banner -->
                <div style="background-color: #f8fafc; border-bottom: 2px solid #047857; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 30px; height: 30px; background-color: #047857; color: #ffffff; font-weight: 800; font-size: 14px; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px;">
                      ${secGroup.sectionLetter !== "Unassigned" ? secGroup.sectionLetter : "S"}
                    </div>
                    <div>
                      <div style="display: flex; align-items: center; gap: 6px;">
                        <strong style="font-size: 13px; color: #0f172a;">${escapeHtml(secGroup.sectionTitle)}</strong>
                        <span style="background-color: #e0e7ff; color: #3730a3; padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: bold; border: 1px solid #c7d2fe;">
                          ${escapeHtml(secGroup.branchCode)}
                        </span>
                        <span style="background-color: #f1f5f9; color: #334155; padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 600; border: 1px solid #cbd5e1;">
                          Batch ${escapeHtml(secGroup.batch)}
                        </span>
                      </div>
                      <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">
                        ${secGroup.cohortSubjects.length} subjects registered &bull; ${secTotalConducted} classes conducted in period
                      </div>
                    </div>
                  </div>
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="background-color: #dcfce7; color: #15803d; border: 1px solid #86efac; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: bold;">
                      ● ${secTotalConducted} Conducted
                    </span>
                    <span style="background-color: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: bold;">
                      ${secEnrolled > 0 ? `${secEnrolled} Enrolled` : "Enrolled Pending"}
                    </span>
                    ${secAvgAtt != null ? `
                      <span style="background-color: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: bold;">
                        ${secAvgAtt}% Avg Attendance
                      </span>
                    ` : `
                      <span style="background-color: #f8fafc; color: #64748b; border: 1px solid #e2e8f0; padding: 3px 8px; border-radius: 12px; font-size: 10px;">
                        Attendance Pending
                      </span>
                    `}
                  </div>
                </div>

                <!-- Subjects Table for this Section -->
                <table style="width: 100%; border-collapse: collapse; font-size: 9.5px;">
                  <thead>
                    <tr style="background-color: #f1f5f9 !important; color: #0f172a !important; font-weight: 700; border-bottom: 2px solid #cbd5e1;">
                      <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: left; width: 80px; color: #0f172a !important; font-weight: 700;">Subject Code</th>
                      <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: left; color: #0f172a !important; font-weight: 700;">Subject Name</th>
                      <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; width: 60px; color: #0f172a !important; font-weight: 700;">Master Quota</th>
                      <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; width: 55px; color: #0f172a !important; font-weight: 700;">Conducted</th>
                      <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: left; width: 140px; color: #0f172a !important; font-weight: 700;">Assigned Faculty</th>
                      <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: left; width: 150px; color: #0f172a !important; font-weight: 700;">Conducted Faculty</th>
                      <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; width: 55px; color: #0f172a !important; font-weight: 700;">Enrolled</th>
                      <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; width: 50px; color: #0f172a !important; font-weight: 700;">Present</th>
                      <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; width: 50px; color: #0f172a !important; font-weight: 700;">Absent</th>
                      <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; width: 70px; color: #0f172a !important; font-weight: 700;">Attendance %</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rowsHtml}
                  </tbody>
                </table>
              </div>
            `;
          })
          .join("");
      } else {
        sectionCardsHtml = `
          <table style="width: 100%; border-collapse: collapse; font-size: 9.5px; margin-bottom: 12px; border: 1px solid #cbd5e1;">
            <thead>
              <tr style="background-color: #f1f5f9 !important; color: #0f172a !important; font-weight: 700; border-bottom: 2px solid #cbd5e1;">
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: left; width: 80px; color: #0f172a !important; font-weight: 700;">Subject Code</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: left; color: #0f172a !important; font-weight: 700;">Subject Name</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; width: 60px; color: #0f172a !important; font-weight: 700;">Master Quota</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; width: 55px; color: #0f172a !important; font-weight: 700;">Conducted</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: left; width: 140px; color: #0f172a !important; font-weight: 700;">Assigned Faculty</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: left; width: 150px; color: #0f172a !important; font-weight: 700;">Conducted Faculty</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; width: 55px; color: #0f172a !important; font-weight: 700;">Enrolled</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; width: 50px; color: #0f172a !important; font-weight: 700;">Present</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; width: 50px; color: #0f172a !important; font-weight: 700;">Absent</th>
                <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; width: 70px; color: #0f172a !important; font-weight: 700;">Attendance %</th>
              </tr>
            </thead>
            <tbody>
              ${subjectsList
                .map((s) => {
                  const assigned = Array.from(subjectAssignedFacultyMap.get(s.subjectCode) ?? (s.facultyNames ?? [])).join("; ");
                  const changed = Array.from(subjectChangedFacultyMap.get(s.subjectCode)?.values() ?? [])
                    .map((cf) => cf.originalFacultyName ? `${cf.facultyName} (sub for ${cf.originalFacultyName})` : cf.facultyName)
                    .join("; ");
                  const conductedFacHtml = changed
                    ? `<span style="color: #b45309; font-weight: bold;">${escapeHtml(changed)}</span>`
                    : `<span style="color: #0f172a;">${escapeHtml(assigned ? `${assigned} (As Assigned)` : "As Assigned")}</span>`;

                  const sEnr = (s.totalMarked || 0) > 0 ? s.totalMarked : "—";
                  const sPres = s.totalConducted > 0 && (s.totalPresent || 0) > 0 ? s.totalPresent : (s.totalConducted > 0 && (s.totalMarked || 0) > 0 ? 0 : "—");
                  const sAbs = s.totalConducted > 0 && (s.totalMarked || 0) > 0 ? Math.max(0, (s.totalMarked || 0) - (s.totalPresent || 0)) : "—";
                  const attStr = s.totalConducted > 0 && (s.turnoutPct != null || s.attendancePct > 0)
                    ? `${s.turnoutPct ?? s.attendancePct}%`
                    : (s.totalConducted > 0 ? "100%" : '<span style="color: #64748b;">Pending</span>');

                  return `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold; color: #0f172a;">${escapeHtml(s.subjectCode)}</td>
                      <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 600; color: #0f172a;">${escapeHtml(s.subjectName || "")}</td>
                      <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; color: #334155;">${s.masterWeeklyPeriods}</td>
                      <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #15803d;">${s.totalConducted}</td>
                      <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 9.5px; color: #334155;">${escapeHtml(assigned || "—")}</td>
                      <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 9.5px;">${conductedFacHtml}</td>
                      <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: 600; color: #334155;">${sEnr}</td>
                      <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #15803d;">${sPres}</td>
                      <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: ${sAbs !== "—" && sAbs > 0 ? "#be123c" : "#64748b"};">${sAbs}</td>
                      <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #1e40af;">${attStr}</td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
        `;
      }

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; color: #0f172a; padding: 16px; max-width: 1050px; margin: 0 auto; line-height: 1.4;">
          <!-- Official Institutional Masthead -->
          <div style="border-bottom: 2px solid #047857; padding-bottom: 12px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <div style="font-size: 10px; font-weight: bold; letter-spacing: 1.5px; text-transform: uppercase; color: #047857;">Academic Portal &bull; Office of Academic Affairs & Registrar</div>
              <h1 style="margin: 3px 0 2px; font-size: 20px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">Curriculum Delivery & Class Audit Report</h1>
              <p style="margin: 0; font-size: 11px; color: #475569;">
                Comprehensive Curriculum Delivery, Timetable Allotment & Student Attendance Audit
              </p>
            </div>
            <div style="text-align: right; font-size: 10px; color: #64748b; font-family: monospace;">
              <div style="font-weight: bold; color: #0f172a; font-size: 11px;">REF: SUB-AUD-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}</div>
              <div>Generated: ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</div>
              <div>Status: <span style="color: #047857; font-weight: bold;">OFFICIAL AUDIT</span></div>
            </div>
          </div>

          <!-- Parameter Badges Box -->
          <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; font-size: 11px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 2px 0;"><strong>Filter Scope:</strong> ${escapeHtml(selectedCohortTitle || "All Classes & Sections")}</td>
                <td style="padding: 2px 0;"><strong>Period:</strong> ${escapeHtml(dateRangeLabel)}</td>
                <td style="padding: 2px 0;"><strong>Academic Year:</strong> ${escapeHtml(academicYear || "Current")}</td>
                <td style="padding: 2px 0;"><strong>Total Classes / Sections:</strong> ${comparisonsBySection.length} Cohorts</td>
                <td style="padding: 2px 0;"><strong>Total Subjects:</strong> ${subjectAnalytics.totalSubjects}</td>
              </tr>
            </table>
          </div>

          <!-- 1. Executive Abstract -->
          <div style="margin-bottom: 16px; break-inside: avoid;">
            <h3 style="font-size: 12px; text-transform: uppercase; margin: 0 0 6px; color: #0f172a; border-bottom: 2px solid #047857; padding-bottom: 3px; font-weight: bold;">
              1. Executive Curriculum Abstract & Workload Metrics
            </h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 8px;">
              <thead>
                <tr style="background-color: #f1f5f9 !important; color: #0f172a !important; font-weight: 700; border-bottom: 2px solid #cbd5e1;">
                  <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a !important; font-weight: 700;">Total Subjects</th>
                  <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a !important; font-weight: 700;">Master Quota</th>
                  <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a !important; font-weight: 700;">Conducted</th>
                  <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a !important; font-weight: 700;">Students Enrolled</th>
                  <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a !important; font-weight: 700;">Students Present</th>
                  <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a !important; font-weight: 700;">Students Absent</th>
                  <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a !important; font-weight: 700;">Attendance Rate</th>
                </tr>
              </thead>
              <tbody>
                <tr style="text-align: center; font-weight: bold; background-color: #f8fafc;">
                  <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 13px; color: #15803d;">${subjectAnalytics.totalSubjects}</td>
                  <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 13px; color: #334155;">${subjectAnalytics.totalWeeklyQuota} p/wk</td>
                  <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 13px; color: #15803d;">${subjectAnalytics.totalConducted} held</td>
                  <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 13px; color: #334155;">${totalCohortStudentsEnrolled > 0 ? totalCohortStudentsEnrolled : ((subjectAnalytics.totalMarked || 0) > 0 ? subjectAnalytics.totalMarked : 30)}</td>
                  <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 13px; color: #15803d;">${subjectAnalytics.totalConducted > 0 ? (subjectAnalytics.totalPresent || 0) : 0}</td>
                  <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 13px; color: #be123c;">${subjectAnalytics.totalConducted > 0 ? (subjectAnalytics.totalAbsent || 0) : 0}</td>
                  <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 13px; color: #1e40af;">${subjectAnalytics.totalConducted > 0 && (subjectAnalytics.overallTurnoutPct != null || subjectAnalytics.avgAttendance != null) ? `${subjectAnalytics.overallTurnoutPct ?? subjectAnalytics.avgAttendance}%` : '<span style="color: #64748b; font-weight: 600;">Pending</span>'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- 2. Class & Section Wise Subject Allocation & Curriculum Audit -->
          <div style="margin-bottom: 20px;">
            <h3 style="font-size: 12px; text-transform: uppercase; margin: 16px 0 8px; color: #0f172a; border-bottom: 2px solid #047857; padding-bottom: 4px; font-weight: bold;">
              2. Class & Section Wise Curriculum Delivery & Subject Roster (${comparisonsBySection.length > 0 ? `${comparisonsBySection.length} Cohorts` : `${subjectsList.length} Subjects`})
            </h3>
            ${sectionCardsHtml}
          </div>

          <!-- Institutional Verification Sign-Off Footer -->
          <div style="margin-top: 28px; padding-top: 14px; border-top: 1px solid #cbd5e1; break-inside: avoid;">
            <div style="display: flex; justify-content: space-between; margin-top: 24px; font-size: 10px; color: #475569;">
              <div style="border-top: 1px solid #64748b; width: 170px; text-align: center; padding-top: 4px;">
                <strong>Head of Department</strong><br/>
                Department Curriculum Committee
              </div>
              <div style="border-top: 1px solid #64748b; width: 170px; text-align: center; padding-top: 4px;">
                <strong>Dean, Academic Affairs</strong><br/>
                Office of Academic Monitoring
              </div>
              <div style="border-top: 1px solid #64748b; width: 170px; text-align: center; padding-top: 4px;">
                <strong>Controller of Examinations</strong><br/>
                Attendance & Credit Certification
              </div>
            </div>
            <p style="text-align: center; font-size: 9px; color: #94a3b8; margin-top: 20px;">
              This is a computer-generated institutional audit document produced by Academic Portal. Official record of curriculum execution.
            </p>
          </div>
        </div>
      `;

      printHtml(htmlContent, {
        title: `Subject_Analysis_${dateMode === "range" ? `${startDate}_to_${endDate}` : getTodayDateString()}`,
        subtitle: `Curriculum delivery report (${dateRangeLabel})`,
        hideHeader: true,
      });
      return;
    }

    if (activeSection === "staff") {
      if (selectedStaffObj) {
        void printFacultyPdf(selectedStaffObj);
        return;
      }

      const facultiesList = filteredFaculties.length ? filteredFaculties : (data?.faculties ?? []);
      if (!facultiesList.length) {
        alert("No faculty data available to print.");
        return;
      }

      // Group comparisons by date for Date-wise breakdown
      const dateMap = new Map<string, typeof filteredComparisons>();
      filteredComparisons.forEach((c) => {
        const d = c.date || "Scheduled Plan";
        if (!dateMap.has(d)) dateMap.set(d, []);
        dateMap.get(d)!.push(c);
      });
      const sortedDates = Array.from(dateMap.keys()).sort();

      let dateTablesHtml = "";
      sortedDates.forEach((d) => {
        const sessions = dateMap.get(d)!;
        const dayName = sessions[0]?.dayOfWeek || "";
        const dayPres = sessions.reduce((acc, s) => acc + (s.presentCount || 0), 0);
        const dayAbs = sessions.reduce((acc, s) => acc + (s.absentCount || 0), 0);
        const dayEnr = dayPres + dayAbs;
        const dayTurnout = dayEnr > 0 ? Math.round((dayPres / dayEnr) * 100) : null;
        const dayHeld = sessions.filter((s) => s.isConducted).length;

        dateTablesHtml += `
          <div style="margin-top: 14px; break-inside: avoid;">
            <div style="background-color: #f1f5f9; padding: 5px 8px; font-weight: bold; font-size: 11px; border: 1px solid #cbd5e1; border-bottom: none; display: flex; justify-content: space-between;">
              <span>📅 Date: ${d} ${dayName ? `(${dayName})` : ""}</span>
              <span>${sessions.length} Session(s) &bull; <b style="color: #15803d;">${dayPres} Present</b> / <b style="color: #be123c;">${dayAbs} Absent</b> ${dayTurnout != null ? `(${dayTurnout}% Attendance)` : ""}</span>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 8px;">
              <thead>
                <tr style="background-color: #f1f5f9; color: #0f172a; font-weight: 700; border-bottom: 2px solid #cbd5e1;">
                  <th style="padding: 5px; border: 1px solid #cbd5e1; text-align: left; color: #0f172a;">Slot & Time</th>
                  <th style="padding: 5px; border: 1px solid #cbd5e1; text-align: left; color: #0f172a;">Class & Section</th>
                  <th style="padding: 5px; border: 1px solid #cbd5e1; text-align: left; color: #0f172a;">Subject</th>
                  <th style="padding: 5px; border: 1px solid #cbd5e1; text-align: left; color: #0f172a;">Faculty In Charge</th>
                  <th style="padding: 5px; border: 1px solid #cbd5e1; text-align: left; color: #0f172a;">Action Role</th>
                  <th style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; color: #0f172a;">Conducted</th>
                  <th style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; color: #0f172a;">Enrolled</th>
                  <th style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; color: #0f172a;">Present</th>
                  <th style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; color: #0f172a;">Absent</th>
                  <th style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; color: #0f172a;">Attendance %</th>
                </tr>
              </thead>
              <tbody>
                ${sessions
                  .map((s) => {
                    const sEnr = (s.presentCount || 0) + (s.absentCount || 0);
                    const sPres = s.presentCount || 0;
                    const sAbs = s.absentCount || 0;
                    const sEnrolledTotal = (s.enrolledCount && s.enrolledCount > 0) ? s.enrolledCount : (sEnr > 0 ? sEnr : 0);
                    const sTurnout = s.isConducted ? (s.attendancePct != null ? `${s.attendancePct}%` : (sEnr > 0 ? `${Math.round((sPres / sEnr) * 100)}%` : "100%")) : "Pending";
                    return `
                  <tr>
                    <td style="padding: 5px; border: 1px solid #cbd5e1;">${s.slotLabel} (${s.time})</td>
                    <td style="padding: 5px; border: 1px solid #cbd5e1;">${formatSessionClassInfo(s, true)}</td>
                    <td style="padding: 5px; border: 1px solid #cbd5e1;"><b>${escapeHtml(s.todaySubjectName || s.masterSubjectName || "—")}</b></td>
                    <td style="padding: 5px; border: 1px solid #cbd5e1; font-weight: bold;">${escapeHtml(s.todayFacultyName || s.masterFacultyName || "—")}</td>
                    <td style="padding: 5px; border: 1px solid #cbd5e1;">${escapeHtml(s.varianceType === "UNCHANGED" ? "As Master" : s.varianceType === "FACULTY_SUBSTITUTE" ? "Faculty Substitute" : s.varianceType === "SUBJECT_SWAP" ? "Subject Swap" : "Sub & Swap")}</td>
                    <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center;">${s.isConducted ? "Yes ✓" : "Scheduled"}</td>
                    <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center;">${sEnrolledTotal > 0 ? sEnrolledTotal : "—"}</td>
                    <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #15803d;">${s.isConducted ? sPres : "—"}</td>
                    <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: ${sAbs > 0 ? "#be123c" : "#64748b"};">${s.isConducted ? sAbs : "—"}</td>
                    <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #0369a1;">${sTurnout}</td>
                  </tr>
                `;
                  })
                  .join("")}
                <tr style="background-color: #f8fafc; font-weight: bold; border-top: 2px solid #0f172a;">
                  <td colspan="5" style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: right;">Day Total:</td>
                  <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; color: #15803d;">${dayHeld} Held</td>
                  <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center;">${dayEnr > 0 ? dayEnr : "—"}</td>
                  <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; color: #15803d;">${dayPres > 0 ? dayPres : (dayEnr > 0 ? 0 : "—")}</td>
                  <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; color: #be123c;">${dayAbs > 0 ? dayAbs : (dayEnr > 0 ? 0 : "—")}</td>
                  <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; color: #0369a1;">${dayTurnout != null ? `${dayTurnout}%` : (dayHeld > 0 ? "100%" : "Pending")}</td>
                </tr>
              </tbody>
            </table>
          </div>
        `;
      });

      let staffRowsHtml = "";
      facultiesList.forEach((f) => {
        staffRowsHtml += `
          <tr>
            <td style="padding: 5px 6px; border: 1px solid #cbd5e1; font-weight: 600;">${escapeHtml(f.facultyName || "")}</td>
            <td style="padding: 5px 6px; border: 1px solid #cbd5e1; font-family: monospace;">#${escapeHtml(f.hrmsId)}</td>
            <td style="padding: 5px 6px; border: 1px solid #cbd5e1; font-size: 9.5px;">${escapeHtml((f.subjects || []).join(", ") || "—")}</td>
            <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center;">${f.masterAssignedPeriods}</td>
            <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #15803d;">${f.classesConducted}</td>
            <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; color: #be123c;">${f.relievedCount > 0 ? `-${f.relievedCount}` : 0}</td>
            <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; color: #0284c7;">${f.substituteTakenCount > 0 ? `+${f.substituteTakenCount}` : 0}</td>
            <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 800; color: #0f172a;">${f.netTeachingCount}</td>
            <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 600;">${f.totalEnrolled || f.totalMarked || "—"}</td>
            <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #15803d;">${f.classesConducted > 0 && f.totalPresent != null && f.totalPresent > 0 ? f.totalPresent : (f.classesConducted > 0 && (f.totalPresent != null || f.totalAbsent != null) ? 0 : "—")}</td>
            <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #be123c;">${f.classesConducted > 0 && f.totalAbsent != null && f.totalAbsent > 0 ? f.totalAbsent : (f.classesConducted > 0 && (f.totalPresent != null || f.totalAbsent != null) ? 0 : "—")}</td>
            <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #0369a1;">${f.classesConducted > 0 && f.attendancePct != null ? `${f.attendancePct}%` : "Pending"}</td>
          </tr>
        `;
      });

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; color: #0f172a; padding: 16px; max-width: 1050px; margin: 0 auto; line-height: 1.4;">
          <!-- Official Institutional Masthead -->
          <div style="border-bottom: 2px solid #047857; padding-bottom: 12px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <div style="font-size: 10px; font-weight: bold; letter-spacing: 1.5px; text-transform: uppercase; color: #047857;">Academic Portal &bull; Office of Academic Affairs & HRMS</div>
              <h1 style="margin: 3px 0 2px; font-size: 20px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">Faculty Workload & Action Audit Report</h1>
              <p style="margin: 0; font-size: 11px; color: #475569;">
                Comprehensive Faculty Teaching Workload, Attendance Delivery & Substitution Audit
              </p>
            </div>
            <div style="text-align: right; font-size: 10px; color: #64748b; font-family: monospace;">
              <div style="font-weight: bold; color: #0f172a; font-size: 11px;">REF: STF-AUD-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}</div>
              <div>Generated: ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</div>
              <div>Status: <span style="color: #047857; font-weight: bold;">OFFICIAL AUDIT</span></div>
            </div>
          </div>

          <!-- Parameter Badges Box -->
          <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; font-size: 11px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 2px 0;"><strong>Filter Scope:</strong> ${escapeHtml(selectedCohortTitle || "All Sections")}</td>
                <td style="padding: 2px 0;"><strong>Period:</strong> ${escapeHtml(dateRangeLabel)}</td>
                <td style="padding: 2px 0;"><strong>Academic Year:</strong> ${escapeHtml(academicYear || "Current")}</td>
                <td style="padding: 2px 0;"><strong>Total Faculty:</strong> ${staffAnalytics.totalStaff}</td>
              </tr>
            </table>
          </div>

          <!-- 1. Executive Abstract & Student Attendance -->
          <div style="margin-bottom: 16px; break-inside: avoid;">
            <h3 style="font-size: 12px; text-transform: uppercase; margin: 0 0 6px; color: #0f172a; border-bottom: 2px solid #047857; padding-bottom: 3px; font-weight: bold;">
              1. Executive Faculty Abstract & Workload Metrics
            </h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 8px;">
              <thead>
                <tr style="background-color: #f1f5f9 !important; color: #0f172a !important; font-weight: 700; border-bottom: 2px solid #cbd5e1;">
                  <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a !important; font-weight: 700;">Total Staff</th>
                  <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a !important; font-weight: 700;">Master Quota</th>
                  <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a !important; font-weight: 700;">Conducted</th>
                  <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a !important; font-weight: 700;">Relieved Away (-)</th>
                  <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a !important; font-weight: 700;">Substitute Taken (+)</th>
                  <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a !important; font-weight: 700;">Net Teaching Load</th>
                  <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a !important; font-weight: 700;">Students Present</th>
                  <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a !important; font-weight: 700;">Students Absent</th>
                  <th style="padding: 6px; border: 1px solid #cbd5e1; color: #0f172a !important; font-weight: 700;">Attendance %</th>
                </tr>
              </thead>
              <tbody>
                <tr style="text-align: center; font-weight: bold; background-color: #f8fafc;">
                  <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 13px; color: #047857;">${staffAnalytics.totalStaff}</td>
                  <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 13px; color: #334155;">${staffAnalytics.totalAssignedLoad} p/wk</td>
                  <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 13px; color: #15803d;">${staffAnalytics.totalConducted} held</td>
                  <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 13px; color: #be123c;">${staffAnalytics.totalRelieved}</td>
                  <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 13px; color: #0284c7;">${staffAnalytics.totalSubstituteTaken}</td>
                  <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 13px; color: #0f172a;">${staffAnalytics.totalNetLoad} sessions</td>
                  <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 13px; color: #15803d;">${staffAnalytics.totalConducted > 0 && (staffAnalytics.totalPresent || 0) > 0 ? staffAnalytics.totalPresent : (staffAnalytics.totalConducted > 0 && (staffAnalytics.totalMarked || 0) > 0 ? 0 : "—")}</td>
                  <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 13px; color: #be123c;">${staffAnalytics.totalConducted > 0 && (staffAnalytics.totalAbsent || 0) > 0 ? staffAnalytics.totalAbsent : (staffAnalytics.totalConducted > 0 && (staffAnalytics.totalMarked || 0) > 0 ? 0 : "—")}</td>
                  <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 13px; color: #0369a1;">${staffAnalytics.totalConducted > 0 && staffAnalytics.overallTurnoutPct != null ? `${staffAnalytics.overallTurnoutPct}%` : "Pending"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- 2. Faculty Workload & Allocation Roster -->
          <div style="margin-bottom: 16px;">
            <h3 style="font-size: 12px; text-transform: uppercase; margin: 12px 0 6px; color: #0f172a; border-bottom: 2px solid #047857; padding-bottom: 3px; font-weight: bold;">
              2. Faculty Workload & Allocation Roster (${facultiesList.length} faculty members)
            </h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 8px;">
              <thead>
                <tr style="background-color: #f1f5f9 !important; color: #0f172a !important; font-weight: 700; border-bottom: 2px solid #cbd5e1;">
                  <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: left; color: #0f172a !important; font-weight: 700;">Faculty Name</th>
                  <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: left; color: #0f172a !important; font-weight: 700;">HRMS ID</th>
                  <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: left; color: #0f172a !important; font-weight: 700;">Assigned Subjects</th>
                  <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; color: #0f172a !important; font-weight: 700;">Master Quota</th>
                  <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; color: #0f172a !important; font-weight: 700;">Conducted</th>
                  <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; color: #0f172a !important; font-weight: 700;">Relieved (-)</th>
                  <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; color: #0f172a !important; font-weight: 700;">Substitute (+)</th>
                  <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; color: #0f172a !important; font-weight: 700;">Net Load</th>
                  <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; color: #0f172a !important; font-weight: 700;">Enrolled</th>
                  <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; color: #0f172a !important; font-weight: 700;">Present</th>
                  <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; color: #0f172a !important; font-weight: 700;">Absent</th>
                  <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; color: #0f172a !important; font-weight: 700;">Attendance %</th>
                </tr>
              </thead>
              <tbody>
                ${staffRowsHtml}
              </tbody>
            </table>
          </div>

          <!-- 3. Date-wise Data Breakdown -->
          <div>
            <h3 style="font-size: 12px; text-transform: uppercase; margin: 12px 0 4px; color: #0f172a; border-bottom: 2px solid #047857; padding-bottom: 3px; font-weight: bold;">
              3. Date-wise Timetable Delivery & Substitution Actions (${dateRangeLabel})
            </h3>
            ${dateTablesHtml || `<p style="color: #64748b; font-size: 11px; padding: 12px 0;">No timetable sessions recorded in the selected range.</p>`}
          </div>

          <!-- Institutional Verification Sign-Off Footer -->
          <div style="margin-top: 28px; padding-top: 14px; border-top: 1px solid #cbd5e1; break-inside: avoid;">
            <div style="display: flex; justify-content: space-between; margin-top: 24px; font-size: 10px; color: #475569;">
              <div style="border-top: 1px solid #64748b; width: 170px; text-align: center; padding-top: 4px;">
                <strong>Head of Department</strong><br/>
                Department Faculty Council
              </div>
              <div style="border-top: 1px solid #64748b; width: 170px; text-align: center; padding-top: 4px;">
                <strong>Dean, Academic Affairs</strong><br/>
                Faculty Workload & Performance
              </div>
              <div style="border-top: 1px solid #64748b; width: 170px; text-align: center; padding-top: 4px;">
                <strong>Registrar / HR Director</strong><br/>
                Official HRMS Workload Record
              </div>
            </div>
            <p style="text-align: center; font-size: 9px; color: #94a3b8; margin-top: 20px;">
              This is a computer-generated institutional audit document produced by Academic Portal. Official record of faculty teaching obligations.
            </p>
          </div>
        </div>
      `;

      printHtml(htmlContent, {
        title: `Staff_Analytics_${dateMode === "range" ? `${startDate}_to_${endDate}` : getTodayDateString()}`,
        subtitle: `Faculty workload and audit report (${dateRangeLabel})`,
        hideHeader: true,
      });
      return;
    }

    if (printAreaRef.current) {
      printElement(printAreaRef.current, {
        title: "",
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. All-in-one Comprehensive Filter Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs space-y-3">
        {/* Academic Filters Grid: Academic Year, College, Program, Branch, Class, Section, Year, Semester */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
          {/* Academic Year */}
          <label className="text-[11px] font-medium text-slate-600">
            Academic Year
            <select
              value={academicYear}
              onChange={(e) => {
                setAcademicYear(e.target.value);
                setSelectedCollege(null);
                setSelectedCourse(null);
                setSelectedBranch(null);
                setSelectedClassKey(null);
                setSelectedBatch(null);
                setSelectedYear(null);
                setSelectedSemester(null);
                setSelectedSection(null);
              }}
              className="mt-1 block h-8.5 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 shadow-xs focus:border-navy-600 focus:outline-none"
            >
              {masters?.academicYears.map((item) => (
                <option key={item.id} value={item.label}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          {/* College */}
          <label className="text-[11px] font-medium text-slate-600">
            College
            <select
              value={selectedCollege ?? ""}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null;
                setSelectedCollege(val);
                setSelectedCourse(null);
                setSelectedBranch(null);
                setSelectedClassKey(null);
                setSelectedBatch(null);
                setSelectedYear(null);
                setSelectedSemester(null);
                setSelectedSection(null);
              }}
              className="mt-1 block h-8.5 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 shadow-xs focus:border-navy-600 focus:outline-none truncate"
            >
              <option value="">All Colleges</option>
              {masters?.colleges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          {/* Program / Course */}
          <label className="text-[11px] font-medium text-slate-600">
            Program
            <select
              value={selectedCourse ?? ""}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null;
                setSelectedCourse(val);
                setSelectedBranch(null);
                setSelectedClassKey(null);
                setSelectedBatch(null);
                setSelectedYear(null);
                setSelectedSemester(null);
                setSelectedSection(null);
              }}
              className="mt-1 block h-8.5 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 shadow-xs focus:border-navy-600 focus:outline-none truncate"
            >
              <option value="">All Programs</option>
              {filterCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          {/* Branch */}
          <label className="text-[11px] font-medium text-slate-600">
            Branch
            <select
              value={selectedBranch ?? ""}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null;
                setSelectedBranch(val);
                setSelectedClassKey(null);
                setSelectedBatch(null);
                setSelectedYear(null);
                setSelectedSemester(null);
                setSelectedSection(null);
              }}
              className="mt-1 block h-8.5 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 shadow-xs focus:border-navy-600 focus:outline-none truncate"
            >
              <option value="">All Branches</option>
              {filterBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          {/* Class (Dynamic cascading: shows available classes / cohorts) */}
          <label className="text-[11px] font-medium text-slate-600">
            Class
            <select
              value={selectedClassKey ?? ""}
              onChange={(e) => handleClassChange(e.target.value || null)}
              className="mt-1 block h-8.5 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 shadow-xs focus:border-navy-600 focus:outline-none truncate"
            >
              <option value="">
                {availableClasses.length === 0 ? "All Classes" : `All Classes (${availableClasses.length})`}
              </option>
              {availableClasses.map((cls) => (
                <option key={cls.key} value={cls.key}>
                  {cls.label} {cls.sections.length > 0 ? `(${cls.sections.length} sec)` : ""}
                </option>
              ))}
            </select>
          </label>

          {/* Section (Dynamic: if selected class has 2 sections -> shows 2, if 4 -> shows 4) */}
          <label className="text-[11px] font-medium text-slate-600">
            Section
            <select
              value={selectedSection ?? ""}
              onChange={(e) => setSelectedSection(e.target.value || null)}
              disabled={availableSections.length === 0}
              className="mt-1 block h-8.5 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 shadow-xs focus:border-navy-600 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
            >
              <option value="">
                {availableSections.length === 0
                  ? "No Sections"
                  : `All Sections (${availableSections.length})`}
              </option>
              {availableSections.map((sec) => (
                <option key={sec} value={sec}>
                  Section {sec}
                </option>
              ))}
            </select>
          </label>

          {/* Year */}
          <label className="text-[11px] font-medium text-slate-600">
            Year
            <select
              value={selectedYear ?? ""}
              onChange={(e) => handleYearChange(e.target.value ? Number(e.target.value) : null)}
              className="mt-1 block h-8.5 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 shadow-xs focus:border-navy-600 focus:outline-none"
            >
              <option value="">All Years</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  Year {y}
                </option>
              ))}
            </select>
          </label>

          {/* Semester */}
          <label className="text-[11px] font-medium text-slate-600">
            Semester
            <select
              value={selectedSemester ?? ""}
              onChange={(e) => handleSemesterChange(e.target.value ? Number(e.target.value) : null)}
              className="mt-1 block h-8.5 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 shadow-xs focus:border-navy-600 focus:outline-none"
            >
              <option value="">All Semesters</option>
              <option value="1">Sem 1</option>
              <option value="2">Sem 2</option>
            </select>
          </label>
        </div>

        {/* Row 2: Search on Left Side, Date Filter (Today / Range toggle + pickers) */}
        <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input on the LEFT SIDE */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff, subject, period..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8.5 w-56 sm:w-64 rounded-md border border-slate-300 bg-white pl-8 pr-7 text-xs text-slate-800 placeholder-slate-400 focus:border-navy-700 focus:outline-none shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Date Mode Toggle: Today vs Date Range */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100/90 p-0.5 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => {
                    setDateMode("today");
                    const t = getTodayDateString();
                    setStartDate(t);
                    setEndDate(t);
                  }}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer",
                    dateMode === "today"
                      ? "bg-white text-navy-900 shadow-xs font-bold"
                      : "text-slate-600 hover:text-navy-900",
                  )}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setDateMode("range")}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer",
                    dateMode === "range"
                      ? "bg-white text-navy-900 shadow-xs font-bold"
                      : "text-slate-600 hover:text-navy-900",
                  )}
                >
                  Date Range
                </button>
              </div>

              {dateMode === "today" ? (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200/80">
                  <CalendarCheck className="h-3.5 w-3.5 text-blue-600" />
                  Today ({formatDisplayDate(getTodayDateString())})
                </span>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">From:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-8 rounded-md border border-slate-300 px-2 text-xs text-slate-800 bg-white shadow-2xs"
                  />
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">To:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-8 rounded-md border border-slate-300 px-2 text-xs text-slate-800 bg-white shadow-2xs"
                  />
                  {(startDate || endDate) && (
                    <button
                      type="button"
                      onClick={() => {
                        setStartDate("");
                        setEndDate("");
                      }}
                      className="text-xs text-rose-600 hover:underline cursor-pointer ml-1"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>
            {/* Filter chips if staff or subject selected */}
            {selectedStaffObj && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200">
                Staff: {selectedStaffObj.facultyName}
                <button
                  type="button"
                  onClick={() => setSelectedStaffHrmsId(null)}
                  className="hover:text-amber-950 cursor-pointer ml-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {selectedSubjectObj && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-200">
                Subject: {selectedSubjectObj.subjectCode}
                <button
                  type="button"
                  onClick={() => setSelectedSubjectCode(null)}
                  className="hover:text-emerald-950 cursor-pointer ml-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>

          {/* Action Buttons: Excel, PDF, Reset on the RIGHT SIDE */}
          <div className="flex items-center gap-2 ml-auto">
            {loading && (
              <span className="text-[11px] text-slate-400 font-medium mr-1 animate-pulse">
                Refreshing...
              </span>
            )}
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50/60 px-3 text-xs font-semibold text-emerald-800 shadow-2xs hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              Excel
            </button>
            <button
              type="button"
              onClick={handlePrintPdf}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-rose-300 bg-rose-50/60 px-3 text-xs font-semibold text-rose-700 shadow-2xs hover:bg-rose-100 transition-colors cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5 text-rose-600" />
              PDF
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              disabled={!hasActiveFilters}
              className={cn(
                "inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs font-medium shadow-2xs transition-colors",
                hasActiveFilters
                  ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-navy-900 cursor-pointer"
                  : "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed",
              )}
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="space-y-4">
        {/* 3. Executive KPI Metric Cards (Interactive & Section-Tailored) */}
        {activeSection === "subjects" ? (
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
            {/* Card 1: Total Subjects (Replaces Master Class in Subject Analytics) */}
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById("subject-analytics-table-container");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className={cn(
                "rounded-xl border p-3.5 shadow-2xs text-left transition-all duration-200 cursor-pointer group hover:-translate-y-0.5 hover:shadow-md",
                "border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 hover:border-emerald-300",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  Total Subjects
                </span>
                <BookOpen className="h-3.5 w-3.5 text-emerald-500 group-hover:text-emerald-700 transition-colors" />
              </div>
              <div className="mt-1">
                <span className="text-2xl font-extrabold text-emerald-950">
                  {subjectAnalytics.totalSubjects}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-emerald-800/80 font-medium">
                {dateMode === "today" ? "Active subjects today" : "Subjects in filter scope"}
              </p>
              <p className="text-[9px] text-emerald-700/70 font-semibold">Excl. lunch & breaks · Incl. labs, CRT</p>
              <span className="mt-1 flex items-center gap-1 text-[10px] font-bold text-emerald-700 opacity-80 group-hover:opacity-100 group-hover:underline">
                View subject list <ChevronRight className="h-2.5 w-2.5" />
              </span>
            </button>

            {/* Card 2: Master Quota */}
            <button
              type="button"
              onClick={() => {
                setActiveKpiDrawer("master");
                setDrawerSearch("");
              }}
              className={cn(
                "rounded-xl border p-3.5 shadow-2xs text-left transition-all duration-200 cursor-pointer group hover:-translate-y-0.5 hover:shadow-md",
                activeKpiDrawer === "master"
                  ? "border-blue-400 bg-blue-100/70 ring-2 ring-blue-400"
                  : "border-blue-100 bg-blue-50/40 hover:bg-blue-50/80 hover:border-blue-200",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                  Master Quota
                </span>
                <CalendarCheck className="h-3.5 w-3.5 text-blue-400 group-hover:text-blue-600 transition-colors" />
              </div>
              <div className="mt-1">
                <span className="text-2xl font-extrabold text-blue-900">
                  {subjectAnalytics.totalWeeklyQuota}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-blue-700/80">Weekly lecture quota</p>
              <p className="text-[9px] text-blue-600/70 font-semibold">Total periods planned / wk</p>
              <span className="mt-1 flex items-center gap-1 text-[10px] font-bold text-blue-600 opacity-80 group-hover:opacity-100 group-hover:underline">
                View master plan <ChevronRight className="h-2.5 w-2.5" />
              </span>
            </button>

            {/* Card 3: Classes Conducted */}
            <button
              type="button"
              onClick={() => {
                setActiveKpiDrawer("conducted");
                setDrawerSearch("");
              }}
              className={cn(
                "rounded-xl border p-3.5 shadow-2xs text-left transition-all duration-200 cursor-pointer group hover:-translate-y-0.5 hover:shadow-md",
                activeKpiDrawer === "conducted"
                  ? "border-teal-400 bg-teal-100/70 ring-2 ring-teal-400"
                  : "border-teal-100 bg-teal-50/40 hover:bg-teal-50/80 hover:border-teal-200",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700">
                  Classes Conducted
                </span>
                <CheckCircle2 className="h-3.5 w-3.5 text-teal-500 group-hover:text-teal-700 transition-colors" />
              </div>
              <div className="mt-1">
                <span className="text-2xl font-extrabold text-teal-900">
                  {subjectAnalytics.totalConducted}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-teal-700/80">Attended / held</p>
              <p className="text-[9px] text-teal-600/70 font-semibold">Attendance marked sessions</p>
              <span className="mt-1 flex items-center gap-1 text-[10px] font-bold text-teal-700 opacity-80 group-hover:opacity-100 group-hover:underline">
                View held classes <ChevronRight className="h-2.5 w-2.5" />
              </span>
            </button>

            {/* Card 4: Subjects Altered */}
            <button
              type="button"
              onClick={() => {
                setActiveKpiDrawer("changed");
                setDrawerSearch("");
              }}
              className={cn(
                "rounded-xl border p-3.5 shadow-2xs text-left transition-all duration-200 cursor-pointer group hover:-translate-y-0.5 hover:shadow-md",
                activeKpiDrawer === "changed"
                  ? "border-amber-400 bg-amber-100/70 ring-2 ring-amber-400"
                  : "border-amber-100 bg-amber-50/40 hover:bg-amber-50/80 hover:border-amber-200",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                  Subjects Altered
                </span>
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 group-hover:text-amber-700 transition-colors" />
              </div>
              <div className="mt-1">
                <span className="text-2xl font-extrabold text-amber-800">
                  {subjectAnalytics.alteredSubjectsCount}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-amber-700/80">{subjectAnalytics.totalChanges} alterations recorded</p>
              <p className="text-[9px] text-amber-600/70 font-semibold">Altered from master plan</p>
              <span className="mt-1 flex items-center gap-1 text-[10px] font-bold text-amber-800 opacity-90 group-hover:opacity-100 group-hover:underline">
                View alterations <ChevronRight className="h-2.5 w-2.5" />
              </span>
            </button>

            {/* Card 5: Period Swaps */}
            <button
              type="button"
              onClick={() => {
                setActiveKpiDrawer("swapped");
                setDrawerSearch("");
              }}
              className={cn(
                "rounded-xl border p-3.5 shadow-2xs text-left transition-all duration-200 cursor-pointer group hover:-translate-y-0.5 hover:shadow-md",
                activeKpiDrawer === "swapped"
                  ? "border-purple-400 bg-purple-100/70 ring-2 ring-purple-400"
                  : "border-purple-100 bg-purple-50/40 hover:bg-purple-50/80 hover:border-purple-200",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">
                  Period Swaps
                </span>
                <ArrowLeftRight className="h-3.5 w-3.5 text-purple-500 group-hover:text-purple-700 transition-colors" />
              </div>
              <div className="mt-1">
                <span className="text-2xl font-extrabold text-purple-800">
                  {subjectAnalytics.totalSwappedOut + subjectAnalytics.totalSwappedIn}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-purple-700/80">
                {subjectAnalytics.totalSwappedOut} Out · {subjectAnalytics.totalSwappedIn} In
              </p>
              <p className="text-[9px] text-purple-600/70 font-semibold">Subject interchange instances</p>
              <span className="mt-1 flex items-center gap-1 text-[10px] font-bold text-purple-800 opacity-90 group-hover:opacity-100 group-hover:underline">
                View swaps <ChevronRight className="h-2.5 w-2.5" />
              </span>
            </button>

            {/* Card 6: Average Attendance */}
            <button
              type="button"
              onClick={() => {
                setActiveKpiDrawer("rate");
                setDrawerSearch("");
              }}
              className={cn(
                "rounded-xl border p-3.5 shadow-2xs text-left transition-all duration-200 cursor-pointer group hover:-translate-y-0.5 hover:shadow-md",
                activeKpiDrawer === "rate"
                  ? "border-indigo-400 bg-indigo-100/70 ring-2 ring-indigo-400"
                  : "border-indigo-100 bg-indigo-50/40 hover:bg-indigo-50/80 hover:border-indigo-200",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                  Avg Attendance
                </span>
                <Percent className="h-3.5 w-3.5 text-indigo-500 group-hover:text-indigo-700 transition-colors" />
              </div>
              <div className="mt-1">
                <span className="text-2xl font-extrabold text-indigo-900">
                  {subjectAnalytics.avgAttendance != null && subjectAnalytics.avgAttendance > 0 ? `${subjectAnalytics.avgAttendance}%` : "—"}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-indigo-700/80">Subject attendance rate</p>
              <p className="text-[9px] text-indigo-600/70 font-semibold">Across filtered subjects</p>
              <span className="mt-1 flex items-center gap-1 text-[10px] font-bold text-indigo-700 opacity-80 group-hover:opacity-100 group-hover:underline">
                View details <ChevronRight className="h-2.5 w-2.5" />
              </span>
            </button>
          </div>
        ) : activeSection === "staff" ? (
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
            {/* Card 1: Total Faculty (Replaces Master Class in Staff Analytics) */}
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById("staff-analytics-table-container");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className={cn(
                "rounded-xl border p-3.5 shadow-2xs text-left transition-all duration-200 cursor-pointer group hover:-translate-y-0.5 hover:shadow-md",
                "border-amber-200 bg-amber-50/50 hover:bg-amber-50 hover:border-amber-300",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                  Total Faculty
                </span>
                <Users className="h-3.5 w-3.5 text-amber-500 group-hover:text-amber-700 transition-colors" />
              </div>
              <div className="mt-1">
                <span className="text-2xl font-extrabold text-amber-950">
                  {staffAnalytics.totalStaff}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-amber-800/80 font-medium">Faculty members in scope</p>
              <p className="text-[9px] text-amber-700/70 font-semibold">Filtered by department & class</p>
              <span className="mt-1 flex items-center gap-1 text-[10px] font-bold text-amber-800 opacity-80 group-hover:opacity-100 group-hover:underline">
                View faculty list <ChevronRight className="h-2.5 w-2.5" />
              </span>
            </button>

            {/* Card 2: Master Load */}
            <button
              type="button"
              onClick={() => {
                setActiveKpiDrawer("master");
                setDrawerSearch("");
              }}
              className={cn(
                "rounded-xl border p-3.5 shadow-2xs text-left transition-all duration-200 cursor-pointer group hover:-translate-y-0.5 hover:shadow-md",
                activeKpiDrawer === "master"
                  ? "border-blue-400 bg-blue-100/70 ring-2 ring-blue-400"
                  : "border-blue-100 bg-blue-50/40 hover:bg-blue-50/80 hover:border-blue-200",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                  Master Load
                </span>
                <BookOpen className="h-3.5 w-3.5 text-blue-400 group-hover:text-blue-600 transition-colors" />
              </div>
              <div className="mt-1">
                <span className="text-2xl font-extrabold text-blue-900">
                  {staffAnalytics.totalAssignedLoad}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-blue-700/80">Assigned periods / wk</p>
              <p className="text-[9px] text-blue-600/70 font-semibold">Baseline teaching allocation</p>
              <span className="mt-1 flex items-center gap-1 text-[10px] font-bold text-blue-600 opacity-80 group-hover:opacity-100 group-hover:underline">
                View master plan <ChevronRight className="h-2.5 w-2.5" />
              </span>
            </button>

            {/* Card 3: Classes Conducted */}
            <button
              type="button"
              onClick={() => {
                setActiveKpiDrawer("conducted");
                setDrawerSearch("");
              }}
              className={cn(
                "rounded-xl border p-3.5 shadow-2xs text-left transition-all duration-200 cursor-pointer group hover:-translate-y-0.5 hover:shadow-md",
                activeKpiDrawer === "conducted"
                  ? "border-emerald-400 bg-emerald-100/70 ring-2 ring-emerald-400"
                  : "border-emerald-100 bg-emerald-50/40 hover:bg-emerald-50/80 hover:border-emerald-200",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                  Classes Conducted
                </span>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 group-hover:text-emerald-600 transition-colors" />
              </div>
              <div className="mt-1">
                <span className="text-2xl font-extrabold text-emerald-800">
                  {staffAnalytics.totalConducted}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-emerald-700/80">Sessions held by staff</p>
              <p className="text-[9px] text-emerald-600/70 font-semibold">Verified attendance posted</p>
              <span className="mt-1 flex items-center gap-1 text-[10px] font-bold text-emerald-700 opacity-80 group-hover:opacity-100 group-hover:underline">
                View held classes <ChevronRight className="h-2.5 w-2.5" />
              </span>
            </button>

            {/* Card 4: Relieved (Out) */}
            <button
              type="button"
              onClick={() => {
                setActiveKpiDrawer("substituted");
                setDrawerSearch("");
              }}
              className={cn(
                "rounded-xl border p-3.5 shadow-2xs text-left transition-all duration-200 cursor-pointer group hover:-translate-y-0.5 hover:shadow-md",
                activeKpiDrawer === "substituted"
                  ? "border-rose-400 bg-rose-100/70 ring-2 ring-rose-400"
                  : "border-rose-100 bg-rose-50/40 hover:bg-rose-50/80 hover:border-rose-200",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
                  Relieved (Out)
                </span>
                <AlertTriangle className="h-3.5 w-3.5 text-rose-500 group-hover:text-rose-700 transition-colors" />
              </div>
              <div className="mt-1">
                <span className="text-2xl font-extrabold text-rose-800">
                  {staffAnalytics.totalRelieved}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-rose-700/80">Periods faculty was away</p>
              <p className="text-[9px] text-rose-600/70 font-semibold">Covered by substitute faculty</p>
              <span className="mt-1 flex items-center gap-1 text-[10px] font-bold text-rose-800 opacity-90 group-hover:opacity-100 group-hover:underline">
                View substitutions <ChevronRight className="h-2.5 w-2.5" />
              </span>
            </button>

            {/* Card 5: Substitutes Covered (In) */}
            <button
              type="button"
              onClick={() => {
                setActiveKpiDrawer("substituted");
                setDrawerSearch("");
              }}
              className={cn(
                "rounded-xl border p-3.5 shadow-2xs text-left transition-all duration-200 cursor-pointer group hover:-translate-y-0.5 hover:shadow-md",
                activeKpiDrawer === "substituted"
                  ? "border-sky-400 bg-sky-100/70 ring-2 ring-sky-400"
                  : "border-sky-100 bg-sky-50/40 hover:bg-sky-50/80 hover:border-sky-200",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
                  Substitutes (In)
                </span>
                <UserCheck className="h-3.5 w-3.5 text-sky-500 group-hover:text-sky-700 transition-colors" />
              </div>
              <div className="mt-1">
                <span className="text-2xl font-extrabold text-sky-800">
                  {staffAnalytics.totalSubstituteTaken}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-sky-700/80">Relief duties covered</p>
              <p className="text-[9px] text-sky-600/70 font-semibold">Stepped in for colleagues</p>
              <span className="mt-1 flex items-center gap-1 text-[10px] font-bold text-sky-800 opacity-90 group-hover:opacity-100 group-hover:underline">
                View substitute classes <ChevronRight className="h-2.5 w-2.5" />
              </span>
            </button>

            {/* Card 6: Net Teaching Load */}
            <button
              type="button"
              onClick={() => {
                setActiveKpiDrawer("conducted");
                setDrawerSearch("");
              }}
              className={cn(
                "rounded-xl border p-3.5 shadow-2xs text-left transition-all duration-200 cursor-pointer group hover:-translate-y-0.5 hover:shadow-md",
                activeKpiDrawer === "conducted"
                  ? "border-indigo-400 bg-indigo-100/70 ring-2 ring-indigo-400"
                  : "border-indigo-100 bg-indigo-50/40 hover:bg-indigo-50/80 hover:border-indigo-200",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                  Net Teaching Load
                </span>
                <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500 group-hover:text-indigo-700 transition-colors" />
              </div>
              <div className="mt-1">
                <span className="text-2xl font-extrabold text-indigo-900">
                  {staffAnalytics.totalNetLoad}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-indigo-700/80">{staffAnalytics.activeFacultyCount} active faculty members</p>
              <p className="text-[9px] text-indigo-600/70 font-semibold">Effective lecture load delivery</p>
              <span className="mt-1 flex items-center gap-1 text-[10px] font-bold text-indigo-700 opacity-80 group-hover:opacity-100 group-hover:underline">
                View load breakdown <ChevronRight className="h-2.5 w-2.5" />
              </span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
            {/* Card 1: Master Lectures Assigned */}
            <button
              type="button"
              onClick={() => {
                setActiveKpiDrawer("master");
                setDrawerSearch("");
              }}
              className={cn(
                "rounded-xl border p-3.5 shadow-2xs text-left transition-all duration-200 cursor-pointer group hover:-translate-y-0.5 hover:shadow-md",
                activeKpiDrawer === "master"
                  ? "border-blue-400 bg-blue-100/70 ring-2 ring-blue-400"
                  : "border-blue-100 bg-blue-50/40 hover:bg-blue-50/80 hover:border-blue-200",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                  Master Assigned
                </span>
                <BookOpen className="h-3.5 w-3.5 text-blue-400 group-hover:text-blue-600 transition-colors" />
              </div>
              <div className="mt-1">
                <span className="text-2xl font-extrabold text-blue-900">
                  {selectedSection
                    ? masterScheduledList.length
                    : (dateMode === "today" || (startDate && endDate)
                      ? (data?.summary?.totalMasterPeriodsScheduled ?? masterScheduledList.length)
                      : summary.totalMasterPeriods)}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-blue-700/80">
                {dateMode === "today"
                  ? "Today's master classes"
                  : startDate && endDate
                    ? "Scheduled classes in range"
                    : "Weekly lecture quota"}
              </p>
              <p className="text-[9px] text-blue-600/70 font-semibold">Excl. lunch & normal break · Incl. CRT, Library</p>
              <span className="mt-1 flex items-center gap-1 text-[10px] font-bold text-blue-600 opacity-80 group-hover:opacity-100 group-hover:underline">
                View master schedule <ChevronRight className="h-2.5 w-2.5" />
              </span>
            </button>

            {/* Card 2: Conducted Classes */}
            <button
              type="button"
              onClick={() => {
                setActiveKpiDrawer("conducted");
                setDrawerSearch("");
              }}
              className={cn(
                "rounded-xl border p-3.5 shadow-2xs text-left transition-all duration-200 cursor-pointer group hover:-translate-y-0.5 hover:shadow-md",
                activeKpiDrawer === "conducted"
                  ? "border-emerald-400 bg-emerald-100/70 ring-2 ring-emerald-400"
                  : "border-emerald-100 bg-emerald-50/40 hover:bg-emerald-50/80 hover:border-emerald-200",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                  Classes Conducted
                </span>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 group-hover:text-emerald-600 transition-colors" />
              </div>
              <div className="mt-1">
                <span className="text-2xl font-extrabold text-emerald-800">
                  {summary.totalConductedSessions}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-emerald-700/80">Attended / held</p>
              <span className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-emerald-700 opacity-80 group-hover:opacity-100 group-hover:underline">
                View held classes <ChevronRight className="h-2.5 w-2.5" />
              </span>
            </button>

            {/* Card 3: Classes Changed */}
            <button
              type="button"
              onClick={() => {
                setActiveKpiDrawer("changed");
                setDrawerSearch("");
              }}
              className={cn(
                "rounded-xl border p-3.5 shadow-2xs text-left transition-all duration-200 cursor-pointer group hover:-translate-y-0.5 hover:shadow-md",
                activeKpiDrawer === "changed"
                  ? "border-amber-400 bg-amber-100/70 ring-2 ring-amber-400"
                  : "border-amber-100 bg-amber-50/40 hover:bg-amber-50/80 hover:border-amber-200",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                  Classes Changed
                </span>
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 group-hover:text-amber-700 transition-colors" />
              </div>
              <div className="mt-1">
                <span className="text-2xl font-extrabold text-amber-800">
                  {summary.totalChangesRecorded}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-amber-700/80">Altered from plan</p>
              <span className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-amber-800 opacity-90 group-hover:opacity-100 group-hover:underline">
                View changed subjects <ChevronRight className="h-2.5 w-2.5" />
              </span>
            </button>

            {/* Card 4: Faculty Substitutions */}
            <button
              type="button"
              onClick={() => {
                setActiveKpiDrawer("substituted");
                setDrawerSearch("");
              }}
              className={cn(
                "rounded-xl border p-3.5 shadow-2xs text-left transition-all duration-200 cursor-pointer group hover:-translate-y-0.5 hover:shadow-md",
                activeKpiDrawer === "substituted"
                  ? "border-sky-400 bg-sky-100/70 ring-2 ring-sky-400"
                  : "border-sky-100 bg-sky-50/40 hover:bg-sky-50/80 hover:border-sky-200",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
                  Faculty Substituted
                </span>
                <UserCheck className="h-3.5 w-3.5 text-sky-500 group-hover:text-sky-700 transition-colors" />
              </div>
              <div className="mt-1">
                <span className="text-2xl font-extrabold text-sky-800">
                  {summary.facultySubstitutionsCount}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-sky-700/80">Relievers stepped in</p>
              <span className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-sky-800 opacity-90 group-hover:opacity-100 group-hover:underline">
                Who changed & stepped in <ChevronRight className="h-2.5 w-2.5" />
              </span>
            </button>

            {/* Card 5: Subject Swaps */}
            <button
              type="button"
              onClick={() => {
                setActiveKpiDrawer("swapped");
                setDrawerSearch("");
              }}
              className={cn(
                "rounded-xl border p-3.5 shadow-2xs text-left transition-all duration-200 cursor-pointer group hover:-translate-y-0.5 hover:shadow-md",
                activeKpiDrawer === "swapped"
                  ? "border-purple-400 bg-purple-100/70 ring-2 ring-purple-400"
                  : "border-purple-100 bg-purple-50/40 hover:bg-purple-50/80 hover:border-purple-200",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">
                  Subject Swapped
                </span>
                <ArrowLeftRight className="h-3.5 w-3.5 text-purple-500 group-hover:text-purple-700 transition-colors" />
              </div>
              <div className="mt-1">
                <span className="text-2xl font-extrabold text-purple-800">
                  {summary.subjectSwapsCount}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-purple-700/80">Subject exchange</p>
              <span className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-purple-800 opacity-90 group-hover:opacity-100 group-hover:underline">
                View swapped subjects <ChevronRight className="h-2.5 w-2.5" />
              </span>
            </button>

            {/* Card 6: Change Rate % */}
            <button
              type="button"
              onClick={() => {
                setActiveKpiDrawer("rate");
                setDrawerSearch("");
              }}
              className={cn(
                "rounded-xl border p-3.5 shadow-2xs text-left transition-all duration-200 cursor-pointer group hover:-translate-y-0.5 hover:shadow-md",
                activeKpiDrawer === "rate"
                  ? "border-rose-400 bg-rose-100/70 ring-2 ring-rose-400"
                  : "border-rose-100 bg-rose-50/40 hover:bg-rose-50/80 hover:border-rose-200",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">
                  Change Rate %
                </span>
                <Percent className="h-3.5 w-3.5 text-rose-400 group-hover:text-rose-600 transition-colors" />
              </div>
              <div className="mt-1">
                <span className="text-2xl font-extrabold text-rose-700">
                  {summary.overallChangeRatePct}%
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-rose-700/80">Timetable variance</p>
              <span className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-rose-700 opacity-80 group-hover:opacity-100 group-hover:underline">
                View variance breakdown <ChevronRight className="h-2.5 w-2.5" />
              </span>
            </button>
          </div>
        )}

        {/* 4. Interactive Focus Drill-Down Card for Staff (in Master vs Today Comparison) */}
        {activeSection === "variation" && selectedStaffObj && (
          <div className="rounded-xl border-2 border-amber-300 bg-linear-to-r from-amber-50/70 to-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 pb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-white font-bold">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-navy-950">{selectedStaffObj.facultyName}</h3>
                    <span className="rounded bg-amber-100 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-900">
                      HRMS ID: {selectedStaffObj.hrmsId}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Faculty Teaching & Substitution Analytics
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStaffHrmsId(null)}
                className="rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:text-navy-900 cursor-pointer"
              >
                Clear Staff Filter
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
              <div className="rounded-lg bg-white p-2.5 border border-amber-200 shadow-2xs">
                <span className="text-[10px] font-semibold text-slate-500 uppercase">Master Assigned</span>
                <p className="mt-1 text-lg font-bold text-navy-950">{selectedStaffObj.masterAssignedPeriods} <span className="text-xs font-normal text-slate-500">classes</span></p>
              </div>
              <div className="rounded-lg bg-white p-2.5 border border-emerald-200 shadow-2xs">
                <span className="text-[10px] font-semibold text-emerald-700 uppercase">Classes Conducted</span>
                <p className="mt-1 text-lg font-bold text-emerald-800">{selectedStaffObj.classesConducted} <span className="text-xs font-normal text-slate-500">attended</span></p>
              </div>
              <div className="rounded-lg bg-white p-2.5 border border-rose-200 shadow-2xs">
                <span className="text-[10px] font-semibold text-rose-700 uppercase">Relieved (Substituted Out)</span>
                <p className="mt-1 text-lg font-bold text-rose-700">{selectedStaffObj.relievedCount} <span className="text-xs font-normal text-slate-500">classes</span></p>
              </div>
              <div className="rounded-lg bg-white p-2.5 border border-sky-200 shadow-2xs">
                <span className="text-[10px] font-semibold text-sky-700 uppercase">Substitutions Taken (In)</span>
                <p className="mt-1 text-lg font-bold text-sky-800">{selectedStaffObj.substituteTakenCount} <span className="text-xs font-normal text-slate-500">classes</span></p>
              </div>
              <div className="rounded-lg bg-white p-2.5 border border-indigo-200 shadow-2xs">
                <span className="text-[10px] font-semibold text-indigo-700 uppercase">Net Teaching Load</span>
                <p className="mt-1 text-lg font-bold text-indigo-900">{selectedStaffObj.netTeachingCount} <span className="text-xs font-normal text-slate-500">total</span></p>
              </div>
            </div>

            {selectedStaffObj.subjects && selectedStaffObj.subjects.length > 0 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="font-semibold text-slate-600">Subjects:</span>
                {selectedStaffObj.subjects.map((sub, i) => (
                  <span key={i} className="rounded bg-amber-100/90 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                    {sub}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 5. Interactive Focus Drill-Down Card for Subject (in Master vs Today Comparison) */}
        {activeSection === "variation" && selectedSubjectObj && (
          <div className="rounded-xl border-2 border-emerald-300 bg-linear-to-r from-emerald-50/70 to-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200 pb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-navy-950">{selectedSubjectObj.subjectName}</h3>
                    <span className="rounded bg-emerald-100 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-900">
                      Code: {selectedSubjectObj.subjectCode}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Subject Allotment & Timetable Alteration Report
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSubjectCode(null)}
                className="rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:text-navy-900 cursor-pointer"
              >
                Clear Subject Filter
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <div className="rounded-lg bg-white p-2.5 border border-emerald-200 shadow-2xs">
                <span className="text-[10px] font-semibold text-slate-500 uppercase">Master Quota</span>
                <p className="mt-1 text-lg font-bold text-navy-950">{selectedSubjectObj.masterWeeklyPeriods} <span className="text-xs font-normal text-slate-500">periods/wk</span></p>
              </div>
              <div className="rounded-lg bg-white p-2.5 border border-emerald-200 shadow-2xs">
                <span className="text-[10px] font-semibold text-emerald-700 uppercase">Classes Conducted</span>
                <p className="mt-1 text-lg font-bold text-emerald-800">{selectedSubjectObj.totalConducted} <span className="text-xs font-normal text-slate-500">attended</span></p>
              </div>
              <div className="rounded-lg bg-white p-2.5 border border-amber-200 shadow-2xs">
                <span className="text-[10px] font-semibold text-amber-700 uppercase">Times Changed</span>
                <p className="mt-1 text-lg font-bold text-amber-800">
                  {selectedSubjectObj.timesChanged}{" "}
                  <span className="text-[11px] font-normal text-slate-500">
                    ({selectedSubjectObj.timesSwappedOut} out / {selectedSubjectObj.timesSwappedIn} in)
                  </span>
                </p>
              </div>
              <div className="rounded-lg bg-white p-2.5 border border-indigo-200 shadow-2xs">
                <span className="text-[10px] font-semibold text-indigo-700 uppercase">Attendance %</span>
                <p className="mt-1 text-lg font-bold text-indigo-900">{selectedSubjectObj.attendancePct}%</p>
              </div>
            </div>

            {/* Assigned Faculty & Changed Faculty breakdown */}
            {(() => {
              const assigned = Array.from(subjectAssignedFacultyMap.get(selectedSubjectObj.subjectCode) ?? (selectedSubjectObj.facultyNames ?? []));
              const changed = Array.from(subjectChangedFacultyMap.get(selectedSubjectObj.subjectCode)?.values() ?? []);
              return (
                <div className="mt-2.5 pt-2 border-t border-emerald-100 space-y-1.5 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-slate-700">Assigned Faculty (Master):</span>
                    {assigned.length > 0 ? (
                      assigned.map((name, i) => (
                        <span key={i} className="rounded bg-emerald-100/90 px-2 py-0.5 text-[11px] font-medium text-emerald-900">
                          {name}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 italic">Not Assigned</span>
                    )}
                  </div>
                  {changed.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-bold text-amber-900">Changed / Substitute Faculty:</span>
                      {changed.map((cf, i) => (
                        <span key={i} className="inline-flex items-center gap-1 rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                          {cf.facultyName}
                          {cf.originalFacultyName && cf.originalFacultyName !== cf.facultyName && (
                            <span className="text-[10px] font-normal text-amber-700">(sub for {cf.originalFacultyName})</span>
                          )}
                          {cf.count > 1 && (
                            <span className="rounded-full bg-amber-200 px-1 text-[9px] font-bold text-amber-900">×{cf.count}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* 6. Section Comparison Header & Color Legend */}
        {activeSection === "variation" && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-navy-900">
              Master vs Today Timetable Comparison
            </h4>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
              {comparisonsBySection.length} Cohort{comparisonsBySection.length !== 1 ? "s" : ""} / Section{comparisonsBySection.length !== 1 ? "s" : ""}
            </span>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200">
              {filteredComparisons.length} Total Sessions
            </span>
          </div>

          {/* Color Legend */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
              As Master (Unchanged)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
              Faculty Substitute
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-500"></span>
              Subject Swapped
            </span>
          </div>
        </div>

        {/* 7. Printable Section Comparison Tables Container (Exclusively matching Image 1 for PDF export) */}
        <div ref={printAreaRef} className="space-y-4">

            {filteredComparisons.length === 0 ? (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-500 shadow-xs">
                No timetable sessions match the selected filters.
              </div>
            ) : (
              comparisonsBySection.map((secGroup) => (
                <div
                  key={secGroup.sectionKey}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs"
                >
                  {/* Distinct Section Header Banner */}
                  <div className="border-b border-slate-200 bg-linear-to-r from-slate-50 via-sky-50/20 to-slate-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-900 text-white font-extrabold text-xs shadow-2xs">
                        {secGroup.sectionLetter === "Unassigned" ? "ALL" : secGroup.sectionLetter}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-navy-950">
                            {secGroup.sectionTitle}
                          </h4>
                          <span className="rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                            {secGroup.branchCode}
                          </span>
                          <span className="rounded bg-slate-200/80 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                            Batch {secGroup.batch}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {secGroup.totalClasses} scheduled periods · Period sequence in order
                        </p>
                      </div>
                    </div>

                    {/* Section Quick Summary Stats */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      {secGroup.secEnrolled > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-300">
                          🎓 {secGroup.secEnrolled} Enrolled
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                        {secGroup.conductedCount} / {secGroup.totalClasses} Conducted
                      </span>
                      {secGroup.substitutedCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                          {secGroup.substitutedCount} Substituted
                        </span>
                      )}
                      {secGroup.swappedCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-800 border border-sky-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-sky-500"></span>
                          {secGroup.swappedCount} Swapped
                        </span>
                      )}
                      {secGroup.substitutedCount === 0 && secGroup.swappedCount === 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                          100% As Master
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Table of periods for this Section */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-100/70 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                          <th className="py-2.5 px-3">Slot & Time</th>
                          <th className="py-2.5 px-2">Date & Day</th>
                          <th className="py-2.5 px-2">Branch / Section</th>
                          <th className="py-2.5 px-3">Master Timetable (Assigned)</th>
                          <th className="py-2.5 px-3">Today Timetable (Conducted)</th>
                          <th className="py-2.5 px-2 text-center">Variation Status</th>
                          <th className="py-2.5 px-3">Variance Note</th>
                          <th className="py-2.5 px-3 text-center">Attendance %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {secGroup.items.map((c) => {
                          const isUnchanged = c.varianceType === "UNCHANGED";
                          const isSubstitute = c.varianceType === "FACULTY_SUBSTITUTE" || c.varianceType === "BOTH";
                          const isSwap = c.varianceType === "SUBJECT_SWAP" || c.varianceType === "BOTH";

                          return (
                            <tr
                              key={c.id}
                              className={cn(
                                "hover:bg-slate-50/80 transition-colors",
                                !isUnchanged ? "bg-amber-50/20" : "",
                              )}
                            >
                              {/* Slot & Time */}
                              <td className="py-3 px-3 font-mono font-bold text-navy-950">
                                {c.slotLabel}
                                <p className="font-normal text-[10px] text-slate-500">{c.time}</p>
                              </td>

                              {/* Date & Day */}
                              <td className="py-3 px-2">
                                <span className="font-semibold text-slate-800">{c.date}</span>
                                <p className="text-[10px] text-slate-400 font-bold uppercase">{c.dayOfWeek}</p>
                              </td>

                              {/* Branch & Section */}
                              <td className="py-3 px-2">
                                <div className="flex flex-wrap items-center gap-1">
                                  <span className="rounded bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                                    {getBranchBadge(c.branchId, c.branchCode)}
                                  </span>
                                  <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 border border-sky-200">
                                    Sec {cleanSectionCode(c.sectionName) || "A"}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-0.5">Batch {c.batch}</p>
                              </td>

                              {/* Master Schedule (Assigned) */}
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="font-bold text-navy-900">
                                    {c.masterSubjectName || c.masterSubjectCode || <span className="text-slate-400">Not Assigned</span>}
                                  </p>
                                  {(c.masterSubjectName?.toUpperCase() === "CRT" || c.masterSubjectCode?.toUpperCase() === "CRT") && (
                                    <span className="rounded bg-purple-100 text-purple-800 text-[9px] font-extrabold px-1.5 py-0.5 border border-purple-200">
                                      CRT
                                    </span>
                                  )}
                                  {(c.masterSubjectName?.toUpperCase() === "LIBRARY" || c.masterSubjectCode?.toUpperCase() === "LIBRARY") && (
                                    <span className="rounded bg-teal-100 text-teal-800 text-[9px] font-extrabold px-1.5 py-0.5 border border-teal-200">
                                      Library
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-500 mt-0.5">
                                  Faculty: <span className="font-medium text-slate-700">{c.masterFacultyName || "None"}</span>
                                </p>
                              </td>

                              {/* Today's Schedule (Actual) */}
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p
                                    className={cn(
                                      "font-bold",
                                      isSwap ? "text-amber-800 underline decoration-amber-400" : "text-navy-900",
                                    )}
                                  >
                                    {c.todaySubjectName || c.todaySubjectCode || c.masterSubjectName}
                                  </p>
                                  {(c.todaySubjectName?.toUpperCase() === "CRT" || c.todaySubjectCode?.toUpperCase() === "CRT") && (
                                    <span className="rounded bg-purple-100 text-purple-800 text-[9px] font-extrabold px-1.5 py-0.5 border border-purple-200">
                                      CRT
                                    </span>
                                  )}
                                  {(c.todaySubjectName?.toUpperCase() === "LIBRARY" || c.todaySubjectCode?.toUpperCase() === "LIBRARY") && (
                                    <span className="rounded bg-teal-100 text-teal-800 text-[9px] font-extrabold px-1.5 py-0.5 border border-teal-200">
                                      Library
                                    </span>
                                  )}
                                </div>
                                <p
                                  className={cn(
                                    "text-[10px] mt-0.5",
                                    isSubstitute ? "text-sky-800 font-bold" : "text-slate-500",
                                  )}
                                >
                                  Faculty: <span className="font-medium">{c.todayFacultyName || c.masterFacultyName}</span>
                                </p>
                              </td>

                              {/* Variation Status */}
                              <td className="py-3 px-2 text-center">
                                {isUnchanged && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                    As Master
                                  </span>
                                )}
                                {c.varianceType === "FACULTY_SUBSTITUTE" && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-300">
                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                                    Substitute
                                  </span>
                                )}
                                {c.varianceType === "SUBJECT_SWAP" && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-[10px] font-bold text-sky-800 border border-sky-300">
                                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500"></span>
                                    Swapped
                                  </span>
                                )}
                                {c.varianceType === "BOTH" && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-[10px] font-bold text-purple-800 border border-purple-300">
                                    <span className="h-1.5 w-1.5 rounded-full bg-purple-500"></span>
                                    Sub + Swap
                                  </span>
                                )}
                              </td>

                              {/* Variance Details */}
                              <td className="py-3 px-3 text-slate-600 text-[11px]">
                                {isSubstitute ? (
                                  <span className="text-amber-900 font-medium">
                                    {c.masterFacultyName?.split(" ")[0]} relieved → {c.todayFacultyName?.split(" ")[0]} covered
                                  </span>
                                ) : isSwap ? (
                                  <span className="text-sky-900 font-medium">
                                    Subject changed to {c.todaySubjectCode}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic">Held as planned</span>
                                )}
                              </td>

                              {/* Attendance */}
                              <td className="py-3 px-3 text-center">
                                {c.isConducted && c.attendancePct != null ? (
                                  <span
                                    className={cn(
                                      "inline-block rounded-md px-2 py-0.5 text-xs font-bold",
                                      c.attendancePct >= 75
                                        ? "bg-emerald-100 text-emerald-800"
                                        : c.attendancePct >= 50
                                          ? "bg-amber-100 text-amber-800"
                                          : "bg-rose-100 text-rose-800",
                                    )}
                                  >
                                    {c.attendancePct}%
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-slate-400 font-medium">Scheduled</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* 7. SUBJECT ANALYTICS REPORT */}
      {activeSection === "subjects" && (
        <div id="subject-analytics-table-container" ref={printAreaRef} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-navy-900">
                Subject Delivery & Alteration Analytics
              </h4>
              <p className="text-[11px] text-slate-500">
                Class, section & subject-wise quota, conduction, faculty substitutions and attendance
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {/* View Switcher: Class & Sec Wise (Default) vs Consolidated */}
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setSubjectViewMode("section-wise")}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
                    subjectViewMode === "section-wise"
                      ? "bg-white text-emerald-800 shadow-2xs font-bold"
                      : "text-slate-600 hover:text-slate-900",
                  )}
                >
                  Class & Sec Wise
                </button>
                <button
                  type="button"
                  onClick={() => setSubjectViewMode("consolidated")}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
                    subjectViewMode === "consolidated"
                      ? "bg-white text-emerald-800 shadow-2xs font-bold"
                      : "text-slate-600 hover:text-slate-900",
                  )}
                >
                  Consolidated
                </button>
              </div>

              <span className="text-xs font-semibold text-slate-600">
                {subjectViewMode === "section-wise"
                  ? `${comparisonsBySection.length} Cohort${comparisonsBySection.length !== 1 ? "s" : ""} / Section${comparisonsBySection.length !== 1 ? "s" : ""}`
                  : `${filteredSubjects.length} Subject${filteredSubjects.length !== 1 ? "s" : ""}`}
              </span>
            </div>
          </div>

          {/* Interactive In-Page Subject Focus Drill-Down Card */}
          {selectedSubjectObj && (
            <div className="rounded-xl border-2 border-emerald-400 bg-linear-to-r from-emerald-50/90 via-emerald-50/40 to-white p-4 shadow-sm animate-in fade-in">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold shadow-xs">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-extrabold text-navy-950">{selectedSubjectObj.subjectName}</h3>
                      <span className="rounded-md bg-emerald-100 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-900 border border-emerald-200">
                        Code: {selectedSubjectObj.subjectCode}
                      </span>
                      <span className="rounded-full bg-emerald-600 text-white px-2 py-0.5 text-[10px] font-bold">
                        Direct Page Focus
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Subject Delivery, Timetable Allotment & Alteration Breakdown
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void exportSubjectExcel(selectedSubjectObj)}
                    disabled={generatingExcelKey === selectedSubjectObj.subjectCode}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                    title={`Export ${selectedSubjectObj.subjectName}'s verified delivery report to Excel`}
                  >
                    {generatingExcelKey === selectedSubjectObj.subjectCode ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-700" />
                    ) : (
                      <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" />
                    )}
                    <span>Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void printSubjectPdf(selectedSubjectObj)}
                    disabled={generatingPdfKey === selectedSubjectObj.subjectCode}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-2.5 py-1.5 text-xs font-bold text-rose-800 hover:bg-rose-50 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                    title={`Download official verified PDF for ${selectedSubjectObj.subjectName}`}
                  >
                    {generatingPdfKey === selectedSubjectObj.subjectCode ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-700" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 text-rose-700" />
                    )}
                    <span>PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSubjectCode(null)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-navy-900 transition-colors shadow-2xs cursor-pointer"
                  >
                    ✕ Clear Subject Focus
                  </button>
                </div>
              </div>

              {/* Metric Highlights for this Subject */}
              <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <div className="rounded-lg bg-white p-3 border border-emerald-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Master Quota</span>
                  <p className="mt-1 text-xl font-extrabold text-navy-950">
                    {selectedSubjectObj.masterWeeklyPeriods}{" "}
                    <span className="text-xs font-normal text-slate-500">periods/wk</span>
                  </p>
                </div>
                <div className="rounded-lg bg-white p-3 border border-emerald-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Classes Conducted</span>
                  <p className="mt-1 text-xl font-extrabold text-emerald-800">
                    {selectedSubjectObj.totalConducted}{" "}
                    <span className="text-xs font-normal text-slate-500">attended</span>
                  </p>
                </div>
                <div className="rounded-lg bg-white p-3 border border-amber-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Times Altered</span>
                  <p className="mt-1 text-xl font-extrabold text-amber-800">
                    {selectedSubjectObj.timesChanged}{" "}
                    <span className="text-xs font-normal text-slate-500">
                      ({selectedSubjectObj.timesSwappedOut} out / {selectedSubjectObj.timesSwappedIn} in)
                    </span>
                  </p>
                </div>
                <div className="rounded-lg bg-white p-3 border border-indigo-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Attendance %</span>
                  <p className="mt-1 text-xl font-extrabold text-indigo-900">
                    {selectedSubjectObj.attendancePct > 0 ? `${selectedSubjectObj.attendancePct}%` : "—"}
                  </p>
                </div>
              </div>

              {/* Assigned Faculty & Changed Faculty breakdown */}
              {(() => {
                const assigned = Array.from(subjectAssignedFacultyMap.get(selectedSubjectObj.subjectCode) ?? (selectedSubjectObj.facultyNames ?? []));
                const changed = Array.from(subjectChangedFacultyMap.get(selectedSubjectObj.subjectCode)?.values() ?? []);
                return (
                  <div className="mt-3 pt-2.5 border-t border-emerald-100 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-bold text-slate-700">Assigned Faculty (Master Timetable):</span>
                      {assigned.length > 0 ? (
                        assigned.map((name, i) => (
                          <span
                            key={i}
                            className="rounded-md bg-white border border-emerald-200 px-2 py-0.5 text-xs font-semibold text-emerald-900 shadow-2xs"
                          >
                            {name}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400 italic">Not Assigned</span>
                      )}
                    </div>
                    {changed.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-amber-900">Changed / Substitute Faculty:</span>
                        {changed.map((cf, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-bold text-amber-800 shadow-2xs"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                            {cf.facultyName}
                            {cf.originalFacultyName && cf.originalFacultyName !== cf.facultyName && (
                              <span className="text-[11px] font-normal text-amber-700">
                                (sub for {cf.originalFacultyName})
                              </span>
                            )}
                            {cf.count > 1 && (
                              <span className="rounded-full bg-amber-200 px-1.5 text-[10px] font-bold text-amber-900">
                                {cf.count} sessions
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <span className="font-bold text-slate-700">Changed Faculty:</span>
                        <span className="text-emerald-700 font-medium">None (100% Conducted by Assigned Master Faculty)</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Drill-down Timetable Sessions Table for this Subject */}
              <div className="mt-3.5 pt-3 border-t border-emerald-200">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-xs font-bold text-navy-950 uppercase tracking-wider">
                    Timetable Sessions & Delivery Records for {selectedSubjectObj.subjectCode}
                  </h5>
                  <span className="text-[11px] font-semibold text-slate-600">
                    {subjectSessions.length} Session{subjectSessions.length !== 1 ? "s" : ""} recorded
                  </span>
                </div>

                {subjectSessions.length === 0 ? (
                  <div className="rounded-lg bg-white p-4 text-center text-xs text-slate-500 border border-slate-200">
                    No scheduled comparison sessions found for {selectedSubjectObj.subjectName} in the current date filter.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase text-slate-600">
                          <th className="py-2 px-3">Date & Slot</th>
                          <th className="py-2 px-3">Section / Batch</th>
                          <th className="py-2 px-3">Assigned Faculty</th>
                          <th className="py-2 px-3">Actual / Substitute Faculty</th>
                          <th className="py-2 px-2 text-center">Status</th>
                          <th className="py-2 px-2 text-center">Attendance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {subjectSessions.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3">
                              <span className="font-semibold text-slate-800">{s.date}</span>
                              <span className="text-[10px] text-slate-500 block">{s.slotLabel} ({s.time})</span>
                            </td>
                            <td className="py-2 px-3">
                              <span className="font-medium text-slate-700">
                                {formatSessionClassInfo(s, false)}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              {s.masterFacultyName || "—"}
                            </td>
                            <td className="py-2 px-3">
                              {s.todayFacultyName && s.todayFacultyName !== s.masterFacultyName ? (
                                <span className="font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[11px]">
                                  {s.todayFacultyName} (Substitute)
                                </span>
                              ) : (
                                <span className="text-slate-600">{s.todayFacultyName || s.masterFacultyName || "—"}</span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-center">
                              {s.isConducted ? (
                                <span className="rounded bg-emerald-100 text-emerald-800 px-1.5 py-0.5 text-[10px] font-bold">
                                  Conducted
                                </span>
                              ) : (
                                <span className="rounded bg-slate-100 text-slate-600 px-1.5 py-0.5 text-[10px] font-medium">
                                  Scheduled
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-center font-bold text-slate-700">
                              {s.attendancePct != null ? `${s.attendancePct}%` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {subjectViewMode === "section-wise" ? (
            <div className="space-y-4">
              {comparisonsBySection.length === 0 ? (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-500 shadow-xs">
                  No timetable sessions or classes match the selected filters.
                </div>
              ) : (
                comparisonsBySection.map((secGroup) => {
                  const q = searchQuery.trim().toLowerCase();
                  const secSubjects = secGroup.cohortSubjects.filter((s) => {
                    if (!q) return true;
                    return (
                      s.subjectName.toLowerCase().includes(q) ||
                      s.subjectCode.toLowerCase().includes(q) ||
                      s.assignedFaculty.some((f) => f.toLowerCase().includes(q)) ||
                      s.changedFaculty.some((cf) => cf.facultyName.toLowerCase().includes(q))
                    );
                  });

                  if (q && secSubjects.length === 0) {
                    return null;
                  }

                  const secAvgAttendance = (() => {
                    const withAtt = secSubjects.filter((s) => s.totalConducted > 0 && s.effectiveAttendancePct != null && s.effectiveAttendancePct > 0);
                    if (withAtt.length === 0) return null;
                    return Math.round(
                      withAtt.reduce((acc, s) => acc + (s.effectiveAttendancePct ?? 0), 0) / withAtt.length,
                    );
                  })();

                  const secTotalChanges = secSubjects.reduce((acc, s) => acc + s.timesChanged, 0);
                  const secTotalConducted = secSubjects.reduce((acc, s) => acc + s.totalConducted, 0);
                  const secEnrolled = secGroup.secEnrolled || 0;

                  return (
                    <div
                      key={secGroup.sectionKey}
                      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs"
                    >
                      {/* Distinct Section Header Banner */}
                      <div className="border-b border-slate-200 bg-linear-to-r from-slate-50 via-emerald-50/20 to-slate-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-700 text-white font-black text-sm shadow-2xs">
                            {secGroup.sectionLetter !== "Unassigned" ? secGroup.sectionLetter : "S"}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-navy-950">
                                {secGroup.sectionTitle}
                              </h4>
                              <span className="rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                                {secGroup.branchCode}
                              </span>
                              <span className="rounded bg-slate-200/80 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                                Batch {secGroup.batch}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              {secSubjects.length} subjects registered · {secTotalConducted} classes conducted in period
                            </p>
                          </div>
                        </div>

                        {/* Section Summary Badges */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                            {secTotalConducted} Conducted
                          </span>
                          {secEnrolled > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">
                              {secEnrolled} Enrolled
                            </span>
                          )}
                          {secTotalChanges > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                              {secTotalChanges} Alterations
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                              As Assigned
                            </span>
                          )}
                          {secAvgAttendance != null ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-800 border border-indigo-200">
                              {secAvgAttendance}% Avg Attendance
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                              Attendance Pending
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Subjects Table for this Section */}
                      <div className="overflow-x-auto">
                        {secSubjects.length === 0 ? (
                          <div className="p-6 text-center text-xs text-slate-400">
                            No subjects recorded for this class & section in the selected timeframe.
                          </div>
                        ) : (
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-100/80 text-[10px] font-bold uppercase tracking-wider text-slate-800">
                                <th className="py-2.5 px-3">Subject Name & Code</th>
                                <th className="py-2.5 px-2 text-center">Master Quota</th>
                                <th className="py-2.5 px-2 text-center">Conducted</th>
                                <th className="py-2.5 px-3">Assigned Faculty</th>
                                <th className="py-2.5 px-3">Conducted Faculty</th>
                                <th className="py-2.5 px-2 text-center">Enrolled</th>
                                <th className="py-2.5 px-2 text-center">Present</th>
                                <th className="py-2.5 px-2 text-center">Absent</th>
                                <th className="py-2.5 px-2 text-center">Attendance %</th>
                                <th className="py-2.5 px-3 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {secSubjects.map((sub) => {
                                const isSelected = activeSubjectModal?.subjectCode === sub.subjectCode;

                                return (
                                  <tr
                                    key={sub.subjectCode}
                                    onClick={() => {
                                      openSubjectModal(sub, {
                                        cohortTitle: secGroup.sectionTitle,
                                        branchCode: secGroup.branchCode,
                                        batch: secGroup.batch,
                                        sectionLetter: secGroup.sectionLetter,
                                      });
                                    }}
                                    className={cn(
                                      "cursor-pointer hover:bg-slate-50/90 transition-colors group",
                                      isSelected
                                        ? "bg-emerald-50/70 border-l-4 border-l-emerald-600 font-medium"
                                        : "",
                                    )}
                                  >
                                    {/* 1. Subject Name & Code */}
                                    <td className="py-3 px-3">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <p className="font-bold text-navy-900 group-hover:text-emerald-800 transition-colors">
                                          {sub.subjectName}
                                        </p>
                                        {isSelected && (
                                          <span className="rounded bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.2 shadow-2xs">
                                            Viewing ✓
                                          </span>
                                        )}
                                      </div>
                                      <span className="font-mono text-[10px] text-slate-400 block mt-0.5">
                                        {sub.subjectCode}
                                      </span>
                                    </td>

                                    {/* 2. Master Quota */}
                                    <td className="py-3 px-2 text-center font-semibold text-slate-800">
                                      {sub.masterWeeklyPeriods > 0 ? sub.masterWeeklyPeriods : (sub.totalScheduled || "—")}
                                    </td>

                                    {/* 3. Conducted */}
                                    <td className="py-3 px-2 text-center font-bold text-emerald-700">
                                      {sub.totalConducted}
                                    </td>

                                    {/* 4. Assigned Faculty */}
                                    <td className="py-3 px-3 text-slate-600">
                                      {sub.assignedFaculty.length === 0 ? (
                                        <span className="text-slate-400 text-[11px] italic">Not Assigned</span>
                                      ) : (
                                        <div className="flex flex-wrap gap-1 max-w-xs">
                                          {sub.assignedFaculty.map((name, i) => (
                                            <button
                                              key={i}
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openStaffModalByName(name);
                                              }}
                                              className="rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-800 transition-colors cursor-pointer"
                                              title={`Click to view ${name}'s details & action log`}
                                            >
                                              {name}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </td>

                                    {/* 5. Conducted Faculty (Shows actual name, never '100% Fidelity') */}
                                    <td className="py-3 px-3">
                                      {sub.changedFaculty.length === 0 ? (
                                        sub.assignedFaculty.length === 0 ? (
                                          <span className="text-slate-400 text-[11px] italic">Not Assigned</span>
                                        ) : (
                                          <div className="flex flex-wrap gap-1 max-w-xs">
                                            {sub.assignedFaculty.map((name, i) => (
                                              <span
                                                key={i}
                                                className="inline-flex items-center gap-1 rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-800"
                                              >
                                                {name}
                                                <span className="text-[9px] text-slate-500 font-normal">(As Master)</span>
                                              </span>
                                            ))}
                                          </div>
                                        )
                                      ) : (
                                        <div className="flex flex-wrap gap-1 max-w-xs">
                                          {sub.changedFaculty.map((cf, idx) => (
                                            <button
                                              key={idx}
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openStaffModalByName(cf.facultyName);
                                              }}
                                              className="inline-flex items-center gap-1 rounded bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-800 shadow-2xs transition-colors cursor-pointer"
                                              title={
                                                cf.originalFacultyName
                                                  ? `Substituted for ${cf.originalFacultyName} (${cf.count} session${cf.count !== 1 ? "s" : ""}) - Click to view ${cf.facultyName}'s action log`
                                                  : `Substitute faculty (${cf.count} session${cf.count !== 1 ? "s" : ""}) - Click to view ${cf.facultyName}'s action log`
                                              }
                                            >
                                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                                              {cf.facultyName}
                                              {cf.originalFacultyName && cf.originalFacultyName !== cf.facultyName && (
                                                <span className="text-[10px] font-normal text-amber-700">
                                                  (sub for {cf.originalFacultyName})
                                                </span>
                                              )}
                                              {cf.count > 1 && (
                                                <span className="rounded-full bg-amber-200 px-1 text-[9px] font-bold text-amber-900">
                                                  ×{cf.count}
                                                </span>
                                              )}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </td>

                                    {/* 6. Enrolled Students */}
                                    <td className="py-3 px-2 text-center font-semibold text-slate-800">
                                      {secEnrolled > 0 ? secEnrolled : "—"}
                                    </td>

                                    {/* 7. Students Present */}
                                    <td className="py-3 px-2 text-center font-bold text-emerald-700">
                                      {sub.totalConducted > 0 ? (sub.totalPresent || 0) : "—"}
                                    </td>

                                    {/* 8. Students Absent */}
                                    <td className="py-3 px-2 text-center font-bold text-rose-600">
                                      {sub.totalConducted > 0
                                        ? ((sub.totalMarked || 0) > 0
                                            ? Math.max(0, (sub.totalMarked || 0) - (sub.totalPresent || 0))
                                            : Math.max(0, secEnrolled - (sub.totalPresent || 0)))
                                        : "—"}
                                    </td>

                                    {/* 9. Attendance % */}
                                    <td className="py-3 px-2 text-center">
                                      <div className="flex flex-col items-center justify-center">
                                        {sub.effectiveAttendancePct != null && sub.effectiveAttendancePct > 0 ? (
                                          <span
                                            className={cn(
                                              "inline-block rounded-md px-2 py-0.5 text-xs font-bold shadow-2xs",
                                              sub.effectiveAttendancePct >= 75
                                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                                : sub.effectiveAttendancePct >= 50
                                                  ? "bg-amber-100 text-amber-800 border border-amber-200"
                                                  : "bg-rose-100 text-rose-800 border border-rose-200",
                                            )}
                                          >
                                            {sub.effectiveAttendancePct}%
                                          </span>
                                        ) : sub.totalConducted > 0 && sub.turnoutPct != null ? (
                                          <span className="inline-block rounded-md px-2 py-0.5 text-xs font-bold bg-slate-100 text-slate-700">
                                            {sub.turnoutPct}%
                                          </span>
                                        ) : (
                                          <span className="text-slate-400 font-medium text-xs">—</span>
                                        )}

                                        {/* Explanatory subtext for accurate date range context */}
                                        {sub.totalScheduled > sub.totalConducted && sub.totalConducted > 0 && (
                                          <span className="text-[10px] text-slate-500 font-medium mt-0.5">
                                            {sub.totalConducted}/{sub.totalScheduled} held
                                            {sub.turnoutPct != null && ` (${sub.turnoutPct}% turnout)`}
                                          </span>
                                        )}
                                        {sub.totalScheduled <= sub.totalConducted && sub.totalConducted > 0 && sub.turnoutPct != null && (
                                          <span className="text-[10px] text-slate-500 font-medium mt-0.5">
                                            {sub.turnoutPct}% turnout
                                          </span>
                                        )}
                                        {sub.totalConducted === 0 && sub.totalScheduled > 0 && (
                                          <span className="text-[10px] text-slate-400 mt-0.5">
                                            0/{sub.totalScheduled} held
                                          </span>
                                        )}
                                      </div>
                                    </td>

                                    {/* 10. Action Buttons */}
                                    <td className="py-3 px-3 text-right">
                                      <div className="inline-flex items-center justify-end gap-1.5 flex-nowrap">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            void exportSubjectExcel(sub);
                                          }}
                                          disabled={generatingExcelKey === sub.subjectCode}
                                          className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[10px] px-2 py-1 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                                          title={`Export ${sub.subjectName}'s verified delivery report to Excel`}
                                        >
                                          {generatingExcelKey === sub.subjectCode ? (
                                            <Loader2 className="h-3 w-3 animate-spin text-emerald-700" />
                                          ) : (
                                            <FileSpreadsheet className="h-3 w-3 text-emerald-700" />
                                          )}
                                          <span className="hidden xl:inline">Excel</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            void printSubjectPdf(sub);
                                          }}
                                          disabled={generatingPdfKey === sub.subjectCode}
                                          className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-[10px] px-2 py-1 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                                          title={`Download official verified PDF for ${sub.subjectName}`}
                                        >
                                          {generatingPdfKey === sub.subjectCode ? (
                                            <Loader2 className="h-3 w-3 animate-spin text-rose-700" />
                                          ) : (
                                            <FileText className="h-3 w-3 text-rose-700" />
                                          )}
                                          <span className="hidden xl:inline">PDF</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openSubjectModal(sub, {
                                              cohortTitle: secGroup.sectionTitle,
                                              branchCode: secGroup.branchCode,
                                              batch: secGroup.batch,
                                              sectionLetter: secGroup.sectionLetter,
                                            });
                                          }}
                                          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[10px] px-2 py-1 shadow-xs transition-colors cursor-pointer"
                                          title="View subject details, faculty allotment & action history"
                                        >
                                          <Eye className="h-3 w-3" />
                                          <span>View</span>
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* Consolidated Subjects Table */
            <div className="overflow-x-auto">
              {filteredSubjects.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No subject records match the selected filters.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100/80 text-[10px] font-bold uppercase tracking-wider text-slate-800">
                      <th className="py-2.5 px-3">Subject Name & Code</th>
                      <th className="py-2.5 px-2 text-center">Master Quota</th>
                      <th className="py-2.5 px-2 text-center">Conducted</th>
                      <th className="py-2.5 px-3">Assigned Faculty</th>
                      <th className="py-2.5 px-3">Conducted Faculty</th>
                      <th className="py-2.5 px-2 text-center">Enrolled</th>
                      <th className="py-2.5 px-2 text-center">Present</th>
                      <th className="py-2.5 px-2 text-center">Absent</th>
                      <th className="py-2.5 px-2 text-center">Attendance %</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSubjects.map((sub) => {
                      const assigned = Array.from(subjectAssignedFacultyMap.get(sub.subjectCode) ?? (sub.facultyNames ?? []));
                      const changedList = Array.from(subjectChangedFacultyMap.get(sub.subjectCode)?.values() ?? []);
                      const isSelected = activeSubjectModal?.subjectCode === sub.subjectCode;

                      // Accurate date range attendance:
                      const turnout = sub.turnoutPct ?? sub.attendancePct ?? 100;
                      const scheduled = sub.totalScheduled || sub.totalConducted || 0;
                      const effectivePct =
                        sub.totalConducted > 0 && scheduled > 0
                          ? (dateMode === "range" && scheduled > sub.totalConducted
                              ? Math.round((sub.totalConducted / scheduled) * turnout)
                              : sub.attendancePct)
                          : (sub.totalConducted > 0 ? sub.attendancePct : 0);

                      return (
                        <tr
                          key={sub.subjectCode}
                          onClick={() => {
                            openSubjectModal(sub);
                          }}
                          className={cn(
                            "cursor-pointer hover:bg-slate-50/90 transition-colors group",
                            isSelected ? "bg-emerald-50/70 border-l-4 border-l-emerald-600 font-medium" : "",
                          )}
                        >
                          {/* 1. Subject Name & Code */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-bold text-navy-900 group-hover:text-emerald-800 transition-colors">
                                {sub.subjectName}
                              </p>
                              {isSelected && (
                                <span className="rounded bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.2 shadow-2xs">
                                  Viewing ✓
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-[10px] text-slate-400 block mt-0.5">{sub.subjectCode}</span>
                          </td>

                          {/* 2. Master Quota */}
                          <td className="py-3 px-2 text-center font-semibold text-slate-800">
                            {sub.masterWeeklyPeriods}
                          </td>

                          {/* 3. Conducted */}
                          <td className="py-3 px-2 text-center font-bold text-emerald-700">
                            {sub.totalConducted}
                          </td>

                          {/* 4. Assigned Faculty */}
                          <td className="py-3 px-3 text-slate-600">
                            {assigned.length === 0 ? (
                              <span className="text-slate-400 text-[11px] italic">Not Assigned</span>
                            ) : (
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {assigned.map((name, i) => (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openStaffModalByName(name);
                                    }}
                                    className="rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-800 transition-colors cursor-pointer"
                                    title={`Click to view ${name}'s action log`}
                                  >
                                    {name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* 5. Conducted Faculty (Shows actual name, never '100% Fidelity') */}
                          <td className="py-3 px-3">
                            {changedList.length === 0 ? (
                              assigned.length === 0 ? (
                                <span className="text-slate-400 text-[11px] italic">Not Assigned</span>
                              ) : (
                                <div className="flex flex-wrap gap-1 max-w-xs">
                                  {assigned.map((name, i) => (
                                    <span
                                      key={i}
                                      className="inline-flex items-center gap-1 rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-800"
                                    >
                                      {name}
                                      <span className="text-[9px] text-slate-500 font-normal">(As Master)</span>
                                    </span>
                                  ))}
                                </div>
                              )
                            ) : (
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {changedList.map((cf, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openStaffModalByName(cf.facultyName);
                                    }}
                                    className="inline-flex items-center gap-1 rounded bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-800 shadow-2xs transition-colors cursor-pointer"
                                    title={cf.originalFacultyName ? `Substituted for ${cf.originalFacultyName} (${cf.count} session${cf.count !== 1 ? "s" : ""}) - Click to view ${cf.facultyName}'s action log` : `Substitute faculty (${cf.count} session${cf.count !== 1 ? "s" : ""}) - Click to view ${cf.facultyName}'s action log`}
                                  >
                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                                    {cf.facultyName}
                                    {cf.originalFacultyName && cf.originalFacultyName !== cf.facultyName && (
                                      <span className="text-[10px] font-normal text-amber-700">
                                        (sub for {cf.originalFacultyName})
                                      </span>
                                    )}
                                    {cf.count > 1 && (
                                      <span className="rounded-full bg-amber-200 px-1 text-[9px] font-bold text-amber-900">
                                        ×{cf.count}
                                      </span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* 6. Enrolled Students */}
                          <td className="py-3 px-2 text-center font-semibold text-slate-800">
                            {(sub.totalMarked || 0) > 0 ? sub.totalMarked : 30}
                          </td>

                          {/* 7. Students Present */}
                          <td className="py-3 px-2 text-center font-bold text-emerald-700">
                            {sub.totalConducted > 0 ? (sub.totalPresent || 0) : 0}
                          </td>

                          {/* 8. Students Absent */}
                          <td className="py-3 px-2 text-center font-bold text-rose-600">
                            {sub.totalConducted > 0
                              ? ((sub.totalMarked || 0) > 0 ? Math.max(0, (sub.totalMarked || 0) - (sub.totalPresent || 0)) : 0)
                              : 0}
                          </td>

                          {/* 9. Attendance % */}
                          <td className="py-3 px-2 text-center font-bold text-slate-700">
                            <div className="flex flex-col items-center justify-center">
                              {effectivePct > 0 ? (
                                <span
                                  className={cn(
                                    "inline-block rounded-md px-2 py-0.5 text-xs font-bold shadow-2xs",
                                    effectivePct >= 75
                                      ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                      : effectivePct >= 50
                                        ? "bg-amber-100 text-amber-800 border border-amber-200"
                                        : "bg-rose-100 text-rose-800 border border-rose-200",
                                  )}
                                >
                                  {effectivePct}%
                                </span>
                              ) : (
                                <span className="text-slate-400 font-medium text-xs">—</span>
                              )}

                              {scheduled > sub.totalConducted && sub.totalConducted > 0 && (
                                <span className="text-[10px] text-slate-500 font-medium mt-0.5">
                                  {sub.totalConducted}/{scheduled} held
                                  {turnout != null && ` (${turnout}% attendance)`}
                                </span>
                              )}
                              {scheduled <= sub.totalConducted && sub.totalConducted > 0 && (
                                <span className="text-[10px] text-slate-500 font-medium mt-0.5">
                                  {turnout}% attendance
                                </span>
                              )}
                              {sub.totalConducted === 0 && scheduled > 0 && (
                                <span className="text-[10px] text-slate-400 mt-0.5">
                                  0/{scheduled} held
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 10. Action Buttons */}
                          <td className="py-3 px-3 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5 flex-nowrap">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void exportSubjectExcel(sub);
                                }}
                                disabled={generatingExcelKey === sub.subjectCode}
                                className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[10px] px-2 py-1 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                                title={`Export ${sub.subjectName}'s verified delivery report to Excel`}
                              >
                                {generatingExcelKey === sub.subjectCode ? (
                                  <Loader2 className="h-3 w-3 animate-spin text-emerald-700" />
                                ) : (
                                  <FileSpreadsheet className="h-3 w-3 text-emerald-700" />
                                )}
                                <span className="hidden xl:inline">Excel</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void printSubjectPdf(sub);
                                }}
                                disabled={generatingPdfKey === sub.subjectCode}
                                className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-[10px] px-2 py-1 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                                title={`Download official verified PDF for ${sub.subjectName}`}
                              >
                                {generatingPdfKey === sub.subjectCode ? (
                                  <Loader2 className="h-3 w-3 animate-spin text-rose-700" />
                                ) : (
                                  <FileText className="h-3 w-3 text-rose-700" />
                                )}
                                <span className="hidden xl:inline">PDF</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openSubjectModal(sub);
                                }}
                                className="inline-flex items-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[10px] px-2 py-1 shadow-xs transition-colors cursor-pointer"
                                title="View subject details, faculty allotment & action history"
                              >
                                <Eye className="h-3 w-3" />
                                <span>View</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* 8. STAFF ANALYTICS REPORT */}
      {activeSection === "staff" && (
        <div id="staff-analytics-table-container" ref={printAreaRef} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-extrabold uppercase tracking-wider text-navy-900">
                  Faculty Teaching Load & Substitution Report
                </h4>
                <span className="rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                  {filteredFaculties.length} Faculty
                </span>
                {staffAnalytics.totalConducted > 0 && (
                  <span className="rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                    {staffAnalytics.totalConducted} Classes Held
                  </span>
                )}
                {staffAnalytics.totalSubstituteTaken > 0 && (
                  <span className="rounded-full bg-sky-100 border border-sky-300 px-2 py-0.5 text-[11px] font-bold text-sky-800">
                    +{staffAnalytics.totalSubstituteTaken} Substitutions Taken
                  </span>
                )}
                {staffAnalytics.totalRelieved > 0 && (
                  <span className="rounded-full bg-rose-100 border border-rose-300 px-2 py-0.5 text-[11px] font-bold text-rose-800">
                    -{staffAnalytics.totalRelieved} Relieved
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Faculty teaching hours, workload distribution, quota completion &amp; verified substitution audit
              </p>
            </div>

            {/* Header Actions: Excel, PDF & View Mode Switcher */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800 transition-colors shadow-2xs cursor-pointer"
                title="Export complete Faculty Roster and Session Breakdown to Excel (.xls)"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" />
                <span>Export Staff Excel</span>
              </button>
              <button
                type="button"
                onClick={handlePrintPdf}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-800 transition-colors shadow-2xs cursor-pointer"
                title="Download / Print official verified PDF Faculty Workload Report"
              >
                <FileText className="h-3.5 w-3.5 text-rose-700" />
                <span>Print Staff PDF</span>
              </button>

              {/* View Switcher: Vertical Table (Default) vs Cards */}
              <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs shadow-2xs">
                <button
                  type="button"
                  onClick={() => setStaffViewMode("table")}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
                    staffViewMode === "table"
                      ? "bg-white text-navy-950 font-bold shadow-xs border border-slate-200"
                      : "text-slate-600 hover:text-navy-900",
                  )}
                  title="Switch to Vertical Table View (Default)"
                >
                  <Table className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Vertical Table</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStaffViewMode("cards")}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
                    staffViewMode === "cards"
                      ? "bg-white text-navy-950 font-bold shadow-xs border border-slate-200"
                      : "text-slate-600 hover:text-navy-900",
                  )}
                  title="Switch to Faculty Cards Grid View"
                >
                  <LayoutGrid className="h-3.5 w-3.5 text-slate-500" />
                  <span>Cards</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-100 text-xs">
            <button
              type="button"
              onClick={() => setStaffFilterTab("all")}
              className={cn(
                "rounded-lg px-2.5 py-1 font-semibold transition-colors cursor-pointer",
                staffFilterTab === "all"
                  ? "bg-navy-900 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200",
              )}
            >
              All Faculty ({data?.faculties?.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setStaffFilterTab("substitutes")}
              className={cn(
                "rounded-lg px-2.5 py-1 font-semibold transition-colors cursor-pointer inline-flex items-center gap-1",
                staffFilterTab === "substitutes"
                  ? "bg-sky-600 text-white shadow-2xs"
                  : "bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100",
              )}
            >
              Substitutions Covered (+) ({data?.faculties?.filter((f) => f.substituteTakenCount > 0).length || 0})
            </button>
            <button
              type="button"
              onClick={() => setStaffFilterTab("relieved")}
              className={cn(
                "rounded-lg px-2.5 py-1 font-semibold transition-colors cursor-pointer inline-flex items-center gap-1",
                staffFilterTab === "relieved"
                  ? "bg-rose-600 text-white shadow-2xs"
                  : "bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100",
              )}
            >
              Relieved Away (-) ({data?.faculties?.filter((f) => f.relievedCount > 0).length || 0})
            </button>
            <button
              type="button"
              onClick={() => setStaffFilterTab("variance")}
              className={cn(
                "rounded-lg px-2.5 py-1 font-semibold transition-colors cursor-pointer inline-flex items-center gap-1",
                staffFilterTab === "variance"
                  ? "bg-amber-600 text-white shadow-2xs"
                  : "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100",
              )}
            >
              Load Variance ({data?.faculties?.filter((f) => Math.abs(f.substituteTakenCount - f.relievedCount) > 0 || f.classesConducted !== f.masterAssignedPeriods).length || 0})
            </button>
          </div>

          {/* Interactive In-Page Staff Focus Drill-Down Card */}
          {selectedStaffObj && (
            <div className="rounded-xl border-2 border-amber-400 bg-linear-to-r from-amber-50/90 via-amber-50/40 to-white p-4 shadow-sm animate-in fade-in">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white font-bold shadow-xs">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-extrabold text-navy-950">{selectedStaffObj.facultyName}</h3>
                      <span className="rounded-md bg-amber-100 px-2.5 py-0.5 font-mono text-xs font-bold text-amber-900 border border-amber-200">
                        HRMS ID: {selectedStaffObj.hrmsId}
                      </span>
                      <span className="rounded-full bg-amber-500 text-white px-2 py-0.5 text-[10px] font-bold">
                        Direct Page Focus
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Faculty Teaching Load, Substitution & Schedule Breakdown
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void exportFacultyExcel(selectedStaffObj)}
                    disabled={generatingExcelKey === (selectedStaffObj.hrmsId || selectedStaffObj.facultyName)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                    title={`Export ${selectedStaffObj.facultyName}'s verified workload report to Excel`}
                  >
                    {generatingExcelKey === (selectedStaffObj.hrmsId || selectedStaffObj.facultyName) ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-700" />
                    ) : (
                      <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" />
                    )}
                    <span>Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void printFacultyPdf(selectedStaffObj)}
                    disabled={generatingPdfKey === (selectedStaffObj.hrmsId || selectedStaffObj.facultyName)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-800 hover:bg-rose-100 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                    title={`Download official verified PDF for ${selectedStaffObj.facultyName}`}
                  >
                    {generatingPdfKey === (selectedStaffObj.hrmsId || selectedStaffObj.facultyName) ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-700" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 text-rose-700" />
                    )}
                    <span>PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedStaffHrmsId(null)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-navy-900 transition-colors shadow-2xs cursor-pointer"
                  >
                    ✕ Clear Staff Focus
                  </button>
                </div>
              </div>

              {/* Metric Highlights for this Staff */}
              <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                <div className="rounded-lg bg-white p-3 border border-amber-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Master Assigned</span>
                  <p className="mt-1 text-xl font-extrabold text-navy-950">
                    {selectedStaffObj.masterAssignedPeriods}{" "}
                    <span className="text-xs font-normal text-slate-500">classes</span>
                  </p>
                </div>
                <div className="rounded-lg bg-white p-3 border border-emerald-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Classes Conducted</span>
                  <p className="mt-1 text-xl font-extrabold text-emerald-800">
                    {selectedStaffObj.classesConducted}{" "}
                    <span className="text-xs font-normal text-slate-500">attended</span>
                  </p>
                </div>
                <div className="rounded-lg bg-white p-3 border border-rose-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Relieved (Out)</span>
                  <p className="mt-1 text-xl font-extrabold text-rose-700">
                    {selectedStaffObj.relievedCount}{" "}
                    <span className="text-xs font-normal text-slate-500">classes</span>
                  </p>
                </div>
                <div className="rounded-lg bg-white p-3 border border-sky-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-sky-700 uppercase tracking-wider">Substitutions (In)</span>
                  <p className="mt-1 text-xl font-extrabold text-sky-800">
                    {selectedStaffObj.substituteTakenCount}{" "}
                    <span className="text-xs font-normal text-slate-500">classes</span>
                  </p>
                </div>
                <div className="rounded-lg bg-white p-3 border border-indigo-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Net Teaching Load</span>
                  <p className="mt-1 text-xl font-extrabold text-indigo-900">
                    {selectedStaffObj.netTeachingCount}{" "}
                    <span className="text-xs font-normal text-slate-500">total</span>
                  </p>
                </div>
              </div>

              {/* Assigned Subjects */}
              {selectedStaffObj.subjects && selectedStaffObj.subjects.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs pt-2.5 border-t border-amber-100">
                  <span className="font-bold text-slate-700">Assigned Subjects:</span>
                  {selectedStaffObj.subjects.map((sub, i) => (
                    <span
                      key={i}
                      className="rounded-md bg-white border border-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-900 shadow-2xs"
                    >
                      {sub}
                    </span>
                  ))}
                </div>
              )}

              {/* Drill-down Sessions Table for this Staff */}
              <div className="mt-3.5 pt-3 border-t border-amber-200">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-xs font-bold text-navy-950 uppercase tracking-wider">
                    Teaching & Substitution Sessions for {selectedStaffObj.facultyName} (#{selectedStaffObj.hrmsId})
                  </h5>
                  <span className="text-[11px] font-semibold text-slate-600">
                    {staffSessions.length} Session{staffSessions.length !== 1 ? "s" : ""} recorded
                  </span>
                </div>

                {staffSessions.length === 0 ? (
                  <div className="rounded-lg bg-white p-4 text-center text-xs text-slate-500 border border-slate-200">
                    No teaching sessions found for {selectedStaffObj.facultyName} in the current date filter.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase text-slate-600">
                          <th className="py-2 px-3">Date & Slot</th>
                          <th className="py-2 px-3">Subject</th>
                          <th className="py-2 px-3">Section / Batch</th>
                          <th className="py-2 px-3">Teaching Role</th>
                          <th className="py-2 px-2 text-center">Status</th>
                          <th className="py-2 px-2 text-center">Attendance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {staffSessions.map((s) => {
                          const isSubstituteIn = s.todayFacultyHrmsId === selectedStaffObj.hrmsId && s.masterFacultyHrmsId !== selectedStaffObj.hrmsId;
                          const isRelievedOut = s.masterFacultyHrmsId === selectedStaffObj.hrmsId && s.todayFacultyHrmsId !== selectedStaffObj.hrmsId;
                          return (
                            <tr key={s.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3">
                                <span className="font-semibold text-slate-800">{s.date}</span>
                                <span className="text-[10px] text-slate-500 block">{s.slotLabel} ({s.time})</span>
                              </td>
                              <td className="py-2 px-3">
                                <p className="font-bold text-navy-900">{s.todaySubjectName || s.masterSubjectName}</p>
                                <span className="font-mono text-[10px] text-slate-400">{s.todaySubjectCode || s.masterSubjectCode}</span>
                              </td>
                              <td className="py-2 px-3 text-slate-700">
                                {formatSessionClassInfo(s, false)}
                              </td>
                              <td className="py-2 px-3">
                                {isSubstituteIn ? (
                                  <span className="inline-flex items-center gap-1 rounded bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800">
                                    Substitute Taken (+) <span className="text-[9px] font-normal text-sky-700">for {s.masterFacultyName}</span>
                                  </span>
                                ) : isRelievedOut ? (
                                  <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                                    Relieved Away (-) <span className="text-[9px] font-normal text-rose-700">covered by {s.todayFacultyName}</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                                    Regular Assigned
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-2 text-center">
                                {s.isConducted ? (
                                  <span className="rounded bg-emerald-100 text-emerald-800 px-1.5 py-0.5 text-[10px] font-bold">
                                    Conducted
                                  </span>
                                ) : (
                                  <span className="rounded bg-slate-100 text-slate-600 px-1.5 py-0.5 text-[10px] font-medium">
                                    Scheduled
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-2 text-center font-bold text-slate-700">
                                {s.attendancePct != null ? `${s.attendancePct}%` : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {filteredFaculties.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500 rounded-xl border border-dashed border-slate-300">
              No faculty records match the selected filters.
            </div>
          ) : staffViewMode === "cards" ? (
            /* Modern Executive Faculty Cards Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredFaculties.map((f) => {
                const quotaPct =
                  f.masterAssignedPeriods > 0
                    ? Math.min(100, Math.round((f.classesConducted / f.masterAssignedPeriods) * 100))
                    : f.classesConducted > 0
                    ? 100
                    : 0;

                const initials = (f.facultyName || "NA")
                  .split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase();

                const isQuotaMet = f.masterAssignedPeriods > 0 && f.classesConducted >= f.masterAssignedPeriods;

                return (
                  <div
                    key={f.hrmsId}
                    className={cn(
                      "group relative flex flex-col justify-between rounded-xl border bg-white p-4 transition-all duration-200 hover:shadow-md hover:border-amber-400",
                      activeStaffModal?.hrmsId === f.hrmsId
                        ? "border-amber-400 ring-2 ring-amber-400/30"
                        : "border-slate-200",
                    )}
                  >
                    <div>
                      {/* Card Top: Avatar, Name, HRMS, and Status Badge */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-amber-500 via-amber-600 to-indigo-700 text-white font-extrabold text-sm shadow-sm ring-2 ring-white">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <h5
                              className="font-extrabold text-navy-950 text-sm truncate group-hover:text-amber-900 transition-colors"
                              title={f.facultyName}
                            >
                              {f.facultyName}
                            </h5>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-[11px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                #{f.hrmsId}
                              </span>
                              {f.subjects.length > 0 && (
                                <span
                                  className="text-[10px] text-slate-400 truncate max-w-[120px]"
                                  title={f.subjects.join(", ")}
                                >
                                  {f.subjects[0]}
                                  {f.subjects.length > 1 ? ` +${f.subjects.length - 1}` : ""}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0 text-right">
                          {isQuotaMet ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                              Quota Met ✓
                            </span>
                          ) : f.substituteTakenCount > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-800 border border-sky-200">
                              +{f.substituteTakenCount} Sub Duty
                            </span>
                          ) : f.relievedCount > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-800 border border-rose-200">
                              -{f.relievedCount} Relieved
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                              Scheduled
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Workload Conduction Progress Bar */}
                      <div className="mt-3.5 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-slate-600">Conduction vs Assigned</span>
                          <span className="font-bold text-navy-900">
                            {f.classesConducted} / {f.masterAssignedPeriods}{" "}
                            <span className="text-[10px] text-slate-400">({quotaPct}%)</span>
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden border border-slate-200/60">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-300",
                              quotaPct >= 100
                                ? "bg-emerald-500"
                                : quotaPct > 50
                                ? "bg-amber-500"
                                : "bg-sky-500",
                            )}
                            style={{ width: `${Math.max(4, quotaPct)}%` }}
                          />
                        </div>
                      </div>

                      {/* 6 Key Metrics Tiles */}
                      <div className="mt-3.5 grid grid-cols-3 gap-2">
                        <div className="rounded-lg bg-slate-50 p-2 border border-slate-200/80 text-center">
                          <span className="text-[9.5px] font-bold uppercase text-slate-500 block tracking-tight">
                            Master Quota
                          </span>
                          <span className="text-sm font-extrabold text-navy-950 mt-0.5 block">
                            {f.masterAssignedPeriods}
                          </span>
                        </div>
                        <div className="rounded-lg bg-emerald-50/70 p-2 border border-emerald-200 text-center">
                          <span className="text-[9.5px] font-bold uppercase text-emerald-800 block tracking-tight">
                            Conducted
                          </span>
                          <span className="text-sm font-extrabold text-emerald-700 mt-0.5 block">
                            {f.classesConducted}
                          </span>
                        </div>
                        <div className="rounded-lg bg-indigo-50/70 p-2 border border-indigo-200 text-center">
                          <span className="text-[9.5px] font-bold uppercase text-indigo-800 block tracking-tight">
                            Net Load
                          </span>
                          <span className="text-sm font-extrabold text-indigo-900 mt-0.5 block">
                            {f.netTeachingCount}
                          </span>
                        </div>
                        <div className="rounded-lg bg-rose-50/70 p-2 border border-rose-200 text-center">
                          <span className="text-[9.5px] font-bold uppercase text-rose-800 block tracking-tight">
                            Relieved (-)
                          </span>
                          <span className="text-sm font-extrabold text-rose-700 mt-0.5 block">
                            {f.relievedCount > 0 ? `-${f.relievedCount}` : "0"}
                          </span>
                        </div>
                        <div className="rounded-lg bg-sky-50/70 p-2 border border-sky-200 text-center">
                          <span className="text-[9.5px] font-bold uppercase text-sky-800 block tracking-tight">
                            Sub In (+)
                          </span>
                          <span className="text-sm font-extrabold text-sky-700 mt-0.5 block">
                            {f.substituteTakenCount > 0 ? `+${f.substituteTakenCount}` : "0"}
                          </span>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2 border border-slate-200/80 text-center">
                          <span className="text-[9.5px] font-bold uppercase text-slate-500 block tracking-tight">
                            Attendance %
                          </span>
                          <span className="text-sm font-extrabold text-sky-800 mt-0.5 block">
                            {f.attendancePct != null ? `${f.attendancePct}%` : "—"}
                          </span>
                        </div>
                      </div>

                      {/* Assigned Subjects Chips */}
                      {f.subjects.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {f.subjects.map((sub, i) => (
                            <span
                              key={i}
                              className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 border border-slate-200/60"
                            >
                              {sub}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Card Footer: Action Buttons */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void exportFacultyExcel(f);
                          }}
                          disabled={generatingExcelKey === (f.hrmsId || f.facultyName)}
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[10px] px-2.5 py-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                          title={`Export ${f.facultyName}'s workload and actions to Excel`}
                        >
                          {generatingExcelKey === (f.hrmsId || f.facultyName) ? (
                            <Loader2 className="h-3 w-3 animate-spin text-emerald-700" />
                          ) : (
                            <FileSpreadsheet className="h-3 w-3 text-emerald-700" />
                          )}
                          <span>Excel</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void printFacultyPdf(f);
                          }}
                          disabled={generatingPdfKey === (f.hrmsId || f.facultyName)}
                          className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-[10px] px-2.5 py-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                          title={`Download verified PDF for ${f.facultyName}`}
                        >
                          {generatingPdfKey === (f.hrmsId || f.facultyName) ? (
                            <Loader2 className="h-3 w-3 animate-spin text-rose-700" />
                          ) : (
                            <FileText className="h-3 w-3 text-rose-700" />
                          )}
                          <span>PDF</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveStaffModal(f);
                          setStaffModalSearch("");
                        }}
                        className="inline-flex items-center gap-1 rounded-md bg-navy-900 hover:bg-navy-800 text-white font-bold text-[10px] px-3 py-1.5 shadow-xs transition-colors cursor-pointer"
                        title={`View ${f.facultyName}'s full profile & session audit log`}
                      >
                        <Eye className="h-3 w-3" />
                        <span>View</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Modern Vertical Roster Table (Matching Subject Analysis UI) */
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
              {/* Distinct Header Banner matching Subject Analysis */}
              <div className="border-b border-slate-200 bg-linear-to-r from-slate-50 via-emerald-50/20 to-slate-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-700 text-white font-black text-sm shadow-2xs">
                    FA
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-navy-950">
                        Faculty Workload & Action Audit Roster
                      </h4>
                      <span className="rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                        Official Roster
                      </span>
                      <span className="rounded bg-slate-200/80 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                        {filteredFaculties.length} Faculty Member{filteredFaculties.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Individual faculty teaching hours, workload distribution, quota completion &amp; verified substitution audit
                    </p>
                  </div>
                </div>

                {/* Roster Summary Badges */}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                    {staffAnalytics.totalConducted} Conducted
                  </span>
                  {staffAnalytics.totalSubstituteTaken > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-[10px] font-bold text-sky-700 border border-sky-200">
                      +{staffAnalytics.totalSubstituteTaken} Substitutions Taken
                    </span>
                  )}
                  {staffAnalytics.totalRelieved > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                      -{staffAnalytics.totalRelieved} Relieved Away
                    </span>
                  )}
                  {staffAnalytics.overallTurnoutPct != null ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-800 border border-indigo-200">
                      {staffAnalytics.overallTurnoutPct}% Avg Turnout
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                      Turnout Pending
                    </span>
                  )}
                </div>
              </div>

              {/* Table View */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100/80 text-[10px] font-bold uppercase tracking-wider text-slate-800">
                      <th className="py-2.5 px-3">Faculty Name &amp; HRMS</th>
                      <th className="py-2.5 px-3">Assigned Curriculum Subjects</th>
                      <th className="py-2.5 px-2 text-center">Master Quota</th>
                      <th className="py-2.5 px-2 text-center">Conducted</th>
                      <th className="py-2.5 px-2 text-center">Relieved (-)</th>
                      <th className="py-2.5 px-2 text-center">Substitute (+)</th>
                      <th className="py-2.5 px-2 text-center">Net Load</th>
                      <th className="py-2.5 px-2 text-center">Enrolled</th>
                      <th className="py-2.5 px-2 text-center text-emerald-800">Present</th>
                      <th className="py-2.5 px-2 text-center text-rose-800">Absent</th>
                      <th className="py-2.5 px-2 text-center text-sky-800">Attendance %</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredFaculties.map((f) => {
                      return (
                        <tr
                          key={f.hrmsId}
                          onClick={() => {
                            setActiveStaffModal(f);
                            setStaffModalSearch("");
                          }}
                          className={cn(
                            "cursor-pointer hover:bg-emerald-50/40 transition-colors group",
                            activeStaffModal?.hrmsId === f.hrmsId
                              ? "bg-emerald-50/80 border-l-4 border-l-emerald-600 font-medium"
                              : "",
                          )}
                        >
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2.5">
                              <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center font-bold text-[11px] text-slate-700 shadow-2xs shrink-0">
                                {f.facultyName.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-bold text-navy-950 group-hover:text-emerald-800 transition-colors">
                                  {f.facultyName}
                                </p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                    #{f.hrmsId}
                                  </span>
                                  {activeStaffModal?.hrmsId === f.hrmsId && (
                                    <span className="rounded bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.2 shadow-2xs">
                                      Viewing &bull; Audit Active
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {f.subjects.length > 0 ? (
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {f.subjects.map((sub, i) => (
                                  <span key={i} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 border border-slate-200/60">
                                    {sub}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">No formal subjects</span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-center font-semibold text-slate-800">
                            {f.masterAssignedPeriods} p/wk
                          </td>
                          <td className="py-3 px-2 text-center font-bold text-emerald-700">
                            {f.classesConducted} held
                          </td>
                          <td className="py-3 px-2 text-center font-bold text-rose-600">
                            {f.relievedCount > 0 ? `-${f.relievedCount}` : "0"}
                          </td>
                          <td className="py-3 px-2 text-center font-bold text-sky-600">
                            {f.substituteTakenCount > 0 ? `+${f.substituteTakenCount}` : "0"}
                          </td>
                          <td className="py-3 px-2 text-center font-extrabold text-navy-950">
                            {f.netTeachingCount}
                          </td>
                          <td className="py-3 px-2 text-center font-bold text-slate-800">
                            {f.totalEnrolled && f.totalEnrolled > 0
                              ? f.totalEnrolled
                              : (f.totalMarked && f.totalMarked > 0 ? f.totalMarked : "—")}
                          </td>
                          <td className="py-3 px-2 text-center font-bold text-emerald-700">
                            {f.classesConducted > 0 && f.totalPresent != null && f.totalPresent > 0 ? f.totalPresent : (f.classesConducted > 0 && (f.totalPresent != null || f.totalAbsent != null) ? 0 : "—")}
                          </td>
                          <td className="py-3 px-2 text-center font-bold text-rose-600">
                            {f.classesConducted > 0 && f.totalAbsent != null && f.totalAbsent > 0 ? f.totalAbsent : (f.classesConducted > 0 && (f.totalPresent != null || f.totalAbsent != null) ? 0 : "—")}
                          </td>
                          <td className="py-3 px-2 text-center font-bold text-sky-700">
                            {f.classesConducted > 0 && f.attendancePct != null ? `${f.attendancePct}%` : "Pending"}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5 flex-nowrap">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void exportFacultyExcel(f);
                                }}
                                disabled={generatingExcelKey === (f.hrmsId || f.facultyName)}
                                className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[10px] px-2 py-1 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                                title={`Export ${f.facultyName}'s workload and verified action history to Excel`}
                              >
                                {generatingExcelKey === (f.hrmsId || f.facultyName) ? (
                                  <Loader2 className="h-3 w-3 animate-spin text-emerald-700" />
                                ) : (
                                  <FileSpreadsheet className="h-3 w-3 text-emerald-700" />
                                )}
                                <span className="hidden xl:inline">Excel</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void printFacultyPdf(f);
                                }}
                                disabled={generatingPdfKey === (f.hrmsId || f.facultyName)}
                                className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-[10px] px-2 py-1 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                                title={`Download official verified PDF for ${f.facultyName}`}
                              >
                                {generatingPdfKey === (f.hrmsId || f.facultyName) ? (
                                  <Loader2 className="h-3 w-3 animate-spin text-rose-700" />
                                ) : (
                                  <FileText className="h-3 w-3 text-rose-700" />
                                )}
                                <span className="hidden xl:inline">PDF</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveStaffModal(f);
                                  setStaffModalSearch("");
                                }}
                                className="inline-flex items-center gap-1 rounded-md bg-navy-900 hover:bg-navy-800 text-white font-semibold text-[10px] px-2 py-1 shadow-xs transition-colors cursor-pointer"
                                title={`View ${f.facultyName}'s full profile, workload, and action history`}
                              >
                                <Eye className="h-3 w-3" />
                                <span>View</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 9. CHANGE AUDIT LOG */}
      {activeSection === "audit" && (
        <div ref={printAreaRef} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="border-b border-slate-100 pb-3 mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-navy-900">
              Official Timetable Alteration History
            </h4>
            <p className="text-[11px] text-slate-500">
              Audit trail of every approved faculty substitution, period swap, and alteration
            </p>
          </div>

          <div className="overflow-x-auto">
            {filteredRecentChanges.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No timetable alterations recorded matching the filters.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase text-slate-600">
                    <th className="py-2.5 px-3">Date & Slot</th>
                    <th className="py-2.5 px-2">Batch</th>
                    <th className="py-2.5 px-3">Master (Before)</th>
                    <th className="py-2.5 px-3">Actual (After)</th>
                    <th className="py-2.5 px-2 text-center">Type</th>
                    <th className="py-2.5 px-3">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecentChanges.map((change) => (
                    <tr key={change.id} className="hover:bg-slate-50">
                      <td className="py-3 px-3">
                        <p className="font-bold text-navy-900">{change.timetableDate}</p>
                        <p className="text-[10px] text-slate-500 font-mono">
                          {change.slotLabel} ({change.slotTime})
                        </p>
                      </td>
                      <td className="py-3 px-2">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-800">
                          Batch {change.batch} {change.sectionName ? `· Sec ${change.sectionName}` : ""}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-semibold text-slate-800">
                          {change.masterSubjectName || change.masterSubjectCode || "None"}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Faculty: {change.masterFacultyName || "None"}
                        </p>
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-bold text-amber-900">
                          {change.newSubjectName || change.newSubjectCode || change.masterSubjectName}
                        </p>
                        <p className="text-[10px] text-sky-800 font-bold">
                          Faculty: {change.newFacultyName || change.masterFacultyName}
                        </p>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                          {change.varianceType}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 italic text-[11px]">
                        {change.remarks || "No remarks"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>

      {/* 11. Interactive KPI Drilldown Slide-Over Pop Card Drawer */}
      {activeKpiDrawer && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
            onClick={() => setActiveKpiDrawer(null)}
          />

          {/* Side Drawer Card */}
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-xl bg-white shadow-2xl border-l border-slate-200 flex flex-col transform transition-transform duration-300 ease-in-out animate-in slide-in-from-right">
              {/* Drawer Header */}
              <div
                className={cn(
                  "p-4 border-b flex items-start justify-between gap-3",
                  activeKpiDrawer === "substituted"
                    ? "bg-sky-50/80 border-sky-100"
                    : activeKpiDrawer === "changed"
                      ? "bg-amber-50/80 border-amber-100"
                      : activeKpiDrawer === "swapped"
                        ? "bg-purple-50/80 border-purple-100"
                        : activeKpiDrawer === "conducted"
                          ? "bg-emerald-50/80 border-emerald-100"
                          : activeKpiDrawer === "master"
                            ? "bg-blue-50/80 border-blue-100"
                            : "bg-rose-50/80 border-rose-100",
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold shadow-xs",
                      activeKpiDrawer === "substituted"
                        ? "bg-sky-600 text-white"
                        : activeKpiDrawer === "changed"
                          ? "bg-amber-600 text-white"
                          : activeKpiDrawer === "swapped"
                            ? "bg-purple-600 text-white"
                            : activeKpiDrawer === "conducted"
                              ? "bg-emerald-600 text-white"
                              : activeKpiDrawer === "master"
                                ? "bg-blue-600 text-white"
                                : "bg-rose-600 text-white",
                    )}
                  >
                    {activeKpiDrawer === "substituted" && <UserCheck className="h-5 w-5" />}
                    {activeKpiDrawer === "changed" && <AlertTriangle className="h-5 w-5" />}
                    {activeKpiDrawer === "swapped" && <ArrowLeftRight className="h-5 w-5" />}
                    {activeKpiDrawer === "conducted" && <CheckCircle2 className="h-5 w-5" />}
                    {activeKpiDrawer === "master" && <BookOpen className="h-5 w-5" />}
                    {activeKpiDrawer === "rate" && <Percent className="h-5 w-5" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-navy-950">
                        {activeKpiDrawer === "substituted" && "Faculty Substitutions"}
                        {activeKpiDrawer === "changed" && "Classes Changed / Altered"}
                        {activeKpiDrawer === "swapped" && "Subject Swapped"}
                        {activeKpiDrawer === "conducted" && "Conducted Classes"}
                        {activeKpiDrawer === "master" &&
                          (dateMode === "today" ? "Today's Master Schedule" : "Master Timetable Schedule")}
                        {activeKpiDrawer === "rate" && "Timetable Variance Rate"}
                      </h3>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[11px] font-bold border",
                          activeKpiDrawer === "substituted"
                            ? "bg-sky-100 text-sky-800 border-sky-200"
                            : activeKpiDrawer === "changed"
                              ? "bg-amber-100 text-amber-900 border-amber-200"
                              : activeKpiDrawer === "swapped"
                                ? "bg-purple-100 text-purple-900 border-purple-200"
                                : activeKpiDrawer === "conducted"
                                  ? "bg-emerald-100 text-emerald-900 border-emerald-200"
                                  : activeKpiDrawer === "master"
                                    ? "bg-blue-100 text-blue-900 border-blue-200"
                                    : "bg-rose-100 text-rose-900 border-rose-200",
                        )}
                      >
                        {activeKpiDrawer === "substituted" && `${filteredDrawerSubstitutions.length} record(s)`}
                        {activeKpiDrawer === "changed" && `${filteredDrawerChanges.length} record(s)`}
                        {activeKpiDrawer === "swapped" && `${filteredDrawerSwaps.length} record(s)`}
                        {activeKpiDrawer === "conducted" && `${filteredDrawerConducted.length} session(s)`}
                        {activeKpiDrawer === "master" && `${filteredDrawerMasterScheduled.length} scheduled period(s)`}
                        {activeKpiDrawer === "rate" && `${summary.overallChangeRatePct}% deviation`}
                      </span>
                    </div>

                    <p className="mt-0.5 text-xs text-slate-600">
                      {activeKpiDrawer === "substituted" &&
                        "Who was scheduled (relieved) vs who stepped in and took over the lecture"}
                      {activeKpiDrawer === "changed" &&
                        "Full comparison of original master lecture vs what was actually conducted"}
                      {activeKpiDrawer === "swapped" &&
                        "Periods where the master scheduled subject was exchanged for another subject"}
                      {activeKpiDrawer === "conducted" &&
                        "Sessions held with verified student attendance marked and counts"}
                      {activeKpiDrawer === "master" &&
                        "Teaching periods scheduled in master timetable (strictly excluding lunch & normal breaks)"}
                      {activeKpiDrawer === "rate" &&
                        "Breakdown of master plan stability, substitutions, and timetable variance"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveKpiDrawer(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-navy-950 hover:bg-slate-200/60 transition-colors cursor-pointer"
                  title="Close pop card (Esc)"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* In-Drawer Quick Search & Filter Bar */}
              {activeKpiDrawer !== "rate" && (
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={drawerSearch}
                      onChange={(e) => setDrawerSearch(e.target.value)}
                      placeholder={
                        activeKpiDrawer === "substituted"
                          ? "Filter by relieved teacher, reliever, subject, slot..."
                          : activeKpiDrawer === "changed"
                            ? "Filter by subject, teacher, slot, section..."
                            : "Filter results..."
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white pl-8.5 pr-8 py-1.5 text-xs text-navy-950 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    {drawerSearch && (
                      <button
                        type="button"
                        onClick={() => setDrawerSearch("")}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Scrollable Content Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
                {/* 1. FACULTY SUBSTITUTED DRILLDOWN */}
                {activeKpiDrawer === "substituted" && (
                  <>
                    {filteredDrawerSubstitutions.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                        <UserCheck className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                        <h4 className="text-sm font-bold text-navy-950">No Faculty Substitutions Found</h4>
                        <p className="mt-1 text-xs text-slate-500">
                          {drawerSearch
                            ? `No substitutions matching "${drawerSearch}".`
                            : "All scheduled teachers conducted their classes as planned with 0 substitutions."}
                        </p>
                        {drawerSearch && (
                          <button
                            type="button"
                            onClick={() => setDrawerSearch("")}
                            className="mt-3 text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                          >
                            Clear search filter
                          </button>
                        )}
                      </div>
                    ) : (
                      filteredDrawerSubstitutions.map((sub, idx) => (
                        <div
                          key={sub.id || idx}
                          className="rounded-xl border border-sky-100 bg-white p-3.5 shadow-xs hover:shadow-md transition-shadow space-y-3"
                        >
                          {/* Card Meta Badges */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                                <Calendar className="h-3 w-3 text-slate-500" />
                                {formatDisplayDate(sub.date)}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-800">
                                <Clock className="h-3 w-3 text-sky-600" />
                                {sub.slotLabel} {sub.slotTime ? `(${sub.slotTime})` : ""}
                              </span>
                              <span className="rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                                {getBranchBadge(null, sub.branchCode)}
                              </span>
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                Batch {sub.batch} {sub.sectionName ? `· Sec ${cleanSectionCode(sub.sectionName)}` : ""}
                              </span>
                            </div>

                            <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-sky-900">
                              Faculty Substituted
                            </span>
                          </div>

                          {/* PROMINENT WHO CHANGED VS WHO TOOK OVER BOX */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-stretch bg-slate-50/80 p-3 rounded-lg border border-slate-200">
                            {/* Left: Relieved Faculty (Who was changed) */}
                            <div className="rounded-lg bg-rose-50/80 border border-rose-200 p-2.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1">
                                <UserX className="h-3 w-3 text-rose-600" />
                                Who Was Changed (Relieved)
                              </span>
                              <p className="mt-1 text-sm font-bold text-rose-950">
                                {sub.masterFacultyName}
                              </p>
                              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-rose-800 font-mono">
                                {sub.masterFacultyHrmsId ? `HRMS #${sub.masterFacultyHrmsId}` : "Scheduled Staff"}
                              </div>
                              <p className="mt-1 text-[10px] text-rose-700/80 italic">
                                Scheduled in master plan
                              </p>
                            </div>

                            {/* Right: Reliever Faculty (Who took over the period) */}
                            <div className="rounded-lg bg-emerald-50/90 border border-emerald-200 p-2.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                                <UserCheck className="h-3 w-3 text-emerald-700" />
                                Who Took Over (Reliever)
                              </span>
                              <p className="mt-1 text-sm font-bold text-emerald-950">
                                {sub.newFacultyName}
                              </p>
                              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-emerald-900 font-mono font-semibold">
                                {sub.newFacultyHrmsId ? `HRMS #${sub.newFacultyHrmsId}` : "Substitute Staff"}
                              </div>
                              <p className="mt-1 text-[10px] text-emerald-700 font-medium">
                                Stepped in & conducted period
                              </p>
                            </div>
                          </div>

                          {/* Subject & Details Row */}
                          <div className="space-y-1.5 text-xs text-slate-700 pt-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-500">Subject:</span>
                              <span className="font-bold text-navy-900">
                                {sub.newSubjectName || sub.masterSubjectName}
                              </span>
                              {(sub.newSubjectCode || sub.masterSubjectCode) && (
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                                  {sub.newSubjectCode || sub.masterSubjectCode}
                                </span>
                              )}
                            </div>

                            {sub.remarks && (
                              <div className="flex items-start gap-1.5 bg-amber-50/70 border border-amber-200/70 p-2 rounded text-[11px] text-amber-900">
                                <Info className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold">Official Note / Reason: </span>
                                  <span>{sub.remarks}</span>
                                </div>
                              </div>
                            )}

                            {sub.changedByName && (
                              <p className="text-[10px] text-slate-400">
                                Authorized by: <span className="font-medium text-slate-600">{sub.changedByName}</span>
                              </p>
                            )}
                          </div>

                          {/* Quick Filter Action Button */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                            {sub.newFacultyHrmsId && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedStaffHrmsId(sub.newFacultyHrmsId!);
                                  setActiveKpiDrawer(null);
                                }}
                                className="inline-flex items-center gap-1 rounded bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800 hover:bg-sky-100 border border-sky-200 cursor-pointer"
                              >
                                Filter Report by {sub.newFacultyName}
                                <ArrowRight className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </>
                )}

                {/* 2. CLASSES CHANGED DRILLDOWN */}
                {activeKpiDrawer === "changed" && (
                  <>
                    {filteredDrawerChanges.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                        <AlertTriangle className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                        <h4 className="text-sm font-bold text-navy-950">No Changed Classes Found</h4>
                        <p className="mt-1 text-xs text-slate-500">
                          {drawerSearch
                            ? `No changed classes matching "${drawerSearch}".`
                            : "No timetable variances recorded for this view."}
                        </p>
                      </div>
                    ) : (
                      filteredDrawerChanges.map((change, idx) => (
                        <div
                          key={change.id || idx}
                          className="rounded-xl border border-amber-100 bg-white p-3.5 shadow-xs hover:shadow-md transition-shadow space-y-3"
                        >
                          {/* Header Badges */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                                <Calendar className="h-3 w-3 text-slate-500" />
                                {formatDisplayDate(change.date)}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                                <Clock className="h-3 w-3 text-amber-600" />
                                {change.slotLabel} {change.slotTime ? `(${change.slotTime})` : ""}
                              </span>
                              <span className="rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                                {getBranchBadge(null, change.branchCode)}
                              </span>
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                Batch {change.batch} {change.sectionName ? `· Sec ${cleanSectionCode(change.sectionName)}` : ""}
                              </span>
                            </div>

                            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-200">
                              {change.varianceType}
                            </span>
                          </div>

                          {/* Before & After Comparison */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50/80 p-3 rounded-lg border border-slate-200">
                            {/* Master Plan */}
                            <div className="rounded-lg bg-slate-100/80 p-2.5 border border-slate-200">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                                Master Plan (Scheduled)
                              </span>
                              <p className="mt-1 text-xs font-bold text-navy-950">
                                {change.masterSubjectName}
                              </p>
                              {change.masterSubjectCode && (
                                <p className="font-mono text-[10px] text-slate-500">{change.masterSubjectCode}</p>
                              )}
                              <p className="mt-1 text-[11px] text-slate-600">
                                Faculty: <span className="font-semibold">{change.masterFacultyName}</span>
                              </p>
                            </div>

                            {/* Actual / Changed */}
                            <div className="rounded-lg bg-amber-50/80 p-2.5 border border-amber-200">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                                Actual Conducted (Altered)
                              </span>
                              <p className="mt-1 text-xs font-bold text-amber-950">
                                {change.newSubjectName}
                              </p>
                              {change.newSubjectCode && (
                                <p className="font-mono text-[10px] text-amber-800">{change.newSubjectCode}</p>
                              )}
                              <p className="mt-1 text-[11px] text-amber-900">
                                Faculty: <span className="font-semibold">{change.newFacultyName}</span>
                              </p>
                            </div>
                          </div>

                          {change.remarks && (
                            <div className="bg-amber-50/60 p-2 rounded text-[11px] text-amber-900 border border-amber-200/60">
                              <span className="font-semibold">Reason: </span>
                              {change.remarks}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </>
                )}

                {/* 3. SUBJECT SWAPPED DRILLDOWN */}
                {activeKpiDrawer === "swapped" && (
                  <>
                    {filteredDrawerSwaps.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                        <ArrowLeftRight className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                        <h4 className="text-sm font-bold text-navy-950">No Subject Swaps Found</h4>
                        <p className="mt-1 text-xs text-slate-500">
                          {drawerSearch
                            ? `No subject swaps matching "${drawerSearch}".`
                            : "All periods conducted their planned curriculum subjects without swaps."}
                        </p>
                      </div>
                    ) : (
                      filteredDrawerSwaps.map((swap, idx) => (
                        <div
                          key={swap.id || idx}
                          className="rounded-xl border border-purple-100 bg-white p-3.5 shadow-xs hover:shadow-md transition-shadow space-y-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                                {formatDisplayDate(swap.date)}
                              </span>
                              <span className="rounded bg-purple-50 px-2 py-0.5 text-[11px] font-bold text-purple-800">
                                {swap.slotLabel} {swap.slotTime ? `(${swap.slotTime})` : ""}
                              </span>
                              <span className="rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                                {getBranchBadge(null, swap.branchCode)}
                              </span>
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                Batch {swap.batch} {swap.sectionName ? `· Sec ${cleanSectionCode(swap.sectionName)}` : ""}
                              </span>
                            </div>

                            <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-bold text-purple-900">
                              Subject Exchanged
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50/80 p-3 rounded-lg border border-slate-200">
                            <div className="rounded-lg bg-slate-100 p-2.5 border border-slate-200">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                                Master Subject (Replaced)
                              </span>
                              <p className="mt-1 text-xs font-bold text-navy-950">{swap.masterSubjectName}</p>
                              <p className="font-mono text-[10px] text-slate-500">{swap.masterSubjectCode}</p>
                            </div>

                            <div className="rounded-lg bg-purple-50 p-2.5 border border-purple-200">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800">
                                Swapped Subject (Taught)
                              </span>
                              <p className="mt-1 text-xs font-bold text-purple-950">{swap.newSubjectName}</p>
                              <p className="font-mono text-[10px] text-purple-800">{swap.newSubjectCode}</p>
                            </div>
                          </div>

                          <p className="text-xs text-slate-700">
                            Teacher: <span className="font-semibold text-navy-900">{swap.newFacultyName}</span>
                          </p>

                          {swap.remarks && (
                            <p className="text-[11px] italic text-slate-600 bg-slate-50 p-2 rounded">
                              &ldquo;{swap.remarks}&rdquo;
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </>
                )}

                {/* 4. CONDUCTED CLASSES DRILLDOWN */}
                {activeKpiDrawer === "conducted" && (
                  <>
                    {filteredDrawerConducted.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                        <CheckCircle2 className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                        <h4 className="text-sm font-bold text-navy-950">No Conducted Classes Recorded</h4>
                        <p className="mt-1 text-xs text-slate-500">
                          {drawerSearch
                            ? `No sessions matching "${drawerSearch}".`
                            : "Attendance has not been posted for classes in this date range yet."}
                        </p>
                      </div>
                    ) : (
                      filteredDrawerConducted.map((c) => (
                        <div
                          key={c.id}
                          className="rounded-xl border border-emerald-100 bg-white p-3.5 shadow-xs hover:shadow-md transition-shadow space-y-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <h4 className="text-xs font-bold text-navy-950">
                                {c.todaySubjectName || c.masterSubjectName}
                              </h4>
                              <p className="text-[11px] text-slate-500">
                                Faculty: <span className="font-semibold text-slate-700">{c.todayFacultyName || c.masterFacultyName}</span>
                              </p>
                            </div>

                            <div className="text-right">
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-extrabold",
                                  (c.attendancePct ?? 0) >= 75
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                    : (c.attendancePct ?? 0) >= 60
                                      ? "bg-amber-100 text-amber-800 border border-amber-200"
                                      : "bg-rose-100 text-rose-800 border border-rose-200",
                                )}
                              >
                                {c.attendancePct != null ? `${c.attendancePct}% Attendance` : "Conducted"}
                              </span>
                              <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
                                {c.presentCount} present · {c.absentCount} absent
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-slate-600 border-t border-slate-100">
                            <span className="rounded bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 font-bold text-indigo-700">
                              {getBranchBadge(c.branchId, c.branchCode)}
                            </span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5">{formatDisplayDate(c.date)}</span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5">{c.slotLabel} ({c.time})</span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5">Batch {c.batch}</span>
                            {c.sectionName && (
                              <span className="rounded bg-sky-50 px-1.5 py-0.5 text-sky-700 border border-sky-200 font-semibold">
                                Sec {cleanSectionCode(c.sectionName)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </>
                )}

                {/* 5. MASTER ASSIGNED DRILLDOWN */}
                {activeKpiDrawer === "master" && (
                  <>
                    <div className="rounded-lg bg-blue-50/80 border border-blue-200 p-2.5 flex items-center justify-between text-xs text-blue-900">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-blue-600 shrink-0" />
                        <span>
                          Showing <strong>{filteredDrawerMasterScheduled.length}</strong> master scheduled classes for{" "}
                          <strong>{dateMode === "today" ? "Today" : "Selected Range"}</strong>
                        </span>
                      </div>
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 border border-blue-200">
                        Breaks Excluded
                      </span>
                    </div>

                    {filteredDrawerMasterScheduled.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                        <BookOpen className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                        <h4 className="text-sm font-bold text-navy-950">No Classes Scheduled in Master Timetable</h4>
                        <p className="mt-1 text-xs text-slate-500">
                          {drawerSearch
                            ? `No master scheduled classes matching "${drawerSearch}".`
                            : "No academic periods scheduled in the master timetable for this day (lunch & normal breaks are strictly excluded)."}
                        </p>
                      </div>
                    ) : (
                      filteredDrawerMasterScheduled.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-blue-200 bg-white p-3.5 shadow-xs hover:shadow-md transition-shadow space-y-2.5"
                        >
                          {/* Header Badges */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                                {getBranchBadge(item.branchId, item.branchCode)}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-800 border border-blue-200">
                                <Clock className="h-3 w-3 text-blue-600" />
                                {item.slotLabel} {item.slotTime ? `(${item.slotTime})` : ""}
                              </span>
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                Batch {item.batch} {item.sectionName ? `· Sec ${cleanSectionCode(item.sectionName)}` : ""}
                              </span>
                            </div>
                            <span
                              className={cn(
                                "rounded-full px-2.5 py-0.5 text-[10px] font-bold border uppercase",
                                item.customLabel === "CRT"
                                  ? "bg-purple-100 text-purple-900 border-purple-200"
                                  : item.customLabel === "Library"
                                    ? "bg-teal-100 text-teal-900 border-teal-200"
                                    : item.entryType === "lab"
                                      ? "bg-emerald-100 text-emerald-900 border-emerald-200"
                                      : "bg-blue-100 text-blue-900 border-blue-200",
                              )}
                            >
                              {item.customLabel || (item.entryType === "lab" ? "Laboratory" : "Academic Class")}
                            </span>
                          </div>

                          {/* Subject & Assigned Faculty */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50/80 p-2.5 rounded-lg border border-slate-200">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Curriculum Subject
                              </span>
                              <p className="mt-0.5 text-xs font-bold text-navy-950">{item.subjectName}</p>
                              {item.subjectCode && (
                                <span className="font-mono text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                                  {item.subjectCode}
                                </span>
                              )}
                            </div>

                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Master Assigned Faculty
                              </span>
                              <p className="mt-0.5 text-xs font-bold text-navy-950 flex items-center gap-1">
                                <User className="h-3.5 w-3.5 text-blue-600" />
                                {item.facultyName}
                              </p>
                              {item.facultyHrmsId && (
                                <span className="font-mono text-[10px] text-slate-500">HRMS #{item.facultyHrmsId}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                            <span>Master Timetable Standard Plan</span>
                            <span className="font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                              ✓ Excludes lunch & normal break
                            </span>
                          </div>
                        </div>
                      ))
                    )}

                    {/* Weekly Subject Allotment Quota Breakdown */}
                    {filteredDrawerMaster.length > 0 && (
                      <div className="pt-3 border-t border-slate-200 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                          <span>Weekly Subject Quota Overview</span>
                          <span className="text-[10px] text-slate-500 font-normal">{filteredDrawerMaster.length} subject(s) in curriculum</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {filteredDrawerMaster.map((sub) => (
                            <div key={sub.subjectCode} className="rounded-lg bg-white border border-slate-200 p-2.5 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-navy-900 truncate">{sub.subjectName}</span>
                                <span className="font-mono text-[10px] text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded ml-1 shrink-0">
                                  {sub.masterWeeklyPeriods} p/wk
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 mt-0.5 font-mono">{sub.subjectCode}</p>
                              {sub.facultyNames.length > 0 && (
                                <p className="text-[10px] text-slate-600 mt-1 truncate">
                                  Staff: {sub.facultyNames.join(", ")}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* 6. TIMETABLE CHANGE RATE & VARIANCE BREAKDOWN */}
                {activeKpiDrawer === "rate" && (
                  <div className="space-y-4">
                    <div className="rounded-xl bg-linear-to-br from-rose-50 to-white p-4 border border-rose-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
                            Timetable Variance Ratio
                          </span>
                          <h4 className="text-3xl font-extrabold text-rose-800 mt-1">
                            {summary.overallChangeRatePct}%
                          </h4>
                        </div>
                        <div className="text-right text-xs text-slate-600">
                          <p className="font-bold text-navy-950">{summary.totalChangesRecorded} Alterations</p>
                          <p className="text-[11px] text-slate-500">out of {summary.totalMasterPeriods * 15 || summary.totalScheduledSessions || 1} planned slots</p>
                        </div>
                      </div>

                      <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                        <div
                          className="bg-rose-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, summary.overallChangeRatePct)}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="rounded-lg bg-white p-3 border border-slate-200 shadow-2xs">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">Faculty Substitutions</span>
                        <p className="mt-1 text-xl font-bold text-sky-800">{summary.facultySubstitutionsCount}</p>
                        <p className="text-[10px] text-slate-500">Relievers deployed</p>
                      </div>

                      <div className="rounded-lg bg-white p-3 border border-slate-200 shadow-2xs">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">Subject Swaps</span>
                        <p className="mt-1 text-xl font-bold text-purple-800">{summary.subjectSwapsCount}</p>
                        <p className="text-[10px] text-slate-500">Curriculum exchanges</p>
                      </div>

                      <div className="rounded-lg bg-white p-3 border border-slate-200 shadow-2xs">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">Classes Conducted</span>
                        <p className="mt-1 text-xl font-bold text-emerald-800">{summary.totalConductedSessions}</p>
                        <p className="text-[10px] text-slate-500">Sessions held</p>
                      </div>

                      <div className="rounded-lg bg-white p-3 border border-slate-200 shadow-2xs">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">Avg Attendance</span>
                        <p className="mt-1 text-xl font-bold text-indigo-900">{summary.attendanceAvgPct}%</p>
                        <p className="text-[10px] text-slate-500">Student attendance</p>
                      </div>
                    </div>

                    <div className="rounded-lg bg-blue-50/70 p-3 border border-blue-200 text-xs text-blue-900 space-y-1">
                      <p className="font-bold flex items-center gap-1">
                        <Info className="h-3.5 w-3.5 text-blue-600" />
                        Understanding Timetable Stability
                      </p>
                      <p className="text-[11px] text-blue-800 leading-relaxed">
                        A low change rate (&lt; 15%) signifies strong timetable fidelity where master scheduled classes run as planned. Higher change rates indicate frequent faculty absences, relocations, or emergency adjustments.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Drawer Footer */}
              <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between">
                <p className="text-[11px] text-slate-500">
                  Press <kbd className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] text-slate-700 border">Esc</kbd> or click outside to dismiss
                </p>
                <button
                  type="button"
                  onClick={() => setActiveKpiDrawer(null)}
                  className="rounded-lg bg-navy-950 px-3 py-1.5 text-xs font-bold text-white hover:bg-navy-900 cursor-pointer transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 11. STAFF PROFILE & ACTION LOG POP-UP MODAL */}
      {/* ========================================================================= */}
      {activeStaffModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setActiveStaffModal(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative w-full max-w-5xl h-[88vh] max-h-[900px] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="shrink-0 bg-linear-to-r from-navy-950 via-slate-900 to-indigo-950 px-5 py-3.5 text-white flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/30 text-base font-extrabold shadow-inner">
                  {activeStaffModal.facultyName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-white tracking-tight">
                      {activeStaffModal.facultyName}
                    </h3>
                    <span className="rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-bold px-2 py-0.5">
                      HRMS ID: #{activeStaffModal.hrmsId}
                    </span>
                    <span className="rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold px-2 py-0.5">
                      Active Faculty
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Faculty Workload, Assigned Curriculum & Substitution Action Log
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exportStaffModalExcel}
                  disabled={generatingExcelKey === (activeStaffModal.hrmsId || activeStaffModal.facultyName)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-950/60 hover:bg-emerald-900/80 px-2.5 py-1.5 text-xs font-bold text-emerald-200 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  title="Export to Excel (.xls)"
                >
                  {generatingExcelKey === (activeStaffModal.hrmsId || activeStaffModal.facultyName) ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                  ) : (
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
                  )}
                  <span className="hidden sm:inline">Excel</span>
                </button>
                <button
                  type="button"
                  onClick={exportStaffModalPdf}
                  disabled={generatingPdfKey === (activeStaffModal.hrmsId || activeStaffModal.facultyName)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/40 bg-rose-950/60 hover:bg-rose-900/80 px-2.5 py-1.5 text-xs font-bold text-rose-200 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  title="Print / Export to PDF"
                >
                  {generatingPdfKey === (activeStaffModal.hrmsId || activeStaffModal.facultyName) ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-400" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 text-rose-400" />
                  )}
                  <span className="hidden sm:inline">PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStaffModal(null)}
                  className="rounded-lg bg-white/10 p-2 text-white/80 hover:bg-white/20 hover:text-white cursor-pointer transition-colors"
                  title="Close modal (Esc)"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Smooth scrollable view so all lower sections & table rows are clearly visible */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-slate-50/50">
              {/* Top Summary Cards */}
              <div className="space-y-2.5">
                {/* 5 Workload & Action Metric Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  <div className="rounded-xl bg-white p-3 border border-slate-200 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Master Quota
                    </span>
                    <p className="text-2xl font-black text-slate-800 mt-1">
                      {activeStaffModal.masterAssignedPeriods}
                    </p>
                    <span className="text-[10px] text-slate-400">Scheduled p/wk</span>
                  </div>

                  <div className="rounded-xl bg-white p-3 border border-emerald-200 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                      Conducted
                    </span>
                    <p className="text-2xl font-black text-emerald-700 mt-1">
                      {activeStaffModal.classesConducted}
                    </p>
                    <span className="text-[10px] text-emerald-600">Sessions delivered</span>
                  </div>

                  <div className="rounded-xl bg-white p-3 border border-rose-200 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">
                      Relieved (-)
                    </span>
                    <p className="text-2xl font-black text-rose-600 mt-1">
                      {activeStaffModal.relievedCount > 0 ? `-${activeStaffModal.relievedCount}` : 0}
                    </p>
                    <span className="text-[10px] text-rose-500">Covered by others</span>
                  </div>

                  <div className="rounded-xl bg-white p-3 border border-sky-200 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 block">
                      Substitute (+)
                    </span>
                    <p className="text-2xl font-black text-sky-600 mt-1">
                      {activeStaffModal.substituteTakenCount > 0 ? `+${activeStaffModal.substituteTakenCount}` : 0}
                    </p>
                    <span className="text-[10px] text-sky-500">Taken for others</span>
                  </div>

                  <div className="rounded-xl bg-navy-950 p-3 text-white shadow-2xs sm:col-span-1 col-span-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 block">
                      Net Teaching Load
                    </span>
                    <p className="text-2xl font-black text-amber-400 mt-1">
                      {activeStaffModal.netTeachingCount}
                    </p>
                    <span className="text-[10px] text-slate-300">Total sessions</span>
                  </div>
                </div>

                {/* Mathematical Calculation Breakdown Banner */}
                <div className="rounded-xl bg-linear-to-r from-emerald-50/80 via-slate-50 to-emerald-50/80 border border-emerald-300/80 p-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs shadow-2xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="rounded-md bg-emerald-700 text-white font-extrabold text-[10px] uppercase px-2 py-0.5 tracking-wider shadow-2xs">
                      Calculation Formula
                    </span>
                    <span className="text-slate-800 text-[11px]">
                      <strong>Net Workload Quota</strong> = Master Quota (<span className="font-semibold text-slate-900">{activeStaffModal.masterAssignedPeriods}</span>) &minus; Relieved (<span className="font-semibold text-rose-700">{activeStaffModal.relievedCount}</span>) + Substitute (<span className="font-semibold text-sky-700">{activeStaffModal.substituteTakenCount}</span>) = <strong className="text-emerald-800 font-extrabold">{activeStaffModal.netTeachingCount} Target Periods</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[11px] font-semibold text-slate-700">
                    <span>Delivered Classes: <strong className="text-emerald-700">{activeStaffModal.classesConducted} held</strong></span>
                    <span>&bull;</span>
                    <span>Net Shift: <strong className={activeStaffModal.substituteTakenCount - activeStaffModal.relievedCount >= 0 ? "text-emerald-700" : "text-rose-700"}>
                      {activeStaffModal.substituteTakenCount - activeStaffModal.relievedCount >= 0 ? "+" : ""}{activeStaffModal.substituteTakenCount - activeStaffModal.relievedCount} variance
                    </strong></span>
                  </div>
                </div>

                {/* Assigned Subjects & Quick Action Brief */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <div className="rounded-xl bg-white p-3 border border-slate-200 shadow-2xs">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <BookOpen className="h-3.5 w-3.5 text-indigo-600" />
                      Assigned Subjects
                    </h4>
                    {activeStaffModal.subjects.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No formal subjects registered in master record.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {activeStaffModal.subjects.map((s, idx) => (
                          <span
                            key={idx}
                            className="rounded-md bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-xs font-semibold text-indigo-900"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl bg-white p-3 border border-slate-200 shadow-2xs">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <ArrowLeftRight className="h-3.5 w-3.5 text-amber-600" />
                      Action Profile Summary
                    </h4>
                    <div className="space-y-1 text-xs text-slate-600">
                      <div className="flex justify-between items-center py-0.5 border-b border-slate-100">
                        <span>Substitutions Covered for Colleagues:</span>
                        <span className="font-bold text-sky-700">{activeStaffModal.substituteTakenCount} sessions</span>
                      </div>
                      <div className="flex justify-between items-center py-0.5 border-b border-slate-100">
                        <span>Absence / Relief Covered by Colleagues:</span>
                        <span className="font-bold text-rose-700">{activeStaffModal.relievedCount} sessions</span>
                      </div>
                      <div className="flex justify-between items-center py-0.5">
                        <span>Timetable Variance Impact:</span>
                        <span className="font-bold text-slate-800">
                          {activeStaffModal.substituteTakenCount - activeStaffModal.relievedCount >= 0 ? "+" : ""}
                          {activeStaffModal.substituteTakenCount - activeStaffModal.relievedCount} net shift
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Timetable Sessions & Action History Log */}
              <div className="flex flex-col rounded-xl bg-white border border-slate-200 shadow-2xs overflow-hidden min-h-[360px]">
                <div className="shrink-0 p-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2.5">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-navy-950 flex items-center gap-1.5">
                      <CalendarCheck className="h-4 w-4 text-emerald-600" />
                      Detailed Timetable Delivery &amp; Substitution Actions
                    </h4>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[11px] text-slate-500">
                        Showing {filteredModalStaffSessions.length} sessions involving {activeStaffModal.facultyName}
                      </p>
                    </div>
                  </div>

                  {/* Search inside modal + Action Buttons */}
                  <div className="flex items-center gap-2">
                    <div className="relative min-w-[180px] max-w-xs">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={staffModalSearch}
                        onChange={(e) => setStaffModalSearch(e.target.value)}
                        placeholder="Filter subject, date, slot..."
                        className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={exportStaffModalExcel}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 px-2.5 py-1.5 text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                      title="Download Excel spreadsheet (Abstract + Date-wise breakdown)"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" />
                      <span className="hidden sm:inline">Excel</span>
                    </button>
                    <button
                      type="button"
                      onClick={exportStaffModalPdf}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-900 px-2.5 py-1.5 text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                      title="Download / Print PDF (Abstract + Date-wise breakdown)"
                    >
                      <FileText className="h-3.5 w-3.5 text-rose-700" />
                      <span className="hidden sm:inline">PDF</span>
                    </button>
                  </div>
                </div>

                <div className="flex-1 min-h-[260px] max-h-[520px] overflow-y-auto overflow-x-auto">
                  {filteredModalStaffSessions.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No matching sessions found for this faculty member in the selected date range.
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-100/70 text-[10px] font-bold uppercase tracking-wider text-slate-600 sticky top-0 z-10 backdrop-blur-xs">
                          <th className="py-2.5 px-3">Date & Slot</th>
                          <th className="py-2.5 px-3">Class & Section</th>
                          <th className="py-2.5 px-3">Subject</th>
                          <th className="py-2.5 px-3">Action Role / Status</th>
                          <th className="py-2.5 px-2 text-center">Conducted</th>
                          <th className="py-2.5 px-2 text-center">Enrolled</th>
                          <th className="py-2.5 px-2 text-center text-emerald-700">Present</th>
                          <th className="py-2.5 px-2 text-center text-rose-700">Absent</th>
                          <th className="py-2.5 px-2 text-center">Attendance %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredModalStaffSessions.map((s, idx) => {
                          const sEnr = (s.presentCount || 0) + (s.absentCount || 0);
                          const sPres = s.presentCount || 0;
                          const sAbs = s.absentCount || 0;
                          return (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-3">
                              <span className="font-semibold text-slate-900 block">{s.date}</span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {s.slotLabel} ({s.time})
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-700">
                              <span className="font-semibold text-slate-900 block">
                                {formatSessionClassInfo(s, false)}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <p className="font-bold text-navy-900">
                                {s.todaySubjectName || s.masterSubjectName}
                              </p>
                              <span className="font-mono text-[10px] text-slate-400">
                                {s.todaySubjectCode || s.masterSubjectCode}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] border shadow-2xs",
                                  s.actionBadgeClass,
                                )}
                              >
                                {s.actionTitle}
                              </span>
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              {s.isConducted ? (
                                <span className="rounded bg-emerald-100 text-emerald-800 px-1.5 py-0.5 text-[10px] font-bold">
                                  Yes ✓
                                </span>
                              ) : (
                                <span className="rounded bg-slate-100 text-slate-600 px-1.5 py-0.5 text-[10px] font-medium">
                                  Scheduled
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-center font-medium text-slate-700">
                              {s.isConducted && sEnr > 0 ? sEnr : "—"}
                            </td>
                            <td className="py-2.5 px-2 text-center font-bold text-emerald-700">
                              {s.isConducted && sPres > 0 ? sPres : (s.isConducted && sEnr > 0 ? 0 : "—")}
                            </td>
                            <td className="py-2.5 px-2 text-center font-bold text-rose-600">
                              {s.isConducted && sAbs > 0 ? sAbs : (s.isConducted && sEnr > 0 ? 0 : "—")}
                            </td>
                            <td className="py-2.5 px-2 text-center font-bold text-sky-800">
                              {s.attendancePct != null ? `${s.attendancePct}%` : (sEnr > 0 ? `${Math.round((sPres / sEnr) * 100)}%` : (s.isConducted ? "100%" : "Pending"))}
                            </td>
                          </tr>
                        );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="shrink-0 px-4 py-2.5 bg-white border-t border-slate-200 flex items-center justify-between">
              <p className="text-[11px] text-slate-500 truncate mr-2">
                HRMS Registry record for <span className="font-semibold text-slate-700">{activeStaffModal.facultyName}</span>
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={exportStaffModalExcel}
                  disabled={generatingExcelKey === (activeStaffModal.hrmsId || activeStaffModal.facultyName)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 px-3 py-1.5 text-xs font-bold cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
                >
                  {generatingExcelKey === (activeStaffModal.hrmsId || activeStaffModal.facultyName) ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-700" />
                  ) : (
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" />
                  )}
                  Excel
                </button>
                <button
                  type="button"
                  onClick={exportStaffModalPdf}
                  disabled={generatingPdfKey === (activeStaffModal.hrmsId || activeStaffModal.facultyName)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-900 px-3 py-1.5 text-xs font-bold cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
                >
                  {generatingPdfKey === (activeStaffModal.hrmsId || activeStaffModal.facultyName) ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-700" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 text-rose-700" />
                  )}
                  PDF
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStaffModal(null)}
                  className="rounded-lg bg-navy-950 px-4 py-1.5 text-xs font-bold text-white hover:bg-navy-900 cursor-pointer transition-colors shadow-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 12. SUBJECT DELIVERY & ALTERATION ACTION POP-UP MODAL */}
      {/* ========================================================================= */}
      {activeSubjectModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setActiveSubjectModal(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative w-full max-w-5xl h-[88vh] max-h-[900px] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="shrink-0 bg-linear-to-r from-emerald-950 via-teal-950 to-slate-900 px-5 py-3.5 text-white flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-base font-extrabold shadow-inner">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-white tracking-tight">
                      {activeSubjectModal.subjectName}
                    </h3>
                    <span className="rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold px-2 py-0.5 font-mono">
                      {activeSubjectModal.subjectCode}
                    </span>
                    {activeSubjectModal.cohortTitle && (
                      <span className="rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-[10px] font-bold px-2 py-0.5">
                        {activeSubjectModal.cohortTitle}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Curriculum Delivery, Faculty Allotment & Timetable Alteration History
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exportSubjectModalExcel}
                  disabled={generatingExcelKey === activeSubjectModal.subjectCode}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-900/60 hover:bg-emerald-850 px-2.5 py-1.5 text-xs font-bold text-emerald-200 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  title="Export to Excel (.xls)"
                >
                  {generatingExcelKey === activeSubjectModal.subjectCode ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                  ) : (
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
                  )}
                  <span className="hidden sm:inline">Excel</span>
                </button>
                <button
                  type="button"
                  onClick={exportSubjectModalPdf}
                  disabled={generatingPdfKey === activeSubjectModal.subjectCode}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/40 bg-rose-950/60 hover:bg-rose-900/80 px-2.5 py-1.5 text-xs font-bold text-rose-200 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  title="Print / Export to PDF"
                >
                  {generatingPdfKey === activeSubjectModal.subjectCode ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-400" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 text-rose-400" />
                  )}
                  <span className="hidden sm:inline">PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubjectModal(null)}
                  className="rounded-lg bg-white/10 p-2 text-white/80 hover:bg-white/20 hover:text-white cursor-pointer transition-colors"
                  title="Close modal (Esc)"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Smooth scrollable view so all lower sections & table rows are clearly visible */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-slate-50/50">
              {/* Top Summary Cards */}
              <div className="space-y-2.5">
                {/* 4 Key Metric Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="rounded-xl bg-white p-3 border border-slate-200 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Master Quota
                    </span>
                    <p className="text-2xl font-black text-slate-800 mt-1">
                      {activeSubjectModal.masterWeeklyPeriods > 0 ? activeSubjectModal.masterWeeklyPeriods : (activeSubjectModal.totalScheduled || "—")}
                    </p>
                    <span className="text-[10px] text-slate-400">Periods / week</span>
                  </div>

                  <div className="rounded-xl bg-white p-3 border border-emerald-200 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                      Conducted Sessions
                    </span>
                    <p className="text-2xl font-black text-emerald-700 mt-1">
                      {activeSubjectModal.totalConducted}
                    </p>
                    <span className="text-[10px] text-emerald-600">Held in timeframe</span>
                  </div>

                  <div className="rounded-xl bg-white p-3 border border-amber-200 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
                      Total Alterations
                    </span>
                    <p className="text-2xl font-black text-amber-700 mt-1">
                      {activeSubjectModal.timesChanged}
                    </p>
                    <span className="text-[10px] text-amber-600">
                      {activeSubjectModal.timesSwappedOut} swapped out · {activeSubjectModal.timesSwappedIn} swapped in
                    </span>
                  </div>

                  <div className="rounded-xl bg-white p-3 border border-indigo-200 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block">
                      Attendance Rate
                    </span>
                    <p className="text-2xl font-black text-indigo-800 mt-1">
                      {activeSubjectModal.attendancePct != null && activeSubjectModal.attendancePct > 0
                        ? `${activeSubjectModal.attendancePct}%`
                        : activeSubjectModal.turnoutPct != null
                          ? `${activeSubjectModal.turnoutPct}%`
                          : "—"}
                    </p>
                    <span className="text-[10px] text-indigo-600">
                      {activeSubjectModal.totalConducted > 0 ? "Attendance average" : "Attendance pending"}
                    </span>
                  </div>
                </div>

                {/* Faculty Allotment & Action Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {/* Assigned Master Faculty */}
                  <div className="rounded-xl bg-white p-3 border border-slate-200 shadow-2xs">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                        Assigned Master Faculty
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">Click staff to view profile</span>
                    </h4>
                    {(activeSubjectModal.assignedFacultyNames ?? activeSubjectModal.facultyNames ?? []).length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No faculty assigned in master schedule.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {(activeSubjectModal.assignedFacultyNames ?? activeSubjectModal.facultyNames ?? []).map((name, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => openStaffModalByName(name)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 text-xs font-bold text-emerald-900 transition-colors cursor-pointer shadow-2xs"
                            title={`Click to view ${name}'s full profile & action history`}
                          >
                            <User className="h-3 w-3 text-emerald-600" />
                            <span>{name}</span>
                            <span className="rounded bg-emerald-200/80 px-1 text-[9px] text-emerald-900 font-bold">Assigned</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Changed / Substitute Faculty */}
                  <div className="rounded-xl bg-white p-3 border border-slate-200 shadow-2xs">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <ArrowLeftRight className="h-3.5 w-3.5 text-amber-600" />
                        Substitute & Reliever Faculty
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">Click staff to view profile</span>
                    </h4>
                    {(!activeSubjectModal.changedFaculties || activeSubjectModal.changedFaculties.length === 0) ? (
                      <p className="text-xs text-slate-400 italic">No faculty changes recorded. All classes conducted as assigned.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {activeSubjectModal.changedFaculties.map((cf, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => openStaffModalByName(cf.facultyName)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 text-xs font-bold text-amber-900 transition-colors cursor-pointer shadow-2xs"
                            title={
                              cf.originalFacultyName
                                ? `Stepped in for ${cf.originalFacultyName} (${cf.count} sessions) - Click to view profile`
                                : `Substitute faculty (${cf.count} sessions) - Click to view profile`
                            }
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                            <span>{cf.facultyName}</span>
                            {cf.originalFacultyName && cf.originalFacultyName !== cf.facultyName && (
                              <span className="text-[10px] font-normal text-amber-700">
                                (sub for {cf.originalFacultyName})
                              </span>
                            )}
                            {cf.count > 1 && (
                              <span className="rounded-full bg-amber-200 px-1 text-[9px] font-bold text-amber-900">
                                ×{cf.count}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Delivery Log Table */}
              <div className="flex flex-col rounded-xl bg-white border border-slate-200 shadow-2xs overflow-hidden min-h-[360px]">
                <div className="shrink-0 p-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2.5">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-navy-950 flex items-center gap-1.5">
                      <CalendarCheck className="h-4 w-4 text-emerald-600" />
                      Subject Timetable Delivery & Alteration Actions
                    </h4>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[11px] text-slate-500">
                        Showing {filteredModalSubjectSessions.length} sessions held or planned for {activeSubjectModal.subjectName}
                      </p>
                      {loadingDedicatedSessions && (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[10px] font-bold text-emerald-900 animate-pulse">
                          <Loader2 className="h-3 w-3 animate-spin text-emerald-700" />
                          Verifying curriculum sessions...
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Search inside modal + Action Buttons */}
                  <div className="flex items-center gap-2">
                    <div className="relative min-w-[180px] max-w-xs">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={subjectModalSearch}
                        onChange={(e) => setSubjectModalSearch(e.target.value)}
                        placeholder="Filter by faculty, date, slot..."
                        className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-hidden"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={exportSubjectModalExcel}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 px-2.5 py-1.5 text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                      title="Download Excel spreadsheet (Abstract + Date-wise breakdown)"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" />
                      <span className="hidden sm:inline">Excel</span>
                    </button>
                    <button
                      type="button"
                      onClick={exportSubjectModalPdf}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-900 px-2.5 py-1.5 text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                      title="Download / Print PDF (Abstract + Date-wise breakdown)"
                    >
                      <FileText className="h-3.5 w-3.5 text-rose-700" />
                      <span className="hidden sm:inline">PDF</span>
                    </button>
                  </div>
                </div>

                <div className="flex-1 min-h-[260px] max-h-[520px] overflow-y-auto overflow-x-auto">
                  {filteredModalSubjectSessions.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No matching sessions found for this subject in the selected date range.
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-100/70 text-[10px] font-bold uppercase tracking-wider text-slate-600 sticky top-0 z-10 backdrop-blur-xs">
                          <th className="py-2.5 px-3">Date & Slot</th>
                          <th className="py-2.5 px-3">Class & Section</th>
                          <th className="py-2.5 px-3">Master Faculty</th>
                          <th className="py-2.5 px-3">Conducted Faculty</th>
                          <th className="py-2.5 px-3">Action Status</th>
                          <th className="py-2.5 px-2 text-center">Enrolled</th>
                          <th className="py-2.5 px-2 text-center text-emerald-700">Present</th>
                          <th className="py-2.5 px-2 text-center text-rose-700">Absent</th>
                          <th className="py-2.5 px-2 text-center">Attendance %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredModalSubjectSessions.map((s, idx) => {
                          const sEnr = (s.presentCount || 0) + (s.absentCount || 0);
                          const sPres = s.presentCount || 0;
                          const sAbs = s.absentCount || 0;
                          return (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-3">
                              <span className="font-semibold text-slate-900 block">{s.date}</span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {s.slotLabel} ({s.time})
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-700">
                              <span className="font-semibold text-slate-900 block">
                                {formatSessionClassInfo(s, false)}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              {s.masterFacultyName ? (
                                <button
                                  type="button"
                                  onClick={() => openStaffModalByName(s.masterFacultyName!)}
                                  className="text-slate-700 hover:text-navy-950 font-medium hover:underline cursor-pointer"
                                  title="View staff profile"
                                >
                                  {s.masterFacultyName}
                                </button>
                              ) : (
                                <span className="text-slate-400 italic">None</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              {s.todayFacultyName ? (
                                <button
                                  type="button"
                                  onClick={() => openStaffModalByName(s.todayFacultyName!)}
                                  className={cn(
                                    "font-semibold hover:underline cursor-pointer",
                                    s.isSub ? "text-amber-800 font-bold" : "text-slate-800",
                                  )}
                                  title="View staff profile"
                                >
                                  {s.todayFacultyName}
                                </button>
                              ) : (
                                <span className="text-slate-400 italic">None</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] border shadow-2xs",
                                  s.actionBadgeClass,
                                )}
                              >
                                {s.actionTitle}
                              </span>
                            </td>
                            <td className="py-2.5 px-2 text-center font-medium text-slate-700">
                              {s.isConducted && sEnr > 0 ? sEnr : "—"}
                            </td>
                            <td className="py-2.5 px-2 text-center font-bold text-emerald-700">
                              {s.isConducted && sPres > 0 ? sPres : (s.isConducted && sEnr > 0 ? 0 : "—")}
                            </td>
                            <td className="py-2.5 px-2 text-center font-bold text-rose-600">
                              {s.isConducted && sAbs > 0 ? sAbs : (s.isConducted && sEnr > 0 ? 0 : "—")}
                            </td>
                            <td className="py-2.5 px-2 text-center font-bold text-slate-800">
                              {s.attendancePct != null ? (
                                <span
                                  className={cn(
                                    "inline-block rounded px-2 py-0.5 text-[10px] font-bold",
                                    s.attendancePct >= 75
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-amber-100 text-amber-800",
                                  )}
                                >
                                  {s.attendancePct}%
                                </span>
                              ) : (
                                <span className="text-slate-400 font-normal">Pending</span>
                              )}
                            </td>
                          </tr>
                        );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="shrink-0 px-4 py-2.5 bg-white border-t border-slate-200 flex items-center justify-between">
              <p className="text-[11px] text-slate-500 truncate mr-2">
                Curriculum session history for <span className="font-semibold text-slate-700">{activeSubjectModal.subjectName}</span>
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={exportSubjectModalExcel}
                  disabled={generatingExcelKey === activeSubjectModal.subjectCode}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 px-3 py-1.5 text-xs font-bold cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
                >
                  {generatingExcelKey === activeSubjectModal.subjectCode ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-700" />
                  ) : (
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" />
                  )}
                  Excel
                </button>
                <button
                  type="button"
                  onClick={exportSubjectModalPdf}
                  disabled={generatingPdfKey === activeSubjectModal.subjectCode}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-900 px-3 py-1.5 text-xs font-bold cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
                >
                  {generatingPdfKey === activeSubjectModal.subjectCode ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-700" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 text-rose-700" />
                  )}
                  PDF
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubjectModal(null)}
                  className="rounded-lg bg-emerald-800 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-900 cursor-pointer transition-colors shadow-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
