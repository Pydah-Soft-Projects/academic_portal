"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  Clock,
  Copy,
  GitFork,
  GraduationCap,
  Hash,
  Info,
  Layers,
  Layers3,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sliders,
  Sparkles,
  Square,
  Trash2,
  UserCheck,
  Users,
  X,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAcademicContext } from "@/components/layout/AcademicProvider";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";
import {
  isNonClassTimingSlot,
  timingSlotDisplayLabel,
} from "@/features/timetables/timing-slot-utils";

const DAY_CODE_TO_LABEL: Record<string, string> = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THUR: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
  SUN: "Sunday",
};

const DAY_LABEL_TO_CODE: Record<string, string> = {
  Monday: "MON",
  Tuesday: "TUE",
  Wednesday: "WED",
  Thursday: "THUR",
  Friday: "FRI",
  Saturday: "SAT",
  Sunday: "SUN",
};

type TimingSlot = {
  id: number;
  label: string;
  startTime: string;
  endTime: string;
  slotType: string;
  isAssignable: boolean;
  dayOfWeek?: string;
  dayLabel?: string;
};

type BranchPlanEntry = {
  id: number;
  dayOfWeek: string;
  timingSlotId: number;
  subjectId: number | null;
  subjectCode: string | null;
  subjectName: string | null;
  subjectTypeSnapshot?: string | null;
  entryType: string;
  facultyStaffLinkId: number | null;
  facultyName: string | null;
  facultyHrmsId: string | null;
  roomLabel: string | null;
  batchLabel: string | null;
  customLabel: string | null;
  weeklyRotation?: boolean;
  rotationPattern?: string | null;
};

export type SectionCombinationMode = "all" | "custom";

type BranchOverview = {
  branchId: number;
  branchName: string;
  branchCode: string | null;
  hasSections?: boolean;
  sections?: string[];
  plan: null | {
    id: number;
    status: string;
    versionNo: number;
    timingTemplateName: string | null;
    sectionName: string | null;
    notes: string | null;
    assignedCount: number;
    entries: BranchPlanEntry[];
  };
};

type CombinedSubject = {
  id: number;
  code: string;
  name: string;
  type: string;
  semester: number | null;
  year: number | null;
  branchIds: number[];
  branchNames: string[];
  isCommon: boolean;
};

type FacultyOption = {
  hrmsEmployeeId: string;
  name: string;
  division: string;
  department: string;
  designation: string;
  employeeGroup: string;
};

export type LocalBatchAssignment = {
  subjectId: number | null;
  subjectCode: string;
  subjectName: string;
  entryType: "theory" | "lab" | "other";
  hrmsEmployeeId: string;
  facultyName: string;
  roomLabel: string;
  batchLabel: string;
  studentIds: number[];
  studentCount: number;
};

export type StudentRosterItem = {
  id: number;
  pin_no: string | null;
  student_name: string | null;
  admission_number: string;
  section: string | null;
  batch: string | null;
  branch_id?: number | null;
  branch_name?: string | null;
  branch_code?: string | null;
};

export type LocalPeriodAssignment = {
  dayOfWeek: string;
  timingSlotId: number;
  subjectId: number | null;
  subjectCode: string;
  subjectName: string;
  entryType: "theory" | "lab" | "other";
  hrmsEmployeeId: string;
  facultyName: string;
  roomLabel: string;
  batchLabel: string;
  customLabel: string;
  participatingBranchIds?: number[];
  isSplit?: boolean;
  weeklyRotation?: boolean;
  batch1?: LocalBatchAssignment;
  batch2?: LocalBatchAssignment;
};

const SPECIAL_PERIOD_PRESETS = [
  "CRT",
  "Library",
  "Games & Sports",
  "Seminar",
  "Mentoring",
  "Self Study",
  "Club Activities",
];

const ROOM_SUGGESTIONS = [
  "Room 101",
  "Room 102",
  "Room 201",
  "Room 202",
  "Room 301",
  "CSE Lab 1",
  "ECE Lab",
  "Central Seminar Hall",
  "Drawing Hall",
];

function getCurrentAcademicYearLabel(): string {
  const now = new Date();
  const currentYear = now.getFullYear();
  // Academic session: Indian academic sessions begin June/July (month >= 5)
  // Calendar current year with next year (e.g. 2026-2027)
  const startYear = now.getMonth() >= 5 ? currentYear : currentYear - 1;
  return `${startYear}-${startYear + 1}`;
}

function calculateSlotDurationMinutes(slot?: TimingSlot): number {
  if (!slot?.startTime || !slot?.endTime) return 50;
  const [sh, sm] = slot.startTime.split(":").map(Number);
  const [eh, em] = slot.endTime.split(":").map(Number);
  if (!Number.isFinite(sh) || !Number.isFinite(sm) || !Number.isFinite(eh) || !Number.isFinite(em)) return 50;
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  const diff = end - start;
  return diff > 0 ? diff : 50;
}

function formatMinutesToHours(minutes: number): string {
  const hours = minutes / 60;
  return hours % 1 === 0 ? `${hours} hrs` : `${hours.toFixed(1)} hrs`;
}

export function CombinedTimetableCreationView() {
  const { masters, loading: mastersLoading } = useAcademicContext();

  // Selected filters
  const [collegeId, setCollegeId] = useState<number | null>(null);
  const [courseId, setCourseId] = useState<number | null>(null);
  const [academicYear, setAcademicYear] = useState<string>("");
  const [year, setYear] = useState<number>(1);
  const [semester, setSemester] = useState<number>(1);
  const [section, setSection] = useState<string>("all");
  const [sectionMode, setSectionMode] = useState<SectionCombinationMode>("all");
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [branchSelectedSections, setBranchSelectedSections] = useState<Record<number, string[]>>({});

  // Multi-selected branches checklist
  const [selectedBranchIds, setSelectedBranchIds] = useState<number[]>([]);

  // Remote data
  const [branchesOverview, setBranchesOverview] = useState<BranchOverview[]>([]);
  const [timingSlots, setTimingSlots] = useState<TimingSlot[]>([]);
  const [timingTemplateName, setTimingTemplateName] = useState<string>("");
  const [subjects, setSubjects] = useState<CombinedSubject[]>([]);
  const [facultyList, setFacultyList] = useState<FacultyOption[]>([]);
  const [loadingOverview, setLoadingOverview] = useState<boolean>(false);
  const [loadingSubjects, setLoadingSubjects] = useState<boolean>(false);

  // Editor assignments grid: key = `${dayOfWeek}:${timingSlotId}`
  const [assignments, setAssignments] = useState<Record<string, LocalPeriodAssignment>>({});

  // Slot modal state
  const [activeSlotModal, setActiveSlotModal] = useState<{
    day: string;
    slot: TimingSlot;
    current?: LocalPeriodAssignment;
  } | null>(null);

  // Publish & Workload review modal state
  const [isPublishModalOpen, setIsPublishModalOpen] = useState<boolean>(false);
  const [reviewTab, setReviewTab] = useState<"faculty" | "subjects">("faculty");

  // Operation statuses
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<{
    type: "success" | "error";
    message: string;
    details?: Array<{ branchId: number; planId: number; status: string; versionNo: number }>;
    workloadSummary?: {
      totalSlots: number;
      totalHours: string;
      facultyCount: number;
      subjectsCount: number;
    };
  } | null>(null);

  // Resolve current active academic year strictly to current year with next year (e.g. 2026-2027)
  const currentAcademicYear = useMemo(() => {
    const calculated = getCurrentAcademicYearLabel();
    if (!masters) return calculated;

    // 1. Explicitly match the calculated current academic year in masters list
    const match = masters.academicYears.find((ay) => ay.label === calculated);
    if (match) return match.label;

    // 2. If defaults exists and does not exceed current calendar year, use it
    if (
      masters.defaults?.academicYear &&
      parseInt(masters.defaults.academicYear.slice(0, 4), 10) <= new Date().getFullYear()
    ) {
      return masters.defaults.academicYear;
    }

    // 3. Fall back to active flag in masters if not a future year
    const activeAy = masters.academicYears.find((ay) => ay.isActive)?.label;
    if (activeAy && parseInt(activeAy.slice(0, 4), 10) <= new Date().getFullYear()) {
      return activeAy;
    }

    return calculated;
  }, [masters]);

  // Auto-init college, academicYear, course from masters
  useEffect(() => {
    if (!masters) return;

    if (!collegeId && masters.colleges.length > 0) {
      const defaultCollege = masters.defaults.collegeId ?? masters.colleges[0].id;
      setCollegeId(defaultCollege);
    }

    if (currentAcademicYear && academicYear !== currentAcademicYear) {
      setAcademicYear(currentAcademicYear);
    }
  }, [masters, collegeId, currentAcademicYear, academicYear]);

  // Filter courses for selected college
  const coursesForCollege = useMemo(() => {
    if (!masters || !collegeId) return [];
    return masters.courses.filter((c) => c.collegeId === collegeId);
  }, [masters, collegeId]);

  // Auto-select first course when college changes
  useEffect(() => {
    if (coursesForCollege.length > 0) {
      if (!courseId || !coursesForCollege.some((c) => c.id === courseId)) {
        setCourseId(coursesForCollege[0].id);
      }
    } else {
      setCourseId(null);
    }
  }, [coursesForCollege, courseId]);

  // Selected course object
  const selectedCourse = useMemo(() => {
    return coursesForCollege.find((c) => c.id === courseId) ?? null;
  }, [coursesForCollege, courseId]);

  // Year options for course
  const yearOptions = useMemo(() => {
    if (selectedCourse?.yearOptions && selectedCourse.yearOptions.length > 0) {
      return selectedCourse.yearOptions;
    }
    const total = selectedCourse?.totalYears ?? 4;
    return Array.from({ length: total }, (_, i) => i + 1);
  }, [selectedCourse]);

  // Semesters for course
  const semesterOptions = useMemo(() => {
    if (selectedCourse?.yearSemesterConfig && selectedCourse.yearSemesterConfig.length > 0) {
      const config = selectedCourse.yearSemesterConfig.find((c) => c.year === year);
      const count = config?.semesters ?? selectedCourse.semestersPerYear ?? 2;
      return Array.from({ length: count }, (_, i) => i + 1);
    }
    const count = selectedCourse?.semestersPerYear ?? 2;
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [selectedCourse, year]);

  // All branches for course
  const branchesForCourse = useMemo(() => {
    if (!masters || !courseId) return [];
    return masters.branches.filter((b) => b.courseId === courseId);
  }, [masters, courseId]);

  // Selected branch objects helper
  const selectedBranches = useMemo(() => {
    return branchesForCourse.filter((b) => selectedBranchIds.includes(b.id));
  }, [branchesForCourse, selectedBranchIds]);

  // Detected sections across course
  const availableSectionsForCourse = useMemo(() => {
    const names = new Set<string>();
    for (const b of branchesOverview) {
      if (b.sections && Array.isArray(b.sections)) {
        for (const s of b.sections) {
          if (s && s.toLowerCase() !== "all") names.add(s);
        }
      }
    }
    if (masters?.sections && courseId) {
      const courseBranchIds = new Set(
        masters.branches.filter((b) => b.courseId === courseId).map((b) => b.id),
      );
      for (const s of masters.sections) {
        if (courseBranchIds.has(s.branchId) && s.name && s.name.toLowerCase() !== "all") {
          names.add(s.name);
        }
      }
    }
    const list = Array.from(names).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
    return list.length > 0 ? list : ["A", "B"];
  }, [branchesOverview, masters, courseId]);

  // Branch sections breakdown and validation for currently selected branches
  const branchSectionStatus = useMemo(() => {
    return selectedBranches.map((b) => {
      const bo = branchesOverview.find((o) => o.branchId === b.id);
      const boSections = bo?.sections && bo.sections.length > 0 ? bo.sections : null;
      const masterSections = masters?.sections
        ?.filter((s) => s.branchId === b.id)
        ?.map((s) => s.name) ?? [];
      const sections = boSections || masterSections;
      const hasSec = (bo?.hasSections ?? Boolean(b.hasSections)) && sections.length > 0;
      return {
        branchId: b.id,
        branchName: b.name,
        branchCode: b.code,
        hasSections: hasSec,
        sections,
        sectionCount: sections.length,
      };
    });
  }, [selectedBranches, branchesOverview, masters]);

  const anySelectedBranchHasSections = branchSectionStatus.some((b) => b.hasSections);

  // Effective sections callback for a branch
  const getEffectiveBranchSections = useCallback(
    (b: { branchId: number; hasSections: boolean; sections: string[] }) => {
      if (!b.hasSections) return [];
      const specific = branchSelectedSections[b.branchId];
      if (specific && specific.length > 0) {
        return specific;
      }
      return b.sections;
    },
    [branchSelectedSections]
  );

  const handleToggleBranchSection = (branchId: number, sec: string) => {
    setBranchSelectedSections((prev) => {
      const branchInfo = branchSectionStatus.find((b) => b.branchId === branchId);
      const allSecs = branchInfo?.sections ?? [];
      const current = prev[branchId] && prev[branchId].length > 0 ? prev[branchId] : allSecs;

      let next: string[];
      if (current.includes(sec)) {
        if (current.length <= 1) return prev; // Keep at least one section for this branch
        next = current.filter((s) => s !== sec);
      } else {
        next = [...current, sec].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      }
      return {
        ...prev,
        [branchId]: next,
      };
    });
  };

  // Section validation summary for save & live UI
  const sectionValidationSummary = useMemo(() => {
    if (!anySelectedBranchHasSections) {
      return {
        modeLabel: "Standard Branch Mode",
        description: "Standard branch schedules (no sections)",
        totalPlans: selectedBranches.length,
        branchPlans: selectedBranches.map((b) => ({
          branchId: b.id,
          branchName: b.code || b.name,
          sections: ["Full Branch (No Sections)"],
          rawSections: [] as string[],
        })),
        isWarning: false,
      };
    }

    let totalPlans = 0;
    const branchPlans = branchSectionStatus.map((b) => {
      if (!b.hasSections) {
        totalPlans += 1;
        return {
          branchId: b.branchId,
          branchName: b.branchCode || b.branchName,
          sections: ["Full Branch (No Sections)"],
          rawSections: [] as string[],
          note: "Branch has no sections configured",
        };
      }
      const effective = getEffectiveBranchSections(b);
      totalPlans += effective.length;
      const isPartial = effective.length < b.sections.length;
      const isOverridden = Boolean(branchSelectedSections[b.branchId]);
      return {
        branchId: b.branchId,
        branchName: b.branchCode || b.branchName,
        sections: effective.map((s) => `Section ${s}`),
        rawSections: effective,
        hasOverride: isOverridden,
        note: isPartial
          ? `Only Section(s) ${effective.join(", ")} selected`
          : undefined,
      };
    });

    const summaryList = branchPlans
      .filter((bp) => bp.rawSections.length > 0)
      .map((bp) => `${bp.branchName} (${bp.rawSections.join(", ")})`)
      .join(" + ");

    return {
      modeLabel: "Branch-Wise Sections",
      description: summaryList || "All active sections",
      totalPlans,
      branchPlans,
      isWarning: branchPlans.some((b) => Boolean(b.note)),
    };
  }, [anySelectedBranchHasSections, selectedBranches, branchSectionStatus, getEffectiveBranchSections, branchSelectedSections]);

  // Default select only the first branch; user will manually select additional branches
  useEffect(() => {
    if (branchesForCourse.length > 0) {
      const valid = selectedBranchIds.filter((id) => branchesForCourse.some((b) => b.id === id));
      if (valid.length === 0) {
        // Select only the first branch by default
        const initial = branchesForCourse.slice(0, 1).map((b) => b.id);
        setSelectedBranchIds(initial);
      } else {
        setSelectedBranchIds(valid);
      }
    } else {
      setSelectedBranchIds([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchesForCourse]);

  // Load faculty list once
  useEffect(() => {
    async function fetchFaculty() {
      try {
        const res = await apiFetch("/timetables/faculty", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          setFacultyList(json.data ?? []);
        }
      } catch (err) {
        console.warn("Could not load faculty list:", err);
      }
    }
    fetchFaculty();
  }, []);

  // Fetch branches overview & timing template
  const fetchOverview = useCallback(async () => {
    if (!collegeId || !courseId || !academicYear || semester == null) {
      return;
    }

    setLoadingOverview(true);
    setSaveStatus(null);
    try {
      const params = new URLSearchParams({
        collegeId: String(collegeId),
        courseId: String(courseId),
        academicYear,
        year: String(year),
        semester: String(semester),
      });
      if (Object.keys(branchSelectedSections).length > 0) {
        params.set("branchSections", JSON.stringify(branchSelectedSections));
      }
      if (selectedSections.length > 0) {
        params.set("sections", selectedSections.join(","));
        if (selectedSections.length === 1) {
          params.set("section", selectedSections[0]);
        }
      } else if (section && section !== "all") {
        params.set("section", section);
      }

      const res = await apiFetch(`/timetables/combined/overview?${params.toString()}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        setBranchesOverview(json.branches ?? []);
        if (json.timing) {
          setTimingTemplateName(json.timing.name ?? "Timing Template");
          setTimingSlots(json.timing.slots ?? []);
        } else {
          setTimingTemplateName("");
          setTimingSlots([]);
        }
      }
    } catch (err) {
      console.error("Failed to load combined branches overview:", err);
    } finally {
      setLoadingOverview(false);
    }
  }, [collegeId, courseId, academicYear, year, semester, section, selectedSections, branchSelectedSections]);

  // Trigger overview reload when filters change
  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // Fetch combined subjects whenever selectedBranchIds or context changes
  useEffect(() => {
    async function fetchSubjects() {
      if (!collegeId || !courseId || !academicYear || semester == null || selectedBranchIds.length === 0) {
        setSubjects([]);
        return;
      }

      setLoadingSubjects(true);
      try {
        const params = new URLSearchParams({
          collegeId: String(collegeId),
          courseId: String(courseId),
          academicYear,
          year: String(year),
          semester: String(semester),
          branchIds: selectedBranchIds.join(","),
        });

        const res = await apiFetch(`/timetables/combined/subjects?${params.toString()}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const json = await res.json();
          setSubjects(json.data ?? []);
        }
      } catch (err) {
        console.error("Failed to load combined subjects:", err);
      } finally {
        setLoadingSubjects(false);
      }
    }

    fetchSubjects();
  }, [collegeId, courseId, academicYear, year, semester, selectedBranchIds]);

  // Toggle single branch in checklist
  const handleToggleBranch = (branchId: number) => {
    setSelectedBranchIds((prev) => {
      if (prev.includes(branchId)) {
        if (prev.length <= 1) return prev; // keep at least 1
        return prev.filter((id) => id !== branchId);
      }
      return [...prev, branchId];
    });
  };

  // Select all / clear branches
  const handleSelectAllBranches = () => {
    setSelectedBranchIds(branchesForCourse.map((b) => b.id));
  };

  const handleSelectFirstTwoBranches = () => {
    setSelectedBranchIds(branchesForCourse.slice(0, 2).map((b) => b.id));
  };

  // Load schedule from an existing branch plan into the editor
  const handleLoadScheduleFromBranch = (branchOverview: BranchOverview) => {
    if (!branchOverview.plan || branchOverview.plan.entries.length === 0) return;

    const newAssignments: Record<string, LocalPeriodAssignment> = {};
    for (const entry of branchOverview.plan.entries) {
      const dayCode = (DAY_LABEL_TO_CODE[entry.dayOfWeek] ?? entry.dayOfWeek) as string;
      const key = `${dayCode}:${entry.timingSlotId}`;

      const existingAssignment = newAssignments[key];
      if (existingAssignment) {
        // Slot has parallel batch entries -> convert to split slot!
        newAssignments[key] = {
          ...existingAssignment,
          isSplit: true,
          batch1: existingAssignment.batch1 || {
            subjectId: existingAssignment.subjectId,
            subjectCode: existingAssignment.subjectCode,
            subjectName: existingAssignment.subjectName,
            entryType: existingAssignment.entryType,
            hrmsEmployeeId: existingAssignment.hrmsEmployeeId,
            facultyName: existingAssignment.facultyName,
            roomLabel: existingAssignment.roomLabel,
            batchLabel: existingAssignment.batchLabel || "Batch 1",
            studentIds: [],
            studentCount: 0,
          },
          batch2: {
            subjectId: entry.subjectId,
            subjectCode: entry.subjectCode ?? "",
            subjectName: entry.subjectName ?? "",
            entryType: (entry.entryType as "theory" | "lab" | "other") || "theory",
            hrmsEmployeeId: entry.facultyHrmsId ?? "",
            facultyName: entry.facultyName ?? "",
            roomLabel: entry.roomLabel ?? "",
            batchLabel: entry.batchLabel || "Batch 2",
            studentIds: [],
            studentCount: 0,
          },
        };
      } else {
        newAssignments[key] = {
          dayOfWeek: dayCode,
          timingSlotId: entry.timingSlotId,
          subjectId: entry.subjectId,
          subjectCode: entry.subjectCode ?? "",
          subjectName: entry.subjectName ?? "",
          entryType: (entry.entryType as "theory" | "lab" | "other") || "theory",
          hrmsEmployeeId: entry.facultyHrmsId ?? "",
          facultyName: entry.facultyName ?? "",
          roomLabel: entry.roomLabel ?? "",
          batchLabel: entry.batchLabel ?? "",
          customLabel: entry.customLabel ?? "",
        };
      }
    }

    setAssignments(newAssignments);
    setSaveStatus({
      type: "success",
      message: `Loaded ${branchOverview.plan.entries.length} period slots from ${branchOverview.branchName} into the combined timetable editor. You can now tweak or publish it to all checked branches!`,
    });
  };

  // Group timing slots by day of week
  const daysOfWeek = useMemo(() => {
    return [
      { code: "MON", label: "Monday" },
      { code: "TUE", label: "Tuesday" },
      { code: "WED", label: "Wednesday" },
      { code: "THUR", label: "Thursday" },
      { code: "FRI", label: "Friday" },
      { code: "SAT", label: "Saturday" },
    ];
  }, []);

  // Distinct period columns (by order / label)
  const periodColumns = useMemo(() => {
    const mondaySlots = timingSlots.filter(
      (s) => s.dayOfWeek === "MON" || s.dayLabel === "Monday",
    );
    if (mondaySlots.length > 0) return mondaySlots;

    // Fallback: unique by label/time
    const seen = new Set<string>();
    const cols: TimingSlot[] = [];
    for (const slot of timingSlots) {
      const key = `${slot.label}-${slot.startTime}`;
      if (!seen.has(key)) {
        seen.add(key);
        cols.push(slot);
      }
    }
    return cols;
  }, [timingSlots]);

  // Find slot for day and template period
  const getSlotForDay = useCallback(
    (dayCode: string, colSlot: TimingSlot): TimingSlot | null => {
      return (
        timingSlots.find(
          (s) =>
            (s.dayOfWeek === dayCode || s.dayLabel === DAY_CODE_TO_LABEL[dayCode as keyof typeof DAY_CODE_TO_LABEL]) &&
            s.label === colSlot.label &&
            s.startTime === colSlot.startTime,
        ) ?? null
      );
    },
    [timingSlots],
  );

  // Assign or remove slot in editor
  const handleSaveSlotAssignment = (assignment: LocalPeriodAssignment) => {
    const key = `${assignment.dayOfWeek}:${assignment.timingSlotId}`;
    setAssignments((prev) => ({
      ...prev,
      [key]: assignment,
    }));
    setActiveSlotModal(null);
  };

  const handleClearSlotAssignment = (dayOfWeek: string, timingSlotId: number) => {
    const key = `${dayOfWeek}:${timingSlotId}`;
    setAssignments((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setActiveSlotModal(null);
  };

  const handleClearAllAssignments = () => {
    if (Object.keys(assignments).length === 0) return;
    if (window.confirm("Are you sure you want to clear all assigned periods in this combined draft?")) {
      setAssignments({});
    }
  };

  // Total assigned class periods
  const totalAssignedCount = useMemo(() => {
    return Object.keys(assignments).length;
  }, [assignments]);

  // Fast slot lookup map for durations
  const timingSlotMap = useMemo(() => {
    const map = new Map<number, TimingSlot>();
    for (const slot of timingSlots) {
      map.set(slot.id, slot);
    }
    return map;
  }, [timingSlots]);

  // Aggregated Subjects Total Slots Summary
  const subjectSlotsSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        code: string;
        name: string;
        type: string;
        slotsCount: number;
        totalMinutes: number;
        facultySet: Set<string>;
      }
    >();

    const addSubjectSlot = (
      subjectId: number | null,
      subjectCode: string,
      subjectName: string,
      customLabel: string,
      entryType: string,
      facultyName: string,
      minutes: number,
    ) => {
      const key = subjectId
        ? `sub-${subjectId}`
        : `custom-${subjectCode || customLabel || "unlabeled"}`;
      const code = subjectCode || customLabel || "—";
      const name = subjectName || customLabel || "Period";
      const type = entryType;

      const existing = map.get(key);
      if (!existing) {
        const facultySet = new Set<string>();
        if (facultyName) facultySet.add(facultyName);
        map.set(key, {
          code,
          name,
          type,
          slotsCount: 1,
          totalMinutes: minutes,
          facultySet,
        });
      } else {
        existing.slotsCount += 1;
        existing.totalMinutes += minutes;
        if (facultyName) existing.facultySet.add(facultyName);
      }
    };

    for (const a of Object.values(assignments)) {
      const slot = timingSlotMap.get(a.timingSlotId);
      const minutes = calculateSlotDurationMinutes(slot);

      if (a.isSplit && a.batch1 && a.batch2) {
        addSubjectSlot(a.batch1.subjectId, a.batch1.subjectCode, a.batch1.subjectName, "", a.batch1.entryType, a.batch1.facultyName, minutes);
        addSubjectSlot(a.batch2.subjectId, a.batch2.subjectCode, a.batch2.subjectName, "", a.batch2.entryType, a.batch2.facultyName, minutes);
      } else {
        addSubjectSlot(a.subjectId, a.subjectCode, a.subjectName, a.customLabel, a.entryType, a.facultyName, minutes);
      }
    }

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        totalHours: formatMinutesToHours(item.totalMinutes),
        facultyNames: Array.from(item.facultySet),
      }))
      .sort((a, b) => b.slotsCount - a.slotsCount);
  }, [assignments, timingSlotMap]);

  // Aggregated Faculty Total Working Hours Summary
  const facultyWorkloadSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        hrmsId: string;
        name: string;
        department: string;
        designation: string;
        slotsCount: number;
        totalMinutes: number;
        subjectsSet: Set<string>;
        daysSet: Set<string>;
      }
    >();

    let unassignedSlots = 0;

    const addFacultyWorkload = (
      hrmsEmployeeId: string,
      facultyName: string,
      subjectCode: string,
      customLabel: string,
      dayOfWeek: string,
      minutes: number,
    ) => {
      if (!hrmsEmployeeId && !facultyName) {
        unassignedSlots += 1;
        return;
      }

      const key = hrmsEmployeeId || facultyName;
      const existing = map.get(key);
      const facultyOpt = facultyList.find((f) => f.hrmsEmployeeId === hrmsEmployeeId);

      if (!existing) {
        const subjectsSet = new Set<string>();
        if (subjectCode || customLabel) subjectsSet.add(subjectCode || customLabel);
        const daysSet = new Set<string>();
        if (dayOfWeek) {
          const dayName = DAY_CODE_TO_LABEL[dayOfWeek as keyof typeof DAY_CODE_TO_LABEL] || dayOfWeek;
          daysSet.add(dayName.slice(0, 3));
        }

        map.set(key, {
          hrmsId: hrmsEmployeeId || "—",
          name: facultyName || facultyOpt?.name || "Faculty",
          department: facultyOpt?.department || facultyOpt?.division || "—",
          designation: facultyOpt?.designation || "Faculty",
          slotsCount: 1,
          totalMinutes: minutes,
          subjectsSet,
          daysSet,
        });
      } else {
        existing.slotsCount += 1;
        existing.totalMinutes += minutes;
        if (subjectCode || customLabel) existing.subjectsSet.add(subjectCode || customLabel);
        if (dayOfWeek) {
          const dayName = DAY_CODE_TO_LABEL[dayOfWeek as keyof typeof DAY_CODE_TO_LABEL] || dayOfWeek;
          existing.daysSet.add(dayName.slice(0, 3));
        }
      }
    };

    for (const a of Object.values(assignments)) {
      const slot = timingSlotMap.get(a.timingSlotId);
      const minutes = calculateSlotDurationMinutes(slot);

      if (a.isSplit && a.batch1 && a.batch2) {
        addFacultyWorkload(a.batch1.hrmsEmployeeId, a.batch1.facultyName, a.batch1.subjectCode, "", a.dayOfWeek, minutes);
        addFacultyWorkload(a.batch2.hrmsEmployeeId, a.batch2.facultyName, a.batch2.subjectCode, "", a.dayOfWeek, minutes);
      } else {
        addFacultyWorkload(a.hrmsEmployeeId, a.facultyName, a.subjectCode, a.customLabel, a.dayOfWeek, minutes);
      }
    }

    const list = Array.from(map.values())
      .map((item) => ({
        ...item,
        totalHours: formatMinutesToHours(item.totalMinutes),
        subjectCodes: Array.from(item.subjectsSet),
        days: Array.from(item.daysSet),
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes);

    const totalMinutes = list.reduce((sum, f) => sum + f.totalMinutes, 0);

    return {
      list,
      unassignedSlots,
      totalFacultyMinutes: totalMinutes,
      totalFacultyHours: formatMinutesToHours(totalMinutes),
    };
  }, [assignments, timingSlotMap, facultyList]);

  // Open Publish Review & Workload Confirmation Modal
  const handleOpenPublishModal = () => {
    if (!collegeId || !courseId || !academicYear || semester == null) {
      setSaveStatus({
        type: "error",
        message: "Please ensure College, Course, Year of Study, and Semester are all selected.",
      });
      return;
    }

    if (selectedBranchIds.length === 0) {
      setSaveStatus({
        type: "error",
        message: "Please select at least one branch before publishing.",
      });
      return;
    }


    if (selectedBranchIds.length === 0) {
      setSaveStatus({
        type: "error",
        message: "Please select at least one branch in the checklist to apply the timetable to.",
      });
      return;
    }

    if (totalAssignedCount === 0) {
      setSaveStatus({
        type: "error",
        message: "No periods have been assigned yet. Please assign at least one period slot before publishing.",
      });
      return;
    }

    setIsPublishModalOpen(true);
  };

  // Execute Save or Publish
  const handleExecuteSave = async (publish: boolean) => {
    if (!collegeId || !courseId || !academicYear || semester == null) {
      setSaveStatus({
        type: "error",
        message: "Please ensure College, Course, Year of Study, and Semester are all selected.",
      });
      return;
    }

    if (selectedBranchIds.length === 0) {
      setSaveStatus({
        type: "error",
        message: "Please select at least one branch in the checklist to apply the timetable to.",
      });
      return;
    }

    const assignmentList = Object.values(assignments).flatMap((a) => {
      if (a.isSplit && a.batch1 && a.batch2) {
        return [
          {
            dayOfWeek: a.dayOfWeek,
            timingSlotId: a.timingSlotId,
            subjectId: a.batch1.subjectId,
            subjectCode: a.batch1.subjectCode,
            subjectName: a.batch1.subjectName,
            entryType: a.batch1.entryType,
            hrmsEmployeeId: a.batch1.hrmsEmployeeId || null,
            roomLabel: a.batch1.roomLabel || null,
            batchLabel: "Batch 1",
            customLabel: null,
            studentIds: a.batch1.studentIds,
            studentCount: a.batch1.studentIds.length,
            weeklyRotation: a.weeklyRotation,
            participatingBranchIds: a.participatingBranchIds,
          },
          {
            dayOfWeek: a.dayOfWeek,
            timingSlotId: a.timingSlotId,
            subjectId: a.batch2.subjectId,
            subjectCode: a.batch2.subjectCode,
            subjectName: a.batch2.subjectName,
            entryType: a.batch2.entryType,
            hrmsEmployeeId: a.batch2.hrmsEmployeeId || null,
            roomLabel: a.batch2.roomLabel || null,
            batchLabel: "Batch 2",
            customLabel: null,
            studentIds: a.batch2.studentIds,
            studentCount: a.batch2.studentIds.length,
            weeklyRotation: a.weeklyRotation,
            participatingBranchIds: a.participatingBranchIds,
          },
        ];
      }
      return [
        {
          dayOfWeek: a.dayOfWeek,
          timingSlotId: a.timingSlotId,
          subjectId: a.subjectId,
          subjectCode: a.subjectCode,
          subjectName: a.subjectName,
          entryType: a.entryType,
          hrmsEmployeeId: a.hrmsEmployeeId || null,
          roomLabel: a.roomLabel || null,
          batchLabel: a.batchLabel || "",
          customLabel: a.customLabel || null,
          participatingBranchIds: a.participatingBranchIds,
        },
      ];
    });

    if (assignmentList.length === 0) {
      setSaveStatus({
        type: "error",
        message: "No periods have been assigned yet. Please assign at least one period slot before saving.",
      });
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);

    try {
      const res = await apiFetch("/timetables/combined/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collegeId,
          courseId,
          branchIds: selectedBranchIds,
          academicYear,
          year,
          semester,
          section: selectedSections.length === 1 ? selectedSections[0] : (section && section !== "all" ? section : null),
          sections: selectedSections.length > 0 ? selectedSections : (section && section !== "all" ? [section] : null),
          sectionMode,
          branchSections: Object.keys(branchSelectedSections).length > 0 ? branchSelectedSections : null,
          notes: `Combined timetable across ${selectedBranchIds.length} branches (${selectedBranches.map((b) => b.code || b.name).join(", ")}) [${sectionValidationSummary.description}]`,
          assignments: assignmentList,
          publish,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to save combined timetable.");
      }

      setSaveStatus({
        type: "success",
        message: data.message || `Successfully ${publish ? "published" : "saved"} combined timetable for ${selectedBranchIds.length} branches!`,
        details: data.results,
        workloadSummary: {
          totalSlots: totalAssignedCount,
          totalHours: facultyWorkloadSummary.totalFacultyHours,
          facultyCount: facultyWorkloadSummary.list.length,
          subjectsCount: subjectSlotsSummary.length,
        },
      });

      if (publish) {
        setIsPublishModalOpen(false);
      }

      // Refresh overview
      fetchOverview();
    } catch (err) {
      setSaveStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Error saving combined timetable",
      });
    } finally {
      setIsSaving(false);
    }
  };



  return (
    <div className="space-y-6 pb-20">
      {/* STEP 1: Academic & College Scope Filter Bar */}
      <Card className="border-border/80 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-3.5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            <Building2 className="h-4 w-4 text-indigo-600" />
            <span>Step 1: Academic Scope & College Selection</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchOverview}
            disabled={loadingOverview}
            className="h-7 text-xs gap-1.5 text-slate-600 hover:text-indigo-600"
          >
            <RefreshCw className={cn("h-3 w-3", loadingOverview && "animate-spin")} />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* College */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 uppercase mb-1 block">
              College
            </label>
            <select
              value={collegeId ?? ""}
              onChange={(e) => setCollegeId(Number(e.target.value))}
              disabled={mastersLoading || !masters}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-navy-950 focus:border-indigo-600 focus:outline-none"
            >
              {masters?.colleges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Course */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 uppercase mb-1 block">
              Course
            </label>
            <select
              value={courseId ?? ""}
              onChange={(e) => setCourseId(Number(e.target.value))}
              disabled={mastersLoading || coursesForCollege.length === 0}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-navy-950 focus:border-indigo-600 focus:outline-none"
            >
              {coursesForCollege.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Current Academic Year (Read-only Default Display) */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 uppercase mb-1 block">
              Current Academic Year
            </label>
            <div className="flex h-9 w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50/90 px-3 text-xs font-semibold text-navy-950">
              <span className="flex items-center gap-1.5 font-bold">
                <Calendar className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                {currentAcademicYear || academicYear || "Loading…"}
              </span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                Active
              </span>
            </div>
          </div>

          {/* Year of Study */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 uppercase mb-1 block">
              Year of Study
            </label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-navy-950 focus:border-indigo-600 focus:outline-none"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  Year {y}
                </option>
              ))}
            </select>
          </div>

          {/* Semester */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 uppercase mb-1 block">
              Semester
            </label>
            <select
              value={semester}
              onChange={(e) => setSemester(Number(e.target.value))}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-navy-950 focus:border-indigo-600 focus:outline-none"
            >
              {semesterOptions.map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {timingTemplateName ? (
          <div className="mt-3.5 flex items-center justify-between rounded-lg border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-indigo-600" />
              <span>
                Active Timing: <strong className="text-navy-900">{timingTemplateName}</strong> ({timingSlots.length} slot definitions)
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              Applicable to all branches in this semester
            </span>
          </div>
        ) : (
          <div className="mt-3.5 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>No active timing template found for this college and semester. Please configure one in Timing Templates.</span>
          </div>
        )}
      </Card>

      {/* STEP 2: Branch Combination Checklist Card */}
      <Card className="border-border/80 bg-white p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white text-[11px] font-bold">
              2
            </span>
            <h3 className="text-sm sm:text-base font-bold text-navy-900">
              Branch Combinations Checklist
            </h3>
            <span className="hidden sm:inline text-xs text-slate-300">•</span>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-900 border border-indigo-100">
              <Layers3 className="h-3 w-3 text-indigo-600" />
              <span>
                {selectedBranchIds.length} of {branchesForCourse.length} Selected:
              </span>
              <span className="font-bold text-indigo-700">
                {selectedBranches.map((b) => b.code || b.name).join(" + ") || "None"}
              </span>
            </div>
            {sectionValidationSummary.totalPlans > 0 && (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-900 border border-purple-200">
                <span className="font-bold">{sectionValidationSummary.totalPlans} Plan{sectionValidationSummary.totalPlans === 1 ? "" : "s"}</span>
                <span className="text-purple-400">•</span>
                <span className="text-purple-700 font-medium">{sectionValidationSummary.description}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSelectAllBranches}
              disabled={branchesForCourse.length === 0}
              className="text-xs h-7.5 gap-1.5"
            >
              <CheckSquare className="h-3.5 w-3.5 text-indigo-600" />
              Select All
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSelectFirstTwoBranches}
              disabled={branchesForCourse.length < 2}
              className="text-xs h-7.5"
            >
              First 2
            </Button>
          </div>
        </div>

        {/* All Branches Inline List */}
        <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
          {branchesForCourse.length === 0 ? (
            <div className="text-xs text-slate-500 py-1 italic">
              No branches found for the selected course.
            </div>
          ) : (
            branchesForCourse.map((branch) => {
              const isChecked = selectedBranchIds.includes(branch.id);
              const overview = branchesOverview.find((b) => b.branchId === branch.id);
              const plan = overview?.plan;

              return (
                <div
                  key={branch.id}
                  onClick={() => handleToggleBranch(branch.id)}
                  className={cn(
                    "group relative inline-flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs transition-all cursor-pointer select-none",
                    isChecked
                      ? "border-indigo-600 bg-indigo-50/70 shadow-xs ring-1 ring-indigo-600/30 text-navy-950 font-semibold"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700",
                  )}
                >
                  {/* Checkbox */}
                  <div className="shrink-0 text-indigo-600">
                    {isChecked ? (
                      <CheckSquare className="h-4 w-4 text-indigo-600" />
                    ) : (
                      <Square className="h-4 w-4 text-slate-300 group-hover:text-slate-400" />
                    )}
                  </div>

                  {/* Branch Code & Name */}
                  <div className="flex items-center gap-1.5">
                    {branch.code && (
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                          isChecked
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-100 text-slate-700",
                        )}
                      >
                        {branch.code}
                      </span>
                    )}
                    <span className="font-bold leading-tight">
                      {branch.name}
                    </span>
                    {overview?.hasSections && overview.sections && overview.sections.length > 0 ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="rounded bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.2 text-[9.5px] font-bold">
                          {overview.sections.length} sec ({overview.sections.join(",")})
                        </span>
                        {isChecked && (
                          <div
                            className="flex items-center gap-1 bg-white/90 border border-purple-200 rounded-md px-1 py-0.5 shadow-2xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="text-[9.5px] font-bold text-slate-500 uppercase">Sec:</span>
                            {overview.sections.map((sec) => {
                              const effSecs = getEffectiveBranchSections({
                                branchId: branch.id,
                                hasSections: true,
                                sections: overview.sections!,
                              });
                              const isSecActive = effSecs.includes(sec);
                              return (
                                <button
                                  key={sec}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleBranchSection(branch.id, sec);
                                  }}
                                  className={cn(
                                    "px-1.5 py-0.2 rounded text-[10px] font-bold border transition-colors cursor-pointer",
                                    isSecActive
                                      ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                                      : "bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300"
                                  )}
                                  title={`Toggle Section ${sec} for ${branch.code || branch.name}`}
                                >
                                  {sec}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : branch.hasSections ? (
                      <span className="rounded bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.2 text-[9.5px] font-bold">
                        Has sec
                      </span>
                    ) : null}
                  </div>

                  {/* Status Indicator */}
                  <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                    {plan ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          plan.status === "published"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800",
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            plan.status === "published" ? "bg-emerald-600" : "bg-amber-600",
                          )}
                        />
                        {plan.assignedCount} periods
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-medium">
                        No timetable
                      </span>
                    )}

                    {/* Load Schedule button */}
                    {plan && plan.assignedCount > 0 && (
                      <button
                        type="button"
                        title={`Load existing ${branch.code || branch.name} schedule (${plan.assignedCount} periods) into editor`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (overview) handleLoadScheduleFromBranch(overview);
                        }}
                        className="inline-flex items-center gap-1 rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200 shadow-2xs hover:bg-indigo-50 hover:border-indigo-300 cursor-pointer ml-0.5"
                      >
                        <Copy className="h-2.5 w-2.5" />
                        Load
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Save / Error Feedback Banner */}
      {saveStatus && (
        <div
          className={cn(
            "flex items-start gap-3 rounded-xl border p-4 text-xs font-medium animate-in fade-in",
            saveStatus.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900",
          )}
        >
          {saveStatus.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 space-y-1.5">
            <div className="font-bold text-sm leading-tight">{saveStatus.message}</div>
            {saveStatus.workloadSummary && (
              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-semibold text-emerald-800">
                <span className="rounded bg-emerald-100 px-2 py-0.5 border border-emerald-200">
                  {saveStatus.workloadSummary.totalSlots} Slots Assigned
                </span>
                <span className="rounded bg-emerald-100 px-2 py-0.5 border border-emerald-200">
                  {saveStatus.workloadSummary.totalHours} Faculty Teaching Workload
                </span>
                <span className="rounded bg-emerald-100 px-2 py-0.5 border border-emerald-200">
                  {saveStatus.workloadSummary.subjectsCount} Subjects Covered
                </span>
                <span className="rounded bg-emerald-100 px-2 py-0.5 border border-emerald-200">
                  {saveStatus.workloadSummary.facultyCount} Faculty Deployed
                </span>
              </div>
            )}
            {saveStatus.details && saveStatus.details.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2 pt-1">
                {saveStatus.details.map((d, idx) => {
                  const bName = branchesForCourse.find((b) => b.id === d.branchId)?.name ?? `Branch ${d.branchId}`;
                  const dAny = d as any;
                  return (
                    <span
                      key={`${d.branchId}-${dAny.section || "none"}-${idx}`}
                      className="rounded-md border border-emerald-300 bg-emerald-100/80 px-2 py-0.5 text-[11px] font-semibold text-emerald-950"
                    >
                      ✓ {bName}{dAny.section ? ` (Section ${dAny.section})` : ""}: Plan #{d.planId} ({d.status} v{d.versionNo})
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSaveStatus(null)}
            className="text-slate-400 hover:text-slate-600 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* STEP 3: Unified Combined Timetable Editor Grid */}
      <Card className="border-border/80 bg-white p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white text-[11px] font-bold">
                3
              </span>
              <h3 className="text-sm sm:text-base font-bold text-navy-900">
                Combined Schedule Matrix (Weekly Planner Grid)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Click any period slot below to assign or customize the common subject, faculty, and room.
            </p>
          </div>

          {/* Quick Actions & Save Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-600 px-2 py-1 bg-slate-100 rounded-md">
              {totalAssignedCount} periods assigned
            </span>

            {totalAssignedCount > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleClearAllAssignments}
                className="text-xs text-red-600 hover:text-red-700 h-8 gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}

            {totalAssignedCount > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsPublishModalOpen(true)}
                className="text-xs h-8 gap-1.5"
                title="View faculty working hours and subject slots breakdown"
              >
                <Clock className="h-3.5 w-3.5 text-indigo-600" />
                Workload & Slots
              </Button>
            )}

            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleExecuteSave(false)}
              disabled={isSaving || totalAssignedCount === 0}
              className="text-xs font-semibold h-8"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Save Draft for {selectedBranchIds.length} Branches
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenPublishModal}
              disabled={isSaving || totalAssignedCount === 0}
              className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white h-8 gap-1.5 shadow-xs"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Publish to All {selectedBranchIds.length} Branches
            </Button>
          </div>
        </div>

        {/* Interactive Timetable Grid Table */}
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
          <table className="w-full min-w-[850px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/80 text-navy-950">
                <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[11px] w-28 border-r border-slate-200">
                  Day / Period
                </th>
                {periodColumns.map((col, idx) => {
                  const isBreak = isNonClassTimingSlot(col);
                  return (
                    <th
                      key={col.id || idx}
                      className={cn(
                        "py-2.5 px-3 font-bold border-r border-slate-200 text-center last:border-r-0",
                        isBreak ? "bg-slate-200/50 text-slate-500" : "bg-slate-100/90 text-navy-900",
                      )}
                    >
                      <div className="text-xs font-bold leading-tight">{col.label}</div>
                      <div className="text-[10px] font-normal text-slate-500 mt-0.5">
                        {col.startTime?.slice(0, 5)} - {col.endTime?.slice(0, 5)}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {daysOfWeek.map(({ code: dayCode, label: dayLabel }) => (
                <tr key={dayCode} className="hover:bg-slate-50/50 transition-colors">
                  {/* Day Label */}
                  <td className="py-2.5 px-3 font-bold text-navy-900 bg-slate-50/70 border-r border-slate-200">
                    <div>{dayLabel}</div>
                    <div className="text-[10px] font-semibold text-slate-400">{dayCode}</div>
                  </td>

                  {/* Period Slot Cells */}
                  {periodColumns.map((col, idx) => {
                    const slot = getSlotForDay(dayCode, col);
                    const isBreak = !slot || isNonClassTimingSlot(slot);

                    if (isBreak) {
                      return (
                        <td
                          key={col.id || idx}
                          className="py-2 px-1 text-center bg-slate-100/40 border-r border-slate-200 text-slate-400 text-[10px] select-none font-medium"
                        >
                          {timingSlotDisplayLabel(col)}
                        </td>
                      );
                    }

                    const key = `${dayCode}:${slot.id}`;
                    const assignment = assignments[key];

                    return (
                      <td
                        key={slot.id}
                        className="p-1 border-r border-slate-200 last:border-r-0 align-top h-20 min-w-[130px]"
                      >
                        {assignment ? (
                          assignment.isSplit && assignment.batch1 && assignment.batch2 ? (
                            <div
                              onClick={() =>
                                setActiveSlotModal({
                                  day: dayCode,
                                  slot,
                                  current: assignment,
                                })
                              }
                              className="h-full min-h-[95px] rounded-lg p-1.5 border border-indigo-200 bg-white hover:border-indigo-400 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between gap-1 group"
                            >
                              {/* Batch 1 mini card */}
                              <div className="rounded border border-indigo-100 bg-indigo-50/80 p-1.5">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="rounded bg-indigo-200 px-1 py-0.2 text-[8px] font-bold text-indigo-950 uppercase tracking-wider">
                                    B1
                                  </span>
                                  <span className="font-bold text-[10px] text-navy-950 truncate max-w-[65px]" title={assignment.batch1.subjectName}>
                                    {assignment.batch1.subjectCode || "Lab 1"}
                                  </span>
                                  <span className="text-[9px] font-bold text-indigo-700 bg-white px-1 rounded shadow-2xs">
                                    {assignment.batch1.studentCount}s
                                  </span>
                                </div>
                                <div className="mt-0.5 flex items-center justify-between text-[9px] text-slate-500">
                                  <span className="truncate max-w-[60px]" title={assignment.batch1.facultyName}>
                                    {assignment.batch1.facultyName || "—"}
                                  </span>
                                  {assignment.batch1.roomLabel && (
                                    <span className="truncate max-w-[40px] font-medium text-slate-700">
                                      {assignment.batch1.roomLabel}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Batch 2 mini card */}
                              <div className="rounded border border-emerald-100 bg-emerald-50/80 p-1.5">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="rounded bg-emerald-200 px-1 py-0.2 text-[8px] font-bold text-emerald-950 uppercase tracking-wider">
                                    B2
                                  </span>
                                  <span className="font-bold text-[10px] text-navy-950 truncate max-w-[65px]" title={assignment.batch2.subjectName}>
                                    {assignment.batch2.subjectCode || "Lab 2"}
                                  </span>
                                  <span className="text-[9px] font-bold text-emerald-700 bg-white px-1 rounded shadow-2xs">
                                    {assignment.batch2.studentCount}s
                                  </span>
                                </div>
                                <div className="mt-0.5 flex items-center justify-between text-[9px] text-slate-500">
                                  <span className="truncate max-w-[60px]" title={assignment.batch2.facultyName}>
                                    {assignment.batch2.facultyName || "—"}
                                  </span>
                                  {assignment.batch2.roomLabel && (
                                    <span className="truncate max-w-[40px] font-medium text-slate-700">
                                      {assignment.batch2.roomLabel}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() =>
                                setActiveSlotModal({
                                  day: dayCode,
                                  slot,
                                  current: assignment,
                                })
                              }
                              className={cn(
                                "h-full rounded-lg p-2 border transition-all cursor-pointer flex flex-col justify-between group",
                                assignment.entryType === "lab"
                                  ? "border-amber-200 bg-amber-50/70 hover:bg-amber-100/60"
                                  : assignment.entryType === "other"
                                    ? "border-purple-200 bg-purple-50/70 hover:bg-purple-100/60"
                                    : "border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100/60",
                              )}
                            >
                              <div>
                                <div className="flex items-center justify-between gap-1 mb-1">
                                  <span className="font-bold text-[11px] text-navy-950 truncate max-w-[90px]">
                                    {assignment.customLabel || assignment.subjectCode}
                                  </span>
                                  <span
                                    className={cn(
                                      "rounded px-1 text-[9px] font-bold uppercase",
                                      assignment.entryType === "lab"
                                        ? "bg-amber-200 text-amber-900"
                                        : assignment.entryType === "other"
                                          ? "bg-purple-200 text-purple-900"
                                          : "bg-indigo-200 text-indigo-900",
                                    )}
                                  >
                                    {assignment.entryType}
                                  </span>
                                </div>

                                <p className="text-[10px] text-slate-700 font-medium line-clamp-1">
                                  {assignment.subjectName || assignment.customLabel}
                                </p>
                              </div>

                              <div className="mt-1 pt-1 border-t border-slate-200/50 flex items-center justify-between text-[10px] text-slate-500">
                                <span className="truncate max-w-[70px]" title={assignment.facultyName}>
                                  {assignment.facultyName || "No faculty"}
                                </span>
                                {assignment.roomLabel && (
                                  <span className="font-semibold text-slate-700 truncate max-w-[40px]">
                                    {assignment.roomLabel}
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setActiveSlotModal({
                                day: dayCode,
                                slot,
                              })
                            }
                            className="w-full h-full min-h-[70px] rounded-lg border border-dashed border-slate-200 bg-white/60 hover:bg-indigo-50/50 hover:border-indigo-300 text-slate-400 hover:text-indigo-600 flex flex-col items-center justify-center transition-all cursor-pointer group"
                          >
                            <Plus className="h-4 w-4 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                            <span className="text-[10px] font-medium mt-0.5">Assign</span>
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Period Assignment Modal */}
      {activeSlotModal && (
        <PeriodEditModal
          isOpen={Boolean(activeSlotModal)}
          onClose={() => setActiveSlotModal(null)}
          dayCode={activeSlotModal.day}
          slot={activeSlotModal.slot}
          existing={activeSlotModal.current}
          subjects={subjects}
          facultyList={facultyList}
          availableBranches={selectedBranches}
          collegeId={collegeId}
          courseId={courseId}
          academicYear={currentAcademicYear || academicYear}
          year={year}
          semester={semester}
          selectedSections={selectedSections}
          branchSections={branchSelectedSections}
          section={section}
          onSave={handleSaveSlotAssignment}
          onClear={() => handleClearSlotAssignment(activeSlotModal.day, activeSlotModal.slot.id)}
        />
      )}

      {/* Publish & Workload Review Modal */}
      {isPublishModalOpen && (
        <PublishReviewModal
          isOpen={isPublishModalOpen}
          onClose={() => setIsPublishModalOpen(false)}
          onConfirmPublish={() => handleExecuteSave(true)}
          isSaving={isSaving}
          totalAssignedCount={totalAssignedCount}
          selectedBranches={selectedBranches}
          collegeName={masters?.colleges.find((c) => c.id === collegeId)?.name || "College"}
          courseName={selectedCourse?.name || "Course"}
          year={year}
          semester={semester}
          academicYear={currentAcademicYear || academicYear}
          reviewTab={reviewTab}
          onTabChange={setReviewTab}
          subjectSlotsSummary={subjectSlotsSummary}
          facultyWorkloadSummary={facultyWorkloadSummary}
          sectionValidationSummary={sectionValidationSummary}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Period Assignment Modal Sub-Component
// ----------------------------------------------------------------------

type PeriodEditModalProps = {
  isOpen: boolean;
  onClose: () => void;
  dayCode: string;
  slot: TimingSlot;
  existing?: LocalPeriodAssignment;
  subjects: CombinedSubject[];
  facultyList: FacultyOption[];
  availableBranches: Array<{ id: number; name: string; code: string | null }>;
  collegeId: number | null;
  courseId: number | null;
  academicYear: string;
  year: number | null;
  semester: number | null;
  selectedSections?: string[];
  branchSections?: Record<number, string[]>;
  section?: string;
  onSave: (assignment: LocalPeriodAssignment) => void;
  onClear: () => void;
};

function PeriodEditModal({
  isOpen,
  onClose,
  dayCode,
  slot,
  existing,
  subjects,
  facultyList,
  availableBranches,
  collegeId,
  courseId,
  academicYear,
  year,
  semester,
  selectedSections,
  branchSections,
  section,
  onSave,
  onClear,
}: PeriodEditModalProps) {
  // Wizard Step: 1 = Configuration & Branches, 2 = Student Selection (when split)
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Split Slot Toggle
  const [isSplit, setIsSplit] = useState<boolean>(existing?.isSplit ?? false);
  const [weeklyRotation, setWeeklyRotation] = useState<boolean>(existing?.weeklyRotation ?? false);

  // Participating Branches for this slot (by default, all available branches in combined draft)
  const [participatingBranchIds, setParticipatingBranchIds] = useState<number[]>(
    existing?.participatingBranchIds && existing.participatingBranchIds.length > 0
      ? existing.participatingBranchIds
      : availableBranches.map((b) => b.id),
  );

  // Single Slot Configuration (when isSplit is false)
  const [mode, setMode] = useState<"subject" | "special">(
    existing?.entryType === "other" && existing.customLabel ? "special" : "subject",
  );
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(existing?.subjectId ?? null);
  const [entryType, setEntryType] = useState<"theory" | "lab" | "other">(existing?.entryType ?? "theory");
  const [facultyHrmsId, setFacultyHrmsId] = useState<string>(existing?.hrmsEmployeeId ?? "");
  const [roomLabel, setRoomLabel] = useState<string>(existing?.roomLabel ?? "");
  const [customLabel, setCustomLabel] = useState<string>(existing?.customLabel ?? "");
  const [facultySearch, setFacultySearch] = useState<string>("");

  // Batch 1 Configuration (when isSplit is true)
  const [b1SubjectId, setB1SubjectId] = useState<number | null>(
    existing?.batch1?.subjectId ?? existing?.subjectId ?? (subjects[0]?.id ?? null),
  );
  const [b1EntryType, setB1EntryType] = useState<"theory" | "lab" | "other">(
    existing?.batch1?.entryType ?? (existing?.entryType === "lab" ? "lab" : "lab"),
  );
  const [b1FacultyHrmsId, setB1FacultyHrmsId] = useState<string>(
    existing?.batch1?.hrmsEmployeeId ?? existing?.hrmsEmployeeId ?? "",
  );
  const [b1RoomLabel, setB1RoomLabel] = useState<string>(
    existing?.batch1?.roomLabel ?? existing?.roomLabel ?? "",
  );
  const [b1FacultySearch, setB1FacultySearch] = useState<string>("");

  // Batch 2 Configuration (when isSplit is true)
  const [b2SubjectId, setB2SubjectId] = useState<number | null>(
    existing?.batch2?.subjectId ?? (subjects[1]?.id ?? subjects[0]?.id ?? null),
  );
  const [b2EntryType, setB2EntryType] = useState<"theory" | "lab" | "other">(
    existing?.batch2?.entryType ?? "lab",
  );
  const [b2FacultyHrmsId, setB2FacultyHrmsId] = useState<string>(
    existing?.batch2?.hrmsEmployeeId ?? "",
  );
  const [b2RoomLabel, setB2RoomLabel] = useState<string>(
    existing?.batch2?.roomLabel ?? "",
  );
  const [b2FacultySearch, setB2FacultySearch] = useState<string>("");

  const b1Sub = useMemo(() => subjects.find((s) => s.id === b1SubjectId), [subjects, b1SubjectId]);
  const b2Sub = useMemo(() => subjects.find((s) => s.id === b2SubjectId), [subjects, b2SubjectId]);

  // Step 2: Student Roster & Allocation State
  const [students, setStudents] = useState<StudentRosterItem[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [studentBatchMap, setStudentBatchMap] = useState<Record<number, "Batch 1" | "Batch 2" | null>>({});

  // Individual Branch PIN Dropdown States for Batch 1 and Batch 2
  const [b1BranchPins, setB1BranchPins] = useState<Record<number, { fromPin: string; toPin: string }>>({});
  const [b2BranchPins, setB2BranchPins] = useState<Record<number, { fromPin: string; toPin: string }>>({});

  // Filter / Search for Individual Student List
  const [studentSearch, setStudentSearch] = useState<string>("");
  const [studentBranchFilter, setStudentBranchFilter] = useState<number | "all">("all");
  const [studentTabFilter, setStudentTabFilter] = useState<"all" | "Batch 1" | "Batch 2" | "unassigned">("all");

  // Participating branches list helper
  const participatingBranchesList = useMemo(() => {
    return availableBranches.filter((b) => participatingBranchIds.includes(b.id));
  }, [availableBranches, participatingBranchIds]);

  // Grouped students per participating branch (sorted by PIN)
  const branchesWithStudents = useMemo(() => {
    return participatingBranchesList.map((b) => {
      const bStudents = students
        .filter((s) => s.branch_id === b.id)
        .sort((a, b) => (a.pin_no || "").localeCompare(b.pin_no || ""));
      return {
        branch: b,
        students: bStudents,
      };
    });
  }, [participatingBranchesList, students]);

  // Sync initial and updated From/To PIN defaults for each branch in both batches
  useEffect(() => {
    if (students.length === 0) return;

    setB1BranchPins((prev) => {
      const next = { ...prev };
      participatingBranchesList.forEach((b) => {
        const bStudents = students
          .filter((s) => s.branch_id === b.id)
          .sort((a, b) => (a.pin_no || "").localeCompare(b.pin_no || ""));
        if (bStudents.length > 0) {
          const curFrom = next[b.id]?.fromPin;
          const curTo = next[b.id]?.toPin;
          const hasFrom = bStudents.some((s) => s.pin_no === curFrom);
          const hasTo = bStudents.some((s) => s.pin_no === curTo);
          next[b.id] = {
            fromPin: hasFrom && curFrom ? curFrom : bStudents[0]?.pin_no || "",
            toPin: hasTo && curTo ? curTo : bStudents[bStudents.length - 1]?.pin_no || "",
          };
        }
      });
      return next;
    });

    setB2BranchPins((prev) => {
      const next = { ...prev };
      participatingBranchesList.forEach((b) => {
        const bStudents = students
          .filter((s) => s.branch_id === b.id)
          .sort((a, b) => (a.pin_no || "").localeCompare(b.pin_no || ""));
        if (bStudents.length > 0) {
          const curFrom = next[b.id]?.fromPin;
          const curTo = next[b.id]?.toPin;
          const hasFrom = bStudents.some((s) => s.pin_no === curFrom);
          const hasTo = bStudents.some((s) => s.pin_no === curTo);
          next[b.id] = {
            fromPin: hasFrom && curFrom ? curFrom : bStudents[0]?.pin_no || "",
            toPin: hasTo && curTo ? curTo : bStudents[bStudents.length - 1]?.pin_no || "",
          };
        }
      });
      return next;
    });
  }, [students, participatingBranchesList]);

  // Initialize from existing assignment on mount/change
  useEffect(() => {
    if (existing) {
      setIsSplit(Boolean(existing.isSplit));
      setWeeklyRotation(Boolean(existing.weeklyRotation));
      if (existing.participatingBranchIds && existing.participatingBranchIds.length > 0) {
        setParticipatingBranchIds(existing.participatingBranchIds);
      } else {
        setParticipatingBranchIds(availableBranches.map((b) => b.id));
      }

      // Single slot
      setSelectedSubjectId(existing.subjectId);
      setEntryType(existing.entryType);
      setFacultyHrmsId(existing.hrmsEmployeeId);
      setRoomLabel(existing.roomLabel);
      setCustomLabel(existing.customLabel);
      setMode(existing.entryType === "other" && existing.customLabel ? "special" : "subject");

      // Batch 1
      if (existing.batch1) {
        setB1SubjectId(existing.batch1.subjectId);
        setB1EntryType(existing.batch1.entryType);
        setB1FacultyHrmsId(existing.batch1.hrmsEmployeeId);
        setB1RoomLabel(existing.batch1.roomLabel);
      } else {
        setB1SubjectId(existing.subjectId);
        setB1EntryType(existing.entryType);
        setB1FacultyHrmsId(existing.hrmsEmployeeId);
        setB1RoomLabel(existing.roomLabel);
      }

      // Batch 2
      if (existing.batch2) {
        setB2SubjectId(existing.batch2.subjectId);
        setB2EntryType(existing.batch2.entryType);
        setB2FacultyHrmsId(existing.batch2.hrmsEmployeeId);
        setB2RoomLabel(existing.batch2.roomLabel);
      }

      // Initialize batch map if students were assigned
      const initialMap: Record<number, "Batch 1" | "Batch 2" | null> = {};
      if (existing.batch1?.studentIds) {
        for (const sid of existing.batch1.studentIds) {
          initialMap[sid] = "Batch 1";
        }
      }
      if (existing.batch2?.studentIds) {
        for (const sid of existing.batch2.studentIds) {
          initialMap[sid] = "Batch 2";
        }
      }
      setStudentBatchMap(initialMap);
    } else {
      // Default initialization
      setIsSplit(false);
      setCurrentStep(1);
      setParticipatingBranchIds(availableBranches.map((b) => b.id));
      if (subjects.length > 0) {
        setSelectedSubjectId(subjects[0].id);
        setB1SubjectId(subjects[0].id);
        setB2SubjectId(subjects[1]?.id ?? subjects[0].id);
      }
      setStudentBatchMap({});
    }
  }, [existing, subjects, availableBranches]);

  // Fetch Student Roster for Participating Branches
  const loadStudentRoster = useCallback(async () => {
    if (!collegeId || !courseId || semester == null || participatingBranchIds.length === 0) {
      setStudents([]);
      return;
    }

    setIsLoadingStudents(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({
        collegeId: String(collegeId),
        courseId: String(courseId),
        branchIds: participatingBranchIds.join(","),
        semester: String(semester),
      });
      if (year != null) params.set("year", String(year));
      if (academicYear) params.set("academicYear", academicYear);
      if (branchSections && Object.keys(branchSections).length > 0) {
        params.set("branchSections", JSON.stringify(branchSections));
      }
      const secParam =
        selectedSections && selectedSections.length > 0
          ? selectedSections.join(",")
          : section && section !== "all"
          ? section
          : "";
      if (secParam) {
        params.set("section", secParam);
      }

      const res = await apiFetch(`/timetables/roster?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to load student roster");
      }
      const json = await res.json();
      const list: StudentRosterItem[] = json.data ?? [];
      setStudents(list);
    } catch (err) {
      console.error("Error loading roster:", err);
      setFetchError((err as Error).message || "Could not fetch student roster.");
    } finally {
      setIsLoadingStudents(false);
    }
  }, [collegeId, courseId, semester, year, academicYear, participatingBranchIds, selectedSections, branchSections, section]);

  // Handle advancing to Step 2
  const handleProceedToStep2 = async () => {
    if (participatingBranchIds.length === 0) {
      alert("Please select at least one participating branch for this split slot.");
      return;
    }
    if (!b1SubjectId) {
      alert("Please select a subject for Batch 1.");
      return;
    }
    if (!b2SubjectId) {
      alert("Please select a subject for Batch 2.");
      return;
    }

    // Load roster and switch step
    await loadStudentRoster();
    setCurrentStep(2);
  };

  // Branch participation toggle
  const toggleParticipatingBranch = (bId: number) => {
    setParticipatingBranchIds((prev) => {
      if (prev.includes(bId)) {
        if (prev.length <= 1) return prev; // keep at least 1 branch
        return prev.filter((id) => id !== bId);
      }
      return [...prev, bId];
    });
  };

  // Filter faculty lists
  const filteredSingleFaculty = facultyList.filter(
    (f) =>
      !facultySearch ||
      f.name.toLowerCase().includes(facultySearch.toLowerCase()) ||
      f.department.toLowerCase().includes(facultySearch.toLowerCase()) ||
      f.hrmsEmployeeId.toLowerCase().includes(facultySearch.toLowerCase()),
  );

  const filteredB1Faculty = facultyList.filter(
    (f) =>
      !b1FacultySearch ||
      f.name.toLowerCase().includes(b1FacultySearch.toLowerCase()) ||
      f.department.toLowerCase().includes(b1FacultySearch.toLowerCase()) ||
      f.hrmsEmployeeId.toLowerCase().includes(b1FacultySearch.toLowerCase()),
  );

  const filteredB2Faculty = facultyList.filter(
    (f) =>
      !b2FacultySearch ||
      f.name.toLowerCase().includes(b2FacultySearch.toLowerCase()) ||
      f.department.toLowerCase().includes(b2FacultySearch.toLowerCase()) ||
      f.hrmsEmployeeId.toLowerCase().includes(b2FacultySearch.toLowerCase()),
  );

  // Computed student counts
  const countBatch1 = useMemo(
    () => students.filter((s) => studentBatchMap[s.id] === "Batch 1").length,
    [students, studentBatchMap],
  );
  const countBatch2 = useMemo(
    () => students.filter((s) => studentBatchMap[s.id] === "Batch 2").length,
    [students, studentBatchMap],
  );
  const countUnassigned = useMemo(
    () => students.filter((s) => !studentBatchMap[s.id]).length,
    [students, studentBatchMap],
  );

  // Quick Action: 50 / 50 Split
  const handleSplit5050 = () => {
    if (students.length === 0) return;
    const sorted = [...students].sort((a, b) => (a.pin_no || "").localeCompare(b.pin_no || ""));
    const half = Math.ceil(sorted.length / 2);
    const newMap: Record<number, "Batch 1" | "Batch 2" | null> = { ...studentBatchMap };

    sorted.forEach((student, idx) => {
      newMap[student.id] = idx < half ? "Batch 1" : "Batch 2";
    });

    setStudentBatchMap(newMap);
  };

  // Quick Action: Odd / Even Split by PIN
  const handleSplitOddEven = () => {
    if (students.length === 0) return;
    const sorted = [...students].sort((a, b) => (a.pin_no || "").localeCompare(b.pin_no || ""));
    const newMap: Record<number, "Batch 1" | "Batch 2" | null> = { ...studentBatchMap };

    sorted.forEach((student, idx) => {
      const match = (student.pin_no || "").match(/\d+$/);
      const numVal = match ? parseInt(match[0], 10) : idx + 1;
      newMap[student.id] = numVal % 2 === 1 ? "Batch 1" : "Batch 2";
    });

    setStudentBatchMap(newMap);
  };

  // Quick Action: Assign All to a batch
  const handleAssignAllToBatch = (target: "Batch 1" | "Batch 2") => {
    const newMap: Record<number, "Batch 1" | "Batch 2" | null> = { ...studentBatchMap };
    students.forEach((s) => {
      newMap[s.id] = target;
    });
    setStudentBatchMap(newMap);
  };

  // Quick Action: Clear all
  const handleClearAllStudentBatches = () => {
    const newMap: Record<number, "Batch 1" | "Batch 2" | null> = { ...studentBatchMap };
    students.forEach((s) => {
      newMap[s.id] = null;
    });
    setStudentBatchMap(newMap);
  };

  // Quick action: Assign all students of a branch to a batch
  const handleAssignBranchToBatch = (bId: number | "all", target: "Batch 1" | "Batch 2") => {
    const newMap: Record<number, "Batch 1" | "Batch 2" | null> = { ...studentBatchMap };
    students.forEach((s) => {
      if (bId === "all" || s.branch_id === bId) {
        newMap[s.id] = target;
      }
    });
    setStudentBatchMap(newMap);
  };

  // Quick action: 50/50 split within a branch
  const handleSplitBranch5050 = (bId: number | "all") => {
    const list = (bId === "all" ? students : students.filter((s) => s.branch_id === bId)).sort(
      (a, b) => (a.pin_no || "").localeCompare(b.pin_no || ""),
    );
    const half = Math.ceil(list.length / 2);
    const newMap: Record<number, "Batch 1" | "Batch 2" | null> = { ...studentBatchMap };
    list.forEach((s, idx) => {
      newMap[s.id] = idx < half ? "Batch 1" : "Batch 2";
    });
    setStudentBatchMap(newMap);
  };

  // Batch 1: Apply PIN Range for a specific branch
  const handleApplyB1BranchRange = (branchId: number) => {
    const pinConfig = b1BranchPins[branchId];
    const bStudents = students
      .filter((s) => s.branch_id === branchId)
      .sort((a, b) => (a.pin_no || "").localeCompare(b.pin_no || ""));

    if (!pinConfig?.fromPin || !pinConfig?.toPin) {
      alert("Please select both 'From PIN' and 'To PIN' for this branch.");
      return;
    }

    const fromIdx = bStudents.findIndex((s) => s.pin_no === pinConfig.fromPin);
    const toIdx = bStudents.findIndex((s) => s.pin_no === pinConfig.toPin);

    if (fromIdx === -1 || toIdx === -1) {
      alert("Selected PINs not found in this branch.");
      return;
    }

    const start = Math.min(fromIdx, toIdx);
    const end = Math.max(fromIdx, toIdx);
    const selectedSlice = bStudents.slice(start, end + 1);

    const newMap: Record<number, "Batch 1" | "Batch 2" | null> = { ...studentBatchMap };
    selectedSlice.forEach((s) => {
      newMap[s.id] = "Batch 1";
    });

    setStudentBatchMap(newMap);
  };

  // Batch 2: Apply PIN Range for a specific branch
  const handleApplyB2BranchRange = (branchId: number) => {
    const pinConfig = b2BranchPins[branchId];
    const bStudents = students
      .filter((s) => s.branch_id === branchId)
      .sort((a, b) => (a.pin_no || "").localeCompare(b.pin_no || ""));

    if (!pinConfig?.fromPin || !pinConfig?.toPin) {
      alert("Please select both 'From PIN' and 'To PIN' for this branch.");
      return;
    }

    const fromIdx = bStudents.findIndex((s) => s.pin_no === pinConfig.fromPin);
    const toIdx = bStudents.findIndex((s) => s.pin_no === pinConfig.toPin);

    if (fromIdx === -1 || toIdx === -1) {
      alert("Selected PINs not found in this branch.");
      return;
    }

    const start = Math.min(fromIdx, toIdx);
    const end = Math.max(fromIdx, toIdx);
    const selectedSlice = bStudents.slice(start, end + 1);

    const newMap: Record<number, "Batch 1" | "Batch 2" | null> = { ...studentBatchMap };
    selectedSlice.forEach((s) => {
      newMap[s.id] = "Batch 2";
    });

    setStudentBatchMap(newMap);
  };

  // Individual Student Toggle
  const handleToggleStudent = (studentId: number, target: "Batch 1" | "Batch 2") => {
    setStudentBatchMap((prev) => {
      const current = prev[studentId];
      return {
        ...prev,
        [studentId]: current === target ? null : target,
      };
    });
  };

  // Filtered Students List for Individual Selection
  const filteredStudents = useMemo(() => {
    let list = [...students];

    // Branch filter
    if (studentBranchFilter !== "all") {
      list = list.filter((s) => s.branch_id === studentBranchFilter);
    }

    // Tab filter
    if (studentTabFilter === "Batch 1") {
      list = list.filter((s) => studentBatchMap[s.id] === "Batch 1");
    } else if (studentTabFilter === "Batch 2") {
      list = list.filter((s) => studentBatchMap[s.id] === "Batch 2");
    } else if (studentTabFilter === "unassigned") {
      list = list.filter((s) => !studentBatchMap[s.id]);
    }

    // Search query
    if (studentSearch.trim()) {
      const q = studentSearch.trim().toLowerCase();
      list = list.filter(
        (s) =>
          (s.pin_no && s.pin_no.toLowerCase().includes(q)) ||
          (s.student_name && s.student_name.toLowerCase().includes(q)) ||
          (s.admission_number && s.admission_number.toLowerCase().includes(q)) ||
          (s.branch_name && s.branch_name.toLowerCase().includes(q)),
      );
    }

    // Sorted by PIN
    return list.sort((a, b) => (a.pin_no || "").localeCompare(b.pin_no || ""));
  }, [students, studentBatchMap, studentBranchFilter, studentTabFilter, studentSearch]);

  // Apply Single Slot
  const handleApplySingle = () => {
    if (participatingBranchIds.length === 0) {
      alert("Please select at least one participating branch.");
      return;
    }

    const currentSubject = subjects.find((s) => s.id === selectedSubjectId);

    if (mode === "subject") {
      if (!selectedSubjectId && !currentSubject) {
        alert("Please select a subject.");
        return;
      }
      const chosenFaculty = facultyList.find((f) => f.hrmsEmployeeId === facultyHrmsId);

      onSave({
        dayOfWeek: dayCode,
        timingSlotId: slot.id,
        subjectId: currentSubject?.id ?? null,
        subjectCode: currentSubject?.code ?? "",
        subjectName: currentSubject?.name ?? "",
        entryType,
        hrmsEmployeeId: facultyHrmsId,
        facultyName: chosenFaculty?.name ?? "",
        roomLabel,
        batchLabel: "",
        customLabel: "",
        participatingBranchIds,
        isSplit: false,
      });
    } else {
      if (!customLabel.trim()) {
        alert("Please enter or select a label for this special period.");
        return;
      }
      const chosenFaculty = facultyList.find((f) => f.hrmsEmployeeId === facultyHrmsId);

      onSave({
        dayOfWeek: dayCode,
        timingSlotId: slot.id,
        subjectId: null,
        subjectCode: customLabel,
        subjectName: customLabel,
        entryType: "other",
        hrmsEmployeeId: facultyHrmsId,
        facultyName: chosenFaculty?.name ?? "",
        roomLabel,
        batchLabel: "",
        customLabel,
        participatingBranchIds,
        isSplit: false,
      });
    }
  };

  // Apply Split Slot (from Step 2)
  const handleApplySplit = () => {
    const b1StudentIds = students.filter((s) => studentBatchMap[s.id] === "Batch 1").map((s) => s.id);
    const b2StudentIds = students.filter((s) => studentBatchMap[s.id] === "Batch 2").map((s) => s.id);

    if (b1StudentIds.length === 0 && b2StudentIds.length === 0) {
      if (!window.confirm("No students have been allocated to Batch 1 or Batch 2 yet. Do you still want to apply this split slot?")) {
        return;
      }
    }

    const b1Fac = facultyList.find((f) => f.hrmsEmployeeId === b1FacultyHrmsId);
    const b2Fac = facultyList.find((f) => f.hrmsEmployeeId === b2FacultyHrmsId);

    onSave({
      dayOfWeek: dayCode,
      timingSlotId: slot.id,
      subjectId: b1Sub?.id ?? null,
      subjectCode: b1Sub?.code ?? "",
      subjectName: b1Sub?.name ?? "",
      entryType: b1EntryType,
      hrmsEmployeeId: b1FacultyHrmsId,
      facultyName: b1Fac?.name ?? "",
      roomLabel: b1RoomLabel,
      batchLabel: "Batch 1",
      customLabel: "",
      isSplit: true,
      weeklyRotation,
      participatingBranchIds,
      batch1: {
        subjectId: b1Sub?.id ?? null,
        subjectCode: b1Sub?.code ?? "",
        subjectName: b1Sub?.name ?? "",
        entryType: b1EntryType,
        hrmsEmployeeId: b1FacultyHrmsId,
        facultyName: b1Fac?.name ?? "",
        roomLabel: b1RoomLabel,
        batchLabel: "Batch 1",
        studentIds: b1StudentIds,
        studentCount: b1StudentIds.length,
      },
      batch2: {
        subjectId: b2Sub?.id ?? null,
        subjectCode: b2Sub?.code ?? "",
        subjectName: b2Sub?.name ?? "",
        entryType: b2EntryType,
        hrmsEmployeeId: b2FacultyHrmsId,
        facultyName: b2Fac?.name ?? "",
        roomLabel: b2RoomLabel,
        batchLabel: "Batch 2",
        studentIds: b2StudentIds,
        studentCount: b2StudentIds.length,
      },
    });
  };

  if (!isOpen) return null;

  const dayLabel = DAY_CODE_TO_LABEL[dayCode as keyof typeof DAY_CODE_TO_LABEL] ?? dayCode;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-navy-950/60 backdrop-blur-xs transition-opacity"
        aria-label="Close dialog"
        onClick={onClose}
      />

      {/* Modal Dialog Container */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150 transition-all",
          currentStep === 1 ? (isSplit ? "max-w-3xl" : "max-w-xl") : "max-w-4xl",
        )}
      >
        {/* Header */}
        <div className="border-b border-border bg-gradient-to-r from-indigo-50/90 via-white to-purple-50/50 px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-navy-950">
                  Assign Period: {slot.label}
                </h3>
                {isSplit && (
                  <span className="rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 border border-indigo-200">
                    Parallel Split Slot
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {dayLabel} • {slot.startTime?.slice(0, 5)} - {slot.endTime?.slice(0, 5)} • {participatingBranchIds.length} branches selected
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* 2-Step Wizard Stepper (shown when split is enabled) */}
          {isSplit && (
            <div className="mt-3.5 flex items-center gap-2 pt-2 border-t border-slate-200/60 text-xs">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer",
                  currentStep === 1
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                )}
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">
                  1
                </span>
                Step 1: Split & Branches Setup
              </button>

              <ArrowRight className="h-3.5 w-3.5 text-slate-400" />

              <button
                type="button"
                onClick={handleProceedToStep2}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer",
                  currentStep === 2
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                )}
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">
                  2
                </span>
                Step 2: Students Selection (Range / Individual)
              </button>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 max-h-[72vh] overflow-y-auto space-y-4">
          {currentStep === 1 ? (
            /* ================= STEP 1: CONFIGURATION & BRANCHES ================= */
            <>
              {/* Split Slot Toggle Banner */}
              <div
                onClick={() => {
                  const nextSplit = !isSplit;
                  setIsSplit(nextSplit);
                  if (!nextSplit) setCurrentStep(1);
                }}
                className={cn(
                  "flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer",
                  isSplit
                    ? "bg-indigo-50/80 border-indigo-300 ring-1 ring-indigo-500/20"
                    : "bg-slate-50 border-slate-200 hover:bg-slate-100/70",
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg font-bold text-xs",
                      isSplit ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600",
                    )}
                  >
                    <GitFork className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-navy-950 flex items-center gap-2">
                      Split Slot Option (Batch 1 & Batch 2 Parallel Labs)
                      {isSplit && (
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.2 rounded">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Divide this period into two parallel batches (e.g. Lab A & Lab B) with student group selection.
                    </p>
                  </div>
                </div>

                <div className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none">
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      isSplit ? "translate-x-5 bg-indigo-600" : "translate-x-0 bg-slate-300",
                    )}
                  />
                </div>
              </div>

              {/* Participating Branches Checklist */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-indigo-600" />
                    Participating Branches for this Slot ({participatingBranchIds.length}/{availableBranches.length})
                  </label>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setParticipatingBranchIds(availableBranches.map((b) => b.id))}
                      className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (availableBranches.length > 0) setParticipatingBranchIds([availableBranches[0].id]);
                      }}
                      className="text-slate-500 hover:text-slate-700 cursor-pointer"
                    >
                      Keep 1st
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {availableBranches.map((branch) => {
                    const isChecked = participatingBranchIds.includes(branch.id);
                    return (
                      <div
                        key={branch.id}
                        onClick={() => toggleParticipatingBranch(branch.id)}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-all",
                          isChecked
                            ? "bg-white border-indigo-300 text-navy-950 font-semibold shadow-2xs"
                            : "bg-slate-100/60 border-slate-200 text-slate-500 hover:bg-white",
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                            isChecked ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300 bg-white",
                          )}
                        >
                          {isChecked && <Check className="h-3 w-3" />}
                        </div>
                        <div className="truncate flex-1">
                          <span className="font-bold text-[11px] text-indigo-900 mr-1.5">
                            {branch.code || branch.name}
                          </span>
                          <span className="text-[11px] text-slate-600 font-normal truncate">
                            {branch.name}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {!isSplit ? (
                /* SINGLE PERIOD CONFIGURATION */
                <div className="space-y-4 pt-1">
                  {/* Mode Switcher */}
                  <div className="flex rounded-lg bg-slate-200/70 p-1 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setMode("subject")}
                      className={cn(
                        "flex-1 py-1.5 rounded-md transition-all cursor-pointer",
                        mode === "subject"
                          ? "bg-white text-indigo-900 shadow-2xs font-bold"
                          : "text-slate-600 hover:text-slate-900",
                      )}
                    >
                      Curriculum Subject / Lab
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("special")}
                      className={cn(
                        "flex-1 py-1.5 rounded-md transition-all cursor-pointer",
                        mode === "special"
                          ? "bg-white text-indigo-900 shadow-2xs font-bold"
                          : "text-slate-600 hover:text-slate-900",
                      )}
                    >
                      Special / Activity (CRT, Library)
                    </button>
                  </div>

                  {mode === "subject" ? (
                    <>
                      {/* Subject Selection */}
                      <div>
                        <label className="text-xs font-bold text-slate-700 uppercase mb-1.5 block">
                          Select Subject
                        </label>
                        <select
                          value={selectedSubjectId ?? ""}
                          onChange={(e) => {
                            const id = Number(e.target.value);
                            setSelectedSubjectId(id);
                            const sub = subjects.find((s) => s.id === id);
                            if (sub && sub.type?.toLowerCase().includes("lab")) {
                              setEntryType("lab");
                            } else {
                              setEntryType("theory");
                            }
                          }}
                          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-navy-950 focus:border-indigo-600 focus:outline-none"
                        >
                          {subjects.map((sub) => (
                            <option key={sub.id} value={sub.id}>
                              {sub.code}: {sub.name} {sub.isCommon ? "★ (Common)" : ""}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Entry Type */}
                      <div>
                        <label className="text-xs font-bold text-slate-700 uppercase mb-1.5 block">
                          Period Type
                        </label>
                        <div className="flex gap-2">
                          {(["theory", "lab", "other"] as const).map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setEntryType(t)}
                              className={cn(
                                "flex-1 py-1.5 rounded-lg border text-xs font-semibold capitalize transition-all cursor-pointer",
                                entryType === t
                                  ? "border-indigo-600 bg-indigo-50 text-indigo-950 ring-1 ring-indigo-600/20 font-bold"
                                  : "border-slate-200 text-slate-600 hover:bg-slate-50",
                              )}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase mb-1.5 block">
                        Activity / Special Period Label
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. CRT, Library, Games, Mentoring..."
                        value={customLabel}
                        onChange={(e) => setCustomLabel(e.target.value)}
                        className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-navy-950 focus:border-indigo-600 focus:outline-none"
                      />
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {SPECIAL_PERIOD_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setCustomLabel(preset)}
                            className={cn(
                              "rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors cursor-pointer",
                              customLabel === preset
                                ? "border-purple-600 bg-purple-100 text-purple-950 font-bold"
                                : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100",
                            )}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Faculty Selector */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-700 uppercase">
                        Assigned Faculty
                      </label>
                      <div className="relative w-40">
                        <input
                          type="text"
                          placeholder="Search faculty..."
                          value={facultySearch}
                          onChange={(e) => setFacultySearch(e.target.value)}
                          className="w-full h-7 rounded border border-slate-200 bg-white pl-2 pr-5 text-[11px] focus:outline-none focus:border-indigo-600"
                        />
                        <Search className="h-3 w-3 text-slate-400 absolute right-1.5 top-2 pointer-events-none" />
                      </div>
                    </div>

                    <select
                      value={facultyHrmsId}
                      onChange={(e) => setFacultyHrmsId(e.target.value)}
                      className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-navy-950 focus:border-indigo-600 focus:outline-none"
                    >
                      <option value="">-- No Faculty / Unassigned --</option>
                      {filteredSingleFaculty.map((f) => (
                        <option key={f.hrmsEmployeeId} value={f.hrmsEmployeeId}>
                          {f.name} ({f.designation || f.department || f.hrmsEmployeeId})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Room / Location */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase mb-1.5 block">
                      Room / Lab / Location
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Room 301, ECE Lab, Seminar Hall"
                      value={roomLabel}
                      onChange={(e) => setRoomLabel(e.target.value)}
                      className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-navy-950 focus:border-indigo-600 focus:outline-none"
                    />
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {ROOM_SUGGESTIONS.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRoomLabel(r)}
                          className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] text-slate-600 hover:bg-slate-100 cursor-pointer"
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* SPLIT PERIOD CONFIGURATION (BATCH 1 & BATCH 2) */
                <div className="space-y-4 pt-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* BATCH 1 CARD */}
                    <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3.5 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-indigo-100">
                        <span className="rounded bg-indigo-600 text-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                          Batch 1 (Slot A)
                        </span>
                        <span className="text-[11px] font-semibold text-indigo-900">
                          Parallel Session 1
                        </span>
                      </div>

                      {/* Subject */}
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 uppercase mb-1 block">
                          Batch 1 Subject
                        </label>
                        <select
                          value={b1SubjectId ?? ""}
                          onChange={(e) => {
                            const id = Number(e.target.value);
                            setB1SubjectId(id);
                            const sub = subjects.find((s) => s.id === id);
                            if (sub && sub.type?.toLowerCase().includes("lab")) {
                              setB1EntryType("lab");
                            }
                          }}
                          className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-navy-950 focus:border-indigo-600 focus:outline-none"
                        >
                          {subjects.map((sub) => (
                            <option key={sub.id} value={sub.id}>
                              {sub.code}: {sub.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Entry Type */}
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 uppercase mb-1 block">
                          Period Type
                        </label>
                        <div className="flex gap-1.5">
                          {(["lab", "theory", "other"] as const).map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setB1EntryType(t)}
                              className={cn(
                                "flex-1 py-1 rounded border text-[11px] font-semibold capitalize cursor-pointer",
                                b1EntryType === t
                                  ? "border-indigo-600 bg-indigo-600 text-white font-bold"
                                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                              )}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Faculty */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-bold text-slate-700 uppercase">
                            Faculty
                          </label>
                          <input
                            type="text"
                            placeholder="Filter..."
                            value={b1FacultySearch}
                            onChange={(e) => setB1FacultySearch(e.target.value)}
                            className="w-24 h-5 rounded border border-slate-200 bg-white px-1.5 text-[10px]"
                          />
                        </div>
                        <select
                          value={b1FacultyHrmsId}
                          onChange={(e) => setB1FacultyHrmsId(e.target.value)}
                          className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-navy-950 focus:border-indigo-600 focus:outline-none"
                        >
                          <option value="">-- Unassigned --</option>
                          {filteredB1Faculty.map((f) => (
                            <option key={f.hrmsEmployeeId} value={f.hrmsEmployeeId}>
                              {f.name} ({f.department || f.hrmsEmployeeId})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Room */}
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 uppercase mb-1 block">
                          Lab / Room
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. CSE Lab 1"
                          value={b1RoomLabel}
                          onChange={(e) => setB1RoomLabel(e.target.value)}
                          className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-navy-950 focus:border-indigo-600 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* BATCH 2 CARD */}
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-emerald-100">
                        <span className="rounded bg-emerald-600 text-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                          Batch 2 (Slot B)
                        </span>
                        <span className="text-[11px] font-semibold text-emerald-900">
                          Parallel Session 2
                        </span>
                      </div>

                      {/* Subject */}
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 uppercase mb-1 block">
                          Batch 2 Subject
                        </label>
                        <select
                          value={b2SubjectId ?? ""}
                          onChange={(e) => {
                            const id = Number(e.target.value);
                            setB2SubjectId(id);
                            const sub = subjects.find((s) => s.id === id);
                            if (sub && sub.type?.toLowerCase().includes("lab")) {
                              setB2EntryType("lab");
                            }
                          }}
                          className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-navy-950 focus:border-emerald-600 focus:outline-none"
                        >
                          {subjects.map((sub) => (
                            <option key={sub.id} value={sub.id}>
                              {sub.code}: {sub.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Entry Type */}
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 uppercase mb-1 block">
                          Period Type
                        </label>
                        <div className="flex gap-1.5">
                          {(["lab", "theory", "other"] as const).map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setB2EntryType(t)}
                              className={cn(
                                "flex-1 py-1 rounded border text-[11px] font-semibold capitalize cursor-pointer",
                                b2EntryType === t
                                  ? "border-emerald-600 bg-emerald-600 text-white font-bold"
                                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                              )}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Faculty */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-bold text-slate-700 uppercase">
                            Faculty
                          </label>
                          <input
                            type="text"
                            placeholder="Filter..."
                            value={b2FacultySearch}
                            onChange={(e) => setB2FacultySearch(e.target.value)}
                            className="w-24 h-5 rounded border border-slate-200 bg-white px-1.5 text-[10px]"
                          />
                        </div>
                        <select
                          value={b2FacultyHrmsId}
                          onChange={(e) => setB2FacultyHrmsId(e.target.value)}
                          className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-navy-950 focus:border-emerald-600 focus:outline-none"
                        >
                          <option value="">-- Unassigned --</option>
                          {filteredB2Faculty.map((f) => (
                            <option key={f.hrmsEmployeeId} value={f.hrmsEmployeeId}>
                              {f.name} ({f.department || f.hrmsEmployeeId})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Room */}
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 uppercase mb-1 block">
                          Lab / Room
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. ECE Lab"
                          value={b2RoomLabel}
                          onChange={(e) => setB2RoomLabel(e.target.value)}
                          className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-navy-950 focus:border-emerald-600 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Weekly Rotation Option */}
                  <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={weeklyRotation}
                      onChange={(e) => setWeeklyRotation(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>
                      Rotate Batches Weekly (Batch 1 & Batch 2 alternate lab subjects each week)
                    </span>
                  </label>
                </div>
              )}
            </>
          ) : (
            /* ================= STEP 2: STUDENTS SELECTION (RANGE & INDIVIDUAL) ================= */
            <div className="space-y-4">
              {/* Top Status & Allocation Counters */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-100/80 border border-slate-200">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-indigo-600" />
                  <span className="text-xs font-bold text-navy-950">
                    Student Roster Allocation
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap text-xs font-bold">
                  <span className="rounded-md bg-white border border-slate-200 px-2 py-1 text-slate-700">
                    Total: {students.length}
                  </span>
                  <span className="rounded-md bg-indigo-100 border border-indigo-200 px-2 py-1 text-indigo-900">
                    Batch 1: {countBatch1}
                  </span>
                  <span className="rounded-md bg-emerald-100 border border-emerald-200 px-2 py-1 text-emerald-900">
                    Batch 2: {countBatch2}
                  </span>
                  <span
                    className={cn(
                      "rounded-md px-2 py-1 border",
                      countUnassigned > 0
                        ? "bg-amber-100 border-amber-300 text-amber-900"
                        : "bg-slate-200/60 border-slate-200 text-slate-500",
                    )}
                  >
                    Unassigned: {countUnassigned}
                  </span>
                </div>
              </div>

              {/* Range & Quick Selection Controls (Multi-Branch Aware) */}
              <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/50 via-white to-slate-50/50 p-4 space-y-3.5 shadow-2xs">
                {/* Header & Global Quick Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-indigo-100/80">
                  <span className="text-xs font-bold text-navy-950 flex items-center gap-1.5 uppercase tracking-wider">
                    <Sliders className="h-3.5 w-3.5 text-indigo-600" />
                    Multi-Branch PIN & Range Tools
                  </span>

                  {/* Global Quick Action Helpers */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={handleSplit5050}
                      className="rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 text-[11px] font-bold text-indigo-900 cursor-pointer shadow-2xs transition-all"
                      title="Evenly divide all students 50% to Batch 1 and 50% to Batch 2"
                    >
                      ⚡ Split All 50/50
                    </button>
                    <button
                      type="button"
                      onClick={handleSplitOddEven}
                      className="rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 text-[11px] font-bold text-purple-900 cursor-pointer shadow-2xs transition-all"
                      title="Assign Odd Roll Numbers to Batch 1 and Even to Batch 2"
                    >
                      🔢 Odd / Even PIN
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAssignAllToBatch("Batch 1")}
                      className="rounded-lg border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 cursor-pointer shadow-2xs transition-all"
                    >
                      All → B1
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAssignAllToBatch("Batch 2")}
                      className="rounded-lg border border-slate-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 cursor-pointer shadow-2xs transition-all"
                    >
                      All → B2
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAllStudentBatches}
                      className="rounded-lg border border-slate-200 bg-white hover:bg-red-50 hover:text-red-600 px-2.5 py-1 text-[11px] font-semibold text-slate-600 cursor-pointer shadow-2xs transition-all"
                    >
                      Reset All
                    </button>
                  </div>
                </div>

                {/* Individual Batch PIN Range Allocation Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs items-start">
                  {/* BATCH 1 CARD */}
                  <div className="rounded-xl border border-indigo-200 bg-white p-3.5 space-y-3 shadow-2xs">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-indigo-100">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-indigo-600 text-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                          Batch 1 (Slot A)
                        </span>
                        <span className="font-bold text-xs text-navy-950 truncate max-w-[160px]" title={b1Sub?.name || ""}>
                          {b1Sub?.code ? `${b1Sub.code}: ${b1Sub.name}` : b1Sub?.name || "Batch 1 Subject"}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5">
                        {countBatch1} assigned
                      </span>
                    </div>

                    {/* Branches List for Batch 1 */}
                    <div className="space-y-3 max-h-[460px] overflow-y-auto pr-0.5">
                      {branchesWithStudents.map(({ branch, students: bStudents }) => {
                        const b1AssignedCount = bStudents.filter((s) => studentBatchMap[s.id] === "Batch 1").length;
                        const pinConfig = b1BranchPins[branch.id] || {
                          fromPin: bStudents[0]?.pin_no || "",
                          toPin: bStudents[bStudents.length - 1]?.pin_no || "",
                        };

                        return (
                          <div
                            key={branch.id}
                            className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 space-y-2.5 shadow-2xs hover:border-indigo-200 transition-colors"
                          >
                            {/* Branch Title & Quick Actions */}
                            <div className="flex items-center justify-between gap-1.5 flex-wrap pb-1.5 border-b border-indigo-100/70">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Building2 className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                                <span className="font-bold text-xs text-navy-950 truncate">
                                  {branch.code ? branch.code : branch.name}
                                </span>
                                <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap">
                                  ({bStudents.length} students)
                                </span>
                              </div>

                              <div className="flex items-center gap-1">
                                <span className="text-[10px] font-bold text-indigo-800 bg-white border border-indigo-200 px-1.5 py-0.5 rounded">
                                  {b1AssignedCount} in B1
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleAssignBranchToBatch(branch.id, "Batch 1")}
                                  className="rounded border border-indigo-200 bg-white hover:bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.5 text-[10px] cursor-pointer"
                                  title={`Assign all ${branch.code || branch.name} students to Batch 1`}
                                >
                                  All → B1
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSplitBranch5050(branch.id)}
                                  className="rounded border border-purple-200 bg-white hover:bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 text-[10px] cursor-pointer"
                                  title={`Split ${branch.code || branch.name} students 50/50 between B1 & B2`}
                                >
                                  50/50
                                </button>
                              </div>
                            </div>

                            {bStudents.length === 0 ? (
                              <p className="text-[11px] text-slate-400 italic py-1">No students registered in this branch.</p>
                            ) : (
                              <>
                                {/* From PIN and To PIN dropdowns */}
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-[9.5px] font-bold text-slate-500 uppercase block mb-0.5">
                                      From PIN Dropdown
                                    </label>
                                    <select
                                      value={pinConfig.fromPin}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setB1BranchPins((prev) => ({
                                          ...prev,
                                          [branch.id]: {
                                            fromPin: val,
                                            toPin: prev[branch.id]?.toPin || bStudents[bStudents.length - 1]?.pin_no || "",
                                          },
                                        }));
                                      }}
                                      className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-mono font-semibold text-navy-950 focus:border-indigo-600 focus:outline-none"
                                    >
                                      {bStudents.map((st, i) => (
                                        <option key={st.id} value={st.pin_no || ""}>
                                          #{i + 1}: {st.pin_no || st.admission_number} {st.student_name ? `- ${st.student_name.slice(0, 14)}` : ""}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="text-[9.5px] font-bold text-slate-500 uppercase block mb-0.5">
                                      To PIN Dropdown
                                    </label>
                                    <select
                                      value={pinConfig.toPin}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setB1BranchPins((prev) => ({
                                          ...prev,
                                          [branch.id]: {
                                            fromPin: prev[branch.id]?.fromPin || bStudents[0]?.pin_no || "",
                                            toPin: val,
                                          },
                                        }));
                                      }}
                                      className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-mono font-semibold text-navy-950 focus:border-indigo-600 focus:outline-none"
                                    >
                                      {bStudents.map((st, i) => (
                                        <option key={st.id} value={st.pin_no || ""}>
                                          #{i + 1}: {st.pin_no || st.admission_number} {st.student_name ? `- ${st.student_name.slice(0, 14)}` : ""}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>

                                {/* Action Button */}
                                <button
                                  type="button"
                                  onClick={() => handleApplyB1BranchRange(branch.id)}
                                  className="w-full h-7 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] cursor-pointer shadow-2xs transition-colors flex items-center justify-center gap-1"
                                >
                                  <span>Assign {branch.code || "Branch"} Range to Batch 1</span>
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* BATCH 2 CARD */}
                  <div className="rounded-xl border border-emerald-200 bg-white p-3.5 space-y-3 shadow-2xs">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-emerald-100">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-emerald-600 text-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                          Batch 2 (Slot B)
                        </span>
                        <span className="font-bold text-xs text-navy-950 truncate max-w-[160px]" title={b2Sub?.name || ""}>
                          {b2Sub?.code ? `${b2Sub.code}: ${b2Sub.name}` : b2Sub?.name || "Batch 2 Subject"}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
                        {countBatch2} assigned
                      </span>
                    </div>

                    {/* Branches List for Batch 2 */}
                    <div className="space-y-3 max-h-[460px] overflow-y-auto pr-0.5">
                      {branchesWithStudents.map(({ branch, students: bStudents }) => {
                        const b2AssignedCount = bStudents.filter((s) => studentBatchMap[s.id] === "Batch 2").length;
                        const pinConfig = b2BranchPins[branch.id] || {
                          fromPin: bStudents[0]?.pin_no || "",
                          toPin: bStudents[bStudents.length - 1]?.pin_no || "",
                        };

                        return (
                          <div
                            key={branch.id}
                            className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 space-y-2.5 shadow-2xs hover:border-emerald-200 transition-colors"
                          >
                            {/* Branch Title & Quick Actions */}
                            <div className="flex items-center justify-between gap-1.5 flex-wrap pb-1.5 border-b border-emerald-100/70">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Building2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                <span className="font-bold text-xs text-navy-950 truncate">
                                  {branch.code ? branch.code : branch.name}
                                </span>
                                <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap">
                                  ({bStudents.length} students)
                                </span>
                              </div>

                              <div className="flex items-center gap-1">
                                <span className="text-[10px] font-bold text-emerald-800 bg-white border border-emerald-200 px-1.5 py-0.5 rounded">
                                  {b2AssignedCount} in B2
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleAssignBranchToBatch(branch.id, "Batch 2")}
                                  className="rounded border border-emerald-200 bg-white hover:bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 text-[10px] cursor-pointer"
                                  title={`Assign all ${branch.code || branch.name} students to Batch 2`}
                                >
                                  All → B2
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSplitBranch5050(branch.id)}
                                  className="rounded border border-purple-200 bg-white hover:bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 text-[10px] cursor-pointer"
                                  title={`Split ${branch.code || branch.name} students 50/50 between B1 & B2`}
                                >
                                  50/50
                                </button>
                              </div>
                            </div>

                            {bStudents.length === 0 ? (
                              <p className="text-[11px] text-slate-400 italic py-1">No students registered in this branch.</p>
                            ) : (
                              <>
                                {/* From PIN and To PIN dropdowns */}
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-[9.5px] font-bold text-slate-500 uppercase block mb-0.5">
                                      From PIN Dropdown
                                    </label>
                                    <select
                                      value={pinConfig.fromPin}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setB2BranchPins((prev) => ({
                                          ...prev,
                                          [branch.id]: {
                                            fromPin: val,
                                            toPin: prev[branch.id]?.toPin || bStudents[bStudents.length - 1]?.pin_no || "",
                                          },
                                        }));
                                      }}
                                      className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-mono font-semibold text-navy-950 focus:border-emerald-600 focus:outline-none"
                                    >
                                      {bStudents.map((st, i) => (
                                        <option key={st.id} value={st.pin_no || ""}>
                                          #{i + 1}: {st.pin_no || st.admission_number} {st.student_name ? `- ${st.student_name.slice(0, 14)}` : ""}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="text-[9.5px] font-bold text-slate-500 uppercase block mb-0.5">
                                      To PIN Dropdown
                                    </label>
                                    <select
                                      value={pinConfig.toPin}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setB2BranchPins((prev) => ({
                                          ...prev,
                                          [branch.id]: {
                                            fromPin: prev[branch.id]?.fromPin || bStudents[0]?.pin_no || "",
                                            toPin: val,
                                          },
                                        }));
                                      }}
                                      className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-mono font-semibold text-navy-950 focus:border-emerald-600 focus:outline-none"
                                    >
                                      {bStudents.map((st, i) => (
                                        <option key={st.id} value={st.pin_no || ""}>
                                          #{i + 1}: {st.pin_no || st.admission_number} {st.student_name ? `- ${st.student_name.slice(0, 14)}` : ""}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>

                                {/* Action Button */}
                                <button
                                  type="button"
                                  onClick={() => handleApplyB2BranchRange(branch.id)}
                                  className="w-full h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer shadow-2xs transition-colors flex items-center justify-center gap-1"
                                >
                                  <span>Assign {branch.code || "Branch"} Range to Batch 2</span>
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Individual Student Roster List */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
                {/* Search & Filter Bar */}
                <div className="p-3 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <div className="relative flex-1 max-w-xs">
                      <input
                        type="text"
                        placeholder="Search student PIN or Name..."
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        className="w-full h-7 rounded-lg border border-slate-200 bg-white pl-2 pr-6 text-[11px] focus:outline-none focus:border-indigo-600"
                      />
                      <Search className="h-3 w-3 text-slate-400 absolute right-2 top-2 pointer-events-none" />
                    </div>

                    {availableBranches.length > 1 && (
                      <select
                        value={studentBranchFilter}
                        onChange={(e) => {
                          const val = e.target.value;
                          setStudentBranchFilter(val === "all" ? "all" : Number(val));
                        }}
                        className="h-7 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 focus:outline-none"
                      >
                        <option value="all">All Participating Branches</option>
                        {availableBranches
                          .filter((b) => participatingBranchIds.includes(b.id))
                          .map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.code || b.name}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>

                  {/* Filter Tabs */}
                  <div className="flex rounded-lg bg-slate-200/70 p-0.5 text-[11px] font-bold">
                    {(["all", "Batch 1", "Batch 2", "unassigned"] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setStudentTabFilter(tab)}
                        className={cn(
                          "px-2.5 py-1 rounded transition-all capitalize cursor-pointer",
                          studentTabFilter === tab
                            ? "bg-white text-navy-950 shadow-2xs"
                            : "text-slate-600 hover:text-slate-900",
                        )}
                      >
                        {tab === "all"
                          ? `All (${students.length})`
                          : tab === "Batch 1"
                            ? `B1 (${countBatch1})`
                            : tab === "Batch 2"
                              ? `B2 (${countBatch2})`
                              : `Unassigned (${countUnassigned})`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Students Table / List */}
                <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100">
                  {isLoadingStudents ? (
                    <div className="flex flex-col items-center justify-center p-8 text-slate-500 gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                      <span className="text-xs font-semibold">Loading students roster...</span>
                    </div>
                  ) : fetchError ? (
                    <div className="p-6 text-center text-red-600 space-y-2">
                      <p className="text-xs font-bold">{fetchError}</p>
                      <button
                        type="button"
                        onClick={loadStudentRoster}
                        className="text-xs font-semibold text-indigo-600 underline"
                      >
                        Retry Loading
                      </button>
                    </div>
                  ) : filteredStudents.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      No students found matching current filters.
                    </div>
                  ) : (
                    filteredStudents.map((st, idx) => {
                      const assignedBatch = studentBatchMap[st.id];
                      return (
                        <div
                          key={st.id}
                          className="flex items-center justify-between px-3 py-2 hover:bg-slate-50/70 transition-colors text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-[10px] text-slate-400 font-mono w-6 text-right">
                              #{idx + 1}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold font-mono text-[11px] text-navy-950">
                                  {st.pin_no || st.admission_number}
                                </span>
                                {st.branch_code && (
                                  <span className="rounded bg-slate-100 text-slate-700 px-1 py-0.2 text-[9px] font-bold">
                                    {st.branch_code}
                                  </span>
                                )}
                                {st.section && (
                                  <span className="rounded bg-slate-100 text-slate-500 px-1 py-0.2 text-[9px]">
                                    Sec {st.section}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-600 truncate font-medium">
                                {st.student_name || "—"}
                              </p>
                            </div>
                          </div>

                          {/* Individual Toggle Buttons */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleToggleStudent(st.id, "Batch 1")}
                              className={cn(
                                "px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer",
                                assignedBatch === "Batch 1"
                                  ? "bg-indigo-600 text-white shadow-2xs"
                                  : "border border-slate-200 text-slate-600 hover:border-indigo-400 hover:text-indigo-600 bg-white",
                              )}
                            >
                              Batch 1
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleStudent(st.id, "Batch 2")}
                              className={cn(
                                "px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer",
                                assignedBatch === "Batch 2"
                                  ? "bg-emerald-600 text-white shadow-2xs"
                                  : "border border-slate-200 text-slate-600 hover:border-emerald-400 hover:text-emerald-600 bg-white",
                              )}
                            >
                              Batch 2
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-border bg-slate-50 px-5 py-3.5 flex items-center justify-between">
          <div>
            {currentStep === 1 ? (
              existing && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onClear}
                  className="text-xs text-red-600 hover:text-red-700 h-8 gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove Period
                </Button>
              )
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentStep(1)}
                className="text-xs h-8 gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Step 1
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose} className="text-xs h-8">
              Cancel
            </Button>

            {currentStep === 1 ? (
              isSplit ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleProceedToStep2}
                  className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white h-8 gap-1"
                >
                  Next: Select Students (Step 2)
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleApplySingle}
                  className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white h-8"
                >
                  Apply to Slot
                </Button>
              )
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleApplySplit}
                className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white h-8 gap-1.5 shadow-xs"
              >
                <Check className="h-3.5 w-3.5" />
                Apply Split Slot ({countBatch1} + {countBatch2} students)
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Publish Confirmation & Workload Summary Modal Sub-Component
// ----------------------------------------------------------------------

type PublishReviewModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirmPublish: () => void;
  isSaving: boolean;
  totalAssignedCount: number;
  selectedBranches: Array<{ id: number; name: string; code: string | null }>;
  collegeName: string;
  courseName: string;
  year: number;
  semester: number;
  academicYear: string;
  reviewTab: "faculty" | "subjects";
  onTabChange: (tab: "faculty" | "subjects") => void;
  subjectSlotsSummary: Array<{
    code: string;
    name: string;
    type: string;
    slotsCount: number;
    totalHours: string;
    facultyNames: string[];
  }>;
  facultyWorkloadSummary: {
    list: Array<{
      hrmsId: string;
      name: string;
      department: string;
      designation: string;
      slotsCount: number;
      totalHours: string;
      subjectCodes: string[];
      days: string[];
    }>;
    unassignedSlots: number;
    totalFacultyHours: string;
  };
  sectionValidationSummary?: {
    modeLabel: string;
    description: string;
    totalPlans: number;
    branchPlans: Array<{
      branchName: string;
      sections: string[];
      note?: string;
    }>;
    isWarning?: boolean;
  };
};

function PublishReviewModal({
  isOpen,
  onClose,
  onConfirmPublish,
  isSaving,
  totalAssignedCount,
  selectedBranches,
  collegeName,
  courseName,
  year,
  semester,
  academicYear,
  reviewTab,
  onTabChange,
  subjectSlotsSummary,
  facultyWorkloadSummary,
  sectionValidationSummary,
}: PublishReviewModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-navy-950/60 backdrop-blur-xs transition-opacity"
        onClick={() => !isSaving && onClose()}
      />

      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex w-full max-w-4xl max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="border-b border-border bg-gradient-to-r from-indigo-50/90 via-purple-50/40 to-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
                  <Sparkles className="h-4 w-4" />
                </span>
                <h3 className="text-lg font-bold text-navy-950">
                  Publish Timetable Workload & Slots Review
                </h3>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Verify faculty total working hours and subject slot distribution before publishing to all {selectedBranches.length} branches.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Scope Tags */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-md bg-white border border-indigo-200/80 px-2.5 py-0.5 font-semibold text-slate-700">
              College: <strong className="text-navy-900">{collegeName}</strong>
            </span>
            <span className="rounded-md bg-white border border-indigo-200/80 px-2.5 py-0.5 font-semibold text-slate-700">
              Course: <strong className="text-navy-900">{courseName}</strong> (Yr {year}, Sem {semester})
            </span>
            <span className="rounded-md bg-white border border-indigo-200/80 px-2.5 py-0.5 font-semibold text-slate-700">
              Academic Year: <strong className="text-navy-900">{academicYear}</strong>
            </span>
            <span className="rounded-md bg-indigo-100/90 border border-indigo-300 px-2.5 py-0.5 font-bold text-indigo-900">
              Target Branches ({selectedBranches.length}): {selectedBranches.map((b) => b.code || b.name).join(" + ")}
            </span>
            {sectionValidationSummary && (
              <span className="rounded-md bg-purple-100/90 border border-purple-300 px-2.5 py-0.5 font-bold text-purple-900">
                Section Scope: {sectionValidationSummary.modeLabel} ({sectionValidationSummary.totalPlans} Plans)
              </span>
            )}
          </div>
        </div>

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 bg-slate-50/60 border-b border-slate-100">
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Total Assigned Slots
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-navy-950">{totalAssignedCount}</span>
              <span className="text-[11px] text-slate-500">periods/week</span>
            </div>
          </div>

          <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 shadow-2xs">
            <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider block">
              Total Teaching Workload
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-indigo-950">{facultyWorkloadSummary.totalFacultyHours}</span>
              <span className="text-[11px] text-indigo-700">hours/week</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Configured Subjects
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-navy-950">{subjectSlotsSummary.length}</span>
              <span className="text-[11px] text-slate-500">subjects</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Faculty Deployed
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-navy-950">{facultyWorkloadSummary.list.length}</span>
              <span className="text-[11px] text-slate-500">teachers</span>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-4 max-h-[calc(90vh-270px)]">
          {sectionValidationSummary && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-xs text-indigo-950 flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-indigo-600" />
                  Timetable Plans Distribution ({sectionValidationSummary.modeLabel})
                </span>
                <span className="rounded-md bg-white border border-indigo-200 px-2 py-0.5 text-[10.5px] font-bold text-indigo-900">
                  {sectionValidationSummary.totalPlans} plan{sectionValidationSummary.totalPlans === 1 ? "" : "s"} will be published
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {sectionValidationSummary.branchPlans.map((bp, i) => (
                  <div key={i} className="rounded-lg border border-indigo-100 bg-white p-2 text-xs">
                    <span className="font-bold text-navy-900 block">{bp.branchName}</span>
                    <span className="text-slate-600 font-medium text-[11px] block">
                      {bp.sections.join(" & ")}
                    </span>
                    {bp.note && (
                      <span className="text-[10px] text-amber-700 block mt-0.5">ℹ️ {bp.note}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Optional unassigned notice */}
          {facultyWorkloadSummary.unassignedSlots > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/90 px-3.5 py-2.5 text-xs text-amber-900">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                <strong>{facultyWorkloadSummary.unassignedSlots} slot(s)</strong> have no faculty member assigned. They will be published with open faculty allocation.
              </span>
            </div>
          )}

          {/* Section Switcher Tabs */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onTabChange("faculty")}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                  reviewTab === "faculty"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100",
                )}
              >
                <UserCheck className="h-3.5 w-3.5" />
                Faculty Total Working Hours ({facultyWorkloadSummary.list.length})
              </button>
              <button
                type="button"
                onClick={() => onTabChange("subjects")}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                  reviewTab === "subjects"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100",
                )}
              >
                <BookOpen className="h-3.5 w-3.5" />
                Subjects Total Slots ({subjectSlotsSummary.length})
              </button>
            </div>
          </div>

          {/* Tab 1: Faculty Total Working Hours */}
          {reviewTab === "faculty" && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/80 text-navy-950 font-bold uppercase text-[10.5px]">
                    <th className="py-2.5 px-3">Faculty Member</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3 text-center">Total Assigned Slots</th>
                    <th className="py-2.5 px-3 text-center">Total Working Hours</th>
                    <th className="py-2.5 px-3">Subjects Taught</th>
                    <th className="py-2.5 px-3">Active Days</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {facultyWorkloadSummary.list.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-slate-400 italic">
                        No faculty members assigned to period slots yet.
                      </td>
                    </tr>
                  ) : (
                    facultyWorkloadSummary.list.map((f, idx) => (
                      <tr key={f.hrmsId || idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-navy-950">{f.name}</div>
                          {f.hrmsId && f.hrmsId !== "—" && (
                            <div className="text-[10px] text-slate-400 font-mono">ID: {f.hrmsId}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 font-medium">
                          {f.department || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-flex items-center justify-center rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-900 border border-indigo-100">
                            {f.slotsCount} slots
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
                            <Clock className="h-3 w-3 text-emerald-600" />
                            {f.totalHours}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-wrap gap-1">
                            {f.subjectCodes.map((c, i) => (
                              <span key={i} className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-semibold text-slate-700">
                                {c}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                          {f.days.join(", ")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 2: Subjects Total Slots */}
          {reviewTab === "subjects" && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/80 text-navy-950 font-bold uppercase text-[10.5px]">
                    <th className="py-2.5 px-3">Subject Code</th>
                    <th className="py-2.5 px-3">Subject Name</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3 text-center">Total Slots Allocated</th>
                    <th className="py-2.5 px-3 text-center">Weekly Duration</th>
                    <th className="py-2.5 px-3">Assigned Faculty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {subjectSlotsSummary.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-slate-400 italic">
                        No subjects assigned in this timetable schedule yet.
                      </td>
                    </tr>
                  ) : (
                    subjectSlotsSummary.map((s, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-navy-950">
                          {s.code}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {s.name}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                              s.type === "theory"
                                ? "bg-blue-100 text-blue-900"
                                : s.type === "lab"
                                ? "bg-purple-100 text-purple-900"
                                : "bg-slate-100 text-slate-700",
                            )}
                          >
                            {s.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-flex items-center justify-center rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-900 border border-indigo-100">
                            {s.slotsCount} slots
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-800">
                            <Clock className="h-3 w-3 text-slate-500" />
                            {s.totalHours}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {s.facultyNames.length > 0 ? (
                            <span className="font-medium">{s.facultyNames.join(", ")}</span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50/80 px-6 py-3.5 flex items-center justify-between">
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isSaving}
            className="text-xs"
          >
            Back to Planner
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={onConfirmPublish}
            disabled={isSaving || totalAssignedCount === 0}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 h-8.5 px-4 shadow-xs"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Confirm & Publish to All {selectedBranches.length} Branches
          </Button>
        </div>
      </div>
    </div>
  );
}
