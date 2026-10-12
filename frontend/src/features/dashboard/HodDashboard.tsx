"use client";

import { useState } from "react";
import {
  Users,
  Calendar,
  Bell,
  ChevronDown,
  Star,
  ChevronRight,
  Info,
  BookOpen,
  IndianRupee,
  Clock,
  Plane,
  UserX,
  AlertTriangle,
  FileText,
  ClipboardList,
  CheckCircle,
  GraduationCap,
  Sparkles,
  TrendingUp,
  X,
  Building2,
  Phone,
  Mail,
  Award,
  Layers,
  ArrowUpRight,
} from "lucide-react";

interface HodDashboardProps {
  userName?: string;
  departmentName?: string;
  roleLabel?: string;
}

export function HodDashboard({
  userName = "Dr. R. Kumar",
  departmentName = "Computer Science & Engineering",
  roleLabel = "HOD - CSE",
}: HodDashboardProps) {
  const [selectedDept, setSelectedDept] = useState("Computer Science & Engineering");
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<string | null>(null);

  const departments = [
    "Computer Science & Engineering",
    "Artificial Intelligence & Machine Learning",
    "Electronics & Communication Engineering",
    "Electrical & Electronics Engineering",
    "Mechanical Engineering",
    "Civil Engineering",
  ];

  // Prioritized action items from the mockup
  const priorityItems = [
    {
      id: 1,
      title: "Review 14 students absent for 3+ days",
      severity: "high",
      type: "attendance",
      count: 14,
    },
    {
      id: 2,
      title: "Follow up with faculty for 2 subjects syllabus behind schedule",
      severity: "medium",
      type: "syllabus",
      count: 2,
    },
    {
      id: 3,
      title: "Classes require adjustment due to staff leave",
      severity: "critical",
      isWarning: true,
      type: "substitution",
      count: 3,
    },
    {
      id: 4,
      title: "Approve 4 faculty leave/OD requests",
      severity: "medium",
      type: "leave",
      count: 4,
    },
    {
      id: 5,
      title: "Review 8 students with low internal marks",
      severity: "high",
      type: "marks",
      count: 8,
    },
    {
      id: 6,
      title: "Check 3 classes not conducted today",
      severity: "high",
      type: "classes",
      count: 3,
    },
    {
      id: 7,
      title: "Review ₹12.6 lakh pending fee students",
      severity: "medium",
      type: "fee",
      amount: "₹12.6 L",
    },
  ];

  // Sections at Risk Data
  const sectionsAtRisk = [
    {
      section: "III - A",
      headerBg: "bg-blue-100/70 text-blue-900 border-blue-200",
      lowAttendance: 8,
      internal1Failed: 3,
      internal2Failed: 5,
    },
    {
      section: "III - B",
      headerBg: "bg-emerald-100/70 text-emerald-900 border-emerald-200",
      lowAttendance: 6,
      internal1Failed: 4,
      internal2Failed: 3,
    },
    {
      section: "II - A",
      headerBg: "bg-amber-100/70 text-amber-900 border-amber-200",
      lowAttendance: 12,
      internal1Failed: 7,
      internal2Failed: 6,
    },
    {
      section: "IV - A",
      headerBg: "bg-purple-100/70 text-purple-900 border-purple-200",
      lowAttendance: 11,
      internal1Failed: 5,
      internal2Failed: 4,
    },
  ];

  // Subjects Behind Schedule Data
  const subjectsBehind = [
    {
      subject: "Mathematics-II",
      faculty: "Dr. A. Prakash",
      planned: 40,
      completed: 28,
      delay: "12%",
      coverage: "68%",
      status: "Behind",
    },
    {
      subject: "Data Structures",
      faculty: "Dr. M. Meena",
      planned: 42,
      completed: 35,
      delay: "18%",
      coverage: "62%",
      status: "Behind",
    },
    {
      subject: "Database Management",
      faculty: "Ms. S. Lakshmi",
      planned: 40,
      completed: 28,
      delay: "15%",
      coverage: "70%",
      status: "Behind",
    },
    {
      subject: "Operating Systems",
      faculty: "Mr. K. Ramesh",
      planned: 45,
      completed: 33,
      delay: "12%",
      coverage: "72%",
      status: "Behind",
    },
  ];

  // Exam Status Data
  const examStatusItems = [
    {
      icon: Calendar,
      iconColor: "text-blue-600",
      label: "Upcoming Exams (Mid III: 12 Oct)",
      count: 2,
    },
    {
      icon: ClipboardList,
      iconColor: "text-amber-500",
      label: "Marks Pending Entry (3 subjects)",
      count: 8,
    },
    {
      icon: CheckCircle,
      iconColor: "text-emerald-500",
      label: "Valuation Pending",
      count: 0,
    },
    {
      icon: FileText,
      iconColor: "text-blue-500",
      label: "Results Awaiting Approval (Mid II - CSE-A)",
      count: 1,
    },
    {
      icon: GraduationCap,
      iconColor: "text-amber-600",
      label: "Supplementary Requests",
      count: 0,
    },
  ];

  return (
    <div className="space-y-4 pb-12 font-sans text-slate-800">
      {/* ─────────────────────────────────────────────────────────────
          TOP BAR: Title + Department Dropdown | Date, Bell, User Chip
      ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-blue-100 shadow-xs">
        {/* Left: Heading & Department Dropdown */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <h1 className="text-xl sm:text-2xl font-black text-blue-700 tracking-tight flex items-center gap-2">
            HOD Dashboard
          </h1>
          <div className="relative">
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="appearance-none bg-blue-50/60 hover:bg-blue-50 border border-blue-200/90 text-blue-900 text-xs sm:text-sm font-semibold rounded-xl pl-3.5 pr-8 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition cursor-pointer"
            >
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-blue-700 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* Right: Date, Notifications, Profile */}
        <div className="flex items-center gap-3 sm:gap-5 self-end md:self-auto">
          {/* Calendar Date Indicator */}
          <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>Monday, 5 Oct 2026</span>
          </div>

          {/* Notifications Bell */}
          <div className="relative cursor-pointer hover:opacity-80 transition p-1">
            <Bell className="w-5 h-5 text-blue-700" />
            <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white">
              6
            </span>
          </div>

          {/* User Profile */}
          <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
            <div className="w-9 h-9 rounded-full bg-linear-to-tr from-blue-700 to-indigo-600 text-white flex items-center justify-center font-bold text-xs ring-2 ring-blue-100 shadow-2xs">
              RK
            </div>
            <div className="leading-tight">
              <p className="text-xs sm:text-sm font-bold text-slate-900">{userName}</p>
              <p className="text-[11px] font-medium text-slate-500">{roleLabel}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          ROW 1: Student Attendance (Left) + Today's Priorities (Right)
      ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Student Attendance (Span 8) */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Main Attendance Metric */}
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-xs shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-blue-950">Student Attendance</p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-3xl font-black text-blue-700">87%</span>
                </div>
                <p className="text-xs font-semibold text-slate-600 mt-0.5">
                  Present: <span className="font-bold text-slate-800">538</span> / 620
                </p>
                <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 mt-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>+2% vs last week</span>
                </div>
              </div>
            </div>

            {/* Section-wise Attendance Breakdown */}
            <div className="flex-1 max-w-lg">
              <p className="text-xs font-bold text-slate-600 mb-2 sm:text-center">
                Section-wise Attendance
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-2.5 text-center">
                  <p className="text-[11px] font-bold text-slate-700">III - A</p>
                  <p className="text-lg font-black text-blue-700 mt-0.5">89%</p>
                </div>
                <div className="bg-teal-50/70 border border-teal-100 rounded-xl p-2.5 text-center">
                  <p className="text-[11px] font-bold text-slate-700">III - B</p>
                  <p className="text-lg font-black text-teal-700 mt-0.5">86%</p>
                </div>
                <div className="bg-sky-50/70 border border-sky-100 rounded-xl p-2.5 text-center">
                  <p className="text-[11px] font-bold text-slate-700">II - A</p>
                  <p className="text-lg font-black text-sky-700 mt-0.5">84%</p>
                </div>
                <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-2.5 text-center">
                  <p className="text-[11px] font-bold text-slate-700">IV - A</p>
                  <p className="text-lg font-black text-indigo-700 mt-0.5">88%</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Today's Priorities (Span 4) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-rose-100/90 p-4 sm:p-5 shadow-xs flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-rose-600">
              <Star className="w-5 h-5 fill-rose-500 text-rose-500" />
              <h2 className="text-base font-black text-rose-600 tracking-tight">
                Today&apos;s Priorities
              </h2>
            </div>
            <span className="bg-rose-500 text-white font-extrabold text-xs px-2 py-0.5 rounded-full shadow-2xs">
              7
            </span>
          </div>

          {/* List of 7 Priorities */}
          <div className="space-y-1.5 overflow-y-auto max-h-[260px] pr-1">
            {priorityItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedPriority(item.title)}
                className="w-full text-left flex items-center justify-between p-2 rounded-xl hover:bg-rose-50/50 border border-transparent hover:border-rose-100 transition group cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-1">
                  <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                    {item.id}
                  </span>
                  <p className="text-xs font-semibold text-slate-800 group-hover:text-rose-950 truncate flex items-center gap-1">
                    {item.isWarning && (
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 inline" />
                    )}
                    <span>{item.title}</span>
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-rose-600 shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          ROW 2: Students at Risk (4 Sections Breakdown)
      ────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs">
        {/* Header */}
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-1.5">
            <h2 className="text-base font-black text-blue-950 tracking-tight">
              Students at Risk
            </h2>
            <Info className="w-4 h-4 text-blue-500 cursor-pointer" />
          </div>
          <button
            onClick={() => setActiveModal("students-risk")}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline transition"
          >
            View Details
          </button>
        </div>

        {/* 4 Section Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {sectionsAtRisk.map((sec) => (
            <div
              key={sec.section}
              className="rounded-xl border border-slate-200/80 overflow-hidden bg-slate-50/30 hover:shadow-xs transition"
            >
              {/* Card Header Strip */}
              <div
                className={`px-3 py-1.5 font-bold text-xs text-center border-b ${sec.headerBg}`}
              >
                {sec.section}
              </div>

              {/* 3 Metric Columns */}
              <div className="grid grid-cols-3 divide-x divide-slate-100 p-2.5 text-center bg-white">
                <div>
                  <p className="text-lg font-black text-rose-600">{sec.lowAttendance}</p>
                  <p className="text-[10px] font-medium text-slate-500 leading-tight mt-0.5">
                    Attendance
                    <br />
                    &lt; 65%
                  </p>
                </div>
                <div>
                  <p className="text-lg font-black text-amber-600">{sec.internal1Failed}</p>
                  <p className="text-[10px] font-medium text-slate-500 leading-tight mt-0.5">
                    Internal 1<br />
                    Failed
                  </p>
                </div>
                <div>
                  <p className="text-lg font-black text-orange-600">{sec.internal2Failed}</p>
                  <p className="text-[10px] font-medium text-slate-500 leading-tight mt-0.5">
                    Internal 2<br />
                    Failed
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          ROW 3: Subjects Behind Schedule (Left) + Fee Due Age Wise (Right)
      ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Subjects Behind Schedule (Span 7) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                  <BookOpen className="w-4 h-4" />
                </div>
                <h2 className="text-base font-black text-blue-950 tracking-tight">
                  Subjects Behind Schedule
                </h2>
              </div>
              <button
                onClick={() => setActiveModal("subjects-behind")}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline transition"
              >
                View All
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold">
                    <th className="pb-2 text-slate-600">Subject</th>
                    <th className="pb-2 text-center text-slate-600">Planned</th>
                    <th className="pb-2 text-center text-slate-600">Completed</th>
                    <th className="pb-2 text-center text-slate-600">Delay</th>
                    <th className="pb-2 text-center text-slate-600">Current Coverage</th>
                    <th className="pb-2 text-center text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subjectsBehind.map((sub, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition">
                      <td className="py-2.5 pr-2">
                        <p className="font-bold text-slate-900 leading-tight">{sub.subject}</p>
                        <p className="text-[11px] font-medium text-slate-500">{sub.faculty}</p>
                      </td>
                      <td className="py-2.5 text-center font-semibold text-slate-700">
                        {sub.planned}
                      </td>
                      <td className="py-2.5 text-center font-semibold text-slate-700">
                        {sub.completed}
                      </td>
                      <td className="py-2.5 text-center font-bold text-rose-600">{sub.delay}</td>
                      <td className="py-2.5 text-center font-semibold text-slate-800">
                        {sub.coverage}
                      </td>
                      <td className="py-2.5 text-center">
                        <span className="inline-block bg-rose-50 text-rose-600 border border-rose-200 font-bold text-[10px] px-2.5 py-0.5 rounded-full">
                          {sub.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Fee Due Age Wise (Span 5) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                  <IndianRupee className="w-4 h-4" />
                </div>
                <h2 className="text-base font-black text-blue-950 tracking-tight">
                  Fee Due Age Wise
                </h2>
              </div>
              <button
                onClick={() => setActiveModal("fee-due")}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline transition"
              >
                View Details
              </button>
            </div>

            {/* Total Pending Fee Banner */}
            <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-3 flex items-center gap-3.5 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold shrink-0 shadow-2xs">
                <IndianRupee className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-600">Total Pending Fees</p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-xl sm:text-2xl font-black text-emerald-700">₹ 13.6 L</span>
                  <span className="text-xs font-semibold text-slate-500">(62 Students)</span>
                </div>
              </div>
            </div>

            {/* 3 Age Wise Buckets */}
            <div className="grid grid-cols-3 gap-2">
              {/* > 15 Days */}
              <div className="bg-amber-50/60 border border-amber-200/70 rounded-xl p-2.5 text-center">
                <p className="text-[11px] font-bold text-slate-700 flex items-center justify-center gap-1">
                  <Users className="w-3 h-3 text-amber-600" />
                  <span>&gt; 15 Days</span>
                </p>
                <p className="text-sm font-black text-amber-700 mt-1">18</p>
                <p className="text-[10px] font-medium text-slate-600">Students</p>
                <p className="text-xs font-black text-amber-800 mt-1">₹ 3.2 L</p>
              </div>

              {/* > 30 Days */}
              <div className="bg-orange-50/60 border border-orange-200/70 rounded-xl p-2.5 text-center">
                <p className="text-[11px] font-bold text-slate-700 flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3 text-orange-600" />
                  <span>&gt; 30 Days</span>
                </p>
                <p className="text-sm font-black text-orange-700 mt-1">26</p>
                <p className="text-[10px] font-medium text-slate-600">Students</p>
                <p className="text-xs font-black text-orange-800 mt-1">₹ 6.1 L</p>
              </div>

              {/* > 60 Days */}
              <div className="bg-rose-50/60 border border-rose-200/70 rounded-xl p-2.5 text-center">
                <p className="text-[11px] font-bold text-slate-700 flex items-center justify-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                  <span>&gt; 60 Days</span>
                </p>
                <p className="text-sm font-black text-rose-700 mt-1">18</p>
                <p className="text-[10px] font-medium text-slate-600">Students</p>
                <p className="text-xs font-black text-rose-800 mt-1">₹ 4.3 L</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          ROW 4: 3 Cards (Faculty Attendance | Examination Status | Placements)
      ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* CARD 1: Faculty Attendance & Leave Status */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm sm:text-base font-black text-blue-950 tracking-tight">
                Faculty Attendance &amp; Leave Status
              </h2>
              <button
                onClick={() => setActiveModal("faculty-status")}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline transition"
              >
                View Details
              </button>
            </div>

            <div className="flex items-center gap-3">
              {/* Main Attendance Percentage */}
              <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3 text-center shrink-0 w-32">
                <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center mx-auto mb-1">
                  <Users className="w-4 h-4" />
                </div>
                <p className="text-2xl font-black text-emerald-700">94%</p>
                <p className="text-[11px] font-bold text-slate-700 leading-tight mt-0.5">
                  Faculty Attendance
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">Present: 31 / 33</p>
                <p className="text-[10px] font-bold text-emerald-600 mt-0.5">
                  ↗ +3% vs last week
                </p>
              </div>

              {/* 3 Mini Status Cards */}
              <div className="flex-1 space-y-1.5">
                {/* Late Arrivals */}
                <div className="bg-amber-50/70 border border-amber-200/70 rounded-xl px-2.5 py-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-amber-500 text-white flex items-center justify-center">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="text-sm font-black text-amber-700 mr-1.5">2</span>
                      <span className="text-[11px] font-bold text-slate-700">
                        Late Arrivals Today
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-amber-600" />
                </div>

                {/* On Leave */}
                <div className="bg-sky-50/70 border border-sky-200/70 rounded-xl px-2.5 py-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-sky-500 text-white flex items-center justify-center">
                      <Plane className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="text-sm font-black text-sky-700 mr-1.5">1</span>
                      <span className="text-[11px] font-bold text-slate-700">
                        On Leave Today
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-sky-600" />
                </div>

                {/* Absent */}
                <div className="bg-rose-50/70 border border-rose-200/70 rounded-xl px-2.5 py-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-rose-500 text-white flex items-center justify-center">
                      <UserX className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="text-sm font-black text-rose-700 mr-1.5">0</span>
                      <span className="text-[11px] font-bold text-slate-700">Absent Today</span>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-rose-600" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 2: Examination Status */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm sm:text-base font-black text-blue-950 tracking-tight">
                Examination Status
              </h2>
              <button
                onClick={() => setActiveModal("exam-status")}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline transition"
              >
                View All
              </button>
            </div>

            <div className="space-y-2">
              {examStatusItems.map((item, idx) => {
                const IconComponent = item.icon;
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs py-1 px-1.5 rounded-lg hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center gap-2 text-slate-800 font-semibold truncate pr-2">
                      <IconComponent className={`w-4 h-4 shrink-0 ${item.iconColor}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    <span
                      className={`font-black text-xs px-2 py-0.5 rounded-md ${
                        item.count > 0
                          ? "bg-blue-50 text-blue-700 font-bold"
                          : "text-slate-400 font-semibold"
                      }`}
                    >
                      {item.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* CARD 3: Placements & Training */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm sm:text-base font-black text-blue-950 tracking-tight">
                Placements &amp; Training
              </h2>
              <button
                onClick={() => setActiveModal("placements")}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline transition"
              >
                View Details
              </button>
            </div>

            {/* Top Donut & Legend */}
            <div className="flex items-center justify-around gap-2 mb-3">
              {/* Circular Gauge Ring */}
              <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  {/* Track */}
                  <path
                    className="text-slate-100"
                    strokeWidth="3.8"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {/* Placed Progress (78%) */}
                  <path
                    className="text-emerald-500 transition-all duration-700"
                    strokeDasharray="78, 100"
                    strokeWidth="3.8"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="text-sm font-black text-emerald-600 block">78%</span>
                  <span className="text-[9px] font-bold text-slate-500 block leading-tight">
                    (234/301)
                  </span>
                </div>
              </div>

              {/* Legend */}
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between gap-4 font-semibold">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <span className="text-slate-600">Placed</span>
                  </div>
                  <span className="font-bold text-slate-900">148</span>
                </div>
                <div className="flex items-center justify-between gap-4 font-semibold">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                    <span className="text-slate-600">Eligible</span>
                  </div>
                  <span className="font-bold text-slate-900">190</span>
                </div>
                <div className="flex items-center justify-between gap-4 font-semibold">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                    <span className="text-slate-600">Unplaced</span>
                  </div>
                  <span className="font-bold text-slate-900">42</span>
                </div>
              </div>
            </div>

            {/* Bottom 3 KPI Tiles */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-sky-50/70 border border-sky-100 rounded-xl p-2 text-center">
                <p className="text-base font-black text-sky-700">45</p>
                <p className="text-[10px] font-bold text-slate-600 leading-tight mt-0.5">
                  Training Ongoing
                </p>
              </div>
              <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-2 text-center">
                <p className="text-base font-black text-emerald-700">312</p>
                <p className="text-[10px] font-bold text-slate-600 leading-tight mt-0.5">
                  Offers Received
                </p>
              </div>
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-2 text-center">
                <p className="text-base font-black text-indigo-700">6</p>
                <p className="text-[10px] font-bold text-slate-600 leading-tight mt-0.5">
                  Upcoming Drives
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          INTERACTIVE MODAL / DETAIL DRAWER FOR CLICKS
      ────────────────────────────────────────────────────────────── */}
      {selectedPriority && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-900 text-base">Priority Action Item</h3>
              <button
                onClick={() => setSelectedPriority(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 bg-rose-50/80 rounded-xl border border-rose-100 text-xs font-semibold text-rose-900">
              {selectedPriority}
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              This action item has been queued for immediate HOD review. You can initiate
              adjustments, approve substitutions, or dispatch parent SMS notifications.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedPriority(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Close
              </button>
              <button
                onClick={() => setSelectedPriority(null)}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs"
              >
                Take Action
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-900 text-base capitalize">
                {activeModal.replace("-", " ")} Details
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Detailed metrics and breakdown for <strong>{selectedDept}</strong>. In-depth report
              and student roster configurations will be integrated in the next module iteration.
            </p>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
