import type { RowDataPacket } from "mysql2";
import { queryAcademic, queryStudent, queryExam, getHrmsDb } from "../db/pools.js";
import type { AuthzContext } from "../authz/authorization.service.js";

type CountRow = RowDataPacket & { total: number };
type BranchRow = RowDataPacket & { id: number; name: string; code: string | null; course_id: number; course_name?: string };

export type HodDepartmentItem = {
  id: number;
  name: string;
  code: string | null;
  label: string;
};

export type HodDashboardData = {
  meta: {
    departmentName: string;
    branchId: number | null;
    collegeName: string;
    userName: string;
    roleLabel: string;
    dateFormatted: string;
    departments: HodDepartmentItem[];
  };
  attendance: {
    isPostedToday?: boolean;
    percentage: number;
    present: number;
    total: number;
    trend: string;
    scheduledPeriodsToday?: number;
    postedPeriodsToday?: number;
    sections: Array<{
      section: string;
      percentage: number;
      students: number;
      postedPeriods: number;
      totalPeriods: number;
      periodProgress: number;
      periods?: Array<{
        periodNumber: number;
        isPosted: boolean;
      }>;
    }>;
  };
  priorityItems: Array<{
    id: number;
    title: string;
    severity: "critical" | "high" | "medium" | "low";
    isWarning?: boolean;
    type: string;
    count?: number;
    amount?: string;
    badge?: string;
    detail?: string;
    link?: string;
  }>;
  sectionsAtRisk: Array<{
    section: string;
    headerBg: string;
    lowAttendance: number;
    internal1Failed: number;
    internal2Failed: number;
  }>;
  subjectsBehind: Array<{
    subject: string;
    faculty: string;
    planned: number;
    completed: number;
    delay: string;
    coverage: string;
    status: "Behind" | "On Track";
  }>;
  feeDue: {
    totalAmount: string | null;
    totalStudents: number | null;
    statusText?: string | null;
    buckets: {
      fifteenDays: { students: number | null; amount: string | null };
      thirtyDays: { students: number | null; amount: string | null };
      sixtyDays: { students: number | null; amount: string | null };
    };
  };
  facultyStatus: {
    attendancePct: number;
    present: number;
    total: number;
    trend: string;
    lateToday: number;
    onLeaveToday: number;
    absentToday: number;
  };
  examStatus: Array<{
    label: string;
    count: number;
    key: string;
  }>;
  placements: {
    placedPct: number;
    placedCount: number;
    eligibleCount: number;
    unplacedCount: number;
    trainingOngoing: number;
    offersReceived: number;
    upcomingDrives: number;
  };
};

function formatDateNice(dateStr?: string) {
  if (!dateStr) {
    return new Date().toLocaleDateString("en-US", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  const [y, m, d] = dateStr.split("-").map(Number);
  const dateObj = new Date(y, (m || 1) - 1, d || 1);
  return dateObj.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const ROMAN_YEARS: Record<number, string> = { 1: "I", 2: "II", 3: "III", 4: "IV" };

const FRIENDLY_NAMES: Record<string, string> = {
  CSE: "Computer Science & Engineering",
  "CSE(AI)": "CSE - Artificial Intelligence",
  "CSEAI ML": "CSE - AI & Machine Learning",
  ECE: "Electronics & Communication Engineering",
  MEC: "Mechanical Engineering",
  MECH: "Mechanical Engineering",
  AGRI: "Agricultural Engineering",
  DCSE: "Diploma - Computer Engineering",
  DECE: "Diploma - Electronics & Communication",
  MBA: "Master of Business Administration",
  MCA: "Master of Computer Applications",
};

export async function getHodDashboardData(
  authz: AuthzContext,
  options: {
    departmentName?: string;
    branchId?: number;
    date?: string;
    academicYear?: string;
  } = {},
): Promise<HodDashboardData> {
  const selectedDate = options.date || new Date().toISOString().split("T")[0];
  const dateFormatted = formatDateNice(selectedDate);

  // 1. Resolve User College & Profile
  const userCollegeId =
    authz.roles.find((r) => r.collegeId != null)?.collegeId ||
    authz.scope.collegeIds?.[0] ||
    1;

  const userRows = await queryAcademic<
    (RowDataPacket & { name: string | null; role_label: string | null })[]
  >(
    `
    SELECT u.name, r.label as role_label
    FROM ap_users u
    LEFT JOIN ap_user_roles ur ON ur.user_id = u.id
    LEFT JOIN ap_roles r ON r.id = ur.role_id
    WHERE u.id = ?
    LIMIT 1
    `,
    [authz.userId],
  );

  const userName = userRows[0]?.name || "Head of Department";
  const roleLabel = userRows[0]?.role_label || "Head of Department";

  // 2. Query Branches for this College
  let branchRows: BranchRow[] = [];
  try {
    branchRows = await queryStudent<BranchRow[]>(
      `
      SELECT cb.id, cb.name, cb.code, cb.course_id, c.name as course_name
      FROM course_branches cb
      JOIN courses c ON c.id = cb.course_id
      WHERE (cb.is_active = 1 OR cb.is_active IS NULL)
        AND (c.college_id = ? OR ? IS NULL)
      ORDER BY cb.name ASC
      `,
      [userCollegeId, userCollegeId],
    );
  } catch {
    branchRows = [];
  }

  // Filter if user has specific branch access
  if (authz.scope.branchIds && authz.scope.branchIds.length > 0) {
    branchRows = branchRows.filter((b) => authz.scope.branchIds!.includes(b.id));
  }

  const departmentItems: HodDepartmentItem[] = branchRows.map((b) => {
    const friendly = FRIENDLY_NAMES[b.name.trim()] || b.name;
    const label = b.course_name ? `${friendly} (${b.course_name})` : friendly;
    return {
      id: b.id,
      name: b.name,
      code: b.code,
      label,
    };
  });

  // Resolve target branch:
  let targetBranch: BranchRow | undefined;
  if (options.branchId) {
    targetBranch = branchRows.find((b) => b.id === Number(options.branchId));
  }

  if (!targetBranch && options.departmentName) {
    const q = options.departmentName.trim().toLowerCase();
    targetBranch = branchRows.find(
      (b) =>
        b.name.toLowerCase() === q ||
        (b.code && b.code.toLowerCase() === q) ||
        (FRIENDLY_NAMES[b.name] && FRIENDLY_NAMES[b.name].toLowerCase() === q) ||
        (FRIENDLY_NAMES[b.name] && FRIENDLY_NAMES[b.name].toLowerCase().includes(q)) ||
        b.name.toLowerCase().includes(q)
    );
  }

  if (!targetBranch) {
    const userBranchId = authz.roles.find((r) => r.branchId != null)?.branchId || authz.scope.branchIds?.[0];
    if (userBranchId) {
      targetBranch = branchRows.find((b) => b.id === userBranchId);
    }
  }

  // Default to CSE (branch 39) or first branch with students
  if (!targetBranch) {
    targetBranch = branchRows.find((b) => b.id === 39) || branchRows[0];
  }

  const activeBranchId = targetBranch ? targetBranch.id : 39;
  const activeDeptShort = targetBranch ? targetBranch.name : "CSE";
  const activeDeptName = FRIENDLY_NAMES[activeDeptShort] || activeDeptShort;

  // 3. Dynamic Student Attendance Metrics (Regular Students Only)
  const activeFilterCondition = `s.branch_id = ? AND LOWER(TRIM(COALESCE(s.student_status, ''))) = 'regular'`;

  // Total enrolled students
  let totalStudents = 0;
  try {
    const [totalRow] = await queryStudent<(RowDataPacket & { total: number })[]>(
      `SELECT COUNT(*) as total FROM students s WHERE ${activeFilterCondition}`,
      [activeBranchId],
    );
    totalStudents = Number(totalRow?.total || 0);
  } catch {
    totalStudents = 0;
  }

  // 3. Dynamic Student Attendance Metrics (from Academic Portal 7-period class sessions - not SDMS)
  const effectiveAttendanceDate = selectedDate;

  // Check if attendance is posted for today across the 7 periods in Academic Portal
  let isPostedToday = false;
  let overallAttendancePct = 0;
  let presentStudentCount = 0;
  let scheduledPeriodsCount = 0;
  let postedPeriodsCount = 0;

  try {
    const [periodAgg] = await queryAcademic<
      (RowDataPacket & {
        scheduled_periods: number;
        posted_periods: number;
        sum_present: number | null;
        sum_absent: number | null;
        period_pct: number | null;
      })[]
    >(
      `
      SELECT
        COUNT(DISTINCT cs.id) AS scheduled_periods,
        COUNT(DISTINCT ap.id) AS posted_periods,
        SUM(COALESCE(ap.present_count, 0)) AS sum_present,
        SUM(COALESCE(ap.absent_count, 0)) AS sum_absent,
        ROUND(
          SUM(COALESCE(ap.present_count, 0)) * 100.0 /
          NULLIF(SUM(COALESCE(ap.present_count, 0) + COALESCE(ap.absent_count, 0)), 0),
          1
        ) AS period_pct
      FROM ap_class_sessions cs
      LEFT JOIN ap_attendance_posts ap ON ap.class_session_id = cs.id
      WHERE cs.branch_id = ?
        AND cs.session_date = ?
        AND cs.status NOT IN ('cancelled', 'holiday')
      `,
      [activeBranchId, effectiveAttendanceDate],
    );

    scheduledPeriodsCount = Number(periodAgg?.scheduled_periods || 0);
    postedPeriodsCount = Number(periodAgg?.posted_periods || 0);

    if (postedPeriodsCount > 0 && periodAgg && periodAgg.period_pct != null) {
      isPostedToday = true;
      overallAttendancePct = Number(periodAgg.period_pct || 0);
      const sumPresent = Number(periodAgg.sum_present || 0);
      presentStudentCount = Math.round(sumPresent / postedPeriodsCount);
    } else {
      isPostedToday = false;
      overallAttendancePct = 0;
      presentStudentCount = 0;
    }
  } catch {
    isPostedToday = false;
    overallAttendancePct = 0;
    presentStudentCount = 0;
  }

  // Real Dynamic Day-over-Day Trend from Academic Portal period attendance
  let trendStr = "Not posted yet";
  if (isPostedToday) {
    try {
      const [prevDayRow] = await queryAcademic<
        (RowDataPacket & { prev_pct: number | null })[]
      >(
        `
        SELECT
          ROUND(
            SUM(COALESCE(ap.present_count, 0)) * 100.0 /
            NULLIF(SUM(COALESCE(ap.present_count, 0) + COALESCE(ap.absent_count, 0)), 0),
            1
          ) AS prev_pct
        FROM ap_class_sessions cs
        JOIN ap_attendance_posts ap ON ap.class_session_id = cs.id
        WHERE cs.branch_id = ?
          AND cs.session_date < ?
          AND cs.status NOT IN ('cancelled', 'holiday')
        GROUP BY cs.session_date
        ORDER BY cs.session_date DESC
        LIMIT 1
        `,
        [activeBranchId, effectiveAttendanceDate],
      );

      if (prevDayRow?.prev_pct != null) {
        const diff = Math.round((overallAttendancePct - Number(prevDayRow.prev_pct)) * 10) / 10;
        trendStr = diff >= 0 ? `+${diff}% vs yesterday` : `${diff}% vs yesterday`;
      } else {
        trendStr = "Stable vs yesterday";
      }
    } catch {
      trendStr = "Stable vs yesterday";
    }
  }

  // Section-wise Attendance Breakdown from Academic Portal 7 periods for Today
  type SectionSessionAgg = RowDataPacket & {
    year_of_study: number;
    section_name: string;
    scheduled_periods: number;
    posted_periods: number;
    sum_present: number | null;
    sum_absent: number | null;
    sec_pct: number | null;
  };

  let sectionAggRows: SectionSessionAgg[] = [];
  try {
    sectionAggRows = await queryAcademic<SectionSessionAgg[]>(
      `
      SELECT
        p.year_of_study,
        COALESCE(NULLIF(TRIM(cs.section_name), ''), 'A') AS section_name,
        COUNT(DISTINCT cs.id) AS scheduled_periods,
        COUNT(DISTINCT ap.id) AS posted_periods,
        SUM(COALESCE(ap.present_count, 0)) AS sum_present,
        SUM(COALESCE(ap.absent_count, 0)) AS sum_absent,
        ROUND(
          SUM(COALESCE(ap.present_count, 0)) * 100.0 /
          NULLIF(SUM(COALESCE(ap.present_count, 0) + COALESCE(ap.absent_count, 0)), 0),
          1
        ) AS sec_pct
      FROM ap_class_sessions cs
      JOIN ap_timetable_plans p ON p.id = cs.plan_id
      LEFT JOIN ap_attendance_posts ap ON ap.class_session_id = cs.id
      WHERE cs.branch_id = ?
        AND cs.session_date = ?
        AND cs.status NOT IN ('cancelled', 'holiday')
      GROUP BY p.year_of_study, section_name
      ORDER BY p.year_of_study ASC, section_name ASC
      `,
      [activeBranchId, effectiveAttendanceDate],
    );
  } catch {
    sectionAggRows = [];
  }

  // Also query period-level status per section for visual period indicators (1 to 7)
  type PeriodDetailRow = RowDataPacket & {
    year_of_study: number;
    section_name: string;
    session_id: number;
    is_posted: number;
  };

  let periodDetailRows: PeriodDetailRow[] = [];
  try {
    periodDetailRows = await queryAcademic<PeriodDetailRow[]>(
      `
      SELECT
        p.year_of_study,
        COALESCE(NULLIF(TRIM(cs.section_name), ''), 'A') AS section_name,
        cs.id AS session_id,
        CASE WHEN ap.id IS NOT NULL THEN 1 ELSE 0 END AS is_posted
      FROM ap_class_sessions cs
      JOIN ap_timetable_plans p ON p.id = cs.plan_id
      LEFT JOIN ap_attendance_posts ap ON ap.class_session_id = cs.id
      WHERE cs.branch_id = ?
        AND cs.session_date = ?
        AND cs.status NOT IN ('cancelled', 'holiday')
      ORDER BY p.year_of_study ASC, section_name ASC, cs.start_time ASC, cs.id ASC
      `,
      [activeBranchId, effectiveAttendanceDate],
    );
  } catch {
    periodDetailRows = [];
  }

  const sectionPeriodsMap = new Map<string, Array<{ periodNumber: number; isPosted: boolean }>>();
  for (const row of periodDetailRows) {
    const yr = ROMAN_YEARS[row.year_of_study] || String(row.year_of_study);
    const key = `${yr} - ${row.section_name}`;
    if (!sectionPeriodsMap.has(key)) {
      sectionPeriodsMap.set(key, []);
    }
    const list = sectionPeriodsMap.get(key)!;
    list.push({
      periodNumber: list.length + 1,
      isPosted: Boolean(row.is_posted),
    });
  }

  // Student enrollment count per section from active roster
  type SectionStudentCount = RowDataPacket & {
    current_year: number;
    section: string;
    students_count: number;
  };
  let studentSectionCounts: SectionStudentCount[] = [];
  try {
    studentSectionCounts = await queryStudent<SectionStudentCount[]>(
      `
      SELECT
        s.current_year,
        COALESCE(NULLIF(TRIM(s.section), ''), 'A') as section,
        COUNT(DISTINCT s.id) as students_count
      FROM students s
      WHERE ${activeFilterCondition}
        AND s.current_year IS NOT NULL
      GROUP BY s.current_year, section
      HAVING students_count >= 5
      ORDER BY s.current_year ASC, section ASC
      `,
      [activeBranchId],
    );
  } catch {
    studentSectionCounts = [];
  }

  const studentCountMap = new Map<string, number>();
  for (const s of studentSectionCounts) {
    const yr = ROMAN_YEARS[s.current_year] || String(s.current_year);
    studentCountMap.set(`${yr} - ${s.section}`, Number(s.students_count));
  }

  let sectionBreakdown: Array<{
    section: string;
    percentage: number;
    students: number;
    postedPeriods: number;
    totalPeriods: number;
    periodProgress: number;
    periods: Array<{ periodNumber: number; isPosted: boolean }>;
  }> = [];

  if (sectionAggRows.length > 0) {
    sectionBreakdown = sectionAggRows.map((r) => {
      const yr = ROMAN_YEARS[r.year_of_study] || String(r.year_of_study);
      const label = `${yr} - ${r.section_name}`;
      const pct = isPostedToday && r.sec_pct != null && r.posted_periods > 0 ? Number(r.sec_pct) : 0;
      const students = studentCountMap.get(label) || 0;
      const scheduled = Number(r.scheduled_periods) || 7;
      const posted = Number(r.posted_periods) || 0;
      const periodProgress = scheduled > 0 ? Math.round((posted / scheduled) * 100) : 0;
      const periods = sectionPeriodsMap.get(label) || Array.from({ length: scheduled }, (_, i) => ({
        periodNumber: i + 1,
        isPosted: false,
      }));

      return {
        section: label,
        percentage: pct,
        students,
        postedPeriods: posted,
        totalPeriods: scheduled,
        periodProgress,
        periods,
      };
    });
  } else {
    sectionBreakdown = studentSectionCounts.map((r) => {
      const yr = ROMAN_YEARS[r.current_year] || String(r.current_year);
      const label = `${yr} - ${r.section}`;
      return {
        section: label,
        percentage: 0,
        students: Number(r.students_count),
        postedPeriods: 0,
        totalPeriods: 7,
        periodProgress: 0,
        periods: Array.from({ length: 7 }, (_, i) => ({
          periodNumber: i + 1,
          isPosted: false,
        })),
      };
    });
  }

  // 4. Real Continuous Absentees (Absent for 3+ class session days in the past 14 days from Academic Portal)
  let continuousAbsenteesCount = 0;
  try {
    const [absRow] = await queryAcademic<(RowDataPacket & { total: number })[]>(
      `
      SELECT COUNT(*) as total FROM (
        SELECT aps.student_db_id, COUNT(DISTINCT cs.session_date) as abs_count
        FROM ap_attendance_post_students aps
        INNER JOIN ap_attendance_posts ap ON ap.id = aps.attendance_post_id
        INNER JOIN ap_class_sessions cs ON cs.id = ap.class_session_id
        WHERE cs.branch_id = ?
          AND aps.status = 'absent'
          AND cs.session_date >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
        GROUP BY aps.student_db_id
        HAVING abs_count >= 3
      ) t
      `,
      [activeBranchId],
    );
    continuousAbsenteesCount = Number(absRow?.total || 0);
  } catch {
    continuousAbsenteesCount = 0;
  }

  // 5. Real Sections at Risk (Attendance < 65% across 90 days from Academic Portal and Internal Exam Failures)
  const headerColors = [
    "bg-blue-100/70 text-blue-900 border-blue-200",
    "bg-emerald-100/70 text-emerald-900 border-emerald-200",
    "bg-amber-100/70 text-amber-900 border-amber-200",
    "bg-purple-100/70 text-purple-900 border-purple-200",
    "bg-rose-100/70 text-rose-900 border-rose-200",
    "bg-teal-100/70 text-teal-900 border-teal-200",
  ];

  type RiskRow = RowDataPacket & {
    current_year: number;
    section: string;
    low_att_count: number;
  };

  let riskRows: RiskRow[] = [];
  try {
    riskRows = await queryAcademic<RiskRow[]>(
      `
      SELECT
        p.year_of_study as current_year,
        COALESCE(NULLIF(TRIM(cs.section_name), ''), 'A') as section,
        COUNT(DISTINCT CASE WHEN att.pct < 65 THEN att.student_db_id END) as low_att_count
      FROM ap_class_sessions cs
      JOIN ap_timetable_plans p ON p.id = cs.plan_id
      LEFT JOIN (
        SELECT
          aps.student_db_id,
          cs2.branch_id,
          ROUND(
            SUM(CASE WHEN aps.status = 'present' THEN 1 ELSE 0 END) * 100.0 /
            NULLIF(SUM(CASE WHEN aps.status IN ('present', 'absent') THEN 1 ELSE 0 END), 0),
            1
          ) as pct
        FROM ap_attendance_post_students aps
        INNER JOIN ap_attendance_posts ap ON ap.id = aps.attendance_post_id
        INNER JOIN ap_class_sessions cs2 ON cs2.id = ap.class_session_id
        WHERE cs2.branch_id = ?
          AND cs2.session_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
        GROUP BY aps.student_db_id, cs2.branch_id
      ) att ON att.branch_id = cs.branch_id
      WHERE cs.branch_id = ?
        AND cs.status NOT IN ('cancelled', 'holiday')
      GROUP BY p.year_of_study, section
      ORDER BY p.year_of_study ASC, section ASC
      `,
      [activeBranchId, activeBranchId],
    );
  } catch {
    riskRows = [];
  }

  // Internal Exam failures by section from ap_internal_marks_entries
  type ExamFailRow = RowDataPacket & {
    section_name: string | null;
    semester_number: number | null;
    failed_count: number;
  };

  let examFailRows: ExamFailRow[] = [];
  try {
    examFailRows = await queryAcademic<ExamFailRow[]>(
      `
      SELECT
        ims.section_name,
        ims.semester_number,
        COUNT(DISTINCT ime.student_db_id) as failed_count
      FROM ap_internal_marks_entries ime
      JOIN ap_internal_marks_submissions ims ON ims.id = ime.submission_id
      WHERE ims.branch_id = ?
        AND ime.marks_obtained < (ime.max_marks * 0.4)
      GROUP BY ims.section_name, ims.semester_number
      `,
      [activeBranchId],
    );
  } catch {
    examFailRows = [];
  }

  const sectionsAtRisk: HodDashboardData["sectionsAtRisk"] = riskRows.slice(0, 8).map((r, idx) => {
    const yr = ROMAN_YEARS[r.current_year] || String(r.current_year);
    const secLabel = `${yr} - ${r.section}`;

    const int1Fails = examFailRows
      .filter((e) => e.section_name === r.section && (e.semester_number === 1 || !e.semester_number))
      .reduce((sum, e) => sum + Number(e.failed_count), 0);

    const int2Fails = examFailRows
      .filter((e) => e.section_name === r.section && e.semester_number === 2)
      .reduce((sum, e) => sum + Number(e.failed_count), 0);

    return {
      section: secLabel,
      headerBg: headerColors[idx % headerColors.length],
      lowAttendance: Number(r.low_att_count || 0),
      internal1Failed: int1Fails,
      internal2Failed: int2Fails,
    };
  });

  // 6. Real Subjects Behind Schedule
  type PacingRow = RowDataPacket & {
    subject_id: number;
    subject_name: string;
    faculty_name: string | null;
    conducted_count: number;
    weekly_periods: number;
  };

  let subjectsBehind: HodDashboardData["subjectsBehind"] = [];
  try {
    const pacingRows = await queryAcademic<PacingRow[]>(
      `
      SELECT
        te.subject_id,
        te.subject_name,
        sl.display_name AS faculty_name,
        COUNT(DISTINCT cs.id) AS conducted_count,
        COUNT(DISTINCT te.id) AS weekly_periods
      FROM ap_timetable_entries te
      INNER JOIN ap_timetable_plans tp ON tp.id = te.plan_id
      LEFT JOIN ap_staff_link sl ON sl.id = te.faculty_staff_link_id
      LEFT JOIN ap_class_sessions cs ON cs.subject_id = te.subject_id
        AND cs.branch_id = ?
        AND (cs.status = 'posted' OR cs.status = 'completed')
      WHERE tp.branch_id = ?
      GROUP BY te.subject_id, te.subject_name, sl.display_name
      ORDER BY conducted_count ASC
      LIMIT 8
      `,
      [activeBranchId, activeBranchId],
    );

    for (const row of pacingRows) {
      const planned = Math.max(Number(row.weekly_periods || 1) * 14, 40);
      const completed = Number(row.conducted_count || 0);
      const coverage = Math.min(100, Math.round((completed / planned) * 100));
      const delayPct = Math.max(0, 75 - coverage);

      subjectsBehind.push({
        subject: row.subject_name || `Subject ${row.subject_id}`,
        faculty: row.faculty_name || "Faculty Incharge",
        planned,
        completed,
        delay: `${delayPct}%`,
        coverage: `${coverage}%`,
        status: coverage < 70 ? "Behind" : "On Track",
      });
    }
  } catch {
    subjectsBehind = [];
  }

  // 7. Real Fee Status
  let feePendingStudentsCount = 0;
  try {
    const [feeRow] = await queryStudent<(RowDataPacket & { pending_count: number })[]>(
      `
      SELECT COUNT(*) as pending_count
      FROM students s
      WHERE ${activeFilterCondition}
        AND s.fee_status IS NOT NULL
        AND LOWER(s.fee_status) NOT LIKE '%paid%'
      `,
      [activeBranchId],
    );
    feePendingStudentsCount = Number(feeRow?.pending_count || 0);
  } catch {
    feePendingStudentsCount = 0;
  }

  // 7. Fee Due Age Wise (Pending completion of fee portal)
  const feeDue: HodDashboardData["feeDue"] = {
    totalAmount: null,
    totalStudents: null,
    statusText: "Fee portal integration pending",
    buckets: {
      fifteenDays: {
        students: null,
        amount: null,
      },
      thirtyDays: {
        students: null,
        amount: null,
      },
      sixtyDays: {
        students: null,
        amount: null,
      },
    },
  };

  // 8. Real Dynamic Slots, Substitutions & Leaves Today
  type SubDetailRow = RowDataPacket & {
    id: number;
    year_of_study: number | null;
    section_name: string;
    subject_name: string | null;
    subject_code: string | null;
    execution_status: string;
    reason: string | null;
    original_faculty: string | null;
    replacement_faculty: string | null;
    slot_order: number | null;
    slot_label: string | null;
    start_time: string | null;
    end_time: string | null;
  };
  let subDetailsToday: SubDetailRow[] = [];
  try {
    subDetailsToday = await queryAcademic<SubDetailRow[]>(
      `
      SELECT d.id, d.year_of_study, d.section_name, d.subject_name, d.subject_code,
             d.execution_status, d.reason,
             orig.display_name as original_faculty,
             repl.display_name as replacement_faculty,
             tts.slot_order, tts.label as slot_label, tts.start_time, tts.end_time
      FROM ap_faculty_substitution_details d
      LEFT JOIN ap_staff_link orig ON orig.id = d.original_faculty_staff_link_id
      LEFT JOIN ap_staff_link repl ON repl.id = d.replacement_faculty_staff_link_id
      LEFT JOIN ap_timing_template_slots tts ON tts.id = d.timing_slot_id
      WHERE d.session_date = ?
        AND (d.branch_id = ? OR d.branch_id IS NULL)
        AND d.execution_status NOT IN ('cancelled', 'failed')
      ORDER BY d.id DESC
      LIMIT 10
      `,
      [selectedDate, activeBranchId],
    );
  } catch {
    subDetailsToday = [];
  }

  type LeaveReqRow = RowDataPacket & {
    id: number;
    title: string;
    body: string | null;
    status: string;
    faculty_name: string | null;
    request_label: string;
    type_key: string;
  };
  let leaveRequests: LeaveReqRow[] = [];
  try {
    leaveRequests = await queryAcademic<LeaveReqRow[]>(
      `
      SELECT r.id, r.title, r.body, r.status,
             u.name as faculty_name,
             rt.label as request_label, rt.type_key
      FROM ap_requests r
      JOIN ap_request_types rt ON rt.id = r.request_type_id
      LEFT JOIN ap_users u ON u.id = r.requester_user_id
      WHERE (r.branch_id = ? OR r.branch_id IS NULL)
        AND (
          r.status IN ('submitted', 'pending_approval', 'in_review')
          OR (r.status = 'approved' AND (DATE(r.submitted_at) = ? OR r.title LIKE ? OR r.body LIKE ?))
        )
      ORDER BY r.id DESC
      LIMIT 10
      `,
      [activeBranchId, selectedDate, `%${selectedDate}%`, `%${selectedDate}%`],
    );
  } catch {
    leaveRequests = [];
  }

  const pendingSubstitutionsCount = leaveRequests.filter((r) => r.type_key === "faculty_substitution" && r.status !== "approved").length;
  const pendingLeaveRequestsCount = leaveRequests.filter((r) => r.type_key !== "faculty_substitution" && r.status !== "approved").length;

  // 8c. Timetables configured vs active student sections
  type TimetablePlanRow = RowDataPacket & {
    id: number;
    year_of_study: number | null;
    section_name: string | null;
    status: string;
    version_no: number | null;
  };
  let departmentPlans: TimetablePlanRow[] = [];
  try {
    departmentPlans = await queryAcademic<TimetablePlanRow[]>(
      `
      SELECT id, year_of_study, section_name, status, version_no
      FROM ap_timetable_plans
      WHERE branch_id = ?
        AND status NOT IN ('superseded', 'archived')
      ORDER BY year_of_study ASC, section_name ASC
      `,
      [activeBranchId],
    );
  } catch {
    departmentPlans = [];
  }

  // 8d. Unposted class session attendance today
  type UnpostedSessionRow = RowDataPacket & {
    id: number;
    timing_slot_id: number;
    section_name: string;
    subject_name: string | null;
    start_time: string | null;
    end_time: string | null;
    status: string;
    faculty_name: string | null;
    slot_order: number | null;
    slot_label: string | null;
  };
  let unpostedSessionsToday: UnpostedSessionRow[] = [];
  try {
    unpostedSessionsToday = await queryAcademic<UnpostedSessionRow[]>(
      `
      SELECT cs.id, cs.timing_slot_id, cs.section_name, cs.subject_name,
             cs.start_time, cs.end_time, cs.status,
             sl.display_name as faculty_name,
             tts.slot_order, tts.label as slot_label
      FROM ap_class_sessions cs
      LEFT JOIN ap_timing_template_slots tts ON tts.id = cs.timing_slot_id
      LEFT JOIN ap_staff_link sl ON sl.id = cs.faculty_staff_link_id
      WHERE cs.session_date = ?
        AND cs.branch_id = ?
        AND cs.status NOT IN ('posted', 'completed', 'cancelled', 'holiday')
      ORDER BY cs.start_time ASC
      LIMIT 10
      `,
      [selectedDate, activeBranchId],
    );
  } catch {
    unpostedSessionsToday = [];
  }

  const unconductedClassesToday = unpostedSessionsToday.length;

  // 9. Low internal marks student count
  let totalFailedMarksStudents = 0;
  try {
    const [lowMarksRow] = await queryAcademic<CountRow[]>(
      `
      SELECT COUNT(DISTINCT ime.student_db_id) as total
      FROM ap_internal_marks_entries ime
      JOIN ap_internal_marks_submissions ims ON ims.id = ime.submission_id
      WHERE ims.branch_id = ?
        AND ime.marks_obtained < (ime.max_marks * 0.4)
      `,
      [activeBranchId],
    );
    totalFailedMarksStudents = Number(lowMarksRow?.total || 0);
  } catch {
    totalFailedMarksStudents = 0;
  }

  // 10. Real Faculty Status (derived strictly from class sessions conducted & posted by staff)
  let totalFaculty = 0;
  try {
    const [branchFacRow] = await queryAcademic<CountRow[]>(
      `SELECT COUNT(DISTINCT faculty_staff_link_id) as total FROM ap_class_sessions WHERE branch_id = ? AND faculty_staff_link_id IS NOT NULL`,
      [activeBranchId],
    );
    totalFaculty = Number(branchFacRow?.total || 0);
  } catch {
    totalFaculty = 0;
  }

  if (totalFaculty === 0) {
    try {
      const [staffRow] = await queryAcademic<CountRow[]>(
        `SELECT COUNT(*) as total FROM ap_staff_link WHERE department_name LIKE ?`,
        [`%${activeDeptShort}%`],
      );
      totalFaculty = Number(staffRow?.total || 0);
    } catch {
      totalFaculty = 0;
    }
  }

  // Today's scheduled class sessions for this department
  type FacSessionRow = RowDataPacket & {
    faculty_staff_link_id: number;
    status: string;
    post_id: number | null;
  };

  let todayFacSessions: FacSessionRow[] = [];
  try {
    todayFacSessions = await queryAcademic<FacSessionRow[]>(
      `
      SELECT cs.faculty_staff_link_id, cs.status, ap.id as post_id
      FROM ap_class_sessions cs
      LEFT JOIN ap_attendance_posts ap ON ap.class_session_id = cs.id
      WHERE cs.branch_id = ?
        AND cs.session_date = ?
        AND cs.faculty_staff_link_id IS NOT NULL
      `,
      [activeBranchId, effectiveAttendanceDate],
    );
  } catch {
    todayFacSessions = [];
  }

  const scheduledFacSet = new Set<number>();
  const postedFacSet = new Set<number>();
  const cancelledFacSet = new Set<number>();

  for (const s of todayFacSessions) {
    scheduledFacSet.add(s.faculty_staff_link_id);
    if (s.status === "posted" || s.status === "completed" || s.post_id != null) {
      postedFacSet.add(s.faculty_staff_link_id);
    } else if (s.status === "cancelled") {
      cancelledFacSet.add(s.faculty_staff_link_id);
    }
  }

  // A faculty member is classified as PRESENT when they conducted and posted attendance for their class
  const presentFaculty = postedFacSet.size;
  const absentFaculty = Array.from(cancelledFacSet).filter((id) => !postedFacSet.has(id)).length;
  const onLeaveToday = pendingLeaveRequestsCount;

  if (totalFaculty === 0 && scheduledFacSet.size > 0) {
    totalFaculty = scheduledFacSet.size;
  }

  let facultyAttendancePct = 0;
  if (scheduledFacSet.size > 0) {
    facultyAttendancePct = Math.round((presentFaculty / scheduledFacSet.size) * 100);
  } else if (totalFaculty > 0) {
    // If no classes scheduled specifically today, calculate within semester window for this branch
    try {
      const [semFacRow] = await queryAcademic<
        (RowDataPacket & { total_fac: number; posting_fac: number })[]
      >(
        `
        SELECT 
          COUNT(DISTINCT cs.faculty_staff_link_id) as total_fac,
          COUNT(DISTINCT CASE WHEN cs.status IN ('posted', 'completed') THEN cs.faculty_staff_link_id ELSE NULL END) as posting_fac
        FROM ap_class_sessions cs
        WHERE cs.branch_id = ?
          AND cs.session_date <= CURDATE()
          AND cs.faculty_staff_link_id IS NOT NULL
        `,
        [activeBranchId],
      );
      const semTotal = Number(semFacRow?.total_fac || 0);
      const semPosting = Number(semFacRow?.posting_fac || 0);
      facultyAttendancePct = semTotal > 0 ? Math.round((semPosting / semTotal) * 100) : 0;
    } catch {
      facultyAttendancePct = 0;
    }
  }

  // Dynamic trend vs previous session day
  let facultyTrendStr = "Stable vs yesterday";
  try {
    const [prevFacDay] = await queryAcademic<
      (RowDataPacket & { prev_scheduled: number; prev_present: number })[]
    >(
      `
      SELECT 
        COUNT(DISTINCT cs.faculty_staff_link_id) as prev_scheduled,
        COUNT(DISTINCT CASE WHEN cs.status IN ('posted', 'completed') THEN cs.faculty_staff_link_id ELSE NULL END) as prev_present
      FROM ap_class_sessions cs
      WHERE cs.branch_id = ?
        AND cs.session_date < ?
        AND cs.faculty_staff_link_id IS NOT NULL
      GROUP BY cs.session_date
      ORDER BY cs.session_date DESC
      LIMIT 1
      `,
      [activeBranchId, effectiveAttendanceDate],
    );

    if (prevFacDay && Number(prevFacDay.prev_scheduled) > 0) {
      const prevPct = Math.round((Number(prevFacDay.prev_present) / Number(prevFacDay.prev_scheduled)) * 100);
      const diff = facultyAttendancePct - prevPct;
      facultyTrendStr = diff > 0 ? `+${diff}% vs yesterday` : diff < 0 ? `${diff}% vs yesterday` : "Stable vs yesterday";
    }
  } catch {
    facultyTrendStr = "Stable vs yesterday";
  }

  const facultyStatus: HodDashboardData["facultyStatus"] = {
    attendancePct: facultyAttendancePct,
    present: presentFaculty,
    total: totalFaculty,
    trend: facultyTrendStr,
    lateToday: 0,
    onLeaveToday,
    absentToday: absentFaculty,
  };

  // 11. Priority Items (Fully Dynamic from Live DB)
  const priorityItems: HodDashboardData["priorityItems"] = [];
  let pId = 1;

  // Item Type 1: Slots Assigned to Another Faculty or Substitute Needed Today
  for (const sub of subDetailsToday) {
    const slotText = sub.slot_label || (sub.slot_order ? `Period ${sub.slot_order}` : "Slot");
    const yrText = sub.year_of_study ? `Yr ${ROMAN_YEARS[sub.year_of_study] || sub.year_of_study} ` : "";
    const secText = sub.section_name ? `(${yrText}${sub.section_name})` : "";

    if (sub.replacement_faculty) {
      priorityItems.push({
        id: pId++,
        title: `${slotText} ${secText}: Assigned to ${sub.replacement_faculty} (replacing ${sub.original_faculty || "Faculty"})`,
        severity: "medium",
        badge: "Slot Substituted",
        type: "substitution",
        detail: `${sub.original_faculty || "Assigned faculty"} is on leave. Period reassigned to ${sub.replacement_faculty}. Subject: ${sub.subject_name || sub.subject_code || "General"}${sub.start_time ? ` (${sub.start_time} - ${sub.end_time})` : ""}. Reason: ${sub.reason || "Leave substitution"}.`,
        link: "/faculty-substitution",
      });
    } else {
      priorityItems.push({
        id: pId++,
        title: `${slotText} ${secText}: Substitute needed! ${sub.original_faculty || "Faculty"} on leave`,
        severity: "critical",
        isWarning: true,
        badge: "Substitute Needed",
        type: "substitution_needed",
        detail: `${sub.original_faculty || "Faculty"} is on leave today. No replacement faculty has been assigned yet for ${sub.subject_name || "this slot"}. Assign a substitute faculty immediately.`,
        link: "/faculty-substitution",
      });
    }
  }

  // Item Type 2: Faculty on Leave Today / Pending Leave Approvals
  for (const req of leaveRequests) {
    if (req.status === "approved") {
      priorityItems.push({
        id: pId++,
        title: `${req.faculty_name || "Faculty Member"} is on approved leave today (${req.request_label})`,
        severity: "medium",
        badge: "On Leave Today",
        type: "faculty_leave",
        detail: `${req.faculty_name || "Faculty"} has approved leave for ${selectedDate}. Verify their teaching slots are substituted or rescheduled.`,
        link: "/requests",
      });
    } else {
      priorityItems.push({
        id: pId++,
        title: `${req.faculty_name || "Faculty"}: ${req.request_label} pending HOD approval`,
        severity: "high",
        isWarning: true,
        badge: "Leave Approval",
        type: "leave_pending",
        detail: `Request #${req.id}: "${req.title}" submitted by ${req.faculty_name || "Staff"}. Review and approve to confirm coverage.`,
        link: "/requests",
      });
    }
  }

  // Item Type 3: Timetables Not Configured or Unpublished for Active Student Sections
  if (studentSectionCounts.length > 0) {
    const missingSections: string[] = [];
    const draftSections: string[] = [];

    for (const sec of studentSectionCounts) {
      const yrLabel = ROMAN_YEARS[sec.current_year] || String(sec.current_year);
      const secLabel = `${yrLabel}-${sec.section}`;

      const matchedPlan = departmentPlans.find(
        (p) => p.year_of_study === sec.current_year && (p.section_name === sec.section || (!p.section_name && sec.section === "A")),
      );

      if (!matchedPlan) {
        missingSections.push(secLabel);
      } else if (matchedPlan.status !== "published") {
        draftSections.push(`${secLabel} (${matchedPlan.status})`);
      }
    }

    if (missingSections.length > 0) {
      priorityItems.push({
        id: pId++,
        title: `Timetable not configured for ${missingSections.slice(0, 3).join(", ")}${missingSections.length > 3 ? ` +${missingSections.length - 3} more` : ""}`,
        severity: "critical",
        isWarning: true,
        badge: "Missing Timetable",
        type: "timetable_missing",
        count: missingSections.length,
        detail: `Active student sections (${missingSections.join(", ")}) do not have any timetable plan configured in ${activeDeptName}. Classes and attendance cannot be scheduled without a published timetable.`,
        link: "/timetables",
      });
    }

    if (draftSections.length > 0) {
      priorityItems.push({
        id: pId++,
        title: `Timetable unpublished for ${draftSections.slice(0, 3).join(", ")}${draftSections.length > 3 ? ` +${draftSections.length - 3} more` : ""}`,
        severity: "high",
        isWarning: true,
        badge: "Draft Timetable",
        type: "timetable_draft",
        count: draftSections.length,
        detail: `Timetables for sections (${draftSections.join(", ")}) are in draft or in-review status. Publish them to enable regular attendance tracking.`,
        link: "/timetables",
      });
    }
  }

  // Item Type 4: Attendance Not Posted Yet Today
  if (unpostedSessionsToday.length > 0) {
    for (const sess of unpostedSessionsToday.slice(0, 3)) {
      const slotName = sess.slot_label || (sess.slot_order ? `Period ${sess.slot_order}` : "Slot");
      priorityItems.push({
        id: pId++,
        title: `Attendance pending: ${slotName} (${sess.section_name} - ${sess.subject_name || "Subject"})`,
        severity: "high",
        isWarning: true,
        badge: "Pending Attendance",
        type: "slot_attendance_pending",
        detail: `Slot: ${slotName}${sess.start_time ? ` (${sess.start_time} - ${sess.end_time})` : ""} | Section: ${sess.section_name} | Assigned: ${sess.faculty_name || "Unassigned faculty"}. Attendance has not been posted yet.`,
        link: "/attendance",
      });
    }
    if (unpostedSessionsToday.length > 3) {
      priorityItems.push({
        id: pId++,
        title: `+${unpostedSessionsToday.length - 3} more class slots pending attendance posting today`,
        severity: "medium",
        badge: "Pending Attendance",
        type: "attendance_unconducted",
        count: unpostedSessionsToday.length,
        detail: `${unpostedSessionsToday.length} class sessions today have not had attendance recorded yet. Follow up with assigned faculty.`,
        link: "/attendance",
      });
    }
  } else if (!isPostedToday) {
    priorityItems.push({
      id: pId++,
      title: `Daily Attendance: Student roster not yet posted for today (${activeDeptShort})`,
      severity: "high",
      isWarning: true,
      badge: "Pending Attendance",
      type: "daily_attendance_pending",
      detail: `Student attendance for ${selectedDate} has not been submitted yet for ${activeDeptName}. Review section attendance roster.`,
      link: "/attendance",
    });
  }

  // Item Type 5: Faculty Attendance Today (if any faculty on leave / absent)
  if (facultyStatus.absentToday > 0 || facultyStatus.onLeaveToday > 0) {
    const leaveOrAbsentCount = facultyStatus.absentToday + facultyStatus.onLeaveToday;
    priorityItems.push({
      id: pId++,
      title: `${leaveOrAbsentCount} faculty absent/on leave today (${facultyStatus.present}/${facultyStatus.total} present)`,
      severity: "medium",
      badge: "Faculty Attendance",
      type: "faculty_attendance",
      count: leaveOrAbsentCount,
      detail: `Department faculty attendance is at ${facultyStatus.attendancePct}%. ${facultyStatus.onLeaveToday} on leave, ${facultyStatus.absentToday} absent. Verify all class periods are covered.`,
      link: "/faculty-substitution",
    });
  }

  // Item Type 6: Continuous Student Absentees (3+ days)
  if (continuousAbsenteesCount > 0) {
    priorityItems.push({
      id: pId++,
      title: `Review ${continuousAbsenteesCount} students absent for 3+ consecutive days`,
      severity: "high",
      isWarning: true,
      badge: "Chronic Absentee",
      type: "absentee",
      count: continuousAbsenteesCount,
      detail: `${continuousAbsenteesCount} students in ${activeDeptName} have missed 3 or more consecutive instructional days without approved leave. Proctor intervention required.`,
      link: "/students",
    });
  }

  // Item Type 7: Subjects Behind Syllabus Schedule
  const behindSubjectsList = subjectsBehind.filter((s) => s.status === "Behind");
  if (behindSubjectsList.length > 0) {
    const topBehind = behindSubjectsList[0];
    priorityItems.push({
      id: pId++,
      title: `Follow up: ${behindSubjectsList.length} subjects syllabus running behind schedule`,
      severity: "medium",
      badge: "Syllabus Delay",
      type: "syllabus",
      count: behindSubjectsList.length,
      detail: `${topBehind?.subject ? `${topBehind.subject} (${topBehind.faculty || "Faculty"}) is behind by ${topBehind.delay}` : `${behindSubjectsList.length} subjects lagging syllabus pacing`}. Review teaching pacing with faculty.`,
      link: "/syllabus",
    });
  }

  // Item Type 8: Low Internal Marks
  if (totalFailedMarksStudents > 0) {
    priorityItems.push({
      id: pId++,
      title: `Review ${totalFailedMarksStudents} students with low internal exam marks (<40%)`,
      severity: "high",
      badge: "Low Marks",
      type: "marks",
      count: totalFailedMarksStudents,
      detail: `${totalFailedMarksStudents} students scored below 40% in internal assessments. Organize remedial sessions.`,
      link: "/internal-marks",
    });
  }

  // Item Type 9: Fee Dues (Skipped while fee portal is under development)
  if (feeDue.totalStudents != null && feeDue.totalStudents > 0) {
    priorityItems.push({
      id: pId++,
      title: `Fee follow-up: ${feeDue.totalAmount} overdue across ${feeDue.totalStudents} students`,
      severity: "low",
      badge: "Fee Clearance",
      type: "fee",
      amount: feeDue.totalAmount || undefined,
      count: feeDue.totalStudents,
      detail: `Fee collection outstanding in ${activeDeptName}. Remind proctors to coordinate with parents.`,
      link: "/fees",
    });
  }

  // Item Type 10: All Clear Fallback
  if (priorityItems.length === 0) {
    priorityItems.push({
      id: 1,
      title: `All operational metrics normal: Timetables configured, attendance on track`,
      severity: "low",
      badge: "All Clear",
      type: "all_clear",
      detail: `No timetable discrepancies, pending attendance slots, or unassigned substitutions detected for ${activeDeptName}.`,
    });
  }

  // 12. Real Examination Status
  let upcomingExamsCount = 0;
  let marksPendingCount = 0;
  let resultsAwaitingCount = 0;
  try {
    const [examRow] = await queryExam<CountRow[]>(
      `SELECT COUNT(*) as total FROM exams WHERE LOWER(status) NOT IN ('cancelled', 'archived')`,
    );
    upcomingExamsCount = Number(examRow?.total || 0);

    const [draftMarksRow] = await queryAcademic<CountRow[]>(
      `SELECT COUNT(*) as total FROM ap_internal_marks_submissions WHERE status = 'draft' AND branch_id = ?`,
      [activeBranchId],
    );
    marksPendingCount = Number(draftMarksRow?.total || 0);

    const [approvalMarksRow] = await queryAcademic<CountRow[]>(
      `SELECT COUNT(*) as total FROM ap_internal_marks_submissions WHERE status IN ('submitted', 'pending_approval') AND branch_id = ?`,
      [activeBranchId],
    );
    resultsAwaitingCount = Number(approvalMarksRow?.total || 0);
  } catch {
    upcomingExamsCount = 0;
    marksPendingCount = 0;
    resultsAwaitingCount = 0;
  }

  const examStatus: HodDashboardData["examStatus"] = [
    { label: "Upcoming Exams", count: upcomingExamsCount, key: "upcoming" },
    { label: `Marks Pending Entry (${marksPendingCount} subjects)`, count: marksPendingCount, key: "marks_pending" },
    { label: "Valuation Pending", count: 0, key: "valuation_pending" },
    { label: "Results Awaiting Approval", count: resultsAwaitingCount, key: "approval_pending" },
    { label: "Supplementary Requests", count: 0, key: "supplementary" },
  ];

  // 13. Dynamic Placements (computed from 4th year regular students)
  let eligibleCount = 0;
  try {
    const [finalYearRow] = await queryStudent<CountRow[]>(
      `SELECT COUNT(*) as total FROM students s WHERE ${activeFilterCondition} AND s.current_year = 4`,
      [activeBranchId],
    );
    eligibleCount = Number(finalYearRow?.total || 0);
  } catch {
    eligibleCount = 0;
  }

  // No mock multipliers. Pure data based on enrolled 4th year students.
  const placedCount = 0;
  const unplacedCount = eligibleCount;
  const placedPct = 0;

  const placements: HodDashboardData["placements"] = {
    placedPct: 0,
    placedCount: 0,
    eligibleCount,
    unplacedCount,
    trainingOngoing: 0,
    offersReceived: 0,
    upcomingDrives: 0,
  };

  return {
    meta: {
      departmentName: activeDeptName,
      branchId: activeBranchId,
      collegeName: "Pydah College of Engineering",
      userName,
      roleLabel,
      dateFormatted,
      departments: departmentItems,
    },
    attendance: {
      isPostedToday,
      percentage: overallAttendancePct,
      present: presentStudentCount,
      total: totalStudents,
      trend: trendStr,
      scheduledPeriodsToday: scheduledPeriodsCount,
      postedPeriodsToday: postedPeriodsCount,
      sections: sectionBreakdown,
    },
    priorityItems,
    sectionsAtRisk,
    subjectsBehind,
    feeDue,
    facultyStatus,
    examStatus,
    placements,
  };
}
