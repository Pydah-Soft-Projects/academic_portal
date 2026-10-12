import type { RowDataPacket } from "mysql2";
import { queryAcademic, queryStudent } from "../db/pools.js";
import type { AuthzContext } from "../authz/authorization.service.js";

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
