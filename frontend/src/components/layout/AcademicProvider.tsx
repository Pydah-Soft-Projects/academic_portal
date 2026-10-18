"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { scopeAllowsBranch, scopeAllowsCollege } from "@/lib/teaching-scope";

export type AcademicMasters = {
  academicYears: { id: number; label: string; isActive: boolean }[];
  colleges: { id: number; name: string; code: string | null }[];
  courses: {
    id: number;
    name: string;
    code: string | null;
    collegeId: number;
    totalYears?: number;
    semestersPerYear?: number;
    yearSemesterConfig?: Array<{ year: number; semesters: number }>;
    yearOptions?: number[];
  }[];
  branches: {
    id: number;
    name: string;
    code: string | null;
    courseId: number;
    hasSections: boolean;
    sectionCount: number;
  }[];
  sections: {
    branchId: number;
    name: string;
    batch: string;
    studentCount: number;
    strength?: number | null;
  }[];
  batches: { branchId: number; batch: string }[];
  yearOptions: number[];
  semesterOptions: number[];
  defaults: {
    academicYear: string;
    collegeId: number | null;
    collegeName: string;
  };
};

function todayIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type AcademicFilters = {
  date: string;
  academicYear: string;
  collegeId: number | "all";
  courseId: number | "all";
  branchId: number | "all";
  batch: string | "all";
  year: number | "all";
  semester: number | "all";
  section: string | "all";
  studentStatus: string | "all";
  q: string;
};

export type StudentsListStats = {
  total: number;
  loaded: number;
  loading: boolean;
  loadingMore: boolean;
  avgAttendance: number | null;
  below75: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
};

export function getPageKey(pathname: string | null): string {
  if (!pathname || pathname === "/") return "/dashboard";
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "/dashboard";
  return `/${segments[0]}`;
}

export function computeInitialFilters(
  masters: AcademicMasters | null,
  authorization: any,
  saved?: Partial<AcademicFilters>,
): AcademicFilters {
  const defaultYear =
    masters?.defaults?.academicYear ||
    masters?.academicYears?.find((y) => y.isActive)?.label ||
    masters?.academicYears?.[0]?.label ||
    "";

  let defaultCollegeId: number | "all" = "all";
  if (!authorization?.scope?.isGlobal && masters?.colleges?.length === 1) {
    defaultCollegeId = masters.colleges[0]!.id;
  }

  const base: AcademicFilters = {
    date: todayIso(),
    academicYear: defaultYear,
    collegeId: defaultCollegeId,
    courseId: "all",
    branchId: "all",
    batch: "all",
    year: "all",
    semester: 1,
    section: "all",
    studentStatus: "Regular",
    q: "",
  };

  if (!saved) return base;

  const merged = { ...base, ...saved };

  // Validate saved academic year
  if (
    masters &&
    masters.academicYears &&
    masters.academicYears.length > 0 &&
    (!merged.academicYear ||
      !masters.academicYears.some((y) => y.label === merged.academicYear))
  ) {
    merged.academicYear = defaultYear;
  }

  // Scoped user to single college constraint
  if (defaultCollegeId !== "all") {
    merged.collegeId = defaultCollegeId;
  }

  return merged;
}

const STORAGE_PREFIX = "academic-portal-page-filters-v1:";

function readStoredPageFilters(pageKey: string): Partial<AcademicFilters> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`${STORAGE_PREFIX}${pageKey}`);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<AcademicFilters>;
  } catch {
    return null;
  }
}

function writeStoredPageFilters(pageKey: string, filters: AcademicFilters) {
  if (typeof window === "undefined") return;
  try {
    const { q: _q, ...persistable } = filters;
    window.sessionStorage.setItem(
      `${STORAGE_PREFIX}${pageKey}`,
      JSON.stringify(persistable),
    );
  } catch {
    /* ignore */
  }
}

type AcademicContextInternalValue = {
  masters: AcademicMasters | null;
  loading: boolean;
  getPageFilters: (pageKey: string) => AcademicFilters;
  setPageFilters: (pageKey: string, next: Partial<AcademicFilters>) => void;
  resetPageFilters: (pageKey: string) => void;
  studentsListStats: StudentsListStats | null;
  setStudentsListStats: (next: StudentsListStats | null) => void;
  filters: AcademicFilters;
  setFilters: (next: Partial<AcademicFilters>) => void;
  resetFilters: () => void;
};

export type AcademicContextValue = {
  masters: AcademicMasters | null;
  loading: boolean;
  filters: AcademicFilters;
  setFilters: (next: Partial<AcademicFilters>) => void;
  resetFilters: () => void;
  studentsListStats: StudentsListStats | null;
  setStudentsListStats: (next: StudentsListStats | null) => void;
  pageKey: string;
  getPageFilters: (pageKey: string) => AcademicFilters;
  setPageFilters: (pageKey: string, next: Partial<AcademicFilters>) => void;
  resetPageFilters: (pageKey: string) => void;
};

const AcademicContext = createContext<AcademicContextInternalValue | null>(null);

export function AcademicProvider({ children }: { children: React.ReactNode }) {
  const { authorization } = useAuth();
  const pathname = usePathname();
  const [masters, setMasters] = useState<AcademicMasters | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageFiltersState, setPageFiltersState] = useState<Record<string, AcademicFilters>>({});
  const [studentsListStats, setStudentsListStats] = useState<StudentsListStats | null>(null);
  const cachedFiltersRef = useRef<Record<string, AcademicFilters>>({});

  // Reset cached filter objects when masters or auth change so they recompute once with fresh catalog
  useEffect(() => {
    cachedFiltersRef.current = {};
  }, [masters, authorization]);

  // Clear obsolete global storage keys on startup
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem("academic-portal-filters-v4");
      window.localStorage.removeItem("academic-portal-filters-v3");
      window.localStorage.removeItem("academic-portal-filters-v2");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await apiFetch(`/catalog/masters`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Failed to load masters");
        const data = (await response.json()) as AcademicMasters;
        if (cancelled) return;

        const scopedColleges = (data.colleges ?? []).filter((college) =>
          scopeAllowsCollege(authorization, college.id),
        );
        const allowedCollegeIds = new Set(scopedColleges.map((college) => college.id));
        const scopedCourses = (data.courses ?? []).filter((course) =>
          allowedCollegeIds.has(course.collegeId),
        );
        const allowedCourseIds = new Set(scopedCourses.map((course) => course.id));
        const scopedBranches = (data.branches ?? []).filter(
          (branch) =>
            allowedCourseIds.has(branch.courseId) &&
            scopeAllowsBranch(authorization, branch.id),
        );
        const allowedBranchIds = new Set(scopedBranches.map((branch) => branch.id));
        const scopedBatches = (data.batches ?? []).filter((row) =>
          allowedBranchIds.has(row.branchId),
        );
        const scopedSections = (data.sections ?? []).filter((section) =>
          allowedBranchIds.has(section.branchId),
        );

        setMasters({
          ...data,
          colleges: scopedColleges,
          courses: scopedCourses,
          branches: scopedBranches,
          batches: scopedBatches,
          sections: scopedSections,
          yearOptions: data.yearOptions ?? [1, 2, 3, 4],
          semesterOptions: data.semesterOptions ?? [1, 2],
        });
      } catch {
        if (!cancelled) setMasters(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authorization]);

  const getPageFilters = useCallback(
    (pageKey: string): AcademicFilters => {
      if (pageFiltersState[pageKey]) {
        return pageFiltersState[pageKey];
      }
      if (cachedFiltersRef.current[pageKey]) {
        return cachedFiltersRef.current[pageKey];
      }
      const stored = readStoredPageFilters(pageKey);
      const computed = computeInitialFilters(masters, authorization, stored || undefined);
      cachedFiltersRef.current[pageKey] = computed;
      return computed;
    },
    [pageFiltersState, masters, authorization],
  );

  const setPageFilters = useCallback(
    (pageKey: string, next: Partial<AcademicFilters>) => {
      setPageFiltersState((prev) => {
        const current =
          prev[pageKey] ||
          cachedFiltersRef.current[pageKey] ||
          computeInitialFilters(
            masters,
            authorization,
            readStoredPageFilters(pageKey) || undefined,
          );
        const merged = { ...current, ...next };

        if (next.collegeId !== undefined && next.collegeId !== current.collegeId) {
          if (next.courseId === undefined) merged.courseId = "all";
          if (next.branchId === undefined) merged.branchId = "all";
          if (next.batch === undefined) merged.batch = "all";
          if (next.section === undefined) merged.section = "all";
        }
        if (next.courseId !== undefined && next.courseId !== current.courseId) {
          if (next.branchId === undefined) merged.branchId = "all";
          if (next.batch === undefined) merged.batch = "all";
          if (next.section === undefined) merged.section = "all";
        }
        if (next.branchId !== undefined && next.branchId !== current.branchId) {
          if (next.batch === undefined) merged.batch = "all";
          if (next.section === undefined) merged.section = "all";
        }

        cachedFiltersRef.current[pageKey] = merged;
        writeStoredPageFilters(pageKey, merged);
        return {
          ...prev,
          [pageKey]: merged,
        };
      });
    },
    [masters, authorization],
  );

  const resetPageFilters = useCallback(
    (pageKey: string) => {
      const initial = computeInitialFilters(masters, authorization);
      cachedFiltersRef.current[pageKey] = initial;
      writeStoredPageFilters(pageKey, initial);
      setPageFiltersState((prev) => ({
        ...prev,
        [pageKey]: initial,
      }));
    },
    [masters, authorization],
  );

  const currentPageKey = useMemo(() => getPageKey(pathname), [pathname]);
  const currentFilters = useMemo(
    () => getPageFilters(currentPageKey),
    [getPageFilters, currentPageKey],
  );

  const setFilters = useCallback(
    (next: Partial<AcademicFilters>) => {
      setPageFilters(currentPageKey, next);
    },
    [setPageFilters, currentPageKey],
  );

  const resetFilters = useCallback(() => {
    resetPageFilters(currentPageKey);
  }, [resetPageFilters, currentPageKey]);

  const value = useMemo<AcademicContextInternalValue>(
    () => ({
      masters,
      loading,
      getPageFilters,
      setPageFilters,
      resetPageFilters,
      studentsListStats,
      setStudentsListStats,
      filters: currentFilters,
      setFilters,
      resetFilters,
    }),
    [
      masters,
      loading,
      getPageFilters,
      setPageFilters,
      resetPageFilters,
      studentsListStats,
      setStudentsListStats,
      currentFilters,
      setFilters,
      resetFilters,
    ],
  );

  return (
    <AcademicContext.Provider value={value}>{children}</AcademicContext.Provider>
  );
}

export function useAcademicContext(customPageKey?: string): AcademicContextValue {
  const ctx = useContext(AcademicContext);
  if (!ctx) {
    throw new Error("useAcademicContext must be used within AcademicProvider");
  }
  const pathname = usePathname();
  const pageKey = customPageKey || getPageKey(pathname);

  const filters = ctx.getPageFilters(pageKey);
  const setFilters = useCallback(
    (next: Partial<AcademicFilters>) => {
      ctx.setPageFilters(pageKey, next);
    },
    [ctx, pageKey],
  );
  const resetFilters = useCallback(() => {
    ctx.resetPageFilters(pageKey);
  }, [ctx, pageKey]);

  return useMemo(
    () => ({
      masters: ctx.masters,
      loading: ctx.loading,
      filters,
      setFilters,
      resetFilters,
      studentsListStats: ctx.studentsListStats,
      setStudentsListStats: ctx.setStudentsListStats,
      pageKey,
      getPageFilters: ctx.getPageFilters,
      setPageFilters: ctx.setPageFilters,
      resetPageFilters: ctx.resetPageFilters,
    }),
    [
      ctx.masters,
      ctx.loading,
      ctx.studentsListStats,
      ctx.setStudentsListStats,
      ctx.getPageFilters,
      ctx.setPageFilters,
      ctx.resetPageFilters,
      filters,
      setFilters,
      resetFilters,
      pageKey,
    ],
  );
}
