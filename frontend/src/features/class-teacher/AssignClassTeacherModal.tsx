"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";
import { Search, UserCheck, AlertCircle, Check, Loader2, X } from "lucide-react";

export type FacultyOption = {
  hrmsEmployeeId: string;
  name: string;
  division?: string;
  department?: string;
  designation?: string;
  employeeGroup?: string;
  staffLinkId?: number | null;
  assignedSectionsCount?: number;
};

export type TargetSectionScope = {
  collegeId: number;
  collegeName?: string;
  courseId?: number;
  courseName?: string;
  branchId: number;
  branchName?: string;
  batch: string;
  year?: number | null;
  semester?: number | null;
  sectionName: string;
  studentCount?: number;
  academicYearLabel?: string;
  currentTeacher?: {
    facultyStaffLinkId: number;
    facultyName: string;
    hrmsEmployeeId: string;
    departmentName?: string | null;
  } | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  sectionInfo: TargetSectionScope | null;
  onAssigned: (teacher: {
    facultyStaffLinkId: number;
    facultyName: string;
    hrmsEmployeeId: string;
    departmentName: string | null;
    designation: string | null;
  }) => void;
};

export function AssignClassTeacherModal({
  open,
  onClose,
  sectionInfo,
  onAssigned,
}: Props) {
  const [facultyList, setFacultyList] = useState<FacultyOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedHrmsId, setSelectedHrmsId] = useState<string>("");
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setError(null);
      setSelectedHrmsId("");
      return;
    }

    if (sectionInfo?.currentTeacher?.hrmsEmployeeId) {
      setSelectedHrmsId(sectionInfo.currentTeacher.hrmsEmployeeId);
    }

    const loadFaculty = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch("/class-teacher/faculty-options");
        if (res.ok) {
          const json = await res.json();
          setFacultyList(json.data ?? []);
        } else {
          // Fallback to timetable faculty
          const resFallback = await apiFetch("/timetables/faculty-options");
          if (resFallback.ok) {
            const json = await resFallback.json();
            setFacultyList(json.data ?? []);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load faculty options");
      } finally {
        setLoading(false);
      }
    };

    void loadFaculty();
  }, [open, sectionInfo]);

  const filteredFaculty = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return facultyList;
    return facultyList.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.hrmsEmployeeId.toLowerCase().includes(q) ||
        (f.department && f.department.toLowerCase().includes(q)) ||
        (f.designation && f.designation.toLowerCase().includes(q))
    );
  }, [facultyList, search]);

  const selectedFaculty = useMemo(
    () => facultyList.find((f) => f.hrmsEmployeeId === selectedHrmsId) ?? null,
    [facultyList, selectedHrmsId]
  );

  const handleAssign = async () => {
    if (!sectionInfo || !selectedFaculty) return;
    setAssigning(true);
    setError(null);

    try {
      const payload = {
        hrmsEmployeeId: selectedFaculty.hrmsEmployeeId,
        facultyName: selectedFaculty.name,
        departmentName: selectedFaculty.department ?? null,
        collegeId: sectionInfo.collegeId,
        courseId: sectionInfo.courseId,
        branchId: sectionInfo.branchId,
        batch: sectionInfo.batch,
        year: sectionInfo.year,
        semester: sectionInfo.semester,
        sectionName: sectionInfo.sectionName,
        academicYearLabel: sectionInfo.academicYearLabel,
      };

      const res = await apiFetch("/class-teacher/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Failed to assign class teacher (${res.status})`);
      }

      onAssigned({
        facultyStaffLinkId: selectedFaculty.staffLinkId ?? 0,
        facultyName: selectedFaculty.name,
        hrmsEmployeeId: selectedFaculty.hrmsEmployeeId,
        departmentName: selectedFaculty.department ?? null,
        designation: selectedFaculty.designation ?? null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign class teacher");
    } finally {
      setAssigning(false);
    }
  };

  if (!open || !sectionInfo) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-xl rounded-xl border border-border bg-white shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-navy-900">
                {sectionInfo.currentTeacher ? "Change Class Teacher" : "Assign Class Teacher"}
              </h3>
              <p className="text-xs text-slate-500">
                {sectionInfo.collegeName ? `${sectionInfo.collegeName} • ` : ""}
                {sectionInfo.branchName || "Branch"} • Sec {sectionInfo.sectionName}
                {sectionInfo.year ? ` • Year ${sectionInfo.year}` : ""}
                {sectionInfo.semester ? ` • Sem ${sectionInfo.semester}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Target Scope Pill */}
        <div className="px-5 py-3 bg-indigo-50/40 border-b border-indigo-100/60 flex flex-wrap items-center justify-between text-xs text-slate-700 gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-navy-900">Section:</span>
            <span className="px-2 py-0.5 rounded bg-white border border-indigo-200 font-bold text-navy-900">
              {sectionInfo.branchName} - Sec {sectionInfo.sectionName} ({sectionInfo.batch})
            </span>
          </div>
          {sectionInfo.studentCount != null ? (
            <span className="text-slate-600">
              <strong className="text-navy-900">{sectionInfo.studentCount}</strong> enrolled students
            </span>
          ) : null}
        </div>

        {error ? (
          <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {/* Search Bar */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search faculty by name, department, employee code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border focus:border-brand-600 focus:ring-1 focus:ring-brand-600 outline-none"
            />
          </div>
        </div>

        {/* Faculty List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
              <p className="text-xs">Loading eligible faculty...</p>
            </div>
          ) : filteredFaculty.length === 0 ? (
            <div className="py-10 text-center text-slate-500 text-xs">
              No faculty found matching &ldquo;{search}&rdquo;. Try another name or code.
            </div>
          ) : (
            filteredFaculty.map((faculty, idx) => {
              const isSelected = faculty.hrmsEmployeeId === selectedHrmsId;
              const isCurrent =
                sectionInfo.currentTeacher?.hrmsEmployeeId === faculty.hrmsEmployeeId;

              return (
                <div
                  key={`${faculty.hrmsEmployeeId || faculty.staffLinkId || idx}-${idx}`}
                  onClick={() => setSelectedHrmsId(faculty.hrmsEmployeeId)}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all duration-150 ${
                    isSelected
                      ? "border-brand-600 bg-brand-50/60 ring-1 ring-brand-600 shadow-xs"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold text-xs uppercase ${
                        isSelected
                          ? "bg-brand-600 text-white"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {faculty.name.slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-navy-900 truncate">
                          {faculty.name}
                        </span>
                        {isCurrent ? (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Current
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        Emp #{faculty.hrmsEmployeeId}
                        {faculty.department ? ` • ${faculty.department}` : ""}
                        {faculty.designation ? ` • ${faculty.designation}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {faculty.assignedSectionsCount ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                        {faculty.assignedSectionsCount} sec assigned
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                        Available
                      </span>
                    )}

                    <div
                      className={`h-5 w-5 rounded-full flex items-center justify-center border transition-colors ${
                        isSelected
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {isSelected ? <Check className="h-3 w-3 stroke-[3]" /> : null}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-border px-5 py-3.5 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {selectedFaculty ? (
              <span>
                Selected: <strong className="text-navy-900">{selectedFaculty.name}</strong>
              </span>
            ) : (
              <span>Select a faculty to assign</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={assigning}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAssign}
              disabled={!selectedHrmsId || assigning}
            >
              {assigning ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Assigning...
                </>
              ) : (
                "Assign as Class Teacher"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
