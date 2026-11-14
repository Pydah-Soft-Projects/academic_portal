import { Router } from "express";
import type { RowDataPacket } from "mysql2";
import type { AuthedRequest } from "../middleware/auth.middleware.js";
import {
  requirePermission,
  scopedFilters,
  ensureEntityScope,
  getAuthz,
  statusFromAuthzError,
} from "../authz/require-permission.js";
import {
  shouldRestrictToOwnTeachingLoad,
  resolveStaffLinkIdForUser,
} from "../authz/faculty-self-scope.js";
import { queryAcademic } from "../db/pools.js";
import {
  getSubjectFacultyHierarchy,
  listAccessRules,
  saveAccessRule,
  deleteAccessRule,
  getFacultyAssignedSubjects,
  getStudentsForMarksEntry,
  saveMarksDraft,
  submitMarksForApproval,
  getInternalMarksSubmissions,
  processApprovalAction,
  forwardSubmissionToEms,
  getApprovalConfigs,
  saveApprovalConfigs,
  getInternalMarksAuditLogs,
  type AccessLevel,
  type InternalMarksStatus,
} from "../services/internal-marks.service.js";

export const internalMarksRouter = Router();

function num(val: unknown): number | undefined {
  if (typeof val !== "string" && typeof val !== "number") return undefined;
  if (val === "" || val === "all") return undefined;
  const n = Number(val);
  return Number.isFinite(n) ? n : undefined;
}

function str(val: unknown): string | undefined {
  if (typeof val !== "string" || val === "" || val === "all") return undefined;
  return val.trim();
}

/** Superadmin / HOD Hierarchy View */
internalMarksRouter.get(
  "/subjects-hierarchy",
  requirePermission("internal_marks_mgmt.view"),
  async (req: AuthedRequest, res, next) => {
    try {
      const collegeId = num(req.query.collegeId);
      const courseId = num(req.query.courseId);
      const branchId = num(req.query.branchId);
      const subjectId = num(req.query.subjectId);
      const facultyId = num(req.query.facultyId);
      const year = num(req.query.year);
      const semester = num(req.query.semester);
      const regParam = req.query.regulationId;
      const regulationId = regParam === "all" ? "all" : regParam === "auto" ? "auto" : num(regParam);

      const scoped = scopedFilters(req, { collegeId, branchId });

      const result = await getSubjectFacultyHierarchy({
        collegeId: scoped.collegeId ?? collegeId,
        courseId,
        branchId: scoped.branchId ?? branchId,
        subjectId,
        facultyId,
        year,
        semester,
        regulationId,
      });

      res.json(result);
    } catch (error) {
      const status = statusFromAuthzError(error);
      if (status === 401 || status === 403) {
        res.status(status).json({ message: (error as Error).message || "Forbidden" });
        return;
      }
      next(error);
    }
  }
);

/** List Access Rules */
internalMarksRouter.get(
  "/access-rules",
  requirePermission("internal_marks_mgmt.view"),
  async (req: AuthedRequest, res, next) => {
    try {
      const collegeId = num(req.query.collegeId);
      const courseId = num(req.query.courseId);
      const branchId = num(req.query.branchId);

      const scoped = scopedFilters(req, { collegeId, branchId });

      const rules = await listAccessRules({
        collegeId: scoped.collegeId ?? collegeId,
        courseId,
        branchId: scoped.branchId ?? branchId,
      });
      res.json({ data: rules });
    } catch (error) {
      const status = statusFromAuthzError(error);
      if (status === 401 || status === 403) {
        res.status(status).json({ message: (error as Error).message || "Forbidden" });
        return;
      }
      next(error);
    }
  }
);

/** Create/Update Access Rule */
internalMarksRouter.post(
  "/access-rules",
  requirePermission("internal_marks_mgmt.edit"),
  async (req: AuthedRequest, res, next) => {
    try {
      if (!req.authUser) {
        res.status(401).json({ message: "Authentication required" });
        return;
      }

      const { accessLevel, collegeId, courseId, branchId, subjectId, facultyStaffLinkId, isEnabled } = req.body;

      if (!accessLevel || typeof isEnabled !== "boolean") {
        res.status(400).json({ message: "accessLevel and isEnabled are required" });
        return;
      }

      // Verify scope for the target college/branch
      ensureEntityScope(req, {
        collegeId: num(collegeId),
        branchId: num(branchId),
      });

      const result = await saveAccessRule(req.authUser.id, {
        accessLevel: accessLevel as AccessLevel,
        collegeId: num(collegeId),
        courseId: num(courseId),
        branchId: num(branchId),
        subjectId: num(subjectId),
        facultyStaffLinkId: num(facultyStaffLinkId),
        isEnabled: Boolean(isEnabled),
      });

      res.json(result);
    } catch (error) {
      const status = statusFromAuthzError(error);
      if (status === 401 || status === 403) {
        res.status(status).json({ message: (error as Error).message || "Forbidden" });
        return;
      }
      next(error);
    }
  }
);

/** Delete Access Rule */
internalMarksRouter.delete(
  "/access-rules/:id",
  requirePermission("internal_marks_mgmt.edit"),
  async (req: AuthedRequest, res, next) => {
    try {
      if (!req.authUser) {
        res.status(401).json({ message: "Authentication required" });
        return;
      }

      const id = Number(req.params.id);
      if (!id) {
        res.status(400).json({ message: "Invalid rule ID" });
        return;
      }

      const ruleRows = await queryAcademic<(RowDataPacket & { college_id: number | null; branch_id: number | null })[]>(
        `SELECT college_id, branch_id FROM ap_internal_marks_access WHERE id = ? LIMIT 1`,
        [id]
      );
      if (ruleRows[0]) {
        ensureEntityScope(req, {
          collegeId: ruleRows[0].college_id,
          branchId: ruleRows[0].branch_id,
        });
      }

      const result = await deleteAccessRule(req.authUser.id, id);
      res.json(result);
    } catch (error) {
      const status = statusFromAuthzError(error);
      if (status === 401 || status === 403) {
        res.status(status).json({ message: (error as Error).message || "Forbidden" });
        return;
      }
      next(error);
    }
  }
);

/** Faculty Assigned Subjects */
internalMarksRouter.get(
  "/faculty-subjects",
  requirePermission("internal_marks.view"),
  async (req: AuthedRequest, res, next) => {
    try {
      if (!req.authUser) {
        res.status(401).json({ message: "Authentication required" });
        return;
      }

      const result = await getFacultyAssignedSubjects(
        req.authUser.id,
        req.authUser.hrmsEmployeeId
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/** Student Marks Entry List */
internalMarksRouter.get(
  "/students",
  requirePermission("internal_marks.view"),
  async (req: AuthedRequest, res, next) => {
    try {
      const collegeId = num(req.query.collegeId);
      const courseId = num(req.query.courseId);
      const branchId = num(req.query.branchId);
      const subjectId = num(req.query.subjectId);
      const facultyStaffLinkId = num(req.query.facultyStaffLinkId);
      const batch = str(req.query.batch);
      const section = str(req.query.section);
      const semester = num(req.query.semester);
      const year = num(req.query.year);

      if (!collegeId || !courseId || !branchId || !subjectId || !facultyStaffLinkId) {
        res.status(400).json({
          message: "collegeId, courseId, branchId, subjectId, and facultyStaffLinkId are required",
        });
        return;
      }

      scopedFilters(req, { collegeId, branchId });

      const authz = getAuthz(req);
      if (shouldRestrictToOwnTeachingLoad(authz)) {
        const userStaffLinkId = await resolveStaffLinkIdForUser(authz.userId);
        if (userStaffLinkId != null && facultyStaffLinkId !== userStaffLinkId) {
          res.status(403).json({ message: "You can only view marks entry for your own assigned subjects" });
          return;
        }
      }

      const data = await getStudentsForMarksEntry({
        collegeId,
        courseId,
        branchId,
        subjectId,
        facultyStaffLinkId,
        year,
        batch,
        semester,
        section,
      });

      res.json({ data });
    } catch (error) {
      const status = statusFromAuthzError(error);
      if (status === 401 || status === 403) {
        res.status(status).json({ message: (error as Error).message || "Forbidden" });
        return;
      }
      next(error);
    }
  }
);

/** Save Draft Marks */
internalMarksRouter.post(
  "/draft",
  requirePermission("internal_marks.edit"),
  async (req: AuthedRequest, res, next) => {
    try {
      if (!req.authUser) {
        res.status(401).json({ message: "Authentication required" });
        return;
      }

      const {
        collegeId,
        courseId,
        branchId,
        subjectId,
        facultyStaffLinkId,
        batch,
        semesterNumber,
        maxMarks,
        entries,
      } = req.body;

      if (
        !collegeId ||
        !courseId ||
        !branchId ||
        !subjectId ||
        !facultyStaffLinkId ||
        !Array.isArray(entries)
      ) {
        res.status(400).json({ message: "Missing required marks draft fields" });
        return;
      }

      ensureEntityScope(req, {
        collegeId: num(collegeId),
        branchId: num(branchId),
      });

      const authz = getAuthz(req);
      if (shouldRestrictToOwnTeachingLoad(authz)) {
        const userStaffLinkId = await resolveStaffLinkIdForUser(authz.userId);
        if (userStaffLinkId != null && Number(facultyStaffLinkId) !== userStaffLinkId) {
          res.status(403).json({ message: "You can only save marks for your own assigned subjects" });
          return;
        }
      }

      const result = await saveMarksDraft(req.authUser.id, {
        collegeId: Number(collegeId),
        courseId: Number(courseId),
        branchId: Number(branchId),
        subjectId: Number(subjectId),
        facultyStaffLinkId: Number(facultyStaffLinkId),
        batch: str(batch),
        semesterNumber: num(semesterNumber),
        maxMarks: Number(maxMarks) || 30,
        entries,
      });

      res.json(result);
    } catch (error) {
      const status = statusFromAuthzError(error);
      if (status === 401 || status === 403) {
        res.status(status).json({ message: (error as Error).message || "Forbidden" });
        return;
      }
      next(error);
    }
  }
);

/** Submit Marks for Approval */
internalMarksRouter.post(
  "/submit",
  requirePermission("internal_marks.edit"),
  async (req: AuthedRequest, res, next) => {
    try {
      if (!req.authUser) {
        res.status(401).json({ message: "Authentication required" });
        return;
      }

      const { submissionId, comments } = req.body;
      if (!submissionId) {
        res.status(400).json({ message: "submissionId is required" });
        return;
      }

      const authz = getAuthz(req);
      if (shouldRestrictToOwnTeachingLoad(authz)) {
        const userStaffLinkId = await resolveStaffLinkIdForUser(authz.userId);
        const subCheck = await queryAcademic<(RowDataPacket & { faculty_staff_link_id: number; college_id: number; branch_id: number })[]>(
          `SELECT faculty_staff_link_id, college_id, branch_id FROM ap_internal_marks_submissions WHERE id = ? LIMIT 1`,
          [Number(submissionId)]
        );
        if (subCheck[0]) {
          ensureEntityScope(req, {
            collegeId: subCheck[0].college_id,
            branchId: subCheck[0].branch_id,
          });
          if (userStaffLinkId != null && Number(subCheck[0].faculty_staff_link_id) !== userStaffLinkId) {
            res.status(403).json({ message: "You can only submit marks for your own assigned subjects" });
            return;
          }
        }
      }

      const result = await submitMarksForApproval(req.authUser.id, {
        submissionId: Number(submissionId),
        comments: str(comments),
      });

      res.json(result);
    } catch (error) {
      const status = statusFromAuthzError(error);
      if (status === 401 || status === 403) {
        res.status(status).json({ message: (error as Error).message || "Forbidden" });
        return;
      }
      next(error);
    }
  }
);

/** Get Submissions for Approvers & Tracking */
internalMarksRouter.get(
  "/submissions",
  requirePermission("internal_marks.view"),
  async (req: AuthedRequest, res, next) => {
    try {
      const collegeId = num(req.query.collegeId);
      const courseId = num(req.query.courseId);
      const branchId = num(req.query.branchId);
      const subjectId = num(req.query.subjectId);
      const status = str(req.query.status) as InternalMarksStatus | undefined;

      const scoped = scopedFilters(req, { collegeId, branchId });

      const submissions = await getInternalMarksSubmissions({
        collegeId: scoped.collegeId ?? collegeId,
        courseId,
        branchId: scoped.branchId ?? branchId,
        subjectId,
        status,
        userRoleKeys: req.authz?.roleKeys,
      });

      res.json({ data: submissions });
    } catch (error) {
      const status = statusFromAuthzError(error);
      if (status === 401 || status === 403) {
        res.status(status).json({ message: (error as Error).message || "Forbidden" });
        return;
      }
      next(error);
    }
  }
);

/** Approve / Reject / Return Submission */
internalMarksRouter.post(
  "/submissions/:id/action",
  requirePermission("internal_marks.edit"),
  async (req: AuthedRequest, res, next) => {
    try {
      if (!req.authUser) {
        res.status(401).json({ message: "Authentication required" });
        return;
      }

      const submissionId = Number(req.params.id);
      const { action, comments } = req.body;

      if (!submissionId || !["approve", "reject", "return", "forward_to_ems"].includes(action)) {
        res.status(400).json({ message: "Valid submission ID and action (approve, reject, return, forward_to_ems) are required" });
        return;
      }

      const subCheck = await queryAcademic<(RowDataPacket & { college_id: number; branch_id: number })[]>(
        `SELECT college_id, branch_id FROM ap_internal_marks_submissions WHERE id = ? LIMIT 1`,
        [submissionId]
      );
      if (subCheck[0]) {
        ensureEntityScope(req, {
          collegeId: subCheck[0].college_id,
          branchId: subCheck[0].branch_id,
        });
      }

      const roleKey =
        req.authz?.roleKeys?.find((r) => ["super_admin", "principal", "vice_principal", "hod"].includes(r)) ||
        req.authz?.roleKeys?.[0] ||
        "staff";

      const result = await processApprovalAction(req.authUser.id, roleKey, {
        submissionId,
        action,
        comments: str(comments),
      });

      res.json(result);
    } catch (error) {
      const status = statusFromAuthzError(error);
      if (status === 401 || status === 403) {
        res.status(status).json({ message: (error as Error).message || "Forbidden" });
        return;
      }
      next(error);
    }
  }
);

/** Forward Approved Submission to EMS Database */
internalMarksRouter.post(
  "/submissions/:id/forward-to-ems",
  requirePermission("internal_marks.edit"),
  async (req: AuthedRequest, res, next) => {
    try {
      if (!req.authUser) {
        res.status(401).json({ message: "Authentication required" });
        return;
      }

      const submissionId = Number(req.params.id);
      if (!submissionId) {
        res.status(400).json({ message: "Valid submission ID is required" });
        return;
      }

      const subCheck = await queryAcademic<(RowDataPacket & { college_id: number; branch_id: number })[]>(
        `SELECT college_id, branch_id FROM ap_internal_marks_submissions WHERE id = ? LIMIT 1`,
        [submissionId]
      );
      if (subCheck[0]) {
        ensureEntityScope(req, {
          collegeId: subCheck[0].college_id,
          branchId: subCheck[0].branch_id,
        });
      }

      const roleKey =
        req.authz?.roleKeys?.find((r) => ["super_admin", "principal", "vice_principal", "hod"].includes(r)) ||
        req.authz?.roleKeys?.[0] ||
        "staff";
      const result = await forwardSubmissionToEms(req.authUser.id, roleKey, submissionId);

      if (!result.success && result.error) {
        res.status(400).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      const status = statusFromAuthzError(error);
      if (status === 401 || status === 403) {
        res.status(status).json({ message: (error as Error).message || "Forbidden" });
        return;
      }
      next(error);
    }
  }
);

/** Approval Workflows Configuration */
internalMarksRouter.get(
  "/approval-configs",
  requirePermission("internal_marks_mgmt.view", "internal_marks.view"),
  async (req: AuthedRequest, res, next) => {
    try {
      const collegeId = num(req.query.collegeId);
      const configs = await getApprovalConfigs(collegeId);
      res.json({ data: configs });
    } catch (error) {
      next(error);
    }
  }
);

internalMarksRouter.post(
  "/approval-configs",
  requirePermission("internal_marks_mgmt.edit"),
  async (req: AuthedRequest, res, next) => {
    try {
      if (!req.authUser) {
        res.status(401).json({ message: "Authentication required" });
        return;
      }

      const { collegeId, levels } = req.body;
      if (!Array.isArray(levels)) {
        res.status(400).json({ message: "levels array is required" });
        return;
      }

      const result = await saveApprovalConfigs(
        req.authUser.id,
        num(collegeId) ?? null,
        levels
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/** Audit Logs */
internalMarksRouter.get(
  "/audit-logs",
  requirePermission("internal_marks_mgmt.view"),
  async (req: AuthedRequest, res, next) => {
    try {
      const collegeId = num(req.query.collegeId);
      const subjectId = num(req.query.subjectId);

      const logs = await getInternalMarksAuditLogs({ collegeId, subjectId });
      res.json({ data: logs });
    } catch (error) {
      next(error);
    }
  }
);
