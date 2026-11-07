import type { RowDataPacket } from "mysql2";
import { executeAcademic, queryAcademic, queryStudent } from "../db/pools.js";
import type { AuthzContext } from "../authz/authorization.service.js";
import { hasPermission } from "../authz/authorization.service.js";
import { publishTimetablePlan } from "./timetables.service.js";
import { isCourseExcludedFromTimetable } from "./timetable-course-exclusions.service.js";
import { writeAuditLog } from "./audit.service.js";
import { mysqlDateTimeToIso } from "../lib/mysql-datetime.js";

let tableEnsured = false;
export async function ensureTimetableRequestsTable() {
  if (tableEnsured) return;
  try {
    await executeAcademic(`
      CREATE TABLE IF NOT EXISTS ap_timetable_change_requests (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        request_id BIGINT UNSIGNED NULL,
        plan_id INT NOT NULL,
        college_id INT NOT NULL,
        course_id INT NOT NULL,
        branch_id INT NOT NULL,
        batch VARCHAR(64) NULL,
        year_of_study INT NULL,
        semester_number INT NOT NULL,
        section_name VARCHAR(64) NULL,
        academic_year_label VARCHAR(64) NOT NULL,
        version_no INT NULL,
        requester_user_id BIGINT UNSIGNED NOT NULL,
        requester_role_key VARCHAR(64) NULL,
        reason TEXT NOT NULL,
        proposed_changes_summary TEXT NULL,
        status ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
        reviewed_by_user_id BIGINT UNSIGNED NULL,
        review_comment TEXT NULL,
        reviewed_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_tt_req_plan (plan_id),
        KEY idx_tt_req_scope (college_id, branch_id, status),
        KEY idx_tt_req_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    tableEnsured = true;
  } catch (err) {
    console.error("Failed to ensure ap_timetable_change_requests table:", err);
  }
}

export type TimetableChangeRequestRow = RowDataPacket & {
  id: number;
  request_id: number | null;
  plan_id: number;
  college_id: number;
  course_id: number;
  branch_id: number;
  batch: string | null;
  year_of_study: number | null;
  semester_number: number;
  section_name: string | null;
  academic_year_label: string;
  version_no: number | null;
  requester_user_id: number;
  requester_role_key: string | null;
  reason: string;
  proposed_changes_summary: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reviewed_by_user_id: number | null;
  review_comment: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  requester_name?: string | null;
  reviewer_name?: string | null;
  college_name?: string | null;
  course_name?: string | null;
  branch_name?: string | null;
};

export type TimetableSlotChange = {
  dayOfWeek: string;
  dayLabel: string;
  slotLabel: string;
  timeRange?: string;
  changeType: "modified" | "added" | "removed";
  fromSubject: string;
  toSubject: string;
  fromFaculty: string;
  toFaculty: string;
  fromRoom?: string;
  toRoom?: string;
  subjectChanged: boolean;
  facultyChanged: boolean;
};

const DAY_MAP: Record<string, string> = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
  SUN: "Sunday",
};

function formatFacultyName(name: string | null | undefined, customLabel?: string | null): string {
  if (name?.trim()) return name.trim();
  if (customLabel?.trim()) return customLabel.trim();
  return "Unassigned";
}

function formatSubjectName(code?: string | null, name?: string | null, customLabel?: string | null): string {
  const parts = [code?.trim(), name?.trim()].filter(Boolean);
  if (parts.length > 0) return parts.join(" - ");
  if (customLabel?.trim()) return customLabel.trim();
  return "Free / Unassigned";
}

export async function computeTimetablePlanDiff(
  draftPlanId: number,
  publishedPlanId?: number | null,
): Promise<TimetableSlotChange[]> {
  try {
    let prevPlanId = publishedPlanId;

    if (!prevPlanId) {
      // Find the published plan for the same scope
      const prevRows = await queryAcademic<(RowDataPacket & { id: number })[]>(
        `SELECT p_prev.id
         FROM ap_timetable_plans p_draft
         JOIN ap_timetable_plans p_prev
           ON p_prev.college_id = p_draft.college_id
          AND p_prev.course_id = p_draft.course_id
          AND p_prev.branch_id = p_draft.branch_id
          AND p_prev.semester_number = p_draft.semester_number
          AND (
            (p_prev.section_name IS NULL AND p_draft.section_name IS NULL)
            OR p_prev.section_name = p_draft.section_name
          )
          AND p_prev.status = 'published'
          AND p_prev.id <> p_draft.id
         WHERE p_draft.id = ?
         ORDER BY p_prev.id DESC
         LIMIT 1`,
        [draftPlanId],
      ).catch(() => []);
      prevPlanId = prevRows[0]?.id ?? null;
    }

    const planIdsToFetch = [draftPlanId];
    if (prevPlanId) planIdsToFetch.push(prevPlanId);

    const entries = await queryAcademic<(RowDataPacket & {
      plan_id: number;
      day_of_week: string;
      slot_id: number;
      subject_code: string | null;
      subject_name: string | null;
      custom_label: string | null;
      entry_type: string | null;
      room_label: string | null;
      batch_label: string | null;
      faculty_staff_link_id: number | null;
      faculty_name: string | null;
      slot_label: string | null;
      start_time: string | null;
      end_time: string | null;
    })[]>(
      `SELECT
        e.plan_id,
        e.day_of_week,
        COALESCE(e.timing_slot_id, e.period_slot_id) AS slot_id,
        e.subject_code,
        e.subject_name,
        e.custom_label,
        e.entry_type,
        e.room_label,
        e.batch_label,
        e.faculty_staff_link_id,
        sl.display_name AS faculty_name,
        s.label AS slot_label,
        s.start_time,
        s.end_time
       FROM ap_timetable_entries e
       LEFT JOIN ap_staff_link sl ON sl.id = e.faculty_staff_link_id
       LEFT JOIN ap_timing_template_slots s ON s.id = COALESCE(e.timing_slot_id, e.period_slot_id)
       WHERE e.plan_id IN (${planIdsToFetch.map(() => "?").join(",")})
       ORDER BY e.day_of_week, slot_id`,
      planIdsToFetch,
    ).catch(() => []);

    const prevMap = new Map<string, typeof entries[0]>();
    const draftMap = new Map<string, typeof entries[0]>();

    for (const row of entries) {
      const key = `${row.day_of_week}_${row.slot_id}_${row.batch_label || ""}`;
      if (prevPlanId && row.plan_id === prevPlanId) {
        prevMap.set(key, row);
      } else if (row.plan_id === draftPlanId) {
        draftMap.set(key, row);
      }
    }

    const allKeys = new Set([...prevMap.keys(), ...draftMap.keys()]);
    const changes: TimetableSlotChange[] = [];

    for (const key of allKeys) {
      const o = prevMap.get(key);
      const n = draftMap.get(key);

      const oSub = o ? formatSubjectName(o.subject_code, o.subject_name, o.custom_label) : "Free / Unassigned";
      const nSub = n ? formatSubjectName(n.subject_code, n.subject_name, n.custom_label) : "Free / Unassigned";
      const oFac = o ? formatFacultyName(o.faculty_name, o.custom_label) : "Unassigned";
      const nFac = n ? formatFacultyName(n.faculty_name, n.custom_label) : "Unassigned";

      const subjectChanged = oSub !== nSub;
      const facultyChanged = oFac !== nFac;

      if (subjectChanged || facultyChanged) {
        const ref = n || o;
        if (!ref) continue;

        let changeType: "modified" | "added" | "removed" = "modified";
        if (!o && n) changeType = "added";
        else if (o && !n) changeType = "removed";

        changes.push({
          dayOfWeek: ref.day_of_week,
          dayLabel: DAY_MAP[ref.day_of_week] || ref.day_of_week,
          slotLabel: ref.slot_label || `Slot ${ref.slot_id}`,
          timeRange:
            ref.start_time && ref.end_time
              ? `${ref.start_time.slice(0, 5)} - ${ref.end_time.slice(0, 5)}`
              : undefined,
          changeType,
          fromSubject: oSub,
          toSubject: nSub,
          fromFaculty: oFac,
          toFaculty: nFac,
          fromRoom: o?.room_label || undefined,
          toRoom: n?.room_label || undefined,
          subjectChanged,
          facultyChanged,
        });
      }
    }

    const DAY_ORDER: Record<string, number> = { MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6, SUN: 7 };
    changes.sort((a, b) => {
      const dDiff = (DAY_ORDER[a.dayOfWeek] || 99) - (DAY_ORDER[b.dayOfWeek] || 99);
      if (dDiff !== 0) return dDiff;
      return a.slotLabel.localeCompare(b.slotLabel, undefined, { numeric: true });
    });

    return changes;
  } catch (err) {
    console.warn("Failed to compute timetable plan diff:", err);
    return [];
  }
}

export async function listTimetableRequests(
  authz: AuthzContext,
  filters: {
    status?: string;
    collegeId?: number;
    branchId?: number;
  } = {},
) {
  await ensureTimetableRequestsTable();

  const isGlobalAdmin =
    Boolean(authz.scope?.isGlobal) ||
    authz.roleKeys.includes("super_admin");

  const collegeIds = authz.scope?.collegeIds || [];
  const branchIds = authz.scope?.branchIds || [];

  const whereClauses: string[] = ["1=1"];
  const params: unknown[] = [];

  if (filters.status && filters.status !== "all") {
    whereClauses.push("r.status = ?");
    params.push(filters.status);
  }

  if (filters.collegeId) {
    whereClauses.push("r.college_id = ?");
    params.push(filters.collegeId);
  } else if (!isGlobalAdmin && collegeIds && collegeIds.length > 0) {
    whereClauses.push(`r.college_id IN (${collegeIds.map(() => "?").join(",")})`);
    params.push(...collegeIds);
  }

  if (filters.branchId) {
    whereClauses.push("r.branch_id = ?");
    params.push(filters.branchId);
  } else if (!isGlobalAdmin && branchIds && branchIds.length > 0) {
    whereClauses.push(`r.branch_id IN (${branchIds.map(() => "?").join(",")})`);
    params.push(...branchIds);
  }

  // If HOD without approval permissions, they can see requests in their branch/department or created by themselves
  const canApprove =
    hasPermission(authz, "timetable_requests.approve") ||
    hasPermission(authz, "request.approve") ||
    authz.roleKeys.includes("principal") ||
    authz.roleKeys.includes("vice_principal") ||
    authz.roleKeys.includes("super_admin");

  const query = `
    SELECT
      r.*,
      COALESCE(u_req.name, u_req.username) AS requester_name,
      COALESCE(u_rev.name, u_rev.username) AS reviewer_name
    FROM ap_timetable_change_requests r
    LEFT JOIN ap_users u_req ON u_req.id = r.requester_user_id
    LEFT JOIN ap_users u_rev ON u_rev.id = r.reviewed_by_user_id
    WHERE ${whereClauses.join(" AND ")}
    ORDER BY r.created_at DESC
  `;

  const rows = await queryAcademic<TimetableChangeRequestRow[]>(query, params);

  // Load scope labels (college, course, branch names) from student db
  const branchIdsToFetch = [...new Set(rows.map((r) => r.branch_id).filter(Boolean))];
  const courseIdsToFetch = [...new Set(rows.map((r) => r.course_id).filter(Boolean))];
  const collegeIdsToFetch = [...new Set(rows.map((r) => r.college_id).filter(Boolean))];

  const collegeMap = new Map<number, string>();
  const courseMap = new Map<number, string>();
  const branchMap = new Map<
    number,
    { collegeName?: string; courseName?: string; branchName: string; branchCode?: string }
  >();

  if (collegeIdsToFetch.length > 0) {
    const colRows = await queryStudent<(RowDataPacket & { id: number; name: string })[]>(
      `SELECT id, name FROM colleges WHERE id IN (${collegeIdsToFetch.map(() => "?").join(",")})`,
      collegeIdsToFetch,
    ).catch(() => []);
    for (const c of colRows) collegeMap.set(Number(c.id), c.name);
  }

  if (courseIdsToFetch.length > 0) {
    const crRows = await queryStudent<(RowDataPacket & { id: number; name: string })[]>(
      `SELECT id, name FROM courses WHERE id IN (${courseIdsToFetch.map(() => "?").join(",")})`,
      courseIdsToFetch,
    ).catch(() => []);
    for (const c of crRows) courseMap.set(Number(c.id), c.name);
  }

  if (branchIdsToFetch.length > 0) {
    const brRows = await queryStudent<(RowDataPacket & {
      branch_id: number;
      branch_name: string;
      branch_code: string;
      course_id: number;
      course_name: string;
      college_id: number;
      college_name: string;
    })[]>(
      `SELECT
        cb.id AS branch_id,
        cb.name AS branch_name,
        cb.code AS branch_code,
        cb.course_id,
        c.name AS course_name,
        col.id AS college_id,
        col.name AS college_name
       FROM course_branches cb
       LEFT JOIN courses c ON c.id = cb.course_id
       LEFT JOIN colleges col ON col.id = c.college_id
       WHERE cb.id IN (${branchIdsToFetch.map(() => "?").join(",")})`,
      branchIdsToFetch,
    ).catch(() => []);
    for (const b of brRows) {
      branchMap.set(Number(b.branch_id), {
        collegeName: b.college_name,
        courseName: b.course_name,
        branchName: b.branch_name,
        branchCode: b.branch_code,
      });
      if (b.course_id && b.course_name) courseMap.set(Number(b.course_id), b.course_name);
      if (b.college_id && b.college_name) collegeMap.set(Number(b.college_id), b.college_name);
    }
  }

  const items = await Promise.all(
    rows.map(async (r) => {
      const brInfo = branchMap.get(Number(r.branch_id));
      const changes = await computeTimetablePlanDiff(Number(r.plan_id));
      return {
        id: Number(r.id),
        requestId: r.request_id ? Number(r.request_id) : null,
        planId: Number(r.plan_id),
        collegeId: Number(r.college_id),
        collegeName: brInfo?.collegeName || collegeMap.get(Number(r.college_id)) || `College #${r.college_id}`,
        courseId: Number(r.course_id),
        courseName: brInfo?.courseName || courseMap.get(Number(r.course_id)) || `Course #${r.course_id}`,
        branchId: Number(r.branch_id),
        branchName: brInfo?.branchName || `Branch #${r.branch_id}`,
        branchCode: brInfo?.branchCode || null,
        batch: r.batch || null,
        yearOfStudy: r.year_of_study != null ? Number(r.year_of_study) : null,
        semesterNumber: Number(r.semester_number),
        sectionName: r.section_name || null,
        academicYearLabel: r.academic_year_label,
        versionNo: r.version_no != null ? Number(r.version_no) : null,
        requesterUserId: Number(r.requester_user_id),
        requesterName: r.requester_name || `User #${r.requester_user_id}`,
        requesterRoleKey: r.requester_role_key || "hod",
        reason: r.reason,
        proposedChangesSummary: r.proposed_changes_summary || null,
        status: r.status,
        reviewedByUserId: r.reviewed_by_user_id ? Number(r.reviewed_by_user_id) : null,
        reviewerName: r.reviewer_name || null,
        reviewComment: r.review_comment || null,
        reviewedAt: r.reviewed_at ? mysqlDateTimeToIso(r.reviewed_at) : null,
        createdAt: mysqlDateTimeToIso(r.created_at),
        updatedAt: mysqlDateTimeToIso(r.updated_at),
        canApprove,
        changes,
      };
    }),
  );

  return items;
}

export async function createTimetableRequest(
  authz: AuthzContext,
  input: {
    planId: number;
    reason: string;
    notes?: string | null;
    proposedChangesSummary?: string | null;
  },
  ipAddress?: string,
) {
  await ensureTimetableRequestsTable();

  if (!input.planId) throw new Error("planId is required");
  if (!input.reason?.trim()) throw new Error("A reason for master timetable modification is required");

  // Load the timetable plan
  const plans = await queryAcademic<(RowDataPacket & {
    id: number;
    college_id: number;
    course_id: number;
    branch_id: number;
    batch: string | null;
    year_of_study: number | null;
    semester_number: number;
    section_name: string | null;
    academic_year_label: string;
    version_no: number | null;
    status: string;
  })[]>(
    `SELECT * FROM ap_timetable_plans WHERE id = ? LIMIT 1`,
    [input.planId],
  );

  const plan = plans[0];
  if (!plan) throw new Error("Timetable plan not found");

  if (await isCourseExcludedFromTimetable(plan.course_id)) {
    throw new Error("Cannot submit timetable modification request for a course that is excluded from timetable configuration in Settings.");
  }

  const requesterRoleKey = authz.roleKeys.includes("hod")
    ? "hod"
    : authz.roleKeys[0] || "staff";

  const changes = await computeTimetablePlanDiff(plan.id);
  const summaryText =
    input.proposedChangesSummary ||
    (changes.length > 0
      ? changes
          .map(
            (c) =>
              `${c.dayLabel} ${c.slotLabel}: ${c.facultyChanged ? `Faculty (${c.fromFaculty} → ${c.toFaculty})` : ""} ${c.subjectChanged ? `Subject (${c.fromSubject} → ${c.toSubject})` : ""}`.trim(),
          )
          .join("; ")
      : input.notes || null);

  const result = await executeAcademic(
    `INSERT INTO ap_timetable_change_requests
      (plan_id, college_id, course_id, branch_id, batch, year_of_study, semester_number,
       section_name, academic_year_label, version_no, requester_user_id, requester_role_key,
       reason, proposed_changes_summary, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      plan.id,
      plan.college_id,
      plan.course_id,
      plan.branch_id,
      plan.batch,
      plan.year_of_study,
      plan.semester_number,
      plan.section_name,
      plan.academic_year_label,
      plan.version_no,
      authz.userId,
      requesterRoleKey,
      input.reason.trim(),
      summaryText,
    ],
  );

  const requestId = Number(result.insertId);

  await writeAuditLog({
    actorUserId: authz.userId,
    action: "timetable.change_request.created",
    entityType: "ap_timetable_change_requests",
    entityId: requestId,
    newValue: {
      planId: plan.id,
      collegeId: plan.college_id,
      branchId: plan.branch_id,
      semester: plan.semester_number,
      section: plan.section_name,
      versionNo: plan.version_no,
      reason: input.reason.trim(),
    },
    ipAddress,
  });

  return {
    id: requestId,
    planId: plan.id,
    status: "pending",
    message: "Master timetable edit request submitted to the Principal successfully.",
  };
}

export async function approveTimetableRequest(
  authz: AuthzContext,
  requestId: number,
  comment?: string,
  ipAddress?: string,
) {
  await ensureTimetableRequestsTable();

  const canApprove =
    hasPermission(authz, "timetable_requests.approve") ||
    hasPermission(authz, "request.approve") ||
    authz.roleKeys.includes("principal") ||
    authz.roleKeys.includes("vice_principal") ||
    authz.roleKeys.includes("super_admin");

  if (!canApprove) {
    throw Object.assign(new Error("You do not have permission to approve timetable requests"), { status: 403 });
  }

  const rows = await queryAcademic<TimetableChangeRequestRow[]>(
    `SELECT * FROM ap_timetable_change_requests WHERE id = ? LIMIT 1`,
    [requestId],
  );
  const request = rows[0];
  if (!request) {
    throw Object.assign(new Error("Timetable request not found"), { status: 404 });
  }

  if (await isCourseExcludedFromTimetable(request.course_id)) {
    throw new Error("Cannot approve timetable request for a course that is excluded from timetable configuration in Settings.");
  }

  if (request.status !== "pending") {
    throw Object.assign(new Error(`Cannot approve request in status ${request.status}`), { status: 400 });
  }

  // 1. Update the request status
  await executeAcademic(
    `UPDATE ap_timetable_change_requests
     SET status = 'approved',
         reviewed_by_user_id = ?,
         review_comment = ?,
         reviewed_at = NOW()
     WHERE id = ?`,
    [authz.userId, comment?.trim() || null, requestId],
  );

  // 2. Publish the approved master timetable plan!
  let publishResult: unknown = null;
  try {
    publishResult = await publishTimetablePlan(request.plan_id, {
      actorUserId: authz.userId,
      ipAddress,
      force: true,
    });
  } catch (pubErr) {
    console.error("Auto-publish on request approval notice:", pubErr);
    // Even if validation had warnings, the request status is approved
  }

  await writeAuditLog({
    actorUserId: authz.userId,
    action: "timetable.change_request.approved",
    entityType: "ap_timetable_change_requests",
    entityId: requestId,
    newValue: {
      planId: request.plan_id,
      status: "approved",
      comment: comment?.trim() || null,
      publishResult,
    },
    ipAddress,
  });

  return {
    id: requestId,
    status: "approved",
    planId: request.plan_id,
    message: "Timetable change request approved and published successfully.",
    publishResult,
  };
}

export async function rejectTimetableRequest(
  authz: AuthzContext,
  requestId: number,
  comment?: string,
  ipAddress?: string,
) {
  await ensureTimetableRequestsTable();

  const canApprove =
    hasPermission(authz, "timetable_requests.approve") ||
    hasPermission(authz, "request.approve") ||
    authz.roleKeys.includes("principal") ||
    authz.roleKeys.includes("vice_principal") ||
    authz.roleKeys.includes("super_admin");

  if (!canApprove) {
    throw Object.assign(new Error("You do not have permission to reject timetable requests"), { status: 403 });
  }

  const rows = await queryAcademic<TimetableChangeRequestRow[]>(
    `SELECT * FROM ap_timetable_change_requests WHERE id = ? LIMIT 1`,
    [requestId],
  );
  const request = rows[0];
  if (!request) {
    throw Object.assign(new Error("Timetable request not found"), { status: 404 });
  }

  if (await isCourseExcludedFromTimetable(request.course_id)) {
    throw new Error("Cannot approve timetable request for a course that is excluded from timetable configuration in Settings.");
  }

  if (request.status !== "pending") {
    throw Object.assign(new Error(`Cannot reject request in status ${request.status}`), { status: 400 });
  }

  await executeAcademic(
    `UPDATE ap_timetable_change_requests
     SET status = 'rejected',
         reviewed_by_user_id = ?,
         review_comment = ?,
         reviewed_at = NOW()
     WHERE id = ?`,
    [authz.userId, comment?.trim() || null, requestId],
  );

  await writeAuditLog({
    actorUserId: authz.userId,
    action: "timetable.change_request.rejected",
    entityType: "ap_timetable_change_requests",
    entityId: requestId,
    newValue: {
      planId: request.plan_id,
      status: "rejected",
      comment: comment?.trim() || null,
    },
    ipAddress,
  });

  return {
    id: requestId,
    status: "rejected",
    planId: request.plan_id,
    message: "Timetable change request rejected.",
  };
}

