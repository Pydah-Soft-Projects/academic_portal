import { Router } from "express";
import type { AuthedRequest } from "../middleware/auth.middleware.js";
import { getAuthz, requirePermission } from "../authz/require-permission.js";
import { getClassTeacherDashboardData } from "../services/class-teacher.service.js";

export const classTeacherRouter = Router();

classTeacherRouter.get("/dashboard", requirePermission("dashboard.view"), async (req: AuthedRequest, res, next) => {
  try {
    const section = typeof req.query.section === "string" ? req.query.section : undefined;
    const academicYear = typeof req.query.academicYear === "string" ? req.query.academicYear : undefined;
    const date = typeof req.query.date === "string" ? req.query.date : undefined;

    const data = await getClassTeacherDashboardData(getAuthz(req), {
      section,
      academicYear,
      date,
    });

    res.json({ data });
  } catch (error) {
    next(error);
  }
});
