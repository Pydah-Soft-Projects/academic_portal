"use client";

import Link from "next/link";
import { useEffect, useState, useMemo, useCallback, Fragment, useRef } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { AcademicFilterBar } from "@/components/layout/AcademicFilterBar";
import { useAcademicContext } from "@/components/layout/AcademicProvider";
import { apiFetch } from "@/lib/api";
import {
  Save,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  Download,
  Printer,
  Calculator,
  SlidersHorizontal,
} from "lucide-react";

type SubjectItem = {
  subjectId: number;
  code: string;
  name: string;
  type?: string;
  credits?: number;
};

type StudentItem = {
  studentDbId: number;
  admissionNumber: string;
  pinNo: string;
  studentName: string;
  sectionName?: string;
  currentYear?: number;
  currentSemester?: number;
};

type EntryKey = `${number}_${number}`; // `${studentDbId}_${subjectId}`

type StudentAttendanceRecord = {
  classesHeld: number;
  classesPresent: number;
};

export function SubjectAttendanceRegisterView() {
  const { filters, masters } = useAcademicContext();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [entries, setEntries] = useState<Map<EntryKey, StudentAttendanceRecord>>(new Map());
  const [dirty, setDirty] = useState(false);

  // View layout controls (default to false for spacious "free space" layout)
  const [fitAll, setFitAll] = useState(false);
  const [fixedHeight] = useState(true);

  // Search and threshold filters
  const [searchQuery, setSearchQuery] = useState("");
  const [thresholdFilter, setThresholdFilter] = useState<"all" | "eligible" | "condonation" | "detained">("all");
  const [thresholds, setThresholds] = useState<{
    eligibleThreshold: number;
    condonationMinThreshold: number;
  }>({
    eligibleThreshold: 75,
    condonationMinThreshold: 65,
  });

  // Bulk Apply modal / state
  const [bulkHeldSubjectId, setBulkHeldSubjectId] = useState<number | "all">("all");
  const [bulkHeldValue, setBulkHeldValue] = useState<string>("40");
  const [showBulkModal, setShowBulkModal] = useState(false);

  const collegeId = filters.collegeId !== "all" ? filters.collegeId : undefined;
  const courseId = filters.courseId !== "all" ? filters.courseId : undefined;
  const branchId = filters.branchId !== "all" ? filters.branchId : undefined;
  const year = filters.year !== "all" ? filters.year : 1;
  const semester = filters.semester !== "all" ? filters.semester : 1;
  const section = filters.section !== "all" ? filters.section : "";
  const batch = filters.batch !== "all" ? filters.batch : "";
  const academicYear = filters.academicYear || "2025-2026";

  const selectedCollege = masters?.colleges?.find((c) => String(c.id) === String(collegeId));
  const collegeName = selectedCollege?.name || "Pydah College of Engineering";
  const selectedCourse = masters?.courses?.find((c) => String(c.id) === String(courseId));
  const courseName = selectedCourse?.name || "B.Tech";
  const selectedBranch = masters?.branches?.find((b) => String(b.id) === String(branchId));
  const branchName = selectedBranch?.name || "Computer Science and Engineering";

  // Fetch Subject Attendance Data from DB
  const loadRegisterData = useCallback(async () => {
    if (!collegeId || !branchId) {
      setSubjects([]);
      setStudents([]);
      setEntries(new Map());
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const q = new URLSearchParams();
      if (collegeId) q.set("collegeId", String(collegeId));
      if (courseId) q.set("courseId", String(courseId));
      if (branchId) q.set("branchId", String(branchId));
      if (year) q.set("year", String(year));
      if (semester) q.set("semester", String(semester));
      if (section) q.set("section", section);
      if (batch) q.set("batch", batch);
      if (academicYear) q.set("academicYear", academicYear);

      const response = await apiFetch(`/subject-attendance?${q.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to load subject attendance: ${response.status} ${response.statusText}`);
      }

      const res = (await response.json()) as {
        subjects: SubjectItem[];
        students: StudentItem[];
        entries: Array<{
          studentDbId: number;
          subjectId: number;
          classesHeld: number;
          classesPresent: number;
        }>;
        defaultClassesHeld: Record<number, number>;
        hasSavedEntries: boolean;
        thresholds?: {
          eligibleThreshold: number;
          condonationMinThreshold: number;
        };
      };

      if (res.thresholds) {
        setThresholds(res.thresholds);
      }

      setSubjects(Array.isArray(res.subjects) ? res.subjects : []);
      setStudents(Array.isArray(res.students) ? res.students : []);

      const newEntries = new Map<EntryKey, StudentAttendanceRecord>();
      if (res.entries && res.entries.length > 0) {
        for (const e of res.entries) {
          const key: EntryKey = `${e.studentDbId}_${e.subjectId}`;
          newEntries.set(key, {
            classesHeld: Number(e.classesHeld ?? 0),
            classesPresent: Number(e.classesPresent ?? 0),
          });
        }
      }

      setEntries(newEntries);
      setDirty(false);
    } catch (err) {
      console.error("[subject-attendance] load error:", err);
      setError(err instanceof Error ? err.message : "Could not load students and subjects from the database.");
    } finally {
      setLoading(false);
    }
  }, [collegeId, courseId, branchId, year, semester, section, batch, academicYear]);

  useEffect(() => {
    loadRegisterData();
  }, [loadRegisterData]);

  // Handle cell edit for classesHeld or classesPresent
  const handleCellChange = (
    studentDbId: number,
    subjectId: number,
    field: "classesHeld" | "classesPresent",
    value: number,
  ) => {
    const key: EntryKey = `${studentDbId}_${subjectId}`;
    const current = entries.get(key) || { classesHeld: 0, classesPresent: 0 };
    const updated = {
      ...current,
      [field]: Math.max(0, value),
    };

    setEntries(new Map(entries.set(key, updated)));
    setDirty(true);
  };


  // Bulk Apply Classes Held
  const handleApplyBulkHeld = () => {
    const val = parseInt(bulkHeldValue, 10);
    if (isNaN(val) || val < 0) return;

    const newMap = new Map(entries);
    const targetSubjects =
      bulkHeldSubjectId === "all"
        ? subjects
        : subjects.filter((s) => s.subjectId === bulkHeldSubjectId);

    for (const student of students) {
      for (const subject of targetSubjects) {
        const key: EntryKey = `${student.studentDbId}_${subject.subjectId}`;
        const current = newMap.get(key) || { classesHeld: 0, classesPresent: 0 };
        newMap.set(key, {
          ...current,
          classesHeld: val,
        });
      }
    }

    setEntries(newMap);
    setDirty(true);
    setShowBulkModal(false);
    setSuccessMessage(`Classes Held set to ${val} for ${targetSubjects.length} subject(s)!`);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Bulk 100% Present Fill
  const handleMarkAllFullPresent = () => {
    const newMap = new Map(entries);
    for (const student of students) {
      for (const subject of subjects) {
        const key: EntryKey = `${student.studentDbId}_${subject.subjectId}`;
        const current = newMap.get(key) || { classesHeld: 40, classesPresent: 0 };
        const held = current.classesHeld > 0 ? current.classesHeld : 40;
        newMap.set(key, {
          classesHeld: held,
          classesPresent: held,
        });
      }
    }
    setEntries(newMap);
    setDirty(true);
    setSuccessMessage("Marked full attendance (100%) for all students!");
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Save Register Data
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    const payloadEntries: Array<{
      studentDbId: number;
      admissionNumber: string;
      pinNo: string;
      studentName: string;
      subjectId: number;
      classesHeld: number;
      classesPresent: number;
    }> = [];

    for (const student of students) {
      for (const subject of subjects) {
        const key: EntryKey = `${student.studentDbId}_${subject.subjectId}`;
        const data = entries.get(key) || { classesHeld: 0, classesPresent: 0 };
        payloadEntries.push({
          studentDbId: student.studentDbId,
          admissionNumber: student.admissionNumber,
          pinNo: student.pinNo,
          studentName: student.studentName,
          subjectId: subject.subjectId,
          classesHeld: data.classesHeld,
          classesPresent: data.classesPresent,
        });
      }
    }

    try {
      const response = await apiFetch("/subject-attendance/save", {
        method: "POST",
        body: JSON.stringify({
          collegeId: collegeId || 1,
          courseId: courseId || 1,
          branchId: branchId || 1,
          academicYear,
          year,
          semester,
          section,
          batch,
          entries: payloadEntries,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.message || `Save failed (${response.status})`);
      }

      const res = (await response.json()) as { success: boolean; count: number };

      if (res.success) {
        setDirty(false);
        setSuccessMessage(`Successfully saved ${res.count || payloadEntries.length} student attendance entries!`);
        setTimeout(() => setSuccessMessage(null), 5000);
      }
    } catch (err) {
      console.error("Save failed:", err);
      setError(err instanceof Error ? err.message : "Failed to save attendance register to server.");
    } finally {
      setSaving(false);
    }
  };

  // Export to Excel / CSV with full institutional report formatting
  const handleExportCsv = () => {
    if (students.length === 0 || subjects.length === 0) return;

    const lines: string[] = [
      `"PYDAH EDUCATIONAL ACADEMY"`,
      `"${collegeName.toUpperCase()}"`,
      `"CONSOLIDATED SUBJECT-WISE ATTENDANCE REGISTER REPORT"`,
      `"Academic Year:","${academicYear}","Course:","${courseName}","Branch:","${branchName}"`,
      `"Year:","Year ${year}","Semester:","Semester ${semester}","Section:","${section || "All Sections"}","Generated:","${new Date().toLocaleString("en-GB")}"`,
      `"Total Students:","${students.length}","Class Average:","${stats.avgPct}%","Eligible (>=${thresholds.eligibleThreshold}%):","${stats.eligibleCount}","Condonation (${thresholds.condonationMinThreshold}-${thresholds.eligibleThreshold - 1}%):","${stats.condonationCount}","Detained (<${thresholds.condonationMinThreshold}%):","${stats.detainedCount}"`,
      "", // blank separator
    ];

    // Tier 1 Subject Names Header
    const tier1Headers: string[] = ["S.No", "PIN Number", "Student Name", "Section"];
    for (const sub of subjects) {
      tier1Headers.push(`"${sub.code} - ${sub.name.replace(/"/g, '""')}"`, "", "");
    }
    tier1Headers.push('"Overall Aggregate"', "", "", '"Eligibility Status"');
    lines.push(tier1Headers.join(","));

    // Tier 2 Column Headers
    const tier2Headers: string[] = ["", "", "", ""];
    for (const sub of subjects) {
      tier2Headers.push("Held", "Attended", "%");
    }
    tier2Headers.push("Total Held", "Total Attended", "Overall %", "Status");
    lines.push(tier2Headers.join(","));

    // Data rows
    students.forEach((student, idx) => {
      let totalHeld = 0;
      let totalPresent = 0;

      const row: string[] = [
        String(idx + 1),
        `"${student.pinNo}"`,
        `"${student.studentName.replace(/"/g, '""')}"`,
        `"${student.sectionName || section || ""}"`,
      ];

      for (const sub of subjects) {
        const key: EntryKey = `${student.studentDbId}_${sub.subjectId}`;
        const data = entries.get(key) || { classesHeld: 0, classesPresent: 0 };
        const pct = data.classesHeld > 0 ? ((data.classesPresent / data.classesHeld) * 100).toFixed(1) : "0.0";
        totalHeld += data.classesHeld;
        totalPresent += data.classesPresent;

        row.push(String(data.classesHeld), String(data.classesPresent), `${pct}%`);
      }

      const overallPct = totalHeld > 0 ? ((totalPresent / totalHeld) * 100).toFixed(1) : "0.0";
      const status =
        parseFloat(overallPct) >= thresholds.eligibleThreshold
          ? "Eligible"
          : parseFloat(overallPct) >= thresholds.condonationMinThreshold
          ? "Condonation"
          : "Detained";

      row.push(String(totalHeld), String(totalPresent), `${overallPct}%`, `"${status}"`);
      lines.push(row.join(","));
    });

    // Summary / Class Average row
    const summaryRow: string[] = ['"CLASS AVERAGE"', '""', '""', '""'];
    let grandHeldSum = 0;
    let grandPresSum = 0;

    for (const sub of subjects) {
      let subHeldSum = 0;
      let subPresentSum = 0;
      for (const s of students) {
        const d = entries.get(`${s.studentDbId}_${sub.subjectId}`);
        if (d) {
          subHeldSum += d.classesHeld;
          subPresentSum += d.classesPresent;
        }
      }
      grandHeldSum += subHeldSum;
      grandPresSum += subPresentSum;

      const avgHeld = students.length > 0 ? (subHeldSum / students.length).toFixed(0) : "0";
      const avgPres = students.length > 0 ? (subPresentSum / students.length).toFixed(0) : "0";
      const avgPct = subHeldSum > 0 ? ((subPresentSum / subHeldSum) * 100).toFixed(1) : "0.0";
      summaryRow.push(avgHeld, avgPres, `${avgPct}%`);
    }

    const overallAvgHeld = students.length > 0 ? (grandHeldSum / students.length).toFixed(0) : "0";
    const overallAvgPres = students.length > 0 ? (grandPresSum / students.length).toFixed(0) : "0";
    const overallAvgPct = grandHeldSum > 0 ? ((grandPresSum / grandHeldSum) * 100).toFixed(1) : "0.0";

    summaryRow.push(overallAvgHeld, overallAvgPres, `${overallAvgPct}%`, `"${stats.eligibleCount}/${students.length} Pass"`);
    lines.push(summaryRow.join(","));

    // Institutional sign-off row in CSV
    lines.push("");
    lines.push('"Prepared by: Class Teacher","","","","Verified by: Head of Department (HOD)","","","","Approved by: Principal"');

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + lines.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const safeCollege = collegeName.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 15);
    const safeBranch = branchName.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 10);
    link.setAttribute(
      "download",
      `Subject_Attendance_Register_${safeCollege}_${safeBranch}_Y${year}S${semester}_Sec${section || "All"}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered students by search & threshold
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesPin = student.pinNo.toLowerCase().includes(q);
        const matchesName = student.studentName.toLowerCase().includes(q);
        const matchesAdm = student.admissionNumber.toLowerCase().includes(q);
        if (!matchesPin && !matchesName && !matchesAdm) return false;
      }

      if (thresholdFilter !== "all") {
        let totalHeld = 0;
        let totalPresent = 0;
        for (const sub of subjects) {
          const key: EntryKey = `${student.studentDbId}_${sub.subjectId}`;
          const d = entries.get(key);
          if (d) {
            totalHeld += d.classesHeld;
            totalPresent += d.classesPresent;
          }
        }
        const pct = totalHeld > 0 ? (totalPresent / totalHeld) * 100 : 0;

        if (thresholdFilter === "eligible" && pct < thresholds.eligibleThreshold) return false;
        if (
          thresholdFilter === "condonation" &&
          (pct < thresholds.condonationMinThreshold || pct >= thresholds.eligibleThreshold)
        )
          return false;
        if (thresholdFilter === "detained" && pct >= thresholds.condonationMinThreshold) return false;
      }

      return true;
    });
  }, [students, searchQuery, thresholdFilter, subjects, entries, thresholds]);

  // Aggregate Stats
  const stats = useMemo(() => {
    let totalHeldAll = 0;
    let totalPresentAll = 0;
    let eligibleCount = 0;
    let condonationCount = 0;
    let detainedCount = 0;

    for (const student of students) {
      let sHeld = 0;
      let sPresent = 0;
      for (const sub of subjects) {
        const key: EntryKey = `${student.studentDbId}_${sub.subjectId}`;
        const d = entries.get(key);
        if (d) {
          sHeld += d.classesHeld;
          sPresent += d.classesPresent;
        }
      }
      totalHeldAll += sHeld;
      totalPresentAll += sPresent;

      const pct = sHeld > 0 ? (sPresent / sHeld) * 100 : 0;
      if (pct >= thresholds.eligibleThreshold) eligibleCount++;
      else if (pct >= thresholds.condonationMinThreshold) condonationCount++;
      else detainedCount++;
    }

    const avgPct = totalHeldAll > 0 ? (totalPresentAll / totalHeldAll) * 100 : 0;

    return {
      totalStudents: students.length,
      totalSubjects: subjects.length,
      avgPct: avgPct.toFixed(1),
      eligibleCount,
      condonationCount,
      detainedCount,
    };
  }, [students, subjects, entries, thresholds]);

  // Keyboard shortcut Ctrl+S
  const saveRef = useRef(handleSave);
  saveRef.current = handleSave;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (dirty && !saving) {
          saveRef.current();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dirty, saving]);

  return (
    <div className="space-y-6 pb-20 print:space-y-0 print:pb-0">
      {/* Header */}
      <div className="print:hidden">
        <PageHeader
          title="Subject-Wise Attendance Register"
          description="Enter classes held and classes present. The system automatically calculates subject percentages and the overall aggregate percentage."
        />
      </div>

      {/* Filter Bar */}
      <div className="space-y-3 print:hidden">
        <AcademicFilterBar title="Academic Scope Filters" />
      </div>

      {/* Alerts */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setError(null)} className="h-6 px-2 text-rose-700">
            Dismiss
          </Button>
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 flex items-center gap-2 print:hidden">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {/* Key Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 print:hidden">
        <Card className="p-3.5 border-slate-200">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Students</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{stats.totalStudents}</span>
            <span className="text-[11px] text-slate-400">roster</span>
          </div>
        </Card>

        <Card className="p-3.5 border-slate-200">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Subjects</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{stats.totalSubjects}</span>
            <span className="text-[11px] text-slate-400">columns</span>
          </div>
        </Card>

        <Card className="p-3.5 border-slate-200">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Class Avg %</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span
              className={`text-2xl font-bold ${
                parseFloat(stats.avgPct) >= thresholds.eligibleThreshold
                  ? "text-emerald-600"
                  : parseFloat(stats.avgPct) >= thresholds.condonationMinThreshold
                  ? "text-amber-600"
                  : "text-rose-600"
              }`}
            >
              {stats.avgPct}%
            </span>
            <span className="text-[11px] text-slate-400">overall</span>
          </div>
        </Card>

        <Card className="p-3.5 border-emerald-200 bg-emerald-50/30">
          <div className="text-[11px] font-medium text-emerald-700 uppercase tracking-wider">
            Eligible (≥{thresholds.eligibleThreshold}%)
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-emerald-700">{stats.eligibleCount}</span>
            <span className="text-[11px] text-emerald-600">students</span>
          </div>
        </Card>

        <Card className="p-3.5 border-amber-200 bg-amber-50/30">
          <div className="text-[11px] font-medium text-amber-700 uppercase tracking-wider">
            Condonation ({thresholds.condonationMinThreshold}–{thresholds.eligibleThreshold - 1}%)
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-amber-700">{stats.condonationCount}</span>
            <span className="text-[11px] text-amber-600">students</span>
          </div>
        </Card>

        <Card className="p-3.5 border-rose-200 bg-rose-50/30">
          <div className="text-[11px] font-medium text-rose-700 uppercase tracking-wider">
            Detained (&lt;{thresholds.condonationMinThreshold}%)
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-rose-700">{stats.detainedCount}</span>
            <span className="text-[11px] text-rose-600">at risk</span>
          </div>
        </Card>
      </div>

      {/* Main Register Table Card */}
      <Card className="overflow-hidden border-slate-200 shadow-sm print:border-none print:shadow-none print:p-0 print:overflow-visible print:w-full print:max-w-none">
        {/* Table Toolbar (Single Line on All Screens) */}
        <div className="flex items-center justify-between gap-2.5 border-b border-slate-200 bg-slate-50/80 px-3.5 py-2 overflow-x-auto whitespace-nowrap print:hidden">
          {/* Left: Compact Search & Threshold Filter Pills */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Search */}
            <div className="relative w-44 sm:w-56 shrink-0">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search PIN or Student..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white py-1 pl-8 pr-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-brand-500 focus:outline-hidden h-8"
              />
            </div>

            {/* Threshold Filter */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 text-xs shrink-0">
              <button
                type="button"
                onClick={() => setThresholdFilter("all")}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                  thresholdFilter === "all" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All ({students.length})
              </button>
              <button
                type="button"
                onClick={() => setThresholdFilter("eligible")}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                  thresholdFilter === "eligible"
                    ? "bg-emerald-600 text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                ≥{thresholds.eligibleThreshold}% ({stats.eligibleCount})
              </button>
              <button
                type="button"
                onClick={() => setThresholdFilter("condonation")}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                  thresholdFilter === "condonation"
                    ? "bg-amber-600 text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {thresholds.condonationMinThreshold}–{thresholds.eligibleThreshold - 1}% ({stats.condonationCount})
              </button>
              <button
                type="button"
                onClick={() => setThresholdFilter("detained")}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                  thresholdFilter === "detained" ? "bg-rose-600 text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                &lt;{thresholds.condonationMinThreshold}% ({stats.detainedCount})
              </button>
            </div>
          </div>

          {/* Right: Actions in a Single Line */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Link
              href="/settings/attendance-thresholds"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs h-8 shrink-0 transition"
              title="Configure Attendance Percentage Setups and Thresholds"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-slate-600" />
              <span className="hidden xl:inline">% Setup</span>
            </Link>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowBulkModal(true)}
              className="gap-1.5 text-xs text-slate-700 h-8 px-2.5 shrink-0"
              title="Bulk apply classes held across subjects"
            >
              <Sparkles className="h-3.5 w-3.5 text-brand-600" />
              <span>Set Classes Held</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportCsv}
              className="gap-1.5 text-xs shadow-2xs h-8 px-2.5 shrink-0"
              title="Export to Excel / CSV"
            >
              <Download className="h-3.5 w-3.5 text-slate-600" />
              <span className="hidden md:inline">Export Excel / CSV</span>
              <span className="md:hidden">Export</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.print()}
              className="gap-1.5 text-xs shadow-2xs h-8 px-2.5 shrink-0"
              title="Print or Save as PDF"
            >
              <Printer className="h-3.5 w-3.5 text-slate-600" />
              <span>Print / PDF</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="gap-1.5 text-xs font-semibold shadow-xs h-8 px-3 shrink-0"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{saving ? "Saving..." : dirty ? "Save Register *" : "Save Register"}</span>
            </Button>

            {dirty && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-200 shrink-0">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                Unsaved edits
              </span>
            )}
          </div>
        </div>

        {/* Official Institutional Print Header (Visible ONLY in Print / PDF Export) */}
        <div className="hidden print:block mb-4 border-b-2 border-slate-900 pb-3">
          <div className="text-center">
            <h1 className="text-xl font-extrabold uppercase tracking-widest text-slate-950 font-serif">
              Pydah Educational Academy
            </h1>
            <h2 className="text-sm font-bold uppercase text-slate-800 tracking-wider mt-0.5">
              {collegeName}
            </h2>
            <div className="mt-1.5 inline-block bg-slate-100 border border-slate-400 px-3.5 py-0.5 rounded text-xs font-black uppercase tracking-wider text-slate-950">
              Consolidated Subject-Wise Attendance Register
            </div>
          </div>

          {/* Scope Metadata Matrix */}
          <div className="mt-3 grid grid-cols-4 gap-x-4 gap-y-1.5 border border-slate-400 bg-slate-50/50 p-2.5 rounded text-[10px]">
            <div>
              <span className="font-bold text-slate-700">Course &amp; Branch: </span>
              <span className="text-slate-950 font-semibold">{courseName} - {branchName}</span>
            </div>
            <div>
              <span className="font-bold text-slate-700">Year / Semester: </span>
              <span className="text-slate-950 font-semibold">Year {year} - Semester {semester}</span>
            </div>
            <div>
              <span className="font-bold text-slate-700">Section: </span>
              <span className="text-slate-950 font-semibold">{section || "All Sections"}</span>
            </div>
            <div>
              <span className="font-bold text-slate-700">Academic Year: </span>
              <span className="text-slate-950 font-semibold">{academicYear}</span>
            </div>
            <div>
              <span className="font-bold text-slate-700">Total Enrolled: </span>
              <span className="text-slate-950 font-bold">{filteredStudents.length} Students</span>
            </div>
            <div>
              <span className="font-bold text-slate-700">Class Average: </span>
              <span className="text-slate-950 font-bold">{stats.avgPct}%</span>
            </div>
            <div>
              <span className="font-bold text-slate-700">Eligible (≥{thresholds.eligibleThreshold}%): </span>
              <span className="text-emerald-800 font-bold">{stats.eligibleCount}</span>
            </div>
            <div>
              <span className="font-bold text-slate-700">Condonation / Detained: </span>
              <span className="text-amber-800 font-bold">{stats.condonationCount}</span> / <span className="text-rose-800 font-bold">{stats.detainedCount}</span>
            </div>
          </div>
        </div>

        {/* Attendance Register Matrix Table */}
        {loading ? (
          <div className="p-8">
            <TableSkeleton rows={8} />
          </div>
        ) : (
          <div
            className={`overflow-x-auto transition-all ${
              fixedHeight ? "max-h-[calc(100vh-270px)] overflow-y-auto" : ""
            } print:overflow-visible print:max-h-none print:h-auto print:w-full print:max-w-none`}
          >
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                @page {
                  size: A4 landscape !important;
                  margin: 4mm 4mm 4mm 4mm !important;
                }
                body, html {
                  width: 100% !important;
                  overflow: visible !important;
                  background: #ffffff !important;
                  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                .attendance-register-print-table {
                  width: 100% !important;
                  max-width: 100% !important;
                  table-layout: fixed !important;
                  border-collapse: collapse !important;
                  border: 0.75pt solid #334155 !important;
                  font-size: 7.5pt !important;
                }
                .attendance-register-print-table th,
                .attendance-register-print-table td {
                  min-width: 0 !important;
                  max-width: none !important;
                  box-sizing: border-box !important;
                  border: 0.5pt solid #64748b !important;
                  padding: 2px 1px !important;
                  line-height: 1.15 !important;
                  word-wrap: break-word !important;
                  overflow-wrap: break-word !important;
                }
                .print-sno {
                  width: 22px !important;
                  min-width: 22px !important;
                  max-width: 22px !important;
                  text-align: center !important;
                  padding-left: 0 !important;
                  padding-right: 0 !important;
                }
                .print-student {
                  width: 115px !important;
                  min-width: 115px !important;
                  max-width: 115px !important;
                  text-align: left !important;
                  padding-left: 3px !important;
                  padding-right: 2px !important;
                }
                .print-overall-held {
                  width: 22px !important;
                  min-width: 22px !important;
                  max-width: 22px !important;
                }
                .print-overall-att {
                  width: 22px !important;
                  min-width: 22px !important;
                  max-width: 22px !important;
                }
                .print-overall-pct {
                  width: 24px !important;
                  min-width: 24px !important;
                  max-width: 24px !important;
                }
                .print-status {
                  width: 48px !important;
                  min-width: 48px !important;
                  max-width: 48px !important;
                  box-sizing: border-box !important;
                  text-align: center !important;
                  padding-left: 1px !important;
                  padding-right: 1px !important;
                }
                /* Strictly hide floating widgets (Nemo AI, Portal Switcher) in print */
                #nemo-ai-chat-root,
                #pydah-ai-chat-root,
                .nemo-ai-root,
                [id*="nemo"],
                [class*="nemo"],
                #pydah-portal-switcher,
                #portal-switcher,
                .pydah-switcher,
                [id*="switcher"],
                [class*="switcher"] {
                  display: none !important;
                  visibility: hidden !important;
                  opacity: 0 !important;
                  pointer-events: none !important;
                }
                .attendance-register-print-table tr {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
                .attendance-register-print-table thead {
                  display: table-header-group !important;
                }
                .attendance-register-print-table tfoot {
                  display: table-footer-group !important;
                }
              }
            ` }} />
            <table className="w-full border-collapse text-left text-xs attendance-register-print-table print:text-[7.5px] print:w-full print:border print:border-slate-500">
              <colgroup className="hidden print:table-column-group">
                <col style={{ width: "22px" }} />
                <col style={{ width: "115px" }} />
                {subjects.map((sub) => (
                  <Fragment key={`col-grp-${sub.subjectId}`}>
                    <col style={{ width: `calc((100% - 253px) / ${Math.max(1, subjects.length) * 3})` }} />
                    <col style={{ width: `calc((100% - 253px) / ${Math.max(1, subjects.length) * 3})` }} />
                    <col style={{ width: `calc((100% - 253px) / ${Math.max(1, subjects.length) * 3})` }} />
                  </Fragment>
                ))}
                <col style={{ width: "22px" }} />
                <col style={{ width: "22px" }} />
                <col style={{ width: "24px" }} />
                <col style={{ width: "48px" }} />
              </colgroup>
              <thead>
                {/* TIER 1 HEADER */}
                <tr className="border-b border-slate-200 bg-slate-100 font-semibold text-slate-700 sticky top-0 z-30 print:static print:bg-slate-200 print:text-black">
                  <th
                    rowSpan={2}
                    className={`sticky top-0 left-0 z-40 border-r border-slate-200 bg-slate-100 px-1 py-2 text-center text-[11px] uppercase tracking-wider text-slate-500 print:static print:border-slate-500 print:text-[7.5px] print:text-black print:font-bold print:bg-slate-200 print-sno ${
                      fitAll ? "w-8 min-w-[32px]" : "w-10 min-w-[40px] print:min-w-0"
                    }`}
                  >
                    S.No
                  </th>
                  <th
                    rowSpan={2}
                    className={`sticky top-0 z-40 border-r border-slate-300 bg-slate-100 px-2 py-1.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-900 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] print:static print:shadow-none print:border-slate-500 print:text-[8px] print:bg-slate-200 print:text-black print-student ${
                      fitAll ? "left-8 w-[170px] min-w-[170px]" : "left-10 min-w-[220px] print:min-w-0"
                    }`}
                  >
                    <div className="flex flex-col justify-center leading-tight">
                      <span>Student Name</span>
                      <span className="text-[9.5px] font-normal text-slate-500 normal-case print:text-[7px] print:text-slate-800 print:font-semibold">
                        PIN Number
                      </span>
                    </div>
                  </th>

                  {/* SUBJECT COLUMN HEADERS */}
                  {subjects.map((sub) => (
                    <th
                      key={sub.subjectId}
                      colSpan={3}
                      className={`border-r border-slate-300 bg-blue-50/70 px-1 py-1.5 text-center text-xs font-bold text-blue-950 print:border-slate-500 print:bg-slate-100 print:p-0.5 print:min-w-0 ${
                        fitAll ? "w-[102px] min-w-[102px] max-w-[102px]" : "min-w-[170px] print:min-w-0"
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center leading-tight">
                        <span className="font-mono text-[10px] font-bold text-blue-700 block truncate max-w-full print:font-sans print:text-[7.5px] print:font-extrabold print:text-black print:leading-none">
                          {sub.code}
                        </span>
                        <span
                          className={`truncate font-bold text-slate-800 block print:text-[6.5px] print:font-semibold print:text-slate-900 print:whitespace-normal print:break-words print:leading-tight print:max-w-none ${
                            fitAll ? "text-[9px] max-w-[98px]" : "text-[10px] max-w-[165px]"
                          }`}
                          title={sub.name}
                        >
                          {sub.name}
                        </span>
                      </div>
                    </th>
                  ))}

                  {/* OVERALL TOTAL COLUMN HEADER */}
                  <th
                    colSpan={3}
                    className={`border-r border-slate-300 bg-emerald-50/80 px-1 py-1.5 text-center text-xs font-bold text-emerald-950 print:border-slate-500 print:bg-slate-100 print:p-0.5 print:min-w-0 ${
                      fitAll ? "w-[106px] min-w-[106px]" : "min-w-[140px] print:min-w-0"
                    }`}
                  >
                    <div className="flex flex-col items-center leading-tight">
                      <span className="text-[10px] font-bold uppercase tracking-wider block print:text-[7.5px] print:font-extrabold print:text-black">Overall</span>
                      <span className="text-[9px] font-normal text-emerald-700 block print:text-[6.5px] print:font-semibold print:text-slate-700">Aggregate</span>
                    </div>
                  </th>

                  {/* ELIGIBILITY STATUS */}
                  <th
                    rowSpan={2}
                    className={`bg-slate-100 px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-700 print:border-slate-500 print:bg-slate-200 print:p-0.5 print:text-[7.5px] print:text-black print-status ${
                      fitAll ? "w-[62px] min-w-[62px]" : "min-w-[85px] print:min-w-0"
                    }`}
                  >
                    Status
                  </th>
                </tr>

                {/* TIER 2 HEADER */}
                <tr className="border-b border-slate-300 bg-slate-50 text-[10px] font-semibold text-slate-600 sticky top-[43px] z-30 print:static print:bg-slate-50 print:text-[7.5px]">
                  {subjects.map((sub) => (
                    <Fragment key={`sub-sub-${sub.subjectId}`}>
                      <th
                        className={`border-r border-slate-200 bg-blue-50/40 py-1 text-center font-semibold text-slate-700 print:border-slate-500 print:p-0.5 print:text-[7px] print:font-bold print:text-black print:min-w-0 ${
                          fitAll ? "w-[34px] min-w-[34px] px-0 text-[10px]" : "w-16 px-1 print:w-auto"
                        }`}
                      >
                        Held
                      </th>
                      <th
                        className={`border-r border-slate-200 bg-blue-50/40 py-1 text-center font-semibold text-slate-700 print:border-slate-500 print:p-0.5 print:text-[7px] print:font-bold print:text-black print:min-w-0 ${
                          fitAll ? "w-[34px] min-w-[34px] px-0 text-[10px]" : "w-16 px-1 print:w-auto"
                        }`}
                      >
                        Att
                      </th>
                      <th
                        className={`border-r border-slate-300 bg-blue-100/60 py-1 text-center font-bold text-blue-900 print:border-slate-500 print:p-0.5 print:text-[7px] print:font-extrabold print:text-black print:min-w-0 ${
                          fitAll ? "w-[34px] min-w-[34px] px-0 text-[10px]" : "w-14 px-1 print:w-auto"
                        }`}
                      >
                        %
                      </th>
                    </Fragment>
                  ))}

                  {/* OVERALL SUBCOLUMNS */}
                  <th
                    className={`border-r border-slate-200 bg-emerald-50/40 py-1 text-center font-semibold text-slate-700 print:border-slate-500 print:p-0.5 print:text-[7px] print:font-bold print:text-black print-overall-held ${
                      fitAll ? "w-[34px] min-w-[34px] px-0 text-[10px]" : "w-16 px-1 print:min-w-0"
                    }`}
                  >
                    Held
                  </th>
                  <th
                    className={`border-r border-slate-200 bg-emerald-50/40 py-1 text-center font-semibold text-slate-700 print:border-slate-500 print:p-0.5 print:text-[7px] print:font-bold print:text-black print-overall-att ${
                      fitAll ? "w-[34px] min-w-[34px] px-0 text-[10px]" : "w-16 px-1 print:min-w-0"
                    }`}
                  >
                    Att
                  </th>
                  <th
                    className={`border-r border-slate-300 bg-emerald-100/70 py-1 text-center font-bold text-emerald-950 print:border-slate-500 print:p-0.5 print:text-[7px] print:font-extrabold print:text-black print-overall-pct ${
                      fitAll ? "w-[38px] min-w-[38px] px-0 text-[10px]" : "w-18 px-1 print:min-w-0"
                    }`}
                  >
                    %
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td
                      colSpan={subjects.length * 3 + 6}
                      className="py-16 text-center text-slate-500"
                    >
                      <AlertTriangle className="mx-auto h-8 w-8 text-amber-500 mb-2" />
                      <p className="text-sm font-semibold text-slate-800">No students found matching current filters</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {!collegeId || !branchId
                          ? "Please select College and Branch from the filters above to load the student attendance register."
                          : "Verify year, semester, section, or batch filters."}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student, idx) => {
                    let totalHeld = 0;
                    let totalPresent = 0;

                    return (
                      <tr
                        key={student.studentDbId}
                        className="transition-colors hover:bg-slate-50/90 group"
                      >
                        {/* S.No */}
                        <td
                          className={`sticky left-0 z-10 border-r border-slate-200 bg-white px-1 py-1 text-center text-[11px] text-slate-500 group-hover:bg-slate-50 print:static print:border-slate-500 print:text-[7.5px] print:font-semibold print:text-black print-sno ${
                            fitAll ? "w-8 min-w-[32px]" : "w-10 min-w-[40px] print:min-w-0"
                          }`}
                        >
                          {idx + 1}
                        </td>

                        {/* Merged Student: Name Above, PIN Number Below */}
                        <td
                          className={`sticky z-10 border-r border-slate-300 bg-white px-2 py-1 text-left shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] group-hover:bg-slate-50 print:static print:shadow-none print:border-slate-500 print-student ${
                            fitAll ? "left-8 w-[170px] min-w-[170px]" : "left-10 min-w-[220px] print:min-w-0"
                          }`}
                        >
                          <div className="flex flex-col justify-center leading-tight">
                            <span
                              className={`font-semibold text-slate-900 truncate block print:text-[7.5px] print:font-bold print:text-black print:whitespace-normal print:leading-tight print:max-w-none ${
                                fitAll ? "text-[11px] max-w-[155px]" : "text-xs max-w-[205px]"
                              }`}
                              title={student.studentName}
                            >
                              {student.studentName}
                            </span>
                            <span className="font-mono text-[10px] text-slate-500 font-medium block print:font-mono print:text-[7px] print:font-bold print:text-slate-900 print:leading-none mt-0.5">
                              {student.pinNo}
                            </span>
                          </div>
                        </td>

                        {/* Subject Cells */}
                        {subjects.map((sub) => {
                          const key: EntryKey = `${student.studentDbId}_${sub.subjectId}`;
                          const record = entries.get(key) || { classesHeld: 0, classesPresent: 0 };
                          const held = record.classesHeld;
                          const present = record.classesPresent;
                          const pct = held > 0 ? (present / held) * 100 : 0;

                          totalHeld += held;
                          totalPresent += present;

                          const pctColor =
                            held === 0
                              ? "text-slate-400"
                              : pct >= thresholds.eligibleThreshold
                              ? "text-emerald-700 bg-emerald-50/70 font-extrabold"
                              : pct >= thresholds.condonationMinThreshold
                              ? "text-amber-700 bg-amber-50/70 font-bold"
                              : "text-rose-700 bg-rose-50/70 font-bold";

                          return (
                            <Fragment key={`cell-${student.studentDbId}-${sub.subjectId}`}>
                              {/* Classes Held Input */}
                              <td
                                className={`border-r border-slate-200 text-center ${
                                  fitAll ? "w-[34px] p-0.5" : "p-1"
                                } print:p-0.5 print:border-slate-500 print:min-w-0`}
                              >
                                <span className="hidden print:inline font-sans text-[7.5px] font-bold text-black">
                                  {held}
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  max={999}
                                  value={held === 0 ? "" : held}
                                  placeholder="0"
                                  onChange={(e) =>
                                    handleCellChange(
                                      student.studentDbId,
                                      sub.subjectId,
                                      "classesHeld",
                                      parseInt(e.target.value, 10) || 0,
                                    )
                                  }
                                  className={`print:hidden rounded border border-slate-300 bg-white text-center font-mono font-semibold text-slate-800 shadow-2xs transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-hidden ${
                                    fitAll ? "w-[30px] h-6 px-0 text-[11px]" : "w-14 px-1 py-1 text-xs"
                                  }`}
                                />
                              </td>

                              {/* Classes Present Input */}
                              <td
                                className={`border-r border-slate-200 text-center ${
                                  fitAll ? "w-[34px] p-0.5" : "p-1"
                                } print:p-0.5 print:border-slate-500 print:min-w-0`}
                              >
                                <span className="hidden print:inline font-sans text-[7.5px] font-bold text-black">
                                  {present}
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  max={held || 999}
                                  value={present === 0 ? "" : present}
                                  placeholder="0"
                                  onChange={(e) =>
                                    handleCellChange(
                                      student.studentDbId,
                                      sub.subjectId,
                                      "classesPresent",
                                      parseInt(e.target.value, 10) || 0,
                                    )
                                  }
                                  className={`print:hidden rounded border text-center font-mono font-bold shadow-2xs transition focus:outline-hidden ${
                                    fitAll ? "w-[30px] h-6 px-0 text-[11px]" : "w-14 px-1 py-1 text-xs"
                                  } ${
                                    held > 0 && present > held
                                      ? "border-amber-400 bg-amber-50 text-amber-800"
                                      : "border-slate-300 bg-white text-slate-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                                  }`}
                                />
                              </td>

                              {/* Subject % */}
                              <td
                                className={`border-r border-slate-300 text-center font-mono ${pctColor} ${
                                  fitAll ? "w-[34px] px-0 py-1 text-[10px]" : "w-14 px-1 py-1 text-[11px]"
                                } print:p-0.5 print:border-slate-500 print:font-sans print:text-[7.5px] print:font-bold print:text-black print:bg-transparent print:min-w-0`}
                              >
                                {held > 0 ? `${pct.toFixed(0)}%` : "—"}
                              </td>
                            </Fragment>
                          );
                        })}

                        {/* Total Classes Held */}
                        <td
                          className={`border-r border-slate-200 bg-emerald-50/20 text-center font-mono font-semibold text-slate-800 print:p-0.5 print:border-slate-500 print:font-sans print:text-[7.5px] print:font-bold print:text-black print:bg-transparent print-overall-held ${
                            fitAll ? "w-[34px] px-0 py-1 text-[11px]" : "w-14 px-1 text-xs print:min-w-0"
                          }`}
                        >
                          {totalHeld}
                        </td>

                        {/* Total Classes Present */}
                        <td
                          className={`border-r border-slate-200 bg-emerald-50/20 text-center font-mono font-bold text-slate-900 print:p-0.5 print:border-slate-500 print:font-sans print:text-[7.5px] print:font-bold print:text-black print:bg-transparent print-overall-att ${
                            fitAll ? "w-[34px] px-0 py-1 text-[11px]" : "w-14 px-1 text-xs print:min-w-0"
                          }`}
                        >
                          {totalPresent}
                        </td>

                        {/* Overall Percentage */}
                        {(() => {
                          const overallPct = totalHeld > 0 ? (totalPresent / totalHeld) * 100 : 0;
                          const isEligible = overallPct >= thresholds.eligibleThreshold;
                          const isCondonation =
                            overallPct >= thresholds.condonationMinThreshold &&
                            overallPct < thresholds.eligibleThreshold;

                          const badgeColor =
                            totalHeld === 0
                              ? "bg-slate-100 text-slate-500"
                              : isEligible
                              ? "bg-emerald-100 text-emerald-800"
                              : isCondonation
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800";

                          const statusText =
                            totalHeld === 0
                              ? "—"
                              : isEligible
                              ? "Eligible"
                              : isCondonation
                              ? "Condon."
                              : "Detained";

                          return (
                            <>
                              <td
                                className={`border-r border-slate-300 bg-emerald-100/30 text-center print:p-0.5 print:border-slate-500 print:font-sans print:text-[8px] print:font-extrabold print:text-black print:bg-transparent print-overall-pct ${
                                  fitAll ? "w-[38px] px-0 py-1 text-[11px]" : "w-18 px-1 text-xs print:min-w-0"
                                }`}
                              >
                                <span
                                  className={`inline-block font-mono font-extrabold print:font-sans print:text-[8px] print:text-black ${
                                    fitAll ? "text-[11px]" : "text-xs"
                                  } ${
                                    totalHeld === 0
                                      ? "text-slate-400"
                                      : isEligible
                                      ? "text-emerald-700"
                                      : isCondonation
                                      ? "text-amber-700"
                                      : "text-rose-700"
                                  }`}
                                >
                                  {totalHeld > 0 ? `${overallPct.toFixed(0)}%` : "—"}
                                </span>
                              </td>

                              {/* Eligibility Badge */}
                              <td className={`px-0.5 py-1 text-center print:p-0.5 print:border-slate-500 print-status ${fitAll ? "w-[62px]" : "print:min-w-0"}`}>
                                <span
                                  className={`inline-flex items-center justify-center gap-0.5 rounded px-1 py-0.5 font-bold uppercase tracking-wider print:border print:border-slate-900 print:bg-white print:text-[5.5px] print:tracking-tight print:font-black print:text-black print:px-1 print:py-0.5 print:w-full print:box-border ${
                                    fitAll ? "text-[8.5px] w-full" : "text-[9px] px-1.5"
                                  } ${badgeColor}`}
                                >
                                  {isEligible && <CheckCircle2 className="h-2 w-2 shrink-0 print:hidden" />}
                                  {isCondonation && <AlertTriangle className="h-2 w-2 shrink-0 print:hidden" />}
                                  {!isEligible && !isCondonation && totalHeld > 0 && (
                                    <XCircle className="h-2 w-2 shrink-0 print:hidden" />
                                  )}
                                  {statusText}
                                </span>
                              </td>
                            </>
                          );
                        })()}
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* TABLE SUMMARY / CLASS AVERAGE FOOTER */}
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold text-slate-900 sticky bottom-0 z-30 shadow-[0_-2px_4px_-2px_rgba(0,0,0,0.1)] print:static print:shadow-none">
                  <td
                    colSpan={2}
                    className={`sticky bottom-0 left-0 z-40 border-r border-slate-300 bg-slate-100 px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wider text-slate-900 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] print:static print:shadow-none print:border-slate-500 print:text-[7.5px] print:font-bold print:text-black print:bg-slate-200 ${
                      fitAll ? "w-[202px] min-w-[202px]" : "w-[260px] min-w-[260px] print:min-w-0"
                    }`}
                  >
                    Class Average ({filteredStudents.length})
                  </td>

                  {/* Per Subject Averages */}
                  {subjects.map((sub) => {
                    let subHeldSum = 0;
                    let subPresentSum = 0;

                    for (const student of filteredStudents) {
                      const key: EntryKey = `${student.studentDbId}_${sub.subjectId}`;
                      const d = entries.get(key);
                      if (d) {
                        subHeldSum += d.classesHeld;
                        subPresentSum += d.classesPresent;
                      }
                    }

                    const avgHeld = filteredStudents.length > 0 ? (subHeldSum / filteredStudents.length).toFixed(0) : "0";
                    const avgPresent = filteredStudents.length > 0 ? (subPresentSum / filteredStudents.length).toFixed(0) : "0";
                    const avgSubPct = subHeldSum > 0 ? ((subPresentSum / subHeldSum) * 100).toFixed(0) : "0";

                    return (
                      <Fragment key={`foot-${sub.subjectId}`}>
                        <td
                          className={`border-r border-slate-200 text-center font-mono print:font-sans print:border-slate-500 print:p-0.5 print:text-[7.5px] print:font-bold print:text-black print:min-w-0 ${
                            fitAll ? "w-[34px] px-0 py-1 text-[11px]" : "px-1 py-2 text-xs print:w-auto"
                          }`}
                        >
                          {avgHeld}
                        </td>
                        <td
                          className={`border-r border-slate-200 text-center font-mono print:font-sans print:border-slate-500 print:p-0.5 print:text-[7.5px] print:font-bold print:text-black print:min-w-0 ${
                            fitAll ? "w-[34px] px-0 py-1 text-[11px]" : "px-1 py-2 text-xs print:w-auto"
                          }`}
                        >
                          {avgPresent}
                        </td>
                        <td
                          className={`border-r border-slate-300 text-center font-mono font-extrabold text-blue-900 print:font-sans print:border-slate-500 print:p-0.5 print:text-[7.5px] print:font-extrabold print:text-black print:min-w-0 ${
                            fitAll ? "w-[34px] px-0 py-1 text-[10px]" : "px-1 py-2 text-xs print:w-auto"
                          }`}
                        >
                          {avgSubPct}%
                        </td>
                      </Fragment>
                    );
                  })}

                  {/* Overall Footer Averages */}
                  {(() => {
                    let totalHeldAll = 0;
                    let totalPresentAll = 0;

                    for (const student of filteredStudents) {
                      for (const sub of subjects) {
                        const key: EntryKey = `${student.studentDbId}_${sub.subjectId}`;
                        const d = entries.get(key);
                        if (d) {
                          totalHeldAll += d.classesHeld;
                          totalPresentAll += d.classesPresent;
                        }
                      }
                    }

                    const count = filteredStudents.length;
                    const avgHeld = count > 0 ? (totalHeldAll / count).toFixed(0) : "0";
                    const avgPresent = count > 0 ? (totalPresentAll / count).toFixed(0) : "0";
                    const avgPct = totalHeldAll > 0 ? ((totalPresentAll / totalHeldAll) * 100).toFixed(0) : "0";

                    return (
                      <>
                        <td
                          className={`border-r border-slate-200 bg-emerald-50/50 text-center font-mono font-bold text-slate-800 print:font-sans print:border-slate-500 print:p-0.5 print:text-[7.5px] print:font-bold print:text-black print:bg-slate-100 print-overall-held ${
                            fitAll ? "w-[34px] px-0 py-1 text-[11px]" : "px-1 py-2 text-xs print:min-w-0"
                          }`}
                        >
                          {avgHeld}
                        </td>
                        <td
                          className={`border-r border-slate-200 bg-emerald-50/50 text-center font-mono font-bold text-slate-800 print:font-sans print:border-slate-500 print:p-0.5 print:text-[7.5px] print:font-bold print:text-black print:bg-slate-100 print-overall-att ${
                            fitAll ? "w-[34px] px-0 py-1 text-[11px]" : "px-1 py-2 text-xs print:min-w-0"
                          }`}
                        >
                          {avgPresent}
                        </td>
                        <td
                          className={`border-r border-slate-300 bg-emerald-100/60 text-center font-mono font-extrabold text-emerald-950 print:font-sans print:border-slate-500 print:p-0.5 print:text-[7.5px] print:font-black print:text-black print:bg-slate-100 print-overall-pct ${
                            fitAll ? "w-[38px] px-0 py-1 text-[11px]" : "px-1 py-2 text-xs print:min-w-0"
                          }`}
                        >
                          {avgPct}%
                        </td>
                        <td
                          className={`text-center font-bold text-emerald-800 print:border-slate-500 print:p-0.5 print:text-[6.5px] print:font-black print:text-black print:bg-slate-100 print-status ${
                            fitAll ? "w-[62px] px-0 py-1 text-[9px]" : "px-1.5 py-2 text-[10px] print:min-w-0"
                          }`}
                        >
                          {stats.eligibleCount}/{count} Pass
                        </td>
                      </>
                    );
                  })()}
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Institutional Signatures Block (Visible in Print / PDF Only) */}
        <div className="hidden print:block mt-8 pt-4 border-t border-slate-400 break-inside-avoid">
          <div className="grid grid-cols-3 gap-8 text-center">
            <div className="pt-10 border-t border-slate-600">
              <p className="font-bold text-[10px] text-slate-950 uppercase tracking-wide">Class Teacher</p>
              <p className="text-[8.5px] text-slate-500 mt-0.5">Signature &amp; Date</p>
            </div>
            <div className="pt-10 border-t border-slate-600">
              <p className="font-bold text-[10px] text-slate-950 uppercase tracking-wide">Head of Department (HOD)</p>
              <p className="text-[8.5px] text-slate-500 mt-0.5">Signature &amp; Date</p>
            </div>
            <div className="pt-10 border-t border-slate-600">
              <p className="font-bold text-[10px] text-slate-950 uppercase tracking-wide">Principal / Vice Principal</p>
              <p className="text-[8.5px] text-slate-500 mt-0.5">College Seal &amp; Signature</p>
            </div>
          </div>
          <div className="mt-4 flex justify-between items-center text-[8px] text-slate-500 border-t border-slate-200 pt-1">
            <span>Generated from Antigravity Academic Portal — Consolidated Subject Attendance System</span>
            <span>Document ID: ATT-{academicYear}-{branchName.replace(/\s+/g, '').slice(0, 4)}-Y{year}S{semester}-{section || "ALL"}</span>
          </div>
        </div>
      </Card>

      {/* Bulk Classes Held Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Calculator className="h-5 w-5 text-brand-600" />
              Set Classes Held for Subject(s)
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Apply a total number of classes held to all students for a selected subject or all semester subjects.
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Select Target Subject</label>
                <select
                  value={bulkHeldSubjectId}
                  onChange={(e) =>
                    setBulkHeldSubjectId(e.target.value === "all" ? "all" : Number(e.target.value))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 shadow-xs focus:border-brand-500 focus:outline-hidden"
                >
                  <option value="all">All Semester Subjects ({subjects.length})</option>
                  {subjects.map((s) => (
                    <option key={s.subjectId} value={s.subjectId}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Total Classes Held</label>
                <input
                  type="number"
                  min={1}
                  max={250}
                  value={bulkHeldValue}
                  onChange={(e) => setBulkHeldValue(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm font-semibold text-slate-900 shadow-xs focus:border-brand-500 focus:outline-hidden"
                  placeholder="e.g. 40"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  This will set Classes Held for all {students.length} students at once.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowBulkModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleApplyBulkHeld}>
                Apply to All Students
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
