import { Router } from "express";
import type { AuthedRequest } from "../middleware/auth.middleware.js";
import { getAuthz, requirePermission } from "../authz/require-permission.js";
import { getHodDashboardData } from "../services/hod-dashboard.service.js";

export const hodRouter = Router();

hodRouter.get(
  "/dashboard",
  requirePermission("dashboard.view"),
  async (req: AuthedRequest, res, next) => {
    try {
      const departmentName = typeof req.query.departmentName === "string" ? req.query.departmentName : undefined;
      const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
      const date = typeof req.query.date === "string" ? req.query.date : undefined;
      const academicYear = typeof req.query.academicYear === "string" ? req.query.academicYear : undefined;

      const data = await getHodDashboardData(getAuthz(req), {
        departmentName,
        branchId,
        date,
        academicYear,
      });

      res.json({ data });
    } catch (error) {
      next(error);
    }
  },
);
