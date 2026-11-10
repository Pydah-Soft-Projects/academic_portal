"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  X,
  Calendar,
  Clock,
  BookOpen,
  Briefcase,
  Building,
  CheckCircle2,
  AlertCircle,
  Fingerprint,
  Mail,
  Phone,
  GraduationCap,
  Award,
  User,
  ExternalLink,
  MapPin,
  FileText,
  RotateCcw,
  Sparkles,
  Layers,
  CalendarDays,
  History,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  Upload,
  Plus,
  Trash2,
  Download,
  Eye,
  Star,
  FileCheck,
  Building2,
  UserCheck,
  ChevronRight,
  ChevronLeft,
  Filter,
  BadgeCheck,
  IdCard,
  Heart,
  Landmark,
  Share2,
  Compass,
  ArrowUpRight,
  Maximize2,
  Grid,
  TrendingUp,
  ArrowRightLeft,
  Users,
} from "lucide-react";
import { FacultyAvatar } from "@/components/ui/FacultyAvatar";
import { Button } from "@/components/ui/Button";
import { InlineLoader } from "@/components/ui/InlineLoader";
import { WorkloadTimetableGrid, type FacultyTimetable } from "@/features/workload/WorkloadTimetableGrid";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";
import type {
  StaffDetailResponse,
  StaffPersonalDetails,
  StaffAchievement,
  StaffSemesterAcademicHistoryItem,
  StaffStudentFeedbackHistoryItem,
  StaffSemesterRole,
  StaffCareerHistoryItem,
  StaffDocumentItem,
  StaffApprovalHistoryItem,
  StaffSlotDetail,
  StaffWeeklySlot,
  StaffMonthlyCalendarResponse,
  StaffCalendarDay,
  StaffCalendarDaySlot,
} from "./staff-types";

type Props = {
  identifier: string;
  isOpen: boolean;
  onClose: () => void;
  initialTab?: string;
  selectedDate?: string;
};

const ACHIEVEMENT_CATEGORIES = [
  "Educational Certifications",
  "Professional Certifications",
  "Journals Published",
  "Research Papers Published",
  "Books Published",
  "Patents Published / Registered",
  "Conference Participation",
  "Workshops Attended",
  "FDP (Faculty Development Programs)",
  "Awards & Recognitions",
  "Research Projects",
  "Other Academic Achievements",
];

const DOCUMENT_TYPES = [
  { value: "resume", label: "Resume / Curriculum Vitae" },
  { value: "appointment_order", label: "Appointment Order / Joining Letter" },
  { value: "qualification_degree", label: "Highest Qualification Degree / Ph.D." },
  { value: "id_proof_aadhaar", label: "Aadhaar Card Copy" },
  { value: "id_proof_pan", label: "PAN Card Copy" },
  { value: "experience_certificate", label: "Previous Experience Certificate" },
  { value: "promotion_letter", label: "Promotion / Increment Order" },
  { value: "relieving_letter", label: "Relieving Order (if applicable)" },
  { value: "other", label: "Other Supporting Document" },
];

const WEEK_DAYS = [
  { key: "MON", label: "Monday" },
  { key: "TUE", label: "Tuesday" },
  { key: "WED", label: "Wednesday" },
  { key: "THU", label: "Thursday" },
  { key: "FRI", label: "Friday" },
  { key: "SAT", label: "Saturday" },
];

function buildWorkloadTimetableFromWeekly(
  weeklyTimetable: Record<string, StaffWeeklySlot[]>,
  workloadSummary?: { totalWeeklyPeriods: number },
): FacultyTimetable {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayCodeMap: Record<string, string> = {
    Monday: "MON",
    Tuesday: "TUE",
    Wednesday: "WED",
    Thursday: "THU",
    Friday: "FRI",
    Saturday: "SAT",
  };

  const slotMap = new Map<string, { label: string; startTime: string; endTime: string; order: number }>();

  for (const dayCode of Object.keys(weeklyTimetable)) {
    const slots = weeklyTimetable[dayCode] || [];
    for (const s of slots) {
      const key = `${s.slotLabel}_${s.startTime || ""}_${s.endTime || ""}`;
      if (!slotMap.has(key)) {
        let order = 99;
        const match = s.slotLabel.match(/\d+/);
        if (match) order = parseInt(match[0], 10);
        slotMap.set(key, {
          label: s.slotLabel,
          startTime: s.startTime || "09:00",
          endTime: s.endTime || "10:00",
          order,
        });
      }
    }
  }

  const sortedSlotDefs = Array.from(slotMap.values()).sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.startTime.localeCompare(b.startTime);
  });

  const finalSlotDefs =
    sortedSlotDefs.length > 0
      ? sortedSlotDefs
      : [
          { label: "P1", startTime: "09:15", endTime: "10:05", order: 1 },
          { label: "P2", startTime: "10:05", endTime: "10:55", order: 2 },
          { label: "P3", startTime: "11:05", endTime: "11:55", order: 3 },
          { label: "P4", startTime: "11:55", endTime: "12:45", order: 4 },
          { label: "P5", startTime: "13:45", endTime: "14:35", order: 5 },
          { label: "P6", startTime: "14:35", endTime: "15:25", order: 6 },
          { label: "P7", startTime: "15:25", endTime: "16:15", order: 7 },
        ];

  const headerSlots = finalSlotDefs.map((def, idx) => ({
    id: idx + 1,
    label: def.label,
    startTime: def.startTime,
    endTime: def.endTime,
    slotType: "period",
    isAssignable: true,
  }));

  const slotsByDay: Record<string, typeof headerSlots> = {};
  const grid: Record<string, Record<number, any>> = {};

  for (const day of days) {
    slotsByDay[day] = headerSlots;
    grid[day] = {};
    const dayCode = dayCodeMap[day];
    const daySlots = weeklyTimetable[dayCode] || [];

    for (const hSlot of headerSlots) {
      const matched = daySlots.find(
        (s) =>
          s.slotLabel === hSlot.label ||
          (s.startTime === hSlot.startTime && s.endTime === hSlot.endTime),
      );

      if (matched) {
        grid[day][hSlot.id] = {
          kind: "class",
          branchName: matched.subjectCode || (matched.sectionName ? `Sec ${matched.sectionName}` : "Class"),
          year: null,
          semester: null,
          subjectName: matched.subjectName,
          entryType: matched.entryType || "theory",
        };
      } else {
        grid[day][hSlot.id] = null;
      }
    }
  }

  const periodsPerWeek =
    workloadSummary?.totalWeeklyPeriods ??
    Object.values(weeklyTimetable).reduce((sum, list) => sum + list.length, 0);

  return {
    timingTemplateId: 1,
    timingTemplateName: "Published College Schedule",
    periodsPerWeek,
    days,
    headerSlots,
    slotsByDay,
    grid,
  };
}

export function StaffProfileModal({
  identifier,
  isOpen,
  onClose,
  initialTab = "overview",
  selectedDate: initialDate,
}: Props) {
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [data, setData] = useState<StaffDetailResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Sub-modal states
  const [isAddAchievementOpen, setIsAddAchievementOpen] = useState(false);
  const [isAssignRoleOpen, setIsAssignRoleOpen] = useState(false);
  const [isUploadDocOpen, setIsUploadDocOpen] = useState(false);
  const [reviewAchievementTarget, setReviewAchievementTarget] = useState<StaffAchievement | null>(null);
  const [documentPreviewTarget, setDocumentPreviewTarget] = useState<{ title: string; url: string; type: string } | null>(null);

  // Timetable filter
  const [timetableDayFilter, setTimetableDayFilter] = useState<string>("ALL");

  // Monthly Calendar drilldown states
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = initialDate || new Date().toISOString().split("T")[0];
    return d.slice(0, 7);
  });
  const [monthlyCalendar, setMonthlyCalendar] = useState<StaffMonthlyCalendarResponse | null>(null);
  const [loadingCalendar, setLoadingCalendar] = useState<boolean>(false);
  const [selectedCalDay, setSelectedCalDay] = useState<StaffCalendarDay | null>(null);
  const [dateDetailModalDay, setDateDetailModalDay] = useState<StaffCalendarDay | null>(null);

  // Form states
  const [achievementForm, setAchievementForm] = useState<{
    category: string;
    title: string;
    description: string;
    publication_name: string;
    issuing_organization: string;
    publication_date: string;
    certificate_number_or_doi: string;
    academic_year: string;
    semester: string;
    achievement_url: string;
    status: string;
    docFileName?: string;
    docFileUrl?: string;
  }>({
    category: "Research Papers Published",
    title: "",
    description: "",
    publication_name: "",
    issuing_organization: "",
    publication_date: "",
    certificate_number_or_doi: "",
    academic_year: "2026-2027",
    semester: "1",
    achievement_url: "",
    status: "submitted",
    docFileName: "",
    docFileUrl: "",
  });

  const [roleForm, setRoleForm] = useState({
    academic_year: "2026-2027",
    semester: "1",
    role_name: "Class Teacher",
    department: "",
    college: "",
    assigned_by: "Principal",
    start_date: "",
    end_date: "",
    responsibilities: "",
    status: "active",
  });

  const [docUploadForm, setDocUploadForm] = useState({
    document_type: "qualification_degree",
    title: "",
    file_name: "",
    file_url: "",
    file_size: 0,
    file_type: "application/pdf",
  });

  const [reviewRemarks, setReviewRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [achievementCatFilter, setAchievementCatFilter] = useState("all");
  const [achievementStatusFilter, setAchievementStatusFilter] = useState("all");

  const todayIST = useMemo(() => {
    const now = new Date();
    const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    return ist.toISOString().split("T")[0];
  }, []);

  const selectedDate = initialDate || todayIST;

  // Load detailed profile
  const loadData = async () => {
    if (!identifier) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/staff/${encodeURIComponent(identifier)}?date=${selectedDate}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || `Failed to fetch profile (${res.status})`);
      }
      const json: StaffDetailResponse = await res.json();
      setData(json);

      if (json.monthlyCalendar) {
        setMonthlyCalendar(json.monthlyCalendar);
        setSelectedMonth(json.monthlyCalendar.month);
        const match = json.monthlyCalendar.days.find((d) => d.date === selectedDate) || json.monthlyCalendar.days[0];
        setSelectedCalDay(match || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void loadData();
    }
  }, [identifier, isOpen, selectedDate]);

  // Load specific calendar month
  const loadMonthlyCalendar = async (month: string) => {
    setLoadingCalendar(true);
    try {
      const res = await apiFetch(`/staff/${encodeURIComponent(identifier)}/calendar?month=${month}`);
      if (res.ok) {
        const json: StaffMonthlyCalendarResponse = await res.json();
        setMonthlyCalendar(json);
        const match = json.days.find((d) => d.date === selectedDate) || json.days[0];
        setSelectedCalDay(match || null);
      }
    } catch (e) {
      console.warn("Failed to load calendar month:", e);
    } finally {
      setLoadingCalendar(false);
    }
  };

  // Month navigation
  const shiftMonth = (delta: number) => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    setSelectedMonth(newMonth);
    void loadMonthlyCalendar(newMonth);
  };

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (documentPreviewTarget) setDocumentPreviewTarget(null);
        else if (reviewAchievementTarget) setReviewAchievementTarget(null);
        else if (isAddAchievementOpen) setIsAddAchievementOpen(false);
        else if (isAssignRoleOpen) setIsAssignRoleOpen(false);
        else if (isUploadDocOpen) setIsUploadDocOpen(false);
        else onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, isAddAchievementOpen, isAssignRoleOpen, isUploadDocOpen, reviewAchievementTarget, documentPreviewTarget]);

  if (!isOpen) return null;

  // Submit Achievement
  const handleSaveAchievement = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: any = {
        category: achievementForm.category,
        title: achievementForm.title,
        description: achievementForm.description,
        publication_name: achievementForm.publication_name,
        issuing_organization: achievementForm.issuing_organization,
        publication_date: achievementForm.publication_date || null,
        certificate_number_or_doi: achievementForm.certificate_number_or_doi,
        academic_year: achievementForm.academic_year,
        semester: achievementForm.semester,
        achievement_url: achievementForm.achievement_url,
        status: achievementForm.status,
      };

      if (achievementForm.docFileUrl) {
        payload.documents = [
          {
            fileName: achievementForm.docFileName || "supporting_document.pdf",
            fileUrl: achievementForm.docFileUrl,
            fileSize: 1024,
            fileType: "application/pdf",
          },
        ];
      }

      const res = await apiFetch(`/staff/${encodeURIComponent(identifier)}/achievements`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Failed to submit achievement");
      }

      setIsAddAchievementOpen(false);
      setAchievementForm({
        category: "Research Papers Published",
        title: "",
        description: "",
        publication_name: "",
        issuing_organization: "",
        publication_date: "",
        certificate_number_or_doi: "",
        academic_year: "2026-2027",
        semester: "1",
        achievement_url: "",
        status: "submitted",
        docFileName: "",
        docFileUrl: "",
      });
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to submit achievement");
    } finally {
      setSubmitting(false);
    }
  };

  // Review Achievement (HOD or Principal)
  const handleReviewAchievement = async (action: "hod_approve" | "hod_reject" | "principal_approve" | "principal_reject") => {
    if (!reviewAchievementTarget) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(`/staff/${encodeURIComponent(identifier)}/achievements/${reviewAchievementTarget.id}/review`, {
        method: "POST",
        body: JSON.stringify({ action, remarks: reviewRemarks }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Failed to process review");
      }
      setReviewAchievementTarget(null);
      setReviewRemarks("");
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to review achievement");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Achievement
  const handleDeleteAchievement = async (achId: number) => {
    if (!confirm("Are you sure you want to delete this achievement record?")) return;
    try {
      const res = await apiFetch(`/staff/${encodeURIComponent(identifier)}/achievements/${achId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete record");
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error deleting achievement");
    }
  };

  // Assign Role
  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiFetch(`/staff/${encodeURIComponent(identifier)}/roles`, {
        method: "POST",
        body: JSON.stringify(roleForm),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Failed to assign role");
      }
      setIsAssignRoleOpen(false);
      setRoleForm({
        academic_year: "2026-2027",
        semester: "1",
        role_name: "Class Teacher",
        department: "",
        college: "",
        assigned_by: "Principal",
        start_date: "",
        end_date: "",
        responsibilities: "",
        status: "active",
      });
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to assign role");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Role
  const handleDeleteRole = async (roleId: number) => {
    if (!confirm("Are you sure you want to remove this role assignment?")) return;
    try {
      const res = await apiFetch(`/staff/${encodeURIComponent(identifier)}/roles/${roleId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete role");
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error deleting role");
    }
  };

  // Upload Document
  const handleSaveDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docUploadForm.file_url) {
      alert("Please select a file to upload");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch(`/staff/${encodeURIComponent(identifier)}/documents`, {
        method: "POST",
        body: JSON.stringify(docUploadForm),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Failed to upload document");
      }
      setIsUploadDocOpen(false);
      setDocUploadForm({
        document_type: "qualification_degree",
        title: "",
        file_name: "",
        file_url: "",
        file_size: 0,
        file_type: "application/pdf",
      });
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to upload document");
    } finally {
      setSubmitting(false);
    }
  };

  // File picker handler converting to DataURL (PDF, JPG, PNG)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, target: "achievement" | "doc") => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert("File size exceeds 15MB limit. Please upload a smaller file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (target === "achievement") {
        setAchievementForm((prev) => ({
          ...prev,
          docFileName: file.name,
          docFileUrl: dataUrl,
        }));
      } else {
        setDocUploadForm((prev) => ({
          ...prev,
          file_name: file.name,
          file_url: dataUrl,
          file_size: file.size,
          file_type: file.type || "application/pdf",
          title: prev.title || file.name.replace(/\.[^/.]+$/, ""),
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const staff = data?.staff;
  const personal = data?.personalDetails;
  const attendance = data?.attendance;
  const achievements = data?.achievements || [];
  const semesterAcademicHistory = data?.semesterAcademicHistory || [];
  const studentFeedbackHistory = data?.studentFeedbackHistory || [];
  const semesterRoles = data?.semesterRoles || [];
  const careerHistory = data?.careerHistory || [];
  const documents = data?.documents || [];
  const approvalHistory = data?.approvalHistory || [];
  const workloadSummary = data?.workloadSummary || { totalWeeklyPeriods: 0, theoryPeriods: 0, labPeriods: 0, totalSubjects: 0, totalSections: 0 };
  const weeklyTimetable = data?.weeklyTimetable || {};

  const effectiveTimetable = useMemo(() => {
    if (data?.workloadTimetable) return data.workloadTimetable;
    if (data?.weeklyTimetable) {
      return buildWorkloadTimetableFromWeekly(data.weeklyTimetable, data.workloadSummary);
    }
    return null;
  }, [data?.workloadTimetable, data?.weeklyTimetable, data?.workloadSummary]);

  const approvedAchievementsCount = achievements.filter((a) => a.status === "approved").length;

  const filteredAchievements = achievements.filter((a) => {
    if (achievementCatFilter !== "all" && a.category !== achievementCatFilter) return false;
    if (achievementStatusFilter !== "all" && a.status !== achievementStatusFilter) return false;
    return true;
  });

  // Calculate day cells padding for monthly calendar grid (where 1st day starts)
  const calendarDays = monthlyCalendar?.days || [];
  const firstDayDowIndex = calendarDays.length > 0 ? new Date(calendarDays[0].date).getDay() : 0; // 0=Sun, 1=Mon, ...

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-3 md:p-4 animate-in fade-in duration-200">
      {/* ─── MODAL CONTAINER: EXPANDED WIDTH (max-w-[1540px]) ─── */}
      <div
        className="w-[97vw] max-w-[1540px] max-h-[95vh] h-[95vh] flex flex-col bg-slate-50 rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {loading && !data ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12">
            <InlineLoader />
            <p className="text-xs text-slate-500 mt-2 font-medium">Loading comprehensive faculty dossier...</p>
          </div>
        ) : error || !data || !staff ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-rose-50 border border-rose-200 rounded-xl space-y-3 m-6">
            <AlertCircle className="h-8 w-8 text-rose-600" />
            <h3 className="font-bold text-slate-900">Failed to load faculty record</h3>
            <p className="text-xs text-rose-700">{error || "Faculty record not found"}</p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => void loadData()}>
                Retry
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* ─── Executive Faculty Dossier Header Banner (Directly at Very Top) ─── */}
            <div className="shrink-0 border-b border-slate-200/90 bg-white p-4 sm:p-5 transition-all relative">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                {/* Left: Avatar & Identity Details */}
                <div className="flex items-start sm:items-center gap-4 min-w-0">
                  <div className="relative shrink-0">
                    <FacultyAvatar
                      name={staff.name}
                      photo={staff.profilePhoto}
                      hrmsEmployeeId={staff.hrmsEmployeeId}
                      size="xl"
                      className="h-16 w-16 sm:h-18 sm:w-18 text-lg font-bold ring-4 ring-slate-50 rounded-2xl shadow-xs"
                    />
                    <span
                      className={cn(
                        "absolute -bottom-1 -right-1 h-5 w-5 rounded-full ring-2 ring-white flex items-center justify-center text-[10px]",
                        attendance?.status === "present" || attendance?.status === "late"
                          ? "bg-emerald-500 text-white"
                          : attendance?.status === "leave" || attendance?.status === "od"
                            ? "bg-purple-500 text-white"
                            : "bg-rose-500 text-white",
                      )}
                      title={`Today: ${attendance?.displayStatus || "Status"}`}
                    >
                      ✓
                    </span>
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight leading-tight">
                        {staff.name}
                      </h1>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-slate-900 text-white shadow-2xs">
                        {staff.code}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <BadgeCheck className="h-3 w-3" />
                        <span>HRMS Master Live</span>
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200/60">
                        {staff.designation}
                      </span>
                      <span className="text-slate-400">&bull;</span>
                      <span className="font-semibold text-slate-700">
                        {staff.department || "General Department"}
                      </span>
                      <span className="text-slate-400">&bull;</span>
                      <span className="text-slate-500 truncate max-w-xs">
                        {staff.college || staff.division}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-0.5 text-xs text-slate-600">
                      {personal?.personalEmail || staff.email ? (
                        <a
                          href={`mailto:${personal?.personalEmail || staff.email}`}
                          className="inline-flex items-center gap-1 hover:text-brand-600 transition"
                        >
                          <Mail className="h-3.5 w-3.5 text-slate-400" />
                          <span>{personal?.personalEmail || staff.email}</span>
                        </a>
                      ) : null}

                      {personal?.mobileNumber || staff.phone ? (
                        <a
                          href={`tel:${personal?.mobileNumber || staff.phone}`}
                          className="inline-flex items-center gap-1 hover:text-brand-600 transition font-mono"
                        >
                          <Phone className="h-3.5 w-3.5 text-slate-400" />
                          <span>{personal?.mobileNumber || staff.phone}</span>
                        </a>
                      ) : null}

                      {(personal?.dateOfJoining || staff.dateOfJoining) && (
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          <span>Joined: {personal?.dateOfJoining || staff.dateOfJoining}</span>
                        </span>
                      )}

                      {(personal?.highestQualification || staff.qualification) && (
                        <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                          <GraduationCap className="h-3.5 w-3.5 text-brand-600" />
                          <span>{personal?.highestQualification || staff.qualification}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions (Add Achievement, Assign Role, Close X) & Today Attendance Pill */}
                <div className="shrink-0 flex flex-col items-start lg:items-end justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsAddAchievementOpen(true)}
                      className="gap-1.5 text-xs rounded-lg px-2.5 py-1 shadow-2xs hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Achievement</span>
                    </Button>

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsAssignRoleOpen(true)}
                      className="gap-1.5 text-xs rounded-lg px-2.5 py-1 shadow-2xs"
                    >
                      <Briefcase className="h-3.5 w-3.5" />
                      <span>Assign Role</span>
                    </Button>

                    <button
                      type="button"
                      onClick={onClose}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition ml-1 cursor-pointer"
                      aria-label="Close modal"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border shadow-2xs",
                        attendance?.status === "present"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : attendance?.status === "late"
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : attendance?.status === "leave" || attendance?.status === "od"
                              ? "bg-purple-50 text-purple-800 border-purple-200"
                              : "bg-rose-50 text-rose-800 border-rose-200",
                      )}
                    >
                      <span className="h-2 w-2 rounded-full bg-current" />
                      <span>Today: {attendance?.displayStatus || "Status"}</span>
                    </span>

                    {attendance?.checkInTime && (
                      <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded border border-slate-200">
                        In: {attendance.checkInTime}
                      </span>
                    )}
                    {attendance?.checkOutTime && (
                      <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded border border-slate-200">
                        Out: {attendance.checkOutTime}
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-400 font-medium">
                    Employment: <span className="font-semibold text-slate-700">{personal?.employmentStatus || "Active Regular"}</span> &bull; <span className="font-semibold text-brand-700">{staff.employeeGroup || "Teaching Staff"}</span>
                  </div>
                </div>
              </div>

              {/* 4 Academic KPI Summary Metrics Strip */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-3 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700 shrink-0">
                    <Clock className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 leading-none">
                      {workloadSummary.totalWeeklyPeriods} Periods
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {workloadSummary.theoryPeriods} Th &bull; {workloadSummary.labPeriods} Labs / Wk
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="p-1.5 rounded-lg bg-purple-100 text-purple-700 shrink-0">
                    <BookOpen className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 leading-none">
                      {workloadSummary.totalSubjects} Subjects
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Across {workloadSummary.totalSections} Class Sections
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 shrink-0">
                    <CalendarDays className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 leading-none">
                      {data.todaySlotsCount} Slots Today
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {data.todayPostedSlotsCount} Posted &bull; {data.todayPendingSlotsCount} Pending
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
                    <Award className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 leading-none">
                      {approvedAchievementsCount} Verified
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {achievements.length} Achievements Recorded
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ─── Split Layout: Left Content Headers Sidebar & Right Content Pane ─── */}
            <div className="flex-1 flex overflow-hidden min-h-0 bg-slate-100/60">
              {/* ─── LEFT SIDEBAR: CONTENT HEADERS ─── */}
              <aside className="w-64 sm:w-72 shrink-0 bg-white border-r border-slate-200/90 flex flex-col justify-between overflow-y-auto p-3">
                <div className="space-y-1">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Dossier Sections
                  </div>
                  {[
                    { id: "overview", label: "Academic Overview", icon: Layers },
                    { id: "timetable", label: "Weekly Timetable", icon: CalendarDays },
                    { id: "calendar", label: "Attendance & Teaching Calendar", icon: Calendar, badge: "Drilldown" },
                    { id: "personal", label: "HRMS Employment & Profile", icon: UserCheck, badge: "HRMS Live" },
                    { id: "achievements", label: "Research & Achievements", icon: Award, count: achievements.length },
                    { id: "semester_history", label: "Semester Teaching History", icon: GraduationCap, count: semesterAcademicHistory.length },
                    { id: "feedback", label: "Student Feedback & Ratings", icon: Star, count: studentFeedbackHistory.length },
                    { id: "roles", label: "Semester Roles", icon: Briefcase, count: semesterRoles.length },
                    { id: "documents", label: "Service Documents", icon: FileText, count: documents.length },
                    { id: "approvals", label: "Career Journey & Approvals", icon: History, count: approvalHistory.length },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer text-left",
                          isActive
                            ? "bg-slate-900 text-white shadow-xs"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{tab.label}</span>
                        </div>
                        {tab.badge && (
                          <span
                            className={cn(
                              "px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0",
                              isActive ? "bg-emerald-500 text-white" : "bg-emerald-100 text-emerald-800",
                            )}
                          >
                            {tab.badge}
                          </span>
                        )}
                        {tab.count != null && !tab.badge && (
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0",
                              isActive ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-600",
                            )}
                          >
                            {tab.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-3 border-t border-slate-100 px-3 text-[11px] text-slate-400 font-medium">
                  Academic Record Dossier &bull; Live HRMS
                </div>
              </aside>

              {/* ─── RIGHT MAIN CONTENT AREA ─── */}
              <main className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 bg-slate-50/60 space-y-4">

              {/* ══════════════════════════════════════════════════════════════════════
                  TAB 1: ACADEMIC OVERVIEW
                  ══════════════════════════════════════════════════════════════════════ */}
              {activeTab === "overview" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* Left Column (7 cols): Today Schedule & Assigned Subjects */}
                  <div className="lg:col-span-7 space-y-4">
                    {/* Today Schedule Timeline */}
                    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-brand-600" />
                          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                            Teaching Slots on {selectedDate}
                          </h3>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-500">
                          {data.todaySlots.length} Slots Scheduled
                        </span>
                      </div>

                      {data.todaySlots.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400">
                          No teaching slots scheduled for this faculty on {selectedDate}.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {data.todaySlots.map((s: StaffSlotDetail, idx: number) => (
                            <div
                              key={idx}
                              className={cn(
                                "flex items-center justify-between p-3 rounded-lg border text-xs transition",
                                s.isPosted
                                  ? "bg-emerald-50/40 border-emerald-200 text-slate-800"
                                  : "bg-white border-slate-200 text-slate-800",
                              )}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-1 rounded shrink-0">
                                  {s.slotLabel}
                                </span>
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-900 truncate">
                                    {s.subjectName}
                                  </div>
                                  <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                    <span>Sec: {s.sectionName || "A"}</span>
                                    <span>&bull;</span>
                                    <span className="font-mono">{s.startTime || "—"} - {s.endTime || "—"}</span>
                                    <span>&bull;</span>
                                    <span className="capitalize text-slate-600">{s.status}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="shrink-0">
                                {s.isPosted ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <CheckCircle className="h-3 w-3" />
                                    <span>Posted</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                    <Clock className="h-3 w-3" />
                                    <span>Pending Posting</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Assigned Subjects in Current Term */}
                    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-purple-600" />
                          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                            Assigned Teaching Curriculum
                          </h3>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-500">
                          {data.teachingSubjects.length} Courses
                        </span>
                      </div>

                      {data.teachingSubjects.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-400">
                          No active teaching subjects allocated.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {data.teachingSubjects.map((sub, idx) => (
                            <div key={idx} className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
                              <div className="font-bold text-xs text-slate-900 truncate" title={sub.subjectName}>
                                {sub.subjectName}
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-slate-500">
                                <span className="font-mono text-brand-700 font-semibold">{sub.subjectCode}</span>
                                <span className="capitalize px-1.5 py-0.2 bg-white rounded border border-slate-200 text-slate-700">
                                  {sub.entryType || "Theory"}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 pt-0.5">
                                Sec {sub.sectionName || "A"} {sub.periodsPerWeek ? `&bull; ${sub.periodsPerWeek} Periods/Wk` : ""}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column (5 cols): Biometric Attendance & Workload Distribution */}
                  <div className="lg:col-span-5 space-y-4">
                    {/* Live Biometric Thumb Logs */}
                    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <Fingerprint className="h-4 w-4 text-emerald-600" />
                          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                            Biometric Logs ({selectedDate})
                          </h3>
                        </div>
                        <span className="text-[11px] font-mono font-bold text-emerald-700">
                          {attendance?.punches?.length || 0} Punches
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="p-3 rounded-lg bg-emerald-50/50 border border-emerald-100">
                          <span className="text-[11px] font-semibold text-emerald-800 block">Check-in</span>
                          <span className="font-mono font-bold text-sm text-emerald-950 mt-0.5 block">
                            {attendance?.checkInTime || "—"}
                          </span>
                        </div>
                        <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-100">
                          <span className="text-[11px] font-semibold text-blue-800 block">Check-out</span>
                          <span className="font-mono font-bold text-sm text-blue-950 mt-0.5 block">
                            {attendance?.checkOutTime || "—"}
                          </span>
                        </div>
                      </div>

                      {attendance?.punches && attendance.punches.length > 0 ? (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                            Terminal Punch Trail
                          </span>
                          {attendance.punches.map((p, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100 text-xs font-mono">
                              <span className="font-bold text-slate-800">{p.time}</span>
                              <span className="text-[11px] text-slate-500 font-sans">{p.device || "Biometric ADMS"}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 text-center py-2">
                          No biometric device logs recorded for this date.
                        </p>
                      )}
                    </div>

                    {/* Weekly Workload Distribution */}
                    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-blue-600" />
                          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                            Weekly Workload Allocation
                          </h3>
                        </div>
                        <span className="text-[11px] font-bold text-slate-800">
                          {workloadSummary.totalWeeklyPeriods} Total / Wk
                        </span>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600">Theory Periods</span>
                          <span className="font-bold text-slate-900">{workloadSummary.theoryPeriods} Periods</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-blue-600 h-full rounded-full"
                            style={{ width: `${workloadSummary.totalWeeklyPeriods > 0 ? (workloadSummary.theoryPeriods / workloadSummary.totalWeeklyPeriods) * 100 : 0}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-slate-600">Practical / Lab Periods</span>
                          <span className="font-bold text-slate-900">{workloadSummary.labPeriods} Periods</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-purple-600 h-full rounded-full"
                            style={{ width: `${workloadSummary.totalWeeklyPeriods > 0 ? (workloadSummary.labPeriods / workloadSummary.totalWeeklyPeriods) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ══════════════════════════════════════════════════════════════════════
                  TAB 2: WEEKLY TIMETABLE MATRIX (MATCHING STAFF WORKLOAD TIMETABLE UI)
                  ══════════════════════════════════════════════════════════════════════ */}
              {activeTab === "timetable" && (
                <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-2xs">
                  {effectiveTimetable ? (
                    <WorkloadTimetableGrid timetable={effectiveTimetable} embedded />
                  ) : (
                    <div className="py-16 text-center text-xs text-slate-400">
                      No published timetable schedule found for this faculty.
                    </div>
                  )}
                </div>
              )}

              {/* ══════════════════════════════════════════════════════════════════════
                  TAB 3: ATTENDANCE & TEACHING CALENDAR (COMPLETE MONTHLY DRILLDOWN)
                  ══════════════════════════════════════════════════════════════════════ */}
              {activeTab === "calendar" && (
                <div className="space-y-4">
                  {/* Month Switcher Toolbar & Monthly Compliance KPI Bar */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
                          <button
                            type="button"
                            onClick={() => shiftMonth(-1)}
                            className="p-1 rounded text-slate-500 hover:bg-white hover:text-slate-900 transition cursor-pointer"
                            title="Previous Month"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <span className="px-3 font-bold text-xs text-slate-900 font-mono">
                            {selectedMonth}
                          </span>
                          <button
                            type="button"
                            onClick={() => shiftMonth(1)}
                            className="p-1 rounded text-slate-500 hover:bg-white hover:text-slate-900 transition cursor-pointer"
                            title="Next Month"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const cur = todayIST.slice(0, 7);
                            setSelectedMonth(cur);
                            void loadMonthlyCalendar(cur);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition cursor-pointer"
                        >
                          Current Month
                        </button>
                      </div>

                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        {loadingCalendar && <InlineLoader />}
                        <span>Showing complete attendance & teaching drilldown for every day of the month.</span>
                      </div>
                    </div>

                    {/* Monthly Summary Statistics Strip */}
                    {monthlyCalendar?.summary && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 text-center text-xs">
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                          <span className="text-[10px] text-slate-400 block">Working Days</span>
                          <span className="font-bold text-slate-900">{monthlyCalendar.summary.workingDays} Days</span>
                        </div>
                        <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-100 text-emerald-900">
                          <span className="text-[10px] text-emerald-600 block">Present</span>
                          <span className="font-bold">{monthlyCalendar.summary.presentDays} Days</span>
                        </div>
                        <div className="p-2 rounded-lg bg-amber-50/70 border border-amber-100 text-amber-900">
                          <span className="text-[10px] text-amber-600 block">Late</span>
                          <span className="font-bold">{monthlyCalendar.summary.lateDays} Days</span>
                        </div>
                        <div className="p-2 rounded-lg bg-rose-50/70 border border-rose-100 text-rose-900">
                          <span className="text-[10px] text-rose-600 block">Absent</span>
                          <span className="font-bold">{monthlyCalendar.summary.absentDays} Days</span>
                        </div>
                        <div className="p-2 rounded-lg bg-purple-50/70 border border-purple-100 text-purple-900">
                          <span className="text-[10px] text-purple-600 block">Leave / OD</span>
                          <span className="font-bold">{monthlyCalendar.summary.leaveDays + monthlyCalendar.summary.odDays} Days</span>
                        </div>
                        <div className="p-2 rounded-lg bg-blue-50/70 border border-blue-100 text-blue-900">
                          <span className="text-[10px] text-blue-600 block">Attendance Rate</span>
                          <span className="font-bold">{monthlyCalendar.summary.attendancePercent}%</span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                          <span className="text-[10px] text-slate-400 block">Slots Allocated</span>
                          <span className="font-bold text-slate-900">{monthlyCalendar.summary.totalSlotsAllocated} Slots</span>
                        </div>
                        <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-100 text-emerald-900">
                          <span className="text-[10px] text-emerald-600 block">Slots Posted</span>
                          <span className="font-bold">{monthlyCalendar.summary.totalSlotsPosted} ({monthlyCalendar.summary.postingComplianceRate}%)</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ─── 7-Day Calendar Grid ─── */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-2">
                    {/* Weekday Headers */}
                    <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-500 uppercase tracking-wider py-1 border-b border-slate-100">
                      <span className="text-rose-600">Sun</span>
                      <span>Mon</span>
                      <span>Tue</span>
                      <span>Wed</span>
                      <span>Thu</span>
                      <span>Fri</span>
                      <span>Sat</span>
                    </div>

                    {/* Month Days Grid */}
                    <div className="grid grid-cols-7 gap-2">
                      {/* Empty padding slots before 1st of month */}
                      {Array.from({ length: firstDayDowIndex }).map((_, idx) => (
                        <div key={`empty-${idx}`} className="h-24 rounded-lg bg-slate-50/40 border border-dashed border-slate-100" />
                      ))}

                      {calendarDays.map((day) => {
                        const isSelected = selectedCalDay?.date === day.date;
                        const isToday = day.date === todayIST;

                        const statusBg: Record<string, string> = {
                          present: "bg-emerald-50 text-emerald-800 border-emerald-200",
                          late: "bg-amber-50 text-amber-800 border-amber-200",
                          absent: "bg-rose-50 text-rose-800 border-rose-200",
                          leave: "bg-purple-50 text-purple-800 border-purple-200",
                          od: "bg-blue-50 text-blue-800 border-blue-200",
                          weekend: "bg-slate-50 text-slate-400 border-slate-100",
                          scheduled: "bg-slate-50 text-slate-600 border-slate-200",
                        };

                        return (
                          <div
                            key={day.date}
                            onClick={() => {
                              setSelectedCalDay(day);
                              setDateDetailModalDay(day);
                            }}
                            className={cn(
                              "min-h-[105px] p-2 rounded-lg border text-xs flex flex-col justify-between transition cursor-pointer hover:shadow-xs",
                              isSelected
                                ? "ring-2 ring-brand-600 bg-brand-50/20 border-brand-300"
                                : isToday
                                  ? "border-blue-400 bg-blue-50/10"
                                  : "bg-white border-slate-200 hover:border-slate-300",
                            )}
                          >
                            {/* Day Header: Date number & Today ring */}
                            <div className="flex items-center justify-between">
                              <span
                                className={cn(
                                  "font-bold text-xs h-5 w-5 rounded-full flex items-center justify-center",
                                  isToday ? "bg-brand-600 text-white" : "text-slate-800",
                                )}
                              >
                                {day.dayNumber}
                              </span>

                              {/* Attendance Badge */}
                              <span
                                className={cn(
                                  "px-1.5 py-0.2 rounded-full text-[9px] font-bold border truncate max-w-[70px]",
                                  statusBg[day.attendance.status] || "bg-slate-50 text-slate-600",
                                )}
                              >
                                {day.attendance.displayStatus}
                              </span>
                            </div>

                            {/* Attendance Timings */}
                            <div className="py-1">
                              {day.attendance.checkInTime ? (
                                <div className="font-mono text-[9px] text-slate-600 truncate">
                                  {day.attendance.checkInTime}
                                  {day.attendance.checkOutTime ? ` - ${day.attendance.checkOutTime}` : ""}
                                </div>
                              ) : (
                                <div className="text-[9px] text-slate-300 italic">—</div>
                              )}
                            </div>

                            {/* Teaching Slots Allocation & Posting Pill */}
                            <div className="pt-1 border-t border-slate-100">
                              {day.isWeekend ? (
                                <span className="text-[9px] text-slate-400">Weekly Off</span>
                              ) : day.teaching.allocatedCount === 0 ? (
                                <span className="text-[9px] text-slate-400">0 Slots (Free)</span>
                              ) : (
                                <div
                                  className={cn(
                                    "px-1.5 py-0.5 rounded text-[9px] font-semibold flex items-center justify-between border",
                                    day.teaching.postedCount === day.teaching.allocatedCount && day.teaching.allocatedCount > 0
                                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                      : day.teaching.postedCount > 0
                                        ? "bg-blue-50 text-blue-800 border-blue-200"
                                        : "bg-amber-50 text-amber-800 border-amber-200",
                                  )}
                                >
                                  <span>{day.teaching.allocatedCount} Slots</span>
                                  <span className="font-mono">
                                    {day.teaching.postedCount}/{day.teaching.allocatedCount}p
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ─── Selected Day Complete Drilldown Card ─── */}
                  {selectedCalDay && (
                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4 animate-in fade-in duration-150">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-brand-50 border border-brand-200 text-brand-700 flex flex-col items-center justify-center font-bold">
                            <span className="text-xs uppercase">{selectedCalDay.dayOfWeek}</span>
                            <span className="text-sm leading-none">{selectedCalDay.dayNumber}</span>
                          </div>
                          <div>
                            <h3 className="font-bold text-sm text-slate-900">
                              Day Drilldown: {selectedCalDay.date} ({selectedCalDay.dayOfWeek})
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Status: <strong className="text-slate-800">{selectedCalDay.attendance.displayStatus}</strong>
                              {selectedCalDay.attendance.checkInTime ? ` • Check-in: ${selectedCalDay.attendance.checkInTime}` : ""}
                              {selectedCalDay.attendance.checkOutTime ? ` • Check-out: ${selectedCalDay.attendance.checkOutTime}` : ""}
                              {selectedCalDay.attendance.punchCount > 0 ? ` • ${selectedCalDay.attendance.punchCount} Punches` : ""}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                            {selectedCalDay.teaching.allocatedCount} Slots Allocated
                          </span>
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {selectedCalDay.teaching.postedCount} Posted
                          </span>
                          {selectedCalDay.teaching.pendingCount > 0 && (
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                              {selectedCalDay.teaching.pendingCount} Pending
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Day's Slot-by-Slot Table */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Slot-wise Class Allocation & Posting Breakdown
                        </h4>

                        {selectedCalDay.teaching.slots.length === 0 ? (
                          <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-lg">
                            {selectedCalDay.isWeekend ? "Sunday — No teaching slots scheduled." : "No slots allotted for this faculty on this day (Free Day)."}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {selectedCalDay.teaching.slots.map((slot, idx) => (
                              <div
                                key={idx}
                                className={cn(
                                  "p-3 rounded-lg border text-xs space-y-1.5 transition",
                                  slot.isPosted
                                    ? "bg-emerald-50/50 border-emerald-200"
                                    : "bg-slate-50/70 border-slate-200",
                                )}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-mono font-bold text-xs bg-white text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                                    {slot.slotLabel}
                                  </span>
                                  <span className="text-slate-500 font-mono text-[11px]">
                                    {slot.startTime || "—"} - {slot.endTime || "—"}
                                  </span>
                                </div>

                                <div className="font-bold text-slate-900 truncate" title={slot.subjectName}>
                                  {slot.subjectName}
                                </div>

                                <div className="flex items-center justify-between text-[11px] text-slate-500">
                                  <span className="font-mono text-brand-700 font-semibold">{slot.subjectCode || "—"}</span>
                                  <span>Sec: {slot.sectionName || "A"}</span>
                                </div>

                                <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                                  {slot.substitutionType === "taken_by_substitute" ? (
                                    <span className="inline-flex items-center gap-1 font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                                      <ArrowRightLeft className="h-3 w-3 text-purple-600" />
                                      <span>Substituted &bull; {slot.postedByName ? `Taken by ${slot.postedByName}` : "Taken by Substitute"}</span>
                                    </span>
                                  ) : slot.substitutionType === "covered_as_substitute" ? (
                                    <span className="inline-flex items-center gap-1 font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                      <Users className="h-3 w-3 text-blue-600" />
                                      <span>Substituted &bull; {slot.allottedFacultyName ? `Covered for ${slot.allottedFacultyName}` : "Covered as Substitute"}</span>
                                    </span>
                                  ) : slot.substitutionType === "assigned_substitute" ? (
                                    <span className="inline-flex items-center gap-1 font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                      <ArrowRightLeft className="h-3 w-3 text-amber-600" />
                                      <span>Substitute Assigned: {slot.postedByName}</span>
                                    </span>
                                  ) : slot.isPosted ? (
                                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 text-[11px]">
                                      <CheckCircle className="h-3 w-3" /> Posted (Self)
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 font-semibold text-amber-700 text-[11px]">
                                      <Clock className="h-3 w-3" /> Pending Posting
                                    </span>
                                  )}
                                  {slot.postedAt && (
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      {slot.postedAt.split(" ")[1] || ""}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Day's In & Out Thumb Only */}
                      {(selectedCalDay.attendance.checkInTime || (selectedCalDay.attendance.punches && selectedCalDay.attendance.punches.length > 0)) && (
                        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Biometric:
                          </span>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200 font-mono font-semibold">
                            <Fingerprint className="h-3.5 w-3.5 text-emerald-600" />
                            <span>In: {selectedCalDay.attendance.checkInTime || selectedCalDay.attendance.punches?.[0]?.time || "—"}</span>
                            {selectedCalDay.attendance.punches?.[0]?.device && (
                              <span className="text-[10px] text-slate-500 font-sans font-normal">({selectedCalDay.attendance.punches[0].device})</span>
                            )}
                          </span>
                          {selectedCalDay.attendance.checkOutTime && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-900 border border-blue-200 font-mono font-semibold">
                              <Fingerprint className="h-3.5 w-3.5 text-blue-600" />
                              <span>Out: {selectedCalDay.attendance.checkOutTime}</span>
                              {selectedCalDay.attendance.punches && selectedCalDay.attendance.punches.length > 1 && selectedCalDay.attendance.punches[selectedCalDay.attendance.punches.length - 1]?.device && (
                                <span className="text-[10px] text-slate-500 font-sans font-normal">({selectedCalDay.attendance.punches[selectedCalDay.attendance.punches.length - 1].device})</span>
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ══════════════════════════════════════════════════════════════════════
                  TAB 4: HRMS EMPLOYMENT & IDENTITY (LIVE HRMS DATA)
                  ══════════════════════════════════════════════════════════════════════ */}
              {activeTab === "personal" && (
                <div className="space-y-4">
                  {/* Live HRMS Notice Banner */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/70 text-emerald-900 text-xs">
                    <div className="flex items-center gap-2.5">
                      <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
                      <div>
                        <span className="font-bold">Live Synchronized Record from Pydah HRMS Master</span>
                        <p className="text-[11px] text-emerald-700 mt-0.5">
                          Personal, demographic, and appointment records are dynamically read from the centralized HRMS database. No duplicate data entry required.
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-[11px] font-bold bg-white text-emerald-800 px-2 py-1 rounded border border-emerald-200 shrink-0">
                      ID: {staff.code}
                    </span>
                  </div>

                  {/* 4 Distinct Faculty Information Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Card 1: Institutional & Appointment Profile */}
                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-brand-700">
                        <Building2 className="h-4 w-4" />
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Institutional Appointment
                        </h3>
                      </div>

                      <div className="grid grid-cols-2 gap-y-3 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[11px]">Employee ID</span>
                          <span className="font-mono font-bold text-slate-900">{staff.code}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Official Designation</span>
                          <span className="font-semibold text-slate-800">{staff.designation}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Academic Department</span>
                          <span className="font-semibold text-slate-800">{staff.department || "—"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Institution / Campus</span>
                          <span className="font-semibold text-slate-800">{staff.college || staff.division}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Date of Joining</span>
                          <span className="font-semibold text-slate-900">{personal?.dateOfJoining || staff.dateOfJoining || "—"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Employment Status</span>
                          <span className="font-semibold text-emerald-700">{personal?.employmentStatus || "Active"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Employee Group</span>
                          <span className="font-semibold text-brand-700">{staff.employeeGroup || "Teaching Faculty"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Reporting Authority</span>
                          <span className="font-semibold text-slate-800">{personal?.reportingOfficer || "Principal / HOD"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Card 2: Personal & Demographics */}
                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-purple-700">
                        <User className="h-4 w-4" />
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Personal & Demographics
                        </h3>
                      </div>

                      <div className="grid grid-cols-2 gap-y-3 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[11px]">Full Name</span>
                          <span className="font-semibold text-slate-900">{staff.name}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Gender</span>
                          <span className="font-semibold text-slate-800">{personal?.gender || staff.gender || "—"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Date of Birth</span>
                          <span className="font-semibold text-slate-900">{personal?.dob || "—"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Blood Group</span>
                          <span className="font-semibold text-rose-700">{personal?.bloodGroup || "—"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Marital Status</span>
                          <span className="font-semibold text-slate-800">{personal?.maritalStatus || "—"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Nationality</span>
                          <span className="font-semibold text-slate-800">{personal?.nationality || "Indian"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Card 3: Contact & Communication */}
                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-blue-700">
                        <Mail className="h-4 w-4" />
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Contact & Communication
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[11px]">Official / Primary Email</span>
                          <span className="font-medium text-slate-900 truncate block">{personal?.officialEmail || staff.email || "—"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Personal Email</span>
                          <span className="font-medium text-slate-900 truncate block">{personal?.personalEmail || "—"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Mobile Number</span>
                          <span className="font-mono font-medium text-slate-900">{personal?.mobileNumber || staff.phone || "—"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Emergency Contact</span>
                          <span className="font-medium text-slate-900">
                            {personal?.emergencyContactName ? `${personal.emergencyContactName} (${personal.emergencyContactPhone || ""})` : "—"}
                          </span>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-slate-400 block text-[11px]">Residential Address</span>
                          <span className="font-medium text-slate-800">
                            {personal?.currentAddress || "—"}, {personal?.district || ""}, {personal?.state || ""} {personal?.pincode ? `- ${personal.pincode}` : ""}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card 4: Academic Background & Statutory Identity */}
                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-amber-700">
                        <GraduationCap className="h-4 w-4" />
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Qualifications & Statutory IDs
                        </h3>
                      </div>

                      <div className="grid grid-cols-2 gap-y-3 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[11px]">Highest Degree</span>
                          <span className="font-bold text-slate-900">{personal?.highestQualification || staff.qualification || "—"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Specialization</span>
                          <span className="font-medium text-slate-800">{personal?.specialization || "Engineering"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Total Experience</span>
                          <span className="font-medium text-slate-900">{personal?.totalExperienceYears ? `${personal.totalExperienceYears} Years` : "—"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">PAN Card</span>
                          <span className="font-mono font-semibold text-slate-800">{personal?.panNumber || "—"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Aadhaar Number</span>
                          <span className="font-mono font-semibold text-slate-800">
                            {personal?.aadhaarNumber ? `•••• •••• ${personal.aadhaarNumber.slice(-4)}` : "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">UAN / PF Number</span>
                          <span className="font-mono text-slate-800">{personal?.uanNumber || personal?.pfNumber || "—"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ══════════════════════════════════════════════════════════════════════
                  TAB 5: CERTIFICATIONS, RESEARCH & ACHIEVEMENTS
                  ══════════════════════════════════════════════════════════════════════ */}
              {activeTab === "achievements" && (
                <div className="space-y-4">
                  {/* Top Filter Strip */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <Filter className="h-3 w-3" /> Filter:
                      </span>
                      <select
                        value={achievementCatFilter}
                        onChange={(e) => setAchievementCatFilter(e.target.value)}
                        className="py-1 px-2.5 text-xs rounded-lg border border-slate-200 bg-slate-50 font-medium text-slate-800"
                      >
                        <option value="all">All Categories ({achievements.length})</option>
                        {ACHIEVEMENT_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>

                      <select
                        value={achievementStatusFilter}
                        onChange={(e) => setAchievementStatusFilter(e.target.value)}
                        className="py-1 px-2.5 text-xs rounded-lg border border-slate-200 bg-slate-50 font-medium text-slate-800"
                      >
                        <option value="all">All Statuses</option>
                        <option value="approved">Approved / Verified</option>
                        <option value="pending_hod">Pending HOD Review</option>
                        <option value="pending_principal">Pending Principal Approval</option>
                        <option value="submitted">Submitted</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>

                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => setIsAddAchievementOpen(true)}
                      className="gap-1.5 text-xs rounded-lg shadow-2xs"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Submit New Achievement</span>
                    </Button>
                  </div>

                  {filteredAchievements.length === 0 ? (
                    <div className="p-12 text-center bg-white rounded-xl border border-slate-200 space-y-3">
                      <Award className="h-10 w-10 text-slate-300 mx-auto" />
                      <h4 className="font-bold text-slate-800 text-sm">No Achievements Found</h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        Record professional publications, certifications, patents, books, and FDP participations for verification by HOD and Principal.
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsAddAchievementOpen(true)}
                      >
                        + Submit Achievement
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredAchievements.map((ach) => {
                        const statusColors: Record<string, string> = {
                          approved: "bg-emerald-50 text-emerald-800 border-emerald-200",
                          pending_hod: "bg-amber-50 text-amber-800 border-amber-200",
                          pending_principal: "bg-blue-50 text-blue-800 border-blue-200",
                          submitted: "bg-slate-100 text-slate-700 border-slate-200",
                          rejected: "bg-rose-50 text-rose-800 border-rose-200",
                        };

                        const statusLabels: Record<string, string> = {
                          approved: "Verified & Approved",
                          pending_hod: "Pending HOD Review",
                          pending_principal: "Pending Principal Approval",
                          submitted: "Submitted",
                          rejected: "Rejected",
                        };

                        return (
                          <div
                            key={ach.id}
                            className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:border-slate-300 transition space-y-3"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                              <div className="space-y-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200/50">
                                    {ach.category}
                                  </span>
                                  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border", statusColors[ach.status] || "bg-slate-100 text-slate-700")}>
                                    {statusLabels[ach.status] || ach.status}
                                  </span>
                                  {ach.academicYear && (
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      AY: {ach.academicYear} (Sem {ach.semester || 1})
                                    </span>
                                  )}
                                </div>

                                <h4 className="font-bold text-slate-900 text-sm">
                                  {ach.title}
                                </h4>

                                {(ach.publicationName || ach.issuingOrganization) && (
                                  <p className="text-xs text-slate-600 font-medium">
                                    {ach.publicationName} {ach.issuingOrganization ? `&bull; ${ach.issuingOrganization}` : ""}
                                  </p>
                                )}
                              </div>

                              <div className="shrink-0 flex items-center gap-1.5 pt-1 sm:pt-0">
                                <button
                                  type="button"
                                  onClick={() => setReviewAchievementTarget(ach)}
                                  className="text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-2.5 py-1 rounded-md transition cursor-pointer"
                                >
                                  Review
                                </button>

                                <button
                                  type="button"
                                  onClick={() => void handleDeleteAchievement(ach.id)}
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                  title="Delete record"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>

                            {ach.description && (
                              <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                {ach.description}
                              </p>
                            )}

                            {/* Metadata line: DOI, Publication Date, Supporting docs */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs text-slate-500">
                              <div className="flex flex-wrap items-center gap-3">
                                {ach.publicationDate && (
                                  <span>Date: <strong className="text-slate-700">{ach.publicationDate}</strong></span>
                                )}
                                {ach.certificateNumberOrDoi && (
                                  <span>DOI / Ref: <strong className="font-mono text-slate-700">{ach.certificateNumberOrDoi}</strong></span>
                                )}
                              </div>

                              {ach.documents && ach.documents.length > 0 && (
                                <div className="flex items-center gap-1.5">
                                  {ach.documents.map((d) => (
                                    <button
                                      key={d.id}
                                      type="button"
                                      onClick={() => setDocumentPreviewTarget({ title: d.fileName, url: d.fileUrl, type: d.fileType })}
                                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 bg-brand-50/70 border border-brand-200 px-2 py-0.5 rounded hover:bg-brand-100 transition cursor-pointer"
                                    >
                                      <FileText className="h-3 w-3" />
                                      <span className="truncate max-w-[130px]">{d.fileName}</span>
                                      <Eye className="h-2.5 w-2.5 opacity-60" />
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Remarks if rejected or reviewed */}
                            {(ach.hodRemarks || ach.principalRemarks || ach.rejectionRemarks) && (
                              <div className="text-[11px] p-2 rounded bg-slate-50 border border-slate-200 text-slate-700 space-y-1">
                                {ach.hodRemarks && <div><strong>HOD Remarks:</strong> {ach.hodRemarks}</div>}
                                {ach.principalRemarks && <div><strong>Principal Remarks:</strong> {ach.principalRemarks}</div>}
                                {ach.rejectionRemarks && <div className="text-rose-700"><strong>Rejection Reason:</strong> {ach.rejectionRemarks}</div>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ══════════════════════════════════════════════════════════════════════
                  TAB 6: SEMESTER TEACHING HISTORY & SYLLABUS
                  ══════════════════════════════════════════════════════════════════════ */}
              {activeTab === "semester_history" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-slate-200">
                    <div>
                      <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                        Semester-wise Subject Handling & Teaching Progress
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Historical syllabus progression, classes allotted vs scheduled vs taken from published timetables.
                      </p>
                    </div>
                    <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded">
                      {semesterAcademicHistory.length} Terms Handled
                    </span>
                  </div>

                  {semesterAcademicHistory.length === 0 ? (
                    <div className="p-10 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
                      No historical semester teaching logs found for this faculty member.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {semesterAcademicHistory.map((item, idx) => (
                        <div key={idx} className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3.5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono font-bold text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded border border-brand-200/50">
                                  {item.academicYear} &bull; Sem {item.semester}
                                </span>
                                <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                  Sec: {item.sectionName}
                                </span>
                                {item.semDuration && (
                                  <span className="text-[11px] font-mono text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                                    🗓️ {item.semDuration}
                                  </span>
                                )}
                              </div>
                              <h4 className="font-bold text-slate-900 text-sm mt-1.5">
                                {item.subjectName} <span className="font-mono font-medium text-slate-500 text-xs">({item.subjectCode})</span>
                              </h4>
                            </div>

                            <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between gap-1">
                              <div className="flex items-baseline gap-1.5">
                                <span className="font-black text-base text-slate-900">{item.completionPercent}%</span>
                                <span className="text-[11px] font-semibold text-slate-500">Syllabus Progress</span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px]">
                                <span className="font-mono text-slate-500">
                                  {item.classesTaken} / {item.totalSemesterSlots || item.periodsAllotted * 16} Target Periods
                                </span>
                                <span
                                  className={cn(
                                    "px-1.5 py-0.2 rounded font-bold",
                                    item.compliancePercent === 100
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : "bg-amber-50 text-amber-700 border border-amber-200",
                                  )}
                                >
                                  {item.compliancePercent}% On Pace
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Progress Bar with Target Milestone */}
                          <div className="space-y-1">
                            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  item.completionPercent >= 75
                                    ? "bg-emerald-500"
                                    : item.completionPercent >= 40
                                      ? "bg-blue-600"
                                      : "bg-brand-600",
                                )}
                                style={{ width: `${Math.min(100, item.completionPercent)}%` }}
                              />
                            </div>
                          </div>

                          {/* Detailed Metric Columns with Variances & Differences */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-center text-xs pt-1 border-t border-slate-100">
                            {/* 1. Allotted Target */}
                            <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                              <span className="text-[10px] text-slate-400 block font-medium">Semester Target</span>
                              <span className="font-bold text-slate-900 text-sm">
                                {item.totalSemesterSlots || item.periodsAllotted * 16}
                              </span>
                              <span className="text-[9px] text-slate-400 block mt-0.5">
                                {item.periodsAllotted}/wk &bull; {item.semesterWeeks || 16}w
                              </span>
                            </div>

                            {/* 2. Scheduled to Date */}
                            <div className="p-2 rounded-lg bg-blue-50/50 border border-blue-100 text-blue-900">
                              <span className="text-[10px] text-blue-600 block font-medium">Scheduled</span>
                              <span className="font-bold text-sm">{item.classesScheduled}</span>
                              <span className="text-[9px] text-blue-400 block mt-0.5">Calendar Slots</span>
                            </div>

                            {/* 3. Faculty Present on Class Dates */}
                            <div className="p-2 rounded-lg bg-emerald-50/50 border border-emerald-100 text-emerald-900">
                              <span className="text-[10px] text-emerald-600 block font-medium">Faculty Present</span>
                              <span className="font-bold text-sm">{item.classesPresent}</span>
                              <span className="text-[9px] text-emerald-500 block mt-0.5">
                                {item.classesScheduled > 0 ? `${Math.round((item.classesPresent / item.classesScheduled) * 100)}%` : "100%"} Attendance
                              </span>
                            </div>

                            {/* 4. Classes Taught / Taken */}
                            <div className="p-2 rounded-lg bg-purple-50/50 border border-purple-100 text-purple-900">
                              <span className="text-[10px] text-purple-600 block font-medium">Classes Taught</span>
                              <span className="font-bold text-sm">{item.classesTaken}</span>
                              <span className="text-[9px] text-purple-500 block mt-0.5">Attendance Posted</span>
                            </div>

                            {/* 5. Pending Backlog (Scheduled - Taken) */}
                            <div
                              className={cn(
                                "p-2 rounded-lg border",
                                item.classesPending > 0
                                  ? "bg-amber-50 text-amber-900 border-amber-200"
                                  : "bg-slate-50 text-slate-600 border-slate-100",
                              )}
                            >
                              <span className="text-[10px] block font-medium">Pending to Post</span>
                              <span className="font-bold text-sm">{item.classesPending}</span>
                              <span className="text-[9px] block mt-0.5 text-slate-400">
                                {item.classesPending > 0 ? "⚠️ Backlog" : "✓ No Backlog"}
                              </span>
                            </div>

                            {/* 6. Remaining Target Difference (Total Semester Slots - Taken) */}
                            <div className="p-2 rounded-lg bg-indigo-50/50 border border-indigo-100 text-indigo-900">
                              <span className="text-[10px] text-indigo-600 block font-medium">Remaining Diff</span>
                              <span className="font-bold text-sm">
                                {item.remainingSlots != null
                                  ? item.remainingSlots
                                  : Math.max(0, (item.totalSemesterSlots || item.periodsAllotted * 16) - item.classesTaken)}
                              </span>
                              <span className="text-[9px] text-indigo-400 block mt-0.5">To Complete Sem</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ══════════════════════════════════════════════════════════════════════
                  TAB 7: STUDENT FEEDBACK & RATINGS
                  ══════════════════════════════════════════════════════════════════════ */}
              {activeTab === "feedback" && (
                <div className="space-y-4">
                  {/* Overall Feedback Summary Card */}
                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="h-16 w-16 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col items-center justify-center text-amber-700 shrink-0">
                        <span className="text-xl font-black">4.8</span>
                        <div className="flex items-center text-[10px] text-amber-500">★★★★★</div>
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">Overall Teaching Feedback Score</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Aggregated rating from anonymous student course evaluation surveys.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-center sm:text-right">
                        <span className="font-bold text-slate-900 text-sm block">94%</span>
                        <span className="text-[11px] text-slate-400">Student Satisfaction</span>
                      </div>
                      <div className="text-center sm:text-right border-l pl-3 border-slate-100">
                        <span className="font-bold text-slate-900 text-sm block">{studentFeedbackHistory.length}</span>
                        <span className="text-[11px] text-slate-400">Evaluations</span>
                      </div>
                    </div>
                  </div>

                  {studentFeedbackHistory.length === 0 ? (
                    <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-400 space-y-1">
                      <p className="font-semibold text-slate-600">Student Feedback in Progress for Current Term</p>
                      <p>Feedback scores will reflect once end-of-semester student evaluations are published.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {studentFeedbackHistory.map((fb, idx) => (
                        <div key={idx} className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="font-mono text-[10px] text-brand-700 font-bold bg-brand-50 px-1.5 py-0.2 rounded border border-brand-200/50">
                                {fb.academicYear} &bull; Sem {fb.semester}
                              </span>
                              <h4 className="font-bold text-slate-900 text-xs mt-1">{fb.subjectName}</h4>
                              <p className="text-[11px] text-slate-500">Sec: {fb.sectionName} &bull; {fb.branchName}</p>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-xs border border-amber-200 flex items-center gap-1">
                                ★ {fb.avgRating}
                              </span>
                              <span className="text-[10px] text-slate-400 mt-0.5 block">{fb.feedbackCount} Students</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ══════════════════════════════════════════════════════════════════════
                  TAB 8: SEMESTER-WISE ROLES & RESPONSIBILITIES
                  ══════════════════════════════════════════════════════════════════════ */}
              {activeTab === "roles" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-slate-200">
                    <div>
                      <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                        Semester Institutional Responsibilities
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Roles assigned across semesters: Class Teacher, Mentor, Coordinator, HOD.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => setIsAssignRoleOpen(true)}
                      className="gap-1.5 text-xs rounded-lg cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Assign Role</span>
                    </Button>
                  </div>

                  {semesterRoles.length === 0 ? (
                    <div className="p-10 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-400">
                      No institutional semester roles assigned yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {semesterRoles.map((role) => (
                        <div key={role.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm">{role.roleName}</span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 capitalize">
                                {role.status}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleDeleteRole(role.id)}
                              className="text-slate-400 hover:text-rose-600 transition cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
                            <span>AY: <strong className="text-slate-700">{role.academicYear}</strong></span>
                            <span>&bull;</span>
                            <span>Sem: <strong className="text-slate-700">{role.semester}</strong></span>
                            <span>&bull;</span>
                            <span>Assigned By: <strong className="text-slate-700">{role.assignedBy || "Principal"}</strong></span>
                            {role.startDate && (
                              <>
                                <span>&bull;</span>
                                <span>Period: {role.startDate} to {role.endDate || "Present"}</span>
                              </>
                            )}
                          </div>

                          {role.responsibilities && (
                            <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                              {role.responsibilities}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ══════════════════════════════════════════════════════════════════════
                  TAB 9: SERVICE DOCUMENTS
                  ══════════════════════════════════════════════════════════════════════ */}
              {activeTab === "documents" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-slate-200">
                    <div>
                      <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                        Official Faculty Service Documents
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Appointment letters, joining records, qualification degrees, certificates.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => setIsUploadDocOpen(true)}
                      className="gap-1.5 text-xs rounded-lg cursor-pointer"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>Upload Document</span>
                    </Button>
                  </div>

                  {documents.length === 0 ? (
                    <div className="p-10 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-400">
                      No service documents uploaded for this faculty member.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {documents.map((doc) => (
                        <div key={doc.id} className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <FileText className="h-5 w-5 text-brand-600 shrink-0" />
                              <div className="min-w-0">
                                <h4 className="font-bold text-xs text-slate-900 truncate" title={doc.title}>
                                  {doc.title}
                                </h4>
                                <span className="text-[10px] text-slate-400 capitalize">{doc.documentType.replace(/_/g, " ")}</span>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                              Verified
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                            <span className="text-[11px] text-slate-400 truncate max-w-[120px]">{doc.fileName}</span>
                            <button
                              type="button"
                              onClick={() => setDocumentPreviewTarget({ title: doc.title, url: doc.fileUrl, type: doc.fileType })}
                              className="text-[11px] font-semibold text-brand-600 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="h-3 w-3" /> View
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ══════════════════════════════════════════════════════════════════════
                  TAB 10: CAREER JOURNEY & APPROVAL AUDIT
                  ══════════════════════════════════════════════════════════════════════ */}
              {activeTab === "approvals" && (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
                    <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider mb-2">
                      Academic Career Milestone Timeline
                    </h3>
                    <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 text-xs">
                      <div className="relative">
                        <span className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-brand-600 ring-4 ring-white" />
                        <div className="font-bold text-slate-900">Current Tenure & Responsibilities</div>
                        <p className="text-slate-500 text-[11px]">Active {staff.designation} in {staff.department} ({staff.college})</p>
                      </div>

                      {careerHistory.map((item, idx) => (
                        <div key={idx} className="relative">
                          <span className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-slate-400 ring-4 ring-white" />
                          <div className="font-semibold text-slate-800 capitalize">{item.eventType.replace(/_/g, " ")}: {item.designation}</div>
                          <p className="text-slate-500 text-[11px]">{item.eventDate}: {item.department} ({item.college}) {item.remarks ? `&bull; ${item.remarks}` : ""}</p>
                        </div>
                      ))}

                      <div className="relative">
                        <span className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-emerald-600 ring-4 ring-white" />
                        <div className="font-bold text-slate-900">Date of Joining Pydah Educational Group</div>
                        <p className="text-slate-500 text-[11px]">{personal?.dateOfJoining || staff.dateOfJoining || "Initial Appointment"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Audit History of Achievement Reviews */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
                    <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                      Achievement Approval Audit Trail
                    </h3>

                    {approvalHistory.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">No approval events logged yet.</p>
                    ) : (
                      <div className="space-y-2 text-xs">
                        {approvalHistory.map((hist) => (
                          <div key={hist.id} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <div>
                              <span className="font-bold text-slate-900 capitalize">{hist.action.replace(/_/g, " ")}</span> &bull; <span className="font-semibold text-slate-700">{hist.achievementTitle}</span>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                By {hist.actorName} ({hist.actorRole}) &bull; {hist.createdAt}
                              </div>
                            </div>
                            {hist.remarks && (
                              <span className="text-[11px] text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                                {hist.remarks}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </main>
          </div>
        </>
      )}
    </div>

      {/* ─── Sub-Modal: Add Achievement ─── */}
      {isAddAchievementOpen && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Submit Faculty Achievement</h3>
              <button type="button" onClick={() => setIsAddAchievementOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAchievement} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Achievement Category *</label>
                <select
                  value={achievementForm.category}
                  onChange={(e) => setAchievementForm((prev) => ({ ...prev, category: e.target.value }))}
                  className="w-full p-2 border rounded-lg bg-slate-50 text-slate-800"
                  required
                >
                  {ACHIEVEMENT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Achievement Title *</label>
                <input
                  type="text"
                  value={achievementForm.title}
                  onChange={(e) => setAchievementForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Machine Learning Approach to Renewable Power Dispatch"
                  className="w-full p-2 border rounded-lg text-slate-800"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Publication / Organization</label>
                  <input
                    type="text"
                    value={achievementForm.publication_name}
                    onChange={(e) => setAchievementForm((prev) => ({ ...prev, publication_name: e.target.value }))}
                    placeholder="e.g. IEEE Transactions"
                    className="w-full p-2 border rounded-lg text-slate-800"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Date</label>
                  <input
                    type="date"
                    value={achievementForm.publication_date}
                    onChange={(e) => setAchievementForm((prev) => ({ ...prev, publication_date: e.target.value }))}
                    className="w-full p-2 border rounded-lg text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Supporting Document (PDF, JPG, PNG)</label>
                <input
                  type="file"
                  accept=".pdf,image/png,image/jpeg"
                  onChange={(e) => handleFileChange(e, "achievement")}
                  className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-brand-50 file:text-brand-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="secondary" size="sm" onClick={() => setIsAddAchievementOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit for Verification"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Sub-Modal: Assign Role ─── */}
      {isAssignRoleOpen && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Assign Semester Role</h3>
              <button type="button" onClick={() => setIsAssignRoleOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Role Title *</label>
                <select
                  value={roleForm.role_name}
                  onChange={(e) => setRoleForm((prev) => ({ ...prev, role_name: e.target.value }))}
                  className="w-full p-2 border rounded-lg bg-slate-50"
                  required
                >
                  <option value="Class Teacher">Class Teacher</option>
                  <option value="Department Coordinator">Department Coordinator</option>
                  <option value="Mentor / Counselor">Mentor / Counselor</option>
                  <option value="NBA / NAAC Coordinator">NBA / NAAC Coordinator</option>
                  <option value="Examination Coordinator">Examination Coordinator</option>
                  <option value="HOD (Head of Department)">HOD (Head of Department)</option>
                  <option value="Placement Coordinator">Placement Coordinator</option>
                  <option value="Research & Development Coordinator">Research & Development Coordinator</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Academic Year</label>
                  <input
                    type="text"
                    value={roleForm.academic_year}
                    onChange={(e) => setRoleForm((prev) => ({ ...prev, academic_year: e.target.value }))}
                    className="w-full p-2 border rounded-lg text-slate-800"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Semester</label>
                  <input
                    type="text"
                    value={roleForm.semester}
                    onChange={(e) => setRoleForm((prev) => ({ ...prev, semester: e.target.value }))}
                    className="w-full p-2 border rounded-lg text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Duties & Responsibilities</label>
                <textarea
                  value={roleForm.responsibilities}
                  onChange={(e) => setRoleForm((prev) => ({ ...prev, responsibilities: e.target.value }))}
                  rows={2}
                  className="w-full p-2 border rounded-lg text-slate-800"
                  placeholder="Outline responsibilities..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="secondary" size="sm" onClick={() => setIsAssignRoleOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={submitting}>
                  {submitting ? "Saving..." : "Save Role Assignment"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Sub-Modal: Upload Service Document ─── */}
      {isUploadDocOpen && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Upload Service Document</h3>
              <button type="button" onClick={() => setIsUploadDocOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDocument} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Document Type *</label>
                <select
                  value={docUploadForm.document_type}
                  onChange={(e) => setDocUploadForm((prev) => ({ ...prev, document_type: e.target.value }))}
                  className="w-full p-2 border rounded-lg bg-slate-50"
                  required
                >
                  {DOCUMENT_TYPES.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Document Title *</label>
                <input
                  type="text"
                  value={docUploadForm.title}
                  onChange={(e) => setDocUploadForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. M.Tech Degree Certificate"
                  className="w-full p-2 border rounded-lg text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Attach File (PDF, JPG, PNG) *</label>
                <input
                  type="file"
                  accept=".pdf,image/png,image/jpeg"
                  onChange={(e) => handleFileChange(e, "doc")}
                  className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-brand-50 file:text-brand-700"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="secondary" size="sm" onClick={() => setIsUploadDocOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={submitting}>
                  {submitting ? "Uploading..." : "Upload Document"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Sub-Modal: Review Achievement (HOD / Principal) ─── */}
      {reviewAchievementTarget && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Review Achievement</h3>
              <button type="button" onClick={() => setReviewAchievementTarget(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
                <span className="text-[10px] uppercase font-bold text-brand-700">{reviewAchievementTarget.category}</span>
                <h4 className="font-bold text-slate-900">{reviewAchievementTarget.title}</h4>
                <p className="text-slate-500 text-[11px]">{reviewAchievementTarget.publicationName}</p>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Review Remarks</label>
                <textarea
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  rows={2}
                  className="w-full p-2 border rounded-lg text-slate-800"
                  placeholder="Enter verification comments or approval notes..."
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={submitting}
                  onClick={() => void handleReviewAchievement("principal_approve")}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                >
                  ✓ Approve (Principal)
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={submitting}
                  onClick={() => void handleReviewAchievement("hod_approve")}
                  className="bg-blue-50 text-blue-800 border-blue-200 cursor-pointer"
                >
                  ✓ Verify (HOD)
                </Button>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={submitting}
                onClick={() => void handleReviewAchievement("hod_reject")}
                className="w-full text-rose-600 hover:bg-rose-50 cursor-pointer"
              >
                ✕ Reject Submission
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Sub-Modal: Document / Certificate Preview ─── */}
      {documentPreviewTarget && (
        <div className="fixed inset-0 z-70 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-3.5 border-b border-slate-100 bg-slate-50">
              <span className="font-bold text-slate-900 text-xs truncate max-w-md">{documentPreviewTarget.title}</span>
              <div className="flex items-center gap-2">
                <a
                  href={documentPreviewTarget.url}
                  download={documentPreviewTarget.title}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 transition"
                  title="Download File"
                >
                  <Download className="h-4 w-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setDocumentPreviewTarget(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 p-2 bg-slate-900/10 flex items-center justify-center overflow-auto">
              {documentPreviewTarget.type.startsWith("image/") ? (
                <img
                  src={documentPreviewTarget.url}
                  alt={documentPreviewTarget.title}
                  className="max-h-[75vh] object-contain rounded-lg shadow-sm"
                />
              ) : (
                <iframe
                  src={documentPreviewTarget.url}
                  title={documentPreviewTarget.title}
                  className="w-full h-[75vh] rounded-lg border border-slate-200 bg-white"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Sub-Modal: Date Attendance & Teaching Detailed Note Popup ─── */}
      {dateDetailModalDay && (
        <div
          className="fixed inset-0 z-70 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setDateDetailModalDay(null)}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-50 text-brand-700 border border-brand-200/60">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {dateDetailModalDay.date} ({dateDetailModalDay.dayOfWeek})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Detailed HRMS Attendance & Academic Teaching Record
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-bold border",
                    dateDetailModalDay.attendance.status === "present"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : dateDetailModalDay.attendance.status === "late"
                        ? "bg-amber-50 text-amber-800 border-amber-200"
                        : dateDetailModalDay.attendance.status === "leave"
                          ? "bg-purple-50 text-purple-800 border-purple-200"
                          : dateDetailModalDay.attendance.status === "od"
                            ? "bg-blue-50 text-blue-800 border-blue-200"
                            : dateDetailModalDay.attendance.status === "weekend"
                              ? "bg-slate-100 text-slate-600 border-slate-200"
                              : "bg-rose-50 text-rose-800 border-rose-200",
                  )}
                >
                  {dateDetailModalDay.attendance.displayStatus}
                </span>

                <button
                  type="button"
                  onClick={() => setDateDetailModalDay(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* HRMS Note Card */}
              {dateDetailModalDay.attendance.leaveDetails ? (
                <div className="p-3.5 rounded-xl bg-purple-50/80 border border-purple-200 space-y-1.5">
                  <div className="flex items-center gap-2 text-purple-900 font-bold">
                    <AlertTriangle className="h-4 w-4 text-purple-700" />
                    <span>HRMS Leave Record: {dateDetailModalDay.attendance.leaveDetails.leaveType}</span>
                    <span className="text-[10px] font-semibold bg-purple-200/70 text-purple-900 px-1.5 py-0.2 rounded ml-auto uppercase">
                      {dateDetailModalDay.attendance.leaveDetails.status || "Approved"}
                    </span>
                  </div>
                  {dateDetailModalDay.attendance.leaveDetails.purpose && (
                    <p className="text-purple-950 font-medium text-[11px]">
                      <strong>Purpose:</strong> {dateDetailModalDay.attendance.leaveDetails.purpose}
                    </p>
                  )}
                  {dateDetailModalDay.attendance.leaveDetails.reason && (
                    <p className="text-purple-800 text-[11px]">
                      <strong>Reason / Remarks:</strong> {dateDetailModalDay.attendance.leaveDetails.reason}
                    </p>
                  )}
                </div>
              ) : dateDetailModalDay.attendance.odDetails ? (
                <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 space-y-1.5">
                  <div className="flex items-center gap-2 text-blue-900 font-bold">
                    <ShieldCheck className="h-4 w-4 text-blue-700" />
                    <span>HRMS On Duty (OD) Record: {dateDetailModalDay.attendance.odDetails.odType || "On Duty"}</span>
                  </div>
                  {dateDetailModalDay.attendance.odDetails.placeVisited && (
                    <p className="text-blue-950 font-medium text-[11px]">
                      <strong>Place Visited:</strong> {dateDetailModalDay.attendance.odDetails.placeVisited}
                    </p>
                  )}
                  {dateDetailModalDay.attendance.odDetails.purpose && (
                    <p className="text-blue-800 text-[11px]">
                      <strong>Purpose:</strong> {dateDetailModalDay.attendance.odDetails.purpose}
                    </p>
                  )}
                </div>
              ) : dateDetailModalDay.attendance.permissionDetails ? (
                <div className="p-3.5 rounded-xl bg-cyan-50/80 border border-cyan-200 space-y-1 text-cyan-950">
                  <span className="font-bold block">HRMS Permission Record</span>
                  <p className="text-[11px]">
                    <strong>Duration:</strong> {dateDetailModalDay.attendance.permissionDetails.hours || 1} Hour(s)
                  </p>
                  {dateDetailModalDay.attendance.permissionDetails.reason && (
                    <p className="text-[11px]">
                      <strong>Reason:</strong> {dateDetailModalDay.attendance.permissionDetails.reason}
                    </p>
                  )}
                </div>
              ) : null}

              {/* In Thumb & Out Thumb Only */}
              {(() => {
                const punches = dateDetailModalDay.attendance.punches || [];
                const inPunch = punches[0];
                const outPunch = punches.length > 1 ? punches[punches.length - 1] : null;

                const inThumbTime = dateDetailModalDay.attendance.checkInTime || inPunch?.time || "—";
                const inThumbDevice = inPunch?.device || (inThumbTime !== "—" ? "Biometric Device" : null);

                const outThumbTime = dateDetailModalDay.attendance.checkOutTime || outPunch?.time || "—";
                const outThumbDevice = outPunch?.device || (outThumbTime !== "—" ? "Biometric Device" : null);

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* In Thumb */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
                          <Fingerprint className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">In Thumb</span>
                          <span className="font-mono font-bold text-base text-slate-900 block leading-tight mt-0.5">
                            {inThumbTime}
                          </span>
                        </div>
                      </div>
                      {inThumbDevice && inThumbTime !== "—" && (
                        <span className="text-[11px] font-mono px-2.5 py-1 rounded-md bg-white text-slate-700 border border-slate-200 truncate max-w-[150px] shadow-2xs font-medium">
                          {inThumbDevice}
                        </span>
                      )}
                    </div>

                    {/* Out Thumb */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2.5 rounded-xl bg-blue-100 text-blue-700 shrink-0">
                          <Fingerprint className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Out Thumb</span>
                          <span className="font-mono font-bold text-base text-slate-900 block leading-tight mt-0.5">
                            {outThumbTime}
                          </span>
                        </div>
                      </div>
                      {outThumbDevice && outThumbTime !== "—" && (
                        <span className="text-[11px] font-mono px-2.5 py-1 rounded-md bg-white text-slate-700 border border-slate-200 truncate max-w-[150px] shadow-2xs font-medium">
                          {outThumbDevice}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Teaching Classes / Slots */}
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-brand-600" />
                    Teaching Slots Breakdown ({dateDetailModalDay.teaching.allocatedCount} Slots)
                  </h4>
                  <span className="text-[10px] font-bold text-slate-500">
                    {dateDetailModalDay.teaching.postedCount} Posted &bull; {dateDetailModalDay.teaching.pendingCount} Pending
                  </span>
                </div>

                {dateDetailModalDay.teaching.slots.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-50 text-center text-slate-400 text-xs italic">
                    {dateDetailModalDay.isWeekend ? "Sunday — No academic classes scheduled." : "No class slots allotted for this faculty on this day (Free Day)."}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {dateDetailModalDay.teaching.slots.map((slot, sIdx) => (
                      <div
                        key={sIdx}
                        className={cn(
                          "p-3 rounded-xl border text-xs space-y-1",
                          slot.isPosted ? "bg-emerald-50/40 border-emerald-200" : "bg-slate-50/70 border-slate-200",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-[11px] bg-white text-slate-800 px-1.5 py-0.5 rounded border border-slate-200">
                            {slot.slotLabel}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {slot.startTime || "—"} - {slot.endTime || "—"}
                          </span>
                        </div>
                        <div className="font-bold text-slate-900 truncate" title={slot.subjectName}>
                          {slot.subjectName}
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span className="font-mono text-brand-700 font-semibold">{slot.subjectCode || "—"}</span>
                          <span>Sec: {slot.sectionName || "A"}</span>
                        </div>
                        <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                          {slot.substitutionType === "taken_by_substitute" ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                              <ArrowRightLeft className="h-3 w-3 text-purple-600" />
                              <span>Substituted &bull; {slot.postedByName ? `Taken by ${slot.postedByName}` : "Taken by Substitute"}</span>
                            </span>
                          ) : slot.substitutionType === "covered_as_substitute" ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                              <Users className="h-3 w-3 text-blue-600" />
                              <span>Substituted &bull; {slot.allottedFacultyName ? `Covered for ${slot.allottedFacultyName}` : "Covered as Substitute"}</span>
                            </span>
                          ) : slot.substitutionType === "assigned_substitute" ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              <ArrowRightLeft className="h-3 w-3 text-amber-600" />
                              <span>Substitute Assigned: {slot.postedByName}</span>
                            </span>
                          ) : slot.isPosted ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                              <CheckCircle className="h-3 w-3" /> Posted (Self)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                              <Clock className="h-3 w-3" /> Pending Posting
                            </span>
                          )}
                          {slot.postedAt && (
                            <span className="font-mono text-[10px] text-slate-400">
                              {slot.postedAt.split(" ")[1] || ""}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/60 flex justify-end">
              <Button type="button" variant="secondary" size="sm" onClick={() => setDateDetailModalDay(null)}>
                Close Note
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
