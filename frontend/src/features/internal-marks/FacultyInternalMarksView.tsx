"use client";

import { useEffect, useState, useMemo, Fragment } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LoadingAnimation } from "@/components/ui/LoadingAnimation";
import { ContentCardSkeleton } from "@/components/ui/CardSkeleton";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { DataErrorState } from "@/components/ui/DataErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { InternalMarksEntryModal } from "./InternalMarksEntryModal";
import {
  BookOpen,
  CheckCircle,
  Clock,
  Edit3,
  Eye,
  FileText,
  Lock,
  XCircle,
  RotateCcw,
  AlertCircle,
  Calendar,
  Search,
  Filter,
  Bell,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  BarChart3,
  Sparkles,
  ArrowLeft,
  GraduationCap,
  Layers,
  School,
  Users,
} from "lucide-react";

type AssignedSubject = {
  collegeId: number;
  collegeName: string;
  courseId: number;
  courseName: string;
  branchId: number;
  branchName: string;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  subjectType: string;
  semester: number | null;
  year: number | null;
  batch: string;
  sections?: string[];
  sectionName?: string;
  examNotification?: {
    id: number;
    name: string;
    type?: string;
    examDates: string;
    deadline?: string | null;
    status?: string;
  } | null;
  accessStatus: "enabled" | "disabled";
  accessLevel: "college" | "course" | "branch" | "individual" | "none";
  submissionId: number | null;
  submissionStatus: "draft" | "submitted" | "pending_approval" | "approved" | "rejected" | "returned";
  currentApprovalLevel: number;
  maxMarks: number;
  lastUpdated: string | null;
  studentCount?: number;
  marksEnteredCount?: number;
};

type SubmissionItem = {
  id: number;
  collegeId: number;
  collegeName: string;
  courseId: number;
  courseName: string;
  branchId: number;
  branchName: string;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  facultyStaffLinkId: number;
  facultyName: string;
  maxMarks: number;
  status: "draft" | "submitted" | "pending_approval" | "approved" | "rejected" | "returned" | "forwarded_to_ems" | "ems_sync_failed";
  currentApprovalLevel: number;
  submittedAt: string | null;
  submittedByName?: string;
  studentCount: number;
  emsSyncStatus?: "not_synced" | "synced" | "failed";
  emsSyncedAt?: string | null;
  emsSyncedBy?: number | null;
  emsSyncError?: string | null;
  approvalHistory: Array<{
    id: number;
    approvalLevel: number;
    approverName: string;
    approverRoleKey: string;
    action: string;
    previousStatus: string;
    newStatus: string;
    comments: string | null;
    createdAt: string;
  }>;
};

export function FacultyInternalMarksView() {
  const { hasPermission, authorization, user } = useAuth();
  const canEdit = hasPermission("internal_marks.edit");

  const userRoleKeys = useMemo(() => {
    return (authorization?.roles || []).map((r) => r.roleKey.toLowerCase());
  }, [authorization]);

  const isSuperAdmin = Boolean(
    authorization?.scope.isGlobal ||
    userRoleKeys.some((k) => ["super_admin", "superadmin", "admin"].includes(k))
  );
  const isPrincipal = userRoleKeys.includes("principal");
  const isVicePrincipal = userRoleKeys.includes("vice_principal") || userRoleKeys.includes("vice-principal");
  const isHod = userRoleKeys.includes("hod");

  // Only Principal, Vice Principal, HOD, and Superadmin can view the Pending List & Notifications report
  const canViewPendingReport = isSuperAdmin || isPrincipal || isVicePrincipal || isHod;

  // Submissions & Approvals is ONLY visible to Principal, Vice Principal, and Super Admins
  const canViewApprovals = isSuperAdmin || isPrincipal || isVicePrincipal;

  // Determine user's active leadership scope label
  const leadershipScopeLabel = useMemo(() => {
    if (isSuperAdmin) return "All Institutions (Global Oversight)";
    if (isPrincipal) return "College Oversight (Principal)";
    if (isVicePrincipal) return "College Oversight (Vice Principal)";
    if (isHod) return "Department Oversight (HOD)";
    return null;
  }, [isSuperAdmin, isPrincipal, isVicePrincipal, isHod]);

  const [activeTab, setActiveTab] = useState<"my_subjects" | "pending_approvals" | "pending_report">("my_subjects");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [staffLinkId, setStaffLinkId] = useState<number | null>(null);
  const [assignedSubjects, setAssignedSubjects] = useState<AssignedSubject[]>([]);
  const [pendingSubmissions, setPendingSubmissions] = useState<SubmissionItem[]>([]);
  const [maxApprovalLevel, setMaxApprovalLevel] = useState<number>(1);
  const [forwardingBusyId, setForwardingBusyId] = useState<number | null>(null);

  // Pending Report Data and Filters
  const [reportData, setReportData] = useState<{
    summary: {
      totalSubjects: number;
      postedCount: number;
      pendingCount: number;
      completionPercentage: number;
    };
    notifications: Array<{
      id: number;
      name: string;
      type: string;
      examCategory: string;
      college: string | null;
      course: string | null;
      branch: string | null;
      batch: string | null;
      yearOfStudy: number | null;
      semester: number | null;
      status: string;
      examinationStartDate: string | null;
      examinationEndDate: string | null;
      applicationStartDate: string | null;
      applicationEndDate: string | null;
      publishedAt: string | null;
      subjectCount?: number;
      postedCount?: number;
      pendingCount?: number;
      progressPercent?: number;
    }>;
    subjects: Array<{
      collegeId: number;
      collegeName: string;
      courseId: number;
      courseName: string;
      branchId: number;
      branchName: string;
      subjectId: number;
      subjectCode: string;
      subjectName: string;
      subjectType: string;
      year: number | null;
      semester: number | null;
      sections?: string[];
      studentCount?: number;
      sectionBreakdown?: Array<{
        sectionName: string;
        studentCount?: number;
        assignedFaculty: Array<{
          staffLinkId: number;
          displayName: string;
          employeeCode: string | null;
          departmentName: string | null;
        }>;
        postingStatus: "pending" | "posted";
        submission: {
          id: number;
          status: string;
          maxMarks: number;
          updatedAt: string;
          submittedAt: string | null;
          studentCount: number;
        } | null;
      }>;
      assignedFaculty: Array<{
        staffLinkId: number;
        displayName: string;
        employeeCode: string | null;
        departmentName: string | null;
      }>;
      postingStatus: "pending" | "posted";
      submission: {
        id: number;
        status: string;
        maxMarks: number;
        updatedAt: string;
        submittedAt: string | null;
        studentCount: number;
      } | null;
      matchingExams: Array<{
        id: number;
        name: string;
        examCategory: string;
        startDate: string | null;
        endDate: string | null;
      }>;
    }>;
  } | null>(null);

  const [reportFilterExamId, setReportFilterExamId] = useState<string>("all");
  const [reportFilterStatus, setReportFilterStatus] = useState<"all" | "pending" | "posted">("all");
  const [reportSearchQuery, setReportSearchQuery] = useState<string>("");
  const [reportFilterCourse, setReportFilterCourse] = useState<string>("all");
  const [reportFilterBranch, setReportFilterBranch] = useState<string>("all");
  const [reportFilterYear, setReportFilterYear] = useState<string>("all");
  const [reportFilterSem, setReportFilterSem] = useState<string>("all");

  // Dedicated Exam Drilldown View state
  const [selectedExamDetailId, setSelectedExamDetailId] = useState<number | null>(null);
  const [examDrilldownSearch, setExamDrilldownSearch] = useState<string>("");
  const [examDrilldownStatus, setExamDrilldownStatus] = useState<"all" | "pending" | "posted">("all");
  const [examDrilldownCourse, setExamDrilldownCourse] = useState<string>("all");
  const [examDrilldownBranch, setExamDrilldownBranch] = useState<string>("all");
  const [examDrilldownYear, setExamDrilldownYear] = useState<string>("all");
  const [examDrilldownSem, setExamDrilldownSem] = useState<string>("all");
  const [expandedSubjectKeys, setExpandedSubjectKeys] = useState<Set<string>>(new Set());

  // Filter and search state for My Assigned Subjects
  const [assignedNotificationFilter, setAssignedNotificationFilter] = useState<string>("all");
  const [assignedSearchQuery, setAssignedSearchQuery] = useState<string>("");
  const [availableExams, setAvailableExams] = useState<Array<{ id: number; name: string; examDates: string }>>([]);

  const uniqueAssignedSubjects = useMemo(() => {
    const seen = new Set<string>();
    const list: AssignedSubject[] = [];
    for (const sub of assignedSubjects) {
      const key = `${sub.branchId}-${sub.subjectId}-${sub.sectionName || ""}-${sub.examNotification?.id || "none"}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push(sub);
      }
    }
    return list;
  }, [assignedSubjects]);

  // Derive notifications strictly applicable to the faculty's assigned subjects
  const relevantExams = useMemo(() => {
    const examMap = new Map<number, { id: number; name: string; examDates: string; count: number }>();
    for (const sub of uniqueAssignedSubjects) {
      if (sub.examNotification?.id) {
        const id = sub.examNotification.id;
        if (!examMap.has(id)) {
          examMap.set(id, {
            id,
            name: sub.examNotification.name,
            examDates: sub.examNotification.examDates || "",
            count: 1,
          });
        } else {
          examMap.get(id)!.count++;
        }
      }
    }
    return Array.from(examMap.values());
  }, [uniqueAssignedSubjects]);

  useEffect(() => {
    if (
      assignedNotificationFilter !== "all" &&
      !relevantExams.some((e) => String(e.id) === assignedNotificationFilter)
    ) {
      setAssignedNotificationFilter("all");
    }
  }, [relevantExams, assignedNotificationFilter]);

  const filteredAssignedSubjects = useMemo(() => {
    return uniqueAssignedSubjects.filter((sub) => {
      if (assignedNotificationFilter !== "all") {
        if (!sub.examNotification || String(sub.examNotification.id) !== assignedNotificationFilter) {
          return false;
        }
      }
      if (assignedSearchQuery.trim()) {
        const q = assignedSearchQuery.toLowerCase().trim();
        const mCode = (sub.subjectCode || "").toLowerCase().includes(q);
        const mName = (sub.subjectName || "").toLowerCase().includes(q);
        const mBranch = (sub.branchName || "").toLowerCase().includes(q);
        const mCourse = (sub.courseName || "").toLowerCase().includes(q);
        const mSec = (sub.sectionName || "").toLowerCase().includes(q);
        const mExam = (sub.examNotification?.name || "").toLowerCase().includes(q);
        if (!mCode && !mName && !mBranch && !mCourse && !mSec && !mExam) return false;
      }
      return true;
    });
  }, [uniqueAssignedSubjects, assignedNotificationFilter, assignedSearchQuery]);

  // Group filtered assigned subjects notification-wise for clarity
  const groupedAssignedSubjects = useMemo(() => {
    const groups: Array<{
      key: string;
      notificationId: number | null;
      notificationName: string;
      type: string;
      examDates?: string;
      deadline?: string | null;
      status?: string;
      startDate?: string | null;
      subjects: AssignedSubject[];
    }> = [];

    const groupMap = new Map<string, (typeof groups)[0]>();

    for (const sub of filteredAssignedSubjects) {
      const exam = sub.examNotification;
      const key = exam ? `exam-${exam.id}` : "unassigned";

      if (!groupMap.has(key)) {
        const newGroup = {
          key,
          notificationId: exam?.id ?? null,
          notificationName: exam?.name ?? "Regular Term Assessment",
          type: exam?.type ?? "INTERNAL",
          examDates: exam?.examDates,
          deadline: exam?.deadline,
          status: exam?.status,
          startDate: exam?.examDates ? exam.examDates.split(" - ")[0] : null,
          subjects: [],
        };
        groupMap.set(key, newGroup);
        groups.push(newGroup);
      }
      groupMap.get(key)!.subjects.push(sub);
    }

    // Sort groups chronologically (Mid-1 before Mid-2, etc.)
    groups.sort((a, b) => {
      if (a.startDate && b.startDate) {
        return a.startDate.localeCompare(b.startDate);
      }
      return (a.notificationId ?? 999999) - (b.notificationId ?? 999999);
    });

    return groups;
  }, [filteredAssignedSubjects]);

  // Active modal for marks entry
  const [entryModal, setEntryModal] = useState<{
    open: boolean;
    subject?: AssignedSubject | SubmissionItem;
    readOnly?: boolean;
  }>({ open: false });

  // Active approval dialog
  const [approvalDialog, setApprovalDialog] = useState<{
    open: boolean;
    submissionId?: number;
    action?: "approve" | "reject" | "return";
    comments: string;
    busy: boolean;
  }>({ open: false, comments: "", busy: false });

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === "my_subjects") {
        const res = await apiFetch("/internal-marks/faculty-subjects");
        if (!res.ok) throw new Error("Failed to load assigned subjects");
        const body = await res.json();
        setStaffLinkId(body.staffLinkId);
        setAssignedSubjects(body.subjects || []);
        if (body.notifications) {
          setAvailableExams(body.notifications);
        }
      } else if (activeTab === "pending_approvals") {
        if (!canViewApprovals) {
          setActiveTab("my_subjects");
          return;
        }
        const [subRes, cfgRes] = await Promise.all([
          apiFetch("/internal-marks/submissions"),
          apiFetch("/internal-marks/approval-configs"),
        ]);
        if (!subRes.ok) throw new Error("Failed to load submissions for approval");
        const subBody = await subRes.json();
        setPendingSubmissions(subBody.data || []);

        if (cfgRes.ok) {
          const cfgBody = await cfgRes.json();
          const configs: Array<{ levelNumber: number; isActive: boolean }> = cfgBody.data || [];
          const activeLevels = configs.filter((c) => c.isActive).map((c) => c.levelNumber);
          if (activeLevels.length > 0) {
            setMaxApprovalLevel(Math.max(...activeLevels));
          }
        }
      } else if (activeTab === "pending_report") {
        if (!canViewPendingReport) {
          setActiveTab("my_subjects");
          return;
        }
        const res = await apiFetch("/internal-marks/pending-report");
        if (!res.ok) throw new Error("Failed to load pending report and notifications");
        const body = await res.json();
        setReportData(body);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load internal marks data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [activeTab]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam === "pending_report" && canViewPendingReport) {
        setActiveTab("pending_report");
      } else if (tabParam === "pending_approvals" && canViewApprovals) {
        setActiveTab("pending_approvals");
      } else if (tabParam === "my_subjects") {
        setActiveTab("my_subjects");
      }
      const examParam = params.get("examId");
      if (examParam) {
        setSelectedExamDetailId(Number(examParam));
      }
    }
  }, [canViewPendingReport, canViewApprovals]);

  useEffect(() => {
    if (!canViewPendingReport) return;
    // Background fetch summary for the pending report tab badge on initial load
    apiFetch("/internal-marks/pending-report")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setReportData(data);
      })
      .catch(() => {});
  }, [canViewPendingReport]);

  const filteredReportSubjects = useMemo(() => {
    if (!reportData) return [];
    return reportData.subjects.filter((sub) => {
      if (reportFilterExamId !== "all") {
        const eId = Number(reportFilterExamId);
        if (!sub.matchingExams.some((m) => m.id === eId)) {
          return false;
        }
      }
      if (reportFilterStatus !== "all" && sub.postingStatus !== reportFilterStatus) {
        return false;
      }
      if (reportFilterCourse !== "all" && String(sub.courseId) !== reportFilterCourse) {
        return false;
      }
      if (reportFilterBranch !== "all" && String(sub.branchId) !== reportFilterBranch) {
        return false;
      }
      if (reportFilterYear !== "all" && String(sub.year) !== reportFilterYear) {
        return false;
      }
      if (reportFilterSem !== "all" && String(sub.semester) !== reportFilterSem) {
        return false;
      }
      if (!reportSearchQuery) return true;
      const q = reportSearchQuery.toLowerCase();
      const matchSubject =
        sub.subjectName.toLowerCase().includes(q) ||
        sub.subjectCode.toLowerCase().includes(q) ||
        sub.branchName.toLowerCase().includes(q) ||
        sub.courseName.toLowerCase().includes(q);
      const matchFaculty = sub.assignedFaculty.some(
        (f) =>
          f.displayName.toLowerCase().includes(q) ||
          (f.employeeCode && f.employeeCode.toLowerCase().includes(q))
      );
      return matchSubject || matchFaculty;
    });
  }, [
    reportData,
    reportFilterExamId,
    reportFilterStatus,
    reportFilterCourse,
    reportFilterBranch,
    reportFilterYear,
    reportFilterSem,
    reportSearchQuery,
  ]);

  const reportAvailableCourses = useMemo(() => {
    if (!reportData) return [];
    const map = new Map<number, string>();
    for (const s of reportData.subjects) {
      if (s.courseId && !map.has(s.courseId)) {
        map.set(s.courseId, s.courseName);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [reportData]);

  const reportAvailableBranches = useMemo(() => {
    if (!reportData) return [];
    const map = new Map<number, string>();
    for (const s of reportData.subjects) {
      if (reportFilterCourse !== "all" && String(s.courseId) !== reportFilterCourse) continue;
      if (!map.has(s.branchId)) {
        map.set(s.branchId, s.branchName);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [reportData, reportFilterCourse]);

  const reportAvailableYears = useMemo(() => {
    if (!reportData) return [];
    const set = new Set<number>();
    for (const s of reportData.subjects) {
      if (s.year != null) set.add(s.year);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [reportData]);

  const reportAvailableSemesters = useMemo(() => {
    if (!reportData) return [];
    const set = new Set<number>();
    for (const s of reportData.subjects) {
      if (s.semester != null) set.add(s.semester);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [reportData]);

  const filteredReportNotifications = useMemo(() => {
    if (!reportData) return [];
    return reportData.notifications.filter((n) => {
      // In scoped views, exclude notifications that have zero subjects in the scoped dataset
      if (reportData.subjects.length > 0 && n.subjectCount === 0) {
        return false;
      }
      if (reportFilterCourse !== "all") {
        const cObj = reportAvailableCourses.find((c) => String(c.id) === reportFilterCourse);
        if (cObj && n.course) {
          const normN = n.course.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
          const normC = cObj.name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
          if (normN !== normC) return false;
        }
      }
      if (reportFilterBranch !== "all") {
        const bObj = reportAvailableBranches.find((b) => String(b.id) === reportFilterBranch);
        if (bObj && n.branch) {
          const targetBranches = n.branch
            .split(",")
            .map((b) => b.trim().toLowerCase().replace(/[^a-z0-9]/g, ""))
            .filter(Boolean);
          const normB = bObj.name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
          if (!targetBranches.some((tb) => tb === normB)) return false;
        }
      }
      if (reportFilterYear !== "all" && n.yearOfStudy != null && String(n.yearOfStudy) !== reportFilterYear) {
        return false;
      }
      if (reportFilterSem !== "all" && n.semester != null && String(n.semester) !== reportFilterSem) {
        return false;
      }
      return true;
    });
  }, [
    reportData,
    reportFilterCourse,
    reportFilterBranch,
    reportFilterYear,
    reportFilterSem,
    reportAvailableCourses,
    reportAvailableBranches,
  ]);

  // Exam Drilldown Memos & Grouping
  const selectedExam = useMemo(() => {
    if (!reportData || selectedExamDetailId == null) return null;
    return reportData.notifications.find((n) => n.id === selectedExamDetailId) || null;
  }, [reportData, selectedExamDetailId]);

  const examMatchingSubjects = useMemo(() => {
    if (!reportData || selectedExamDetailId == null || !selectedExam) return [];
    return reportData.subjects.filter((sub) => {
      // Must match this exam ID
      if (!sub.matchingExams.some((m) => m.id === selectedExamDetailId)) {
        return false;
      }
      // Strict Course Match (e.g. B.Tech exam must never show M.Tech or Diploma)
      if (selectedExam.course && sub.courseName) {
        const normEx = selectedExam.course.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
        const normSub = sub.courseName.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
        if (normEx !== normSub) return false;
      }
      // Term Match (Year & Semester)
      if (selectedExam.yearOfStudy != null && sub.year != null && Number(selectedExam.yearOfStudy) !== Number(sub.year)) {
        return false;
      }
      if (selectedExam.semester != null && sub.semester != null && Number(selectedExam.semester) !== Number(sub.semester)) {
        return false;
      }
      // Branch Match against the notification's branch list
      if (selectedExam.branch && sub.branchName) {
        const targetBranches = selectedExam.branch
          .split(",")
          .map((b) => b.trim().toLowerCase().replace(/[^a-z0-9]/g, ""))
          .filter(Boolean);
        const subBranch = sub.branchName.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
        if (!targetBranches.some((tb) => tb === subBranch)) return false;
      }
      return true;
    });
  }, [reportData, selectedExamDetailId, selectedExam]);

  const examCourses = useMemo(() => {
    const map = new Map<number, string>();
    for (const s of examMatchingSubjects) {
      if (s.courseId && !map.has(s.courseId)) {
        map.set(s.courseId, s.courseName);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [examMatchingSubjects]);

  const examBranches = useMemo(() => {
    const map = new Map<number, string>();
    for (const s of examMatchingSubjects) {
      if (examDrilldownCourse !== "all" && String(s.courseId) !== examDrilldownCourse) continue;
      if (!map.has(s.branchId)) {
        map.set(s.branchId, s.branchName);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [examMatchingSubjects, examDrilldownCourse]);

  const examYears = useMemo(() => {
    const set = new Set<number>();
    for (const s of examMatchingSubjects) {
      if (s.year != null) set.add(s.year);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [examMatchingSubjects]);

  const examSemesters = useMemo(() => {
    const set = new Set<number>();
    for (const s of examMatchingSubjects) {
      if (s.semester != null) set.add(s.semester);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [examMatchingSubjects]);

  const examPostedCount = useMemo(() => {
    return examMatchingSubjects.filter((s) => s.postingStatus === "posted").length;
  }, [examMatchingSubjects]);

  const examPendingCount = useMemo(() => {
    return examMatchingSubjects.length - examPostedCount;
  }, [examMatchingSubjects, examPostedCount]);

  const examProgressPercent = useMemo(() => {
    return examMatchingSubjects.length > 0
      ? Math.round((examPostedCount / examMatchingSubjects.length) * 100)
      : 0;
  }, [examMatchingSubjects.length, examPostedCount]);

  const examFilteredSubjects = useMemo(() => {
    return examMatchingSubjects.filter((sub) => {
      if (examDrilldownStatus !== "all" && sub.postingStatus !== examDrilldownStatus) {
        return false;
      }
      if (examDrilldownCourse !== "all" && String(sub.courseId) !== examDrilldownCourse) {
        return false;
      }
      if (examDrilldownBranch !== "all" && String(sub.branchId) !== examDrilldownBranch) {
        return false;
      }
      if (examDrilldownYear !== "all" && String(sub.year) !== examDrilldownYear) {
        return false;
      }
      if (examDrilldownSem !== "all" && String(sub.semester) !== examDrilldownSem) {
        return false;
      }
      if (!examDrilldownSearch) return true;
      const q = examDrilldownSearch.toLowerCase().trim();
      const matchSubject =
        sub.subjectName.toLowerCase().includes(q) ||
        sub.subjectCode.toLowerCase().includes(q) ||
        sub.branchName.toLowerCase().includes(q) ||
        sub.courseName.toLowerCase().includes(q);
      const matchFaculty = sub.assignedFaculty.some(
        (f) =>
          f.displayName.toLowerCase().includes(q) ||
          (f.employeeCode && f.employeeCode.toLowerCase().includes(q))
      );
      return matchSubject || matchFaculty;
    });
  }, [
    examMatchingSubjects,
    examDrilldownStatus,
    examDrilldownCourse,
    examDrilldownBranch,
    examDrilldownYear,
    examDrilldownSem,
    examDrilldownSearch,
  ]);

  function toggleSubjectExpand(key: string) {
    setExpandedSubjectKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function expandAllSubjects() {
    const allKeys = new Set(examFilteredSubjects.map((s) => `${s.branchId}-${s.subjectId}`));
    setExpandedSubjectKeys(allKeys);
  }

  function collapseAllSubjects() {
    setExpandedSubjectKeys(new Set());
  }

  type SubjectBreakdownItem = {
    sectionName: string;
    studentCount?: number;
    assignedFaculty: Array<{
      staffLinkId: number;
      displayName: string;
      employeeCode: string | null;
      departmentName: string | null;
    }>;
    postingStatus: "pending" | "posted";
    submission: {
      id: number;
      status: string;
      maxMarks: number;
      updatedAt: string;
      submittedAt: string | null;
      studentCount: number;
    } | null;
  };

  function getSubjectBreakdown(sub: (typeof examFilteredSubjects)[0]): SubjectBreakdownItem[] {
    if (sub.sectionBreakdown && sub.sectionBreakdown.length > 0) {
      return sub.sectionBreakdown;
    }
    const sectionsList = sub.sections && sub.sections.length > 0 ? sub.sections : ["A"];
    return sectionsList.map((secName) => ({
      sectionName: secName,
      studentCount: sub.studentCount,
      assignedFaculty: sub.assignedFaculty,
      postingStatus: sub.postingStatus,
      submission: sub.submission,
    }));
  }

  function handleOpenSectionEntry(
    sub: (typeof examFilteredSubjects)[0],
    sec: SubjectBreakdownItem
  ) {
    const isPosted = sec.postingStatus === "posted";
    setEntryModal({
      open: true,
      subject: {
        collegeId: sub.collegeId,
        collegeName: sub.collegeName,
        courseId: sub.courseId,
        courseName: sub.courseName,
        branchId: sub.branchId,
        branchName: sub.branchName,
        subjectId: sub.subjectId,
        subjectCode: sub.subjectCode,
        subjectName: sub.subjectName,
        subjectType: sub.subjectType,
        year: sub.year,
        semester: sub.semester,
        batch: "",
        sectionName: sec.sectionName,
        accessStatus: "enabled",
        accessLevel: "individual",
        submissionId: sec.submission?.id || null,
        submissionStatus: (sec.submission?.status as any) || "draft",
        currentApprovalLevel: 1,
        maxMarks: sec.submission?.maxMarks || 30,
        lastUpdated: sec.submission?.updatedAt || null,
        facultyStaffLinkId:
          sec.assignedFaculty[0]?.staffLinkId || sub.assignedFaculty[0]?.staffLinkId || staffLinkId || 0,
        examNotification:
          selectedExam
            ? {
                id: selectedExam.id,
                name: selectedExam.name,
                type: selectedExam.type || "INTERNAL",
                examDates:
                  selectedExam.examinationStartDate && selectedExam.examinationEndDate
                    ? `${selectedExam.examinationStartDate} - ${selectedExam.examinationEndDate}`
                    : selectedExam.examinationStartDate || selectedExam.examinationEndDate || "",
                deadline: selectedExam.applicationEndDate || null,
                status: selectedExam.status,
              }
            : sub.matchingExams && sub.matchingExams.length > 0
            ? {
                id: sub.matchingExams[0].id,
                name: sub.matchingExams[0].name,
                type: sub.matchingExams[0].examCategory || "INTERNAL",
                examDates:
                  sub.matchingExams[0].startDate && sub.matchingExams[0].endDate
                    ? `${sub.matchingExams[0].startDate} - ${sub.matchingExams[0].endDate}`
                    : "",
              }
            : undefined,
      } as any,
      readOnly: isPosted || (!canEdit && (!staffLinkId || Boolean(sec.assignedFaculty[0]?.staffLinkId && staffLinkId !== sec.assignedFaculty[0]?.staffLinkId))),
    });
  }

  function openExamDrilldown(examId: number) {
    setSelectedExamDetailId(examId);
    setExamDrilldownSearch("");
    setExamDrilldownStatus("all");
    setExamDrilldownBranch("all");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", "pending_report");
      url.searchParams.set("examId", String(examId));
      window.history.pushState({}, "", url.toString());
    }
  }

  function closeExamDrilldown() {
    setSelectedExamDetailId(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("examId");
      window.history.pushState({}, "", url.toString());
    }
  }

  // Handle Approver Action (Approve / Reject / Return)
  async function handleConfirmApprovalAction() {
    if (!approvalDialog.submissionId || !approvalDialog.action) return;

    if (approvalDialog.action !== "approve" && !approvalDialog.comments.trim()) {
      alert("Please enter comments explaining the reason for rejection/return.");
      return;
    }

    setApprovalDialog((prev) => ({ ...prev, busy: true }));
    try {
      const res = await apiFetch(`/internal-marks/submissions/${approvalDialog.submissionId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: approvalDialog.action,
          comments: approvalDialog.comments.trim(),
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Failed to process approval action");
      }

      setApprovalDialog({ open: false, comments: "", busy: false });
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to process action");
      setApprovalDialog((prev) => ({ ...prev, busy: false }));
    }
  }

  // Handle Forward to EMS / Retry Forward to EMS
  async function handleForwardToEms(submissionId: number) {
    if (
      !confirm(
        "Are you sure you want to Forward these internal marks to the EMS Database? This will update the EMS database and lock local marks editing."
      )
    ) {
      return;
    }

    setForwardingBusyId(submissionId);
    try {
      const res = await apiFetch(`/internal-marks/submissions/${submissionId}/forward-to-ems`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error || body.message || "Failed to forward internal marks to EMS");
      }

      alert(body.message || "Internal marks forwarded and synced to EMS successfully!");
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "EMS Sync Failed");
      await loadData();
    } finally {
      setForwardingBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Internal Marks"
        description="View assigned subjects, enter student internal marks, submit for multi-level approval, and review pending submissions."
      />

      {/* Tabs */}
      <div className="flex border-b border-border overflow-x-auto scrollbar-none whitespace-nowrap gap-1">
        <button
          type="button"
          onClick={() => setActiveTab("my_subjects")}
          className={`flex items-center gap-2 border-b-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium transition shrink-0 ${
            activeTab === "my_subjects"
              ? "border-brand-600 text-brand-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <BookOpen className="h-4 w-4 shrink-0" />
          My Assigned Subjects {uniqueAssignedSubjects.length > 0 ? `(${uniqueAssignedSubjects.length})` : ""}
        </button>
        {canViewApprovals && (
          <button
            type="button"
            onClick={() => setActiveTab("pending_approvals")}
            className={`flex items-center gap-2 border-b-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium transition shrink-0 ${
              activeTab === "pending_approvals"
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Clock className="h-4 w-4 shrink-0" />
            Submissions & Approvals ({pendingSubmissions.length})
          </button>
        )}
        {canViewPendingReport && (
          <button
            type="button"
            onClick={() => setActiveTab("pending_report")}
            className={`flex items-center gap-2 border-b-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium transition shrink-0 ${
              activeTab === "pending_report"
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Bell className="h-4 w-4 shrink-0" />
            Pending List & Notifications
            {reportData?.summary ? (
              <span className="ml-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-bold">
                {reportData.summary.pendingCount} Pending
              </span>
            ) : null}
          </button>
        )}
      </div>

      {/* Tab 1: My Assigned Subjects */}
      {activeTab === "my_subjects" && (
        <div className="space-y-4">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <ContentCardSkeleton key={i} contentHeight="h-28" />
              ))}
            </div>
          ) : error ? (
            <DataErrorState message={error} />
          ) : uniqueAssignedSubjects.length === 0 ? (
            <EmptyState
              title="No assigned subjects found"
              description="No subject assignments found for your faculty profile in the current academic term."
            />
          ) : (
            <div className="space-y-4">
              {/* Notification Filter Pills Bar */}
              {relevantExams.length > 1 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setAssignedNotificationFilter("all")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                      assignedNotificationFilter === "all"
                        ? "bg-navy-900 text-white border-navy-900 shadow-xs"
                        : "bg-white text-slate-700 border-border hover:bg-slate-50"
                    }`}
                  >
                    <span>All Notifications</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        assignedNotificationFilter === "all" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {uniqueAssignedSubjects.length}
                    </span>
                  </button>
                  {relevantExams.map((ex) => {
                    const isSelected = assignedNotificationFilter === String(ex.id);
                    return (
                      <button
                        key={ex.id}
                        type="button"
                        onClick={() => setAssignedNotificationFilter(String(ex.id))}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                          isSelected
                            ? "bg-brand-600 text-white border-brand-600 shadow-xs"
                            : "bg-white text-slate-700 border-border hover:bg-slate-50"
                        }`}
                      >
                        <FileText className={`h-3.5 w-3.5 ${isSelected ? "text-white" : "text-brand-600"}`} />
                        <span>{ex.name}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                            isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {ex.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Filter & Notification Header Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-border shadow-2xs">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search subject code, name, section..."
                      value={assignedSearchQuery}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAssignedSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-border outline-none focus:border-brand-600 bg-white h-9"
                    />
                  </div>

                  {relevantExams.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-500 font-medium hidden md:inline">Notification:</span>
                      <select
                        value={assignedNotificationFilter}
                        onChange={(e) => setAssignedNotificationFilter(e.target.value)}
                        className="rounded-md border border-border px-3 py-1.5 text-xs text-slate-700 bg-white shadow-2xs outline-none focus:border-brand-600 font-medium"
                      >
                        <option value="all">All Exam Notifications ({uniqueAssignedSubjects.length})</option>
                        {relevantExams.map((ex) => (
                          <option key={ex.id} value={String(ex.id)}>
                            {ex.name} ({ex.count})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="text-xs text-slate-500 font-medium flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 text-slate-700 px-2.5 py-1 text-[11px] font-semibold">
                    {filteredAssignedSubjects.length} of {uniqueAssignedSubjects.length} Subjects • {groupedAssignedSubjects.length} {groupedAssignedSubjects.length === 1 ? "Notification" : "Notifications"}
                  </span>
                </div>
              </div>

              {filteredAssignedSubjects.length === 0 ? (
                <EmptyState
                  title="No matching subjects found"
                  description="No assigned subjects match your current search query or exam notification filter."
                />
              ) : (
                <div className="space-y-5">
                  {groupedAssignedSubjects.map((group) => (
                    <Card key={group.key} className="overflow-hidden border border-border shadow-xs rounded-xl">
                      {/* Notification Header Banner */}
                      <div className="bg-slate-50/90 border-b border-border px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <div className="p-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-700">
                            <FileText className="h-4 w-4 shrink-0" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-navy-900 text-sm">
                                {group.notificationName}
                              </h4>
                              <span className="font-bold text-[10px] uppercase bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded border border-indigo-200">
                                {group.type}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mt-0.5 flex-wrap">
                              {group.examDates && (
                                <span>
                                  <span className="text-slate-400">Dates:</span> {group.examDates}
                                </span>
                              )}
                              {group.deadline && (
                                <span className="text-amber-700 font-semibold">
                                  <span className="text-slate-400 font-medium">Deadline:</span> {group.deadline}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                          <span className="bg-white border border-slate-200 px-2.5 py-1 rounded-full text-[11px] font-bold text-slate-700 shadow-2xs">
                            {group.subjects.length} {group.subjects.length === 1 ? "Subject" : "Subjects"}
                          </span>
                        </div>
                      </div>

                      {/* Desktop Unified Table for this Notification */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-white border-b border-border text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                            <tr>
                              <th className="px-3 py-2.5 w-10 text-center">#</th>
                              <th className="px-4 py-2.5 min-w-[240px]">Subject & Code</th>
                              <th className="px-4 py-2.5 min-w-[180px]">Course & Scope</th>
                              <th className="px-3.5 py-2.5 text-center min-w-[110px]">Section</th>
                              <th className="px-3.5 py-2.5 text-center min-w-[140px]">Students Count</th>
                              <th className="px-3.5 py-2.5 min-w-[110px]">Status</th>
                              <th className="px-4 py-2.5 text-right min-w-[150px]">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border bg-white">
                            {group.subjects.map((sub, sIdx) => {
                              const isUploadEnabled = sub.accessStatus === "enabled";
                              const isDraftOrReturn =
                                sub.submissionStatus === "draft" ||
                                sub.submissionStatus === "returned" ||
                                sub.submissionStatus === "rejected";

                              return (
                                <tr
                                  key={`${sub.branchId}-${sub.subjectId}-${sub.sectionName || ""}-${sub.examNotification?.id || "none"}`}
                                  className="hover:bg-slate-50/70 transition-colors"
                                >
                                  <td className="px-3 py-3 text-center font-medium text-slate-400 text-xs">
                                    {sIdx + 1}
                                  </td>

                                  {/* Subject & Code */}
                                  <td className="px-4 py-3 align-middle">
                                    <div className="space-y-1">
                                      <div className="font-semibold text-navy-900 text-xs leading-snug">
                                        {sub.subjectName}
                                      </div>
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-mono text-[11px] font-semibold text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-200">
                                          {sub.subjectCode}
                                        </span>
                                        {sub.subjectType && (
                                          <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 uppercase font-medium">
                                            {sub.subjectType}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </td>

                                  {/* Course & Scope */}
                                  <td className="px-4 py-3 align-middle">
                                    <div className="space-y-1 text-xs text-slate-600">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded text-[11px]">
                                          {sub.branchName}
                                        </span>
                                        <span className="text-slate-700 font-medium">
                                          {sub.courseName}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        {sub.year ? (
                                          <span className="font-bold text-[10px] text-sky-800 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded">
                                            Year {sub.year}
                                          </span>
                                        ) : null}
                                        {sub.semester ? (
                                          <span className="text-[11px] text-slate-500 font-medium">
                                            Sem {sub.semester}
                                          </span>
                                        ) : null}
                                        {sub.batch ? (
                                          <span className="text-[10px] text-slate-400 font-mono">
                                            ({sub.batch})
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>
                                  </td>

                                  {/* Section */}
                                  <td className="px-3.5 py-3 align-middle text-center">
                                    {sub.sectionName ? (
                                      <span className="inline-block font-bold text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded">
                                        Section {sub.sectionName}
                                      </span>
                                    ) : sub.sections && sub.sections.length > 0 ? (
                                      <span className="inline-block font-bold text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                        Section {sub.sections.join(", ")}
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                        All / Single
                                      </span>
                                    )}
                                  </td>

                                  {/* Students Count */}
                                  <td className="px-3.5 py-3 align-middle text-center">
                                    <div className="inline-flex flex-col items-center">
                                      <span className="inline-flex items-center gap-1.5 font-bold text-xs text-slate-800 bg-slate-100/90 border border-slate-200/80 px-2.5 py-1 rounded-md">
                                        <Users className="h-3.5 w-3.5 text-brand-600 shrink-0" />
                                        <span>{sub.studentCount ?? 0} Students</span>
                                      </span>
                                      {sub.year ? (
                                        <span className="text-[10px] text-slate-500 font-medium mt-0.5">
                                          Year {sub.year} roster
                                        </span>
                                      ) : null}
                                      {sub.marksEnteredCount && sub.marksEnteredCount > 0 ? (
                                        <span className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                                          {sub.marksEnteredCount} / {sub.studentCount ?? 0} entered
                                        </span>
                                      ) : null}
                                    </div>
                                  </td>

                                  {/* Status */}
                                  <td className="px-3.5 py-3 align-middle">
                                    <StatusBadge status={sub.submissionStatus} />
                                  </td>

                                  {/* Actions */}
                                  <td className="px-4 py-3 align-middle text-right">
                                    {isUploadEnabled ? (
                                      canEdit && isDraftOrReturn ? (
                                        <Button
                                          size="sm"
                                          className="bg-brand-600 text-white hover:bg-brand-700 font-medium text-xs shadow-xs"
                                          onClick={() =>
                                            setEntryModal({
                                              open: true,
                                              subject: sub,
                                              readOnly: false,
                                            })
                                          }
                                        >
                                          <Edit3 className="h-3.5 w-3.5 mr-1" />
                                          {sub.submissionStatus === "returned"
                                            ? "Correct & Resubmit"
                                            : "Enter Marks"}
                                        </Button>
                                      ) : (
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          className="font-medium text-xs"
                                          onClick={() =>
                                            setEntryModal({
                                              open: true,
                                              subject: sub,
                                              readOnly: true,
                                            })
                                          }
                                        >
                                          <Eye className="h-3.5 w-3.5 mr-1" />
                                          View Marks
                                        </Button>
                                      )
                                    ) : (
                                      <div className="inline-flex items-center gap-1 text-slate-400 text-xs font-medium">
                                        <Lock className="h-3 w-3" />
                                        No Access
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Card Layout for this Notification */}
                      <div className="block md:hidden divide-y divide-border bg-white">
                        {group.subjects.map((sub, sIdx) => {
                          const isUploadEnabled = sub.accessStatus === "enabled";
                          const isDraftOrReturn =
                            sub.submissionStatus === "draft" ||
                            sub.submissionStatus === "returned" ||
                            sub.submissionStatus === "rejected";

                          return (
                            <div key={`${sub.branchId}-${sub.subjectId}-${sub.sectionName || ""}`} className="p-3.5 space-y-2.5">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-mono text-[10px] text-slate-400">#{sIdx + 1}</span>
                                    <span className="font-mono font-bold text-xs text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded">
                                      {sub.subjectCode}
                                    </span>
                                    <span className="text-[10px] font-semibold text-brand-800 bg-brand-50 border border-brand-200 px-1.5 py-0.5 rounded">
                                      {sub.courseName}
                                    </span>
                                    <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                                      {sub.branchName}
                                    </span>
                                  </div>
                                  <div className="font-bold text-navy-900 text-xs sm:text-sm mt-1">
                                    {sub.subjectName}
                                  </div>
                                </div>
                                <StatusBadge status={sub.submissionStatus} />
                              </div>

                              <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                                <div>
                                  {sub.sectionName ? `Section ${sub.sectionName}` : "All / Single Section"}
                                </div>
                                <div className="font-bold text-slate-700">
                                  {sub.studentCount ?? 0} Students
                                </div>
                              </div>

                              <div className="pt-1">
                                {isUploadEnabled ? (
                                  canEdit && isDraftOrReturn ? (
                                    <Button
                                      size="sm"
                                      className="w-full justify-center bg-brand-600 text-white hover:bg-brand-700 font-medium text-xs shadow-xs"
                                      onClick={() =>
                                        setEntryModal({
                                          open: true,
                                          subject: sub,
                                          readOnly: false,
                                        })
                                      }
                                    >
                                      <Edit3 className="h-3.5 w-3.5 mr-1" />
                                      {sub.submissionStatus === "returned"
                                        ? "Correct & Resubmit"
                                        : "Enter Marks"}
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      className="w-full justify-center font-medium text-xs"
                                      onClick={() =>
                                        setEntryModal({
                                          open: true,
                                          subject: sub,
                                          readOnly: true,
                                        })
                                      }
                                    >
                                      <Eye className="h-3.5 w-3.5 mr-1" />
                                      View Marks
                                    </Button>
                                  )
                                ) : (
                                  <div className="text-center text-slate-400 text-xs py-1">
                                    No Access
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Pending Submissions & Approvals */}
      {activeTab === "pending_approvals" && (
        <Card className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-navy-900">Submitted Internal Marks Packages</h3>
              <p className="text-xs text-slate-500">Review internal marks submissions awaiting approval or monitor submission history.</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => void loadData()} className="self-start sm:self-auto">
              Refresh
            </Button>
          </div>

          {loading ? (
            <TableSkeleton columns={5} rows={5} showHeader />
          ) : pendingSubmissions.length === 0 ? (
            <EmptyState title="No submissions found" description="No internal marks submissions matching your access scope." />
          ) : (
            <>
              {/* Mobile View: Cards List */}
              <div className="block md:hidden space-y-3">
                {pendingSubmissions.map((sub) => (
                  <div key={sub.id} className="rounded-lg border border-border bg-white p-3.5 space-y-2.5 shadow-2xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-[11px] font-semibold uppercase text-brand-700 bg-brand-50 px-2 py-0.5 rounded">
                          {sub.subjectCode}
                        </span>
                        <h4 className="font-semibold text-navy-900 text-sm mt-1">{sub.subjectName}</h4>
                      </div>
                      <StatusBadge status={sub.status} />
                    </div>

                    <div className="text-xs text-slate-500 space-y-0.5 border-t border-slate-100 pt-2">
                      <div><span className="font-medium text-slate-700">Faculty:</span> {sub.facultyName}</div>
                      <div><span className="font-medium text-slate-700">Scope:</span> {sub.collegeName} • {sub.branchName}</div>
                      <div className="flex items-center justify-between pt-1">
                        <span className="font-semibold text-slate-800">{sub.studentCount} Students</span>
                        <span className="text-[11px] text-slate-500">Level {sub.currentApprovalLevel} Approval</span>
                      </div>
                      {sub.submittedAt && (
                        <div className="text-[11px] text-slate-400 pt-0.5">Submitted: {sub.submittedAt}</div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="flex-1 justify-center h-9"
                        onClick={() =>
                          setEntryModal({
                            open: true,
                            subject: sub,
                            readOnly: true,
                          })
                        }
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        View
                      </Button>

                      {canEdit && (sub.status === "pending_approval" || sub.status === "approved" || sub.status === "ems_sync_failed") && (
                        <>
                          {sub.status === "ems_sync_failed" ? (
                            <Button
                              size="sm"
                              className="flex-1 justify-center bg-amber-600 text-white hover:bg-amber-700 h-9 font-semibold"
                              disabled={forwardingBusyId === sub.id}
                              onClick={() => void handleForwardToEms(sub.id)}
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1" />
                              {forwardingBusyId === sub.id ? "Syncing..." : "Retry EMS"}
                            </Button>
                          ) : sub.status === "approved" || sub.currentApprovalLevel >= maxApprovalLevel ? (
                            <Button
                              size="sm"
                              className="flex-1 justify-center bg-primary text-white hover:bg-primary-hover h-9 font-semibold"
                              disabled={forwardingBusyId === sub.id}
                              onClick={() => void handleForwardToEms(sub.id)}
                            >
                              <CheckCircle className="h-3.5 w-3.5 mr-1" />
                              {forwardingBusyId === sub.id ? "Forwarding..." : "To EMS"}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              className="flex-1 justify-center bg-green-600 text-white hover:bg-green-700 h-9 font-semibold"
                              onClick={() =>
                                setApprovalDialog({
                                  open: true,
                                  submissionId: sub.id,
                                  action: "approve",
                                  comments: "Approved",
                                  busy: false,
                                })
                              }
                            >
                              <CheckCircle className="h-3.5 w-3.5 mr-1" />
                              Approve
                            </Button>
                          )}

                          {sub.status === "pending_approval" && (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="flex-1 justify-center text-amber-700 border-amber-300 hover:bg-amber-50 h-9"
                              onClick={() =>
                                setApprovalDialog({
                                  open: true,
                                  submissionId: sub.id,
                                  action: "return",
                                  comments: "",
                                  busy: false,
                                })
                              }
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1" />
                              Return
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop View: Full Data Table */}
              <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-border">
                    <tr>
                      <th className="px-4 py-3">Subject & Code</th>
                      <th className="px-4 py-3">Faculty & Scope</th>
                      <th className="px-4 py-3">Students</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Submitted At</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-xs">
                    {pendingSubmissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 align-top">
                          <div className="font-semibold text-navy-900">{sub.subjectName}</div>
                          <div className="font-mono text-slate-500">{sub.subjectCode}</div>
                        </td>

                        <td className="px-4 py-3 align-top">
                          <div className="font-medium text-slate-800">{sub.facultyName}</div>
                          <div className="text-slate-500">{sub.collegeName} • {sub.branchName}</div>
                        </td>

                        <td className="px-4 py-3 align-top font-semibold text-slate-800">
                          {sub.studentCount} Students
                        </td>

                        <td className="px-4 py-3 align-top">
                          <StatusBadge status={sub.status} />
                          <div className="text-[11px] text-slate-500 mt-1">Level {sub.currentApprovalLevel} Approval</div>
                        </td>

                        <td className="px-4 py-3 align-top text-slate-500">
                          {sub.submittedAt || "—"}
                        </td>

                        <td className="px-4 py-3 align-top text-right space-x-1">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              setEntryModal({
                                open: true,
                                subject: sub,
                                readOnly: true,
                              })
                            }
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            View
                          </Button>

                          {canEdit && (sub.status === "pending_approval" || sub.status === "approved" || sub.status === "ems_sync_failed") && (
                            <>
                              {sub.status === "ems_sync_failed" ? (
                                <Button
                                  size="sm"
                                  className="bg-amber-600 text-white hover:bg-amber-700"
                                  disabled={forwardingBusyId === sub.id}
                                  onClick={() => void handleForwardToEms(sub.id)}
                                >
                                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                                  {forwardingBusyId === sub.id ? "Syncing..." : "Retry Forward to EMS"}
                                </Button>
                              ) : sub.status === "approved" || sub.currentApprovalLevel >= maxApprovalLevel ? (
                                <Button
                                  size="sm"
                                  className="bg-primary text-white hover:bg-primary-hover"
                                  disabled={forwardingBusyId === sub.id}
                                  onClick={() => void handleForwardToEms(sub.id)}
                                >
                                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                  {forwardingBusyId === sub.id ? "Forwarding..." : "Forward to EMS"}
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  className="bg-green-600 text-white hover:bg-green-700"
                                  onClick={() =>
                                    setApprovalDialog({
                                      open: true,
                                      submissionId: sub.id,
                                      action: "approve",
                                      comments: "Approved",
                                      busy: false,
                                    })
                                  }
                                >
                                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                  Approve
                                </Button>
                              )}

                              {sub.status === "pending_approval" && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="text-amber-700 border-amber-300 hover:bg-amber-50"
                                  onClick={() =>
                                    setApprovalDialog({
                                      open: true,
                                      submissionId: sub.id,
                                      action: "return",
                                      comments: "",
                                      busy: false,
                                    })
                                  }
                                >
                                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                                  Return
                                </Button>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      )}

      {/* Tab 3: Released Exam Notifications & Pending Posting Report */}
      {activeTab === "pending_report" && (
        <div className="space-y-4">
          {/* Header & Refresh - only shown on overview */}
          {selectedExamDetailId === null && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-border shadow-2xs">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-semibold text-navy-900 flex items-center gap-2">
                    <Bell className="h-5 w-5 text-brand-600" />
                    Exam Notifications & Pending Marks Report
                  </h3>
                  {leadershipScopeLabel && (
                    <span className="inline-flex items-center gap-1 font-bold text-xs text-brand-800 bg-brand-50 border border-brand-200 px-2.5 py-0.5 rounded-full">
                      <School className="h-3.5 w-3.5 text-brand-600" />
                      {leadershipScopeLabel}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Track released exam notifications, exam start and end dates, submission deadlines, and monitor which faculty members have posted vs pending internal marks.
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => void loadData()} className="self-start sm:self-auto shrink-0">
                Refresh Report
              </Button>
            </div>
          )}

          {loading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <ContentCardSkeleton key={i} contentHeight="h-20" />
                ))}
              </div>
              <ContentCardSkeleton contentHeight="h-64" />
            </div>
          ) : error ? (
            <DataErrorState message={error} />
          ) : !reportData ? (
            <EmptyState title="No report data available" description="Unable to load notifications and pending posting data." />
          ) : selectedExamDetailId !== null && selectedExam ? (
            <div className="space-y-4">
              {/* Single Compact Exam Header Banner */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white px-4 py-3 rounded-xl border border-border shadow-2xs">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={closeExamDrilldown}
                    className="h-8 text-xs font-semibold text-slate-700 hover:text-slate-900 border-slate-300 shadow-2xs"
                  >
                    <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                    Back
                  </Button>
                  <div className="h-4 w-px bg-slate-200 hidden sm:block" />
                  <span className="font-bold text-navy-900 text-sm sm:text-base">
                    {selectedExam.name}
                  </span>
                  <span className="bg-indigo-100 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded text-[11px] font-bold uppercase">
                    {selectedExam.examCategory}
                  </span>
                  <span className="text-[11px] text-slate-500 capitalize">
                    ({selectedExam.type})
                  </span>
                  <span className="font-semibold text-xs text-brand-700 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded">
                    {selectedExam.course} • Year {selectedExam.yearOfStudy || "-"}, Sem {selectedExam.semester || "-"}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs self-start lg:self-auto flex-wrap">
                  <div className="text-slate-600 text-[11px]">
                    <span className="font-medium text-slate-400">Dates: </span>
                    <span className="font-bold text-slate-800">
                      {selectedExam.examinationStartDate || "TBD"} – {selectedExam.examinationEndDate || "TBD"}
                    </span>
                    {selectedExam.applicationEndDate && (
                      <span className="text-red-600 font-medium ml-2">
                        (Deadline: {selectedExam.applicationEndDate})
                      </span>
                    )}
                  </div>
                  <div className="h-4 w-px bg-slate-200 hidden sm:block" />
                  <div className="flex items-center gap-1.5 font-semibold text-xs">
                    <span className="text-slate-700">{examMatchingSubjects.length} Subjects</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-emerald-700">{examPostedCount} Posted</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-amber-700">{examPendingCount} Pending</span>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => void loadData()} className="h-7 text-xs">
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Drilldown Filter & Search Bar */}
              <Card className="p-3 space-y-2.5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 text-xs">
                  <div className="flex flex-wrap items-center gap-2 flex-1">
                    {/* Search */}
                    <div className="relative min-w-[200px] flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search subject code, name, faculty..."
                        value={examDrilldownSearch}
                        onChange={(e) => setExamDrilldownSearch(e.target.value)}
                        className="h-8 w-full rounded border border-border bg-white pl-8 pr-2.5 text-xs text-slate-800 outline-none focus:border-brand-600"
                      />
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center rounded-lg border border-border bg-slate-100 p-0.5">
                      <button
                        type="button"
                        onClick={() => setExamDrilldownStatus("all")}
                        className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                          examDrilldownStatus === "all" ? "bg-white text-navy-900 shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        All ({examMatchingSubjects.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setExamDrilldownStatus("pending")}
                        className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                          examDrilldownStatus === "pending" ? "bg-amber-500 text-white font-bold" : "text-amber-800 hover:text-amber-950"
                        }`}
                      >
                        Pending ({examPendingCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setExamDrilldownStatus("posted")}
                        className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                          examDrilldownStatus === "posted" ? "bg-emerald-600 text-white font-bold" : "text-emerald-800 hover:text-emerald-950"
                        }`}
                      >
                        Posted ({examPostedCount})
                      </button>
                    </div>

                    {/* Course Filter dropdown */}
                    {examCourses.length > 1 && (
                      <select
                        value={examDrilldownCourse}
                        onChange={(e) => {
                          setExamDrilldownCourse(e.target.value);
                          setExamDrilldownBranch("all");
                        }}
                        className="h-8 rounded border border-border bg-white px-2 text-xs font-medium text-slate-800 outline-none focus:border-brand-600 cursor-pointer"
                      >
                        <option value="all">All Courses ({examCourses.length})</option>
                        {examCourses.map((c) => (
                          <option key={c.id} value={String(c.id)}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    )}

                    {/* Branch Filter dropdown */}
                    {examBranches.length > 1 && (
                      <select
                        value={examDrilldownBranch}
                        onChange={(e) => setExamDrilldownBranch(e.target.value)}
                        className="h-8 rounded border border-border bg-white px-2 text-xs font-medium text-slate-800 outline-none focus:border-brand-600 cursor-pointer"
                      >
                        <option value="all">All Branches ({examBranches.length})</option>
                        {examBranches.map((b) => (
                          <option key={b.id} value={String(b.id)}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    )}

                    {/* Year Filter dropdown */}
                    {examYears.length > 1 && (
                      <select
                        value={examDrilldownYear}
                        onChange={(e) => setExamDrilldownYear(e.target.value)}
                        className="h-8 rounded border border-border bg-white px-2 text-xs font-medium text-slate-800 outline-none focus:border-brand-600 cursor-pointer"
                      >
                        <option value="all">All Years</option>
                        {examYears.map((yr) => (
                          <option key={yr} value={String(yr)}>
                            Year {yr}
                          </option>
                        ))}
                      </select>
                    )}

                    {/* Semester Filter dropdown */}
                    {examSemesters.length > 1 && (
                      <select
                        value={examDrilldownSem}
                        onChange={(e) => setExamDrilldownSem(e.target.value)}
                        className="h-8 rounded border border-border bg-white px-2 text-xs font-medium text-slate-800 outline-none focus:border-brand-600 cursor-pointer"
                      >
                        <option value="all">All Sems</option>
                        {examSemesters.map((sem) => (
                          <option key={sem} value={String(sem)}>
                            Sem {sem}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="text-slate-500 text-[11px] font-medium shrink-0 self-end md:self-auto">
                    Showing <span className="font-bold text-slate-800">{examFilteredSubjects.length}</span> of <span className="font-bold text-slate-800">{examMatchingSubjects.length}</span> subjects
                  </div>
                </div>
              </Card>

              {/* Single Unified Exam Subjects Table with Expandable Section Breakdown */}
              {examFilteredSubjects.length === 0 ? (
                <EmptyState
                  title="No subjects match this filter"
                  description="Try selecting a different branch, clearing the search query, or switching the status filter."
                />
              ) : (
                <Card className="overflow-hidden border border-border shadow-xs">
                  {/* Table Control Header */}
                  <div className="bg-slate-50 border-b border-border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Layers className="h-5 w-5 text-brand-600 shrink-0" />
                      <span className="font-bold text-sm sm:text-base text-navy-900">
                        Exam Subjects & Section Breakdown
                      </span>
                      <span className="font-semibold text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                        {examFilteredSubjects.length} Subjects Total
                      </span>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={expandAllSubjects}
                        className="h-7 text-xs font-medium"
                      >
                        <ChevronDown className="h-3.5 w-3.5 mr-1" />
                        Expand All Sections
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={collapseAllSubjects}
                        className="h-7 text-xs font-medium"
                      >
                        Collapse All
                      </Button>
                    </div>
                  </div>

                  {/* Desktop Single Unified Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/70 text-[11px] font-semibold uppercase text-slate-500 border-b border-border">
                        <tr>
                          <th className="px-3 py-2.5 w-8"></th>
                          <th className="px-3 py-2.5 w-10">#</th>
                          <th className="px-3.5 py-2.5 min-w-[220px]">Subject & Code</th>
                          <th className="px-3.5 py-2.5">Course, Branch & Term</th>
                          <th className="px-3.5 py-2.5">Type</th>
                          <th className="px-3.5 py-2.5">Sections Breakdown</th>
                          <th className="px-3.5 py-2.5">Assigned Faculty</th>
                          <th className="px-3.5 py-2.5">Status</th>
                          <th className="px-3.5 py-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {examFilteredSubjects.map((sub, sIdx) => {
                          const subKey = `${sub.branchId}-${sub.subjectId}`;
                          const isExpanded = expandedSubjectKeys.has(subKey);
                          const breakdown = getSubjectBreakdown(sub);
                          const postedCount = breakdown.filter((s) => s.postingStatus === "posted").length;
                          const isAllPosted = postedCount === breakdown.length && breakdown.length > 0;

                          return (
                            <Fragment key={subKey}>
                              {/* Main Subject Row */}
                              <tr
                                onClick={() => toggleSubjectExpand(subKey)}
                                className={`cursor-pointer transition hover:bg-slate-50/80 ${
                                  isExpanded ? "bg-indigo-50/30 font-medium" : ""
                                }`}
                              >
                                <td className="px-3 py-3 text-center align-top">
                                  <ChevronRight
                                    className={`h-4 w-4 text-slate-400 transition-transform duration-150 inline-block ${
                                      isExpanded ? "rotate-90 text-brand-600" : ""
                                    }`}
                                  />
                                </td>
                                <td className="px-3 py-3 text-slate-400 font-mono align-top">{sIdx + 1}</td>
                                <td className="px-3.5 py-3 align-top">
                                  <div className="font-bold text-navy-900 text-xs sm:text-sm">{sub.subjectName}</div>
                                  <div className="font-mono text-slate-500 text-[11px]">{sub.subjectCode}</div>
                                </td>
                                <td className="px-3.5 py-3 align-top">
                                  <div className="font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-[10px] text-brand-700 bg-brand-50 border border-brand-200 px-1.5 py-0.5 rounded">
                                      {sub.courseName}
                                    </span>
                                    <span className="text-navy-900 font-bold">{sub.branchName}</span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                                    Year {sub.year || "-"}, Sem {sub.semester || "-"}
                                  </div>
                                </td>
                                <td className="px-3.5 py-3 align-top">
                                  <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[11px] font-medium capitalize">
                                    {sub.subjectType || "Theory"}
                                  </span>
                                </td>
                                <td className="px-3.5 py-3 align-top">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {breakdown.map((sec) => (
                                      <span
                                        key={sec.sectionName}
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                                          sec.postingStatus === "posted"
                                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                            : sec.submission?.status === "draft"
                                            ? "bg-blue-50 text-blue-800 border-blue-200"
                                            : "bg-amber-50 text-amber-800 border-amber-200"
                                        }`}
                                        title={`Section ${sec.sectionName}: ${sec.studentCount ?? 0} students`}
                                      >
                                        <span>Sec {sec.sectionName}</span>
                                        <span className="text-[9px] font-mono font-bold px-1 py-0.2 rounded bg-black/5 text-slate-700">
                                          {sec.studentCount ?? 0}
                                        </span>
                                      </span>
                                    ))}
                                  </div>
                                  {sub.studentCount != null && sub.studentCount > 0 && (
                                    <div className="text-[10px] text-slate-500 font-medium mt-1 flex items-center gap-1">
                                      <Users className="h-3 w-3 text-slate-400" />
                                      <span>Total: <strong className="text-slate-800">{sub.studentCount}</strong> students</span>
                                    </div>
                                  )}
                                </td>
                                <td className="px-3.5 py-3 align-top">
                                  {sub.assignedFaculty.length > 0 ? (
                                    <div className="space-y-0.5">
                                      {sub.assignedFaculty.map((f) => (
                                        <div key={f.staffLinkId} className="font-medium text-slate-800">
                                          {f.displayName}{" "}
                                          {f.employeeCode ? (
                                            <span className="font-mono text-[10px] text-slate-400">({f.employeeCode})</span>
                                          ) : null}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-red-500 italic font-medium">Unassigned</span>
                                  )}
                                </td>
                                <td className="px-3.5 py-3 align-top">
                                  {isAllPosted ? (
                                    <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded text-[10px] uppercase">
                                      <CheckCircle2 className="h-3 w-3" />
                                      All Posted ({postedCount}/{breakdown.length})
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 font-bold text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded text-[10px] uppercase">
                                      <Clock className="h-3 w-3" />
                                      {postedCount} / {breakdown.length} Posted
                                    </span>
                                  )}
                                </td>
                                <td className="px-3.5 py-3 align-top text-right">
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="h-7 text-xs font-semibold"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleSubjectExpand(subKey);
                                    }}
                                  >
                                    <span>Sections ({breakdown.length})</span>
                                    <ChevronDown
                                      className={`h-3.5 w-3.5 ml-1 transition-transform ${
                                        isExpanded ? "rotate-180" : ""
                                      }`}
                                    />
                                  </Button>
                                </td>
                              </tr>

                              {/* Expandable Dropdown Row for Section Breakdown */}
                              {isExpanded && (
                                <tr key={`${subKey}-dropdown`} className="bg-slate-50/70 border-b border-border/80">
                                  <td colSpan={9} className="p-3 pl-8">
                                    <div className="rounded-lg border border-border bg-white shadow-xs overflow-hidden">
                                      <div className="bg-slate-100/70 px-3.5 py-2 border-b border-border flex items-center justify-between text-xs">
                                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                                          <GraduationCap className="h-4 w-4 text-brand-600" />
                                          <span>
                                            Section Breakdown — {sub.subjectName} ({sub.branchName}, Y{sub.year} S{sub.semester})
                                          </span>
                                        </div>
                                        <span className="text-[11px] text-slate-500 font-medium">
                                          {breakdown.length} Section{breakdown.length > 1 ? "s" : ""} Total
                                        </span>
                                      </div>

                                      <div className="divide-y divide-border">
                                        {breakdown.map((sec) => {
                                          const isSecPosted = sec.postingStatus === "posted";
                                          return (
                                            <div
                                              key={sec.sectionName}
                                              className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition"
                                            >
                                              <div className="flex items-start sm:items-center gap-3">
                                                <div className="flex flex-col items-center">
                                                  <span className="inline-flex items-center justify-center font-bold text-xs bg-brand-50 text-brand-800 border border-brand-200 rounded px-2.5 py-1 min-w-[80px]">
                                                    Section {sec.sectionName}
                                                  </span>
                                                  <span className="text-[10px] font-bold text-brand-700 bg-brand-50/50 px-1.5 py-0.2 rounded border border-brand-100 mt-1">
                                                    {sec.studentCount ?? 0} Students
                                                  </span>
                                                </div>

                                                <div>
                                                  <div className="font-semibold text-slate-800 text-xs">
                                                    {sec.assignedFaculty.length > 0 ? (
                                                      <span>
                                                        {sec.assignedFaculty.map((f) => (
                                                          <span key={f.staffLinkId} className="mr-3">
                                                            {f.displayName}{" "}
                                                            {f.employeeCode ? (
                                                              <span className="font-mono text-[10px] text-slate-400">
                                                                ({f.employeeCode})
                                                              </span>
                                                            ) : null}
                                                            {f.departmentName ? (
                                                              <span className="text-[10px] text-slate-400 font-normal ml-1">
                                                                [{f.departmentName}]
                                                              </span>
                                                            ) : null}
                                                          </span>
                                                        ))}
                                                      </span>
                                                    ) : (
                                                      <span className="text-red-500 italic font-medium">
                                                        Unassigned
                                                      </span>
                                                    )}
                                                  </div>

                                                  <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                                    {isSecPosted && sec.submission ? (
                                                      <span className="text-emerald-700 font-medium flex items-center gap-1">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        Posted:{" "}
                                                        {sec.submission.submittedAt
                                                          ? sec.submission.submittedAt.split("T")[0]
                                                          : "Recorded"}
                                                        {sec.submission.studentCount > 0
                                                          ? ` (${sec.submission.studentCount} students)`
                                                          : ""}
                                                      </span>
                                                    ) : sec.submission?.status === "draft" ? (
                                                      <span className="text-blue-700 font-medium flex items-center gap-1">
                                                        <Clock className="h-3 w-3" /> Draft saved
                                                        {sec.submission.studentCount > 0
                                                          ? ` (${sec.submission.studentCount} students)`
                                                          : ""}
                                                      </span>
                                                    ) : (
                                                      <span className="text-amber-700 font-medium flex items-center gap-1">
                                                        <Clock className="h-3 w-3" /> Marks Not Posted Yet
                                                        {sec.studentCount != null && sec.studentCount > 0 ? (
                                                          <span className="text-slate-500 font-normal">({sec.studentCount} enrolled students)</span>
                                                        ) : null}
                                                      </span>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>

                                              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                                                <Button
                                                  size="sm"
                                                  variant={isSecPosted ? "secondary" : "primary"}
                                                  className={`h-7 text-xs font-semibold ${
                                                    !isSecPosted
                                                      ? "bg-brand-600 text-white hover:bg-brand-700"
                                                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                                  }`}
                                                  onClick={() => handleOpenSectionEntry(sub, sec)}
                                                >
                                                  <Edit3 className="h-3.5 w-3.5 mr-1" />
                                                  {isSecPosted
                                                    ? `View Marks (Sec ${sec.sectionName})`
                                                    : `Enter Marks (Sec ${sec.sectionName})`}
                                                </Button>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Single Card List with Expandable Section Breakdown */}
                  <div className="block md:hidden divide-y divide-border">
                    {examFilteredSubjects.map((sub, sIdx) => {
                      const subKey = `${sub.branchId}-${sub.subjectId}`;
                      const isExpanded = expandedSubjectKeys.has(subKey);
                      const breakdown = getSubjectBreakdown(sub);
                      const postedCount = breakdown.filter((s) => s.postingStatus === "posted").length;
                      const isAllPosted = postedCount === breakdown.length && breakdown.length > 0;

                      return (
                        <div key={subKey} className="p-3.5 space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono text-[10px] text-slate-400">#{sIdx + 1}</span>
                                <span className="font-mono font-bold text-xs text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded">
                                  {sub.subjectCode}
                                </span>
                                <span className="text-[10px] font-semibold text-brand-800 bg-brand-50 border border-brand-200 px-1.5 py-0.5 rounded">
                                  {sub.courseName}
                                </span>
                                <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                                  {sub.branchName} • Y{sub.year || "-"} S{sub.semester || "-"}
                                </span>
                                <span className="text-[10px] text-slate-500 capitalize bg-slate-100 px-1.5 py-0.2 rounded">
                                  {sub.subjectType || "Theory"}
                                </span>
                              </div>
                              <div className="font-bold text-navy-900 text-xs sm:text-sm mt-1">
                                {sub.subjectName}
                              </div>
                            </div>

                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                                isAllPosted
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                  : "bg-amber-100 text-amber-800 border border-amber-200"
                              }`}
                            >
                              {isAllPosted ? "Posted" : `${postedCount}/${breakdown.length} Posted`}
                            </span>
                          </div>

                          {/* Section breakdown pills & toggle button */}
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="text-[10px] font-medium text-slate-500">Sections:</span>
                              {breakdown.map((sec) => (
                                <span
                                  key={sec.sectionName}
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${
                                    sec.postingStatus === "posted"
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : "bg-amber-50 text-amber-700 border-amber-200"
                                  }`}
                                >
                                  <span>{sec.sectionName}</span>
                                  <span className="text-[9px] opacity-75">({sec.studentCount ?? 0})</span>
                                </span>
                              ))}
                            </div>

                            <button
                              type="button"
                              onClick={() => toggleSubjectExpand(subKey)}
                              className="text-xs text-brand-600 font-semibold flex items-center gap-0.5 hover:underline"
                            >
                              <span>{isExpanded ? "Hide Breakdown" : `View Sections (${breakdown.length})`}</span>
                              <ChevronDown
                                className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                              />
                            </button>
                          </div>

                          {/* Mobile Expanded Sections List */}
                          {isExpanded && (
                            <div className="mt-2 space-y-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                              {breakdown.map((sec) => {
                                const isSecPosted = sec.postingStatus === "posted";
                                return (
                                  <div
                                    key={sec.sectionName}
                                    className="bg-white p-2.5 rounded border border-border space-y-1.5"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold text-xs bg-brand-50 text-brand-800 border border-brand-200 rounded px-2 py-0.5">
                                          Section {sec.sectionName}
                                        </span>
                                        <span className="text-[10px] font-bold text-brand-700 bg-brand-50/50 px-1.5 py-0.2 rounded border border-brand-100">
                                          {sec.studentCount ?? 0} Students
                                        </span>
                                      </div>
                                      <span
                                        className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                          isSecPosted ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                                        }`}
                                      >
                                        {isSecPosted ? "Posted" : "Pending"}
                                      </span>
                                    </div>

                                    <div className="text-[11px] text-slate-700">
                                      <span className="font-medium text-slate-500">Faculty: </span>
                                      {sec.assignedFaculty.length > 0 ? (
                                        <span className="font-semibold text-slate-800">
                                          {sec.assignedFaculty.map((f) => f.displayName).join(", ")}
                                        </span>
                                      ) : (
                                        <span className="text-red-500 italic font-medium">Unassigned</span>
                                      )}
                                    </div>

                                    {isSecPosted && sec.submission && (
                                      <div className="text-[10px] text-emerald-700 font-medium">
                                        Submitted:{" "}
                                        {sec.submission.submittedAt
                                          ? sec.submission.submittedAt.split("T")[0]
                                          : "Recorded"}{" "}
                                        ({sec.submission.studentCount} students)
                                      </div>
                                    )}

                                    <Button
                                      size="sm"
                                      className={`w-full justify-center h-7 text-xs font-semibold ${
                                        isSecPosted
                                          ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                          : "bg-brand-600 text-white hover:bg-brand-700"
                                      }`}
                                      onClick={() => handleOpenSectionEntry(sub, sec)}
                                    >
                                      <Edit3 className="h-3 w-3 mr-1" />
                                      {isSecPosted
                                        ? `View Marks (Sec ${sec.sectionName})`
                                        : `Enter Marks (Sec ${sec.sectionName})`}
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
            </div>
          ) : (
            <>
              {/* Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="p-3.5 space-y-1">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Subjects</div>
                  <div className="text-2xl font-black text-navy-900">{reportData.summary.totalSubjects}</div>
                  <div className="text-[10px] text-slate-400">Curriculum mappings</div>
                </Card>

                <Card className="p-3.5 space-y-1 border-emerald-200 bg-emerald-50/20">
                  <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider flex items-center justify-between">
                    <span>Posted / Submitted</span>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-black text-emerald-800">{reportData.summary.postedCount}</div>
                  <div className="text-[10px] text-emerald-600">Marks submitted or approved</div>
                </Card>

                <Card className="p-3.5 space-y-1 border-amber-200 bg-amber-50/20">
                  <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider flex items-center justify-between">
                    <span>Pending Posting</span>
                    <Clock className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="text-2xl font-black text-amber-800">{reportData.summary.pendingCount}</div>
                  <div className="text-[10px] text-amber-600">Awaiting faculty entry</div>
                </Card>

                <Card className="p-3.5 space-y-1">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    <span>Completion Rate</span>
                    <BarChart3 className="h-4 w-4 text-brand-600" />
                  </div>
                  <div className="text-2xl font-black text-brand-700">{reportData.summary.completionPercentage}%</div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                    <div
                      className="bg-brand-600 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${reportData.summary.completionPercentage}%` }}
                    />
                  </div>
                </Card>
              </div>

              {/* Exam-Wise Tabular Overview */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-navy-900 flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-brand-600" />
                      Internal Exam Notifications ({filteredReportNotifications.length})
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Summary table of published mid & internal examinations. Click any exam to filter the subject-wise table below.
                    </p>
                  </div>
                  {reportFilterExamId !== "all" && (
                    <button
                      type="button"
                      onClick={() => setReportFilterExamId("all")}
                      className="text-xs text-brand-600 hover:text-brand-800 font-semibold underline self-start sm:self-auto"
                    >
                      Clear Filter (Show All Exams)
                    </button>
                  )}
                </div>

                {/* Course, Branch, Year, Semester Filter Bar */}
                <div className="flex flex-wrap items-center gap-2 p-3 bg-white rounded-lg border border-border shadow-2xs">
                  {/* Course Filter */}
                  <select
                    value={reportFilterCourse}
                    onChange={(e) => {
                      setReportFilterCourse(e.target.value);
                      setReportFilterBranch("all");
                    }}
                    className="h-8 rounded border border-border bg-white px-2.5 text-xs font-medium text-slate-800 outline-none focus:border-brand-600 cursor-pointer"
                  >
                    <option value="all">All Courses ({reportAvailableCourses.length})</option>
                    {reportAvailableCourses.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  {/* Branch Filter */}
                  <select
                    value={reportFilterBranch}
                    onChange={(e) => setReportFilterBranch(e.target.value)}
                    className="h-8 rounded border border-border bg-white px-2.5 text-xs font-medium text-slate-800 outline-none focus:border-brand-600 cursor-pointer"
                  >
                    <option value="all">All Branches ({reportAvailableBranches.length})</option>
                    {reportAvailableBranches.map((b) => (
                      <option key={b.id} value={String(b.id)}>
                        {b.name}
                      </option>
                    ))}
                  </select>

                  {/* Year Filter */}
                  <select
                    value={reportFilterYear}
                    onChange={(e) => setReportFilterYear(e.target.value)}
                    className="h-8 rounded border border-border bg-white px-2.5 text-xs font-medium text-slate-800 outline-none focus:border-brand-600 cursor-pointer"
                  >
                    <option value="all">All Years</option>
                    {reportAvailableYears.map((yr) => (
                      <option key={yr} value={String(yr)}>
                        Year {yr}
                      </option>
                    ))}
                  </select>

                  {/* Semester Filter */}
                  <select
                    value={reportFilterSem}
                    onChange={(e) => setReportFilterSem(e.target.value)}
                    className="h-8 rounded border border-border bg-white px-2.5 text-xs font-medium text-slate-800 outline-none focus:border-brand-600 cursor-pointer"
                  >
                    <option value="all">All Semesters</option>
                    {reportAvailableSemesters.map((sem) => (
                      <option key={sem} value={String(sem)}>
                        Sem {sem}
                      </option>
                    ))}
                  </select>

                  {(reportFilterCourse !== "all" ||
                    reportFilterBranch !== "all" ||
                    reportFilterYear !== "all" ||
                    reportFilterSem !== "all") && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setReportFilterCourse("all");
                        setReportFilterBranch("all");
                        setReportFilterYear("all");
                        setReportFilterSem("all");
                      }}
                      className="h-8 text-xs font-semibold text-slate-600 hover:text-slate-900"
                    >
                      Reset Filters
                    </Button>
                  )}

                  <div className="ml-auto text-slate-500 text-[11px] font-medium">
                    Showing <span className="font-bold text-slate-800">{filteredReportNotifications.length}</span> of{" "}
                    <span className="font-bold text-slate-800">{reportData.notifications.length}</span> exams
                  </div>
                </div>

                {filteredReportNotifications.length === 0 ? (
                  <Card className="p-4 text-center text-xs text-slate-500">
                    No active published internal exam notifications found matching the selected filters.
                  </Card>
                ) : (
                  <>
                    {/* Desktop Exam-Wise Table */}
                    <div className="hidden md:block overflow-x-auto rounded-lg border border-border bg-white shadow-2xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500 border-b border-border">
                          <tr>
                            <th className="px-3 py-2.5">#</th>
                            <th className="px-3 py-2.5">Internal Exam Notification</th>
                            <th className="px-3 py-2.5">Target Scope</th>
                            <th className="px-3 py-2.5">Exam Schedule</th>
                            <th className="px-3 py-2.5">Released On</th>
                            <th className="px-3 py-2.5">Subject Progress</th>
                            <th className="px-3 py-2.5 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {filteredReportNotifications.map((notif, idx) => {
                            const isSelected = reportFilterExamId === String(notif.id);
                            return (
                              <tr
                                key={notif.id}
                                className="transition cursor-pointer hover:bg-brand-50/50"
                                onClick={() => openExamDrilldown(notif.id)}
                              >
                                <td className="px-3 py-2.5 text-slate-400 font-mono">{idx + 1}</td>
                                <td className="px-3 py-2.5 align-middle">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-navy-900 text-xs sm:text-sm">{notif.name}</span>
                                    <span className="bg-indigo-100 text-indigo-800 border border-indigo-200 px-1.5 py-0.2 rounded text-[10px] font-bold uppercase">
                                      {notif.examCategory}
                                    </span>
                                    <span className="text-[10px] text-slate-500 capitalize">({notif.type})</span>
                                  </div>
                                </td>

                                <td className="px-3 py-2.5 align-middle">
                                  <div className="text-slate-800 font-semibold">{notif.course || "All Courses"}</div>
                                  <div className="text-slate-500 text-[11px] truncate max-w-xs" title={notif.branch || ""}>
                                    {notif.branch ? `Branches: ${notif.branch}` : ""}
                                    {notif.yearOfStudy ? ` • Year ${notif.yearOfStudy}` : ""}
                                    {notif.semester ? `, Sem ${notif.semester}` : ""}
                                  </div>
                                </td>

                                <td className="px-3 py-2.5 align-middle">
                                  <div className="font-bold text-slate-800">
                                    {notif.examinationStartDate || "TBD"} – {notif.examinationEndDate || "TBD"}
                                  </div>
                                  {notif.applicationEndDate && (
                                    <div className="text-[10px] text-red-600 font-medium">
                                      Deadline: {notif.applicationEndDate}
                                    </div>
                                  )}
                                </td>

                                <td className="px-3 py-2.5 align-middle text-slate-600 font-mono text-[11px]">
                                  {notif.publishedAt || "Recorded"}
                                </td>

                                <td className="px-3 py-2.5 align-middle">
                                  {notif.subjectCount != null && notif.subjectCount > 0 ? (
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-between text-[11px]">
                                        <span className="font-bold text-emerald-700">{notif.postedCount} Posted</span>
                                        <span className="font-bold text-amber-700">{notif.pendingCount} Pending</span>
                                      </div>
                                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                        <div
                                          className="bg-emerald-500 h-1.5 rounded-full"
                                          style={{ width: `${notif.progressPercent || 0}%` }}
                                        />
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 italic">No mapped subjects</span>
                                  )}
                                </td>

                                <td className="px-3 py-2.5 align-middle text-right">
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    className="h-7 text-xs bg-brand-600 text-white hover:bg-brand-700 font-semibold"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openExamDrilldown(notif.id);
                                    }}
                                  >
                                    View Subjects →
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Exam-Wise Compact Table/List */}
                    <div className="block md:hidden rounded-lg border border-border bg-white divide-y divide-border overflow-hidden shadow-2xs">
                      {filteredReportNotifications.map((notif, idx) => (
                        <div
                          key={notif.id}
                          className="p-2.5 transition hover:bg-brand-50/40 cursor-pointer"
                          onClick={() => openExamDrilldown(notif.id)}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <div>
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="font-mono text-[10px] text-slate-400">#{idx + 1}</span>
                                <span className="font-bold text-navy-900 text-xs">{notif.name}</span>
                                <span className="bg-indigo-100 text-indigo-800 px-1 py-0.2 rounded text-[9px] font-bold uppercase">
                                  {notif.examCategory}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {notif.course} • Year {notif.yearOfStudy || "-"}, Sem {notif.semester || "-"}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              className="h-6 text-[10px] px-2 shrink-0 bg-brand-600 text-white font-semibold"
                              onClick={(e) => {
                                e.stopPropagation();
                                openExamDrilldown(notif.id);
                              }}
                            >
                              View Subjects →
                            </Button>
                          </div>

                          <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-600 bg-slate-50 px-2 py-1 rounded">
                            <div>
                              <span className="font-medium text-slate-400">Dates: </span>
                              <span className="font-bold text-slate-800">{notif.examinationStartDate || "TBD"} – {notif.examinationEndDate || "TBD"}</span>
                            </div>
                            {notif.subjectCount != null && notif.subjectCount > 0 && (
                              <div className="font-semibold text-emerald-700">
                                {notif.postedCount} / {notif.subjectCount} Posted
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Marks Entry Modal */}
      {entryModal.open && entryModal.subject && (
        <InternalMarksEntryModal
          collegeId={entryModal.subject.collegeId}
          courseId={entryModal.subject.courseId}
          branchId={entryModal.subject.branchId}
          subjectId={entryModal.subject.subjectId}
          facultyStaffLinkId={
            "facultyStaffLinkId" in entryModal.subject
              ? entryModal.subject.facultyStaffLinkId
              : staffLinkId || 0
          }
          subjectCode={entryModal.subject.subjectCode}
          subjectName={entryModal.subject.subjectName}
          courseName={"courseName" in entryModal.subject ? entryModal.subject.courseName : undefined}
          branchName={"branchName" in entryModal.subject ? entryModal.subject.branchName : undefined}
          year={"year" in entryModal.subject ? entryModal.subject.year : undefined}
          semester={"semester" in entryModal.subject ? entryModal.subject.semester : undefined}
          batch={"batch" in entryModal.subject ? entryModal.subject.batch : undefined}
          section={"sectionName" in entryModal.subject ? entryModal.subject.sectionName : undefined}
          examNotification={"examNotification" in entryModal.subject ? entryModal.subject.examNotification : undefined}
          readOnly={entryModal.readOnly}
          onClose={() => setEntryModal({ open: false })}
          onSaved={() => void loadData()}
        />
      )}

      {/* Approver Action Modal */}
      {approvalDialog.open && (
        <Modal
          title={`${approvalDialog.action === "approve" ? "Approve" : approvalDialog.action === "return" ? "Return for Correction" : "Reject"} Internal Marks Submission`}
          onClose={() => setApprovalDialog({ open: false, comments: "", busy: false })}
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              Provide comments or decision notes for this approval workflow step:
            </p>
            <textarea
              className="w-full rounded-md border border-border p-2.5 text-xs outline-none focus:border-brand-600 min-h-[90px]"
              placeholder="Enter approval / rejection comments..."
              value={approvalDialog.comments}
              onChange={(e) =>
                setApprovalDialog((prev) => ({ ...prev, comments: e.target.value }))
              }
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                onClick={() => setApprovalDialog({ open: false, comments: "", busy: false })}
              >
                Cancel
              </Button>
              <Button
                disabled={approvalDialog.busy}
                onClick={() => void handleConfirmApprovalAction()}
                className={
                  approvalDialog.action === "approve"
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-amber-600 text-white hover:bg-amber-700"
                }
              >
                {approvalDialog.busy
                  ? "Processing..."
                  : approvalDialog.action === "approve"
                  ? "Confirm Approval"
                  : "Confirm Action"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
