import { Router } from "express";
import type { AuthedRequest } from "../middleware/auth.middleware.js";
import {
  getAuthz,
  requirePermission,
  scopedFilters,
  statusFromAuthzError,
} from "../authz/require-permission.js";
import { getPrincipalDashboardData } from "../services/principal-dashboard.service.js";

export const principalDashboardRouter = Router();

principalDashboardRouter.get(
  "/summary",
  requirePermission(
    "dashboard.view",
    "reports.view",
    "attendance.view",
  ),
  async (req: AuthedRequest, res, next) => {
    try {
      const authz = getAuthz(req);
      const rawCollege = typeof req.query.collegeId === "string" ? req.query.collegeId : undefined;
      const rawBranch = typeof req.query.branchId === "string" ? req.query.branchId : undefined;

      const reqCollegeId = rawCollege && rawCollege !== "all" && !isNaN(Number(rawCollege)) ? Number(rawCollege) : undefined;
      const reqBranchId = rawBranch && rawBranch !== "all" && !isNaN(Number(rawBranch)) ? Number(rawBranch) : undefined;

      const scoped = scopedFilters(req, {
        collegeId: reqCollegeId,
        branchId: reqBranchId,
      });

      const courseId = req.query.courseId ? Number(req.query.courseId) : undefined;
      const academicYear = typeof req.query.academicYear === "string" ? req.query.academicYear : undefined;
      const semester = typeof req.query.semester === "string" ? req.query.semester : undefined;
      const date = typeof req.query.date === "string" ? req.query.date : undefined;
      const startDate = typeof req.query.startDate === "string" ? req.query.startDate : undefined;
      const endDate = typeof req.query.endDate === "string" ? req.query.endDate : undefined;

      const data = await getPrincipalDashboardData(authz, {
        collegeId: reqCollegeId ?? scoped.collegeId,
        collegeIds: reqCollegeId ? [reqCollegeId] : scoped.collegeIds,
        courseId: Number.isFinite(courseId) ? courseId : undefined,
        branchId: reqBranchId ? scoped.branchId : undefined,
        academicYear,
        semester,
        date,
        startDate,
        endDate,
      });

      res.json(data);
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
