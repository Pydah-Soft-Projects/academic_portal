import type { RowDataPacket } from "mysql2";
import { executeAcademic, queryAcademic, queryStudent } from "../db/pools.js";
import type { AuthzContext } from "../authz/authorization.service.js";
import { getCurrentAcademicYearLabel } from "./masters.service.js";
import { ensureStaffLink, listFacultyOptions } from "./timetables.service.js";
import { writeAuditLog } from "./audit.service.js";

type StudentScopeRow = RowDataPacket & {
  id: number;
  admission_number: string;
  pin_no: string | null;
  student_name: string | null;
  college: string | null;
  course: string | null;
  branch: string | null;
  batch: string | null;
  section: string | null;
  section_name: string | null;
  current_year: number | null;
  current_semester: number | null;
  parent_mobile1: string | null;
  parent_mobile2: string | null;
  student_mobile: string | null;
  fee_status: string | null;
  attendance_pct: number | null;
};

type SessionRow = RowDataPacket & {
  id: number;
  period_slot_id: number;
  start_time: string | null;
  end_time: string | null;
  subject_code: string | null;
  subject_name: string | null;
  faculty_name: string | null;
  status: "scheduled" | "posted" | "cancelled" | "completed";
  section_name: string | null;
};

type InternalMarksRow = RowDataPacket & {
  student_db_id: number;
  submission_id: number;
  marks_obtained: number | null;
  max_marks: number | null;
  semester_number: number | null;
};

type AttendanceMonthRow = RowDataPacket & {
  month_name: string;
  month_num: number;
  pct: number | null;
};

type AbsenteeRow = RowDataPacket & {
  id: number;
  admission_number: string;
  pin_no: string | null;
  student_name: string | null;
  absent_days: number;
  last_date: string | null;
};

export async function getClassTeacherDashboardData(
  authz: AuthzContext,
  options: {
    section?: string;
    academicYear?: string;
    date?: string;
  } = {},
) {
  // 1. Resolve Staff Link & Profile for the Class Teacher
  const staffRows = await queryAcademic<
    (RowDataPacket & {
      id: number;
      display_name: string | null;
      department_name: string | null;
      hrms_employee_id: string;
    })[]
  >(
    `
    SELECT sl.id, sl.display_name, sl.department_name, sl.hrms_employee_id
    FROM ap_users u
    LEFT JOIN ap_staff_link sl ON sl.hrms_employee_id = u.hrms_employee_id
    WHERE u.id = ?
    LIMIT 1
    `,
    [authz.userId],
  );

  const staff = staffRows[0];
  const staffLinkId = staff?.id ?? null;

  // 2. Resolve Role Scope from ap_user_roles
  const roleRows = await queryAcademic<
    (RowDataPacket & { college_id: number | null; branch_id: number | null })[]
  >(
    `
    SELECT ur.college_id, ur.branch_id
    FROM ap_user_roles ur
    JOIN ap_roles r ON r.id = ur.role_id
    WHERE ur.user_id = ? AND r.role_key = 'class_teacher'
    LIMIT 1
    `,
    [authz.userId],
  );

  let collegeId: number | null = roleRows[0]?.college_id ?? authz.scope.collegeIds?.[0] ?? null;
  let branchId: number | null = roleRows[0]?.branch_id ?? authz.scope.branchIds?.[0] ?? null;
  let sectionName = options.section || null;
  let academicYear = options.academicYear || null;
  let semester: string | null = null;

  // 3. Query assigned mentees/students in scope
  let studentIds: number[] = [];
  if (staffLinkId) {
    const mentorRows = await queryAcademic<
      (RowDataPacket & { student_db_id: number; academic_year_label: string | null })[]
    >(
      `
      SELECT student_db_id, academic_year_label
      FROM ap_mentor_assignments
      WHERE faculty_staff_link_id = ? AND is_active = 1
      `,
      [staffLinkId],
    );
    if (mentorRows.length > 0) {
      studentIds = mentorRows.map((r) => Number(r.student_db_id));
      if (!academicYear && mentorRows[0]?.academic_year_label) {
        academicYear = `Academic Year ${mentorRows[0].academic_year_label}`;
      }
    }
  }

  // 4. Query students from student_db
  let students: StudentScopeRow[] = [];

  if (studentIds.length > 0) {
    students = await queryStudent<StudentScopeRow[]>(
      `
      SELECT
        s.id,
        s.admission_number,
        s.pin_no,
        s.student_name,
        s.college,
        s.course,
        s.branch,
        s.batch,
        s.section,
        s.section_name,
        s.current_year,
        s.current_semester,
        s.parent_mobile1,
        s.parent_mobile2,
        s.student_mobile,
        s.fee_status,
        s.attendance_pct
      FROM students s
      WHERE s.id IN (${studentIds.map(() => "?").join(",")})
      ORDER BY s.pin_no ASC, s.admission_number ASC
      `,
      studentIds,
    );
  }

  // Fallback: If no direct mentor assignments, find students scoped by teacher's branch and section
  if (students.length === 0 && (branchId != null || collegeId != null || sectionName != null)) {
    const whereParts: string[] = ["(s.student_status = 'Active' OR s.student_status IS NULL)"];
    const params: (string | number)[] = [];

    if (branchId != null) {
      whereParts.push("s.branch_id = ?");
      params.push(branchId);
    }
    if (collegeId != null) {
      whereParts.push("s.college_id = ?");
      params.push(collegeId);
    }
    if (sectionName) {
      whereParts.push("(s.section = ? OR s.section_name = ?)");
      params.push(sectionName, sectionName);
    }

    students = await queryStudent<StudentScopeRow[]>(
      `
      SELECT
        s.id,
        s.admission_number,
        s.pin_no,
        s.student_name,
        s.college,
        s.course,
        s.branch,
        s.batch,
        s.section,
        s.section_name,
        s.current_year,
        s.current_semester,
        s.parent_mobile1,
        s.parent_mobile2,
        s.student_mobile,
        s.fee_status,
        s.attendance_pct
      FROM students s
      WHERE ${whereParts.join(" AND ")}
      ORDER BY s.pin_no ASC, s.admission_number ASC
      LIMIT 100
      `,
      params,
    );
  }

  // Deduce section and semester from actual student records
  if (students.length > 0) {
    const first = students[0];
    const bName = first.branch || "CSE";
    const yr = first.current_year || 3;
    const sec = first.section || first.section_name || "A";
    const romYr = yr === 1 ? "I" : yr === 2 ? "II" : yr === 3 ? "III" : "IV";
    if (!sectionName) {
      sectionName = `${bName} ${romYr}-${sec}`;
    }
    if (first.current_semester) {
      semester = `Semester ${first.current_semester === 1 ? "I" : first.current_semester === 2 ? "II" : first.current_semester}`;
    }
    if (!academicYear && first.batch) {
      academicYear = `Academic Year ${first.batch}`;
    }
  }

  const totalStudents = students.length;

  // 5. Real Attendance Calculation from student database
  let avgAttendance: number | null = null;
  let presentCount: number | null = null;
  let absentCount: number | null = null;
  let lateCount: number | null = null;

  const studentsWithPct = students
    .filter((s) => s.attendance_pct != null)
    .map((s) => ({
      ...s,
      attendance: Number(s.attendance_pct),
    }));

  if (studentsWithPct.length > 0) {
    const sum = studentsWithPct.reduce((acc, curr) => acc + curr.attendance, 0);
    avgAttendance = Math.round((sum / studentsWithPct.length) * 10) / 10;
    presentCount = Math.round((avgAttendance / 100) * totalStudents);
    absentCount = Math.max(0, totalStudents - presentCount);
    lateCount = 0; // Set to real count if tracked, else 0
  }

  // Real Students below 65% attendance
  const below65List = studentsWithPct
    .filter((s) => s.attendance < 65)
    .sort((a, b) => a.attendance - b.attendance);

  const studentsBelow65Count: number | null =
    studentsWithPct.length > 0 ? below65List.length : null;

  // 6. Query Real Internal Marks
  let internalMarks: InternalMarksRow[] = [];
  if (students.length > 0) {
    try {
      const sIds = students.map((s) => s.id);
      internalMarks = await queryAcademic<InternalMarksRow[]>(
        `
        SELECT
          ime.student_db_id,
          ime.submission_id,
          ime.marks_obtained,
          ime.max_marks,
          ims.semester_number
        FROM ap_internal_marks_entries ime
        JOIN ap_internal_marks_submissions ims ON ims.id = ime.submission_id
        WHERE ime.student_db_id IN (${sIds.map(() => "?").join(",")})
        `,
        sIds,
      );
    } catch {
      internalMarks = [];
    }
  }

  let internal1FailedCount: number | null = null;
  let internal2FailedCount: number | null = null;
  let failedBothCount: number | null = null;
  let internalPerformance: {
    internal1: { passed: number; failed: number };
    internal2: { passed: number; failed: number };
    failedBothCount: number;
  } | null = null;

  const studentMarksMap = new Map<
    number,
    { int1Passed?: boolean; int2Passed?: boolean }
  >();

  if (internalMarks.length > 0) {
    let int1Passed = 0;
    let int1Failed = 0;
    let int2Passed = 0;
    let int2Failed = 0;
    let bothFailed = 0;

    for (const row of internalMarks) {
      const sid = Number(row.student_db_id);
      const isPassed =
        row.marks_obtained != null &&
        Number(row.marks_obtained) >= Number(row.max_marks || 30) * 0.4;

      const cur = studentMarksMap.get(sid) || {};
      if (cur.int1Passed === undefined) {
        cur.int1Passed = isPassed;
        if (isPassed) int1Passed++;
        else int1Failed++;
      } else {
        cur.int2Passed = isPassed;
        if (isPassed) int2Passed++;
        else int2Failed++;
      }
      studentMarksMap.set(sid, cur);
    }

    studentMarksMap.forEach((st) => {
      if (st.int1Passed === false && st.int2Passed === false) bothFailed++;
    });

    internal1FailedCount = int1Failed;
    internal2FailedCount = int2Failed;
    failedBothCount = bothFailed;

    internalPerformance = {
      internal1: { passed: int1Passed, failed: int1Failed },
      internal2: { passed: int2Passed, failed: int2Failed },
      failedBothCount: bothFailed,
    };
  }

  // 7. Real Fee Status Calculation
  let feePaid = 0;
  let feePartial = 0;
  let feePending = 0;
  let hasAnyFeeStatus = false;

  for (const s of students) {
    if (s.fee_status != null && s.fee_status.trim() !== "") {
      hasAnyFeeStatus = true;
      const st = s.fee_status.toLowerCase();
      if (st.includes("paid") && !st.includes("partial") && !st.includes("not")) {
        feePaid++;
      } else if (st.includes("partial")) {
        feePartial++;
      } else {
        feePending++;
      }
    }
  }

  const feeStatusData = hasAnyFeeStatus
    ? {
        paid: feePaid,
        partial: feePartial,
        pending: feePending,
        total: totalStudents,
      }
    : null;

  const feePendingCount: number | null = hasAnyFeeStatus ? feePending : null;

  // 8. Real Today's Timetable Sessions from database
  const todayDate = options.date || new Date().toISOString().split("T")[0];
  let timetableSessions: Array<{
    time: string;
    subject: string;
    faculty: string;
    status: "Conducted" | "Ongoing" | "Upcoming";
  }> = [];

  try {
    const sessionConditions: string[] = ["cs.session_date = ?"];
    const sessionParams: (string | number)[] = [todayDate];

    if (branchId != null) {
      sessionConditions.push("cs.branch_id = ?");
      sessionParams.push(branchId);
    }

    const sessionRows = await queryAcademic<SessionRow[]>(
      `
      SELECT
        cs.id,
        cs.period_slot_id,
        DATE_FORMAT(cs.start_time, '%H:%i') AS start_time,
        DATE_FORMAT(cs.end_time, '%H:%i') AS end_time,
        cs.subject_code,
        cs.subject_name,
        sl.display_name AS faculty_name,
        cs.status,
        cs.section_name
      FROM ap_class_sessions cs
      LEFT JOIN ap_staff_link sl ON sl.id = cs.faculty_staff_link_id
      WHERE ${sessionConditions.join(" AND ")}
      ORDER BY cs.period_slot_id ASC
      LIMIT 10
      `,
      sessionParams,
    );

    if (sessionRows.length > 0) {
      timetableSessions = sessionRows.map((s, idx) => {
        const timeStr =
          s.start_time && s.end_time
            ? `${s.start_time} - ${s.end_time}`
            : `Period ${s.period_slot_id || idx + 1}`;

        const statusLabel: "Conducted" | "Ongoing" | "Upcoming" =
          s.status === "posted" || s.status === "completed"
            ? "Conducted"
            : s.status === "scheduled" && idx === 0
              ? "Ongoing"
              : "Upcoming";

        return {
          time: timeStr,
          subject: s.subject_name || s.subject_code || "Subject",
          faculty: s.faculty_name || "Faculty",
          status: statusLabel,
        };
      });
    }
  } catch {
    timetableSessions = [];
  }

  // 9. Real Students Below 65% Table (Empty if none)
  const below65Table = below65List.slice(0, 10).map((s, idx) => ({
    id: s.id,
    rollNo: s.pin_no || s.admission_number || `Roll #${idx + 1}`,
    name: s.student_name || "—",
    attendance: `${s.attendance}%`,
    phone: s.parent_mobile1 || s.parent_mobile2 || s.student_mobile || null,
  }));

  // 10. Real Students at Academic Risk Table
  const atRiskStudents = studentsWithPct
    .filter((s) => {
      const marks = studentMarksMap.get(s.id);
      return (
        s.attendance < 65 ||
        marks?.int1Passed === false ||
        marks?.int2Passed === false
      );
    })
    .slice(0, 10)
    .map((s) => {
      const marks = studentMarksMap.get(s.id);
      const isCritical =
        (marks?.int1Passed === false && marks?.int2Passed === false) ||
        s.attendance < 55;
      const isHigh =
        marks?.int1Passed === false ||
        marks?.int2Passed === false ||
        s.attendance < 65;

      return {
        id: s.id,
        rollNo: s.pin_no || s.admission_number || "—",
        name: s.student_name || "—",
        attendance: `${s.attendance}%`,
        int1: marks?.int1Passed === false ? ("F" as const) : marks?.int1Passed === true ? ("P" as const) : ("—" as const),
        int2: marks?.int2Passed === false ? ("F" as const) : marks?.int2Passed === true ? ("P" as const) : ("—" as const),
        risk: isCritical
          ? ("Critical" as const)
          : isHigh
            ? ("High" as const)
            : ("Medium" as const),
      };
    });

  // 11. Real Continuous Absentees (3+ days) from attendance_records
  let continuousAbsentees: Array<{
    id: number;
    rollNo: string;
    name: string;
    days: number;
    lastAttended: string;
  }> = [];

  if (students.length > 0) {
    try {
      const sIds = students.map((s) => s.id);
      const absRows = await queryStudent<AbsenteeRow[]>(
        `
        SELECT
          s.id,
          s.admission_number,
          s.pin_no,
          s.student_name,
          COUNT(*) AS absent_days,
          DATE_FORMAT(MAX(ar.attendance_date), '%d %b') AS last_date
        FROM attendance_records ar
        JOIN students s ON s.id = ar.student_id
        WHERE ar.student_id IN (${sIds.map(() => "?").join(",")})
          AND ar.status = 'absent'
          AND ar.attendance_date >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
        GROUP BY s.id, s.admission_number, s.pin_no, s.student_name
        HAVING absent_days >= 3
        ORDER BY absent_days DESC
        LIMIT 10
        `,
        sIds,
      );

      continuousAbsentees = absRows.map((r) => ({
        id: r.id,
        rollNo: r.pin_no || r.admission_number || "—",
        name: r.student_name || "—",
        days: Number(r.absent_days),
        lastAttended: r.last_date || "—",
      }));
    } catch {
      continuousAbsentees = [];
    }
  }

  // 12. Real Attendance Trend from attendance_records (Empty if no records)
  let attendanceTrend: Array<{ month: string; value: number }> = [];

  if (students.length > 0) {
    try {
      const sIds = students.map((s) => s.id);
      const trendRows = await queryStudent<AttendanceMonthRow[]>(
        `
        SELECT
          DATE_FORMAT(ar.attendance_date, '%b') AS month_name,
          MONTH(ar.attendance_date) AS month_num,
          ROUND(
            SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) * 100.0 /
            NULLIF(SUM(CASE WHEN ar.status IN ('present','absent') THEN 1 ELSE 0 END), 0),
            1
          ) AS pct
        FROM attendance_records ar
        WHERE ar.student_id IN (${sIds.map(() => "?").join(",")})
          AND ar.attendance_date >= DATE_SUB(CURDATE(), INTERVAL 4 MONTH)
        GROUP BY month_num, month_name
        ORDER BY month_num ASC
        `,
        sIds,
      );

      if (trendRows.length > 0) {
        attendanceTrend = trendRows
          .filter((r) => r.pct != null)
          .map((r) => ({
            month: r.month_name,
            value: Number(r.pct),
          }));
      }
    } catch {
      attendanceTrend = [];
    }
  }

  // 13. Dynamic Priorities derived strictly from live conditions (Empty if none)
  const todaysPriorities: Array<{ id: number; text: string; severity: string }> = [];
  let pIdx = 1;

  if (continuousAbsentees.length > 0) {
    todaysPriorities.push({
      id: pIdx++,
      text: `Contact ${continuousAbsentees.length} students absent for 3+ days`,
      severity: "critical",
    });
  }

  if (below65List.length > 0) {
    todaysPriorities.push({
      id: pIdx++,
      text: `Review ${below65List.length} students below 65% attendance`,
      severity: "critical",
    });
  }

  if (failedBothCount != null && failedBothCount > 0) {
    todaysPriorities.push({
      id: pIdx++,
      text: `Meet ${failedBothCount} students who failed both internals`,
      severity: "warning",
    });
  }

  if (feePending > 0) {
    todaysPriorities.push({
      id: pIdx++,
      text: `Follow up with ${feePending} students with pending fees`,
      severity: "warning",
    });
  }

  // 14. Real Upcoming Notices from ap_alerts
  let upcomingNotices: Array<{
    date: string;
    month: string;
    title: string;
    scope: string;
  }> = [];

  try {
    const alertRows = await queryAcademic<
      (RowDataPacket & {
        title: string;
        body: string | null;
        created_at: string;
      })[]
    >(
      `
      SELECT title, body, DATE_FORMAT(created_at, '%d') AS day_str, DATE_FORMAT(created_at, '%b') AS month_str
      FROM ap_alerts
      WHERE is_read = 0 AND (target_user_id IS NULL OR target_user_id = ?)
      ORDER BY created_at DESC
      LIMIT 5
      `,
      [authz.userId],
    );

    upcomingNotices = alertRows.map((r) => ({
      date: (r as unknown as { day_str: string }).day_str || "—",
      month: (r as unknown as { month_str: string }).month_str || "",
      title: r.title,
      scope: r.body || "Notice",
    }));
  } catch {
    upcomingNotices = [];
  }

  return {
    meta: {
      sectionName: sectionName || "—",
      academicYear: academicYear || "—",
      semester: semester || "—",
      teacherName: staff?.display_name || authz.roles?.[0]?.label || "Class Teacher",
      departmentName: staff?.department_name || "—",
      dateFormatted: new Date().toLocaleDateString("en-US", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      totalStudents,
    },
    kpis: {
      classAttendance: {
        percentage: avgAttendance,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
      },
      studentsBelow65Count,
      internal1FailedCount,
      internal2FailedCount,
      failedBothCount,
      feePendingCount,
    },
    attendanceTrend,
    todaysPriorities,
    todaysTimetable: timetableSessions,
    below65Students: below65Table,
    internalPerformance,
    academicRiskStudents: atRiskStudents,
    feeStatus: feeStatusData,
    continuousAbsentees,
    upcomingNotices,
  };
}

export type ClassTeacherOverviewFilters = {
  academicYear?: string;
  collegeId?: number;
  collegeIds?: number[];
  courseId?: number;
  branchId?: number;
  branchIds?: number[];
  batch?: string;
  year?: number;
  semester?: number;
  section?: string;
  status?: "all" | "assigned" | "unassigned" | "timetable_published" | "timetable_draft" | "timetable_pending";
  searchQuery?: string;
};

export type ClassTeacherSectionItem = {
  collegeId: number;
  collegeName: string;
  collegeCode: string;
  courseId: number;
  courseName: string;
  branchId: number;
  branchName: string;
  batch: string;
  year: number;
  semester: number;
  sectionName: string;
  studentCount: number;
  timetable: {
    status: "published" | "draft" | "pending";
    planId: number | null;
    versionNo: number | null;
    updatedAt: string | null;
  };
  classTeacher: {
    facultyStaffLinkId: number;
    facultyName: string;
    hrmsEmployeeId: string;
    departmentName: string | null;
    designation: string | null;
    assignedStudentsCount: number;
  } | null;
};

export async function getClassTeacherOverview(
  authz: AuthzContext,
  filters: ClassTeacherOverviewFilters = {},
) {
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
  } else if (authz.scope.collegeIds && authz.scope.collegeIds.length > 0) {
    collegeWhere.push(`id IN (${authz.scope.collegeIds.map(() => "?").join(",")})`);
    collegeParams.push(...authz.scope.collegeIds);
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
    collegeParams,
  );

  // 2. Fetch target classes from student database
  const targetWhere: string[] = [
    "(s.student_status = 'Regular' OR s.student_status = 'Active' OR s.student_status IS NULL)",
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
  } else if (authz.scope.collegeIds && authz.scope.collegeIds.length > 0) {
    targetWhere.push(`c.id IN (${authz.scope.collegeIds.map(() => "?").join(",")})`);
    targetParams.push(...authz.scope.collegeIds);
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
  } else if (authz.scope.branchIds && authz.scope.branchIds.length > 0) {
    targetWhere.push(`cb.id IN (${authz.scope.branchIds.map(() => "?").join(",")})`);
    targetParams.push(...authz.scope.branchIds);
  }

  if (filters.batch && filters.batch !== "all") {
    targetWhere.push("TRIM(s.batch) = ?");
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
  if (filters.section && filters.section !== "all") {
    targetWhere.push("TRIM(COALESCE(ss.section_name, s.section, 'A')) = ?");
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
      TRIM(COALESCE(ss.section_name, s.section, 'A')) AS section_name,
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
      TRIM(COALESCE(ss.section_name, s.section, 'A'))
    HAVING COUNT(DISTINCT s.id) > 0
    ORDER BY c.name, cr.name, cb.name, s.current_year, s.current_semester, section_name
    `,
    targetParams,
  );

  // 3. Fetch timetable plans from academic database
  const planWhere: string[] = ["status IN ('published', 'draft', 'in_review')"];
  const planParams: unknown[] = [];
  if (academicYear) {
    planWhere.push("(academic_year_label = ? OR academic_year_label IS NULL)");
    planParams.push(academicYear);
  }
  if (filters.collegeId) {
    planWhere.push("college_id = ?");
    planParams.push(filters.collegeId);
  } else if (filters.collegeIds && filters.collegeIds.length > 0) {
    planWhere.push(`college_id IN (${filters.collegeIds.map(() => "?").join(",")})`);
    planParams.push(...filters.collegeIds);
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
    planParams,
  );

  const planMap = new Map<
    string,
    { status: "published" | "draft"; planId: number; versionNo: number; updatedAt: string | null }
  >();

  for (const p of plans) {
    const sec = (p.section_name || "A").trim().toUpperCase();
    const batch = (p.batch || "").trim().toUpperCase();
    const key = `${p.college_id}:${p.branch_id}:${batch}:${p.semester_number}:${sec}`;
    const keyWithYear = `${p.college_id}:${p.branch_id}:${batch}:${p.year_of_study}:${p.semester_number}:${sec}`;
    const isPub = p.status === "published";
    const mappedStatus: "published" | "draft" = isPub ? "published" : "draft";

    const item = {
      status: mappedStatus,
      planId: Number(p.id),
      versionNo: Number(p.version_no) || 1,
      updatedAt: p.updated_at ? String(p.updated_at) : null,
    };

    const existing = planMap.get(key);
    if (!existing || (!existing.status.includes("published") && isPub)) {
      planMap.set(key, item);
    }
    if (p.year_of_study) {
      const existingYear = planMap.get(keyWithYear);
      if (!existingYear || (!existingYear.status.includes("published") && isPub)) {
        planMap.set(keyWithYear, item);
      }
    }
  }

  // 4. Fetch active mentor/class teacher assignments
  const mentorAssignments = await queryAcademic<
    (RowDataPacket & {
      student_db_id: number;
      faculty_staff_link_id: number;
      academic_year_label: string | null;
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
      ma.academic_year_label,
      ma.notes,
      sl.display_name AS faculty_name,
      sl.hrms_employee_id,
      sl.department_name
    FROM ap_mentor_assignments ma
    JOIN ap_staff_link sl ON sl.id = ma.faculty_staff_link_id
    WHERE ma.is_active = 1
    `,
  );

  // Group active student IDs to section keys
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
          current_year: number | null;
          current_semester: number;
          section_name: string;
        })[]
      >(
        `
        SELECT
          s.id,
          s.branch_id,
          TRIM(s.batch) AS batch,
          s.current_year,
          s.current_semester,
          TRIM(COALESCE(ss.section_name, s.section, 'A')) AS section_name
        FROM students s
        LEFT JOIN student_sections ss ON ss.student_id = s.id
        WHERE s.id IN (${slice.map(() => "?").join(",")})
        `,
        slice,
      );

      for (const row of studentSectionRows) {
        const batch = (row.batch || "").trim().toUpperCase();
        const sec = (row.section_name || "A").trim().toUpperCase();
        const yr = row.current_year ? String(row.current_year) : "";
        const keyWithYear = `${row.branch_id}:${batch}:${yr}:${row.current_semester}:${sec}`;
        const key = `${row.branch_id}:${batch}:${row.current_semester}:${sec}`;
        studentToSectionKeyMap.set(Number(row.id), keyWithYear);
        // Also ensure fallback key is set if not already present
        if (!studentToSectionKeyMap.has(Number(row.id))) {
          studentToSectionKeyMap.set(Number(row.id), key);
        }
      }
    }
  }

  // Section Key -> Map of facultyStaffLinkId -> count & faculty info
  type SectionFacultyTally = {
    facultyStaffLinkId: number;
    facultyName: string;
    hrmsEmployeeId: string;
    departmentName: string | null;
    count: number;
  };
  const sectionTeacherMap = new Map<string, Map<number, SectionFacultyTally>>();

  const addFacultyTally = (secKey: string, ma: typeof mentorAssignments[0]) => {
    let facultyTallies = sectionTeacherMap.get(secKey);
    if (!facultyTallies) {
      facultyTallies = new Map();
      sectionTeacherMap.set(secKey, facultyTallies);
    }
    const fid = Number(ma.faculty_staff_link_id);
    const cur = facultyTallies.get(fid) ?? {
      facultyStaffLinkId: fid,
      facultyName: ma.faculty_name || "Staff",
      hrmsEmployeeId: ma.hrms_employee_id || "",
      departmentName: ma.department_name || null,
      count: 0,
    };
    cur.count++;
    facultyTallies.set(fid, cur);
  };

  for (const ma of mentorAssignments) {
    const sid = Number(ma.student_db_id);

    if (sid > 0) {
      const secKeyWithYear = studentToSectionKeyMap.get(sid);
      if (secKeyWithYear) {
        addFacultyTally(secKeyWithYear, ma);
        // Also register under general key without year
        const parts = secKeyWithYear.split(":");
        if (parts.length >= 5) {
          const generalKey = `${parts[0]}:${parts[1]}:${parts[3]}:${parts[4]}`;
          addFacultyTally(generalKey, ma);
        }
      }
    } else if (ma.notes) {
      try {
        const parsed = JSON.parse(ma.notes) as {
          branchId?: number;
          batch?: string;
          year?: number;
          semester?: number;
          section?: string;
        };
        if (parsed.branchId && parsed.batch) {
          const bUpper = (parsed.batch || "").trim().toUpperCase();
          const sUpper = (parsed.section || "A").trim().toUpperCase();
          const sem = parsed.semester || 1;
          const fallbackKey = `${parsed.branchId}:${bUpper}:${sem}:${sUpper}`;
          addFacultyTally(fallbackKey, ma);
          if (parsed.year) {
            const yearKey = `${parsed.branchId}:${bUpper}:${parsed.year}:${sem}:${sUpper}`;
            addFacultyTally(yearKey, ma);
          }
        }
      } catch {
        // Ignore JSON parse failure
      }
    }
  }

  // 5. Construct Section Items
  const items: ClassTeacherSectionItem[] = [];

  for (const r of targetRows) {
    const batchUpper = (r.batch || "").trim().toUpperCase();
    const secUpper = (r.section_name || "A").trim().toUpperCase();
    const planKeyWithYear = `${r.college_id}:${r.branch_id}:${batchUpper}:${r.year}:${r.semester}:${secUpper}`;
    const planKey = `${r.college_id}:${r.branch_id}:${batchUpper}:${r.semester}:${secUpper}`;
    const sectionKeyWithYear = `${r.branch_id}:${batchUpper}:${r.year}:${r.semester}:${secUpper}`;
    const sectionKey = `${r.branch_id}:${batchUpper}:${r.semester}:${secUpper}`;

    const timetableMeta = planMap.get(planKeyWithYear) ?? planMap.get(planKey) ?? {
      status: "pending" as const,
      planId: null,
      versionNo: null,
      updatedAt: null,
    };

    // Resolve class teacher
    let teacherMeta: ClassTeacherSectionItem["classTeacher"] = null;
    const facultyTallies =
      sectionTeacherMap.get(sectionKeyWithYear) ?? sectionTeacherMap.get(sectionKey);
    if (facultyTallies && facultyTallies.size > 0) {
      // Pick faculty with highest count
      const sorted = Array.from(facultyTallies.values()).sort((a, b) => b.count - a.count);
      const best = sorted[0];
      if (best) {
        teacherMeta = {
          facultyStaffLinkId: best.facultyStaffLinkId,
          facultyName: best.facultyName,
          hrmsEmployeeId: best.hrmsEmployeeId,
          departmentName: best.departmentName,
          designation: null,
          assignedStudentsCount: best.count,
        };
      }
    }

    items.push({
      collegeId: Number(r.college_id),
      collegeName: r.college_name,
      collegeCode: r.college_code || "",
      courseId: Number(r.course_id),
      courseName: r.course_name,
      branchId: Number(r.branch_id),
      branchName: r.branch_name,
      batch: r.batch,
      year: Number(r.year),
      semester: Number(r.semester),
      sectionName: r.section_name,
      studentCount: Number(r.student_count),
      timetable: timetableMeta,
      classTeacher: teacherMeta,
    });
  }

  // 6. Summary metrics
  const totalSections = items.length;
  const timetablesPublished = items.filter((i) => i.timetable.status === "published").length;
  const timetablesDraft = items.filter((i) => i.timetable.status === "draft").length;
  const timetablesPending = items.filter((i) => i.timetable.status === "pending").length;
  const teachersAssigned = items.filter((i) => i.classTeacher !== null).length;
  const teachersPending = items.filter((i) => i.classTeacher === null).length;

  // College-level breakdown
  const collegeBreakdownMap = new Map<
    number,
    {
      collegeId: number;
      collegeName: string;
      collegeCode: string;
      totalSections: number;
      publishedCount: number;
      draftCount: number;
      pendingCount: number;
      teachersAssignedCount: number;
    }
  >();

  for (const c of colleges) {
    collegeBreakdownMap.set(c.id, {
      collegeId: c.id,
      collegeName: c.name,
      collegeCode: c.code || "",
      totalSections: 0,
      publishedCount: 0,
      draftCount: 0,
      pendingCount: 0,
      teachersAssignedCount: 0,
    });
  }

  for (const item of items) {
    const col = collegeBreakdownMap.get(item.collegeId);
    if (col) {
      col.totalSections++;
      if (item.timetable.status === "published") col.publishedCount++;
      else if (item.timetable.status === "draft") col.draftCount++;
      else col.pendingCount++;

      if (item.classTeacher !== null) col.teachersAssignedCount++;
    }
  }

  return {
    academicYear,
    summary: {
      totalColleges: colleges.length,
      totalSections,
      timetablesPublished,
      timetablesDraft,
      timetablesConfigured: timetablesPublished + timetablesDraft,
      timetablesPending,
      teachersAssigned,
      teachersPending,
    },
    colleges: Array.from(collegeBreakdownMap.values()),
    sections: items,
  };
}

export async function getClassTeacherForSection(scope: {
  branchId?: number | null;
  batch?: string | null;
  year?: number | null;
  semester?: number | null;
  section?: string | null;
  academicYear?: string | null;
}) {
  if (!scope.branchId || !scope.batch) return null;
  const batch = scope.batch.trim();
  const secName = (scope.section || "A").trim();

  // 1. Check students in section
  const studentRows = await queryStudent<{ id: number }[]>(
    `
    SELECT s.id
    FROM students s
    LEFT JOIN student_sections ss ON ss.student_id = s.id
    WHERE s.branch_id = ?
      AND TRIM(s.batch) COLLATE utf8mb4_unicode_ci = ?
      ${scope.year ? "AND s.current_year = ?" : ""}
      ${scope.semester ? "AND s.current_semester = ?" : ""}
      AND TRIM(COALESCE(ss.section_name COLLATE utf8mb4_unicode_ci, s.section, 'A')) = ?
      AND (TRIM(COALESCE(s.student_status, '')) COLLATE utf8mb4_unicode_ci IN ('Regular', 'Active') OR s.student_status IS NULL)
    `,
    [
      scope.branchId,
      batch,
      ...(scope.year ? [scope.year] : []),
      ...(scope.semester ? [scope.semester] : []),
      secName,
    ],
  );

  const totalStudents = studentRows.length;
  const studentIds = studentRows.map((s) => s.id);

  if (studentIds.length > 0) {
    const placeholders = studentIds.map(() => "?").join(",");
    const rows = await queryAcademic<
      (RowDataPacket & {
        faculty_staff_link_id: number;
        faculty_name: string;
        hrms_employee_id: string;
        department_name: string | null;
        assigned_count: number;
      })[]
    >(
      `
      SELECT
        ma.faculty_staff_link_id,
        sl.display_name AS faculty_name,
        sl.hrms_employee_id,
        sl.department_name,
        COUNT(ma.id) AS assigned_count
      FROM ap_mentor_assignments ma
      JOIN ap_staff_link sl ON sl.id = ma.faculty_staff_link_id
      WHERE ma.student_db_id IN (${placeholders})
        AND ma.is_active = 1
      GROUP BY ma.faculty_staff_link_id, sl.display_name, sl.hrms_employee_id, sl.department_name
      ORDER BY assigned_count DESC
      LIMIT 1
      `,
      studentIds,
    );

    if (rows[0]) {
      return {
        facultyStaffLinkId: Number(rows[0].faculty_staff_link_id),
        facultyName: rows[0].faculty_name || "Staff",
        hrmsEmployeeId: rows[0].hrms_employee_id || "",
        departmentName: rows[0].department_name || null,
        designation: null,
        assignedCount: Number(rows[0].assigned_count),
        totalStudents,
      };
    }
  }

  // 2. Check placeholder with student_db_id = 0
  const placeholderRows = await queryAcademic<
    (RowDataPacket & {
      faculty_staff_link_id: number;
      faculty_name: string;
      hrms_employee_id: string;
      department_name: string | null;
    })[]
  >(
    `
    SELECT
      ma.faculty_staff_link_id,
      sl.display_name AS faculty_name,
      sl.hrms_employee_id,
      sl.department_name
    FROM ap_mentor_assignments ma
    JOIN ap_staff_link sl ON sl.id = ma.faculty_staff_link_id
    WHERE ma.student_db_id = 0
      AND ma.is_active = 1
      AND ma.notes LIKE ?
    ORDER BY ma.id DESC
    LIMIT 1
    `,
    [`%"branchId":${scope.branchId},"batch":"${batch}"%"section":"${secName}"%`],
  );

  if (placeholderRows[0]) {
    return {
      facultyStaffLinkId: Number(placeholderRows[0].faculty_staff_link_id),
      facultyName: placeholderRows[0].faculty_name || "Staff",
      hrmsEmployeeId: placeholderRows[0].hrms_employee_id || "",
      departmentName: placeholderRows[0].department_name || null,
      designation: null,
      assignedCount: 0,
      totalStudents,
    };
  }

  return null;
}

export async function assignClassTeacherToSection(
  authz: AuthzContext,
  input: {
    facultyStaffLinkId?: number;
    hrmsEmployeeId?: string;
    facultyName?: string;
    departmentName?: string;
    collegeId: number;
    courseId?: number;
    branchId: number;
    batch: string;
    year?: number | null;
    semester?: number | null;
    sectionName: string;
    academicYearLabel?: string;
    notes?: string;
    ipAddress?: string | null;
  },
) {
  // 1. Resolve facultyStaffLinkId
  let staffLinkId = input.facultyStaffLinkId;
  if (!staffLinkId && input.hrmsEmployeeId) {
    staffLinkId = await ensureStaffLink({
      hrmsEmployeeId: input.hrmsEmployeeId,
      displayName: input.facultyName ?? null,
      departmentName: input.departmentName ?? null,
    });
  }
  if (!staffLinkId) {
    throw Object.assign(new Error("Faculty staff record is required"), { status: 400 });
  }

  const academicYear = input.academicYearLabel?.trim() || getCurrentAcademicYearLabel();
  const secName = (input.sectionName || "A").trim();
  const batch = (input.batch || "").trim();

  // 2. Fetch students in this section from student database
  const studentRows = await queryStudent<{ id: number }[]>(
    `
    SELECT s.id
    FROM students s
    LEFT JOIN student_sections ss ON ss.student_id = s.id
    WHERE s.branch_id = ?
      AND TRIM(s.batch) = ?
      ${input.year ? "AND s.current_year = ?" : ""}
      ${input.semester ? "AND s.current_semester = ?" : ""}
      AND TRIM(COALESCE(ss.section_name, s.section, 'A')) = ?
      AND (s.student_status = 'Regular' OR s.student_status = 'Active' OR s.student_status IS NULL)
    `,
    [
      input.branchId,
      batch,
      ...(input.year ? [input.year] : []),
      ...(input.semester ? [input.semester] : []),
      secName,
    ],
  );

  const studentIds = studentRows.map((s) => s.id);
  const scopeNotes = JSON.stringify({
    type: "class_teacher",
    collegeId: input.collegeId,
    courseId: input.courseId ?? null,
    branchId: input.branchId,
    batch,
    year: input.year ?? null,
    semester: input.semester ?? null,
    section: secName,
  });

  // 3. Deactivate previous active mentor/class teacher assignments for this section
  if (studentIds.length > 0) {
    const placeholders = studentIds.map(() => "?").join(",");
    await executeAcademic(
      `
      UPDATE ap_mentor_assignments
      SET is_active = 0, deactivated_at = NOW()
      WHERE student_db_id IN (${placeholders})
        AND is_active = 1
      `,
      studentIds,
    );
  }

  // Also deactivate any placeholder assignment matching this section scope
  await executeAcademic(
    `
    UPDATE ap_mentor_assignments
    SET is_active = 0, deactivated_at = NOW()
    WHERE student_db_id = 0
      AND is_active = 1
      AND notes LIKE ?
    `,
    [`%"branchId":${input.branchId},"batch":"${batch}"%"section":"${secName}"%`],
  );

  // 4. Insert new assignments
  let assignedCount = 0;
  if (studentIds.length > 0) {
    const insertValues: unknown[] = [];
    const valPlaceholders: string[] = [];
    for (const sid of studentIds) {
      valPlaceholders.push("(?, ?, ?, ?, 1, ?)");
      insertValues.push(sid, staffLinkId, authz.userId, academicYear, scopeNotes);
    }
    await executeAcademic(
      `
      INSERT INTO ap_mentor_assignments
        (student_db_id, faculty_staff_link_id, assigned_by, academic_year_label, is_active, notes)
      VALUES ${valPlaceholders.join(", ")}
      ON DUPLICATE KEY UPDATE
        faculty_staff_link_id = VALUES(faculty_staff_link_id),
        assigned_by = VALUES(assigned_by),
        is_active = 1,
        deactivated_at = NULL,
        notes = VALUES(notes)
      `,
      insertValues,
    );
    assignedCount = studentIds.length;
  } else {
    // Section has 0 students currently: insert placeholder so section teacher is persisted
    await executeAcademic(
      `
      INSERT INTO ap_mentor_assignments
        (student_db_id, faculty_staff_link_id, assigned_by, academic_year_label, is_active, notes)
      VALUES (0, ?, ?, ?, 1, ?)
      `,
      [staffLinkId, authz.userId, academicYear, scopeNotes],
    );
    assignedCount = 0;
  }

  // 5. Audit log
  await writeAuditLog({
    actorUserId: authz.userId,
    action: "class_teacher.assigned",
    entityType: "ap_mentor_assignments",
    entityId: staffLinkId,
    newValue: {
      facultyStaffLinkId: staffLinkId,
      collegeId: input.collegeId,
      branchId: input.branchId,
      batch,
      year: input.year,
      semester: input.semester,
      section: secName,
      assignedStudentsCount: assignedCount,
    },
    ipAddress: input.ipAddress,
  });

  return { ok: true, assignedCount };
}

export async function unassignClassTeacherFromSection(
  authz: AuthzContext,
  input: {
    collegeId?: number;
    branchId: number;
    batch: string;
    year?: number | null;
    semester?: number | null;
    sectionName: string;
    academicYearLabel?: string;
    ipAddress?: string | null;
  },
) {
  const batch = (input.batch || "").trim();
  const secName = (input.sectionName || "A").trim();

  // 1. Find students in this section
  const studentRows = await queryStudent<{ id: number }[]>(
    `
    SELECT s.id
    FROM students s
    LEFT JOIN student_sections ss ON ss.student_id = s.id
    WHERE s.branch_id = ?
      AND TRIM(s.batch) = ?
      ${input.year ? "AND s.current_year = ?" : ""}
      ${input.semester ? "AND s.current_semester = ?" : ""}
      AND TRIM(COALESCE(ss.section_name, s.section, 'A')) = ?
    `,
    [
      input.branchId,
      batch,
      ...(input.year ? [input.year] : []),
      ...(input.semester ? [input.semester] : []),
      secName,
    ],
  );

  const studentIds = studentRows.map((s) => s.id);
  if (studentIds.length > 0) {
    const placeholders = studentIds.map(() => "?").join(",");
    await executeAcademic(
      `
      UPDATE ap_mentor_assignments
      SET is_active = 0, deactivated_at = NOW()
      WHERE student_db_id IN (${placeholders})
        AND is_active = 1
      `,
      studentIds,
    );
  }

  // Deactivate placeholder if any
  await executeAcademic(
    `
    UPDATE ap_mentor_assignments
    SET is_active = 0, deactivated_at = NOW()
    WHERE student_db_id = 0
      AND is_active = 1
      AND notes LIKE ?
    `,
    [`%"branchId":${input.branchId},"batch":"${batch}"%"section":"${secName}"%`],
  );

  await writeAuditLog({
    actorUserId: authz.userId,
    action: "class_teacher.unassigned",
    entityType: "ap_mentor_assignments",
    newValue: {
      branchId: input.branchId,
      batch,
      section: secName,
    },
    ipAddress: input.ipAddress,
  });

  return { ok: true };
}

export async function listClassTeacherFacultyOptions() {
  const faculty = await listFacultyOptions(500);

  // Count active section assignments for each faculty
  const counts = await queryAcademic<
    (RowDataPacket & { faculty_staff_link_id: number; section_count: number })[]
  >(
    `
    SELECT
      ma.faculty_staff_link_id,
      COUNT(DISTINCT ma.notes) AS section_count
    FROM ap_mentor_assignments ma
    WHERE ma.is_active = 1
    GROUP BY ma.faculty_staff_link_id
    `,
  );

  const countMap = new Map<number, number>();
  for (const c of counts) {
    countMap.set(Number(c.faculty_staff_link_id), Number(c.section_count));
  }

  // Ensure staff link IDs for these faculty
  const staffLinkRows = await queryAcademic<
    (RowDataPacket & { id: number; hrms_employee_id: string })[]
  >(
    `
    SELECT id, hrms_employee_id
    FROM ap_staff_link
    `,
  );
  const hrmsToStaffLinkId = new Map<string, number>();
  for (const sl of staffLinkRows) {
    hrmsToStaffLinkId.set(sl.hrms_employee_id, Number(sl.id));
  }

  return faculty.map((f) => {
    const staffLinkId = hrmsToStaffLinkId.get(f.hrmsEmployeeId) ?? null;
    return {
      ...f,
      staffLinkId,
      assignedSectionsCount: staffLinkId ? (countMap.get(staffLinkId) ?? 0) : 0,
    };
  });
}
