"use client";

import { useEffect, useState, useMemo } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LoadingAnimation } from "@/components/ui/LoadingAnimation";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { apiFetch } from "@/lib/api";
import { Check, Save, Send, AlertCircle, Search, Filter, FileText, CheckCircle2, UserCheck } from "lucide-react";

export type AttendanceStatus = "present" | "absent" | "not_eligible";

type StudentEntry = {
  studentDbId: number;
  admissionNumber: string;
  rollNumber: string;
  pinNo?: string | null;
  studentName: string;
  sectionName: string;
  marksObtained: number | null;
  remarks: string | null;
  attendanceStatus?: AttendanceStatus;
};

type Props = {
  collegeId: number;
  courseId: number;
  branchId: number;
  subjectId: number;
  facultyStaffLinkId: number;
  subjectCode: string;
  subjectName: string;
  courseName?: string | null;
  branchName?: string | null;
  year?: number | null;
  semester?: number | null;
  batch?: string | null;
  section?: string | null;
  examNotification?: {
    id: number;
    name: string;
    type?: string;
    examDates?: string;
    deadline?: string | null;
  } | null;
  readOnly?: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

export function InternalMarksEntryModal({
  collegeId,
  courseId,
  branchId,
  subjectId,
  facultyStaffLinkId,
  subjectCode,
  subjectName,
  courseName,
  branchName,
  year,
  semester,
  batch,
  section,
  examNotification,
  readOnly = false,
  onClose,
  onSaved,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [examMeta, setExamMeta] = useState(examNotification || null);

  const [maxMarks, setMaxMarks] = useState<number>(30);
  const [submissionId, setSubmissionId] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("draft");
  const [uploadAccess, setUploadAccess] = useState<boolean>(true);

  const [students, setStudents] = useState<StudentEntry[]>([]);
  const [marksState, setMarksState] = useState<
    Record<number, { marks: string; remarks: string; attendanceStatus: AttendanceStatus }>
  >({});
  const [validationErrors, setValidationErrors] = useState<Record<number, string>>({});

  const initialSection = useMemo(() => {
    if (!section || section.includes(",") || section === "all") return "all";
    return section.trim();
  }, [section]);

  const [filterSection, setFilterSection] = useState<string>(initialSection);
  const [filterStatus, setFilterStatus] = useState<"all" | AttendanceStatus>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    if (section && !section.includes(",") && section !== "all") {
      setFilterSection(section.trim());
    } else {
      setFilterSection("all");
    }
  }, [section]);

  const availableSections = useMemo(() => {
    const secs = new Set<string>();
    for (const s of students) {
      if (s.sectionName && s.sectionName.trim()) {
        secs.add(s.sectionName.trim());
      }
    }
    return Array.from(secs).sort();
  }, [students]);

  const displayedStudents = useMemo(() => {
    const list = students.filter((st) => {
      if (filterSection !== "all") {
        const stSec = (st.sectionName || "").trim().toUpperCase();
        if (filterSection.includes(",")) {
          const allowed = filterSection.split(",").map((x) => x.trim().toUpperCase());
          if (!allowed.includes(stSec)) return false;
        } else if (stSec !== filterSection.trim().toUpperCase()) {
          return false;
        }
      }
      if (filterStatus !== "all") {
        const currentAtt = marksState[st.studentDbId]?.attendanceStatus || "present";
        if (currentAtt !== filterStatus) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const mRoll = (st.rollNumber || "").toLowerCase().includes(q);
        const mAdm = (st.admissionNumber || "").toLowerCase().includes(q);
        const mName = (st.studentName || "").toLowerCase().includes(q);
        if (!mRoll && !mAdm && !mName) return false;
      }
      return true;
    });

    // Ensure students are strictly sorted by PIN number in natural alphanumeric order
    return list.slice().sort((a, b) => {
      const isRealPin = (val?: string | null) =>
        Boolean(
          val &&
            val.trim() !== "" &&
            val.trim() !== "-" &&
            val.trim().toLowerCase() !== "na" &&
            val.trim().toLowerCase() !== "null"
        );

      const pinA = isRealPin(a.pinNo)
        ? a.pinNo!.trim()
        : isRealPin(a.rollNumber) && a.rollNumber !== a.admissionNumber
        ? a.rollNumber.trim()
        : null;

      const pinB = isRealPin(b.pinNo)
        ? b.pinNo!.trim()
        : isRealPin(b.rollNumber) && b.rollNumber !== b.admissionNumber
        ? b.rollNumber.trim()
        : null;

      // Students with valid registered PIN numbers come first
      if (pinA && !pinB) return -1;
      if (!pinA && pinB) return 1;

      if (pinA && pinB) {
        return pinA.localeCompare(pinB, undefined, { numeric: true, sensitivity: "base" });
      }

      // If neither has a PIN number, order by admission number
      const admA = (a.admissionNumber || a.rollNumber || "").trim();
      const admB = (b.admissionNumber || b.rollNumber || "").trim();
      return admA.localeCompare(admB, undefined, { numeric: true, sensitivity: "base" });
    });
  }, [students, filterSection, filterStatus, searchQuery, marksState]);

  const stats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let notEligible = 0;
    let entered = 0;

    for (const st of students) {
      const state = marksState[st.studentDbId];
      const status = state?.attendanceStatus || "present";
      if (status === "present") {
        present++;
        if (state?.marks !== "" && state?.marks != null) {
          entered++;
        }
      } else if (status === "absent") {
        absent++;
      } else if (status === "not_eligible") {
        notEligible++;
      }
    }

    return { total: students.length, present, absent, notEligible, entered };
  }, [students, marksState]);

  // Fetch students & current marks
  useEffect(() => {
    async function loadStudents() {
      setLoading(true);
      setError(null);
      try {
        const query = new URLSearchParams({
          collegeId: String(collegeId),
          courseId: String(courseId),
          branchId: String(branchId),
          subjectId: String(subjectId),
          facultyStaffLinkId: String(facultyStaffLinkId),
        });
        if (year) query.set("year", String(year));
        if (semester) query.set("semester", String(semester));
        if (batch) query.set("batch", String(batch));
        if (section && section !== "all") query.set("section", String(section));
        if (examNotification?.id) query.set("examId", String(examNotification.id));

        const res = await apiFetch(`/internal-marks/students?${query.toString()}`);
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.message || "Failed to load student list for marks entry");
        }
        const body = await res.json();
        const data = body.data;

        setMaxMarks(data.maxMarks || 30);
        setSubmissionId(data.submissionId);
        setStatus(data.status || "draft");
        setUploadAccess(data.uploadAccess !== false);
        if (data.examNotification) {
          setExamMeta(data.examNotification);
        }

        // Deduplicate students by studentDbId to guarantee no double counts
        const rawStudents: StudentEntry[] = data.students || [];
        const seenIds = new Set<number>();
        const uniqueStudents: StudentEntry[] = [];
        for (const st of rawStudents) {
          if (!seenIds.has(st.studentDbId)) {
            seenIds.add(st.studentDbId);
            uniqueStudents.push(st);
          }
        }
        setStudents(uniqueStudents);

        const initialMarks: Record<
          number,
          { marks: string; remarks: string; attendanceStatus: AttendanceStatus }
        > = {};
        for (const st of uniqueStudents) {
          const status = (st.attendanceStatus as AttendanceStatus) || "present";
          initialMarks[st.studentDbId] = {
            marks: status === "present" && st.marksObtained != null ? String(st.marksObtained) : "",
            remarks: st.remarks || "",
            attendanceStatus: status,
          };
        }
        setMarksState(initialMarks);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load students");
      } finally {
        setLoading(false);
      }
    }
    void loadStudents();
  }, [collegeId, courseId, branchId, subjectId, facultyStaffLinkId, year, semester, batch, section]);

  // Handle Attendance Status Change (Present / Absent / Not Eligible)
  function handleAttendanceStatusChange(studentDbId: number, status: AttendanceStatus) {
    setMarksState((prev) => {
      const current = prev[studentDbId] || { marks: "", remarks: "", attendanceStatus: "present" };
      return {
        ...prev,
        [studentDbId]: {
          ...current,
          attendanceStatus: status,
          marks: status === "present" ? current.marks : "",
        },
      };
    });

    // Clear validation error when changed away from present or valid
    if (status !== "present") {
      setValidationErrors((prev) => {
        const copy = { ...prev };
        delete copy[studentDbId];
        return copy;
      });
    }
  }

  // Quick Action: Mark all currently filtered students as Present
  function handleMarkAllPresent() {
    setMarksState((prev) => {
      const next = { ...prev };
      for (const st of displayedStudents) {
        const current = next[st.studentDbId] || { marks: "", remarks: "", attendanceStatus: "present" };
        next[st.studentDbId] = {
          ...current,
          attendanceStatus: "present",
        };
      }
      return next;
    });
  }

  // Handle Mark Change
  function handleMarkChange(studentDbId: number, val: string) {
    setMarksState((prev) => ({
      ...prev,
      [studentDbId]: { ...prev[studentDbId], marks: val },
    }));

    // Real-time validation
    if (val === "") {
      setValidationErrors((prev) => {
        const copy = { ...prev };
        delete copy[studentDbId];
        return copy;
      });
      return;
    }

    const n = Number(val);
    if (!Number.isFinite(n) || n < 0 || n > maxMarks) {
      setValidationErrors((prev) => ({
        ...prev,
        [studentDbId]: `Marks must be between 0 and ${maxMarks}`,
      }));
    } else {
      setValidationErrors((prev) => {
        const copy = { ...prev };
        delete copy[studentDbId];
        return copy;
      });
    }
  }

  // Handle Save Draft
  async function handleSaveDraft() {
    if (Object.keys(validationErrors).length > 0) {
      alert("Please fix validation errors before saving draft.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const entriesPayload = students.map((st) => {
        const entryState = marksState[st.studentDbId];
        const attStatus = entryState?.attendanceStatus || "present";
        const val = entryState?.marks;
        const remarks = entryState?.remarks;
        return {
          studentDbId: st.studentDbId,
          admissionNumber: st.admissionNumber,
          rollNumber: st.rollNumber,
          studentName: st.studentName,
          marksObtained: attStatus === "present" && val !== "" && val != null ? Number(val) : null,
          remarks: remarks || "",
          attendanceStatus: attStatus,
        };
      });

      const res = await apiFetch("/internal-marks/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collegeId,
          courseId,
          branchId,
          subjectId,
          facultyStaffLinkId,
          maxMarks,
          semesterNumber: semester ?? null,
          batch: batch ?? null,
          section: section ?? null,
          examId: examMeta?.id ?? null,
          entries: entriesPayload,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Failed to save draft");
      }

      const body = await res.json();
      setSubmissionId(body.submissionId);
      setSuccessMsg("Draft saved successfully.");
      if (onSaved) onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save draft");
    } finally {
      setSaving(false);
    }
  }

  // Handle Submit for Approval
  async function handleSubmitForApproval() {
    if (Object.keys(validationErrors).length > 0) {
      alert("Please fix validation errors before submitting.");
      return;
    }

    if (!confirm("Are you sure you want to submit internal marks for approval? Once submitted, marks cannot be edited unless returned.")) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      // First save current draft to ensure database is up to date
      await handleSaveDraft();

      // Submit
      const res = await apiFetch("/internal-marks/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          comments: "Submitted by Faculty",
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Failed to submit marks");
      }

      const body = await res.json();
      setStatus(body.status);
      setSuccessMsg("Internal marks submitted for approval successfully!");
      if (onSaved) onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit marks");
    } finally {
      setSubmitting(false);
    }
  }

  const isEditable = !readOnly && uploadAccess && (status === "draft" || status === "returned" || status === "rejected");

  return (
    <Modal
      title={`${subjectName} (${subjectCode})`}
      onClose={onClose}
      maxWidth="max-w-5xl xl:max-w-6xl"
    >
      <div className="space-y-2.5 sm:space-y-4">
        {!uploadAccess && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-2.5 sm:p-3 text-[11px] sm:text-xs text-amber-900 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>Internal marks posting is currently disabled/locked for this subject by administration. Marks can only be viewed in read-only mode.</span>
          </div>
        )}

        {/* Exam Notification Banner */}
        {examMeta && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 rounded-lg bg-indigo-50/80 border border-indigo-200 px-3 py-2 text-xs text-indigo-950">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-indigo-900 flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-indigo-600 shrink-0" />
                Exam Notification:
              </span>
              <span className="font-semibold text-indigo-800">{examMeta.name}</span>
              <span className="font-semibold text-[10px] uppercase bg-indigo-200/80 text-indigo-900 px-1.5 py-0.5 rounded">
                {examMeta.type || "INTERNAL"}
              </span>
            </div>
            {examMeta.examDates && (
              <div className="text-[11px] text-indigo-700 font-medium">
                Dates: {examMeta.examDates}
                {examMeta.deadline ? ` • Deadline: ${examMeta.deadline}` : ""}
              </div>
            )}
          </div>
        )}

        {/* Top Scope & Metadata Bar: Course, Branch, Year, Sem, Section, Max Marks, Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 border border-border text-[11px] sm:text-xs">
          <div className="flex flex-wrap items-center gap-1.5 text-slate-700">
            {(courseName || branchName) && (
              <span className="font-bold text-navy-900">
                {[courseName, branchName].filter(Boolean).join(" • ")}
              </span>
            )}
            {(year || semester) && (
              <>
                {(courseName || branchName) && <span className="text-slate-300">•</span>}
                <span className="font-semibold text-slate-600">
                  {[year ? `Year ${year}` : "", semester ? `Sem ${semester}` : ""].filter(Boolean).join(", ")}
                </span>
              </>
            )}
            <span className="text-slate-300">•</span>
            <span className="font-bold text-brand-700 bg-brand-50 border border-brand-200 px-1.5 py-0.5 rounded text-[10px] sm:text-[11px]">
              Section {section || (availableSections.length > 0 ? Array.from(availableSections).join(", ") : "A")}
            </span>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-1.5 sm:pt-0 border-slate-200">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Max Marks:</span>
              <input
                type="number"
                inputMode="decimal"
                disabled={!isEditable}
                className="w-12 sm:w-14 rounded border border-border px-1.5 py-0.5 text-center text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-brand-600 bg-white"
                value={maxMarks}
                onChange={(e) => setMaxMarks(Number(e.target.value) || 30)}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium hidden sm:inline">Status:</span>
              <StatusBadge status={status} />
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs text-critical">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-xs text-green-800 font-medium">
            <Check className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {loading ? (
          <TableSkeleton columns={5} rows={6} showHeader />
        ) : students.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            No students found for this subject and branch scope.
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {/* Search, Filter & Quick Action Controls */}
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-slate-50 p-2 sm:px-3 sm:py-2.5 text-[11px] sm:text-xs">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 w-full lg:w-auto">
                  <div className="relative w-full sm:w-56">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search Roll / Name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8 w-full rounded border border-border bg-white pl-8 pr-2.5 text-[11px] sm:text-xs text-slate-800 outline-none focus:border-brand-600"
                    />
                  </div>

                  {availableSections.length > 0 && (
                    <div className="flex items-center gap-1.5 w-full sm:w-auto">
                      <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <select
                        value={filterSection}
                        onChange={(e) => setFilterSection(e.target.value)}
                        className="h-8 w-full sm:w-auto rounded border border-border bg-white px-2 text-[11px] sm:text-xs font-semibold text-slate-800 outline-none focus:border-brand-600 cursor-pointer"
                      >
                        <option value="all">All Sections ({students.length})</option>
                        {availableSections.map((sec) => {
                          const count = students.filter(
                            (s) => (s.sectionName || "").trim().toUpperCase() === sec.toUpperCase()
                          ).length;
                          return (
                            <option key={sec} value={sec}>
                              Section {sec} ({count})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}
                </div>

                {/* Attendance Status Filter Pills */}
                <div className="flex items-center flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => setFilterStatus("all")}
                    className={`px-2 py-1 rounded text-[10px] sm:text-[11px] font-semibold transition cursor-pointer ${
                      filterStatus === "all"
                        ? "bg-slate-800 text-white shadow-2xs"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    All ({students.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterStatus("present")}
                    className={`px-2 py-1 rounded text-[10px] sm:text-[11px] font-semibold transition cursor-pointer ${
                      filterStatus === "present"
                        ? "bg-emerald-700 text-white shadow-2xs"
                        : "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
                    }`}
                  >
                    ● Present ({stats.present})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterStatus("absent")}
                    className={`px-2 py-1 rounded text-[10px] sm:text-[11px] font-semibold transition cursor-pointer ${
                      filterStatus === "absent"
                        ? "bg-rose-700 text-white shadow-2xs"
                        : "bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100"
                    }`}
                  >
                    ● Absent ({stats.absent})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterStatus("not_eligible")}
                    className={`px-2 py-1 rounded text-[10px] sm:text-[11px] font-semibold transition cursor-pointer ${
                      filterStatus === "not_eligible"
                        ? "bg-amber-700 text-white shadow-2xs"
                        : "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
                    }`}
                  >
                    ● Not Eligible ({stats.notEligible})
                  </button>
                </div>
              </div>

              {/* Status helper summary & Quick action */}
              <div className="flex items-center justify-between text-slate-500 font-medium text-[10px] sm:text-xs pt-1 border-t border-slate-200/70">
                <div className="flex items-center gap-2">
                  <span>
                    Showing <strong className="text-slate-800">{displayedStudents.length}</strong> of{" "}
                    <strong className="text-slate-800">{students.length}</strong>
                  </span>
                  {availableSections.length > 1 && (
                    <span className="text-[9px] sm:text-[10px] text-brand-700 font-semibold bg-brand-50 px-1.5 py-0.5 rounded">
                      Merged: {availableSections.join(", ")}
                    </span>
                  )}
                </div>

                {isEditable && (
                  <button
                    type="button"
                    onClick={handleMarkAllPresent}
                    className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-emerald-700 bg-white hover:bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded shadow-2xs transition cursor-pointer"
                    title="Set all currently shown students to Present"
                  >
                    <UserCheck className="h-3 w-3" />
                    <span>Set All to Present</span>
                  </button>
                )}
              </div>
            </div>

            {displayedStudents.length === 0 ? (
              <div className="py-6 sm:py-8 text-center text-xs sm:text-sm text-slate-500 border border-border rounded-lg bg-white">
                No students match your search query or filter criteria.
              </div>
            ) : (
              <>
                {/* Mobile View: Inline Student Rows (Compact & Continuous List) */}
                <div className="block md:hidden rounded-lg border border-border bg-white divide-y divide-border overflow-hidden shadow-2xs">
                  {displayedStudents.map((st, idx) => {
                    const state = marksState[st.studentDbId] || { marks: "", remarks: "", attendanceStatus: "present" };
                    const attStatus: AttendanceStatus = state.attendanceStatus || "present";
                    const isPresent = attStatus === "present";
                    const errText = validationErrors[st.studentDbId];
                    const isFilled = isPresent && state.marks !== "" && state.marks != null;

                    return (
                      <div
                        key={st.studentDbId}
                        className={`p-2 transition ${
                          errText
                            ? "bg-red-50/60"
                            : !isPresent
                            ? attStatus === "absent"
                              ? "bg-rose-50/30"
                              : "bg-amber-50/30"
                            : isFilled
                            ? "bg-emerald-50/20"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        {/* Inline Row: Student Info, Attendance Dropdown, Marks Input */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[10px] text-slate-400 font-medium shrink-0">#{idx + 1}</span>
                              <span className="font-mono font-bold text-[11px] sm:text-xs text-navy-900 bg-slate-100 px-1.5 py-0.5 rounded truncate">
                                {st.rollNumber}
                              </span>
                              <span className="text-[10px] font-semibold text-brand-700 bg-brand-50 px-1 py-0.5 rounded">
                                Sec {st.sectionName || "A"}
                              </span>
                            </div>
                            <div className="mt-0.5 font-semibold text-slate-800 text-[11px] sm:text-xs truncate" title={st.studentName}>
                              {st.studentName}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Attendance Dropdown */}
                            <select
                              disabled={!isEditable}
                              value={attStatus}
                              onChange={(e) =>
                                handleAttendanceStatusChange(st.studentDbId, e.target.value as AttendanceStatus)
                              }
                              className={`h-8 rounded border px-1.5 text-[11px] font-bold outline-none cursor-pointer ${
                                attStatus === "present"
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                  : attStatus === "absent"
                                  ? "bg-rose-50 text-rose-800 border-rose-300"
                                  : "bg-amber-50 text-amber-800 border-amber-300"
                              }`}
                            >
                              <option value="present">Present</option>
                              <option value="absent">Absent</option>
                              <option value="not_eligible">Not Eligible</option>
                            </select>

                            {/* Marks Input / Status Badge */}
                            {isPresent ? (
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  max={maxMarks}
                                  inputMode="decimal"
                                  disabled={!isEditable}
                                  placeholder="0.0"
                                  className={`h-8 w-16 sm:w-20 rounded border text-center font-bold text-xs sm:text-sm outline-none transition focus:ring-1 focus:ring-brand-500 ${
                                    errText
                                      ? "border-red-500 bg-red-50 text-red-900"
                                      : isFilled
                                      ? "border-emerald-400 bg-white text-emerald-900 font-black"
                                      : "border-border bg-white text-slate-900"
                                  }`}
                                  value={state.marks}
                                  onChange={(e) => handleMarkChange(st.studentDbId, e.target.value)}
                                />
                                <span className="absolute -top-1.5 right-1 bg-white px-0.5 text-[8px] sm:text-[9px] font-semibold text-slate-400">
                                  /{maxMarks}
                                </span>
                              </div>
                            ) : attStatus === "absent" ? (
                              <div className="h-8 w-16 sm:w-20 flex items-center justify-center rounded border border-rose-200 bg-rose-50 text-rose-700 font-bold text-xs">
                                AB
                              </div>
                            ) : (
                              <div className="h-8 w-16 sm:w-20 flex items-center justify-center rounded border border-amber-200 bg-amber-50 text-amber-800 font-bold text-xs">
                                NE
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Error Message */}
                        {errText && (
                          <div className="mt-1 text-[10px] text-critical font-medium text-right">{errText}</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Desktop View: Full Data Table */}
                <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-border">
                      <tr>
                        <th className="px-3 py-2.5">#</th>
                        <th className="px-3 py-2.5">Roll / PIN Number</th>
                        <th className="px-3 py-2.5">Student Name</th>
                        <th className="px-3 py-2.5">Section</th>
                        <th className="px-3 py-2.5 w-36">Exam Attendance</th>
                        <th className="px-3 py-2.5 w-36">Internal Marks (Max: {maxMarks})</th>
                        <th className="px-3 py-2.5">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-xs">
                      {displayedStudents.map((st, idx) => {
                        const state = marksState[st.studentDbId] || { marks: "", remarks: "", attendanceStatus: "present" };
                        const attStatus: AttendanceStatus = state.attendanceStatus || "present";
                        const isPresent = attStatus === "present";
                        const errText = validationErrors[st.studentDbId];

                        return (
                          <tr
                            key={st.studentDbId}
                            className={`hover:bg-slate-50 transition ${
                              !isPresent
                                ? attStatus === "absent"
                                  ? "bg-rose-50/20"
                                  : "bg-amber-50/20"
                                : ""
                            }`}
                          >
                            <td className="px-3 py-2 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="px-3 py-2 font-mono font-semibold text-slate-900">
                              {st.rollNumber}
                            </td>
                            <td className="px-3 py-2 font-medium text-slate-800">{st.studentName}</td>
                            <td className="px-3 py-2">
                              <span className="font-semibold text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded text-[11px]">
                                {st.sectionName || "A"}
                              </span>
                            </td>

                            {/* Attendance Status Dropdown */}
                            <td className="px-3 py-2">
                              <select
                                disabled={!isEditable}
                                value={attStatus}
                                onChange={(e) =>
                                  handleAttendanceStatusChange(st.studentDbId, e.target.value as AttendanceStatus)
                                }
                                className={`rounded border px-2 py-1 text-xs font-bold outline-none cursor-pointer ${
                                  attStatus === "present"
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-300 focus:border-emerald-500"
                                    : attStatus === "absent"
                                    ? "bg-rose-50 text-rose-800 border-rose-300 focus:border-rose-500"
                                    : "bg-amber-50 text-amber-800 border-amber-300 focus:border-amber-500"
                                }`}
                              >
                                <option value="present">● Present</option>
                                <option value="absent">● Absent</option>
                                <option value="not_eligible">● Not Eligible</option>
                              </select>
                            </td>

                            {/* Marks Input or Status Badge */}
                            <td className="px-3 py-2">
                              {isPresent ? (
                                <div>
                                  <input
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    max={maxMarks}
                                    inputMode="decimal"
                                    disabled={!isEditable}
                                    placeholder="0.0"
                                    className={`w-24 rounded border px-2 py-1 text-center font-bold outline-none focus:border-brand-600 ${
                                      errText
                                        ? "border-red-500 bg-red-50 text-red-900"
                                        : "border-border bg-white text-slate-900"
                                    }`}
                                    value={state.marks}
                                    onChange={(e) => handleMarkChange(st.studentDbId, e.target.value)}
                                  />
                                  {errText && (
                                    <div className="mt-0.5 text-[10px] text-critical font-medium">{errText}</div>
                                  )}
                                </div>
                              ) : attStatus === "absent" ? (
                                <div className="inline-flex items-center justify-center w-24 h-7 rounded border border-rose-200 bg-rose-50 text-rose-700 font-bold text-xs">
                                  AB (Absent)
                                </div>
                              ) : (
                                <div className="inline-flex items-center justify-center w-24 h-7 rounded border border-amber-200 bg-amber-50 text-amber-800 font-bold text-xs">
                                  NE (Not Eligible)
                                </div>
                              )}
                            </td>

                            {/* Remarks */}
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                disabled={!isEditable}
                                placeholder="Optional remarks"
                                className="w-full rounded border border-border bg-white px-2 py-1 text-xs outline-none focus:border-brand-600"
                                value={state.remarks}
                                onChange={(e) =>
                                  setMarksState((prev) => ({
                                    ...prev,
                                    [st.studentDbId]: { ...prev[st.studentDbId], remarks: e.target.value },
                                  }))
                                }
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* Footer Actions - Sticky on mobile for quick saving */}
        <div className="sticky -bottom-3 sm:-bottom-4 -mx-3 sm:-mx-5 px-3 sm:px-5 py-2.5 sm:py-3 bg-white/95 backdrop-blur-xs border-t border-border shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5 text-[11px] sm:text-xs">
            <span className="text-slate-500">
              Total: <strong className="text-slate-800">{students.length}</strong>
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-medium">
              Present: <strong>{stats.present}</strong>
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 font-medium">
              Absent: <strong>{stats.absent}</strong>
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 font-medium">
              Not Eligible: <strong>{stats.notEligible}</strong>
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-200 font-semibold">
              Entered: <strong>{stats.entered} / {stats.present}</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
            <Button variant="secondary" onClick={onClose} className="flex-1 sm:flex-none justify-center h-8 sm:h-9 text-xs">
              Close
            </Button>
            {isEditable && (
              <>
                <Button
                  disabled={saving || submitting}
                  variant="secondary"
                  onClick={() => void handleSaveDraft()}
                  className="flex-1 sm:flex-none justify-center h-8 sm:h-9 text-xs px-2.5 sm:px-3"
                >
                  <Save className="h-3.5 w-3.5 mr-1" />
                  {saving ? "Saving..." : "Save Draft"}
                </Button>
                <Button
                  disabled={saving || submitting}
                  onClick={() => void handleSubmitForApproval()}
                  className="flex-1 sm:flex-none justify-center bg-brand-600 text-white hover:bg-brand-700 h-8 sm:h-9 text-xs font-semibold px-2.5 sm:px-3"
                >
                  <Send className="h-3.5 w-3.5 mr-1" />
                  {submitting ? "Submitting..." : "Submit"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
