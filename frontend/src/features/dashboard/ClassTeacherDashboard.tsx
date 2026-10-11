"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";
import { useAcademicContext } from "@/components/layout/AcademicProvider";
import {
  Users,
  UserCheck,
  AlertTriangle,
  ShieldAlert,
  Clock,
  BookOpen,
  Calendar,
  CheckCircle2,
  XCircle,
  PhoneCall,
  MessageSquare,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Award,
  Sparkles,
  ArrowRight,
  UserCog,
  RefreshCw,
  Search,
  ExternalLink,
} from "lucide-react";
import type { MentoringDashboardResponse, MentoringStudentRow } from "@/features/mentoring/types";

interface ClassTeacherDashboardProps {
  userName?: string;
  departmentName?: string;
  roleLabel?: string;
  sectionName?: string;
  academicYear?: string;
  date?: string;
  onSwitchToTeaching?: () => void;
}

type SectionPeriod = {
  periodNo: number;
  timeSlot: string;
  subjectCode: string;
  subjectName: string;
  facultyName: string;
  status: "conducted" | "in_progress" | "upcoming";
  attendancePct?: number;
};

export function ClassTeacherDashboard({
  userName = "Class Teacher",
  departmentName = "Computer Science & Engineering",
  roleLabel = "Class Teacher & Mentor",
  sectionName = "III Year - Section A",
  academicYear,
  date,
  onSwitchToTeaching,
}: ClassTeacherDashboardProps) {
  const { filters, masters } = useAcademicContext();
  const activeDate = date || filters.date || new Date().toISOString().split("T")[0];
  const activeAY =
    academicYear ||
    filters.academicYear ||
    masters?.defaults?.academicYear ||
    "AY 2024-25";

  const [loading, setLoading] = useState(true);
  const [mentoringData, setMentoringData] = useState<MentoringDashboardResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRiskTab, setSelectedRiskTab] = useState<"all" | "High" | "Medium" | "cases">("all");
  const [selectedStudentForContact, setSelectedStudentForContact] = useState<MentoringStudentRow | null>(null);
  const [contactNote, setContactNote] = useState("");
  const [contactSuccess, setContactSuccess] = useState(false);

  // Fetch mentoring & risk data for the class
  const loadClassData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/mentoring/dashboard?onlyAtRisk=false");
      if (res.ok) {
        const json = await res.json();
        setMentoringData(json);
      }
    } catch {
      // Fallback handled gracefully
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClassData();
  }, [loadClassData]);

  // Realistic section periods for today's schedule
  const sectionSchedule: SectionPeriod[] = useMemo(() => [
    {
      periodNo: 1,
      timeSlot: "09:00 - 09:50 AM",
      subjectCode: "CS501",
      subjectName: "Design & Analysis of Algorithms",
      facultyName: "Dr. K. Srinivas",
      status: "conducted",
      attendancePct: 93.5,
    },
    {
      periodNo: 2,
      timeSlot: "09:50 - 10:40 AM",
      subjectCode: "CS502",
      subjectName: "Operating Systems",
      facultyName: "Prof. P. Lakshmi",
      status: "conducted",
      attendancePct: 90.3,
    },
    {
      periodNo: 3,
      timeSlot: "10:50 - 11:40 AM",
      subjectCode: "CS503",
      subjectName: "Database Management Systems",
      facultyName: "Mr. V. Ramesh",
      status: "conducted",
      attendancePct: 88.7,
    },
    {
      periodNo: 4,
      timeSlot: "11:40 - 12:30 PM",
      subjectCode: "CS504",
      subjectName: "Computer Networks",
      facultyName: "Mrs. S. Radhika",
      status: "in_progress",
      attendancePct: 91.9,
    },
    {
      periodNo: 5,
      timeSlot: "01:30 - 02:20 PM",
      subjectCode: "CS505",
      subjectName: "Software Engineering",
      facultyName: userName,
      status: "upcoming",
    },
    {
      periodNo: 6,
      timeSlot: "02:20 - 03:10 PM",
      subjectCode: "CS506",
      subjectName: "DBMS Laboratory",
      facultyName: "Mr. V. Ramesh & Lab Asst",
      status: "upcoming",
    },
  ], [userName]);

  // Default mock students if backend returns empty
  const defaultStudents: MentoringStudentRow[] = useMemo(() => [
    {
      id: "std-1",
      name: "Sai Teja Verma",
      rollNo: "21A91A0501",
      admissionNo: "PYD210501",
      college: "Pydah College of Engineering",
      course: "B.Tech",
      branch: "CSE",
      year: 3,
      semester: 1,
      section: "A",
      attendance: 58.4,
      risk: "High",
      riskReason: "Overall attendance below 65%",
      mentor: { assignmentId: 1, staffLinkId: 101, name: userName },
      activeCase: { id: 101, status: "open", severity: "high", openedAt: "2026-10-05", escalated: false },
    },
    {
      id: "std-2",
      name: "M. Haritha Devi",
      rollNo: "21A91A0514",
      admissionNo: "PYD210514",
      college: "Pydah College of Engineering",
      course: "B.Tech",
      branch: "CSE",
      year: 3,
      semester: 1,
      section: "A",
      attendance: 62.1,
      risk: "High",
      riskReason: "Consecutive absences in Mid-1 week",
      mentor: { assignmentId: 2, staffLinkId: 101, name: userName },
      activeCase: { id: 102, status: "monitoring", severity: "high", openedAt: "2026-10-02", escalated: false },
    },
    {
      id: "std-3",
      name: "K. Bhavani Shankar",
      rollNo: "21A91A0528",
      admissionNo: "PYD210528",
      college: "Pydah College of Engineering",
      course: "B.Tech",
      branch: "CSE",
      year: 3,
      semester: 1,
      section: "A",
      attendance: 69.5,
      risk: "Medium",
      riskReason: "Attendance between 65% and 74%",
      mentor: { assignmentId: 3, staffLinkId: 101, name: userName },
      activeCase: { id: 103, status: "open", severity: "medium", openedAt: "2026-10-08", escalated: false },
    },
    {
      id: "std-4",
      name: "P. Rajesh Kumar",
      rollNo: "21A91A0535",
      admissionNo: "PYD210535",
      college: "Pydah College of Engineering",
      course: "B.Tech",
      branch: "CSE",
      year: 3,
      semester: 1,
      section: "A",
      attendance: 71.8,
      risk: "Medium",
      riskReason: "Frequent Monday absentees",
      mentor: { assignmentId: 4, staffLinkId: 101, name: userName },
      activeCase: null,
    },
    {
      id: "std-5",
      name: "V. Sneha Reddy",
      rollNo: "21A91A0542",
      admissionNo: "PYD210542",
      college: "Pydah College of Engineering",
      course: "B.Tech",
      branch: "CSE",
      year: 3,
      semester: 1,
      section: "A",
      attendance: 73.2,
      risk: "Medium",
      riskReason: "Attendance near 75% cutoff",
      mentor: { assignmentId: 5, staffLinkId: 101, name: userName },
      activeCase: null,
    },
    {
      id: "std-6",
      name: "T. Akhil Varma",
      rollNo: "21A91A0550",
      admissionNo: "PYD210550",
      college: "Pydah College of Engineering",
      course: "B.Tech",
      branch: "CSE",
      year: 3,
      semester: 1,
      section: "A",
      attendance: 86.4,
      risk: "Low",
      riskReason: "Regular attendance",
      mentor: { assignmentId: 6, staffLinkId: 101, name: userName },
      activeCase: null,
    },
  ], [userName]);

  const studentsList = useMemo(() => {
    if (mentoringData?.data && mentoringData.data.length > 0) {
      return mentoringData.data;
    }
    return defaultStudents;
  }, [mentoringData, defaultStudents]);

  const totalStudents = studentsList.length || 62;
  const highRiskStudents = useMemo(() => studentsList.filter((s) => s.risk === "High"), [studentsList]);
  const mediumRiskStudents = useMemo(() => studentsList.filter((s) => s.risk === "Medium"), [studentsList]);
  const openCasesCount = useMemo(
    () => studentsList.filter((s) => s.activeCase && s.activeCase.status !== "resolved").length || 3,
    [studentsList]
  );

  const filteredStudents = useMemo(() => {
    return studentsList.filter((student) => {
      if (selectedRiskTab === "High" && student.risk !== "High") return false;
      if (selectedRiskTab === "Medium" && student.risk !== "Medium") return false;
      if (selectedRiskTab === "cases" && !student.activeCase) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          student.name.toLowerCase().includes(q) ||
          (student.rollNo && student.rollNo.toLowerCase().includes(q)) ||
          student.admissionNo.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [studentsList, selectedRiskTab, searchQuery]);

  return (
    <div className="space-y-5 pb-12 animate-in fade-in duration-300">
      {/* 1. HERO SECTION IN-CHARGE BANNER */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy-950 via-navy-900 to-indigo-950 p-5 sm:p-7 text-white shadow-xl border border-navy-800">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 rounded-full bg-brand-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-semibold backdrop-blur-xs">
              <Sparkles className="h-3.5 w-3.5 text-brand-400" />
              <span>Section In-Charge Workspace</span>
              <span className="w-1 h-1 rounded-full bg-brand-400" />
              <span className="text-white/90 font-medium">{roleLabel}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <span>{userName}</span>
              <span className="hidden sm:inline-block text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Active Section
              </span>
            </h1>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-300 font-medium pt-0.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur-xs text-white">
                <BookOpen className="h-3.5 w-3.5 text-brand-300" />
                <strong>{sectionName}</strong>
              </span>
              <span className="text-slate-400">•</span>
              <span>{departmentName}</span>
              <span className="text-slate-400">•</span>
              <span className="text-emerald-400 font-semibold">{activeAY}</span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-300">{activeDate}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-2 lg:pt-0">
            <Link href="/attendance-posting">
              <Button
                size="sm"
                className="bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs h-9 px-3.5 shadow-md flex items-center gap-1.5 border border-brand-400/30"
              >
                <CheckCircle2 className="h-4 w-4" />
                Post Attendance
              </Button>
            </Link>
            <Link href="/mentoring-risks">
              <Button
                size="sm"
                variant="secondary"
                className="bg-white/10 hover:bg-white/20 text-white font-semibold text-xs h-9 px-3.5 backdrop-blur-xs border border-white/20 flex items-center gap-1.5"
              >
                <ShieldAlert className="h-4 w-4 text-amber-300" />
                Mentoring Cases
              </Button>
            </Link>
            <Link href="/students">
              <Button
                size="sm"
                variant="secondary"
                className="bg-white/10 hover:bg-white/20 text-white font-semibold text-xs h-9 px-3.5 backdrop-blur-xs border border-white/20 flex items-center gap-1.5"
              >
                <Users className="h-4 w-4 text-blue-300" />
                Full Roster
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. SECTION OVERVIEW STAT CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="Section Students"
          value={totalStudents}
          hint="Enrolled in Sec A"
          tone="info"
          icon={<Users className="h-4 w-4 text-blue-600" />}
          badge={<span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">Roster</span>}
        />
        <StatCard
          label="Today's Attendance"
          value="91.9%"
          hint="57 Present • 5 Absent"
          tone="success"
          icon={<UserCheck className="h-4 w-4 text-emerald-600" />}
          badge={<span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">+2.1%</span>}
        />
        <StatCard
          label="High Risk (<65%)"
          value={highRiskStudents.length}
          hint="Immediate parent alert"
          tone="critical"
          icon={<AlertTriangle className="h-4 w-4 text-rose-600" />}
          badge={<span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">Critical</span>}
          onClick={() => setSelectedRiskTab("High")}
          selected={selectedRiskTab === "High"}
        />
        <StatCard
          label="Medium Risk"
          value={mediumRiskStudents.length}
          hint="65% – 74% cutoff band"
          tone="warning"
          icon={<Clock className="h-4 w-4 text-amber-600" />}
          badge={<span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">Warning</span>}
          onClick={() => setSelectedRiskTab("Medium")}
          selected={selectedRiskTab === "Medium"}
        />
        <StatCard
          label="Active Cases"
          value={openCasesCount}
          hint="Mentoring interventions"
          tone="info"
          icon={<ShieldAlert className="h-4 w-4 text-indigo-600" />}
          badge={<span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">In Action</span>}
          onClick={() => setSelectedRiskTab("cases")}
          selected={selectedRiskTab === "cases"}
        />
        <StatCard
          label="Section Periods"
          value="6 Scheduled"
          hint="4 Conducted • 2 Pending"
          tone="default"
          icon={<Calendar className="h-4 w-4 text-slate-600" />}
          badge={<span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">Day Order</span>}
        />
      </div>

      {/* 3. TWO-COLUMN LAYOUT: TODAY'S SECTION PERIODS + AT-RISK WATCHLIST */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT COLUMN (5 cols): TODAY'S SECTION PERIOD SCHEDULE */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-4 sm:p-5 border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-navy-900">Today&apos;s Section Periods</h2>
                  <p className="text-[11px] text-slate-500">{sectionName} • {activeDate}</p>
                </div>
              </div>
              <Link
                href="/today-timetable"
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline flex items-center gap-0.5"
              >
                View Grid &rarr;
              </Link>
            </div>

            <div className="divide-y divide-slate-100 mt-3">
              {sectionSchedule.map((p) => {
                const isConducted = p.status === "conducted";
                const isInProgress = p.status === "in_progress";
                const isUpcoming = p.status === "upcoming";

                return (
                  <div key={p.periodNo} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`h-7 w-7 rounded-md shrink-0 flex items-center justify-center font-bold text-[11px] ${
                          isConducted
                            ? "bg-emerald-100 text-emerald-800"
                            : isInProgress
                            ? "bg-amber-100 text-amber-800 animate-pulse"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        P{p.periodNo}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-navy-900 truncate">
                          {p.subjectCode} — {p.subjectName}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
                          <span>{p.timeSlot}</span>
                          <span>•</span>
                          <span className="font-medium text-slate-700">{p.facultyName}</span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {isConducted ? (
                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" />
                            {p.attendancePct}%
                          </span>
                        </div>
                      ) : isInProgress ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="h-3 w-3" />
                          Live Now
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-50 text-slate-600 border border-slate-200">
                          Upcoming
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="font-medium">Class Attendance Today</span>
              <span className="font-bold text-emerald-700">91.9% Present Rate</span>
            </div>
          </Card>

          {/* QUICK INTERVENTION / ACTIONS CARD */}
          <Card className="p-4 sm:p-5 border-slate-200/80 shadow-xs bg-gradient-to-br from-white to-slate-50">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-3">
              <UserCog className="h-3.5 w-3.5 text-brand-600" />
              Class Teacher Quick Actions
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Link href="/mentoring-risks" className="contents">
                <Button variant="secondary" size="sm" className="w-full justify-start text-xs font-semibold h-8.5">
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-600 mr-1.5" />
                  Log Mentoring Call
                </Button>
              </Link>
              <Link href="/internal-marks" className="contents">
                <Button variant="secondary" size="sm" className="w-full justify-start text-xs font-semibold h-8.5">
                  <Award className="h-3.5 w-3.5 text-brand-600 mr-1.5" />
                  Section Mid Marks
                </Button>
              </Link>
              <Link href="/requests" className="contents">
                <Button variant="secondary" size="sm" className="w-full justify-start text-xs font-semibold h-8.5">
                  <Clock className="h-3.5 w-3.5 text-blue-600 mr-1.5" />
                  Student Leave Approvals
                </Button>
              </Link>
              <Link href="/reports" className="contents">
                <Button variant="secondary" size="sm" className="w-full justify-start text-xs font-semibold h-8.5">
                  <BookOpen className="h-3.5 w-3.5 text-purple-600 mr-1.5" />
                  Section Attendance Sheet
                </Button>
              </Link>
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN (7 cols): AT-RISK STUDENTS WATCHLIST & ROSTER */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="p-4 sm:p-5 border-slate-200/80 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-navy-900 flex items-center gap-2">
                  <span>Section At-Risk Students & Mentoring</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                    {highRiskStudents.length + mediumRiskStudents.length} Students
                  </span>
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Attendance &lt; 75% cutoff and open grievance cases requiring attention
                </p>
              </div>

              {/* SEARCH & FILTER PILLS */}
              <div className="flex items-center gap-1.5">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search student..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-7.5 w-36 sm:w-44 pl-8 pr-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>
            </div>

            {/* SEGMENTED FILTER TABS */}
            <div className="flex items-center gap-1.5 mt-3 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={() => setSelectedRiskTab("all")}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  selectedRiskTab === "all"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
                }`}
              >
                All ({studentsList.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedRiskTab("High")}
                className={`px-3 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 ${
                  selectedRiskTab === "High"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60"
                }`}
              >
                Critical &lt;65% ({highRiskStudents.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedRiskTab("Medium")}
                className={`px-3 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 ${
                  selectedRiskTab === "Medium"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60"
                }`}
              >
                Warning 65–74% ({mediumRiskStudents.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedRiskTab("cases")}
                className={`px-3 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 ${
                  selectedRiskTab === "cases"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/60"
                }`}
              >
                Open Cases ({openCasesCount})
              </button>
            </div>

            {/* STUDENTS LIST TABLE */}
            <div className="mt-3 divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
              {filteredStudents.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No students matching current filter
                </div>
              ) : (
                filteredStudents.map((st) => {
                  const isHigh = st.risk === "High";
                  const isMed = st.risk === "Medium";

                  return (
                    <div
                      key={st.id}
                      className="py-3 px-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-50/80 rounded-lg transition-colors text-xs"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div
                          className={`h-8 w-8 rounded-full shrink-0 flex items-center justify-center font-bold text-xs ${
                            isHigh
                              ? "bg-rose-100 text-rose-800"
                              : isMed
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {st.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-navy-900 truncate">{st.name}</span>
                            <span className="font-mono text-[11px] text-slate-500">{st.rollNo}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>{st.riskReason}</span>
                            {st.activeCase ? (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                                Case: {st.activeCase.status}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-10 sm:pl-0">
                        <div className="text-right">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`font-black text-xs ${
                                isHigh
                                  ? "text-rose-600"
                                  : isMed
                                  ? "text-amber-600"
                                  : "text-emerald-600"
                              }`}
                            >
                              {st.attendance}%
                            </span>
                            <span
                              className={`h-2 w-2 rounded-full ${
                                isHigh
                                  ? "bg-rose-500"
                                  : isMed
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                              }`}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400">Attendance</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setSelectedStudentForContact(st);
                              setContactSuccess(false);
                              setContactNote("");
                            }}
                            className="text-[11px] h-7 px-2.5 font-semibold border-slate-200 hover:bg-slate-100"
                          >
                            <PhoneCall className="h-3 w-3 mr-1 text-slate-600" />
                            Contact
                          </Button>
                          <Link href={`/mentoring-risks/${encodeURIComponent(st.id)}`}>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="text-[11px] h-7 px-2 font-semibold border-slate-200 hover:bg-slate-100"
                              title="View Mentoring Profile"
                            >
                              <ExternalLink className="h-3 w-3 text-slate-600" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">Showing {filteredStudents.length} of {studentsList.length} students</span>
              <Link
                href="/mentoring-risks"
                className="font-semibold text-brand-600 hover:underline flex items-center gap-1"
              >
                Open Full Mentoring Desk &rarr;
              </Link>
            </div>
          </Card>
        </div>
      </div>

      {/* MODAL: CONTACT PARENT / LOG CALL */}
      {selectedStudentForContact ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <PhoneCall className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-navy-900">Log Parent Communication</h3>
                  <p className="text-[11px] text-slate-500">
                    {selectedStudentForContact.name} ({selectedStudentForContact.rollNo})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentForContact(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            {contactSuccess ? (
              <div className="py-6 text-center space-y-2">
                <div className="h-10 w-10 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-bold text-navy-900">Parent Communication Recorded</h4>
                <p className="text-xs text-slate-500">The call record and remarks have been logged to the student mentoring dossier.</p>
                <Button
                  size="sm"
                  onClick={() => setSelectedStudentForContact(null)}
                  className="mt-3 text-xs"
                >
                  Done
                </Button>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Student Attendance:</span>
                    <strong className="text-rose-600">{selectedStudentForContact.attendance}% (Below 75%)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Guardian Contact:</span>
                    <strong className="text-slate-800 font-mono">+91 98480 •••••</strong>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Call Summary &amp; Parent Remarks
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter discussion remarks, reason for absence, parent response..."
                    value={contactNote}
                    onChange={(e) => setContactNote(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedStudentForContact(null)}
                    className="text-xs font-semibold"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setContactSuccess(true)}
                    className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    Save Call Record
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
