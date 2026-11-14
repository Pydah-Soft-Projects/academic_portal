import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { queryAcademic, executeAcademic, queryStudent, queryExam, executeExam } from "../db/pools.js";

export type AccessLevel = "college" | "course" | "branch" | "individual";

export type AccessRule = {
  id: number;
  accessLevel: AccessLevel;
  collegeId: number | null;
  collegeName?: string;
  courseId: number | null;
  courseName?: string;
  branchId: number | null;
  branchName?: string;
  subjectId: number | null;
  subjectName?: string;
  subjectCode?: string;
  facultyStaffLinkId: number | null;
  facultyName?: string;
  academicYearLabel: string | null;
  isEnabled: boolean;
  createdBy: number | null;
  createdByName?: string;
  createdAt: string;
};

export type HierarchySubjectItem = {
  collegeId: number;
  collegeName: string;
  courseId: number;
  courseName: string;
  branchId: number;
  branchName: string;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  subjectType: string;
  credits: number;
  semester: number | null;
  year: number | null;
  regulationId?: number | null;
  regulationCode?: string | null;
  regulationName?: string | null;
  batch?: string | null;
  assignedFaculty: Array<{
    staffLinkId: number;
    displayName: string;
    employeeCode: string | null;
    departmentName: string | null;
    hrmsEmployeeId: string | null;
    accessStatus: "enabled" | "disabled";
    accessLevel: AccessLevel | "none";
    ruleId: number | null;
  }>;
  groupAccessStatus: "enabled" | "disabled" | "mixed";
  groupAccessLevel: AccessLevel | "none";
};

export type ApprovalConfigLevel = {
  id?: number;
  levelNumber: number;
  approverRoleKey: string;
  levelLabel: string;
  isActive: boolean;
};

export type InternalMarksStatus =
  | "draft"
  | "submitted"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "returned"
  | "forwarded_to_ems"
  | "ems_sync_failed";

let schemaEnsured = false;

export async function ensureInternalMarksSchema() {
  if (schemaEnsured) return;

  await executeAcademic(`
    CREATE TABLE IF NOT EXISTS ap_internal_marks_access (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      access_level ENUM('college', 'course', 'branch', 'individual') NOT NULL,
      college_id INT NULL,
      course_id INT NULL,
      branch_id INT NULL,
      subject_id INT NULL,
      faculty_staff_link_id BIGINT UNSIGNED NULL,
      academic_year_label VARCHAR(20) NULL,
      is_enabled TINYINT(1) NOT NULL DEFAULT 1,
      created_by BIGINT UNSIGNED NULL,
      updated_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_im_access_scope (college_id, course_id, branch_id, subject_id, faculty_staff_link_id),
      KEY idx_im_access_level (access_level, is_enabled)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await executeAcademic(`
    CREATE TABLE IF NOT EXISTS ap_internal_marks_approval_configs (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      college_id INT NULL,
      course_id INT NULL,
      branch_id INT NULL,
      level_number INT NOT NULL,
      approver_role_key VARCHAR(64) NOT NULL,
      level_label VARCHAR(100) NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_im_app_config (college_id, course_id, branch_id, level_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await executeAcademic(`
    CREATE TABLE IF NOT EXISTS ap_internal_marks_submissions (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      college_id INT NOT NULL,
      course_id INT NOT NULL,
      branch_id INT NOT NULL,
      subject_id INT NOT NULL,
      academic_year_label VARCHAR(20) NOT NULL DEFAULT '2025-2026',
      semester_number TINYINT NULL,
      batch VARCHAR(32) NULL,
      section_name VARCHAR(64) NULL,
      faculty_staff_link_id BIGINT UNSIGNED NOT NULL,
      max_marks DECIMAL(5,2) NOT NULL DEFAULT 30.00,
      status ENUM('draft', 'submitted', 'pending_approval', 'approved', 'rejected', 'returned', 'forwarded_to_ems', 'ems_sync_failed') NOT NULL DEFAULT 'draft',
      current_approval_level INT NOT NULL DEFAULT 0,
      submitted_at DATETIME NULL,
      submitted_by BIGINT UNSIGNED NULL,
      ems_sync_status ENUM('not_synced', 'synced', 'failed') NOT NULL DEFAULT 'not_synced',
      ems_synced_at DATETIME NULL,
      ems_synced_by BIGINT UNSIGNED NULL,
      ems_sync_error TEXT NULL,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_im_sub_scope (college_id, course_id, branch_id, subject_id, faculty_staff_link_id),
      KEY idx_im_sub_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Ensure ENUM column and EMS columns exist on existing ap_internal_marks_submissions table
  try {
    await executeAcademic(`
      ALTER TABLE ap_internal_marks_submissions
      MODIFY COLUMN status ENUM('draft', 'submitted', 'pending_approval', 'approved', 'rejected', 'returned', 'forwarded_to_ems', 'ems_sync_failed') NOT NULL DEFAULT 'draft'
    `);
  } catch {
    /* ignore */
  }

  try {
    await executeAcademic(`
      ALTER TABLE ap_internal_marks_submissions
      ADD COLUMN ems_sync_status ENUM('not_synced', 'synced', 'failed') NOT NULL DEFAULT 'not_synced',
      ADD COLUMN ems_synced_at DATETIME NULL,
      ADD COLUMN ems_synced_by BIGINT UNSIGNED NULL,
      ADD COLUMN ems_sync_error TEXT NULL
    `);
  } catch {
    /* ignore if columns already exist */
  }

  await executeAcademic(`
    CREATE TABLE IF NOT EXISTS ap_internal_marks_entries (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      submission_id BIGINT UNSIGNED NOT NULL,
      student_db_id INT NOT NULL,
      admission_number VARCHAR(100) NOT NULL,
      roll_number VARCHAR(100) NULL,
      student_name VARCHAR(255) NULL,
      marks_obtained DECIMAL(5,2) NULL,
      max_marks DECIMAL(5,2) NOT NULL DEFAULT 30.00,
      remarks VARCHAR(255) NULL,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_im_entry_student (submission_id, student_db_id),
      CONSTRAINT fk_im_entry_sub FOREIGN KEY (submission_id) REFERENCES ap_internal_marks_submissions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await executeAcademic(`
    CREATE TABLE IF NOT EXISTS ap_internal_marks_approvals (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      submission_id BIGINT UNSIGNED NOT NULL,
      approval_level INT NOT NULL,
      approver_user_id BIGINT UNSIGNED NOT NULL,
      approver_role_key VARCHAR(64) NOT NULL,
      action ENUM('submit', 'approve', 'reject', 'return', 'revoke') NOT NULL,
      previous_status VARCHAR(50) NOT NULL,
      new_status VARCHAR(50) NOT NULL,
      comments TEXT NULL,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_im_app_sub FOREIGN KEY (submission_id) REFERENCES ap_internal_marks_submissions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await executeAcademic(`
    CREATE TABLE IF NOT EXISTS ap_internal_marks_audit_logs (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      actor_user_id BIGINT UNSIGNED NOT NULL,
      action VARCHAR(100) NOT NULL,
      entity_type VARCHAR(100) NOT NULL,
      entity_id BIGINT UNSIGNED NULL,
      college_id INT NULL,
      course_id INT NULL,
      branch_id INT NULL,
      subject_id INT NULL,
      faculty_staff_link_id BIGINT UNSIGNED NULL,
      details_json JSON NULL,
      ip_address VARCHAR(64) NULL,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_im_audit_actor (actor_user_id),
      KEY idx_im_audit_entity (entity_type, entity_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Ensure DB Permissions exist in ap_permissions & ap_role_permissions
  try {
    await executeAcademic(`
      INSERT INTO ap_permissions (permission_key, module, action, display_name, description, is_active)
      VALUES
        ('internal_marks.view', 'internal_marks', 'view', 'View Internal Marks', 'View subjects, assigned faculty, internal marks access status, and student marks.', 1),
        ('internal_marks.edit', 'internal_marks', 'edit', 'Edit Internal Marks & Upload Access', 'Modify internal marks upload access rules, enter marks, submit, and approve submissions.', 1),
        ('internal_marks_mgmt.view', 'internal_marks_mgmt', 'view', 'View Internal Marks Management', 'View subject hierarchy, internal marks access status, access rules, approval workflows, and audit logs.', 1),
        ('internal_marks_mgmt.edit', 'internal_marks_mgmt', 'edit', 'Edit Internal Marks Access & Configs', 'Configure college/course/branch/faculty upload access rules, approval workflow levels, and system settings.', 1)
      ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), description = VALUES(description), is_active = 1
    `);

    // Grant internal_marks.view and internal_marks.edit to academic & teaching staff
    await executeAcademic(`
      INSERT IGNORE INTO ap_role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM ap_roles r
      CROSS JOIN ap_permissions p
      WHERE p.permission_key IN ('internal_marks.view', 'internal_marks.edit')
        AND r.role_key IN ('super_admin', 'principal', 'vice_principal', 'hod', 'class_teacher', 'staff')
    `);

    // Grant internal_marks_mgmt.view and internal_marks_mgmt.edit to leadership / oversight roles
    await executeAcademic(`
      INSERT IGNORE INTO ap_role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM ap_roles r
      CROSS JOIN ap_permissions p
      WHERE p.permission_key IN ('internal_marks_mgmt.view', 'internal_marks_mgmt.edit')
        AND r.role_key IN ('super_admin', 'principal', 'vice_principal', 'hod')
    `);
  } catch (err) {
    console.warn("Could not seed internal_marks permissions:", err);
  }

  // Seed default approval workflow levels if missing
  try {
    const existingConfigs = await queryAcademic<RowDataPacket[]>(
      `SELECT id FROM ap_internal_marks_approval_configs LIMIT 1`
    );
    if (existingConfigs.length === 0) {
      await executeAcademic(`
        INSERT INTO ap_internal_marks_approval_configs (college_id, course_id, branch_id, level_number, approver_role_key, level_label, is_active)
        VALUES
          (NULL, NULL, NULL, 1, 'hod', 'HOD Approval', 1),
          (NULL, NULL, NULL, 2, 'principal', 'Principal Approval', 1)
      `);
    }
  } catch (err) {
    console.warn("Could not seed default approval configs:", err);
  }

  schemaEnsured = true;
}

/** Audit logger helper */
export async function logAudit(data: {
  actorUserId: number;
  action: string;
  entityType: string;
  entityId?: number | null;
  collegeId?: number | null;
  courseId?: number | null;
  branchId?: number | null;
  subjectId?: number | null;
  facultyStaffLinkId?: number | null;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
}) {
  await executeAcademic(
    `
    INSERT INTO ap_internal_marks_audit_logs
      (actor_user_id, action, entity_type, entity_id, college_id, course_id, branch_id, subject_id, faculty_staff_link_id, details_json, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      data.actorUserId,
      data.action,
      data.entityType,
      data.entityId ?? null,
      data.collegeId ?? null,
      data.courseId ?? null,
      data.branchId ?? null,
      data.subjectId ?? null,
      data.facultyStaffLinkId ?? null,
      data.details ? JSON.stringify(data.details) : null,
      data.ipAddress ?? null,
    ]
  );
}

/** Precedence resolution logic: Individual > Branch > Course > College */
export async function resolveFacultySubjectAccess(
  collegeId: number,
  courseId: number,
  branchId: number,
  subjectId: number,
  facultyStaffLinkId: number
): Promise<{
  isEnabled: boolean;
  accessLevel: AccessLevel | "none";
  ruleId: number | null;
}> {
  await ensureInternalMarksSchema();

  const rules = await queryAcademic<
    (RowDataPacket & {
      id: number;
      access_level: AccessLevel;
      is_enabled: number;
      college_id: number | null;
      course_id: number | null;
      branch_id: number | null;
      subject_id: number | null;
      faculty_staff_link_id: number | null;
    })[]
  >(
    `
    SELECT id, access_level, is_enabled, college_id, course_id, branch_id, subject_id, faculty_staff_link_id
    FROM ap_internal_marks_access
    WHERE
      (access_level = 'individual' AND subject_id = ? AND faculty_staff_link_id = ?)
      OR (access_level = 'branch' AND college_id = ? AND course_id = ? AND branch_id = ?)
      OR (access_level = 'course' AND college_id = ? AND course_id = ?)
      OR (access_level = 'college' AND college_id = ?)
    `,
    [
      subjectId,
      facultyStaffLinkId,
      collegeId,
      courseId,
      branchId,
      collegeId,
      courseId,
      collegeId,
    ]
  );

  // Level 4: Individual
  const indRule = rules.find(
    (r) =>
      r.access_level === "individual" &&
      Number(r.subject_id) === Number(subjectId) &&
      Number(r.faculty_staff_link_id) === Number(facultyStaffLinkId)
  );
  if (indRule) {
    return {
      isEnabled: Number(indRule.is_enabled) === 1,
      accessLevel: "individual",
      ruleId: Number(indRule.id),
    };
  }

  // Level 3: Branch
  const branchRule = rules.find(
    (r) =>
      r.access_level === "branch" &&
      Number(r.college_id) === Number(collegeId) &&
      Number(r.course_id) === Number(courseId) &&
      Number(r.branch_id) === Number(branchId)
  );
  if (branchRule) {
    return {
      isEnabled: Number(branchRule.is_enabled) === 1,
      accessLevel: "branch",
      ruleId: Number(branchRule.id),
    };
  }

  // Level 2: Course
  const courseRule = rules.find(
    (r) =>
      r.access_level === "course" &&
      Number(r.college_id) === Number(collegeId) &&
      Number(r.course_id) === Number(courseId)
  );
  if (courseRule) {
    return {
      isEnabled: Number(courseRule.is_enabled) === 1,
      accessLevel: "course",
      ruleId: Number(courseRule.id),
    };
  }

  // Level 1: College
  const collegeRule = rules.find(
    (r) =>
      r.access_level === "college" && Number(r.college_id) === Number(collegeId)
  );
  if (collegeRule) {
    return {
      isEnabled: Number(collegeRule.is_enabled) === 1,
      accessLevel: "college",
      ruleId: Number(collegeRule.id),
    };
  }

  return { isEnabled: false, accessLevel: "none", ruleId: null };
}

/** Superadmin & HOD Hierarchy Listing */
export async function getSubjectFacultyHierarchy(filters: {
  collegeId?: number;
  courseId?: number;
  branchId?: number;
  subjectId?: number;
  facultyId?: number;
  year?: number;
  semester?: number;
  regulationId?: number | "all" | "auto";
}): Promise<{
  data: HierarchySubjectItem[];
  activeRegulation: { id: number; code: string; name: string } | null;
  regulations: Array<{ id: number; code: string; name: string }>;
}> {
  await ensureInternalMarksSchema();

  // 1. Fetch colleges, courses, branches from student pool, and regulations from EMS pool
  const [colleges, courses, branches, regulations] = await Promise.all([
    queryStudent<(RowDataPacket & { id: number; name: string; code: string | null })[]>(
      `SELECT id, name, code FROM colleges WHERE is_active = 1 OR is_active IS NULL`
    ),
    queryStudent<(RowDataPacket & { id: number; name: string; code: string | null; college_id: number })[]>(
      `SELECT id, name, code, college_id FROM courses WHERE is_active = 1 OR is_active IS NULL`
    ),
    queryStudent<(RowDataPacket & { id: number; name: string; code: string | null; course_id: number })[]>(
      `SELECT id, name, code, course_id FROM course_branches WHERE is_active = 1 OR is_active IS NULL`
    ),
    queryExam<(RowDataPacket & { id: number; code: string; name: string })[]>(
      `SELECT id, code, name FROM regulations ORDER BY code`
    ),
  ]);

  const collegeMap = new Map(colleges.map((c) => [c.id, c]));
  const courseMap = new Map(courses.map((c) => [c.id, c]));
  const branchMap = new Map(branches.map((b) => [b.id, b]));

  // Auto-detect dominant regulation for regular enrolled students in this branch and year
  let activeRegulation: { id: number; code: string; name: string } | null = null;
  let detectedRegulationId: number | null = null;

  if (filters.branchId && filters.year) {
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
        [filters.branchId, filters.year]
      );
      const studentBatch = studentBatchRows[0]?.batch;
      if (studentBatch) {
        const regRows = await queryExam<(RowDataPacket & { regulationId: number })[]>(
          `
          SELECT sme.regulationId, COUNT(*) AS cnt
          FROM subject_mapping_entries sme
          WHERE sme.branchId = ? AND sme.batch = ? AND sme.regulationId IS NOT NULL
          GROUP BY sme.regulationId
          ORDER BY cnt DESC
          LIMIT 1
          `,
          [filters.branchId, studentBatch]
        );
        if (regRows[0]?.regulationId) {
          detectedRegulationId = Number(regRows[0].regulationId);
          const rObj = regulations.find((r) => Number(r.id) === detectedRegulationId);
          if (rObj) {
            activeRegulation = { id: Number(rObj.id), code: rObj.code, name: rObj.name };
          }
        }
      }
    } catch (err) {
      console.warn("Could not auto-detect student regulation:", err);
    }
  }

  // 2. Fetch subject curriculum mappings from exam pool
  const whereExam: string[] = ["1=1"];
  const paramsExam: unknown[] = [];

  if (filters.collegeId) {
    whereExam.push("sme.collegeId = ?");
    paramsExam.push(filters.collegeId);
  }
  if (filters.courseId) {
    whereExam.push("sme.courseId = ?");
    paramsExam.push(filters.courseId);
  }
  if (filters.branchId) {
    whereExam.push("sme.branchId = ?");
    paramsExam.push(filters.branchId);
  }
  if (filters.subjectId) {
    whereExam.push("s.id = ?");
    paramsExam.push(filters.subjectId);
  }
  if (filters.year) {
    whereExam.push("sme.yearOfStudy = ?");
    paramsExam.push(filters.year);
  }
  if (filters.semester) {
    whereExam.push("sme.semester = ?");
    paramsExam.push(filters.semester);
  }

  // Determine effective regulation filter
  let effectiveRegulationId: number | null = null;
  if (typeof filters.regulationId === "number" && Number.isFinite(filters.regulationId)) {
    effectiveRegulationId = filters.regulationId;
  } else if (filters.regulationId === "all") {
    effectiveRegulationId = null; // show all regulations
  } else if (detectedRegulationId) {
    // Default to the students' active regulation
    effectiveRegulationId = detectedRegulationId;
  }

  if (effectiveRegulationId != null) {
    whereExam.push("sme.regulationId = ?");
    paramsExam.push(effectiveRegulationId);
  }

  const examSubjects = await queryExam<
    (RowDataPacket & {
      collegeId: number;
      collegeName: string | null;
      courseId: number;
      courseName: string | null;
      branchId: number;
      branchName: string | null;
      subjectId: number;
      code: string;
      name: string;
      type: string;
      credits: number | null;
      yearOfStudy: number | null;
      semester: number | null;
      regulationId: number | null;
      regulationCode: string | null;
      regulationName: string | null;
      batch: string | null;
    })[]
  >(
    `
    SELECT
      sme.collegeId,
      MAX(sme.collegeName) AS collegeName,
      sme.courseId,
      MAX(sme.courseName) AS courseName,
      sme.branchId,
      MAX(sme.branchName) AS branchName,
      s.id AS subjectId,
      s.code,
      s.name,
      s.type,
      MAX(s.credits) AS credits,
      MAX(sme.yearOfStudy) AS yearOfStudy,
      MAX(sme.semester) AS semester,
      MAX(sme.regulationId) AS regulationId,
      MAX(r.code) AS regulationCode,
      MAX(r.name) AS regulationName,
      MAX(sme.batch) AS batch
    FROM subject_mapping_entries sme
    INNER JOIN subjects s ON s.id = sme.subjectId
    LEFT JOIN regulations r ON r.id = sme.regulationId
    WHERE ${whereExam.join(" AND ")}
    GROUP BY
      sme.collegeId,
      sme.courseId,
      sme.branchId,
      s.id,
      s.code,
      s.name,
      s.type
    ORDER BY collegeName, courseName, branchName, yearOfStudy, semester, s.code
    `,
    paramsExam
  );

  // 3. Fetch faculty assignments from academic pool
  const facultyAssignments = await queryAcademic<
    (RowDataPacket & {
      subject_id: number;
      branch_id: number;
      faculty_staff_link_id: number;
      display_name: string;
      employee_code: string | null;
      department_name: string | null;
      hrms_employee_id: string | null;
    })[]
  >(
    `
    SELECT DISTINCT
      fa.subject_id,
      fa.branch_id,
      fa.faculty_staff_link_id,
      sl.display_name,
      sl.employee_code,
      sl.department_name,
      sl.hrms_employee_id
    FROM ap_faculty_assignments fa
    INNER JOIN ap_staff_link sl ON sl.id = fa.faculty_staff_link_id
    UNION
    SELECT DISTINCT
      te.subject_id,
      tp.branch_id,
      te.faculty_staff_link_id,
      sl.display_name,
      sl.employee_code,
      sl.department_name,
      sl.hrms_employee_id
    FROM ap_timetable_entries te
    INNER JOIN ap_timetable_plans tp ON tp.id = te.plan_id
    INNER JOIN ap_staff_link sl ON sl.id = te.faculty_staff_link_id
    WHERE te.subject_id IS NOT NULL AND te.faculty_staff_link_id IS NOT NULL
    `
  );

  // 4. Fetch all active access rules to bulk resolve in memory
  const allRules = await queryAcademic<
    (RowDataPacket & {
      id: number;
      access_level: AccessLevel;
      is_enabled: number;
      college_id: number | null;
      course_id: number | null;
      branch_id: number | null;
      subject_id: number | null;
      faculty_staff_link_id: number | null;
    })[]
  >(`SELECT id, access_level, is_enabled, college_id, course_id, branch_id, subject_id, faculty_staff_link_id FROM ap_internal_marks_access`);

  const resolveAccessLocal = (
    cId: number,
    crId: number,
    bId: number,
    sId: number,
    fId: number
  ) => {
    // Individual
    const ind = allRules.find(
      (r) =>
        r.access_level === "individual" &&
        Number(r.subject_id) === sId &&
        Number(r.faculty_staff_link_id) === fId
    );
    if (ind) {
      return {
        isEnabled: Number(ind.is_enabled) === 1,
        accessLevel: "individual" as AccessLevel,
        ruleId: Number(ind.id),
      };
    }
    // Branch
    const br = allRules.find(
      (r) =>
        r.access_level === "branch" &&
        Number(r.college_id) === cId &&
        Number(r.course_id) === crId &&
        Number(r.branch_id) === bId
    );
    if (br) {
      return {
        isEnabled: Number(br.is_enabled) === 1,
        accessLevel: "branch" as AccessLevel,
        ruleId: Number(br.id),
      };
    }
    // Course
    const crs = allRules.find(
      (r) =>
        r.access_level === "course" &&
        Number(r.college_id) === cId &&
        Number(r.course_id) === crId
    );
    if (crs) {
      return {
        isEnabled: Number(crs.is_enabled) === 1,
        accessLevel: "course" as AccessLevel,
        ruleId: Number(crs.id),
      };
    }
    // College
    const clg = allRules.find(
      (r) =>
        r.access_level === "college" && Number(r.college_id) === cId
    );
    if (clg) {
      return {
        isEnabled: Number(clg.is_enabled) === 1,
        accessLevel: "college" as AccessLevel,
        ruleId: Number(clg.id),
      };
    }

    return { isEnabled: false, accessLevel: "none" as const, ruleId: null };
  };

  const seenSubjectKeys = new Set<string>();
  const results: HierarchySubjectItem[] = [];

  for (const item of examSubjects) {
    const itemKey = `${item.collegeId}-${item.courseId}-${item.branchId}-${item.subjectId}`;
    if (seenSubjectKeys.has(itemKey)) continue;
    seenSubjectKeys.add(itemKey);
    const cObj = collegeMap.get(item.collegeId);
    const crObj = courseMap.get(item.courseId);
    const bObj = branchMap.get(item.branchId);

    const cName = cObj ? cObj.name : item.collegeName || "College";
    const crName = crObj ? crObj.name : item.courseName || "Course";
    const bName = bObj ? bObj.name : item.branchName || "Branch";

    // Find assigned faculty for this subject and branch
    let assigned = facultyAssignments.filter(
      (fa) =>
        Number(fa.subject_id) === Number(item.subjectId) &&
        Number(fa.branch_id) === Number(item.branchId)
    );

    if (filters.facultyId) {
      assigned = assigned.filter(
        (fa) => Number(fa.faculty_staff_link_id) === Number(filters.facultyId)
      );
      if (assigned.length === 0) continue;
    }

    const assignedMapped = assigned.map((fa) => {
      const fId = Number(fa.faculty_staff_link_id);
      const acc = resolveAccessLocal(
        item.collegeId,
        item.courseId,
        item.branchId,
        item.subjectId,
        fId
      );
      return {
        staffLinkId: fId,
        displayName: fa.display_name,
        employeeCode: fa.employee_code,
        departmentName: fa.department_name,
        hrmsEmployeeId: fa.hrms_employee_id,
        accessStatus: acc.isEnabled ? ("enabled" as const) : ("disabled" as const),
        accessLevel: acc.accessLevel,
        ruleId: acc.ruleId,
      };
    });

    let groupStatus: "enabled" | "disabled" | "mixed" = "disabled";
    let groupLevel: AccessLevel | "none" = "none";

    if (assignedMapped.length > 0) {
      const allEnabled = assignedMapped.every((a) => a.accessStatus === "enabled");
      const anyEnabled = assignedMapped.some((a) => a.accessStatus === "enabled");

      if (allEnabled) {
        groupStatus = "enabled";
        groupLevel = assignedMapped[0].accessLevel;
      } else if (anyEnabled) {
        groupStatus = "mixed";
        groupLevel = "individual";
      } else {
        groupStatus = "disabled";
        groupLevel = assignedMapped[0]?.accessLevel ?? "none";
      }
    } else {
      // Check branch/course/college access even if no faculty assigned yet
      const defaultAcc = resolveAccessLocal(
        item.collegeId,
        item.courseId,
        item.branchId,
        item.subjectId,
        0
      );
      groupStatus = defaultAcc.isEnabled ? "enabled" : "disabled";
      groupLevel = defaultAcc.accessLevel;
    }

    results.push({
      collegeId: item.collegeId,
      collegeName: cName,
      courseId: item.courseId,
      courseName: crName,
      branchId: item.branchId,
      branchName: bName,
      subjectId: item.subjectId,
      subjectCode: item.code,
      subjectName: item.name,
      subjectType: item.type,
      credits: Number(item.credits ?? 0),
      semester: item.semester,
      year: item.yearOfStudy,
      regulationId: item.regulationId != null ? Number(item.regulationId) : null,
      regulationCode: item.regulationCode || null,
      regulationName: item.regulationName || null,
      batch: item.batch || null,
      assignedFaculty: assignedMapped,
      groupAccessStatus: groupStatus,
      groupAccessLevel: groupLevel,
    });
  }

  return {
    data: results,
    activeRegulation,
    regulations: regulations.map((r) => ({ id: Number(r.id), code: r.code, name: r.name })),
  };
}

/** Access Rules Management */
export async function listAccessRules(filters?: {
  collegeId?: number;
  courseId?: number;
  branchId?: number;
  activeOnly?: boolean;
}): Promise<AccessRule[]> {
  await ensureInternalMarksSchema();

  const where: string[] = ["1=1"];
  const params: unknown[] = [];

  if (filters?.activeOnly !== false) {
    where.push("a.is_enabled = 1");
  }

  if (filters?.collegeId) {
    where.push("a.college_id = ?");
    params.push(filters.collegeId);
  }
  if (filters?.courseId) {
    where.push("a.course_id = ?");
    params.push(filters.courseId);
  }
  if (filters?.branchId) {
    where.push("a.branch_id = ?");
    params.push(filters.branchId);
  }

  const rows = await queryAcademic<
    (RowDataPacket & {
      id: number;
      access_level: AccessLevel;
      college_id: number | null;
      course_id: number | null;
      branch_id: number | null;
      subject_id: number | null;
      faculty_staff_link_id: number | null;
      academic_year_label: string | null;
      is_enabled: number;
      created_by: number | null;
      created_at: string;
      creator_name: string | null;
      staff_name: string | null;
    })[]
  >(
    `
    SELECT
      a.id,
      a.access_level,
      a.college_id,
      a.course_id,
      a.branch_id,
      a.subject_id,
      a.faculty_staff_link_id,
      a.academic_year_label,
      a.is_enabled,
      a.created_by,
      a.created_at,
      u.name AS creator_name,
      sl.display_name AS staff_name
    FROM ap_internal_marks_access a
    LEFT JOIN ap_users u ON u.id = a.created_by
    LEFT JOIN ap_staff_link sl ON sl.id = a.faculty_staff_link_id
    WHERE ${where.join(" AND ")}
    ORDER BY a.id DESC
    `,
    params
  );

  const collegeIds = [...new Set(rows.map((r) => r.college_id).filter((id): id is number => id != null))];
  const courseIds = [...new Set(rows.map((r) => r.course_id).filter((id): id is number => id != null))];
  const branchIds = [...new Set(rows.map((r) => r.branch_id).filter((id): id is number => id != null))];
  const subjectIds = [...new Set(rows.map((r) => r.subject_id).filter((id): id is number => id != null))];

  const [colleges, courses, branches, subjects] = await Promise.all([
    collegeIds.length > 0
      ? queryStudent<(RowDataPacket & { id: number; name: string })[]>(
          `SELECT id, name FROM colleges WHERE id IN (${collegeIds.map(() => "?").join(",")})`,
          collegeIds
        )
      : [],
    courseIds.length > 0
      ? queryStudent<(RowDataPacket & { id: number; name: string })[]>(
          `SELECT id, name FROM courses WHERE id IN (${courseIds.map(() => "?").join(",")})`,
          courseIds
        )
      : [],
    branchIds.length > 0
      ? queryStudent<(RowDataPacket & { id: number; name: string })[]>(
          `SELECT id, name FROM course_branches WHERE id IN (${branchIds.map(() => "?").join(",")})`,
          branchIds
        )
      : [],
    subjectIds.length > 0
      ? queryExam<(RowDataPacket & { id: number; name: string; code: string })[]>(
          `SELECT id, name, code FROM subjects WHERE id IN (${subjectIds.map(() => "?").join(",")})`,
          subjectIds
        )
      : [],
  ]);

  const collegeMap = new Map(colleges.map((c) => [c.id, c.name]));
  const courseMap = new Map(courses.map((cr) => [cr.id, cr.name]));
  const branchMap = new Map(branches.map((b) => [b.id, b.name]));
  const subjectMap = new Map(subjects.map((s) => [s.id, { name: s.name, code: s.code }]));

  return rows.map((r) => {
    const sMeta = r.subject_id ? subjectMap.get(r.subject_id) : undefined;
    return {
      id: Number(r.id),
      accessLevel: r.access_level,
      collegeId: r.college_id ? Number(r.college_id) : null,
      courseId: r.course_id ? Number(r.course_id) : null,
      branchId: r.branch_id ? Number(r.branch_id) : null,
      subjectId: r.subject_id ? Number(r.subject_id) : null,
      facultyStaffLinkId: r.faculty_staff_link_id ? Number(r.faculty_staff_link_id) : null,
      facultyName: r.staff_name || undefined,
      collegeName: r.college_id ? collegeMap.get(r.college_id) : undefined,
      courseName: r.course_id ? courseMap.get(r.course_id) : undefined,
      branchName: r.branch_id ? branchMap.get(r.branch_id) : undefined,
      subjectName: sMeta?.name,
      subjectCode: sMeta?.code,
      academicYearLabel: r.academic_year_label,
      isEnabled: Number(r.is_enabled) === 1,
      createdBy: r.created_by ? Number(r.created_by) : null,
      createdByName: r.creator_name || undefined,
      createdAt: String(r.created_at),
    };
  });
}

export async function saveAccessRule(
  actorUserId: number,
  data: {
    accessLevel: AccessLevel;
    collegeId?: number | null;
    courseId?: number | null;
    branchId?: number | null;
    subjectId?: number | null;
    facultyStaffLinkId?: number | null;
    academicYearLabel?: string;
    isEnabled: boolean;
  }
) {
  await ensureInternalMarksSchema();

  const isEnabledVal = data.isEnabled ? 1 : 0;

  // Delete existing conflicting rule for exact same scope if exists
  if (data.accessLevel === "individual") {
    await executeAcademic(
      `
      DELETE FROM ap_internal_marks_access
      WHERE access_level = 'individual'
        AND subject_id = ?
        AND faculty_staff_link_id = ?
      `,
      [data.subjectId ?? 0, data.facultyStaffLinkId ?? 0]
    );
  } else {
    await executeAcademic(
      `
      DELETE FROM ap_internal_marks_access
      WHERE access_level = ?
        AND COALESCE(college_id, 0) = COALESCE(?, 0)
        AND COALESCE(course_id, 0) = COALESCE(?, 0)
        AND COALESCE(branch_id, 0) = COALESCE(?, 0)
        AND COALESCE(subject_id, 0) = COALESCE(?, 0)
        AND COALESCE(faculty_staff_link_id, 0) = COALESCE(?, 0)
      `,
      [
        data.accessLevel,
        data.collegeId ?? 0,
        data.courseId ?? 0,
        data.branchId ?? 0,
        data.subjectId ?? 0,
        data.facultyStaffLinkId ?? 0,
      ]
    );
  }

  const result = await executeAcademic(
    `
    INSERT INTO ap_internal_marks_access
      (access_level, college_id, course_id, branch_id, subject_id, faculty_staff_link_id, academic_year_label, is_enabled, created_by, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      data.accessLevel,
      data.collegeId ?? null,
      data.courseId ?? null,
      data.branchId ?? null,
      data.subjectId ?? null,
      data.facultyStaffLinkId ?? null,
      data.academicYearLabel ?? "2025-2026",
      isEnabledVal,
      actorUserId,
      actorUserId,
    ]
  );

  await logAudit({
    actorUserId,
    action: data.isEnabled ? "access_granted" : "access_revoked",
    entityType: "access_rule",
    entityId: result.insertId,
    collegeId: data.collegeId,
    courseId: data.courseId,
    branchId: data.branchId,
    subjectId: data.subjectId,
    facultyStaffLinkId: data.facultyStaffLinkId,
    details: { accessLevel: data.accessLevel, isEnabled: data.isEnabled },
  });

  return { id: result.insertId, success: true };
}

export async function deleteAccessRule(actorUserId: number, ruleId: number) {
  await ensureInternalMarksSchema();

  const rules = await queryAcademic<RowDataPacket[]>(
    `SELECT * FROM ap_internal_marks_access WHERE id = ? LIMIT 1`,
    [ruleId]
  );
  const rule = rules[0];
  if (!rule) return { success: false, message: "Rule not found" };

  await executeAcademic(`DELETE FROM ap_internal_marks_access WHERE id = ?`, [
    ruleId,
  ]);

  await logAudit({
    actorUserId,
    action: "access_rule_deleted",
    entityType: "access_rule",
    entityId: ruleId,
    collegeId: rule.college_id,
    courseId: rule.course_id,
    branchId: rule.branch_id,
    subjectId: rule.subject_id,
    facultyStaffLinkId: rule.faculty_staff_link_id,
    details: { accessLevel: rule.access_level, isEnabled: rule.is_enabled },
  });

  return { success: true };
}

/** Faculty Side: Get assigned subjects for faculty with upload & submission status */
export async function getFacultyAssignedSubjects(
  userId: number,
  hrmsEmployeeId: string | null
) {
  await ensureInternalMarksSchema();

  // Resolve faculty_staff_link_id
  let staffLinkId: number | null = null;
  if (hrmsEmployeeId) {
    const staffRows = await queryAcademic<(RowDataPacket & { id: number })[]>(
      `SELECT id FROM ap_staff_link WHERE hrms_employee_id = ? LIMIT 1`,
      [hrmsEmployeeId]
    );
    if (staffRows[0]) staffLinkId = Number(staffRows[0].id);
  }

  if (!staffLinkId) {
    // Try user email or username match in ap_users -> ap_staff_link
    const uRows = await queryAcademic<(RowDataPacket & { hrms_employee_id: string | null })[]>(
      `SELECT hrms_employee_id FROM ap_users WHERE id = ? LIMIT 1`,
      [userId]
    );
    const empId = uRows[0]?.hrms_employee_id;
    if (empId) {
      const staffRows = await queryAcademic<(RowDataPacket & { id: number })[]>(
        `SELECT id FROM ap_staff_link WHERE hrms_employee_id = ? LIMIT 1`,
        [empId]
      );
      if (staffRows[0]) staffLinkId = Number(staffRows[0].id);
    }
  }

  if (!staffLinkId) {
    return { staffLinkId: null, subjects: [] };
  }

  // Get subjects assigned to this staff member
  const assignments = await queryAcademic<
    (RowDataPacket & {
      subject_id: number;
      branch_id: number;
    })[]
  >(
    `
    SELECT DISTINCT subject_id, branch_id
    FROM ap_faculty_assignments
    WHERE faculty_staff_link_id = ?
    UNION
    SELECT DISTINCT te.subject_id, tp.branch_id
    FROM ap_timetable_entries te
    INNER JOIN ap_timetable_plans tp ON tp.id = te.plan_id
    WHERE te.faculty_staff_link_id = ? AND te.subject_id IS NOT NULL
    `,
    [staffLinkId, staffLinkId]
  );

  if (assignments.length === 0) {
    return { staffLinkId, subjects: [] };
  }

  // Fetch subject details from exam database
  const subjectIds = [...new Set(assignments.map((a) => Number(a.subject_id)))];
  const placeholders = subjectIds.map(() => "?").join(",");

  const examSubjects = await queryExam<
    (RowDataPacket & {
      subjectId: number;
      code: string;
      name: string;
      type: string;
      collegeId: number;
      collegeName: string | null;
      courseId: number;
      courseName: string | null;
      branchId: number;
      branchName: string | null;
      semester: number | null;
      yearOfStudy: number | null;
      batch: string | null;
    })[]
  >(
    `
    SELECT
      sme.subjectId,
      s.code,
      s.name,
      s.type,
      sme.collegeId,
      sme.collegeName,
      sme.courseId,
      sme.courseName,
      sme.branchId,
      sme.branchName,
      sme.semester,
      sme.yearOfStudy,
      sme.batch
    FROM subject_mapping_entries sme
    INNER JOIN subjects s ON s.id = sme.subjectId
    WHERE sme.subjectId IN (${placeholders})
    `,
    subjectIds
  );

  // Fetch existing submissions for this faculty
  const submissions = await queryAcademic<
    (RowDataPacket & {
      id: number;
      subject_id: number;
      branch_id: number;
      status: InternalMarksStatus;
      current_approval_level: number;
      max_marks: number;
      updated_at: string;
    })[]
  >(
    `
    SELECT id, subject_id, branch_id, status, current_approval_level, max_marks, updated_at
    FROM ap_internal_marks_submissions
    WHERE faculty_staff_link_id = ?
    `,
    [staffLinkId]
  );

  const results = [];
  const assignedPairs = new Set(
    assignments.map((a) => `${a.subject_id}-${a.branch_id}`)
  );

  for (const item of examSubjects) {
    if (!assignedPairs.has(`${item.subjectId}-${item.branchId}`)) {
      continue;
    }

    const acc = await resolveFacultySubjectAccess(
      item.collegeId,
      item.courseId,
      item.branchId,
      item.subjectId,
      staffLinkId
    );

    const sub = submissions.find(
      (s) =>
        Number(s.subject_id) === Number(item.subjectId) &&
        Number(s.branch_id) === Number(item.branchId)
    );

    results.push({
      collegeId: item.collegeId,
      collegeName: item.collegeName || "College",
      courseId: item.courseId,
      courseName: item.courseName || "Course",
      branchId: item.branchId,
      branchName: item.branchName || "Branch",
      subjectId: item.subjectId,
      subjectCode: item.code,
      subjectName: item.name,
      subjectType: item.type,
      semester: item.semester,
      year: item.yearOfStudy,
      batch: item.batch || "",
      accessStatus: acc.isEnabled ? ("enabled" as const) : ("disabled" as const),
      accessLevel: acc.accessLevel,
      submissionId: sub ? Number(sub.id) : null,
      submissionStatus: sub ? sub.status : ("draft" as const),
      currentApprovalLevel: sub ? Number(sub.current_approval_level) : 0,
      maxMarks: sub ? Number(sub.max_marks) : 30,
      lastUpdated: sub ? String(sub.updated_at) : null,
    });
  }

  return { staffLinkId, subjects: results };
}

/** Fetch students and existing internal marks for entry */
export async function getStudentsForMarksEntry(params: {
  collegeId: number;
  courseId: number;
  branchId: number;
  subjectId: number;
  facultyStaffLinkId: number;
  year?: number;
  semester?: number;
  batch?: string;
}) {
  await ensureInternalMarksSchema();

  // 1. Check access rule
  const acc = await resolveFacultySubjectAccess(
    params.collegeId,
    params.courseId,
    params.branchId,
    params.subjectId,
    params.facultyStaffLinkId
  );

  // 2. Fetch subject info
  const subRows = await queryExam<
    (RowDataPacket & { code: string; name: string })[]
  >(`SELECT code, name FROM subjects WHERE id = ? LIMIT 1`, [
    params.subjectId,
  ]);
  const subjectMeta = subRows[0] || { code: "", name: "Subject" };

  // 3. Check existing submission
  const subRowsDb = await queryAcademic<
    (RowDataPacket & {
      id: number;
      status: InternalMarksStatus;
      max_marks: number;
      current_approval_level: number;
    })[]
  >(
    `
    SELECT id, status, max_marks, current_approval_level
    FROM ap_internal_marks_submissions
    WHERE college_id = ? AND course_id = ? AND branch_id = ? AND subject_id = ? AND faculty_staff_link_id = ?
    LIMIT 1
    `,
    [
      params.collegeId,
      params.courseId,
      params.branchId,
      params.subjectId,
      params.facultyStaffLinkId,
    ]
  );

  let submissionId: number | null = subRowsDb[0] ? Number(subRowsDb[0].id) : null;
  let status: InternalMarksStatus = subRowsDb[0] ? subRowsDb[0].status : "draft";
  let maxMarks = subRowsDb[0] ? Number(subRowsDb[0].max_marks) : 30;

  // 4. Fetch existing entries if submission exists
  let existingEntries = new Map<number, { marks: number | null; remarks: string | null }>();
  if (submissionId) {
    const entryRows = await queryAcademic<
      (RowDataPacket & { student_db_id: number; marks_obtained: number | null; remarks: string | null })[]
    >(
      `SELECT student_db_id, marks_obtained, remarks FROM ap_internal_marks_entries WHERE submission_id = ?`,
      [submissionId]
    );
    for (const er of entryRows) {
      existingEntries.set(Number(er.student_db_id), {
        marks: er.marks_obtained != null ? Number(er.marks_obtained) : null,
        remarks: er.remarks || null,
      });
    }
  }

  // Resolve target year, semester, batch from subject mapping if not explicitly passed
  let targetYear = params.year;
  let targetSemester = params.semester;
  let targetBatch = params.batch;

  if (!targetYear || !targetSemester) {
    const smeRows = await queryExam<
      (RowDataPacket & { yearOfStudy: number | null; semester: number | null; batch: string | null })[]
    >(
      `SELECT yearOfStudy, semester, batch FROM subject_mapping_entries WHERE collegeId = ? AND courseId = ? AND branchId = ? AND subjectId = ? LIMIT 1`,
      [params.collegeId, params.courseId, params.branchId, params.subjectId]
    );
    if (smeRows[0]) {
      if (!targetYear) targetYear = smeRows[0].yearOfStudy ?? undefined;
      if (!targetSemester) targetSemester = smeRows[0].semester ?? undefined;
      if (!targetBatch) targetBatch = smeRows[0].batch ?? undefined;
    }
  }

  // 5. Query students from student database
  const whereStud: string[] = ["s.college_id = ?", "s.course_id = ?", "s.branch_id = ?"];
  const paramsStud: unknown[] = [params.collegeId, params.courseId, params.branchId];

  if (targetYear) {
    whereStud.push("s.current_year = ?");
    paramsStud.push(targetYear);
  }
  if (targetSemester) {
    whereStud.push("s.current_semester = ?");
    paramsStud.push(targetSemester);
  }
  if (targetBatch) {
    whereStud.push("TRIM(s.batch) = ?");
    paramsStud.push(targetBatch.trim());
  }

  let studentRows = await queryStudent<
    (RowDataPacket & {
      id: number;
      admission_number: string;
      pin_no: string | null;
      student_name: string | null;
      section_name: string | null;
    })[]
  >(
    `
    SELECT
      s.id,
      s.admission_number,
      s.pin_no,
      s.student_name,
      COALESCE(ss.section_name COLLATE utf8mb4_unicode_ci, s.section COLLATE utf8mb4_unicode_ci) AS section_name
    FROM students s
    LEFT JOIN student_sections ss ON ss.student_id = s.id
    WHERE ${whereStud.join(" AND ")}
    ORDER BY COALESCE(s.pin_no, s.admission_number) ASC
    LIMIT 500
    `,
    paramsStud
  );

  // Fallback: if no students found with strict year/sem/batch, search by college + course + branch
  if (studentRows.length === 0 && (targetYear || targetSemester || targetBatch)) {
    studentRows = await queryStudent<
      (RowDataPacket & {
        id: number;
        admission_number: string;
        pin_no: string | null;
        student_name: string | null;
        section_name: string | null;
      })[]
    >(
      `
      SELECT
        s.id,
        s.admission_number,
        s.pin_no,
        s.student_name,
        COALESCE(ss.section_name COLLATE utf8mb4_unicode_ci, s.section COLLATE utf8mb4_unicode_ci) AS section_name
      FROM students s
      LEFT JOIN student_sections ss ON ss.student_id = s.id
      WHERE s.college_id = ? AND s.course_id = ? AND s.branch_id = ?
      ORDER BY COALESCE(s.pin_no, s.admission_number) ASC
      LIMIT 500
      `,
      [params.collegeId, params.courseId, params.branchId]
    );
  }

  const studentList = studentRows.map((st) => {
    const prev = existingEntries.get(st.id);
    return {
      studentDbId: st.id,
      admissionNumber: st.admission_number,
      rollNumber: st.pin_no || st.admission_number,
      studentName: st.student_name || "Student",
      sectionName: st.section_name || "",
      marksObtained: prev ? prev.marks : null,
      remarks: prev ? prev.remarks : "",
    };
  });

  return {
    subjectId: params.subjectId,
    subjectCode: subjectMeta.code,
    subjectName: subjectMeta.name,
    collegeId: params.collegeId,
    courseId: params.courseId,
    branchId: params.branchId,
    facultyStaffLinkId: params.facultyStaffLinkId,
    uploadAccess: acc.isEnabled,
    accessLevel: acc.accessLevel,
    submissionId,
    status,
    maxMarks,
    students: studentList,
  };
}

/** Save Marks Draft */
export async function saveMarksDraft(
  actorUserId: number,
  data: {
    collegeId: number;
    courseId: number;
    branchId: number;
    subjectId: number;
    facultyStaffLinkId: number;
    academicYearLabel?: string;
    semesterNumber?: number;
    batch?: string;
    maxMarks: number;
    entries: Array<{
      studentDbId: number;
      admissionNumber: string;
      rollNumber?: string;
      studentName?: string;
      marksObtained: number | null;
      remarks?: string;
    }>;
  }
) {
  await ensureInternalMarksSchema();

  // Verify internal marks posting upload access permission
  const access = await resolveFacultySubjectAccess(
    data.collegeId,
    data.courseId,
    data.branchId,
    data.subjectId,
    data.facultyStaffLinkId
  );
  if (!access.isEnabled) {
    throw Object.assign(
      new Error("Internal marks posting is currently disabled/locked for this subject. Please contact your HOD or Examination Administrator."),
      { status: 403 }
    );
  }

  // 1. Ensure submission record exists
  const existingSub = await queryAcademic<
    (RowDataPacket & { id: number; status: InternalMarksStatus })[]
  >(
    `
    SELECT id, status FROM ap_internal_marks_submissions
    WHERE college_id = ? AND course_id = ? AND branch_id = ? AND subject_id = ? AND faculty_staff_link_id = ?
    LIMIT 1
    `,
    [
      data.collegeId,
      data.courseId,
      data.branchId,
      data.subjectId,
      data.facultyStaffLinkId,
    ]
  );

  let submissionId: number;
  let currentStatus: InternalMarksStatus = "draft";

  if (existingSub[0]) {
    submissionId = Number(existingSub[0].id);
    currentStatus = existingSub[0].status;
    if (currentStatus === "approved") {
      throw Object.assign(new Error("Cannot modify marks after approval"), { status: 400 });
    }
    await executeAcademic(
      `UPDATE ap_internal_marks_submissions SET max_marks = ?, updated_at = NOW() WHERE id = ?`,
      [data.maxMarks, submissionId]
    );
  } else {
    const res = await executeAcademic(
      `
      INSERT INTO ap_internal_marks_submissions
        (college_id, course_id, branch_id, subject_id, faculty_staff_link_id, academic_year_label, semester_number, batch, max_marks, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
      `,
      [
        data.collegeId,
        data.courseId,
        data.branchId,
        data.subjectId,
        data.facultyStaffLinkId,
        data.academicYearLabel ?? "2025-2026",
        data.semesterNumber ?? null,
        data.batch ?? null,
        data.maxMarks,
      ]
    );
    submissionId = res.insertId;
  }

  // 2. Upsert entries
  for (const entry of data.entries) {
    const marks = entry.marksObtained != null && Number.isFinite(Number(entry.marksObtained))
      ? Math.max(0, Math.min(data.maxMarks, Number(entry.marksObtained)))
      : null;

    await executeAcademic(
      `
      INSERT INTO ap_internal_marks_entries
        (submission_id, student_db_id, admission_number, roll_number, student_name, marks_obtained, max_marks, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        marks_obtained = VALUES(marks_obtained),
        max_marks = VALUES(max_marks),
        remarks = VALUES(remarks),
        updated_at = NOW()
      `,
      [
        submissionId,
        entry.studentDbId,
        entry.admissionNumber,
        entry.rollNumber ?? entry.admissionNumber,
        entry.studentName ?? "",
        marks,
        data.maxMarks,
        entry.remarks ?? null,
      ]
    );
  }

  await logAudit({
    actorUserId,
    action: "marks_draft_saved",
    entityType: "submission",
    entityId: submissionId,
    collegeId: data.collegeId,
    courseId: data.courseId,
    branchId: data.branchId,
    subjectId: data.subjectId,
    facultyStaffLinkId: data.facultyStaffLinkId,
    details: { entryCount: data.entries.length, maxMarks: data.maxMarks },
  });

  return { submissionId, status: currentStatus, success: true };
}

/** Submit Marks for Approval */
export async function submitMarksForApproval(
  actorUserId: number,
  data: {
    submissionId: number;
    comments?: string;
  }
) {
  await ensureInternalMarksSchema();

  const subs = await queryAcademic<
    (RowDataPacket & {
      id: number;
      college_id: number;
      course_id: number;
      branch_id: number;
      subject_id: number;
      faculty_staff_link_id: number;
      status: InternalMarksStatus;
    })[]
  >(`SELECT * FROM ap_internal_marks_submissions WHERE id = ? LIMIT 1`, [
    data.submissionId,
  ]);

  const sub = subs[0];
  if (!sub) throw Object.assign(new Error("Submission not found"), { status: 404 });

  if (sub.status === "approved") {
    throw Object.assign(new Error("Submission is already approved"), { status: 400 });
  }

  // Verify internal marks posting upload access permission
  const access = await resolveFacultySubjectAccess(
    sub.college_id,
    sub.course_id,
    sub.branch_id,
    sub.subject_id,
    sub.faculty_staff_link_id
  );
  if (!access.isEnabled) {
    throw Object.assign(
      new Error("Internal marks posting is currently disabled/locked for this subject. Please contact your HOD or Examination Administrator."),
      { status: 403 }
    );
  }

  // Validate that entries exist
  const entries = await queryAcademic<RowDataPacket[]>(
    `SELECT id FROM ap_internal_marks_entries WHERE submission_id = ? LIMIT 1`,
    [data.submissionId]
  );

  if (entries.length === 0) {
    throw Object.assign(new Error("Cannot submit without any student marks entered"), {
      status: 400,
    });
  }

  const prevStatus = sub.status;
  const newStatus: InternalMarksStatus = "pending_approval";

  await executeAcademic(
    `
    UPDATE ap_internal_marks_submissions
    SET status = ?, current_approval_level = 1, submitted_at = NOW(), submitted_by = ?
    WHERE id = ?
    `,
    [newStatus, actorUserId, data.submissionId]
  );

  await executeAcademic(
    `
    INSERT INTO ap_internal_marks_approvals
      (submission_id, approval_level, approver_user_id, approver_role_key, action, previous_status, new_status, comments)
    VALUES (?, 1, ?, 'staff', 'submit', ?, ?, ?)
    `,
    [data.submissionId, actorUserId, prevStatus, newStatus, data.comments ?? "Submitted for approval"]
  );

  await logAudit({
    actorUserId,
    action: "marks_submitted",
    entityType: "submission",
    entityId: data.submissionId,
    collegeId: sub.college_id,
    courseId: sub.course_id,
    branchId: sub.branch_id,
    subjectId: sub.subject_id,
    facultyStaffLinkId: sub.faculty_staff_link_id,
    details: { previousStatus: prevStatus, newStatus },
  });

  return { success: true, submissionId: data.submissionId, status: newStatus };
}

/** Get Submissions for Approvers & Tracking */
export async function getInternalMarksSubmissions(filters: {
  collegeId?: number;
  courseId?: number;
  branchId?: number;
  subjectId?: number;
  status?: InternalMarksStatus;
  userRoleKeys?: string[];
}): Promise<Array<{
  id: number;
  collegeId: number;
  collegeName: string;
  courseId: number;
  courseName: string;
  branchId: number;
  branchName: string;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  facultyStaffLinkId: number;
  facultyName: string;
  maxMarks: number;
  status: InternalMarksStatus;
  currentApprovalLevel: number;
  submittedAt: string | null;
  submittedByName?: string;
  studentCount: number;
  approvalHistory: Array<{
    id: number;
    approvalLevel: number;
    approverName: string;
    approverRoleKey: string;
    action: string;
    previousStatus: string;
    newStatus: string;
    comments: string | null;
    createdAt: string;
  }>;
}>> {
  await ensureInternalMarksSchema();

  const where: string[] = ["1=1"];
  const params: unknown[] = [];

  if (filters.collegeId) {
    where.push("s.college_id = ?");
    params.push(filters.collegeId);
  }
  if (filters.courseId) {
    where.push("s.course_id = ?");
    params.push(filters.courseId);
  }
  if (filters.branchId) {
    where.push("s.branch_id = ?");
    params.push(filters.branchId);
  }
  if (filters.subjectId) {
    where.push("s.subject_id = ?");
    params.push(filters.subjectId);
  }
  if (filters.status) {
    where.push("s.status = ?");
    params.push(filters.status);
  }

  const rows = await queryAcademic<
    (RowDataPacket & {
      id: number;
      college_id: number;
      course_id: number;
      branch_id: number;
      subject_id: number;
      faculty_staff_link_id: number;
      max_marks: number;
      status: InternalMarksStatus;
      current_approval_level: number;
      submitted_at: string | null;
      submitted_by: number | null;
      ems_sync_status: "not_synced" | "synced" | "failed" | null;
      ems_synced_at: string | null;
      ems_synced_by: number | null;
      ems_sync_error: string | null;
      submitter_name: string | null;
      faculty_name: string | null;
      student_count: number;
    })[]
  >(
    `
    SELECT
      s.id,
      s.college_id,
      s.course_id,
      s.branch_id,
      s.subject_id,
      s.faculty_staff_link_id,
      s.max_marks,
      s.status,
      s.current_approval_level,
      s.submitted_at,
      s.submitted_by,
      s.ems_sync_status,
      s.ems_synced_at,
      s.ems_synced_by,
      s.ems_sync_error,
      u.name AS submitter_name,
      sl.display_name AS faculty_name,
      (SELECT COUNT(*) FROM ap_internal_marks_entries e WHERE e.submission_id = s.id) AS student_count
    FROM ap_internal_marks_submissions s
    LEFT JOIN ap_users u ON u.id = s.submitted_by
    LEFT JOIN ap_staff_link sl ON sl.id = s.faculty_staff_link_id
    WHERE ${where.join(" AND ")}
    ORDER BY s.updated_at DESC
    `,
    params
  );

  // Load Subject names and College/Course/Branch names
  const [colleges, courses, branches] = await Promise.all([
    queryStudent<(RowDataPacket & { id: number; name: string })[]>(`SELECT id, name FROM colleges`),
    queryStudent<(RowDataPacket & { id: number; name: string })[]>(`SELECT id, name FROM courses`),
    queryStudent<(RowDataPacket & { id: number; name: string })[]>(`SELECT id, name FROM course_branches`),
  ]);

  const collegeMap = new Map(colleges.map((c) => [c.id, c.name]));
  const courseMap = new Map(courses.map((c) => [c.id, c.name]));
  const branchMap = new Map(branches.map((b) => [b.id, b.name]));

  const subjectIds = [...new Set(rows.map((r) => Number(r.subject_id)))];
  const subjectMap = new Map<number, { code: string; name: string }>();

  if (subjectIds.length > 0) {
    const sRows = await queryExam<
      (RowDataPacket & { id: number; code: string; name: string })[]
    >(
      `SELECT id, code, name FROM subjects WHERE id IN (${subjectIds.map(() => "?").join(",")})`,
      subjectIds
    );
    for (const sr of sRows) {
      subjectMap.set(sr.id, { code: sr.code, name: sr.name });
    }
  }

  // Load approval histories
  const submissionIds = rows.map((r) => Number(r.id));
  const historyMap = new Map<number, Array<{
    id: number;
    approvalLevel: number;
    approverName: string;
    approverRoleKey: string;
    action: string;
    previousStatus: string;
    newStatus: string;
    comments: string | null;
    createdAt: string;
  }>>();

  if (submissionIds.length > 0) {
    const hRows = await queryAcademic<
      (RowDataPacket & {
        id: number;
        submission_id: number;
        approval_level: number;
        approver_user_id: number;
        approver_role_key: string;
        action: string;
        previous_status: string;
        new_status: string;
        comments: string | null;
        created_at: string;
        approver_name: string | null;
      })[]
    >(
      `
      SELECT
        a.id,
        a.submission_id,
        a.approval_level,
        a.approver_user_id,
        a.approver_role_key,
        a.action,
        a.previous_status,
        a.new_status,
        a.comments,
        a.created_at,
        u.name AS approver_name
      FROM ap_internal_marks_approvals a
      LEFT JOIN ap_users u ON u.id = a.approver_user_id
      WHERE a.submission_id IN (${submissionIds.map(() => "?").join(",")})
      ORDER BY a.id ASC
      `,
      submissionIds
    );

    for (const hr of hRows) {
      const sId = Number(hr.submission_id);
      const list = historyMap.get(sId) || [];
      list.push({
        id: Number(hr.id),
        approvalLevel: Number(hr.approval_level),
        approverName: hr.approver_name || "Approver",
        approverRoleKey: hr.approver_role_key,
        action: hr.action,
        previousStatus: hr.previous_status,
        newStatus: hr.new_status,
        comments: hr.comments,
        createdAt: String(hr.created_at),
      });
      historyMap.set(sId, list);
    }
  }

  return rows.map((r) => {
    const subMeta = subjectMap.get(r.subject_id) || { code: "", name: "Subject" };
    return {
      id: Number(r.id),
      collegeId: r.college_id,
      collegeName: collegeMap.get(r.college_id) || "College",
      courseId: r.course_id,
      courseName: courseMap.get(r.course_id) || "Course",
      branchId: r.branch_id,
      branchName: branchMap.get(r.branch_id) || "Branch",
      subjectId: r.subject_id,
      subjectCode: subMeta.code,
      subjectName: subMeta.name,
      facultyStaffLinkId: r.faculty_staff_link_id,
      facultyName: r.faculty_name || "Faculty",
      maxMarks: Number(r.max_marks),
      status: r.status,
      currentApprovalLevel: Number(r.current_approval_level),
      submittedAt: r.submitted_at ? String(r.submitted_at) : null,
      submittedByName: r.submitter_name || undefined,
      studentCount: Number(r.student_count),
      emsSyncStatus: r.ems_sync_status || "not_synced",
      emsSyncedAt: r.ems_synced_at ? String(r.ems_synced_at) : null,
      emsSyncedBy: r.ems_synced_by ? Number(r.ems_synced_by) : null,
      emsSyncError: r.ems_sync_error || null,
      approvalHistory: historyMap.get(Number(r.id)) || [],
    };
  });
}

/** Process Approval Action (Approve / Reject / Return / Forward to EMS) */
export async function processApprovalAction(
  actorUserId: number,
  actorRoleKey: string,
  data: {
    submissionId: number;
    action: "approve" | "reject" | "return" | "forward_to_ems";
    comments?: string;
  }
) {
  await ensureInternalMarksSchema();

  if (data.action === "forward_to_ems") {
    return forwardSubmissionToEms(actorUserId, actorRoleKey, data.submissionId);
  }

  const subs = await queryAcademic<
    (RowDataPacket & {
      id: number;
      college_id: number;
      course_id: number;
      branch_id: number;
      subject_id: number;
      faculty_staff_link_id: number;
      status: InternalMarksStatus;
      current_approval_level: number;
    })[]
  >(`SELECT * FROM ap_internal_marks_submissions WHERE id = ? LIMIT 1`, [
    data.submissionId,
  ]);

  const sub = subs[0];
  if (!sub) throw Object.assign(new Error("Submission not found"), { status: 404 });

  if (sub.status !== "pending_approval" && sub.status !== "submitted") {
    throw Object.assign(
      new Error(`Cannot perform action on submission with status: ${sub.status}`),
      { status: 400 }
    );
  }

  const currentLevel = Number(sub.current_approval_level) || 1;

  // Get approval configurations for this college/course/branch
  const configs = await queryAcademic<
    (RowDataPacket & {
      level_number: number;
      approver_role_key: string;
      level_label: string;
    })[]
  >(
    `
    SELECT level_number, approver_role_key, level_label
    FROM ap_internal_marks_approval_configs
    WHERE is_active = 1
    ORDER BY level_number ASC
    `
  );

  const prevStatus = sub.status;
  let newStatus: InternalMarksStatus = prevStatus;
  let newLevel = currentLevel;

  if (data.action === "approve") {
    const nextConfig = configs.find((c) => Number(c.level_number) > currentLevel);
    if (nextConfig) {
      newLevel = Number(nextConfig.level_number);
      newStatus = "pending_approval";
    } else {
      newStatus = "approved";
    }
  } else if (data.action === "reject") {
    newStatus = "rejected";
  } else if (data.action === "return") {
    newStatus = "returned";
  }

  await executeAcademic(
    `
    UPDATE ap_internal_marks_submissions
    SET status = ?, current_approval_level = ?, updated_at = NOW()
    WHERE id = ?
    `,
    [newStatus, newLevel, data.submissionId]
  );

  await executeAcademic(
    `
    INSERT INTO ap_internal_marks_approvals
      (submission_id, approval_level, approver_user_id, approver_role_key, action, previous_status, new_status, comments)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      data.submissionId,
      currentLevel,
      actorUserId,
      actorRoleKey,
      data.action,
      prevStatus,
      newStatus,
      data.comments || `${data.action.toUpperCase()} by ${actorRoleKey}`,
    ]
  );

  if (data.action === "forward_to_ems" as any) {
    return forwardSubmissionToEms(actorUserId, actorRoleKey, data.submissionId);
  }

  await logAudit({
    actorUserId,
    action: `marks_${data.action}d`,
    entityType: "submission",
    entityId: data.submissionId,
    collegeId: sub.college_id,
    courseId: sub.course_id,
    branchId: sub.branch_id,
    subjectId: sub.subject_id,
    facultyStaffLinkId: sub.faculty_staff_link_id,
    details: {
      action: data.action,
      level: currentLevel,
      newLevel,
      newStatus,
      comments: data.comments,
    },
  });

  return { success: true, submissionId: data.submissionId, status: newStatus, level: newLevel };
}

/** Forward Submission to EMS (Final Authority Action - Idempotent) */
export async function forwardSubmissionToEms(
  actorUserId: number,
  actorRoleKey: string,
  submissionId: number
) {
  await ensureInternalMarksSchema();

  const subs = await queryAcademic<
    (RowDataPacket & {
      id: number;
      college_id: number;
      course_id: number;
      branch_id: number;
      subject_id: number;
      faculty_staff_link_id: number;
      max_marks: number;
      status: InternalMarksStatus;
      current_approval_level: number;
      ems_sync_status: "not_synced" | "synced" | "failed";
    })[]
  >(`SELECT * FROM ap_internal_marks_submissions WHERE id = ? LIMIT 1`, [
    submissionId,
  ]);

  const sub = subs[0];
  if (!sub) throw Object.assign(new Error("Submission not found"), { status: 404 });

  // Idempotency: If already synced to EMS, return clean success without duplicating
  if (sub.status === "forwarded_to_ems" && sub.ems_sync_status === "synced") {
    return {
      success: true,
      message: "Submission is already forwarded and synced to EMS.",
      status: "forwarded_to_ems",
      emsSyncStatus: "synced",
    };
  }

  // Fetch student entries for this submission
  const entries = await queryAcademic<
    (RowDataPacket & {
      id: number;
      student_db_id: number;
      admission_number: string;
      roll_number: string | null;
      student_name: string | null;
      marks_obtained: number | null;
      max_marks: number;
      remarks: string | null;
    })[]
  >(
    `SELECT * FROM ap_internal_marks_entries WHERE submission_id = ?`,
    [submissionId]
  );

  if (entries.length === 0) {
    throw Object.assign(new Error("No student marks entries found in submission"), {
      status: 400,
    });
  }

  // Fetch subject metadata from EMS (examination_portal) database
  const subRows = await queryExam<
    (RowDataPacket & { id: number; code: string; name: string })[]
  >(`SELECT id, code, name FROM subjects WHERE id = ? LIMIT 1`, [
    sub.subject_id,
  ]);

  const subjectMeta = subRows[0] || { code: "", name: "Subject" };
  const prevStatus = sub.status;

  try {
    // Upsert student internal marks idempotently in EMS database (student_marks table)
    for (const entry of entries) {
      const rollNumber = (entry.roll_number || entry.admission_number).trim();
      const studentName = entry.student_name || "Student";
      const internalMarks = entry.marks_obtained != null ? Number(entry.marks_obtained) : 0;
      const maxInternalMarks = Number(entry.max_marks || sub.max_marks || 30.00);
      const remarks = entry.remarks || "Internal Marks Forwarded";

      const existingEms = await queryExam<
        (RowDataPacket & { id: number })[]
      >(
        `SELECT id FROM student_marks WHERE studentRollNumber = ? AND subjectCode = ? LIMIT 1`,
        [rollNumber, subjectMeta.code]
      );

      if (existingEms[0]) {
        await executeExam(
          `
          UPDATE student_marks
          SET internalMarks = ?,
              maxInternalMarks = ?,
              status = 'synced',
              remarks = ?,
              uploadedBy = ?,
              updatedAt = NOW()
          WHERE id = ?
          `,
          [
            internalMarks,
            maxInternalMarks,
            remarks,
            `AcademicPortal (${actorRoleKey})`,
            existingEms[0].id,
          ]
        );
      } else {
        await executeExam(
          `
          INSERT INTO student_marks
            (category, examId, studentRollNumber, studentName, subjectCode, subjectName, internalMarks, maxInternalMarks, status, remarks, uploadedBy, createdAt, updatedAt)
          VALUES ('internal', NULL, ?, ?, ?, ?, ?, ?, 'synced', ?, ?, NOW(), NOW())
          `,
          [
            rollNumber,
            studentName,
            subjectMeta.code,
            subjectMeta.name,
            internalMarks,
            maxInternalMarks,
            remarks,
            `AcademicPortal (${actorRoleKey})`,
          ]
        );
      }
    }

    // Success -> Update local AP submission record status to forwarded_to_ems & ems_sync_status to synced
    await executeAcademic(
      `
      UPDATE ap_internal_marks_submissions
      SET status = 'forwarded_to_ems',
          ems_sync_status = 'synced',
          ems_synced_at = NOW(),
          ems_synced_by = ?,
          ems_sync_error = NULL,
          updated_at = NOW()
      WHERE id = ?
      `,
      [actorUserId, submissionId]
    );

    // Record approval action log
    await executeAcademic(
      `
      INSERT INTO ap_internal_marks_approvals
        (submission_id, approval_level, approver_user_id, approver_role_key, action, previous_status, new_status, comments)
      VALUES (?, ?, ?, ?, 'forward_to_ems', ?, 'forwarded_to_ems', ?)
      `,
      [
        submissionId,
        sub.current_approval_level,
        actorUserId,
        actorRoleKey,
        prevStatus,
        `Forwarded to EMS and synced (${entries.length} students)`,
      ]
    );

    // Record audit log
    await logAudit({
      actorUserId,
      action: "forwarded_to_ems",
      entityType: "submission",
      entityId: submissionId,
      collegeId: sub.college_id,
      courseId: sub.course_id,
      branchId: sub.branch_id,
      subjectId: sub.subject_id,
      facultyStaffLinkId: sub.faculty_staff_link_id,
      details: {
        syncedStudentCount: entries.length,
        subjectCode: subjectMeta.code,
      },
    });

    return {
      success: true,
      message: "Internal marks forwarded and synced to EMS successfully!",
      status: "forwarded_to_ems",
      emsSyncStatus: "synced",
      syncedCount: entries.length,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "EMS Sync Failed";

    // Failure -> Keep submission local state marked with ems_sync_failed
    await executeAcademic(
      `
      UPDATE ap_internal_marks_submissions
      SET status = 'ems_sync_failed',
          ems_sync_status = 'failed',
          ems_sync_error = ?,
          updated_at = NOW()
      WHERE id = ?
      `,
      [errorMsg, submissionId]
    );

    // Record approval failure log
    await executeAcademic(
      `
      INSERT INTO ap_internal_marks_approvals
        (submission_id, approval_level, approver_user_id, approver_role_key, action, previous_status, new_status, comments)
      VALUES (?, ?, ?, ?, 'ems_sync_failed', ?, 'ems_sync_failed', ?)
      `,
      [
        submissionId,
        sub.current_approval_level,
        actorUserId,
        actorRoleKey,
        prevStatus,
        `EMS Sync Failed: ${errorMsg}`,
      ]
    );

    await logAudit({
      actorUserId,
      action: "ems_sync_failed",
      entityType: "submission",
      entityId: submissionId,
      collegeId: sub.college_id,
      courseId: sub.course_id,
      branchId: sub.branch_id,
      subjectId: sub.subject_id,
      facultyStaffLinkId: sub.faculty_staff_link_id,
      details: { error: errorMsg },
    });

    return {
      success: false,
      error: errorMsg,
      status: "ems_sync_failed",
      emsSyncStatus: "failed",
      canRetry: true,
    };
  }
}

/** Configurable Approval Levels API */
export async function getApprovalConfigs(collegeId?: number | null, activeOnly = false): Promise<ApprovalConfigLevel[]> {
  await ensureInternalMarksSchema();

  const whereClause = activeOnly
    ? `WHERE (college_id = ? OR (college_id IS NULL AND ? IS NULL)) AND is_active = 1`
    : `WHERE (college_id = ? OR (college_id IS NULL AND ? IS NULL))`;

  const rows = await queryAcademic<
    (RowDataPacket & {
      id: number;
      level_number: number;
      approver_role_key: string;
      level_label: string;
      is_active: number;
    })[]
  >(
    `
    SELECT id, level_number, approver_role_key, level_label, is_active
    FROM ap_internal_marks_approval_configs
    ${whereClause}
    ORDER BY level_number ASC
    `,
    [collegeId ?? null, collegeId ?? null]
  );

  if (rows.length === 0 && collegeId != null) {
    // Fall back to global default
    return getApprovalConfigs(null, activeOnly);
  }

  return rows.map((r) => ({
    id: Number(r.id),
    levelNumber: Number(r.level_number),
    approverRoleKey: r.approver_role_key,
    levelLabel: r.level_label,
    isActive: Number(r.is_active) === 1,
  }));
}

export async function saveApprovalConfigs(
  actorUserId: number,
  collegeId: number | null,
  levels: Array<{ levelNumber: number; approverRoleKey: string; levelLabel: string; isActive?: boolean }>
) {
  await ensureInternalMarksSchema();

  // Deactivate existing levels for this college scope
  await executeAcademic(
    `UPDATE ap_internal_marks_approval_configs SET is_active = 0 WHERE COALESCE(college_id, 0) = COALESCE(?, 0)`,
    [collegeId ?? 0]
  );

  for (const lvl of levels) {
    const activeVal = lvl.isActive !== false ? 1 : 0;
    await executeAcademic(
      `
      INSERT INTO ap_internal_marks_approval_configs
        (college_id, level_number, approver_role_key, level_label, is_active)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        approver_role_key = VALUES(approver_role_key),
        level_label = VALUES(level_label),
        is_active = VALUES(is_active)
      `,
      [collegeId ?? null, lvl.levelNumber, lvl.approverRoleKey, lvl.levelLabel, activeVal]
    );
  }

  await logAudit({
    actorUserId,
    action: "approval_config_updated",
    entityType: "approval_config",
    collegeId: collegeId ?? null,
    details: { levelCount: levels.length },
  });

  return { success: true };
}

/** Get Audit Trail Logs */
export async function getInternalMarksAuditLogs(filters?: {
  collegeId?: number;
  subjectId?: number;
  actorUserId?: number;
}) {
  await ensureInternalMarksSchema();

  const where: string[] = ["1=1"];
  const params: unknown[] = [];

  if (filters?.collegeId) {
    where.push("l.college_id = ?");
    params.push(filters.collegeId);
  }
  if (filters?.subjectId) {
    where.push("l.subject_id = ?");
    params.push(filters.subjectId);
  }
  if (filters?.actorUserId) {
    where.push("l.actor_user_id = ?");
    params.push(filters.actorUserId);
  }

  const rows = await queryAcademic<
    (RowDataPacket & {
      id: number;
      actor_user_id: number;
      action: string;
      entity_type: string;
      entity_id: number | null;
      college_id: number | null;
      subject_id: number | null;
      details_json: unknown;
      created_at: string;
      actor_name: string | null;
    })[]
  >(
    `
    SELECT
      l.id,
      l.actor_user_id,
      l.action,
      l.entity_type,
      l.entity_id,
      l.college_id,
      l.subject_id,
      l.details_json,
      l.created_at,
      u.name AS actor_name
    FROM ap_internal_marks_audit_logs l
    LEFT JOIN ap_users u ON u.id = l.actor_user_id
    WHERE ${where.join(" AND ")}
    ORDER BY l.id DESC
    LIMIT 200
    `,
    params
  );

  return rows.map((r) => ({
    id: Number(r.id),
    actorUserId: Number(r.actor_user_id),
    actorName: r.actor_name || "User",
    action: r.action,
    entityType: r.entity_type,
    entityId: r.entity_id ? Number(r.entity_id) : null,
    collegeId: r.college_id ? Number(r.college_id) : null,
    subjectId: r.subject_id ? Number(r.subject_id) : null,
    details: r.details_json,
    createdAt: String(r.created_at),
  }));
}
