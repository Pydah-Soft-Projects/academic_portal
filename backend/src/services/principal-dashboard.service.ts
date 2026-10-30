import type { RowDataPacket } from "mysql2";
import { queryAcademic, queryStudent, queryExam, getHrmsDb } from "../db/pools.js";
import {
  extractHrmsStaffProfile,
  loadHrmsOrgLookups,
  isTeachingGroup,
  HRMS_EMPLOYEE_PROJECTION,
} from "./hrms-staff.service.js";
import type { AuthzContext } from "../authz/authorization.service.js";

export type PrincipalDashboardFilters = {
  collegeId?: number;
  collegeIds?: number[];
  courseId?: number;
  branchId?: number;
  academicYear?: string;
  semester?: string | number;
  date?: string;
  startDate?: string;
  endDate?: string;
};

// -------------------------------------------------------------
// In-Memory Fast Cache (30-second TTL) for instant response
// -------------------------------------------------------------
type CacheEntry = {
  timestamp: number;
  data: any;
};

const DASHBOARD_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000; // 30 seconds

export function invalidateDashboardCache() {
  DASHBOARD_CACHE.clear();
}

export async function getPrincipalDashboardData(
  authz: AuthzContext,
  filters: PrincipalDashboardFilters = {},
) {
  const isVp = authz.roles.some((r) => r.roleKey === "vice_principal");
  const roleTitle = isVp ? "Vice Principal Dashboard" : "Principal Dashboard";
  const userInitials = isVp ? "VP" : "P";
  const roleLabel = isVp ? "Vice Principal" : "Principal";

  // Date formatting & range support
  const today = new Date();
  const startDateStr = filters.startDate || filters.date || today.toISOString().slice(0, 10);
  const endDateStr = filters.endDate || filters.startDate || filters.date || today.toISOString().slice(0, 10);
  const isDateRange = startDateStr !== endDateStr;
  const selectedDateStr = startDateStr;

  const dateClause = isDateRange ? "cs.session_date BETWEEN ? AND ?" : "cs.session_date = ?";
  const dateParams = isDateRange ? [startDateStr, endDateStr] : [startDateStr];

  const dateFormatted = isDateRange
    ? `${new Date(startDateStr + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} - ${new Date(endDateStr + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
    : new Date(startDateStr + "T00:00:00").toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const academicYear = filters.academicYear || "AY 2024-25";
  const semester =
    filters.semester && filters.semester !== "all"
      ? `Semester ${filters.semester === 1 || filters.semester === "1" ? "I" : filters.semester === 2 || filters.semester === "2" ? "II" : filters.semester}`
      : "Semester I";

  // Check in-memory fast cache
  const cacheKey = [
    authz.userId || 0,
    filters.collegeId || (filters.collegeIds ? filters.collegeIds.join(",") : "all"),
    filters.courseId || "all",
    filters.branchId || "all",
    academicYear,
    filters.semester || "all",
    startDateStr,
    endDateStr,
    isVp ? "vp" : "p",
  ].join("::");

  const cached = DASHBOARD_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // 1. Resolve User Scopes (Colleges, Courses, Branches)
  let allowedCollegeIds: number[] = [];
  if (filters.collegeId) {
    allowedCollegeIds = [filters.collegeId];
  } else if (filters.collegeIds?.length) {
    allowedCollegeIds = filters.collegeIds;
  } else if (authz.scope.collegeIds?.length) {
    allowedCollegeIds = authz.scope.collegeIds;
  }

  let allowedBranchIds: number[] = [];
  if (filters.branchId) {
    allowedBranchIds = [filters.branchId];
  } else if (!filters.collegeId && authz.scope.branchIds?.length) {
    allowedBranchIds = authz.scope.branchIds;
  }

  // 2. Fetch Active Scoped Branches and Semester Ranges concurrently (Phase 1)
  let branchWhere = ["(cb.is_active = 1 OR cb.is_active IS NULL)"];
  let branchParams: (number | string)[] = [];

  if (allowedCollegeIds.length > 0) {
    branchWhere.push(`c.college_id IN (${allowedCollegeIds.map(() => "?").join(",")})`);
    branchParams.push(...allowedCollegeIds);
  }

  if (allowedBranchIds.length > 0) {
    branchWhere.push(`cb.id IN (${allowedBranchIds.map(() => "?").join(",")})`);
    branchParams.push(...allowedBranchIds);
  } else if (filters.courseId) {
    branchWhere.push("cb.course_id = ?");
    branchParams.push(filters.courseId);
  }

  type CourseSemRow = RowDataPacket & {
    course_id: number;
    sem_start: string | null;
    sem_end: string | null;
  };

  const [scopedBranches, courseSemRanges] = await Promise.all([
    queryStudent<
      (RowDataPacket & {
        id: number;
        name: string;
        code: string | null;
        course_id: number;
        course_name: string | null;
      })[]
    >(
      `
      SELECT cb.id, cb.name, cb.code, cb.course_id, c.name as course_name
      FROM course_branches cb
      LEFT JOIN courses c ON c.id = cb.course_id
      WHERE ${branchWhere.join(" AND ")}
      ORDER BY cb.id ASC
      LIMIT 25
      `,
      branchParams,
    ),
    queryStudent<CourseSemRow[]>(
      `
      SELECT 
        sem.course_id,
        MIN(sem.start_date) as sem_start,
        MAX(sem.end_date) as sem_end
      FROM semesters sem
      WHERE sem.start_date IS NOT NULL AND sem.end_date IS NOT NULL
        ${filters.semester && filters.semester !== "all" ? "AND sem.semester_number = ?" : "AND sem.start_date <= CURDATE() AND sem.end_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)"}
      GROUP BY sem.course_id
      `,
      filters.semester && filters.semester !== "all" ? [Number(filters.semester)] : [],
    ).catch(() => []),
  ]);

  const activeBranchIds = scopedBranches.map((b) => b.id);
  const branchInSql = activeBranchIds.length > 0 ? activeBranchIds.map(() => "?").join(",") : "0";

  let minActiveSemStart = new Date(Date.now() - 150 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  for (const r of courseSemRanges) {
    if (r.sem_start && r.sem_start < minActiveSemStart) {
      minActiveSemStart = r.sem_start;
    }
  }

  // Pre-calculate deadline window filters for exams
  let deadlineWhere = "status IN ('approved', 'published')";
  const deadlineParams: any[] = [];
  if (isDateRange) {
    deadlineWhere += " AND examinationStartDate <= ? AND COALESCE(examinationEndDate, examinationStartDate) >= ?";
    deadlineParams.push(endDateStr, startDateStr);
  } else {
    deadlineWhere += " AND COALESCE(examinationEndDate, examinationStartDate) >= ? AND examinationStartDate <= DATE_ADD(?, INTERVAL 30 DAY)";
    deadlineParams.push(startDateStr, startDateStr);
  }

  // Types for Phase 2 parallel results
  type SessionRow = RowDataPacket & {
    id: number;
    branch_id: number;
    status: string;
    faculty_staff_link_id: number;
    display_name: string | null;
    subject_name: string | null;
    subject_code: string | null;
    start_time: string | null;
    end_time: string | null;
    post_id: number | null;
    posted_at: string | null;
  };

  type AssignedFacultyStaffRow = RowDataPacket & {
    staff_link_id: number;
    hrms_employee_id: string | null;
    employee_code: string | null;
    display_name: string;
    department_name: string | null;
  };

  type StudentBranchRow = RowDataPacket & {
    branch_id: number;
    total_students: number;
    distinct_sections: number;
    avg_att: number | null;
  };

  type YearStatRow = RowDataPacket & {
    branch_id: number;
    current_year: number;
    batches: string | null;
    total_students: number;
    avg_att: number | null;
  };

  type YearRiskRow = RowDataPacket & {
    branch_id: number;
    current_year: number;
    below_65_count: number;
  };

  type YearFacultyStatRow = RowDataPacket & {
    branch_id: number;
    year_of_study: number;
    total_classes: number;
    classes_posted: number;
    total_faculty: number;
    faculty_who_posted: number;
  };

  type YearBehindRow = RowDataPacket & {
    branch_id: number;
    year_of_study: number;
    behind_count: number;
  };

  type BranchFacultyClassStatRow = RowDataPacket & {
    branch_id: number;
    total_classes_scheduled: number;
    classes_posted: number;
    classes_cancelled: number;
    total_assigned_faculty: number;
    faculty_who_posted: number;
  };

  type InternalMarksRow = RowDataPacket & {
    branch_id: number;
    passed_entries: number;
    failed_entries: number;
    total_entries: number;
  };

  type StudentMidFailRow = RowDataPacket & {
    branch_id: number;
    student_db_id: number;
    failed_int1: number;
    failed_int2: number;
  };

  type SubjectBehindSessionRow = RowDataPacket & {
    subject_id: number;
    subject_name: string;
    subject_code: string | null;
    branch_id: number;
    faculty_name: string | null;
    total_scheduled: number;
    scheduled_till_today: number;
    conducted_count: number;
    cancelled_count: number;
  };

  type TodayBranchAttRow = RowDataPacket & {
    branch_id: number;
    year_of_study: number;
    total_sessions: number;
    posted_sessions: number;
    total_present: number | null;
    total_marked: number | null;
  };

  type SlotSessionDetailRow = RowDataPacket & {
    slot_order: number;
    slot_label: string;
    start_time: string | null;
    end_time: string | null;
    branch_id: number;
    total_sessions: number;
    posted_sessions: number;
    total_present: number | null;
    total_marked: number | null;
  };

  type ExamRowWithDates = RowDataPacket & {
    id: number;
    name: string;
    type: string | null;
    examinationStartDate: string | null;
    examinationEndDate: string | null;
    course?: string | null;
    branch?: string | null;
    semester?: number | null;
    yearOfStudy?: number | null;
  };

  const hasActiveBranches = activeBranchIds.length > 0;

  // 3. PHASE 2: Dispatch ALL independent database queries in parallel
  const [
    scopedFaculties,
    todaySessions,
    subRows,
    reqGroup,
    assignedStaffRowsRaw,
    studentBranchStats,
    secRows,
    yearRiskRows,
    yearStatsRows,
    yearFacultyRows,
    yearBehindRows,
    branchClassStats,
    internalMarksStats,
    submittedRows,
    studentMidFailRows,
    realBehindSessionRows,
    todayAttRows,
    todayDbRecords,
    slotDetailRows,
    liveExams,
    pastUnpostedRows,
    userRows,
    prevStuRows,
    prevFacRows,
  ] = await Promise.all([
    // 1. Scoped Teaching Faculty
    hasActiveBranches
      ? queryAcademic<
          (RowDataPacket & {
            staff_link_id: number;
            display_name: string;
            branch_id: number;
            subject_name: string | null;
            subject_code: string | null;
          })[]
        >(
          `
          SELECT DISTINCT 
            sl.id as staff_link_id, 
            sl.display_name, 
            p.branch_id, 
            te.subject_name, 
            te.subject_code
          FROM ap_timetable_entries te
          JOIN ap_timetable_plans p ON p.id = te.plan_id
          JOIN ap_staff_link sl ON sl.id = te.faculty_staff_link_id
          WHERE p.branch_id IN (${branchInSql})
          `,
          activeBranchIds,
        ).catch(() => [])
      : Promise.resolve([]),

    // 2. Class Sessions for Date / Date Range
    hasActiveBranches
      ? queryAcademic<SessionRow[]>(
          `
          SELECT 
            cs.id,
            cs.branch_id,
            cs.status,
            cs.faculty_staff_link_id,
            sl.display_name,
            cs.subject_name,
            cs.subject_code,
            cs.start_time,
            cs.end_time,
            ap.id as post_id,
            ap.posted_at
          FROM ap_class_sessions cs
          JOIN ap_staff_link sl ON sl.id = cs.faculty_staff_link_id
          LEFT JOIN ap_attendance_posts ap ON ap.class_session_id = cs.id
          WHERE ${dateClause} AND cs.branch_id IN (${branchInSql})
          `,
          [...dateParams, ...activeBranchIds],
        ).catch(() => [])
      : Promise.resolve([]),

    // 3. Substitutions
    hasActiveBranches
      ? queryAcademic<
          (RowDataPacket & {
            execution_status: string;
            replacement_faculty_staff_link_id: number;
            cnt: number;
          })[]
        >(
          `
          SELECT execution_status, replacement_faculty_staff_link_id, COUNT(*) as cnt
          FROM ap_faculty_substitution_details
          WHERE session_date = ? AND branch_id IN (${branchInSql})
          GROUP BY execution_status, replacement_faculty_staff_link_id
          `,
          [selectedDateStr, ...activeBranchIds],
        ).catch(() => [])
      : Promise.resolve([]),

    // 4. Pending Approval Requests Group
    queryAcademic<(RowDataPacket & { type_key: string; label: string; cnt: number })[]>(
      `
      SELECT rt.type_key, rt.label, COUNT(*) as cnt
      FROM ap_requests r
      JOIN ap_request_types rt ON rt.id = r.request_type_id
      WHERE r.status IN ('submitted', 'pending_approval')
      GROUP BY rt.type_key, rt.label
      `,
    ).catch(() => []),

    // 5. Assigned Staff for HRMS biometrics
    hasActiveBranches
      ? queryAcademic<AssignedFacultyStaffRow[]>(
          `
          SELECT DISTINCT 
            sl.id as staff_link_id, 
            sl.hrms_employee_id, 
            sl.employee_code, 
            sl.display_name, 
            sl.department_name
          FROM ap_staff_link sl
          WHERE sl.id IN (
            SELECT te.faculty_staff_link_id 
            FROM ap_timetable_entries te 
            JOIN ap_timetable_plans p ON p.id = te.plan_id 
            WHERE p.branch_id IN (${branchInSql})
            UNION
            SELECT cs.faculty_staff_link_id 
            FROM ap_class_sessions cs 
            WHERE cs.branch_id IN (${branchInSql})
          )
          ORDER BY sl.display_name ASC
          `,
          [...activeBranchIds, ...activeBranchIds],
        ).catch(() => [])
      : Promise.resolve([]),

    // 6. Student Branch Stats (Semester Window)
    hasActiveBranches
      ? queryStudent<StudentBranchRow[]>(
          `
          SELECT 
            s.branch_id,
            COUNT(DISTINCT s.id) as total_students,
            COUNT(DISTINCT NULLIF(TRIM(s.section), '')) as distinct_sections,
            ROUND(SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(ar.id), 0), 1) as avg_att
          FROM students s
          LEFT JOIN attendance_records ar ON ar.student_id = s.id 
            AND ar.attendance_date >= ?
            AND ar.attendance_date <= CURDATE()
          WHERE s.branch_id IN (${branchInSql})
            AND LOWER(TRIM(COALESCE(s.student_status, ''))) = 'regular'
          GROUP BY s.branch_id
          `,
          [minActiveSemStart, ...activeBranchIds],
        ).catch(() => [])
      : Promise.resolve([]),

    // 7. Distinct Sections per branch
    hasActiveBranches
      ? queryStudent<(RowDataPacket & { branch_id: number; sec_cnt: number })[]>(
          `
          SELECT 
            branch_id,
            COUNT(DISTINCT NULLIF(TRIM(section), '')) as sec_cnt
          FROM students
          WHERE branch_id IN (${branchInSql})
            AND LOWER(TRIM(COALESCE(student_status, ''))) = 'regular'
          GROUP BY branch_id
          `,
          activeBranchIds,
        ).catch(() => [])
      : Promise.resolve([]),

    // 8. Year-wise Risk Students (<65% attendance - Combined Query, also supplies branch risk)
    hasActiveBranches
      ? queryStudent<YearRiskRow[]>(
          `
          SELECT 
            s.branch_id,
            s.current_year,
            COUNT(DISTINCT low.student_id) as below_65_count
          FROM students s
          JOIN (
            SELECT ar.student_id, ROUND(SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) as pct
            FROM attendance_records ar
            JOIN students st ON st.id = ar.student_id
            WHERE st.branch_id IN (${branchInSql})
              AND LOWER(TRIM(COALESCE(st.student_status, ''))) = 'regular'
              AND ar.attendance_date >= ?
              AND ar.attendance_date <= CURDATE()
            GROUP BY ar.student_id
            HAVING pct < 65
          ) low ON low.student_id = s.id
          WHERE s.current_year IS NOT NULL
            AND LOWER(TRIM(COALESCE(s.student_status, ''))) = 'regular'
          GROUP BY s.branch_id, s.current_year
          `,
          [...activeBranchIds, minActiveSemStart],
        ).catch(() => [])
      : Promise.resolve([]),

    // 9. Year-wise student attendance & enrollment breakdown
    hasActiveBranches
      ? queryStudent<YearStatRow[]>(
          `
          SELECT 
            s.branch_id,
            s.current_year,
            GROUP_CONCAT(DISTINCT s.batch ORDER BY s.batch DESC SEPARATOR ', ') as batches,
            COUNT(DISTINCT s.id) as total_students,
            ROUND(SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(ar.id), 0), 1) as avg_att
          FROM students s
          LEFT JOIN attendance_records ar ON ar.student_id = s.id 
            AND ar.attendance_date >= ?
            AND ar.attendance_date <= CURDATE()
          WHERE s.branch_id IN (${branchInSql})
            AND s.current_year IS NOT NULL
            AND LOWER(TRIM(COALESCE(s.student_status, ''))) = 'regular'
          GROUP BY s.branch_id, s.current_year
          ORDER BY s.branch_id, s.current_year
          `,
          [minActiveSemStart, ...activeBranchIds],
        ).catch(() => [])
      : Promise.resolve([]),

    // 10. Year-wise faculty classes from Academic Portal
    hasActiveBranches
      ? queryAcademic<YearFacultyStatRow[]>(
          `
          SELECT 
            cs.branch_id,
            COALESCE(tp.year_of_study, 0) as year_of_study,
            COUNT(cs.id) as total_classes,
            SUM(CASE WHEN cs.status IN ('posted', 'completed') THEN 1 ELSE 0 END) as classes_posted,
            COUNT(DISTINCT cs.faculty_staff_link_id) as total_faculty,
            COUNT(DISTINCT CASE WHEN cs.status IN ('posted', 'completed') THEN cs.faculty_staff_link_id ELSE NULL END) as faculty_who_posted
          FROM ap_class_sessions cs
          LEFT JOIN ap_timetable_plans tp ON tp.id = cs.plan_id
          WHERE cs.branch_id IN (${branchInSql})
            AND cs.session_date >= ?
            AND cs.session_date <= CURDATE()
          GROUP BY cs.branch_id, year_of_study
          ORDER BY cs.branch_id, year_of_study
          `,
          [...activeBranchIds, minActiveSemStart],
        ).catch(() => [])
      : Promise.resolve([]),

    // 11. Year-wise subjects behind schedule
    hasActiveBranches
      ? queryAcademic<YearBehindRow[]>(
          `
          SELECT 
            cs.branch_id,
            COALESCE(tp.year_of_study, 0) as year_of_study,
            COUNT(DISTINCT cs.subject_id) as behind_count
          FROM ap_class_sessions cs
          LEFT JOIN ap_timetable_plans tp ON tp.id = cs.plan_id
          WHERE cs.branch_id IN (${branchInSql})
            AND cs.subject_name IS NOT NULL
          GROUP BY cs.branch_id, year_of_study
          HAVING SUM(CASE WHEN cs.status = 'cancelled' THEN 1 ELSE 0 END) > 0
          `,
          activeBranchIds,
        ).catch(() => [])
      : Promise.resolve([]),

    // 12. Real Faculty Attendance per Scoped Branch from Class Sessions
    hasActiveBranches
      ? queryAcademic<BranchFacultyClassStatRow[]>(
          `
          SELECT 
            cs.branch_id,
            COUNT(cs.id) as total_classes_scheduled,
            SUM(CASE WHEN cs.status IN ('posted', 'completed') THEN 1 ELSE 0 END) as classes_posted,
            SUM(CASE WHEN cs.status = 'cancelled' THEN 1 ELSE 0 END) as classes_cancelled,
            COUNT(DISTINCT cs.faculty_staff_link_id) as total_assigned_faculty,
            COUNT(DISTINCT CASE WHEN cs.status IN ('posted', 'completed') THEN cs.faculty_staff_link_id ELSE NULL END) as faculty_who_posted
          FROM ap_class_sessions cs
          WHERE cs.branch_id IN (${branchInSql})
            AND cs.session_date >= ?
            AND cs.session_date <= CURDATE()
          GROUP BY cs.branch_id
          `,
          [...activeBranchIds, minActiveSemStart],
        ).catch(() => [])
      : Promise.resolve([]),

    // 13. Internal Marks Pass / Fail Stats
    hasActiveBranches
      ? queryAcademic<InternalMarksRow[]>(
          `
          SELECT 
            ims.branch_id,
            SUM(CASE WHEN ime.marks_obtained >= (ime.max_marks * 0.4) THEN 1 ELSE 0 END) as passed_entries,
            SUM(CASE WHEN ime.marks_obtained < (ime.max_marks * 0.4) THEN 1 ELSE 0 END) as failed_entries,
            COUNT(ime.id) as total_entries
          FROM ap_internal_marks_submissions ims
          JOIN ap_internal_marks_entries ime ON ime.submission_id = ims.id
          WHERE ims.branch_id IN (${branchInSql})
          GROUP BY ims.branch_id
          `,
          activeBranchIds,
        ).catch(() => [])
      : Promise.resolve([]),

    // 14. Submitted Marks Branches
    hasActiveBranches
      ? queryAcademic<(RowDataPacket & { branch_id: number })[]>(
          `
          SELECT DISTINCT branch_id
          FROM ap_internal_marks_submissions
          WHERE branch_id IN (${branchInSql}) AND status IN ('submitted', 'approved', 'forwarded_to_ems')
          `,
          activeBranchIds,
        ).catch(() => [])
      : Promise.resolve([]),

    // 15. Real Student-Level Failed Internal Assessments
    hasActiveBranches
      ? queryAcademic<StudentMidFailRow[]>(
          `
          SELECT 
            ims.branch_id,
            ime.student_db_id,
            SUM(CASE WHEN (ims.semester_number = 1 OR ims.semester_number IS NULL) AND ime.marks_obtained < (ime.max_marks * 0.4) THEN 1 ELSE 0 END) as failed_int1,
            SUM(CASE WHEN ims.semester_number = 2 AND ime.marks_obtained < (ime.max_marks * 0.4) THEN 1 ELSE 0 END) as failed_int2
          FROM ap_internal_marks_submissions ims
          JOIN ap_internal_marks_entries ime ON ime.submission_id = ims.id
          WHERE ims.branch_id IN (${branchInSql})
          GROUP BY ims.branch_id, ime.student_db_id
          `,
          activeBranchIds,
        ).catch(() => [])
      : Promise.resolve([]),

    // 16. Real Subjects Behind Schedule
    hasActiveBranches
      ? queryAcademic<SubjectBehindSessionRow[]>(
          `
          SELECT 
            cs.subject_id,
            cs.subject_name,
            cs.subject_code,
            cs.branch_id,
            sl.display_name as faculty_name,
            COUNT(cs.id) as total_scheduled,
            SUM(CASE WHEN cs.session_date <= ? THEN 1 ELSE 0 END) as scheduled_till_today,
            SUM(CASE WHEN cs.status IN ('posted', 'completed') THEN 1 ELSE 0 END) as conducted_count,
            SUM(CASE WHEN cs.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count
          FROM ap_class_sessions cs
          LEFT JOIN ap_staff_link sl ON sl.id = cs.faculty_staff_link_id
          WHERE cs.subject_name IS NOT NULL
            AND cs.branch_id IN (${branchInSql})
          GROUP BY cs.subject_id, cs.subject_name, cs.subject_code, cs.branch_id, sl.display_name
          HAVING cancelled_count > 0 OR (scheduled_till_today > 5 AND conducted_count < (scheduled_till_today * 0.6))
          ORDER BY cancelled_count DESC, scheduled_till_today DESC
          LIMIT 10
          `,
          [selectedDateStr, ...activeBranchIds],
        ).catch(() => [])
      : Promise.resolve([]),

    // 17. Today's Attendance Posts across branches
    hasActiveBranches
      ? queryAcademic<TodayBranchAttRow[]>(
          `
          SELECT 
            cs.branch_id,
            COALESCE(tp.year_of_study, 0) as year_of_study,
            COUNT(cs.id) as total_sessions,
            SUM(CASE WHEN cs.status IN ('posted', 'completed') OR ap.id IS NOT NULL THEN 1 ELSE 0 END) as posted_sessions,
            SUM(ap.present_count) as total_present,
            SUM(ap.present_count + ap.absent_count + ap.od_count + ap.leave_count) as total_marked
          FROM ap_class_sessions cs
          LEFT JOIN ap_timetable_plans tp ON tp.id = cs.plan_id
          LEFT JOIN ap_attendance_posts ap ON ap.class_session_id = cs.id
          WHERE cs.session_date = ? AND cs.branch_id IN (${branchInSql})
          GROUP BY cs.branch_id, year_of_study
          `,
          [selectedDateStr, ...activeBranchIds],
        ).catch(() => [])
      : Promise.resolve([]),

    // 18. Today's DB Attendance Records (fallback)
    hasActiveBranches
      ? queryStudent<
          (RowDataPacket & { branch_id: number; present_count: number; total_count: number })[]
        >(
          `
          SELECT 
            s.branch_id,
            SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as present_count,
            COUNT(ar.id) as total_count
          FROM students s
          JOIN attendance_records ar ON ar.student_id = s.id AND ar.attendance_date = ?
          WHERE s.branch_id IN (${branchInSql})
          GROUP BY s.branch_id
          `,
          [selectedDateStr, ...activeBranchIds],
        ).catch(() => [])
      : Promise.resolve([]),

    // 19. Detailed Slot Breakdown
    hasActiveBranches
      ? queryAcademic<SlotSessionDetailRow[]>(
          `
          SELECT 
            COALESCE(ts.slot_order, 1) as slot_order,
            COALESCE(ts.label, CONCAT('P', cs.timing_slot_id)) as slot_label,
            COALESCE(ts.start_time, cs.start_time) as start_time,
            COALESCE(ts.end_time, cs.end_time) as end_time,
            cs.branch_id,
            COUNT(cs.id) as total_sessions,
            SUM(CASE WHEN cs.status IN ('posted', 'completed') OR ap.id IS NOT NULL THEN 1 ELSE 0 END) as posted_sessions,
            SUM(ap.present_count) as total_present,
            SUM(ap.present_count + ap.absent_count + ap.od_count + ap.leave_count) as total_marked
          FROM ap_class_sessions cs
          LEFT JOIN ap_timing_template_slots ts ON ts.id = COALESCE(cs.timing_slot_id, cs.period_slot_id)
          LEFT JOIN ap_attendance_posts ap ON ap.class_session_id = cs.id
          WHERE ${dateClause} AND cs.branch_id IN (${branchInSql})
          GROUP BY slot_order, slot_label, start_time, end_time, cs.branch_id
          ORDER BY slot_order ASC
          `,
          [...dateParams, ...activeBranchIds],
        ).catch(() => [])
      : Promise.resolve([]),

    // 20. Live Examinations
    queryExam<ExamRowWithDates[]>(
      `
      SELECT id, name, type, examinationStartDate, examinationEndDate, course, branch, semester, yearOfStudy
      FROM exams
      WHERE ${deadlineWhere}
      ORDER BY examinationStartDate ASC
      LIMIT 8
      `,
      deadlineParams,
    ).catch(() => []),

    // 21. Past Unposted Sessions
    hasActiveBranches
      ? queryAcademic<(RowDataPacket & { cnt: number; branch_cnt: number })[]>(
          `
          SELECT COUNT(*) as cnt, COUNT(DISTINCT branch_id) as branch_cnt
          FROM ap_class_sessions
          WHERE status = 'scheduled'
            AND session_date < CURDATE()
            AND session_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            AND branch_id IN (${branchInSql})
          `,
          activeBranchIds,
        ).catch(() => [])
      : Promise.resolve([]),

    // 22. User display name
    authz.userId
      ? queryAcademic<(RowDataPacket & { name: string })[]>(
          `SELECT name FROM ap_users WHERE id = ? LIMIT 1`,
          [authz.userId],
        ).catch(() => [])
      : Promise.resolve([]),

    // 23. Previous day student attendance for trend
    hasActiveBranches
      ? queryStudent<(RowDataPacket & { prev_avg: number | null })[]>(
          `
          SELECT 
            ROUND(SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(ar.id), 0), 1) as prev_avg
          FROM attendance_records ar
          JOIN students s ON s.id = ar.student_id
          WHERE s.branch_id IN (${branchInSql})
            AND LOWER(TRIM(COALESCE(s.student_status, ''))) = 'regular'
            AND ar.attendance_date < ?
          GROUP BY ar.attendance_date
          ORDER BY ar.attendance_date DESC
          LIMIT 1
          `,
          [...activeBranchIds, selectedDateStr],
        ).catch(() => [{ prev_avg: null }])
      : Promise.resolve([{ prev_avg: null }]),

    // 24. Previous day faculty attendance for trend
    hasActiveBranches
      ? queryAcademic<(RowDataPacket & { prev_scheduled: number; prev_present: number })[]>(
          `
          SELECT 
            COUNT(DISTINCT cs.faculty_staff_link_id) as prev_scheduled,
            COUNT(DISTINCT CASE WHEN cs.status IN ('posted', 'completed') THEN cs.faculty_staff_link_id ELSE NULL END) as prev_present
          FROM ap_class_sessions cs
          WHERE cs.branch_id IN (${branchInSql})
            AND cs.session_date < ?
            AND cs.faculty_staff_link_id IS NOT NULL
          GROUP BY cs.session_date
          ORDER BY cs.session_date DESC
          LIMIT 1
          `,
          [...activeBranchIds, selectedDateStr],
        ).catch(() => [{ prev_scheduled: 0, prev_present: 0 }])
      : Promise.resolve([{ prev_scheduled: 0, prev_present: 0 }]),
  ]);

  // Fallback for assigned staff if specific class sessions had none
  let assignedStaffRows = assignedStaffRowsRaw;
  if (assignedStaffRows.length === 0) {
    try {
      assignedStaffRows = await queryAcademic<AssignedFacultyStaffRow[]>(
        `SELECT id as staff_link_id, hrms_employee_id, employee_code, display_name, department_name FROM ap_staff_link ORDER BY display_name ASC LIMIT 100`,
      );
    } catch {
      assignedStaffRows = [];
    }
  }

  // Build Faculty Teaching Map
  const distinctTeachingFacultyMap = new Map<number, { name: string; branchId: number; subjects: string[] }>();
  for (const f of scopedFaculties) {
    const existing = distinctTeachingFacultyMap.get(f.staff_link_id);
    if (!existing) {
      distinctTeachingFacultyMap.set(f.staff_link_id, {
        name: f.display_name || "Faculty",
        branchId: f.branch_id,
        subjects: f.subject_name ? [f.subject_name] : [],
      });
    } else if (f.subject_name && !existing.subjects.includes(f.subject_name)) {
      existing.subjects.push(f.subject_name);
    }
  }

  let totalTeachingFacultyCount = distinctTeachingFacultyMap.size || (isVp ? 32 : 76);

  // Calculate Faculty Present / Absent / Scheduled state from real sessions
  const presentFacultyIds = new Set<number>();
  const scheduledFacultyIds = new Set<number>();
  const cancelledFacultyIds = new Set<number>();

  let postedSessionsCount = 0;
  let scheduledSessionsCount = 0;
  let cancelledSessionsCount = 0;
  const branchCancelledMap = new Map<number, number>();

  for (const s of todaySessions) {
    if (s.status === "posted" || s.status === "completed" || s.post_id != null) {
      presentFacultyIds.add(s.faculty_staff_link_id);
      postedSessionsCount++;
    } else if (s.status === "cancelled") {
      cancelledFacultyIds.add(s.faculty_staff_link_id);
      cancelledSessionsCount++;
      branchCancelledMap.set(s.branch_id, (branchCancelledMap.get(s.branch_id) || 0) + 1);
    } else if (s.status === "scheduled") {
      scheduledFacultyIds.add(s.faculty_staff_link_id);
      scheduledSessionsCount++;
    }
  }

  // Substitutions / Leave Requests on Date
  let facultyLeaveCount = 0;
  let facultyOdCount = 0;
  let adjustedClassesCount = 0;
  let substituteClassesCount = 0;

  for (const sub of subRows) {
    if (sub.execution_status === "applied") {
      adjustedClassesCount += Number(sub.cnt);
      if (sub.replacement_faculty_staff_link_id) {
        substituteClassesCount += Number(sub.cnt);
      }
    }
    facultyLeaveCount += Number(sub.cnt);
  }

  // Pending approval requests in ap_requests
  let pendingRequestsCount = 0;
  let pendingApprovalsList: Array<{ label: string; count: number; href: string }> = [];

  for (const rg of reqGroup) {
    const c = Number(rg.cnt);
    pendingRequestsCount += c;
    if (rg.type_key === "faculty_substitution") {
      facultyLeaveCount += c;
    }
    pendingApprovalsList.push({
      label: rg.label,
      count: c,
      href: "/requests",
    });
  }

  if (pendingApprovalsList.length === 0) {
    pendingApprovalsList = [
      { label: "Faculty Leave / OD", count: facultyLeaveCount, href: "/faculty-substitution" },
      { label: "Attendance Correction", count: cancelledSessionsCount, href: "/attendance-posting" },
      { label: "Marks Approval", count: 0, href: "/internal-marks" },
      { label: "Fee Concession", count: 0, href: "/reports" },
    ];
  }

  // 4. Live HRMS Employee Attendance & Slots Biometrics
  let hrmsEmployeesTotal = 0;
  let hrmsTeachingTotal = 0;
  let hrmsPresent = 0;
  let hrmsLate = 0;
  let hrmsLeave = 0;
  let hrmsOd = 0;
  let hrmsPermission = 0;
  let hrmsAbsent = 0;
  let allPendingLeavesCount = 0;
  let allPendingOdsCount = 0;
  let allPendingCclsCount = 0;

  type FacultySlotItem = {
    id: number;
    subjectName: string;
    subjectCode: string | null;
    startTime: string | null;
    endTime: string | null;
    status: string;
    isPosted: boolean;
  };

  let employeeWiseDetails: Array<{
    staffLinkId: number;
    empNo: string;
    name: string;
    department: string;
    designation: string;
    employeeGroup: string;
    isTeaching: boolean;
    division: string;
    status: "present" | "late" | "leave" | "od" | "permission" | "absent";
    displayStatus: string;
    thumbStatus: "active" | "partial" | "full" | "none";
    checkInTime: string | null;
    checkOutTime: string | null;
    lateMinutes: number;
    slotsCount: number;
    slotsPosted: number;
    slotsPending: number;
    slots: FacultySlotItem[];
    subjects: string[];
    details: string | null;
  }> = [];

  let hrmsLeavesList: Array<{
    id: string;
    empNo: string;
    employeeName: string;
    department: string;
    leaveType: string;
    fromDate: string;
    toDate: string;
    numberOfDays: number;
    purpose: string;
    status: string;
  }> = [];

  let hrmsOdsList: Array<{
    id: string;
    empNo: string;
    employeeName: string;
    department: string;
    odType: string;
    fromDate: string;
    toDate: string;
    purpose: string;
    placeVisited: string;
    status: string;
  }> = [];

  let hrmsPermissionsList: Array<{
    id: string;
    empNo: string;
    employeeName: string;
    department: string;
    date: string;
    hours: number;
    reason: string;
    status: string;
  }> = [];

  let pendingApprovalDetailsList: Array<{
    id: string;
    category: "leave" | "od" | "ccl" | "general";
    categoryLabel: string;
    subType: string;
    empNo: string;
    employeeName: string;
    department: string;
    designation: string;
    fromDate: string;
    toDate: string;
    numberOfDays: number;
    purpose: string;
    placeVisited?: string;
    status: string;
    statusLabel: string;
    appliedAt: string;
  }> = [];

  let hrmsLoaded = false;

  // Build slot mapping per faculty from todaySessions
  const staffSlotsMap = new Map<number, {
    totalSlots: number;
    postedSlots: number;
    pendingSlots: number;
    cancelledSlots: number;
    slots: FacultySlotItem[];
    subjects: string[];
  }>();

  for (const s of todaySessions) {
    if (!s.faculty_staff_link_id) continue;
    let entry = staffSlotsMap.get(s.faculty_staff_link_id);
    if (!entry) {
      entry = {
        totalSlots: 0,
        postedSlots: 0,
        pendingSlots: 0,
        cancelledSlots: 0,
        slots: [],
        subjects: [],
      };
      staffSlotsMap.set(s.faculty_staff_link_id, entry);
    }
    entry.totalSlots++;
    const isPosted = s.status === "posted" || s.status === "completed" || s.post_id != null;
    if (isPosted) entry.postedSlots++;
    else if (s.status === "cancelled") entry.cancelledSlots++;
    else entry.pendingSlots++;

    entry.slots.push({
      id: s.id,
      subjectName: s.subject_name || "Class Session",
      subjectCode: s.subject_code,
      startTime: s.start_time,
      endTime: s.end_time,
      status: s.status,
      isPosted,
    });

    if (s.subject_name && !entry.subjects.includes(s.subject_name)) {
      entry.subjects.push(s.subject_name);
    }
  }

  try {
    const hrmsDb = await getHrmsDb();
    const lookups = await loadHrmsOrgLookups(hrmsDb);

    const empNos = assignedStaffRows
      .map((r) => String(r.hrms_employee_id || r.employee_code || "").trim())
      .filter(Boolean);

    if (empNos.length > 0) {
      const rawEmployees = await hrmsDb
        .collection("employees")
        .find({ emp_no: { $in: empNos } })
        .project(HRMS_EMPLOYEE_PROJECTION)
        .toArray();

      const staffProfiles = rawEmployees.map((e) => extractHrmsStaffProfile(e, lookups));
      const empProfileMap = new Map<string, typeof staffProfiles[0]>();
      for (const p of staffProfiles) {
        empProfileMap.set(p.hrmsId, p);
      }

      const startOfDay = new Date(`${startDateStr}T00:00:00+05:30`);
      const endOfDay = new Date(`${endDateStr}T23:59:59.999+05:30`);

      const leaveDateFilter = {
        $or: [
          { fromDate: { $lte: endOfDay }, toDate: { $gte: startOfDay } },
          { fromDate: { $lte: endDateStr }, toDate: { $gte: startDateStr } },
          { fromDate: { $gte: `${startDateStr}T00:00:00`, $lte: `${endDateStr}T23:59:59` } },
          { toDate: { $gte: `${startDateStr}T00:00:00`, $lte: `${endDateStr}T23:59:59` } },
        ],
      };

      const pendingLeaveDateFilter = {
        $or: [
          { fromDate: { $lte: endOfDay }, toDate: { $gte: startOfDay } },
          { fromDate: { $lte: endDateStr }, toDate: { $gte: startDateStr } },
          { fromDate: { $gte: `${startDateStr}T00:00:00`, $lte: `${endDateStr}T23:59:59` } },
          { toDate: { $gte: `${startDateStr}T00:00:00`, $lte: `${endDateStr}T23:59:59` } },
        ],
      };

      const pendingOdDateFilter = {
        $or: [
          { fromDate: { $lte: endOfDay }, toDate: { $gte: startOfDay } },
          { fromDate: { $lte: endDateStr }, toDate: { $gte: startDateStr } },
          { fromDate: { $gte: `${startDateStr}T00:00:00`, $lte: `${endDateStr}T23:59:59` } },
          { toDate: { $gte: `${startDateStr}T00:00:00`, $lte: `${endDateStr}T23:59:59` } },
        ],
      };

      const pendingCclDateFilter = {
        $or: [
          { date: { $gte: startDateStr, $lte: endDateStr } },
          { date: { $gte: startOfDay, $lte: endOfDay } },
          { date: selectedDateStr },
        ],
      };

      const [
        dailies,
        rawLogs,
        leaves,
        ods,
        perms,
        pendingLeavesDocs,
        pendingOdsDocs,
        pendingCclsDocs,
      ] = await Promise.all([
        hrmsDb
          .collection("attendancedailies")
          .find({
            $or: [
              { emp_no: { $in: empNos }, date: isDateRange ? { $gte: startDateStr, $lte: endDateStr } : selectedDateStr },
              { employeeNumber: { $in: empNos }, date: isDateRange ? { $gte: startDateStr, $lte: endDateStr } : selectedDateStr },
              { emp_no: { $in: empNos }, date: { $gte: startOfDay, $lte: endOfDay } },
              { employeeNumber: { $in: empNos }, date: { $gte: startOfDay, $lte: endOfDay } },
            ],
          })
          .project({ emp_no: 1, employeeNumber: 1, date: 1, status: 1, totalLateInMinutes: 1, shifts: 1, odHours: 1, permissionHours: 1, permissionCount: 1 })
          .toArray(),
        hrmsDb
          .collection("attendancerawlogs")
          .find({
            employeeNumber: { $in: empNos },
            $or: [
              { timestamp: { $gte: startOfDay, $lte: endOfDay } },
              { timestamp: { $gte: `${startDateStr}T00:00:00`, $lte: `${endDateStr}T23:59:59` } },
              { date: { $gte: startOfDay, $lte: endOfDay } },
              { date: isDateRange ? { $gte: startDateStr, $lte: endDateStr } : selectedDateStr },
            ],
          })
          .project({ employeeNumber: 1, emp_no: 1, timestamp: 1, date: 1, createdAt: 1 })
          .toArray(),
        hrmsDb
          .collection("leaves")
          .find({
            emp_no: { $in: empNos },
            status: { $nin: ["rejected", "cancelled"] },
            ...leaveDateFilter,
          })
          .project({ emp_no: 1, leaveType: 1, fromDate: 1, toDate: 1, numberOfDays: 1, purpose: 1, status: 1 })
          .toArray(),
        hrmsDb
          .collection("ods")
          .find({
            emp_no: { $in: empNos },
            status: { $nin: ["rejected", "cancelled"] },
            ...leaveDateFilter,
          })
          .project({ emp_no: 1, odType: 1, fromDate: 1, toDate: 1, placeVisited: 1, purpose: 1, status: 1 })
          .toArray(),
        hrmsDb
          .collection("permissions")
          .find({
            emp_no: { $in: empNos },
            status: { $nin: ["rejected", "cancelled"] },
          })
          .project({ emp_no: 1, date: 1, hours: 1, reason: 1, status: 1 })
          .toArray()
          .catch(() => []),
        hrmsDb
          .collection("leaves")
          .find({
            emp_no: { $in: empNos },
            status: { $in: ["pending", "submitted", "hod_approved", "reporting_manager_approved"] },
            ...pendingLeaveDateFilter,
          })
          .project({ emp_no: 1, leaveType: 1, fromDate: 1, toDate: 1, numberOfDays: 1, purpose: 1, status: 1, createdAt: 1 })
          .sort({ fromDate: -1, createdAt: -1 })
          .limit(100)
          .toArray(),
        hrmsDb
          .collection("ods")
          .find({
            emp_no: { $in: empNos },
            status: { $in: ["pending", "submitted", "draft", "hod_approved", "manager_approved"] },
            ...pendingOdDateFilter,
          })
          .project({ emp_no: 1, odType: 1, fromDate: 1, toDate: 1, placeVisited: 1, purpose: 1, status: 1, createdAt: 1 })
          .sort({ fromDate: -1, createdAt: -1 })
          .limit(100)
          .toArray(),
        hrmsDb
          .collection("cclrequests")
          .find({
            emp_no: { $in: empNos },
            status: { $in: ["pending", "submitted", "hod_approved"] },
            ...pendingCclDateFilter,
          })
          .project({ emp_no: 1, date: 1, reason: 1, status: 1, createdAt: 1 })
          .sort({ date: -1, createdAt: -1 })
          .limit(50)
          .toArray()
          .catch(() => []),
      ]);

      allPendingLeavesCount = pendingLeavesDocs.length;
      allPendingOdsCount = pendingOdsDocs.length;
      allPendingCclsCount = pendingCclsDocs.length;

      const rawPunchesMap = new Map<string, { first: Date; last: Date; count: number }>();
      for (const log of rawLogs) {
        const eNo = String(log.employeeNumber || log.emp_no);
        const ts = new Date(log.timestamp || log.createdAt || log.date);
        const existing = rawPunchesMap.get(eNo);
        if (!existing) {
          rawPunchesMap.set(eNo, { first: ts, last: ts, count: 1 });
        } else {
          if (ts < existing.first) existing.first = ts;
          if (ts > existing.last) existing.last = ts;
          existing.count++;
        }
      }

      const dailyMap = new Map<string, any>();
      for (const d of dailies) {
        const key = String(d.employeeNumber || d.emp_no);
        dailyMap.set(key, d);
      }

      const leaveMap = new Map<string, any>();
      for (const l of leaves) {
        leaveMap.set(String(l.emp_no), l);
      }

      const odMap = new Map<string, any>();
      for (const o of ods) {
        odMap.set(String(o.emp_no), o);
      }

      const permMap = new Map<string, any>();
      for (const p of perms) {
        permMap.set(String(p.emp_no), p);
      }

      const formatTime = (d: Date | string | null | undefined) => {
        if (!d) return null;
        const dateObj = typeof d === "string" ? new Date(d) : d;
        if (isNaN(dateObj.getTime())) return null;
        return dateObj.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Kolkata",
        });
      };

      const formatISTDate = (d: Date | string | null | undefined) => {
        if (!d) return "—";
        const dateObj = typeof d === "string" ? new Date(d) : d;
        if (isNaN(dateObj.getTime())) return typeof d === "string" ? d : "—";
        return dateObj.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" });
      };

      hrmsEmployeesTotal = assignedStaffRows.length;
      hrmsTeachingTotal = assignedStaffRows.length;

      employeeWiseDetails = assignedStaffRows.map((staffRow) => {
        const hrmsId = String(staffRow.hrms_employee_id || staffRow.employee_code || "").trim();
        const profile = empProfileMap.get(hrmsId);
        const daily = dailyMap.get(hrmsId);
        const punch = rawPunchesMap.get(hrmsId);
        const hasThumb = Boolean(punch);
        const leaveRec = leaveMap.get(hrmsId);
        const odRec = odMap.get(hrmsId);
        const permRec = permMap.get(hrmsId);

        const slotInfo = staffSlotsMap.get(staffRow.staff_link_id);
        const slotsCount = slotInfo?.totalSlots || 0;
        const slotsPosted = slotInfo?.postedSlots || 0;
        const slotsPending = slotInfo?.pendingSlots || 0;
        const assignedSlots = slotInfo?.slots || [];
        const subjectsList = slotInfo?.subjects || (staffRow.department_name ? [staffRow.department_name] : []);

        const isTeaching = profile ? isTeachingGroup(profile.employeeGroup) : true;
        const shiftWithIn = daily?.shifts?.find((s: any) => s.inTime != null);
        const hasInTime = Boolean(shiftWithIn?.inTime);
        const isPartial = daily?.status === "PARTIAL";
        const isPresentStatus = daily?.status === "PRESENT";
        const isLate = Boolean((daily?.totalLateInMinutes ?? 0) > 0 || shiftWithIn?.isLateIn);
        const isLeave = Boolean(leaveRec || daily?.status === "LEAVE");
        const isOd = Boolean(odRec || daily?.status === "OD" || (daily?.odHours && daily.odHours > 0));
        const isPermission = Boolean(permRec || (daily?.permissionHours ?? 0) > 0 || (daily?.permissionCount ?? 0) > 0);

        let status: "present" | "late" | "leave" | "od" | "permission" | "absent" = "absent";
        let displayStatus = "Absent";
        let thumbStatus: "active" | "partial" | "full" | "none" = "none";
        let details: string | null = null;

        if (hasThumb || hasInTime || isPartial || isPresentStatus) {
          status = isLate ? "late" : "present";
          displayStatus = isLate ? "Late" : "Present";
          thumbStatus = isPartial ? "partial" : hasThumb ? "active" : "full";
          hrmsPresent++;
          if (isLate) hrmsLate++;

          const punchText = punch ? `Active Thumb (${punch.count} punch${punch.count > 1 ? "es" : ""})` : "Present";
          const slotText = slotsCount > 0 ? `${slotsCount} slots today (${slotsPosted} posted)` : "No slots scheduled";
          details = `${punchText} • ${slotText}`;
        } else if (isLeave) {
          status = "leave";
          displayStatus = `Leave (${leaveRec?.leaveType || "CL"})`;
          details = leaveRec?.purpose ? `Leave: ${leaveRec.purpose}` : "Leave applied on HRMS";
          hrmsLeave++;
        } else if (isOd) {
          status = "od";
          displayStatus = `OD (${odRec?.odType || "On Duty"})`;
          details = odRec?.placeVisited ? `OD: ${odRec.placeVisited}` : (odRec?.purpose || "Official duty");
          hrmsOd++;
        } else if (isPermission) {
          status = "permission";
          displayStatus = "Permission";
          details = `${daily?.permissionHours || 1} hr permission`;
          hrmsPermission++;
        } else {
          status = "absent";
          displayStatus = "Absent";
          details = slotsCount > 0 ? `No biometric punch • ${slotsCount} slots scheduled` : "No biometric thumb punch";
          hrmsAbsent++;
        }

        const checkIn = shiftWithIn?.inTime
          ? formatTime(shiftWithIn.inTime)
          : punch?.first
            ? formatTime(punch.first)
            : null;
        const checkOut = shiftWithIn?.outTime
          ? formatTime(shiftWithIn.outTime)
          : punch && punch.count > 1
            ? formatTime(punch.last)
            : null;

        return {
          staffLinkId: staffRow.staff_link_id,
          empNo: hrmsId || `STF-${staffRow.staff_link_id}`,
          name: staffRow.display_name || profile?.name || "Faculty",
          department: profile?.department || staffRow.department_name || "Engineering",
          designation: profile?.designation || (isTeaching ? "Faculty" : "Staff"),
          employeeGroup: profile?.employeeGroup || "teaching",
          isTeaching,
          division: profile?.division || "Pydah College of Engineering",
          status,
          displayStatus,
          thumbStatus,
          checkInTime: checkIn,
          checkOutTime: checkOut,
          lateMinutes: daily?.totalLateInMinutes || shiftWithIn?.lateInMinutes || 0,
          slotsCount,
          slotsPosted,
          slotsPending,
          slots: assignedSlots,
          subjects: subjectsList,
          details,
        };
      });

      // Format Leaves
      hrmsLeavesList = leaves.map((l: any) => ({
        id: String(l._id),
        empNo: String(l.emp_no),
        employeeName: empProfileMap.get(String(l.emp_no))?.name || `Employee ${l.emp_no}`,
        department: empProfileMap.get(String(l.emp_no))?.department || l.department_name || "—",
        leaveType: String(l.leaveType || "CL"),
        fromDate: l.fromDate ? new Date(l.fromDate).toLocaleDateString("en-GB") : "—",
        toDate: l.toDate ? new Date(l.toDate).toLocaleDateString("en-GB") : "—",
        numberOfDays: Number(l.numberOfDays || 1),
        purpose: String(l.purpose || l.remarks || "Personal"),
        status: String(l.status || "pending"),
      }));

      // Format ODs
      hrmsOdsList = ods.map((o: any) => ({
        id: String(o._id),
        empNo: String(o.emp_no),
        employeeName: empProfileMap.get(String(o.emp_no))?.name || `Employee ${o.emp_no}`,
        department: empProfileMap.get(String(o.emp_no))?.department || o.department_name || "—",
        odType: String(o.odType || "On Duty"),
        fromDate: o.fromDate ? new Date(o.fromDate).toLocaleDateString("en-GB") : "—",
        toDate: o.toDate ? new Date(o.toDate).toLocaleDateString("en-GB") : "—",
        purpose: String(o.purpose || o.remarks || "Official"),
        placeVisited: o.placeVisited || "—",
        status: String(o.status || "approved"),
      }));

      // Format Permissions
      hrmsPermissionsList = perms.map((p: any) => ({
        id: String(p._id),
        empNo: String(p.emp_no),
        employeeName: empProfileMap.get(String(p.emp_no))?.name || `Employee ${p.emp_no}`,
        department: empProfileMap.get(String(p.emp_no))?.department || p.department_name || "—",
        date: p.date || (p.fromDate ? new Date(p.fromDate).toLocaleDateString("en-GB") : "—"),
        hours: Number(p.hours || 1),
        reason: String(p.reason || p.purpose || "Permission"),
        status: String(p.status || "approved"),
      }));

      // Format Pending Approvals from HRMS
      const pendingLeavesFormatted = pendingLeavesDocs.map((l: any) => {
        const staff = empProfileMap.get(String(l.emp_no));
        const statusKey = String(l.status || "pending").toLowerCase();
        let statusLabel = "Pending Approval";
        if (statusKey === "hod_approved") statusLabel = "HOD Approved";
        else if (statusKey === "reporting_manager_approved" || statusKey === "manager_approved") statusLabel = "Manager Approved";
        else if (statusKey === "submitted") statusLabel = "Submitted";

        return {
          id: String(l._id),
          category: "leave" as const,
          categoryLabel: "Faculty Leave",
          subType: String(l.leaveType || "CL"),
          empNo: String(l.emp_no),
          employeeName: staff?.name || `Employee ${l.emp_no}`,
          department: staff?.department || l.department_name || "—",
          designation: staff?.designation || "Faculty",
          fromDate: formatISTDate(l.fromDate),
          toDate: formatISTDate(l.toDate),
          numberOfDays: Number(l.numberOfDays || 1),
          purpose: String(l.purpose || l.remarks || "Personal"),
          status: statusKey,
          statusLabel,
          appliedAt: l.appliedAt ? new Date(l.appliedAt).toLocaleDateString("en-GB") : (l.createdAt ? new Date(l.createdAt).toLocaleDateString("en-GB") : "—"),
        };
      });

      const pendingOdsFormatted = pendingOdsDocs.map((o: any) => {
        const staff = empProfileMap.get(String(o.emp_no));
        const statusKey = String(o.status || "pending").toLowerCase();
        let statusLabel = "Pending Approval";
        if (statusKey === "hod_approved") statusLabel = "HOD Approved";
        else if (statusKey === "manager_approved") statusLabel = "Manager Approved";
        else if (statusKey === "draft") statusLabel = "Draft";

        return {
          id: String(o._id),
          category: "od" as const,
          categoryLabel: "On-Duty (OD)",
          subType: String(o.odType || "On Duty"),
          empNo: String(o.emp_no),
          employeeName: staff?.name || `Employee ${o.emp_no}`,
          department: staff?.department || o.department_name || "—",
          designation: staff?.designation || "Faculty",
          fromDate: formatISTDate(o.fromDate),
          toDate: formatISTDate(o.toDate),
          numberOfDays: Number(o.numberOfDays || 1),
          purpose: String(o.purpose || o.remarks || "Official"),
          placeVisited: o.placeVisited || "—",
          status: statusKey,
          statusLabel,
          appliedAt: o.appliedAt ? new Date(o.appliedAt).toLocaleDateString("en-GB") : (o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-GB") : "—"),
        };
      });

      const pendingCclsFormatted = pendingCclsDocs.map((c: any) => {
        const staff = empProfileMap.get(String(c.emp_no));
        const statusKey = String(c.status || "pending").toLowerCase();
        return {
          id: String(c._id),
          category: "ccl" as const,
          categoryLabel: "Compensatory Off (CCL)",
          subType: "CCL",
          empNo: String(c.emp_no),
          employeeName: staff?.name || `Employee ${c.emp_no}`,
          department: staff?.department || c.department_name || "—",
          designation: staff?.designation || "Faculty",
          fromDate: c.date ? new Date(c.date).toLocaleDateString("en-GB") : "—",
          toDate: c.date ? new Date(c.date).toLocaleDateString("en-GB") : "—",
          numberOfDays: 1,
          purpose: String(c.reason || c.attendanceNote || "Compensatory Leave"),
          status: statusKey,
          statusLabel: statusKey === "hod_approved" ? "HOD Approved" : "Pending Approval",
          appliedAt: c.appliedAt ? new Date(c.appliedAt).toLocaleDateString("en-GB") : (c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-GB") : "—"),
        };
      });

      pendingApprovalDetailsList = [
        ...pendingLeavesFormatted,
        ...pendingOdsFormatted,
        ...pendingCclsFormatted,
      ];

      const extraApprovals: Array<{ label: string; count: number; href: string }> = [];
      if (pendingLeavesDocs.length > 0) {
        extraApprovals.push({
          label: "Faculty Leave Requests",
          count: pendingLeavesDocs.length,
          href: "#modal:approvals_deadlines:leave",
        });
      }
      if (pendingOdsDocs.length > 0) {
        extraApprovals.push({
          label: "On-Duty (OD) Requests",
          count: pendingOdsDocs.length,
          href: "#modal:approvals_deadlines:od",
        });
      }
      if (pendingCclsDocs.length > 0) {
        extraApprovals.push({
          label: "Compensatory Off (CCL)",
          count: pendingCclsDocs.length,
          href: "#modal:approvals_deadlines:ccl",
        });
      }

      if (extraApprovals.length > 0) {
        pendingApprovalsList = [
          ...extraApprovals,
          ...pendingApprovalsList.filter((p) => !p.label.includes("Faculty Leave / OD")),
        ];
      }

      hrmsLoaded = true;
    }
  } catch (err) {
    console.warn("Failed to query HRMS attendance:", err);
  }

  // Calculate live faculty presence
  const livePresent = hrmsLoaded ? hrmsPresent : presentFacultyIds.size;
  const liveAbsent = hrmsLoaded ? hrmsAbsent : cancelledFacultyIds.size;
  const liveLate = hrmsLoaded ? hrmsLate : 0;
  const liveLeave = hrmsLoaded ? hrmsLeave : facultyLeaveCount;
  const liveOd = hrmsLoaded ? hrmsOd : facultyOdCount;
  const livePermission = hrmsLoaded ? hrmsPermission : 0;

  if (hrmsLoaded && hrmsEmployeesTotal > 0) {
    totalTeachingFacultyCount = hrmsEmployeesTotal;
  }

  // Faculty Attendance percentage
  const facultyAttPct = hrmsLoaded
    ? hrmsEmployeesTotal > 0
      ? Math.round((hrmsPresent / hrmsEmployeesTotal) * 100)
      : 0
    : scheduledSessionsCount > 0
      ? Math.round((livePresent / scheduledSessionsCount) * 100)
      : todaySessions.length > 0
        ? Math.round((postedSessionsCount / todaySessions.length) * 100)
        : 0;

  // Classes Affected Today
  const totalClassesAffected = cancelledSessionsCount + adjustedClassesCount + substituteClassesCount;

  // Compute lowAttendanceMap from combined yearRiskRows
  const lowAttendanceMap = new Map<number, number>();
  for (const r of yearRiskRows) {
    lowAttendanceMap.set(r.branch_id, (lowAttendanceMap.get(r.branch_id) || 0) + Number(r.below_65_count));
  }

  const branchSecCountMap = new Map<number, number>();
  for (const r of secRows) branchSecCountMap.set(r.branch_id, Number(r.sec_cnt));

  // Branch Faculty Attendance Map
  const branchFacultyAttMap = new Map<number, number>();
  for (const r of branchClassStats) {
    const totalScheduled = Number(r.total_classes_scheduled || 0);
    const totalFac = Number(r.total_assigned_faculty || 0);
    const facPosted = Number(r.faculty_who_posted || 0);
    const classesPosted = Number(r.classes_posted || 0);

    if (totalScheduled > 0) {
      const pct = totalFac > 0
        ? Math.round((facPosted / totalFac) * 100)
        : Math.round((classesPosted / totalScheduled) * 100);
      branchFacultyAttMap.set(r.branch_id, pct);
    }
  }

  // Internal Marks Submissions and Failed Maps
  const submittedMarksBranchSet = new Set<number>();
  for (const r of submittedRows) {
    submittedMarksBranchSet.add(r.branch_id);
  }

  const failedInt1Map = new Map<number, number>();
  const failedInt2Map = new Map<number, number>();
  const failedBothMap = new Map<number, number>();

  for (const r of studentMidFailRows) {
    if (Number(r.failed_int1) > 0) failedInt1Map.set(r.branch_id, (failedInt1Map.get(r.branch_id) || 0) + 1);
    if (Number(r.failed_int2) > 0) failedInt2Map.set(r.branch_id, (failedInt2Map.get(r.branch_id) || 0) + 1);
    if (Number(r.failed_int1) > 0 && Number(r.failed_int2) > 0) {
      failedBothMap.set(r.branch_id, (failedBothMap.get(r.branch_id) || 0) + 1);
    }
  }

  const branchesPendingMarksSubmission = scopedBranches.filter((b) => !submittedMarksBranchSet.has(b.id));

  // Sort branches by active student enrollment
  const branchesSortedByEnrollment = [...scopedBranches].sort((a, b) => {
    const aTotal = studentBranchStats.find((s) => s.branch_id === a.id)?.total_students || 0;
    const bTotal = studentBranchStats.find((s) => s.branch_id === b.id)?.total_students || 0;
    return bTotal - aTotal;
  });

  const activeEnrolledBranches = branchesSortedByEnrollment.filter(
    (b) => (studentBranchStats.find((s) => s.branch_id === b.id)?.total_students || 0) > 0,
  );
  const branchesForCards = activeEnrolledBranches.length > 0 ? activeEnrolledBranches : branchesSortedByEnrollment;

  // Subjects Behind Schedule
  const subjectsBehindSchedule: Array<{
    subject: string;
    faculty: string;
    dept: string;
    delay: string;
    status: string;
  }> = [];

  const branchBehindCountMap = new Map<number, number>();

  for (const r of realBehindSessionRows) {
    const b = scopedBranches.find((br) => br.id === r.branch_id);
    const dept = b?.code || b?.name || "DEPT";
    const cleanSubjectName = (r.subject_name || "Subject").replace(/^["']|["']$/g, "").trim();
    const schedTillToday = Number(r.scheduled_till_today || 1);
    const cancelled = Number(r.cancelled_count || 0);
    const conducted = Number(r.conducted_count || 0);
    const delayClasses = cancelled > 0 ? cancelled : Math.max(0, schedTillToday - conducted);
    const delayPct = Math.round((delayClasses / Math.max(schedTillToday, 1)) * 100);

    branchBehindCountMap.set(r.branch_id, (branchBehindCountMap.get(r.branch_id) || 0) + 1);

    subjectsBehindSchedule.push({
      subject: cleanSubjectName,
      faculty: r.faculty_name || "Assigned Faculty",
      dept,
      delay: `${delayPct}% (${delayClasses} classes)`,
      status: "Behind",
    });
  }

  // Today Student Attendance Maps
  const todayBranchAttMap = new Map<number, { total: number; posted: number; present: number; marked: number; pct: number | null }>();
  const todayYearAttMap = new Map<string, { total: number; posted: number; present: number; marked: number; pct: number | null }>();

  let overallTodayPresent = 0;
  let overallTodayMarked = 0;
  let overallTodayPostedClasses = 0;

  for (const r of todayAttRows) {
    const bId = r.branch_id;
    const yr = Number(r.year_of_study || 0);
    const pres = Number(r.total_present || 0);
    const marked = Number(r.total_marked || 0);
    const posted = Number(r.posted_sessions || 0);
    const total = Number(r.total_sessions || 0);

    overallTodayPresent += pres;
    overallTodayMarked += marked;
    overallTodayPostedClasses += posted;

    const bExisting = todayBranchAttMap.get(bId) || { total: 0, posted: 0, present: 0, marked: 0, pct: null };
    bExisting.total += total;
    bExisting.posted += posted;
    bExisting.present += pres;
    bExisting.marked += marked;
    if (bExisting.marked > 0) {
      bExisting.pct = Math.round((bExisting.present / bExisting.marked) * 100);
    } else if (bExisting.posted === 0 && bExisting.total > 0) {
      bExisting.pct = 0;
    }
    todayBranchAttMap.set(bId, bExisting);

    const yKey = `${bId}_${yr}`;
    const yExisting = todayYearAttMap.get(yKey) || { total: 0, posted: 0, present: 0, marked: 0, pct: null };
    yExisting.total += total;
    yExisting.posted += posted;
    yExisting.present += pres;
    yExisting.marked += marked;
    if (yExisting.marked > 0) {
      yExisting.pct = Math.round((yExisting.present / yExisting.marked) * 100);
    } else if (yExisting.posted === 0 && yExisting.total > 0) {
      yExisting.pct = 0;
    }
    todayYearAttMap.set(yKey, yExisting);
  }

  // Check student_database.attendance_records fallback if no posts made today
  if (overallTodayMarked === 0 && activeBranchIds.length > 0) {
    for (const r of todayDbRecords) {
      const pres = Number(r.present_count || 0);
      const total = Number(r.total_count || 0);
      overallTodayPresent += pres;
      overallTodayMarked += total;
      const bExisting = todayBranchAttMap.get(r.branch_id) || { total, posted: total, present: pres, marked: total, pct: null };
      bExisting.present = pres;
      bExisting.marked = total;
      bExisting.pct = total > 0 ? Math.round((pres / total) * 100) : 0;
      todayBranchAttMap.set(r.branch_id, bExisting);
    }
  }

  const todayStudentAttPct =
    overallTodayMarked > 0
      ? Math.round((overallTodayPresent / overallTodayMarked) * 100)
      : 0;

  const ROMAN_YEARS: Record<number, string> = { 1: "I", 2: "II", 3: "III", 4: "IV" };

  // Department Academic Overview Table
  const departmentOverview = branchesSortedByEnrollment.map((b) => {
    const sStat = studentBranchStats.find((s) => s.branch_id === b.id);
    const mStat = internalMarksStats.find((m) => m.branch_id === b.id);

    const branchTodaySessions = todaySessions.filter((s) => s.branch_id === b.id);
    const hasBranchSessionsToday = branchTodaySessions.length > 0 || (todayBranchAttMap.get(b.id)?.total || 0) > 0;
    const bAttObj = todayBranchAttMap.get(b.id);
    let sAttStr = "—";
    if (bAttObj && bAttObj.pct != null) {
      sAttStr = `${bAttObj.pct}%`;
    } else if (hasBranchSessionsToday) {
      sAttStr = "0%";
    }

    const branchFacScheduled = new Set(branchTodaySessions.map((s) => s.faculty_staff_link_id).filter(Boolean)).size;
    const branchFacPosted = new Set(
      branchTodaySessions
        .filter((s) => s.status === "posted" || s.status === "completed" || s.post_id != null)
        .map((s) => s.faculty_staff_link_id)
        .filter(Boolean),
    ).size;
    let facAttStr = "—";
    if (branchFacScheduled > 0) {
      const facPct = Math.round((branchFacPosted / branchFacScheduled) * 100);
      facAttStr = `${facPct}%`;
    } else if (branchFacultyAttMap.has(b.id)) {
      facAttStr = `${branchFacultyAttMap.get(b.id)}%`;
    }

    let passPctStr = "null";
    if (mStat && Number(mStat.total_entries) >= 20) {
      const p = Math.round((Number(mStat.passed_entries) / Number(mStat.total_entries)) * 100);
      passPctStr = `${p}%`;
    }

    const behindCount = branchBehindCountMap.get(b.id) || 0;
    const riskCount = lowAttendanceMap.get(b.id) || 0;

    const bYears = yearStatsRows.filter((y) => y.branch_id === b.id && y.current_year != null);
    const activeYearsList = bYears.map((y) => ROMAN_YEARS[y.current_year] || String(y.current_year));
    const allBatches = Array.from(
      new Set(
        bYears
          .flatMap((y) => (y.batches ? y.batches.split(",").map((s) => s.trim()) : []))
          .filter(Boolean)
      )
    ).join(", ");

    const yearBreakdown = bYears.map((y) => {
      const yrNum = y.current_year;
      const yearLabel = `Year ${ROMAN_YEARS[yrNum] || yrNum}`;
      const yrBatches = y.batches || "";

      const yAttObj = todayYearAttMap.get(`${b.id}_${yrNum}`);
      const yrSessionsToday = todaySessions.filter((s) => s.branch_id === b.id && s.year_of_study === yrNum);
      let yrAttStr = "—";
      if (yAttObj && yAttObj.pct != null) {
        yrAttStr = `${yAttObj.pct}%`;
      } else if (yrSessionsToday.length > 0 || (yAttObj && yAttObj.total > 0)) {
        yrAttStr = "0%";
      }

      const yrFacScheduled = new Set(yrSessionsToday.map((s) => s.faculty_staff_link_id).filter(Boolean)).size;
      const yrFacPosted = new Set(
        yrSessionsToday
          .filter((s) => s.status === "posted" || s.status === "completed" || s.post_id != null)
          .map((s) => s.faculty_staff_link_id)
          .filter(Boolean),
      ).size;
      let yrFacStr = "—";
      if (yrFacScheduled > 0) {
        const facPct = Math.round((yrFacPosted / yrFacScheduled) * 100);
        yrFacStr = `${facPct}%`;
      } else {
        const facRow = yearFacultyRows.find((f) => f.branch_id === b.id && f.year_of_study === yrNum);
        if (facRow && Number(facRow.total_classes) > 0) {
          const facPosted = Number(facRow.faculty_who_posted || 0);
          const facTotal = Number(facRow.total_faculty || 0);
          const pct = facTotal > 0 ? Math.round((facPosted / facTotal) * 100) : 0;
          yrFacStr = `${pct}%`;
        }
      }

      const yrRisk = yearRiskRows.find((r) => r.branch_id === b.id && r.current_year === yrNum)?.below_65_count || 0;
      const yrBehind = yearBehindRows.find((bh) => bh.branch_id === b.id && bh.year_of_study === yrNum)?.behind_count || 0;

      return {
        year: yrNum,
        yearLabel,
        batches: yrBatches,
        students: Number(y.total_students || 0),
        studentAttendance: yrAttStr,
        facultyAttendance: yrFacStr,
        internalPassPct: "null",
        subjectsBehind: yrBehind,
        riskStudents: yrRisk,
      };
    });

    return {
      department: b.code || b.name,
      departmentName: b.name,
      branchId: b.id,
      years: activeYearsList,
      batches: allBatches,
      studentAttendance: sAttStr,
      facultyAttendance: facAttStr,
      internalPassPct: passPctStr,
      subjectsBehind: behindCount,
      riskStudents: riskCount,
      totalStudents: Number(sStat?.total_students || 0),
      isStudentAttGood: bAttObj?.pct != null ? bAttObj.pct >= 75 : false,
      isFacultyAttGood: facAttStr !== "—" ? parseInt(facAttStr) >= 80 : false,
      hasBehindRisk: behindCount >= 3,
      yearBreakdown,
    };
  });

  const totalBelow65InScope = Array.from(lowAttendanceMap.values()).reduce((sum, count) => sum + count, 0);

  function formatSlotTime(t: string | null) {
    if (!t) return "";
    const parts = t.split(":");
    if (parts.length < 2) return t;
    const hours = Number(parts[0]);
    const mins = parts[1];
    const ampm = hours >= 12 ? "PM" : "AM";
    const h12 = hours % 12 || 12;
    return `${String(h12).padStart(2, "0")}:${mins} ${ampm}`;
  }

  // Group by slot
  const slotGroups = new Map<string, {
    slot_order: number;
    slot_label: string;
    timing: string;
    total_sessions: number;
    posted_sessions: number;
    total_present: number;
    total_marked: number;
    departments: Array<{
      branchId: number;
      branchCode: string;
      branchName: string;
      totalClasses: number;
      postedClasses: number;
      presentCount: number;
      markedCount: number;
      attendancePct: number;
    }>;
  }>();

  for (const r of slotDetailRows) {
    const key = r.slot_label;
    let grp = slotGroups.get(key);
    if (!grp) {
      const startTimeStr = formatSlotTime(r.start_time);
      const endTimeStr = formatSlotTime(r.end_time);
      const timingStr = startTimeStr && endTimeStr ? `${startTimeStr} - ${endTimeStr}` : "";

      grp = {
        slot_order: r.slot_order,
        slot_label: r.slot_label,
        timing: timingStr,
        total_sessions: 0,
        posted_sessions: 0,
        total_present: 0,
        total_marked: 0,
        departments: [],
      };
      slotGroups.set(key, grp);
    }

    const t = Number(r.total_sessions || 0);
    const p = Number(r.posted_sessions || 0);
    const pres = Number(r.total_present || 0);
    const marked = Number(r.total_marked || 0);

    grp.total_sessions += t;
    grp.posted_sessions += p;
    grp.total_present += pres;
    grp.total_marked += marked;

    const br = scopedBranches.find((b) => b.id === r.branch_id);
    grp.departments.push({
      branchId: r.branch_id,
      branchCode: br?.code || "Dept",
      branchName: br?.name || "Department",
      totalClasses: t,
      postedClasses: p,
      presentCount: pres,
      markedCount: marked,
      attendancePct: marked > 0 ? Math.round((pres / marked) * 100) : 0,
    });
  }

  const slotColors = ["#3b82f6", "#06b6d4", "#10b981", "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#14b8a6", "#3b82f6"];
  const slotAttendance = Array.from(slotGroups.values())
    .sort((a, b) => a.slot_order - b.slot_order)
    .map((grp, idx) => {
      const attPct = grp.total_marked > 0 ? Math.round((grp.total_present / grp.total_marked) * 100) : 0;
      return {
        slot: grp.slot_label,
        slotLabel: grp.slot_label,
        slotOrder: grp.slot_order,
        timing: grp.timing,
        department: grp.slot_label,
        sections: grp.total_sessions,
        totalClasses: grp.total_sessions,
        postedClasses: grp.posted_sessions,
        pendingClasses: Math.max(0, grp.total_sessions - grp.posted_sessions),
        totalPresent: grp.total_present,
        totalMarked: grp.total_marked,
        totalAbsent: Math.max(0, grp.total_marked - grp.total_present),
        attendance: attPct,
        fill: slotColors[idx % slotColors.length],
        label: `${attPct}%`,
        departments: grp.departments,
      };
    });

  const sectionColors = ["#10b981", "#14b8a6", "#eab308", "#f97316", "#3b82f6", "#8b5cf6"];
  const sectionAttendance = branchesForCards.slice(0, 5).map((b, idx) => {
    const sStat = studentBranchStats.find((s) => s.branch_id === b.id);
    const attVal = sStat?.avg_att != null ? Math.round(Number(sStat.avg_att)) : null;
    const realSections = Math.max(
      Number(sStat?.distinct_sections || 0),
      branchSecCountMap.get(b.id) || 0,
      1,
    );

    return {
      department: b.code || b.name,
      sections: realSections,
      attendance: attVal != null ? attVal : 0,
      fill: sectionColors[idx % sectionColors.length],
      label: attVal != null ? `${attVal}%` : "0%",
    };
  });

  const branchesSortedByRisk = [...branchesForCards].sort((a, b) => {
    const aRisk = (lowAttendanceMap.get(a.id) || 0) + (failedBothMap.get(a.id) || 0);
    const bRisk = (lowAttendanceMap.get(b.id) || 0) + (failedBothMap.get(b.id) || 0);
    return bRisk - aRisk;
  });

  const studentsAtRiskDeptWise = branchesSortedByRisk.slice(0, 8).map((b) => {
    const below65 = lowAttendanceMap.get(b.id) || 0;
    const failed1 = failedInt1Map.get(b.id) || 0;
    const failed2 = failedInt2Map.get(b.id) || 0;
    const failedBoth = failedBothMap.get(b.id) || 0;

    return {
      department: b.code || b.name,
      below65Attendance: below65,
      failedInternal1: failed1,
      failedInternal2: failed2,
      failedBoth: failedBoth,
    };
  });

  function formatExamTitle(ex: {
    name: string;
    course?: string | null;
    yearOfStudy?: number | null;
    semester?: number | null;
    type?: string | null;
  }): string {
    const ROMAN: Record<number, string> = { 1: "I", 2: "II", 3: "III", 4: "IV" };
    const yrStr = ex.yearOfStudy ? ROMAN[ex.yearOfStudy] || String(ex.yearOfStudy) : "";
    const semStr = ex.semester ? ROMAN[ex.semester] || String(ex.semester) : "";
    const semPart = yrStr && semStr ? `${yrStr}-${semStr}` : yrStr || semStr || "";

    let typeStr = "";
    if (ex.type) {
      const t = ex.type.toLowerCase();
      if (t === "supply") typeStr = "Supplementary";
      else if (t === "regular") typeStr = "Regular";
      else typeStr = ex.type.charAt(0).toUpperCase() + ex.type.slice(1);
    }

    const coursePart = ex.course || "B.Tech";
    const parts = [coursePart, semPart, typeStr ? `${typeStr} Exams` : "Exams"].filter(Boolean).join(" ");
    return parts ? `${parts} (${ex.name})` : ex.name;
  }

  const upcomingDeadlines = liveExams.map((ex) => {
    const d = ex.examinationStartDate ? new Date(ex.examinationStartDate) : new Date();
    const day = String(d.getDate()).padStart(2, "0");
    const month = d.toLocaleDateString("en-US", { month: "short" });
    return {
      day,
      month,
      title: formatExamTitle(ex),
      subtitle: `${ex.branch ? `${ex.branch} · ` : ""}${ex.type ? `${ex.type.toUpperCase()} Examination` : "Examination"}`,
      startDate: ex.examinationStartDate ? String(ex.examinationStartDate).slice(0, 10) : undefined,
      endDate: ex.examinationEndDate ? String(ex.examinationEndDate).slice(0, 10) : undefined,
    };
  });

  // Dynamic Priorities Generation
  const dynamicPriorities: Array<{
    id: number;
    text: string;
    badgeColor: string;
    href: string;
    category: string;
    urgency?: "Urgent" | "Action" | "Review" | "Warning" | "Notice" | "Optimal";
  }> = [];

  let priorityId = 1;

  const unpostedTodaySessions = todaySessions.filter(
    (s) => s.status === "scheduled" || (!s.post_id && s.status !== "cancelled"),
  );
  const unpostedBranchIds = Array.from(new Set(unpostedTodaySessions.map((s) => s.branch_id)));
  const unpostedDeptCodes = scopedBranches
    .filter((b) => unpostedBranchIds.includes(b.id))
    .map((b) => b.code || b.name);

  if (unpostedTodaySessions.length > 0) {
    const deptDetail =
      unpostedDeptCodes.length <= 4 && unpostedDeptCodes.length > 0
        ? ` (${unpostedDeptCodes.join(", ")})`
        : ` across ${unpostedDeptCodes.length} departments`;
    dynamicPriorities.push({
      id: priorityId++,
      text: `${unpostedTodaySessions.length} class session${unpostedTodaySessions.length > 1 ? "s" : ""} today awaiting attendance submission${deptDetail}`,
      badgeColor: "bg-red-500 text-white",
      href: "/attendance-posting",
      category: "attendance_posting",
      urgency: "Urgent",
    });
  } else if (todaySessions.length === 0 && activeBranchIds.length > 0) {
    const pastCnt = Number(pastUnpostedRows[0]?.cnt || 0);
    const pastBranches = Number(pastUnpostedRows[0]?.branch_cnt || 0);
    if (pastCnt > 0) {
      dynamicPriorities.push({
        id: priorityId++,
        text: `${pastCnt} class sessions from the past 7 days pending attendance submission across ${pastBranches} departments`,
        badgeColor: "bg-rose-500 text-white",
        href: "/attendance-posting",
        category: "attendance_posting",
        urgency: "Urgent",
      });
    }
  }

  // Priority 2: Approvals Awaiting Action
  if (pendingApprovalDetailsList.length > 0) {
    const topApproval = pendingApprovalDetailsList[0];
    const leaveCount = pendingApprovalDetailsList.filter((a) => a.category === "leave").length;
    const odCount = pendingApprovalDetailsList.filter((a) => a.category === "od").length;
    const breakdown = [
      leaveCount > 0 ? `${leaveCount} leave${leaveCount > 1 ? "s" : ""}` : "",
      odCount > 0 ? `${odCount} OD${odCount > 1 ? "s" : ""}` : "",
    ].filter(Boolean).join(", ");
    dynamicPriorities.push({
      id: priorityId++,
      text: `${pendingApprovalDetailsList.length} staff approval requests pending (${breakdown || topApproval.categoryLabel}) - Latest: ${topApproval.employeeName} (${topApproval.department})`,
      badgeColor: "bg-purple-600 text-white",
      href: "#modal:approvals_deadlines:all",
      category: "approvals",
      urgency: "Action",
    });
  } else if (pendingRequestsCount > 0) {
    dynamicPriorities.push({
      id: priorityId++,
      text: `${pendingRequestsCount} administrative approval request${pendingRequestsCount > 1 ? "s" : ""} awaiting principal clearance`,
      badgeColor: "bg-purple-600 text-white",
      href: "/requests",
      category: "approvals",
      urgency: "Action",
    });
  }

  // Priority 3: Internal Marks Submissions Pending
  if (branchesPendingMarksSubmission.length > 0) {
    const deptCodes = branchesPendingMarksSubmission.map((b) => b.code || b.name);
    const deptStr = deptCodes.length <= 4 ? deptCodes.join(", ") : `${deptCodes.slice(0, 3).join(", ")} + ${deptCodes.length - 3} more`;
    dynamicPriorities.push({
      id: priorityId++,
      text: `Internal Assessment marks submission pending for ${branchesPendingMarksSubmission.length} departments (${deptStr})`,
      badgeColor: "bg-amber-500 text-white",
      href: "/internal-marks",
      category: "internal_marks",
      urgency: "Warning",
    });
  }

  // Priority 4: Syllabus & Class Delays
  const totalSubjectsBehind = subjectsBehindSchedule.length;
  const delayedDeptNames = Array.from(new Set(subjectsBehindSchedule.map((s) => s.dept)));
  if (totalSubjectsBehind > 0) {
    const deptDetail =
      delayedDeptNames.length <= 4 && delayedDeptNames.length > 0
        ? ` (${delayedDeptNames.join(", ")})`
        : ` across ${delayedDeptNames.length} departments`;
    dynamicPriorities.push({
      id: priorityId++,
      text: `${totalSubjectsBehind} subject${totalSubjectsBehind > 1 ? "s are" : " is"} behind syllabus schedule${deptDetail}`,
      badgeColor: "bg-orange-500 text-white",
      href: "/timetables",
      category: "schedule",
      urgency: "Review",
    });
  }

  // Priority 5: Students Below 65% Attendance Threshold
  if (totalBelow65InScope > 0) {
    dynamicPriorities.push({
      id: priorityId++,
      text: `${totalBelow65InScope} regular students have attendance below 65% threshold requiring intervention`,
      badgeColor: "bg-rose-600 text-white",
      href: "/student-attendance",
      category: "risk_attendance",
      urgency: "Warning",
    });
  }

  // Priority 6: Upcoming Examinations in Scope
  if (upcomingDeadlines.length > 0) {
    const nearestExam = upcomingDeadlines[0];
    dynamicPriorities.push({
      id: priorityId++,
      text: `Upcoming Exam: ${nearestExam.title} commencing ${nearestExam.day} ${nearestExam.month}`,
      badgeColor: "bg-blue-600 text-white",
      href: "/examinations",
      category: "exam_deadline",
      urgency: "Notice",
    });
  }

  if (dynamicPriorities.length === 0) {
    dynamicPriorities.push({
      id: priorityId++,
      text: "All academic operations, attendance submissions, and syllabus schedules are on track today",
      badgeColor: "bg-emerald-600 text-white",
      href: "/timetables",
      category: "optimal",
      urgency: "Optimal",
    });
  }

  // Resolve User Name
  let userName = roleLabel;
  if (userRows[0]?.name) {
    userName = userRows[0].name;
  }

  // Build Faculty Attendance & Class Adjustment metrics
  const facultyAttendanceAndAdjustment = {
    facultyStatus: {
      present: livePresent,
      late: liveLate,
      leave: liveLeave,
      od: liveOd,
      permission: livePermission,
      absent: liveAbsent,
      totalTeachingFaculty: totalTeachingFacultyCount,
      totalEmployees: hrmsEmployeesTotal || totalTeachingFacultyCount,
    },
    classesAffected: {
      total: totalClassesAffected,
      adjusted: adjustedClassesCount,
      substitute: substituteClassesCount,
      cancelled: cancelledSessionsCount,
      pending: scheduledSessionsCount,
    },
    employeeWiseDetails,
    hrmsLeaves: hrmsLeavesList,
    hrmsOds: hrmsOdsList,
    hrmsPermissions: hrmsPermissionsList,
  };

  // Compute dynamic trends for KPIs
  let studentTrendStr = "— 0%";
  let studentTrendPos = true;
  const prevStuRow = prevStuRows[0];
  if (todayStudentAttPct > 0 && prevStuRow && prevStuRow.prev_avg != null) {
    const diff = Math.round((todayStudentAttPct - Number(prevStuRow.prev_avg)) * 10) / 10;
    if (diff > 0) {
      studentTrendStr = `↑ ${diff}%`;
      studentTrendPos = true;
    } else if (diff < 0) {
      studentTrendStr = `↓ ${Math.abs(diff)}%`;
      studentTrendPos = false;
    }
  }

  let facultyTrendStr = "— 0%";
  let facultyTrendPos = true;
  const prevFacRow = prevFacRows[0];
  if (facultyAttPct > 0 && prevFacRow && Number(prevFacRow.prev_scheduled) > 0) {
    const prevPct = Math.round((Number(prevFacRow.prev_present) / Number(prevFacRow.prev_scheduled)) * 100);
    const diff = facultyAttPct - prevPct;
    if (diff > 0) {
      facultyTrendStr = `↑ ${diff}%`;
      facultyTrendPos = true;
    } else if (diff < 0) {
      facultyTrendStr = `↓ ${Math.abs(diff)}%`;
      facultyTrendPos = false;
    }
  }

  const totalFailedInt1 = Array.from(failedInt1Map.values()).reduce((sum, count) => sum + count, 0);
  const totalFailedInt2 = Array.from(failedInt2Map.values()).reduce((sum, count) => sum + count, 0);

  const feeCollectionAndDues = {
    percentage: null as number | null,
    collectedAmount: null as string | null,
    totalAmount: null as string | null,
    statusText: "Fee portal module integration pending",
    pendingDues: [
      {
        label: "> 15 Days",
        studentsCount: null as number | null,
        amount: null as string | null,
        color: "text-amber-500",
        bg: "bg-amber-50",
      },
      {
        label: "> 30 Days",
        studentsCount: null as number | null,
        amount: null as string | null,
        color: "text-orange-500",
        bg: "bg-orange-50",
      },
      {
        label: "> 60 Days",
        studentsCount: null as number | null,
        amount: null as string | null,
        color: "text-red-500",
        bg: "bg-red-50",
      },
    ],
  };

  const result = {
    meta: {
      roleTitle,
      subtitle: "Overall academic and administrative overview",
      dateFormatted,
      academicYear,
      semester,
      userInitials,
      roleLabel,
      userName,
    },
    kpis: {
      studentAttendance: {
        value: `${todayStudentAttPct}%`,
        trend: studentTrendStr,
        trendPositive: studentTrendPos,
        subtext: `${postedSessionsCount} of ${todaySessions.length || scheduledSessionsCount} classes posted`,
      },
      facultyAttendance: {
        value: `${facultyAttPct}%`,
        trend: facultyTrendStr,
        trendPositive: facultyTrendPos,
        subtext: `Present: ${livePresent} | Leave: ${liveLeave} | OD: ${liveOd} | Absent: ${liveAbsent}`,
      },
      studentsAtRisk: {
        value: `${totalBelow65InScope}`,
        subtext1: "< 65% attendance",
        subtext2: `Failed I: ${totalFailedInt1} | Failed II: ${totalFailedInt2}`,
      },
      subjectsBehindSchedule: {
        value: `${totalSubjectsBehind}`,
        subtext: delayedDeptNames.length > 0 ? `${delayedDeptNames.length} dept${delayedDeptNames.length > 1 ? "s" : ""} affected` : "All on schedule",
      },
      feeCollection: {
        value: "null",
        subtext: "Fee portal integration pending",
      },
      placement: {
        value: "null",
        subtext: "Placement module integration pending",
      },
    },
    departmentOverview,
    priorities: dynamicPriorities,
    sectionAttendance: slotAttendance.length > 0 ? slotAttendance : sectionAttendance,
    slotAttendance,
    studentsAtRiskDeptWise,
    subjectsBehindSchedule,
    facultyAttendanceAndAdjustment,
    feeCollectionAndDues,
    approvalsAndDeadlines: {
      pendingApprovals: pendingApprovalsList,
      pendingApprovalDetails: pendingApprovalDetailsList,
      upcomingDeadlines,
      allTimePendingCount: (allPendingLeavesCount || 0) + (allPendingOdsCount || 0) + (allPendingCclsCount || 0),
      dateRangeLabel: dateFormatted,
    },
  };

  // Cache dashboard payload for 30s
  DASHBOARD_CACHE.set(cacheKey, { timestamp: Date.now(), data: result });
  if (DASHBOARD_CACHE.size > 100) {
    const cutoff = Date.now() - 120_000;
    for (const [k, v] of DASHBOARD_CACHE.entries()) {
      if (v.timestamp < cutoff) DASHBOARD_CACHE.delete(k);
    }
  }

  return result;
}
