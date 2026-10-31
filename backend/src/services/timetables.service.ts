import type { RowDataPacket } from "mysql2";
import {
  executeAcademic,
  getHrmsDb,
  queryAcademic,
  queryExam,
  queryStudent,
  withAcademicTransaction,
} from "../db/pools.js";
import {
  DAY_CODE_TO_LABEL,
  DAY_LABEL_TO_CODE,
  getActiveTimingForContext,
  getTimingTemplateDetail,
  listTimingSlots,
  type DayCode,
} from "./timing.service.js";
import {
  extractHrmsStaffProfile,
  HRMS_EMPLOYEE_PROJECTION,
  isTeachingGroup,
  loadHrmsOrgLookups,
} from "./hrms-staff.service.js";
import {
  employeeMatchesFacultyGroupFilter,
  getFacultyGroupFilter,
} from "./portal-settings.service.js";
import {
  ensureStaffUserForSubjectAssignment,
  syncStaffUserRolesForTimetableChanges,
} from "./user-management.service.js";
import { ensureSessionsForDate } from "./class-sessions.service.js";
import { getCurrentAcademicYearLabel, parseBranchSections } from "./masters.service.js";
import { getClassTeacherForSection } from "./class-teacher.service.js";
import type { PoolConnection } from "mysql2/promise";

export type TimetablePlannerFilters = {
  collegeId?: number;
  collegeIds?: number[];
  courseId?: number;
  branchId?: number;
  branchIds?: number[];
  section?: string;
  batch?: string;
  year?: number;
  semester?: number;
  academicYear?: string;
  statuses?: string[];
  preferPublished?: boolean;
};

type ContextRow = RowDataPacket & {
  college_id: number;
  college_name: string;
  course_id: number;
  course_name: string;
  branch_id: number;
  branch_name: string;
  metadata: unknown;
};

type PlanRow = RowDataPacket & {
  id: number;
  academic_year_label: string;
  college_id: number;
  course_id: number;
  branch_id: number;
  batch: string;
  year_of_study: number | null;
  semester_number: number | null;
  section_name: string | null;
  timing_template_id: number | null;
  status: string;
  version_no: number;
  notes: string | null;
};

type EntryRow = RowDataPacket & {
  id: number;
  plan_id: number;
  day_of_week: DayCode;
  timing_slot_id: number | null;
  period_slot_id: number;
  subject_id: number | null;
  subject_code: string | null;
  subject_name: string | null;
  subject_type_snapshot: string | null;
  entry_type: string;
  faculty_staff_link_id: number | null;
  room_label: string | null;
  batch_label?: string | null;
  student_ids?: number[] | string | null;
  student_count?: number | null;
  weekly_rotation?: number | boolean | null;
  rotation_pattern?: string | null;
  custom_label: string | null;
  faculty_name?: string | null;
  faculty_hrms_id?: string | null;
  faculty_employee_code?: string | null;
  faculty_department_name?: string | null;
};

export type AssignmentInput = {
  dayOfWeek: DayCode | string;
  timingSlotId: number;
  subjectId?: number | null;
  subjectCode?: string | null;
  subjectName?: string | null;
  subjectTypeSnapshot?: string | null;
  entryType?: "theory" | "lab" | "other";
  facultyStaffLinkId?: number | null;
  hrmsEmployeeId?: string | null;
  facultyName?: string | null;
  roomLabel?: string | null;
  /** Classification or batch tag (e.g. Batch 1, Batch 2) */
  batchLabel?: string | null;
  /** Array of student IDs assigned to this batch */
  studentIds?: number[] | null;
  /** Total count of students assigned to this batch */
  studentCount?: number | null;
  /** Whether this split slot rotates batches weekly (Batch 1 <-> Batch 2 alternate weeks) */
  weeklyRotation?: boolean | number | null;
  /** 4-week monthly rotation pattern: e.g. "1,2,1,2" (W1, W2, W3, W4) */
  rotationPattern?: string | null;
  /** Label for free/special periods (CRT, Games, Library, etc.) */
  customLabel?: string | null;
  /** Specific branches this assignment applies to in combined timetable */
  participatingBranchIds?: number[] | null;
};

/** Free/special period: labeled activity without an EMS subject (CRT, Games, etc.). */
export function isFreePeriodAssignment(a: {
  subjectId?: number | null;
  customLabel?: string | null;
}): boolean {
  const label = (a.customLabel ?? "").trim();
  const subjectId = a.subjectId == null ? 0 : Number(a.subjectId);
  return label.length > 0 && (!Number.isFinite(subjectId) || subjectId <= 0);
}

export function isAssignedEntry(entry: {
  subject_id?: number | null;
  faculty_staff_link_id?: number | null;
  custom_label?: string | null;
}): boolean {
  if ((entry.custom_label ?? "").trim()) return true;
  return Boolean(entry.subject_id && entry.faculty_staff_link_id);
}

export type EmsSubject = {
  id: number;
  code: string;
  name: string;
  type: string;
};

/** Map EMS subject.type → timetable entry_type */
export function mapEmsTypeToEntryType(
  emsType: string | null | undefined,
): "theory" | "lab" | "other" {
  const t = (emsType ?? "").trim().toLowerCase();
  if (t === "practical" || t === "lab" || t === "practicals") return "lab";
  if (t === "theory") return "theory";
  return "other";
}

function branchHasConfiguredSections(metadata: unknown): boolean {
  let parsed: unknown = metadata;
  if (typeof metadata === "string") {
    try {
      parsed = JSON.parse(metadata);
    } catch {
      return false;
    }
  }
  if (!parsed || typeof parsed !== "object") return false;
  const sections = (parsed as Record<string, unknown>).sections;
  if (!sections || typeof sections !== "object") return false;
  const sectionObj = sections as Record<string, unknown>;
  return (
    Boolean(sectionObj.enabled) &&
    Array.isArray(sectionObj.items) &&
    sectionObj.items.length > 0
  );
}

function toDayCode(value: string): DayCode {
  if (value in DAY_CODE_TO_LABEL) return value as DayCode;
  const mapped = DAY_LABEL_TO_CODE[value];
  if (!mapped) throw new Error(`Invalid day: ${value}`);
  return mapped;
}

async function resolveContext(filters: TimetablePlannerFilters) {
  if (!filters.branchId) return null;
  const rows = await queryStudent<ContextRow[]>(
    `
    SELECT
      col.id AS college_id,
      col.name AS college_name,
      c.id AS course_id,
      c.name AS course_name,
      cb.id AS branch_id,
      cb.name AS branch_name,
      cb.metadata
    FROM course_branches cb
    INNER JOIN courses c ON c.id = cb.course_id
    INNER JOIN colleges col ON col.id = c.college_id
    WHERE cb.id = ?
    LIMIT 1
    `,
    [filters.branchId],
  );
  const row = rows[0];
  if (!row) return null;
  if (filters.collegeId && row.college_id !== filters.collegeId) return null;
  if (filters.courseId && row.course_id !== filters.courseId) return null;
  return {
    collegeId: row.college_id,
    collegeName: row.college_name,
    courseId: row.course_id,
    courseName: row.course_name,
    branchId: row.branch_id,
    branchName: row.branch_name,
    hasSections: branchHasConfiguredSections(row.metadata),
  };
}

/**
 * Calculate standard entry batch based on academic year and study year.
 * E.g. Academic Year "2026-2027" and Year 2 -> Batch 2025 (entered in 2025).
 */
export function deriveBatchFromAcademicYearAndYear(
  academicYear?: string | null,
  year?: number | string | null,
): string | null {
  if (!academicYear || year == null || year === "all") return null;
  const startYear = parseInt(String(academicYear).slice(0, 4), 10);
  const yearNum = typeof year === "number" ? year : parseInt(String(year), 10);
  if (isNaN(startYear) || isNaN(yearNum) || yearNum < 1) return null;
  return String(startYear - (yearNum - 1));
}

/**
 * Dynamically resolves batch for a given academic context (academicYear, year, branch, college, course).
 * Uses student database actuals, curriculum mapping actuals, or academic year arithmetic.
 */
export async function resolveBatchForContext(input: {
  academicYear?: string | null;
  collegeId?: number | null;
  courseId?: number | null;
  branchId?: number | null;
  year?: number | null;
  batch?: string | null;
}): Promise<string | null> {
  const explicit = input.batch?.trim();
  if (explicit && explicit !== "all") {
    return explicit;
  }

  const year = input.year;
  const academicYear = input.academicYear;

  // 1. If branchId & year are provided, inspect students for dominant batch
  if (input.branchId && year) {
    try {
      const studentBatchRows = await queryStudent<(RowDataPacket & { batch: string })[]>(
        `
        SELECT TRIM(s.batch) AS batch, COUNT(*) AS cnt
        FROM students s
        WHERE s.branch_id = ?
          AND s.current_year = ?
          AND TRIM(COALESCE(s.batch, '')) <> ''
          AND (TRIM(COALESCE(s.student_status, '')) = 'Regular' OR s.student_status IS NULL)
        GROUP BY TRIM(s.batch)
        ORDER BY cnt DESC
        LIMIT 1
        `,
        [input.branchId, year],
      );
      if (studentBatchRows[0]?.batch) {
        return studentBatchRows[0].batch;
      }
    } catch {
      // ignore
    }
  }

  // 2. Query subject_mapping_entries for this scope and yearOfStudy
  if (year && (input.branchId || input.courseId || input.collegeId)) {
    try {
      const where: string[] = ["sme.yearOfStudy = ?", "TRIM(COALESCE(sme.batch, '')) <> ''"];
      const params: unknown[] = [year];
      if (input.collegeId) { where.push("sme.collegeId = ?"); params.push(input.collegeId); }
      if (input.courseId) { where.push("sme.courseId = ?"); params.push(input.courseId); }
      if (input.branchId) { where.push("sme.branchId = ?"); params.push(input.branchId); }
      const smeRows = await queryExam<(RowDataPacket & { batch: string })[]>(
        `
        SELECT TRIM(sme.batch) AS batch, COUNT(*) AS cnt
        FROM subject_mapping_entries sme
        WHERE ${where.join(" AND ")}
        GROUP BY TRIM(sme.batch)
        ORDER BY cnt DESC
        LIMIT 1
        `,
        params,
      );
      if (smeRows[0]?.batch) {
        return smeRows[0].batch;
      }
    } catch {
      // ignore
    }
  }

  // 3. Mathematical calculation based on academic year and study year
  const computed = deriveBatchFromAcademicYearAndYear(academicYear, year);
  if (computed) return computed;

  return null;
}

async function countStudentsForScope(filters: TimetablePlannerFilters) {
  if (!filters.branchId) return 0;
  const where = [
    "s.branch_id = ?",
    "TRIM(COALESCE(s.student_status, '')) COLLATE utf8mb4_unicode_ci = 'Regular' COLLATE utf8mb4_unicode_ci",
  ];
  const params: unknown[] = [filters.branchId];
  const batch = filters.batch && filters.batch !== "all"
    ? filters.batch
    : deriveBatchFromAcademicYearAndYear(filters.academicYear, filters.year);
  if (batch) {
    where.push("s.batch = ?");
    params.push(batch);
  }
  if (filters.year) {
    where.push("s.current_year = ?");
    params.push(filters.year);
  }
  if (filters.section && filters.section !== "all") {
    where.push(
      `(TRIM(IFNULL(s.section,'')) COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci OR EXISTS (
        SELECT 1 FROM student_sections ss
        WHERE ss.student_id = s.id AND TRIM(ss.section_name) COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
      ))`,
    );
    params.push(filters.section, filters.section);
  }
  const rows = await queryStudent<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total FROM students s WHERE ${where.join(" AND ")}`,
    params,
  );
  return Number(rows[0]?.total ?? 0);
}

export async function ensureStaffLink(input: {
  hrmsEmployeeId: string;
  displayName?: string | null;
  departmentName?: string | null;
  employeeCode?: string | null;
}) {
  const existing = await queryAcademic<(RowDataPacket & { id: number })[]>(
    `SELECT id FROM ap_staff_link WHERE hrms_employee_id = ? LIMIT 1`,
    [input.hrmsEmployeeId],
  );
  if (existing[0]?.id) return existing[0].id;

  const result = await executeAcademic(
    `
    INSERT INTO ap_staff_link (hrms_employee_id, employee_code, display_name, department_name)
    VALUES (?, ?, ?, ?)
    `,
    [
      input.hrmsEmployeeId,
      input.employeeCode ?? null,
      input.displayName ?? null,
      input.departmentName ?? null,
    ],
  );
  return Number(result.insertId);
}

export async function listFacultyOptions(limit = 500) {
  try {
    const db = await getHrmsDb();
    const lookups = await loadHrmsOrgLookups(db);
    const groupFilter = await getFacultyGroupFilter();
    const employees = await db
      .collection("employees")
      .find({
        $or: [{ is_active: true }, { is_active: { $exists: false } }],
      })
      .project(HRMS_EMPLOYEE_PROJECTION)
      .limit(limit * 4)
      .toArray();

    const mapped = employees
      .map((raw) => extractHrmsStaffProfile(raw as Record<string, unknown>, lookups))
      .filter(
        (staff) =>
          employeeMatchesFacultyGroupFilter(
            groupFilter,
            staff.employeeGroupId,
            staff.employeeGroup,
          ) || isTeachingGroup(staff.employeeGroup),
      )
      .map((staff) => ({
        hrmsEmployeeId: staff.hrmsId,
        name: staff.name,
        division: staff.division,
        department: staff.department,
        designation: staff.designation,
        employeeGroup: staff.employeeGroup,
      }))
      .slice(0, limit);

    return mapped.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export async function listSubjectsForPlanner(filters: TimetablePlannerFilters) {
  // Curriculum-correct list: subject_mapping_entries is authoritative for
  // which subjects belong to a college/course/branch/batch/year/semester.
  // `subjects` remains the master for id/code/name/type.
  const collegeId = filters.collegeId;
  const courseId = filters.courseId;
  const branchId = filters.branchId;
  let batch = filters.batch?.trim();

  if (!batch || batch === "all") {
    batch = (await resolveBatchForContext({
      academicYear: filters.academicYear,
      collegeId,
      courseId,
      branchId,
      year: filters.year,
    })) ?? undefined;
  }

  if (!collegeId || !courseId || !branchId) {
    return [];
  }

  const where: string[] = [
    "sme.collegeId = ?",
    "sme.courseId = ?",
    "sme.branchId = ?",
    "(s.status = 'active' OR s.status IS NULL OR s.status = '')",
  ];
  const params: unknown[] = [collegeId, courseId, branchId];

  if (batch && batch !== "all") {
    where.push("sme.batch = ?");
    params.push(batch);
  }
  if (filters.year != null) {
    where.push("sme.yearOfStudy = ?");
    params.push(filters.year);
  }
  if (filters.semester != null) {
    where.push("sme.semester = ?");
    params.push(filters.semester);
  }

  const section = filters.section?.trim();
  if (section) {
    where.push(`
      (
        sme.sectionMode = 'all'
        OR sme.sectionKey = '*'
        OR sme.sectionKey = ?
        OR sme.sections IS NULL
        OR sme.sections = ''
        OR sme.sections LIKE CONCAT('%', ?, '%')
      )
    `);
    params.push(section, section);
  }

  const rows = await queryExam<
    (RowDataPacket & {
      id: number;
      code: string;
      name: string;
      type: string;
      semester: number | null;
      yearOfStudy: number | null;
      branchName: string | null;
      courseName: string | null;
      collegeName: string | null;
      batch: string | null;
      regulationId: number;
      mappingId: number;
    })[]
  >(
    `
    SELECT
      s.id,
      s.code,
      s.name,
      s.type,
      sme.semester,
      sme.yearOfStudy,
      sme.branchName,
      sme.courseName,
      sme.collegeName,
      sme.batch,
      sme.regulationId,
      sme.id AS mappingId
    FROM subject_mapping_entries sme
    INNER JOIN subjects s ON s.id = sme.subjectId
    WHERE ${where.join(" AND ")}
    ORDER BY s.code, sme.id
    LIMIT 300
    `,
    params,
  );

  // Deduplicate by subject id (same paper can appear once per mapping row)
  const seen = new Set<number>();
  const subjects: Array<{
    id: number;
    code: string;
    name: string;
    type: string;
    semester: number | null;
    year: number | null;
    branch: string | null;
    course: string | null;
    college: string | null;
    batch: string | null;
    regulationId: number;
    mappingId: number;
    source: "ems.subject_mapping_entries";
  }> = [];

  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    subjects.push({
      id: row.id,
      code: row.code,
      name: row.name,
      type: row.type,
      semester: row.semester,
      year: row.yearOfStudy,
      branch: row.branchName,
      course: row.courseName,
      college: row.collegeName,
      batch: row.batch,
      regulationId: row.regulationId,
      mappingId: row.mappingId,
      source: "ems.subject_mapping_entries",
    });
  }

  return subjects;
}

export async function getEmsSubjectsByIds(ids: number[]) {
  const unique = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
  if (unique.length === 0) return new Map<number, EmsSubject>();

  const rows = await queryExam<
    (RowDataPacket & {
      id: number;
      code: string;
      name: string;
      type: string;
      status: string | null;
    })[]
  >(
    `
    SELECT id, code, name, type, status
    FROM subjects
    WHERE id IN (${unique.map(() => "?").join(",")})
    `,
    unique,
  );

  const map = new Map<number, EmsSubject>();
  for (const row of rows) {
    const status = (row.status ?? "active").toLowerCase();
    if (status && status !== "active") continue;
    map.set(row.id, {
      id: row.id,
      code: row.code,
      name: row.name,
      type: row.type,
    });
  }
  return map;
}

/**
 * Resolve assignment subject fields from EMS (source of truth).
 * Client-provided code/name/type are ignored for subject classes.
 * Free/special periods (customLabel only) are passed through unchanged.
 */
export async function resolveAssignmentSubjectsFromEms(
  assignments: AssignmentInput[],
) {
  const ids = assignments
    .filter((a) => !isFreePeriodAssignment(a))
    .map((a) => Number(a.subjectId))
    .filter((id) => Number.isFinite(id) && id > 0);
  const emsMap = await getEmsSubjectsByIds(ids);
  const missing = [...new Set(ids)].filter((id) => !emsMap.has(id));
  if (missing.length) {
    throw new Error(
      `EMS subject(s) not found or inactive: ${missing.join(", ")}`,
    );
  }

  return assignments.map((a) => {
    if (isFreePeriodAssignment(a)) {
      const customLabel = String(a.customLabel ?? "").trim();
      return {
        ...a,
        subjectId: null,
        subjectCode: null,
        subjectName: null,
        subjectTypeSnapshot: null,
        entryType: "other" as const,
        customLabel,
      };
    }
    const ems = emsMap.get(Number(a.subjectId))!;
    const mapped = mapEmsTypeToEntryType(ems.type);
    const entryType =
      a.entryType === "theory" || a.entryType === "lab" || a.entryType === "other"
        ? a.entryType
        : mapped;
    return {
      ...a,
      subjectId: ems.id,
      subjectCode: ems.code,
      subjectName: ems.name,
      subjectTypeSnapshot: ems.type,
      entryType,
      customLabel: null,
    };
  });
}

async function hydrateEntriesForDisplay(
  entries: EntryRow[],
  planStatus: string | null | undefined,
) {
  const liveStatuses = new Set(["draft", "in_review"]);
  if (!planStatus || !liveStatuses.has(planStatus)) {
    return entries;
  }

  const ids = entries
    .map((e) => e.subject_id)
    .filter((id): id is number => typeof id === "number" && id > 0);
  if (ids.length === 0) return entries;

  const emsMap = await getEmsSubjectsByIds(ids);
  return entries.map((entry) => {
    if (!entry.subject_id) return entry;
    const ems = emsMap.get(entry.subject_id);
    if (!ems) {
      return {
        ...entry,
        subject_name: entry.subject_name
          ? `${entry.subject_name} (EMS missing)`
          : "EMS subject missing",
      };
    }
    return {
      ...entry,
      subject_code: ems.code,
      subject_name: ems.name,
      subject_type_snapshot: ems.type,
    };
  });
}

async function refreshEntrySubjectSnapshots(
  planId: number,
  conn?: PoolConnection,
) {
  const query = async <T>(sql: string, params: unknown[] = []) => {
    if (conn) {
      const [rows] = await conn.query(sql, params as never);
      return rows as T;
    }
    return queryAcademic<T>(sql, params);
  };
  const exec = async (sql: string, params: unknown[] = []) => {
    if (conn) {
      await conn.execute(sql, params as never);
      return;
    }
    await executeAcademic(sql, params);
  };

  const rows = await query<EntryRow[]>(
    `
    SELECT id, subject_id, subject_code, subject_name, subject_type_snapshot, entry_type
    FROM ap_timetable_entries
    WHERE plan_id = ? AND subject_id IS NOT NULL
    `,
    [planId],
  );
  if (!rows.length) return { refreshed: 0 };

  const emsMap = await getEmsSubjectsByIds(
    rows.map((r) => Number(r.subject_id)),
  );
  const missing = rows
    .map((r) => Number(r.subject_id))
    .filter((id) => !emsMap.has(id));
  if (missing.length) {
    throw new Error(
      `Cannot publish: EMS subject(s) missing or inactive: ${[...new Set(missing)].join(", ")}`,
    );
  }

  let refreshed = 0;
  for (const row of rows) {
    const ems = emsMap.get(Number(row.subject_id))!;
    if (
      row.subject_code === ems.code &&
      row.subject_name === ems.name &&
      row.subject_type_snapshot === ems.type
    ) {
      continue;
    }
    await exec(
      `
      UPDATE ap_timetable_entries
      SET subject_code = ?,
          subject_name = ?,
          subject_type_snapshot = ?
      WHERE id = ?
      `,
      [ems.code, ems.name, ems.type, row.id],
    );
    refreshed += 1;
  }
  return { refreshed };
}

async function findPlan(filters: Required<
  Pick<
    TimetablePlannerFilters,
    "collegeId" | "courseId" | "branchId" | "academicYear" | "semester"
  >
> & { batch?: string; section?: string | null; year?: number | null; statuses?: string[]; preferPublished?: boolean }) {
  const statuses = filters.statuses ?? ["draft", "in_review", "published"];
  const statusOrderSql = filters.preferPublished
    ? "FIELD(status,'published','in_review','draft')"
    : "FIELD(status,'draft','in_review','published')";

  const where: string[] = [
    "academic_year_label = ?",
    "college_id = ?",
    "course_id = ?",
    "branch_id = ?",
    "semester_number = ?",
    "((? IS NULL AND (section_name IS NULL OR section_name = '')) OR section_name = ?)",
    `status IN (${statuses.map(() => "?").join(",")})`,
  ];
  const params: unknown[] = [
    filters.academicYear,
    filters.collegeId,
    filters.courseId,
    filters.branchId,
    filters.semester,
    filters.section ?? null,
    filters.section ?? null,
    ...statuses,
  ];

  if (filters.year != null) {
    where.push("(year_of_study = ? OR year_of_study IS NULL)");
    params.push(filters.year);
  }

  if (filters.batch && filters.batch !== "all") {
    where.push("(batch = ? OR batch IS NULL OR batch = '')");
    params.push(filters.batch);
  }

  const rows = await queryAcademic<PlanRow[]>(
    `
    SELECT *
    FROM ap_timetable_plans
    WHERE ${where.join(" AND ")}
    ORDER BY
      ${filters.year != null ? "CASE WHEN year_of_study = ? THEN 0 ELSE 1 END," : ""}
      ${filters.batch && filters.batch !== "all" ? "CASE WHEN batch = ? THEN 0 ELSE 1 END," : ""}
      ${statusOrderSql},
      version_no DESC,
      id DESC
    LIMIT 1
    `,
    [
      ...params,
      ...(filters.year != null ? [filters.year] : []),
      ...(filters.batch && filters.batch !== "all" ? [filters.batch] : []),
    ],
  );
  return rows[0] ?? null;
}

async function loadEntries(planId: number) {
  const rows = await queryAcademic<EntryRow[]>(
    `
    SELECT
      e.*,
      sl.display_name AS faculty_name,
      sl.hrms_employee_id AS faculty_hrms_id,
      sl.employee_code AS faculty_employee_code,
      sl.department_name AS faculty_department_name
    FROM ap_timetable_entries e
    LEFT JOIN ap_staff_link sl ON sl.id = e.faculty_staff_link_id
    WHERE e.plan_id = ?
    `,
    [planId],
  );
  return rows;
}

type TimingSlotRow = Awaited<ReturnType<typeof listTimingSlots>>[number];

type PlanScope = {
  academic_year_label: string;
  college_id: number;
  course_id: number;
  branch_id: number;
  batch: string;
  year?: number | null;
  semester_number: number | null;
  section_name: string | null;
};

function planScopeFromRow(plan: PlanRow): PlanScope {
  return {
    academic_year_label: plan.academic_year_label,
    college_id: plan.college_id,
    course_id: plan.course_id,
    branch_id: plan.branch_id,
    batch: plan.batch,
    year: plan.year_of_study != null ? Number(plan.year_of_study) : null,
    semester_number: plan.semester_number,
    section_name: plan.section_name,
  };
}

function planScopeFromDraftInput(input: {
  academicYear: string;
  collegeId: number;
  courseId: number;
  branchId: number;
  batch?: string | null;
  year?: number | null;
  semester: number;
  section?: string | null;
}): PlanScope {
  return {
    academic_year_label: input.academicYear,
    college_id: input.collegeId,
    course_id: input.courseId,
    branch_id: input.branchId,
    batch: input.batch ?? "",
    year: input.year ?? null,
    semester_number: input.semester,
    section_name: input.section ?? null,
  };
}

async function findPublishedPlanForScope(scope: PlanScope): Promise<PlanRow | null> {
  const where: string[] = [
    "academic_year_label = ?",
    "college_id = ?",
    "course_id = ?",
    "branch_id = ?",
    "semester_number = ?",
    "((? IS NULL AND (section_name IS NULL OR section_name = '')) OR section_name = ?)",
    "status = 'published'",
  ];
  const params: unknown[] = [
    scope.academic_year_label,
    scope.college_id,
    scope.course_id,
    scope.branch_id,
    scope.semester_number,
    scope.section_name,
    scope.section_name,
  ];

  if (scope.year != null) {
    where.push("(year_of_study = ? OR year_of_study IS NULL)");
    params.push(scope.year);
  }

  if (scope.batch && scope.batch !== "all") {
    where.push("(batch = ? OR batch IS NULL OR batch = '')");
    params.push(scope.batch);
  }

  const rows = await queryAcademic<PlanRow[]>(
    `
    SELECT *
    FROM ap_timetable_plans
    WHERE ${where.join(" AND ")}
    ORDER BY
      ${scope.year != null ? "CASE WHEN year_of_study = ? THEN 0 ELSE 1 END," : ""}
      ${scope.batch && scope.batch !== "all" ? "CASE WHEN batch = ? THEN 0 ELSE 1 END," : ""}
      version_no DESC,
      id DESC
    LIMIT 1
    `,
    [
      ...params,
      ...(scope.year != null ? [scope.year] : []),
      ...(scope.batch && scope.batch !== "all" ? [scope.batch] : []),
    ],
  );
  return rows[0] ?? null;
}

function slotTimingKey(
  slots: TimingSlotRow[],
  slotId: number,
  dayOfWeek: DayCode,
): { start: string; end: string } | null {
  const slot =
    slots.find((item) => item.id === slotId && item.dayOfWeek === dayOfWeek) ??
    slots.find((item) => item.id === slotId);
  return slot ? { start: slot.startTime, end: slot.endTime } : null;
}

function buildEntrySignatureSet(entries: EntryRow[], slots: TimingSlotRow[]): Set<string> {
  const signatures = new Set<string>();
  for (const entry of entries) {
    if (!isAssignedEntry(entry)) continue;
    const slotId = entry.timing_slot_id ?? entry.period_slot_id;
    const timing = slotTimingKey(slots, slotId, entry.day_of_week);
    signatures.add(
      [
        entry.day_of_week,
        timing?.start ?? "",
        timing?.end ?? "",
        entry.subject_id ?? "",
        entry.faculty_staff_link_id ?? "",
        (entry.room_label ?? "").trim(),
        (entry.batch_label ?? "").trim(),
        (entry.custom_label ?? "").trim(),
        entry.entry_type ?? "",
      ].join("|"),
    );
  }
  return signatures;
}

function buildAssignmentSignatureSet(
  assignments: Array<AssignmentInput & { facultyStaffLinkId?: number | null }>,
  slots: TimingSlotRow[],
): Set<string> {
  const signatures = new Set<string>();
  for (const assignment of assignments) {
    const day = toDayCode(String(assignment.dayOfWeek));
    const timing = slotTimingKey(slots, assignment.timingSlotId, day);
    const customLabel = (assignment.customLabel ?? "").trim();
    const isSpecial = customLabel.length > 0 && !assignment.subjectId;
    if (!isSpecial && (!assignment.subjectId || !assignment.facultyStaffLinkId)) continue;
    signatures.add(
      [
        day,
        timing?.start ?? "",
        timing?.end ?? "",
        assignment.subjectId ?? "",
        assignment.facultyStaffLinkId ?? "",
        (assignment.roomLabel ?? "").trim(),
        (assignment.batchLabel ?? "").trim(),
        customLabel,
        assignment.entryType ?? "",
      ].join("|"),
    );
  }
  return signatures;
}

function signatureSetsEqual(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) return false;
  for (const signature of left) {
    if (!right.has(signature)) return false;
  }
  return true;
}

async function getPublishComparisonMeta(plan: PlanRow, entries: EntryRow[]) {
  const publishedPlan = await findPublishedPlanForScope(planScopeFromRow(plan));
  if (!publishedPlan || publishedPlan.id === plan.id || !plan.timing_template_id) {
    return {
      unchanged: false,
      unchangedFromPublishedPlanId: null as number | null,
      unchangedFromPublishedVersion: null as number | null,
      message: null as string | null,
    };
  }

  const slots = await listTimingSlots(plan.timing_template_id);
  const publishedEntries = await loadEntries(publishedPlan.id);
  const unchanged = signatureSetsEqual(
    buildEntrySignatureSet(entries, slots),
    buildEntrySignatureSet(publishedEntries, slots),
  );

  return {
    unchanged,
    unchangedFromPublishedPlanId: unchanged ? publishedPlan.id : null,
    unchangedFromPublishedVersion: unchanged ? publishedPlan.version_no : null,
    message: unchanged
      ? `No changes since published plan #${publishedPlan.id} (version ${publishedPlan.version_no}). The live timetable is already up to date.`
      : null,
  };
}

function buildGrid(
  slots: Awaited<ReturnType<typeof listTimingSlots>>,
  entries: EntryRow[],
) {
  const days = [...new Set(slots.map((s) => s.dayLabel))];
  const slotsByDay: Record<string, typeof slots> = {};
  for (const day of days) slotsByDay[day] = [];
  for (const slot of slots) {
    slotsByDay[slot.dayLabel] = slotsByDay[slot.dayLabel] ?? [];
    slotsByDay[slot.dayLabel].push(slot);
  }

  const entriesMap = new Map<string, EntryRow[]>();
  for (const entry of entries) {
    const slotId = entry.timing_slot_id ?? entry.period_slot_id;
    const key = `${entry.day_of_week}:${slotId}`;
    const list = entriesMap.get(key) ?? [];
    list.push(entry);
    entriesMap.set(key, list);
  }

  type GridCellEntry = {
    id: number;
    subjectId: number | null;
    subjectCode: string | null;
    subjectName: string | null;
    subjectTypeSnapshot: string | null;
    entryType: string;
    facultyStaffLinkId: number | null;
    facultyName: string | null;
    facultyHrmsId: string | null;
    roomLabel: string | null;
    batchLabel: string | null;
    studentIds: number[] | null;
    studentCount: number | null;
    weeklyRotation?: boolean;
    rotationPattern?: string | null;
    customLabel: string | null;
  };

  const grid: Record<
    string,
    Record<
      number,
      {
        slotId: number;
        slotType: string;
        assignable: boolean;
        label: string;
        startTime: string;
        endTime: string;
        entry: null | GridCellEntry;
        entries: GridCellEntry[];
      }
    >
  > = {};

  for (const day of days) {
    grid[day] = {};
    for (const slot of slotsByDay[day] ?? []) {
      const dayCode = toDayCode(day);
      const foundList = entriesMap.get(`${dayCode}:${slot.id}`) ?? [];
      const mappedEntries: GridCellEntry[] = foundList.map((found) => {
        let parsedStudentIds: number[] | null = null;
        if (Array.isArray(found.student_ids)) {
          parsedStudentIds = found.student_ids as number[];
        } else if (typeof found.student_ids === "string" && found.student_ids.trim()) {
          try {
            parsedStudentIds = JSON.parse(found.student_ids);
          } catch {
            parsedStudentIds = null;
          }
        }
        return {
          id: found.id,
          subjectId: found.subject_id,
          subjectCode: found.subject_code,
          subjectName: found.subject_name,
          subjectTypeSnapshot: found.subject_type_snapshot ?? null,
          entryType: found.entry_type,
          facultyStaffLinkId: found.faculty_staff_link_id,
          facultyName: found.faculty_name ?? null,
          facultyHrmsId: found.faculty_hrms_id ?? null,
          roomLabel: found.room_label,
          batchLabel: found.batch_label ?? null,
          studentIds: parsedStudentIds,
          studentCount: found.student_count ?? (parsedStudentIds ? parsedStudentIds.length : null),
          weeklyRotation: Boolean(found.weekly_rotation),
          rotationPattern: found.rotation_pattern ?? null,
          customLabel: found.custom_label ?? null,
        };
      });

      grid[day][slot.id] = {
        slotId: slot.id,
        slotType: slot.slotType,
        assignable: slot.isAssignable,
        label: slot.label,
        startTime: slot.startTime,
        endTime: slot.endTime,
        entry: mappedEntries[0] ?? null,
        entries: mappedEntries,
      };
    }
  }

  return { days, slotsByDay, grid };
}

export async function getTimetablePlanner(filters: TimetablePlannerFilters = {}) {
  const context = await resolveContext(filters);
  const academicYear = filters.academicYear ?? "";
  const semester = filters.semester;
  const year = filters.year ?? undefined;
  let batch = filters.batch && filters.batch !== "all" ? filters.batch : undefined;

  // Dynamically resolve batch for context if missing
  if (!batch && year) {
    batch = (await resolveBatchForContext({
      academicYear,
      collegeId: filters.collegeId,
      courseId: filters.courseId,
      branchId: filters.branchId,
      year,
    })) ?? undefined;
  }

  const sectionLabel =
    filters.section && filters.section !== "all"
      ? filters.section
      : context?.hasSections
        ? null
        : null;

  const requires = {
    college: !filters.collegeId,
    course: !filters.courseId,
    branch: !filters.branchId,
    academicYear: !academicYear,
    semester: !semester,
    batch: false,
    section: Boolean(context?.hasSections && !sectionLabel),
  };

  const contextComplete =
    Boolean(context) &&
    Boolean(academicYear) &&
    Boolean(semester) &&
    (!context?.hasSections || Boolean(sectionLabel));

  const resolvedFilters: TimetablePlannerFilters = {
    ...filters,
    batch,
    year,
  };

  if (!contextComplete || !context || !semester || !filters.collegeId) {
    return {
      ready: false,
      missingTiming: false,
      requires,
      context: {
        academicYear: academicYear || "—",
        college: context?.collegeName ?? "—",
        course: context?.courseName ?? "—",
        branch: context?.branchName ?? "—",
        branchId: context?.branchId ?? null,
        batch: batch ?? "—",
        year,
        semester: semester ?? null,
        section: sectionLabel ?? "—",
        hasSections: context?.hasSections ?? false,
        studentCount: 0,
        status: null,
        timingTemplateName: null,
        planId: null,
        versionNo: null,
      },
      timing: null,
      days: [] as string[],
      slotsByDay: {} as Record<string, unknown>,
      grid: {},
      entries: [],
      subjects: [],
      faculty: [],
      classTeacher: null,
      review: null,
    };
  }

  const timing = await getActiveTimingForContext({
    collegeId: filters.collegeId,
    academicYear,
    semester,
  });

  if (!timing) {
    return {
      ready: false,
      missingTiming: true,
      requires,
      context: {
        academicYear,
        college: context.collegeName,
        course: context.courseName,
        branch: context.branchName,
        branchId: context.branchId,
        batch: batch ?? "—",
        year,
        semester,
        section: sectionLabel ?? "—",
        hasSections: context.hasSections,
        studentCount: await countStudentsForScope(resolvedFilters),
        status: null,
        timingTemplateName: null,
        planId: null,
        versionNo: null,
      },
      timing: null,
      days: [],
      slotsByDay: {},
      grid: {},
      entries: [],
      subjects: await listSubjectsForPlanner(resolvedFilters),
      faculty: await listFacultyOptions(),
      classTeacher: null,
      review: null,
      message:
        "No academic timing configuration found. Please configure the timing schedule for this college, academic year and semester before creating the timetable.",
    };
  }

  const plan = await findPlan({
    collegeId: context.collegeId,
    courseId: context.courseId,
    branchId: context.branchId,
    academicYear,
    batch,
    semester,
    section: sectionLabel,
    statuses: filters.statuses,
    preferPublished: filters.preferPublished,
    year,
  });

  const entriesRaw = plan ? await loadEntries(plan.id) : [];
  const entries = await hydrateEntriesForDisplay(entriesRaw, plan?.status);
  const { days, slotsByDay, grid } = buildGrid(timing.slots, entries);
  const [studentCount, subjects, faculty, classTeacher] = await Promise.all([
    countStudentsForScope(resolvedFilters),
    listSubjectsForPlanner(resolvedFilters),
    listFacultyOptions(),
    getClassTeacherForSection({
      branchId: context.branchId,
      batch,
      year,
      semester,
      section: sectionLabel,
      academicYear,
    }),
  ]);

  return {
    ready: true,
    missingTiming: false,
    requires,
    context: {
      academicYear,
      college: context.collegeName,
      collegeId: context.collegeId,
      course: context.courseName,
      courseId: context.courseId,
      branch: context.branchName,
      branchId: context.branchId,
      batch: batch ?? plan?.batch ?? "—",
      year: year ?? plan?.year_of_study ?? null,
      semester,
      section: sectionLabel ?? "—",
      hasSections: context.hasSections,
      studentCount,
      status: plan?.status ?? "draft",
      timingTemplateName: timing.name,
      timingTemplateId: timing.id,
      planId: plan?.id ?? null,
      versionNo: plan?.version_no ?? null,
    },
    timing: {
      id: timing.id,
      name: timing.name,
      academicYear: timing.academicYear,
      semester: timing.semester,
      status: timing.status,
    },
    days,
    slotsByDay,
    grid,
    entries: entries.map((e) => ({
      id: e.id,
      dayOfWeek: e.day_of_week,
      timingSlotId: e.timing_slot_id ?? e.period_slot_id,
      subjectId: e.subject_id,
      subjectCode: e.subject_code,
      subjectName: e.subject_name,
      subjectTypeSnapshot: e.subject_type_snapshot ?? null,
      entryType: e.entry_type,
      facultyStaffLinkId: e.faculty_staff_link_id,
      facultyName: e.faculty_name,
      roomLabel: e.room_label,
      batchLabel: e.batch_label ?? null,
      customLabel: e.custom_label ?? null,
    })),
    subjects,
    faculty,
    classTeacher,
    review: null,
  };
}

async function resolveFacultyLink(
  assignment: AssignmentInput,
  context?: {
    collegeId?: number | null;
    branchId?: number | null;
    actorUserId?: number | null;
    ipAddress?: string | null;
  },
) {
  if (!assignment.hrmsEmployeeId && !assignment.facultyStaffLinkId) return null;

  if (context?.collegeId) {
    try {
      const result = await ensureStaffUserForSubjectAssignment({
        hrmsEmployeeId: assignment.hrmsEmployeeId ?? null,
        facultyStaffLinkId: assignment.facultyStaffLinkId ?? null,
        displayName: assignment.facultyName ?? null,
        collegeId: context.collegeId,
        branchId: context.branchId ?? null,
        actorUserId: context.actorUserId ?? null,
        ipAddress: context.ipAddress ?? null,
      });
      if (result) return result.staffLinkId;
    } catch (err) {
      console.warn("Could not ensure staff user profile on resolveFacultyLink", err);
    }
  }

  if (assignment.facultyStaffLinkId) return assignment.facultyStaffLinkId;
  if (!assignment.hrmsEmployeeId) return null;
  return ensureStaffLink({
    hrmsEmployeeId: assignment.hrmsEmployeeId,
    displayName: assignment.facultyName ?? null,
  });
}

type FacultyClashItem = {
  facultyLinkId: number;
  facultyName: string;
  facultyEmpCode?: string | null;
  departmentName?: string | null;
  dayOfWeek: string;
  dayLabel: string;
  startTime: string;
  endTime: string;
  slotLabel?: string | null;
  currentSubject?: string | null;
  currentSubjectCode?: string | null;
  currentCustomLabel?: string | null;
  conflictingPlanId?: number | null;
  conflictingPlanLabel?: string | null;
  conflictingBranch?: string | null;
  conflictingCourse?: string | null;
  conflictingSection?: string | null;
  conflictingSemester?: number | null;
  conflictingSubject?: string | null;
  conflictingSubjectCode?: string | null;
  conflictingTimeSlot?: string | null;
  existingHours?: number | null;
  existingSlotsCount?: number | null;
  isParallelWarning?: boolean;
  message: string;
};

export async function validatePlanAssignments(
  plan: PlanRow,
  entries: EntryRow[],
  options?: { requireComplete?: boolean },
) {
  const requireComplete = options?.requireComplete ?? false;
  const warnings: string[] = [];
  const sectionClashes: string[] = [];
  const facultyClashes: string[] = [];
  const facultyClashDetails: FacultyClashItem[] = [];
  const unassigned: string[] = [];

  if (!plan.timing_template_id) {
    return {
      ok: false,
      assignedCount: 0,
      unassignedSlots: unassigned,
      sectionClashes: ["Plan has no timing template"],
      facultyClashes,
      facultyClashDetails,
      roomClashes: [] as string[],
      warnings,
    };
  }

  const slots = await listTimingSlots(plan.timing_template_id);
  const classSlots = slots.filter((s) => s.isAssignable);
  const entriesBySlot = new Map<string, EntryRow[]>();
  for (const entry of entries) {
    const slotId = entry.timing_slot_id ?? entry.period_slot_id;
    const key = `${entry.day_of_week}:${slotId}`;
    const list = entriesBySlot.get(key) ?? [];
    list.push(entry);
    entriesBySlot.set(key, list);
  }

  // Helper to parse HH:MM into minutes for overlap comparison
  const parseTimeToMinutes = (t: string | null | undefined): number => {
    if (!t) return 0;
    const parts = String(t).slice(0, 5).split(":");
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return h * 60 + m;
  };

  // 1. In-memory check: intra-slot duplicate faculty or duplicate batches
  type IntraFacultyClash = {
    facultyLinkId: number;
    day: string;
    slotIdStr: string;
    sub1: string;
    sub1Code: string | null;
    sub2: string;
    sub2Code: string | null;
    timeRange: string;
    slotLabel: string;
    startTime: string;
    endTime: string;
    customLabel: string | null;
    entryFacultyName: string | null;
    entryFacultyHrms: string | null;
  };
  const intraFacultyClashes: IntraFacultyClash[] = [];

  for (const [key, slotEntries] of entriesBySlot.entries()) {
    if (slotEntries.length > 1) {
      const seenBatches = new Set<string>();
      const seenFaculty = new Map<number, EntryRow>();
      for (const entry of slotEntries) {
        if (entry.faculty_staff_link_id) {
          const prevEntry = seenFaculty.get(entry.faculty_staff_link_id);
          if (prevEntry) {
            const [day, slotIdStr] = key.split(":");
            const slot = slots.find((s) => s.id === Number(slotIdStr));
            const timeRange = slot
              ? `${String(slot.startTime).slice(0, 5)}-${String(slot.endTime).slice(0, 5)}`
              : `slot ${slotIdStr}`;
            const sub1 = prevEntry.subject_name || prevEntry.custom_label || "Class 1";
            const sub2 = entry.subject_name || entry.custom_label || "Class 2";
            intraFacultyClashes.push({
              facultyLinkId: entry.faculty_staff_link_id,
              day,
              slotIdStr,
              sub1,
              sub1Code: prevEntry.subject_code || null,
              sub2,
              sub2Code: entry.subject_code || null,
              timeRange,
              slotLabel: slot?.label ?? `Slot ${slotIdStr}`,
              startTime: slot?.startTime ? String(slot.startTime).slice(0, 5) : "",
              endTime: slot?.endTime ? String(slot.endTime).slice(0, 5) : "",
              customLabel: entry.custom_label || null,
              entryFacultyName: entry.faculty_name || null,
              entryFacultyHrms: entry.faculty_hrms_id || null,
            });
          } else {
            seenFaculty.set(entry.faculty_staff_link_id, entry);
          }
        }
        const batch = (entry.batch_label ?? "").trim().toLowerCase();
        if (batch) {
          if (seenBatches.has(batch)) {
            const [day, slotId] = key.split(":");
            const slot = slots.find((s) => s.id === Number(slotId));
            const slotDesc = slot
              ? `${slot.label} (${String(slot.startTime).slice(0, 5)}-${String(slot.endTime).slice(0, 5)})`
              : `slot ${slotId}`;
            sectionClashes.push(
              `Duplicate batch classification "${entry.batch_label}" on ${DAY_CODE_TO_LABEL[day as DayCode] ?? day} (${slotDesc})`,
            );
          }
          seenBatches.add(batch);
        }
      }
    }
  }

  // 2. In-memory check: unassigned class slots
  for (const slot of classSlots) {
    const key = `${slot.dayOfWeek}:${slot.id}`;
    const slotEntries = entriesBySlot.get(key) ?? [];
    const hasAssigned = slotEntries.some((e) => isAssignedEntry(e));
    if (!hasAssigned) {
      unassigned.push(`${slot.dayLabel} ${slot.label} (${slot.startTime}-${slot.endTime})`);
    }
  }

  // 3. Local faculty assignments
  const localFacultyAssignments: Array<{
    facultyLinkId: number;
    dayOfWeek: DayCode;
    startMin: number;
    endMin: number;
    startTime: string;
    endTime: string;
    slotId: number;
    slotLabel: string;
    subjectName?: string | null;
    subjectCode?: string | null;
    customLabel?: string | null;
    batchLabel?: string | null;
    entryType?: string;
  }> = [];

  for (const entry of entries) {
    if (!entry.faculty_staff_link_id) continue;
    const slotId = entry.timing_slot_id ?? entry.period_slot_id;
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) continue;
    localFacultyAssignments.push({
      facultyLinkId: entry.faculty_staff_link_id,
      dayOfWeek: entry.day_of_week,
      startMin: parseTimeToMinutes(slot.startTime),
      endMin: parseTimeToMinutes(slot.endTime),
      startTime: String(slot.startTime).slice(0, 5),
      endTime: String(slot.endTime).slice(0, 5),
      slotId: slot.id,
      slotLabel: slot.label,
      subjectName: entry.subject_name,
      subjectCode: entry.subject_code,
      customLabel: entry.custom_label,
      batchLabel: entry.batch_label,
      entryType: entry.entry_type,
    });
  }

  // 4. Cross-plan clashes check with lean query
  type RawCrossClash = {
    other: {
      id: number;
      faculty_staff_link_id: number;
      subject_name: string | null;
      custom_label: string | null;
      subject_code: string | null;
      other_plan_id: number;
      other_academic_year: string;
      other_course_id: number;
      other_branch_id: number;
      other_year: number | null;
      other_semester: number | null;
      other_section: string | null;
      slot_label: string;
      slot_start: string;
      slot_end: string;
      slot_day: DayCode;
    };
    local: (typeof localFacultyAssignments)[number];
    isParallel: boolean;
  };
  const rawCrossClashes: RawCrossClash[] = [];

  const facultyIds = [
    ...new Set(localFacultyAssignments.map((a) => a.facultyLinkId)),
  ];

  if (facultyIds.length > 0) {
    const otherEntries = await queryAcademic<
      (RowDataPacket & RawCrossClash["other"])[]
    >(
      `
      SELECT
        e.id,
        e.faculty_staff_link_id,
        e.subject_name,
        e.custom_label,
        e.subject_code,
        p.id AS other_plan_id,
        p.academic_year_label AS other_academic_year,
        p.course_id AS other_course_id,
        p.branch_id AS other_branch_id,
        p.year_of_study AS other_year,
        p.semester_number AS other_semester,
        p.section_name AS other_section,
        s.label AS slot_label,
        s.start_time AS slot_start,
        s.end_time AS slot_end,
        s.day_of_week AS slot_day
      FROM ap_timetable_entries e
      INNER JOIN ap_timetable_plans p ON p.id = e.plan_id
      INNER JOIN ap_timing_template_slots s
        ON s.id = COALESCE(e.timing_slot_id, e.period_slot_id)
      WHERE e.faculty_staff_link_id IN (${facultyIds.map(() => "?").join(",")})
        AND p.id <> ?
        AND p.college_id = ?
        AND p.status = 'published'
        AND NOT (
          p.academic_year_label = ?
          AND p.college_id = ?
          AND p.course_id = ?
          AND p.branch_id = ?
          AND p.batch = ?
          AND p.semester_number = ?
          AND ((? IS NULL AND (p.section_name IS NULL OR p.section_name = '')) OR p.section_name = ?)
        )
      `,
      [
        ...facultyIds,
        plan.id,
        plan.college_id,
        plan.academic_year_label,
        plan.college_id,
        plan.course_id,
        plan.branch_id,
        plan.batch,
        plan.semester_number,
        plan.section_name,
        plan.section_name,
      ],
    );

    for (const other of otherEntries) {
      const otherStartMin = parseTimeToMinutes(other.slot_start);
      const otherEndMin = parseTimeToMinutes(other.slot_end);
      for (const local of localFacultyAssignments) {
        if (
          local.facultyLinkId === other.faculty_staff_link_id &&
          local.dayOfWeek === other.slot_day &&
          otherStartMin < local.endMin &&
          local.startMin < otherEndMin
        ) {
          const isCrossSectionParallel =
            (other.other_section != null &&
              plan.section_name != null &&
              other.other_section.trim().toLowerCase() !== plan.section_name.trim().toLowerCase()) ||
            Boolean(plan.notes?.includes("Combined"));
          rawCrossClashes.push({ other, local, isParallel: isCrossSectionParallel });
        }
      }
    }
  }

  // 5. If ANY clashes exist, fetch rich metadata ONLY for the conflicting items (parallel & fast)
  const clashFacultyIds = new Set<number>([
    ...intraFacultyClashes.map((c) => c.facultyLinkId),
    ...rawCrossClashes.map((c) => c.other.faculty_staff_link_id),
  ]);

  if (clashFacultyIds.size > 0) {
    const targetFacultyIds = [...clashFacultyIds];
    const targetBranchIds = [
      ...new Set(rawCrossClashes.map((c) => Number(c.other.other_branch_id)).filter((id) => id > 0)),
    ];
    const targetCourseIds = [
      ...new Set(rawCrossClashes.map((c) => Number(c.other.other_course_id)).filter((id) => id > 0)),
    ];

    const [staffRows, branchRows, courseRows, workloadRows] = await Promise.all([
      queryAcademic<
        (RowDataPacket & {
          id: number;
          display_name: string;
          hrms_employee_id: string | null;
          employee_code: string | null;
          department_name: string | null;
        })[]
      >(
        `SELECT id, display_name, hrms_employee_id, employee_code, department_name
         FROM ap_staff_link WHERE id IN (${targetFacultyIds.map(() => "?").join(",")})`,
        targetFacultyIds,
      ).catch(() => []),
      targetBranchIds.length > 0
        ? queryStudent<(RowDataPacket & { id: number; name: string })[]>(
            `SELECT id, name FROM course_branches WHERE id IN (${targetBranchIds.map(() => "?").join(",")})`,
            targetBranchIds,
          ).catch(() => [])
        : Promise.resolve([]),
      targetCourseIds.length > 0
        ? queryStudent<(RowDataPacket & { id: number; name: string })[]>(
            `SELECT id, name FROM courses WHERE id IN (${targetCourseIds.map(() => "?").join(",")})`,
            targetCourseIds,
          ).catch(() => [])
        : Promise.resolve([]),
      queryAcademic<
        (RowDataPacket & {
          faculty_staff_link_id: number;
          start_time: string;
          end_time: string;
        })[]
      >(
        `SELECT e.faculty_staff_link_id, s.start_time, s.end_time
         FROM ap_timetable_entries e
         INNER JOIN ap_timetable_plans p ON p.id = e.plan_id
         INNER JOIN ap_timing_template_slots s ON s.id = COALESCE(e.timing_slot_id, e.period_slot_id)
         WHERE e.faculty_staff_link_id IN (${targetFacultyIds.map(() => "?").join(",")})
           AND p.college_id = ?
           AND p.status = 'published'`,
        [...targetFacultyIds, plan.college_id],
      ).catch(() => []),
    ]);

    const staffMap = new Map<number, (typeof staffRows)[number]>();
    for (const s of staffRows) staffMap.set(Number(s.id), s);

    const branchNameMap = new Map<number, string>();
    for (const b of branchRows) branchNameMap.set(Number(b.id), b.name);

    const courseNameMap = new Map<number, string>();
    for (const c of courseRows) courseNameMap.set(Number(c.id), c.name);

    const workloadMap = new Map<number, { publishedSlots: number; publishedHours: number }>();
    for (const row of workloadRows) {
      const fid = Number(row.faculty_staff_link_id);
      const cur = workloadMap.get(fid) ?? { publishedSlots: 0, publishedHours: 0 };
      const durMin = Math.max(0, parseTimeToMinutes(row.end_time) - parseTimeToMinutes(row.start_time));
      cur.publishedSlots += 1;
      cur.publishedHours += durMin / 60;
      workloadMap.set(fid, cur);
    }
    for (const [, data] of workloadMap.entries()) {
      data.publishedHours = Math.round(data.publishedHours * 10) / 10;
    }

    // Format intra-plan clashes
    for (const c of intraFacultyClashes) {
      const staff = staffMap.get(c.facultyLinkId);
      const facName = staff?.display_name || c.entryFacultyName || `Faculty #${c.facultyLinkId}`;
      const facCode = staff?.employee_code || staff?.hrms_employee_id || c.entryFacultyHrms || "";
      const facLabel = facCode ? `${facName} (${facCode})` : facName;
      const dayLabel = DAY_CODE_TO_LABEL[c.day as DayCode] ?? c.day;
      const wl = workloadMap.get(c.facultyLinkId);
      const wlDesc =
        wl && wl.publishedHours > 0
          ? ` · Existing Load: ${wl.publishedHours} hrs/wk (${wl.publishedSlots} classes)`
          : "";

      const clashMsg = `Faculty clash: ${facLabel} is assigned multiple times on ${dayLabel} ${c.timeRange} (${c.sub1} & ${c.sub2})${wlDesc}`;
      facultyClashes.push(clashMsg);
      facultyClashDetails.push({
        facultyLinkId: c.facultyLinkId,
        facultyName: facName,
        facultyEmpCode: facCode || null,
        departmentName: staff?.department_name || null,
        dayOfWeek: c.day,
        dayLabel,
        startTime: c.startTime,
        endTime: c.endTime,
        slotLabel: c.slotLabel,
        currentSubject: c.sub2,
        currentSubjectCode: c.sub2Code,
        currentCustomLabel: c.customLabel,
        conflictingPlanId: plan.id,
        conflictingPlanLabel: `Current Plan #${plan.id} (Slot duplicate)`,
        conflictingSubject: c.sub1,
        conflictingSubjectCode: c.sub1Code,
        conflictingTimeSlot: c.timeRange,
        existingHours: wl?.publishedHours ?? null,
        existingSlotsCount: wl?.publishedSlots ?? null,
        isParallelWarning: false,
        message: clashMsg,
      });
    }

    // Format cross-plan clashes
    const clashMessages = new Set<string>();
    for (const { other, local, isParallel } of rawCrossClashes) {
      const staff = staffMap.get(other.faculty_staff_link_id);
      const facName = staff?.display_name || `Faculty #${other.faculty_staff_link_id}`;
      const facCode = staff?.employee_code || staff?.hrms_employee_id || "";
      const facDept = staff?.department_name || "";
      const facLabel = facCode ? `${facName} (${facCode})` : facName;
      const dayLabel = DAY_CODE_TO_LABEL[other.slot_day] ?? other.slot_day;
      const otherTime = `${String(other.slot_start).slice(0, 5)}-${String(other.slot_end).slice(0, 5)}`;
      const branchName = branchNameMap.get(Number(other.other_branch_id));
      const courseName = courseNameMap.get(Number(other.other_course_id));
      const programDesc = [courseName, branchName].filter(Boolean).join(" · ");
      const otherBranch = programDesc
        ? ` · ${programDesc}`
        : other.other_branch_id
          ? ` · Branch #${other.other_branch_id}`
          : "";
      const otherSec = other.other_section ? ` · Section ${other.other_section}` : "";
      const otherSem = other.other_semester ? ` · Sem ${other.other_semester}` : "";
      const otherPlanDesc = `Plan #${other.other_plan_id}${otherBranch}${otherSec}${otherSem}`;
      const otherSub =
        other.subject_name || other.custom_label
          ? ` · Subject: "${other.subject_name || other.custom_label}"`
          : "";
      const localSub =
        local.subjectName || local.customLabel
          ? ` [Attempting: "${local.subjectName || local.customLabel}"]`
          : "";

      const wl = workloadMap.get(other.faculty_staff_link_id);
      const wlDesc =
        wl && wl.publishedHours > 0
          ? ` · Existing Load: ${wl.publishedHours} hrs/wk (${wl.publishedSlots} classes)`
          : "";

      const detailItem: FacultyClashItem = {
        facultyLinkId: other.faculty_staff_link_id,
        facultyName: facName,
        facultyEmpCode: facCode || null,
        departmentName: facDept || null,
        dayOfWeek: other.slot_day,
        dayLabel,
        startTime: String(other.slot_start).slice(0, 5),
        endTime: String(other.slot_end).slice(0, 5),
        slotLabel: other.slot_label ?? null,
        currentSubject: local.subjectName || local.customLabel || null,
        currentSubjectCode: local.subjectCode || null,
        currentCustomLabel: local.customLabel || null,
        conflictingPlanId: other.other_plan_id,
        conflictingPlanLabel: otherPlanDesc,
        conflictingBranch: branchName || null,
        conflictingCourse: courseName || null,
        conflictingSection: other.other_section || null,
        conflictingSemester: other.other_semester || null,
        conflictingSubject: other.subject_name || other.custom_label || null,
        conflictingSubjectCode: other.subject_code || null,
        conflictingTimeSlot: otherTime,
        existingHours: wl?.publishedHours ?? null,
        existingSlotsCount: wl?.publishedSlots ?? null,
        isParallelWarning: isParallel,
        message: "",
      };

      if (isParallel) {
        const warnMsg = `Combined/Parallel class: ${facLabel} on ${dayLabel} ${otherTime} (parallel in ${otherPlanDesc}${otherSub})${wlDesc}`;
        detailItem.message = warnMsg;
        warnings.push(warnMsg);
        facultyClashDetails.push(detailItem);
      } else {
        const clashMsg = `Faculty clash: ${facLabel} is already assigned on ${dayLabel} ${otherTime} in ${otherPlanDesc}${otherSub}${localSub}${wlDesc}`;
        detailItem.message = clashMsg;
        if (!clashMessages.has(clashMsg)) {
          clashMessages.add(clashMsg);
          facultyClashDetails.push(detailItem);
        }
      }
    }
    facultyClashes.push(...clashMessages);
  }

  for (const entry of entries) {
    const slotId = entry.timing_slot_id ?? entry.period_slot_id;
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) {
      warnings.push(`Entry #${entry.id} references invalid timing slot`);
      continue;
    }
    if (!slot.isAssignable && entry.subject_id) {
      warnings.push(`Assignment on non-class slot ${slot.label}`);
    }
  }

  const publishComparison = await getPublishComparisonMeta(plan, entries);
  if (publishComparison.message) {
    warnings.push(publishComparison.message);
  }

  const ok =
    sectionClashes.length === 0 &&
    facultyClashes.length === 0 &&
    (!requireComplete || unassigned.length === 0);

  return {
    ok,
    assignedCount: entries.filter((e) => isAssignedEntry(e)).length,
    unassignedSlots: unassigned,
    sectionClashes,
    facultyClashes,
    facultyClashDetails,
    roomClashes: [] as string[],
    warnings,
    unchanged: publishComparison.unchanged,
    unchangedFromPublishedPlanId: publishComparison.unchangedFromPublishedPlanId,
    unchangedFromPublishedVersion: publishComparison.unchangedFromPublishedVersion,
    message: publishComparison.message,
  };
}

async function writeVersion(
  conn: PoolConnection,
  planId: number,
  action: string,
  snapshot: unknown,
  reason?: string,
) {
  await conn.execute(
    `
    INSERT INTO ap_timetable_versions (plan_id, action, reason, snapshot_json)
    VALUES (?, ?, ?, ?)
    `,
    [planId, action, reason ?? null, JSON.stringify(snapshot)],
  );
}

export async function saveTimetableDraft(input: {
  collegeId: number;
  courseId: number;
  branchId: number;
  academicYear: string;
  batch: string;
  year?: number | null;
  semester: number;
  section?: string | null;
  notes?: string | null;
  assignments: AssignmentInput[];
  actorUserId?: number | null;
  ipAddress?: string | null;
}) {
  const timing = await getActiveTimingForContext({
    collegeId: input.collegeId,
    academicYear: input.academicYear,
    semester: input.semester,
  });
  if (!timing) {
    throw new Error(
      "No academic timing configuration found for this college, academic year and semester.",
    );
  }

  const slotIds = new Set(timing.slots.map((s) => s.id));
  const classSlotIds = new Set(
    timing.slots.filter((s) => s.isAssignable).map((s) => s.id),
  );

  for (const a of input.assignments) {
    if (!slotIds.has(a.timingSlotId)) {
      throw new Error(`Timing slot ${a.timingSlotId} does not belong to active template`);
    }
    if (!classSlotIds.has(a.timingSlotId)) {
      throw new Error(`Cannot assign class on non-CLASS slot ${a.timingSlotId}`);
    }
    if (isFreePeriodAssignment(a)) {
      continue;
    }
    if (!a.subjectId || (!a.facultyStaffLinkId && !a.hrmsEmployeeId)) {
      throw new Error(
        "Subject and Faculty are required for class periods (or enter a free/special label like CRT / Games)",
      );
    }
  }

  // Validate within payload: parallel assignments in same slot are allowed,
  // but prevent duplicate faculty or duplicate batch classification in same slot.
  const slotMap = new Map<string, AssignmentInput[]>();
  for (const a of input.assignments) {
    const day = toDayCode(String(a.dayOfWeek));
    const key = `${day}:${a.timingSlotId}`;
    const list = slotMap.get(key) ?? [];
    list.push(a);
    slotMap.set(key, list);
  }

  for (const [key, list] of slotMap.entries()) {
    if (list.length > 1) {
      const seenStaff = new Set<string>();
      const seenBatches = new Set<string>();
      for (const a of list) {
        const staffKey = a.hrmsEmployeeId || (a.facultyStaffLinkId ? String(a.facultyStaffLinkId) : "");
        if (staffKey) {
          if (seenStaff.has(staffKey)) {
            const [day, slotId] = key.split(":");
            const facLabel = a.facultyName
              ? `${a.facultyName}${a.hrmsEmployeeId ? ` (${a.hrmsEmployeeId})` : ""}`
              : "faculty member";
            throw new Error(
              `Faculty clash: ${facLabel} is assigned multiple times in the same slot on ${DAY_CODE_TO_LABEL[day as DayCode] ?? day} (slot ${slotId})`,
            );
          }
          seenStaff.add(staffKey);
        }
        const batch = (a.batchLabel ?? "").trim().toLowerCase();
        if (batch) {
          if (seenBatches.has(batch)) {
            const [day, slotId] = key.split(":");
            throw new Error(
              `Duplicate batch classification "${a.batchLabel}" in the same slot on ${DAY_CODE_TO_LABEL[day as DayCode] ?? day} (slot ${slotId})`,
            );
          }
          seenBatches.add(batch);
        }
      }
    }
  }

  // Verify subjects against EMS — do not trust client code/name/type
  const verifiedAssignments = await resolveAssignmentSubjectsFromEms(
    input.assignments,
  );

  const facultyContext = {
    collegeId: input.collegeId,
    branchId: input.branchId,
    actorUserId: input.actorUserId,
    ipAddress: input.ipAddress,
  };

  const publishedPlan = await findPublishedPlanForScope(planScopeFromDraftInput(input));
  const timingSlots = await listTimingSlots(timing.id);
  const resolvedAssignments: Array<AssignmentInput & { facultyStaffLinkId: number | null }> = [];
  for (const assignment of verifiedAssignments) {
    resolvedAssignments.push({
      ...assignment,
      facultyStaffLinkId: await resolveFacultyLink(assignment, facultyContext),
    });
  }

  let effectiveBatch = input.batch && input.batch !== "all" ? input.batch : "";
  if (!effectiveBatch && input.year) {
    effectiveBatch = (await resolveBatchForContext({
      academicYear: input.academicYear,
      collegeId: input.collegeId,
      courseId: input.courseId,
      branchId: input.branchId,
      year: input.year,
    })) ?? "";
  }
  const existingDraft = await queryAcademic<PlanRow[]>(
    `
    SELECT * FROM ap_timetable_plans
    WHERE academic_year_label = ?
      AND college_id = ?
      AND course_id = ?
      AND branch_id = ?
      AND (? = '' OR batch = ? OR batch IS NULL OR batch = '')
      AND (year_of_study = ? OR (? IS NULL AND year_of_study IS NULL))
      AND semester_number = ?
      AND ((? IS NULL AND (section_name IS NULL OR section_name = '')) OR section_name = ?)
      AND status IN ('draft','in_review')
    ORDER BY id DESC
    LIMIT 1
    `,
    [
      input.academicYear,
      input.collegeId,
      input.courseId,
      input.branchId,
      effectiveBatch,
      effectiveBatch,
      input.year ?? null,
      input.year ?? null,
      input.semester,
      input.section ?? null,
      input.section ?? null,
    ],
  );

  if (!existingDraft[0] && publishedPlan) {
    const publishedEntries = await loadEntries(publishedPlan.id);
    if (
      signatureSetsEqual(
        buildAssignmentSignatureSet(resolvedAssignments, timingSlots),
        buildEntrySignatureSet(publishedEntries, timingSlots),
      )
    ) {
      return {
        planId: publishedPlan.id,
        status: "published",
        versionNo: publishedPlan.version_no,
        timingTemplateId: timing.id,
        unchanged: true,
      };
    }
  }

  return withAcademicTransaction(async (conn) => {
    const [existingRows] = await conn.query<PlanRow[]>(
      `
      SELECT * FROM ap_timetable_plans
      WHERE academic_year_label = ?
        AND college_id = ?
        AND course_id = ?
        AND branch_id = ?
        AND (? = '' OR batch = ? OR batch IS NULL OR batch = '')
        AND (year_of_study = ? OR (? IS NULL AND year_of_study IS NULL))
        AND semester_number = ?
        AND ((? IS NULL AND (section_name IS NULL OR section_name = '')) OR section_name = ?)
        AND status IN ('draft','in_review')
      ORDER BY id DESC
      LIMIT 1
      `,
      [
        input.academicYear,
        input.collegeId,
        input.courseId,
        input.branchId,
        effectiveBatch,
        effectiveBatch,
        input.year ?? null,
        input.year ?? null,
        input.semester,
        input.section ?? null,
        input.section ?? null,
      ],
    );

    let planId = existingRows[0]?.id;
    let versionNo = existingRows[0]?.version_no ?? 1;

    if (!planId) {
      const [publishedRows] = await conn.query<PlanRow[]>(
        `
        SELECT version_no FROM ap_timetable_plans
        WHERE academic_year_label = ?
          AND college_id = ?
          AND course_id = ?
          AND branch_id = ?
          AND (? = '' OR batch = ? OR batch IS NULL OR batch = '')
          AND (year_of_study = ? OR (? IS NULL AND year_of_study IS NULL))
          AND semester_number = ?
          AND ((? IS NULL AND (section_name IS NULL OR section_name = '')) OR section_name = ?)
          AND status = 'published'
        ORDER BY version_no DESC
        LIMIT 1
        `,
        [
          input.academicYear,
          input.collegeId,
          input.courseId,
          input.branchId,
          effectiveBatch,
          effectiveBatch,
          input.year ?? null,
          input.year ?? null,
          input.semester,
          input.section ?? null,
          input.section ?? null,
        ],
      );
      versionNo = (publishedRows[0]?.version_no ?? 0) + 1;

      const [insertResult] = await conn.execute(
        `
        INSERT INTO ap_timetable_plans
          (academic_year_label, college_id, course_id, branch_id, batch, year_of_study,
           semester_number, section_name, timing_template_id, status, version_no, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)
        `,
        [
          input.academicYear,
          input.collegeId,
          input.courseId,
          input.branchId,
          effectiveBatch,
          input.year ?? null,
          input.semester,
          input.section ?? null,
          timing.id,
          versionNo,
          input.notes ?? null,
        ],
      );
      planId = Number((insertResult as { insertId: number }).insertId);
      await writeVersion(conn, planId, "created", { timingTemplateId: timing.id });
    } else {
      await conn.execute(
        `
        UPDATE ap_timetable_plans
        SET timing_template_id = ?, status = 'draft', notes = ?, year_of_study = ?
        WHERE id = ?
        `,
        [timing.id, input.notes ?? null, input.year ?? null, planId],
      );
      await writeVersion(conn, planId, "edited", {
        assignmentCount: verifiedAssignments.length,
      });
    }

    let previousFacultyIds: number[] = [];
    if (planId) {
      const [prevFacRows] = await conn.query<
        (RowDataPacket & { faculty_staff_link_id: number | null })[]
      >(
        `SELECT DISTINCT faculty_staff_link_id FROM ap_timetable_entries WHERE plan_id = ? AND faculty_staff_link_id IS NOT NULL`,
        [planId],
      );
      previousFacultyIds = prevFacRows
        .map((r) => Number(r.faculty_staff_link_id))
        .filter((id) => id > 0);
    }

    await conn.execute(`DELETE FROM ap_timetable_entries WHERE plan_id = ?`, [planId]);

    const newFacultyIds = new Set<number>();
    for (const a of verifiedAssignments) {
      const day = toDayCode(String(a.dayOfWeek));
      const facultyLinkId = await resolveFacultyLink(a, facultyContext);
      if (facultyLinkId) newFacultyIds.add(facultyLinkId);
      const customLabel = (a.customLabel ?? "").trim() || null;
      const batchLabel = (a.batchLabel ?? "").trim() || null;
      const studentIdsJson =
        Array.isArray(a.studentIds) && a.studentIds.length > 0
          ? JSON.stringify(a.studentIds)
          : null;
      const studentCount =
        typeof a.studentCount === "number"
          ? a.studentCount
          : Array.isArray(a.studentIds) && a.studentIds.length > 0
            ? a.studentIds.length
            : null;
      const weeklyRotation = a.weeklyRotation ? 1 : 0;
      const rotationPattern = (a.rotationPattern ?? "").trim() || null;

      await conn.execute(
        `
        INSERT INTO ap_timetable_entries
          (plan_id, day_of_week, period_slot_id, timing_slot_id, subject_id, subject_code,
           subject_name, subject_type_snapshot, entry_type, faculty_staff_link_id, room_label,
           batch_label, student_ids, student_count, weekly_rotation, rotation_pattern, custom_label)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          planId,
          day,
          a.timingSlotId,
          a.timingSlotId,
          a.subjectId ?? null,
          a.subjectCode ?? null,
          a.subjectName ?? null,
          a.subjectTypeSnapshot ?? null,
          a.entryType ?? "theory",
          facultyLinkId,
          a.roomLabel ?? null,
          batchLabel,
          studentIdsJson,
          studentCount,
          weeklyRotation,
          rotationPattern,
          customLabel,
        ],
      );
    }

    return {
      planId,
      status: "draft",
      versionNo,
      timingTemplateId: timing.id,
      previousFacultyIds,
      newFacultyIds: [...newFacultyIds],
    };
  }).then(async (result) => {
    // If faculty were removed from this timetable plan, check and sync user roles
    const removedFacultyIds = result.previousFacultyIds.filter(
      (id) => !result.newFacultyIds.includes(id),
    );
    if (removedFacultyIds.length > 0) {
      try {
        await syncStaffUserRolesForTimetableChanges({
          collegeId: input.collegeId,
          branchId: input.branchId,
          candidateStaffLinkIds: removedFacultyIds,
          actorUserId: input.actorUserId,
          ipAddress: input.ipAddress,
        });
      } catch (err) {
        console.warn("Could not sync user roles after timetable draft update", err);
      }
    }
    return {
      planId: result.planId,
      status: result.status,
      versionNo: result.versionNo,
      timingTemplateId: result.timingTemplateId,
    };
  });
}

export async function getTimetablePlanScope(planId: number) {
  const plans = await queryAcademic<PlanRow[]>(
    `SELECT id, college_id, branch_id FROM ap_timetable_plans WHERE id = ? LIMIT 1`,
    [planId],
  );
  const plan = plans[0];
  if (!plan) return null;
  return {
    collegeId: Number(plan.college_id),
    branchId: Number(plan.branch_id),
  };
}

export async function reviewTimetablePlan(planId: number) {
  const plans = await queryAcademic<PlanRow[]>(
    `SELECT * FROM ap_timetable_plans WHERE id = ? LIMIT 1`,
    [planId],
  );
  const plan = plans[0];
  if (!plan) throw new Error("Plan not found");
  if (!["draft", "in_review"].includes(plan.status)) {
    throw new Error(`Cannot review plan in status ${plan.status}`);
  }

  const entries = await loadEntries(planId);
  const review = await validatePlanAssignments(plan, entries, {
    requireComplete: false,
  });

  await executeAcademic(
    `UPDATE ap_timetable_plans SET status = 'in_review' WHERE id = ?`,
    [planId],
  );
  await executeAcademic(
    `
    INSERT INTO ap_timetable_versions (plan_id, action, reason, snapshot_json)
    VALUES (?, 'submitted', ?, ?)
    `,
    [planId, "Moved to review", JSON.stringify(review)],
  );

  return { planId, status: "in_review", review };
}

export async function publishTimetablePlan(
  planId: number,
  options?: { actorUserId?: number | null; ipAddress?: string | null },
) {
  const plans = await queryAcademic<PlanRow[]>(
    `SELECT * FROM ap_timetable_plans WHERE id = ? LIMIT 1`,
    [planId],
  );
  const plan = plans[0];
  if (!plan) throw new Error("Plan not found");
  if (!["draft", "in_review"].includes(plan.status)) {
    throw new Error(`Cannot publish plan in status ${plan.status}`);
  }

  // 1. Validate FIRST: fast failure in milliseconds without unnecessary writes
  const entries = await loadEntries(planId);
  const review = await validatePlanAssignments(plan, entries, {
    requireComplete: true,
  });
  if (review.unchanged) {
    const err = new Error(
      review.message ?? "This timetable is already published with no changes.",
    );
    (err as Error & { review?: unknown }).review = review;
    throw err;
  }
  if (!review.ok) {
    const err = new Error("Publish blocked: timetable has validation errors");
    (err as Error & { review?: unknown }).review = review;
    throw err;
  }

  // 2. Only after validation succeeds: freeze current EMS subject labels into entry snapshots
  const snapshotRefresh = await refreshEntrySubjectSnapshots(planId);

  // 3. Ensure staff user profiles for unique faculty only (once per faculty, not per slot)
  const uniqueFacultyIds = [
    ...new Set(
      entries
        .map((e) => e.faculty_staff_link_id)
        .filter((id): id is number => typeof id === "number" && id > 0),
    ),
  ];
  for (const facultyId of uniqueFacultyIds) {
    try {
      await ensureStaffUserForSubjectAssignment({
        facultyStaffLinkId: facultyId,
        collegeId: plan.college_id,
        branchId: plan.branch_id,
        actorUserId: options?.actorUserId,
        ipAddress: options?.ipAddress,
      });
    } catch (err) {
      console.warn("Could not ensure staff user profile on publish for faculty", facultyId, err);
    }
  }

  return withAcademicTransaction(async (conn) => {
    // Find faculty in existing published plans that will be superseded
    const [supersededFacultyRows] = await conn.query<
      (RowDataPacket & { faculty_staff_link_id: number | null })[]
    >(
      `
      SELECT DISTINCT e.faculty_staff_link_id
      FROM ap_timetable_entries e
      INNER JOIN ap_timetable_plans p ON p.id = e.plan_id
      WHERE p.academic_year_label = ?
        AND p.college_id = ?
        AND p.course_id = ?
        AND p.branch_id = ?
        AND (p.batch = ? OR p.batch IS NULL OR p.batch = '')
        AND (p.year_of_study = ? OR (? IS NULL AND p.year_of_study IS NULL))
        AND p.semester_number = ?
        AND ((? IS NULL AND (p.section_name IS NULL OR p.section_name = '')) OR p.section_name = ?)
        AND p.status = 'published'
        AND p.id <> ?
        AND e.faculty_staff_link_id IS NOT NULL
      `,
      [
        plan.academic_year_label,
        plan.college_id,
        plan.course_id,
        plan.branch_id,
        plan.batch,
        plan.year_of_study,
        plan.year_of_study,
        plan.semester_number,
        plan.section_name,
        plan.section_name,
        planId,
      ],
    );
    const candidateFacultyIds = supersededFacultyRows
      .map((r) => Number(r.faculty_staff_link_id))
      .filter((id) => id > 0);

    await conn.execute(
      `
      UPDATE ap_timetable_plans
      SET status = 'superseded'
      WHERE academic_year_label = ?
        AND college_id = ?
        AND course_id = ?
        AND branch_id = ?
        AND (batch = ? OR batch IS NULL OR batch = '')
        AND (year_of_study = ? OR (? IS NULL AND year_of_study IS NULL))
        AND semester_number = ?
        AND ((? IS NULL AND (section_name IS NULL OR section_name = '')) OR section_name = ?)
        AND status = 'published'
        AND id <> ?
      `,
      [
        plan.academic_year_label,
        plan.college_id,
        plan.course_id,
        plan.branch_id,
        plan.batch,
        plan.year_of_study,
        plan.year_of_study,
        plan.semester_number,
        plan.section_name,
        plan.section_name,
        planId,
      ],
    );

    // Cancel unposted scheduled sessions from superseded plans so they don't produce duplicate slots
    await conn.execute(
      `
      UPDATE ap_class_sessions cs
      INNER JOIN ap_timetable_plans p ON p.id = cs.plan_id
      SET cs.status = 'cancelled'
      WHERE p.status = 'superseded'
        AND cs.status = 'scheduled'
        AND NOT EXISTS (
          SELECT 1 FROM ap_attendance_posts ap WHERE ap.class_session_id = cs.id
        )
      `,
    );

    await conn.execute(
      `
      UPDATE ap_timetable_plans
      SET status = 'published', published_at = NOW()
      WHERE id = ?
      `,
      [planId],
    );

    await writeVersion(
      conn,
      planId,
      "published",
      { review, subjectSnapshotsRefreshed: snapshotRefresh.refreshed },
      "Published",
    );

    // Mark superseded versions history on previous plans
    const [prev] = await conn.query<PlanRow[]>(
      `
      SELECT id FROM ap_timetable_plans
      WHERE status = 'superseded'
        AND academic_year_label = ?
        AND college_id = ?
        AND course_id = ?
        AND branch_id = ?
        AND batch = ?
        AND semester_number = ?
        AND ((? IS NULL AND (section_name IS NULL OR section_name = '')) OR section_name = ?)
      `,
      [
        plan.academic_year_label,
        plan.college_id,
        plan.course_id,
        plan.branch_id,
        plan.batch,
        plan.semester_number,
        plan.section_name,
        plan.section_name,
      ],
    );
    for (const row of prev) {
      await writeVersion(conn, row.id, "superseded", { byPlanId: planId });
    }

    return {
      planId,
      status: "published",
      versionNo: plan.version_no,
      review,
      subjectSnapshotsRefreshed: snapshotRefresh.refreshed,
      candidateFacultyIds,
    };
  }).then(async (result) => {
    // If faculty were teaching in the superseded plans, check if they have any remaining active teaching assignments
    if (result.candidateFacultyIds?.length) {
      try {
        await syncStaffUserRolesForTimetableChanges({
          collegeId: plan.college_id,
          branchId: plan.branch_id,
          candidateStaffLinkIds: result.candidateFacultyIds,
          actorUserId: options?.actorUserId,
          ipAddress: options?.ipAddress,
        });
      } catch (err) {
        console.warn("Could not sync user roles after timetable publish", err);
      }
    }
    // Immediately generate and sync class sessions for today so staff see the published classes right away
    try {
      const todayIso = new Date().toISOString().slice(0, 10);
      await ensureSessionsForDate(todayIso, { publishedTimetablePlanId: result.planId });
    } catch (err) {
      console.warn("Could not generate class sessions after timetable publish", err);
    }

    return {
      planId: result.planId,
      status: result.status,
      versionNo: result.versionNo,
      review: result.review,
      subjectSnapshotsRefreshed: result.subjectSnapshotsRefreshed,
    };
  });
}

export async function getTimetableVersions(planId: number) {
  const rows = await queryAcademic<
    (RowDataPacket & {
      id: number;
      plan_id: number;
      action: string;
      reason: string | null;
      created_at: string;
    })[]
  >(
    `
    SELECT id, plan_id, action, reason, created_at
    FROM ap_timetable_versions
    WHERE plan_id = ?
    ORDER BY id DESC
    `,
    [planId],
  );
  return rows;
}

export async function copyTimetablePlan(input: {
  sourcePlanId: number;
  target: {
    collegeId: number;
    courseId: number;
    branchId: number;
    academicYear: string;
    batch: string;
    year?: number | null;
    semester: number;
    section?: string | null;
  };
  actorUserId?: number | null;
  ipAddress?: string | null;
}) {
  const sourcePlans = await queryAcademic<PlanRow[]>(
    `SELECT * FROM ap_timetable_plans WHERE id = ? LIMIT 1`,
    [input.sourcePlanId],
  );
  const source = sourcePlans[0];
  if (!source) throw new Error("Source plan not found");

  const targetTiming = await getActiveTimingForContext({
    collegeId: input.target.collegeId,
    academicYear: input.target.academicYear,
    semester: input.target.semester,
  });
  if (!targetTiming) {
    throw new Error("Target college has no active timing template for year/semester");
  }

  const sourceEntries = await loadEntries(source.id);
  const sourceSlots = source.timing_template_id
    ? await listTimingSlots(source.timing_template_id)
    : [];

  // Map by day + label + start/end when possible
  const assignments: AssignmentInput[] = [];
  for (const entry of sourceEntries) {
    const srcSlotId = entry.timing_slot_id ?? entry.period_slot_id;
    const srcSlot = sourceSlots.find((s) => s.id === srcSlotId);
    if (!srcSlot || !srcSlot.isAssignable) continue;
    const targetSlot = targetTiming.slots.find(
      (s) =>
        s.dayOfWeek === srcSlot.dayOfWeek &&
        s.label === srcSlot.label &&
        s.startTime === srcSlot.startTime &&
        s.endTime === srcSlot.endTime &&
        s.isAssignable,
    );
    if (!targetSlot) continue;
    assignments.push({
      dayOfWeek: entry.day_of_week,
      timingSlotId: targetSlot.id,
      subjectId: entry.subject_id,
      subjectCode: entry.subject_code,
      subjectName: entry.subject_name,
      entryType: (entry.entry_type as "theory" | "lab" | "other") || "theory",
      facultyStaffLinkId: entry.faculty_staff_link_id,
      roomLabel: entry.room_label,
      customLabel: entry.custom_label,
      batchLabel: entry.batch_label ?? "",
      weeklyRotation: Boolean(entry.weekly_rotation),
      rotationPattern: entry.rotation_pattern ?? null,
    });
  }

  return saveTimetableDraft({
    ...input.target,
    notes: `Copied from plan #${source.id}`,
    assignments,
    actorUserId: input.actorUserId,
    ipAddress: input.ipAddress,
  });
}

export type CombineSectionsInput = {
  collegeId: number;
  courseId: number;
  branchId: number;
  academicYear: string;
  batch: string;
  year?: number | null;
  semester: number;
  mainSection: string;
  targetSections: string[];
  publish?: boolean;
  actorUserId?: number | null;
  ipAddress?: string | null;
};

export async function combineTimetableSections(input: CombineSectionsInput) {
  const mainSection = input.mainSection?.trim();
  if (!mainSection) {
    throw new Error("Main (source) section is required.");
  }

  const targetSections = (input.targetSections ?? [])
    .map((s) => s.trim())
    .filter((s) => s && s.toLowerCase() !== mainSection.toLowerCase());

  if (targetSections.length === 0) {
    throw new Error(`Please select at least one target section to combine with Section ${mainSection}.`);
  }

  let combineBatch = input.batch && input.batch !== "all" ? input.batch : "";
  if (!combineBatch && input.year) {
    combineBatch = (await resolveBatchForContext({
      academicYear: input.academicYear,
      collegeId: input.collegeId,
      courseId: input.courseId,
      branchId: input.branchId,
      year: input.year,
    })) ?? "";
  }
  // 1. Find the current active plan for mainSection
  const sourcePlans = await queryAcademic<PlanRow[]>(
    `
    SELECT * FROM ap_timetable_plans
    WHERE academic_year_label = ?
      AND college_id = ?
      AND course_id = ?
      AND branch_id = ?
      AND (? = '' OR batch = ? OR batch IS NULL OR batch = '')
      AND (year_of_study = ? OR (? IS NULL AND year_of_study IS NULL))
      AND semester_number = ?
      AND section_name = ?
      AND status IN ('published', 'in_review', 'draft')
    ORDER BY CASE status WHEN 'published' THEN 1 WHEN 'in_review' THEN 2 ELSE 3 END, id DESC
    LIMIT 1
    `,
    [
      input.academicYear,
      input.collegeId,
      input.courseId,
      input.branchId,
      combineBatch,
      combineBatch,
      input.year ?? null,
      input.year ?? null,
      input.semester,
      mainSection,
    ],
  );

  const sourcePlan = sourcePlans[0];
  if (!sourcePlan) {
    throw new Error(`No timetable plan found for main Section ${mainSection}. Please create and save periods for Section ${mainSection} first.`);
  }

  // 2. Load entries from sourcePlan
  const sourceEntries = await loadEntries(sourcePlan.id);
  if (sourceEntries.length === 0) {
    throw new Error(`Main Section ${mainSection} timetable has no periods assigned yet.`);
  }

  const sourceSlots = sourcePlan.timing_template_id
    ? await listTimingSlots(sourcePlan.timing_template_id)
    : [];

  const targetTiming = await getActiveTimingForContext({
    collegeId: input.collegeId,
    academicYear: input.academicYear,
    semester: input.semester,
  });
  if (!targetTiming) {
    throw new Error("Active timing template not found for year/semester.");
  }

  // Map entries into assignments
  const assignments: AssignmentInput[] = [];
  for (const entry of sourceEntries) {
    const srcSlotId = entry.timing_slot_id ?? entry.period_slot_id;
    const srcSlot = sourceSlots.find((s) => s.id === srcSlotId);
    if (!srcSlot || !srcSlot.isAssignable) continue;
    const targetSlot = targetTiming.slots.find(
      (s) =>
        s.dayOfWeek === srcSlot.dayOfWeek &&
        s.label === srcSlot.label &&
        s.startTime === srcSlot.startTime &&
        s.endTime === srcSlot.endTime &&
        s.isAssignable,
    );
    if (!targetSlot) continue;
    assignments.push({
      dayOfWeek: entry.day_of_week,
      timingSlotId: targetSlot.id,
      subjectId: entry.subject_id,
      subjectCode: entry.subject_code,
      subjectName: entry.subject_name,
      entryType: (entry.entry_type as "theory" | "lab" | "other") || "theory",
      facultyStaffLinkId: entry.faculty_staff_link_id,
      roomLabel: entry.room_label,
      customLabel: entry.custom_label,
      batchLabel: entry.batch_label ?? "",
      weeklyRotation: Boolean(entry.weekly_rotation),
      rotationPattern: entry.rotation_pattern ?? null,
    });
  }

  if (assignments.length === 0) {
    throw new Error("Could not map any period slots from the main section to the target timing template.");
  }

  const results: Array<{
    section: string;
    planId: number;
    status: string;
    versionNo: number;
    copiedAssignmentsCount: number;
  }> = [];

  const shouldPublish = input.publish ?? (sourcePlan.status === "published");

  for (const targetSection of targetSections) {
    const draftResult = await saveTimetableDraft({
      collegeId: input.collegeId,
      courseId: input.courseId,
      branchId: input.branchId,
      academicYear: input.academicYear,
      batch: input.batch,
      year: input.year ?? null,
      semester: input.semester,
      section: targetSection,
      notes: `Combined from Section ${mainSection} (Plan #${sourcePlan.id})`,
      assignments,
      actorUserId: input.actorUserId,
      ipAddress: input.ipAddress,
    });

    let finalStatus = draftResult.status;
    let finalVersion = draftResult.versionNo;

    if (shouldPublish) {
      try {
        const pubResult = await publishTimetablePlan(draftResult.planId, {
          actorUserId: input.actorUserId,
          ipAddress: input.ipAddress,
        });
        finalStatus = pubResult.status;
        finalVersion = pubResult.versionNo;
      } catch (pubErr) {
        console.warn(`Could not auto-publish combined section ${targetSection}`, pubErr);
      }
    }

    results.push({
      section: targetSection,
      planId: draftResult.planId,
      status: finalStatus,
      versionNo: finalVersion,
      copiedAssignmentsCount: assignments.length,
    });
  }

  return {
    success: true,
    mainSection,
    sourcePlanId: sourcePlan.id,
    sourcePlanStatus: sourcePlan.status,
    totalAssignments: assignments.length,
    results,
    message: `Successfully combined timetable: Section ${mainSection} copied to Section${results.length > 1 ? "s" : ""} ${results.map((r) => r.section).join(", ")}.`,
  };
}

export type CombinedBranchesOverviewFilters = {
  collegeId: number;
  courseId: number;
  academicYear: string;
  batch?: string | null;
  year?: number | null;
  semester: number;
  section?: string | null;
  sections?: string[] | null;
  branchSections?: Record<number, string[]> | null;
};

export async function getCombinedBranchesOverview(filters: CombinedBranchesOverviewFilters) {
  // 1. Get all branches for this course
  const branchRows = await queryStudent<
    (RowDataPacket & {
      id: number;
      name: string;
      code: string | null;
      course_id: number;
      metadata?: string | unknown;
    })[]
  >(
    `
    SELECT id, name, code, course_id, metadata
    FROM course_branches
    WHERE course_id = ? AND (is_active = 1 OR is_active IS NULL)
    ORDER BY name
    `,
    [filters.courseId],
  );

  const branchIds = branchRows.map((b) => b.id);
  if (branchIds.length === 0) {
    return { branches: [], timing: null };
  }

  // 2. Get active timing template for context
  const timing = await getActiveTimingForContext({
    collegeId: filters.collegeId,
    academicYear: filters.academicYear,
    semester: filters.semester,
  });

  // Resolve batch if not explicitly provided
  const resolvedBatch =
    filters.batch?.trim() ||
    (filters.academicYear && filters.year
      ? String(Number(filters.academicYear.slice(0, 4)) - (filters.year - 1))
      : null);

  // 3. Get plans for each branch with section-wise filtering
  const secFilter = filters.section && filters.section !== "all" ? filters.section : null;
  const rawSections = (filters.sections ?? [])
    .map((s) => String(s).trim())
    .filter((s) => s && s.toLowerCase() !== "all");

  if (filters.branchSections && typeof filters.branchSections === "object") {
    for (const secs of Object.values(filters.branchSections)) {
      if (Array.isArray(secs)) {
        for (const s of secs) {
          const trimmed = String(s).trim();
          if (trimmed && trimmed.toLowerCase() !== "all" && !rawSections.includes(trimmed)) {
            rawSections.push(trimmed);
          }
        }
      }
    }
  }

  let sectionClause = "(? IS NULL OR p.section_name = ? OR p.section_name IS NULL)";
  let sectionParams: unknown[] = [secFilter, secFilter];

  if (rawSections.length > 0) {
    const placeholders = rawSections.map(() => "?").join(",");
    sectionClause = `(p.section_name IN (${placeholders}) OR p.section_name IS NULL)`;
    sectionParams = rawSections;
  }

  const planRows = await queryAcademic<(PlanRow & { timing_template_name?: string })[]>(
    `
    SELECT p.*, tt.name AS timing_template_name
    FROM ap_timetable_plans p
    LEFT JOIN ap_timing_templates tt ON tt.id = p.timing_template_id
    WHERE p.academic_year_label = ?
      AND p.college_id = ?
      AND p.course_id = ?
      AND p.branch_id IN (${branchIds.map(() => "?").join(",")})
      AND (? IS NULL OR p.batch = ? OR p.batch = '' OR p.batch IS NULL)
      AND p.semester_number = ?
      AND ${sectionClause}
      AND p.status IN ('published', 'in_review', 'draft')
    ORDER BY FIELD(p.status, 'published', 'in_review', 'draft'), p.version_no DESC, p.id DESC
    `,
    [
      filters.academicYear,
      filters.collegeId,
      filters.courseId,
      ...branchIds,
      resolvedBatch,
      resolvedBatch,
      filters.semester,
      ...sectionParams,
    ],
  );

  // Group latest plan per branch
  const planByBranch = new Map<number, PlanRow & { timing_template_name?: string }>();
  for (const row of planRows) {
    if (!planByBranch.has(row.branch_id)) {
      planByBranch.set(row.branch_id, row);
    }
  }

  // 4. For branches with plans, load their entries
  const branchDetails = [];
  for (const branch of branchRows) {
    const plan = planByBranch.get(branch.id);
    let entriesSummary: Array<{
      id: number;
      dayOfWeek: string;
      timingSlotId: number;
      subjectId: number | null;
      subjectCode: string | null;
      subjectName: string | null;
      subjectTypeSnapshot?: string | null;
      entryType: string;
      facultyStaffLinkId: number | null;
      facultyName: string | null;
      facultyHrmsId: string | null;
      roomLabel: string | null;
      batchLabel: string | null;
      customLabel: string | null;
      weeklyRotation?: boolean;
      rotationPattern?: string | null;
    }> = [];

    if (plan) {
      const rawEntries = await loadEntries(plan.id);
      entriesSummary = rawEntries.map((e) => ({
        id: e.id,
        dayOfWeek: e.day_of_week,
        timingSlotId: e.timing_slot_id ?? e.period_slot_id,
        subjectId: e.subject_id,
        subjectCode: e.subject_code,
        subjectName: e.subject_name,
        subjectTypeSnapshot: e.subject_type_snapshot,
        entryType: e.entry_type,
        facultyStaffLinkId: e.faculty_staff_link_id,
        facultyName: e.faculty_name ?? null,
        facultyHrmsId: e.faculty_hrms_id ?? null,
        roomLabel: e.room_label,
        batchLabel: e.batch_label ?? null,
        customLabel: e.custom_label ?? null,
        weeklyRotation: Boolean(e.weekly_rotation),
        rotationPattern: e.rotation_pattern ?? null,
      }));
    }

    const parsedSec = parseBranchSections(branch.metadata);
    const hasSections = parsedSec.enabled && parsedSec.items.length > 0;
    const branchSections = parsedSec.items.map((i) => i.name);

    branchDetails.push({
      branchId: branch.id,
      branchName: branch.name,
      branchCode: branch.code,
      hasSections,
      sections: branchSections,
      plan: plan
        ? {
            id: plan.id,
            status: plan.status,
            versionNo: plan.version_no,
            timingTemplateName: plan.timing_template_name ?? null,
            sectionName: plan.section_name ?? null,
            notes: plan.notes ?? null,
            assignedCount: entriesSummary.length,
            entries: entriesSummary,
          }
        : null,
    });
  }

  return {
    branches: branchDetails,
    timing: timing
      ? {
          id: timing.id,
          name: timing.name,
          academicYear: timing.academicYear,
          semester: timing.semester,
          slots: timing.slots,
        }
      : null,
  };
}

export async function getCombinedSubjects(filters: {
  collegeId: number;
  courseId: number;
  batch?: string | null;
  year?: number | null;
  semester: number;
  branchIds: number[];
  academicYear?: string | null;
}) {
  if (!filters.branchIds || filters.branchIds.length === 0) {
    return [];
  }

  const resolvedBatch =
    filters.batch?.trim() ||
    (filters.academicYear && filters.year
      ? String(Number(filters.academicYear.slice(0, 4)) - (filters.year - 1))
      : null);

  const where: string[] = [
    "sme.collegeId = ?",
    "sme.courseId = ?",
    `sme.branchId IN (${filters.branchIds.map(() => "?").join(",")})`,
    "(s.status = 'active' OR s.status IS NULL OR s.status = '')",
  ];
  const params: unknown[] = [
    filters.collegeId,
    filters.courseId,
    ...filters.branchIds,
  ];

  if (resolvedBatch) {
    where.push("(sme.batch = ? OR sme.batch IS NULL OR sme.batch = '')");
    params.push(resolvedBatch);
  }

  if (filters.year != null) {
    where.push("sme.yearOfStudy = ?");
    params.push(filters.year);
  }
  if (filters.semester != null) {
    where.push("sme.semester = ?");
    params.push(filters.semester);
  }

  const rows = await queryExam<
    (RowDataPacket & {
      id: number;
      code: string;
      name: string;
      type: string;
      semester: number | null;
      yearOfStudy: number | null;
      branchId: number;
      branchName: string | null;
    })[]
  >(
    `
    SELECT
      s.id,
      s.code,
      s.name,
      s.type,
      sme.semester,
      sme.yearOfStudy,
      sme.branchId,
      sme.branchName
    FROM subject_mapping_entries sme
    INNER JOIN subjects s ON s.id = sme.subjectId
    WHERE ${where.join(" AND ")}
    ORDER BY s.code, sme.id
    LIMIT 400
    `,
    params,
  );

  const subjectMap = new Map<
    number,
    {
      id: number;
      code: string;
      name: string;
      type: string;
      semester: number | null;
      year: number | null;
      branchIds: number[];
      branchNames: string[];
      isCommon: boolean;
    }
  >();

  for (const r of rows) {
    const existing = subjectMap.get(r.id);
    if (!existing) {
      subjectMap.set(r.id, {
        id: r.id,
        code: r.code,
        name: r.name,
        type: r.type,
        semester: r.semester,
        year: r.yearOfStudy,
        branchIds: [r.branchId],
        branchNames: r.branchName ? [r.branchName] : [],
        isCommon: false,
      });
    } else {
      if (!existing.branchIds.includes(r.branchId)) {
        existing.branchIds.push(r.branchId);
      }
      if (r.branchName && !existing.branchNames.includes(r.branchName)) {
        existing.branchNames.push(r.branchName);
      }
    }
  }

  const totalSelectedBranches = filters.branchIds.length;
  const list = Array.from(subjectMap.values()).map((s) => ({
    ...s,
    isCommon: totalSelectedBranches > 1 && s.branchIds.length >= totalSelectedBranches,
  }));

  return list.sort((a, b) => {
    if (a.isCommon && !b.isCommon) return -1;
    if (!a.isCommon && b.isCommon) return 1;
    return a.code.localeCompare(b.code);
  });
}

export type SaveCombinedTimetableInput = {
  collegeId: number;
  courseId: number;
  branchIds: number[];
  academicYear: string;
  batch?: string | null;
  year?: number | null;
  semester: number;
  section?: string | null;
  sections?: string[] | null;
  sectionMode?: "all" | "custom" | null;
  branchSections?: Record<number, string[]> | null;
  notes?: string | null;
  assignments: AssignmentInput[];
  publish?: boolean;
  actorUserId?: number | null;
  ipAddress?: string | null;
};

export async function saveCombinedTimetable(input: SaveCombinedTimetableInput) {
  const branchIds = (input.branchIds ?? []).map(Number).filter((id) => id > 0);
  if (branchIds.length === 0) {
    throw new Error("Please select at least one branch for the combination.");
  }

  // Load branch records to know metadata / sections configuration
  const branchRows = await queryStudent<
    (RowDataPacket & {
      id: number;
      name: string;
      code: string | null;
      course_id: number;
      metadata?: string | unknown;
    })[]
  >(
    `
    SELECT id, name, code, course_id, metadata
    FROM course_branches
    WHERE id IN (${branchIds.map(() => "?").join(",")})
    `,
    branchIds,
  );
  const branchMap = new Map(branchRows.map((b) => [b.id, b]));

  const resolvedBatch =
    input.batch?.trim() ||
    (input.academicYear && input.year
      ? String(Number(input.academicYear.slice(0, 4)) - (input.year - 1))
      : String(Number(input.academicYear.slice(0, 4))));

  const results: Array<{
    branchId: number;
    branchName: string;
    branchCode: string | null;
    section: string | null;
    planId: number;
    status: string;
    versionNo: number;
    assignedCount: number;
  }> = [];

  // Normalize requested sections
  const rawSections = (input.sections ?? [])
    .map((s) => String(s).trim())
    .filter((s) => s && s.toLowerCase() !== "all");

  for (const branchId of branchIds) {
    const branch = branchMap.get(branchId);
    const branchName = branch?.name ?? `Branch ${branchId}`;
    const branchCode = branch?.code ?? null;
    const parsedMeta = branch ? parseBranchSections(branch.metadata) : { enabled: false, items: [] };
    const branchHasSections = parsedMeta.enabled && parsedMeta.items.length > 0;
    const branchSectionNames = parsedMeta.items.map((i) => i.name);

    // Determine target section(s) for this branch
    let targetSectionsForBranch: (string | null)[] = [];
    if (branchHasSections) {
      if (
        input.branchSections &&
        input.branchSections[branchId] &&
        Array.isArray(input.branchSections[branchId]) &&
        input.branchSections[branchId].length > 0
      ) {
        // Branch-specific section selection takes highest priority
        const specific = input.branchSections[branchId];
        const matched = branchSectionNames.filter((sec) =>
          specific.some((s) => s.toLowerCase() === sec.toLowerCase())
        );
        targetSectionsForBranch = matched.length > 0 ? matched : branchSectionNames;
      } else if (rawSections.length > 0) {
        const matched = branchSectionNames.filter((sec) =>
          rawSections.some((rs) => rs.toLowerCase() === sec.toLowerCase())
        );
        targetSectionsForBranch = matched.length > 0 ? matched : branchSectionNames;
      } else if (input.section && input.section !== "all") {
        targetSectionsForBranch = [input.section];
      } else {
        // "all" mode: save for all sections this branch has
        targetSectionsForBranch = branchSectionNames;
      }
    } else {
      // Single cohort branch with no sections
      targetSectionsForBranch = [null];
    }

    const branchAssignments = input.assignments.filter((a) => {
      if (Array.isArray(a.participatingBranchIds) && a.participatingBranchIds.length > 0) {
        return a.participatingBranchIds.includes(branchId);
      }
      return true;
    });

    for (const targetSec of targetSectionsForBranch) {
      const draftResult = await saveTimetableDraft({
        collegeId: input.collegeId,
        courseId: input.courseId,
        branchId,
        academicYear: input.academicYear,
        batch: resolvedBatch,
        year: input.year ?? null,
        semester: input.semester,
        section: targetSec,
        notes: input.notes ?? `Combined classes across ${branchIds.length} branches`,
        assignments: branchAssignments,
        actorUserId: input.actorUserId,
        ipAddress: input.ipAddress,
      });

      let finalStatus = draftResult.status;
      let finalVersion = draftResult.versionNo;

      if (input.publish) {
        try {
          const pubResult = await publishTimetablePlan(draftResult.planId, {
            actorUserId: input.actorUserId,
            ipAddress: input.ipAddress,
          });
          finalStatus = pubResult.status;
          finalVersion = pubResult.versionNo;
        } catch (pubErr) {
          console.warn(`Could not auto-publish combined timetable for branch ${branchId} section ${targetSec}:`, pubErr);
        }
      }

      results.push({
        branchId,
        branchName,
        branchCode,
        section: targetSec,
        planId: draftResult.planId,
        status: finalStatus,
        versionNo: finalVersion,
        assignedCount: branchAssignments.length,
      });
    }
  }

  const branchSummaryItems = branchIds
    .map((bid) => {
      const b = branchMap.get(bid);
      const bName = b?.code || b?.name || `Branch #${bid}`;
      const secs = input.branchSections?.[bid];
      if (secs && secs.length > 0) {
        return `${bName} (${secs.join(", ")})`;
      }
      return null;
    })
    .filter(Boolean);

  const sectionSummary = branchSummaryItems.length > 0
    ? branchSummaryItems.join(" + ")
    : rawSections.length > 0
    ? `Custom Sections (${rawSections.join(", ")})`
    : (input.section && input.section !== "all" ? `Section ${input.section}` : "All Sections");

  return {
    success: true,
    totalBranches: branchIds.length,
    totalPlans: results.length,
    totalAssignments: input.assignments.length,
    published: Boolean(input.publish),
    results,
    message: `Successfully ${input.publish ? "published" : "saved draft"} combined timetable across ${branchIds.length} branches (${sectionSummary}) with ${results.length} timetable plan${results.length === 1 ? "" : "s"}.`,
  };
}

export async function cloneCombinedTimetable(input: {
  collegeId: number;
  courseId: number;
  sourceBranchId: number;
  sourceSection?: string | null;
  targetBranchIds: number[];
  academicYear: string;
  batch: string;
  year?: number | null;
  semester: number;
  publish?: boolean;
  actorUserId?: number | null;
  ipAddress?: string | null;
}) {
  const targetBranchIds = (input.targetBranchIds ?? [])
    .map(Number)
    .filter((id) => id > 0 && id !== input.sourceBranchId);

  if (targetBranchIds.length === 0) {
    throw new Error("Please select at least one target branch different from the source branch.");
  }

  const secFilter = input.sourceSection && input.sourceSection !== "all" ? input.sourceSection : null;
  const sourcePlans = await queryAcademic<PlanRow[]>(
    `
    SELECT * FROM ap_timetable_plans
    WHERE academic_year_label = ?
      AND college_id = ?
      AND course_id = ?
      AND branch_id = ?
      AND batch = ?
      AND semester_number = ?
      AND (? IS NULL OR section_name = ? OR section_name IS NULL)
      AND status IN ('published', 'in_review', 'draft')
    ORDER BY CASE status WHEN 'published' THEN 1 WHEN 'in_review' THEN 2 ELSE 3 END, id DESC
    LIMIT 1
    `,
    [
      input.academicYear,
      input.collegeId,
      input.courseId,
      input.sourceBranchId,
      input.batch,
      input.semester,
      secFilter,
      secFilter,
    ],
  );

  const sourcePlan = sourcePlans[0];
  if (!sourcePlan) {
    throw new Error("No timetable plan found for the source branch.");
  }

  const sourceEntries = await loadEntries(sourcePlan.id);
  if (sourceEntries.length === 0) {
    throw new Error("Source branch timetable has no periods assigned yet.");
  }

  const sourceSlots = sourcePlan.timing_template_id
    ? await listTimingSlots(sourcePlan.timing_template_id)
    : [];

  const targetTiming = await getActiveTimingForContext({
    collegeId: input.collegeId,
    academicYear: input.academicYear,
    semester: input.semester,
  });
  if (!targetTiming) {
    throw new Error("Active timing template not found for year/semester.");
  }

  const assignments: AssignmentInput[] = [];
  for (const entry of sourceEntries) {
    const srcSlotId = entry.timing_slot_id ?? entry.period_slot_id;
    const srcSlot = sourceSlots.find((s) => s.id === srcSlotId);
    if (!srcSlot || !srcSlot.isAssignable) continue;
    const targetSlot = targetTiming.slots.find(
      (s) =>
        s.dayOfWeek === srcSlot.dayOfWeek &&
        s.label === srcSlot.label &&
        s.startTime === srcSlot.startTime &&
        s.endTime === srcSlot.endTime &&
        s.isAssignable,
    );
    if (!targetSlot) continue;
    assignments.push({
      dayOfWeek: entry.day_of_week,
      timingSlotId: targetSlot.id,
      subjectId: entry.subject_id,
      subjectCode: entry.subject_code,
      subjectName: entry.subject_name,
      entryType: (entry.entry_type as "theory" | "lab" | "other") || "theory",
      facultyStaffLinkId: entry.faculty_staff_link_id,
      roomLabel: entry.room_label,
      customLabel: entry.custom_label,
      batchLabel: entry.batch_label ?? "",
      weeklyRotation: Boolean(entry.weekly_rotation),
      rotationPattern: entry.rotation_pattern ?? null,
    });
  }

  if (assignments.length === 0) {
    throw new Error("Could not map any period slots from the source branch to the target timing template.");
  }

  return saveCombinedTimetable({
    collegeId: input.collegeId,
    courseId: input.courseId,
    branchIds: targetBranchIds,
    academicYear: input.academicYear,
    batch: input.batch,
    year: input.year,
    semester: input.semester,
    notes: `Replicated from Branch #${input.sourceBranchId} (Plan #${sourcePlan.id})`,
    assignments,
    publish: input.publish,
    actorUserId: input.actorUserId,
    ipAddress: input.ipAddress,
  });
}

export async function getTimetableCoverage(filters: TimetablePlannerFilters = {}) {
  const where: string[] = ["1=1"];
  const params: unknown[] = [];
  if (filters.collegeId) {
    where.push("college_id = ?");
    params.push(filters.collegeId);
  } else if (filters.collegeIds?.length) {
    where.push(`college_id IN (${filters.collegeIds.map(() => "?").join(",")})`);
    params.push(...filters.collegeIds);
  }
  if (filters.branchId) {
    where.push("branch_id = ?");
    params.push(filters.branchId);
  } else if (filters.branchIds?.length) {
    where.push(`branch_id IN (${filters.branchIds.map(() => "?").join(",")})`);
    params.push(...filters.branchIds);
  }
  if (filters.section && filters.section !== "all") {
    where.push("section_name = ?");
    params.push(filters.section);
  }

  try {
    const rows = await queryAcademic<
      (RowDataPacket & { total: number; published: number })[]
    >(
      `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published
      FROM ap_timetable_plans
      WHERE ${where.join(" AND ")}
      `,
      params,
    );
    return {
      sectionCount: 0,
      published: Number(rows[0]?.published ?? 0),
      totalPlans: Number(rows[0]?.total ?? 0),
      pendingSections: 0,
    };
  } catch {
    return { sectionCount: 0, published: 0, totalPlans: 0, pendingSections: 0 };
  }
}

// Kept for route compatibility; sections remain student-master data only.
export async function listTimetableSections(filters: TimetablePlannerFilters = {}) {
  const where: string[] = ["TRIM(IFNULL(ss.section_name, '')) <> ''"];
  const params: unknown[] = [];
  if (filters.branchId) {
    where.push("ss.branch_id = ?");
    params.push(filters.branchId);
  } else if (filters.branchIds?.length) {
    where.push(`ss.branch_id IN (${filters.branchIds.map(() => "?").join(",")})`);
    params.push(...filters.branchIds);
  }
  if (filters.section && filters.section !== "all") {
    where.push("TRIM(ss.section_name) = ?");
    params.push(filters.section);
  }
  if (filters.batch) {
    where.push("ss.batch = ?");
    params.push(filters.batch);
  }
  const rows = await queryStudent<
    (RowDataPacket & {
      branch_id: number;
      batch: string;
      semester_number: number | null;
      section_name: string;
      branch_name: string | null;
      student_count: number;
    })[]
  >(
    `
    SELECT ss.branch_id, ss.batch, TRIM(ss.section_name) AS section_name,
           cb.name AS branch_name, COUNT(*) AS student_count
    FROM student_sections ss
    LEFT JOIN course_branches cb ON cb.id = ss.branch_id
    WHERE ${where.join(" AND ")}
    GROUP BY ss.branch_id, ss.batch, TRIM(ss.section_name), cb.name
    ORDER BY cb.name, ss.batch, TRIM(ss.section_name)
    LIMIT 200
    `,
    params,
  );
  return rows.map((row) => ({
    branchId: row.branch_id,
    batch: row.batch,
    section: row.section_name,
    branchName: row.branch_name ?? `Branch ${row.branch_id}`,
    studentCount: Number(row.student_count),
  }));
}

export async function listTimetableReportRows(filters: TimetablePlannerFilters = {}) {
  const where = ["p.academic_year_label = ?", "p.status NOT IN ('superseded', 'archived')"];
  const params: unknown[] = [filters.academicYear ?? ""];
  if (filters.collegeId) {
    where.push("p.college_id = ?");
    params.push(filters.collegeId);
  }
  if (filters.courseId) {
    where.push("p.course_id = ?");
    params.push(filters.courseId);
  }
  if (filters.branchId) {
    where.push("p.branch_id = ?");
    params.push(filters.branchId);
  }
  const rows = await queryAcademic<
    (RowDataPacket & {
      plan_id: number;
      college_id: number;
      course_id: number;
      branch_id: number;
      batch: string;
      section_name: string | null;
      status: string;
      day_of_week: string | null;
      period_slot_id: number | null;
      subject_code: string | null;
      subject_name: string | null;
      custom_label: string | null;
      room_label: string | null;
      slot_label: string | null;
      slot_start: string | null;
      slot_end: string | null;
      slot_type: string | null;
      slot_order: number | null;
      faculty_name: string | null;
    })[]
  >(
    `
    SELECT p.id AS plan_id, p.college_id, p.course_id, p.branch_id, p.batch,
               p.section_name, p.status, p.semester_number, e.day_of_week, e.period_slot_id,
              e.subject_code, e.subject_name, e.custom_label, e.room_label,
              s.label AS slot_label, s.start_time AS slot_start, s.end_time AS slot_end,
              s.slot_type, s.slot_order, sl.display_name AS faculty_name
    FROM ap_timetable_plans p
    LEFT JOIN ap_timetable_entries e ON e.plan_id = p.id
    LEFT JOIN ap_timing_templates t ON t.college_id = p.college_id
      AND t.academic_year_label = p.academic_year_label
      AND t.semester_number = p.semester_number
      AND t.status = 'active'
    LEFT JOIN ap_timing_template_slots s ON s.template_id = t.id
      AND s.id = COALESCE(e.timing_slot_id, e.period_slot_id)
            LEFT JOIN ap_staff_link sl ON sl.id = e.faculty_staff_link_id
    WHERE ${where.join(" AND ")}
    ORDER BY p.college_id, p.course_id, p.branch_id, p.batch, p.section_name,
             e.day_of_week, e.period_slot_id
    `,
    params,
  );
  const timingCache = new Map<string, Awaited<ReturnType<typeof listTimingSlots>>>();
  for (const row of rows) {
    const key = `${row.college_id}:${filters.academicYear}:${row.semester_number ?? 0}`;
    if (timingCache.has(key) || !row.semester_number || !filters.academicYear) continue;
    const timing = await getActiveTimingForContext({
      collegeId: Number(row.college_id),
      academicYear: filters.academicYear,
      semester: Number(row.semester_number),
    });
    timingCache.set(key, timing ? await listTimingSlots(timing.id) : []);
  }
  const mapped = rows.map((row) => {
    const slots = timingCache.get(`${row.college_id}:${filters.academicYear}:${row.semester_number ?? 0}`) ?? [];
    const slot = slots.find((item) => item.id === Number(row.period_slot_id)) ??
      slots.find((item) => item.slotOrder === Number(row.period_slot_id));
    return {
    planId: Number(row.plan_id),
    collegeId: Number(row.college_id),
    courseId: Number(row.course_id),
    branchId: Number(row.branch_id),
    batch: row.batch,
    section: row.section_name,
    status: row.status,
    day: row.day_of_week,
    slotId: row.period_slot_id,
    label: row.subject_code || row.custom_label || row.subject_name || "Unassigned",
    subjectName: row.subject_name,
    room: row.room_label,
    slotLabel: slot?.label ?? row.slot_label,
    startTime: slot?.startTime ?? row.slot_start,
    endTime: slot?.endTime ?? row.slot_end,
    slotType: slot?.slotType ?? row.slot_type,
    slotOrder: slot?.slotOrder ?? row.slot_order,
    facultyName: row.faculty_name,
    };
  });
  const planKeys = new Map<string, typeof mapped[number]>();
  for (const row of mapped) {
    planKeys.set(`${row.planId}:${row.batch}`, row);
  }
  for (const sample of planKeys.values()) {
    const slots = timingCache.get(`${sample.collegeId}:${filters.academicYear}:${rows.find((row) => Number(row.plan_id) === sample.planId)?.semester_number ?? 0}`) ?? [];
    const existingSlotIds = new Set(mapped.filter((row) => row.planId === sample.planId).map((row) => row.slotId));
    for (const slot of slots) {
      if (existingSlotIds.has(slot.id)) continue;
      mapped.push({
        ...sample,
        day: null,
        slotId: slot.id,
        label: "",
        subjectName: null,
        room: null,
        slotLabel: slot.label,
        startTime: slot.startTime,
        endTime: slot.endTime,
        slotType: slot.slotType,
        slotOrder: slot.slotOrder,
        facultyName: null,
      });
    }
  }
  return mapped;
}

export async function getTimingTemplateForFilters(filters: TimetablePlannerFilters) {
  if (!filters.collegeId || !filters.academicYear || !filters.semester) {
    return null;
  }
  return getActiveTimingForContext({
    collegeId: filters.collegeId,
    academicYear: filters.academicYear,
    semester: filters.semester,
  });
}

export type TimetableRosterStudent = {
  id: number;
  pin_no: string | null;
  student_name: string | null;
  admission_number: string;
  section: string | null;
  batch: string | null;
  branch_id?: number | null;
  branch_name?: string | null;
  branch_code?: string | null;
  current_year: number | null;
  current_semester: number | null;
};

export async function getTimetableRoster(
  filters: TimetablePlannerFilters,
): Promise<TimetableRosterStudent[]> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.collegeId) {
    where.push("s.college_id = ?");
    params.push(filters.collegeId);
  }
  if (filters.branchId) {
    where.push("s.branch_id = ?");
    params.push(filters.branchId);
  } else if (filters.branchIds && filters.branchIds.length > 0) {
    where.push(`s.branch_id IN (${filters.branchIds.map(() => "?").join(", ")})`);
    params.push(...filters.branchIds);
  }
  if (filters.courseId) {
    where.push("s.course_id = ?");
    params.push(filters.courseId);
  }
  if (filters.year != null) {
    where.push("s.current_year = ?");
    params.push(filters.year);
  }
  const rosterBatch = filters.batch && filters.batch !== "all"
    ? filters.batch
    : deriveBatchFromAcademicYearAndYear(filters.academicYear, filters.year);
  if (rosterBatch) {
    const rawBatch = String(rosterBatch).trim();
    const fourDigit = rawBatch.slice(0, 4);
    where.push("(TRIM(s.batch) = ? OR TRIM(s.batch) = ? OR s.batch LIKE ?)");
    params.push(rawBatch, fourDigit, `${fourDigit}%`);
  }

  // Base query (without section constraint)
  const baseSql = `
    SELECT DISTINCT
      s.id,
      s.pin_no,
      s.student_name,
      s.admission_number,
      COALESCE(ss.section_name COLLATE utf8mb4_unicode_ci, s.section COLLATE utf8mb4_unicode_ci) AS section,
      s.batch,
      s.branch_id,
      cb.name AS branch_name,
      cb.code AS branch_code,
      s.current_year,
      s.current_semester
    FROM students s
    LEFT JOIN course_branches cb ON cb.id = s.branch_id
    LEFT JOIN student_sections ss ON ss.student_id = s.id
    WHERE ${where.length > 0 ? where.join(" AND ") : "1=1"}
  `;

  // First attempt: with branchSections or section if provided
  let rows: (RowDataPacket & TimetableRosterStudent)[] = [];
  const branchSecEntries = filters.branchSections
    ? Object.entries(filters.branchSections).filter(([, secs]) => Array.isArray(secs) && secs.length > 0)
    : [];

  if (branchSecEntries.length > 0) {
    const branchSecClauses: string[] = [];
    const branchSecParams: unknown[] = [];
    for (const [bidStr, secs] of branchSecEntries) {
      const bid = Number(bidStr);
      const ph = secs.map(() => "?").join(", ");
      branchSecClauses.push(
        `(s.branch_id = ? AND (s.section COLLATE utf8mb4_unicode_ci IN (${ph}) OR ss.section_name COLLATE utf8mb4_unicode_ci IN (${ph})))`
      );
      branchSecParams.push(bid, ...secs, ...secs);
    }
    const sectionSql = `${baseSql} AND (${branchSecClauses.join(" OR ")}) ORDER BY cb.name ASC, COALESCE(s.pin_no, s.admission_number, s.id) ASC LIMIT 2000`;
    rows = await queryStudent<(RowDataPacket & TimetableRosterStudent)[]>(
      sectionSql,
      [...params, ...branchSecParams],
    );
  } else if (Boolean(filters.section && filters.section !== "all")) {
    const hasSection = true;
    const rawSec = String(filters.section).trim();
    const secList = rawSec.split(",").map((s) => s.trim()).filter((s) => s && s.toLowerCase() !== "all");
    if (secList.length > 1) {
      const placeholders = secList.map(() => "?").join(", ");
      const sectionSql = `${baseSql} AND (s.section COLLATE utf8mb4_unicode_ci IN (${placeholders}) OR ss.section_name COLLATE utf8mb4_unicode_ci IN (${placeholders})) ORDER BY cb.name ASC, COALESCE(s.pin_no, s.admission_number, s.id) ASC LIMIT 2000`;
      rows = await queryStudent<(RowDataPacket & TimetableRosterStudent)[]>(
        sectionSql,
        [...params, ...secList, ...secList],
      );
    } else {
      const targetSec = secList[0] || rawSec;
      const sectionSql = `${baseSql} AND (s.section COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci OR ss.section_name COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci) ORDER BY cb.name ASC, COALESCE(s.pin_no, s.admission_number, s.id) ASC LIMIT 2000`;
      rows = await queryStudent<(RowDataPacket & TimetableRosterStudent)[]>(
        sectionSql,
        [...params, targetSec, targetSec],
      );
    }
  }

  // Fallback 1: if section had 0 students (or no section specified), query without section filter
  if (rows.length === 0) {
    const fallbackSql = `${baseSql} ORDER BY cb.name ASC, COALESCE(s.pin_no, s.admission_number, s.id) ASC LIMIT 2000`;
    rows = await queryStudent<(RowDataPacket & TimetableRosterStudent)[]>(
      fallbackSql,
      params,
    );
  }

  // Fallback 2: if still 0 rows and batch was specified, try without batch restriction (match by year/branch)
  if (rows.length === 0 && filters.batch && filters.year != null) {
    const noBatchWhere = where.filter((w) => !w.includes("s.batch"));
    const noBatchParams: unknown[] = [];
    if (filters.collegeId) noBatchParams.push(filters.collegeId);
    if (filters.branchId) noBatchParams.push(filters.branchId);
    else if (filters.branchIds && filters.branchIds.length > 0) noBatchParams.push(...filters.branchIds);
    if (filters.courseId) noBatchParams.push(filters.courseId);
    if (filters.year != null) noBatchParams.push(filters.year);

    const wideSql = `
      SELECT DISTINCT
        s.id,
        s.pin_no,
        s.student_name,
        s.admission_number,
        COALESCE(ss.section_name COLLATE utf8mb4_unicode_ci, s.section COLLATE utf8mb4_unicode_ci) AS section,
        s.batch,
        s.branch_id,
        cb.name AS branch_name,
        cb.code AS branch_code,
        s.current_year,
        s.current_semester
      FROM students s
      LEFT JOIN course_branches cb ON cb.id = s.branch_id
      LEFT JOIN student_sections ss ON ss.student_id = s.id
      WHERE ${noBatchWhere.length > 0 ? noBatchWhere.join(" AND ") : "1=1"}
      ORDER BY cb.name ASC, COALESCE(s.pin_no, s.admission_number, s.id) ASC
      LIMIT 2000
    `;
    rows = await queryStudent<(RowDataPacket & TimetableRosterStudent)[]>(
      wideSql,
      noBatchParams,
    );
  }

  return rows.map((r) => ({
    id: Number(r.id),
    pin_no: r.pin_no ?? null,
    student_name: r.student_name ?? null,
    admission_number: r.admission_number ?? "",
    section: r.section ?? null,
    batch: r.batch ?? null,
    branch_id: r.branch_id != null ? Number(r.branch_id) : null,
    branch_name: r.branch_name ?? null,
    branch_code: r.branch_code ?? null,
    current_year: r.current_year != null ? Number(r.current_year) : null,
    current_semester: r.current_semester != null ? Number(r.current_semester) : null,
  }));
}

export type TimetableOverviewClass = {
  courseId: number;
  courseName: string;
  branchId: number;
  branchName: string;
  batch: string;
  year: number;
  semester: number;
  section: string;
  hasSections?: boolean;
  studentCount: number;
  status: "published" | "drafted" | "pending";
  planId: number | null;
  versionNo: number | null;
  updatedAt: string | null;
  classTeacher?: {
    facultyStaffLinkId: number;
    facultyName: string;
    hrmsEmployeeId: string;
    departmentName: string | null;
  } | null;
};

export type TimetableOverviewYearSem = {
  year: number;
  semester: number;
  label: string;
  total: number;
  published: number;
  drafted: number;
  pending: number;
  classes: TimetableOverviewClass[];
};

export type TimetableOverviewCollege = {
  collegeId: number;
  collegeName: string;
  collegeCode: string;
  totalClasses: number;
  publishedCount: number;
  draftedCount: number;
  pendingCount: number;
  yearSemBreakdown: TimetableOverviewYearSem[];
};

export type TimetableOverviewResult = {
  academicYear: string;
  colleges: TimetableOverviewCollege[];
  summary: {
    totalColleges: number;
    totalClasses: number;
    totalPublished: number;
    totalDrafted: number;
    totalPending: number;
  };
};

export async function getTimetableOverview(
  filters: TimetablePlannerFilters = {}
): Promise<TimetableOverviewResult> {
  const academicYear =
    filters.academicYear && filters.academicYear !== "all"
      ? filters.academicYear
      : getCurrentAcademicYearLabel();

  // 1. Fetch colleges
  const collegeWhere: string[] = ["(is_active = 1 OR is_active IS NULL)"];
  const collegeParams: unknown[] = [];
  if (filters.collegeId) {
    collegeWhere.push("id = ?");
    collegeParams.push(filters.collegeId);
  } else if (filters.collegeIds && filters.collegeIds.length > 0) {
    collegeWhere.push(`id IN (${filters.collegeIds.map(() => "?").join(",")})`);
    collegeParams.push(...filters.collegeIds);
  }

  const colleges = await queryStudent<
    (RowDataPacket & { id: number; name: string; code: string | null })[]
  >(
    `
    SELECT id, name, code
    FROM colleges
    WHERE ${collegeWhere.join(" AND ")}
    ORDER BY name
    `,
    collegeParams
  );

  const collegeMap = new Map<number, TimetableOverviewCollege>();
  for (const c of colleges) {
    collegeMap.set(c.id, {
      collegeId: c.id,
      collegeName: c.name,
      collegeCode: c.code || "",
      totalClasses: 0,
      publishedCount: 0,
      draftedCount: 0,
      pendingCount: 0,
      yearSemBreakdown: [],
    });
  }

  // 2. Fetch target classes from student database
  const targetWhere: string[] = [
    "(TRIM(COALESCE(s.student_status, '')) COLLATE utf8mb4_unicode_ci IN ('Regular', 'Active') OR s.student_status IS NULL)",
    "s.current_year IS NOT NULL",
    "s.current_semester IS NOT NULL",
    "TRIM(s.batch) <> ''",
  ];
  const targetParams: unknown[] = [];
  if (filters.collegeId) {
    targetWhere.push("c.id = ?");
    targetParams.push(filters.collegeId);
  } else if (filters.collegeIds && filters.collegeIds.length > 0) {
    targetWhere.push(`c.id IN (${filters.collegeIds.map(() => "?").join(",")})`);
    targetParams.push(...filters.collegeIds);
  }
  if (filters.courseId) {
    targetWhere.push("cr.id = ?");
    targetParams.push(filters.courseId);
  }
  if (filters.branchId) {
    targetWhere.push("cb.id = ?");
    targetParams.push(filters.branchId);
  } else if (filters.branchIds && filters.branchIds.length > 0) {
    targetWhere.push(`cb.id IN (${filters.branchIds.map(() => "?").join(",")})`);
    targetParams.push(...filters.branchIds);
  }
  if (filters.batch && filters.batch !== "all") {
    targetWhere.push("TRIM(COALESCE(s.batch, '')) COLLATE utf8mb4_unicode_ci = TRIM(?) COLLATE utf8mb4_unicode_ci");
    targetParams.push(filters.batch.trim());
  }
  if (filters.year && filters.year > 0) {
    targetWhere.push("s.current_year = ?");
    targetParams.push(filters.year);
  }
  if (filters.semester && filters.semester > 0) {
    targetWhere.push("s.current_semester = ?");
    targetParams.push(filters.semester);
  }
  const branchMetaRows = await queryStudent<
    (RowDataPacket & { id: number; metadata?: unknown })[]
  >(`SELECT id, metadata FROM course_branches`);
  const branchHasSectionsMap = new Map<number, boolean>();
  for (const b of branchMetaRows) {
    branchHasSectionsMap.set(b.id, branchHasConfiguredSections(b.metadata));
  }

  if (filters.section && filters.section !== "all") {
    targetWhere.push(
      "TRIM(COALESCE(ss.section_name COLLATE utf8mb4_unicode_ci, s.section COLLATE utf8mb4_unicode_ci, '' COLLATE utf8mb4_unicode_ci)) = TRIM(?) COLLATE utf8mb4_unicode_ci"
    );
    targetParams.push(filters.section.trim());
  }

  const targetRows = await queryStudent<
    (RowDataPacket & {
      college_id: number;
      college_name: string;
      college_code: string | null;
      course_id: number;
      course_name: string;
      branch_id: number;
      branch_name: string;
      batch: string;
      year: number;
      semester: number;
      section_name: string;
      student_count: number;
    })[]
  >(
    `
    SELECT
      c.id AS college_id,
      c.name AS college_name,
      c.code AS college_code,
      cr.id AS course_id,
      cr.name AS course_name,
      cb.id AS branch_id,
      cb.name AS branch_name,
      TRIM(s.batch) AS batch,
      s.current_year AS year,
      s.current_semester AS semester,
      TRIM(COALESCE(ss.section_name COLLATE utf8mb4_unicode_ci, s.section COLLATE utf8mb4_unicode_ci, '' COLLATE utf8mb4_unicode_ci)) AS section_name,
      COUNT(DISTINCT s.id) AS student_count
    FROM students s
    JOIN course_branches cb ON cb.id = s.branch_id
    JOIN courses cr ON cr.id = cb.course_id
    JOIN colleges c ON c.id = cr.college_id
    LEFT JOIN student_sections ss ON ss.student_id = s.id
    WHERE ${targetWhere.join(" AND ")}
    GROUP BY
      c.id, c.name, c.code, cr.id, cr.name, cb.id, cb.name,
      TRIM(s.batch), s.current_year, s.current_semester,
      TRIM(COALESCE(ss.section_name COLLATE utf8mb4_unicode_ci, s.section COLLATE utf8mb4_unicode_ci, '' COLLATE utf8mb4_unicode_ci))
    HAVING COUNT(DISTINCT s.id) > 0
    ORDER BY c.name, cr.name, cb.name, s.current_year, s.current_semester
    `,
    targetParams
  );

  // 3. Fetch timetable plans from academic database
  const planWhere: string[] = ["status IN ('published', 'draft', 'in_review')"];
  const planParams: unknown[] = [];
  if (academicYear) {
    planWhere.push("academic_year_label = ?");
    planParams.push(academicYear);
  }
  if (filters.collegeId) {
    planWhere.push("college_id = ?");
    planParams.push(filters.collegeId);
  } else if (filters.collegeIds && filters.collegeIds.length > 0) {
    planWhere.push(`college_id IN (${filters.collegeIds.map(() => "?").join(",")})`);
    planParams.push(...filters.collegeIds);
  }
  if (filters.courseId) {
    planWhere.push("course_id = ?");
    planParams.push(filters.courseId);
  }
  if (filters.branchId) {
    planWhere.push("branch_id = ?");
    planParams.push(filters.branchId);
  } else if (filters.branchIds && filters.branchIds.length > 0) {
    planWhere.push(`branch_id IN (${filters.branchIds.map(() => "?").join(",")})`);
    planParams.push(...filters.branchIds);
  }
  if (filters.batch && filters.batch !== "all") {
    planWhere.push("batch = ?");
    planParams.push(filters.batch.trim());
  }
  if (filters.year && filters.year > 0) {
    planWhere.push("year_of_study = ?");
    planParams.push(filters.year);
  }
  if (filters.semester && filters.semester > 0) {
    planWhere.push("semester_number = ?");
    planParams.push(filters.semester);
  }
  if (filters.section && filters.section !== "all") {
    planWhere.push("section_name = ?");
    planParams.push(filters.section.trim());
  }

  const plans = await queryAcademic<
    (RowDataPacket & {
      id: number;
      college_id: number;
      academic_year_label: string;
      course_id: number;
      branch_id: number;
      batch: string;
      year_of_study: number | null;
      semester_number: number | null;
      section_name: string | null;
      status: string;
      version_no: number;
      updated_at: string | null;
    })[]
  >(
    `
    SELECT
      id,
      college_id,
      academic_year_label,
      course_id,
      branch_id,
      batch,
      year_of_study,
      semester_number,
      section_name,
      status,
      version_no,
      updated_at
    FROM ap_timetable_plans
    WHERE ${planWhere.join(" AND ")}
    ORDER BY id DESC
    `,
    planParams
  );

  type MatchedPlan = {
    planId: number;
    status: "published" | "drafted";
    versionNo: number;
    updatedAt: string | null;
    year: number | null;
    semester: number | null;
    matched: boolean;
    raw: (typeof plans)[0];
  };

  const planMap = new Map<string, MatchedPlan>();
  const allActivePlans: MatchedPlan[] = [];

  for (const p of plans) {
    const pHasSections = branchHasSectionsMap.get(p.branch_id) ?? true;
    const sec = pHasSections
      ? (p.section_name || "A").trim().toUpperCase()
      : (p.section_name || "").trim().toUpperCase();
    const batch = (p.batch || "").trim().toUpperCase();
    const key = `${p.college_id}:${p.course_id}:${p.branch_id}:${batch}:${p.semester_number}:${sec}`;
    const isPub = p.status === "published";
    const mappedStatus: "published" | "drafted" = isPub ? "published" : "drafted";

    const item: MatchedPlan = {
      planId: Number(p.id),
      status: mappedStatus,
      versionNo: Number(p.version_no) || 1,
      updatedAt: p.updated_at ? String(p.updated_at) : null,
      year: p.year_of_study != null ? Number(p.year_of_study) : null,
      semester: p.semester_number != null ? Number(p.semester_number) : null,
      matched: false,
      raw: p,
    };
    allActivePlans.push(item);

    const existing = planMap.get(key);
    if (!existing || (!existing.status.includes("published") && isPub)) {
      planMap.set(key, item);
    }
  }

  const collegeBreakdowns = new Map<
    number,
    Map<
      string,
      {
        year: number;
        semester: number;
        label: string;
        classes: TimetableOverviewClass[];
      }
    >
  >();

  for (const c of colleges) {
    collegeBreakdowns.set(c.id, new Map());
  }

  // 4. Fetch active mentor/class teacher assignments to populate classTeacher
  const mentorAssignments = await queryAcademic<
    (RowDataPacket & {
      student_db_id: number;
      faculty_staff_link_id: number;
      notes: string | null;
      faculty_name: string | null;
      hrms_employee_id: string;
      department_name: string | null;
    })[]
  >(
    `
    SELECT
      ma.student_db_id,
      ma.faculty_staff_link_id,
      ma.notes,
      sl.display_name AS faculty_name,
      sl.hrms_employee_id,
      sl.department_name
    FROM ap_mentor_assignments ma
    JOIN ap_staff_link sl ON sl.id = ma.faculty_staff_link_id
    WHERE ma.is_active = 1
    `,
  );

  const studentIdsWithAssignments = mentorAssignments
    .filter((ma) => Number(ma.student_db_id) > 0)
    .map((ma) => Number(ma.student_db_id));

  const studentToSectionKeyMap = new Map<number, string>();
  if (studentIdsWithAssignments.length > 0) {
    const chunkLimit = 1000;
    for (let i = 0; i < studentIdsWithAssignments.length; i += chunkLimit) {
      const slice = studentIdsWithAssignments.slice(i, i + chunkLimit);
      const studentSectionRows = await queryStudent<
        (RowDataPacket & {
          id: number;
          branch_id: number;
          batch: string;
          current_semester: number;
          section_name: string;
        })[]
      >(
        `
        SELECT
          s.id,
          s.branch_id,
          TRIM(s.batch) AS batch,
          s.current_semester,
          TRIM(COALESCE(ss.section_name COLLATE utf8mb4_unicode_ci, s.section COLLATE utf8mb4_unicode_ci, 'A' COLLATE utf8mb4_unicode_ci)) AS section_name
        FROM students s
        LEFT JOIN student_sections ss ON ss.student_id = s.id
        WHERE s.id IN (${slice.map(() => "?").join(",")})
        `,
        slice,
      );

      for (const r of studentSectionRows) {
        const hasSec = branchHasSectionsMap.get(r.branch_id) ?? true;
        const sec = hasSec ? (r.section_name || "A").trim().toUpperCase() : "";
        const key = `${r.branch_id}:${(r.batch || "").trim().toUpperCase()}:${r.current_semester}:${sec}`;
        studentToSectionKeyMap.set(Number(r.id), key);
      }
    }
  }

  type SectionFacultyTally = {
    facultyStaffLinkId: number;
    facultyName: string;
    hrmsEmployeeId: string;
    departmentName: string | null;
    count: number;
  };
  const sectionTeacherMap = new Map<string, SectionFacultyTally>();

  for (const ma of mentorAssignments) {
    const sid = Number(ma.student_db_id);
    let secKey: string | null = null;

    if (sid > 0) {
      secKey = studentToSectionKeyMap.get(sid) ?? null;
    } else if (ma.notes) {
      try {
        const parsed = JSON.parse(ma.notes) as {
          branchId?: number;
          batch?: string;
          semester?: number;
          section?: string;
        };
        if (parsed.branchId && parsed.batch) {
          const hasSec = branchHasSectionsMap.get(parsed.branchId) ?? true;
          const sec = hasSec ? (parsed.section || "A").trim().toUpperCase() : "";
          secKey = `${parsed.branchId}:${(parsed.batch || "").trim().toUpperCase()}:${parsed.semester || 1}:${sec}`;
        }
      } catch {
        secKey = null;
      }
    }

    if (secKey) {
      const existing = sectionTeacherMap.get(secKey);
      if (!existing) {
        sectionTeacherMap.set(secKey, {
          facultyStaffLinkId: Number(ma.faculty_staff_link_id),
          facultyName: ma.faculty_name || "Staff",
          hrmsEmployeeId: ma.hrms_employee_id || "",
          departmentName: ma.department_name || null,
          count: 1,
        });
      } else if (existing.facultyStaffLinkId === Number(ma.faculty_staff_link_id)) {
        existing.count++;
      }
    }
  }

  for (const row of targetRows) {
    const studentCount = Number(row.student_count) || 0;
    if (studentCount <= 0) continue;

    const colBreakdown = collegeBreakdowns.get(row.college_id);
    if (!colBreakdown) continue;

    const hasSections = branchHasSectionsMap.get(row.branch_id) ?? true;
    const sec = hasSections ? (row.section_name || "A").trim().toUpperCase() : "";
    const batch = (row.batch || "").trim().toUpperCase();
    const key = `${row.college_id}:${row.course_id}:${row.branch_id}:${batch}:${row.semester}:${sec}`;
    const altKey = `${row.college_id}:${row.course_id}:${row.branch_id}:${batch}:${row.semester}:*`;

    let matched =
      planMap.get(key) ||
      (!hasSections
        ? planMap.get(
            `${row.college_id}:${row.course_id}:${row.branch_id}:${batch}:${row.semester}:A`
          )
        : undefined) ||
      planMap.get(altKey);
    let status: "published" | "drafted" | "pending" = "pending";
    let planId: number | null = null;
    let versionNo: number | null = null;
    let updatedAt: string | null = null;

    if (matched) {
      matched.matched = true;
      status = matched.status;
      planId = matched.planId;
      versionNo = matched.versionNo;
      updatedAt = matched.updatedAt;
    }

    const ysKey = `${row.year}-${row.semester}`;
    if (!colBreakdown.has(ysKey)) {
      colBreakdown.set(ysKey, {
        year: Number(row.year),
        semester: Number(row.semester),
        label: `Year ${row.year} • Sem ${row.semester}`,
        classes: [],
      });
    }

    const teacherTally =
      sectionTeacherMap.get(`${row.branch_id}:${batch}:${row.semester}:${sec}`) ||
      (!hasSections
        ? sectionTeacherMap.get(`${row.branch_id}:${batch}:${row.semester}:A`)
        : null);

    const classesList = colBreakdown.get(ysKey)!.classes;

    const existingClassIndex = !hasSections
      ? classesList.findIndex(
          (c) =>
            c.branchId === Number(row.branch_id) &&
            c.batch === row.batch &&
            c.semester === Number(row.semester)
        )
      : -1;

    if (existingClassIndex >= 0) {
      const existing = classesList[existingClassIndex];
      existing.studentCount += studentCount;
      if (!existing.planId && planId) {
        existing.planId = planId;
        existing.status = status;
        existing.versionNo = versionNo;
        existing.updatedAt = updatedAt;
      }
      if (!existing.classTeacher && teacherTally) {
        existing.classTeacher = {
          facultyStaffLinkId: teacherTally.facultyStaffLinkId,
          facultyName: teacherTally.facultyName,
          hrmsEmployeeId: teacherTally.hrmsEmployeeId,
          departmentName: teacherTally.departmentName,
        };
      }
    } else {
      classesList.push({
        courseId: Number(row.course_id),
        courseName: row.course_name,
        branchId: Number(row.branch_id),
        branchName: row.branch_name,
        batch: row.batch,
        year: Number(row.year),
        semester: Number(row.semester),
        section: hasSections ? (row.section_name || "A") : "",
        hasSections,
        studentCount,
        status,
        planId,
        versionNo,
        updatedAt,
        classTeacher: teacherTally
          ? {
              facultyStaffLinkId: teacherTally.facultyStaffLinkId,
              facultyName: teacherTally.facultyName,
              hrmsEmployeeId: teacherTally.hrmsEmployeeId,
              departmentName: teacherTally.departmentName,
            }
          : null,
      });
    }
  }

  let totalClassesAll = 0;
  let totalPubAll = 0;
  let totalDraftAll = 0;
  let totalPendAll = 0;

  const resultColleges: TimetableOverviewCollege[] = [];

  for (const c of colleges) {
    const col = collegeMap.get(c.id)!;
    const colBreakdown = collegeBreakdowns.get(c.id)!;

    const yearSemList: TimetableOverviewYearSem[] = [];
    let colTotal = 0;
    let colPub = 0;
    let colDraft = 0;
    let colPend = 0;

    const sortedYearSemKeys = Array.from(colBreakdown.keys()).sort((a, b) => {
      const [yA, sA] = a.split("-").map(Number);
      const [yB, sB] = b.split("-").map(Number);
      if (yA !== yB) return yA - yB;
      return sA - sB;
    });

    for (const key of sortedYearSemKeys) {
      const item = colBreakdown.get(key)!;
      const validClasses = item.classes.filter((cls) => cls.studentCount > 0);
      if (validClasses.length === 0) continue;

      let pub = 0;
      let draft = 0;
      let pend = 0;

      for (const cls of validClasses) {
        if (cls.status === "published") pub++;
        else if (cls.status === "drafted") draft++;
        else pend++;
      }

      colTotal += validClasses.length;
      colPub += pub;
      colDraft += draft;
      colPend += pend;

      yearSemList.push({
        year: item.year,
        semester: item.semester,
        label: item.label,
        total: validClasses.length,
        published: pub,
        drafted: draft,
        pending: pend,
        classes: validClasses,
      });
    }

    col.totalClasses = colTotal;
    col.publishedCount = colPub;
    col.draftedCount = colDraft;
    col.pendingCount = colPend;
    col.yearSemBreakdown = yearSemList;

    totalClassesAll += colTotal;
    totalPubAll += colPub;
    totalDraftAll += colDraft;
    totalPendAll += colPend;

    resultColleges.push(col);
  }

  return {
    academicYear,
    colleges: resultColleges,
    summary: {
      totalColleges: resultColleges.length,
      totalClasses: totalClassesAll,
      totalPublished: totalPubAll,
      totalDrafted: totalDraftAll,
      totalPending: totalPendAll,
    },
  };
}

export { getTimingTemplateDetail };
