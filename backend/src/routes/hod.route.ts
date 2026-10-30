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

      const rawYears = req.query.years || req.query.year;
      let years: number[] | undefined;
      if (typeof rawYears === "string" && rawYears.trim() && rawYears !== "all") {
        years = rawYears
          .split(",")
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isFinite(n) && n > 0);
      }

      const data = await getHodDashboardData(getAuthz(req), {
        departmentName,
        branchId,
        date,
        academicYear,
        years: years && years.length > 0 ? years : undefined,
      });

      res.json({ data });
    } catch (error) {
      next(error);
    }
  },
);
