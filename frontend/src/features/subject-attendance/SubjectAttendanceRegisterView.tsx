"use client";

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
  Maximize2,
  Minimize2,
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
  const { filters } = useAcademicContext();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [entries, setEntries] = useState<Map<EntryKey, StudentAttendanceRecord>>(new Map());
  const [dirty, setDirty] = useState(false);

  // View layout controls
  const [fitAll, setFitAll] = useState(true);
  const [fixedHeight, setFixedHeight] = useState(true);


  // Search and threshold filters
  const [searchQuery, setSearchQuery] = useState("");
  const [thresholdFilter, setThresholdFilter] = useState<"all" | "eligible" | "condonation" | "detained">("all");

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
      };

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

  // Export to CSV
  const handleExportCsv = () => {
    if (students.length === 0 || subjects.length === 0) return;

    const headers: string[] = ["S.No", "PIN Number", "Student Name", "Section"];

    for (const sub of subjects) {
      headers.push(`${sub.code} Held`, `${sub.code} Present`, `${sub.code} %`);
    }

    headers.push("Total Held", "Total Present", "Overall %", "Eligibility Status");

    const rows: string[][] = [];

    students.forEach((student, idx) => {
      let totalHeld = 0;
      let totalPresent = 0;

      const row: string[] = [
        String(idx + 1),
        `"${student.pinNo}"`,
        `"${student.studentName.replace(/"/g, '""')}"`,
        `"${student.sectionName || ""}"`,
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
        parseFloat(overallPct) >= 75
          ? "Eligible"
          : parseFloat(overallPct) >= 65
          ? "Condonation"
          : "Detained";

      row.push(String(totalHeld), String(totalPresent), `${overallPct}%`, status);
      rows.push(row);
    });

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Subject_Attendance_Register_${academicYear}_Sem${semester}.csv`,
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

        if (thresholdFilter === "eligible" && pct < 75) return false;
        if (thresholdFilter === "condonation" && (pct < 65 || pct >= 75)) return false;
        if (thresholdFilter === "detained" && pct >= 65) return false;
      }

      return true;
    });
  }, [students, searchQuery, thresholdFilter, subjects, entries]);

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
      if (pct >= 75) eligibleCount++;
      else if (pct >= 65) condonationCount++;
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
  }, [students, subjects, entries]);

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
    <div className="space-y-6 pb-20">
      {/* Header */}
      <PageHeader
        title="Subject-Wise Attendance Register"
        description="Enter classes held and classes present. The system automatically calculates subject percentages and the overall aggregate percentage."
      />

      {/* Filter Bar */}
      <div className="space-y-3">
        <AcademicFilterBar title="Academic Scope Filters" />
      </div>

      {/* Alerts */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 flex items-center justify-between">
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
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {/* Key Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
                parseFloat(stats.avgPct) >= 75
                  ? "text-emerald-600"
                  : parseFloat(stats.avgPct) >= 65
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
          <div className="text-[11px] font-medium text-emerald-700 uppercase tracking-wider">Eligible (≥75%)</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-emerald-700">{stats.eligibleCount}</span>
            <span className="text-[11px] text-emerald-600">students</span>
          </div>
        </Card>

        <Card className="p-3.5 border-amber-200 bg-amber-50/30">
          <div className="text-[11px] font-medium text-amber-700 uppercase tracking-wider">Condonation (65-74%)</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-amber-700">{stats.condonationCount}</span>
            <span className="text-[11px] text-amber-600">students</span>
          </div>
        </Card>

        <Card className="p-3.5 border-rose-200 bg-rose-50/30">
          <div className="text-[11px] font-medium text-rose-700 uppercase tracking-wider">Detained (&lt;65%)</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-rose-700">{stats.detainedCount}</span>
            <span className="text-[11px] text-rose-600">at risk</span>
          </div>
        </Card>
      </div>

      {/* Main Register Table Card */}
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        {/* Table Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search PIN or Student..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-brand-500 focus:outline-hidden"
              />
            </div>

            {/* Threshold Filter */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setThresholdFilter("all")}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  thresholdFilter === "all" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All ({students.length})
              </button>
              <button
                type="button"
                onClick={() => setThresholdFilter("eligible")}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  thresholdFilter === "eligible"
                    ? "bg-emerald-600 text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                ≥75% ({stats.eligibleCount})
              </button>
              <button
                type="button"
                onClick={() => setThresholdFilter("condonation")}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  thresholdFilter === "condonation"
                    ? "bg-amber-600 text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                65-74% ({stats.condonationCount})
              </button>
              <button
                type="button"
                onClick={() => setThresholdFilter("detained")}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  thresholdFilter === "detained" ? "bg-rose-600 text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                &lt;65% ({stats.detainedCount})
              </button>
            </div>

            {/* Inline Export & Print Buttons */}
            <div className="flex items-center gap-1.5 pl-1 border-l border-slate-200">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExportCsv}
                className="gap-1.5 text-xs shadow-2xs h-8 px-2.5"
                title="Export to Excel / CSV"
              >
                <Download className="h-3.5 w-3.5 text-slate-600" />
                <span>Export Excel / CSV</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.print()}
                className="gap-1.5 text-xs shadow-2xs h-8 px-2.5"
                title="Print register"
              >
                <Printer className="h-3.5 w-3.5 text-slate-600" />
                <span>Print</span>
              </Button>
            </div>
          </div>

          {/* Quick Action Tools */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View Layout Controls */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setFitAll(true)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  fitAll
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Fit all subjects on screen with compact columns"
              >
                Fit All Subjects
              </button>
              <button
                type="button"
                onClick={() => setFitAll(false)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  !fitAll
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Spacious column layout"
              >
                Spacious
              </button>
            </div>

            {/* In-Window / Full Page Scroll Toggle */}
            <button
              type="button"
              onClick={() => setFixedHeight((prev) => !prev)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 transition shadow-2xs"
              title={fixedHeight ? "Expand table to full page scroll" : "Keep headers fixed with in-window scroll"}
            >
              {fixedHeight ? (
                <>
                  <Minimize2 className="h-3 w-3 text-slate-500" />
                  <span>Freeze Header</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-3 w-3 text-slate-500" />
                  <span>Full Page</span>
                </>
              )}
            </button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowBulkModal(true)}
              className="gap-1.5 text-xs text-slate-700 h-8"
            >
              <Sparkles className="h-3.5 w-3.5 text-brand-600" />
              Set Classes Held
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleMarkAllFullPresent}
              className="gap-1.5 text-xs text-slate-700 h-8"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Quick 100% Present
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="gap-1.5 text-xs font-semibold shadow-xs h-8 px-3"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Saving..." : dirty ? "Save Register *" : "Save Register"}
            </Button>

            {dirty && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-200">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                Unsaved edits
              </span>
            )}
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
            }`}
          >
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                {/* TIER 1 HEADER */}
                <tr className="border-b border-slate-200 bg-slate-100 font-semibold text-slate-700 sticky top-0 z-30">
                  <th
                    rowSpan={2}
                    className={`sticky top-0 left-0 z-40 border-r border-slate-200 bg-slate-100 px-1 py-2 text-center text-[11px] uppercase tracking-wider text-slate-500 ${
                      fitAll ? "w-8 min-w-[32px]" : "w-10 min-w-[40px]"
                    }`}
                  >
                    S.No
                  </th>
                  <th
                    rowSpan={2}
                    className={`sticky top-0 z-40 border-r border-slate-300 bg-slate-100 px-2 py-1.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-900 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] ${
                      fitAll ? "left-8 w-[170px] min-w-[170px]" : "left-10 min-w-[220px]"
                    }`}
                  >
                    <div className="flex flex-col justify-center leading-tight">
                      <span>Student Name</span>
                      <span className="text-[9.5px] font-normal text-slate-500 normal-case">PIN Number</span>
                    </div>
                  </th>

                  {/* SUBJECT COLUMN HEADERS */}
                  {subjects.map((sub) => (
                    <th
                      key={sub.subjectId}
                      colSpan={3}
                      className={`border-r border-slate-300 bg-blue-50/70 px-1 py-1.5 text-center text-xs font-bold text-blue-950 ${
                        fitAll ? "w-[102px] min-w-[102px] max-w-[102px]" : "min-w-[170px]"
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center">
                        <span className="font-mono text-[10px] font-bold text-blue-700 block truncate max-w-full">
                          {sub.code}
                        </span>
                        <span
                          className={`truncate font-bold text-slate-800 block ${
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
                    className={`border-r border-slate-300 bg-emerald-50/80 px-1 py-1.5 text-center text-xs font-bold text-emerald-950 ${
                      fitAll ? "w-[106px] min-w-[106px]" : "min-w-[140px]"
                    }`}
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider block">Overall</span>
                      <span className="text-[9px] font-normal text-emerald-700 block">Aggregate</span>
                    </div>
                  </th>

                  {/* ELIGIBILITY STATUS */}
                  <th
                    rowSpan={2}
                    className={`bg-slate-100 px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-700 ${
                      fitAll ? "w-[62px] min-w-[62px]" : "min-w-[85px]"
                    }`}
                  >
                    Status
                  </th>
                </tr>

                {/* TIER 2 HEADER */}
                <tr className="border-b border-slate-300 bg-slate-50 text-[10px] font-semibold text-slate-600 sticky top-[43px] z-30">
                  {subjects.map((sub) => (
                    <Fragment key={`sub-sub-${sub.subjectId}`}>
                      <th
                        className={`border-r border-slate-200 bg-blue-50/40 py-1 text-center font-semibold text-slate-700 ${
                          fitAll ? "w-[34px] min-w-[34px] px-0 text-[10px]" : "w-16 px-1"
                        }`}
                      >
                        Held
                      </th>
                      <th
                        className={`border-r border-slate-200 bg-blue-50/40 py-1 text-center font-semibold text-slate-700 ${
                          fitAll ? "w-[34px] min-w-[34px] px-0 text-[10px]" : "w-16 px-1"
                        }`}
                      >
                        Att
                      </th>
                      <th
                        className={`border-r border-slate-300 bg-blue-100/60 py-1 text-center font-bold text-blue-900 ${
                          fitAll ? "w-[34px] min-w-[34px] px-0 text-[10px]" : "w-14 px-1"
                        }`}
                      >
                        %
                      </th>
                    </Fragment>
                  ))}

                  {/* OVERALL SUBCOLUMNS */}
                  <th
                    className={`border-r border-slate-200 bg-emerald-50/40 py-1 text-center font-semibold text-slate-700 ${
                      fitAll ? "w-[34px] min-w-[34px] px-0 text-[10px]" : "w-16 px-1"
                    }`}
                  >
                    Held
                  </th>
                  <th
                    className={`border-r border-slate-200 bg-emerald-50/40 py-1 text-center font-semibold text-slate-700 ${
                      fitAll ? "w-[34px] min-w-[34px] px-0 text-[10px]" : "w-16 px-1"
                    }`}
                  >
                    Att
                  </th>
                  <th
                    className={`border-r border-slate-300 bg-emerald-100/70 py-1 text-center font-bold text-emerald-950 ${
                      fitAll ? "w-[38px] min-w-[38px] px-0 text-[10px]" : "w-18 px-1"
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
                          className={`sticky left-0 z-10 border-r border-slate-200 bg-white px-1 py-1 text-center text-[11px] text-slate-500 group-hover:bg-slate-50 ${
                            fitAll ? "w-8 min-w-[32px]" : "w-10 min-w-[40px]"
                          }`}
                        >
                          {idx + 1}
                        </td>

                        {/* Merged Student: Name Above, PIN Number Below */}
                        <td
                          className={`sticky z-10 border-r border-slate-300 bg-white px-2 py-1 text-left shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] group-hover:bg-slate-50 ${
                            fitAll ? "left-8 w-[170px] min-w-[170px]" : "left-10 min-w-[220px]"
                          }`}
                        >
                          <div className="flex flex-col justify-center leading-tight">
                            <span
                              className={`font-semibold text-slate-900 truncate block ${
                                fitAll ? "text-[11px] max-w-[155px]" : "text-xs max-w-[205px]"
                              }`}
                              title={student.studentName}
                            >
                              {student.studentName}
                            </span>
                            <span className="font-mono text-[10px] text-slate-500 font-medium block">
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
                              : pct >= 75
                              ? "text-emerald-700 bg-emerald-50/70 font-extrabold"
                              : pct >= 65
                              ? "text-amber-700 bg-amber-50/70 font-bold"
                              : "text-rose-700 bg-rose-50/70 font-bold";

                          return (
                            <Fragment key={`cell-${student.studentDbId}-${sub.subjectId}`}>
                              {/* Classes Held Input */}
                              <td
                                className={`border-r border-slate-200 text-center ${
                                  fitAll ? "w-[34px] p-0.5" : "p-1"
                                }`}
                              >
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
                                  className={`rounded border border-slate-300 bg-white text-center font-mono font-semibold text-slate-800 shadow-2xs transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-hidden ${
                                    fitAll ? "w-[30px] h-6 px-0 text-[11px]" : "w-14 px-1 py-1 text-xs"
                                  }`}
                                />
                              </td>

                              {/* Classes Present Input */}
                              <td
                                className={`border-r border-slate-200 text-center ${
                                  fitAll ? "w-[34px] p-0.5" : "p-1"
                                }`}
                              >
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
                                  className={`rounded border text-center font-mono font-bold shadow-2xs transition focus:outline-hidden ${
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
                                }`}
                              >
                                {held > 0 ? `${pct.toFixed(0)}%` : "—"}
                              </td>
                            </Fragment>
                          );
                        })}

                        {/* Total Classes Held */}
                        <td
                          className={`border-r border-slate-200 bg-emerald-50/20 text-center font-mono font-semibold text-slate-800 ${
                            fitAll ? "w-[34px] px-0 py-1 text-[11px]" : "w-14 px-1 text-xs"
                          }`}
                        >
                          {totalHeld}
                        </td>

                        {/* Total Classes Present */}
                        <td
                          className={`border-r border-slate-200 bg-emerald-50/20 text-center font-mono font-bold text-slate-900 ${
                            fitAll ? "w-[34px] px-0 py-1 text-[11px]" : "w-14 px-1 text-xs"
                          }`}
                        >
                          {totalPresent}
                        </td>

                        {/* Overall Percentage */}
                        {(() => {
                          const overallPct = totalHeld > 0 ? (totalPresent / totalHeld) * 100 : 0;
                          const isEligible = overallPct >= 75;
                          const isCondonation = overallPct >= 65 && overallPct < 75;

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
                                className={`border-r border-slate-300 bg-emerald-100/30 text-center ${
                                  fitAll ? "w-[38px] px-0 py-1 text-[11px]" : "w-18 px-1 text-xs"
                                }`}
                              >
                                <span
                                  className={`inline-block font-mono font-extrabold ${
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
                              <td className={`px-0.5 py-1 text-center ${fitAll ? "w-[62px]" : ""}`}>
                                <span
                                  className={`inline-flex items-center justify-center gap-0.5 rounded px-1 py-0.5 font-bold uppercase tracking-wider ${
                                    fitAll ? "text-[8.5px] w-full" : "text-[9px] px-1.5"
                                  } ${badgeColor}`}
                                >
                                  {isEligible && <CheckCircle2 className="h-2 w-2 shrink-0" />}
                                  {isCondonation && <AlertTriangle className="h-2 w-2 shrink-0" />}
                                  {!isEligible && !isCondonation && totalHeld > 0 && (
                                    <XCircle className="h-2 w-2 shrink-0" />
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
                <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold text-slate-900 sticky bottom-0 z-30 shadow-[0_-2px_4px_-2px_rgba(0,0,0,0.1)]">
                  <td
                    colSpan={2}
                    className={`sticky bottom-0 left-0 z-40 border-r border-slate-300 bg-slate-100 px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wider text-slate-900 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] ${
                      fitAll ? "w-[202px] min-w-[202px]" : "w-[260px] min-w-[260px]"
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
                          className={`border-r border-slate-200 text-center font-mono ${
                            fitAll ? "w-[34px] px-0 py-1 text-[11px]" : "px-1 py-2 text-xs"
                          }`}
                        >
                          {avgHeld}
                        </td>
                        <td
                          className={`border-r border-slate-200 text-center font-mono ${
                            fitAll ? "w-[34px] px-0 py-1 text-[11px]" : "px-1 py-2 text-xs"
                          }`}
                        >
                          {avgPresent}
                        </td>
                        <td
                          className={`border-r border-slate-300 text-center font-mono font-extrabold text-blue-900 ${
                            fitAll ? "w-[34px] px-0 py-1 text-[10px]" : "px-1 py-2 text-xs"
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
                          className={`border-r border-slate-200 bg-emerald-50/50 text-center font-mono font-bold text-slate-800 ${
                            fitAll ? "w-[34px] px-0 py-1 text-[11px]" : "px-1 py-2 text-xs"
                          }`}
                        >
                          {avgHeld}
                        </td>
                        <td
                          className={`border-r border-slate-200 bg-emerald-50/50 text-center font-mono font-bold text-slate-800 ${
                            fitAll ? "w-[34px] px-0 py-1 text-[11px]" : "px-1 py-2 text-xs"
                          }`}
                        >
                          {avgPresent}
                        </td>
                        <td
                          className={`border-r border-slate-300 bg-emerald-100/60 text-center font-mono font-extrabold text-emerald-950 ${
                            fitAll ? "w-[38px] px-0 py-1 text-[11px]" : "px-1 py-2 text-xs"
                          }`}
                        >
                          {avgPct}%
                        </td>
                        <td
                          className={`text-center font-bold text-emerald-800 ${
                            fitAll ? "w-[62px] px-0 py-1 text-[9px]" : "px-1.5 py-2 text-[10px]"
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
