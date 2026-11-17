import { Router } from "express";
import type { AuthedRequest } from "../middleware/auth.middleware.js";
import { requirePermission, scopedFilters, getAuthz, statusFromAuthzError } from "../authz/require-permission.js";
import {
  getSubjectAttendanceData,
  saveSubjectAttendanceData,
} from "../services/subject-attendance.service.js";
import { getAttendanceThresholdSettings } from "../services/attendance-thresholds.service.js";

export const subjectAttendanceRouter = Router();

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

/**
 * GET /api/subject-attendance
 * Fetch subjects, students, and subject-wise attendance register entries
 */
subjectAttendanceRouter.get(
  "/",
  requirePermission("attendance.view"),
  async (req: AuthedRequest, res, next) => {
    try {
      const collegeId = num(req.query.collegeId);
      const courseId = num(req.query.courseId);
      const branchId = num(req.query.branchId);
      const year = num(req.query.year);
      const semester = num(req.query.semester);
      const section = str(req.query.section);
      const batch = str(req.query.batch);
      const academicYear = str(req.query.academicYear);
      const month = str(req.query.month);

      // Enforce academic scope gracefully for all users
      let finalCollegeId = collegeId;
      let finalBranchId = branchId;
      try {
        const effectiveScope = scopedFilters(req, { collegeId, branchId });
        finalCollegeId = effectiveScope.collegeId ?? collegeId;
        finalBranchId = effectiveScope.branchId ?? branchId;
      } catch {
        const authz = getAuthz(req);
        if (authz.scope.collegeIds?.length && !authz.scope.isGlobal) {
          finalCollegeId = collegeId ?? authz.scope.collegeIds[0];
        }
      }

      const authz = getAuthz(req);
      const isSuperAdmin = authz.roles.some((r) => r.roleKey === "super_admin");
      const isPrincipal = authz.roles.some((r) => r.roleKey === "principal" || r.roleKey === "vice_principal");
      const isHod = authz.roles.some((r) => r.roleKey === "hod");
      const isClassTeacher = authz.roles.some((r) => r.roleKey === "class_teacher");
      const isStaff = authz.roles.some((r) => r.roleKey === "staff");

      const canEdit = isSuperAdmin || isPrincipal || isHod || isClassTeacher || isStaff;

      const result = await getSubjectAttendanceData({
        collegeId: finalCollegeId,
        courseId,
        branchId: finalBranchId,
        year,
        semester,
        section,
        batch,
        academicYear: academicYear || "2026-2027",
        month,
      });

      const thresholdSettings = await getAttendanceThresholdSettings(finalCollegeId);

      res.json({
        ...result,
        thresholds: thresholdSettings.thresholds,
        permissions: {
          canEdit,
          isSuperAdmin,
          isPrincipal,
          isHod,
          isClassTeacher,
          isStaff,
        },
      });
    } catch (error) {
      const status = statusFromAuthzError(error);
      if (status === 401 || status === 403) {
        res.status(status).json({ message: (error as Error).message || "Forbidden" });
        return;
      }
      next(error);
    }
  },
);

/**
 * POST /api/subject-attendance/save
 * Bulk save or update subject attendance register entries
 */
subjectAttendanceRouter.post(
  "/save",
  requirePermission("attendance.view", "attendance.post"),
  async (req: AuthedRequest, res, next) => {
    try {
      const authz = getAuthz(req);
      const {
        collegeId,
        courseId,
        branchId,
        academicYear,
        year,
        semester,
        section,
        batch,
        month,
        entries,
      } = req.body;

      if (!collegeId || !courseId || !branchId || !entries || !Array.isArray(entries)) {
        res.status(400).json({ message: "Invalid payload: collegeId, courseId, branchId, and entries array are required" });
        return;
      }

      // Check scope gracefully without blocking faculty teaching across branches
      try {
        scopedFilters(req, { collegeId, branchId });
      } catch {
        if (authz.scope.collegeIds?.length && !authz.scope.isGlobal) {
          if (!authz.scope.collegeIds.includes(Number(collegeId))) {
            res.status(403).json({ message: "Forbidden for this college scope" });
            return;
          }
        }
      }

      const saveResult = await saveSubjectAttendanceData({
        collegeId: Number(collegeId),
        courseId: Number(courseId),
        branchId: Number(branchId),
        academicYear: String(academicYear || "2026-2027"),
        year: Number(year || 1),
        semester: Number(semester || 1),
        section: section ? String(section) : "",
        batch: batch ? String(batch) : "",
        month: month ? String(month) : "Cumulative",
        userId: authz.userId,
        entries,
      });

      res.json(saveResult);
    } catch (error) {
      const status = statusFromAuthzError(error);
      if (status === 401 || status === 403) {
        res.status(status).json({ message: (error as Error).message || "Forbidden" });
        return;
      }
      next(error);
    }
  },
);

