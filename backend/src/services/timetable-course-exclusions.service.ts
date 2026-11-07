import type { RowDataPacket } from "mysql2";
import {
  executeAcademic,
  queryAcademic,
  queryStudent,
  withAcademicTransaction,
} from "../db/pools.js";

export type ExcludedCourseRecord = RowDataPacket & {
  course_id: number;
  college_id: number | null;
  course_name: string | null;
  course_code: string | null;
  reason: string | null;
  updated_at: string | null;
};

export type CourseExclusionItem = {
  id: number;
  name: string;
  code: string | null;
  collegeId: number;
  collegeName: string;
  collegeCode: string | null;
  totalYears: number | null;
  branchCount: number;
  branches: Array<{ id: number; name: string; code: string | null }>;
  isExcluded: boolean;
  reason: string | null;
  updatedAt: string | null;
  hasActiveTimetable: boolean;
  publishedTimetableCount: number;
  draftTimetableCount: number;
};

export type CourseExclusionsSettingsResponse = {
  courses: CourseExclusionItem[];
  excludedCourseIds: number[];
  totalCourses: number;
  excludedCount: number;
  activeCount: number;
  totalLiveTimetables: number;
  totalDraftTimetables: number;
};

let tableReady: Promise<void> | null = null;

export async function ensureExcludedCoursesTable(): Promise<void> {
  if (!tableReady) {
    tableReady = executeAcademic(`
      CREATE TABLE IF NOT EXISTS ap_timetable_excluded_courses (
        course_id INT NOT NULL PRIMARY KEY,
        college_id INT NULL,
        course_name VARCHAR(255) NULL,
        course_code VARCHAR(64) NULL,
        reason VARCHAR(255) NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_excluded_course_college (college_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).then(() => undefined);
  }
  await tableReady;
}

let cachedExcludedIds: { expiresAt: number; ids: Set<number> } | null = null;
const CACHE_TTL_MS = 60 * 1000;

export function invalidateExcludedCoursesCache(): void {
  cachedExcludedIds = null;
}

/**
 * Returns a Set of course IDs that are excluded from timetable planning.
 */
export async function getExcludedCourseIds(): Promise<Set<number>> {
  if (cachedExcludedIds && cachedExcludedIds.expiresAt > Date.now()) {
    return cachedExcludedIds.ids;
  }

  await ensureExcludedCoursesTable();
  const rows = await queryAcademic<ExcludedCourseRecord[]>(
    `SELECT course_id FROM ap_timetable_excluded_courses`,
  );
  const ids = new Set<number>(rows.map((r) => Number(r.course_id)).filter((id) => id > 0));

  cachedExcludedIds = {
    expiresAt: Date.now() + CACHE_TTL_MS,
    ids,
  };
  return ids;
}

/**
 * Check if a specific course is excluded from timetable planning.
 */
export async function isCourseExcludedFromTimetable(courseId: number | null | undefined): Promise<boolean> {
  if (!courseId || Number(courseId) <= 0) return false;
  const excluded = await getExcludedCourseIds();
  return excluded.has(Number(courseId));
}

/**
 * Loads course exclusion settings, listing all courses with their exclusion status.
 */
export async function getCourseExclusionsSettings(): Promise<CourseExclusionsSettingsResponse> {
  await ensureExcludedCoursesTable();

  const [rawCourses, rawBranches, rawExcluded, rawPlans] = await Promise.all([
    queryStudent<(RowDataPacket & {
      id: number;
      name: string;
      code: string | null;
      college_id: number;
      college_name: string;
      college_code: string | null;
      total_years: number | null;
    })[]>(`
      SELECT 
        c.id, c.name, c.code, c.college_id, c.total_years,
        col.name AS college_name, col.code AS college_code
      FROM courses c
      INNER JOIN colleges col ON col.id = c.college_id
      WHERE c.is_active = 1 OR c.is_active IS NULL
      ORDER BY col.name ASC, c.name ASC
    `),
    queryStudent<(RowDataPacket & {
      id: number;
      name: string;
      code: string | null;
      course_id: number;
    })[]>(`
      SELECT id, name, code, course_id
      FROM course_branches
      WHERE is_active = 1 OR is_active IS NULL
      ORDER BY name ASC
    `),
    queryAcademic<ExcludedCourseRecord[]>(`
      SELECT course_id, college_id, course_name, course_code, reason, updated_at
      FROM ap_timetable_excluded_courses
    `),
    queryAcademic<(RowDataPacket & {
      course_id: number;
      published_count: number | string;
      draft_count: number | string;
    })[]>(`
      SELECT 
        course_id,
        COALESCE(SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END), 0) AS published_count,
        COALESCE(SUM(CASE WHEN status IN ('draft', 'in_review') THEN 1 ELSE 0 END), 0) AS draft_count
      FROM ap_timetable_plans
      GROUP BY course_id
    `),
  ]);

  const excludedMap = new Map<number, ExcludedCourseRecord>();
  for (const row of rawExcluded) {
    excludedMap.set(Number(row.course_id), row);
  }

  const plansMap = new Map<number, { published: number; draft: number }>();
  let totalLiveTimetables = 0;
  let totalDraftTimetables = 0;
  for (const p of rawPlans) {
    const pub = Number(p.published_count || 0);
    const dft = Number(p.draft_count || 0);
    plansMap.set(Number(p.course_id), { published: pub, draft: dft });
    totalLiveTimetables += pub;
    totalDraftTimetables += dft;
  }

  const branchesByCourse = new Map<number, Array<{ id: number; name: string; code: string | null }>>();
  for (const b of rawBranches) {
    const list = branchesByCourse.get(Number(b.course_id)) ?? [];
    list.push({ id: Number(b.id), name: b.name, code: b.code ?? null });
    branchesByCourse.set(Number(b.course_id), list);
  }

  const courses: CourseExclusionItem[] = rawCourses.map((c) => {
    const cid = Number(c.id);
    const excludedRecord = excludedMap.get(cid);
    const branches = branchesByCourse.get(cid) ?? [];
    const planInfo = plansMap.get(cid) ?? { published: 0, draft: 0 };
    return {
      id: cid,
      name: c.name,
      code: c.code ?? null,
      collegeId: Number(c.college_id),
      collegeName: c.college_name,
      collegeCode: c.college_code ?? null,
      totalYears: c.total_years != null ? Number(c.total_years) : null,
      branchCount: branches.length,
      branches,
      isExcluded: Boolean(excludedRecord),
      reason: excludedRecord?.reason ?? null,
      updatedAt: excludedRecord?.updated_at ?? null,
      hasActiveTimetable: planInfo.published > 0,
      publishedTimetableCount: planInfo.published,
      draftTimetableCount: planInfo.draft,
    };
  });

  const excludedCourseIds = Array.from(excludedMap.keys());
  const excludedCount = courses.filter((c) => c.isExcluded).length;
  const activeCount = courses.length - excludedCount;

  return {
    courses,
    excludedCourseIds,
    totalCourses: courses.length,
    excludedCount,
    activeCount,
    totalLiveTimetables,
    totalDraftTimetables,
  };
}

/**
 * Saves timetable course exclusion choices.
 */
export async function saveCourseExclusions(input: {
  excludedCourseIds: number[];
  reasons?: Record<number, string>;
  actorUserId?: number | null;
  ipAddress?: string | null;
}): Promise<CourseExclusionsSettingsResponse> {
  await ensureExcludedCoursesTable();

  const uniqueCourseIds = Array.from(
    new Set((input.excludedCourseIds ?? []).map(Number).filter((id) => Number.isFinite(id) && id > 0)),
  );

  // Load course details from student DB for the selected IDs to snapshot names & colleges
  let courseDetails: (RowDataPacket & {
    id: number;
    name: string;
    code: string | null;
    college_id: number;
  })[] = [];

  if (uniqueCourseIds.length > 0) {
    const placeholders = uniqueCourseIds.map(() => "?").join(",");
    courseDetails = await queryStudent(`
      SELECT id, name, code, college_id
      FROM courses
      WHERE id IN (${placeholders})
    `, uniqueCourseIds);
  }

  const courseDetailsMap = new Map(courseDetails.map((c) => [Number(c.id), c]));

  await withAcademicTransaction(async (conn) => {
    await conn.query(`DELETE FROM ap_timetable_excluded_courses`);

    if (uniqueCourseIds.length > 0) {
      const placeholders = uniqueCourseIds.map(() => "(?, ?, ?, ?, ?)").join(", ");
      const params = uniqueCourseIds.flatMap((cid) => {
        const detail = courseDetailsMap.get(cid);
        const reason = input.reasons?.[cid]?.trim() || null;
        return [
          cid,
          detail?.college_id ?? null,
          detail?.name ?? null,
          detail?.code ?? null,
          reason,
        ];
      });

      await conn.query(
        `
        INSERT INTO ap_timetable_excluded_courses
          (course_id, college_id, course_name, course_code, reason)
        VALUES ${placeholders}
        `,
        params,
      );
    }
  });

  invalidateExcludedCoursesCache();
  return getCourseExclusionsSettings();
}

