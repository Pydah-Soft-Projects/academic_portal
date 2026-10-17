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
      const scoped = scopedFilters(req, {
        collegeId: req.query.collegeId ? Number(req.query.collegeId) : undefined,
        branchId: req.query.branchId ? Number(req.query.branchId) : undefined,
      });

      const courseId = req.query.courseId ? Number(req.query.courseId) : undefined;
      const academicYear = typeof req.query.academicYear === "string" ? req.query.academicYear : undefined;
      const semester = typeof req.query.semester === "string" ? req.query.semester : undefined;
      const date = typeof req.query.date === "string" ? req.query.date : undefined;

      const data = await getPrincipalDashboardData(authz, {
        collegeId: scoped.collegeId,
        collegeIds: scoped.collegeIds,
        courseId: Number.isFinite(courseId) ? courseId : undefined,
        branchId: scoped.branchId,
        academicYear,
        semester,
        date,
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
