"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { FilterBar, FilterField } from "@/components/ui/FilterBar";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAcademicContext, type AcademicFilters } from "@/components/layout/AcademicProvider";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";
import { CombineSectionsModal } from "@/features/timetables/CombineSectionsModal";
import { SectionMultiSelectFilter } from "@/features/timetables/SectionMultiSelectFilter";
import { CheckCircle2 } from "lucide-react";

const selectClassName =
  "h-11 sm:h-9 w-full sm:w-auto sm:min-w-[140px] rounded-md border border-border bg-white px-2 text-sm text-foreground outline-none focus:border-navy-800";

const searchClassName =
  "h-11 sm:h-9 w-full sm:min-w-[220px] rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none focus:border-navy-800";

type Props = {
  title?: string;
  hideBatch?: boolean;
  hideSection?: boolean;
  pageKey?: string;
  filters?: AcademicFilters;
  setFilters?: (next: Partial<AcademicFilters>) => void;
  resetFilters?: () => void;
};

export function AcademicFilterBar({
  title = "Filters",
  hideBatch,
  hideSection,
  pageKey,
  filters: propFilters,
  setFilters: propSetFilters,
  resetFilters: propResetFilters,
}: Props) {
  const pathname = usePathname();
  const context = useAcademicContext(pageKey);
  const filters = propFilters ?? context.filters;
  const setFilters = propSetFilters ?? context.setFilters;
  const resetFilters = propResetFilters ?? context.resetFilters;
  const { masters, loading, studentsListStats } = context;
  const { authorization } = useAuth();
  const [searchDraft, setSearchDraft] = useState(filters.q);
  const [studentStatuses, setStudentStatuses] = useState<string[]>([]);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [combineModalOpen, setCombineModalOpen] = useState(false);
  const [combineTickedSections, setCombineTickedSections] = useState<string[]>([]);
  const [combineSuccessMessage, setCombineSuccessMessage] = useState<string | null>(null);

  const isTodayTimetable =
    pathname === "/today-timetable" || pathname.startsWith("/today-timetable/");
  const isAttendancePosting =
    pathname === "/attendance-posting" || pathname.startsWith("/attendance-posting");
  const shouldHideBatch = true;
  const shouldHideSection = Boolean(hideSection) || isTodayTimetable || isAttendancePosting;

  const isStudentDetail = pathname.startsWith("/students/") && pathname !== "/students";
  const isMentoringDetail = pathname.startsWith("/mentoring-risks/") && pathname !== "/mentoring-risks";
  const isAttendanceSession = pathname.startsWith("/attendance-posting/") && pathname !== "/attendance-posting";

  // Hide filters on detail pages unconditionally
  const hidden = isStudentDetail || isMentoringDetail || isAttendanceSession;
  const showSearch = pathname === "/students" || pageKey === "/students";
  const isMentoringPage = pathname === "/mentoring-risks" || pageKey === "/mentoring-risks";
  const showStudentQuerySearch = showSearch || isMentoringPage;
  const isTimetablesPage =
    pathname === "/timetables" ||
    pathname.startsWith("/timetables/") ||
    isTodayTimetable ||
    pageKey === "/timetables";
  const isAttendanceAnalytics =
    pathname === "/attendance-analytics" ||
    pathname.startsWith("/attendance-analytics") ||
    pageKey === "/attendance-analytics";
  const usesBatchProgressYear = false;

  useEffect(() => {
    setSearchDraft(filters.q);
  }, [filters.q]);

  useEffect(() => {
    if (!showSearch) return;
    let cancelled = false;
    async function loadStatuses() {
      try {
        const response = await apiFetch(`/students/statuses`, {
          cache: "no-store",
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || cancelled) return;
        const statuses = (body as { data?: string[] }).data ?? [];
        setStudentStatuses(statuses);
      } catch {
        if (!cancelled) setStudentStatuses([]);
      }
    }
    void loadStatuses();
    return () => {
      cancelled = true;
    };
  }, [showSearch]);

  // Students page: auto-select Regular when landing with All / empty status.
  useEffect(() => {
    if (!showSearch) return;
    if (filters.studentStatus !== "all" && Boolean(filters.studentStatus)) return;
    setFilters({ studentStatus: "Regular" });
    // Intentionally only when entering Students (showSearch flips true).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSearch]);

  useEffect(() => {
    if (!showStudentQuerySearch) return;
    const timer = window.setTimeout(() => {
      const next = searchDraft.trim();
      if (next !== filters.q) setFilters({ q: next });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchDraft, showStudentQuerySearch, filters.q, setFilters]);

  const isGlobalScope = authorization?.scope?.isGlobal ?? true;
  const showAllColleges = isGlobalScope && (masters?.colleges.length ?? 0) > 1;

  const coursesForCollege = useMemo(() => {
    if (!masters) return [];
    if (filters.collegeId === "all") return masters.courses;
    return masters.courses.filter((course) => course.collegeId === filters.collegeId);
  }, [masters, filters.collegeId]);

  const branchesForCourse = useMemo(() => {
    if (!masters) return [];
    if (filters.courseId === "all") {
      const allowed = new Set(coursesForCollege.map((c) => c.id));
      return masters.branches.filter((branch) => allowed.has(branch.courseId));
    }
    return masters.branches.filter((branch) => branch.courseId === filters.courseId);
  }, [masters, filters.courseId, coursesForCollege]);

  const selectedBranch =
    filters.branchId === "all"
      ? null
      : branchesForCourse.find((branch) => branch.id === filters.branchId) ?? null;

  const selectedCourse =
    filters.courseId === "all"
      ? null
      : coursesForCollege.find((course) => course.id === filters.courseId) ?? null;

  const selectedCollege =
    filters.collegeId === "all" || !masters
      ? null
      : masters.colleges.find((c) => c.id === filters.collegeId) ?? null;

  const batchesForBranch = useMemo(() => {
    if (!masters || !selectedBranch) return [];
    const values = new Set<string>();
    for (const row of masters.batches ?? []) {
      if (row.branchId === selectedBranch.id) values.add(row.batch);
    }
    return Array.from(values).sort((a, b) => b.localeCompare(a));
  }, [masters, selectedBranch]);

  const effectiveCourse = useMemo(() => {
    if (selectedCourse) return selectedCourse;
    if (selectedBranch && masters) {
      return masters.courses.find((c) => c.id === selectedBranch.courseId) ?? null;
    }
    return null;
  }, [selectedCourse, selectedBranch, masters]);

  const yearOptionsForCourse = useMemo(() => {
    if (effectiveCourse?.yearOptions?.length) return effectiveCourse.yearOptions;
    if (effectiveCourse?.totalYears) {
      return Array.from({ length: effectiveCourse.totalYears }, (_, i) => i + 1);
    }
    return masters?.yearOptions ?? [1, 2, 3, 4];
  }, [effectiveCourse, masters?.yearOptions]);

  const semesterOptionsForCourse = useMemo(() => {
    if (
      effectiveCourse?.yearSemesterConfig?.length &&
      filters.year !== "all"
    ) {
      const match = effectiveCourse.yearSemesterConfig.find(
        (item) => item.year === filters.year,
      );
      if (match) {
        return Array.from({ length: match.semesters }, (_, i) => i + 1);
      }
    }
    const perYear = effectiveCourse?.semestersPerYear ?? 2;
    return Array.from({ length: perYear }, (_, i) => i + 1);
  }, [effectiveCourse, filters.year]);

  const sectionsForBranch = useMemo(() => {
    if (!masters || !selectedBranch) return [];
    const names = new Set<string>();
    for (const section of masters.sections) {
      if (section.branchId === selectedBranch.id) names.add(section.name);
    }
    return Array.from(names).sort();
  }, [masters, selectedBranch]);

  const showSectionFilter = Boolean(
    selectedBranch?.hasSections && sectionsForBranch.length > 0,
  );

  // If the branch does not have sections, ensure section filter state is reset to 'all'
  useEffect(() => {
    if (!showSectionFilter && filters.section !== "all") {
      setFilters({ section: "all" });
    }
  }, [showSectionFilter, filters.section, setFilters]);

  const autoYearSemesterFromBatch = false;
  const showYearSemesterFilters = true;

  const readOnlyFieldClassName =
    "flex h-11 sm:h-9 w-full sm:w-auto sm:min-w-[140px] items-center rounded-md border border-border bg-slate-50 px-2 text-sm text-slate-700";

  if (hidden) return null;

  const stats = showSearch ? studentsListStats : null;

  return (
    <div className={showSearch ? "mb-2" : "mb-4"}>
      {stats ? (
        <div className="mb-2 grid w-full grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          <StatChip
            label="Total students"
            value={
              stats.loading && stats.total === 0
                ? "…"
                : stats.total.toLocaleString("en-IN")
            }
            hint={
              stats.loaded < stats.total
                ? `Showing ${stats.loaded.toLocaleString("en-IN")} of ${stats.total.toLocaleString("en-IN")}`
                : "In current filters"
            }
          />
          <StatChip
            label="Avg attendance"
            value={
              stats.loading && stats.avgAttendance == null
                ? "…"
                : stats.avgAttendance == null
                  ? "—"
                  : `${stats.avgAttendance}%`
            }
            hint="In current filters"
            tone="info"
          />
          <StatChip
            label="Below 75%"
            value={
              stats.loading && stats.total === 0
                ? "…"
                : stats.below75.toLocaleString("en-IN")
            }
            hint="Attendance under 75%"
            tone="warning"
          />
          <StatChip
            label="High risk"
            value={
              stats.loading && stats.total === 0
                ? "…"
                : stats.highRisk.toLocaleString("en-IN")
            }
            hint="Attendance under 65%"
            tone="critical"
          />
          <StatChip
            label="Medium risk"
            value={
              stats.loading && stats.total === 0
                ? "…"
                : stats.mediumRisk.toLocaleString("en-IN")
            }
            hint="Attendance 65–74%"
            tone="warning"
          />
          <StatChip
            label="Low risk"
            value={
              stats.loading && stats.total === 0
                ? "…"
                : stats.lowRisk.toLocaleString("en-IN")
            }
            hint="Attendance 75% and above"
            tone="success"
          />
        </div>
      ) : null}

      {!showSearch ? (
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {title}
          </p>
          <Button type="button" size="sm" variant="ghost" onClick={resetFilters}>
            Reset
          </Button>
        </div>
      ) : (
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </p>
      )}

      {showSearch ? (
        <div className="mb-0 flex flex-col gap-2.5 rounded-lg border border-border bg-card p-3">
          {/* Mobile Search & Filter toggle button */}
          <div className="flex items-end gap-2 w-full sm:hidden">
            <div className="flex-1 min-w-0">
              <FilterField label="Search">
                <input
                  type="search"
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  placeholder="Admission no, name, section"
                  className={searchClassName}
                  aria-label="Search students"
                />
              </FilterField>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="h-9 px-3 text-xs"
              onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
            >
              {mobileFiltersOpen ? "Hide Filters" : "Filters"}
            </Button>
          </div>

          <div className={`w-full flex-col gap-2.5 ${mobileFiltersOpen ? "flex" : "hidden sm:flex"}`}>
            {/* ROW 1: Search & Primary Academic Scope */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-2.5 w-full">
              <div className="hidden sm:block flex-1 min-w-[200px]">
                <FilterField label="Search">
                  <input
                    type="search"
                    value={searchDraft}
                    onChange={(e) => setSearchDraft(e.target.value)}
                    placeholder="Admission no, name, section"
                    className={searchClassName}
                    aria-label="Search students"
                  />
                </FilterField>
              </div>

              <FilterField label="Academic Year">
                <select
                  className={selectClassName}
                  value={filters.academicYear || "2026-2027"}
                  disabled={loading || !masters}
                  onChange={(e) => setFilters({ academicYear: e.target.value })}
                >
                  {(masters?.academicYears ?? []).length === 0 ? (
                    <option value={filters.academicYear || "2026-2027"}>
                      {filters.academicYear || "2026-2027"}
                    </option>
                  ) : (
                    (masters?.academicYears ?? []).map((year) => (
                      <option key={year.id} value={year.label}>
                        {year.label}
                      </option>
                    ))
                  )}
                </select>
              </FilterField>

              <FilterField label="College">
                <select
                  className={selectClassName}
                  value={filters.collegeId === "all" ? "all" : String(filters.collegeId)}
                  disabled={loading || !masters}
                  onChange={(e) =>
                    setFilters({
                      collegeId: e.target.value === "all" ? "all" : Number(e.target.value),
                    })
                  }
                >
                  {showAllColleges ? <option value="all">All Colleges</option> : null}
                  {(masters?.colleges ?? []).length === 0 && filters.collegeId !== "all" ? (
                    <option value={String(filters.collegeId)}>
                      {loading ? "Loading..." : "Assigned College"}
                    </option>
                  ) : (
                    (masters?.colleges ?? []).map((college) => (
                      <option key={college.id} value={college.id}>
                        {college.name}
                      </option>
                    ))
                  )}
                </select>
              </FilterField>

              <FilterField label="Course">
                <select
                  className={selectClassName}
                  value={filters.courseId === "all" ? "all" : String(filters.courseId)}
                  disabled={loading || !masters}
                  onChange={(e) => {
                    const cId = e.target.value === "all" ? "all" : Number(e.target.value);
                    const newCourse = cId !== "all" ? coursesForCollege.find((c) => c.id === cId) : null;
                    const maxYears = newCourse?.totalYears ?? 4;
                    const currentYearNum = typeof filters.year === "number" ? filters.year : 1;
                    const validYear = isTimetablesPage
                      ? (currentYearNum <= maxYears ? currentYearNum : 1)
                      : "all";
                    const startYear = parseInt(String(filters.academicYear || "2026-2027").slice(0, 4), 10);
                    const validBatch = isTimetablesPage && typeof validYear === "number" && !isNaN(startYear)
                      ? String(startYear - (validYear - 1))
                      : "all";
                    setFilters({
                      courseId: cId,
                      branchId: "all",
                      section: "all",
                      year: validYear,
                      semester: isTimetablesPage ? (filters.semester === "all" ? 1 : filters.semester) : "all",
                      batch: validBatch,
                    });
                  }}
                >
                  <option value="all">All Courses</option>
                  {coursesForCollege.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Branch">
                <select
                  className={selectClassName}
                  value={filters.branchId === "all" ? "all" : String(filters.branchId)}
                  disabled={loading || !masters}
                  onChange={(e) => {
                    const bId = e.target.value === "all" ? "all" : Number(e.target.value);
                    const branchObj = bId !== "all" ? masters?.branches.find((b) => b.id === bId) : null;
                    const sectionsForThisBranch = bId !== "all"
                      ? masters?.sections.filter((s) => s.branchId === bId).map((s) => s.name) ?? []
                      : [];
                    const defaultSection = branchObj?.hasSections
                      ? filters.section !== "all" && sectionsForThisBranch.includes(filters.section)
                        ? filters.section
                        : "all"
                      : "all";
                    setFilters({
                      branchId: bId,
                      section: defaultSection,
                    });
                  }}
                >
                  <option value="all">All Branches</option>
                  {branchesForCourse.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.hasSections
                        ? `${branch.name} (${branch.sectionCount} section${
                            branch.sectionCount === 1 ? "" : "s"
                          })`
                        : `${branch.name} (no section)`}
                    </option>
                  ))}
                </select>
              </FilterField>
            </div>

            {/* ROW 2: Batch, Year, Semester, Section, Status & Reset */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-2.5 w-full pt-0.5">
              {!shouldHideBatch && (
                <FilterField label="Batch">
                  <select
                    className={selectClassName}
                    value={filters.batch === "all" ? "all" : filters.batch}
                    disabled={loading || !masters || !selectedBranch}
                    onChange={(e) => {
                      const nextBatch = e.target.value === "all" ? "all" : e.target.value;
                      setFilters({
                        batch: nextBatch,
                        ...(showSearch && nextBatch !== "all"
                          ? { year: "all" as const, semester: "all" as const }
                          : {}),
                      });
                    }}
                  >
                    <option value="all">All Batches</option>
                    {batchesForBranch.map((batch) => (
                      <option key={batch} value={batch}>
                        {batch}
                      </option>
                    ))}
                  </select>
                </FilterField>
              )}

              {showYearSemesterFilters ? (
                <>
                  <FilterField label="Year">
                    <select
                      className={selectClassName}
                      value={filters.year === "all" ? "all" : String(filters.year)}
                      disabled={loading || !masters}
                      onChange={(e) => {
                        const nextYear = e.target.value === "all" ? "all" : Number(e.target.value);
                        const startYear = parseInt(String(filters.academicYear || "2026-2027").slice(0, 4), 10);
                        const nextBatch = typeof nextYear === "number" && !isNaN(startYear)
                          ? String(startYear - (nextYear - 1))
                          : "all";
                        setFilters({
                          year: nextYear,
                          semester: isTimetablesPage ? (filters.semester === "all" ? 1 : filters.semester) : "all",
                          ...(nextBatch !== "all" ? { batch: nextBatch } : {}),
                        });
                      }}
                    >
                      <option value="all">All Years</option>
                      {yearOptionsForCourse.map((year) => (
                        <option key={year} value={year}>
                          Year {year}
                        </option>
                      ))}
                    </select>
                  </FilterField>

                  <FilterField label="Semester">
                    <select
                      className={selectClassName}
                      value={filters.semester === "all" ? "all" : String(filters.semester)}
                      disabled={loading || !masters}
                      onChange={(e) =>
                        setFilters({
                          semester: e.target.value === "all" ? "all" : Number(e.target.value),
                        })
                      }
                    >
                      <option value="all">All Semesters</option>
                      {semesterOptionsForCourse.map((semester) => (
                        <option key={semester} value={semester}>
                          Semester {semester}
                        </option>
                      ))}
                    </select>
                  </FilterField>
                </>
              ) : null}

              {!shouldHideSection && showSectionFilter ? (
                <FilterField label="Section">
                  {isTimetablesPage ? (
                    <SectionMultiSelectFilter
                      sections={sectionsForBranch}
                      currentSection={filters.section}
                      disabled={loading || !masters}
                      onChangeSection={(sec) => setFilters({ section: sec })}
                      onOpenCombine={(ticked) => {
                        setCombineTickedSections(ticked ?? []);
                        setCombineModalOpen(true);
                      }}
                    />
                  ) : (
                    <select
                      className={selectClassName}
                      value={filters.section}
                      disabled={loading || !masters}
                      onChange={(e) =>
                        setFilters({
                          section: e.target.value === "all" ? "all" : e.target.value,
                        })
                      }
                    >
                      <option value="all">All Sections</option>
                      {sectionsForBranch.map((section) => (
                        <option key={section} value={section}>
                          {section}
                        </option>
                      ))}
                    </select>
                  )}
                </FilterField>
              ) : null}

              <FilterField label="Student Status">
                <select
                  className={selectClassName}
                  value={filters.studentStatus === "all" ? "all" : filters.studentStatus}
                  onChange={(e) =>
                    setFilters({
                      studentStatus: e.target.value === "all" ? "all" : e.target.value,
                    })
                  }
                >
                  <option value="all">All Statuses</option>
                  {studentStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </FilterField>

              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={resetFilters}
                className="h-9 shrink-0 px-4 w-full sm:w-auto"
              >
                Reset
              </Button>
            </div>
          </div>
        </div>
      ) : (
      <FilterBar className="mb-0 items-end">
        {isMentoringPage ? (
          <FilterField label="Search student">
            <input
              type="search"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Name, roll no., admission no."
              className={searchClassName}
              aria-label="Search students"
            />
          </FilterField>
        ) : null}

        <FilterField label="Academic Year">
          <select
            className={selectClassName}
            value={filters.academicYear || "2026-2027"}
            disabled={loading || !masters}
            onChange={(e) => setFilters({ academicYear: e.target.value })}
          >
            {(masters?.academicYears ?? []).length === 0 ? (
              <option value={filters.academicYear || "2026-2027"}>
                {filters.academicYear || "2026-2027"}
              </option>
            ) : (
              (masters?.academicYears ?? []).map((year) => (
                <option key={year.id} value={year.label}>
                  {year.label}
                </option>
              ))
            )}
          </select>
        </FilterField>

        <FilterField label="College">
          <select
            className={selectClassName}
            value={filters.collegeId === "all" ? "all" : String(filters.collegeId)}
            disabled={loading || !masters}
            onChange={(e) =>
              setFilters({
                collegeId: e.target.value === "all" ? "all" : Number(e.target.value),
              })
            }
          >
            {showAllColleges ? <option value="all">All Colleges</option> : null}
            {(masters?.colleges ?? []).length === 0 && filters.collegeId !== "all" ? (
              <option value={String(filters.collegeId)}>
                {loading ? "Loading..." : "Assigned College"}
              </option>
            ) : (
              (masters?.colleges ?? []).map((college) => (
                <option key={college.id} value={college.id}>
                  {college.name}
                </option>
              ))
            )}
          </select>
        </FilterField>

        <FilterField label="Course">
          <select
            className={selectClassName}
            value={filters.courseId === "all" ? "all" : String(filters.courseId)}
            disabled={loading || !masters}
            onChange={(e) => {
              const cId = e.target.value === "all" ? "all" : Number(e.target.value);
              const newCourse = cId !== "all" ? coursesForCollege.find((c) => c.id === cId) : null;
              const maxYears = newCourse?.totalYears ?? 4;
              const currentYearNum = typeof filters.year === "number" ? filters.year : 1;
              const validYear = isTimetablesPage
                ? (currentYearNum <= maxYears ? currentYearNum : 1)
                : "all";
              const startYear = parseInt(String(filters.academicYear || "2026-2027").slice(0, 4), 10);
              const validBatch = isTimetablesPage && typeof validYear === "number" && !isNaN(startYear)
                ? String(startYear - (validYear - 1))
                : "all";
              setFilters({
                courseId: cId,
                branchId: "all",
                section: "all",
                year: validYear,
                semester: isTimetablesPage ? (filters.semester === "all" ? 1 : filters.semester) : "all",
                batch: validBatch,
              });
            }}
          >
            <option value="all">All Courses</option>
            {coursesForCollege.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Branch">
          <select
            className={selectClassName}
            value={filters.branchId === "all" ? "all" : String(filters.branchId)}
            disabled={loading || !masters}
            onChange={(e) => {
              const bId = e.target.value === "all" ? "all" : Number(e.target.value);
              if (bId === "all") {
                setFilters({ branchId: "all", section: "all" });
                return;
              }
              const branchObj = masters?.branches.find((b) => b.id === bId);
              const matchingCourseId = branchObj?.courseId ?? filters.courseId;
              const sectionsForThisBranch =
                masters?.sections.filter((s) => s.branchId === bId).map((s) => s.name) ?? [];
              const defaultSection = branchObj?.hasSections
                ? filters.section !== "all" && sectionsForThisBranch.includes(filters.section)
                  ? filters.section
                  : "all"
                : "all";

              const nextYear = isTimetablesPage && filters.year === "all" ? 1 : filters.year;
              const startYear = parseInt(String(filters.academicYear || "2026-2027").slice(0, 4), 10);
              const nextBatch = typeof nextYear === "number" && !isNaN(startYear)
                ? String(startYear - (nextYear - 1))
                : "all";

              setFilters({
                branchId: bId,
                courseId: matchingCourseId,
                batch: nextBatch,
                section: defaultSection,
                ...(isTimetablesPage
                  ? {
                      year: nextYear,
                      semester: filters.semester === "all" ? 1 : filters.semester,
                    }
                  : {}),
              });
            }}
          >
            <option value="all">All Branches</option>
            {branchesForCourse.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.hasSections
                  ? `${branch.name} (${branch.sectionCount} section${
                      branch.sectionCount === 1 ? "" : "s"
                    })`
                  : `${branch.name} (no section)`}
              </option>
            ))}
          </select>
        </FilterField>

        {!shouldHideBatch && (
          <FilterField label="Batch">
            <select
              className={selectClassName}
              value={filters.batch === "all" ? "all" : filters.batch}
              disabled={loading || !masters || !selectedBranch}
              onChange={(e) => {
                const nextBatch = e.target.value === "all" ? "all" : e.target.value;
                setFilters({
                  batch: nextBatch,
                  ...(usesBatchProgressYear
                    ? { year: "all" as const, semester: "all" as const }
                    : {}),
                });
              }}
            >
              <option value="all">All Batches</option>
              {batchesForBranch.map((batch) => (
                <option key={batch} value={batch}>
                  {batch}
                </option>
              ))}
            </select>
          </FilterField>
        )}



        {showYearSemesterFilters ? (
          <>
            <FilterField label="Year">
              <select
                className={selectClassName}
                value={filters.year === "all" ? "all" : String(filters.year)}
                disabled={loading || !masters}
                onChange={(e) => {
                  const nextYear = e.target.value === "all" ? "all" : Number(e.target.value);
                  const startYear = parseInt(String(filters.academicYear || "2026-2027").slice(0, 4), 10);
                  const nextBatch = typeof nextYear === "number" && !isNaN(startYear)
                    ? String(startYear - (nextYear - 1))
                    : "all";
                  setFilters({
                    year: nextYear,
                    semester: isTimetablesPage ? (filters.semester === "all" ? 1 : filters.semester) : "all",
                    ...(nextBatch !== "all" ? { batch: nextBatch } : {}),
                  });
                }}
              >
                <option value="all">All Years</option>
                {yearOptionsForCourse.map((year) => (
                  <option key={year} value={year}>
                    Year {year}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="Semester">
              <select
                className={selectClassName}
                value={filters.semester === "all" ? "all" : String(filters.semester)}
                disabled={loading || !masters}
                onChange={(e) =>
                  setFilters({
                    semester: e.target.value === "all" ? "all" : Number(e.target.value),
                  })
                }
              >
                <option value="all">All Semesters</option>
                {semesterOptionsForCourse.map((semester) => (
                  <option key={semester} value={semester}>
                    Semester {semester}
                  </option>
                ))}
              </select>
            </FilterField>
          </>
        ) : null}

        {!shouldHideSection && showSectionFilter ? (
          <FilterField label="Section">
            {isTimetablesPage ? (
              <SectionMultiSelectFilter
                sections={sectionsForBranch}
                currentSection={filters.section}
                disabled={loading || !masters}
                onChangeSection={(sec) => setFilters({ section: sec })}
                onOpenCombine={(ticked) => {
                  setCombineTickedSections(ticked ?? []);
                  setCombineModalOpen(true);
                }}
              />
            ) : (
              <select
                className={selectClassName}
                value={filters.section}
                disabled={loading || !masters}
                onChange={(e) =>
                  setFilters({
                    section: e.target.value === "all" ? "all" : e.target.value,
                  })
                }
              >
                <option value="all">All Sections</option>
                {sectionsForBranch.map((section) => (
                  <option key={section} value={section}>
                    {section}
                  </option>
                ))}
              </select>
            )}
          </FilterField>
        ) : null}
      </FilterBar>
      )}

      {selectedBranch && !showSectionFilter && !shouldHideSection ? (
        <p className="mt-1 text-xs text-slate-500">
          Selected branch has no sections — filters apply at branch level.
        </p>
      ) : null}
      {selectedCourse?.totalYears && !showSearch ? (
        <p className="mt-1 text-xs text-slate-400">
          {selectedCourse.name}: {selectedCourse.totalYears} year
          {selectedCourse.totalYears === 1 ? "" : "s"}
          {selectedCourse.semestersPerYear
            ? ` · ${selectedCourse.semestersPerYear} semester${
                selectedCourse.semestersPerYear === 1 ? "" : "s"
              }/year`
            : ""}
        </p>
      ) : null}

      {combineSuccessMessage && (
        <div className="mt-2.5 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{combineSuccessMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setCombineSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {isTimetablesPage && (
        <CombineSectionsModal
          isOpen={combineModalOpen}
          onClose={() => setCombineModalOpen(false)}
          availableSections={sectionsForBranch}
          initialTickedSections={combineTickedSections}
          currentSection={filters.section}
          context={{
            collegeId: filters.collegeId,
            courseId: filters.courseId,
            branchId: filters.branchId,
            academicYear: filters.academicYear,
            batch: filters.batch,
            year: filters.year,
            semester: filters.semester,
            collegeName: selectedCollege?.name,
            courseName: selectedCourse?.name,
            branchName: selectedBranch?.name,
          }}
          onSuccess={(mainSec, targetSecs) => {
            setCombineSuccessMessage(
              `Timetable combined! Section ${targetSecs.join(", ")} now has the identical schedule as Section ${mainSec}.`,
            );
            setTimeout(() => setCombineSuccessMessage(null), 8000);
            setFilters({ section: targetSecs[0] ?? mainSec });
          }}
        />
      )}
    </div>
  );
}

function StatChip({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "info" | "success" | "warning" | "critical";
}) {
  const toneClass =
    tone === "info"
      ? "border-sky-200 bg-sky-50/60"
      : tone === "success"
        ? "border-green-200 bg-green-50/60"
        : tone === "warning"
          ? "border-amber-200 bg-amber-50/60"
          : tone === "critical"
            ? "border-red-200 bg-red-50/60"
            : "border-border bg-card";

  return (
    <div className={`w-full rounded-lg border px-3 py-2 shadow-sm ${toneClass}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums leading-tight text-navy-900">
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[10px] leading-tight text-slate-500">{hint}</p> : null}
    </div>
  );
}
