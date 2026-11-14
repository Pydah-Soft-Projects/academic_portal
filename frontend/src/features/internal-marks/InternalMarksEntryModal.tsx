"use client";

import { useEffect, useState, useMemo } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LoadingAnimation } from "@/components/ui/LoadingAnimation";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { apiFetch } from "@/lib/api";
import { Check, Save, Send, AlertCircle, Search, Filter } from "lucide-react";

type StudentEntry = {
  studentDbId: number;
  admissionNumber: string;
  rollNumber: string;
  studentName: string;
  sectionName: string;
  marksObtained: number | null;
  remarks: string | null;
};

type Props = {
  collegeId: number;
  courseId: number;
  branchId: number;
  subjectId: number;
  facultyStaffLinkId: number;
  subjectCode: string;
  subjectName: string;
  year?: number | null;
  semester?: number | null;
  batch?: string | null;
  section?: string | null;
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
  year,
  semester,
  batch,
  section,
  readOnly = false,
  onClose,
  onSaved,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [maxMarks, setMaxMarks] = useState<number>(30);
  const [submissionId, setSubmissionId] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("draft");
  const [uploadAccess, setUploadAccess] = useState<boolean>(true);

  const [students, setStudents] = useState<StudentEntry[]>([]);
  const [marksState, setMarksState] = useState<Record<number, { marks: string; remarks: string }>>({});
  const [validationErrors, setValidationErrors] = useState<Record<number, string>>({});

  const [filterSection, setFilterSection] = useState<string>(section || "all");
  const [searchQuery, setSearchQuery] = useState<string>("");

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
    return students.filter((st) => {
      if (filterSection !== "all") {
        if ((st.sectionName || "").trim().toUpperCase() !== filterSection.trim().toUpperCase()) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const mRoll = st.rollNumber.toLowerCase().includes(q);
        const mAdm = st.admissionNumber.toLowerCase().includes(q);
        const mName = st.studentName.toLowerCase().includes(q);
        if (!mRoll && !mAdm && !mName) return false;
      }
      return true;
    });
  }, [students, filterSection, searchQuery]);

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

        const res = await apiFetch(`/internal-marks/students?${query.toString()}`);
        if (!res.ok) throw new Error("Failed to load student list for marks entry");
        const body = await res.json();
        const data = body.data;

        setMaxMarks(data.maxMarks || 30);
        setSubmissionId(data.submissionId);
        setStatus(data.status || "draft");
        setUploadAccess(data.uploadAccess !== false);
        setStudents(data.students || []);

        const initialMarks: Record<number, { marks: string; remarks: string }> = {};
        for (const st of data.students || []) {
          initialMarks[st.studentDbId] = {
            marks: st.marksObtained != null ? String(st.marksObtained) : "",
            remarks: st.remarks || "",
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
  }, [collegeId, courseId, branchId, subjectId, facultyStaffLinkId]);

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
        const val = marksState[st.studentDbId]?.marks;
        const remarks = marksState[st.studentDbId]?.remarks;
        return {
          studentDbId: st.studentDbId,
          admissionNumber: st.admissionNumber,
          rollNumber: st.rollNumber,
          studentName: st.studentName,
          marksObtained: val !== "" && val != null ? Number(val) : null,
          remarks: remarks || "",
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
      title={`Internal Marks Entry — ${subjectName} (${subjectCode})`}
      onClose={onClose}
      wide
    >
      <div className="space-y-4">
        {!uploadAccess && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>Internal marks posting is currently disabled/locked for this subject by administration. Marks can only be viewed in read-only mode.</span>
          </div>
        )}
        {/* Header bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 border border-border">
          <div>
            <div className="text-xs text-slate-500 font-semibold uppercase">Subject Details</div>
            <div className="font-semibold text-navy-900 text-sm">
              {subjectName} <span className="text-xs font-mono text-slate-500">({subjectCode})</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-slate-500 font-medium">Max Marks:</span>
              <input
                type="number"
                disabled={!isEditable}
                className="ml-1.5 w-16 rounded border border-border p-1 text-center font-bold text-slate-800 outline-none focus:border-brand-600"
                value={maxMarks}
                onChange={(e) => setMaxMarks(Number(e.target.value) || 30)}
              />
            </div>
            <div>
              <span className="text-slate-500 font-medium mr-1.5">Status:</span>
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
          <div className="space-y-3">
            {/* Search and Section Filter Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-border bg-slate-50 px-3 py-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by Roll / PIN / Name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 w-56 rounded border border-border bg-white pl-8 pr-2.5 text-xs text-slate-800 outline-none focus:border-brand-600"
                  />
                </div>

                {availableSections.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5 text-slate-400" />
                    <select
                      value={filterSection}
                      onChange={(e) => setFilterSection(e.target.value)}
                      className="h-8 rounded border border-border bg-white px-2 text-xs font-semibold text-slate-800 outline-none focus:border-brand-600 cursor-pointer"
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

              <div className="text-slate-500 font-medium text-[11px] sm:text-xs">
                Showing <span className="font-bold text-slate-800">{displayedStudents.length}</span> of <span className="font-bold text-slate-800">{students.length}</span> students
                {availableSections.length > 1 && (
                  <span className="ml-1 text-[11px] text-brand-700 font-semibold bg-brand-50 px-1.5 py-0.5 rounded">
                    Merged Sections: {availableSections.join(", ")}
                  </span>
                )}
              </div>
            </div>

            {displayedStudents.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500 border border-border rounded-lg bg-white">
                No students match your search query or section filter.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-border">
                    <tr>
                      <th className="px-3 py-2.5">#</th>
                      <th className="px-3 py-2.5">Roll / PIN Number</th>
                      <th className="px-3 py-2.5">Student Name</th>
                      <th className="px-3 py-2.5">Section</th>
                      <th className="px-3 py-2.5 w-32">Internal Marks (Max: {maxMarks})</th>
                      <th className="px-3 py-2.5">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-xs">
                    {displayedStudents.map((st, idx) => {
                      const state = marksState[st.studentDbId] || { marks: "", remarks: "" };
                      const errText = validationErrors[st.studentDbId];

                      return (
                        <tr key={st.studentDbId} className="hover:bg-slate-50">
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
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              max={maxMarks}
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
                          </td>
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
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-border pt-4">
          <div className="text-xs text-slate-500">
            Total Students: <span className="font-semibold text-slate-800">{students.length}</span>
            {displayedStudents.length !== students.length && (
              <span> (Filtered: <span className="font-semibold text-brand-700">{displayedStudents.length}</span>)</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            {isEditable && (
              <>
                <Button
                  disabled={saving || submitting}
                  variant="secondary"
                  onClick={() => void handleSaveDraft()}
                >
                  <Save className="h-4 w-4 mr-1.5" />
                  {saving ? "Saving Draft..." : "Save Draft"}
                </Button>
                <Button
                  disabled={saving || submitting}
                  onClick={() => void handleSubmitForApproval()}
                  className="bg-brand-600 text-white hover:bg-brand-700"
                >
                  <Send className="h-4 w-4 mr-1.5" />
                  {submitting ? "Submitting..." : "Submit for Approval"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
